// Flutter Pairs rules. A few stacks stand on wooden stumps; a belt brings felt blocks one at a time (you see the block
// in your hand and the next five). Drop the block in your hand on a stack:
//   • the stack's top block is the same colour → both pop and fly away on little wings;
//   • otherwise the block joins the stack — but a stack may only reach the rope (`cap` blocks): dropping a different
//     block on a full stack topples it and the level is lost. A matching block on a full stack is always safe.
//   • an ERASE ball (later stages) removes the top block of the stack you drop it on.
// Clear every stack once the belt is empty to win. Powers: MOVE (a stack's top block onto another stack, same rules)
// and SWAP (trade any two blocks in the stacks).
//
// solve() is a depth-first search with a memo (stacks are interchangeable, so the key sorts them); stage.ts builds
// every level from a plan, so each level has at least one way through.

export const ERASE = -2;
export type Stack = number[];               // bottom → top
export interface Level { stacks: Stack[]; queue: number[]; cap: number; colors: number }
export interface State { stacks: Stack[]; at: number }   // `at` = index of the block in your hand
export type Drop = { out: "pop" | "push" | "erase" | "topple" | "noop"; color: number };

export const cloneStacks = (s: Stack[]) => s.map((x) => x.slice());
export const handOf = (lv: Level, st: State) => (st.at < lv.queue.length ? lv.queue[st.at] : null);

/** what dropping block `c` on stack `i` would do */
export function dropResult(cap: number, stack: Stack, c: number): Drop["out"] {
  if (c === ERASE) return stack.length ? "erase" : "noop";
  const top = stack[stack.length - 1];
  if (stack.length && top === c) return "pop";
  if (stack.length >= cap) return "topple";
  return "push";
}
/** drop the hand block on stack i (in place); returns what happened */
export function drop(lv: Level, st: State, i: number): Drop {
  const c = lv.queue[st.at];
  const s = st.stacks[i];
  const out = dropResult(lv.cap, s, c);
  if (out === "noop") return { out, color: c };
  if (out === "pop" || out === "erase") s.pop();
  else if (out === "push") s.push(c);
  st.at++;
  return { out, color: c };
}
export const cleared = (lv: Level, st: State) => st.at >= lv.queue.length && st.stacks.every((s) => s.length === 0);
export const done = (lv: Level, st: State) => st.at >= lv.queue.length;

/** the move power: a stack's top block onto another stack (pop / push / topple like a drop) */
export function moveTop(lv: Level, st: State, from: number, to: number): Drop["out"] {
  const a = st.stacks[from], b = st.stacks[to];
  if (!a.length || from === to) return "noop";
  const c = a[a.length - 1];
  const out = dropResult(lv.cap, b, c);
  if (out === "topple") return "topple";
  a.pop();
  if (out === "pop") b.pop(); else b.push(c);
  return out;
}

const keyOf = (st: State) => `${st.at}|${st.stacks.map((s) => s.join(",")).sort().join("/")}`;
/** a way through from here (the stack index for each remaining block), or null; `budget` caps the search */
export function solve(lv: Level, st: State, budget = { n: 200000 }): number[] | null {
  const seen = new Set<string>();
  const path: number[] = [];
  const go = (s: State): boolean => {
    if (--budget.n < 0) return false;
    if (s.at >= lv.queue.length) return s.stacks.every((x) => x.length === 0);
    // left over blocks must still fit: each stack can only shrink by matching blocks still to come
    const k = keyOf(s); if (seen.has(k)) return false; seen.add(k);
    const c = lv.queue[s.at];
    // try pops first, then pushes on the shortest stacks, never two identical stacks twice
    const order = s.stacks.map((_, i) => i).sort((a, b) => {
      const ra = dropResult(lv.cap, s.stacks[a], c), rb = dropResult(lv.cap, s.stacks[b], c);
      const w = (r: string) => (r === "pop" || r === "erase" ? 0 : r === "push" ? 1 : 2);
      return w(ra) - w(rb) || s.stacks[a].length - s.stacks[b].length;
    });
    const tried = new Set<string>();
    for (const i of order) {
      const r = dropResult(lv.cap, s.stacks[i], c);
      if (r === "topple" || r === "noop") continue;
      const sig = s.stacks[i].join(","); if (tried.has(sig)) continue; tried.add(sig);
      const n: State = { stacks: cloneStacks(s.stacks), at: s.at };
      drop(lv, n, i);
      path.push(i);
      if (go(n)) return true;
      path.pop();
      if (budget.n < 0) return false;
    }
    return false;
  };
  return go({ stacks: cloneStacks(st.stacks), at: st.at }) ? path.slice() : null;
}

/** a player that looks only at the block in hand: pop if it can, else the shortest stack that won't topple */
export function careless(lv: Level, rnd: () => number): boolean {
  const st: State = { stacks: cloneStacks(lv.stacks), at: 0 };
  while (st.at < lv.queue.length) {
    const c = lv.queue[st.at];
    const opts = st.stacks.map((s, i) => ({ i, r: dropResult(lv.cap, s, c), h: s.length })).filter((o) => o.r !== "topple" && o.r !== "noop");
    if (!opts.length) return false;
    const pops = opts.filter((o) => o.r === "pop" || o.r === "erase");
    const pick = pops.length ? pops[Math.floor(rnd() * pops.length)] : opts.sort((a, b) => a.h - b.h || rnd() - 0.5)[0];
    drop(lv, st, pick.i);
  }
  return st.stacks.every((s) => s.length === 0);
}

/** a thoughtful player: it looks at the hand and the next `look - 1` blocks (like the belt preview) and picks the move
 *  whose best short future keeps the stacks lowest and never topples */
export function thoughtful(lv: Level, look: number): boolean {
  const st: State = { stacks: cloneStacks(lv.stacks), at: 0 };
  while (st.at < lv.queue.length) {
    let bestI = -1, bestV = Infinity;
    for (let i = 0; i < st.stacks.length; i++) {
      const r = dropResult(lv.cap, st.stacks[i], lv.queue[st.at]);
      if (r === "topple" || r === "noop") continue;
      const n: State = { stacks: cloneStacks(st.stacks), at: st.at };
      drop(lv, n, i);
      const v = ahead(lv, n, look - 1);
      if (v < bestV) { bestV = v; bestI = i; }
    }
    if (bestI < 0 || bestV === Infinity) return false;
    drop(lv, st, bestI);
  }
  return st.stacks.every((s) => s.length === 0);
}
/** the best (lowest) score reachable in `k` more drops: Infinity if every line topples */
function ahead(lv: Level, st: State, k: number): number {
  if (k <= 0 || st.at >= lv.queue.length) {
    // fewer blocks and more room under the rope is better; a full stack is risky
    let v = 0; for (const s of st.stacks) { v += s.length; if (s.length >= lv.cap) v += 2; }
    return v;
  }
  let best = Infinity;
  const c = lv.queue[st.at];
  const tried = new Set<string>();
  for (let i = 0; i < st.stacks.length; i++) {
    const r = dropResult(lv.cap, st.stacks[i], c);
    if (r === "topple" || r === "noop") continue;
    const sig = st.stacks[i].join(","); if (tried.has(sig)) continue; tried.add(sig);
    const n: State = { stacks: cloneStacks(st.stacks), at: st.at };
    drop(lv, n, i);
    best = Math.min(best, ahead(lv, n, k - 1));
  }
  return best;
}
