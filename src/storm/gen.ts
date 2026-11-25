// Builds a stage's island from its plan (seeded, so stage n is the same for everyone): rolling ground with ponds of
// water, lava or goo, a path from where you land, the world's buildings (houses, towers, skyscrapers, pyramids, ships,
// pagodas, factories, igloos, domes…) and props (trees of every kind, cacti, giant mushrooms, crystal spires, lamp
// posts…), boom barrels and coin crates, and the goal's pieces: gloom totems with glowing cores, a gloom fortress,
// the beacon, cages with friends inside, or a boss ring.
import { B } from "./blocks";
import { Voxels } from "./voxels";
import type { StagePlan } from "./stages";
import { WORLDS, type Building, type Prop, type World } from "./worlds";
import { chance, clamp, fbm, irange, makeRng, noise2, pick, range, type Rng } from "./util";

export type PickupKind = "coin" | "gem" | "oil" | "heart" | "health" | "power";
export interface Totem { x: number; y: number; z: number; cores: number[]; alive: boolean }
export interface Cage { x: number; y: number; z: number; freed: boolean; ally: "archer" | "knight" | "brawler" }
export interface Arena {
  vox: Voxels; size: number;
  spawn: { x: number; y: number; z: number; yaw: number };
  liquidY: number; // -1: none
  totems: Totem[];
  rifts: { x: number; z: number }[];
  fortress: { x0: number; z0: number; x1: number; z1: number; total: number } | null;
  beacon: { x: number; y: number; z: number } | null;
  cages: Cage[];
  boss: { x: number; z: number } | null;
  pickups: { kind: PickupKind; x: number; y: number; z: number }[];
  center: { x: number; z: number };
}

const HEIGHT = 40;

