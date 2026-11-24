// Treatrio stages. A wall of shelf boxes in a dessert shop; each box shows a front row of three spots with more rows
// of treats waiting behind. Drag a treat into a free spot of another box; three of the same in a front row pop, and
// when a front row empties the row behind slides forward. Clear every treat to finish the stage.
//
// Stages never end: stage n is built from its number (same stage for everyone). For each stage the builder deals
// several candidates, proves each can be finished (depth-first solver over front rows + waiting rows), measures how
// often a careful player gets stuck, and keeps the one whose rank matches the difficulty curve — calm at the start of
// a shop, hardest at its boss. Twists arrive slowly: wrapped mystery treats (12+), locked boxes that open after a few
// pops (22+), treats frozen in ice until enough pops (32+), picky boxes that take one treat only (41+), hurry treats
// that must pop within a number of moves (51+), recipe locks that open when a certain treat pops (61+), tighter
// shelves (71+), and a boss stage closing every shop.
import { rngFrom, type Rng } from "../sudoku/rng";
import { ITEM_COUNT } from "./items";

export interface Zone { id: string; name: string; sky: [string, string, string]; wood: string; trim: string; glow: string; music: string }
export const ZONES: Zone[] = [
  { id: "bakery", name: "Sunrise Bakery", sky: ["#ffd9a8", "#ffb38a", "#ff8f7a"], wood: "#e8b07a", trim: "#fff1d6", glow: "#ffcf6b", music: "bakery" },
  { id: "candy", name: "Candy Corner", sky: ["#ffc2e2", "#ff9fd0", "#c77dff"], wood: "#f7a8cf", trim: "#fff0f8", glow: "#ff6fb5", music: "candy" },
  { id: "gelato", name: "Gelato Terrace", sky: ["#bff3ff", "#8fd8ff", "#7aa8ff"], wood: "#9fd8f0", trim: "#f0fbff", glow: "#6fd3ff", music: "gelato" },
  { id: "orchard", name: "Fruit Orchard", sky: ["#d6f7b0", "#9fe08a", "#5fbf8f"], wood: "#c99a62", trim: "#fff8e0", glow: "#9fe04a", music: "orchard" },
  { id: "tea", name: "Moon Tea House", sky: ["#3a2a6a", "#5a3f8f", "#c08a6a"], wood: "#8a5a3a", trim: "#f3d9b0", glow: "#ffd28a", music: "tea" },
  { id: "chocolate", name: "Cocoa Workshop", sky: ["#6a3f2a", "#a0603a", "#e0a070"], wood: "#7a4a2a", trim: "#f6d6b0", glow: "#ffb070", music: "cocoa" },
  { id: "starlight", name: "Starlight Diner", sky: ["#1a1446", "#3a2a8a", "#ff6fb5"], wood: "#4a3a8a", trim: "#d8d0ff", glow: "#9a8aff", music: "diner" },
  { id: "carnival", name: "Carnival Night", sky: ["#2a0f4a", "#7a1f6a", "#ffb03a"], wood: "#c0503a", trim: "#ffe0a0", glow: "#ffd23f", music: "carnival" },
];
export const STAGES_PER_ZONE = 10;
export const zoneOf = (stage: number) => ZONES[Math.floor((stage - 1) / STAGES_PER_ZONE) % ZONES.length];
export const loopOf = (stage: number) => Math.floor((stage - 1) / (STAGES_PER_ZONE * ZONES.length));

/** an item code: type 1…ITEM_COUNT, plus ICE × k when frozen until k pops have happened */
export const ICE = 1000;
export const typeOf = (v: number) => v % ICE;
export const iceOf = (v: number) => Math.floor(v / ICE);

export interface Box {
  /** rows front to back; each row has 3 spots (0 = empty) */
  rows: number[][];
  /** the box opens after this many pops (0 = open) */
  lock: number;
  /** recipe lock: the box opens once this treat has popped (0 = none) */
  key: number;
  /** picky box: only this treat may be put in (0 = any) */
  only: number;
}
export interface StageDef {
  stage: number;
  boxes: Box[];
  /** which treats this stage uses (indexes into the catalogue) */
  types: number[];
  /** wrapped mystery treats in the back rows (they show once they reach the front) */
  mystery: boolean;
  seconds: number;
  par: number;
  difficulty: number;
  boss: boolean;
  seed: string;
  cols: number;
  /** the solution the stage was built from (tests; the hint uses its own reasoning) */
  solution: Move[];
  /** hurry treats: the treat at a starting spot must pop by this move */
  bombs: Bomb[];
}

