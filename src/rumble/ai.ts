// The rival drivers. Each reads the track ahead the way a careful racer would: full gas on the straights, easing off
// before steep drops, ice and the lip of a kicker it can't take flat out, carrying speed into gap jumps; in the air it
// balances the truck to land on its wheels (gas tips the nose up, brake tips it down); it lifts off when the nose
// rears up. Skill sets how close to the limit it drives, how often it burns nitro and how readily it fires rockets.
// A little rubber band keeps the pack close: a rival far ahead of the player eases off, one far behind pushes harder.
import type { Pedals, Truck } from "./physics";
import type { Course } from "./terrain";
import { clamp } from "./util";

export interface Brain {
  skill: number;
  /** seconds until it may think about firing again */
  aim: number;
  /** seconds of nitro it wants to burn */
  burn: number;
  /** a small per-driver wobble so the pack doesn't move as one */
  wobble: number;
}

const PACE = 24;

export const newBrain = (skill: number, seed: number): Brain => ({ skill, aim: 2 + (seed % 5), burn: 0, wobble: ((seed * 7919) % 100) / 100 });

/** the speed it aims for here (m/s) */
export function targetSpeed(tr: Truck, co: Course, b: Brain, lead: number): number {
  const T = co.terrain, x = tr.x, s = tr.spec;
  const top = s.maxSpin * s.wheel.r;
  // the pace is set against a stock starter truck (24 m/s flat out): early rivals are a little slower than you at full
  // gas, the hardest ones a little faster (that's when engine upgrades and nitro matter)
  let v = Math.min(top * 0.97, PACE * (0.68 + 0.32 * b.skill)) * (0.97 + 0.06 * Math.sin(b.wobble * 9 + x * 0.01));
  // rubber band: `lead` = metres ahead of the player (negative: behind)
  if (lead > 30) v *= clamp(1 - (lead - 30) / 250, 0.8, 1);
  else if (lead < -25) v = Math.min(top * 0.97, v * clamp(1 + (-lead - 25) / 300, 1, 1.12));
  // what's coming
  const look = 10 + Math.max(0, tr.forward) * 1.1;
  let drop = 0;
  for (let d = 4; d < look; d += 2) { const sl = (T.heightAt(x + d + 2) - T.heightAt(x + d)) / 2; if (sl < drop) drop = sl; }
  if (drop < -0.32) v = Math.min(v, top * (0.55 + 0.25 * b.skill));
  for (const p of co.pits) if (p.x0 > x && p.x0 - x < look + 10) v = Math.max(v, top * 0.82);
  for (const rp of co.ramps) if (rp > x && rp - x < look) v = Math.min(v, top * (0.72 + 0.2 * b.skill));
  if (T.zoneAt(x + 4) === 2) v *= 0.8;
  return v;
}

/** pedals for this step */
export function drive(tr: Truck, co: Course, b: Brain, target: number, out: Pedals) {
  const T = co.terrain;
  if (tr.grounded) {
    const ground = Math.atan(T.slopeAt(tr.x));
    const pitch = tr.a - ground;
    const v = tr.forward;
    let gas = v < target ? 1 : v < target + 1.5 ? 0.35 : 0;
    let brake = v > target + 3 && v > 1 ? 0.6 : 0;
    // rearing up: lift off; nose diving: give it gas
    if (pitch > 0.42) { gas = 0; brake = Math.max(brake, pitch > 0.7 && v > 1 ? 0.4 : 0); }
    else if (pitch < -0.45) { gas = 1; brake = 0; }
    out.gas = gas; out.brake = brake;
  } else {
    // in the air: match the slope where it will land, nose a touch up
    const land = Math.atan(T.slopeAt(tr.x + Math.max(2, tr.vx * 0.5))) + 0.06;
    const err = tr.a - land;
    const ctrl = -(err * 2.2 + tr.w * 0.38);
    out.gas = ctrl > 0.12 ? 1 : 0; out.brake = ctrl < -0.12 ? 1 : 0;
  }
}

/** should it burn nitro now? */
export function wantsNitro(tr: Truck, co: Course, b: Brain, lead: number, tank: number, dt: number): boolean {
  if (b.burn > 0) { b.burn -= dt; return tank > 0 && tr.grounded; }
  if (tank < 0.8 || !tr.grounded) return false;
  const pitch = tr.a - Math.atan(co.terrain.slopeAt(tr.x));
  if (Math.abs(pitch) > 0.2) return false;
  const chance = (0.05 + 0.18 * b.skill + (lead < -20 ? 0.25 : 0)) * dt;
  if (Math.random() < chance) b.burn = 0.8 + Math.random() * 1.6;
  return false;
}

/** should it fire at the truck `dx` metres ahead (dy above)? */
export function wantsFire(b: Brain, dx: number, dy: number, isPlayer: boolean, dt: number): boolean {
  b.aim -= dt;
  if (b.aim > 0 || dx < 6 || dx > 30 || Math.abs(dy) > 4.5) return false;
  const p = (0.15 + 0.35 * b.skill) * (isPlayer ? 1 : 0.7) * dt;
  if (Math.random() < p) { b.aim = 6 + Math.random() * 5 - b.skill * 2; return true; }
  return false;
}
