// Glowfold solver: each cell keeps the orbs it could still be (bits), and simple deductions run until nothing
// changes — no three of a kind in a line (rows, columns, wrap-around, diagonals), balanced counts in every row,
// column and box, the = / × signs, no all-same 2×2 block. Then a most-constrained-cell search. `logicOnly` stops
// before any guessing: that is how Easy and Medium are checked to be solvable by reasoning alone.
import { boxesFor, edgeKey, type KindId, type Puzzle } from "./kinds";
import type { Rng } from "../sudoku/rng";

export type Clues = Pick<Puzzle, "kind" | "n" | "k" | "givens" | "signs">;

interface Model {
  n: number; k: number; full: number; target: number;
  /** lines that must be balanced (rows, columns, boxes) */
  bal: number[][];
  /** runs where no three consecutive may match (rows/cols, wrapping copies, diagonals) */
  runs: number[][];
  squares: number[][];
  eq: [number, number][];
  ne: [number, number][];
  uniqueLines: boolean;
}

const cache = new Map<string, Omit<Model, "eq" | "ne">>();
function base(kind: KindId, n: number, k: number) {
  const key = `${kind}:${n}:${k}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c));
  const cols = Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c));
  const bal = [...rows, ...cols];
  if (kind === "boxes") {
    const b = boxesFor(n), groups = new Map<number, number[]>();
    b.forEach((id, i) => { if (!groups.has(id)) groups.set(id, []); groups.get(id)!.push(i); });
    bal.push(...groups.values());
  }
  const runs: number[][] = [...rows, ...cols];
  if (kind === "wrap") for (const l of [...rows, ...cols]) runs.push([...l.slice(-2), ...l.slice(0, 2)]);
  if (kind === "diagonals") {
    for (let s = -(n - 3); s <= n - 3; s++) {
      const d1: number[] = [], d2: number[] = [];
      for (let r = 0; r < n; r++) { const c = r + s; if (c >= 0 && c < n) d1.push(r * n + c); const c2 = n - 1 - r - s; if (c2 >= 0 && c2 < n) d2.push(r * n + c2); }
      if (d1.length >= 3) runs.push(d1);
      if (d2.length >= 3) runs.push(d2);
    }
  }
  const squares: number[][] = [];
  if (kind === "nosquares") for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) squares.push([r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1]);
  const m = { n, k, full: (1 << k) - 1, target: n / k, bal, runs, squares, uniqueLines: kind === "balance" };
  cache.set(key, m);
  return m;
}

export function modelOf(p: Clues): Model {
  const eq: [number, number][] = [], ne: [number, number][] = [];
  for (const [e, s] of Object.entries(p.signs)) { const [a, b] = e.split("-").map(Number); (s === "=" ? eq : ne).push([a, b]); }
  return { ...base(p.kind, p.n, p.k), eq, ne };
}

const single = (m: number) => m && !(m & (m - 1));
const val = (m: number) => (single(m) ? 31 - Math.clz32(m) + 1 : 0);

/** run every deduction to a fixed point; false on a contradiction */
function propagate(M: Model, s: Uint8Array): boolean {
  const { k, target } = M;
  for (let guard = 0; guard < 200; guard++) {
    let changed = false;
    const cut = (i: number, bits: number) => { const nm = s[i] & ~bits; if (nm !== s[i]) { s[i] = nm; changed = true; } return nm !== 0; };
    // no three of a kind in a run
    for (const run of M.runs) {
      for (let i = 0; i + 2 < run.length; i++) {
        const a = run[i], b = run[i + 1], c = run[i + 2];
        const va = val(s[a]), vb = val(s[b]), vc = val(s[c]);
        if (va && va === vb && !cut(c, 1 << (va - 1))) return false;
        if (vb && vb === vc && !cut(a, 1 << (vb - 1))) return false;
        if (va && va === vc && !cut(b, 1 << (va - 1))) return false;
      }
    }
    // balanced lines
    for (const line of M.bal) {
      const t = (target * line.length) / M.n;
      for (let v = 0; v < k; v++) {
        const bit = 1 << v;
        let fixed = 0, may = 0;
        for (const i of line) { if (s[i] === bit) fixed++; else if (s[i] & bit) may++; }
        if (fixed > t || fixed + may < t) return false;
        if (fixed === t && may) { for (const i of line) if (s[i] !== bit && s[i] & bit && !cut(i, bit)) return false; }
        else if (fixed + may === t && may) { for (const i of line) if (s[i] !== bit && s[i] & bit) { s[i] = bit; changed = true; } }
      }
    }
    // signs
    for (const [a, b] of M.eq) {
      const both = s[a] & s[b];
      if (!both) return false;
      if (both !== s[a] || both !== s[b]) { s[a] = both; s[b] = both; changed = true; }
    }
    for (const [a, b] of M.ne) {
      if (single(s[a]) && !cut(b, s[a])) return false;
      if (single(s[b]) && !cut(a, s[b])) return false;
    }
    // no all-same 2×2
    for (const sq of M.squares) {
      const vs = sq.map((i) => val(s[i]));
      for (let j = 0; j < 4; j++) {
        const others = vs.filter((_, x) => x !== j);
        if (others[0] && others.every((v) => v === others[0]) && !cut(sq[j], 1 << (others[0] - 1))) return false;
      }
    }
    if (!changed) return true;
  }
  return true;
}

function linesDistinct(M: Model, s: Uint8Array): boolean {
  if (!M.uniqueLines) return true;
  const n = M.n, seen = new Set<string>();
  for (let r = 0; r < n; r++) { let full = true, key = "r"; for (let c = 0; c < n; c++) { const v = val(s[r * n + c]); if (!v) { full = false; break; } key += v; } if (full) { if (seen.has(key)) return false; seen.add(key); } }
  for (let c = 0; c < n; c++) { let full = true, key = "c"; for (let r = 0; r < n; r++) { const v = val(s[r * n + c]); if (!v) { full = false; break; } key += v; } if (full) { if (seen.has(key)) return false; seen.add(key); } }
  return true;
}

export interface Found { count: number; sols: number[][]; aborted: boolean; steps: number; logicSolved: boolean }

export function solve(p: Clues, limit = 2, maxSteps = 40000, rng?: Rng, logicOnly = false): Found {
  const M = modelOf(p);
  const N = p.n * p.n;
  const res: Found = { count: 0, sols: [], aborted: false, steps: 0, logicSolved: false };
  const s = new Uint8Array(N).fill(M.full);
  for (let i = 0; i < N; i++) if (p.givens[i]) s[i] = 1 << (p.givens[i] - 1);
  if (!propagate(M, s) || !linesDistinct(M, s)) return res;
  if (logicOnly) { res.logicSolved = s.every(single); return res; }
  const rec = (st: Uint8Array): boolean => {
    if (res.count >= limit) return true;
    if (++res.steps > maxSteps) { res.aborted = true; return true; }
    let best = -1, bc = 9;
    for (let i = 0; i < N; i++) if (!single(st[i])) { let c = 0; for (let m = st[i]; m; m &= m - 1) c++; if (c < bc) { bc = c; best = i; if (c === 2) break; } }
    if (best < 0) {
      if (!linesDistinct(M, st)) return false;
      res.count++; res.sols.push(Array.from(st, val));
      return res.count >= limit;
    }
    const opts: number[] = [];
    for (let v = 0; v < M.k; v++) if (st[best] & (1 << v)) opts.push(v);
    if (rng) rng.shuffle(opts);
    for (const v of opts) {
      const t = st.slice(); t[best] = 1 << v;
      if (propagate(M, t) && linesDistinct(M, t) && rec(t)) return true;
    }
    return false;
  };
  rec(s);
  return res;
}

export { edgeKey };
