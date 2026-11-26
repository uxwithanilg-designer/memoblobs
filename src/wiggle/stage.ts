// Wiggle Way stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 worlds × 50 stages, each with its own colours and music. Boards grow from 7 × 6 to 14 × 10; spikes come in the
//     third world, shrinking plums in the fifth, and later worlds mix it all.
//   • A board is grown from rolling ground with pits, floating ledges, spikes, apples and a portal. The solver (BFS over
//     every worm position) finds the shortest solution; a board is kept only if the portal can't be reached without
//     eating apples (you must grow to cross or climb) and the solution is long enough. Among the boards found the
//     builder keeps the one with the longest solution and the most apples needed.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { settle, solve, EMPTY, GROUND, SPIKE, type Board, type Dir, type Item, type State } from "./engine";

export interface World { id: string; name: string; sky: [string, string]; grass: string; dirt: string; music: string }
export const WORLDS: World[] = [
  { id: "meadow", name: "Sunny Meadow", sky: ["#6ec8ff", "#2a8ae8"], grass: "#5ad04a", dirt: "#a8703a", music: "meadow" },
  { id: "orchard", name: "Apple Orchard", sky: ["#8ad8ff", "#3aa0e8"], grass: "#4ac05a", dirt: "#9a6a3a", music: "orchard" },
  { id: "canyon", name: "Spike Canyon", sky: ["#ffc88a", "#e8783a"], grass: "#c8b04a", dirt: "#b8682a", music: "canyon" },
  { id: "cave", name: "Mossy Cave", sky: ["#5a7a9a", "#2a3a5a"], grass: "#6ad06a", dirt: "#6a5a4a", music: "cave" },
  { id: "plum", name: "Plum Grove", sky: ["#c8a8ff", "#7a5ae0"], grass: "#7ad86a", dirt: "#8a5a4a", music: "plum" },
  { id: "cliffs", name: "Windy Cliffs", sky: ["#9ae0ff", "#4ab0e0"], grass: "#6ad85a", dirt: "#8a7a6a", music: "cliffs" },
  { id: "glen", name: "Mushroom Glen", sky: ["#ffb0d0", "#e05a9a"], grass: "#5ac87a", dirt: "#7a4a5a", music: "glen" },
  { id: "autumn", name: "Autumn Hills", sky: ["#ffd88a", "#f0983a"], grass: "#e0a03a", dirt: "#9a5a2a", music: "autumn" },
  { id: "frost", name: "Frost Peaks", sky: ["#d0f0ff", "#7ab8e8"], grass: "#e8f4ff", dirt: "#7a8aa0", music: "frost" },
  { id: "dunes", name: "Desert Dunes", sky: ["#ffe0a0", "#f0b050"], grass: "#e8c870", dirt: "#c89048", music: "dunes" },
  { id: "night", name: "Night Garden", sky: ["#3a3a7a", "#141436"], grass: "#4ac08a", dirt: "#4a3a5a", music: "night" },
  { id: "candy", name: "Candy Clouds", sky: ["#ffc8f0", "#b07aff"], grass: "#ff8ad0", dirt: "#c87aa0", music: "candy" },
];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; seed: string; board: Board; start: State; path: Dir[]; par: number; needed: number; boss: boolean; showcase: boolean }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 3 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const w = Math.floor((n - 1) / STAGES_PER_WORLD);
  const big = boss || showcase ? 1 : 0;
  const has = (from: number) => pass > 0 || w >= from;
  return {
    n, nd, pass, boss, showcase, tutorial, big,
    w: Math.min(14, 7 + Math.floor(nd / 70) + big * 2),
    h: Math.min(10, 6 + Math.floor(nd / 110) + big),
    apples: tutorial ? 1 : Math.min(5, 2 + Math.floor(nd / 120) + big),
    plums: has(4) ? (nd > 260 ? 2 : 1) : 0,
    spikes: has(2) ? Math.min(6, 2 + Math.floor(nd / 100)) : 0,
    minLen: tutorial ? [4, 6, 8][n - 1] : Math.min(34, 10 + Math.floor(nd / 18) + big * 6),
    start: nd < 40 ? 2 : 3,
  };
}

