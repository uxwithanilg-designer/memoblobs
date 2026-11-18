// Momo Dash! simulation (pure TS — runs in the browser, in Node balance sweeps and in QA). One continuous run, Subway
// style: Momo runs forward on 3 lanes through world after world until caught. Swipe to change lane, jump, squish under
// bars (or slam down in the air). Side bumps are stumbles (the Grumpy Guard chases you; a second one while he is close
// catches you), head-on hits are crashes (a shield, the Jelly Board or the last friend in the conga line saves you).
// Boosters (star power: ×3 for 6 s, or the golden ×5 for 9 s) make Momo fly fast and smash everything; Morph Gates turn Momo into a ball, three
// minis, a giant or a stretchy Momo; portals split the track into a Coin Lane and a Star Lane.
// The same physics drive a look-ahead bot (par = careful, low skill = a careless kid) for balance sweeps and demos.
import { LW, MORPHS, POWERS, RAIL_H, TRAM_H, Track, WORLDS, sectionOf } from "./levels";
import type { FriendId, Item, MorphId, Ob, ObKind, PowerId, RunSpec, RunStats, Section, SimEvent, SimResult, TrickKind } from "./types";

export const G = 28;
export const JUMP_V = 10.5;
const LANE_V = 13.5;
const SQUISH_T = 0.62;
const SLAM_V = -20;
export const MOMO_H = 1.15;
export const SQUISH_H = 0.5;
const MOMO_X = 0.42;
const MOMO_Z = 0.35;
const HALF_W = 0.95;
const SKY_Y = 6.4;
export const BOOST_Y = 1.6;
/** booster time, short and sweet like a star power: ×3 lasts 6 s, the golden ×5 9 s */
export const boostTime = (x: number) => (x >= 5 ? 9 : 6);
export const TOP: Record<ObKind, number> = {
  fence: 0.95, bar: 3.0, block: 2.3, cart: 1.35, tram: TRAM_H, ramp: 0, grumpy: 1.0,
  gap: 0, roller: 1.1, ice: 0, belt: 0, ghost: 2.3, rail: RAIL_H, geyser: 3.4, gust: 0, zoom: 0,
};
const BOTTOM: Partial<Record<ObKind, number>> = { bar: 0.82 };
/** pieces Momo never bumps into (they do something instead) */
const ZONE = new Set<ObKind>(["ramp", "ice", "belt", "gust", "zoom", "gap"]);
const TRICK_PTS: Record<TrickKind, number> = { jumpOver: 150, closeCall: 100, squish: 60, cartHop: 120, bonk: 80, rooftop: 150, railGrind: 140, smash: 40 };
export const TRICK_TEXT: Record<TrickKind, string> = { jumpOver: "JUMP OVER", closeCall: "CLOSE CALL", squish: "SQUISH SLIDE", cartHop: "KART HOP", bonk: "BONK!", rooftop: "ROOFTOP RUN", railGrind: "RAIL GRIND", smash: "SMASH!" };

/** where an obstacle's near edge is right now (karts drive toward Momo, traffic drives away slower) */
export const obZ = (o: Ob, momoZ: number) => (o.k ? o.z + o.k * (o.z - momoZ) : o.z);
/** ghost blocks are solid for 1.6 s, then gone for 1 s */
export const ghostOn = (o: Ob, t: number) => ((t + (o.ph ?? 0)) % 2.6) < 1.6;
/** geysers erupt for 0.75 s every 2.2 s (they glow for the 0.6 s before) */
export const geyserOn = (o: Ob, t: number) => ((t + (o.ph ?? 0)) % 2.2) < 0.75;
export const geyserWarn = (o: Ob, t: number) => ((t + (o.ph ?? 0)) % 2.2) > 1.6;

export interface SimOpts {
  bot?: boolean; skill?: number;
  /** score multiplier from missions */
  mult?: number;
  /** power-up upgrade levels 0–5 (+20 % time each) */
  up?: Partial<Record<PowerId, number>>;
  /** Jelly Boards the player owns (double-tap to ride one) */
  boards?: number;
}
interface Plan { lane: number; act: 0 | 1 | 2 }