// ------------------------------------------------------------------ ramp

export interface Params { boxes: number; depth: number; empties: number; mystery: boolean; locks: number; ice: number; picky: number; bombs: number; keys: number; boss: boolean; cols: number }
export function paramsOf(stage: number): Params {
  const inZone = (stage - 1) % STAGES_PER_ZONE, loop = loopOf(stage), boss = inZone === 9 && stage > 9;
  // the shelf grows to 9 boxes (3 × 3 on a phone) and 4 rows deep — about 100 treats, a few minutes a stage
  const boxes = stage <= 2 ? 3 : stage <= 5 ? 4 : stage <= 9 ? 6 : Math.min(9, 6 + Math.floor((stage - 10) / 8) + (boss ? 1 : 0));
  const depth = stage === 1 ? 1 : stage <= 8 ? 2 : stage <= 30 ? 3 : 4;
  // free spots: roomy while learning, about half a spot per box — and from stage 71 the shelves get tighter, slowly
  const roomy = stage === 1 ? 3 : stage <= 3 ? 5 : boxes <= 6 ? 4 : Math.ceil(boxes * 0.45) + 1;
  const empties = stage < 71 ? roomy : Math.max(Math.ceil(boxes * 0.3) + 1, roomy - Math.floor((stage - 71) / 30) - (inZone % 2));
  const mystery = stage >= 12 && (inZone % 3 === 1 || boss || stage >= 90);
  const locks = stage >= 22 && (inZone % 4 === 2 || boss) ? (stage >= 70 ? 2 : 1) : 0;
  const ice = stage >= 32 && (inZone % 3 === 0 || boss) ? Math.min(6, 2 + Math.floor((stage - 32) / 25) + loop) : 0;
  // after 40: picky boxes (41+), hurry treats (51+), recipe locks (61+) — each on some stages, all of them on bosses
  const picky = stage >= 41 && (inZone % 3 === 0 || boss) ? (stage >= 100 ? 2 : 1) : 0;
  const bombs = stage >= 51 && (inZone % 3 === 1 || boss) ? Math.min(4, 1 + Math.floor((stage - 51) / 30)) : 0;
  const keys = stage >= 61 && (inZone % 4 === 0 || boss) ? (stage >= 110 ? 2 : 1) : 0;
  return { boxes, depth, empties, mystery, locks, ice, picky, bombs, keys, boss, cols: boxes <= 6 ? 2 : 3 };
}
export function targetOf(stage: number): number {
  const inZone = (stage - 1) % STAGES_PER_ZONE;
  const base = 0.1 + 0.5 * (1 - Math.exp(-stage / 50)) + Math.min(0.2, loopOf(stage) * 0.05);
  return Math.max(0.03, Math.min(0.95, base + (inZone / 9) * 0.18 - 0.07 + (inZone === 9 && stage > 9 ? 0.1 : 0)));
}

// ------------------------------------------------------------------ rules (shared with the game)

/** a box as the rules see it: rows of item codes, a pop-count lock, a recipe key (opens once that treat has popped)
 *  and a picky treat (the box only takes that treat) */
export interface S { rows: number[][]; lock: number; key: number; only: number }
/** progress: how many pops so far, and which treat types have popped (bit per type) */
export interface Prog { pops: number; got: number }
export const START: Prog = { pops: 0, got: 0 };

/** after a move: pop any front row of three alike, then let back rows slide forward into empty fronts */
export function settle(boxes: S[], pr: Prog): { pr: Prog; popped: { box: number; type: number }[]; advanced: number[] } {
  const popped: { box: number; type: number }[] = [], advanced: number[] = [];
  let { pops, got } = pr;
  let changed = true;
  while (changed) {
    changed = false;
    boxes.forEach((b, i) => {
      const f = b.rows[0];
      if (f && f[0] && f[1] && f[2] && typeOf(f[0]) === typeOf(f[1]) && typeOf(f[1]) === typeOf(f[2])) {
        const t = typeOf(f[0]);
        popped.push({ box: i, type: t }); b.rows[0] = [0, 0, 0]; pops++; got |= 1 << t; changed = true;
      }
      if (b.rows.length > 1 && b.rows[0].every((x) => !x)) { b.rows.shift(); advanced.push(i); changed = true; }
    });
  }
  return { pr: { pops, got }, popped, advanced };
}
export const isOpen = (b: { lock: number; key?: number }, pr: Prog) => b.lock <= pr.pops && (!b.key || ((pr.got >> b.key) & 1) === 1);
export const movable = (v: number, pr: Prog) => v > 0 && iceOf(v) <= pr.pops;
export const accepts = (b: { only?: number }, t: number) => !b.only || b.only === t;
export const cleared = (boxes: S[]) => boxes.every((b) => b.rows.every((r) => r.every((x) => !x)));

