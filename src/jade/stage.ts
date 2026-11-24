// Jade Slide stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Stages 1–3 teach tapping and sliding on small boards; from stage 4 it gets tough: boards grow from 5×6 to 8×10,
//     packed fuller (70% → 90% of the cells), fewer copies of each tile, and more and more pairs that can only be lined
//     up by sliding (from about 20% to 75%).
//   • Board shapes from stage 8 (diamond, frame, cross, twin, hourglass, steps…), every 25th stage is a big finale.
//   • Every board is built backwards from the empty board (see grid.ts), so it can always be cleared; the solution is
//     kept for hints. Several candidates are built and the one with the fewest pairs you can tap right away (down to
//     one), the fewest moves overall and the right share of slides is kept — later boards hide their pairs.
//   • After 500 the stages keep coming as remixes that stay hard: shapes mirrored and combined, tiles and themes
//     re-dealt — stage 501 is never stage 1 again.
import { rngFrom } from "../sudoku/rng";
import { allMoves, buildBackwards, type Board, type Step } from "./grid";

export interface House { id: string; name: string; felt: [string, string]; trim: string; music: string }
/** eight tea houses, 25 stages each: the felt, the trim and the music change with them */
export const HOUSES: House[] = [
  { id: "jade", name: "Jade Garden", felt: ["#1f7a4a", "#0f5a34"], trim: "#e8c25a", music: "jade" },
  { id: "lantern", name: "Red Lantern Hall", felt: ["#a8302a", "#6a1a1a"], trim: "#ffd36a", music: "lantern" },
  { id: "porcelain", name: "Blue Porcelain Court", felt: ["#2a5aa8", "#16346a"], trim: "#f0e6c8", music: "porcelain" },
  { id: "bamboo", name: "Bamboo Grove", felt: ["#4a8a2a", "#2a5a1a"], trim: "#e6d28a", music: "bamboo" },
  { id: "gold", name: "Golden Pavilion", felt: ["#8a5a1a", "#5a3a10"], trim: "#ffe08a", music: "gold" },
  { id: "plum", name: "Plum Blossom Terrace", felt: ["#8a3a6a", "#5a1f44"], trim: "#ffd0e6", music: "plum" },
  { id: "moon", name: "Moon Pavilion", felt: ["#2a2a6a", "#14143a"], trim: "#d8d0ff", music: "moon" },
  { id: "ink", name: "Ink Mountains", felt: ["#3a4a4a", "#1f2a2a"], trim: "#e8e0c8", music: "ink" },
];
export const STAGES_PER_HOUSE = 25;
export const DESIGNED = 500;
export const houseOf = (stage: number) => HOUSES[Math.floor((stage - 1) / STAGES_PER_HOUSE) % HOUSES.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);
/** tile kinds: 1–9 dots, 10–18 bamboo, 19–27 characters, 28–31 winds, 32–34 dragons */
export const TILE_KINDS = 34;

export interface StageDef { stage: number; board: Board; solution: Step[]; pairs: number; par: number; boss: boolean; shape: string; seed: string; slides: number }