export class Sim {
  spec: RunSpec; track: Track; sec: Section;
  phase: "play" | "lost" = "play";
  t = 0; z = 0; speed: number; base: number;
  lane = 0; x = 0; y = 0; vy = 0; air = false; squishT = 0;
  stumbleT = 0; invT = 0; shieldT = 0; magnetT = 0; doubleT = 0; skyT = 0; feverT = 0;
  boostT = 0; boostX = 1; zoomT = 0; boardT = 0; boards: number; boosts = 0;
  morph: { id: MorphId; t: number } | null = null; minis = new Set<number>();
  friends: FriendId[] = []; letters = ""; pads = 0; chase: number | null = null; caught = 0;
  combo = 0; comboT = 0; score = 0; worlds = 0;
  stats: RunStats = { coins: 0, tricks: 0, melodies: 0, friends: 0, stumbles: 0, crashes: 0, bestCombo: 0, jumps: 0, jumpOvers: 0, bonks: 0, powers: 0, roofs: 0, morphs: 0, portals: 0, starPieces: 0, freed: 0, smashes: 0 };
  events: SimEvent[] = [];
  bot: boolean; skill: number; mult: number; up: Partial<Record<PowerId, number>>;
  /** portal choices: portal id → side (0 Coin Lane, 1 Star Lane) */
  branch = new Map<number, number>();
  roof = 0; private roofFrom = 0; private roofKind: ObKind | null = null; private jumpBuf = 0; private lastLane = 0;
  private drift = 0; private cakeT = 15; private snipT = 0; private worldI = 1; private chaseI = 0;
  private lineGot = new Map<number, number>();
  private botT = 0; private botR = 0.5; private botQueue: { at: number; p: Plan }[] = [];

  constructor(spec: RunSpec, o: SimOpts = {}) {
    this.spec = spec; this.track = new Track(spec);
    this.sec = this.track.section(0);
    this.speed = this.base = this.track.speedAt(0);
    this.bot = !!o.bot; this.skill = o.skill ?? 1; this.mult = o.mult ?? 1; this.up = o.up ?? {}; this.boards = o.boards ?? 0;
    this.botR = (spec.seed % 1000) / 1000;
  }

  // ---------------------------------------------------------------- input
  left() { this.move(-1); }
  right() { this.move(1); }
  private move(dir: number) {
    if (this.phase !== "play" || this.morph?.id === "split") return;
    const to = Math.max(-1, Math.min(1, this.lane + dir));
    if (to === this.lane) return;
    const danger = this.dangerIn(this.lane);
    this.lastLane = this.lane; this.lane = to; this.drift = 0;
    this.events.push({ t: "lane", dir });
    if (danger) this.trick("closeCall");
  }
  jump() {
    if (this.phase !== "play" || this.skyT > 0 || this.boostT > 0) return;
    if (this.air) { this.jumpBuf = 0.16; return; }
    this.doJump();
  }
  private jumpV(big = false) {
    return JUMP_V * this.sec.jump * (this.friends.includes("bolt") ? 1.1 : 1) * (this.boardT > 0 ? 1.12 : 1) * (this.morph?.id === "stretch" ? 1.15 : 1) * (big ? 1.25 : 1);
  }
  private doJump(big = false) {
    this.vy = this.jumpV(big);
    this.air = true; this.squishT = 0; this.jumpBuf = 0; this.stats.jumps++;
    this.events.push({ t: "jump", big });
  }
  squish() {
    if (this.phase !== "play" || this.skyT > 0 || this.boostT > 0) return;
    if (this.air) { this.vy = Math.min(this.vy, SLAM_V); this.events.push({ t: "slam" }); }
    else this.events.push({ t: "squish" });
    this.squishT = SQUISH_T;
  }
  /** double-tap: ride a Jelly Board (saves one crash, jumps higher, 30 s) */
  useBoard() {
    if (this.phase !== "play" || this.boardT > 0 || this.boards <= 0) return false;
    this.boards--; this.boardT = 30;
    this.events.push({ t: "board", on: true });
    return true;
  }

