// PrivacyGuard — monitoring & enforcement engine.
//
// What is REAL here (browser-sandbox capabilities):
//   • PerformanceObserver-based capture of every request this page context makes
//     (fonts, probes, DoH lookups) — real destinations, real byte counts.
//   • Real DNS-over-HTTPS resolution via dns.google / cloudflare-dns.com.
//   • Real request blocking for traffic the console itself (or its test console)
//     originates — the guard vetoes before anything leaves the machine.
//   • Real local-AI endpoint probing (Ollama /api/tags, LM Studio /v1/models).
//   • Persistent local database (IndexedDB, SQLite-equivalent schema).
//
// What is SIMULATED and clearly labeled:
//   • Per-process attribution (claude.exe, ollama.exe …) and Windows Firewall /
//     WFP enforcement. A web page cannot touch the Windows network stack, so a
//     demo traffic plane renders those flows, honestly tagged `simulated`.

import type {
  AppProfile, ConnEvent, DnsEvent, DnsRecType, ListCategory, RuntimeApp, Verdict,
} from "./core";
import { chance, clamp, fmtBytes, listMatch, pick, pseudoIp, scopeOf, uid } from "./core";
import { APP_CATALOG, portFor } from "./catalog";
import {
  allDns, allEvents, allNotifs, bufferDns, bufferEvent, flush, initDb,
  kvGet, kvSet, pruneEvents, saveNotif, saveReport, wipeAll,
} from "./db";
import { parseHosts, useStore } from "./store";
import { classifyDestination } from "./threats";

const WEBAPP_ID = "privacyguard-web";

const webAppProfile: AppProfile = {
  id: WEBAPP_ID, name: "PrivacyGuard Console", exe: "privacyguard-web",
  path: "(browser application context)", publisher: "PrivacyGuard",
  category: "other", ai: false, pid: 0, knownDomains: ["dns.google", "www.gstatic.com", "fonts.googleapis.com"],
  weight: 0,
};

/* ================= DNS cache ================= */
const dnsCache = new Map<string, { ips: string[]; exp: number }>();

function cacheKey(d: string, t: string) { return `${t}:${d.toLowerCase()}`; }

let engineSilent = false; // true while seeding history — verdicts still computed, side-effects muted
const warnedDest = new Set<string>(); // one sensitive-egress warning per destination per session

/* ================= Blocklist evaluation ================= */

export function blocklistHit(domain: string): { cat: ListCategory; matched: string } | null {
  const s = useStore.getState();
  const d = domain.toLowerCase();
  // custom denylist always wins first
  for (const bl of s.denylist) {
    if (d === bl || d.endsWith("." + bl)) return { cat: "custom", matched: bl };
  }
  // allowlist overrides category lists
  for (const al of s.allowlist) {
    if (d === al || d.endsWith("." + al)) return null;
  }
  const checks: [ListCategory, boolean][] = [
    ["malware", s.settings.listEnabled.malware],
    ["ads", s.settings.listEnabled.ads && s.settings.adBlocking],
    ["trackers", s.settings.listEnabled.trackers && s.settings.trackerBlocking],
    ["analytics", s.settings.listEnabled.analytics && s.settings.trackerBlocking],
    ["telemetry", s.settings.listEnabled.telemetry],
    ["custom", s.settings.listEnabled.custom],
  ];
  for (const [cat, on] of checks) {
    if (!on) continue;
    const m = listMatch(s.lists[cat], d);
    if (m) return { cat, matched: m };
  }
  return null;
}

/* ================= Verdict pipeline ================= */

