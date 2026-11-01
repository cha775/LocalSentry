// PrivacyGuard — sensitive-data classification, AI risk warnings and phishing heuristics.
//
// Honesty model: PrivacyGuard inspects METADATA ONLY. It never decrypts TLS, so it
// cannot read the bytes inside a request. What it CAN do — and what this module does —
// is classify a destination by its documented purpose and tell the user what categories
// of data that endpoint is designed to receive. Every classification carries a
// `basis` field: "declared" (vendor-documented endpoint), "inferred" (from blocklist
// category / port / app type) or "unknown".

export type DataCategory =
  | "prompt-text" | "code" | "files" | "images" | "voice" | "video"
  | "location" | "contacts" | "device-id" | "ad-id" | "browsing"
  | "analytics" | "crash-logs" | "auth" | "clipboard" | "unknown";

export const DATA_LABEL: Record<DataCategory, string> = {
  "prompt-text": "Prompt text", code: "Source code", files: "File contents",
  images: "Images / screenshots", voice: "Voice audio", video: "Video / camera frames",
  location: "Location", contacts: "Contacts", "device-id": "Device identifiers",
  "ad-id": "Advertising ID", browsing: "Browsing activity", analytics: "Usage analytics",
  "crash-logs": "Crash & diagnostics", auth: "Account / auth tokens", clipboard: "Clipboard",
  unknown: "Unknown payload",
};

export type Risk = "critical" | "high" | "medium" | "low";

export const RISK_ORDER: Record<Risk, number> = { critical: 3, high: 2, medium: 1, low: 0 };
export const RISK_COLOR: Record<Risk, string> = {
  critical: "var(--bad)", high: "var(--warn)", medium: "var(--info)", low: "var(--ok)",
};

export interface DestProfile {
  purpose: string;
  categories: DataCategory[];
  risk: Risk;
  basis: "declared" | "inferred" | "unknown";
  aiModel?: string;
  warning?: string;
}

