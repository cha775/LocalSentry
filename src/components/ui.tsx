import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { fmtNum } from "@/lib/core";

/* ---------------- layout ---------------- */

export function Card({ className, children, hover, style, onClick }: { className?: string; children: React.ReactNode; hover?: boolean; style?: React.CSSProperties; onClick?: () => void }) {
  return <div className={cn("card", hover && "card-hover", className)} style={style} onClick={onClick}>{children}</div>;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-5 anim-fade-up">
      <div>
        <h1 className="text-[19px] md:text-[22px] h-serif" style={{ color: "var(--tx)" }}>{title}</h1>
        {sub && <p className="text-[12px] md:text-[12.5px] mut mt-1 max-w-[720px]">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:flex-none">{right}</div>}
    </div>
  );
}

/* ---------------- toggle ---------------- */

export function Toggle({ on, onChange, bad }: { on: boolean; onChange: (b: boolean) => void; bad?: boolean }) {
  return (
    <button type="button" aria-pressed={on} className={cn("tgl", on && (bad ? "bad-on" : "on"))} onClick={() => onChange(!on)} />
  );
}

/* ---------------- stat tile ---------------- */

export function StatTile({ icon: Icon, label, value, sub, tone = "var(--tx)", spark, sparkTone }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone?: string;
  spark?: number[]; sparkTone?: string;
}) {
  return (
    <Card hover className="p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] dim">{label}</span>
        <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          <Icon size={13.5} style={{ color: tone }} />
        </div>
      </div>
      <div className="mono text-[24px] font-semibold leading-none" style={{ color: tone }}>{value}</div>
      {sub && <div className="text-[11px] mut mt-1.5">{sub}</div>}
      {spark && spark.length > 2 && (
        <div className="mt-2.5 -mb-1"><Sparkline data={spark} tone={sparkTone ?? tone} w={220} h={26} /></div>
      )}
    </Card>
  );
}

/* ---------------- status line ---------------- */

export function StatusLine({ on, label, detail, tone }: { on: boolean; label: string; detail?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 55%, transparent)" }}>
      <div className="flex items-center gap-2.5">
        <span className={cn("led", on ? (tone === "warn" ? "warn" : tone === "bad" ? "bad" : "on") : "off")} />
        <span className="text-[12.5px] font-medium" style={{ color: "var(--tx)" }}>{label}</span>
      </div>
      <span className="text-[11px] mut mono">{detail ?? (on ? "ACTIVE" : "OFF")}</span>
    </div>
  );
}

/* ---------------- animated number ---------------- */

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const fmt = format ?? ((n: number) => fmtNum(Math.round(n)));
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 550);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(display)}</>;
}

/* ---------------- charts ---------------- */