export interface Move { from: number; slot: number; to: number; at: number }

/** every sensible move: a movable treat in an open front row → a free spot in another open box that accepts it */
export function movesOf(boxes: S[], pr: Prog): (Move & { score: number })[] {
  const out: (Move & { score: number })[] = [];
  boxes.forEach((A, a) => {
    if (!isOpen(A, pr)) return;
    const seenType = new Set<number>();
    A.rows[0].forEach((v, i) => {
      if (!movable(v, pr) || seenType.has(typeOf(v))) return;
      seenType.add(typeOf(v));
      const t = typeOf(v);
      const leavesEmpty = A.rows[0].filter((x) => x).length === 1;
      let emptyBoxTried = false;
      boxes.forEach((B, b) => {
        if (b === a || !isOpen(B, pr) || !accepts(B, t)) return;
        const at = B.rows[0].indexOf(0);
        if (at < 0) return;
        const same = B.rows[0].filter((x) => x && typeOf(x) === t).length;
        const others = B.rows[0].filter((x) => x && typeOf(x) !== t).length;
        if (!same && !others && !B.only) { if (emptyBoxTried) return; emptyBoxTried = true; }
        const triple = same === 2;
        out.push({ from: a, slot: i, to: b, at, score: (triple ? 50 : 0) + (same === 1 && !others ? 12 : same ? 4 : 0) + (leavesEmpty ? 8 : 0) - others * 2 + (B.only ? 6 : 0) });
      });
    });
  });
  return out.sort((x, y) => y.score - x.score);
}

export function applyMove(boxes: S[], pr: Prog, m: Move) {
  const v = boxes[m.from].rows[0][m.slot];
  boxes[m.from].rows[0][m.slot] = 0;
  boxes[m.to].rows[0][m.at] = v;
  return settle(boxes, pr);
}

const copy = (bs: S[]): S[] => bs.map((b) => ({ rows: b.rows.map((r) => r.slice()), lock: b.lock, key: b.key, only: b.only }));
const keyOf = (bs: S[], pr: Prog) => `${pr.pops}.${pr.got}#` + bs.map((b) => b.rows.map((r, i) => (i === 0 ? r.slice().sort((x, y) => x - y) : r).join(",")).join("/")).join("|");

/** how hard it feels: a careful but imperfect player, many times; stuck early counts more than stuck late */
export function measure(start: S[], rng: Rng, runs = 14, skill = 0.75): number {
  const total = start.reduce((s, b) => s + b.rows.reduce((t, r) => t + r.filter((x) => x).length, 0), 0);
  let lost = 0;
  for (let r = 0; r < runs; r++) {
    let bs = copy(start), pr = START;
    const seen = new Set<string>();
    for (let step = 0; step < total * 3; step++) {
      if (cleared(bs)) break;
      const k = keyOf(bs, pr);
      if (seen.has(k)) break;
      seen.add(k);
      const ms = movesOf(bs, pr);
      if (!ms.length) break;
      const m = rng.next() < skill ? ms[0] : ms[rng.int(ms.length)];
      bs = copy(bs);
      pr = applyMove(bs, pr, m).pr;
    }
    if (!cleared(bs)) { const left = bs.reduce((s, b) => s + b.rows.reduce((t, r2) => t + r2.filter((x) => x).length, 0), 0); lost += left / total; }
  }
  return lost / runs;
}

// ------------------------------------------------------------------ builder: backwards from the solution

/**
 * Build a shelf by playing the game backwards from an empty one: "un-pop" a triple into an empty front row (pushing
 * the front row back first when the box has room), at once "un-move" one of the three out again (the reverse of the
 * move that completed it), then more un-moves to scramble. Read forwards, those steps are a solution — so every stage
 * can be cleared by construction, and its length is the par. Picky boxes are respected while building (a treat only
 * ever arrives in a picky box if it is that box's treat); a forward trace then checks everything and tells where
 * locks, recipe keys, ice and hurry timers can go without breaking the solution.
 */
