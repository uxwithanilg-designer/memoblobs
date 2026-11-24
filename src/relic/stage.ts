// Bubble Relics stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Goal: clear every bubble from the temple wall (stones crumble once the bubbles are gone) before the shots run out.
//   • Shapes: 20 pattern families (pyramid, heart, diamond, rings, waves, towers, star, castle, …) cut from the grid.
//   • Colours: 3 → 6 over the first 180 stages, friendly clusters early, finer mosaics later.
//   • Golden relic orbs (a bonus to collect, not needed to win) 1 → 5. Stones from stage 25, crystal-frozen bubbles
//     from 50, bombs from 80; every 25th stage is a chamber guardian (boss).
//   • A test player (greedy, looks at every aim including bounce shots, may swap) clears each stage; the shot budget
//     is what it needed plus room to spare — roomy early, tighter later. A stage it can't clear is rebuilt.
//   • After 500 the stages keep coming as remixes: shapes mirrored and combined with a second shape, colours re-dealt,
//     specials re-scattered, a different chamber — so stage 501 is never stage 1 again.
import { rngFrom, type Rng } from "../sudoku/rng";
import { BOMB, COLS, MAX_ROWS, STONE, coloursOn, cx, floating, fly, get, isColour, resolve, sproutsLeft, width, type Cell, type Grid } from "../sprout/grid";

