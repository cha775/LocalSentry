import { useEffect, useState } from "react";
import { ConnDrawer } from "@/components/ConnDrawer";
import { Layout } from "@/components/Layout";
import { boot } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { AdBlocking } from "@/pages/AdBlocking";
import { AIPrivacy } from "@/pages/AIPrivacy";
import { Applications } from "@/pages/Applications";
import { Automation } from "@/pages/Automation";
import { Blocked } from "@/pages/Blocked";
import { Dashboard } from "@/pages/Dashboard";
import { DataMonitor } from "@/pages/DataMonitor";
import { Guides } from "@/pages/Guides";
import { Threats } from "@/pages/Threats";
import { DnsMonitor } from "@/pages/DnsMonitor";
import { Firewall } from "@/pages/Firewall";
import { NetworkMonitor } from "@/pages/NetworkMonitor";
import { Reports } from "@/pages/Reports";
import { Security } from "@/pages/Security";
import { Settings } from "@/pages/Settings";

const BOOT_LINES = [
  "privacyguard: opening local database …",
  "privacyguard: restoring rules & policies …",
  "privacyguard: arming blocklists (ads · trackers · telemetry) …",
  "privacyguard: starting connection monitor …",
  "privacyguard: guard service online",
];

export default function App() {
  const booted = useStore((s) => s.booted);
  const page = useStore((s) => s.page);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    boot().catch((e) => console.error("boot failed", e));
    // deep links: ?page=monitor etc. (also used by Android app shortcuts)
    const p = new URLSearchParams(location.search).get("page");
    const valid = ["dashboard", "apps", "monitor", "ai", "dns", "adblock", "firewall", "automation", "reports", "security", "data", "threats", "blocked", "guides", "settings"];
    if (p && valid.includes(p)) useStore.getState().setPage(p as never);
    const t = setTimeout(() => setSplash(false), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {splash && <BootSplash done={booted} />}
      <div style={{ opacity: splash ? 0 : 1, transition: "opacity .5s", height: "100%" }}>
        <Layout>
          {page === "dashboard" && <Dashboard />}
          {page === "apps" && <Applications />}
          {page === "monitor" && <NetworkMonitor />}
          {page === "ai" && <AIPrivacy />}
          {page === "dns" && <DnsMonitor />}
          {page === "adblock" && <AdBlocking />}
          {page === "firewall" && <Firewall />}
          {page === "automation" && <Automation />}
          {page === "reports" && <Reports />}
          {page === "security" && <Security />}
          {page === "data" && <DataMonitor />}
          {page === "threats" && <Threats />}
          {page === "blocked" && <Blocked />}
          {page === "guides" && <Guides />}
          {page === "settings" && <Settings />}
        </Layout>
        <ConnDrawer />
      </div>
    </>
  );
}

function BootSplash({ done }: { done: boolean }) {
  const [lines, setLines] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setLines((l) => Math.min(BOOT_LINES.length, l + 1)), 260);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center" style={{ background: "var(--bg0)" }}>
      <div className="w-[420px] max-w-[92vw]">
        <div className="flex items-center gap-3 mb-5">
          <svg width="34" height="34" viewBox="0 0 32 32">
            <path d="M16 2 28 7v9c0 7.5-5.1 12.4-12 14C9.1 28.4 4 23.5 4 16V7l12-5z" fill="none" stroke="var(--acc)" strokeWidth="1.6" />
            <circle cx="16" cy="14" r="2.6" fill="var(--acc)" />
          </svg>
          <div>
            <div className="h-serif text-[17px]" style={{ color: "var(--tx)" }}>PrivacyGuard</div>
            <div className="mono text-[9px] dim tracking-[0.2em]">LOCAL PRIVACY CONSOLE</div>
          </div>
          <span className={`ml-auto mono text-[10px] ${done ? "acc" : "warn blink"}`}>{done ? "READY" : "STARTING"}</span>
        </div>
        <div className="card p-4 term">
          {BOOT_LINES.slice(0, lines).map((l, i) => (
            <div key={i} className="term-line anim-fade">
              <span className="dim">{">"}</span>
              <span className={i === BOOT_LINES.length - 1 ? "acc" : "mut"}>{l}</span>
            </div>
          ))}
          {lines < BOOT_LINES.length && <span className="acc blink">▋</span>}
        </div>
        <div className="mono text-[9.5px] dim mt-3 text-center tracking-wider">all data stays on this machine</div>
      </div>
    </div>
  );
}
