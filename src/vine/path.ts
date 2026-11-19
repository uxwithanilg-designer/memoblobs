// The vine's shape: a turtle walks up the screen (straights, bends, S-curves, U-turns, zigzags) and, in Spiral Trunk
// stages, round a giant trunk in true 3D. The result is sampled every DS metres with a tangent and a "side" normal:
// side +1 is the normal's side of the vine, side -1 the other one. Planar vines live in z = 0; the camera looks from +z.
import type { Path, Trunk } from "./types";

export const DS = 0.25;
/** how far left / right the vine may wander (fits a portrait phone) */
export const XMAX = 2.4;

export interface Rng { (): number }
export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <X>(r: Rng, a: readonly X[]) => a[Math.floor(r() * a.length)];
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();

export class PathBuilder {
  P: number[] = []; T: number[] = []; N: number[] = []; F: number[] = [];
  x = 0; y = 0; th = 0; s = 0;
  trunks: Trunk[] = [];
  /** flag for the samples being written (1 = gap, 2 = fork) */
  flag = 0;
  private carry = 0;

  private emit(x: number, y: number, z: number, tx: number, ty: number, tz: number, nx: number, ny: number, nz: number) {
    this.P.push(x, y, z); this.T.push(tx, ty, tz); this.N.push(nx, ny, nz); this.F.push(this.flag);
  }
  private planar(x: number, y: number, th: number) {
    const dx = Math.sin(th), dy = Math.cos(th);
    this.emit(x, y, 0, dx, dy, 0, -dy, dx, 0);
  }
  /** walk `len` metres, calling `at(u)` (u = metres into this piece) for every sample point */
  private walk(len: number, at: (u: number) => void) {
    let u = this.carry;
    while (u <= len + 1e-6) { at(u); u += DS; }
    this.carry = u - len;
    this.s += len;
  }
  straight(len: number) {
    const x0 = this.x, y0 = this.y, th = this.th, dx = Math.sin(th), dy = Math.cos(th);
    this.walk(len, (u) => this.planar(x0 + dx * u, y0 + dy * u, th));
    this.x = x0 + dx * len; this.y = y0 + dy * len;
  }
  /** turn by `dth` radians (+ = right) on radius r */
  arc(r: number, dth: number) {
    if (Math.abs(dth) < 1e-4) return;
    const th0 = this.th, sg = Math.sign(dth);
    const cx = this.x + sg * r * Math.cos(th0), cy = this.y - sg * r * Math.sin(th0);
    const pos = (th: number) => [cx - sg * r * Math.cos(th), cy + sg * r * Math.sin(th)];
    this.walk(r * Math.abs(dth), (u) => { const th = th0 + sg * (u / r); const [px, py] = pos(th); this.planar(px, py, th); });
    this.th = th0 + dth;
    [this.x, this.y] = pos(this.th);
  }
  /** wind round a trunk behind the vine: R = radius of the vine's circle, `turns` full turns, `rise` metres per turn */
  spiral(R: number, turns: number, rise: number) {
    const p = rise / (2 * Math.PI);
    const ths = Math.atan2(R, p);
    this.arc(1.2, ths - this.th);
    const x0 = this.x, y0 = this.y, s0 = this.s;
    const L = Math.hypot(R, p) * 2 * Math.PI * turns;
    this.walk(L, (u) => {
      const ph = (u / L) * 2 * Math.PI * turns;
      const px = x0 + R * Math.sin(ph), py = y0 + p * ph, pz = -R + R * Math.cos(ph);
      let tx = R * Math.cos(ph), ty = p, tz = -R * Math.sin(ph);
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      // side normal = radial-out × tangent (continuous with the planar left normal at the front)
      const rx = Math.sin(ph), rz = Math.cos(ph);
      let nx = 0 * tz - rz * ty, ny = rz * tx - rx * tz, nz = rx * ty - 0 * tx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      this.emit(px, py, pz, tx, ty, tz, nx, ny, nz);
    });
    this.y = y0 + p * 2 * Math.PI * turns; this.x = x0;
    this.trunks.push({ x: x0, z: -R, y0: y0 - 1.5, y1: this.y + 1.5, r: Math.max(0.6, R - 0.42), s0, s1: this.s });
    this.arc(1.2, -ths);
  }
  /** come back to the middle heading straight up (the gate sits on a vertical piece) */
  home(r = 1.1) {
    this.arc(r, -this.th);
    const dx = -this.x;
    if (Math.abs(dx) < 0.25) return;
    const rr = Math.min(r, Math.abs(dx) / 2);
    const sg = Math.sign(dx);
    this.arc(rr, sg * Math.PI / 2);
    this.straight(Math.max(0, Math.abs(dx) - 2 * rr));
    this.arc(rr, -sg * Math.PI / 2);
  }
  done(): Path {
    const n = this.F.length;
    return {
      len: (n - 1) * DS, ds: DS, n,
      P: new Float32Array(this.P), T: new Float32Array(this.T), N: new Float32Array(this.N), F: new Uint8Array(this.F),
      trunks: this.trunks,
    };
  }
}

export interface PathOpts {
  length: number;
  /** piece weights */
  turns: number; hairpins: number; zigzag: number; straights: number;
  spirals?: number;
  /** spans (in s) that must be gap-safe straights etc. are handled by the placer; the shape only knows lengths */
  rng: Rng;
}

