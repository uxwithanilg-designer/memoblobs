// Marble Merge 2048 stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Goals rotate so stages play differently: MARBLE (make a target number: 16 at first, then 64 up to 512 (finales a step
//     ahead); the jar starts with big pieces to build from, mixed with clutter), ROCKS (smash every rock — each takes
//     two merges next to it) and SCORE (reach a score) — all within a number of drops and without overflowing the jar.
//   • Every stage has its own jar: straight, V-bottom, bowl, ramp, bumpers, divider or step floor (unlocked along the
//     way), narrower jars later. Rocks join at stage 6, frozen marbles at 30. Every 25th stage is a room finale.
//   • A test player plays every candidate stage with the real physics: for each drop it tries the jar's spots and the
//     spots above matching marbles, and keeps the drop that merges most without filling the jar. The drop budget is what
//     it needed plus room — roomy early, tight later. Stages it can't finish are rebuilt.
//   • After 500 the stages keep coming as remixes that stay hard — new jars, goals and sequences, other rooms.
import { rngFrom } from "../sudoku/rng";
import { DANGER, JAR_H, ROCK, Sim, cloneBalls, jarOf, rOf, type Ball, type JarKind, type JarSpec } from "./physics";

export interface Room { id: string; name: string; sky: [string, string, string]; glow: string; wood: string; music: string }
export const ROOMS: Room[] = [
  { id: "toy", name: "Toy Shop", sky: ["#1e0b0b", "#3a1414", "#5a1e1a"], glow: "#ffb347", wood: "#7a3a1e", music: "toy" },
  { id: "candy", name: "Candy Bar", sky: ["#1e0a1a", "#38122e", "#561a44"], glow: "#ff6fb5", wood: "#8a2a5a", music: "candy" },
  { id: "sea", name: "Seaside Pier", sky: ["#051a22", "#0a2e38", "#10434e"], glow: "#4fe0d0", wood: "#1e5a5a", music: "sea" },
  { id: "arcade", name: "Neon Arcade", sky: ["#0e0822", "#1c0e40", "#2a135c"], glow: "#b06aff", wood: "#3a1e7a", music: "arcade" },
  { id: "cave", name: "Crystal Cave", sky: ["#061020", "#0c1e3e", "#13305a"], glow: "#5fb8ff", wood: "#1e3a6a", music: "cave" },
  { id: "forge", name: "Lava Forge", sky: ["#1c0705", "#330d07", "#4e1608"], glow: "#ff7a2a", wood: "#6a2210", music: "forge" },
  { id: "globe", name: "Snow Globe", sky: ["#0b1624", "#16283e", "#213c56"], glow: "#cfefff", wood: "#3a5a7a", music: "globe" },
  { id: "garden", name: "Midnight Garden", sky: ["#05140c", "#0a2414", "#10361e"], glow: "#ffd35a", wood: "#2a5a2a", music: "garden" },
];
export const STAGES_PER_ROOM = 25;
export const DESIGNED = 500;
export const roomOf = (stage: number) => ROOMS[Math.floor((stage - 1) / STAGES_PER_ROOM) % ROOMS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export type Goal = { kind: "marble"; target: number } | { kind: "rocks" } | { kind: "score"; target: number };
export interface StageDef { stage: number; jar: JarSpec; balls: Ball[]; goal: Goal; drops: number; seed: string; boss: boolean; botDrops: number }

/** the next marble, from the stage's own sequence: small numbers, growing a little with the biggest marble in the jar */
export function nextValue(seed: string, index: number, top: number): number {
  const r = rngFrom(`${seed}:n:${index}`).next();
  const cap = Math.max(2, Math.min(5, Math.floor(Math.log2(Math.max(2, top))) - 2)); // 2 … 32
  const ws = Array.from({ length: cap }, (_, k) => 1 / (k + 1) ** 1.25);
  const sum = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < cap; k++) { acc += ws[k] / sum; if (r < acc) return 2 ** (k + 1); }
  return 2;
}

/** the shot and next-marble queue, exactly as the game deals it: a new marble joins the queue when one is dropped */
export class Queue {
  cur: number; nxt: number; k = 2;
  constructor(public seed: string, top: number) { this.cur = nextValue(seed, 0, top); this.nxt = nextValue(seed, 1, top); }
  take(top: number) { const v = this.cur; this.cur = this.nxt; this.nxt = nextValue(this.seed, this.k++, top); return v; }
}