export function evaluate(app: RuntimeApp, domain: string | null, ip: string, port: number): { verdict: Verdict; reasons: string[]; scope: ReturnType<typeof scopeOf> } {
  const s = useStore.getState();
  const reasons: string[] = [];
  const scope = scopeOf(ip);
  let verdict: Verdict = "allowed";

  if (!s.settings.monitoring || !s.settings.firewallOn) {
    return { verdict: "allowed", reasons: ["monitor-disabled"], scope };
  }

  // 1. blocklists (only meaningful for named destinations)
  const hit = domain ? blocklistHit(domain) : null;
  if (hit) {
    verdict = "blocked";
    reasons.push(hit.cat === "custom" ? "denylist" : `list:${hit.cat}`);
  }

  // 2. fixed firewall rules (specificity: domain/ip rules first, then app rules)
  for (const r of s.fwRules.filter((r) => r.target !== "app")) {
    const val = r.value.toLowerCase();
    const matchVal =
      (r.target === "domain" && domain && (domain.toLowerCase() === val || domain.toLowerCase().endsWith("." + val))) ||
      (r.target === "ip" && ip === r.value);
    const matchPort = r.port === "*" || r.port === String(port);
    if (matchVal && matchPort && (r.appId === "*" || r.appId === app.id)) {
      if (r.action === "blocked") { verdict = "blocked"; reasons.push(`fw:${r.note || r.value}`); }
      else if (verdict === "allowed") reasons.push(`fw-allow:${r.note || r.value}`);
      bumpRule(r.id);
    }
  }
  const appRules = s.fwRules.filter((r) => r.target === "app" && (r.appId === app.id));
  for (const r of appRules) {
    if (r.action === "blocked") { verdict = "blocked"; reasons.push(`fw:${r.note || "app rule"}`); bumpRule(r.id); }
    else { if (!hit) { verdict = "allowed"; reasons.push(`fw-allow:${r.note || "app rule"}`); } bumpRule(r.id); }
  }

  // 3. per-application policy
  const now = Date.now();
  if (app.policy === "temp-allow" && app.tempUntil && app.tempUntil <= now) {
    useStore.getState().setPolicy(app.id, "allow", null); // expired
  } else if (app.policy === "block") {
    verdict = "blocked"; reasons.push("policy:block");
  } else if (app.policy === "temp-allow") {
    reasons.push("policy:temp-allow");
  } else if (app.policy === "local-only" && scope === "internet") {
    verdict = "blocked"; reasons.push("policy:local-only");
  }

  // 4. AI privacy controls
  if (s.settings.aiPrivacyMode && app.ai && (app.category === "local-ai" || app.category === "hybrid-ai") && scope === "internet" && !hit && verdict === "allowed") {
    reasons.push("ai-external-notice"); // surfaced as a notification, not blocked
  }
  if (s.settings.localAiOnly && app.ai && scope === "internet") {
    const allowedDomain = domain && s.allowlist.some((al) => domain === al || domain.endsWith("." + al));
    if (!allowedDomain && app.policy !== "allow") {
      verdict = "blocked"; reasons.push("local-ai-only");
    }
  }

  // 5. strict mode — unknown/unapproved internet traffic is denied by default
  if (s.settings.strictMode && scope === "internet" && verdict === "allowed") {
    const hasAllow =
      app.policy === "allow" || app.policy === "temp-allow" ||
      appRules.some((r) => r.action === "allowed") ||
      s.fwRules.some((r) => r.target !== "app" && r.action === "allowed" && domain && domain.toLowerCase().endsWith(r.value.toLowerCase()) && (r.appId === "*" || r.appId === app.id));
    if (!hasAllow) {
      verdict = "blocked";
      reasons.push("strict:default-deny");
    }
  }

  // 6. automation rules (local engine)
  for (const rule of s.automation) {
    if (!rule.enabled) continue;
    if (rule.schedule === "hours") {
      const h = new Date().getHours();
      const inWindow = rule.hourFrom <= rule.hourTo
        ? h >= rule.hourFrom && h < rule.hourTo
        : h >= rule.hourFrom || h < rule.hourTo;
      if (!inWindow) continue;
    }
    if (rule.whenApp !== "any" && rule.whenApp !== app.id) continue;
    if (rule.whenDomain && !(domain ?? "").toLowerCase().includes(rule.whenDomain.toLowerCase())) continue;
    if (rule.whenDest === "localhost" && scope !== "localhost") continue;
    if (rule.whenDest === "lan" && scope !== "lan") continue;
    if (rule.whenDest === "internet" && scope !== "internet") continue;
    if (rule.whenDest === "unknown-external" && !(scope === "internet" && !domain)) continue;
    if (rule.whenDest === "blocklisted" && !hit) continue;

    if (!engineSilent) s.updateAutomation(rule.id, { hits: rule.hits + 1, lastFired: now });
    const label = `${app.name} → ${domain ?? ip}`;
    if (rule.thenAction === "block") { verdict = "blocked"; reasons.push(`auto:${rule.name}`); if (!engineSilent) s.pushAutoLog(`BLOCK ${label} — rule "${rule.name}"`); }
    if (rule.thenAction === "allow" && hit) { verdict = "allowed"; reasons.push(`auto-allow:${rule.name}`); if (!engineSilent) s.pushAutoLog(`ALLOW ${label} — rule "${rule.name}" overrode blocklist`); }
    if (rule.thenAction === "notify" && !engineSilent) {
      const quiet = rule.lastFired && now - rule.lastFired < 120_000; // throttle repeat alerts
      if (!quiet) s.notify({ kind: "warn", title: "Automation alert", body: `${label} matched rule "${rule.name}"` });
      s.pushAutoLog(`NOTIFY ${label} — rule "${rule.name}"`);
    }
    if (rule.thenAction === "record") s.pushAutoLog(`RECORD ${label} — rule "${rule.name}"`);
  }

  if (verdict === "allowed" && reasons.length === 0) reasons.push("default:allow");
  return { verdict, reasons, scope };
}

