// A heist site, built block by block: the lot (the district's ground, a road along the front where the van pulls up, a
// pavement, fences or hedges, trees and street lamps), and the building to break into, by kind —
//  - bank: brick on a stone base, columns and a gold sign out front, a tellers' counter, offices, safes, and the vault
//    at the back behind thick vault steel;
//  - jeweler: a glass shop front, display cases full of gems, a back room with safes;
//  - museum: marble halls under a stepped roof, art on the walls, gold artefacts on pedestals, a vault;
//  - casino: neon trim, carpet, gold decor, cash cages, a big vault;
//  - mansion: plaster and a pitched roof, wood floors, rooms of safes and paintings, a garden;
//  - warehouse: brick and steel, stacked crates (with cash inside some), a steel strongroom;
//  - temple: stone steps and a stepped pyramid roof, gold idols;
//  - observatory and lab: steel and glass, a dome, server racks, a vault;
//  - vault hall: thick walls and several vaults.
// Every building has one to three floors joined by stairs, windows, a front door, rooms, and the loot spots (cash
// stacks, gold bars, gems, art). Guards come out of hatches round the lot, drones from the roof, and turrets sit on
// the walls (they fall when the wall under them goes).
import { AIR, BRICK, CARPET, CRATE, FENCE, GLASS, GOLD, GROUND, LEAF, MARBLE, METAL, NEON, PLASTER, ROAD, ROOF, SAFE, STEEL, STONE, TILE, TRIM, TRUNK, VAULT, WOOD, DIRT } from "./materials";
import { VS, type VoxelWorld } from "./voxels";
import type { BuildingKind, District } from "./districts";
import { makeRng, pick, range } from "./util";

export type LootKind = "cash" | "gold" | "gem" | "art";
export interface LootSpot { x: number; y: number; z: number; kind: LootKind; value: number }
export interface Spot { x: number; y: number; z: number; yaw: number }
export interface SiteLayout {
  loot: LootSpot[];
  hatches: Spot[]; turrets: Spot[]; roof: Spot[];
  van: Spot; spawn: Spot;
  /** the building's footprint (cells) and top */
  box: { i0: number; k0: number; i1: number; k1: number; j1: number };
  vaults: { x: number; y: number; z: number; i0: number; i1: number; k0: number; k1: number }[];
  /** a quick count of the building's blocks (how much there is to break) */
  blocks: number;
}

const VALUE: Record<LootKind, number> = { cash: 40, gold: 90, gem: 70, art: 120 };

interface Style {
  wall: number; base: number; floor: number; roof: "flat" | "pitched" | "stepped" | "dome"; windows: "row" | "tall" | "store" | "slit";
  columns: boolean; desks: number; safes: number; cases: number; art: number; crates: number; gold: number; vaults: number; neon: boolean; floors: [number, number];
}
const STYLES: Record<BuildingKind, Style> = {
  bank: { wall: BRICK, base: STONE, floor: TILE, roof: "flat", windows: "tall", columns: true, desks: 4, safes: 4, cases: 0, art: 1, crates: 0, gold: 0, vaults: 1, neon: false, floors: [1, 3] },
  jeweler: { wall: PLASTER, base: STONE, floor: CARPET, roof: "flat", windows: "store", columns: false, desks: 1, safes: 3, cases: 6, art: 1, crates: 0, gold: 0, vaults: 1, neon: false, floors: [1, 2] },
  museum: { wall: MARBLE, base: STONE, floor: TILE, roof: "stepped", windows: "tall", columns: true, desks: 0, safes: 1, cases: 5, art: 6, crates: 0, gold: 3, vaults: 1, neon: false, floors: [1, 2] },
  casino: { wall: PLASTER, base: TRIM, floor: CARPET, roof: "flat", windows: "row", columns: false, desks: 3, safes: 3, cases: 2, art: 2, crates: 0, gold: 4, vaults: 1, neon: true, floors: [2, 3] },
  mansion: { wall: PLASTER, base: BRICK, floor: WOOD, roof: "pitched", windows: "row", columns: false, desks: 2, safes: 4, cases: 1, art: 5, crates: 0, gold: 1, vaults: 0, neon: false, floors: [2, 3] },
  warehouse: { wall: BRICK, base: STEEL, floor: METAL, roof: "flat", windows: "slit", columns: false, desks: 1, safes: 2, cases: 0, art: 0, crates: 14, gold: 2, vaults: 1, neon: false, floors: [1, 2] },
  temple: { wall: STONE, base: STONE, floor: TILE, roof: "stepped", windows: "slit", columns: true, desks: 0, safes: 1, cases: 3, art: 2, crates: 0, gold: 6, vaults: 1, neon: false, floors: [1, 2] },
  observatory: { wall: PLASTER, base: STEEL, floor: METAL, roof: "dome", windows: "row", columns: false, desks: 3, safes: 2, cases: 3, art: 1, crates: 2, gold: 1, vaults: 1, neon: false, floors: [1, 2] },
  lab: { wall: STEEL, base: STEEL, floor: METAL, roof: "flat", windows: "store", columns: false, desks: 4, safes: 3, cases: 3, art: 0, crates: 4, gold: 2, vaults: 1, neon: true, floors: [1, 3] },
  vaulthall: { wall: STONE, base: STEEL, floor: METAL, roof: "flat", windows: "slit", columns: true, desks: 1, safes: 3, cases: 1, art: 1, crates: 2, gold: 3, vaults: 3, neon: false, floors: [1, 2] },
};

