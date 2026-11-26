// Slide Splash play state: where the cube is, which floor cells are painted, moves left, the shield and the mines it
// burst (they turn to walls). Pure helpers shared by the UI and the dev hooks.
import { MINE, WALL, floorCount, slide, solve, type Dir, type Maze, type Slide } from "./engine";
import type { Game } from "./save";
import type { StageDef } from "./stage";

export const newGame = (d: StageDef): Game => ({ pos: d.maze.start, painted: [d.maze.start], moves: d.moves, used: 0, helped: false, shield: false, burst: [] });
/** the maze as this game sees it (burst mines are walls now) */
export function liveMaze(m: Maze, g: Game): Maze { if (!g.burst.length) return m; const cells = m.cells.slice(); for (const c of g.burst) cells[c] = WALL; return { ...m, cells }; }

export type Step = { s: Slide; game: Game; win: boolean; dead: boolean; shielded: number; out: boolean };
/** slide the cube; null when it can't move that way */
export function step(d: StageDef, g: Game, dir: Dir): Step | null {
  const m = liveMaze(d.maze, g);
  let s = slide(m, g.pos, dir);
  if (!s.path.length) return null;
  let shielded = -1;
  if (s.mine && g.shield) {
    // the shield bursts the mine: it becomes a wall and the cube stops just before it
    shielded = s.end;
    const m2 = { ...m, cells: m.cells.slice() }; m2.cells[shielded] = WALL;
    s = slide(m2, g.pos, dir);
    if (!s.path.length) return { s, game: { ...g, shield: false, burst: [...g.burst, shielded] }, win: false, dead: false, shielded, out: false };
  }
  const painted = new Set(g.painted);
  if (!s.mine) for (const c of s.path) painted.add(c);
  const game: Game = { ...g, pos: s.end, painted: [...painted], moves: g.moves - 1, used: g.used + 1, shield: shielded >= 0 ? false : g.shield, burst: shielded >= 0 ? [...g.burst, shielded] : g.burst };
  const win = !s.mine && painted.size >= floorCount(d.maze) - g.burst.filter((c) => d.maze.cells[c] !== MINE).length;
  return { s, game, win, dead: s.mine, shielded, out: !win && !s.mine && game.moves <= 0 };
}
/** the next slide of the shortest way to finish from here (or -1) */
export function hintOf(d: StageDef, g: Game): Dir | -1 {
  const r = solve(liveMaze(d.maze, g), g.pos, new Set(g.painted), 60000);
  return r.path?.length ? r.path[0] : -1;
}
export function starsOf(g: Game, par: number) { const s = g.used <= par ? 3 : g.used <= par + 2 ? 2 : 1; return g.helped ? Math.min(2, s) : s; }
