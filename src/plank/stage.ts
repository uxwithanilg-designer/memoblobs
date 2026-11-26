// Plank Panic stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 workshops × 50 stages (pine shed, oak mill, toy factory, shipyard, clock tower, treehouse, barn, garage, log
//     cabin, bamboo hut, castle forge, star lab), each with its own woods, board and music.
//   • Boards grow from a 3 × 4 grid of holes with two planks to 6 × 9 grids with a dozen planks stacked in layers;
//     longer planks cover more holes and screws, and fewer free holes are left to work with. Every 25th stage is a
//     big showcase board, every 50th closes the workshop.
//   • The exact solver (engine.ts) proves every stage solvable. Difficulty is measured, not guessed: the builder tries
//     every possible first move and counts how many of them already ruin the board (trap rate), and keeps the
//     candidate whose trap rate and solution length fit the stage — gentle early, mean later.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { apply, cloneState, initial, interior, moves, pt, shortest, solve, xy, type Board, type Plank } from "./engine";

export interface Shop { id: string; name: string; sky: [string, string]; board: string; woods: string[]; glow: string; music: string }
export const SHOPS: Shop[] = [
  { id: "pine", name: "Pine Shed", sky: ["#f6c47a", "#c9783a"], board: "#f3d9a8", woods: ["#c8783a", "#a85a2a", "#e0a050", "#8a4a22"], glow: "#ffd27a", music: "pine" },
  { id: "oak", name: "Oak Mill", sky: ["#e8b070", "#9a5a2a"], board: "#e8c890", woods: ["#9a5a2a", "#7a4218", "#b8783a", "#5e3214"], glow: "#ffc05a", music: "oak" },
  { id: "toy", name: "Toy Factory", sky: ["#ffd0a0", "#e07a5a"], board: "#fbe6c4", woods: ["#e0503a", "#3a8ae0", "#f0b030", "#3ab06a"], glow: "#ff8a6a", music: "toy" },
  { id: "ship", name: "Shipyard", sky: ["#9ad0e8", "#3a7aa8"], board: "#e8d4aa", woods: ["#8a5a32", "#6a4222", "#b07a42", "#4a7aa0"], glow: "#7ad0ff", music: "ship" },
  { id: "clock", name: "Clock Tower", sky: ["#d8b890", "#7a5a3a"], board: "#eedcb8", woods: ["#a8782a", "#c89a3a", "#7a5222", "#5a3a1a"], glow: "#ffd23f", music: "clock" },
  { id: "tree", name: "Treehouse", sky: ["#b8e08a", "#5a9a3a"], board: "#f0dcae", woods: ["#9a6a32", "#7a8a32", "#b88a4a", "#5a6a22"], glow: "#c8ff7a", music: "tree" },
  { id: "barn", name: "Red Barn", sky: ["#f0a888", "#b04a32"], board: "#f2d6b0", woods: ["#b03a2a", "#8a2a1e", "#d0603a", "#6a4a2a"], glow: "#ff9a7a", music: "barn" },
  { id: "garage", name: "Garage", sky: ["#c8d0dc", "#6a7488"], board: "#e6dccc", woods: ["#8a6a4a", "#5a6a7a", "#b08a5a", "#3a4a5a"], glow: "#9ad0ff", music: "garage" },
  { id: "cabin", name: "Log Cabin", sky: ["#e0c8a8", "#6a4a30"], board: "#ead2a8", woods: ["#7a4a22", "#9a6232", "#5a3418", "#b07a42"], glow: "#ffb070", music: "cabin" },
  { id: "bamboo", name: "Bamboo Hut", sky: ["#d8eca0", "#7aa83a"], board: "#f4e6b8", woods: ["#b8b04a", "#8a9a32", "#d0c05a", "#6a7a22"], glow: "#e8ff8a", music: "bamboo" },
  { id: "castle", name: "Castle Forge", sky: ["#c8a8a0", "#5a3a3a"], board: "#e2ccb0", woods: ["#6a4a3a", "#8a6a5a", "#4a3028", "#a0705a"], glow: "#ff8a4a", music: "castle" },
  { id: "star", name: "Star Lab", sky: ["#a8a0e8", "#3a3a8a"], board: "#e4dcf0", woods: ["#7a5ae0", "#4a8ae0", "#e05ab0", "#3ac0b0"], glow: "#c0a8ff", music: "star" },
];
export const STAGES_PER_SHOP = 50;
export const DESIGNED = 600;
export const shopOf = (stage: number) => SHOPS[Math.floor((stage - 1) / STAGES_PER_SHOP) % SHOPS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; board: Board; seed: string; boss: boolean; showcase: boolean; par: number; trap: number; moves: number; time: number }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_SHOP;
  const boss = inG === STAGES_PER_SHOP - 1, showcase = !boss && inG === 24;
  // every level is hard: two warm-up boards, then crowded boards in layers with a single spare hole
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const cols = tutorial ? 3 : Math.min(5, 4 + Math.floor(nd / 120) + big);
  const rows = tutorial ? 4 : Math.min(8, 5 + Math.floor(nd / 90) + big);
  const planks = tutorial ? [2, 3][n - 1] : Math.min(17, 7 + Math.floor(nd / 30) + big * 2);
  const minLen = tutorial ? 1 : 2;
  const maxLen = tutorial ? 2 : Math.min(4, 3 + Math.floor(nd / 150));
  const spare = tutorial ? 2 : 1;
  const under = tutorial ? 0 : nd % 4 === 0 ? 1 : 0;
  const pick = tutorial ? 0 : 1;
  return { n, nd, pass, boss, showcase, tutorial, cols, rows, planks, minLen, maxLen, spare, under, pick };
}

