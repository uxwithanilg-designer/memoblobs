// Sudoku Ninefold puzzle factory. Every puzzle is built from a seed, so the same seed gives the same puzzle on every device:
//   1. a random solved grid (search with shuffled values; the 25×25 starts from a shuffled pattern and is re-solved
//      from a half-empty copy, so grids don't share one shape),
//   2. the board's extra rule laid over that solution (killer cages, thermometers),
//   3. givens: box boards dig cells out (in mirrored pairs on the smaller boards) and keep a removal only while the
//      puzzle stays uniquely solvable — and, for Easy / Medium, solvable with singles / simple techniques alone;
//      killer and thermo boards start from no givens and add one where two solutions disagree until one is left.
// All budgets are counted in solver steps, never in wall-clock time, so a seed always gives the same result.

import { boardOf, geometry, type BoardId, type Cage, type Level, type Puzzle } from "./boards";
import { fillRandom, logicSolve, modelOf, search, type Model } from "./solver";
import { rngFrom, type Rng } from "./rng";

export interface GenRequest { board: BoardId; level: Level; seed: string }

/** the 25×25 (or any box grid) from the classic shifted pattern, scrambled by bands, stacks and digit relabels */
function patternGrid(n: number, br: number, bc: number, rng: Rng): number[] {
  const rowIdx: number[] = [], colIdx: number[] = [];
  for (const band of rng.shuffle(Array.from({ length: n / br }, (_, i) => i))) for (const r of rng.shuffle(Array.from({ length: br }, (_, i) => i))) rowIdx.push(band * br + r);
  for (const st of rng.shuffle(Array.from({ length: n / bc }, (_, i) => i))) for (const c of rng.shuffle(Array.from({ length: bc }, (_, i) => i))) colIdx.push(st * bc + c);
  const relabel = rng.shuffle(Array.from({ length: n }, (_, i) => i + 1));
  const g: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const rr = rowIdx[r], cc = colIdx[c];
    g.push(relabel[(bc * (rr % br) + Math.floor(rr / br) + cc) % n]);
  }
  return g;
}

function solvedGrid(board: BoardId, m: Model, rng: Rng): number[] {
  const info = boardOf(board);
  if (board === "giant25") {
    const base = patternGrid(25, 5, 5, rng);
    // blank a random 45 % and let the search refill it: a different grid every time, found in a few hundred steps
    for (let tries = 0; tries < 4; tries++) {
      const start = base.map((v) => (rng.next() < 0.45 ? 0 : v));
      const g = fillRandom(m, rng, start, 6000);
      if (g) return g;
    }
    return base;
  }
  for (let tries = 0; tries < 8; tries++) {
    const g = fillRandom(m, rng, undefined, board === "samurai" ? 120000 : board === "giant16" ? 60000 : 40000);
    if (g) return g;
  }
  if (board !== "samurai" && board !== "xsudoku") return patternGrid(info.n, info.box[0], info.box[1], rng);
  throw new Error("no grid");
}

const STEP_CAP: Partial<Record<BoardId, number>> = { mini4: 400, classic6: 1500, classic9: 6000, xsudoku: 6000, giant16: 9000, giant25: 4000, samurai: 9000 };
/** total solver steps a dig may spend; past it the puzzle keeps the givens it has (still unique) */
const DIG_BUDGET: Partial<Record<BoardId, number>> = { mini4: 50000, classic6: 120000, classic9: 600000, xsudoku: 600000, giant16: 900000, giant25: 700000, samurai: 1200000 };
/** most technique tier each level may need (box boards that are graded: 4, 6, 9, X) */
const TIER: Partial<Record<Level, number>> = { easy: 1, medium: 2 };
const GRADED = new Set<BoardId>(["mini4", "classic6", "classic9", "xsudoku"]);

