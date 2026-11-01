// PrivacyGuard — application catalog and bundled blocklist snapshots.
// Blocklist domains are a curated snapshot derived from public, reputable sources
// (StevenBlack/hosts, EasyList, Easyprivacy, Peter Lowe's list, oisd). The app can
// also fetch a live list update directly from the StevenBlack mirror.

import type { AppProfile, ListCategory } from "./core";

/* ---------------- Application catalog ---------------- */

export const APP_CATALOG: AppProfile[] = [
  {
    id: "claude-code", name: "Claude Code", exe: "claude.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Programs\\claude-code\\claude.exe",
    publisher: "Anthropic", category: "ai-devtool", ai: true, pid: 0, weight: 0.9,
    knownDomains: ["api.anthropic.com", "statsig.anthropic.com", "claude.ai", "sentry.io"],
  },
  {
    id: "claude-desktop", name: "Claude Desktop", exe: "Claude.exe",
    path: "C:\\Users\\you\\AppData\\Local\\AnthropicClaude\\Claude.exe",
    publisher: "Anthropic", category: "cloud-ai", ai: true, pid: 0, weight: 0.7,
    knownDomains: ["claude.ai", "api.anthropic.com", "statsig.anthropic.com"],
  },
  {
    id: "chatgpt", name: "ChatGPT", exe: "ChatGPT.exe",
    path: "C:\\Program Files\\WindowsApps\\OpenAI.ChatGPT-Desktop\\ChatGPT.exe",
    publisher: "OpenAI", category: "cloud-ai", ai: true, pid: 0, weight: 0.8,
    knownDomains: ["chatgpt.com", "ab.chatgpt.com", "auth.openai.com", "featuregates.org", "statsigapi.net"],
  },
  {
    id: "gemini", name: "Gemini", exe: "Gemini.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Google\\Gemini\\Gemini.exe",
    publisher: "Google", category: "cloud-ai", ai: true, pid: 0, weight: 0.5,
    knownDomains: ["gemini.google.com", "play.googleapis.com", "www.google-analytics.com"],
  },
  {
    id: "copilot", name: "Microsoft Copilot", exe: "Copilot.exe",
    path: "C:\\Program Files\\WindowsApps\\Microsoft.Copilot\\Copilot.exe",
    publisher: "Microsoft", category: "cloud-ai", ai: true, pid: 0, weight: 0.5,
    knownDomains: ["copilot.microsoft.com", "login.microsoftonline.com", "vortex.data.microsoft.com"],
  },
  {
    id: "ollama", name: "Ollama", exe: "ollama.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Programs\\Ollama\\ollama.exe",
    publisher: "Ollama Inc.", category: "local-ai", ai: true, pid: 0, weight: 0.65,
    knownDomains: ["127.0.0.1", "registry.ollama.ai", "ollama.com"],
  },
  {
    id: "lmstudio", name: "LM Studio", exe: "LM Studio.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Programs\\LM Studio\\LM Studio.exe",
    publisher: "LM Studio", category: "local-ai", ai: true, pid: 0, weight: 0.5,
    knownDomains: ["127.0.0.1", "lmstudio.ai"],
  },
  {
    id: "openwebui", name: "Open WebUI", exe: "open-webui.exe",
    path: "C:\\Users\\you\\.local\\bin\\open-webui.exe",
    publisher: "Open WebUI", category: "hybrid-ai", ai: true, pid: 0, weight: 0.4,
    knownDomains: ["127.0.0.1", "api.openai.com"],
  },
  {
    id: "cursor", name: "Cursor", exe: "Cursor.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Programs\\cursor\\Cursor.exe",
    publisher: "Anysphere", category: "ai-devtool", ai: true, pid: 0, weight: 0.75,
    knownDomains: ["api2.cursor.sh", "api3.cursor.sh", "downloads.cursor.sh", "us.i.posthog.com", "api.github.com"],
  },
  {
    id: "continue", name: "Continue", exe: "continue.exe",
    path: "C:\\Users\\you\\.continue\\bin\\continue.exe",
    publisher: "Continue Dev", category: "ai-devtool", ai: true, pid: 0, weight: 0.4,
    knownDomains: ["api.continue.dev", "api.anthropic.com", "127.0.0.1"],
  },
  {
    id: "codex", name: "Codex CLI", exe: "codex.exe",
    path: "C:\\Users\\you\\AppData\\Roaming\\npm\\codex.exe",
    publisher: "OpenAI", category: "ai-devtool", ai: true, pid: 0, weight: 0.45,
    knownDomains: ["api.openai.com", "chatgpt.com"],
  },
  {
    id: "stablediffusion", name: "Stable Diffusion WebUI", exe: "webui.bat",
    path: "C:\\stable-diffusion-webui\\webui.bat",
    publisher: "AUTOMATIC1111", category: "local-ai", ai: true, pid: 0, weight: 0.3,
    knownDomains: ["127.0.0.1", "huggingface.co"],
  },
  {
    id: "voicemodel", name: "RVC Voice Studio", exe: "rvc.exe",
    path: "C:\\RVC\\rvc.exe",
    publisher: "Community", category: "local-ai", ai: true, pid: 0, weight: 0.2,
    knownDomains: ["127.0.0.1"],
  },
  {
    id: "edge", name: "Microsoft Edge", exe: "msedge.exe",
    path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    publisher: "Microsoft", category: "browser", ai: false, pid: 0, weight: 0.7,
    knownDomains: [
      "www.bing.com", "ntp.msn.com", "doubleclick.net", "googleadservices.com",
      "www.google-analytics.com", "graph.facebook.com", "scorecardresearch.com",
      "cdn.jsdelivr.net", "www.github.com",
    ],
  },
  {
    id: "chrome", name: "Google Chrome", exe: "chrome.exe",
    path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    publisher: "Google", category: "browser", ai: false, pid: 0, weight: 0.6,
    knownDomains: [
      "www.google.com", "www.gstatic.com", "ads.twitter.com", "analytics.twitter.com",
      "ads.yahoo.com", "hotjar.com", "fonts.gstatic.com",
    ],
  },
  {
    id: "svchost", name: "Windows Service Host", exe: "svchost.exe",
    path: "C:\\Windows\\System32\\svchost.exe",
    publisher: "Microsoft", category: "system", ai: false, pid: 0, weight: 0.35,
    knownDomains: [
      "vortex.data.microsoft.com", "telecommand.telemetry.microsoft.com",
      "settings-win.data.microsoft.com", "time.windows.com", "ctldl.windowsupdate.com",
    ],
  },
  {
    id: "teams", name: "Microsoft Teams", exe: "ms-teams.exe",
    path: "C:\\Program Files\\WindowsApps\\MSTeams\\ms-teams.exe",
    publisher: "Microsoft", category: "other", ai: false, pid: 0, weight: 0.3,
    knownDomains: ["teams.microsoft.com", "browser-intake-datadoghq.com", "app.launchdarkly.com"],
  },
  {
    id: "unknown-proc", name: "Unknown application", exe: "unknown.exe",
    path: "C:\\Users\\you\\AppData\\Local\\Temp\\updSvc.exe",
    publisher: "—", category: "unknown", ai: false, pid: 0, weight: 0.12,
    knownDomains: ["45.155.204.117", "appdata.windows-web.net"],
  },
];