/** a random board in layers: every plank is screwed at both ends into drilled holes not covered by planks below it */
function layout(p: ReturnType<typeof paramsOf>, rng: ReturnType<typeof rngFrom>): Board | null {
  const { cols, rows } = p;
  // planks may end anywhere on the grid; only their end points (and a few spare holes, below) get drilled
  const holes = new Array(cols * rows).fill(true);
  const b: Board = { cols, rows, holes, planks: [], screws: [], pins: [] };
  const used = new Set<string>();
  for (let i = 0; i < p.planks; i++) {
    let placed: Plank | null = null;
    for (let t = 0; t < 60 && !placed; t++) {
      const horiz = rng.next() < 0.5, len = p.minLen + rng.int(p.maxLen - p.minLen + 1);
      if ((horiz && len >= cols) || (!horiz && len >= rows)) continue;
      const ax = rng.int(cols - (horiz ? len : 0)), ay = rng.int(rows - (horiz ? 0 : len));
      const a = pt(b, ax, ay), c = pt(b, ax + (horiz ? len : 0), ay + (horiz ? 0 : len));
      if (!holes[a] || !holes[c] || used.has(`${a}-${c}`)) continue;
      // its screws must not go through the solid middle of a plank below
      if (b.planks.some((q) => interior(b, q.a, q.b).includes(a) || interior(b, q.a, q.b).includes(c))) continue;
      placed = { id: i, a, b: c, len, tint: rng.int(4) };
      used.add(`${a}-${c}`);
    }
    if (!placed) return null;
    b.planks.push(placed);
  }
  // one screw per used end point; it pins every plank ending there
  const ends = [...new Set(b.planks.flatMap((q) => [q.a, q.b]))];
  for (const e of ends) { b.screws.push(e); b.pins.push(b.planks.filter((q) => q.a === e || q.b === e).map((q) => q.id)); }
  // drill: every screw's hole, a few spare holes in the open, and a few hidden under planks (they open up later)
  const covered = new Set(b.planks.flatMap((q) => interior(b, q.a, q.b)));
  const open = holes.map((_, i) => (!ends.includes(i) && !covered.has(i) ? i : -1)).filter((i) => i >= 0);
  const under = [...covered].filter((i) => !ends.includes(i));
  const pickN = (arr: number[], n: number) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const spare = pickN(open, p.spare), hidden = pickN(under, p.under);
  if (spare.length < 1) return null;
  for (let i = 0; i < holes.length; i++) holes[i] = ends.includes(i) || spare.includes(i) || hidden.includes(i);
  return b;
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `plank:${stage}`;
  const rng = rngFrom(seed);
  const cands: { board: Board; par: number; trap: number; extra: number }[] = [];
  for (let k = 0; k < 160 && cands.length < (p.tutorial ? 1 : 16); k++) {
    const board = layout(p, rng);
    if (!board) continue;
    const s0 = initial(board);
    const path = shortest(board, s0, 4000);
    if (!path) continue;
    const sol = { path };
    // trap rate: at a few points along the solution, the share of the moves on offer after which the board can no
    // longer be cleared (traps hide mid-game, not just on the first move)
    let traps = 0, tried = 0;
    const st = cloneState(s0);
    sol.path.forEach((m, i) => {
      if (i % Math.max(1, Math.floor(sol.path!.length / 5)) === 0) {
        const ms = moves(board, st);
        for (let j = 0; j < Math.min(8, ms.length); j++) { const mm = ms[rng.int(ms.length)]; const t = cloneState(st); apply(board, t, mm.from, mm.to); tried++; if (!solve(board, t, 1200).path) traps++; }
      }
      apply(board, st, m.from, m.to);
    });
    cands.push({ board, par: sol.path.length, trap: tried ? traps / tried : 0, extra: sol.path.length - board.screws.length });
  }
  if (!cands.length) return { ...buildStage(Math.max(1, stage - 1)), stage };
  // the meanest board: most moves that ruin it, then most extra 'parking' moves, then the longest solution
  cands.sort((a, b) => (a.trap * 10 + a.extra * 1.2 + a.par * 0.05) - (b.trap * 10 + b.extra * 1.2 + b.par * 0.05));
  const c = cands[Math.min(cands.length - 1, Math.round(p.pick * (cands.length - 1)))];
  // the move limit: the solver's count plus room — roomy early, tight later
  // the move limit: the solver's count plus a sliver of room (a warm-up board gets more)
  const slack = p.tutorial ? 5 : p.nd < 60 ? 2 : 1;
  // and a clock, like a real workshop shift: a few seconds per move needed, a little more on big boards
  const time = Math.round((p.tutorial ? 60 : 20 + c.par * 4.5) * (p.boss || p.showcase ? 1.2 : 1));
  return { stage, board: c.board, seed, boss: p.boss, showcase: p.showcase, par: c.par, trap: c.trap, moves: c.par + slack, time };
}
export { xy };
