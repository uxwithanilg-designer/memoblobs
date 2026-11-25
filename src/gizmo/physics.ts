// Gizmo Drive physics: a car on two sprung wheels driving through a world of line segments, stepped at 240 Hz.
//  - the world: polygons and lines (two-sided, or one-sided for loops), owned by bodies:
//      static (the ground, blocks, crates that break when you hit them hard enough),
//      kinematic (lifts, sliders, pistons, gates, swinging wrecking balls, spinning gears: they move on a clock or a
//        trigger and push the car with infinite strength; collapsing planks fall after you touch them),
//      pivot (seesaws and tilting bridges: they turn about a pin under gravity and the car's weight),
//      ball (boulders, barrels and gumballs that roll, bump each other and get pushed around);
//  - contacts are circle against segment (or circle against circle) with sequential impulses: they use the surface's
//    own velocity (moving platforms carry the car, belts drag it) and push back on seesaws and balls;
//  - the car: chassis + two wheels on spring struts, motor torque through tyre friction, the motor's reaction lifts the
//    nose (wheelies), the pedals spin the car in the air, and the driver's head touching anything is a crash.
// Units: metres, kilograms, seconds, y up. No allocation in the step (typed arrays and plain numbers).
import type { VehicleSpec } from "./vehicles";

export const STEP = 1 / 240;
const ITER = 8;
const SLOP = 0.004, BETA = 0.25, MAXFIX = 4;
const fix = (v: number) => (v > MAXFIX ? MAXFIX : v < -MAXFIX ? -MAXFIX : v);
const SPIN_DAMP = 0.5;
const CELL = 2;
const MAXC = 160;

export const STATIC = 0, KINEMATIC = 1, PIVOT = 2, BALL = 3;
/** segment flags: one-sided (front = left of a→b), launch pad, ice, breaks when hit hard, part of a loop's gate */
export const F_ONE = 1, F_SPRING = 2, F_ICE = 4, F_BREAK = 8;

/**
 * How a kinematic body moves (plain data, so the QA bot can read the same clock):
 *  osc   back and forth between its base pose and base + (dx, dy, da), resting `hold` of the cycle at each end;
 *  pend  swings about its base: angle = a0 + da·sin(2π(t/period + phase));
 *  spin  turns at da rad/s;
 *  trig  moves to base + (dx, dy, da) over `period` s once triggered (a button), and stays;
 *  fall  `period` s after the car first touches it, it drops with gravity (and is gone).
 */
export interface Motion { k: "osc" | "pend" | "spin" | "trig" | "fall"; dx: number; dy: number; da: number; period: number; phase: number; hold: number; hold2?: number }

export interface Pedals { gas: number; brake: number }

export class Body {
  id = 0; kind = STATIC; tag = "";
  x0 = 0; y0 = 0; a0 = 0;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  m = 0; invM = 0; I = 0; invI = 0;
  /** pivots: centre of mass from the pin (body-local) */
  comx = 0; comy = 0;
  lo = -Infinity; hi = Infinity; damp = 0; spring = 0; rest = 0;
  motion: Motion | null = null;
  segs: number[] = [];
  /** circles (body-local): lx, ly, r, … */
  circ: number[] = [];
  /** balls: radius */
  r = 0;
  bound = 0;
  on = true;
  /** world time it was triggered (−1: not yet) */
  trig = -1;
  /** the car touched it this step / launch pads: time of the last launch */
  touched = 0;
  breakSpeed = 0;
  /** drawing hints (sizes, colours, skins) set by the course builder */
  d: Record<string, number> = {};
}

export interface Button { x: number; y: number; w: number; targets: number[]; pressed: number }
export interface Zone { x0: number; x1: number; y0: number; y1: number; ax: number; ay: number }
/** a loop's gates: `a` segments solid on the way in, `b` segments solid on the way round */
export interface LoopGate { cx: number; cy: number; R: number; a: number[]; b: number[]; state: number }
export interface WorldEvent { k: "break" | "spring" | "button" | "fall" | "loop"; x: number; y: number; body: number }

const kin = { x: 0, y: 0, a: 0 };

export class World {
  t = 0;
  g = 10;
  bodies: Body[] = [];
  movers: Body[] = [];
  balls: Body[] = [];
  buttons: Button[] = [];
  winds: Zone[] = [];
  loops: LoopGate[] = [];
  events: WorldEvent[] = [];
  killY = -60;
  // segments: world space (updated for moving bodies), body-local, owner and material
  ns = 0;
  ax = new Float64Array(0); ay = new Float64Array(0); bx = new Float64Array(0); by = new Float64Array(0);
  nx = new Float64Array(0); ny = new Float64Array(0);
  lax = new Float64Array(0); lay = new Float64Array(0); lbx = new Float64Array(0); lby = new Float64Array(0);
  sb = new Int32Array(0); sf = new Uint8Array(0); son = new Uint8Array(0);
  fr = new Float32Array(0); belt = new Float32Array(0);
  // broadphase for static segments: x cells
  private gx0 = 0; private gn = 0; private grid: Int32Array[] = []; private mark = new Uint32Array(0); private stampN = 0;
  // contacts (A end, B end): ends are −1/−2 wheel 0/1, −3 chassis, ≥0 a body
  private cn = 0;
  private cA = new Int32Array(MAXC); private cB = new Int32Array(MAXC);
  private cpx = new Float64Array(MAXC); private cpy = new Float64Array(MAXC); private cnx = new Float64Array(MAXC); private cny = new Float64Array(MAXC);
  private cpen = new Float64Array(MAXC); private cmu = new Float64Array(MAXC); private ctx = new Float64Array(MAXC); private cty = new Float64Array(MAXC);
  private cbn = new Float64Array(MAXC); private caN = new Float64Array(MAXC); private caT = new Float64Array(MAXC);
  // scratch
  private tvx = 0; private tvy = 0;
  car: Car | null = null;
  // building
  private segList: number[] = [];

