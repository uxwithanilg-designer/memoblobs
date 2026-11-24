// Playing a Treatrio stage. Every treat has its own id (so the 3D scene can animate it). Only treats in a box's front
// row can be picked, and only from open boxes; frozen treats can't move until enough pops have happened (they still
// pop in place). Moving a treat into a box's front row that then holds three alike pops them; a front row left
// empty lets the next row slide forward. Locked boxes open after enough pops, recipe-locked boxes once their treat
// has popped; picky boxes only take their own treat; a hurry treat that hasn't popped by its deadline melts (the
// stage is lost).
import { iceOf, typeOf, type StageDef } from "./stage";

/** bomb: the move by which this treat must have popped (hurry treats) */
export interface Treat { id: number; t: number; ice: number; bomb?: number }
export interface PBox { rows: (Treat | null)[][]; lock: number; key: number; only: number }
/** got: bit per treat type that has popped (recipe locks) */
export interface Game { boxes: PBox[]; pops: number; got: number; moves: number; combo: number; total: number }

export function startGame(d: StageDef): Game {
  let id = 1;
  const bomb = new Map((d.bombs ?? []).map((b) => [`${b.box}:${b.row}:${b.slot}`, b.deadline]));
  const boxes = d.boxes.map((b, bi) => ({ lock: b.lock, key: b.key ?? 0, only: b.only ?? 0, rows: b.rows.map((r, ri) => r.map((v, si) => (v ? { id: id++, t: typeOf(v), ice: iceOf(v), bomb: bomb.get(`${bi}:${ri}:${si}`) } : null))) }));
  return { boxes, pops: 0, got: 0, moves: 0, combo: 0, total: id - 1 };
}

export const cloneGame = (g: Game): Game => ({ ...g, got: g.got ?? 0, boxes: g.boxes.map((b) => ({ lock: b.lock, key: b.key ?? 0, only: b.only ?? 0, rows: b.rows.map((r) => r.map((x) => (x ? { ...x } : null))) })) });

export const isOpen = (g: Game, b: number) => { const B = g.boxes[b]; return B.lock <= g.pops && (!B.key || ((g.got >> B.key) & 1) === 1); };
export const accepts = (g: Game, b: number, t: number) => !g.boxes[b].only || g.boxes[b].only === t;
export const canPick = (g: Game, b: number, slot: number) => {
  const x = g.boxes[b]?.rows[0]?.[slot];
  return !!x && isOpen(g, b) && x.ice <= g.pops;
};
/** free front spots of box b (for treat type t, when given: a picky box only takes its own) */
export const freeSlots = (g: Game, b: number, t = 0) => (isOpen(g, b) && (!t || accepts(g, b, t)) ? g.boxes[b].rows[0].map((x, i) => (x ? -1 : i)).filter((i) => i >= 0) : []);

export interface MoveResult {
  popped: { box: number; ids: number[]; t: number }[];
  advanced: number[];
  unlocked: number[];
  thawed: number[];
  cleared: boolean;
  /** a hurry treat ran out of moves */
  melted: number[];
}

/** move the treat at (from, slot) into (to, at); mutates g */
export function moveTreat(g: Game, from: number, slot: number, to: number, at: number): MoveResult {
  const x = g.boxes[from].rows[0][slot]!;
  g.boxes[from].rows[0][slot] = null;
  g.boxes[to].rows[0][at] = x;
  g.moves++;
  const before = g.pops;
  const lockedBefore = g.boxes.map((_, i) => !isOpen(g, i));
  const iceBefore = new Set(g.boxes.flatMap((b) => b.rows.flat().filter((q): q is Treat => !!q && q.ice > g.pops).map((q) => q.id)));
  const { popped, advanced } = settleGame(g);
  g.combo = popped.length ? g.combo + popped.length : 0;
  const unlocked = g.boxes.map((_, i) => i).filter((i) => lockedBefore[i] && isOpen(g, i));
  const thawed = g.pops > before ? [...iceBefore].filter((id) => g.boxes.some((b) => b.rows.flat().some((q) => q && q.id === id && q.ice <= g.pops))) : [];
  const melted = g.boxes.flatMap((b) => b.rows.flat().filter((q): q is Treat => !!q && q.bomb !== undefined && g.moves >= q.bomb).map((q) => q.id));
  return { popped, advanced, unlocked, thawed, cleared: g.boxes.every((b) => b.rows.every((r) => r.every((q) => !q))), melted };
}

