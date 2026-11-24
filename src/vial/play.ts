// Playing a Moonvial stage. Tap a vial, tap another: the top colour pours across as far as it fits. A vial full of
// one colour is corked; if a star spirit is waiting for that colour the vial is handed over and leaves the shelf,
// otherwise it waits corked until that spirit turns up (spirits come for waiting colours first). Hidden layers turn
// visible once nothing sits on top of them. A locked vial opens once enough vials have been corked. The stage is clear
// when every colour has been delivered.
import type { Rng } from "../sudoku/rng";
import { pourAmount, type StageDef } from "./stage";

/** lock: the vial opens once this many vials have been corked (0 = open) */
export interface PVial { id: number; layers: number[]; hidden: boolean[]; cap: number; corked: boolean; gone: boolean; lock: number }
export interface Game {
  vials: PVial[];
  /** colours the spirits on the counter want (0 = empty slot) */
  orders: number[];
  /** colours still to be ordered, in order */
  queue: number[];
  delivered: number;
  colors: number;
  moves: number;
  extra: boolean;
}
export const SLOTS = 3;

export function startGame(d: StageDef, rng: Rng): Game {
  const colors = rng.shuffle(Array.from({ length: d.colors }, (_, i) => i + 1));
  const slots = Math.min(SLOTS, d.colors);
  return {
    vials: d.vials.map((v, i) => ({ id: i, layers: v.layers.slice(), hidden: v.hidden.slice(), cap: v.cap, corked: false, gone: false, lock: v.lock ?? 0 })),
    orders: colors.slice(0, slots), queue: colors.slice(slots), delivered: 0, colors: d.colors, moves: 0, extra: false,
  };
}

export const cloneGame = (g: Game): Game => ({ ...g, vials: g.vials.map((v) => ({ ...v, layers: v.layers.slice(), hidden: v.hidden.slice() })), orders: g.orders.slice(), queue: g.queue.slice() });

const live = (g: Game) => g.vials.filter((v) => !v.gone);
/** how many vials have been corked so far (delivered ones too) */
export const corkedCount = (g: Game) => g.vials.reduce((s, v) => s + (v.corked ? 1 : 0), 0);
export const isLocked = (g: Game, v: PVial) => (v.lock ?? 0) > corkedCount(g);
export const canPour = (g: Game, a: number, b: number) => {
  const A = g.vials[a], B = g.vials[b];
  if (!A || !B || A.gone || B.gone || A.corked || B.corked || isLocked(g, A) || isLocked(g, B)) return 0;
  return pourAmount(g.vials, a, b);
};


/** pour() leaves the hand-over to serve(), so the shelf can finish the pour animation first */
export interface PourResult { amount: number; color: number; revealed: boolean; corked: boolean; unlocked: number[] }

/** pour a → b (mutates g) */
export function pour(g: Game, a: number, b: number): PourResult {
  const amount = canPour(g, a, b);
  const A = g.vials[a], B = g.vials[b];
  const color = A.layers[A.layers.length - 1];
  for (let i = 0; i < amount; i++) { B.layers.push(A.layers.pop()!); B.hidden.push(false); A.hidden.pop(); }
  // the new top of A shows itself
  let revealed = false;
  if (A.layers.length && A.hidden[A.layers.length - 1]) { A.hidden[A.layers.length - 1] = false; revealed = true; }
  g.moves++;
  let corked = false;
  // a vial full of one colour is done, even if some of it was still hidden: show it and cork it
  if (B.layers.length === B.cap && B.layers.every((x) => x === B.layers[0])) { B.hidden = B.hidden.map(() => false); B.corked = true; corked = true; }
  const n = corkedCount(g);
  const unlocked = corked ? g.vials.filter((v) => v.lock && v.lock === n).map((v) => v.id) : [];
  return { amount, color, revealed, corked, unlocked };
}

/** hand corked vials to waiting spirits; fill empty slots, waiting colours first */
export function serve(g: Game): { vial: number; slot: number; color: number }[] {
  const out: { vial: number; slot: number; color: number }[] = [];
  let moved = true;
  while (moved) {
    moved = false;
    for (const v of g.vials) {
      if (!v.corked || v.gone) continue;
      const slot = g.orders.indexOf(v.layers[0]);
      if (slot < 0) continue;
      v.gone = true; g.orders[slot] = 0; g.delivered++;
      out.push({ vial: v.id, slot, color: v.layers[0] });
      moved = true;
    }
    for (let s = 0; s < g.orders.length; s++) {
      if (g.orders[s] || !g.queue.length) continue;
      const waiting = g.queue.findIndex((c) => g.vials.some((v) => v.corked && !v.gone && v.layers[0] === c));
      const k = waiting >= 0 ? waiting : 0;
      g.orders[s] = g.queue.splice(k, 1)[0];
      moved = true;
    }
  }
  return out;
}

export const cleared = (g: Game) => g.delivered >= g.colors;

/** any pour at all left? */
export function hasMove(g: Game): boolean {
  for (let a = 0; a < g.vials.length; a++) for (let b = 0; b < g.vials.length; b++) if (canPour(g, a, b)) return true;
  return false;
}

/** add the one extra empty vial a stage allows */
export function addVial(g: Game): number {
  g.extra = true;
  g.vials.push({ id: g.vials.length, layers: [], hidden: [], cap: g.vials[0]?.cap ?? 4, corked: false, gone: false, lock: 0 });
  return g.vials.length - 1;
}

export const liveCount = (g: Game) => live(g).length;
