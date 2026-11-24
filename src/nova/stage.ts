// Merge Nova stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Goals rotate so stages play differently: TILE (build a target number: 64 at first, up to 512 (1024 on finales); the floor
//     starts with big pieces to build from, mixed with clutter),
//     STONES (smash every asteroid — each takes two merges next to it) and SCORE (reach a score) — all within a number
//     of drops. Stages 1–3 teach merging; from stage 4 it gets tough.
//   • Boards start partly filled from stage 4 (a seeded mix of numbers), stones from stage 6, frozen numbers from 30;
//     the next-block sequence is seeded too, so everyone gets the same stage. Every 25th stage is a galaxy finale.
//   • A test player (it looks two drops ahead: the shot and the next block) plays every candidate; the drop budget is
//     what it needed plus a little room — roomy early, tight later. Candidates it can't finish are rebuilt.
//   • After 500 the stages keep coming as remixes that stay hard — new layouts, goals and sequences, different
//     galaxies — so stage 501 is never stage 1 again.
import { rngFrom } from "../sudoku/rng";
import { COLS, ROWS, STONE, cloneBoard, drop, emptyBoard, idx, landingRow, maxTile, stonesLeft, type Board } from "./engine";

export interface Galaxy { id: string; name: string; sky: [string, string, string]; glow: string; music: string }
export const GALAXIES: Galaxy[] = [
  { id: "nebula", name: "Pink Nebula", sky: ["#1a0f2e", "#2a1046", "#4a1a5a"], glow: "#ff5fb0", music: "nebula" },
  { id: "comet", name: "Comet Trail", sky: ["#0a1430", "#13285a", "#1f3f7a"], glow: "#5fd0ff", music: "comet" },
  { id: "rings", name: "Saturn Rings", sky: ["#1f1408", "#3a2410", "#5a3a18"], glow: "#ffc35a", music: "rings" },
  { id: "aurora", name: "Aurora Belt", sky: ["#071a1a", "#0f2f2a", "#174a3a"], glow: "#5fffc0", music: "aurora" },
  { id: "flare", name: "Solar Flare", sky: ["#2a0808", "#4a1010", "#6a1f10"], glow: "#ff7a3a", music: "flare" },
  { id: "ice", name: "Ice Moon", sky: ["#0a1a2a", "#14304a", "#1f4a6a"], glow: "#a8e8ff", music: "ice" },
  { id: "hole", name: "Black Hole", sky: ["#050508", "#100a1a", "#1f1030"], glow: "#b07aff", music: "hole" },
  { id: "stars", name: "Starfield", sky: ["#08081a", "#14143a", "#22225a"], glow: "#ffe27a", music: "stars" },
];
export const STAGES_PER_GALAXY = 25;
export const DESIGNED = 500;
export const galaxyOf = (stage: number) => GALAXIES[Math.floor((stage - 1) / STAGES_PER_GALAXY) % GALAXIES.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export type Goal = { kind: "tile"; target: number } | { kind: "stones" } | { kind: "score"; target: number };
export interface StageDef { stage: number; board: Board; goal: Goal; drops: number; seed: string; boss: boolean; botDrops: number }

/** the next block, from the stage's own sequence: small numbers, growing a little with the biggest tile on the board */
export function nextValue(seed: string, index: number, top: number): number {
  const r = rngFrom(`${seed}:n:${index}`).next();
  const cap = Math.max(1, Math.min(6, Math.floor(Math.log2(Math.max(2, top))) - 3)); // 2 … 64
  // weights favour the small values: 2, 4, 8 most of the time
  const ws = Array.from({ length: cap }, (_, k) => 1 / (k + 1) ** 1.3);
  const sum = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < cap; k++) { acc += ws[k] / sum; if (r < acc) return 2 ** (k + 1); }
  return 2;
}

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_GALAXY, boss = inG === STAGES_PER_GALAXY - 1;
  const tutorial = n <= 3 && !pass;
  const nd = pass ? Math.max(n, 160 + (n % 120)) : n;
  const kinds: Goal["kind"][] = ["tile", "stones", "score", "tile", "stones"];
  const kind: Goal["kind"] = tutorial || n < 6 ? "tile" : boss ? "tile" : nd < 6 ? "tile" : kinds[(n + pass * 2) % 5];
  // tile targets climb: 64 → 128 → … → 2048, a step every ~45 stages (finales one step higher)
  const tileTarget = tutorial ? [32, 64, 64][n - 1] : 2 ** (Math.min(9, 6 + Math.floor((nd + 20) / 60)) + (boss ? 1 : 0));
  const prefill = tutorial ? 0 : Math.min(4, 1 + Math.floor(nd / 45));               // rows filled at the start
  const stones = kind === "stones" ? Math.min(9, 3 + Math.floor(nd / 50)) : nd >= 6 && !tutorial ? Math.min(4, Math.floor(nd / 70)) : 0;
  const ice = nd >= 30 ? Math.min(5, 1 + Math.floor((nd - 30) / 60)) : 0;
  const slack = tutorial ? 2.2 : Math.max(1.12, 1.6 - 0.45 * Math.min(1, nd / 300)) - (boss ? 0.04 : 0);
  return { n, nd, pass, boss, tutorial, kind, tileTarget, prefill, stones, ice, slack };
}