/** relax: 0 = full rules; when a board refuses, 1 = shorter solutions allowed, 2 = apples optional, 3 = any short puzzle */
export function buildStage(stage: number, relax = 0): StageDef {
  const p = paramsOf(stage);
  if (relax) p.minLen = relax >= 3 ? 4 : Math.max(6, Math.round(p.minLen * (relax === 1 ? 0.7 : 0.5)));
  const seed = `wiggle:${stage}`;
  const rng = rngFrom(relax ? `${seed}:r${relax}` : seed);
  let best: { b: Board; s: State; path: Dir[]; needed: number; score: number } | null = null;
  const t0 = Date.now();
  const budget = relax >= 3 ? 4000 : relax ? 900 : 1600;
  for (let attempt = 0, found = 0; attempt < 500 && found < (p.tutorial ? 1 : 5) && Date.now() - t0 < budget; attempt++) {
    const W = p.w, H = p.h;
    const cells = new Uint8Array(W * H);
    const set = (x: number, y: number, v: number) => { if (x >= 0 && x < W && y >= 0 && y < H) cells[y * W + x] = v; };
    const get = (x: number, y: number) => (x >= 0 && x < W && y >= 0 && y < H ? cells[y * W + x] : GROUND);
    // rolling ground with pits (columns with no ground drop you off the board)
    const top: number[] = [];
    let hgt = rng.int(2);
    for (let x = 0; x < W; x++) {
      if (x > 1 && x < W - 1 && rng.next() < 0.22 && top[x - 1] >= 0) { top.push(-1); continue; }
      hgt = Math.max(0, Math.min(Math.floor(H / 2), hgt + rng.int(3) - 1 + (rng.next() < 0.15 ? 1 : 0)));
      top.push(hgt);
      for (let y = 0; y <= hgt; y++) set(x, y, GROUND);
    }
    // floating ledges and pillars
    const ledges = 1 + rng.int(2 + Math.floor(W / 5));
    for (let i = 0; i < ledges; i++) {
      const lx = rng.int(W), ly = 2 + rng.int(Math.max(1, H - 3)), len = 1 + rng.int(3);
      for (let k = 0; k < len; k++) set(lx + k, ly, GROUND);
    }
    // spikes on some tops and pit floors
    for (let i = 0; i < p.spikes; i++) {
      const x = rng.int(W); const t = top[x];
      if (t >= 0 && t + 1 < H && get(x, t + 1) === EMPTY) set(x, t + 1, SPIKE);
      else if (t < 0) set(x, 0, SPIKE);
    }
    // the worm starts on the left ground, lying flat (head to the right)
    const sx = rng.int(2);
    if (top[sx] < 0 || top[sx + 1] < 0) continue;
    const sy = Math.max(top[sx], top[sx + 1]) + 1;
    if (sy >= H - 1) continue;
    const worm: number[] = [];
    for (let k = 0; k < p.start; k++) { const x = sx + p.start - 1 - k; if (x >= W) break; worm.push(sy * W + x); }
    if (worm.length < p.start || worm.some((c) => cells[c] !== EMPTY)) continue;
    // resting spots (empty cell over something solid) for items and the portal
    const spots: number[] = [];
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (get(x, y) === EMPTY && get(x, y - 1) === GROUND && !worm.includes(y * W + x)) spots.push(y * W + x);
    if (spots.length < p.apples + p.plums + 2) continue;
    for (let i = spots.length - 1; i > 0; i--) { const j = rng.int(i + 1); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    // the portal: far from the start, often up in the air
    const farSpots = spots.filter((c) => c % W >= Math.floor(W / 2));
    let portal = farSpots.length ? farSpots[0] : spots[0];
    if (rng.next() < 0.45) { const up = portal + W * (1 + rng.int(2)); if (up < W * H && cells[up] === EMPTY) portal = up; }
    const items: { at: number; kind: Item }[] = [];
    for (const c of spots) {
      if (items.length >= p.apples + p.plums) break;
      if (c === portal) continue;
      items.push({ at: c, kind: items.length < p.apples ? "apple" : "plum" });
    }
    const b: Board = { w: W, h: H, cells, items, portal };
    const start = settle(b, { worm, eaten: 0 });
    if (start.worm.some((c) => c < 0 || cells[c] === SPIKE)) continue;
    const r = solve(b, start, 25000);
    if (!r.path || r.path.length < p.minLen) continue;
    // apples must matter: without them the portal is out of reach
    const bare: Board = { ...b, items: b.items.filter((it) => it.kind !== "apple") };
    const r0 = solve(bare, { worm: start.worm, eaten: 0 }, 25000);
    if (r0.path && !p.tutorial && relax < 2) continue;
    // how many apples the solution eats
    let needed = 0;
    { let s = start; for (const d of r.path) { const m = moveCount(b, s, d); s = m.s; if (m.ate >= 0 && b.items[m.ate].kind === "apple") needed++; } }
    if (!needed && !p.tutorial && relax < 2) continue;
    found++;
    const score = r.path.length + needed * 4 + r.seen / 4000 + rng.next();
    if (!best || score > best.score) best = { b, s: start, path: r.path, needed, score };
  }
  // (relax 3 always finds one in practice; the very last resort is the first board under this number)
  if (!best) return relax < 3 ? buildStage(stage, relax + 1) : { ...buildStage(1), stage, seed };
  return { stage, seed, board: best.b, start: best.s, path: best.path, par: best.path.length, needed: best.needed, boss: p.boss, showcase: p.showcase };
}
import { move as moveCount } from "./engine";

/** the next move of the stage's own solution while the worm is still on it, else null */
export function plannedMove(d: StageDef, s: { worm: number[]; eaten: number }): Dir | null {
  const key = (q: { worm: number[]; eaten: number }) => `${q.worm.join(",")}|${q.eaten}`;
  const want = key(s);
  let cur = d.start;
  for (let k = 0; k <= d.path.length; k++) {
    if (key(cur) === want) return d.path[k] ?? null;
    if (k < d.path.length) cur = moveCount(d.board, cur, d.path[k]).s;
  }
  return null;
}
