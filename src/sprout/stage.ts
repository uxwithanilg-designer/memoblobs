// Sproutpop stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Shapes: 20 pattern families (pyramid, heart, diamond, rings, waves, flower, towers, …) cut from the grid.
//   • Colours: 3 → 6 colours over the first 150 stages, laid out as friendly clusters early on and as finer mosaics
//     later; stripes and rings now and then for variety.
//   • Sprouts to free: 3 → 10. Stones from stage 30, ice from 60, bombs from 90; every 25th stage is a garden boss.
//   • A test player (greedy, looks at every aim including one-bounce shots) plays each stage; the shot budget is what
//     it needed plus room to spare — roomy early, tighter later. A stage it can't clear is rebuilt.
//   • After 500 the stages keep coming as remixes: shapes are mirrored and combined with a second shape, colours are
//     re-dealt, specials re-scattered and the garden changes, so stage 501 is not stage 1 again — and never will be.
import { rngFrom, type Rng } from "../sudoku/rng";
import { BOMB, COLS, MAX_ROWS, STONE, coloursOn, cx, floating, fly, get, resolve, sproutsLeft, width, type Cell, type Grid } from "./grid";

export interface Garden { id: string; name: string; sky: [string, string, string]; ground: string; glow: string; music: string }
export const GARDENS: Garden[] = [
  { id: "meadow", name: "Spring Meadow", sky: ["#bfeaff", "#e6f8d0", "#a8e07a"], ground: "#7cc44a", glow: "#ffe066", music: "meadow" },
  { id: "sunflower", name: "Sunflower Fields", sky: ["#ffe9a8", "#ffd36b", "#f5a63a"], ground: "#c98a2a", glow: "#ffd23f", music: "sunflower" },
  { id: "lotus", name: "Lotus Pond", sky: ["#c8f0ff", "#9fe0e8", "#5fc0b8"], ground: "#3f9a8a", glow: "#ff9fd0", music: "lotus" },
  { id: "mushroom", name: "Mushroom Forest", sky: ["#3a5a3a", "#5a7a4a", "#a8c870"], ground: "#4a3a2a", glow: "#ff6f6f", music: "mushroom" },
  { id: "cherry", name: "Cherry Hill", sky: ["#ffe0ec", "#ffc2d8", "#ff9fbf"], ground: "#c86a8a", glow: "#ffffff", music: "cherry" },
  { id: "cactus", name: "Cactus Dunes", sky: ["#ffd8a8", "#ffb07a", "#e87a5a"], ground: "#d89a5a", glow: "#7edc4a", music: "cactus" },
  { id: "lavender", name: "Lavender Valley", sky: ["#e8dcff", "#c8b0ff", "#9a7ae0"], ground: "#7a5ac0", glow: "#fff0a0", music: "lavender" },
  { id: "moonflower", name: "Moonflower Night", sky: ["#141a46", "#2a2a7a", "#5a3a9a"], ground: "#1a2a4a", glow: "#a8f0ff", music: "moonflower" },
];
export const STAGES_PER_GARDEN = 25;
export const DESIGNED = 500;
export const gardenOf = (stage: number) => GARDENS[Math.floor((stage - 1) / STAGES_PER_GARDEN) % GARDENS.length];
/** 0 for the designed 500, then 1, 2, … for each remix pass */
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef {
  stage: number;
  grid: Grid;
  colours: number;
  shots: number;
  sprouts: number;
  boss: boolean;
  pattern: string;
  seed: string;
  /** shots the test player needed */
  botShots: number;
}

// ------------------------------------------------------------------ shapes

