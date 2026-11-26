// A stage's arena: a square of 1 m blocks (heights in half blocks), shaped by the stage's layout — rolling hills, a
// plaza with raised platforms, a fort with walls, towers and gates, a canyon between two ridges, islands in water (or
// over the void in the sky, or in lava at the foundry), a ring rampart round a pit, a maze of cover walls, stepped
// terraces — then dressed with cover (crates, barrels, low walls), the world's props (trees, cacti, lamps, cars,
// pipes, domes, windmills…), a wall of cliffs or ramparts around the edge, the squad's landing pad and the robots'
// teleport gates. Everything is merged into one mesh drawn with the world's pixel block atlas. The same grid answers
// the game's questions: how high is the ground here, is this cell solid up to that height, is it water, lava or void.
import * as THREE from "three";
import type { StagePlan } from "./stages";
import { worldOf, type PropKind, type World } from "./worlds";
import { chance, makeRng, noise1, pick, range, type Rng } from "./util";
import { Builder, rectUv, type Face } from "./art/voxel";
import { ATLAS, T, tileRect } from "./art/atlas";

export const CELL_GROUND = 0, CELL_WATER = 1, CELL_LAVA = 2, CELL_VOID = 3, CELL_PAD = 4, CELL_GATE = 5, CELL_PATH = 6;

export interface Spot { x: number; z: number }
export interface Windmill { x: number; y: number; z: number; s: number }
export interface Arena {
  plan: StagePlan; world: World; partner: World | null;
  n: number; half: number;
  /** ground height and solid top (ground + whatever stands on it), per cell */
  ground: Float32Array; solid: Float32Array; kind: Uint8Array;
  liquid: number;
  spawn: Spot; gates: Spot[]; spots: Spot[];
  mills: Windmill[];
  geometry: THREE.BufferGeometry;
}