/** Ports commonly used by demo destinations */
export function portFor(domain: string): number {
  if (domain === "127.0.0.1") {
    const p = [11434, 1234, 8080, 7860, 3000];
    return p[Math.floor(Math.random() * p.length)];
  }
  if (domain.includes("dns") || domain.includes("time.")) return 53;
  return Math.random() < 0.12 ? 80 : 443;
}

/* ---------------- Bundled blocklist snapshots ---------------- */
/* Curated, well-known entries from public lists (StevenBlack, EasyList/Easyprivacy,
   Peter Lowe, oisd, phishing-army). Bundled so blocking works offline. */

export const BLOCKLIST_SOURCES: Record<ListCategory, { source: string; url: string; license: string }> = {
  ads: { source: "StevenBlack/hosts + Peter Lowe's Adserver List", url: "https://github.com/StevenBlack/hosts", license: "MIT / CC-BY-SA" },
  trackers: { source: "Easyprivacy snapshot", url: "https://easylist.to/", license: "GPL / CC" },
  analytics: { source: "Easyprivacy + oisd snapshot", url: "https://oisd.nl/", license: "CC0" },
  telemetry: { source: "Windows telemetry community lists", url: "https://github.com/crazy-max/WindowsSpyBlocker", license: "MIT" },
  malware: { source: "StevenBlack + phishing-army snapshot", url: "https://phishing.army/", license: "CC0" },
  custom: { source: "User-defined", url: "", license: "" },
};

