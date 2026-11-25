// The test driver. It drives a course with the real physics, the way a careful player would: it reads the hints each
// module left (hold 7 m/s for this jump, crawl over these bumps, wait for the lift, time the wrecking ball), keeps its
// nose down when a wheelie starts, and in the air steers the car's spin to land on its wheels. The QA sweep
// (scripts/gizmo_sweep.mjs) runs it on every stage to prove each one can be finished — and runs a careless driver
// (full gas, always) to prove skill matters. The home screen uses it too: the car drives the stage behind the menu.
import { Car, STEP, World, type Pedals } from "./physics";
import type { Course, Hint } from "./course";
import { topSpeed } from "./vehicles";
import { clamp } from "./util";

const SPEED_TRY = [1, 1.07, 0.95, 1.13, 0.9, 1.2];
const CAP_TRY = [1, 0.85, 1.1, 0.75, 1, 0.65];

export class Bot {
  careless = false;
  /** failed tries at the current stretch: each one changes the approach a little */
  tries = 0;
  private state = 0;
  /** the speed of what the car stands on while it holds still (a moving platform) */
  private surface = 0;
  /** in a flat-out zone (a loop, a crumbling bridge): never lift */
  private fullGas = false;
  private active: Hint | null = null;
  private V: number;
  private carH: number;
  constructor(public course: Course) {
    const v = course.vehicle;
    this.V = topSpeed(v);
    this.carH = v.head.y + v.head.r - v.anchors[0][1] + v.wheels[0].rest + v.wheels[0].r;
  }
  reset() { this.state = 0; this.active = null; }

  drive(car: Car, p: Pedals) {
    if (this.careless) { p.gas = 1; p.brake = 0; return; }
    const c = this.course;
    if (!car.grounded) { this.air(car, p); return; }
    let cap = Infinity, want = Math.min(this.V * 0.72, 8.5);
    this.fullGas = false;
    let special: Hint | null = null;
    for (const h of c.hints) {
      // slow down in time for a crawl ahead
      if ((h.k === "cap" || h.k === "speed") && h.x0 > car.x && h.x0 - car.x < 30) cap = Math.min(cap, Math.sqrt(h.v * h.v + 2 * 3.2 * (h.x0 - car.x)));
      if (car.x < h.x0 || car.x >= h.x1) continue;
      if (h.k === "cap") cap = Math.min(cap, h.v * CAP_TRY[this.tries % CAP_TRY.length]);
      else if (h.k === "go") { want = this.V * 1.2; this.fullGas = true; }
      else if (h.k === "speed") want = h.v * SPEED_TRY[this.tries % SPEED_TRY.length];
      else if (!special) special = h;
    }
    let target = Math.min(want, cap);
    if (special !== this.active) { this.active = special; this.state = 0; }
    if (special) {
      const t = this.special(special, car, target);
      if (t === null) { this.hold(car, p); this.surface = 0; return; }
      target = t;
    }
    this.speed(car, p, target);
  }

  /** the special hints: returns a target speed, or null to hold still */
  private special(h: Hint, car: Car, cruise: number): number | null {
    const w = this.course.physics;
    if (h.k === "ride") {
      const b = w.bodies[h.body];
      const ph = w.phaseOf(b);
      if (this.state === 0) {
        // up to the edge, then wait for the platform to arrive
        if (car.x < h.xWait - 0.25) return Math.min(4, Math.sqrt(2 * 1.8 * Math.max(0, h.xWait - car.x)));
        if (ph >= h.board[0] && ph <= h.board[1]) this.state = 1;
        else return null;
      }
      if (this.state === 1) {
        // on board, stop over its middle
        if (car.x < b.x - 0.9) return 3.6 + b.vx;
        this.state = 2;
      }
      if (this.state === 2) {
        if (ph >= h.leave[0] && ph <= h.leave[1]) this.state = 3;
        else { this.surface = b.vx; return null; }
      }
      return 4.5;
    }
    if (h.k === "gate") {
      const b = w.bodies[h.body];
      const open = b.trig >= 0 && w.t - b.trig > (b.motion?.period ?? 1) + 0.15;
      if (open) return cruise;
      if (car.x < h.xWait - 0.2) return Math.min(cruise, 4, Math.sqrt(2 * 1.8 * Math.max(0, h.xWait - car.x)));
      return null;
    }
    if (h.k === "timed") {
      if (this.state === 1 || car.x > h.xWait + 0.6) { this.state = 1; return h.v; }
      if (car.x < h.xWait - 0.25) return Math.min(cruise, Math.sqrt(2 * 1.8 * Math.max(0, h.xWait - car.x)));
      if (this.safe(h, car)) { this.state = 1; return h.v; }
      return null;
    }
    return cruise;
  }

