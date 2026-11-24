// Moonvial stages: glowing potions in glass vials. Pour the top colour onto the same colour or into an empty vial; a
// vial filled with one colour is corked and handed to the star spirit who ordered it. Stages never end: stage n is
// built from its number (same stage, same vials for everyone). For each stage the builder deals several candidates,
// proves each can be finished (depth-first solver), finds a near-shortest solution for the par (weighted A*),
// measures how hard it feels (how often careless play gets stuck), and keeps the one closest to the difficulty
// curve. Every ten stages light up a constellation with its own sky and music, closed by a boss stage.
import { rngFrom, type Rng } from "../sudoku/rng";

/** liquid colours: [main, light, dark] — index + 1 is the colour id (0 = none) */
export const LIQUID: [string, string, string][] = [
  ["#FF4F9A", "#FFB0D4", "#B8186A"], // rose
  ["#3FB4FF", "#A8E0FF", "#1667C4"], // sky
  ["#7BE04A", "#CFF7A8", "#3A9A1E"], // lime
  ["#FFC93D", "#FFEBA0", "#C98A0A"], // gold
  ["#FF6B45", "#FFB8A0", "#C2361A"], // ember
  ["#9A6BFF", "#D4C2FF", "#5B33C9"], // violet
  ["#22D6C3", "#A0F5EC", "#0E8F84"], // teal
  ["#FF9A2E", "#FFD39A", "#C46406"], // amber
  ["#F2F6FF", "#FFFFFF", "#AEB8D6"], // moonmilk
  ["#2F55E8", "#9CB0FF", "#18299A"], // deep blue
  ["#B9E83A", "#E8FFA8", "#6E9612"], // pear
  ["#E04BE8", "#F5B0F8", "#8E1A99"], // orchid
];
export const NAMES = ["Rose", "Sky", "Lime", "Gold", "Ember", "Violet", "Teal", "Amber", "Moonmilk", "Deep blue", "Pear", "Orchid"];

export interface Zone { id: string; name: string; sky: [string, string, string]; glow: string; music: string }
export const ZONES: Zone[] = [
  { id: "lantern", name: "Lantern Garden", sky: ["#1b1446", "#3b2a78", "#e88a6a"], glow: "#FFC93D", music: "lantern" },
  { id: "firefly", name: "Firefly Pond", sky: ["#0c2238", "#164a5e", "#58c4a8"], glow: "#B9E83A", music: "firefly" },
  { id: "crystal", name: "Crystal Grotto", sky: ["#120f3a", "#2a2378", "#7a6bff"], glow: "#9A6BFF", music: "crystal" },
  { id: "starfall", name: "Starfall Hill", sky: ["#0a1030", "#1c2c6e", "#4f7cff"], glow: "#A8E0FF", music: "starfall" },
  { id: "aurora", name: "Aurora Peak", sky: ["#061a2a", "#0f3d4a", "#22D6C3"], glow: "#22D6C3", music: "aurora" },
  { id: "orchard", name: "Moon Orchard", sky: ["#1a0f2e", "#4a1f55", "#FF4F9A"], glow: "#FF9A2E", music: "orchard" },
  { id: "harbor", name: "Comet Harbor", sky: ["#081428", "#123a66", "#3FB4FF"], glow: "#3FB4FF", music: "harbor" },
  { id: "nebula", name: "Nebula Gate", sky: ["#14062a", "#3d1060", "#E04BE8"], glow: "#E04BE8", music: "nebula" },
];
export const STAGES_PER_ZONE = 10;
export const zoneOf = (stage: number) => ZONES[Math.floor((stage - 1) / STAGES_PER_ZONE) % ZONES.length];
export const loopOf = (stage: number) => Math.floor((stage - 1) / (STAGES_PER_ZONE * ZONES.length));

export interface Vial { layers: number[]; hidden: boolean[]; cap: number; /** locked until this many vials are corked (0 = open) */ lock: number }
export interface StageDef {
  stage: number;
  colors: number;
  cap: number;
  vials: Vial[];
  /** near-shortest move count (weighted A*) — the 3-star target */
  par: number;
  /** measured difficulty 0…1 and the target it was picked for */
  difficulty: number;
  target: number;
  boss: boolean;
  seed: string;
}

// ------------------------------------------------------------------ the ramp

export interface Params { colors: number; cap: number; empty: number; hidden: number; lock: number; boss: boolean }

/**
 * What stage n is made of. Stages 1–6 teach the pour (2 → 4 colours); colours then climb to 12 by stage ~50.
 * After that the stages keep growing with new twists, brought in slowly and mixed so no two stages in a row feel
 * the same: tall five-layer vials (from 41), locked vials that open after a few corks (from 56), only one free empty
 * vial next to a locked one on some stages (from 86, with fewer colours), and a boss stage closing every constellation. Hidden layers grow throughout.
 */
