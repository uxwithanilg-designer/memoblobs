// One race of Wake Racers: the grid and the countdown, the rivals (with a gentle rubber band so the pack stays close),
// the event's rules (finish in the places you need, survive the knockout gates, beat the clock through checkpoints,
// grab enough coins, weave through traffic, survive the hazards, stop in the berth, out-race the champion), and
// everything your boat collects and spends: coins, hearts (your hull), the oil in the tank, the nitro meter (filled by
// coins, big jumps, power slides and near misses) and the power you're holding. Pure logic: the game draws it, the
// QA bot runs it in Node.
import { clamp, lerp, makeRng } from "./util";
import { DS, PRE, lowerBound, moveObstacle, type Course, type Obstacle, type ItemKind } from "./course";
import { Boat, collideBoats, newInput, STEP, type Input, type PhysEvents, type HitKind } from "./physics";
import { Driver } from "./ai";
import { BOATS, RIVALS, PLAYER_PILOT, tuned, liveryOf, type BoatId, type Pilot, type Tuned } from "./boats";
import type { Mode } from "./stages";

export type PowerId = "turbo" | "shield" | "magnet" | "wave" | "ghost" | "jump" | "freeze";
export const POWER_INFO: Record<PowerId, { name: string; color: string }> = {
  turbo: { name: "Turbo", color: "#FF7A3D" }, shield: { name: "Bubble Shield", color: "#36E3FF" }, magnet: { name: "Coin Magnet", color: "#FF4F7A" },
  wave: { name: "Tidal Wave", color: "#2E9BFF" }, ghost: { name: "Ghost Hull", color: "#B98CFF" }, jump: { name: "Mega Hop", color: "#3EE08F" },
  freeze: { name: "Ice Wake", color: "#9AF6FF" },
};

export interface Racer {
  idx: number;
  boat: Boat;
  driver: Driver | null;
  input: Input;
  name: string;
  pilot: Pilot;
  boatId: BoatId;
  livery: { hull: string; deck: string; stripe: string; trim: string };
  isPlayer: boolean;
  place: number;
  finished: boolean; finishT: number;
  out: boolean;
  nitro: number;
  pace: number;
  cp: number;
  frozen: number;
  lastPad: number;
  boss: boolean;
}

export type RaceEventKind =
  | "beep" | "go" | "coin" | "heart" | "fuel" | "box" | "power" | "hit" | "wall" | "bump" | "land" | "launch" | "pad"
  | "nitro" | "checkpoint" | "knockout" | "finish" | "rivalFinish" | "fail" | "nearMiss" | "mine" | "shieldPop" | "overtake"
  | "lowFuel" | "timeAdd" | "docked" | "wave" | "drift" | "smash" | "saved";
export interface RaceEvent { k: RaceEventKind; who: number; x: number; y: number; z: number; v: number; s: string }

export interface Result {
  ok: boolean;
  reason: string;
  place: number; of: number;
  time: number;
  coins: number; coinsTotal: number;
  stars: number;
  bonus: number;
  heartsLost: number;
}

/** everything needed to pick a race up again at a checkpoint (plain data: it is saved on the device too) */
export interface Snapshot {
  t: number; coins: number; hearts: number; heartsLost: number; fuel: number; power: PowerId | null;
  shield: number; magnet: number; timeLeft: number; timeLimit: number; cpPassed: number[][]; cp: number;
  racers: { x: number; z: number; y: number; vx: number; vz: number; vy: number; heading: number; yaw: number; i: number; s: number; d: number;
    grounded: boolean; nitro: number; finished: boolean; finishT: number; out: boolean; cp: number; lastPad: number }[];
  /** taken items and spent hazards, as strings of 0/1 */
  taken: string; dead: string;
}

export interface RaceOptions { boat: BoatId; levels: Partial<Record<"engine" | "handling" | "nitro", number>>; paint: string; mode: Mode; need: number; rivals: number; pace: number; skill: number; twist: string; d: number; bossBoat?: BoatId; bossName?: string }

const STARTER_TOP = 30;