  /** would a dash from here to the far side of the danger zone stay clear of the moving parts? */
  private safe(h: Extract<Hint, { k: "timed" }>, car: Car) {
    const w = this.course.physics;
    const L = this.course.vehicle.chassis.w;
    const gy = car.y - 0.9;
    const prof = this.profile(h.v);
    for (let i = 0; i < prof.length; i++) {
      const x = car.x + prof[i];
      if (x > h.xClear + 0.5) break;
      const T = w.t + i * PROF_DT;
      for (const id of h.bodies) {
        const b = w.bodies[id];
        const q = w.poseAt(b, T);
        const ca = Math.cos(q.a), sa = Math.sin(q.a);
        if (b.tag === "wrecker") {
          const bx = q.x + b.circ[0] * ca - b.circ[1] * sa, by = q.y + b.circ[0] * sa + b.circ[1] * ca, r = b.circ[2];
          const gapX = Math.abs(bx - x) - L / 2 - r, under = by - r - (gy + this.carH + 0.3);
          if (gapX < 0.7 && under < 0) return false;
        } else if (b.tag === "trapdoor") {
          // a trapdoor: no wheel may be on it while it hangs open
          const w2 = b.d.w ?? 2.5;
          if (x + L / 2 + 0.3 > q.x && x - L / 2 - 0.3 < q.x + w2 && Math.abs(q.a - b.a0) > 0.1) return false;
        } else {
          // a crusher: its bottom edge is the body's origin
          const half = (b.d.w ?? 2) / 2;
          if (Math.abs(q.x - x) < half + L / 2 + 0.6 && q.y < gy + this.carH + 0.5) return false;
        }
      }
    }
    return true;
  }

  /** how far this ride really gets from a standstill (driving at v), measured once on flat ground */
  private profiles = new Map<number, Float32Array>();
  private profile(v: number) {
    const key = Math.round(v * 10) / 10;
    let pr = this.profiles.get(key);
    if (pr) return pr;
    const w = new World();
    w.g = this.course.g;
    w.poly(w.bodies[0], [-5, 0, 200, 0, 200, -5, -5, -5], true);
    w.finalize();
    const car = new Car(this.course.vehicle);
    car.place(0, () => 0);
    const p = { gas: 0, brake: 0 };
    for (let k = 0; k < 120; k++) w.step(car, p);
    const x0 = car.x, n = Math.round(6 / PROF_DT), per = Math.round(PROF_DT / STEP);
    pr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pr[i] = car.x - x0;
      this.speed(car, p, key);
      for (let k = 0; k < per; k++) w.step(car, p);
    }
    this.profiles.set(key, pr);
    return pr;
  }

  private hold(car: Car, p: Pedals) {
    // no pedals: the engine holds the car; nudge back if it creeps forward
    p.gas = 0; p.brake = car.forward - this.surface > 0.25 ? 0.7 : 0;
  }

  private speed(car: Car, p: Pedals, target: number) {
    const f = car.forward;
    const err = target - f;
    p.gas = err > 0.25 ? 1 : err > -0.3 ? 0.3 : 0;
    p.brake = err < -0.45 ? clamp(-err / 2.5, 0.35, 1) : 0;
    // the nose is pitching up fast: ease off before it becomes a wheelie
    if (car.touch[0] && car.w > 0.9 && !this.fullGas) p.gas = 0;
    // wheelie: the front wheel is up and the nose keeps rising
    if (car.touch[0] && !car.touch[1] && car.since[1] > 0.12) {
      if (car.w > 0.2) p.gas = 0;
      if (car.w > 1.0) p.brake = 0.6;
      // a slow wheelie that has gone too far (easy in low gravity): brake to drop the nose
      const hl = this.course.heightAt(car.x - 1), hr = this.course.heightAt(car.x + 1);
      if (car.since[1] > 0.5 && Number.isFinite(hl) && Number.isFinite(hr) && car.a - Math.atan2(hr - hl, 2) > 0.5) { p.gas = 0; p.brake = 0.8; }
    }
    // nose-dive: the back wheel is up and the nose keeps dropping
    if (car.touch[1] && !car.touch[0] && car.since[0] > 0.12 && car.w < -0.4) { p.gas = 1; p.brake = 0; }
  }

  private air(car: Car, p: Pedals) {
    const c = this.course;
    // aim at the ground's angle where the car will land
    let tx = car.x + car.vx * 0.35;
    let h = c.heightAt(tx);
    if (Number.isFinite(h) && car.y - h > 2) {
      const dt = Math.sqrt((2 * (car.y - h)) / Math.max(1, c.g));
      tx = car.x + car.vx * Math.min(dt, 1.4);
      h = c.heightAt(tx);
    }
    const hl = c.heightAt(tx - 1), hr = c.heightAt(tx + 1);
    let target = Number.isFinite(hl) && Number.isFinite(hr) ? Math.atan2(hr - hl, 2) : 0;
    target = clamp(target, -0.6, 0.6);
    // inside a loop: let it be
    for (const lp of c.physics.loops) if (Math.abs(car.x - lp.cx) < lp.R + 1 && car.y < lp.cy + lp.R + 1 && car.y > lp.cy - lp.R - 1) { p.gas = 1; p.brake = 0; return; }
    let rel = car.a - target;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const want = -3 * rel, err = car.w - want;
    p.gas = err < -0.25 ? 1 : 0; p.brake = err > 0.25 ? 1 : 0;
    void h;
  }
}

const PROF_DT = 1 / 30;
/** sim seconds per bot decision (the sweep decides 60 times a second, like a player) */
export const BOT_DT = STEP * 4;