export function cellOf(a: Arena, x: number, z: number) {
  const i = Math.round(x + a.half), j = Math.round(z + a.half);
  return i < 0 || j < 0 || i >= a.n || j >= a.n ? -1 : j * a.n + i;
}
/** the top of the ground (or what stands on it) under a point; outside the arena: a high wall */
export function solidAt(a: Arena, x: number, z: number) { const c = cellOf(a, x, z); return c < 0 ? 30 : a.solid[c]; }
export function groundAt(a: Arena, x: number, z: number) { const c = cellOf(a, x, z); return c < 0 ? 30 : a.ground[c]; }
export function kindAt(a: Arena, x: number, z: number) { const c = cellOf(a, x, z); return c < 0 ? CELL_GROUND : a.kind[c]; }
/** the highest solid top under a round footprint */
export function floorUnder(a: Arena, x: number, z: number, r: number) {
  return Math.max(solidAt(a, x - r, z - r), solidAt(a, x + r, z - r), solidAt(a, x - r, z + r), solidAt(a, x + r, z + r));
}
/** is the straight line between two points clear of the blocks? (for sight and aim) */
export function clearLine(a: Arena, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.ceil(d / 0.4);
  for (let k = 1; k < n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    if (y < solidAt(a, x, z)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- generation
interface Gen { n: number; half: number; g: Float32Array; s: Float32Array; k: Uint8Array; prop: (PropKind | null)[]; seed: Int32Array; r: Rng }

function shapeLayout(G: Gen, plan: StagePlan, w: World) {
  const { n, half, g, r } = G;
  const n1 = noise1(plan.seed + 1), n2 = noise1(plan.seed + 2), n3 = noise1(plan.seed + 3);
  const q = (v: number) => Math.round(v * 2) / 2;
  const lowKind = w.id === "sky" ? CELL_VOID : w.lava ? CELL_LAVA : w.water ? CELL_WATER : -1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i - half, z = j - half, c = j * n + i;
    const d = Math.hypot(x, z) / half;
    let h = 0;
    switch (plan.layout) {
      case "hills": h = Math.max(0, q((n1(x / 9 + 3) * 0.6 + n2(z / 9 + 7) * 0.6 + n3((x + z) / 4) * 0.25) * 2.2 + 0.6)); break;
      case "plaza": h = 0; break;
      case "fort": h = q(Math.max(0, n1(x / 12) * 0.5 + n2(z / 12) * 0.5) * 0.8); break;
      case "canyon": { const ax = Math.abs(x) / half; h = ax > 0.55 ? q(2.5 + (ax - 0.55) * 8 + n1(z / 6) * 0.8) : q(Math.max(0, n2(z / 8) * 0.4)); break; }
      case "islands": h = -1; break;
      case "ring": h = d < 0.28 ? -1 : d < 0.42 ? q(-1 + (d - 0.28) * 7) : q(Math.max(0, n1(x / 8) * 0.5 + 0.3)); break;
      case "maze": h = 0; break;
      case "terraces": { const t = (z + half) / (2 * half); h = Math.floor(t * 4) * 1 + (n3(x / 6) > 0.6 ? 0.5 : 0); break; }
    }
    g[c] = h;
  }
  if (plan.layout === "islands") {
    const count = 4 + Math.floor(r() * 3);
    const isles: { x: number; z: number; r: number; h: number }[] = [{ x: 0, z: -half * 0.62, r: half * 0.36, h: 0.5 }];
    for (let k = 0; k < count; k++) isles.push({ x: range(r, -half * 0.6, half * 0.6), z: range(r, -half * 0.3, half * 0.7), r: range(r, half * 0.2, half * 0.34), h: q(range(r, 0.5, 2.5)) });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i - half, z = j - half, c = j * n + i;
      for (const s of isles) { const dd = Math.hypot(x - s.x, z - s.z) + n1(x * 0.3 + z * 0.2) * 1.5; if (dd < s.r) g[c] = Math.max(g[c], s.h); }
    }
    // causeways between neighbouring islands
    for (let k = 1; k < isles.length; k++) {
      const a = isles[k], b = isles[(k * 3) % isles.length === k ? 0 : (k + 1) % isles.length];
      for (let t = 0; t <= 1; t += 0.02) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; for (let w2 = -1; w2 <= 1; w2++) { const c = cellIdx(G, x + w2 * 0.6, z); if (c >= 0 && g[c] < 0) g[c] = 0.5; } }
    }
  }
  if (plan.layout === "fort") {
    const s = Math.round(half * 0.42);
    for (let j = -s; j <= s; j++) for (let i = -s; i <= s; i++) {
      const edge = Math.abs(i) === s || Math.abs(j) === s, corner = Math.abs(i) >= s - 1 && Math.abs(j) >= s - 1;
      const gate = (Math.abs(i) <= 1 && Math.abs(j) === s) || (Math.abs(j) <= 1 && Math.abs(i) === s);
      const c = cellIdx(G, i, j);
      if (c < 0) continue;
      if (corner) G.s[c] = 4; else if (edge && !gate) G.s[c] = 2.5; else g[c] = Math.max(g[c], 0.5);
    }
  }
  if (plan.layout === "maze") {
    for (let k = 0; k < Math.round(half * 1.4); k++) {
      const x0 = Math.round(range(r, -half + 4, half - 4)), z0 = Math.round(range(r, -half + 6, half - 3)), len = 3 + Math.floor(r() * 5), horiz = chance(r, 0.5);
      for (let t = 0; t < len; t++) { const c = cellIdx(G, x0 + (horiz ? t : 0), z0 + (horiz ? 0 : t)); if (c >= 0) G.s[c] = chance(r, 0.25) ? 1 : 2; }
    }
  }
  // the low ground becomes water, lava or the void where the world has it; elsewhere a dip
  for (let c = 0; c < n * n; c++) {
    if (g[c] < 0) {
      if (lowKind >= 0) { G.k[c] = lowKind; g[c] = lowKind === CELL_VOID ? -30 : -1; }
      else g[c] = -0.5;
    }
  }
}
function cellIdx(G: { n: number; half: number }, x: number, z: number) {
  const i = Math.round(x + G.half), j = Math.round(z + G.half);
  return i < 0 || j < 0 || i >= G.n || j >= G.n ? -1 : j * G.n + i;
}

const PROP_H: Record<PropKind, number> = {
  tree: 5, pine: 5.5, palm: 5.5, bush: 1, rock: 1.5, crate: 1, barrel: 1, fence: 1, hay: 1, windmill: 8, cactus: 2.5, ruin: 3,
  icespike: 3, lamp: 3.5, car: 1.5, sign: 3, vine: 4, idol: 3, pipe: 2, tank: 3, lifebuoy: 1.5, hut: 3, balloon: 7, antenna: 5,
  dome: 3, crystal: 2, pylon: 4, statue: 4.5, mushroom: 3,
};

