// Cup choreography for Momo Shuffle — generalised from the video's CupTrack to any
// number of cups laid out in a row (3/4/6) or a 3x2 grid (6 cups on portrait screens).
import * as THREE from "three";

export const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const E = {
  inOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u: number) => 1 - Math.pow(1 - u, 3),
  in: (u: number) => u * u * u,
  outBack: (u: number) => {
    const c1 = 2.2, c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  },
};
export const arc = (u: number) => Math.sin(Math.PI * clamp01(u));
export const landSquash = (t: number, tl: number, amt = 0.28) => {
  const u = (t - tl) / 0.22;
  return u < 0 || u > 1 ? 1 : 1 - amt * Math.sin(Math.PI * u) * (1 - u * 0.4);
};

export type Layout = "row" | "grid";
export interface Slot { x: number; z: number }
export type MoveType = "swap" | "cycle" | "tease";
export interface Move {
  type: MoveType;
  cups: number[]; // cups the claws hold (left, right)
  cup?: number; // tease target
  dir?: number;
  d: number;
  depth: number;
  before: number[];
  after: number[];
  t0: number;
  t1: number;
}
interface Lift { cup: number; up0: number; up1: number; dn0: number; dn1: number; h: number; rz: number }
export interface CupPose { x: number; y: number; z: number; rz: number; rx: number; squash: number }

export interface ShuffleParams {
  count: number;
  dur: number;
  gap: number;
  cycleP: number;
  teaseP: number;
  farBias: number;
  momoCup: number;
  momoBias: number;
}

export function makeSlots(n: number, layout: Layout): { slots: Slot[]; ring: number[]; sp: number; scale: number } {
  if (layout === "grid") {
    const sp = 2.55, dz = 1.5;
    const slots = [-sp, 0, sp].map((x) => ({ x, z: -dz })).concat([-sp, 0, sp].map((x) => ({ x, z: dz })));
    return { slots, ring: [0, 1, 2, 5, 4, 3], sp, scale: 0.92 };
  }
  const sp = n >= 6 ? 2.3 : 2.5;
  const scale = n >= 6 ? 0.88 : 1;
  const slots = Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * sp, z: 0 }));
  return { slots, ring: slots.map((_, i) => i), sp, scale };
}

export class CupTrack {
  slots: Slot[];
  ring: number[];
  sp: number;
  scale: number;
  layout: Layout;
  n: number;
  slotOf: number[];
  init: number[];
  moves: Move[] = [];
  lifts: Lift[] = [];
  private ix = 0;

  constructor(n: number, layout: Layout) {
    const { slots, ring, sp, scale } = makeSlots(n, layout);
    this.n = n; this.layout = layout; this.slots = slots; this.ring = ring; this.sp = sp; this.scale = scale;
    this.slotOf = slots.map((_, i) => i);
    this.init = this.slotOf.slice();
  }

  reset() {
    this.slotOf = this.slots.map((_, i) => i);
    this.init = this.slotOf.slice();
    this.moves = []; this.lifts = []; this.ix = 0;
  }

  cupAt(slot: number, at = this.slotOf) { return at.indexOf(slot); }

  addShuffle(R: () => number, p: ShuffleParams, t0: number) {
    const out: Move[] = [];
    let t = t0;
    const n = this.n;
    for (let k = 0; k < p.count; k++) {
      const r = R();
      const before = this.slotOf.slice();
      let m: Move;
      if (p.teaseP && r < p.teaseP && k > 0 && k < p.count - 1) {
        const cands = before.map((_, c) => c).filter((c) => c !== p.momoCup);
        const c = cands[Math.floor(R() * cands.length)];
        m = { type: "tease", cup: c, cups: [c], d: p.dur * 1.5, depth: 0, before, after: before.slice(), t0: 0, t1: 0 };
      } else if (p.cycleP && r < p.teaseP + p.cycleP) {
        const dir = R() < 0.5 ? 1 : -1;
        const after = before.map((s) => this.ring[(this.ring.indexOf(s) + dir + n) % n]);
        const xs = this.slots.map((s, i) => ({ i, x: s.x - s.z * 0.01 }));
        const left = xs.reduce((a, b) => (b.x < a.x ? b : a)).i, right = xs.reduce((a, b) => (b.x > a.x ? b : a)).i;
        m = { type: "cycle", dir, cups: [this.cupAt(left, before), this.cupAt(right, before)], d: p.dur * 1.3, depth: 0, before, after, t0: 0, t1: 0 };
        this.slotOf = after;
      } else {
        const momoSlot = before[p.momoCup];
        const pairs: [number, number][] = [];
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
        const dist = ([i, j]: [number, number]) => Math.hypot(this.slots[i].x - this.slots[j].x, this.slots[i].z - this.slots[j].z);
        let pool = pairs;
        if (R() < p.momoBias) pool = pairs.filter(([i, j]) => i === momoSlot || j === momoSlot);
        if (R() < p.farBias) {
          const far = Math.max(...pool.map(dist));
          pool = pool.filter((q) => dist(q) > far - 0.01);
        }
        const [a, b] = pool[Math.floor(R() * pool.length)];
        const ca = this.cupAt(a, before), cb = this.cupAt(b, before);
        const after = before.slice(); after[ca] = b; after[cb] = a;
        const span = dist([a, b]) / this.sp;
        m = {
          type: "swap", cups: [ca, cb], before, after, t0: 0, t1: 0,
          d: p.dur * (1 + 0.15 * Math.min(3, span - 1)),
          depth: Math.min(1.9, 1.1 + 0.25 * (span - 1)) * (this.layout === "grid" ? 0.75 : 1),
        };
        this.slotOf = after;
      }
      m.t0 = t; m.t1 = t + m.d; t = m.t1 + p.gap;
      out.push(m); this.moves.push(m);
    }
    return { moves: out, t1: out.length ? out[out.length - 1].t1 : t0 };
  }

