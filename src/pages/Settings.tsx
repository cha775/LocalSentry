import { useState } from "react";
import {
  Activity, AlertTriangle, Database, Download, Eraser, FlaskConical, HardDrive,
  Info, Lock, RefreshCw, ShieldCheck, Smartphone, Trash2,
} from "lucide-react";
import { Card, Field, Modal, PageHeader, Segmented, Toggle } from "@/components/ui";
import { download } from "@/lib/core";
import { allDns, allEvents, wipeAll } from "@/lib/db";
import { getPlatform, installAvailable, isStandalone, promptInstall } from "@/lib/pwa";
import { useStore } from "@/lib/store";

export function Settings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const counters = useStore((s) => s.counters);
  const notify = useStore((s) => s.notify);
  const setInstallGuideOpen = useStore((s) => s.setInstallGuideOpen);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportLogs = async () => {
    const [events, dns] = await Promise.all([allEvents(), allDns()]);
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      warning: "Local PrivacyGuard logs — contains app and domain metadata.",
      connections: events, dns,
    }, null, 2);
    download("privacyguard-logs.json", payload, "application/json");
    setConfirmExport(false);
    notify({ kind: "ok", title: "Logs exported", body: `${events.length} connections, ${dns.length} DNS queries written to your downloads.` });
  };

  const clearLogs = async () => {
    await wipeAll();
    localStorage.removeItem("pg.remotehosts");
    notify({ kind: "ok", title: "Local database cleared", body: "All connection logs, DNS logs, notifications and reports were deleted. Reloading…" });
    setTimeout(() => location.reload(), 900);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        sub="Everything below is stored on this machine only. No account, no telemetry, no analytics, no ads, no cloud backend."
        right={<span className="chip chip-ok"><Lock size={10} /> 100% local</span>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <SectionTitle icon={Activity} title="Monitoring" />
            <Field label="Network monitoring" hint="Master capture switch for the connection and DNS streams.">
              <Toggle on={settings.monitoring} onChange={(b) => updateSettings({ monitoring: b })} />
            </Field>
            <Field label="Demo traffic plane" hint="Generates clearly-labeled simulated per-process flows so the Windows-only behavior (WFP verdicts, process attribution) can be explored in the browser. Turn off to see observed traffic only.">
              <Toggle on={settings.demoTraffic} onChange={(b) => updateSettings({ demoTraffic: b })} />
            </Field>
            <Field label={`Demo intensity — ${settings.demoRate}/min`} hint="How busy the simulated traffic plane is. Caps CPU like a good citizen.">
              <input type="range" min={6} max={90} value={settings.demoRate} onChange={(e) => updateSettings({ demoRate: Number(e.target.value) })}
                style={{ accentColor: "var(--acc)", width: 150 }} />
            </Field>
            <Field label="Appearance" hint="Interface theme. Your eyes, your call.">
              <Segmented value={settings.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
            </Field>
            <Field label="Notifications" hint="Toast alerts for blocks, automation hits and strict-mode decisions.">
              <Toggle on={settings.notifications} onChange={(b) => updateSettings({ notifications: b })} />
            </Field>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={Database} title="Data & logs" />
            <Field label="Log retention" hint="Connection and DNS logs older than this are pruned automatically (daily task).">
              <select className="input" style={{ width: 150 }} value={settings.retentionDays} onChange={(e) => updateSettings({ retentionDays: Number(e.target.value) })}>
                {[3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </Field>
            <Field label="Export logs" hint="Download raw JSON of your local connection + DNS logs.">
              <button className="btn btn-sm" onClick={() => setConfirmExport(true)}><Download size={12} /> Export JSON</button>
            </Field>
            <Field label="Clear traffic logs & reports" hint="Deletes events, DNS logs, notifications and saved reports. Rules and settings are kept.">
              <button className="btn btn-sm btn-bad" onClick={() => setConfirmWipe(true)}><Eraser size={12} /> Clear logs</button>
            </Field>
            <Field label="Delete ALL local data" hint="Nuclear option: wipes the database, rules, lists, settings — then reloads to a clean first-run state.">
              <button className="btn btn-sm btn-bad" onClick={() => setConfirmWipe(true)}><Trash2 size={12} /> Delete everything</button>
            </Field>
            <Field label="Safe recovery — reset rules" hint="Removes all firewall rules, automation rules and app policies. Use if you locked yourself out.">
              <button className="btn btn-sm" onClick={() => setConfirmReset(true)}><RefreshCw size={12} /> Reset rules</button>
            </Field>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <SectionTitle icon={Smartphone} title="Install app — Android & iOS" />
            <p className="text-[11.5px] mut leading-relaxed mb-3">
              PrivacyGuard is an installable mobile app: home-screen icon, fullscreen standalone mode, offline shell,
              on-device data only. Android installs via Chrome's install prompt; iOS via Safari's Share → Add to Home
              Screen (Apple blocks raw <span className="mono">.ipa</span> sideloading on non-jailbroken devices).
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button className="btn btn-acc" onClick={() => {
                if (getPlatform() === "ios" || !installAvailable()) { setInstallGuideOpen(true); return; }
                promptInstall().then((r) => {
                  if (r === "accepted") notify({ kind: "ok", title: "Installed", body: "PrivacyGuard is now on your home screen." });
                  else setInstallGuideOpen(true);
                });
              }}>
                <Smartphone size={13} /> Install app
              </button>
              <button className="btn" onClick={() => setInstallGuideOpen(true)}>Show install steps</button>
              <span className={`chip ${isStandalone() ? "chip-ok" : ""}`}>
                {isStandalone() ? "Running installed" : `${getPlatform()} detected`}
              </span>
            </div>
            <p className="text-[10.5px] dim leading-relaxed">
              Need a signed APK/AAB or an iOS build? The repo ships Capacitor-ready (<span className="mono">capacitor.config.json</span>):
              <span className="mono"> npx cap add android && npx cap sync</span> → Build → Generate Signed Bundle/APK.
              Full steps in README §6b and in the install guide's "Build APK" tab.
            </p>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={HardDrive} title="Permissions (native build)" />
            <p className="text-[11.5px] mut leading-relaxed mb-2">
              This console never elevates silently. On the Windows desktop build, privileges map 1:1 to features:
            </p>
            <PermRow level="Standard user" what="Performance/Event-based monitoring, DNS cache reads, reports, storage" />
            <PermRow level="Administrator (once)" what="Installing the WFP callout that enforces verdicts per-process" />
            <PermRow level="Administrator (per rule)" what="Writing/removing Windows Firewall rules you explicitly create" />
            <PermRow level="Administrator (optional)" what="Registering PrivacyGuard as the system DNS proxy (for DNS filtering)" />
            <p className="text-[10.5px] dim leading-relaxed mt-2">
              Every elevation prompt names the exact reason. Refusing admin rights simply disables enforcement while monitoring keeps working.
            </p>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={FlaskConical} title="Known limitations — the honest list" />
            <ul className="text-[11.5px] mut leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
              <li><b style={{ color: "var(--tx)" }}>This web build</b> cannot touch the Windows network stack. Per-process flows marked SIM come from the labeled demo plane; OBS rows are real captures of this page's own traffic.</li>
              <li>DNS filtering blocks whole domains only. Ads served from the same domain as content (YouTube, Instagram…) are not separable via DNS.</li>
              <li>HTTPS payloads are never decrypted. Only metadata (who, where, when, how much) is inspected.</li>
              <li>Applications using their own DoH/DoT hide their DNS from any passive monitor — those queries are reported as unseen, never fabricated.</li>
              <li>Bare-IP connections have no domain to show; they appear as “unknown external”, not a guessed name.</li>
              <li>Local “AI” apps may still call cloud inference — classification separates execution location from inference location.</li>
              <li>Localhost probes can be blocked by browser CORS/PNA policy even when the server is up.</li>
            </ul>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={ShieldCheck} title="Privacy policy (entire thing)" />
            <p className="text-[11.5px] mut leading-relaxed">
              PrivacyGuard collects nothing. There is no account, no telemetry, no analytics, no advertising SDK, no crash-report
              beacon, and no server operated by us. Your rules, logs, reports and settings live in a local database on your disk.
              The only outbound requests this console ever makes are the ones you can watch it make on the Network Monitor
              (DoH lookups you trigger, blocklist updates you start, connectivity probes). AI prompts, code and conversation
              content are never read, buffered or uploaded.
            </p>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={Info} title="Troubleshooting" />
            <ul className="text-[11.5px] mut leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
              <li><b style={{ color: "var(--tx)" }}>Nothing in the monitor?</b> Ensure Monitoring is on; try the Firewall test console to generate real flows.</li>
              <li><b style={{ color: "var(--tx)" }}>DoH lookups fail?</b> Your network may block dns.google — switch provider above or in DNS Monitor.</li>
              <li><b style={{ color: "var(--tx)" }}>A rule broke an app?</b> Settings → Safe recovery, or delete the single rule on the Firewall page.</li>
              <li><b style={{ color: "var(--tx)" }}>Blocked everything by accident in strict mode?</b> Approvals queue on the Firewall page restores access one click at a time.</li>
              <li><b style={{ color: "var(--tx)" }}>Log sizes grow?</b> Lower retention and keep auto-cleanup on. Lifetime counters: {Math.round((counters.upTotal + counters.downTotal) / 1048576)} MB observed+simulated so far.</li>
            </ul>
          </Card>
        </div>
      </div>

      {confirmExport && (
        <ConfirmModal
          title="Export raw logs?"
          body="The JSON will contain application names, domains, IPs and timestamps from your machine. Keep the file private."
          confirmLabel="Export JSON"
          onClose={() => setConfirmExport(false)}
          onConfirm={exportLogs}
        />
      )}
      {confirmWipe && (
        <ConfirmModal
          danger
          title="Delete local data?"
          body="This permanently erases the PrivacyGuard database on this machine (logs, reports, notifications, cached lists). Rules and settings stored in preferences remain unless you also reset them. This cannot be undone."
          confirmLabel="Delete"
          onClose={() => setConfirmWipe(false)}
          onConfirm={() => { setConfirmWipe(false); clearLogs(); }}
        />
      )}
      {confirmReset && (
        <ConfirmModal
          title="Reset all rules?"
          body="Firewall rules, automation rules and per-app policies return to defaults (allow). Strict mode will be turned off. Logs are kept."
          confirmLabel="Reset rules"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            const s = useStore.getState();
            for (const r of [...s.fwRules]) s.removeFwRule(r.id);
            for (const a of Object.values(s.apps)) s.setPolicy(a.id, "allow", null);
            s.updateSettings({ strictMode: false });
            useStore.setState({ pendingApprovals: [] });
            s.notify({ kind: "ok", title: "Rules reset", body: "All policies restored to allow. You are not locked out." });
            setConfirmReset(false);
          }}
        />
      )}
    </>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <Icon size={14} style={{ color: "var(--acc)" }} />
      <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{title}</span>
    </div>
  );
}

function PermRow({ level, what }: { level: string; what: string }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" }}>
      <span className={`chip flex-none ${level.startsWith("Administrator") ? "chip-warn" : "chip-ok"}`}>{level}</span>
      <span className="text-[11.5px] mut leading-relaxed">{what}</span>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, onClose, onConfirm, danger }: { title: string; body: string; confirmLabel: string; onClose: () => void; onConfirm: () => void; danger?: boolean }) {
  return (
    <Modal onClose={onClose} width={440}>
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <AlertTriangle size={17} style={{ color: danger ? "var(--bad)" : "var(--warn)" }} />
          <h2 className="text-[15px] h-serif" style={{ color: "var(--tx)" }}>{title}</h2>
        </div>
        <p className="text-[12px] mut leading-relaxed mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? "btn-bad" : "btn-acc"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
