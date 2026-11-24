// Picnic Pairs play state: the board, the stage's slide rule, score and combo, pairs taken. Pure functions shared by
// the UI and the dev hooks; the board renderer animates the results after the state has already moved on.
import { cloneBoard, isTile, link, moves, settle, shuffle, tilesLeft, type Board, type Gravity } from "./grid";
import type { StageDef } from "./stage";

export interface Game { board: Board; gravity: Gravity; score: number; combo: number; lastAt: number; taken: number; pairs: number }
export interface MatchResult { path: [number, number][]; a: number; b: number; kind: number; moved: Map<number, number>; reshuffled: Map<number, number> | null; gained: number; combo: number; win: boolean }

export const newGame = (d: StageDef): Game => ({ board: cloneBoard(d.board), gravity: d.gravity, score: 0, combo: 0, lastAt: 0, taken: 0, pairs: d.pairs });
export const cloneGame = (g: Game): Game => ({ ...g, board: cloneBoard(g.board) });

/** try to link two cells (indices); null when they don't match or can't be linked */
export function tryMatch(g0: Game, a: number, b: number, now: number, rnd: () => number): { game: Game; res: MatchResult } | null {
  const B = g0.board;
  if (a === b || !isTile(B.c[a]) || B.c[a] !== B.c[b]) return null;
  const path = link(B, a % B.w, Math.floor(a / B.w), b % B.w, Math.floor(b / B.w));
  if (!path) return null;
  const g = cloneGame(g0);
  const kind = g.board.c[a];
  g.board.c[a] = 0; g.board.c[b] = 0;
  const moved = settle(g.board, g.gravity);
  // quick matches in a row build a combo; long links (more turns, longer paths) are worth a little more
  g.combo = now - g.lastAt < 3500 ? g.combo + 1 : 1;
  g.lastAt = now;
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
  const gained = 100 + (path.length - 2) * 20 + Math.min(10, len) * 5 + (g.combo - 1) * 25;
  g.score += gained; g.taken++;
  const win = tilesLeft(g.board) === 0;
  let reshuffled: Map<number, number> | null = null;
  if (!win && !moves(g.board, 1).length) reshuffled = shuffle(g.board, rnd);
  return { game: g, res: { path, a, b, kind, moved, reshuffled, gained, combo: g.combo, win } };
}

/** a pair to suggest */
export function hint(g: Game): [number, number] | null {
  const m = moves(g.board, 1)[0];
  return m ? [m[1] * g.board.w + m[0], m[3] * g.board.w + m[2]] : null;
}

/** the shuffle booster */
export function shuffleGame(g0: Game, rnd: () => number): { game: Game; map: Map<number, number> } {
  const g = cloneGame(g0);
  return { game: g, map: shuffle(g.board, rnd) };
}

export function starsOf(left: number, seconds: number, revived: boolean): number {
  if (revived) return 1;
  const f = left / Math.max(1, seconds);
  return f >= 0.4 ? 3 : f >= 0.18 ? 2 : 1;
}
