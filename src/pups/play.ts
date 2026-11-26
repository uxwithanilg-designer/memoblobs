// Noodle Pups play state: which pups are out, bones left and bumps. Pure helpers shared by the UI and the dev
// hooks; the board renderer animates each move after the state has changed.
import { blocker, occupancy, peel, type Board } from "./engine";
import type { StageDef } from "./stage";

export interface Game { gone: number[]; bones: number; mistakes: number; helped: boolean }
export type Move = { ok: true; game: Game; win: boolean } | { ok: false; game: Game; blockId: number; steps: number; lose: boolean };

export const newGame = (d: StageDef): Game => ({ gone: [], bones: d.bones, mistakes: 0, helped: false });
export const goneSet = (g: Game) => new Set(g.gone);
export const arrowsLeft = (d: StageDef, g: Game) => d.board.arrows.length - g.gone.length;

/** tap arrow `id`: it leaves when the line ahead is clear, otherwise it bumps into the first arrow in the way */
export function move(d: StageDef, g: Game, id: number): Move | null {
  if (g.gone.includes(id) || g.bones <= 0) return null;
  const a = d.board.arrows.find((x) => x.id === id);
  if (!a) return null;
  const occ = occupancy(d.board, goneSet(g));
  const hit = blocker(d.board, a, occ);
  if (!hit) {
    const game = { ...g, gone: [...g.gone, id] };
    return { ok: true, game, win: game.gone.length === d.board.arrows.length };
  }
  const game = { ...g, bones: g.bones - 1, mistakes: g.mistakes + 1 };
  return { ok: false, game, blockId: hit.id, steps: hit.steps, lose: game.bones <= 0 };
}

/** an arrow that can leave right now (the hint) — prefers one that frees others */
export function hintOf(b: Board, g: Game): number {
  const gone = goneSet(g), occ = occupancy(b, gone);
  const free = b.arrows.filter((a) => !gone.has(a.id) && !blocker(b, a, occ));
  if (!free.length) return -1;
  // the free arrow sitting in the most other arrows' way
  let best = free[0], bestN = -1;
  for (const f of free) {
    const n = b.arrows.filter((a) => !gone.has(a.id) && a.id !== f.id && blocker(b, a, occ)?.id === f.id).length;
    if (n > bestN) { bestN = n; best = f; }
  }
  return best.id;
}
/** a treat lures a pup out on the spot, whatever is in its way (the treat booster) */
export const erase = (g: Game, id: number): Game => ({ ...g, gone: g.gone.includes(id) ? g.gone : [...g.gone, id], helped: true });
export function starsOf(g: Game) { const s = g.mistakes === 0 ? 3 : g.mistakes === 1 ? 2 : 1; return g.helped ? Math.min(2, s) : s; }
/** sanity: the board can still be cleared from here (always true — removals only free space) */
export const stillSolvable = (b: Board, g: Game) => peel({ ...b, arrows: b.arrows.filter((a) => !g.gone.includes(a.id)) }).solved;