export function buildArena(plan: StagePlan): Arena {
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const half = plan.size, n = half * 2 + 1;
  const r = makeRng(plan.seed + 77);
  const G: Gen = { n, half, g: new Float32Array(n * n), s: new Float32Array(n * n), k: new Uint8Array(n * n), prop: new Array(n * n).fill(null), seed: new Int32Array(n * n), r };
  shapeLayout(G, plan, world);
  const { g, s, k } = G;
  // the edge: cliffs / ramparts all round (two cells thick)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const e = Math.min(i, j, n - 1 - i, n - 1 - j);
    const c = j * n + i;
    // a low rampart, so the world's scenery shows over it (past it an invisible wall keeps everyone in)
    if (e < 2) { k[c] = CELL_GROUND; g[c] = Math.max(g[c], 0) + (e === 0 ? 2.5 + ((i * 7 + j * 3) % 3) * 0.5 : 1.5); }
  }
  // the squad's landing pad (south) and the robots' gates (north and the sides)
  const spawn = { x: 0, z: -half + 7 };
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = cellIdx(G, spawn.x + i, spawn.z + j); g[c] = 0.5; s[c] = 0; k[c] = CELL_PAD; }
  const gates: Spot[] = [];
  const gateSpots = [[0, half - 4], [-half + 5, half - 6], [half - 5, half - 6], [-half + 4, 2], [half - 4, 2]];
  const nGates = Math.min(gateSpots.length, 2 + Math.floor(plan.difficulty * 3));
  for (let q = 0; q < nGates; q++) {
    const [gx, gz] = gateSpots[q];
    const base = Math.max(0, g[cellIdx(G, gx, gz)]);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = cellIdx(G, gx + i, gz + j); g[c] = base; s[c] = 0; k[c] = CELL_GATE; }
    gates.push({ x: gx, z: gz });
  }
  // keep a clear lane from the pad into the arena
  for (let z = spawn.z + 2; z < spawn.z + 6; z++) for (let x = -1; x <= 1; x++) { const c = cellIdx(G, x, z); if (k[c] === CELL_WATER || k[c] === CELL_VOID || k[c] === CELL_LAVA) { k[c] = CELL_GROUND; g[c] = 0.5; } s[c] = 0; }
  const free = (c: number) => c >= 0 && k[c] === CELL_GROUND && s[c] === 0 && !G.prop[c] && g[c] < 4;
  const nearKey = (x: number, z: number, m: number) => Math.hypot(x - spawn.x, z - spawn.z) < m || gates.some((q) => Math.hypot(x - q.x, z - q.z) < m);
  // cover: crates, barrels, low walls
  const nCover = Math.round(half * (1.4 + plan.difficulty));
  for (let q = 0; q < nCover; q++) {
    const x = Math.round(range(r, -half + 3, half - 3)), z = Math.round(range(r, -half + 3, half - 3));
    if (nearKey(x, z, 3.5)) continue;
    const c = cellIdx(G, x, z);
    if (!free(c)) continue;
    const t = r();
    if (t < 0.45) { G.prop[c] = "crate"; if (chance(r, 0.3)) { const c2 = cellIdx(G, x + 1, z); if (free(c2)) G.prop[c2] = "crate"; } }
    else if (t < 0.7) G.prop[c] = "barrel";
    else { const horiz = chance(r, 0.5), len = 2 + Math.floor(r() * 3); for (let u = 0; u < len; u++) { const c2 = cellIdx(G, x + (horiz ? u : 0), z + (horiz ? 0 : u)); if (free(c2)) s[c2] = 1; } }
  }
  // the world's props
  const kinds: [PropKind, number][] = [...world.props, ...(partner ? partner.props.map(([pk, w]) => [pk, w * plan.blendAmt * 1.5] as [PropKind, number]) : [])];
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  const pickProp = () => { let v = r() * total; for (const [pk, w] of kinds) { v -= w; if (v <= 0) return pk; } return kinds[0][0]; };
  const nProps = Math.round(half * 1.6);
  for (let q = 0; q < nProps; q++) {
    const x = Math.round(range(r, -half + 3, half - 3)), z = Math.round(range(r, -half + 3, half - 3));
    if (nearKey(x, z, 4)) continue;
    const c = cellIdx(G, x, z);
    if (!free(c)) continue;
    let pk = pickProp();
    if (pk === "crate" || pk === "barrel") continue;
    if (pk === "windmill" && q % 3) pk = "tree";
    G.prop[c] = pk; G.seed[c] = Math.floor(r() * 1e6);
  }
  // solid tops: ground + standing things
  for (let c = 0; c < n * n; c++) {
    const pk = G.prop[c];
    if (s[c] > 0) s[c] = g[c] + s[c];
    else s[c] = g[c] + (pk ? PROP_H[pk] : 0);
    if (k[c] === CELL_WATER || k[c] === CELL_LAVA) s[c] = g[c];
  }
  // places for pickups and the robots to stand on
  const spots: Spot[] = [];
  for (let q = 0; q < 400 && spots.length < 60; q++) {
    const x = Math.round(range(r, -half + 3, half - 3)), z = Math.round(range(r, -half + 3, half - 3));
    const c = cellIdx(G, x, z);
    if (c >= 0 && (k[c] === CELL_GROUND || k[c] === CELL_PATH) && s[c] === g[c] && g[c] < 4 && !nearKey(x, z, 2.5)) spots.push({ x, z });
  }
  const liquid = world.water || world.lava ? -0.62 : -100;
  const arena: Arena = { plan, world, partner, n, half, ground: g, solid: s, kind: k, liquid, spawn, gates, spots, mills: [], geometry: new THREE.BufferGeometry() };
  arena.geometry = mesh(arena, G);
  return arena;
}

