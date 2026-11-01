import { useMemo, useState } from "react";
import { BrainCircuit, CloudOff, Play, Plus, Server, ServerOff, Wifi, WifiOff } from "lucide-react";
import { Card, Field, PageHeader, Toggle } from "@/components/ui";
import type { Policy, RuntimeApp } from "@/lib/core";
import { AI_CATEGORY_LABEL, fmtAgo, fmtBytes, fmtNum } from "@/lib/core";
import { probeEndpoint, type EndpointProbe } from "@/lib/engine";
import { useStore } from "@/lib/store";

export function AIPrivacy() {
  const apps = useStore((s) => s.apps);
  const connEvents = useStore((s) => s.connEvents);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setPolicy = useStore((s) => s.setPolicy);
  const notify = useStore((s) => s.notify);

  const aiApps = useMemo(() => Object.values(apps).filter((a) => a.ai), [apps]);
  const externalAttempts = useMemo(
    () => connEvents.filter((e) => apps[e.appId]?.ai && e.scope !== "localhost").slice(0, 30),
    [connEvents, apps]
  );
  const blockedExternal = externalAttempts.filter((e) => e.verdict === "blocked").length;

  const enableLocalOnly = (on: boolean) => {
    updateSettings({ localAiOnly: on });
    if (on) {
      for (const a of aiApps) {
        if (a.category === "cloud-ai") setPolicy(a.id, "block");
        else setPolicy(a.id, "local-only");
      }
      notify({ kind: "ok", title: "Local-AI-only mode enabled", body: "Cloud AI apps blocked; local AI restricted to localhost. Allowlisted domains still pass." });
    } else {
      for (const a of aiApps) if (a.policy !== "temp-allow") setPolicy(a.id, "allow");
      notify({ kind: "info", title: "Local-AI-only mode disabled", body: "AI application policies restored to defaults." });
    }
  };

  return (
    <>
      <PageHeader
        title="AI Privacy"
        sub="Decide exactly how AI tools on this machine may communicate. Cloud inference stops working when its app is blocked — that is the point. Local models keep running on localhost unless you say otherwise."
        right={
          <>
            <span className="chip chip-acc2">{fmtNum(aiApps.length)} AI apps</span>
            <span className="chip chip-bad">{fmtNum(blockedExternal)} external blocked</span>
          </>
        }
      />

      <Card className="p-4 mb-3 anim-fade-up">
        <Field
          label="AI Privacy Mode"
          hint="Identify AI applications, surface their external connections, and alert when a “local” AI tool phones home. Local execution ≠ local inference — we classify by where inference happens."
        >
          <Toggle on={settings.aiPrivacyMode} onChange={(b) => updateSettings({ aiPrivacyMode: b })} />
        </Field>
        <Field
          label="Allow local AI connections only"
          hint="Permit approved localhost endpoints (Ollama, LM Studio, …) and block unapproved external AI servers. External attempts are logged below."
        >
          <Toggle on={settings.localAiOnly} onChange={enableLocalOnly} bad />
        </Field>
      </Card>

      <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase dim mb-2 mt-5">AI application roster</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6 stagger">
        {aiApps.map((a) => <AICard key={a.id} a={a} setPolicy={setPolicy} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <LocalEndpoints />
        <Card className="overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">External attempts by AI tools</span>
            <CloudOff size={13} className="dim" />
          </div>
          <div className="overflow-y-auto scroll" style={{ maxHeight: 320 }}>
            {externalAttempts.length === 0 && <div className="p-6 text-[12px] dim text-center">No AI tool has attempted an external connection in this session.</div>}
            {externalAttempts.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 45%, transparent)" }}>
                <span className={`led flex-none ${e.verdict === "blocked" ? "bad" : "on"}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-[12px]" style={{ color: "var(--tx)" }}>{e.appName}</span>
                  <span className="dim mono text-[11px]"> → {e.domain ?? e.destIp}:{e.port}</span>
                  <span className="ml-2 mono text-[9.5px]" style={{ color: e.scope === "lan" ? "var(--info)" : "var(--acc2)" }}>{e.scope.toUpperCase()}</span>
                </div>
                <span className={`chip flex-none ${e.verdict === "blocked" ? "chip-bad" : "chip-ok"}`}>{e.verdict}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function AICard({ a, setPolicy }: { a: RuntimeApp; setPolicy: (id: string, p: Policy, t?: number | null) => void }) {
  const blockedMode = a.policy === "block";
  const localOnly = a.policy === "local-only";
  const Icon = blockedMode ? WifiOff : Wifi;
  return (
    <Card hover className="p-4 relative overflow-hidden">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center flex-none"
          style={{ background: a.category === "cloud-ai" ? "var(--acc2-dim)" : "var(--acc-dim)", border: `1px solid color-mix(in srgb, ${a.category === "cloud-ai" ? "var(--acc2)" : "var(--acc)"} 30%, transparent)` }}>
          <BrainCircuit size={16} style={{ color: a.category === "cloud-ai" ? "var(--acc2)" : "var(--acc)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--tx)" }}>{a.name}</span>
            {a.active && <span className="led on flex-none" />}
          </div>
          <div className="mono text-[9.5px] dim truncate mt-0.5">{a.exe}</div>
        </div>
        <span className={`chip flex-none ${a.category === "cloud-ai" ? "chip-acc2" : a.category === "local-ai" ? "chip-acc" : "chip-info"}`}>{AI_CATEGORY_LABEL[a.category]}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          ["Attempts", fmtNum(a.attempts), "var(--tx)"],
          ["Allowed", fmtNum(a.allowed), "var(--ok)"],
          ["Blocked", fmtNum(a.blocked), "var(--bad)"],
          ["Transfer", fmtBytes(a.bytesUp + a.bytesDown), "var(--info)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg px-2 py-1.5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <div className="text-[9px] uppercase tracking-wider dim">{l}</div>
            <div className="mono text-[12.5px] font-semibold mt-0.5" style={{ color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
        {Object.entries(a.dests).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([d, n]) => (
          <span key={d} className="tag" style={d === "127.0.0.1" ? { color: "var(--acc)" } : undefined}>{d} ×{n}</span>
        ))}
        {Object.keys(a.dests).length === 0 && <span className="text-[10.5px] dim">no destinations yet</span>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <select
          className="input"
          style={{ height: 28, fontSize: 11.5, color: blockedMode ? "var(--bad)" : localOnly ? "var(--warn)" : undefined }}
          value={a.policy}
          onChange={(e) => {
            const p = e.target.value as Policy;
            setPolicy(a.id, p, p === "temp-allow" ? Date.now() + 30 * 60_000 : null);
          }}
        >
          <option value="allow">Network access: ALLOWED</option>
          <option value="block">Network access: BLOCKED</option>
          <option value="local-only">Network access: LOCALHOST ONLY</option>
          <option value="temp-allow">ALLOW FOR 30 MINUTES</option>
        </select>
        <Icon size={15} className="flex-none" style={{ color: blockedMode ? "var(--bad)" : localOnly ? "var(--warn)" : "var(--ok)" }} />
      </div>
      <div className="text-[9.5px] dim mt-2 mono">{a.lastSeen ? `last flow ${fmtAgo(a.lastSeen)}` : "no traffic observed"}</div>
    </Card>
  );
}

const DEFAULT_ENDPOINTS = [
  { label: "Ollama", url: "http://localhost:11434", kind: "ollama" as const },
  { label: "LM Studio / OpenAI-compatible", url: "http://localhost:1234", kind: "openai" as const },
  { label: "Open WebUI", url: "http://localhost:3000", kind: "openai" as const },
];

function LocalEndpoints() {
  const [results, setResults] = useState<Record<string, EndpointProbe>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [endpoints, setEndpoints] = useState(DEFAULT_ENDPOINTS);

  const probe = async (label: string, url: string, kind: "ollama" | "openai") => {
    setBusy(label);
    const r = await probeEndpoint(url, kind);
    setResults((prev) => ({ ...prev, [label]: r }));
    setBusy(null);
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Local AI endpoints — real probes</span>
        <Server size={13} className="dim" />
      </div>
      <div className="p-4 flex flex-col gap-2.5">
        {endpoints.map((ep) => {
          const r = results[ep.label];
          return (
            <div key={ep.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
              <span className={`led flex-none ${!r ? "off" : r.reachable ? "on" : "bad"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium flex items-center gap-2" style={{ color: "var(--tx)" }}>
                  {ep.label}
                  {r?.models && r.models.length > 0 && <span className="chip chip-acc" style={{ height: 17, fontSize: 9 }}>{r.models.length} model{r.models.length > 1 ? "s" : ""}</span>}
                </div>
                <div className="mono text-[10px] dim truncate">{r ? `${r.url} — ${r.note}${r.reachable ? ` · ${r.ms} ms` : ""}` : ep.url}</div>
                {r?.models && r.models.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">{r.models.slice(0, 4).map((m) => <span key={m} className="tag" style={{ fontSize: 9.5 }}>{m}</span>)}</div>
                )}
              </div>
              <button className="btn btn-sm flex-none" disabled={busy === ep.label} onClick={() => probe(ep.label, ep.url, ep.kind)}>
                <Play size={11} /> {r ? "Re-probe" : "Probe"}
              </button>
            </div>
          );
        })}
        <div className="flex gap-2 mt-1">
          <input className="input mono" placeholder="http://localhost:8080" value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 120))} />
          <button className="btn flex-none" disabled={!/^https?:\/\/.+/.test(custom)} onClick={() => { setEndpoints((p) => [...p, { label: custom.replace(/^https?:\/\//, ""), url: custom, kind: "openai" as const }]); setCustom(""); }}>
            <Plus size={13} /> Add
          </button>
        </div>
        <p className="text-[10.5px] dim leading-relaxed mt-1 flex gap-2">
          <ServerOff size={12} className="flex-none mt-0.5" />
          Probes run from your browser. If a local server is running but shows “unreachable”, the browser’s CORS / Private
          Network Access policy is blocking the read — that is a visibility limit, not a verdict on your server.
        </p>
      </div>
    </Card>
  );
}