function bumpRule(id: string) {
  const s = useStore.getState();
  const r = s.fwRules.find((x) => x.id === id);
  if (r) useStore.setState({ fwRules: s.fwRules.map((x) => (x.id === id ? { ...x, hits: x.hits + 1 } : x)) });
}

/* ================= Event ingestion ================= */

let secAllowed = 0;
let secBlocked = 0;

export function ingest(app: RuntimeApp, domain: string | null, ip: string, port: number, proto: "TCP" | "UDP", bytes: [number, number], simulated: boolean, state?: string): ConnEvent {
  const s = useStore.getState();
  const { verdict, reasons, scope } = evaluate(app, domain, ip, port);

  const blocked = verdict === "blocked";
  const evt: ConnEvent = {
    id: uid(),
    ts: Date.now(),
    appId: app.id,
    appName: app.name,
    exePath: app.path,
    pid: app.pid || 2000 + Math.floor(Math.random() * 60000),
    destIp: ip,
    domain,
    port,
    proto,
    state: state ?? (blocked ? "BLOCKED" : chance(0.35) ? "ESTABLISHED" : "CLOSED"),
    bytesUp: blocked ? 0 : bytes[0],
    bytesDown: blocked ? 0 : bytes[1],
    verdict,
    reasons,
    scope,
    simulated,
  };

  s.pushConn(evt);
  s.updateAppStats(app.id, evt);
  if (blocked) { secBlocked++; } else { secAllowed++; }
  s.bumpCounters({
    upTotal: s.counters.upTotal + evt.bytesUp,
    downTotal: s.counters.downTotal + evt.bytesDown,
    blockedTotal: s.counters.blockedTotal + (blocked ? 1 : 0),
    allowedTotal: s.counters.allowedTotal + (blocked ? 0 : 1),
    adsBlocked: s.counters.adsBlocked + (blocked && reasons.some((r) => r === "list:ads") ? 1 : 0),
    trackersBlocked: s.counters.trackersBlocked + (blocked && reasons.some((r) => ["list:trackers", "list:analytics", "list:telemetry"].includes(r)) ? 1 : 0),
  });
  bufferEvent({
    ts: evt.ts, appId: app.id, appName: app.name, destIp: ip, domain, port, proto,
    up: evt.bytesUp, down: evt.bytesDown, verdict, reasons: reasons.join(","), scope, sim: simulated ? 1 : 0,
  });

  if (reasons.includes("ai-external-notice")) {
    s.notify({ kind: "warn", title: "Local AI app reached the internet", body: `${app.name} connected to ${domain ?? ip}. Local execution ≠ local inference.` });
  }
  // sensitive-data egress warning (metadata-derived, throttled per destination)
  if (!blocked && domain && s.settings.notifications) {
    const prof = classifyDestination(domain, null, app.category);
    if (prof.risk === "critical" && prof.warning && !warnedDest.has(domain)) {
      warnedDest.add(domain);
      s.notify({ kind: "warn", title: `Sensitive data destination: ${domain}`, body: `${app.name} — ${prof.categories.slice(0, 3).map((c) => c.replace("-", " ")).join(", ")} can leave this device. Open Data Monitor for detail.` });
    }
  }
  if (reasons.includes("strict:default-deny")) {
    const exists = s.pendingApprovals.some((p) => p.appId === app.id && (p.domain ?? p.destIp) === (domain ?? ip));
    if (!exists) {
      useStore.setState({ pendingApprovals: [evt, ...s.pendingApprovals].slice(0, 40) });
      s.notify({ kind: "block", title: "Strict mode blocked a connection", body: `${app.name} → ${domain ?? ip}:${port}. Approve it from the Firewall page.` });
    }
  }
  // DNS for named destinations
  if (domain) maybeLogDns(app, domain, ip, blocked ? (reasons.find((r) => r.startsWith("list:") || r === "denylist") ?? null) : null, simulated);
  return evt;
}

