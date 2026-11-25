// Trackside props, painted once per race into sprites (a few variants of each kind, graded for the time of day) and
// stamped along the track: palms, obelisks, tents and pyramids in the dunes; columns, arches and temples in the
// ruins; ice blocks, flags and a polar station; lamps, containers, neon signs, cranes and a lighthouse at the
// harbour; ferns, idols and a jungle temple; tyre stacks, wrecks, a crusher and a magnet crane; umbrellas, a big
// wheel and a lifeguard tower at the beach; mine carts, lanterns and a headframe; storm pines and a weather tower;
// lollipops, candy canes, cupcakes and a candy house; red rocks, crystals, domes and a rocket; trees, a keep and a
// windmill on the sky isles. Moving bits (sails, the big wheel, the lighthouse beam, neon flicker, lamp glows, flags,
// the crusher's ram, a swinging magnet, a rocket's steam, glowing crystals) are drawn live by `propMotion`.
import type { PropKind } from "../worlds";
import type { Look } from "./grade";
import { makeRng, mix, range, rgba, shade, type Rng } from "../util";

type C = CanvasRenderingContext2D;
export interface Sprite { cv: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

/** sprite bounds in metres: [width, height, anchor x, below-ground depth] */
const BOX: Record<PropKind, [number, number, number, number]> = {
  palm: [4.4, 6.6, 2.2, 0.2], obelisk: [1.4, 5.4, 0.7, 0.2], urn: [1.2, 1.4, 0.6, 0.1], tent: [4, 2.8, 2, 0.2], pyramid: [16, 9.6, 8, 0.4], statue: [7, 8.4, 3.5, 0.4],
  column: [1.6, 5.4, 0.8, 0.2], ruinarch: [8, 7, 4, 0.3], amphora: [1, 1.4, 0.5, 0.1], spire: [1.4, 4.4, 0.7, 0.2], rubble: [2.6, 1.0, 1.3, 0.2], temple: [12, 8.6, 6, 0.4],
  iceblock: [2.2, 1.6, 1.1, 0.2], flagpole: [2.4, 5, 0.2, 0.2], mast: [2.4, 6.4, 1.2, 0.2], crate: [1.4, 1.3, 0.7, 0.1], iceberg: [10, 6.4, 5, 0.4], station: [12, 6.4, 6, 0.4],
  lamp: [1.6, 5, 0.4, 0.2], container: [6.2, 2.8, 3.1, 0.1], bollard: [0.8, 1.0, 0.4, 0.1], neon: [3.6, 4.6, 1.8, 0.2], crane: [14, 14, 6, 0.3], lighthouse: [4, 12, 2, 0.4],
  fern: [2.4, 1.5, 1.2, 0.1], bigleaf: [2.8, 2.4, 1.4, 0.1], idol: [2, 3.4, 1, 0.2], vinepost: [1.6, 4, 0.8, 0.2], jungletemple: [14, 10, 7, 0.4],
  tires: [2.2, 2.0, 1.1, 0.1], wreck: [4.6, 1.8, 2.3, 0.2], drum: [1.0, 1.3, 0.5, 0.1], cone: [0.8, 0.9, 0.4, 0.05], crusher: [9, 9, 4.5, 0.3], magnet: [12, 12, 2.5, 0.3],
  umbrella: [3.4, 3.2, 1.7, 0.3], surfboard: [1.2, 2.6, 0.6, 0.3], bench: [2.4, 1.2, 1.2, 0.1], lifeguard: [5, 7, 2.5, 0.3], ferris: [14, 16, 7, 0.3],
  minecart: [2.6, 1.8, 1.3, 0.1], lantern: [1.6, 3.6, 0.4, 0.2], timber: [3, 2.8, 1.5, 0.2], headframe: [9, 13, 4.5, 0.3],
  pine: [3.4, 6.4, 1.7, 0.2], rock: [2.4, 1.4, 1.2, 0.3], deadtree: [3.4, 5, 1.7, 0.2], rod: [1.2, 5.2, 0.6, 0.2], weather: [7, 12, 3.5, 0.4],
  lollipop: [2.2, 4.2, 1.1, 0.2], cane: [1.8, 3.6, 0.6, 0.2], gumdrop: [1.8, 1.6, 0.9, 0.1], cupcake: [2.4, 2.6, 1.2, 0.1], candyhouse: [9, 9, 4.5, 0.3],
  redrock: [3, 2.2, 1.5, 0.3], crystal: [1.8, 2.0, 0.9, 0.1], antenna: [1.6, 5, 0.8, 0.2], dish: [3, 3.4, 1.5, 0.2], dome: [10, 5.8, 5, 0.3], rocket: [6, 15, 3, 0.3],
  bush: [2.6, 1.5, 1.3, 0.1], tree: [4.4, 5.4, 2.2, 0.2], windvane: [1.6, 4, 0.8, 0.2], keep: [8, 12, 4, 0.4], windmill: [6, 11, 3, 0.3],
};
export const BIG_PROPS = new Set<PropKind>(["pyramid", "statue", "temple", "ruinarch", "iceberg", "station", "crane", "lighthouse", "jungletemple", "crusher", "magnet", "ferris", "lifeguard", "headframe", "weather", "candyhouse", "dome", "rocket", "keep", "windmill"]);

interface P { c: C; r: Rng; g: (col: string) => string; n: number; light: string; lr: number }

function ell(c: C, x: number, y: number, rx: number, ry: number, col: string) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function poly(c: C, col: string, pts: number[]) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
function rect(c: C, x: number, y: number, w: number, h: number, col: string) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function line(c: C, col: string, w: number, pts: number[]) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); }
const sun = (p: P, a: number) => rgba(p.light, a * (1 - p.n * 0.7));
function win(p: P, x: number, y: number, w: number, h: number) {
  const lit = p.n > 0.25;
  rect(p.c, x, y, w, h, lit ? "#FFD27A" : p.g("#9EC6E8"));
  if (!lit) rect(p.c, x + w * 0.1, y + h * 0.55, w * 0.3, h * 0.3, "rgba(255,255,255,0.5)");
}
/** a soft round crown from a few puffs, lit from the sun's side */
function crown(p: P, x: number, y: number, R: number, col: string) {
  const { c, r } = p;
  for (const [ox, oy, s] of PUFFS) ell(c, x + ox * R, y + oy * R, R * s + range(r, -0.03, 0.03), R * s * 0.92, shade(col, -0.12));
  for (const [ox, oy, s] of PUFFS) ell(c, x + ox * R + p.lr * R * 0.06, y + oy * R + R * 0.06, R * s * 0.85, R * s * 0.78, col);
  ell(c, x + p.lr * R * 0.3, y + R * 0.35, R * 0.45, R * 0.35, sun(p, 0.22));
}
const PUFFS = [[0, 0, 1], [-0.6, -0.15, 0.72], [0.62, -0.12, 0.7], [-0.25, 0.48, 0.66], [0.32, 0.42, 0.64]] as const;
function trunk(p: P, x: number, h: number, w: number, col: string) {
  poly(p.c, col, [x - w, 0, x - w * 0.6, h, x + w * 0.6, h, x + w, 0]);
  poly(p.c, sun(p, 0.15), [x + p.lr * w * 0.2, 0, x + p.lr * w * 0.2, h, x + p.lr * w * 0.6, h, x + p.lr * w, 0]);
}
function tiers(p: P, x: number, base: number, h: number, w: number, col: string, n: number, snow: boolean) {
  for (let k = 0; k < n; k++) {
    const y0 = base + ((h * k) / n) * 0.85, tw = w * (1 - k / (n + 0.6)), th = h * 0.36;
    p.c.fillStyle = shade(col, -0.1 + k * 0.03);
    p.c.beginPath(); p.c.moveTo(x - tw, y0); p.c.quadraticCurveTo(x - tw * 0.4, y0 + th * 0.3, x, y0 + th); p.c.quadraticCurveTo(x + tw * 0.4, y0 + th * 0.3, x + tw, y0); p.c.quadraticCurveTo(x, y0 + th * 0.12, x - tw, y0); p.c.fill();
    poly(p.c, sun(p, 0.16), [x, y0 + th, x + p.lr * tw, y0, x + p.lr * tw * 0.3, y0 + th * 0.1]);
    if (snow) { p.c.fillStyle = "#F6FAFF"; p.c.beginPath(); p.c.moveTo(x - tw * 0.6, y0 + th * 0.45); p.c.quadraticCurveTo(x - tw * 0.2, y0 + th * 0.7, x, y0 + th); p.c.quadraticCurveTo(x + tw * 0.2, y0 + th * 0.7, x + tw * 0.6, y0 + th * 0.45); p.c.quadraticCurveTo(x, y0 + th * 0.55, x - tw * 0.6, y0 + th * 0.45); p.c.fill(); }
  }
}
function roof(p: P, x0: number, x1: number, y: number, h: number, col: string) {
  const m = (x0 + x1) / 2;
  poly(p.c, col, [x0 - 0.4, y, m, y + h, x1 + 0.4, y]);
  poly(p.c, shade(col, -0.2), [m, y + h, x1 + 0.4, y, x1 + 0.1, y - 0.15, m, y + h - 0.25]);
}
function colm(p: P, x: number, w: number, h: number, col: string, broken: boolean) {
  const c = p.c;
  rect(c, x - w * 0.72, 0, w * 1.44, w * 0.3, shade(col, -0.12));
  if (broken) poly(c, col, [x - w / 2, w * 0.3, x - w / 2, h, x - w * 0.12, h + w * 0.45, x + w * 0.12, h - w * 0.15, x + w / 2, h + w * 0.25, x + w / 2, w * 0.3]);
  else { rect(c, x - w / 2, w * 0.3, w, h - w * 0.3, col); rect(c, x - w * 0.78, h, w * 1.56, w * 0.34, shade(col, 0.08)); }
  for (let k = -1; k <= 1; k++) line(c, rgba(shade(col, -0.38), 0.4), w * 0.05, [x + k * w * 0.24, w * 0.32, x + k * w * 0.24, h - w * 0.2]);
  rect(c, p.lr > 0 ? x + w * 0.18 : x - w / 2, w * 0.3, w * 0.32, h - w * 0.6, sun(p, 0.18));
}
/** a spoked wheel */
function wheel(c: C, x: number, y: number, R: number, spokes: number, col: string, w: number) {
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2);
  for (let k = 0; k < spokes; k++) { const a = (k * Math.PI * 2) / spokes; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); }
  c.stroke();
}
function swirl(c: C, x: number, y: number, R: number, col: string, w: number) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath();
  for (let s = 0; s < 44; s++) { const a = s * 0.42, rr = (R * 0.9 * s) / 44; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.stroke();
}
const PAINTS = ["#E8402A", "#2A72D8", "#22A06A", "#E89A22", "#7A3AD8", "#D8D8DE", "#1E8A9A"];