  constructor() { this.addBody(STATIC, 0, 0); }

  // ---------------------------------------------------------------- building
  addBody(kind: number, x: number, y: number, a = 0): Body {
    const b = new Body();
    b.id = this.bodies.length; b.kind = kind;
    b.x0 = b.x = x; b.y0 = b.y = y; b.a0 = b.a = a;
    this.bodies.push(b);
    return b;
  }
  /** a segment in body-local coordinates */
  seg(b: Body, ax: number, ay: number, bx: number, by: number, flags = 0, fric = 1, belt = 0) {
    if (Math.hypot(bx - ax, by - ay) < 1e-4) return -1;
    const i = this.segList.length / 9;
    this.segList.push(ax, ay, bx, by, b.id, flags, fric, belt, 1);
    b.segs.push(i);
    return i;
  }
  /** a closed polygon (or an open polyline) of segments */
  poly(b: Body, pts: number[], closed: boolean, flags = 0, fric = 1, belt = 0) {
    const n = pts.length / 2;
    const ids: number[] = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const j = (i + 1) % n;
      const k = this.seg(b, pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1], flags, fric, belt);
      if (k >= 0) ids.push(k);
    }
    return ids;
  }
  /** set up arrays, bounds, the static grid; call once when the course is built */
  finalize() {
    const n = (this.ns = this.segList.length / 9);
    const L = this.segList;
    this.ax = new Float64Array(n); this.ay = new Float64Array(n); this.bx = new Float64Array(n); this.by = new Float64Array(n);
    this.nx = new Float64Array(n); this.ny = new Float64Array(n);
    this.lax = new Float64Array(n); this.lay = new Float64Array(n); this.lbx = new Float64Array(n); this.lby = new Float64Array(n);
    this.sb = new Int32Array(n); this.sf = new Uint8Array(n); this.son = new Uint8Array(n); this.fr = new Float32Array(n); this.belt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.lax[i] = L[i * 9]; this.lay[i] = L[i * 9 + 1]; this.lbx[i] = L[i * 9 + 2]; this.lby[i] = L[i * 9 + 3];
      this.sb[i] = L[i * 9 + 4]; this.sf[i] = L[i * 9 + 5]; this.fr[i] = L[i * 9 + 6]; this.belt[i] = L[i * 9 + 7]; this.son[i] = L[i * 9 + 8];
    }
    let x0 = Infinity, x1 = -Infinity;
    for (const b of this.bodies) {
      let R = 0;
      for (const k of b.segs) R = Math.max(R, Math.hypot(this.lax[k], this.lay[k]), Math.hypot(this.lbx[k], this.lby[k]));
      for (let c = 0; c < b.circ.length; c += 3) R = Math.max(R, Math.hypot(b.circ[c], b.circ[c + 1]) + b.circ[c + 2]);
      b.bound = R + b.r;
      if (b.kind === KINEMATIC || b.kind === PIVOT) this.movers.push(b);
      if (b.kind === BALL) this.balls.push(b);
      this.placeSegs(b);
      if (b.kind === STATIC) for (const k of b.segs) { x0 = Math.min(x0, this.ax[k], this.bx[k]); x1 = Math.max(x1, this.ax[k], this.bx[k]); }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    this.gx0 = x0 - CELL; this.gn = Math.ceil((x1 - this.gx0) / CELL) + 2;
    const cells: number[][] = Array.from({ length: this.gn }, () => []);
    for (const b of this.bodies) {
      if (b.kind !== STATIC) continue;
      for (const k of b.segs) {
        const c0 = Math.floor((Math.min(this.ax[k], this.bx[k]) - this.gx0) / CELL), c1 = Math.floor((Math.max(this.ax[k], this.bx[k]) - this.gx0) / CELL);
        for (let c = Math.max(0, c0); c <= Math.min(this.gn - 1, c1); c++) cells[c].push(k);
      }
    }
    this.grid = cells.map((c) => Int32Array.from(c));
    this.mark = new Uint32Array(n);
    this.segList = [];
    this.snapshot();
  }

  /** remember every body's starting state (reset() puts it back) */
  private saved: Float64Array[] = [];
  snapshot() { this.saved = this.bodies.map((b) => Float64Array.of(b.x, b.y, b.a, b.vx, b.vy, b.w)); }
  /** contraptions back to the start (a respawn) */
  reset() {
    for (const b of this.bodies) {
      const s = this.saved[b.id];
      b.x = s[0]; b.y = s[1]; b.a = s[2]; b.vx = s[3]; b.vy = s[4]; b.w = s[5];
      b.trig = -1; b.touched = 0; b.on = true;
      this.placeSegs(b);
    }
    for (const bt of this.buttons) bt.pressed = 0;
    for (const lp of this.loops) this.setLoop(lp, 0);
    this.events.length = 0;
  }

  private placeSegs(b: Body) {
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    for (const k of b.segs) {
      const ax = b.x + this.lax[k] * ca - this.lay[k] * sa, ay = b.y + this.lax[k] * sa + this.lay[k] * ca;
      const bx = b.x + this.lbx[k] * ca - this.lby[k] * sa, by = b.y + this.lbx[k] * sa + this.lby[k] * ca;
      this.ax[k] = ax; this.ay[k] = ay; this.bx[k] = bx; this.by[k] = by;
      const ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
      this.nx[k] = -ey / l; this.ny[k] = ex / l;
    }
  }

  setLoop(lp: LoopGate, state: number) {
    lp.state = state;
    for (const k of lp.a) this.son[k] = state === 0 ? 1 : 0;
    for (const k of lp.b) this.son[k] = state === 0 ? 0 : 1;
  }

  /** a kinematic body's pose at time t (into `kin`) */
  poseAt(b: Body, t: number) {
    const m = b.motion!;
    kin.x = b.x0; kin.y = b.y0; kin.a = b.a0;
    if (m.k === "osc") {
      // rest at the base for `hold` of the cycle, move out, rest at the far end for `hold2` (default: the same), move back
      const ph = (((t / m.period + m.phase) % 1) + 1) % 1, h = m.hold, h2 = m.hold2 ?? h, ramp = (1 - h - h2) / 2;
      let u: number;
      if (ph < h) u = 0;
      else if (ph < h + ramp) { const s = (ph - h) / ramp; u = s * s * (3 - 2 * s); }
      else if (ph < h + ramp + h2) u = 1;
      else { const s = (ph - h - ramp - h2) / ramp; u = 1 - s * s * (3 - 2 * s); }
      kin.x += m.dx * u; kin.y += m.dy * u; kin.a += m.da * u;
    } else if (m.k === "pend") kin.a += m.da * Math.sin(Math.PI * 2 * (t / m.period + m.phase));
    else if (m.k === "spin") kin.a += m.da * t;
    else if (m.k === "trig" && b.trig >= 0) {
      const s = Math.min(1, Math.max(0, (t - b.trig) / m.period)), u = s * s * (3 - 2 * s);
      kin.x += m.dx * u; kin.y += m.dy * u; kin.a += m.da * u;
    }
    return kin;
  }
  /** where a cycling body is in its cycle (0..1) at time t (the QA bot times lifts and swings with it) */
  phaseOf(b: Body, t = this.t) { const m = b.motion; return m ? (((t / m.period + m.phase) % 1) + 1) % 1 : 0; }

  /** the highest surface at x below y0 (placing the car) */
  groundAt(x: number, y0: number) {
    let best = -Infinity;
    for (let k = 0; k < this.ns; k++) {
      if (!this.son[k] || !this.bodies[this.sb[k]].on) continue;
      const ax = this.ax[k], bx = this.bx[k];
      if ((x < ax && x < bx) || (x > ax && x > bx) || Math.abs(bx - ax) < 1e-6) continue;
      const y = this.ay[k] + ((x - ax) / (bx - ax)) * (this.by[k] - this.ay[k]);
      if (y <= y0 && y > best) best = y;
    }
    return best;
  }

  /** let loose balls fall into place before the stage starts (no car) */
  settle(sec: number) {
    if (!this.balls.length) return;
    const n = Math.round(sec / STEP);
    for (let s = 0; s < n; s++) {
      for (const b of this.balls) if (b.on) { b.vy -= this.g * STEP; b.vx *= 0.97; b.vy *= 0.99; b.w *= 0.97; }
      this.cn = 0;
      for (const b of this.balls) if (b.on) this.gather(b.id, b.x, b.y, b.r, 0.7);
      for (let k = 0; k < this.cn; k++) { this.caN[k] = 0; this.caT[k] = 0; }
      for (let it = 0; it < ITER; it++) for (let k = 0; k < this.cn; k++) this.solve(k, false);
      for (const b of this.balls) if (b.on) { b.x += b.vx * STEP; b.y += b.vy * STEP; b.a += b.w * STEP; }
    }
    for (const b of this.balls) { b.vx = b.vy = b.w = 0; }
  }

  // ---------------------------------------------------------------- the step
  step(car: Car, p: Pedals) {
    const h = STEP, g = this.g;
    this.car = car;
    this.t += h;
    const t = this.t;
    // ---- moving bodies
    for (const b of this.movers) {
      if (!b.on) continue;
      const m = b.motion;
      if (b.kind === KINEMATIC && m) {
        if (m.k === "fall") {
          if (b.trig >= 0 && t - b.trig > m.period) {
            b.vy -= g * h; b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
            if (b.y < b.y0 - 40) b.on = false;
          }
        } else {
          const ox = b.x, oy = b.y, oa = b.a;
          const q = this.poseAt(b, t);
          b.x = q.x; b.y = q.y; b.a = q.a;
          b.vx = (b.x - ox) / h; b.vy = (b.y - oy) / h; b.w = (b.a - oa) / h;
          // a pivoting kinematic (pend, spin) turns about its own origin, so its origin doesn't move
        }
        this.placeSegs(b);
      } else if (b.kind === PIVOT) {
        // gravity on the centre of mass, a return spring, damping
        const ca = Math.cos(b.a), sa = Math.sin(b.a);
        const cx = b.comx * ca - b.comy * sa;
        const tau = -cx * b.m * g + b.spring * (b.rest - b.a) - b.damp * b.w;
        b.w += tau * b.invI * h;
        this.placeSegs(b);
      }
      b.touched = 0;
    }
    for (const b of this.balls) {
      if (!b.on) continue;
      b.vy -= g * h;
      b.vx *= 1 - 0.05 * h; b.vy *= 1 - 0.05 * h; b.w *= 1 - 0.3 * h;
    }
    // wind (fans, vents) on the car and the balls
    for (const z of this.winds) {
      if (car.x > z.x0 && car.x < z.x1 && car.y > z.y0 && car.y < z.y1) {
        car.vx += z.ax * h; car.vy += z.ay * h;
        for (let i = 0; i < 2; i++) { car.wvx[i] += z.ax * h; car.wvy[i] += z.ay * h; }
      }
    }
    // ---- the car's forces
    car.forces(p, g);
    // buttons: a wheel on the plate presses it
    for (const bt of this.buttons) {
      if (bt.pressed) continue;
      for (let i = 0; i < 2; i++) {
        if (Math.abs(car.wx[i] - bt.x) < bt.w * 0.5 + 0.1 && car.wy[i] - bt.y < car.rad[i] + 0.35 && car.wy[i] - bt.y > -0.5) {
          bt.pressed = 1;
          for (const id of bt.targets) if (this.bodies[id].trig < 0) this.bodies[id].trig = t;
          this.events.push({ k: "button", x: bt.x, y: bt.y, body: -1 });
          break;
        }
      }
    }
    // loops: once the car is round the top, the way out opens (and the way in closes)
    for (const lp of this.loops) {
      if (lp.state === 0 && car.y > lp.cy + lp.R * 0.25 && car.x < lp.cx + lp.R * 0.2 && Math.abs(car.x - lp.cx) < lp.R) { this.setLoop(lp, 1); this.events.push({ k: "loop", x: lp.cx, y: lp.cy, body: -1 }); }
      else if (lp.state === 1 && (car.x > lp.cx + lp.R + 1 || car.x < lp.cx - lp.R - 3)) this.setLoop(lp, 0);
    }

    // ---- contacts
    this.cn = 0;
    const ca = Math.cos(car.a), sa = Math.sin(car.a);
    for (let i = 0; i < 2; i++) this.gather(-1 - i, car.wx[i], car.wy[i], car.rad[i], car.spec.grip * car.gripMul);
    const hull = car.spec.hull;
    for (let k = 0; k < hull.length; k++) {
      const [lx, ly, r] = hull[k];
      this.gather(-3, car.x + lx * ca - ly * sa, car.y + lx * sa + ly * ca, r, 0.5);
    }
    // the head: solid, and touching anything is a crash
    const hd = car.spec.head;
    const before = this.cn;
    const hx = car.x + hd.x * ca - hd.y * sa, hy = car.y + hd.x * sa + hd.y * ca;
    this.gather(-3, hx, hy, hd.r, 0.4);
    if (this.cn > before) { if (car.shield) car.shieldHit = true; else car.headHit = true; }
    for (const b of this.balls) if (b.on) this.gather(b.id, b.x, b.y, b.r, 0.7);
    // launch pads and breakables react to the car's first touch
    this.reactions(car);

    // ---- solve
    for (let k = 0; k < this.cn; k++) { this.caN[k] = 0; this.caT[k] = 0; }
    car.beginSolve();
    for (let it = 0; it < ITER; it++) {
      car.struts();
      for (let k = 0; k < this.cn; k++) this.solve(k, it === 0);
    }

    // ---- move
    car.integrate(this.cn, this.cA, this.caN);
    // the ground's angle under the tyres (the stability assist leans the car towards it)
    let gx = 0, gy = 0;
    for (let k = 0; k < this.cn; k++) { const a = this.cA[k]; if (a === -1 || a === -2) { gx += this.cnx[k] * this.caN[k]; gy += this.cny[k] * this.caN[k]; } }
    if (gx * gx + gy * gy > 1e-6) car.groundA = Math.atan2(-gx, gy);
    for (let k = 0; k < this.cn; k++) {
      const a = this.cA[k];
      if (a < 0 && this.cB[k] >= 0) this.bodies[this.cB[k]].touched = 1;
      if (a < 0 && a > -3 && this.cB[k] >= 0) car.onBody[-a - 1] = this.cB[k];
    }
    for (const b of this.movers) {
      if (b.kind !== PIVOT || !b.on) continue;
      b.a += b.w * h;
      if (b.a < b.lo) { b.a = b.lo; if (b.w < 0) b.w = -b.w * 0.25; }
      else if (b.a > b.hi) { b.a = b.hi; if (b.w > 0) b.w = -b.w * 0.25; }
    }
    for (const b of this.balls) {
      if (!b.on) continue;
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
      if (b.y < this.killY) b.on = false;
    }
    // collapsing planks start falling after the car touches them
    for (const b of this.movers) if (b.touched && b.motion?.k === "fall" && b.trig < 0) { b.trig = t; this.events.push({ k: "fall", x: b.x, y: b.y, body: b.id }); }
  }

  private reactions(car: Car) {
    for (let k = 0; k < this.cn; k++) {
      const a = this.cA[k], bi = this.cB[k];
      if (a >= 0 || bi < 0) continue;
      const b = this.bodies[bi];
      if (b.d.spring) {
        // a launch pad fires once, then needs half a second to reset
        if (this.t - (b.d.fired ?? -9) > 0.7 && this.cny[k] > 0.5) {
          b.d.fired = this.t;
          // straight up, and forward at the pad's own speed (so the car clears the ledge it throws you at)
          const dvy = b.d.spring - Math.max(0, car.vy), dvx = Math.max(0, (b.d.push ?? 0) - car.vx);
          car.vx += dvx; car.vy += dvy; car.w *= 0.3;
          for (let i = 0; i < 2; i++) { car.wvx[i] += dvx; car.wvy[i] += dvy; }
          this.events.push({ k: "spring", x: this.cpx[k], y: this.cpy[k], body: bi });
        }
      }
      if (b.breakSpeed > 0 && b.on) {
        this.vel(a, this.cpx[k], this.cpy[k]);
        const vn = -(this.tvx * this.cnx[k] + this.tvy * this.cny[k]);
        if (vn > b.breakSpeed) {
          b.on = false;
          car.vx *= 0.8; for (let i = 0; i < 2; i++) car.wvx[i] *= 0.8;
          this.events.push({ k: "break", x: b.x, y: b.y, body: bi });
        }
      }
    }
    // drop contacts with bodies that just broke
    let j = 0;
    for (let k = 0; k < this.cn; k++) {
      const bi = this.cB[k];
      if (bi >= 0 && !this.bodies[bi].on) continue;
      if (j !== k) this.copyContact(k, j);
      j++;
    }
    this.cn = j;
  }
  private copyContact(k: number, j: number) {
    this.cA[j] = this.cA[k]; this.cB[j] = this.cB[k]; this.cpx[j] = this.cpx[k]; this.cpy[j] = this.cpy[k]; this.cnx[j] = this.cnx[k]; this.cny[j] = this.cny[k];
    this.cpen[j] = this.cpen[k]; this.cmu[j] = this.cmu[k]; this.ctx[j] = this.ctx[k]; this.cty[j] = this.cty[k]; this.cbn[j] = this.cbn[k];
  }

  // ---------------------------------------------------------------- contacts
  private gather(e: number, cx: number, cy: number, r: number, mu: number) {
    if (this.gn > 0) {
      const c0 = Math.max(0, Math.floor((cx - r - this.gx0) / CELL)), c1 = Math.min(this.gn - 1, Math.floor((cx + r - this.gx0) / CELL));
      const stamp = ++this.stampN;
      for (let c = c0; c <= c1; c++) {
        const list = this.grid[c];
        for (let q = 0; q < list.length; q++) {
          const k = list[q];
          if (this.mark[k] === stamp) continue;
          this.mark[k] = stamp;
          this.segHit(e, k, cx, cy, r, mu);
        }
      }
    }
    for (let q = 0; q < this.movers.length; q++) {
      const b = this.movers[q];
      if (!b.on) continue;
      const dx = cx - b.x, dy = cy - b.y, R = b.bound + r;
      if (dx * dx + dy * dy > R * R) continue;
      for (let s = 0; s < b.segs.length; s++) this.segHit(e, b.segs[s], cx, cy, r, mu);
      if (b.circ.length) {
        const ca = Math.cos(b.a), sa = Math.sin(b.a);
        for (let c = 0; c < b.circ.length; c += 3) {
          const px = b.x + b.circ[c] * ca - b.circ[c + 1] * sa, py = b.y + b.circ[c] * sa + b.circ[c + 1] * ca;
          this.circHit(e, b.id, cx, cy, r, px, py, b.circ[c + 2], mu);
        }
      }
    }
    for (let q = 0; q < this.balls.length; q++) {
      const b = this.balls[q];
      if (!b.on || b.id === e || (e >= 0 && b.id < e)) continue;
      this.circHit(e, b.id, cx, cy, r, b.x, b.y, b.r, mu);
    }
  }
  private segHit(e: number, k: number, cx: number, cy: number, r: number, mu: number) {
    if (!this.son[k]) return;
    const bi = this.sb[k];
    if (bi === e || !this.bodies[bi].on) return;
    const ax = this.ax[k], ay = this.ay[k], ex = this.bx[k] - ax, ey = this.by[k] - ay;
    const L2 = ex * ex + ey * ey;
    let u = ((cx - ax) * ex + (cy - ay) * ey) / L2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = ax + ex * u, py = ay + ey * u;
    const dx = cx - px, dy = cy - py, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    const f = this.sf[k];
    if (f & F_ONE) {
      if ((cx - ax) * this.nx[k] + (cy - ay) * this.ny[k] < 0) return;
    }
    const d = Math.sqrt(d2);
    let nx: number, ny: number;
    if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = this.nx[k]; ny = this.ny[k]; }
    // the same corner shared by two segments counts once
    for (let j = this.cn - 1; j >= 0 && j >= this.cn - 4; j--) {
      if (this.cA[j] === e && Math.abs(this.cpx[j] - px) < 1e-3 && Math.abs(this.cpy[j] - py) < 1e-3) return;
    }
    const L = Math.sqrt(L2), bt = this.belt[k];
    this.add(e, bi, px, py, nx, ny, r - d, mu * this.fr[k], bt ? (ex / L) * bt : 0, bt ? (ey / L) * bt : 0, 0);
  }
  private circHit(e: number, bi: number, cx: number, cy: number, r: number, px: number, py: number, pr: number, mu: number) {
    const dx = cx - px, dy = cy - py, d2 = dx * dx + dy * dy, R = r + pr;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2);
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
    this.add(e, bi, px + nx * pr, py + ny * pr, nx, ny, R - d, mu * 0.9, 0, 0, 0.1);
  }
  private add(a: number, b: number, px: number, py: number, nx: number, ny: number, pen: number, mu: number, tx: number, ty: number, bounce: number) {
    if (this.cn >= MAXC) return;
    const k = this.cn++;
    this.cA[k] = a; this.cB[k] = b; this.cpx[k] = px; this.cpy[k] = py; this.cnx[k] = nx; this.cny[k] = ny;
    this.cpen[k] = pen; this.cmu[k] = mu; this.ctx[k] = tx; this.cty[k] = ty; this.cbn[k] = bounce;
  }

  // ---------------------------------------------------------------- ends: velocity, inverse mass and impulses at a point
  private vel(e: number, px: number, py: number) {
    if (e < 0) {
      const c = this.car!;
      if (e === -3) { const rx = px - c.x, ry = py - c.y; this.tvx = c.vx - c.w * ry; this.tvy = c.vy + c.w * rx; }
      else { const i = -e - 1, rx = px - c.wx[i], ry = py - c.wy[i]; this.tvx = c.wvx[i] - c.omega[i] * ry; this.tvy = c.wvy[i] + c.omega[i] * rx; }
    } else {
      const b = this.bodies[e], rx = px - b.x, ry = py - b.y;
      this.tvx = b.vx - b.w * ry; this.tvy = b.vy + b.w * rx;
    }
  }
  private invMass(e: number, px: number, py: number, dx: number, dy: number) {
    if (e < 0) {
      const c = this.car!;
      if (e === -3) { const rn = (px - c.x) * dy - (py - c.y) * dx; return 1 / c.M + (rn * rn) / c.I; }
      const i = -e - 1, rn = (px - c.wx[i]) * dy - (py - c.wy[i]) * dx;
      return 1 / c.wm[i] + (rn * rn) / c.wI[i];
    }
    const b = this.bodies[e];
    if (b.invM === 0 && b.invI === 0) return 0;
    const rn = (px - b.x) * dy - (py - b.y) * dx;
    return b.invM + rn * rn * b.invI;
  }
  private push(e: number, px: number, py: number, jx: number, jy: number) {
    if (e < 0) {
      const c = this.car!;
      if (e === -3) { c.vx += jx / c.M; c.vy += jy / c.M; c.w += ((px - c.x) * jy - (py - c.y) * jx) / c.I; }
      else { const i = -e - 1; c.wvx[i] += jx / c.wm[i]; c.wvy[i] += jy / c.wm[i]; c.omega[i] += ((px - c.wx[i]) * jy - (py - c.wy[i]) * jx) / c.wI[i]; }
      return;
    }
    const b = this.bodies[e];
    if (b.invM === 0 && b.invI === 0) return;
    b.vx += jx * b.invM; b.vy += jy * b.invM; b.w += ((px - b.x) * jy - (py - b.y) * jx) * b.invI;
  }

  private solve(k: number, first: boolean) {
    const A = this.cA[k], B = this.cB[k], px = this.cpx[k], py = this.cpy[k], nx = this.cnx[k], ny = this.cny[k];
    this.vel(A, px, py); let vx = this.tvx, vy = this.tvy;
    this.vel(B, px, py); vx -= this.tvx + this.ctx[k]; vy -= this.tvy + this.cty[k];
    const vn = vx * nx + vy * ny;
    if (first && A < 0) {
      // landings and body hits (sound, dust, camera shake)
      const c = this.car!;
      if (A > -3) { const i = -A - 1; if (c.since[i] > 0.12 && -vn > 2) c.landing = Math.max(c.landing, -vn); }
      else if (-vn > 1.5) c.bodyHit = Math.max(c.bodyHit, -vn);
    }
    const kN = this.invMass(A, px, py, nx, ny) + this.invMass(B, px, py, nx, ny);
    if (kN <= 0) return;
    const bias = fix((Math.max(0, this.cpen[k] - SLOP) * BETA) / STEP) + (vn < -2 ? -vn * this.cbn[k] : 0);
    let ln = (bias - vn) / kN;
    const old = this.caN[k];
    this.caN[k] = Math.max(0, old + ln);
    ln = this.caN[k] - old;
    this.push(A, px, py, ln * nx, ln * ny); this.push(B, px, py, -ln * nx, -ln * ny);
    // friction
    const tx = ny, ty = -nx;
    this.vel(A, px, py); let wx = this.tvx, wy = this.tvy;
    this.vel(B, px, py); wx -= this.tvx + this.ctx[k]; wy -= this.tvy + this.cty[k];
    const vt = wx * tx + wy * ty;
    const kT = this.invMass(A, px, py, tx, ty) + this.invMass(B, px, py, tx, ty);
    if (kT <= 0) return;
    let lt = -vt / kT;
    const maxF = this.cmu[k] * this.caN[k];
    const oldT = this.caT[k];
    this.caT[k] = Math.max(-maxF, Math.min(maxF, oldT + lt));
    lt = this.caT[k] - oldT;
    this.push(A, px, py, lt * tx, lt * ty); this.push(B, px, py, -lt * tx, -lt * ty);
    if (A === -3 && Math.abs(vt) > 1) { const c = this.car!; c.scrape = Math.max(c.scrape, Math.abs(vt) * 0.2); }
  }
}

