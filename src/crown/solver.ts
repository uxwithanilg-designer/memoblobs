// Crownfold solvers.
//   search(): exact backtracking row by row (columns, courts, the kind's no-touch table, stones, towers, arrows,
//             fixed crowns) — counts answers up to a cap, or with an rng finds one random crown layout.
//   logic():  how a person solves it, in tiers. Tier 1: forced cells, crowns clearing their surroundings, and a court
//             squeezed into one row / column (and back). Tier 2 adds groups of up to three courts squeezed into as
//             many lines, and "if a crown went here, some line would have no room left" look-ahead. A board a tier
//             finishes needs no guessing at that tier.
// Budgets are steps, never time, so seeds stay deterministic.
import { around, conflictTable, ray, type KindId } from "./kinds";
import type { Rng } from "../sudoku/rng";

export interface Shape {
  kind: KindId;
  n: number;
  k: 1 | 2;
  /** null while the courts are not drawn yet (making the crown layout) */
  regions: number[] | null;
  rocks: number[];
  towers: Record<number, number>;
  arrows: Record<number, number>;
  givens: number[];
}

const tables = new Map<string, number[][]>();
export function conflicts(kind: KindId, n: number) {
  const key = `${kind === "wrap" || kind === "knight" || kind === "diagonal" ? kind : "touch"}:${n}`;
  let t = tables.get(key);
  if (!t) { t = conflictTable(kind, n); tables.set(key, t); }
  return t;
}

export interface SearchResult { count: number; sols: number[][]; steps: number; aborted: boolean }

export function search(s: Shape, cap: number, budget: number, rng?: Rng): SearchResult {
  const { n, k } = s, N = n * n;
  const conf = conflicts(s.kind, n);
  const reg = s.regions;
  const closed = new Uint8Array(N);
  for (const i of s.rocks) closed[i] = 1;
  for (const i of Object.keys(s.towers)) closed[+i] = 1;
  for (const i of Object.keys(s.arrows)) closed[+i] = 1;
  const given = new Uint8Array(N);
  for (const i of s.givens) given[i] = 1;
  const blk = new Uint16Array(N), col = new Uint8Array(n), rc = new Uint8Array(n);
  // courts: last row each court reaches
  const regLast = new Int8Array(n).fill(-1);
  if (reg) for (let i = 0; i < N; i++) regLast[reg[i]] = Math.max(regLast[reg[i]], Math.floor(i / n));
  // towers: which towers each cell feeds, and the last row a tower can still change
  const towerIds = Object.keys(s.towers).map(Number);
  const tNeed = towerIds.map((t) => s.towers[t]), tHave = new Uint8Array(towerIds.length);
  const feeds: number[][] = Array.from({ length: N }, () => []);
  const tDone: number[][] = Array.from({ length: n }, () => []);
  towerIds.forEach((t, x) => { for (const j of around(n, t)) feeds[j].push(x); tDone[Math.min(n - 1, Math.floor(t / n) + 1)].push(x); });
  const arrowRays = Object.entries(s.arrows).map(([c, d]) => ray(n, +c, d));
  const orders = Array.from({ length: n }, () => { const o = Array.from({ length: n }, (_, c) => c); return rng ? rng.shuffle(o) : o; });
  const crown = new Uint8Array(N), picked: number[] = [];
  const sols: number[][] = [];
  let steps = 0, aborted = false, count = 0;

  const place = (i: number, d: number) => {
    crown[i] = d > 0 ? 1 : 0;
    for (const j of conf[i]) blk[j] += d;
    col[i % n] += d;
    if (reg) rc[reg[i]] += d;
    for (const x of feeds[i]) tHave[x] += d;
  };
  const rowDone = (r: number) => {
    if (reg) for (let g = 0; g < n; g++) if (regLast[g] === r && rc[g] < k) return false;
    for (const x of tDone[r]) if (tHave[x] !== tNeed[x]) return false;
    const left = n - 1 - r;
    for (let c = 0; c < n; c++) { const need = k - col[c]; if (need > 0 && (k === 1 ? need > left : need * 2 - 1 > left)) return false; }
    return true;
  };
  const arrowsOk = () => arrowRays.every((ry) => ry.some((j) => crown[j]));

  const rec = (r: number, from: number, inRow: number): boolean => {
    if (++steps > budget) { aborted = true; return true; }
    if (inRow === k) {
      if (!rowDone(r)) return false;
      if (r === n - 1) {
        if (!arrowsOk()) return false;
        count++;
        if (sols.length < 2) sols.push(picked.slice().sort((a, b) => a - b));
        return count >= cap;
      }
      return rec(r + 1, 0, 0);
    }
    const ord = orders[r];
    for (let x = from; x < n; x++) {
      if (n - x < k - inRow) break;
      const c = ord[x], i = r * n + c;
      if (!closed[i] && !blk[i] && col[c] < k && (!reg || rc[reg[i]] < k)) {
        let ok = true;
        for (const t of feeds[i]) if (tHave[t] >= tNeed[t]) { ok = false; break; }
        if (ok) {
          place(i, 1); picked.push(i);
          const stop = rec(r, x + 1, inRow + 1);
          place(i, -1); picked.pop();
          if (stop) return true;
        }
      }
      if (given[i]) break; // a fixed crown can't be skipped
    }
    return false;
  };
  rec(0, 0, 0);
  return { count, sols, steps, aborted };
}

// ------------------------------------------------------------------ logic

export interface LogicResult { solved: boolean; open: number; broken: boolean; state: Int8Array }

