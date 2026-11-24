// Trailfold solver: counts the one-stroke paths that fit a puzzle's clues (stops in order, walls, gaps, arrows,
// bends and straights, wrap-around, diagonal steps that may not cross, the twin lines). Depth-first from stop 1 with
// the most-constrained next cell first, pruned by "every unvisited region must still be reachable" and "a dead-end
// cell can only be the finish". Used to prove a puzzle has exactly one answer and to give hints.
import { crossingEdge, dirOf, edgeKey, neighbours, type Puzzle } from "./kinds";

export type Clues = Omit<Puzzle, "solution" | "split" | "seed" | "level"> & { level?: Puzzle["level"]; seed?: string };

interface Model {
  N: number;
  cells: number[];
  nb: number[][];
  seq: Int32Array;
  K: number;
  start: number;
  end: number;
  jumpFrom: number;
  jumpTo: number;
  arrows: Int32Array;
  marks: Int32Array;
  diag: boolean;
  wrap: boolean;
  rows: number;
  cols: number;
}

export function modelOf(p: Clues): Model | null {
  const size = p.rows * p.cols;
  const walls = new Set(p.walls);
  const nb: number[][] = [];
  const cells: number[] = [];
  for (let c = 0; c < size; c++) { nb.push(p.open[c] ? neighbours(p, c, walls) : []); if (p.open[c]) cells.push(c); }
  // global stop order: Twin Trails runs the pink line's stops, then the blue line's
  const seq = new Int32Array(size);
  const pink: [number, number][] = [], blue: [number, number][] = [];
  for (let c = 0; c < size; c++) if (p.stops[c] > 0) ((p.line?.[c] ?? 0) === 0 ? pink : blue).push([p.stops[c], c]);
  pink.sort((a, b) => a[0] - b[0]); blue.sort((a, b) => a[0] - b[0]);
  const all = [...pink, ...blue];
  all.forEach(([, c], i) => { seq[c] = i + 1; });
  if (!all.length) return null;
  const twin = p.kind === "twin" && blue.length > 0;
  return {
    N: cells.length, cells, nb, seq, K: all.length, start: all[0][1], end: all.length > 1 ? all[all.length - 1][1] : -1,
    jumpFrom: twin ? pink[pink.length - 1][1] : -1, jumpTo: twin ? blue[0][1] : -1,
    arrows: Int32Array.from(p.arrows ?? new Array(size).fill(-1)), marks: Int32Array.from(p.marks ?? new Array(size).fill(0)),
    diag: p.kind === "diagonal", wrap: p.kind === "wrap", rows: p.rows, cols: p.cols,
  };
}

export interface Found { count: number; paths: number[][]; aborted: boolean; steps: number }