const UNLOCK: [JarKind, number][] = [["classic", 1], ["vee", 4], ["bowl", 9], ["ramp", 14], ["pegs", 19], ["divider", 28], ["steps", 42]];

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inR = (n - 1) % STAGES_PER_ROOM, boss = inR === STAGES_PER_ROOM - 1;
  const tutorial = n <= 3 && !pass;
  const nd = pass ? Math.max(n, 160 + (n % 120)) : n;
  const kinds: Goal["kind"][] = ["marble", "rocks", "score", "marble", "rocks"];
  const kind: Goal["kind"] = tutorial || nd < 6 || boss ? "marble" : kinds[(n + pass * 2) % 5];
  const target = tutorial ? [16, 32, 64][n - 1] : 2 ** Math.min(9, 6 + Math.floor((nd + 20) / 70) + (boss ? 1 : 0));
  const prefill = tutorial ? [0, 2, 4][n - 1] : Math.min(20, 6 + Math.floor(nd / 14));
  const rocks = kind === "rocks" ? Math.min(5, 2 + Math.floor(nd / 80)) : nd >= 10 && !tutorial ? Math.min(3, Math.floor(nd / 70)) : 0;
  const ice = nd >= 30 ? Math.min(5, 1 + Math.floor((nd - 30) / 60)) : 0;
  const slack = tutorial ? 2.2 : Math.max(1.14, 1.6 - 0.42 * Math.min(1, nd / 300)) - (boss ? 0.04 : 0);
  const width = tutorial || boss ? 100 : Math.round(100 - Math.min(12, nd / 30));
  return { n, nd, pass, boss, tutorial, kind, target, prefill, rocks, ice, slack, width };
}

export function goalDone(goal: Goal, sim: Sim) {
  return goal.kind === "marble" ? sim.maxValue() >= goal.target : goal.kind === "rocks" ? sim.rocks() === 0 : sim.score >= goal.target;
}

/** score a settled jar for the test player */
function evalSim(s: Sim, goal: Goal, gained: number) {
  const top = s.topY();
  if (top < DANGER + 2) return -1e9;
  let near = 0;
  const bs = s.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (a.v <= 0 || b.v <= 0) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (d < 6 && (a.v === b.v * 2 || b.v === a.v * 2)) near += 1;
  }
  let sc = gained * 0.8 + Math.log2(Math.max(2, s.maxValue())) * 30 + near * 4 - Math.max(0, 75 - top) ** 2 * 0.6 - s.balls.length * 3;
  if (goal.kind === "rocks") for (const b of bs) if (b.v === ROCK) sc -= (b.hp ?? 2) * 160 + Math.max(0, 90 - b.y);
  if (goal.kind === "marble" && s.maxValue() >= goal.target) sc += 1e6;
  return sc;
}

/** a cap on the physics work for one stage build (so a jammed jar can't stall the builder) */
const WORK = 70000;
const work = { steps: 0 };

/** the test player's drop: tries spots across the jar and right above marbles of the same number */
export function bestDrop(s0: Sim, v: number, goal: Goal): number {
  const [lo, hi] = s0.aimRange(v);
  const xs: number[] = [];
  for (let k = 0; k < 5; k++) xs.push(lo + ((hi - lo) * k) / 4);
  const same = s0.balls.filter((b) => b.v === v && !b.ice).sort((a, b) => a.y - b.y).slice(0, 2);
  for (const b of same) xs.push(b.x);
  if (goal.kind === "rocks") for (const b of s0.balls.filter((q) => q.v === ROCK).slice(0, 1)) xs.push(b.x + (b.x < 50 ? 6 : -6));
  let best = xs[0], bestS = -Infinity;
  for (const x of xs) {
    const s = new Sim(s0.jar, s0.balls);
    s.score = s0.score;
    s.drop(v, x); work.steps -= s.t * 120; s.settle(1.3); work.steps += s.t * 120;
    const sc = evalSim(s, goal, s.score - s0.score);
    if (sc > bestS) { bestS = sc; best = x; }
  }
  return bestS <= -1e9 ? NaN : best;
}

/** play a stage with the test player; returns drops used (Infinity if it couldn't finish within the cap) */
export function playTest(d: { jar: JarSpec; balls: Ball[]; goal: Goal; seed: string }, cap: number): { drops: number; score: number } {
  const s = new Sim(jarOf(d.jar), d.balls);
  const q = new Queue(d.seed, s.maxValue());
  for (let k = 0; k < cap; k++) {
    if (goalDone(d.goal, s)) return { drops: k, score: s.score };
    const x = bestDrop(s, q.cur, d.goal);
    const v = q.take(s.maxValue());
    if (Number.isNaN(x) || work.steps > WORK) return { drops: Infinity, score: s.score };
    s.drop(v, x); s.settle(2.6);
    if (s.overflow()) return { drops: Infinity, score: s.score };
  }
  return { drops: goalDone(d.goal, s) ? cap : Infinity, score: s.score };
}

function jarFor(p: ReturnType<typeof paramsOf>, rng: ReturnType<typeof rngFrom>, attempt: number): JarSpec {
  if (p.tutorial) return { kind: "classic", w: 100, flip: false, pegs: 0, seed: 1 };
  const open = UNLOCK.filter(([, at]) => p.nd >= at).map(([k]) => k);
  // the newest jar shows up on its unlock stage; after that the jar is seeded
  const fresh = UNLOCK.find(([, at]) => at === p.n && !p.pass);
  let kind: JarKind = fresh && attempt < 2 ? fresh[0] : open[rng.int(open.length)];
  if (attempt >= 3) kind = (["classic", "vee", "bowl"] as JarKind[])[rng.int(Math.min(3, open.length))];
  if (p.boss && (kind === "divider" || kind === "steps" || kind === "pegs")) kind = rng.next() < 0.5 ? "classic" : "vee";
  return { kind, w: p.width, flip: rng.next() < 0.5, pegs: 3 + rng.int(3), seed: rng.int(1e9) };
}

