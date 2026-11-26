// Arrow Unveil stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 galleries × 50 stages. Each stage hides a painting from its gallery (sunset beach, mountain lake, flower meadow,
//     night city, desert, northern lights, cherry blossom, coral reef, autumn forest, space, snowy village, balloons),
//     drawn fresh from the stage number, so no two pictures match.
//   • Every stage is hard. Boards start at 6 × 8 and grow to 13 × 18, packed with long winding arrows. The builder
//     makes every new arrow block the line of an arrow that would otherwise be free, so at any moment only one or two
//     arrows can move and the board unravels as one long chain — you have to trace lines to find the move. From stage 8
//     boards take shapes: rounded, diamond, circle, heart, plus, hourglass, ring. Every 25th
//     stage is a big showcase board, every 50th closes the gallery.
//   • Every board is solvable by construction (see engine.ts). Among several candidate boards the builder keeps the one
//     whose difficulty fits the stage: few arrows free at the start and a deep chain of arrows waiting on arrows.
//   • After 600 the stages keep coming as remixes — new boards, shapes and pictures that stay hard.
import { rngFrom } from "../sudoku/rng";
import { generate, peel, type Board } from "./engine";

export interface Gallery { id: string; name: string; sky: [string, string, string]; glow: string; palette: string[]; music: string }
export const GALLERIES: Gallery[] = [
  { id: "sunset", name: "Sunset Beach", sky: ["#2a1030", "#4a1a40", "#7a2a40"], glow: "#ff9a5a", palette: ["#ff6a5a", "#ffb84a", "#ff4f8a", "#5ac8ff", "#7a5cff"], music: "sunset" },
  { id: "lake", name: "Mountain Lake", sky: ["#0a1e30", "#123450", "#1a4a6a"], glow: "#6ad0ff", palette: ["#4aa8ff", "#3ad0a0", "#ffd24a", "#ff7a5a", "#a07aff"], music: "lake" },
  { id: "meadow", name: "Flower Meadow", sky: ["#0e2414", "#163a1e", "#22522a"], glow: "#a8f070", palette: ["#ff5f9a", "#ffd23f", "#7ad04a", "#4ab0ff", "#c07aff"], music: "meadow" },
  { id: "city", name: "Night City", sky: ["#080a20", "#121638", "#1e2252"], glow: "#ff5fd0", palette: ["#ff5fd0", "#4ae0ff", "#ffd23f", "#7a5cff", "#4aff9a"], music: "city" },
  { id: "desert", name: "Desert Dunes", sky: ["#2a1608", "#4a2a10", "#6a3e18"], glow: "#ffc05a", palette: ["#ff8a3a", "#ffd24a", "#4ac0a0", "#e0503a", "#5a8aff"], music: "desert" },
  { id: "aurora", name: "Northern Lights", sky: ["#04141e", "#082a34", "#0e3e44"], glow: "#5affc0", palette: ["#5affc0", "#4ab0ff", "#c07aff", "#ff7ab0", "#ffe27a"], music: "aurora" },
  { id: "blossom", name: "Cherry Blossom", sky: ["#2a0e20", "#441830", "#5e2442"], glow: "#ffa8d0", palette: ["#ff7ab0", "#ffb8d8", "#7ad04a", "#ffd23f", "#8a7aff"], music: "blossom" },
  { id: "reef", name: "Coral Reef", sky: ["#04182a", "#082c44", "#0c4260"], glow: "#4ae8ff", palette: ["#ff7a5a", "#ffd23f", "#4ae8ff", "#ff5fa0", "#6aff8a"], music: "reef" },
  { id: "autumn", name: "Autumn Forest", sky: ["#200e06", "#3a1a0a", "#542810"], glow: "#ff9a3a", palette: ["#ff8a2a", "#e0402a", "#ffd23f", "#8a5a2a", "#4ab070"], music: "autumn" },
  { id: "space", name: "Outer Space", sky: ["#06061a", "#0e0e30", "#18184a"], glow: "#b07aff", palette: ["#b07aff", "#4ab0ff", "#ff7ab0", "#ffd23f", "#5affc0"], music: "space" },
  { id: "village", name: "Snowy Village", sky: ["#0c1624", "#16263a", "#203850"], glow: "#d0f0ff", palette: ["#e04a4a", "#4aa0ff", "#ffd23f", "#4ac080", "#a07aff"], music: "village" },
  { id: "balloon", name: "Balloon Festival", sky: ["#0a1a30", "#14304e", "#204a70"], glow: "#ffd23f", palette: ["#ff5a5a", "#ffd23f", "#4ab0ff", "#7ad04a", "#ff8ad0"], music: "balloon" },
];
export const STAGES_PER_GALLERY = 50;
export const DESIGNED = 600;
export const galleryOf = (stage: number) => GALLERIES[Math.floor((stage - 1) / STAGES_PER_GALLERY) % GALLERIES.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export type Shape = "rect" | "round" | "diamond" | "circle" | "heart" | "plus" | "hourglass" | "ring";
export interface StageDef { stage: number; board: Board; shape: Shape; hearts: number; seed: string; boss: boolean; showcase: boolean; free0: number; depth: number }

const SHAPES: [Shape, number][] = [["round", 8], ["diamond", 14], ["circle", 22], ["heart", 30], ["plus", 40], ["hourglass", 55], ["ring", 75]];

export function maskOf(shape: Shape, cols: number, rows: number): boolean[] {
  const m: boolean[] = [];
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2, rx = cols / 2, ry = rows / 2;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const u = (x - cx) / rx, v = (y - cy) / ry; // −1 … 1
    let ok = true;
    if (shape === "round") ok = !((Math.abs(u) > 0.7 && Math.abs(v) > 0.7) && (Math.abs(u) - 0.7) ** 2 + (Math.abs(v) - 0.7) ** 2 > 0.08);
    else if (shape === "diamond") ok = Math.abs(u) + Math.abs(v) <= 1.12;
    else if (shape === "circle") ok = u * u + v * v <= 1.08;
    else if (shape === "heart") { const X = u * 1.15, Y = -v * 1.2 + 0.15; ok = (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0.05; }
    else if (shape === "plus") ok = Math.abs(u) < 0.42 || Math.abs(v) < 0.42;
    else if (shape === "hourglass") ok = Math.abs(u) <= 0.3 + 0.75 * Math.abs(v);
    else if (shape === "ring") ok = u * u + v * v <= 1.08 && u * u + v * v >= 0.12;
    m.push(ok);
  }
  return m;
}

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_GALLERY;
  const boss = inG === STAGES_PER_GALLERY - 1, showcase = !boss && inG === 24;
  // every stage is hard: the first two are a short warm-up, then boards are big and packed from the start
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const cols = tutorial ? [5, 6][n - 1] : Math.min(13, 6 + Math.floor(nd / 45) + big);
  const rows = tutorial ? [6, 7][n - 1] : Math.min(18, cols + 2 + Math.floor(nd / 120) + big * 2);
  // long, winding arrows that are hard to trace
  const maxLen = tutorial ? [4, 5][n - 1] : Math.min(8, 4 + Math.floor(nd / 120) + big);
  const minLen = 2;
  const bend = tutorial ? 0.3 : Math.min(0.62, 0.38 + nd / 1500);
  const fill = 1;
  const pick = 1;
  const hearts = 3;
  const tangle = 1;
  // how many arrows may be free at the same time while the board is built (fewer = harder to find a move)
  const maxOpen = 3;
  return { n, nd, pass, boss, showcase, tutorial, cols, rows, maxLen, minLen, bend, fill, pick, hearts, tangle, maxOpen };
}

