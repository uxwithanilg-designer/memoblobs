// Merge Nova rules (drop & merge numbers). The board is COLS × ROWS (row 0 at the top). Drop the shot block into a
// column: it falls to the lowest empty cell. Every equal number touching it (left, right, below, above) merges into it
// and the result doubles once per block absorbed (2 + 2 → 4, three 8s → 32). The merged block lands in the lowest of the
// merged cells, the rest fall, and anything that now touches an equal number merges again — chain reactions.
// Stones (asteroids) never merge; a merge right next to one cracks it, the second crack smashes it. A frozen number
// can't merge until a merge next to it melts the ice. A column filled past the top ends the stage.
// Shared by the stage builder (its test player), the game and the board renderer.

export const COLS = 5;
export const ROWS = 7;
export const STONE = -1;
export interface Cell { v: number; hp?: number; ice?: boolean }
export type Board = (Cell | null)[];      // index = r * COLS + c

export const idx = (r: number, c: number) => r * COLS + c;
export const cloneBoard = (b: Board): Board => b.map((x) => (x ? { ...x } : null));
export const emptyBoard = (): Board => new Array(COLS * ROWS).fill(null);

/** the row a block dropped into column c lands on (or -1 when the column is full) */
export function landingRow(b: Board, c: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[idx(r, c)]) { if (r === ROWS - 1 || b[idx(r + 1, c)]) return r; }
  return -1;
}

export interface MergeEvent { into: number; from: number[]; value: number; chain: number }
export type Snap = { kind: "land"; board: Board } | { kind: "merge"; board: Board; merge: MergeEvent } | { kind: "fall"; board: Board; moves: [number, number][] };
export interface DropResult {
  /** the board after each step (landing, every merge, every settle) for the animation */
  steps: Snap[];
  ok: boolean;
  land: number;
  merges: MergeEvent[];
  /** cells whose block fell, from → to (after each merge wave) */
  falls: [number, number][][];
  cracked: number[]; smashed: number[]; thawed: number[];
  gained: number;
  best: number;
  lost: boolean;
}

const N4 = (i: number) => {
  const r = Math.floor(i / COLS), c = i % COLS, out: number[] = [];
  if (c > 0) out.push(i - 1); if (c < COLS - 1) out.push(i + 1); if (r < ROWS - 1) out.push(i + COLS); if (r > 0) out.push(i - COLS);
  return out;
};

/** let blocks fall into gaps; returns the moves */
function gravity(b: Board): [number, number][] {
  const moves: [number, number][] = [];
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = idx(r, c);
      if (!b[i]) continue;
      if (r !== write) { b[idx(write, c)] = b[i]; b[i] = null; moves.push([i, idx(write, c)]); }
      write--;
    }
  }
  return moves;
}

/** drop value v into column c (mutates b) */
export function drop(b: Board, c: number, v: number): DropResult {
  const res: DropResult = { steps: [], ok: false, land: -1, merges: [], falls: [], cracked: [], smashed: [], thawed: [], gained: 0, best: 0, lost: false };
  const r = landingRow(b, c);
  if (r < 0) { res.lost = true; return res; }
  res.ok = true;
  const land = idx(r, c);
  res.land = land;
  b[land] = { v };
  res.steps.push({ kind: "land", board: cloneBoard(b) });
  // cells to check for merges, in order; a merge result is re-checked after the board settles
  let check = [land], chain = 0;
  while (check.length) {
    const next: number[] = [];
    let merged = false;
    for (const i of check) {
      const x = b[i];
      if (!x || x.v <= 0 || x.ice) continue;
      const same = N4(i).filter((j) => { const y = b[j]; return y && !y.ice && y.v === x.v; });
      if (!same.length) continue;
      merged = true; chain++;
      // the result goes to the lowest of the merged cells (ties: the checked cell)
      const group = [i, ...same];
      const target = group.reduce((a, j) => (Math.floor(j / COLS) > Math.floor(a / COLS) ? j : a), i);
      const value = x.v * 2 ** same.length;
      for (const j of group) b[j] = null;
      b[target] = { v: value };
      const ev = { into: target, from: group.filter((j) => j !== target), value, chain };
      res.merges.push(ev);
      res.gained += value * chain;
      res.best = Math.max(res.best, value);
      // a merge cracks stones and melts ice next to any merged cell
      for (const j of new Set(group.flatMap(N4))) {
        const y = b[j]; if (!y) continue;
        if (y.v === STONE) { y.hp = (y.hp ?? 2) - 1; if (y.hp <= 0) { b[j] = null; res.smashed.push(j); } else res.cracked.push(j); }
        else if (y.ice) { y.ice = false; res.thawed.push(j); next.push(j); }
      }
      res.steps.push({ kind: "merge", board: cloneBoard(b), merge: ev });
      next.push(target);
    }
    if (!merged && !next.length) break;
    const f = gravity(b);
    res.falls.push(f);
    if (f.length) res.steps.push({ kind: "fall", board: cloneBoard(b), moves: f });
    // re-check moved blocks and the merge results at their new place
    const moved = new Map(f);
    check = [...new Set(next.map((i) => moved.get(i) ?? i).concat(f.map(([, to]) => to)))];
    if (!merged) break;
  }
  for (const x of b) if (x && x.v > res.best) res.best = x.v;
  return res;
}

export const maxTile = (b: Board) => b.reduce((m, x) => (x && x.v > m ? x.v : m), 0);
export const stonesLeft = (b: Board) => b.reduce((n, x) => n + (x && x.v === STONE ? 1 : 0), 0);
export const filled = (b: Board) => b.reduce((n, x) => n + (x ? 1 : 0), 0);
export const label = (v: number) => (v >= 1048576 ? `${v / 1048576}M` : v >= 1024 ? `${v / 1024}K` : String(v));
