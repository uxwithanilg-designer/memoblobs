// Bead Rush stages. 600 designed stages, then the remix: stage n is built from its number (same track for everyone).
//
//   • 12 worlds × 50 stages, each with its own colours and music; the worlds bring walls between lanes, red minus orbs,
//     more speed and ×2 / ½ gates, and later worlds mix them all. Tracks grow from 14 to 60 rows.
//   • The builder lays rows one by one while tracking the best bead count you can have in each lane (walls included),
//     and sets the block numbers so that only a few lanes get through, with a thin margin. Among several tracks it keeps
//     the one where a player who only looks one row ahead does worst. plan() proves the best route survives.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { canShift, effect, greedy, plan, shiftFor, LANES, type Cell, type Row, type Track, type Wall } from "./engine";

export interface World { id: string; name: string; bg: [string, string]; floor: string; music: string }
export const WORLDS: World[] = [
  { id: "neon", name: "Neon Run", bg: ["#2a2a5a", "#141432"], floor: "#2e2e66", music: "neon" },
  { id: "candy", name: "Candy Lane", bg: ["#5a2a5a", "#2a1430"], floor: "#5e2e6a", music: "candy" },
  { id: "laser", name: "Laser Walls", bg: ["#1a3a5a", "#0c1a30"], floor: "#1e4466", music: "laser" },
  { id: "red", name: "Red Zone", bg: ["#5a1a2a", "#2a0a14"], floor: "#5e2232", music: "red" },
  { id: "turbo", name: "Turbo Tube", bg: ["#1a4a4a", "#0a2424"], floor: "#1e5656", music: "turbo" },
  { id: "twin", name: "Twin Gates", bg: ["#3a2a6a", "#1a1236"], floor: "#3e3078", music: "twin" },
  { id: "crystal", name: "Crystal Cave", bg: ["#1a2a4a", "#0a1226"], floor: "#223258", music: "crystal" },
  { id: "sunset", name: "Sunset Strip", bg: ["#5a3a2a", "#2a1610"], floor: "#664232", music: "sunset" },
  { id: "frost", name: "Frost Line", bg: ["#2a4a6a", "#122238"], floor: "#305478", music: "frost" },
  { id: "lava", name: "Lava Loop", bg: ["#4a1a10", "#220806"], floor: "#5a2214", music: "lava" },
  { id: "galaxy", name: "Galaxy Road", bg: ["#2a1a4a", "#0e0820"], floor: "#301e58", music: "galaxy" },
  { id: "core", name: "Hyper Core", bg: ["#3a3a3a", "#121212"], floor: "#424242", music: "core" },
];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);
export const GAP = 4.2;