export function buildArena(plan: StagePlan): Arena {
  const w = WORLDS.find((x) => x.id === plan.world)!;
  const w2 = plan.blend ? WORLDS.find((x) => x.id === plan.blend)! : null;
  const r = makeRng(plan.seed);
  const S = plan.size;
  const V = new Voxels(S, HEIGHT, S);
  const n = noise2(plan.seed ^ 0x5bd1e995);
  const used = new Uint8Array(S * S); // footprints already taken
  const H = new Int16Array(S * S); // ground height per column
  const cx = S / 2, cz = S / 2;
  const spawn = { x: S / 2 + 0.5, y: 0, z: 3.5, yaw: 0 };

  // ---------------------------------------------------------------- ground
  const hill = 3 + plan.difficulty * 2 + (w.id === "moon" || w.id === "dunes" ? 1.5 : 0);
  const liquid = w.liquid !== "void";
  const pondN = liquid ? irange(r, 1, 3) : 0;
  const ponds = Array.from({ length: pondN }, () => ({ x: range(r, 8, S - 8), z: range(r, 12, S - 6), r: range(r, 2.5, 5) }));
  const riverOn = liquid && chance(r, 0.35);
  const riverZ = range(r, S * 0.45, S * 0.7), riverW = range(r, 1.6, 2.6), riverF = range(r, 0.08, 0.16), riverP = r() * 6;
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const e = Math.min(x, z, S - 1 - x, S - 1 - z);
    let h = 3 + Math.round((fbm(n, x * 0.07, z * 0.07, 3) - 0.35) * hill);
    // a gentle rim of hills around the edge (it frames the fight and hides the floor's end)
    if (e < 4) h += Math.round((4 - e) * (liquid ? 0.9 : 0.4) + n(x * 0.3, z * 0.3) * 2);
    // keep the landing zone flat
    if (Math.hypot(x - spawn.x, z - spawn.z) < 5) h = 3;
    let wet = false;
    for (const p of ponds) if (Math.hypot(x - p.x, z - p.z) < p.r + n(x * 0.5, z * 0.5) * 1.5) wet = true;
    if (riverOn && Math.abs(z - (riverZ + Math.sin(x * riverF + riverP) * 3)) < riverW && e > 2) wet = true;
    if (wet && Math.hypot(x - spawn.x, z - spawn.z) > 6) h = 1;
    h = clamp(h, 1, 9);
    H[z * S + x] = h;
    V.data[V.idx(x, 0, z)] = B.BEDROCK;
    for (let y = 1; y < h; y++) V.data[V.idx(x, y, z)] = y < h - 3 ? B.STONE : B.SOIL;
    if (h > 1) V.data[V.idx(x, h - 1, z)] = B.TOP;
    else V.data[V.idx(x, 0, z)] = B.BEDROCK;
    // stone outcrops on steep spots
    if (h >= 6 && n(x * 0.4 + 9, z * 0.4) > 0.7) V.data[V.idx(x, h - 1, z)] = B.ROCK;
  }
  const liquidY = liquid ? 1.62 : -1;
  // a path from the landing zone toward the middle
  for (let z = 2; z < cz; z++) {
    const px = Math.round(spawn.x + Math.sin(z * 0.2) * 2);
    for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx; if (x < 0 || x >= S) continue;
      const h = H[z * S + x];
      if (h > 1 && V.get(x, h - 1, z) === B.TOP) V.data[V.idx(x, h - 1, z)] = B.PATH;
    }
  }
  for (let z = 0; z < 8; z++) for (let x = Math.floor(spawn.x) - 4; x <= spawn.x + 4; x++) if (x >= 0 && x < S) used[z * S + x] = 1;
  spawn.y = 3;

  // ---------------------------------------------------------------- helpers
  const put = (x: number, y: number, z: number, id: number) => { if (x >= 0 && z >= 0 && x < S && z < S && y > 0 && y < HEIGHT) V.data[V.idx(x, y, z)] = id; };
  const groundAt = (x: number, z: number) => H[clamp(z, 0, S - 1) * S + clamp(x, 0, S - 1)];
  /** a free, dry footprint w×d (with a margin) far enough from the landing zone; returns its corner */
  const plot = (wd: number, dp: number, tries = 40, minZ = 9): [number, number] | null => {
    for (let t = 0; t < tries; t++) {
      const x0 = irange(r, 2, S - wd - 3), z0 = irange(r, minZ, S - dp - 3);
      let ok = true;
      for (let z = z0 - 1; z <= z0 + dp && ok; z++) for (let x = x0 - 1; x <= x0 + wd && ok; x++) if (used[clamp(z, 0, S - 1) * S + clamp(x, 0, S - 1)] || groundAt(x, z) <= 1) ok = false;
      if (!ok) continue;
      for (let z = z0 - 1; z <= z0 + dp; z++) for (let x = x0 - 1; x <= x0 + wd; x++) if (x >= 0 && z >= 0 && x < S && z < S) used[z * S + x] = 1;
      return [x0, z0];
    }
    return null;
  };
  /** level a footprint to its average height (a foundation) and return that height */
  const level = (x0: number, z0: number, wd: number, dp: number) => {
    let s = 0, c = 0;
    for (let z = z0; z < z0 + dp; z++) for (let x = x0; x < x0 + wd; x++) { s += groundAt(x, z); c++; }
    const h = Math.max(2, Math.round(s / c));
    for (let z = z0; z < z0 + dp; z++) for (let x = x0; x < x0 + wd; x++) {
      for (let y = 1; y < HEIGHT; y++) {
        if (y < h) { if (!V.get(x, y, z)) put(x, y, z, y === h - 1 ? B.STONE2 : B.STONE); }
        else put(x, y, z, 0);
      }
      H[z * S + x] = h;
    }
    return h;
  };

  // ---------------------------------------------------------------- the goal's pieces
  const totems: Totem[] = [];
  const cages: Cage[] = [];
  let fortress: Arena["fortress"] = null, beacon: Arena["beacon"] = null, boss: Arena["boss"] = null;
  const rifts: { x: number; z: number }[] = [];

  if (plan.goal === "totems") {
    for (let i = 0; i < plan.goalCount; i++) {
      const p = plot(3, 3, 60, 14); if (!p) continue;
      const [x0, z0] = p; const h = level(x0, z0, 3, 3);
      const tall = 5 + irange(r, 0, 3);
      for (let y = h; y < h + tall; y++) for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) {
        const edge = x === x0 || x === x0 + 2 || z === z0 || z === z0 + 2;
        put(x, y, z, edge || y < h + 2 ? B.GLOOM : B.GLOOM);
      }
      // a crown with the glowing cores
      const cores: number[] = [];
      const ty = h + tall;
      for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) {
        const c = (x === x0 + 1) !== (z === z0 + 1) || (x === x0 + 1 && z === z0 + 1);
        if (c) { put(x, ty, z, B.CORE); cores.push(x, ty, z); }
        else put(x, ty, z, B.GLOOM);
      }
      put(x0 + 1, ty + 1, z0 + 1, B.CORE); cores.push(x0 + 1, ty + 1, z0 + 1);
      totems.push({ x: x0 + 1.5, y: h, z: z0 + 1.5, cores, alive: true });
    }
  }
  if (plan.goal === "wreck") {
    const fw = 11 + Math.round(plan.difficulty * 4), fd = 9 + Math.round(plan.difficulty * 3);
    const p = plot(fw, fd, 80, Math.round(S * 0.45)) ?? plot(fw, fd, 80, 10);
    if (p) {
      const [x0, z0] = p; const h = level(x0, z0, fw, fd);
      gloomFort(x0, z0, fw, fd, h, r, put);
      let total = 0;
      for (let y = h; y < HEIGHT; y++) for (let z = z0; z < z0 + fd; z++) for (let x = x0; x < x0 + fw; x++) { const id = V.get(x, y, z); if (id === B.GLOOM || id === B.CORE) total++; }
      fortress = { x0, z0, x1: x0 + fw, z1: z0 + fd, total };
    }
  }
  if (plan.goal === "hold") {
    const bx = Math.floor(cx) - 1, bz = Math.floor(cz) - 1;
    for (let z = bz - 3; z < bz + 6; z++) for (let x = bx - 3; x < bx + 6; x++) if (x >= 0 && z >= 0 && x < S && z < S) used[z * S + x] = 1;
    const h = level(bx - 2, bz - 2, 7, 7);
    for (let z = bz - 2; z < bz + 5; z++) for (let x = bx - 2; x < bx + 5; x++) put(x, h - 1, z, (x + z) % 2 ? B.STONE2 : B.PATH);
    // the beacon: a crystal pillar crowned with light
    for (let y = h; y < h + 3; y++) put(bx + 1, y, bz + 1, B.CRYSTAL);
    put(bx + 1, h + 3, bz + 1, B.LAMP);
    for (const [dx, dz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) put(bx + dx, h, bz + dz, B.METAL);
    beacon = { x: bx + 1.5, y: h, z: bz + 1.5 };
  }
  if (plan.goal === "rescue") {
    const allies: Cage["ally"][] = ["archer", "knight", "brawler"];
    for (let i = 0; i < plan.goalCount; i++) {
      const p = plot(3, 3, 60, 14); if (!p) continue;
      const [x0, z0] = p; const h = level(x0, z0, 3, 3);
      const bar = w.id === "frost" ? B.ICE : w.id === "candy" ? B.ACCENT2 : B.METAL;
      for (let y = h; y < h + 3; y++) for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) {
        const inner = x === x0 + 1 && z === z0 + 1;
        if (!inner) put(x, y, z, (x + z + y) % 2 === 0 || y === h ? bar : B.GLOOM);
      }
      for (let z = z0; z < z0 + 3; z++) for (let x = x0; x < x0 + 3; x++) put(x, h + 3, z, x === x0 + 1 && z === z0 + 1 ? B.CORE : bar);
      cages.push({ x: x0 + 1, y: h, z: z0 + 1, freed: false, ally: allies[i % 3] });
    }
  }
  if (plan.goal === "boss") {
    const bx = Math.floor(cx), bz = Math.floor(S * 0.66);
    for (let z = bz - 6; z < bz + 6; z++) for (let x = bx - 6; x < bx + 6; x++) if (x >= 0 && z >= 0 && x < S && z < S) used[z * S + x] = 1;
    const h = level(bx - 5, bz - 5, 10, 10);
    for (let z = bz - 5; z < bz + 5; z++) for (let x = bx - 5; x < bx + 5; x++) if (Math.hypot(x - bx + 0.5, z - bz + 0.5) > 4.2) put(x, h - 1, z, B.STONE2);
    // ring of gloom pylons
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, px = Math.round(bx + Math.cos(a) * 5.5), pz = Math.round(bz + Math.sin(a) * 5.5);
      for (let y = h; y < h + 3; y++) put(px, y, pz, B.GLOOM);
      put(px, h + 3, pz, B.LAMP);
    }
    boss = { x: bx + 0.5, z: bz + 0.5 };
  }

  // ---------------------------------------------------------------- buildings and props
  const bw = (k: number) => (w2 && k % 2 === 1 ? w2 : w);
  const nB = plan.goal === "boss" ? 2 : 3 + Math.round(plan.difficulty * 3) + (S > 42 ? 1 : 0);
  for (let i = 0; i < nB; i++) {
    const kind = pick(r, bw(i).buildings);
    const [fw, fd] = FOOT[kind];
    const p = plot(fw, fd, 30); if (!p) continue;
    const h = level(p[0], p[1], fw, fd);
    building(kind, p[0], p[1], fw, fd, h, r, put, bw(i));
  }
  // monster rifts: where monsters come from (totem stages: the totems too)
  const nR = plan.goal === "totems" ? 1 : 3;
  for (let i = 0; i < nR; i++) {
    const a = range(r, -1.1, 1.1) + Math.PI / 2;
    rifts.push({ x: clamp(cx + Math.cos(a) * S * 0.38, 4, S - 4), z: clamp(cz + Math.sin(a) * S * 0.36 + S * 0.08, S * 0.45, S - 4) });
  }
  // props
  const nP = Math.round(S * S * 0.012);
  for (let i = 0; i < nP; i++) {
    const ww = bw(i);
    const kind = pick(r, ww.props);
    const x = irange(r, 1, S - 2), z = irange(r, 1, S - 2);
    if (used[z * S + x]) continue;
    const h = groundAt(x, z);
    if (h <= 1) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 6) continue;
    prop(kind, x, h, z, r, put, ww);
    used[z * S + x] = 1;
  }
  // boom barrels and coin crates
  const barrels = 2 + Math.round(plan.difficulty * 5);
  for (let i = 0; i < barrels; i++) {
    const x = irange(r, 3, S - 4), z = irange(r, 10, S - 4);
    const h = groundAt(x, z);
    if (h <= 1 || V.get(x, h, z)) continue;
    put(x, h, z, B.BOOM);
    if (chance(r, 0.3)) put(x + 1, h, z, B.BOOM);
  }
  const crates = 3 + irange(r, 0, 3);
  for (let i = 0; i < crates; i++) {
    const x = irange(r, 3, S - 4), z = irange(r, 6, S - 4);
    const h = V.top(x, z);
    if (h <= 1 || h >= HEIGHT - 1) continue;
    put(x, h, z, B.CHEST);
  }
  if (w.id === "crystal" || w.id === "glitch") for (let i = 0; i < 6; i++) { const x = irange(r, 2, S - 3), z = irange(r, 6, S - 3), h = groundAt(x, z); if (h > 1) put(x, h, z, B.CRYSTAL); }

  // ---------------------------------------------------------------- pickups
  const pickups: Arena["pickups"] = [];
  const surface = (x: number, z: number) => V.top(x, z);
  const add = (kind: PickupKind, x: number, z: number) => {
    const ix = clamp(Math.floor(x), 0, S - 1), iz = clamp(Math.floor(z), 0, S - 1);
    const y = surface(ix, iz);
    if (y >= HEIGHT - 2 || (liquid && y <= 1)) return;
    pickups.push({ kind, x: ix + 0.5, y: y + 0.6, z: iz + 0.5 });
  };
  // coin trails
  const trails = 4 + Math.round(plan.difficulty * 3);
  for (let t = 0; t < trails; t++) {
    let x = range(r, 4, S - 4), z = range(r, 6, S - 4);
    const a = r() * Math.PI * 2;
    for (let k = 0; k < 6; k++) { add("coin", x, z); x += Math.cos(a) * 1.4; z += Math.sin(a) * 1.4; if (x < 2 || z < 2 || x > S - 2 || z > S - 2) break; }
  }
  for (let i = 0; i < 2 + Math.round(plan.difficulty * 2); i++) add("oil", range(r, 4, S - 4), range(r, 8, S - 4));
  for (let i = 0; i < 2; i++) add("health", range(r, 4, S - 4), range(r, 10, S - 4));
  for (let i = 0; i < 1 + Math.round(plan.difficulty * 2); i++) add("power", range(r, 4, S - 4), range(r, 10, S - 4));
  if (plan.n % 3 === 0 || plan.goal === "boss") add("heart", range(r, 6, S - 6), range(r, S * 0.5, S - 4));
  if (chance(r, 0.5)) add("gem", range(r, 4, S - 4), range(r, S * 0.6, S - 4));
  // a pinch of coins on the rooftops
  for (let i = 0; i < 8; i++) { const x = irange(r, 2, S - 3), z = irange(r, 8, S - 3), y = surface(x, z); if (y > 6) add("coin", x, z); }

  V.dirty.clear();
  for (let i = 0; i < V.cx * V.cz; i++) V.dirty.add(i);
  return { vox: V, size: S, spawn, liquidY, totems, rifts, fortress, beacon, cages, boss, pickups, center: { x: cx, z: cz } };
}

