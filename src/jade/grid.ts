// Jade Slide board rules ("slide mahjong"). A grid of cells; 0 is empty, 1… is a tile kind, -1 is outside the board
// (a hole in the shape). Two identical tiles pair when they sit in the same row or column with nothing but empty
// cells between them — tap them. Or drag a tile along its row or column: it pushes the tiles in front of it into the
// empty space ahead; if the dragged tile then lines up with its twin, the pair clears, otherwise everything slides back.
//
// Stages are built BACKWARDS from an empty board: add a pair in a clear line, then (often) undo a slide by pulling the
// chain in front of one of the pair's tiles back into empty cells. Replaying those steps in reverse clears the board,
// so every stage is solvable by construction, and the steps are kept as the hint / solution.

export interface Board { w: number; h: number; c: number[] }
export interface Step { a: number; b: number; drag?: { from: number; dir: number; k: number } }

export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inside = (b: Board, x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h;
export const tileAt = (b: Board, x: number, y: number) => (inside(b, x, y) ? b.c[y * b.w + x] : -1);
export const isTile = (v: number) => v > 0;
export const cloneBoard = (b: Board): Board => ({ w: b.w, h: b.h, c: b.c.slice() });
export const tilesLeft = (b: Board) => b.c.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

/** a and b (indices) pair: same kind, same row or column, only empty cells between (holes block) */
export function canPair(b: Board, a: number, q: number): boolean {
  if (a === q || b.c[a] <= 0 || b.c[a] !== b.c[q]) return false;
  const ax = a % b.w, ay = Math.floor(a / b.w), qx = q % b.w, qy = Math.floor(q / b.w);
  if (ax !== qx && ay !== qy) return false;
  const dx = Math.sign(qx - ax), dy = Math.sign(qy - ay);
  for (let x = ax + dx, y = ay + dy; x !== qx || y !== qy; x += dx, y += dy) if (b.c[y * b.w + x] !== 0) return false;
  return true;
}

/** the chain pushed when the tile at i is dragged in direction d: i and the tiles right after it in that direction */
export function chainOf(b: Board, i: number, d: number): number[] {
  const [dx, dy] = DIRS[d];
  const out = [i];
  let x = i % b.w + dx, y = Math.floor(i / b.w) + dy;
  while (inside(b, x, y) && b.c[y * b.w + x] > 0) { out.push(y * b.w + x); x += dx; y += dy; }
  return out;
}
/** how far the chain at i can travel in direction d (empty cells ahead of the chain) */
export function room(b: Board, i: number, d: number): number {
  const ch = chainOf(b, i, d), last = ch[ch.length - 1], [dx, dy] = DIRS[d];
  let x = last % b.w + dx, y = Math.floor(last / b.w) + dy, n = 0;
  while (inside(b, x, y) && b.c[y * b.w + x] === 0) { n++; x += dx; y += dy; }
  return n;
}
/** slide the chain at i by k in direction d (mutates); returns the moves (from → to) */
export function slide(b: Board, i: number, d: number, k: number): [number, number][] {
  const ch = chainOf(b, i, d), [dx, dy] = DIRS[d];
  const vals = ch.map((c) => b.c[c]);
  ch.forEach((c) => { b.c[c] = 0; });
  const moved: [number, number][] = [];
  ch.forEach((c, n) => { const to = c + (dy * b.w + dx) * k; b.c[to] = vals[n]; moved.push([c, to]); });
  return moved;
}
/** after dragging i by k in d, the twin the dragged tile now pairs with (or -1) */
export function pairAfterSlide(b: Board, i: number, d: number, k: number): number {
  const t = cloneBoard(b);
  slide(t, i, d, k);
  const [dx, dy] = DIRS[d], at = i + (dy * b.w + dx) * k;
  return findTwin(t, at);
}
/** a tile that pairs with the tile at i right now (or -1) */
export function findTwin(b: Board, i: number): number {
  const x0 = i % b.w, y0 = Math.floor(i / b.w);
  for (const [dx, dy] of DIRS) {
    let x = x0 + dx, y = y0 + dy;
    while (inside(b, x, y)) {
      const v = b.c[y * b.w + x];
      if (v === 0) { x += dx; y += dy; continue; }
      if (v === b.c[i]) return y * b.w + x;
      break;
    }
  }
  return -1;
}

/** every move available: direct pairs and drag-to-pair moves */
export function allMoves(b: Board, limit = 9999): Step[] {
  const out: Step[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < b.c.length; i++) {
    if (b.c[i] <= 0) continue;
    const t = findTwinsAll(b, i);
    for (const q of t) { const key = Math.min(i, q) * 4096 + Math.max(i, q); if (!seen.has(key)) { seen.add(key); out.push({ a: i, b: q }); if (out.length >= limit) return out; } }
  }
  for (let i = 0; i < b.c.length; i++) {
    if (b.c[i] <= 0) continue;
    for (let d = 0; d < 4; d++) {
      const r = room(b, i, d);
      for (let k = 1; k <= r; k++) {
        const q = pairAfterSlide(b, i, d, k);
        if (q >= 0) { const [dx, dy] = DIRS[d]; out.push({ a: i + (dy * b.w + dx) * k, b: q, drag: { from: i, dir: d, k } }); if (out.length >= limit) return out; }
      }
    }
  }
  return out;
}
function findTwinsAll(b: Board, i: number): number[] {
  const out: number[] = [];
  const x0 = i % b.w, y0 = Math.floor(i / b.w);
  for (const [dx, dy] of DIRS) {
    let x = x0 + dx, y = y0 + dy;
    while (inside(b, x, y)) { const v = b.c[y * b.w + x]; if (v === 0) { x += dx; y += dy; continue; } if (v === b.c[i]) out.push(y * b.w + x); break; }
  }
  return out;
}

/** apply a move (mutates); returns the slide moves for the animation */
export function applyStep(b: Board, s: Step): [number, number][] {
  const moved = s.drag ? slide(b, s.drag.from, s.drag.dir, s.drag.k) : [];
  b.c[s.a] = 0; b.c[s.b] = 0;
  return moved;
}

// ------------------------------------------------------------------ building backwards
export interface BuildOpts { w: number; h: number; mask: (x: number, y: number) => boolean; pairs: number; kinds: number[]; slideShare: number; spread: number; hide: number; rnd: () => number }

/** how many pairs can be tapped right now */
export function directPairs(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.c.length; i++) {
    if (b.c[i] <= 0) continue;
    const x0 = i % b.w, y0 = Math.floor(i / b.w);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      let x = x0 + dx, y = y0 + dy;
      while (inside(b, x, y) && b.c[y * b.w + x] === 0) { x += dx; y += dy; }
      if (inside(b, x, y) && b.c[y * b.w + x] === b.c[i]) n++;
    }
  }
  return n;
}

