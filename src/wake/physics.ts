// Boat physics for Wake Racers: arcade water handling with real weight. The hull pushes along its heading, water
// drag pulls it back, and the sideways slide decays with the boat's grip — so a hard turn at speed swings the tail
// out and carries you wide (brake + steer for a deliberate power slide). Ramps and waterfall lips throw the boat into
// the air, gravity brings it down with a splash, rapids push and bounce, whirlpools drag you round, boost pads kick.
// The lane's banks and quay walls, the islands, the hazards and the other boats all push back. Fixed 120 Hz steps;
// no allocation per step. Shared by the game, the rivals and the QA bot in Node.
import { clamp, TAU } from "./util";
import { DS, locate, lowerBound, place, PRE, waterAt, halfWidthAt, type Course, type Obstacle } from "./course";
import type { Tuned } from "./boats";

export const STEP = 1 / 120;
export const GRAVITY = 21;

export interface Input { steer: number; throttle: number; brake: number; boost: boolean; jump: boolean }
export const newInput = (): Input => ({ steer: 0, throttle: 0, brake: 0, boost: false, jump: false });

export type HitKind = "wall" | "obstacle" | "boat" | "island";
/** light things a boat knocks aside instead of stopping against */
export const SOFT = new Set<string>(["buoy", "barrel", "crate"]);
export interface PhysEvents {
  land?: (b: Boat, impact: number, air: number) => void;
  hit?: (b: Boat, kind: HitKind, strength: number, o: Obstacle | null) => void;
  pad?: (b: Boat) => void;
  launch?: (b: Boat, vy: number) => void;
  nearMiss?: (b: Boat, o: Obstacle) => void;
}

export class Boat {
  x = 0; z = 0; y = 0;
  vx = 0; vz = 0; vy = 0;
  heading = 0; yaw = 0;
  /** where on the course */
  i = 0; s = 0; d = 0;
  grounded = true; air = 0; lastAir = 0;
  /** forward and sideways speed (m/s) */
  fwd = 0; lat = 0;
  /** seconds of boost left (pads, nitro, turbo) and how hard */
  boostT = 0; boostK = 1;
  /** the engine has fuel */
  engine = true;
  /** powers that change the physics */
  ghost = 0; jumpCd = 0; stun = 0;
  drifting = false;
  /** the current under the hull (rapids, waterfalls) */
  current = 0;
  /** visual attitude */
  pitch = 0; roll = 0; bounce = 0;
  /** speed cap multiplier (rivals' pace, fuel out) */
  capK = 1;
  private pts = { x: 0, z: 0 };
  private loc = { i: 0, s: 0, d: 0 };
  private near = new Uint8Array(0);

  constructor(public spec: Tuned, readonly id: number) {}

  get speed() { return Math.hypot(this.vx, this.vz); }

  /** put the boat on the course at (s, d), facing along it, at rest */
  placeAt(c: Course, s: number, d: number) {
    place(c, s, d, this.pts);
    this.x = this.pts.x; this.z = this.pts.z;
    const i = Math.round((s + PRE) / DS);
    this.heading = Math.atan2(c.tx[i], c.tz[i]);
    this.y = waterAt(c, s);
    this.vx = this.vz = this.vy = 0; this.yaw = 0; this.grounded = true; this.air = 0;
    this.boostT = 0; this.stun = 0; this.ghost = 0;
    locate(c, this.x, this.z, i, this.loc);
    this.i = this.loc.i; this.s = this.loc.s; this.d = this.loc.d;
    if (this.near.length !== c.obstacles.length) this.near = new Uint8Array(c.obstacles.length);
  }

  /** the surface under the hull: the water, or a ramp */
  groundAt(c: Course) {
    let g = waterAt(c, this.s);
    for (let k = lowerBound(c.rampS, this.s - 20); k < c.ramps.length && c.rampS[k] <= this.s; k++) {
      const r = c.ramps[k];
      if (this.s < r.s || this.s > r.s + r.len || Math.abs(this.d - r.d) > r.w) continue;
      g = Math.max(g, waterAt(c, r.s) + (r.h * (this.s - r.s)) / r.len);
    }
    return g;
  }

