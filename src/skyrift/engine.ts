// Skyrift Gems rules: match-3 on a w × h board (y = 0 is the TOP row; gems fall toward larger y).
//
//   • Swap two neighbours to make a line of 3+ of one colour. A line of 4 makes a LINE gem (clears its row or column),
//     an L or T makes a BOMB (clears the 3 × 3 around it), a line of 5 makes a PRISM (clears every gem of one colour).
//     Swapping two specials together fires both. Specials fire when they are matched or hit by another blast.
//   • ICE (1–2 layers) lies under a cell: clearing a gem on it (by a match or a blast) cracks one layer. ROCKS (1–2 hits) fall like gems but never match; a match or blast next to them chips them.
//     CHESTS fall like gems and are collected when they reach the bottom row. HOLES (mask 0) are not part of the board:
//     gems fall straight past them.
//   • After a move the board clears, falls and refills from a seeded random stream until nothing matches. If no move is
//     left, it shuffles.
//
// The board is plain typed arrays so the worker, the bot and the scene share one engine. Every gem has an id so the
// scene can animate it from where it was to where it lands.

export const NONE = -1;
export const ROCK = 90, CHEST = 91;           // non-gem pieces stored in `c`
export const S_NONE = 0, S_ROW = 1, S_COL = 2, S_BOMB = 3, S_PRISM = 4;

export interface Board {
  w: number; h: number; colors: number;
  mask: Uint8Array;   // 1 = a cell of the board
  c: Int16Array;      // gem colour 0..colors-1, ROCK, CHEST or NONE
  s: Uint8Array;      // special kind
  ice: Uint8Array;    // ice layers
  hp: Uint8Array;     // rock hits left
  id: Int32Array;     // piece ids (for the animation)
  next: number;       // next id
  seed: number;       // refill random stream state
}
export interface Tally { gems: number[]; ice: number; rocks: number; chests: number; score: number; specials: number }
export const emptyTally = (colors: number): Tally => ({ gems: new Array(colors).fill(0), ice: 0, rocks: 0, chests: 0, score: 0, specials: 0 });

/** a step of a move, for the animation: what was cleared (and fired), then where everything fell */
export type Step =
  | { k: "swap"; a: number; b: number; back: boolean }
  | { k: "clear"; cells: number[]; ids: number[]; made: { i: number; id: number; s: number; c: number }[]; fired: { i: number; s: number }[]; ice: number[]; rocks: number[]; chests: number[]; chain: number; points: number }
  /** from[k] ≥ 0: the cell the piece falls from; from[k] < 0: a new gem that starts −from[k] rows above the column */
  | { k: "fall"; ids: number[]; to: number[]; from: number[]; c: number[]; s: number[]; hp: number[] }
  | { k: "shuffle" };

export const clone = (b: Board): Board => ({ ...b, mask: b.mask.slice(), c: b.c.slice(), s: b.s.slice(), ice: b.ice.slice(), hp: b.hp.slice(), id: b.id.slice() });

// ---------------------------------------------------------------- random (xorshift, state kept in the board)
function rnd(b: Board) {
  let x = b.seed | 0 || 0x2545f491;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  b.seed = x;
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}
const isGem = (b: Board, i: number) => b.c[i] >= 0 && b.c[i] < b.colors;

/** colour at (x, y) if it's a matchable gem, else -1 */
function col(b: Board, x: number, y: number) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
  const i = y * b.w + x;
  return b.mask[i] && isGem(b, i) ? b.c[i] : -1;
}

/** a fresh colour for a refill/new board that doesn't make a line with the gems left/above */
function pick(b: Board, i: number, avoidMatch: boolean) {
  const x = i % b.w, y = Math.floor(i / b.w);
  for (let t = 0; t < 12; t++) {
    const c = Math.floor(rnd(b) * b.colors);
    if (!avoidMatch) return c;
    const l = col(b, x - 1, y) === c && col(b, x - 2, y) === c;
    const u = col(b, x, y - 1) === c && col(b, x, y - 2) === c;
    const r = col(b, x + 1, y) === c && col(b, x + 2, y) === c;
    const d = col(b, x, y + 1) === c && col(b, x, y + 2) === c;
    if (!l && !u && !r && !d) return c;
  }
  return Math.floor(rnd(b) * b.colors);
}