export function buildStage(stage: number, depth = 0): StageDef {
  const p0 = paramsOf(stage);
  for (let attempt = 0; attempt < 6; attempt++) {
    work.steps = 0;
    // every retry is a little gentler: fewer rocks, less clutter, a wider and simpler jar
    const ease = Math.max(0, attempt - 1);
    const p = { ...p0, rocks: p0.kind === "rocks" ? Math.max(1, p0.rocks - ease) : Math.max(0, p0.rocks - ease), prefill: Math.min(p0.prefill, Math.max(2, p0.prefill - 3 * ease)), width: Math.min(100, p0.width + 4 * ease) };
    const seed = `marble:${stage}:${attempt}`;
    const rng = rngFrom(seed);
    const jarSpec = jarFor(p, rng, attempt);
    const sim = new Sim(jarOf(jarSpec));
    // a prefilled jar: rocks first, then a seeded mix of marbles from 2 up to a quarter of the target, dropped in and
    // settled like real drops (they may merge — that's fine)
    const pieces: number[] = [];
    for (let k = 0; k < p.rocks; k++) pieces.push(ROCK);
    const vals: number[] = []; for (let v = 2; v <= Math.max(4, p.target / 4); v *= 2) vals.push(v);
    // big pieces to build from (a quarter and two eighths of the target), the rest is seeded clutter
    if (!p.tutorial && p.kind === "marble") for (const f of [4, 8, 8]) if (p.target / f >= 8) pieces.push(p.target / f);
    while (pieces.length < p.rocks + p.prefill) pieces.push(vals[Math.min(vals.length - 1, Math.floor(rng.next() ** 1.6 * vals.length))]);
    // the marbles are shuffled; rocks land in the upper half of the pile, where merges can reach them
    const order = pieces.slice(p.rocks); for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    for (let k = 0; k < p.rocks; k++) order.splice(Math.floor(order.length * (0.4 + rng.next() * 0.6)), 0, ROCK);
    // keep dropping until the jar holds the planned count (prefilled marbles may merge into bigger pieces)
    const want = order.length;
    for (let k = 0; k < want * 3 && (k < order.length || sim.balls.length < want); k++) {
      const v = k < order.length ? order[k] : vals[Math.min(vals.length - 1, Math.floor(rng.next() ** 1.4 * vals.length))];
      const [lo, hi] = sim.aimRange(v);
      sim.drop(v, lo + rng.next() * (hi - lo));
      for (let t = 0; t < 30; t++) sim.step();
      if (sim.topY() < DANGER + 45) break;
    }
    sim.settle(4);
    if (sim.overflow() || sim.topY() < DANGER + 40) continue;
    // frozen marbles inside the prefill
    const nums = sim.balls.filter((b) => b.v > 0);
    for (let k = 0; k < p.ice && nums.length; k++) nums.splice(rng.int(nums.length), 1)[0].ice = true;
    if (p.kind === "rocks" && sim.rocks() === 0) continue;
    const balls = cloneBalls(sim.balls).map((b) => ({ ...b, vx: 0, vy: 0, age: 9 }));
    sim.score = 0;
    let goal: Goal = p.kind === "marble" ? { kind: "marble", target: p.target } : p.kind === "rocks" ? { kind: "rocks" } : { kind: "score", target: 0 };
    if (goal.kind === "marble" && sim.maxValue() >= goal.target) continue;
    if (goal.kind === "score") {
      const len = Math.round(14 + Math.min(26, p.nd / 10));
      const t = new Sim(sim.jar, balls), q = new Queue(seed, t.maxValue());
      for (let k = 0; k < len; k++) { const x = bestDrop(t, q.cur, { kind: "marble", target: 1 << 20 }); if (Number.isNaN(x)) break; t.drop(q.take(t.maxValue()), x); t.settle(2.6); }
      goal = { kind: "score", target: Math.max(150, Math.round((t.score * 0.85) / 50) * 50) };
    }
    const cap = goal.kind === "marble" ? Math.min(160, 30 + goal.target / 4) : goal.kind === "rocks" ? 70 : 120;
    work.steps = 0;
    const res = playTest({ jar: jarSpec, balls, goal, seed }, cap);
    if (!Number.isFinite(res.drops) || (res.drops < 4 && !p.tutorial && attempt < 5)) continue;
    const drops = Math.max(res.drops + 4, Math.ceil(res.drops * p.slack));
    return { stage, jar: jarSpec, balls, goal, drops, seed, boss: p.boss, botDrops: res.drops };
  }
  if (stage <= 1) throw new Error("marble: stage 1 failed");
  // rare: fall back to an earlier stage's jar (at most twice, then a gentle one)
  return { ...buildStage(depth >= 2 ? 1 + ((stage - 1) % 3) : Math.max(1, stage - 7), depth + 1), stage };
}

export const jarHeightRatio = JAR_H / 100;
export { rOf };
