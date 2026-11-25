// Rumble Rally physics, stepped at 240 Hz.
//  - A truck: a chassis on two sprung wheels (spring-damper struts, a rigid sideways constraint, travel stops), tyre
//    contacts with friction coupled to each wheel's spin so the motor drives through grip, the motor's reaction that
//    lifts the nose under power, air control from the pedals, the body's outline sliding on the ground, and the roof:
//    touching the ground with it is a crash. Mud, ice and water change grip and drag under the wheels.
//  - Nitro pushes along the body and lifts the top speed; a rocket hit is an impulse with a spin (armour soaks some).
//  - `collideTrucks` can push two trucks' body boxes apart (separating axes and impulses, the ram truck pushing
//    harder, armour shrugging some off). The race itself lets trucks drive through each other and turns a fast
//    catch into a ram attack (src/rumble/game.ts), so a slower truck never blocks the track.
// Units: metres, kilograms, seconds. y up; angles counter-clockwise; a wheel rolling forward spins < 0.
// No allocation in the step.
import type { Terrain } from "./terrain";
import type { TruckSpec } from "./trucks";

export const STEP = 1 / 240;
const ITER = 6;
const SLOP = 0.004, BETA = 0.25;
const MAXFIX = 5;
const fix = (v: number) => (v > MAXFIX ? MAXFIX : v < -MAXFIX ? -MAXFIX : v);
const SPIN_DAMP = 0.3;

export interface Pedals { gas: number; brake: number }
const hit = { d: 0, nx: 0, ny: 1, qx: 0, qy: 0 };

export class Truck {
  spec: TruckSpec;
  x = 0; y = 0; a = 0; vx = 0; vy = 0; w = 0;
  M: number; I: number;
  wx = new Float64Array(2); wy = new Float64Array(2);
  wvx = new Float64Array(2); wvy = new Float64Array(2);
  spin = new Float64Array(2); omega = new Float64Array(2);
  ext = new Float64Array(2);
  touch = new Uint8Array(2); since = new Float64Array(2);
  landing = 0; scrape = 0; bodyHit = 0;
  roofHit = false;
  slip = 0;
  airTime = 0;
  /** nitro burning this step */
  nitro = false;
  gravity = 10;
  gripMul = 1;
  wind = 0;
  mud = 0; water = 0;
  /** world corners of the body box (for truck-to-truck contacts) and its edge normals */
  bv = new Float64Array(8); bn = new Float64Array(8);
  /** the hardest bump from another truck since read (for sounds and effects) */
  bump = 0;
  private accN = new Float64Array(2); private accT = new Float64Array(2);
  private wm: number; private wI: number;

  constructor(spec: TruckSpec) {
    this.spec = spec;
    const c = spec.chassis;
    this.M = c.mass;
    this.I = (c.mass * (c.w * c.w + c.h * c.h)) / 12 * c.inertia;
    this.wm = spec.wheel.mass;
    this.wI = 0.5 * spec.wheel.mass * spec.wheel.r * spec.wheel.r;
  }

