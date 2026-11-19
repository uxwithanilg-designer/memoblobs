// The track: a ribbon built like a turtle walk, one metre at a time. Each segment turns (yaw), climbs (pitch), banks and
// twists; a loop is just 2π of pitch with a sideways step so the exit clears the entry. The result is a list of frames —
// position, forward, up (the surface normal, banked) and right — that the runner, the camera and the meshes all follow.
import type { Seg } from "./types";

export const STEP = 1;
const BANK_PER_TURN = 9; // radians of bank per (radian of yaw per metre)
const MAX_BANK = 0.42;

type V3 = [number, number, number];
const rot = (v: V3, k: V3, a: number): V3 => {
  // Rodrigues: rotate v round the unit axis k by a
  const c = Math.cos(a), s = Math.sin(a), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c);
  return [
    v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * d,
    v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * d,
    v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * d,
  ];
};
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export class Track {
  readonly n: number;
  readonly len: number;
  /** per sample (every STEP m): position, forward, surface up, surface right, heading up (no bank) */
  readonly pos: Float32Array; readonly fwd: Float32Array; readonly up: Float32Array; readonly right: Float32Array; readonly hup: Float32Array;
  readonly width: Float32Array;
  /** segment index of each sample */
  readonly seg: Int16Array;
  /** start distance of each segment */
  readonly segStart: number[];
  readonly segs: Seg[];

  /** `from`: start from this frame (position, forward, up) — the next stage carries on exactly where the last one left */
  constructor(segs: Seg[], start: V3 = [0, 24, 0], from?: { p: V3; f: V3; u: V3 }) {
    this.segs = segs;
    let total = 0; this.segStart = [];
    for (const g of segs) { this.segStart.push(total); total += g.len; }
    this.len = total;
    const n = Math.floor(total / STEP) + 2;
    this.n = n;
    this.pos = new Float32Array(n * 3); this.fwd = new Float32Array(n * 3); this.up = new Float32Array(n * 3);
    this.right = new Float32Array(n * 3); this.hup = new Float32Array(n * 3);
    this.width = new Float32Array(n); this.seg = new Int16Array(n);
    // heading frame (no bank)
    let p: V3 = [...start], f: V3 = [0, 0, -1], u: V3 = [0, 1, 0], r: V3 = [1, 0, 0];
    if (from) {
      // level the starting frame (keep the heading, drop any pitch and bank) so every stage starts on flat ground
      const fl = norm([from.f[0], 0, from.f[2]]);
      p = [...from.p]; f = fl; u = [0, 1, 0]; r = norm(cross(f, u));
    }
    const bankT = new Float32Array(n), twist = new Float32Array(n);
    let gi = 0, roll = 0;
    for (let i = 0; i < n; i++) {
      const s = i * STEP;
      while (gi < segs.length - 1 && s >= this.segStart[gi] + segs[gi].len) gi++;
      const g = segs[gi];
      this.seg[i] = gi;
      this.width[i] = g.width;
      this.pos.set(p, i * 3); this.fwd.set(f, i * 3); this.hup.set(u, i * 3);
      const yawRate = g.yaw / g.len, pitchRate = g.pitch / g.len;
      bankT[i] = g.tag === "loop" ? 0 : Math.max(-MAX_BANK, Math.min(MAX_BANK, -yawRate * BANK_PER_TURN));
      roll += ((g.twist ?? 0) / g.len) * STEP;
      twist[i] = roll;
      // step the turtle: yaw round the heading up, pitch round the heading right
      if (yawRate) { f = rot(f, u, yawRate * STEP); r = rot(r, u, yawRate * STEP); }
      if (pitchRate) { f = rot(f, r, pitchRate * STEP); u = rot(u, r, pitchRate * STEP); }
      f = norm(f); u = norm(cross(r, f)); r = norm(cross(f, u));
      const sh = ((g.shift ?? 0) / g.len) * STEP;
      p = [p[0] + f[0] * STEP + r[0] * sh, p[1] + f[1] * STEP + r[1] * sh, p[2] + f[2] * STEP + r[2] * sh];
    }
    // smooth the bank and widths so curves lean in and out gently
    const W = 12;
    const bank = new Float32Array(n), width = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let a = 0, b = 0, c = 0;
      for (let k = -W; k <= W; k++) { const j = Math.max(0, Math.min(n - 1, i + k)); a += bankT[j]; b += this.width[j]; c++; }
      bank[i] = a / c; width[i] = b / c;
    }
    this.width.set(width);
    for (let i = 0; i < n; i++) {
      const f0: V3 = [this.fwd[i * 3], this.fwd[i * 3 + 1], this.fwd[i * 3 + 2]];
      const u0: V3 = [this.hup[i * 3], this.hup[i * 3 + 1], this.hup[i * 3 + 2]];
      const a = bank[i] + twist[i];
      const r0 = norm(cross(f0, u0));
      // positive roll lowers the right side (leans into a right turn)
      const us: V3 = norm([u0[0] * Math.cos(a) + r0[0] * Math.sin(a), u0[1] * Math.cos(a) + r0[1] * Math.sin(a), u0[2] * Math.cos(a) + r0[2] * Math.sin(a)]);
      const rs = norm(cross(f0, us));
      this.up.set(us, i * 3); this.right.set(rs, i * 3);
    }
  }

  /** the segment at distance s */
  segAt(s: number): Seg { return this.segs[this.seg[Math.max(0, Math.min(this.n - 1, Math.floor(s / STEP)))]]; }
  widthAt(s: number) { const i = Math.max(0, Math.min(this.n - 2, Math.floor(s / STEP))), t = s / STEP - i; return this.width[i] * (1 - t) + this.width[i + 1] * t; }

  /** a frame at distance s (interpolated): writes position, forward, up, right into out (12 numbers) */
  frame(s: number, out: Float32Array | number[]) {
    const x = Math.max(0, Math.min(this.len, s)) / STEP;
    const i = Math.min(this.n - 2, Math.floor(x)), t = x - i;
    for (let k = 0; k < 3; k++) {
      out[k] = this.pos[i * 3 + k] * (1 - t) + this.pos[i * 3 + 3 + k] * t;
      out[3 + k] = this.fwd[i * 3 + k] * (1 - t) + this.fwd[i * 3 + 3 + k] * t;
      out[6 + k] = this.up[i * 3 + k] * (1 - t) + this.up[i * 3 + 3 + k] * t;
      out[9 + k] = this.right[i * 3 + k] * (1 - t) + this.right[i * 3 + 3 + k] * t;
    }
    // past the end, keep going straight
    if (s > this.len) { const e = s - this.len; for (let k = 0; k < 3; k++) out[k] += out[3 + k] * e; }
    if (s < 0) for (let k = 0; k < 3; k++) out[k] += out[3 + k] * s;
    return out;
  }
  /** world position of a track-space point */
  point(s: number, u: number, h: number, out: Float32Array | number[]) {
    const fr = this.frame(s, TMP);
    out[0] = fr[0] + fr[9] * u + fr[6] * h;
    out[1] = fr[1] + fr[10] * u + fr[7] * h;
    out[2] = fr[2] + fr[11] * u + fr[8] * h;
    return out;
  }
  /** slope at s: the forward vector's world-up component (−1 … 1) */
  slope(s: number) { const i = Math.max(0, Math.min(this.n - 1, Math.round(s / STEP))); return this.fwd[i * 3 + 1]; }
}
const TMP = new Float32Array(12);
