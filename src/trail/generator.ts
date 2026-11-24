// Trailfold puzzle factory. From a seed:
//   1. a random one-stroke path through the board — a snake to start, then thousands of "backbite" moves (join the
//      head to a neighbour, flip the tail) so every path is a fresh shape; Island Hop first finds a path around its gaps,
//   2. the kind's clues laid on that path: numbered stops (spread by level), plus decoy walls for the maze kinds,
//   3. while the solver still finds a second answer, a clue goes exactly where the two answers part ways — a stop,
//      a wall on the wrong turn, an arrow, or a bend / straight mark — until the answer is unique,
//   4. Hard puzzles then drop every stop they can spare, so they stay as bare as possible.
// Budgets are solver steps, never clock time, so a seed always makes the same puzzle (the Daily Trail).
import { DIRS, crossingEdge, dirOf, edgeKey, kindOf, neighbours, type KindId, type Level, type Puzzle } from "./kinds";
import { solve, type Clues } from "./solver";
import { rngFrom, type Rng } from "../sudoku/rng";

export interface GenRequest { kind: KindId; level: Level; seed: string }

function snake(rows: number, cols: number): number[] {
  const p: number[] = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) p.push(r * cols + (r % 2 ? cols - 1 - k : k));
  return p;
}

/** randomise a Hamiltonian path with backbite moves (keeps it Hamiltonian; Eight Ways keeps it free of crossings) */
function backbite(path: number[], adj: number[][], rng: Rng, moves: number, cols: number, diag: boolean) {
  const pos = new Int32Array(adj.length).fill(-1);
  path.forEach((c, i) => { pos[c] = i; });
  const crosses = (p: number[]) => {
    const used = new Set<string>();
    for (let i = 1; i < p.length; i++) used.add(edgeKey(p[i - 1], p[i]));
    for (let i = 1; i < p.length; i++) { const x = crossingEdge(cols, p[i - 1], p[i]); if (x && used.has(x)) return true; }
    return false;
  };
  const flip = () => { path.reverse(); path.forEach((c, i) => { pos[c] = i; }); };
  for (let m = 0; m < moves; m++) {
    if (rng.next() < 0.5) flip();
    const L = path.length, end = path[L - 1];
    const opts = adj[end].filter((x) => pos[x] >= 0 && x !== path[L - 2]);
    if (!opts.length) continue;
    const x = rng.pick(opts), i = pos[x];
    if (diag) {
      // the new edge end→x may not cross a diagonal the path keeps (the edge x→path[i+1] is the one that goes)
      const e = crossingEdge(cols, end, x);
      if (e) {
        const [a, b] = e.split("-").map(Number);
        const removed = (a === x && b === path[i + 1]) || (b === x && a === path[i + 1]);
        if (Math.abs(pos[a] - pos[b]) === 1 && !removed) continue;
      }
    }
    // new path: path[0..i] + reverse(path[i+1..L-1])
    for (let lo = i + 1, hi2 = L - 1; lo < hi2; lo++, hi2--) { const t = path[lo]; path[lo] = path[hi2]; path[hi2] = t; }
    for (let k = i + 1; k < L; k++) pos[path[k]] = k;
  }
  if (diag && crosses(path)) return null;
  return path;
}

function islands(rows: number, cols: number, level: Level, rng: Rng, kind: KindId): { open: boolean[]; path: number[] } | null {
  const N = rows * cols;
  const holes = Math.round(N * (level === "easy" ? 0.1 : level === "medium" ? 0.14 : 0.16));
  for (let tries = 0; tries < 30; tries++) {
    const open = new Array(N).fill(true);
    // holes in small clumps, often mirrored, never cutting the board apart
    let made = 0;
    while (made < holes) {
      const c = rng.int(N);
      if (!open[c]) continue;
      open[c] = false; made++;
      if (made < holes && rng.next() < 0.5) { const m = N - 1 - c; if (open[m]) { open[m] = false; made++; } }
    }
    const cells = open.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
    // one connected piece
    const seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) { const x = st.pop()!; for (const y of neighbours({ kind, rows, cols, open }, x)) if (!seen.has(y)) { seen.add(y); st.push(y); } }
    if (seen.size !== cells.length) continue;
    // find a path: pretend a start cell is stop 1 and let the solver look for any stroke from it
    for (let s = 0; s < 4; s++) {
      const start = rng.pick(cells);
      const stops = new Array(N).fill(0); stops[start] = 1;
      const r = solve({ kind: "classic", rows, cols, open, stops, walls: [] } as Clues, 1, 6000);
      if (r.count) return { open, path: r.paths[0] };
    }
  }
  return null;
}

/** spread `n` stop positions over the path, never next to each other */
function spread(len: number, n: number, rng: Rng, from = 0): number[] {
  const out: number[] = [];
  if (n <= 0) return out;
  const gap = len / (n + 1);
  for (let k = 1; k <= n; k++) out.push(from + Math.min(len - 2, Math.max(1, Math.round(k * gap + (rng.next() - 0.5) * gap * 0.6))));
  return [...new Set(out)];
}

