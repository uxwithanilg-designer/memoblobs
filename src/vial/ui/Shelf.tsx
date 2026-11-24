"use client";
// The Moonvial shelf: one canvas for the star spirits' counter (top) and the vials (below). Glass vials with glowing
// layered potions, a shimmering surface, "?" layers still hidden. A pour lifts the vial over its target, tips it and
// runs a stream across while the levels move; a full vial gets a cork and a sparkle, then flies up to the spirit who
// ordered it. Vials glide to their new places when the shelf thins out. The loop only runs while something moves.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { LIQUID } from "../stage";
import { SLOTS, corkedCount, type Game, type PVial } from "../play";

export interface ShelfHandle {
  pour: (a: number, b: number, amount: number, color: number, srcBefore: number, dstBefore: number) => Promise<void>;
  deliver: (vial: number, slot: number, color: number) => Promise<void>;
  shake: (vial: number) => void;
  sparkle: (vial: number, color: number, big?: boolean) => void;
  /** where a vial is drawn, in page pixels (tests) */
  where: (vial: number) => { x: number; y: number } | null;
}
interface Props { game: Game; selected: number; onTap: (vial: number) => void; glow: string }

interface Disp { x: number; y: number; lift: number; shake: number; fly?: { t0: number; slot: number; x0: number; y0: number }; hide?: boolean }
interface PourAnim { a: number; b: number; amount: number; color: number; srcBefore: number; dstBefore: number; t0: number; done: () => void }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }

const POUR_MS = 720, FLY_MS = 650;