const PAINT: Record<PropKind, (p: P) => void> = {
  // ---- dunes
  palm: (p) => {
    const { c, r } = p, lean = range(r, -0.5, 0.5), tx = lean, ty = 5.2;
    line(c, p.g("#9A7048"), 0.3, [0, 0, lean * 0.3, 2.6, tx, ty]);
    for (let k = 1; k < 9; k++) { const u = k / 9; line(c, p.g("#6E4A2E"), 0.04, [lean * 0.3 * u * 2 - 0.15 * (1 - u * 0.3), u * 5.2, lean * 0.3 * u * 2 + 0.15 * (1 - u * 0.3), u * 5.2 + 0.05]); }
    for (let k = 0; k < 8; k++) {
      const a = (k / 7) * Math.PI + range(r, -0.1, 0.1), L = range(r, 1.6, 2.2), co = Math.cos(a), s = Math.sin(a);
      const ex = tx + co * L, ey = ty + s * L * 0.4 - L * 0.55 * (1 - s), mx = tx + co * L * 0.55, my = ty + s * L * 0.55 + L * 0.2;
      c.fillStyle = p.g(k % 2 ? "#3E9A48" : "#2E7A3A"); c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(mx, my + 0.3, ex, ey); c.quadraticCurveTo(mx, my - 0.3, tx, ty); c.fill();
    }
    for (let k = 0; k < 3; k++) ell(c, tx + (k - 1) * 0.16, ty - 0.12, 0.14, 0.14, p.g("#6A4A2A"));
  },
  obelisk: (p) => { const c = p.c; poly(c, p.g("#D8B078"), [-0.45, 0, -0.3, 4.6, 0, 5.3, 0.3, 4.6, 0.45, 0]); poly(c, sun(p, 0.25), [0, 0, 0, 5.3, 0.3 * p.lr, 4.6, 0.45 * p.lr, 0]); poly(c, p.g("#FFC93D"), [-0.3, 4.6, 0, 5.3, 0.3, 4.6]); for (let k = 0; k < 4; k++) rect(c, -0.12, 1 + k * 0.8, 0.24, 0.3, p.g("#8A6A44")); },
  urn: (p) => { const c = p.c; c.fillStyle = p.g("#C8743A"); c.beginPath(); c.moveTo(-0.2, 0); c.quadraticCurveTo(-0.6, 0.6, -0.25, 1.1); c.lineTo(-0.3, 1.3); c.lineTo(0.3, 1.3); c.lineTo(0.25, 1.1); c.quadraticCurveTo(0.6, 0.6, 0.2, 0); c.fill(); rect(c, -0.45, 0.55, 0.9, 0.1, p.g("#2A1A10")); ell(c, 0.15 * p.lr, 0.7, 0.12, 0.25, sun(p, 0.3)); },
  tent: (p) => { const c = p.c; poly(c, p.g("#E8504A"), [-1.9, 0, 0, 2.6, 1.9, 0]); for (let k = 0; k < 3; k++) poly(c, p.g("#F2E8D8"), [-1.9 + k * 1.3, 0, -0.2 + k * 0.1, 2.4, -1.4 + k * 1.3, 0]); poly(c, p.g("#2A1A14"), [-0.4, 0, 0, 1.3, 0.4, 0]); line(c, p.g("#8A6A44"), 0.06, [0, 2.6, 0, 2.8]); },
  pyramid: (p) => {
    const c = p.c; poly(c, p.g("#E0B070"), [-7.8, 0, 0, 9.4, 7.8, 0]); poly(c, sun(p, 0.22), [0, 9.4, 7.8 * p.lr, 0, 1.0 * p.lr, 0]);
    for (let k = 1; k < 14; k++) { const y = (9.4 * k) / 14, hw = 7.8 * (1 - k / 14); line(c, rgba("#5A3A1A", 0.2), 0.05, [-hw, y, hw, y]); }
    poly(c, p.g("#2A1A10"), [-0.6, 0, -0.6, 1.4, 0, 1.9, 0.6, 1.4, 0.6, 0]); poly(c, p.g("#FFD25A"), [-0.7, 8.6, 0, 9.4, 0.7, 8.6]);
  },
  statue: (p) => {
    const c = p.c, st = p.g("#D8B078"), dk = p.g("#A07A4A");
    rect(c, -3.2, 0, 6.4, 1.2, dk); rect(c, -3.4, 1.1, 6.8, 0.3, st);
    // a seated stone giant: legs, body, arms on knees, a crowned head
    rect(c, -2.0, 1.4, 1.4, 2.4, st); rect(c, 0.6, 1.4, 1.4, 2.4, st); rect(c, -2.2, 3.6, 4.4, 1.0, st);
    poly(c, st, [-1.7, 4.6, -1.4, 7.0, 1.4, 7.0, 1.7, 4.6]); poly(c, dk, [-2.3, 4.6, -2.0, 3.6, -1.4, 3.6, -1.6, 6.4]); poly(c, dk, [2.3, 4.6, 2.0, 3.6, 1.4, 3.6, 1.6, 6.4]);
    ell(c, 0, 7.5, 0.85, 0.9, st); poly(c, p.g("#3A6AB0"), [-1.1, 7.6, -1.2, 6.6, -0.7, 7.0, 0.7, 7.0, 1.2, 6.6, 1.1, 7.6, 0, 8.6]);
    for (let k = -2; k <= 2; k++) line(c, p.g("#FFC93D"), 0.08, [k * 0.22, 7.7, k * 0.3, 8.3]);
    rect(c, -0.45, 7.4, 0.25, 0.08, dk); rect(c, 0.2, 7.4, 0.25, 0.08, dk);
    rect(c, p.lr > 0 ? 0.6 : -2.0, 1.4, 1.4, 2.4, sun(p, 0.15));
  },
  // ---- ruins
  column: (p) => colm(p, 0, 0.9, range(p.r, 2.6, 4.8), p.g("#B8A096"), p.r() < 0.6),
  ruinarch: (p) => { const c = p.c, st = p.g("#A89088"); rect(c, -3.6, 0, 1.2, 5.2, st); rect(c, 2.4, 0, 1.2, 3.6, st); c.strokeStyle = st; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 5.0, 2.95, Math.PI * 0.15 + Math.PI, Math.PI * 2, false); c.stroke(); poly(c, st, [-3.6, 5.2, -3.8, 6.0, -2.2, 6.6, -1.6, 6.2]); for (let k = 0; k < 5; k++) rect(c, -3.6, 0.6 + k * 0.95, 1.2, 0.05, p.g("#6A5450")); rect(c, p.lr > 0 ? 3.0 : -3.6, 0, 0.6, 3.6, sun(p, 0.15)); },
  amphora: (p) => { const c = p.c; c.fillStyle = p.g("#B85A3A"); c.beginPath(); c.moveTo(-0.08, 0); c.quadraticCurveTo(-0.5, 0.7, -0.18, 1.1); c.lineTo(-0.15, 1.35); c.lineTo(0.15, 1.35); c.lineTo(0.18, 1.1); c.quadraticCurveTo(0.5, 0.7, 0.08, 0); c.fill(); line(c, p.g("#B85A3A"), 0.06, [-0.15, 1.25, -0.35, 1.2, -0.3, 0.95]); line(c, p.g("#B85A3A"), 0.06, [0.15, 1.25, 0.35, 1.2, 0.3, 0.95]); rect(c, -0.4, 0.65, 0.8, 0.08, p.g("#2A140A")); },
  spire: (p) => { const c = p.c; poly(c, p.g("#8A7470"), [-0.6, 0, -0.4, 2.8, -0.1, 4.2, 0.2, 3.0, 0.6, 0]); poly(c, sun(p, 0.2), [0, 0, -0.1, 4.2, 0.2, 3.0, 0.6, 0]); line(c, rgba("#FF8A3A", 0.5 + 0.4 * p.n), 0.05, [-0.2, 0.4, 0.1, 1.4, -0.1, 2.2]); },
  rubble: (p) => { const c = p.c; for (let k = 0; k < 5; k++) { const x = range(p.r, -1.1, 1.0), w = range(p.r, 0.3, 0.6); poly(c, p.g(k % 2 ? "#9A8478" : "#7A6660"), [x - w, 0, x - w * 0.6, w * 0.9, x + w * 0.5, w, x + w, 0]); } },
  temple: (p) => {
    const c = p.c, st = p.g("#C8B0A0");
    for (let k = 0; k < 3; k++) rect(c, -5.6 + k * 0.4, k * 0.4, 11.2 - k * 0.8, 0.42, shade(st, -0.06 * k));
    for (let k = 0; k < 6; k++) colm(p, -4.2 + k * 1.68, 0.7, 5.6, st, k === 4);
    poly(c, shade(st, 0.06), [-5.4, 6.8, 0, 8.4, 3.2, 7.4, 3.6, 6.8]); rect(c, -5.4, 6.4, 8.8, 0.42, shade(st, -0.08));
    poly(c, p.g("#2A1C1A"), [-1.4, 7.0, 0, 7.8, 1.4, 7.0]);
  },
  // ---- polar
  iceblock: (p) => { const c = p.c; poly(c, p.g("#BFE4FF"), [-1.0, 0, -0.9, 1.2, -0.2, 1.5, 0.9, 1.3, 1.0, 0]); poly(c, p.g("#8EC8F0"), [0.2, 0, 0.3, 1.45, 0.9, 1.3, 1.0, 0]); line(c, "rgba(255,255,255,0.8)", 0.06, [-0.7, 1.1, -0.2, 1.35]); ell(c, -0.1, 1.45, 0.9, 0.12, "#F6FAFF"); },
  flagpole: (p) => { const c = p.c; rect(c, -0.06, 0, 0.12, 4.8, p.g("#8A96A8")); ell(c, 0, 4.85, 0.12, 0.12, p.g("#FFD23F")); },
  mast: (p) => { const c = p.c; line(c, p.g("#C8402A"), 0.14, [0, 0, 0, 6.0]); for (let k = 0; k < 6; k++) line(c, p.g(k % 2 ? "#F2F2F2" : "#C8402A"), 0.16, [0, k, 0, k + 1]); line(c, p.g("#6A7488"), 0.03, [0, 6, -1.1, 0, 0, 6, 1.1, 0]); rect(c, -0.5, 4.6, 1.0, 0.1, p.g("#6A7488")); ell(c, -0.5, 4.7, 0.18, 0.18, p.g("#F2F2F2")); },
  crate: (p) => { const c = p.c; rect(c, -0.65, 0, 1.3, 1.2, p.g("#C8402A")); rect(c, -0.65, 1.05, 1.3, 0.2, "#F6FAFF"); line(c, p.g("#8A2A1A"), 0.06, [-0.6, 0.05, 0.6, 1.0]); line(c, p.g("#8A2A1A"), 0.06, [-0.6, 1.0, 0.6, 0.05]); },
  iceberg: (p) => {
    const c = p.c; poly(c, p.g("#E8F6FF"), [-4.8, 0, -4.0, 2.4, -2.6, 3.4, -1.6, 6.0, 0.2, 4.6, 1.4, 6.2, 2.6, 3.8, 4.0, 2.6, 4.8, 0]);
    poly(c, p.g("#A8D4F4"), [0.2, 4.6, 1.4, 6.2, 2.6, 3.8, 4.0, 2.6, 4.8, 0, 0.6, 0]);
    poly(c, p.g("#7CB8E8"), [-1.6, 6.0, -0.6, 2.0, -1.2, 0, -2.6, 3.4]);
    for (let k = 0; k < 4; k++) line(c, "rgba(255,255,255,0.6)", 0.08, [-3 + k * 1.8, 1.0 + (k % 2), -2.4 + k * 1.8, 2.2 + (k % 2)]);
  },
  station: (p) => {
    const c = p.c;
    for (const x of [-5, -1.4, 2.2]) { rect(c, x, 0, 0.3, 1.2, p.g("#6A7488")); }
    rect(c, -5.4, 1.2, 7.4, 2.6, p.g("#E8402A")); rect(c, -5.4, 3.6, 7.4, 0.3, p.g("#F2F2F2"));
    for (let k = 0; k < 4; k++) win(p, -4.8 + k * 1.7, 2.0, 1.0, 0.9);
    c.fillStyle = p.g("#F2F2F2"); c.beginPath(); c.arc(4.0, 0, 2.6, 0, Math.PI); c.fill();
    c.strokeStyle = p.g("#8A96A8"); c.lineWidth = 0.08; c.beginPath(); c.arc(4.0, 0, 2.6, 0, Math.PI); c.moveTo(4.0, 2.6); c.lineTo(4.0, 0); c.moveTo(1.6, 1.0); c.lineTo(6.4, 1.0); c.stroke();
    rect(c, -0.5, 3.9, 0.12, 2.0, p.g("#6A7488")); ell(c, -0.44, 5.9, 0.4, 0.15, p.g("#C8CCD8"));
  },
  // ---- harbour
  lamp: (p) => { const c = p.c; rect(c, -0.08, 0, 0.16, 4.4, p.g("#3A3E52")); line(c, p.g("#3A3E52"), 0.12, [0, 4.4, 0.5, 4.7, 1.0, 4.6]); poly(c, p.g("#2A2D3A"), [0.7, 4.65, 1.3, 4.65, 1.2, 4.4, 0.8, 4.4]); rect(c, 0.82, 4.32, 0.36, 0.1, p.n > 0.2 ? "#FFF0C0" : p.g("#C8CCD8")); },
  container: (p) => { const c = p.c, col = p.g(PAINTS[Math.floor(p.r() * PAINTS.length)]); rect(c, -3.0, 0, 6.0, 2.6, col); for (let k = -2.8; k < 2.9; k += 0.3) rect(c, k, 0.1, 0.08, 2.4, shade(col, -0.25)); rect(c, -3.0, 2.5, 6.0, 0.1, rgba("#FFFFFF", 0.2)); rect(c, -3.0, 0, 6.0, 0.1, shade(col, -0.4)); rect(c, -1.0, 1.0, 2.0, 0.5, rgba("#FFFFFF", 0.5)); },
  bollard: (p) => { const c = p.c; rect(c, -0.25, 0, 0.5, 0.7, p.g("#2A2D3A")); ell(c, 0, 0.75, 0.38, 0.2, p.g("#3A3E52")); rect(c, -0.25, 0.3, 0.5, 0.12, p.g("#FFD23F")); },
  neon: (p) => { const c = p.c; rect(c, -0.1, 0, 0.2, 2.4, p.g("#3A3E52")); rect(c, 1.4, 0, 0.2, 2.4, p.g("#3A3E52")); rect(c, -1.6, 2.4, 3.4, 2.0, "#14102A"); },
  crane: (p) => {
    const c = p.c, col = p.g("#E89A22");
    line(c, col, 0.35, [-2.6, 0, -2.0, 9.0]); line(c, col, 0.35, [2.6, 0, 2.0, 9.0]); line(c, col, 0.3, [-2.5, 4.4, 2.5, 4.4]);
    line(c, col, 0.12, [-2.5, 4.4, 2.0, 9.0]); line(c, col, 0.12, [2.5, 4.4, -2.0, 9.0]); line(c, col, 0.12, [-2.3, 1.0, 2.3, 4.0]);
    rect(c, -6.0, 9.0, 13.6, 0.5, col); rect(c, -1.4, 9.5, 2.8, 1.3, p.g("#F2F2F2")); win(p, -1.0, 9.8, 0.8, 0.6);
    line(c, p.g("#3A3E52"), 0.05, [0, 10.8, 0, 12.6, -5.8, 9.5]); line(c, p.g("#3A3E52"), 0.05, [0, 12.6, 7.4, 9.5]);
    rect(c, -0.3, 12.4, 0.6, 0.4, col);
  },
  lighthouse: (p) => {
    const c = p.c;
    poly(c, p.g("#F2F2F2"), [-1.5, 0, -0.9, 9.0, 0.9, 9.0, 1.5, 0]);
    for (let k = 0; k < 4; k++) { const y0 = 0.6 + k * 2.2, w0 = 1.5 - (y0 / 9) * 0.6, w1 = 1.5 - ((y0 + 1.1) / 9) * 0.6; poly(c, p.g("#D8302A"), [-w0, y0, -w1, y0 + 1.1, w1, y0 + 1.1, w0, y0]); }
    poly(c, sun(p, 0.2), [0, 0, 0, 9, 0.9 * p.lr, 9, 1.5 * p.lr, 0]);
    rect(c, -1.2, 9.0, 2.4, 0.3, p.g("#2A2D3A")); rect(c, -0.7, 9.3, 1.4, 1.3, p.n > 0.2 ? "#FFF6C0" : p.g("#9EC6E8")); poly(c, p.g("#2A2D3A"), [-0.9, 10.6, 0, 11.6, 0.9, 10.6]);
    rect(c, -0.3, 0, 0.6, 1.2, p.g("#3A2A20"));
  },
  // ---- jungle
  fern: (p) => { const { c } = p; for (let k = -3; k <= 3; k++) { const ex = k * 0.36, ey = range(p.r, 0.8, 1.3); line(c, p.g(k % 2 ? "#3E9A48" : "#4FB85A"), 0.07, [0, 0, k * 0.2, ey * 0.7, ex, ey]); for (let s = 0.25; s < 0.95; s += 0.14) { const bx = ex * s, by = ey * s; line(c, p.g("#4FB85A"), 0.05, [bx, by, bx - 0.16, by - 0.06]); line(c, p.g("#4FB85A"), 0.05, [bx, by, bx + 0.16, by - 0.06]); } } },
  bigleaf: (p) => { const c = p.c; for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k - 2) * 0.5, L = range(p.r, 1.4, 2.1), ex = Math.cos(a) * L, ey = Math.sin(a) * L; line(c, p.g("#2E7A3A"), 0.06, [0, 0, ex * 0.7, ey * 0.7]); c.save(); c.translate(ex * 0.75, ey * 0.75); c.rotate(a - Math.PI / 2); ell(c, 0, 0, 0.42, 0.7, p.g(k % 2 ? "#2E8A40" : "#3EA850")); line(c, rgba("#FFFFFF", 0.2), 0.03, [0, -0.6, 0, 0.6]); c.restore(); } },
  idol: (p) => { const c = p.c, st = p.g("#7A8A6A"); rect(c, -0.8, 0, 1.6, 3.0, st); rect(c, -0.95, 2.6, 1.9, 0.6, shade(st, 0.08)); rect(c, -0.5, 1.9, 0.35, 0.3, p.g("#1E2A1A")); rect(c, 0.15, 1.9, 0.35, 0.3, p.g("#1E2A1A")); rect(c, -0.4, 1.0, 0.8, 0.25, p.g("#1E2A1A")); rect(c, -0.1, 1.4, 0.2, 0.45, shade(st, -0.15)); ell(c, -0.5, 2.6, 0.25, 0.4, p.g("#3EA05A")); ell(c, 0.6, 0.8, 0.3, 0.5, p.g("#3EA05A")); },
  vinepost: (p) => { const c = p.c; rect(c, -0.25, 0, 0.5, 3.6, p.g("#6A5A4A")); c.strokeStyle = p.g("#2E8A40"); c.lineWidth = 0.1; c.beginPath(); for (let y = 0; y < 3.6; y += 0.1) c.lineTo(Math.sin(y * 4) * 0.32, y); c.stroke(); for (let k = 0; k < 6; k++) ell(c, Math.sin(k * 2.6) * 0.35, 0.4 + k * 0.55, 0.16, 0.1, p.g("#3EA850")); },
  jungletemple: (p) => {
    const c = p.c, st = p.g("#8A9A7A");
    for (let k = 0; k < 6; k++) rect(c, -6.4 + k * 0.9, k * 1.25, 12.8 - k * 1.8, 1.3, shade(st, -0.05 * (k % 2)));
    rect(c, -1.3, 7.5, 2.6, 1.9, shade(st, -0.1)); rect(c, -0.5, 7.5, 1.0, 1.3, p.g("#1A2014"));
    rect(c, -0.8, 0, 1.6, 7.5, shade(st, -0.18)); for (let k = 0; k < 15; k++) rect(c, -0.8, k * 0.5, 1.6, 0.06, shade(st, -0.3));
    for (let k = 0; k < 16; k++) ell(c, range(p.r, -5.5, 5.5), range(p.r, 0.5, 7), range(p.r, 0.2, 0.45), range(p.r, 0.15, 0.3), p.g("#3EA05A"));
  },
  // ---- scrapyard
  tires: (p) => { const c = p.c, n = 3 + Math.floor(p.r() * 2); for (let k = 0; k < n; k++) { rect(c, -1.0, k * 0.45, 2.0, 0.44, p.g("#1E1E24")); rect(c, -1.0, k * 0.45 + 0.32, 2.0, 0.1, p.g("#3A3A44")); rect(c, -0.3, k * 0.45 + 0.05, 0.6, 0.34, p.g("#0E0E12")); } },
  wreck: (p) => { const c = p.c, col = p.g(PAINTS[Math.floor(p.r() * 5)]); c.save(); c.rotate(range(p.r, -0.12, 0.12)); poly(c, col, [-2.2, 0.4, -2.1, 1.0, -1.0, 1.1, -0.5, 1.7, 0.9, 1.7, 1.4, 1.0, 2.2, 0.9, 2.2, 0.4]); poly(c, p.g("#2A3A4A"), [-0.4, 1.12, -0.1, 1.55, 0.7, 1.55, 1.0, 1.12]); rect(c, -1.2, 0.7, 0.6, 0.15, rgba("#7A3A1A", 0.6)); c.restore(); ell(c, -1.3, 0.35, 0.38, 0.38, p.g("#1E1E24")); ell(c, 1.3, 0.3, 0.38, 0.32, p.g("#1E1E24")); },
  drum: (p) => { const c = p.c, col = p.g(p.r() < 0.5 ? "#2A72D8" : "#E8402A"); rect(c, -0.42, 0, 0.84, 1.2, col); for (const y of [0.3, 0.9]) rect(c, -0.42, y, 0.84, 0.08, shade(col, -0.3)); ell(c, 0, 1.2, 0.42, 0.1, shade(col, 0.15)); rect(c, p.lr > 0 ? 0.1 : -0.4, 0.05, 0.3, 1.1, sun(p, 0.2)); },
  cone: (p) => { const c = p.c; rect(c, -0.35, 0, 0.7, 0.08, p.g("#2A2A2A")); poly(c, p.g("#FF7A1A"), [-0.28, 0.08, -0.06, 0.85, 0.06, 0.85, 0.28, 0.08]); poly(c, "#F6F6F6", [-0.2, 0.32, -0.15, 0.5, 0.15, 0.5, 0.2, 0.32]); },
  crusher: (p) => {
    const c = p.c, col = p.g("#5E6478");
    rect(c, -4.2, 0, 8.4, 1.6, col); rect(c, -4.2, 0, 0.8, 8.0, col); rect(c, 3.4, 0, 0.8, 8.0, col); rect(c, -4.4, 7.8, 8.8, 0.9, shade(col, 0.1));
    for (let k = 0; k < 8; k++) poly(c, p.g(k % 2 ? "#FFD23F" : "#1A1A1A"), [-4.4 + k * 1.1, 7.8, -3.85 + k * 1.1, 7.8, -4.4 + k * 1.1 + 0.3, 8.7, -4.4 + k * 1.1 - 0.25, 8.7]);
    rect(c, -3.0, 1.6, 6.0, 0.9, p.g("#4A2A2A"));
  },
  magnet: (p) => {
    const c = p.c, col = p.g("#E89A22");
    rect(c, -0.6, 0, 1.2, 10.6, col); for (let k = 0; k < 10; k++) line(c, shade(col, -0.25), 0.1, [-0.6, k, 0.6, k + 1]);
    rect(c, -2.2, 10.6, 11.6, 0.6, col); rect(c, -2.6, 10.0, 2.0, 1.5, p.g("#3A3E52"));
    rect(c, -1.4, 0, 2.8, 1.4, p.g("#3A3E52"));
  },
  // ---- boardwalk
  umbrella: (p) => { const c = p.c, a = p.g(PAINTS[Math.floor(p.r() * 4)]); line(c, p.g("#E8E0D0"), 0.08, [0, -0.3, 0, 2.6]); c.fillStyle = a; c.beginPath(); c.moveTo(-1.6, 2.2); c.quadraticCurveTo(0, 3.5, 1.6, 2.2); c.closePath(); c.fill(); for (let k = 0; k < 4; k++) poly(c, "#F8F8F8", [-1.6 + k * 0.8, 2.2, -1.2 + k * 0.8, 2.2, -0.05 + k * 0.03, 3.1]); },
  surfboard: (p) => { const c = p.c, a = p.g(PAINTS[Math.floor(p.r() * 5)]); c.save(); c.rotate(-0.12); ell(c, 0, 1.1, 0.42, 1.35, a); line(c, "#F8F8F8", 0.08, [0, -0.1, 0, 2.3]); c.restore(); },
  bench: (p) => { const c = p.c; for (const x of [-0.9, 0.8]) rect(c, x, 0, 0.12, 0.9, p.g("#3A3E52")); for (let k = 0; k < 2; k++) rect(c, -1.1, 0.45 + k * 0.12, 2.2, 0.1, p.g("#B07A48")); for (let k = 0; k < 2; k++) rect(c, -1.1, 0.75 + k * 0.16, 2.2, 0.1, p.g("#B07A48")); },
  lifeguard: (p) => {
    const c = p.c, w = p.g("#E8E0D0");
    line(c, w, 0.2, [-1.8, 0, -1.2, 3.6]); line(c, w, 0.2, [1.8, 0, 1.2, 3.6]); line(c, w, 0.08, [-1.6, 1.0, 1.4, 3.0]); line(c, w, 0.08, [1.6, 1.0, -1.4, 3.0]);
    rect(c, -1.8, 3.6, 3.6, 2.0, p.g("#E8402A")); rect(c, -1.8, 4.2, 3.6, 0.4, "#F8F8F8"); win(p, -1.0, 4.7, 2.0, 0.7);
    poly(c, p.g("#F8F8F8"), [-2.2, 5.6, 0, 6.5, 2.2, 5.6]); line(c, p.g("#8A6A44"), 0.06, [1.8, 5.8, 1.8, 6.9]);
    line(c, p.g("#B07A48"), 0.12, [-1.8, 0, 0.6, 3.6]); for (let k = 1; k < 6; k++) line(c, p.g("#B07A48"), 0.06, [-1.8 + k * 0.4, k * 0.6, -1.3 + k * 0.4, k * 0.6]);
  },
  ferris: (p) => { const c = p.c, w = p.g("#F4F0E8"); line(c, w, 0.3, [-3.6, 0, 0, 8.2, 3.6, 0]); line(c, w, 0.15, [-2.4, 2.8, 2.4, 2.8]); rect(c, -1.6, 0, 3.2, 1.2, p.g("#E8402A")); win(p, -1.0, 0.3, 0.6, 0.6); win(p, 0.4, 0.3, 0.6, 0.6); },
  // ---- gold mine
  minecart: (p) => { const c = p.c; rect(c, -1.3, -0.05, 2.6, 0.1, p.g("#6A6E7A")); poly(c, p.g("#7A5236"), [-1.1, 0.4, -1.25, 1.3, 1.25, 1.3, 1.1, 0.4]); for (const x of [-0.6, 0.6]) line(c, p.g("#3A2A1A"), 0.06, [x, 0.45, x, 1.25]); for (let k = 0; k < 6; k++) ell(c, -0.8 + k * 0.32, 1.35, 0.22, 0.18, p.g(k % 2 ? "#FFC93D" : "#8A7A6A")); ell(c, -0.7, 0.3, 0.25, 0.25, p.g("#2A2D3A")); ell(c, 0.7, 0.3, 0.25, 0.25, p.g("#2A2D3A")); },
  lantern: (p) => { const c = p.c; rect(c, -0.08, 0, 0.16, 3.2, p.g("#6A4430")); rect(c, -0.08, 3.1, 0.9, 0.12, p.g("#6A4430")); line(c, p.g("#2A2D3A"), 0.03, [0.7, 3.1, 0.7, 2.9]); rect(c, 0.5, 2.4, 0.4, 0.5, p.g("#2A2D3A")); rect(c, 0.56, 2.46, 0.28, 0.38, p.n > 0.15 ? "#FFD27A" : p.g("#E8C890")); },
  timber: (p) => { const c = p.c, w = p.g("#7A4E2A"); rect(c, -1.4, 0, 0.3, 2.6, w); rect(c, 1.1, 0, 0.3, 2.6, w); rect(c, -1.5, 2.4, 3.0, 0.32, shade(w, 0.1)); line(c, shade(w, -0.15), 0.15, [-1.2, 0.4, 1.2, 2.3]); },
  headframe: (p) => {
    const c = p.c, w = p.g("#7A4E2A");
    line(c, w, 0.35, [-3.4, 0, 0, 11.4, 3.4, 0]); line(c, w, 0.25, [0, 11.4, 4.2, 0]);
    for (let k = 1; k < 5; k++) { const y = k * 2.2, hw = 3.4 * (1 - y / 11.4); line(c, w, 0.15, [-hw, y, hw, y]); line(c, w, 0.08, [-hw, y, hw * 0.8, y + 2.2]); }
    wheel(c, 0, 11.4, 1.3, 8, p.g("#3A3E52"), 0.12);
    rect(c, -2.2, 0, 4.4, 2.0, p.g("#8A5A3A")); roof(p, -2.2, 2.2, 2.0, 0.9, p.g("#5A3A2A")); win(p, -1.4, 0.6, 0.8, 0.7);
  },
  // ---- thunder peaks
  pine: (p) => { trunk(p, 0, 1.4, 0.18, p.g("#5A3A2A")); tiers(p, 0, 0.9, 5.3, 1.55, p.g(mix("#2E5A4A", "#1E3A3A", p.r())), 4, false); },
  rock: (p) => { const c = p.c, w = range(p.r, 0.8, 1.1); poly(c, p.g("#7A808E"), [-w, 0, -w * 0.8, 0.6, -0.2, 1.05, 0.5, 0.9, w, 0.4, w * 0.9, 0]); poly(c, p.g("#5E6272"), [0.5, 0.9, w, 0.4, w * 0.9, 0, 0.1, 0]); poly(c, sun(p, 0.2), [-w * 0.8, 0.6, -0.2, 1.05, 0.1, 0.8, -0.5, 0.45]); },
  deadtree: (p) => { const c = p.c, col = p.g("#4A3A34"); line(c, col, 0.32, [0, 0, 0.1, 3.4]); line(c, col, 0.16, [0.05, 1.8, -1.2, 3.2, -1.5, 4.2]); line(c, col, 0.14, [0.1, 2.6, 1.2, 3.8]); line(c, col, 0.1, [-1.2, 3.2, -0.6, 4.4]); line(c, col, 0.08, [1.2, 3.8, 1.6, 4.6]); },
  rod: (p) => { const c = p.c; poly(c, p.g("#6A6E7A"), [-0.5, 0, -0.2, 0.6, 0.2, 0.6, 0.5, 0]); line(c, p.g("#B8BCC8"), 0.08, [0, 0.6, 0, 5.0]); for (let k = 0; k < 3; k++) line(c, p.g("#B8BCC8"), 0.05, [-0.25, 1.4 + k * 1.2, 0.25, 1.4 + k * 1.2]); ell(c, 0, 5.0, 0.1, 0.1, p.g("#E8F0FF")); },
  weather: (p) => {
    const c = p.c, st = p.g("#7A8090");
    poly(c, st, [-2.2, 0, -1.6, 8.4, 1.6, 8.4, 2.2, 0]); poly(c, sun(p, 0.15), [0, 0, 0, 8.4, 1.6 * p.lr, 8.4, 2.2 * p.lr, 0]);
    rect(c, -2.0, 8.4, 4.0, 0.9, shade(st, -0.12)); for (let k = 0; k < 5; k++) rect(c, -2.0 + k * 0.9, 9.3, 0.5, 0.5, shade(st, -0.12));
    win(p, -0.4, 6.2, 0.8, 1.0); win(p, -0.4, 3.6, 0.8, 1.0); rect(c, -0.5, 0, 1.0, 1.6, p.g("#3A2A20"));
    line(c, p.g("#B8BCC8"), 0.08, [0, 9.8, 0, 11.8]);
  },
  // ---- candy canyon
  lollipop: (p) => { const c = p.c, col = p.g(["#FF5A9A", "#5ACBFF", "#FFB23A", "#7CE07A", "#B07CFF"][Math.floor(p.r() * 5)]); rect(c, -0.07, 0, 0.14, 3.0, "#F6F6F6"); ell(c, 0, 3.1, 1.0, 1.0, col); swirl(c, 0, 3.1, 1.0, rgba("#FFFFFF", 0.85), 0.16); ell(c, -0.4 * p.lr, 3.5, 0.22, 0.14, "rgba(255,255,255,0.45)"); },
  cane: (p) => { const c = p.c; c.lineCap = "round"; c.lineWidth = 0.34; c.strokeStyle = "#F8F8F8"; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 2.8); c.arc(0.45, 2.8, 0.45, Math.PI, 0, true); c.stroke(); c.strokeStyle = p.g("#E8304A"); c.setLineDash([0.22, 0.26]); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 2.8); c.arc(0.45, 2.8, 0.45, Math.PI, 0, true); c.stroke(); c.setLineDash([]); },
  gumdrop: (p) => { const c = p.c, col = p.g(["#FF5A7A", "#5ACBFF", "#FFD23F", "#7CE07A", "#B07CFF"][Math.floor(p.r() * 5)]); c.fillStyle = col; c.beginPath(); c.moveTo(-0.8, 0); c.quadraticCurveTo(-0.85, 1.45, 0, 1.45); c.quadraticCurveTo(0.85, 1.45, 0.8, 0); c.closePath(); c.fill(); for (let k = 0; k < 9; k++) rect(c, range(p.r, -0.6, 0.55), range(p.r, 0.15, 1.2), 0.06, 0.06, "rgba(255,255,255,0.7)"); ell(c, -0.3, 1.0, 0.15, 0.25, "rgba(255,255,255,0.35)"); },
  cupcake: (p) => { const c = p.c; poly(c, p.g("#C88A5A"), [-1.0, 1.0, -0.75, 0, 0.75, 0, 1.0, 1.0]); for (let k = -3; k <= 3; k++) line(c, p.g("#A86A3A"), 0.04, [k * 0.28, 1.0, k * 0.21, 0.02]); const fr = p.g(["#F8A8D0", "#B8E8FF", "#FFF0B0"][Math.floor(p.r() * 3)]); ell(c, -0.5, 1.1, 0.55, 0.42, fr); ell(c, 0.5, 1.1, 0.55, 0.42, fr); ell(c, 0, 1.6, 0.62, 0.5, fr); ell(c, 0, 2.1, 0.32, 0.28, fr); ell(c, 0, 2.45, 0.18, 0.18, p.g("#E8304A")); for (let k = 0; k < 8; k++) rect(c, range(p.r, -0.8, 0.7), range(p.r, 0.9, 2.0), 0.1, 0.04, PAINTS[k % 5]); },
  candyhouse: (p) => {
    const c = p.c;
    rect(c, -3.6, 0, 7.2, 4.8, p.g("#C8844A")); for (let k = 0; k < 4; k++) rect(c, -3.6, 0.9 + k * 1.1, 7.2, 0.12, p.g("#F8F0F4"));
    poly(c, p.g("#FF8AC0"), [-4.4, 4.6, 0, 8.4, 4.4, 4.6]); for (let k = 0; k < 9; k++) ell(c, -4.0 + k, 4.6, 0.5, 0.35, p.g("#FFF4FA"));
    for (let k = 0; k < 7; k++) ell(c, range(p.r, -2.6, 2.6), range(p.r, 5.2, 7.2), 0.2, 0.2, p.g(PAINTS[k % 5]));
    win(p, -2.6, 2.4, 1.4, 1.2); win(p, 1.2, 2.4, 1.4, 1.2); rect(c, -0.7, 0, 1.4, 2.4, p.g("#7A3A2A")); ell(c, 0, 2.4, 0.7, 0.5, p.g("#7A3A2A"));
    c.lineWidth = 0.3; c.strokeStyle = "#F8F8F8"; c.beginPath(); c.moveTo(-4.2, 0); c.lineTo(-4.2, 3.2); c.stroke(); c.strokeStyle = p.g("#E8304A"); c.setLineDash([0.25, 0.3]); c.stroke(); c.setLineDash([]);
  },
  // ---- red planet
  redrock: (p) => { const c = p.c, w = range(p.r, 1.0, 1.4); poly(c, p.g("#A0503E"), [-w, 0, -w * 0.7, 1.4, -0.1, 2.0, 0.7, 1.5, w, 0]); poly(c, p.g("#7A3A2E"), [0.1, 0, -0.1, 2.0, 0.7, 1.5, w, 0]); poly(c, sun(p, 0.22), [-w * 0.7, 1.4, -0.1, 2.0, -0.3, 1.0]); },
  crystal: (p) => { const c = p.c, col = p.r() < 0.5 ? "#7CE7FF" : "#C89AFF"; for (let k = 0; k < 4; k++) { const x = -0.55 + k * 0.35, h = range(p.r, 0.8, 1.8), a = (k - 1.5) * 0.25; poly(c, k % 2 ? col : shade(col, -0.25), [x - 0.18, 0, x + Math.sin(a) * h - 0.05, h, x + Math.sin(a) * h + 0.08, h - 0.1, x + 0.18, 0]); } },
  antenna: (p) => { const c = p.c; line(c, p.g("#8A90A0"), 0.1, [0, 0, 0, 4.4]); line(c, p.g("#8A90A0"), 0.04, [-0.7, 0, 0, 4.4, 0.7, 0]); for (let k = 1; k < 4; k++) line(c, p.g("#8A90A0"), 0.06, [-0.3, k * 1.1, 0.3, k * 1.1]); },
  dish: (p) => { const c = p.c; rect(c, -0.12, 0, 0.24, 1.6, p.g("#8A90A0")); c.save(); c.translate(0, 2.0); c.rotate(0.6); c.fillStyle = p.g("#E8EAF0"); c.beginPath(); c.ellipse(0, 0, 1.3, 0.5, 0, 0, Math.PI); c.fill(); line(c, p.g("#8A90A0"), 0.05, [0, 0, 0, 0.9]); c.restore(); },
  dome: (p) => {
    const c = p.c; rect(c, -4.8, 0, 9.6, 0.5, p.g("#C8C8D0"));
    c.fillStyle = rgba("#9AF0FF", 0.35 + 0.25 * p.n); c.beginPath(); c.arc(0, 0.5, 4.4, Math.PI, 0, true); c.fill();
    c.fillStyle = p.g("#3A8A4A"); c.beginPath(); c.arc(-1.2, 0.5, 1.2, Math.PI, 0, true); c.arc(1.6, 0.5, 0.9, Math.PI, 0, true); c.fill();
    c.strokeStyle = p.g("#E8E8F0"); c.lineWidth = 0.14; c.beginPath(); c.arc(0, 0.5, 4.4, Math.PI, 0, true); c.stroke();
    c.lineWidth = 0.06; c.beginPath(); c.arc(0, 0.5, 2.8, Math.PI, 0, true); c.moveTo(0, 4.9); c.lineTo(0, 0.5); c.moveTo(-3.1, 3.6); c.lineTo(0, 0.5); c.lineTo(3.1, 3.6); c.stroke();
    ell(c, -1.6 * p.lr, 3.2, 0.9, 0.4, "rgba(255,255,255,0.35)");
  },
  rocket: (p) => {
    const c = p.c, w = p.g("#F4F4F8"), red = p.g("#D8402A"), st = p.g("#7A8090");
    rect(c, -2.6, 0, 5.2, 0.5, st);
    line(c, st, 0.18, [-2.4, 0.5, -2.4, 13.4]); line(c, st, 0.18, [-1.6, 0.5, -1.6, 13.4]); for (let k = 0; k < 12; k++) line(c, st, 0.06, [-2.4, 0.5 + k * 1.08, -1.6, 1.58 + k * 1.08]);
    line(c, st, 0.1, [-1.6, 9, -0.5, 9]);
    poly(c, w, [-0.6, 1.2, -0.6, 10.2, 0, 12.4, 0.6, 10.2, 0.6, 1.2]); poly(c, sun(p, 0.2), [0, 1.2, 0, 12.4, 0.6 * p.lr, 10.2, 0.6 * p.lr, 1.2]);
    rect(c, -0.6, 8.6, 1.2, 0.4, red); poly(c, red, [-0.6, 3.0, -1.3, 0.6, -0.6, 1.2]); poly(c, red, [0.6, 3.0, 1.3, 0.6, 0.6, 1.2]); poly(c, red, [-0.45, 11.3, 0, 12.4, 0.45, 11.3]);
    ell(c, 0, 7.0, 0.26, 0.26, p.g("#2A3A5A")); poly(c, p.g("#3A3E52"), [-0.45, 1.2, -0.6, 0.6, 0.6, 0.6, 0.45, 1.2]);
  },
  // ---- sky isles
  bush: (p) => { crown(p, 0, 0.6, 0.75, p.g(mix("#4EA84A", "#2E7A3A", p.r()))); },
  tree: (p) => { trunk(p, 0, 2.2, 0.26, p.g("#6E4A30")); crown(p, 0, 3.5, 1.55, p.g(mix("#5EBE5A", "#3E9A48", p.r()))); if (p.r() < 0.4) for (let k = 0; k < 8; k++) ell(p.c, range(p.r, -1.3, 1.3), 3.5 + range(p.r, -1.0, 1.0), 0.14, 0.14, p.g("#FF8AB0")); },
  windvane: (p) => { const c = p.c; line(c, p.g("#5A5E6E"), 0.1, [0, 0, 0, 3.4]); ell(c, 0, 3.4, 0.12, 0.12, p.g("#FFD23F")); },
  keep: (p) => {
    const c = p.c, st = p.g("#D8D0C0");
    rect(c, -3.4, 0, 6.8, 7.6, st); for (let k = 0; k < 5; k++) rect(c, -3.4 + k * 1.5, 7.6, 0.9, 0.8, st);
    for (let y = 0.8; y < 7.4; y += 0.8) for (let x = -3.2 + ((y * 1.25) % 1.2); x < 3.2; x += 1.2) rect(c, x, y, 0.06, 0.4, rgba("#6A6050", 0.3));
    rect(c, -1.2, 7.6, 2.4, 2.4, shade(st, -0.06)); poly(c, p.g("#3A5AB0"), [-1.5, 10.0, 0, 11.8, 1.5, 10.0]);
    win(p, -2.2, 4.4, 0.8, 1.2); win(p, 1.4, 4.4, 0.8, 1.2); win(p, -0.4, 8.4, 0.8, 1.0); rect(c, -0.8, 0, 1.6, 2.2, p.g("#4A3426")); ell(c, 0, 2.2, 0.8, 0.5, p.g("#4A3426"));
    rect(c, p.lr > 0 ? 2.2 : -3.4, 0, 1.2, 7.6, sun(p, 0.14)); line(c, p.g("#5A5E6E"), 0.05, [0, 11.8, 0, 12.0]);
  },
  windmill: (p) => { const c = p.c; poly(c, p.g("#F2E8D8"), [-2.2, 0, -1.4, 7.0, 1.4, 7.0, 2.2, 0]); poly(c, sun(p, 0.18), [0, 0, 0, 7, 1.4 * p.lr, 7, 2.2 * p.lr, 0]); poly(c, p.g("#C8503A"), [-1.8, 7.0, 0, 8.6, 1.8, 7.0]); win(p, -0.4, 4.2, 0.8, 1.0); rect(c, -0.5, 0, 1.0, 1.8, p.g("#6A4430")); },
};

