import { useMemo, useState } from "react";
import { Ban, CheckCircle2, ShieldOff, Trash2, Undo2 } from "lucide-react";
import { Card, EmptyState, PageHeader, Segmented } from "@/components/ui";
import { LIST_LABEL, fmtAgo, fmtBytes, fmtNum, fmtTime, type ListCategory } from "@/lib/core";
import { useStore } from "@/lib/store";

interface Grouped {
  key: string;
  dest: string;
  app: string;
  appId: string;
  reasons: string[];
  hits: number;
  last: number;
  savedBytes: number;
}

export function Blocked() {
  const connEvents = useStore((s) => s.connEvents);
  const dnsEvents = useStore((s) => s.dnsEvents);
  const counters = useStore((s) => s.counters);
  const search = useStore((s) => s.search);
  const allowlist = useStore((s) => s.allowlist);
  const denylist = useStore((s) => s.denylist);
  const fwRules = useStore((s) => s.fwRules);
  const apps = useStore((s) => s.apps);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const removeFwRule = useStore((s) => s.removeFwRule);
  const setPolicy = useStore((s) => s.setPolicy);
  const notify = useStore((s) => s.notify);
  const [view, setView] = useState<"grouped" | "stream">("grouped");

  const blocked = useMemo(() => connEvents.filter((e) => e.verdict === "blocked"), [connEvents]);

  const grouped = useMemo(() => {
    const map = new Map<string, Grouped>();
    for (const e of blocked) {
      const dest = e.domain ?? e.destIp;
      const key = `${e.appId}|${dest}`;
      const cur = map.get(key);
      if (cur) {
        cur.hits++; cur.last = Math.max(cur.last, e.ts);
        for (const r of e.reasons) if (!cur.reasons.includes(r)) cur.reasons.push(r);
      } else {
        map.set(key, { key, dest, app: e.appName, appId: e.appId, reasons: [...e.reasons], hits: 1, last: e.ts, savedBytes: 0 });
      }
    }
    let list = [...map.values()];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((g) => g.dest.toLowerCase().includes(q) || g.app.toLowerCase().includes(q));
    return list.sort((a, b) => b.hits - a.hits);
  }, [blocked, search]);

  /** One-tap unblock: reverses whichever mechanism caused the block. */
  const unblock = (g: Grouped) => {
    const actions: string[] = [];
    if (denylist.some((d) => g.dest === d || g.dest.endsWith("." + d))) {
      const m = denylist.find((d) => g.dest === d || g.dest.endsWith("." + d))!;
      removeFromList("denylist", m);
      actions.push(`removed "${m}" from your denylist`);
    }
    const rule = fwRules.find((r) => r.action === "blocked" && (r.target === "app" ? r.appId === g.appId : g.dest.endsWith(r.value)));
    if (rule) { removeFwRule(rule.id); actions.push("deleted the matching firewall rule"); }
    if (apps[g.appId] && (apps[g.appId].policy === "block" || apps[g.appId].policy === "local-only")) {
      setPolicy(g.appId, "allow");
      actions.push(`set ${g.app} back to full access`);
    }
    if (g.reasons.some((r) => r.startsWith("list:")) && !allowlist.includes(g.dest)) {
      addToList("allowlist", g.dest);
      actions.push(`allowlisted ${g.dest} (overrides blocklists)`);
    }
    notify({
      kind: "ok",
      title: `Unblocked ${g.dest}`,
      body: actions.length ? actions.join(" · ") : "No active rule matched — this flow was blocked by strict mode and will prompt again.",
    });
  };

  const dnsBlocked = dnsEvents.filter((d) => d.status === "BLOCKED").length;

  return (
    <>
      <PageHeader
        title="Blocked Connections"
        sub="Everything PrivacyGuard refused, why it was refused, and one-tap undo. Unblocking reverses the exact mechanism that caused the block — denylist entry, firewall rule, app policy or blocklist match."
        right={<Segmented value={view} onChange={setView} options={[{ value: "grouped", label: "Grouped" }, { value: "stream", label: "Live stream" }]} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 stagger">
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold bad">{fmtNum(counters.blockedTotal)}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Connections blocked</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold warn">{fmtNum(counters.adsBlocked)}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Ad domains stopped</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold acc2">{fmtNum(counters.trackersBlocked)}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Trackers stopped</div></Card>
        <Card className="p-3.5"><div className="mono text-[20px] font-semibold info">{fmtNum(dnsBlocked)}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">DNS queries refused</div></Card>
      </div>

      {view === "grouped" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {grouped.map((g) => (
            <Card key={g.key} hover className="p-3.5 anim-fade-up">
              <div className="flex items-start gap-2.5">
                <Ban size={14} className="bad flex-none mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="mono text-[12px] font-medium truncate" style={{ color: "var(--tx)" }}>{g.dest}</div>
                  <div className="text-[11px] mut mt-0.5">{g.app} · {fmtNum(g.hits)} attempt{g.hits === 1 ? "" : "s"} · {fmtAgo(g.last)}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {g.reasons.slice(0, 3).map((r) => <span key={r} className="tag" style={{ fontSize: 9.5, color: "var(--bad)" }}>{prettyReason(r)}</span>)}
                  </div>
                </div>
                <button className="btn btn-sm btn-acc flex-none" onClick={() => unblock(g)}><Undo2 size={11} /> Unblock</button>
              </div>
            </Card>
          ))}
          {grouped.length === 0 && <Card className="lg:col-span-2"><EmptyState icon={ShieldOff} title="Nothing has been blocked yet" hint="Blocked connections appear here grouped by destination, with a one-tap undo." /></Card>}
        </div>
      ) : (
        <Card className="overflow-hidden anim-fade-up">
          <div className="overflow-auto scroll" style={{ maxHeight: "calc(100vh - 330px)" }}>
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead><tr><th>Time</th><th>Application</th><th>Destination</th><th>Port</th><th>Blocked by</th><th style={{ textAlign: "right" }}>Would-be transfer</th></tr></thead>
              <tbody>
                {blocked.slice(0, 200).map((e) => (
                  <tr key={e.id} className="blocked-row">
                    <td className="mono text-[11px]">{fmtTime(e.ts)}</td>
                    <td style={{ color: "var(--tx)" }}>{e.appName}</td>
                    <td className="mono text-[11.5px] bad">{e.domain ?? e.destIp}</td>
                    <td className="mono text-[11px]">{e.port}</td>
                    <td><div className="flex flex-wrap gap-1">{e.reasons.slice(0, 2).map((r) => <span key={r} className="tag" style={{ fontSize: 9.5 }}>{prettyReason(r)}</span>)}</div></td>
                    <td className="mono text-[11px] dim" style={{ textAlign: "right" }}>{fmtBytes(0)} (never sent)</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {blocked.length === 0 && <EmptyState icon={ShieldOff} title="No blocked connections yet" />}
          </div>
        </Card>
      )}

      {/* active block rules */}
      <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase dim mb-2 mt-6">Active blocks you can lift</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--bad)" }}>Denylisted domains ({denylist.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {denylist.map((d) => (
              <span key={d} className="tag" style={{ color: "var(--bad)" }}>{d}
                <Trash2 size={10} className="cursor-pointer" onClick={() => { removeFromList("denylist", d); notify({ kind: "ok", title: "Unblocked", body: `${d} removed from your denylist.` }); }} />
              </span>
            ))}
            {denylist.length === 0 && <span className="text-[11px] dim">No manual denylist entries.</span>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--warn)" }}>Blocked applications</div>
          <div className="flex flex-col gap-1.5">
            {Object.values(apps).filter((a) => a.policy === "block").map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[11.5px]">
                <Ban size={11} className="bad flex-none" />
                <span style={{ color: "var(--tx)" }}>{a.name}</span>
                <button className="btn btn-sm btn-acc ml-auto" onClick={() => { setPolicy(a.id, "allow"); notify({ kind: "ok", title: "Allowed", body: `${a.name} can use the network again.` }); }}>
                  <CheckCircle2 size={11} /> Allow
                </button>
              </div>
            ))}
            {Object.values(apps).filter((a) => a.policy === "block").length === 0 && <span className="text-[11px] dim">No applications are fully blocked.</span>}
          </div>
        </Card>
      </div>
    </>
  );
}

function prettyReason(r: string): string {
  if (r.startsWith("list:")) return `${LIST_LABEL[r.slice(5) as ListCategory] ?? r.slice(5)} list`;
  if (r === "denylist") return "your denylist";
  if (r.startsWith("policy:")) return `policy · ${r.slice(7)}`;
  if (r.startsWith("strict")) return "strict mode";
  if (r.startsWith("fw:")) return `rule · ${r.slice(3)}`;
  if (r.startsWith("auto:")) return `automation · ${r.slice(5)}`;
  if (r === "local-ai-only") return "local-AI-only";
  return r;
}
