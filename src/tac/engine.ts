// Neon Tac Duel rules. A board of cols × rows cells; you are X (1), the rival is O (2), 3 is a pillar nobody can use.
// Get `k` marks in a row (across, down or diagonal) to win. Rule twists per stage:
//   • gravity — a mark drops to the lowest empty cell of its column (like a coin in a slot);
//   • keep    — each side keeps only `keep` marks: placing one more makes your oldest mark vanish (Infinity rule).
//
// The solver proves "win in N" puzzles by forcing play: every move of yours makes a threat (a cell where your next
// mark wins) that the rival must block, until you make two threats at once or complete a line. The rival also takes
// its own win at once, and you must block its threats first. The same rival logic plays the game.

export interface Rules { cols: number; rows: number; k: number; gravity: boolean; keep: number }
export interface State { cells: Int8Array; order: [number[], number[]] }
export const X = 1, O = 2, PILLAR = 3;

export const clone = (s: State): State => ({ cells: s.cells.slice(), order: [s.order[0].slice(), s.order[1].slice()] });
export const keyOf = (s: State, r: Rules) => (r.keep ? `${s.cells.join("")}|${s.order[0].join(",")}|${s.order[1].join(",")}` : s.cells.join(""));

/** cells you may play now (gravity: only the lowest empty cell of each column) */
export function playable(r: Rules, s: State): number[] {
  const out: number[] = [];
  if (r.gravity) {
    for (let c = 0; c < r.cols; c++) for (let y = r.rows - 1; y >= 0; y--) { const i = y * r.cols + c; if (s.cells[i] === 0) { out.push(i); break; } if (s.cells[i] === PILLAR) continue; }
    return out;
  }
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === 0) out.push(i);
  return out;
}
/** where a tap on column/cell i lands (gravity drops it), or -1 */
export function landing(r: Rules, s: State, i: number): number {
  if (!r.gravity) return s.cells[i] === 0 ? i : -1;
  const c = i % r.cols;
  for (let y = r.rows - 1; y >= 0; y--) { const j = y * r.cols + c; if (s.cells[j] === 0) return j; }
  return -1;
}
/** place p at i (in place); returns the cell that vanished (Infinity rule) or -1 */
export function put(r: Rules, s: State, i: number, p: 1 | 2): number {
  s.cells[i] = p;
  const ord = s.order[p - 1];
  ord.push(i);
  if (r.keep && ord.length > r.keep) { const old = ord.shift()!; s.cells[old] = 0; return old; }
  return -1;
}
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
/** the winning line through cell i for p, or null */
export function lineAt(r: Rules, s: State, i: number, p: number): number[] | null {
  const x0 = i % r.cols, y0 = Math.floor(i / r.cols);
  if (s.cells[i] !== p) return null;
  for (const [dx, dy] of DIRS) {
    const line = [i];
    for (const sg of [1, -1]) {
      let x = x0 + dx * sg, y = y0 + dy * sg;
      while (x >= 0 && y >= 0 && x < r.cols && y < r.rows && s.cells[y * r.cols + x] === p) { if (sg > 0) line.push(y * r.cols + x); else line.unshift(y * r.cols + x); x += dx * sg; y += dy * sg; }
    }
    if (line.length >= r.k) return line;
  }
  return null;
}
/** does placing p at i win? (checked on a copy, so the Infinity rule's vanishing mark counts) */
export function winsAt(r: Rules, s: State, i: number, p: 1 | 2): boolean {
  if (!r.keep) { s.cells[i] = p; const w = !!lineAt(r, s, i, p); s.cells[i] = 0; return w; }
  const t = clone(s); put(r, t, i, p); return !!lineAt(r, t, i, p);
}
/** cells where p wins with its next mark */
export function threats(r: Rules, s: State, p: 1 | 2): number[] {
  const out: number[] = [];
  for (const i of playable(r, s)) if (winsAt(r, s, i, p)) out.push(i);
  return out;
}
export const full = (r: Rules, s: State) => playable(r, s).length === 0;

