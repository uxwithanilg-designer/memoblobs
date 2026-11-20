// Arcade-real car physics in track space. Speed along the road, lateral slide, cornering grip
// (too fast for a bend → the tyres saturate and you get pushed wide), drifting with mini-turbo tiers,
// nitro + PERFECT NITRO (shockwave), slipstream, kerbs, off-road, walls (impacts + scrapes), jumps,
// spin-outs, wrecks and respawns. Touch-friendly: an optional steering assist keeps kids off the walls.
import type { CarSpec, InputState, Upgrades } from "./types";
import type { Track } from "./track";

export interface VehicleParams {
  vmax: number;      // m/s
  accel: number;     // m/s² at low speed
  grip: number;      // m/s² lateral before sliding
  steer: number;     // max lateral speed m/s
  brake: number;     // m/s² braking
  nitroPower: number;
  nitroGain: number;
  mass: number;
  halfWidth: number; halfLength: number;
}

export function paramsFor(spec: Pick<CarSpec, "stats">, up: Upgrades, dims = { width: 1.9, length: 4.4 }): VehicleParams {
  const st = spec.stats;
  const sp = st.speed + up.speed * 0.45, ac = st.accel + up.accel * 0.45, ha = st.handling + up.handling * 0.45, ni = st.nitro + up.nitro * 0.45;
  return {
    vmax: (150 + sp * 18) / 3.6,
    accel: 5.8 + ac * 1.3,
    grip: 14 + ha * 2.2,
    steer: 8.5 + ha * 0.5,
    brake: 22 + ha * 0.8,
    nitroPower: 0.8 + ni * 0.07,
    nitroGain: 0.85 + ni * 0.045,
    mass: st.mass,
    halfWidth: dims.width / 2, halfLength: dims.length / 2,
  };
}

export type ImpactKind = "wall" | "scrape" | "land" | "offroad";
/** drift exit: level 1 blue, 2 orange, 3 purple mini-turbo */
export const DRIFT_TIERS = [0.75, 1.55, 2.5];
const TURBO_TIME = [0, 0.55, 0.95, 1.4];
const TURBO_KICK = [0, 2, 3.5, 5];
const SHOCK_TIME = 2.8;

export class Vehicle {
  s = 0; d = 0; v = 0; vd = 0;
  /** visual yaw relative to the road (rad) */
  yaw = 0;
  /** jump height & vertical speed */
  y = 0; vy = 0; air = false; airT = 0;
  lap = 0; progress = 0;
  nitro = 0.3; boosting = false; boostHold = 0;
  /** PERFECT NITRO (double-tap with a full bar): seconds left */
  shock = 0;
  /** drift mini-turbo: seconds left and strength tier */
  turbo = 0; turboLvl = 0;
  drifting = false; driftTime = 0; driftScore = 0; driftDir = 0; driftLevel = 0;
  spin = 0; spinDir = 1; wreck = 0; wreckT0 = 1.6;
  shield = 0; magnet = 0;
  /** invulnerable / non-colliding after a respawn (seconds) */
  ghost = 0;
  slip = 0; offroad = false; kerb = false;
  rpm = 0; gear = 1;
  topSpeed = 0;
  /** distance driven this frame */
  ds = 0;
  /** time spent stuck / off-road / going backwards (for auto-respawn) */
  stuckT = 0; offT = 0; backT = 0;
  /** steering assist 0..1 (player on touch): softer understeer push, auto-centre, wall avoidance */
  assist = 0;
  input: InputState = { steer: 0, gas: 0, brake: 0, nitro: false, drift: false };
  /** extra speed multiplier from slipstream (set by the race each frame) */
  draft = 0;
  onImpact: ((kind: ImpactKind, strength: number) => void) | null = null;
  /** drift released: level 0 = too short, 1..3 = mini-turbo tier */
  onDrift: ((level: number, time: number) => void) | null = null;
  /** "drift" (Drift Kings): slides start at lower speed, hold bigger angles you steer with, and grip more mid-slide */
  style: "race" | "drift" | "bike" = "race";
  /** bikes: wheelie amount 0..1 and how long the current one has lasted */
  wheelie = 0; wheelieT = 0;
  constructor(public params: VehicleParams, public gears = 6) {}

  get speedKmh() { return Math.abs(this.v) * 3.6; }

  /** start a PERFECT NITRO shockwave (needs a nearly full bar) */
  perfectNitro() {
    if (this.nitro < 0.9 || this.spin > 0 || this.wreck > 0) return false;
    this.shock = SHOCK_TIME; this.nitro = 1; this.v += 3;
    return true;
  }