// ================================================================== the car
export class Car {
  spec: VehicleSpec;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  M: number; I: number;
  wx = new Float64Array(2); wy = new Float64Array(2);
  wvx = new Float64Array(2); wvy = new Float64Array(2);
  spin = new Float64Array(2); omega = new Float64Array(2);
  rad = new Float64Array(2); wm = new Float64Array(2); wI = new Float64Array(2);
  ext = new Float64Array(2);
  touch = new Uint8Array(2); since = new Float64Array(2);
  /** the body each wheel last stood on */
  onBody = new Int32Array(2);
  load = new Float64Array(2);
  landing = 0; bodyHit = 0; scrape = 0;
  headHit = false; shield = false; shieldHit = false;
  slip = 0; airTime = 0;
  turbo = 0;
  gripMul = 1;
  /** motor power multiplier (the grip power-up and world tweaks) */
  power = 1;
  /** the angle of the ground the tyres last stood on */
  groundA = 0;
  /** the pedals this step (for drawing) */
  gas = 0; brk = 0;

  constructor(spec: VehicleSpec) {
    this.spec = spec;
    const c = spec.chassis;
    this.M = c.mass;
    this.I = ((c.mass * (c.w * c.w + c.h * c.h)) / 12) * c.inertia;
    for (let i = 0; i < 2; i++) {
      const w = spec.wheels[i];
      this.rad[i] = w.r; this.wm[i] = w.mass; this.wI[i] = 0.5 * w.mass * w.r * w.r;
    }
  }

