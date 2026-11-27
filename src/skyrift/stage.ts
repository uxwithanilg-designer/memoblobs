// Skyrift Gems stages. 1000 designed stages, then the remix: stage n is built from its number (same for everyone).
//
//   • 20 sky worlds × 50 stages, each with its own sky, island and music. Odd stages are QUESTS (goals in a move
//     limit), even stages are DUELS (you and a rival take turns on one board; the higher score after the moves wins).
//   • Quests bring their goals in step by step: gems of a colour, cracking ice (world 2+), chipping rocks (world 4+),
//     bringing chests down (world 6+), boards with holes (world 3+) and a sixth colour later.
//   • The move limit is tuned by a test player that plays each quest several times from the same start (greedy for the
//     goals, a little random): the limit sits near what it needed, with a small margin that shrinks as you go, so the
//     quests are tight but fair. Duel rivals get sharper world by world.
//   • After 1000 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { clone, emptyTally, fillBoard, moves, play, CHEST, NONE, ROCK, type Board, type Tally } from "./engine";

export interface World { id: string; name: string; sky: [string, string]; isle: string; music: string }
export const WORLDS: World[] = [
  { id: "meadow", name: "Cloud Meadow", sky: ["#8ad8ff", "#4a9ae8"], isle: "#6ad06a", music: "meadow" },
  { id: "sunrise", name: "Sunrise Isle", sky: ["#ffd0a0", "#f08a6a"], isle: "#8ad85a", music: "sunrise" },
  { id: "spire", name: "Crystal Spire", sky: ["#c8e8ff", "#7aa8f0"], isle: "#9ad8ff", music: "spire" },
  { id: "harbor", name: "Wind Harbor", sky: ["#a8f0ff", "#3ab0d8"], isle: "#5ac8a0", music: "harbor" },
  { id: "falls", name: "Rainbow Falls", sky: ["#ffc8f0", "#a08aff"], isle: "#7ad87a", music: "falls" },
  { id: "keep", name: "Moonlit Keep", sky: ["#5a5aa8", "#1e1e4a"], isle: "#7a8ac8", music: "keep" },
  { id: "ember", name: "Ember Peak", sky: ["#ffb07a", "#c0402a"], isle: "#c8a05a", music: "ember" },
  { id: "frost", name: "Frost Atoll", sky: ["#e0f4ff", "#8ac0e8"], isle: "#e8f4ff", music: "frost" },
  { id: "jade", name: "Jade Terrace", sky: ["#b0f0c8", "#3aa878"], isle: "#4ac07a", music: "jade" },
  { id: "coral", name: "Coral Skies", sky: ["#ffc0c0", "#e86a8a"], isle: "#ff9a8a", music: "coral" },
  { id: "storm", name: "Storm Citadel", sky: ["#8a9ab8", "#3a4058"], isle: "#8aa0b0", music: "storm" },
  { id: "lotus", name: "Lotus Bay", sky: ["#ffd8f0", "#c87ad8"], isle: "#e8a0d0", music: "lotus" },
  { id: "amber", name: "Amber Dunes", sky: ["#ffe8a0", "#e8a83a"], isle: "#e8c870", music: "amber" },
  { id: "aurora", name: "Aurora Reach", sky: ["#3a6a8a", "#141e3a"], isle: "#5ad8b0", music: "aurora" },
  { id: "thunder", name: "Thunder Mesa", sky: ["#c8b0ff", "#5a3aa8"], isle: "#b88a5a", music: "thunder" },
  { id: "petal", name: "Petal Grove", sky: ["#fff0f8", "#f0a8c8"], isle: "#9ad87a", music: "petal" },
  { id: "starfall", name: "Starfall Ridge", sky: ["#2a2a6a", "#0c0c28"], isle: "#6a7ae0", music: "starfall" },
  { id: "mist", name: "Mist Hollow", sky: ["#d8e8e8", "#8aa8a8"], isle: "#8ac0a0", music: "mist" },
  { id: "bastion", name: "Golden Bastion", sky: ["#fff0b0", "#e8b83a"], isle: "#f0d070", music: "bastion" },
  { id: "crown", name: "Celestial Crown", sky: ["#d8c8ff", "#6a4ad8"], isle: "#b8a8ff", music: "crown" },
];
export const RIVALS = ["Pip", "Wisp", "Gale", "Nimbus", "Iris", "Luna", "Cinder", "Frosty", "Jinx", "Coralie", "Bolt", "Lotus", "Sandy", "Aura", "Rumble", "Petal", "Nova", "Misty", "Regal", "Zenith"];
/** the six candy gems: pink heart, blue drop, green rounded triangle, yellow ring, purple diamond, orange square */
export const GEM_COLS = ["#ff4a8a", "#2a9aff", "#36d04a", "#ffc31a", "#a23ae8", "#ff7a1a"];
export const GEM_NAMES = ["pink", "blue", "green", "yellow", "purple", "orange"];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 1000;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export type Goal = { k: "gem"; c: number; n: number } | { k: "ice" | "rock" | "chest" | "score"; n: number };
export interface StageDef {
  stage: number; seed: string; kind: "quest" | "duel"; board: Board; goals: Goal[]; moves: number;
  rival: { name: string; skill: number } | null; boss: boolean; showcase: boolean; need: number;
}

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 3 && !pass;
  const nd = pass ? Math.max(n, 500 + (n % 500)) : n;
  const w = Math.floor((n - 1) / STAGES_PER_WORLD);
  const has = (from: number) => pass > 0 || w >= from;
  const duel = n % 2 === 0 && !boss;
  const big = boss || showcase ? 1 : 0;
  return {
    n, nd, pass, boss, showcase, tutorial, duel, big, w,
    cols: Math.min(8, 7 + (nd > 120 ? 1 : 0)), rows: Math.min(9, 8 + (nd > 300 ? 1 : 0)),
    colors: tutorial ? 4 : nd < 40 ? 5 : nd < 400 ? 5 + (nd % 3 === 0 ? 1 : 0) : 6,
    holes: has(2) && !tutorial,
    ice: has(1) ? Math.min(28, 6 + Math.floor(nd / 25) + big * 6) : 0,
    rocks: has(3) ? Math.min(14, 3 + Math.floor(nd / 60) + big * 3) : 0,
    chests: has(5) ? Math.min(4, 2 + Math.floor(nd / 300) + big) : 0,
    // the move limit: the test player's need plus a margin that shrinks from 6 to 1
    slack: tutorial ? 8 : Math.max(2, 6 - Math.floor(nd / 100)),
    duelMoves: Math.min(14, 8 + Math.floor(nd / 150)),
    skill: Math.min(0.96, 0.35 + nd / 900),
  };
}