  step(c: Course, inp: Input, ev: PhysEvents, h = STEP) {
    const sp = this.spec;
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    // forward = (sin, cos), right = (−cos, sin)
    let fwd = this.vx * sin + this.vz * cos;
    let lat = -this.vx * cos + this.vz * sin;
    if (this.jumpCd > 0) this.jumpCd -= h;
    if (this.stun > 0) this.stun -= h;
    if (this.ghost > 0) this.ghost -= h;
    if (this.boostT > 0) this.boostT -= h;
    const boosting = this.boostT > 0;
    const stunned = this.stun > 0;

    if (this.grounded) {
      // ---- on the water
      const top = (sp.top + (boosting ? sp.boost * this.boostK : 0)) * this.capK * (this.engine ? 1 : 0);
      const thr = stunned ? 0 : this.engine ? inp.throttle : 0;
      let a = 0;
      if (fwd < top) a += (sp.accel + (boosting ? 9 : 0)) * thr * (1 - Math.max(0, fwd / Math.max(1, top)) ** 2) * (fwd < 0 ? 1.4 : 1);
      else a -= (fwd - top) * 1.4;
      if (boosting && fwd < top) a += 6;
      if (inp.brake > 0 && !stunned) {
        if (fwd > 0.6) a -= inp.brake * (this.drifting ? 5 : 13);
        else if (fwd > -7) a -= inp.brake * 5; // reverse
      }
      // water drag: light under power (so top speed is the boat's real top speed), strong when coasting
      a -= fwd * (thr < 0.05 ? 0.3 : 0.012);
      fwd += a * h;
      // steering: full bite from walking pace up, a little less at top speed; reversed when going backwards
      // (a hull can pivot slowly even at walking pace: the prop wash turns it)
      const bite = clamp(0.3 + Math.abs(fwd) / 10, 0, 1) * (1 - 0.18 * clamp((fwd - 26) / 18, 0, 1)) * (fwd < -0.5 ? -1 : 1);
      this.drifting = inp.brake > 0.3 && Math.abs(inp.steer) > 0.3 && fwd > 14 && !stunned;
      const turn = sp.turn * (this.drifting ? 1.35 : 1);
      const want = stunned ? this.yaw * 0.98 : -inp.steer * turn * bite;
      this.yaw += (want - this.yaw) * (1 - Math.exp(-7 * h));
      // the slide dies away with the hull's grip (a power slide keeps more of it)
      const grip = sp.grip * (this.drifting ? 0.42 : 1) * (boosting ? 0.85 : 1);
      const kept = Math.exp(-grip * h);
      // sliding sideways scrubs speed
      fwd -= Math.abs(lat) * (1 - kept) * 0.22;
      lat *= kept;
      // currents: rapids and the run to a waterfall push you along
      fwd += this.current * h;
      if (inp.jump && this.jumpCd <= 0 && !stunned) {
        this.vy = sp.jump; this.grounded = false; this.air = 0; this.jumpCd = 0.9;
        ev.launch?.(this, sp.jump);
      }
    } else {
      // ---- in the air: no grip, light drag, a little steering
      this.yaw += (-inp.steer * sp.turn * 0.35 - this.yaw) * (1 - Math.exp(-3 * h));
      fwd *= 1 - 0.02 * h;
      lat *= 1 - 0.4 * h;
    }
    // the velocity stays where it was in the world while the hull turns under it: that's the slide
    this.vx = fwd * sin - lat * cos;
    this.vz = fwd * cos + lat * sin;
    this.fwd = fwd; this.lat = lat;
    this.heading += this.yaw * h;
    if (this.heading > Math.PI) this.heading -= TAU; else if (this.heading < -Math.PI) this.heading += TAU;

    // whirlpools pull you in and round
    for (const w of c.whirls) {
      const dx = w.x - this.x, dz = w.z - this.z, D = Math.hypot(dx, dz);
      if (D > w.r * 1.6 || !this.grounded) continue;
      const k = 1 - D / (w.r * 1.6), ux = dx / (D + 1e-3), uz = dz / (D + 1e-3);
      this.vx += (ux * 9 - uz * 7) * k * h; this.vz += (uz * 9 + ux * 7) * k * h;
      const drag = 1 - 0.9 * k * h; this.vx *= drag; this.vz *= drag;
    }

    this.x += this.vx * h; this.z += this.vz * h;
    locate(c, this.x, this.z, this.i, this.loc);
    this.i = this.loc.i; this.s = this.loc.s; this.d = this.loc.d;

    // ---- vertical: follow the water and ramps, fly off their ends
    const g = this.groundAt(c);
    if (this.grounded) {
      if (g >= this.y - 0.7) {
        // climbing a ramp: the lift comes from the slope at our speed (never more, even onto a ramp's side)
        const vy = Math.min((g - this.y) / h, Math.max(0, this.fwd) * 0.42 + 1);
        this.y = g;
        this.vy = vy > 0 ? vy : 0;
      } else {
        // the surface fell away (a ramp's lip, a waterfall): we're flying, with the speed we had going up
        this.grounded = false; this.air = 0;
        ev.launch?.(this, this.vy);
      }
    } else {
      this.air += h;
      this.vy -= GRAVITY * h;
      this.y += this.vy * h;
      if (this.y <= g) {
        const impact = -this.vy;
        this.y = g; this.vy = 0; this.grounded = true; this.lastAir = this.air;
        ev.land?.(this, impact, this.air);
        this.air = 0;
        this.bounce = Math.min(1, impact / 14);
      }
    }

    this.collideLane(c, ev);
    if (this.ghost <= 0) this.collideObstacles(c, ev);
    this.attitude(h, inp);
  }