  place(t: Terrain, x: number) {
    const s = this.spec;
    const slope = Math.atan2(t.heightAt(x + 1.5) - t.heightAt(x - 1.5), 3);
    this.a = slope; this.vx = this.vy = this.w = 0;
    const ca = Math.cos(slope), sa = Math.sin(slope);
    let lift = 0;
    for (let i = 0; i < 2; i++) {
      const [ax, ay] = s.anchors[i];
      const px = ax * ca - ay * sa, py = ax * sa + ay * ca;
      lift = Math.max(lift, t.heightAt(x + px + sa * s.wheel.rest) + s.wheel.r + 0.02 - (py - ca * s.wheel.rest));
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
    this.airTime = 0; this.roofHit = false; this.landing = 0; this.bodyHit = 0; this.nitro = false;
    this.outline();
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get forward() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }
  get grounded() { return this.since[0] < 0.08 || this.since[1] < 0.08; }
  toWorld(lx: number, ly: number, out: { x: number; y: number }) {
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    out.x = this.x + lx * ca - ly * sa; out.y = this.y + lx * sa + ly * ca;
    return out;
  }

  /** a hit at a world point: an impulse (kg·m/s) and an extra spin (rad/s), softened by armour */
  knock(ix: number, iy: number, spin: number) {
    const k = 1 - this.spec.armor;
    this.vx += (ix * k) / this.M; this.vy += (iy * k) / this.M; this.w += spin * k;
    for (let i = 0; i < 2; i++) { this.wvx[i] += (ix * k) / this.M; this.wvy[i] += (iy * k) / this.M; }
  }

  /** the body box's world corners and normals */
  outline() {
    const b = this.spec.body, ca = Math.cos(this.a), sa = Math.sin(this.a), v = this.bv, n = this.bn;
    const x0 = b.x0, x1 = b.x1, y0 = b.y0, y1 = b.y1 + 0.25;
    v[0] = this.x + x0 * ca - y0 * sa; v[1] = this.y + x0 * sa + y0 * ca;
    v[2] = this.x + x1 * ca - y0 * sa; v[3] = this.y + x1 * sa + y0 * ca;
    v[4] = this.x + x1 * ca - y1 * sa; v[5] = this.y + x1 * sa + y1 * ca;
    v[6] = this.x + x0 * ca - y1 * sa; v[7] = this.y + x0 * sa + y1 * ca;
    n[0] = sa; n[1] = -ca; n[2] = ca; n[3] = sa; n[4] = -sa; n[5] = ca; n[6] = -ca; n[7] = -sa;
  }

  step(t: Terrain, p: Pedals) {
    const s = this.spec, h = STEP, g = this.gravity;
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    const ux = sa, uy = -ca, nx = ca, ny = sa;
    const M = this.M, I = this.I, m = this.wm, wI = this.wI;
    const k = s.wheel.k, c = s.wheel.c, rest = s.wheel.rest, r = s.wheel.r;

    this.vy -= g * h;
    for (let i = 0; i < 2; i++) this.wvy[i] -= g * h;
    const air = !this.grounded;
    const boost = this.nitro;
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
        T = -s.torque * share * p.gas * curve * (boost ? 1.4 : 1) * (g < 10 ? Math.sqrt(g / 10) : 1);
      }
      let Tb = 0;
      if (p.brake > 0) {
        const om = this.omega[i];
        if (om < -0.6) Tb = s.brake * 0.5 * p.brake;
        else if (driven && om < s.maxSpin * 0.4) T += s.torque * 0.4 * p.brake * (s.drive === "all" ? 0.5 : 1);
      }
      this.omega[i] += ((T + Tb) / wI) * h;
      this.w -= ((T * s.wheelie + Tb * 0.5) / I) * h;
      const zone = t.zoneAt(this.wx[i]);
      const mud = zone === 1 && this.wy[i] - r < t.heightAt(this.wx[i]) + 0.25;
      if (mud) this.mud = 1;
      this.omega[i] *= 1 - (mud ? 1.4 : 0.12) * h;
      if (mud) this.wvx[i] *= 1 - 0.8 * h;
    }
    const lvl = t.waterAt(this.x);
    if (lvl > -1e8) {
      const depth = lvl - (this.y - 0.9);
      if (depth > 0) {
        this.water = Math.min(1, depth / 1.2);
        const d = 1 - (0.5 + 1.4 * this.water) * h;
        this.vx *= d; this.vy *= d;
        for (let i = 0; i < 2; i++) this.wvx[i] *= d;
      }
    }
    if (air) this.w += s.airControl * (p.gas - p.brake) * h;
    if (boost) { const f = s.nitroPush * h; this.vx += ca * f; this.vy += sa * f; }
    this.vx += this.wind * 0.05 * h;
    const drag = 1 - 0.04 * h;
    this.vx *= drag; this.vy *= drag; this.w *= 1 - SPIN_DAMP * h;

    this.accN.fill(0); this.accT.fill(0);
    let on0 = false, on1 = false;
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
          if (i === 0) on0 = true; else on1 = true;
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
    }

    this.x += this.vx * h; this.y += this.vy * h; this.a += this.w * h;
    let slipSum = 0;
    for (let i = 0; i < 2; i++) {
      this.wx[i] += this.wvx[i] * h; this.wy[i] += this.wvy[i] * h;
      this.spin[i] += this.omega[i] * h;
      const on = i === 0 ? on0 : on1;
      this.touch[i] = on ? 1 : 0;
      this.since[i] = on ? 0 : this.since[i] + h;
      if (on) {
        const roll = -this.omega[i] * r, along = this.wvx[i] * Math.cos(this.a) + this.wvy[i] * Math.sin(this.a);
        slipSum += Math.min(1, Math.abs(roll - along) / 6);
      }
    }
    this.slip += (slipSum * 0.5 - this.slip) * 0.08;
    this.airTime = this.grounded ? 0 : this.airTime + h;
    this.outline();
  }

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

/**
 * Two trucks' bodies against each other (separating axes on the two boxes): pushed apart along the axis of least
 * overlap with an impulse at the touching corners. The truck hitting with its front ram pushes harder; armour soaks.
 * Returns the closing speed (for sounds and effects), or 0 when they don't touch.
 */
