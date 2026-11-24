// Drawing the line: what a drag into a cell does (extend, step back, jump back), which moves the rules block, when
// the puzzle is solved, and hints (the answer is unique, so a hint follows the planted path).
import { crossingEdge, dirOf, edgeKey, neighbours, type Puzzle } from "./kinds";

export interface Lines { a: number[]; b: number[] }
export type DrawEvent =
  | { kind: "step"; cell: number; index: number; stop: boolean; line: 0 | 1 }
  | { kind: "back"; cell: number; line: 0 | 1 }
  | { kind: "jump"; cell: number; line: 0 | 1 }
  | { kind: "start"; cell: number; line: 0 | 1 }
  | { kind: "blocked"; cell: number; why: string }
  | { kind: "none" };

const wallSet = new WeakMap<Puzzle, Set<string>>();
const walls = (p: Puzzle) => { let w = wallSet.get(p); if (!w) { w = new Set(p.walls); wallSet.set(p, w); } return w; };
const nbCache = new WeakMap<Puzzle, number[][]>();
export function adjacency(p: Puzzle) {
  let a = nbCache.get(p);
  if (!a) { a = Array.from({ length: p.rows * p.cols }, (_, c) => (p.open[c] ? neighbours(p, c, walls(p)) : [])); nbCache.set(p, a); }
  return a;
}
export const openCount = (p: Puzzle) => p.open.filter(Boolean).length;
const lineOf = (p: Puzzle, c: number) => p.line?.[c] ?? 0;
/** the last stop number of a line */
export function lastStop(p: Puzzle, line: 0 | 1) { let m = 0; p.stops.forEach((s, c) => { if (s > 0 && lineOf(p, c) === line) m = Math.max(m, s); }); return m; }
export const startOf = (p: Puzzle, line: 0 | 1) => p.stops.findIndex((s, c) => s === 1 && lineOf(p, c) === line);

/** the next stop number a line is waiting for */
function nextStop(p: Puzzle, ln: number[], line: 0 | 1) { let n = 1; for (const c of ln) if (p.stops[c] > 0 && lineOf(p, c) === line && p.stops[c] === n) n++; return n; }

/** can the line's head step into cell x? (null = yes, else the reason) */
function stepBlocked(p: Puzzle, L: Lines, ln: number[], line: 0 | 1, x: number): string | null {
  const head = ln[ln.length - 1];
  if (!adjacency(p)[head].includes(x)) return "not next to the line";
  if (L.a.includes(x) || L.b.includes(x)) return "already used";
  const stop = p.stops[x];
  if (stop > 0) {
    if (lineOf(p, x) !== line) return "that stop belongs to the other line";
    if (stop !== nextStop(p, ln, line)) return `go to ${nextStop(p, ln, line)} first`;
  }
  if (p.stops[head] > 0 && p.stops[head] === lastStop(p, line) && lineOf(p, head) === line) return "this line is finished";
  if (p.arrows && p.arrows[head] >= 0 && dirOf(p.rows, p.cols, head, x, p.kind === "wrap") !== p.arrows[head]) return "follow the arrow";
  if (p.marks && p.marks[head] && ln.length > 1) {
    const d1 = dirOf(p.rows, p.cols, ln[ln.length - 2], head), d2 = dirOf(p.rows, p.cols, head, x);
    if (p.marks[head] === 1 && d1 !== d2) return "go straight through the ring";
    if (p.marks[head] === 2 && d1 === d2) return "turn on the diamond";
  }
  if (p.kind === "diagonal") {
    const e = crossingEdge(p.cols, head, x);
    if (e) for (const l of [L.a, L.b]) for (let i = 1; i < l.length; i++) if (edgeKey(l[i - 1], l[i]) === e) return "lines can't cross";
  }
  return null;
}

