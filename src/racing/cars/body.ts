// Car body from a side profile. The lower body is LOFTED along the length (dense cross-section rings with
// side bulge, tuck-under, crowned bonnet, fender flares and wheel arches), and the glasshouse above the belt line
// is a separate shell (rounded roof, A/C pillars, framed side windows with B-pillars, windscreen, rear glass) so
// a dark interior shows through the glass. The body can also be "ray-cast" analytically so lamps, grilles,
// vents and stripes are projected onto the curved surface like real trim.
import * as THREE from "three";
import { Kit, K, type Bucket, type Col, box, torus, tube } from "./kit";

export type Pt = [number, number];
type V2 = THREE.Vector2;
const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Arch { s: number; y: number; r: number; /** inner lateral edge of the wheel well (m); 0 = full-width tunnel */ x?: number }
export interface BodyDef {
  len: number; wid: number; hgt: number;
  /** side silhouette (x -1 rear..1 front, y 0..1) from the rear-bottom corner over the roof to the front-bottom corner */
  profile: Pt[];
  /** belt line (0..1 of hgt); null = no glasshouse */
  belt: number | null;
  /** roof panel between rt..ft (x -1..1); outside that the top of the glasshouse is glass */
  rt?: number; ft?: number;
  tumble?: number; round?: number; roundR?: number; flare?: number; crown?: number; lift?: number;
  arches: Arch[];
  /** black lower cladding up to this height (m, absolute) */
  clad?: number;
  rTop?: number; rBot?: number; tuck?: number; shoulder?: number;
  /** bucket for the painted skin (default paint) */
  skin?: Bucket; skinColor?: Col;
  /** lateral / longitudinal offset of the whole body (side pods, cargo boxes) */
  x0?: number; z0?: number;
  /** optional plan-view taper of the nose: width factor at the very front */
  noseW?: number;
  /** base number of loft stations (default 24) */
  res?: number;
  /** extra height of the fender bulges over the wheels (m) — classic bug / hot-rod fenders */
  fender?: number;
}

/** cabin / glasshouse description resolved from the profile */
export interface Cabin {
  C: V2[]; n: V2[]; q: V2[]; rr: number[];
  sR: number; sF: number; rtS: number; ftS: number; top: number; crown: number; pw: number;
}

export interface WinOpts {
  /** side-window rear / front limits (x -1..1) and their slant (ds per dy) */
  rb?: number; fb?: number; rSlant?: number; fSlant?: number;
  /** B (and more) pillar positions, fraction of the window span from the rear */
  pillars?: number[]; pw?: number; pSlant?: number;
  /** margin between roof edge and the glass (m) */
  margin?: number;
  dlo?: "chrome" | "black" | null;
  roof?: "paint" | "black" | "accent" | "glass";
  pillarsBlack?: boolean;
}

export class Body {
  d: BodyDef; hl: number; H: number; W: number; lift: number; beltY: number; sillY: number;
  T: V2[]; xmin: number; xmax: number; maxY: number;
  st: number[] = []; rings: Float32Array[] = []; NH = 13; RN = 24;
  cab: Cabin | null = null;
  /** B-pillar centres (s at the belt) and the side-window span, filled by buildCabin */
  pillarS: number[] = []; winS: [number, number] | null = null;
  x0: number; z0: number;

  constructor(d: BodyDef) {
    this.d = d; this.hl = d.len / 2; this.H = d.hgt; this.W = d.wid; this.lift = d.lift ?? 0; this.x0 = d.x0 ?? 0; this.z0 = d.z0 ?? 0;
    const pts = d.profile.map(([x, y]) => v2(x * this.hl, y * this.H));
    this.xmin = Math.min(...pts.map((p) => p.x)); this.xmax = Math.max(...pts.map((p) => p.x));
    const curve = new THREE.SplineCurve(pts);
    this.T = curve.getPoints(Math.max(120, d.profile.length * 26)).map((p) => v2(clamp(p.x, this.xmin, this.xmax), p.y + this.lift));
    this.maxY = Math.max(...this.T.map((p) => p.y));
    const ends = [this.T[0].y, this.T[this.T.length - 1].y];
    this.sillY = Math.min(...ends);
    this.beltY = d.belt == null ? this.maxY : d.belt * this.H + this.lift;
    if (d.belt != null) this.cab = this.cabinData();
    this.NH = d.clad != null ? 15 : 14;
    this.RN = this.NH * 2 - 2;
    this.stations();
  }

