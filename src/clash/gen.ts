// Builds a stage's map from its plan (seeded, so stage n is the same for everyone):
// - Sky Clash: a ring of small floating islands (one per player) around a big middle island with loot chests and gold
//   ore; every island hangs from an unbreakable heart rock, and anything cut off from it falls into the void;
// - Crystal Clash: one island per team with its crystal on a plinth, team-coloured trim and gold ore, around a middle
//   island; Titan Fight: a broad arena island;
// - Zombie Night: a walled village on solid ground — cottages, fences, lamps, a plaza with a campfire — with gates at
//   the edges where the mobs come in;
// - Obby Run: a long parkour course over the void — hops, beams, jump pads, lava strips, ice, crumbling clouds,
//   stepping stones and gaps that only a shot target bridges — with checkpoints and a finish pad.
import { B, TEAM_CUBE } from "./blocks";
import { Voxels } from "./voxels";
import type { StagePlan } from "./stages";
import { THEMES, type Prop, type Theme } from "./worlds";
import { clamp, fbm, irange, makeRng, noise2, pick, range, type Rng } from "./util";

export type PickupKind = "coin" | "gem" | "oil" | "heart" | "health" | "power" | "cubes";
export interface Isle { x: number; y: number; z: number; r: number; team: number }
export interface Crystal { team: number; x: number; y: number; z: number; hp: number; maxHp: number; alive: boolean }
export interface Target { x: number; y: number; z: number; cells: number[]; done: boolean }
export interface GameMap {
  vox: Voxels; walled: boolean;
  spawn: { x: number; y: number; z: number; yaw: number };
  isles: Isle[]; crystals: Crystal[];
  gates: { x: number; z: number }[];
  checkpoints: { x: number; y: number; z: number }[];
  finish: { x: number; y: number; z: number } | null;
  targets: Target[];
  pickups: { kind: PickupKind; x: number; y: number; z: number }[];
  center: { x: number; y: number; z: number };
  voidY: number;
}

export function buildMap(plan: StagePlan): GameMap {
  const t = THEMES[plan.themeIndex];
  const t2 = plan.blend ? THEMES.find((x) => x.id === plan.blend)! : null;
  const r = makeRng(plan.seed);
  switch (plan.mode) {
    case "zombie": return village(plan, t, r);
    case "obby": return course(plan, t, r);
    default: return skies(plan, t, t2, r);
  }
}

type Put = (x: number, y: number, z: number, id: number) => void;
const topOf = (t: Theme) => (t.topBlock === "sand" ? B.SAND : t.topBlock === "snow" ? B.SNOW : t.topBlock === "stone" ? B.STONE : B.GRASS);

/** a floating island: a flat top on a rough, tapering rock body that hangs from an anchor */
function island(V: Voxels, put: Put, cx: number, cy: number, cz: number, rad: number, t: Theme, r: Rng, n: (x: number, y: number) => number) {
  const R = Math.ceil(rad) + 2;
  const depth = Math.round(rad * 0.9 + 2);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dz) + (n(cx + dx, cz + dz) - 0.5) * 2.2;
    if (d > rad) continue;
    const below = Math.round(depth * (1 - (d / rad) ** 1.6) + n(cx + dx + 40, cz + dz) * 2);
    for (let k = 0; k <= below; k++) {
      const y = cy - k;
      put(cx + dx, y, cz + dz, k === 0 ? topOf(t) : k < 3 ? (t.topBlock === "snow" ? B.SNOW : B.SOIL) : (n(cx + dx, y * 3) > 0.62 ? B.ORE : B.STONE));
    }
  }
  // the heart rock: an unbreakable spine down the middle
  for (let k = 1; k <= depth - 1; k++) put(cx, cy - k, cz, B.ANCHOR);
  void V; void r;
}