/** fill every empty board cell (used for a new board: no ready-made lines) */
export function fillBoard(b: Board) {
  for (let i = 0; i < b.c.length; i++) if (b.mask[i] && b.c[i] === NONE) { b.c[i] = pick(b, i, true); b.s[i] = S_NONE; b.id[i] = b.next++; }
  if (!anyMove(b)) shuffle(b);
}

// ---------------------------------------------------------------- matching
/** every cell in a horizontal or vertical run of 3+, grouped (runs that share a cell join one group) */
export function findGroups(b: Board): { cells: number[]; h: number; v: number; color: number }[] {
  const n = b.w * b.h;
  const inH = new Int16Array(n), inV = new Int16Array(n);
  for (let y = 0; y < b.h; y++) {
    let x = 0;
    while (x < b.w) {
      const c = col(b, x, y); let e = x + 1;
      if (c >= 0) while (e < b.w && col(b, e, y) === c) e++;
      if (c >= 0 && e - x >= 3) for (let k = x; k < e; k++) inH[y * b.w + k] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < b.w; x++) {
    let y = 0;
    while (y < b.h) {
      const c = col(b, x, y); let e = y + 1;
      if (c >= 0) while (e < b.h && col(b, x, e) === c) e++;
      if (c >= 0 && e - y >= 3) for (let k = y; k < e; k++) inV[k * b.w + x] = e - y;
      y = e;
    }
  }
  const seen = new Uint8Array(n), out: { cells: number[]; h: number; v: number; color: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || (!inH[i] && !inV[i])) continue;
    const color = b.c[i], cells: number[] = [], stack = [i];
    let h = 0, v = 0;
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!; cells.push(p);
      h = Math.max(h, inH[p]); v = Math.max(v, inV[p]);
      const x = p % b.w, y = Math.floor(p / b.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) continue;
        const q = ny * b.w + nx;
        if (seen[q] || b.c[q] !== color || (!inH[q] && !inV[q])) continue;
        // only along a run: horizontal neighbours through inH, vertical through inV
        if (dy === 0 && !(inH[p] && inH[q])) continue;
        if (dx === 0 && !(inV[p] && inV[q])) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    out.push({ cells, h, v, color });
  }
  return out;
}

const neighbours = (b: Board, i: number) => {
  const x = i % b.w, y = Math.floor(i / b.w), out: number[] = [];
  if (x > 0) out.push(i - 1); if (x < b.w - 1) out.push(i + 1); if (y > 0) out.push(i - b.w); if (y < b.h - 1) out.push(i + b.w);
  return out.filter((q) => b.mask[q]);
};
export const canSwap = (b: Board, i: number) => b.mask[i] === 1 && (isGem(b, i) || b.c[i] === CHEST);

