// Sudoku Ninefold solver: candidates as bit masks (values 1..25 fit in one int), constraint propagation (naked and hidden
// singles, killer-cage sum bounds, thermometer ordering) and a most-constrained-cell search. It proves a puzzle has
// exactly one solution, fills random solved grids for the generator, and (logicSolve) checks that a puzzle can be
// solved by human techniques alone, which is how the levels are graded.

import type { BoardId, Cage, Puzzle } from "./boards";
import { geometry } from "./boards";
import type { Rng } from "./rng";

export interface Model {
  size: number;
  n: number;
  full: number;
  active: boolean[];
  units: number[][];
  peers: number[][];
  cages: Cage[];
  thermos: number[][];
}

const pop = (m: number) => { m -= (m >>> 1) & 0x55555555; m = (m & 0x33333333) + ((m >>> 2) & 0x33333333); return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const low = (m: number) => 31 - Math.clz32(m & -m); // index of the lowest set bit
const hi = (m: number) => 31 - Math.clz32(m);

export function modelOf(board: BoardId, cages: Cage[] = [], thermos: number[][] = []): Model {
  const g = geometry(board);
  let peers = g.peers;
  if (cages.length) {
    // a cage never repeats a digit: its cells become peers too
    const sets = g.peers.map((p) => new Set(p));
    for (const cg of cages) for (const a of cg.cells) for (const b of cg.cells) if (a !== b) sets[a].add(b);
    peers = sets.map((s) => [...s]);
  }
  return { size: g.rows * g.cols, n: g.n, full: g.n >= 31 ? -1 : (1 << g.n) - 1, active: g.active, units: g.units, peers, cages, thermos };
}

export const modelOfPuzzle = (p: Puzzle) => modelOf(p.board, p.cages, p.thermos);

interface State { masks: Int32Array; vals: Int8Array }

function initState(m: Model, givens: ArrayLike<number>): State | null {
  const masks = new Int32Array(m.size), vals = new Int8Array(m.size);
  for (let i = 0; i < m.size; i++) masks[i] = m.active[i] ? m.full : 0;
  const s = { masks, vals };
  for (let i = 0; i < m.size; i++) if (m.active[i] && givens[i] > 0 && !assign(m, s, i, givens[i])) return null;
  return propagate(m, s) ? s : null;
}

/** place value v at cell i and remove it from every peer (chasing naked singles) */
function assign(m: Model, s: State, i: number, v: number): boolean {
  const bit = 1 << (v - 1);
  if (s.vals[i] === v) return true;
  if (s.vals[i] !== 0 || !(s.masks[i] & bit)) return false;
  const stack = [i, v];
  while (stack.length) {
    const val = stack.pop()!, cell = stack.pop()!;
    const b = 1 << (val - 1);
    if (s.vals[cell] === val) continue;
    if (s.vals[cell] !== 0 || !(s.masks[cell] & b)) return false;
    s.masks[cell] = b; s.vals[cell] = val;
    const ps = m.peers[cell];
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k], pm = s.masks[p];
      if (!(pm & b)) continue;
      if (s.vals[p] !== 0) return false;
      const nm = pm & ~b;
      if (nm === 0) return false;
      s.masks[p] = nm;
      if ((nm & (nm - 1)) === 0) stack.push(p, low(nm) + 1);
    }
  }
  return true;
}

function cagePrune(m: Model, s: State, cg: Cage): number {
  // -1 = contradiction, else number of masks narrowed
  let fixed = 0, used = 0;
  const open: number[] = [];
  for (const c of cg.cells) { if (s.vals[c]) { fixed += s.vals[c]; used |= 1 << (s.vals[c] - 1); } else open.push(c); }
  const T = cg.sum - fixed;
  if (open.length === 0) return T === 0 ? 0 : -1;
  if (T <= 0) return -1;
  // the digits still possible in the cage, smallest and largest sums of k of them
  let avail = 0;
  for (const c of open) avail |= s.masks[c];
  avail &= ~used;
  const digits: number[] = [];
  for (let mm = avail; mm; mm &= mm - 1) digits.push(low(mm) + 1);
  const k = open.length - 1;
  let changed = 0;
  for (const c of open) {
    let mask = s.masks[c] & ~used, nm = mask;
    for (let mm = mask; mm; mm &= mm - 1) {
      const v = low(mm) + 1, rest = T - v;
      // k distinct digits other than v from what's available
      let mn = 0, mx = 0, got = 0;
      for (let a = 0; a < digits.length && got < k; a++) if (digits[a] !== v) { mn += digits[a]; got++; }
      if (got < k) { nm &= ~(1 << (v - 1)); continue; }
      got = 0;
      for (let a = digits.length - 1; a >= 0 && got < k; a--) if (digits[a] !== v) { mx += digits[a]; got++; }
      if (rest < mn || rest > mx) nm &= ~(1 << (v - 1));
    }
    if (nm === 0) return -1;
    if (nm !== s.masks[c]) { s.masks[c] = nm; changed++; }
    mask = nm;
  }
  return changed;
}