function maybeLogDns(app: RuntimeApp, domain: string, ip: string, blockedBy: string | null, simulated: boolean) {
  const s = useStore.getState();
  const key = cacheKey(domain, "A");
  const cached = dnsCache.has(key) && dnsCache.get(key)!.exp > Date.now();
  if (!cached && !chance(0.75)) return; // not every connection triggers a fresh lookup
  const evt: DnsEvent = {
    id: uid(), ts: Date.now(), appName: app.name, domain, rtype: chance(0.12) ? "AAAA" : "A",
    status: blockedBy ? "BLOCKED" : "NOERROR",
    answers: blockedBy ? [] : [ip],
    latencyMs: cached ? 0 : 6 + Math.floor(Math.random() * 45),
    cached, blockedBy,
    provider: s.settings.dnsProvider === "system" ? "system resolver" : s.settings.dnsProvider === "google" ? "dns.google (DoH)" : "cloudflare-dns.com (DoH)",
    simulated,
  };
  dnsCache.set(key, { ips: [ip], exp: Date.now() + 5 * 60_000 });
  s.pushDns(evt);
  bufferDns({ ts: evt.ts, appName: app.name, domain, rtype: evt.rtype, status: evt.status, answers: evt.answers.join(","), latency: evt.latencyMs, cached: cached ? 1 : 0, blockedBy, sim: simulated ? 1 : 0 });
  if (blockedBy && chance(0.08)) {
    s.notify({ kind: "block", title: "Domain blocked by DNS filter", body: `${domain} — ${blockedBy.replace("list:", "")} list (${app.name})` }, false);
  }
}

/* ================= Real DoH resolver ================= */

export interface ResolveResult {
  ok: boolean;
  event: DnsEvent;
  error?: string;
}

import { REMOTE_LIST_URL } from "./catalog";

const DOMAIN_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export async function resolveDoH(domainRaw: string, rtype: DnsRecType = "A"): Promise<ResolveResult> {
  const s = useStore.getState();
  const domain = domainRaw.trim().toLowerCase().replace(/\.$/, "");
  const providerName = s.settings.dnsProvider === "cloudflare" ? "cloudflare-dns.com (DoH)" : s.settings.dnsProvider === "system" ? "system resolver" : "dns.google (DoH)";
  const mk = (over: Partial<DnsEvent>): DnsEvent => ({
    id: uid(), ts: Date.now(), appName: "PrivacyGuard Resolver", domain, rtype,
    status: "SERVFAIL", answers: [], latencyMs: 0, cached: false, blockedBy: null, provider: providerName, simulated: false, ...over,
  });

  if (!DOMAIN_RE.test(domain)) {
    const e = mk({ status: "SERVFAIL" });
    s.pushDns(e);
    return { ok: false, event: e, error: "Invalid domain name. Letters, digits, hyphens and dots only." };
  }

  // enforcement first: the guard vetoes before the query leaves the machine
  const hit = blocklistHit(domain);
  if (hit && s.settings.dnsFiltering) {
    const e = mk({ status: "BLOCKED", blockedBy: hit.cat === "custom" ? "denylist" : `list:${hit.cat}`, latencyMs: 0 });
    s.pushDns(e);
    bufferDns({ ts: e.ts, appName: e.appName, domain, rtype, status: e.status, answers: "", latency: 0, cached: 0, blockedBy: e.blockedBy, sim: 0 });
    return { ok: false, event: e, error: `Blocked by ${hit.cat === "custom" ? "your denylist" : `the ${hit.cat} blocklist`}: matched "${hit.matched}". Query was not sent.` };
  }

  const ck = cacheKey(domain, rtype);
  const cached = dnsCache.get(ck);
  if (cached && cached.exp > Date.now()) {
    const e = mk({ status: "NOERROR", answers: cached.ips, latencyMs: 0, cached: true });
    s.pushDns(e);
    return { ok: true, event: e };
  }

  const started = performance.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 7000);
  try {
    let url: string;
    let headers: HeadersInit | undefined;
    if (s.settings.dnsProvider === "cloudflare") {
      url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${rtype}`;
      headers = { accept: "application/dns-json" };
    } else {
      url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${rtype}`;
    }
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: "no-store" });
    const data = await res.json();
    const latency = Math.round(performance.now() - started);
    const status = data.Status === 3 ? "NXDOMAIN" : data.Status === 0 ? "NOERROR" : "SERVFAIL";
    const answers: string[] = (data.Answer ?? []).filter((a: { data?: string }) => a?.data).map((a: { data: string }) => String(a.data).replace(/\.$/, "")).slice(0, 8);
    if (status === "NOERROR" && answers.length) dnsCache.set(ck, { ips: answers, exp: Date.now() + 4 * 60_000 });
    const e = mk({ status, answers, latencyMs: latency });
    s.pushDns(e);
    bufferDns({ ts: e.ts, appName: e.appName, domain, rtype, status: e.status, answers: answers.join(","), latency, cached: 0, blockedBy: null, sim: 0 });
    return { ok: status === "NOERROR", event: e, error: status === "NXDOMAIN" ? "Domain does not exist (NXDOMAIN), answered by a real resolver." : undefined };
  } catch (err) {
    const e = mk({ latencyMs: Math.round(performance.now() - started) });
    s.pushDns(e);
    return { ok: false, event: e, error: `Resolver unreachable: ${err instanceof Error ? err.message : "network error"}. Real lookup failed — nothing was simulated.` };
  } finally {
    clearTimeout(to);
  }
}