/** would swapping a and b do anything? (a match, or a special involved) */
export function wouldWork(b: Board, a: number, c: number) {
  if (!canSwap(b, a) || !canSwap(b, c) || !neighbours(b, a).includes(c)) return false;
  if (b.s[a] === S_PRISM || b.s[c] === S_PRISM) return isGem(b, a) && isGem(b, c);
  if (b.s[a] && b.s[c]) return true;
  swapRaw(b, a, c);
  const ok = lineAt(b, a) || lineAt(b, c);
  swapRaw(b, a, c);
  return ok;
}
function lineAt(b: Board, i: number) {
  const c = isGem(b, i) ? b.c[i] : -1; if (c < 0) return false;
  const x = i % b.w, y = Math.floor(i / b.w);
  let h = 1; for (let k = x - 1; col(b, k, y) === c; k--) h++; for (let k = x + 1; col(b, k, y) === c; k++) h++;
  let v = 1; for (let k = y - 1; col(b, x, k) === c; k--) v++; for (let k = y + 1; col(b, x, k) === c; k++) v++;
  return h >= 3 || v >= 3;
}
function swapRaw(b: Board, a: number, c: number) {
  let t = b.c[a]; b.c[a] = b.c[c]; b.c[c] = t;
  t = b.s[a]; b.s[a] = b.s[c]; b.s[c] = t;
  t = b.id[a]; b.id[a] = b.id[c]; b.id[c] = t;
}
/** every working swap (each pair once) */
export function moves(b: Board): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < b.c.length; i++) {
    if (!b.mask[i]) continue;
    const x = i % b.w;
    if (x < b.w - 1 && b.mask[i + 1] && wouldWork(b, i, i + 1)) out.push([i, i + 1]);
    if (i + b.w < b.c.length && b.mask[i + b.w] && wouldWork(b, i, i + b.w)) out.push([i, i + b.w]);
  }
  return out;
}
export const anyMove = (b: Board) => {
  for (let i = 0; i < b.c.length; i++) {
    if (!b.mask[i]) continue;
    if (i % b.w < b.w - 1 && b.mask[i + 1] && wouldWork(b, i, i + 1)) return true;
    if (i + b.w < b.c.length && b.mask[i + b.w] && wouldWork(b, i, i + b.w)) return true;
  }
  return false;
};

/** reshuffle the free gems (not specials under ice, rocks or chests) until a move exists and nothing matches */
export function shuffle(b: Board) {
  const free: number[] = [];
  for (let i = 0; i < b.c.length; i++) if (b.mask[i] && isGem(b, i) && !b.s[i]) free.push(i);
  for (let t = 0; t < 40; t++) {
    for (const i of free) b.c[i] = pick(b, i, true);
    if (!findGroups(b).length && anyMove(b)) return;
  }
}

// ---------------------------------------------------------------- the move
/** play a swap. Returns null if it does nothing (the scene shows a bounce), else the steps and what it collected */
export function play(b: Board, a: number, c: number, maxChain = 40): { steps: Step[]; tally: Tally } | null {
  if (!wouldWork(b, a, c)) return null;
  const tally = emptyTally(b.colors);
  const steps: Step[] = [{ k: "swap", a, b: c, back: false }];
  swapRaw(b, a, c);
  // specials swapped together, or a prism, fire straight away
  const pending: number[] = [];
  const forced: { i: number; s: number; color?: number }[] = [];
  if (b.s[a] === S_PRISM || b.s[c] === S_PRISM) {
    const [p, o] = b.s[a] === S_PRISM ? [a, c] : [c, a];
    forced.push({ i: p, s: S_PRISM, color: b.c[o] });
    // prism + special: every gem of that colour becomes that special and fires
    if (b.s[o] && b.s[o] !== S_PRISM) for (let i = 0; i < b.c.length; i++) if (b.c[i] === b.c[o] && i !== o) b.s[i] = b.s[o];
    if (b.s[o] === S_PRISM) { for (let i = 0; i < b.c.length; i++) if (b.mask[i] && isGem(b, i)) pending.push(i); }
  } else if (b.s[a] && b.s[c]) {
    // two specials: a cross or a big blast
    const big = b.s[a] === S_BOMB || b.s[c] === S_BOMB;
    forced.push({ i: c, s: big && (b.s[a] === S_BOMB && b.s[c] === S_BOMB) ? 5 : big ? 6 : 7 });
    pending.push(a);
  }
  resolve(b, a, c, pending, forced, steps, tally, maxChain);
  return { steps, tally };
}

/** the hammer: smash one piece (a gem, a rock or a frozen cell), then everything settles */
export function smash(b: Board, i: number): { steps: Step[]; tally: Tally } | null {
  if (!b.mask[i] || b.c[i] === NONE || b.c[i] === CHEST) return null;
  const tally = emptyTally(b.colors), steps: Step[] = [];
  if (b.c[i] === ROCK) b.hp[i] = 1;
  resolve(b, -1, -1, [i], [], steps, tally, 40);
  return { steps, tally };
}