// ---------------------------------------------------------------- the mesh
function mesh(a: Arena, G: Gen) {
  const b = new Builder();
  const { n, half, ground: g, kind: k } = a;
  const w = a.world;
  const uvT = (t: number) => rectUv(tileRect(t), ATLAS);
  const white = 0xffffff;
  const ground = w.ground;
  const surface = (c: number) => (k[c] === CELL_PAD ? T.PAD : k[c] === CELL_GATE ? T.PAD : k[c] === CELL_WATER || k[c] === CELL_LAVA ? T.SAND : T.TOP);
  const edgeTile = ground === "street" || ground === "chrome" ? T.WALL : ground === "moon" || ground === "ash" ? T.ROCK : ground === "cloud" ? T.DEEP : T.ROCK;
  /** a column face strip from y0 to y1 on one side, in half-block quads */
  const side = (x: number, z: number, f: Face, y0: number, y1: number, top: number, sideTile: number, deepTile: number) => {
    for (let y = y1; y > y0 + 1e-3; y -= 0.5) {
      const ya = Math.max(y0, y - 0.5);
      const tile = top - y < 0.01 ? sideTile : deepTile;
      const uv = uvT(tile);
      // half-height quads take the top half of the tile
      const hh = y - ya;
      const u = hh < 0.99 ? [uv[0], (uv[5] + uv[1]) / 2, uv[2], (uv[5] + uv[1]) / 2, uv[4], uv[5], uv[6], uv[7]] : uv;
      faceQuad(b, x, z, f, ya, y, u);
    }
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = j * n + i, x = i - half, z = j - half, h = g[c];
    if (k[c] === CELL_VOID) continue;
    const edge = Math.min(i, j, n - 1 - i, n - 1 - j) < 2;
    // top
    const tt = edge ? edgeTile : surface(c);
    b.quad([[x - 0.5, h, z + 0.5], [x + 0.5, h, z + 0.5], [x + 0.5, h, z - 0.5], [x - 0.5, h, z - 0.5]], [0, 1, 0], uvT(tt), 1, 1, 1);
    // sides down to each lower neighbour
    const nb: [number, number, Face][] = [[i + 1, j, "px"], [i - 1, j, "nx"], [i, j + 1, "pz"], [i, j - 1, "nz"]];
    for (const [ni, nj, f] of nb) {
      const out = ni < 0 || nj < 0 || ni >= n || nj >= n;
      const nh = out ? -2 : k[nj * n + ni] === CELL_VOID ? h - 4 : g[nj * n + ni];
      if (nh >= h) continue;
      side(x, z, f, Math.max(nh, h - (out ? 6 : 8)), h, h, edge ? edgeTile : T.SIDE, edge ? edgeTile : T.DEEP);
    }
    // a floating island's underside
    if (a.world.id === "sky" || a.partner?.id === "sky") {
      const anyVoid = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].some(([ni, nj]) => ni >= 0 && nj >= 0 && ni < n && nj < n && k[nj * n + ni] === CELL_VOID);
      if (anyVoid) b.box(x, h - 4.5, z, 0.98, 1, 0.98, white, () => uvT(T.DEEP));
    }
    // cover walls standing on the cell (low walls, fort walls, maze walls)
    const s = a.solid[c];
    if (!G.prop[c] && s > h + 0.01) {
      const wallTile = a.plan.layout === "fort" ? (s - h > 3 ? T.WALL : T.WALL) : ground === "jungle" ? T.MOSS : ground === "street" ? T.BRICK : T.WALL;
      for (let y = h; y < s - 0.01; y += 0.5) b.box(x, y + 0.25, z, 1, 0.5, 1, white, (f) => (f === "py" && y + 0.5 >= s - 0.01 ? uvT(T.PATH) : halfUv(uvT(wallTile), f)));
    }
    const pk = G.prop[c];
    if (pk) prop(b, a, pk, x, h, z, G.seed[c], uvT);
  }
  return b.geometry();
}
function halfUv(uv: number[], f: Face) { if (f === "py" || f === "ny") return uv; const m = (uv[5] + uv[1]) / 2; return [uv[0], m, uv[2], m, uv[4], uv[5], uv[6], uv[7]]; }

