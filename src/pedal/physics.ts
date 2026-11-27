// Obby Bike Blaster's bike, an arcade ride over the course's boxes and ramps: pedal to speed up, brake to slow down
// (and roll back), steer (sharper when slow), bunny-hop (a short grace time after leaving an edge, and a second hop
// with the Wings power), lean into turns and wheelie off ramps. Ice lets the bike slide sideways, belts push it,
// moving platforms carry it, jelly launches it, boost strips fire it forward, and walls stop it. No allocation per
// step: one bike, typed scratch values.
import type { Course, Piece } from "./course";
import { clamp, damp } from "./util";

export const STEP_UP = 0.42;
const BUCKET = 4;

/** the course, indexed by z for quick "what's under / in front of me" questions */
export class CourseWorld {
  readonly buckets = new Map<number, Piece[]>();
  constructor(readonly course: Course) {
    for (const p of course.pieces) this.index(p);
  }
  private index(p: Piece) {
    const span = p.move?.ax === 2 ? p.move.amp : p.spin ? p.spin.len : 0;
    const a = Math.floor((p.z0 - span - 1) / BUCKET), b = Math.floor((p.z1 + span + 1) / BUCKET);
    for (let k = a; k <= b; k++) { let l = this.buckets.get(k); if (!l) this.buckets.set(k, (l = [])); l.push(p); }
  }
  near(z: number) { return this.buckets.get(Math.floor(z / BUCKET)); }
  /** does a piece hold you up? */
  static stands(p: Piece) {
    if (!p.on) return p.kind === "laser" ? false : p.kind === "fall" ? p.t < 0.8 : false;
    return p.kind !== "kill" && p.kind !== "laser" && p.kind !== "spinner" && p.kind !== "hammer" && p.kind !== "target";
  }
  /** the top of a piece at (x, z), or −∞ if (x, z) is outside it */
  static topAt(p: Piece, x: number, z: number, pad = 0) {
    const x0 = p.x0 + p.dx - pad, x1 = p.x1 + p.dx + pad, z0 = p.z0 + p.dz - pad, z1 = p.z1 + p.dz + pad;
    if (x < x0 || x > x1 || z < z0 || z > z1) return -Infinity;
    if (p.ramp) {
      const t = clamp((z - (p.z0 + p.dz)) / (p.z1 - p.z0), 0, 1), lo = p.y0 + 1 + p.dy, hi = p.y1 + p.dy;
      return p.ramp > 0 ? lo + (hi - lo) * t : hi + (lo - hi) * t;
    }
    return p.y1 + p.dy;
  }
  /** the highest floor under (x, z) no higher than maxY */
  ground(x: number, z: number, maxY: number, out: { y: number; p: Piece | null }) {
    out.y = -Infinity; out.p = null;
    const l = this.near(z);
    if (!l) return out;
    for (const p of l) {
      if (!CourseWorld.stands(p)) continue;
      const t = CourseWorld.topAt(p, x, z, 0.12);
      if (t > out.y && t <= maxY) { out.y = t; out.p = p; }
    }
    return out;
  }
  /** a solid piece (a wall) at a point that is too tall to step onto from floor y */
  wallAt(x: number, y: number, z: number, floor: number): Piece | null {
    const l = this.near(z);
    if (!l) return null;
    for (const p of l) {
      if (!CourseWorld.stands(p) || p.ramp) continue;
      if (x < p.x0 + p.dx || x > p.x1 + p.dx || z < p.z0 + p.dz || z > p.z1 + p.dz) continue;
      if (y < p.y0 + p.dy || y > p.y1 + p.dy) continue;
      if (p.y1 + p.dy > floor + STEP_UP) return p;
    }
    return null;
  }
  /** for the debris: is a point inside anything solid? */
  solidAt(x: number, y: number, z: number) {
    const l = this.near(z);
    if (!l) return false;
    for (const p of l) if (CourseWorld.stands(p) && x >= p.x0 + p.dx && x <= p.x1 + p.dx && z >= p.z0 + p.dz && z <= p.z1 + p.dz && y >= p.y0 + p.dy && y <= p.y1 + p.dy) return true;
    return false;
  }
}

export interface BikeStats { speed: number; accel: number; jump: number; grip: number; turn: number }
export interface BikeInput { throttle: number; steer: number; jump: boolean }

const G = { y: 0, p: null as Piece | null };

export class Bike {
  x = 0; y = 0; z = 0; yaw = 0;
  /** forward speed along the heading, and the actual velocity on the ground plane (they differ on ice) */
  speed = 0; vx = 0; vz = 0; vy = 0;
  onGround = true; ground: Piece | null = null; coyote = 0; airT = 0; jumps = 0;
  // looks
  pitch = 0; lean = 0; wheel = 0; crank = 0; steerVis = 0; tuck = 0; land = 0;
  boostT = 0; slip = 0;
  /** events for sound and effects: set during a step, read and cleared by the game */
  ev = { jump: false, land: 0, bounce: false, boost: false, wall: false, double: false };
  private lastGround: Piece | null = null; private gdx = 0; private gdy = 0; private gdz = 0;