function prop(kind: Prop, x: number, y: number, z: number, r: Rng, put: Put) {
  const col = (h: number, id: number) => { for (let k = 0; k < h; k++) put(x, y + k, z, id); };
  const blob = (cy: number, rad: number, id: number) => { const R = Math.ceil(rad); for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (Math.hypot(dx, dy * 1.2, dz) <= rad && r() > 0.08) put(x + dx, cy + dy, z + dz, id); };
  switch (kind) {
    case "oak": { const h = irange(r, 3, 5); col(h, B.LOG); blob(y + h, 2.2, B.LEAVES); break; }
    case "blossom": { const h = irange(r, 3, 4); col(h, B.LOG); blob(y + h + 1, 2.4, B.LEAVES); break; }
    case "pine": { const h = irange(r, 4, 6); col(h, B.LOG); for (let k = 0; k < 3; k++) { const rr = 2.2 - k * 0.7; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= rr) put(x + dx, y + 2 + k * 2, z + dz, B.LEAVES); } put(x, y + h + 1, z, B.LEAVES); break; }
    case "palm": { const h = irange(r, 4, 6); col(h, B.LOG); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= 2; k++) put(x + dx * k, y + h - (k === 2 ? 1 : 0), z + dz * k, B.LEAVES); put(x, y + h, z, B.LEAVES); break; }
    case "cactus": { const h = irange(r, 2, 4); col(h, B.LEAVES); if (h > 2) { put(x + 1, y + 1, z, B.LEAVES); put(x + 1, y + 2, z, B.LEAVES); } break; }
    case "shroom": { const h = irange(r, 3, 5); col(h, B.LOG); for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= 2.3) put(x + dx, y + h, z + dz, B.LEAVES); break; }
    case "spire": { const h = irange(r, 2, 5); col(h, B.GLASS); break; }
    case "deadTree": { const h = irange(r, 3, 5); col(h, B.LOG); put(x + 1, y + h - 1, z, B.LOG); put(x - 1, y + h - 2, z, B.LOG); break; }
    case "lamp": col(2, B.METAL); put(x, y + 2, z, B.LAMP); break;
    case "boulder": blob(y, range(r, 0.9, 1.6), B.STONE); break;
    case "crate": put(x, y, z, r() < 0.4 ? B.CHEST : B.PLANK); break;
    case "flowers": put(x, y, z, B.ACCENT); break;
    case "candy": { const h = irange(r, 2, 4); col(h, B.LOG); blob(y + h + 1, 1.6, B.ACCENT); break; }
    case "coral": { const h = irange(r, 1, 3); col(h, B.ACCENT); put(x + 1, y + h, z, B.LEAVES); break; }
    case "pumpkin": put(x, y, z, B.ACCENT); put(x, y + 1, z, B.LEAVES); break;
  }
}