/** one backward step on a copy: add a pair in a clear line, maybe undo a drag; null if nothing fits */
function backStep(b0: Board, cells: number[], kind: number, o: BuildOpts): { b: Board; step: Step } | null {
  const b = cloneBoard(b0), w = b.w;
  const pick = <T,>(a: T[]) => a[Math.floor(o.rnd() * a.length)];
  let placed: [number, number] | null = null;
  for (let tries = 0; tries < 40 && !placed; tries++) {
    const a = pick(cells); if (b.c[a] !== 0) continue;
    const [dx, dy] = pick(DIRS);
    const run: number[] = [];
    for (let x = a % w + dx, y = Math.floor(a / w) + dy; inside(b, x, y) && b.c[y * w + x] === 0; x += dx, y += dy) run.push(y * w + x);
    if (!run.length) continue;
    placed = [a, run[o.rnd() < o.spread ? Math.floor(o.rnd() * run.length) : 0]];
  }
  if (!placed) return null;
  const [a, q] = placed;
  b.c[a] = kind; b.c[q] = kind;
  let step: Step = { a, b: q };
  if (o.rnd() < o.slideShare) {
    const who = o.rnd() < 0.5 ? a : q, other = who === a ? q : a;
    const options: { d: number; k: number }[] = [];
    for (let d = 0; d < 4; d++) {
      const [bx, by] = DIRS[d ^ 1];
      const ch = chainOf(b, who, d);
      if (ch.includes(other) && ch.indexOf(other) !== 1) continue;
      let k = 0, x = who % w + bx, y = Math.floor(who / w) + by;
      while (inside(b, x, y) && b.c[y * w + x] === 0 && k < 4) { k++; x += bx; y += by; }
      for (let kk = 1; kk <= k; kk++) options.push({ d, k: kk });
    }
    if (options.length) {
      const { d, k } = pick(options);
      const [bx, by] = DIRS[d ^ 1];
      const ch = chainOf(b, who, d), vals = ch.map((c) => b.c[c]);
      ch.forEach((c) => { b.c[c] = 0; });
      const dest = ch.map((c) => c + (by * w + bx) * k);
      dest.forEach((c, n) => { b.c[c] = vals[n]; });
      const after = cloneBoard(b); slide(after, dest[0], d, k);
      if (canPair(after, who, other)) step = { a: who, b: other, drag: { from: dest[0], dir: d, k } };
      else { dest.forEach((c) => { b.c[c] = 0; }); ch.forEach((c, n) => { b.c[c] = vals[n]; }); }
    }
  }
  return { b, step };
}

