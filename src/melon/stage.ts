// Melon Merge Fiesta stages. 500 designed stages, then the remix: stage n is built from its number (same stage for everyone).
//
//   • Goals rotate so stages play differently: FRUIT (grow a target fruit: a lemon at first, then apple up to pineapple,
//     finales a step bigger, and every second market finale from stage 50 asks for the WATERMELON, starting from a big
//     melon, pineapple, peach and pear to chain into it), NUTS (crack every walnut — each takes two merges next to it)
//     and SCORE (reach a score) — all within a number of drops and without overflowing the crate.
//   • Every stage has its own crate: straight, V-bottom, bowl, ramp, bumpers, divider or step floor (unlocked along the
//     way), narrower crates later. Walnuts join at stage 6, jelly-wrapped fruit at 30. Every 25th stage is a finale.
//   • A test player plays every candidate stage with the real physics: for each drop it tries the crate's spots and the
//     spots above matching fruit, and keeps the drop that merges most without filling the crate. The drop budget is what
//     it needed plus room — roomy early, tight later. Stages it can't finish are rebuilt.
//   • After 500 the stages keep coming as remixes that stay hard — new crates, goals and sequences, other markets.
import { rngFrom } from "../sudoku/rng";
import { DANGER, JAR_H, ROCK, Sim, cloneBalls, jarOf, rOf, type Ball, type JarKind, type JarSpec } from "./physics";

export interface Room { id: string; name: string; sky: [string, string, string]; glow: string; wood: string; music: string }
export const ROOMS: Room[] = [
  { id: "farm", name: "Farm Market", sky: ["#2a1608", "#4a2810", "#6a3a14"], glow: "#ffb84a", wood: "#a0622a", music: "farm" },
  { id: "beach", name: "Tropical Beach", sky: ["#04222a", "#0a3a40", "#105450"], glow: "#4fe8c8", wood: "#c08a4a", music: "beach" },
  { id: "berry", name: "Berry Patch", sky: ["#220a1a", "#3e1230", "#5a1a44"], glow: "#ff5f9a", wood: "#8a3a5a", music: "berry" },
  { id: "citrus", name: "Citrus Grove", sky: ["#1e1e06", "#36360c", "#4e4a12"], glow: "#ffe04a", wood: "#8a7a2a", music: "citrus" },
  { id: "smoothie", name: "Smoothie Bar", sky: ["#14082a", "#26104a", "#3a1a66"], glow: "#c07aff", wood: "#5a3a8a", music: "smoothie" },
  { id: "night", name: "Night Market", sky: ["#080a1e", "#121638", "#1c2252"], glow: "#ff8a3a", wood: "#4a2a1a", music: "night" },
  { id: "green", name: "Snowy Greenhouse", sky: ["#0a1a1e", "#122e34", "#1a444a"], glow: "#b8f4ff", wood: "#3a6a6a", music: "green" },
  { id: "vine", name: "Sunset Vineyard", sky: ["#240c10", "#42161a", "#5e2222"], glow: "#ff7a6a", wood: "#6a2a2a", music: "vine" },
];
export const STAGES_PER_ROOM = 25;
export const DESIGNED = 500;
export const roomOf = (stage: number) => ROOMS[Math.floor((stage - 1) / STAGES_PER_ROOM) % ROOMS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export type Goal = { kind: "fruit"; target: number } | { kind: "nuts" } | { kind: "score"; target: number };
export interface StageDef { stage: number; jar: JarSpec; balls: Ball[]; goal: Goal; drops: number; seed: string; boss: boolean; botDrops: number }

/** the next fruit, from the stage's own sequence: small numbers, growing a little with the biggest fruit in the crate */
export function nextValue(seed: string, index: number, top: number): number {
  const r = rngFrom(`${seed}:n:${index}`).next();
  const cap = Math.max(2, Math.min(5, Math.floor(Math.log2(Math.max(2, top))) - 2)); // 2 … 32
  const ws = Array.from({ length: cap }, (_, k) => 1 / (k + 1) ** 1.25);
  const sum = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let k = 0; k < cap; k++) { acc += ws[k] / sum; if (r < acc) return 2 ** (k + 1); }
  return 2;
}