export const LOT = { nx: 96, ny: 40, nz: 96 };
const H = 7; // storey height in blocks

export function buildSite(w: VoxelWorld, kind: BuildingKind, d: District, seed: number, size: number): SiteLayout {
  const r = makeRng(seed);
  const st = STYLES[kind];
  const nx = w.nx, nz = w.nz;
  const L: SiteLayout = { loot: [], hatches: [], turrets: [], roof: [], van: { x: 0, y: 0, z: 0, yaw: 0 }, spawn: { x: 0, y: 0, z: 0, yaw: 0 }, box: { i0: 0, k0: 0, i1: 0, k1: 0, j1: 0 }, vaults: [], blocks: 0 };
  const P = (i: number, j: number, k: number) => ({ x: w.wx(i), y: j * VS, z: w.wz(k) });
  const loot = (i: number, j: number, k: number, kind2: LootKind, mul = 1) => { const p = P(i, j, k); L.loot.push({ ...p, kind: kind2, value: Math.round(VALUE[kind2] * mul) }); };

  // ---------------------------------------------------------------- the lot
  w.fill(0, 0, 0, nx - 1, 0, nz - 1, GROUND, true);
  const road0 = 3, road1 = 12;
  w.fill(0, 0, road0, nx - 1, 0, road1, AIR);
  w.fill(0, 0, road0, nx - 1, 0, road1, GROUND); // the road keeps the ground's height; painted as road
  for (let i = 0; i < nx; i++) for (let k = road0; k <= road1; k++) w.data[w.idx(i, 0, k)] = ROAD;
  // a kerb and the pavement
  w.fill(0, 1, road1 + 1, nx - 1, 1, road1 + 1, STONE);
  // the building
  const W = Math.round(range(r, 22, 30) + size * 10) & ~1, D = Math.round(range(r, 18, 24) + size * 8) & ~1;
  const floors = Math.max(st.floors[0], Math.min(st.floors[1], st.floors[0] + Math.round(size * (st.floors[1] - st.floors[0]) + r() * 0.6)));
  const i0 = Math.floor(nx / 2 - W / 2), i1 = i0 + W - 1, k0 = road1 + 9, k1 = Math.min(nz - 8, k0 + D - 1);
  const top = floors * H;
  L.box = { i0, k0, i1, k1, j1: top + 6 };
  // fences or hedges round the lot, with a gap at the front path
  const fenceMat = d.id === "maple" || d.id === "pirate" || d.id === "dune" ? FENCE : d.id === "jungle" || d.id === "blossom" ? LEAF : STEEL;
  for (let i = 2; i < nx - 2; i++) for (const k of [road1 + 3, nz - 3]) if (Math.abs(i - nx / 2) > 3 || k !== road1 + 3) { w.set(i, 1, k, fenceMat); if (i % 4 === 0 || fenceMat === LEAF) w.set(i, 2, k, fenceMat); }
  for (let k = road1 + 3; k < nz - 2; k++) for (const i of [2, nx - 3]) { w.set(i, 1, k, fenceMat); if (k % 4 === 0 || fenceMat === LEAF) w.set(i, 2, k, fenceMat); }
  // the front path
  for (let k = road1 + 2; k < k0; k++) for (let i = nx / 2 - 2; i <= nx / 2 + 1; i++) w.data[w.idx(i, 0, k)] = ROAD;
  // trees and lamps
  const tree = (ti: number, tk: number) => {
    const h = 5 + Math.floor(r() * 4);
    w.fill(ti, 1, tk, ti, h, tk, TRUNK);
    const rr = 2 + (r() < 0.5 ? 1 : 0);
    for (let j = h - 1; j <= h + 2; j++) for (let k = tk - rr; k <= tk + rr; k++) for (let i = ti - rr; i <= ti + rr; i++) {
      const dd = Math.abs(i - ti) + Math.abs(k - tk) + Math.abs(j - h - 0.5) * 1.2;
      if (dd <= rr + 0.8 && w.get(i, j, k) === AIR && r() < 0.92) w.set(i, j, k, LEAF);
    }
  };
  const lamp = (li: number, lk: number) => { w.fill(li, 1, lk, li, 7, lk, STEEL); w.set(li, 8, lk, NEON); };
  for (let i = 8; i < nx - 8; i += 14) { lamp(i, road1 + 1); }
  const spots: [number, number][] = [];
  for (let k = road1 + 6; k < nz - 6; k += 3) for (let i = 6; i < nx - 6; i += 3) if (i < i0 - 4 || i > i1 + 4 || k > k1 + 4) spots.push([i, k]);
  for (let t = 0; t < 7 + Math.floor(r() * 5) && spots.length; t++) { const [ti, tk] = spots.splice(Math.floor(r() * spots.length), 1)[0]; tree(ti, tk); }
  // a few crates and barrels in the yard (some with cash)
  for (let t = 0; t < 5 && spots.length; t++) { const [ci, ck] = spots.splice(Math.floor(r() * spots.length), 1)[0]; if (w.get(ci, 1, ck) === AIR) { w.set(ci, 1, ck, CRATE); if (r() < 0.5) w.set(ci, 2, ck, CRATE); } }

  // ---------------------------------------------------------------- the shell
  for (let f = 0; f < floors; f++) {
    const fy = f * H;
    // the floor slab and the walls
    w.fill(i0, fy + (f === 0 ? 0 : 0), k0, i1, fy + (f === 0 ? 0 : 0), k1, f === 0 ? GROUND : st.floor);
    if (f > 0) w.fill(i0, fy, k0, i1, fy, k1, st.floor);
    for (let j = fy + 1; j < fy + H; j++) {
      for (let i = i0; i <= i1; i++) { w.set(i, j, k0, st.wall); w.set(i, j, k1, st.wall); }
      for (let k = k0; k <= k1; k++) { w.set(i0, j, k, st.wall); w.set(i1, j, k, st.wall); }
    }
    if (f === 0) for (let i = i0; i <= i1; i++) for (let k = k0 + 1; k < k1; k++) w.data[w.idx(i, 0, k)] = st.floor === WOOD ? WOOD : st.floor === CARPET ? CARPET : st.floor === METAL ? METAL : TILE;
    // a band of trim between floors
    for (let i = i0; i <= i1; i++) { w.set(i, fy + H - 1, k0, TRIM); w.set(i, fy + H - 1, k1, TRIM); }
    for (let k = k0; k <= k1; k++) { w.set(i0, fy + H - 1, k, TRIM); w.set(i1, fy + H - 1, k, TRIM); }
    // windows
    const win = (i: number, k: number, along: "x" | "z") => {
      const tall = st.windows === "tall" ? 4 : st.windows === "slit" ? 3 : st.windows === "store" && f === 0 ? 5 : 3;
      const wide = st.windows === "slit" ? 1 : st.windows === "store" && f === 0 ? 3 : 2;
      for (let a = 0; a < wide; a++) for (let j = fy + 2; j < fy + 2 + tall; j++) { if (along === "x") w.set(i + a, j, k, GLASS); else w.set(i, j, k + a, GLASS); }
    };
    const stepW = st.windows === "store" && f === 0 ? 4 : 5;
    for (let i = i0 + 3; i <= i1 - 4; i += stepW) { if (f === 0 && Math.abs(i - nx / 2) < 4) continue; win(i, k0, "x"); win(i, k1, "x"); }
    for (let k = k0 + 3; k <= k1 - 4; k += stepW + 1) { win(i0, k, "z"); win(i1, k, "z"); }
    // the outside base course
    if (f === 0) for (let i = i0 - 1; i <= i1 + 1; i++) for (let k = k0 - 1; k <= k1 + 1; k++) if (i === i0 - 1 || i === i1 + 1 || k === k0 - 1 || k === k1 + 1) w.set(i, 1, k, st.base);
  }
  // the front door: a glass double door
  for (let j = 1; j <= 6; j++) for (let i = nx / 2 - 2; i <= nx / 2 + 1; i++) { w.set(i, j, k0, j <= 5 ? GLASS : TRIM); w.set(i, j, k0 - 1, j === 1 ? STONE : AIR); }
  // steps up to it
  for (let i = nx / 2 - 3; i <= nx / 2 + 2; i++) w.set(i, 1, k0 - 2, STONE);
  // columns along the front
  if (st.columns) for (let i = i0 + 1; i <= i1 - 1; i += 4) { if (Math.abs(i - nx / 2) < 3) continue; w.fill(i, 1, k0 - 3, i, top - 1, k0 - 3, kind === "temple" ? STONE : MARBLE); w.set(i, top, k0 - 3, TRIM); }
  if (st.columns) w.fill(i0, top, k0 - 4, i1, top, k0 - 1, TRIM);
  // neon trim
  if (st.neon) for (let i = i0; i <= i1; i++) { w.set(i, top, k0 - 1, NEON); }

  // ---------------------------------------------------------------- the roof
  const roofY = top;
  if (st.roof === "flat") {
    w.fill(i0, roofY, k0, i1, roofY, k1, ROOF);
    for (let i = i0; i <= i1; i++) { w.set(i, roofY + 1, k0, TRIM); w.set(i, roofY + 1, k1, TRIM); }
    for (let k = k0; k <= k1; k++) { w.set(i0, roofY + 1, k, TRIM); w.set(i1, roofY + 1, k, TRIM); }
    // a rooftop box (air conditioning) and the drone pad
    w.fill(i0 + 3, roofY + 1, k1 - 6, i0 + 6, roofY + 2, k1 - 3, STEEL);
  } else if (st.roof === "pitched" || st.roof === "stepped") {
    const step = st.roof === "pitched" ? 1 : 2;
    for (let s = 0; ; s++) {
      const a0 = i0 - 1 + s * step, a1 = i1 + 1 - s * step, b0 = k0 - 1 + (st.roof === "stepped" ? s * step : 0), b1 = k1 + 1 - (st.roof === "stepped" ? s * step : 0);
      if (a0 > a1 || b0 > b1 || s > 12) break;
      w.fill(a0, roofY + s, b0, a1, roofY + s, b1, ROOF);
      if (st.roof === "pitched") { w.fill(a0 + 1, roofY + s, b0 + 1, a1 - 1, roofY + s, b1 - 1, AIR); }
    }
    if (st.roof === "pitched") { for (let k = k0; k <= k1; k++) { w.set(i0, roofY, k, st.wall); w.set(i1, roofY, k, st.wall); } }
  } else {
    // a dome of steel and glass
    w.fill(i0, roofY, k0, i1, roofY, k1, ROOF);
    const ci = (i0 + i1) / 2, ck = (k0 + k1) / 2, R = Math.min(W, D) / 2 - 2;
    for (let j = 0; j < R; j++) {
      const rr = Math.sqrt(Math.max(0, R * R - j * j));
      for (let k = Math.floor(ck - rr); k <= Math.ceil(ck + rr); k++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
        const dd = Math.hypot(i - ci, k - ck);
        if (dd <= rr && dd > rr - 1.4) w.set(i, roofY + 1 + j, k, (i + j) % 5 === 0 ? GLASS : STEEL);
      }
    }
  }

  // ---------------------------------------------------------------- inside
  const inner = { i0: i0 + 1, i1: i1 - 1, k0: k0 + 1, k1: k1 - 1 };
  // stairs along the left wall up through each floor
  for (let f = 0; f < floors - 1; f++) {
    const fy = f * H;
    for (let s = 0; s < H; s++) {
      const k = inner.k0 + 2 + s;
      w.fill(inner.i0, fy + 1, k, inner.i0 + 2, fy + s, k, st.floor === CARPET ? WOOD : st.floor);
      w.fill(inner.i0, fy + H, k, inner.i0 + 2, fy + H, k, AIR);
    }
    w.fill(inner.i0, fy + H, inner.k0 + 1, inner.i0 + 2, fy + H, inner.k0 + 1, AIR);
  }
  // the vault(s): thick steel rooms against the back wall
  const vaults = st.vaults;
  const vw = 8, vd = 7;
  for (let v = 0; v < vaults; v++) {
    const vi0 = Math.round(i0 + W * ((v + 1) / (vaults + 1)) - vw / 2), vi1 = vi0 + vw, vk1 = k1 - 1, vk0 = vk1 - vd;
    if (vi0 < inner.i0 + 4 || vi1 > inner.i1) continue;
    for (let j = 1; j <= 6; j++) for (let k = vk0; k <= vk1; k++) for (let i = vi0; i <= vi1; i++) {
      const edge = i <= vi0 + 1 || i >= vi1 - 1 || k <= vk0 + 1 || j === 6;
      w.set(i, j, k, edge ? VAULT : AIR);
    }
    // gold inside
    for (let i = vi0 + 3; i <= vi1 - 3; i++) for (let k = vk0 + 3; k <= vk1 - 1; k++) if ((i + k) % 2 === 0) { w.set(i, 1, k, GOLD); if (r() < 0.5) w.set(i, 2, k, GOLD); }
    for (let t = 0; t < 4; t++) loot(vi0 + 2 + Math.floor(r() * (vw - 3)), 1, vk0 + 2 + Math.floor(r() * (vd - 2)), t % 2 ? "cash" : "gold", 1.6);
    L.vaults.push({ x: w.wx((vi0 + vi1) / 2), y: 1.5, z: w.wz(vk0), i0: vi0, i1: vi1, k0: vk0, k1: vk1 });
  }
  // rooms: partitions with doorways on each floor
  for (let f = 0; f < floors; f++) {
    const fy = f * H;
    const cut = inner.k0 + Math.floor((inner.k1 - inner.k0) * range(r, 0.45, 0.6));
    for (let i = inner.i0 + 4; i <= inner.i1; i++) for (let j = fy + 1; j < fy + H - 1; j++) if (w.get(i, j, cut) === AIR) w.set(i, j, cut, kind === "warehouse" ? STEEL : st.wall === MARBLE ? MARBLE : PLASTER);
    for (let gap = 0; gap < 2; gap++) { const gi = inner.i0 + 6 + Math.floor(r() * (inner.i1 - inner.i0 - 10)); w.fill(gi, fy + 1, cut, gi + 2, fy + 5, cut, AIR); }
    const xcut = Math.round((inner.i0 + inner.i1) / 2 + range(r, -4, 4));
    for (let k = cut + 1; k <= inner.k1; k++) for (let j = fy + 1; j < fy + H - 1; j++) if (w.get(xcut, j, k) === AIR) w.set(xcut, j, k, PLASTER);
    w.fill(xcut, fy + 1, cut + 2, xcut, fy + 5, cut + 4, AIR);
  }
  // furniture and loot, scattered over the floors
  const cell = () => {
    for (let t = 0; t < 40; t++) {
      const f = Math.floor(r() * floors), i = inner.i0 + 4 + Math.floor(r() * (inner.i1 - inner.i0 - 5)), k = inner.k0 + 1 + Math.floor(r() * (inner.k1 - inner.k0 - 2));
      const j = f * H + 1;
      if (w.get(i, j, k) === AIR && w.get(i + 1, j, k) === AIR && w.get(i, j, k + 1) === AIR && w.get(i, j + 2, k) === AIR && w.get(i, j - 1, k) !== AIR) return [i, j, k];
    }
    return null;
  };
  for (let t = 0; t < st.desks + floors; t++) { const c = cell(); if (!c) continue; const [i, j, k] = c; w.fill(i, j, k, i + 1, j, k, WOOD); loot(i, j + 1, k, "cash"); }
  for (let t = 0; t < st.safes + floors; t++) { const c = cell(); if (!c) continue; const [i, j, k] = c; w.set(i, j, k, SAFE); }
  for (let t = 0; t < st.cases; t++) {
    const c = cell(); if (!c) continue; const [i, j, k] = c;
    w.set(i, j, k, MARBLE); w.set(i, j + 2, k, GLASS); w.set(i + 1, j + 1, k, GLASS); w.set(i - 1, j + 1, k, GLASS); w.set(i, j + 1, k + 1, GLASS); w.set(i, j + 1, k - 1, GLASS);
    loot(i, j + 1, k, "gem");
  }
  for (let t = 0; t < st.gold; t++) { const c = cell(); if (!c) continue; const [i, j, k] = c; w.set(i, j, k, MARBLE); w.set(i, j + 1, k, GOLD); if (kind === "temple") w.set(i, j + 2, k, GOLD); }
  for (let t = 0; t < st.crates; t++) { const c = cell(); if (!c) continue; const [i, j, k] = c; w.fill(i, j, k, i + 1, j + 1, k, CRATE); if (r() < 0.6) loot(i, j + 2, k, "cash", 1.2); }
  // art on the inside walls
  for (let t = 0; t < st.art; t++) {
    const f = Math.floor(r() * floors), j = f * H + 3, side = r() < 0.5;
    const i = side ? inner.i0 + 1 : inner.i1 - 1, k = inner.k0 + 3 + Math.floor(r() * (inner.k1 - inner.k0 - 6));
    if (w.get(i, j, k) === AIR) loot(i, j, k, "art");
  }
  // cash on the floors here and there
  for (let t = 0; t < 4 + floors * 2; t++) { const c = cell(); if (c) loot(c[0], c[1], c[2], "cash", 0.6); }
  // a gold sign over the door
  for (let i = nx / 2 - 4; i <= nx / 2 + 3; i++) for (let j = 7; j <= 8; j++) w.set(i, j, k0 - 1, j === 8 || i === nx / 2 - 4 || i === nx / 2 + 3 ? TRIM : GOLD);

  // ---------------------------------------------------------------- where people stand
  L.van = { x: w.wx(nx / 2 - 18), y: VS, z: w.wz((road0 + road1) / 2), yaw: Math.PI / 2 };
  L.spawn = { x: w.wx(nx / 2 - 10), y: VS, z: w.wz(road1 + 2), yaw: 0 };
  w.set(nx / 2 - 10, 1, road1 + 1, AIR); w.set(nx / 2 - 11, 1, road1 + 1, AIR);
  for (const [hi, hk] of [[6, nz - 8], [nx - 7, nz - 8], [6, road1 + 8], [nx - 7, road1 + 8], [nx / 2, nz - 5]] as [number, number][]) L.hatches.push({ x: w.wx(hi), y: VS, z: w.wz(hk), yaw: 0 });
  for (const [ti, tk, yaw] of [[i0 - 1, k0 + 2, -Math.PI / 2], [i1 + 1, k0 + 2, Math.PI / 2], [i0 - 1, k1 - 2, -Math.PI / 2], [i1 + 1, k1 - 2, Math.PI / 2], [nx / 2 + 6, k0 - 1, Math.PI]] as [number, number, number][]) L.turrets.push({ x: w.wx(ti), y: (top - 2) * VS, z: w.wz(tk), yaw });
  for (let t = 0; t < 4; t++) L.roof.push({ x: w.wx(i0 + 4 + (t % 2) * (W - 8)), y: (top + 2) * VS, z: w.wz(k0 + 4 + Math.floor(t / 2) * (D - 8)), yaw: 0 });
  let blocks = 0;
  for (let j = 1; j <= top + 8; j++) for (let k = k0 - 4; k <= k1 + 1; k++) for (let i = i0 - 1; i <= i1 + 1; i++) if (w.get(i, j, k) !== AIR) blocks++;
  L.blocks = blocks;
  void pick; void DIRT;
  return L;
}
export const LOOT_VALUE = VALUE;
