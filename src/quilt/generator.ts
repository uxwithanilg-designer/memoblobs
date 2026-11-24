// Quiltfold puzzle factory. From a seed:
//   1. a random quilt: the board is filled patch by patch from the top-left free cell with a random rectangle that
//      fits (squares only / ribbons only / no equal-size neighbours, as the kind demands; small patches are rarer),
//   2. one number in each patch, on a random cell,
//   3. while the solver finds a second way to cut the quilt, fix it where the two answers differ: move that patch's
//      number to a cell the wrong patch can't reach, or (by kind) give it a shape hint or stitch a fence,
//   4. Mystery Marks then hides as many sizes behind a ? as it can while the answer stays unique.
// Budgets are solver steps, never clock time, so a seed always gives the same puzzle (the Daily Quilt).
import { area, cellsOf, edgeKey, kindOf, sameRect, shapeOf, type KindId, type Level, type Puzzle, type Rect, type Shape } from "./kinds";
import { solve, type Clues } from "./solver";
import { rngFrom, type Rng } from "../sudoku/rng";

export interface GenRequest { kind: KindId; level: Level; seed: string }

function gaps(rows: number, cols: number, level: Level, rng: Rng): boolean[] {
  const N = rows * cols, open = new Array(N).fill(true);
  const want = Math.round(N * (level === "easy" ? 0.08 : level === "medium" ? 0.11 : 0.13));
  let made = 0;
  while (made < want) {
    const c = rng.int(N);
    if (!open[c]) continue;
    open[c] = false; made++;
    // sometimes a second gap next to it, sometimes a mirrored one
    if (made < want && rng.next() < 0.4) {
      const n = rng.next() < 0.5 && c % cols < cols - 1 ? c + 1 : c + cols;
      if (n < N && open[n]) { open[n] = false; made++; }
    }
    if (made < want && rng.next() < 0.4) { const m = N - 1 - c; if (open[m]) { open[m] = false; made++; } }
  }
  return open;
}

function partition(kind: KindId, rows: number, cols: number, open: boolean[], maxArea: number, rng: Rng): Rect[] | null {
  const N = rows * cols, owner = new Int32Array(N).fill(-1);
  const rects: Rect[] = [];
  for (let start = 0; start < N; start++) {
    if (!open[start] || owner[start] >= 0) continue;
    const r = Math.floor(start / cols), c = start % cols;
    const opts: { x: Rect; wt: number }[] = [];
    for (let h = 1; h <= Math.min(maxArea, rows - r); h++) for (let w = 1; w * h <= maxArea && c + w <= cols; w++) {
      if (kind === "squares" && h !== w) continue;
      if (kind === "ribbons" && h !== 1 && w !== 1) continue;
      const x = { r, c, h, w };
      let ok = true;
      for (const cell of cellsOf(x, cols)) if (!open[cell] || owner[cell] >= 0) { ok = false; break; }
      if (!ok) continue;
      if (kind === "notwins") {
        const a = h * w;
        const mine = new Set(cellsOf(x, cols));
        for (const cell of mine) {
          const rr = Math.floor(cell / cols), cc = cell % cols;
          for (const n of [rr > 0 ? cell - cols : -1, rr < rows - 1 ? cell + cols : -1, cc > 0 ? cell - 1 : -1, cc < cols - 1 ? cell + 1 : -1]) {
            if (n >= 0 && !mine.has(n) && owner[n] >= 0 && area(rects[owner[n]]) === a) ok = false;
          }
        }
        if (!ok) continue;
      }
      const a = h * w;
      // favour mid-sized patches; singles only when needed
      const wt = a === 1 ? 0.15 : a <= 3 ? 1 : a <= 6 ? 1.6 : 1.1;
      opts.push({ x, wt });
    }
    if (!opts.length) return null;
    let roll = rng.next() * opts.reduce((s, o) => s + o.wt, 0), pick = opts[0].x;
    for (const o of opts) { roll -= o.wt; if (roll <= 0) { pick = o.x; break; } }
    rects.push(pick);
    for (const cell of cellsOf(pick, cols)) owner[cell] = rects.length - 1;
  }
  // too many single cells makes a dull quilt
  if (rects.filter((x) => area(x) === 1).length > Math.max(1, rects.length * 0.12)) return null;
  return rects;
}

