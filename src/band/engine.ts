// Band Bend rules. A pegboard of cols × rows pins. Each rubber band is fixed at two nails (a, b) and runs a → hooks… →
// b, a straight segment between consecutive points. Drag a band's segment onto a pin: the band hooks round it there.
// Drag a hook to another pin to move it, or drop it in open space to let it go. Make the bands draw exactly the target
// shape (the same lines, whichever band draws them). A line through pins counts as the short lines between them.
//
// Targets are drawn by real bands (the builder hooks each band round a few pins), so every stage is solvable; the move
// limit is the number of drags that build (and fix) the bands, plus a sliver.

export interface Band { a: number; b: number; hooks: number[]; color: number }
export interface Board { cols: number; rows: number; bands: Band[]; target: string[]; goal: number[][] }

export const xy = (b: { cols: number }, p: number) => [p % b.cols, Math.floor(p / b.cols)] as const;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** the short lines (between neighbouring lattice points) a segment from p to q covers */
export function edges(b: { cols: number }, p: number, q: number): string[] {
  const [px, py] = xy(b, p), [qx, qy] = xy(b, q);
  const dx = qx - px, dy = qy - py, g = gcd(Math.abs(dx), Math.abs(dy)) || 1, sx = dx / g, sy = dy / g;
  const out: string[] = [];
  for (let k = 0; k < g; k++) {
    const a = (py + sy * k) * b.cols + px + sx * k, c = (py + sy * (k + 1)) * b.cols + px + sx * (k + 1);
    out.push(a < c ? `${a}-${c}` : `${c}-${a}`);
  }
  return out;
}
export const pointsOf = (band: Band) => [band.a, ...band.hooks, band.b];
export function bandEdges(b: { cols: number }, band: Band): string[] {
  const pts = pointsOf(band), out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(...edges(b, pts[i], pts[i + 1]));
  return out;
}
export function shapeOf(b: { cols: number }, bands: Band[]): Set<string> {
  const s = new Set<string>(); for (const band of bands) for (const e of bandEdges(b, band)) s.add(e); return s;
}
export function matches(b: Board, bands: Band[]) {
  const s = shapeOf(b, bands); if (s.size !== b.target.length) return false;
  for (const e of b.target) if (!s.has(e)) return false;
  return true;
}
/** the target edges the bands draw right now, and the stray ones */
export function progress(b: Board, bands: Band[]) {
  const s = shapeOf(b, bands), t = new Set(b.target);
  let good = 0, stray = 0; for (const e of s) { if (t.has(e)) good++; else stray++; }
  return { good, stray, total: t.size };
}

/** is the bend at the middle point a real turn (not straight through, not doubling back)? */
export function turns(b: { cols: number }, p: number, q: number, r: number) {
  const [px, py] = xy(b, p), [qx, qy] = xy(b, q), [rx, ry] = xy(b, r);
  const ax = qx - px, ay = qy - py, cx = rx - qx, cy = ry - qy;
  return ax * cy - ay * cx !== 0;
}
/** a band path is fine when every hook turns and no short line is drawn twice */
export function validBand(b: { cols: number }, band: Band) {
  const pts = pointsOf(band);
  if (new Set(pts).size !== pts.length) return false;
  for (let i = 1; i < pts.length - 1; i++) if (!turns(b, pts[i - 1], pts[i], pts[i + 1])) return false;
  const es = bandEdges(b, band);
  return new Set(es).size === es.length;
}

/** insert a hook on segment i of a band at pin q (returns a new band, or null if it doesn't make a real bend) */
export function hookAt(b: { cols: number }, band: Band, seg: number, q: number): Band | null {
  const pts = pointsOf(band);
  if (pts.includes(q)) return null;
  if (!turns(b, pts[seg], q, pts[seg + 1])) return null;
  const hooks = band.hooks.slice(); hooks.splice(seg, 0, q);
  return { ...band, hooks };
}
/** move hook i to pin q, or drop it (q = -1) */
export function moveHook(b: { cols: number }, band: Band, i: number, q: number): Band | null {
  const hooks = band.hooks.slice();
  if (q < 0) { hooks.splice(i, 1); return { ...band, hooks }; }
  const pts = pointsOf(band);
  if (pts.includes(q)) return null;
  const prev = pts[i], next = pts[i + 2];
  if (!turns(b, prev, q, next)) return null;
  hooks[i] = q;
  return { ...band, hooks };
}
