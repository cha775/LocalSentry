import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { ConnEvent } from "@/lib/core";

/* Live "traffic constellation" — canvas visualization of the event stream.
   Apps sit on the left arc, destinations on the right arc; packets travel
   between them through the local machine core. Blocked packets die red. */

interface Node {
  id: string;
  label: string;
  side: "app" | "dest";
  x: number; y: number;
  hits: number;
  lastSeen: number;
  cat: string;
}
interface Particle {
  from: Node; to: Node;
  t: number; speed: number;
  blocked: boolean; simulated: boolean;
}

const CAT_COLOR: Record<string, string> = {
  "cloud-ai": "#8fa2ff", "local-ai": "#43f0b0", "hybrid-ai": "#43f0b0", "ai-devtool": "#8fa2ff",
  browser: "#54b6ff", system: "#93a1b3", other: "#93a1b3", unknown: "#ffb545",
};

export function Constellation() {
  const ref = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const newestId = useStore((s) => (s.connEvents.length ? s.connEvents[0].id : 0));

  // pull newest events into the particle queue
  useEffect(() => {
    const s = useStore.getState();
    const fresh = s.connEvents.slice(0, 2);
    for (const e of fresh) pushEvent(e, nodesRef.current, particlesRef.current);
  }, [newestId]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let sweep = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

    const draw = () => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const now = performance.now();

      // ambient radar sweep
      sweep = (sweep + 0.004) % (Math.PI * 2);
      const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, "rgba(67,240,176,0.05)");
        grad.addColorStop(0.08, "rgba(67,240,176,0)");
        grad.addColorStop(1, "rgba(67,240,176,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(W, H) * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }

      // rings
      ctx.strokeStyle = css("--line");
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      for (const rr of [0.2, 0.34, 0.47]) {
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);

      layout(nodesRef.current, W, H);
      // prune stale
      for (const [k, n] of nodesRef.current) if (now - n.lastSeen > 50_000) nodesRef.current.delete(k);

      // core (this machine)
      const pulse = 1 + Math.sin(now / 500) * 0.08;
      ctx.beginPath(); ctx.arc(cx, cy, 26 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = css("--acc-dim"); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 26 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = css("--acc"); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = css("--acc"); ctx.shadowColor = css("--acc"); ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = "600 8.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = css("--dim");
      ctx.textAlign = "center";
      ctx.fillText("THIS PC", cx, cy + 40);

      // edges
      const nodes = [...nodesRef.current.values()];
      for (const n of nodes) {
        const t = Math.min(1, (now - n.lastSeen) / 5000);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.quadraticCurveTo(cx + (n.x - cx) * 0.14, cy + (n.y - cy) * 0.14, cx, cy);
        ctx.strokeStyle = css("--line2");
        ctx.globalAlpha = 0.55 - t * 0.4;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // particles
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.t += p.speed;
        const maxT = p.blocked ? 0.5 : 1;
        if (p.t >= maxT + 0.12) { ps.splice(i, 1); continue; }
        const tt = Math.min(p.t, maxT);
        const x = quad(p.from.x, cx + (p.from.x - cx) * 0.14, p.to.side === "dest" ? p.to.x : cx, tt * 2);
        const y = quad(p.from.y, cy + (p.from.y - cy) * 0.14, p.to.side === "dest" ? p.to.y : cy, tt * 2);
        // second leg to destination
        let fx = x, fy = y;
        if (tt > 0.5 && !p.blocked) {
          const u = (tt - 0.5) * 2;
          fx = quad(cx, cx + (p.to.x - cx) * 0.14, p.to.x, u);
          fy = quad(cy, cy + (p.to.y - cy) * 0.14, p.to.y, u);
        }
        ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = p.blocked ? css("--bad") : p.simulated ? css("--acc2") : css("--acc");
        ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 7;
        ctx.fill(); ctx.shadowBlur = 0;
        if (p.blocked && p.t > maxT) {
          ctx.strokeStyle = css("--bad"); ctx.lineWidth = 1.4;
          const r2 = 4 + (p.t - maxT) * 40;
          ctx.beginPath(); ctx.arc(fx, fy, r2, 0, Math.PI * 2); ctx.globalAlpha = Math.max(0, 1 - (p.t - maxT) * 8); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }

      // nodes
      for (const n of nodes) {
        const color = n.side === "app" ? (CAT_COLOR[n.cat] ?? css("--info")) : n.cat === "blocked" ? css("--bad") : css("--info");
        const r = n.side === "app" ? 5 : 3.4 + Math.min(3, n.hits * 0.18);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = color + "22"; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
        if (n.side === "app" || n.hits > 2) {
          ctx.font = "500 9px 'JetBrains Mono', monospace";
          ctx.fillStyle = css("--mut");
          ctx.textAlign = n.side === "app" ? "right" : "left";
          ctx.fillText(trunc(n.label, 22), n.x + (n.side === "app" ? -r - 6 : r + 6), n.y + 3);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="w-full h-full" style={{ display: "block" }} />;
}

function quad(a: number, b: number, c: number, t: number) {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function pushEvent(e: ConnEvent, nodes: Map<string, Node>, particles: Particle[]) {
  const now = performance.now();
  let appNode = nodes.get("a:" + e.appId);
  if (!appNode) {
    appNode = { id: e.appId, label: e.appName, side: "app", x: 0, y: 0, hits: 0, lastSeen: now, cat: catOf(e.appId) };
    nodes.set("a:" + e.appId, appNode);
  }
  appNode.lastSeen = now; appNode.hits++;
  const destId = "d:" + (e.domain ?? e.destIp);
  let destNode = nodes.get(destId);
  if (!destNode) {
    destNode = { id: destId, label: e.domain ?? e.destIp, side: "dest", x: 0, y: 0, hits: 0, lastSeen: now, cat: e.verdict === "blocked" ? "blocked" : "dest" };
    nodes.set(destId, destNode);
  }
  destNode.lastSeen = now; destNode.hits++;
  if (e.verdict === "blocked") destNode.cat = "blocked";
  if (particles.length < 90) particles.push({ from: appNode, to: destNode, t: 0, speed: 0.012 + Math.random() * 0.012, blocked: e.verdict === "blocked", simulated: e.simulated });
}

function catOf(appId: string): string {
  const a = useStore.getState().apps[appId];
  return a?.category ?? "other";
}

function layout(nodes: Map<string, Node>, W: number, H: number) {
  const apps = [...nodes.values()].filter((n) => n.side === "app");
  const dests = [...nodes.values()].filter((n) => n.side === "dest").sort((a, b) => b.hits - a.hits).slice(0, 12);
  const cx = W / 2, cy = H / 2;
  const radX = W * 0.36, radY = H * 0.38;
  apps.forEach((n, i) => {
    const ang = Math.PI * (0.6 + (i / Math.max(1, apps.length - 1)) * 0.8); // left arc
    const tx = cx + Math.cos(ang) * radX, ty = cy + Math.sin(ang) * radY;
    n.x += (tx - n.x) * 0.08; n.y += (ty - n.y) * 0.08;
    if (!n.x && !n.y) { n.x = tx; n.y = ty; }
  });
  dests.forEach((n, i) => {
    const ang = -Math.PI * 0.4 + (i / Math.max(1, dests.length - 1)) * Math.PI * 0.8; // right arc
    const tx = cx + Math.cos(ang) * radX, ty = cy + Math.sin(ang) * radY;
    n.x += (tx - n.x) * 0.08; n.y += (ty - n.y) * 0.08;
    if (!n.x && !n.y) { n.x = tx; n.y = ty; }
  });
}