  place(x: number, y: number, z: number, yaw = 0) {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.speed = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.onGround = true; this.ground = null; this.lastGround = null;
    this.pitch = 0; this.lean = 0; this.boostT = 0; this.airT = 0; this.jumps = 0;
  }

  step(dt: number, inp: BikeInput, W: CourseWorld, st: BikeStats, grav: number, maxJumps: number, slowed: boolean) {
    const ev = this.ev;
    // ride along with a moving platform
    if (this.onGround && this.ground && this.ground === this.lastGround) {
      const g = this.ground;
      this.x += g.dx - this.gdx; this.y += g.dy - this.gdy; this.z += g.dz - this.gdz;
    }
    const ground = this.onGround ? this.ground : null;
    const ice = ground?.kind === "ice";
    // speed: pedal, brake/roll back, coast
    const top = (st.speed + (this.boostT > 0 ? 7 : 0)) * (slowed ? 0.62 : 1);
    if (this.boostT > 0) this.boostT -= dt;
    // pedalling only drives the bike on the ground: in the air your speed holds, so a jump goes where it was aimed
    if (inp.throttle > 0.05) { if (this.onGround) this.speed += (this.speed < top ? st.accel * inp.throttle : -st.accel * 0.6) * dt; }
    else if (inp.throttle < -0.05) {
      const was = this.speed;
      this.speed -= (this.speed > 0 ? st.accel * 1.7 : st.accel * 0.6) * -inp.throttle * dt;
      // braking in the air shortens a jump at once (never flying you backwards)
      if (!this.onGround) {
        this.speed = Math.max(this.speed, Math.min(1, was));
        const k = was > 0.01 ? this.speed / was : 1;
        this.vx *= k; this.vz *= k;
      }
    }
    else this.speed = damp(this.speed, 0, this.onGround ? 1.4 : 6, dt);
    this.speed = clamp(this.speed, -4, top + (this.boostT > 0 ? 0 : 1));
    if (this.boostT > 0 && this.speed < top - 1) this.speed = top - 1;
    // steering: sharper at low speed, a little in the air
    const k = clamp(0.55 + 6 / (Math.abs(this.speed) + 4), 0.55, 1.6) * (this.onGround ? 1 : 0.55);
    this.yaw -= inp.steer * st.turn * k * dt * (this.speed < -0.2 ? -1 : 1);
    this.steerVis = damp(this.steerVis, -inp.steer * 0.45, 0.06, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // velocity on the ground plane: follows the heading, except on ice
    const grip = ice ? 0.42 / st.grip : 0.05 / st.grip;
    const wantVx = fx * this.speed + (ground?.belt?.vx ?? 0), wantVz = fz * this.speed + (ground?.belt?.vz ?? 0);
    if (this.onGround) { this.vx = damp(this.vx, wantVx, grip, dt); this.vz = damp(this.vz, wantVz, grip, dt); }
    else { this.vx = damp(this.vx, fx * this.speed, 0.3, dt); this.vz = damp(this.vz, fz * this.speed, 0.3, dt); }
    this.slip = Math.hypot(this.vx - fx * this.speed, this.vz - fz * this.speed);
    // jump (a short grace time after riding off an edge; a second hop with Wings)
    this.coyote = this.onGround ? 0.12 : this.coyote - dt;
    if (inp.jump) {
      if (this.onGround || this.coyote > 0) {
        // a jump off a ramp adds the ramp's own launch
        const g = this.onGround ? this.ground : null;
        const ramp = g?.ramp ? Math.max(0, this.speed * Math.cos(this.yaw) * g.ramp * ((g.y1 - (g.y0 + 1)) / (g.z1 - g.z0))) : 0;
        this.vy = st.jump + ramp; this.onGround = false; this.coyote = 0; this.jumps = 1; ev.jump = true;
      }
      else if (this.jumps < maxJumps) { this.vy = st.jump * 0.92; this.jumps++; ev.jump = true; ev.double = true; }
    }
    // move, with walls
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const floor = this.y;
    // probe the way we're rolling (backwards too), so a bike nosed against a step can always back away from it
    const dir = this.speed < -0.05 ? -1 : 1;
    const fpx = nx + fx * 0.55 * dir, fpz = nz + fz * 0.55 * dir;
    const wLow = W.wallAt(fpx, this.y + 0.5, fpz, floor), wHigh = W.wallAt(fpx, this.y + 1.1, fpz, floor);
    if (wLow || wHigh) {
      const w = (wLow ?? wHigh)!, top = w.y1 + w.dy;
      // (a rising jump counts the height it's about to gain)
      if (!this.onGround && !wHigh && !w.ramp && top - (this.y + Math.max(0, this.vy) * 0.12) <= 0.75 && this.vy > -4) {
        // a jump a touch late at a step: scramble up onto it rather than bounce off
        this.y = top; this.vy = 0; this.onGround = true; this.ground = w; this.jumps = 0; ev.land = Math.max(ev.land, 2);
      } else {
        // bump: stop and roll back a little
        if (Math.abs(this.speed) > 3) ev.wall = true;
        this.speed = -this.speed * 0.25; this.vx *= -0.2; this.vz *= -0.2;
        nx = this.x; nz = this.z;
      }
    }
    // sides: slide along walls
    for (let s = -1; s <= 1; s += 2) {
      const sx = nx + fz * 0.32 * s, sz = nz - fx * 0.32 * s;
      const w = W.wallAt(sx, this.y + 0.6, sz, floor);
      if (w) {
        const px0 = sx - (w.x0 + w.dx), px1 = w.x1 + w.dx - sx, pz0 = sz - (w.z0 + w.dz), pz1 = w.z1 + w.dz - sz;
        const m = Math.min(px0, px1, pz0, pz1);
        if (m === px0) nx -= px0 + 0.01; else if (m === px1) nx += px1 + 0.01; else if (m === pz0) nz -= pz0 + 0.01; else nz += pz1 + 0.01;
      }
    }
    this.x = nx; this.z = nz;
    // the floor
    W.ground(this.x, this.z, this.y + STEP_UP, G);
    const wasGround = this.onGround;
    if (this.onGround) {
      if (G.p && G.y > this.y - 0.65) { this.y = G.y; this.ground = G.p; }
      else {
        // off the edge: a ramp throws you up along its slope
        const g = this.ground;
        this.vy = Math.min(this.vy, 0);
        if (g?.ramp) { const slope = (g.y1 - (g.y0 + 1)) / (g.z1 - g.z0); this.vy = Math.max(0, this.speed * Math.cos(this.yaw) * g.ramp * slope * 1.15); }
        this.onGround = false; this.ground = null;
      }
    }
    if (!this.onGround) {
      this.airT += dt;
      const py = this.y;
      this.vy -= grav * dt;
      this.y += this.vy * dt;
      // land on anything we come down onto — or catch the lip of a deck we're just below (it pops us up)
      W.ground(this.x, this.z, py + STEP_UP, G);
      if (G.p && this.y <= G.y && this.vy <= 0) {
        this.y = G.y; ev.land = Math.max(ev.land, -this.vy);
        this.vy = 0; this.onGround = true; this.ground = G.p; this.jumps = 0;
        this.land = Math.min(1, ev.land / 14);
      }
    } else this.airT = 0;
    if (this.onGround) {
      const g = this.ground!;
      if (g.kind === "bounce") { this.vy = 13 + Math.max(0, -this.vy) * 0.2; this.speed = Math.max(this.speed, 8.5); this.onGround = false; this.ground = null; ev.bounce = true; }
      else if (g.kind === "boost") { if (this.boostT <= 0) ev.boost = true; this.boostT = 1.2; }
    }
    if (!wasGround && this.onGround && !ev.land) ev.land = 0.1;
    // remember the platform's position to follow it next step
    this.lastGround = this.onGround ? this.ground : null;
    if (this.lastGround) { this.gdx = this.lastGround.dx; this.gdy = this.lastGround.dy; this.gdz = this.lastGround.dz; }
    // looks: pitch along slopes and through the air, lean into turns, spinning wheels and crank
    let targetPitch = 0;
    const rg = this.onGround ? this.ground : null;
    if (rg?.ramp) targetPitch = -Math.atan2(rg.y1 - (rg.y0 + 1), rg.z1 - rg.z0) * rg.ramp * Math.sign(Math.cos(this.yaw) || 1);
    else if (!this.onGround) targetPitch = clamp(-this.vy * 0.05, -0.5, 0.5);
    this.pitch = damp(this.pitch, targetPitch, 0.07, dt);
    this.lean = damp(this.lean, -inp.steer * clamp(Math.abs(this.speed) / 9, 0, 1) * 0.35, 0.08, dt);
    this.wheel += (this.speed / 0.31) * dt;
    if (inp.throttle > 0.05 || this.speed > 0.5) this.crank += Math.max(this.speed, inp.throttle * 4) * dt * 1.8;
    this.tuck = damp(this.tuck, this.onGround ? 0 : 1, 0.1, dt);
    this.land = damp(this.land, 0, 0.12, dt);
  }
}