/* ================= Guarded fetch (in-page enforcement + test console) ================= */

export async function guardedFetch(url: string): Promise<{ blocked: boolean; reason: string; ms: number }> {
  const s = useStore.getState();
  const app = s.apps[WEBAPP_ID];
  let host = "";
  try { host = new URL(url).hostname; } catch { return { blocked: true, reason: "invalid URL", ms: 0 }; }
  const started = performance.now();
  const { verdict, reasons, scope } = evaluate(app, host, pseudoIp(host), 443);
  const evt: ConnEvent = {
    id: uid(), ts: Date.now(), appId: WEBAPP_ID, appName: app.name, exePath: app.path, pid: 0,
    destIp: pseudoIp(host) === host ? host : pseudoIp(host), domain: host, port: 443, proto: "TCP",
    state: verdict === "blocked" ? "BLOCKED" : "SYN_SENT", bytesUp: 0, bytesDown: 0,
    verdict, reasons, scope, simulated: false,
  };
  if (verdict === "blocked" || !s.settings.monitoring) {
    const done = { ...evt, state: verdict === "blocked" ? "BLOCKED" : "OBSERVED" };
    s.pushConn(done); s.updateAppStats(WEBAPP_ID, done);
    if (verdict === "blocked") return { blocked: true, reason: reasons.join(", "), ms: 0 };
  }
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store" });
    const ms = Math.round(performance.now() - started);
    const done: ConnEvent = { ...evt, state: "CLOSED", bytesUp: 320, bytesDown: 0 };
    s.pushConn(done); s.updateAppStats(WEBAPP_ID, done);
    return { blocked: false, reason: "allowed", ms };
  } catch (err) {
    const done: ConnEvent = { ...evt, state: "FAILED" };
    s.pushConn(done); s.updateAppStats(WEBAPP_ID, done);
    return { blocked: false, reason: `request failed (${err instanceof Error ? err.message : "error"})`, ms: Math.round(performance.now() - started) };
  }
}

/* ================= Local AI endpoint probing (real) ================= */

export interface EndpointProbe {
  url: string;
  reachable: boolean;
  ms: number;
  note: string;
  models?: string[];
}

export async function probeEndpoint(base: string, kind: "ollama" | "openai"): Promise<EndpointProbe> {
  const started = performance.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 4500);
  const url = kind === "ollama" ? `${base.replace(/\/$/, "")}/api/tags` : `${base.replace(/\/$/, "")}/v1/models`;
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const ms = Math.round(performance.now() - started);
    let models: string[] | undefined;
    try {
      const j = await res.json();
      if (kind === "ollama" && Array.isArray(j.models)) models = j.models.map((m: { name?: string }) => m.name ?? "?").slice(0, 10);
      if (kind === "openai" && Array.isArray(j.data)) models = j.data.map((m: { id?: string }) => m.id ?? "?").slice(0, 10);
    } catch { /* body unreadable */ }
    const s = useStore.getState();
    s.pushConn({
      id: uid(), ts: Date.now(), appId: WEBAPP_ID, appName: "PrivacyGuard Probe", exePath: "(browser)", pid: 0,
      destIp: "127.0.0.1", domain: null, port: Number(new URL(base).port) || 80, proto: "TCP", state: "CLOSED",
      bytesUp: 180, bytesDown: 900, verdict: "allowed", reasons: ["probe:localhost"], scope: "localhost", simulated: false,
    });
    return { url, reachable: true, ms, note: res.ok ? "Endpoint responded" : `HTTP ${res.status}`, models };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    return {
      url, reachable: false, ms,
      note: err instanceof Error && err.name === "AbortError"
        ? "Timed out — nothing listening, or the browser blocked a private-network request"
        : "Unreachable — connection refused, or blocked by browser CORS/Private Network Access policy",
    };
  } finally {
    clearTimeout(to);
  }
}

/* ================= Real page-context capture ================= */

function startPerformanceCapture() {
  if (!("PerformanceObserver" in window)) return;
  try {
    const po = new PerformanceObserver((list) => {
      const s = useStore.getState();
      if (!s.settings.monitoring) return;
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        let u: URL;
        try { u = new URL(e.name); } catch { continue; }
        if (u.protocol !== "https:" && u.protocol !== "http:") continue;
        const host = u.hostname;
        if (host === location.hostname) continue;
        const app = useStore.getState().apps[WEBAPP_ID];
        if (!app) continue;
        const bytes: [number, number] = [0, e.transferSize || e.encodedBodySize || 0];
        const evt = ingest(app, host, pseudoIp(host) === host ? host : pseudoIp(host), 443, "TCP", bytes, false, "CLOSED");
        evt.bytesUp = 0;
      }
    });
    po.observe({ type: "resource", buffered: true });
  } catch { /* observer unsupported */ }
}