  lift(cup: number, up0: number, up1: number, dn0: number, dn1: number, h = 2.5, rz = 0.1) {
    this.lifts.push({ cup, up0, up1, dn0, dn1, h, rz });
  }

  private moveIndex(t: number) {
    const M = this.moves;
    if (!M.length || t < M[0].t0) return -1;
    if (this.ix >= M.length || M[this.ix].t0 > t) this.ix = 0;
    while (this.ix + 1 < M.length && M[this.ix + 1].t0 <= t) this.ix++;
    return this.ix;
  }

  slotAt(c: number, t: number) {
    const i = this.moveIndex(t);
    if (i < 0) return this.init[c];
    const m = this.moves[i];
    return t >= m.t1 ? m.after[c] : m.before[c];
  }

  pose(c: number, t: number): CupPose {
    const S = this.slots;
    const i = this.moveIndex(t);
    let x: number, z: number, y = 0, rz = 0, rx = 0, squash = 1;
    if (i < 0 || t >= this.moves[i].t1) {
      const s = S[this.slotAt(c, t)]; x = s.x; z = s.z;
    } else {
      const m = this.moves[i];
      const u = seg(t, m.t0, m.t1), e = E.inOut(u);
      const sF = m.before[c], sT = m.after[c];
      const A = S[sF], B = S[sT];
      x = lerp(A.x, B.x, e); z = lerp(A.z, B.z, e);
      if (sF === sT) {
        if (m.type === "tease" && m.cup === c) { y = arc(u) * 0.95; rz = arc(u) * 0.1; }
      } else {
        const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1;
        if (m.type === "swap") {
          const px = -dz / L, pz = dx / L; // passes in front when moving right
          x += px * arc(e) * m.depth; z += pz * arc(e) * m.depth;
          y = arc(e) * 0.18; rz = -Math.sign(dx) * arc(e) * 0.07; rx = Math.sign(dz) * arc(e) * 0.06;
        } else {
          const wrap = this.layout === "row" && Math.abs(sT - sF) > 1;
          if (wrap) z -= arc(e) * 1.9;
          else if (this.layout === "grid") {
            const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, ml = Math.hypot(mx, mz) || 1;
            x += (mx / ml) * arc(e) * 0.5; z += (mz / ml) * arc(e) * 0.5;
          } else z += arc(e) * 0.6;
          y = arc(e) * 0.14;
        }
      }
    }
    for (const L of this.lifts) {
      if (L.cup !== c || t < L.up0 || t > L.dn1 + 0.25) continue;
      const up = E.out(seg(t, L.up0, L.up1)), dn = E.in(seg(t, L.dn0, L.dn1));
      const k = up * (1 - dn);
      y += L.h * k; rz += L.rz * k;
      if (t > L.dn1) squash = landSquash(t, L.dn1, 0.12);
    }
    return { x, y, z, rz, rx, squash };
  }

  knob(c: number, t: number) {
    const p = this.pose(c, t), h = 2.55 * this.scale;
    return new THREE.Vector3(p.x - Math.sin(p.rz) * h, p.y + Math.cos(p.rz) * h, p.z + 0.12);
  }

  /** claw world targets during a shuffle (null outside it) */
  claws(t: number, moves: Move[], rest: THREE.Vector3[]) {
    if (!moves.length || t < moves[0].t0 - 0.6 || t > moves[moves.length - 1].t1) return null;
    const S = this.slots;
    const pairFor = (m: Move): (number | null)[] => {
      if (m.type === "tease") { const s = m.before[m.cup!]; return S[s].x >= 0 ? [null, m.cup!] : [m.cup!, null]; }
      const [a, b] = m.cups;
      return S[m.before[a]].x <= S[m.before[b]].x ? [a, b] : [b, a];
    };
    const tgt = (c: number | null, tt: number, side: number) => (c == null ? rest[side].clone() : this.knob(c, tt));
    let i = moves.findIndex((m) => t < m.t1);
    if (i < 0) i = moves.length - 1;
    const m = moves[i];
    if (t >= m.t0) {
      const p = pairFor(m);
      return [{ p: tgt(p[0], t, 0), open: 0.15 }, { p: tgt(p[1], t, 1), open: 0.15 }];
    }
    const prev = moves[i - 1];
    const tA = prev ? prev.t1 : m.t0 - 0.6;
    const u = E.inOut(seg(t, tA, m.t0));
    const pn = pairFor(m), pp = prev ? pairFor(prev) : [null, null];
    return [0, 1].map((s) => {
      const a = prev ? tgt(pp[s], prev.t1, s) : rest[s].clone();
      const b = tgt(pn[s], m.t0, s);
      const p = a.lerp(b, u); p.y += arc(u) * 0.6;
      return { p, open: lerp(0.15, 0.7, arc(u)) };
    });
  }
}
