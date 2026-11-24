// The Blocktide board: 8×8 cells, each holding a jelly colour (0 = empty) and maybe a pearl (a bonus when its line
// washes away). `ice` (a shell that takes one extra clear) is kept for older saves and the dev hook. Placing a piece fills cells; every full row and column then clears at once.
import { shapeById, type Shape } from "./shapes";

export const N = 8;
export const CELLS = N * N;

export interface Board { color: number[]; pearl: number[]; ice: number[] }

export const emptyBoard = (): Board => ({ color: new Array(CELLS).fill(0), pearl: new Array(CELLS).fill(0), ice: new Array(CELLS).fill(0) });
export const cloneBoard = (b: Board): Board => ({ color: b.color.slice(), pearl: b.pearl.slice(), ice: b.ice.slice() });
export const shapeOf = (id: string): Shape => shapeById.get(id)!;

export function canPlace(b: Board, s: Shape, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r + s.h > N || c + s.w > N) return false;
  for (const [dr, dc] of s.cells) if (b.color[(r + dr) * N + c + dc]) return false;
  return true;
}

export function fitsAnywhere(b: Board, s: Shape): boolean {
  for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) if (canPlace(b, s, r, c)) return true;
  return false;
}

export function positions(b: Board, s: Shape): number[] {
  const o: number[] = [];
  for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) if (canPlace(b, s, r, c)) o.push(r * N + c);
  return o;
}

/** rows / columns that would be full after placing s at (r, c) — for the ghost preview */
export function wouldClear(b: Board, s: Shape, r: number, c: number): { rows: number[]; cols: number[] } {
  const filled = b.color.map((x) => (x ? 1 : 0));
  for (const [dr, dc] of s.cells) filled[(r + dr) * N + c + dc] = 1;
  const rows: number[] = [], cols: number[] = [];
  for (let i = 0; i < N; i++) {
    let fr = true, fc = true;
    for (let j = 0; j < N; j++) { if (!filled[i * N + j]) fr = false; if (!filled[j * N + i]) fc = false; }
    if (fr) rows.push(i);
    if (fc) cols.push(i);
  }
  return { rows, cols };
}

export interface PlaceResult {
  placed: number[];
  rows: number[];
  cols: number[];
  /** cells emptied, with their old colour */
  cleared: { i: number; color: number }[];
  pearls: number[];
  iceBroken: number[];
  allClear: boolean;
}

/** place a piece (mutates b) and clear the full lines */
export function place(b: Board, shapeId: string, color: number, r: number, c: number, pearl?: number): PlaceResult {
  const s = shapeOf(shapeId);
  const placed: number[] = [];
  s.cells.forEach(([dr, dc], k) => { const i = (r + dr) * N + c + dc; b.color[i] = color; if (k === pearl) b.pearl[i] = 1; placed.push(i); });
  const { rows, cols } = wouldClear(b, s, r, c);
  // wouldClear() recomputes with the piece already in, which is fine (cells already set)
  const hit = new Set<number>();
  for (const rr of rows) for (let j = 0; j < N; j++) hit.add(rr * N + j);
  for (const cc of cols) for (let j = 0; j < N; j++) hit.add(j * N + cc);
  const cleared: { i: number; color: number }[] = [], pearls: number[] = [], iceBroken: number[] = [];
  for (const i of hit) {
    if (b.ice[i] > 0) { b.ice[i]--; iceBroken.push(i); continue; }
    cleared.push({ i, color: b.color[i] });
    if (b.pearl[i]) { pearls.push(i); b.pearl[i] = 0; }
    b.color[i] = 0;
  }
  const allClear = (rows.length + cols.length > 0) && b.color.every((x) => !x);
  return { placed, rows, cols, cleared, pearls, iceBroken, allClear };
}

export const fillRatio = (b: Board) => b.color.reduce((s, x) => s + (x ? 1 : 0), 0) / CELLS;

/**
 * can these pieces all be placed, in some order (lines clearing in between)? Visits at most `budget` nodes; a search
 * that runs out of budget counts as yes (only crowded, many-option boards do that, and those are almost always fine).
 */
export function allPlaceable(b: Board, ids: string[], budget = 6000): boolean {
  let nodes = 0;
  const rec = (bd: Board, left: string[]): boolean => {
    if (!left.length) return true;
    const tried = new Set<string>();
    for (let k = 0; k < left.length; k++) {
      if (tried.has(left[k])) continue;
      tried.add(left[k]);
      const s = shapeOf(left[k]), rest = left.filter((_, x) => x !== k);
      for (const p of positions(bd, s)) {
        if (++nodes > budget) return true;
        if (!rest.length) return true;
        const nb = cloneBoard(bd);
        place(nb, left[k], 1, Math.floor(p / N), p % N);
        if (rec(nb, rest)) return true;
      }
    }
    return false;
  };
  return rec(b, ids);
}

/** does placing s anywhere complete at least one line? */
export function canClearWith(b: Board, s: Shape): boolean {
  for (const p of positions(b, s)) { const w = wouldClear(b, s, Math.floor(p / N), p % N); if (w.rows.length + w.cols.length) return true; }
  return false;
}
