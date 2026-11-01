import { useMemo } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, Ban, BrainCircuit, Eye, Fish, Globe, Radar,
  ShieldCheck, Siren, Smartphone,
} from "lucide-react";
import { blocklistHit } from "@/lib/engine";
import { classifyDestination } from "@/lib/threats";
import { Constellation } from "@/components/Constellation";
import { BarList, Card, Donut, LiveBars, PageHeader, StatTile, StatusLine, Toggle } from "@/components/ui";
import type { ConnEvent } from "@/lib/core";
import { fmtAgo, fmtBytes, fmtNum, fmtTime } from "@/lib/core";
import { useStore } from "@/lib/store";

export function Dashboard() {
  const connEvents = useStore((s) => s.connEvents);
  const counters = useStore((s) => s.counters);
  const settings = useStore((s) => s.settings);
  const apps = useStore((s) => s.apps);
  const series = useStore((s) => s.series);
  const blockedSeries = useStore((s) => s.blockedSeries);
  const openConn = useStore((s) => s.openConn);
  const setPage = useStore((s) => s.setPage);
  const listCounts = useStore((s) => s.listCounts);

  const derived = useMemo(() => {
    const now = Date.now();
    const recent = connEvents.filter((e) => now - e.ts < 10_000);
    const blockedRecent = connEvents.filter((e) => e.verdict === "blocked").slice(0, 400);
    const topDomains = new Map<string, number>();
    for (const e of connEvents.slice(0, 500)) {
      const k = e.domain ?? e.destIp;
      topDomains.set(k, (topDomains.get(k) ?? 0) + 1);
    }
    const top = [...topDomains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }));
    const aiActive = Object.values(apps).filter((a) => a.ai && a.active);
    // verdict split over the retained window only — no invented proportions
    const windowEvents = connEvents.slice(0, 700);
    const allowed = windowEvents.filter((e) => e.verdict === "allowed").length;
    const blocked = windowEvents.filter((e) => e.verdict === "blocked").length;
    const aiN = windowEvents.filter((e) => apps[e.appId]?.ai).length;
    return { recentN: recent.length, blockedRecent, top, aiActive, allowed, blocked, aiN, windowN: windowEvents.length };
  }, [connEvents, apps, counters]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={<span>Live privacy posture of this machine. <span className="mono" style={{ color: "var(--acc2)" }}>Observed</span> events are captured directly; <span className="mono warn">Sim</span> events come from the labeled demo plane (Windows APIs are unreachable from a browser).</span>}
        right={
          <>
            <span className="chip chip-ok"><ShieldCheck size={10} /> Local only</span>
            <span className="chip chip-acc"><Radar size={10} /> Guard service running</span>
          </>
        }
      />

      <AdBlockHero />

      {/* stat row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3 stagger">
        <StatTile icon={Radar} label="Active connections" value={String(derived.recentN)} sub="connections seen in the last 10 s" tone="var(--acc)" spark={series.slice(-60)} sparkTone="var(--acc)" />
        <StatTile icon={Ban} label="Blocked connections" value={fmtNum(counters.blockedTotal)} sub={`${fmtNum(counters.adsBlocked)} ad · ${fmtNum(counters.trackersBlocked)} tracker domains`} tone="var(--bad)" spark={blockedSeries.slice(-60)} sparkTone="var(--bad)" />
        <StatTile icon={ArrowUpFromLine} label="Data sent" value={fmtBytes(counters.upTotal)} sub="all monitored applications" />
        <StatTile icon={ArrowDownToLine} label="Data received" value={fmtBytes(counters.downTotal)} sub="allowed connections only" />
      </div>

      <ThreatStrip />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        {/* constellation */}
        <Card className="xl:col-span-2 relative overflow-hidden anim-fade-up" >
          <div className="absolute inset-0" style={{ height: 390 }}><Constellation /></div>
          <div className="absolute top-3.5 left-4 flex items-center gap-2 pointer-events-none">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Traffic constellation</span>
          </div>
          <div className="absolute top-3.5 right-4 flex gap-3 text-[9.5px] mono dim pointer-events-none">
            <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--acc)" }} /> allowed</span>
            <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--acc2)" }} /> simulated</span>
            <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--bad)" }} /> blocked</span>
          </div>
          <div className="relative" style={{ height: 390 }} />
        </Card>

        {/* status column */}
        <div className="flex flex-col gap-3">
          <Card className="p-4 anim-fade-up">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Protection status</span>
            </div>
            <StatusLine on={settings.monitoring} label="Network monitoring" detail={settings.monitoring ? "CAPTURING" : "PAUSED"} />
            <StatusLine on={settings.firewallOn} label="Firewall enforcement" detail={settings.strictMode ? "STRICT" : settings.firewallOn ? "FILTERING" : "OFF"} tone={settings.strictMode ? "warn" : undefined} />
            <StatusLine on={settings.dnsFiltering} label="DNS filtering" detail={settings.dnsFiltering ? (settings.dnsProvider === "google" ? "DoH · GOOGLE" : settings.dnsProvider === "cloudflare" ? "DoH · CLOUDFLARE" : "SYSTEM") : "OFF"} />
            <StatusLine on={settings.adBlocking} label="Ad blocking" detail={`${fmtNum(listCounts.ads)} DOMAINS`} />
            <StatusLine on={settings.trackerBlocking} label="Tracker blocking" detail={`${fmtNum(listCounts.trackers + listCounts.analytics + listCounts.telemetry)} DOMAINS`} />
            <StatusLine on={settings.aiPrivacyMode} label="AI privacy mode" detail={settings.localAiOnly ? "LOCAL ONLY" : "WATCHING"} tone={settings.localAiOnly ? "warn" : undefined} />
          </Card>

          <Card className="p-4 flex-1 anim-fade-up">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">AI apps on the network</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage("ai")}>Manage</button>
            </div>
            {derived.aiActive.length === 0 ? (
              <div className="text-[11.5px] dim py-4 text-center">No AI applications transmitting right now.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {derived.aiActive.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5">
                    <BrainCircuit size={13} style={{ color: a.category === "cloud-ai" ? "var(--acc2)" : "var(--acc)" }} className="flex-none" />
                    <span className="text-[12px] truncate" style={{ color: "var(--tx)" }}>{a.name}</span>
                    <span className={`chip ml-auto ${a.policy === "block" ? "chip-bad" : a.policy === "local-only" ? "chip-warn" : "chip-acc"}`}>{a.policy === "block" ? "blocked" : a.policy === "local-only" ? "local" : "online"}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        <Card className="xl:col-span-2 p-0 overflow-hidden">
          <div className="relative px-4 pt-3 pb-1 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Live event stream</span>
            <span className="text-[10px] mono dim">click a row to inspect</span>
            <div className="sweep-line" />
          </div>
          <div className="p-3 term" style={{ minHeight: 236 }}>
            {connEvents.slice(0, 11).map((e) => <FeedRow key={e.id} e={e} onClick={() => openConn(e)} />)}
            {connEvents.length === 0 && <div className="dim text-[12px] p-4">Waiting for traffic…</div>}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Throughput · 90 s</span>
            <span className="text-[10px] mono"><span className="acc">allow</span> <span className="bad ml-2">block</span></span>
          </div>
          <LiveBars allowed={series} blocked={blockedSeries} h={150} />
          <div className="text-[10.5px] dim mt-2">events per second, stacked</div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Verdict split</span>
          <div className="mt-3">
            <Donut
              parts={[
                { value: Math.max(0, derived.allowed - derived.aiN), color: "var(--acc)", label: "Allowed" },
                { value: derived.blocked, color: "var(--bad)", label: "Blocked" },
                { value: derived.aiN, color: "var(--acc2)", label: "AI-app flows" },
              ]}
              centerValue={fmtNum(derived.windowN)}
              centerLabel="RECENT WINDOW"
            />
          </div>
          </Card>
        </div>

        <Card className="p-4 lg:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Top destinations</span>
            <Globe size={13} className="dim" />
          </div>
          <BarList items={derived.top} format={(n) => `${fmtNum(n)} conn`} />
        </Card>

        <Card className="p-4 lg:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Data movers</span>
            <ArrowDownToLine size={13} className="dim" />
          </div>
          <BarList
            tone="var(--acc2)"
            items={Object.values(apps)
              .filter((a) => a.bytesDown + a.bytesUp > 0)
              .sort((a, b) => b.bytesDown + b.bytesUp - (a.bytesDown + a.bytesUp))
              .slice(0, 7)
              .map((a) => ({ label: a.name, value: a.bytesDown + a.bytesUp }))}
            format={(n) => fmtBytes(n)}
          />
        </Card>
      </div>
    </>
  );
}

/* Risk summary derived from live flows — links into the detail pages. */
function ThreatStrip() {
  const connEvents = useStore((s) => s.connEvents);
  const apps = useStore((s) => s.apps);
  const setPage = useStore((s) => s.setPage);

  const sum = useMemo(() => {
    const dests = new Map<string, { risk: string; ai: boolean; cats: Set<string> }>();
    let suspicious = 0;
    for (const e of connEvents.slice(0, 500)) {
      if (e.scope === "localhost") continue;
      const hit = e.domain ? blocklistHit(e.domain) : null;
      const prof = classifyDestination(e.domain, hit?.cat ?? null, apps[e.appId]?.category);
      const key = e.domain ?? e.destIp;
      if (!dests.has(key)) dests.set(key, { risk: prof.risk, ai: !!prof.aiModel, cats: new Set(prof.categories) });
      if (!e.domain || hit?.cat === "malware" || apps[e.appId]?.category === "unknown") suspicious++;
    }
    const all = [...dests.values()];
    return {
      critical: all.filter((d) => d.risk === "critical").length,
      aiDest: all.filter((d) => d.ai).length,
      sensitive: all.filter((d) => [...d.cats].some((c) => ["prompt-text", "code", "files", "images", "location", "auth", "voice"].includes(c))).length,
      suspicious,
    };
  }, [connEvents, apps]);

  const items = [
    { label: "Critical data destinations", value: sum.critical, tone: "var(--bad)", icon: Siren, page: "data" as const },
    { label: "AI model endpoints in use", value: sum.aiDest, tone: "var(--acc2)", icon: BrainCircuit, page: "data" as const },
    { label: "Sensitive-category flows", value: sum.sensitive, tone: "var(--warn)", icon: Eye, page: "data" as const },
    { label: "Suspicious events", value: sum.suspicious, tone: "var(--bad)", icon: Fish, page: "threats" as const },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
      {items.map((it) => (
        <Card key={it.label} hover className="p-3.5 cursor-pointer" onClick={() => setPage(it.page)}>
          <div className="flex items-center gap-2.5">
            <it.icon size={15} style={{ color: it.tone }} className="flex-none" />
            <div className="min-w-0">
              <div className="mono text-[17px] font-semibold leading-none" style={{ color: it.tone }}>{fmtNum(it.value)}</div>
              <div className="text-[10px] uppercase tracking-wider dim mt-1 truncate">{it.label}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* Master ad/tracker blocking control + device-wide guidance entry point. */
function AdBlockHero() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const listCounts = useStore((s) => s.listCounts);
  const counters = useStore((s) => s.counters);
  const setPage = useStore((s) => s.setPage);
  const notify = useStore((s) => s.notify);
  const on = settings.adBlocking && settings.trackerBlocking && settings.dnsFiltering;

  const toggle = () => {
    const next = !on;
    updateSettings({ adBlocking: next, trackerBlocking: next, dnsFiltering: next });
    notify({
      kind: next ? "ok" : "warn",
      title: next ? "Ad & tracker blocking ON" : "Ad & tracker blocking OFF",
      body: next ? `${fmtNum(listCounts.ads + listCounts.trackers + listCounts.analytics + listCounts.telemetry)} domains are now refused at DNS level.` : "Ads and trackers will no longer be filtered.",
    });
  };

  return (
    <Card className="p-4 mb-3 anim-fade-up relative overflow-hidden" style={{ borderColor: on ? "color-mix(in srgb, var(--acc) 30%, transparent)" : "color-mix(in srgb, var(--bad) 30%, transparent)" }}>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={toggle} className="flex items-center gap-3 flex-1 min-w-[230px] text-left">
          <div className="w-11 h-11 rounded-xl grid place-items-center flex-none"
            style={{ background: on ? "var(--acc-dim)" : "var(--bad-dim)", border: `1px solid color-mix(in srgb, ${on ? "var(--acc)" : "var(--bad)"} 35%, transparent)` }}>
            <Ban size={19} style={{ color: on ? "var(--acc)" : "var(--bad)" }} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--tx)" }}>
              Ad &amp; tracker blocking
              <span className={`chip ${on ? "chip-acc" : "chip-bad"}`}>{on ? "ON" : "OFF"}</span>
            </div>
            <div className="text-[11.5px] mut mt-0.5">
              {on ? `${fmtNum(listCounts.ads + listCounts.trackers + listCounts.analytics + listCounts.telemetry)} domains filtered · ${fmtNum(counters.adsBlocked + counters.trackersBlocked)} blocked so far` : "Tap to re-enable DNS filtering for ads, trackers, analytics and telemetry"}
            </div>
          </div>
        </button>
        <Toggle on={on} onChange={toggle} />
        <button className="btn btn-sm" onClick={() => setPage("guides")}><Smartphone size={12} /> Block ads on the whole phone</button>
        <button className="btn btn-sm" onClick={() => setPage("blocked")}>View blocked</button>
      </div>
    </Card>
  );
}

function FeedRow({ e, onClick }: { e: ConnEvent; onClick: () => void }) {
  const blocked = e.verdict === "blocked";
  return (
    <div className="term-line px-2 py-[3px] rounded-md cursor-pointer hover:bg-[var(--panel)]" onClick={onClick}>
      <span className="dim flex-none">{fmtTime(e.ts)}</span>
      <span className={blocked ? "bad flex-none font-semibold" : "ok flex-none font-semibold"}>{blocked ? "BLOCK" : "ALLOW"}</span>
      <span className="flex-none" style={{ color: "var(--tx)" }}>{e.appName}</span>
      <span className="dim flex-none">→</span>
      <span className="truncate mut">{e.domain ?? e.destIp}<span className="dim">:{e.port}</span></span>
      <span className="ml-auto flex-none dim">{e.simulated ? "sim" : "obs"}</span>
      <span className="flex-none dim w-[64px] text-right">{fmtAgo(e.ts).replace(" ago", "")}</span>
    </div>
  );
}
