# PrivacyGuard — Local Network Monitor, Firewall, DNS Ad Blocker & AI Privacy Controller

PrivacyGuard gives users control over which applications can communicate with external
servers and what network activity is allowed — with a special focus on AI tools
(Claude Code, ChatGPT, Gemini, Copilot, Ollama, LM Studio, coding agents, …).

**Everything is local.** No account, no telemetry, no analytics, no advertising, no cloud
backend. Logs, rules, reports and settings live in a local database on the user's machine.

## Start here

| Document | Purpose |
|---|---|
| **[Project handbook](docs/PROJECT_GUIDE.md)** | How the app works; local setup; website, GitHub Pages, Android, and iOS launch; open-source and release checklists |
| **[Privacy policy](PRIVACY.md)** | Exactly what stays local, what is never collected, and which direct external requests can occur |
| **[Security policy](SECURITY.md)** | Private vulnerability reporting and coordinated disclosure |
| **[Contributing](CONTRIBUTING.md)** | Development, tests, data-flow review, and pull-request expectations |
| **[Third-party notices](THIRD_PARTY_NOTICES.md)** | Direct dependency, font, and blocklist attribution guidance |
| **[Apache-2.0 license](LICENSE)** | Open-source use, modification, and distribution terms |

### Quick start

```bash
git clone https://github.com/YOUR-USER/privacyguard.git
cd privacyguard
npm ci
npm run dev
```

Production verification:

```bash
npm audit --audit-level=moderate
npm run build
```

The repository includes GitHub Actions for CI, CodeQL, dependency review, and automatic
GitHub Pages deployment. Replace `YOUR-USER` placeholders before publishing.

---

## 1. What this repository contains

This repository builds the **PrivacyGuard control console** as an **installable Android
app** — a PWA with manifest, maskable icons, offline service worker and install prompt —
packaged as a single file (`dist/index.html` after `npm run build`, with
`manifest.webmanifest`, `sw.js` and icons alongside for hosts that serve the folder):

| Path | Android | iOS |
|---|---|---|
| Installable today (shipped here) | Chrome install prompt / ⋮ → Install app — standalone, offline, app shortcuts | Safari → Share → Add to Home Screen — standalone, offline |
| Signed APK / AAB | `npx cap add android && npx cap sync` → Android Studio → Generate Signed Bundle/APK (`capacitor.config.json` is committed, `webDir: dist`) | `npx cap add ios` → Xcode → Archive (requires macOS) |
| Store distribution | Play Console upload (AAB) or direct APK sideload | App Store / TestFlight only — Apple does not permit raw `.ipa` sideloading on non-jailbroken devices |

**Toolchain honesty:** this repository is produced by a web build environment with no
Java/Android SDK and no macOS/Xcode — binary compilation is physically impossible here,
so the APK/Xcode projects are generated on your machine with the two commands above.
Everything they wrap is complete and tested (see Security Lab).

| Layer | Technology |
|---|---|
| UI | React 19 + Tailwind CSS v4, dark/light themes |
| State | zustand store, single source of truth |
| Local DB | IndexedDB with the same schema the native build stores in SQLite (`events`, `dns`, `notifs`, `reports`, `kv`) |
| Charts/visuals | Custom SVG charts + canvas traffic constellation (no chart-lib telemetry) |
| Fonts | Space Grotesk · JetBrains Mono |

### Honest capability matrix

| Capability | In this web console | In the native Windows build (architecture in §6) |
|---|---|---|
| Real network capture | This page's own requests, via `PerformanceObserver` (real destinations & byte counts) + live test console through the guard | All processes via ETW + GetExtendedTcp/UdpTable + WFP app-id mapping |
| DNS filtering | **Real** — DoH lookups via dns.google / Cloudflare, vetoed by blocklists before leaving the machine | System DNS proxy for full coverage |
| Blocklists | **Real** — bundled curated snapshots + live StevenBlack/hosts fetch & parsing | Same engine |
| Firewall rules / strict mode | Enforced on console-originated requests + the labeled demo traffic plane | Enforced system-wide via WFP callouts + Windows Firewall rules |
| Per-process attribution of AI apps | Labeled demo plane (`SIM` tag on every row) | Real, via WFP/ETW |
| Local AI endpoint probing | **Real** — HTTP probes to Ollama/LM Studio/OpenAI-compatible localhost APIs | Same, without browser CORS/PNA limits |
| Persistence / automation / reports / export | **Real** — local DB, WHEN/THEN engine, CSV/JSON/TXT export | Same |

The console **never fabricates**: rows are tagged `OBS` (observed/real) or `SIM`
(demo plane), bare-IP contacts are marked "unknown", and encrypted DNS performed
inside other apps is reported as *not visible* rather than claimed.

## 1b. Data Monitor, Threats, Blocked & Guides

