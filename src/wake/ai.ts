// The drivers: the rivals on the water, and the same brain driving your boat for the QA sweep and the home-screen
// demo. Each one aims at a point ahead on the racing line (plus its own favourite offset, so the pack spreads out),
// swerves round hazards it can see coming, slows for tight bends, saves nitro for straights, hops logs and debris,
// and — for the player bot — goes out of its way for oil cans when the tank is low, hearts when hurt and power boxes.
import { clamp, angDiff } from "./util";
import { DS, PRE, place, halfWidthAt, predict, lowerBound, type Course, type Item } from "./course";
import { SOFT, type Boat, type Input } from "./physics";

export interface DriverNeeds { fuel01: number; hearts: number; nitro: number; hasPower: boolean }

export class Driver {
  /** 0..1: how cleanly it drives (avoidance, braking points, nitro use) */
  skill: number;
  /** favourite lateral offset (m) */
  bias: number;
  /** for the player bot: go after items */
  collector = false;
  /** for the player bot in a docking event: the berth to stop in */
  dock: { s: number; d: number; len: number } | null = null;
  private p = { x: 0, z: 0 };
  private dodge = 0;
  private wantD = 0;
  private reverseT = 0;
  private boosting = false;
  private progT = 0; private progS = -1e9; private flip = 0; private flipSide = 1;
  private aimS = 0; private dodgeBrake = 0;
  private iv: number[] = [];
  private lo: number[] = [];
  private hi: number[] = [];

  constructor(skill: number, bias: number) { this.skill = skill; this.bias = bias; }

