// Momo Escape room generator + director. A floor recipe (building, concepts, difficulty) becomes a room: a shape from the
// room grammar (with stopper blocks, so a dash can end under a gap or the exit), then every concept is placed where
// Momo's route goes and re-checked by the solver (a placement that makes the room impossible is undone). Finally the
// room must be escapable from its entrance hatch, coins line the route, diamonds sit in reachable risky spots, and the
// autopilot gets its moves. Floors 1–240 follow the building schedule; after that the Fusion Director mixes concepts
// into new named ones forever, with anti-repeat memory.
import { hash32, Rng } from "../roll/rng";
import { ALWAYS, BUILDINGS, buildingOf, JOURNEY_FLOORS } from "./data/buildings";
import { CONCEPT } from "./data/concepts";
import { cellXY, replay, solve, type SolveResult } from "./solver";
import { COLS, U, type Dir, type Face, type FaceKind, type Hazard, type Pickup, type PickupKind, type Room, type RoomRules } from "./types";

export interface FloorRecipe {
  n: number; building: number; floor: number; d: number;
  atoms: string[]; shape: string; h: number; rush: number; seed: number; name: string;
  calm?: boolean; finale?: string; fusion?: { name: string; atoms: string[]; key: string };
  hearts?: boolean; booster?: boolean; kid?: boolean;
}
export interface FusionMemory { recent: string[]; seen: string[] }

const DIRS: Dir[] = [0, 1, 2, 3];
const DXs = [0, 1, 0, -1], DYs = [1, 0, -1, 0];
// every period divides T_FOLD (120 ticks = 2 s) so the solver folds time cheaply
const PERIODS = [40, 60, 120];

// ---------------------------------------------------------------- grid
class Grid {
  c: Uint8Array;
  constructor(public h: number) { this.c = new Uint8Array(COLS * h); }
  get(x: number, y: number) { return x < 0 || x >= COLS || y < 0 || y >= this.h ? 1 : this.c[y * COLS + x]; }
  set(x: number, y: number, v = 1) { if (x >= 0 && x < COLS && y >= 0 && y < this.h) this.c[y * COLS + x] = v; }
  rect(x: number, y: number, w: number, h: number, v = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); }
  free(x: number, y: number, w: number, h: number, pad = 0) { for (let j = y - pad; j < y + h + pad; j++) for (let i = x - pad; i < x + w + pad; i++) if (this.get(i, j)) return false; return true; }
}

function shell(h: number, inX: number, outX: number) {
  const g = new Grid(h);
  for (let y = 0; y < h; y++) { g.set(0, y); g.set(COLS - 1, y); }
  for (let x = 0; x < COLS; x++) { g.set(x, 0); g.set(x, h - 1); }
  g.set(inX, 0, 0); g.set(outX, h - 1, 0);
  return g;
}
function clearHoles(g: Grid, inX: number, outX: number, side: boolean) {
  for (let x = inX - 1; x <= inX + 1; x++) for (let y = 1; y <= 2; y++) if (x > 0 && x < COLS - 1) g.set(x, y, 0);
  for (let x = outX - 1; x <= outX + 1; x++) for (let y = g.h - 3; y <= g.h - 2; y++) if (x > 0 && x < COLS - 1) g.set(x, y, 0);
  // a stopper beside the exit: a dash along the ceiling from the other side ends right under the hatch
  g.set(outX + (side ? 1 : -1), g.h - 2);
}
/** the fallback room: an empty shell with only the exit stopper (always escapable) */
function openRoom(h: number, inX: number, outX: number, side: boolean) {
  const g = shell(h, inX, outX);
  clearHoles(g, inX, outX, side);
  return g;
}

// ---------------------------------------------------------------- room grammar
type ShapeFn = (rng: Rng, h: number, inX: number, outX: number) => Grid;
/** multi-level rooms: partitions with gaps split the room into floors Momo must cross one by one */
function levels(rng: Rng, h: number, inX: number, outX: number, style: "zigzag" | "maze" | "stairs" | "split", step: [number, number], posts = 0.5): Grid {
  const g = shell(h, inX, outX);
  let y = rng.int(4, 5), side = rng.chance(0.5);
  let prevGaps: [number, number][] = [];
  let i = 0;
  while (y <= h - 5) {
    const gaps: [number, number][] = [];
    switch (style) {
      case "zigzag": { const w = rng.int(2, 3); gaps.push(side ? [1, w] : [COLS - 1 - w, COLS - 2]); side = !side; break; }
      case "stairs": { const w = rng.int(3, 5); gaps.push(side ? [1, w] : [COLS - 1 - w, COLS - 2]); side = !side; break; }
      case "split": gaps.push(i % 2 ? [5, 7] : side ? [1, 2] : [COLS - 3, COLS - 2]); if (i % 2 === 0) side = !side; break;
      case "maze": {
        const n = rng.int(1, 2);
        for (let k = 0, t = 0; k < n && t < 30; t++) {
          const a = rng.int(1, COLS - 4), b = a + 1;
          if (prevGaps.some(([p, q]) => a <= q + 2 && b >= p - 2) || gaps.some(([p, q]) => a <= q + 2 && b >= p - 2)) continue;
          gaps.push([a, b]); k++;
        }
        if (!gaps.length) gaps.push(side ? [1, 2] : [COLS - 3, COLS - 2]);
        side = !side;
        break;
      }
    }
    g.rect(1, y, COLS - 2, 1);
    for (const [a, b] of gaps) g.rect(a, y, b - a + 1, 1, 0);
    // a stopper hanging next to an inner gap: a dash along the ceiling ends right under the gap
    for (const [a, b] of gaps) {
      if (a <= 1 || b >= COLS - 2) continue;
      const sx = rng.chance(0.5) ? a - 1 : b + 1;
      if (y - 1 > 2 && !g.get(sx, y - 2)) g.set(sx, y - 1);
    }
    prevGaps = gaps;
    // posts inside the level below this partition (lasers and saws hang off them)
    if (rng.chance(posts)) {
      const py = y - rng.int(2, 3), px = rng.int(3, COLS - 4);
      if (py > 2 && g.free(px, py, 1, 1, 1)) g.set(px, py);
    }
    y += rng.int(step[0], step[1]);
    i++;
  }
  return g;
}
const SHAPES: Record<string, { h: [number, number]; fn: ShapeFn }> = {
  /** open room with blocks (tutorial, calm floors) */
  pillars: { h: [16, 20], fn: (rng, h, inX, outX) => {
    const g = shell(h, inX, outX);
    const n = rng.int(3, 6);
    for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const w = rng.int(1, 2), hh = rng.int(1, 2), x = rng.int(2, 11 - w), y = rng.int(4, h - 4 - hh);
      if (g.free(x, y, w, hh, 1)) { g.rect(x, y, w, hh); k++; }
    }
    // a lid over the exit so it is not one dash away
    const lx = Math.max(1, outX - 2), ly = h - 4;
    if (g.free(lx, ly, 5, 1, 0)) g.rect(lx, ly, Math.min(5, COLS - 1 - lx), 1);
    return g;
  } },
  zigzag: { h: [20, 28], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, "zigzag", [4, 5]) },
  maze: { h: [20, 28], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, "maze", [4, 5], 0.7) },
  stairs: { h: [20, 28], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, "stairs", [4, 5], 0.4) },
  split: { h: [20, 28], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, "split", [4, 5], 0.8) },
  shaft: { h: [28, 34], fn: (rng, h, inX, outX) => {
    const g = shell(h, inX, outX);
    const lo = Math.min(inX, outX), hi = Math.max(inX, outX);
    const L = Math.max(1, Math.min(lo - 1, rng.int(3, 4))), R = Math.min(COLS - 2, Math.max(hi + 1, rng.int(8, 9)));
    for (let y = 3; y < h - 3; y++) { g.rect(1, y, L - 1, 1); g.rect(R + 1, y, COLS - 2 - R, 1); }
    let side = rng.chance(0.5);
    for (let y = 5; y < h - 5; y += rng.int(3, 4)) {
      const w = rng.int(2, Math.max(2, Math.floor((R - L) / 2)));
      g.rect(side ? L : R - w + 1, y, w, 1);
      side = !side;
    }
    return g;
  } },
  spiral: { h: [26, 32], fn: (rng, h, inX, outX) => {
    const g = shell(h, inX, outX);
    const x0 = rng.int(5, 6);
    g.rect(x0, 4, 2, h - 8);
    let left = rng.chance(0.5);
    for (let y = 6; y < h - 5; y += rng.int(3, 4)) {
      if (left) g.rect(1, y, x0 - 2, 1); else g.rect(x0 + 3, y, COLS - 2 - (x0 + 2), 1);
      left = !left;
    }
    return g;
  } },
  twin: { h: [20, 26], fn: (rng, h, inX, outX) => {
    // mirror-symmetric levels: two side gaps, then one centre gap, never stacked
    const g = shell(h, inX, outX);
    let i = 0;
    for (let y = rng.int(4, 5); y <= h - 5; y += rng.int(4, 5), i++) {
      g.rect(1, y, COLS - 2, 1);
      // the centre gap gets a stopper on one side so a dash along the ceiling can end under it
      if (i % 2) { g.rect(5, y, 3, 1, 0); g.set(rng.chance(0.5) ? 4 : 8, y - 1); } else { g.rect(1, y, 2, 1, 0); g.rect(COLS - 3, y, 2, 1, 0); }
      const px = rng.int(2, 4), py = y - 2;
      if (py > 2 && g.free(px, py, 1, 1, 1) && g.free(COLS - 1 - px, py, 1, 1, 1)) { g.set(px, py); g.set(COLS - 1 - px, py); }
    }
    return g;
  } },
  finale: { h: [30, 34], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, rng.pick(["zigzag", "split", "maze"] as const), [5, 6], 0.6) },
  calm: { h: [14, 16], fn: (rng, h, inX, outX) => levels(rng, h, inX, outX, "stairs", [5, 6], 0.3) },
};
export const SHAPE_OF: Record<string, string> = { S05: "split", S13: "stairs", S14: "shaft", S15: "zigzag", S16: "maze", S17: "stairs", S25: "spiral", A21: "twin" };

