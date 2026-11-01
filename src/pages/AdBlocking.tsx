import { useMemo, useState } from "react";
import { Ban, Check, DownloadCloud, ListFilter, Plus, RefreshCw, Search, X } from "lucide-react";
import { Card, EmptyState, PageHeader, Toggle } from "@/components/ui";
import type { ListCategory } from "@/lib/core";
import { LIST_LABEL, fmtAgo, fmtNum, fmtTime, listMatch } from "@/lib/core";
import { BLOCKLIST_SOURCES } from "@/lib/catalog";
import { updateRemoteList } from "@/lib/engine";
import { useStore } from "@/lib/store";

const CATS: ListCategory[] = ["ads", "trackers", "analytics", "telemetry", "malware", "custom"];

export function AdBlocking() {
  const settings = useStore((s) => s.settings);
  const listCounts = useStore((s) => s.listCounts);
  const setListEnabled = useStore((s) => s.setListEnabled);
  const counters = useStore((s) => s.counters);
  const dnsEvents = useStore((s) => s.dnsEvents);
  const notify = useStore((s) => s.notify);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  const blockedLog = useMemo(() => dnsEvents.filter((d) => d.status === "BLOCKED").slice(0, 25), [dnsEvents]);
  const lastUpdate = Object.values(settings.listUpdated).filter(Boolean).sort().pop() as number | undefined;

  const runUpdate = async () => {
    setUpdating(true); setProgress(3);
    const r = await updateRemoteList(setProgress);
    setUpdating(false);
    if ("error" in r) notify({ kind: "warn", title: "Blocklist update failed", body: r.error });
    else notify({ kind: "ok", title: "Blocklists updated", body: `Merged ${fmtNum(r.count)} domains from the StevenBlack unified hosts mirror.` });
  };

  return (
    <>
      <PageHeader
        title="Ad Blocking"
        sub="DNS-based blocking. When a domain matches an enabled list, the resolver answers NXDOMAIN — the connection never forms. Ads served from the same domain as the content (e.g. some video ads) cannot be separated by DNS; we never claim otherwise."
        right={
          <button className="btn btn-acc" disabled={updating} onClick={runUpdate}>
            {updating ? <><RefreshCw size={13} className="blink" /> {progress}%</> : <><DownloadCloud size={13} /> Update lists now</>}
          </button>
        }
      />

      {updating && (
        <div className="card p-3 mb-3 anim-fade">
          <div className="flex justify-between text-[11px] mut mb-1.5"><span>Fetching StevenBlack/hosts (real download, ~3 MB)…</span><span className="mono">{progress}%</span></div>
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "var(--panel2)" }}>
            <div className="h-full" style={{ width: `${progress}%`, background: "var(--acc)", transition: "width .3s" }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 stagger">
        <Card className="p-3.5"><div className="mono text-[18px] font-semibold acc">{fmtNum(CATS.reduce((n, c) => n + (settings.listEnabled[c] ? listCounts[c] : 0), 0))}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Domains blocked (enabled lists)</div></Card>
        <Card className="p-3.5"><div className="mono text-[18px] font-semibold bad">{fmtNum(counters.adsBlocked + counters.trackersBlocked)}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Connections vetoed (lifetime)</div></Card>
        <Card className="p-3.5"><div className="mono text-[18px] font-semibold" style={{ color: "var(--tx)" }}>{lastUpdate ? fmtAgo(lastUpdate) : "bundled"}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Last update</div></Card>
        <Card className="p-3.5"><div className="mono text-[18px] font-semibold info">{settings.remoteListCount > 0 ? fmtNum(settings.remoteListCount) : "—"}</div><div className="text-[10px] uppercase tracking-wider dim mt-0.5">Remote snapshot domains</div></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5 stagger">
        {CATS.map((c) => {
          const src = BLOCKLIST_SOURCES[c];
          const enabled = settings.listEnabled[c];
          return (
            <Card key={c} hover className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{LIST_LABEL[c]}</span>
                <Toggle on={enabled} onChange={(b) => setListEnabled(c, b)} />
              </div>
              <div className="mono text-[20px] font-semibold mb-1" style={{ color: enabled ? "var(--acc)" : "var(--dim)" }}>{fmtNum(listCounts[c])}</div>
              <div className="text-[10.5px] dim">domains on this list</div>
              <hr className="hr my-3" />
              <div className="text-[10.5px] mut leading-relaxed">
                Source: {src.url ? <a className="acc hover:underline" href={src.url} target="_blank" rel="noreferrer">{src.source}</a> : src.source}
                {src.license ? ` · ${src.license}` : ""}<br />
                Updated: <span className="mono">{settings.listUpdated[c] ? fmtAgo(settings.listUpdated[c]!) : "bundled snapshot"}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <BlocklistBrowser />
        <div className="flex flex-col gap-3">
          <UserLists />
          <Card className="overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Blocked domain log</span>
              <Ban size={13} className="dim" />
            </div>
            <div className="overflow-y-auto scroll" style={{ maxHeight: 300 }}>
              {blockedLog.length === 0 && <EmptyState icon={ListFilter} title="Nothing blocked yet" hint="Blocked DNS requests will appear here with the responsible list." />}
              {blockedLog.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 45%, transparent)" }}>
                  <Ban size={12} className="bad flex-none" />
                  <div className="min-w-0 flex-1">
                    <span className="mono text-[11.5px]" style={{ color: "var(--tx)" }}>{d.domain}</span>
                    <div className="text-[10px] dim">{d.appName} · {d.blockedBy?.replace("list:", LIST_LABEL[d.blockedBy.slice(5) as ListCategory] ?? d.blockedBy)}</div>
                  </div>
                  <span className="mono text-[10px] dim flex-none">{fmtTime(d.ts)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function BlocklistBrowser() {
  const lists = useStore((s) => s.lists);
  const listCounts = useStore((s) => s.listCounts);
  const [cat, setCat] = useState<ListCategory>("ads");
  const [q, setQ] = useState("");

  const found = useMemo(() => {
    if (!q.trim()) return null;
    const hits: { cat: ListCategory; matched: string }[] = [];
    for (const c of CATS) {
      const m = listMatch(lists[c], q.trim().toLowerCase());
      if (m) hits.push({ cat: c, matched: m });
    }
    return hits;
  }, [q, lists]);

  const sample = useMemo(() => Array.from(lists[cat]).slice(0, 80), [lists, cat]);

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Blocklist browser</span>
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 dim" />
          <input className="input pl-8 mono" style={{ height: 28 }} placeholder="Is a domain blocked? e.g. doubleclick.net" value={q} onChange={(e) => setQ(e.target.value.slice(0, 120))} />
        </div>
        <select className="input" style={{ width: 150, height: 28, fontSize: 11.5 }} value={cat} onChange={(e) => setCat(e.target.value as ListCategory)}>
          {CATS.map((c) => <option key={c} value={c}>{LIST_LABEL[c]} ({fmtNum(listCounts[c])})</option>)}
        </select>
      </div>
      {q.trim() && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--line)", background: "var(--panel)" }}>
          {found === null ? null : found.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Ban size={13} className="bad" />
              <span className="text-[12px]" style={{ color: "var(--tx)" }}><b className="mono">{q}</b> is blocked by:</span>
              {found.map((f) => <span key={f.cat} className="chip chip-bad">{LIST_LABEL[f.cat]}</span>)}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Check size={13} className="ok" />
              <span className="text-[12px] mut"><b className="mono" style={{ color: "var(--tx)" }}>{q}</b> is not on any blocklist — it would resolve normally.</span>
            </div>
          )}
        </div>
      )}
      <div className="p-4 flex flex-wrap gap-1.5 overflow-y-auto scroll" style={{ maxHeight: 304 }}>
        {sample.map((d) => <span key={d} className="tag">{d}</span>)}
        {listCounts[cat] > 80 && <span className="tag" style={{ color: "var(--acc)" }}>+ {fmtNum(listCounts[cat] - 80)} more…</span>}
      </div>
    </Card>
  );
}

function UserLists() {
  const allowlist = useStore((s) => s.allowlist);
  const denylist = useStore((s) => s.denylist);
  const addToList = useStore((s) => s.addToList);
  const removeFromList = useStore((s) => s.removeFromList);
  const [aVal, setAVal] = useState("");
  const [dVal, setDVal] = useState("");

  const pack = (which: "allowlist" | "denylist", val: string, setVal: (s: string) => void) => {
    const d = val.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return;
    addToList(which, d);
    setVal("");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--ok)" }}>Allowlist</span>
          <span className="mono text-[10px] dim">{allowlist.length}</span>
        </div>
        <div className="flex gap-1.5 mb-2.5">
          <input className="input mono" style={{ height: 28 }} placeholder="trusted.com" value={aVal} onChange={(e) => setAVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pack("allowlist", aVal, setAVal)} />
          <button className="btn btn-sm btn-acc flex-none" onClick={() => pack("allowlist", aVal, setAVal)}><Plus size={12} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allowlist.map((d) => (
            <span key={d} className="tag" style={{ color: "var(--ok)" }}>{d} <X size={10} className="cursor-pointer" onClick={() => removeFromList("allowlist", d)} /></span>
          ))}
          {allowlist.length === 0 && <span className="text-[11px] dim">Domains here always resolve, overriding category lists.</span>}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--bad)" }}>Denylist</span>
          <span className="mono text-[10px] dim">{denylist.length}</span>
        </div>
        <div className="flex gap-1.5 mb-2.5">
          <input className="input mono" style={{ height: 28 }} placeholder="evil.com" value={dVal} onChange={(e) => setDVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pack("denylist", dVal, setDVal)} />
          <button className="btn btn-sm btn-bad flex-none" onClick={() => pack("denylist", dVal, setDVal)}><Plus size={12} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {denylist.map((d) => (
            <span key={d} className="tag" style={{ color: "var(--bad)" }}>{d} <X size={10} className="cursor-pointer" onClick={() => removeFromList("denylist", d)} /></span>
          ))}
          {denylist.length === 0 && <span className="text-[11px] dim">Domains here are refused before any other rule runs.</span>}
        </div>
      </Card>
    </div>
  );
}