const ADS = [
  "doubleclick.net","googleadservices.com","googlesyndication.com","adservice.google.com","ads.yahoo.com",
  "advertising.com","adnxs.com","adsrvr.org","adform.net","outbrain.com","taboola.com","criteo.com",
  "criteo.net","pubmatic.com","rubiconproject.com","openx.net","indexexchange.com","smartadserver.com",
  "adformdsp.net","bidswitch.net","casalemedia.com","contextweb.com","districtm.io","lijit.com",
  "sharethrough.com","sovrn.com","mediavine.com","amazon-adsystem.com","ads.twitter.com","static.ads-twitter.com",
  "ads.linkedin.com","ads.pinterest.com","ads.reddit.com","ads.tiktok.com","ads.snapchat.com","ads-api.tiktok.com",
  "pagead2.googlesyndication.com","tpc.googlesyndication.com","partner.googleadservices.com","ad.doubleclick.net",
  "securepubads.g.doubleclick.net","zedo.com","undertone.com","yieldmo.com","teads.tv","spotxchange.com",
  "advertising.twitter.com","flurry.com","inmobi.com","mopub.com","startapp.io","vungle.com","unityads.unity3d.com",
];
const TRACKERS = [
  "google-analytics.com","www.google-analytics.com","ssl.google-analytics.com","googletagmanager.com",
  "graph.facebook.com","connect.facebook.net","pixel.facebook.com","analytics.twitter.com","bat.bing.com",
  "clarity.ms","scorecardresearch.com","quantserve.com","comscore.com","hotjar.com","mouseflow.com",
  "fullstory.com","segment.com","segment.io","api.segment.io","mixpanel.com","api.mixpanel.com","heap.io",
  "heapanalytics.com","amplitude.com","api.amplitude.com","posthog.com","us.i.posthog.com","app.launchdarkly.com",
  "featuregates.org","statsigapi.net","statsig.anthropic.com","nr-data.net","newrelic.com","browser-intake-datadoghq.com",
  "sentry.io","o0.ingest.sentry.io","bugsnag.com","sessions.bugsnag.com","logrocket.com","pendo.io","crazyegg.com",
  "optimizely.com","cdn.optimizely.com","omtrdc.net","demdex.net","everesttech.net","bluekai.com","exelator.com",
  "tapad.com","liveramp.com","adsymptotic.com","mathtag.com","bizographics.com","licdn.com","snap.licdn.com",
];
const ANALYTICS = [
  "analytics.google.com","region1.google-analytics.com","analytics.yahoo.com","metricool.com","statcounter.com",
  "histats.com","clicky.com","getclicky.com","matomo.org","plausible.io","usefathom.com","simpleanalytics.io",
  "api2.amplitude.com","track.hubspot.com","api.hubspot.com","cdn.heapanalytics.com","a.omappapi.com",
  "metrics.icloud.com","analytics.microsoft.com","analytics.edge.microsoft.com","browser.pipe.aria.microsoft.com",
];
const TELEMETRY = [
  "vortex.data.microsoft.com","telecommand.telemetry.microsoft.com","vortex-win.data.microsoft.com",
  "settings-win.data.microsoft.com","settings.data.microsoft.com","sqm.telemetry.microsoft.com",
  "watson.telemetry.microsoft.com","diagnostics.support.microsoft.com","mobiletelemetry.azure.com",
  "oca.telemetry.microsoft.com","kms.core.windows.net","choice.microsoft.com","df.telemetry.microsoft.com",
  "reports.wes.df.telemetry.microsoft.com","v10.vortex-win.data.microsoft.com","ua.moretoad.com",
];
const MALWARE = [
  "coinhive.com","coin-hive.com","cryptoloot.pro","jsecoin.com","minero.cc","webmine.pro",
  "appdata.windows-web.net","secure.webupd-service.net","update.micro-soft-svc.net","browser-updater.info",
  "dns-redirect-mirror.net","45.155.204.117","malware-checkpoint.io","phish-alert.mirr0r.net",
];

export const BUNDLED_LISTS: Record<ListCategory, string[]> = {
  ads: ADS,
  trackers: TRACKERS,
  analytics: ANALYTICS,
  telemetry: TELEMETRY,
  malware: MALWARE,
  custom: [],
};

/** Remote list that can actually be fetched at runtime (CORS-enabled mirror). */
export const REMOTE_LIST_URL =
  "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";
