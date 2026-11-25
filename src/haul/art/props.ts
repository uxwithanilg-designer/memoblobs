// Roadside props, painted once per stage into sprites (a few variants of each kind, graded for the time of day) and
// stamped along the road: trees, bushes, flowers, fences, hay, rocks, mushrooms, cacti, lamps, hives, barns, cabins,
// windmills, pagodas, domes… Moving bits — windmill sails, swaying sunflowers, lamp glows at night, steam from vents,
// blinking antenna lights, pulsing glow mushrooms — are drawn live on top by `propMotion`.
import type { PropKind } from "../worlds";
import type { Look } from "./grade";
import { makeRng, mix, range, rgba, shade, type Rng } from "../util";

type C = CanvasRenderingContext2D;
export interface Sprite { cv: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

/** sprite bounds in metres: [width, height, anchor x, below-ground depth] */
const BOX: Record<PropKind, [number, number, number, number]> = {
  pine: [3.4, 6.4, 1.7, 0.2], fir: [3.6, 5.2, 1.8, 0.2], fern: [2.2, 1.3, 1.1, 0.1], stump: [1.6, 1.0, 0.8, 0.2], toadstool: [1.2, 1.0, 0.6, 0.1], rock: [2.4, 1.4, 1.2, 0.3],
  cabin: [7, 6, 3.5, 0.3], tower: [5, 9, 2.5, 0.3],
  appletree: [4.4, 5.2, 2.2, 0.2], bush: [2.6, 1.5, 1.3, 0.1], fence: [2.4, 1.3, 1.2, 0.2], hay: [1.8, 1.4, 0.9, 0.1], basket: [1.2, 0.9, 0.6, 0.1], farmhouse: [9, 7, 4.5, 0.3], windmill: [6, 11, 3, 0.3],
  cypress: [3.4, 7, 1.7, 0.3], reeds: [1.6, 2.2, 0.8, 0.1], shack: [7, 6.5, 3.5, 0.5], post: [0.8, 2.0, 0.4, 0.3],
  sunflower: [1.4, 3.2, 0.7, 0.1], lavender: [1.8, 1.2, 0.9, 0.1], hive: [1.4, 1.8, 0.7, 0.1], daisy: [1.4, 0.7, 0.7, 0.1], honeymill: [8, 8, 4, 0.3],
  coop: [3, 2.6, 1.5, 0.2], barn: [10, 8, 5, 0.3], silo: [3.4, 10, 1.7, 0.3], pumpkin: [1.6, 0.9, 0.8, 0.1], scarecrow: [2, 3, 1, 0.3],
  cactus: [1.2, 1.2, 0.6, 0.1], saguaro: [2.6, 4.6, 1.3, 0.2], tumbleweed: [1.2, 1.1, 0.6, 0.05], hoodoo: [2, 5, 1, 0.3], arch: [10, 7, 5, 0.3], watertower: [4.4, 9, 2.2, 0.3],
  glowshroom: [1.6, 1.4, 0.8, 0.1], bigshroom: [4.2, 5.4, 2.1, 0.2], shroomhouse: [6.4, 7.4, 3.2, 0.3],
  logpile: [3.4, 1.8, 1.7, 0.1], sawmill: [10, 7, 5, 0.3],
  snowpine: [3.4, 6, 1.7, 0.2], snowman: [1.6, 2.2, 0.8, 0.1], lamp: [1.2, 4, 0.6, 0.2], cottage: [7, 6.4, 3.5, 0.3], belltower: [4, 10, 2, 0.3],
  cherry: [5, 5.4, 2.5, 0.2], bamboo: [1.8, 6, 0.9, 0.1], stonelamp: [1.2, 1.9, 0.6, 0.1], pagoda: [6, 10, 3, 0.3],
  deadtree: [3.4, 5, 1.7, 0.2], lavarock: [2.4, 1.4, 1.2, 0.3], vent: [1.8, 0.9, 0.9, 0.2], forge: [7, 9, 3.5, 0.3],
  moonrock: [2.4, 1.4, 1.2, 0.3], antenna: [1.6, 5, 0.8, 0.2], dish: [3, 3.4, 1.5, 0.2], dome: [9, 5.6, 4.5, 0.3], crystal: [1.6, 1.8, 0.8, 0.1],
};
export const BIG_PROPS = new Set<PropKind>(["cabin", "tower", "farmhouse", "windmill", "shack", "honeymill", "barn", "silo", "arch", "watertower", "shroomhouse", "sawmill", "cottage", "belltower", "pagoda", "forge", "dome"]);

interface P { c: C; r: Rng; g: (col: string) => string; n: number; light: string; lr: number }

function ell(c: C, x: number, y: number, rx: number, ry: number, col: string) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function poly(c: C, col: string, pts: number[]) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
function rect(c: C, x: number, y: number, w: number, h: number, col: string) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function win(p: P, x: number, y: number, w: number, h: number) {
  const lit = p.n > 0.25;
  rect(p.c, x, y, w, h, lit ? "#FFD27A" : p.g("#9EC6E8"));
  if (!lit) rect(p.c, x + w * 0.1, y + h * 0.55, w * 0.3, h * 0.3, "rgba(255,255,255,0.5)");
  rect(p.c, x + w * 0.46, y, w * 0.08, h, p.g("#3A3048"));
}
/** a soft round crown from a few puffs, lit from the sun's side */
function crown(p: P, x: number, y: number, R: number, col: string) {
  const { c, r } = p;
  const puffs: [number, number, number][] = [[0, 0, 1], [-0.6, -0.15, 0.72], [0.62, -0.12, 0.7], [-0.25, 0.48, 0.66], [0.32, 0.42, 0.64]];
  for (const [ox, oy, s] of puffs) ell(c, x + ox * R, y + oy * R, R * s + range(r, -0.03, 0.03), R * s * 0.92, shade(col, -0.12));
  for (const [ox, oy, s] of puffs) ell(c, x + ox * R + p.lr * R * 0.06, y + oy * R + R * 0.06, R * s * 0.85, R * s * 0.78, col);
  ell(c, x + p.lr * R * 0.3, y + R * 0.35, R * 0.45, R * 0.35, rgba(p.light, 0.22 * (1 - p.n * 0.7)));
}
function trunk(p: P, x: number, h: number, w: number, col: string) {
  poly(p.c, col, [x - w, 0, x - w * 0.6, h, x + w * 0.6, h, x + w, 0]);
  poly(p.c, rgba(p.light, 0.15 * (1 - p.n * 0.7)), [x + p.lr * w * 0.2, 0, x + p.lr * w * 0.2, h, x + p.lr * w * 0.6, h, x + p.lr * w, 0]);
}
function tiers(p: P, x: number, base: number, h: number, w: number, col: string, n: number, snow: boolean) {
  for (let k = 0; k < n; k++) {
    const y0 = base + (h * k) / n * 0.85, tw = w * (1 - k / (n + 0.6)), th = h * 0.36;
    p.c.fillStyle = shade(col, -0.1 + k * 0.03);
    p.c.beginPath(); p.c.moveTo(x - tw, y0); p.c.quadraticCurveTo(x - tw * 0.4, y0 + th * 0.3, x, y0 + th); p.c.quadraticCurveTo(x + tw * 0.4, y0 + th * 0.3, x + tw, y0); p.c.quadraticCurveTo(x, y0 + th * 0.12, x - tw, y0); p.c.fill();
    poly(p.c, rgba(p.light, 0.16 * (1 - p.n * 0.7)), [x, y0 + th, x + p.lr * tw, y0, x + p.lr * tw * 0.3, y0 + th * 0.1]);
    if (snow) { p.c.fillStyle = "#F6FAFF"; p.c.beginPath(); p.c.moveTo(x - tw * 0.6, y0 + th * 0.45); p.c.quadraticCurveTo(x - tw * 0.2, y0 + th * 0.7, x, y0 + th); p.c.quadraticCurveTo(x + tw * 0.2, y0 + th * 0.7, x + tw * 0.6, y0 + th * 0.45); p.c.quadraticCurveTo(x, y0 + th * 0.55, x - tw * 0.6, y0 + th * 0.45); p.c.fill(); }
  }
}
function roof(p: P, x0: number, x1: number, y: number, h: number, col: string, snow = false) {
  const m = (x0 + x1) / 2;
  poly(p.c, col, [x0 - 0.4, y, m, y + h, x1 + 0.4, y]);
  poly(p.c, shade(col, -0.2), [m, y + h, x1 + 0.4, y, x1 + 0.1, y - 0.15, m, y + h - 0.25]);
  if (snow) poly(p.c, "#F6FAFF", [x0 - 0.45, y + 0.02, m, y + h + 0.12, x1 + 0.45, y + 0.02, x1 + 0.1, y + 0.25, m, y + h - 0.2, x0 - 0.1, y + 0.25]);
}

const PAINT: Record<PropKind, (p: P) => void> = {
  pine: (p) => { trunk(p, 0, 1.4, 0.18, p.g("#6A4430")); tiers(p, 0, 0.9, 5.3, 1.55, p.g(mix("#2E7A4A", "#1E5A3A", p.r())), 4, false); },
  snowpine: (p) => { trunk(p, 0, 1.2, 0.18, p.g("#5A3A2A")); tiers(p, 0, 0.8, 5.0, 1.55, p.g("#2A5A4A"), 4, true); },
  fir: (p) => { trunk(p, 0, 1.0, 0.2, p.g("#5E3E2A")); tiers(p, 0, 0.6, 4.4, 1.7, p.g("#3E8A52"), 5, false); },
  fern: (p) => { const { c } = p; c.strokeStyle = p.g("#4FA85A"); c.lineWidth = 0.08; c.lineCap = "round"; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(k * 0.18, 0.8, k * 0.32, range(p.r, 0.7, 1.2)); c.stroke(); for (let s = 0.2; s < 0.9; s += 0.15) { const bx = k * 0.32 * s, by = s * 1.0; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 0.14, by - 0.05); c.moveTo(bx, by); c.lineTo(bx + 0.14, by - 0.05); c.stroke(); } } },
  stump: (p) => { const c = p.c; poly(c, p.g("#6E4A2E"), [-0.6, -0.1, -0.5, 0.75, 0.5, 0.75, 0.6, -0.1]); poly(c, p.g("#5A3A22"), [-0.6, -0.1, -0.85, 0, -0.5, 0.25]); poly(c, p.g("#5A3A22"), [0.6, -0.1, 0.85, 0, 0.5, 0.25]); ell(c, 0, 0.75, 0.5, 0.16, p.g("#E2B27A")); c.strokeStyle = p.g("#B07A48"); c.lineWidth = 0.03; c.beginPath(); c.ellipse(0, 0.75, 0.3, 0.09, 0, 0, Math.PI * 2); c.stroke(); },
  toadstool: (p) => { const c = p.c; poly(c, p.g("#F2E6D8"), [-0.08, 0, -0.06, 0.55, 0.06, 0.55, 0.08, 0]); c.fillStyle = p.g("#E8423A"); c.beginPath(); c.ellipse(0, 0.55, 0.42, 0.32, 0, 0, Math.PI); c.fill(); for (const [x, y] of [[-0.2, 0.68], [0.12, 0.76], [0.25, 0.6], [-0.05, 0.62]]) ell(c, x, y, 0.06, 0.05, "#FFFFFF"); },
  rock: (p) => { const c = p.c, w = range(p.r, 0.8, 1.1); poly(c, p.g("#8A8E9E"), [-w, 0, -w * 0.8, 0.6, -0.2, 1.05, 0.5, 0.9, w, 0.4, w * 0.9, 0]); poly(c, p.g("#6E7286"), [0.5, 0.9, w, 0.4, w * 0.9, 0, 0.1, 0]); poly(c, rgba(p.light, 0.2), [-w * 0.8, 0.6, -0.2, 1.05, 0.1, 0.8, -0.5, 0.45]); },
  cabin: (p) => { const c = p.c; for (let k = 0; k < 7; k++) { rect(c, -3, k * 0.5, 6, 0.5, p.g(k % 2 ? "#8A5A36" : "#9E6A42")); ell(c, -3, k * 0.5 + 0.25, 0.25, 0.25, p.g("#C08A58")); ell(c, 3, k * 0.5 + 0.25, 0.25, 0.25, p.g("#C08A58")); } roof(p, -3, 3, 3.5, 2.2, p.g("#5A3A3A")); rect(c, 1.6, 4.2, 0.6, 1.4, p.g("#6A6470")); win(p, -2.2, 1.4, 1.2, 1.0); rect(c, 0.4, 0, 1.0, 2.0, p.g("#5A3622")); },
  tower: (p) => { const c = p.c; c.strokeStyle = p.g("#6A4430"); c.lineWidth = 0.22; c.beginPath(); c.moveTo(-1.8, 0); c.lineTo(-1.2, 6); c.moveTo(1.8, 0); c.lineTo(1.2, 6); c.moveTo(-1.6, 1); c.lineTo(1.4, 4); c.moveTo(1.6, 1); c.lineTo(-1.4, 4); c.stroke(); rect(c, -1.8, 6, 3.6, 1.6, p.g("#9E6A42")); win(p, -1.2, 6.4, 2.4, 0.8); roof(p, -1.8, 1.8, 7.6, 1.2, p.g("#4A3A3A")); },
  appletree: (p) => { trunk(p, 0, 2.2, 0.26, p.g("#6E4A30")); crown(p, 0, 3.4, 1.5, p.g("#4FAE48")); for (let k = 0; k < 9; k++) ell(p.c, range(p.r, -1.4, 1.4), 3.4 + range(p.r, -1.1, 1.0), 0.13, 0.13, p.g(p.r() < 0.7 ? "#FF4A3A" : "#FFB627")); },
  bush: (p) => { crown(p, 0, 0.6, 0.75, p.g(mix("#4EA84A", "#2E7A3A", p.r()))); },
  fence: (p) => { const c = p.c; for (const x of [-1.1, 0, 1.1]) { rect(c, x - 0.08, -0.1, 0.16, 1.25, p.g("#9A6A40")); poly(c, p.g("#9A6A40"), [x - 0.08, 1.15, x, 1.28, x + 0.08, 1.15]); } rect(c, -1.2, 0.75, 2.4, 0.13, p.g("#B07A48")); rect(c, -1.2, 0.35, 2.4, 0.13, p.g("#B07A48")); },
  hay: (p) => { const c = p.c; ell(c, 0, 0.62, 0.85, 0.62, p.g("#E8BE5A")); c.strokeStyle = p.g("#C0923A"); c.lineWidth = 0.05; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(0.25, 0.62, k * 0.16, k * 0.14, 0, 0, Math.PI * 2); c.stroke(); } rect(c, -0.85, 0.5, 1.7, 0.08, p.g("#B0402A")); },
  basket: (p) => { const c = p.c; for (let k = 0; k < 5; k++) ell(c, -0.32 + k * 0.16, 0.62 + (k % 2) * 0.06, 0.16, 0.16, p.g(k % 2 ? "#FF4A3A" : "#7AC84A")); poly(c, p.g("#C08A48"), [-0.5, 0.62, -0.38, 0, 0.38, 0, 0.5, 0.62]); c.strokeStyle = p.g("#8A5A2A"); c.lineWidth = 0.04; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-0.45 + k * 0.04, 0.15 + k * 0.13); c.lineTo(0.45 - k * 0.04, 0.15 + k * 0.13); c.stroke(); } },
  farmhouse: (p) => { const c = p.c; rect(c, -4, 0, 8, 3.8, p.g("#F2E6D2")); rect(c, -4, 0, 8, 0.4, p.g("#C9B89A")); roof(p, -4, 4, 3.8, 2.6, p.g("#C0503A")); win(p, -3, 1.4, 1.2, 1.2); win(p, 1.8, 1.4, 1.2, 1.2); win(p, -0.4, 4.3, 0.8, 0.8); rect(c, -0.6, 0, 1.2, 2.2, p.g("#6A4430")); rect(c, -2.2, 2.4, 4.4, 0.2, p.g("#FFFFFF")); },
  windmill: (p) => { const c = p.c; poly(c, p.g("#EDE2CE"), [-2, 0, -1.1, 8, 1.1, 8, 2, 0]); poly(c, p.g("#D2C4AA"), [0.6, 0, 0.4, 8, 1.1, 8, 2, 0]); roof(p, -1.3, 1.3, 8, 1.6, p.g("#8E4A3A")); rect(c, -0.45, 0, 0.9, 1.8, p.g("#6A4430")); win(p, -0.35, 4.2, 0.7, 0.8); },
  cypress: (p) => { const c = p.c; poly(c, p.g("#5A4A3A"), [-0.9, 0, -0.25, 1.4, -0.2, 5.4, 0.2, 5.4, 0.25, 1.4, 0.9, 0]); for (let k = 0; k < 4; k++) ell(c, range(p.r, -0.8, 0.8), 5.2 + k * 0.4, range(p.r, 0.8, 1.3), 0.35, p.g(mix("#4A6A42", "#2E4A32", p.r()))); c.strokeStyle = p.g("#9CB07A"); c.lineWidth = 0.05; for (let k = 0; k < 8; k++) { const x = range(p.r, -1, 1); c.beginPath(); c.moveTo(x, 5.2); c.quadraticCurveTo(x + 0.1, 4.5, x - 0.05, range(p.r, 3.6, 4.6)); c.stroke(); } },
  reeds: (p) => { const c = p.c; c.lineCap = "round"; for (let k = 0; k < 6; k++) { const x = (k - 2.5) * 0.18, h = range(p.r, 1.2, 2.0); c.strokeStyle = p.g("#6E8E3A"); c.lineWidth = 0.05; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 0.05, h * 0.6, x + range(p.r, -0.15, 0.15), h); c.stroke(); if (k % 2) ell(c, x + 0.02, h * 0.8, 0.06, 0.2, p.g("#6A4426")); } },
  shack: (p) => { const c = p.c; c.strokeStyle = p.g("#5A4A3A"); c.lineWidth = 0.2; for (const x of [-2.6, -0.8, 0.8, 2.6]) { c.beginPath(); c.moveTo(x, -0.4); c.lineTo(x, 2); c.stroke(); } rect(c, -3, 2, 6, 2.6, p.g("#7A8A6A")); for (let k = 0; k < 6; k++) rect(c, -3 + k, 2, 0.06, 2.6, p.g("#5A6A4A")); poly(c, p.g("#8A5A4A"), [-3.4, 4.6, 3.4, 4.6, 2.6, 5.8, -2.6, 5.8]); win(p, -1.8, 2.8, 1.1, 0.9); rect(c, 0.6, 2, 0.9, 1.7, p.g("#4A3A2A")); rect(c, -3.2, 1.9, 6.4, 0.16, p.g("#9E7A52")); },
  post: (p) => { const c = p.c; rect(c, -0.14, -0.3, 0.28, 2.0, p.g("#6A4E36")); ell(c, 0, 1.7, 0.14, 0.05, p.g("#8E6E4E")); c.strokeStyle = p.g("#D9C49A"); c.lineWidth = 0.05; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-0.15, 1.1 + k * 0.08); c.lineTo(0.15, 1.16 + k * 0.08); c.stroke(); } },
  sunflower: (p) => { const c = p.c; c.strokeStyle = p.g("#4E8E3A"); c.lineWidth = 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.05, 2.6); c.stroke(); ell(c, -0.2, 1.2, 0.25, 0.1, p.g("#5EA84A")); ell(c, 0.22, 1.7, 0.25, 0.1, p.g("#5EA84A")); },
  lavender: (p) => { const c = p.c; c.lineCap = "round"; for (let k = 0; k < 14; k++) { const x = range(p.r, -0.7, 0.7), h = range(p.r, 0.6, 1.1); c.strokeStyle = p.g("#6E8E5A"); c.lineWidth = 0.04; c.beginPath(); c.moveTo(x * 0.3, 0); c.lineTo(x, h); c.stroke(); c.strokeStyle = p.g(p.r() < 0.5 ? "#9B6BD8" : "#B88AE8"); c.lineWidth = 0.1; c.beginPath(); c.moveTo(x, h - 0.25); c.lineTo(x, h); c.stroke(); } },
  hive: (p) => { const c = p.c; rect(c, -0.5, 0, 0.1, 0.4, p.g("#6A4430")); rect(c, 0.4, 0, 0.1, 0.4, p.g("#6A4430")); for (let k = 0; k < 3; k++) { rect(c, -0.6, 0.4 + k * 0.4, 1.2, 0.38, p.g(["#F2C14E", "#F7D27A", "#E8A93A"][k])); rect(c, -0.6, 0.4 + k * 0.4, 1.2, 0.05, "rgba(0,0,0,0.15)"); } rect(c, -0.7, 1.6, 1.4, 0.14, p.g("#D98A2E")); rect(c, -0.15, 0.5, 0.3, 0.06, "#2A1A10"); },
  daisy: (p) => { const c = p.c; for (let k = 0; k < 6; k++) { const x = range(p.r, -0.55, 0.55), h = range(p.r, 0.3, 0.6); c.strokeStyle = p.g("#5EA84A"); c.lineWidth = 0.035; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; ell(c, x + Math.cos(a) * 0.07, h + Math.sin(a) * 0.07, 0.05, 0.05, "#FFFFFF"); } ell(c, x, h, 0.04, 0.04, "#FFC21A"); } },
  honeymill: (p) => { const c = p.c; rect(c, -3.6, 0, 7.2, 4.4, p.g("#F2D9A0")); roof(p, -3.6, 3.6, 4.4, 2.6, p.g("#C9762E")); for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI * 2; poly(c, p.g("#FFB627"), [Math.cos(a) * 0.5, 5.4 + Math.sin(a) * 0.5, Math.cos(a + 1.05) * 0.5, 5.4 + Math.sin(a + 1.05) * 0.5, 0, 5.4]); } win(p, -2.6, 1.6, 1.2, 1.2); win(p, 1.4, 1.6, 1.2, 1.2); rect(c, -0.6, 0, 1.2, 2.4, p.g("#7A4A26")); },
  coop: (p) => { const c = p.c; rect(c, -1.3, 0.3, 2.6, 1.4, p.g("#E8D2A8")); for (let k = 0; k < 5; k++) rect(c, -1.3 + k * 0.52, 0.3, 0.05, 1.4, p.g("#C9B088")); roof(p, -1.3, 1.3, 1.7, 0.9, p.g("#B8483A")); rect(c, -0.3, 0.3, 0.5, 0.6, "#2A1E18"); poly(c, p.g("#9A6A40"), [0.2, 0.3, 1.4, -0.1, 1.5, 0, 0.3, 0.4]); },
  barn: (p) => { const c = p.c; rect(c, -4.4, 0, 8.8, 4.6, p.g("#C2402F")); poly(c, p.g("#A8302A"), [-4.8, 4.6, -3.2, 6.6, 3.2, 6.6, 4.8, 4.6]); poly(c, p.g("#F4EFE6"), [-4.9, 4.5, -3.25, 6.75, 3.25, 6.75, 4.9, 4.5, 4.6, 4.5, 3.1, 6.5, -3.1, 6.5, -4.6, 4.5]); rect(c, -1.6, 0, 3.2, 3.2, p.g("#A8302A")); c.strokeStyle = p.g("#F4EFE6"); c.lineWidth = 0.18; c.strokeRect(-1.6, 0, 3.2, 3.2); c.beginPath(); c.moveTo(-1.6, 0); c.lineTo(1.6, 3.2); c.moveTo(1.6, 0); c.lineTo(-1.6, 3.2); c.stroke(); win(p, -0.6, 4.2, 1.2, 1.0); },
  silo: (p) => { const c = p.c; rect(c, -1.4, 0, 2.8, 8, p.g("#D7DBE5")); rect(c, 0.5, 0, 0.9, 8, p.g("#B9BECB")); for (let k = 1; k < 8; k++) rect(c, -1.4, k, 2.8, 0.06, p.g("#A8AEBE")); c.fillStyle = p.g("#8E96AA"); c.beginPath(); c.arc(0, 8, 1.4, 0, Math.PI); c.fill(); },
  pumpkin: (p) => { const c = p.c; for (const [x, s] of [[-0.35, 0.8], [0.3, 1]] as const) { for (let k = -1; k <= 1; k++) ell(c, x + k * 0.16 * s, 0.32 * s, 0.24 * s, 0.32 * s, p.g(k ? "#E8742A" : "#F28A3A")); rect(c, x - 0.03, 0.6 * s, 0.07, 0.14, p.g("#4E7A2A")); } },
  scarecrow: (p) => { const c = p.c; rect(c, -0.07, -0.3, 0.14, 2.6, p.g("#8A5A36")); rect(c, -0.9, 1.7, 1.8, 0.12, p.g("#8A5A36")); poly(c, p.g("#3A6AA8"), [-0.5, 1.0, 0.5, 1.0, 0.65, 1.9, -0.65, 1.9]); ell(c, 0, 2.2, 0.3, 0.3, p.g("#F2D9A0")); poly(c, p.g("#8A5A36"), [-0.5, 2.38, 0.5, 2.38, 0.2, 2.8, -0.2, 2.8]); rect(c, -0.6, 2.36, 1.2, 0.08, p.g("#6A4430")); },
  cactus: (p) => { const c = p.c; ell(c, 0, 0.45, 0.42, 0.48, p.g("#3E9A4E")); c.strokeStyle = p.g("#2E7A3A"); c.lineWidth = 0.04; for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(k * 0.12, 0.45, 0.05, 0.46, 0, 0, Math.PI * 2); c.stroke(); } ell(c, 0, 0.96, 0.12, 0.08, p.g("#FF5A8A")); },
  saguaro: (p) => { const c = p.c; c.lineCap = "round"; c.strokeStyle = p.g("#3E9A4E"); c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 4.1); c.stroke(); c.lineWidth = 0.34; c.beginPath(); c.moveTo(0, 1.6); c.lineTo(-0.8, 1.6); c.lineTo(-0.8, 2.9); c.moveTo(0, 2.2); c.lineTo(0.75, 2.2); c.lineTo(0.75, 3.4); c.stroke(); c.strokeStyle = rgba(p.light, 0.22); c.lineWidth = 0.12; c.beginPath(); c.moveTo(p.lr * 0.12, 0.2); c.lineTo(p.lr * 0.12, 4); c.stroke(); },
  tumbleweed: (p) => { const c = p.c; c.strokeStyle = p.g("#B8955A"); c.lineWidth = 0.035; for (let k = 0; k < 16; k++) { c.beginPath(); c.arc(range(p.r, -0.15, 0.15), 0.52 + range(p.r, -0.1, 0.1), range(p.r, 0.25, 0.5), range(p.r, 0, 6), range(p.r, 0, 6) + 2); c.stroke(); } },
  hoodoo: (p) => { const c = p.c; poly(c, p.g("#C8683E"), [-0.7, 0, -0.45, 2.0, -0.55, 3.4, -0.3, 4.4, 0.35, 4.4, 0.5, 3.2, 0.4, 1.8, 0.75, 0]); for (let k = 0; k < 5; k++) rect(c, -0.6, 0.6 + k * 0.8, 1.2, 0.12, rgba("#7A2A1A", 0.2)); ell(c, 0, 4.5, 0.8, 0.32, p.g("#9A4A2E")); },
  arch: (p) => { const c = p.c; c.fillStyle = p.g("#C8683E"); c.beginPath(); c.moveTo(-4.8, 0); c.lineTo(-4.4, 5.2); c.quadraticCurveTo(0, 7.6, 4.4, 5.2); c.lineTo(4.8, 0); c.lineTo(2.6, 0); c.quadraticCurveTo(0, 6.2, -2.6, 0); c.closePath(); c.fill(); for (let k = 0; k < 6; k++) rect(c, -4.8, 0.8 + k * 1.0, 9.6, 0.14, rgba("#6A2A1A", 0.18)); },
  watertower: (p) => { const c = p.c; c.strokeStyle = p.g("#6A5440"); c.lineWidth = 0.2; c.beginPath(); c.moveTo(-1.6, 0); c.lineTo(-1.2, 5.4); c.moveTo(1.6, 0); c.lineTo(1.2, 5.4); c.moveTo(-1.4, 1.5); c.lineTo(1.4, 4); c.moveTo(1.4, 1.5); c.lineTo(-1.4, 4); c.stroke(); rect(c, -1.8, 5.4, 3.6, 2.6, p.g("#A8784A")); for (let k = 0; k < 6; k++) rect(c, -1.8 + k * 0.6, 5.4, 0.06, 2.6, p.g("#7A5432")); poly(c, p.g("#6A4430"), [-2.1, 8, 0, 9, 2.1, 8]); },
  glowshroom: (p) => { const c = p.c; for (const [x, s] of [[-0.35, 0.7], [0.15, 1], [0.5, 0.55]] as const) { rect(c, x - 0.05 * s, 0, 0.1 * s, 0.7 * s, p.g("#EDE4F7")); c.fillStyle = p.g("#4AD8C0"); c.beginPath(); c.ellipse(x, 0.7 * s, 0.32 * s, 0.24 * s, 0, 0, Math.PI); c.fill(); } },
  bigshroom: (p) => { const c = p.c; poly(c, p.g("#EDE4F7"), [-0.35, 0, -0.25, 3.6, 0.25, 3.6, 0.35, 0]); ell(c, 0, 3.6, 1.9, 0.35, p.g("#5A3A8A")); c.fillStyle = p.g("#8A4ADB"); c.beginPath(); c.ellipse(0, 3.7, 2.0, 1.5, 0, 0, Math.PI); c.fill(); for (let k = 0; k < 6; k++) ell(c, range(p.r, -1.4, 1.4), 3.9 + range(p.r, 0.1, 1.0), 0.15, 0.12, "#B8FFF0"); },
  shroomhouse: (p) => { const c = p.c; poly(c, p.g("#F2E6D8"), [-2, 0, -1.8, 4, 1.8, 4, 2, 0]); win(p, -1.4, 1.6, 0.9, 0.9); win(p, 0.6, 2.4, 0.8, 0.8); rect(c, -0.3, 0, 0.9, 1.8, p.g("#7A4A2E")); ell(c, 0, 4, 3.1, 0.5, p.g("#A82E2A")); c.fillStyle = p.g("#E8423A"); c.beginPath(); c.ellipse(0, 4.1, 3.1, 3.1, 0, 0, Math.PI); c.fill(); for (const [x, y] of [[-1.6, 5.2], [0.3, 6.4], [1.6, 5.0], [-0.6, 4.6], [1.0, 5.9]]) ell(c, x, y, 0.32, 0.26, "#FFFFFF"); },
  logpile: (p) => { const c = p.c; for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) { const x = -1.2 + row * 0.38 + k * 0.76, y = 0.36 + row * 0.6; ell(c, x, y, 0.36, 0.36, p.g("#6A4426")); ell(c, x, y, 0.29, 0.29, p.g("#E2B27A")); c.strokeStyle = p.g("#B07A48"); c.lineWidth = 0.03; c.beginPath(); c.arc(x, y, 0.16, 0, Math.PI * 2); c.stroke(); } },
  sawmill: (p) => { const c = p.c; rect(c, -4.6, 0, 9.2, 3.8, p.g("#9E6A42")); for (let k = 0; k < 10; k++) rect(c, -4.6 + k * 0.92, 0, 0.06, 3.8, p.g("#7A4E2E")); roof(p, -4.6, 4.6, 3.8, 2.4, p.g("#4A4450")); win(p, -3.6, 1.6, 1.4, 1.0); win(p, 2.2, 1.6, 1.4, 1.0); rect(c, -1, 0, 2, 2.6, p.g("#5A3A22")); rect(c, 3.2, 4.6, 0.6, 2.0, p.g("#6A6470")); },
  snowman: (p) => { const c = p.c; ell(c, 0, 0.5, 0.55, 0.5, "#F4F8FF"); ell(c, 0, 1.25, 0.4, 0.38, "#F8FBFF"); ell(c, 0, 1.8, 0.28, 0.27, "#FFFFFF"); poly(c, "#FF7A2A", [0.05, 1.8, 0.4, 1.76, 0.05, 1.74]); ell(c, -0.1, 1.88, 0.03, 0.03, "#22243A"); ell(c, 0.1, 1.88, 0.03, 0.03, "#22243A"); rect(c, -0.3, 2.0, 0.6, 0.06, "#2A2D3E"); rect(c, -0.2, 2.06, 0.4, 0.3, "#2A2D3E"); rect(c, -0.38, 1.5, 0.76, 0.1, "#E8423A"); },
  lamp: (p) => { const c = p.c; rect(c, -0.07, 0, 0.14, 3.4, p.g("#2A3046")); rect(c, -0.2, 0, 0.4, 0.3, p.g("#2A3046")); poly(c, p.g("#2A3046"), [-0.28, 3.4, 0.28, 3.4, 0.18, 3.9, -0.18, 3.9]); rect(c, -0.2, 3.45, 0.4, 0.38, p.n > 0.2 ? "#FFE08A" : p.g("#E8EEF8")); },
  cottage: (p) => { const c = p.c; rect(c, -3, 0, 6, 3.4, p.g(["#C96B5A", "#5A86C9", "#E0B05A"][Math.floor(p.r() * 3)])); roof(p, -3, 3, 3.4, 2.4, p.g("#5A4A6A"), true); rect(c, 1.4, 4, 0.6, 1.4, p.g("#6A6470")); win(p, -2.2, 1.3, 1.1, 1.0); win(p, 1.1, 1.3, 1.1, 1.0); rect(c, -0.45, 0, 0.9, 1.9, p.g("#4A3A2A")); for (let k = 0; k < 8; k++) ell(c, -2.8 + k * 0.8, 3.45, 0.06, 0.06, ["#FF5A5A", "#FFD23F", "#3EE08F", "#5BC8FF"][k % 4]); },
  belltower: (p) => { const c = p.c; rect(c, -1.4, 0, 2.8, 7, p.g("#D8CFC4")); rect(c, 0.5, 0, 0.9, 7, p.g("#BFB4A8")); rect(c, -1.0, 5, 2, 1.6, "#2A2438"); ell(c, 0, 5.4, 0.5, 0.5, p.g("#E8B23A")); roof(p, -1.4, 1.4, 7, 2.6, p.g("#3A5A8A"), true); rect(c, -0.5, 0, 1, 1.8, p.g("#5A4430")); win(p, -0.4, 3, 0.8, 1.0); },
  cherry: (p) => { const c = p.c; c.strokeStyle = p.g("#4A2E32"); c.lineCap = "round"; c.lineWidth = 0.36; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-0.4, 1.6, 0.2, 2.6); c.stroke(); c.lineWidth = 0.16; c.beginPath(); c.moveTo(-0.1, 1.7); c.quadraticCurveTo(-1, 2.4, -1.6, 2.8); c.moveTo(0.1, 2.2); c.quadraticCurveTo(1, 2.6, 1.6, 3.2); c.stroke(); for (let k = 0; k < 16; k++) ell(c, range(p.r, -2, 2), 3.3 + range(p.r, -0.9, 1.2), range(p.r, 0.4, 0.7), range(p.r, 0.35, 0.6), p.g(["#FFB3CF", "#FF8FB8", "#FFD6E6"][k % 3])); },
  bamboo: (p) => { const c = p.c; for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.3, h = range(p.r, 4.4, 5.8); rect(c, x - 0.07, 0, 0.14, h, p.g("#6EAE4A")); for (let s = 0.8; s < h; s += 0.8) rect(c, x - 0.09, s, 0.18, 0.05, p.g("#4E8E3A")); ell(c, x + 0.25, h - 0.5, 0.3, 0.06, p.g("#7EC85A")); ell(c, x - 0.25, h - 1.2, 0.3, 0.06, p.g("#7EC85A")); } },
  stonelamp: (p) => { const c = p.c; const st = p.g("#A8A49C"); rect(c, -0.35, 0, 0.7, 0.2, st); rect(c, -0.12, 0.2, 0.24, 0.7, st); rect(c, -0.3, 0.9, 0.6, 0.12, st); rect(c, -0.24, 1.02, 0.48, 0.4, p.g("#8E8A82")); rect(c, -0.12, 1.08, 0.24, 0.26, p.n > 0.2 ? "#FFD27A" : "#4A4640"); poly(c, st, [-0.5, 1.42, 0.5, 1.42, 0, 1.85]); },
  pagoda: (p) => { const c = p.c; for (let k = 0; k < 4; k++) { const w = 2.4 - k * 0.4, y = k * 2.2; rect(c, -w * 0.7, y, w * 1.4, 1.7, p.g("#C9503A")); win(p, -0.35, y + 0.4, 0.7, 0.8); c.fillStyle = p.g("#3A4A5A"); c.beginPath(); c.moveTo(-w * 1.3, y + 1.6); c.quadraticCurveTo(0, y + 2.4, w * 1.3, y + 1.6); c.lineTo(w * 0.9, y + 2.2); c.lineTo(-w * 0.9, y + 2.2); c.closePath(); c.fill(); } rect(c, -0.05, 8.8, 0.1, 1.1, p.g("#E8B23A")); },
  deadtree: (p) => { const c = p.c; c.strokeStyle = p.g("#2A2026"); c.lineCap = "round"; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.15, 3.8); c.stroke(); c.lineWidth = 0.14; for (let k = 0; k < 5; k++) { const y = 1.4 + k * 0.5, d = k % 2 ? 1 : -1; c.beginPath(); c.moveTo(0.1, y); c.lineTo(d * range(p.r, 0.7, 1.4), y + range(p.r, 0.4, 1.0)); c.stroke(); } },
  lavarock: (p) => { const c = p.c; poly(c, p.g("#2E2428"), [-1.1, 0, -0.9, 0.7, -0.2, 1.2, 0.6, 1.0, 1.1, 0.4, 1.0, 0]); c.strokeStyle = "#FF8A3A"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-0.6, 0.2); c.lineTo(-0.2, 0.6); c.lineTo(0.3, 0.5); c.lineTo(0.6, 0.85); c.stroke(); },
  vent: (p) => { const c = p.c; poly(c, p.g("#3A2E32"), [-0.9, 0, -0.4, 0.6, 0.4, 0.6, 0.9, 0]); ell(c, 0, 0.6, 0.4, 0.1, "#FF8A3A"); },
  forge: (p) => { const c = p.c; rect(c, -3, 0, 6, 4, p.g("#3A3036")); poly(c, p.g("#2A2228"), [-3.3, 4, 3.3, 4, 2.4, 5.6, -2.4, 5.6]); rect(c, 1.4, 5.6, 0.9, 2.8, p.g("#4A3E44")); rect(c, -1.2, 0, 2.4, 2.4, "#FF7A2A"); rect(c, -1, 0, 2, 2.2, "#FFB23A"); win(p, -2.6, 2.2, 0.9, 0.9); },
  moonrock: (p) => { const c = p.c, w = range(p.r, 0.8, 1.1); poly(c, p.g("#A8ACC0"), [-w, 0, -w * 0.7, 0.7, 0, 1.1, w * 0.7, 0.8, w, 0]); ell(c, -0.2, 0.5, 0.18, 0.1, "rgba(0,0,30,0.25)"); ell(c, 0.4, 0.35, 0.12, 0.07, "rgba(0,0,30,0.25)"); },
  antenna: (p) => { const c = p.c; c.strokeStyle = p.g("#9AA2C0"); c.lineWidth = 0.12; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 4.4); c.moveTo(-0.6, 0); c.lineTo(0, 2.2); c.lineTo(0.6, 0); c.moveTo(-0.5, 3.6); c.lineTo(0.5, 3.6); c.moveTo(-0.35, 4.0); c.lineTo(0.35, 4.0); c.stroke(); },
  dish: (p) => { const c = p.c; rect(c, -0.1, 0, 0.2, 1.6, p.g("#8E96B8")); c.fillStyle = p.g("#D8DCEC"); c.beginPath(); c.ellipse(0.2, 2.2, 1.3, 0.6, -0.7, 0, Math.PI); c.fill(); c.strokeStyle = p.g("#8E96B8"); c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.2, 2.2); c.lineTo(0.9, 3.0); c.stroke(); },
  dome: (p) => { const c = p.c; c.fillStyle = p.g("#C9D2EE"); c.beginPath(); c.arc(0, 0, 4.2, Math.PI, 0); c.fill(); c.fillStyle = rgba("#7CE7FF", 0.3 + 0.3 * p.n); c.beginPath(); c.arc(0, 0, 3.7, Math.PI, 0); c.fill(); c.strokeStyle = p.g("#9AA6CC"); c.lineWidth = 0.08; for (let k = 1; k < 4; k++) { c.beginPath(); c.arc(0, 0, 3.7, Math.PI + k * 0.8, Math.PI + k * 0.8 + 0.01); c.lineTo(0, 0); c.stroke(); } for (let k = 0; k < 5; k++) rect(c, -2.4 + k * 1.1, 0.6, 0.5, 0.35, "#FFE08A"); },
  crystal: (p) => { const c = p.c; const col = p.r() < 0.5 ? "#7CE7FF" : "#B9A6FF"; for (const [x, h, a] of [[-0.35, 1.0, -0.25], [0, 1.6, 0.05], [0.35, 1.1, 0.3]] as const) { c.save(); c.translate(x, 0); c.rotate(-a); poly(c, rgba(col, 0.9), [-0.16, 0, -0.16, h * 0.8, 0, h, 0.16, h * 0.8, 0.16, 0]); poly(c, "rgba(255,255,255,0.45)", [-0.16, 0, -0.16, h * 0.8, 0, h, 0, 0]); c.restore(); } },
};