export const Shelf = forwardRef<ShelfHandle, Props>(function Shelf({ game, selected, onTap, glow }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 360, h: 600, dpr: 1 });
  const props = useRef({ game, selected, glow });
  const disp = useRef(new Map<number, Disp>());
  const pourA = useRef<PourAnim | null>(null);
  const sparks = useRef<Spark[]>([]);
  const shownOrders = useRef<number[]>(game.orders.slice());
  const orderIn = useRef<number[]>(game.orders.map(() => 0));
  const bounce = useRef<number[]>(game.orders.map(() => 0));
  const flying = useRef<number[]>(Array(SLOTS).fill(0));
  const raf = useRef(0), last = useRef(0);

  // ------------------------------------------------------------ layout
  const layout = useCallback(() => {
    const { w, h } = size.current;
    const g = props.current.game;
    const vis = g.vials.filter((v) => !v.gone || disp.current.get(v.id)?.fly);
    const shelfV = g.vials.filter((v) => !v.gone);
    const n = Math.max(1, shelfV.length);
    const band = Math.min(150, Math.max(96, h * 0.19));
    const perRow = n <= 5 ? n : n <= 10 ? Math.ceil(n / 2) : Math.ceil(n / 3);
    const rows = Math.ceil(n / perRow);
    const cap = g.vials[0]?.cap ?? 4;
    const availH = h - band - 16;
    // vial size: width from the row, height = neck + cap layers + rounded bottom
    let vw = Math.min(66, ((w - 24) / perRow) * 0.62);
    const vhOf = (x: number) => x * 0.42 + x * 0.68 * cap + x * 0.22;
    while (vw > 22 && rows * (vhOf(vw) * 1.22) + (rows - 1) * 8 > availH) vw -= 1;
    const vh = vhOf(vw);
    const rowH = vh * 1.22 + 8;
    const top = band + 12 + Math.max(0, (availH - rows * rowH) / 2) + vh * 0.18;
    const pos = new Map<number, { x: number; y: number }>();
    shelfV.forEach((v, i) => {
      const r = Math.floor(i / perRow), inRow = Math.min(perRow, n - r * perRow), c = i % perRow;
      const gap = (w - 16) / inRow;
      pos.set(v.id, { x: 8 + gap * (c + 0.5), y: top + r * rowH });
    });
    return { w, h, band, vw, vh, pos, vis, cap };
  }, []);

  const slotPos = (s: number, w: number, band: number) => ({ x: (w / (SLOTS + 1)) * (s + 1), y: band * 0.5 });

  // ------------------------------------------------------------ frame
  const draw = useCallback((now: number) => {
    const c = cv.current;
    if (!c) return false;
    const g = c.getContext("2d")!;
    const { dpr } = size.current;
    const L = layout();
    const dt = Math.min(0.05, (now - (last.current || now)) / 1000);
    last.current = now;
    let busy = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    const { game: gm, selected: sel } = props.current;

    // counter band
    const band = g.createLinearGradient(0, 0, 0, L.band);
    band.addColorStop(0, "rgba(255,255,255,0.0)"); band.addColorStop(1, "rgba(255,255,255,0.08)");
    g.fillStyle = band; g.fillRect(0, 0, L.w, L.band);
    g.beginPath(); g.roundRect(10, L.band - 12, L.w - 20, 10, 5); g.fillStyle = "rgba(255,230,180,0.22)"; g.fill();
    const R = Math.min(L.band * 0.28, 34);
    for (let s = 0; s < SLOTS; s++) {
      // spirits change only once the vial flying to them has landed
      if (!flying.current[s] && shownOrders.current[s] !== gm.orders[s]) { shownOrders.current[s] = gm.orders[s] ?? 0; orderIn.current[s] = now; }
      const k = Math.min(1, (now - orderIn.current[s]) / 380);
      if (k < 1) busy = true;
      const hop = bounce.current[s] && now - bounce.current[s] < 500 ? Math.sin(((now - bounce.current[s]) / 500) * Math.PI) * R * 0.5 : 0;
      if (hop) busy = true;
      const p = slotPos(s, L.w, L.band);
      if (s < gm.orders.length) drawSpirit(g, p.x, p.y - 4, R, shownOrders.current[s], now, 1 - Math.pow(1 - k, 3), hop);
    }

    // vials glide to their places
    for (const v of gm.vials) {
      const target = L.pos.get(v.id);
      let d = disp.current.get(v.id);
      if (!d) { const t = target ?? { x: L.w / 2, y: L.h }; d = { x: t.x, y: t.y, lift: 0, shake: 0 }; disp.current.set(v.id, d); }
      if (target && !d.fly) {
        const dx = target.x - d.x, dy = target.y - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) { d.x += dx * Math.min(1, dt * 10); d.y += dy * Math.min(1, dt * 10); busy = true; } else { d.x = target.x; d.y = target.y; }
      }
      const liftTo = v.id === sel ? L.vh * 0.16 : 0;
      if (Math.abs(d.lift - liftTo) > 0.3) { d.lift += (liftTo - d.lift) * Math.min(1, dt * 16); busy = true; } else d.lift = liftTo;
      if (d.shake > 0) { d.shake = Math.max(0, d.shake - dt); busy = true; }
    }
    const pa = pourA.current;
    for (const v of gm.vials) {
      const d = disp.current.get(v.id)!;
      if (v.gone && !d.fly) continue;
      if (pa && v.id === pa.a) continue; // drawn last, on top
      let count = v.layers.length, pc = 0;
      if (pa && v.id === pa.b) { const f = pourFrac(now, pa); count = pa.dstBefore + pa.amount * f; pc = pa.color; }
      let x = d.x + (d.shake ? Math.sin(d.shake * 60) * 5 * d.shake * 3 : 0), y = d.y - d.lift;
      let sc = 1, alpha = 1;
      if (d.fly) {
        const k = Math.min(1, (now - d.fly.t0) / FLY_MS), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = slotPos(d.fly.slot, L.w, L.band);
        x = d.fly.x0 + (p.x - d.fly.x0) * e; y = d.fly.y0 + (p.y - L.vh * 0.3 - d.fly.y0) * e - Math.sin(k * Math.PI) * 60;
        sc = 1 - 0.55 * e; alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
        busy = true;
      }
      g.save(); g.globalAlpha = alpha; g.translate(x, y + L.vh / 2); g.scale(sc, sc); g.translate(-x, -(y + L.vh / 2));
      drawVial(g, v, x, y, L.vw, L.vh, count, now, v.id === sel, pc, props.current.glow, Math.max(0, (v.lock ?? 0) - corkedCount(gm)));
      g.restore();
    }
    // the pouring vial, tipped over its target, and the stream
    if (pa) {
      busy = true;
      const A = gm.vials[pa.a], dA = disp.current.get(pa.a)!, dB = disp.current.get(pa.b)!;
      const t = Math.min(1, (now - pa.t0) / POUR_MS);
      const side = dA.x <= dB.x ? -1 : 1;
      const hx = dB.x + side * L.vw * 0.75, hy = dB.y - L.vh * 0.62;
      const go = t < 0.25 ? easeOut(t / 0.25) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
      const x = dA.x + (hx - dA.x) * go, y = dA.y - dA.lift * (1 - go) + (hy - dA.y) * go;
      const ang = -side * go * 1.15;
      const f = pourFrac(now, pa);
      const count = pa.srcBefore - pa.amount * f;
      // stream
      if (t > 0.25 && t < 0.82) {
        const mx = x + Math.sin(ang) * (L.vh / 2), my = y + L.vh / 2 - Math.cos(ang) * (L.vh / 2);
        const tx = dB.x, ty = dB.y - dB.lift + L.vw * 0.1;
        const [main, light] = LIQUID[pa.color - 1];
        const gr = g.createLinearGradient(mx, my, tx, ty); gr.addColorStop(0, light); gr.addColorStop(1, main);
        g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx - side * L.vw * 0.1, (my + ty) / 2, tx, ty + L.vh * 0.5 * (1 - f));
        g.strokeStyle = gr; g.lineWidth = L.vw * 0.16 * (t < 0.3 ? (t - 0.25) / 0.05 : t > 0.76 ? (0.82 - t) / 0.06 : 1); g.lineCap = "round"; g.stroke();
      }
      g.save(); g.translate(x, y + L.vh / 2); g.rotate(ang); g.translate(-x, -(y + L.vh / 2));
      drawVial(g, A, x, y, L.vw, L.vh, count, now, false, pa.color);
      g.restore();
      if (t >= 1) { const fin = pa.done; pourA.current = null; fin(); }
    }
    // sparkles
    sparks.current = sparks.current.filter((s) => s.life > 0);
    for (const s of sparks.current) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 140 * dt; busy = true;
      const a = s.life / s.max;
      g.save(); g.globalAlpha = a; g.fillStyle = s.color; g.translate(s.x, s.y); g.rotate(s.life * 6);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? s.size * 0.35 : s.size; const an = (i * Math.PI) / 4; if (i) g.lineTo(Math.cos(an) * r, Math.sin(an) * r); else g.moveTo(r, 0); }
      g.closePath(); g.fill(); g.restore();
    }
    // surfaces shimmer while anything is selected
    if (sel >= 0) busy = true;
    return busy;
  }, [layout]);

  const loop = useCallback((t: number) => {
    const busy = draw(t);
    raf.current = busy ? requestAnimationFrame(loop) : 0;
    if (!busy) last.current = 0;
  }, [draw]);
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(loop); }, [loop]);
  useEffect(() => { props.current = { game, selected, glow }; kick(); });
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  useLayoutEffect(() => {
    const el = host.current, c = cv.current;
    if (!el || !c) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      size.current = { w, h, dpr };
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      // snap vials to the new layout
      const L = layout();
      for (const [id, p] of L.pos) { const d = disp.current.get(id); if (d && !d.fly) { d.x = p.x; d.y = p.y; } }
      kick();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el); fit();
    return () => ro.disconnect();
  }, [kick, layout]);

  // a new stage: forget old positions
  const stageKey = game.vials.length + ":" + game.colors + ":" + game.moves;
  useEffect(() => {
    if (game.moves === 0) { disp.current.clear(); shownOrders.current = game.orders.slice(); orderIn.current = game.orders.map(() => performance.now()); kick(); }
  }, [stageKey, game.moves, game.orders, kick]);

  const burst = useCallback((x: number, y: number, color: string, n: number) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160; sparks.current.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.8, max: 0.8, color: Math.random() < 0.4 ? "#ffffff" : color, size: 3 + Math.random() * 4 }); }
    kick();
  }, [kick]);

  useImperativeHandle(ref, () => ({
    pour: (a, b, amount, color, srcBefore, dstBefore) => new Promise<void>((res) => { pourA.current = { a, b, amount, color, srcBefore, dstBefore, t0: performance.now(), done: res }; kick(); }),
    deliver: (vial, slot, color) => new Promise<void>((res) => {
      const d = disp.current.get(vial);
      flying.current[slot]++;
      if (d) d.fly = { t0: performance.now(), slot, x0: d.x, y0: d.y - d.lift };
      kick();
      setTimeout(() => {
        flying.current[slot]--;
        bounce.current[slot] = performance.now();
        const L = layout(), p = slotPos(slot, L.w, L.band);
        burst(p.x, p.y, LIQUID[color - 1][1], 18);
        if (d) d.fly = undefined;
        kick(); res();
      }, FLY_MS);
    }),
    shake: (vial) => { const d = disp.current.get(vial); if (d) d.shake = 0.35; kick(); },
    where: (vial) => { const d = disp.current.get(vial), c = cv.current; if (!d || !c) return null; const r = c.getBoundingClientRect(), L = layout(); return { x: r.left + d.x, y: r.top + d.y - d.lift + L.vh * 0.6 }; },
    sparkle: (vial, color, big) => { const d = disp.current.get(vial); if (!d) return; const L = layout(); burst(d.x, d.y + (big ? 0 : L.vh * 0.3), LIQUID[color - 1][1], big ? 16 : 8); },
  }), [kick, layout, burst]);


  const down = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const L = layout();
    let hit = -1, best = 1e9;
    for (const v of props.current.game.vials) {
      if (v.gone) continue;
      const d = disp.current.get(v.id);
      if (!d) continue;
      const top = d.y - d.lift - L.vw * 0.3, bot = d.y - d.lift + L.vh + 6;
      if (x >= d.x - L.vw * 0.75 && x <= d.x + L.vw * 0.75 && y >= top - 10 && y <= bot) { const dist = Math.abs(x - d.x); if (dist < best) { best = dist; hit = v.id; } }
    }
    if (hit >= 0) { e.preventDefault(); onTap(hit); }
  };

  return (
    <div ref={host} className="mvl-shelf">
      <canvas ref={cv} onPointerDown={down} />
    </div>
  );
});

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function pourFrac(now: number, pa: { t0: number }) {
  const t = (now - pa.t0) / POUR_MS;
  return Math.min(1, Math.max(0, (t - 0.28) / 0.48));
}

