// Peak Rover physics: a chassis on two sprung wheels over a height-field terrain, stepped at 240 Hz.
//  - suspension: a spring-damper along each wheel's strut, a rigid sideways constraint and travel stops;
//  - tyres: non-penetration and friction impulses at the contact point, coupled to the wheel's spin, so the motor
//    drives the car through grip (and wheelspins when grip runs out);
//  - the motor's reaction torque lifts the nose under power (wheelies); in the air the pedals also spin the car;
//  - the body's outline bounces and slides on the ground; the driver's head touching the ground is a crash.
// Units: metres, kilograms, seconds. y points up. Angles are counter-clockwise; a wheel rolling forward spins < 0.
// No allocation in the step: everything lives in typed arrays and plain numbers.
import type { Terrain } from "./terrain";
import type { VehicleSpec } from "./vehicles";

export const STEP = 1 / 240;
const ITER = 6;
const SLOP = 0.004, BETA = 0.25;
/** position corrections never push faster than this (a wheel deep in the ground must not explode the step) */
const MAXFIX = 5;
const fix = (v: number) => (v > MAXFIX ? MAXFIX : v < -MAXFIX ? -MAXFIX : v);
/** spin damping (1/s): low, so a bump or a pedal kick keeps the car turning and a careless landing flips it */
const SPIN_DAMP = 0.22;

export interface Pedals { gas: number; brake: number }

/** contact result buffer (reused) */
const hit = { d: 0, nx: 0, ny: 1, qx: 0, qy: 0 };

export class Rover {
  spec: VehicleSpec;
  // chassis
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  M: number; I: number;
  // wheels (0 = rear, 1 = front)
  wx = new Float64Array(2); wy = new Float64Array(2);
  wvx = new Float64Array(2); wvy = new Float64Array(2);
  spin = new Float64Array(2); omega = new Float64Array(2);
  /** suspension extension (rest = spec.wheel.rest) */
  ext = new Float64Array(2);
  /** tyre on the ground this step / how long ago it last was */
  touch = new Uint8Array(2); since = new Float64Array(2);
  /** normal impulse this step (for dust, sound) and the hardest landing since read */
  load = new Float64Array(2);
  landing = 0;
  /** body scraping the ground (impulse) and the hardest body hit since read */
  scrape = 0; bodyHit = 0;
  /** the driver's head touched the ground */
  headHit = false;
  /** with a shield the head bounces instead (and the game pops the shield) */
  shield = false;
  shieldHit = false;
  /** wheelspin 0..1 (for dust and sound) */
  slip = 0;
  airTime = 0;
  /** turbo: extra drive and a push along the body */
  turbo = 0;
  gravity = 10;
  gripMul = 1;
  // per-step scratch
  private accN = new Float64Array(2); private accT = new Float64Array(2);
  private wm: number; private wI: number;

  constructor(spec: VehicleSpec) {
    this.spec = spec;
    const c = spec.chassis;
    this.M = c.mass;
    this.I = (c.mass * (c.w * c.w + c.h * c.h)) / 12 * c.inertia;
    this.wm = spec.wheel.mass;
    this.wI = 0.5 * spec.wheel.mass * spec.wheel.r * spec.wheel.r;
  }

  /** put the car at rest on the ground at x */
  place(t: Terrain, x: number) {
    const s = this.spec;
    const slope = Math.atan2(t.heightAt(x + 1) - t.heightAt(x - 1), 2);
    this.a = slope; this.vx = this.vy = this.w = 0;
    const ca = Math.cos(slope), sa = Math.sin(slope);
    // chassis high enough that both wheels hang just above the ground
    let lift = 0;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const px = ax * ca - ay * sa, py = ax * sa + ay * ca;
      const wxl = px + Math.sin(slope) * s.wheel.rest, wyl = py - Math.cos(slope) * s.wheel.rest;
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
    this.airTime = 0; this.headHit = false; this.shieldHit = false; this.landing = 0; this.bodyHit = 0; this.turbo = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  /** forward speed along the ground (m/s, negative when reversing) */
  get forward() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }
  get grounded() { return this.since[0] < 0.08 || this.since[1] < 0.08; }
  /** the head's world position */
  headPos(out: { x: number; y: number }) {
    const h = this.spec.head, ca = Math.cos(this.a), sa = Math.sin(this.a);
    out.x = this.x + h.x * ca - h.y * sa; out.y = this.y + h.x * sa + h.y * ca;
    return out;
  }