function backwards(rng: Rng, p: Params, kinds: number[], triples: number, mix: number, picky: number[]): { boxes: S[]; moves: Move[] } {
  const boxes: S[] = Array.from({ length: p.boxes }, (_, i) => ({ rows: [[0, 0, 0]], lock: 0, key: 0, only: picky[i] ?? 0 }));
  const rev: Move[] = [];
  const ids = () => boxes.map((_, i) => i);
  const count = (r: number[]) => r.filter((x) => x).length;

  /** reverse of a forward move "treat from a → b": take the treat at front slot j of b and put it back into a */
  const unmove = (b: number, j: number, avoid = -1): boolean => {
    const B = boxes[b], v = B.rows[0][j];
    if (!v) return false;
    if (count(B.rows[0]) === 1 && B.rows.length > 1) return false;
    const t = typeOf(v);
    if (!accepts(B, t)) return false; // forwards the treat arrives in b: a picky box only takes its own
    const opts: { a: number; push: boolean; score: number }[] = [];
    for (const a of ids()) {
      if (a === b || a === avoid) continue;
      const A = boxes[a];
      const owns = A.rows[0].some((q) => q && typeOf(q) === t);
      if (A.rows[0].some((x) => !x)) {
        const f = A.rows[0].slice(); f[f.indexOf(0)] = v;
        if (!triple(f)) opts.push({ a, push: false, score: rng.next() + (owns ? 0 : 0.8) + (A.only && A.only !== t ? 0.6 : 0) });
      }
      if (A.rows.length < p.depth && count(A.rows[0]) > 0) opts.push({ a, push: true, score: rng.next() * 0.9 + 0.3 });
    }
    if (!opts.length) return false;
    opts.sort((x, y) => y.score - x.score);
    const { a, push } = opts[0], A = boxes[a];
    if (push) A.rows.unshift([0, 0, 0]);
    const at = A.rows[0].indexOf(0);
    B.rows[0][j] = 0; A.rows[0][at] = v;
    rev.push({ from: a, slot: at, to: b, at: j });
    return true;
  };

  for (let k = 0; k < triples; k++) {
    const t = kinds[k % kinds.length];
    const spots = ids().filter((i) => { const b = boxes[i]; return accepts(b, t) && (b.rows[0].every((x) => !x) || (b.rows.length < p.depth && count(b.rows[0]) > 0)); });
    if (!spots.length) continue;
    // a picky box for this treat gets first call; then empty front rows
    rng.shuffle(spots).sort((x, y) => (boxes[y].only === t ? 2 : 0) + (boxes[y].rows[0].every((q) => !q) ? 1 : 0) - (boxes[x].only === t ? 2 : 0) - (boxes[x].rows[0].every((q) => !q) ? 1 : 0));
    let placed = false;
    for (const i of spots.slice(0, 4)) {
      const b = boxes[i], pushed = b.rows[0].some((x) => x);
      if (pushed) b.rows.unshift([0, 0, 0]);
      b.rows[0] = [t, t, t];
      if (unmove(i, rng.int(3))) { placed = true; break; }
      b.rows[0] = [0, 0, 0];
      if (pushed) b.rows.shift();
    }
    if (!placed) continue;
    const n = mix + rng.int(2);
    for (let m = 0; m < n; m++) {
      const src = rng.shuffle(ids().filter((i) => boxes[i].rows[0].some((x) => x)));
      let ok = false;
      for (const i of src) {
        const slots = boxes[i].rows[0].map((x, s) => (x ? s : -1)).filter((s) => s >= 0);
        if (unmove(i, rng.pick(slots))) { ok = true; break; }
      }
      if (!ok) break;
    }
  }
  return { boxes, moves: rev.reverse() };
}
const triple = (f: number[]) => !!(f[0] && f[1] && f[2] && typeOf(f[0]) === typeOf(f[1]) && typeOf(f[1]) === typeOf(f[2]));

interface Trace { ok: boolean; firstTouch: number[]; poppedBefore: number[]; popAt: Map<string, number> }
/**
 * Play a move list forwards and record what happened: did every move stay legal and the shelf end empty; the first
 * move touching each box; the treat types popped before each move (bits); and the move after which each starting
 * treat (by its starting spot "box:row:slot") popped.
 */
