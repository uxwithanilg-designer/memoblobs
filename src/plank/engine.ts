// Plank Panic rules. A wooden board with a grid of holes (cols × rows lattice points, some of them drilled). Planks are
// straight wooden bars, horizontal or vertical, from lattice point `a` to lattice point `b`, with a hole at each end;
// the solid wood in between covers every lattice point strictly inside. Planks lie in layers (higher id = on top).
// Screws sit in drilled holes; a screw pins every plank whose end hole it went through when it was screwed in.
//
// A move: tap a screw (it can come out only if no plank lying ABOVE the planks it pins covers it), then tap a free
// drilled hole that no plank covers — the screw goes in there and pins every plank with an end hole at that point.
// As soon as a plank has one screw left it swings and hangs straight down from it; with no screw left it falls off.
// Clear the board by dropping every plank.
//
// The solver is an exact depth-first search with memory (the same rules), used by the stage builder to prove every
// stage solvable and to measure how often a careless move ruins the board.

export interface Plank { id: number; a: number; b: number; len: number; tint: number }
export interface Board { cols: number; rows: number; holes: boolean[]; planks: Plank[]; screws: number[]; pins: number[][] }
/** the live state: each plank's ends (or fallen), and every screw (where it is and which planks it pins) */
export interface State { ends: ([number, number] | null)[]; screws: { at: number; pins: number[] }[] }
export type Move = { from: number; to: number };

export const xy = (b: { cols: number }, i: number) => [i % b.cols, Math.floor(i / b.cols)] as const;
export const pt = (b: { cols: number }, x: number, y: number) => y * b.cols + x;

export function initial(b: Board): State {
  return { ends: b.planks.map((p) => [p.a, p.b]), screws: b.screws.map((at, k) => ({ at, pins: [...b.pins[k]] })) };
}
export const cloneState = (s: State): State => ({ ends: s.ends.map((e) => (e ? [e[0], e[1]] : null)), screws: s.screws.map((q) => ({ at: q.at, pins: [...q.pins] })) });

/** lattice points strictly inside a plank lying from a to b (off-board points are skipped) */
export function interior(b: { cols: number; rows: number }, a: number, c: number): number[] {
  const [ax, ay] = xy(b, a), [cx, cy] = xy(b, c), out: number[] = [];
  const n = Math.max(Math.abs(cx - ax), Math.abs(cy - ay)), dx = Math.sign(cx - ax), dy = Math.sign(cy - ay);
  for (let k = 1; k < n; k++) { const x = ax + dx * k, y = ay + dy * k; if (x >= 0 && y >= 0 && x < b.cols && y < b.rows) out.push(pt(b, x, y)); }
  return out;
}
/** where a plank hangs from a pivot: straight down (its far end may be below the board) */
export function hangEnd(b: Board, pivot: number, len: number): number {
  const [x, y] = xy(b, pivot);
  return y + len < b.rows ? pt(b, x, y + len) : -1 - (y + len - b.rows) * b.cols - x; // negative: off the board
}
function coveredBy(b: Board, s: State, p: number, minLayer: number): boolean {
  for (let i = minLayer; i < s.ends.length; i++) {
    const e = s.ends[i]; if (!e) continue;
    if (e[1] < 0) { // hanging off the board's bottom: cover the points below the pivot that exist
      const [x, y] = xy(b, e[0]); const [px, py] = xy(b, p);
      if (px === x && py > y && py < y + b.planks[i].len) return true;
      continue;
    }
    if (interior(b, e[0], e[1]).includes(p)) return true;
  }
  return false;
}
/** can this screw come out? (nothing above the planks it pins lies over it) */
export function canLift(b: Board, s: State, k: number): boolean {
  const q = s.screws[k];
  const top = q.pins.reduce((m, id) => Math.max(m, id), -1);
  return !coveredBy(b, s, q.at, top + 1);
}
/** drilled holes a lifted screw could go into */
export function freeHoles(b: Board, s: State, lifted: number): number[] {
  const taken = new Set(s.screws.map((q, k) => (k === lifted ? -1 : q.at)));
  const out: number[] = [];
  for (let p = 0; p < b.holes.length; p++) if (b.holes[p] && !taken.has(p) && p !== s.screws[lifted].at && !coveredBy(b, s, p, 0)) out.push(p);
  return out;
}