function faceQuad(b: Builder, x: number, z: number, f: Face, y0: number, y1: number, uv: number[]) {
  const n: Record<Face, [number, number, number]> = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1], py: [0, 1, 0], ny: [0, -1, 0] };
  let cs: number[][];
  switch (f) {
    case "px": cs = [[x + 0.5, y0, z + 0.5], [x + 0.5, y0, z - 0.5], [x + 0.5, y1, z - 0.5], [x + 0.5, y1, z + 0.5]]; break;
    case "nx": cs = [[x - 0.5, y0, z - 0.5], [x - 0.5, y0, z + 0.5], [x - 0.5, y1, z + 0.5], [x - 0.5, y1, z - 0.5]]; break;
    case "pz": cs = [[x - 0.5, y0, z + 0.5], [x + 0.5, y0, z + 0.5], [x + 0.5, y1, z + 0.5], [x - 0.5, y1, z + 0.5]]; break;
    default: cs = [[x + 0.5, y0, z - 0.5], [x - 0.5, y0, z - 0.5], [x - 0.5, y1, z - 0.5], [x + 0.5, y1, z - 0.5]]; break;
  }
  const sh = f === "px" ? 0.86 : f === "nx" ? 0.74 : f === "pz" ? 0.9 : 0.8;
  b.quad(cs, n[f], uv, sh, sh, sh);
}

