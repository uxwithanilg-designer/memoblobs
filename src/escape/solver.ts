// Time-aware solver for a Momo Escape room. A state is "Momo standing on a cell centre" (cell · surface · direction ·
// collected bits · tick mod T_FOLD); the actions are "keep running" and "leap". Edges are simulated tick by tick with the
// game's own step function against every hazard (grown by a safety margin), so a room is only shown if a real path to the
// exit hatch exists. Earliest arrival wins (hazards are periodic; a flood only gets worse), so time folds safely.
import { hazardBox, hits, periodsOf } from "./hazards";
import { R_RUN } from "./types";
import { cellOf, entryRunner, roomEnv, stepRunner, type Runner } from "./sim";
import { COLS, T_FOLD, U, type Room } from "./types";

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
  /** ticks at which the autopilot taps */
  leaps: number[];
  /** cells Momo stands on along the path (decision points + every tick's cell) */
  path: number[];
  /** every cell Momo can stand on at some point (decision states reached) */
  reach: Set<number>;
  states: number;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const gdIndex = (g: number, d: number) => g * 2 + (d === (g + 1) % 4 ? 0 : 1);

interface Node { r: Runner; bits: number; t: number; parent: number; leapAt: number }

let VIS = new Uint8Array(1 << 20);

export function solve(room: Room, variant: number, o: SolveOpts): SolveResult {
  const maxT = o.maxT ?? 3600;
  const hasKey = room.key || room.door.some((v) => v === 1);
  const keyP = room.pickups.find((p) => p.k === "key");
  const swP = room.pickups.find((p) => p.k === "switch");
  const bitN = (hasKey ? 2 : 1) * (swP ? 2 : 1) * (o.must ? 2 : 1);
  // fold time by the room's own rhythm (every period divides T_FOLD); a room of still hazards folds to one phase
  let T = 1;
  for (const h of room.hazards) for (const p of periodsOf(h)) T = lcm(T, p);
  if (T_FOLD % T) T = T_FOLD;
  const cellsN = COLS * room.h;
  const size = cellsN * 8 * bitN * T;
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
  const reach = new Set<number>();
  const nodes: Node[] = [];
  const buckets: number[][] = [];
  const push = (n: Node) => {
    const cx = cellOf(n.r.x), cy = cellOf(n.r.y);
    if (cx < 0 || cy < 0 || cy >= room.h) return;
    const k = ((((cy * COLS + cx) * 8 + gdIndex(n.r.g, n.r.d)) * bitN + n.bits) * T) + (n.t % T);
    if (VIS[k]) return;
    VIS[k] = 1;
    nodes.push(n);
    (buckets[n.t] ??= []).push(nodes.length - 1);
    reach.add(cy * COLS + cx);
  };
  const bitOf = (b: number, which: "key" | "sw" | "must") => {
    // bit layout: key (if any) · switch (if any) · must (if any)
    let shift = 0;
    if (which === "key") return hasKey ? b & 1 : 0;
    if (hasKey) shift++;
    if (which === "sw") return swP ? (b >> shift) & 1 : 0;
    if (swP) shift++;
    return o.must ? (b >> shift) & 1 : 0;
  };
  const setBit = (b: number, which: "key" | "sw" | "must") => {
    let shift = 0;
    if (which === "key") return hasKey ? b | 1 : b;
    if (hasKey) shift++;
    if (which === "sw") return swP ? b | (1 << shift) : b;
    if (swP) shift++;
    return o.must ? b | (1 << shift) : b;
  };
  const near = (p: { x: number; y: number }, r: Runner) => { const dx = p.x - r.x, dy = p.y - r.y; return dx * dx + dy * dy < 49; };

  const start = entryRunner(room, variant);
  // the start state is a decision point for run entries; leap entries fly first
  let goal = -1, goalT = 0;
  const simulate = (from: Node, leap: boolean, parent: number) => {
    const r: Runner = { ...from.r };
    let bits = from.bits, t = from.t;
    let first = true;
    const leapAt = leap ? t + 1 : -1;
    for (;;) {
      st.key = bitOf(bits, "key") === 1;
      st.inClosed = cellOf(r.y) >= 1;
      stepRunner(r, env, first && leap);
      first = false;
      t++;
      if (t > maxT) return;
      const cy = cellOf(r.y);
      const sw = bitOf(bits, "sw") === 1;
      if (hitAny(t, r.x, r.y, sw)) return;
      if (keyP && !bitOf(bits, "key") && near(keyP, r)) bits = setBit(bits, "key");
      if (swP && !bitOf(bits, "sw") && near(swP, r)) bits = setBit(bits, "sw");
      if (o.must && !bitOf(bits, "must") && near(o.must, r)) bits = setBit(bits, "must");
      if (cy >= room.h - 1 && (!o.must || bitOf(bits, "must"))) {
        nodes.push({ r, bits, t, parent, leapAt });
        goal = nodes.length - 1; goalT = t;
        return;
      }
      if (r.mode === 0 && r.arrived) { push({ r, bits, t, parent, leapAt }); return; }
    }
  };

  if (start.mode === 0) push({ r: start, bits: 0, t: 0, parent: -1, leapAt: -1 });
  else { const root: Node = { r: start, bits: 0, t: 0, parent: -1, leapAt: -1 }; nodes.push(root); simulate(root, false, 0); }

  for (let t = 0; t <= maxT && goal < 0; t++) {
    const b = buckets[t];
    if (!b) continue;
    for (let i = 0; i < b.length && goal < 0; i++) {
      const idx = b[i], n = nodes[idx];
      simulate(n, false, idx);
      if (goal >= 0) break;
      simulate(n, true, idx);
    }
    buckets[t] = undefined as unknown as number[];
  }
  if (goal < 0) return { ok: false, t: 0, leaps: [], path: [], reach, states: nodes.length };

  // walk back: leap ticks + the cells along the way (re-simulated for the full trail)
  const chain: Node[] = [];
  for (let i = goal; i >= 0; i = nodes[i].parent) chain.push(nodes[i]);
  chain.reverse();
  const leaps = chain.filter((n) => n.leapAt >= 0).map((n) => n.leapAt).sort((a, b) => a - b);
  const path: number[] = [];
  {
    const r = { ...start };
    let t = 0, bits = 0;
    const set = new Set(leaps);
    for (; t < goalT; ) {
      st.key = bitOf(bits, "key") === 1;
      st.inClosed = cellOf(r.y) >= 1;
      stepRunner(r, env, set.has(t + 1));
      t++;
      if (keyP && near(keyP, r)) bits = setBit(bits, "key");
      const c = cellOf(r.y) * COLS + cellOf(r.x);
      if (path[path.length - 1] !== c) path.push(c);
    }
  }
  return { ok: true, t: goalT, leaps, path, reach, states: nodes.length };
}

/** cell centre of a packed cell index */
export const cellXY = (c: number): [number, number] => [((c % COLS) + 0.5) * U, (Math.floor(c / COLS) + 0.5) * U];

/** replay a known tap list from an entry (cheap re-check after a small change); true if Momo still escapes */
export function replay(room: Room, variant: number, leaps: number[], margin: number, maxT = 4000): boolean {
  const st = { key: false, inClosed: false };
  const env = roomEnv(room, st);
  const r = entryRunner(room, variant);
  const set = new Set(leaps);
  const keyP = room.pickups.find((p) => p.k === "key"), swP = room.pickups.find((p) => p.k === "switch");
  let sw = false;
  for (let t = 1; t <= maxT; t++) {
    st.inClosed = cellOf(r.y) >= 1;
    stepRunner(r, env, set.has(t));
    for (const h of room.hazards) if (hits(h, t, r.x, r.y, margin, sw)) return false;
    if (keyP && !st.key && (keyP.x - r.x) ** 2 + (keyP.y - r.y) ** 2 < 49) st.key = true;
    if (swP && !sw && (swP.x - r.x) ** 2 + (swP.y - r.y) ** 2 < 49) sw = true;
    if (cellOf(r.y) >= room.h - 1) return true;
  }
  return false;
}