/** the shot and next-fruit queue, exactly as the game deals it: a new fruit joins the queue when one is dropped */
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
  const kinds: Goal["kind"][] = ["fruit", "nuts", "score", "fruit", "nuts"];
  const kind: Goal["kind"] = tutorial || nd < 6 || boss ? "fruit" : kinds[(n + pass * 2) % 5];
  // the watermelon: every second market finale from stage 50 (and every remix finale)
  const melon = boss && nd >= 50 && (pass > 0 || Math.floor(n / STAGES_PER_ROOM) % 2 === 0);
  const target = tutorial ? [16, 32, 64][n - 1] : melon ? 2048 : 2 ** Math.min(9, 6 + Math.floor((nd + 20) / 70) + (boss ? 1 : 0));
  const prefill = tutorial ? [0, 2, 3][n - 1] : melon ? 6 : Math.min(14, 4 + Math.floor(nd / 18));
  const rocks = melon ? 0 : kind === "nuts" ? Math.min(5, 2 + Math.floor(nd / 80)) : nd >= 10 && !tutorial ? Math.min(3, Math.floor(nd / 70)) : 0;
  const ice = nd >= 30 ? Math.min(5, 1 + Math.floor((nd - 30) / 60)) : 0;
  const slack = tutorial ? 2.2 : Math.max(1.25, 1.65 - 0.4 * Math.min(1, nd / 300));
  const width = tutorial || boss ? 100 : Math.round(100 - Math.min(12, nd / 30));
  return { n, nd, pass, boss, melon, tutorial, kind, target, prefill, rocks, ice, slack, width };
}

export function goalDone(goal: Goal, sim: Sim) {
  return goal.kind === "fruit" ? sim.maxValue() >= goal.target : goal.kind === "nuts" ? sim.rocks() === 0 : sim.score >= goal.target;
}

/** score a settled crate for the test player */
function evalSim(s: Sim, goal: Goal, gained: number) {
  const top = s.topY();
  if (top < DANGER + 2) return -1e9;
  let near = 0;
  const bs = s.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j]; if (a.v <= 0 || b.v <= 0) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (d < 6 && (a.v === b.v * 2 || b.v === a.v * 2)) near += Math.log2(Math.min(a.v, b.v));
    // twins kept apart can never merge: big ones should be built right next to each other
    if (a.v === b.v && a.v >= 16 && !a.ice && !b.ice) near -= Math.min(40, d) * Math.log2(a.v) * 0.12;
  }
  let sc = gained * 0.8 + Math.log2(Math.max(2, s.maxValue())) * 30 + near * 4 - Math.max(0, 75 - top) ** 2 * 0.6 - s.balls.length * 3;
  if (goal.kind === "nuts") for (const b of bs) if (b.v === ROCK) sc -= (b.hp ?? 2) * 160 + Math.max(0, 90 - b.y);
  if (goal.kind === "fruit" && s.maxValue() >= goal.target) sc += 1e6;
  return sc;
}

/** a cap on the physics work for one stage build (so a jammed crate can't stall the builder) */
const WORK = 70000;
const work = { steps: 0 };

/** the test player's drop: tries spots across the crate and right above fruits of the same number */
export function bestDrop(s0: Sim, v: number, goal: Goal): number {
  const [lo, hi] = s0.aimRange(v);
  const xs: number[] = [];
  for (let k = 0; k < 5; k++) xs.push(lo + ((hi - lo) * k) / 4);
  const same = s0.balls.filter((b) => b.v === v && !b.ice).sort((a, b) => a.y - b.y).slice(0, 2);
  for (const b of same) xs.push(b.x);
  if (goal.kind === "nuts") for (const b of s0.balls.filter((q) => q.v === ROCK).slice(0, 1)) xs.push(b.x + (b.x < 50 ? 6 : -6));
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
    if (Number.isNaN(x) || work.steps > WORK * (d.goal.kind === "fruit" && d.goal.target >= 2048 ? 2.5 : 1)) return { drops: Infinity, score: s.score };
    s.drop(v, x); s.settle(2.6);
    if (s.overflow()) return { drops: Infinity, score: s.score };
  }
  return { drops: goalDone(d.goal, s) ? cap : Infinity, score: s.score };
}