function dig(board: BoardId, level: Level, m: Model, solution: number[], rng: Rng): number[] {
  const info = boardOf(board), geo = geometry(board);
  const cells = solution.map((_, i) => i).filter((i) => geo.active[i]);
  const target = Math.round(cells.length * (info.givens[level] ?? 0.45));
  const givens = solution.slice();
  // mirrored pairs (180° turn) on the smaller boards look tidy; one cell at a time elsewhere
  const pairs: number[][] = [];
  if (board === "giant16" || board === "giant25" || board === "samurai") rng.shuffle(cells).forEach((c) => pairs.push([c]));
  else {
    const seen = new Set<number>();
    for (const c of rng.shuffle(cells.slice())) {
      if (seen.has(c)) continue;
      const mirror = geo.rows * geo.cols - 1 - c;
      seen.add(c); seen.add(mirror);
      pairs.push(mirror === c ? [c] : [c, mirror]);
    }
  }
  const cap = STEP_CAP[board] ?? 6000, maxTier = GRADED.has(board) ? TIER[level] : undefined;
  let budget = DIG_BUDGET[board] ?? 500000, count = cells.length;
  for (const pr of pairs) {
    if (count - pr.length < target) continue;
    if (budget <= 0) break;
    const keep = pr.map((c) => givens[c]);
    pr.forEach((c) => { givens[c] = 0; });
    const r = search(m, givens, 2, cap);
    budget -= r.steps;
    let ok = r.count === 1 && !r.aborted;
    if (ok && maxTier !== undefined) { const t = logicSolve(m, givens); ok = t > 0 && t <= maxTier; }
    if (ok) count -= pr.length;
    else pr.forEach((c, k) => { givens[c] = keep[k]; });
    if (count <= target) break;
  }
  // Hard / Expert: a second pass one cell at a time takes out what the mirrored pairs couldn't
  if ((level === "hard" || level === "expert") && count > target && budget > 0 && pairs.some((p) => p.length > 1)) {
    for (const c of rng.shuffle(cells.slice())) {
      if (count <= target || budget <= 0) break;
      if (!givens[c]) continue;
      const keep = givens[c];
      givens[c] = 0;
      const r = search(m, givens, 2, cap);
      budget -= r.steps;
      if (r.count === 1 && !r.aborted) count--; else givens[c] = keep;
    }
  }
  return givens;
}

// ------------------------------------------------------------------ killer cages

function makeCages(solution: number[], rng: Rng, level: Level): Cage[] {
  const owner = new Array(81).fill(-1);
  const cages: Cage[] = [];
  const sizes = level === "easy" ? [2, 2, 2, 3, 3, 3, 4] : level === "medium" ? [2, 2, 3, 3, 3, 4, 4, 5] : [2, 3, 3, 4, 4, 4, 5, 5];
  const nb = (c: number) => { const r = Math.floor(c / 9), k = c % 9; return [r > 0 ? c - 9 : -1, r < 8 ? c + 9 : -1, k > 0 ? c - 1 : -1, k < 8 ? c + 1 : -1].filter((x) => x >= 0); };
  for (const start of rng.shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (owner[start] >= 0) continue;
    const want = rng.pick(sizes), cells = [start], vals = new Set([solution[start]]);
    owner[start] = cages.length;
    while (cells.length < want) {
      const opts: number[] = [];
      for (const c of cells) for (const x of nb(c)) if (owner[x] < 0 && !vals.has(solution[x]) && !opts.includes(x)) opts.push(x);
      if (!opts.length) break;
      const x = rng.pick(opts);
      owner[x] = cages.length; cells.push(x); vals.add(solution[x]);
    }
    cages.push({ cells, sum: 0 });
  }
  // fold lone single cells into a neighbouring cage when that keeps digits distinct (single-cell cages are giveaways)
  for (let i = 0; i < cages.length; i++) {
    const cg = cages[i];
    if (cg.cells.length !== 1) continue;
    const c = cg.cells[0];
    const host = nb(c).map((x) => owner[x]).find((o) => o !== i && cages[o].cells.length < 5 && !cages[o].cells.some((x) => solution[x] === solution[c]));
    if (host !== undefined) { cages[host].cells.push(c); owner[c] = host; cg.cells = []; }
  }
  const out = cages.filter((c) => c.cells.length);
  out.forEach((c) => { c.sum = c.cells.reduce((s, x) => s + solution[x], 0); c.cells.sort((a, b) => a - b); });
  return out;
}

