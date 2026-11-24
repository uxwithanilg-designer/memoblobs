// Jade Slide play state: the board, score and combo, pairs taken and the history for undo. Pure functions shared by
// the UI and the dev hooks; the board renderer animates the results.
import { DIRS, allMoves, canPair, cloneBoard, pairAfterSlide, room, shuffleTiles, slide, tilesLeft, type Board, type Step } from "./grid";
import type { StageDef } from "./stage";

export interface Game { board: Board; score: number; combo: number; lastAt: number; taken: number; pairs: number }
export interface MatchResult { a: number; b: number; kind: number; moved: [number, number][]; gained: number; combo: number; win: boolean; stuck: boolean; drag?: Step["drag"] }

export const newGame = (d: StageDef): Game => ({ board: cloneBoard(d.board), score: 0, combo: 0, lastAt: 0, taken: 0, pairs: d.pairs });
export const cloneGame = (g: Game): Game => ({ ...g, board: cloneBoard(g.board) });

function finish(g0: Game, a: number, b: number, moved: [number, number][], now: number, drag?: Step["drag"]): { game: Game; res: MatchResult } {
  const g = g0;
  const kind = g.board.c[a];
  g.board.c[a] = 0; g.board.c[b] = 0;
  g.combo = now - g.lastAt < 4000 ? g.combo + 1 : 1;
  g.lastAt = now;
  const dist = Math.abs((a % g.board.w) - (b % g.board.w)) + Math.abs(Math.floor(a / g.board.w) - Math.floor(b / g.board.w));
  const gained = 100 + (drag ? 50 : 0) + Math.min(6, dist - 1) * 10 + (g.combo - 1) * 25;
  g.score += gained; g.taken++;
  const win = tilesLeft(g.board) === 0;
  return { game: g, res: { a, b, kind, moved, gained, combo: g.combo, win, stuck: !win && !allMoves(g.board, 1).length, drag } };
}

/** tap two tiles */
export function tapPair(g0: Game, a: number, b: number, now: number) {
  if (!canPair(g0.board, a, b)) return null;
  return finish(cloneGame(g0), a, b, [], now);
}
/** drag the tile at `from` k cells in direction d: it pushes the tiles ahead; it must then line up with its twin */
export function dragMove(g0: Game, from: number, d: number, k: number, now: number) {
  if (k < 1 || room(g0.board, from, d) < k) return null;
  const q = pairAfterSlide(g0.board, from, d, k);
  if (q < 0) return null;
  const g = cloneGame(g0);
  const moved = slide(g.board, from, d, k);
  const [dx, dy] = DIRS[d];
  return finish(g, from + (dy * g.board.w + dx) * k, q, moved, now, { from, dir: d, k });
}
export function hint(g: Game): Step | null { return allMoves(g.board, 1)[0] ?? null; }
export function shuffleGame(g0: Game, rnd: () => number) { const g = cloneGame(g0); const map = shuffleTiles(g.board, rnd); return { game: g, map }; }
/** stars by time against the stage's par (no fail clock — just a calm race) */
export function starsOf(seconds: number, par: number, helped: boolean) { const s = seconds <= par ? 3 : seconds <= par * 1.6 ? 2 : 1; return helped ? Math.min(2, s) : s; }