export function generatePuzzle(req: GenRequest): Puzzle {
  const { kind, level, seed } = req;
  const info = kindOf(kind);
  const [rows, cols] = info.size[level];
  const N = rows * cols;
  for (let attempt = 0; attempt < 6; attempt++) {
    const rng = rngFrom(`trailfold:${kind}:${level}:${seed}:${attempt}`);
    let open = new Array(N).fill(true);
    let path: number[] | null = null;
    if (kind === "islands") {
      const r = islands(rows, cols, level, rng, kind);
      if (!r) continue;
      open = r.open; path = r.path;
    } else path = snake(rows, cols);
    const geo = { kind, rows, cols, open };
    const adj = Array.from({ length: N }, (_, c) => (open[c] ? neighbours(geo, c) : []));
    path = backbite(path, adj, rng, path.length * 60, cols, kind === "diagonal");
    if (!path) continue;
    const L = path.length;

    const stopAt = new Set<number>([0, L - 1]);
    let split: number | undefined;
    if (kind === "twin") { split = Math.round(L * (0.38 + rng.next() * 0.24)); stopAt.add(split - 1); stopAt.add(split); }
    const target = Math.round(L * info.stops[level]);
    if (kind === "twin") { spread(split! - 1, Math.floor(target / 2), rng).forEach((i) => stopAt.add(i)); spread(L - split!, Math.ceil(target / 2), rng, split).forEach((i) => stopAt.add(i)); }
    else spread(L, target, rng).forEach((i) => stopAt.add(i));

    const walls = new Set<string>();
    const pathEdges = new Set<string>();
    for (let i = 1; i < L; i++) if (i !== split) pathEdges.add(edgeKey(path[i - 1], path[i]));
    if (kind === "walls" || kind === "mega") {
      // decoy walls on edges the answer doesn't use: they make the maze and cut down wrong turns
      const free: string[] = [];
      for (let c = 0; c < N; c++) for (const n of adj[c]) if (c < n && !pathEdges.has(edgeKey(c, n))) free.push(edgeKey(c, n));
      rng.shuffle(free).slice(0, Math.round(free.length * (level === "hard" ? 0.32 : 0.45))).forEach((e) => walls.add(e));
    }
    const arrows = new Array(N).fill(-1), marks = new Array(N).fill(0);

    const build = (): Clues => {
      const stops = new Array(N).fill(0), line = new Array(N).fill(0);
      const idx = [...stopAt].sort((a, b) => a - b);
      let a = 0, b = 0;
      for (const i of idx) {
        const blue = split !== undefined && i >= split;
        stops[path![i]] = blue ? ++b : ++a;
        line[path![i]] = blue ? 1 : 0;
      }
      return { kind, rows, cols, open, stops, line: kind === "twin" ? line : undefined, walls: [...walls], arrows: kind === "arrows" ? arrows : undefined, marks: kind === "bends" ? marks : undefined };
    };

    const cap = N > 90 ? 30000 : N > 45 ? 50000 : 40000;
    let ok = false;
    for (let round = 0; round < 90; round++) {
      const r = solve(build(), 2, cap);
      if (r.count === 1 && !r.aborted) { ok = true; break; }
      if (r.count === 0 && !r.aborted) break; // should not happen: the planted path always fits
      if (r.count >= 2) {
        const other = r.paths.find((q) => q.some((c, i) => c !== path![i])) ?? r.paths[1];
        let i = 1;
        while (i < L && other[i] === path[i]) i++;
        const at = path[i - 1], good = path[i], bad = other[i];
        const jump = split !== undefined && i === split;
        if (!jump && (kind === "walls" || kind === "mega") && adj[at].includes(bad)) walls.add(edgeKey(at, bad));
        else if (!jump && kind === "arrows" && arrows[at] < 0 && i - 1 !== 0 && dirOf(rows, cols, at, good) >= 0) arrows[at] = dirOf(rows, cols, at, good);
        else if (!jump && kind === "bends" && i >= 2 && !stopAt.has(i - 1) && marks[at] === 0) {
          const d1 = dirOf(rows, cols, path[i - 2], at), d2 = dirOf(rows, cols, at, good);
          marks[at] = d1 === d2 ? 1 : 2;
        } else if (!stopAt.has(i)) stopAt.add(i);
        else {
          // the other answer skipped a stop for now: make the cell it went to a later stop, which it then visits too early
          const u = path.indexOf(bad);
          if (u > 0 && u < L - 1) stopAt.add(u); else stopAt.add(Math.min(L - 2, i + 1));
        }
      } else {
        // the solver ran out of steps: one more stop where the path is least pinned down
        const idx = [...stopAt].sort((a, b) => a - b);
        let best = 1, gap = 0;
        for (let k = 1; k < idx.length; k++) if (idx[k] - idx[k - 1] > gap) { gap = idx[k] - idx[k - 1]; best = Math.round((idx[k] + idx[k - 1]) / 2); }
        stopAt.add(best);
      }
    }
    if (!ok) continue;

    // Hard: take out every stop that isn't needed (never the ends or the twin's line ends)
    if (level === "hard") {
      const fixed = new Set([0, L - 1, ...(split !== undefined ? [split - 1, split] : [])]);
      for (const i of rng.shuffle([...stopAt].filter((x) => !fixed.has(x)))) {
        stopAt.delete(i);
        const r = solve(build(), 2, cap);
        if (!(r.count === 1 && !r.aborted)) stopAt.add(i);
      }
    }
    const clues = build();
    return { ...clues, level, seed, solution: path, split, walls: [...walls] } as Puzzle;
  }
  throw new Error("trail generator gave up");
}

/** check used by tests: unique, and the planted answer is the one */
export function verifyPuzzle(p: Puzzle): boolean {
  const r = solve(p, 2, 600000);
  return r.count === 1 && !r.aborted && r.paths[0].every((c, i) => c === p.solution[i]);
}

export { DIRS };