export function collideTrucks(A: Truck, B: Truck): number {
  const dx0 = A.x - B.x, dy0 = A.y - B.y;
  if (dx0 * dx0 + dy0 * dy0 > 25) return 0;
  const av = A.bv, an = A.bn, bv = B.bv, bn = B.bn;
  let best = Infinity, mx = 0, my = 0;
  for (let k = 0; k < 4; k++) {
    const ax = k < 2 ? an[k * 2] : bn[(k - 2) * 2], ay = k < 2 ? an[k * 2 + 1] : bn[(k - 2) * 2 + 1];
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (let c = 0; c < 4; c++) {
      const da = av[c * 2] * ax + av[c * 2 + 1] * ay, db = bv[c * 2] * ax + bv[c * 2 + 1] * ay;
      if (da < minA) minA = da; if (da > maxA) maxA = da; if (db < minB) minB = db; if (db > maxB) maxB = db;
    }
    const ov = (maxA < maxB ? maxA : maxB) - (minA > minB ? minA : minB);
    if (ov <= 0) return 0;
    if (ov < best) { best = ov; mx = ax; my = ay; }
  }
  // the normal points from B to A
  if (dx0 * mx + dy0 * my < 0) { mx = -mx; my = -my; }
  // the contact point: the middle of the overlap (the average of the corners inside the other box)
  let cx = 0, cy = 0, cn = 0;
  for (let c = 0; c < 4; c++) {
    if (inside(av[c * 2], av[c * 2 + 1], bv, bn)) { cx += av[c * 2]; cy += av[c * 2 + 1]; cn++; }
    if (inside(bv[c * 2], bv[c * 2 + 1], av, an)) { cx += bv[c * 2]; cy += bv[c * 2 + 1]; cn++; }
  }
  if (cn === 0) { cx = (A.x + B.x) / 2; cy = (A.y + B.y) / 2; } else { cx /= cn; cy /= cn; }
  const rax = cx - A.x, ray = cy - A.y, rbx = cx - B.x, rby = cy - B.y;
  const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax, vbx = B.vx - B.w * rby, vby = B.vy + B.w * rbx;
  const vn = (vax - vbx) * mx + (vay - vby) * my;
  // position: split the overlap
  const fixA = Math.min(best, 0.3) * 0.5;
  A.x += mx * fixA * (B.M / (A.M + B.M)) * 2; A.y += my * fixA * (B.M / (A.M + B.M)) * 2;
  B.x -= mx * fixA * (A.M / (A.M + B.M)) * 2; B.y -= my * fixA * (A.M / (A.M + B.M)) * 2;
  for (let i = 0; i < 2; i++) {
    A.wx[i] += mx * fixA * (B.M / (A.M + B.M)) * 2; A.wy[i] += my * fixA * (B.M / (A.M + B.M)) * 2;
    B.wx[i] -= mx * fixA * (A.M / (A.M + B.M)) * 2; B.wy[i] -= my * fixA * (A.M / (A.M + B.M)) * 2;
  }
  if (vn >= 0) return 0;
  const ran = rax * my - ray * mx, rbn = rbx * my - rby * mx;
  const kn = 1 / A.M + 1 / B.M + (ran * ran) / A.I + (rbn * rbn) / B.I;
  const j = (-(1 + 0.2) * vn) / kn;
  // who is ramming whom: the truck whose front faces the other
  const aFront = (Math.cos(A.a) * -dx0 + Math.sin(A.a) * -dy0) > 0, bFront = (Math.cos(B.a) * dx0 + Math.sin(B.a) * dy0) > 0;
  const ja = j * (bFront ? B.spec.ram : 1) * (1 - A.spec.armor * 0.6);
  const jb = j * (aFront ? A.spec.ram : 1) * (1 - B.spec.armor * 0.6);
  A.vx += (ja * mx) / A.M; A.vy += (ja * my) / A.M; A.w += (ran * ja) / A.I;
  B.vx -= (jb * mx) / B.M; B.vy -= (jb * my) / B.M; B.w -= (rbn * jb) / B.I;
  for (let i = 0; i < 2; i++) { A.wvx[i] += (ja * mx) / A.M; A.wvy[i] += (ja * my) / A.M; B.wvx[i] -= (jb * mx) / B.M; B.wvy[i] -= (jb * my) / B.M; }
  A.bump = Math.max(A.bump, -vn); B.bump = Math.max(B.bump, -vn);
  return -vn;
}
function inside(px: number, py: number, v: Float64Array, n: Float64Array) {
  for (let e = 0; e < 4; e++) if ((px - v[e * 2]) * n[e * 2] + (py - v[e * 2 + 1]) * n[e * 2 + 1] > 0) return false;
  return true;
}