export interface Realm { id: string; name: string; sky: [string, string, string]; stone: string; glow: string; music: string }
/** eight temple chambers, 25 stages each: the wall colour, the light and the torch flames change with them */
export const REALMS: Realm[] = [
  { id: "jungle", name: "Jungle Gate", sky: ["#123222", "#1f4a2c", "#2f6a34"], stone: "#6f7a5a", glow: "#ffb347", music: "jungle" },
  { id: "torch", name: "Torchlit Hall", sky: ["#1e1430", "#3a2440", "#5a3438"], stone: "#7a6a62", glow: "#ff9a3c", music: "torch" },
  { id: "serpent", name: "Serpent Shrine", sky: ["#0f2a2a", "#164040", "#1f5a4a"], stone: "#5f7a72", glow: "#7dffb0", music: "serpent" },
  { id: "crystal", name: "Crystal Caverns", sky: ["#121a3a", "#1f2a5a", "#2a3f7a"], stone: "#6a7090", glow: "#8fd8ff", music: "crystal" },
  { id: "sunken", name: "Sunken Temple", sky: ["#0a2238", "#0f3550", "#145068"], stone: "#5a7480", glow: "#6ff0ff", music: "sunken" },
  { id: "gold", name: "Golden Vault", sky: ["#2a1a08", "#4a2e10", "#6a4418"], stone: "#9a7a4a", glow: "#ffd23f", music: "gold" },
  { id: "moon", name: "Moon Altar", sky: ["#14122e", "#262050", "#3a2a6a"], stone: "#6a6488", glow: "#d0b8ff", music: "moon" },
  { id: "dragon", name: "Dragon Sanctum", sky: ["#2a0a0a", "#4a1410", "#6a2010"], stone: "#7a5048", glow: "#ff5a2a", music: "dragon" },
];
export const STAGES_PER_REALM = 25;
export const DESIGNED = 500;
export const realmOf = (stage: number) => REALMS[Math.floor((stage - 1) / STAGES_PER_REALM) % REALMS.length];
/** 0 for the designed 500, then 1, 2, … for each remix pass */
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef {
  stage: number;
  grid: Grid;
  colours: number;
  shots: number;
  /** golden relic orbs on the wall (bonus) */
  relics: number;
  /** bubbles to clear */
  bubbles: number;
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

export interface Params { rows: number; colours: number; relics: number; stones: number; ice: number; bombs: number; boss: boolean; layout: "clusters" | "mosaic" | "stripes" | "rings"; slack: number }

export function paramsOf(stage: number): Params {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_REALM, boss = inG === STAGES_PER_REALM - 1;
  const rows = Math.min(10, 4 + Math.floor(n / 30) + (boss ? 1 : 0) + Math.min(1, pass));
  const colours = Math.min(6, (n <= 12 ? 3 : n <= 60 ? 4 : n <= 180 ? 5 : 6) + (pass && n < 180 ? 1 : 0));
  const relics = Math.min(5, 1 + Math.floor(n / 100) + (boss ? 1 : 0));
  const stones = n >= 25 ? Math.min(8, 1 + Math.floor((n - 25) / 45) + pass) * (inG % 3 === 0 || boss ? 1 : 0.5) : 0;
  const ice = n >= 50 ? Math.min(10, 2 + Math.floor((n - 50) / 40) + pass) * (inG % 3 === 1 || boss ? 1 : 0.4) : 0;
  const bombs = n >= 80 ? Math.min(3, 1 + Math.floor((n - 80) / 130)) * (inG % 4 === 2 || boss ? 1 : 0) : 0;
  const mosaicShare = Math.min(0.65, n / 450 + pass * 0.15);
  const pick = (n * 37 + pass * 11) % 10;
  const layout = pick < 1 ? "stripes" : pick < 2 ? "rings" : pick / 10 < mosaicShare + 0.2 ? "mosaic" : "clusters";
  // spare shots: roomy at first, tighter later; guardians a touch tighter
  const slack = Math.max(1.22, 1.7 - 0.45 * Math.min(1, n / 400) - pass * 0.03) - (boss ? 0.05 : 0);
  return { rows, colours, relics, stones: Math.round(stones), ice: Math.round(ice), bombs, boss, layout: n <= 6 ? "clusters" : boss ? (n > 50 ? "mosaic" : "clusters") : layout, slack };
}

/** colour bubbles and bombs still on the wall (stones don't count: they crumble at the end) */
export function bubblesLeft(g: Grid): number {
  let n = 0;
  for (const row of g) for (const x of row) if (x && (isColour(x.k) || x.k === BOMB)) n++;
  return n;
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

/** the test player: tries every aim, takes the shot that drops most, pops most (and grabs relics) */
export function bestShot(g: Grid, k: number, lands = landings(g)): { angle: number; score: number } {
  let best = { angle: 0, score: -1e9 };
  for (const L of lands) {
    const h = g.map((row) => row.map((x) => (x ? { ...x } : null)));
    const o = resolve(h, L.cell[0], L.cell[1], k);
    if (o.lost) continue;
    // also reward building towards a match: same-colour neighbours of the landing cell
    let near = 0;
    if (!o.popped.length) for (let r = L.cell[0] - 1; r <= L.cell[0] + 1; r++) for (let c = L.cell[1] - 1; c <= L.cell[1] + 1; c++) { const x = get(h, r, c); if (x && x.k === k) near++; }
    const score = o.sprouts * 25 + o.fallen.length * 9 + o.popped.length * 4 + near * 2 - L.cell[0] * 0.6 - L.bounces * 0.3;
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
    if (!bubblesLeft(g)) return s;
    cur = k === cur ? nxt : cur; nxt = nextColour(g, seed, idx++);
    if (!coloursOn(g).includes(cur)) cur = nextColour(g, seed, idx++);
  }
  return Infinity;
}

/** how many shots the test player should need: a smooth climb, a wave inside each chamber, a bump on guardians */
export function targetShots(stage: number): number {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1, inG = (n - 1) % STAGES_PER_REALM;
  return 5 + 26 * (1 - Math.exp(-n / 180)) + pass * 2 + (inG / (STAGES_PER_REALM - 1)) * 3 - 1 + (inG === STAGES_PER_REALM - 1 ? 3 : 0);
}

export function buildStage(stage: number, tries = 0): StageDef {
  // a stage that will not build eases off: it borrows the recipe of an earlier stage (but keeps its number)
  const base = tries ? Math.max(1, stage - 15 * tries) : stage;
  const p = paramsOf(base), pass = passOf(base), n = ((base - 1) % DESIGNED) + 1;
  const boss = paramsOf(stage).boss;
  const target = targetShots(base);
  let best: (StageDef & { off: number }) | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = `relics:${stage}:${tries}:${attempt}`;
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
    // golden relics: scattered over the wall (they ride inside ordinary bubbles)
    const used = new Set<number>();
    const relicOrder = rng.shuffle(cells.slice());
    for (let s2 = 0, i = 0; s2 < p.relics && i < relicOrder.length; i++) { const [r, c] = relicOrder[i]; g[r][c]!.sprout = true; used.add(r * 16 + c); s2++; }
    const rest = rng.shuffle(cells.filter(([r, c]) => !used.has(r * 16 + c)));
    let i = 0;
    for (let s2 = 0; s2 < p.stones && i < rest.length; s2++) { const [r, c] = rest[i++]; if (r > 0) g[r][c] = { k: STONE }; }
    for (let s2 = 0; s2 < p.ice && i < rest.length; s2++) { const [r, c] = rest[i++]; g[r][c]!.ice = true; }
    for (let s2 = 0; s2 < p.bombs && i < rest.length; s2++) { const [r, c] = rest[i++]; g[r][c] = { k: BOMB }; }
    const relics = sproutsLeft(g), bubbles = bubblesLeft(g);
    if (!bubbles) continue;
    const need = playTest(g, seed, Math.min(110, Math.ceil(target * 2.3) + 10));
    if (!Number.isFinite(need)) continue;
    const shots = Math.max(need + 3, Math.ceil(need * p.slack) + 2);
    const off = Math.abs(need - target) / target;
    if (!best || off < best.off) best = { stage, grid: g, colours: p.colours, shots, relics, bubbles, boss, pattern: shape.name, seed, botShots: need, off };
    if (off < 0.15 || (off < 0.3 && attempt >= 3)) break;
  }
  if (best) { const { off: _off, ...d } = best; void _off; return d; }
  void pass;
  return buildStage(stage, tries + 1);
}
export { MAX_ROWS };
