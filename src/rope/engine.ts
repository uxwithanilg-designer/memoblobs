// Rope Loop rules. Spools hold coils of coloured rope, bottom → top, up to `cap` coils each. Tap a spool, then another:
// the top rope — every touching coil of the same colour — winds over onto the other spool, as much as fits, if that
// spool is empty or its top colour matches. Sort until every spool is empty or full of one colour.
// Hidden coils (shown as "?") keep their colour secret until they're on top of their spool.
//
// The solver is a depth-first search with memory over canonical states (spool order doesn't matter), used by the stage
// builder to prove every board solvable and to measure how many moves lead into a dead end.

export type Spool = number[]; // colours, bottom → top
export interface Board { cap: number; spools: Spool[]; hidden: boolean[][] }
export type Move = { from: number; to: number };

export const top = (s: Spool) => s[s.length - 1];
/** how many coils of the top colour sit together on top */
export function run(s: Spool) { let n = 0; for (let i = s.length - 1; i >= 0 && s[i] === s[s.length - 1]; i--) n++; return n; }
export function canMove(b: { cap: number }, spools: Spool[], from: number, to: number) {
  if (from === to) return false;
  const a = spools[from], c = spools[to];
  if (!a.length || c.length >= b.cap) return false;
  if (c.length && top(c) !== top(a)) return false;
  // moving a whole single-colour spool into an empty one is pointless
  if (!c.length && run(a) === a.length) return false;
  return true;
}
/** how many coils a move carries */
export const amount = (b: { cap: number }, spools: Spool[], from: number, to: number) => Math.min(run(spools[from]), b.cap - spools[to].length);
export function apply(b: { cap: number }, spools: Spool[], from: number, to: number): number {
  const n = amount(b, spools, from, to);
  for (let k = 0; k < n; k++) spools[to].push(spools[from].pop()!);
  return n;
}
export const solved = (b: { cap: number }, spools: Spool[]) => spools.every((s) => !s.length || (s.length === b.cap && run(s) === b.cap));
export function moves(b: { cap: number }, spools: Spool[]): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < spools.length; i++) for (let j = 0; j < spools.length; j++) if (canMove(b, spools, i, j)) out.push({ from: i, to: j });
  return out;
}
const keyOf = (spools: Spool[]) => spools.map((s) => s.join(",")).sort().join("|");

/** depth-first search for a solution (null when there is none or the budget runs out) */
export function solve(b: { cap: number }, start: Spool[], budget = 40000): { path: Move[] | null; visited: number } {
  const seen = new Set<string>();
  let visited = 0;
  const path: Move[] = [];
  const sp = start.map((s) => s.slice());
  const dfs = (): boolean => {
    if (solved(b, sp)) return true;
    if (visited++ > budget) return false;
    const k = keyOf(sp); if (seen.has(k)) return false; seen.add(k);
    // moves that complete a spool or empty one first, then onto matching tops, empty targets last
    const ms = moves(b, sp).map((m) => {
      const a = sp[m.from], c = sp[m.to], n = amount(b, sp, m.from, m.to);
      const score = (c.length + n === b.cap && (c.length === 0 || run(c) === c.length) ? 20 : 0) + (n === a.length ? 6 : 0) + (c.length ? 4 : -4) + n;
      return { m, score };
    }).sort((x, y) => y.score - x.score);
    for (const { m } of ms) {
      const n = apply(b, sp, m.from, m.to);
      path.push(m);
      if (dfs()) return true;
      path.pop();
      for (let k = 0; k < n; k++) sp[m.from].push(sp[m.to].pop()!);
    }
    return false;
  };
  const ok = dfs();
  return { path: ok ? [...path] : null, visited };
}
