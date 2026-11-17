// AI drivers. Each has a skill level and a personality:
//  racer (clean, quick lines) · aggressive (late brakes, bumps, early nitro) · drifter (drifts the bends, lots
//  of nitro) · defender (blocks the player's line) · rookie (makes mistakes) · boss (fast, ruthless, smart nitro)
//  · collector (QA autopilot that chases coins).
// They plan a speed profile from the curvature ahead (corner speed from grip + braking distance), follow an
// outside-inside-outside racing line, overtake on the side with room (preferring the inside of the next bend),
// use slipstream and nitro, avoid hazards and rubber-band gently depending on difficulty.
// Planning runs ~12 times a second (staggered per driver); steering runs every frame.
import type { AiLevel, TrackItem } from "./types";
import type { Track } from "./track";
import type { Vehicle } from "./physics";

export type Personality = "racer" | "aggressive" | "drifter" | "defender" | "rookie" | "boss" | "collector" | "cop";
export const PERSONALITIES: Personality[] = ["racer", "aggressive", "drifter", "defender", "rookie"];

export const AI_SKILL: Record<AiLevel, { pace: number; corner: number; behind: number; ahead: number; mistakes: number; nitro: number; react: number }> = {
  //       top-speed pace, corner-speed margin, catch-up when behind, slow-down when ahead, mistake rate, nitro use, start reaction (s)
  easy: { pace: 0.87, corner: 0.86, behind: 0.05, ahead: 0.11, mistakes: 0.5, nitro: 0.3, react: 0.45 },
  normal: { pace: 0.935, corner: 0.92, behind: 0.05, ahead: 0.06, mistakes: 0.22, nitro: 0.6, react: 0.25 },
  hard: { pace: 0.975, corner: 0.97, behind: 0.05, ahead: 0.03, mistakes: 0.07, nitro: 0.85, react: 0.12 },
  pro: { pace: 1.0, corner: 1.0, behind: 0.04, ahead: 0, mistakes: 0, nitro: 1, react: 0.04 },
};

/** what the driver needs to know about the track items (hazards + coins), implemented by ItemField */
export interface ItemQuery { each(s0: number, s1: number, fn: (it: TrackItem) => void): void }

const HAZ = new Set(["fire", "oil", "cones", "rock", "spikes", "puddle"]);