- **Data Monitor** — groups every outbound flow by destination and shows *what category
  of data that endpoint exists to receive* (prompt text, source code, file contents,
  images, voice, location, ad-ID, auth tokens…), with a risk grade and an explicit
  `basis` label: **declared** (vendor-documented endpoint), **inferred** (from blocklist
  category or app type) or **unknown** (never guessed). Critical AI destinations carry a
  plain-language warning — e.g. Cursor uploading repository context, Gemini Apps Activity
  retaining conversations. One-tap "Block destination" / "Block app".
  PrivacyGuard still never decrypts TLS: categories describe the endpoint's purpose,
  not scraped payload content.
- **Live sensor monitor** (top of Data Monitor) — real `navigator.permissions` polling of
  camera, microphone, location, notifications and clipboard, plus device enumeration.
  "Granted" is highlighted red because that's the *unknowingly accessible* state. A
  **camera-access detection test** opens a real stream, fires a live alert, and the guard
  force-stops it after 3 s. OS-wide "which app opened the camera" requires the packaged
  mobile build (AppOpsManager / iOS indicators) — stated, never faked.
- **Threats & Phishing** — a real local URL scanner (no upload): punycode/homograph,
  IP-literal hosts, credentials-before-host, brand typosquatting via Levenshtein distance,
  high-abuse TLDs, deep subdomain chains, urgency keywords, shorteners, hyphen spam and
  executable/APK download paths → 0–100 score and verdict, plus optional **live DoH
  verification** and one-tap denylisting. Below it, suspicious activity already observed
  on the device (malware-list hits, phishing-shaped hostnames, unidentified processes,
  bare-IP contacts).
- **Blocked** — every refused connection, grouped by destination with the exact reason,
  live-stream view, and **one-tap unblock** that reverses the precise mechanism that
  caused it (denylist entry, firewall rule, app policy, or blocklist match via allowlist).
  Plus panels to lift denylist entries and unblock whole apps.
- **Privacy Guides** — checklist-style, with tap-to-copy values:
  device-wide ad blocking via **Android Private DNS** and **iOS encrypted-DNS profiles**
  (AdGuard / ControlD / Mullvad / Quad9 — blocks ads in *every* app, not just browsers);
  killing the Android advertising ID and iOS App Tracking Transparency; Google/Meta/
  Microsoft/Amazon ad-profile opt-outs; OS diagnostics and location hardening; and
  AI-specific data controls (ChatGPT "Improve the model for everyone", Gemini Apps
  Activity, Cursor Privacy Mode, Copilot snippet sharing).

## 2. Pages

Dashboard · Data Monitor · Threats & Phishing · Blocked Connections · Applications ·
Network Monitor · AI Privacy · DNS Monitor · Ad Blocking · Firewall · Privacy Guides ·
Automation · Privacy Reports · Security Lab · Settings — all wired to the same local
event pipeline: blocklists → firewall rules → app policies → strict mode → automation.

## 3. Run / build

```bash
npm install
npm run dev      # development
npm run build    # produces dist/ (single-file index.html + manifest.webmanifest + sw.js + icons)

# install on devices
# Android: serve dist over HTTPS → open in Chrome → "Install app"
# iOS:     serve dist over HTTPS → open in Safari → Share → Add to Home Screen
# APK/AAB: npx cap add android && npx cap sync && npx cap open android → signed build
# iOS app: npx cap add ios && npx cap sync && npx cap open ios → Xcode archive (macOS)
```

## 4. Feature walkthrough

- **AI Privacy Mode** — classify apps as Cloud / Local / Hybrid AI or AI dev tool
  (manual override persists). Per-app modes: `ALLOWED`, `BLOCKED`, `LOCALHOST ONLY`,
  `ALLOW FOR 30 MINUTES`. "Allow local AI connections only" blocks cloud AI and
  unapproved external AI servers while keeping localhost inference alive.
- **Local AI integration** — probe `http://localhost:11434` (Ollama), `:1234`
  (LM Studio), or any OpenAI-compatible endpoint; reachable endpoints report model names.
- **DNS monitor** — query log (A/AAAA/CNAME/TXT/MX/HTTPS), cache hits, latency,
  provider, blocking list responsible. Live resolver issues real DoH queries and shows
  real answers (or a real block).
- **Ad blocking** — six list categories with sources/licenses, live remote update,
  subdomain-aware matching, allow/deny lists, blocked-domain log with reason.
- **Firewall** — app/domain/IP + port + protocol rules, hit counters, strict
  default-deny mode with an approval queue, and a live enforcement test console.
- **Automation** — `WHEN application = X AND destination = unknown external THEN block`,
  schedules (always / hour windows), plus daily report and log cleanup tasks. All local.
- **Privacy reports** — built only from the local log DB, with per-app destinations
  labeled `dns-derived` / `unknown` / simulated; sensitive-data warning before CSV /
  JSON / TXT export.

## 4b. Security Lab — executable test suite