  private collideLane(c: Course, ev: PhysEvents) {
    const R = this.spec.rad;
    const hw = halfWidthAt(c, this.s);
    let push = 0;
    if (this.d > hw - R) push = hw - R - this.d;
    else if (this.d < -hw + R) push = -hw + R - this.d;
    let kind: HitKind = "wall";
    // islands split the lane: push to the nearer side
    if (!push) {
      for (const is of c.islands) {
        if (this.s < is.s0 || this.s > is.s1) continue;
        const u = (this.s - is.s0) / (is.s1 - is.s0), half = is.w * Math.pow(Math.sin(Math.PI * u), 0.6);
        const k = this.d - is.d;
        if (Math.abs(k) < half + R && this.y < waterAt(c, this.s) + 2.5) { push = (k >= 0 ? 1 : -1) * (half + R) - k; kind = "island"; }
      }
    }
    if (!push) return;
    const i = Math.round(this.i), nx = -c.tz[i], nz = c.tx[i]; // right normal
    this.x += nx * push; this.z += nz * push; this.d += push;
    // take away the speed into the wall, plus a scrape
    const into = (this.vx * nx + this.vz * nz) * -Math.sign(push);
    if (into > 0) {
      const k = into * 1.25 * -Math.sign(push);
      this.vx -= nx * k; this.vz -= nz * k;
      const scrape = 1 - Math.min(0.35, into * 0.02);
      this.vx *= scrape; this.vz *= scrape;
      if (into > 2) ev.hit?.(this, kind, into, null);
    }
  }