export function logic(s: Shape & { regions: number[] }, tier: 1 | 2, start?: Int8Array): LogicResult {
  const { n, k, regions } = s, N = n * n;
  const conf = conflicts(s.kind, n);
  const st = start ? Int8Array.from(start) : new Int8Array(N); // 0 open, 1 crown, -1 empty
  if (!start) {
    for (const i of s.rocks) st[i] = -1;
    for (const i of Object.keys(s.towers)) st[+i] = -1;
    for (const i of Object.keys(s.arrows)) st[+i] = -1;
  }
  const rows: number[][] = [], cols: number[][] = [], regs: number[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) { rows.push([]); cols.push([]); }
  for (let i = 0; i < N; i++) { rows[Math.floor(i / n)].push(i); cols[i % n].push(i); regs[regions[i]].push(i); }
  const units = [...rows, ...cols, ...regs];
  const towers = Object.entries(s.towers).map(([c, v]) => ({ cells: around(n, +c), need: v }));
  const rays = Object.entries(s.arrows).map(([c, d]) => ray(n, +c, d));
  let broken = false;

  const put = (S: Int8Array, i: number) => {
    if (S[i] === 1) return;
    if (S[i] === -1) { broken = true; return; }
    S[i] = 1;
    for (const j of conf[i]) { if (S[j] === 1) broken = true; else S[j] = -1; }
  };
  // basic propagation to a fixed point; returns false on contradiction
  const basic = (S: Int8Array): boolean => {
    for (const i of s.givens) put(S, i);
    let moved = true;
    while (moved && !broken) {
      moved = false;
      for (const u of units) {
        let have = 0, open = 0;
        for (const i of u) { if (S[i] === 1) have++; else if (S[i] === 0) open++; }
        if (have > k || have + open < k) { broken = true; return false; }
        if (!open) continue;
        if (have === k) { for (const i of u) if (S[i] === 0) S[i] = -1; moved = true; }
        else if (have + open === k) { for (const i of u) if (S[i] === 0) put(S, i); moved = true; }
      }
      for (const t of towers) {
        let have = 0, open = 0;
        for (const i of t.cells) { if (S[i] === 1) have++; else if (S[i] === 0) open++; }
        if (have > t.need || have + open < t.need) { broken = true; return false; }
        if (!open) continue;
        if (have === t.need) { for (const i of t.cells) if (S[i] === 0) S[i] = -1; moved = true; }
        else if (have + open === t.need) { for (const i of t.cells) if (S[i] === 0) put(S, i); moved = true; }
      }
      for (const ry of rays) {
        if (ry.some((i) => S[i] === 1)) continue;
        const open = ry.filter((i) => S[i] === 0);
        if (!open.length) { broken = true; return false; }
        if (open.length === 1) { put(S, open[0]); moved = true; }
      }
    }
    return !broken;
  };
  // m courts whose open cells sit in m lines (and the other way round) clear the rest of those lines
  const squeeze = (S: Int8Array, maxM: number): boolean => {
    let moved = false;
    for (const [A, Bs, lineOf] of [
      [regs, rows, (i: number) => Math.floor(i / n)], [regs, cols, (i: number) => i % n],
      [rows, regs, (i: number) => regions[i]], [cols, regs, (i: number) => regions[i]],
    ] as [number[][], number[][], (i: number) => number][]) {
      const need = A.map((u) => k - u.filter((i) => S[i] === 1).length);
      const live = A.map((_, x) => x).filter((x) => need[x] > 0);
      const linesOf = live.map((x) => { let m = 0; for (const i of A[x]) if (S[i] === 0) m |= 1 << lineOf(i); return m; });
      const bNeed = Bs.map((u) => k - u.filter((i) => S[i] === 1).length);
      const tryGroup = (xs: number[]) => {
        let mask = 0, nd = 0;
        for (const x of xs) { mask |= linesOf[x]; nd += need[live[x]]; }
        let cap = 0, cnt = 0;
        for (let b = 0; b < n; b++) if (mask & (1 << b)) { cap += bNeed[b]; cnt++; }
        if (cnt > xs.length || cap !== nd) return;
        const inGroup = new Set(xs.map((x) => live[x]));
        const ownerOf = (i: number) => A.findIndex((u) => u.includes(i));
        for (let b = 0; b < n; b++) if (mask & (1 << b)) for (const i of Bs[b]) {
          if (S[i] !== 0) continue;
          if (!inGroup.has(ownerOf(i))) { S[i] = -1; moved = true; }
        }
      };
      const L = live.length;
      for (let a = 0; a < L; a++) {
        tryGroup([a]);
        if (maxM >= 2) for (let b = a + 1; b < L; b++) {
          tryGroup([a, b]);
          if (maxM >= 3) for (let c = b + 1; c < L; c++) tryGroup([a, b, c]);
        }
      }
    }
    return moved;
  };

  let changed = true;
  while (changed && !broken) {
    changed = false;
    if (!basic(st)) break;
    if (squeeze(st, tier === 1 ? 1 : 3)) { changed = true; continue; }
    if (tier === 2) {
      for (let i = 0; i < N && !changed; i++) {
        if (st[i] !== 0) continue;
        const T = Int8Array.from(st);
        const was: boolean = broken;
        put(T, i);
        const ok = !broken && basic(T);
        broken = was;
        if (!ok) { st[i] = -1; changed = true; }
      }
    }
  }
  let open = 0;
  for (let i = 0; i < N; i++) if (st[i] === 0) open++;
  return { solved: !broken && open === 0, open, broken, state: st };
}
