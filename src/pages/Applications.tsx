import { useMemo, useState } from "react";
import { AppWindow, BrainCircuit, Plus, Radar } from "lucide-react";
import { EmptyState, Modal, PageHeader, Segmented, Th, useSorted } from "@/components/ui";
import type { AICategory, AppProfile, Policy, RuntimeApp } from "@/lib/core";
import { AI_CATEGORY_LABEL, POLICY_LABEL, fmtAgo, fmtBytes, fmtNum } from "@/lib/core";
import { useStore } from "@/lib/store";

const CATS: (AICategory | "all")[] = ["all", "cloud-ai", "local-ai", "hybrid-ai", "ai-devtool", "browser", "system", "other", "unknown"];

export function Applications() {
  const apps = useStore((s) => s.apps);
  const search = useStore((s) => s.search);
  const setPolicy = useStore((s) => s.setPolicy);
  const classify = useStore((s) => s.classifyApp);
  const setPage = useStore((s) => s.setPage);
  const setSearch = useStore((s) => s.setSearch);
  const [cat, setCat] = useState<AICategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const sort = useSorted();

  const rows = useMemo(() => {
    let list = Object.values(apps);
    if (cat !== "all") list = list.filter((a) => a.category === cat);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => a.name.toLowerCase().includes(q) || a.exe.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) || a.publisher.toLowerCase().includes(q));
    return sort.apply(list, (k, a) => {
      switch (k) {
        case "name": return a.name.toLowerCase();
        case "attempts": return a.attempts;
        case "blocked": return a.blocked;
        case "up": return a.bytesUp;
        case "down": return a.bytesDown;
        case "seen": return a.lastSeen ?? 0;
        default: return a.name;
      }
    });
  }, [apps, cat, search, sort.key, sort.dir]);

  return (
    <>
      <PageHeader
        title="Applications"
        sub="Every process observed using the network, with its access policy and AI classification. Policies are enforced on all new connection attempts. Manual re-classification is stored locally."
        right={<button className="btn btn-acc" onClick={() => setAdding(true)}><Plus size={13} /> Track an application</button>}
      />

      <div className="flex items-center gap-3 mb-3 flex-wrap anim-fade-up">
        <Segmented
          value={cat}
          onChange={(v) => setCat(v)}
          options={CATS.map((c) => ({ value: c, label: c === "all" ? `All (${Object.keys(apps).length})` : AI_CATEGORY_LABEL[c] }))}
        />
        <div className="flex-1" />
        <span className="text-[11px] dim mono">{rows.length} shown</span>
      </div>

      <div className="card overflow-hidden anim-fade-up">
        <div className="overflow-x-auto scroll">
          <table className="tbl" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <Th k="name" label="Application" sort={sort} />
                <th>Category</th>
                <th>Policy</th>
                <Th k="attempts" label="Attempts" sort={sort} right />
                <Th k="blocked" label="Blocked" sort={sort} right />
                <Th k="up" label="Sent" sort={sort} right />
                <Th k="down" label="Received" sort={sort} right />
                <Th k="seen" label="Last seen" sort={sort} />
                <th style={{ textAlign: "right" }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => <AppRow key={a.id} a={a} setPolicy={setPolicy} classify={classify} onMonitor={() => { setSearch(a.name); setPage("monitor"); }} />)}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState icon={AppWindow} title="No applications match" hint="Try clearing the search or category filter." />}
      </div>

      <p className="text-[11px] dim mt-3 leading-relaxed">
        Attribution note: demo-plane rows in this sandbox are labeled per the catalog; on the native desktop build this table is populated from
        GetExtendedTcpTable/GetExtendedUdpTable + WFP app-id mapping. A process that cannot be attributed is always shown as “Unknown application”, never guessed.
      </p>

      {adding && <AddAppModal onClose={() => setAdding(false)} />}
    </>
  );
}

