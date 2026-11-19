// Momo Jelly Jam solver: weighted best-first search over drags. From each position it tries every drop that squishes,
// sends a block out, lands on a special floor tile (pads, keys, switches, paint, teleports…) or docks at a gate, plus
// a few "park it out of the way" drops (the far end of each jelly's reach and a couple of seeded picks). Children are
// expanded lazily, positions are de-duplicated by key, lost positions are dropped, and the search is capped — the
// stage builder only keeps stages it could solve, so every stage has a proven route (and a par).
import { Rng } from "../roll/rng";
import { apply, bounds, counts, gateAtPos, info, isClear, isRect, normalise, occupancy, reach, squishCompatible, stateKey } from "./rules";
import { CRATE, DX, DY, takes, TILE, type Level, type Move, type State } from "./types";

export interface SolveOpts { cap?: number; weight?: number; seed?: number; parking?: number; /** give up after this many milliseconds */ ms?: number }
export interface SolveResult { ok: boolean; moves: Move[]; expanded: number; parked: number }

const hOf = (L: Level, s: State) => {
  let n = 0; const cols = new Set<number>();
  for (const p of s.pieces) if (counts(L, p)) { n++; cols.add(p.color); }
  return n - 0.5 * cols.size;
};
const dirOf = (dx: number, dy: number) => (dx === 0 && dy === 0 ? -1 : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2);