const SHAPES = [
  (x: number, y: number, w: number, h: number) => !((x === 0 || x === w - 1) && (y === 0 || y === h - 1)),                    // cut corners
  (x: number, y: number, w: number, h: number) => !(y === Math.floor(h / 2) && (x === 0 || x === w - 1)),                       // notched sides
  (x: number, y: number, w: number, h: number) => !(Math.abs(x - (w - 1) / 2) < 1 && Math.abs(y - (h - 1) / 2) < 1),          // hollow middle
  (x: number, y: number, w: number, h: number) => Math.abs(x - (w - 1) / 2) + Math.abs(y - (h - 1) / 2) <= (w + h) / 2 - 1.5,   // diamond-ish
  (x: number, y: number, w: number) => !((x === 0 || x === w - 1) && y % 3 === 1),                                   // castle walls
  () => true,
];

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `skyrift:${stage}`;
  const rng = rngFrom(seed);
  const w = p.cols, h = p.rows;
  const b: Board = {
    w, h, colors: p.colors, mask: new Uint8Array(w * h), c: new Int16Array(w * h).fill(NONE), s: new Uint8Array(w * h),
    ice: new Uint8Array(w * h), hp: new Uint8Array(w * h), id: new Int32Array(w * h).fill(-1), next: 1, seed: (rng.int(1 << 30) + 1) | 0,
  };
  const shape = p.holes && !p.duel ? SHAPES[rng.int(SHAPES.length)] : SHAPES[5];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.mask[y * w + x] = shape(x, y, w, h) ? 1 : 0;
  const cells = [...b.mask.keys()].filter((i) => b.mask[i]);
  const goals: Goal[] = [];
  if (!p.duel) {
    // obstacles for this quest: one or two kinds, more as the worlds go on
    const kinds: ("ice" | "rock" | "chest")[] = [];
    if (p.ice) kinds.push("ice"); if (p.rocks) kinds.push("rock"); if (p.chests) kinds.push("chest");
    for (let i = kinds.length - 1; i > 0; i--) { const j = rng.int(i + 1); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const use = kinds.slice(0, p.boss ? 3 : p.nd > 200 && rng.next() < 0.5 ? 2 : 1);
    if (use.includes("ice")) {
      // ice under cells in the lower part of the board; some double layers later
      let layers = 0;
      const lower = cells.filter((i) => Math.floor(i / w) >= Math.floor(h / 3));
      for (let k = 0; k < p.ice && lower.length; k++) { const i = lower.splice(rng.int(lower.length), 1)[0]; b.ice[i] = p.nd > 150 && rng.next() < 0.35 ? 2 : 1; layers += b.ice[i]; }
      goals.push({ k: "ice", n: layers });
    }
    if (use.includes("rock")) {
      const mid = cells.filter((i) => Math.floor(i / w) >= 2 && !b.ice[i]);
      let n = 0;
      for (let k = 0; k < p.rocks && mid.length; k++) { const i = mid.splice(rng.int(mid.length), 1)[0]; b.c[i] = ROCK; b.hp[i] = p.nd > 250 && rng.next() < 0.4 ? 2 : 1; b.id[i] = b.next++; n++; }
      goals.push({ k: "rock", n });
    }
    if (use.includes("chest")) {
      const top = cells.filter((i) => Math.floor(i / w) >= 2 && Math.floor(i / w) <= Math.floor(h / 2) && !b.ice[i] && b.c[i] === NONE);
      let n = 0;
      for (let k = 0; k < p.chests && top.length; k++) { const i = top.splice(rng.int(top.length), 1)[0]; b.c[i] = CHEST; b.id[i] = b.next++; n++; }
      goals.push({ k: "chest", n });
    }
    // and gems of one or two colours
    const gc = 1 + (p.nd > 60 && rng.next() < 0.5 ? 1 : 0) - (goals.length >= 2 ? 1 : 0);
    const used = new Set<number>();
    for (let k = 0; k < Math.max(goals.length ? 0 : 1, gc); k++) {
      let c = rng.int(p.colors); while (used.has(c)) c = (c + 1) % p.colors; used.add(c);
      goals.push({ k: "gem", c, n: 0 });
    }
  }
  fillBoard(b);
  if (p.duel) {
    return { stage, seed, kind: "duel", board: b, goals: [], moves: p.duelMoves, rival: { name: RIVALS[p.w % RIVALS.length], skill: p.skill }, boss: p.boss, showcase: p.showcase, need: 0 };
  }
  // gem goals scale with the board; then the test player sets the move limit
  const target = (g: Goal) => g.k === "gem" ? Math.round((p.tutorial ? 12 : 16 + p.nd / 25) * (p.colors / 5)) : g.n;
  for (const g of goals) if (g.k === "gem") g.n = Math.min(60, target(g));
  // the test player plays it from several refill streams; quests it finds too long get smaller goals
  const maxNeed = p.tutorial ? 12 : Math.min(48, 22 + Math.floor(p.nd / 40));
  const measure = () => {
    const runs: number[] = [];
    for (let r = 0; r < (p.tutorial ? 2 : 6); r++) { const t = clone(b); t.seed = (b.seed ^ (0x9e3779b1 * (r + 1))) | 0; runs.push(testPlayer(t, goals, 90, 0.15, r + 1)); }
    runs.sort((x, y) => x - y);
    // the 4th of 6: most streams finish inside it
    return runs[Math.min(runs.length - 1, Math.ceil(runs.length * 0.65) - 1)];
  };
  let need = measure();
  for (let tries = 0; need > maxNeed && tries < 5; tries++) {
    for (const g of goals) g.n = g.k === "chest" ? Math.max(1, g.n - 1) : Math.max(g.k === "gem" ? 8 : 1, Math.ceil(g.n * 0.78));
    need = measure();
  }
  return { stage, seed, kind: "quest", board: b, goals, moves: Math.max(10, need + p.slack), rival: null, boss: p.boss, showcase: p.showcase, need };
}

