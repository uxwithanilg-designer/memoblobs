// Melon Merge Fiesta play state: the jar's marbles (a snapshot — the live jar runs in the board's physics), the drop
// counter, the shot and next marbles, score and best marble. Pure helpers shared by the UI and the dev hooks.
import { cloneBalls, type Ball } from "./physics";
import { nextValue, type StageDef } from "./stage";

export interface Game { balls: Ball[]; seed: string; k: number; cur: number; nxt: number; score: number; dropsLeft: number; best: number }

export function newGame(d: StageDef): Game {
  const top = d.balls.reduce((m, b) => Math.max(m, b.v), 0);
  return { balls: cloneBalls(d.balls), seed: d.seed, k: 2, cur: nextValue(d.seed, 0, top), nxt: nextValue(d.seed, 1, top), score: 0, dropsLeft: d.drops, best: top };
}
/** the shot is dropped: the next marble moves up and a new one joins the queue */
export function take(g: Game, top: number): Game {
  return { ...g, cur: g.nxt, nxt: nextValue(g.seed, g.k, top), k: g.k + 1, dropsLeft: g.dropsLeft - 1 };
}
/** swap the shot and the next marble (a booster) */
export const swapNext = (g: Game): Game => ({ ...g, cur: g.nxt, nxt: g.cur });
export function starsOf(left: number, total: number, helped: boolean) { const f = left / Math.max(1, total); const s = f >= 0.28 ? 3 : f >= 0.1 ? 2 : 1; return helped ? Math.min(2, s) : s; }
export const label = (v: number) => (v >= 1048576 ? `${v / 1048576}M` : v >= 10000 ? `${v / 1024}K` : String(v));
