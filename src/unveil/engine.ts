// Arrow Unveil rules. A board of cols × rows cells (some cells outside the board's shape). Arrows are ribbons through
// neighbouring cells, tail → head; the head points on in the direction of its last step. Tap an arrow: it slides head
// first in that direction, its body following its own path, until it leaves the board. If any other arrow sits on the
// straight line ahead of the head, the arrow bumps into it and slides back — a mistake that costs a heart.
//
// Removing an arrow only ever frees space, so a board is solvable exactly when "keep removing any free arrow" clears it.
// The generator builds boards in reverse play order — every new arrow must have a clear line to the edge past all the
// arrows already placed (those leave after it) — so every board it makes is solvable by construction.

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export interface Arrow { id: number; cells: number[]; dir: Dir; color: number }
export interface Board { cols: number; rows: number; mask: boolean[]; arrows: Arrow[] }

export const cellOf = (b: { cols: number }, x: number, y: number) => y * b.cols + x;
export const xyOf = (b: { cols: number }, i: number) => [i % b.cols, Math.floor(i / b.cols)] as const;
export const inside = (b: { cols: number; rows: number }, x: number, y: number) => x >= 0 && y >= 0 && x < b.cols && y < b.rows;

/** which arrow covers each cell (-1 = none) */
export function occupancy(b: Board, gone: Set<number> = new Set()): Int16Array {
  const o = new Int16Array(b.cols * b.rows).fill(-1);
  for (const a of b.arrows) if (!gone.has(a.id)) for (const c of a.cells) o[c] = a.id;
  return o;
}

/** the cells on the straight line ahead of an arrow's head, to the board's edge */
export function rayOf(b: { cols: number; rows: number }, a: Arrow): number[] {
  const out: number[] = [];
  let [x, y] = xyOf(b, a.cells[a.cells.length - 1]);
  for (;;) { x += DX[a.dir]; y += DY[a.dir]; if (!inside(b, x, y)) return out; out.push(cellOf(b, x, y)); }
}

/** the first other arrow in the way (its id and how many free cells the head gets before it), or null when free */
export function blocker(b: Board, a: Arrow, occ: Int16Array): { id: number; steps: number } | null {
  const ray = rayOf(b, a);
  for (let k = 0; k < ray.length; k++) { const o = occ[ray[k]]; if (o >= 0 && o !== a.id) return { id: o, steps: k }; }
  return null;
}

/** peel the board like a perfect player: layers of arrows that are free at the same time (the solution's depth) */
export function peel(b: Board): { layers: number[][]; solved: boolean } {
  const gone = new Set<number>(), layers: number[][] = [];
  for (;;) {
    const occ = occupancy(b, gone);
    const free = b.arrows.filter((a) => !gone.has(a.id) && !blocker(b, a, occ)).map((a) => a.id);
    if (!free.length) break;
    layers.push(free); for (const id of free) gone.add(id);
  }
  return { layers, solved: gone.size === b.arrows.length };
}

interface Rng { next: () => number; int: (n: number) => number }

