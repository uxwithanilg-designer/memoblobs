// Cube Clash's blocks and their pixel textures: a clean "toy block" look — every 16×16 tile gets a bevel (a light top
// and left edge, a darker bottom and right edge) so each block reads as a chunky cube, over calm two-tone pixel
// patterns: grass tufts, pebbled stone, bevelled planks, leaf clumps, rounded bricks, glass with glints, team-coloured
// building cubes, gold ore, loot chests, lava swirls, glowing jump pads, shooting targets, checkpoint and finish pads.
// Each map theme repaints the atlas from its palette; nothing is downloaded.
import type { Theme } from "./worlds";
import { makeRng, mix, shade } from "./util";

export const B = {
  AIR: 0, ANCHOR: 1, GRASS: 2, SOIL: 3, STONE: 4, SAND: 5, SNOW: 6, LOG: 7, PLANK: 8, LEAVES: 9, BRICK: 10, GLASS: 11, METAL: 12,
  CUBE_BLUE: 13, CUBE_RED: 14, CUBE_GREEN: 15, CUBE_GOLD: 16, ORE: 17, CHEST: 18, LAVA: 19, PAD: 20, TARGET: 21, CHECK: 22,
  FINISH: 23, LAMP: 24, ICE: 25, CLOUD: 26, ACCENT: 27, ROOF: 28, COUNT: 29,
} as const;
/** the building cube of each team (0 blue = you, 1 red, 2 green, 3 gold) */
export const TEAM_CUBE = [B.CUBE_BLUE, B.CUBE_RED, B.CUBE_GREEN, B.CUBE_GOLD];
export type Mat = "soft" | "wood" | "stone" | "metal" | "glass" | "cube" | "leaf";
interface BlockDef { hp: number; mat: Mat; tiles: [number, number, number]; glow?: boolean; coins?: number }

