// Drift scoring (Drift Kings) and rally pace notes.
//
// DriftScore: while a car slides, points flow in at  speed × angle × multiplier  (× tandem bonus). Holding a slide
// raises the multiplier (×2 … ×5 every 2.2 s); a new slide that starts within the grace window LINKS onto the same
// chain. When the car straightens up for longer than the grace window the chain is BANKED into the total. Hitting a
// wall, spinning, crashing or running off the road BREAKS the chain: only 30% of it is saved — so the risk grows
// with the reward, but a kid never loses everything to one tap of the barrier.
//
// nextCall: the co-driver reads the road ahead like rally pace notes — direction plus a grade from 6 (fast, nearly
// flat) down to 2 (slow) and HAIRPIN, with a caution flag for long or very tight bends.
import type { Vehicle } from "./physics";
import type { Track } from "./track";

export const CHAIN_GRACE = 1.6;
/** drift angle (rad) that counts as a full-angle slide */
const FULL_ANGLE = 0.72;
const MULT_EVERY = 2.2;

export type DriftEvent = "linked" | "mult" | "banked" | "lost" | null;

export class DriftScore {
  /** banked points */
  total = 0;
  /** unbanked points of the current chain */
  chain = 0;
  mult = 1;
  best = 0;
  /** last banked / lost chain (for toasts) */
  last = 0;
  links = 0;
  private chainT = 0;
  private grace = 0;
  private active = false;
  /** time off the tarmac (a quick trip over the run-off is forgiven) */
  private offT = 0;

  /** call every step. `bonus` multiplies the points (tandem, AI talent). */
  update(dt: number, car: Vehicle, bonus = 1): DriftEvent {
    let ev: DriftEvent = null;
    this.offT = car.offroad ? this.offT + dt : 0;
    if (this.chain > 0 && (car.spin > 0 || car.wreck > 0 || this.offT > 0.6)) return this.lose();
    const sliding = car.drifting && car.v > 11 && !car.air;
    if (sliding) {
      if (!this.active) {
        this.active = true;
        if (this.chain > 0 && this.grace > 0) { this.links++; ev = "linked"; }
      }
      const ang = Math.min(1, Math.abs(car.yaw) / FULL_ANGLE);
      this.chain += dt * car.v * 3.6 * (0.35 + ang * 1.25) * this.mult * bonus;
      this.chainT += dt;
      const m = Math.min(5, 1 + Math.floor(this.chainT / MULT_EVERY));
      if (m > this.mult) { this.mult = m; ev = "mult"; }
      this.grace = CHAIN_GRACE;
    } else {
      this.active = false;
      if (this.chain > 0) { this.grace -= dt; if (this.grace <= 0) ev = this.bank(); }
    }
    return ev;
  }

  /** wall scrape while sliding: the chain bleeds a little */
  scrape() { if (this.chain > 0) this.chain *= 0.985; }

  bank(): DriftEvent {
    if (this.chain <= 0) return null;
    const pts = Math.round(this.chain);
    this.total += pts; this.best = Math.max(this.best, pts); this.last = pts;
    this.reset();
    return "banked";
  }

  /** the chain breaks: 30% is saved into the total, `last` is what was lost */
  lose(): DriftEvent {
    if (this.chain <= 0) return null;
    const kept = Math.round(this.chain * 0.3);
    this.last = Math.round(this.chain) - kept;
    this.total += kept;
    this.reset();
    return "lost";
  }

  /** banked + live chain (what the scoreboard shows) */
  get live() { return this.total + Math.round(this.chain); }

  private reset() { this.chain = 0; this.mult = 1; this.chainT = 0; this.grace = 0; this.links = 0; this.active = false; }
}

/** a word for a banked chain */
export function driftWord(pts: number) {
  return pts >= 6000 ? "LEGENDARY DRIFT!" : pts >= 3500 ? "INSANE DRIFT!" : pts >= 1800 ? "SUPER DRIFT!" : pts >= 800 ? "GREAT DRIFT" : "NICE DRIFT";
}

/** rough drift points one lap can give a tidy driver (for Drift Attack star targets) */
export function driftPotential(track: Track) {
  let bend = 0;
  const step = 4;
  for (let x = 0; x < track.length; x += step) if (Math.abs(track.kappa(x)) > 0.0035) bend += step;
  // ~24 m/s through the bends, ~95 points per second at a decent angle, average multiplier ~2
  return (bend / 24) * 95 * 2;
}

export interface PaceNote { dir: number; grade: string; dist: number; caution: boolean; at: number }

/** the next bend the co-driver should call, looking 20..170 m ahead of `s` */
export function nextCall(track: Track, s: number, near = 20, far = 170): PaceNote | null {
  for (let x = near; x < far; x += 4) {
    const k = track.kappa(s + x);
    if (Math.abs(k) < 0.0045) continue;
    // already inside this bend? keep looking for the next one
    if (x === near && Math.abs(track.kappa(s + near - 8)) >= 0.0045 && Math.sign(track.kappa(s + near - 8)) === Math.sign(k)) {
      let y = x;
      while (y < far && Math.abs(track.kappa(s + y)) >= 0.003 && Math.sign(track.kappa(s + y)) === Math.sign(k)) y += 4;
      x = y; continue;
    }
    const sign = Math.sign(k);
    let peak = 0, len = 0;
    for (let y = x; y < x + 110; y += 4) {
      const kk = track.kappa(s + y);
      if (Math.sign(kk) !== sign || Math.abs(kk) < 0.003) break;
      peak = Math.max(peak, Math.abs(kk)); len += 4;
    }
    const R = 1 / Math.max(1e-5, peak);
    const grade = R < 24 ? "HAIRPIN" : R < 40 ? "2" : R < 62 ? "3" : R < 95 ? "4" : R < 150 ? "5" : "6";
    return { dir: sign, grade, dist: x, caution: len > 70 || R < 32, at: track.wrap(s + x) };
  }
  return null;
}
