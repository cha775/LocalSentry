import { useState } from "react";
import { Check, FlaskConical, Flame, Plus, Shield, ShieldAlert, Trash2, X } from "lucide-react";
import { Card, EmptyState, Field, Modal, PageHeader, Toggle } from "@/components/ui";
import type { ConnEvent } from "@/lib/core";
import { fmtAgo, fmtDateTime, fmtNum } from "@/lib/core";
import { guardedFetch } from "@/lib/engine";
import { useStore } from "@/lib/store";

export function Firewall() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const fwRules = useStore((s) => s.fwRules);
  const removeFwRule = useStore((s) => s.removeFwRule);
  const apps = useStore((s) => s.apps);
  const pending = useStore((s) => s.pendingApprovals);
  const setPolicy = useStore((s) => s.setPolicy);
  const addFwRule = useStore((s) => s.addFwRule);
  const approveEvent = useStore((s) => s.approveEvent);
  const notify = useStore((s) => s.notify);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Firewall"
        sub="Application-level outbound control. In this sandbox the rules are enforced on the console's real requests and on the demo traffic plane; the native build enforces them system-wide through the Windows Filtering Platform."
        right={<button className="btn btn-acc" onClick={() => setAdding(true)}><Plus size={13} /> New rule</button>}
      />

      <Card className="p-4 mb-3 anim-fade-up">
        <Field
          label="Strict mode"
          hint="Block all outbound connections unless explicitly allowed. Unknown applications are denied by default and queued below for your approval."
        >
          <Toggle bad on={settings.strictMode} onChange={(b) => {
            updateSettings({ strictMode: b });
            notify({ kind: b ? "warn" : "info", title: b ? "Strict mode enabled" : "Strict mode disabled", body: b ? "Unapproved outbound traffic is now blocked by default." : "Default policy restored to allow." });
          }} />
        </Field>
        <Field
          label="Firewall enforcement"
          hint="Master switch for verdict evaluation. When off, flows are observed and logged but never blocked."
        >
          <Toggle on={settings.firewallOn} onChange={(b) => updateSettings({ firewallOn: b })} />
        </Field>
      </Card>

      {pending.length > 0 && (
        <Card className="mb-3 overflow-hidden anim-fade-up" style={{ borderColor: "color-mix(in srgb, var(--bad) 35%, transparent)" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--line)", background: "var(--bad-dim)" }}>
            <ShieldAlert size={14} style={{ color: "var(--bad)" }} />
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--bad)" }}>{pending.length} connection{pending.length > 1 ? "s" : ""} awaiting your decision</span>
          </div>
          {pending.slice(0, 8).map((e) => (
            <ApprovalRow key={e.id} e={e} onApprove={() => {
              if (e.domain) addFwRule({ target: "domain", appId: e.appId, value: e.domain, port: "*", proto: "any", action: "allowed", note: `Approved in strict mode` });
              else setPolicy(e.appId, "allow");
              approveEvent(e);
              notify({ kind: "ok", title: "Approved", body: `${e.appName} → ${e.domain ?? e.destIp} is now allowed.` });
            }} onDeny={() => {
              setPolicy(e.appId, "block");
              approveEvent(e);
            }} />
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <Card className="xl:col-span-3 overflow-hidden anim-fade-up">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Firewall rules · {fwRules.length}</span>
            <span className="text-[10px] mono dim">persisted locally</span>
          </div>
          <div className="overflow-y-auto scroll" style={{ maxHeight: 460 }}>
            <table className="tbl">
              <thead>
                <tr><th>Target</th><th>Application</th><th>Value</th><th>Port</th><th>Proto</th><th>Action</th><th style={{ textAlign: "right" }}>Hits</th><th style={{ textAlign: "right" }} />
                </tr>
              </thead>
              <tbody>
                {fwRules.map((r) => (
                  <tr key={r.id}>
                    <td><span className="chip">{r.target.toUpperCase()}</span></td>
                    <td style={{ color: "var(--tx)" }}>{r.appId === "*" ? "All applications" : apps[r.appId]?.name ?? r.appId}</td>
                    <td><span className="mono text-[11.5px]">{r.value}</span>{r.note && <div className="text-[9.5px] dim">{r.note}</div>}</td>
                    <td className="mono text-[11px]">{r.port}</td>
                    <td className="mono text-[11px] dim">{r.proto}</td>
                    <td><span className={`chip ${r.action === "blocked" ? "chip-bad" : "chip-ok"}`}>{r.action === "blocked" ? "BLOCK" : "ALLOW"}</span></td>
                    <td className="mono" style={{ textAlign: "right" }}>{fmtNum(r.hits)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeFwRule(r.id)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fwRules.length === 0 && <EmptyState icon={Shield} title="No firewall rules" hint="Create one, or block apps from the Applications page." />}
          </div>
        </Card>

        <div className="xl:col-span-2 flex flex-col gap-3">
          <TestConsole />
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={13} style={{ color: "var(--warn)" }} />
              <span className="text-[12px] font-semibold">How strict mode decides</span>
            </div>
            <ol className="text-[11.5px] mut leading-relaxed list-decimal pl-4 flex flex-col gap-1">
              <li>Custom denylist → always blocked.</li>
              <li>Specific firewall rule (domain/IP/port) → applied.</li>
              <li>Per-app policy (block / localhost-only / temp) → applied.</li>
              <li>Strict mode: no explicit allow → blocked & queued for approval.</li>
              <li>Automation rules can override or alert.</li>
            </ol>
            <p className="text-[10.5px] dim mt-3 leading-relaxed">
              Approved decisions are saved as persistent local rules and survive restarts. A one-click recovery
              (reset all rules) lives in Settings.
            </p>
          </Card>
        </div>
      </div>

      {adding && <AddRuleModal onClose={() => setAdding(false)} />}
    </>
  );
}

function ApprovalRow({ e, onApprove, onDeny }: { e: ConnEvent; onApprove: () => void; onDeny: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 45%, transparent)" }}>
      <div className="min-w-0 flex-1">
        <span className="text-[12px] font-medium" style={{ color: "var(--tx)" }}>{e.appName}</span>
        <span className="mono text-[11px] mut"> → {e.domain ?? e.destIp}:{e.port}</span>
        <div className="mono text-[9.5px] dim">{fmtDateTime(e.ts)}</div>
      </div>
      <button className="btn btn-sm btn-acc" onClick={onApprove}><Check size={12} /> Approve</button>
      <button className="btn btn-sm btn-bad" onClick={onDeny}><X size={12} /> Keep blocked</button>
    </div>
  );
}

function TestConsole() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ ts: number; line: string; tone: string }[]>([]);

  const run = async (target: string) => {
    if (busy) return;
    setBusy(true);
    setLog((l) => [{ ts: Date.now(), line: `→ attempting ${target}`, tone: "var(--mut)" }, ...l].slice(0, 20));
    const r = await guardedFetch(target);
    setLog((l) => [{
      ts: Date.now(),
      line: r.blocked
        ? `✕ BLOCKED before it left the machine — ${r.reason}`
        : `✓ ${r.reason === "allowed" ? `connected (${r.ms} ms real round trip)` : r.reason}`,
      tone: r.blocked ? "var(--bad)" : "var(--ok)",
    }, ...l].slice(0, 20));
    setBusy(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical size={13} style={{ color: "var(--acc2)" }} />
        <span className="text-[12px] font-semibold">Live enforcement test</span>
      </div>
      <p className="text-[10.5px] dim mb-3 leading-relaxed">Real requests issued from this console through the guard. Blocked ones never touch the network — verify in your browser's devtools.</p>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <button className="btn btn-sm" disabled={busy} onClick={() => run("https://doubleclick.net/")}>Test blocked ad domain</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => run("https://www.gstatic.com/generate_204")}>Test allowed domain</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => run("https://vortex.data.microsoft.com/")}>Test telemetry domain</button>
      </div>
      <div className="flex gap-1.5 mb-3">
        <input className="input mono" style={{ height: 28 }} placeholder="https://any-domain.test/path" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 200))}
          onKeyDown={(e) => e.key === "Enter" && /^https?:\/\//.test(url) && run(url)} />
        <button className="btn btn-sm btn-acc flex-none" disabled={busy || !/^https?:\/\//.test(url)} onClick={() => run(url)}>Send</button>
      </div>
      <div className="logviewer flex flex-col gap-1" style={{ minHeight: 60 }}>
        {log.map((l, i) => <div key={l.ts + ":" + i} style={{ color: l.tone }}><span className="dim">{fmtAgo(l.ts).padEnd(10)}</span> {l.line}</div>)}
        {log.length === 0 && <span className="dim text-[11px]">Test results will appear here.</span>}
      </div>
    </Card>
  );
}

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const addFwRule = useStore((s) => s.addFwRule);
  const apps = useStore((s) => s.apps);
  const notify = useStore((s) => s.notify);
  const [target, setTarget] = useState<"app" | "domain" | "ip">("app");
  const [appId, setAppId] = useState<string>("*");
  const [value, setValue] = useState("");
  const [port, setPort] = useState("*");
  const [proto, setProto] = useState<"any" | "TCP" | "UDP">("any");
  const [action, setAction] = useState<"allowed" | "blocked">("blocked");

  const valid = target === "app" ? appId !== "" : value.trim().length > 2;

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <h2 className="text-[16px] h-serif mb-1" style={{ color: "var(--tx)" }}>New firewall rule</h2>
        <p className="text-[11.5px] mut mb-4">Rules persist locally and apply to every new connection attempt.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] dim">Rule target</span>
            <select className="input mt-1" value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
              <option value="app">Whole application</option>
              <option value="domain">Destination domain</option>
              <option value="ip">Destination IP</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] dim">Application</span>
            <select className="input mt-1" value={appId} onChange={(e) => setAppId(e.target.value)}>
              <option value="*">All applications</option>
              {Object.values(apps).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {target !== "app" && (
            <label className="block col-span-2">
              <span className="text-[11px] dim">{target === "domain" ? "Domain (subdomains match too)" : "IPv4 address"}</span>
              <input className="input mt-1 mono" placeholder={target === "domain" ? "telemetry.example.com" : "185.199.108.133"} value={value}
                onChange={(e) => setValue(e.target.value.replace(target === "ip" ? /[^\d.]/g : /[^\w.\-]/g, "").slice(0, 120))} />
            </label>
          )}
          <label className="block">
            <span className="text-[11px] dim">Port</span>
            <select className="input mt-1" value={port} onChange={(e) => setPort(e.target.value)}>
              {["*", "53", "80", "443", "1234", "3000", "8080", "11434"].map((p) => <option key={p} value={p}>{p === "*" ? "Any" : p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] dim">Protocol</span>
            <select className="input mt-1" value={proto} onChange={(e) => setProto(e.target.value as typeof proto)}>
              <option value="any">TCP + UDP</option><option value="TCP">TCP</option><option value="UDP">UDP</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-[11px] dim">Action</span>
            <select className="input mt-1" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
              <option value="blocked">Block matching connections</option>
              <option value="allowed">Allow matching connections</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" disabled={!valid} onClick={() => {
            addFwRule({ target, appId: target === "app" ? (appId === "*" ? "*" : appId) : appId, value: target === "app" ? "*" : value.trim().toLowerCase(), port, proto, action, note: "Manual rule" });
            notify({ kind: "info", title: "Rule saved", body: `${action === "blocked" ? "Blocking" : "Allowing"} ${target === "app" ? (appId === "*" ? "all apps" : apps[appId]?.name) : value} · port ${port} · ${proto}` });
            onClose();
          }}><Plus size={13} /> Save rule</button>
        </div>
      </div>
    </Modal>
  );
}