// ---------------------------------------------------------------- placement context
interface Ctx {
  room: Room; rng: Rng; d: number; margin: number;
  path: number[]; reach: Set<number>; base: SolveResult;
  id: () => number;
  periodBlink: () => number; duty: number;
  rhythm: boolean;
  /** cells on the other proven routes (from the other entries) */
  alt?: number[];
}
const isWall = (room: Room, x: number, y: number) => x < 0 || x >= COLS || y < 0 || y >= room.h || (room.cells[y * COLS + x] === 1 && !room.fake[y * COLS + x]) || room.door[y * COLS + x] === 1;
const nearHole = (room: Room, x: number, y: number, r = 2) => (Math.abs(x - room.inX) <= r && y <= r) || (Math.abs(x - room.outX) <= r && y >= room.h - 1 - r);

function spanH(room: Room, x: number, y: number): [number, number] { let a = x, b = x; while (!isWall(room, a - 1, y)) a--; while (!isWall(room, b + 1, y)) b++; return [a, b]; }
function spanV(room: Room, x: number, y: number): [number, number] { let a = y, b = y; while (!isWall(room, x, a - 1)) a--; while (!isWall(room, x, b + 1)) b++; return [a, b]; }

/** a path cell somewhere in the middle of the route, away from both hatches */
function pathPoint(c: Ctx, lo = 0.18, hi = 0.86): [number, number] | null {
  const p = c.path;
  for (let k = 0; k < 12; k++) {
    const i = Math.floor(p.length * (lo + (hi - lo) * c.rng.next()));
    const cell = p[i];
    if (cell === undefined) continue;
    const x = cell % COLS, y = Math.floor(cell / COLS);
    if (y <= 1 || y >= c.room.h - 2 || nearHole(c.room, x, y, 2)) continue;
    return [x, y];
  }
  return null;
}

interface Change { hz?: Hazard[]; posts?: [number, number][]; faces?: Face[]; bumpers?: { cx: number; cy: number }[]; pads?: Room["pads"]; pickups?: Omit<Pickup, "id">[]; key?: boolean; door?: [number, number][]; offAll?: "laser" | "all" }

const C = (u: number) => (u + 0.5) * U;
const P = (c: Ctx, base: number) => {
  if (c.rhythm) return c.rng.pick([60, 120]);
  const fast = c.d > 0.55 ? 0.5 : 1;
  const opts = PERIODS.filter((p) => p >= Math.min(120, base) * fast && p <= Math.min(120, base * 2));
  return opts.length ? c.rng.pick(opts) : base;
};

// ---------------------------------------------------------------- concept placers
type Placer = (c: Ctx, concept: string) => Change | null;

function laserH(c: Ctx, concept: string, skin: string, mode: "static" | "blink", full: boolean): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const vertical = c.rng.chance(0.4);
  const [a, b] = vertical ? spanV(c.room, x, y) : spanH(c.room, x, y);
  const len = b - a + 1;
  if (len < 3) return null;
  const posts: [number, number][] = [];
  let s0 = a, s1 = b;
  if (!full) {
    if (len < 5) return null;
    // a post leaves a 2-cell gap at one end
    if (c.rng.chance(0.5)) { s1 = b - 3; posts.push(vertical ? [x, b - 2] : [b - 2, y]); }
    else { s0 = a + 3; posts.push(vertical ? [x, a + 2] : [a + 2, y]); }
  }
  const per = mode === "blink" ? c.periodBlink() : 0;
  const h: Hazard = vertical
    ? { k: "laser", id: c.id(), skin, concept, ax: C(x), ay: s0 * U, bx: C(x), by: (s1 + 1) * U, mode, period: per || 120, phase: c.rng.int(0, 119), duty: c.duty, sx: 0, sy: 0, px: 0, py: 0, len: 0, spin: 0, w: skin === "light" ? 2.2 : 0.9 }
    : { k: "laser", id: c.id(), skin, concept, ax: s0 * U, ay: C(y), bx: (s1 + 1) * U, by: C(y), mode, period: per || 120, phase: c.rng.int(0, 119), duty: c.duty, sx: 0, sy: 0, px: 0, py: 0, len: 0, spin: 0, w: skin === "light" ? 2.2 : 0.9 };
  return { hz: [h], posts };
}

function laserSweep(c: Ctx, concept: string, skin: string): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const [a, b] = spanH(c.room, x, y);
  const amp = c.rng.int(1, 2);
  for (let j = y - amp; j <= y + amp; j++) { const [aa, bb] = spanH(c.room, Math.max(a, 1), j); if (aa !== a || bb !== b || isWall(c.room, a, j)) return null; }
  if (b - a < 3) return null;
  return { hz: [{ k: "laser", id: c.id(), skin, concept, ax: a * U, ay: C(y), bx: (b + 1) * U, by: C(y), mode: "sweep", period: P(c, 120), phase: c.rng.int(0, 119), duty: 1, sx: 0, sy: amp * U, px: 0, py: 0, len: 0, spin: 0, w: skin === "light" ? 2.4 : 0.9 }] };
}

/** a free spot for a post with clear space around it (radius in cells) */
function postSpot(c: Ctx, near: [number, number], rad: number): [number, number] | null {
  for (let k = 0; k < 20; k++) {
    const x = near[0] + c.rng.int(-2, 2), y = near[1] + c.rng.int(-2, 2);
    if (x < 2 || x > COLS - 3 || y < 3 || y > c.room.h - 4 || nearHole(c.room, x, y, 2)) continue;
    let ok = true;
    for (let j = -rad; j <= rad && ok; j++) for (let i = -rad; i <= rad && ok; i++) if ((i || j) && isWall(c.room, x + i, y + j)) ok = false;
    if (ok) return [x, y];
  }
  return null;
}

function laserSpin(c: Ctx, concept: string, skin: string, arms = 1, long = false): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const q = postSpot(c, p, long ? 3 : 2); if (!q) return null;
  const len = (long ? 3.4 : 2.4) * U;
  const period = 120;
  const dir = c.rng.sign(), phase = c.rng.int(0, 119);
  const hz: Hazard[] = [];
  for (let k = 0; k < arms; k++) hz.push({ k: "laser", id: c.id(), skin, concept, ax: 0, ay: 0, bx: 0, by: 0, mode: "spin", period, phase: phase + Math.round((period * k) / arms), duty: 1, sx: 0, sy: 0, px: C(q[0]), py: C(q[1]), len, spin: dir, w: skin === "blade" ? 1.6 : 0.9 });
  return { hz, posts: [q] };
}