/** paths that fit the clues, up to `limit`; `prefix` forces the first cells (for hints from a partly drawn line) */
export function solve(p: Clues, limit = 2, maxSteps = 80000, prefix: number[] = []): Found {
  const res: Found = { count: 0, paths: [], aborted: false, steps: 0 };
  const m = modelOf(p);
  if (!m) return res;
  const size = p.rows * p.cols;
  const seen = new Uint8Array(size);
  const path: number[] = [];
  const diagUsed = new Set<string>();
  let nextSeq = 1;

  const turnOk = (prev: number, cur: number, nxt: number) => {
    const mk = m.marks[cur];
    if (!mk || prev < 0) return true;
    const d1 = dirOf(m.rows, m.cols, prev, cur, m.wrap), d2 = dirOf(m.rows, m.cols, cur, nxt, m.wrap);
    return mk === 1 ? d1 === d2 : d1 !== d2 && d1 >= 0 && d2 >= 0;
  };

  // regions of unvisited cells: each must touch the head (or hold the blue start before the jump)
  const stamp = new Int32Array(size);
  let stampId = 0;
  const reachable = (head: number): boolean => {
    const remaining = m.N - path.length;
    if (remaining === 0) return true;
    const mark = ++stampId;
    const jumped = m.jumpTo < 0 || seen[m.jumpTo] === 1;
    const atJump = head === m.jumpFrom && !jumped;
    let regions = 0, deadEnds = 0, deadIsEnd = true;
    for (const c of m.cells) {
      if (seen[c] || stamp[c] === mark) continue;
      // flood one region
      stamp[c] = mark;
      const stack = [c];
      let touchesHead = false, holdsJump = false;
      while (stack.length) {
        const x = stack.pop()!;
        if (x === m.jumpTo) holdsJump = true;
        let deg = 0;
        for (const y of m.nb[x]) {
          if (y === head) { touchesHead = true; if (!atJump) deg++; continue; }
          if (seen[y]) continue;
          deg++;
          if (stamp[y] !== mark) { stamp[y] = mark; stack.push(y); }
        }
        if (jumped && remaining > 1) {
          if (deg === 0) return false;
          if (deg === 1) { deadEnds++; if (m.end >= 0 && x !== m.end) deadIsEnd = false; }
        }
      }
      regions++;
      if (atJump ? !holdsJump : !(touchesHead && !atJump) && !holdsJump) return false;
    }
    if (regions > (jumped ? 1 : 2)) return false;
    if (deadEnds > 1 || (deadEnds === 1 && !deadIsEnd)) return false;
    return true;
  };

  const options = (head: number, prev: number): number[] => {
    if (head === m.jumpFrom && m.jumpTo >= 0 && !seen[m.jumpTo]) return nextSeq === m.seq[m.jumpTo] ? [m.jumpTo] : [];
    let opts = m.nb[head];
    const a = m.arrows[head];
    if (a >= 0) opts = opts.filter((n) => dirOf(m.rows, m.cols, head, n, m.wrap) === a);
    const out: number[] = [];
    for (const n of opts) {
      if (seen[n]) continue;
      if (m.seq[n] && m.seq[n] !== nextSeq) continue;
      if (n === m.end && path.length + 1 < m.N) continue;
      if (n === m.jumpFrom && m.jumpTo >= 0 && path.length + 1 >= m.N) continue;
      if (!turnOk(prev, head, n)) continue;
      if (m.diag) { const x = crossingEdge(m.cols, head, n); if (x && diagUsed.has(x)) continue; }
      out.push(n);
    }
    // fewest onward moves first finds answers fastest
    if (out.length > 1) {
      const onward = (n: number) => { let k = 0; for (const y of m.nb[n]) if (!seen[y] && y !== head) k++; return k; };
      out.sort((x, y) => onward(x) - onward(y));
    }
    return out;
  };

  const push = (c: number) => {
    const prev = path[path.length - 1];
    seen[c] = 1; path.push(c);
    if (m.seq[c]) nextSeq++;
    if (m.diag && prev !== undefined) diagUsed.add(edgeKey(prev, c));
  };
  const pop = () => {
    const c = path.pop()!; seen[c] = 0;
    if (m.seq[c]) nextSeq--;
    const prev = path[path.length - 1];
    if (m.diag && prev !== undefined) diagUsed.delete(edgeKey(prev, c));
  };

  const rec = (): boolean => {
    if (res.count >= limit) return true;
    if (++res.steps > maxSteps) { res.aborted = true; return true; }
    const head = path[path.length - 1];
    if (path.length === m.N) {
      if ((m.end < 0 || head === m.end) && nextSeq === m.K + 1) { res.count++; res.paths.push(path.slice()); }
      return res.count >= limit;
    }
    if (!reachable(head)) return false;
    for (const n of options(head, path.length > 1 ? path[path.length - 2] : -1)) {
      push(n);
      if (rec()) return true;
      pop();
    }
    return false;
  };

  // the forced start (stop 1), then any prefix the player already drew
  if (prefix.length && prefix[0] !== m.start) return res;
  push(m.start);
  for (let i = 1; i < prefix.length; i++) {
    const head = path[path.length - 1];
    if (!options(head, path.length > 1 ? path[path.length - 2] : -1).includes(prefix[i])) return res;
    push(prefix[i]);
  }
  rec();
  return res;
}

/** is a drawn line (all cells, in order) a correct answer? Checks every rule directly. */
export function isAnswer(p: Clues, line: number[]): boolean {
  const r = solve(p, 1, line.length + 5, line);
  return r.count === 1;
}
