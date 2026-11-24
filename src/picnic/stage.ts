// Picnic Pairs stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Stages 1–3 teach the game on small boards; from stage 4 it gets tough fast. Boards grow from 5×6 to 8×11 and
//     the number of different foods grows faster than the board (fewer copies of each = harder to find).
//   • Slide rules arrive one by one: from stage 6 tiles drop down after a match, then up (12+), left / right (20+),
//     toward the middle (35+) and apart (55+); most stages use one.
//   • Board shapes from stage 8 (diamond, frame, cross, twin, hourglass, steps, rings of holes…), stone blockers from
//     stage 20, and every 25th stage is a big picnic finale.
//   • The clock: seconds per pair shrink steadily (about 3.4 s at stage 4, 2.2 s by 200, 1.9 s by 450).
//   • Difficulty is measured, not guessed: every candidate board is played by a careful test player (it must clear it
//     without a reshuffle) and by several random players. The share of random games that get trapped (no pair left)
//     and how many pairs are in sight at once give a hardness score; the builder keeps the candidate closest to a
//     target that rises stage after stage, so later boards need real planning.
//   • A test player clears every board before you see it (taking pairs, applying the slides); boards it can't clear
//     without a reshuffle are rebuilt. If you ever get stuck the game reshuffles for free, so nothing is unwinnable.
//   • After 500 the stages keep coming as remixes: shapes mirrored and combined, slide rules and food sets re-dealt,
//     a different picnic spot — stage 501 is never stage 1 again.
import { rngFrom, type Rng } from "../sudoku/rng";
import { STONE, cloneBoard, link, moves, settle, shuffle, tilesLeft, type Board, type Gravity } from "./grid";

export interface Spot { id: string; name: string; sky: [string, string, string]; accent: string; music: string }
export const SPOTS: Spot[] = [
  { id: "meadow", name: "Meadow Picnic", sky: ["#bfe9a0", "#e4f7c8", "#fff8e0"], accent: "#3fa34a", music: "meadow" },
  { id: "beach", name: "Beach Basket", sky: ["#8fe0f0", "#d4f4f0", "#fff0c8"], accent: "#1f9ac0", music: "beach" },
  { id: "forest", name: "Forest Feast", sky: ["#7ab87a", "#b8dca0", "#ecf4d4"], accent: "#2f7a3a", music: "forest" },
  { id: "lake", name: "Lakeside Lunch", sky: ["#9ccfff", "#cfe6ff", "#f0f8ff"], accent: "#2f78d0", music: "lake" },
  { id: "orchard", name: "Orchard Snacks", sky: ["#ffd08a", "#ffe8c0", "#fff6e6"], accent: "#e0701a", music: "orchard" },
  { id: "garden", name: "Garden Tea Party", sky: ["#ffc8dc", "#ffe4ee", "#fff6fa"], accent: "#d04a86", music: "garden" },
  { id: "camp", name: "Mountain Camp", sky: ["#a8c0d8", "#d4e0ec", "#f4f0e8"], accent: "#5a6a8a", music: "camp" },
  { id: "lantern", name: "Lantern Night", sky: ["#23264f", "#3a3a7a", "#6a4a8a"], accent: "#ffb347", music: "lantern" },
];
export const STAGES_PER_SPOT = 25;
export const DESIGNED = 500;
export const spotOf = (stage: number) => SPOTS[Math.floor((stage - 1) / STAGES_PER_SPOT) % SPOTS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);
/** how many different foods exist (the UI maps each id to its picture) */
export const FOOD_KINDS = 36;

export interface StageDef {
  stage: number;
  board: Board;
  gravity: Gravity;
  pairs: number;
  kinds: number;
  seconds: number;
  boss: boolean;
  shape: string;
  seed: string;
}

// ------------------------------------------------------------------ shapes (cells inside the board)
type Mask = (x: number, y: number, w: number, h: number) => boolean;
const SHAPES: [string, Mask][] = [
  ["full", () => true],
  ["diamond", (x, y, w, h) => Math.abs(x - (w - 1) / 2) / (w / 2) + Math.abs(y - (h - 1) / 2) / (h / 2) <= 1.15],
  ["frame", (x, y, w, h) => x === 0 || y === 0 || x === w - 1 || y === h - 1 || (x > 1 && x < w - 2 && y > 1 && y < h - 2)],
  ["cross", (x, y, w, h) => Math.abs(x - (w - 1) / 2) < w * 0.3 || Math.abs(y - (h - 1) / 2) < h * 0.25],
  ["twin", (x, _y, w) => Math.abs(x - (w - 1) / 2) > 0.6],
  ["hourglass", (x, y, w, h) => Math.abs(x - (w - 1) / 2) <= 0.6 + Math.abs(y - (h - 1) / 2) * (w / h) * 1.1],
  ["steps", (x, y, w, h) => x <= Math.floor(((y + 1) / h) * w) + 1],
  ["holes", (x, y) => !(x % 3 === 1 && y % 3 === 1)],
  ["bowl", (x, y, w, h) => y >= h * 0.3 || x === 0 || x === w - 1],
  ["heart", (x, y, w, h) => { const u = (x - (w - 1) / 2) / (w / 2) * 1.2, v = ((h - 1) * 0.4 - y) / (h / 2) * 1.3; return (u * u + v * v - 1) ** 3 - u * u * v * v * v <= 0.05; }],
  ["stripes", (_x, y) => y % 3 !== 2],
  ["arch", (x, y, w, h) => y >= h * 0.35 ? Math.abs(x - (w - 1) / 2) > w * 0.18 : true],
];