type Shape = (u: number, v: number, r: number, c: number) => boolean;
/** u: −1 … 1 across, v: 0 … 1 down the stage's rows */
const SHAPES: [string, Shape][] = [
  ["full", () => true],
  ["pyramid", (u, v) => Math.abs(u) <= 1.05 - v],
  ["triangle", (u, v) => Math.abs(u) <= v + 0.12],
  ["diamond", (u, v) => Math.abs(u) + Math.abs(2 * v - 1) <= 1.05],
  ["heart", (u, v) => { const x = u * 1.15, y = (0.62 - v) * 2.2; return (x * x + y * y - 1) ** 3 - x * x * y * y * y <= 0; }],
  ["ring", (u, v) => { const d = Math.hypot(u, 2 * v - 1); return d < 1.05 && d > 0.42; }],
  ["disc", (u, v) => Math.hypot(u, 2 * v - 1) < 1.02],
  ["columns", (_u, _v, _r, c) => c % 3 !== 1],
  ["bands", (_u, _v, r) => r % 3 !== 2],
  ["checker", (_u, _v, r, c) => (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0],
  ["waves", (u, v) => v <= 0.58 + 0.32 * Math.sin(u * Math.PI * 1.5)],
  ["valley", (u, v) => v <= Math.abs(u) * 0.85 + 0.28],
  ["hourglass", (u, v) => Math.abs(u) >= Math.abs(2 * v - 1) - 0.08],
  ["cross", (u, v) => Math.abs(u) < 0.32 || Math.abs(2 * v - 1) < 0.3],
  ["arch", (u, v) => { const d = Math.hypot(u, v * 1.6); return d < 1.08 && d > 0.5; }],
  ["towers", (u) => Math.abs(u) > 0.42],
  ["flower", (u, v) => { const x = u, y = 2 * v - 1, a = Math.atan2(y, x); return Math.hypot(x, y) < 0.62 + 0.38 * Math.cos(5 * a); }],
  ["bowl", (u, v) => v >= 0.55 * u * u - 0.05],
  ["star", (u, v) => { const x = u, y = 2 * v - 1, a = Math.atan2(y, x); return Math.hypot(x, y) < 0.55 + 0.45 * Math.abs(Math.cos(2.5 * a)); }],
  ["castle", (u, v, _r, c) => v > 0.22 || c % 2 === 0],
];

// ------------------------------------------------------------------ the curve

export interface Params { rows: number; colours: number; sprouts: number; stones: number; ice: number; bombs: number; boss: boolean; layout: "clusters" | "mosaic" | "stripes" | "rings"; slack: number }

export function paramsOf(stage: number): Params {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_GARDEN, boss = inG === STAGES_PER_GARDEN - 1;
  const rows = Math.min(11, 5 + Math.floor(n / 25) + (boss ? 1 : 0) + Math.min(1, pass));
  const colours = Math.min(6, (n <= 10 ? 3 : n <= 50 ? 4 : n <= 150 ? 5 : 6) + (pass && n < 150 ? 1 : 0));
  const sprouts = Math.min(10, 3 + Math.floor(n / 45) + (boss ? 1 : 0));
  const stones = n >= 30 ? Math.min(10, 1 + Math.floor((n - 30) / 40) + pass) * (inG % 3 === 0 || boss ? 1 : 0.5) : 0;
  const ice = n >= 60 ? Math.min(12, 2 + Math.floor((n - 60) / 35) + pass) * (inG % 3 === 1 || boss ? 1 : 0.4) : 0;
  const bombs = n >= 90 ? Math.min(3, 1 + Math.floor((n - 90) / 120)) * (inG % 4 === 2 || boss ? 1 : 0) : 0;
  const mosaicShare = Math.min(0.7, n / 400 + pass * 0.15);
  const pick = (n * 37 + pass * 11) % 10;
  const layout = pick < 1 ? "stripes" : pick < 2 ? "rings" : pick / 10 < mosaicShare + 0.2 ? "mosaic" : "clusters";
  // spare shots: roomy at first, tighter later; bosses a touch tighter
  const slack = Math.max(1.18, 1.65 - 0.45 * Math.min(1, n / 400) - pass * 0.03) - (boss ? 0.06 : 0);
  return { rows, colours, sprouts, stones: Math.round(stones), ice: Math.round(ice), bombs, boss, layout: n <= 6 ? "clusters" : boss ? (n > 50 ? "mosaic" : "clusters") : layout, slack };
}

// ------------------------------------------------------------------ building

function shapeFor(stage: number, rng: Rng): { name: string; fn: Shape } {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  // the first stages use the friendliest shapes, then every family takes turns
  const base = n <= 5 ? SHAPES[[0, 1, 6, 2, 3][n - 1]] : SHAPES[(n * 7 + Math.floor(n / 20)) % SHAPES.length];
  if (!pass) return { name: base[0], fn: base[1] };
  // remix: mirror and combine with a second shape
  const other = SHAPES[rng.int(SHAPES.length)];
  const mirror = rng.next() < 0.5, mode = rng.int(3);
  const f: Shape = (u, v, r, c) => {
    const a = base[1](mirror ? -u : u, v, r, c), b = other[1](u, 1 - v, r, c);
    return mode === 0 ? a || (b && v < 0.5) : mode === 1 ? a && !(!b && v > 0.6) : a !== b || v < 0.2;
  };
  return { name: `${base[0]}+${other[0]}`, fn: f };
}

function dealColours(g: Grid, p: Params, rng: Rng, palette: number[]) {
  const cells: [number, number][] = [];
  g.forEach((row, r) => row.forEach((x, c) => { if (x) cells.push([r, c]); }));
  const pickC = () => palette[rng.int(p.colours)];
  if (p.layout === "stripes") { const dir = rng.int(2); for (const [r, c] of cells) g[r][c]!.k = palette[(dir ? Math.floor(r / 2) : Math.floor(c / 2)) % p.colours]; }
  else if (p.layout === "rings") { for (const [r, c] of cells) g[r][c]!.k = palette[Math.floor(Math.hypot(cx(r, c) - COLS, r * 1.7) / 3) % p.colours]; }
  else if (p.layout === "mosaic") { for (const [r, c] of cells) g[r][c]!.k = pickC(); }
  else {
    // clusters: grow blobs of 3–6 from random seeds
    const left = new Set(cells.map(([r, c]) => r * 16 + c));
    while (left.size) {
      const start = [...left][rng.int(left.size)], k = pickC(), size = 3 + rng.int(4);
      const q = [start];
      let n = 0;
      while (q.length && n < size) {
        const id = q.splice(rng.int(q.length), 1)[0];
        if (!left.has(id)) continue;
        left.delete(id); n++;
        const r = Math.floor(id / 16), c = id % 16;
        g[r][c]!.k = k;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const nid = (r + dr) * 16 + c + dc; if (left.has(nid)) q.push(nid); }
      }
    }
  }
}