export class Race {
  readonly racers: Racer[] = [];
  readonly player: Racer;
  phase: "grid" | "countdown" | "race" | "done" = "grid";
  t = 0;
  countdown = 3.4;
  coins = 0;
  readonly coinsTotal: number;
  hearts = 3;
  readonly maxHearts = 5;
  heartsLost = 0;
  fuel: number;
  readonly tank: number;
  power: PowerId | null = null;
  shield = 0; magnet = 0; freezeT = 0;
  /** time limit (s) for timed events, Infinity otherwise */
  timeLeft = Infinity;
  timeLimit = Infinity;
  result: Result | null = null;
  events: RaceEvent[] = [];
  /** the race as it was at the last checkpoint you passed (continue from there after a wreck) */
  lastSnap: Snapshot | null = null;
  continues = 0;
  readonly mode: Mode;
  readonly need: number;
  readonly opts: RaceOptions;
  private acc = 0;
  private hurtT = 0;
  private dryT = 0;
  private lowWarned = false;
  private rng: ReturnType<typeof makeRng>;
  private cpPassed: number[][] = [];
  private lastPlace = 0;
  private ev: PhysEvents;
  private beepAt = 3;
  private dockHold = 0;

  constructor(readonly c: Course, o: RaceOptions) {
    this.opts = o;
    this.mode = o.mode;
    this.rng = makeRng(c.seed ^ 0xa5a5);
    const spec = tuned(o.boat, o.levels);
    this.tank = spec.tank;
    this.fuel = spec.tank * (o.twist === "lowfuel" ? 0.55 : 1);
    this.coinsTotal = c.items.filter((i) => i.kind === "coin").length;
    // coin rush: a share of the coins on the water
    this.need = o.mode === "coins" ? Math.round(this.coinsTotal * lerp(0.3, 0.48, o.d)) : o.need;
    // survival runs are about the hazards: you start with a spare heart
    if (o.mode === "survival") this.hearts = 4;
    // ---- the grid: rivals ahead of you in races (there's a pack to chase), alongside otherwise
    const n = o.rivals;
    const slots: [number, number][] = n >= 5 ? [[-6, -7], [-6, 0], [-6, 7], [-17, -7], [-17, 7], [-17, 0]] : n >= 3 ? [[-6, -7], [-6, 7], [-17, -4], [-17, 4]] : n === 1 ? [[-6, -4], [-6, 4]] : [[-6, 0]];
    const player = this.addRacer(spec, o.boat, liveryOf(spec, o.paint), PLAYER_PILOT, null, true, 1, false);
    this.player = player;
    const r = makeRng(c.seed ^ 0x77);
    const pool = BOATS.filter((b) => b.id !== o.boat);
    const names = RIVALS.slice();
    for (let k = 0; k < n; k++) {
      const boss = this.mode === "duel";
      const id: BoatId = boss && o.bossBoat ? o.bossBoat : pool[Math.floor(r() * Math.min(pool.length, 3 + Math.floor(o.d * 7)))].id;
      const rs = tuned(id);
      const pilot = boss ? { name: o.bossName ?? "Champion", skin: "#FFD23F", helmet: "#1A1A2E" } : names.splice(Math.floor(r() * names.length), 1)[0];
      const drv = new Driver(clamp(o.skill + (r() - 0.5) * 0.2, 0.2, 1), (r() - 0.5) * 8);
      const pace = (o.pace + (o.twist === "turbo" ? 0.04 : 0) + (boss ? 0.035 : (r() - 0.5) * 0.06)) * STARTER_TOP;
      this.addRacer(rs, id, rs.livery, pilot, drv, false, pace, boss);
    }
    // place everyone: you at the back of the pack in a race
    const order = n >= 3 ? [...this.racers.slice(1), this.racers[0]] : this.racers;
    order.forEach((ra, k) => { const sl = slots[Math.min(k, slots.length - 1)]; ra.boat.placeAt(c, sl[0], sl[1]); });
    for (let k = 0; k < c.checkpoints.length; k++) this.cpPassed.push([]);
    this.ranked().forEach((ra, k) => (ra.place = k + 1));
    // time limits
    const f = this.mode === "rush" ? lerp(1.5, 1.16, o.d) : this.mode === "traffic" ? lerp(1.6, 1.26, o.d) : this.mode === "dock" ? lerp(1.6, 1.28, o.d) : this.mode === "survival" ? lerp(2.1, 1.6, o.d) : 0;
    if (f) {
      if (this.mode === "rush") this.timeLimit = this.par(0, c.checkpoints[0]) * f + 4;
      else this.timeLimit = this.par(0, c.length) * f + (this.mode === "dock" ? 14 : 4);
      this.timeLeft = this.timeLimit;
    }
    this.ev = {
      land: (b, impact, air) => {
        const ra = this.racers[b.id];
        this.emit("land", b.id, b.x, b.y, b.z, impact);
        if (ra.isPlayer && air > 0.45) { ra.nitro = Math.min(1, ra.nitro + (0.07 + 0.09 * air) * this.player.boat.spec.meterGain); }
      },
      launch: (b, vy) => this.emit("launch", b.id, b.x, b.y, b.z, vy),
      hit: (b, kind, strength, ob) => this.onHit(b, kind, strength, ob),
      nearMiss: (b) => {
        const ra = this.racers[b.id];
        if (ra.isPlayer) { ra.nitro = Math.min(1, ra.nitro + 0.06 * b.spec.meterGain); this.emit("nearMiss", b.id, b.x, b.y, b.z, 1); }
      },
    };
  }