/** fill a board in reverse play order; every arrow placed has a clear line out past the arrows placed before it */
export function generate(cols: number, rows: number, mask: boolean[], o: { minLen: number; maxLen: number; bend: number; fill: number; colors: number; tangle?: number; maxOpen?: number }, rng: Rng): Board {
  const b: Board = { cols, rows, mask, arrows: [] };
  const occ = new Int16Array(cols * rows).fill(-1);
  const cells = mask.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  const want = Math.round(cells.length * o.fill);
  let used = 0, fails = 0, id = 0;
  // cells on the line ahead of each placed arrow: a new arrow sitting there makes that arrow wait for it (depth)
  const rayHits = new Int16Array(cols * rows);
  const tries = 1 + Math.round((o.tangle ?? 0) * 120);
  const build = (at = -1): { path: number[]; dir: Dir } | null => {
    const h = at >= 0 ? at : cells[rng.int(cells.length)];
    if (occ[h] >= 0) return null;
    const [hx, hy] = xyOf(b, h);
    // the directions whose line to the edge is clear of every arrow placed so far
    const dirs = ([0, 1, 2, 3] as Dir[]).filter((d) => { let x = hx, y = hy; for (;;) { x += DX[d]; y += DY[d]; if (!inside(b, x, y)) return true; if (occ[cellOf(b, x, y)] >= 0) return false; } });
    if (!dirs.length) return null;
    // on hard boards, a head must face at least one board cell (a later arrow can sit there and block it); an arrow
    // at the edge pointing straight out could never be blocked and would be free from the start
    const blockable = (d: Dir) => { let x = hx, y = hy; for (;;) { x += DX[d]; y += DY[d]; if (!inside(b, x, y)) return false; if (mask[cellOf(b, x, y)]) return true; } };
    const pool = (o.maxOpen ?? 99) < 99 ? dirs.filter(blockable) : dirs;
    if (!pool.length) return null;
    const dir = pool[rng.int(pool.length)];
    // the ray cells (the body must not curl into its own path ahead)
    const ahead = new Set<number>(); { let x = hx, y = hy; for (;;) { x += DX[dir]; y += DY[dir]; if (!inside(b, x, y)) break; ahead.add(cellOf(b, x, y)); } }
    // grow the body backwards from the head
    const len = o.minLen + rng.int(o.maxLen - o.minLen + 1);
    const path = [h];
    let px = hx, py = hy, back = ((dir + 2) % 4) as Dir;
    for (let k = 1; k < len; k++) {
      // mostly keep going straight; turn with probability `bend` (the first step is always straight behind the head)
      const l = ((back + 1) % 4) as Dir, r = ((back + 3) % 4) as Dir, side = rng.next() < 0.5 ? [l, r] : [r, l];
      const order: Dir[] = k === 1 ? [back] : rng.next() < o.bend ? [...side, back] : [back, ...side];
      let moved = false;
      for (const d of order) {
        const nx = px + DX[d], ny = py + DY[d];
        if (!inside(b, nx, ny)) continue;
        const c = cellOf(b, nx, ny);
        if (!mask[c] || occ[c] >= 0 || path.includes(c) || ahead.has(c)) continue;
        path.push(c); px = nx; py = ny; back = d; moved = true; break;
      }
      if (!moved) break;
    }
    if (path.length < Math.min(o.minLen, 2) && rng.next() < 0.7) return null;
    return { path: path.reverse(), dir };
  };
  // the "open" arrows: placed arrows whose line out is still clear (in play they'd be free right now). A hard board
  // keeps this set tiny: every new arrow should sit on the line of an open arrow, so that arrow must now wait for it.
  // Then at the start only a handful of arrows can move, and the board unravels as one long chain of waiting arrows.
  const maxOpen = o.maxOpen ?? 99;
  const open = new Map<number, Set<number>>();
  while (used < want && fails < 60) {
    let best: { path: number[]; dir: Dir; blocked: number[] } | null = null, bestOver = Infinity, bestS = -Infinity;
    // aim new arrows at the lines of the open arrows (a head or body sitting there blocks them)
    const targets: number[] = [];
    for (const ray of open.values()) for (const i of ray) if (occ[i] < 0 && mask[i]) targets.push(i);
    for (let t = 0; t < tries; t++) {
      const c = build(targets.length && rng.next() < 0.85 ? targets[rng.int(targets.length)] : -1); if (!c) continue;
      const blocked: number[] = [];
      for (const [oid, ray] of open) if (c.path.some((i) => ray.has(i))) blocked.push(oid);
      const over = Math.max(0, open.size - blocked.length + 1 - maxOpen);
      const sc = blocked.length * 10 + c.path.reduce((n, i) => n + rayHits[i], 0) * 0.5 + c.path.length * 0.6 + rng.next();
      if (over < bestOver || (over === bestOver && sc > bestS)) { bestOver = over; bestS = sc; best = { ...c, blocked }; }
    }
    // too many arrows would be free: try again; if it keeps failing, a hard board stops here (the gaps left just
    // show the painting) rather than adding an arrow that's free from the start
    if (!best) { fails++; continue; }
    if (bestOver > 0) { if (fails < 14) { fails++; continue; } if (maxOpen < 99 && used >= cells.length * 0.85) break; }
    const a: Arrow = { id: id++, cells: best.path, dir: best.dir, color: rng.int(o.colors) };
    for (const c of a.cells) occ[c] = a.id;
    const ray = rayOf(b, a);
    for (const c of ray) rayHits[c]++;
    for (const oid of best.blocked) open.delete(oid);
    open.set(a.id, new Set(ray));
    b.arrows.push(a); used += a.cells.length; fails = 0;
  }
  return b;
}

/** where an arrow's ribbon runs when it leaves: its own cells, then the line ahead, then off the board */
export function trackOf(b: Board, a: Arrow, extra = 0): [number, number][] {
  const pts: [number, number][] = a.cells.map((c) => { const [x, y] = xyOf(b, c); return [x, y]; });
  let [x, y] = pts[pts.length - 1];
  const n = rayOf(b, a).length + a.cells.length + 2 + extra;
  for (let k = 0; k < n; k++) { x += DX[a.dir]; y += DY[a.dir]; pts.push([x, y]); }
  return pts;
}
