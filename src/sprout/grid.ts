// Sproutpop board rules: a hex grid of bubbles hanging from the ceiling (even rows have 9 cells, odd rows 8, shifted
// half a bubble). A shot flies from the launcher, bounces off the side walls, and sticks to the first bubble (or the
// ceiling) it touches. Three or more of the same colour connected to it pop; anything left hanging with no path to
// the ceiling falls. Some bubbles hold a sprout (freeing them all wins the stage), stones never pop (they only fall),
// ice bubbles thaw into normal bubbles when a pop happens next to them, and bombs burst everything around them when
// they are popped or hit by a pop. Shared by the stage builder (its test player), the game and the 3D scene.
//
// Units: bubble radius 1, so a cell's centre is x = 1 + 2c (+1 on odd rows), y = 1 + r·√3 going down.

export const COLS = 9;
export const MAX_ROWS = 15; // a bubble stuck below this row ends the stage
export const SQ3 = Math.sqrt(3);
export const W = COLS * 2;
/** where the launcher sits (y, going down) */
export const LAUNCH_Y = 1 + (MAX_ROWS + 1.6) * SQ3;

/** cell content: 0 empty; colours 1…6; specials below */
export const STONE = 20;
export const BOMB = 21;
export interface Cell { k: number; sprout?: boolean; ice?: boolean }
export type Grid = (Cell | null)[][];

export const width = (r: number) => (r % 2 ? COLS - 1 : COLS);
export const cx = (r: number, c: number) => 1 + 2 * c + (r % 2 ? 1 : 0);
export const cy = (r: number) => 1 + r * SQ3;
export const inGrid = (r: number, c: number) => r >= 0 && c >= 0 && c < width(r) && r <= MAX_ROWS + 1;
export const isColour = (k: number) => k >= 1 && k <= 9;

export function neighbours(r: number, c: number): [number, number][] {
  const odd = r % 2 === 1;
  const d = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return d.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(([rr, cc]) => inGrid(rr, cc));
}

export const get = (g: Grid, r: number, c: number) => g[r]?.[c] ?? null;
export function put(g: Grid, r: number, c: number, cell: Cell | null) {
  while (g.length <= r) g.push(new Array(width(g.length)).fill(null));
  g[r][c] = cell;
}
export const cloneGrid = (g: Grid): Grid => g.map((row) => row.map((x) => (x ? { ...x } : null)));
export const lowestRow = (g: Grid) => { for (let r = g.length - 1; r >= 0; r--) if (g[r].some(Boolean)) return r; return -1; };