// ------------------------------------------------------------------ sky and crystal maps (and the titan arena)
function skies(plan: StagePlan, t: Theme, t2: Theme | null, r: Rng): GameMap {
  const S = 72, H = 44;
  const V = new Voxels(S, H, S, false);
  const n = noise2(plan.seed ^ 0x2c1b3c6d);
  const put: Put = (x, y, z, id) => { if (V.inside(x, y, z)) V.data[V.idx(x, y, z)] = id; };
  const cx = S / 2, cz = S / 2, cy = 22;
  const isles: Isle[] = [], crystals: Crystal[] = [], pickups: GameMap["pickups"] = [];
  const crystal = plan.mode === "crystal", titan = plan.mode === "titan";
  // the middle island (big for the titan)
  const midR = titan ? 15 : crystal ? 7 : 8;
  island(V, put, cx, cy, cz, midR, t, r, n);
  isles.push({ x: cx, y: cy, z: cz, r: midR, team: -1 });
  // a ring of islands: one per player (sky) or per team (crystal)
  const count = titan ? 1 : crystal ? plan.teams : plan.rivals + 1;
  const ringR = titan ? 0 : crystal ? 25 : 22 + Math.min(6, count);
  for (let i = 0; i < count && !titan; i++) {
    // i = 0 (the player, or the player's team) sits on the near side (−z), facing the middle
    const a = (i / count) * Math.PI * 2;
    const x = Math.round(cx + Math.sin(a) * ringR), z = Math.round(cz - Math.cos(a) * ringR);
    const y = cy + irange(r, -3, 3);
    const rad = crystal ? 6 : 3.6 + r();
    const th = t2 && i % 2 ? t2 : t;
    island(V, put, x, y, z, rad, th, r, n);
    isles.push({ x, y, z, r: rad, team: crystal ? i : i === 0 ? 0 : i });
    if (crystal) {
      // the crystal on a plinth of the team's cubes, guarded by a low wall
      const cube = TEAM_CUBE[i];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + 1, z + dz, cube);
      for (let k = 0; k < 8; k++) { const aa = (k / 8) * Math.PI * 2; put(Math.round(x + Math.cos(aa) * 3.5), y + 1, Math.round(z + Math.sin(aa) * 3.5), cube); }
      crystals.push({ team: i, x: x + 0.5, y: y + 2, z: z + 0.5, hp: 100, maxHp: 100, alive: true });
      for (let k = 0; k < 3; k++) put(x + irange(r, -4, 4), y, z + irange(r, -4, 4), B.ORE);
    } else {
      // a chest beside the islander; a prop on the side away from the middle (never on the player's island, where it
      // would sit right behind the camera)
      put(x + 2, y + 1, z + (i === 0 ? 1 : -1), B.CHEST);
      if (i > 0) prop(pick(r, th.props), Math.round(x + (x - cx) * 0.08) - 1, y + 1, Math.round(z + (z - cz) * 0.08), r, put);
    }
  }
  // stepping stones between the islands and the middle
  const stones = titan ? 0 : Math.round(count * (1.4 - plan.difficulty * 0.6));
  for (let i = 0; i < stones; i++) {
    const a = r() * Math.PI * 2, d = range(r, midR + 4, ringR - 5);
    island(V, put, Math.round(cx + Math.cos(a) * d), cy + irange(r, -2, 3), Math.round(cz + Math.sin(a) * d), range(r, 1.6, 2.4), t, r, n);
  }
  // the middle: chests, gold ore, props, a lookout tower
  for (let k = 0; k < (titan ? 6 : 3); k++) put(cx + irange(r, -midR + 2, midR - 2), cy + 1, cz + irange(r, -midR + 2, midR - 2), B.CHEST);
  for (let k = 0; k < 6; k++) { const px = cx + irange(r, -midR + 2, midR - 2), pz = cz + irange(r, -midR + 2, midR - 2); if (!V.get(px, cy + 1, pz)) prop(pick(r, t.props), px, cy + 1, pz, r, put); }
  if (!titan) { for (let y = cy + 1; y < cy + 6; y++) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(cx + dx, y, cz + dz, B.PLANK); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, cy + 6, cz + dz, B.PLANK); put(cx, cy + 7, cz, B.LAMP); }
  // floating cloud puffs for depth
  for (let k = 0; k < 10; k++) { const x = irange(r, 4, S - 5), z = irange(r, 4, S - 5), y = irange(r, cy - 14, cy - 6); for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) if (r() > 0.25) put(x + dx, y, z + dz, B.CLOUD); }
  // pickups on the middle island and the bridges' way
  const P = (kind: PickupKind, x: number, z: number) => { const y = V.top(x, z); if (y > 2) pickups.push({ kind, x: x + 0.5, y: y + 0.6, z: z + 0.5 }); };
  for (let k = 0; k < 10; k++) P("coin", cx + irange(r, -midR + 1, midR - 1), cz + irange(r, -midR + 1, midR - 1));
  P("oil", cx + 2, cz - 2); P("power", cx - 2, cz + 2); P("cubes", cx - 3, cz - 3); P("health", cx + 3, cz + 3);
  if (plan.n % 3 === 0 || titan) P("heart", cx, cz + 4);
  const me = isles[1] ?? isles[0];
  const spawn = titan ? { x: cx + 0.5, y: cy + 1.01, z: cz - midR + 3.5, yaw: 0 } : { x: me.x + 0.5, y: me.y + 1.01, z: me.z + 0.5, yaw: Math.atan2(cx - me.x, cz - me.z) };
  P("cubes", Math.floor(spawn.x) + 1, Math.floor(spawn.z));
  V.dirty.clear(); for (let i = 0; i < V.cx * V.cz; i++) V.dirty.add(i);
  return { vox: V, walled: false, spawn, isles, crystals, gates: [], checkpoints: [], finish: null, targets: [], pickups, center: { x: cx, y: cy, z: cz }, voidY: -8 };
}

