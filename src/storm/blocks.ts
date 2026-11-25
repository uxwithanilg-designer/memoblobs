// Blockstorm's blocks and their pixel textures. Every block is a 16×16-pixel tile set (top, side, bottom) painted
// here from the world's palette — grass and sand, cobble and brick, bark and planks, glowing gloom veins, the spawner
// cores, boom barrels, coin crates, crystals — so each world gets its own look with no image files. The tiles go into
// one small atlas texture drawn with hard pixel edges.
import type { World } from "./worlds";
import { makeRng, mix, rgb, shade } from "./util";

export const B = {
  AIR: 0, BEDROCK: 1, TOP: 2, SOIL: 3, STONE: 4, STONE2: 5, LOG: 6, PLANK: 7, LEAVES: 8, BRICK: 9, WINDOW: 10, METAL: 11,
  ACCENT: 12, ACCENT2: 13, ROOF: 14, PATH: 15, GLOOM: 16, CORE: 17, BOOM: 18, CHEST: 19, CRYSTAL: 20, LAMP: 21,
  LEAVES2: 22, ICE: 23, PIPE: 24, ROCK: 25, COUNT: 26,
} as const;
type B = number;
export type Mat = "soft" | "wood" | "stone" | "metal" | "glass" | "gloom" | "leaf";

interface BlockDef { hp: number; mat: Mat; tiles: [number, number, number]; glow?: boolean; coins?: number }
// tiles: [top, side, bottom] atlas indices (see TILE below)
const T = {
  topTop: 0, topSide: 1, soil: 2, stone: 3, stone2: 4, bark: 5, ring: 6, plank: 7, leaves: 8, brick: 9, window: 10,
  metal: 11, accent: 12, accent2: 13, roof: 14, path: 15, gloom: 16, core: 17, boomSide: 18, boomTop: 19, chestSide: 20,
  chestTop: 21, crystal: 22, lamp: 23, bedrock: 24, leaves2: 25, ice: 26, pipe: 27, rock: 28,
} as const;
export const ATLAS_COLS = 8, ATLAS_ROWS = 4, TILE = 16;

export const BLOCKS: BlockDef[] = [];
const def = (id: B, d: BlockDef) => { BLOCKS[id] = d; };
def(B.AIR, { hp: 0, mat: "soft", tiles: [0, 0, 0] });
def(B.BEDROCK, { hp: 255, mat: "stone", tiles: [T.bedrock, T.bedrock, T.bedrock] });
def(B.TOP, { hp: 2, mat: "soft", tiles: [T.topTop, T.topSide, T.soil] });
def(B.SOIL, { hp: 2, mat: "soft", tiles: [T.soil, T.soil, T.soil] });
def(B.STONE, { hp: 4, mat: "stone", tiles: [T.stone, T.stone, T.stone] });
def(B.STONE2, { hp: 4, mat: "stone", tiles: [T.stone2, T.stone2, T.stone2] });
def(B.LOG, { hp: 3, mat: "wood", tiles: [T.ring, T.bark, T.ring] });
def(B.PLANK, { hp: 3, mat: "wood", tiles: [T.plank, T.plank, T.plank] });
def(B.LEAVES, { hp: 1, mat: "leaf", tiles: [T.leaves, T.leaves, T.leaves] });
def(B.BRICK, { hp: 4, mat: "stone", tiles: [T.brick, T.brick, T.brick] });
def(B.WINDOW, { hp: 1, mat: "glass", tiles: [T.metal, T.window, T.metal] });
def(B.METAL, { hp: 8, mat: "metal", tiles: [T.metal, T.metal, T.metal] });
def(B.ACCENT, { hp: 3, mat: "soft", tiles: [T.accent, T.accent, T.accent] });
def(B.ACCENT2, { hp: 3, mat: "soft", tiles: [T.accent2, T.accent2, T.accent2] });
def(B.ROOF, { hp: 3, mat: "wood", tiles: [T.roof, T.roof, T.plank] });
def(B.PATH, { hp: 2, mat: "stone", tiles: [T.path, T.soil, T.soil] });
def(B.GLOOM, { hp: 4, mat: "gloom", tiles: [T.gloom, T.gloom, T.gloom] });
def(B.CORE, { hp: 14, mat: "gloom", tiles: [T.core, T.core, T.core], glow: true });
def(B.BOOM, { hp: 1, mat: "wood", tiles: [T.boomTop, T.boomSide, T.boomTop] });
def(B.CHEST, { hp: 2, mat: "wood", tiles: [T.chestTop, T.chestSide, T.plank], coins: 12 });
def(B.CRYSTAL, { hp: 4, mat: "glass", tiles: [T.crystal, T.crystal, T.crystal], glow: true, coins: 6 });
def(B.LAMP, { hp: 2, mat: "glass", tiles: [T.lamp, T.lamp, T.lamp], glow: true });
def(B.LEAVES2, { hp: 1, mat: "leaf", tiles: [T.leaves2, T.leaves2, T.leaves2] });
def(B.ICE, { hp: 2, mat: "glass", tiles: [T.ice, T.ice, T.ice] });
def(B.PIPE, { hp: 6, mat: "metal", tiles: [T.metal, T.pipe, T.metal] });
def(B.ROCK, { hp: 5, mat: "stone", tiles: [T.rock, T.rock, T.rock] });

