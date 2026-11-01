import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Download, FileText, FileJson, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Card, EmptyState, Modal, PageHeader, Segmented } from "@/components/ui";
import { download, fmtBytes, fmtDateTime, fmtNum } from "@/lib/core";
import { allReports, type StoredReport } from "@/lib/db";
import { buildReport, type ReportBundle } from "@/lib/engine";

type RangeKey = "24h" | "7d" | "all";
const RANGE_HOURS: Record<RangeKey, number> = { "24h": 24, "7d": 168, all: 24 * 3650 };

export function Reports() {
  const [range, setRange] = useState<RangeKey>("24h");
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "csv" | "json" | "txt"; content: string; mime: string; ext: string }>(null);
  const [history, setHistory] = useState<StoredReport[]>([]);
  const [viewing, setViewing] = useState<StoredReport | null>(null);

  const generate = async () => {
    setBusy(true);
    const r = await buildReport(RANGE_HOURS[range]);
    setReport(r);
    setBusy(false);
  };

  useEffect(() => { allReports().then((r) => setHistory(r.reverse().slice(0, 12))).catch(() => undefined); }, [report]);

  return (
    <>
      <PageHeader
        title="Privacy Reports"
        sub="Aggregated strictly from your local database. Observed, DNS-derived, inferred and simulated destinations are labeled separately — nothing is inflated or guessed."
        right={
          <>
            <Segmented value={range} onChange={setRange} options={[{ value: "24h", label: "24 hours" }, { value: "7d", label: "7 days" }, { value: "all", label: "All time" }]} />
            <button className="btn btn-acc" disabled={busy} onClick={generate}>
              {busy ? <><RefreshCw size={13} className="blink" /> Building…</> : <><FileText size={13} /> Generate report</>}
            </button>
          </>
        }
      />

      {!report && history.length === 0 && (
        <Card><EmptyState icon={FileText} title="No report generated yet" hint="Pick a range and hit Generate. Reports are computed from your locally stored connection and DNS logs only." /></Card>
      )}

      {report && (
        <div className="anim-fade-up">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="chip chip-acc">{fmtNum(report.totals.attempts)} attempts</span>
            <span className="chip chip-bad">{fmtNum(report.totals.blocked)} blocked</span>
            <span className="chip chip-info">{fmtNum(report.totals.trackersBlocked)} trackers blocked</span>
            <span className="chip chip-acc2">{fmtNum(report.totals.simulated)} simulated</span>
            <span className="chip chip-ok">{fmtNum(report.totals.observed)} observed</span>
            <span className="chip">{fmtBytes(report.totals.up)} sent · {fmtBytes(report.totals.down)} received</span>
            <div className="flex-1" />
            <button className="btn btn-sm" onClick={() => setConfirm({ kind: "csv", content: report.csv, mime: "text/csv", ext: "csv" })}><FileSpreadsheet size={12} /> CSV</button>
            <button className="btn btn-sm" onClick={() => setConfirm({ kind: "json", content: report.json, mime: "application/json", ext: "json" })}><FileJson size={12} /> JSON</button>
            <button className="btn btn-sm" onClick={() => setConfirm({ kind: "txt", content: report.txt, mime: "text/plain", ext: "txt" })}><Download size={12} /> TXT</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
            {report.rows.map((r) => (
              <Card key={r.app} hover className="p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[13px] font-semibold truncate" style={{ color: "var(--tx)" }}>{r.app}</span>
                  <span className="mono text-[10px] dim">{fmtNum(r.attempts)} attempts</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <MiniStat label="Allowed" value={fmtNum(r.allowed)} tone="var(--ok)" />
                  <MiniStat label="Blocked" value={fmtNum(r.blocked)} tone="var(--bad)" />
                  <MiniStat label="Trackers" value={fmtNum(r.trackersBlocked)} tone="var(--warn)" />
                </div>
                <div className="mono text-[10.5px] mut mb-2.5">↑ {fmtBytes(r.up)} · ↓ {fmtBytes(r.down)}</div>
                <div className="flex flex-col gap-1">
                  {r.domains.sort((a, b) => b.hits - a.hits).slice(0, 5).map((d) => (
                    <div key={d.domain} className="flex items-center gap-2 text-[11px] mono">
                      <span className="truncate mut">{d.domain}</span>
                      <span className={`chip ml-auto flex-none ${d.kind === "unknown" ? "chip-warn" : "chip-info"}`} style={{ height: 16, fontSize: 8.5 }}>{d.kind}</span>
                      <span className="dim flex-none">×{d.hits}</span>
                    </div>
                  ))}
                  {r.domains.length === 0 && <span className="text-[10.5px] dim">no destinations recorded</span>}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-[10.5px] dim mt-3">Generated {fmtDateTime(report.generated)} · range: last {RANGE_HOURS[range] >= 8760 ? "all time" : `${RANGE_HOURS[range]}h`}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase dim mb-2">Saved reports</h3>
          <div className="flex flex-col gap-2">
            {history.map((h, i) => (
              <Card key={i} hover className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setViewing(h)}>
                <Clock size={13} className="dim flex-none" />
                <span className="text-[12.5px]" style={{ color: "var(--tx)" }}>{h.label}</span>
                <span className="mono text-[10.5px] dim ml-auto">{fmtDateTime(h.ts)}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)} width={460}>
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <AlertTriangle size={17} style={{ color: "var(--warn)" }} />
              <h2 className="text-[15px] h-serif" style={{ color: "var(--tx)" }}>Export contains sensitive data</h2>
            </div>
            <p className="text-[12px] mut leading-relaxed mb-4">
              This {confirm.kind.toUpperCase()} file lists domains, applications and connection metadata from your machine.
              Anyone with the file can reconstruct part of your activity. Store it somewhere you control.
              It is written by your browser's download mechanism — <b style={{ color: "var(--tx)" }}>no server ever sees it.</b>
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-acc" onClick={() => { download(`privacyguard-report.${confirm.ext}`, confirm.content, confirm.mime); setConfirm(null); }}>
                <Download size={13} /> Export {confirm.ext.toUpperCase()}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal onClose={() => setViewing(null)} width={680}>
          <div className="p-5">
            <h2 className="text-[15px] h-serif mb-1" style={{ color: "var(--tx)" }}>{viewing.label}</h2>
            <p className="mono text-[10px] dim mb-3">{fmtDateTime(viewing.ts)}</p>
            <pre className="logviewer card p-4 overflow-auto scroll" style={{ maxHeight: 420, whiteSpace: "pre-wrap", color: "var(--mut)", background: "var(--bg0)" }}>{viewing.payload}</pre>
            <div className="flex justify-end mt-3"><button className="btn" onClick={() => setViewing(null)}>Close</button></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <div className="text-[9px] uppercase tracking-wider dim">{label}</div>
      <div className="mono text-[12.5px] font-semibold mt-0.5" style={{ color: tone }}>{value}</div>
    </div>
  );
}
