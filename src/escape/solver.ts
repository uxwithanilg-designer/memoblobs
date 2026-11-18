// Time-aware solver for a Momo Escape room. A state is "Momo resting on a wall" (cell · wall side · collected bits ·
// tick mod T); the actions are "wait one tick" and "dash up / right / down / left". Every edge is simulated tick by tick
// with the game's own step function against every hazard (grown by a safety margin), so a room is only shown if a real
// path to the exit hatch exists. Earliest arrival wins (hazards are periodic; a flood only gets worse), so time folds.
import { hazardBox, hits, periodsOf } from "./hazards";
import { cellOf, entryRunner, F_BUMP, NO_MOVE, packMove, roomEnv, stepRunner, type Runner } from "./sim";
import { COLS, R_RUN, T_FOLD, U, type Room } from "./types";

export interface SolveOpts {
  margin: number;
  maxT?: number;
  /** a pickup that must be collected on the way (diamond / heart / buddy checks) */
  must?: { x: number; y: number };
}
export interface SolveResult {
  ok: boolean;
  /** exit tick */
  t: number;
  /** the autopilot's moves, (tick << 2) | direction, in tick order */
  leaps: number[];
  /** cells Momo passes along the route, in order */
  path: number[];
  /** every cell Momo can rest on or dash through safely */
  reach: Set<number>;
  states: number;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

interface Node { r: Runner; bits: number; t: number; parent: number; /** packed move that led here, −1 = waited */ move: number }

let VIS = new Uint8Array(1 << 20);

export function solve(room: Room, o: SolveOpts): SolveResult {
  const maxT = o.maxT ?? 3600;
  const hasKey = room.key || room.door.some((v) => v === 1);
  const keyP = room.pickups.find((p) => p.k === "key");
  const swP = room.pickups.find((p) => p.k === "switch");
  const bitN = (hasKey ? 2 : 1) * (swP ? 2 : 1) * (o.must ? 2 : 1);
  // fold time by the room's own rhythm (every period divides T_FOLD); a room of still hazards folds to one phase
  let T = 1;
  for (const h of room.hazards) for (const p of periodsOf(h)) T = lcm(T, p);
  if (T_FOLD % T) T = T_FOLD;
  const size = COLS * room.h * 4 * bitN * T;
  if (VIS.length < size) VIS = new Uint8Array(size);
  else VIS.fill(0, 0, size);
  const st = { key: false, inClosed: false };
  const env = roomEnv(room, st);
  const hz = room.hazards;
  const pad = R_RUN + o.margin + 1;
  const boxes = hz.map((h) => { const b = hazardBox(h, room.h); return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]; });
  const hitAny = (t: number, x: number, y: number, sw: boolean) => {
    for (let i = 0; i < hz.length; i++) { const b = boxes[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (hits(hz[i], t, x, y, o.margin, sw)) return true; }
    return false;
  };
  // bit layout: key (if any) · switch (if any) · must (if any)
  const shiftOf = (which: "key" | "sw" | "must") => (which === "key" ? 0 : which === "sw" ? (hasKey ? 1 : 0) : (hasKey ? 1 : 0) + (swP ? 1 : 0));
  const has = (which: "key" | "sw" | "must") => (which === "key" ? hasKey : which === "sw" ? !!swP : !!o.must);
  const bitOf = (b: number, which: "key" | "sw" | "must") => (has(which) ? (b >> shiftOf(which)) & 1 : 0);
  const setBit = (b: number, which: "key" | "sw" | "must") => (has(which) ? b | (1 << shiftOf(which)) : b);
  const near = (p: { x: number; y: number }, r: Runner) => { const dx = p.x - r.x, dy = p.y - r.y; return dx * dx + dy * dy < 49; };

  const reach = new Set<number>();
  const nodes: Node[] = [];
  const buckets: number[][] = [];
  const push = (n: Node) => {
    const cx = cellOf(n.r.x), cy = cellOf(n.r.y);
    if (cx < 0 || cy < 0 || cy >= room.h) return;
    const k = ((((cy * COLS + cx) * 4 + n.r.g) * bitN + n.bits) * T) + (n.t % T);
    if (VIS[k]) return;
    VIS[k] = 1;
    nodes.push(n);
    (buckets[n.t] ??= []).push(nodes.length - 1);
    reach.add(cy * COLS + cx);
  };

  let goal = -1, goalT = Infinity;
  const trail: number[] = [];
  const simulate = (from: Node, move: number, parent: number) => {
    const r: Runner = { ...from.r };
    let bits = from.bits, t = from.t;
    const packed = move >= 0 ? packMove(from.t + 1, move) : -1;
    trail.length = 0;
    for (let first = true; ; first = false) {
      st.key = bitOf(bits, "key") === 1;
      st.inClosed = cellOf(r.y) >= 1;
      const f = stepRunner(r, env, first ? move : NO_MOVE);
      if (f & F_BUMP) return;
      t++;
      if (t > maxT || t >= goalT) return;
      if (hitAny(t, r.x, r.y, bitOf(bits, "sw") === 1)) return;
      const cy = cellOf(r.y);
      if (move >= 0) trail.push(cy * COLS + cellOf(r.x));
      if (keyP && !bitOf(bits, "key") && near(keyP, r)) bits = setBit(bits, "key");
      if (swP && !bitOf(bits, "sw") && near(swP, r)) bits = setBit(bits, "sw");
      if (o.must && !bitOf(bits, "must") && near(o.must, r)) bits = setBit(bits, "must");
      if (cy >= room.h - 1) {
        if (o.must && !bitOf(bits, "must")) return;
        for (const c of trail) reach.add(c);
        nodes.push({ r, bits, t, parent, move: packed });
        goal = nodes.length - 1; goalT = t;
        return;
      }
      if (r.mode === 0) { for (const c of trail) reach.add(c); push({ r, bits, t, parent, move: packed }); return; }
    }
  };

  const start = entryRunner(room);
  push({ r: start, bits: 0, t: 0, parent: -1, move: -1 });
  // time buckets in order; keep going until no earlier exit is possible
  for (let t = 0; t <= maxT && t < goalT; t++) {
    const b = buckets[t];
    if (!b) continue;
    for (let i = 0; i < b.length; i++) {
      const idx = b[i], n = nodes[idx];
      for (let d = 0; d < 4; d++) simulate(n, d, idx);
      simulate(n, NO_MOVE, idx);
    }
    buckets[t] = undefined as unknown as number[];
  }
  if (goal < 0) return { ok: false, t: 0, leaps: [], path: [], reach, states: nodes.length };

  // walk back: the moves, then the cells along the way (re-simulated for the full trail)
  const leaps: number[] = [];
  for (let i = goal; i >= 0; i = nodes[i].parent) if (nodes[i].move >= 0) leaps.push(nodes[i].move);
  leaps.sort((a, b) => a - b);
  const path: number[] = [];
  {
    const r = { ...start };
    const at = new Map(leaps.map((m) => [m >> 2, m & 3]));
    let bits = 0;
    for (let t = 1; t <= goalT; t++) {
      st.key = bitOf(bits, "key") === 1;
      st.inClosed = cellOf(r.y) >= 1;
      stepRunner(r, env, at.get(t) ?? NO_MOVE);
      if (keyP && near(keyP, r)) bits = setBit(bits, "key");
      const c = cellOf(r.y) * COLS + cellOf(r.x);
      if (path[path.length - 1] !== c) path.push(c);
    }
  }
  return { ok: true, t: goalT, leaps, path, reach, states: nodes.length };
}

/** cell centre of a packed cell index */
export const cellXY = (c: number): [number, number] => [((c % COLS) + 0.5) * U, (Math.floor(c / COLS) + 0.5) * U];

/** replay a known move list from the entrance (cheap re-check after a small change); true if Momo still escapes */
export function replay(room: Room, moves: number[], margin: number, maxT = 4000): boolean {
  const st = { key: false, inClosed: false };
  const env = roomEnv(room, st);
  const r = entryRunner(room);
  const at = new Map(moves.map((m) => [m >> 2, m & 3]));
  const last = moves.length ? moves[moves.length - 1] >> 2 : 0;
  const keyP = room.pickups.find((p) => p.k === "key"), swP = room.pickups.find((p) => p.k === "switch");
  let sw = false;
  for (let t = 1; t <= maxT; t++) {
    st.inClosed = cellOf(r.y) >= 1;
    stepRunner(r, env, at.get(t) ?? NO_MOVE);
    for (const h of room.hazards) if (hits(h, t, r.x, r.y, margin, sw)) return false;
    if (keyP && !st.key && (keyP.x - r.x) ** 2 + (keyP.y - r.y) ** 2 < 49) st.key = true;
    if (swP && !sw && (swP.x - r.x) ** 2 + (swP.y - r.y) ** 2 < 49) sw = true;
    if (cellOf(r.y) >= room.h - 1) return true;
    if (t > last && r.mode === 0) return false;
  }
  return false;
}
