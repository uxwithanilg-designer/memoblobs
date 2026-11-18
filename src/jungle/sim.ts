// Kiko's Jungle Quest simulation (pure TS — runs in the browser, in Node balance sweeps and in QA). One continuous run:
// Kiko runs forward on 3 lanes through place after place. Swipe to change lane, jump, slide (or drop fast in the air);
// tap (or jump into one) to grab a vine or a zipline handle and swing across a chasm. Two heights: the forest floor and
// the branch road up high (root ramps and bouncy mushrooms take Kiko up). Rivers are crossed on lily pads, rope bridges
// and log rafts, lava on stepping stones; slides whoosh down water, mud and snow.
// A head-on hit or a fall costs a heart and sends Kiko back to the last banana flag; side bumps only shake bananas
// loose. Hearts come back from Heart Fruit and every 150 bananas, and the heart limit grows as the run goes on.
// Fruits fill the smoothie meter (Smoothie Rush: ×3 star power), pepper rockets are boosters (×3 for 6 s, the golden
// ×5 for 9 s), Pico the toucan gives a glide over everything, and each region's guardian animal gives a ride that smashes
// through hazards. The weather matters (rain and snow make lane changes slippery, wind pushes), sticky webs and mud slow
// Kiko down, geysers spurt on a beat, and at the end of each region a boss runs ahead throwing things until Kiko hits
// three banana pads. The same physics drive a look-ahead bot for sweeps.
import { BR_H, LW, METER, POWERS, RAMP_LEN, REGIONS, RIDE_T, STAGES_PER_REGION, Track, boostTime, heartMax, sectionOf } from "./levels";
import type { FruitId, Item, Ob, ObKind, PowerId, RideId, RunSpec, RunStats, Section, SimEvent, SimResult, TrickKind, Vine, Zone } from "./types";

export const G = 28;
export const JUMP_V = 10.5;
export const BOUNCE_V = 15;
const LANE_V = 13.5;
const SLIDE_T = 0.62;
const SLAM_V = -20;
export const KIKO_H = 1.2;
export const SLIDE_H = 0.5;
const KIKO_X = 0.42;
const KIKO_Z = 0.35;
const HALF_W = 0.95;
export const SKY_Y = 6.4;
export const BOOST_Y = 1.6;
export const RAFT_Y = 0.3;
const OUCH_T = 1.15;
const HOLD_T = 0.9;
export const TOP: Record<ObKind, number> = {
  log: 0.9, thorn: 1.0, shroom: 0.75, low: 3.0, rock: 2.3, roller: 1.1, coco: 0.6, peel: 0, gap: 0, bounce: 0.35,
  ramp: 0, branch: 0, snake: 0.8, hive: 3.0, lily: 0, bridge: 0, croc: 0.75, flog: 0.7,
  web: 2.2, mud: 0, geyser: 3.4, gust: 0, ice: 0,
};
const BOTTOM: Partial<Record<ObKind, number>> = { low: 0.82, hive: 0.82, web: 0.8 };
/** what Kiko stands on: lily pads, bridges, the raft */
export const PAD_H: Partial<Record<ObKind, number>> = { lily: 0.06, bridge: 0.22 };
/** pieces Kiko never bumps into (they do something instead) */
const ZONE = new Set<ObKind>(["peel", "gap", "bounce", "ramp", "branch", "lily", "bridge", "mud", "gust", "ice", "web"]);
const TRICK_PTS: Record<TrickKind, number> = { jumpOver: 150, closeCall: 100, slide: 60, vine: 200, bounce: 120, highroad: 180, crocHop: 160, peelHop: 80, wheee: 50, smash: 40, salad: 500, zip: 250, dodge: 120 };
export const TRICK_TEXT: Record<TrickKind, string> = {
  jumpOver: "JUMP OVER", closeCall: "CLOSE CALL", slide: "SLIDE!", vine: "VINE SWING", bounce: "BOING!", highroad: "BRANCH RUN",
  crocHop: "CROC HOP", peelHop: "PEEL HOP", wheee: "WHEEE!", smash: "SMASH!", salad: "FRUIT SALAD!", zip: "ZIPLINE!", dodge: "DODGE!",
};
/** where a moving piece's near edge is right now (rolling coconuts and crocs come toward Kiko) */
export const obZ = (o: Ob, kikoZ: number) => (o.k ? o.z + o.k * (o.z - kikoZ) : o.z);
/** geysers (and lightning puddles) spurt for 0.75 s every 2.2 s; they glow for the 0.6 s before */
export const geyserOn = (o: Ob, t: number) => ((t + (o.ph ?? 0)) % 2.2) < 0.75;
export const geyserWarn = (o: Ob, t: number) => ((t + (o.ph ?? 0)) % 2.2) > 1.6;
const top = (o: Ob) => o.y + TOP[o.kind];
const bottom = (o: Ob) => o.y + (BOTTOM[o.kind] ?? 0);
/** critters and bosses Kiko meets become stickers */
const CRITTER: Partial<Record<ObKind, string>> = { croc: "croc", snake: "snake", hive: "bees", web: "spider", roller: "", geyser: "" };

export interface SimOpts {
  bot?: boolean; skill?: number;
  /** score multiplier from missions */
  mult?: number;
  /** power-up upgrade levels 0–5 (+20 % time each) */
  up?: Partial<Record<PowerId, number>>;
}
interface Plan { lane: number; act: 0 | 1 | 2 }