/** pop front rows of three alike and let rows slide forward, until nothing changes (same rules as stage.settle) */
export function settleGame(g: Game): { popped: MoveResult["popped"]; advanced: number[] } {
  const popped: MoveResult["popped"] = [], advanced: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    g.boxes.forEach((b, i) => {
      const f = b.rows[0];
      if (f[0] && f[1] && f[2] && f[0].t === f[1].t && f[1].t === f[2].t) {
        popped.push({ box: i, ids: f.map((q) => q!.id), t: f[0].t });
        g.got = (g.got ?? 0) | (1 << f[0].t);
        b.rows[0] = [null, null, null]; g.pops++; changed = true;
      }
      if (b.rows.length > 1 && b.rows[0].every((q) => !q)) { b.rows.shift(); advanced.push(i); changed = true; }
    });
  }
  return { popped, advanced };
}

/** any move left at all? */
export function hasMove(g: Game): boolean {
  const pickable = g.boxes.some((b, i) => b.rows[0].some((_, s) => canPick(g, i, s)));
  if (!pickable) return false;
  for (let a = 0; a < g.boxes.length; a++) for (let s = 0; s < 3; s++) {
    if (!canPick(g, a, s)) continue;
    for (let b = 0; b < g.boxes.length; b++) if (b !== a && freeSlots(g, b, g.boxes[a].rows[0][s]!.t).length) return true;
  }
  return false;
}

/** the move a helper would suggest: complete a triple, else make a pair in a tidy box, else free a box */
export function hint(g: Game): { from: number; slot: number; to: number; at: number } | null {
  let best: { from: number; slot: number; to: number; at: number; s: number } | null = null;
  g.boxes.forEach((A, a) => A.rows[0].forEach((x, slot) => {
    if (!x || !canPick(g, a, slot)) return;
    g.boxes.forEach((B, b) => {
      if (b === a) return;
      const free = freeSlots(g, b, x.t);
      if (!free.length) return;
      const same = B.rows[0].filter((q) => q && q.t === x.t).length;
      const others = B.rows[0].filter((q) => q && q.t !== x.t).length;
      const leaves = A.rows[0].filter((q) => q).length === 1;
      const s = (same === 2 ? 100 : 0) + (same === 1 && !others ? 30 : same * 8) + (leaves ? 10 : 0) - others * 4 + (B.rows.length === 1 && !others && !same ? 2 : 0);
      if (!best || s > best.s) best = { from: a, slot, to: b, at: free[0], s };
    });
  }));
  return best ? { from: (best as { from: number }).from, slot: (best as { slot: number }).slot, to: (best as { to: number }).to, at: (best as { at: number }).at } : null;
}

/** shuffle every movable treat in front rows among their spots (a booster) */
export function shuffleFronts(g: Game, rnd: () => number): void {
  const spots: [number, number][] = [];
  const treats: Treat[] = [];
  g.boxes.forEach((b, i) => { if (!isOpen(g, i)) return; b.rows[0].forEach((x, s) => { if (x && x.ice <= g.pops) { spots.push([i, s]); treats.push(x); } }); });
  for (let k = treats.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [treats[k], treats[j]] = [treats[j], treats[k]]; }
  spots.forEach(([i, s], k) => { g.boxes[i].rows[0][s] = treats[k]; });
}

export const treatsLeft = (g: Game) => g.boxes.reduce((s, b) => s + b.rows.reduce((t, r) => t + r.filter((q) => q).length, 0), 0);