/** sprites per (kind, variant): built lazily on first use within a race */
export class PropSprites {
  private cache = new Map<string, Sprite>();
  private g: (col: string) => string;
  constructor(private look: Look, private px: number) {
    const l = look, amt = l.tintAmt, dark = l.night * 0.42;
    this.g = (col: string) => { const x = mix(col, l.tint, amt * 0.5); return dark > 0 ? shade(x, -dark) : x; };
  }
  get(kind: PropKind, seed: number): Sprite {
    const variant = seed % 3;
    const key = `${kind}${variant}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const [w, h, ax, ay] = BOX[kind];
    const big = BIG_PROPS.has(kind);
    const pxm = this.px * (big ? 0.8 : 1);
    const cv = document.createElement("canvas");
    cv.width = Math.max(2, Math.ceil(w * pxm)); cv.height = Math.max(2, Math.ceil(h * pxm));
    const c = cv.getContext("2d")!;
    c.setTransform(pxm, 0, 0, -pxm, ax * pxm, (h - ay) * pxm);
    PAINT[kind]({ c, r: makeRng(variant * 7919 + kind.length * 131 + 3), g: this.g, n: this.look.night, light: this.look.light, lr: this.look.sunX > 0.5 ? 1 : -1 });
    const s: Sprite = { cv, w, h, ax, ay };
    this.cache.set(key, s);
    return s;
  }
}

const glows = new Map<string, HTMLCanvasElement>();
function glow(col: string) {
  let cv = glows.get(col);
  if (cv) return cv;
  cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.25, rgba(col, 0.5)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glows.set(col, cv);
  return cv;
}
export function halo(c: C, col: string, x: number, y: number, R: number, a: number) {
  c.globalAlpha = Math.max(0, Math.min(1, a));
  c.drawImage(glow(col), x - R, y - R, R * 2, R * 2);
  c.globalAlpha = 1;
}
const NEON = ["#FF4FD8", "#5BF0FF", "#FFD23F", "#7CFF8A"];

/** live bits drawn over a prop (prop-local metres, y up) */
export function propMotion(c: C, kind: PropKind, t: number, seed: number, night: number) {
  switch (kind) {
    case "windmill": {
      c.save(); c.translate(0, 7.2); c.rotate(-t * 0.8 - seed);
      for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillStyle = "#F4EEE2"; c.fillRect(0.2, -0.32, 3.6, 0.64); c.strokeStyle = "#8A6A4A"; c.lineWidth = 0.08; c.strokeRect(0.2, -0.32, 3.6, 0.64); }
      c.fillStyle = "#6A4430"; c.beginPath(); c.arc(0, 0, 0.32, 0, Math.PI * 2); c.fill();
      c.restore(); return;
    }
    case "ferris": {
      // the wheel turns slowly, gondolas hanging level
      const R = 6.0, cy = 8.2, a0 = t * 0.18 + seed;
      c.strokeStyle = night > 0.3 ? "#FFE8F4" : "#F4F0E8"; c.lineWidth = 0.18; c.beginPath(); c.arc(0, cy, R, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 0.07; c.beginPath(); c.arc(0, cy, R * 0.8, 0, Math.PI * 2);
      for (let k = 0; k < 12; k++) { const a = a0 + (k * Math.PI) / 6; c.moveTo(0, cy); c.lineTo(Math.cos(a) * R, cy + Math.sin(a) * R); }
      c.stroke();
      for (let k = 0; k < 12; k++) {
        const a = a0 + (k * Math.PI) / 6, gx = Math.cos(a) * R, gy = cy + Math.sin(a) * R;
        c.fillStyle = PAINTS[k % 5]; c.beginPath(); c.ellipse(gx, gy - 0.5, 0.42, 0.45, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(gx - 0.3, gy - 0.55, 0.6, 0.18);
        if (night > 0.3) { c.fillStyle = k % 2 ? "#FFE08A" : "#FF8AD0"; c.beginPath(); c.arc(gx, gy, 0.12, 0, Math.PI * 2); c.fill(); }
      }
      c.fillStyle = "#C8C0B0"; c.beginPath(); c.arc(0, cy, 0.4, 0, Math.PI * 2); c.fill();
      if (night > 0.3) halo(c, "#FF8AD0", 0, cy, R * 1.3, 0.18 * night);
      return;
    }
    case "lighthouse": {
      halo(c, "#FFF6C0", 0, 9.9, 2.2, 0.5 + 0.4 * night);
      if (night > 0.2) {
        const a = Math.sin(t * 0.9 + seed), len = 26;
        c.fillStyle = `rgba(255,246,192,${(0.18 * night).toFixed(3)})`;
        c.beginPath(); c.moveTo(0, 9.9); c.lineTo(a * len, 9.9 + 2.6); c.lineTo(a * len, 9.9 - 2.6); c.closePath(); c.fill();
      }
      return;
    }
    case "neon": {
      const col = NEON[seed % 4], on = Math.sin(t * 13 + seed) > -0.92 || Math.sin(t * 3.1 + seed) > 0;
      c.strokeStyle = on ? col : "#3A2A4A"; c.lineWidth = 0.14; c.lineJoin = "round";
      c.beginPath();
      // a zig-zag bolt and a ring: an abstract sign
      c.moveTo(-1.2, 2.8); c.lineTo(-0.5, 3.9); c.lineTo(-0.3, 3.2); c.lineTo(0.3, 4.1); c.moveTo(1.0, 3.4); c.arc(0.9, 3.4, 0.45, 0, Math.PI * 2);
      c.stroke();
      if (on) halo(c, col, 0, 3.4, 2.8, 0.25 + 0.35 * night);
      return;
    }
    case "lamp": case "lantern": case "keep": case "candyhouse": case "station": case "lifeguard": case "weather": {
      if (night < 0.2) return;
      const y = kind === "lamp" ? 4.3 : kind === "lantern" ? 2.65 : kind === "keep" ? 5 : kind === "station" ? 2.4 : kind === "lifeguard" ? 5 : kind === "weather" ? 6.6 : 3;
      const x = kind === "lamp" ? 1.0 : kind === "lantern" ? 0.7 : 0;
      halo(c, "#FFC861", x, y, kind === "lamp" ? 2.4 : 1.6, 0.75 * night * (0.85 + 0.15 * Math.sin(t * 5 + seed)));
      return;
    }
    case "flagpole": {
      const col = NEON[seed % 4] === "#7CFF8A" ? "#3E8AE8" : NEON[seed % 4];
      c.fillStyle = col; c.beginPath(); c.moveTo(0.06, 4.7);
      for (let s = 0; s <= 8; s++) { const u = s / 8; c.lineTo(0.06 + u * 1.8, 4.7 - u * 0.1 + Math.sin(u * 5 - t * 7 + seed) * 0.14 * u); }
      for (let s = 8; s >= 0; s--) { const u = s / 8; c.lineTo(0.06 + u * 1.8, 3.7 + u * 0.1 + Math.sin(u * 5 - t * 7 + seed) * 0.14 * u); }
      c.closePath(); c.fill();
      return;
    }
    case "crusher": {
      const u = (Math.sin(t * 1.4 + seed) + 1) / 2, y = 3.0 + u * 3.6;
      c.fillStyle = "#3A3E52"; c.fillRect(-0.4, y + 1.4, 0.8, 7.8 - y - 1.4);
      c.fillStyle = "#6A7086"; c.fillRect(-3.3, y, 6.6, 1.4);
      c.fillStyle = "#FFD23F"; for (let k = 0; k < 6; k++) c.fillRect(-3.2 + k * 1.1, y, 0.5, 0.25);
      return;
    }
    case "magnet": {
      const sw = Math.sin(t * 0.7 + seed) * 0.08;
      c.save(); c.translate(8.6, 10.6); c.rotate(sw);
      c.strokeStyle = "#2A2D3A"; c.lineWidth = 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -4.2); c.stroke();
      c.fillStyle = "#3A3E52"; c.beginPath(); c.ellipse(0, -4.4, 1.2, 0.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2A72D8"; c.fillRect(-1.4, -5.6, 2.8, 0.8); c.fillRect(-0.8, -5.0, 1.6, 0.5);
      c.fillStyle = "#1E1E24"; c.beginPath(); c.arc(-0.9, -5.6, 0.32, 0, Math.PI * 2); c.arc(0.9, -5.6, 0.32, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }
    case "windvane": {
      c.save(); c.translate(0, 3.4); c.scale(Math.cos(t * 2.2 + seed), 1);
      c.fillStyle = "#FFD23F"; c.beginPath(); c.moveTo(-0.9, 0); c.lineTo(0.7, 0.1); c.lineTo(0.9, 0); c.lineTo(0.7, -0.1); c.closePath(); c.fill();
      c.fillStyle = "#E8402A"; c.fillRect(-1.0, -0.3, 0.3, 0.6);
      c.restore();
      return;
    }
    case "rocket": {
      for (let k = 0; k < 4; k++) { const u = (t * 0.4 + k / 4 + seed * 0.1) % 1; c.fillStyle = `rgba(240,240,248,${(0.4 * (1 - u)).toFixed(3)})`; c.beginPath(); c.arc((k % 2 ? 1 : -1) * u * 2.2, 0.8 + u * 1.2, 0.4 + u * 0.9, 0, Math.PI * 2); c.fill(); }
      if (Math.sin(t * 3 + seed) > 0.3) halo(c, "#FF4A4A", -2.0, 13.6, 0.7, 0.8);
      return;
    }
    case "crystal": case "dome": {
      halo(c, kind === "crystal" ? "#9AF0FF" : "#9AF0FF", 0, kind === "crystal" ? 0.8 : 2.4, kind === "crystal" ? 1.2 : 5, (0.3 + 0.2 * Math.sin(t * 2 + seed)) * (kind === "dome" ? 0.5 + night * 0.5 : 1));
      return;
    }
    case "antenna": case "mast": case "crane": {
      if (Math.sin(t * 3 + seed) > 0.3) { const y = kind === "antenna" ? 4.5 : kind === "mast" ? 6.1 : 12.9, x = 0; c.fillStyle = "#FF5A6A"; c.beginPath(); c.arc(x, y, 0.14, 0, Math.PI * 2); c.fill(); halo(c, "#FF5A6A", x, y, 0.7, 0.6); }
      return;
    }
    case "rod": {
      if (Math.sin(t * 9 + seed * 3) > 0.96) { c.strokeStyle = "#E8F4FF"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0, 5); c.lineTo(0.3, 5.4); c.lineTo(-0.1, 5.7); c.lineTo(0.2, 6.2); c.stroke(); halo(c, "#BFE0FF", 0, 5.2, 1.2, 0.8); }
      return;
    }
    case "idol": {
      if (night > 0.2) { halo(c, "#7CFF8A", -0.33, 2.05, 0.5, 0.6 * night); halo(c, "#7CFF8A", 0.33, 2.05, 0.5, 0.6 * night); }
      return;
    }
  }
}