function shapeFor(p: ReturnType<typeof paramsOf>, rng: ReturnType<typeof rngFrom>): Shape {
  if (p.tutorial || p.nd < 8) return "rect";
  if (p.boss) return "heart";
  const open = SHAPES.filter(([, at]) => p.nd >= at).map(([s]) => s);
  const fresh = SHAPES.find(([, at]) => at === p.n && !p.pass);
  if (fresh) return fresh[0];
  return rng.next() < 0.4 ? "rect" : open[rng.int(open.length)];
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `unveil:${stage}`;
  const rng = rngFrom(seed);
  const shape = shapeFor(p, rng);
  const mask = maskOf(shape, p.cols, p.rows);
  // keep the hardest of several candidates: fewest arrows free at the start, then the longest waiting chain, then
  // the most arrows (a packed board)
  let c: { board: Board; free0: number; depth: number; key: number } | null = null;
  for (let k = 0; k < (p.tutorial ? 3 : 8); k++) {
    const board = generate(p.cols, p.rows, mask, { minLen: p.minLen, maxLen: p.maxLen, bend: p.bend, fill: p.fill, colors: 5, tangle: p.tangle, maxOpen: p.maxOpen }, rng);
    const { layers, solved } = peel(board);
    if (!solved || board.arrows.length < 4) continue;
    const free0 = layers[0].length, depth = layers.length;
    const key = -free0 * 1000 + depth * 10 + board.arrows.length * 0.1;
    if (!c || key > c.key) c = { board, free0, depth, key };
  }
  if (!c) throw new Error("unveil: no board");
  return { stage, board: c.board, shape, hearts: p.hearts, seed, boss: p.boss, showcase: p.showcase, free0: c.free0, depth: c.depth };
}
