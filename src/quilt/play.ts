// Laying patches: drawing a rectangle replaces whatever it overlaps, tapping a patch lifts it off, each patch is
// checked against the rules as it goes down, and a hint lays one correct patch.
import { area, cellsOf, edgeKey, sameRect, shapeOf, type Puzzle, type Rect } from "./kinds";

export type PatchState = "good" | "bad" | "open";
export interface Judged { rect: Rect; clue: number; state: PatchState }

const fenceSet = new WeakMap<Puzzle, Set<string>>();
const fences = (p: Puzzle) => { let s = fenceSet.get(p); if (!s) { s = new Set(p.fences); fenceSet.set(p, s); } return s; };
const overlap = (a: Rect, b: Rect) => a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w;
export const rectFrom = (cols: number, a: number, b: number): Rect => {
  const r0 = Math.min(Math.floor(a / cols), Math.floor(b / cols)), r1 = Math.max(Math.floor(a / cols), Math.floor(b / cols));
  const c0 = Math.min(a % cols, b % cols), c1 = Math.max(a % cols, b % cols);
  return { r: r0, c: c0, h: r1 - r0 + 1, w: c1 - c0 + 1 };
};
export const coversGap = (p: Puzzle, x: Rect) => cellsOf(x, p.cols).some((c) => !p.open[c]);

/** lay a patch: anything it overlaps comes off first; laying exactly the same patch again lifts it */
export function lay(patches: Rect[], x: Rect): { patches: Rect[]; removed: number; same: boolean } {
  const same = patches.some((q) => sameRect(q, x));
  if (same) return { patches: patches.filter((q) => !sameRect(q, x)), removed: 1, same: true };
  const keep = patches.filter((q) => !overlap(q, x));
  return { patches: [...keep, x], removed: patches.length - keep.length, same: false };
}
export const lift = (patches: Rect[], cell: number, cols: number) => patches.filter((q) => !cellsOf(q, cols).includes(cell));
export const patchAt = (patches: Rect[], cell: number, cols: number) => patches.find((q) => cellsOf(q, cols).includes(cell));

/** each patch checked on its own: one clue inside, the right size, the kind's shape, no fence crossed */
export function judge(p: Puzzle, patches: Rect[]): Judged[] {
  const f = fences(p);
  return patches.map((x) => {
    const cells = cellsOf(x, p.cols);
    const inside = cells.filter((c) => p.clue[c] !== 0);
    if (inside.length !== 1) return { rect: x, clue: inside[0] ?? -1, state: inside.length ? "bad" : "open" };
    const ci = inside[0], want = p.clue[ci];
    let ok = want < 0 || want === area(x);
    if (p.kind === "squares" && x.h !== x.w) ok = false;
    if (p.kind === "ribbons" && x.h !== 1 && x.w !== 1) ok = false;
    const hint = p.shape?.[ci] ?? 0;
    if (hint && shapeOf(x) !== hint) ok = false;
    for (const c of cells) {
      if ((c % p.cols) < x.c + x.w - 1 && f.has(edgeKey(c, c + 1))) ok = false;
      if (Math.floor(c / p.cols) < x.r + x.h - 1 && f.has(edgeKey(c, c + p.cols))) ok = false;
    }
    return { rect: x, clue: ci, state: ok ? "good" : "bad" };
  });
}

/** No Twins: patches of equal size that touch */
export function twinClash(p: Puzzle, patches: Rect[]): Set<number> {
  const bad = new Set<number>();
  if (p.kind !== "notwins") return bad;
  for (let i = 0; i < patches.length; i++) for (let j = i + 1; j < patches.length; j++) {
    const a = patches[i], b = patches[j];
    if (area(a) !== area(b)) continue;
    const touchV = (a.c + a.w === b.c || b.c + b.w === a.c) && a.r < b.r + b.h && b.r < a.r + a.h;
    const touchH = (a.r + a.h === b.r || b.r + b.h === a.r) && a.c < b.c + b.w && b.c < a.c + a.w;
    if (touchV || touchH) { bad.add(i); bad.add(j); }
  }
  return bad;
}

export function isSolved(p: Puzzle, patches: Rect[]): boolean {
  const covered = new Set<number>();
  for (const x of patches) for (const c of cellsOf(x, p.cols)) covered.add(c);
  if (p.open.some((o, c) => o && !covered.has(c))) return false;
  if (judge(p, patches).some((j) => j.state !== "good")) return false;
  return twinClash(p, patches).size === 0;
}

/** a hint: lay one patch of the answer that isn't down yet (the one with the most wrong patches on it first) */
export function hint(p: Puzzle, patches: Rect[]): { patches: Rect[]; rect: Rect | null } {
  const missing = p.solution.filter((x) => !patches.some((q) => sameRect(q, x)));
  if (!missing.length) return { patches, rect: null };
  missing.sort((a, b) => patches.filter((q) => overlap(q, b)).length - patches.filter((q) => overlap(q, a)).length || area(b) - area(a));
  const x = missing[0];
  return { patches: lay(patches, x).patches, rect: x };
}

/** how much of the board is covered by good patches (the progress bar) */
export function progress(p: Puzzle, patches: Rect[]) {
  const total = p.open.filter(Boolean).length;
  const good = judge(p, patches).filter((j) => j.state === "good").reduce((s, j) => s + area(j.rect), 0);
  return good / total;
}