/** the launcher's next colour: one of the colours on the board, from the stage's own sequence */
export function nextColour(g: Grid, seed: string, index: number): number {
  const cs = coloursOn(g);
  if (!cs.length) return 1;
  const r = rngFrom(`${seed}:q:${index}`).next();
  return cs[Math.floor(r * cs.length)];
}

/** the distinct landing cells across a fan of aims (a flight doesn't depend on the colour, so share them) */
export function landings(g: Grid): { angle: number; cell: [number, number]; bounces: number }[] {
  const out: { angle: number; cell: [number, number]; bounces: number }[] = [];
  const tried = new Set<number>();
  for (let i = 0; i <= 64; i++) {
    const a = -1.36 + (2.72 * i) / 64;
    const f = fly(g, a);
    if (!f.cell) continue;
    const id = f.cell[0] * 16 + f.cell[1];
    if (tried.has(id)) continue;
    tried.add(id);
    out.push({ angle: a, cell: f.cell, bounces: f.bounces });
  }
  return out;
}

/** the test player: tries every aim, takes the shot that frees most sprouts, drops most, pops most */
export function bestShot(g: Grid, k: number, lands = landings(g)): { angle: number; score: number } {
  let best = { angle: 0, score: -1e9 };
  for (const L of lands) {
    const h = g.map((row) => row.map((x) => (x ? { ...x } : null)));
    const o = resolve(h, L.cell[0], L.cell[1], k);
    if (o.lost) continue;
    // also reward building towards a match: same-colour neighbours of the landing cell
    let near = 0;
    if (!o.popped.length) for (let r = L.cell[0] - 1; r <= L.cell[0] + 1; r++) for (let c = L.cell[1] - 1; c <= L.cell[1] + 1; c++) { const x = get(h, r, c); if (x && x.k === k) near++; }
    const score = o.sprouts * 120 + o.fallen.length * 9 + o.popped.length * 4 + near * 2 - L.cell[0] * 0.6 - L.bounces * 0.3;
    if (score > best.score) best = { angle: L.angle, score };
  }
  return best;
}

function playTest(g0: Grid, seed: string, cap: number): number {
  const g = g0.map((row) => row.map((x) => (x ? { ...x } : null)));
  let cur = nextColour(g, seed, 0), nxt = nextColour(g, seed, 1), idx = 2;
  for (let s = 1; s <= cap; s++) {
    // the player may swap the two loaded bubbles
    const lands = landings(g);
    const a = bestShot(g, cur, lands), b = bestShot(g, nxt, lands);
    let k = cur;
    if (b.score > a.score + 20) { k = nxt; nxt = cur; }
    const shot = k === cur ? a : b;
    const f = fly(g, shot.angle);
    if (!f.cell) return Infinity;
    const o = resolve(g, f.cell[0], f.cell[1], k);
    if (o.lost) return Infinity;
    if (!sproutsLeft(g)) return s;
    cur = k === cur ? nxt : cur; nxt = nextColour(g, seed, idx++);
    if (!coloursOn(g).includes(cur)) cur = nextColour(g, seed, idx++);
  }
  return Infinity;
}