// ------------------------------------------------------------ drawing
function vialPath(g: CanvasRenderingContext2D, x: number, y: number, vw: number, vh: number) {
  const neckW = vw * 0.56, neckH = vw * 0.42;
  g.beginPath();
  g.moveTo(x - neckW / 2, y);
  g.lineTo(x + neckW / 2, y);
  g.lineTo(x + neckW / 2, y + neckH * 0.6);
  g.quadraticCurveTo(x + vw / 2, y + neckH * 0.7, x + vw / 2, y + neckH * 1.2);
  g.lineTo(x + vw / 2, y + vh - vw / 2);
  g.arc(x, y + vh - vw / 2, vw / 2, 0, Math.PI);
  g.lineTo(x - vw / 2, y + neckH * 1.2);
  g.quadraticCurveTo(x - vw / 2, y + neckH * 0.7, x - neckW / 2, y + neckH * 0.6);
  g.closePath();
}

function drawVial(g: CanvasRenderingContext2D, v: PVial, x: number, y: number, vw: number, vh: number, count: number, now: number, sel: boolean, pourColor = 0, glow = "#fff", lockLeft = 0) {
  const neckH = vw * 0.42;
  const layerH = vw * 0.68;
  const bottom = y + vh - 3;
  // glow behind a selected vial
  if (sel) { g.save(); g.shadowColor = glow; g.shadowBlur = 24; vialPath(g, x, y, vw, vh); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill(); g.restore(); }
  // glass body
  vialPath(g, x, y, vw, vh);
  g.fillStyle = "rgba(200,225,255,0.10)"; g.fill();
  // liquid
  g.save();
  vialPath(g, x, y, vw, vh); g.clip();
  const full = Math.floor(count), frac = count - full;
  const layers = v.layers.slice();
  const hidden = v.hidden.slice();
  // while pouring into this vial, the incoming colour sits on top
  while (layers.length < Math.ceil(count)) { layers.push(pourColor || layers[layers.length - 1] || 1); hidden.push(false); }
  const n = Math.min(layers.length, Math.ceil(count));
  for (let i = 0; i < n; i++) {
    const hgt = i === full ? frac * layerH : layerH;
    if (hgt <= 0) continue;
    const ly = bottom - i * layerH - hgt;
    const c = layers[i];
    if (hidden[i]) {
      const gr = g.createLinearGradient(x - vw / 2, 0, x + vw / 2, 0);
      gr.addColorStop(0, "#1a1240"); gr.addColorStop(0.5, "#3a2c72"); gr.addColorStop(1, "#140e33");
      g.fillStyle = gr; g.fillRect(x - vw / 2, ly, vw, hgt + 1);
      g.fillStyle = "rgba(220,210,255,0.85)"; g.font = `${layerH * 0.62}px "Lilita One", var(--font-lilita), sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("?", x, ly + hgt / 2 + 1);
    } else {
      const [main, light, dark] = LIQUID[c - 1];
      const gr = g.createLinearGradient(x - vw / 2, 0, x + vw / 2, 0);
      gr.addColorStop(0, dark); gr.addColorStop(0.35, main); gr.addColorStop(0.6, light); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.fillRect(x - vw / 2, ly, vw, hgt + 1);
    }
    // the surface on the top layer
    if (i === n - 1 && !hidden[i]) {
      const wob = Math.sin(now / 380 + v.id) * vw * 0.03;
      g.beginPath(); g.ellipse(x, ly + wob * 0.3, vw * 0.48, vw * 0.09, 0, 0, Math.PI * 2);
      g.fillStyle = LIQUID[c - 1][1]; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
    }
  }
  g.restore();
  // glass shine + rim
  vialPath(g, x, y, vw, vh);
  g.strokeStyle = "rgba(225,240,255,0.75)"; g.lineWidth = Math.max(1.5, vw * 0.045); g.stroke();
  g.beginPath(); g.roundRect(x - vw * 0.34, y + neckH * 1.3, vw * 0.11, vh - neckH * 1.3 - vw * 0.55, vw * 0.05);
  g.fillStyle = "rgba(255,255,255,0.28)"; g.fill();
  g.beginPath(); g.roundRect(x - vw * 0.33, y - vw * 0.06, vw * 0.66, vw * 0.12, vw * 0.06);
  g.fillStyle = "rgba(225,240,255,0.85)"; g.fill();
  if (v.corked) {
    g.beginPath(); g.roundRect(x - vw * 0.24, y - vw * 0.3, vw * 0.48, vw * 0.36, vw * 0.08);
    const cg = g.createLinearGradient(0, y - vw * 0.3, 0, y + vw * 0.06); cg.addColorStop(0, "#d9a066"); cg.addColorStop(1, "#8a5a2b");
    g.fillStyle = cg; g.fill();
    g.strokeStyle = "rgba(60,30,10,0.5)"; g.lineWidth = 1; g.stroke();
  }
  if (lockLeft > 0) {
    // frosted over, with a padlock and the corks still needed
    vialPath(g, x, y, vw, vh); g.fillStyle = "rgba(20,14,50,0.55)"; g.fill();
    const cy = y + vh * 0.55, r = vw * 0.26;
    g.beginPath(); g.arc(x, cy - r * 0.55, r * 0.62, Math.PI, 0); g.strokeStyle = "#ffe08a"; g.lineWidth = Math.max(2, vw * 0.07); g.stroke();
    g.beginPath(); g.roundRect(x - r, cy - r * 0.55, r * 2, r * 1.6, r * 0.3); g.fillStyle = "#ffc23d"; g.fill();
    g.fillStyle = "#3a2000"; g.font = `${r * 1.2}px "Lilita One", var(--font-lilita), sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(lockLeft), x, cy + r * 0.28);
  }
}