/** score a candidate drop for the test player */
function evalBoard(b: Board, gained: number, best: number, goal: Goal, smashed: number, cracked: number) {
  let h = 0, holes = 0, pairs = 0;
  for (let c = 0; c < COLS; c++) { const r = landingRow(b, c); h += r < 0 ? ROWS + 3 : ROWS - 1 - r; }
  for (let i = 0; i < b.length; i++) {
    const x = b[i]; if (!x) { holes++; continue; }
    const right = i % COLS < COLS - 1 ? b[i + 1] : null, below = b[i + COLS];
    if (x.v > 0 && right && right.v === x.v * 2) pairs++;
    if (x.v > 0 && below && below.v === x.v * 2) pairs++;
  }
  let s = gained * 0.6 - h * h * 3 + holes * 2 + pairs * 6 + Math.log2(Math.max(2, best)) * 10;
  if (goal.kind === "stones") s += smashed * 400 + cracked * 120;
  if (goal.kind === "tile" && best >= goal.target) s += 1e6;
  return s;
}

/** the test player: tries every column for the shot, then the best column for the next block */
export function bestColumn(b: Board, v: number, next: number, goal: Goal): number {
  let best = -1, bestS = -Infinity;
  for (let c = 0; c < COLS; c++) {
    if (landingRow(b, c) < 0) continue;
    const t = cloneBoard(b), r1 = drop(t, c, v);
    if (!r1.ok) continue;
    let s2 = -Infinity;
    for (let c2 = 0; c2 < COLS; c2++) {
      if (landingRow(t, c2) < 0) continue;
      const u = cloneBoard(t), r2 = drop(u, c2, next);
      if (!r2.ok) continue;
      s2 = Math.max(s2, evalBoard(u, r2.gained, Math.max(r1.best, r2.best), goal, r2.smashed.length, r2.cracked.length));
    }
    const s = evalBoard(t, r1.gained, r1.best, goal, r1.smashed.length, r1.cracked.length) * 0.6 + (Number.isFinite(s2) ? s2 * 0.4 : -1e5);
    if (s > bestS) { bestS = s; best = c; }
  }
  return best;
}

export function goalDone(goal: Goal, b: Board, score: number) {
  return goal.kind === "tile" ? maxTile(b) >= goal.target : goal.kind === "stones" ? stonesLeft(b) === 0 : score >= goal.target;
}

