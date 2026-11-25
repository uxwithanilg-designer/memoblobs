// The painted scenery behind the track: three layers per world (far, mid, near), each painted once per race into a
// strip that tiles seamlessly, then scrolled with parallax every frame (one image draw per layer: cheap on phones).
// Every world has its own scene: dune ranges with pyramids, a sun temple and palm oases; a smoking volcano over a
// ruined city with lava seams; ice peaks, ice shelves, icebergs and a polar station; a neon city skyline, container
// stacks, harbour cranes and a ship; jungle karst towers with waterfalls and a stepped temple in the canopy; factory
// stacks, junk mountains and a magnet crane; the sea at sunset with a pier, a big wheel and a coaster; striped buttes,
// mine mouths, a timber trestle and a headframe; storm peaks and a lonely weather tower; soft-serve mountains,
// gumdrop hills and lollipop groves; red planet mesas, craters, habitat domes and a launch tower; and floating sky
// islands with waterfalls pouring into a sea of clouds. Light comes from the sun's side, far layers fade into the
// haze, and windows, neon and lava glow come up at night.
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
/** jagged peaks: a profile with its crests sharpened */
function peaks(r: Rng, W: number, n: number, top: number, span: number) {
  const p = profile(r, W, [[n, 1], [n * 2 + 1, 0.35], [n * 5 + 2, 0.08]]);
  for (let i = 0; i < p.length; i++) p[i] = Math.pow(p[i], 1.8);
  return ys(p, top, span);
}
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
/** facet light: the slopes facing the sun a touch brighter, the others shaded, painted small and scaled up so it
 * reads as soft painted light */
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
    const sl = ((b - a) / 24) * dir;
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
/** snow on the upper part of a range (above the line `line`) */
function caps(x: Ctx, y: Float32Array, line: number, col = "#F6FAFF") {
  const { c, W, H } = x;
  c.save(); shape(c, y, W, H); c.clip();
  c.beginPath(); c.moveTo(0, 0);
  for (let i = 0; i <= W; i += 8) c.lineTo(i, line + Math.sin(i * 0.05) * 10 + Math.sin(i * 0.013) * 16);
  c.lineTo(W, 0); c.closePath();
  c.fillStyle = shade(col, -x.night * 0.45); c.fill();
  c.restore();
}
function mist(x: Ctx, y0: number, y1: number, a: number) {
  const { c, W } = x;
  c.fillStyle = vgrad(c, y0, y1, [[0, rgba(x.l.haze, 0)], [1, rgba(x.l.haze, a)]]);
  c.fillRect(0, y0, W, y1 - y0);
}
/** draw at x, and again one strip-width over when it pokes across a seam (with the same random numbers, so both
 * copies match and the seam can't be seen) */