// ------------------------------------------------------------------ zombie night: a walled village
function village(plan: StagePlan, t: Theme, r: Rng): GameMap {
  const S = 46, H = 34;
  const V = new Voxels(S, H, S, true);
  const n = noise2(plan.seed ^ 0x1b873593);
  const put: Put = (x, y, z, id) => { if (V.inside(x, y, z)) V.data[V.idx(x, y, z)] = id; };
  const used = new Uint8Array(S * S);
  const cx = S / 2, cz = S / 2;
  const top = topOf(t);
  const H0 = new Int16Array(S * S);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const e = Math.min(x, z, S - 1 - x, S - 1 - z);
    let h = 3 + Math.round((fbm(n, x * 0.08, z * 0.08, 2) - 0.45) * 2);
    if (e < 3) h += 3 - e;
    if (Math.hypot(x - cx, z - cz) < 7) h = 3;
    h = clamp(h, 2, 8);
    H0[z * S + x] = h;
    put(x, 0, z, B.ANCHOR);
    for (let y = 1; y < h; y++) put(x, y, z, y === h - 1 ? top : y > h - 3 ? B.SOIL : B.STONE);
  }
  // the plaza: a stone ring around a campfire beacon
  for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) { const d = Math.hypot(x, z); if (d < 6.2) { put(cx + x, 2, cz + z, d < 2 ? B.BRICK : B.STONE); used[(cz + z) * S + cx + x] = 1; } }
  put(cx, 3, cz, B.LAMP); put(cx + 1, 3, cz, B.LOG); put(cx - 1, 3, cz, B.LOG);
  // cottages around it
  const houses = 4 + Math.round(plan.difficulty * 3);
  for (let i = 0; i < houses; i++) {
    const a = (i / houses) * Math.PI * 2 + r() * 0.3, d = range(r, 11, 15);
    const hx = Math.round(cx + Math.cos(a) * d) - 2, hz = Math.round(cz + Math.sin(a) * d) - 2;
    if (hx < 4 || hz < 4 || hx > S - 9 || hz > S - 9) continue;
    const base = H0[hz * S + hx];
    for (let z = hz; z < hz + 5; z++) for (let x = hx; x < hx + 5; x++) {
      used[z * S + x] = 1;
      for (let y = 1; y < base; y++) if (!V.get(x, y, z)) put(x, y, z, B.STONE);
      const edge = x === hx || x === hx + 4 || z === hz || z === hz + 4;
      for (let y = base; y < base + 3; y++) {
        if (!edge) { put(x, y, z, 0); continue; }
        const door = z === hz && x === hx + 2 && y < base + 2;
        put(x, y, z, door ? 0 : (x === hx || x === hx + 4) && (z === hz || z === hz + 4) ? B.LOG : y === base + 1 && (x === hx + 2 || z === hz + 2) ? B.GLASS : B.PLANK);
      }
    }
    for (let k = 0; k < 3; k++) for (let z = hz - 1 + k; z <= hz + 5 - k; z++) for (let x = hx - 1 + k; x <= hx + 5 - k; x++) put(x, base + 3 + k, z, B.ROOF);
  }
  // fences and lamps
  for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = range(r, 8, 18); const x = Math.round(cx + Math.cos(a) * d), z = Math.round(cz + Math.sin(a) * d); if (!used[z * S + x]) { prop(pick(r, t.props), x, V.top(x, z), z, r, put); used[z * S + x] = 1; } }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * 9), z = Math.round(cz + Math.sin(a) * 9); if (!V.get(x, 3, z)) prop("lamp", x, V.top(x, z), z, r, put); }
  // gates at the edges
  const gates = [{ x: 3, z: cz }, { x: S - 4, z: cz }, { x: cx, z: 3 }, { x: cx, z: S - 4 }];
  for (const g of gates) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = g.x + dx, z = g.z + dz; for (let y = 3; y < H; y++) put(x, y, z, 0); put(x, 2, z, B.ANCHOR); }
  const pickups: GameMap["pickups"] = [];
  const P = (kind: PickupKind, x: number, z: number) => { pickups.push({ kind, x: x + 0.5, y: V.top(x, z) + 0.6, z: z + 0.5 }); };
  for (let k = 0; k < 8; k++) P("coin", cx + irange(r, -5, 5), cz + irange(r, -5, 5));
  P("oil", cx + 3, cz); P("cubes", cx - 3, cz); P("health", cx, cz + 3); P("power", cx, cz - 3);
  if (plan.n % 3 === 0 || plan.mode === "titan") P("heart", cx + 4, cz + 4);
  V.dirty.clear(); for (let i = 0; i < V.cx * V.cz; i++) V.dirty.add(i);
  return { vox: V, walled: true, spawn: { x: cx + 0.5, y: 3.01, z: cz - 3.5, yaw: 0 }, isles: [], crystals: [], gates, checkpoints: [], finish: null, targets: [], pickups, center: { x: cx, y: 3, z: cz }, voidY: -8 };
}