/** how many shots the test player should need: a smooth climb, a wave inside each garden, a bump on bosses */
export function targetShots(stage: number): number {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1, inG = (n - 1) % STAGES_PER_GARDEN;
  return 3 + 24 * (1 - Math.exp(-n / 170)) + pass * 2 + (inG / (STAGES_PER_GARDEN - 1)) * 3 - 1 + (inG === STAGES_PER_GARDEN - 1 ? 3 : 0);
}

export function buildStage(stage: number, tries = 0): StageDef {
  // a stage that will not build eases off: it borrows the recipe of an earlier stage (but keeps its number)
  const base = tries ? Math.max(1, stage - 15 * tries) : stage;
  const p = paramsOf(base), pass = passOf(base), n = ((base - 1) % DESIGNED) + 1;
  const boss = paramsOf(stage).boss;
  const target = targetShots(base);
  let best: (StageDef & { off: number }) | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const seed = `sproutpop:${stage}:${tries}:${attempt}`;
    const rng = rngFrom(seed);
    const shape = shapeFor(stage, rng);
    const rows = p.rows;
    const g: Grid = [];
    for (let r = 0; r < rows; r++) {
      const row: (Cell | null)[] = [];
      for (let c = 0; c < width(r); c++) {
        const u = (cx(r, c) - COLS) / (COLS - 1), v = rows > 1 ? r / (rows - 1) : 0;
        row.push(shape.fn(u, v, r, c) ? { k: 1 } : null);
      }
      g.push(row);
    }
    if (!g[0].some(Boolean)) g[0] = g[0].map((_, c) => (c % 2 === 0 ? { k: 1 } : null));
    for (const [r, c] of floating(g)) g[r][c] = null;
    const count = g.reduce((s2, row) => s2 + row.filter(Boolean).length, 0);
    if (count < 12) continue;
    const palette = rng.shuffle([1, 2, 3, 4, 5, 6]);
    // too easy so far: switch the colour layout to a busier one
    const lay = best && best.botShots < target * 0.7 && attempt >= 3 ? (n > 40 ? "mosaic" : "clusters") : p.layout;
    dealColours(g, { ...p, layout: lay }, rng, palette);
    const cells: [number, number][] = [];
    g.forEach((row, r) => row.forEach((x, c) => { if (x) cells.push([r, c]); }));
    // sprouts: low and easy to drop at first, then more and more of them up near the ceiling where you must dig
    const high = Math.min(0.85, n / 220 + pass * 0.2);
    const depth = (r: number) => r / Math.max(1, g.length - 1);
    const sproutOrder = rng.shuffle(cells.slice()).sort((a, b) => (rng.next() < high ? depth(a[0]) - depth(b[0]) : depth(b[0]) - depth(a[0])) + (rng.next() - 0.5) * 0.6);
    const used = new Set<number>();
    for (let s2 = 0, i = 0; s2 < p.sprouts && i < sproutOrder.length; i++) { const [r, c] = sproutOrder[i]; if (used.has(r * 16 + c)) continue; g[r][c]!.sprout = true; used.add(r * 16 + c); s2++; }
    const rest = rng.shuffle(cells.filter(([r, c]) => !used.has(r * 16 + c)));
    let i = 0;
    for (let s2 = 0; s2 < p.stones && i < rest.length; s2++) { const [r, c] = rest[i++]; if (r > 0) g[r][c] = { k: STONE }; }
    for (let s2 = 0; s2 < p.ice && i < rest.length; s2++) { const [r, c] = rest[i++]; g[r][c]!.ice = true; }
    for (let s2 = 0; s2 < p.bombs && i < rest.length; s2++) { const [r, c] = rest[i++]; g[r][c] = { k: BOMB }; }
    const sprouts = sproutsLeft(g);
    if (!sprouts) continue;
    const need = playTest(g, seed, Math.min(90, Math.ceil(target * 2.2) + 8));
    if (!Number.isFinite(need)) continue;
    const shots = Math.max(need + 3, Math.ceil(need * p.slack) + 2);
    const off = Math.abs(need - target) / target;
    if (!best || off < best.off) best = { stage, grid: g, colours: p.colours, shots, sprouts, boss, pattern: shape.name, seed, botShots: need, off };
    if (off < 0.15 || (off < 0.3 && attempt >= 3)) break;
  }
  if (best) { const { off: _off, ...d } = best; void _off; return d; }
  void pass;
  return buildStage(stage, tries + 1);
}
export { MAX_ROWS };