function crateFor(p: ReturnType<typeof paramsOf>, rng: ReturnType<typeof rngFrom>, attempt: number): JarSpec {
  if (p.tutorial) return { kind: "classic", w: 100, flip: false, pegs: 0, seed: 1 };
  const open = UNLOCK.filter(([, at]) => p.nd >= at).map(([k]) => k);
  // the newest crate shows up on its unlock stage; after that the crate is seeded
  const fresh = UNLOCK.find(([, at]) => at === p.n && !p.pass);
  let kind: JarKind = fresh && attempt < 2 ? fresh[0] : open[rng.int(open.length)];
  if (p.melon) return { kind: "classic", w: 100, flip: false, pegs: 0, seed: 1 + attempt };
  if (attempt >= 3) kind = (["classic", "vee", "bowl"] as JarKind[])[rng.int(Math.min(3, open.length))];
  if (p.boss && (kind === "divider" || kind === "steps" || kind === "pegs")) kind = rng.next() < 0.5 ? "classic" : "vee";
  return { kind, w: p.width, flip: rng.next() < 0.5, pegs: 3 + rng.int(3), seed: rng.int(1e9) };
}

export function buildStage(stage: number, depth = 0): StageDef {
  const p0 = paramsOf(stage);
  for (let attempt = 0; attempt < 6; attempt++) {
    work.steps = 0;
    // every retry is a little gentler: fewer rocks, less clutter, a wider and simpler crate
    const ease = Math.max(0, attempt - 1);
    // the watermelon gets three tries; if the test player can't chain it, the finale asks for a big fruit instead
    const melon = p0.melon && attempt < 3;
    const target = p0.melon && !melon ? 2 ** Math.min(9, 7 + Math.floor((p0.nd + 20) / 140)) : p0.target;
    const pre0 = p0.melon && !melon ? Math.min(14, 4 + Math.floor(p0.nd / 18)) : p0.prefill;
    const p = { ...p0, melon, target, rocks: p0.kind === "nuts" ? Math.max(1, p0.rocks - ease) : Math.max(0, p0.rocks - ease), prefill: Math.min(pre0, Math.max(2, pre0 - 3 * (melon ? 0 : ease))), width: Math.min(100, p0.width + 4 * ease) };
    const seed = `melon:${stage}:${attempt}`;
    const rng = rngFrom(seed);
    const crateSpec = crateFor(p, rng, attempt);
    const sim = new Sim(jarOf(crateSpec));
    // a prefilled crate: rocks first, then a seeded mix of fruits from 2 up to a quarter of the target, dropped in and
    // settled like real drops (they may merge — that's fine)
    const pieces: number[] = [];
    for (let k = 0; k < p.rocks; k++) pieces.push(ROCK);
    const vals: number[] = []; for (let v = 2; v <= Math.max(4, Math.min(128, p.target / 4)); v *= 2) vals.push(v);
    // big pieces to build from (a quarter and two eighths of the target), the rest is seeded clutter
    // big pieces to build from; the watermelon starts from a melon, pineapple, peach and pear to chain into it
    if (p.melon) pieces.push(1024, 512, 256, 128);
    else if (!p.tutorial && p.kind === "fruit") for (const f of [4, 8]) if (p.target / f >= 8) pieces.push(p.target / f);
    while (pieces.length < p.rocks + p.prefill) pieces.push(vals[Math.min(vals.length - 1, Math.floor(rng.next() ** 1.6 * vals.length))]);
    // the fruits are shuffled; rocks land in the upper half of the pile, where merges can reach them
    const order = pieces.slice(p.rocks); for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    for (let k = 0; k < p.rocks; k++) order.splice(Math.floor(order.length * (0.4 + rng.next() * 0.6)), 0, ROCK);
    // the watermelon finale: the melon in one corner, then pineapple, peach and pear stacked up the other side so the
    // chain is ready — the player only has to grow the last pear
    const side = rng.next() < 0.5;
    if (p.melon) { const big = order.filter((v) => v >= 128).sort((a, b) => b - a); order.splice(0, order.length, ...big, ...order.filter((v) => v < 128)); }
    const bigX = (v: number, lo: number, hi: number) => ((v === 1024 || v === 128) === side ? lo : hi);
    // keep dropping until the crate holds the planned count (prefilled fruits may merge into bigger pieces)
    const want = order.length;
    for (let k = 0; k < want * 3 && (k < order.length || sim.balls.length < want); k++) {
      const v = k < order.length ? order[k] : vals[Math.min(vals.length - 1, Math.floor(rng.next() ** 1.4 * vals.length))];
      const [lo, hi] = sim.aimRange(v);
      sim.drop(v, p.melon && v >= 128 ? bigX(v, lo, hi) : lo + rng.next() * (hi - lo));
      for (let t = 0; t < 30; t++) sim.step();
      if (sim.topY() < DANGER + 45) break;
    }
    sim.settle(4);
    if (sim.overflow() || sim.topY() < DANGER + (p.melon ? 28 : 40)) continue;
    // frozen fruits inside the prefill
    const nums = sim.balls.filter((b) => b.v > 0);
    for (let k = 0; k < p.ice && nums.length; k++) nums.splice(rng.int(nums.length), 1)[0].ice = true;
    if (p.kind === "nuts" && sim.rocks() === 0) continue;
    const balls = cloneBalls(sim.balls).map((b) => ({ ...b, vx: 0, vy: 0, age: 9 }));
    sim.score = 0;
    let goal: Goal = p.kind === "fruit" ? { kind: "fruit", target: p.target } : p.kind === "nuts" ? { kind: "nuts" } : { kind: "score", target: 0 };
    if (goal.kind === "fruit" && sim.maxValue() >= goal.target) continue;
    if (goal.kind === "score") {
      const len = Math.round(14 + Math.min(26, p.nd / 10));
      const t = new Sim(sim.jar, balls), q = new Queue(seed, t.maxValue());
      for (let k = 0; k < len; k++) { const x = bestDrop(t, q.cur, { kind: "fruit", target: 1 << 20 }); if (Number.isNaN(x)) break; t.drop(q.take(t.maxValue()), x); t.settle(2.6); }
      goal = { kind: "score", target: Math.max(150, Math.round((t.score * 0.85) / 50) * 50) };
    }
    const cap = goal.kind === "fruit" ? Math.min(160, 30 + Math.min(512, goal.target) / 4) : goal.kind === "nuts" ? 70 : 120;
    work.steps = 0;
    const res = playTest({ jar: crateSpec, balls, goal, seed }, cap);
    if (!Number.isFinite(res.drops) || (res.drops < 4 && !p.tutorial && attempt < 5)) continue;
    const drops = Math.max(res.drops + 4, Math.ceil(res.drops * (p.melon ? 1.6 : p.slack)));
    return { stage, jar: crateSpec, balls, goal, drops, seed, boss: p.boss, botDrops: res.drops };
  }
  if (stage <= 1) throw new Error("melon: stage 1 failed");
  // rare: fall back to an earlier stage's crate (at most twice, then a gentle one)
  return { ...buildStage(depth >= 2 ? 1 + ((stage - 1) % 3) : Math.max(1, stage - 7), depth + 1), stage };
}

export const crateHeightRatio = JAR_H / 100;
export { rOf };