  private addRacer(spec: Tuned, id: BoatId, livery: Racer["livery"], pilot: Pilot, driver: Driver | null, isPlayer: boolean, pace: number, boss: boolean) {
    const ra: Racer = {
      idx: this.racers.length, boat: new Boat(spec, this.racers.length), driver, input: newInput(), name: pilot.name, pilot, boatId: id, livery,
      isPlayer, place: 1, finished: false, finishT: 0, out: false, nitro: isPlayer ? 0.35 : 0.4, pace, cp: 0, frozen: 0, lastPad: -1, boss,
    };
    this.racers.push(ra);
    return ra;
  }

  /** a fair time from s0 to s1 for the starter boat, driven well */
  par(s0: number, s1: number) {
    const c = this.c;
    let t = 0;
    for (let s = Math.max(0, s0); s < s1; s += DS) { const i = Math.round((s + PRE) / DS); t += DS / Math.min(c.pace[i] * 1.15, STARTER_TOP * 0.93); }
    return t;
  }

  private emit(k: RaceEventKind, who: number, x: number, y: number, z: number, v = 0, s = "") {
    this.events.push({ k, who, x, y, z, v, s });
  }

  start() { if (this.phase === "grid") { this.phase = "countdown"; this.countdown = 3.4; this.beepAt = 3; } }

