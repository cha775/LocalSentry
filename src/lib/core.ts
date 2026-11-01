// PrivacyGuard — core types & utilities

export type PageId =
  | "dashboard"
  | "apps"
  | "monitor"
  | "ai"
  | "dns"
  | "adblock"
  | "firewall"
  | "automation"
  | "reports"
  | "security"
  | "data"
  | "threats"
  | "blocked"
  | "guides"
  | "settings";

export type AICategory =
  | "cloud-ai"
  | "local-ai"
  | "hybrid-ai"
  | "ai-devtool"
  | "browser"
  | "system"
  | "other"
  | "unknown";

export const AI_CATEGORY_LABEL: Record<AICategory, string> = {
  "cloud-ai": "Cloud AI",
  "local-ai": "Local AI",
  "hybrid-ai": "Hybrid AI",
  "ai-devtool": "AI Dev Tool",
  browser: "Browser",
  system: "System",
  other: "Application",
  unknown: "Unknown",
};

export type Policy = "allow" | "block" | "local-only" | "outbound-only" | "temp-allow";

export const POLICY_LABEL: Record<Policy, string> = {
  allow: "Full access",
  block: "Blocked",
  "local-only": "Localhost only",
  "outbound-only": "Outbound only",
  "temp-allow": "Temporary allow",
};

export type Scope = "internet" | "lan" | "localhost";
export type Verdict = "allowed" | "blocked";
export type Proto = "TCP" | "UDP";

export interface AppProfile {
  id: string;
  name: string;
  exe: string;
  path: string;
  publisher: string;
  category: AICategory;
  ai: boolean;
  pid: number;
  /** domains this app commonly talks to (destination hints for the demo engine) */
  knownDomains: string[];
  /** how chatty the app is in demo mode, 0..1 */
  weight: number;
}

export interface RuntimeApp extends AppProfile {
  policy: Policy;
  tempUntil: number | null;
  firstSeen: number;
  lastSeen: number | null;
  attempts: number;
  allowed: number;
  blocked: number;
  bytesUp: number;
  bytesDown: number;
  dests: Record<string, number>; // domain/ip -> hits (capped)
  userClassified: boolean;
  active: boolean; // had traffic within the last 15s
}

export interface ConnEvent {
  id: number;
  ts: number;
  appId: string;
  appName: string;
  exePath: string;
  pid: number;
  destIp: string;
  domain: string | null;
  port: number;
  proto: Proto;
  state: string;
  bytesUp: number;
  bytesDown: number;
  verdict: Verdict;
  reasons: string[];
  scope: Scope;
  simulated: boolean;
}

export type DnsRecType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "HTTPS";

export interface DnsEvent {
  id: number;
  ts: number;
  appName: string;
  domain: string;
  rtype: DnsRecType;
  status: "NOERROR" | "NXDOMAIN" | "BLOCKED" | "SERVFAIL";
  answers: string[];
  latencyMs: number;
  cached: boolean;
  blockedBy: string | null;
  provider: string;
  simulated: boolean;
}

export type ListCategory = "ads" | "trackers" | "analytics" | "telemetry" | "malware" | "custom";

export const LIST_LABEL: Record<ListCategory, string> = {
  ads: "Advertising",
  trackers: "Trackers",
  analytics: "Analytics",
  telemetry: "Telemetry",
  malware: "Malware",
  custom: "Custom list",
};

export interface FwRule {
  id: string;
  target: "app" | "domain" | "ip";
  appId: string; // app id or "*"
  value: string; // domain / ip / "*" — for app rules the appId itself
  port: string; // "*" or number/range
  proto: "any" | Proto;
  action: Verdict;
  note: string;
  created: number;
  hits: number;
}

export interface Notif {
  id: number;
  ts: number;
  kind: "info" | "warn" | "block" | "ok";
  title: string;
  body: string;
  read: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  whenApp: string; // app id or "any"
  whenDest: "any" | "unknown-external" | "localhost" | "lan" | "internet" | "blocklisted";
  whenDomain: string; // substring match, "" = any
  thenAction: "block" | "allow" | "notify" | "record";
  schedule: "always" | "hours";
  hourFrom: number;
  hourTo: number;
  hits: number;
  lastFired: number | null;
}

export interface Settings {
  theme: "dark" | "light";
  monitoring: boolean;
  firewallOn: boolean;
  dnsFiltering: boolean;
  adBlocking: boolean;
  trackerBlocking: boolean;
  strictMode: boolean;
  aiPrivacyMode: boolean;
  localAiOnly: boolean;
  demoTraffic: boolean;
  demoRate: number; // events per minute budget-ish
  retentionDays: number;
  dnsProvider: "google" | "cloudflare" | "system";
  notifications: boolean;
  listEnabled: Record<ListCategory, boolean>;
  listUpdated: Record<ListCategory, number | null>;
  remoteListCount: number;
  autoDailyReport: boolean;
  autoCleanup: boolean;
}

export interface ToastMsg {
  id: number;
  kind: "info" | "warn" | "block" | "ok";
  title: string;
  body?: string;
}

/* ---------------- helpers ---------------- */

let _id = 1;
export function uid(): number {
  _id = (Date.now() % 1_000_000) * 100 + ((_id + 1) % 100);
  return _id + Math.floor(Math.random() * 7);
}
export function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function fmtBytes(n: number): string {
  if (!n || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${u[i]}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}
export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour12: false })}`;
}
export function fmtAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** classify an address scope */
export function scopeOf(ip: string): Scope {
  if (ip === "localhost" || ip.startsWith("127.") || ip === "::1") return "localhost";
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.toLowerCase().startsWith("fe80")
  )
    return "lan";
  return "internet";
}

/** subdomain-aware blocklist matching: returns true if domain or any parent is in the set */
export function listMatch(set: Set<string>, domain: string): string | null {
  let d = domain.toLowerCase().replace(/\.$/, "");
  for (;;) {
    if (set.has(d)) return d;
    const i = d.indexOf(".");
    if (i < 0) return null;
    d = d.slice(i + 1);
  }
}

/** deterministic pseudo IPv4 for demo destinations (stable per domain) */
export function pseudoIp(domain: string): string {
  let h = 2166136261;
  for (let i = 0; i < domain.length; i++) {
    h ^= domain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 16) & 0xff;
  const b = (h >>> 8) & 0xff;
  const c = h & 0xff;
  return `${[104, 151, 172, 13, 34, 54][a % 6]}.${64 + (b % 190)}.${c % 255}.${16 + (a % 200)}`;
}

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function chance(p: number) {
  return Math.random() < p;
}