// ------------------------------------------------------------------ obby run: a parkour course over the void
function course(plan: StagePlan, t: Theme, r: Rng): GameMap {
  const segs = plan.course;
  const X = 28, H = 48, Z = 16 + segs * 8 + 20;
  const V = new Voxels(X, H, Z, false);
  const put: Put = (x, y, z, id) => { if (V.inside(x, y, z)) V.data[V.idx(x, y, z)] = id; };
  const plat = (x: number, y: number, z: number, w: number, d: number, id: number) => { for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) put(x + dx, y, z + dz, id); put(x + Math.floor(w / 2), y - 1, z + Math.floor(d / 2), B.ANCHOR); };
  const top = topOf(t);
  let x = Math.floor(X / 2) - 2, y = 12, z = 4;
  plat(x - 1, y, z - 2, 7, 6, top);
  for (let dz = 0; dz < 6; dz++) for (let dx = 0; dx < 7; dx++) put(x - 1 + dx, y - 1, z - 2 + dz, B.SOIL);
  const spawn = { x: x + 1.5, y: y + 1.01, z: z + 0.5, yaw: 0 };
  z += 6;
  const checkpoints: GameMap["checkpoints"] = [], targets: Target[] = [], pickups: GameMap["pickups"] = [];
  const kinds = ["hop", "beam", "pad", "lava", "ice", "stones", "target", "crumble", "tower", "hop"] as const;
  for (let i = 0; i < segs; i++) {
    const k = i === 0 ? "hop" : pick(r, kinds);
    const d = plan.difficulty;
    if (i > 0 && i % 5 === 0) {
      // checkpoint pad
      x = clamp(x + irange(r, -3, 3), 3, X - 6); y = clamp(y + irange(r, -1, 1), 6, H - 10); z += 3;
      plat(x, y, z, 4, 4, B.CHECK);
      checkpoints.push({ x: x + 2, y: y + 1, z: z + 2 });
      pickups.push({ kind: "coin", x: x + 2, y: y + 1.6, z: z + 2 });
      z += 4;
      continue;
    }
    switch (k) {
      case "hop": { const gap = 2 + Math.round(d * 1.6 + r()); z += gap; x = clamp(x + irange(r, -2, 2), 3, X - 6); y = clamp(y + irange(r, -1, 1), 6, H - 10); const w = 3 - Math.round(d); plat(x, y, z, Math.max(2, w), Math.max(2, w), top); pickups.push({ kind: "coin", x: x + 1, y: y + 1.6, z: z + 1 }); z += Math.max(2, w); break; }
      case "beam": { z += 2; const len = 5 + Math.round(d * 4); for (let k2 = 0; k2 < len; k2++) put(x + 1, y, z + k2, B.PLANK); put(x + 1, y - 1, z + Math.floor(len / 2), B.ANCHOR); for (let k2 = 1; k2 < len; k2 += 2) pickups.push({ kind: "coin", x: x + 1.5, y: y + 1.6, z: z + k2 + 0.5 }); z += len; break; }
      case "pad": { z += 2; plat(x, y, z, 3, 3, B.STONE); put(x + 1, y, z + 1, B.PAD); z += 3; z += 3; y = clamp(y + 5, 6, H - 8); plat(x, y, z, 3, 3, top); z += 3; break; }
      case "lava": { z += 2; plat(x, y, z, 3, 8, B.STONE); for (let dx = 0; dx < 3; dx++) { put(x + dx, y, z + 3, B.LAVA); put(x + dx, y, z + 4, B.LAVA); } z += 8; break; }
      case "ice": { z += 2; plat(x, y, z, 3, 7, B.ICE); z += 7; break; }
      case "stones": { for (let k2 = 0; k2 < 4; k2++) { z += 2 + Math.round(d); x = clamp(x + (k2 % 2 ? 2 : -2), 3, X - 4); y = clamp(y + irange(r, 0, 1), 6, H - 10); put(x, y, z, top); put(x, y - 1, z, B.ANCHOR); pickups.push({ kind: "coin", x: x + 0.5, y: y + 1.6, z: z + 0.5 }); } z += 1; break; }
      case "target": {
        // a gap too wide to jump; shoot the target on the pillar to build the bridge
        z += 1; plat(x, y, z, 3, 2, top); z += 2;
        const len = 6;
        const cells: number[] = [];
        for (let k2 = 0; k2 < len; k2++) cells.push(x + 1, y, z + k2);
        plat(x, y, z + len, 3, 3, top);
        put(x + 4, y + 1, z + len, B.ANCHOR); put(x + 4, y + 2, z + len, B.METAL); put(x + 4, y + 3, z + len, B.TARGET);
        targets.push({ x: x + 4, y: y + 3, z: z + len, cells, done: false });
        z += len + 3; break;
      }
      case "crumble": { z += 2; for (let k2 = 0; k2 < 6; k2++) for (let dx = 0; dx < 2; dx++) put(x + dx, y, z + k2, B.CLOUD); z += 6; plat(x, y, z, 3, 2, top); z += 2; break; }
      case "tower": { z += 2; plat(x, y, z, 3, 3, B.STONE); for (let k2 = 1; k2 <= 4; k2++) { const sx = x + [0, 2, 2, 0][k2 % 4], sz = z + [0, 0, 2, 2][k2 % 4]; put(sx, y + k2, sz, B.PLANK); } put(x + 1, y + 1, z + 1, B.ANCHOR); for (let k2 = 1; k2 <= 3; k2++) put(x + 1, y + k2, z + 1, B.LOG); y += 4; z += 3; break; }
    }
    if (r() < 0.12) pickups.push({ kind: pick(r, ["oil", "power", "health", "cubes"] as PickupKind[]), x: x + 1, y: y + 1.6, z: z - 1 });
    z = Math.min(z, Z - 14);
  }
  // the finish
  z += 3; x = clamp(x, 3, X - 8); plat(x - 1, y, z, 6, 6, B.FINISH);
  for (let k2 = 1; k2 <= 5; k2++) put(x - 1, y + k2, z, B.METAL);
  for (let k2 = 0; k2 < 3; k2++) for (let dy = 0; dy < 2; dy++) put(x + k2, y + 4 + dy, z, (k2 + dy) % 2 ? B.CUBE_BLUE : B.CLOUD);
  const finish = { x: x + 2, y: y + 1, z: z + 3 };
  pickups.push({ kind: "gem", x: x + 2, y: y + 1.6, z: z + 3 });
  if (plan.n % 3 === 0) pickups.push({ kind: "heart", x: spawn.x + 1, y: spawn.y + 0.6, z: spawn.z + 2 });
  V.dirty.clear(); for (let i = 0; i < V.cx * V.cz; i++) V.dirty.add(i);
  return { vox: V, walled: false, spawn, isles: [], crystals: [], gates: [], checkpoints, finish, targets, pickups, center: { x: X / 2, y, z: Z / 2 }, voidY: 0 };
}