export class Driver {
  lane: number;
  aggression: number;
  /** nitro gained per second "from driving well" (AI doesn't collect bottles or near misses as often) */
  bonusNitro: number;
  private plan = 0;
  private vTarget = 0; private dLine = 0; private dSmooth = 0;
  private wantDrift = false; private straightAhead = 0;
  private passSide = 0; private passT = 0;
  private nitroCooldown = 0;
  private mistakeT = 0; private wobble = 0; private lateBrake = 0; private liftT = 0;
  private blockT = 0;
  private haz = 0; private blockD = 0; private coinD: number | null = null;
  private reactT: number; private seedN: number; private missPct: number;
  private rnd: () => number;
  private blk: number[] = [];
  /** Drift Kings: slide through every proper bend for points, not just when it is faster */
  driftShow = false;
  /** bikes: AI riders pop a wheelie now and then on long straights */
  private wheelieOn = false; private wheelieT = 2;
  /** Highway Heat police: the car this cop hunts (it lines up behind it, closes in and rams) */
  target: Vehicle | null = null;
  constructor(public car: Vehicle, public level: AiLevel, public talent: number, seed: number, public personality: Personality = "racer") {
    let a = (seed * 2654435761) >>> 0 || 1;
    this.rnd = () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; };
    this.lane = this.rnd() - 0.5;
    this.aggression = personality === "aggressive" || personality === "boss" ? 0.8 + this.rnd() * 0.2 : personality === "rookie" ? 0.2 : 0.3 + this.rnd() * 0.4;
    this.bonusNitro = ({ easy: 0.006, normal: 0.012, hard: 0.018, pro: 0.024 } as const)[level] * (personality === "drifter" || personality === "boss" ? 1.4 : personality === "cop" ? 2.2 : 1);
    this.plan = this.rnd() * 0.08;
    this.mistakeT = 2 + this.rnd() * 4;
    this.reactT = AI_SKILL[level].react * (0.5 + this.rnd());
    this.seedN = seed >>> 0;
    this.missPct = ({ easy: 22, normal: 8, hard: 2, pro: 0 } as const)[level] * (personality === "rookie" ? 1.5 : personality === "collector" ? 0 : 1);
  }

  drive(dt: number, track: Track, cars: Vehicle[], player: Vehicle, raceTime: number, items?: ItemQuery) {
    const c = this.car, sk = AI_SKILL[this.level], hw = track.halfWidth;
    if (raceTime < this.reactT) { c.input.gas = 0; c.input.brake = 0; c.input.nitro = false; c.input.drift = false; return; }
    this.plan -= dt;
    if (this.plan <= 0) { this.plan = 0.08; this.think(track, cars, player, items); }
    this.passT = Math.max(0, this.passT - dt);
    this.liftT = Math.max(0, this.liftT - dt);
    this.blockT = Math.max(0, this.blockT - dt);
    c.nitro = Math.min(1, c.nitro + this.bonusNitro * dt);
    // smooth the line so the car flows instead of twitching between targets
    this.dSmooth += (this.dLine - this.dSmooth) * Math.min(1, dt * (this.haz > 0 ? 7 : this.passT > 0 ? 4 : 2));
    const dTarget = Math.max(-hw + 1.1, Math.min(hw - 1.1, this.dSmooth + this.wobble));
    // ---------------------------------------------------------- controls
    const err = dTarget - c.d;
    let steer = Math.max(-1, Math.min(1, err * (this.haz ? 0.7 : 0.5) - c.vd * 0.07));
    const dv = this.vTarget - c.v;
    c.input.gas = this.liftT > 0 ? 0 : dv > 0 ? Math.min(1, dv * 0.5 + 0.35) : 0;
    c.input.brake = dv < -2.5 && !c.drifting ? Math.min(1, -dv * 0.08) : 0;
    // drifting: hold the drift through the bend, steer into it
    const kHere = track.kappa(c.s + 6);
    if (this.wantDrift && Math.abs(kHere) > 0.004) {
      c.input.drift = true;
      if (!c.drifting) steer = Math.sign(kHere) * Math.max(0.45, Math.abs(steer));
      c.input.gas = 1; c.input.brake = 0;
    } else c.input.drift = false;
    c.input.steer = steer;
    if (c.style === "bike") {
      this.wheelieT -= dt;
      if (this.wheelieT <= 0) {
        this.wheelieOn = !this.wheelieOn && this.straightAhead > Math.max(70, c.v * 2.4) && this.rnd() < (this.personality === "boss" || this.personality === "aggressive" ? 0.55 : 0.3);
        this.wheelieT = this.wheelieOn ? 1 + this.rnd() * 1.6 : 2 + this.rnd() * 4;
      }
      c.input.drift = this.wheelieOn && this.straightAhead > c.v * 1.2;
    }
    // ---------------------------------------------------------- nitro
    this.nitroCooldown -= dt;
    if (this.personality === "cop" && this.target) {
      const g = track.delta(c.s, this.target.s);
      if (g > 6 && g < 90 && c.nitro > 0.2 && !c.drifting) { c.input.nitro = true; return; }
    }
    const longStraight = this.straightAhead > Math.max(60, c.v * 1.6);
    if (c.shock > 0) c.input.nitro = true;
    else if (c.boosting) c.input.nitro = c.nitro > 0.04 && this.straightAhead > c.v * 0.8 && !c.drifting;
    else if (longStraight && c.nitro > (this.level === "pro" ? 0.25 : 0.45) && this.nitroCooldown <= 0 && raceTime > 1.5 && this.rnd() < sk.nitro * dt * (this.personality === "aggressive" ? 3 : 1.6)) {
      // boss: perfect nitro when the bar is full on a long straight
      if ((this.personality === "boss" || this.level === "pro") && c.nitro >= 0.97 && this.straightAhead > c.v * 2.4 && c.perfectNitro()) this.nitroCooldown = 8;
      else { c.input.nitro = true; this.nitroCooldown = 4 + this.rnd() * 3; }
    } else c.input.nitro = false;
    // ---------------------------------------------------------- mistakes (easy / rookie)
    this.mistakeT -= dt;
    if (this.mistakeT <= 0) {
      this.mistakeT = 3 + this.rnd() * 5;
      const rate = sk.mistakes * (this.personality === "rookie" ? 1.8 : 1);
      this.wobble = 0; this.lateBrake = 0;
      const roll = this.rnd();
      if (roll < rate * 0.35) this.wobble = (this.rnd() - 0.5) * 5; // drifts off line
      else if (roll < rate * 0.7) this.lateBrake = 0.1 + this.rnd() * 0.1; // late brake → runs wide
      else if (roll < rate) this.liftT = 0.4 + this.rnd() * 0.6; // lifts / hesitates
    }
  }

  private think(track: Track, cars: Vehicle[], player: Vehicle, items?: ItemQuery) {
    const c = this.car, sk = AI_SKILL[this.level], hw = track.halfWidth, p = c.params;
    const boss = this.personality === "boss";
    // ---------------------------------------------------------- rubber band (by difficulty)
    const gap = c.progress - player.progress;
    let band = 1;
    if (gap < -40) band += sk.behind * Math.min(1, (-gap - 40) / 260) * (boss ? 1.3 : 1);
    else if (gap > 60) band -= sk.ahead * Math.min(1, (gap - 60) / 320);
    const pace = sk.pace * this.talent * band;
    // ---------------------------------------------------------- speed plan: corner speed + braking distance
    const margin = sk.corner * (this.talent * 0.5 + 0.5) * (1 + this.lateBrake) * (this.personality === "aggressive" ? 1.02 : 1);
    const canDrift = c.style !== "bike" && (this.personality === "drifter" || boss || this.level === "pro" || (this.level === "hard" && this.personality !== "rookie"));
    const brake = p.brake * 0.82;
    const look = 20 + c.v * 2.4;
    let vT = p.vmax * pace, straight = 0, firstBend = -1, kBend = 0, driftHelps = false;
    for (let x = 6; x <= look; x += 6) {
      const k = Math.abs(track.kappa(c.s + x));
      if (k > 0.0045 && firstBend < 0) { firstBend = x; kBend = track.kappa(c.s + x); }
      if (firstBend < 0) straight = x;
      if (k < 1e-4) continue;
      const vc = Math.sqrt((p.grip * margin) / k);
      const allowed = Math.sqrt(vc * vc + 2 * brake * Math.max(0, x - 4));
      if (allowed < vT) {
        // a drift (×1.4 grip) gets through quicker: commit to it instead of braking hard
        const vcD = vc * Math.sqrt(1.32);
        if (canDrift && x < 30 && c.v > 22 && c.v < vcD * 1.05) driftHelps = true;
        vT = canDrift && x < 30 && c.v < vcD ? Math.min(vT, Math.sqrt(vcD * vcD + 2 * brake * Math.max(0, x - 4))) : allowed;
      }
    }
    if (this.driftShow && firstBend >= 0 && firstBend < 28 && Math.abs(kBend) > 0.0055 && c.v > 14) driftHelps = true;
    this.straightAhead = firstBend < 0 ? look : straight;
    this.wantDrift = driftHelps || (this.wantDrift && c.drifting && Math.abs(track.kappa(c.s + 10)) > 0.004);
    // ---------------------------------------------------------- racing line
    const kNear = track.kappa(c.s + 8 + c.v * 0.25);
    let line: number;
    if (Math.abs(kNear) > 0.004) line = Math.sign(kNear) * hw * 0.55; // apex: inside
    else if (firstBend > 0 && firstBend < 25 + c.v * 1.2) line = -Math.sign(kBend) * hw * 0.42; // set up wide
    else line = this.lane * hw * 0.7;
    // ---------------------------------------------------------- traffic
    let blocker: Vehicle | null = null, bGap = 999, side: Vehicle | null = null;
    for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (o === c || o.ghost > 0) continue;
      const ds = track.delta(c.s, o.s), dd = o.d - c.d;
      // look further ahead at speed (highway traffic is much slower than you)
      if (ds > 0 && ds < Math.max(30, 12 + (c.v - o.v) * 1.4) && Math.abs(dd) < 2.6 && ds < bGap) { bGap = ds; blocker = o; }
      if (Math.abs(ds) < 5 && Math.abs(dd) < 3 && Math.abs(dd) > 0.5) side = o;
    }
    if (blocker && blocker.v < c.v + 2) {
      if (this.passT <= 0) {
        // pick a side: prefer the inside of the next bend, otherwise the side with more room
        const roomL = blocker.d - (-hw + 1.2), roomR = hw - 1.2 - blocker.d;
        const pref = Math.abs(kBend) > 0.003 ? Math.sign(kBend) : roomR > roomL ? 1 : -1;
        this.passSide = (pref > 0 ? roomR : roomL) > 2.6 ? pref : -pref;
        this.passT = 1.4;
      }
      const off = this.aggression > 0.7 ? 2.3 : 2.9;
      const want = blocker.d + this.passSide * off;
      if (Math.abs(want) < hw - 1.1) line = want;
      else if (bGap < 12) vT = Math.min(vT, blocker.v + (this.aggression > 0.7 ? 1.5 : 0)); // tuck in & draft
      if (bGap < 7 && this.aggression < 0.5) vT = Math.min(vT, blocker.v + 0.5);
    }
    if (side && this.aggression < 0.7) line += -Math.sign(side.d - c.d) * 0.9; // give room
    // police: hunt the target — line up on it, out-run it, ram it; if it slips behind, sit in front and block
    if (this.personality === "cop" && this.target) {
      const T = this.target, g = track.delta(c.s, T.s);
      if (g > -12 && g < 260) {
        const lead = Math.min(1.2, g / Math.max(8, c.v - T.v + 6));
        line = Math.max(-hw + 1.1, Math.min(hw - 1.1, T.d + T.vd * lead));
        if (g > 40 && blocker && Math.abs(blocker.d - c.d) < 2.6 && blocker !== T) line = blocker.d + (this.passSide || 1) * 2.8;
        vT = Math.max(vT, Math.min(p.vmax * 1.12, T.v * (g > 30 ? 1.14 : 1.05) + (g > 30 ? 7 : 2.5)));
      } else if (g <= -12 && g > -80) { line = T.d; vT = Math.min(vT, Math.max(10, T.v * 0.88)); }
    }
    // defender / boss: cover the player's line when they're right behind (one move, then hold)
    if ((this.personality === "defender" || boss) && this.level !== "easy") {
      const pg = track.delta(c.s, player.s);
      if (pg < -3 && pg > -22 && Math.abs(player.d - c.d) < 3.5) {
        if (this.blockT <= 0) { this.blockT = 2.2; this.blockD = player.d; }
        if (this.blockT > 1.2) line = this.blockD;
      }
    }
    // ---------------------------------------------------------- hazards & coins
    this.haz = 0; this.coinD = null;
    if (items) {
      // find the first hazard row ahead and the free gaps across the road there
      const s0 = c.s + 3, s1 = c.s + 22 + c.v * 1.3;
      let rowS = Infinity, best = Infinity;
      const blk = this.blk; blk.length = 0;
      items.each(s0, s1, (it) => {
        if (it.taken) return;
        const ds = track.delta(c.s, it.s);
        if (HAZ.has(it.kind)) {
          if (((Math.imul(it.id + 1, 2654435761) ^ this.seedN) >>> 0) % 100 < this.missPct) return; // easier AI sometimes doesn't see it
          if (ds < rowS - 8) { rowS = ds; blk.length = 0; }
          if (ds <= rowS + 8) blk.push(it.d, (it.kind === "spikes" || it.kind === "puddle" ? 2.1 : it.kind === "oil" ? 1.7 : it.kind === "cones" ? 1.3 : 1.0) + c.params.halfWidth + 0.45);
        } else if (this.personality === "collector" && it.kind !== "ramp" && ds < best && ds > 2) { best = ds; this.coinD = it.d; }
      });
      if (this.coinD != null && (!blk.length || best < rowS - 6)) line = this.coinD;
      if (blk.length) {
        const lim = hw - 1.1;
        const free = (x: number) => { if (Math.abs(x) > lim) return false; for (let k = 0; k < blk.length; k += 2) if (Math.abs(x - blk[k]) < blk[k + 1]) return false; return true; };
        // a target is only good if it's free AND we can get there without driving through a hazard first
        const tRow = rowS / Math.max(10, c.v), latV = Math.min(c.params.steer, c.v * 0.42) * 0.6;
        const ok = (x: number) => {
          if (!free(x)) return false;
          for (let k = 0; k < blk.length; k += 2) {
            const lo = blk[k] - blk[k + 1], hi = blk[k] + blk[k + 1];
            const crosses = (c.d < lo && x > lo) || (c.d > hi && x < hi) || (c.d >= lo && c.d <= hi);
            if (crosses && Math.abs(x - c.d) / latV > tRow - 0.15) return false;
          }
          return true;
        };
        if (!ok(line)) {
          this.haz = 1;
          let pick = NaN, cost = Infinity, fb = line, fbCost = Infinity;
          const tryX = (x: number) => {
            if (!free(x)) return;
            const cc = Math.abs(x - line) + Math.abs(x - c.d) * 0.6;
            if (ok(x)) { if (cc < cost) { cost = cc; pick = x; } }
            else if (Math.abs(x - c.d) < fbCost) { fbCost = Math.abs(x - c.d); fb = x; }
          };
          for (let k = 0; k < blk.length; k += 2) { tryX(blk[k] - blk[k + 1] - 0.5); tryX(blk[k] + blk[k + 1] + 0.5); }
          tryX(lim); tryX(-lim); tryX(0); tryX(c.d);
          line = Number.isNaN(pick) ? fb : pick;
        }
      }
    }
    this.dLine = line;
    this.vTarget = Math.max(8, vT);
  }
}