export class Sim {
  spec: RunSpec; track: Track; sec: Section;
  phase: "play" | "lost" = "play";
  t = 0; z = 0; speed: number; base: number;
  lane = 0; x = 0; y = 0; vy = 0; air = false; slideT = 0;
  invT = 0; helmetT = 0; magnetT = 0; doubleT = 0; glideT = 0; slipT = 0; wobbleT = 0; holdT = 0; stuckT = 0;
  boostT = 0; boostX = 1; rushing = false; boosts = 0;
  rideT = 0; ride: RideId | null = null;
  hearts: number; maxHearts: number;
  /** after a hit: Kiko is dizzy (or falling) for a moment, then back at the last banana flag */
  ouchT = 0; ouchBy: ObKind | "fall" | "water" | "croc" | "lava" = "fall";
  meter = 0; streak: FruitId[] = [];
  swing: { v: Vine; z0: number; z1: number; y0: number } | null = null;
  onBranch = false; onRaft = false; slideZone: Zone["slide"] | null = null; lastBounce = { id: 0, t: -9 };
  inMud = false; onIce = false; chaser: string | null = null;
  pads = 0; chase: number | null = null; seeds = 0; boss: string | null = null; beaten = false;
  combo = 0; comboT = 0; score = 0; regions = 0; places = 0;
  stats: RunStats = {
    fruitBy: {}, bananas: 0, fruits: 0, golden: 0, salads: 0, tricks: 0, melodies: 0, bestCombo: 0, jumps: 0, slides: 0, vines: 0, bounces: 0, branches: 0, rafts: 0, crocHops: 0,
    powers: 0, boosts: 0, rushes: 0, stumbles: 0, hurts: 0, hearts: 0, seeds: 0, smashes: 0, rides: 0, ziplines: 0, bosses: 0,
  };
  met = new Set<string>();
  events: SimEvent[] = [];
  bot: boolean; skill: number; mult: number; up: Partial<Record<PowerId, number>>;
  private jumpBuf = 0; private lastLane = 0; private branchFrom = 0; private bananaHeart = 0; private throwT = 3;
  private regionI = 1; private chaseI = 0; private flagI = 0; private placeN: number; private hurtZ = 0; private failFlag = -1; private fails = 0;
  private lineGot = new Map<number, number>();
  private botT = 0; private botR = 0.5; private botQueue: { at: number; p: Plan }[] = []; private botVine = new Map<number, boolean>();

  constructor(spec: RunSpec, o: SimOpts = {}) {
    this.spec = spec; this.track = new Track(spec);
    this.sec = this.track.section(0);
    this.speed = this.base = this.track.speedAt(0);
    this.bot = !!o.bot; this.skill = o.skill ?? 1; this.mult = o.mult ?? 1; this.up = o.up ?? {};
    this.botR = (spec.seed % 1000) / 1000;
    this.maxHearts = this.hearts = heartMax(spec.start);
    this.placeN = spec.start;
  }

  // ---------------------------------------------------------------- input
  private canAct() { return this.phase === "play" && this.ouchT <= 0 && this.holdT <= 0; }
  left() { this.move(-1); }
  right() { this.move(1); }
  private move(dir: number) {
    if (!this.canAct() || this.slipT > 0) return;
    const to = Math.max(-1, Math.min(1, this.lane + dir));
    if (to === this.lane) return;
    const danger = this.dangerIn(this.lane);
    this.lastLane = this.lane; this.lane = to;
    this.events.push({ t: "lane", dir });
    if (danger) this.trick("closeCall");
  }
  /** swipe up: jump — or grab a vine when one is close */
  jump() {
    if (!this.canAct() || this.glideT > 0 || this.boostT > 0) return;
    if (this.grab()) return;
    if (this.swing) return;
    if (this.air) { this.jumpBuf = 0.16; return; }
    this.doJump();
  }
  /** tap: grab a vine or zipline handle (the HUD shows a ring when one is in reach) */
  grab() {
    if (!this.canAct() || this.swing || this.boostT > 0 || this.glideT > 0 || this.rideT > 0) return false;
    const v = this.vineNear();
    if (!v) return false;
    this.startSwing(v);
    return true;
  }
  private jumpV() { return JUMP_V * (this.ride === "frog" || this.ride === "dino" ? 1.15 : 1); }
  private doJump(v = this.jumpV()) {
    this.vy = v;
    this.air = true; this.slideT = 0; this.jumpBuf = 0; this.stats.jumps++;
    this.events.push({ t: "jump" });
  }
  slide() {
    if (!this.canAct() || this.glideT > 0 || this.boostT > 0 || this.swing) return;
    if (this.air) { this.vy = Math.min(this.vy, SLAM_V); this.events.push({ t: "slam" }); }
    else { this.events.push({ t: "slide" }); this.stats.slides++; }
    this.slideT = SLIDE_T;
  }
  /** the Smoothie Rush (double-tap or the button when the meter is full) */
  rush() {
    if (!this.canAct() || this.meter < METER || this.boostT > 0) return false;
    this.meter = 0; this.rushing = true; this.boostX = 3; this.boostT = boostTime(3, true);
    this.swing = null; this.slideT = 0; this.stats.rushes++;
    this.events.push({ t: "boost", x: 3, on: true, rush: true });
    return true;
  }