/** a press on cell c: start a line, or jump back to a cell already on a line */
export function press(p: Puzzle, L: Lines, c: number): { L: Lines; line: 0 | 1 | -1; e: DrawEvent } {
  for (const line of [0, 1] as const) {
    const ln = line ? L.b : L.a;
    const i = ln.indexOf(c);
    if (i >= 0) {
      const cut = ln.slice(0, i + 1);
      return { L: line ? { ...L, b: cut } : { ...L, a: cut }, line, e: i === ln.length - 1 ? { kind: "none" } : { kind: "jump", cell: c, line } };
    }
  }
  for (const line of [0, 1] as const) {
    if (c === startOf(p, line)) return { L: line ? { ...L, b: [c] } : { ...L, a: [c] }, line, e: { kind: "start", cell: c, line } };
  }
  return { L, line: -1, e: { kind: "blocked", cell: c, why: p.kind === "twin" ? "start on a 1" : "start on 1" } };
}

/** the finger moved into cell c while drawing `line` */
export function drag(p: Puzzle, L: Lines, line: 0 | 1, c: number): { L: Lines; e: DrawEvent } {
  const ln = line ? L.b : L.a;
  if (!ln.length || ln[ln.length - 1] === c) return { L, e: { kind: "none" } };
  const set = (n: number[]) => (line ? { ...L, b: n } : { ...L, a: n });
  if (ln.length > 1 && ln[ln.length - 2] === c) return { L: set(ln.slice(0, -1)), e: { kind: "back", cell: c, line } };
  const at = ln.indexOf(c);
  if (at >= 0) return { L: set(ln.slice(0, at + 1)), e: { kind: "jump", cell: c, line } };
  const why = stepBlocked(p, L, ln, line, c);
  if (why) return { L, e: { kind: "blocked", cell: c, why } };
  const next = [...ln, c];
  return { L: set(next), e: { kind: "step", cell: c, index: next.length - 1, stop: p.stops[c] > 0, line } };
}

export function isSolved(p: Puzzle, L: Lines): boolean {
  if (L.a.length + L.b.length !== openCount(p)) return false;
  for (const line of [0, 1] as const) {
    const ln = line ? L.b : L.a;
    const last = lastStop(p, line);
    if (!last) continue;
    if (!ln.length || ln[0] !== startOf(p, line)) return false;
    const end = ln[ln.length - 1];
    if (p.stops[end] !== last || lineOf(p, end) !== line) return false;
    if (nextStop(p, ln, line) !== last + 1) return false;
  }
  // bends: every mark satisfied (the drawing blocks most mistakes; this catches the rest)
  if (p.marks) for (const ln of [L.a, L.b]) for (let i = 1; i < ln.length - 1; i++) {
    const m = p.marks[ln[i]];
    if (!m) continue;
    const same = dirOf(p.rows, p.cols, ln[i - 1], ln[i]) === dirOf(p.rows, p.cols, ln[i], ln[i + 1]);
    if ((m === 1) !== same) return false;
  }
  return true;
}

/** the answer split into its lines */
export function answer(p: Puzzle): Lines {
  return p.split !== undefined ? { a: p.solution.slice(0, p.split), b: p.solution.slice(p.split) } : { a: p.solution.slice(), b: [] };
}

/** a hint: keep the part of each line that matches the answer and draw the next few cells of it */
export function hint(p: Puzzle, L: Lines, steps = 3): { L: Lines; cells: number[] } {
  const ans = answer(p);
  const fix = (have: number[], want: number[]) => { let k = 0; while (k < have.length && k < want.length && have[k] === want[k]) k++; return k; };
  const ka = fix(L.a, ans.a), kb = fix(L.b, ans.b);
  // grow the line that's further from done (pink first)
  const growA = ans.a.length - ka > 0 && (ka <= kb || ans.b.length - kb === 0);
  const want = growA ? ans.a : ans.b, k = growA ? ka : kb;
  const upto = Math.min(want.length, Math.max(1, k) + steps);
  const grown = want.slice(0, upto);
  const next: Lines = growA ? { a: grown, b: L.b.slice(0, kb).filter((c) => !grown.includes(c)) } : { a: L.a.slice(0, ka).filter((c) => !grown.includes(c)), b: grown };
  return { L: next, cells: want.slice(k, upto) };
}
