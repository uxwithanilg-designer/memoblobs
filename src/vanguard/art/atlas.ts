// Each world's block set: 32 pixel-art tiles of 16×16 (ground tops and sides with a lip of grass, sand or snow, deep
// earth, walls of brick, stone or panels by world, paving, planks, leaves and bark, metal, glowing light panels,
// water, crates, windows, rock, teleport pads, lava, ice, brick, cloth, glass, hay, cactus, neon, gold, moss, dark
// metal, hazard paint, plaster and roof tiles), painted from the world's palette into one 128×128 atlas with hard
// pixel edges. No image files: every world, and every remix blend, gets its own.
import type { World } from "../worlds";
import { makeRng, mix, shade, type Rng } from "../util";
import { pixelTexture, type Rect } from "./voxel";

export const T = {
  TOP: 0, SIDE: 1, DEEP: 2, WALL: 3, TRIM: 4, PATH: 5, PLANK: 6, LEAVES: 7, BARK: 8, METAL: 9, GLOW: 10, WATER: 11, CRATE: 12, WINDOW: 13, ROCK: 14, PAD: 15,
  LAVA: 16, ICE: 17, BRICK: 18, CLOTH: 19, GLASS: 20, HAY: 21, SAND: 22, CACTUS: 23, NEON: 24, GOLD: 25, MOSS: 26, SNOW: 27, DARK: 28, HAZARD: 29, PLASTER: 30, ROOF: 31,
} as const;
export const ATLAS = 128, TILE = 16;

export function tileRect(i: number): Rect { return { x: (i % 8) * TILE, y: Math.floor(i / 8) * TILE, w: TILE, h: TILE }; }

