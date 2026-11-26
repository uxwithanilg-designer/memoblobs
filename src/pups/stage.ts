// Noodle Pups stages. 600 designed stages, then the remix: stage n is built from its number (same yard for everyone).
//
//   • 12 dog parks × 50 stages, each with its own ground pattern, colours and music.
//   • Hard from the start: after a two-yard warm-up, yards are packed with long winding pups, and the builder aims
//     every new pup at the line of a pup that would otherwise be free — only a couple of pups can move at any time and
//     the yard unravels as one long chain, so you have to trace bodies to find the move. Yards grow from 5 × 6 to
//     13 × 18 and take shapes (rounded, diamond, circle, heart, plus, hourglass, ring); rocks and bushes join from
//     stage 6 and grow in number — pups can never pass them. Every 25th stage is a big show yard, every 50th a finale.
//   • Every yard is solvable by construction (see engine.ts); among several candidates the builder keeps the hardest:
//     fewest pups free at the start, then the longest waiting chain.
//   • After 600 the stages keep coming as remixes — new yards, shapes and rocks that stay hard.
import { rngFrom } from "../sudoku/rng";
import { generate, peel, type Board } from "./engine";
import { maskOf, type Shape } from "../unveil/stage";

export interface Park { id: string; name: string; ground: [string, string]; line: string; glow: string; music: string }
export const PARKS: Park[] = [
  { id: "yard", name: "Backyard", ground: ["#fbf6ea", "#f1e8d2"], line: "#e6d9b8", glow: "#ff9a3a", music: "yard" },
  { id: "beach", name: "Sunny Beach", ground: ["#fdf3dc", "#f6e2b6"], line: "#ecd29a", glow: "#3ac8e0", music: "beach" },
  { id: "snow", name: "Snowy Hill", ground: ["#f4f9ff", "#e2eefa"], line: "#cddff2", glow: "#4a9aff", music: "snow" },
  { id: "city", name: "City Park", ground: ["#eef6ea", "#dcecd2"], line: "#c6dcb8", glow: "#4ab060", music: "city" },
  { id: "farm", name: "Farmyard", ground: ["#fbf1e2", "#f0dcc0"], line: "#e2c8a0", glow: "#e0602a", music: "farm" },
  { id: "autumn", name: "Autumn Woods", ground: ["#fbefe2", "#f3dcc4"], line: "#e8c4a0", glow: "#d0502a", music: "autumn" },
  { id: "garden", name: "Flower Garden", ground: ["#fdf0f6", "#f6dcea"], line: "#ecc4da", glow: "#e04a9a", music: "garden" },
  { id: "lake", name: "Lakeside Dock", ground: ["#eaf6f8", "#d4ecf0"], line: "#bcdce4", glow: "#2a9ab0", music: "lake" },
  { id: "desert", name: "Desert Camp", ground: ["#fcf2e0", "#f4e0bc"], line: "#e8cc96", glow: "#d0802a", music: "desert" },
  { id: "rain", name: "Rainy Street", ground: ["#eef0f6", "#dcdfea"], line: "#c6cade", glow: "#5a6aff", music: "rain" },
  { id: "candy", name: "Candy Fair", ground: ["#fff0f4", "#ffdfe8"], line: "#f6c6d4", glow: "#ff5a8a", music: "candy" },
  { id: "night", name: "Starry Camp", ground: ["#2a2e4a", "#22263e"], line: "#363b5e", glow: "#ffd23f", music: "night" },
];
export const STAGES_PER_PARK = 50;
export const DESIGNED = 600;
export const parkOf = (stage: number) => PARKS[Math.floor((stage - 1) / STAGES_PER_PARK) % PARKS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; board: Board; shape: Shape; bones: number; seed: string; boss: boolean; showcase: boolean; free0: number; depth: number }

const SHAPES: [Shape, number][] = [["round", 9], ["diamond", 16], ["circle", 24], ["heart", 33], ["plus", 45], ["hourglass", 60], ["ring", 80]];

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_PARK;
  const boss = inG === STAGES_PER_PARK - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const cols = tutorial ? [4, 5][n - 1] : Math.min(13, 5 + Math.floor(nd / 40) + big);
  const rows = tutorial ? [5, 6][n - 1] : Math.min(18, cols + 2 + Math.floor(nd / 110) + big * 2);
  const maxLen = tutorial ? [4, 5][n - 1] : Math.min(9, 4 + Math.floor(nd / 100) + big);
  const bend = tutorial ? 0.3 : Math.min(0.62, 0.4 + nd / 1500);
  const rocks = tutorial || nd < 6 ? 0 : Math.min(10, 1 + Math.floor(nd / 45) + big);
  const maxOpen = tutorial ? 99 : 3;
  return { n, nd, pass, boss, showcase, tutorial, cols, rows, maxLen, minLen: 2, bend, rocks, maxOpen };
}

function shapeFor(p: ReturnType<typeof paramsOf>, rng: ReturnType<typeof rngFrom>): Shape {
  if (p.tutorial || p.nd < 9) return "rect";
  if (p.boss) return "heart";
  const open = SHAPES.filter(([, at]) => p.nd >= at).map(([s]) => s);
  const fresh = SHAPES.find(([, at]) => at === p.n && !p.pass);
  if (fresh) return fresh[0];
  return rng.next() < 0.4 ? "rect" : open[rng.int(open.length)];
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `pups:${stage}`;
  const rng = rngFrom(seed);
  const shape = shapeFor(p, rng);
  const mask = maskOf(shape, p.cols, p.rows);
  let c: { board: Board; free0: number; depth: number; key: number } | null = null;
  for (let k = 0; k < (p.tutorial ? 3 : 8); k++) {
    const board = generate(p.cols, p.rows, mask, { minLen: p.minLen, maxLen: p.maxLen, bend: p.bend, fill: 1, colors: 8, tangle: p.tutorial ? 0.1 : 1, maxOpen: p.maxOpen, rocks: p.rocks }, rng);
    const { layers, solved } = peel(board);
    if (!solved || board.arrows.length < 3) continue;
    const free0 = layers[0].length, depth = layers.length;
    // the warm-up yards stay gentle (most pups free); every other yard keeps its hardest candidate
    const key = p.tutorial ? free0 : -free0 * 1000 + depth * 10 + board.arrows.length * 0.1;
    if (!c || key > c.key) c = { board, free0, depth, key };
  }
  if (!c) throw new Error("pups: no yard");
  return { stage, board: c.board, shape, bones: 3, seed, boss: p.boss, showcase: p.showcase, free0: c.free0, depth: c.depth };
}
