// Slide Splash rules. A maze of cols × rows cells: walls, floor and spiky mines. The cube sits on a floor cell; swipe
// (or press an arrow) and it slides that way until the next cell is a wall, painting every floor cell it passes. A
// slide that runs into a mine pops the cube (undo, or start the maze again). Paint every floor cell to clear the maze.
//
// The generator carves the maze from a random walk of slides — each slide's cells are carved and the cell just past
// its end is kept as a wall — so that walk is a solution and every maze is solvable by construction. Mines go only on
// wall cells no slide of the walk depends on, so they're traps for wrong slides only. The solver is a breadth-first
// search over (position, painted cells) for the fewest slides.

export const WALL = 0, FLOOR = 1, MINE = 2;
export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export interface Maze { cols: number; rows: number; cells: number[]; start: number; walk: Dir[] }
export interface Slide { path: number[]; end: number; mine: boolean }

/** where a slide from `at` goes (its cells, where it stops, whether it hits a mine) */
export function slide(m: Maze, at: number, d: Dir): Slide {
  const path: number[] = [];
  let x = at % m.cols, y = Math.floor(at / m.cols);
  for (;;) {
    const nx = x + DX[d], ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) return { path, end: y * m.cols + x, mine: false };
    const c = m.cells[ny * m.cols + nx];
    if (c === WALL) return { path, end: y * m.cols + x, mine: false };
    x = nx; y = ny; path.push(ny * m.cols + nx);
    if (c === MINE) return { path, end: ny * m.cols + nx, mine: true };
  }
}
export const floorCount = (m: Maze) => m.cells.reduce((n, c) => n + (c === FLOOR ? 1 : 0), 0);

interface Rng { next: () => number; int: (n: number) => number }

/** carve a maze from a random walk of `steps` slides (or until `fill` of the inside is open) */
export function carve(cols: number, rows: number, o: { steps: number; maxLen: number; fill: number; mines: number }, rng: Rng): Maze | null {
  const cells = new Array(cols * rows).fill(WALL);
  const keep = new Set<number>(); // walls a slide of the walk stops against
  const inside = (x: number, y: number) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
  const sx = 1 + rng.int(cols - 2), sy = 1 + rng.int(rows - 2), start = sy * cols + sx;
  cells[start] = FLOOR;
  let x = sx, y = sy, open = 1, last = -1;
  const walk: Dir[] = [];
  const target = Math.round((cols - 2) * (rows - 2) * o.fill);
  for (let k = 0; k < o.steps * 6 && walk.length < o.steps && open < target; k++) {
    const d = rng.int(4) as Dir;
    if (d === ((last + 2) % 4) && rng.next() < 0.8) continue;
    // how far it can go: through carved cells or fresh rock, never into a kept wall
    let maxGo = 0;
    for (let s = 1; s <= o.maxLen + 6; s++) { const nx = x + DX[d] * s, ny = y + DY[d] * s; if (!inside(nx, ny) || keep.has(ny * cols + nx)) break; maxGo = s; }
    // an open run ahead forces the slide to go at least that far (it can't stop in the middle of a corridor)
    let minGo = 0;
    for (let s = 1; ; s++) { const nx = x + DX[d] * s, ny = y + DY[d] * s; if (!inside(nx, ny) || cells[ny * cols + nx] !== FLOOR) break; minGo = s; }
    if (maxGo === 0 || maxGo < minGo) continue;
    const want = Math.min(maxGo, minGo + 1 + rng.int(o.maxLen));
    // the slide stops where the next cell is (or becomes) a wall: that cell must not already be floor
    let go = want;
    while (go <= maxGo) { const nx = x + DX[d] * (go + 1), ny = y + DY[d] * (go + 1); if (!inside(nx, ny) || cells[ny * cols + nx] !== FLOOR) break; go++; }
    if (go > maxGo) continue;
    const stop = (y + DY[d] * (go + 1)) * cols + (x + DX[d] * (go + 1));
    for (let s = 1; s <= go; s++) { const c = (y + DY[d] * s) * cols + (x + DX[d] * s); if (cells[c] !== FLOOR) { cells[c] = FLOOR; open++; } }
    keep.add(stop);
    x += DX[d] * go; y += DY[d] * go; last = d; walk.push(d);
  }
  if (walk.length < 2) return null;
  const m: Maze = { cols, rows, cells, start, walk };
  // the walk must still replay exactly (later carving never touches a kept wall, so it does)
  let at = start;
  for (const d of walk) { const s = slide(m, at, d); if (s.mine) return null; at = s.end; }
  // mines: on wall cells next to the floor that no slide of the walk stops against
  const spots: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== WALL || keep.has(i)) continue;
    const cx = i % cols, cy = Math.floor(i / cols);
    if (!inside(cx, cy)) continue;
    if ([0, 1, 2, 3].some((d) => cells[(cy + DY[d]) * cols + cx + DX[d]] === FLOOR)) spots.push(i);
  }
  for (let k = 0; k < o.mines && spots.length; k++) cells[spots.splice(rng.int(spots.length), 1)[0]] = MINE;
  return m;
}

/** breadth-first search for the fewest slides that paint every floor cell (null when the cap is hit) */
export function solve(m: Maze, from: number, painted0: Set<number>, cap = 120000): { path: Dir[] | null; capped: boolean } {
  const floor: number[] = []; const idx = new Map<number, number>();
  m.cells.forEach((c, i) => { if (c === FLOOR) { idx.set(i, floor.length); floor.push(i); } });
  const n = floor.length, words = Math.ceil(n / 30);
  const enc = (set: number[]) => set.join(",");
  const start = new Array(words).fill(0);
  for (const c of painted0) { const k = idx.get(c); if (k !== undefined) start[(k / 30) | 0] |= 1 << (k % 30); }
  const full = (b: number[]) => { let cnt = 0; for (const w of b) { let v = w; while (v) { v &= v - 1; cnt++; } } return cnt === n; };
  const key = (pos: number, b: number[]) => pos + "|" + enc(b);
  type Node = { pos: number; bits: number[]; prev: Node | null; d: Dir | -1 };
  const root: Node = { pos: from, bits: start, prev: null, d: -1 };
  if (full(start)) return { path: [], capped: false };
  const seen = new Set<string>([key(from, start)]);
  let frontier: Node[] = [root], visited = 0;
  // slides from each cell are fixed: cache them
  const cache = new Map<number, Slide[]>();
  const slidesFrom = (p: number) => { let s = cache.get(p); if (!s) { s = ([0, 1, 2, 3] as Dir[]).map((d) => slide(m, p, d)); cache.set(p, s); } return s; };
  while (frontier.length) {
    const next: Node[] = [];
    for (const nd of frontier) {
      const sl = slidesFrom(nd.pos);
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const s = sl[d];
        if (s.mine || !s.path.length) continue;
        const bits = nd.bits.slice();
        for (const c of s.path) { const k = idx.get(c)!; bits[(k / 30) | 0] |= 1 << (k % 30); }
        const kk = key(s.end, bits);
        if (seen.has(kk)) continue;
        seen.add(kk);
        const child: Node = { pos: s.end, bits, prev: nd, d };
        if (full(bits)) { const path: Dir[] = []; for (let q: Node | null = child; q && q.d !== -1; q = q.prev) path.push(q.d as Dir); return { path: path.reverse(), capped: false }; }
        next.push(child);
        if (++visited > cap) return { path: null, capped: true };
      }
    }
    frontier = next;
  }
  return { path: null, capped: false };
}