The **Security Lab** page is an automated verification suite that performs *real*
operations against the running engine and reports pass/fail/**skip-never-faked**, with
evidence strings and timings, exportable as JSON:

- **Enforcement**: app block actually blocks (`policy:block`), denylist precedence,
  allowlist override of category lists, strict-mode default-deny, localhost-only scope
  separation, firewall-rule match + hit counting, automation tripwire firing.
- **DNS & network**: ad-domain veto *with proof no resolver request was issued*, real
  DoH resolution of a clean domain, real NXDOMAIN surfacing for a random invalid name.
- **Threat detection**: phishing heuristics flag a hostile URL as dangerous; a legitimate
  HTTPS domain is *not* false-positived; punycode / IP-literal / embedded-credential
  disguises each caught as critical; AI endpoints classified critical with declared data
  categories; and unknown destinations proven to stay `basis=unknown` (no guessing).
- **Hardening**: injection-style inputs (shell metacharacters, command substitution,
  markup) rejected by validation; live event records verified to be metadata-only
  (no payload/credential fields); IndexedDB write/read canary; and a **zero-telemetry
  audit** that lists every host the app has actually contacted and fails on anything
  undocumented.

Offline environments skip network tests explicitly — a skip is never counted as a pass.
OS-level enforcement tests require the native build and are itemized in §7/§8.

## 5. Security model

- Least privilege everywhere; the permissions page documents which native actions need
  admin rights (WFP callout install, firewall rule writes, DNS proxy registration) and
  which run as a standard user (monitoring, reports, storage).
- All input validated; no shell execution anywhere; nothing executes content received
  from the network; blocklist updates are parsed, not executed.
- Safe recovery: one-click "reset all rules" so a bad strict-mode experiment can never
  lock the user out.

## 6. Native Windows build (implementation architecture)

The matching desktop implementation (C# / .NET 10 / WPF, MVVM) drops this console's
engine onto real OS hooks:

- **Monitoring**: ETW (`Microsoft-Windows-Kernel-Network`) + `GetExtendedTcpTable` /
  `GetExtendedUdpTable` for fast per-process connection attribution; WFP
  (`FWPM_LAYER_ALE_AUTH_CONNECT_V4/6`, `..._RECV_ACCEPT_*`) callout driver for
  pre-connect verdicts; optional Npcap/WinDivert for raw visibility.
- **DNS filtering**: localhost DNS proxy registered via `DnsApi` / adapter settings,
  answering from blocklists, forwarding clean queries to configured DoH upstreams
  (dns.google / Cloudflare / user-selected, DoT supported).
- **Firewall**: per-app rules via `INetFwPolicy2`; verdict-level control through the
  WFP callout (block/allow with filters keyed by app-id, IP, port, protocol).
- **Storage**: the same `events / dns / rules / notifs / reports / kv` schema in SQLite
  (`Microsoft.Data.Sqlite`), WAL mode, retention pruner identical to this console's.

## 7. Testing instructions

0. **Security Lab → Run all tests** executes the automated suite (enforcement, real DoH,
   injection validation, storage round-trip, telemetry audit). All green = verified.
1. Open the console → **Firewall → Live enforcement test** → "Test blocked ad domain":
   watch it vetoed before any request (check devtools Network: nothing leaves).
2. "Test allowed domain": a real round trip returns with latency.
3. **DNS Monitor → Live resolver**: `doubleclick.net` returns BLOCKED (list named);
   `example.com` returns real A records from a real DoH resolver; add
   `example.com` to the denylist → it blocks; remove → resolves again.
4. **Applications**: set Claude Code to BLOCKED → its flows flip to BLOCK with reason
   `policy:block`; AI Privacy external-attempts panel lights up. Set back to ALLOWED →
   flows resume. (Demo plane simulates the OS-level enforcement.)
5. **Automation**: create "WHEN unknown app → internet THEN notify"; confirm toast + log.
6. **Reports**: generate, export CSV/JSON/TXT, verify warning modal appears first.
7. Restart the browser: rules, lists, settings and counters persist (localStorage + IDB).

## 8. Known limitations

- This web build cannot enforce on the OS network stack — demo-plane rows are labeled.
- DNS blocking cannot split same-domain ads from content.
- No HTTPS/TLS payload inspection, ever — metadata only.
- Apps doing their own encrypted DNS are opaque to any passive monitor; reported honestly.
- Browser CORS/Private-Network-Access may hide a reachable localhost AI server.

## 9. Troubleshooting

See Settings → Troubleshooting in-app. Short version: empty monitor → check the
master switches or demo toggle; failed DoH → switch provider; broken app after a
new rule → Safe recovery; heavyweight history → lower retention + auto-cleanup.

## Privacy policy

See [`PRIVACY.md`](PRIVACY.md) for the full policy. PrivacyGuard has no project-operated
account, analytics, advertising, or log-ingestion backend. User-triggered DNS lookups,
blocklist updates, connectivity checks, fonts, and local endpoint probes are documented
explicitly; local network metadata is never uploaded to a PrivacyGuard service.
