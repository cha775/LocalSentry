import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Bug, Check, Fish, Search, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtAgo, fmtNum } from "@/lib/core";
import { blocklistHit, resolveDoH } from "@/lib/engine";
import { RISK_COLOR, classifyDestination, scanUrl, type Risk, type ScanResult } from "@/lib/threats";
import { useStore } from "@/lib/store";

const SAMPLES = [
  "https://paypa1-secure-verify.top/login",
  "http://192.168.1.1@account-update.icu/confirm",
  "https://claude.ai",
  "https://microsoft-support.verify-account-login.cfd/unlock.apk",
];

export function Threats() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const addToList = useStore((s) => s.addToList);
  const notify = useStore((s) => s.notify);
  const connEvents = useStore((s) => s.connEvents);
  const apps = useStore((s) => s.apps);
  const setPolicy = useStore((s) => s.setPolicy);

  const scan = (value: string) => {
    const r = scanUrl(value, blocklistHit);
    setResult(r);
    setResolved(null);
    if (r.verdict === "dangerous") notify({ kind: "block", title: "Dangerous link detected", body: `${r.host ?? value} scored ${r.score}/100 — do not open it.` });
  };

  const verifyLive = async () => {
    if (!result?.host) return;
    setResolving(true);
    const r = await resolveDoH(result.host, "A");
    setResolved(
      r.event.status === "BLOCKED" ? `Guard refused the lookup (${r.event.blockedBy}) — the domain cannot be reached from this device.`
        : r.event.status === "NXDOMAIN" ? "Real resolver says this domain does not exist (NXDOMAIN) — typical of burner phishing hosts that were already taken down."
        : r.event.answers.length ? `Live and resolving to ${r.event.answers.slice(0, 2).join(", ")} — the host is active. Treat findings seriously.`
        : `Resolver returned ${r.event.status}.`
    );
    setResolving(false);
  };

  /* suspicious activity observed on this device */
  const suspicious = useMemo(() => {
    const map = new Map<string, { app: string; appId: string; dest: string; risk: Risk; reason: string; hits: number; last: number; blocked: boolean }>();
    for (const e of connEvents.slice(0, 600)) {
      if (e.scope === "localhost") continue;
      const hit = e.domain ? blocklistHit(e.domain) : null;
      const prof = classifyDestination(e.domain, hit?.cat ?? null, apps[e.appId]?.category);
      const bareIp = !e.domain;
      const malware = hit?.cat === "malware";
      const unknownApp = apps[e.appId]?.category === "unknown";
      const phishyName = e.domain ? scanUrl(e.domain, blocklistHit).score >= 35 : false;
      if (!(malware || bareIp || unknownApp || phishyName)) continue;
      const key = `${e.appId}|${e.domain ?? e.destIp}`;
      const reason = malware ? "On a malware / phishing blocklist"
        : phishyName ? "Hostname matches phishing heuristics"
        : unknownApp ? "Unidentified process contacting the internet"
        : "Bare-IP destination with no DNS name";
      const cur = map.get(key);
      if (cur) { cur.hits++; cur.last = Math.max(cur.last, e.ts); cur.blocked = cur.blocked || e.verdict === "blocked"; }
      else map.set(key, { app: e.appName, appId: e.appId, dest: e.domain ?? e.destIp, risk: malware ? "critical" : prof.risk, reason, hits: 1, last: e.ts, blocked: e.verdict === "blocked" });
    }
    return [...map.values()].sort((a, b) => b.last - a.last).slice(0, 24);
  }, [connEvents, apps]);

  return (
    <>
      <PageHeader
        title="Threats & Phishing"
        sub="Structural analysis of links and apps before you trust them, plus everything suspicious already seen on this device. Heuristics run entirely locally — the URL you paste is never uploaded anywhere."
        right={<span className="chip chip-bad"><Siren size={10} /> {suspicious.length} suspicious items</span>}
      />

      {/* scanner */}
      <Card className="p-4 mb-3 anim-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <Fish size={14} style={{ color: "var(--bad)" }} />
          <span className="text-[12.5px] font-semibold">Phishing link & app scanner</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-2">
          <div className="relative flex-1" style={{ minWidth: 220 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 dim" />
            <input className="input pl-8 mono" placeholder="Paste a link, domain or APK download URL…" value={url}
              onChange={(e) => setUrl(e.target.value.slice(0, 400))} onKeyDown={(e) => e.key === "Enter" && url.trim() && scan(url)} />
          </div>
          <button className="btn btn-acc" disabled={!url.trim()} onClick={() => scan(url)}>Scan</button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[10.5px] dim mr-1 self-center">Try:</span>
          {SAMPLES.map((s) => (
            <button key={s} className="tag" style={{ cursor: "pointer", maxWidth: 230 }} onClick={() => { setUrl(s); scan(s); }}>
              <span className="truncate">{s.replace(/^https?:\/\//, "")}</span>
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-4 anim-fade">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <div className="w-14 h-14 rounded-xl grid place-items-center flex-none"
                style={{ background: `color-mix(in srgb, ${VERDICT_TONE[result.verdict]} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${VERDICT_TONE[result.verdict]} 40%, transparent)` }}>
                <span className="mono text-[17px] font-semibold" style={{ color: VERDICT_TONE[result.verdict] }}>{result.score}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold uppercase tracking-wide" style={{ color: VERDICT_TONE[result.verdict] }}>{result.verdict}</div>
                <div className="mono text-[11.5px] mut truncate">{result.host ?? result.input}</div>
                <div className="text-[10.5px] dim">risk score {result.score}/100 from {result.findings.length} structural checks</div>
              </div>
              <div className="flex-1" />
              <button className="btn btn-sm" disabled={resolving || !result.host} onClick={verifyLive}>{resolving ? "Checking…" : "Verify live (DoH)"}</button>
              <button className="btn btn-sm btn-bad" disabled={!result.host} onClick={() => {
                addToList("denylist", result.host!);
                notify({ kind: "block", title: "Added to denylist", body: `${result.host} is now refused for every app on this device.` });
              }}><Ban size={11} /> Block it</button>
            </div>

            {resolved && <div className="rounded-lg px-3 py-2 mb-3 text-[11.5px] anim-fade" style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--tx)" }}>{resolved}</div>}

            <div className="flex flex-col gap-1.5">
              {result.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "var(--panel)", border: `1px solid color-mix(in srgb, ${RISK_COLOR[f.severity]} 22%, transparent)` }}>
                  {f.severity === "low" ? <ShieldCheck size={13} className="flex-none mt-0.5" style={{ color: "var(--ok)" }} /> : <AlertTriangle size={13} className="flex-none mt-0.5" style={{ color: RISK_COLOR[f.severity] }} />}
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: "var(--tx)" }}>{f.title}</div>
                    <div className="text-[11px] mut leading-relaxed">{f.detail}</div>
                  </div>
                  <span className="chip ml-auto flex-none" style={{ color: RISK_COLOR[f.severity], borderColor: `color-mix(in srgb, ${RISK_COLOR[f.severity]} 30%, transparent)` }}>{f.severity}</span>
                </div>
              ))}
            </div>
            <p className="text-[10.5px] dim mt-2.5 leading-relaxed">
              Structural analysis cannot prove a site is safe — a clean score only means nothing suspicious was found in the
              address itself. Never install APKs from links, and never enter credentials from a message you didn't expect.
            </p>
          </div>
        )}
      </Card>

      {/* suspicious observed */}
      <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase dim mb-2">Suspicious activity on this device</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {suspicious.map((s, i) => (
          <Card key={i} hover className="p-3.5 anim-fade-up">
            <div className="flex items-start gap-2.5">
              <Bug size={14} className="flex-none mt-0.5" style={{ color: RISK_COLOR[s.risk] }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx)" }}>{s.app}</span>
                  <span className="dim text-[11px]">→</span>
                  <span className="mono text-[11px]" style={{ color: RISK_COLOR[s.risk] }}>{s.dest}</span>
                </div>
                <div className="text-[11px] mut mt-0.5">{s.reason}</div>
                <div className="mono text-[10px] dim mt-1">{fmtNum(s.hits)} attempts · {fmtAgo(s.last)}</div>
              </div>
              <div className="flex flex-col gap-1.5 flex-none">
                {s.blocked ? <span className="chip chip-ok"><Check size={9} /> blocked</span>
                  : <button className="btn btn-sm btn-bad" onClick={() => { setPolicy(s.appId, "block"); notify({ kind: "block", title: "Blocked", body: `${s.app} is now cut off from the network.` }); }}>Block</button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {suspicious.length === 0 && <Card><EmptyState icon={ShieldAlert} title="Nothing suspicious observed" hint="Malware-list hits, phishing-shaped hostnames, unidentified processes and bare-IP contacts will appear here." /></Card>}
    </>
  );
}

const VERDICT_TONE: Record<string, string> = {
  dangerous: "var(--bad)", suspicious: "var(--warn)", caution: "var(--info)", clean: "var(--ok)",
};
