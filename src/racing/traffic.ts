// Highway traffic (Highway Heat): civilian cars, vans, buses and trucks cruising in lanes, plus police roadblocks.
// Traffic is kinematic (no tyre physics): every car keeps its lane at its own cruise speed, slows behind slower
// traffic, now and then changes lane, and is recycled ahead of the player once it drops far behind — so a handful
// of models makes an endless, busy highway. Each car is a real `Vehicle` so the AI drivers see it and steer round
// it. Roadblocks are parked police cars angled across all lanes but one.
import * as THREE from "three";
import { Vehicle, paramsFor } from "./physics";
import { buildCarModel } from "./cars/build";
import { mulberry, type Track } from "./track";
import type { CarModel, CarSpec } from "./types";

const NO_UP = { speed: 0, accel: 0, handling: 0, nitro: 0 };

export interface TrafficCar {
  car: Vehicle; model: CarModel; lane: number; cruise: number;
  /** spinning after a hit (s) and its direction */
  spin: number; spinDir: number; spinYaw: number;
  /** parked roadblock car */
  block: boolean; active: boolean;
  laneT: number; wheelRot: number;
  /** near-miss tracking against the player */
  nmPrev: number; nmMin: number; nmHit: boolean;
}

export interface TrafficOpts { seed: number; night: boolean; count: number; speed: [number, number]; blockSpec?: CarSpec }

export class TrafficField {
  cars: TrafficCar[] = [];
  blocks: TrafficCar[] = [];
  readonly lanes: number[];
  readonly group = new THREE.Group();
  private rnd: () => number;
  private blockFree = 0;

  constructor(private track: Track, private specs: CarSpec[], private o: TrafficOpts) {
    this.rnd = mulberry(o.seed);
    const hw = track.halfWidth, n = Math.max(2, Math.round((hw * 2) / 4.6));
    this.lanes = Array.from({ length: n }, (_, i) => -hw + ((i + 0.5) * 2 * hw) / n);
    for (let i = 0; i < o.count; i++) {
      const spec = specs[Math.floor(this.rnd() * specs.length)];
      this.cars.push(this.make(spec, spec.colors[Math.floor(this.rnd() * spec.colors.length)], false));
    }
    if (o.blockSpec) for (let i = 0; i < Math.min(4, n); i++) this.blocks.push(this.make(o.blockSpec, o.blockSpec.colors[0], true));
  }

  private make(spec: CarSpec, color: string, block: boolean): TrafficCar {
    const model = buildCarModel(spec, color);
    model.setLights(this.o.night);
    model.group.visible = !block;
    this.group.add(model.group);
    const car = new Vehicle(paramsFor(spec, NO_UP, model.dims), spec.engine.gears);
    car.lap = 0;
    return { car, model, lane: 0, cruise: 20, spin: 0, spinDir: 1, spinYaw: 0, block, active: !block, laneT: 0, wheelRot: 0, nmPrev: 0, nmMin: 99, nmHit: false };
  }

  /** spread the traffic out ahead of the start line */
  place(startS: number) {
    let s = startS + 90;
    for (const t of this.cars) {
      this.spawn(t, s);
      s += 38 + this.rnd() * 55;
    }
  }

  private laneFree(lane: number, s: number, gap: number) {
    for (const o of this.cars) if (o.active && o.lane === lane && Math.abs(this.track.delta(s, o.car.s)) < gap) return false;
    return true;
  }

  private spawn(t: TrafficCar, s: number) {
    const L = this.lanes.length;
    let lane = Math.floor(this.rnd() * L);
    for (let k = 0; k < L && !this.laneFree(lane, s, 26); k++) lane = (lane + 1) % L;
    const [lo, hi] = this.o.speed;
    // slow lane on the right, fast lane on the left
    const laneBias = L > 1 ? 1 - lane / (L - 1) : 0.5;
    t.lane = lane; t.cruise = lo + (hi - lo) * (0.35 * this.rnd() + 0.65 * laneBias * this.rnd() + 0.15);
    const c = t.car;
    c.s = this.track.wrap(s); c.d = this.lanes[lane]; c.v = t.cruise; c.vd = 0; c.yaw = 0; c.ghost = 0;
    t.spin = 0; t.spinYaw = 0; t.laneT = 4 + this.rnd() * 10; t.nmPrev = 0; t.nmMin = 99; t.nmHit = false;
    t.active = true; t.model.group.visible = true;
  }