  // ---------------------------------------------------------------- the world around Kiko
  /** obstacles whose near edge is between a and b metres of track (branches, bridges and mud are split into ≤ 20 m pieces) */
  near(a: number, b: number, fn: (o: Ob) => void) {
    const obs = this.track.obs;
    let lo = 0, hi = obs.length;
    const from = a - 26;
    while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].z < from) lo = m + 1; else hi = m; }
    for (let i = lo; i < obs.length && obs[i].z < b + 2; i++) fn(obs[i]);
  }
  /** a vine (or zipline handle) Kiko can grab right now */
  vineNear(z = this.z, x = this.x): Vine | null {
    for (const v of this.track.vines) {
      if (v.z - 3.5 > z) break;
      if (v.used || z > v.z + 0.6) continue;
      if (Math.abs(x - v.lane * LW) < 1.35) return v;
    }
    return null;
  }
  /** the ground under Kiko: ramps, the branch road, rocks, lily pads, bridges, the raft — or nothing (pits, chasms, rivers, lava);
   *  a ride carries Kiko over all of those */
  surface(x: number, y: number, z: number, riding = this.rideT > 0): { h: number; id: number; kind: ObKind | "raft" | null } {
    const li = Math.max(-1, Math.min(1, Math.round(x / LW)));
    const zone = this.track.zoneAt(z);
    let h = zone ? (zone.raft ? RAFT_Y : riding ? 0 : -30) : 0, id = 0, kind: ObKind | "raft" | null = zone?.raft ? "raft" : null, gap = false;
    this.near(z - 4, z + 1, (o) => {
      if (o.lane !== li || o.smashed) return;
      if (z < o.z - KIKO_Z * 0.5 || z > o.z + o.len + KIKO_Z * 0.5) return;
      switch (o.kind) {
        case "ramp": { const r = BR_H * Math.max(0, Math.min(1, (z - o.z) / o.len)); if (r > h && y >= r - 0.7) { h = r; id = o.id; kind = "ramp"; } break; }
        case "gap": if (z > o.z + 0.2 && z < o.z + o.len - 0.2) gap = true; break;
        case "branch": if (y >= BR_H - 0.45 && BR_H > h) { h = BR_H; id = o.id; kind = "branch"; } break;
        case "lily": case "bridge": { const p = PAD_H[o.kind] ?? 0; if (y >= p - 0.45 && p > h) { h = p; id = o.id; kind = o.kind; } break; }
        case "bounce": if (y >= -0.2 && y < 1.2 && TOP.bounce > h) { h = TOP.bounce; id = o.id; kind = "bounce"; } break;
        case "rock": if (y >= top(o) - 0.45 && top(o) > h) { h = top(o); id = o.id; kind = "rock"; } break;
        default: break;
      }
    });
    if (gap && h === 0 && !riding) return { h: -30, id: 0, kind: "gap" };
    return { h, id, kind };
  }
  /** solid ground for the next few metres (glides, boosters and rides only end over it) */
  private safeAhead() {
    for (let d = 0; d <= Math.max(6, this.base * 0.7); d += 1.5) if (this.surface(this.lane * LW, 0, this.z + d, false).h < -1) return false;
    return true;
  }
  private solid(o: Ob, t = this.t) {
    if (o.smashed || ZONE.has(o.kind)) return false;
    if (o.kind === "geyser") return geyserOn(o, t);
    return true;
  }
  /** would something in this lane hit Kiko very soon? */
  private dangerIn(lane: number) {
    let hit = false;
    const reach = (this.speed + 6) * 0.32;
    this.near(this.z, this.z + reach, (o) => {
      if (hit || o.lane !== lane || !this.solid(o) || o.hit || o.passed) return;
      const z0 = obZ(o, this.z);
      if (z0 < this.z + KIKO_Z || z0 > this.z + reach) return;
      if (this.y >= top(o) - 0.05 || this.y + this.h() <= bottom(o)) return;
      hit = true;
    });
    return hit;
  }
  h() { return this.slideT > 0 && !this.air ? SLIDE_H : this.slideT > 0 ? 0.75 : KIKO_H; }
  /** how fast lane changes are: slippery ice, rain and snow slow them; Rolo the red panda speeds them up */
  private laneV() {
    const w = this.sec.weather;
    return LANE_V * (this.slipT > 0 ? 1.4 : 1) * (this.onIce && !this.air ? 0.45 : 1) * (w === "rain" || w === "storm" || w === "snow" ? 0.85 : 1) * (this.ride === "panda" ? 1.4 : 1);
  }

  // ---------------------------------------------------------------- step
  step(dt: number) {
    if (this.phase !== "play") return;
    this.t += dt;
    if (this.ouchT > 0) { this.ouch(dt); return; }
    if (this.holdT > 0) { this.holdT -= dt; this.y = Math.max(this.y, 0); this.speed = 0; return; }
    if (this.bot) this.think(dt);
    this.sec = this.track.section(this.z);
    this.base = this.track.speedAt(this.z);
    this.speed = this.base * (this.boostT > 0 ? this.boostX : 1) * (this.rideT > 0 ? 1.15 : 1) * (this.slideZone ? 1.15 : 1) * (this.chaser ? 1.1 : 1)
      * (this.stuckT > 0 ? 0.45 : 1) * (this.inMud && !this.air && this.rideT <= 0 && this.boostT <= 0 ? 0.62 : 1);
    const y0 = this.y;
    this.z += this.speed * dt;
    this.track.extend(this.z);
    this.timers(dt);
    this.progress(dt);

    // sideways
    const tx = this.lane * LW, mx = this.laneV() * dt;
    this.x += Math.max(-mx, Math.min(mx, tx - this.x));
    this.groundZones();

    // up and down
    if (this.glideT > 0) { this.y += (SKY_Y - this.y) * Math.min(1, dt * 3.5); this.vy = 0; this.air = true; }
    else if (this.boostT > 0) { this.y += (BOOST_Y - this.y) * Math.min(1, dt * 4); this.vy = 0; this.air = true; }
    else if (this.ride === "pelican" && this.rideT > 0) { this.y += (2.2 - this.y) * Math.min(1, dt * 4); this.vy = 0; this.air = true; }
    else if (this.swing) this.swingStep();
    else {
      const s = this.surface(this.x, this.y, this.z);
      if (!this.air) {
        if (s.h < this.y - 0.08) { this.air = true; this.vy = 0; }
        else { this.y = s.h; if (s.kind === "bounce") this.bounce(s.id); else if (this.ride === "frog" && this.rideT > 0) this.doJump(7.5); }
      }
      if (this.air) {
        this.vy -= G * dt;
        this.y += this.vy * dt;
        const s2 = this.surface(this.x, Math.max(this.y, y0), this.z);
        if (this.y <= s2.h && this.vy <= 0 && s2.h > -1) {
          const v = this.vy;
          this.y = s2.h; this.vy = 0; this.air = false;
          if (s2.kind === "bounce") this.bounce(s2.id);
          else { this.events.push({ t: "land", v }); if (this.jumpBuf > 0) this.doJump(); }
        }
        // jumping into a vine grabs it
        if (this.air && !this.swing && this.y > 0.2 && this.rideT <= 0) { const v = this.vineNear(); if (v && this.z >= v.z - 1.8) this.startSwing(v); }
      }
      if (!this.swing) {
        const zn = this.track.zoneAt(this.z);
        if ((zn?.kind === "water" || zn?.kind === "lava") && !zn.raft && this.y < -0.45) {
          this.events.push({ t: "splash", x: this.x, z: this.z, lava: zn.kind === "lava" }); this.hurt(zn.kind === "lava" ? "lava" : "water"); return;
        }
        if (this.y < -1.1) { this.hurt("fall"); return; }
        this.branchRun(this.air ? (this.onBranch ? "branch" : null) : s.kind);
      }
    }
    if (this.slideT > 0) this.slideT -= dt;
    if (!(this.glideT > 0 && this.y > 3) && !this.swing) this.collide(y0);
    this.pickup();
  }
  /** mud, ice and gusts under Kiko */
  private groundZones() {
    const li = Math.max(-1, Math.min(1, Math.round(this.x / LW)));
    let mud = false, ice = false;
    this.near(this.z - 2, this.z + 1, (o) => {
      if (o.lane !== li || this.z < o.z || this.z > o.z + o.len) return;
      if (o.kind === "mud") { mud = true; if (!o.used && !this.air && this.rideT <= 0) { o.used = true; this.events.push({ t: "mud" }); } }
      else if (o.kind === "ice") ice = true;
      else if (o.kind === "gust" && !o.used && this.rideT <= 0 && this.boostT <= 0 && !this.swing) {
        o.used = true;
        const to = Math.max(-1, Math.min(1, this.lane + (o.dir ?? 1)));
        if (to !== this.lane) { this.lastLane = this.lane; this.lane = to; }
        this.events.push({ t: "gust", dir: o.dir ?? 1 });
      }
    });
    this.inMud = mud; this.onIce = ice;
  }
  private ouch(dt: number) {
    this.ouchT -= dt;
    if (this.ouchBy === "fall" || this.ouchBy === "water" || this.ouchBy === "lava") { this.vy -= G * dt * 0.6; this.y = Math.max(-14, this.y + this.vy * dt); }
    if (this.ouchT > 0) return;
    if (this.hearts <= 0) { this.end(); return; }
    this.respawn();
  }
  private timers(dt: number) {
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.invT > 0) this.invT -= dt;
    if (this.slipT > 0) this.slipT -= dt;
    if (this.wobbleT > 0) this.wobbleT -= dt;
    if (this.stuckT > 0) this.stuckT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    const end = (k: "helmetT" | "magnetT" | "doubleT" | "glideT", id: PowerId) => {
      if (this[k] > 0) {
        this[k] -= dt;
        if (this[k] <= 0) {
          if (id === "glide" && !this.safeAhead()) { this[k] = 0.05; return; }
          this[k] = 0; this.events.push({ t: "powerEnd", id });
          if (id === "glide") { this.invT = Math.max(this.invT, 1.2); this.vy = 0; }
        }
      }
    };
    end("helmetT", "helmet"); end("magnetT", "magnet"); end("doubleT", "double"); end("glideT", "glide");
    if (this.rideT > 0) {
      this.rideT -= dt;
      if (this.rideT <= 0) {
        if (!this.safeAhead()) this.rideT = 0.05;
        else { const r = this.ride!; this.rideT = 0; this.ride = null; this.invT = Math.max(this.invT, 1.4); this.events.push({ t: "ride", id: r, on: false }); }
      }
    }
    if (this.boostT > 0) {
      this.boostT -= dt;
      if (this.boostT <= 0) {
        if (!this.safeAhead()) { this.boostT = 0.05; return; }
        this.boostT = 0; this.boostX = 1; this.invT = 2; this.vy = 0;
        this.events.push({ t: "boost", x: 1, on: false, rush: this.rushing });
        this.rushing = false;
      }
    }
    this.score += this.base * dt * this.mul();
  }
  mul() { return this.mult * (this.doubleT > 0 ? 2 : 1) * (this.boostT > 0 ? this.boostX : 1); }

  /** new places and regions, checkpoints, rafts and slides, chasers, the boss chase, a bigger heart limit */
  private progress(dt: number) {
    const tr = this.track;
    const n = tr.stageAt(this.z);
    if (n > this.placeN) {
      this.placeN = n; this.places++;
      this.events.push({ t: "place", n });
      const mx = heartMax(n);
      if (mx > this.maxHearts) { this.maxHearts = mx; this.hearts = Math.min(mx, this.hearts + 1); this.events.push({ t: "maxUp", max: mx }); }
    }
    while (this.regionI < tr.regions.length && tr.regions[this.regionI].z <= this.z) {
      const r = tr.regions[this.regionI++];
      this.regions++;
      this.events.push({ t: "region", n: r.n });
    }
    while (this.flagI < tr.flags.length && tr.flags[this.flagI] <= this.z) {
      if (this.flagI > 0 || tr.flags[0] > 5) this.events.push({ t: "flag" });
      this.flagI++;
    }
    const zn = tr.zoneAt(this.z), raft = !!zn?.raft, slide = zn?.slide ?? null;
    if (raft !== this.onRaft || slide !== this.slideZone) {
      this.onRaft = raft; this.slideZone = slide;
      if (raft) this.stats.rafts++;
      this.events.push({ t: "raft", on: raft, slide: slide ?? undefined });
    }
    let ch: string | null = null;
    for (const c of tr.chasers) if (this.z >= c.z0 && this.z < c.z1) ch = c.what;
    if (ch !== this.chaser) { if (ch) this.met.add(`chaser:${ch}`); this.events.push({ t: "chaser", on: !!ch, what: ch ?? this.chaser ?? undefined }); this.chaser = ch; }
    const c = tr.chases[this.chaseI];
    if (c) {
      if (this.chase == null && !this.beaten && this.z >= c.z0 && this.z < c.z1) {
        this.chase = c.id; this.pads = 0; this.boss = c.boss; this.throwT = 3; this.met.add(`boss:${c.boss}`);
        this.events.push({ t: "chase", on: true, boss: c.boss });
      }
      if (this.chase === c.id) {
        this.throwT -= dt;
        if (this.throwT <= 0) { this.throwT = Math.max(1.6, 3.2 - this.sec.d * 1.6) * (0.8 + this.rand() * 0.4); this.bossThrow(); }
        if (this.pads >= 3) {
          // caught! the boss drops the Golden Seed, and every heart comes back
          this.seeds++; this.stats.seeds++; this.stats.bosses++; this.beaten = true;
          this.score += 1500 * this.mul();
          this.hearts = this.maxHearts;
          this.met.add(`beat:${c.boss}`);
          this.events.push({ t: "caught" }); this.events.push({ t: "chase", on: false });
          this.chase = null;
        }
      }
      if (this.z >= c.z1) {
        if (this.chase === c.id) { this.events.push({ t: "escaped" }); this.events.push({ t: "chase", on: false }); }
        this.chase = null; this.boss = null; this.beaten = false; this.chaseI++;
      }
    }
  }
  /** the boss throws something into a lane ahead (it lands before Kiko gets there — watch the shadow) */
  private bossThrow() {
    const ahead = this.z + Math.max(16, this.base * 1.7);
    if (this.track.zoneAt(ahead) || this.track.zoneAt(ahead + 4)) return;
    const lanes = [-1, 0, 1].filter((l) => { let busy = false; this.near(ahead - 4, ahead + 4, (o) => { if (o.lane === l && !ZONE.has(o.kind)) busy = true; }); return !busy; });
    if (lanes.length < 2) return;
    const lane = lanes[Math.floor(this.rand() * lanes.length)];
    const o: Ob = { id: 9e6 + Math.floor(this.t * 100), kind: "coco", lane, z: ahead, len: 0.7, y: 0, k: 0, thrown: true };
    const obs = this.track.obs;
    let i = obs.length; while (i > 0 && obs[i - 1].z > o.z) i--;
    obs.splice(i, 0, o);
    this.events.push({ t: "throw", lane });
  }
  private branchRun(kind: ObKind | "raft" | null) {
    const on = kind === "branch" || (kind === "ramp" && this.y > 1);
    if (on === this.onBranch) return;
    if (on) { this.branchFrom = this.z; this.stats.branches++; }
    else if (this.z - this.branchFrom > 32) this.trick("highroad");
    this.onBranch = on;
    this.events.push({ t: "branch", on });
  }
  private bounce(id: number) {
    this.vy = BOUNCE_V; this.air = true; this.slideT = 0; this.jumpBuf = 0;
    this.lastBounce = { id, t: this.t };
    this.stats.bounces++;
    this.events.push({ t: "bounce" });
    this.trick("bounce");
  }
  private startSwing(v: Vine) {
    v.used = true;
    this.swing = { v, z0: this.z, z1: v.z + v.len, y0: Math.max(0.2, this.y) };
    this.air = true; this.vy = 0; this.slideT = 0; this.jumpBuf = 0;
    if (v.zip) this.stats.ziplines++; else this.stats.vines++;
    this.events.push({ t: "grab", id: v.id, zip: v.zip });
  }
  private swingStep() {
    const sw = this.swing!;
    const f = Math.min(1, (this.z - sw.z0) / Math.max(1, sw.z1 - sw.z0));
    if (sw.v.zip) {
      // a zipline: up to the handle, then down the cable with a little sag
      const path = 2.5 + (sw.v.toY + 0.3 - 2.5) * f - 0.45 * Math.sin(Math.PI * f);
      this.y = sw.y0 + (path - sw.y0) * Math.min(1, f * 8);
    } else this.y = sw.y0 + (sw.v.toY + 0.5 - sw.y0) * f + 2.1 * Math.sin(Math.PI * f);
    if (f >= 1) {
      this.swing = null; this.vy = sw.v.zip ? 1 : 3.5; this.air = true;
      this.events.push({ t: "release" });
      this.trick(sw.v.zip ? "zip" : "vine");
    }
  }

  private collide(y0: number) {
    const h = this.h();
    this.near(this.z - 3, this.z + 3, (o) => {
      if (o.smashed || o.kind === "ramp" || o.kind === "branch" || o.kind === "lily" || o.kind === "bridge" || o.kind === "gap" || o.kind === "bounce" || o.kind === "mud" || o.kind === "ice" || o.kind === "gust") return;
      const cz = obZ(o, this.z), cz1 = cz + o.len;
      if (!o.passed && cz1 < this.z - KIKO_Z) {
        o.passed = true;
        const critter = CRITTER[o.kind];
        if (critter) this.met.add(critter);
        if (!o.hit && o.over && (o.kind === "roller" || o.kind === "croc")) this.trick("jumpOver");
        if (!o.hit && o.over && (o.kind === "low" || o.kind === "hive" || o.kind === "web") && this.slideT > 0) this.trick("slide");
        if (!o.hit && o.over && o.kind === "peel") this.trick("peelHop");
        if (!o.hit && o.thrown && Math.abs(this.x - o.lane * LW) < 2.5) this.trick("dodge");
        return;
      }
      if (o.hit) return;
      if (this.z + KIKO_Z <= cz || this.z - KIKO_Z >= cz1) return;
      const ox = o.lane * LW;
      if (Math.abs(this.x - ox) > HALF_W + KIKO_X - 0.12) return;
      if (o.kind === "peel") {
        if (this.air || this.y > o.y + 0.3) { o.over = true; return; }
        if (o.used || this.boostT > 0 || this.rideT > 0) return;
        o.used = true; this.slip();
        return;
      }
      if (o.kind === "geyser" && !geyserOn(o, this.t)) return;
      const tp = top(o), bt = bottom(o);
      if (this.y >= tp - 0.03) { o.over = true; return; }
      if (this.y + h <= bt) { o.over = true; return; }
      if (o.kind === "web") {
        // sticky! Kiko is slowed for a moment (no harm done)
        if (this.boostT > 0 || this.rideT > 0) { this.smash(o); return; }
        if (!o.used) { o.used = true; o.hit = true; this.stuckT = 0.9; this.wobbleT = 0.5; this.combo = 0; this.met.add("spider"); this.events.push({ t: "stuck" }); }
        return;
      }
      // touching it: land on rocks, hop off rolling coconuts and crocs
      if (o.kind === "rock" && y0 >= tp - 0.45 && this.vy <= 0.5) { this.y = tp; this.air = false; this.vy = 0; return; }
      if ((o.kind === "roller" || o.kind === "croc") && this.air && this.vy < 0 && y0 >= tp - 0.55) {
        o.over = true; this.vy = JUMP_V * 0.85;
        if (o.kind === "croc") { this.stats.crocHops++; this.trick("crocHop"); } else this.trick("jumpOver");
        return;
      }
      if (this.boostT > 0 || this.rideT > 0) { this.smash(o); return; }
      if (this.invT > 0) return;
      const frontal = Math.abs(this.x - ox) < 0.8;
      if (frontal) { o.hit = true; this.hurt(o.kind, o); return; }
      o.hit = true;
      const away = Math.sign(this.x - ox) || (this.lastLane > o.lane ? 1 : -1);
      this.lane = Math.max(-1, Math.min(1, o.lane + away));
      this.stumble(away);
    });
  }
  private smash(o: Ob) {
    o.smashed = true; o.hit = true;
    this.stats.smashes++;
    this.score += 40 * this.mul();
    this.events.push({ t: "smash", kind: o.kind });
    if (this.stats.smashes % 3 === 0) this.trick("smash");
  }
  private slip() {
    const opts = [-1, 1].map((d) => this.lane + d).filter((l) => l >= -1 && l <= 1);
    this.lastLane = this.lane;
    this.lane = opts[Math.floor(this.rand() * opts.length)] ?? this.lane;
    this.slipT = 0.7; this.slideT = 0;
    this.events.push({ t: "slip" });
    this.trick("wheee");
  }
  /** a side bump: Kiko wobbles and drops some bananas */
  private stumble(side: number) {
    if (this.helmetT > 0) { this.helmetT = 0; this.invT = 0.8; this.events.push({ t: "helmetPop" }); this.events.push({ t: "powerEnd", id: "helmet" }); return; }
    const lost = Math.min(10, this.stats.bananas);
    this.stats.bananas -= lost;
    this.stats.stumbles++;
    this.wobbleT = 0.6; this.invT = 0.5; this.combo = 0;
    this.events.push({ t: "stumble", side, lost });
  }
  /** a head-on hit or a fall: lose a heart, then back to the last banana flag */
  private hurt(by: ObKind | "fall" | "water" | "croc" | "lava", o?: Ob) {
    if (this.ouchT > 0 || this.phase !== "play") return;
    const falling = by === "fall" || by === "water" || by === "lava";
    if (!falling && this.helmetT > 0) {
      this.helmetT = 0; this.invT = 1.2; if (o) o.smashed = true;
      this.events.push({ t: "helmetPop" }); this.events.push({ t: "powerEnd", id: "helmet" });
      return;
    }
    this.hearts = Math.max(0, this.hearts - 1);
    this.stats.hurts++; this.combo = 0; this.streak = [];
    this.ouchT = OUCH_T; this.ouchBy = by; this.hurtZ = this.z;
    this.swing = null; this.slideT = 0; this.slipT = 0; this.stuckT = 0;
    if (this.rideT > 0) { const r = this.ride!; this.rideT = 0; this.ride = null; this.events.push({ t: "ride", id: r, on: false }); }
    if (!falling) { this.vy = 0; this.air = false; }
    this.events.push({ t: "hurt", by, hearts: this.hearts });
  }
  private respawn() {
    const tr = this.track;
    let f = tr.flags[0] ?? 0;
    for (const fz of tr.flags) if (fz <= this.hurtZ - 1) f = fz;
    // stuck at the same spot? the forest helps quietly: what hit Kiko is gone, and after a fall Pico carries Kiko over
    this.fails = this.failFlag === f ? this.fails + 1 : 1; this.failFlag = f;
    const help = this.fails >= 2;
    // re-arm everything between the flag and where Kiko fell (thrown things are cleared away)
    this.near(f - 4, this.hurtZ + 40, (o) => {
      if (o.z + o.len < f - 4) return;
      if (o.thrown || (help && o.hit && o.z <= this.hurtZ + 3)) o.smashed = true;
      o.hit = false; o.passed = false; o.over = false; o.used = false;
    });
    for (const v of tr.vines) if (v.z >= f - 2) v.used = false;
    const laneOk = (l: number) => { for (let d = -1; d < 14; d += 1) if (this.surface(l * LW, 0, f + d, false).h < -1) return false; return true; };
    const lane = [this.lane, 0, -1, 1].find(laneOk) ?? 0;
    this.z = f; this.lane = this.lastLane = lane; this.x = lane * LW; this.y = Math.max(0, this.surface(this.x, 0, f, false).h);
    this.vy = 0; this.air = false; this.slideT = 0; this.swing = null; this.onBranch = false;
    this.holdT = HOLD_T; this.invT = 2.0; this.speed = 0; this.throwT = 3;
    this.flagI = tr.flags.findIndex((fz) => fz > f + 0.5); if (this.flagI < 0) this.flagI = tr.flags.length;
    this.events.push({ t: "respawn" });
    if (help && (this.ouchBy === "fall" || this.ouchBy === "water" || this.ouchBy === "lava")) { this.glideT = this.ptime("glide"); this.skyBananas(); this.events.push({ t: "power", id: "glide" }); }
  }

  private trick(kind: TrickKind) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 4;
    this.stats.tricks++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const pts = Math.round(TRICK_PTS[kind] * (1 + 0.25 * (this.combo - 1)) * this.mul());
    this.score += pts;
    this.events.push({ t: "trick", kind, pts, combo: this.combo });
  }

  // ---------------------------------------------------------------- bananas, fruits and goodies
  private pickup() {
    const items = this.track.items, z = this.z;
    let lo = 0, hi = items.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].z < z - 2) lo = m + 1; else hi = m; }
    for (let i = lo; i < items.length && items[i].z < z + 12; i++) {
      const it = items[i];
      if (it.got) continue;
      const dx = Math.abs(this.x - it.lane * LW), dz = it.z - z;
      const dy = it.y - (this.y + 0.6);
      let take = false, pull = false;
      if (it.kind === "banana") {
        if (dx < 0.95 && Math.abs(dz) < 0.9 && Math.abs(dy) < 1.15) take = true;
        else if ((this.magnetT > 0 || this.boostT > 0) && dx < LW * 1.3 && dz > -1 && dz < 9) { take = true; pull = true; }
      } else if (it.kind === "pad") take = dx < 1.3 && Math.abs(dz) < 1.2 && this.y < 1.4;
      else if (it.kind === "ride") take = dx < 1.2 && Math.abs(dz) < 1.2 && this.y < 2 && this.rideT <= 0 && this.boostT <= 0 && this.glideT <= 0;
      else take = dx < 1.1 && Math.abs(dz) < 1.1 && Math.abs(dy) < (it.kind === "boost" ? 2.4 : 1.6);
      if (!take) continue;
      it.got = true; it.t = this.t;
      this.collect(it, pull);
      // a ride in every lane: the others leave when one is taken
      if (it.kind === "ride") for (let k = lo; k < items.length && items[k].z < z + 12; k++) if (items[k].kind === "ride" && Math.abs(items[k].z - it.z) < 2) items[k].got = true;
    }
  }
  private ptime(p: PowerId) { return POWERS[p].time * (1 + 0.2 * (this.up[p] ?? 0)); }
  private collect(it: Item, pull: boolean) {
    switch (it.kind) {
      case "banana": {
        this.stats.bananas++;
        this.score += 10 * this.mul();
        this.events.push({ t: "banana", id: it.id, line: it.line, idx: it.idx, pull });
        if (it.line) {
          const n = (this.lineGot.get(it.line) ?? 0) + 1;
          this.lineGot.set(it.line, n);
          if (n === this.track.lineLen.get(it.line)) {
            this.stats.melodies++;
            this.score += 100 * this.mul();
            this.events.push({ t: "melody", line: it.line, n });
          }
        }
        if (++this.bananaHeart >= 150) {
          this.bananaHeart = 0;
          if (this.hearts < this.maxHearts) { this.hearts++; this.stats.hearts++; this.events.push({ t: "heart", hearts: this.hearts, max: this.maxHearts, bonus: true }); }
          else this.score += 500 * this.mul();
        }
        break;
      }
      case "fruit": {
        const f = it.fruit ?? "mango";
        this.stats.fruits++;
        this.stats.fruitBy[f] = (this.stats.fruitBy[f] ?? 0) + 1;
        this.score += 50 * this.mul();
        const was = this.meter;
        this.meter = Math.min(METER, this.meter + 1);
        this.events.push({ t: "fruit", id: f, meter: this.meter });
        if (was < METER && this.meter >= METER) this.events.push({ t: "rushReady" });
        if (this.streak.includes(f)) this.streak = [f]; else this.streak.push(f);
        if (this.streak.length >= 5) { this.streak = []; this.stats.salads++; this.events.push({ t: "salad" }); this.trick("salad"); }
        break;
      }
      case "gold": this.stats.golden++; this.score += 250 * this.mul(); this.events.push({ t: "gold", n: this.stats.golden }); break;
      case "heart":
        if (this.hearts < this.maxHearts) { this.hearts++; this.stats.hearts++; this.events.push({ t: "heart", hearts: this.hearts, max: this.maxHearts }); }
        else { this.score += 500 * this.mul(); this.events.push({ t: "heart", hearts: this.hearts, max: this.maxHearts, bonus: true }); }
        break;
      case "rotten":
        if (this.boostT > 0 || this.rideT > 0) break;
        this.meter = Math.max(0, this.meter - 2); this.streak = []; this.wobbleT = 0.7; this.combo = 0;
        this.events.push({ t: "rotten" });
        break;
      case "power": {
        const p = it.power ?? "magnet", time = this.ptime(p);
        this.stats.powers++;
        if (p === "helmet") this.helmetT = time; else if (p === "magnet") this.magnetT = time; else if (p === "double") this.doubleT = time;
        else { this.glideT = time; this.slideT = 0; this.swing = null; this.kite = it.boost === 1; this.skyBananas(); }
        this.events.push({ t: "power", id: p });
        break;
      }
      case "boost": {
        this.stats.boosts++; this.boosts++;
        this.boostX = it.boost ?? 3; this.boostT = boostTime(this.boostX); this.rushing = false; this.slideT = 0; this.swing = null;
        this.events.push({ t: "boost", x: this.boostX, on: true });
        break;
      }
      case "ride": {
        const r = it.ride ?? "turtle";
        this.ride = r; this.rideT = RIDE_T; this.slideT = 0; this.swing = null; this.stats.rides++;
        this.met.add(`ride:${r}`);
        this.events.push({ t: "ride", id: r, on: true });
        break;
      }
      case "pad":
        this.pads++;
        this.events.push({ t: "pad", n: this.pads });
        this.doJump(JUMP_V * 1.25); this.invT = Math.max(this.invT, 0.9);
        break;
      default: break;
    }
  }
  /** the glide is Pico (or a kite) */
  kite = false;
  /** Pico lifts Kiko over a trail of sky bananas */
  private skyBananas() {
    const items = this.track.items;
    let lane = this.lane, n = 0;
    const len = this.base * (this.ptime("glide") - 1);
    for (let z = this.z + 8; z < this.z + len; z += 2.2) {
      if (n++ % 9 === 8) lane = Math.max(-1, Math.min(1, lane + (this.rand() < 0.5 ? -1 : 1)));
      items.push({ id: 1e7 + Math.floor(z * 10) + n, kind: n % 23 === 11 ? "fruit" : "banana", fruit: "dragon", lane, z, y: SKY_Y + 0.6 });
    }
    items.sort((a, b) => a.z - b.z);
  }

  // ---------------------------------------------------------------- the end
  private end() {
    if (this.phase !== "play") return;
    this.phase = "lost";
    this.events.push({ t: "end" });
  }
  result(): SimResult {
    const n = this.track.stageAt(this.z);
    return {
      ...this.stats, score: Math.round(this.score), distance: Math.round(this.z), time: this.t, regions: this.regions,
      bestRegion: Math.min(REGIONS.length, sectionOf(n).r + 1), places: Math.max(1, n - this.spec.start + 1),
      firstPlace: this.spec.start, lastPlace: Math.max(this.placeN, n), met: [...this.met],
    };
  }
  /** the place (stage) Kiko is in, counted from the start of this run */
  get placeIndex() { return this.track.stageAt(this.z) - this.spec.start; }
  get regionOf() { return Math.floor((this.track.stageAt(this.z) - 1) / STAGES_PER_REGION); }

  // ---------------------------------------------------------------- the bot: tries each move a moment ahead
  private think(dt: number) {
    for (let i = this.botQueue.length - 1; i >= 0; i--) {
      if (this.t >= this.botQueue[i].at) { this.doPlan(this.botQueue[i].p); this.botQueue.splice(i, 1); }
    }
    const par = this.skill >= 0.99;
    // vines and ziplines: grab when in reach (a careless kid sometimes misses)
    const v = this.vineNear();
    if (v && !this.swing && this.z >= v.z - 2.6 && this.rideT <= 0) {
      let will = this.botVine.get(v.id);
      if (will == null) { will = par || this.rand() < 0.8 + 0.2 * this.skill; this.botVine.set(v.id, will); }
      if (will) { this.grab(); return; }
    }
    if (this.meter >= METER && this.boostT <= 0 && this.rand() < 0.02) this.rush();
    this.botT -= dt;
    if (this.botT > 0) return;
    this.botT = par ? 0.05 : (0.1 + (1 - this.skill) * 0.16) * (0.75 + this.rand() * 0.5);
    if (this.boostT > 0 || this.glideT > 0) return;
    // steer toward the next vine (also while swinging)
    let vineLane: number | null = null;
    for (const vv of this.track.vines) { if (vv.used || vv.z < this.z - 0.5) continue; if (vv.z > this.z + 34) break; vineLane = vineLane ?? vv.lane; if (vv.lane === this.lane) { vineLane = vv.lane; break; } }
    if (this.swing) { if (vineLane != null && vineLane !== this.lane) this.doPlan({ lane: vineLane, act: 0 }); return; }
    const H = par ? 1.2 : 0.5 + 0.6 * this.skill;
    if (!par && this.rand() < 0.035 * (1 - this.skill)) { this.doPlan({ lane: this.lane + (this.rand() < 0.5 ? -1 : 1), act: 0 }); return; }
    const opts: Plan[] = [];
    for (const l of [this.lane, this.lane - 1, this.lane + 1, this.lane - 2, this.lane + 2]) if (l >= -1 && l <= 1) for (const act of [0, 1, 2] as const) opts.push({ lane: l, act });
    let best: { p: Plan; s: number; then?: Plan; at?: number } | null = null;
    const score = (p: Plan, r: { safe: number; bananas: number }) => r.safe * 100 + r.bananas * 2 - Math.abs(p.lane - this.lane) * 0.6 - (p.act ? 0.8 : 0) - Math.abs(p.lane) * 0.15 + (vineLane != null && p.lane === vineLane ? 30 : 0);
    let stay = 0;
    for (const p of opts) {
      const r = this.predict([p], H), s = score(p, r);
      if (p.lane === this.lane && p.act === 0) stay = r.safe;
      if (!best || s > best.s) best = { p, s };
    }
    // a kid waits for the right moment instead of jumping at the first sign of trouble
    if (!par && best && best.s < H * 100 - 1 && stay >= 0.3) return;
    if (best && best.s < H * 100 - 1 && par) {
      for (const p of opts) for (const q of opts) for (const at of [0.22, 0.45]) {
        if (q.lane === p.lane && q.act === 0) continue;
        const r = this.predict([p, { ...q }], H, at);
        const s = score(q, r) - 1.5;
        if (s > best.s) best = { p, s, then: q, at };
      }
    }
    if (!best) return;
    this.doPlan(best.p);
    if (best.then && best.at) this.botQueue = [{ at: this.t + best.at, p: best.then }];
  }
  /** sweeps: a different careless kid each run */
  botSeed(k: number) { this.botR = (this.botR * 1000 + k * 7777) % 233280; }
  private rand() { this.botR = (this.botR * 9301 + 49297) % 233280; return this.botR / 233280; }
  private doPlan(p: Plan) {
    const l = Math.max(-1, Math.min(1, p.lane));
    for (let i = 0; i < 2 && l !== this.lane; i++) { if (l < this.lane) this.left(); else this.right(); }
    if (p.act === 1 && !this.air && !this.vineNear()) this.jump();
    else if (p.act === 2 && (this.slideT <= 0.1 || this.air)) this.slide();
  }
  /** play a plan forward with Kiko's physics: how long until a hit or a fall, and how many bananas on the way */
  private predict(plans: Plan[], H: number, at2 = 0): { safe: number; bananas: number } {
    const dt = 1 / 30;
    let x = this.x, y = this.y, vy = this.vy, air = this.air, sq = this.slideT, z = this.z, lane = this.lane;
    const sp = this.speed, items = this.track.items, riding = this.rideT > 0, lv = this.laneV();
    let bananas = 0, ii = 0, hi = items.length;
    while (ii < hi) { const k = (ii + hi) >> 1; if (items[k].z < z - 2) ii = k + 1; else hi = k; }
    const apply = (p: Plan) => {
      lane = Math.max(-1, Math.min(1, p.lane));
      if (p.act === 1 && !air) { vy = JUMP_V; air = true; sq = 0; }
      if (p.act === 2) { if (air) vy = Math.min(vy, SLAM_V); sq = SLIDE_T; }
    };
    apply(plans[0]);
    let second = plans.length > 1;
    for (let t = 0; t < H; t += dt) {
      if (second && t >= at2) { apply(plans[1]); second = false; }
      const pz = z, py = y, tt = this.t + t;
      z += sp * dt;
      const mx = lv * dt; x += Math.max(-mx, Math.min(mx, lane * LW - x));
      const s = this.surface(x, y, z, riding);
      if (!air) { if (s.h < y - 0.08) { air = true; vy = 0; } else { y = s.h; if (s.kind === "bounce") { vy = BOUNCE_V; air = true; } } }
      if (air) {
        vy -= G * dt; y += vy * dt;
        const s2 = this.surface(x, Math.max(y, py), z, riding);
        if (y <= s2.h && vy <= 0 && s2.h > -1) { y = s2.h; if (s2.kind === "bounce") vy = BOUNCE_V; else { vy = 0; air = false; } }
        if (!riding && this.vineNear(z, x) && y > 0.2) return { safe: H, bananas };
      }
      if (y < -0.45) return { safe: t, bananas };
      if (sq > 0) sq -= dt;
      const h = sq > 0 && !air ? SLIDE_H : sq > 0 ? 0.75 : KIKO_H;
      if (this.invT <= t && !riding) {
        let bad = false;
        this.near(z - 3, z + 3, (o) => {
          if (bad || o.hit || o.smashed) return;
          if (o.kind === "ramp" || o.kind === "branch" || o.kind === "lily" || o.kind === "bridge" || o.kind === "gap" || o.kind === "bounce" || o.kind === "mud" || o.kind === "ice" || o.kind === "gust") return;
          if (o.kind === "geyser" && !geyserOn(o, tt)) return;
          const ox = o.lane * LW, cz = obZ(o, z);
          if (Math.abs(x - ox) > HALF_W + KIKO_X - 0.12 || z + KIKO_Z <= cz || z - KIKO_Z >= cz + o.len) return;
          if (o.kind === "peel") { if (!air && y < o.y + 0.3 && !o.used) bad = true; return; }
          const tp = top(o);
          if (y >= tp - 0.03 || y + h <= bottom(o)) return;
          if (o.kind === "rock" && py >= tp - 0.45 && vy <= 0.5) return;
          if ((o.kind === "roller" || o.kind === "croc") && air && vy < 0 && py >= tp - 0.5) return;
          bad = true;
        });
        if (bad) return { safe: t, bananas };
      }
      while (ii < items.length && items[ii].z < pz - 1) ii++;
      for (let k = ii; k < items.length && items[k].z <= z + 1; k++) {
        const it = items[k];
        if (it.got || it.kind === "rotten") continue;
        if (Math.abs(it.lane * LW - x) < 0.95 && Math.abs(it.z - z) < 0.9 && Math.abs(it.y - (y + 0.6)) < 1.2) bananas += it.kind === "banana" ? 1 : 8;
      }
    }
    return { safe: H, bananas };
  }
}
void RAMP_LEN;
