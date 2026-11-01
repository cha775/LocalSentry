import { Ban, Check, Globe, History, Plus, Shield } from "lucide-react";
import { Drawer } from "@/components/ui";
import { fmtBytes, fmtDateTime, LIST_LABEL, type ConnEvent, type ListCategory } from "@/lib/core";
import { useStore } from "@/lib/store";

/* Connection inspection panel — metadata only. PrivacyGuard never decrypts
   TLS payloads, never captures credentials, tokens, or message bodies. */

export function ConnDrawer() {
  const conn = useStore((s) => s.drawerConn);
  const openConn = useStore((s) => s.openConn);
  if (!conn) return null;
  return <Inspector e={conn} onClose={() => openConn(null)} />;
}

function Inspector({ e, onClose }: { e: ConnEvent; onClose: () => void }) {
  const addFwRule = useStore((s) => s.addFwRule);
  const setPolicy = useStore((s) => s.setPolicy);
  const addToList = useStore((s) => s.addToList);
  const notify = useStore((s) => s.notify);
  const dnsEvents = useStore((s) => s.dnsEvents);
  const connEvents = useStore((s) => s.connEvents);
  const setPage = useStore((s) => s.setPage);
  const setSearch = useStore((s) => s.setSearch);

  const relatedDns = e.domain ? dnsEvents.find((d) => d.domain === e.domain) : undefined;
  const history = connEvents.filter((c) => (e.domain ? c.domain === e.domain : c.destIp === e.destIp)).slice(0, 6);
  const blocked = e.verdict === "blocked";
  const dest = e.domain ?? e.destIp;

  const rows: [string, React.ReactNode][] = [
    ["Application", <span key="a" style={{ color: "var(--tx)" }}>{e.appName} <span className="dim mono text-[10px]">pid {e.pid}</span></span>],
    ["Executable", <span key="b" className="mono text-[11px] break-all">{e.exePath}</span>],
    ["Destination", <span key="c" className="mono" style={{ color: "var(--tx)" }}>{e.destIp}{e.domain ? "" : " (no DNS name observed)"}</span>],
    ["Hostname", e.domain ? <span key="d" className="mono acc">{e.domain}</span> : <span key="d" className="dim">unknown — bare IP contact</span>],
    ["Port / Protocol", <span key="e" className="mono">{e.port} / {e.proto}</span>],
    ["Scope", <span key="f"><ScopeChip scope={e.scope} /></span>],
    ["Timestamp", <span key="g" className="mono text-[11.5px]">{fmtDateTime(e.ts)}</span>],
    ["State", <span key="h" className="mono">{e.state}</span>],
    ["Data sent / received", <span key="i" className="mono">{fmtBytes(e.bytesUp)} ↑ · {fmtBytes(e.bytesDown)} ↓</span>],
    ["Verdict", <span key="j" className={`chip ${blocked ? "chip-bad" : "chip-ok"}`}>{e.verdict.toUpperCase()}</span>],
    ["Decided by", <span key="k" className="flex flex-wrap gap-1">{e.reasons.map((r) => <ReasonTag key={r} r={r} />)}</span>],
    ["DNS resolution", relatedDns
      ? <span key="l" className="mono text-[11px]">{(relatedDns.answers ?? []).join(", ") || "—"} via {relatedDns.provider} ({relatedDns.latencyMs} ms{relatedDns.cached ? ", cache" : ""})</span>
      : <span key="l" className="dim">no matching query in the DNS log</span>],
    ["Data source", <span key="m" className={`chip ${e.simulated ? "chip-warn" : "chip-ok"}`}>{e.simulated ? "SIMULATED (demo plane)" : "OBSERVED (real capture)"}</span>],
  ];

  return (
    <Drawer
      title={e.appName}
      sub={`${dest}:${e.port}`}
      onClose={onClose}
      footer={
        <>
          {e.domain && (
            <>
              <button className="btn btn-bad btn-sm" onClick={() => { addToList("denylist", e.domain!); notify({ kind: "block", title: "Domain denied", body: `${e.domain} added to your custom denylist.` }); }}>
                <Ban size={12} /> Block domain
              </button>
              <button className="btn btn-sm" onClick={() => { addToList("allowlist", e.domain!); notify({ kind: "ok", title: "Domain allowed", body: `${e.domain} added to your allowlist.` }); }}>
                <Check size={12} /> Allow domain
              </button>
            </>
          )}
          <button className="btn btn-bad btn-sm" onClick={() => { setPolicy(e.appId, "block"); notify({ kind: "block", title: "Application blocked", body: `${e.appName} can no longer reach the network.` }); }}>
            <Shield size={12} /> Block app
          </button>
          <button className="btn btn-sm" onClick={() => { setPolicy(e.appId, "allow"); notify({ kind: "ok", title: "Application allowed", body: `${e.appName} may use the network.` }); }}>
            <Check size={12} /> Allow app
          </button>
          <button className="btn btn-sm" onClick={() => {
            addFwRule({ target: e.domain ? "domain" : "ip", appId: e.appId, value: e.domain ?? e.destIp, port: String(e.port), proto: e.proto, action: "blocked", note: `Rule for ${e.appName}` });
            notify({ kind: "info", title: "Firewall rule created", body: `${e.appName} → ${dest}:${e.port} will be blocked.` });
          }}>
            <Plus size={12} /> Rule
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(dest); setPage("monitor"); onClose(); }}>
            <History size={12} /> History
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-0">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-6 py-2.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" }}>
            <span className="text-[11px] uppercase tracking-[0.08em] dim font-medium flex-none pt-0.5">{k}</span>
            <span className="text-[12.5px] text-right mut">{v}</span>
          </div>
        ))}
      </div>

      <div className="card p-3.5 mt-4" style={{ background: "var(--info-dim)", borderColor: "color-mix(in srgb, var(--info) 25%, transparent)" }}>
        <div className="flex gap-2.5">
          <Globe size={14} className="flex-none mt-0.5" style={{ color: "var(--info)" }} />
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--tx)" }}>
            PrivacyGuard inspects <b>connection metadata only</b>. HTTPS payloads are never decrypted; passwords, tokens and message
            content are never captured or stored. What you see here is everything the guard knows about this flow.
          </p>
        </div>
      </div>

      {history.length > 1 && (
        <div className="mt-5">
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase dim mb-2">Recent flows to {dest}</div>
          <div className="flex flex-col gap-1.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-[11.5px] mono px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <span className={h.verdict === "blocked" ? "bad" : "ok"}>{h.verdict === "blocked" ? "BLK" : "OK"}</span>
                <span className="mut">{h.appName}</span>
                <span className="dim ml-auto">{fmtDateTime(h.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function ScopeChip({ scope }: { scope: string }) {
  const map: Record<string, { c: string; label: string }> = {
    localhost: { c: "chip-acc", label: "LOCALHOST" },
    lan: { c: "chip-info", label: "LAN" },
    internet: { c: "chip-acc2", label: "INTERNET" },
  };
  const m = map[scope] ?? map.internet;
  return <span className={`chip ${m.c}`}>{m.label}</span>;
}

export function ReasonTag({ r }: { r: string }) {
  if (r.startsWith("list:")) {
    const cat = r.slice(5) as ListCategory;
    return <span className="tag" style={{ color: "var(--bad)", borderColor: "color-mix(in srgb, var(--bad) 30%, transparent)" }}><Ban size={9} /> {LIST_LABEL[cat]} list</span>;
  }
  if (r === "denylist") return <span className="tag" style={{ color: "var(--bad)" }}><Ban size={9} /> custom denylist</span>;
  if (r.startsWith("policy:")) return <span className="tag" style={{ color: "var(--warn)" }}><Shield size={9} /> {r.slice(7)}</span>;
  if (r.startsWith("strict")) return <span className="tag" style={{ color: "var(--bad)" }}>strict mode</span>;
  if (r.startsWith("fw:")) return <span className="tag" style={{ color: "var(--bad)" }}>fw: {r.slice(3)}</span>;
  if (r.startsWith("fw-allow:")) return <span className="tag" style={{ color: "var(--ok)" }}>fw allow: {r.slice(9)}</span>;
  if (r.startsWith("auto:")) return <span className="tag" style={{ color: "var(--acc2)" }}>auto: {r.slice(5)}</span>;
  if (r.startsWith("auto-allow:")) return <span className="tag" style={{ color: "var(--acc2)" }}>auto allow: {r.slice(11)}</span>;
  if (r === "local-ai-only") return <span className="tag" style={{ color: "var(--warn)" }}>local-AI-only mode</span>;
  if (r === "ai-external-notice") return <span className="tag" style={{ color: "var(--info)" }}>local AI → internet notice</span>;
  if (r === "default:allow") return <span className="tag"><Check size={9} /> default allow</span>;
  if (r === "probe:localhost") return <span className="tag" style={{ color: "var(--acc)" }}>endpoint probe</span>;
  return <span className="tag">{r}</span>;
}