/** Vendor-documented endpoints: what the endpoint exists to receive. */
const DECLARED: { match: RegExp; p: DestProfile }[] = [
  {
    match: /(^|\.)api\.anthropic\.com$/,
    p: {
      purpose: "Claude model inference API", categories: ["prompt-text", "code", "files", "images"],
      risk: "critical", basis: "declared", aiModel: "Claude (cloud)",
      warning: "Everything you type or attach — including source code, documents and screenshots — leaves this device and is processed on Anthropic servers. Review your workspace data-retention settings.",
    },
  },
  {
    match: /(^|\.)claude\.ai$/,
    p: { purpose: "Claude web/desktop app", categories: ["prompt-text", "files", "images", "auth"], risk: "critical", basis: "declared", aiModel: "Claude (cloud)", warning: "Conversation content and uploaded files are sent to the cloud for inference." },
  },
  {
    match: /(^|\.)(chatgpt\.com|openai\.com)$/,
    p: {
      purpose: "OpenAI inference / account API", categories: ["prompt-text", "code", "files", "images", "voice", "auth"],
      risk: "critical", basis: "declared", aiModel: "GPT (cloud)",
      warning: "Prompts, uploads and voice input are transmitted to OpenAI. Unless you disable “Improve the model for everyone”, conversations may be used for training — see Guides.",
    },
  },
  {
    match: /(^|\.)gemini\.google\.com$/,
    p: { purpose: "Google Gemini inference", categories: ["prompt-text", "images", "files", "auth"], risk: "critical", basis: "declared", aiModel: "Gemini (cloud)", warning: "Prompts and attachments go to Google. Gemini Apps Activity stores conversations by default and may be human-reviewed — disable it in Guides." },
  },
  {
    match: /(^|\.)copilot\.microsoft\.com$/,
    p: { purpose: "Microsoft Copilot inference", categories: ["prompt-text", "files", "auth"], risk: "critical", basis: "declared", aiModel: "Copilot (cloud)", warning: "Prompt content is processed by Microsoft cloud services." },
  },
  {
    match: /(^|\.)api[0-9]*\.cursor\.sh$/,
    p: {
      purpose: "Cursor AI code completion backend", categories: ["code", "files", "prompt-text"],
      risk: "critical", basis: "declared", aiModel: "Cursor (cloud models)",
      warning: "Your repository context — file contents, not just the current line — can be uploaded for completions. Enable Privacy Mode in Cursor to stop code retention.",
    },
  },
  {
    match: /(^|\.)api\.continue\.dev$/,
    p: { purpose: "Continue coding-agent backend", categories: ["code", "prompt-text"], risk: "high", basis: "declared", aiModel: "Continue (routed models)", warning: "Code context is forwarded to the configured model provider." },
  },
  {
    match: /(^|\.)(registry\.ollama\.ai|ollama\.com)$/,
    p: { purpose: "Ollama model registry (downloads)", categories: ["device-id"], risk: "low", basis: "declared", warning: "Model downloads only — prompts stay on-device when inference runs on localhost." },
  },
  {
    match: /(^|\.)huggingface\.co$/,
    p: { purpose: "Model/weight distribution", categories: ["device-id"], risk: "low", basis: "declared" },
  },
  {
    match: /(^|\.)lmstudio\.ai$/,
    p: { purpose: "LM Studio catalog & updates", categories: ["device-id"], risk: "low", basis: "declared" },
  },
  {
    match: /(^|\.)(statsig\.anthropic\.com|featuregates\.org|statsigapi\.net)$/,
    p: { purpose: "Feature-flag & experiment telemetry", categories: ["device-id", "analytics"], risk: "medium", basis: "declared" },
  },
  {
    match: /(^|\.)(sentry\.io|bugsnag\.com|logrocket\.com|browser-intake-datadoghq\.com)$/,
    p: { purpose: "Crash / session telemetry", categories: ["crash-logs", "analytics", "device-id"], risk: "high", basis: "declared", warning: "Session-replay style SDKs can capture UI state and error context." },
  },
  {
    match: /(^|\.)(github\.com|githubusercontent\.com|jsdelivr\.net|gstatic\.com|googleapis\.com)$/,
    p: { purpose: "Code hosting / CDN assets", categories: ["device-id"], risk: "low", basis: "declared" },
  },
  {
    match: /(^|\.)(vortex\.data\.microsoft\.com|telemetry\.microsoft\.com|settings-win\.data\.microsoft\.com)$/,
    p: { purpose: "Windows diagnostic telemetry", categories: ["analytics", "device-id", "crash-logs"], risk: "high", basis: "declared", warning: "OS usage and diagnostics data. Reduce it under Guides → Disable data sharing." },
  },
];

/** Inferred from blocklist category when no declared profile matches. */
const INFERRED_BY_LIST: Record<string, DestProfile> = {
  ads: { purpose: "Advertising delivery / bidding", categories: ["ad-id", "browsing", "device-id"], risk: "high", basis: "inferred", warning: "Ad exchanges correlate your advertising ID with browsing activity to build a profile." },
  trackers: { purpose: "Cross-site tracking", categories: ["browsing", "device-id", "ad-id"], risk: "high", basis: "inferred", warning: "Designed to follow you between apps and sites." },
  analytics: { purpose: "Usage analytics", categories: ["analytics", "device-id"], risk: "medium", basis: "inferred" },
  telemetry: { purpose: "Vendor telemetry", categories: ["analytics", "device-id", "crash-logs"], risk: "medium", basis: "inferred" },
  malware: { purpose: "Known-malicious / phishing infrastructure", categories: ["auth", "unknown"], risk: "critical", basis: "inferred", warning: "This destination appears on a malware/phishing list. Credentials entered here may be stolen." },
  custom: { purpose: "User-defined block", categories: ["unknown"], risk: "medium", basis: "inferred" },
};

