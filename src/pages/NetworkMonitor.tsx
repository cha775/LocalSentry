import { useMemo, useState } from "react";
import { Pause, Play, Radar } from "lucide-react";
import { EmptyState, PageHeader, Segmented, Th, useSorted } from "@/components/ui";
import type { ConnEvent } from "@/lib/core";
import { fmtBytes, fmtTime } from "@/lib/core";
import { useStore } from "@/lib/store";

type VFilter = "all" | "allowed" | "blocked";
type SFilter = "all" | "observed" | "simulated";
type PFilter = "all" | "TCP" | "UDP" | "DNS";

export function NetworkMonitor() {
  const connEvents = useStore((s) => s.connEvents);
  const search = useStore((s) => s.search);
  const openConn = useStore((s) => s.openConn);
  const monitoring = useStore((s) => s.settings.monitoring);
  const updateSettings = useStore((s) => s.updateSettings);
  const [vf, setVf] = useState<VFilter>("all");
  const [sf, setSf] = useState<SFilter>("all");
  const [pf, setPf] = useState<PFilter>("all");
  const [aiOnly, setAiOnly] = useState(false);
  const sort = useSorted();

  const rows = useMemo(() => {
    let list = connEvents;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.appName.toLowerCase().includes(q) || (e.domain ?? "").toLowerCase().includes(q) || e.destIp.includes(q));
    if (vf !== "all") list = list.filter((e) => e.verdict === vf);
    if (sf === "observed") list = list.filter((e) => !e.simulated);
    if (sf === "simulated") list = list.filter((e) => e.simulated);
    if (pf === "DNS") list = list.filter((e) => e.port === 53);
    else if (pf !== "all") list = list.filter((e) => e.proto === pf);
    if (aiOnly) {
      const apps = useStore.getState().apps;
      list = list.filter((e) => apps[e.appId]?.ai);
    }
    return sort.apply(list.slice(0, 300), (k, e) => {
      switch (k) {
        case "time": return e.ts;
        case "app": return e.appName.toLowerCase();
        case "dest": return (e.domain ?? e.destIp).toLowerCase();
        case "port": return e.port;
        case "up": return e.bytesUp;
        case "down": return e.bytesDown;
        default: return e.ts;
      }
    });
  }, [connEvents, search, vf, sf, pf, aiOnly, sort.key, sort.dir]);

  const blockedN = rows.filter((r) => r.verdict === "blocked").length;

  return (
    <>
      <PageHeader
        title="Network Monitor"
        sub="Real-time connection stream. Each flow shows the process, destination, byte counts, the firewall verdict and the rule that decided it. Bare-IP contacts are honestly marked as unresolved."
        right={
          <button className={`btn ${monitoring ? "" : "btn-acc"}`} onClick={() => updateSettings({ monitoring: !monitoring })}>
            {monitoring ? <><Pause size={13} /> Pause capture</> : <><Play size={13} /> Resume capture</>}
          </button>
        }
      />

      <div className="flex items-center gap-2.5 mb-3 flex-wrap anim-fade-up">
        <Segmented value={vf} onChange={setVf} options={[{ value: "all", label: "All verdicts" }, { value: "allowed", label: "Allowed" }, { value: "blocked", label: "Blocked" }]} />
        <Segmented value={sf} onChange={setSf} options={[{ value: "all", label: "All sources" }, { value: "observed", label: "Observed (real)" }, { value: "simulated", label: "Simulated" }]} />
        <Segmented value={pf} onChange={setPf} options={[{ value: "all", label: "TCP + UDP" }, { value: "TCP", label: "TCP" }, { value: "UDP", label: "UDP" }, { value: "DNS", label: "DNS (53)" }]} />
        <button className={`btn btn-sm ${aiOnly ? "btn-acc" : ""}`} onClick={() => setAiOnly(!aiOnly)}>AI apps only</button>
        <div className="flex-1" />
        <span className="text-[11px] mono dim">{rows.length} rows · {blockedN} blocked</span>
      </div>

      <div className="card overflow-hidden anim-fade-up">
        <div className="overflow-auto scroll" style={{ maxHeight: "calc(100vh - 265px)" }}>
          <table className="tbl" style={{ minWidth: 1150 }}>
            <thead>
              <tr>
                <Th k="time" label="Time" sort={sort} />
                <Th k="app" label="Application" sort={sort} />
                <th>PID</th>
                <Th k="dest" label="Destination" sort={sort} />
                <Th k="port" label="Port" sort={sort} />
                <th>Proto</th>
                <th>Scope</th>
                <th>State</th>
                <Th k="up" label="Sent" sort={sort} right />
                <Th k="down" label="Recv" sort={sort} right />
                <th>Verdict</th>
                <th>Src</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => <Row key={e.id} e={e} onClick={() => openConn(e)} />)}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon={Radar} title="No connections match" hint={monitoring ? "Adjust the filters, or wait for traffic to arrive." : "Capture is paused — resume it to see live flows."} />}
        </div>
      </div>

      <p className="text-[11px] dim mt-3 leading-relaxed">
        Protocol coverage: TCP and UDP over IPv4/IPv6-style flows are shown. QUIC payload inspection, loopback-only service chatter and flows
        fully inside other VPN tunnels may not be visible in any given capture mode — gaps are never filled with invented data.
      </p>
    </>
  );
}

function Row({ e, onClick }: { e: ConnEvent; onClick: () => void }) {
  const blocked = e.verdict === "blocked";
  return (
    <tr onClick={onClick} className={blocked ? "blocked-row" : undefined}>
      <td className="mono text-[11px]">{fmtTime(e.ts)}</td>
      <td>
        <span style={{ color: "var(--tx)" }}>{e.appName}</span>
      </td>
      <td className="mono text-[11px] dim">{e.pid}</td>
      <td>
        <div className="max-w-[300px] truncate">
          {e.domain ? <span className="mono text-[11.5px]" style={{ color: "var(--tx)" }}>{e.domain}</span> : <span className="mono text-[11.5px] dim">{e.destIp}</span>}
          {e.domain && <div className="mono text-[10px] dim">{e.destIp}</div>}
        </div>
      </td>
      <td className="mono text-[11px]">{e.port}</td>
      <td className="mono text-[11px] dim">{e.proto}</td>
      <td>
        <span className={`mono text-[10px] ${e.scope === "localhost" ? "acc" : e.scope === "lan" ? "info" : "acc2"}`}>
          {e.scope === "localhost" ? "LOOPBACK" : e.scope === "lan" ? "LAN" : "WAN"}
        </span>
      </td>
      <td className="mono text-[10.5px] dim">{e.state}</td>
      <td className="mono text-[11px]" style={{ textAlign: "right" }}>{e.bytesUp ? fmtBytes(e.bytesUp) : "—"}</td>
      <td className="mono text-[11px]" style={{ textAlign: "right" }}>{e.bytesDown ? fmtBytes(e.bytesDown) : "—"}</td>
      <td>
        <span className={`chip ${blocked ? "chip-bad" : "chip-ok"}`} title={e.reasons.join(" · ")}>{blocked ? "BLOCKED" : "ALLOWED"}</span>
      </td>
      <td>
        <span className={`mono text-[9.5px] ${e.simulated ? "warn" : "ok"}`}>{e.simulated ? "SIM" : "OBS"}</span>
      </td>
    </tr>
  );
}