function wrap(x: Ctx, px: number, half: number, fn: (px: number) => void) {
  const seed = Math.floor(x.r() * 1e9), outer = x.r;
  const run = (q: number) => { x.r = makeRng(seed); fn(q); };
  run(px);
  if (px - half < 0) run(px + x.W);
  if (px + half > x.W) run(px - x.W);
  x.r = outer;
}
const at = (y: Float32Array, px: number, W: number) => y[clamp(Math.round(((px % W) + W) % W), 0, W)];
/** how strong the sunlit side is (it fades at night) */
const sunlit = (x: Ctx, a: number) => a * (1 - x.night * 0.7);
/** a fixed colour (paint, candy, metal) graded into the layer: tinted, hazed with distance, darkened at night */
function tone(x: Ctx, hex: string, extra = 0) {
  return shade(mix(mix(hex, x.l.tint, x.l.tintAmt * 0.6), x.l.haze, [0.42, 0.2, 0.05][x.layer] + extra), -x.night * 0.5);
}
function glow(x: Ctx, px: number, py: number, rr: number, col: string, a: number) {
  if (a <= 0.01) return;
  const { c } = x;
  const g = c.createRadialGradient(px, py, 0, px, py, rr);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(px - rr, py - rr, rr * 2, rr * 2);
}
function windowGlow(x: Ctx, wx: number, wy: number, w: number, h: number) {
  const { c } = x;
  const lit = x.night > 0.25;
  c.fillStyle = lit ? mix("#FFC861", "#FFE9A8", 0.3) : shade(x.col, -0.35);
  c.fillRect(wx, wy, w, h);
  if (lit) glow(x, wx + w / 2, wy + h / 2, Math.max(w, h) * 1.8, "#FFD27A", 0.25 * x.night);
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
    c.fillStyle = rgba(x.l.light, sunlit(x, 0.14));
    c.beginPath(); c.moveTo(px, t0 - th); c.lineTo(px + (x.lightR ? tw : -tw), t0); c.lineTo(px, t0 - th * 0.12); c.fill();
    if (snow) { c.fillStyle = rgba("#FFFFFF", 0.85 - x.night * 0.3); c.beginPath(); c.moveTo(px - tw * 0.55, t0 - th * 0.42); c.lineTo(px, t0 - th); c.lineTo(px + tw * 0.55, t0 - th * 0.42); c.quadraticCurveTo(px, t0 - th * 0.55, px - tw * 0.55, t0 - th * 0.42); c.fill(); }
  }
}
function roundTree(x: Ctx, px: number, base: number, h: number, col: string, fruit?: string) {
  const { c, r } = x;
  c.fillStyle = shade(col, -0.35); c.fillRect(px - h * 0.04, base - h * 0.45, h * 0.08, h * 0.46);
  const cr = h * 0.33, cy = base - h * 0.62;
  c.fillStyle = col;
  for (const [ox, oy, rr] of TREE_BLOBS) { c.beginPath(); c.arc(px + ox * cr, cy + oy * cr, rr * cr, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = rgba(x.l.light, sunlit(x, 0.16));
  c.beginPath(); c.arc(px + (x.lightR ? 0.3 : -0.3) * cr, cy - 0.3 * cr, cr * 0.55, 0, Math.PI * 2); c.fill();
  if (fruit) { c.fillStyle = fruit; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(px + range(r, -0.8, 0.8) * cr, cy + range(r, -0.6, 0.6) * cr, cr * 0.09, 0, Math.PI * 2); c.fill(); } }
}
const TREE_BLOBS = [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.22, 0.72], [-0.2, -0.45, 0.62], [0.3, -0.38, 0.6]] as const;
function bush(x: Ctx, px: number, base: number, w: number, col: string) {
  const { c } = x;
  c.fillStyle = col;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(px + (i - 1.5) * w * 0.28, base - w * 0.18 - (i % 2) * w * 0.1, w * 0.26, 0, Math.PI * 2); c.fill(); }
  c.fillRect(px - w * 0.55, base - w * 0.18, w * 1.1, w * 0.2);
  c.fillStyle = rgba(x.l.light, sunlit(x, 0.12)); c.beginPath(); c.arc(px + (x.lightR ? 0.2 : -0.2) * w, base - w * 0.32, w * 0.18, 0, Math.PI * 2); c.fill();
}
function palm(x: Ctx, px: number, base: number, h: number, col: string) {
  const { c, r } = x;
  const lean = range(r, -0.28, 0.28) * h, tx = px + lean, ty = base - h, cx = px + lean * 0.15, cy = base - h * 0.6;
  c.lineCap = "round";
  c.strokeStyle = shade(col, -0.12); c.lineWidth = h * 0.055;
  c.beginPath(); c.moveTo(px, base); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
  c.strokeStyle = rgba(shade(col, -0.45), 0.55); c.lineWidth = Math.max(1, h * 0.008);
  for (let k = 1; k < 9; k++) {
    const u = k / 9, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
    const qx = a * px + b * cx + d * tx, qy = a * base + b * cy + d * ty;
    c.beginPath(); c.moveTo(qx - h * 0.028, qy + 1); c.lineTo(qx + h * 0.028, qy - 1); c.stroke();
  }
  const leaf = shade(mix(col, "#2E7A3A", 0.5), -0.05);
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI + (k / 7) * Math.PI + range(r, -0.12, 0.12);
    const L = h * range(r, 0.4, 0.52), s = Math.sin(a), co = Math.cos(a);
    const ex = tx + co * L, ey = ty + s * L * 0.45 + L * 0.5 * (1 - Math.abs(s));
    const mx = tx + co * L * 0.55, my = ty + s * L * 0.55 - L * 0.16;
    c.fillStyle = k % 2 ? leaf : shade(leaf, -0.12);
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my - L * 0.08, ex, ey); c.quadraticCurveTo(mx, my + L * 0.14, tx, ty); c.fill();
  }
  c.fillStyle = shade(col, -0.4);
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(tx + (k - 1) * h * 0.035, ty + h * 0.035, h * 0.028, 0, Math.PI * 2); c.fill(); }
}
function pyramid(x: Ctx, px: number, base: number, s: number, col: string) {
  const { c } = x;
  const h = s * 0.62, d = x.lightR ? 1 : -1;
  c.fillStyle = col; c.beginPath(); c.moveTo(px - s / 2, base); c.lineTo(px, base - h); c.lineTo(px + s / 2, base); c.closePath(); c.fill();
  c.fillStyle = rgba(x.l.light, sunlit(x, 0.24)); c.beginPath(); c.moveTo(px, base - h); c.lineTo(px + (d * s) / 2, base); c.lineTo(px + d * s * 0.1, base); c.closePath(); c.fill();
  c.strokeStyle = rgba(shade(col, -0.4), 0.22); c.lineWidth = 1;
  for (let k = 1; k < 10; k++) { const yy = base - (h * k) / 10, hw = (s / 2) * (1 - k / 10); c.beginPath(); c.moveTo(px - hw, yy); c.lineTo(px + hw, yy); c.stroke(); }
  c.fillStyle = mix("#FFD25A", col, 0.25 + x.night * 0.4);
  c.beginPath(); c.moveTo(px - s * 0.06, base - h * 0.9); c.lineTo(px, base - h); c.lineTo(px + s * 0.06, base - h * 0.9); c.closePath(); c.fill();
}
function column(x: Ctx, px: number, base: number, w: number, h: number, col: string, broken: boolean) {
  const { c } = x;
  c.fillStyle = shade(col, -0.12); c.fillRect(px - w * 0.72, base - w * 0.32, w * 1.44, w * 0.32);
  c.fillStyle = col;
  if (broken) {
    c.beginPath(); c.moveTo(px - w / 2, base - w * 0.3); c.lineTo(px - w / 2, base - h); c.lineTo(px - w * 0.12, base - h - w * 0.45);
    c.lineTo(px + w * 0.12, base - h + w * 0.15); c.lineTo(px + w / 2, base - h - w * 0.25); c.lineTo(px + w / 2, base - w * 0.3); c.closePath(); c.fill();
  } else {
    c.fillRect(px - w / 2, base - h, w, h - w * 0.3);
    c.fillStyle = shade(col, 0.08); c.fillRect(px - w * 0.78, base - h - w * 0.34, w * 1.56, w * 0.36);
  }
  c.strokeStyle = rgba(shade(col, -0.38), 0.4); c.lineWidth = Math.max(1, w * 0.05);
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(px + k * w * 0.24, base - w * 0.32); c.lineTo(px + k * w * 0.24, base - h + w * 0.35); c.stroke(); }
  c.fillStyle = rgba(x.l.light, sunlit(x, 0.18)); c.fillRect(x.lightR ? px + w * 0.18 : px - w / 2, base - h + w * 0.3, w * 0.32, h - w * 0.62);
}
function tower(x: Ctx, px: number, base: number, w: number, h: number, col: string, neon: string | null) {
  const { c, r } = x;
  c.fillStyle = col; c.fillRect(px, base - h, w, h);
  c.fillStyle = shade(col, 0.07); c.fillRect(x.lightR ? px + w * 0.72 : px, base - h, w * 0.28, h);
  const lit = x.night > 0.25;
  for (let wy = base - h + 7; wy < base - 6; wy += 9) for (let wx = px + 4; wx < px + w - 5; wx += 7) {
    if (r() < (lit ? 0.42 : 0.3)) { c.fillStyle = lit ? (r() < 0.75 ? "#FFD88A" : "#9AE8FF") : shade(col, -0.22); c.fillRect(wx, wy, 3, 4); }
  }
  if (neon) { c.fillStyle = neon; c.fillRect(px + w * 0.14, base - h - 9, w * 0.72, 5); glow(x, px + w / 2, base - h - 7, w * 0.8, neon, 0.4 * x.night); }
  if (r() < 0.55) {
    c.fillStyle = shade(col, -0.2); c.fillRect(px + w / 2 - 1, base - h - 26, 2, 26);
    c.fillStyle = "#FF4A4A"; c.beginPath(); c.arc(px + w / 2, base - h - 27, 2.5, 0, Math.PI * 2); c.fill();
    glow(x, px + w / 2, base - h - 27, 10, "#FF4A4A", 0.5 * x.night);
  }
}
const BOX = ["#D8402A", "#2A72D8", "#22A06A", "#E89A22", "#7A3AD8", "#D8D8DE", "#1E8A9A"];
function container(x: Ctx, px: number, base: number, w: number, h: number, col: string) {
  const { c } = x;
  c.fillStyle = col; c.fillRect(px, base - h, w, h);
  c.fillStyle = shade(col, -0.25);
  for (let k = px + 3; k < px + w - 2; k += 4) c.fillRect(k, base - h + 2, 1.2, h - 4);
  c.fillStyle = rgba("#FFFFFF", 0.14); c.fillRect(px, base - h, w, 1.5);
  c.fillStyle = shade(col, -0.4); c.fillRect(px, base - 1.5, w, 1.5);
}
function crane(x: Ctx, px: number, base: number, s: number, col: string) {
  const { c } = x;
  c.strokeStyle = col; c.lineCap = "butt";
  c.lineWidth = s * 0.035;
  c.beginPath();
  c.moveTo(px - s * 0.26, base); c.lineTo(px - s * 0.2, base - s * 0.72); c.moveTo(px + s * 0.26, base); c.lineTo(px + s * 0.2, base - s * 0.72);
  c.moveTo(px - s * 0.24, base - s * 0.36); c.lineTo(px + s * 0.24, base - s * 0.36);
  c.stroke();
  c.lineWidth = s * 0.012;
  c.beginPath(); c.moveTo(px - s * 0.24, base - s * 0.36); c.lineTo(px + s * 0.2, base - s * 0.72); c.moveTo(px + s * 0.24, base - s * 0.36); c.lineTo(px - s * 0.2, base - s * 0.72); c.stroke();
  c.fillStyle = col; c.fillRect(px - s * 1.0, base - s * 0.78, s * 1.5, s * 0.05);
  c.fillRect(px - s * 0.16, base - s * 0.9, s * 0.3, s * 0.12);
  c.lineWidth = s * 0.008; c.beginPath(); c.moveTo(px - s * 0.02, base - s * 0.9); c.lineTo(px - s * 0.02, base - s * 1.08); c.lineTo(px - s * 0.95, base - s * 0.78); c.moveTo(px - s * 0.02, base - s * 1.08); c.lineTo(px + s * 0.48, base - s * 0.78); c.stroke();
  c.beginPath(); c.moveTo(px - s * 0.7, base - s * 0.73); c.lineTo(px - s * 0.7, base - s * 0.45); c.stroke();
  c.fillRect(px - s * 0.76, base - s * 0.45, s * 0.12, s * 0.04);
  c.fillStyle = "#FF4A4A"; c.beginPath(); c.arc(px - s * 0.02, base - s * 1.09, 2.5, 0, Math.PI * 2); c.fill();
  glow(x, px - s * 0.02, base - s * 1.09, 12, "#FF4A4A", 0.5 * x.night);
}
function ferris(x: Ctx, px: number, base: number, R: number, col: string) {
  const { c } = x;
  const cy = base - R - R * 0.25;
  c.strokeStyle = col; c.lineWidth = R * 0.05;
  c.beginPath(); c.moveTo(px - R * 0.55, base); c.lineTo(px, cy); c.lineTo(px + R * 0.55, base); c.stroke();
  c.lineWidth = R * 0.035; c.beginPath(); c.arc(px, cy, R, 0, Math.PI * 2); c.stroke();
  c.lineWidth = R * 0.015; c.beginPath(); c.arc(px, cy, R * 0.82, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; c.moveTo(px, cy); c.lineTo(px + Math.cos(a) * R, cy + Math.sin(a) * R); }
  c.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8, gx = px + Math.cos(a) * R, gy = cy + Math.sin(a) * R;
    c.fillStyle = tone(x, BOX[k % BOX.length]); c.beginPath(); c.ellipse(gx, gy + R * 0.09, R * 0.07, R * 0.08, 0, 0, Math.PI * 2); c.fill();
    if (x.night > 0.3) { c.fillStyle = k % 2 ? "#FFE08A" : "#FF8AD0"; c.beginPath(); c.arc(gx, gy, R * 0.025, 0, Math.PI * 2); c.fill(); }
  }
  if (x.night > 0.3) glow(x, px, cy, R * 1.3, "#FF8AD0", 0.15 * x.night);
  c.fillStyle = col; c.beginPath(); c.arc(px, cy, R * 0.08, 0, Math.PI * 2); c.fill();
}
/** a floating island: a rock cone under a grassy top, with trees and sometimes a waterfall */
function isle(x: Ctx, px: number, py: number, w: number, rock: string, grass: string, fall: boolean) {
  const { c, r } = x;
  c.fillStyle = rock;
  c.beginPath(); c.moveTo(px - w / 2, py);
  const n = 7;
  for (let k = 1; k < n; k++) { const u = k / n; c.lineTo(px - w / 2 + w * u, py + Math.sin(u * Math.PI) * w * range(r, 0.45, 0.7)); }
  c.lineTo(px + w / 2, py); c.closePath(); c.fill();
  c.fillStyle = rgba("#000000", 0.18); c.beginPath(); c.moveTo(px + (x.lightR ? -w / 2 : w / 2), py); c.lineTo(px, py + w * 0.6); c.lineTo(px, py); c.closePath(); c.fill();
  c.fillStyle = grass; c.beginPath(); c.ellipse(px, py, w * 0.54, w * 0.08, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(grass, -0.15); c.fillRect(px - w * 0.52, py, w * 1.04, w * 0.05);
  for (let k = 0; k < 3; k++) roundTree(x, px + range(r, -0.35, 0.35) * w, py, w * range(r, 0.25, 0.4), shade(grass, range(r, -0.15, 0.05)));
  if (fall) {
    const fx = px + range(r, -0.3, 0.3) * w;
    c.fillStyle = vgrad(c, py, py + w * 1.6, [[0, rgba("#FFFFFF", 0.85)], [1, rgba("#FFFFFF", 0)]]);
    c.fillRect(fx - w * 0.03, py, w * 0.06, w * 1.6);
  }
}
/** a puffy cloud bank: a row of overlapping circles */
function cloudBank(x: Ctx, y: number, col: string, size: number) {
  const { c, W, H, r } = x;
  c.fillStyle = col;
  for (let px = -size; px < W + size; px += size * range(r, 0.5, 0.8)) { c.beginPath(); c.arc(px, y + range(r, -0.3, 0.3) * size, size * range(r, 0.6, 1.0), 0, Math.PI * 2); c.fill(); }
  c.fillRect(0, y, W, H - y);
}

// ---------------------------------------------------------------- the worlds
type Painter = (x: Ctx) => void;

const PAINT: Record<WorldId, [Painter, Painter, Painter]> = {
  dunes: [
    (x) => {
      const y = ys(profile(x.r, x.W, [[1, 1], [2, 0.45], [4, 0.12]]), 330, 120);
      for (let k = 0; k < 3; k++) { const px = 180 + k * 540 + range(x.r, -60, 60), s = range(x.r, 150, 230); wrap(x, px, s / 2, (q) => pyramid(x, q, at(y, q, x.W) + 40, s, shade(x.col, 0.04 - k * 0.02))); }
      ridge(x, y, shade(x.col, 0.12), x.col, 0.45); facets(x, y, 0.25); mist(x, 380, 600, 0.55);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [3, 0.4], [7, 0.08]]), 360, 110); ridge(x, y, shade(x.col, 0.1), shade(x.col, -0.12), 0.4); facets(x, y, 0.3);
      // the sun temple: a stepped platform, a row of columns and a pediment
      const tx = range(x.r, 300, 1300);
      wrap(x, tx, 170, (q) => {
        const b = at(y, q, x.W) + 14, st = tone(x, "#E8C890");
        for (let k = 0; k < 3; k++) { c.fillStyle = shade(st, -0.06 * k); c.fillRect(q - 150 + k * 14, b - 12 - k * 12, 300 - k * 28, 12); }
        for (let k = 0; k < 7; k++) column(x, q - 108 + k * 36, b - 36, 14, 92, st, false);
        c.fillStyle = shade(st, 0.06); c.beginPath(); c.moveTo(q - 132, b - 132); c.lineTo(q, b - 172); c.lineTo(q + 132, b - 132); c.closePath(); c.fill();
        c.fillStyle = shade(st, -0.1); c.fillRect(q - 132, b - 136, 264, 8);
        c.fillStyle = tone(x, "#FFB627"); c.beginPath(); c.arc(q, b - 152, 9, 0, Math.PI * 2); c.fill();
      });
      // obelisks and a giant stone head half buried
      for (let k = 0; k < 4; k++) {
        const px = range(x.r, 0, x.W); if (Math.abs(px - tx) < 220) continue;
        wrap(x, px, 20, (q) => {
          const b = at(y, q, x.W) + 10, h = range(x.r, 80, 130), st = tone(x, "#D8B078");
          c.fillStyle = st; c.beginPath(); c.moveTo(q - 9, b); c.lineTo(q - 6, b - h); c.lineTo(q, b - h - 14); c.lineTo(q + 6, b - h); c.lineTo(q + 9, b); c.closePath(); c.fill();
          c.fillStyle = rgba(x.l.light, sunlit(x, 0.25)); c.fillRect(x.lightR ? q : q - 7, b - h, 7, h);
          c.fillStyle = tone(x, "#FFC93D"); c.beginPath(); c.moveTo(q - 6, b - h); c.lineTo(q, b - h - 14); c.lineTo(q + 6, b - h); c.closePath(); c.fill();
        });
      }
      const hx = (tx + 760) % x.W;
      wrap(x, hx, 95, (q) => {
        const b = at(y, q, x.W) + 20, st = tone(x, "#D0A46A");
        c.fillStyle = st; c.beginPath(); c.moveTo(q - 60, b); c.quadraticCurveTo(q - 64, b - 120, q, b - 128); c.quadraticCurveTo(q + 64, b - 120, q + 60, b); c.closePath(); c.fill();
        c.fillStyle = shade(st, 0.12); c.beginPath(); c.moveTo(q - 40, b - 70); c.quadraticCurveTo(q, b - 140, q + 40, b - 70); c.lineTo(q + 30, b - 70); c.quadraticCurveTo(q, b - 118, q - 30, b - 70); c.closePath(); c.fill();
        c.fillStyle = shade(st, -0.35); c.fillRect(q - 24, b - 66, 14, 5); c.fillRect(q + 10, b - 66, 14, 5); c.fillRect(q - 14, b - 34, 28, 5);
        c.fillStyle = shade(st, -0.15); c.beginPath(); c.moveTo(q, b - 62); c.lineTo(q - 6, b - 44); c.lineTo(q + 6, b - 44); c.closePath(); c.fill();
        c.fillStyle = x.col; c.beginPath(); c.ellipse(q, b + 4, 90, 22, 0, Math.PI, 0); c.fill();
      });
      mist(x, 470, 600, 0.3);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [5, 0.3]]), 470, 70); ridge(x, y, shade(x.col, 0.12), shade(x.col, -0.2), 0.5);
      c.strokeStyle = rgba(x.l.light, sunlit(x, 0.18)); c.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) { const px = range(x.r, 0, x.W), b = at(y, px, x.W) + range(x.r, 10, 60); c.beginPath(); c.moveTo(px - 30, b); c.quadraticCurveTo(px, b - 6, px + 30, b); c.stroke(); }
      for (let px = 40; px < x.W; px += range(x.r, 140, 320)) {
        const n = 1 + Math.floor(x.r() * 3);
        for (let k = 0; k < n; k++) wrap(x, px + k * 34, 180, (q) => palm(x, q, at(y, q, x.W) + 18, range(x.r, 140, 210), shade(x.col, -0.3)));
      }
      for (let k = 0; k < 3; k++) wrap(x, range(x.r, 0, x.W), 50, (q) => {
        const b = at(y, q, x.W) + 16, cl = tone(x, k % 2 ? "#E8504A" : "#F2E8D8");
        c.fillStyle = cl; c.beginPath(); c.moveTo(q - 44, b); c.lineTo(q, b - 52); c.lineTo(q + 44, b); c.closePath(); c.fill();
        c.fillStyle = shade(cl, -0.35); c.beginPath(); c.moveTo(q - 10, b); c.lineTo(q, b - 30); c.lineTo(q + 10, b); c.closePath(); c.fill();
        c.strokeStyle = shade(cl, -0.25); c.lineWidth = 2; c.beginPath(); c.moveTo(q, b - 52); c.lineTo(q, b - 64); c.stroke();
      });
    },
  ],
  cinder: [
    (x) => {
      const { c, W } = x;
      // the volcano: a broad cone with a glowing crater and lava rivers
      const vx = W * 0.55, vtop = 150, vbase = 560;
      const y = ys(profile(x.r, W, [[1, 1], [3, 0.4], [8, 0.1]]), 330, 140);
      for (let i = 0; i <= W; i++) { const d = Math.abs(i - vx) / 520; if (d < 1) y[i] = Math.min(y[i], vtop + (vbase - vtop) * Math.pow(d, 0.75) + (d < 0.08 ? (0.08 - d) * 120 : 0)); }
      ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.2), 0.3); facets(x, y, 0.25);
      glow(x, vx, vtop + 20, 160, "#FF6A2A", 0.35 + 0.3 * x.night);
      c.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        let px = vx + range(x.r, -20, 20), py = vtop + 18;
        const dir = k % 2 ? 1 : -1;
        c.beginPath(); c.moveTo(px, py);
        for (let s = 0; s < 14; s++) { px += dir * range(x.r, 4, 22); py += range(x.r, 16, 28); c.lineTo(px, py); }
        c.strokeStyle = rgba("#FF7A2A", 0.55 + 0.3 * x.night); c.lineWidth = 7; c.stroke();
        c.strokeStyle = rgba("#FFD27A", 0.8); c.lineWidth = 2; c.stroke();
      }
      mist(x, 360, 600, 0.5);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.35]]), 350, 110); ridge(x, y, shade(x.col, 0.08), shade(x.col, -0.2), 0.3); facets(x, y, 0.2);
      const st = tone(x, "#B8A096");
      for (let px = 20; px < x.W; px += range(x.r, 60, 150)) {
        const kind = x.r();
        wrap(x, px, 140, (q) => {
          const b = at(y, q, x.W) + 12;
          if (kind < 0.45) { const n = 2 + Math.floor(x.r() * 4); for (let k = 0; k < n; k++) column(x, q + k * 26, b, 11, range(x.r, 40, 110), shade(st, range(x.r, -0.12, 0.04)), x.r() < 0.5); }
          else if (kind < 0.75) {
            const w = range(x.r, 70, 110), h = range(x.r, 80, 120);
            c.fillStyle = shade(st, -0.05); c.fillRect(q - w / 2, b - h, w * 0.2, h); c.fillRect(q + w * 0.3, b - h * 0.7, w * 0.2, h * 0.7);
            c.strokeStyle = shade(st, -0.05); c.lineWidth = w * 0.18; c.beginPath(); c.arc(q, b - h + w * 0.05, w * 0.4, Math.PI, Math.PI * 1.7); c.stroke();
          } else {
            const w = range(x.r, 80, 140), h = range(x.r, 50, 90);
            c.fillStyle = shade(st, -0.1); c.beginPath(); c.moveTo(q - w / 2, b); c.lineTo(q - w / 2, b - h); c.lineTo(q - w * 0.2, b - h * 0.8); c.lineTo(q, b - h * 1.1); c.lineTo(q + w * 0.25, b - h * 0.6); c.lineTo(q + w / 2, b - h * 0.7); c.lineTo(q + w / 2, b); c.closePath(); c.fill();
            for (let k = 0; k < 3; k++) { c.fillStyle = x.night > 0.2 ? rgba("#FF8A3A", 0.7) : shade(st, -0.4); c.fillRect(q - w * 0.35 + k * w * 0.25, b - h * 0.55, w * 0.1, h * 0.22); }
          }
        });
      }
      for (let k = 0; k < 8; k++) { const px = range(x.r, 0, x.W); glow(x, px, at(y, px, x.W) + 30, 40, "#FF6A2A", 0.25 + 0.2 * x.night); }
      mist(x, 460, 600, 0.3);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.4], [17, 0.1]]), 470, 80); ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.3), 0.25);
      // lava seams in the near rock
      c.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        let px = range(x.r, 0, x.W), py = at(y, px, x.W) + 20;
        c.beginPath(); c.moveTo(px, py);
        for (let s = 0; s < 6; s++) { px += range(x.r, -20, 30); py += range(x.r, 8, 18); c.lineTo(px, py); }
        c.strokeStyle = rgba("#FF6A2A", 0.5 + 0.3 * x.night); c.lineWidth = 4; c.stroke();
        c.strokeStyle = rgba("#FFD27A", 0.75); c.lineWidth = 1.2; c.stroke();
      }
      const st = tone(x, "#A08880");
      for (let px = 30; px < x.W; px += range(x.r, 120, 260)) wrap(x, px, 30, (q) => column(x, q, at(y, q, x.W) + 14, 22, range(x.r, 80, 190), st, x.r() < 0.7));
      for (let px = 0; px < x.W; px += range(x.r, 60, 120)) wrap(x, px, 62, (q) => {
        const b = at(y, q, x.W) + 12, w = range(x.r, 30, 60);
        c.fillStyle = shade(x.col, -0.18); c.beginPath(); c.moveTo(q - w, b); c.lineTo(q - w * 0.6, b - w * 0.6); c.lineTo(q + w * 0.2, b - w * 0.8); c.lineTo(q + w, b); c.closePath(); c.fill();
      });
    },
  ],
  polar: [
    (x) => {
      const y = peaks(x.r, x.W, 4, 180, 260);
      ridge(x, y, shade(x.col, 0.1), x.col, 0.5); facets(x, y, 0.3); caps(x, y, 300); mist(x, 360, 600, 0.6);
    },
    (x) => {
      const { c, W } = x;
      // the ice shelf: flat tops and sheer blue faces, broken in places, the sea below with icebergs
      const sea = 470;
      c.fillStyle = vgrad(c, sea, 600, [[0, tone(x, "#5E8EC0")], [1, tone(x, "#2E5A8A")]]); c.fillRect(0, sea, W, 600 - sea);
      c.strokeStyle = rgba("#FFFFFF", 0.25); c.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) { const px = range(x.r, 0, W), py = range(x.r, sea + 6, 590); c.beginPath(); c.moveTo(px, py); c.lineTo(px + range(x.r, 10, 40), py); c.stroke(); }
      const face = tone(x, "#9CC8F0"), top = tone(x, "#F4FAFF");
      for (let px = 0; px < W; ) {
        const w = range(x.r, 180, 380), t0 = range(x.r, 340, 400);
        const q0 = px;
        wrap(x, q0 + w / 2, w / 2, (q) => {
          const a = q - w / 2;
          c.fillStyle = face; c.beginPath(); c.moveTo(a, sea); c.lineTo(a + 8, t0); c.lineTo(a + w - 8, t0 + 4); c.lineTo(a + w, sea); c.closePath(); c.fill();
          c.strokeStyle = rgba(shade(face, -0.3), 0.5); c.lineWidth = 2;
          for (let s = a + 14; s < a + w - 10; s += range(x.r, 10, 24)) { c.beginPath(); c.moveTo(s, t0 + 10); c.lineTo(s + range(x.r, -4, 4), sea - 4); c.stroke(); }
          c.fillStyle = top; c.beginPath(); c.moveTo(a + 4, t0 + 2); c.quadraticCurveTo(a + w / 2, t0 - 14, a + w - 4, t0 + 6); c.lineTo(a + w - 4, t0 + 12); c.lineTo(a + 4, t0 + 10); c.closePath(); c.fill();
        });
        px += w + range(x.r, 30, 110);
      }
      for (let k = 0; k < 5; k++) wrap(x, range(x.r, 0, W), 50, (q) => {
        const w = range(x.r, 30, 80), h = range(x.r, 20, 60);
        c.fillStyle = top; c.beginPath(); c.moveTo(q - w / 2, sea + 4); c.lineTo(q - w * 0.3, sea - h * 0.7); c.lineTo(q, sea - h); c.lineTo(q + w * 0.35, sea - h * 0.6); c.lineTo(q + w / 2, sea + 4); c.closePath(); c.fill();
        c.fillStyle = rgba("#5E9AD8", 0.35); c.beginPath(); c.moveTo(q, sea - h); c.lineTo(q + w * 0.35, sea - h * 0.6); c.lineTo(q + w / 2, sea + 4); c.lineTo(q + w * 0.05, sea + 4); c.closePath(); c.fill();
      });
      // the research station on a shelf: a dome, a box hut, a mast with a red light
      wrap(x, range(x.r, 200, 1400), 110, (q) => {
        const b = 380;
        c.fillStyle = tone(x, "#E8402A"); c.fillRect(q - 70, b - 34, 60, 34);
        c.fillStyle = tone(x, "#F2F2F2"); c.beginPath(); c.arc(q + 20, b, 36, Math.PI, 0); c.fill();
        c.strokeStyle = tone(x, "#8A96A8"); c.lineWidth = 2; c.beginPath(); c.arc(q + 20, b, 36, Math.PI, 0); c.moveTo(q + 20, b - 36); c.lineTo(q + 20, b); c.stroke();
        windowGlow(x, q - 60, b - 24, 10, 8); windowGlow(x, q - 36, b - 24, 10, 8);
        c.strokeStyle = tone(x, "#6A7488"); c.lineWidth = 2.5; c.beginPath(); c.moveTo(q + 70, b); c.lineTo(q + 70, b - 110); c.stroke();
        c.lineWidth = 1; c.beginPath(); c.moveTo(q + 70, b - 110); c.lineTo(q + 46, b); c.moveTo(q + 70, b - 110); c.lineTo(q + 94, b); c.stroke();
        c.fillStyle = "#FF4A4A"; c.beginPath(); c.arc(q + 70, b - 112, 3, 0, Math.PI * 2); c.fill(); glow(x, q + 70, b - 112, 16, "#FF4A4A", 0.4 + 0.4 * x.night);
      });
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [6, 0.3]]), 480, 70); ridge(x, y, shade(x.col, 0.2), x.col, 0.6);
      c.fillStyle = rgba("#FFFFFF", 0.35 - x.night * 0.15);
      for (let k = 0; k < 30; k++) { const px = range(x.r, 0, x.W), b = at(y, px, x.W) + range(x.r, 5, 40); c.beginPath(); c.ellipse(px, b, range(x.r, 20, 60), 4, 0, 0, Math.PI * 2); c.fill(); }
      for (let px = 0; px < x.W; px += range(x.r, 40, 110)) wrap(x, px, 75, (q) => pine(x, q, at(y, q, x.W) + 20, range(x.r, 110, 200), shade(mix(x.col, "#1E3A4A", 0.5), -0.1), true));
      for (let k = 0; k < 3; k++) wrap(x, range(x.r, 0, x.W), 40, (q) => {
        const b = at(y, q, x.W) + 14;
        c.fillStyle = tone(x, "#4A5468"); c.fillRect(q - 1.5, b - 90, 3, 90);
        c.fillStyle = tone(x, BOX[k % 3]); c.beginPath(); c.moveTo(q + 1.5, b - 90); c.lineTo(q + 34, b - 82); c.lineTo(q + 1.5, b - 72); c.closePath(); c.fill();
      });
    },
  ],
  harbor: [
    (x) => {
      const { c, W } = x;
      const base = 470;
      const neon = ["#FF4FD8", "#5BF0FF", "#FFD23F", "#7A5CFF"];
      for (let px = -10; px < W; px += range(x.r, 30, 70)) {
        const w = range(x.r, 34, 80), h = range(x.r, 90, 260);
        wrap(x, px + w / 2, w / 2, (q) => tower(x, q - w / 2, base + 10, w, h, shade(x.col, range(x.r, -0.08, 0.08)), x.r() < 0.35 ? neon[Math.floor(x.r() * 4)] : null));
      }
      // one landmark spire
      wrap(x, range(x.r, 200, 1400), 90, (q) => {
        c.fillStyle = shade(x.col, 0.05); c.beginPath(); c.moveTo(q - 30, base + 10); c.lineTo(q - 14, base - 300); c.lineTo(q, base - 380); c.lineTo(q + 14, base - 300); c.lineTo(q + 30, base + 10); c.closePath(); c.fill();
        for (let k = 0; k < 12; k++) { c.fillStyle = k % 2 ? "#FF4FD8" : "#5BF0FF"; c.fillRect(q - 12 + k * 0.6, base - 290 + k * 24, 24 - k * 1.2, 3); }
        glow(x, q, base - 300, 90, "#FF4FD8", 0.25 * x.night);
      });
      mist(x, 380, 600, 0.6);
      c.fillStyle = vgrad(c, base, 600, [[0, shade(x.col, -0.3)], [1, shade(x.col, -0.5)]]); c.fillRect(0, base, W, 600 - base);
    },
    (x) => {
      const { c, W } = x;
      const quay = 470;
      // water with neon reflections
      c.fillStyle = vgrad(c, quay, 600, [[0, tone(x, "#1A2A5A")], [1, tone(x, "#0A1230")]]); c.fillRect(0, quay, W, 600 - quay);
      for (let k = 0; k < 60; k++) { c.fillStyle = rgba(k % 3 ? "#5BF0FF" : "#FF4FD8", 0.25 * x.night + 0.05); c.fillRect(range(x.r, 0, W), range(x.r, quay + 8, 600), range(x.r, 10, 40), 2); }
      // the ship: a long hull with containers on deck
      wrap(x, range(x.r, 300, 1300), 260, (q) => {
        const hull = tone(x, "#2A3A6A");
        c.fillStyle = hull; c.beginPath(); c.moveTo(q - 260, quay - 40); c.lineTo(q + 230, quay - 40); c.lineTo(q + 260, quay - 70); c.lineTo(q + 250, quay + 10); c.lineTo(q - 240, quay + 10); c.closePath(); c.fill();
        c.fillStyle = tone(x, "#D8402A"); c.fillRect(q - 240, quay - 6, 480, 10);
        for (let k = 0; k < 14; k++) for (let s = 0; s < 3; s++) container(x, q - 220 + k * 30, quay - 40 - s * 16, 28, 15, tone(x, BOX[(k * 3 + s * 5) % BOX.length]));
        c.fillStyle = tone(x, "#F2F2F2"); c.fillRect(q + 170, quay - 120, 50, 80);
        for (let k = 0; k < 3; k++) windowGlow(x, q + 176 + k * 15, quay - 110, 10, 7);
      });
      // cranes on the quay
      for (let k = 0; k < 3; k++) wrap(x, 250 + k * 520 + range(x.r, -60, 60), 270, (q) => crane(x, q, quay - 30, range(x.r, 210, 260), tone(x, k % 2 ? "#E8A02A" : "#D8402A")));
      mist(x, 430, 600, 0.25);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1]]), 500, 16); ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.2), 0);
      // container stacks
      for (let px = 0; px < x.W; px += range(x.r, 180, 360)) wrap(x, px, 380, (q) => {
        const cols = 2 + Math.floor(x.r() * 3), rows = 1 + Math.floor(x.r() * 3), b = at(y, q, x.W) + 4, c0 = Math.floor(x.r() * BOX.length);
        for (let i = 0; i < cols; i++) for (let j = 0; j < (i === 0 || i === cols - 1 ? Math.max(1, rows - 1) : rows); j++) container(x, q + i * 92, b - j * 40, 90, 39, tone(x, BOX[(i * 7 + j * 3 + c0) % BOX.length]));
      });
      // lamp posts with pools of light
      for (let px = 60; px < x.W; px += range(x.r, 160, 260)) wrap(x, px, 95, (q) => {
        const b = at(y, q, x.W) + 4;
        c.fillStyle = shade(x.col, -0.3); c.fillRect(q - 2, b - 150, 4, 150); c.fillRect(q - 2, b - 150, 26, 4);
        c.fillStyle = "#FFF0C0"; c.fillRect(q + 14, b - 147, 14, 4);
        glow(x, q + 21, b - 140, 70, "#FFE0A0", 0.35 * x.night + 0.05);
      });
      // a chain-link fence
      c.strokeStyle = rgba(shade(x.col, 0.25), 0.4); c.lineWidth = 1;
      for (let px = 0; px < x.W; px += 10) { const b = at(y, px, x.W) + 4; c.beginPath(); c.moveTo(px, b); c.lineTo(px + 10, b - 36); c.moveTo(px + 10, b); c.lineTo(px, b - 36); c.stroke(); }
      c.fillStyle = shade(x.col, -0.2); for (let px = 0; px < x.W; px += 80) c.fillRect(px, at(y, px, x.W) - 36, 3, 40);
    },
  ],
  canopy: [
    (x) => {
      const { c, W } = x;
      // karst towers: tall rounded cliffs with green crowns and waterfalls
      const y = ys(profile(x.r, W, [[1, 1], [3, 0.3]]), 420, 90);
      ridge(x, y, shade(x.col, 0.06), x.col, 0.2);
      for (let k = 0; k < 9; k++) {
        const px = range(x.r, 0, W), w = range(x.r, 60, 130), h = range(x.r, 180, 330);
        wrap(x, px, w, (q) => {
          const b = at(y, q, W) + 30, top = b - h;
          const rock = shade(x.col, range(x.r, -0.05, 0.08));
          c.fillStyle = rock; c.beginPath(); c.moveTo(q - w / 2, b); c.bezierCurveTo(q - w * 0.6, b - h * 0.5, q - w * 0.5, top, q, top); c.bezierCurveTo(q + w * 0.5, top, q + w * 0.6, b - h * 0.5, q + w / 2, b); c.closePath(); c.fill();
          c.fillStyle = rgba(x.l.light, sunlit(x, 0.18)); c.beginPath(); c.moveTo(q, top); c.bezierCurveTo(q + w * 0.5 * (x.lightR ? 1 : -1), top, q + w * 0.6 * (x.lightR ? 1 : -1), b - h * 0.5, q + (w / 2) * (x.lightR ? 1 : -1), b); c.lineTo(q, b); c.closePath(); c.fill();
          c.fillStyle = shade(mix(x.col, "#2E8A4A", 0.5), 0.05); c.beginPath(); c.ellipse(q, top + 10, w * 0.42, 22, 0, 0, Math.PI * 2); c.fill();
          if (x.r() < 0.55) { c.fillStyle = vgrad(c, top + 20, b, [[0, rgba("#FFFFFF", 0.85)], [1, rgba("#FFFFFF", 0.2)]]); c.fillRect(q + range(x.r, -0.2, 0.2) * w, top + 20, 6, h - 20); }
        });
      }
      mist(x, 320, 600, 0.7);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.3]]), 380, 100);
      // the stepped temple rising above the canopy
      wrap(x, range(x.r, 300, 1300), 130, (q) => {
        const b = at(y, q, x.W) + 30, st = tone(x, "#8A9A7A");
        for (let k = 0; k < 6; k++) { c.fillStyle = shade(st, -0.05 * (k % 2)); c.fillRect(q - 120 + k * 18, b - 26 - k * 26, 240 - k * 36, 27); }
        c.fillStyle = shade(st, -0.1); c.fillRect(q - 26, b - 200, 52, 44);
        c.fillStyle = shade(st, -0.5); c.fillRect(q - 10, b - 186, 20, 30);
        c.fillStyle = rgba("#3EA05A", 0.7); for (let k = 0; k < 12; k++) { c.beginPath(); c.arc(q + range(x.r, -110, 110), b - range(x.r, 10, 150), range(x.r, 5, 14), 0, Math.PI * 2); c.fill(); }
        c.fillStyle = tone(x, "#5A6E5A"); c.fillRect(q - 8, b - 150, 16, 150);
      });
      ridge(x, y, shade(x.col, 0.05), shade(x.col, -0.2), 0);
      // the canopy: clumps of crowns in several greens
      for (let px = 0; px < x.W; px += range(x.r, 30, 60)) wrap(x, px, 80, (q) => {
        const b = at(y, q, x.W) + 10, R = range(x.r, 30, 56), g = shade(x.col, range(x.r, -0.12, 0.12));
        c.fillStyle = g;
        c.beginPath(); c.arc(q, b - R * 0.4, R, 0, Math.PI * 2); c.arc(q - R * 0.6, b, R * 0.7, 0, Math.PI * 2); c.arc(q + R * 0.6, b, R * 0.7, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba(x.l.light, sunlit(x, 0.14)); c.beginPath(); c.arc(q + (x.lightR ? R * 0.3 : -R * 0.3), b - R * 0.7, R * 0.5, 0, Math.PI * 2); c.fill();
      });
      // a waterfall into a misty pool
      wrap(x, range(x.r, 0, x.W), 95, (q) => {
        const b = at(y, q, x.W);
        c.fillStyle = vgrad(c, b - 120, 600, [[0, rgba("#FFFFFF", 0.9)], [1, rgba("#BFF0FF", 0.5)]]); c.fillRect(q - 14, b - 120, 28, 600 - b + 120);
        glow(x, q, 560, 90, "#FFFFFF", 0.4);
      });
      mist(x, 450, 600, 0.35);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.3]]), 480, 70); ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.25), 0.3);
      for (let px = 30; px < x.W; px += range(x.r, 160, 300)) wrap(x, px, 200, (q) => palm(x, q, at(y, q, x.W) + 16, range(x.r, 170, 240), shade(x.col, -0.2)));
      // big leaves: elephant ears fanning up from the ground
      for (let px = 0; px < x.W; px += range(x.r, 40, 90)) wrap(x, px, 120, (q) => {
        const b = at(y, q, x.W) + 18, n = 3 + Math.floor(x.r() * 3);
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.45, L = range(x.r, 40, 80), g = shade(x.col, range(x.r, -0.2, 0.08));
          const ex = q + Math.cos(a) * L, ey = b + Math.sin(a) * L;
          c.strokeStyle = shade(g, -0.2); c.lineWidth = 2; c.beginPath(); c.moveTo(q, b); c.lineTo(ex, ey); c.stroke();
          c.fillStyle = g; c.beginPath(); c.ellipse(ex, ey, L * 0.28, L * 0.5, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
          c.strokeStyle = rgba("#FFFFFF", 0.15); c.lineWidth = 1; c.beginPath(); c.moveTo(ex - Math.cos(a) * L * 0.4, ey - Math.sin(a) * L * 0.4); c.lineTo(ex + Math.cos(a) * L * 0.4, ey + Math.sin(a) * L * 0.4); c.stroke();
        }
      });
      // hanging vines
      c.strokeStyle = shade(x.col, -0.3); c.lineWidth = 2;
      for (let k = 0; k < 14; k++) { const px = range(x.r, 0, x.W), b = at(y, px, x.W); c.beginPath(); c.moveTo(px, b - range(x.r, 120, 200)); c.quadraticCurveTo(px + 12, b - 60, px - 4, b); c.stroke(); }
    },
  ],
  scrap: [
    (x) => {
      const { c, W } = x;
      const base = 470;
      for (let px = 0; px < W; px += range(x.r, 60, 140)) wrap(x, px, 150, (q) => {
        const w = range(x.r, 70, 140), h = range(x.r, 60, 120), col = shade(x.col, range(x.r, -0.06, 0.06));
        c.fillStyle = col; c.fillRect(q - w / 2, base - h, w, h + 10);
        // a sawtooth roof
        c.beginPath(); for (let k = 0; k < 4; k++) { const a = q - w / 2 + (k * w) / 4; c.moveTo(a, base - h); c.lineTo(a, base - h - 18); c.lineTo(a + w / 4, base - h); } c.fill();
        if (x.r() < 0.6) {
          const sx = q + range(x.r, -w / 3, w / 3), sh = range(x.r, 80, 180);
          c.fillStyle = shade(col, 0.04); c.fillRect(sx - 7, base - h - sh, 14, sh);
          c.fillStyle = tone(x, "#D8402A"); c.fillRect(sx - 7, base - h - sh, 14, 8); c.fillRect(sx - 7, base - h - sh + 20, 14, 6);
          for (let k = 0; k < 5; k++) { c.fillStyle = rgba(mix(x.l.haze, "#6A6A6A", 0.4), 0.45 - k * 0.07); c.beginPath(); c.arc(sx + k * 14, base - h - sh - 10 - k * 16, 12 + k * 6, 0, Math.PI * 2); c.fill(); }
        }
        for (let k = 0; k < 3; k++) windowGlow(x, q - w / 2 + 8 + k * 18, base - h * 0.6, 8, 6);
      });
      for (let k = 0; k < 3; k++) wrap(x, range(x.r, 0, W), 50, (q) => {
        c.fillStyle = shade(x.col, 0.08); c.fillRect(q - 40, base - 70, 80, 80); c.beginPath(); c.ellipse(q, base - 70, 40, 12, 0, 0, Math.PI * 2); c.fill();
      });
      mist(x, 360, 600, 0.55);
      c.fillStyle = x.col; c.fillRect(0, base, W, 600 - base);
    },
    (x) => {
      const { c } = x;
      // junk mountains: car bodies, tyres and panels piled into heaps
      const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.35], [13, 0.1]]), 330, 140);
      ridge(x, y, shade(x.col, 0.05), shade(x.col, -0.2), 0.2);
      c.save(); shape(c, y, x.W, x.H); c.clip();
      for (let k = 0; k < 160; k++) {
        const px = range(x.r, 0, x.W), py = at(y, px, x.W) + range(x.r, 5, 200);
        const kind = x.r(), col = tone(x, BOX[Math.floor(x.r() * BOX.length)], 0.15);
        c.save(); c.translate(px, py); c.rotate(range(x.r, -0.6, 0.6));
        if (kind < 0.4) { c.fillStyle = shade(col, -0.2); c.fillRect(-26, -10, 52, 14); c.fillRect(-14, -20, 28, 12); c.fillStyle = "#1E1E24"; c.beginPath(); c.arc(-16, 5, 6, 0, Math.PI * 2); c.arc(16, 5, 6, 0, Math.PI * 2); c.fill(); }
        else if (kind < 0.7) { c.strokeStyle = shade(x.col, -0.45); c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke(); }
        else { c.fillStyle = shade(x.col, range(x.r, -0.2, 0.1)); c.fillRect(-18, -6, 36, 12); }
        c.restore();
      }
      c.restore();
      // the magnet crane holding a car up
      wrap(x, range(x.r, 300, 1300), 180, (q) => {
        const b = at(y, q, x.W) + 40, col = tone(x, "#E8A02A");
        c.fillStyle = col; c.fillRect(q - 12, b - 230, 24, 230);
        c.strokeStyle = col; c.lineWidth = 3;
        c.beginPath(); for (let k = 0; k < 9; k++) { c.moveTo(q - 12, b - k * 26); c.lineTo(q + 12, b - k * 26 - 13); } c.stroke();
        c.fillRect(q - 30, b - 246, 190, 14); c.fillRect(q - 60, b - 244, 30, 24);
        c.strokeStyle = shade(col, -0.4); c.lineWidth = 2; c.beginPath(); c.moveTo(q + 140, b - 232); c.lineTo(q + 140, b - 150); c.stroke();
        c.fillStyle = shade(x.col, -0.3); c.beginPath(); c.ellipse(q + 140, b - 146, 24, 8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = tone(x, "#2A72D8"); c.fillRect(q + 112, b - 136, 56, 16); c.fillRect(q + 124, b - 146, 30, 10);
        c.fillStyle = "#1E1E24"; c.beginPath(); c.arc(q + 122, b - 118, 7, 0, Math.PI * 2); c.arc(q + 158, b - 118, 7, 0, Math.PI * 2); c.fill();
      });
      mist(x, 470, 600, 0.3);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [9, 0.25]]), 480, 60); ridge(x, y, shade(x.col, 0.05), shade(x.col, -0.25), 0.2);
      // a corrugated fence of mismatched sheets
      for (let px = 0; px < x.W; px += 46) {
        const b = at(y, px, x.W) + 10, h = range(x.r, 70, 100), col = tone(x, x.r() < 0.6 ? "#8A8E96" : BOX[Math.floor(x.r() * BOX.length)], 0.1);
        c.fillStyle = col; c.save(); c.translate(px, b); c.rotate(range(x.r, -0.05, 0.05)); c.fillRect(0, -h, 44, h);
        c.fillStyle = shade(col, -0.2); for (let k = 2; k < 44; k += 6) c.fillRect(k, -h, 2, h);
        c.fillStyle = rgba("#7A3A1A", 0.35); c.fillRect(range(x.r, 0, 30), -h * range(x.r, 0.3, 0.9), 14, 10);
        c.restore();
      }
      // tyre stacks
      for (let px = 40; px < x.W; px += range(x.r, 120, 240)) wrap(x, px, 30, (q) => {
        const b = at(y, q, x.W) + 12, n = 3 + Math.floor(x.r() * 4);
        for (let k = 0; k < n; k++) { c.fillStyle = "#1E1E24"; c.fillRect(q - 26, b - (k + 1) * 16, 52, 15); c.fillStyle = "#34343C"; c.fillRect(q - 26, b - (k + 1) * 16, 52, 4); }
      });
    },
  ],
  boardwalk: [
    (x) => {
      const { c, W } = x;
      // the sea to the horizon with the sun's path on it, an island with a lighthouse and sails
      const hz = 380;
      c.fillStyle = vgrad(c, hz, 600, [[0, tone(x, "#6EA8D8")], [1, tone(x, "#2E6AA8")]]); c.fillRect(0, hz, W, 600 - hz);
      const sx = W * x.l.sunX;
      for (let k = 0; k < 70; k++) { const py = hz + 4 + Math.pow(x.r(), 1.6) * 200, w = range(x.r, 8, 40) * (1 + (py - hz) / 100); c.fillStyle = rgba(x.l.sun, 0.5 - (py - hz) / 500); c.fillRect(sx + range(x.r, -60, 60) * (1 + (py - hz) / 120) - w / 2, py, w, 2); }
      wrap(x, range(x.r, 100, 1500), 140, (q) => {
        c.fillStyle = shade(x.col, -0.1); c.beginPath(); c.moveTo(q - 140, hz); c.quadraticCurveTo(q - 40, hz - 60, q + 10, hz - 50); c.quadraticCurveTo(q + 90, hz - 30, q + 140, hz); c.closePath(); c.fill();
        c.fillStyle = tone(x, "#F2F2F2"); c.fillRect(q + 4, hz - 96, 10, 48); c.fillStyle = tone(x, "#D8402A"); c.fillRect(q + 4, hz - 82, 10, 8); c.fillRect(q + 4, hz - 64, 10, 8);
        c.fillStyle = "#FFF0B0"; c.fillRect(q + 3, hz - 102, 12, 6); glow(x, q + 9, hz - 99, 40, "#FFF0B0", 0.5 * x.night);
      });
      for (let k = 0; k < 4; k++) { const px = range(x.r, 0, W), py = hz + range(x.r, 6, 40); c.fillStyle = tone(x, "#F8F8F8"); c.beginPath(); c.moveTo(px, py - 2); c.lineTo(px, py - 26); c.lineTo(px + 16, py - 4); c.closePath(); c.fill(); c.fillStyle = shade(x.col, -0.3); c.fillRect(px - 10, py - 2, 26, 4); }
    },
    (x) => {
      const { c, W } = x;
      // the pier on stilts, the big wheel, a coaster and beach huts
      const deck = 430;
      const wood = tone(x, "#8A5A3A");
      c.fillStyle = vgrad(c, deck, 600, [[0, tone(x, "#4E8AC8")], [1, tone(x, "#2E5E98")]]); c.fillRect(0, deck, W, 600 - deck);
      c.fillStyle = rgba("#FFFFFF", 0.25); for (let k = 0; k < 30; k++) c.fillRect(range(x.r, 0, W), range(x.r, deck + 20, 590), range(x.r, 10, 30), 2);
      c.fillStyle = shade(wood, -0.2); for (let px = 0; px < W; px += 24) c.fillRect(px, deck, 4, 170);
      c.strokeStyle = shade(wood, -0.25); c.lineWidth = 2; c.beginPath(); for (let px = 0; px < W; px += 48) { c.moveTo(px, deck + 10); c.lineTo(px + 48, deck + 90); c.moveTo(px + 48, deck + 10); c.lineTo(px, deck + 90); } c.stroke();
      c.fillStyle = wood; c.fillRect(0, deck - 8, W, 10);
      c.fillStyle = shade(wood, 0.15); c.fillRect(0, deck - 8, W, 2);
      const fx = range(x.r, 300, 1300);
      wrap(x, fx, 180, (q) => ferris(x, q, deck - 8, 150, tone(x, "#F4F0E8")));
      // the coaster: a rolling track on posts
      const cx0 = (fx + 450) % W;
      wrap(x, cx0 + 200, 220, (q) => {
        const a = q - 200, col = tone(x, "#D8402A");
        c.strokeStyle = tone(x, "#E8E0D0"); c.lineWidth = 2;
        c.beginPath(); for (let k = 0; k <= 400; k += 20) { const ty = deck - 60 - Math.abs(Math.sin(k * 0.012)) * 120; c.moveTo(a + k, deck - 8); c.lineTo(a + k, ty); } c.stroke();
        c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); for (let k = 0; k <= 400; k += 4) { const ty = deck - 60 - Math.abs(Math.sin(k * 0.012)) * 120; if (k === 0) c.moveTo(a + k, ty); else c.lineTo(a + k, ty); } c.stroke();
      });
      for (let k = 0; k < 7; k++) wrap(x, range(x.r, 0, W), 24, (q) => {
        const col = tone(x, BOX[k % BOX.length]);
        c.fillStyle = col; c.fillRect(q - 18, deck - 44, 36, 36);
        c.fillStyle = tone(x, "#F8F8F8"); for (let s = 0; s < 3; s++) c.fillRect(q - 18 + s * 12, deck - 44, 6, 36);
        c.fillStyle = shade(col, -0.2); c.beginPath(); c.moveTo(q - 22, deck - 44); c.lineTo(q, deck - 60); c.lineTo(q + 22, deck - 44); c.closePath(); c.fill();
        windowGlow(x, q - 5, deck - 32, 10, 10);
      });
      if (x.night > 0.3) for (let px = 0; px < W; px += 30) { c.fillStyle = (px / 30) % 2 ? "#FFE08A" : "#FF8AD0"; c.beginPath(); c.arc(px, deck - 12, 2.2, 0, Math.PI * 2); c.fill(); }
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.3]]), 480, 70); ridge(x, y, shade(x.col, 0.15), shade(x.col, -0.15), 0.5);
      for (let px = 0; px < x.W; px += range(x.r, 20, 50)) {
        const b = at(y, px, x.W) + range(x.r, 4, 20);
        c.strokeStyle = shade(mix(x.col, "#6A8A3A", 0.6), -0.1); c.lineWidth = 1.6;
        c.beginPath(); for (let k = 0; k < 6; k++) { c.moveTo(px + k * 3, b); c.quadraticCurveTo(px + k * 3 + 4, b - 14, px + k * 5 - 6, b - range(x.r, 18, 34)); } c.stroke();
      }
      for (let px = 0; px < x.W; px += range(x.r, 170, 320)) wrap(x, px, 190, (q) => palm(x, q, at(y, q, x.W) + 16, range(x.r, 160, 230), shade(x.col, -0.35)));
      c.fillStyle = shade(x.col, -0.35);
      for (let px = 0; px < x.W; px += 34) { const b = at(y, px, x.W) + 12; c.fillRect(px, b - 30, 5, 30); }
      c.strokeStyle = shade(x.col, -0.35); c.lineWidth = 1.5; c.beginPath(); for (let px = 0; px < x.W; px += 34) { const b = at(y, px, x.W) + 12; c.moveTo(px, b - 24); c.quadraticCurveTo(px + 17, b - 16, px + 34, at(y, px + 34, x.W) - 12); } c.stroke();
    },
  ],
  goldmine: [
    (x) => {
      const { c, W } = x;
      // striped buttes with flat tops
      const y = ys(profile(x.r, W, [[1, 1], [3, 0.3]]), 400, 100);
      ridge(x, y, shade(x.col, 0.05), x.col, 0.2);
      for (let k = 0; k < 6; k++) wrap(x, range(x.r, 0, W), 200, (q) => {
        const w = range(x.r, 140, 320), h = range(x.r, 120, 230), b = at(y, q, W) + 30, top = b - h;
        c.fillStyle = shade(x.col, range(x.r, -0.05, 0.08));
        c.beginPath(); c.moveTo(q - w / 2 - 30, b); c.lineTo(q - w / 2, top + 20); c.lineTo(q - w / 2 + 10, top); c.lineTo(q + w / 2 - 12, top); c.lineTo(q + w / 2, top + 26); c.lineTo(q + w / 2 + 34, b); c.closePath(); c.fill();
        c.save(); c.clip();
        for (let s = 0; s < 6; s++) { c.fillStyle = rgba(s % 2 ? "#FFFFFF" : "#5A2A1A", 0.08); c.fillRect(q - w, top + 14 + s * 26, w * 2, 12); }
        c.fillStyle = rgba(x.l.light, sunlit(x, 0.2)); c.fillRect(x.lightR ? q + w / 2 - 30 : q - w / 2 - 30, top, 60, h);
        c.restore();
      });
      mist(x, 380, 600, 0.55);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [4, 0.4]]), 340, 140); ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.2), 0.3); facets(x, y, 0.22);
      const timber = tone(x, "#8A5A32");
      // mine mouths with timber frames and lantern glow
      for (let k = 0; k < 4; k++) wrap(x, range(x.r, 0, x.W), 40, (q) => {
        const b = at(y, q, x.W) + 50;
        c.fillStyle = "#140C08"; c.beginPath(); c.moveTo(q - 26, b); c.lineTo(q - 26, b - 40); c.quadraticCurveTo(q, b - 56, q + 26, b - 40); c.lineTo(q + 26, b); c.closePath(); c.fill();
        c.fillStyle = timber; c.fillRect(q - 32, b - 48, 8, 48); c.fillRect(q + 24, b - 48, 8, 48); c.fillRect(q - 36, b - 54, 72, 8);
        glow(x, q, b - 20, 40, "#FFB03A", 0.3 + 0.4 * x.night);
      });
      // the timber trestle bridge over a dip
      wrap(x, range(x.r, 200, 1400), 220, (q) => {
        const top = Math.min(at(y, q - 200, x.W), at(y, q + 200, x.W)) + 10;
        c.strokeStyle = timber; c.lineWidth = 3;
        c.beginPath();
        for (let k = -200; k <= 200; k += 25) { c.moveTo(q + k, top); c.lineTo(q + k, 600); }
        for (let lv = top + 30; lv < 600; lv += 40) { c.moveTo(q - 200, lv); c.lineTo(q + 200, lv); }
        for (let k = -200; k < 200; k += 25) for (let lv = top; lv < 600; lv += 40) { c.moveTo(q + k, lv); c.lineTo(q + k + 25, lv + 40); }
        c.stroke();
        c.fillStyle = shade(timber, -0.1); c.fillRect(q - 205, top - 6, 410, 8);
        c.fillStyle = tone(x, "#5A5E6E"); c.fillRect(q - 40, top - 22, 40, 16);
        c.fillStyle = tone(x, "#FFC93D"); c.beginPath(); c.ellipse(q - 20, top - 22, 18, 6, 0, Math.PI, 0); c.fill();
      });
      // the headframe: an A-shaped tower with a big sheave wheel
      wrap(x, range(x.r, 0, x.W), 75, (q) => {
        const b = at(y, q, x.W) + 30;
        c.strokeStyle = timber; c.lineWidth = 5; c.beginPath(); c.moveTo(q - 40, b); c.lineTo(q, b - 170); c.lineTo(q + 40, b); c.moveTo(q - 28, b - 60); c.lineTo(q + 28, b - 60); c.moveTo(q - 16, b - 110); c.lineTo(q + 16, b - 110); c.moveTo(q, b - 170); c.lineTo(q + 70, b); c.stroke();
        c.lineWidth = 3; c.beginPath(); c.arc(q, b - 170, 20, 0, Math.PI * 2); for (let s = 0; s < 6; s++) { const a = s * 1.047; c.moveTo(q, b - 170); c.lineTo(q + Math.cos(a) * 20, b - 170 + Math.sin(a) * 20); } c.stroke();
      });
      mist(x, 460, 600, 0.3);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [8, 0.3]]), 480, 70); ridge(x, y, shade(x.col, 0.08), shade(x.col, -0.25), 0.3);
      const timber = tone(x, "#7A4E2A");
      // boulders, timber props and lanterns on posts, gold glints in the rock
      for (let px = 0; px < x.W; px += range(x.r, 60, 140)) wrap(x, px, 75, (q) => {
        const b = at(y, q, x.W) + 14, w = range(x.r, 30, 70);
        c.fillStyle = shade(x.col, range(x.r, -0.2, 0)); c.beginPath(); c.moveTo(q - w, b); c.quadraticCurveTo(q - w, b - w * 0.9, q, b - w); c.quadraticCurveTo(q + w, b - w * 0.8, q + w, b); c.closePath(); c.fill();
        c.fillStyle = rgba(x.l.light, sunlit(x, 0.15)); c.beginPath(); c.arc(q + (x.lightR ? w * 0.3 : -w * 0.3), b - w * 0.6, w * 0.3, 0, Math.PI * 2); c.fill();
      });
      for (let k = 0; k < 40; k++) { const px = range(x.r, 0, x.W), py = at(y, px, x.W) + range(x.r, 20, 110); c.fillStyle = "#FFD23F"; c.fillRect(px, py, 3, 2); }
      for (let px = 50; px < x.W; px += range(x.r, 180, 300)) wrap(x, px, 75, (q) => {
        const b = at(y, q, x.W) + 12;
        c.fillStyle = timber; c.fillRect(q - 3, b - 120, 6, 120); c.fillRect(q - 3, b - 120, 26, 5);
        c.fillStyle = tone(x, "#2A2D3A"); c.fillRect(q + 16, b - 115, 12, 16);
        c.fillStyle = "#FFD27A"; c.fillRect(q + 18, b - 112, 8, 10); glow(x, q + 22, b - 107, 46, "#FFB03A", 0.3 + 0.4 * x.night);
      });
    },
  ],
  thunder: [
    (x) => {
      const y = peaks(x.r, x.W, 5, 130, 300);
      ridge(x, y, shade(x.col, 0.06), shade(x.col, -0.1), 0.4); facets(x, y, 0.35); caps(x, y, 260, "#E8EEF8");
      const { c, W } = x;
      // a storm cloud band across the peaks
      c.fillStyle = rgba(shade(x.l.haze, -0.25), 0.75);
      for (let px = 0; px < W; px += 60) { c.beginPath(); c.ellipse(px, 330 + Math.sin(px * 0.01) * 20, 90, 26, 0, 0, Math.PI * 2); c.fill(); }
      mist(x, 380, 600, 0.55);
    },
    (x) => {
      const { c } = x;
      const y = peaks(x.r, x.W, 3, 300, 180);
      ridge(x, y, shade(x.col, 0.05), shade(x.col, -0.2), 0.3); facets(x, y, 0.3);
      for (let px = 0; px < x.W; px += range(x.r, 14, 30)) wrap(x, px, 30, (q) => pine(x, q, at(y, q, x.W) + 24, range(x.r, 40, 70), shade(x.col, -0.2)));
      // the weather tower on a crag, its beacon and a lightning rod
      wrap(x, range(x.r, 200, 1400), 50, (q) => {
        let top = 600; for (let k = -40; k <= 40; k += 4) top = Math.min(top, at(y, q + k, x.W));
        const b = top + 30, st = tone(x, "#7A8090");
        c.fillStyle = st; c.beginPath(); c.moveTo(q - 26, b); c.lineTo(q - 18, b - 130); c.lineTo(q + 18, b - 130); c.lineTo(q + 26, b); c.closePath(); c.fill();
        c.fillStyle = shade(st, -0.15); c.fillRect(q - 24, b - 146, 48, 16);
        for (let k = 0; k < 4; k++) c.fillRect(q - 24 + k * 14, b - 156, 8, 10);
        windowGlow(x, q - 6, b - 100, 12, 16); windowGlow(x, q - 6, b - 60, 12, 16);
        c.strokeStyle = shade(st, -0.3); c.lineWidth = 2; c.beginPath(); c.moveTo(q, b - 156); c.lineTo(q, b - 200); c.stroke();
        c.fillStyle = "#BFE0FF"; c.beginPath(); c.arc(q, b - 202, 3, 0, Math.PI * 2); c.fill(); glow(x, q, b - 202, 30, "#BFE0FF", 0.5);
      });
      mist(x, 440, 600, 0.4);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.4], [15, 0.1]]), 470, 80); ridge(x, y, shade(x.col, 0.05), shade(x.col, -0.3), 0.3);
      for (let px = 0; px < x.W; px += range(x.r, 50, 110)) wrap(x, px, 85, (q) => pine(x, q, at(y, q, x.W) + 20, range(x.r, 130, 230), shade(mix(x.col, "#1E2A2A", 0.5), -0.05)));
      // dead trees: bare forked silhouettes
      c.strokeStyle = shade(x.col, -0.45); c.lineCap = "round";
      for (let k = 0; k < 5; k++) wrap(x, range(x.r, 0, x.W), 50, (q) => {
        const b = at(y, q, x.W) + 14, h = range(x.r, 90, 150);
        c.lineWidth = 6; c.beginPath(); c.moveTo(q, b); c.lineTo(q + 6, b - h); c.stroke();
        c.lineWidth = 3; c.beginPath(); c.moveTo(q + 3, b - h * 0.5); c.lineTo(q - 30, b - h * 0.8); c.moveTo(q + 5, b - h * 0.7); c.lineTo(q + 34, b - h * 0.95); c.moveTo(q - 18, b - h * 0.7); c.lineTo(q - 24, b - h * 0.95); c.stroke();
      });
      for (let px = 0; px < x.W; px += range(x.r, 90, 200)) wrap(x, px, 65, (q) => {
        const b = at(y, q, x.W) + 16, w = range(x.r, 30, 60);
        c.fillStyle = shade(x.col, -0.1); c.beginPath(); c.moveTo(q - w, b); c.lineTo(q - w * 0.5, b - w * 0.9); c.lineTo(q + w * 0.3, b - w); c.lineTo(q + w, b); c.closePath(); c.fill();
      });
    },
  ],
  candy: [
    (x) => {
      const { c, W } = x;
      // soft-serve mountains: stacked swirls with frosting caps
      const y = ys(profile(x.r, W, [[1, 1], [2, 0.4]]), 400, 80);
      ridge(x, y, shade(x.col, 0.1), x.col, 0.3);
      for (let k = 0; k < 7; k++) wrap(x, range(x.r, 0, W), 110, (q) => {
        const b = at(y, q, W) + 30, w = range(x.r, 140, 220), tiers = 4 + Math.floor(x.r() * 2), col = tone(x, ["#F8B8D8", "#C8E0A8", "#F8E0A0", "#C8B8F8"][k % 4]);
        for (let s = 0; s < tiers; s++) {
          const tw = w * (1 - s / (tiers + 0.5)), ty = b - s * w * 0.18;
          c.fillStyle = s % 2 ? col : shade(col, 0.1); c.beginPath(); c.ellipse(q, ty, tw / 2, w * 0.12, 0, Math.PI, 0); c.lineTo(q - tw / 2, ty); c.fill();
        }
        c.fillStyle = shade(col, 0.2); c.beginPath(); c.moveTo(q - 6, b - tiers * w * 0.18 + 4); c.quadraticCurveTo(q + 4, b - tiers * w * 0.18 - 26, q + 14, b - tiers * w * 0.18 - 30); c.quadraticCurveTo(q + 4, b - tiers * w * 0.18 - 6, q + 8, b - tiers * w * 0.18 + 4); c.fill();
      });
      mist(x, 380, 600, 0.55);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [6, 0.3]]), 380, 100);
      ridge(x, y, shade(x.col, 0.1), shade(x.col, -0.12), 0.4);
      // frosting drips over the hills' tops
      c.fillStyle = tone(x, "#FFF4FA");
      c.beginPath(); c.moveTo(0, at(y, 0, x.W));
      for (let px = 0; px <= x.W; px += 4) c.lineTo(px, at(y, px, x.W) - 2);
      for (let px = x.W; px >= 0; px -= 16) { const d = 10 + Math.abs(Math.sin(px * 0.05) * 20) + (Math.sin(px * 0.31) > 0.6 ? 16 : 0); c.lineTo(px + 8, at(y, px, x.W) + d); c.lineTo(px, at(y, px, x.W) + 8); }
      c.closePath(); c.fill();
      // gumdrops and lollipop trees
      for (let px = 0; px < x.W; px += range(x.r, 50, 110)) wrap(x, px, 50, (q) => {
        const b = at(y, q, x.W) + 30, k = x.r();
        if (k < 0.45) {
          const col = tone(x, ["#FF5A7A", "#5ACBFF", "#FFD23F", "#7CE07A", "#B07CFF"][Math.floor(x.r() * 5)]), w = range(x.r, 24, 44);
          c.fillStyle = col; c.beginPath(); c.moveTo(q - w, b); c.quadraticCurveTo(q - w, b - w * 1.5, q, b - w * 1.5); c.quadraticCurveTo(q + w, b - w * 1.5, q + w, b); c.closePath(); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.5); for (let s = 0; s < 6; s++) c.fillRect(q + range(x.r, -w * 0.7, w * 0.7), b - range(x.r, 5, w * 1.3), 2, 2);
          c.fillStyle = rgba("#FFFFFF", 0.3); c.beginPath(); c.ellipse(q - w * 0.35, b - w * 1.0, w * 0.18, w * 0.3, -0.4, 0, Math.PI * 2); c.fill();
        } else {
          const h = range(x.r, 70, 120), R = range(x.r, 18, 30), col = tone(x, ["#FF5A9A", "#5ACBFF", "#FFB23A"][Math.floor(x.r() * 3)]);
          c.fillStyle = tone(x, "#F8F8F8"); c.fillRect(q - 2, b - h, 4, h);
          c.fillStyle = col; c.beginPath(); c.arc(q, b - h, R, 0, Math.PI * 2); c.fill();
          c.strokeStyle = tone(x, "#FFFFFF"); c.lineWidth = R * 0.18; c.beginPath();
          for (let s = 0; s < 40; s++) { const a = s * 0.45, rr = (R * 0.85 * s) / 40; c.lineTo(q + Math.cos(a) * rr, b - h + Math.sin(a) * rr); }
          c.stroke();
        }
      });
      mist(x, 470, 600, 0.25);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [7, 0.25]]), 480, 60); ridge(x, y, shade(x.col, 0.15), shade(x.col, -0.15), 0.5);
      for (let px = 0; px < x.W; px += range(x.r, 90, 180)) wrap(x, px, 80, (q) => {
        const b = at(y, q, x.W) + 16, k = x.r();
        if (k < 0.35) {
          // a candy cane
          const h = range(x.r, 110, 170);
          c.lineCap = "round"; c.lineWidth = 16; c.strokeStyle = tone(x, "#FFFFFF");
          c.beginPath(); c.moveTo(q, b); c.lineTo(q, b - h); c.arc(q + 22, b - h, 22, Math.PI, 0); c.stroke();
          c.strokeStyle = tone(x, "#E8304A"); c.lineWidth = 16; c.setLineDash([10, 12]); c.beginPath(); c.moveTo(q, b); c.lineTo(q, b - h); c.arc(q + 22, b - h, 22, Math.PI, 0); c.stroke(); c.setLineDash([]);
        } else if (k < 0.65) {
          // a cupcake
          const w = range(x.r, 34, 50), wr = tone(x, "#E89AC8");
          c.fillStyle = tone(x, "#C88A5A"); c.beginPath(); c.moveTo(q - w, b - w * 0.9); c.lineTo(q - w * 0.75, b); c.lineTo(q + w * 0.75, b); c.lineTo(q + w, b - w * 0.9); c.closePath(); c.fill();
          c.strokeStyle = tone(x, "#A86A3A"); c.lineWidth = 2; c.beginPath(); for (let s = -3; s <= 3; s++) { c.moveTo(q + s * w * 0.26, b - w * 0.9); c.lineTo(q + s * w * 0.2, b); } c.stroke();
          c.fillStyle = wr; c.beginPath(); c.arc(q - w * 0.5, b - w, w * 0.5, 0, Math.PI * 2); c.arc(q + w * 0.5, b - w, w * 0.5, 0, Math.PI * 2); c.arc(q, b - w * 1.4, w * 0.6, 0, Math.PI * 2); c.fill();
          c.fillStyle = tone(x, "#E8304A"); c.beginPath(); c.arc(q, b - w * 2.05, w * 0.16, 0, Math.PI * 2); c.fill();
        } else {
          const h = range(x.r, 130, 190), R = range(x.r, 34, 50), col = tone(x, ["#FF5A9A", "#5ACBFF", "#FFB23A", "#7CE07A"][Math.floor(x.r() * 4)]);
          c.fillStyle = tone(x, "#F8F8F8"); c.fillRect(q - 3, b - h, 6, h);
          c.fillStyle = col; c.beginPath(); c.arc(q, b - h, R, 0, Math.PI * 2); c.fill();
          c.strokeStyle = tone(x, "#FFFFFF"); c.lineWidth = R * 0.16; c.beginPath();
          for (let s = 0; s < 46; s++) { const a = s * 0.42, rr = (R * 0.88 * s) / 46; c.lineTo(q + Math.cos(a) * rr, b - h + Math.sin(a) * rr); }
          c.stroke();
          c.fillStyle = rgba("#FFFFFF", 0.35); c.beginPath(); c.ellipse(q - R * 0.4, b - h - R * 0.4, R * 0.22, R * 0.14, -0.6, 0, Math.PI * 2); c.fill();
        }
      });
    },
  ],
  mars: [
    (x) => {
      const { c, W } = x;
      // canyon walls and mesas in rust and ochre
      const y = ys(profile(x.r, W, [[1, 1], [4, 0.35], [9, 0.1]]), 300, 160);
      for (let i = 0; i <= W; i++) y[i] = Math.round(y[i] / 22) * 22 + (y[i] % 22) * 0.25;
      ridge(x, y, shade(x.col, 0.08), x.col, 0.35); facets(x, y, 0.3);
      c.save(); shape(c, y, W, x.H); c.clip();
      for (let s = 0; s < 14; s++) { c.fillStyle = rgba(s % 2 ? "#FFFFFF" : "#3A0A0A", 0.06); c.fillRect(0, 300 + s * 22, W, 10); }
      c.restore();
      mist(x, 360, 600, 0.6);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[2, 1], [5, 0.3]]), 400, 90); ridge(x, y, shade(x.col, 0.08), shade(x.col, -0.2), 0.35); facets(x, y, 0.25);
      // craters
      for (let k = 0; k < 6; k++) wrap(x, range(x.r, 0, x.W), 75, (px) => { const b = at(y, px, x.W) + range(x.r, 20, 80), w = range(x.r, 30, 70); c.fillStyle = shade(x.col, -0.18); c.beginPath(); c.ellipse(px, b, w, w * 0.22, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = rgba(x.l.light, sunlit(x, 0.3)); c.lineWidth = 2; c.beginPath(); c.ellipse(px, b, w, w * 0.22, 0, 0.1, Math.PI - 0.1); c.stroke(); });
      // habitat domes linked by tubes
      wrap(x, range(x.r, 200, 1400), 200, (q) => {
        const b = at(y, q, x.W) + 24;
        c.fillStyle = tone(x, "#C8C8D0"); c.fillRect(q - 190, b - 14, 380, 10);
        for (const [dx, R] of [[-130, 50], [0, 80], [130, 46]] as const) {
          c.fillStyle = rgba("#9AF0FF", 0.25 + 0.25 * x.night); c.beginPath(); c.arc(q + dx, b, R, Math.PI, 0); c.fill();
          c.strokeStyle = tone(x, "#E8E8F0"); c.lineWidth = 2.5; c.beginPath(); c.arc(q + dx, b, R, Math.PI, 0); c.stroke();
          c.lineWidth = 1; c.beginPath(); c.arc(q + dx, b, R * 0.6, Math.PI, 0); c.moveTo(q + dx, b - R); c.lineTo(q + dx, b); c.stroke();
          glow(x, q + dx, b - R * 0.4, R * 1.2, "#9AF0FF", 0.15 + 0.3 * x.night);
          c.fillStyle = tone(x, "#3A8A4A"); c.beginPath(); c.arc(q + dx, b - 6, R * 0.3, Math.PI, 0); c.fill();
        }
      });
      // the launch tower with a rocket on the pad
      wrap(x, range(x.r, 0, x.W), 60, (q) => {
        const b = at(y, q, x.W) + 20, st = tone(x, "#7A8090");
        c.strokeStyle = st; c.lineWidth = 2;
        c.beginPath(); c.moveTo(q - 40, b); c.lineTo(q - 40, b - 200); c.moveTo(q - 22, b); c.lineTo(q - 22, b - 200); for (let k = 0; k < 10; k++) { c.moveTo(q - 40, b - k * 20); c.lineTo(q - 22, b - k * 20 - 20); } c.stroke();
        c.fillStyle = tone(x, "#F4F4F8"); c.beginPath(); c.moveTo(q - 8, b - 10); c.lineTo(q - 8, b - 160); c.quadraticCurveTo(q, b - 200, q + 8, b - 160); c.lineTo(q + 8, b - 10); c.closePath(); c.fill();
        c.fillStyle = tone(x, "#D8402A"); c.fillRect(q - 8, b - 130, 16, 8); c.beginPath(); c.moveTo(q - 8, b - 30); c.lineTo(q - 18, b - 6); c.lineTo(q - 8, b - 12); c.moveTo(q + 8, b - 30); c.lineTo(q + 18, b - 6); c.lineTo(q + 8, b - 12); c.fill();
        c.fillStyle = "#FF4A4A"; c.beginPath(); c.arc(q - 31, b - 204, 3, 0, Math.PI * 2); c.fill(); glow(x, q - 31, b - 204, 16, "#FF4A4A", 0.5 * x.night + 0.1);
      });
      mist(x, 460, 600, 0.3);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [8, 0.35], [19, 0.1]]), 470, 80); ridge(x, y, shade(x.col, 0.08), shade(x.col, -0.3), 0.3);
      for (let px = 0; px < x.W; px += range(x.r, 60, 140)) wrap(x, px, 75, (q) => {
        const b = at(y, q, x.W) + 14, w = range(x.r, 30, 70);
        c.fillStyle = shade(x.col, range(x.r, -0.22, -0.05)); c.beginPath(); c.moveTo(q - w, b); c.lineTo(q - w * 0.7, b - w * 0.8); c.lineTo(q - w * 0.1, b - w * 1.1); c.lineTo(q + w * 0.6, b - w * 0.7); c.lineTo(q + w, b); c.closePath(); c.fill();
        c.fillStyle = rgba(x.l.light, sunlit(x, 0.2)); c.beginPath(); c.moveTo(q - w * 0.1, b - w * 1.1); c.lineTo(q + w * 0.6 * (x.lightR ? 1 : -1), b - w * 0.7); c.lineTo(q, b - w * 0.3); c.closePath(); c.fill();
      });
      // glowing crystal clusters
      for (let k = 0; k < 6; k++) wrap(x, range(x.r, 0, x.W), 65, (q) => {
        const b = at(y, q, x.W) + 18, col = k % 2 ? "#9AF0FF" : "#C89AFF";
        glow(x, q, b - 20, 60, col, 0.2 + 0.3 * x.night);
        for (let s = 0; s < 4; s++) { const h = range(x.r, 24, 60), a = (s - 1.5) * 0.3; c.fillStyle = s % 2 ? col : shade(col, -0.2); c.beginPath(); c.moveTo(q + s * 8 - 12, b); c.lineTo(q + s * 8 - 12 + Math.sin(a) * h, b - h); c.lineTo(q + s * 8 - 4, b); c.closePath(); c.fill(); }
      });
    },
  ],
  cloud: [
    (x) => {
      const { W } = x;
      // distant sky islands over a sea of clouds
      for (let k = 0; k < 7; k++) wrap(x, range(x.r, 0, W), 90, (q) => isle(x, q, range(x.r, 230, 360), range(x.r, 70, 150), shade(x.col, -0.1), mix(x.col, "#8ACB8A", 0.35), x.r() < 0.5));
      cloudBank(x, 430, shade(mix(x.col, "#FFFFFF", 0.5), -x.night * 0.4), 60);
      mist(x, 300, 600, 0.4);
    },
    (x) => {
      const { c, W } = x;
      for (let k = 0; k < 4; k++) wrap(x, 200 + k * 400 + range(x.r, -80, 80), 170, (q) => {
        const py = range(x.r, 300, 380), w = range(x.r, 180, 300);
        isle(x, q, py, w, tone(x, "#8A7A6A"), x.col, x.r() < 0.6);
        if (k === 1) {
          // the keep: a stone tower with a pennant
          const st = tone(x, "#D8D0C0");
          c.fillStyle = st; c.fillRect(q - 22, py - 110, 44, 110);
          for (let s = 0; s < 4; s++) c.fillRect(q - 22 + s * 13, py - 120, 8, 10);
          c.fillStyle = tone(x, "#3A5AB0"); c.beginPath(); c.moveTo(q - 26, py - 110); c.lineTo(q, py - 160); c.lineTo(q + 26, py - 110); c.closePath(); c.fill();
          windowGlow(x, q - 5, py - 80, 10, 14);
          c.fillStyle = tone(x, "#FFD23F"); c.beginPath(); c.moveTo(q, py - 160); c.lineTo(q, py - 180); c.lineTo(q + 22, py - 174); c.lineTo(q, py - 168); c.fill();
        } else if (k === 3) {
          // a windmill
          const st = tone(x, "#F2E8D8");
          c.fillStyle = st; c.beginPath(); c.moveTo(q - 18, py); c.lineTo(q - 12, py - 80); c.lineTo(q + 12, py - 80); c.lineTo(q + 18, py); c.closePath(); c.fill();
          c.fillStyle = tone(x, "#C8503A"); c.beginPath(); c.moveTo(q - 16, py - 80); c.lineTo(q, py - 100); c.lineTo(q + 16, py - 80); c.closePath(); c.fill();
          c.strokeStyle = tone(x, "#8A6A50"); c.lineWidth = 3;
          for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2 + 0.4; c.beginPath(); c.moveTo(q, py - 86); c.lineTo(q + Math.cos(a) * 60, py - 86 + Math.sin(a) * 60); c.stroke(); c.fillStyle = rgba("#FFFFFF", 0.7); c.save(); c.translate(q, py - 86); c.rotate(a); c.fillRect(14, 2, 44, 10); c.restore(); }
        }
      });
      // rope bridges between isles
      c.strokeStyle = tone(x, "#8A6A50"); c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const a = range(x.r, 0, W), b2 = a + range(x.r, 120, 220), y0 = range(x.r, 320, 370); c.beginPath(); c.moveTo(a, y0); c.quadraticCurveTo((a + b2) / 2, y0 + 40, b2, y0 + range(x.r, -10, 10)); c.stroke(); }
      cloudBank(x, 500, shade(mix(x.l.haze, "#FFFFFF", 0.4), -x.night * 0.4), 50);
    },
    (x) => {
      const { c } = x;
      const y = ys(profile(x.r, x.W, [[3, 1], [6, 0.3]]), 480, 70); ridge(x, y, shade(x.col, 0.12), shade(x.col, -0.2), 0.5);
      for (let px = 0; px < x.W; px += range(x.r, 70, 150)) wrap(x, px, 110, (q) => { if (x.r() < 0.5) roundTree(x, q, at(y, q, x.W) + 18, range(x.r, 130, 200), shade(x.col, range(x.r, -0.2, 0)), x.r() < 0.3 ? tone(x, "#FF8AB0") : undefined); else bush(x, q, at(y, q, x.W) + 18, range(x.r, 60, 100), shade(x.col, range(x.r, -0.15, 0.05))); });
      // cloud puffs drifting past the hill's foot
      c.fillStyle = rgba(shade("#FFFFFF", -x.night * 0.4), 0.75);
      for (let k = 0; k < 10; k++) wrap(x, range(x.r, 0, x.W), 60, (px) => { const py = at(y, px, x.W) + range(x.r, 40, 100); c.beginPath(); c.arc(px, py, 30, 0, Math.PI * 2); c.arc(px + 30, py + 6, 24, 0, Math.PI * 2); c.arc(px - 28, py + 8, 20, 0, Math.PI * 2); c.fill(); });
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
  const data = c.getImageData(Math.round(W * res * 0.5), cv.height - 2, 1, 1).data;
  const base = data[3] < 250 ? col : `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return { canvas: cv, base };
}

/** a race's three layers: the world's own, with a remix partner's scenery in the middle layer */
export function paintBackdrop(look: Look, seed: number, res: number): Backdrop {
  const w = look.world.id, p = look.partner?.id;
  const strips = [0, 1, 2].map((i) => paintStrip(i === 1 && p ? p : w, i as 0 | 1 | 2, look.layers[i], look, seed + i, res)) as [Strip, Strip, Strip];
  return { strips };
}
