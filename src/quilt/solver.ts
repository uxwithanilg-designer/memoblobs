// Quiltfold solver: every clue gets the list of rectangles that could be its patch (right size or any size for a ?,
// covers no gap, no other clue, crosses no fence, fits the kind's shape rule and the clue's shape hint). Then an exact
// cover search: always place the clue with the fewest rectangles still fitting, and give up a branch as soon as some
// open cell can no longer be covered by anyone. No Twins also checks equal-size neighbours as patches go down.
import { area, edgeKey, type KindId, type Puzzle, type Rect } from "./kinds";

export type Clues = Pick<Puzzle, "kind" | "rows" | "cols" | "open" | "clue" | "shape" | "fences">;

interface Cand { rect: Rect; cells: number[]; mask: number }

function rectOk(kind: KindId, x: Rect): boolean {
  if (kind === "squares") return x.h === x.w;
  if (kind === "ribbons") return x.h === 1 || x.w === 1;
  return true;
}

export function candidates(p: Clues, maxArea: number): { clues: number[]; cands: Cand[][] } {
  const { rows: R, cols: C } = p;
  const fences = new Set(p.fences);
  const clues = p.clue.map((v, i) => (v !== 0 ? i : -1)).filter((i) => i >= 0);
  const clueAt = new Set(clues);
  const cands = clues.map((ci) => {
    const want = p.clue[ci], r0 = Math.floor(ci / C), c0 = ci % C, hint = p.shape?.[ci] ?? 0;
    const out: Cand[] = [];
    const areas = want > 0 ? [want] : Array.from({ length: maxArea }, (_, k) => k + 1);
    for (const a of areas) for (let h = 1; h <= a; h++) {
      if (a % h) continue;
      const w = a / h;
      if (h > R || w > C) continue;
      const x0: Rect = { r: 0, c: 0, h, w };
      if (!rectOk(p.kind, x0)) continue;
      if (hint === 1 && h !== w) continue;
      if (hint === 2 && !(h > w)) continue;
      if (hint === 3 && !(w > h)) continue;
      for (let r = Math.max(0, r0 - h + 1); r <= Math.min(r0, R - h); r++) for (let c = Math.max(0, c0 - w + 1); c <= Math.min(c0, C - w); c++) {
        let ok = true;
        const cells: number[] = [];
        for (let i = 0; i < h && ok; i++) for (let j = 0; j < w && ok; j++) {
          const cell = (r + i) * C + c + j;
          if (!p.open[cell] || (cell !== ci && clueAt.has(cell))) ok = false;
          // fences: no fence between two cells of the patch
          if (ok && j > 0 && fences.has(edgeKey(cell - 1, cell))) ok = false;
          if (ok && i > 0 && fences.has(edgeKey(cell - C, cell))) ok = false;
          cells.push(cell);
        }
        if (ok) out.push({ rect: { r, c, h, w }, cells, mask: 0 });
      }
    }
    return out;
  });
  return { clues, cands };
}

export interface Found { count: number; sols: Rect[][]; aborted: boolean; steps: number }

/** solutions up to `limit` (2 = uniqueness); `fixed` pins some clues to a rectangle (hints) */
export function solve(p: Clues, maxArea: number, limit = 2, maxSteps = 60000): Found {
  const res: Found = { count: 0, sols: [], aborted: false, steps: 0 };
  const { clues, cands } = candidates(p, maxArea);
  const size = p.rows * p.cols, C = p.cols;
  const owner = new Int32Array(size).fill(-1);
  const placed: (Rect | null)[] = clues.map(() => null);
  const open = p.open.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  const noTwins = p.kind === "notwins";

  const fits = (cd: Cand, k: number) => {
    for (const c of cd.cells) if (owner[c] >= 0) return false;
    if (noTwins) {
      const a = area(cd.rect), x = cd.rect;
      // neighbours along the patch's edges
      for (let i = 0; i < x.h; i++) for (const cc of [x.c - 1, x.c + x.w]) {
        if (cc < 0 || cc >= C) continue;
        const o = owner[(x.r + i) * C + cc];
        if (o >= 0 && o !== k && placed[o] && area(placed[o]!) === a) return false;
      }
      for (let j = 0; j < x.w; j++) for (const rr of [x.r - 1, x.r + x.h]) {
        if (rr < 0 || rr >= p.rows) continue;
        const o = owner[rr * C + x.c + j];
        if (o >= 0 && o !== k && placed[o] && area(placed[o]!) === a) return false;
      }
    }
    return true;
  };

  const rec = (left: number): boolean => {
    if (res.count >= limit) return true;
    if (++res.steps > maxSteps) { res.aborted = true; return true; }
    if (left === 0) {
      for (const c of open) if (owner[c] < 0) return false;
      res.count++;
      res.sols.push(placed.map((x) => ({ ...x! })));
      return res.count >= limit;
    }
    // the fitting rectangles of every clue still to place; the clue with the fewest goes first, and every open
    // cell must still be coverable by one of them
    const reach = new Uint8Array(size);
    let best = -1, bestList: Cand[] = [];
    for (let k = 0; k < clues.length; k++) {
      if (placed[k]) continue;
      const list = cands[k].filter((cd) => fits(cd, k));
      if (!list.length) return false;
      for (const cd of list) for (const c of cd.cells) reach[c] = 1;
      if (best < 0 || list.length < bestList.length) { best = k; bestList = list; }
    }
    for (const c of open) if (owner[c] < 0 && !reach[c]) return false;
    for (const cd of bestList) {
      placed[best] = cd.rect;
      for (const c of cd.cells) owner[c] = best;
      if (rec(left - 1)) return true;
      for (const c of cd.cells) owner[c] = -1;
      placed[best] = null;
    }
    return false;
  };
  rec(clues.length);
  return res;
}