// ------------------------------------------------------------------ the gloom fortress
type Put = (x: number, y: number, z: number, id: number) => void;
function gloomFort(x0: number, z0: number, fw: number, fd: number, h: number, r: Rng, put: Put) {
  const wallH = 4 + irange(r, 0, 2);
  for (let z = z0; z < z0 + fd; z++) for (let x = x0; x < x0 + fw; x++) {
    const edge = x === x0 || x === x0 + fw - 1 || z === z0 || z === z0 + fd - 1;
    if (!edge) continue;
    const gate = z === z0 && Math.abs(x - (x0 + fw / 2)) < 1.5;
    for (let y = h; y < h + wallH; y++) {
      if (gate && y < h + 3) continue;
      put(x, y, z, y === h + 2 && (x + z) % 4 === 0 ? B.CORE : B.GLOOM);
    }
    if ((x + z) % 2 === 0) put(x, h + wallH, z, B.GLOOM);
  }
  // corner towers
  for (const [tx, tz] of [[x0, z0], [x0 + fw - 3, z0], [x0, z0 + fd - 3], [x0 + fw - 3, z0 + fd - 3]]) {
    const th = wallH + 3 + irange(r, 0, 2);
    for (let y = h; y < h + th; y++) for (let z = tz; z < tz + 3; z++) for (let x = tx; x < tx + 3; x++) put(x, y, z, y === h + th - 1 && x === tx + 1 && z === tz + 1 ? B.CORE : B.GLOOM);
    put(tx + 1, h + th, tz + 1, B.LAMP);
  }
  // the keep in the middle
  const kx = x0 + Math.floor(fw / 2) - 2, kz = z0 + Math.floor(fd / 2) - 1, kh = wallH + 4;
  for (let y = h; y < h + kh; y++) for (let z = kz; z < kz + 4; z++) for (let x = kx; x < kx + 4; x++) {
    const edge = x === kx || x === kx + 3 || z === kz || z === kz + 3;
    if (edge || y === h + kh - 1) put(x, y, z, (y - h) % 3 === 2 && edge && (x + z) % 2 ? B.CORE : B.GLOOM);
  }
  put(kx + 1, h + kh, kz + 1, B.CORE); put(kx + 2, h + kh, kz + 2, B.CORE);
}