  step(t: Terrain, p: Pedals) {
    const s = this.spec, h = STEP, g = this.gravity;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const ux = sa, uy = -ca; // strut axis (chassis "down")
    const nx = ca, ny = sa; // across the strut (chassis "forward")
    const M = this.M, I = this.I, m = this.wm, wI = this.wI;
    const k = s.wheel.k, c = s.wheel.c, rest = s.wheel.rest, r = s.wheel.r;

    // ---- forces: gravity, springs, motor
    this.vy -= g * h;
    for (let i = 0; i < 2; i++) this.wvy[i] -= g * h;
    const air = !this.grounded;
    const top = s.maxSpin * (this.turbo > 0 ? 1.35 : 1);
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca; // anchor from the centre of mass
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

      // motor: torque on the driven wheels, its reaction on the body (lifts the nose under power)
      const driven = s.drive === "all" || i === 0;
      let T = 0;
      if (p.gas > 0 && driven) {
        const share = s.drive === "all" ? 0.5 : 1;
        // full torque up to two thirds of top speed, then fading to nothing at the top (no runaway spin in the air)
        const curve = Math.min(1, Math.max(0, (top + this.omega[i]) / (top * 0.35)));
        T = -s.torque * share * p.gas * curve * (this.turbo > 0 ? 1.6 : 1);
      }
      let Tb = 0;
      if (p.brake > 0) {
        const om = this.omega[i];
        if (om < -0.6) Tb = s.brake * 0.5 * p.brake; // rolling forward: brake
        else if (driven && om < s.maxSpin * 0.45) T += s.torque * 0.45 * p.brake * (s.drive === "all" ? 0.5 : 1); // stopped: reverse
      }
      this.omega[i] += ((T + Tb) / wI) * h;
      // the motor's full reaction: too much gas on a climb lifts the nose and flips the car over backwards; braking
      // dips the nose too, but more gently (or a light bike would somersault over every bump it brakes on)
      this.w -= ((T * s.wheelie + Tb * 0.55) / I) * h;
      // a little rolling resistance
      this.omega[i] *= 1 - 0.15 * h;
    }
    // in the air the pedals spin the car (gas: nose up, brake: nose down)
    if (air) this.w += s.airControl * (p.gas - p.brake) * h;
    // turbo pushes along the body
    if (this.turbo > 0) { const f = 9 * h; this.vx += ca * f; this.vy += sa * f; }
    // drag
    const drag = 1 - 0.04 * h;
    this.vx *= drag; this.vy *= drag; this.w *= 1 - SPIN_DAMP * h;

    // ---- constraints
    this.accN.fill(0); this.accT.fill(0);
    let anyTouch0 = false, anyTouch1 = false;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < 2; i++) {
        const [ax, ay] = s.anchors[i];
        const rx = ax * ca - ay * sa, ry = ax * sa + ay * ca;
        const px = this.x + rx, py = this.y + ry;
        // sideways: the wheel stays on its strut
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
        // travel stops
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
        // tyre on the ground
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
          // friction along the ground, coupled to the spin
          const Tx = Ny, Ty = -Nx;
          const om2 = this.omega[i];
          const vtx = this.wvx[i] - om2 * rcy, vty = this.wvy[i] + om2 * rcx;
          const vt = vtx * Tx + vty * Ty;
          const emT = 1 / m + (r * r) / wI;
          let lt = -vt / emT;
          const maxF = s.grip * this.gripMul * this.accN[i];
          const oldT = this.accT[i];
          this.accT[i] = Math.max(-maxF, Math.min(maxF, oldT + lt));
          lt = this.accT[i] - oldT;
          this.wvx[i] += (lt * Tx) / m; this.wvy[i] += (lt * Ty) / m;
          this.omega[i] += (rcx * (lt * Ty) - rcy * (lt * Tx)) / wI;
        }
      }
      // the body's outline on the ground
      this.hull(t, ca, sa, it === 0);
      // the head
      const hd = s.head;
      const hx = this.x + hd.x * ca - hd.y * sa, hy = this.y + hd.x * sa + hd.y * ca;
      if (t.closest(hx, hy, hd.r, hit) && hit.d < hd.r) {
        if (this.shield) { this.shieldHit = true; this.push(hx, hy, hit.nx, hit.ny, hd.r - hit.d, 0.35, 0.4); }
        else this.headHit = true;
      }
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
    if (this.turbo > 0) this.turbo = Math.max(0, this.turbo - h);
  }

  /** the body's outline: points below the ground are pushed out with friction */
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

  /** an impulse on the chassis at (px, py) that stops it moving into the ground along N, with friction */
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
    // sliding friction
    const Tx = Ny, Ty = -Nx;
    const vt = (this.vx - this.w * ry) * Tx + (this.vy + this.w * rx) * Ty;
    const rt = rx * Ty - ry * Tx;
    const emT = 1 / this.M + (rt * rt) / this.I;
    const lt = Math.max(-mu * ln, Math.min(mu * ln, -vt / emT));
    this.vx += (lt * Tx) / this.M; this.vy += (lt * Ty) / this.M; this.w += (rt * lt) / this.I;
    this.scrape = Math.max(this.scrape, Math.abs(vt) * 0.2);
  }
}
