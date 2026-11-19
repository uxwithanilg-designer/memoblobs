// Slurp Lab: how hard is a stage? The trap test plays it many times as a greedy player who always slurps something
// when it can (random choice, never parks) and counts how often that player gets stuck. With the solver's par, the
// planted solution's order chains and the colour twins it gives a difficulty score.
import { DIR_CH, blobsLeft, burnt, cloneState, initState, move, options } from "./rules";
import type { Drag, Stage, StageMetrics, State } from "./types";

/** a small seeded random generator (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** share of greedy random playouts that end stuck (or with a burnt fuse) */
export function trapRate(st: Stage, runs = 60, seed = 7): number {
  const r = rng(seed);
  let stuck = 0;
  for (let k = 0; k < runs; k++) {
    let s = initState(st);
    let ok = false;
    for (let guard = 0; guard < 120; guard++) {
      if (blobsLeft(s) === 0) { ok = true; break; }
      const all = s.sl.flatMap((q, i) => (q.alive && q.awake ? options(st, s, i) : []));
      const eat = all.filter((o) => o.out.eats.length);
      const pool = eat.length ? eat : all.filter((o) => o.out.changed);
      if (!pool.length) break;
      const o = pool[Math.floor(r() * pool.length)];
      s = o.s; s.moves++;
      if (burnt(st, s)) break;
    }
    if (!ok) stuck++;
  }
  return stuck / runs;
}

/** longest chain of "this drag needs an earlier drag by another Slurper to clear its way" in a solution */
export function depthOf(st: Stage, start: State, drags: Drag[]): number {
  const W = st.w, s = cloneState(start);
  const clearedBy = new Int16Array(st.w * st.h).fill(-1);
  const blocked0 = new Uint8Array(st.w * st.h);
  st.blobs.forEach((b, c) => { if (b >= 0) blocked0[c] = 1; });
  s.sl.forEach((q) => { for (const [cx, cy] of q.cells) blocked0[(q.y + cy) * W + q.x + cx] = 2; });
  for (const c of st.crates ?? []) blocked0[c] = 3;
  const depthAt: number[] = [];
  drags.forEach((g, k) => {
    let need = -1;
    for (const ch of g.dirs) {
      if (!s.sl[g.i].alive) break;
      const before = s.sl.map((q) => q.cells.map(([cx, cy]) => (q.y + cy) * W + q.x + cx));
      const o = move(st, s, g.i, DIR_CH.indexOf(ch));
      if (!o) break;
      for (const cv of o.covered) for (const c of cv.cells) { const by = clearedBy[c]; if (by >= 0 && drags[by].i !== g.i && blocked0[c]) need = Math.max(need, by); }
      for (const e of o.eats) for (const c of e.cells) clearedBy[c] = k;
      for (const st2 of o.steps) for (const c of before[st2.i]) if (clearedBy[c] < 0 || clearedBy[c] < k) clearedBy[c] = k;
      for (const f of o.fx) if (f.t === "crate") clearedBy[f.from] = k;
    }
    s.moves++;
    depthAt[k] = need >= 0 ? depthAt[need] + 1 : 0;
  });
  return Math.max(0, ...depthAt);
}

export function twinsOf(st: Stage): number {
  const per = new Map<number, number>();
  for (const d of st.slurpers) per.set(d.color, (per.get(d.color) ?? 0) + 1);
  let t = 0; for (const n of per.values()) t += (n * (n - 1)) / 2;
  return t;
}

/** the difficulty score (higher = harder) */
export function scoreOf(m: Omit<StageMetrics, "score">, colors: number, blobs: number, mechs: number): number {
  return m.par * 1.0 + m.depth * 1.6 + m.trap * 16 + m.twins * 1.2 + blobs * 0.06 + Math.max(0, colors - 2) * 0.8 + mechs * 1.5;
}