// ------------------------------------------------------------------ thermometers

function makeThermos(solution: number[], rng: Rng, level: Level): number[][] {
  const used = new Set<number>(), out: number[][] = [];
  const want = level === "easy" ? 7 : level === "medium" ? 8 : 9;
  const nb8 = (c: number) => {
    const r = Math.floor(c / 9), k = c % 9, o: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const R = r + dr, C = k + dc;
      if (R >= 0 && R < 9 && C >= 0 && C < 9) o.push(R * 9 + C);
    }
    return o;
  };
  for (let tries = 0; tries < 400 && out.length < want; tries++) {
    const start = rng.int(81);
    if (used.has(start) || solution[start] > 5) continue;
    const path = [start];
    const len = 3 + rng.int(level === "hard" ? 4 : 3);
    while (path.length < len) {
      const last = path[path.length - 1];
      // the next cell must be bigger; prefer small steps so thermometers are long
      const opts = nb8(last).filter((x) => !used.has(x) && !path.includes(x) && solution[x] > solution[last]).sort((a, b) => solution[a] - solution[b]);
      if (!opts.length) break;
      path.push(opts[Math.min(opts.length - 1, rng.int(2))]);
    }
    if (path.length < 3) continue;
    path.forEach((c) => used.add(c));
    out.push(path);
  }
  return out;
}

/** start from no givens; while two solutions exist, give the cell they disagree on */
function givensUntilUnique(m: Model, solution: number[], rng: Rng, extra: number): number[] {
  const givens = new Array(solution.length).fill(0);
  for (let round = 0; round < 60; round++) {
    const r = search(m, givens, 2, 12000);
    if (r.count === 1 && !r.aborted) break;
    let pick = -1;
    if (r.count >= 2) {
      const diff = r.solutions[0].map((v, i) => (v !== r.solutions[1][i] ? i : -1)).filter((i) => i >= 0);
      pick = rng.pick(diff);
    } else {
      const open = givens.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
      pick = rng.pick(open);
    }
    givens[pick] = solution[pick];
  }
  // the level's extra givens make it gentler
  const open = rng.shuffle(givens.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0));
  for (let k = 0; k < extra && k < open.length; k++) givens[open[k]] = solution[open[k]];
  return givens;
}

// ------------------------------------------------------------------ entry

export function generatePuzzle(req: GenRequest): Puzzle {
  const { board, level, seed } = req;
  const info = boardOf(board), geo = geometry(board);
  const rng = rngFrom(`sudoku:${board}:${level}:${seed}`);
  const base = modelOf(board);
  const solution = solvedGrid(board, base, rng);
  const out: Puzzle = { board, level, seed, n: info.n, rows: geo.rows, cols: geo.cols, givens: [], solution: solution.map((v, i) => (geo.active[i] ? v : -1)) };
  if (board === "killer") {
    out.cages = makeCages(solution, rng, level);
    out.givens = givensUntilUnique(modelOf(board, out.cages), solution, rng, (info.givens[level] as number) ?? 0);
  } else if (board === "thermo") {
    out.thermos = makeThermos(solution, rng, level);
    // thermometers alone leave many solutions: add givens where solutions disagree until one is left
    out.givens = givensUntilUnique(modelOf(board, [], out.thermos), solution, rng, (info.givens[level] as number) ?? 0);
  } else {
    out.givens = dig(board, level, base, solution, rng);
  }
  out.givens = out.givens.map((v, i) => (geo.active[i] ? v : -1));
  return out;
}

/** independent check used by tests and the worker: unique, and the givens agree with the solution */
export function verifyPuzzle(p: Puzzle): boolean {
  const m = modelOf(p.board, p.cages, p.thermos);
  const r = search(m, p.givens.map((v) => Math.max(0, v)), 2, 400000);
  return r.count === 1 && !r.aborted && r.solutions[0].every((v, i) => v === p.solution[i]);
}