/** shortest forced win for X (to move) in at most `max` of X's moves: the move list X, O, X, … or null */
export function forcedWin(r: Rules, s: State, max: number, budget = { n: 60000 }): number[] | null {
  for (let d = 1; d <= max; d++) {
    const memo = new Map<string, number[] | null>();
    const p = vcf(r, s, d, memo, budget);
    if (p) return p;
    if (budget.n <= 0) return null;
  }
  return null;
}
function vcf(r: Rules, s: State, d: number, memo: Map<string, number[] | null>, budget: { n: number }): number[] | null {
  if (--budget.n <= 0) return null;
  const key = keyOf(s, r) + ":" + d;
  if (memo.has(key)) return memo.get(key)!;
  let res: number[] | null = null;
  const mine = threats(r, s, X);
  if (mine.length) res = [mine[0]];
  else if (d > 1) {
    const theirs = threats(r, s, O);
    // the rival threatens: block it (two threats can't both be blocked)
    const cands = theirs.length ? (theirs.length === 1 ? theirs : []) : playable(r, s);
    for (const c of cands) {
      const t = clone(s); put(r, t, c, X);
      if (lineAt(r, t, c, X)) { res = [c]; break; }
      const T = threats(r, t, X);
      if (!T.length) continue;                       // not forcing
      if (threats(r, t, O).length) continue;           // the rival would just win
      // two threats: the rival blocks the first (as rivalMove does), X wins on the second
      if (T.length >= 2) { res = [c, T[0], T[1]]; break; }
      const u = clone(t); put(r, u, T[0], O);
      if (lineAt(r, u, T[0], O)) continue;
      const rest = vcf(r, u, d - 1, memo, budget);
      if (rest) { res = [c, T[0], ...rest]; break; }
      if (budget.n <= 0) break;
    }
  }
  memo.set(key, res);
  return res;
}

// ---------------------------------------------------------------- the rival
/** how good a cell is for p: open lines it extends, weighted by how full they get */
function cellScore(r: Rules, s: State, i: number, p: number) {
  const x0 = i % r.cols, y0 = Math.floor(i / r.cols);
  let score = 0;
  for (const [dx, dy] of DIRS) {
    // every window of k cells through i
    for (let off = -(r.k - 1); off <= 0; off++) {
      let mine = 0, ok = true;
      for (let t = 0; t < r.k; t++) {
        const x = x0 + dx * (off + t), y = y0 + dy * (off + t);
        if (x < 0 || y < 0 || x >= r.cols || y >= r.rows) { ok = false; break; }
        const v = s.cells[y * r.cols + x];
        if (v === p) mine++; else if (v !== 0) { ok = false; break; }
      }
      if (ok) score += [1, 6, 30, 160, 900, 5000][Math.min(5, mine)];
    }
  }
  return score;
}
/** the rival's move: win, block, else the best cell by attack + defence (with a little noise at low skill) */
export function rivalMove(r: Rules, s: State, skill: number, rnd: () => number): number {
  const opts = playable(r, s); if (!opts.length) return -1;
  const win = threats(r, s, O); if (win.length) return win[0];
  const block = threats(r, s, X); if (block.length) return block[0];
  let best = opts[0], bs = -Infinity;
  for (const i of opts) {
    // don't hand X a win (gravity: the cell above becomes playable)
    const t = clone(s); put(r, t, i, O);
    let sc = cellScore(r, s, i, O) * 1.0 + cellScore(r, s, i, X) * 0.9;
    const giveaway = threats(r, t, X).length;
    if (giveaway) sc -= 100000 * giveaway;
    // a move that makes two threats of its own is great
    const own = threats(r, t, O).length;
    if (own >= 2) sc += 50000; else if (own === 1) sc += 400;
    sc *= 1 + (rnd() - 0.5) * (1 - skill) * 0.8;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