  /** park police cars across every lane but `open`, `ahead` metres in front of the player */
  roadblock(playerS: number, ahead: number, open: number) {
    if (!this.blocks.length || this.blockFree > 0) return false;
    const s = this.track.wrap(playerS + ahead);
    let k = 0;
    for (let lane = 0; lane < this.lanes.length && k < this.blocks.length; lane++) {
      if (lane === open) continue;
      const b = this.blocks[k++];
      b.car.s = s + (this.rnd() - 0.5) * 2; b.car.d = this.lanes[lane]; b.car.v = 0; b.lane = lane;
      b.spinYaw = (lane % 2 ? 1 : -1) * 0.55; b.active = true; b.model.group.visible = true; b.spin = 0;
    }
    // clear civilian traffic out of the block
    for (const t of this.cars) if (Math.abs(this.track.delta(s, t.car.s)) < 30) this.spawn(t, playerS + 420 + this.rnd() * 200);
    this.blockFree = 1;
    return true;
  }

  get liveBlocks() { return this.blocks.filter((b) => b.active); }

  update(dt: number, playerS: number) {
    const tr = this.track;
    for (const t of this.cars) {
      const c = t.car;
      if (t.spin > 0) {
        t.spin -= dt; c.v = Math.max(0, c.v * (1 - dt * 1.2)); t.spinYaw += t.spinDir * dt * 5 * Math.min(1, t.spin);
        c.d += c.vd * dt; c.vd *= 1 - dt * 2;
        if (t.spin <= 0) { t.spinYaw = 0; t.cruise *= 0.8; }
      } else {
        // follow the car ahead in this lane (or move over)
        let gap = 99, aheadV = 99;
        for (const o of this.cars) {
          if (o === t || !o.active || Math.abs(o.car.d - c.d) > 2.4) continue;
          const g = tr.delta(c.s, o.car.s);
          if (g > 0 && g < gap) { gap = g; aheadV = o.car.v; }
        }
        for (const b of this.blocks) if (b.active && Math.abs(b.car.d - c.d) < 2.4) { const g = tr.delta(c.s, b.car.s); if (g > 0 && g < gap) { gap = g; aheadV = 0; } }
        let want = t.cruise;
        if (gap < 30) want = Math.min(want, aheadV + (gap - 12) * 0.4);
        c.v += (Math.max(0, want) - c.v) * Math.min(1, dt * (want < c.v ? 2.5 : 0.6));
        t.laneT -= dt;
        if ((t.laneT <= 0 || (gap < 18 && aheadV < t.cruise - 3)) && Math.abs(c.d - this.lanes[t.lane]) < 0.3) {
          const L = this.lanes.length, dir = this.rnd() < 0.5 ? -1 : 1;
          for (const nl of [t.lane + dir, t.lane - dir]) {
            if (nl < 0 || nl >= L || !this.laneFree(nl, c.s, 22)) continue;
            t.lane = nl; break;
          }
          t.laneT = 6 + this.rnd() * 10;
        }
        const target = this.lanes[t.lane];
        c.vd = (target - c.d) * 0.9;
        c.d += Math.max(-2.2, Math.min(2.2, c.vd)) * dt;
        c.yaw = Math.atan2(Math.max(-2.2, Math.min(2.2, c.vd)), Math.max(6, c.v)) * 0.8;
      }
      c.s = tr.wrap(c.s + c.v * dt);
      c.progress = c.s;
      t.wheelRot += (c.v * dt) / t.model.wheelRadius;
      // recycle: far behind → put it back ahead of the player; never pop in close to the camera
      const g = tr.delta(playerS, c.s);
      if (g < -110 || g > 900) this.spawn(t, playerS + 330 + this.rnd() * 420);
    }
    this.blockFree = 0;
    for (const b of this.blocks) {
      if (!b.active) continue;
      if (tr.delta(playerS, b.car.s) < -80) { b.active = false; b.model.group.visible = false; continue; }
      this.blockFree = 1;
    }
  }

  /** knock a car spinning (a hit, a nitro smash) */
  hit(t: TrafficCar, dir: number, vd: number, smash: boolean) {
    if (t.block) { t.spin = 0.6; t.spinDir = dir; return; }
    t.spin = smash ? 2.2 : 1.3; t.spinDir = dir; t.car.vd = vd;
  }

  dispose() {
    for (const t of [...this.cars, ...this.blocks]) t.model.dispose();
    this.group.removeFromParent();
  }
}
