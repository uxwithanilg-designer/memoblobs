// The painted scenery behind the road: three layers per world (far, mid, near), each painted once per stage into a
// strip that tiles seamlessly, then scrolled with parallax every frame (one image draw per layer: cheap on phones).
// Every world has its own scene — misty pine ranges with light through the trees; patchwork orchard hills with fruit
// trees and a farmhouse; cypress swamps with hanging moss over still water; lavender hills and sunflower fields with
// hives; red barns, silos and wheat; striped mesas, arches and cactus flats; giant glowing mushrooms in a violet night;
// snowy peaks over a sawmill and log piles; a snowy village with lit windows and chimney smoke; ink-wash mountains, tea
// terraces and cherry trees; a smoking volcano with lava rivers; and the moon's craters, domes and crystals.
// Light comes from the sun's side; far layers fade into the haze; windows and glows come up at night.
import type { Look } from "./grade";
import type { WorldId } from "../worlds";
import { clamp, makeRng, mix, range, rgba, shade, type Rng } from "../util";

export const STRIP_W = 1600, STRIP_H = 600;
export interface Strip { canvas: HTMLCanvasElement; base: string }
export interface Backdrop { strips: [Strip, Strip, Strip] }

type C = CanvasRenderingContext2D;
interface Ctx { c: C; W: number; H: number; col: string; l: Look; r: Rng; lightR: boolean; layer: 0 | 1 | 2; night: number }

// ---------------------------------------------------------------- helpers
function profile(r: Rng, W: number, terms: [number, number][]) {
  const waves = terms.map(([k, a]) => ({ k, a, p: r() * Math.PI * 2 }));
  const out = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) { let v = 0; for (const w of waves) v += w.a * Math.sin((x / W) * Math.PI * 2 * w.k + w.p); out[x] = v; }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const s = hi - lo || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / s;
  return out;
}
/** heights: y = top + (1 - p) * span */
function ys(p: Float32Array, top: number, span: number) { const o = new Float32Array(p.length); for (let i = 0; i < p.length; i++) o[i] = top + (1 - p[i]) * span; return o; }
function shape(c: C, y: Float32Array, W: number, H: number) {
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 2) c.lineTo(x, y[x]);
  c.lineTo(W, y[W]); c.lineTo(W, H); c.closePath();
}
function vgrad(c: C, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(clamp(o, 0, 1), col);
  return g;
}
/** fill a silhouette with a top-lit gradient and a thin light rim on top */
function ridge(x: Ctx, y: Float32Array, top: string, bottom: string, rim = 0.35) {
  const { c, W, H } = x;
  let mn = H;
  for (const v of y) mn = Math.min(mn, v);
  shape(c, y, W, H);
  c.fillStyle = vgrad(c, mn, H, [[0, top], [1, bottom]]);
  c.fill();
  if (rim > 0) {
    c.save(); c.beginPath();
    for (let i = 0; i <= W; i += 2) { if (i === 0) c.moveTo(i, y[i]); else c.lineTo(i, y[i]); }
    c.strokeStyle = rgba(x.l.light, rim * (1 - x.night * 0.6)); c.lineWidth = 2.2; c.stroke(); c.restore();
  }
}
/** facet light: the slopes facing the sun a touch brighter, the others shaded. Painted at an eighth of the size and
 * scaled up (smoothly), so it reads as soft painted light rather than stripes */
let facetCv: HTMLCanvasElement | null = null;
function facets(x: Ctx, y: Float32Array, amt = 0.2) {
  const { c, W, H } = x;
  const dir = x.lightR ? 1 : -1;
  const fw = Math.ceil(W / 8), fh = Math.ceil(H / 8);
  facetCv ??= document.createElement("canvas");
  if (facetCv.width !== fw || facetCv.height !== fh) { facetCv.width = fw; facetCv.height = fh; }
  const f = facetCv.getContext("2d")!;
  f.clearRect(0, 0, fw, fh);
  for (let i = 0; i < fw; i++) {
    const px = Math.min(W, i * 8 + 4);
    const a = y[Math.max(0, px - 12)], b = y[Math.min(W, px + 12)];
    const sl = ((b - a) / 24) * dir; // > 0: facing away from the light
    if (Math.abs(sl) < 0.05) continue;
    const k = Math.min(1, (Math.abs(sl) - 0.05) * 1.6) * amt;
    const top = y[px] / 8;
    const g = f.createLinearGradient(0, top, 0, fh);
    const col = sl > 0 ? "#0A0820" : x.l.light;
    g.addColorStop(0, rgba(col, sl > 0 ? k : k * 0.7)); g.addColorStop(1, rgba(col, 0));
    f.fillStyle = g; f.fillRect(i, top - 1, 1, fh - top + 1);
  }
  c.save(); shape(c, y, W, H); c.clip();
  c.imageSmoothingEnabled = true;
  c.drawImage(facetCv, 0, 0, fw, fh, 0, 0, W, H);
  c.restore();
}
function mist(x: Ctx, y0: number, y1: number, a: number) {
  const { c, W } = x;
  c.fillStyle = vgrad(c, y0, y1, [[0, rgba(x.l.haze, 0)], [1, rgba(x.l.haze, a)]]);
  c.fillRect(0, y0, W, y1 - y0);
}
/** draw at x, and again one strip-width over when it pokes across a seam */
function wrap(x: Ctx, px: number, half: number, fn: (px: number) => void) {
  fn(px);
  if (px - half < 0) fn(px + x.W);
  if (px + half > x.W) fn(px - x.W);
}
const at = (y: Float32Array, px: number, W: number) => y[clamp(Math.round(((px % W) + W) % W), 0, W)];
function windowGlow(x: Ctx, wx: number, wy: number, w: number, h: number) {
  const { c } = x;
  const lit = x.night > 0.25;
  c.fillStyle = lit ? mix("#FFC861", "#FFE9A8", 0.3) : shade(x.col, -0.35);
  c.fillRect(wx, wy, w, h);
  if (lit) { c.fillStyle = rgba("#FFD27A", 0.22 * x.night); c.beginPath(); c.arc(wx + w / 2, wy + h / 2, Math.max(w, h) * 1.6, 0, Math.PI * 2); c.fill(); }
}