/** how much of the goals a tally has done (0..1 each, averaged) */
export function goalDone(goals: Goal[], t: Tally) {
  return goals.map((g) => Math.min(1, (g.k === "gem" ? t.gems[g.c] : g.k === "ice" ? t.ice : g.k === "rock" ? t.rocks : g.k === "chest" ? t.chests : t.score) / Math.max(1, g.n)));
}
export const addTally = (a: Tally, b: Tally) => { for (let i = 0; i < a.gems.length; i++) a.gems[i] += b.gems[i]; a.ice += b.ice; a.rocks += b.rocks; a.chests += b.chests; a.score += b.score; a.specials += b.specials; };

/** the value of a move's result for the goals (what's still needed counts) */
export function valueOf(goals: Goal[], have: Tally, got: Tally) {
  let v = got.score / 400 + got.specials * 0.6;
  for (const g of goals) {
    const now = g.k === "gem" ? have.gems[g.c] : g.k === "ice" ? have.ice : g.k === "rock" ? have.rocks : g.k === "chest" ? have.chests : have.score;
    const add = g.k === "gem" ? got.gems[g.c] : g.k === "ice" ? got.ice : g.k === "rock" ? got.rocks : g.k === "chest" ? got.chests : got.score;
    const left = Math.max(0, g.n - now);
    v += Math.min(left, add) * (g.k === "gem" ? 1 : g.k === "chest" ? 6 : 3);
  }
  return v;
}
/** a test player: greedy for the goals with a little noise; returns the moves it needed (cap = gave up) */
export function testPlayer(b: Board, goals: Goal[], cap: number, noise: number, salt: number): number {
  const have = emptyTally(b.colors);
  const wantChests = goals.some((g) => g.k === "chest");
  let s = salt * 7919;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let m = 1; m <= cap; m++) {
    const opts = moves(b);
    if (!opts.length) return cap;
    let best: [number, number] = opts[0], bv = -1;
    const sink0 = wantChests ? chestDepth(b) : 0;
    for (const [a, c] of opts) {
      const t = clone(b); const res = play(t, a, c, 12); if (!res) continue;
      // chests: a move that brings them lower is worth something before they land
      const v = (valueOf(goals, have, res.tally) + (wantChests ? (chestDepth(t) - sink0) * 1.2 : 0)) * (1 + (r() - 0.5) * noise * 2);
      if (v > bv) { bv = v; best = [a, c]; }
    }
    const res = play(b, best[0], best[1]); if (!res) return cap;
    addTally(have, res.tally);
    if (goalDone(goals, have).every((x) => x >= 1)) return m;
  }
  return cap;
}

/** how far down the chests are (sum of rows) */
export function chestDepth(b: Board) { let d = 0; for (let i = 0; i < b.c.length; i++) if (b.c[i] === CHEST) d += Math.floor(i / b.w); return d; }

/** the duel rival's move: the best-scoring swap it sees, blurred by its skill */
export function rivalMove(b: Board, skill: number, rnd: () => number): [number, number] | null {
  const opts = moves(b); if (!opts.length) return null;
  let best = opts[0], bv = -1;
  for (const [a, c] of opts) {
    const t = clone(b); const res = play(t, a, c, 12); if (!res) continue;
    const v = (res.tally.score + res.tally.specials * 60) * (1 + (rnd() - 0.5) * (1 - skill) * 2.2);
    if (v > bv) { bv = v; best = [a, c]; }
  }
  return best;
}