export function paramsOf(stage: number): Params {
  const loop = loopOf(stage), inZone = (stage - 1) % STAGES_PER_ZONE, boss = inZone === 9 && stage > 9;
  let colors = stage <= 1 ? 2 : stage <= 3 ? 3 : stage <= 6 ? 4 : Math.min(12, 5 + Math.floor((stage - 7) / 6));
  let cap = 4;
  // tall vials: every third stage from 41, every other from 121, plus bosses
  if (stage >= 41 && (inZone % 3 === 2 || boss || (stage >= 121 && inZone % 2 === 0))) { cap = 5; colors = Math.min(colors, 10); }
  let empty = colors <= 3 ? 1 : 2;
  let lock = 0;
  if (stage >= 56 && (inZone % 4 === 3 || boss || (stage >= 150 && inZone % 3 === 0))) {
    lock = Math.min(5, 2 + Math.floor((stage - 56) / 60) + (boss ? 1 : 0));
    if (stage >= 86 && !boss && inZone % 2 === 1) { empty = 1; colors = Math.min(colors, cap === 5 ? 7 : 8); } // one free vial now, the locked one later
  }
  const hiddenBase = stage < 12 ? 0 : Math.min(0.65, 0.15 + (stage - 12) * 0.004 + loop * 0.08);
  const hidden = hiddenBase * (boss ? 1.2 : inZone % 3 === 1 ? 1 : 0.55);
  return { colors, cap, empty, hidden: Math.min(0.7, hidden), lock, boss };
}

/** the difficulty a stage aims for: rises fast then slowly forever, with a calm start and a peak in each constellation */
export function targetOf(stage: number): number {
  const inZone = (stage - 1) % STAGES_PER_ZONE;
  const base = 0.08 + 0.55 * (1 - Math.exp(-stage / 45)) + Math.min(0.2, loopOf(stage) * 0.05);
  const wave = (inZone / 9) * 0.16 - 0.06 + (inZone === 9 && stage > 9 ? 0.08 : 0);
  return Math.max(0.03, Math.min(0.95, base + wave));
}

// ------------------------------------------------------------------ rules shared by solver and game

export type Move = [number, number];

/** colours poured from a to b in one go (0 = not allowed) — locks are checked by the caller */
export function pourAmount(vials: { layers: number[]; cap: number }[], a: number, b: number): number {
  if (a === b) return 0;
  const A = vials[a].layers, B = vials[b].layers;
  if (!A.length || B.length >= vials[b].cap) return 0;
  const c = A[A.length - 1];
  if (B.length && B[B.length - 1] !== c) return 0;
  let run = 1;
  while (run < A.length && A[A.length - 1 - run] === c) run++;
  return Math.min(run, vials[b].cap - B.length);
}

interface SVial { layers: number[]; cap: number; lock: number }
const isDone = (v: SVial) => v.layers.length === v.cap && v.layers.every((x) => x === v.layers[0]);
const corkedCount = (vs: SVial[]) => vs.reduce((s, v) => s + (isDone(v) ? 1 : 0), 0);
const solved = (vs: SVial[]) => vs.every((v) => !v.layers.length || isDone(v));
const keyOf = (vs: SVial[]) => vs.map((v) => `${v.cap}${v.lock}:${v.layers.join(",")}`).sort().join("|");

/** sensible moves from a state: no pouring a finished vial, no moving a one-colour vial into an empty one, empties alike */
function movesOf(vs: SVial[]): { a: number; b: number; amt: number; score: number }[] {
  const open = corkedCount(vs);
  const out: { a: number; b: number; amt: number; score: number }[] = [];
  for (let a = 0; a < vs.length; a++) {
    const A = vs[a];
    if (!A.layers.length || A.lock > open || isDone(A)) continue;
    const uniform = A.layers.every((x) => x === A.layers[0]);
    const emptyCaps = new Set<number>();
    for (let b = 0; b < vs.length; b++) {
      const B = vs[b];
      if (B.lock > open) continue;
      const amt = pourAmount(vs, a, b);
      if (!amt) continue;
      if (!B.layers.length) {
        if (uniform && A.cap === B.cap) continue;
        if (emptyCaps.has(B.cap)) continue;
        emptyCaps.add(B.cap);
      }
      const fills = B.layers.length + amt === B.cap && B.layers.every((x) => x === A.layers[A.layers.length - 1]);
      out.push({ a, b, amt, score: (B.layers.length ? 10 : 0) + (fills ? 20 : 0) + (amt === A.layers.length ? 3 : 0) + amt });
    }
  }
  return out;
}