function thermoPrune(m: Model, s: State, t: number[]): number {
  const L = t.length;
  const lo = new Array<number>(L), up = new Array<number>(L);
  for (let i = 0; i < L; i++) {
    const mk = s.masks[t[i]];
    if (!mk) return -1;
    lo[i] = Math.max(low(mk) + 1, i ? lo[i - 1] + 1 : 1);
  }
  for (let i = L - 1; i >= 0; i--) up[i] = Math.min(hi(s.masks[t[i]]) + 1, i < L - 1 ? up[i + 1] - 1 : m.n);
  let changed = 0;
  for (let i = 0; i < L; i++) {
    if (lo[i] > up[i]) return -1;
    const range = ((1 << up[i]) - 1) & ~((1 << (lo[i] - 1)) - 1);
    const nm = s.masks[t[i]] & range;
    if (nm === 0) return -1;
    if (nm !== s.masks[t[i]]) { s.masks[t[i]] = nm; changed++; }
  }
  return changed;
}

/** naked / hidden singles, cage sums and thermometers until nothing changes; false on a contradiction */
function propagate(m: Model, s: State): boolean {
  for (let guard = 0; guard < 400; guard++) {
    let changed = false;
    // naked singles left by pruning
    for (let i = 0; i < m.size; i++) {
      const mk = s.masks[i];
      if (!m.active[i] || s.vals[i]) continue;
      if (mk === 0) return false;
      if ((mk & (mk - 1)) === 0) { if (!assign(m, s, i, low(mk) + 1)) return false; changed = true; }
    }
    // hidden singles
    for (const u of m.units) {
      let once = 0, twice = 0, done = 0;
      for (const c of u) { const mk = s.masks[c]; twice |= once & mk; once |= mk; if (s.vals[c]) done |= 1 << (s.vals[c] - 1); }
      if ((once & m.full) !== m.full) return false;
      let single = once & ~twice & ~done;
      while (single) {
        const v = low(single) + 1, b = 1 << (v - 1);
        single &= single - 1;
        for (const c of u) if (s.masks[c] & b) { if (!assign(m, s, c, v)) return false; changed = true; break; }
      }
    }
    for (const cg of m.cages) { const r = cagePrune(m, s, cg); if (r < 0) return false; if (r) changed = true; }
    for (const t of m.thermos) { const r = thermoPrune(m, s, t); if (r < 0) return false; if (r) changed = true; }
    if (!changed) return true;
  }
  return true;
}

function pickCell(m: Model, s: State): number {
  let best = -1, bc = 99;
  for (let i = 0; i < m.size; i++) {
    if (!m.active[i] || s.vals[i]) continue;
    const c = pop(s.masks[i]);
    if (c < bc) { bc = c; best = i; if (c === 2) break; }
  }
  return best;
}

export interface SearchResult { count: number; solutions: number[][]; aborted: boolean; steps: number }

/** count solutions up to `limit` (2 = uniqueness check); `aborted` when the step budget ran out first */
export function search(m: Model, givens: ArrayLike<number>, limit = 2, maxSteps = 60000, rng?: Rng): SearchResult {
  const res: SearchResult = { count: 0, solutions: [], aborted: false, steps: 0 };
  const start = initState(m, givens);
  if (!start) return res;
  const rec = (s: State): boolean => {
    if (res.count >= limit) return true;
    if (++res.steps > maxSteps) { res.aborted = true; return true; }
    const cell = pickCell(m, s);
    if (cell < 0) {
      // full: cages and thermos are checked by propagation's bounds; verify sums exactly
      for (const cg of m.cages) { let t = 0; for (const c of cg.cells) t += s.vals[c]; if (t !== cg.sum) return false; }
      res.count++;
      res.solutions.push(Array.from(s.vals, (v, i) => (m.active[i] ? v : -1)));
      return res.count >= limit;
    }
    const opts: number[] = [];
    for (let mk = s.masks[cell]; mk; mk &= mk - 1) opts.push(low(mk) + 1);
    if (rng) rng.shuffle(opts);
    for (const v of opts) {
      const t: State = { masks: s.masks.slice(), vals: s.vals.slice() };
      if (assign(m, t, cell, v) && propagate(m, t) && rec(t)) return true;
    }
    return false;
  };
  rec(start);
  return res;
}