  // ------------------------------------------------------------ silhouette helpers
  /** [bottom, top] of the raw silhouette at s */
  span(s: number): [number, number] {
    let lo = Infinity, hi = -Infinity; const T = this.T, n = T.length;
    s = clamp(s, this.xmin + 1e-4, this.xmax - 1e-4);
    for (let i = 0; i < n; i++) {
      const a = T[i], b = T[(i + 1) % n];
      if ((a.x - s) * (b.x - s) > 0 || a.x === b.x) continue;
      const y = a.y + ((b.y - a.y) * (s - a.x)) / (b.x - a.x);
      if (y < lo) lo = y; if (y > hi) hi = y;
    }
    if (lo === Infinity) return [this.sillY, this.sillY + 0.05];
    return [lo, hi];
  }
  inCabin(s: number) { return !!this.cab && s > this.cab.sR && s < this.cab.sF; }
  topLower(s: number) { return this.inCabin(s) ? this.beltY : this.span(s)[1]; }
  botLower(s: number, yt = this.topLower(s)) {
    let yb = this.span(s)[0];
    for (const a of this.d.arches) {
      const dx = s - a.s;
      if (Math.abs(dx) < a.r) { const ay = a.y + Math.sqrt(a.r * a.r - dx * dx); if (ay > yb) yb = ay; }
    }
    return Math.min(yb, yt - 0.025);
  }
  hwPlan(s: number) {
    const xn = s / this.hl, ax = Math.abs(xn), r = xn > 0 ? (this.d.round ?? 0.16) : (this.d.roundR ?? this.d.round ?? 0.16);
    let f = 1;
    if (ax > 0.68) f -= r * Math.pow(Math.min(1, (ax - 0.68) / 0.32), 2);
    if (this.d.noseW != null && xn > 0) f *= lerp(1, this.d.noseW, Math.pow(xn, 2));
    return (this.W / 2) * f;
  }
  flare(s: number, y: number) {
    const F = this.d.flare ?? 0; if (!F) return 0;
    let f = 0;
    for (const a of this.d.arches) {
      const t = Math.abs(s - a.s) / (a.r * 1.8);
      if (t >= 1) continue;
      const w = 0.5 + 0.5 * Math.cos(Math.PI * t);
      let fy = clamp((a.y + a.r + 0.06 - y) / 0.3, 0, 1); fy = fy * fy * (3 - 2 * fy);
      f = Math.max(f, w * fy);
    }
    return f * F;
  }
  sideW(s: number, y: number) {
    const u = (y - this.sillY) / Math.max(0.1, this.beltY - this.sillY);
    let f = 1;
    const tu = 0.3, tk = this.d.tuck ?? 0.06;
    if (u < tu) f -= tk * Math.pow((tu - Math.max(u, -0.2)) / tu, 2);
    const sh = this.d.shoulder ?? 0.035;
    if (u > 0.6) f -= sh * Math.pow(Math.min(1, (u - 0.6) / 0.4), 2);
    if (u > 1) f -= Math.min(0.1, (u - 1) * 0.05);
    return this.hwPlan(s) * f + this.flare(s, y);
  }
  crownAt(s: number) {
    const c = (this.d.crown ?? 0.02) * this.W;
    if (!this.cab) return c;
    const dist = s < this.cab.sR ? this.cab.sR - s : s > this.cab.sF ? s - this.cab.sF : 0;
    return c * clamp(dist / 0.25, 0, 1);
  }