const GRAVITY_ORDER: Gravity[] = ["none", "down", "up", "left", "right", "midX", "midY", "apart"];
const UNLOCK: Record<Gravity, number> = { none: 1, down: 6, up: 12, left: 20, right: 20, midX: 35, midY: 35, apart: 55 };

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inS = (n - 1) % STAGES_PER_SPOT, boss = inS === STAGES_PER_SPOT - 1;
  const tutorial = n <= 3 && !pass;
  // the difficulty index: remixes after 500 stay hard (they never fall back to the easy start)
  const nd = pass ? Math.max(n, 160 + (n % 120)) : n;
  // size: small for the first three stages, then a quick climb
  const w = tutorial ? 4 : Math.min(8, 5 + Math.floor((nd - 4) / 35) + (boss ? 1 : 0) + Math.min(1, pass));
  const h = tutorial ? 5 : Math.min(11, 6 + Math.floor((nd - 4) / 22) + (boss ? 1 : 0) + Math.min(1, pass));
  // the slide rule: from stage 6 most stages use one of the unlocked rules (a plain board now and then)
  const unlocked = GRAVITY_ORDER.filter((g) => g !== "none" && (UNLOCK[g] <= n || pass > 0));
  const gravity: Gravity = n < 6 && !pass ? "none" : (n + pass * 3) % 6 === 0 || !unlocked.length ? "none" : unlocked[(n * 3 + Math.floor(n / 7) + pass * 5) % unlocked.length];
  const shapeIdx = n < 8 && !pass ? 0 : boss ? 0 : (n * 5 + pass * 7) % SHAPES.length;
  const stones = n >= 20 || pass ? Math.min(7, 1 + Math.floor((nd - 20) / 45) + pass) * (inS % 2 === 0 || boss ? 1 : 0) : 0;
  // distinct foods per pair: more variety = fewer copies of each = harder to spot and to plan
  const share = tutorial ? 0.5 : Math.min(0.97, 0.62 + nd / 260);
  // seconds per pair: tight from stage 4 and tighter as you go
  const perPair = tutorial ? 5 : Math.max(1.9, 3.4 - 1.2 * Math.min(1, (nd - 4) / 196) - 0.3 * Math.min(1, Math.max(0, nd - 200) / 250) - pass * 0.05) + (boss ? 0.25 : 0);
  // the hardness the builder aims for (share of random games that get trapped)
  const target = tutorial ? 0 : Math.min(0.92, 0.25 + 0.55 * (1 - Math.exp(-(nd - 3) / 90)) + pass * 0.04 + (boss ? 0.05 : 0));
  // how many pairs should be linkable at once, on average (fewer = harder to find and to plan)
  const inSight = tutorial ? 9 : Math.max(1.4, 1.4 + 1.8 * Math.exp(-(nd - 4) / 80) - (boss ? 0.15 : 0));
  return { w, h, gravity, shapeIdx, stones: Math.round(stones), share, perPair, boss, pass, n, nd, tutorial, target, inSight };
}

/** random players: how often does a careless player get trapped (no pair left), and how many pairs are in sight */
function hardness(b0: Board, gravity: Gravity, rng: Rng, runs: number): { trap: number; avgMoves: number } {
  let traps = 0, sum = 0, steps = 0;
  for (let r = 0; r < runs; r++) {
    const b = cloneBoard(b0);
    for (;;) {
      if (!tilesLeft(b)) break;
      const ms = moves(b, 30);
      if (!ms.length) { traps++; break; }
      sum += ms.length; steps++;
      const m = ms[rng.int(ms.length)];
      b.c[m[1] * b.w + m[0]] = 0; b.c[m[3] * b.w + m[2]] = 0; settle(b, gravity);
    }
  }
  return { trap: traps / runs, avgMoves: steps ? sum / steps : 0 };
}