function drawSpirit(g: CanvasRenderingContext2D, x: number, y: number, R: number, color: number, now: number, k: number, hop: number) {
  if (!color) {
    g.beginPath(); g.arc(x, y, R * 0.8, 0, Math.PI * 2); g.setLineDash([4, 5]); g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    return;
  }
  const [main, light, dark] = LIQUID[color - 1];
  const bob = Math.sin(now / 520 + x) * R * 0.06 - hop;
  const cy = y + bob + (1 - k) * R * 2.2;
  g.save();
  g.globalAlpha = k;
  // glow
  const halo = g.createRadialGradient(x, cy, R * 0.2, x, cy, R * 1.7);
  halo.addColorStop(0, main + "88"); halo.addColorStop(1, main + "00");
  g.fillStyle = halo; g.beginPath(); g.arc(x, cy, R * 1.7, 0, Math.PI * 2); g.fill();
  // star-shaped body: a soft five-point star with round tips
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.68 : R;
    const px = x + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.95;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  const body = g.createLinearGradient(x, cy - R, x, cy + R);
  body.addColorStop(0, light); body.addColorStop(0.55, main); body.addColorStop(1, dark);
  g.fillStyle = body; g.lineJoin = "round"; g.lineWidth = R * 0.18; g.strokeStyle = main; g.stroke(); g.fill();
  // face
  const blink = Math.sin(now / 1700 + x) > 0.97 ? 0.15 : 1;
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(x + s * R * 0.24, cy - R * 0.02, R * 0.12, R * 0.15 * blink, 0, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    g.beginPath(); g.arc(x + s * R * 0.24 + R * 0.02, cy + R * 0.01, R * 0.065 * blink, 0, Math.PI * 2); g.fillStyle = "#1a1030"; g.fill();
    g.beginPath(); g.ellipse(x + s * R * 0.42, cy + R * 0.18, R * 0.09, R * 0.05, 0, 0, Math.PI * 2); g.fillStyle = "rgba(255,120,160,0.55)"; g.fill();
  }
  g.beginPath(); g.arc(x, cy + R * 0.16, R * 0.11, 0.1 * Math.PI, 0.9 * Math.PI); g.strokeStyle = "#1a1030"; g.lineWidth = R * 0.06; g.lineCap = "round"; g.stroke();
  // the flask they want, held to the side
  const fx = x + R * 0.95, fy = cy + R * 0.45, fr = R * 0.3;
  g.beginPath(); g.arc(fx, fy, fr, 0, Math.PI * 2); g.fillStyle = main; g.fill(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.roundRect(fx - fr * 0.35, fy - fr * 1.55, fr * 0.7, fr * 0.7, 2); g.fillStyle = "rgba(255,255,255,0.85)"; g.fill();
  g.restore();
}