function laserGate(c: Ctx, concept: string, skin: string): Change | null {
  const a = laserH(c, concept, skin, "blink", true); if (!a?.hz) return null;
  const h0 = a.hz[0] as Extract<Hazard, { k: "laser" }>;
  const vertical = h0.ax === h0.bx;
  const off = 2 * U;
  const h1 = { ...h0, id: c.id(), phase: (h0.phase + h0.period / 2) % h0.period, ax: h0.ax + (vertical ? off : 0), bx: h0.bx + (vertical ? off : 0), ay: h0.ay + (vertical ? 0 : off), by: h0.by + (vertical ? 0 : off) };
  // the second beam must sit in the same corridor
  const cx = Math.floor(((h1.ax + h1.bx) / 2) / U), cy = Math.floor(((h1.ay + h1.by) / 2) / U);
  if (isWall(c.room, cx, cy)) return a;
  return { hz: [h0, h1] };
}

function wallBeam(c: Ctx, concept: string, skin: string): Change | null {
  // flame jet / mirror-less beam out of a wall face, 2–3 cells long, blinking
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  for (const n of c.rng.chance(0.5) ? DIRS : [...DIRS].reverse()) {
    let wx = x, wy = y, len = 0;
    while (!isWall(c.room, wx, wy) && len < 8) { wx += DXs[n]; wy += DYs[n]; len++; }
    if (!isWall(c.room, wx, wy)) continue;
    const L = Math.min(3, len);
    const fx = n === 1 ? wx * U : n === 3 ? (wx + 1) * U : C(wx), fy = n === 0 ? wy * U : n === 2 ? (wy + 1) * U : C(wy);
    const ex = fx - DXs[n] * L * U, ey = fy - DYs[n] * L * U;
    return { hz: [{ k: "laser", id: c.id(), skin, concept, ax: fx, ay: fy, bx: ex, by: ey, mode: "blink", period: c.periodBlink(), phase: c.rng.int(0, 119), duty: Math.min(0.6, c.duty), sx: 0, sy: 0, px: 0, py: 0, len: 0, spin: 0, w: skin === "flame" ? 2.6 : 1.2 }] };
  }
  return null;
}

function arc(c: Ctx, concept: string, skin: string): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const [a, b] = spanH(c.room, x, y);
  if (b - a < 4) return null;
  const pa: [number, number] = [a + 1, y], pb: [number, number] = [b - 1, y];
  if (nearHole(c.room, pa[0], y) || nearHole(c.room, pb[0], y)) return null;
  return { posts: [pa, pb], hz: [{ k: "laser", id: c.id(), skin, concept, ax: (pa[0] + 1) * U, ay: C(y), bx: pb[0] * U, by: C(y), mode: "blink", period: c.periodBlink(), phase: c.rng.int(0, 119), duty: c.duty, sx: 0, sy: 0, px: 0, py: 0, len: 0, spin: 0, w: 1.2 }] };
}

function mirrorBeam(c: Ctx, concept: string): Change | null {
  // an L-shaped beam: wall → mirror post → wall, both legs blinking together
  const p = pathPoint(c); if (!p) return null;
  const q = postSpot(c, p, 1); if (!q) return null;
  const [mx, my] = q;
  const [a] = spanH(c.room, mx - 1, my);
  const [, b2] = spanV(c.room, mx, my + 1);
  if (mx - a < 2 || b2 - my < 2) return null;
  const period = c.periodBlink(), phase = c.rng.int(0, 119);
  const base = { skin: "laser", concept, mode: "blink" as const, period, phase, duty: c.duty, sx: 0, sy: 0, px: 0, py: 0, len: 0, spin: 0, w: 0.9 };
  return { posts: [q], hz: [
    { k: "laser", id: c.id(), ...base, ax: a * U, ay: C(my), bx: mx * U, by: C(my) },
    { k: "laser", id: c.id(), ...base, ax: C(mx), ay: (my + 1) * U, bx: C(mx), by: (b2 + 1) * U },
  ] };
}

function spikes(c: Ctx, concept: string, skin: string, pop: boolean): Change | null {
  const p = pathPoint(c, 0.15, 0.9); if (!p) return null;
  const [x, y] = p;
  // wall faces around the point
  const cand: { cx: number; cy: number; n: Dir }[] = [];
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const ex = x + i, ey = y + j;
    if (isWall(c.room, ex, ey) || nearHole(c.room, ex, ey, 2)) continue;
    for (const n of DIRS) {
      const wx = ex + DXs[n], wy = ey + DYs[n];
      if (wx <= 0 && n === 3) continue;
      if (isWall(c.room, wx, wy)) cand.push({ cx: wx, cy: wy, n: ((n + 2) % 4) as Dir });
    }
  }
  if (!cand.length) return null;
  const f0 = c.rng.pick(cand);
  const run = [f0];
  const along: Dir = f0.n === 0 || f0.n === 2 ? 1 : 0;
  for (const s of [1, -1]) for (let k = 1; k <= 2; k++) {
    const cx = f0.cx + DXs[along] * k * s, cy = f0.cy + DYs[along] * k * s;
    const ex = cx + DXs[f0.n], ey = cy + DYs[f0.n];
    if (run.length < 3 && isWall(c.room, cx, cy) && !isWall(c.room, ex, ey) && !nearHole(c.room, ex, ey, 2)) run.push({ cx, cy, n: f0.n }); else break;
  }
  return { hz: [{ k: "spikes", id: c.id(), skin, concept, faces: run, period: pop ? P(c, 120) : 0, phase: c.rng.int(0, 119), duty: pop ? 0.45 + 0.15 * c.d : 1 }] };
}

function crusher(c: Ctx, concept: string, skin: string, side: boolean, short = false, pair = false): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const [a, b] = side ? spanH(c.room, x, y) : spanV(c.room, x, y);
  if (b - a < 2) return null;
  const travel = short ? Math.min(2, b - a) : b - a;
  const per = c.d > 0.55 ? P(c, 60) : 120, phase = c.rng.int(0, 119);
  const mk = (off: number, ph: number): Hazard => side
    ? { k: "crusher", id: c.id(), skin, concept, x: a * U + 0.5, y: (y + off) * U + 0.5, w: U - 1, h: U - 1, ex: travel * U, ey: 0, period: per, phase: ph }
    : { k: "crusher", id: c.id(), skin, concept, x: (x + off) * U + 0.5, y: b * U + 0.5, w: U - 1, h: U - 1, ex: 0, ey: -travel * U, period: per, phase: ph };
  const hz = [mk(0, phase)];
  if (pair) {
    const ox = side ? 0 : 1, oy = side ? 1 : 0;
    const nx = x + ox, ny = y + oy;
    const [a2, b2] = side ? spanH(c.room, nx, ny) : spanV(c.room, nx, ny);
    if (!isWall(c.room, nx, ny) && a2 === a && b2 === b) hz.push(mk(1, (phase + per / 2) % per));
  }
  return { hz };
}

function turret(c: Ctx, concept: string, skin: string, o: { period: number; speed: number; size: number; twin?: boolean }): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const vertical = c.rng.chance(0.35);
  const [a, b] = vertical ? spanV(c.room, x, y) : spanH(c.room, x, y);
  if (b - a < 3) return null;
  const fromStart = c.rng.chance(0.5);
  const mk = (start: boolean, ph: number): Hazard => {
    const n: Dir = vertical ? (start ? 0 : 2) : start ? 1 : 3;
    const cx = vertical ? x : start ? a - 1 : b + 1, cy = vertical ? (start ? a - 1 : b + 1) : y;
    return { k: "turret", id: c.id(), skin, concept, cx, cy, n, period: o.period, phase: ph, speed: o.speed, size: o.size, range: (b - a + 1) * U };
  };
  const ph = c.rng.int(0, o.period - 1);
  const hz = [mk(fromStart, ph)];
  if (o.twin) hz.push(mk(!fromStart, (ph + o.period / 2) % o.period));
  if ((hz[0] as { cy: number }).cy <= 0 || (hz[0] as { cy: number }).cy >= c.room.h - 1) return null;
  return { hz };
}