export function classifyDestination(domain: string | null, listCat: string | null, appCategory?: string): DestProfile {
  if (domain) {
    const d = domain.toLowerCase();
    for (const { match, p } of DECLARED) if (match.test(d)) return p;
  }
  if (listCat && INFERRED_BY_LIST[listCat]) return INFERRED_BY_LIST[listCat];
  if (!domain) {
    return { purpose: "Bare-IP destination with no DNS name", categories: ["unknown"], risk: "high", basis: "unknown", warning: "No hostname was observed for this connection, so its purpose cannot be verified." };
  }
  if (appCategory === "cloud-ai" || appCategory === "ai-devtool") {
    return { purpose: "AI application endpoint (purpose not individually documented)", categories: ["prompt-text", "unknown"], risk: "high", basis: "inferred", warning: "This AI tool contacted a server PrivacyGuard has no published profile for." };
  }
  if (appCategory === "local-ai") {
    return { purpose: "Local AI support service", categories: ["device-id"], risk: "medium", basis: "inferred" };
  }
  return { purpose: "General application traffic", categories: ["unknown"], risk: "low", basis: "unknown" };
}

/* ---------------- Phishing / suspicious URL heuristics (real analysis) ---------------- */

export interface Finding { severity: Risk; title: string; detail: string }
export interface ScanResult {
  input: string;
  host: string | null;
  score: number;        // 0..100, higher = more suspicious
  verdict: "dangerous" | "suspicious" | "caution" | "clean";
  findings: Finding[];
  onBlocklist: string | null;
}

const BRANDS = [
  "paypal", "apple", "icloud", "microsoft", "office365", "outlook", "google", "gmail",
  "amazon", "netflix", "facebook", "instagram", "whatsapp", "binance", "coinbase",
  "metamask", "chase", "hsbc", "dhl", "fedex", "usps", "steam", "roblox", "openai",
  "anthropic", "claude", "linkedin", "revolut", "wise",
];
const RISKY_TLDS = ["zip", "mov", "top", "xyz", "gq", "cf", "tk", "ml", "work", "click", "country", "kim", "loan", "men", "icu", "rest", "cfd", "sbs"];
const URGENCY = ["verify", "secure", "account", "update", "login", "signin", "confirm", "suspend", "unlock", "recover", "wallet", "gift", "bonus", "refund", "invoice", "support"];
const SHORTENERS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "is.gd", "ow.ly", "cutt.ly", "rb.gy", "shorturl.at"];