export interface Effect { fell: number[]; swung: number[]; pinned: number[] }
/** apply a move in place: lift screw `k`, planks swing or fall, then the screw goes into hole `to` */
export function apply(b: Board, s: State, k: number, to: number): Effect {
  const eff: Effect = { fell: [], swung: [], pinned: [] };
  const q = s.screws[k];
  const freed = q.pins; q.pins = [];
  q.at = -1;
  for (const id of freed) settle(b, s, id, eff);
  // into the new hole: pin every plank with an end hole here
  q.at = to;
  for (let id = 0; id < s.ends.length; id++) { const e = s.ends[id]; if (e && (e[0] === to || e[1] === to)) { q.pins.push(id); eff.pinned.push(id); } }
  return eff;
}
function settle(b: Board, s: State, id: number, eff: Effect) {
  const e = s.ends[id]; if (!e) return;
  const holding = s.screws.filter((q) => q.at >= 0 && q.pins.includes(id));
  if (!holding.length) { s.ends[id] = null; eff.fell.push(id); return; }
  if (holding.length === 1) {
    const pv = holding[0].at;
    const ne: [number, number] = [pv, hangEnd(b, pv, b.planks[id].len)];
    if (ne[0] !== e[0] || ne[1] !== e[1]) { s.ends[id] = ne; eff.swung.push(id); }
  }
}
export const solved = (s: State) => s.ends.every((e) => !e);
export const left = (s: State) => s.ends.filter(Boolean).length;
export function moves(b: Board, s: State): Move[] {
  const out: Move[] = [];
  s.screws.forEach((q, k) => { if (canLift(b, s, k)) for (const to of freeHoles(b, s, k)) out.push({ from: k, to }); });
  return out;
}
const keyOf = (s: State) => s.ends.map((e) => (e ? `${e[0]},${e[1]}` : "x")).join("|") + "#" + s.screws.map((q) => `${q.at}:${q.pins.join(".")}`).sort().join("|");

/** exact search for a solution (move list), or null; `budget` caps the states visited */
export function solve(b: Board, s0: State, budget = 20000, maxDepth = 60): { path: Move[] | null; visited: number } {
  const seen = new Map<string, number>();
  let visited = 0;
  const path: Move[] = [];
  const dfs = (s: State, depth: number): boolean => {
    if (solved(s)) return true;
    if (visited++ > budget || depth >= maxDepth) return false;
    // a state reached again no earlier than before can't do better
    const k = keyOf(s), was = seen.get(k); if (was !== undefined && was <= depth) return false; seen.set(k, depth);
    // try moves that drop or swing planks first, and holes that pin nothing
    const ms = moves(b, s).map((m) => {
      const t = cloneState(s); const e = apply(b, t, m.from, m.to);
      return { m, t, score: e.fell.length * 10 + e.swung.length * 3 - e.pinned.length * 4 };
    }).sort((x, y) => y.score - x.score);
    for (const { m, t } of ms) { path.push(m); if (dfs(t, depth + 1)) return true; path.pop(); }
    return false;
  };
  const ok = dfs(cloneState(s0), 0);
  return { path: ok ? [...path] : null, visited };
}

/** the Pliers booster: pull a screw right out of the board (it's gone); its planks swing or fall */
export function yank(b: Board, s: State, k: number): Effect {
  const eff: Effect = { fell: [], swung: [], pinned: [] };
  const q = s.screws[k];
  const freed = q.pins; q.pins = []; q.at = -1;
  for (const id of freed) settle(b, s, id, eff);
  s.screws.splice(k, 1);
  return eff;
}

/** a short solution: keep asking for one move fewer until the search can't find it (near-optimal move count) */
export function shortest(b: Board, s0: State, budget = 6000): Move[] | null {
  let best = solve(b, s0, budget).path;
  for (let i = 0; best && i < 8; i++) {
    const r = solve(b, s0, budget, best.length - 1);
    if (!r.path) break;
    best = r.path;
  }
  return best;
}
