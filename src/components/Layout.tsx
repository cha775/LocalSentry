import { useEffect, useMemo, useState } from "react";
import {
  Activity, AppWindow, Ban, Bell, BookOpen, BrainCircuit, Download, Eye, FileText, Fish,
  FlaskConical, Flame, Globe, LayoutDashboard, ListFilter, Menu, Moon, Radar, Search,
  Settings as SettingsIcon, Shield, ShieldAlert, Sun, X, Zap, type LucideIcon,
} from "lucide-react";
import type { PageId } from "@/lib/core";
import { fmtAgo } from "@/lib/core";
import { getPlatform, installAvailable, isStandalone, onInstallableChange, promptInstall } from "@/lib/pwa";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { InstallGuide } from "@/components/InstallGuide";

const NAV: { id: PageId; label: string; icon: LucideIcon; section: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { id: "data", label: "Data Monitor", icon: Eye, section: "Overview" },
  { id: "threats", label: "Threats & Phishing", icon: Fish, section: "Overview" },
  { id: "blocked", label: "Blocked", icon: Ban, section: "Overview" },
  { id: "apps", label: "Applications", icon: AppWindow, section: "Control" },
  { id: "monitor", label: "Network Monitor", icon: Radar, section: "Control" },
  { id: "ai", label: "AI Privacy", icon: BrainCircuit, section: "Control" },
  { id: "dns", label: "DNS Monitor", icon: Globe, section: "Control" },
  { id: "adblock", label: "Ad Blocking", icon: ListFilter, section: "Control" },
  { id: "firewall", label: "Firewall", icon: Shield, section: "Control" },
  { id: "guides", label: "Privacy Guides", icon: BookOpen, section: "Analyze" },
  { id: "automation", label: "Automation", icon: Zap, section: "Analyze" },
  { id: "reports", label: "Privacy Reports", icon: FileText, section: "Analyze" },
  { id: "security", label: "Security Lab", icon: FlaskConical, section: "Analyze" },
  { id: "settings", label: "Settings", icon: SettingsIcon, section: "Analyze" },
];

const TABS: { id: PageId | "more"; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "data", label: "Data", icon: Eye },
  { id: "blocked", label: "Blocked", icon: Ban },
  { id: "threats", label: "Threats", icon: Fish },
  { id: "more", label: "More", icon: Menu },
];