const T = {
  grassTop: 0, grassSide: 1, soil: 2, stone: 3, sand: 4, snowTop: 5, snowSide: 6, bark: 7, ring: 8, plank: 9, leaves: 10, brick: 11,
  glass: 12, metal: 13, cubeBlue: 14, cubeRed: 15, cubeGreen: 16, cubeGold: 17, ore: 18, chestSide: 19, chestTop: 20, lava: 21,
  padTop: 22, target: 23, checkTop: 24, finishTop: 25, lamp: 26, ice: 27, cloud: 28, accent: 29, roof: 30, anchor: 31,
} as const;
export const ATLAS_COLS = 8, ATLAS_ROWS = 4, TILE = 16;
export const BLOCKS: BlockDef[] = [];
const def = (id: number, d: BlockDef) => { BLOCKS[id] = d; };
def(B.AIR, { hp: 0, mat: "soft", tiles: [0, 0, 0] });
def(B.ANCHOR, { hp: 255, mat: "stone", tiles: [T.anchor, T.anchor, T.anchor] });
def(B.GRASS, { hp: 2, mat: "soft", tiles: [T.grassTop, T.grassSide, T.soil] });
def(B.SOIL, { hp: 2, mat: "soft", tiles: [T.soil, T.soil, T.soil] });
def(B.STONE, { hp: 4, mat: "stone", tiles: [T.stone, T.stone, T.stone] });
def(B.SAND, { hp: 1, mat: "soft", tiles: [T.sand, T.sand, T.sand] });
def(B.SNOW, { hp: 1, mat: "soft", tiles: [T.snowTop, T.snowSide, T.soil] });
def(B.LOG, { hp: 3, mat: "wood", tiles: [T.ring, T.bark, T.ring] });
def(B.PLANK, { hp: 2, mat: "wood", tiles: [T.plank, T.plank, T.plank] });
def(B.LEAVES, { hp: 1, mat: "leaf", tiles: [T.leaves, T.leaves, T.leaves] });
def(B.BRICK, { hp: 4, mat: "stone", tiles: [T.brick, T.brick, T.brick] });
def(B.GLASS, { hp: 1, mat: "glass", tiles: [T.glass, T.glass, T.glass] });
def(B.METAL, { hp: 7, mat: "metal", tiles: [T.metal, T.metal, T.metal] });
def(B.CUBE_BLUE, { hp: 2, mat: "cube", tiles: [T.cubeBlue, T.cubeBlue, T.cubeBlue] });
def(B.CUBE_RED, { hp: 2, mat: "cube", tiles: [T.cubeRed, T.cubeRed, T.cubeRed] });
def(B.CUBE_GREEN, { hp: 2, mat: "cube", tiles: [T.cubeGreen, T.cubeGreen, T.cubeGreen] });
def(B.CUBE_GOLD, { hp: 2, mat: "cube", tiles: [T.cubeGold, T.cubeGold, T.cubeGold] });
def(B.ORE, { hp: 4, mat: "stone", tiles: [T.ore, T.ore, T.ore], coins: 5 });
def(B.CHEST, { hp: 2, mat: "wood", tiles: [T.chestTop, T.chestSide, T.plank], coins: 10 });
def(B.LAVA, { hp: 255, mat: "stone", tiles: [T.lava, T.lava, T.lava], glow: true });
def(B.PAD, { hp: 255, mat: "metal", tiles: [T.padTop, T.metal, T.metal], glow: true });
def(B.TARGET, { hp: 3, mat: "wood", tiles: [T.target, T.target, T.target], glow: true });
def(B.CHECK, { hp: 255, mat: "metal", tiles: [T.checkTop, T.metal, T.metal], glow: true });
def(B.FINISH, { hp: 255, mat: "metal", tiles: [T.finishTop, T.metal, T.metal], glow: true });
def(B.LAMP, { hp: 2, mat: "glass", tiles: [T.lamp, T.lamp, T.lamp], glow: true });
def(B.ICE, { hp: 2, mat: "glass", tiles: [T.ice, T.ice, T.ice] });
def(B.CLOUD, { hp: 1, mat: "soft", tiles: [T.cloud, T.cloud, T.cloud] });
def(B.ACCENT, { hp: 3, mat: "stone", tiles: [T.accent, T.accent, T.accent] });
def(B.ROOF, { hp: 3, mat: "wood", tiles: [T.roof, T.roof, T.plank] });
export const isGlow = (id: number) => !!BLOCKS[id]?.glow;
export const glowsAt = (id: number, night: boolean) => isGlow(id) || (night && id === B.GLASS);
export const unbreakable = (id: number) => (BLOCKS[id]?.hp ?? 0) >= 255;

// ------------------------------------------------------------------ painting
type Px = (x: number, y: number) => string;
export const TEAM_COLORS = ["#3D8BFF", "#FF4D5E", "#38D96B", "#FFC83D"];