export const isGlow = (id: number) => !!BLOCKS[id]?.glow;
/** windows light up at night */
export const glowsAt = (id: number, night: boolean) => isGlow(id) || (night && id === B.WINDOW);

// ------------------------------------------------------------------ painting the atlas
type Px = (x: number, y: number) => string;
interface Painter { ctx: CanvasRenderingContext2D; ox: number; oy: number }
function tile(p: Painter, f: Px) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { p.ctx.fillStyle = f(x, y); p.ctx.fillRect(p.ox + x, p.oy + y, 1, 1); }
}

/** paint every tile for a world; returns the canvas and each block's average colour (for debris) */
export function paintAtlas(w: World, night: boolean) {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * TILE; cv.height = ATLAS_ROWS * TILE;
  const ctx = cv.getContext("2d")!;
  const P = w.pal;
  const r = makeRng(w.seed);
  const at = (i: number): Painter => ({ ctx, ox: (i % ATLAS_COLS) * TILE, oy: Math.floor(i / ATLAS_COLS) * TILE });
  const sp = (base: string, amt: number, dens = 0.45) => () => { const v = r(); return v < dens ? shade(base, (r() - 0.5) * amt * 2) : base; };

  // ---- the ground top (grass / sand / snow / moss / metal / candy / rock / neon / cloud)
  const topPx: Px = (x, y) => {
    const v = r();
    switch (w.topKind) {
      case "sand": return v < 0.35 ? shade(P.top, (r() - 0.5) * 0.18) : v < 0.4 ? shade(P.top, -0.16) : P.top;
      case "snow": return v < 0.25 ? mix(P.top, "#BFD8FF", 0.35) : v < 0.3 ? "#ffffff" : P.top;
      case "metal": return x === 0 || y === 0 ? shade(P.top, 0.18) : x === 15 || y === 15 ? shade(P.top, -0.25) : (x === 2 || x === 13) && (y === 2 || y === 13) ? shade(P.top, -0.35) : v < 0.2 ? shade(P.top, (r() - 0.5) * 0.08) : P.top;
      case "candy": return v < 0.06 ? ["#FF6FA8", "#7FE3FF", "#FFE45C", "#9BFF7A"][Math.floor(r() * 4)] : v < 0.35 ? shade(P.top, 0.06) : P.top;
      case "neon": return x % 8 === 0 || y % 8 === 0 ? P.accent : v < 0.2 ? shade(P.top, 0.05) : P.top;
      case "rock": return v < 0.5 ? shade(P.top, (r() - 0.5) * 0.3) : P.top;
      case "cloud": return v < 0.3 ? shade(P.top, -0.05) : P.top;
      default: return v < 0.3 ? shade(P.top, 0.12) : v < 0.55 ? shade(P.top, -0.1) : v < 0.58 ? mix(P.top, "#ffffff", 0.35) : P.top;
    }
  };
  tile(at(T.topTop), topPx);
  // the side: soil with a ragged fringe of the top colour
  const fringe = Array.from({ length: TILE }, () => 2 + Math.floor(r() * 3));
  const soilPx = sp(P.soil, 0.16, 0.5);
  tile(at(T.topSide), (x, y) => (y < fringe[x] ? (y === fringe[x] - 1 ? shade(P.top, -0.15) : topPx(x, y)) : soilPx()));
  tile(at(T.soil), () => soilPx());
  // stone: blotches and a few cracks
  tile(at(T.stone), (x, y) => { const v = r(); const crack = (x + y * 3) % 11 === 0 && r() < 0.6; return crack ? shade(P.stone, -0.3) : v < 0.35 ? shade(P.stone, (r() - 0.5) * 0.26) : P.stone; });
  // cobble: irregular stones with dark seams
  {
    const seeds = Array.from({ length: 9 }, () => [r() * 16, r() * 16, (r() - 0.5) * 0.25] as const);
    tile(at(T.stone2), (x, y) => {
      let b = 1e9, b2 = 1e9, k = 0;
      seeds.forEach(([sx, sy], i) => { for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) { const d = (x - sx - ox) ** 2 + (y - sy - oy) ** 2; if (d < b) { b2 = b; b = d; k = i; } else if (d < b2) b2 = d; } });
      return Math.sqrt(b2) - Math.sqrt(b) < 1.1 ? shade(P.stone2, -0.38) : shade(P.stone2, seeds[k][2] + (r() - 0.5) * 0.08);
    });
  }
  // bark: vertical streaks
  const barkCols = Array.from({ length: TILE }, () => (r() - 0.5) * 0.3);
  tile(at(T.bark), (x) => { const v = r(); return x % 4 === 0 && v < 0.7 ? shade(P.bark, -0.28) : shade(P.bark, barkCols[x] + (v - 0.5) * 0.06); });
  // log ends: rings
  tile(at(T.ring), (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 7 ? shade(P.bark, -0.1) : Math.floor(d) % 3 === 0 ? shade(P.ring, -0.2) : shade(P.ring, (r() - 0.5) * 0.08); });
  // planks: four boards with seams and nails
  tile(at(T.plank), (x, y) => { const row = Math.floor(y / 4), seam = y % 4 === 3, off = (row * 7) % 16; const end = (x + off) % 16 === 0; return seam || end ? shade(P.plank, -0.32) : (x + off) % 16 === 2 && y % 4 === 1 ? shade(P.plank, -0.45) : shade(P.plank, (row % 2 ? 0.05 : -0.04) + (r() - 0.5) * 0.08); });
  // leaves: dense, holes darker
  const leafPx = (base: string) => () => { const v = r(); return v < 0.18 ? shade(base, -0.35) : v < 0.45 ? shade(base, 0.12) : v < 0.5 ? mix(base, "#fffbe0", 0.3) : base; };
  tile(at(T.leaves), leafPx(P.leaves));
  tile(at(T.leaves2), leafPx(P.leaves2));
  // bricks
  tile(at(T.brick), (x, y) => { const row = Math.floor(y / 4), off = row % 2 ? 4 : 0; return y % 4 === 3 || (x + off) % 8 === 7 ? P.mortar : shade(P.brick, (r() - 0.5) * 0.16 + (row % 2 ? 0.04 : -0.02)); });
  // windows: frame, panes, a highlight; warm and bright at night
  {
    const glass = night ? "#FFD97A" : P.window;
    tile(at(T.window), (x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13) return shade(P.metal, -0.1); if (x === 7 || x === 8 || y === 7 || y === 8) return shade(P.metal, -0.25); return (x - y === 2 || x - y === 3) && x < 7 && y < 7 ? mix(glass, "#ffffff", 0.6) : shade(glass, (y - 8) * (night ? 0.01 : 0.02)); });
  }
  // metal plates with rivets
  tile(at(T.metal), (x, y) => { if (x === 0 || y === 0) return shade(P.metal, 0.22); if (x === 15 || y === 15) return shade(P.metal, -0.3); if ((x === 2 || x === 13) && (y === 2 || y === 13)) return shade(P.metal, 0.35); return (x + y) % 9 === 0 ? shade(P.metal, 0.08) : shade(P.metal, (r() - 0.5) * 0.06); });
  tile(at(T.pipe), (x, y) => { void x; return y % 8 === 0 || y % 8 === 7 ? shade(P.metal, -0.3) : y % 8 === 1 ? shade(P.metal, 0.3) : shade(P.metal, 0.05 - Math.abs(y % 8 - 3.5) * 0.04); });
  // accents: woven / striped
  tile(at(T.accent), (x, y) => ((x >> 1) + (y >> 1)) % 2 ? shade(P.accent, -0.08 + (r() - 0.5) * 0.06) : shade(P.accent, 0.06));
  tile(at(T.accent2), (x, y) => { void x; return y % 6 < 3 ? P.accent2 : shade(P.accent2, -0.18); });
  // roof shingles
  tile(at(T.roof), (x, y) => { const row = Math.floor(y / 4), off = row % 2 ? 3 : 0; return y % 4 === 3 ? shade(P.roof, -0.38) : (x + off) % 6 === 0 ? shade(P.roof, -0.22) : shade(P.roof, (3 - (y % 4)) * 0.05 + (r() - 0.5) * 0.05); });
  // path: worn flat cobbles
  tile(at(T.path), (x, y) => { const e = (x % 5 === 0 && y % 2) || (y % 5 === 0 && x % 2); return e ? shade(P.path, -0.2) : shade(P.path, (r() - 0.5) * 0.14); });
  // gloom: corrupted dark block with glowing veins
  {
    const vein = (x: number, y: number) => Math.abs(Math.sin(x * 0.9 + y * 0.35) * 3 + 8 - y) < 0.9 || Math.abs(Math.cos(y * 0.7) * 3 + 8 - x) < 0.8;
    tile(at(T.gloom), (x, y) => vein(x, y) ? (r() < 0.3 ? "#ffffff" : P.core) : shade(P.gloom, (r() - 0.5) * 0.2));
  }
  // core: a glowing eye in a socket
  tile(at(T.core), (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); if (x === 0 || y === 0 || x === 15 || y === 15) return shade(P.gloom, -0.2); if (d < 2.2) return "#1a0820"; if (d < 3.4) return "#ffffff"; if (d < 6) return mix(P.core, "#ffffff", 0.25 - d * 0.02); return shade(P.core, -0.25 + (r() - 0.5) * 0.15); });
  // boom barrel: red with a hazard band; lid on top
  tile(at(T.boomSide), (x, y) => { if (y >= 6 && y <= 9) return (x + y) % 4 < 2 ? "#1d1d24" : "#FFC83D"; if (y === 0 || y === 15 || y === 3 || y === 12) return "#8E1B1B"; return x % 5 === 0 ? "#C22B2B" : (x === 2 ? "#FF7A6A" : "#E23B3B"); });
  tile(at(T.boomTop), (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 7.2 ? "#8E1B1B" : d > 6 ? "#B92626" : d < 2 ? "#FFC83D" : "#D63030"; });
  // coin crate
  tile(at(T.chestSide), (x, y) => { if (x < 2 || x > 13 || y < 2 || y > 13) return "#6B4524"; if ((x >= 6 && x <= 9) && (y >= 5 && y <= 9)) return y === 5 || x === 6 ? "#FFF1A8" : "#F5B82E"; return y % 4 === 1 ? "#7C5130" : shade("#A06A3C", (r() - 0.5) * 0.1); });
  tile(at(T.chestTop), (x, y) => { if ((x < 3 || x > 12) && (y < 3 || y > 12)) return "#F5B82E"; if (x < 1 || x > 14 || y < 1 || y > 14) return "#6B4524"; return x % 5 === 2 ? "#7C5130" : shade("#A06A3C", (r() - 0.5) * 0.1); });
  // crystal facets
  tile(at(T.crystal), (x, y) => { const f = ((x + y) >> 2) % 3; return f === 0 ? mix(P.crystal, "#ffffff", 0.45) : f === 1 ? P.crystal : shade(P.crystal, -0.3); });
  // lamp: frame around a glowing core
  tile(at(T.lamp), (x, y) => { if (x < 2 || x > 13 || y < 1 || y > 14) return "#3A3346"; if (x === 2 || x === 13 || y === 2 || y === 13) return "#6B5E7A"; const d = Math.hypot(x - 7.5, y - 7.5); return d < 3 ? "#FFFDE8" : mix(P.lamp, "#ffffff", 0.3 - d * 0.04); });
  tile(at(T.bedrock), () => shade("#2A2633", (r() - 0.5) * 0.5));
  tile(at(T.ice), (x, y) => { const s = (x + y * 2) % 13; return s === 0 || s === 1 ? "#FFFFFF" : shade(P.ice, (r() - 0.5) * 0.08 + (y / 16) * -0.1); });
  tile(at(T.rock), () => { const v = r(); return v < 0.4 ? shade(P.rock, (r() - 0.5) * 0.35) : v < 0.45 ? shade(P.rock, -0.4) : P.rock; });

  // each block's average side colour, for debris
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const avg = new Float32Array(B.COUNT * 3);
  for (let id = 1; id < B.COUNT; id++) {
    const t = BLOCKS[id].tiles[1];
    const ox = (t % ATLAS_COLS) * TILE, oy = Math.floor(t / ATLAS_COLS) * TILE;
    let R = 0, G = 0, Bl = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const i = ((oy + y) * cv.width + ox + x) * 4; R += data[i]; G += data[i + 1]; Bl += data[i + 2]; }
    const n = TILE * TILE * 255;
    avg[id * 3] = R / n; avg[id * 3 + 1] = G / n; avg[id * 3 + 2] = Bl / n;
  }
  return { canvas: cv, avg };
}

/** a colour for UI swatches */
export const swatch = (hex: string) => { const [r, g, b] = rgb(hex); return `rgb(${r},${g},${b})`; };
