// Procedural closed-loop race tracks sampled every metre. Cars live in "track space":
// s = distance along the centre line (m, 0..length), d = lateral offset (m, + = right of travel).
import * as THREE from "three";

export interface TrackOptions {
  seed: number;
  /** road width in metres (12..18) */
  width: number;
  /** 0 = gentle oval-ish, 1 = twisty */
  curviness: number;
  /** 0 = flat, 1 = big hills */
  hills: number;
  /** track size scale (0.7..1.3) */
  size: number;
  reverse: boolean;
}

export function mulberry(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

export class Track {
  readonly length: number;
  readonly n: number;
  readonly halfWidth: number;
  /** grass/gravel run-off between the road edge and the barrier */
  readonly shoulder = 6.5;
  /** per-sample data (sample i is at s = i metres * step) */
  readonly px: Float32Array; readonly py: Float32Array; readonly pz: Float32Array;
  readonly tx: Float32Array; readonly ty: Float32Array; readonly tz: Float32Array;
  readonly rx: Float32Array; readonly rz: Float32Array;
  /** signed curvature (1/m), + = road bends to the right; raw and smoothed */
  readonly kRaw: Float32Array; readonly k: Float32Array;
  /** visual banking (radians, + = left edge higher) */
  readonly bank: Float32Array;
  readonly step: number;
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
  readonly seed: number;

  constructor(o: TrackOptions) {
    this.seed = o.seed;
    this.halfWidth = o.width / 2;
    let pts: THREE.Vector3[] = [];
    let samples: THREE.Vector3[] = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      const rnd = mulberry(o.seed * 7919 + attempt * 104729 + 17);
      const n = 9 + Math.floor(rnd() * 5);
      const R = (250 + rnd() * 110) * o.size;
      const phase = rnd() * Math.PI * 2, phase2 = rnd() * Math.PI * 2;
      pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * ((Math.PI * 2) / n) * 0.55;
        const r = R * (1 - o.curviness * 0.4 + rnd() * (0.25 + o.curviness * 0.55));
        const y = o.hills * (Math.sin(a * 2 + phase) * 13 + Math.sin(a * 3 + phase2) * 7 + (rnd() - 0.5) * 6);
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
      const L = curve.getLength();
      samples = curve.getSpacedPoints(Math.round(L / 1.0));
      samples.pop(); // closed: last == first
      if (this.valid(samples, this.halfWidth + this.shoulder)) break;
    }
    if (o.reverse) samples.reverse();
    const n = samples.length;
    // total length from the samples themselves
    let L = 0;
    for (let i = 0; i < n; i++) L += samples[i].distanceTo(samples[(i + 1) % n]);
    this.length = L; this.n = n; this.step = L / n;

    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n); this.tz = new Float32Array(n);
    this.rx = new Float32Array(n); this.rz = new Float32Array(n);
    this.kRaw = new Float32Array(n); this.k = new Float32Array(n); this.bank = new Float32Array(n);

    // start line on the straightest stretch
    const head = new Float32Array(n);
    const t = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      t.subVectors(samples[(i + 1) % n], samples[(i - 1 + n) % n]);
      head[i] = Math.atan2(t.x, t.z);
    }
    const kr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let dh = head[(i + 1) % n] - head[(i - 1 + n) % n];
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      kr[i] = -dh / (2 * this.step);
    }
    let best = 0, bestV = Infinity;
    const W = Math.round(90 / this.step);
    for (let i = 0; i < n; i += 3) {
      let m = 0;
      for (let j = -W; j <= W; j += 3) m = Math.max(m, Math.abs(kr[(i + j + n) % n]));
      if (m < bestV) { bestV = m; best = i; }
    }
    const order = (i: number) => (i + best) % n;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = samples[order(i)];
      this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z;
      this.kRaw[i] = kr[order(i)];
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    this.bounds = { minX, maxX, minZ, maxZ, minY, maxY };
    const r = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i + 1) % n, b = (i - 1 + n) % n;
      t.set(this.px[a] - this.px[b], this.py[a] - this.py[b], this.pz[a] - this.pz[b]).normalize();
      this.tx[i] = t.x; this.ty[i] = t.y; this.tz[i] = t.z;
      r.crossVectors(t, UP).normalize();
      this.rx[i] = r.x; this.rz[i] = r.z;
    }
    // smoothed curvature (what drivers "feel") and gentle banking
    const S = Math.max(2, Math.round(7 / this.step));
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = -S; j <= S; j++) sum += this.kRaw[(i + j + n) % n];
      this.k[i] = sum / (2 * S + 1);
    }
    for (let i = 0; i < n; i++) this.bank[i] = THREE.MathUtils.clamp(this.k[i] * 7, -0.065, 0.065);
  }

  /** two stretches of road must never overlap: check centre-line clearance */
  private valid(s: THREE.Vector3[], half: number) {
    const n = s.length, step = 4, minGap = half * 2 + 8, arc = 90;
    for (let i = 0; i < n; i += step) {
      for (let j = i + arc; j < n; j += step) {
        if (n - (j - i) < arc) continue;
        const dx = s[i].x - s[j].x, dz = s[i].z - s[j].z;
        if (dx * dx + dz * dz < minGap * minGap) return false;
      }
    }
    return true;
  }

  wrap(s: number) { const L = this.length; return ((s % L) + L) % L; }
  /** shortest signed distance from a to b along the loop */
  delta(a: number, b: number) { let d = this.wrap(b) - this.wrap(a); const L = this.length; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }

  private lerpArr(arr: Float32Array, s: number) {
    const f = this.wrap(s) / this.step, i = Math.floor(f), u = f - i;
    const a = arr[i % this.n], b = arr[(i + 1) % this.n];
    return a + (b - a) * u;
  }
  kappa(s: number) { return this.lerpArr(this.k, s); }
  bankAt(s: number) { return this.lerpArr(this.bank, s); }
  /** max |curvature| over the next `ahead` metres (for AI braking) */
  kappaAhead(s: number, from: number, ahead: number) {
    let m = 0, sign = 0;
    for (let x = from; x <= from + ahead; x += 3) { const k = this.kappa(s + x); if (Math.abs(k) > m) { m = Math.abs(k); sign = Math.sign(k); } }
    return m * sign;
  }

  /** world position of (s, d); y includes banking */
  point(s: number, d: number, out = new THREE.Vector3()) {
    const f = this.wrap(s) / this.step, i = Math.floor(f) % this.n, j = (i + 1) % this.n, u = f - Math.floor(f);
    const x = this.px[i] + (this.px[j] - this.px[i]) * u, y = this.py[i] + (this.py[j] - this.py[i]) * u, z = this.pz[i] + (this.pz[j] - this.pz[i]) * u;
    const rx = this.rx[i] + (this.rx[j] - this.rx[i]) * u, rz = this.rz[i] + (this.rz[j] - this.rz[i]) * u;
    const b = this.bank[i] + (this.bank[j] - this.bank[i]) * u;
    return out.set(x + rx * d, y - d * b, z + rz * d);
  }
  tangent(s: number, out = new THREE.Vector3()) {
    const f = this.wrap(s) / this.step, i = Math.floor(f) % this.n, j = (i + 1) % this.n, u = f - Math.floor(f);
    return out.set(this.tx[i] + (this.tx[j] - this.tx[i]) * u, this.ty[i] + (this.ty[j] - this.ty[i]) * u, this.tz[i] + (this.tz[j] - this.tz[i]) * u).normalize();
  }
  right(s: number, out = new THREE.Vector3()) {
    const f = this.wrap(s) / this.step, i = Math.floor(f) % this.n, j = (i + 1) % this.n, u = f - Math.floor(f);
    return out.set(this.rx[i] + (this.rx[j] - this.rx[i]) * u, 0, this.rz[i] + (this.rz[j] - this.rz[i]) * u).normalize();
  }
  /** heading angle (rotation about Y) of the road at s, for objects whose +Z is forward */
  heading(s: number) { const t = this.tangent(s, _t); return Math.atan2(t.x, t.z); }
  /** slope angle (+ = uphill) */
  pitch(s: number) { const t = this.tangent(s, _t); return Math.asin(THREE.MathUtils.clamp(t.y, -1, 1)); }

  /**
   * Ribbon geometry following the road between lateral offsets d0..d1 (d0 < d1), e.g. the road itself,
   * kerbs, shoulders or road markings. `lift` raises it slightly to avoid z-fighting, vScale = metres per V unit.
   */
  ribbon(d0: number, d1: number, { lift = 0, vScale = 10, every = 1, sMin = 0, sMax = Infinity, uRepeat = 1 } = {}) {
    const idx: number[] = [];
    for (let i = 0; i < this.n; i += every) {
      const s = i * this.step;
      if (s >= sMin && s <= sMax) idx.push(i);
    }
    const loop = sMin === 0 && sMax === Infinity;
    if (loop) idx.push(0);
    const pos = new Float32Array(idx.length * 2 * 3), uv = new Float32Array(idx.length * 2 * 2), nor = new Float32Array(idx.length * 2 * 3);
    let vAcc = 0;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      if (k > 0) {
        const p = idx[k - 1];
        vAcc += Math.hypot(this.px[i] - this.px[p], this.py[i] - this.py[p], this.pz[i] - this.pz[p]) / vScale;
      }
      for (let e = 0; e < 2; e++) {
        const d = e ? d1 : d0, o = (k * 2 + e);
        pos[o * 3] = this.px[i] + this.rx[i] * d;
        pos[o * 3 + 1] = this.py[i] - d * this.bank[i] + lift;
        pos[o * 3 + 2] = this.pz[i] + this.rz[i] * d;
        uv[o * 2] = e * uRepeat; uv[o * 2 + 1] = vAcc;
        nor[o * 3] = this.rx[i] * this.bank[i]; nor[o * 3 + 1] = 1; nor[o * 3 + 2] = this.rz[i] * this.bank[i];
      }
    }
    const index: number[] = [];
    for (let k = 0; k < idx.length - 1; k++) {
      const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
      index.push(a, b, c, b, d, c); // counter-clockwise seen from above
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeBoundingSphere();
    return g;
  }

  /** vertical wall ribbon at lateral offset d (barriers, fences, neon tubes); u runs along, v up */
  wall(d: number, height: number, { base = 0, uScale = 4, every = 2 } = {}) {
    const idx: number[] = [];
    for (let i = 0; i < this.n; i += every) idx.push(i);
    idx.push(0);
    const pos = new Float32Array(idx.length * 2 * 3), uv = new Float32Array(idx.length * 2 * 2);
    let uAcc = 0;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      if (k > 0) { const p = idx[k - 1]; uAcc += Math.hypot(this.px[i] - this.px[p], this.pz[i] - this.pz[p]) / uScale; }
      const x = this.px[i] + this.rx[i] * d, z = this.pz[i] + this.rz[i] * d, y = this.py[i] - d * this.bank[i] + base;
      pos.set([x, y, z, x, y + height, z], k * 6);
      uv.set([uAcc, 0, uAcc, 1], k * 4);
    }
    const index: number[] = [];
    for (let k = 0; k < idx.length - 1; k++) { const a = k * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }

  /** 2D outline for minimaps, normalised to 0..1 (keeps aspect) */
  outline(points = 160) {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const span = Math.max(maxX - minX, maxZ - minZ);
    const out: [number, number][] = [];
    for (let k = 0; k < points; k++) {
      const i = Math.floor((k / points) * this.n);
      out.push([(this.px[i] - minX) / span + (1 - (maxX - minX) / span) / 2, (this.pz[i] - minZ) / span + (1 - (maxZ - minZ) / span) / 2]);
    }
    return out;
  }
  /** normalised minimap coords for (s, d) */
  mapXY(s: number, d = 0) {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const span = Math.max(maxX - minX, maxZ - minZ);
    const p = this.point(s, d, _p);
    return [(p.x - minX) / span + (1 - (maxX - minX) / span) / 2, (p.z - minZ) / span + (1 - (maxZ - minZ) / span) / 2] as const;
  }

  /** mapXY into an existing [x, y] array (no allocation) */
  mapXYInto(s: number, d: number, out: [number, number]) {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const span = Math.max(maxX - minX, maxZ - minZ);
    const p = this.point(s, d, _p);
    out[0] = (p.x - minX) / span + (1 - (maxX - minX) / span) / 2; out[1] = (p.z - minZ) / span + (1 - (maxZ - minZ) / span) / 2;
    return out;
  }

  /** nearest centre-line sample to a world XZ point (coarse grid search) — for scenery placement */
  nearest(x: number, z: number) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < this.n; i += 4) { const dx = this.px[i] - x, dz = this.pz[i] - z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; bi = i; } }
    for (let i = bi - 4; i <= bi + 4; i++) { const j = (i + this.n) % this.n; const dx = this.px[j] - x, dz = this.pz[j] - z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; bi = j; } }
    return { i: bi, s: bi * this.step, dist: Math.sqrt(bd), y: this.py[bi] };
  }
}

const _t = new THREE.Vector3();
const _p = new THREE.Vector3();