interface Cand { mv: Move; gain: number }
/** the drops worth trying from here */
export function candidates(L: Level, s: State, rng: Rng, parking = 3): Cand[] {
  const o = occupancy(L, s);
  const out: Cand[] = [];
  const special = info(L).tiles;
  const padCells = new Map(L.pads.map((p, i) => [p.cell, i]));
  // per colour: cells left on the board, and the widest gate along each axis (blocks grow towards a gate's size)
  const cellsOf = new Map<number, number>(), maxAlongX = new Map<number, number>(), maxAlongY = new Map<number, number>();
  for (const q of s.pieces) cellsOf.set(q.color, (cellsOf.get(q.color) ?? 0) + (q.c.length >> 1));
  const anyColour = (g: (typeof L.gates)[number]) => g.kind === "rainbow" || !!g.cycle;
  L.gates.forEach((g, i) => {
    if (s.gates[i] <= 0 || g.kind === "fake") return;
    const put = (m: Map<number, number>, w: number) => {
      const cols = anyColour(g) || g.kind === "box" ? [...cellsOf.keys()] : [g.color, ...(g.also !== undefined ? [g.also] : [])];
      for (const c of cols) m.set(c, Math.max(m.get(c) ?? 0, w));
    };
    if (g.side === 4) { put(maxAlongX, g.w); put(maxAlongY, g.h ?? 1); }
    else put(g.side === 0 || g.side === 2 ? maxAlongX : maxAlongY, g.w);
  });
  for (let k = 0; k < s.pieces.length; k++) {
    const p = s.pieces[k];
    const R = reach(L, s, k, o);
    if (R.length <= 1) continue;
    const b = bounds(p.c), rect = b.w * b.h === p.c.length >> 1;
    const park: Move[] = [];
    const build: { mv: Move; slack: number }[] = [];
    let pads = 0, tiles = 0;
    for (let ri = 1; ri < R.length; ri++) {
      const x = R[ri] % L.W, y = (R[ri] / L.W) | 0;
      let gain = 0;
      // sends out?
      if ((rect || L.rules?.blob) && p.color !== CRATE && gateAtPos(L, s, p, x, y, dirOf(x - p.x, y - p.y)) >= 0) gain = 2;
      // squishes? (touching a compatible jelly whose union with this one is a rectangle, pairwise or all together)
      if (!gain && p.color !== CRATE) {
        const abs: number[] = [];
        for (let i = 0; i < p.c.length; i += 2) abs.push(x + p.c[i], y + p.c[i + 1]);
        const touch: number[] = [];
        for (let i = 0; i < abs.length; i += 2) for (let d = 0; d < 4; d++) {
          const nx = abs[i] + DX[d], ny = abs[i + 1] + DY[d];
          if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
          const v = o[ny * L.W + nx];
          if (v > 0 && v !== k + 1 && squishCompatible(L, s.pieces[v - 1].color, p.color) && !touch.includes(v - 1)) touch.push(v - 1);
        }
        if (touch.length) {
          const tryUnion = (js: number[]) => {
            const all = abs.slice();
            for (const j of js) { const q = s.pieces[j]; for (let i = 0; i < q.c.length; i += 2) all.push(q.x + q.c[i], q.y + q.c[i + 1]); }
            return L.rules?.blob || isRect(normalise(all).c);
          };
          if (tryUnion(touch) || touch.some((j) => tryUnion([j]))) gain = 1;
          else {
            // half-built: touching its colour in a way that can still grow into a gate-sized block
            const all = abs.slice();
            for (const j of touch) { const q = s.pieces[j]; for (let i = 0; i < q.c.length; i += 2) all.push(q.x + q.c[i], q.y + q.c[i + 1]); }
            const nb = bounds(normalise(all).c), area = nb.w * nb.h;
            const fitsX = nb.w <= (maxAlongX.get(p.color) ?? 0), fitsY = nb.h <= (maxAlongY.get(p.color) ?? 0);
            if ((fitsX || fitsY || L.pads.length) && area <= (cellsOf.get(p.color) ?? 0)) build.push({ mv: { id: p.id, x, y }, slack: area - (all.length >> 1) });
          }
        }
      }
      // flush against its own gate, inside the gate's span (a block can be built right at the gate)
      if (!gain) for (let gi = 0; gi < L.gates.length; gi++) {
        const g = L.gates[gi];
        if (s.gates[gi] <= 0 || g.kind === "fake") continue;
        if (g.kind !== "box" && !takes(g, p.color, s.moves)) continue;
        const gh = g.h ?? 1, gx = g.at % L.W, gy = (g.at / L.W) | 0;
        const dock = g.side === 4 ? x >= gx && y >= gy && x + b.w <= gx + g.w && y + b.h <= gy + gh
          : g.side === 0 ? y + b.h === L.H && x >= g.at && x + b.w <= g.at + g.w
          : g.side === 2 ? y === 0 && x >= g.at && x + b.w <= g.at + g.w
          : g.side === 1 ? x + b.w === L.W && y >= g.at && y + b.h <= g.at + g.w
          : x === 0 && y >= g.at && y + b.h <= g.at + g.w;
        if (dock) { build.push({ mv: { id: p.id, x, y }, slack: -1 }); break; }
      }
      // a turn pad, or any other special tile underneath?
      let onPad = false, onTile = false;
      for (let i = 0; i < p.c.length; i += 2) {
        const ci = (y + p.c[i + 1]) * L.W + x + p.c[i];
        const j = padCells.get(ci); if (j !== undefined && s.pads[j] > 0) onPad = true;
        if (special && L.tiles[ci] > TILE.arrow && L.tiles[ci] !== TILE.ice && !(L.tiles[ci] === TILE.star || L.tiles[ci] === TILE.coin || L.tiles[ci] === TILE.key || L.tiles[ci] === TILE.target ? s.got.includes(ci) || s.cov.includes(ci) : false)) onTile = true;
      }
      if (gain) out.push({ mv: { id: p.id, x, y }, gain });
      else if (onPad && pads < 2) { pads++; out.push({ mv: { id: p.id, x, y }, gain: 0.2 }); }
      else if (onTile && tiles < 3) { tiles++; out.push({ mv: { id: p.id, x, y }, gain: 0.15 }); }
      else if (!build.length || build[build.length - 1].mv.x !== x || build[build.length - 1].mv.y !== y) park.push({ id: p.id, x, y });
    }
    // the tidiest half-built and dock spots
    build.sort((a, c) => a.slack - c.slack);
    for (const bm of build.slice(0, 6)) out.push({ mv: bm.mv, gain: 0.4 });
    // parking: the far end of its reach, plus seeded picks (belt and arrow tiles make other spots matter too)
    const picks = new Set<number>();
    for (let i = park.length - 1; i >= 0 && picks.size < Math.min(2, parking); i--) picks.add(i);
    for (let t = 0; t < 6 && picks.size < Math.min(park.length, parking); t++) picks.add(rng.int(0, park.length - 1));
    if (L.tiles.some((t) => t === TILE.belt)) for (let i = 0; i < park.length && picks.size < parking + 2; i++) {
      const m = park[i];
      if (L.tiles[m.y * L.W + m.x] === TILE.belt) picks.add(i);
    }
    for (const i of picks) out.push({ mv: park[i], gain: 0 });
  }
  return out;
}

