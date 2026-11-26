// Wiggle Way rules. A side-on grid (x right, y up, y = 0 the bottom row). Cells: empty, ground (solid) or spikes.
// Items: apples (+1 segment), plums (−1 segment, never below 2) and one portal. The worm is a list of cells, head
// first. A move steps the head one cell (left, right, up, down) into an empty cell, an item or the portal; the body
// follows. Eating an apple: the tail stays (one longer). Then gravity: while no segment rests on something solid
// (ground, spikes or an item below it), the whole worm drops one row. Dropping off the bottom or onto spikes ends the
// try; the head reaching the portal (by moving or falling) wins.
//
// solve() is a breadth-first search over worm positions and eaten items, so every stage's shortest solution is exact.

export const EMPTY = 0, GROUND = 1, SPIKE = 2;
export type Item = "apple" | "plum";
export interface Board { w: number; h: number; cells: Uint8Array; items: { at: number; kind: Item }[]; portal: number }
export interface State { worm: number[]; eaten: number }
export type Dir = 0 | 1 | 2 | 3; // left, right, up, down
export const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, 1], [0, -1]];
export type Outcome = "ok" | "win" | "dead" | "blocked";

export const idx = (b: Board, x: number, y: number) => y * b.w + x;
export const xy = (b: Board, i: number) => [i % b.w, Math.floor(i / b.w)] as const;
export const keyOf = (s: State) => `${s.worm.join(",")}|${s.eaten}`;

/** the item (index) at a cell that is still there, or -1 */
export function itemAt(b: Board, s: State, i: number) {
  for (let k = 0; k < b.items.length; k++) if (b.items[k].at === i && !(s.eaten & (1 << k))) return k;
  return -1;
}
function solidAt(b: Board, s: State, x: number, y: number) {
  if (x < 0 || x >= b.w || y < 0 || y >= b.h) return false;
  const i = idx(b, x, y), c = b.cells[i];
  return c === GROUND || c === SPIKE || itemAt(b, s, i) >= 0;
}

/** one move: the new state, how it went, and how far the worm fell (for the animation) */
export function move(b: Board, s: State, d: Dir): { s: State; out: Outcome; fell: number; ate: number } {
  const [hx, hy] = xy(b, s.worm[0]);
  const nx = hx + DIRS[d][0], ny = hy + DIRS[d][1];
  if (nx < 0 || nx >= b.w || ny < 0 || ny >= b.h) return { s, out: "blocked", fell: 0, ate: -1 };
  const ni = idx(b, nx, ny);
  const c = b.cells[ni];
  if (c === GROUND) return { s, out: "blocked", fell: 0, ate: -1 };
  const k = itemAt(b, s, ni);
  const grow = k >= 0 && b.items[k].kind === "apple";
  // the body: the tail cell is free this move unless we grow
  const body = grow ? s.worm : s.worm.slice(0, -1);
  if (body.includes(ni)) return { s, out: "blocked", fell: 0, ate: -1 };
  let worm = [ni, ...body];
  let eaten = s.eaten;
  if (k >= 0) {
    eaten |= 1 << k;
    if (b.items[k].kind === "plum" && worm.length > 2) worm = worm.slice(0, -1);
  }
  if (c === SPIKE) return { s: { worm, eaten }, out: "dead", fell: 0, ate: k };
  if (ni === b.portal) return { s: { worm, eaten }, out: "win", fell: 0, ate: k };
  const ns: State = { worm, eaten };
  // gravity
  let fell = 0;
  for (;;) {
    let held = false;
    for (const p of ns.worm) { const [x, y] = xy(b, p); if (solidAt(b, ns, x, y - 1) && !ns.worm.includes(idx(b, x, y - 1))) { held = true; break; } }
    if (held) break;
    // drop one row
    const down: number[] = [];
    for (const p of ns.worm) { const [x, y] = xy(b, p); if (y - 1 < 0) return { s: ns, out: "dead", fell: fell + 1, ate: k }; down.push(idx(b, x, y - 1)); }
    ns.worm = down; fell++;
    if (ns.worm.some((p) => b.cells[p] === SPIKE)) return { s: ns, out: "dead", fell, ate: k };
    if (ns.worm[0] === b.portal) return { s: ns, out: "win", fell, ate: k };
  }
  return { s: ns, out: "ok", fell, ate: k };
}

/** settle the start position (the worm may begin in the air) */
export function settle(b: Board, s: State): State {
  for (let g = 0; g < b.h; g++) {
    let held = false;
    for (const p of s.worm) { const [x, y] = xy(b, p); if (solidAt(b, s, x, y - 1) && !s.worm.includes(idx(b, x, y - 1))) { held = true; break; } }
    if (held) return s;
    s = { ...s, worm: s.worm.map((p) => p - b.w) };
  }
  return s;
}

/** shortest solution (list of moves) or null; `cap` limits the search */
export function solve(b: Board, start: State, cap = 200000): { path: Dir[] | null; seen: number } {
  const seen = new Map<string, { prev: string | null; d: Dir }>();
  const k0 = keyOf(start);
  seen.set(k0, { prev: null, d: 0 });
  let q: State[] = [start];
  while (q.length) {
    const nq: State[] = [];
    for (const s of q) {
      const ks = keyOf(s);
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const r = move(b, s, d);
        if (r.out === "blocked" || r.out === "dead") continue;
        if (r.out === "win") {
          const path: Dir[] = [d];
          let cur: string | null = ks;
          while (cur && cur !== k0) { const e: { prev: string | null; d: Dir } = seen.get(cur)!; path.unshift(e.d); cur = e.prev; }
          return { path, seen: seen.size };
        }
        const kn = keyOf(r.s);
        if (seen.has(kn)) continue;
        seen.set(kn, { prev: ks, d });
        nq.push(r.s);
        if (seen.size > cap) return { path: null, seen: seen.size };
      }
    }
    q = nq;
  }
  return { path: null, seen: seen.size };
}
