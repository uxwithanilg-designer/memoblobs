// Merge Nova play state: the board, the drop counter, the shot and next blocks, score and combo. Pure functions
// shared by the UI and the dev hooks; the board renderer animates the DropResult after the state has moved on.
import { cloneBoard, drop, landingRow, maxTile, COLS, type Board, type DropResult } from "./engine";
import { goalDone, nextValue, type StageDef } from "./stage";

export interface Game { board: Board; seed: string; k: number; cur: number; nxt: number; score: number; dropsLeft: number; best: number; combo: number }
export interface PlayResult { res: DropResult; win: boolean; lose: boolean }

export function newGame(d: StageDef): Game {
  const top = maxTile(d.board);
  return { board: cloneBoard(d.board), seed: d.seed, k: 2, cur: nextValue(d.seed, 0, top), nxt: nextValue(d.seed, 1, top), score: 0, dropsLeft: d.drops, best: top, combo: 0 };
}
export const cloneGame = (g: Game): Game => ({ ...g, board: cloneBoard(g.board) });

export function play(g0: Game, d: StageDef, col: number): { game: Game; out: PlayResult } | null {
  if (landingRow(g0.board, col) < 0) return null;
  const g = cloneGame(g0);
  const res = drop(g.board, col, g.cur);
  if (!res.ok) return null;
  g.score += res.gained;
  g.best = Math.max(g.best, res.best);
  g.combo = res.merges.length ? res.merges[res.merges.length - 1].chain : 0;
  g.dropsLeft--;
  g.cur = g.nxt;
  g.nxt = nextValue(g.seed, g.k++, maxTile(g.board));
  const win = goalDone(d.goal, g.board, g.score);
  let full = true; for (let c = 0; c < COLS; c++) if (landingRow(g.board, c) >= 0) full = false;
  const lose = !win && (g.dropsLeft <= 0 || full);
  return { game: g, out: { res, win, lose } };
}
/** swap the shot and the next block (a booster) */
export const swapNext = (g: Game): Game => ({ ...g, cur: g.nxt, nxt: g.cur });
/** remove one block (the hammer booster); the column settles */
export function hammer(g0: Game, i: number): Game | null {
  if (!g0.board[i]) return null;
  const g = cloneGame(g0); g.board[i] = null;
  const c = i % COLS;
  const col: Board = []; for (let r = 6; r >= 0; r--) { const x = g.board[r * COLS + c]; if (x) col.push(x); }
  for (let r = 6, n = 0; r >= 0; r--, n++) g.board[r * COLS + c] = col[n] ?? null;
  return g;
}
export function starsOf(left: number, total: number, helped: boolean) { const f = left / Math.max(1, total); const s = f >= 0.3 ? 3 : f >= 0.12 ? 2 : 1; return helped ? Math.min(2, s) : s; }