const PAGE_TITLES: Record<PageId, { t: string; s: string }> = {
  dashboard: { t: "Dashboard", s: "Live overview of your machine's network privacy posture" },
  apps: { t: "Applications", s: "Every detected application and its network access policy" },
  monitor: { t: "Network Monitor", s: "Real-time connection stream — process, destination, verdict" },
  ai: { t: "AI Privacy", s: "Control how cloud and local AI tools talk to the outside world" },
  dns: { t: "DNS Monitor", s: "Query log, filtering decisions and a real DoH resolver" },
  adblock: { t: "Ad Blocking", s: "DNS-based blocklists for ads, trackers, telemetry and malware" },
  firewall: { t: "Firewall", s: "Application rules, strict mode and connection approvals" },
  automation: { t: "Automation", s: "Local WHEN / THEN rules and scheduled tasks" },
  reports: { t: "Privacy Reports", s: "Aggregated reports from your local logs — exportable" },
  security: { t: "Security Lab", s: "Executable security tests against the running guard" },
  data: { t: "Data Monitor", s: "What data is shared, where it goes, and how risky it is" },
  threats: { t: "Threats & Phishing", s: "Scan links and apps, review suspicious activity" },
  blocked: { t: "Blocked", s: "Everything refused — with one-tap unblock" },
  guides: { t: "Privacy Guides", s: "Block ads device-wide and disable data sharing" },
  settings: { t: "Settings", s: "Preferences, data management, permissions and honest limitations" },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const connEvents = useStore((s) => s.connEvents);
  const apps = useStore((s) => s.apps);
  const notifs = useStore((s) => s.notifs);
  const notifOpen = useStore((s) => s.notifOpen);
  const setNotifOpen = useStore((s) => s.setNotifOpen);
  const markRead = useStore((s) => s.markNotifsRead);
  const online = useStore((s) => s.online);
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem("pg.banner") === "1");
  const [moreOpen, setMoreOpen] = useState(false);
  const [installable, setInstallable] = useState(installAvailable());

  useEffect(() => onInstallableChange(() => setInstallable(installAvailable())), []);

  const setInstallGuideOpen = useStore((s) => s.setInstallGuideOpen);

  const doInstall = async () => {
    // iOS never exposes an install prompt — always show the guided steps there.
    if (getPlatform() === "ios" || !installAvailable()) {
      setInstallGuideOpen(true);
      return;
    }
    const r = await promptInstall();
    if (r === "unavailable") setInstallGuideOpen(true);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("pg-search")?.focus();
      }
      if (e.key >= "1" && e.key <= "9" && (e.metaKey || e.ctrlKey)) {
        const idx = Number(e.key) - 1;
        if (NAV[idx]) setPage(NAV[idx].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setPage]);

  const liveCount = useMemo(() => connEvents.filter((e) => Date.now() - e.ts < 10_000).length, [connEvents]);
  const activeAi = useMemo(() => Object.values(apps).filter((a) => a.ai && a.active).length, [apps]);
  const unread = notifs.filter((n) => !n.read).length;
  const meta = PAGE_TITLES[page];

  return (
    <div className="h-full flex relative" style={{ zIndex: 1 }}>
      {/* ---------- sidebar ---------- */}
      <aside id="pg-sidebar" className="w-[218px] flex-none h-full flex-col" style={{ background: "var(--bg1)", borderRight: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2.5 px-4 h-[60px] flex-none" style={{ borderBottom: "1px solid var(--line)" }}>
          <Logo />
          <div>
            <div className="text-[14px] h-serif leading-none" style={{ color: "var(--tx)" }}>PrivacyGuard</div>
            <div className="text-[9px] mono dim mt-1 tracking-widest">LOCAL · v1.4.0</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll px-3 py-3">
          {["Overview", "Control", "Analyze"].map((section) => (
            <div key={section} className="mb-4">
              <div className="px-3 mb-1.5 text-[9.5px] font-semibold tracking-[0.14em] uppercase dim">{section}</div>
              <div className="flex flex-col gap-0.5">
                {NAV.filter((n) => n.section === section).map((n) => {
                  const Icon = n.icon;
                  const active = page === n.id;
                  return (
                    <div key={n.id} className={cn("nav-item", active && "active")} onClick={() => setPage(n.id)}>
                      <Icon size={15} style={active ? { color: "var(--acc)" } : undefined} />
                      <span className="truncate">{n.label}</span>
                      {n.id === "monitor" && liveCount > 0 && (
                        <span className="ml-auto mono text-[9.5px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--acc-dim)", color: "var(--acc)" }}>{liveCount}</span>
                      )}
                      {n.id === "ai" && activeAi > 0 && (
                        <span className="ml-auto mono text-[9.5px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--acc2-dim)", color: "var(--acc2)" }}>{activeAi}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 flex-none" style={{ borderTop: "1px solid var(--line)" }}>
          {!isStandalone() && (
            <button className={cn("btn w-full justify-center mb-2.5", installable ? "btn-acc" : "")} onClick={doInstall}>
              <Download size={13} /> {installable ? "Install Android app" : "Get the app"}
            </button>
          )}
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("led", settings.monitoring ? "on" : "off")} />
              <span className="text-[11px] font-medium" style={{ color: "var(--tx)" }}>{settings.monitoring ? "Monitoring" : "Paused"}</span>
              <span className={cn("led ml-auto", online ? "on" : "bad")} />
              <span className="text-[10px] mut mono">{online ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <div className="text-[10px] dim leading-relaxed">
              Guard service <span className="mono ok">running</span><br />
              Storage: <span className="mono mut">on-device only</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* demo banner */}
        {!bannerDismissed && settings.demoTraffic && (
          <div className="flex-none flex items-center gap-3 px-4 h-[34px] text-[11.5px]" style={{ background: "var(--warn-dim)", borderBottom: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)" }}>
            <ShieldAlert size={13} style={{ color: "var(--warn)" }} className="flex-none" />
            <span style={{ color: "var(--warn)" }}>
              Browser sandbox mode — per-process flows shown by the labeled demo engine. Real DoH DNS, page-scope interception, blocklists, rules and storage are fully functional.
            </span>
            <button className="ml-auto flex items-center gap-1 text-[11px] warn hover:underline flex-none" onClick={() => { sessionStorage.setItem("pg.banner", "1"); setBannerDismissed(true); setPage("settings"); }}>
              Read limitations <X size={12} />
            </button>
          </div>
        )}

        {/* topbar */}
        <header className="h-[60px] flex-none flex items-center gap-4 px-6" style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--bg1) 80%, transparent)" }}>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: "var(--tx)" }}>{meta.t}</div>
          </div>
          <div className="relative ml-2" id="pg-top-search">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 dim" />
            <input id="pg-search" className="input pl-8 pr-4 w-[200px] lg:w-[240px]" placeholder="Filter current view…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pg-kbd">⌘K</kbd>
          </div>
          <div className="flex-1" />
          <span className={cn("chip", settings.demoTraffic ? "chip-warn" : "chip-ok")} title="Traffic source indicator">
            {settings.demoTraffic ? "Sim + Observed" : "Observed only"}
          </span>
          {settings.strictMode && <span className="chip chip-bad"><Flame size={10} /> Strict</span>}
          {settings.aiPrivacyMode && <span className="chip chip-acc2"><BrainCircuit size={10} /> AI guard</span>}
          <button className="btn btn-ghost" style={{ padding: "0 8px" }} onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })} title="Toggle theme">
            {settings.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="btn btn-ghost relative" style={{ padding: "0 8px" }} onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markRead(); }} title="Notifications">
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full mono text-[8.5px] grid place-items-center" style={{ background: "var(--bad)", color: "#fff" }}>{Math.min(9, unread)}</span>
            )}
          </button>
        </header>

        {/* content */}
        <main className="flex-1 overflow-y-auto scroll relative" style={{ background: "transparent" }}>
          <div className="grid-bg absolute inset-0 pointer-events-none" key={page} style={{ animation: "fadeIn .6s" }} />
          <div key={page} className="relative p-4 pb-24 md:p-6 md:pb-8 anim-fade max-w-[1480px] mx-auto">{children}</div>
        </main>

        {/* ---------- mobile tab bar ---------- */}
        <nav id="pg-tabbar" style={{ background: "var(--bg1)", borderTop: "1px solid var(--line)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id !== "more" && page === t.id;
            return (
              <button key={t.id} className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
                onClick={() => { if (t.id === "more") setMoreOpen(true); else setPage(t.id as PageId); }}>
                <Icon size={17} style={{ color: active ? "var(--acc)" : "var(--dim)" }} />
                <span className="text-[9px] font-medium" style={{ color: active ? "var(--acc)" : "var(--dim)" }}>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ---------- mobile "more" sheet ---------- */}
      {moreOpen && (
        <>
          <div className="overlay" onClick={() => setMoreOpen(false)} />
          <div className="fixed left-0 right-0 bottom-0 z-[70] anim-fade-up" style={{ background: "var(--bg1)", borderTop: "1px solid var(--line2)", borderRadius: "18px 18px 0 0", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="grid grid-cols-3 gap-1.5 p-4">
              {NAV.map((n) => {
                const Icon = n.icon;
                const active = page === n.id;
                return (
                  <button key={n.id} className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
                    style={{ background: active ? "var(--acc-dim)" : "var(--panel)", border: `1px solid ${active ? "color-mix(in srgb, var(--acc) 30%, transparent)" : "var(--line)"}` }}
                    onClick={() => { setPage(n.id); setMoreOpen(false); }}>
                    <Icon size={17} style={{ color: active ? "var(--acc)" : "var(--mut)" }} />
                    <span className="text-[10px] font-medium" style={{ color: active ? "var(--acc)" : "var(--mut)" }}>{n.label}</span>
                  </button>
                );
              })}
            </div>
            {!isStandalone() && (
              <div className="px-4 pb-4">
                <button className="btn btn-acc w-full justify-center" onClick={() => { setMoreOpen(false); doInstall(); }}>
                  <Download size={13} /> Install as Android app
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* notification panel */}
      {notifOpen && (
        <>
          <div className="overlay" style={{ background: "transparent", backdropFilter: "none" }} onClick={() => setNotifOpen(false)} />
          <div className="fixed top-[60px] right-3 w-[380px] max-h-[70vh] card overflow-hidden flex flex-col z-[80] anim-fade-up" style={{ background: "var(--bg1)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="text-[12.5px] font-semibold">Notifications</span>
              <span className="text-[10.5px] dim mono">{notifs.length} total</span>
            </div>
            <div className="overflow-y-auto scroll">
              {notifs.length === 0 && <div className="p-6 text-center text-[12px] dim">All quiet — no events yet.</div>}
              {notifs.slice(0, 40).map((n) => (
                <div key={n.id} className="px-4 py-3 flex gap-2.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" }}>
                  <span className={cn("led mt-1.5", n.kind === "block" ? "bad" : n.kind === "warn" ? "warn" : n.kind === "ok" ? "on" : "")}
                    style={n.kind === "info" ? { background: "var(--info)" } : undefined} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: "var(--tx)" }}>{n.title}</div>
                    <div className="text-[11px] mut mt-0.5 leading-relaxed">{n.body}</div>
                    <div className="text-[9.5px] dim mono mt-1">{fmtAgo(n.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* toasts */}
      <Toasts />
      <InstallGuide />
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.slice(-4).map((t) => (
        <div key={t.id} className="toast">
          {t.kind === "block" ? <ShieldAlert size={15} className="flex-none mt-0.5" style={{ color: "var(--bad)" }} />
            : t.kind === "warn" ? <ShieldAlert size={15} className="flex-none mt-0.5" style={{ color: "var(--warn)" }} />
            : t.kind === "ok" ? <Shield size={15} className="flex-none mt-0.5" style={{ color: "var(--ok)" }} />
            : <Activity size={15} className="flex-none mt-0.5" style={{ color: "var(--info)" }} />}
          <div className="min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: "var(--tx)" }}>{t.title}</div>
            {t.body && <div className="text-[11px] mut mt-0.5">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" className="flex-none">
      <path d="M16 2 28 7v9c0 7.5-5.1 12.4-12 14C9.1 28.4 4 23.5 4 16V7l12-5z" fill="none" stroke="var(--acc)" strokeWidth="1.6" />
      <circle cx="16" cy="14" r="2.6" fill="var(--acc)" />
      <path d="M16 16.6v5M16 11.4V8.5M13.2 12.7 10.5 11M18.8 12.7l2.7-1.7" stroke="var(--acc)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16" cy="22.8" r="1.3" fill="var(--acc2)" /><circle cx="16" cy="7" r="1.3" fill="var(--acc2)" />
      <circle cx="9.3" cy="10.2" r="1.3" fill="var(--acc2)" /><circle cx="22.7" cy="10.2" r="1.3" fill="var(--acc2)" />
    </svg>
  );
}