  private pr = { s: 0, d: 0 };
  drive(c: Course, b: Boat, out: Input, needs: DriverNeeds | null, dt: number, t = 0) {
    const v = Math.max(0, b.fwd);
    const i = Math.round(b.i);
    out.jump = false;
    const look = 10 + v * (0.5 + 0.15 * this.skill);
    const sAhead = b.s + look;
    const ia = clamp(Math.round((sAhead + PRE) / DS), 0, c.count - 1);
    const hw = halfWidthAt(c, sAhead);
    let target = c.line[ia] + this.bias * clamp(hw / 18, 0.4, 1);

    // ---- islands: pick a side early (the racing line's), then stay on the side you're on
    for (const is of c.islands) {
      if (b.s > is.s1 + 5 || sAhead < is.s0 - 25) continue;
      const lineSide = Math.sign(c.line[ia] - is.d) || 1, mySide = Math.sign(b.d - is.d) || 1;
      const side = b.s > is.s0 - 18 ? mySide : lineSide;
      let half = 0;
      for (let q = 0; q <= 4; q++) {
        const u = clamp((b.s + (look * q) / 4 - is.s0) / (is.s1 - is.s0), 0, 1);
        half = Math.max(half, is.w * Math.pow(Math.sin(Math.PI * u), 0.6));
      }
      const hwA = halfWidthAt(c, clamp(sAhead, is.s0, is.s1));
      target = side > 0 ? (is.d + half + hwA) / 2 : (is.d - half - hwA) / 2;
    }

    // ---- items worth a detour (player bot)
    if (this.collector && needs) {
      let best: Item | null = null, bs = 0;
      for (let k = lowerBound(c.itemS, b.s + 8); k < c.items.length && c.itemS[k] <= b.s + 70; k++) {
        const it = c.items[k];
        if (it.taken) continue;
        const want = it.kind === "fuel" ? (needs.fuel01 < 0.6 ? 8 : 1.2) : it.kind === "heart" ? (needs.hearts < 3 ? 4 : 0.5) : it.kind === "box" ? (needs.hasPower ? 0.2 : 1.5) : Math.abs(it.d - target) < 3.5 ? 0.5 : 0;
        const sc = want / (1 + Math.abs(it.d - target) * 0.2 + (it.s - b.s) * 0.02);
        const across = c.islands.some((is) => it.s > is.s0 - 10 && it.s < is.s1 + 10 && Math.sign(it.d - is.d) !== Math.sign(target - is.d));
        if (sc > bs && !across && Math.abs(it.d) < halfWidthAt(c, it.s) - 1.5) { bs = sc; best = it; }
      }
      if (best && bs > 0.12) target = best.d;
    }

    // ---- hazards ahead: find the nearest group of them and steer for the best gap through it
    const R = b.spec.rad + 1.2 + (1 - this.skill) * 0.6;
    let blocked = false;
    const reach = 20 + v * 1.35 * (0.6 + 0.4 * this.skill);
    const iv = this.iv; iv.length = 0;
    let firstS = 1e9;
    const k0 = lowerBound(c.obstS, b.s - 8), kEnd = lowerBound(c.obstS, b.s + reach + 14);
    for (let q = k0, n = kEnd - k0 + c.roam.length; q < k0 + n; q++) {
      const o = c.obstacles[q < kEnd ? q : c.roam[q - kEnd]];
      if (!o.alive || (SOFT.has(o.kind) && this.skill < 0.7)) continue;
      // where will it be when we get there? (moving ones follow their clock; widen a little for the guess)
      let os = o.s, od = o.d, swing = 0;
      if (o.motion !== "none") {
        const closing = Math.max(4, v - (o.motion === "cruise" ? o.speed : 0));
        const eta = clamp((o.s - b.s) / closing, 0, 4);
        predict(c, o, t + eta, this.pr);
        os = this.pr.s; od = this.pr.d;
        swing = o.motion === "cross" || o.motion === "sway" ? 2.5 : 1;
      }
      // (include what's right alongside: pushing against a rock means we must steer round it, not into it)
      if (os < b.s - 2.5 || os > b.s + reach) continue;
      // can we hop it?
      if (o.h < 1 && this.skill > 0.5 && os - b.s < 7 + v * 0.18 && v > 10 && Math.abs(b.d - od) < o.r + o.hl + R) { out.jump = true; continue; }
      const ext = o.r + o.hl * Math.abs(Math.sin(o.ang)) + R + swing;
      iv.push(os, od - ext, od + ext);
      const atD = lerpTo(b.d, target, clamp((os - b.s) / look, 0, 1));
      if (Math.abs(atD - od) < ext && os < firstS) firstS = os;
    }
    if (firstS < 1e9) {
      blocked = true;
      // everything within 12 m of the first blocker counts as one wall with gaps
      const ow = halfWidthAt(c, firstS) - b.spec.rad - 0.8;
      const lo = this.lo, hi = this.hi; lo.length = 0; hi.length = 0;
      for (let k = 0; k < iv.length; k += 3) if (Math.abs(iv[k] - firstS) < 12) { lo.push(iv[k + 1]); hi.push(iv[k + 2]); }
      // sort intervals by start (tiny lists: insertion sort, no allocation)
      for (let a = 1; a < lo.length; a++) for (let q = a; q > 0 && lo[q] < lo[q - 1]; q--) { let tt = lo[q]; lo[q] = lo[q - 1]; lo[q - 1] = tt; tt = hi[q]; hi[q] = hi[q - 1]; hi[q - 1] = tt; }
      let best = target, bestCost = 1e9, edge = -ow;
      const tryGap = (g0: number, g1: number) => {
        if (g1 - g0 < 0.4) return;
        const p = clamp(target, g0 + 0.2, g1 - 0.2), cost = Math.abs(p - target) + Math.abs(p - b.d) * 0.3 + (this.flip && Math.sign(p - b.d) === this.flipSide ? 30 : 0);
        if (cost < bestCost) { bestCost = cost; best = p; }
      };
      for (let a = 0; a < lo.length; a++) { tryGap(edge, Math.min(ow, lo[a])); edge = Math.max(edge, hi[a]); }
      tryGap(edge, ow);
      if (!this.flip) this.flipSide = Math.sign(best - b.d) || 1;
      target = best;
      this.dodge = 0.5;
      // aim at the gap itself (a point far beyond it would cut the corner through the hazard)
      this.aimS = Math.max(b.s + 5, Math.min(sAhead, firstS + 2));
      // not enough room to swing across to it at this speed? brake (a careful driver's instinct)
      const shift = Math.abs(best - b.d), room = Math.max(1, firstS - b.s);
      const reachK = (0.32 + 0.1 * this.skill) * clamp(28 / Math.max(1, v), 0.55, 1);
      this.dodgeBrake = shift > room * reachK ? clamp((shift / room - reachK) * 2.5, 0, 1) : 0;
    } else { this.aimS = sAhead; this.dodgeBrake = 0; }
    for (const w of c.whirls) {
      if (w.s < b.s - 5 || w.s > b.s + reach) continue;
      const ext = w.r * 1.25 + 2;
      if (Math.abs(target - w.d) < ext) target = w.d + (target >= w.d ? ext : -ext);
    }
    this.dodge -= dt;
    target = clamp(target, -hw + b.spec.rad + 1, hw - b.spec.rad - 1);
    this.wantD += (target - this.wantD) * clamp(dt * (3 + 3 * this.skill), 0, 1);

    // ---- steer: pursue the point ahead
    // (aim the boat's actual direction of travel — it slides — and damp the turn so it doesn't weave)
    // (when dodging, ease straight to the new line — no lag — so the aim point really is beside the hazard)
    if (blocked) this.wantD += (target - this.wantD) * clamp(dt * 8, 0, 1);
    place(c, this.aimS, this.wantD, this.p);
    const want = Math.atan2(this.p.x - b.x, this.p.z - b.z);
    const moving = Math.hypot(b.vx, b.vz) > 5;
    const dir = moving ? Math.atan2(b.vx, b.vz) : b.heading;
    const err = angDiff(dir, want);
    out.steer = clamp(-err * (1.7 + 0.6 * this.skill) + b.yaw * 0.42, -1, 1);

    // ---- docking: line up with the berth and come to a stop inside it
    if (this.dock) {
      const dk = this.dock, ahead = dk.s - b.s;
      if (ahead < 140) {
        this.wantD += (dk.d - this.wantD) * clamp(dt * 3, 0, 1);
        place(c, Math.max(dk.s, b.s + 6), dk.d, this.p);
        const w2 = Math.atan2(this.p.x - b.x, this.p.z - b.z);
        out.steer = clamp(-angDiff(moving ? Math.atan2(b.vx, b.vz) : b.heading, w2) * 2.2 + b.yaw * 0.4, -1, 1);
        const vWant = ahead > 0 ? Math.sqrt(2 * 4.5 * ahead) : 0;
        out.throttle = v < vWant - 1 ? 1 : v < vWant ? 0.3 : 0;
        out.brake = v > vWant + 1 || ahead < 1.5 ? 1 : 0;
        if (ahead < -dk.len / 2) { out.throttle = 0; out.brake = 1; }
        out.boost = false;
        return;
      }
    }

    // ---- pace: slow for tight bends ahead (and for the cap the race gives rivals)
    let pace = 1e9;
    for (let j = i; j < Math.min(c.count, i + Math.round((20 + v * 1.2) / DS)); j += 2) pace = Math.min(pace, c.pace[j] * (1.05 + 0.3 * this.skill));
    const tooFast = v - pace;
    out.throttle = tooFast > 1.5 ? 0.2 : 1;
    out.brake = tooFast > 4 ? clamp((tooFast - 4) / 6, 0, 1) : 0;
    if (blocked && this.skill < 0.6 && v > 20) out.throttle = 0.6;
    if (this.dodgeBrake > 0 && v > 9) { out.throttle = Math.min(out.throttle, 1 - this.dodgeBrake); out.brake = Math.max(out.brake, this.dodgeBrake * 0.8); }
    // a big steering error at speed (overshooting): ease off
    if (Math.abs(err) > 0.7 && v > 14) { out.throttle = 0.3; out.brake = 0.3; }

    // ---- nitro on straights, when lined up
    // (fire it in one go: start with a good tank, stop when it's spent or the line bends)
    const lined = Math.abs(err) < 0.14 && pace > v + 5 && this.skill > 0.3 && !!needs && !blocked && this.dodge <= 0;
    if (!this.boosting && lined && needs!.nitro > 0.5) this.boosting = true;
    if (this.boosting && (!lined || !needs || needs.nitro < 0.06)) this.boosting = false;
    out.boost = this.boosting;

    // ---- facing the wrong way (spun by a crash): turn round under power, never "reverse" down the course
    const ci = clamp(Math.round(b.i), 0, c.count - 1);
    const headErr = angDiff(b.heading, Math.atan2(c.tx[ci], c.tz[ci]));
    if (Math.abs(headErr) > 1.7) {
      out.steer = headErr > 0 ? -1 : 1; out.throttle = 0.7; out.brake = 0; out.boost = false;
      this.reverseT = 0;
      return;
    }

    // ---- stuck (no headway for a while): back off, turning away, then try the other side
    if (this.reverseT > 0) {
      this.reverseT -= dt; out.throttle = 0; out.brake = 1; out.steer = -out.steer; out.boost = false;
      if (this.reverseT <= 0) { this.progT = 0; this.progS = b.s; }
    } else {
      this.progT += dt;
      if (this.progT > 2.4) {
        if (b.s - this.progS < 4) { this.reverseT = 1; this.flip = this.flip ? 0 : 1; }
        this.progT = 0; this.progS = b.s;
      }
    }
  }
}

const lerpTo = (a: number, b: number, t: number) => a + (b - a) * t;