// ---------------------------------------------------------------- shapes
function pine(x: Ctx, px: number, base: number, h: number, col: string, snow = false) {
  const { c } = x;
  const w = h * 0.36, tiers = 4;
  c.fillStyle = shade(col, -0.25); c.fillRect(px - h * 0.025, base - h * 0.14, h * 0.05, h * 0.16);
  for (let k = 0; k < tiers; k++) {
    const t0 = base - h * 0.1 - (h * 0.88 * k) / tiers, tw = w * (1 - k * 0.2), th = h * 0.38;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(px - tw, t0); c.lineTo(px, t0 - th); c.lineTo(px + tw, t0);
    c.quadraticCurveTo(px, t0 - th * 0.12, px - tw, t0); c.fill();
    // the lit side
    c.fillStyle = rgba(x.l.light, 0.14 * (1 - x.night * 0.7));
    c.beginPath(); c.moveTo(px, t0 - th); c.lineTo(px + (x.lightR ? tw : -tw), t0); c.lineTo(px, t0 - th * 0.12); c.fill();
    if (snow) { c.fillStyle = rgba("#FFFFFF", 0.85); c.beginPath(); c.moveTo(px - tw * 0.55, t0 - th * 0.42); c.lineTo(px, t0 - th); c.lineTo(px + tw * 0.55, t0 - th * 0.42); c.quadraticCurveTo(px, t0 - th * 0.55, px - tw * 0.55, t0 - th * 0.42); c.fill(); }
  }
}
function roundTree(x: Ctx, px: number, base: number, h: number, col: string, fruit?: string) {
  const { c, r } = x;
  c.fillStyle = shade(col, -0.35); c.fillRect(px - h * 0.04, base - h * 0.45, h * 0.08, h * 0.46);
  const cr = h * 0.33, cy = base - h * 0.62;
  c.fillStyle = col;
  for (const [ox, oy, rr] of [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.22, 0.72], [-0.2, -0.45, 0.62], [0.3, -0.38, 0.6]] as const) { c.beginPath(); c.arc(px + ox * cr, cy + oy * cr, rr * cr, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = rgba(x.l.light, 0.16 * (1 - x.night * 0.7));
  c.beginPath(); c.arc(px + (x.lightR ? 0.3 : -0.3) * cr, cy - 0.3 * cr, cr * 0.55, 0, Math.PI * 2); c.fill();
  if (fruit) { c.fillStyle = fruit; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(px + range(r, -0.8, 0.8) * cr, cy + range(r, -0.6, 0.6) * cr, cr * 0.09, 0, Math.PI * 2); c.fill(); } }
}
function bush(x: Ctx, px: number, base: number, w: number, col: string) {
  const { c } = x;
  c.fillStyle = col;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(px + (i - 1.5) * w * 0.28, base - w * 0.18 - (i % 2) * w * 0.1, w * 0.26, 0, Math.PI * 2); c.fill(); }
  c.fillRect(px - w * 0.55, base - w * 0.18, w * 1.1, w * 0.2);
}
function house(x: Ctx, px: number, base: number, w: number, h: number, wall: string, roof: string, snow = false, chimney = false) {
  const { c } = x;
  c.fillStyle = wall; c.fillRect(px - w / 2, base - h, w, h);
  c.fillStyle = roof; c.beginPath(); c.moveTo(px - w * 0.62, base - h + 2); c.lineTo(px, base - h - h * 0.65); c.lineTo(px + w * 0.62, base - h + 2); c.closePath(); c.fill();
  if (snow) { c.fillStyle = "#F7FBFF"; c.beginPath(); c.moveTo(px - w * 0.64, base - h + 2); c.lineTo(px, base - h - h * 0.7); c.lineTo(px + w * 0.64, base - h + 2); c.lineTo(px + w * 0.5, base - h + 6); c.lineTo(px, base - h - h * 0.52); c.lineTo(px - w * 0.5, base - h + 6); c.closePath(); c.fill(); }
  if (chimney) { c.fillStyle = shade(wall, -0.2); c.fillRect(px + w * 0.22, base - h - h * 0.5, w * 0.1, h * 0.35); }
  windowGlow(x, px - w * 0.3, base - h * 0.7, w * 0.16, h * 0.22);
  windowGlow(x, px + w * 0.14, base - h * 0.7, w * 0.16, h * 0.22);
  c.fillStyle = shade(wall, -0.35); c.fillRect(px - w * 0.07, base - h * 0.42, w * 0.14, h * 0.42);
}

// ---------------------------------------------------------------- the worlds
type Painter = (x: Ctx) => void;