/** play a stage with the test player; returns drops used (Infinity if it got stuck within the cap) and its score */
export function playTest(d: { board: Board; goal: Goal; seed: string }, cap: number): { drops: number; score: number } {
  const b = cloneBoard(d.board);
  let score = 0;
  for (let k = 0; k < cap; k++) {
    if (goalDone(d.goal, b, score)) return { drops: k, score };
    const top = maxTile(b), v = nextValue(d.seed, k, top), nx = nextValue(d.seed, k + 1, top);
    const c = bestColumn(b, v, nx, d.goal);
    if (c < 0) return { drops: Infinity, score };
    const r = drop(b, c, v);
    score += r.gained;
  }
  return { drops: goalDone(d.goal, b, score) ? cap : Infinity, score };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  let best: StageDef | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = `nova:${stage}:${attempt}`;
    const rng = rngFrom(seed);
    const b = emptyBoard();
    // a prefilled floor: a seeded mix of small numbers (no ready-made pairs side by side)
    // the floor holds numbers from 2 up to a quarter of the target: big pieces to build from, mixed with clutter
    const small: number[] = []; for (let v = 2; v <= Math.max(4, p.tileTarget / 4); v *= 2) small.push(v);
    for (let r = ROWS - p.prefill; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (rng.next() < 0.18) continue;
      for (let t = 0; t < 6; t++) {
        const v = small[rng.int(small.length)];
        const left = c > 0 ? b[idx(r, c - 1)] : null, below = r < ROWS - 1 ? b[idx(r + 1, c)] : null;
        if ((left && left.v === v) || (below && below.v === v)) continue;
        b[idx(r, c)] = { v }; break;
      }
    }
    // gravity for gaps in the floor
    for (let c = 0; c < COLS; c++) { const col = []; for (let r = ROWS - 1; r >= 0; r--) if (b[idx(r, c)]) col.push(b[idx(r, c)]); for (let r = ROWS - 1, k = 0; r >= 0; r--, k++) b[idx(r, c)] = col[k] ?? null; }
    // stones sit on the floor or on the prefill; frozen numbers inside the prefill
    for (let s = 0; s < p.stones; s++) { const c = rng.int(COLS), r = landingRow(b, c); if (r >= ROWS - 4 && r >= 0) b[idx(r, c)] = { v: STONE, hp: 2 }; }
    const nums = b.map((x, i) => (x && x.v > 0 ? i : -1)).filter((i) => i >= 0);
    for (let s = 0; s < p.ice && nums.length; s++) { const i = nums.splice(rng.int(nums.length), 1)[0]; b[i]!.ice = true; }
    if (p.kind === "stones" && stonesLeft(b) === 0) continue;
    // the goal; a score target comes from the test player's own run
    let goal: Goal = p.kind === "tile" ? { kind: "tile", target: p.tileTarget } : p.kind === "stones" ? { kind: "stones" } : { kind: "score", target: 0 };
    if (goal.kind === "score") {
      const len = Math.round(16 + Math.min(34, p.nd / 8));
      const sb = cloneBoard(b); let sc = 0;
      for (let k = 0; k < len; k++) { const top = maxTile(sb), v = nextValue(seed, k, top); const c = bestColumn(sb, v, nextValue(seed, k + 1, top), { kind: "tile", target: 1 << 20 }); if (c < 0) break; sc += drop(sb, c, v).gained; }
      goal = { kind: "score", target: Math.max(200, Math.round((sc * 0.9) / 50) * 50) };
    }
    const cap = goal.kind === "tile" ? 40 + goal.target / 3 : 160;
    const t = playTest({ board: b, goal, seed }, Math.min(900, cap));
    if (!Number.isFinite(t.drops)) continue;
    const drops = Math.max(t.drops + 3, Math.ceil(t.drops * p.slack));
    const d: StageDef = { stage, board: b, goal, drops, seed, boss: p.boss, botDrops: t.drops };
    best = d;
    break;
  }
  return best ?? buildStage(Math.max(1, stage - 5));
}