/** the colours still on the board (what the launcher may load) */
export function coloursOn(g: Grid): number[] {
  const s = new Set<number>();
  g.forEach((row) => row.forEach((x) => { if (x && isColour(x.k)) s.add(x.k); }));
  return [...s].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ the shot

export interface Flight { cell: [number, number] | null; path: [number, number][]; bounces: number }

/**
 * Fly a shot from the launcher at an angle (radians from straight up, + = right) until it touches a bubble or the
 * ceiling, and say which empty cell it settles in. `path` holds the start, each wall bounce and the end point.
 */
export function fly(g: Grid, angle: number, maxLen = 160): Flight {
  let x = W / 2, y = LAUNCH_Y;
  let dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const path: [number, number][] = [[x, y]];
  let bounces = 0;
  const step = 0.2, hit2 = 1.7 * 1.7;
  for (let s = 0; s < maxLen / step; s++) {
    x += dx * step; y += dy * step;
    if (x < 1) { x = 2 - x; dx = -dx; path.push([1, y]); bounces++; }
    if (x > W - 1) { x = 2 * (W - 1) - x; dx = -dx; path.push([W - 1, y]); bounces++; }
    let touch = y <= 1;
    if (!touch) {
      const rr = Math.round((y - 1) / SQ3);
      for (let r = rr - 1; r <= rr + 1 && !touch; r++) {
        if (r < 0 || r >= g.length) continue;
        for (let c = 0; c < g[r].length; c++) {
          if (!g[r][c]) continue;
          const ddx = cx(r, c) - x, ddy = cy(r) - y;
          if (ddx * ddx + ddy * ddy < hit2) { touch = true; break; }
        }
      }
    }
    if (touch) { path.push([x, y]); return { cell: snap(g, x, y), path, bounces }; }
  }
  path.push([x, y]);
  return { cell: null, path, bounces };
}

/** the empty cell nearest a point that can hold a bubble (on the ceiling row or next to a bubble) */
export function snap(g: Grid, x: number, y: number): [number, number] | null {
  let best: [number, number] | null = null, bd = Infinity;
  const rr = Math.max(0, Math.round((y - 1) / SQ3));
  for (let r = Math.max(0, rr - 1); r <= rr + 1; r++) {
    for (let c = 0; c < width(r); c++) {
      if (get(g, r, c)) continue;
      if (r > 0 && !neighbours(r, c).some(([a, b]) => get(g, a, b))) continue;
      const d = (cx(r, c) - x) ** 2 + (cy(r) - y) ** 2;
      if (d < bd) { bd = d; best = [r, c]; }
    }
  }
  return best;
}

// ------------------------------------------------------------------ after a bubble sticks

export interface Outcome {
  popped: [number, number][];
  fallen: [number, number][];
  thawed: [number, number][];
  blasted: [number, number][];
  sprouts: number;
  /** cells (popped or fallen) that held a sprout */
  freed: [number, number][];
  lost: boolean;
}

const key = (r: number, c: number) => r * 16 + c;

/** place a shot bubble of colour k at (r, c) and resolve pops, bombs, thaws and falls (mutates g) */
export function resolve(g: Grid, r: number, c: number, k: number): Outcome {
  put(g, r, c, { k });
  const popped: [number, number][] = [], thawed: [number, number][] = [], blasted: [number, number][] = [];
  const gone = new Set<number>();
  // the colour group (a rainbow shot takes the colour of its best neighbour group)
  let colour = k;
  if (k === RAINBOW) {
    let bestK = 0, bestN = 0;
    for (const [a, b] of neighbours(r, c)) {
      const n = get(g, a, b);
      if (!n || !isColour(n.k) || n.ice) continue;
      const sz = group(g, a, b, n.k).length;
      if (sz > bestN) { bestN = sz; bestK = n.k; }
    }
    colour = bestK || 1;
    g[r][c] = { k: colour };
  }
  const grp = isColour(colour) ? group(g, r, c, colour) : [];
  if (k === BOMB_SHOT || grp.length >= 3) {
    const queue: [number, number][] = k === BOMB_SHOT ? [[r, c], ...neighbours(r, c)] : grp.slice();
    if (k === BOMB_SHOT) blasted.push(...neighbours(r, c));
    // bombs caught in a pop go off too
    for (let i = 0; i < queue.length; i++) {
      const [a, b] = queue[i];
      const x = get(g, a, b);
      if (!x || gone.has(key(a, b))) continue;
      if (x.k === STONE && k !== BOMB_SHOT && !blasted.some(([p, q]) => p === a && q === b)) continue;
      gone.add(key(a, b));
      if (x.k === BOMB) for (const n of neighbours(a, b)) { queue.push(n); blasted.push(n); }
    }
    for (const id of gone) { const a = Math.floor(id / 16), b = id % 16; popped.push([a, b]); }
    // ice next to a pop thaws
    for (const [a, b] of popped) for (const [p, q] of neighbours(a, b)) { const x = get(g, p, q); if (x?.ice && !gone.has(key(p, q))) { x.ice = false; thawed.push([p, q]); } }
  }
  const freed: [number, number][] = [];
  for (const [a, b] of popped) { if (g[a][b]?.sprout) freed.push([a, b]); g[a][b] = null; }
  // anything no longer hanging from the ceiling falls
  const fallen = floating(g);
  for (const [a, b] of fallen) { if (g[a][b]?.sprout) freed.push([a, b]); g[a][b] = null; }
  while (g.length && !g[g.length - 1].some(Boolean)) g.pop();
  return { popped, fallen, thawed, blasted, sprouts: freed.length, freed, lost: lowestRow(g) >= MAX_ROWS };
}
/** shot-only specials (boosters) */
export const RAINBOW = 30, BOMB_SHOT = 31;

/** the same-colour group connected to (r, c) (frozen bubbles don't join) */
export function group(g: Grid, r: number, c: number, k: number): [number, number][] {
  const out: [number, number][] = [], seen = new Set([key(r, c)]), st: [number, number][] = [[r, c]];
  while (st.length) {
    const [a, b] = st.pop()!;
    out.push([a, b]);
    for (const [p, q] of neighbours(a, b)) {
      const x = get(g, p, q);
      if (!x || x.k !== k || x.ice || seen.has(key(p, q))) continue;
      seen.add(key(p, q)); st.push([p, q]);
    }
  }
  return out;
}

/** bubbles with no path to the ceiling row */
export function floating(g: Grid): [number, number][] {
  const seen = new Set<number>(), st: [number, number][] = [];
  (g[0] ?? []).forEach((x, c) => { if (x) { seen.add(key(0, c)); st.push([0, c]); } });
  while (st.length) {
    const [a, b] = st.pop()!;
    for (const [p, q] of neighbours(a, b)) if (get(g, p, q) && !seen.has(key(p, q))) { seen.add(key(p, q)); st.push([p, q]); }
  }
  const out: [number, number][] = [];
  g.forEach((row, r) => row.forEach((x, c) => { if (x && !seen.has(key(r, c))) out.push([r, c]); }));
  return out;
}

export const sproutsLeft = (g: Grid) => g.reduce((s, row) => s + row.filter((x) => x?.sprout).length, 0);
export const bubblesLeft = (g: Grid) => g.reduce((s, row) => s + row.filter(Boolean).length, 0);