function mover(c: Ctx, concept: string, skin: string, kind: "line" | "orbit" | "pendulum" | "static" | "bob" | "floor", r = 4, opts: { pair?: boolean; slow?: boolean } = {}): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const per = opts.slow ? 120 : P(c, 60), phase = c.rng.int(0, 119);
  switch (kind) {
    case "static": {
      // sit next to the route (or on it — the solver decides)
      const q: [number, number] = c.rng.chance(0.5) ? p : [x + c.rng.int(-1, 1), y + c.rng.int(-1, 1)];
      if (isWall(c.room, q[0], q[1]) || nearHole(c.room, q[0], q[1], 2)) return null;
      const hz: Hazard[] = [{ k: "mover", id: c.id(), skin, concept, r, path: "static", x: C(q[0]), y: C(q[1]), ex: 0, ey: 0, rad: 0, amp: 0, period: 0, phase: 0, dir: 1 }];
      if (opts.pair) {
        const [a, b] = spanH(c.room, x, y);
        const ox = q[0] - a > b - q[0] ? q[0] - 3 : q[0] + 3;
        if (!isWall(c.room, ox, q[1]) && !nearHole(c.room, ox, q[1], 2)) hz.push({ ...hz[0], id: c.id(), x: C(ox) } as Hazard);
      }
      return { hz };
    }
    case "line": case "floor": case "bob": {
      const vertical = kind === "bob" ? true : kind === "floor" ? false : c.rng.chance(0.4);
      const [a, b] = vertical ? spanV(c.room, x, y) : spanH(c.room, x, y);
      const lo = kind === "bob" ? Math.max(a, y - 1) : a, hi = kind === "bob" ? Math.min(b, y + 1) : b;
      if (hi - lo < 1) return null;
      const base: Hazard = vertical
        ? { k: "mover", id: c.id(), skin, concept, r, path: "line", x: C(x), y: C(lo), ex: 0, ey: (hi - lo) * U, rad: 0, amp: 0, period: per, phase, dir: 1 }
        : { k: "mover", id: c.id(), skin, concept, r, path: "line", x: C(lo), y: C(y), ex: (hi - lo) * U, ey: 0, rad: 0, amp: 0, period: per, phase, dir: 1 };
      const hz: Hazard[] = [base];
      if (opts.pair) hz.push({ ...base, id: c.id(), phase: (phase + per / 2) % per } as Hazard);
      return { hz };
    }
    case "orbit": {
      const q = postSpot(c, p, 3); if (!q) return null;
      const hz: Hazard[] = [{ k: "mover", id: c.id(), skin, concept, r, path: "orbit", x: C(q[0]), y: C(q[1]), ex: 0, ey: 0, rad: 2 * U, amp: skin === "drone" ? 0.6 : 1, period: per, phase, dir: c.rng.sign() }];
      if (opts.pair) hz.push({ ...hz[0], id: c.id(), phase: (phase + per / 2) % per } as Hazard);
      // drones circle open air (no post); saws and maces orbit a post
      return skin === "drone" ? { hz } : { hz, posts: [q] };
    }
    case "pendulum": {
      const [, top] = spanV(c.room, x, y);
      const len = Math.min(3, top - y + 1);
      if (len < 2) return null;
      const rad = (top + 1 - y) * U - 2;
      if (rad < 2 * U) return null;
      return { hz: [{ k: "mover", id: c.id(), skin, concept, r, path: "pendulum", x: C(x), y: (top + 1) * U, ex: 0, ey: 0, rad: Math.min(rad, 3.5 * U), amp: 0.85, period: P(c, 120), phase, dir: 1 }] };
    }
  }
}

function pulse(c: Ctx, concept: string, skin: string, kind: "cell" | "column" | "area", o: { duty: number; warn: number; period?: number }): Change | null {
  const p = pathPoint(c); if (!p) return null;
  const [x, y] = p;
  const per = o.period ?? P(c, 120), phase = c.rng.int(0, 119);
  if (kind === "cell") return { hz: [{ k: "pulse", id: c.id(), skin, concept, x: x * U + 0.5, y: y * U + 0.5, w: U - 1, h: U - 1, period: per, phase, duty: o.duty, warn: o.warn }] };
  if (kind === "area") {
    if (isWall(c.room, x + 1, y) || isWall(c.room, x, y + 1) || isWall(c.room, x + 1, y + 1)) return null;
    return { hz: [{ k: "pulse", id: c.id(), skin, concept, x: x * U + 0.5, y: y * U + 0.5, w: 2 * U - 1, h: 2 * U - 1, period: per, phase, duty: o.duty, warn: o.warn }] };
  }
  const [a, b] = spanV(c.room, x, y);
  const top = skin === "steam" ? Math.min(b, a + 2) : b;
  return { hz: [{ k: "pulse", id: c.id(), skin, concept, x: x * U + 2, y: a * U, w: U - 4, h: (top - a + 1) * U, period: per, phase, duty: o.duty, warn: o.warn }] };
}

function faceRun(c: Ctx, kind: FaceKind): Change | null {
  // a run of the route's own floor/wall faces gets a new surface
  const faces: Face[] = [];
  const p = pathPoint(c, 0.1, 0.9); if (!p) return null;
  const [x, y] = p;
  for (const n of c.rng.chance(0.5) ? DIRS : [...DIRS].reverse()) {
    const wx = x + DXs[n], wy = y + DYs[n];
    if (!isWall(c.room, wx, wy) || wy <= 0 || wy >= c.room.h - 1) continue;
    const fn = ((n + 2) % 4) as Dir;
    const along: Dir = fn === 0 || fn === 2 ? 1 : 0;
    const dir = c.rng.chance(0.5) ? along : (((along + 2) % 4) as Dir);
    for (let k = -2; k <= 3; k++) {
      const cx = wx + DXs[along] * k, cy = wy + DYs[along] * k;
      if (isWall(c.room, cx, cy) && !isWall(c.room, cx + DXs[fn], cy + DYs[fn])) faces.push({ cx, cy, n: fn, k: kind, dir });
    }
    if (kind === "bounce") faces.splice(1);
    if (faces.length) return { faces };
  }
  return null;
}

function launchPad(c: Ctx): Change | null {
  for (let k = 0; k < 10; k++) {
    const cell = c.path[Math.floor(c.path.length * (0.15 + 0.6 * c.rng.next()))];
    if (cell === undefined) continue;
    const x = cell % COLS, y = Math.floor(cell / COLS);
    if (isWall(c.room, x, y - 1) && y - 1 > 0 && !nearHole(c.room, x, y, 2)) return { faces: [{ cx: x, cy: y - 1, n: 0, k: "bounce" }] };
  }
  return null;
}

function bumper(c: Ctx): Change | null {
  const p = pathPoint(c); if (!p) return null;
  return { bumpers: [{ cx: p[0], cy: p[1] }] };
}

function pads(c: Ctx): Change | null {
  const floorCells = (cells: Iterable<number>) => [...cells].filter((cell) => { const x = cell % COLS, y = Math.floor(cell / COLS); return y > 1 && y < c.room.h - 2 && isWall(c.room, x, y - 1) && !nearHole(c.room, x, y, 2); });
  const a = floorCells(c.path.slice(Math.floor(c.path.length * 0.15), Math.floor(c.path.length * 0.6)));
  const b = floorCells(c.reach);
  if (!a.length || !b.length) return null;
  const A = c.rng.pick(a);
  const far = b.filter((q) => Math.abs((q % COLS) - (A % COLS)) + Math.abs(Math.floor(q / COLS) - Math.floor(A / COLS)) >= 5);
  if (!far.length) return null;
  const B = c.rng.pick(far);
  return { pads: [{ ax: A % COLS, ay: Math.floor(A / COLS), bx: B % COLS, by: Math.floor(B / COLS) }] };
}

/** a reachable spot away from the route (keys, switches, buddies, hearts) */
function offPath(c: Ctx, minD = 2): [number, number] | null {
  const on = new Set(c.path);
  const cand = [...c.reach].filter((cell) => {
    const x = cell % COLS, y = Math.floor(cell / COLS);
    if (nearHole(c.room, x, y, 2) || on.has(cell)) return false;
    for (const q of c.path) if (Math.abs((q % COLS) - x) + Math.abs(Math.floor(q / COLS) - y) < minD) return false;
    return true;
  });
  if (!cand.length) return null;
  const cell = c.rng.pick(cand);
  return [cell % COLS, Math.floor(cell / COLS)];
}