/**
 * Build a board by un-playing: starting empty, each step adds a pair on two empty cells in a clear line, then — with
 * probability `slideShare` — undoes a drag: the chain starting at one of the pair's tiles is pulled back into empty
 * cells behind it, so the player has to slide it into line. With probability `hide` a step tries several placements
 * and keeps the one leaving the fewest pairs you could tap at once (harder to spot). Returns the board and the forward
 * solution, checked by replaying it.
 */
export function buildBackwards(o: BuildOpts): { board: Board; solution: Step[] } | null {
  const { w, h } = o;
  let b: Board = { w, h, c: new Array(w * h).fill(-1) };
  const cells: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (o.mask(x, y)) { b.c[y * w + x] = 0; cells.push(y * w + x); }
  const rev: Step[] = [];
  for (let p = 0; p < o.pairs; p++) {
    const kind = o.kinds[p % o.kinds.length];
    const tries = o.rnd() < o.hide ? 16 : 1;
    let best: { b: Board; step: Step } | null = null, bestN = Infinity;
    for (let t = 0; t < tries; t++) {
      const r = backStep(b, cells, kind, o); if (!r) continue;
      const n = tries > 1 ? directPairs(r.b) + (r.step.drag ? 0 : 0.5) + o.rnd() * 0.3 : 0;
      if (n < bestN) { bestN = n; best = r; }
    }
    if (!best) return null;
    b = best.b; rev.push(best.step);
  }
  // verify: replay forward
  const t = cloneBoard(b);
  const sol = rev.slice().reverse();
  for (const s of sol) {
    if (s.drag) {
      if (room(t, s.drag.from, s.drag.dir) < s.drag.k) return null;
      slide(t, s.drag.from, s.drag.dir, s.drag.k);
    }
    if (!canPair(t, s.a, s.b)) return null;
    t.c[s.a] = 0; t.c[s.b] = 0;
  }
  if (tilesLeft(t)) return null;
  return { board: b, solution: sol };
}

/** shuffle the remaining tiles among their cells (when the player is stuck), keeping at least one move */
export function shuffleTiles(b: Board, rnd: () => number): Map<number, number> {
  const cells: number[] = []; for (let i = 0; i < b.c.length; i++) if (b.c[i] > 0) cells.push(i);
  const vals = cells.map((i) => b.c[i]);
  let order = cells.map((_, i) => i);
  for (let t = 0; t < 40; t++) {
    order = cells.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    cells.forEach((c, k) => { b.c[c] = vals[order[k]]; });
    if (allMoves(b, 1).length) break;
  }
  const map = new Map<number, number>(); cells.forEach((c, k) => map.set(cells[order[k]], c));
  return map;
}