/** a winding vine of about `length` metres that starts and ends heading straight up at x = 0 */
export function buildPath(o: PathOpts): Path {
  const b = new PathBuilder(), r = o.rng;
  b.straight(6);
  const goal = o.length - 10;
  let lastSpiral = -999;
  while (b.s < goal) {
    const left = goal - b.s;
    // keep inside the screen: steer back toward the middle when near an edge
    const out = Math.abs(b.x) > XMAX - 0.9 && Math.sign(Math.sin(b.th)) === Math.sign(b.x) && Math.abs(Math.sin(b.th)) > 0.2;
    if (out) { b.arc(range(r, 0.8, 1.4), -Math.sign(b.x) * range(r, 0.5, 1.1) - b.th); b.straight(1); continue; }
    if (Math.abs(b.th) > 2.7) { b.arc(1.1, -Math.sign(b.th) * 1.2); continue; }
    const w = [o.straights, o.turns, o.hairpins, o.zigzag, o.spirals && b.s - lastSpiral > 60 && left > 40 ? o.spirals : 0];
    const tot = w.reduce((a, c) => a + c, 0);
    let q = r() * tot, k = 0;
    while (k < w.length - 1 && q > w[k]) { q -= w[k]; k++; }
    if (k === 0) {
      // straight, leaning a little toward up
      const L = range(r, 2.5, 7);
      if (Math.abs(b.th) > 0.6 && r() < 0.7) b.arc(range(r, 1, 2), -b.th * range(r, 0.5, 1));
      b.straight(L);
    } else if (k === 1) {
      // a bend toward the side with more room
      const dir = Math.abs(b.x) < 0.6 ? (r() < 0.5 ? 1 : -1) : -Math.sign(b.x);
      const target = dir * range(r, 0.5, 1.5);
      b.arc(range(r, 1.2, 3), target - b.th);
      b.straight(range(r, 1.5, 3.5));
    } else if (k === 2) {
      // hairpin: run across, U-turn up and back (needs a horizontal heading)
      const dir = Math.abs(b.x) < 0.4 ? (r() < 0.5 ? 1 : -1) : -Math.sign(b.x);
      b.arc(range(r, 0.8, 1.3), dir * Math.PI / 2 - b.th);
      b.straight(Math.max(0.5, Math.min(XMAX - 1.1 - dir * b.x, range(r, 1.5, 4))));
      b.arc(range(r, 0.75, 1.1), -dir * Math.PI);
      b.straight(range(r, 1.5, 3));
      b.arc(range(r, 0.8, 1.2), -b.th * range(r, 0.6, 1));
    } else if (k === 3) {
      // zigzag: a few short diagonal legs
      const legs = 2 + Math.floor(r() * 3);
      let dir = b.x > 0 ? -1 : 1;
      for (let j = 0; j < legs; j++) {
        b.arc(range(r, 0.7, 1.1), dir * range(r, 0.6, 0.95) - b.th);
        b.straight(range(r, 1.4, 2.6));
        dir = -dir;
      }
      b.arc(1, -b.th * 0.8);
    } else {
      b.home(1);
      b.spiral(range(r, 1.8, 2.3), 1 + (r() < 0.35 ? 1 : 0), range(r, 6, 8));
      lastSpiral = b.s;
    }
  }
  b.home(1.1);
  b.straight(Math.max(6, o.length - b.s));
  return b.done();
}

/** a point along the path (interpolated): writes position, tangent and side normal */
export function pathAt(p: Path, s: number, out: { p: number[]; t: number[]; n: number[] }) {
  const f = Math.max(0, Math.min(p.n - 1.0001, s / p.ds));
  const i = Math.floor(f), k = f - i, j = i + 1;
  for (let a = 0; a < 3; a++) {
    out.p[a] = p.P[i * 3 + a] + (p.P[j * 3 + a] - p.P[i * 3 + a]) * k;
    out.t[a] = p.T[i * 3 + a] + (p.T[j * 3 + a] - p.T[i * 3 + a]) * k;
    out.n[a] = p.N[i * 3 + a] + (p.N[j * 3 + a] - p.N[i * 3 + a]) * k;
  }
  return out;
}
export const flagAt = (p: Path, s: number) => p.F[Math.max(0, Math.min(p.n - 1, Math.round(s / p.ds)))];
/** the trunk the path is winding round at s (or null) */
export const trunkAt = (p: Path, s: number) => p.trunks.find((t) => s >= t.s0 - 2 && s <= t.s1 + 2) ?? null;
/** mark [s0, s1] with a flag (gaps and forks are cut into an existing path) */
export function markPath(p: Path, s0: number, s1: number, flag: number) {
  for (let i = Math.max(0, Math.ceil(s0 / p.ds)); i <= Math.min(p.n - 1, Math.floor(s1 / p.ds)); i++) p.F[i] |= flag;
}
/** is [s0, s1] free of spirals (gaps and forks only go on planar vine) */
export const planarSpan = (p: Path, s0: number, s1: number) => !p.trunks.some((t) => s1 > t.s0 - 3 && s0 < t.s1 + 3);