/** Levenshtein distance, small inputs only. */
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function scanUrl(raw: string, blocklistHit: (d: string) => { cat: string; matched: string } | null): ScanResult {
  const findings: Finding[] = [];
  const input = raw.trim();
  let host: string | null = null;
  let url: URL | null = null;

  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
    host = url.hostname.toLowerCase();
  } catch {
    return { input, host: null, score: 100, verdict: "dangerous", findings: [{ severity: "critical", title: "Unparseable address", detail: "This is not a valid URL — do not open it." }], onBlocklist: null };
  }

  const labels = host.split(".");
  const sld = labels.length >= 2 ? labels[labels.length - 2] : host;
  const tld = labels[labels.length - 1];
  const registrable = labels.slice(-2).join(".");

  // 1. scheme
  if (url.protocol === "http:") findings.push({ severity: "high", title: "Unencrypted HTTP", detail: "Credentials and data sent to this address travel in clear text." });

  // 2. blocklist membership (real check against loaded lists)
  const hit = blocklistHit(host);
  if (hit) findings.push({ severity: hit.cat === "malware" ? "critical" : "high", title: `On the ${hit.cat} blocklist`, detail: `Matched "${hit.matched}" — PrivacyGuard will refuse this domain.` });

  // 3. IP literal host
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) findings.push({ severity: "critical", title: "Raw IP address instead of a domain", detail: "Legitimate services use named domains with certificates; bare IPs are a classic phishing pattern." });

  // 4. punycode / homograph
  if (host.includes("xn--")) findings.push({ severity: "critical", title: "Punycode (homograph) domain", detail: "Uses internationalized characters that can imitate a trusted brand visually." });

  // 5. credentials embedded in URL
  if (url.username || url.password || input.includes("@") && input.indexOf("@") < input.indexOf(host)) {
    findings.push({ severity: "critical", title: "Credentials embedded before the host", detail: "The text before “@” is ignored by browsers — used to disguise the real destination." });
  }

  // 6. brand impersonation / typosquatting
  for (const b of BRANDS) {
    if (sld === b) break; // exact brand as registrable name is fine for this heuristic
    if (host.includes(b) && !registrable.startsWith(b)) {
      findings.push({ severity: "critical", title: `Brand name “${b}” in a non-official position`, detail: `The real owner of this address is “${registrable}”, not ${b}. Subdomains can say anything.` });
      break;
    }
    if (sld.length > 3 && lev(sld, b) === 1) {
      findings.push({ severity: "critical", title: `Typosquat of “${b}”`, detail: `“${sld}” differs from “${b}” by a single character.` });
      break;
    }
  }

  // 7. risky TLD
  if (RISKY_TLDS.includes(tld)) findings.push({ severity: "high", title: `High-abuse TLD “.${tld}”`, detail: "This top-level domain is heavily used for throwaway phishing sites." });

  // 8. excessive subdomains
  if (labels.length >= 5) findings.push({ severity: "medium", title: `${labels.length} subdomain levels`, detail: "Deep subdomain chains are used to push the real domain out of view on mobile." });

  // 9. urgency keywords
  const urgent = URGENCY.filter((k) => host.includes(k) || url!.pathname.toLowerCase().includes(k));
  if (urgent.length >= 2) findings.push({ severity: "high", title: "Urgency / credential keywords", detail: `Contains: ${urgent.slice(0, 4).join(", ")} — typical of credential-harvesting pages.` });
  else if (urgent.length === 1) findings.push({ severity: "medium", title: "Credential-related keyword", detail: `Contains “${urgent[0]}”.` });

  // 10. shortener
  if (SHORTENERS.includes(registrable)) findings.push({ severity: "medium", title: "Link shortener", detail: "The true destination is hidden until you open it." });

  // 11. hyphen spam / long host
  const hy = (host.match(/-/g) ?? []).length;
  if (hy >= 3) findings.push({ severity: "medium", title: `${hy} hyphens in the hostname`, detail: "Common in generated phishing domains." });
  if (host.length > 45) findings.push({ severity: "medium", title: "Unusually long hostname", detail: `${host.length} characters.` });

  // 12. dangerous download extension
  if (/\.(apk|exe|scr|bat|cmd|msi|dmg|jar|ps1|vbs|zip|iso)(\?|$)/i.test(url.pathname)) {
    findings.push({ severity: "high", title: "Direct executable/archive download", detail: `Path ends in a binary type (${url.pathname.split(".").pop()}). Never install apps from links.` });
  }

  const score = Math.min(100, findings.reduce((n, f) => n + ({ critical: 40, high: 22, medium: 10, low: 3 }[f.severity]), 0));
  const verdict: ScanResult["verdict"] = score >= 70 ? "dangerous" : score >= 35 ? "suspicious" : score > 0 ? "caution" : "clean";
  if (!findings.length) findings.push({ severity: "low", title: "No heuristic flags", detail: "Nothing suspicious in the structure of this address. Structure checks cannot prove a site is safe." });

  return { input, host, score, verdict, findings, onBlocklist: hit ? `${hit.cat}:${hit.matched}` : null };
}

/* ---------------- Sensitive permission surface ---------------- */

export const SENSITIVE_PERMISSIONS = [
  { name: "camera" as PermissionName, label: "Camera", icon: "camera", why: "Live video capture — the highest-risk sensor on any device." },
  { name: "microphone" as PermissionName, label: "Microphone", icon: "mic", why: "Ambient audio capture." },
  { name: "geolocation" as PermissionName, label: "Location", icon: "map", why: "Precise physical position." },
  { name: "notifications" as PermissionName, label: "Notifications", icon: "bell", why: "Can be abused for spam and phishing prompts." },
  { name: "clipboard-read" as PermissionName, label: "Clipboard read", icon: "clip", why: "Clipboards often hold passwords, 2FA codes and wallet addresses." },
];