const PAINT: Record<WorldId, [Painter, Painter, Painter]> = {
  pinewood: [
    (x) => { const y = ys(profile(x.r, x.W, [[1, 1], [3, 0.5], [7, 0.18]]), 200, 230); ridge(x, y, shade(x.col, 0.08), x.col); facets(x, y, 0.16); for (let px = 6; px < x.W; px += range(x.r, 9, 16)) wrap(x, px, 10, (q) => pine(x, q, at(y, q, x.W) + 8, range(x.r, 26, 40), shade(x.col, -0.08))); mist(x, 330, 600, 0.75); },
    (x) => { const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.4]]), 330, 120); ridge(x, y, x.col, shade(x.col, -0.2), 0); for (let px = 0; px < x.W; px += range(x.r, 14, 26)) wrap(x, px, 30, (q) => pine(x, q, at(y, q, x.W) + 30, range(x.r, 70, 120), mix(x.col, "#0E2A22", x.r() * 0.3))); mist(x, 420, 600, 0.45); },
    (x) => { const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 470, 60); ridge(x, y, x.col, shade(x.col, -0.25), 0); for (let px = 0; px < x.W; px += range(x.r, 60, 130)) wrap(x, px, 60, (q) => pine(x, q, at(y, q, x.W) + 40, range(x.r, 180, 260), shade(x.col, range(x.r, -0.15, 0.05)))); for (let px = 0; px < x.W; px += range(x.r, 30, 60)) wrap(x, px, 30, (q) => bush(x, q, at(y, q, x.W) + 30, range(x.r, 40, 70), shade(x.col, 0.06))); },
  ],
  orchard: [
    (x) => {
      const y = ys(profile(x.r, x.W, [[1, 1], [2, 0.6], [5, 0.15]]), 260, 200); ridge(x, y, shade(x.col, 0.1), x.col);
      // patchwork fields: tilted stripes clipped to the hills
      const { c } = x; c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let i = 0; i < 22; i++) { const px = range(x.r, 0, x.W), w = range(x.r, 60, 160); c.fillStyle = rgba(["#E8D27A", "#9CCB5A", "#C8E08A", "#7FB04E"][i % 4], 0.35); c.beginPath(); c.moveTo(px, 600); c.lineTo(px + w * 0.4, at(y, px, x.W) - 4); c.lineTo(px + w * 1.4, at(y, px + w, x.W) - 4); c.lineTo(px + w, 600); c.fill(); }
      c.restore();
      const hx = range(x.r, 200, 1400); house(x, hx, at(y, hx, x.W) + 10, 40, 26, shade("#F2E8D8", -0.2 - x.night * 0.4), "#C0503A");
      mist(x, 360, 600, 0.55);
    },
    (x) => { const y = ys(profile(x.r, x.W, [[2, 1], [4, 0.4]]), 360, 100); ridge(x, y, x.col, shade(x.col, -0.15), 0.2); for (let px = 0; px < x.W; px += range(x.r, 34, 50)) wrap(x, px, 40, (q) => roundTree(x, q, at(y, q, x.W) + 14, range(x.r, 80, 110), mix(x.col, "#2E6A2A", 0.25), x.r() < 0.6 ? "#FF5A3A" : "#FFB627")); mist(x, 450, 600, 0.3); },
    (x) => {
      const y = ys(profile(x.r, x.W, [[3, 1], [6, 0.3]]), 480, 50); ridge(x, y, x.col, shade(x.col, -0.22), 0);
      const { c } = x;
      for (let px = 0; px < x.W; px += range(x.r, 50, 90)) wrap(x, px, 50, (q) => bush(x, q, at(y, q, x.W) + 18, range(x.r, 50, 90), shade(x.col, 0.05)));
      // a long wooden fence
      c.strokeStyle = shade("#A8784A", -x.night * 0.5); c.lineWidth = 5;
      for (let px = 0; px <= x.W; px += 40) { c.beginPath(); c.moveTo(px, at(y, px, x.W) + 20); c.lineTo(px, at(y, px, x.W) - 30); c.stroke(); }
      c.lineWidth = 4; c.beginPath(); for (let px = 0; px <= x.W; px += 10) c.lineTo(px, at(y, px, x.W) - 20); c.stroke();
      c.beginPath(); for (let px = 0; px <= x.W; px += 10) c.lineTo(px, at(y, px, x.W) - 6); c.stroke();
    },
  ],
  bayou: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [9, 0.4]]), 380, 50); ridge(x, y, x.col, shade(x.col, -0.1), 0);
      for (let px = 0; px < x.W; px += range(x.r, 14, 30)) wrap(x, px, 20, (q) => { const h = range(x.r, 40, 80), b = at(y, q, x.W) + 6; c.fillStyle = shade(x.col, -0.05); c.fillRect(q - 2, b - h, 4, h); c.beginPath(); c.ellipse(q, b - h, h * 0.35, h * 0.12, 0, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = mix(x.l.sky[2], x.col, 0.4); c.fillRect(0, 440, x.W, 160);
      c.strokeStyle = rgba(x.l.light, 0.25); c.lineWidth = 2; for (let i = 0; i < 40; i++) { const px = range(x.r, 0, x.W), py = range(x.r, 450, 590); c.beginPath(); c.moveTo(px, py); c.lineTo(px + range(x.r, 20, 70), py); c.stroke(); }
      mist(x, 300, 600, 0.7);
    },
    (x) => {
      const { c } = x; const wl = 470;
      c.fillStyle = mix(x.l.sky[2], shade(x.col, -0.3), 0.55); c.fillRect(0, wl, x.W, 600 - wl);
      for (let px = 0; px < x.W; px += range(x.r, 60, 120)) wrap(x, px, 60, (q) => {
        const h = range(x.r, 170, 260), w = h * 0.1, col = mix(x.col, "#1C2A22", x.r() * 0.3);
        // flared trunk, a flat wide crown, and moss hanging from it
        c.fillStyle = col; c.beginPath(); c.moveTo(q - w * 2.2, wl + 8); c.quadraticCurveTo(q - w * 0.6, wl - 40, q - w * 0.5, wl - h); c.lineTo(q + w * 0.5, wl - h); c.quadraticCurveTo(q + w * 0.6, wl - 40, q + w * 2.2, wl + 8); c.fill();
        for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(q + (k - 2) * h * 0.11, wl - h - range(x.r, -10, 16), h * 0.16, h * 0.06, 0, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = rgba(mix(x.col, "#9CB07A", 0.4), 0.8); c.lineWidth = 2;
        for (let k = 0; k < 9; k++) { const mx = q + range(x.r, -h * 0.3, h * 0.3), my = wl - h + 4; c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(mx + 4, my + 30, mx - 2, my + range(x.r, 30, 70)); c.stroke(); }
        // the tree's reflection
        c.fillStyle = rgba(col, 0.25); c.fillRect(q - w * 0.5, wl + 4, w, h * 0.4);
      });
      c.strokeStyle = rgba(x.l.light, 0.22); c.lineWidth = 1.5; for (let i = 0; i < 50; i++) { const px = range(x.r, 0, x.W), py = range(x.r, wl + 4, 598); c.beginPath(); c.moveTo(px, py); c.lineTo(px + range(x.r, 10, 50), py); c.stroke(); }
      mist(x, 380, 600, 0.35);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[4, 1], [9, 0.4]]), 500, 40); ridge(x, y, x.col, shade(x.col, -0.2), 0);
      for (let px = 0; px < x.W; px += range(x.r, 5, 12)) wrap(x, px, 6, (q) => {
        const h = range(x.r, 50, 120), b = at(y, q, x.W) + 10;
        c.strokeStyle = shade(x.col, range(x.r, -0.1, 0.1)); c.lineWidth = 3; c.beginPath(); c.moveTo(q, b); c.quadraticCurveTo(q + range(x.r, -8, 8), b - h * 0.6, q + range(x.r, -12, 12), b - h); c.stroke();
        if (x.r() < 0.3) { c.fillStyle = "#6A4426"; c.beginPath(); c.ellipse(q, b - h * 0.8, 4, 12, 0, 0, Math.PI * 2); c.fill(); }
      });
    },
  ],
  honey: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[1, 1], [3, 0.5]]), 280, 170); ridge(x, y, shade(x.col, 0.08), x.col);
      c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let i = 0; i < 16; i++) { const yy = 300 + i * 20; c.strokeStyle = rgba(i % 2 ? "#9B7BD8" : "#B9A0E8", 0.5); c.lineWidth = 6; c.beginPath(); for (let px = 0; px <= x.W; px += 20) c.lineTo(px, yy + Math.sin(px / 140 + i) * 10); c.stroke(); }
      c.restore(); mist(x, 340, 600, 0.55);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.3]]), 400, 80); ridge(x, y, x.col, shade(x.col, -0.15), 0.2);
      for (let px = 0; px < x.W; px += range(x.r, 16, 26)) wrap(x, px, 20, (q) => {
        const b = at(y, q, x.W) + 20, h = range(x.r, 70, 110);
        c.strokeStyle = shade(x.col, -0.25); c.lineWidth = 3; c.beginPath(); c.moveTo(q, b); c.lineTo(q, b - h); c.stroke();
        const fx = q + (x.lightR ? 3 : -3), fy = b - h;
        c.fillStyle = "#FFC21A"; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; c.beginPath(); c.ellipse(fx + Math.cos(a) * 11, fy + Math.sin(a) * 11, 8, 4, a, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = "#6A3E1A"; c.beginPath(); c.arc(fx, fy, 8, 0, Math.PI * 2); c.fill();
      });
      mist(x, 480, 600, 0.25);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 490, 50); ridge(x, y, x.col, shade(x.col, -0.2), 0);
      for (let px = 0; px < x.W; px += range(x.r, 30, 60)) wrap(x, px, 30, (q) => bush(x, q, at(y, q, x.W) + 16, range(x.r, 40, 70), mix(x.col, "#9B7BD8", 0.35)));
      for (let px = 0; px < x.W; px += range(x.r, 180, 320)) wrap(x, px, 40, (q) => {
        // a stack of hive boxes
        const b = at(y, q, x.W) + 6;
        for (let k = 0; k < 3; k++) { c.fillStyle = ["#F2C14E", "#E8A93A", "#F7D27A"][k]; c.fillRect(q - 26, b - 22 - k * 22, 52, 20); c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(q - 26, b - 4 - k * 22, 52, 3); }
        c.fillStyle = "#D98A2E"; c.fillRect(q - 30, b - 72, 60, 8);
      });
    },
  ],
  henhill: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[1, 1], [3, 0.4]]), 300, 150); ridge(x, y, shade(x.col, 0.1), x.col); facets(x, y, 0.1);
      for (let px = 0; px < x.W; px += range(x.r, 30, 70)) wrap(x, px, 12, (q) => roundTree(x, q, at(y, q, x.W) + 4, range(x.r, 20, 34), shade(x.col, -0.12)));
      const bx = range(x.r, 300, 1300), b = at(y, bx, x.W) + 6;
      c.fillStyle = shade("#B8483A", -x.night * 0.4); c.fillRect(bx, b - 26, 40, 26); c.beginPath(); c.moveTo(bx - 4, b - 24); c.lineTo(bx + 20, b - 40); c.lineTo(bx + 44, b - 24); c.fill();
      c.fillStyle = shade("#C9CCD6", -x.night * 0.4); c.fillRect(bx + 48, b - 52, 14, 52); c.beginPath(); c.arc(bx + 55, b - 52, 7, Math.PI, 0); c.fill();
      mist(x, 360, 600, 0.5);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [4, 0.3]]), 400, 80); ridge(x, y, mix(x.col, "#E8C25A", 0.3), shade(x.col, -0.1), 0.25);
      c.save(); shape(c, y, x.W, x.H); c.clip(); c.strokeStyle = rgba("#FFE89A", 0.25); c.lineWidth = 2;
      for (let px = 0; px < x.W; px += 6) { c.beginPath(); c.moveTo(px, at(y, px, x.W)); c.lineTo(px + 3, at(y, px, x.W) + 14); c.stroke(); }
      c.restore();
      for (let px = range(x.r, 100, 300); px < x.W; px += range(x.r, 500, 800)) wrap(x, px, 90, (q) => {
        const b = at(y, q, x.W) + 8, w = 120, h = 80;
        c.fillStyle = shade("#C2402F", -x.night * 0.45); c.fillRect(q - w / 2, b - h, w, h);
        c.beginPath(); c.moveTo(q - w * 0.6, b - h); c.lineTo(q - w * 0.3, b - h - 40); c.lineTo(q + w * 0.3, b - h - 40); c.lineTo(q + w * 0.6, b - h); c.fill();
        c.strokeStyle = "#F4EFE6"; c.lineWidth = 4; c.strokeRect(q - 20, b - 50, 40, 50); c.beginPath(); c.moveTo(q - 20, b - 50); c.lineTo(q + 20, b); c.moveTo(q + 20, b - 50); c.lineTo(q - 20, b); c.stroke();
        windowGlow(x, q - 10, b - h - 30, 20, 16);
        c.fillStyle = shade("#D7DBE5", -x.night * 0.45); c.fillRect(q + w * 0.62, b - 140, 34, 140); c.beginPath(); c.arc(q + w * 0.62 + 17, b - 140, 17, Math.PI, 0); c.fill();
      });
      mist(x, 470, 600, 0.25);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 490, 50); ridge(x, y, x.col, shade(x.col, -0.22), 0);
      for (let px = 0; px < x.W; px += 4) { const b = at(y, px, x.W) + 12; c.strokeStyle = shade(x.col, range(x.r, -0.1, 0.15)); c.lineWidth = 2; c.beginPath(); c.moveTo(px, b); c.lineTo(px + range(x.r, -6, 6), b - range(x.r, 16, 46)); c.stroke(); }
      c.strokeStyle = shade("#9A6A40", -x.night * 0.5); c.lineWidth = 5;
      for (let px = 0; px <= x.W; px += 60) { c.beginPath(); c.moveTo(px, at(y, px, x.W) + 14); c.lineTo(px, at(y, px, x.W) - 36); c.stroke(); }
      for (const dy of [26, 10]) { c.beginPath(); for (let px = 0; px <= x.W; px += 10) c.lineTo(px, at(y, px, x.W) - dy); c.stroke(); }
    },
  ],
  redrock: [
    (x) => {
      const { c } = x; const p = profile(x.r, x.W, [[2, 1], [5, 0.5]]);
      // flat-topped mesas: quantise the profile into plateaus
      const q = new Float32Array(p.length); for (let i = 0; i < p.length; i++) q[i] = Math.round(p[i] * 4) / 4;
      const sm = new Float32Array(q); for (let pass = 0; pass < 6; pass++) for (let i = 1; i < sm.length - 1; i++) sm[i] = (sm[i - 1] + sm[i] * 2 + sm[i + 1]) / 4;
      const y = ys(sm, 220, 200); ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.08)); facets(x, y, 0.22);
      c.save(); shape(c, y, x.W, x.H); c.clip(); for (let i = 0; i < 9; i++) { c.fillStyle = rgba(i % 2 ? "#FFE0C0" : "#7A2A1A", 0.08); c.fillRect(0, 240 + i * 22, x.W, 9); } c.restore();
      mist(x, 330, 600, 0.6);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [6, 0.3]]), 420, 70); ridge(x, y, x.col, shade(x.col, -0.2), 0.3);
      for (let px = range(x.r, 80, 200); px < x.W; px += range(x.r, 260, 420)) wrap(x, px, 120, (q) => {
        const b = at(y, q, x.W) + 10;
        if (x.r() < 0.45) {
          // a stone arch
          const w = range(x.r, 160, 220), h = range(x.r, 120, 170);
          c.fillStyle = x.col; c.beginPath(); c.moveTo(q - w / 2, b); c.lineTo(q - w / 2 + 10, b - h); c.quadraticCurveTo(q, b - h - 30, q + w / 2 - 10, b - h); c.lineTo(q + w / 2, b); c.lineTo(q + w * 0.28, b); c.quadraticCurveTo(q, b - h * 1.1, q - w * 0.28, b); c.closePath(); c.fill();
          c.fillStyle = rgba(x.l.light, 0.15); c.fillRect(x.lightR ? q + w / 2 - 30 : q - w / 2, b - h, 30, h);
        } else {
          // hoodoos: stacked rock spires with caps
          for (let k = 0; k < 3; k++) { const hx = q + (k - 1) * 40, hh = range(x.r, 90, 170); c.fillStyle = shade(x.col, k * 0.05); c.beginPath(); c.moveTo(hx - 16, b); c.lineTo(hx - 10, b - hh); c.lineTo(hx + 10, b - hh); c.lineTo(hx + 16, b); c.fill(); c.fillStyle = shade(x.col, -0.15); c.beginPath(); c.ellipse(hx, b - hh, 18, 8, 0, 0, Math.PI * 2); c.fill(); }
        }
      });
      mist(x, 470, 600, 0.3);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [8, 0.3]]), 480, 60); ridge(x, y, x.col, shade(x.col, -0.25), 0);
      for (let px = 0; px < x.W; px += range(x.r, 70, 150)) wrap(x, px, 40, (q) => {
        const b = at(y, q, x.W) + 12, h = range(x.r, 80, 150), col = mix(x.col, "#2E6A3A", 0.55);
        c.strokeStyle = col; c.lineCap = "round"; c.lineWidth = 16; c.beginPath(); c.moveTo(q, b); c.lineTo(q, b - h); c.stroke();
        c.lineWidth = 11; c.beginPath(); c.moveTo(q, b - h * 0.45); c.lineTo(q - 24, b - h * 0.45); c.lineTo(q - 24, b - h * 0.75); c.stroke();
        c.beginPath(); c.moveTo(q, b - h * 0.6); c.lineTo(q + 22, b - h * 0.6); c.lineTo(q + 22, b - h * 0.85); c.stroke(); c.lineCap = "butt";
      });
      for (let px = 0; px < x.W; px += range(x.r, 50, 110)) wrap(x, px, 30, (q) => { c.fillStyle = shade(x.col, -0.1); c.beginPath(); c.ellipse(q, at(y, q, x.W) + 14, range(x.r, 16, 34), range(x.r, 10, 20), 0, Math.PI, 0); c.fill(); });
    },
  ],
  glowcap: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.4]]), 300, 150); ridge(x, y, x.col, shade(x.col, -0.1), 0);
      for (let px = 0; px < x.W; px += range(x.r, 40, 80)) wrap(x, px, 40, (q) => { const b = at(y, q, x.W) + 20, h = range(x.r, 90, 170); c.fillStyle = shade(x.col, -0.1); c.fillRect(q - 5, b - h, 10, h); c.beginPath(); c.arc(q, b - h, h * 0.28, 0, Math.PI * 2); c.fill(); });
      for (let i = 0; i < 120; i++) { const px = range(x.r, 0, x.W), py = range(x.r, 280, 560); c.fillStyle = rgba(x.r() < 0.5 ? x.l.glow : "#B46CFF", range(x.r, 0.2, 0.7)); c.beginPath(); c.arc(px, py, range(x.r, 1, 3), 0, Math.PI * 2); c.fill(); }
      mist(x, 340, 600, 0.55);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [4, 0.3]]), 420, 70); ridge(x, y, x.col, shade(x.col, -0.2), 0);
      for (let px = range(x.r, 40, 120); px < x.W; px += range(x.r, 150, 260)) wrap(x, px, 130, (q) => {
        const b = at(y, q, x.W) + 16, h = range(x.r, 150, 260), cw = h * range(x.r, 0.45, 0.6);
        const cap = x.r() < 0.5 ? "#7A4ADB" : x.r() < 0.5 ? "#2AA89A" : "#C8508E";
        c.fillStyle = mix("#E8DFF7", x.col, 0.45); c.beginPath(); c.moveTo(q - h * 0.06, b); c.quadraticCurveTo(q - h * 0.1, b - h * 0.5, q - h * 0.04, b - h); c.lineTo(q + h * 0.04, b - h); c.quadraticCurveTo(q + h * 0.1, b - h * 0.5, q + h * 0.06, b); c.fill();
        c.fillStyle = rgba(x.l.glow, 0.25); c.beginPath(); c.ellipse(q, b - h + 6, cw * 0.9, cw * 0.18, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = shade(cap, -0.3); c.beginPath(); c.ellipse(q, b - h, cw, cw * 0.16, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = cap; c.beginPath(); c.ellipse(q, b - h - 4, cw, cw * 0.55, 0, Math.PI, 0); c.fill();
        for (let k = 0; k < 7; k++) { const a = Math.PI + range(x.r, 0.2, 2.9); c.fillStyle = rgba(x.l.glow, 0.85); c.beginPath(); c.arc(q + Math.cos(a) * cw * 0.7, b - h - 4 + Math.sin(a) * cw * 0.38, range(x.r, 3, 8), 0, Math.PI * 2); c.fill(); }
        const g = c.createRadialGradient(q, b - h, 0, q, b - h, cw * 1.6); g.addColorStop(0, rgba(cap, 0.3)); g.addColorStop(1, rgba(cap, 0)); c.fillStyle = g; c.fillRect(q - cw * 1.6, b - h - cw * 1.6, cw * 3.2, cw * 3.2);
      });
      mist(x, 470, 600, 0.3);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [8, 0.3]]), 490, 50); ridge(x, y, x.col, shade(x.col, -0.25), 0);
      for (let px = 0; px < x.W; px += range(x.r, 30, 70)) wrap(x, px, 30, (q) => {
        const b = at(y, q, x.W) + 14;
        // fern fronds
        c.strokeStyle = shade(x.col, 0.12); c.lineWidth = 3;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(q, b); c.quadraticCurveTo(q + k * 14, b - 40, q + k * 26, b - range(x.r, 30, 60)); c.stroke(); }
        if (x.r() < 0.5) { const h = range(x.r, 24, 44); c.fillStyle = "#E8DFF7"; c.fillRect(q + 10, b - h, 5, h); c.fillStyle = x.l.glow; c.beginPath(); c.ellipse(q + 12, b - h, 14, 9, 0, Math.PI, 0); c.fill(); }
      });
    },
  ],
  timber: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.6], [11, 0.15]]), 120, 300); ridge(x, y, shade(x.col, 0.1), x.col); facets(x, y, 0.3);
      // snow caps above a line
      c.save(); shape(c, y, x.W, x.H); c.clip(); c.fillStyle = vgrad(c, 120, 260, [[0, "rgba(255,255,255,0.95)"], [1, "rgba(255,255,255,0)"]]); c.fillRect(0, 100, x.W, 170); c.restore();
      mist(x, 300, 600, 0.7);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [4, 0.4]]), 360, 110); ridge(x, y, x.col, shade(x.col, -0.2), 0);
      for (let px = 0; px < x.W; px += range(x.r, 16, 28)) wrap(x, px, 30, (q) => pine(x, q, at(y, q, x.W) + 30, range(x.r, 80, 130), mix(x.col, "#11291E", x.r() * 0.35)));
      const mx = range(x.r, 300, 1200), b = at(y, mx, x.W) + 20;
      // the sawmill: a long shed, a water wheel and a flume
      c.fillStyle = shade("#8E5A36", -x.night * 0.45); c.fillRect(mx - 90, b - 60, 180, 60);
      c.fillStyle = shade("#5A3A26", -x.night * 0.45); c.beginPath(); c.moveTo(mx - 100, b - 58); c.lineTo(mx, b - 100); c.lineTo(mx + 100, b - 58); c.fill();
      windowGlow(x, mx - 60, b - 42, 22, 16); windowGlow(x, mx + 38, b - 42, 22, 16);
      c.strokeStyle = shade("#6A4426", -x.night * 0.4); c.lineWidth = 6; c.beginPath(); c.arc(mx + 120, b - 30, 34, 0, Math.PI * 2); c.stroke();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.moveTo(mx + 120, b - 30); c.lineTo(mx + 120 + Math.cos(a) * 34, b - 30 + Math.sin(a) * 34); c.stroke(); }
      mist(x, 440, 600, 0.35);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 480, 60); ridge(x, y, x.col, shade(x.col, -0.25), 0);
      for (let px = 0; px < x.W; px += range(x.r, 80, 160)) wrap(x, px, 60, (q) => pine(x, q, at(y, q, x.W) + 40, range(x.r, 170, 250), shade(x.col, range(x.r, -0.15, 0.05))));
      for (let px = range(x.r, 100, 300); px < x.W; px += range(x.r, 350, 600)) wrap(x, px, 70, (q) => {
        // a log pile: round ends stacked
        const b = at(y, q, x.W) + 10;
        for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) { const cx = q - 45 + row * 15 + k * 30, cy = b - 14 - row * 26; c.fillStyle = shade("#C08A58", -x.night * 0.45); c.beginPath(); c.arc(cx, cy, 14, 0, Math.PI * 2); c.fill(); c.strokeStyle = shade("#8A5A32", -x.night * 0.45); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.stroke(); }
      });
    },
  ],
  frost: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [6, 0.5], [13, 0.12]]), 150, 270); ridge(x, y, shade(x.col, 0.2), x.col); facets(x, y, 0.28);
      c.save(); shape(c, y, x.W, x.H); c.clip(); c.fillStyle = vgrad(c, 150, 330, [[0, "rgba(255,255,255,0.8)"], [1, "rgba(255,255,255,0)"]]); c.fillRect(0, 140, x.W, 200); c.restore();
      mist(x, 300, 600, 0.65);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.3]]), 400, 80); ridge(x, y, shade(x.col, 0.35), shade(x.col, 0.1), 0.3);
      for (let px = 0; px < x.W; px += range(x.r, 30, 60)) wrap(x, px, 20, (q) => pine(x, q, at(y, q, x.W) + 18, range(x.r, 60, 90), shade(x.col, -0.2), true));
      for (let px = range(x.r, 40, 160); px < x.W; px += range(x.r, 150, 260)) wrap(x, px, 60, (q) => {
        const b = at(y, q, x.W) + 12, w = range(x.r, 60, 90);
        house(x, q, b, w, w * 0.62, shade(["#C96B5A", "#5A86C9", "#E0B05A"][Math.floor(x.r() * 3)], -0.1 - x.night * 0.3), shade("#5A4A6A", -x.night * 0.3), true, true);
        // chimney smoke
        c.fillStyle = rgba("#FFFFFF", 0.35); for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(q + w * 0.27 + k * 6, b - w * 1.05 - k * 16, 6 + k * 3, 0, Math.PI * 2); c.fill(); }
      });
      mist(x, 470, 600, 0.3);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [8, 0.3]]), 480, 60); ridge(x, y, shade(x.col, 0.55), shade(x.col, 0.25), 0.4);
      for (let px = 0; px < x.W; px += range(x.r, 90, 170)) wrap(x, px, 60, (q) => pine(x, q, at(y, q, x.W) + 30, range(x.r, 160, 230), shade(x.col, -0.3), true));
      for (let px = range(x.r, 50, 200); px < x.W; px += range(x.r, 260, 420)) wrap(x, px, 20, (q) => {
        const b = at(y, q, x.W) + 8;
        c.fillStyle = "#2A3046"; c.fillRect(q - 3, b - 110, 6, 110); c.fillRect(q - 10, b - 116, 20, 8);
        c.fillStyle = x.night > 0.2 ? "#FFE08A" : "#E8EEF8"; c.beginPath(); c.arc(q, b - 122, 9, 0, Math.PI * 2); c.fill();
        if (x.night > 0.2) { const g = c.createRadialGradient(q, b - 122, 0, q, b - 122, 70); g.addColorStop(0, rgba("#FFD27A", 0.45 * x.night)); g.addColorStop(1, rgba("#FFD27A", 0)); c.fillStyle = g; c.fillRect(q - 70, b - 192, 140, 140); }
      });
    },
  ],
  blossom: [
    (x) => {
      const { c } = x;
      // ink-wash ranges, each fading into the mist below it
      for (let k = 0; k < 3; k++) {
        const y = ys(profile(x.r, x.W, [[2 + k, 1], [6, 0.35]]), 170 + k * 70, 150);
        shape(c, y, x.W, x.H); c.fillStyle = vgrad(c, 170 + k * 70, 420 + k * 40, [[0, mix(x.col, x.l.haze, 0.35 - k * 0.1)], [1, rgba(x.l.haze, 0)]]); c.fill();
      }
      const px = range(x.r, 200, 1400), b = 330;
      c.fillStyle = mix(x.col, "#3A2A3A", 0.3);
      for (let k = 0; k < 4; k++) { const w = 46 - k * 8; c.fillRect(px - w * 0.4, b - k * 26 - 18, w * 0.8, 18); c.beginPath(); c.moveTo(px - w, b - k * 26 - 16); c.quadraticCurveTo(px, b - k * 26 - 30, px + w, b - k * 26 - 16); c.lineTo(px + w * 0.7, b - k * 26 - 12); c.lineTo(px - w * 0.7, b - k * 26 - 12); c.fill(); }
      mist(x, 330, 600, 0.6);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[2, 1], [3, 0.4]]), 330, 160); ridge(x, y, x.col, shade(x.col, -0.15), 0.25);
      // the terraces: stepped bands of tea bushes following the hill
      c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let i = 0; i < 14; i++) {
        const dy = 14 + i * 22;
        c.strokeStyle = rgba(i % 2 ? shade(x.col, 0.2) : shade(x.col, -0.12), 0.9); c.lineWidth = 9;
        c.beginPath(); for (let px = 0; px <= x.W; px += 8) c.lineTo(px, at(y, px, x.W) + dy); c.stroke();
        c.strokeStyle = rgba("#2A3A2A", 0.2); c.lineWidth = 2; c.beginPath(); for (let px = 0; px <= x.W; px += 8) c.lineTo(px, at(y, px, x.W) + dy + 6); c.stroke();
      }
      c.restore();
      mist(x, 440, 600, 0.3);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 490, 50); ridge(x, y, x.col, shade(x.col, -0.22), 0);
      for (let px = 0; px < x.W; px += range(x.r, 110, 200)) wrap(x, px, 90, (q) => {
        const b = at(y, q, x.W) + 16, h = range(x.r, 150, 210);
        c.strokeStyle = shade("#4A2E32", -x.night * 0.3); c.lineCap = "round"; c.lineWidth = 12;
        c.beginPath(); c.moveTo(q, b); c.quadraticCurveTo(q - 20, b - h * 0.5, q + 10, b - h * 0.75); c.stroke();
        c.lineWidth = 6; c.beginPath(); c.moveTo(q - 6, b - h * 0.5); c.quadraticCurveTo(q - 50, b - h * 0.6, q - 70, b - h * 0.7); c.stroke(); c.beginPath(); c.moveTo(q + 4, b - h * 0.62); c.quadraticCurveTo(q + 50, b - h * 0.7, q + 66, b - h * 0.82); c.stroke(); c.lineCap = "butt";
        for (let k = 0; k < 14; k++) { c.fillStyle = [shade("#FFB3CF", -x.night * 0.35), shade("#FF8FB8", -x.night * 0.35), shade("#FFD6E6", -x.night * 0.35)][k % 3]; c.beginPath(); c.arc(q + range(x.r, -90, 90), b - h * 0.78 + range(x.r, -40, 30), range(x.r, 18, 32), 0, Math.PI * 2); c.fill(); }
      });
      for (let px = 0; px < x.W; px += range(x.r, 40, 80)) wrap(x, px, 30, (q) => bush(x, q, at(y, q, x.W) + 16, range(x.r, 30, 50), shade(x.col, 0.08)));
    },
  ],
  ember: [
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[1, 1], [3, 0.3], [9, 0.08]]), 160, 260);
      // the volcano: one tall cone in the middle of the strip
      const cone = new Float32Array(y.length);
      for (let i = 0; i <= x.W; i++) { const u = Math.abs(i - x.W * 0.5) / (x.W * 0.32); cone[i] = Math.min(y[i], u < 1 ? 120 + Math.pow(u, 1.3) * 300 : 600); }
      ridge(x, cone, shade(x.col, 0.05), shade(x.col, -0.1), 0.2); facets(x, cone, 0.25);
      c.save(); shape(c, cone, x.W, x.H); c.clip();
      for (let k = 0; k < 4; k++) { c.strokeStyle = rgba("#FF7A2A", 0.75); c.lineWidth = 4 - k * 0.6; c.beginPath(); let px = x.W * 0.5 + range(x.r, -12, 12), py = 128; c.moveTo(px, py); for (let s = 0; s < 14; s++) { px += range(x.r, -18, 18) + (k - 1.5) * 4; py += 22; c.lineTo(px, py); } c.stroke(); }
      c.restore();
      const g = c.createRadialGradient(x.W * 0.5, 120, 0, x.W * 0.5, 120, 160); g.addColorStop(0, "rgba(255,150,60,0.7)"); g.addColorStop(1, "rgba(255,90,40,0)"); c.fillStyle = g; c.fillRect(x.W * 0.5 - 160, 0, 320, 300);
      mist(x, 330, 600, 0.55);
    },
    (x) => {
      const { c } = x; const p = profile(x.r, x.W, [[3, 1], [7, 0.6], [17, 0.2]]);
      const y = ys(p, 380, 120); ridge(x, y, x.col, shade(x.col, -0.2), 0); facets(x, y, 0.3);
      // lava rivers glowing in the cracks
      c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let k = 0; k < 6; k++) { const px = range(x.r, 0, x.W); c.strokeStyle = rgba("#FF8A3A", 0.8); c.lineWidth = 5; c.beginPath(); let qx = px, qy = at(y, px, x.W); c.moveTo(qx, qy); while (qy < 600) { qx += range(x.r, -14, 14); qy += 18; c.lineTo(qx, qy); } c.stroke(); c.strokeStyle = rgba("#FFD27A", 0.9); c.lineWidth = 2; c.stroke(); }
      c.restore();
      mist(x, 460, 600, 0.35);
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [9, 0.35]]), 480, 60); ridge(x, y, x.col, shade(x.col, -0.3), 0);
      for (let px = 0; px < x.W; px += range(x.r, 90, 180)) wrap(x, px, 60, (q) => {
        const b = at(y, q, x.W) + 10, h = range(x.r, 120, 190);
        c.strokeStyle = shade(x.col, -0.2); c.lineCap = "round"; c.lineWidth = 9; c.beginPath(); c.moveTo(q, b); c.lineTo(q + 6, b - h); c.stroke();
        c.lineWidth = 5; for (let k = 0; k < 4; k++) { const by = b - h * (0.4 + k * 0.15), dir = k % 2 ? 1 : -1; c.beginPath(); c.moveTo(q + 3, by); c.lineTo(q + dir * range(x.r, 24, 46), by - range(x.r, 16, 40)); c.stroke(); }
        c.lineCap = "butt";
      });
      for (let i = 0; i < 40; i++) { const px = range(x.r, 0, x.W), py = at(y, px, x.W) + range(x.r, 6, 40); c.fillStyle = rgba("#FF9A3A", range(x.r, 0.4, 0.9)); c.beginPath(); c.arc(px, py, range(x.r, 2, 5), 0, Math.PI * 2); c.fill(); }
    },
  ],
  starfall: [
    (x) => { const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.5], [12, 0.12]]), 250, 200); ridge(x, y, shade(x.col, 0.15), x.col, 0.4); facets(x, y, 0.32); mist(x, 360, 600, 0.4); },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 410, 70); ridge(x, y, x.col, shade(x.col, -0.2), 0.35);
      c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let i = 0; i < 16; i++) { const px = range(x.r, 0, x.W), py = at(y, px, x.W) + range(x.r, 20, 140), rr = range(x.r, 14, 40); c.fillStyle = rgba("#000018", 0.25); c.beginPath(); c.ellipse(px, py, rr, rr * 0.35, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = rgba(x.l.light, 0.25); c.lineWidth = 2; c.beginPath(); c.ellipse(px, py - 2, rr, rr * 0.35, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
      c.restore();
      for (let px = range(x.r, 60, 200); px < x.W; px += range(x.r, 300, 500)) wrap(x, px, 80, (q) => {
        const b = at(y, q, x.W) + 12;
        c.fillStyle = shade("#C9D2EE", -0.35); c.beginPath(); c.arc(q, b, 60, Math.PI, 0); c.fill();
        c.fillStyle = rgba("#7CE7FF", 0.25 + 0.25 * x.night); c.beginPath(); c.arc(q, b, 52, Math.PI, 0); c.fill();
        for (let k = 0; k < 4; k++) { c.fillStyle = "#FFE08A"; c.fillRect(q - 36 + k * 20, b - 14, 8, 6); }
        c.strokeStyle = "#8E96B8"; c.lineWidth = 3; c.beginPath(); c.moveTo(q + 80, b); c.lineTo(q + 80, b - 90); c.stroke();
        c.fillStyle = "#FF5A6A"; c.beginPath(); c.arc(q + 80, b - 92, 4, 0, Math.PI * 2); c.fill();
      });
    },
    (x) => {
      const { c } = x; const y = ys(profile(x.r, x.W, [[3, 1], [9, 0.4]]), 480, 60); ridge(x, y, x.col, shade(x.col, -0.25), 0.3);
      for (let px = 0; px < x.W; px += range(x.r, 40, 100)) wrap(x, px, 40, (q) => {
        const b = at(y, q, x.W) + 12;
        if (x.r() < 0.5) { c.fillStyle = shade(x.col, 0.12); c.beginPath(); c.ellipse(q, b, range(x.r, 20, 46), range(x.r, 14, 30), 0, Math.PI, 0); c.fill(); }
        else {
          const col = x.r() < 0.5 ? "#7CE7FF" : "#B9A6FF";
          for (let k = 0; k < 3; k++) { const h = range(x.r, 24, 60); c.fillStyle = rgba(col, 0.85); c.beginPath(); c.moveTo(q + k * 12 - 6, b); c.lineTo(q + k * 12 + (k - 1) * 8, b - h); c.lineTo(q + k * 12 + 6, b); c.fill(); }
          const g = c.createRadialGradient(q + 10, b - 20, 0, q + 10, b - 20, 60); g.addColorStop(0, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(q - 50, b - 80, 120, 120);
        }
      });
    },
  ],
};

/** paint one layer of a world (also used by the world thumbnails) */
export function paintStrip(world: WorldId, layer: 0 | 1 | 2, col: string, look: Look, seed: number, res: number): Strip {
  const W = STRIP_W, H = STRIP_H;
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * res); cv.height = Math.round(H * res);
  const c = cv.getContext("2d")!;
  c.setTransform(res, 0, 0, res, 0, 0);
  const x: Ctx = { c, W, H, col, l: look, r: makeRng(seed * 31 + layer * 977 + 5), lightR: look.sunX > 0.5, layer, night: look.night };
  PAINT[world][layer](x);
  // the layer's bottom colour (what continues below the strip)
  const data = c.getImageData(Math.round(W * res * 0.5), cv.height - 2, 1, 1).data;
  const base = `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return { canvas: cv, base };
}

/** a stage's three layers: the world's own, with a remix partner's scenery in the middle layer */
export function paintBackdrop(look: Look, seed: number, res: number): Backdrop {
  const w = look.world.id, p = look.partner?.id;
  const strips = [0, 1, 2].map((i) => paintStrip(i === 1 && p ? p : w, i as 0 | 1 | 2, look.layers[i], look, seed + i, res)) as [Strip, Strip, Strip];
  return { strips };
}
