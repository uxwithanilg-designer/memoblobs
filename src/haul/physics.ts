// Tumble Truck physics, stepped at 240 Hz.
//  - The truck: a chassis on two sprung wheels (spring-damper struts, a rigid sideways constraint, travel stops), tyre
//    contacts with friction coupled to each wheel's spin so the motor drives through grip, the motor's reaction that
//    lifts the nose under power, air control from the pedals, and the body's outline sliding on the ground. Mud,
//    ice and water change grip and drag under each wheel.
//  - The load: every piece of cargo is a small rigid body (a box or a ball) that collides with the bed's floor, the
//    tailgate, the cab and the hood, with the other pieces and with the ground. Contacts are solved with accumulated
//    impulses (sequential impulses, a few iterations per step) together with the truck's own constraints, so a heavy
//    load leans on the springs and a bump launches the stack. A fragile piece breaks when something hits it faster
//    than it can take; a piece that touches the ground (it fell out) or flies far from the bed is lost.
// Units: metres, kilograms, seconds. y up; angles counter-clockwise; a wheel rolling forward spins < 0.
// No allocation in the step: bodies, outlines and the contact pool are built once per stage.
import type { CargoKind } from "./cargo";
import { CARGO } from "./cargo";
import type { Terrain } from "./terrain";
import type { TruckSpec } from "./trucks";

export const STEP = 1 / 240;
const ITER = 7;
const SLOP = 0.004, BETA = 0.25;
const MAXFIX = 5;
const fix = (v: number) => (v > MAXFIX ? MAXFIX : v < -MAXFIX ? -MAXFIX : v);
const SPIN_DAMP = 0.3;
/** cargo position correction is gentler (stacks stay calm) */
const CBETA = 0.2, CSLOP = 0.006, CFIX = 2.5;

export interface Pedals { gas: number; brake: number }

const hit = { d: 0, nx: 0, ny: 1, qx: 0, qy: 0 };

export const ABOARD = 0, LOST = 1, BROKEN = 2, GONE = 3;

export class Cargo {
  kind: CargoKind;
  ball: boolean;
  hw: number; hh: number; r: number; rad: number;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  m: number; invM: number; invI: number;
  mu: number; e: number; brk: number;
  scale: number; seed: number;
  state = ABOARD;
  /** seconds since it was lost (it fades away) */
  t = 0;
  /** the impact speed that broke it, and where (for the effect) */
  hitV = 0;
  /** in the water (lost cargo floats) */
  wet = false;
  /** world outline (boxes): 4 corners, and the 4 edge normals */
  v = new Float64Array(8); n = new Float64Array(8);
  constructor(kind: CargoKind, scale: number, seed: number) {
    const s = CARGO[kind];
    this.kind = kind; this.scale = scale; this.seed = seed;
    this.ball = s.shape === "ball";
    this.hw = (this.ball ? s.w : s.w / 2) * scale; this.hh = (this.ball ? s.w : s.h / 2) * scale;
    this.r = this.ball ? s.w * scale : 0;
    this.rad = this.ball ? this.r : Math.hypot(this.hw, this.hh);
    this.m = s.mass * scale * scale;
    this.invM = 1 / this.m;
    const I = this.ball ? 0.45 * this.m * this.r * this.r : (this.m * (4 * this.hw * this.hw + 4 * this.hh * this.hh)) / 12;
    this.invI = 1 / I;
    this.mu = s.mu; this.e = s.bounce; this.brk = s.breaks;
  }
  outline() {
    if (this.ball) return;
    const ca = Math.cos(this.a), sa = Math.sin(this.a), hw = this.hw, hh = this.hh, v = this.v, n = this.n;
    // corners counter-clockwise from bottom-left
    const xs0 = -hw, xs1 = hw, ys0 = -hh, ys1 = hh;
    v[0] = this.x + xs0 * ca - ys0 * sa; v[1] = this.y + xs0 * sa + ys0 * ca;
    v[2] = this.x + xs1 * ca - ys0 * sa; v[3] = this.y + xs1 * sa + ys0 * ca;
    v[4] = this.x + xs1 * ca - ys1 * sa; v[5] = this.y + xs1 * sa + ys1 * ca;
    v[6] = this.x + xs0 * ca - ys1 * sa; v[7] = this.y + xs0 * sa + ys1 * ca;
    // outward normals of edges 0→1 (bottom), 1→2 (right), 2→3 (top), 3→0 (left)
    n[0] = sa; n[1] = -ca; n[2] = ca; n[3] = sa; n[4] = -sa; n[5] = ca; n[6] = -ca; n[7] = -sa;
  }
}

