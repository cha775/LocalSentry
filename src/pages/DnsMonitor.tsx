import { useMemo, useState } from "react";
import { Globe, ListChecks, SearchX, Timer, Zap } from "lucide-react";
import { Card, EmptyState, PageHeader, Segmented, Th, useSorted } from "@/components/ui";
import type { DnsEvent, DnsRecType } from "@/lib/core";
import { fmtNum, fmtTime } from "@/lib/core";
import { resolveDoH } from "@/lib/engine";
import { useStore } from "@/lib/store";

const RTYPES: DnsRecType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "HTTPS"];

export function DnsMonitor() {
  const dnsEvents = useStore((s) => s.dnsEvents);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const search = useStore((s) => s.search);
  const [filter, setFilter] = useState<"all" | "NOERROR" | "BLOCKED" | "NXDOMAIN">("all");
  const [domain, setDomain] = useState("");
  const [rtype, setRtype] = useState<DnsRecType>("A");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; event: DnsEvent; error?: string } | null>(null);
  const sort = useSorted();

  const stats = useMemo(() => {
    const n = dnsEvents.length;
    const blocked = dnsEvents.filter((d) => d.status === "BLOCKED").length;
    const cached = dnsEvents.filter((d) => d.cached).length;
    const latencies = dnsEvents.filter((d) => !d.cached && d.latencyMs > 0).map((d) => d.latencyMs);
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    return { n, blocked, cached, avg };
  }, [dnsEvents]);

  const rows = useMemo(() => {
    let list = dnsEvents;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((d) => d.domain.includes(q) || d.appName.toLowerCase().includes(q));
    if (filter !== "all") list = list.filter((d) => d.status === filter);
    return sort.apply(list.slice(0, 250), (k, d) => {
      switch (k) {
        case "time": return d.ts;
        case "domain": return d.domain;
        case "latency": return d.latencyMs;
        default: return d.ts;
      }
    });
  }, [dnsEvents, search, filter, sort.key, sort.dir]);

  const runLookup = async () => {
    if (!domain.trim() || busy) return;
    setBusy(true);
    const r = await resolveDoH(domain, rtype);
    setResult(r);
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title="DNS Monitor"
        sub="Every query the guard can see, how it was answered, and whether a blocklist vetoed it. Encrypted DNS performed by other apps behind your back is never claimed to be visible."
        right={<span className="chip chip-info"><Globe size={10} /> {settings.dnsProvider === "cloudflare" ? "Cloudflare DoH" : settings.dnsProvider === "google" ? "Google DoH" : "System resolver"}</span>}
      />

      {/* resolver */}
      <Card className="p-4 mb-3 anim-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} style={{ color: "var(--acc)" }} />
          <span className="text-[12.5px] font-semibold">Live resolver</span>
          <span className="text-[10.5px] dim">— real DNS-over-HTTPS lookups, subject to your blocklists before anything leaves the machine</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input mono flex-1" style={{ minWidth: 240 }} placeholder="example.com — try doubleclick.net to see a block"
            value={domain} onChange={(e) => setDomain(e.target.value.slice(0, 200))}
            onKeyDown={(e) => e.key === "Enter" && runLookup()} />
          <select className="input" style={{ width: 110 }} value={rtype} onChange={(e) => setRtype(e.target.value as DnsRecType)}>
            {RTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-acc" disabled={busy || !domain.trim()} onClick={runLookup}>
            {busy ? "Resolving…" : "Resolve"}
          </button>
        </div>
        {result && (
          <div className="mt-3 rounded-xl px-4 py-3 anim-fade logviewer" style={{ background: "var(--panel)", border: `1px solid ${result.event.status === "BLOCKED" ? "color-mix(in srgb, var(--bad) 30%, transparent)" : "var(--line)"}` }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`chip ${result.event.status === "NOERROR" ? "chip-ok" : result.event.status === "BLOCKED" ? "chip-bad" : "chip-warn"}`}>{result.event.status}</span>
              <span className="mono text-[12px]" style={{ color: "var(--tx)" }}>{result.event.domain}</span>
              <span className="chip">{result.event.rtype}</span>
              <span className="mono text-[10.5px] dim ml-auto">{result.event.latencyMs} ms · {result.event.cached ? "cache hit" : "network"} · {result.event.provider}</span>
            </div>
            {result.event.answers.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5">
                {result.event.answers.map((a, i) => <div key={i} className="mono text-[12px] acc">{a}</div>)}
              </div>
            )}
            {result.error && <div className="mt-2 text-[11.5px] warn">{result.error}</div>}
          </div>
        )}
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 stagger">
        {[
          { icon: Globe, label: "Queries logged", value: fmtNum(stats.n), tone: "var(--tx)" },
          { icon: SearchX, label: "Blocked by filter", value: fmtNum(stats.blocked), tone: "var(--bad)" },
          { icon: ListChecks, label: "Cache hits", value: fmtNum(stats.cached), tone: "var(--acc)" },
          { icon: Timer, label: "Avg latency", value: `${stats.avg} ms`, tone: "var(--info)" },
        ].map((s) => (
          <Card key={s.label} className="p-3.5 flex items-center gap-3">
            <s.icon size={16} style={{ color: s.tone }} className="flex-none" />
            <div>
              <div className="mono text-[16px] font-semibold" style={{ color: s.tone }}>{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider dim">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "NOERROR", label: "Answered" }, { value: "BLOCKED", label: "Blocked" }, { value: "NXDOMAIN", label: "NXDOMAIN" }]} />
        <div className="flex-1" />
        <select className="input" style={{ width: 230, height: 29, fontSize: 11.5 }} value={settings.dnsProvider} onChange={(e) => updateSettings({ dnsProvider: e.target.value as typeof settings.dnsProvider })}>
          <option value="google">Google DNS-over-HTTPS (dns.google)</option>
          <option value="cloudflare">Cloudflare DoH (cloudflare-dns.com)</option>
          <option value="system">System resolver (no DoH from page)</option>
        </select>
      </div>

      <div className="card overflow-hidden anim-fade-up">
        <div className="overflow-auto scroll" style={{ maxHeight: "calc(100vh - 475px)", minHeight: 260 }}>
          <table className="tbl" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <Th k="time" label="Time" sort={sort} />
                <th>Requested by</th>
                <Th k="domain" label="Domain" sort={sort} />
                <th>Type</th>
                <th>Status</th>
                <th>Answer</th>
                <Th k="latency" label="Latency" sort={sort} right />
                <th>Cache</th>
                <th>Blocked by</th>
                <th>Src</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={d.status === "BLOCKED" ? "blocked-row" : undefined}>
                  <td className="mono text-[11px]">{fmtTime(d.ts)}</td>
                  <td style={{ color: "var(--tx)" }}>{d.appName}</td>
                  <td><span className="mono text-[11.5px]" style={{ color: d.status === "BLOCKED" ? "var(--bad)" : "var(--tx)" }}>{d.domain}</span></td>
                  <td><span className="tag">{d.rtype}</span></td>
                  <td><span className={`chip ${d.status === "NOERROR" ? "chip-ok" : d.status === "BLOCKED" ? "chip-bad" : "chip-warn"}`}>{d.status}</span></td>
                  <td><span className="mono text-[10.5px] mut">{d.answers.slice(0, 2).join(", ") || "—"}{d.answers.length > 2 ? ` +${d.answers.length - 2}` : ""}</span></td>
                  <td className="mono text-[11px]" style={{ textAlign: "right" }}>{d.latencyMs} ms</td>
                  <td className="mono text-[10px]">{d.cached ? "HIT" : "MISS"}</td>
                  <td className="text-[10.5px] bad">{d.blockedBy ? d.blockedBy.replace("list:", "") : ""}</td>
                  <td><span className={`mono text-[9.5px] ${d.simulated ? "warn" : "ok"}`}>{d.simulated ? "SIM" : "OBS"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon={Globe} title="No DNS queries yet" hint="Use the resolver above, or wait for application traffic to generate lookups." />}
        </div>
      </div>

      <Card className="p-3.5 mt-3" style={{ background: "var(--panel)" }}>
        <p className="text-[11px] mut leading-relaxed">
          <b style={{ color: "var(--tx)" }}>Honesty note.</b> When an application performs its own DNS-over-HTTPS directly to a resolver,
          those queries are encrypted and <i>not</i> visible to this console unless traffic is configured to use PrivacyGuard’s resolver.
          Nothing here decrypts, reroutes, or claims to see encrypted DNS. Custom resolver IPs are supported on the native build via the
          Windows DNS client; on this web console DoH to the providers above is performed directly.
        </p>
      </Card>
    </>
  );
}
