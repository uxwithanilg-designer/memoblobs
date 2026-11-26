// Slide Splash stages. 600 designed stages, then the remix: stage n is built from its number (same maze for everyone).
//
//   • 12 colour worlds × 50 stages (mint, bubblegum, ocean, sunset, lavender, lemon, coral, forest, galaxy, candy, ice,
//     lava), each with its own paint, walls and music.
//   • Hard from stage 3: mazes grow from 5 × 7 to 11 × 15 and are carved by longer walks of slides; spiky mines join at
//     stage 4 and grow in number — a slide into one pops the cube.
//   • Every maze is solvable by construction (engine.ts). The breadth-first solver finds the fewest slides; the move
//     limit is that plus a sliver. Among several candidates the builder keeps the meanest: the most slides needed per
//     painted cell, the most deadly slides on offer, the fewest safe ones.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { carve, floorCount, slide, solve, type Dir, type Maze } from "./engine";

export interface World { id: string; name: string; bg: [string, string]; paint: string; floor: string; wall: string; music: string }
export const WORLDS: World[] = [
  { id: "mint", name: "Mint Garden", bg: ["#d8f8e0", "#a8e8bc"], paint: "#1fb87a", floor: "#c4ccd8", wall: "#ffffff", music: "mint" },
  { id: "gum", name: "Bubblegum", bg: ["#ffe0f0", "#ffb8d8"], paint: "#ff4f9a", floor: "#d0c8d8", wall: "#ffffff", music: "gum" },
  { id: "ocean", name: "Ocean Tiles", bg: ["#d8f0ff", "#a0d4f8"], paint: "#1f8ae0", floor: "#c4ccd8", wall: "#ffffff", music: "ocean" },
  { id: "sunset", name: "Sunset Deck", bg: ["#ffe8d0", "#ffc49a"], paint: "#ff7a2a", floor: "#d0c8c4", wall: "#fffaf4", music: "sunset" },
  { id: "lavender", name: "Lavender Lane", bg: ["#ece0ff", "#cfb8f8"], paint: "#8a4ae0", floor: "#c8c8dc", wall: "#ffffff", music: "lavender" },
  { id: "lemon", name: "Lemon Court", bg: ["#fff8d0", "#ffe88a"], paint: "#e8b400", floor: "#d0ccc4", wall: "#ffffff", music: "lemon" },
  { id: "coral", name: "Coral Bay", bg: ["#ffe4dc", "#ffbcaa"], paint: "#f04a4a", floor: "#d4c8c8", wall: "#ffffff", music: "coral" },
  { id: "forest", name: "Forest Path", bg: ["#e0f0d0", "#b0d890"], paint: "#3a9a2a", floor: "#c8ccc0", wall: "#fbfff4", music: "forest" },
  { id: "galaxy", name: "Galaxy Grid", bg: ["#2a2050", "#120e30"], paint: "#c05aff", floor: "#4a4870", wall: "#dcd8ff", music: "galaxy" },
  { id: "candy", name: "Candy Floor", bg: ["#fff0e0", "#ffd0e8"], paint: "#ff5ad0", floor: "#d8ccd8", wall: "#ffffff", music: "candy" },
  { id: "ice", name: "Ice Rink", bg: ["#e8f8ff", "#c0e8ff"], paint: "#2ac0e0", floor: "#c8d4e0", wall: "#ffffff", music: "ice" },
  { id: "lava", name: "Lava Works", bg: ["#3a1a14", "#1e0c08"], paint: "#ff6a1a", floor: "#5a4440", wall: "#f4e0d8", music: "lava" },
];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; maze: Maze; seed: string; boss: boolean; showcase: boolean; par: number; moves: number; floor: number }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const cols = tutorial ? 5 : Math.min(11, 6 + Math.floor(nd / 70) + big);
  const rows = tutorial ? 7 : Math.min(15, 8 + Math.floor(nd / 55) + big * 2);
  const steps = tutorial ? [3, 5][n - 1] : Math.min(34, 8 + Math.floor(nd / 14) + big * 4);
  const maxLen = Math.max(2, Math.floor(Math.min(cols, rows) / 2));
  const fill = tutorial ? 0.5 : Math.min(0.68, 0.5 + nd / 2000);
  const mines = tutorial || nd < 4 ? 0 : Math.min(9, 1 + Math.floor(nd / 40) + big);
  return { n, nd, pass, boss, showcase, tutorial, cols, rows, steps, maxLen, fill, mines };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `splash:${stage}`;
  const rng = rngFrom(seed);
  let best: { maze: Maze; par: number; score: number } | null = null;
  for (let k = 0, found = 0; k < 120 && found < (p.tutorial ? 1 : 10); k++) {
    const maze = carve(p.cols, p.rows, { steps: p.steps, maxLen: p.maxLen, fill: p.fill, mines: p.mines }, rng);
    if (!maze) continue;
    const floor = floorCount(maze);
    if (floor < (p.tutorial ? 6 : 14)) continue;
    const r = solve(maze, maze.start, new Set([maze.start]), 60000);
    // a capped search keeps the walk itself as the (upper-bound) count
    const par = r.path ? r.path.length : r.capped ? maze.walk.length : -1;
    if (par < 0) continue;
    found++;
    // deadly and wasted slides on offer along the solution
    let deadly = 0, offered = 0, at = maze.start;
    for (const d of (r.path ?? maze.walk) as Dir[]) {
      for (let q = 0 as Dir; q < 4; q = (q + 1) as Dir) { const s = slide(maze, at, q); if (!s.path.length) continue; offered++; if (s.mine) deadly++; }
      at = slide(maze, at, d).end;
    }
    const score = par / Math.sqrt(floor) * 4 + (offered ? deadly / offered : 0) * 6 + par * 0.15;
    if (!best || score > best.score) best = { maze, par, score };
  }
  if (!best) return { ...buildStage(Math.max(1, stage - 1)), stage };
  const slack = p.tutorial ? 4 : p.nd < 40 ? 2 : 1;
  return { stage, maze: best.maze, seed, boss: p.boss, showcase: p.showcase, par: best.par, moves: best.par + slack, floor: floorCount(best.maze) };
}