/** the props, built from the world's tiles (and a few plain colours) */
function prop(b: Builder, a: Arena, pk: PropKind, x: number, y: number, z: number, seed: number, uvT: (t: number) => number[]) {
  const r = makeRng(seed + 1);
  const W = 0xffffff;
  const bx = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, tile: number, tint = W) => b.box(x + cx, y + cy, z + cz, sx, sy, sz, tint, () => uvT(tile));
  const tint = (hex: string) => parseInt(hex.slice(1), 16);
  switch (pk) {
    case "tree": case "pine": case "palm": {
      const snow = a.world.ground === "snow";
      if (pk === "palm") {
        for (let k = 0; k < 5; k++) bx(k * 0.06, 0.5 + k, 0, 0.4, 1, 0.4, T.BARK);
        const ty = 5.2;
        bx(0.3, ty, 0, 1.2, 0.4, 1.2, T.LEAVES);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { bx(0.3 + dx * 1.1, ty - 0.2, dz * 1.1, dx ? 1.4 : 0.6, 0.3, dz ? 1.4 : 0.6, T.LEAVES); bx(0.3 + dx * 1.9, ty - 0.6, dz * 1.9, 0.5, 0.4, 0.5, T.LEAVES); }
      } else if (pk === "pine") {
        bx(0, 0.75, 0, 0.5, 1.5, 0.5, T.BARK);
        for (let k = 0; k < 4; k++) { const s = 2.4 - k * 0.55; bx(0, 1.7 + k * 1.0, 0, s, 0.9, s, T.LEAVES); if (snow) bx(0, 2.2 + k * 1.0, 0, s * 0.9, 0.12, s * 0.9, T.SNOW); }
        bx(0, 5.4, 0, 0.5, 0.5, 0.5, snow ? T.SNOW : T.LEAVES);
      } else {
        const h = 2 + Math.floor(r() * 2);
        bx(0, h / 2, 0, 0.5, h, 0.5, T.BARK);
        bx(0, h + 1, 0, 3, 2, 3, T.LEAVES);
        bx(0, h + 2.4, 0, 2, 1, 2, T.LEAVES);
        if (chance(r, 0.5)) bx(0.9, h + 0.2, 0.4, 1, 1, 1, T.LEAVES);
        if (a.world.ground === "grass" && chance(r, 0.4)) for (let k = 0; k < 4; k++) bx(range(r, -1.4, 1.4), h + range(r, 0.5, 1.8), 1.52, 0.22, 0.22, 0.04, T.TRIM, tint("#FF4A3A"));
      }
      break;
    }
    case "bush": bx(0, 0.45, 0, 1, 0.9, 1, T.LEAVES); bx(0.2, 0.8, 0.1, 0.6, 0.4, 0.6, T.LEAVES); break;
    case "rock": { const s = range(r, 0.9, 1.3); bx(0, s * 0.5, 0, s, s, s * 0.9, T.ROCK); bx(0.15, s + 0.2, 0, s * 0.6, 0.4, s * 0.6, T.ROCK); break; }
    case "crate": bx(0, 0.5, 0, 1, 1, 1, T.CRATE); break;
    case "barrel": bx(0, 0.45, 0, 0.8, 0.9, 0.8, a.world.ground === "street" || a.world.ground === "chrome" || a.world.ground === "ash" ? T.HAZARD : T.METAL); bx(0, 0.93, 0, 0.7, 0.06, 0.7, T.DARK); break;
    case "fence": bx(0, 0.5, -0.4, 0.15, 1, 0.15, T.PLANK); bx(0, 0.5, 0.4, 0.15, 1, 0.15, T.PLANK); bx(0, 0.75, 0, 0.1, 0.15, 1, T.PLANK); bx(0, 0.4, 0, 0.1, 0.15, 1, T.PLANK); break;
    case "hay": bx(0, 0.5, 0, 1, 1, 1, T.HAY); break;
    case "windmill": {
      for (let k = 0; k < 6; k++) bx(0, 0.5 + k, 0, 2 - k * 0.15, 1, 2 - k * 0.15, T.PLASTER);
      bx(0, 6.5, 0, 1.8, 1, 1.8, T.ROOF); bx(0, 7.2, 0, 1.0, 0.5, 1.0, T.ROOF);
      bx(0, 1, 0.92, 0.6, 1.2, 0.1, T.PLANK);
      a.mills.push({ x, y: y + 5.6, z: z + 1.1, s: 1 });
      break;
    }
    case "cactus": bx(0, 1.1, 0, 0.5, 2.2, 0.5, T.CACTUS); bx(0.45, 1.2, 0, 0.4, 0.3, 0.3, T.CACTUS); bx(0.6, 1.6, 0, 0.3, 0.7, 0.3, T.CACTUS); bx(-0.4, 0.9, 0, 0.3, 0.25, 0.3, T.CACTUS); bx(-0.5, 1.2, 0, 0.25, 0.6, 0.25, T.CACTUS); break;
    case "ruin": bx(0, 1, 0, 1, 2, 1, T.MOSS); bx(0, 2.4, 0, 0.8, 0.8, 0.8, T.WALL); bx(0.6, 0.3, 0.4, 0.5, 0.5, 0.5, T.WALL); break;
    case "icespike": bx(0, 0.75, 0, 0.9, 1.5, 0.9, T.ICE); bx(0, 2, 0, 0.6, 1, 0.6, T.ICE); bx(0, 2.8, 0, 0.3, 0.6, 0.3, T.ICE); break;
    case "lamp": bx(0, 1.6, 0, 0.18, 3.2, 0.18, T.DARK); bx(0.35, 3.3, 0, 0.7, 0.14, 0.14, T.DARK); bx(0.6, 3.1, 0, 0.4, 0.25, 0.4, T.GLOW); break;
    case "car": {
      const col = tint(pick(r, ["#D8402A", "#2A72D8", "#E8C030", "#22A06A", "#E8E8F0"]));
      bx(0, 0.55, 0, 1.7, 0.6, 0.95, T.PLASTER, col); bx(-0.1, 1.05, 0, 0.95, 0.45, 0.85, T.GLASS);
      for (const [dx, dz] of [[0.55, 0.5], [-0.55, 0.5], [0.55, -0.5], [-0.55, -0.5]]) bx(dx, 0.22, dz, 0.4, 0.4, 0.12, T.DARK);
      break;
    }
    case "sign": bx(0, 1, 0, 0.18, 2, 0.18, T.DARK); bx(0, 2.4, 0, 1.6, 0.9, 0.2, T.NEON); break;
    case "vine": bx(0, 2, 0, 0.6, 4, 0.6, T.MOSS); bx(0.35, 2.5, 0, 0.12, 3, 0.7, T.LEAVES); bx(-0.3, 3.4, 0.2, 0.1, 1.5, 0.4, T.LEAVES); break;
    case "idol": bx(0, 0.6, 0, 1.2, 1.2, 1.2, T.MOSS); bx(0, 1.9, 0, 1, 1.4, 1, T.MOSS); bx(0, 2.1, 0.51, 0.5, 0.2, 0.02, T.GLOW); break;
    case "pipe": bx(0, 0.8, 0, 0.7, 1.6, 0.7, T.METAL); bx(0, 1.7, 0, 0.9, 0.2, 0.9, T.DARK); bx(0, 1.9, 0, 0.5, 0.3, 0.5, T.METAL); break;
    case "tank": bx(0, 1.4, 0, 1.6, 2.8, 1.6, T.METAL); bx(0, 2.9, 0, 1.2, 0.2, 1.2, T.DARK); bx(0, 1.2, 0.81, 1.62, 0.3, 0.02, T.HAZARD); break;
    case "lifebuoy": bx(0, 0.75, 0, 0.12, 1.5, 0.12, T.PLANK); bx(0, 1.2, 0.1, 0.7, 0.7, 0.1, T.CLOTH, tint("#FF5A5A")); break;
    case "hut": bx(0, 1, 0, 2, 2, 2, T.PLANK); bx(0, 2.3, 0, 2.4, 0.6, 2.4, T.ROOF); bx(0, 2.8, 0, 1.4, 0.4, 1.4, T.ROOF); bx(0, 0.7, 1.01, 0.6, 1.2, 0.02, T.DARK); break;
    case "balloon": bx(0, 0.4, 0, 0.8, 0.8, 0.8, T.PLANK); bx(0, 2.5, 0, 0.06, 3, 0.06, T.DARK); bx(0, 5.2, 0, 2.4, 2.6, 2.4, T.CLOTH); bx(0, 6.6, 0, 1.6, 0.4, 1.6, T.CLOTH); break;
    case "antenna": bx(0, 2.5, 0, 0.16, 5, 0.16, T.METAL); bx(0, 4, 0, 1, 0.1, 0.1, T.METAL); bx(0, 5.1, 0, 0.3, 0.3, 0.3, T.GLOW); bx(0, 0.25, 0, 0.8, 0.5, 0.8, T.DARK); break;
    case "dome": bx(0, 0.8, 0, 3, 1.6, 3, T.GLASS); bx(0, 2, 0, 2, 0.8, 2, T.GLASS); bx(0, 2.6, 0, 1, 0.4, 1, T.GLASS); bx(0, 0.1, 0, 3.2, 0.2, 3.2, T.METAL); break;
    case "crystal": bx(0, 0.6, 0, 0.5, 1.2, 0.5, T.GLOW); bx(0.35, 0.4, 0.1, 0.3, 0.8, 0.3, T.GLOW); bx(-0.3, 0.5, -0.1, 0.3, 1, 0.3, T.GLOW); break;
    case "pylon": bx(0, 2, 0, 0.6, 4, 0.6, T.DARK); bx(0, 3.6, 0, 0.8, 0.3, 0.8, T.GLOW); bx(0, 1, 0, 0.8, 0.2, 0.8, T.TRIM); break;
    case "statue": bx(0, 0.5, 0, 1.4, 1, 1.4, T.WALL); bx(0, 1.8, 0, 0.8, 1.6, 0.5, T.METAL); bx(0, 3, 0, 0.7, 0.7, 0.7, T.METAL); bx(0, 3.05, 0.36, 0.5, 0.14, 0.02, T.GLOW); break;
    case "mushroom": bx(0, 1, 0, 0.5, 2, 0.5, T.PLASTER); bx(0, 2.3, 0, 2.2, 0.6, 2.2, T.CLOTH, tint("#E8403A")); bx(0, 2.7, 0, 1.4, 0.3, 1.4, T.CLOTH, tint("#E8403A")); break;
  }
}

