// Picnic Pairs board rules (connect-pairs, "Onet" style). The board is a grid of cells; a cell is outside the board
// (-1, a hole in the shape), empty (0), a stone blocker (STONE) or a food tile (1…). Two identical tiles connect when a
// path joins them that turns at most twice and runs only through empty cells, holes, or the free ring around the
// board. After a pair is taken the tiles may slide (the stage's gravity: down, up, left, right, toward the middle
// across or up-down, or apart), and when no pair can be linked the remaining tiles are reshuffled.
// Shared by the stage builder (its test player), the game and the board renderer.

export const STONE = 99;
export type Gravity = "none" | "down" | "up" | "left" | "right" | "midX" | "midY" | "apart";
export interface Board { w: number; h: number; c: number[] }

export const at = (b: Board, x: number, y: number) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : b.c[y * b.w + x]);
export const isTile = (v: number) => v > 0 && v !== STONE;
/** can a path run through (x, y)? (off the board, holes and empty cells are open) */
const open = (b: Board, x: number, y: number) => { const v = at(b, x, y); return v === 0 || v === -1; };

/**
 * The path linking (ax, ay) to (bx, by) with at most two turns, as a list of corner points (start, turns, end), or
 * null. Among the paths found it prefers the fewest turns, then the shortest. The ring one cell outside the board is
 * usable, so tiles on the edge can link around the outside.
 */
export function link(b: Board, ax: number, ay: number, bx: number, by: number): [number, number][] | null {
  if (ax === bx && ay === by) return null;
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  // BFS over (x, y, dir) with turns as the cost; the board plus a ring of 1
  const W = b.w + 2, H = b.h + 2, N = W * H * 4;
  const turns = new Int8Array(N).fill(9), dist = new Int16Array(N).fill(9999), prev = new Int32Array(N).fill(-1);
  const key = (x: number, y: number, d: number) => ((y + 1) * W + (x + 1)) * 4 + d;
  let q: number[] = [];
  for (let d = 0; d < 4; d++) {
    const nx = ax + DX[d], ny = ay + DY[d];
    if (nx < -1 || ny < -1 || nx > b.w || ny > b.h) continue;
    if (!(nx === bx && ny === by) && !open(b, nx, ny)) continue;
    const k = key(nx, ny, d); turns[k] = 0; dist[k] = 1; prev[k] = -2 - d; q.push(k);
  }
  let best = -1;
  for (let t = 0; t <= 2 && best < 0; t++) {
    // spread straight along each direction at this turn count, then allow one more turn
    const next: number[] = [];
    for (let i = 0; i < q.length; i++) {
      const k = q[i];
      if (turns[k] !== t) continue;
      const d = k % 4, cell = Math.floor(k / 4), x = (cell % W) - 1, y = Math.floor(cell / W) - 1;
      if (x === bx && y === by) { if (best < 0 || dist[k] < dist[best]) best = k; continue; }
      for (let nd = 0; nd < 4; nd++) {
        const nt = t + (nd === d ? 0 : 1);
        if (nt > 2 || (nd === (d ^ 1))) continue;
        const nx = x + DX[nd], ny = y + DY[nd];
        if (nx < -1 || ny < -1 || nx > b.w || ny > b.h) continue;
        if (!(nx === bx && ny === by) && !open(b, nx, ny)) continue;
        const nk = key(nx, ny, nd);
        if (turns[nk] < nt || (turns[nk] === nt && dist[nk] <= dist[k] + 1)) continue;
        turns[nk] = nt; dist[nk] = dist[k] + 1; prev[nk] = k;
        if (nt === t) q.push(nk); else next.push(nk);
      }
    }
    if (best < 0) q = next;
  }
  if (best < 0) return null;
  // walk back to the start, then keep only the corners
  const cells: [number, number][] = [];
  let k = best;
  for (;;) {
    const cell = Math.floor(k / 4);
    cells.push([(cell % W) - 1, Math.floor(cell / W) - 1]);
    const p = prev[k];
    if (p < 0) break;
    k = p;
  }
  cells.push([ax, ay]);
  cells.reverse();
  const out: [number, number][] = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const [x0, y0] = cells[i - 1], [x1, y1] = cells[i], [x2, y2] = cells[i + 1];
    if (x1 - x0 !== x2 - x1 || y1 - y0 !== y2 - y1) out.push(cells[i]);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/** every pair that can be linked right now (a hint, the stuck check, the test player) */
export function moves(b: Board, limit = 9999): [number, number, number, number][] {
  const byKind = new Map<number, number[]>();
  for (let i = 0; i < b.c.length; i++) if (isTile(b.c[i])) { const a = byKind.get(b.c[i]); if (a) a.push(i); else byKind.set(b.c[i], [i]); }
  const out: [number, number, number, number][] = [];
  for (const cells of byKind.values()) {
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const ax = cells[i] % b.w, ay = Math.floor(cells[i] / b.w), bx = cells[j] % b.w, by = Math.floor(cells[j] / b.w);
      if (link(b, ax, ay, bx, by)) { out.push([ax, ay, bx, by]); if (out.length >= limit) return out; }
    }
  }
  return out;
}

