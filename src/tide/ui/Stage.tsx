"use client";
// The Blocktide stage: one canvas for the 8×8 board and the tray of three pieces. Blocks are glossy sea-glass jelly
// (pre-drawn once per colour and size, so phones stay smooth). Drag a piece up from the tray — on touch it floats
// above your finger so you can see where it goes — and a ghost shows where it lands, lighting up the lines it would
// clear. Clears burst into spinning jelly bits and bubbles, with a line flash, score pop-ups and a little shake.
// The loop only runs while something moves.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { canPlace, N, shapeOf, wouldClear, type Board, type PlaceResult } from "../board";
import { JELLY, type Piece } from "../shapes";

export interface StageHandle {
  burst: (r: PlaceResult, points: number, praise: string, combo: number) => void;
  shake: (power?: number) => void;
}
export interface StageProps {
  board: Board;
  tray: (Piece | null)[];
  glow: string;
  locked: boolean;
  /** which tray pieces fit somewhere (others are dimmed) */
  fits: boolean[];
  onPlace: (slot: number, r: number, c: number) => void;
  onPick?: (slot: number) => void;
  onDrop?: (ok: boolean) => void;
}

interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; life: number; max: number; color: number; kind: "bit" | "bubble" | "spark" }
interface Floater { x: number; y: number; text: string; life: number; max: number; big: boolean; color: string }
interface Flash { rows: number[]; cols: number[]; life: number }

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(color: number, size: number, dpr: number): HTMLCanvasElement {
  const px = Math.max(4, Math.round(size * dpr));
  const key = `${color}:${px}`;
  let cv = sprites.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const g = cv.getContext("2d")!;
  const [main, light, dark] = JELLY[color];
  const r = px * 0.22, m = px * 0.04;
  const rr = (x: number, y: number, w: number, h: number, rad: number) => { g.beginPath(); g.roundRect(x, y, w, h, rad); };
  // body
  const body = g.createLinearGradient(0, 0, px, px);
  body.addColorStop(0, light); body.addColorStop(0.45, main); body.addColorStop(1, dark);
  rr(m, m, px - 2 * m, px - 2 * m, r); g.fillStyle = body; g.fill();
  // inner bevel
  g.save(); rr(m, m, px - 2 * m, px - 2 * m, r); g.clip();
  const shade = g.createLinearGradient(0, px * 0.55, 0, px);
  shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,20,40,0.28)");
  g.fillStyle = shade; g.fillRect(0, 0, px, px);
  // glossy top band
  const gloss = g.createLinearGradient(0, m, 0, px * 0.5);
  gloss.addColorStop(0, "rgba(255,255,255,0.75)"); gloss.addColorStop(1, "rgba(255,255,255,0.05)");
  rr(px * 0.14, px * 0.1, px * 0.72, px * 0.36, px * 0.16); g.fillStyle = gloss; g.fill();
  g.restore();
  // rim + shine dot
  rr(m, m, px - 2 * m, px - 2 * m, r); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = Math.max(1, px * 0.03); g.stroke();
  g.beginPath(); g.arc(px * 0.74, px * 0.72, px * 0.06, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.55)"; g.fill();
  sprites.set(key, cv);
  if (sprites.size > 200) sprites.delete(sprites.keys().next().value as string);
  return cv;
}