function resolve(b: Board, a: number, c: number, pending: number[], forced: { i: number; s: number; color?: number }[], steps: Step[], tally: Tally, maxChain: number) {
  let chain = 0;
  for (; chain < maxChain; chain++) {
    const groups = chain === 0 && forced.length ? [] : findGroups(b);
    if (!groups.length && !forced.length && !pending.length) break;
    const clear = new Set<number>(pending); pending.length = 0;
    const made: { i: number; id: number; s: number; c: number }[] = [];
    for (const g of groups) {
      for (const i of g.cells) clear.add(i);
      // the special this group makes, at the swapped cell if it's in the group
      let s = S_NONE;
      if (g.h >= 5 || g.v >= 5) s = S_PRISM; else if (g.h >= 3 && g.v >= 3) s = S_BOMB; else if (g.h === 4) s = S_ROW; else if (g.v === 4) s = S_COL;
      if (s) {
        const at = g.cells.includes(a) && chain === 0 ? a : g.cells.includes(c) && chain === 0 ? c : g.cells[Math.floor(g.cells.length / 2)];
        made.push({ i: at, id: -1, s, c: g.color });
      }
    }
    // fire specials in the clear set (and the forced ones), adding their cells; specials hit by a blast fire too
    const fired: { i: number; s: number }[] = [];
    const queue: { i: number; s: number; color?: number }[] = [...forced]; forced.length = 0;
    for (const i of clear) if (b.s[i] && !made.some((m) => m.i === i && m.s === b.s[i])) queue.push({ i, s: b.s[i] });
    const firedAt = new Set<number>();
    while (queue.length) {
      const f = queue.shift()!;
      if (firedAt.has(f.i) && f.s < 5) continue;
      firedAt.add(f.i); fired.push({ i: f.i, s: f.s }); tally.specials++;
      for (const q of blast(b, f.i, f.s, f.color)) {
        if (!clear.has(q)) { clear.add(q); if (b.s[q] && !firedAt.has(q)) queue.push({ i: q, s: b.s[q] }); }
      }
    }
    // hits: ice under cleared cells, rocks next to cleared gems (or blasted), chests are never cleared
    const cells: number[] = [], ids: number[] = [], ice: number[] = [], rocks: number[] = [];
    const rockHit = new Set<number>();
    for (const i of clear) {
      if (!b.mask[i]) continue;
      if (b.c[i] === ROCK) { rockHit.add(i); continue; }
      if (b.c[i] === CHEST || b.c[i] === NONE) continue;
      if (b.ice[i]) { b.ice[i]--; ice.push(i); tally.ice++; }
      for (const q of neighbours(b, i)) if (b.c[q] === ROCK) rockHit.add(q);
    }
    for (const i of clear) {
      if (!b.mask[i] || !isGem(b, i)) continue;
      const m = made.find((mm) => mm.i === i);
      tally.gems[b.c[i]]++;
      if (m) { m.id = b.next++; b.c[i] = m.c; b.s[i] = m.s; cells.push(i); ids.push(b.id[i]); b.id[i] = m.id; continue; }
      cells.push(i); ids.push(b.id[i]);
      b.c[i] = NONE; b.s[i] = S_NONE; b.id[i] = -1;
    }
    for (const q of rockHit) {
      rocks.push(q);
      if (b.hp[q] > 1) b.hp[q]--; else { b.hp[q] = 0; cells.push(q); ids.push(b.id[q]); b.c[q] = NONE; b.id[q] = -1; tally.rocks++; }
    }
    const points = (cells.length * 10 + fired.length * 30) * (chain + 1);
    tally.score += points;
    steps.push({ k: "clear", cells, ids, made, fired, ice, rocks, chests: [], chain, points });
    fall(b, steps);
    // chests on the bottom row of their column are collected
    for (;;) {
      const got: number[] = [];
      for (let x = 0; x < b.w; x++) { for (let y = b.h - 1; y >= 0; y--) { const i = y * b.w + x; if (!b.mask[i]) continue; if (b.c[i] === CHEST) got.push(i); break; } }
      if (!got.length) break;
      const gids = got.map((i) => b.id[i]);
      for (const i of got) { b.c[i] = NONE; b.id[i] = -1; tally.chests++; }
      tally.score += 200 * got.length;
      steps.push({ k: "clear", cells: got, ids: gids, made: [], fired: [], ice: [], rocks: [], chests: got, chain, points: 200 * got.length });
      fall(b, steps);
    }
  }
  if (!anyMove(b)) { shuffle(b); steps.push({ k: "shuffle" }); }
}