function keyAt(c: Ctx): Change | null {
  const q = offPath(c, 1) ?? pathPoint(c, 0.3, 0.7);
  if (!q) return null;
  return { key: true, pickups: [{ k: "key", x: C(q[0]), y: C(q[1]) }] };
}
function doorWithKey(c: Ctx): Change | null {
  // a key-card door across a narrow passage of the route
  for (let k = 0; k < 10; k++) {
    const p = pathPoint(c, 0.45, 0.9); if (!p) return null;
    const [x, y] = p;
    const [a, b] = spanH(c.room, x, y);
    if (b - a > 3) continue;
    const door: [number, number][] = [];
    for (let i = a; i <= b; i++) door.push([i, y]);
    const q = offPath(c, 1) ?? pathPoint(c, 0.1, 0.35);
    if (!q) return null;
    return { door, pickups: [{ k: "key", x: C(q[0]), y: C(q[1]) }] };
  }
  return keyAt(c);
}
function switchAt(c: Ctx, which: "laser" | "all"): Change | null {
  const q = offPath(c, 1) ?? pathPoint(c, 0.2, 0.5);
  if (!q) return null;
  return { pickups: [{ k: "switch", x: C(q[0]), y: C(q[1]) }], offAll: which };
}

const H = (fn: Placer): Placer => fn;
export const PLACERS: Record<string, Placer> = {
  H01: H((c, id) => laserH(c, id, "laser", "static", false)),
  H02: H((c, id) => laserH(c, id, "laser", "blink", true)),
  H03: H((c, id) => laserSweep(c, id, "laser")),
  H04: H((c, id) => laserSpin(c, id, "laser")),
  H05: H((c, id) => laserGate(c, id, "laser")),
  H06: H((c, id) => spikes(c, id, "spikes", false)),
  H07: H((c, id) => spikes(c, id, "spikes", true)),
  H08: H((c, id) => crusher(c, id, "crusher", false)),
  H09: H((c, id) => crusher(c, id, "crusher", true)),
  H10: H((c, id) => crusher(c, id, "crusher", false, false, true)),
  H11: H((c, id) => turret(c, id, "turret", { period: c.d < 0.35 ? 120 : c.d < 0.7 ? 80 : 60, speed: 1.6 + 1.4 * c.d, size: 4 })),
  H12: H((c, id) => turret(c, id, "fast", { period: 60, speed: 3.2, size: 3 })),
  H13: H((c, id) => turret(c, id, "turret", { period: 120, speed: 2, size: 4, twin: true })),
  H14: H((c, id) => mover(c, id, "saw", "line", 4)),
  H15: H((c, id) => mover(c, id, "saw", "line", 4, { pair: true })),
  H16: H((c, id) => mover(c, id, "saw", "orbit", 4)),
  H17: H((c, id) => mover(c, id, "bot", "floor", 3.6)),
  H18: H((c, id) => wallBeam(c, id, "flame")),
  H19: H((c, id) => pulse(c, id, "steam", "column", { duty: 0.35, warn: 30 })),
  H20: H((c, id) => spikes(c, id, "spark", true)),
  H21: H((c, id) => arc(c, id, "arc")),
  H22: H((c, id) => mover(c, id, "pendulum", "pendulum", 4.4)),
  H23: H((c, id) => mover(c, id, "mace", "orbit", 4.2)),
  H24: H((c, id) => mover(c, id, "grumpy", "static", 4.2)),
  H25: H((c, id) => mover(c, id, "grumpy", "static", 4.2, { pair: true })),
  H26: H((c, id) => mover(c, id, "grumpy", "bob", 4.2, { slow: true })),
  H27: H((c, id) => mover(c, id, "mine", "static", 3.2)),
  H28: H((c, id) => laserSweep(c, id, "light")),
  H29: H((c, id) => pulse(c, id, "meteor", "cell", { duty: 0.14, warn: 50 })),
  H30: H((c, id) => pulse(c, id, "bolt", "column", { duty: 0.1, warn: 44 })),
  H31: H((c, id) => mover(c, id, "drone", "orbit", 3.6)),
  H32: H((c, id) => mover(c, id, "drone", "orbit", 3.6, { pair: true })),
  H33: H((c, id) => mover(c, id, "barrel", "floor", 4)),
  H34: H((c, id) => crusher(c, id, "piston", true, true)),
  H35: H((c, id) => laserSpin(c, id, "blade", 2)),
  H36: () => null, // flood: placed after the other hazards
  H37: () => null,
  H38: H((c, id) => turret(c, id, "ink", { period: 120, speed: 1.4, size: 7 })),
  H39: H((c, id) => pulse(c, id, "bomb", "area", { duty: 0.15, warn: 56 })),
  H40: H((c, id) => laserSpin(c, id, "hand", 1, true)),
  H41: H((c, id) => pulse(c, id, "jaws", "cell", { duty: 0.25, warn: 22 })),
  H42: H((c, id) => mover(c, id, "bubble", "bob", 3.4, { slow: true })),
  H43: H((c, id) => pulse(c, id, "glitch", "cell", { duty: 0.5, warn: 18, period: 80 })),
  H44: H((c, id) => turret(c, id, "ball", { period: 80, speed: 4.2, size: 3.4 })),
  H45: H((c, id) => mover(c, id, "lamp", "pendulum", 4.4)),
  O15: H((c, id) => mirrorBeam(c, id)),
  S06: H((c) => faceRun(c, "ice")),
  S07: H((c) => faceRun(c, "honey")),
  S08: H((c) => faceRun(c, "speed")),
  S09: H((c) => faceRun(c, "conveyor")),
  S10: H((c) => faceRun(c, "bounce")),
  S24: H((c) => launchPad(c)),
  S11: H((c) => bumper(c)),
  S12: H((c) => pads(c)),
  S18: H((c, id) => spikes(c, id, "crumble", false)),
  O02: H((c) => keyAt(c)),
  A10: H((c) => keyAt(c)),
  O03: H((c) => doorWithKey(c)),
  O04: H((c) => switchAt(c, "laser")),
  O24: H((c) => switchAt(c, "laser")),
  O05: H((c) => switchAt(c, "all")),
  O30: H((c) => switchAt(c, "all")),
};
export const HAZARD_IDS = Object.keys(PLACERS).filter((k) => k[0] === "H");
const STRUCTURAL = new Set(["S06", "S07", "S08", "S09", "S10", "S24", "S11", "S12", "O02", "A10", "O03", "O04", "O24", "O05", "O30"]);

// ---------------------------------------------------------------- applying + undoing changes
interface Snap { cells: Uint8Array; door: Uint8Array; hz: number; faces: number; bumpers: number; pads: number; pickups: number; key: boolean; off: (boolean | undefined)[] }
const snap = (r: Room): Snap => ({ cells: r.cells.slice(), door: r.door.slice(), hz: r.hazards.length, faces: r.faces.length, bumpers: r.bumpers.length, pads: r.pads.length, pickups: r.pickups.length, key: r.key, off: r.hazards.map((h) => h.off) });
function restore(r: Room, s: Snap) {
  r.cells.set(s.cells); r.door.set(s.door);
  r.hazards.length = s.hz; r.faces.length = s.faces; r.bumpers.length = s.bumpers; r.pads.length = s.pads; r.pickups.length = s.pickups; r.key = s.key;
  r.hazards.forEach((h, i) => { h.off = s.off[i]; });
}
let pid = 0;
function apply(r: Room, ch: Change) {
  for (const [x, y] of ch.posts ?? []) r.cells[y * COLS + x] = 1;
  for (const [x, y] of ch.door ?? []) r.door[y * COLS + x] = 1;
  if (ch.hz) r.hazards.push(...ch.hz);
  if (ch.faces) r.faces.push(...ch.faces);
  if (ch.bumpers) r.bumpers.push(...ch.bumpers);
  if (ch.pads) r.pads.push(...ch.pads);
  for (const p of ch.pickups ?? []) r.pickups.push({ ...p, id: pid++ } as Pickup);
  if (ch.key) r.key = true;
  if (ch.offAll) for (const h of r.hazards) if (ch.offAll === "all" || h.k === "laser") h.off = true;
}

// ---------------------------------------------------------------- building a room
/** reject reasons (QA) */
export const BUILD_STATS = { noRoute: 0, short: 0, entries: 0, built: 0 };
/** every floor starts in its entrance hatch; this is the proof that it can be escaped from there */
const proven = (room: Room, margin: number, maxT = 3600) => solve(room, { margin, maxT });