export const Stage = forwardRef<StageHandle, StageProps>(function Stage({ board, tray, glow, locked, fits, onPlace, onPick, onDrop }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 360, h: 560, dpr: 1 });
  const props = useRef({ board, tray, glow, locked, fits });
  useEffect(() => { props.current = { board, tray, glow, locked, fits }; kick(); });
  const parts = useRef<Particle[]>([]);
  const floats = useRef<Floater[]>([]);
  const flashes = useRef<Flash[]>([]);
  const pops = useRef<Map<number, number>>(new Map());
  const shakeT = useRef({ t: 0, p: 0 });
  const drag = useRef<{ slot: number; x: number; y: number; touch: boolean; target: { r: number; c: number } | null; back?: { x: number; y: number; t: number } } | null>(null);
  const raf = useRef(0);
  const last = useRef(0);

  const layout = useCallback(() => {
    const { w, h } = size.current;
    const trayH = Math.min(h * 0.3, w * 0.42);
    const bs = Math.floor(Math.min(w - 20, h - trayH - 24));
    const cs = bs / N;
    const x0 = (w - bs) / 2, y0 = Math.max(6, (h - trayH - bs) / 2 - 4);
    const ty = y0 + bs + 14, th = h - ty - 4;
    const tcs = Math.min(cs * 0.56, w / 3 / 5.6, th / 5.4);
    return { cs, bs, x0, y0, ty, th, tcs, w, h };
  }, []);

  const slotCenter = useCallback((k: number) => { const L = layout(); return { x: (L.w / 3) * (k + 0.5), y: L.ty + L.th / 2 }; }, [layout]);
  const piecePos = useCallback((d: NonNullable<typeof drag.current>, s: { h: number }) => {
    const L = layout();
    const lift = d.touch ? s.h * L.cs * 0.5 + L.cs * 1.1 : 0;
    return { x: d.x, y: d.y - lift };
  }, [layout]);

  // ------------------------------------------------------------ draw
  const draw = useCallback((now: number) => {
    const c = cv.current;
    if (!c) return false;
    const g = c.getContext("2d")!;
    const { dpr } = size.current;
    const L = layout();
    const { board: b, tray: tr, glow: gl, fits: ft } = props.current;
    const dt = Math.min(0.05, (now - (last.current || now)) / 1000);
    last.current = now;
    let busy = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    // shake
    let sx = 0, sy = 0;
    if (shakeT.current.t > 0) {
      shakeT.current.t -= dt; busy = true;
      const k = shakeT.current.t * shakeT.current.p;
      sx = Math.sin(now / 22) * k; sy = Math.cos(now / 27) * k;
    }
    g.save(); g.translate(sx, sy);
    // board panel
    g.save();
    g.shadowColor = gl; g.shadowBlur = 30;
    g.beginPath(); g.roundRect(L.x0 - 8, L.y0 - 8, L.bs + 16, L.bs + 16, 22);
    g.fillStyle = "rgba(3,22,44,0.62)"; g.fill();
    g.restore();
    g.beginPath(); g.roundRect(L.x0 - 8, L.y0 - 8, L.bs + 16, L.bs + 16, 22);
    g.strokeStyle = "rgba(160,240,255,0.25)"; g.lineWidth = 1.5; g.stroke();
    // ghost
    const d = drag.current;
    let ghost: { cells: Set<number>; lines: Set<number>; color: number } | null = null;
    if (d && d.target && d.slot >= 0 && tr[d.slot]) {
      const p = tr[d.slot]!, s = shapeOf(p.shape);
      const w = wouldClear(b, s, d.target.r, d.target.c);
      const cells = new Set(s.cells.map(([dr, dc]) => (d.target!.r + dr) * N + d.target!.c + dc));
      const lines = new Set<number>();
      for (const r of w.rows) for (let j = 0; j < N; j++) lines.add(r * N + j);
      for (const cc of w.cols) for (let j = 0; j < N; j++) lines.add(j * N + cc);
      ghost = { cells, lines, color: p.color };
    }
    const cs = L.cs;
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N), col = i % N;
      const x = L.x0 + col * cs, y = L.y0 + r * cs;
      const color = b.color[i];
      if (!color) {
        g.beginPath(); g.roundRect(x + cs * 0.06, y + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.2);
        g.fillStyle = "rgba(120,220,255,0.08)"; g.fill();
        g.strokeStyle = "rgba(120,220,255,0.10)"; g.lineWidth = 1; g.stroke();
      }
      if (ghost && ghost.cells.has(i)) {
        g.globalAlpha = 0.42; g.drawImage(sprite(ghost.color, cs, dpr), x, y, cs, cs); g.globalAlpha = 1;
      }
      if (color) {
        const lit = ghost && ghost.lines.has(i);
        const pop = pops.current.get(i);
        let k = 1;
        if (pop !== undefined) { const t = (now - pop) / 220; if (t >= 1) pops.current.delete(i); else { k = 1 + Math.sin(t * Math.PI) * 0.14; busy = true; } }
        const sz = cs * k, o = (cs - sz) / 2;
        g.drawImage(sprite(lit ? ghost!.color : color, cs, dpr), x + o, y + o, sz, sz);
        if (lit) { g.fillStyle = `rgba(255,255,255,${0.18 + 0.12 * Math.sin(now / 90)})`; g.beginPath(); g.roundRect(x + cs * 0.06, y + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.2); g.fill(); busy = true; }
        if (b.pearl[i]) drawPearl(g, x + cs / 2, y + cs / 2, cs * 0.22, now);
        if (b.ice[i]) drawIce(g, x, y, cs);
      } else if (ghost && ghost.lines.has(i) && !ghost.cells.has(i)) {
        // (can't happen: a clearing line is full) — kept for safety
      }
    }
    // line flashes
    flashes.current = flashes.current.filter((f) => f.life > 0);
    for (const f of flashes.current) {
      f.life -= dt; busy = true;
      const a = Math.max(0, f.life / 0.45);
      g.fillStyle = `rgba(255,255,255,${a * 0.7})`;
      for (const r of f.rows) { g.beginPath(); g.roundRect(L.x0, L.y0 + r * cs + cs * 0.1, L.bs, cs * 0.8, cs * 0.3); g.fill(); }
      for (const c2 of f.cols) { g.beginPath(); g.roundRect(L.x0 + c2 * cs + cs * 0.1, L.y0, cs * 0.8, L.bs, cs * 0.3); g.fill(); }
    }
    g.restore();
    // tray
    for (let k = 0; k < 3; k++) {
      const p = tr[k];
      if (!p || (d && d.slot === k)) continue;
      const s = shapeOf(p.shape), ctr = slotCenter(k);
      const t = L.tcs;
      const ox = ctr.x - (s.w * t) / 2, oy = ctr.y - (s.h * t) / 2;
      g.globalAlpha = ft[k] === false ? 0.3 : 1;
      s.cells.forEach(([dr, dc], q) => { g.drawImage(sprite(p.color, t, dpr), ox + dc * t, oy + dr * t, t, t); if (q === p.pearl) drawPearl(g, ox + dc * t + t / 2, oy + dr * t + t / 2, t * 0.22, now); });
      g.globalAlpha = 1;
    }
    // particles
    parts.current = parts.current.filter((q) => q.life > 0);
    for (const q of parts.current) {
      q.life -= dt; busy = true;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      const a = Math.max(0, q.life / q.max);
      if (q.kind === "bit") {
        q.vy += 900 * dt;
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.globalAlpha = a;
        const sz = q.size * (0.4 + 0.6 * a);
        g.drawImage(sprite(q.color, q.size, dpr), -sz / 2, -sz / 2, sz, sz);
        g.restore();
      } else if (q.kind === "bubble") {
        q.vy -= 60 * dt; q.vx += Math.sin(q.life * 9 + q.rot) * 12 * dt;
        g.globalAlpha = a * 0.85;
        g.beginPath(); g.arc(q.x, q.y, q.size, 0, Math.PI * 2); g.strokeStyle = "rgba(220,250,255,0.9)"; g.lineWidth = 1.4; g.stroke();
        g.beginPath(); g.arc(q.x - q.size * 0.35, q.y - q.size * 0.35, q.size * 0.25, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.9)"; g.fill();
      } else {
        g.globalAlpha = a;
        g.fillStyle = JELLY[q.color][1];
        g.beginPath(); g.arc(q.x, q.y, q.size * a, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    // dragged piece (or one flying back to the tray)
    if (d && tr[d.slot]) {
      const p = tr[d.slot]!, s = shapeOf(p.shape);
      let x: number, y: number, t = cs * 0.96;
      if (d.back) {
        const k2 = Math.min(1, (now - d.back.t) / 160), ctr = slotCenter(d.slot);
        const e = 1 - Math.pow(1 - k2, 3);
        t = cs * 0.96 + (L.tcs - cs * 0.96) * e;
        x = d.back.x + (ctr.x - d.back.x) * e; y = d.back.y + (ctr.y - d.back.y) * e;
        if (k2 >= 1) { drag.current = null; }
        busy = true;
      } else { const pos = piecePos(d, s); x = pos.x; y = pos.y; }
      const ox = x - (s.w * t) / 2, oy = y - (s.h * t) / 2;
      g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 18; g.shadowOffsetY = 10;
      s.cells.forEach(([dr, dc]) => g.drawImage(sprite(p.color, t, dpr), ox + dc * t, oy + dr * t, t, t));
      g.restore();
      if (p.pearl !== undefined) { const [dr, dc] = s.cells[p.pearl]; drawPearl(g, ox + dc * t + t / 2, oy + dr * t + t / 2, t * 0.22, now); }
    }
    // floating texts
    floats.current = floats.current.filter((f) => f.life > 0);
    for (const f of floats.current) {
      f.life -= dt; busy = true;
      const k = 1 - f.life / f.max;
      const sc = f.big ? (k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5)) : 1;
      const a = f.life < 0.35 ? f.life / 0.35 : 1;
      const fs = (f.big ? L.cs * 0.85 : L.cs * 0.5) * sc;
      g.save(); g.globalAlpha = a; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `${fs}px "Lilita One", var(--font-lilita), system-ui, sans-serif`;
      const y = f.y - (f.big ? 0 : k * L.cs * 1.2);
      g.lineWidth = fs * 0.16; g.strokeStyle = "rgba(3,22,44,0.85)"; g.lineJoin = "round"; g.strokeText(f.text, f.x, y);
      const grad = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, f.color);
      g.fillStyle = grad; g.fillText(f.text, f.x, y);
      g.restore();
    }
    if (d && !d.back) busy = true;
    return busy;
  }, [layout, slotCenter, piecePos]);


  const loop = useCallback((t: number) => {
    const busy = draw(t);
    raf.current = busy ? requestAnimationFrame(loop) : 0;
    if (!busy) last.current = 0;
  }, [draw]);
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(loop); }, [loop]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  // ------------------------------------------------------------ size
  useLayoutEffect(() => {
    const el = host.current, c = cv.current;
    if (!el || !c) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      size.current = { w, h, dpr };
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      kick();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el); fit();
    return () => ro.disconnect();
  }, [kick]);

  // ------------------------------------------------------------ effects
  useImperativeHandle(ref, () => ({
    burst: (res, points, praise, combo) => {
      const L = layout(), now = performance.now();
      for (const i of res.placed) pops.current.set(i, now);
      for (const i of res.iceBroken) pops.current.set(i, now);
      if (res.rows.length || res.cols.length) flashes.current.push({ rows: res.rows, cols: res.cols, life: 0.45 });
      for (const { i, color } of res.cleared) {
        const x = L.x0 + (i % N + 0.5) * L.cs, y = L.y0 + (Math.floor(i / N) + 0.5) * L.cs;
        const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
        parts.current.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, rot: 0, vr: (Math.random() - 0.5) * 14, size: L.cs * 0.8, life: 0.75, max: 0.75, color, kind: "bit" });
        for (let k = 0; k < 2; k++) parts.current.push({ x: x + (Math.random() - 0.5) * L.cs, y, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 90, rot: Math.random() * 6, vr: 0, size: 2 + Math.random() * L.cs * 0.12, life: 1.1, max: 1.1, color, kind: "bubble" });
      }
      for (const i of res.pearls) {
        const x = L.x0 + (i % N + 0.5) * L.cs, y = L.y0 + (Math.floor(i / N) + 0.5) * L.cs;
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; parts.current.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, rot: 0, vr: 0, size: L.cs * 0.09, life: 0.6, max: 0.6, color: 7, kind: "spark" }); }
      }
      if (points > 0) {
        const cx = res.placed.reduce((s, i) => s + (i % N), 0) / res.placed.length, cy = res.placed.reduce((s, i) => s + Math.floor(i / N), 0) / res.placed.length;
        floats.current.push({ x: L.x0 + (cx + 0.5) * L.cs, y: L.y0 + (cy + 0.5) * L.cs, text: `+${points}`, life: 0.9, max: 0.9, big: false, color: "#FFE08A" });
      }
      if (praise) floats.current.push({ x: L.x0 + L.bs / 2, y: L.y0 + L.bs * 0.42, text: praise, life: 1.1, max: 1.1, big: true, color: "#7FF3FF" });
      if (combo > 1) floats.current.push({ x: L.x0 + L.bs / 2, y: L.y0 + L.bs * 0.6, text: `Combo ×${combo}`, life: 1.0, max: 1.0, big: false, color: "#FFB8DD" });
      const lines = res.rows.length + res.cols.length;
      if (lines >= 2 || res.allClear) { shakeT.current = { t: 0.3, p: 18 + lines * 6 }; }
      kick();
    },
    shake: (p = 20) => { shakeT.current = { t: 0.3, p }; kick(); },
  }), [layout, kick]);

  // ------------------------------------------------------------ input
  const toCanvas = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const targetFor = (d: NonNullable<typeof drag.current>) => {
    const { tray: tr, board: b } = props.current;
    const p = tr[d.slot];
    if (!p) return null;
    const s = shapeOf(p.shape), L = layout(), pos = piecePos(d, s);
    const c = Math.round((pos.x - (s.w * L.cs) / 2 - L.x0) / L.cs), r = Math.round((pos.y - (s.h * L.cs) / 2 - L.y0) / L.cs);
    return canPlace(b, s, r, c) ? { r, c } : null;
  };
  const down = (e: React.PointerEvent) => {
    if (props.current.locked || (drag.current && !drag.current.back)) return;
    const { x, y } = toCanvas(e), L = layout();
    if (y < L.ty - 10) return;
    const slot = Math.max(0, Math.min(2, Math.floor(x / (L.w / 3))));
    if (!props.current.tray[slot]) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { slot, x, y, touch: e.pointerType !== "mouse", target: null };
    drag.current.target = targetFor(drag.current);
    onPick?.(slot);
    kick();
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.back) return;
    const { x, y } = toCanvas(e);
    d.x = x; d.y = y;
    d.target = targetFor(d);
    kick();
  };
  const up = () => {
    const d = drag.current;
    if (!d || d.back) return;
    if (d.target && !props.current.locked) {
      drag.current = null;
      onDrop?.(true);
      onPlace(d.slot, d.target.r, d.target.c);
    } else {
      const p = props.current.tray[d.slot];
      const pos = p ? piecePos(d, shapeOf(p.shape)) : { x: d.x, y: d.y };
      d.back = { x: pos.x, y: pos.y, t: performance.now() };
      onDrop?.(false);
    }
    kick();
  };

  return (
    <div ref={host} className="tde-stage">
      <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    </div>
  );
});

