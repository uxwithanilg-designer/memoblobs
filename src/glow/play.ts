// Playing a Glowfold board: a tap cycles a cell through empty → Ember → Frost (→ Bloom) → empty, rule breaks are
// found as you go (so the board can light them up), and a hint fixes one cell.
import { boxesFor, type Puzzle } from "./kinds";

export const cycle = (p: Puzzle, v: number) => (v + 1) % (p.k + 1);

/** cells currently breaking a rule, and the sign edges that are broken */
export function conflicts(p: Puzzle, v: number[]): { cells: Set<number>; signs: Set<string> } {
  const n = p.n, cells = new Set<number>(), signs = new Set<string>();
  const runs: number[][] = [];
  for (let r = 0; r < n; r++) runs.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) runs.push(Array.from({ length: n }, (_, r) => r * n + c));
  const lines = runs.slice();
  if (p.kind === "wrap") for (const l of lines) runs.push([...l.slice(-2), ...l.slice(0, 2)]);
  if (p.kind === "diagonals") for (let s = -(n - 3); s <= n - 3; s++) {
    const d1: number[] = [], d2: number[] = [];
    for (let r = 0; r < n; r++) { const c = r + s; if (c >= 0 && c < n) d1.push(r * n + c); const c2 = n - 1 - r - s; if (c2 >= 0 && c2 < n) d2.push(r * n + c2); }
    runs.push(d1, d2);
  }
  for (const run of runs) for (let i = 0; i + 2 < run.length; i++) {
    const a = v[run[i]];
    if (a && a === v[run[i + 1]] && a === v[run[i + 2]]) { cells.add(run[i]); cells.add(run[i + 1]); cells.add(run[i + 2]); }
  }
  const bal = lines.slice();
  if (p.kind === "boxes") { const b = boxesFor(n), g = new Map<number, number[]>(); b.forEach((id, i) => { if (!g.has(id)) g.set(id, []); g.get(id)!.push(i); }); bal.push(...g.values()); }
  const target = n / p.k;
  for (const line of bal) for (let s = 1; s <= p.k; s++) {
    const have = line.filter((i) => v[i] === s);
    if (have.length > target) have.forEach((i) => cells.add(i));
  }
  for (const [e, sg] of Object.entries(p.signs)) {
    const [a, b] = e.split("-").map(Number);
    if (!v[a] || !v[b]) continue;
    if ((sg === "=") !== (v[a] === v[b])) { signs.add(e); cells.add(a); cells.add(b); }
  }
  if (p.kind === "nosquares") for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const q = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
    if (v[q[0]] && q.every((i) => v[i] === v[q[0]])) q.forEach((i) => cells.add(i));
  }
  if (p.kind === "balance") {
    const full = (ix: number[]) => ix.every((i) => v[i]);
    const key = (ix: number[]) => ix.map((i) => v[i]).join("");
    for (const group of [lines.slice(0, n), lines.slice(n)]) {
      const seen = new Map<string, number[]>();
      for (const l of group) if (full(l)) { const k = key(l); if (seen.has(k)) { l.forEach((i) => cells.add(i)); seen.get(k)!.forEach((i) => cells.add(i)); } else seen.set(k, l); }
    }
  }
  return { cells, signs };
}

/** which rows / columns just became complete and correct (they flash) */
export function finishedLines(p: Puzzle, v: number[], cell: number): number[][] {
  const n = p.n, r = Math.floor(cell / n), c = cell % n;
  const row = Array.from({ length: n }, (_, j) => r * n + j), col = Array.from({ length: n }, (_, i) => i * n + c);
  return [row, col].filter((l) => l.every((i) => v[i] === p.solution[i]));
}

export const isSolved = (p: Puzzle, v: number[]) => v.every((x, i) => x === p.solution[i]);

/** a hint: the first wrong cell, else an empty one next to the most filled cells */
export function hint(p: Puzzle, v: number[]): number {
  const wrong = v.findIndex((x, i) => x && x !== p.solution[i]);
  if (wrong >= 0) return wrong;
  let best = -1, score = -1;
  const n = p.n;
  v.forEach((x, i) => {
    if (x) return;
    const r = Math.floor(i / n), c = i % n;
    let s = 0;
    for (let j = 0; j < n; j++) { if (v[r * n + j]) s++; if (v[j * n + c]) s++; }
    if (s > score) { score = s; best = i; }
  });
  return best;
}