/** the cells a special clears */
function blast(b: Board, i: number, s: number, color?: number): number[] {
  const x = i % b.w, y = Math.floor(i / b.w), out: number[] = [i];
  const add = (xx: number, yy: number) => { if (xx >= 0 && yy >= 0 && xx < b.w && yy < b.h && b.mask[yy * b.w + xx]) out.push(yy * b.w + xx); };
  if (s === S_ROW || s === 7) for (let k = 0; k < b.w; k++) add(k, y);
  if (s === S_COL || s === 7) for (let k = 0; k < b.h; k++) add(x, k);
  if (s === S_BOMB) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(x + dx, y + dy);
  if (s === 5) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) add(x + dx, y + dy);          // bomb + bomb
  if (s === 6) for (let d = -1; d <= 1; d++) { for (let k = 0; k < b.w; k++) add(k, y + d); for (let k = 0; k < b.h; k++) add(x + d, k); } // bomb + line
  if (s === S_PRISM) { const c = color ?? mostColor(b); for (let q = 0; q < b.c.length; q++) if (b.mask[q] && b.c[q] === c) out.push(q); }
  return out;
}
function mostColor(b: Board) {
  const n = new Array(b.colors).fill(0); for (let i = 0; i < b.c.length; i++) if (isGem(b, i)) n[b.c[i]]++;
  return n.indexOf(Math.max(...n));
}

/** gems, rocks and chests fall into the gaps (past holes); new gems come in from above */
function fall(b: Board, steps: Step[]) {
  const ids: number[] = [], to: number[] = [], from: number[] = [], cs: number[] = [], ss: number[] = [], hps: number[] = [];
  for (let x = 0; x < b.w; x++) {
    const cells: number[] = [];
    for (let y = 0; y < b.h; y++) if (b.mask[y * b.w + x]) cells.push(y * b.w + x);
    // pack the pieces to the bottom of the column
    let write = cells.length - 1;
    for (let r = cells.length - 1; r >= 0; r--) {
      const i = cells[r];
      if (b.c[i] === NONE) continue;
      const j = cells[write];
      if (j !== i) {
        b.c[j] = b.c[i]; b.s[j] = b.s[i]; b.hp[j] = b.hp[i]; b.id[j] = b.id[i];
        b.c[i] = NONE; b.s[i] = S_NONE; b.hp[i] = 0; b.id[i] = -1;
        ids.push(b.id[j]); to.push(j); from.push(i); cs.push(b.c[j]); ss.push(b.s[j]); hps.push(b.hp[j]);
      }
      write--;
    }
    // refill the empty cells at the top of each open stretch (from above the board)
    let spawn = 0;
    for (let r = cells.length - 1; r >= 0; r--) {
      const i = cells[r];
      if (b.c[i] !== NONE) continue;
      b.c[i] = pick(b, i, false); b.s[i] = S_NONE; b.id[i] = b.next++;
      ids.push(b.id[i]); to.push(i); from.push(-1 - spawn++); cs.push(b.c[i]); ss.push(0); hps.push(0);
    }
  }
  if (ids.length) steps.push({ k: "fall", ids, to, from, c: cs, s: ss, hp: hps });
}