  /** advance the race by dt seconds of real time with the player's controls */
  update(dt: number, inp: Input) {
    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= this.beepAt && this.beepAt > 0) { this.emit("beep", 0, 0, 0, 0, this.beepAt); this.beepAt--; }
      if (this.countdown <= 0) { this.phase = "race"; this.emit("go", 0, 0, 0, 0); }
    }
    this.acc = Math.min(this.acc + dt, STEP * 10);
    while (this.acc >= STEP) { this.acc -= STEP; this.substep(inp); }
  }

  private substep(inp: Input) {
    const c = this.c, h = STEP, racing = this.phase === "race" || this.phase === "done";
    if (racing) this.t += h;
    // moving hazards follow their clocks — only the ones near a boat (and every cruising boat)
    let lo = 1e9, hi = -1e9;
    for (const ra of this.racers) if (!ra.out) { lo = Math.min(lo, ra.boat.s); hi = Math.max(hi, ra.boat.s); }
    for (let k = lowerBound(c.obstS, lo - 60); k < c.obstacles.length && c.obstS[k] < hi + 480; k++) { const o = c.obstacles[k]; if (o.motion !== "none" && o.alive) moveObstacle(c, o, this.t); }
    for (const k of c.roam) { const o = c.obstacles[k]; if (o.alive) moveObstacle(c, o, this.t); }
    const p = this.player;
    if (this.freezeT > 0) this.freezeT -= h;
    if (this.shield > 0) this.shield -= h;
    if (this.magnet > 0) this.magnet -= h;
    if (this.hurtT > 0) this.hurtT -= h;

    for (const ra of this.racers) {
      const b = ra.boat, I = ra.input;
      if (ra.out) { I.throttle = 0; I.brake = 0.4; I.steer = 0; I.boost = false; I.jump = false; }
      else if (!racing) { I.throttle = 0; I.brake = 0; I.steer = 0; I.boost = false; I.jump = false; }
      else if (ra.isPlayer) {
        if (this.phase === "done" && !(this.mode === "dock" && !this.result?.ok)) {
          // after the line: ease off and cruise
          I.throttle = 0.35; I.brake = 0; I.steer = inp.steer * 0.5; I.boost = false; I.jump = false;
        } else { I.steer = inp.steer; I.throttle = inp.throttle; I.brake = inp.brake; I.boost = inp.boost; I.jump = inp.jump; }
      } else if (ra.driver) {
        // rivals: a pace with a gentle rubber band towards you, frozen by Ice Wake
        const gap = p.boat.s - b.s;
        const band = clamp(gap / 360, -0.06, 0.05);
        const cap = ra.pace * (1 + band) * (ra.frozen > 0 || this.freezeT > 0 ? 0.62 : 1) * (ra.finished ? 0.55 : 1);
        b.capK = Math.min(1.25, cap / b.spec.top);
        ra.driver.drive(c, b, I, { fuel01: 1, hearts: 3, nitro: ra.nitro, hasPower: true }, h, this.t);
        ra.nitro = Math.min(1, ra.nitro + h * (0.012 + 0.025 * this.opts.d));
        if (ra.frozen > 0) ra.frozen -= h;
      }
      // nitro
      if (I.boost && ra.nitro > 0.04 && b.grounded && racing && !ra.out) {
        if (b.boostT < 0.12) { b.boostT = 0.12; b.boostK = 1; }
        ra.nitro = Math.max(0, ra.nitro - h * 0.34);
        if (ra.isPlayer && !this.wasBoosting) this.emit("nitro", ra.idx, b.x, b.y, b.z);
      }
      if (ra.isPlayer) this.wasBoosting = I.boost && ra.nitro > 0.04;
      // currents
      b.current = 0;
      for (const z of c.rapids) if (b.s > z.s0 && b.s < z.s1) {
        b.current = 2.6 * z.k;
        if (b.grounded && this.rng() < h * z.k * 2.2) { b.vy = 1.6 + this.rng() * 2.4 * z.k; b.grounded = false; b.air = 0; }
      }
      if ((this.opts.twist === "storm" || this.opts.twist === "giant") && b.grounded && this.rng() < h * 0.5) { b.vy = 1.2 + this.rng() * 1.8; b.grounded = false; b.air = 0; }
      b.step(c, I, this.ev, h);
      // boost pads
      for (let k = 0; k < c.pads.length; k++) {
        const pd = c.pads[k];
        if (ra.lastPad === k || Math.abs(b.s - pd.s) > pd.len / 2 || Math.abs(b.d - pd.d) > pd.w || !b.grounded) continue;
        ra.lastPad = k; b.boostT = Math.max(b.boostT, 1.35); b.boostK = 1.1;
        if (ra.isPlayer) { ra.nitro = Math.min(1, ra.nitro + 0.05); this.emit("pad", ra.idx, b.x, b.y, b.z); }
      }
      if (ra.isPlayer && b.drifting && racing) { ra.nitro = Math.min(1, ra.nitro + h * 0.11 * b.spec.meterGain); }
    }
    // boats bump
    for (let a = 0; a < this.racers.length; a++) for (let k = a + 1; k < this.racers.length; k++) collideBoats(this.racers[a].boat, this.racers[k].boat, this.ev);
    if (!racing) return;
    this.rules(h, inp);
  }
  private wasBoosting = false;

  private onHit(b: Boat, kind: HitKind, strength: number, o: Obstacle | null) {
    const ra = this.racers[b.id];
    if (o && o.explode) { o.alive = false; this.emit("mine", b.id, o.x, o.y, o.z, strength); }
    if (o && !o.alive && !o.explode) { this.emit("smash", b.id, o.x, o.y, o.z, strength, o.kind); return; }
    if (!ra.isPlayer) return;
    if (kind === "wall" || kind === "island") { this.emit("wall", b.id, b.x, b.y, b.z, strength); return; }
    if (kind === "boat") { this.emit("bump", b.id, b.x, b.y, b.z, strength, "boat"); return; }
    if (!o) return;
    // only a real crash hurts the hull: a glancing knock just bounces you off
    if (!o.damage || strength < 7) { this.emit("bump", b.id, o.x, o.y, o.z, strength, o.kind); return; }
    if (this.hurtT > 0) return;
    if (this.shield > 0) { this.shield = 0; this.hurtT = 1; this.emit("shieldPop", b.id, b.x, b.y, b.z); return; }
    this.hearts--; this.heartsLost++; this.hurtT = 1.4;
    b.stun = 0.5; b.yaw += (this.rng() < 0.5 ? -1 : 1) * 1.8;
    this.emit("hit", b.id, o.x, o.y, o.z, strength, o.kind);
    if (this.hearts <= 0) this.fail("Your boat was wrecked");
  }

  private rules(h: number, inp: Input) {
    const c = this.c, p = this.player, b = p.boat;
    const active = this.phase === "race";
    // ---- fuel
    if (active) {
      // a full tank lasts ~85 s at full throttle (~2 km): miss one oil can and you'll get by, miss two and you're dry
      this.fuel = Math.max(0, this.fuel - h * (0.12 + 0.4 * p.input.throttle + (b.boostT > 0 ? 0.16 : 0)));
      b.engine = this.fuel > 0;
      if (!this.lowWarned && this.fuel < this.tank * 0.25) { this.lowWarned = true; this.emit("lowFuel", 0, b.x, b.y, b.z); }
      if (this.fuel > this.tank * 0.3) this.lowWarned = false;
      this.dryT = !b.engine && b.speed < 1.4 ? this.dryT + h : 0;
      if (this.dryT > 1.5) this.fail("Out of oil");
      // ---- the clock
      if (this.timeLimit < Infinity) { this.timeLeft -= h; if (this.timeLeft <= 0) { this.timeLeft = 0; this.fail("Time's up"); } }
    }
    // ---- pickups (yours)
    const reach = this.magnet > 0 ? 11 : 2.4;
    for (let k = lowerBound(c.itemS, b.s - 14); k < c.items.length && c.itemS[k] < b.s + 14; k++) {
      const it = c.items[k];
      if (it.taken) continue;
      const dx = it.x - b.x, dz = it.z - b.z;
      if (Math.abs(dx) > reach + 1 || Math.abs(dz) > reach + 1) continue;
      const dy = it.y - (b.y + 0.9);
      const R = it.kind === "coin" ? reach : 2.6;
      if (dx * dx + dz * dz > R * R || Math.abs(dy) > (this.magnet > 0 && it.kind === "coin" ? 6 : 2.3)) continue;
      it.taken = true;
      this.collect(it.kind, it.x, it.y, it.z);
    }
    // ---- places, checkpoints, knockouts, finishes
    for (const ra of this.racers) {
      if (ra.out) continue;
      const bb = ra.boat;
      while (ra.cp < c.checkpoints.length && bb.s > c.checkpoints[ra.cp]) {
        this.cpPassed[ra.cp].push(ra.idx);
        const k = ra.cp;
        ra.cp++;
        this.knockouts();
        // (the snapshot is taken with the gate already counted, so a continue never passes it twice)
        if (ra.isPlayer && !ra.out) this.onCheckpoint(k);
      }
      if (!ra.finished && bb.s >= c.length) {
        ra.finished = true; ra.finishT = this.t;
        if (ra.isPlayer) this.onFinish(); else this.emit("rivalFinish", ra.idx, bb.x, bb.y, bb.z);
      }
    }
    const ranked = this.ranked();
    ranked.forEach((ra, k) => (ra.place = k + 1));
    if (active && this.lastPlace && p.place < this.lastPlace) this.emit("overtake", 0, b.x, b.y, b.z, p.place);
    this.lastPlace = p.place;
    // ---- docking
    if (this.mode === "dock" && c.dock && p.finished && !this.result) {
      const dk = c.dock;
      const inBay = Math.abs(b.s - dk.s) < dk.len / 2 && Math.abs(b.d - dk.d) < dk.w;
      this.dockHold = inBay && b.speed < 3 ? this.dockHold + h : 0;
      if (this.dockHold > 0.8) this.win();
    }
    void inp;
  }

  ranked() {
    const list = this.racers.filter((r) => !r.out);
    list.sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.boat.s - a.boat.s));
    return list;
  }

  private collect(k: ItemKind, x: number, y: number, z: number) {
    const p = this.player;
    switch (k) {
      case "coin": this.coins++; p.nitro = Math.min(1, p.nitro + 0.028 * p.boat.spec.meterGain); this.emit("coin", 0, x, y, z, this.coins); break;
      case "heart": this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.emit("heart", 0, x, y, z, this.hearts); break;
      case "fuel": this.fuel = this.tank; this.lowWarned = false; this.emit("fuel", 0, x, y, z); break;
      case "box": {
        const pool: PowerId[] = this.opts.rivals > 0 ? ["turbo", "shield", "magnet", "wave", "ghost", "jump", "freeze"] : ["turbo", "shield", "magnet", "ghost", "jump"];
        const pw = pool[Math.floor(this.rng() * pool.length)];
        if (!this.power) this.power = pw;
        this.emit("box", 0, x, y, z, 0, this.power ?? pw);
        break;
      }
    }
  }

  /** use the power you're holding */
  usePower() {
    const pw = this.power;
    if (!pw || this.phase !== "race") return false;
    const b = this.player.boat;
    this.power = null;
    switch (pw) {
      case "turbo": b.boostT = 3.4; b.boostK = 1.4; break;
      case "shield": this.shield = 14; break;
      case "magnet": this.magnet = 10; break;
      case "ghost": b.ghost = 6; break;
      case "jump": if (b.grounded) { b.vy = 13.5; b.grounded = false; b.air = 0; } else b.vy = Math.max(b.vy, 9); break;
      case "freeze": this.freezeT = 4.5; break;
      case "wave":
        for (const ra of this.racers) {
          if (ra.isPlayer || ra.out) continue;
          const dx = ra.boat.x - b.x, dz = ra.boat.z - b.z, D = Math.hypot(dx, dz);
          if (D > 38) continue;
          ra.boat.stun = 1.3; ra.boat.vx *= 0.4; ra.boat.vz *= 0.4; ra.boat.vy = 4; ra.boat.grounded = false;
          ra.boat.vx += (dx / (D + 1)) * 8; ra.boat.vz += (dz / (D + 1)) * 8;
        }
        break;
    }
    this.emit("power", 0, b.x, b.y, b.z, 0, pw);
    return true;
  }

  /** the race right now, as plain data */
  snapshot(): Snapshot {
    return {
      t: this.t, coins: this.coins, hearts: this.hearts, heartsLost: this.heartsLost, fuel: this.fuel, power: this.power,
      shield: this.shield, magnet: this.magnet, timeLeft: this.timeLeft, timeLimit: this.timeLimit, cpPassed: this.cpPassed.map((l) => l.slice()), cp: this.player.cp,
      racers: this.racers.map((r) => { const b = r.boat; return { x: b.x, z: b.z, y: b.y, vx: b.vx, vz: b.vz, vy: b.vy, heading: b.heading, yaw: b.yaw, i: b.i, s: b.s, d: b.d, grounded: b.grounded, nitro: r.nitro, finished: r.finished, finishT: r.finishT, out: r.out, cp: r.cp, lastPad: r.lastPad }; }),
      taken: this.c.items.map((it) => (it.taken ? "1" : "0")).join(""), dead: this.c.obstacles.map((o) => (o.alive ? "0" : "1")).join(""),
    };
  }

  /** pick the race up again from a snapshot: a short countdown, then go (a damaged hull and an empty tank get a little help) */
  continueFrom(sn: Snapshot) {
    const c = this.c;
    this.t = sn.t; this.coins = sn.coins; this.hearts = Math.max(sn.hearts, 2); this.heartsLost = sn.heartsLost;
    this.fuel = Math.max(sn.fuel, this.tank * 0.5); this.power = sn.power; this.shield = sn.shield; this.magnet = sn.magnet;
    this.timeLeft = isFinite(sn.timeLimit) ? Math.max(sn.timeLeft, 20) : Infinity; this.timeLimit = isFinite(sn.timeLimit) ? sn.timeLimit : Infinity;
    this.cpPassed = sn.cpPassed.map((l) => l.slice());
    sn.racers.forEach((q, k) => {
      const ra = this.racers[k]; if (!ra) return;
      const b = ra.boat;
      b.x = q.x; b.z = q.z; b.y = q.y; b.vx = q.vx * 0.3; b.vz = q.vz * 0.3; b.vy = 0; b.heading = q.heading; b.yaw = 0; b.i = q.i; b.s = q.s; b.d = q.d;
      b.grounded = true; b.boostT = 0; b.stun = 0; b.ghost = 0; b.air = 0;
      ra.nitro = q.nitro; ra.finished = q.finished; ra.finishT = q.finishT; ra.out = q.out; ra.cp = q.cp; ra.lastPad = q.lastPad; ra.frozen = 0;
    });
    c.items.forEach((it, k) => (it.taken = sn.taken[k] === "1"));
    c.obstacles.forEach((o, k) => { o.alive = sn.dead[k] !== "1"; if (o.alive) { o.s = o.s0; o.d = o.d0; } });
    this.result = null; this.dryT = 0; this.hurtT = 1.5; this.lowWarned = false; this.dockHold = 0;
    this.events.length = 0;
    this.phase = "countdown"; this.countdown = 2.4; this.beepAt = 2;
    this.continues++;
    this.lastSnap = sn;
  }

  private onCheckpoint(k: number) {
    const b = this.player.boat;
    if (this.mode === "rush") {
      const next = k + 1 < this.c.checkpoints.length ? this.c.checkpoints[k + 1] : this.c.length;
      const f = lerp(1.5, 1.16, this.opts.d);
      const add = this.par(this.c.checkpoints[k], next) * f;
      this.timeLeft += add; this.timeLimit += add;
      this.emit("timeAdd", 0, b.x, b.y, b.z, add);
    } else this.emit("checkpoint", 0, b.x, b.y, b.z, k);
    this.lastSnap = this.snapshot();
    this.emit("saved", 0, b.x, b.y, b.z, k);
  }

  /** the last boat through each knockout gate is out */
  private knockouts() {
    if (this.mode !== "knockout") return;
    for (let k = 0; k < this.cpPassed.length; k++) {
      const alive = this.racers.filter((r) => !r.out);
      const through = this.cpPassed[k].filter((i) => !this.racers[i].out);
      if (alive.length > 1 && through.length === alive.length - 1) {
        const last = alive.find((r) => !through.includes(r.idx));
        if (!last) continue;
        last.out = true;
        this.cpPassed[k].push(last.idx);
        this.emit("knockout", last.idx, last.boat.x, last.boat.y, last.boat.z, k, last.name);
        if (last.isPlayer) this.fail("Knocked out at the gate");
      }
    }
  }

  private onFinish() {
    const p = this.player;
    if (this.mode === "dock") { this.emit("checkpoint", 0, p.boat.x, p.boat.y, p.boat.z, -1); return; }
    const place = this.ranked().findIndex((r) => r === p) + 1;
    if ((this.mode === "race" || this.mode === "knockout" || this.mode === "duel") && place > this.need) { this.fail(`Finished ${ordinal(place)}, needed ${ordinal(this.need)}`, place); return; }
    if (this.mode === "coins" && this.coins < this.need) { this.fail(`${this.coins} of ${this.need} coins`, place); return; }
    this.win(place);
  }

  private win(place = this.ranked().findIndex((r) => r === this.player) + 1) {
    if (this.result) return;
    const b = this.player.boat;
    const timed = this.timeLimit < Infinity;
    const third = this.mode === "race" || this.mode === "knockout" || this.mode === "duel" ? place === 1 : timed ? this.timeLeft > this.timeLimit * 0.2 && this.heartsLost === 0 : this.heartsLost === 0;
    const stars = 1 + (this.coins >= this.coinsTotal * 0.6 ? 1 : 0) + (third && this.continues === 0 ? 1 : 0);
    const bonus = 20 + (this.racers.length > 1 ? [0, 60, 35, 20][place] ?? 0 : 25) + stars * 10;
    this.result = { ok: true, reason: "", place, of: this.racers.length, time: this.t, coins: this.coins, coinsTotal: this.coinsTotal, stars, bonus, heartsLost: this.heartsLost };
    this.phase = "done";
    this.emit(this.mode === "dock" ? "docked" : "finish", 0, b.x, b.y, b.z, place);
  }

  private fail(reason: string, place = this.player.place) {
    if (this.result) return;
    const b = this.player.boat;
    this.result = { ok: false, reason, place, of: this.racers.length, time: this.t, coins: this.coins, coinsTotal: this.coinsTotal, stars: 0, bonus: 0, heartsLost: this.heartsLost };
    this.phase = "done";
    this.emit("fail", 0, b.x, b.y, b.z, 0, reason);
  }

  /** progress 0..1 along the race */
  progress(ra: Racer = this.player) { return clamp(ra.boat.s / this.c.length, 0, 1); }
}

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