/** a truck part the cargo collides with: a convex outline in chassis space, and its world copy */
class Part {
  lv: Float64Array; ln: Float64Array; v: Float64Array; n: Float64Array; nv: number; cx = 0; cy = 0; rad = 0; lcx: number; lcy: number;
  constructor(pts: [number, number][]) {
    this.nv = pts.length;
    this.lv = new Float64Array(pts.flat()); this.v = new Float64Array(this.nv * 2);
    this.ln = new Float64Array(this.nv * 2); this.n = new Float64Array(this.nv * 2);
    let sx = 0, sy = 0;
    for (const [x, y] of pts) { sx += x; sy += y; }
    this.lcx = sx / this.nv; this.lcy = sy / this.nv;
    for (let i = 0; i < this.nv; i++) {
      const j = (i + 1) % this.nv;
      const ex = pts[j][0] - pts[i][0], ey = pts[j][1] - pts[i][1], l = Math.hypot(ex, ey) || 1;
      this.ln[i * 2] = ey / l; this.ln[i * 2 + 1] = -ex / l;
      this.rad = Math.max(this.rad, Math.hypot(pts[i][0] - this.lcx, pts[i][1] - this.lcy));
    }
  }
  place(x: number, y: number, ca: number, sa: number) {
    for (let i = 0; i < this.nv; i++) {
      const lx = this.lv[i * 2], ly = this.lv[i * 2 + 1];
      this.v[i * 2] = x + lx * ca - ly * sa; this.v[i * 2 + 1] = y + lx * sa + ly * ca;
      const nx = this.ln[i * 2], ny = this.ln[i * 2 + 1];
      this.n[i * 2] = nx * ca - ny * sa; this.n[i * 2 + 1] = nx * sa + ny * ca;
    }
    this.cx = x + this.lcx * ca - this.lcy * sa; this.cy = y + this.lcx * sa + this.lcy * ca;
  }
}

/** the contact pool (structure of arrays): a = cargo index; b = cargo index, -1 the truck, -2 the ground */
const MAXC = 320;
class Contacts {
  n = 0;
  a = new Int16Array(MAXC); b = new Int16Array(MAXC);
  nx = new Float64Array(MAXC); ny = new Float64Array(MAXC);
  rax = new Float64Array(MAXC); ray = new Float64Array(MAXC); rbx = new Float64Array(MAXC); rby = new Float64Array(MAXC);
  pen = new Float64Array(MAXC); kn = new Float64Array(MAXC); kt = new Float64Array(MAXC);
  jn = new Float64Array(MAXC); jt = new Float64Array(MAXC); bounce = new Float64Array(MAXC); mu = new Float64Array(MAXC);
}

export class Truck {
  spec: TruckSpec;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  M: number; I: number;
  wx = new Float64Array(2); wy = new Float64Array(2);
  wvx = new Float64Array(2); wvy = new Float64Array(2);
  spin = new Float64Array(2); omega = new Float64Array(2);
  ext = new Float64Array(2);
  touch = new Uint8Array(2); since = new Float64Array(2);
  load = new Float64Array(2);
  landing = 0; scrape = 0; bodyHit = 0;
  /** the roof touched the ground: a crash */
  roofHit = false;
  slip = 0;
  airTime = 0;
  /** nitro: extra drive and a push along the body (seconds left) */
  nitro = 0;
  gravity = 10;
  gripMul = 1;
  /** wind acceleration on the load (m/s² for a 10 kg crate-sized piece; lighter pieces feel more) */
  wind = 0;
  /** a cargo net over the bed: nothing leaves it */
  net = false;
  /** fragile cargo breaks this much harder (padding upgrade, bubble wrap power) */
  toughness = 1;
  /** in mud / water this step (for effects) */
  mud = 0; water = 0;
  cargo: Cargo[] = [];
  /** pieces lost or broken since the game last looked */
  events = 0;
  private parts: Part[];
  private netPart: Part;
  private C = new Contacts();
  private accN = new Float64Array(2); private accT = new Float64Array(2);
  private wm: number; private wI: number;

  constructor(spec: TruckSpec) {
    this.spec = spec;
    const c = spec.chassis;
    this.M = c.mass;
    this.I = (c.mass * (c.w * c.w + c.h * c.h)) / 12 * c.inertia;
    this.wm = spec.wheel.mass;
    this.wI = 0.5 * spec.wheel.mass * spec.wheel.r * spec.wheel.r;
    const b = spec.bed, t = 0.1;
    this.parts = [
      // floor slab, tailgate, the cab (the bed's front wall) and the hood
      new Part([[b.x0 - t, b.y - 0.2], [b.x1 + 0.02, b.y - 0.2], [b.x1 + 0.02, b.y], [b.x0 - t, b.y]]),
      new Part([[b.x0 - t, b.y - 0.05], [b.x0, b.y - 0.05], [b.x0, b.y + b.wall], [b.x0 - t, b.y + b.wall]]),
      new Part([[b.x1, b.y - 0.1], [spec.cab.x1, b.y - 0.1], [spec.cab.x1 - 0.22, spec.cab.roof], [b.x1, spec.cab.roof]]),
      new Part([[spec.cab.x1 - 0.1, b.y - 0.1], [spec.hood.x1, b.y - 0.1], [spec.hood.x1, spec.hood.top - 0.1], [spec.hood.x1 - 0.12, spec.hood.top], [spec.cab.x1 - 0.1, spec.hood.top]]),
    ];
    // the cargo net: a lid over the bed at the cab's roof height
    this.netPart = new Part([[b.x0 - t, spec.cab.roof], [b.x1, spec.cab.roof], [b.x1, spec.cab.roof + 0.2], [b.x0 - t, spec.cab.roof + 0.2]]);
  }