export function buildRoom(rec: FloorRecipe, inX: number): Room {
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = tryBuild(rec, inX, attempt);
    if (room) return room;
  }
  return tryBuild({ ...rec, atoms: [], shape: "calm", calm: true, finale: undefined, name: rec.name }, inX, 99, true)!;
}

function tryBuild(rec: FloorRecipe, inX: number, attempt: number, force = false): Room | null {
  const rng = new Rng(hash32(rec.seed, attempt, inX));
  const shapeDef = SHAPES[rec.shape] ?? SHAPES.pillars;
  const h = rec.h || rng.int(shapeDef.h[0], shapeDef.h[1]);
  let outX = rng.int(2, COLS - 3);
  if (rec.shape === "shaft") outX = Math.max(2, Math.min(COLS - 3, inX + rng.int(-3, 3)));
  const side = outX <= 2 ? true : outX >= COLS - 3 ? false : rng.chance(0.5);
  const g = shapeDef.fn(rng, h, inX, outX);
  clearHoles(g, inX, outX, side);
  const rules: RoomRules = {};
  for (const a of rec.atoms) {
    switch (a) {
      case "A01": rules.dark = true; break; case "A02": rules.fog = true; break; case "A03": rules.mirror = true; break;
      case "A04": rules.flip = true; break; case "A05": rules.tilt = true; break; case "A15": rules.memory = true; break;
      case "A18": rules.strobe = true; break; case "A19": rules.kranky = true; break; case "A20": rules.alarm = true; break;
      case "A24": rules.silent = true; break; case "S22": rules.water = true; break; case "S23": rules.lowg = true; break;
      case "S21": rules.wind = true; break; case "A16": rules.big = true; break;
    }
  }
  const room: Room = {
    n: rec.n, y0: 0, h, cells: g.c, fake: new Uint8Array(COLS * h), door: new Uint8Array(COLS * h), inX, outX, key: false,
    faces: [], bumpers: [], pads: [], hazards: [], pickups: [], rules, rush: rec.rush, building: rec.building, floor: rec.floor,
    concepts: [], name: rec.name, fusion: rec.fusion, finale: rec.finale, par: 0, bots: [], seed: rec.seed, difficulty: rec.d, shape: rec.shape, decor: [],
  };
  const margin = rec.kid ? 3.2 : Math.max(0.9, 2.6 - 1.8 * rec.d);
  let base = solve(room, { margin: 0 });
  if (!base.ok) {
    BUILD_STATS.noRoute++;
    if (!force) return null;
    // the last resort: an empty shell with the exit stopper always has a way out
    room.cells.set(openRoom(h, inX, outX, side).c);
    base = solve(room, { margin: 0 });
    if (!base.ok) return null;
  }
  // a floor should take a few moves to cross (no one-dash rooms): reject short layouts before any hazard work
  const minMoves = rec.calm ? 2 : Math.round((4 + 4 * Math.min(1, rec.d)) * (rec.shape === "shaft" || rec.shape === "spiral" || rec.shape === "twin" ? 0.75 : 1));
  if (!force && base.leaps.length < minMoves) { BUILD_STATS.short++; return null; }
  let hid = 0;
  const ctx: Ctx = {
    room, rng, d: rec.d, margin, path: base.path, reach: base.reach, base,
    id: () => hid++,
    periodBlink: () => (rec.d < 0.6 ? 120 : rng.pick([60, 120])),
    duty: Math.min(0.68, 0.36 + 0.3 * rec.d),
    rhythm: rec.atoms.includes("A14"),
  };
  const used: string[] = [];
  const atoms = [...rec.atoms];
  // structural concepts first, then hazards (most important first)
  const order = [...atoms.filter((a) => STRUCTURAL.has(a)), ...atoms.filter((a) => !STRUCTURAL.has(a) && PLACERS[a])];
  for (const a of order) {
    const place = PLACERS[a];
    let ok = false;
    for (let k = 0; k < 4 && !ok; k++) {
      const ch = place(ctx, a);
      if (!ch) continue;
      const s = snap(room);
      apply(room, ch);
      // still escapable along the last route? (cheap) — else search again
      if (!ch.posts?.length && !ch.faces?.length && !ch.bumpers?.length && !ch.pads?.length && !ch.door?.length && !ch.key && replay(room, base.leaps, margin)) { ok = true; continue; }
      const r = solve(room, { margin, maxT: Math.min(3000, base.t * 2 + 600) });
      if (r.ok) { ok = true; base = r; ctx.path = r.path; ctx.reach = r.reach; }
      else restore(room, s);
    }
    if (ok) used.push(a);
  }
  // a rising flood (chase floors)
  const flood = atoms.find((a) => a === "H36" || a === "H37" || a === "A09");
  if (flood && base.ok) {
    // the flood leaves time to think: the fastest route plus a moment per move
    let rate = ((h - 1) * U) / (base.t * (flood === "H37" ? 1.35 : 1.7) + base.leaps.length * (flood === "H37" ? 30 : 42) + 90);
    for (let k = 0; k < 5; k++) {
      const fh: Hazard = { k: "flood", id: hid++, skin: flood === "H37" ? "lava" : buildingOf(rec.building).id === 22 ? "dino" : "slime", concept: flood === "A09" ? "H36" : flood, y0: -4, delay: 70, rate };
      room.hazards.push(fh);
      if (proven(room, margin).ok) { used.push(flood); break; }
      room.hazards.pop();
      rate *= 0.75;
    }
  }
  // the room must be escapable with the full safety margin; peel hazards off until it is
  let fin = proven(room, margin);
  while (!fin.ok && room.hazards.length) {
    room.hazards.pop();
    fin = proven(room, margin);
  }
  if (!fin.ok) {
    BUILD_STATS.entries++;
    if (!force) return null;
    fin = base;
  }
  BUILD_STATS.built++;
  room.par = fin.t;
  room.bots = [fin.leaps];
  base = fin;
  ctx.path = base.path; ctx.reach = base.reach;
  ctx.alt = [...base.reach].filter((c) => !base.path.includes(c));
  room.concepts = [...new Set([...used, ...rec.atoms.filter((a) => !PLACERS[a] || used.includes(a)), `W${String(((rec.building - 1) % 24) + 1).padStart(2, "0")}`, buildingOf(rec.building).music, ...(rec.finale ? [rec.finale] : []), "S01", "S02", "S03", "S04", "O01", "X01"])].filter((c) => CONCEPT[c]);
  placePickups(room, rec, ctx, margin);
  placeDecor(room, rec, rng);
  return room;
}