export function Sparkline({ data, tone = "var(--acc)", w = 120, h = 28, fill = true }: { data: number[]; tone?: string; w?: number; h?: number; fill?: boolean }) {
  const id = useId();
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * (h - 3)}`);
  const line = `M${pts.join(" L")}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke={tone} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function LiveBars({ allowed, blocked, w = 400, h = 64 }: { allowed: number[]; blocked: number[]; w?: number; h?: number }) {
  const max = Math.max(1, ...allowed.map((v, i) => v + (blocked[i] ?? 0)));
  const bw = w / allowed.length;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {allowed.map((v, i) => {
        const ah = (v / max) * (h - 4);
        const bh = ((blocked[i] ?? 0) / max) * (h - 4);
        return (
          <g key={i}>
            <rect x={i * bw + 0.5} y={h - ah} width={Math.max(1, bw - 1)} height={ah} rx="1" fill="var(--acc)" opacity={v > 0 ? 0.75 : 0.14} />
            <rect x={i * bw + 0.5} y={h - ah - bh} width={Math.max(1, bw - 1)} height={bh} rx="1" fill="var(--bad)" opacity={0.85} />
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ parts, size = 148, thickness = 15, centerLabel, centerValue }: {
  parts: { value: number; color: string; label: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerValue?: string;
}) {
  const total = Math.max(1, parts.reduce((n, p) => n + p.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="flex-none" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel2)" strokeWidth={thickness} />
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - 1.2)} ${c - len + 1.2}`} strokeDashoffset={-offset} strokeLinecap="butt"
              style={{ transition: "stroke-dasharray .6s, stroke-dashoffset .6s" }} />
          );
          offset += len;
          return el;
        })}
        <g style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
          <text x="50%" y="47%" textAnchor="middle" fill="var(--tx)" fontSize="21" fontWeight="600" fontFamily="JetBrains Mono">{centerValue}</text>
          <text x="50%" y="60%" textAnchor="middle" fill="var(--dim)" fontSize="8.5" letterSpacing="1.5">{centerLabel}</text>
        </g>
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-2 h-2 rounded-sm flex-none" style={{ background: p.color }} />
            <span className="mut truncate">{p.label}</span>
            <span className="mono ml-auto pl-3" style={{ color: "var(--tx)" }}>{fmtNum(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ items, format, tone = "var(--acc)" }: { items: { label: string; value: number; sub?: string; tone?: string }[]; format?: (n: number) => string; tone?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12px] truncate" style={{ color: "var(--tx)" }}>{it.label}</span>
            <span className="mono text-[11.5px] mut flex-none">{format ? format(it.value) : fmtNum(it.value)}{it.sub ? ` · ${it.sub}` : ""}</span>
          </div>
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "var(--panel2)" }}>
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.tone ?? tone, boxShadow: `0 0 10px ${it.tone ?? tone}`, transition: "width .7s cubic-bezier(.22,1,.36,1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- sortable tables ---------------- */

export type SortDir = "asc" | "desc";
export function useSorted() {
  const [key, setKey] = useState<string | null>(null);
  const [dir, setDir] = useState<SortDir>("desc");
  const toggle = (k: string) => {
    if (key === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  };
  const apply = <R,>(list: R[], get: (k: string, r: R) => string | number): R[] => {
    if (!key) return list;
    return [...list].sort((a, b) => {
      const va = get(key, a); const vb = get(key, b);
      return (va > vb ? 1 : va < vb ? -1 : 0) * (dir === "asc" ? 1 : -1);
    });
  };
  return { key, dir, toggle, apply };
}

export function Th({ k, label, sort, className, right }: { k: string; label: string; sort: { key: string | null; dir: SortDir; toggle: (k: string) => void }; className?: string; right?: boolean }) {
  const active = sort.key === k;
  return (
    <th className={className} style={right ? { textAlign: "right" } : undefined} onClick={() => sort.toggle(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} style={{ opacity: 0.25 }} />}
      </span>
    </th>
  );
}

/* ---------------- overlays ---------------- */

export function Drawer({ title, sub, onClose, children, footer }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="flex items-start justify-between p-5 pb-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <div>
            <h2 className="text-[16px] h-serif" style={{ color: "var(--tx)" }}>{title}</h2>
            {sub && <p className="text-[11.5px] mut mt-0.5 mono">{sub}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>ESC</button>
        </div>
        <div className="flex-1 overflow-y-auto scroll p-5">{children}</div>
        {footer && <div className="p-4 flex gap-2 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>{footer}</div>}
      </div>
    </>
  );
}

export function Modal({ onClose, children, width }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal">
      <div className="overlay" onClick={onClose} />
      <div className="modal-box" style={width ? { width } : undefined}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-11 h-11 rounded-xl grid place-items-center mb-3" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
        <Icon size={18} style={{ color: "var(--dim)" }} />
      </div>
      <div className="text-[13px] font-medium" style={{ color: "var(--tx)" }}>{title}</div>
      {hint && <div className="text-[11.5px] mut mt-1 max-w-[340px]">{hint}</div>}
    </div>
  );
}

export function Field({ label, hint, children, right }: { label: string; hint?: string; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5" style={{ borderBottom: "1px solid color-mix(in srgb, var(--line) 55%, transparent)" }}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium" style={{ color: "var(--tx)" }}>{label}</div>
        {hint && <div className="text-[11.5px] mut mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <div className="flex-none flex items-center gap-2">{children}{right}</div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={cn(value === o.value && "on")} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* memo helper for stable derived lists */
export function useDerived<T>(fn: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, deps);
}
