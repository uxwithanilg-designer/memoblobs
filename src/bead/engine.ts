// Bead Rush rules and the real-time run. A track of 5 lanes runs forward; rows of things sit across it:
//   • block  — a numbered block. Running into it, your snake chews it: one bead per point, until the block breaks or you
//              run out of beads;
//   • orb    — a bead orb: +n beads;
//   • minus  — a red orb: −n beads;
//   • x2/half— a gate that doubles / halves your beads;
// Walls between lanes stop you sliding across for a stretch. Reach the finish with at least one bead.
//
// plan() is the exact best route (dynamic programming over lanes and bead counts, walls included), so every stage is
// proven survivable and the stars compare your beads at the finish with the best possible.

export type Cell = { t: "block" | "orb" | "minus"; v: number } | { t: "x2" | "half" } | null;
export interface Row { z: number; cells: Cell[] }
/** a wall in the gap between lane g and g+1, from z0 to z1 */
export interface Wall { g: number; z0: number; z1: number }
/** shift = most lanes you can cross between two rows at this speed */
export interface Track { lanes: number; rows: Row[]; walls: Wall[]; end: number; start: number; speed: number; shift: number }

export const LANES = 5;
export const laneX = (lane: number, lanes = LANES) => lane - (lanes - 1) / 2;

export function effect(c: Cell, L: number): number {
  if (!c) return L;
  switch (c.t) {
    case "block": return L > c.v ? L - c.v : 0;
    case "orb": return L + c.v;
    case "minus": return Math.max(0, L - c.v);
    case "x2": return L * 2;
    case "half": return Math.max(1, Math.floor(L / 2));
  }
}
/** can you slide from lane a to lane b between row i-1 and row i (walls in that gap)? */
export function canShift(t: Track, i: number, a: number, b: number) {
  if (a === b) return true;
  if (Math.abs(a - b) > t.shift) return false;
  const zPrev = i === 0 ? 0 : t.rows[i - 1].z, z = t.rows[i].z;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (const w of t.walls) if (w.g >= lo && w.g < hi && w.z0 <= zPrev + 0.6 && w.z1 >= z - 0.6) return false;
  return true;
}
/** the best route: final beads, and the lane per row (null if no route survives) */
export function plan(t: Track): { best: number; lanes: number[] } | null {
  const n = t.rows.length;
  let cur = new Array<number>(t.lanes).fill(-1); cur[Math.floor(t.lanes / 2)] = t.start;
  const from: number[][] = [];
  for (let i = 0; i < n; i++) {
    const nxt = new Array<number>(t.lanes).fill(-1), arg = new Array<number>(t.lanes).fill(-1);
    for (let b = 0; b < t.lanes; b++) {
      for (let a = 0; a < t.lanes; a++) {
        if (cur[a] <= 0 || !canShift(t, i, a, b)) continue;
        const L = effect(t.rows[i].cells[b], cur[a]);
        if (L > nxt[b]) { nxt[b] = L; arg[b] = a; }
      }
    }
    from.push(arg); cur = nxt;
  }
  let best = -1, lane = -1;
  for (let b = 0; b < t.lanes; b++) if (cur[b] > best) { best = cur[b]; lane = b; }
  if (best <= 0) return null;
  const lanes = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) { lanes[i] = lane; lane = from[i][lane]; }
  return { best, lanes };
}
/** a careless player: each row it takes the best-looking lane it can reach right now (no look-ahead) */
export function greedy(t: Track): number {
  let lane = Math.floor(t.lanes / 2), L = t.start;
  for (let i = 0; i < t.rows.length && L > 0; i++) {
    let bl = lane, bL = -1;
    for (let b = 0; b < t.lanes; b++) { if (!canShift(t, i, lane, b)) continue; const v = effect(t.rows[i].cells[b], L); if (v > bL || (v === bL && Math.abs(b - lane) < Math.abs(bl - lane))) { bL = v; bl = b; } }
    lane = bl; L = bL;
  }
  return Math.max(0, L);
}

// ---------------------------------------------------------------- the real-time run
export interface Run {
  x: number; z: number; L: number; state: "run" | "chew" | "dead" | "done";
  /** live copy of the cells (blocks lose points, orbs get eaten) */
  cells: Cell[][];
  trail: number[]; // x, z pairs of the head's path, newest last
  chewT: number; chewing: [number, number] | null; chewCount: number;
  /** shields: the next block you hit breaks for free */
  shield: number;
}
export type RunEvent = { e: "orb" | "minus" | "x2" | "half" | "bite" | "break" | "dead" | "done" | "bump" | "shield"; row?: number; lane?: number; v?: number };
export const HEAD_R = 0.34;
export const LAT_SPEED = 16;
/** lanes you can surely cross in one gap (gap length minus the row and wall margins) */
export const shiftFor = (gap: number, speed: number) => Math.max(1, Math.min(4, Math.floor(((gap - 2.2) * LAT_SPEED) / speed)));
const BLOCK_HALF = 0.5;

