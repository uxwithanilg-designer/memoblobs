// Each district's blocks, painted as 16×16 pixel tiles into one 128×64 atlas with hard pixel edges — grass, sand or
// snow lots, roads, planks, glass with a glint, brick (or sandstone, ice brick, temple stone) with mortar and lit
// edges, plaster, stone, roof tiles, floor tiles, carpet, riveted steel, the vault's round-bolted plate, gold, leaves,
// bark, fence boards, marble veins, neon, trim, crates, safes with a dial, earth, metal floor and paint. No image files.
import type { District } from "../districts";
import { makeRng, mix, shade, type Rng } from "../util";
import * as THREE from "three";

export const ATLAS_W = 128, ATLAS_H = 64, TILE = 16, COLS = 8;
export function tileUv(i: number) {
  const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE, e = 0.02;
  return { u0: (x + e) / ATLAS_W, u1: (x + TILE - e) / ATLAS_W, v0: 1 - (y + TILE - e) / ATLAS_H, v1: 1 - (y + e) / ATLAS_H };
}

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
function speckle(c: Ctx, r: Rng, ox: number, oy: number, base: string, amt: number) {
  c.fillStyle = base; c.fillRect(ox, oy, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r();
    if (v < 0.22) px(c, ox + x, oy + y, shade(base, -amt * (0.5 + r())));
    else if (v > 0.84) px(c, ox + x, oy + y, shade(base, amt * (0.5 + r())));
  }
}
function bricks(c: Ctx, r: Rng, ox: number, oy: number, base: string, mortar: string, bw = 8, bh = 4) {
  speckle(c, r, ox, oy, base, 0.1);
  c.fillStyle = mortar;
  for (let y = 0; y < 16; y += bh) {
    c.fillRect(ox, oy + y + bh - 1, 16, 1);
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = off; x < 16; x += bw) c.fillRect(ox + x, oy + y, 1, bh - 1);
  }
  for (let y = 0; y < 16; y += bh) for (let x = (y / bh) % 2 ? bw / 2 : 0; x < 16; x += bw) { c.fillStyle = shade(base, 0.16); c.fillRect(ox + x + 1, oy + y, bw - 2, 1); }
}
function frame(c: Ctx, ox: number, oy: number, col: string, hi: string, lo: string) {
  c.fillStyle = col; c.fillRect(ox, oy, 16, 16);
  c.fillStyle = hi; c.fillRect(ox, oy, 16, 1); c.fillRect(ox, oy, 1, 16);
  c.fillStyle = lo; c.fillRect(ox, oy + 15, 16, 1); c.fillRect(ox + 15, oy, 1, 16);
}