export function generatePuzzle(req: GenRequest): Puzzle {
  const { kind, level, seed } = req;
  const info = kindOf(kind);
  const [rows, cols] = info.size[level];
  const maxA = info.maxArea[level];
  const N = rows * cols;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = rngFrom(`quiltfold:${kind}:${level}:${seed}:${attempt}`);
    const open = kind === "holes" ? gaps(rows, cols, level, rng) : new Array(N).fill(true);
    const rects = partition(kind, rows, cols, open, maxA, rng);
    if (!rects) continue;
    // the number of each patch on a random cell of it
    const at = rects.map((x) => rng.pick(cellsOf(x, cols)));
    const shape: Shape[] = new Array(N).fill(0);
    const fences = new Set<string>();
    const build = (): Clues & { clue: number[] } => {
      const clue = new Array(N).fill(0);
      rects.forEach((x, k) => { clue[at[k]] = area(x); });
      return { kind, rows, cols, open, clue, shape: kind === "shapes" ? shape : undefined, fences: [...fences] };
    };
    // boundary edges of the true quilt (fences may only go there)
    const ownerOf = new Int32Array(N).fill(-1);
    rects.forEach((x, k) => cellsOf(x, cols).forEach((c) => { ownerOf[c] = k; }));
    if (kind === "fences") {
      const bnd: string[] = [];
      for (let c = 0; c < N; c++) {
        if (!open[c]) continue;
        if (c % cols < cols - 1 && open[c + 1] && ownerOf[c] !== ownerOf[c + 1]) bnd.push(edgeKey(c, c + 1));
        if (c + cols < N && open[c + cols] && ownerOf[c] !== ownerOf[c + cols]) bnd.push(edgeKey(c, c + cols));
      }
      rng.shuffle(bnd).slice(0, Math.round(bnd.length * (level === "hard" ? 0.18 : level === "medium" ? 0.26 : 0.34))).forEach((e) => fences.add(e));
    }
    if (kind === "shapes") {
      // a few hints from the start; more on easy
      const share = level === "easy" ? 0.45 : level === "medium" ? 0.3 : 0.18;
      rects.forEach((x, k) => { if (rng.next() < share) shape[at[k]] = shapeOf(x); });
    }

    const cap = N > 120 ? 120000 : 60000;
    let ok = false;
    for (let round = 0; round < 60; round++) {
      const r = solve(build(), maxA, 2, cap);
      if (r.count === 1 && !r.aborted) { ok = true; break; }
      if (r.count === 0 && !r.aborted) break;
      if (r.aborted) break;
      // clue order in the solver = clue cells in board order
      const order = rects.map((_, k) => k).sort((a, b) => at[a] - at[b]);
      const alt = r.sols.find((s) => s.some((x, i) => !sameRect(x, rects[order[i]]))) ?? r.sols[1];
      const diff = order.map((k, i) => (sameRect(alt[i], rects[k]) ? -1 : i)).filter((i) => i >= 0);
      const i = rng.pick(diff), k = order[i], wrong = alt[i];
      const wrongCells = new Set(cellsOf(wrong, cols));
      if (kind === "shapes" && shape[at[k]] === 0 && shapeOf(wrong) !== shapeOf(rects[k])) { shape[at[k]] = shapeOf(rects[k]); continue; }
      if (kind === "fences") {
        // a fence inside the wrong patch, along a seam of the true quilt
        const seams: string[] = [];
        for (const c of wrongCells) for (const n of [c + 1, c + cols]) if (wrongCells.has(n) && (n !== c + 1 || n % cols !== 0) && ownerOf[c] !== ownerOf[n]) seams.push(edgeKey(c, n));
        const fresh = seams.filter((e) => !fences.has(e));
        if (fresh.length) { fences.add(rng.pick(fresh)); continue; }
      }
      // move the number to a cell of its patch the wrong patch doesn't cover
      const spots = cellsOf(rects[k], cols).filter((c) => !wrongCells.has(c));
      if (spots.length) at[k] = rng.pick(spots);
      else at[k] = rng.pick(cellsOf(rects[k], cols));
    }
    if (!ok) continue;

    const clues = build();
    if (kind === "mystery") {
      const share = level === "easy" ? 0.15 : level === "medium" ? 0.25 : 0.38;
      let hidden = 0;
      for (const k of rng.shuffle(rects.map((_, j) => j))) {
        if (hidden >= Math.round(rects.length * share)) break;
        const keep = clues.clue[at[k]];
        clues.clue[at[k]] = -1;
        const r = solve(clues, maxA, 2, cap);
        if (r.count === 1 && !r.aborted) hidden++; else clues.clue[at[k]] = keep;
      }
    }
    const order = rects.map((_, k) => k).sort((a, b) => at[a] - at[b]);
    return { ...clues, level, seed, fences: [...fences], solution: order.map((k) => rects[k]) } as Puzzle;
  }
  throw new Error("quilt generator gave up");
}

/** check used by tests: unique and the planted answer */
export function verifyPuzzle(p: Puzzle): boolean {
  const r = solve(p, kindOf(p.kind).maxArea[p.level], 2, 600000);
  return r.count === 1 && !r.aborted && r.sols[0].every((x, i) => sameRect(x, p.solution[i]));
}
