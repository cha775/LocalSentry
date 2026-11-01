import { useState } from "react";
import { CalendarClock, Plus, Terminal, Trash2, Zap } from "lucide-react";
import { Card, Field, PageHeader, Toggle } from "@/components/ui";
import type { AutomationRule } from "@/lib/core";
import { fmtAgo } from "@/lib/core";
import { useStore } from "@/lib/store";

const DEST_OPTIONS: { value: AutomationRule["whenDest"]; label: string }[] = [
  { value: "any", label: "any destination" },
  { value: "unknown-external", label: "an unknown external server" },
  { value: "localhost", label: "localhost" },
  { value: "lan", label: "a LAN address" },
  { value: "internet", label: "the internet" },
  { value: "blocklisted", label: "a blocklisted domain" },
];

const ACTION_OPTIONS: { value: AutomationRule["thenAction"]; label: string }[] = [
  { value: "block", label: "block the connection" },
  { value: "allow", label: "allow it (overrides blocklists)" },
  { value: "notify", label: "notify me" },
  { value: "record", label: "record the event" },
];

export function Automation() {
  const automation = useStore((s) => s.automation);
  const apps = useStore((s) => s.apps);
  const autoLog = useStore((s) => s.autoLog);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateAutomation = useStore((s) => s.updateAutomation);
  const removeAutomation = useStore((s) => s.removeAutomation);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Automation"
        sub="Local WHEN / THEN rules evaluated on every connection the instant it forms. Everything runs on this machine — no schedulers, no cloud."
        right={<button className="btn btn-acc" onClick={() => setOpen(!open)}><Plus size={13} /> New rule</button>}
      />

      {open && <RuleBuilder onClose={() => setOpen(false)} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 flex flex-col gap-2.5">
          {automation.length === 0 && (
            <Card className="p-8 text-center text-[12px] dim">No automation rules. Create one — e.g. “WHEN application = Claude Code AND destination = an unknown external server THEN block the connection”.</Card>
          )}
          {automation.map((r) => (
            <Card key={r.id} hover className="p-4 anim-fade-up">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg grid place-items-center flex-none mt-0.5" style={{ background: r.enabled ? "var(--acc-dim)" : "var(--panel2)", border: "1px solid var(--line)" }}>
                  <Zap size={14} style={{ color: r.enabled ? "var(--acc)" : "var(--dim)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{r.name}</span>
                    {r.schedule === "hours" && <span className="chip chip-info"><CalendarClock size={9} /> {String(r.hourFrom).padStart(2, "0")}:00–{String(r.hourTo).padStart(2, "0")}:00</span>}
                  </div>
                  <div className="text-[11.5px] mut mt-1 mono leading-relaxed">
                    <span className="acc2">WHEN</span> application = <b style={{ color: "var(--tx)" }}>{r.whenApp === "any" ? "any" : apps[r.whenApp]?.name ?? r.whenApp}</b>
                    {" "}AND destination = <b style={{ color: "var(--tx)" }}>{DEST_OPTIONS.find((o) => o.value === r.whenDest)?.label}</b>
                    {r.whenDomain && <> matching <b className="acc mono">{r.whenDomain}</b></>}
                    {" "}<span className="acc2">THEN</span> <b style={{ color: r.thenAction === "block" ? "var(--bad)" : "var(--acc)" }}>{ACTION_OPTIONS.find((o) => o.value === r.thenAction)?.label}</b>
                  </div>
                  <div className="mono text-[10px] dim mt-1.5">
                    fired {r.hits}× {r.lastFired ? `· last ${fmtAgo(r.lastFired)}` : "· never"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <Toggle on={r.enabled} onChange={(b) => updateAutomation(r.id, { enabled: b })} />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeAutomation(r.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={13} style={{ color: "var(--acc2)" }} />
              <span className="text-[12px] font-semibold">Scheduled tasks</span>
            </div>
            <Field label="Daily privacy report" hint="Aggregated from real local logs once per day, saved to the Reports page.">
              <Toggle on={settings.autoDailyReport} onChange={(b) => updateSettings({ autoDailyReport: b })} />
            </Field>
            <Field label="Automatic log cleanup" hint={`Connection logs older than ${settings.retentionDays} days are pruned daily.`}>
              <Toggle on={settings.autoCleanup} onChange={(b) => updateSettings({ autoCleanup: b })} />
            </Field>
          </Card>

          <Card className="overflow-hidden flex-1">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--line)" }}>
              <Terminal size={13} className="dim" />
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase dim">Engine activity</span>
            </div>
            <div className="p-3.5 logviewer overflow-y-auto scroll flex flex-col gap-1" style={{ maxHeight: 330 }}>
              {autoLog.length === 0 && <span className="dim text-[11px]">Rule hits and scheduled task runs will appear here.</span>}
              {autoLog.map((l, i) => (
                <div key={l.ts + ":" + i}>
                  <span className="dim">{new Date(l.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>{" "}
                  <span style={{ color: l.text.startsWith("BLOCK") ? "var(--bad)" : l.text.startsWith("ALLOW") ? "var(--acc)" : "var(--mut)" }}>{l.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function RuleBuilder({ onClose }: { onClose: () => void }) {
  const apps = useStore((s) => s.apps);
  const addAutomation = useStore((s) => s.addAutomation);
  const notify = useStore((s) => s.notify);
  const [name, setName] = useState("");
  const [whenApp, setWhenApp] = useState("any");
  const [whenDest, setWhenDest] = useState<AutomationRule["whenDest"]>("any");
  const [whenDomain, setWhenDomain] = useState("");
  const [thenAction, setThenAction] = useState<AutomationRule["thenAction"]>("block");
  const [schedule, setSchedule] = useState<"always" | "hours">("always");
  const [hourFrom, setHourFrom] = useState(0);
  const [hourTo, setHourTo] = useState(24);

  return (
    <Card className="p-5 mb-3 anim-fade-up" style={{ borderColor: "color-mix(in srgb, var(--acc) 30%, transparent)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} style={{ color: "var(--acc)" }} />
        <span className="text-[13px] font-semibold">Compose rule</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="block xl:col-span-2">
          <span className="text-[11px] dim">Rule name</span>
          <input className="input mt-1" placeholder="e.g. Silence chatty coding agents" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} />
        </label>
        <label className="block">
          <span className="text-[11px] dim">WHEN application…</span>
          <select className="input mt-1" value={whenApp} onChange={(e) => setWhenApp(e.target.value)}>
            <option value="any">any application</option>
            {Object.values(apps).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] dim">AND destination is…</span>
          <select className="input mt-1" value={whenDest} onChange={(e) => setWhenDest(e.target.value as AutomationRule["whenDest"])}>
            {DEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] dim">AND domain contains… (optional)</span>
          <input className="input mt-1 mono" placeholder="telemetry" value={whenDomain} onChange={(e) => setWhenDomain(e.target.value.replace(/[^\w.\-]/g, "").slice(0, 80))} />
        </label>
        <label className="block">
          <span className="text-[11px] dim">THEN…</span>
          <select className="input mt-1" value={thenAction} onChange={(e) => setThenAction(e.target.value as AutomationRule["thenAction"])}>
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] dim">Schedule</span>
          <select className="input mt-1" value={schedule} onChange={(e) => setSchedule(e.target.value as "always" | "hours")}>
            <option value="always">At all times</option>
            <option value="hours">Only during hours…</option>
          </select>
        </label>
        {schedule === "hours" && (
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-[11px] dim">From</span>
              <select className="input mt-1" value={hourFrom} onChange={(e) => setHourFrom(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </label>
            <label className="block flex-1">
              <span className="text-[11px] dim">Until</span>
              <select className="input mt-1" value={hourTo} onChange={(e) => setHourTo(Number(e.target.value))}>
                {Array.from({ length: 25 }, (_, h) => <option key={h} value={h}>{h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" disabled={name.trim().length < 3} onClick={() => {
          addAutomation({ name: name.trim(), enabled: true, whenApp, whenDest, whenDomain: whenDomain.trim().toLowerCase(), thenAction, schedule, hourFrom, hourTo });
          notify({ kind: "ok", title: "Automation rule armed", body: `"${name.trim()}" now evaluates every connection locally.` });
          onClose();
        }}>
          <Plus size={13} /> Arm rule
        </button>
      </div>
    </Card>
  );
}