export function newRun(t: Track): Run {
  return { x: 0, z: 0, L: t.start, state: "run", cells: t.rows.map((r) => r.cells.map((c) => (c ? { ...c } : null))), trail: [0, 0], chewT: 0, chewing: null, chewCount: 0, shield: 0 };
}
const laneOf = (x: number, lanes: number) => Math.max(0, Math.min(lanes - 1, Math.round(x + (lanes - 1) / 2)));
function wallBlocks(t: Track, z: number, x0: number, x1: number) {
  // a wall at boundary between lane g and g+1 sits at x = laneX(g) + 0.5
  for (const w of t.walls) {
    if (z < w.z0 - HEAD_R || z > w.z1 + HEAD_R) continue;
    const wx = laneX(w.g, t.lanes) + 0.5;
    if ((x0 - wx) * (x1 - wx) < 0 || Math.abs(x1 - wx) < HEAD_R) return wx;
  }
  return null;
}
/** step the run by dt toward lateral target tx; returns events */
export function step(t: Track, r: Run, dt: number, tx: number, out: RunEvent[]): void {
  if (r.state === "dead" || r.state === "done") return;
  const half = (t.lanes - 1) / 2 + 0.5 - HEAD_R;
  // sideways: follow the finger, fast but not instant
  const want = Math.max(-half, Math.min(half, tx));
  const maxDx = LAT_SPEED * dt;
  let nx = r.x + Math.max(-maxDx, Math.min(maxDx, want - r.x));
  const wx = wallBlocks(t, r.z, r.x, nx);
  if (wx !== null) nx = r.x < wx ? Math.min(nx, wx - HEAD_R - 0.001) : Math.max(nx, wx + HEAD_R + 0.001);
  // side of a block: can't slide into it
  for (let i = 0; i < t.rows.length; i++) {
    const row = t.rows[i]; if (Math.abs(row.z - r.z) > BLOCK_HALF + HEAD_R - 0.05) continue;
    for (let b = 0; b < t.lanes; b++) {
      const c = r.cells[i][b]; if (!c || c.t !== "block") continue;
      const bx = laneX(b, t.lanes);
      if (Math.abs(nx - bx) < BLOCK_HALF + HEAD_R - 0.02 && Math.abs(r.x - bx) >= BLOCK_HALF + HEAD_R - 0.02) nx = r.x < bx ? bx - BLOCK_HALF - HEAD_R + 0.02 : bx + BLOCK_HALF + HEAD_R - 0.02;
    }
  }
  if (r.chewing) {
    // still in front of that block? (sliding off ends the chew)
    const [ri, li] = r.chewing, c = r.cells[ri][li];
    if (!c || c.t !== "block" || Math.abs(nx - laneX(li, t.lanes)) >= BLOCK_HALF + HEAD_R - 0.05) { r.chewing = null; r.state = "run"; }
  }
  r.x = nx;
  if (r.chewing) {
    const [ri, li] = r.chewing; const c = r.cells[ri][li] as { t: "block"; v: number };
    r.chewT -= dt;
    while (r.chewT <= 0 && c.v > 0 && r.L > 0) {
      c.v--; r.L--; r.chewCount++;
      r.chewT += Math.max(0.028, 0.085 - r.chewCount * 0.003);
      out.push({ e: "bite", row: ri, lane: li, v: c.v });
    }
    if (r.L <= 0) { r.state = "dead"; out.push({ e: "dead", row: ri, lane: li }); return; }
    if (c.v <= 0) { r.cells[ri][li] = null; r.chewing = null; r.state = "run"; out.push({ e: "break", row: ri, lane: li }); }
    return;
  }
  // forward
  let nz = r.z + t.speed * dt;
  const lane = laneOf(r.x, t.lanes);
  for (let i = 0; i < t.rows.length; i++) {
    const row = t.rows[i];
    if (row.z - BLOCK_HALF > nz + HEAD_R + 0.001 || row.z + BLOCK_HALF < r.z - HEAD_R) continue;
    for (let b = 0; b < t.lanes; b++) {
      const c = r.cells[i][b]; if (!c) continue;
      const bx = laneX(b, t.lanes);
      if (c.t === "block") {
        if (Math.abs(r.x - bx) < BLOCK_HALF + HEAD_R - 0.05 && r.z + HEAD_R <= row.z - BLOCK_HALF + 0.001 && nz + HEAD_R > row.z - BLOCK_HALF) {
          if (r.shield > 0) { r.shield--; r.cells[i][b] = null; out.push({ e: "shield", row: i, lane: b }); out.push({ e: "break", row: i, lane: b }); continue; }
          nz = row.z - BLOCK_HALF - HEAD_R; r.chewing = [i, b]; r.state = "chew"; r.chewT = 0; r.chewCount = 0; out.push({ e: "bump", row: i, lane: b });
        }
      } else if (b === lane && nz >= row.z - 0.2 && r.z < row.z + 0.4 && Math.abs(r.x - bx) < 0.6) {
        if (c.t === "orb") { r.L += c.v; out.push({ e: "orb", row: i, lane: b, v: c.v }); }
        else if (c.t === "minus") { r.L = Math.max(0, r.L - c.v); out.push({ e: "minus", row: i, lane: b, v: c.v }); }
        else if (c.t === "x2") { r.L *= 2; out.push({ e: "x2", row: i, lane: b }); }
        else { r.L = Math.max(1, Math.floor(r.L / 2)); out.push({ e: "half", row: i, lane: b }); }
        // a gate row is used up as a whole (you pass through one gate)
        if (c.t === "x2" || c.t === "half") r.cells[i] = r.cells[i].map((q) => (q && (q.t === "x2" || q.t === "half") ? null : q)); else r.cells[i][b] = null;
        if (r.L <= 0) { r.state = "dead"; out.push({ e: "dead", row: i, lane: b }); r.z = nz; return; }
      }
    }
  }
  r.z = nz;
  const tl = r.trail.length;
  if (Math.hypot(r.x - r.trail[tl - 2], r.z - r.trail[tl - 1]) > 0.04) { r.trail.push(r.x, r.z); if (r.trail.length > 4000) r.trail.splice(0, 2000); }
  if (r.z >= t.end) { r.state = "done"; out.push({ e: "done" }); }
}