function AppRow({ a, setPolicy, classify, onMonitor }: { a: RuntimeApp; setPolicy: (id: string, p: Policy, t?: number | null) => void; classify: (id: string, c: AICategory) => void; onMonitor: () => void }) {
  const tempLeft = a.policy === "temp-allow" && a.tempUntil ? Math.max(0, a.tempUntil - Date.now()) : 0;
  return (
    <tr className={a.policy === "block" ? "blocked-row" : undefined}>
      <td>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg grid place-items-center flex-none" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
            {a.ai ? <BrainCircuit size={13} style={{ color: a.category === "cloud-ai" ? "var(--acc2)" : "var(--acc)" }} /> : <AppWindow size={13} className="mut" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[12.5px]" style={{ color: "var(--tx)" }}>{a.name}</span>
              {a.active && <span className="led on" />}
              {a.userClassified && <span className="chip chip-info" style={{ height: 16, fontSize: 8.5, padding: "0 6px" }}>you</span>}
            </div>
            <div className="dim mono text-[10px] truncate max-w-[290px] mt-0.5">{a.exe} · {a.path}</div>
          </div>
        </div>
      </td>
      <td>
        <select className="input" style={{ height: 27, fontSize: 11.5, width: 128 }} value={a.category} onChange={(e) => classify(a.id, e.target.value as AICategory)}>
          {(["cloud-ai", "local-ai", "hybrid-ai", "ai-devtool", "browser", "system", "other", "unknown"] as AICategory[]).map((c) => (
            <option key={c} value={c}>{AI_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="input"
          style={{ height: 27, fontSize: 11.5, width: 140, color: a.policy === "block" ? "var(--bad)" : a.policy === "local-only" ? "var(--warn)" : undefined }}
          value={a.policy}
          onChange={(e) => {
            const p = e.target.value as Policy;
            setPolicy(a.id, p, p === "temp-allow" ? Date.now() + 30 * 60_000 : null);
          }}
        >
          {(Object.keys(POLICY_LABEL) as Policy[]).map((p) => <option key={p} value={p}>{POLICY_LABEL[p]}</option>)}
        </select>
        {tempLeft > 0 && <div className="text-[9.5px] warn mono mt-1">{Math.ceil(tempLeft / 60000)} min left</div>}
      </td>
      <td className="mono" style={{ textAlign: "right", color: "var(--tx)" }}>{fmtNum(a.attempts)}</td>
      <td className="mono" style={{ textAlign: "right", color: a.blocked > 0 ? "var(--bad)" : undefined }}>{fmtNum(a.blocked)}</td>
      <td className="mono" style={{ textAlign: "right" }}>{fmtBytes(a.bytesUp)}</td>
      <td className="mono" style={{ textAlign: "right" }}>{fmtBytes(a.bytesDown)}</td>
      <td className="mono text-[11px]">{a.lastSeen ? fmtAgo(a.lastSeen) : "never"}</td>
      <td style={{ textAlign: "right" }}>
        <button className="btn btn-ghost btn-sm" onClick={onMonitor}><Radar size={12} /> Traffic</button>
      </td>
    </tr>
  );
}

function AddAppModal({ onClose }: { onClose: () => void }) {
  const addCustomApp = useStore((s) => s.addCustomApp);
  const notify = useStore((s) => s.notify);
  const [name, setName] = useState("");
  const [exe, setExe] = useState("");
  const [path, setPath] = useState("");
  const [category, setCategory] = useState<AICategory>("other");
  const [domains, setDomains] = useState("");

  const valid = name.trim().length > 1 && exe.trim().length > 1;

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <h2 className="text-[16px] h-serif mb-1" style={{ color: "var(--tx)" }}>Track an application</h2>
        <p className="text-[11.5px] mut mb-4">Manually classify a process so PrivacyGuard can attribute and control its traffic. Input is validated; nothing is executed.</p>
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[11px] dim">Display name</span>
            <input className="input mt-1" placeholder="e.g. My Coding Agent" value={name} onChange={(e) => setName(e.target.value.slice(0, 64))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] dim">Executable</span>
              <input className="input mt-1 mono" placeholder="agent.exe" value={exe} onChange={(e) => setExe(e.target.value.replace(/[^\w.\- ]/g, "").slice(0, 64))} />
            </label>
            <label className="block">
              <span className="text-[11px] dim">Classification</span>
              <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value as AICategory)}>
                {(["cloud-ai", "local-ai", "hybrid-ai", "ai-devtool", "other", "unknown"] as AICategory[]).map((c) => <option key={c} value={c}>{AI_CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] dim">Install path</span>
            <input className="input mt-1 mono" placeholder="C:\\Program Files\\Agent\\agent.exe" value={path} onChange={(e) => setPath(e.target.value.slice(0, 200))} />
          </label>
          <label className="block">
            <span className="text-[11px] dim">Known destinations (comma separated, optional)</span>
            <input className="input mt-1 mono" placeholder="api.example.com, 127.0.0.1" value={domains} onChange={(e) => setDomains(e.target.value.slice(0, 400))} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-acc"
            disabled={!valid}
            onClick={() => {
              const profile: AppProfile = {
                id: "custom-" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24),
                name: name.trim(), exe: exe.trim(), path: path.trim() || "(path not provided)", publisher: "User added",
                category, ai: category.includes("ai"), pid: 0,
                knownDomains: domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).slice(0, 20),
                weight: 0,
              };
              if (!profile.knownDomains.length) profile.knownDomains = ["api.example.com"];
              addCustomApp(profile);
              notify({ kind: "ok", title: "Application tracked", body: `${profile.name} will appear in monitors when it connects.` });
              onClose();
            }}
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