  step(dt: number, track: Track, grip = 1) {
    const p = this.params, inp = this.input;
    const hw = track.halfWidth, wall = hw + track.shoulder - p.halfWidth;
    const ad = Math.abs(this.d);
    this.offroad = ad > hw + 1.1;
    this.kerb = !this.offroad && ad > hw - 0.2;
    // ---------------------------------------------------------- nitro
    const canBoost = this.spin <= 0 && this.wreck <= 0;
    if (this.shock > 0) {
      this.shock = Math.max(0, this.shock - dt);
      this.boosting = canBoost;
      this.nitro = Math.max(0, this.nitro - dt / SHOCK_TIME);
      if (!canBoost) this.shock = 0;
    } else {
      this.boosting = inp.nitro && this.nitro > 0.02 && canBoost;
      if (this.boosting) this.nitro = Math.max(0, this.nitro - dt * 0.4);
      else this.nitro = Math.min(1, this.nitro + dt * 0.012 * p.nitroGain);
    }
    const np = p.nitroPower;
    const boostMul = this.boosting ? 1 + (this.shock > 0 ? 0.36 : 0.24) * np : 1;
    this.turbo = Math.max(0, this.turbo - dt);
    const vmax = p.vmax * boostMul * (this.turbo > 0 ? 1.07 : 1) * (1 + this.draft * 0.06) * (this.offroad ? 0.62 : this.kerb ? 0.97 : 1);
    // ---------------------------------------------------------- spin-out / wreck
    let gas = inp.gas, brake = inp.brake, steer = inp.steer;
    if (this.spin > 0) { this.spin -= dt; gas = 0; brake = 0.25; steer = 0; }
    if (this.wreck > 0) { this.wreck -= dt; gas = 0; brake = 0.6; steer = 0; }
    this.ghost = Math.max(0, this.ghost - dt);
    // ---------------------------------------------------------- longitudinal
    let a: number;
    const r = Math.max(0, this.v) / vmax;
    if (brake > 0.05 && this.v > 0.5 && !this.drifting) a = -p.brake * brake;
    else if (brake > 0.05 && this.v <= 0.5 && gas < 0.1) a = -5; // reverse
    else {
      a = p.accel * gas * Math.max(0, 1 - Math.pow(Math.min(r, 1.2), 1.7));
      if (gas < 0.05) {
        // rolling drag slows the car down to a stop — it used to keep pulling past zero, so a car left without gas
        // (manual gas, now the default) crept backwards off the start line
        const drag = 1.6 + 0.0028 * this.v * this.v;
        a += this.v > 0 ? -Math.min(drag, this.v / dt) : this.v < 0 ? Math.min(drag, -this.v / dt) : 0;
      }
      if (this.boosting) a += (this.shock > 0 ? 13 : 9) * np * Math.max(0.15, 1 - r * 0.75);
      if (this.turbo > 0) a += 6 + this.turboLvl * 1.5;
      a += this.draft * 2.2;
    }
    // over the limit (nitro just ended, off-road): bleed speed smoothly instead of a brick wall
    if (this.v > vmax) a = Math.min(a, -((this.v - vmax) * (this.offroad ? 1.4 : 0.8) + 1));
    if (this.offroad) a -= 1.5 + this.v * 0.03;
    a -= 9.8 * Math.sin(track.pitch(this.s)) * 0.45; // hills
    if (this.drifting) a -= this.v * 0.03;
    this.v = Math.max(-9, this.v + a * dt);
    // ---------------------------------------------------------- drift state
    const holding = inp.drift || brake > 0.3, ds = this.style === "drift", bike = this.style === "bike";
    if (!bike && !this.drifting && holding && this.v > (ds ? 12 : 18) && Math.abs(steer) > (ds ? 0.22 : 0.3) && !this.air && this.spin <= 0 && this.wreck <= 0) {
      this.drifting = true; this.driftTime = 0; this.driftDir = Math.sign(steer); this.driftLevel = 0;
    }
    if (this.drifting && (!holding || this.v < (ds ? 9 : 12) || this.spin > 0 || this.wreck > 0)) {
      const lvl = this.driftLevel;
      if (lvl > 0 && this.spin <= 0 && this.wreck <= 0) { this.turbo = TURBO_TIME[lvl]; this.turboLvl = lvl; this.v += TURBO_KICK[lvl]; }
      this.onDrift?.(lvl, this.driftTime);
      this.drifting = false;
    }
    const k = track.kappa(this.s);
    // bikes: hold the button on a straight for a wheelie — it charges nitro and gives a little shove
    if (bike) {
      const can = inp.drift && !this.air && this.v > 7 && Math.abs(k) < 0.009 && this.spin <= 0 && this.wreck <= 0 && brake < 0.3;
      const want = can ? Math.min(1, 0.6 + 0.4 * gas) : 0;
      this.wheelie += (want - this.wheelie) * Math.min(1, dt * (want > this.wheelie ? 2.6 : 5));
      if (this.wheelie > 0.5) { this.wheelieT += dt; this.nitro = Math.min(1, this.nitro + dt * 0.05 * p.nitroGain); this.v += 0.8 * dt; }
      else this.wheelieT = 0;
    }
    if (this.drifting) {
      // tight corners charge the drift faster
      const bend = 1 + Math.min(1, Math.abs(k) * 110);
      this.driftTime += dt * (0.75 + bend * 0.25);
      this.driftLevel = this.driftTime >= DRIFT_TIERS[2] ? 3 : this.driftTime >= DRIFT_TIERS[1] ? 2 : this.driftTime >= DRIFT_TIERS[0] ? 1 : 0;
      this.nitro = Math.min(1, this.nitro + dt * 0.16 * p.nitroGain * bend);
      this.driftScore += dt * this.v * 2;
    }
    // ---------------------------------------------------------- lateral
    const need = this.v * this.v * k; // centripetal accel needed (signed)
    const g = p.grip * grip * (this.drifting ? (ds ? 1.5 : 1.4) : 1) * (this.offroad ? 0.75 : 1);
    const excess = Math.abs(need) - g;
    const steerMax = Math.min(Math.abs(this.v) * 0.42, p.steer) * (this.air ? 0.15 : 1);
    let target = steer * steerMax * (this.v < 0 ? -1 : 1);
    // assist: lane keeping — no input + off the tarmac (or heading into a wall) → ease back towards the road
    if (this.assist > 0 && Math.abs(steer) < 0.15 && this.wreck <= 0) {
      const over = ad - (hw - 1.2);
      if (over > 0) target = -Math.sign(this.d) * Math.min(5, over * 1.6) * this.assist;
    }
    const sat = excess > 0 ? Math.max(0.3, 1 - excess / (g * 1.5)) : 1;
    this.vd += (target - this.vd) * Math.min(1, dt * (this.drifting ? 3.2 : 5.5) * sat);
    if (excess > 0 && !this.air) {
      const push = 0.9 * (1 - this.assist * 0.3);
      this.vd -= Math.sign(k) * excess * dt * push;
      this.v -= excess * dt * (0.25 + this.assist * 0.08);
      this.slip = Math.min(1, excess / 10);
    } else this.slip = Math.max(0, this.slip - dt * 2);
    // assist: don't let a sliding car hit the barrier hard
    if (this.assist > 0 && ad > wall - 2.5 && this.vd * Math.sign(this.d) > 0) this.vd *= 1 - Math.min(1, dt * 4 * this.assist);
    this.d += this.vd * dt;
    // ---------------------------------------------------------- walls & run-off
    if (Math.abs(this.d) > wall) {
      const side = Math.sign(this.d);
      const hitN = Math.max(0, this.vd * side);
      this.d = side * wall;
      if (hitN > 0) this.vd = -this.vd * 0.35;
      if (this.shield <= 0) {
        if (hitN > 3.5) this.v *= 1 - Math.min(0.3, hitN * 0.022);
        this.v -= (3.5 + Math.max(0, this.v) * 0.05) * dt; // scrape friction
      }
      this.onImpact?.(hitN > 4 ? "wall" : "scrape", hitN > 4 ? hitN + this.v * 0.04 : Math.max(0, this.v) * 0.05);
    }
    // ---------------------------------------------------------- jumps
    if (this.air) {
      this.airT += dt;
      this.vy -= 22 * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.air = false; this.onImpact?.("land", Math.abs(this.vy)); this.vy = 0; }
    }
    // ---------------------------------------------------------- advance
    const prev = this.s;
    this.ds = this.v * dt;
    this.s = track.wrap(this.s + this.ds);
    if (this.ds > 0 && this.s < prev - track.length / 2) this.lap++;
    if (this.ds < 0 && this.s > prev + track.length / 2) this.lap--;
    this.progress = this.lap * track.length + this.s;
    // ---------------------------------------------------------- respawn bookkeeping
    const busy = this.spin > 0 || this.wreck > 0;
    this.stuckT = !busy && Math.abs(this.v) < 3 ? this.stuckT + dt : 0;
    this.offT = !busy && this.offroad && this.v < 25 ? this.offT + dt : this.offroad ? this.offT : 0;
    this.backT = !busy && this.v < -2 ? this.backT + dt : 0;
    // ---------------------------------------------------------- visuals: yaw, rpm/gears
    // drift angle: steer into the slide for more angle, counter-steer to tighten it up
    const driftYaw = this.drifting ? this.driftDir * (ds ? 0.5 + 0.3 * steer * this.driftDir : 0.36 + 0.14 * steer * this.driftDir) : 0;
    const spinYaw = this.spin > 0 ? this.spinDir * (1.2 - this.spin) * Math.PI * 1.7 : 0;
    const want = Math.atan2(this.vd, Math.max(6, Math.abs(this.v))) + driftYaw - Math.sign(k) * this.slip * 0.08;
    this.yaw += (want - this.yaw) * Math.min(1, dt * 7);
    if (this.spin > 0) this.yaw = spinYaw;
    const rr = Math.max(0, this.v) / (p.vmax * 1.05);
    const gearF = Math.min(this.gears - 0.001, rr * this.gears * 1.02);
    this.gear = Math.max(1, Math.floor(gearF) + 1);
    const inGear = gearF - Math.floor(gearF);
    this.rpm = Math.min(1, 0.18 + inGear * 0.78 + (this.boosting ? 0.05 : 0)) * (this.v > 0.5 || gas > 0 ? 1 : 0.2);
    if (gas > 0.1 && this.v < 3) this.rpm = 0.35 + gas * 0.3;
    this.topSpeed = Math.max(this.topSpeed, this.speedKmh);
    this.shield = Math.max(0, this.shield - dt);
    this.magnet = Math.max(0, this.magnet - dt);
  }

  jump(power = 1) { if (this.air) return; this.air = true; this.airT = 0; this.vy = (5.5 + Math.max(0, this.v) * 0.06) * power; this.drifting = false; }
  spinOut(dir = 1) {
    if (this.shield > 0) { this.shield = 0; return false; }
    if (this.ghost > 0) return false;
    this.spin = 1.2; this.spinDir = dir; this.v *= 0.55; this.drifting = false; this.shock = 0; return true;
  }
  wreckOut(t = 1.6) {
    if (this.shield > 0) { this.shield = 0; return false; }
    if (this.ghost > 0) return false;
    this.wreck = t; this.wreckT0 = t; this.v *= 0.25; this.drifting = false; this.shock = 0; this.turbo = 0; return true;
  }
  /** put the car back on the road (same s) after a wreck / getting stuck */
  respawn(d: number, v: number, ghost = 1.6) {
    this.d = d; this.vd = 0; this.yaw = 0; this.v = v; this.y = 0; this.vy = 0; this.air = false;
    this.spin = 0; this.wreck = 0; this.drifting = false; this.shock = 0; this.turbo = 0;
    this.ghost = ghost; this.stuckT = 0; this.offT = 0; this.backT = 0; this.slip = 0;
  }
}