/** a random complete grid (null if the step budget ran out) */
export function fillRandom(m: Model, rng: Rng, start?: ArrayLike<number>, maxSteps = 40000): number[] | null {
  const r = search(m, start ?? new Array(m.size).fill(0), 1, maxSteps, rng);
  return r.count ? r.solutions[0] : null;
}

// ------------------------------------------------------------------ human-technique grading

/**
 * Solves with the techniques a person uses, in tiers: 1 = naked + hidden singles, 2 = + intersections (pointing /
 * claiming) and naked pairs. Returns the highest tier needed, or 0 if these techniques get stuck.
 */
export function logicSolve(m: Model, givens: ArrayLike<number>): number {
  const masks = new Int32Array(m.size), vals = new Int8Array(m.size);
  for (let i = 0; i < m.size; i++) masks[i] = m.active[i] ? m.full : 0;
  const peersClear = (i: number, v: number) => { const b = 1 << (v - 1); for (const p of m.peers[i]) masks[p] &= ~b; };
  for (let i = 0; i < m.size; i++) if (m.active[i] && givens[i] > 0) { vals[i] = givens[i]; masks[i] = 1 << (givens[i] - 1); }
  for (let i = 0; i < m.size; i++) if (vals[i]) peersClear(i, vals[i]);
  let tier = 1;
  const remaining = () => { let r = 0; for (let i = 0; i < m.size; i++) if (m.active[i] && !vals[i]) r++; return r; };
  const place = (i: number, v: number) => { vals[i] = v; masks[i] = 1 << (v - 1); peersClear(i, v); };
  for (let guard = 0; guard < 2000; guard++) {
    if (remaining() === 0) return tier;
    let progress = false;
    for (let i = 0; i < m.size; i++) {
      if (!m.active[i] || vals[i]) continue;
      const mk = masks[i];
      if (mk === 0) return 0;
      if ((mk & (mk - 1)) === 0) { place(i, low(mk) + 1); progress = true; }
    }
    if (progress) continue;
    for (const u of m.units) {
      for (let v = 1; v <= m.n; v++) {
        const b = 1 << (v - 1);
        let where = -1, cnt = 0;
        for (const c of u) { if (vals[c] === v) { cnt = -99; break; } if (masks[c] & b) { cnt++; where = c; } }
        if (cnt === 1) { place(where, v); progress = true; }
      }
    }
    if (progress) continue;
    // tier 2: intersections between any two units, then naked pairs
    for (let a = 0; a < m.units.length && !progress; a++) {
      const A = m.units[a];
      for (let v = 1; v <= m.n && !progress; v++) {
        const b = 1 << (v - 1);
        const spots = A.filter((c) => !vals[c] && masks[c] & b);
        if (spots.length < 2) continue;
        for (let k = 0; k < m.units.length; k++) {
          if (k === a) continue;
          const B = m.units[k];
          if (!spots.every((c) => B.includes(c))) continue;
          for (const c of B) if (!A.includes(c) && !vals[c] && masks[c] & b) { masks[c] &= ~b; progress = true; }
          if (progress) break;
        }
      }
    }
    if (!progress) {
      for (const u of m.units) {
        const pairs = u.filter((c) => !vals[c] && pop(masks[c]) === 2);
        for (let x = 0; x < pairs.length; x++) for (let y = x + 1; y < pairs.length; y++) {
          if (masks[pairs[x]] !== masks[pairs[y]]) continue;
          const pm = masks[pairs[x]];
          for (const c of u) if (c !== pairs[x] && c !== pairs[y] && !vals[c] && masks[c] & pm) { masks[c] &= ~pm; progress = true; }
        }
      }
    }
    if (!progress) return 0;
    tier = 2;
  }
  return 0;
}