const apply = (vs: SVial[], a: number, b: number, amt: number) => { for (let i = 0; i < amt; i++) vs[b].layers.push(vs[a].layers.pop()!); };
const undo = (vs: SVial[], a: number, b: number, amt: number) => { for (let i = 0; i < amt; i++) vs[a].layers.push(vs[b].layers.pop()!); };
const copy = (vs: SVial[]) => vs.map((v) => ({ layers: v.layers.slice(), cap: v.cap, lock: v.lock }));

/** fast depth-first proof that a stage can be finished (budget = states visited) */
export function solve(start: SVial[], budget = 120000): { moves: Move[] | null; nodes: number } {
  const seen = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;
  const vs = copy(start);
  const rec = (): boolean => {
    if (solved(vs)) return true;
    if (++nodes > budget) return false;
    const k = keyOf(vs);
    if (seen.has(k)) return false;
    seen.add(k);
    const cand = movesOf(vs).sort((x, y) => y.score - x.score);
    for (const m of cand) {
      apply(vs, m.a, m.b, m.amt);
      path.push([m.a, m.b]);
      if (rec()) return true;
      path.pop();
      undo(vs, m.a, m.b, m.amt);
      if (nodes > budget) return false;
    }
    return false;
  };
  const ok = rec();
  return { moves: ok ? path.slice() : null, nodes };
}

/** how far a state is from done: colour breaks inside vials plus colours spread over several vials */
function heuristic(vs: SVial[]): number {
  let h = 0;
  const where = new Map<number, number>();
  for (const v of vs) {
    for (let i = 1; i < v.layers.length; i++) if (v.layers[i] !== v.layers[i - 1]) h++;
    const seen = new Set(v.layers);
    for (const c of seen) where.set(c, (where.get(c) ?? 0) + 1);
  }
  for (const n of where.values()) h += n - 1;
  return h;
}

/** weighted A*: a near-shortest solution, used as the par (null when the budget runs out) */
export function shortest(start: SVial[], budget = 40000, w = 1.25): Move[] | null {
  interface Node { vs: SVial[]; g: number; f: number; path: Move[] }
  const heap: Node[] = [];
  const push = (n: Node) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const best = new Map<string, number>();
  push({ vs: copy(start), g: 0, f: heuristic(start) * w, path: [] });
  let n = 0;
  while (heap.length && n++ < budget) {
    const cur = pop();
    if (solved(cur.vs)) return cur.path;
    for (const m of movesOf(cur.vs)) {
      const nv = copy(cur.vs);
      apply(nv, m.a, m.b, m.amt);
      const k = keyOf(nv), g = cur.g + 1;
      if ((best.get(k) ?? Infinity) <= g) continue;
      best.set(k, g);
      push({ vs: nv, g, f: g + heuristic(nv) * w, path: [...cur.path, [m.a, m.b]] });
    }
  }
  return null;
}

/**
 * How hard a stage feels to a person, 0…1. A decent but imperfect player is let loose many times: they never repeat
 * a position, usually take the move that tidies the shelf most (fewest colour breaks after it) and sometimes just
 * any move — and, like real players, they get better as the stages go by (skill). The trap rate is how often, and
 * how early, they paint themselves into a corner; add how many moves the stage needs per layer.
 */
export function measure(start: SVial[], par: number, rng: Rng, runs = 24, skill = 0.75): { trap: number; d: number } {
  let stuck = 0;
  const layers = start.reduce((s, v) => s + v.layers.length, 0);
  for (let r = 0; r < runs; r++) {
    const vs = copy(start);
    const seen = new Set<string>([keyOf(vs)]);
    let steps = 0, ok = false;
    while (steps < par * 3 + 20) {
      if (solved(vs)) { ok = true; break; }
      const opts: { m: { a: number; b: number; amt: number; score: number }; h: number }[] = [];
      for (const m of movesOf(vs)) {
        apply(vs, m.a, m.b, m.amt);
        const k = keyOf(vs);
        if (!seen.has(k)) opts.push({ m, h: heuristic(vs) - (m.score >= 20 ? 2 : 0) });
        undo(vs, m.a, m.b, m.amt);
      }
      if (!opts.length) break;
      let pick = opts[rng.int(opts.length)];
      if (rng.next() < skill) { const lo = Math.min(...opts.map((o) => o.h)); const bestOpts = opts.filter((o) => o.h === lo); pick = bestOpts[rng.int(bestOpts.length)]; }
      apply(vs, pick.m.a, pick.m.b, pick.m.amt);
      seen.add(keyOf(vs));
      steps++;
    }
    // stuck halfway counts half: how much of the shelf was still unsorted when they got stuck
    if (!ok) { const colours = vs.filter((v) => v.layers.length).length; stuck += 1 - corkedCount(vs) / Math.max(1, colours); }
  }
  const trap = stuck / runs;
  const perLayer = Math.max(0, Math.min(1, (par / Math.max(1, layers) - 0.25) / 0.45));
  return { trap, d: Math.max(0, Math.min(1, trap * 0.75 + perLayer * 0.25)) };
}