function trace(start: S[], moves: Move[]): Trace {
  type C = { v: number; id: string } | null;
  const bs = start.map((b, bi) => ({ lock: b.lock, key: b.key, only: b.only, rows: b.rows.map((r, ri) => r.map((v, si): C => (v ? { v, id: `${bi}:${ri}:${si}` } : null))) }));
  const firstTouch = bs.map(() => Infinity), poppedBefore: number[] = [], popAt = new Map<string, number>();
  const fail: Trace = { ok: false, firstTouch, poppedBefore, popAt };
  let pr: Prog = START;
  let early = false;
  const settleT = (k: number) => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of bs) {
        const f = b.rows[0];
        if (f[0] && f[1] && f[2] && typeOf(f[0].v) === typeOf(f[1].v) && typeOf(f[1].v) === typeOf(f[2].v)) {
          const t = typeOf(f[0].v);
          f.forEach((c) => popAt.set(c!.id, k));
          b.rows[0] = [null, null, null]; pr = { pops: pr.pops + 1, got: pr.got | (1 << t) }; changed = true;
          if (k === 0) early = true;
        }
        if (b.rows.length > 1 && b.rows[0].every((c) => !c)) { b.rows.shift(); changed = true; }
      }
    }
  };
  settleT(0);
  if (early) return fail;
  for (let k = 0; k < moves.length; k++) {
    const m = moves[k];
    const A = bs[m.from], B = bs[m.to];
    poppedBefore.push(pr.got);
    if (!A || !B) return fail;
    firstTouch[m.from] = Math.min(firstTouch[m.from], k); firstTouch[m.to] = Math.min(firstTouch[m.to], k);
    if (!isOpen(A, pr) || !isOpen(B, pr)) return fail;
    const c = A.rows[0][m.slot];
    if (!c || !movable(c.v, pr) || !accepts(B, typeOf(c.v)) || B.rows[0][m.at]) return fail;
    A.rows[0][m.slot] = null; B.rows[0][m.at] = c;
    settleT(k + 1);
  }
  return { ok: bs.every((b) => b.rows.every((r) => r.every((c) => !c))), firstTouch, poppedBefore, popAt };
}

export interface Bomb { box: number; row: number; slot: number; deadline: number }