/** the test player: take a pair that leaves the most choices next (with a little look at the slides) */
function playTest(b0: Board, gravity: Gravity, rng: Rng): { shuffles: number; avgMoves: number } {
  const b = cloneBoard(b0);
  let shuffles = 0, sumMoves = 0, steps = 0;
  while (tilesLeft(b) > 0) {
    let ms = moves(b, 40);
    if (!ms.length) { shuffles++; if (shuffles > 3) return { shuffles: 99, avgMoves: 0 }; shuffle(b, () => rng.next()); ms = moves(b, 40); if (!ms.length) return { shuffles: 99, avgMoves: 0 }; }
    sumMoves += ms.length; steps++;
    // try a few candidates, keep the one that leaves the most moves after the slide
    let best = ms[0], bestN = -1;
    for (const m of rng.shuffle(ms.slice()).slice(0, 6)) {
      const t = cloneBoard(b);
      t.c[m[1] * t.w + m[0]] = 0; t.c[m[3] * t.w + m[2]] = 0; settle(t, gravity);
      const n = tilesLeft(t) ? moves(t, 12).length : 99;
      if (n > bestN) { bestN = n; best = m; }
    }
    b.c[best[1] * b.w + best[0]] = 0; b.c[best[3] * b.w + best[2]] = 0; settle(b, gravity);
  }
  return { shuffles, avgMoves: steps ? sumMoves / steps : 0 };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  let best: { d: StageDef; score: number } | null = null;
  const tries = p.tutorial ? 3 : p.nd < 60 ? 16 : 12;
  let shareAdj = 0;
  for (let attempt = 0; attempt < tries; attempt++) {
    const seed = `picnic:${stage}:${attempt}`;
    const rng = rngFrom(seed);
    const w = p.w, h = p.h;
    const [shapeName, mask0] = SHAPES[p.shapeIdx];
    const mirror = p.pass > 0 && rng.next() < 0.5;
    const other = p.pass > 0 ? SHAPES[rng.int(SHAPES.length)] : null;
    const mask = (x: number, y: number) => {
      const mx = mirror ? w - 1 - x : x;
      const a = mask0(mx, y, w, h);
      return other ? (a || (other[1](x, y, w, h) && y < h / 2)) : a;
    };
    const c = new Array(w * h).fill(-1);
    const cells: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask(x, y)) { c[y * w + x] = 0; cells.push(y * w + x); }
    // stones on some inner cells
    const inner = rng.shuffle(cells.filter((i) => { const x = i % w, y = Math.floor(i / w); return x > 0 && y > 0 && x < w - 1 && y < h - 1; }));
    for (let k = 0; k < p.stones && k < inner.length; k++) c[inner[k]] = STONE;
    let free = cells.filter((i) => c[i] === 0);
    if (free.length % 2) { c[free[free.length - 1]] = -1; free = free.slice(0, -1); }
    if (free.length < 8) continue;
    const pairs = free.length / 2;
    const kinds = Math.max(4, Math.min(FOOD_KINDS, pairs, Math.round(pairs * Math.min(1, Math.max(0.4, p.share + shareAdj)))));
    // which foods: a fresh pick each stage
    const pool = rng.shuffle(Array.from({ length: FOOD_KINDS }, (_, i) => i + 1)).slice(0, kinds);
    const vals: number[] = [];
    for (let i = 0; i < pairs; i++) { const k = pool[i % kinds]; vals.push(k, k); }
    const order = rng.shuffle(free.slice());
    order.forEach((cell, i) => { c[cell] = vals[i]; });
    const board: Board = { w, h, c };
    // hide the pairs from each other: swap tiles while that lowers the number of pairs in sight, down to the target
    if (!p.tutorial) {
      const goal = Math.max(1, Math.round(p.inSight * 0.85));
      let cur = moves(board, 99).length;
      const iters = pairs > 30 ? 160 : 240;
      for (let it = 0; it < iters && cur > goal; it++) {
        const i = order[rng.int(order.length)], j = order[rng.int(order.length)];
        if (c[i] === c[j]) continue;
        [c[i], c[j]] = [c[j], c[i]];
        const n2 = moves(board, 99).length;
        if (n2 >= 1 && n2 <= cur) cur = n2; else [c[i], c[j]] = [c[j], c[i]];
      }
    }
    if (!moves(board, 1).length) continue;
    const t = playTest(board, p.gravity, rngFrom(seed + ":t"));
    if (t.shuffles >= 99) continue;
    const seconds = Math.round(pairs * p.perPair + (p.tutorial ? 15 : 8));
    const d: StageDef = { stage, board, gravity: p.gravity, pairs, kinds, seconds, boss: p.boss, shape: `${mirror ? "~" : ""}${shapeName}${other ? "+" + other[0] : ""}`, seed };
    // must be clearable by a careful player without reshuffles; then aim the trap rate at the stage's target and
    // prefer fewer pairs in sight
    if (t.shuffles > 0 && !p.tutorial) continue;
    const hd = p.tutorial ? { trap: 0, avgMoves: 0 } : hardness(board, p.gravity, rngFrom(seed + ":h"), pairs > 30 ? 8 : 12);
    const score = t.shuffles * 10 + Math.max(0, hd.avgMoves - p.inSight) + Math.max(0, p.target - hd.trap) * 0.8;
    if (!best || score < best.score) best = { d, score };
    if (p.tutorial) break;
    // steer the next candidates: too easy → more different foods, too hard → fewer
    if (hd.avgMoves > p.inSight + 0.5) shareAdj = Math.min(0.35, shareAdj + 0.08);
    if (score < 0.45 && attempt >= 2) break;
  }
  if (best) return best.d;
  return buildStage(Math.max(1, stage - 7));
}

export { link };