type Mask = (x: number, y: number, w: number, h: number) => boolean;
const SHAPES: [string, Mask][] = [
  ["full", () => true],
  ["diamond", (x, y, w, h) => Math.abs(x - (w - 1) / 2) / (w / 2) + Math.abs(y - (h - 1) / 2) / (h / 2) <= 1.2],
  ["frame", (x, y, w, h) => x === 0 || y === 0 || x === w - 1 || y === h - 1 || (x > 1 && x < w - 2 && y > 1 && y < h - 2)],
  ["cross", (x, y, w, h) => Math.abs(x - (w - 1) / 2) < w * 0.3 || Math.abs(y - (h - 1) / 2) < h * 0.28],
  ["twin", (x, _y, w) => Math.abs(x - (w - 1) / 2) > 0.6],
  ["hourglass", (x, y, w, h) => Math.abs(x - (w - 1) / 2) <= 0.9 + Math.abs(y - (h - 1) / 2) * (w / h) * 1.1],
  ["steps", (x, y, w, h) => x <= Math.floor(((y + 1) / h) * w) + 1],
  ["holes", (x, y) => !(x % 3 === 1 && y % 3 === 1)],
  ["bowl", (x, y, w, h) => y >= h * 0.3 || x === 0 || x === w - 1],
  ["arch", (x, y, w, h) => (y >= h * 0.4 ? Math.abs(x - (w - 1) / 2) > w * 0.16 : true)],
];

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inS = (n - 1) % STAGES_PER_HOUSE, boss = inS === STAGES_PER_HOUSE - 1;
  const tutorial = n <= 3 && !pass;
  const nd = pass ? Math.max(n, 160 + (n % 120)) : n;
  const w = tutorial ? 4 : Math.min(8, 5 + Math.floor((nd - 4) / 40) + (boss ? 1 : 0) + Math.min(1, pass));
  const h = tutorial ? 5 : Math.min(10, 6 + Math.floor((nd - 4) / 25) + (boss ? 1 : 0) + Math.min(1, pass));
  const fill = tutorial ? 0.55 : Math.min(0.9, 0.7 + nd / 600);        // share of cells holding tiles (the rest = room to slide)
  const share = tutorial ? 0.4 : Math.min(0.95, 0.5 + nd / 300);         // distinct kinds per pair
  const slideShare = n === 1 && !pass ? 0 : tutorial ? 0.4 : Math.min(0.78, 0.22 + nd / 260);
  const spread = tutorial ? 0.3 : Math.min(0.85, 0.4 + nd / 400);
  const hide = tutorial ? 0 : Math.min(0.95, 0.45 + nd / 200);          // how hard the builder works to hide pairs
  const shapeIdx = n < 8 && !pass ? 0 : boss ? 0 : (n * 3 + pass * 7) % SHAPES.length;
  const inSight = tutorial ? 99 : Math.max(1, 1 + 3 * Math.exp(-(nd - 4) / 80));   // pairs you can tap right away at the start
  const perPair = tutorial ? 8 : Math.max(3.2, 6 - 2.8 * Math.min(1, nd / 300));   // seconds per pair for the stars
  return { w, h, fill, share, slideShare, spread, hide, shapeIdx, inSight, perPair, boss, tutorial, pass, n, nd };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  let best: { d: StageDef; score: number } | null = null;
  const tries = p.tutorial ? 3 : 10;
  for (let attempt = 0; attempt < tries * 3 && (!best || attempt < tries); attempt++) {
    const seed = `jade:${stage}:${attempt}`;
    const rng = rngFrom(seed);
    const [shapeName, m0] = SHAPES[p.shapeIdx];
    const mirror = p.pass > 0 && rng.next() < 0.5, other = p.pass > 0 ? SHAPES[rng.int(SHAPES.length)] : null;
    const mask = (x: number, y: number) => { const a = m0(mirror ? p.w - 1 - x : x, y, p.w, p.h); return other ? a || (other[1](x, y, p.w, p.h) && y < p.h / 2) : a; };
    let cellsN = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (mask(x, y)) cellsN++;
    const pairs = Math.max(4, Math.floor((cellsN * p.fill) / 2));
    const kindsN = Math.max(3, Math.min(34, Math.round(pairs * p.share)));
    const kinds = rng.shuffle(Array.from({ length: 34 }, (_, i) => i + 1)).slice(0, kindsN);
    const built = buildBackwards({ w: p.w, h: p.h, mask, pairs, kinds: rng.shuffle(Array.from({ length: pairs }, (_, i) => kinds[i % kinds.length])), slideShare: p.slideShare, spread: p.spread, hide: p.hide, rnd: () => rng.next() });
    if (!built) continue;
    const all = allMoves(built.board, 200);
    const direct = all.filter((m) => !m.drag).length;
    const slides = built.solution.filter((s) => s.drag).length;
    const d: StageDef = { stage, board: built.board, solution: built.solution, pairs, par: Math.round(pairs * p.perPair), boss: p.boss, shape: `${mirror ? "~" : ""}${shapeName}${other ? "+" + other[0] : ""}`, seed, slides };
    const score = p.tutorial ? 0 : Math.max(0, direct - p.inSight) * 1.5 + Math.max(0, all.length - pairs * 1.5) / pairs + Math.abs(slides / pairs - p.slideShare) * 3;
    if (!best || score < best.score) best = { d, score };
    if (p.tutorial || score < 0.6) break;
  }
  if (best) return best.d;
  return buildStage(Math.max(1, stage - 3));
}