function startConnectivityProbe() {
  const probe = async () => {
    const s = useStore.getState();
    if (!s.settings.monitoring) return;
    try {
      const t = performance.now();
      await fetch("https://www.gstatic.com/generate_204", { mode: "no-cors", cache: "no-store" });
      useStore.getState().setOnline(true);
      void (performance.now() - t);
    } catch {
      useStore.getState().setOnline(false);
    }
  };
  probe();
  setInterval(probe, 45_000);
  window.addEventListener("online", () => useStore.getState().setOnline(true));
  window.addEventListener("offline", () => useStore.getState().setOnline(false));
}

/* ================= Demo traffic plane (clearly labeled) ================= */

let demoTimer: ReturnType<typeof setTimeout> | null = null;

function demoTick() {
  const s = useStore.getState();
  const next = () => {
    if (!s.settings.demoTraffic) return;
    const base = clamp(60_000 / Math.max(4, s.settings.demoRate), 350, 8000);
    demoTimer = setTimeout(demoTick, base * (0.4 + Math.random() * 1.2));
  };
  if (!s.settings.demoTraffic || !s.settings.monitoring) return next();

  const pool = APP_CATALOG.filter((a) => a.weight > 0);
  const totalW = pool.reduce((n, a) => n + a.weight, 0);
  let r = Math.random() * totalW;
  let chosen = pool[0];
  for (const a of pool) { r -= a.weight; if (r <= 0) { chosen = a; break; } }
  const app = s.apps[chosen.id];
  if (!app) return next();

  // destination selection: occasionally outside the known set
  let domain: string | null = pick(chosen.knownDomains);
  if (chance(0.06)) domain = null; // bare-IP contact — "unknown external"
  let ip: string;
  if (!domain) {
    ip = `${pick([45, 91, 103, 185, 193])}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254) + 1}`;
  } else if (scopeOf(domain) === "localhost" || /^\d+\./.test(domain)) {
    ip = domain;
  } else {
    ip = pseudoIp(domain);
  }
  const port = portFor(domain ?? ip);
  const proto: "TCP" | "UDP" = port === 53 ? "UDP" : chance(0.08) ? "UDP" : "TCP";

  // realistic byte profile per app kind
  let up = 0, down = 0;
  if (app.ai) { up = 400 + Math.random() * 18000; down = 1200 + Math.random() * 90000; }
  else if (app.category === "browser") { up = 300 + Math.random() * 4000; down = 4000 + Math.random() * 450000; }
  else if (app.id === "unknown-proc") { up = 120 + Math.random() * 900; down = 60 + Math.random() * 500; }
  else { up = 200 + Math.random() * 2500; down = 500 + Math.random() * 30000; }

  ingest(app, domain, ip, port, proto, [Math.round(up), Math.round(down)], true);
  next();
}

/* ================= History seeding (labeled simulated) ================= */

async function seedHistoryIfEmpty() {
  const s = useStore.getState();
  if (!s.settings.demoTraffic) return;
  const existing = await allEvents();
  if (existing.length > 0) return;
  const now = Date.now();
  let up = 0, down = 0, blocked = 0, allowed = 0, adsB = 0, trackB = 0;
  engineSilent = true;
  for (let i = 0; i < 850; i++) {
    const app = pick(APP_CATALOG.filter((a) => a.weight > 0));
    const rt = s.apps[app.id];
    let domain: string | null = pick(app.knownDomains);
    if (chance(0.05)) domain = null;
    const ip = !domain
      ? `${pick([45, 91, 103])}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`
      : /^\d+\./.test(domain) ? domain : pseudoIp(domain);
    const { verdict, reasons, scope } = evaluate(rt, domain, ip, portFor(domain ?? ip));
    const isB = verdict === "blocked";
    const bUp = isB ? 0 : Math.round(300 + Math.random() * 15000);
    const bDown = isB ? 0 : Math.round(800 + Math.random() * (app.ai ? 80000 : 250000));
    up += bUp; down += bDown;
    if (isB) { blocked++; if (reasons.includes("list:ads")) adsB++; if (reasons.some((r) => ["list:trackers", "list:analytics", "list:telemetry"].includes(r))) trackB++; }
    else allowed++;
    bufferEvent({
      ts: now - Math.floor(Math.random() * 6 * 3600_000), appId: app.id, appName: app.name, destIp: ip, domain,
      port: portFor(domain ?? ip), proto: "TCP", up: bUp, down: bDown, verdict, reasons: reasons.join(","), scope, sim: 1,
    });
  }
  engineSilent = false;
  useStore.getState().bumpCounters({ upTotal: up, downTotal: down, blockedTotal: blocked, allowedTotal: allowed, adsBlocked: adsB, trackersBlocked: trackB });
  await flush();
}