export function buildStage(stage: number, tag = "stage"): StageDef {
  const p = paramsOf(stage);
  const rng = rngFrom(`treatrio:${tag}:${stage}`);
  const target = targetOf(stage);
  const slots = p.boxes * 3 * p.depth;
  const triples = Math.max(1, Math.floor((slots - p.empties) / 3));
  const kindsN = Math.min(ITEM_COUNT, Math.max(2, Math.round(triples / (stage < 15 ? 1.2 : 1.5))));
  const want = p.boxes <= 4 ? 4 : 6;
  const mixBase = stage <= 2 ? 1 : stage <= 10 ? 2 : stage <= 40 ? 3 : 4;
  const cands: { boxes: S[]; moves: Move[]; d: number; kinds: number[]; bombs: Bomb[] }[] = [];
  for (let t = 0; t < 50 && cands.length < want; t++) {
    const kinds = rng.shuffle(Array.from({ length: ITEM_COUNT }, (_, i) => i + 1)).slice(0, kindsN);
    // picky boxes: chosen before building, each for one of the stage's treats
    const picky: number[] = [];
    if (p.picky) for (const i of rng.shuffle(Array.from({ length: p.boxes }, (_, k) => k)).slice(0, p.picky)) picky[i] = kinds[rng.int(Math.min(kinds.length, triples))];
    const r = backwards(rng, p, kinds, triples, mixBase + (t % 3), picky);
    if (r.boxes.some((b) => (b.rows.length > 1 && b.rows[0].every((x) => !x)) || b.rows.slice(1).some(triple))) continue;
    const got = r.boxes.reduce((s2, b) => s2 + b.rows.reduce((q, row) => q + row.filter((x) => x).length, 0), 0);
    if (got < Math.max(3, Math.floor(triples * 0.85) * 3)) continue;
    // a picky box must hold at least one stranger to move out, or it is no twist at all
    if (p.picky && !r.boxes.some((b) => b.only && b.rows.some((row) => row.some((x) => x && typeOf(x) !== b.only)))) continue;
    let tr = trace(r.boxes, r.moves);
    if (!tr.ok) continue;
    // pop-count locks
    if (p.locks) {
      for (const k of rng.shuffle(r.boxes.map((_, i) => i))) {
        if (r.boxes.filter((b) => b.lock).length >= p.locks) break;
        if (r.boxes[k].only) continue;
        r.boxes[k].lock = 1 + rng.int(2) + Math.floor(stage / 80);
        if (!trace(r.boxes, r.moves).ok) r.boxes[k].lock = 0;
      }
    }
    // recipe locks: a box first used after some treat has popped opens on that treat
    if (p.keys) {
      tr = trace(r.boxes, r.moves);
      const options = r.boxes.map((_, i) => i).filter((i) => !r.boxes[i].lock && !r.boxes[i].only && tr.firstTouch[i] > 0 && tr.firstTouch[i] < Infinity && tr.poppedBefore[tr.firstTouch[i]]);
      for (const k of rng.shuffle(options).slice(0, p.keys)) {
        const bits = tr.poppedBefore[tr.firstTouch[k]];
        const types = Array.from({ length: ITEM_COUNT }, (_, i) => i + 1).filter((x) => (bits >> x) & 1);
        r.boxes[k].key = rng.pick(types);
        if (!trace(r.boxes, r.moves).ok) r.boxes[k].key = 0;
      }
    }
    if (p.ice) {
      const spots: [number, number, number][] = [];
      r.boxes.forEach((b, k) => b.rows.forEach((row, ri) => row.forEach((v, si) => { if (v && ri <= 1) spots.push([k, ri, si]); })));
      let placed = 0;
      for (const [k, ri, si] of rng.shuffle(spots)) {
        if (placed >= p.ice) break;
        const v = r.boxes[k].rows[ri][si];
        r.boxes[k].rows[ri][si] = v + ICE * (1 + rng.int(2));
        if (trace(r.boxes, r.moves).ok) placed++; else r.boxes[k].rows[ri][si] = v;
      }
    }
    // hurry treats: front-row treats that pop early in the solution get a move deadline with room to spare
    const bombs: Bomb[] = [];
    if (p.bombs) {
      tr = trace(r.boxes, r.moves);
      if (!tr.ok) continue;
      const slack = Math.max(8, Math.round(r.moves.length * 0.3));
      const front: Bomb[] = [];
      r.boxes.forEach((b, k) => b.rows[0].forEach((v, si) => {
        const at = tr.popAt.get(`${k}:0:${si}`);
        if (v && !iceOf(v) && at !== undefined && at >= 3) front.push({ box: k, row: 0, slot: si, deadline: at + slack });
      }));
      // one per type at most, earliest-popping first so the timers feel urgent but fair
      const seenT = new Set<number>();
      for (const b of front.sort((x, y) => x.deadline - y.deadline)) {
        const t2 = typeOf(r.boxes[b.box].rows[0][b.slot]);
        if (seenT.has(t2)) continue;
        seenT.add(t2); bombs.push(b);
        if (bombs.length >= p.bombs) break;
      }
    }
    if (!trace(r.boxes, r.moves).ok) continue;
    cands.push({ boxes: r.boxes, moves: r.moves, kinds, bombs, d: measure(r.boxes, rng, p.boxes >= 9 ? 8 : 12, 0.7 + 0.25 * Math.min(1, stage / 80)) });
  }
  if (!cands.length) throw new Error("treatrio: no stage");
  cands.sort((a, b) => a.d - b.d || a.moves.length - b.moves.length);
  const best = cands[Math.round(target * (cands.length - 1))];
  const items = best.boxes.reduce((s2, b) => s2 + b.rows.reduce((q, r) => q + r.filter((x) => x).length, 0), 0);
  // the clock: about 3 s a treat, a little more once the twists pile up after stage 40
  const perTreat = stage > 40 ? 3.4 : 2.9;
  const seconds = Math.round(((20 + items * perTreat) * (1 - Math.min(0.3, stage / 400))) / 5) * 5;
  return {
    stage, boxes: best.boxes.map((b) => ({ rows: b.rows.map((r) => r.slice()), lock: b.lock, key: b.key, only: b.only })), types: best.kinds, mystery: p.mystery,
    seconds, par: best.moves.length, difficulty: best.d, boss: p.boss, seed: `${tag}-${stage}`, cols: p.cols, solution: best.moves, bombs: best.bombs,
  };
}