// ---------------------------------------------------------------- pickups + decor
function placePickups(room: Room, rec: FloorRecipe, c: Ctx, margin: number) {
  const add = (k: PickupKind, x: number, y: number) => { room.pickups.push({ id: pid++, k, x, y }); };
  const path = c.path;
  // coins line the route
  const rain = rec.atoms.includes("A12") || rec.atoms.includes("A23") || rec.atoms.includes("O06") || rec.calm;
  const step = rain ? 1 : 2;
  let coins = 0;
  for (let i = 3; i < path.length - 2 && coins < (rain ? 40 : 22); i += step) {
    const cell = path[i];
    const [x, y] = cellXY(cell);
    if (room.pickups.some((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4)) continue;
    add("coin", x, y); coins++;
  }
  if (rain) for (const cell of [...c.reach].slice(0, 30)) { const [x, y] = cellXY(cell); if (!room.pickups.some((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4)) add("coin", x, y); }
  // a verified spot off the route (reachable and still escapable)
  const verified = (k: PickupKind, minD = 2): boolean => {
    const alt = (c.alt ?? []).filter((cell) => { const x = cell % COLS, y = Math.floor(cell / COLS); return !nearHole(room, x, y, 2) && !room.pickups.some((p) => Math.abs(p.x - C(x)) < 6 && Math.abs(p.y - C(y)) < 6); });
    if (alt.length) { const cell = c.rng.pick(alt); const [x, y] = cellXY(cell); add(k, x, y); return true; }
    for (let tries = 0; tries < 2; tries++) {
      const q = offPath(c, minD);
      if (!q) return false;
      const x = C(q[0]), y = C(q[1]);
      if (room.pickups.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 6)) continue;
      if (solve(room, { margin, must: { x, y }, maxT: Math.min(3600, room.par * 2 + 900) }).ok) { add(k, x, y); return true; }
    }
    return false;
  };
  const nD = rec.calm ? 1 : 3;
  for (let i = 0; i < nD; i++) if (!verified("diamond", rec.atoms.includes("A13") ? 3 : 2)) {
    // fall back to the route itself
    const cell = path[Math.floor(path.length * (0.3 + 0.2 * i))];
    if (cell !== undefined) { const [x, y] = cellXY(cell); add("diamond", x, y); }
  }
  if (rec.hearts) verified("heart", 1);
  if (rec.atoms.includes("O14") || rec.atoms.includes("A11")) verified("buddy", 1);
  if (rec.atoms.includes("O08")) verified("heart", 2);
  const onPath = (k: PickupKind, f: number) => { const cell = path[Math.floor(path.length * f)]; if (cell !== undefined) { const [x, y] = cellXY(cell); room.pickups = room.pickups.filter((p) => !(p.k === "coin" && Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5)); add(k, x, y); } };
  if (rec.booster || rec.atoms.includes("O09")) onPath("booster", 0.35);
  if (rec.atoms.includes("O10")) onPath("shield", 0.25);
  if (rec.atoms.includes("O11")) onPath("slowmo", 0.3);
  if (rec.atoms.includes("O12")) onPath("magnet", 0.2);
  if (rec.atoms.includes("O13")) onPath("ghost", 0.3);
  if (rec.atoms.includes("O17")) for (const f of [0.3, 0.55, 0.8]) onPath("plate", f);
  if (rec.calm && rec.building > 1) { const q = offPath(c, 1); if (q) add("vend", C(q[0]), C(q[1])); }
  // a fake wall pocket full of coins (O20)
  if (rec.atoms.includes("O20")) {
    for (let k = 0; k < 20; k++) {
      const x = c.rng.chance(0.5) ? 1 : COLS - 3, y = c.rng.int(3, room.h - 5);
      let ok = true;
      for (let j = 0; j < 2 && ok; j++) for (let i = 0; i < 2 && ok; i++) if (isWall(room, x + i, y + j) || path.includes((y + j) * COLS + x + i)) ok = false;
      if (!ok) continue;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { room.cells[(y + j) * COLS + x + i] = 1; room.fake[(y + j) * COLS + x + i] = 1; add("coin", C(x + i), C(y + j)); }
      break;
    }
  }
}

const DECOR_BY: Record<string, string> = { O18: "alarm", O19: "vent", O23: "screen", O26: "crate", O27: "pipe", O28: "sign", O29: "trophy", A19: "screen" };
function placeDecor(room: Room, rec: FloorRecipe, rng: Rng) {
  const kinds = rec.atoms.map((a) => DECOR_BY[a]).filter(Boolean);
  kinds.push(rng.pick(["sign", "vent", "pipe", "sign", "crate"]));
  if (room.rules.alarm) kinds.push("alarm", "alarm");
  if (room.rules.kranky || rec.finale) kinds.push("screen");
  for (const k of kinds) {
    for (let t = 0; t < 12; t++) {
      const left = rng.chance(0.5), y = rng.int(3, room.h - 4);
      const cx = left ? 0 : COLS - 1, ex = left ? 1 : COLS - 2;
      if (!isWall(room, cx, y) || isWall(room, ex, y) || room.decor.some((d) => Math.abs(d.cy - y) < 3 && d.cx === cx)) continue;
      room.decor.push({ k, cx, cy: y, n: left ? 1 : 3 });
      break;
    }
  }
}

// ---------------------------------------------------------------- the director
const RULE_POOL = ["A01", "A02", "A03", "A04", "A05", "A14", "A15", "A18", "A19", "A20", "A24"];
const finaleSet: Record<string, string[]> = {
  B01: ["H08", "H10", "H08", "H24"], B02: ["H04", "H04", "H02", "H11"], B03: ["H31", "H32", "H31", "H05"], B04: ["H16", "H16", "H14", "H04"],
  B05: ["H09", "H10", "H34", "H08"], B06: ["H43", "H43", "H43", "H02"], B07: ["H22", "H22", "H42", "H36"], B08: ["H37", "H18", "H18", "H19"],
  B09: ["H29", "H29", "H41", "H06"], B10: ["H40", "H40", "H35", "H07"], B11: ["H33", "H39", "H26", "H39"], B12: ["H11", "H12", "H13", "H11"],
  B13: ["H28", "H45", "H28", "H45"], B14: ["H36", "H31", "H27", "H14"], B15: ["H04", "H11", "H08", "H16", "H37", "H29"],
  A09: ["H36", "H06", "H24", "H02"], A20: ["H02", "H05", "H28", "H11"], A22: ["H02", "H11", "H14", "H08", "H06", "H04"],
};

const conceptsUpTo = (b: number) => BUILDINGS.slice(0, b - 1).flatMap((x) => x.news);
const shapesFor = (known: string[]) => { const s = known.map((k) => SHAPE_OF[k]).filter(Boolean); return ["zigzag", "split", ...s]; };

export function difficultyOf(n: number) {
  if (n > JOURNEY_FLOORS) return Math.min(1, 0.86 + 0.002 * Math.floor((n - JOURNEY_FLOORS) / 10));
  const b = Math.ceil(n / 10), f = ((n - 1) % 10) + 1;
  return Math.min(1, 0.1 + (0.62 * (b - 1)) / 23 + (0.22 * (f - 1)) / 9);
}

export function journeyRecipe(n: number, kid = false): FloorRecipe {
  const b = Math.ceil(n / 10), f = ((n - 1) % 10) + 1;
  const B = BUILDINGS[b - 1];
  const rng = new Rng(hash32(0xe5c, n));
  const d = difficultyOf(n) * (kid ? 0.6 : 1);
  const news = B.news;
  const introduced = news.slice(0, Math.max(1, Math.ceil((news.length * f) / 8)));
  const known = [...conceptsUpTo(b), ...introduced];
  const featured = news.length ? news[Math.min(news.length - 1, Math.floor(((f - 1) * news.length) / 8))] : null;
  const seed = hash32(0xe5c, n, 7);
  const name = `${B.name}`;
  if (f === 10) {
    const set = finaleSet[B.finale] ?? finaleSet.A22;
    const atoms = [...new Set([...set.slice(0, 2 + Math.round(d * (set.length - 2))), ...(B.finale === "A20" ? ["A20"] : []), ...(B.finale === "A09" ? ["A09"] : [])])];
    return { n, building: b, floor: f, d: Math.min(1, d + 0.08), atoms, shape: "finale", h: 0, rush: B.finale === "A22" && b === 20 ? 1.5 : 1, seed, name, finale: B.finale, hearts: true };
  }
  if (f === 1) {
    const atoms = b === 1 ? ["S05"] : [rng.pick(known.filter((k) => PLACERS[k] && k[0] === "H")), "A08", "O22", "O21"];
    return { n, building: b, floor: f, d: d * 0.6, atoms, shape: b === 1 ? "pillars" : "calm", h: 0, rush: 1, seed, name, calm: true, hearts: b > 1 };
  }
  const hazardsKnown = known.filter((k) => k[0] === "H");
  const nH = b === 1 ? (f <= 3 ? 1 : 2) : Math.min(6, 1 + Math.round(d * 4.5) + (rng.chance(0.3) ? 1 : 0));
  const atoms: string[] = [];
  if (featured) atoms.push(featured);
  const ownH = news.filter((k) => k[0] === "H" && introduced.includes(k));
  while (atoms.filter((a) => a[0] === "H").length < nH && hazardsKnown.length) {
    const pool = rng.chance(0.55) && ownH.length ? ownH : hazardsKnown;
    const a = rng.pick(pool);
    if (atoms.filter((x) => x === a).length < 2) atoms.push(a);
    else if (hazardsKnown.length <= 2) break;
  }
  const surf = known.filter((k) => STRUCTURAL.has(k) && k[0] === "S");
  if (surf.length && rng.chance(0.4)) atoms.push(rng.pick(surf));
  const rulesKnown = known.filter((k) => RULE_POOL.includes(k));
  if (rulesKnown.length && rng.chance(0.12 + 0.25 * d)) atoms.push(rng.pick(rulesKnown));
  const objs = known.filter((k) => ["O02", "O03", "O04", "O05", "O24", "O09", "O10", "O11", "O12", "O13", "O14", "O17", "O20", "O08"].includes(k));
  if (objs.length && rng.chance(0.35)) atoms.push(rng.pick(objs));
  if (known.includes("A12") && rng.chance(0.15)) atoms.push("A12");
  if (known.includes("A13") && rng.chance(0.2)) atoms.push("A13");
  const shapes = shapesFor(known);
  const featShape = featured && SHAPE_OF[featured];
  const shape = featShape ?? (atoms.includes("A21") ? "twin" : rng.pick(shapes));
  // speed rushes: some floors run ×1.5 or ×2, then calm down again
  const rush = b >= 2 && (f === 4 || f === 8) ? (b >= 5 && f === 8 ? 2 : 1.5) : 1;
  if (rush === 1.5) atoms.push("A06"); else if (rush === 2) atoms.push("A07");
  return { n, building: b, floor: f, d, atoms: [...new Set(atoms)], shape, h: atoms.includes("A16") ? 26 : atoms.includes("A17") ? 12 : 0, rush, seed, name, hearts: f === 3 || f === 6 || f === 9 || (f === 5 && b > 8), booster: f === 2 || f === 7 || (f === 5 && b >= 3) };
}

// ---------------------------------------------------------------- Infinite Fusion (floor 241 → ∞)
const WORD: Record<string, string> = {
  H01: "Laser", H02: "Strobe", H03: "Sweeping", H04: "Spinning", H05: "Gated", H06: "Spiky", H07: "Popping", H08: "Crushing", H09: "Slamming", H10: "Twin-Crush",
  H11: "Turret", H12: "Rapid", H13: "Crossfire", H14: "Sawing", H15: "Twin-Saw", H16: "Orbiting", H17: "Patrolled", H18: "Blazing", H19: "Steamy", H20: "Sparking",
  H21: "Tesla", H22: "Swinging", H23: "Mace", H24: "Grumpy", H25: "Grumpy-Guarded", H26: "Bobbing", H27: "Mined", H28: "Searchlit", H29: "Meteor", H30: "Thunder",
  H31: "Droning", H32: "Swarming", H33: "Barrel", H34: "Piston", H35: "Fan-Blade", H36: "Flooding", H37: "Lava", H38: "Inky", H39: "Paint-Bomb", H40: "Clockwork",
  H41: "Snapping", H42: "Bubbly", H43: "Glitchy", H44: "Fast-Ball", H45: "Spotlit", S06: "Frosty", S07: "Honeyed", S08: "Sprint", S09: "Conveyor", S10: "Bouncy",
  S11: "Bumper", S12: "Teleport", S18: "Crumbly", S24: "Launch", O02: "Locked", O03: "Keycard", O04: "Switch", O05: "Lever", O15: "Mirror", O24: "Hacked",
  A01: "Dark", A02: "Foggy", A03: "Mirrored", A04: "Upside-down", A05: "Tilted", A14: "Rhythm", A15: "Memory", A18: "Strobe-lit", A20: "Alarm", A21: "Twin",
};
const SHAPE_NOUN: Record<string, string> = { pillars: "Hall", stairs: "Climb", zigzag: "Zig-zag", maze: "Maze", shaft: "Shaft", split: "Gallery", spiral: "Spiral", twin: "Mirror Hall" };
const ATOMS = Object.keys(WORD);

export function fusionRecipe(n: number, mem: FusionMemory, kid = false, pool?: string[]): FloorRecipe {
  const rng = new Rng(hash32(0xf0e, n));
  const k = n - JOURNEY_FLOORS;
  const building = ((k - 1) % 24 + Math.floor((k - 1) / 24) * 5) % 24 + 1;
  const d = difficultyOf(n) * (kid ? 0.6 : 1);
  const seed = hash32(0xf0e, n, 3);
  if (k % 10 === 0) {
    const bosses = Object.keys(finaleSet).filter((x) => x[0] === "B");
    const finale = rng.pick(bosses);
    return { n, building, floor: 0, d: Math.min(1, d + 0.06), atoms: finaleSet[finale], shape: "finale", h: 0, rush: 1, seed, name: `${buildingOf(building).name} · Finale`, finale, hearts: true };
  }
  const src = pool && pool.length ? pool : ATOMS;
  const recent = new Set(mem.recent);
  const seen = new Set(mem.seen);
  let best: { atoms: string[]; score: number } | null = null;
  for (let t = 0; t < 40; t++) {
    const size = 2 + (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.15) ? 1 : 0);
    const atoms = new Set<string>();
    // at least one hazard, at most one rule, at most one structural surface
    const hz = src.filter((a) => a[0] === "H");
    atoms.add(rng.pick(hz.length ? hz : ATOMS.filter((a) => a[0] === "H")));
    while (atoms.size < size) {
      const a = rng.pick(src);
      if (a[0] === "A" && [...atoms].some((x) => x[0] === "A")) continue;
      if (a[0] === "S" && [...atoms].some((x) => x[0] === "S")) continue;
      atoms.add(a);
    }
    const list = [...atoms].sort();
    const key = list.join("+");
    let score = rng.next() * 0.3;
    for (const a of list) if (!recent.has(a)) score += 1;
    if (!seen.has(key)) score += 2;
    if (!best || score > best.score) best = { atoms: list, score };
  }
  const atoms = best!.atoms;
  const shape = rng.pick(["zigzag", "maze", "stairs", "split", "shaft", "spiral", "twin", "maze", "zigzag"]);
  const words = atoms.map((a) => WORD[a]).filter(Boolean);
  const name = `${words.slice(0, 2).join(" ")} ${SHAPE_NOUN[shape]}`;
  const rush = k % 7 === 3 ? 1.5 : k % 13 === 6 ? 2 : 1;
  const extra = rush === 1.5 ? ["A06"] : rush === 2 ? ["A07"] : [];
  return {
    n, building, floor: 0, d, atoms: [...atoms, ...extra], shape, h: 0, rush, seed, name,
    fusion: { name, atoms, key: atoms.join("+") }, hearts: k % 3 === 0, booster: k % 4 === 1,
  };
}