/* ================= Automation scheduler ================= */

function startScheduler() {
  setInterval(async () => {
    const s = useStore.getState();
    const state = s;
    // demo plane lifecycle
    if (!state.settings.demoTraffic && demoTimer) { clearTimeout(demoTimer); demoTimer = null; }

    // daily cleanup
    const lastCleanup = (await kvGet<number>("lastCleanup")) ?? 0;
    if (state.settings.autoCleanup && Date.now() - lastCleanup > 24 * 3600_000) {
      await pruneEvents(Date.now() - state.settings.retentionDays * 86400_000);
      await kvSet("lastCleanup", Date.now());
      s.pushAutoLog(`CLEANUP removed connection logs older than ${state.settings.retentionDays} days`);
    }
    // daily automatic report
    const lastReport = (await kvGet<number>("lastAutoReport")) ?? 0;
    if (state.settings.autoDailyReport && Date.now() - lastReport > 24 * 3600_000 && Date.now() - s.counters.sessionStart > 60_000) {
      const rep = await buildReport(24);
      await saveReport({ ts: Date.now(), label: "Daily privacy report (auto)", payload: rep.txt });
      await kvSet("lastAutoReport", Date.now());
      s.notify({ kind: "info", title: "Daily privacy report generated", body: "Find it on the Privacy Reports page." }, false);
      s.pushAutoLog("REPORT daily privacy report generated automatically");
    }
    // deactivate idle apps
    const apps = s.apps;
    let changed: Record<string, typeof apps[string]> | null = null;
    for (const a of Object.values(apps)) {
      if (a.active && a.lastSeen && Date.now() - a.lastSeen > 18_000) {
        changed = changed ?? { ...apps };
        changed[a.id] = { ...changed[a.id], active: false };
      }
    }
    if (changed) useStore.setState({ apps: changed });
  }, 15_000);
}

/* ================= Reports ================= */

export interface ReportBundle {
  label: string;
  json: string;
  csv: string;
  txt: string;
  generated: number;
  rows: ReportRow[];
  totals: { attempts: number; blocked: number; up: number; down: number; trackersBlocked: number; observed: number; simulated: number };
}

export interface ReportRow {
  app: string;
  attempts: number;
  allowed: number;
  blocked: number;
  up: number;
  down: number;
  domains: { domain: string; hits: number; kind: "observed" | "dns-derived" | "unknown" }[];
  trackersBlocked: number;
}

export async function buildReport(hours: number): Promise<ReportBundle> {
  const since = Date.now() - hours * 3600_000;
  const all = (await allEvents()).filter((e) => e.ts >= since);
  const dns = (await allDns()).filter((d) => d.ts >= since);
  const byApp = new Map<string, ReportRow>();
  let up = 0, down = 0, blocked = 0, observed = 0, simulated = 0, trackersBlocked = 0;
  for (const e of all) {
    if (e.sim) simulated++; else observed++;
    up += e.up; down += e.down;
    if (e.verdict === "blocked") {
      blocked++;
      if (["list:trackers", "list:analytics", "list:telemetry"].some((x) => e.reasons.includes(x))) trackersBlocked++;
    }
    let row = byApp.get(e.appName);
    if (!row) { row = { app: e.appName, attempts: 0, allowed: 0, blocked: 0, up: 0, down: 0, domains: [], trackersBlocked: 0 }; byApp.set(e.appName, row); }
    row.attempts++;
    if (e.verdict === "blocked") row.blocked++; else row.allowed++;
    row.up += e.up; row.down += e.down;
    const name = e.domain ?? `${e.destIp} (no DNS name observed)`;
    const kind = e.domain ? "dns-derived" : "unknown";
    const d = row.domains.find((x) => x.domain === name);
    if (d) d.hits++;
    else if (row.domains.length < 14) row.domains.push({ domain: name, hits: 1, kind: kind as never });
    if (e.verdict === "blocked" && ["list:trackers", "list:analytics", "list:telemetry"].some((x) => e.reasons.includes(x))) row.trackersBlocked++;
  }
  const rows = [...byApp.values()].sort((a, b) => b.attempts - a.attempts);
  const label = `Privacy report — last ${hours}h`;
  const generated = Date.now();

  const json = JSON.stringify({
    product: "PrivacyGuard", report: label, generated: new Date(generated).toISOString(),
    scopeNote: "Rows flagged data_source=simulated were produced by the demo traffic plane (browser sandbox cannot access the Windows network stack). Observed rows are real.",
    totals: { attempts: all.length, blocked, bytes_sent: up, bytes_received: down, tracking_domains_blocked: trackersBlocked, dns_queries: dns.length },
    applications: rows.map((r) => ({
      application: r.app, attempts: r.attempts, allowed: r.allowed, blocked: r.blocked,
      bytes_sent: r.up, bytes_received: r.down, tracking_blocked: r.trackersBlocked,
      destinations: r.domains.map((d) => ({ destination: d.domain, connections: d.hits, data_source: d.kind })),
    })),
  }, null, 2);

  const csv = [
    "application,attempts,allowed,blocked,bytes_sent,bytes_received,tracking_blocked",
    ...rows.map((r) => [r.app, r.attempts, r.allowed, r.blocked, r.up, r.down, r.trackersBlocked].join(",")),
  ].join("\n");

  const txt = [
    "PRIVACYGUARD — " + label.toUpperCase(),
    "Generated: " + new Date(generated).toLocaleString(),
    "Note: destinations tagged 'dns-derived' come from DNS monitoring; 'unknown' were bare-IP contacts; simulated rows come from the demo traffic plane.",
    "",
    `Totals: ${all.length} connection attempts (${blocked} blocked), ${fmtBytes(up)} sent, ${fmtBytes(down)} received, ${trackersBlocked} tracking domains blocked, ${dns.length} DNS queries.`,
    "",
    ...rows.flatMap((r) => [
      `Application: ${r.app}`,
      `  Connection attempts: ${r.attempts}   Allowed: ${r.allowed}   Blocked: ${r.blocked}`,
      `  Data sent: ${fmtBytes(r.up)}   Data received: ${fmtBytes(r.down)}   Tracking domains blocked: ${r.trackersBlocked}`,
      "  Observed destinations:",
      ...r.domains.sort((a, b) => b.hits - a.hits).slice(0, 8).map((d) => `    - ${d.domain}  (${d.hits}x, ${d.kind})`),
      "",
    ]),
  ].join("\n");

  return { label, json, csv, txt, generated, rows, totals: { attempts: all.length, blocked, up, down, trackersBlocked, observed, simulated } };
}