// ------------------------------------------------------------------ buildings
const FOOT: Record<Building, [number, number]> = {
  house: [7, 7], tower: [5, 5], skyscraper: [7, 7], pyramid: [9, 9], temple: [9, 7], ship: [13, 5], pagoda: [7, 7],
  factory: [9, 7], fort: [11, 11], igloo: [7, 7], dome: [7, 7], ruin: [7, 7], hut: [5, 5], candyHouse: [7, 7], crypt: [7, 7], lab: [8, 8],
};
function building(kind: Building, x0: number, z0: number, fw: number, fd: number, h: number, r: Rng, put: Put, w: World) {
  const box = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, id: number | ((x: number, y: number, z: number) => number)) => {
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) { const v = typeof id === "number" ? id : id(x, y, z); if (v >= 0) put(x, y, z, v); }
  };
  const shell = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, wall: number, opts: { win?: number; door?: boolean; corner?: number } = {}) => {
    box(ax, ay, az, bx, by, bz, (x, y, z) => {
      const ex = x === ax || x === bx, ez = z === az || z === bz;
      if (!ex && !ez) return 0;
      if (opts.corner !== undefined && ex && ez) return opts.corner;
      if (opts.door && z === az && Math.abs(x - (ax + bx) / 2) < 1 && y < ay + 2) return 0;
      if (opts.win !== undefined && (y - ay) % 3 === 1 && (ex ? (z - az) : (x - ax)) % 3 === 1 && !(ex && ez)) return opts.win;
      return wall;
    });
  };
  const x1 = x0 + fw - 1, z1 = z0 + fd - 1;
  switch (kind) {
    case "house": {
      box(x0, h - 1, z0, x1, h - 1, z1, B.PLANK);
      shell(x0, h, z0, x1, h + 3, z1, chance(r, 0.5) ? B.PLANK : B.BRICK, { win: B.WINDOW, door: true, corner: B.LOG });
      // a gable roof: two slopes meeting at a ridge, the gable ends filled in
      for (let k = 0; k <= 4; k++) box(x0 - 1 + k, h + 4 + k, z0 - 1, x1 + 1 - k, h + 4 + k, z1 + 1, (x, _y, z) =>
        x === x0 - 1 + k || x === x1 + 1 - k || k === 4 ? B.ROOF : (z === z0 || z === z1) ? B.PLANK : -1);
      box(x1 - 1, h + 4, z1 - 1, x1 - 1, h + 7, z1 - 1, B.BRICK);
      if (chance(r, 0.6)) put(x0 + 3, h + 9, z0 + 3, B.CHEST);
      break;
    }
    case "tower": {
      const th = 8 + irange(r, 0, 5);
      shell(x0, h, z0, x1, h + th, z1, B.STONE2, { win: B.WINDOW, door: true });
      box(x0 + 1, h + th - 4, z0 + 1, x1 - 1, h + th - 4, z1 - 1, B.PLANK);
      box(x0, h + th + 1, z0, x1, h + th + 1, z1, (x, _y, z) => ((x + z) % 2 === 0 && (x === x0 || x === x1 || z === z0 || z === z1) ? B.STONE2 : -1));
      box(x0 + 1, h + th, z0 + 1, x1 - 1, h + th, z1 - 1, B.PLANK);
      put(x0 + 2, h + th + 1, z0 + 2, chance(r, 0.5) ? B.CHEST : B.LAMP);
      break;
    }
    case "skyscraper": {
      const th = 12 + irange(r, 0, 12);
      box(x0, h, z0, x1, h + th, z1, (x, y, z) => {
        const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
        if (!ex && !ez) return (y - h) % 4 === 0 ? B.STONE : 0;
        if (ex && ez) return B.METAL;
        if ((y - h) % 4 === 0) return B.STONE;
        if (y < h + 2 && z === z0 && Math.abs(x - (x0 + x1) / 2) < 1) return 0;
        return B.WINDOW;
      });
      box(x0, h + th + 1, z0, x1, h + th + 1, z1, (x, _y, z) => (x === x0 || x === x1 || z === z0 || z === z1 ? B.ACCENT : B.METAL));
      put(x0 + 3, h + th + 2, z0 + 3, B.LAMP); put(x0 + 3, h + th + 3, z0 + 3, B.PIPE);
      break;
    }
    case "pyramid": {
      for (let k = 0; k < 5; k++) box(x0 + k, h + k, z0 + k, x1 - k, h + k, z1 - k, (x, _y, z) => (k === 2 && (x + z) % 3 === 0 ? B.ACCENT : k % 2 ? B.BRICK : B.STONE2));
      put(x0 + 4, h + 5, z0 + 4, B.CHEST);
      break;
    }
    case "temple": {
      box(x0, h, z0, x1, h, z1, B.STONE2);
      for (let x = x0 + 1; x <= x1 - 1; x += 2) for (const z of [z0 + 1, z1 - 1]) box(x, h + 1, z, x, h + 4, z, B.STONE);
      box(x0, h + 5, z0, x1, h + 5, z1, B.STONE2);
      box(x0 + 1, h + 6, z0 + 1, x1 - 1, h + 6, z1 - 1, (x) => (x % 2 ? B.ACCENT : B.STONE2));
      put(x0 + 4, h + 1, z0 + 3, B.CHEST);
      break;
    }
    case "ship": {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (fw - 1), taper = t < 0.2 ? 1 : t > 0.8 ? 1 : 0;
        for (let z = z0 + taper; z <= z1 - taper; z++) {
          const edge = z === z0 + taper || z === z1 - taper || x === x0 || x === x1;
          box(x, h, z, x, h + (edge ? 3 : 1), z, (_x, y) => (y === h + 1 && !edge ? B.PLANK : edge ? B.PLANK : y === h ? B.LOG : -1));
        }
      }
      const mx = x0 + Math.floor(fw / 2);
      box(mx, h + 2, z0 + 2, mx, h + 11, z0 + 2, B.LOG);
      box(mx, h + 5, z0, mx, h + 10, z1, (_x, y, z) => (z === z0 + 2 ? -1 : (y + z) % 3 === 0 ? B.ACCENT : B.ACCENT2));
      put(x1 - 1, h + 2, z0 + 2, B.CHEST);
      break;
    }
    case "pagoda": {
      for (let t = 0; t < 3; t++) {
        const i = t, yb = h + t * 4;
        shell(x0 + 1 + i, yb, z0 + 1 + i, x1 - 1 - i, yb + 2, z1 - 1 - i, B.PLANK, { corner: B.ACCENT, win: B.WINDOW, door: t === 0 });
        box(x0 + i, yb + 3, z0 + i, x1 - i, yb + 3, z1 - i, B.ROOF);
      }
      put(x0 + 3, h + 12, z0 + 3, B.LAMP);
      break;
    }
    case "factory": {
      shell(x0, h, z0, x1, h + 5, z1, B.BRICK, { win: B.WINDOW, door: true, corner: B.METAL });
      box(x0, h + 6, z0, x1, h + 6, z1, B.METAL);
      for (const [px, pz] of [[x0 + 1, z0 + 1], [x1 - 1, z1 - 1]]) box(px, h + 7, pz, px, h + 12 + irange(r, 0, 3), pz, B.PIPE);
      box(x0 + 2, h + 7, z1 - 2, x0 + 4, h + 7, z1 - 2, B.PIPE);
      break;
    }
    case "fort": {
      box(x0, h, z0, x1, h + 3, z1, (x, y, z) => {
        const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
        if (!ex && !ez) return 0;
        if (z === z0 && Math.abs(x - (x0 + x1) / 2) < 1.5 && y < h + 3) return 0;
        return B.STONE2;
      });
      box(x0, h + 4, z0, x1, h + 4, z1, (x, _y, z) => ((x === x0 || x === x1 || z === z0 || z === z1) && (x + z) % 2 === 0 ? B.STONE2 : -1));
      for (const [tx, tz] of [[x0, z0], [x1 - 2, z0], [x0, z1 - 2], [x1 - 2, z1 - 2]]) box(tx, h, tz, tx + 2, h + 6, tz + 2, (x, y) => (y === h + 6 && x % 2 ? -1 : B.STONE));
      put(x0 + 5, h, z0 + 6, B.CHEST);
      break;
    }
    case "igloo": {
      const c = 3;
      box(x0, h, z0, x1, h + 3, z1, (x, y, z) => {
        const d = Math.hypot(x - x0 - c, (y - h) * 1.2, z - z0 - c);
        if (z === z0 && Math.abs(x - x0 - c) < 1 && y < h + 2) return 0;
        return d < 3.6 && d > 2.4 ? B.ICE : -1;
      });
      break;
    }
    case "dome": {
      const c = 3;
      box(x0, h, z0, x1, h + 4, z1, (x, y, z) => {
        const d = Math.hypot(x - x0 - c, (y - h) * 1.1, z - z0 - c);
        if (z === z0 && Math.abs(x - x0 - c) < 1 && y < h + 2) return 0;
        return d < 3.7 && d > 2.6 ? ((x + y) % 3 === 0 ? B.WINDOW : B.METAL) : -1;
      });
      put(x0 + 3, h + 4, z0 + 3, B.LAMP);
      break;
    }
    case "ruin": {
      shell(x0, h, z0, x1, h + 4, z1, B.STONE2, { door: true });
      box(x0, h, z0, x1, h + 4, z1, (x, y, z) => ((x === x0 || x === x1 || z === z0 || z === z1) && y > h + 1 && r() < 0.45 ? 0 : -1));
      put(x0 + 3, h, z0 + 3, B.CHEST);
      break;
    }
    case "hut": {
      shell(x0, h, z0, x1, h + 2, z1, B.PLANK, { door: true, corner: B.LOG });
      for (let k = 0; k < 3; k++) box(x0 - 1 + k, h + 3 + k, z0 - 1 + k, x1 + 1 - k, h + 3 + k, z1 + 1 - k, w.id === "jungle" || w.id === "cove" ? B.LEAVES : B.ROOF);
      break;
    }
    case "candyHouse": {
      shell(x0, h, z0, x1, h + 3, z1, B.BRICK, { win: B.WINDOW, door: true, corner: B.ACCENT2 });
      for (let k = 0; k < 4; k++) box(x0 - 1 + k, h + 4 + k, z0 - 1 + k, x1 + 1 - k, h + 4 + k, z1 + 1 - k, (x, _y, z) => ((x + z) % 2 ? B.ACCENT : B.ACCENT2));
      break;
    }
    case "crypt": {
      shell(x0, h, z0, x1, h + 3, z1, B.STONE2, { door: true, corner: B.BRICK });
      box(x0, h + 4, z0, x1, h + 4, z1, B.BRICK);
      box(x0 + 2, h + 5, z0 + 2, x1 - 2, h + 6, z1 - 2, B.STONE2);
      put(x0, h + 5, z0, B.LAMP); put(x1, h + 5, z1, B.LAMP);
      break;
    }
    case "lab": {
      shell(x0, h, z0, x1, h + 4, z1, B.METAL, { win: B.WINDOW, door: true });
      for (let k = 0; k < 3; k++) box(x0 + 1 + k, h + 5 + k, z0 + 1 + k, x1 - 1 - k, h + 5 + k, z1 - 1 - k, k === 2 ? B.LAMP : B.WINDOW);
      break;
    }
  }
}

