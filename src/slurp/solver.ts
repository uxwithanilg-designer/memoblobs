// Slurp Lab: the solver. It searches over "events" — a Slurper walks with pure steps anywhere its free region reaches,
// then takes one step that does something (slurps, pushes a crate, rides ice, crosses a portal, presses a switch …) —
// plus a few "park" moves (step aside to open a lane). The cost is the number of drags: an event by the same Slurper as
// the one before continues the same drag (cost 0, unless it stopped in goo), any other costs 1 (0-1 BFS). It finds par
// for the forge, a hint from any board, and tells when a board can't be won any more.
import { DIRS, type Drag, type Stage, type State } from "./types";
import { DIR_CH, blobsLeft, burnt, cloneState, move, occupancy, options, pathTo, region } from "./rules";

export interface SolveResult { drags: Drag[]; nodes: number; complete: boolean; solved: boolean }

function bits(a: ArrayLike<number>, test: (v: number) => boolean): string {
  let k = "", word = 0, bit = 0;
  for (let c = 0; c < a.length; c++) { if (test(a[c])) word |= 1 << bit; if (++bit === 30) { k += word.toString(36) + ","; word = 0; bit = 0; } }
  return k + word.toString(36);
}
export function keyOf(st: Stage, s: State, last: number): string {
  let k = bits(s.blobs, (v) => v >= 0);
  if (st.crates?.length) k += "c" + bits(s.crates, (v) => v > 0);
  if (st.bflags?.some((f) => f & 1)) k += "b" + bits(s.bub, (v) => v > 0);
  k += "t" + s.sw + bits(s.tiles, (v) => v === 34 || v === 48);
  for (const q of s.sl) k += q.alive ? `|${q.x}.${q.y}.${q.need}.${q.color}.${q.awake ? 1 : 0}.${q.cells.map((c) => c[0] * 8 + c[1]).join(":")}` : "|x";
  return k + "#" + last;
}

interface Node { s: State; last: number; parent: number; i: number; dirs: string; cost: number }

/** find the fewest-drag win from `start` (within `budget` expanded boards) */
export function solve(st: Stage, start: State, budget = 20000, parks = 2): SolveResult {
  const nodes: Node[] = [{ s: start, last: -1, parent: -1, i: -1, dirs: "", cost: start.moves }];
  const best = new Map<string, number>([[keyOf(st, start, -1), start.moves]]);
  let dq: number[] = [0], head = 0;
  const front: number[] = [];
  let expanded = 0;
  const fuses = Object.entries(st.fuse ?? {}).map(([c, n]) => [Number(c), n] as [number, number]);
  const finish = (id: number): SolveResult => {
    const chain: Node[] = [];
    for (let n = id; n > 0; n = nodes[n].parent) chain.push(nodes[n]);
    chain.reverse();
    const drags: Drag[] = [];
    for (const n of chain) { const l = drags[drags.length - 1]; if (l && l.i === n.i && n.cost === nodes[n.parent].cost) l.dirs += n.dirs; else drags.push({ i: n.i, dirs: n.dirs }); }
    return { drags, nodes: expanded, complete: true, solved: true };
  };
  if (blobsLeft(start) === 0) return { drags: [], nodes: 0, complete: true, solved: true };
  while (front.length || head < dq.length) {
    const id = front.length ? front.pop()! : dq[head++];
    const n = nodes[id];
    if ((best.get(keyOf(st, n.s, n.last)) ?? Infinity) < n.cost) continue;
    if (++expanded > budget) return { drags: [], nodes: expanded, complete: false, solved: false };
    for (let i = 0; i < n.s.sl.length; i++) {
      const q = n.s.sl[i];
      if (!q.alive || !q.awake) continue;
      const step = i === n.last ? 0 : 1, cost = n.cost + step;
      // a fuse that would burn before this drag ends: this branch is dead
      if (fuses.some(([c, lim]) => n.s.blobs[c] >= 0 && lim < Math.max(1, cost))) continue;
      const push = (s2: State, dirs: string, last: number) => {
        const k = keyOf(st, s2, last);
        if ((best.get(k) ?? Infinity) <= cost) return -1;
        best.set(k, cost);
        const cid = nodes.push({ s: s2, last, parent: id, i, dirs, cost }) - 1;
        if (step === 0) front.push(cid); else dq.push(cid);
        return cid;
      };
      const occ = occupancy(st, n.s), prev = region(st, n.s, occ, i);
      for (const o of options(st, n.s, i, prev)) {
        o.s.moves = cost;
        const cid = push(o.s, o.dirs, o.out.stop ? -1 : i);
        if (cid >= 0 && blobsLeft(o.s) === 0 && !burnt(st, o.s)) return finish(cid);
      }
      // park: step far aside (the last places the BFS found), to open a lane for someone else
      if (parks > 0) {
        const keys = [...prev.keys()];
        for (let k = keys.length - 1, made = 0; k > 0 && made < parks; k--, made++) {
          const p = keys[k], W = st.w, s2 = cloneState(n.s);
          s2.sl[i] = { ...s2.sl[i], x: p % W, y: Math.floor(p / W) };
          s2.moves = cost;
          push(s2, pathTo(prev, p).map((v) => DIR_CH[v]).join(""), i);
        }
      }
    }
    if (head > 4096) { dq = dq.slice(head); head = 0; }
  }
  return { drags: [], nodes: expanded, complete: true, solved: false };
}

/** Prof. Hoot's hint: the next drag from this board (null = it can't be won from here, or not found in time) */
export function hint(st: Stage, s: State, budget = 6000): { drag: Drag | null; dead: boolean } {
  const r = solve(st, s, budget);
  if (r.solved) return { drag: r.drags[0] ?? null, dead: false };
  return { drag: null, dead: r.complete };
}

/** replay drags from the stage start; true if they win (fuses included) */
export function verify(st: Stage, start: State, drags: Drag[]): boolean {
  const s = cloneState(start);
  for (const g of drags) {
    for (const ch of g.dirs) {
      if (!s.sl[g.i].alive) break;
      if (!move(st, s, g.i, DIR_CH.indexOf(ch))) return false;
    }
    s.moves++;
    if (burnt(st, s)) return false;
  }
  return blobsLeft(s) === 0;
}
export { DIRS };