export interface StageDef { stage: number; seed: string; track: Track; best: number; route: number[]; greedy: number; boss: boolean; showcase: boolean }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const w = Math.floor((n - 1) / STAGES_PER_WORLD);
  const big = boss || showcase ? 1 : 0;
  const has = (from: number) => pass > 0 || w >= from;
  return {
    n, nd, pass, boss, showcase, tutorial, big,
    rows: tutorial ? 10 : Math.min(60, 14 + Math.floor(nd / 12) + big * 10),
    start: tutorial ? 6 : Math.min(14, 4 + Math.floor(nd / 50)),
    speed: Math.min(10.5, 6 + nd / 120 + (has(4) ? 0.6 : 0)),
    walls: has(2) ? 0.35 : nd >= 15 ? 0.15 : 0,
    minus: has(3) ? 0.3 : 0,
    gates: has(5) ? 0.1 : 0,
    // how thin the best route's margin is kept at a full block row
    keep: tutorial ? 6 : Math.max(1, 4 - Math.floor(nd / 80)),
  };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `bead:${stage}`;
  const rng = rngFrom(seed);
  let best: { t: Track; plan: { best: number; lanes: number[] }; g: number; score: number } | null = null;
  for (let attempt = 0; attempt < (p.tutorial ? 1 : 10); attempt++) {
    const rows: Row[] = [], walls: Wall[] = [];
    const t: Track = { lanes: LANES, rows, walls, end: 0, start: p.start, speed: p.speed, shift: shiftFor(GAP, p.speed) };
    // the best bead count reachable in each lane after the rows so far
    let F = new Array<number>(LANES).fill(-1); F[2] = p.start;
    for (let i = 0; i < p.rows; i++) {
      const z = 8 + i * GAP;
      // walls in the gap before this row (sometimes continuing the last one)
      if (i > 1 && rng.next() < p.walls) {
        const g = rng.int(LANES - 1), span = 1 + rng.int(3);
        walls.push({ g, z0: z - GAP - 0.6, z1: z + (span - 1) * GAP + 0.6 });
        if (rng.next() < 0.3) { const g2 = (g + 2) % (LANES - 1); walls.push({ g: g2, z0: z - GAP - 0.6, z1: z + 0.6 }); }
      }
      rows.push({ z, cells: new Array<Cell>(LANES).fill(null) });
      // what each lane can reach here before the row's effect
      const reach = new Array<number>(LANES).fill(-1);
      for (let b = 0; b < LANES; b++) for (let a = 0; a < LANES; a++) if (F[a] > 0 && canShift(t, i, a, b)) reach[b] = Math.max(reach[b], F[a]);
      const top = Math.max(...reach);
      const cells = rows[i].cells;
      const roll = rng.next();
      const kind = p.tutorial ? (i % 2 ? "orbs" : "blocks") : i < 1 ? "orbs" : roll < 0.5 ? "blocks" : roll < 0.5 + p.gates ? "gates" : roll < 0.62 + p.gates ? "few" : "orbs";
      if (kind === "blocks") {
        // a full wall of blocks: one or two lanes get through with a thin margin, the rest cost a lot or kill
        const open = reach.map((v, b) => [v, b] as const).filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]);
        const passN = Math.min(open.length, 1 + (rng.next() < 0.35 ? 1 : 0));
        const pass = new Set(open.slice(0, passN).map(([, b]) => b));
        // sometimes the best-looking lane is NOT the pass lane (a trap for the careless)
        if (open.length > 2 && rng.next() < 0.4) { pass.clear(); pass.add(open[1 + rng.int(Math.min(2, open.length - 1))][1]); }
        for (let b = 0; b < LANES; b++) {
          const R = reach[b] > 0 ? reach[b] : top;
          if (pass.has(b)) cells[b] = { t: "block", v: Math.max(1, R - p.keep - rng.int(3)) };
          else cells[b] = { t: "block", v: Math.max(1, Math.round(R * (0.85 + rng.next() * 0.9)) + rng.int(3)) };
        }
        // easy-looking small numbers here and there that sit behind walls or lead into worse rows come for free
      } else if (kind === "few") {
        // a few blocks with gaps
        for (let b = 0; b < LANES; b++) if (rng.next() < 0.5) cells[b] = { t: "block", v: 1 + rng.int(Math.max(2, Math.round(top * 0.6))) };
      } else if (kind === "gates") {
        const a = rng.int(LANES), b = (a + 1 + rng.int(LANES - 1)) % LANES;
        cells[a] = { t: "x2" }; cells[b] = { t: "half" };
        for (let c = 0; c < LANES; c++) if (c !== a && c !== b && rng.next() < 0.4) cells[c] = { t: "block", v: 1 + rng.int(Math.max(2, Math.round(top * 0.5))) };
      } else {
        // bead orbs (and red ones): small gains, the big ones behind something
        for (let b = 0; b < LANES; b++) {
          const r = rng.next();
          if (r < 0.45) cells[b] = { t: "orb", v: 1 + rng.int(3 + Math.floor(p.nd / 60)) };
          else if (r < 0.45 + p.minus) cells[b] = { t: "minus", v: 1 + rng.int(2 + Math.floor(p.nd / 50)) };
        }
      }
      // the frontier after this row
      const nf = new Array<number>(LANES).fill(-1);
      for (let b = 0; b < LANES; b++) if (reach[b] > 0) { const L = effect(cells[b], reach[b]); nf[b] = L > 0 ? L : -1; }
      if (Math.max(...nf) <= 0) { cells.fill(null); for (let b = 0; b < LANES; b++) nf[b] = reach[b]; }
      F = nf;
      // runaway bead counts make blocks huge: keep the best count in a sane band with red orbs later
    }
    t.end = rows[rows.length - 1].z + 6;
    const pl = plan(t);
    if (!pl) continue;
    const g = greedy(t);
    // tough: the careless player ends far behind (or dies), and the best route ends thin
    // and the best route ends with a few beads (not one, not a heap)
    const aim = 3 + Math.floor(p.nd / 100);
    const score = (g <= 0 ? 6 : (1 - g / pl.best) * 5) - Math.abs(pl.best - aim) * 0.4 + rng.next() * 0.5;
    if (!best || score > best.score) best = { t, plan: pl, g, score };
  }
  if (!best) return { ...buildStage(Math.max(1, stage - 1)), stage, seed };
  return { stage, seed, track: best.t, best: best.plan.best, route: best.plan.lanes, greedy: best.g, boss: p.boss, showcase: p.showcase };
}
