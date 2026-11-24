// Bubble Breeze play state: the board, the two loaded bubbles (shot and next, swappable), shots left, how much of
// the stage's quest is left, crowns collected, score and combo. Pure functions shared by the UI and the dev hooks; the 3D scene animates the
// results (`ShotResult`) after the state has already moved on.
import { BOMB_SHOT, RAINBOW, cloneGrid, coloursOn, fly, resolve, type Flight, type Grid, type Outcome } from "../sprout/grid";
import { goalLeft, nextColour, type Quest, type StageDef } from "./stage";

export interface Game {
  grid: Grid;
  cur: number;
  nxt: number;
  idx: number;
  seed: string;
  shots: number;
  quest: Quest;
  /** crowns collected */
  crowns: number;
  /** what the quest still asks for (bubbles, crowns or ceiling bubbles) */
  left: number;
  total: number;
  score: number;
  combo: number;
  fired: number;
}
export interface ShotResult { flight: Flight; k: number; out: Outcome | null; gained: number; win: boolean; lose: boolean }

export function newGame(d: StageDef): Game {
  const grid = cloneGrid(d.grid);
  return { grid, cur: nextColour(grid, d.seed, 0), nxt: nextColour(grid, d.seed, 1), idx: 2, seed: d.seed, shots: d.shots, quest: d.quest, crowns: 0, left: d.goal, total: d.goal, score: 0, combo: 0, fired: 0 };
}

export const cloneGame = (g: Game): Game => ({ ...g, grid: cloneGrid(g.grid) });

/** swap the shot and the next bubble */
export function swap(g: Game): Game { return { ...g, cur: g.nxt, nxt: g.cur }; }

/** load a booster into the launcher (it replaces the shot for one throw; the old shot goes back as "next") */
export function loadBooster(g: Game, k: typeof RAINBOW | typeof BOMB_SHOT): Game { return { ...g, nxt: g.cur >= 30 ? g.nxt : g.cur, cur: k }; }

/** fire at an angle (radians from straight up). Returns the new game and what happened, for the scene. */
export function shoot(g0: Game, angle: number): { game: Game; res: ShotResult } {
  const g = cloneGame(g0);
  const flight = fly(g.grid, angle);
  const k = g.cur;
  if (!flight.cell) return { game: g0, res: { flight, k, out: null, gained: 0, win: false, lose: false } };
  const out = resolve(g.grid, flight.cell[0], flight.cell[1], k);
  g.fired++;
  const booster = k >= 30;
  if (!booster) g.shots--;
  const hit = out.popped.length > 0;
  g.combo = hit ? g.combo + 1 : 0;
  const gained = out.popped.length * 10 + out.fallen.length * 20 * (1 + Math.min(4, out.fallen.length >> 2)) + out.freed.length * 250 + (hit ? (g.combo - 1) * 15 : 0);
  g.score += gained;
  g.crowns += out.freed.length;
  g.left = goalLeft(g.grid, g.quest);
  const win = g.left === 0;
  // reload: next becomes the shot; colours that left the board are swapped for ones still there
  const on = coloursOn(g.grid);
  g.cur = g.nxt;
  if (g.cur < 30 && on.length && !on.includes(g.cur)) g.cur = nextColour(g.grid, g.seed, g.idx++);
  g.nxt = nextColour(g.grid, g.seed, g.idx++);
  const lose = !win && (out.lost || g.shots <= 0);
  return { game: g, res: { flight, k, out, gained, win, lose } };
}

/** stars for a cleared stage: by shots left over */
export function starsOf(g: Game, d: StageDef): number {
  const spare = g.shots / Math.max(1, d.shots);
  return spare >= 0.3 ? 3 : spare >= 0.12 ? 2 : 1;
}

/** the bonus for leftover shots (each one bursts as a firework) */
export const leftoverBonus = (g: Game) => g.shots * 50;

/** add rescue shots */
export const addShots = (g: Game, n: number): Game => ({ ...g, shots: g.shots + n });