// ------------------------------------------------------------------ the builder

function deal(rng: Rng, p: Params): SVial[] {
  const pool: number[] = [];
  for (let c = 1; c <= p.colors; c++) for (let k = 0; k < p.cap; k++) pool.push(c);
  rng.shuffle(pool);
  const vs: SVial[] = [];
  for (let i = 0; i < p.colors; i++) vs.push({ layers: pool.slice(i * p.cap, i * p.cap + p.cap), cap: p.cap, lock: 0 });
  for (let i = 0; i < p.empty; i++) vs.push({ layers: [], cap: p.cap, lock: 0 });
  if (p.lock) vs.push({ layers: [], cap: p.cap, lock: p.lock });
  return vs;
}

/** a deal is too kind if a vial is done or nearly, or a top run is already three deep */
function tooEasy(vs: SVial[]): boolean {
  for (const v of vs) {
    const l = v.layers;
    if (!l.length) continue;
    if (l.every((x) => x === l[0])) return true;
    let run = 1;
    while (run < l.length && l[l.length - 1 - run] === l[l.length - 1]) run++;
    if (run >= Math.max(3, v.cap - 1)) return true;
  }
  return false;
}

/** hide lower layers, never the top one, preferring layers that differ from the one above (a real surprise) */
function hideLayers(vs: SVial[], share: number, rng: Rng): boolean[][] {
  const out = vs.map((v) => v.layers.map(() => false));
  if (share <= 0) return out;
  const cand: [number, number, number][] = [];
  vs.forEach((v, i) => v.layers.forEach((c, j) => { if (j < v.layers.length - 1) cand.push([i, j, c !== v.layers[j + 1] ? 1 : 0.4]); }));
  const want = Math.round(cand.length * share);
  rng.shuffle(cand).sort((a, b) => b[2] - a[2]);
  for (const [i, j] of cand.slice(0, want)) out[i][j] = true;
  return out;
}

export function buildStage(stage: number, tag = "stage"): StageDef {
  const p = { ...paramsOf(stage) };
  const target = targetOf(stage);
  const rng = rngFrom(`moonvial:${tag}:${stage}`);
  const big = p.colors * p.cap >= 40;
  const want = p.colors <= 3 ? 3 : big ? 5 : 7;
  // candidates, then the one whose difficulty rank among them matches the target (an easy stage takes a gentle deal,
  // a boss the knottiest): ranks stay meaningful on every board size, while size itself carries the long climb
  const cands: { vs: SVial[]; par: number; d: number }[] = [];
  for (let t = 0; t < 60 && cands.length < want; t++) {
    const vs = deal(rng, p);
    if (p.colors > 2 && tooEasy(vs)) continue;
    const proof = solve(vs, big ? 60000 : 30000);
    if (!proof.moves) continue;
    const sh = shortest(vs, big ? 25000 : 40000);
    const par = Math.min(proof.moves.length, sh?.length ?? Infinity);
    const { d } = measure(vs, par, rng, big ? 16 : 24, 0.72 + 0.24 * Math.min(1, stage / 80));
    cands.push({ vs, par, d });
  }
  cands.sort((a, b) => a.d - b.d || a.par - b.par);
  let best: { vs: SVial[]; par: number; d: number } | null = cands.length ? cands[Math.round(target * (cands.length - 1))] : null;
  if (!best) {
    // fallback, still finishable: one colour fewer, and as a last resort one more empty vial
    for (let t = 0; t < 80 && !best; t++) {
      const q = t < 40 ? { ...p, colors: p.colors - 1 } : { ...p, empty: p.empty + 1 };
      const vs = deal(rng, q);
      const proof = solve(vs, 100000);
      if (proof.moves) { best = { vs, par: proof.moves.length, d: target }; p.colors = q.colors; }
    }
  }
  const hidden = hideLayers(best!.vs, p.hidden, rng);
  const vials: Vial[] = best!.vs.map((v, i) => ({ layers: v.layers.slice(), hidden: hidden[i], cap: v.cap, lock: v.lock }));
  return { stage, colors: p.colors, cap: p.cap, vials, par: Math.max(p.colors, best!.par), difficulty: best!.d, target, boss: p.boss, seed: `${tag}-${stage}` };
}