export function paintAtlas(t: Theme, night: boolean) {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * TILE; cv.height = ATLAS_ROWS * TILE;
  const ctx = cv.getContext("2d")!;
  const P = t.pal;
  const r = makeRng(t.seed);
  const tile = (i: number, f: Px, bevel = 0.14) => {
    const ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let c = f(x, y);
      // the toy-block bevel
      if (bevel) { if (x === 0 || y === 0) c = shade(c, bevel); else if (x === 15 || y === 15) c = shade(c, -bevel * 1.4); }
      ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  };
  /** calm two-tone dither */
  const dith = (a: string, amt = 0.05) => (x: number, y: number) => ((x * 7 + y * 13 + Math.floor(r() * 3)) % 5 === 0 ? shade(a, amt) : (x + y * 3) % 7 === 0 ? shade(a, -amt) : a);
  // grass: tufts on top; the side is soil under a scalloped fringe
  const tufts = Array.from({ length: 6 }, () => [Math.floor(r() * 14) + 1, Math.floor(r() * 14) + 1]);
  tile(T.grassTop, (x, y) => (tufts.some(([tx, ty]) => (x === tx && (y === ty || y === ty + 1)) || (x === tx + 1 && y === ty + 1)) ? shade(P.top, 0.14) : dith(P.top, 0.04)(x, y)));
  const soilPx = (x: number, y: number) => ((x * 5 + y * 3) % 11 === 0 ? shade(P.soil, -0.12) : (x * 3 + y * 7) % 13 === 0 ? shade(P.soil, 0.1) : P.soil);
  tile(T.grassSide, (x, y) => (y < 4 + ((x >> 1) % 2) ? (y === 3 + ((x >> 1) % 2) ? shade(P.top, -0.18) : P.top) : soilPx(x, y)));
  tile(T.soil, soilPx);
  // stone: soft pebbles
  const pebbles = Array.from({ length: 5 }, () => [r() * 16, r() * 16, 2.2 + r() * 2]);
  tile(T.stone, (x, y) => { for (const [px, py, pr] of pebbles) { const d = Math.hypot(x - px, y - py); if (d < pr) return d > pr - 1 ? shade(P.stone, -0.16) : shade(P.stone, 0.07); } return P.stone; });
  tile(T.sand, (x, y) => ((x + y * 2) % 6 === 0 ? shade(P.sand, -0.08) : (x * 3 + y) % 9 === 0 ? shade(P.sand, 0.08) : P.sand));
  tile(T.snowTop, (x, y) => ((x * 3 + y * 5) % 17 === 0 ? "#DDEBFF" : "#F7FBFF"));
  tile(T.snowSide, (x, y) => (y < 5 + ((x >> 2) % 2) ? "#F7FBFF" : soilPx(x, y)));
  tile(T.bark, (x, y) => (x % 4 === 1 ? shade(P.bark, -0.2) : (y + x * 5) % 9 === 0 ? shade(P.bark, 0.12) : P.bark));
  tile(T.ring, (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 6.8 ? P.bark : Math.floor(d) % 3 === 0 ? shade(P.ring, -0.15) : P.ring; });
  tile(T.plank, (x, y) => { const row = Math.floor(y / 4); return y % 4 === 3 ? shade(P.plank, -0.3) : y % 4 === 0 ? shade(P.plank, 0.12) : (x + row * 5) % 16 === 0 ? shade(P.plank, -0.25) : shade(P.plank, row % 2 ? 0.03 : -0.03); }, 0.1);
  // leaves: round clumps
  const clumps = Array.from({ length: 7 }, () => [r() * 16, r() * 16, 2.5 + r() * 2.5]);
  tile(T.leaves, (x, y) => { let c = shade(P.leaves, -0.16); for (const [cx, cy, cr] of clumps) { const d = Math.hypot(x - cx, y - cy); if (d < cr) c = d < cr - 1.2 ? (x - cx < -0.5 && y - cy < -0.5 ? shade(P.leaves, 0.16) : P.leaves) : shade(P.leaves, -0.05); } return c; });
  tile(T.brick, (x, y) => { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0, inBrick = y % 4 !== 3 && (x + off) % 8 !== 7; if (!inBrick) return P.mortar; return y % 4 === 0 ? shade(P.brick, 0.12) : P.brick; }, 0.08);
  tile(T.glass, (x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15 || x === 1 || y === 1) return shade(P.metal, -0.1); const g = night ? "#FFE08A" : P.glass; return (x - y === 3 || x - y === 4 || x - y === -6) ? mix(g, "#ffffff", 0.7) : g; }, 0);
  tile(T.metal, (x, y) => ((x === 2 || x === 13) && (y === 2 || y === 13) ? shade(P.metal, 0.3) : (x + y) % 8 === 0 ? shade(P.metal, 0.05) : P.metal), 0.2);
  // team cubes: a solid colour with a soft inner square
  const cube = (i: number, c: string) => tile(i, (x, y) => { const ix = x >= 4 && x <= 11 && y >= 4 && y <= 11; return ix ? (x === 4 || y === 4 ? shade(c, -0.12) : x === 11 || y === 11 ? shade(c, 0.12) : c) : shade(c, 0.04); }, 0.22);
  cube(T.cubeBlue, TEAM_COLORS[0]); cube(T.cubeRed, TEAM_COLORS[1]); cube(T.cubeGreen, TEAM_COLORS[2]); cube(T.cubeGold, TEAM_COLORS[3]);
  const nuggets = Array.from({ length: 6 }, () => [Math.floor(r() * 12) + 2, Math.floor(r() * 12) + 2]);
  tile(T.ore, (x, y) => { for (const [nx, ny] of nuggets) { if (Math.abs(x - nx) + Math.abs(y - ny) <= 1) return x === nx && y === ny - 1 ? "#FFF6B0" : "#FFC83D"; } return P.stone; });
  tile(T.chestSide, (x, y) => { if (y === 6 || y === 7) return "#FFC83D"; if (x >= 7 && x <= 8 && y >= 5 && y <= 9) return y === 9 ? "#8A5A12" : "#FFE27A"; return y % 5 === 0 ? shade("#B06E3A", -0.2) : "#B06E3A"; }, 0.16);
  tile(T.chestTop, (x, y) => ((x < 2 || x > 13) && (y < 2 || y > 13) ? "#FFC83D" : x % 5 === 2 ? shade("#B06E3A", -0.18) : "#B06E3A"), 0.16);
  tile(T.lava, (x, y) => { const v = Math.sin(x * 0.7 + y * 0.4) + Math.cos(y * 0.8 - x * 0.3); return v > 1.1 ? "#FFE45C" : v > 0.2 ? "#FF8A2A" : "#E2361E"; }, 0);
  tile(T.padTop, (x, y) => { const c = Math.abs(x - 7.5) + (y % 6) * 1.2; return c < 4 && c > 1.6 ? "#B6FF5C" : x === 0 || y === 0 || x === 15 || y === 15 ? "#3A4A5A" : "#2EC4B6"; }, 0);
  tile(T.target, (x, y) => { const d = Math.floor(Math.hypot(x - 7.5, y - 7.5)); return d >= 7 ? "#FFFFFF" : d % 3 === 0 ? "#FF3B4E" : d % 3 === 1 ? "#FFFFFF" : "#FF3B4E"; }, 0);
  tile(T.checkTop, (x, y) => { if (x >= 5 && x <= 6 && y >= 3 && y <= 12) return "#FFFFFF"; if (x >= 7 && x <= 11 && y >= 3 && y <= 7) return "#FFC83D"; return (x + y) % 2 ? "#38D96B" : "#2FBF5E"; }, 0.1);
  tile(T.finishTop, (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? "#14141C" : "#FFFFFF"), 0);
  tile(T.lamp, (x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13) return "#3A3346"; const d = Math.hypot(x - 7.5, y - 7.5); return d < 3 ? "#FFFDE8" : mix(P.lamp, "#ffffff", 0.3 - d * 0.04); }, 0);
  tile(T.ice, (x, y) => ((x + y * 2) % 11 === 0 ? "#FFFFFF" : shade(P.ice, -y * 0.008)), 0.18);
  tile(T.cloud, (x, y) => ((x * 3 + y * 7) % 13 === 0 ? "#E6EEF8" : "#FFFFFF"), 0.06);
  tile(T.accent, (x, y) => (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 5 ? shade(P.accent, 0.12) : P.accent), 0.14);
  tile(T.roof, (x, y) => { const row = Math.floor(y / 4), off = row % 2 ? 2 : 0; return y % 4 === 3 ? shade(P.roof, -0.3) : (x + off) % 4 === 0 ? shade(P.roof, -0.12) : y % 4 === 0 ? shade(P.roof, 0.1) : P.roof; }, 0.06);
  tile(T.anchor, (x, y) => ((x * 7 + y * 3) % 5 === 0 ? "#4A3E6E" : (x + y) % 4 === 0 ? "#2B2440" : "#362D52"), 0.1);

  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const avg = new Float32Array(B.COUNT * 3);
  for (let id = 1; id < B.COUNT; id++) {
    const tt = BLOCKS[id].tiles[1];
    const ox = (tt % ATLAS_COLS) * TILE, oy = Math.floor(tt / ATLAS_COLS) * TILE;
    let R = 0, G = 0, Bl = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const i = ((oy + y) * cv.width + ox + x) * 4; R += data[i]; G += data[i + 1]; Bl += data[i + 2]; }
    const n = TILE * TILE * 255;
    avg[id * 3] = R / n; avg[id * 3 + 1] = G / n; avg[id * 3 + 2] = Bl / n;
  }
  return { canvas: cv, avg };
}