export function paintAtlas(d: District, partner: District | null, blend: number, seed: number) {
  const P = (k: keyof District["palette"]) => (partner ? mix(d.palette[k], partner.palette[k], blend * 0.8) : d.palette[k]);
  const cv = document.createElement("canvas"); cv.width = ATLAS_W; cv.height = ATLAS_H;
  const c = cv.getContext("2d")!;
  const r = makeRng(seed);
  const at = (i: number) => ({ x: (i % COLS) * TILE, y: Math.floor(i / COLS) * TILE });
  const g = d.ground;
  // 0 ground
  {
    const { x, y } = at(0), top = P("top");
    speckle(c, r, x, y, top, g === "snow" ? 0.05 : g === "street" || g === "chrome" ? 0.06 : 0.14);
    if (g === "grass" || g === "jungle" || g === "cloud") for (let k = 0; k < 12; k++) { const a = Math.floor(r() * 15), b = Math.floor(r() * 15); px(c, x + a, y + b, shade(top, 0.25)); px(c, x + a, y + b + 1, shade(top, -0.18)); }
    if (g === "sand" || g === "beach") for (let k = 0; k < 4; k++) { c.fillStyle = shade(top, 0.1); c.fillRect(x + ((k * 5) % 6), y + 2 + k * 4, 9, 1); }
    if (g === "street" || g === "chrome") { c.fillStyle = shade(top, -0.14); c.fillRect(x, y + 15, 16, 1); c.fillRect(x + 15, y, 1, 16); }
    if (g === "moon") for (let k = 0; k < 3; k++) { const a = 2 + Math.floor(r() * 11), b = 2 + Math.floor(r() * 11); c.fillStyle = shade(top, -0.2); c.fillRect(x + a, y + b, 3, 2); c.fillStyle = shade(top, 0.15); c.fillRect(x + a, y + b - 1, 3, 1); }
    if (g === "ash") for (let k = 0; k < 6; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), "#FF8A3A");
  }
  // 1 road: paving stones
  { const { x, y } = at(1), b = P("road"); speckle(c, r, x, y, b, 0.08); c.fillStyle = shade(b, -0.22); for (const k of [0, 8]) { c.fillRect(x, y + k, 16, 1); c.fillRect(x + (k ? 4 : 11), y + k, 1, 8); } }
  // 2 wood planks
  { const { x, y } = at(2), w = mix(P("floor"), "#A8703E", 0.5); speckle(c, r, x, y, w, 0.08); c.fillStyle = shade(w, -0.3); for (let k = 3; k < 16; k += 4) c.fillRect(x, y + k, 16, 1); for (let k = 0; k < 4; k++) px(c, x + ((k * 7 + 3) % 16), y + k * 4 + 1, shade(w, -0.45)); }
  // 3 glass: pale with a glint and a frame
  { const { x, y } = at(3), gl = P("glass"); c.fillStyle = gl; c.fillRect(x, y, 16, 16); c.fillStyle = shade(gl, -0.25); c.fillRect(x, y, 16, 1); c.fillRect(x, y + 15, 16, 1); c.fillRect(x, y, 1, 16); c.fillRect(x + 15, y, 1, 16); c.fillStyle = "#FFFFFF"; for (let k = 0; k < 5; k++) { px(c, x + 3 + k, y + 9 - k, "#FFFFFF"); px(c, x + 6 + k, y + 12 - k, "rgba(255,255,255,.7)"); } }
  // 4 brick (by district: red brick, sandstone, ice brick, dark brick, temple stone…)
  { const { x, y } = at(4), w = P("wall"); bricks(c, r, x, y, w, shade(w, d.id === "frost" ? 0.35 : -0.38), d.id === "jungle" || d.id === "blossom" ? 16 : 8, d.id === "jungle" ? 8 : 4); if (d.id === "jungle") for (let k = 0; k < 10; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), "#3E8A3A"); }
  // 5 plaster
  { const { x, y } = at(5), w = P("wall2"); speckle(c, r, x, y, w, 0.05); c.fillStyle = shade(w, -0.1); c.fillRect(x, y + 15, 16, 1); }
  // 6 stone blocks
  { const { x, y } = at(6), s = mix(P("wall"), "#9A9AA0", 0.55); bricks(c, r, x, y, s, shade(s, -0.35), 16, 8); }
  // 7 roof tiles
  { const { x, y } = at(7), rf = P("roof"); speckle(c, r, x, y, rf, 0.06); for (let k = 0; k < 16; k += 4) { c.fillStyle = shade(rf, -0.3); c.fillRect(x, y + k + 3, 16, 1); c.fillStyle = shade(rf, 0.15); c.fillRect(x, y + k, 16, 1); for (let q = (k / 4) % 2 ? 2 : 6; q < 16; q += 8) { c.fillStyle = shade(rf, -0.2); c.fillRect(x + q, y + k, 1, 4); } } }
  // 8 floor tiles (checker)
  { const { x, y } = at(8), f = mix(P("floor"), "#E8E0D0", 0.4); for (let q = 0; q < 4; q++) { c.fillStyle = q % 3 === 0 ? f : shade(f, -0.18); c.fillRect(x + (q % 2) * 8, y + Math.floor(q / 2) * 8, 8, 8); } c.fillStyle = shade(f, -0.35); c.fillRect(x, y + 7, 16, 1); c.fillRect(x + 7, y, 1, 16); }
  // 9 carpet
  { const { x, y } = at(9), cp = mix(P("trim"), "#8A2A3A", 0.5); speckle(c, r, x, y, cp, 0.07); c.fillStyle = shade(cp, 0.25); c.fillRect(x + 2, y + 2, 12, 1); c.fillRect(x + 2, y + 13, 12, 1); c.fillRect(x + 2, y + 2, 1, 12); c.fillRect(x + 13, y + 2, 1, 12); }
  // 10 steel plate with rivets
  { const { x, y } = at(10); frame(c, x, y, "#8A92A6", "#B8BCCB", "#5A5E6E"); for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x + a, y + b, "#4A4E5A"); c.fillStyle = "#7A8296"; c.fillRect(x + 4, y + 7, 8, 2); }
  // 11 vault steel: thick, with round bolts
  { const { x, y } = at(11); frame(c, x, y, "#5A6070", "#8A92A6", "#2A2D3A"); for (const [a, b] of [[3, 3], [12, 3], [3, 12], [12, 12], [7, 3], [3, 7], [12, 7], [7, 12]]) { c.fillStyle = "#B8BCCB"; c.fillRect(x + a - 1, y + b - 1, 2, 2); c.fillStyle = "#2A2D3A"; px(c, x + a, y + b, "#2A2D3A"); } c.fillStyle = "#FFD23F"; c.fillRect(x + 6, y + 6, 4, 4); }
  // 12 gold
  { const { x, y } = at(12); frame(c, x, y, "#F2B830", "#FFF0A0", "#B87A10"); for (let k = 0; k < 5; k++) px(c, x + 3 + k * 2, y + 4 + (k % 2) * 6, "#FFF6C8"); }
  // 13 leaves
  { const { x, y } = at(13), lf = P("leaf"); speckle(c, r, x, y, lf, 0.24); for (let k = 0; k < 14; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), shade(lf, 0.35)); }
  // 14 bark
  { const { x, y } = at(14), b = "#6A4426"; speckle(c, r, x, y, b, 0.1); c.fillStyle = shade(b, -0.3); for (let k = 2; k < 16; k += 5) c.fillRect(x + k, y, 1, 16); }
  // 15 fence boards (painted)
  { const { x, y } = at(15), f = d.id === "maple" ? "#F2F2EA" : mix(P("floor"), "#A8703E", 0.3); speckle(c, r, x, y, f, 0.05); c.fillStyle = shade(f, -0.3); c.fillRect(x + 7, y, 1, 16); c.fillRect(x + 15, y, 1, 16); }
  // 16 marble
  { const { x, y } = at(16), m = "#EEEAE4"; speckle(c, r, x, y, m, 0.03); c.strokeStyle = "#B8B4C0"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 1, y + 4); c.lineTo(x + 7, y + 9); c.lineTo(x + 15, y + 6); c.stroke(); px(c, x + 10, y + 12, "#B8B4C0"); }
  // 17 neon
  { const { x, y } = at(17), n = P("trim"); c.fillStyle = shade(n, 0.2); c.fillRect(x, y, 16, 16); c.fillStyle = "#FFFFFF"; c.fillRect(x + 3, y + 3, 10, 10); c.fillStyle = shade(n, 0.45); c.fillRect(x + 5, y + 5, 6, 6); }
  // 18 trim
  { const { x, y } = at(18), t = P("trim"); frame(c, x, y, t, shade(t, 0.25), shade(t, -0.3)); c.fillStyle = shade(t, -0.12); c.fillRect(x + 2, y + 7, 12, 2); }
  // 19 crate
  { const { x, y } = at(19), w = "#A8703E"; frame(c, x, y, w, shade(w, 0.2), shade(w, -0.4)); c.fillStyle = shade(w, -0.3); for (let k = 0; k < 14; k++) px(c, x + 1 + k, y + 1 + k, shade(w, -0.35)); c.fillRect(x, y + 7, 16, 1); }
  // 20 safe with a dial
  { const { x, y } = at(20); frame(c, x, y, "#3A4A5A", "#5A6A7A", "#1A2230"); c.fillStyle = "#C8C8D0"; c.fillRect(x + 5, y + 5, 6, 6); c.fillStyle = "#3A3A42"; c.fillRect(x + 7, y + 7, 2, 2); c.fillStyle = "#FFD23F"; c.fillRect(x + 12, y + 7, 2, 3); }
  // 21 earth
  { const { x, y } = at(21); speckle(c, r, x, y, P("side"), 0.14); }
  // 22 metal floor (diamond plate)
  { const { x, y } = at(22); c.fillStyle = "#6A7080"; c.fillRect(x, y, 16, 16); for (let a = 0; a < 16; a += 4) for (let b = (a / 4) % 2 ? 2 : 0; b < 16; b += 4) { px(c, x + a, y + b, "#9AA0B0"); px(c, x + a + 1, y + b + 1, "#4A5060"); } }
  // 23 paint (white: the game tints it)
  { const { x, y } = at(23); speckle(c, r, x, y, "#F4F4F4", 0.04); }
  return pixel(cv);
}

/** crisp pixels, no smoothing (the blocky look) */
export function pixel(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