  /** put the truck at rest on the ground at x, with its load stacked in the bed */
  place(t: Terrain, x: number) {
    const s = this.spec;
    const slope = Math.atan2(t.heightAt(x + 1.5) - t.heightAt(x - 1.5), 3);
    this.a = slope; this.vx = this.vy = this.w = 0;
    const ca = Math.cos(slope), sa = Math.sin(slope);
    let lift = 0;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const px = ax * ca - ay * sa, py = ax * sa + ay * ca;
      const wxl = px + sa * s.wheel.rest, wyl = py - ca * s.wheel.rest;
      lift = Math.max(lift, t.heightAt(x + wxl) + s.wheel.r + 0.02 - wyl);
    }
    this.x = x; this.y = lift;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const px = this.x + ax * ca - ay * sa, py = this.y + ax * sa + ay * ca;
      this.wx[i] = px + sa * s.wheel.rest; this.wy[i] = py - ca * s.wheel.rest;
      this.wvx[i] = this.wvy[i] = this.omega[i] = 0;
      this.ext[i] = s.wheel.rest;
      this.since[i] = 0; this.touch[i] = 1;
    }
    this.airTime = 0; this.roofHit = false; this.landing = 0; this.bodyHit = 0; this.nitro = 0;
  }

  /** load cargo: slots in bed-local metres (x from the tailgate's inner face, y up from the floor) */
  loadCargo(slots: { kind: CargoKind; x: number; y: number; scale: number; seed: number }[]) {
    const b = this.spec.bed, ca = Math.cos(this.a), sa = Math.sin(this.a);
    this.cargo = slots.map((sl) => {
      const c = new Cargo(sl.kind, sl.scale, sl.seed);
      const lx = b.x0 + sl.x, ly = b.y + sl.y;
      c.x = this.x + lx * ca - ly * sa; c.y = this.y + lx * sa + ly * ca; c.a = this.a;
      return c;
    });
    this.events = 0;
  }
  /** pieces still on the truck */
  get aboard() { let n = 0; for (const c of this.cargo) if (c.state === ABOARD) n++; return n; }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get forward() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }
  get grounded() { return this.since[0] < 0.08 || this.since[1] < 0.08; }
  /** a chassis-local point in world space */
  toWorld(lx: number, ly: number, out: { x: number; y: number }) {
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    out.x = this.x + lx * ca - ly * sa; out.y = this.y + lx * sa + ly * ca;
    return out;
  }

  step(t: Terrain, p: Pedals) {
    const s = this.spec, h = STEP, g = this.gravity;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const ux = sa, uy = -ca;
    const nx = ca, ny = sa;
    const M = this.M, I = this.I, m = this.wm, wI = this.wI;
    const k = s.wheel.k, c = s.wheel.c, rest = s.wheel.rest, r = s.wheel.r;

    // ---- forces: gravity, springs, motor
    this.vy -= g * h;
    for (let i = 0; i < 2; i++) this.wvy[i] -= g * h;
    const air = !this.grounded;
    const boost = this.nitro > 0;
    const top = s.maxSpin * (boost ? 1.3 : 1);
    this.mud = 0; this.water = 0;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca;
      const px = this.x + rx, py = this.y + ry;
      const dx = this.wx[i] - px, dy = this.wy[i] - py;
      const e = dx * ux + dy * uy;
      this.ext[i] = e;
      const pvx = this.vx - this.w * ry, pvy = this.vy + this.w * rx;
      const edot = (this.wvx[i] - pvx) * ux + (this.wvy[i] - pvy) * uy;
      const F = k * (rest - e) - c * edot;
      const J = F * h;
      this.wvx[i] += (J * ux) / m; this.wvy[i] += (J * uy) / m;
      this.vx -= (J * ux) / M; this.vy -= (J * uy) / M;
      this.w -= (rx * (J * uy) - ry * (J * ux)) / I;

      const driven = s.drive === "all" || i === 0;
      let T = 0;
      if (p.gas > 0 && driven) {
        const share = s.drive === "all" ? 0.5 : 1;
        const curve = Math.min(1, Math.max(0, (top + this.omega[i]) / (top * 0.35)));
        // in low gravity the load has little grip, so the motor pulls gentler too (or every start would spill it)
        // a soft launch on level ground: pulling away eases in over the first few km/h, so a touch of the pedal
        // doesn't jerk the load out (on a climb the full pull is there from a standstill)
        const launch = Math.abs(this.a) < 0.15 ? Math.min(1, 0.55 + (Math.abs(this.omega[i]) * r) / 6) : 1;
        T = -s.torque * share * p.gas * curve * launch * (boost ? 1.5 : 1) * (g < 10 ? Math.sqrt(g / 10) : 1);
      }
      let Tb = 0;
      if (p.brake > 0) {
        const om = this.omega[i];
        if (om < -0.6) Tb = s.brake * 0.5 * p.brake;
        else if (driven && om < s.maxSpin * 0.4) T += s.torque * 0.4 * p.brake * (s.drive === "all" ? 0.5 : 1);
      }
      this.omega[i] += ((T + Tb) / wI) * h;
      this.w -= ((T * s.wheelie + Tb * 0.5) / I) * h;
      // rolling resistance; mud sucks at the tyres
      const zone = t.zoneAt(this.wx[i]);
      const mud = zone === 1 && this.wy[i] - r < t.heightAt(this.wx[i]) + 0.25;
      if (mud) this.mud = 1;
      this.omega[i] *= 1 - (mud ? 1.6 : 0.15) * h;
      if (mud) { this.wvx[i] *= 1 - 0.9 * h; }
    }
    // water: the truck wades (drag grows with depth)
    const lvl = t.waterAt(this.x);
    if (lvl > -1e8) {
      const depth = lvl - (this.y - 0.9);
      if (depth > 0) {
        this.water = Math.min(1, depth / 1.2);
        const d = 1 - (0.55 + 1.6 * this.water) * h;
        this.vx *= d; this.vy *= d;
        for (let i = 0; i < 2; i++) { this.wvx[i] *= d; }
      }
    }
    if (air) this.w += s.airControl * (p.gas - p.brake) * h;
    if (boost) { const f = 7 * h; this.vx += ca * f; this.vy += sa * f; }
    // wind leans on the truck a little
    this.vx += this.wind * 0.04 * h;
    const drag = 1 - 0.05 * h;
    this.vx *= drag; this.vy *= drag; this.w *= 1 - SPIN_DAMP * h;

    // ---- the load: gravity, wind, water; then its contacts
    const cg = this.cargo;
    for (let i = 0; i < cg.length; i++) {
      const q = cg[i];
      if (q.state === BROKEN || q.state === GONE) continue;
      q.vy -= g * h;
      if (this.wind !== 0 && q.state === ABOARD) {
        // lighter, bigger pieces catch more wind, and driving into it makes it stronger: in a gust, slow down
        const area = (q.hw * q.hh * 4) / 0.22;
        q.vx += this.wind * 1.6 * Math.sqrt(area * q.invM) * (0.6 + Math.max(0, this.forward) / 10) * h;
      }
      const wl = t.waterAt(q.x);
      q.wet = false;
      if (wl > -1e8 && q.y - q.hh < wl) {
        q.wet = true;
        // floats: buoyancy up to its size, heavy damping
        const sub = Math.min(1, (wl - (q.y - q.hh)) / (2 * q.hh));
        q.vy += g * 1.35 * sub * h;
        const d = 1 - 3 * h;
        q.vx *= d; q.vy *= d; q.w *= d;
        if (q.state === ABOARD) this.lose(q);
      }
      // rolling resistance: melons, eggs and orbs aren't perfect balls
      if (q.ball) q.w *= 1 - 2.6 * h;
      q.outline();
    }
    this.placeParts(ca, sa);
    this.collide(t);

    // ---- constraints
    this.accN.fill(0); this.accT.fill(0);
    let anyTouch0 = false, anyTouch1 = false;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < 2; i++) {
        const [ax, ay] = s.anchors[i];
        const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca;
        const px = this.x + rx, py = this.y + ry;
        {
          const dx = this.wx[i] - px, dy = this.wy[i] - py;
          const lat = dx * nx + dy * ny;
          const pvx = this.vx - this.w * ry, pvy = this.vy + this.w * rx;
          const vrel = (this.wvx[i] - pvx) * nx + (this.wvy[i] - pvy) * ny;
          const rn = rx * ny - ry * nx;
          const em = 1 / m + 1 / M + (rn * rn) / I;
          const lam = -(vrel + fix((BETA * lat) / h)) / em;
          this.wvx[i] += (lam * nx) / m; this.wvy[i] += (lam * ny) / m;
          this.vx -= (lam * nx) / M; this.vy -= (lam * ny) / M;
          this.w -= (rn * lam) / I;
        }
        {
          const dx = this.wx[i] - px, dy = this.wy[i] - py;
          const e = dx * ux + dy * uy;
          const lo = rest - s.wheel.travel, hi = rest + s.wheel.travel * 0.55;
          if (e < lo || e > hi) {
            const pvx = this.vx - this.w * ry, pvy = this.vy + this.w * rx;
            const vrel = (this.wvx[i] - pvx) * ux + (this.wvy[i] - pvy) * uy;
            const ru = rx * uy - ry * ux;
            const em = 1 / m + 1 / M + (ru * ru) / I;
            const target = fix(e < lo ? Math.max(0, ((lo - e) * BETA) / h) : Math.min(0, ((hi - e) * BETA) / h));
            let lam = (target - vrel) / em;
            if (e < lo) lam = Math.max(0, lam); else lam = Math.min(0, lam);
            this.wvx[i] += (lam * ux) / m; this.wvy[i] += (lam * uy) / m;
            this.vx -= (lam * ux) / M; this.vy -= (lam * uy) / M;
            this.w -= (ru * lam) / I;
            if (e < lo && it === 0 && -vrel > 3) this.bodyHit = Math.max(this.bodyHit, -vrel * 0.5);
          }
        }
        if (t.closest(this.wx[i], this.wy[i], r, hit) && hit.d < r) {
          if (i === 0) anyTouch0 = true; else anyTouch1 = true;
          const Nx = hit.nx, Ny = hit.ny;
          const rcx = -Nx * r, rcy = -Ny * r;
          const om = this.omega[i];
          const vcx = this.wvx[i] - om * rcy, vcy = this.wvy[i] + om * rcx;
          const vn = vcx * Nx + vcy * Ny;
          if (it === 0 && this.since[i] > 0.12 && -vn > 2) this.landing = Math.max(this.landing, -vn);
          const pen = r - hit.d;
          const bias = fix(Math.max(0, pen - SLOP) * BETA / h);
          let ln = -(vn - bias) * m;
          const old = this.accN[i];
          this.accN[i] = Math.max(0, old + ln);
          ln = this.accN[i] - old;
          this.wvx[i] += (ln * Nx) / m; this.wvy[i] += (ln * Ny) / m;
          const Tx = Ny, Ty = -Nx;
          const om2 = this.omega[i];
          const vtx = this.wvx[i] - om2 * rcy, vty = this.wvy[i] + om2 * rcx;
          const vt = vtx * Tx + vty * Ty;
          const emT = 1 / m + (r * r) / wI;
          let lt = -vt / emT;
          const maxF = s.grip * this.gripMul * t.gripAt(this.wx[i]) * this.accN[i];
          const oldT = this.accT[i];
          this.accT[i] = Math.max(-maxF, Math.min(maxF, oldT + lt));
          lt = this.accT[i] - oldT;
          this.wvx[i] += (lt * Tx) / m; this.wvy[i] += (lt * Ty) / m;
          this.omega[i] += (rcx * (lt * Ty) - rcy * (lt * Tx)) / wI;
        }
      }
      this.hull(t, ca, sa, it === 0);
      const rf = s.roof;
      const hx = this.x + rf.x * ca - rf.y * sa, hy = this.y + rf.x * sa + rf.y * ca;
      if (t.closest(hx, hy, rf.r, hit) && hit.d < rf.r) this.roofHit = true;
      this.solveCargo();
    }

    // ---- move
    this.x += this.vx * h; this.y += this.vy * h; this.a += this.w * h;
    let slipSum = 0;
    for (let i = 0; i < 2; i++) {
      this.wx[i] += this.wvx[i] * h; this.wy[i] += this.wvy[i] * h;
      this.spin[i] += this.omega[i] * h;
      const on = i === 0 ? anyTouch0 : anyTouch1;
      this.touch[i] = on ? 1 : 0;
      this.since[i] = on ? 0 : this.since[i] + h;
      this.load[i] = this.accN[i];
      if (on) {
        const roll = -this.omega[i] * r, along = this.wvx[i] * Math.cos(this.a) + this.wvy[i] * Math.sin(this.a);
        slipSum += Math.min(1, Math.abs(roll - along) / 6);
      }
    }
    this.slip += (slipSum * 0.5 - this.slip) * 0.08;
    this.airTime = this.grounded ? 0 : this.airTime + h;
    if (this.nitro > 0) this.nitro = Math.max(0, this.nitro - h);
    // the load moves; lost pieces drift off; anything far from the bed is lost
    const b = s.bed, bcx = (b.x0 + b.x1) / 2, bcy = b.y + 0.6;
    const cxw = this.x + bcx * Math.cos(this.a) - bcy * Math.sin(this.a), cyw = this.y + bcx * Math.sin(this.a) + bcy * Math.cos(this.a);
    for (let i = 0; i < cg.length; i++) {
      const q = cg[i];
      if (q.state === BROKEN || q.state === GONE) continue;
      q.x += q.vx * h; q.y += q.vy * h; q.a += q.w * h;
      if (q.state === LOST) { q.t += h; if (q.t > 3.2) q.state = GONE; continue; }
      const dx = q.x - cxw, dy = q.y - cyw;
      if (dx * dx + dy * dy > 4.6 * 4.6) this.lose(q);
    }
  }

  private lose(q: Cargo) {
    if (q.state !== ABOARD) return;
    q.state = LOST; q.t = 0; this.events++;
  }
  private smash(q: Cargo, v: number) {
    if (q.state !== ABOARD) return;
    q.state = BROKEN; q.hitV = v; this.events++;
  }

  private placeParts(ca: number, sa: number) {
    for (const p of this.parts) p.place(this.x, this.y, ca, sa);
    this.netPart.place(this.x, this.y, ca, sa);
  }

  // ---------------------------------------------------------------- cargo contacts
  /** find every contact of the load for this step */
  private collide(t: Terrain) {
    const C = this.C, cg = this.cargo;
    C.n = 0;
    for (let i = 0; i < cg.length; i++) {
      const q = cg[i];
      if (q.state === BROKEN || q.state === GONE) continue;
      if (q.state === ABOARD) {
        for (const p of this.parts) this.vsPart(i, q, p);
        if (this.net) this.vsPart(i, q, this.netPart);
        for (let j = i + 1; j < cg.length; j++) {
          const o = cg[j];
          if (o.state !== ABOARD) continue;
          const dx = o.x - q.x, dy = o.y - q.y, rr = o.rad + q.rad + 0.02;
          if (dx * dx + dy * dy > rr * rr) continue;
          this.vsCargo(i, q, j, o);
        }
      }
      this.vsGround(i, q, t);
    }
  }

  private add(a: number, b: number, px: number, py: number, nx: number, ny: number, pen: number) {
    const C = this.C;
    if (C.n >= MAXC) return;
    const k = C.n++;
    const A = this.cargo[a];
    C.a[k] = a; C.b[k] = b; C.nx[k] = nx; C.ny[k] = ny; C.pen[k] = pen;
    const rax = px - A.x, ray = py - A.y;
    C.rax[k] = rax; C.ray[k] = ray;
    let ibm = 0, ibi = 0, rbx = 0, rby = 0, vbx = 0, vby = 0, mu = A.mu, e = A.e;
    if (b >= 0) {
      const B = this.cargo[b];
      rbx = px - B.x; rby = py - B.y; ibm = B.invM; ibi = B.invI;
      vbx = B.vx - B.w * rby; vby = B.vy + B.w * rbx;
      mu = Math.sqrt(A.mu * B.mu); e = Math.max(A.e, B.e);
    } else if (b === -1) {
      rbx = px - this.x; rby = py - this.y; ibm = 1 / this.M; ibi = 1 / this.I;
      vbx = this.vx - this.w * rby; vby = this.vy + this.w * rbx;
      mu = Math.sqrt(A.mu * 0.75);
    } else mu = Math.sqrt(A.mu * 0.85);
    C.rbx[k] = rbx; C.rby[k] = rby;
    const ran = rax * ny - ray * nx, rbn = rbx * ny - rby * nx;
    C.kn[k] = A.invM + ibm + A.invI * ran * ran + ibi * rbn * rbn;
    const tx = -ny, ty = nx;
    const rat = rax * ty - ray * tx, rbt = rbx * ty - rby * tx;
    C.kt[k] = A.invM + ibm + A.invI * rat * rat + ibi * rbt * rbt;
    C.jn[k] = 0; C.jt[k] = 0; C.mu[k] = mu;
    // the approach speed: bounces, breaks, and a fall onto the ground loses the piece
    const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax;
    const vn = (vax - vbx) * nx + (vay - vby) * ny;
    C.bounce[k] = vn < -1.2 ? -vn * e : 0;
    if (b === -2) {
      if (A.state === ABOARD && !this.net) {
        if (A.brk > 0 && -vn > A.brk * 0.8 * this.toughness) this.smash(A, -vn);
        else this.lose(A);
      }
    } else if (-vn > 0.5) {
      const lim = this.toughness;
      if (A.brk > 0 && -vn > A.brk * lim) this.smash(A, -vn);
      if (b >= 0) { const B = this.cargo[b]; if (B.brk > 0 && -vn > B.brk * lim) this.smash(B, -vn); }
    }
  }

  /** a piece against a truck part */
  private vsPart(i: number, q: Cargo, p: Part) {
    const dx = q.x - p.cx, dy = q.y - p.cy, rr = q.rad + p.rad + 0.05;
    if (dx * dx + dy * dy > rr * rr) return;
    if (q.ball) this.ballPoly(i, q, -1, p.v, p.n, p.nv, false);
    else this.polyPoly(i, q, -1, p.v, p.n, p.nv);
  }
  private vsCargo(i: number, q: Cargo, j: number, o: Cargo) {
    if (q.ball && o.ball) {
      const dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy), rr = q.r + o.r;
      if (d >= rr || d < 1e-6) return;
      const nx = dx / d, ny = dy / d;
      this.add(i, j, o.x + nx * o.r, o.y + ny * o.r, nx, ny, rr - d);
    } else if (q.ball) this.ballPoly(i, q, j, o.v, o.n, 4, false);
    else if (o.ball) this.ballPoly(j, o, i, q.v, q.n, 4, false);
    else this.polyPoly(i, q, j, o.v, o.n, 4);
  }

  /** a box against a convex outline: corners of each inside the other */
  /**
   * A box against a convex outline (another box or a truck part), by separating axes: the axis of least overlap is
   * the contact normal (pointing from the other shape to q), and the contacts are the corners of each shape that sit
   * inside the other along it, within the other's width. (Choosing a face per corner went wrong when corners lined up
   * exactly — a crate stacked squarely on another sank into it and the two looked like one.)
   */
  private polyPoly(i: number, q: Cargo, b: number, v: Float64Array, n: Float64Array, nv: number) {
    const qv = q.v, qn = q.n;
    let best = Infinity, mx = 0, my = 0;
    // q's two face directions, then the other's faces
    for (let k = 0; k < 2 + nv; k++) {
      const ax = k < 2 ? qn[k * 2] : n[(k - 2) * 2], ay = k < 2 ? qn[k * 2 + 1] : n[(k - 2) * 2 + 1];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (let c = 0; c < 4; c++) { const d = qv[c * 2] * ax + qv[c * 2 + 1] * ay; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (let c = 0; c < nv; c++) { const d = v[c * 2] * ax + v[c * 2 + 1] * ay; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      const ov = (maxA < maxB ? maxA : maxB) - (minA > minB ? minA : minB);
      if (ov <= 0) return;
      if (ov < best - 1e-6) { best = ov; mx = ax; my = ay; }
    }
    // point the normal from the other shape towards q
    let cbx = 0, cby = 0;
    for (let c = 0; c < nv; c++) { cbx += v[c * 2]; cby += v[c * 2 + 1]; }
    cbx /= nv; cby /= nv;
    if ((q.x - cbx) * mx + (q.y - cby) * my < 0) { mx = -mx; my = -my; }
    const tx = -my, ty = mx;
    let topB = -Infinity, lowA = Infinity, tA0 = Infinity, tA1 = -Infinity, tB0 = Infinity, tB1 = -Infinity;
    for (let c = 0; c < nv; c++) { const d = v[c * 2] * mx + v[c * 2 + 1] * my, t = v[c * 2] * tx + v[c * 2 + 1] * ty; if (d > topB) topB = d; if (t < tB0) tB0 = t; if (t > tB1) tB1 = t; }
    for (let c = 0; c < 4; c++) { const d = qv[c * 2] * mx + qv[c * 2 + 1] * my, t = qv[c * 2] * tx + qv[c * 2 + 1] * ty; if (d < lowA) lowA = d; if (t < tA0) tA0 = t; if (t > tA1) tA1 = t; }
    const m = 0.004;
    // q's corners pressed into the other
    for (let c = 0; c < 4; c++) {
      const px = qv[c * 2], py = qv[c * 2 + 1], d = topB - (px * mx + py * my), t = px * tx + py * ty;
      if (d > 0 && t >= tB0 - m && t <= tB1 + m) this.add(i, b, px, py, mx, my, d < best ? d : best);
    }
    // the other's corners pressed into q
    for (let c = 0; c < nv; c++) {
      const px = v[c * 2], py = v[c * 2 + 1], d = (px * mx + py * my) - lowA, t = px * tx + py * ty;
      if (d > 0 && t >= tA0 - m && t <= tA1 + m) this.add(i, b, px, py, mx, my, d < best ? d : best);
    }
  }

  /** a ball (cargo i) against a convex outline (cargo b, or the truck) */
  private ballPoly(i: number, q: Cargo, b: number, v: Float64Array, n: Float64Array, nv: number, flip: boolean) {
    void flip;
    const cx = q.x, cy = q.y, r = q.r;
    let inside = true, best = -Infinity, bi = 0;
    for (let e = 0; e < nv; e++) {
      const d = (cx - v[e * 2]) * n[e * 2] + (cy - v[e * 2 + 1]) * n[e * 2 + 1];
      if (d > best) { best = d; bi = e; }
      if (d > 0) inside = false;
    }
    if (inside) {
      // the centre is inside: out through the nearest face
      this.add(i, b, cx - n[bi * 2] * r, cy - n[bi * 2 + 1] * r, n[bi * 2], n[bi * 2 + 1], r - best);
      return;
    }
    if (best > r) return;
    // the closest point on the outline
    let bd = Infinity, qx = 0, qy = 0;
    for (let e = 0; e < nv; e++) {
      const ax = v[e * 2], ay = v[e * 2 + 1], f = (e + 1) % nv, ex = v[f * 2] - ax, ey = v[f * 2 + 1] - ay;
      let u = ((cx - ax) * ex + (cy - ay) * ey) / (ex * ex + ey * ey);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const x = ax + ex * u, y = ay + ey * u, d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bd) { bd = d; qx = x; qy = y; }
    }
    const d = Math.sqrt(bd);
    if (d >= r || d < 1e-6) return;
    const nx = (cx - qx) / d, ny = (cy - qy) / d;
    if (b >= 0) {
      // ball i against box b: the contact belongs to the ball (a = i)
      this.add(i, b, qx, qy, nx, ny, r - d);
    } else this.add(i, b, qx, qy, nx, ny, r - d);
  }

  private vsGround(i: number, q: Cargo, t: Terrain) {
    if (q.ball) {
      if (t.closest(q.x, q.y, q.r, hit) && hit.d < q.r) this.add(i, -2, q.x - hit.nx * Math.max(0, hit.d), q.y - hit.ny * Math.max(0, hit.d), hit.nx, hit.ny, q.r - hit.d);
      return;
    }
    if (q.y - q.rad > t.heightAt(q.x) + 0.5 && q.y - q.rad > t.heightAt(q.x - q.rad) + 0.5 && q.y - q.rad > t.heightAt(q.x + q.rad) + 0.5) return;
    for (let c = 0; c < 4; c++) {
      const px = q.v[c * 2], py = q.v[c * 2 + 1];
      const gy = t.heightAt(px);
      if (py >= gy) continue;
      const sl = t.slopeAt(px), inv = 1 / Math.sqrt(1 + sl * sl);
      this.add(i, -2, px, py, -sl * inv, inv, (gy - py) * inv);
    }
  }

  /** one pass of impulses over the load's contacts */
  private solveCargo() {
    const C = this.C, cg = this.cargo;
    const h = STEP, iM = 1 / this.M, iI = 1 / this.I;
    for (let k = 0; k < C.n; k++) {
      const A = cg[C.a[k]], b = C.b[k];
      if (A.state === BROKEN || A.state === GONE) continue;
      // a lost piece only meets the ground
      if (A.state === LOST && b !== -2) continue;
      const B = b >= 0 ? cg[b] : null;
      if (B && (B.state === BROKEN || B.state === GONE)) continue;
      const nx = C.nx[k], ny = C.ny[k], rax = C.rax[k], ray = C.ray[k], rbx = C.rbx[k], rby = C.rby[k];
      let vbx = 0, vby = 0;
      if (B) { vbx = B.vx - B.w * rby; vby = B.vy + B.w * rbx; }
      else if (b === -1) { vbx = this.vx - this.w * rby; vby = this.vy + this.w * rbx; }
      const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax;
      const rvx = vax - vbx, rvy = vay - vby;
      const vn = rvx * nx + rvy * ny;
      const target = Math.max(C.bounce[k], Math.min(CFIX, Math.max(0, C.pen[k] - CSLOP) * CBETA / h));
      let jn = (target - vn) / C.kn[k];
      const old = C.jn[k];
      C.jn[k] = Math.max(0, old + jn);
      jn = C.jn[k] - old;
      let ix = jn * nx, iy = jn * ny;
      // friction
      const tx = -ny, ty = nx;
      const vt = rvx * tx + rvy * ty;
      let jt = -vt / C.kt[k];
      const maxF = C.mu[k] * C.jn[k], oldT = C.jt[k];
      C.jt[k] = Math.max(-maxF, Math.min(maxF, oldT + jt));
      jt = C.jt[k] - oldT;
      ix += jt * tx; iy += jt * ty;
      A.vx += ix * A.invM; A.vy += iy * A.invM; A.w += (rax * iy - ray * ix) * A.invI;
      if (B) { B.vx -= ix * B.invM; B.vy -= iy * B.invM; B.w -= (rbx * iy - rby * ix) * B.invI; }
      else if (b === -1) { this.vx -= ix * iM; this.vy -= iy * iM; this.w -= (rbx * iy - rby * ix) * iI; }
    }
  }

  // ---------------------------------------------------------------- the body on the ground
  private hull(t: Terrain, ca: number, sa: number, first: boolean) {
    for (const [lx, ly] of this.spec.hull) {
      const px = this.x + lx * ca - ly * sa, py = this.y + lx * sa + ly * ca;
      const gy = t.heightAt(px);
      if (py >= gy) continue;
      const sl = t.slopeAt(px);
      const inv = 1 / Math.sqrt(1 + sl * sl);
      const Nx = -sl * inv, Ny = inv;
      const pen = (gy - py) * inv;
      if (first) {
        const rx = px - this.x, ry = py - this.y;
        const vn = (this.vx - this.w * ry) * Nx + (this.vy + this.w * rx) * Ny;
        if (-vn > 1.5) this.bodyHit = Math.max(this.bodyHit, -vn);
      }
      this.push(px, py, Nx, Ny, pen, 0.45, 0.12);
    }
  }
  private push(px: number, py: number, Nx: number, Ny: number, pen: number, mu: number, bounce: number) {
    const rx = px - this.x, ry = py - this.y;
    const vx = this.vx - this.w * ry, vy = this.vy + this.w * rx;
    const vn = vx * Nx + vy * Ny;
    const rn = rx * Ny - ry * Nx;
    const em = 1 / this.M + (rn * rn) / this.I;
    const target = fix(Math.max(0, pen - SLOP) * BETA / STEP) + (vn < -2 ? -vn * bounce : 0);
    if (vn >= target) return;
    const ln = (target - vn) / em;
    this.vx += (ln * Nx) / this.M; this.vy += (ln * Ny) / this.M; this.w += (rn * ln) / this.I;
    const Tx = Ny, Ty = -Nx;
    const vt = (this.vx - this.w * ry) * Tx + (this.vy + this.w * rx) * Ty;
    const rt = rx * Ty - ry * Tx;
    const emT = 1 / this.M + (rt * rt) / this.I;
    const lt = Math.max(-mu * ln, Math.min(mu * ln, -vt / emT));
    this.vx += (lt * Tx) / this.M; this.vy += (lt * Ty) / this.M; this.w += (rt * lt) / this.I;
    this.scrape = Math.max(this.scrape, Math.abs(vt) * 0.2);
  }
}