  // ---------------------------------------------------------------- the world around Momo
  /** is this on the track for us (portal branches only exist once chosen) */
  vis(e: { br?: number }) { return e.br == null || this.branch.get(e.br >> 1) === (e.br & 1); }
  /** obstacles whose near edge is between a and b metres of track */
  near(a: number, b: number, fn: (o: Ob) => void) {
    const obs = this.track.obs;
    let lo = 0, hi = obs.length;
    const from = a - 26;
    while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].z < from) lo = m + 1; else hi = m; }
    for (let i = lo; i < obs.length && obs[i].z < b + 2; i++) if (this.vis(obs[i])) fn(obs[i]);
  }
  solid(o: Ob, t = this.t) {
    if (o.smashed || ZONE.has(o.kind)) return false;
    if (o.kind === "ghost") return ghostOn(o, t);
    if (o.kind === "geyser") return geyserOn(o, t);
    return true;
  }
  /** the ground under Momo: ramps, roofs of trams, blocks and rails, and gaps */
  surface(x: number, y: number, z: number, t = this.t): { h: number; id: number; kind: ObKind | null } {
    const li = Math.max(-1, Math.min(1, Math.round(x / LW)));
    let h = 0, id = 0, kind: ObKind | null = null, gap = false;
    this.near(z - 4, z + 1, (o) => {
      if (o.lane !== li || o.smashed) return;
      if (z < o.z - MOMO_Z * 0.5 || z > o.z + o.len + MOMO_Z * 0.5) return;
      if (o.kind === "ramp") { const r = TRAM_H * Math.max(0, Math.min(1, (z - o.z) / o.len)); if (r > h) { h = r; id = 0; kind = "ramp"; } }
      else if (o.kind === "gap") { if (z > o.z + 0.2 && z < o.z + o.len - 0.2) gap = true; }
      else if ((o.kind === "tram" || o.kind === "block" || o.kind === "rail" || (o.kind === "ghost" && ghostOn(o, t))) && y >= TOP[o.kind] - 0.4) { if (TOP[o.kind] > h) { h = TOP[o.kind]; id = o.id; kind = o.kind; } }
    });
    if (gap && h === 0 && this.morph?.id !== "giant") return { h: -30, id: 0, kind: "gap" };
    return { h, id, kind };
  }
  private zoneLane(li: number, z: number, kind: ObKind): Ob | null {
    let hit: Ob | null = null;
    this.near(z - 4, z + 1, (o) => { if (!hit && o.kind === kind && o.lane === li && z >= o.z && z <= o.z + o.len) hit = o; });
    return hit;
  }
  private zoneAt(kind: ObKind) { return this.zoneLane(Math.max(-1, Math.min(1, Math.round(this.x / LW))), this.z, kind); }
  /** would something in this lane hit Momo very soon? */
  private dangerIn(lane: number) {
    let hit = false;
    const reach = (this.speed + 6) * 0.32;
    this.near(this.z, this.z + reach, (o) => {
      if (hit || o.lane !== lane || !this.solid(o) || o.hit || o.passed) return;
      const z0 = obZ(o, this.z);
      if (z0 < this.z + MOMO_Z || z0 > this.z + reach) return;
      if (this.y >= TOP[o.kind] - 0.05 || this.y + this.h() <= (BOTTOM[o.kind] ?? 0)) return;
      hit = true;
    });
    return hit;
  }
  h() {
    const m = this.morph?.id, sq = this.squishT > 0;
    if (m === "giant") return 2.6;
    if (m === "ball") return 0.85;
    if (m === "stretch") return sq ? 0.6 : 2.0;
    return sq && !this.air ? SQUISH_H : sq ? 0.75 : MOMO_H;
  }
  /** Momo smashes things (booster, giant, ball) */
  private smasher(o: Ob) {
    if (this.boostT > 0 || this.morph?.id === "giant") return true;
    if (this.morph?.id === "ball") return o.kind !== "tram" && o.kind !== "bar" && o.kind !== "geyser";
    return false;
  }

  // ---------------------------------------------------------------- step
  step(dt: number) {
    if (this.phase !== "play") return;
    this.t += dt;
    if (this.bot) this.think(dt);
    this.sec = this.track.section(this.z);
    this.base = this.track.speedAt(this.z);
    this.speed = this.base * (this.boostT > 0 ? this.boostX : 1) * (this.zoomT > 0 ? 1.45 : 1);
    const z0 = this.z, y0 = this.y;
    this.z += this.speed * dt;
    this.track.extend(this.z);
    this.timers(dt);
    this.worldsAndZones();

    // sideways: ice is slippery, belts push, Turbo is quick, giants are slow
    const split = this.morph?.id === "split";
    const onIce = !this.air && !!this.zoneAt("ice");
    const lv = LANE_V * (this.friends.includes("turbo") ? 1.35 : 1) * (onIce ? 0.45 : 1) * (this.morph?.id === "giant" ? 0.75 : 1);
    const tx = split ? 0 : this.lane * LW, mx = lv * dt;
    this.x += Math.max(-mx, Math.min(mx, tx - this.x));
    if (!this.air && !split && this.boostT <= 0) {
      const belt = this.zoneAt("belt");
      if (belt?.dir) {
        this.drift += belt.dir * 2.8 * dt;
        if (Math.abs(this.drift) > LW * 0.55) { const to = Math.max(-1, Math.min(1, this.lane + Math.sign(this.drift))); if (to !== this.lane) { this.lastLane = this.lane; this.lane = to; this.events.push({ t: "belt", dir: Math.sign(this.drift) }); } this.drift = 0; }
      } else this.drift = 0;
    }
    if (!split && this.boostT <= 0) this.near(this.z - 1, this.z + 1, (o) => {
      if (o.kind !== "gust" || o.used || this.z < o.z || this.z > o.z + o.len) return;
      o.used = true;
      const to = Math.max(-1, Math.min(1, this.lane + (o.dir ?? 1)));
      if (to !== this.lane) { this.lastLane = this.lane; this.lane = to; }
      this.events.push({ t: "gust", dir: o.dir ?? 1 });
    });
    this.near(this.z - 1, this.z + 1, (o) => {
      if (o.kind !== "zoom" || o.used || this.air || Math.abs(this.x - o.lane * LW) > 1 || this.z < o.z || this.z > o.z + o.len) return;
      o.used = true; this.zoomT = 1.3; this.invT = Math.max(this.invT, 1.4);
      this.events.push({ t: "zoom" });
    });

    // up and down
    const g = G * this.sec.grav;
    if (this.skyT > 0) { this.y += (SKY_Y - this.y) * Math.min(1, dt * 3.5); this.vy = 0; this.air = true; }
    else if (this.boostT > 0) { this.y += (BOOST_Y - this.y) * Math.min(1, dt * 4); this.vy = 0; this.air = true; }
    else {
      const s = this.surface(this.x, this.y, this.z);
      if (!this.air) {
        if (s.h < this.y - 0.08) { this.air = true; this.vy = 0; }
        else this.y = s.h;
      }
      if (this.air) {
        this.vy -= g * dt;
        this.y += this.vy * dt;
        const s2 = this.surface(this.x, Math.max(this.y, y0), this.z);
        if (this.y <= s2.h && this.vy <= 0 && s2.h > -1) {
          const v = this.vy;
          this.y = s2.h; this.vy = 0; this.air = false;
          this.events.push({ t: "land", v });
          if (this.jumpBuf > 0) this.doJump();
        }
      }
      if (this.y < -1.1) this.fall();
      this.roofTrick(this.air ? this.roof : s.id, s.kind);
    }
    if (this.squishT > 0) this.squishT -= dt;

    if (!(this.skyT > 0 && this.y > 3)) this.collide(z0, y0);
    this.pickup();
    this.honk();
    this.friendPowers(dt);
  }

  private timers(dt: number) {
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.stumbleT > 0) this.stumbleT -= dt;
    if (this.invT > 0) this.invT -= dt;
    if (this.zoomT > 0) this.zoomT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    const end = (k: "shieldT" | "magnetT" | "doubleT" | "skyT", id: PowerId) => {
      if (this[k] > 0) { this[k] -= dt; if (this[k] <= 0) { this[k] = 0; this.events.push({ t: "powerEnd", id }); if (id === "sky") { this.invT = 1.2; this.vy = 0; } } }
    };
    end("shieldT", "shield"); end("magnetT", "magnet"); end("doubleT", "double"); end("skyT", "sky");
    if (this.feverT > 0) { this.feverT -= dt; if (this.feverT <= 0) this.events.push({ t: "fever", on: false }); }
    if (this.boardT > 0) { this.boardT -= dt; if (this.boardT <= 0) { this.boardT = 0; this.events.push({ t: "board", on: false }); } }
    if (this.boostT > 0) {
      this.boostT -= dt;
      if (this.boostT <= 0) { this.boostT = 0; this.boostX = 1; this.invT = 2; this.vy = 0; this.events.push({ t: "boost", x: 1, on: false }); }
    }
    if (this.morph) {
      this.morph.t -= dt;
      if (this.morph.t <= 0) this.unmorph();
    }
    this.score += this.base * dt * this.mul();
  }
  mul() { return this.mult * (this.doubleT > 0 ? 2 : 1) * (this.feverT > 0 ? 2 : 1) * (this.boostT > 0 ? this.boostX : 1); }

  /** new worlds, portal choices, chases */
  private worldsAndZones() {
    const tr = this.track;
    while (this.worldI < tr.worlds.length && tr.worlds[this.worldI].z <= this.z) {
      const w = tr.worlds[this.worldI++];
      this.worlds++; this.letters = "";
      this.events.push({ t: "world", n: w.n });
    }
    for (const p of tr.portals) {
      if (this.branch.has(p.id) || this.z < p.z) continue;
      const side = this.x < 0 ? 0 : 1;
      this.branch.set(p.id, side); this.stats.portals++;
      this.events.push({ t: "portal", side });
    }
    const c = tr.chases[this.chaseI];
    if (c) {
      if (this.chase == null && this.z >= c.z0 && this.z < c.z1) { this.chase = c.id; this.pads = 0; this.events.push({ t: "chase", on: true }); }
      if (this.z >= c.z1) {
        if (this.chase === c.id && this.pads >= 3) { this.caught++; this.score += 1500 * this.mul(); this.events.push({ t: "caught" }); }
        if (this.chase === c.id) this.events.push({ t: "chase", on: false });
        this.chase = null; this.chaseI++;
      }
    }
  }

  private roofTrick(id: number, kind: ObKind | null) {
    if (id === this.roof) return;
    if (this.roof && !id) {
      let len = 0;
      this.near(this.z - 40, this.z, (o) => { if (o.id === this.roof) len = o.len; });
      if (len > 0 && this.z - this.roofFrom >= len * 0.7) { if (this.roofKind === "rail") this.trick("railGrind"); else if (this.roofKind === "tram") this.trick("rooftop"); }
    }
    if (id && !this.roof) { this.roofFrom = this.z; this.roofKind = kind; this.stats.roofs++; this.events.push({ t: "roof" }); }
    this.roof = id;
  }

  private collide(z0: number, y0: number) {
    const h = this.h(), split = this.morph?.id === "split";
    const lanes: (number | null)[] = split ? [...this.minis] : [null];
    this.near(this.z - 3, this.z + 3, (o) => {
      if (o.kind === "ramp" || o.smashed) return;
      const cz = obZ(o, this.z), cz1 = cz + o.len;
      if (!o.passed && cz1 < this.z - MOMO_Z) {
        o.passed = true;
        if (!o.hit && o.over && (o.kind === "cart" || o.kind === "grumpy" || o.kind === "roller")) { this.trick("jumpOver"); this.stats.jumpOvers++; }
        if (!o.hit && o.kind === "bar" && o.over) this.trick("squish");
        return;
      }
      if (o.hit || !this.solid(o)) return;
      if (this.z + MOMO_Z <= cz || this.z - MOMO_Z >= cz1) return;
      for (const ml of lanes) {
        const px = ml == null ? this.x : ml * LW;
        const halfX = this.morph?.id === "giant" ? 0.9 : MOMO_X;
        const ox = o.lane * LW;
        if (Math.abs(px - ox) > HALF_W + halfX - 0.12) continue;
        const top = TOP[o.kind], bot = BOTTOM[o.kind] ?? 0;
        if (this.y >= top - 0.03) { o.over = true; continue; }
        if (this.y + h <= bot) { o.over = true; continue; }
        // touching it: land on roofs and rails, hop off karts, bonk Grumpies
        if ((o.kind === "tram" || o.kind === "block" || o.kind === "rail" || o.kind === "ghost") && y0 >= top - 0.45 && this.vy <= 0.5) { this.y = top; this.air = false; this.vy = 0; return; }
        if ((o.kind === "cart" || o.kind === "roller") && this.air && this.vy < 0 && y0 >= top - 0.55) { o.over = true; this.vy = this.jumpV() * 0.85; this.trick("cartHop"); return; }
        if (o.kind === "grumpy" && this.air && this.vy < 0 && y0 >= top - 0.5) { o.smashed = true; this.vy = this.jumpV() * 0.75; this.trick("bonk"); this.stats.bonks++; return; }
        if (this.smasher(o)) { this.smash(o); return; }
        if (this.invT > 0) return;
        if (split && ml != null) { o.hit = true; this.minis.delete(ml); this.events.push({ t: "miniPop", lane: ml }); if (!this.minis.size) { this.morph = null; this.crash(o); } return; }
        if (o.kind === "grumpy") { o.hit = true; o.smashed = true; this.stumble(Math.sign(this.x - ox) || 1); return; }
        const frontal = z0 + MOMO_Z <= obZ(o, z0) + 0.05;
        if (frontal && Math.abs(this.x - ox) < 0.8) { this.crash(o); return; }
        o.hit = true;
        const away = Math.sign(this.x - ox) || (this.lastLane > o.lane ? 1 : -1);
        this.lane = Math.max(-1, Math.min(1, o.lane + away));
        this.stumble(away);
        return;
      }
    });
  }
  private smash(o: Ob) {
    o.smashed = true; o.hit = true;
    this.stats.smashes++;
    this.score += 40 * this.mul();
    this.events.push({ t: "smash", kind: o.kind });
    if (this.stats.smashes % 3 === 0) this.trick("smash");
  }
  private fall() {
    this.events.push({ t: "crash", by: "fall" });
    if (this.saved(null)) { this.y = 0; this.vy = this.jumpV() * 1.2; this.air = true; this.invT = 1.6; return; }
    this.end();
  }

  private stumble(side: number) {
    if (this.friends.includes("gloop")) { this.events.push({ t: "stumble", side: 0 }); return; }
    if (this.shieldT > 0) { this.shieldT = 0; this.invT = 0.8; this.events.push({ t: "shieldPop" }); this.events.push({ t: "powerEnd", id: "shield" }); return; }
    this.stats.stumbles++;
    this.events.push({ t: "stumble", side });
    if (this.stumbleT > 0 && !this.friends.includes("pip")) { this.crash(null); return; }
    this.stumbleT = 5.5;
    this.combo = 0;
  }
  /** a shield, the Jelly Board or a friend saves Momo; false when nothing can */
  private saved(o: Ob | null) {
    if (this.shieldT > 0) { this.shieldT = 0; this.invT = 1.2; if (o) o.smashed = true; this.events.push({ t: "shieldPop" }); this.events.push({ t: "powerEnd", id: "shield" }); return true; }
    if (this.boardT > 0) { this.boardT = 0; this.invT = 1.4; if (o) o.smashed = true; this.events.push({ t: "board", on: false }); return true; }
    this.stats.crashes++;
    this.combo = 0;
    const f = this.friends.pop();
    if (f) {
      if (o) o.smashed = true;
      this.invT = 1.6; this.stumbleT = 0;
      if (this.feverT > 0) { this.feverT = 0; this.events.push({ t: "fever", on: false }); }
      this.events.push({ t: "friendSave", id: f });
      return true;
    }
    return false;
  }
  private crash(o: Ob | null) {
    if (o) o.hit = true;
    if (this.saved(o)) return;
    this.events.push({ t: "crash", by: o ? o.kind : "caught" });
    this.end();
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

  // ---------------------------------------------------------------- morphs
  private doMorph(id: MorphId) {
    if (this.morph) this.unmorph();
    this.morph = { id, t: MORPHS[id].time * (this.friends.includes("noodle") ? 1.4 : 1) };
    this.stats.morphs++;
    if (id === "split") { this.minis = new Set([-1, 0, 1]); this.lane = 0; }
    this.events.push({ t: "morph", id, on: true });
  }
  private unmorph() {
    const m = this.morph;
    if (!m) return;
    if (m.id === "split") { const alive = [...this.minis].sort((a, b) => Math.abs(a) - Math.abs(b)); this.lane = alive[0] ?? 0; this.x = this.lane * LW; this.minis.clear(); }
    this.morph = null; this.invT = Math.max(this.invT, 0.8);
    this.events.push({ t: "morph", id: m.id, on: false });
  }

  // ---------------------------------------------------------------- coins and goodies
  private pickup() {
    const items = this.track.items, z = this.z;
    let lo = 0, hi = items.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].z < z - 2) lo = m + 1; else hi = m; }
    const zib = this.friends.includes("zib"), split = this.morph?.id === "split", stretch = this.morph?.id === "stretch";
    const xs = split ? [...this.minis].map((l) => l * LW) : [this.x];
    for (let i = lo; i < items.length && items[i].z < z + 12; i++) {
      const it = items[i];
      if (it.got || it.kind === "portal" || !this.vis(it)) continue;
      const ix = it.lane * LW, dz = it.z - z, dx = Math.min(...xs.map((x) => Math.abs(x - ix)));
      const dy = it.y - (this.y + 0.6);
      let take = false, pull = false;
      if (it.kind === "coin") {
        if (dx < 0.95 && Math.abs(dz) < 0.9 && (Math.abs(dy) < 1.15 || (stretch && dy > 0 && dy < 2.6))) take = true;
        else if ((this.magnetT > 0 || this.boostT > 0) && dx < LW * 1.3 && dz > -1 && dz < 9) { take = true; pull = true; }
        else if (zib && dx < LW + 0.4 && dz > -0.6 && dz < 1.6 && Math.abs(dy) < 1.6) { take = true; pull = true; }
      } else if (it.kind === "pad") take = dx < 1.05 && Math.abs(dz) < 1.1 && this.y < 1.2;
      else take = dx < 1.1 && Math.abs(dz) < 1.1 && Math.abs(dy) < (it.kind === "boost" ? 2.4 : 1.6);
      if (!take) continue;
      it.got = true; it.t = this.t;
      this.collect(it, pull);
    }
  }
  private ptime(p: PowerId) { return POWERS[p].time * (1 + 0.2 * (this.up[p] ?? 0)) * (this.friends.includes("hoot") ? 1.3 : 1); }
  private collect(it: Item, pull: boolean) {
    switch (it.kind) {
      case "coin": {
        this.stats.coins++;
        this.score += 10 * this.mul();
        this.events.push({ t: "coin", id: it.id, line: it.line, idx: it.idx, pull });
        if (it.line) {
          const n = (this.lineGot.get(it.line) ?? 0) + 1;
          this.lineGot.set(it.line, n);
          if (n === this.track.lineLen.get(it.line)) {
            this.stats.melodies++;
            this.score += 100 * this.mul() * (this.friends.includes("tiki") ? 2 : 1);
            this.events.push({ t: "melody", line: it.line, n });
          }
        }
        break;
      }
      case "power": {
        const p = it.power ?? "magnet", time = this.ptime(p);
        this.stats.powers++;
        if (p === "shield") this.shieldT = time; else if (p === "magnet") this.magnetT = time; else if (p === "double") this.doubleT = time;
        else { this.skyT = time; this.squishT = 0; this.skyCoins(); }
        this.events.push({ t: "power", id: p });
        break;
      }
      case "boost": {
        this.stats.powers++; this.boosts++;
        this.boostX = it.boost ?? 3; this.boostT = boostTime(this.boostX); this.squishT = 0;
        if (this.morph) this.unmorph();
        this.events.push({ t: "boost", x: this.boostX, on: true });
        break;
      }
      case "morph": if (this.boostT <= 0) this.doMorph(it.morph ?? "ball"); break;
      case "friend": this.join(it.friend ?? "zib"); break;
      case "cage": this.stats.freed++; this.events.push({ t: "free", id: it.friend ?? "pip", n: this.stats.freed }); this.join(it.friend ?? "pip"); break;
      case "letter":
        this.letters += it.letter ?? "";
        this.events.push({ t: "letter", ch: it.letter ?? "", n: this.letters.length });
        if (this.letters.length >= 4) { this.letters = ""; this.score += 1000 * this.mul(); this.events.push({ t: "momo" }); }
        break;
      case "star": this.stats.starPieces++; this.score += 300 * this.mul(); this.events.push({ t: "star", n: this.stats.starPieces }); break;
      case "pad":
        this.pads++;
        this.events.push({ t: "pad", n: this.pads });
        this.doJump(true); this.invT = Math.max(this.invT, 0.9);
        break;
      default: break;
    }
  }
  private join(id: FriendId) {
    if (this.friends.length >= 5) { this.score += 250 * this.mul(); return; }
    this.friends.push(id);
    this.stats.friends++;
    this.events.push({ t: "friendJoin", id });
    if (this.friends.length === 5) { this.feverT = 10; this.events.push({ t: "fever", on: true }); }
  }
  /** Bonbon's cake bomb and Kranky's snips */
  private friendPowers(dt: number) {
    if (this.friends.includes("bonbon")) {
      this.cakeT -= dt;
      if (this.cakeT <= 0) {
        this.cakeT = 15;
        let n = 0;
        this.near(this.z, this.z + 26, (o) => { if (o.lane === this.lane && this.solid(o) && o.kind !== "tram" && obZ(o, this.z) > this.z) { o.smashed = true; n++; } });
        if (n) this.events.push({ t: "cake" });
      }
    }
    if (this.friends.includes("kranky")) {
      this.snipT -= dt;
      if (this.snipT <= 0) this.near(this.z, this.z + 7, (o) => {
        if (this.snipT > 0 || o.lane !== this.lane || o.smashed || (o.kind !== "grumpy" && o.kind !== "fence")) return;
        if (obZ(o, this.z) < this.z) return;
        o.smashed = true; this.snipT = 1.5; this.events.push({ t: "snip" });
      });
    }
  }
  /** the Sky Bubble lifts Momo over a trail of coins */
  private skyCoins() {
    const items = this.track.items;
    let lane = this.lane, n = 0;
    const len = this.base * (this.ptime("sky") - 1);
    for (let z = this.z + 8; z < this.z + len; z += 2.2) {
      if (n++ % 9 === 8) lane = Math.max(-1, Math.min(1, lane + (Math.random() < 0.5 ? -1 : 1)));
      items.push({ id: 1e7 + Math.floor(z * 10) + n, kind: "coin", lane, z, y: SKY_Y + 0.6 });
    }
    items.sort((a, b) => a.z - b.z);
  }
  private honk() {
    this.near(this.z, this.z + 90, (o) => {
      if (o.kind !== "cart" || o.k <= 0 || o.honked || o.passed) return;
      const cz = obZ(o, this.z), closing = this.speed * (1 + o.k);
      if (o.lane === this.lane && cz - this.z < closing * 2.2) { o.honked = true; this.events.push({ t: "honk", lane: o.lane }); }
    });
  }

  // ---------------------------------------------------------------- the end
  private end() {
    if (this.phase !== "play") return;
    this.phase = "lost";
    this.events.push({ t: "end", won: false });
  }
  result(): SimResult {
    return {
      ...this.stats, score: Math.round(this.score), distance: Math.round(this.z), time: this.t, caught: this.caught,
      boosts: this.boosts, worlds: this.worlds, bestWorld: Math.min(WORLDS.length, sectionOf(this.track.stageAt(this.z)).w + 1),
    };
  }

  // ---------------------------------------------------------------- the bot: tries each move a moment ahead
  private think(dt: number) {
    for (let i = this.botQueue.length - 1; i >= 0; i--) {
      if (this.t >= this.botQueue[i].at) { this.doPlan(this.botQueue[i].p); this.botQueue.splice(i, 1); }
    }
    this.botT -= dt;
    if (this.botT > 0) return;
    const par = this.skill >= 0.99;
    this.botT = par ? 0.05 : 0.1 + (1 - this.skill) * 0.16;
    if (this.boostT > 0 || this.skyT > 0 || this.morph?.id === "split") return;
    const H = par ? 1.2 : 0.5 + 0.6 * this.skill;
    if (!par && this.rand() < 0.035 * (1 - this.skill)) { this.doPlan({ lane: this.lane + (this.rand() < 0.5 ? -1 : 1), act: 0 }); return; }
    const opts: Plan[] = [];
    for (const l of [this.lane, this.lane - 1, this.lane + 1, this.lane - 2, this.lane + 2]) if (l >= -1 && l <= 1) for (const act of [0, 1, 2] as const) opts.push({ lane: l, act });
    let best: { p: Plan; s: number; then?: Plan; at?: number } | null = null;
    for (const p of opts) {
      const r = this.predict([p], H);
      const s = r.safe * 100 + r.coins * 2 - Math.abs(p.lane - this.lane) * 0.6 - (p.act ? 0.8 : 0) - Math.abs(p.lane) * 0.15;
      if (!best || s > best.s) best = { p, s };
    }
    if (best && best.s < H * 100 - 1 && par) {
      for (const p of opts) for (const q of opts) for (const at of [0.22, 0.45]) {
        if (q.lane === p.lane && q.act === 0) continue;
        const r = this.predict([p, { ...q }], H, at);
        const s = r.safe * 100 + r.coins * 2 - 1.5;
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
    if (p.act === 1 && !this.air) this.jump();
    else if (p.act === 2 && (this.squishT <= 0.1 || this.air)) this.squish();
  }
  /** play a plan forward with Momo's physics: how long until a hit, and how many coins on the way */
  private predict(plans: Plan[], H: number, at2 = 0): { safe: number; coins: number } {
    const dt = 1 / 30, g = G * this.sec.grav;
    let x = this.x, y = this.y, vy = this.vy, air = this.air, sq = this.squishT, z = this.z, lane = this.lane;
    const sp = this.speed, items = this.track.items, m = this.morph?.id;
    const lv = LANE_V * (this.friends.includes("turbo") ? 1.35 : 1) * (m === "giant" ? 0.75 : 1);
    let coins = 0, ii = 0, hi = items.length;
    while (ii < hi) { const k = (ii + hi) >> 1; if (items[k].z < z - 2) ii = k + 1; else hi = k; }
    const apply = (p: Plan) => {
      lane = Math.max(-1, Math.min(1, p.lane));
      if (p.act === 1 && !air) { vy = this.jumpV(); air = true; sq = 0; }
      if (p.act === 2) { if (air) vy = Math.min(vy, SLAM_V); sq = SQUISH_T; }
    };
    apply(plans[0]);
    let second = plans.length > 1;
    for (let t = 0; t < H; t += dt) {
      if (second && t >= at2) { apply(plans[1]); second = false; }
      const pz = z, py = y, tt = this.t + t;
      z += sp * dt;
      const ice = !air && !!this.zoneLane(Math.max(-1, Math.min(1, Math.round(x / LW))), z, "ice");
      const mx = lv * (ice ? 0.45 : 1) * dt; x += Math.max(-mx, Math.min(mx, lane * LW - x));
      const s = this.surface(x, y, z, tt);
      if (!air) { if (s.h < y - 0.08) { air = true; vy = 0; } else y = s.h; }
      if (air) { vy -= g * dt; y += vy * dt; const s2 = this.surface(x, Math.max(y, py), z, tt); if (y <= s2.h && vy <= 0 && s2.h > -1) { y = s2.h; vy = 0; air = false; } }
      if (y < -0.6) return { safe: t, coins };
      if (sq > 0) sq -= dt;
      const h = m === "giant" ? 2.6 : m === "ball" ? 0.85 : m === "stretch" ? (sq > 0 ? 0.6 : 2.0) : sq > 0 && !air ? SQUISH_H : sq > 0 ? 0.75 : MOMO_H;
      if (this.invT <= t && m !== "giant") {
        let bad = false;
        this.near(z - 3, z + 3, (o) => {
          if (bad || o.hit || !this.solid(o, tt)) return;
          if (m === "ball" && o.kind !== "tram" && o.kind !== "bar" && o.kind !== "geyser") return;
          const ox = o.lane * LW, cz = obZ(o, z);
          if (Math.abs(x - ox) > HALF_W + MOMO_X - 0.12 || z + MOMO_Z <= cz || z - MOMO_Z >= cz + o.len) return;
          const top = TOP[o.kind];
          if (y >= top - 0.03 || y + h <= (BOTTOM[o.kind] ?? 0)) return;
          if ((o.kind === "tram" || o.kind === "block" || o.kind === "rail" || o.kind === "ghost") && py >= top - 0.45 && vy <= 0.5) return;
          if ((o.kind === "cart" || o.kind === "grumpy" || o.kind === "roller") && air && vy < 0 && py >= top - 0.5) return;
          bad = true;
        });
        if (bad) return { safe: t, coins };
      }
      while (ii < items.length && items[ii].z < pz - 1) ii++;
      for (let k = ii; k < items.length && items[k].z <= z + 1; k++) {
        const it = items[k];
        if (!it.got && it.kind !== "portal" && this.vis(it) && Math.abs(it.lane * LW - x) < 0.95 && Math.abs(it.z - z) < 0.9 && Math.abs(it.y - (y + 0.6)) < 1.2) coins += it.kind === "coin" ? 1 : 8;
      }
    }
    return { safe: H, coins };
  }
}