/** the recipe for floor n of an Escape Run */
export function floorRecipe(n: number, mem: FusionMemory, kid = false): FloorRecipe {
  return n <= JOURNEY_FLOORS ? journeyRecipe(n, kid) : fusionRecipe(n, mem, kid);
}

export { ALWAYS };

// ---------------------------------------------------------------- recipes per mode
export type EscapeMode = "run" | "daily" | "series" | "lab" | "attract";
export interface ModeParams { daily?: string; series?: number; lab?: { atoms: string[]; building: number; seed: number }; kid?: boolean }
export const MODE_FLOORS: Record<EscapeMode, number> = { run: Infinity, daily: 10, series: 3, lab: Infinity, attract: Infinity };

export function recipeFor(mode: EscapeMode, n: number, p: ModeParams, mem: FusionMemory): FloorRecipe {
  const kid = !!p.kid;
  switch (mode) {
    case "run": return floorRecipe(n, mem, kid);
    case "daily": {
      const base = JOURNEY_FLOORS + (hash32(0xd41, ...[...(p.daily ?? "x")].map((c) => c.charCodeAt(0))) % 500) * 10;
      const r = fusionRecipe(base + n, { recent: [], seen: [] }, kid);
      return { ...r, n, name: r.finale ? "Daily Heist · Finale" : `Daily Heist · ${r.name}` };
    }
    case "series": {
      const s = p.series ?? 1;
      const j = Math.min(JOURNEY_FLOORS - 1, 8 + s * 6 + n);
      const r = journeyRecipe(j === 0 || j % 10 === 0 || j % 10 === 1 ? j + 2 : j, kid);
      return { ...r, n, seed: hash32(0x5e5, s, n), name: `Series ${s} · ${n}/3`, floor: n, calm: false };
    }
    case "lab": {
      const lab = p.lab ?? { atoms: ["H02"], building: 1, seed: 1 };
      const r = fusionRecipe(JOURNEY_FLOORS + n, { recent: [], seen: [] }, kid, lab.atoms);
      return { ...r, n, building: lab.building, seed: hash32(lab.seed, n), name: `Lab · ${r.name}` };
    }
    case "attract": {
      const r = journeyRecipe(2 + ((n - 1) % 8), true);
      return { ...r, n, d: 0.2 };
    }
  }
}
