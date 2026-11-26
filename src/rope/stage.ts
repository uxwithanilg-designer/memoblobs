// Rope Loop stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 worlds × 50 stages (sail loft, knit shop, circus rigging, climbing gym, fishing pier, craft table, toy box,
//     bead market, ribbon studio, lantern fest, snow lodge, neon night), each with its own backdrop and music.
//   • Hard early: after two warm-up boards, colours climb from 5 to 12, spools grow from 4 to 6 coils high, and only one
//     spare (empty) spool is left from stage 10 (boards up to 9 colours). Hidden "?" coils join at stage 6 and grow to
//     most of the pile. A move limit (the solver's count plus ~15%) keeps every move honest.
//   • The solver (engine.ts) proves every board solvable. Among several shuffles the builder keeps the meanest: the most
//     first moves that already lead into a dead end, then the longest solution.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { apply, moves, solve, type Board, type Move, type Spool } from "./engine";

export interface World { id: string; name: string; bg: [string, string]; spool: string; core: string; music: string }
export const WORLDS: World[] = [
  { id: "sail", name: "Sail Loft", bg: ["#eef2f6", "#d4dde8"], spool: "#ffffff", core: "#cfe4f6", music: "sail" },
  { id: "knit", name: "Knit Shop", bg: ["#f8eee6", "#ead6c6"], spool: "#fffaf4", core: "#e8d2bc", music: "knit" },
  { id: "circus", name: "Circus Rigging", bg: ["#fbe8e8", "#efcaca"], spool: "#ffffff", core: "#f4d0d0", music: "circus" },
  { id: "gym", name: "Climbing Gym", bg: ["#eaf0e2", "#d2dec4"], spool: "#ffffff", core: "#d4e6c4", music: "gym" },
  { id: "pier", name: "Fishing Pier", bg: ["#e4eef2", "#c6d8e2"], spool: "#fbfdff", core: "#c4dce8", music: "pier" },
  { id: "craft", name: "Craft Table", bg: ["#f6f0e2", "#e6dabc"], spool: "#fffdf6", core: "#eadfbc", music: "craft" },
  { id: "toy", name: "Toy Box", bg: ["#eee8f8", "#d8cdf0"], spool: "#ffffff", core: "#ddd2f6", music: "toy" },
  { id: "bead", name: "Bead Market", bg: ["#f8ecf2", "#ecd0de"], spool: "#ffffff", core: "#f2d4e2", music: "bead" },
  { id: "ribbon", name: "Ribbon Studio", bg: ["#fff0f4", "#f6d6e0"], spool: "#ffffff", core: "#f8d8e4", music: "ribbon" },
  { id: "lantern", name: "Lantern Fest", bg: ["#2e2430", "#1c1620"], spool: "#f4ece4", core: "#e8c8a0", music: "lantern" },
  { id: "snow", name: "Snow Lodge", bg: ["#eef6fc", "#d6e6f4"], spool: "#ffffff", core: "#d0e6f8", music: "snow" },
  { id: "neon", name: "Neon Night", bg: ["#1c1a34", "#0e0c20"], spool: "#e8e6ff", core: "#bcb6ff", music: "neon" },
];
export const ROPE_COLS = ["#e8323a", "#2a6ae8", "#f8c418", "#2ab84a", "#9a4ae0", "#ff8a1a", "#e85ab0", "#1ac8c8", "#8a5a2a", "#a8e030", "#3a3a4a", "#f4f4f8"];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; board: Board; seed: string; boss: boolean; showcase: boolean; par: number; trap: number; moves: number; path: Move[] }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const colors = tutorial ? [2, 3][n - 1] : Math.min(12, 5 + Math.floor(nd / 30) + big);
  const cap = tutorial ? 3 : nd < 40 ? 4 : nd < 180 ? 5 : 6;
  // one spare spool is the meanest, but big boards need two to stay solvable
  const empties = tutorial || nd < 10 ? 2 : colors <= 9 ? 1 : 2;
  const hidden = tutorial || nd < 6 ? 0 : Math.min(0.7, 0.25 + nd / 800);
  return { n, nd, pass, boss, showcase, tutorial, colors, cap, empties, hidden };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `rope:${stage}`;
  const rng = rngFrom(seed);
  let best: { board: Board; par: number; trap: number; score: number; path: Move[] } | null = null;
  let empties = p.empties;
  for (let k = 0, found = 0; k < 90 && found < (p.tutorial ? 1 : 8); k++) {
    // no solvable shuffle yet: allow one more spare spool rather than give up
    if (k > 0 && k % 30 === 0 && !found) empties++;
    // a shuffled heap of coils, `cap` of each colour, dealt onto full spools; then the empty spools
    const pool: number[] = [];
    for (let c = 0; c < p.colors; c++) for (let i = 0; i < p.cap; i++) pool.push(c);
    for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const spools: Spool[] = [];
    for (let c = 0; c < p.colors; c++) spools.push(pool.slice(c * p.cap, (c + 1) * p.cap));
    for (let e = 0; e < empties; e++) spools.push([]);
    // no spool may start already sorted, and few ready-made runs
    if (spools.some((s) => s.length && s.every((x) => x === s[0]))) continue;
    const board: Board = { cap: p.cap, spools, hidden: spools.map((s) => s.map((_, i) => i < s.length - 1 && rng.next() < p.hidden)) };
    const r = solve(board, spools, empties === 1 ? 40000 : 20000);
    if (!r.path) continue;
    found++;
    // trap rate: first moves after which the board can't be solved
    const ms = moves(board, spools);
    let traps = 0;
    for (const m of ms.slice(0, 16)) { const t = spools.map((s) => s.slice()); apply(board, t, m.from, m.to); if (!solve(board, t, 4000).path) traps++; }
    const trap = ms.length ? traps / Math.min(16, ms.length) : 0;
    const score = trap * 10 + r.path.length * 0.08 + board.hidden.flat().filter(Boolean).length * 0.08;
    if (!best || score > best.score) best = { board, par: r.path.length, trap, score, path: r.path };
  }
  if (!best) return { ...buildStage(Math.max(1, stage - 1)), stage };
  // a move limit: the solver's count plus a little room (a warm-up board gets plenty)
  const limit = p.tutorial ? best.par + 10 : best.par + Math.max(3, Math.round(best.par * 0.15));
  return { stage, board: best.board, seed, boss: p.boss, showcase: p.showcase, par: best.par, trap: best.trap, moves: limit, path: best.path };
}

/** the next move of the stage's own plan when the board is still on it (same spools in the same places), else null */
export function planned(d: StageDef, spools: Spool[]): Move | null {
  const key = (sp: Spool[]) => sp.map((x) => x.join(",")).join("|");
  const want = key(spools.slice(0, d.board.spools.length));
  const sp = d.board.spools.map((x) => x.slice());
  for (let k = 0; k <= d.path.length; k++) {
    if (key(sp) === want) return d.path[k] ?? null;
    if (k < d.path.length) apply(d.board, sp, d.path[k].from, d.path[k].to);
  }
  return null;
}