/**
 * Estimated race time (s) for a perfect driver without nitro: corner speed limit from grip, braking and
 * acceleration passes over the track. Lap 1 is a standing start.
 */
export function idealRaceTime(track: Track, p: VehicleParams, laps: number, gripMul = 1) {
  const step = 4, n = Math.max(16, Math.ceil(track.length / step)), ds = track.length / n;
  const lim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let j = -1; j <= 1; j++) k = Math.max(k, Math.abs(track.kappa(i * ds + j * ds * 0.5)));
    lim[i] = Math.min(p.vmax, k > 1e-5 ? Math.sqrt((p.grip * gripMul) / k) : p.vmax);
  }
  // braking pass (twice around for the wrap)
  const brake = p.brake * 0.8;
  for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) { const nx = lim[(i + 1) % n]; lim[i] = Math.min(lim[i], Math.sqrt(nx * nx + 2 * brake * ds)); }
  const run = (v0: number) => {
    let v = v0, t = 0;
    for (let i = 0; i < n; i++) {
      const a = p.accel * Math.max(0, 1 - Math.pow(Math.min(1, v / p.vmax), 1.7));
      const v1 = Math.min(lim[(i + 1) % n], Math.sqrt(v * v + 2 * a * ds));
      t += ds / Math.max(1, (v + v1) / 2); v = v1;
    }
    return { t, v };
  };
  const first = run(0), fly = run(first.v);
  return first.t + Math.max(0, laps - 1) * fly.t;
}
