import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, Camera, Cctv, Clipboard, Eye, FileCode2, Image, MapPin,
  Mic, ShieldAlert, Siren, Video,
} from "lucide-react";
import { Card, EmptyState, PageHeader, Segmented } from "@/components/ui";
import { fmtAgo, fmtBytes, fmtNum, fmtTime, type ConnEvent } from "@/lib/core";
import { blocklistHit } from "@/lib/engine";
import {
  DATA_LABEL, RISK_COLOR, RISK_ORDER, SENSITIVE_PERMISSIONS,
  classifyDestination, type DataCategory, type Risk,
} from "@/lib/threats";
import { useStore } from "@/lib/store";

interface Flow {
  key: string;
  app: string;
  appId: string;
  domain: string;
  risk: Risk;
  purpose: string;
  categories: DataCategory[];
  basis: string;
  warning?: string;
  aiModel?: string;
  hits: number;
  up: number;
  down: number;
  last: number;
  blocked: number;
}

export function DataMonitor() {
  const connEvents = useStore((s) => s.connEvents);
  const apps = useStore((s) => s.apps);
  const search = useStore((s) => s.search);
  const setPolicy = useStore((s) => s.setPolicy);
  const addToList = useStore((s) => s.addToList);
  const notify = useStore((s) => s.notify);
  const [filter, setFilter] = useState<"all" | "ai" | "risky">("risky");

  const flows = useMemo(() => {
    const map = new Map<string, Flow>();
    for (const e of connEvents.slice(0, 600)) {
      const dest = e.domain ?? e.destIp;
      if (e.scope === "localhost") continue;
      const key = `${e.appId}|${dest}`;
      const listHit = e.domain ? blocklistHit(e.domain) : null;
      const prof = classifyDestination(e.domain, listHit?.cat ?? null, apps[e.appId]?.category);
      const cur = map.get(key);
      if (cur) {
        cur.hits++; cur.up += e.bytesUp; cur.down += e.bytesDown;
        cur.last = Math.max(cur.last, e.ts);
        if (e.verdict === "blocked") cur.blocked++;
      } else {
        map.set(key, {
          key, app: e.appName, appId: e.appId, domain: dest, risk: prof.risk, purpose: prof.purpose,
          categories: prof.categories, basis: prof.basis, warning: prof.warning, aiModel: prof.aiModel,
          hits: 1, up: e.bytesUp, down: e.bytesDown, last: e.ts, blocked: e.verdict === "blocked" ? 1 : 0,
        });
      }
    }
    let list = [...map.values()];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((f) => f.app.toLowerCase().includes(q) || f.domain.includes(q));
    if (filter === "ai") list = list.filter((f) => f.aiModel || apps[f.appId]?.ai);
    if (filter === "risky") list = list.filter((f) => RISK_ORDER[f.risk] >= 2);
    return list.sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk] || b.hits - a.hits);
  }, [connEvents, apps, search, filter]);

  const totals = useMemo(() => {
    const cats = new Map<DataCategory, number>();
    let critical = 0, aiBytes = 0;
    for (const f of flows) {
      for (const c of f.categories) cats.set(c, (cats.get(c) ?? 0) + f.hits);
      if (f.risk === "critical") critical++;
      if (f.aiModel) aiBytes += f.up;
    }
    return { cats: [...cats.entries()].sort((a, b) => b[1] - a[1]), critical, aiBytes };
  }, [flows]);

  return (
    <>
      <PageHeader
        title="Data Monitor"
        sub="What categories of data each destination is built to receive, and where it goes. PrivacyGuard never decrypts traffic — classifications are vendor-declared or inferred, and always labeled as such."
        right={<span className="chip chip-bad"><Siren size={10} /> {totals.critical} critical destinations</span>}
      />

      <SensorMonitor />

      <div className="flex items-center gap-2.5 my-4 flex-wrap">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "risky", label: "Risky only" }, { value: "ai", label: "AI destinations" }, { value: "all", label: "Everything" }]} />
        <div className="flex-1" />
        <span className="text-[11px] mono dim">{flows.length} destination{flows.length === 1 ? "" : "s"}</span>
      </div>

      {totals.cats.length > 0 && (
        <Card className="p-4 mb-3">
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase dim mb-2.5">Data categories leaving this device</div>
          <div className="flex flex-wrap gap-1.5">
            {totals.cats.map(([c, n]) => (
              <span key={c} className="tag" style={{ color: CAT_TONE[c] ?? "var(--mut)", borderColor: `color-mix(in srgb, ${CAT_TONE[c] ?? "var(--line2)"} 30%, transparent)` }}>
                {CAT_ICON[c]} {DATA_LABEL[c]} <span className="dim">×{fmtNum(n)}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {flows.map((f) => (
          <Card key={f.key} hover className="p-4 anim-fade-up">
            <div className="flex items-start gap-2.5 mb-2">
              <span className="w-2 h-2 rounded-full flex-none mt-1.5" style={{ background: RISK_COLOR[f.risk], boxShadow: `0 0 8px ${RISK_COLOR[f.risk]}` }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>{f.app}</span>
                  <span className="dim text-[11px]">→</span>
                  <span className="mono text-[11.5px]" style={{ color: RISK_COLOR[f.risk] }}>{f.domain}</span>
                </div>
                <div className="text-[11px] mut mt-0.5">{f.purpose}</div>
              </div>
              <span className="chip flex-none" style={{ color: RISK_COLOR[f.risk], borderColor: `color-mix(in srgb, ${RISK_COLOR[f.risk]} 35%, transparent)` }}>{f.risk}</span>
            </div>

            {f.aiModel && (
              <div className="rounded-lg px-2.5 py-1.5 mb-2 text-[10.5px] flex items-center gap-2" style={{ background: "var(--acc2-dim)", border: "1px solid color-mix(in srgb, var(--acc2) 25%, transparent)" }}>
                <ShieldAlert size={12} style={{ color: "var(--acc2)" }} className="flex-none" />
                <span style={{ color: "var(--tx)" }}>AI model destination — <b>{f.aiModel}</b></span>
              </div>
            )}

            <div className="flex flex-wrap gap-1 mb-2">
              {f.categories.map((c) => (
                <span key={c} className="tag" style={{ fontSize: 9.5, color: CAT_TONE[c] ?? "var(--mut)" }}>{CAT_ICON[c]} {DATA_LABEL[c]}</span>
              ))}
              <span className="tag" style={{ fontSize: 9.5 }}>basis: {f.basis}</span>
            </div>

            {f.warning && (
              <div className="flex gap-2 text-[11px] leading-relaxed mb-2.5 rounded-lg px-2.5 py-2" style={{ background: "var(--bad-dim)", border: "1px solid color-mix(in srgb, var(--bad) 22%, transparent)" }}>
                <AlertTriangle size={12} className="flex-none mt-0.5" style={{ color: "var(--bad)" }} />
                <span style={{ color: "var(--tx)" }}>{f.warning}</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-[10.5px] dim">{fmtNum(f.hits)} flows · ↑{fmtBytes(f.up)} ↓{fmtBytes(f.down)} · {fmtAgo(f.last)}</span>
              {f.blocked > 0 && <span className="chip chip-bad" style={{ height: 17, fontSize: 9 }}>{f.blocked} blocked</span>}
              <div className="flex-1" />
              <button className="btn btn-sm btn-bad" onClick={() => {
                addToList("denylist", f.domain);
                notify({ kind: "block", title: "Destination blocked", body: `${f.domain} added to your denylist — no app can reach it now.` });
              }}><Ban size={11} /> Block destination</button>
              <button className="btn btn-sm" onClick={() => {
                setPolicy(f.appId, "block");
                notify({ kind: "block", title: "App blocked", body: `${f.app} can no longer send data anywhere.` });
              }}>Block app</button>
            </div>
          </Card>
        ))}
      </div>

      {flows.length === 0 && <Card><EmptyState icon={Eye} title="No matching data flows" hint="Switch to “Everything”, or wait for applications to transmit." /></Card>}

      <Card className="p-3.5 mt-3">
        <p className="text-[11px] mut leading-relaxed">
          <b style={{ color: "var(--tx)" }}>How to read this.</b> “Declared” means the endpoint is vendor-documented for that purpose
          (e.g. <span className="mono">api.anthropic.com</span> exists to receive prompts). “Inferred” means the category comes from a
          blocklist classification or the app type. “Unknown” means PrivacyGuard will not guess. Byte counts are real transfer
          volumes — but the <i>content</i> inside TLS is never read, and no screenshots, files or prompts are ever captured by this app.
        </p>
      </Card>
    </>
  );
}

const CAT_TONE: Partial<Record<DataCategory, string>> = {
  "prompt-text": "var(--acc2)", code: "var(--acc2)", files: "var(--acc2)", images: "var(--acc2)",
  voice: "var(--bad)", video: "var(--bad)", location: "var(--bad)", contacts: "var(--bad)",
  "ad-id": "var(--warn)", browsing: "var(--warn)", analytics: "var(--info)", "crash-logs": "var(--info)",
  auth: "var(--bad)", clipboard: "var(--bad)", "device-id": "var(--info)", unknown: "var(--dim)",
};
const CAT_ICON: Partial<Record<DataCategory, string>> = {
  "prompt-text": "✎", code: "{ }", files: "▤", images: "▣", voice: "♪", video: "▶",
  location: "◉", contacts: "☏", "ad-id": "◆", browsing: "⌘", analytics: "∿",
  "crash-logs": "⚠", auth: "🔑", clipboard: "⧉", "device-id": "#", unknown: "?",
};

/* ---------------- live sensor / permission monitor (real browser APIs) ---------------- */

interface PermState { name: string; label: string; state: string; why: string }

function SensorMonitor() {
  const [perms, setPerms] = useState<PermState[]>([]);
  const [cameraLive, setCameraLive] = useState(false);
  const [devices, setDevices] = useState<{ cams: number; mics: number }>({ cams: 0, mics: 0 });
  const [log, setLog] = useState<{ ts: number; text: string; tone: string }[]>([]);
  const notify = useStore((s) => s.notify);

  const refresh = async () => {
    const out: PermState[] = [];
    for (const p of SENSITIVE_PERMISSIONS) {
      let state = "unsupported";
      try {
        const r = await navigator.permissions?.query({ name: p.name as PermissionName });
        state = r?.state ?? "unsupported";
      } catch { state = "unsupported"; }
      out.push({ name: String(p.name), label: p.label, state, why: p.why });
    }
    setPerms(out);
    try {
      const d = await navigator.mediaDevices?.enumerateDevices?.();
      if (d) setDevices({ cams: d.filter((x) => x.kind === "videoinput").length, mics: d.filter((x) => x.kind === "audioinput").length });
    } catch { /* unavailable */ }
  };

  useEffect(() => { refresh(); const iv = setInterval(refresh, 8000); return () => clearInterval(iv); }, []);

  const testCamera = async () => {
    setLog((l) => [{ ts: Date.now(), text: "requesting camera access (real getUserMedia call)…", tone: "var(--mut)" }, ...l].slice(0, 8));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraLive(true);
      const label = stream.getVideoTracks()[0]?.label || "default camera";
      setLog((l) => [{ ts: Date.now(), text: `⬤ CAMERA ACTIVE — "${label}". Guard detected the live stream.`, tone: "var(--bad)" }, ...l].slice(0, 8));
      notify({ kind: "block", title: "Camera activated", body: `A live video stream opened (${label}). PrivacyGuard detected it in real time.` });
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        setCameraLive(false);
        setLog((l) => [{ ts: Date.now(), text: "camera stream stopped by the guard — no frames were stored", tone: "var(--ok)" }, ...l].slice(0, 8));
        refresh();
      }, 3500);
    } catch (err) {
      setLog((l) => [{ ts: Date.now(), text: `camera access denied/unavailable — ${err instanceof Error ? err.name : "error"}`, tone: "var(--warn)" }, ...l].slice(0, 8));
    }
  };

  const toneFor = (s: string) => (s === "granted" ? "var(--bad)" : s === "prompt" ? "var(--warn)" : s === "denied" ? "var(--ok)" : "var(--dim)");
  const iconFor = (n: string) =>
    n === "camera" ? <Camera size={13} /> : n === "microphone" ? <Mic size={13} /> : n === "geolocation" ? <MapPin size={13} />
      : n === "clipboard-read" ? <Clipboard size={13} /> : <Eye size={13} />;

  return (
    <Card className="p-4 anim-fade-up" style={cameraLive ? { borderColor: "var(--bad)", boxShadow: "0 0 0 1px var(--bad)" } : undefined}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Cctv size={14} style={{ color: cameraLive ? "var(--bad)" : "var(--acc)" }} />
        <span className="text-[12.5px] font-semibold">Sensitive sensor access — live</span>
        {cameraLive && <span className="chip chip-bad blink"><Video size={10} /> CAMERA IN USE</span>}
        <div className="flex-1" />
        <span className="mono text-[10px] dim">{devices.cams} camera{devices.cams === 1 ? "" : "s"} · {devices.mics} mic{devices.mics === 1 ? "" : "s"} detected</span>
      </div>
      <p className="text-[11px] mut leading-relaxed mb-3">
        Real permission states for this app context, polled every 8 s. <b style={{ color: "var(--tx)" }}>Granted</b> means access
        can be taken without asking again — the “unknowingly” case. Use the test to watch detection fire live.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">
        {perms.map((p) => (
          <div key={p.name} className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel)", border: `1px solid ${p.state === "granted" ? "color-mix(in srgb, var(--bad) 35%, transparent)" : "var(--line)"}` }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: toneFor(p.state) }}>
              {iconFor(p.name)}
              <span className="text-[11.5px] font-medium" style={{ color: "var(--tx)" }}>{p.label}</span>
            </div>
            <div className="mono text-[10px] uppercase tracking-wider" style={{ color: toneFor(p.state) }}>{p.state}</div>
            <div className="text-[9.5px] dim mt-1 leading-snug">{p.why}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button className="btn btn-sm btn-bad" onClick={testCamera} disabled={cameraLive}><Camera size={12} /> Test camera-access detection</button>
        <button className="btn btn-sm" onClick={refresh}>Re-scan permissions</button>
        <span className="text-[10.5px] dim">Opens a real stream for 3 s, then the guard force-stops it. No frames leave this device.</span>
      </div>
      {log.length > 0 && (
        <div className="logviewer mt-3 flex flex-col gap-0.5">
          {log.map((l, i) => <div key={l.ts + ":" + i} style={{ color: l.tone }}><span className="dim">{fmtTime(l.ts)}</span> {l.text}</div>)}
        </div>
      )}
      <p className="text-[10.5px] dim mt-3 leading-relaxed">
        Scope note: a web app can only observe sensor access inside its own context. OS-wide “which app just turned on your
        camera” requires the packaged mobile build (Android <span className="mono">AppOpsManager</span> / iOS indicator APIs) — wired to this
        same panel, never faked here.
      </p>
    </Card>
  );
}

export function riskOfEvent(e: ConnEvent, appCategory?: string): Risk {
  const hit = e.domain ? blocklistHit(e.domain) : null;
  return classifyDestination(e.domain, hit?.cat ?? null, appCategory).risk;
}

void Image; void FileCode2;
