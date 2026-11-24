// Glowfold puzzle factory. From a seed:
//   1. a random full board that obeys the kind's rules (search with shuffled orbs),
//   2. = / × signs on a share of neighbour pairs, read from that board,
//   3. orbs taken away one by one in random order, each removal kept only while the answer stays unique — and, for
//      Easy and Medium, only while the board can still be finished by deduction alone (no guessing); Easy and Medium
//      stop early with extra orbs left, Hard digs as far as it can.
// Budgets are solver steps, never clock time, so a seed always gives the same puzzle (the Daily Glow).
import { boxesFor, edgeKey, kindOf, type KindId, type Level, type Puzzle } from "./kinds";
import { solve, type Clues } from "./solver";
import { rngFrom } from "../sudoku/rng";

export interface GenRequest { kind: KindId; level: Level; seed: string }

export function generatePuzzle(req: GenRequest): Puzzle {
  const { kind, level, seed } = req;
  const info = kindOf(kind);
  const n = info.size[level], k = info.k, N = n * n;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = rngFrom(`glowfold:${kind}:${level}:${seed}:${attempt}`);
    const empty: Clues = { kind, n, k, givens: new Array(N).fill(0), signs: {} };
    const full = solve(empty, 1, n >= 10 ? 40000 : 15000, rng);
    if (!full.count) continue;
    const sol = full.sols[0];
    const signs: Record<string, "=" | "x"> = {};
    const pairs: [number, number][] = [];
    for (let i = 0; i < N; i++) { if (i % n < n - 1) pairs.push([i, i + 1]); if (i + n < N) pairs.push([i, i + n]); }
    for (const [a, b] of rng.shuffle(pairs).slice(0, Math.round(pairs.length * info.signs[level]))) signs[edgeKey(a, b)] = sol[a] === sol[b] ? "=" : "x";
    const givens = sol.slice();
    const floor = Math.round(N * info.keep[level]);
    const logic = level !== "hard";
    let count = N, budget = n >= 10 ? 900000 : 400000;
    for (const i of rng.shuffle(Array.from({ length: N }, (_, x) => x))) {
      if (count <= floor || budget <= 0) break;
      givens[i] = 0;
      const c: Clues = { kind, n, k, givens, signs };
      let ok: boolean;
      if (logic) ok = solve(c, 1, 0, undefined, true).logicSolved;
      else { const r = solve(c, 2, 12000); budget -= r.steps; ok = r.count === 1 && !r.aborted; }
      if (ok) count--; else givens[i] = sol[i];
    }
    // Easy / Medium are always logic-solvable, which also proves the answer unique
    return { kind, level, seed, n, k, givens, signs, boxes: kind === "boxes" ? boxesFor(n) : undefined, solution: sol };
  }
  throw new Error("glow generator gave up");
}

export function verifyPuzzle(p: Puzzle): boolean {
  const r = solve(p, 2, 400000);
  return r.count === 1 && !r.aborted && r.sols[0].every((v, i) => v === p.solution[i]);
}