function drawPearl(g: CanvasRenderingContext2D, x: number, y: number, r: number, now: number) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, "#fdeefa"); gr.addColorStop(1, "#d9b8e8");
  g.save();
  g.shadowColor = "rgba(255,255,255,0.9)"; g.shadowBlur = 6 + Math.sin(now / 300) * 3;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
  g.restore();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.strokeStyle = "rgba(120,60,140,0.45)"; g.lineWidth = Math.max(1, r * 0.12); g.stroke();
}

function drawIce(g: CanvasRenderingContext2D, x: number, y: number, cs: number) {
  g.save();
  g.beginPath(); g.roundRect(x + cs * 0.05, y + cs * 0.05, cs * 0.9, cs * 0.9, cs * 0.18);
  g.fillStyle = "rgba(225,248,255,0.5)"; g.fill();
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = Math.max(1.5, cs * 0.05); g.stroke();
  g.beginPath();
  g.moveTo(x + cs * 0.25, y + cs * 0.2); g.lineTo(x + cs * 0.45, y + cs * 0.45); g.lineTo(x + cs * 0.38, y + cs * 0.7);
  g.moveTo(x + cs * 0.45, y + cs * 0.45); g.lineTo(x + cs * 0.75, y + cs * 0.55);
  g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = Math.max(1, cs * 0.03); g.stroke();
  g.restore();
}