export const tilesLeft = (b: Board) => b.c.reduce((n, v) => n + (isTile(v) ? 1 : 0), 0);
export const cloneBoard = (b: Board): Board => ({ w: b.w, h: b.h, c: b.c.slice() });

/**
 * Slide the tiles after a pair is taken. Tiles move through board cells only (holes and stones stay put and split a
 * line into separate runs). Returns where each tile went (from index → to index) for the animation.
 */
export function settle(b: Board, g: Gravity): Map<number, number> {
  const moved = new Map<number, number>();
  if (g === "none") return moved;
  const lines: number[][] = [];
  const col = (x: number) => Array.from({ length: b.h }, (_, y) => y * b.w + x);
  const row = (y: number) => Array.from({ length: b.w }, (_, x) => y * b.w + x);
  // each line is ordered so tiles move toward its END
  if (g === "down") for (let x = 0; x < b.w; x++) lines.push(col(x));
  if (g === "up") for (let x = 0; x < b.w; x++) lines.push(col(x).reverse());
  if (g === "right") for (let y = 0; y < b.h; y++) lines.push(row(y));
  if (g === "left") for (let y = 0; y < b.h; y++) lines.push(row(y).reverse());
  if (g === "midX" || g === "apart") for (let y = 0; y < b.h; y++) { const r = row(y), m = Math.floor(b.w / 2); const L = r.slice(0, m), R = r.slice(m).reverse(); if (g === "midX") lines.push(L, R); else lines.push(L.reverse(), R.reverse()); }
  if (g === "midY") for (let x = 0; x < b.w; x++) { const c = col(x), m = Math.floor(b.h / 2); lines.push(c.slice(0, m), c.slice(m).reverse()); }
  for (const line of lines) {
    // split into runs between holes / stones
    let run: number[] = [];
    const flush = () => {
      const tiles = run.filter((i) => isTile(b.c[i]));
      const slots = run.slice(run.length - tiles.length);
      const vals = tiles.map((i) => b.c[i]);
      run.forEach((i) => { b.c[i] = 0; });
      slots.forEach((i, k) => { b.c[i] = vals[k]; if (tiles[k] !== i) moved.set(tiles[k], i); });
      run = [];
    };
    for (const i of line) { const v = b.c[i]; if (v === -1 || v === STONE) flush(); else run.push(i); }
    flush();
  }
  return moved;
}

/** shuffle the remaining tiles among their own cells (until a move exists); returns old → new index */
export function shuffle(b: Board, rnd: () => number): Map<number, number> {
  const cells: number[] = [];
  for (let i = 0; i < b.c.length; i++) if (isTile(b.c[i])) cells.push(i);
  const vals = cells.map((i) => b.c[i]);
  let order = cells.map((_, i) => i);
  for (let tries = 0; tries < 40; tries++) {
    order = cells.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    cells.forEach((c, k) => { b.c[c] = vals[order[k]]; });
    if (moves(b, 1).length) break;
  }
  const map = new Map<number, number>();
  cells.forEach((c, k) => { map.set(cells[order[k]], c); });
  return map;
}