  /** put the car at rest on the ground at x (`ground(x)` = the surface height there) */
  place(x: number, ground: (x: number) => number) {
    const s = this.spec;
    const xr = x + s.anchors[0][0], xf = x + s.anchors[1][0];
    const g0 = ground(xr), g1 = ground(xf);
    const a = Math.max(-0.5, Math.min(0.5, Math.atan2(g1 - g0, xf - xr)));
    this.a = a; this.vx = this.vy = this.w = 0;
    const ca = Math.cos(a), sa = Math.sin(a);
    let y = -Infinity;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i], W = s.wheels[i];
      y = Math.max(y, (i === 0 ? g0 : g1) + 0.03 + W.r + ca * W.rest - ax * sa - ay * ca);
    }
    this.x = x; this.y = y;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const px = this.x + ax * ca - ay * sa, py = this.y + ax * sa + ay * ca;
      this.wx[i] = px + sa * s.wheels[i].rest; this.wy[i] = py - ca * s.wheels[i].rest;
      this.wvx[i] = this.wvy[i] = this.omega[i] = 0;
      this.ext[i] = s.wheels[i].rest;
      this.since[i] = 0; this.touch[i] = 1; this.onBody[i] = 0;
    }
    this.airTime = 0; this.headHit = false; this.shieldHit = false; this.landing = 0; this.bodyHit = 0; this.turbo = 0; this.slip = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  /** speed along the car's nose (m/s, negative when reversing) */
  get forward() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }
  get grounded() { return this.since[0] < 0.08 || this.since[1] < 0.08; }
  headPos(out: { x: number; y: number }) {
    const h = this.spec.head, ca = Math.cos(this.a), sa = Math.sin(this.a);
    out.x = this.x + h.x * ca - h.y * sa; out.y = this.y + h.x * sa + h.y * ca;
    return out;
  }

  /** gravity, springs and the motor (before contacts) */
  forces(p: Pedals, g: number) {
    const s = this.spec, h = STEP;
    this.gas = p.gas; this.brk = p.brake;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const ux = sa, uy = -ca;
    const M = this.M, I = this.I;
    this.vy -= g * h;
    for (let i = 0; i < 2; i++) this.wvy[i] -= g * h;
    const air = !this.grounded;
    const hold = p.gas === 0 && p.brake === 0;
    const turbo = this.turbo > 0;
    const top = s.maxSpin * (turbo ? 1.3 : 1);
    for (let i = 0; i < 2; i++) {
      const W = s.wheels[i];
      const [ax, ay] = s.anchors[i];
      const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca;
      const dx = this.wx[i] - (this.x + rx), dy = this.wy[i] - (this.y + ry);
      const e = dx * ux + dy * uy;
      this.ext[i] = e;
      const pvx = this.vx - this.w * ry, pvy = this.vy + this.w * rx;
      const edot = (this.wvx[i] - pvx) * ux + (this.wvy[i] - pvy) * uy;
      const J = (W.k * (W.rest - e) - W.c * edot) * h;
      const m = this.wm[i];
      this.wvx[i] += (J * ux) / m; this.wvy[i] += (J * uy) / m;
      this.vx -= (J * ux) / M; this.vy -= (J * uy) / M;
      this.w -= (rx * (J * uy) - ry * (J * ux)) / I;
      // the motor on the driven wheels; its reaction on the body lifts the nose
      const driven = s.drive === "all" || (s.drive === "rear" ? i === 0 : i === 1);
      const share = s.drive === "all" ? 0.5 : 1;
      let T = 0;
      const spinTop = top / W.r * s.wheels[0].r; // the same road speed for both wheels
      if (p.gas > 0 && driven) {
        const curve = Math.min(1, Math.max(0, (spinTop + this.omega[i]) / (spinTop * 0.35)));
        T = -s.torque * share * p.gas * curve * this.power * (turbo ? 1.5 : 1);
      }
      let Tb = 0;
      if (p.brake > 0) {
        const lin = this.omega[i] * W.r; // < 0 rolling forward
        if (lin < -0.25) Tb = s.brake * 0.5 * p.brake * (W.r / s.wheels[0].r); // rolling forward: brake
        else if (driven && lin < spinTop * W.r * 0.4) T += s.torque * 0.5 * share * p.brake; // stopped: reverse
      }
      // no pedal: the car holds itself (it rolls to a stop, and rides a moving platform instead of sliding off it)
      if (hold) Tb = s.brake * 0.4 * (W.r / s.wheels[0].r) * (this.omega[i] < 0 ? 1 : -1);
      this.omega[i] += (T / this.wI[i]) * h;
      if (Tb < 0) {
        const d = (-Tb / this.wI[i]) * h;
        if (this.omega[i] > 0) { const used = Math.min(d, this.omega[i]); this.omega[i] -= used; Tb *= used / d; } else Tb = 0;
      } else if (Tb > 0) {
        // the brake slows the wheel to a stop, never spins it backwards
        const d = (Tb / this.wI[i]) * h;
        if (this.omega[i] < 0) { const used = Math.min(d, -this.omega[i]); this.omega[i] += used; Tb *= used / d; } else Tb = 0;
      }
      this.w -= ((T * s.wheelie + Tb * (hold ? 0.12 : 0.35)) / I) * h;
      this.omega[i] *= 1 - 0.2 * h;
    }
    // in the air the pedals spin the car (gas: nose up, brake: nose down)
    if (air) this.w += s.airControl * (p.gas - p.brake) * h;
    if (turbo) { const f = 8 * h; this.vx += ca * f; this.vy += sa * f; }
    const drag = 1 - 0.05 * h;
    this.vx *= drag; this.vy *= drag;
    // stability assist (so a slow, careful drive doesn't end on the roof):
    //  - spin dies away faster with a wheel on the ground;
    //  - balanced on one wheel (a wheelie, or the nose tipping over an edge), the car leans back towards the ground;
    //  - in the air with hands off the pedals, it slowly levels out to the angle of the ground it left
    const touching = this.touch[0] + this.touch[1];
    this.w *= 1 - (touching ? 1.4 : SPIN_DAMP) * h;
    let rel = this.a - this.groundA;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (touching === 1 && Math.abs(rel) > 0.18) this.w -= (rel - Math.sign(rel) * 0.18) * 7 * h;
    else if (!touching && hold && this.airTime > 0.12) this.w -= (2 * rel + 0.9 * this.w) * h;
  }

  private sideways = new Float64Array(2);
  beginSolve() { this.sideways.fill(0); }

  /** the struts: each wheel stays on its strut, inside its travel */
  struts() {
    const s = this.spec;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const ux = sa, uy = -ca, nx = ca, ny = sa;
    const M = this.M, I = this.I;
    for (let i = 0; i < 2; i++) {
      const W = s.wheels[i], m = this.wm[i];
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
        const lam = -(vrel + fix((BETA * lat) / STEP)) / em;
        this.wvx[i] += (lam * nx) / m; this.wvy[i] += (lam * ny) / m;
        this.vx -= (lam * nx) / M; this.vy -= (lam * ny) / M;
        this.w -= (rn * lam) / I;
      }
      {
        const dx = this.wx[i] - px, dy = this.wy[i] - py;
        const e = dx * ux + dy * uy;
        const lo = W.rest - W.travel, hi = W.rest + W.travel * 0.55;
        if (e < lo || e > hi) {
          const pvx = this.vx - this.w * ry, pvy = this.vy + this.w * rx;
          const vrel = (this.wvx[i] - pvx) * ux + (this.wvy[i] - pvy) * uy;
          const ru = rx * uy - ry * ux;
          const em = 1 / m + 1 / M + (ru * ru) / I;
          const target = fix(e < lo ? Math.max(0, ((lo - e) * BETA) / STEP) : Math.min(0, ((hi - e) * BETA) / STEP));
          let lam = (target - vrel) / em;
          lam = e < lo ? Math.max(0, lam) : Math.min(0, lam);
          this.wvx[i] += (lam * ux) / m; this.wvy[i] += (lam * uy) / m;
          this.vx -= (lam * ux) / M; this.vy -= (lam * uy) / M;
          this.w -= (ru * lam) / I;
          if (e < lo && -vrel > 3) this.bodyHit = Math.max(this.bodyHit, -vrel * 0.5);
        }
      }
    }
  }

  integrate(cn: number, cA: Int32Array, caN: Float64Array) {
    const h = STEP;
    this.x += this.vx * h; this.y += this.vy * h; this.a += this.w * h;
    let on0 = 0, on1 = 0;
    this.load[0] = this.load[1] = 0;
    for (let k = 0; k < cn; k++) {
      if (cA[k] === -1) { on0 = 1; this.load[0] += caN[k]; }
      else if (cA[k] === -2) { on1 = 1; this.load[1] += caN[k]; }
    }
    let slipSum = 0;
    for (let i = 0; i < 2; i++) {
      this.wx[i] += this.wvx[i] * h; this.wy[i] += this.wvy[i] * h;
      this.spin[i] += this.omega[i] * h;
      const on = i === 0 ? on0 : on1;
      this.touch[i] = on;
      this.since[i] = on ? 0 : this.since[i] + h;
      if (on) {
        const roll = -this.omega[i] * this.rad[i], along = this.wvx[i] * Math.cos(this.a) + this.wvy[i] * Math.sin(this.a);
        slipSum += Math.min(1, Math.abs(roll - along) / 5);
      }
    }
    this.slip += (slipSum * 0.5 - this.slip) * 0.08;
    this.airTime = this.grounded ? 0 : this.airTime + h;
    if (this.turbo > 0) this.turbo = Math.max(0, this.turbo - h);
  }
}
