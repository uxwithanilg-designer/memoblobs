// Playing a Crownfold board. A cell is 0 empty, 1 marked ×, 2 crown. A tap cycles empty → × → crown → empty; a drag
// paints ×. Rule breaks are found as you go (so the board can light them up), squares a crown already rules out get
// a faint dot, finished rows / columns / courts flash, and a hint places (or removes) one crown.
import { around, closedCells, ray, type Puzzle } from "./kinds";
import { conflicts as table, logic } from "./solver";

export const EMPTY = 0, MARK = 1, CROWN = 2;

export function startValues(p: Puzzle): number[] {
  const v = new Array<number>(p.n * p.n).fill(EMPTY);
  for (const i of p.givens) v[i] = CROWN;
  return v;
}

export const cycle = (v: number) => (v + 1) % 3;

const unitsOf = (p: Puzzle) => {
  const n = p.n, rows: number[][] = [], cols: number[][] = [], regs: number[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) { rows.push([]); cols.push([]); }
  for (let i = 0; i < n * n; i++) { rows[Math.floor(i / n)].push(i); cols[i % n].push(i); regs[p.regions[i]].push(i); }
  return { rows, cols, regs };
};

/** crowns breaking a rule (and towers / arrows that can no longer be right) */
export function conflicts(p: Puzzle, v: number[]): Set<number> {
  const bad = new Set<number>(), n = p.n, conf = table(p.kind, n);
  for (let i = 0; i < n * n; i++) if (v[i] === CROWN) for (const j of conf[i]) if (v[j] === CROWN) { bad.add(i); bad.add(j); }
  const { rows, cols, regs } = unitsOf(p);
  for (const u of [...rows, ...cols, ...regs]) {
    const c = u.filter((i) => v[i] === CROWN);
    if (c.length > p.k) c.forEach((i) => bad.add(i));
  }
  for (const [t, need] of Object.entries(p.towers)) {
    const have = around(n, +t).filter((i) => v[i] === CROWN).length;
    if (have > need) bad.add(+t);
  }
  for (const [a, d] of Object.entries(p.arrows)) {
    const ry = ray(n, +a, d);
    if (!ry.some((i) => v[i] === CROWN) && ry.every((i) => v[i] === MARK)) bad.add(+a);
  }
  return bad;
}

/** squares a placed crown already rules out (shown as faint dots) */
export function ruledOut(p: Puzzle, v: number[]): Set<number> {
  const out = new Set<number>(), n = p.n, conf = table(p.kind, n);
  const { rows, cols, regs } = unitsOf(p);
  for (let i = 0; i < n * n; i++) if (v[i] === CROWN) conf[i].forEach((j) => out.add(j));
  for (const u of [...rows, ...cols, ...regs]) if (u.filter((i) => v[i] === CROWN).length >= p.k) u.forEach((i) => out.add(i));
  for (const i of closedCells(p)) out.delete(i);
  return out;
}

/** rows / columns / courts that just got all their crowns, correctly (they flash) */
export function finishedUnits(p: Puzzle, v: number[], cell: number): number[][] {
  const sol = new Set(p.solution), n = p.n;
  const { rows, cols, regs } = unitsOf(p);
  return [rows[Math.floor(cell / n)], cols[cell % n], regs[p.regions[cell]]].filter((u) => {
    const c = u.filter((i) => v[i] === CROWN);
    return c.length === p.k && c.every((i) => sol.has(i));
  });
}

export function isSolved(p: Puzzle, v: number[]): boolean {
  let c = 0;
  for (let i = 0; i < v.length; i++) if (v[i] === CROWN) c++;
  return c === p.solution.length && p.solution.every((i) => v[i] === CROWN);
}

export const crownsPlaced = (p: Puzzle, v: number[]) => v.reduce((s, x, i) => s + (x === CROWN && !p.givens.includes(i) ? 1 : 0), 0);

/** a hint: remove a wrong crown, or place the crown that reasoning reaches next */
export function hint(p: Puzzle, v: number[]): { cell: number; to: number } | null {
  const sol = new Set(p.solution);
  const wrong = v.findIndex((x, i) => x === CROWN && !sol.has(i));
  if (wrong >= 0) return { cell: wrong, to: EMPTY };
  const right = p.solution.filter((i) => v[i] === CROWN);
  const missing = p.solution.filter((i) => v[i] !== CROWN);
  if (!missing.length) return null;
  const st = logic({ ...p, givens: right }, 2).state;
  const next = missing.find((i) => st[i] === 1) ?? missing[0];
  return { cell: next, to: CROWN };
}