interface Node { s: State | null; parent: number; mv: Move | null; g: number; f: number }

class Heap {
  private a: number[] = []; private f: Float64Array = new Float64Array(1024); private n = 0;
  push(i: number, f: number) {
    if (i >= this.f.length) { const g = new Float64Array(Math.max(this.f.length * 2, i + 1)); g.set(this.f); this.f = g; }
    this.f[i] = f; this.a.push(i); let c = this.a.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (this.f[this.a[p]] <= this.f[this.a[c]]) break; [this.a[p], this.a[c]] = [this.a[c], this.a[p]]; c = p; }
    this.n++;
  }
  pop(): number {
    const a = this.a, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last; let c = 0;
      for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l; if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r; if (m === c) break; [a[m], a[c]] = [a[c], a[m]]; c = m; }
    }
    this.n--;
    return top;
  }
  get size() { return this.n; }
}

/** find a route from state s to a cleared tray */
export function solve(L: Level, s0: State, o: SolveOpts = {}): SolveResult {
  const cap = o.cap ?? 2500, w = o.weight ?? 1.7, rng = new Rng(o.seed ?? L.seed ^ 0x51);
  const nodes: Node[] = [{ s: s0, parent: -1, mv: null, g: 0, f: 0 }];
  const heap = new Heap();
  heap.push(0, 0);
  const seen = new Set<string>();
  let expanded = 0;
  const t0 = Date.now(), ms = o.ms ?? Infinity;
  while (heap.size && expanded < cap) {
    if ((expanded & 15) === 0 && Date.now() - t0 > ms) break;
    const i = heap.pop(), n = nodes[i];
    let s = n.s;
    if (!s) {
      const ps = nodes[n.parent].s!;
      const r = apply(L, ps, n.mv!);
      if (!r) continue;
      s = r.s; n.s = s;
    }
    if (s.lost) { if (i) n.s = null; continue; }
    const key = stateKey(L, s);
    if (seen.has(key)) { if (i) n.s = null; continue; }
    seen.add(key);
    if (isClear(L, s)) {
      const moves: Move[] = [];
      for (let j = i; nodes[j].parent >= 0; j = nodes[j].parent) moves.push(nodes[j].mv!);
      moves.reverse();
      return { ok: true, moves, expanded, parked: countParked(L, s0, moves) };
    }
    if (L.rules?.limit && s.moves >= L.rules.limit) { if (i) n.s = null; continue; }
    expanded++;
    const h0 = hOf(L, s);
    for (const c of candidates(L, s, rng, o.parking ?? 3)) {
      const h = Math.max(0, h0 - c.gain * 0.75);
      nodes.push({ s: null, parent: i, mv: c.mv, g: n.g + 1, f: n.g + 1 + w * h + (c.gain ? 0 : 0.05) });
      heap.push(nodes.length - 1, nodes[nodes.length - 1].f);
    }
  }
  return { ok: false, moves: [], expanded, parked: 0 };
}

/** moves in a route that neither squish, turn nor send anything out ("aha" parking moves) */
export function countParked(L: Level, s0: State, moves: Move[]) {
  let s = s0, n = 0;
  for (const m of moves) {
    const r = apply(L, s, m);
    if (!r) break;
    if (!r.ev.some((e) => e.t === "merge" || e.t === "exit" || e.t === "turn")) n++;
    s = r.s;
  }
  return n;
}

/** a hint: the next move of a fresh route from here */
export function hint(L: Level, s: State): Move | null {
  const r = solve(L, s, { cap: 3000, seed: L.seed ^ s.moves });
  return r.ok && r.moves.length ? r.moves[0] : null;
}

/** is this drop legal from here? (reachable and a place it may rest) */
export function legal(L: Level, s: State, m: Move) {
  const k = s.pieces.findIndex((p) => p.id === m.id);
  if (k < 0) return false;
  const o = occupancy(L, s);
  return reach(L, s, k, o).includes(m.y * L.W + m.x);
}