// ------------------------------------------------------------------ props
function prop(kind: Prop, x: number, y: number, z: number, r: Rng, put: Put, w: World) {
  const blob = (cx: number, cy: number, cz: number, rad: number, id: number, id2 = -1, holes = 0.12) => {
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy * 1.15, dz);
      if (d > rad || (d > rad - 1 && r() < holes)) continue;
      put(cx + dx, cy + dy, cz + dz, id2 >= 0 && r() < 0.3 ? id2 : id);
    }
  };
  const col = (h: number, id: number, ox = 0, oz = 0) => { for (let k = 0; k < h; k++) put(x + ox, y + k, z + oz, id); };
  switch (kind) {
    case "oak": { const t = irange(r, 4, 6); col(t, B.LOG); blob(x, y + t, z, 2.4, B.LEAVES, B.LEAVES2, 0.2); break; }
    case "autumn": { const t = irange(r, 4, 6); col(t, B.LOG); blob(x, y + t, z, 2.5, B.LEAVES, B.LEAVES2, 0.25); break; }
    case "cherry": { const t = irange(r, 3, 5); col(t, B.LOG); put(x + 1, y + t - 1, z, B.LOG); blob(x, y + t + 1, z, 2.6, B.LEAVES, B.LEAVES2, 0.25); break; }
    case "jungleTree": {
      const t = irange(r, 7, 10); col(t, B.LOG);
      blob(x, y + t, z, 3.2, B.LEAVES, B.LEAVES2, 0.2);
      for (let k = 0; k < 5; k++) { const vx = x + irange(r, -3, 3), vz = z + irange(r, -3, 3), l = irange(r, 2, 4); for (let j = 0; j < l; j++) put(vx, y + t - 2 - j, vz, B.LEAVES2); }
      break;
    }
    case "pine": {
      const t = irange(r, 5, 8); col(t, B.LOG);
      for (let k = 0; k < 4; k++) { const rad = 2.6 - k * 0.6, yy = y + 2 + k * 2; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dz) <= rad) { put(x + dx, yy, z + dz, B.LEAVES); if (w.id === "frost" && r() < 0.4) put(x + dx, yy + 1, z + dz, B.TOP); } }
      put(x, y + t + 1, z, B.LEAVES);
      break;
    }
    case "palm": {
      const t = irange(r, 5, 7), dir = r() < 0.5 ? 1 : -1;
      for (let k = 0; k < t; k++) put(x + (k > t / 2 ? dir : 0), y + k, z, B.LOG);
      const tx = x + dir, ty = y + t;
      put(tx, ty, z, B.LEAVES);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) for (let k = 1; k <= 3; k++) put(tx + dx * k, ty - (k === 3 ? 1 : 0), z + dz * k, B.LEAVES);
      break;
    }
    case "cactus": {
      const t = irange(r, 3, 5); col(t, B.LEAVES);
      if (t > 3) { put(x + 1, y + 2, z, B.LEAVES); put(x + 2, y + 2, z, B.LEAVES); put(x + 2, y + 3, z, B.LEAVES); }
      if (r() < 0.5) { put(x - 1, y + 1, z, B.LEAVES); put(x - 2, y + 1, z, B.LEAVES); put(x - 2, y + 2, z, B.LEAVES); }
      break;
    }
    case "shroom": {
      const t = irange(r, 3, 7); col(t, B.LOG);
      const rad = 2 + t * 0.3;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dz);
        if (d <= rad) put(x + dx, y + t, z + dz, (dx * 3 + dz * 5 + t) % 4 === 0 ? B.LEAVES2 : B.LEAVES);
        if (d <= rad - 1.2) put(x + dx, y + t + 1, z + dz, (dx + dz) % 3 === 0 ? B.LEAVES2 : B.LEAVES);
      }
      break;
    }
    case "spire": { const t = irange(r, 3, 7); col(t, B.CRYSTAL); if (t > 4) { put(x + 1, y, z, B.CRYSTAL); put(x, y, z + 1, B.CRYSTAL); } break; }
    case "iceSpike": { const t = irange(r, 4, 8); col(t, B.ICE); put(x + 1, y, z, B.ICE); put(x - 1, y, z, B.ICE); put(x, y + 1, z + 1, B.ICE); break; }
    case "deadTree": {
      const t = irange(r, 4, 6); col(t, B.LOG);
      for (let k = 0; k < 3; k++) { const dx = irange(r, -1, 1) || 1, dz = irange(r, -1, 1), yy = y + 2 + k; put(x + dx, yy, z + dz, B.LOG); put(x + dx * 2, yy + 1, z + dz * 2, B.LOG); }
      break;
    }
    case "coral": {
      const t = irange(r, 2, 5);
      for (let k = 0; k < t; k++) { put(x + (k % 2), y + k, z, B.ACCENT); if (k > 0 && r() < 0.6) put(x - 1, y + k, z + (k % 2), B.LEAVES2); }
      blob(x, y + t, z, 1.3, B.LEAVES, B.ACCENT, 0.3);
      break;
    }
    case "lolly": { const t = irange(r, 3, 5); col(t, B.LOG); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= 2.3) put(x + dx, y + t + 2 + dy, z, (dx * dx + dy * dy) % 3 === 0 ? B.ACCENT2 : B.ACCENT); break; }
    case "boulder": blob(x, y, z, range(r, 1.2, 2.2), B.ROCK, B.STONE, 0.2); break;
    case "lampPost": col(3, B.PIPE); put(x, y + 3, z, B.LAMP); break;
    case "pumpkin": put(x, y, z, B.ACCENT); put(x + 1, y, z, B.ACCENT); put(x, y, z + 1, B.ACCENT); put(x + 1, y, z + 1, B.ACCENT); put(x, y + 1, z, B.LEAVES); break;
    case "grave": put(x, y, z, B.STONE2); put(x, y + 1, z, B.STONE2); put(x + 1, y, z, B.SOIL); break;
    case "pipes": col(3, B.PIPE); put(x + 1, y + 2, z, B.PIPE); put(x + 2, y + 2, z, B.PIPE); put(x + 2, y + 1, z, B.PIPE); break;
    case "neonSign": col(2, B.METAL); put(x, y + 2, z, B.ACCENT); put(x + 1, y + 2, z, B.LAMP); put(x - 1, y + 2, z, B.ACCENT2); break;
    case "pillar": col(irange(r, 3, 6), B.STONE2); put(x, y, z, B.STONE); break;
    case "crate": put(x, y, z, r() < 0.3 ? B.CHEST : B.PLANK); if (r() < 0.4) put(x, y + 1, z, B.PLANK); break;
  }
}