/** sprites per (kind, variant): built lazily on first use within a stage */
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
function halo(c: C, col: string, x: number, y: number, R: number, a: number) {
  c.globalAlpha = Math.max(0, Math.min(1, a));
  c.drawImage(glow(col), x - R, y - R, R * 2, R * 2);
  c.globalAlpha = 1;
}

/** live bits drawn over a prop (prop-local metres, y up) */
export function propMotion(c: C, kind: PropKind, t: number, seed: number, night: number) {
  switch (kind) {
    case "windmill": {
      c.save(); c.translate(0, 7.2); c.rotate(-t * 0.8 - seed);
      for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillStyle = "#F4EEE2"; c.fillRect(0.2, -0.32, 3.6, 0.64); c.strokeStyle = "#8A6A4A"; c.lineWidth = 0.08; c.strokeRect(0.2, -0.32, 3.6, 0.64); }
      c.fillStyle = "#6A4430"; c.beginPath(); c.arc(0, 0, 0.32, 0, Math.PI * 2); c.fill();
      c.restore(); return;
    }
    case "sunflower": {
      const sw = Math.sin(t * 1.3 + seed) * 0.06;
      c.save(); c.translate(0.05, 2.7); c.rotate(sw);
      c.fillStyle = "#FFC21A"; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.beginPath(); c.ellipse(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.2, 0.08, a, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#6A3E1A"; c.beginPath(); c.arc(0, 0, 0.26, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,220,120,0.35)"; c.beginPath(); c.arc(-0.06, 0.06, 0.12, 0, Math.PI * 2); c.fill();
      c.restore(); return;
    }
    case "hive": {
      c.fillStyle = "#2A1A10";
      for (let k = 0; k < 4; k++) { const a = t * (2 + k * 0.4) + seed + k; c.beginPath(); c.arc(Math.cos(a) * (0.6 + k * 0.1), 1.3 + Math.sin(a * 1.7) * 0.4, 0.05, 0, Math.PI * 2); c.fill(); }
      return;
    }
    case "lamp": case "stonelamp": case "cottage": case "forge": {
      if (night < 0.2 && kind !== "forge") return;
      const y = kind === "lamp" ? 3.64 : kind === "stonelamp" ? 1.2 : kind === "forge" ? 1.2 : 1.8;
      const R = kind === "lamp" ? 2.2 : kind === "forge" ? 3.4 : 1.4;
      halo(c, "#FFC861", 0, y, R, (kind === "forge" ? 0.7 : 0.75 * night) * (0.85 + 0.15 * Math.sin(t * 5 + seed)));
      return;
    }
    case "glowshroom": case "bigshroom": case "crystal": {
      const col = kind === "crystal" ? "#7CE7FF" : "#7CF5E0";
      halo(c, col, 0, kind === "bigshroom" ? 3.9 : 0.6, kind === "bigshroom" ? 2.8 : 1.0, 0.45 + 0.25 * Math.sin(t * 2 + seed));
      return;
    }
    case "vent": {
      for (let k = 0; k < 4; k++) { const u = (t * 0.6 + k / 4 + seed * 0.1) % 1; c.fillStyle = rgba("#E8E0E8", 0.35 * (1 - u)); c.beginPath(); c.arc(Math.sin(u * 5 + k) * 0.2, 0.7 + u * 2.4, 0.2 + u * 0.5, 0, Math.PI * 2); c.fill(); }
      return;
    }
    case "antenna": case "dome": {
      if (Math.sin(t * 3 + seed) > 0.3) { c.fillStyle = "#FF5A6A"; c.beginPath(); c.arc(0, kind === "antenna" ? 4.5 : 4.3, 0.12, 0, Math.PI * 2); c.fill(); c.fillStyle = "rgba(255,90,106,0.3)"; c.beginPath(); c.arc(0, kind === "antenna" ? 4.5 : 4.3, 0.4, 0, Math.PI * 2); c.fill(); }
      return;
    }
    case "cherry": {
      // a petal or two drifting off
      for (let k = 0; k < 2; k++) { const u = (t * 0.25 + k * 0.5 + seed * 0.13) % 1; c.fillStyle = rgba("#FFC4DA", 1 - u); c.beginPath(); c.ellipse(1.5 * Math.sin(u * 4 + k) + u * 1.5, 3.4 - u * 3.2, 0.08, 0.05, u * 6, 0, Math.PI * 2); c.fill(); }
      return;
    }
  }
}