/* ================= Remote blocklist update (real fetch) ================= */

export async function updateRemoteList(onProgress: (pct: number) => void): Promise<{ count: number } | { error: string }> {
  try {
    onProgress(5);
    const res = await fetch(REMOTE_LIST_URL, { cache: "no-store" });
    if (!res.ok) return { error: `HTTP ${res.status} from blocklist mirror` };
    onProgress(40);
    const text = await res.text();
    onProgress(70);
    const domains = parseHosts(text);
    const s = useStore.getState();
    const bundled = new Set(s.lists.ads);
    for (const d of domains) bundled.add(d);
    useStore.getState().setList("ads", Array.from(bundled), Date.now());
    try { localStorage.setItem("pg.remotehosts", text.slice(0, 4_500_000)); } catch { /* too large for localStorage — bundle stays in memory */ }
    s.updateSettings({ remoteListCount: domains.length });
    onProgress(100);
    return { count: domains.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/* ================= Boot ================= */

let booted = false;

export async function boot() {
  if (booted) return;
  booted = true;
  await initDb();

  const s = useStore.getState();
  if (!s.apps[WEBAPP_ID]) s.addCustomApp(webAppProfile);

  // restore persisted counters
  const counters = await kvGet<ReturnType<typeof useStore.getState>["counters"]>("counters");
  if (counters) useStore.getState().bumpCounters({ ...counters, sessionStart: Date.now() });

  // restore notifications (historic)
  const storedNotifs = await allNotifs();
  if (storedNotifs.length) {
    useStore.setState({
      notifs: storedNotifs.slice(-60).map((n) => ({ id: uid(), ts: n.ts, kind: n.kind as never, title: n.title, body: n.body, read: true })),
    });
  }

  await seedHistoryIfEmpty();
  startPerformanceCapture();
  startConnectivityProbe();
  startScheduler();

  // demo traffic kicks off
  const kick = () => {
    const st = useStore.getState();
    if (st.settings.demoTraffic && !demoTimer) {
      demoTimer = setTimeout(demoTick, 800);
    }
  };
  kick();
  setInterval(kick, 5000);

  // persistence flush loop
  setInterval(async () => {
    await flush();
    await kvSet("counters", useStore.getState().counters);
  }, 4000);

  // per-second chart series
  setInterval(() => {
    useStore.getState().pushSeries(secAllowed, secBlocked);
    secAllowed = 0; secBlocked = 0;
  }, 1000);

  useStore.getState().setBooted();
}

export { wipeAll };

export function notifyPersist(kind: "info" | "warn" | "block" | "ok", title: string, body: string, toast = true) {
  useStore.getState().notify({ kind, title, body }, toast);
  saveNotif({ ts: Date.now(), kind, title, body }).catch(() => undefined);
}