  private seg = { x: 0, z: 0 };
  private collideObstacles(c: Course, ev: PhysEvents) {
    const R = this.spec.rad;
    const list = c.obstacles;
    // only the hazards near the hull (the list is sorted along the course), plus the boats that cruise all of it
    const k0 = lowerBound(c.obstS, this.s - 24);
    const kEnd = lowerBound(c.obstS, this.s + 24);
    for (let q = k0, n = kEnd - k0 + c.roam.length; q < k0 + n; q++) {
      const k = q < kEnd ? q : c.roam[q - kEnd];
      const o = list[k];
      if (!o.alive || Math.abs(o.s - this.s) > 14 + o.hl) continue;
      if (this.y - o.y > o.h) { this.near[k] = 0; continue; }
      // closest point on the obstacle's axis
      let cx = o.x, cz = o.z;
      if (o.hl > 0) {
        const i = Math.round((o.s + PRE) / DS), t = Math.atan2(c.tx[Math.min(c.count - 1, Math.max(0, i))], c.tz[Math.min(c.count - 1, Math.max(0, i))]) + o.ang;
        const ax = Math.sin(t), az = Math.cos(t);
        const u = clamp((this.x - o.x) * ax + (this.z - o.z) * az, -o.hl, o.hl);
        cx = o.x + ax * u; cz = o.z + az * u;
      }
      const dx = this.x - cx, dz = this.z - cz, D = Math.hypot(dx, dz), min = o.r + R;
      if (D >= min) {
        // a near miss: passed close at speed without touching
        if (D < min + 2.2 && this.fwd > 18 && o.damage) { if (!this.near[k]) { this.near[k] = 1; ev.nearMiss?.(this, o); } }
        continue;
      }
      const nx = D > 1e-4 ? dx / D : 1, nz = D > 1e-4 ? dz / D : 0;
      // light things (buoys, barrels, crates) get knocked flying: a small price in speed, no wall
      if (SOFT.has(o.kind)) {
        o.alive = false; o.knockX = -nx * Math.max(4, this.speed * 0.6) + this.vx * 0.4; o.knockZ = -nz * Math.max(4, this.speed * 0.6) + this.vz * 0.4;
        this.vx *= 0.88; this.vz *= 0.88;
        ev.hit?.(this, "obstacle", 0, o);
        continue;
      }
      this.x = cx + nx * min; this.z = cz + nz * min;
      const into = -(this.vx * nx + this.vz * nz);
      if (into > 0) {
        const bounce = o.explode ? 1.8 : 1.35;
        // glance off: keep (and add a little) sideways speed round the hazard, so a boat never sticks head-on
        const tx = -nz, tz = nx;
        let side = this.vx * tx + this.vz * tz;
        if (Math.abs(side) < 2) side = (dx * tx + dz * tz >= 0 ? 1 : -1) * 2 + side;
        this.vx += tx * Math.sign(side) * into * 0.45; this.vz += tz * Math.sign(side) * into * 0.45;
        this.vx += nx * into * bounce; this.vz += nz * into * bounce;
        const keep = o.explode ? 0.45 : o.damage ? 0.6 : 0.82;
        this.vx *= keep; this.vz *= keep;
        if (o.explode) { this.vy = 7; this.grounded = false; this.air = 0; }
        ev.hit?.(this, "obstacle", into, o);
      }
    }
  }

  private attitude(h: number, inp: Input) {
    // the bow lifts as the hull gets on the plane, dips when braking; leans into turns; nose follows the arc in the air
    const plane = clamp(this.fwd / 20, 0, 1) * (1 - clamp((this.fwd - 24) / 30, 0, 0.5));
    let pitchT = this.grounded ? 0.09 * plane - inp.brake * 0.05 * clamp(this.fwd / 10, 0, 1) + (this.boostT > 0 ? 0.04 : 0) : clamp(this.vy * 0.035, -0.5, 0.35);
    if (this.grounded && this.vy > 0.5) pitchT = clamp(this.vy * 0.05, 0, 0.35);
    this.pitch += (pitchT - this.pitch) * (1 - Math.exp(-6 * h));
    const rollT = clamp(this.yaw * this.fwd * 0.012, -0.32, 0.32) + clamp(this.lat * 0.02, -0.15, 0.15);
    this.roll += (rollT - this.roll) * (1 - Math.exp(-5 * h));
    this.bounce *= Math.exp(-4 * h);
  }
}

/** boats bump each other (heavier boats push harder) */
export function collideBoats(a: Boat, b: Boat, ev: PhysEvents) {
  if (a.ghost > 0 || b.ghost > 0) return;
  if (Math.abs(a.y - b.y) > 1.6) return;
  const dx = b.x - a.x, dz = b.z - a.z, D = Math.hypot(dx, dz), min = a.spec.rad + b.spec.rad;
  if (D >= min || D < 1e-4) return;
  const nx = dx / D, nz = dz / D, over = min - D;
  const ma = a.spec.mass, mb = b.spec.mass, ta = mb / (ma + mb), tb = ma / (ma + mb);
  a.x -= nx * over * ta; a.z -= nz * over * ta; b.x += nx * over * tb; b.z += nz * over * tb;
  const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rel < 0) {
    const j = -rel * 1.3;
    a.vx -= nx * j * ta; a.vz -= nz * j * ta; b.vx += nx * j * tb; b.vz += nz * j * tb;
    if (-rel > 2.5) { ev.hit?.(a, "boat", -rel, null); ev.hit?.(b, "boat", -rel, null); }
  }
}