type Ctx = CanvasRenderingContext2D;
function px(c: Ctx, x: number, y: number, col: string) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
function speckle(c: Ctx, r: Rng, ox: number, oy: number, base: string, amt: number, w = 16, h = 16, y0 = 0) {
  c.fillStyle = base; c.fillRect(ox, oy + y0, w, h);
  for (let y = y0; y < y0 + h; y++) for (let x = 0; x < w; x++) {
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
  // a lit edge on each brick
  for (let y = 0; y < 16; y += bh) for (let x = (y / bh) % 2 ? bw / 2 : 0; x < 16; x += bw) { c.fillStyle = shade(base, 0.14); c.fillRect(ox + x + 1, oy + y, bw - 2, 1); }
}

export function paintAtlas(w: World, partner: World | null, blend: number, seed: number) {
  const P = (k: keyof World["palette"]) => (partner ? mix(w.palette[k], partner.palette[k], blend * 0.8) : w.palette[k]);
  const cv = document.createElement("canvas"); cv.width = cv.height = ATLAS;
  const c = cv.getContext("2d")!;
  const r = makeRng(seed);
  const at = (i: number) => tileRect(i);
  const top = P("top"), side = P("side"), deep = P("deep"), wall = P("wall"), trim = P("trim"), glow = P("glow"), water = P("water");
  const g = w.ground;
  // ground top: grass / sand / snow / street ... with a texture of its own
  {
    const { x, y } = at(T.TOP);
    speckle(c, r, x, y, top, g === "snow" ? 0.05 : g === "street" || g === "chrome" ? 0.06 : 0.14);
    if (g === "grass" || g === "jungle" || g === "cloud") for (let k = 0; k < 10; k++) { const a = Math.floor(r() * 15), b = Math.floor(r() * 15); px(c, x + a, y + b, shade(top, 0.25)); px(c, x + a, y + b + 1, shade(top, -0.15)); }
    if (g === "sand" || g === "beach") for (let k = 0; k < 4; k++) { const b = 2 + k * 4; c.fillStyle = shade(top, 0.1); c.fillRect(x + ((k * 5) % 6), y + b, 9, 1); }
    if (g === "street") { c.fillStyle = shade(top, -0.12); c.fillRect(x, y + 15, 16, 1); c.fillRect(x + 15, y, 1, 16); }
    if (g === "chrome") { c.fillStyle = shade(top, 0.18); c.fillRect(x + 1, y + 1, 14, 1); c.fillStyle = shade(top, -0.2); c.fillRect(x, y + 15, 16, 1); c.fillRect(x + 15, y, 1, 16); for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x + a, y + b, shade(top, -0.35)); }
    if (g === "moon") for (let k = 0; k < 3; k++) { const a = 2 + Math.floor(r() * 11), b = 2 + Math.floor(r() * 11); c.fillStyle = shade(top, -0.2); c.fillRect(x + a, y + b, 3, 2); c.fillStyle = shade(top, 0.15); c.fillRect(x + a, y + b - 1, 3, 1); }
    if (g === "ash") for (let k = 0; k < 5; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), "#FF8A3A");
  }
  // ground side: the top's lip hanging over the earth
  {
    const { x, y } = at(T.SIDE);
    speckle(c, r, x, y, side, 0.14);
    const lip = g === "street" || g === "chrome" ? 2 : 4;
    for (let k = 0; k < 16; k++) { const d = lip + (g === "street" || g === "chrome" ? 0 : Math.floor(r() * 3)); c.fillStyle = top; c.fillRect(x + k, y, 1, d); px(c, x + k, y + d, shade(top, -0.25)); }
    c.fillStyle = shade(top, 0.18); c.fillRect(x, y, 16, 1);
  }
  speckle(c, r, at(T.DEEP).x, at(T.DEEP).y, deep, 0.16);
  for (let k = 0; k < 6; k++) { const { x, y } = at(T.DEEP); px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), shade(deep, 0.3)); }
  // walls: stone blocks (most), panels (metro, foundry, lunar, citadel)
  {
    const { x, y } = at(T.WALL);
    if (g === "street" || g === "ash" || g === "moon" || g === "chrome") {
      speckle(c, r, x, y, wall, 0.05);
      c.fillStyle = shade(wall, -0.3); c.fillRect(x, y + 7, 16, 1); c.fillRect(x + 7, y, 1, 16);
      c.fillStyle = shade(wall, 0.2); c.fillRect(x, y, 16, 1); c.fillRect(x, y + 8, 16, 1);
      for (const [a, b] of [[2, 2], [12, 2], [2, 12], [12, 12]]) px(c, x + a, y + b, shade(wall, 0.35));
    } else bricks(c, r, x, y, wall, shade(wall, -0.32), 8, 4);
  }
  { const { x, y } = at(T.TRIM); c.fillStyle = trim; c.fillRect(x, y, 16, 16); c.fillStyle = shade(trim, -0.3); for (let k = -16; k < 16; k += 6) for (let q = 0; q < 16; q++) { const xx = k + q; if (xx >= 0 && xx < 16) { c.fillRect(x + xx, y + q, 2, 1); } } c.fillStyle = shade(trim, 0.25); c.fillRect(x, y, 16, 1); }
  { const { x, y } = at(T.PATH); bricks(c, r, x, y, mix(wall, top, 0.3), shade(mix(wall, top, 0.3), -0.25), 8, 8); }
  {
    const { x, y } = at(T.PLANK);
    const wood = "#A8703E";
    speckle(c, r, x, y, wood, 0.08);
    c.fillStyle = shade(wood, -0.35); for (let k = 3; k < 16; k += 4) c.fillRect(x, y + k, 16, 1);
    for (let k = 0; k < 4; k++) px(c, x + ((k * 7 + 3) % 16), y + k * 4 + 1, shade(wood, -0.45));
  }
  {
    const { x, y } = at(T.LEAVES);
    const leaf = w.id === "sakura" ? "#F4A0C8" : w.id === "crystal" ? "#B87CE8" : g === "snow" ? "#2E6A4A" : g === "jungle" ? "#2A8A3A" : g === "sand" ? "#6A9A3A" : g === "cloud" ? "#5CC060" : "#3E9A3A";
    speckle(c, r, x, y, leaf, 0.22);
    for (let k = 0; k < 12; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), shade(leaf, 0.35));
  }
  { const { x, y } = at(T.BARK); const bark = "#6A4426"; speckle(c, r, x, y, bark, 0.1); c.fillStyle = shade(bark, -0.3); for (let k = 2; k < 16; k += 5) c.fillRect(x + k, y, 1, 16); }
  {
    const { x, y } = at(T.METAL);
    const m = "#8A92A6";
    speckle(c, r, x, y, m, 0.04);
    c.fillStyle = shade(m, 0.25); c.fillRect(x, y, 16, 1); c.fillRect(x, y, 1, 16);
    c.fillStyle = shade(m, -0.3); c.fillRect(x, y + 15, 16, 1); c.fillRect(x + 15, y, 1, 16);
    for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x + a, y + b, shade(m, -0.4));
  }
  { const { x, y } = at(T.GLOW); c.fillStyle = shade(glow, -0.4); c.fillRect(x, y, 16, 16); c.fillStyle = glow; c.fillRect(x + 2, y + 2, 12, 12); c.fillStyle = shade(glow, 0.5); c.fillRect(x + 4, y + 4, 8, 8); }
  { const { x, y } = at(T.WATER); speckle(c, r, x, y, water, 0.06); c.fillStyle = shade(water, 0.3); for (let k = 0; k < 4; k++) c.fillRect(x + ((k * 5) % 12), y + 2 + k * 4, 5, 1); }
  {
    const { x, y } = at(T.CRATE);
    const wd = "#B8844A";
    speckle(c, r, x, y, wd, 0.07);
    c.fillStyle = shade(wd, -0.4); c.fillRect(x, y, 16, 2); c.fillRect(x, y + 14, 16, 2); c.fillRect(x, y, 2, 16); c.fillRect(x + 14, y, 2, 16);
    for (let k = 0; k < 12; k++) { px(c, x + 2 + k, y + 2 + k, shade(wd, -0.4)); px(c, x + 3 + k, y + 2 + k, shade(wd, -0.25)); }
  }
  { const { x, y } = at(T.WINDOW); c.fillStyle = shade(wall, -0.2); c.fillRect(x, y, 16, 16); c.fillStyle = "#FFD88A"; c.fillRect(x + 2, y + 2, 5, 5); c.fillRect(x + 9, y + 2, 5, 5); c.fillRect(x + 2, y + 9, 5, 5); c.fillStyle = "#5A7AA8"; c.fillRect(x + 9, y + 9, 5, 5); }
  { const { x, y } = at(T.ROCK); speckle(c, r, x, y, mix("#8A8A92", deep, 0.3), 0.18); c.fillStyle = shade(mix("#8A8A92", deep, 0.3), -0.3); c.fillRect(x + 3, y + 6, 6, 1); c.fillRect(x + 9, y + 11, 5, 1); }
  {
    const { x, y } = at(T.PAD);
    c.fillStyle = "#2A2D3A"; c.fillRect(x, y, 16, 16);
    c.fillStyle = glow; c.fillRect(x + 1, y + 1, 14, 1); c.fillRect(x + 1, y + 14, 14, 1); c.fillRect(x + 1, y + 1, 1, 14); c.fillRect(x + 14, y + 1, 1, 14);
    c.fillStyle = shade(glow, -0.2); c.fillRect(x + 5, y + 5, 6, 6); c.fillStyle = shade(glow, 0.4); c.fillRect(x + 7, y + 7, 2, 2);
  }
  { const { x, y } = at(T.LAVA); speckle(c, r, x, y, "#FF5A1A", 0.2); for (let k = 0; k < 8; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 16), "#FFE07A"); }
  { const { x, y } = at(T.ICE); speckle(c, r, x, y, "#BFE8FF", 0.06); c.fillStyle = "#FFFFFF"; for (let k = 0; k < 5; k++) c.fillRect(x + k * 3, y + 12 - k * 2, 3, 1); }
  bricks(c, r, at(T.BRICK).x, at(T.BRICK).y, "#B8503A", "#6A2A20", 8, 4);
  { const { x, y } = at(T.CLOTH); const cl = trim; speckle(c, r, x, y, cl, 0.05); c.fillStyle = shade(cl, 0.25); for (let k = 0; k < 16; k += 4) c.fillRect(x + k, y, 2, 16); }
  { const { x, y } = at(T.GLASS); c.fillStyle = "#9AF0FF"; c.fillRect(x, y, 16, 16); c.fillStyle = "#E8FCFF"; c.fillRect(x + 2, y + 2, 4, 1); c.fillRect(x + 2, y + 3, 1, 3); c.fillStyle = "#5AB8D8"; c.fillRect(x, y + 15, 16, 1); c.fillRect(x + 15, y, 1, 16); }
  { const { x, y } = at(T.HAY); speckle(c, r, x, y, "#E8C060", 0.12); c.fillStyle = "#B88A30"; for (let k = 1; k < 16; k += 3) c.fillRect(x, y + k, 16, 1); }
  speckle(c, r, at(T.SAND).x, at(T.SAND).y, "#E8C888", 0.1);
  { const { x, y } = at(T.CACTUS); speckle(c, r, x, y, "#4A9A4A", 0.1); c.fillStyle = "#2E6A30"; for (let k = 2; k < 16; k += 4) c.fillRect(x + k, y, 1, 16); for (let k = 0; k < 6; k++) px(c, x + 1 + ((k * 5) % 14), y + ((k * 7) % 15), "#F2F2D0"); }
  { const { x, y } = at(T.NEON); c.fillStyle = "#14102A"; c.fillRect(x, y, 16, 16); c.fillStyle = trim; c.fillRect(x + 1, y + 6, 14, 3); c.fillStyle = shade(trim, 0.5); c.fillRect(x + 1, y + 7, 14, 1); }
  { const { x, y } = at(T.GOLD); speckle(c, r, x, y, "#F2C14E", 0.1); c.fillStyle = "#FFF0A0"; c.fillRect(x + 2, y + 2, 4, 1); c.fillStyle = "#B8861A"; c.fillRect(x, y + 15, 16, 1); }
  { const { x, y } = at(T.MOSS); bricks(c, r, x, y, mix(wall, "#5A8A4A", 0.4), shade(mix(wall, "#5A8A4A", 0.4), -0.3), 8, 4); for (let k = 0; k < 10; k++) px(c, x + Math.floor(r() * 16), y + Math.floor(r() * 6), "#4AA84A"); }
  { const { x, y } = at(T.SNOW); speckle(c, r, x, y, "#F6FAFF", 0.04); }
  { const { x, y } = at(T.DARK); speckle(c, r, x, y, "#2A2D3A", 0.08); c.fillStyle = "#4A4E62"; c.fillRect(x, y, 16, 1); }
  { const { x, y } = at(T.HAZARD); c.fillStyle = "#FFD23F"; c.fillRect(x, y, 16, 16); c.fillStyle = "#1A1A22"; for (let k = -16; k < 16; k += 8) for (let q = 0; q < 16; q++) { const xx = k + q; if (xx >= 0 && xx < 16) c.fillRect(x + xx, y + q, 4, 1); } }
  { const { x, y } = at(T.PLASTER); speckle(c, r, x, y, "#EDE6D8", 0.05); c.fillStyle = "#D0C8B8"; c.fillRect(x, y + 15, 16, 1); }
  { const { x, y } = at(T.ROOF); const rf = trim; for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? shade(rf, -0.1) : rf; c.fillRect(x, y + k * 4, 16, 4); c.fillStyle = shade(rf, -0.35); c.fillRect(x, y + k * 4 + 3, 16, 1); } }
  return pixelTexture(cv);
}