  // ------------------------------------------------------------ glasshouse
  private cabinData(): Cabin | null {
    const T = this.T, by = this.beltY;
    let iP = 0; for (let i = 0; i < T.length; i++) if (T[i].y > T[iP].y) iP = i;
    if (T[iP].y < by + 0.06) return null;
    let iR = iP; while (iR > 1 && T[iR - 1].y > by) iR--;
    let iF = iP; while (iF < T.length - 2 && T[iF + 1].y > by) iF++;
    const cross = (a: V2, b: V2) => { const t = (by - a.y) / (b.y - a.y || 1e-6); return v2(a.x + (b.x - a.x) * t, by); };
    const raw = [cross(T[iR - 1], T[iR]), ...T.slice(iR, iF + 1), cross(T[iF + 1], T[iF])];
    // arc-length resample
    const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + raw[i].distanceTo(raw[i - 1]));
    const L = cum[cum.length - 1], n = clamp(Math.round(L / 0.11), 14, 32);
    const C: V2[] = [];
    let k = 0;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * L; while (k < cum.length - 2 && cum[k + 1] < t) k++;
      const u = (t - cum[k]) / (cum[k + 1] - cum[k] || 1); C.push(raw[k].clone().lerp(raw[k + 1], u));
    }
    const top = Math.max(...C.map((p) => p.y));
    const rtS = (this.d.rt ?? -0.3) * this.hl, ftS = (this.d.ft ?? 0.2) * this.hl;
    // insert exact roof boundaries (on the upper part of the curve)
    for (const sb of [rtS, ftS]) {
      for (let i = 0; i < C.length - 1; i++) {
        const a = C[i], b = C[i + 1];
        if ((a.x - sb) * (b.x - sb) < 0 && Math.min(a.y, b.y) > by + (top - by) * 0.4) {
          const u = (sb - a.x) / (b.x - a.x); const p = a.clone().lerp(b, u);
          if (p.distanceTo(a) > 0.02 && p.distanceTo(b) > 0.02) C.splice(i + 1, 0, p); else if (p.distanceTo(a) <= 0.02) C[i] = p; else C[i + 1] = p;
          break;
        }
      }
    }
    const nrm: V2[] = C.map((_, i) => {
      const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize(); return v2(t.y, -t.x);
    });
    const rr0 = Math.min(0.06, (top - by) * 0.16);
    const rr = C.map((p) => rr0 * clamp((p.y - by) / 0.1, 0, 1));
    const q = C.map((p, i) => p.clone().addScaledVector(nrm[i], rr[i]));
    return { C, n: nrm, q, rr, sR: C[0].x, sF: C[C.length - 1].x, rtS, ftS, top, crown: Math.min(0.04, this.W * 0.02), pw: 0.065 };
  }
  /** cabin half width at (s, y) */
  cw(s: number, y: number) {
    const c = this.cab!;
    const base = this.sideW(s, this.beltY) - (this.d.rTop ?? 0.07) - 0.012;
    return base * (1 - (this.d.tumble ?? 0.16) * clamp((y - this.beltY) / Math.max(0.05, c.top - this.beltY), 0, 1));
  }
  /** top of the glasshouse curve at s (centre line, no crown) */
  cabTop(s: number) {
    const c = this.cab; if (!c) return -Infinity;
    let hi = -Infinity;
    for (let i = 0; i < c.C.length - 1; i++) {
      const a = c.C[i], b = c.C[i + 1];
      if ((a.x - s) * (b.x - s) > 0) continue;
      const y = a.x === b.x ? Math.max(a.y, b.y) : a.y + ((b.y - a.y) * (s - a.x)) / (b.x - a.x);
      if (y > hi) hi = y;
    }
    return hi;
  }

  // ------------------------------------------------------------ stations & rings
  private stations() {
    const S: number[] = [];
    const a = this.xmin + 1e-3, b = this.xmax - 1e-3, N0 = this.d.res ?? 24;
    for (let i = 0; i <= N0; i++) { const t = i / N0; const tt = 0.4 * t + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * t)); S.push(a + (b - a) * tt); }
    for (const ar of this.d.arches) {
      for (let k = 0; k <= 7; k++) { const th = (k / 7) * Math.PI; S.push(ar.s + Math.cos(th) * ar.r * 0.999); }
      S.push(ar.s - ar.r - 0.04, ar.s + ar.r + 0.04);
    }
    for (const [x] of this.d.profile) S.push(x * this.hl);
    if (this.cab) S.push(this.cab.sR, this.cab.sF, this.cab.sR - 0.08, this.cab.sF + 0.08);
    S.sort((p, q) => p - q);
    const out: number[] = [];
    for (const s of S) { if (s < a || s > b) continue; if (!out.length || s - out[out.length - 1] > 0.022) out.push(s); }
    if (out[out.length - 1] < b - 0.005) out.push(b); else out[out.length - 1] = b;
    out[0] = a;
    this.st = out;
    this.rings = out.map((s) => this.ring(s));
  }
  /** height of the fender bulge over the wheels at s (or -Infinity) */
  fenderTop(s: number) {
    let f = -Infinity;
    for (const a of this.d.arches) {
      const R = a.r + 0.06 + (this.d.fender ?? 0), t = Math.abs(s - a.s) / (1.5 * R);
      if (t < 1) f = Math.max(f, a.y + R * Math.sqrt(1 - Math.pow(t, 2.5)));
    }
    return f;
  }
  /** centre floor, wheel-well roof and the well's inner lateral edge at s */
  private bottoms(s: number, ytC: number, ytO: number): [number, number, number] {
    const base = Math.min(this.span(s)[0], ytC - 0.025);
    let cut = base, xw = Infinity;
    for (const a of this.d.arches) {
      const dx = s - a.s;
      if (Math.abs(dx) < a.r) { const ay = a.y + Math.sqrt(a.r * a.r - dx * dx); if (ay > cut) cut = ay; xw = Math.min(xw, a.x ?? 0); }
    }
    cut = Math.min(cut, ytO - 0.03);
    if (!(xw > 0) || xw === Infinity) return [cut, cut, 0];
    return [base, Math.max(base, cut), xw];
  }
  /** half ring (lat,y) from bottom centre to top centre, mirrored into a full ring */
  private ring(s: number) {
    const ytC = this.topLower(s), ytO = Math.max(ytC, this.fenderTop(s));
    const [ybC, yb, xw] = this.bottoms(s, ytC, ytO), h = ytO - yb;
    const rB = clamp(h * 0.18, 0.006, this.d.rBot ?? 0.055), rT = clamp(h * 0.3, 0.008, this.d.rTop ?? 0.07);
    const cr = this.crownAt(s);
    const half: number[] = [];
    const P = (x: number, y: number) => half.push(Math.max(0, x), y);
    const swb = this.sideW(s, yb + rB);
    const xwell = Math.min(xw, swb - rB - 0.02);
    P(0, ybC); P(xwell, ybC); P(xwell, yb);
    P(swb - rB, yb); P(swb - rB + rB * 0.7071, yb + rB - rB * 0.7071); P(swb, yb + rB);
    let y0 = yb + rB; const y1 = ytO - rT;
    if (this.d.clad != null) { const yc = clamp(this.d.clad, y0, y1); P(this.sideW(s, yc), yc); y0 = yc; }
    for (const f of [0.4, 0.78]) { const y = lerp(y0, y1, f); P(this.sideW(s, y), y); }
    const swa = this.sideW(s, y1), zc = swa - rT;
    P(swa, y1); P(swa - rT + rT * 0.7071, y1 + rT * 0.7071); P(zc, ytO);
    const top = (f: number) => { let k = clamp((f - 0.3) / 0.55, 0, 1); k = k * k * (3 - 2 * k); return ytC + cr * (1 - f * f) + (ytO - ytC) * k; };
    P(zc * 0.66, top(0.66)); P(zc * 0.33, top(0.33)); P(0, top(0));
    const NH = half.length / 2, RN = NH * 2 - 2, r = new Float32Array(RN * 2);
    for (let k = 0; k < NH; k++) { r[k * 2] = half[k * 2]; r[k * 2 + 1] = half[k * 2 + 1]; }
    for (let k = NH; k < RN; k++) { const m = RN - k; r[k * 2] = -half[m * 2]; r[k * 2 + 1] = half[m * 2 + 1]; }
    return r;
  }

  // ------------------------------------------------------------ analytic ray casting
  private _r = new Float32Array(64);
  private ringAt(s: number) {
    const st = this.st; if (s < st[0] || s > st[st.length - 1]) return null;
    let lo = 0, hi = st.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (st[m] <= s) lo = m; else hi = m; }
    const t = (s - st[lo]) / (st[hi] - st[lo] || 1), A = this.rings[lo], B = this.rings[hi], r = this._r;
    for (let i = 0; i < this.RN * 2; i++) r[i] = A[i] + (B[i] - A[i]) * t;
    return r;
  }
  insideLower(x: number, y: number, z: number) {
    const r = this.ringAt(z - this.z0); if (!r) return false;
    x -= this.x0;
    let c = false; const n = this.RN;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[i * 2], yi = r[i * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  insideCab(x: number, y: number, z: number) {
    z -= this.z0;
    const c = this.cab; if (!c || z <= c.sR || z >= c.sF || y < this.beltY) return false;
    const cw = this.cw(z, y); x -= this.x0;
    if (Math.abs(x) > cw) return false;
    const t = this.cabTop(z), cq = Math.max(0.1, cw - 0.05);
    return y < t + c.crown * Math.max(0, 1 - (x / cq) ** 2);
  }
  inside(x: number, y: number, z: number) { return this.insideLower(x, y, z) || this.insideCab(x, y, z); }
  /** march a ray (origin o, unit dir d) into the body; returns the surface point or null */
  project(o: THREE.Vector3, d: THREE.Vector3, out = new THREE.Vector3(), maxT = 8, depth = Infinity) {
    const step = 0.035;
    let t = 0, prev = 0, hit = false;
    // skip to the bounding box
    const bx = this.W / 2 + (this.d.flare ?? 0) + 0.1 + Math.abs(this.x0);
    let t0 = 0, t1 = maxT;
    const slab = (oo: number, dd: number, lo: number, hi: number) => {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) t1 = -1; return; }
      let a = (lo - oo) / dd, b = (hi - oo) / dd; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    };
    slab(o.x, d.x, -bx, bx); slab(o.y, d.y, -0.1, this.maxY + 0.2); slab(o.z, d.z, this.xmin - 0.02 + this.z0, this.xmax + 0.02 + this.z0);
    if (t1 < t0) return null;
    const tEnd = Math.min(t1, t0 + depth);
    for (t = t0; t <= tEnd; t += step) {
      if (this.inside(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) { hit = true; break; }
      prev = t;
    }
    if (!hit) return null;
    let a = prev, b = t;
    for (let i = 0; i < 13; i++) { const m = (a + b) / 2; if (this.inside(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m)) b = m; else a = m; }
    return out.copy(o).addScaledVector(d, b);
  }

  // ------------------------------------------------------------ meshes
  /** lofted lower body + end caps */
  buildLower(kit: Kit, underColor: Col = K.black, cladColor: Col = K.plastic) {
    const st = this.st, R = this.rings, RN = this.RN, NH = this.NH, nS = st.length, x0 = this.x0;
    const pos = new Float32Array(nS * RN * 3), nor = new Float32Array(nS * RN * 3);
    for (let i = 0; i < nS; i++) for (let k = 0; k < RN; k++) {
      const o = (i * RN + k) * 3; pos[o] = R[i][k * 2] + x0; pos[o + 1] = R[i][k * 2 + 1]; pos[o + 2] = st[i] + this.z0;
    }
    const idx = (i: number, k: number) => i * RN + (k % RN);
    const quads: [number, number, number, number, number][] = []; // a b c d segK
    const fa = new THREE.Vector3(), fb = new THREE.Vector3(), fc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const P = (j: number, v: THREE.Vector3) => v.set(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    const accum = (a: number, b: number, c: number) => {
      P(a, fa); P(b, fb); P(c, fc); e1.subVectors(fb, fa); e2.subVectors(fc, fa); e1.cross(e2);
      for (const j of [a, b, c]) { nor[j * 3] += e1.x; nor[j * 3 + 1] += e1.y; nor[j * 3 + 2] += e1.z; }
    };
    for (let i = 0; i < nS - 1; i++) for (let k = 0; k < RN; k++) {
      const segK = k < NH - 1 ? k : RN - 1 - k;
      // outward winding: ring goes counter-clockwise seen from the front (+z) → (i,k)->(i,k+1)->(i+1,k+1)
      const a = idx(i, k), b = idx(i + 1, k), c = idx(i + 1, k + 1), d = idx(i, k + 1);
      quads.push([a, b, c, d, segK]);
      accum(a, b, c); accum(a, c, d);
    }
    // detect winding once: the top-centre quad normal must point up
    const test = quads.find((q) => q[4] === NH - 2)!;
    P(test[0], fa); P(test[1], fb); P(test[2], fc); e1.subVectors(fb, fa); e2.subVectors(fc, fa); e1.cross(e2);
    const flip = e1.y < 0;
    if (flip) for (let j = 0; j < nor.length; j++) nor[j] = -nor[j];
    const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
    const Nn = (j: number, v: THREE.Vector3) => v.set(nor[j * 3], nor[j * 3 + 1], nor[j * 3 + 2]).normalize();
    const skin = this.d.skin ?? "paint", skinC = this.d.skinColor ?? 0xffffff;
    const clad = this.d.clad != null;
    for (const [a, b, c, d, segK] of quads) {
      const under = segK <= 2, cl = clad && (segK === 3 || segK === 4 || segK === 5);
      const bk: Bucket = under || cl ? "trim" : skin, colr = under ? underColor : cl ? cladColor : skinC;
      const tri = (p: number, q: number, r: number) => {
        if (flip) [q, r] = [r, q];
        kit.tri(bk, P(p, new THREE.Vector3()), P(q, new THREE.Vector3()), P(r, new THREE.Vector3()), colr, Nn(p, na).clone(), Nn(q, nb).clone(), Nn(r, nc).clone());
      };
      tri(a, b, c); tri(a, c, d);
    }
    // end caps (flat bumper faces)
    for (const [i, dir] of [[0, -1], [nS - 1, 1]] as const) {
      const r = R[i], cx = x0, cy = (r[1] + r[(NH - 1) * 2 + 1]) / 2, z = st[i] + this.z0;
      const n = new THREE.Vector3(0, 0, dir), ctr = new THREE.Vector3(cx, cy, z);
      for (let k = 0; k < RN; k++) {
        const k2 = (k + 1) % RN;
        const p1 = new THREE.Vector3(r[k * 2] + x0, r[k * 2 + 1], z), p2 = new THREE.Vector3(r[k2 * 2] + x0, r[k2 * 2 + 1], z);
        const bk: Bucket = skin, cc = skinC;
        e1.subVectors(p1, ctr); e2.subVectors(p2, ctr); e1.cross(e2);
        if (e1.dot(n) >= 0) kit.tri(bk, ctr, p1, p2, cc, n, n, n); else kit.tri(bk, ctr, p2, p1, cc, n, n, n);
      }
    }
  }

  /** glasshouse: roof strip (roof / glass / pillars), framed side windows, inner headliner */
  buildCabin(kit: Kit, w: WinOpts = {}) {
    const c = this.cab; if (!c) return;
    const x0 = this.x0, by = this.beltY, n = c.C.length;
    const cols = 11;
    const grid: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const C = c.C[i], nn = c.n[i], rr = c.rr[i], q = c.q[i];
      const cwE = this.cw(q.x, q.y), cq = Math.max(0.05, cwE - rr), pw = Math.min(c.pw, cq * 0.35);
      const crown = (lat: number) => c.crown * Math.max(0, 1 - (lat / cq) ** 2) * clamp((C.y - by) / 0.12, 0, 1);
      const at = (lat: number, p: V2, out: number) => new THREE.Vector3(lat + x0, p.y - nn.y * out, p.x - nn.x * out);
      const half = [
        at(cwE, q, 0),
        new THREE.Vector3(cq + rr * 0.7071 + x0, q.y - nn.y * rr * 0.7071, q.x - nn.x * rr * 0.7071),
        at(cq, C, 0),
        at(cq - pw, C, crown(cq - pw)),
        at((cq - pw) * 0.5, C, crown((cq - pw) * 0.5)),
      ];
      const ctr = at(0, C, crown(0));
      const row = [...half, ctr, ...half.slice().reverse().map((p) => new THREE.Vector3(2 * x0 - p.x, p.y, p.z))];
      grid.push(...row);
    }
    // smooth normals
    const nor = grid.map(() => new THREE.Vector3());
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const G = (i: number, j: number) => i * cols + j;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < cols - 1; j++) {
      const a = G(i, j), b = G(i + 1, j), cc = G(i + 1, j + 1), d = G(i, j + 1);
      for (const [p, q, r] of [[a, b, cc], [a, cc, d]]) {
        e1.subVectors(grid[q], grid[p]); e2.subVectors(grid[r], grid[p]); e1.cross(e2);
        nor[p].add(e1); nor[q].add(e1); nor[r].add(e1);
      }
    }
    // orient outward (roof normals up)
    const mid = G(Math.floor(n / 2), 5);
    const flip = nor[mid].y < 0;
    nor.forEach((v) => { if (flip) v.negate(); v.normalize(); });
    // edge columns get the side-surface normal so the roof rail blends into the window frame
    for (let i = 0; i < n; i++) for (const [j, sg] of [[0, 1], [cols - 1, -1]] as const) {
      const q = c.q[i], h = 0.01;
      const dcs = (this.cw(q.x + h, q.y) - this.cw(q.x - h, q.y)) / (2 * h), dcy = (this.cw(q.x, q.y + h) - this.cw(q.x, q.y - h)) / (2 * h);
      nor[G(i, j)].set(sg, -dcy, -dcs * sg * sg).normalize();
    }
    const roofB: Bucket = w.roof === "black" ? "metal" : w.roof === "accent" ? "accent" : "paint";
    const roofC: Col = w.roof === "black" ? 0x0d0e11 : 0xffffff;
    const pillB: Bucket = w.pillarsBlack ? "metal" : "paint", pillC: Col = w.pillarsBlack ? 0x0d0e11 : 0xffffff;
    for (let i = 0; i < n - 1; i++) {
      const sm = (c.C[i].x + c.C[i + 1].x) / 2;
      const region = sm < c.rtS ? "rear" : sm > c.ftS ? "front" : "roof";
      for (let j = 0; j < cols - 1; j++) {
        const inner = j >= 3 && j <= 6;
        let bk: Bucket, cc: Col;
        if (region === "roof") { bk = w.roof === "glass" && inner ? "glass" : roofB; cc = roofC; }
        else if (inner) { bk = "glass"; cc = 0xffffff; }
        else { bk = pillB; cc = pillC; }
        const a = G(i, j), b = G(i + 1, j), cc2 = G(i + 1, j + 1), d = G(i, j + 1);
        const T = (p: number, q: number, r: number) => {
          const pp = p; let [qq, rr] = [q, r];
          e1.subVectors(grid[qq], grid[pp]); e2.subVectors(grid[rr], grid[pp]); e1.cross(e2);
          if (e1.dot(nor[pp].clone().add(nor[qq]).add(nor[rr])) < 0) [qq, rr] = [rr, qq];
          kit.tri(bk, grid[pp], grid[qq], grid[rr], cc, nor[pp], nor[qq], nor[rr]);
          if (bk !== "glass" && j >= 1 && j <= cols - 3) { // headliner (inside, dark)
            const off = (k: number) => grid[k].clone().addScaledVector(nor[k], -0.014);
            kit.tri("trim", off(pp), off(rr), off(qq), K.interior, nor[pp].clone().negate(), nor[rr].clone().negate(), nor[qq].clone().negate());
          }
        };
        T(a, b, cc2); T(a, cc2, d);
      }
    }
    // ---- side frames + windows
    const by2 = by + 0.022;
    const m = w.margin ?? Math.min(0.05, (c.top - by) * 0.13);
    const wpts: V2[] = c.q.map((q, i) => q.clone().addScaledVector(c.n[i], m));
    let first = -1, last = -1;
    for (let i = 0; i < wpts.length; i++) if (wpts[i].y > by2) { if (first < 0) first = i; last = i; }
    const sideMap = (p: V2, sg: number, out = 0) => {
      const cwv = this.cw(p.x, p.y);
      const h = 0.01, dcs = (this.cw(p.x + h, p.y) - this.cw(p.x - h, p.y)) / (2 * h), dcy = (this.cw(p.x, p.y + h) - this.cw(p.x, p.y - h)) / (2 * h);
      const nn = new THREE.Vector3(sg, -dcy, -dcs * sg * sg).normalize();
      return { p: new THREE.Vector3(sg * cwv + x0, p.y, p.x).addScaledVector(nn, out), n: nn };
    };
    const contour = c.q.map((p) => p.clone());
    const holes: V2[][] = [];
    const pillarsPoly: V2[][] = [];
    let full: V2[] = [];
    if (first > 0 && last > first) {
      const cr = (a: V2, b: V2) => { const t = (by2 - a.y) / (b.y - a.y); return v2(a.x + (b.x - a.x) * t, by2); };
      full = [cr(wpts[first - 1], wpts[first]), ...wpts.slice(first, last + 1), cr(wpts[last + 1] ?? wpts[last], wpts[last])];
      // limits
      if (w.rb != null) full = clipPoly(full, w.rb * this.hl, by2, w.rSlant ?? 0.35, true);
      if (w.fb != null) full = clipPoly(full, w.fb * this.hl, by2, w.fSlant ?? -0.5, false);
      if (full.length >= 3) {
        const sMin = Math.min(...full.map((p) => p.x)), sMax = Math.max(...full.map((p) => p.x));
        const ps = (w.pillars ?? [0.5]).map((f) => lerp(sMin, sMax, f)), pw = w.pw ?? 0.075, sl = w.pSlant ?? 0.18;
        this.pillarS = ps; this.winS = [sMin, sMax];
        let rest = full;
        for (const ps0 of ps) {
          const left = clipPoly(rest, ps0 - pw / 2, by2, sl, false);
          const pil = clipPoly(clipPoly(rest, ps0 - pw / 2, by2, sl, true), ps0 + pw / 2, by2, sl, false);
          if (left.length >= 3) holes.push(left);
          if (pil.length >= 3) pillarsPoly.push(pil);
          rest = clipPoly(rest, ps0 + pw / 2, by2, sl, true);
        }
        if (rest.length >= 3) holes.push(rest);
      }
    }
    for (const sg of [1, -1]) {
      // frame (paint) with window holes
      const tris = THREE.ShapeUtils.triangulateShape(contour.map((p) => p.clone()), holes.map((h) => h.map((p) => p.clone())));
      const all = [...contour, ...holes.flat()];
      const M = all.map((p) => sideMap(p, sg)), Mi = all.map((p) => sideMap(p, sg, -0.012));
      for (const [a, b, cc] of tris) {
        const p = a; let [q, r] = [b, cc];
        e1.subVectors(M[q].p, M[p].p); e2.subVectors(M[r].p, M[p].p); e1.cross(e2);
        if (e1.x * sg < 0) [q, r] = [r, q];
        kit.tri(pillB === "metal" ? "paint" : pillB, M[p].p, M[q].p, M[r].p, 0xffffff, M[p].n, M[q].n, M[r].n);
        kit.tri("trim", Mi[p].p, Mi[r].p, Mi[q].p, K.interior, M[p].n.clone().negate(), M[r].n.clone().negate(), M[q].n.clone().negate());
      }
      // glass
      for (const h of holes) {
        const tt = THREE.ShapeUtils.triangulateShape(h.map((p) => p.clone()), []);
        const HM = h.map((p) => sideMap(p, sg, -0.004));
        for (const [a, b, cc] of tt) {
          const p = a; let [q, r] = [b, cc];
          e1.subVectors(HM[q].p, HM[p].p); e2.subVectors(HM[r].p, HM[p].p); e1.cross(e2);
          if (e1.x * sg < 0) [q, r] = [r, q];
          kit.tri("glass", HM[p].p, HM[q].p, HM[r].p, 0xffffff, HM[p].n, HM[q].n, HM[r].n);
        }
        if (w.dlo) this.outline(kit, h, sg, w.dlo === "chrome" ? "metal" : "trim", w.dlo === "chrome" ? K.chrome : K.black, 0.016, sideMap);
      }
      // B-pillars (gloss black)
      for (const pp of pillarsPoly) {
        const tt = THREE.ShapeUtils.triangulateShape(pp.map((p) => p.clone()), []);
        const PM = pp.map((p) => sideMap(p, sg, 0.003));
        for (const [a, b, cc] of tt) {
          const p = a; let [q, r] = [b, cc];
          e1.subVectors(PM[q].p, PM[p].p); e2.subVectors(PM[r].p, PM[p].p); e1.cross(e2);
          if (e1.x * sg < 0) [q, r] = [r, q];
          kit.tri("metal", PM[p].p, PM[q].p, PM[r].p, 0x0c0d10, PM[p].n, PM[q].n, PM[r].n);
        }
      }
    }
  }

  /** thin strip just inside a polygon outline (window surrounds) */
  private outline(kit: Kit, poly: V2[], sg: number, b: Bucket, color: Col, wdt: number, map: (p: V2, sg: number, out?: number) => { p: THREE.Vector3; n: THREE.Vector3 }) {
    const n = poly.length; if (n < 3) return;
    let area = 0; for (let i = 0; i < n; i++) { const a = poly[i], c = poly[(i + 1) % n]; area += a.x * c.y - c.x * a.y; }
    const ccw = area > 0;
    const inner = poly.map((p, i) => {
      const a = poly[(i - 1 + n) % n], c = poly[(i + 1) % n];
      const e1 = p.clone().sub(a).normalize(), e2 = c.clone().sub(p).normalize();
      const n1 = ccw ? v2(-e1.y, e1.x) : v2(e1.y, -e1.x), n2 = ccw ? v2(-e2.y, e2.x) : v2(e2.y, -e2.x);
      const bis = n1.clone().add(n2); if (bis.lengthSq() < 1e-6) bis.copy(n1); bis.normalize();
      const k = wdt / Math.max(0.35, bis.dot(n1));
      return p.clone().addScaledVector(bis, k);
    });
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const A = map(poly[i], sg, 0.004), B = map(poly[j], sg, 0.004), C = map(inner[j], sg, 0.004), D = map(inner[i], sg, 0.004);
      for (const [p, q, r] of [[A, B, C], [A, C, D]]) {
        const pp = p; let [qq, rr] = [q, r];
        e1.subVectors(qq.p, pp.p); e2.subVectors(rr.p, pp.p); e1.cross(e2);
        if (e1.x * sg < 0) [qq, rr] = [rr, qq];
        kit.tri(b, pp.p, qq.p, rr.p, color, pp.n, qq.n, rr.n);
      }
    }
  }

  /** dark interior visible through the glass: floor, dash, steering wheel, seats (and an optional roll cage) */
  interior(kit: Kit, o: { seat?: Col; rear?: boolean; cage?: boolean; driverLat?: number } = {}) {
    const c = this.cab; if (!c) return;
    const by = this.beltY, x0 = this.x0, cabH = c.top - by;
    if (cabH < 0.14) return;
    // usable span where the glasshouse is tall enough
    const tall = c.C.filter((p) => p.y - by > cabH * 0.45);
    const s0 = Math.min(...tall.map((p) => p.x)), s1 = Math.max(...tall.map((p) => p.x));
    const midS = (s0 + s1) / 2, hw = this.cw(midS, by) - 0.03;
    for (let k = 0; k < 6; k++) {
      const za = lerp(c.sR + 0.04, c.sF - 0.04, k / 6), zb = lerp(c.sR + 0.04, c.sF - 0.04, (k + 1) / 6);
      if (Math.min(this.cabTop(za), this.cabTop(zb)) - by < 0.06) continue;
      const w2 = Math.min(this.cw(za, by), this.cw(zb, by)) - 0.03;
      kit.geo("trim", box(w2 * 2, 0.008, zb - za, x0, by + 0.004, (za + zb) / 2), K.interior);
    }
    // dashboard just behind the windscreen base
    let sDash = s1;
    for (const p of c.C) if (p.x > midS && p.y - by > Math.min(0.2, cabH * 0.45)) sDash = Math.max(sDash, p.x);
    const dh = Math.min(0.14, cabH * 0.32), dashW = this.cw(sDash, by) * 2 - 0.08;
    kit.geo("trim", box(dashW, dh, 0.34, x0, by + dh / 2 - 0.01, sDash - 0.12), K.dash);
    const dl = o.driverLat ?? this.cw(sDash, by) * 0.46;
    const sWheel = sDash - 0.34, yWheel = by + dh * 0.95;
    kit.geo("trim", torus(Math.min(0.17, cabH * 0.34), 0.022, x0 + dl, yWheel, sWheel, -0.5, 0, 4, 12), K.black);
    kit.geo("trim", box(0.07, 0.07, 0.25, x0 + dl, yWheel - 0.03, sWheel + 0.12, -0.5), K.black);
    // instrument glow, rear-view mirror
    kit.geo("head", box(0.22, 0.05, 0.01, x0 + dl, by + dh + 0.005, sWheel + 0.2, -0.9), 0x5fd0ff, 0.7);
    const zM = c.ftS - 0.04, yM = this.cabTop(zM) - 0.07;
    if (yM - by > 0.2) kit.geo("trim", box(0.2, 0.055, 0.025, x0, yM, zM), K.black);
    // seats
    const seatH = Math.min(0.5, cabH * 0.78), sSeat = Math.max(s0 + 0.12, sWheel - 0.62);
    kit.geo("trim", box(0.18, 0.12, 0.5, x0, by + 0.04, sSeat + 0.28), K.dash);
    const seatC = o.seat ?? K.seat;
    for (const lat of [dl, -dl]) {
      kit.geo("trim", box(0.44, seatH, 0.13, x0 + lat, by - 0.06 + seatH / 2, sSeat, -0.2), seatC);
      kit.geo("trim", box(0.26, Math.min(0.15, seatH * 0.3), 0.1, x0 + lat, by - 0.06 + seatH + 0.05, sSeat - 0.07, -0.2), seatC);
    }
    if (o.rear && sSeat - 0.8 > s0 - 0.05) kit.geo("trim", box(hw * 1.7, seatH * 0.85, 0.16, x0, by - 0.06 + seatH * 0.42, sSeat - 0.82, -0.2), seatC);
    if (o.cage) {
      const top = by + cabH * 0.86, sx = this.cw(sSeat - 0.2, by) - 0.07, sz = sSeat - 0.22;
      const A = (x: number, y: number, z: number) => new THREE.Vector3(x + x0, y, z);
      for (const g of [
        tube(A(sx, by, sz), A(sx, top, sz), 0.022), tube(A(-sx, by, sz), A(-sx, top, sz), 0.022), tube(A(sx, top, sz), A(-sx, top, sz), 0.022),
        tube(A(sx, by, sz), A(-sx, top, sz), 0.018), tube(A(sx * 0.9, top, sz), A(sx * 0.85, by + cabH * 0.6, sDash - 0.1), 0.018),
        tube(A(-sx * 0.9, top, sz), A(-sx * 0.85, by + cabH * 0.6, sDash - 0.1), 0.018),
      ]) kit.geo("trim", g, 0xd8dade);
    }
  }
}

/** keep the part of a polygon in front of (keepFront) or behind a slanted line through (s0, y0): s = s0 + slant*(y-y0) */
export function clipPoly(poly: V2[], s0: number, y0: number, slant: number, keepFront: boolean) {
  const f = (p: V2) => (p.x - (s0 + slant * (p.y - y0))) * (keepFront ? 1 : -1);
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(a.clone().lerp(b, t)); }
  }
  return out;
}
