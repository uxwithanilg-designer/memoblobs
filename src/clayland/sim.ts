// Puddo's Clayland: Rain Raid — the simulation. Puddo, the Rain Blaster and Storm Bombs, the Dust Army, gadgets,
// platforms, ambush gates, goals (pumps, cages, keys, the well, the vault), rides and bosses on the tile grid, stepped
// at a fixed 120 Hz. Deterministic for a given stage and input stream (the bot and the sweep script drive it headless).
import { BEAST, BOSS, type Beast, type FoeShot } from "./bestiary";
import { updateBossV2, V2_PATTERNS } from "./bossai";
import {
  ACC_AIR, ACC_GROUND, BOUNCE_V, BUFFER, COYOTE, FALL_MUL, FRICTION, GRAV, ICE_FRICTION, JUMP_CUT, JUMP_V, MAX_FALL, MOMO_H,
  MOMO_W, RUN, SQUEEZE_H, STEP, STOMP_V,
} from "./physics";
import { BOMB, START_BOMBS, WEAPONS, comboMult, weaponsFor } from "./weapons";
import {
  T, type BossKind, type EnemyKind, type FriendId, type Gadget, type GateSpec, type Hud, type PlatSpec, type SimEvent,
  type SimResult, type Stage, type Target, type Weapon,
} from "./types";

export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; fire: boolean; bomb: boolean; super: boolean }
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, fire: false, bomb: false, super: false };

export interface Foe {
  kind: EnemyKind; b: Beast; x: number; y: number; vx: number; vy: number; x0: number; y0: number; range: number; dir: number;
  hp: number; max: number; alive: boolean; t: number; ground: boolean; id: number; flash: number; squash: number; hit: number;
  elite: boolean; tell: number; shotT: number; burst: number; burstT: number; state: number; st: number; cool: number;
  /** ambush gate it belongs to (-1 = none), hive that baked it (-1 = none) */
  gate: number; parent: number;
  /** Hold the Well / Escort: walks to the well or the cart instead of Puddo */
  seek: number | null;
  /** where a sniper's aiming line points (locked when its tell starts) */
  ax: number; ay: number;
  /** a Hunt target */
  hunt: boolean;
}
interface Plat { s: PlatSpec; x: number; y: number; w: number; dx: number; dy: number; tilt: number }
export interface Shot {
  kind: string; x: number; y: number; vx: number; vy: number; r: number; foe: boolean; life: number; bounces: number; grav: number; id: number;
  dmg: number; pierce: number; chain: number; home: boolean; hits: number[]; w?: Weapon;
}
export interface Loot { kind: "coin" | "weapon" | "bombs" | "heart"; w?: Weapon; x: number; y: number; vx: number; vy: number; t: number; value: number; id: number }
export interface Boss {
  kind: BossKind; x: number; y: number; vx: number; vy: number; hp: number; max: number; state: string; t: number; inv: number; dir: number;
  phase: number; active: boolean; down: boolean; under: boolean; w: number; h: number; shotT: number; t2: number; cnt: number; tx: number; t3: number;
}
interface GateState { spec: GateSpec; phase: "idle" | "on" | "done"; wave: number; wait: number; since: number }

const SOLID = new Set<number>([T.GROUND, T.BRICK, T.BLOCK, T.BREAK, T.ICE, T.CARAMEL, T.BOUNCE, T.BELT_R, T.BELT_L, T.SAND, T.CRUMBLE, T.WALL]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const overlap = (ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number) => ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** coins added to a clear: a no-hit run and the best combo */
export const clearBonus = (noHit: boolean, bestCombo: number) => (noHit ? 30 : 0) + bestCombo * 2;

export interface SimOpts {
  hearts?: number; lives?: number; friend?: FriendId; char?: "puddo" | "momo" | "pip" | "gloop" | "zib";
  maxBombs?: number; fireMul?: number; dmgMul?: number; magnet?: number; weapon?: Weapon; bombs?: number;
}

export class Sim {
  st: Stage; w: number; h: number; tiles: Uint8Array;
  t = 0;
  rnd: () => number;
  // Puddo
  x: number; y: number; vx = 0; vy = 0; face = 1; ground = false; groundTile = 0; coyote = 0; buffer = 0; squeezed = false;
  climbing = false; inWater = false; jumpHeld = false; downHeld = false; bombHeld = false; superHeld = false; stomping = false; doubleUsed = false;
  hoverFuel = 1.2; gliding = false; wallDir = 0; lastGroundX = 0; lastGroundY = 0; onPlat: Plat | null = null;
  hearts = 3; maxHearts = 3; lives = 3; inv = 0; friend: FriendId | undefined; star = 0;
  coins = 0; drops = new Set<number>(); hits = 0; noHit = true; cp = -1; respawnAt: { x: number; y: number };
  /** when the elevator started its climb (it starts over from the bottom after a respawn) */
  liftT0 = 0; liftCp = 0; liftBase = 0;
  done = false; cleared = false; doneAt = -1; duckT = 0; anim = { run: 0, land: 0, throw: 0, hurt: 0, blink: 0, fire: 0 };
  // the Rain Blaster
  weapon: Weapon = "drizzle"; fireCd = 0; bombs = START_BOMBS; maxBombs = 5; bombCd = 0; fireMul = 1; dmgMul = 1; magnet = 2.6;
  storm = 0; superT = 0; superTick = 0; stormFullSaid = false;
  combo = 0; comboT = 0; bestCombo = 0; melted = 0; aimY = 0;
  // world
  foes: Foe[]; plats: Plat[]; shots: Shot[] = []; loot: Loot[] = []; taken = new Set<number>(); potsOpen = new Set<number>();
  gstate = new Map<number, number>(); lit = new Set<number>(); switchOn = false; switchCd = 0;
  /** tile index → [time it comes back, tile] (crumbled floors, popped clouds) */
  gone = new Map<number, [number, number]>();
  /** crumbling tiles under Puddo → time stood; cracked blocks → hits taken */
  stand = new Map<number, number>(); tileHits = new Map<number, number>();
  chaseX = -1e9; boss: Boss | null = null; bridge: { x0: number; x1: number; y: number; until: number } | null = null;
  // goals
  goalDone: boolean; keys = 0; rescued = 0; pumpsDown = 0; tgtHp = new Map<number, number>();
  gates: GateState[]; activeGate = -1; wavesCleared = 0;
  wellHp = 0; defendT = 0; spawnT = 2; spawnSide = 0; vaultT = 0;
  escortX = 0; escortY = 0; escortHp = 0; huntDown = 0; riseY = -10; foePush = 0; armorHit = 0;
  events: SimEvent[] = [];
  private sid = 1_000_000;
  private raftStand = false;

  /** who's playing: Puddo, or a friend with their own move built in (Pip slides, Gloop clings, Zib hovers) */
  char: "puddo" | "momo" | "pip" | "gloop" | "zib" = "puddo";
  has(f: FriendId) { return this.friend === f || this.char === f; }

  constructor(st: Stage, o: SimOpts = {}) {
    this.st = st; this.w = st.w; this.h = st.h; this.tiles = st.tiles.slice();
    this.rnd = rng(st.n * 7919 + 3);
    this.char = o.char ?? "puddo";
    this.x = st.start.x; this.y = st.start.y; this.respawnAt = { ...st.start };
    this.maxHearts = this.hearts = o.hearts ?? 3; this.lives = o.lives ?? 3;
    this.friend = o.friend ?? st.startFriend;
    this.maxBombs = o.maxBombs ?? 5; this.fireMul = o.fireMul ?? 1; this.dmgMul = o.dmgMul ?? 1; this.magnet = o.magnet ?? 2.6;
    if (o.weapon) this.weapon = o.weapon;
    if (o.bombs !== undefined) this.bombs = Math.min(this.maxBombs, o.bombs);
    this.foes = st.enemies.map((e) => { const f = this.makeFoe(e.kind, e.x, e.y, e.range, e.id, !!e.elite || !!e.hunt); f.hunt = !!e.hunt; return f; });
    this.plats = st.plats.map((s) => ({ s, x: s.x, y: s.y, w: s.w, dx: 0, dy: 0, tilt: 0 }));
    for (const tg of st.targets) this.tgtHp.set(tg.id, tg.hp);
    this.gates = st.gates.map((g) => ({ spec: g, phase: "idle", wave: 0, wait: 0, since: 0 }));
    this.goalDone = st.goalKind === "gong" || st.goalKind === "boss" || st.goalKind === "vault";
    if (st.defend) this.wellHp = st.defend.hp;
    if (st.escort) { this.escortX = st.escort.x; this.escortY = st.escort.y; this.escortHp = st.escort.hp; this.spawnT = 5; }
    if (st.rules.rise) this.riseY = st.rules.rise.from;
    this.raftStand = st.ride?.kind === "raft";
    if (st.vault) this.vaultT = st.vault;
    if (st.boss) {
      const bd = BOSS[st.boss.kind];
      this.boss = { kind: st.boss.kind, x: st.boss.x1 - 4, y: st.boss.floor, vx: 0, vy: 0, hp: st.boss.hp, max: st.boss.hp, state: "wait", t: 0, inv: 0, dir: -1, phase: 0, active: false, down: false, under: false, w: bd.w, h: bd.h, shotT: 1.5, t2: 0, cnt: 0, tx: 0, t3: 0 };
    }
    if (st.rules.chase) this.chaseX = st.start.x - 12;
    // mines laid in the stage
    for (const g of st.gadgets) if (g.kind === "mine") this.shoot("mine", g.x, g.y + 0.3, 0, 0, 30, 0.3, 1e9);
    this.lastGroundX = this.x; this.lastGroundY = this.y;
  }

  makeFoe(kind: EnemyKind, x: number, y: number, range: number, id: number, elite = false): Foe {
    const b = BEAST[kind];
    const hp = Math.max(1, Math.round((b.hp + (b.wild ? 1 : 0)) * this.st.hpMul * (elite ? 2.2 : 1)));
    return {
      kind, b, x, y, vx: 0, vy: 0, x0: x, y0: y, range, dir: -1, hp, max: hp, alive: true, t: (id * 0.37) % 3, ground: false, id, flash: 0, squash: 0, hit: 0,
      elite, tell: 0, shotT: 0.8 + ((id * 0.61) % 1.6), burst: 0, burstT: 0, state: 0, st: 0, cool: 0, gate: -1, parent: -1, seek: null,
      ax: x, ay: y, hunt: false,
    };
  }
  /** a new enemy mid-stage (waves, hives, the well's attackers) */
  spawnFoe(kind: EnemyKind, x: number, y: number, o: { elite?: boolean; gate?: number; parent?: number; seek?: number; dir?: number; range?: number } = {}) {
    const f = this.makeFoe(kind, x, y, o.range ?? 4, this.sid++, !!o.elite);
    f.gate = o.gate ?? -1; f.parent = o.parent ?? -1; f.seek = o.seek ?? null; f.dir = o.dir ?? (this.x < x ? -1 : 1);
    f.shotT = 1.2 + this.rnd() * 1.2;
    this.foes.push(f);
    this.emit({ t: "spawn", x, y: y + 0.5 });
    return f;
  }

  /** roots and sand sharks are underground (can't be hit) until they come up */
  hidden(f: Foe) { return (f.b.b === "ambusher" && f.state === 0) || (f.b.b === "burrower" && f.state <= 1) || (f.b.b === "pod" && f.state === 0); }

  // ------------------------------------------------------------------ tiles
  tile(tx: number, ty: number) { return tx < 0 || ty < 0 || tx >= this.w ? (ty < 0 ? 0 : T.WALL) : ty >= this.h ? 0 : this.tiles[ty * this.w + tx]; }
  setTile(tx: number, ty: number, v: number) { if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.tiles[ty * this.w + tx] = v; }
  beatOn() { const bpm = this.st.rules.beat ?? 120; return Math.floor((this.t * bpm) / 60 / 2) % 2 === 0; }
  private gateWall(tx: number) { const g = this.activeGate >= 0 ? this.gates[this.activeGate].spec : null; return !!g && (tx === g.x0 || tx === g.x1); }
  /** 0 = free, 1 = solid, 2 = one-way (stand on it from above) */
  solid(tx: number, ty: number): number {
    const v = this.tile(tx, ty);
    if (SOLID.has(v)) return 1;
    switch (v) {
      case T.SW_A: return this.switchOn ? 0 : 1;
      case T.SW_B: return this.switchOn ? 1 : 0;
      case T.BEAT_A: return this.beatOn() ? 1 : 0;
      case T.BEAT_B: return this.beatOn() ? 0 : 1;
      case T.ONEWAY: case T.CLOUD: case T.RAIL: return 2;
      case T.GATE: return this.gateWall(tx) ? 1 : 0;
      case T.DOOR: return this.goalDone ? 0 : 1;
      case T.WATER: return this.raftStand && this.tile(tx, ty + 1) !== T.WATER ? 2 : 0;
    }
    return 0;
  }
  groundAt(x: number, fromY: number) { const tx = Math.floor(x); for (let ty = Math.min(this.h - 1, Math.floor(fromY)); ty >= 0; ty--) if (this.solid(tx, ty)) return ty + 1; return -5; }

  get bodyH() { return this.squeezed ? SQUEEZE_H : MOMO_H; }
  emit(e: SimEvent) { this.events.push(e); }

  // ------------------------------------------------------------------ step
  step(inp: Input) {
    if (this.done) return;
    const dt = STEP;
    this.t += dt;
    if (this.doneAt > 0) { if (this.t >= this.doneAt) { this.done = true; this.cleared = true; this.emit({ t: "clear" }); } }
    const st = this.st;
    this.inv = Math.max(0, this.inv - dt); this.star = Math.max(0, this.star - dt); this.switchCd = Math.max(0, this.switchCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt); this.bombCd = Math.max(0, this.bombCd - dt);
    this.anim.land = Math.max(0, this.anim.land - dt); this.anim.throw = Math.max(0, this.anim.throw - dt); this.anim.hurt = Math.max(0, this.anim.hurt - dt); this.anim.fire = Math.max(0, this.anim.fire - dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    // tiles that come back
    for (const [i, [at, v]] of this.gone) if (this.t >= at) { this.tiles[i] = v; this.gone.delete(i); }

    const jumpPress = inp.jump && !this.jumpHeld, downPress = inp.down && !this.downHeld, bombPress = inp.bomb && !this.bombHeld, superPress = inp.super && !this.superHeld;
    this.jumpHeld = inp.jump; this.downHeld = inp.down; this.bombHeld = inp.bomb; this.superHeld = inp.super;
    if (jumpPress) this.buffer = BUFFER; else this.buffer = Math.max(0, this.buffer - dt);

    this.updatePlats();
    const ride = st.ride;
    const auto = !!ride && (ride.kind === "cart" || ride.kind === "raft" || ride.kind === "glider");
    const glider = ride?.kind === "glider";
    const lowg = !!st.rules.lowg, gMul = lowg ? 0.45 : 1;
    const under = this.tileUnder();
    const onIce = under === T.ICE && !this.has("pip"), onCaramel = under === T.CARAMEL, onSand = under === T.SAND;
    const tx = Math.floor(this.x), tyMid = Math.floor(this.y + 0.4);
    this.inWater = !ride && (this.tile(tx, tyMid) === T.WATER || this.tile(tx, Math.floor(this.y + 0.1)) === T.WATER);
    const onVine = this.tile(tx, Math.floor(this.y + 0.5)) === T.VINE || this.tile(tx, Math.floor(this.y + 0.05)) === T.VINE;

    // -- climbing (vines): hold up (or jump) to climb, down to slide down; step off sideways or at the top
    if (onVine && (inp.up || inp.jump || this.climbing)) { if (!this.climbing) this.buffer = 0; this.climbing = true; } else if (!onVine) this.climbing = false;

    // -- crouch (squeeze): low shots, under high shots and low gaps
    this.duckT = Math.max(0, this.duckT - dt);
    const wantSqueeze = (inp.down && this.ground && !this.climbing) || this.duckT > 0;
    if (wantSqueeze) this.squeezed = true;
    else if (this.squeezed && !this.blockedAbove(MOMO_H)) this.squeezed = false;

    // -- horizontal
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir && !auto) this.face = dir;
    if (auto && ride) {
      // rides: the cart / raft carries Puddo along; ◀ ▶ only nudge
      this.face = 1;
      const want = ride.speed + dir * 1.8;
      this.vx += clamp(want - this.vx, -30 * dt, 30 * dt);
    } else {
      let top = RUN;
      if (this.friend === "turbo") top *= 1.45;
      if (this.star > 0) top *= 1.15;
      if (onCaramel) top *= 0.5;
      if (onSand) top *= 0.6;
      if (this.squeezed) top *= this.has("pip") ? 1.3 : 0.45;
      if (this.inWater) top *= this.has("pip") ? 1.25 : 0.62;
      if (this.char === "gloop") top *= 0.94;
      if (this.climbing) top *= 0.4;
      if (ride?.kind === "tank") top *= 0.72; else if (ride?.kind === "mech") top *= 0.94;
      if (st.rules.slide && onIce && dir > 0) top *= 1.4;
      const acc = this.ground ? ACC_GROUND : ACC_AIR;
      const fr = onIce ? ICE_FRICTION : this.ground ? FRICTION : 8;
      if (dir) {
        const turning = this.vx !== 0 && Math.sign(this.vx) !== dir;
        const a = acc * (turning ? 1.6 : 1) * (onIce ? (turning ? 0.25 : 0.35) : 1);
        if (dir * this.vx < top) this.vx = dir > 0 ? Math.min(top, this.vx + a * dt) : Math.max(-top, this.vx - a * dt);
        else this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx) - top, fr * dt + 0.02);
      } else {
        const dec = fr * dt;
        this.vx = Math.abs(this.vx) <= dec ? 0 : this.vx - Math.sign(this.vx) * dec;
      }
    }
    // pushes: wind, currents, belts
    let push = (st.rules.wind ?? 0) + this.foePush;
    this.foePush = 0;
    for (const g of st.gadgets) {
      if ((g.kind === "wind" || g.kind === "current") && this.x >= g.x && this.x <= g.x + (g.w ?? 1) && this.y >= g.y - 1 && this.y <= g.y + (g.h ?? 6)) {
        if (g.kind === "current" && !this.inWater) continue;
        push += g.power ?? 0;
      }
    }
    if (this.ground && (under === T.BELT_R || under === T.BELT_L)) push += under === T.BELT_R ? 2.6 : -2.6;

    // -- vertical
    if (glider) {
      // the glider: ▲ / jump climbs, ▼ dives, no gravity
      const want = (inp.up || inp.jump ? 1 : 0) - (inp.down ? 1 : 0);
      this.vy += clamp(want * 7.5 - this.vy, -45 * dt, 45 * dt);
    } else if (this.climbing) {
      this.vy = inp.up || inp.jump ? 4.2 : inp.down ? -4.2 : 0;
    } else if (this.inWater) {
      this.vy = Math.max(this.vy - GRAV * 0.22 * dt, -3.2);
      if (jumpPress) {
        const surface = this.tile(tx, Math.floor(this.y + 1.25)) !== T.WATER;
        this.vy = surface ? JUMP_V * 0.92 : this.has("pip") ? 8.5 : 7.2;
        if (surface) this.bounced = true;
        this.emit({ t: surface ? "splash" : "swim" });
      }
    } else {
      let g = GRAV * gMul * (this.vy < 0 ? FALL_MUL : 1);
      if (this.stomping) g *= 1.6;
      this.vy -= g * dt;
      let maxFall = MAX_FALL;
      this.gliding = this.friend === "hoot" && inp.jump && this.vy < 0 && !this.stomping;
      if (this.gliding) maxFall = 2.4;
      if (this.has("zib") && inp.jump && this.vy < 0.5 && !this.ground && this.hoverFuel > 0 && !this.stomping) { this.vy = Math.max(this.vy, 0); this.hoverFuel -= dt; }
      this.wallDir = 0;
      if ((this.has("gloop") || st.rules.walljump) && !this.ground && dir && this.touchWall(dir)) { this.wallDir = dir; maxFall = 2.2; }
      if (this.vy < -maxFall) this.vy = -maxFall;
    }

    // -- jumps
    if (this.ground) { this.coyote = COYOTE; this.doubleUsed = false; this.hoverFuel = this.friend === "zib" ? 1.2 : 0.8; } else this.coyote = Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && !this.inWater && !this.climbing && !glider) {
      const jv = JUMP_V * (onCaramel ? 0.72 : onSand ? 0.8 : 1) * (lowg ? 0.82 : 1) * (this.char === "pip" ? 0.96 : 1) * (ride?.kind === "tank" ? 0.74 : ride?.kind === "mech" ? 1.12 : 1);
      // (no jumping up into a low ceiling while ducked under it: the jump waits in the buffer until he's clear)
      if (this.coyote > 0 && !(this.squeezed && this.blockedAbove(MOMO_H))) {
        this.vy = jv; this.coyote = 0; this.buffer = 0; this.ground = false; this.squeezed = false; this.onPlat = null; this.emit({ t: "jump" });
      } else if (this.wallDir) {
        this.vy = jv * 0.95; this.vx = -this.wallDir * 7.5; this.face = -this.wallDir; this.buffer = 0; this.wallDir = 0; this.emit({ t: "jump" });
      } else if (this.friend === "bolt" && !this.doubleUsed) {
        this.vy = jv * 0.9; this.doubleUsed = true; this.buffer = 0; this.emit({ t: "spring" });
      }
    }
    if (!inp.jump && this.vy > 0 && !this.climbing && !this.inWater && !this.bounced && !glider) this.vy *= JUMP_CUT ** (dt * 60 / 4);
    // Squish Stomp: ↓ (pressed) in the air
    if (downPress && !this.ground && !this.inWater && !this.climbing && !inp.fire && !glider) { this.stomping = true; this.vy = Math.min(this.vy, STOMP_V * 0.6); }

    // -- move and collide
    const x0 = this.x, exp = (this.vx + push) * dt;
    this.moveX(exp);
    if (auto && ride && exp > 0.01 && this.x - x0 < exp * 0.3) {
      // the ride hit something: a log or a rock bumps Puddo over it; a low beam knocks him flat (he ducks)
      const feet = this.solid(Math.floor(this.x + 0.6), Math.floor(this.y + 0.3)) === 1;
      this.hurt("bump"); this.vx = ride.speed;
      if (glider) { this.vy = this.y < this.h / 2 ? 7 : -7; }
      else if (feet) { this.vy = Math.max(this.vy, 11); this.ground = false; } else { this.duckT = 0.8; this.squeezed = true; }
    }
    const wasGround = this.ground, fallV = this.vy;
    this.moveY(this.vy * dt);
    if (glider) { if (this.y < 1.2) { this.y = 1.2; this.vy = Math.max(0, this.vy); } if (this.y > this.h - 2.6) { this.y = this.h - 2.6; this.vy = Math.min(0, this.vy); } }
    if (this.ground && !wasGround) {
      this.anim.land = 0.18;
      for (const g of this.st.gadgets) if (g.kind === "switch" && Math.abs(g.x - this.x) < 0.75 && Math.abs(g.y - this.y) < 0.4) this.flip();
      this.emit({ t: "land", hard: fallV < -16 || this.stomping });
      if (this.stomping) this.stompLand();
      this.stomping = false; this.bounced = false;
    }
    if (this.ground) { this.lastGroundX = this.x; this.lastGroundY = this.y; }
    if (Math.abs(this.vx) > 0.3 && this.ground) this.anim.run += Math.abs(this.vx) * dt * 1.4;

    if (this.ground) this.standOn(dt);
    this.noodleCatch();
    if (this.y < -2.5) this.fatal("fall");
    this.tileHazards();
    // the rising flood
    const rs = st.rules.rise;
    if (rs && this.t > rs.delay) { this.riseY += rs.speed * dt; if (this.y < this.riseY - 0.15) this.fatal(rs.kind); }

    // -- the Rain Blaster, bombs, Super Rain
    if (inp.fire && this.fireCd <= 0 && !this.climbing) this.fire(inp);
    if (bombPress) this.throwBomb();
    if (superPress && this.storm >= 1 && this.superT <= 0) { this.superT = 3.2; this.storm = 0; this.stormFullSaid = false; this.superTick = 0; this.emit({ t: "super" }); }
    if (this.superT > 0) this.updateSuper(dt);

    this.updateShots(dt);
    this.updateFoes(dt);
    this.updateGadgets();
    this.updateItems();
    this.updateLoot(dt);
    this.updateGoals(dt);
    this.updateChase(dt);
    this.updateBoss(dt);
    if (this.bridge && this.t > this.bridge.until) this.bridge = null;
  }
  private bounced = false;

  // ------------------------------------------------------------------ collisions
  private boxes() {
    const out: { x0: number; y0: number; x1: number; y1: number; oneway: boolean; plat?: Plat }[] = [];
    for (const p of this.plats) out.push({ x0: p.x - p.w / 2, y0: p.y - 0.35, x1: p.x + p.w / 2, y1: p.y, oneway: true, plat: p });
    if (this.bridge) out.push({ x0: this.bridge.x0, y0: this.bridge.y - 0.3, x1: this.bridge.x1, y1: this.bridge.y, oneway: true });
    // standing targets: pumps and cages are solid until they break
    for (const tg of this.st.targets) if ((this.tgtHp.get(tg.id) ?? 0) > 0) { const [w, h] = tg.kind === "pump" ? [1.8, 2.6] : [1.4, 1.6]; out.push({ x0: tg.x - w / 2, y0: tg.y, x1: tg.x + w / 2, y1: tg.y + h, oneway: true }); }
    return out;
  }
  private moveX(dx: number) {
    if (!dx) return;
    this.x += dx;
    const hw = MOMO_W / 2, top = this.y + this.bodyH - 0.02, bot = this.y + 0.02;
    const x0 = Math.floor(this.x - hw), x1 = Math.floor(this.x + hw - 1e-6);
    for (let ty = Math.floor(bot); ty <= Math.floor(top); ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.solid(tx, ty) !== 1) continue;
        // only walls ahead stop Puddo (a tile he's already past never pulls him back through it)
        if (dx > 0 ? tx + 1 <= this.x : tx >= this.x) continue;
        if (dx > 0) { this.x = tx - hw - 1e-4; this.vx = Math.min(0, this.vx); }
        else { this.x = tx + 1 + hw + 1e-4; this.vx = Math.max(0, this.vx); }
      }
    }
    if (this.x < 0.5) { this.x = 0.5; this.vx = 0; }
  }
  private moveY(dy: number) {
    const hw = MOMO_W / 2 - 0.04;
    const prevBot = this.y;
    this.y += dy;
    this.ground = false; this.onPlat = null;
    const x0 = Math.floor(this.x - hw), x1 = Math.floor(this.x + hw);
    if (dy <= 0) {
      const ty = Math.floor(this.y);
      for (let tx = x0; tx <= x1; tx++) {
        const s = this.solid(tx, ty);
        if (!s) continue;
        if (s === 2 && prevBot < ty + 1 - 0.05) continue;
        this.y = ty + 1; this.vy = 0; this.ground = true; this.groundTile = this.tile(tx, ty);
      }
      for (const b of this.boxes()) {
        if (this.x + hw <= b.x0 || this.x - hw >= b.x1) continue;
        if (prevBot >= b.y1 - 0.05 && this.y <= b.y1 && this.y >= b.y0 - 0.5) { this.y = b.y1; this.vy = 0; this.ground = true; this.groundTile = T.BLOCK; if (b.plat) this.onPlat = b.plat; }
      }
    } else {
      const top = this.y + this.bodyH, ty = Math.floor(top);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.solid(tx, ty) !== 1) continue;
        this.y = ty - this.bodyH; this.vy = 0;
        const v = this.tile(tx, ty);
        if (v === T.BREAK) this.breakTile(tx, ty);
        for (const p of this.st.pots) if (!this.potsOpen.has(p.id) && Math.floor(p.x) === tx && Math.abs(p.y - (ty + 1)) < 0.6) this.openPot(p.id);
      }
    }
  }
  private touchWall(dir: number) { const tx = Math.floor(this.x + dir * (MOMO_W / 2 + 0.08)); for (let ty = Math.floor(this.y + 0.1); ty <= Math.floor(this.y + 1); ty++) if (this.solid(tx, ty) === 1) return true; return false; }
  private blockedAbove(hgt: number) { const hw = MOMO_W / 2 - 0.002; const ty = Math.floor(this.y + hgt - 0.01); for (let tx = Math.floor(this.x - hw); tx <= Math.floor(this.x + hw); tx++) if (this.solid(tx, ty) === 1) return true; return false; }
  tileUnder() { if (!this.ground) return 0; return this.groundTile; }

  private standOn(dt: number) {
    const hw = MOMO_W / 2 - 0.04, ty = Math.floor(this.y - 0.05);
    if (this.onPlat) { this.x += this.onPlat.dx; this.y += Math.max(0, this.onPlat.dy); }
    for (let tx = Math.floor(this.x - hw); tx <= Math.floor(this.x + hw); tx++) {
      const v = this.tile(tx, ty);
      if (v === T.BOUNCE && !this.squeezed) { this.vy = BOUNCE_V * (this.st.rules.lowg ? 0.8 : 1); this.ground = false; this.bounced = true; this.emit({ t: "bounce" }); return; }
      if (v === T.CRUMBLE || v === T.CLOUD) {
        const k = ty * this.w + tx, s = (this.stand.get(k) ?? 0) + dt;
        this.stand.set(k, s);
        if (s > (v === T.CLOUD ? 0.75 : 0.45)) { this.gone.set(k, [this.t + (v === T.CLOUD ? 3 : 5), v]); this.setTile(tx, ty, T.EMPTY); this.stand.delete(k); this.emit({ t: "break", x: tx + 0.5, y: ty + 0.5 }); }
      }
    }
  }
  private stompLand() {
    const hw = MOMO_W / 2, ty = Math.floor(this.y - 0.05);
    this.emit({ t: "stomp", x: this.x, y: this.y });
    for (let tx = Math.floor(this.x - hw); tx <= Math.floor(this.x + hw); tx++) if (this.tile(tx, ty) === T.BREAK) this.breakTile(tx, ty);
    for (const p of this.st.pots) if (!this.potsOpen.has(p.id) && Math.abs(p.x - this.x) < 0.9 && Math.abs(p.y - this.y) < 1.2) this.openPot(p.id);
    for (const f of this.foes) if (f.alive && f.ground && Math.abs(f.x - this.x) < 2.2 && Math.abs(f.y - this.y) < 0.6) { f.vy = 6; f.flash = 0.6; this.damage(f, 1); }
  }
  breakTile(tx: number, ty: number) { this.setTile(tx, ty, T.EMPTY); this.tileHits.delete(ty * this.w + tx); this.emit({ t: "break", x: tx + 0.5, y: ty + 0.5 }); this.coins += 1; }

  /** Noodle catches Puddo over a pit: he stretches into a bridge from the last ledge to the next ground */
  private noodleCatch() {
    if (this.friend !== "noodle" || this.ground || this.vy > -2 || this.y > this.lastGroundY - 1.2 || this.bridge) return;
    if (this.groundAt(this.x, this.lastGroundY - 0.5) > 0) return;
    let x1 = -1;
    for (let k = 1; k <= 10; k++) { const gx = Math.floor(this.lastGroundX) + k * Math.sign(this.face || 1); if (this.solid(gx, Math.floor(this.lastGroundY - 1)) === 1) { x1 = gx; break; } }
    if (x1 < 0) return;
    const a = Math.min(this.lastGroundX, x1), b = Math.max(this.lastGroundX, x1 + 1);
    this.bridge = { x0: a, x1: b, y: this.lastGroundY, until: this.t + 3 };
    this.y = this.lastGroundY; this.vy = 0; this.ground = true;
    this.emit({ t: "stretch" }); this.loseFriend(true);
  }

  // ------------------------------------------------------------------ hearts, lives, respawn
  hurt(why: string, ignoreFriend = false) {
    if (this.inv > 0 || this.star > 0 || this.done || this.superT > 0) return;
    if (this.friend && !ignoreFriend) { this.loseFriend(false); this.inv = 1.4; this.vy = 7; this.emit({ t: "hurt", why }); return; }
    // the tank's and the mech's armour soaks every other hit
    if ((this.st.ride?.kind === "tank" || this.st.ride?.kind === "mech") && ++this.armorHit % 2 === 1) { this.inv = 1.1; this.emit({ t: "shield", x: this.x, y: this.y + 0.8 }); return; }
    this.hearts--; this.hits++; this.noHit = false; this.inv = 1.6; this.anim.hurt = 0.4;
    if (!this.st.ride) this.vx = -this.face * 2.5;
    this.vy = Math.max(this.vy, 7); this.stomping = false;
    if (this.weapon !== "drizzle") { this.weapon = "drizzle"; this.emit({ t: "lostWeapon" }); }
    this.emit({ t: "hurt", why });
    if (this.hearts <= 0) this.respawn();
  }
  fatal(why: string) {
    if (this.done) return;
    this.hits++; this.noHit = false;
    if (this.friend) this.loseFriend(false);
    this.hearts--;
    this.emit({ t: "hurt", why });
    this.respawn();
  }
  respawn() {
    if (this.hearts <= 0) {
      this.lives--;
      this.emit({ t: "lifeLost", lives: this.lives });
      if (this.lives <= 0) { this.done = true; this.cleared = false; this.emit({ t: "failed" }); return; }
      this.hearts = this.maxHearts;
      if (this.weapon !== "drizzle") this.weapon = "drizzle";
      // the boss keeps its damage (lives are the limit); its summoned helpers go away
      if (this.boss && !this.boss.down) { for (const f of this.foes) if (f.parent === -2) f.alive = false; }
    }
    this.x = this.respawnAt.x; this.y = this.respawnAt.y + 0.05; this.vx = 0; this.vy = 0; this.inv = 1.8;
    this.stomping = false; this.squeezed = false; this.climbing = false;
    if (this.st.rules.chase) this.chaseX = this.respawnAt.x - 12;
    if (this.st.rules.rise) this.riseY = Math.min(this.riseY, this.respawnAt.y - 8);
    for (const p of this.plats) if (p.s.kind === "elevator") {
      // the lift waits a moment at the last third reached, then climbs on
      this.liftBase = this.liftCp; this.liftT0 = this.t - 3 - this.liftCp / p.s.speed + 1.5;
      p.y = p.s.y + this.liftCp; p.dy = 0; this.y = p.y + 0.05; this.x = p.s.x - 3;
    }
    for (const [i, [, v]] of this.gone) this.tiles[i] = v;
    this.gone.clear();
    // an unfinished ambush starts over
    if (this.activeGate >= 0) {
      const g = this.gates[this.activeGate];
      for (const f of this.foes) if (f.gate === g.spec.id) f.alive = false;
      g.phase = "idle"; g.wave = 0; this.activeGate = -1;
    }
    this.shots = this.shots.filter((s) => !s.foe || s.kind === "mine");
    this.emit({ t: "respawn" });
  }
  loseFriend(used: boolean) { if (!this.friend) return; const f = this.friend; this.friend = undefined; if (!used) this.emit({ t: "friendLost", f }); }

  // ------------------------------------------------------------------ the Rain Blaster
  /** the nearest thing to shoot at in front of Puddo (aim assist) */
  private aimTarget(range: number): [number, number] | null {
    const ox = this.x, oy = this.y + 0.7, f = this.face;
    let best: [number, number] | null = null, bd = 1e9;
    const consider = (x: number, y: number) => {
      const dx = (x - ox) * f, dy = y - oy;
      if (dx < 0.4 || dx > range) return;
      if (Math.abs(dy) > dx * 1.25 + 0.6) return;
      const d = dx + Math.abs(dy) * 1.5;
      if (d < bd) { bd = d; best = [x, y]; }
    };
    for (const e of this.foes) if (e.alive && !this.hidden(e) && Math.abs(e.x - ox) < range + 1) consider(e.x, e.y + e.b.h * 0.5);
    if (this.boss?.active && !this.boss.down && !this.boss.under) consider(this.boss.x, this.boss.y + this.boss.h * 0.55);
    for (const tg of this.st.targets) if ((this.tgtHp.get(tg.id) ?? 0) > 0) consider(tg.x, tg.y + 1);
    return best;
  }
  private fire(inp: Input) {
    const ride = this.st.ride?.kind;
    if (ride === "tank") {
      // the Mud Tank's cannon: slow, heavy, bursts on impact
      this.fireCd = 1 / (2.2 * this.fireMul);
      this.shots.push({ kind: "tankShell", x: this.x + this.face * 1.0, y: this.y + 0.9, vx: this.face * 17, vy: 0.6, r: 0.3, foe: false, life: 1.1, bounces: 0, grav: 2, id: this.sid++, dmg: 4 * this.dmgMul, pierce: 0, chain: 0, home: false, hits: [] });
      this.anim.fire = 0.16; this.emit({ t: "shoot", w: "geyser", x: this.x + this.face, y: this.y + 0.9 });
      return;
    }
    const W = WEAPONS[ride === "mech" ? "downpour" : this.weapon];
    this.fireCd = 1 / (W.rate * this.fireMul * (ride === "mech" ? 0.85 : 1));
    const down = !this.ground && inp.down;
    const ox = this.x + (down ? 0 : this.face * 0.5), oy = this.y + (down ? 0.1 : this.squeezed ? 0.36 : 0.74);
    let ang = down ? -Math.PI / 2 : this.face > 0 ? 0 : Math.PI;
    if (!down && !this.squeezed) {
      const tg = this.aimTarget(W.range);
      if (tg) { const a = Math.atan2(tg[1] - oy, (tg[0] - ox) * this.face); ang = this.face > 0 ? clamp(a, -0.95, 0.95) : Math.PI - clamp(a, -0.95, 0.95); }
    }
    this.aimY = Math.sin(ang);
    for (const off of ride === "mech" ? [-0.05, 0.05] : W.angles) {
      const a = ang + off * (this.face > 0 || down ? 1 : -1);
      this.shots.push({ kind: ride === "mech" ? "downpour" : this.weapon, x: ox, y: oy, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, r: W.r, foe: false, life: W.range / W.speed, bounces: 0, grav: 0, id: this.sid++, dmg: W.dmg * this.dmgMul * (ride === "mech" ? 1.3 : 1), pierce: W.pierce, chain: W.chain, home: W.home, hits: [], w: this.weapon });
    }
    this.anim.fire = 0.1;
    this.emit({ t: "shoot", w: this.weapon, x: ox, y: oy });
  }
  private throwBomb() {
    if (this.bombs <= 0 || this.bombCd > 0 || this.climbing) return;
    this.bombs--; this.bombCd = 0.45; this.anim.throw = 0.22;
    this.shots.push({ kind: "bomb", x: this.x + this.face * 0.4, y: this.y + 0.9, vx: this.face * BOMB.speed + this.vx * 0.35, vy: BOMB.up, r: 0.3, foe: false, life: BOMB.fuse, bounces: 1, grav: BOMB.grav, id: this.sid++, dmg: BOMB.dmg, pierce: 0, chain: 0, home: false, hits: [] });
    this.emit({ t: "bomb" });
  }
  /** a Storm Bomb bursts: everything close melts, cracked blocks break, enemy shots wash away */
  explode(x: number, y: number) {
    const R = BOMB.r;
    this.emit({ t: "boom", x, y, r: R });
    for (const f of this.foes) if (f.alive && !this.hidden(f) && Math.hypot(f.x - x, f.y + f.b.h / 2 - y) < R + f.b.w / 2) this.damage(f, BOMB.dmg * this.dmgMul, true);
    const b = this.boss;
    if (b?.active && !b.down && !b.under && Math.abs(b.x - x) < R + b.w / 2 && y > b.y - R && y < b.y + b.h + R) this.hitBoss(BOMB.bossDmg * this.dmgMul);
    for (const tg of this.st.targets) if (Math.abs(tg.x - x) < R + 0.8 && y > tg.y - R && y < tg.y + 2.6 + R) this.hitTarget(tg, 12);
    for (let ty = Math.floor(y - R); ty <= Math.floor(y + R); ty++) for (let tx = Math.floor(x - R); tx <= Math.floor(x + R); tx++) if (this.tile(tx, ty) === T.BREAK && Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < R) this.breakTile(tx, ty);
    for (const p of this.st.pots) if (!this.potsOpen.has(p.id) && Math.hypot(p.x - x, p.y + 0.4 - y) < R) this.openPot(p.id);
    for (const s of this.shots) if (s.foe && s.kind !== "roller" && Math.hypot(s.x - x, s.y - y) < R + 0.5) s.life = 0;
  }
  private updateSuper(dt: number) {
    this.superT -= dt; this.superTick -= dt;
    if (this.superTick > 0) return;
    this.superTick = 0.22;
    for (const f of this.foes) if (f.alive && !this.hidden(f) && Math.abs(f.x - this.x) < 14 && Math.abs(f.y - this.y) < 10) this.damage(f, 1.6, true);
    const b = this.boss;
    if (b?.active && !b.down && !b.under) this.hitBoss(1.4);
    for (const tg of this.st.targets) if (Math.abs(tg.x - this.x) < 14) this.hitTarget(tg, 1);
    for (const s of this.shots) if (s.foe && Math.abs(s.x - this.x) < 15) s.life = 0;
  }

  // ------------------------------------------------------------------ damage, melting, coins
  damage(f: Foe, n: number, area = false) {
    if (!f.alive) return;
    f.hp -= n; f.hit = 0.12;
    if (f.hp <= 0) this.melt(f);
    else if (!area) this.emit({ t: "hit", x: f.x, y: f.y + f.b.h * 0.6 });
  }
  melt(f: Foe) {
    if (!f.alive) return;
    f.alive = false; this.melted++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 2.4; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = comboMult(this.combo);
    if (this.combo >= 4 && this.combo % 4 === 0) this.emit({ t: "combo", n: this.combo, mult });
    const value = (f.b.coins + (f.elite ? 14 : 0)) * mult;
    this.dropCoins(f.x, f.y + f.b.h * 0.5, value);
    this.storm = Math.min(1, this.storm + (f.elite ? 0.14 : 0.035 + 0.01 * mult));
    if (this.storm >= 1 && !this.stormFullSaid) { this.stormFullSaid = true; this.emit({ t: "stormFull" }); }
    if (f.elite) { const ws = weaponsFor(Math.ceil(this.st.n / 20) || 4); this.drop({ kind: "weapon", w: ws[Math.floor(this.rnd() * ws.length)], x: f.x, y: f.y + 0.6, value: 0 }); }
    else if (this.rnd() < (f.b.coins >= 3 ? 0.12 : 0.03)) this.drop({ kind: this.rnd() < 0.6 ? "bombs" : "heart", x: f.x, y: f.y + 0.6, value: 1 });
    this.emit({ t: "melt", x: f.x, y: f.y + f.b.h * 0.4, enemy: f.kind, elite: f.elite });
    if (f.hunt) { this.huntDown++; this.emit({ t: "huntDown", n: this.huntDown }); }
  }
  dropCoins(x: number, y: number, value: number) {
    const n = Math.min(7, Math.max(1, Math.round(value)));
    const each = value / n;
    for (let i = 0; i < n; i++) this.drop({ kind: "coin", x, y, value: each, vx: (this.rnd() - 0.5) * 6, vy: 5 + this.rnd() * 4 });
  }
  private drop(o: { kind: Loot["kind"]; w?: Weapon; x: number; y: number; value: number; vx?: number; vy?: number }) {
    this.loot.push({ kind: o.kind, w: o.w, x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 6, t: 0, value: o.value, id: this.sid++ });
  }
  private updateLoot(dt: number) {
    const px = this.x, py = this.y + 0.6;
    for (const l of this.loot) {
      l.t += dt;
      const d = Math.hypot(l.x - px, l.y - py);
      if (l.kind === "coin" && l.t > 0.35 && d < this.magnet) {
        // the coin magnet: pulled in, faster as it gets close
        const k = 22 / Math.max(0.4, d);
        l.vx += ((px - l.x) * k - l.vx) * Math.min(1, dt * 10); l.vy += ((py - l.y) * k - l.vy) * Math.min(1, dt * 10);
        l.x += l.vx * dt; l.y += l.vy * dt;
      } else {
        l.vy -= 24 * dt; l.vx *= 1 - dt * 1.5;
        l.x += l.vx * dt; const ny = l.y + l.vy * dt;
        const gy = this.groundAt(l.x, l.y + 0.2);
        if (gy > -5 && ny <= gy + 0.3 && l.vy <= 0) { l.y = gy + 0.3; l.vy = Math.abs(l.vy) > 2 ? -l.vy * 0.4 : 0; l.vx *= 0.6; } else l.y = ny;
      }
      if (d < (l.kind === "coin" ? 0.75 : 1.0) && l.t > 0.15) {
        l.t = 1e9;
        if (l.kind === "coin") { this.coins += l.value; this.emit({ t: "coin", x: l.x, y: l.y }); }
        else if (l.kind === "weapon" && l.w) { this.weapon = l.w; this.emit({ t: "pickup", w: l.w }); }
        else if (l.kind === "bombs") { this.bombs = Math.min(this.maxBombs, this.bombs + 1); this.emit({ t: "bombs", n: this.bombs }); }
        else if (l.kind === "heart") { this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.emit({ t: "heart" }); }
      }
    }
    this.loot = this.loot.filter((l) => l.t < 14 && l.y > -4);
  }

  // ------------------------------------------------------------------ shots (Puddo's and the enemies')
  shoot(kind: FoeShot | string, x: number, y: number, vx: number, vy: number, grav = 0, r = 0.28, life = 4) {
    this.shots.push({ kind, x, y, vx, vy, r, foe: true, life, bounces: 0, grav, id: this.sid++, dmg: 1, pierce: 0, chain: 0, home: false, hits: [] });
  }
  /** an aimed dust ball from (x, y) at Puddo */
  shootAt(kind: FoeShot | string, x: number, y: number, speed: number, spread = 0) {
    const dx = this.x - x, dy = this.y + 0.6 - y, d = Math.max(0.01, Math.hypot(dx, dy)), a = Math.atan2(dy, dx) + spread;
    void d;
    this.shoot(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, 0, 0.27, 3.2);
  }
  private updateShots(dt: number) {
    const hw = MOMO_W / 2;
    for (const s of this.shots) {
      if (s.foe && s.kind === "orb") {
        // slow homing orbs
        const a = Math.atan2(this.y + 0.6 - s.y, this.x - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy);
        let da = a - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const na = cur + clamp(da, -1.7 * dt, 1.7 * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      if (s.home && !s.foe) {
        const tg = this.nearestFoe(s.x, s.y, 8);
        if (tg) { const a = Math.atan2(tg[1] - s.y, tg[0] - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy); let da = a - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = cur + clamp(da, -7 * dt, 7 * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; }
      }
      s.life -= dt; s.vy -= s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const tx = Math.floor(s.x), ty = Math.floor(s.y - (s.kind === "roller" ? s.r : 0));
      const sol = this.solid(tx, ty);
      if (s.kind === "roller") {
        const gy = this.groundAt(s.x, s.y + 0.5);
        if (gy > -5 && s.y - s.r <= gy + 0.02 && s.vy <= 0) { s.y = gy + s.r; s.vy = 0; }
        if (this.solid(Math.floor(s.x + Math.sign(s.vx) * s.r), Math.floor(s.y)) === 1) s.life = 0;
        if (s.y < -3) s.life = 0;
      } else if (s.kind === "mine") {
        const gy = this.groundAt(s.x, s.y + 0.4);
        if (gy > -5 && s.y - s.r <= gy && s.vy <= 0) { s.y = gy + s.r; s.vy = 0; s.vx = 0; }
      } else if (sol === 1 || (sol === 2 && s.vy < 0 && (s.kind === "bomb" || s.kind === "bombDrop" || s.kind === "shell") && s.y - ty < 1.05)) {
        if (s.kind === "bomb") {
          if (s.bounces > 0 && s.vy < 0 && sol === 1 && this.solid(tx, Math.floor(s.y - s.vy * dt)) !== 1) { s.y = ty + 1 + s.r; s.vy = 4.5; s.vx *= 0.6; s.bounces--; continue; }
          s.life = 0; this.explode(s.x, s.y); continue;
        }
        if (s.kind === "bombDrop" || s.kind === "shell") { s.life = 0; this.foeBoom(s.x, Math.max(s.y, ty + 1)); continue; }
        if (s.kind === "tankShell") { s.life = 0; this.smallBlast(s.x - s.vx * dt, s.y - s.vy * dt, 1.4, 3 * this.dmgMul); continue; }
        if (s.kind === "spore") { s.vx = 0; s.vy = 0; s.grav = 0; s.y = Math.max(s.y, ty + 1 + s.r); continue; }
        if (!s.foe && this.tile(tx, ty) === T.BREAK) {
          const k = ty * this.w + tx, hits = (this.tileHits.get(k) ?? 0) + s.dmg;
          if (hits >= 2) this.breakTile(tx, ty); else this.tileHits.set(k, hits);
        }
        if (sol === 1) { s.life = 0; if (!s.foe) this.emit({ t: "hit", x: s.x - s.vx * dt, y: s.y - s.vy * dt }); }
      }
      if (s.life <= 0) {
        if (s.kind === "bomb") this.explode(s.x, s.y);
        continue;
      }
      if (s.foe) {
        if (s.kind === "mine") {
          if (Math.abs(s.x - this.x) < 0.75 && Math.abs(s.y - (this.y + 0.4)) < 0.9) { s.life = 0; this.foeBoom(s.x, s.y); }
          continue;
        }
        if (overlap(this.x - hw, this.y, this.x + hw, this.y + this.bodyH, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) {
          if (s.kind !== "roller") s.life = 0;
          if (s.kind === "bombDrop" || s.kind === "shell") this.foeBoom(s.x, s.y); else this.hurt(s.kind);
        }
        continue;
      }
      if (s.kind === "bomb") {
        // a bomb bursts on the first enemy it touches
        for (const f of this.foes) if (f.alive && overlap(f.x - f.b.w / 2, f.y, f.x + f.b.w / 2, f.y + f.b.h, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) { s.life = 0; this.explode(s.x, s.y); break; }
        if (s.life > 0 && this.boss?.active && !this.boss.down && !this.boss.under && overlap(this.boss.x - this.boss.w / 2, this.boss.y, this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) { s.life = 0; this.explode(s.x, s.y); }
        continue;
      }
      // pellets: enemies (shields block from the front), the boss, targets, pots, switches
      for (const f of this.foes) {
        if (!f.alive || s.hits.includes(f.id) || this.hidden(f)) continue;
        if (!overlap(f.x - f.b.w / 2, f.y, f.x + f.b.w / 2, f.y + f.b.h, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) continue;
        if (f.b.b === "shield" && Math.sign(s.vx) === -f.dir && s.y > f.y + 0.42 && s.pierce === 0 && Math.abs(s.vx) > Math.abs(s.vy)) { s.life = 0; this.emit({ t: "shield", x: f.x + f.dir * 0.4, y: s.y }); break; }
        s.hits.push(f.id);
        if (s.kind === "tankShell") { s.life = 0; this.smallBlast(s.x, s.y, 1.4, s.dmg); break; }
        this.damage(f, s.dmg);
        if (s.chain > 0) {
          let k = s.chain;
          for (const o of this.foes) { if (k <= 0) break; if (o !== f && o.alive && Math.hypot(o.x - f.x, o.y - f.y) < 3.6) { this.damage(o, s.dmg * 0.7); this.emit({ t: "hit", x: o.x, y: o.y + o.b.h * 0.6 }); k--; } }
        }
        if (s.pierce > 0) s.pierce--; else { s.life = 0; break; }
      }
      if (s.life <= 0) continue;
      for (const m of this.shots) if (m.foe && m.kind === "mine" && m.life > 0 && Math.abs(m.x - s.x) < 0.5 && Math.abs(m.y - s.y) < 0.5) { m.life = 0; s.life = 0; this.foeBoom(m.x, m.y); }
      if (s.life <= 0) continue;
      const b = this.boss;
      if (b?.active && !b.down && !b.under && overlap(b.x - b.w / 2, b.y, b.x + b.w / 2, b.y + b.h, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) { s.life = 0; this.hitBoss(s.dmg, true); this.emit({ t: "hit", x: s.x, y: s.y }); continue; }
      for (const tg of this.st.targets) {
        if ((this.tgtHp.get(tg.id) ?? 0) <= 0) continue;
        const [w, h] = tg.kind === "pump" ? [1.8, 2.6] : [1.4, 1.6];
        if (overlap(tg.x - w / 2, tg.y, tg.x + w / 2, tg.y + h, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) { s.life = 0; this.hitTarget(tg, s.dmg); this.emit({ t: "hit", x: s.x, y: s.y }); break; }
      }
      if (s.life <= 0) continue;
      if (!this.switchOn) for (const g of this.st.gadgets) if (g.kind === "switch" && Math.abs(g.x - s.x) < 0.75 && s.y - g.y < 1.6 && s.y > g.y - 0.3) { s.life = 0; this.flip(); break; }
      for (const p of this.st.pots) if (s.life > 0 && !this.potsOpen.has(p.id) && Math.abs(p.x - s.x) < 0.55 && s.y - p.y < 1 && s.y > p.y - 0.2) { s.life = 0; this.openPot(p.id); }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.x > -2 && s.x < this.w + 2 && s.y > -4 && s.y < this.h + 6);
  }
  private nearestFoe(x: number, y: number, r: number): [number, number] | null {
    let best: [number, number] | null = null, bd = r;
    for (const f of this.foes) { if (!f.alive || this.hidden(f)) continue; const d = Math.hypot(f.x - x, f.y + f.b.h / 2 - y); if (d < bd) { bd = d; best = [f.x, f.y + f.b.h / 2]; } }
    const b = this.boss;
    if (b?.active && !b.down && !b.under) { const d = Math.hypot(b.x - x, b.y + b.h / 2 - y); if (d < bd) best = [b.x, b.y + b.h / 2]; }
    return best;
  }
  /** the Mud Tank's shell bursts */
  smallBlast(x: number, y: number, r: number, dmg: number) {
    this.emit({ t: "boom", x, y, r });
    for (const f of this.foes) if (f.alive && !this.hidden(f) && Math.hypot(f.x - x, f.y + f.b.h / 2 - y) < r + f.b.w / 2) this.damage(f, dmg, true);
    const b = this.boss;
    if (b?.active && !b.down && !b.under && Math.abs(b.x - x) < r + b.w / 2 && y > b.y - r && y < b.y + b.h + r) this.hitBoss(dmg * 0.8, true);
    for (const tg of this.st.targets) if (Math.abs(tg.x - x) < r + 0.8 && y > tg.y - r && y < tg.y + 2.6 + r) this.hitTarget(tg, dmg);
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) if (this.tile(tx, ty) === T.BREAK) this.breakTile(tx, ty);
  }
  /** an enemy bomb / shell bursts: a small blast */
  foeBoom(x: number, y: number) {
    this.emit({ t: "boom", x, y, r: 1.2 });
    if (Math.hypot(this.x - x, this.y + 0.5 - y) < 1.5) this.hurt("blast");
  }
  private flip() { if (this.switchCd > 0) return; this.switchOn = !this.switchOn; this.switchCd = 0.5; this.emit({ t: "switch", on: this.switchOn }); }

  // ------------------------------------------------------------------ targets: Dust Pumps and Sprout cages
  hitTarget(tg: Target, n: number) {
    const hp = this.tgtHp.get(tg.id) ?? 0;
    if (hp <= 0) return;
    const left = hp - n;
    this.tgtHp.set(tg.id, left);
    if (left > 0) return;
    if (tg.kind === "pump") { this.pumpsDown++; this.emit({ t: "pumpDown", x: tg.x, y: tg.y + 1.2 }); this.dropCoins(tg.x, tg.y + 1.5, 12); }
    else { this.rescued++; this.emit({ t: "cageOpen", x: tg.x, y: tg.y + 0.8 }); this.dropCoins(tg.x, tg.y + 1, 6); }
  }

  // ------------------------------------------------------------------ enemies
  private updateFoes(dt: number) {
    const hw = MOMO_W / 2;
    const tempo = 0.85 + 0.3 * Math.min(1.2, this.st.d);
    const fireK = 1.25 - 0.45 * Math.min(1.2, this.st.d);
    for (const f of this.foes) {
      if (!f.alive) continue;
      const dx = this.x - f.x, dy = this.y - f.y;
      if (Math.abs(dx) > 26 || Math.abs(dy) > 18) { if (f.gate < 0 && f.seek === null) continue; }
      f.t += dt; f.flash = Math.max(0, f.flash - dt); f.squash = Math.max(0, f.squash - dt); f.hit = Math.max(0, f.hit - dt); f.cool = Math.max(0, f.cool - dt);
      const b = f.b, sp = b.speed * tempo * (f.elite ? 1.15 : 1);
      const near = Math.abs(dx) < 14 && Math.abs(dy) < 8;
      const goal = f.seek !== null ? f.seek : this.x;
      // a volley in progress (gunners, turrets, shields)
      if (f.burst > 0) { f.burstT -= dt; if (f.burstT <= 0) { f.burst--; f.burstT = 0.15; this.foeFire(f); } }
      if (f.tell > 0) { f.tell -= dt; if (f.tell <= 0) { f.burst = b.burst ?? 1; f.burstT = 0; } }
      const every = (b.every ?? 2.5) * fireK * (f.elite ? 0.75 : 1);
      const readyShot = () => { f.shotT -= dt; if (f.shotT <= 0 && f.tell <= 0 && f.burst <= 0) { f.shotT = every * (0.85 + this.rnd() * 0.3); f.tell = b.b === "sniper" ? 0.9 : 0.42; f.ax = this.x; f.ay = this.y + 0.6; if (b.b === "sniper") this.emit({ t: "aim", x: f.x, y: f.y + b.h * 0.7, tx: f.ax, ty: f.ay }); } };
      switch (b.b) {
        case "walk": case "spiky": case "chase": {
          if (b.b === "chase" && Math.abs(dx) < 9) f.dir = Math.sign(dx) || f.dir;
          if (f.seek !== null) f.dir = Math.sign(goal - f.x) || f.dir;
          f.vx = f.dir * sp;
          this.patrolTurn(f, f.seek === null && b.b !== "chase");
          this.foePhys(f, dt);
          break;
        }
        case "gunner": case "shield": {
          // face Puddo; walk the patrol (shields close in) when not firing
          if (near) f.dir = Math.sign(dx) || f.dir;
          const holding = f.tell > 0 || f.burst > 0;
          if (f.seek !== null) { f.dir = Math.sign(goal - f.x) || f.dir; f.vx = holding ? 0 : f.dir * Math.max(0.8, sp); }
          else if (b.b === "shield") f.vx = holding || Math.abs(dx) < 3 || !near ? 0 : f.dir * sp;
          else if (sp > 0) { f.vx = holding || near ? 0 : f.dir * sp; if (!near) this.patrolTurn(f, true); }
          else f.vx = 0;
          if (near) readyShot();
          this.foePhys(f, dt);
          break;
        }
        case "runner": {
          if (f.state === 0 && ((Math.abs(dx) < 12 && Math.abs(dy) < 4) || f.seek !== null)) { f.state = 1; f.dir = Math.sign(goal - f.x) || -1; }
          if (f.state === 1) {
            if (f.seek !== null) f.dir = Math.sign(goal - f.x) || f.dir;
            f.vx = f.dir * sp;
            const ahead = f.x + f.dir * 0.6;
            if (f.ground && (this.solid(Math.floor(ahead), Math.floor(f.y + 0.3)) === 1 || this.groundAt(ahead, f.y + 0.2) < f.y - 0.6)) f.vy = 10.5;
            if (f.seek === null && Math.sign(dx) !== f.dir && Math.abs(dx) > 5) f.dir = -f.dir;
          } else { f.vx = 0; }
          this.foePhys(f, dt);
          break;
        }
        case "hop": {
          if (f.ground) {
            f.vx = 0;
            if (f.t > (b.shape === "army" ? 1.0 : 1.4)) { f.t = 0; f.dir = f.seek !== null ? Math.sign(goal - f.x) || -1 : Math.abs(dx) < 9 ? Math.sign(dx) || -1 : -f.dir; f.vy = b.hopV ?? 10; f.vx = f.dir * sp * 1.6; }
          }
          this.foePhys(f, dt);
          break;
        }
        case "lob": {
          if (near) { f.dir = Math.sign(dx) || f.dir; readyShot(); }
          f.vx = 0; this.foePhys(f, dt);
          break;
        }
        case "brute": {
          if (f.state === 0) {
            f.dir = f.seek !== null ? Math.sign(goal - f.x) || f.dir : Math.abs(dx) < 11 ? Math.sign(dx) || f.dir : f.dir;
            f.vx = f.dir * sp;
            if (f.seek === null) this.patrolTurn(f, Math.abs(dx) >= 11);
            if (Math.abs(dx) < 5.5 && Math.abs(dy) < 2 && f.ground && f.cool <= 0) { f.state = 1; f.st = 0.6; f.vx = 0; f.tell = 0; }
          } else if (f.state === 1) { f.vx = 0; f.st -= dt; f.flash = 0.1; if (f.st <= 0) { f.state = 2; f.st = 0.75; } }
          else if (f.state === 2) { f.vx = f.dir * 8; f.st -= dt; if (f.st <= 0 || this.solid(Math.floor(f.x + f.dir * 0.9), Math.floor(f.y + 0.4)) === 1) { f.state = 0; f.cool = 1.4; this.emit({ t: "crusher" }); } }
          this.foePhys(f, dt);
          break;
        }
        case "drone": {
          if (f.state === 0) {
            f.x += (f.x0 + Math.sin(f.t * 1.4) * Math.max(1.5, f.range) - f.x) * Math.min(1, dt * 3); f.y += (f.y0 + Math.sin(f.t * 2.6) * 0.5 - f.y) * Math.min(1, dt * 3);
            f.dir = Math.sign(dx) || f.dir;
            if (Math.abs(dx) < 7 && f.cool <= 0 && Math.abs(dy) < 7) { f.state = 1; f.st = 0.35; f.vx = 0; f.vy = 0; }
          } else if (f.state === 1) { f.st -= dt; f.flash = 0.1; if (f.st <= 0) { f.state = 2; f.st = 0.9; const a = Math.atan2(this.y + 0.5 - f.y, dx); f.vx = Math.cos(a) * 7.5; f.vy = Math.sin(a) * 7.5; } }
          else if (f.state === 2) { f.x += f.vx * dt; f.y += f.vy * dt; f.st -= dt; if (f.st <= 0 || this.solid(Math.floor(f.x), Math.floor(f.y)) === 1) { f.state = 3; f.cool = 1.6; } }
          else { f.x += (f.x0 - f.x) * Math.min(1, dt * 1.5); f.y += (f.y0 - f.y) * Math.min(1, dt * 1.8); if (Math.abs(f.y - f.y0) < 0.3) f.state = 0; }
          break;
        }
        case "bomber": {
          f.x = f.x0 + Math.sin(f.t * sp * 0.32) * Math.max(3, f.range);
          f.y = f.y0 + Math.sin(f.t * 1.8) * 0.4;
          f.dir = Math.cos(f.t * sp * 0.32) > 0 ? 1 : -1;
          if (Math.abs(dx) < 1.2 && dy < -1 && f.cool <= 0) { f.cool = every; if (b.shot === "spike") this.shoot("spike", f.x, f.y - 0.2, 0, -10, 6, 0.22, 3); else this.shoot("bombDrop", f.x, f.y - 0.2, f.dir * 1.5, -1, 22, 0.3, 4); this.emit({ t: "foeShot", x: f.x, y: f.y }); }
          break;
        }
        case "dive": {
          if (f.state === 0) {
            f.x += clamp(dx, -1, 1) * 1.6 * dt * (Math.abs(dx) < 11 ? 1 : 0); f.y = f.y0 + Math.sin(f.t * 2) * 0.35; f.dir = Math.sign(dx) || f.dir;
            if (Math.abs(dx) < 3.2 && dy < 0 && f.cool <= 0) { f.state = 1; f.st = 0.45; }
          } else if (f.state === 1) { f.st -= dt; f.flash = 0.1; if (f.st <= 0) { f.state = 2; const a = Math.atan2(this.y + 0.4 - f.y, dx); f.vx = Math.cos(a) * 11; f.vy = Math.sin(a) * 11; f.st = 1.1; } }
          else if (f.state === 2) { f.x += f.vx * dt; f.y += f.vy * dt; f.st -= dt; if (f.st <= 0 || this.solid(Math.floor(f.x), Math.floor(f.y)) === 1) { f.state = 3; f.cool = 2; } }
          else { f.y += (f.y0 - f.y) * Math.min(1, dt * 1.6); f.x += (f.x0 - f.x) * Math.min(1, dt * 0.6); if (Math.abs(f.y - f.y0) < 0.3) f.state = 0; }
          break;
        }
        case "turret": {
          f.dir = Math.sign(dx) || f.dir;
          const sees = Math.abs(dx) < 13 && Math.abs(dy) < 9 && (!b.ceiling || dy < 0.5);
          if (sees) readyShot();
          break;
        }
        case "hive": {
          if (Math.abs(dx) < 16 && Math.abs(dy) < 9 && f.cool <= 0) {
            const kids = this.foes.filter((o) => o.alive && o.parent === f.id).length;
            if (kids < 3) {
              f.cool = every; f.flash = 0.3;
              const list = b.spawn ?? ["dustie"], kind = list[f.state++ % list.length];
              const k = this.spawnFoe(kind, f.x + Math.sign(dx || -1) * 0.9, kind === "dustDrone" ? f.y + 2.5 : f.y + 0.2, { parent: f.id, dir: Math.sign(dx) || -1, range: 3 });
              k.vy = 5; k.state = kind === "dustRunner" ? 1 : 0;
            } else f.cool = 1;
          }
          break;
        }
        case "mine": {
          f.vx = f.dir * sp; this.patrolTurn(f, true); this.foePhys(f, dt);
          if (near && f.cool <= 0 && f.ground) { f.cool = every; this.shoot("mine", f.x - f.dir * 0.5, f.y + 0.3, 0, 0, 30, 0.3, 14); }
          break;
        }
        case "fly": {
          f.x = f.x0 + Math.sin(f.t * sp * 0.45) * Math.max(1.5, f.range);
          f.y = f.y0 + Math.sin(f.t * 2.1) * 0.7;
          f.dir = Math.cos(f.t * sp * 0.45) > 0 ? 1 : -1;
          if (b.shot && near && f.cool <= 0) { f.cool = every; if (b.shot === "orb") this.shootAt("orb", f.x, f.y + b.h * 0.5, 3.3); else this.shoot(b.shot, f.x, f.y, 0, -4, 18, 0.28); this.emit({ t: "foeShot", x: f.x, y: f.y }); }
          break;
        }
        case "swim": {
          f.x = f.x0 + Math.sin(f.t * sp * 0.4) * Math.max(1.5, f.range);
          f.y = f.y0 + Math.sin(f.t * 1.4) * 0.5;
          f.dir = Math.cos(f.t * sp * 0.4) > 0 ? 1 : -1;
          break;
        }
        case "shoot": {
          f.dir = dx < 0 ? -1 : 1;
          if (near) readyShot();
          f.vx = 0; this.foePhys(f, dt);
          break;
        }
        case "drop": f.y = f.y0 + 2 - Math.abs(Math.sin(f.t * sp * 0.6)) * 3; break;
        case "sniper": {
          f.dir = Math.sign(dx) || f.dir;
          if (Math.abs(dx) < 19 && Math.abs(dy) < 10) readyShot();
          f.vx = 0; this.foePhys(f, dt);
          break;
        }
        case "copter": {
          // hovers a little to one side of Puddo and fires down at him
          const tx = this.x + (f.x < this.x ? -3.5 : 3.5);
          if (Math.abs(dx) < 16) f.x += clamp(tx - f.x, -1, 1) * sp * dt;
          f.y += (f.y0 + Math.sin(f.t * 2.2) * 0.45 - f.y) * Math.min(1, dt * 3);
          f.dir = Math.sign(dx) || f.dir;
          if (near) readyShot();
          break;
        }
        case "tank": {
          f.dir = Math.sign(dx) || f.dir;
          f.vx = near && Math.abs(dx) > 7 ? f.dir * sp : 0;
          if (near) readyShot();
          this.foePhys(f, dt);
          break;
        }
        case "ambusher": {
          // a root under the ground: up it comes when Puddo steps close, swipes, then sinks back
          if (f.state === 0) { if (Math.abs(dx) < 3.2 && Math.abs(dy) < 2) { f.state = 1; f.st = 0.45; this.emit({ t: "spawn", x: f.x, y: f.y + 0.3 }); } }
          else { f.st -= dt; if (f.st <= 0) { if (f.state === 1) { f.state = 2; f.st = 0.5; } else if (f.state === 2) { f.state = 3; f.st = 1.6; } else { f.state = 0; } } if (f.state === 2 && Math.abs(dx) < 1.7 && Math.abs(dy) < 1.6) this.hurt("root"); }
          break;
        }
        case "burrower": {
          if (f.state === 0) {
            // swims under the sand toward Puddo
            f.x += clamp(dx, -1, 1) * sp * dt; const gy = this.groundAt(f.x, f.y + 2); if (gy > -5) f.y = gy;
            if (Math.abs(dx) < 1.3 && Math.abs(dy) < 3 && f.cool <= 0) { f.state = 1; f.st = 0.45; }
          } else if (f.state === 1) { f.st -= dt; if (f.st <= 0) { f.state = 2; f.vy = 12.5; f.vx = (Math.sign(dx) || 1) * 2; this.emit({ t: "spawn", x: f.x, y: f.y }); } }
          else if (f.state === 2) { this.foePhys(f, dt); if (f.ground && f.vy <= 0) { f.state = 3; f.st = 1.4; f.vx = 0; } }
          else { f.st -= dt; this.foePhys(f, dt); if (f.st <= 0) { f.state = 0; f.cool = 1.5; } }
          break;
        }
        case "pod": {
          if (f.state === 0) { if (Math.abs(dx) < 9) { f.state = 1; f.vy = -6; } }
          else if (f.state === 1) {
            f.vy -= GRAV * 0.6 * dt; f.y += f.vy * dt;
            const gy = this.groundAt(f.x, f.y + 1);
            if (gy > -5 && f.y <= gy) {
              f.y = gy; f.state = 2; this.emit({ t: "boom", x: f.x, y: f.y + 0.4, r: 1.3 });
              if (Math.abs(dx) < 1.4 && dy < 1.6) this.hurt("pod");
              for (const k of b.spawn ?? ["dustie"]) { const c = this.spawnFoe(k, f.x + (this.rnd() < 0.5 ? -1 : 1), f.y + 0.4, { gate: f.gate, parent: f.id }); c.vy = 6; if (k === "dustRunner") c.state = 1; }
            }
          }
          break;
        }
        case "flamer": {
          f.dir = Math.sign(dx) || f.dir;
          if (f.state === 0) {
            f.vx = near && Math.abs(dx) > 2.2 ? f.dir * sp : 0;
            if (Math.abs(dx) < 3.8 && Math.abs(dy) < 1.8 && f.cool <= 0) { f.state = 1; f.st = 0.45; f.vx = 0; }
          } else if (f.state === 1) { f.vx = 0; f.st -= dt; f.flash = 0.1; if (f.st <= 0) { f.state = 2; f.st = 1.2; } }
          else {
            f.vx = 0; f.st -= dt; f.burstT -= dt;
            if (f.burstT <= 0) { f.burstT = 0.06; this.shoot("flame", f.x + f.dir * b.w * 0.6, f.y + b.h * 0.55, f.dir * (6.5 + this.rnd() * 1.5), (this.rnd() - 0.4) * 1.6, 0, 0.3, 0.45); }
            if (f.st <= 0) { f.state = 0; f.cool = 2.0; }
          }
          this.foePhys(f, dt);
          break;
        }
        case "slammer": {
          f.dir = Math.sign(dx) || f.dir;
          if (f.ground && f.state === 1) {
            // landed: shockwaves both ways along the ground
            f.state = 0; f.cool = 1.6; f.vx = 0; this.emit({ t: "crusher" });
            for (const d of [-1, 1]) this.shoot("dust", f.x + d * b.w * 0.5, f.y + 0.35, d * 7, 0, 0, 0.35, 1.6);
          }
          if (f.ground && f.state === 0 && near && f.cool <= 0) { f.tell = 0; f.flash = 0.3; f.state = 1; f.vy = 13; f.vx = f.dir * Math.min(3.5, Math.abs(dx)); f.ground = false; }
          this.foePhys(f, dt);
          break;
        }
        case "sled": {
          // zooms low over the ground, passes Puddo, turns round
          if (Math.abs(dx) > 7 && Math.sign(dx) !== f.dir && f.cool <= 0) { f.dir = Math.sign(dx); f.cool = 0.8; }
          if (Math.abs(dx) < 22) f.x += f.dir * sp * dt;
          f.y = f.y0 + Math.sin(f.t * 6) * 0.08;
          break;
        }
        case "blower": {
          f.dir = Math.sign(dx) || f.dir;
          if (Math.abs(dx) < 8 && Math.abs(dy) < 2.2) this.foePush += Math.sign(dx) * 5.2 * (1 - Math.abs(dx) / 9);
          this.foePhys(f, dt);
          break;
        }
      }
      // Hold the Well: attackers that reach the well bash it
      if (f.seek !== null && this.st.defend && Math.abs(f.x - this.st.defend.x) < 1.3 && Math.abs(f.y - this.st.defend.y) < 2.5) {
        f.alive = false; this.wellHp = Math.max(0, this.wellHp - (b.b === "brute" ? 3 : 2)); this.emit({ t: "wellHit", hp: this.wellHp }); this.emit({ t: "boom", x: f.x, y: f.y + 0.5, r: 1 });
        continue;
      }
      if (f.seek !== null && this.st.escort && Math.abs(f.x - this.escortX) < 1.4 && Math.abs(f.y - this.escortY) < 2.2) {
        f.alive = false; this.escortHp = Math.max(0, this.escortHp - (b.b === "brute" || b.b === "tank" ? 3 : 2)); this.emit({ t: "cartHit", hp: this.escortHp }); this.emit({ t: "boom", x: f.x, y: f.y + 0.5, r: 1 });
        continue;
      }
      if (this.hidden(f)) continue;
      // touching Puddo
      if (!overlap(this.x - hw, this.y, this.x + hw, this.y + this.bodyH, f.x - b.w / 2 + 0.08, f.y, f.x + b.w / 2 - 0.08, f.y + b.h)) continue;
      const fromAbove = this.vy < -1 && this.y > f.y + b.h * 0.45;
      if (this.star > 0 || this.superT > 0 || (this.friend === "turbo" && b.stomp)) { this.damage(f, 99, true); continue; }
      if (this.st.ride?.kind === "mech" && b.b !== "brute" && b.b !== "tank" && b.b !== "pod" && b.b !== "hive") { this.damage(f, 6, true); f.vy = 6; continue; }
      if (fromAbove && b.stomp) {
        const dmg = this.stomping ? 5 : 3;
        f.squash = 0.25; this.vy = this.jumpHeld ? 15 : 10.5; this.stomping = false; this.bounced = true;
        this.emit({ t: "stomp", x: f.x, y: f.y + b.h });
        this.damage(f, dmg, true);
        continue;
      }
      if (b.b === "hive" || b.b === "turret") { if (this.y < f.y + b.h - 0.2) continue; }
      this.hurt(f.kind);
    }
    // hive babies and wave enemies that fell out of the world
    this.foes = this.foes.filter((f) => f.alive || f.id < 1_000_000 || f.t < 0);
  }
  private patrolTurn(f: Foe, useRange: boolean) {
    const ahead = f.x + f.dir * (f.b.w / 2 + 0.1);
    const wall = this.solid(Math.floor(ahead), Math.floor(f.y + 0.3)) === 1;
    const edge = f.ground && this.groundAt(ahead, f.y + 0.2) < f.y - 0.6;
    if (wall || edge || (useRange && Math.abs(f.x - f.x0) > f.range && Math.sign(f.x - f.x0) === f.dir)) f.dir = -f.dir;
  }
  private foePhys(f: Foe, dt: number) {
    f.vy -= GRAV * dt; f.x += f.vx * dt;
    if (this.solid(Math.floor(f.x + Math.sign(f.vx) * f.b.w * 0.45), Math.floor(f.y + 0.3)) === 1) f.x -= f.vx * dt;
    f.y += f.vy * dt; f.ground = false;
    const gy = this.groundAt(f.x, f.y + 0.6);
    if (gy > -5 && f.y <= gy && f.vy <= 0) { f.y = gy; f.vy = 0; f.ground = true; }
    if (this.tile(Math.floor(f.x), Math.floor(f.y + 0.2)) === T.WATER && f.b.b !== "swim") { f.vy = Math.max(f.vy, -1); }
    if (f.y < -3) { f.alive = false; if (f.hunt) { this.huntDown++; this.emit({ t: "huntDown", n: this.huntDown }); } }
  }
  /** one shot of an enemy's volley */
  private foeFire(f: Foe) {
    const b = f.b, k = b.shot ?? "dust", dx = this.x - f.x, dir = Math.sign(dx) || f.dir;
    const mx = f.x + dir * f.b.w * 0.55, my = f.y + (b.ceiling ? 0.1 : b.h * 0.62);
    if (b.b === "sniper") { const a = Math.atan2(f.ay - my, f.ax - mx); this.shoot("laser", mx, my, Math.cos(a) * 18, Math.sin(a) * 18, 0, 0.22, 2); this.emit({ t: "foeShot", x: mx, y: my }); return; }
    if (b.b === "copter") { this.shootAt("dust", mx, f.y, 7.5); this.emit({ t: "foeShot", x: mx, y: f.y }); return; }
    if (b.b === "tank") { this.shoot("cannon", mx, f.y + b.h * 0.6, dir * 8.5, 0.6, 2, 0.35, 3); this.emit({ t: "cannon" }); return; }
    if (k === "spore") { const T2 = 1.2, g = 14, ddx = this.x - mx + (this.rnd() - 0.5) * 1.5, ddy = this.y + 0.6 - my; this.shoot("spore", mx, my, ddx / T2, (ddy + 0.5 * g * T2 * T2) / T2, g, 0.5, 3.4); this.emit({ t: "foeShot", x: mx, y: my }); return; }
    if (b.b === "lob" || k === "shell") {
      const T2 = 1.15, g = 20, ddx = this.x - mx + (this.rnd() - 0.5) * 1.2, ddy = this.y - my;
      this.shoot("shell", mx, my, ddx / T2, (ddy + 0.5 * g * T2 * T2) / T2, g, 0.32, 4);
    } else if (k === "coconut" || k === "snow") this.shoot(k, f.x, f.y + f.b.h, dir * clamp(Math.abs(dx) * 0.7, 3, 7), 8, 22, 0.32);
    else if (k === "laser") this.shoot("laser", mx, my, dir * 10, 0, 0, 0.2, 2);
    else if (b.b === "turret") this.shootAt("dust", mx, my, 7.5);
    else if (k === "ice" || k === "dust") this.shoot(k, mx, my, dir * (k === "ice" ? 8 : 7.2), 0, 0, 0.27, 3);
    else this.shoot(k, mx, my, dir * 6, 2, 8, 0.27, 3);
    this.emit({ t: "foeShot", x: mx, y: my });
  }

  // ------------------------------------------------------------------ platforms
  private updatePlats() {
    for (const p of this.plats) {
      const s = p.s, k = s.speed / Math.max(0.5, s.range), ph = this.t * k + s.phase;
      let nx = s.x, ny = s.y;
      if (s.kind === "lift" || s.kind === "taxi") nx = s.x + Math.sin(ph) * s.range;
      else if (s.kind === "vlift") ny = s.y + Math.sin(ph) * s.range;
      else if (s.kind === "elevator") {
        const prog = clamp((this.t - this.liftT0 - 3) * s.speed, this.liftBase, s.range), third = s.range / 3;
        ny = s.y + prog;
        if (this.onPlat === p && prog - this.liftCp >= third && prog < s.range - 1) { this.liftCp = Math.floor(prog / third) * third; this.emit({ t: "checkpoint", n: Math.round(this.liftCp / third) }); }
      }
      else if (s.kind === "rock") { ny = s.y + Math.sin(this.t * s.speed + s.phase) * s.range * 0.5; p.tilt = Math.cos(this.t * s.speed + s.phase) * 0.12; }
      else if (s.kind === "swing") { const a = Math.sin(this.t * s.speed + s.phase) * 1.05; nx = s.x + Math.sin(a) * s.range; ny = s.y - Math.cos(a) * s.range; }
      p.dx = nx - p.x; p.dy = ny - p.y; p.x = nx; p.y = ny;
    }
  }

  // ------------------------------------------------------------------ gadgets
  gs(g: Gadget) { return this.gstate.get(g.id) ?? 0; }
  /** 0..1 position in the gadget's cycle */
  cyc(g: Gadget) { const per = (g.period ?? 3) * (1.25 - Math.min(1, this.st.d) * 0.3); return (((this.t + (g.phase ?? 0)) % per) + per) % per / per; }
  private updateGadgets() {
    const hw = MOMO_W / 2, me = [this.x - hw, this.y, this.x + hw, this.y + this.bodyH] as const;
    const hit = (x0: number, y0: number, x1: number, y1: number) => overlap(me[0], me[1], me[2], me[3], x0, y0, x1, y1);
    for (const g of this.st.gadgets) {
      if ((Math.abs(g.x - this.x) > 26 || Math.abs(g.y - this.y) > 20) && g.kind !== "roller") continue;
      switch (g.kind) {
        case "bonfire": if (hit(g.x - 0.35, g.y, g.x + 0.35, g.y + 0.8)) this.hurt("fire"); break;
        case "drip": case "rockfall": case "meteor": {
          const prev = this.gs(g), c = this.cyc(g);
          if (c < prev) {
            const x = g.kind === "drip" ? g.x : g.x + ((this.t * 7.3 + g.id) % 1) * (g.w ?? 6);
            const fromY = g.kind === "drip" ? g.y : Math.min(this.h, this.y + 9);
            this.shoot(g.kind === "drip" ? "drip" : g.kind === "meteor" ? "meteor" : "rock", x, fromY, 0, g.kind === "drip" ? -2 : -6, 26, g.kind === "drip" ? 0.18 : 0.4, 3);
            if (g.kind !== "drip") this.emit({ t: "rock" });
          }
          this.gstate.set(g.id, c);
          break;
        }
        case "icicle": if (!this.gs(g) && Math.abs(this.x - g.x) < 1.6 && this.y < g.y) { this.gstate.set(g.id, 1); this.shoot("icicle", g.x, g.y - 0.4, 0, -1, 30, 0.25, 3); this.emit({ t: "ice" }); } break;
        case "spider": { const yy = g.y - (g.h ?? 5) * (0.5 - 0.5 * Math.cos(this.cyc(g) * Math.PI * 2)); if (hit(g.x - 0.4, yy - 0.3, g.x + 0.4, yy + 0.4)) this.hurt("spider"); break; }
        case "crusher": {
          const c = this.cyc(g), down = c < 0.35 ? 0 : c < 0.45 ? (c - 0.35) / 0.1 : c < 0.7 ? 1 : 1 - (c - 0.7) / 0.3;
          const yb = g.y - down * ((g.h ?? 5) - 0.1);
          if (c >= 0.35 && c < 0.45 && this.gs(g) < 0.35) this.emit({ t: "crusher" });
          this.gstate.set(g.id, c);
          if (hit(g.x - (g.w ?? 2) / 2 + 0.1, yb, g.x + (g.w ?? 2) / 2 - 0.1, yb + 1) && down > 0.15) this.hurt("crusher");
          break;
        }
        case "laser": { const on = this.cyc(g) < 0.5; if (on && this.gs(g) === 0) this.emit({ t: "laser" }); this.gstate.set(g.id, on ? 1 : 0); if (on && hit(g.x - 0.15, g.y, g.x + 0.15, g.y + (g.h ?? 7))) this.hurt("laser"); break; }
        case "arrow": case "cannon": {
          const prev = this.gs(g), c = this.cyc(g);
          if (c < prev && Math.abs(this.x - g.x) < 16) { this.shoot(g.kind === "arrow" ? "arrow" : "cannon", g.x, g.y, (g.dir ?? -1) * (g.kind === "arrow" ? 9 : 7), g.kind === "cannon" ? 1.5 : 0, g.kind === "cannon" ? 4 : 0, g.kind === "cannon" ? 0.35 : 0.18, 4); this.emit({ t: g.kind }); }
          this.gstate.set(g.id, c);
          break;
        }
        case "roller": {
          const prev = this.gs(g), c = this.cyc(g);
          if (c < prev && this.x < g.x && g.x - this.x < 22) { const r = 0.35 + (g.w ?? 1) * 0.3; this.shoot("roller", g.x, g.y + r, (g.dir ?? -1) * (3.6 + (g.power ?? 1) * 1.4), 0, 30, r, 8); }
          this.gstate.set(g.id, c);
          break;
        }
        case "geyser": {
          const c = this.cyc(g), boil = c > 0.55 && c < 0.7, on = c >= 0.7 && c < 0.92;
          if (on && this.gs(g) !== 2) this.emit({ t: "geyser" });
          this.gstate.set(g.id, on ? 2 : boil ? 1 : 0);
          if (on && hit(g.x - 0.45, g.y, g.x + 0.45, g.y + (g.h ?? 6))) this.hurt("geyser");
          break;
        }
        case "sandjet": {
          const c = this.cyc(g), on = c < 0.4;
          this.gstate.set(g.id, on ? 1 : 0);
          if (on && hit(g.x - (g.w ?? 2) / 2, g.y, g.x + (g.w ?? 2) / 2, g.y + 3) && this.vy < 12) { this.vy = BOUNCE_V * 0.95; this.ground = false; this.bounced = true; this.emit({ t: "geyser" }); }
          break;
        }
        case "searchlight": {
          // the beam sweeps the ground; caught in it, the alarm brings Dusties running
          const bx = g.x + Math.sin(this.cyc(g) * Math.PI * 2) * (g.w ?? 9), floor = g.y - (g.h ?? 9);
          this.gstate.set(g.id, bx);
          const cdKey = g.id + 500000;
          if ((this.gstate.get(cdKey) ?? 0) > this.t) break;
          if (Math.abs(this.x - bx) < 1.5 && this.y < g.y - 1 && this.y > floor - 2) {
            this.gstate.set(cdKey, this.t + 5); this.emit({ t: "alarm", x: bx, y: this.y });
            for (let k = 0; k < 2 + (this.st.d > 0.45 ? 1 : 0); k++) { const f = this.spawnFoe(k === 1 ? "dustRunner" : "dustie", this.x + (k % 2 ? 8 : -8), this.y + 5, { range: 4 }); f.vy = 2; if (k === 1) f.state = 1; }
          }
          break;
        }
        case "lantern": if (!this.lit.has(g.id) && Math.abs(this.x - g.x) < 1.2 && Math.abs(this.y - g.y) < 2) { this.lit.add(g.id); this.emit({ t: "secretFound" }); } break;
        case "checkpoint": {
          const i = this.st.checkpoints.findIndex((c) => Math.abs(c.x - g.x) < 0.01 && Math.abs(c.y - g.y) < 0.01);
          if (i > this.cp && Math.abs(this.x - g.x) < 1.2 && (Math.abs(this.y - g.y) < 2.5 || this.st.ride?.kind === "glider")) { this.cp = i; this.respawnAt = { x: g.x, y: g.y }; this.emit({ t: "checkpoint", n: i + 1 }); }
          break;
        }
        case "gong": {
          if (this.goalDone && this.x >= g.x - 0.7 && this.x <= g.x + 0.7 && this.y < g.y + (g.h ?? 6) && this.y > g.y - 1) {
            const height = clamp((this.y - g.y) / ((g.h ?? 6) - 1), 0, 1);
            const bonus = 10 + Math.round(height * 40);
            this.coins += bonus + clearBonus(this.noHit, this.bestCombo); this.done = true; this.cleared = true;
            this.emit({ t: "gong", height, coins: bonus }); this.emit({ t: "clear" });
          }
          break;
        }
        case "bell": if (this.boss?.down && Math.abs(this.x - g.x) < 1 && this.y < g.y + 3) { this.coins += clearBonus(this.noHit, this.bestCombo); this.done = true; this.cleared = true; this.emit({ t: "bell" }); this.emit({ t: "clear" }); } break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------------ items and pots
  private updateItems() {
    const hw = MOMO_W / 2 + 0.15;
    for (const it of this.st.items) {
      if (this.taken.has(it.id) || Math.abs(it.x - this.x) > 1.5 || Math.abs(it.y - this.y) > 3) continue;
      const big = it.kind === "key" ? 0.7 : 0;
      if (!overlap(this.x - hw, this.y - 0.1, this.x + hw, this.y + this.bodyH + 0.15, it.x - 0.3 - big, it.y - 0.35 - big * 1.4, it.x + 0.3 + big, it.y + 0.35 + big * 1.4)) continue;
      this.taken.add(it.id);
      switch (it.kind) {
        case "coin": this.coins++; this.emit({ t: "coin", x: it.x, y: it.y }); break;
        case "fruit": this.coins += 2; this.storm = Math.min(1, this.storm + 0.1); this.emit({ t: "fruit", x: it.x, y: it.y }); break;
        case "drop": this.drops.add(it.id); this.emit({ t: "drop", x: it.x, y: it.y, n: this.drops.size }); break;
        case "heart": this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.emit({ t: "heart" }); break;
        case "juice": this.storm = 1; if (!this.stormFullSaid) { this.stormFullSaid = true; this.emit({ t: "stormFull" }); } this.emit({ t: "juice" }); break;
        case "star": this.star = 8; this.emit({ t: "star" }); break;
        case "key": this.keys++; this.emit({ t: "key", n: this.keys }); break;
        case "bombs": this.bombs = Math.min(this.maxBombs, this.bombs + 2); this.emit({ t: "bombs", n: this.bombs }); break;
        case "weapon": if (it.w) { this.weapon = it.w; this.emit({ t: "pickup", w: it.w }); } break;
      }
    }
    for (const p of this.st.pots) {
      if (this.potsOpen.has(p.id) || Math.abs(p.x - this.x) > 1.2 || Math.abs(p.y - this.y) > 2) continue;
      if (overlap(this.x - MOMO_W / 2, this.y, this.x + MOMO_W / 2, this.y + this.bodyH, p.x - 0.4, p.y, p.x + 0.4, p.y + 0.9)) this.openPot(p.id);
    }
  }
  openPot(id: number) {
    const p = this.st.pots.find((q) => q.id === id);
    if (!p || this.potsOpen.has(id)) return;
    this.potsOpen.add(id);
    const it = p.item;
    this.emit({ t: "pot", x: p.x, y: p.y, item: it });
    switch (it.k) {
      case "friend": if (this.friend === it.f) this.coins += 10; else { this.friend = it.f; this.emit({ t: "friend", f: it.f }); } break;
      case "juice": this.storm = Math.min(1, this.storm + 0.5); this.emit({ t: "juice" }); break;
      case "heart": this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.emit({ t: "heart" }); break;
      case "star": this.star = 8; this.emit({ t: "star" }); break;
      case "coins": this.dropCoins(p.x, p.y + 0.8, 10); break;
      case "weapon": this.drop({ kind: "weapon", w: it.w, x: p.x, y: p.y + 0.8, value: 0, vy: 7 }); break;
      case "bombs": this.bombs = Math.min(this.maxBombs, this.bombs + it.n); this.emit({ t: "bombs", n: this.bombs }); break;
    }
  }

  // ------------------------------------------------------------------ goals: gates, the well, the vault, pumps/cages/keys
  private updateGoals(dt: number) {
    const st = this.st;
    // ambush gates
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i], sp = g.spec;
      if (g.phase === "idle" && this.activeGate < 0 && this.x > sp.x0 + 1.6 && this.x < sp.x1 - 1.2 && this.y >= sp.floor - 1 && this.y < sp.top) {
        g.phase = "on"; g.wave = 0; g.wait = 0.6; this.activeGate = i; this.emit({ t: "gateClose" });
      }
      if (g.phase !== "on") continue;
      if (g.wait > 0) { g.wait -= dt; if (g.wait <= 0) { this.spawnWave(g); g.since = this.t; } continue; }
      if (this.t - g.since > 45) for (const f of this.foes) if (f.alive && f.gate === sp.id) { f.alive = false; this.emit({ t: "spawn", x: f.x, y: f.y + 0.5 }); }
      if (!this.foes.some((f) => f.alive && f.gate === sp.id)) {
        if (g.wave + 1 < sp.waves.length) { g.wave++; g.wait = 1.1; }
        else {
          g.phase = "done"; this.activeGate = -1; this.wavesCleared++; this.emit({ t: "gateOpen" }); this.dropCoins((sp.x0 + sp.x1) / 2, sp.floor + 4, 10);
          if (st.goalKind === "waves" && this.gates.every((q) => q.phase === "done")) this.finishGoal(1.6);
        }
      }
    }
    // Hold the Well
    const df = st.defend;
    if (df && !this.goalDone) {
      if (Math.abs(this.x - df.x) < 40) this.defendT += dt;
      this.spawnT -= dt;
      const prog = this.defendT / df.time;
      if (this.spawnT <= 0 && this.defendT > 1.5) {
        this.spawnT = df.every * (1 - 0.35 * prog) * (0.8 + this.rnd() * 0.4);
        const left = this.spawnSide++ % 2 === 0;
        const fly = df.fly.length && this.spawnSide % 3 === 0;
        const kind = fly ? df.fly[Math.floor(this.rnd() * df.fly.length)] : df.kinds[Math.floor(this.rnd() * df.kinds.length)];
        const sx = left ? df.spawnL : df.spawnR;
        this.spawnFoe(kind, sx, fly ? df.y + 5 : df.y + 0.5, { seek: df.x, dir: left ? 1 : -1, elite: prog > 0.5 && this.rnd() < 0.12 });
      }
      if (this.wellHp <= 0) { this.done = true; this.cleared = false; this.emit({ t: "failed" }); return; }
      if (this.defendT >= df.time) { for (const f of this.foes) if (f.alive && f.seek !== null) this.melt(f); this.finishGoal(1.4); }
    }
    // the Coin Vault
    if (st.vault && !this.done) { this.vaultT -= dt; if (this.vaultT <= 0) { this.vaultT = 0; this.done = true; this.cleared = true; this.emit({ t: "clear" }); } }
    // the escort: the Rain Cart rolls on while Puddo is near and nothing stands in its way
    const es = st.escort;
    if (es && !this.done && !this.goalDone) {
      const blocked = this.foes.some((f) => f.alive && !this.hidden(f) && f.x > this.escortX - 0.3 && f.x < this.escortX + 2 && Math.abs(f.y - this.escortY) < 1.6);
      if (!blocked && this.x > this.escortX - 13 && this.x < this.escortX + 24) this.escortX += es.speed * dt;
      const gy = this.groundAt(this.escortX, this.escortY + 2); if (gy > -5) this.escortY = gy;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.t > 4) {
        this.spawnT = 6.5 - 3.3 * Math.min(1, st.d) + this.rnd() * 1.5;
        const ahead = this.rnd() < 0.7, sx = this.escortX + (ahead ? 15 : -11), sy = this.groundAt(sx, this.escortY + 6);
        const f = this.spawnFoe(this.rnd() < 0.5 ? "dustie" : "dustRunner", sx, sy > -5 ? sy + 0.2 : this.escortY + 1, { seek: this.escortX, dir: ahead ? -1 : 1 });
        f.state = 1;
      }
      for (const f of this.foes) if (f.alive && f.seek !== null) f.seek = this.escortX;
      if (this.escortHp <= 0) { this.done = true; this.cleared = false; this.emit({ t: "failed" }); return; }
      if (this.escortX >= st.goal.x - 2.5) this.finishGoal(1.4);
    }
    // pumps, cages, keys, hunted elites
    if (!this.goalDone) {
      const ok = (st.goalKind === "pumps" && this.pumpsDown >= st.need) || (st.goalKind === "rescue" && this.rescued >= st.need) || (st.goalKind === "keys" && this.keys >= st.need) || (st.goalKind === "hunt" && this.huntDown >= st.need);
      if (ok) { this.goalDone = true; this.emit({ t: "goalDone" }); this.emit({ t: "doorOpen" }); }
    }
  }
  private finishGoal(delay: number) { if (this.goalDone) return; this.goalDone = true; this.emit({ t: "goalDone" }); this.coins += clearBonus(this.noHit, this.bestCombo); this.doneAt = this.t + delay; }
  private spawnWave(g: GateState) {
    const sp = g.spec, wave = sp.waves[g.wave] ?? [];
    this.emit({ t: "wave", n: g.wave + 1, of: sp.waves.length });
    let k = 0;
    for (const wf of wave) {
      for (let i = 0; i < wf.n; i++, k++) {
        const b = BEAST[wf.kind];
        const flyer = b.b === "fly" || b.b === "drone" || b.b === "bomber" || b.b === "dive";
        const side = k % 2 === 0 ? 1 : -1;
        // walkers drop in near the walls (on Puddo's far side first), flyers come in high
        const far = this.x < (sp.x0 + sp.x1) / 2 ? 1 : -1;
        const x = flyer ? sp.x0 + 3 + this.rnd() * (sp.x1 - sp.x0 - 6) : side * far > 0 ? sp.x1 - 1.6 - this.rnd() * 2 : sp.x0 + 1.6 + this.rnd() * 2;
        const y = flyer ? Math.min(sp.top - 2, sp.floor + 5 + this.rnd() * 2) : sp.floor + 3 + this.rnd() * 2;
        const f = this.spawnFoe(wf.kind, x, y, { gate: sp.id, elite: wf.elite, range: 5 });
        if (b.b === "runner") f.state = 1;
        if (flyer) { f.x0 = x; f.y0 = y; }
      }
    }
  }

  // ------------------------------------------------------------------ hazards in tiles
  private tileHazards() {
    const hw = MOMO_W / 2 - 0.1;
    for (let tx = Math.floor(this.x - hw); tx <= Math.floor(this.x + hw); tx++) {
      for (let ty = Math.floor(this.y); ty <= Math.floor(this.y + this.bodyH - 0.1); ty++) {
        const v = this.tile(tx, ty);
        if (v === T.SPIKES && this.y < ty + 0.55) { this.hurt("spikes"); this.vy = Math.max(this.vy, 9); return; }
        if (v === T.LAVA || v === T.POISON) { this.fatal(v === T.LAVA ? "lava" : "poison"); return; }
        if (v === T.WATER && this.st.ride?.kind === "cart") { this.fatal("water"); return; }
      }
    }
  }

  // ------------------------------------------------------------------ chases (and the collapsing bridge)
  private updateChase(dt: number) {
    const c = this.st.rules.chase;
    if (!c) return;
    if (this.t < c.delay) return;
    const gap = this.x - this.chaseX, prev = this.chaseX;
    this.chaseX += c.speed * (gap > 14 ? 1.5 : 1) * dt;
    if (c.kind === "collapse") {
      // the bridge falls apart behind Puddo: planks and crumbly floor drop as the front passes
      for (let cx = Math.floor(prev) - 1; cx <= Math.floor(this.chaseX) - 1; cx++) {
        if (cx < 0 || cx >= this.w) continue;
        for (let cy = 0; cy < this.h; cy++) { const v = this.tile(cx, cy); if (v === T.ONEWAY || v === T.CRUMBLE) { this.setTile(cx, cy, T.EMPTY); if (cy % 3 === 0) this.emit({ t: "break", x: cx + 0.5, y: cy + 0.5 }); } }
      }
    }
    if (this.chaseX > this.x - 0.3 && !this.done) this.fatal("chase");
  }

  // ------------------------------------------------------------------ bosses
  hitBoss(n: number, shot = false) {
    const b = this.boss;
    if (!b || b.down || (!shot && b.inv > 0)) return;
    b.hp = Math.max(0, b.hp - n); if (!shot) b.inv = 0.5;
    this.emit({ t: "bossHit", hp: b.hp });
    if (b.hp <= 0) {
      b.down = true; b.state = "down"; b.t = 0;
      const machine = this.st.concept === "machine";
      this.dropCoins(b.x, b.y + b.h * 0.6, machine ? 60 : 90);
      this.coins += machine ? 60 : 160;
      this.emit({ t: "bossDown" });
      for (const f of this.foes) if (f.alive) { f.alive = false; this.emit({ t: "melt", x: f.x, y: f.y + 0.4, enemy: f.kind, elite: false }); }
      this.shots = this.shots.filter((s) => !s.foe);
      const arena = this.st.boss!;
      if (machine) { this.coins += clearBonus(this.noHit, this.bestCombo); this.doneAt = this.t + 2.6; this.emit({ t: "goalDone" }); }
      else this.st.gadgets.push({ kind: "bell", x: (arena.x0 + arena.x1) / 2, y: arena.floor + 3.5, id: 999999 });
    }
  }
  private updateBoss(dt: number) {
    const b = this.boss, ar = this.st.boss;
    if (!b || !ar) return;
    b.inv = Math.max(0, b.inv - dt);
    if (b.down) { b.t += dt; b.y += Math.max(0, 2 - b.t * 3) * dt; return; }
    if (!b.active) { if (this.x > ar.x0 + 1.5) { b.active = true; b.state = "intro"; b.t = 0; this.emit({ t: "bossRoar" }); } else return; }
    const def = BOSS[b.kind];
    b.t += dt; b.shotT -= dt;
    if (V2_PATTERNS.has(def.pattern)) { updateBossV2(this, b, def, dt); return; }
    // v1 patterns, sharpened for Rain Raid: more shots as the boss weakens
    const sp = def.speed * (0.85 + 0.25 * (1 - b.hp / b.max));
    const floor = ar.floor, lo = ar.x0 + b.w / 2 + 0.2, hi = ar.x1 - b.w / 2 - 0.2;
    const toward = Math.sign(this.x - b.x) || -1;
    const pattern = def.pattern === "kranky" ? (b.hp > b.max * 0.66 ? "shoot" : b.hp > b.max * 0.33 ? "charge" : "fly") : def.pattern;
    const fire = (vx: number, vy: number, grav: number) => { this.shoot(def.shot ?? "dust", b.x + b.dir * b.w * 0.4, b.y + b.h * 0.6, vx, vy, grav, 0.32, 5); };
    if (b.state === "intro") { b.vx = 0; if (b.t > 1.2) { b.state = "go"; b.t = 0; } }
    else if (pattern === "charge") {
      if (b.state === "go") { b.dir = toward; b.vx = b.dir * sp * 0.5; if (b.shotT <= 0) { b.shotT = 1.6; for (let i = -1; i <= 1; i++) this.shootAt("dust", b.x, b.y + b.h * 0.6, 7, i * 0.2); } if (b.t > 1.8) { b.state = "rush"; b.t = 0; this.emit({ t: "bossRoar" }); } }
      else if (b.state === "rush") { b.vx = b.dir * sp * 2.3; if ((b.x <= lo && b.dir < 0) || (b.x >= hi && b.dir > 0)) { b.state = "dizzy"; b.t = 0; b.vx = 0; this.emit({ t: "crusher" }); for (let i = 0; i < 3 + Math.floor((1 - b.hp / b.max) * 3); i++) this.shoot("rock", ar.x0 + 3 + ((i * 7.31 + b.t * 3) % (ar.x1 - ar.x0 - 6)), floor + 9, 0, -2, 26, 0.35, 3); } }
      else if (b.state === "dizzy") { b.vx = 0; if (b.t > 1.4) { b.state = "go"; b.t = 0; } }
    } else if (pattern === "jump") {
      if (b.state === "go") { b.vx = 0; if (b.shotT <= 0) { b.shotT = 1.3; this.shootAt("dust", b.x, b.y + b.h * 0.7, 7.5); } if (b.t > 0.9) { b.state = "air"; b.t = 0; b.vy = 15; b.dir = toward; b.vx = b.dir * clamp(Math.abs(this.x - b.x) * 0.9, 2, sp * 2.2); this.emit({ t: "jump" }); } }
      else if (b.state === "air") { b.vy -= GRAV * 0.9 * dt; if (b.y <= floor && b.vy < 0) { b.y = floor; b.vy = 0; b.vx = 0; b.state = "go"; b.t = 0; this.emit({ t: "crusher" }); if (this.ground && Math.abs(this.x - b.x) < 5) this.hurt("shockwave"); fire(-5, 6, 14); fire(5, 6, 14); fire(-3, 9, 14); fire(3, 9, 14); } }
    } else if (pattern === "fly") {
      if (b.state === "go") { const tx = (lo + hi) / 2 + Math.sin(b.t * 0.9) * (hi - lo) / 2.2; b.vx = (tx - b.x) * 2; b.vy = (floor + 4.2 + Math.sin(b.t * 2) * 0.6 - b.y) * 3; b.dir = toward; if (b.shotT <= 0) { b.shotT = 1.2 - (1 - b.hp / b.max) * 0.5; for (let i = -1; i <= 1; i++) this.shootAt("dust", b.x, b.y, 6.5, i * 0.25); } if (b.t > 4.5) { b.state = "swoop"; b.t = 0; this.emit({ t: "bossRoar" }); } }
      else if (b.state === "swoop") { b.vx = (this.x - b.x) * 2.2; b.vy = (floor + 0.2 - b.y) * 4; if (b.t > 1.5) { b.state = "rest"; b.t = 0; } }
      else if (b.state === "rest") { b.vx = 0; b.vy = 0; if (b.t > 1.2) { b.state = "go"; b.t = 0; } }
    } else if (pattern === "burrow") {
      if (b.state === "go") { b.under = true; b.vx = toward * sp * 1.2; if (b.t > 2.2) { b.state = "pop"; b.t = 0; b.under = false; b.vy = 11; this.emit({ t: "bossRoar" }); if (Math.abs(this.x - b.x) < 1.6) this.hurt("burrow"); } }
      else if (b.state === "pop") { b.vx = 0; b.vy -= GRAV * dt; if (b.y <= floor) { b.y = floor; b.vy = 0; } if (b.shotT <= 0) { b.shotT = 0.7; for (let i = -2; i <= 2; i++) this.shootAt("dust", b.x, b.y + b.h * 0.7, 6.5, i * 0.18); } if (b.t > 2.4) { b.state = "go"; b.t = 0; } }
    } else if (pattern === "shoot") {
      if (b.state === "go") { b.dir = toward; b.vx = Math.sin(b.t * 0.8) * sp * 0.6; if (b.shotT <= 0) { b.shotT = 1.1 - (1 - b.hp / b.max) * 0.4; const n = 2 + Math.floor((1 - b.hp / b.max) * 3); for (let i = 0; i < n; i++) fire(toward * (4 + i * 1.5), 6 + i, 14); } if (b.t > 5) { b.state = "hop"; b.t = 0; b.vy = 13; } }
      else if (b.state === "hop") { b.vy -= GRAV * dt; b.vx = toward * sp; if (b.y <= floor && b.vy < 0) { b.y = floor; b.vy = 0; b.state = "go"; b.t = 0; this.emit({ t: "crusher" }); } }
    }
    if (b.state !== "air" && b.state !== "hop" && pattern !== "fly" && b.state !== "pop") { b.vy = 0; b.y = floor; }
    b.x = clamp(b.x + b.vx * dt, lo, hi); b.y += b.vy * dt;
    if (b.y < floor) b.y = floor;
    this.bossContact(b);
  }
  /** touching the boss: a stomp from above hurts it, anything else hurts Puddo */
  bossContact(b: Boss, stompable = true) {
    const hw = MOMO_W / 2;
    if (b.under || b.down) return;
    if (!overlap(this.x - hw, this.y, this.x + hw, this.y + this.bodyH, b.x - b.w / 2 + 0.15, b.y, b.x + b.w / 2 - 0.15, b.y + b.h)) return;
    const fromAbove = this.vy < -1 && this.y > b.y + b.h * 0.55;
    if (fromAbove && stompable && BOSS[b.kind].shape !== "spiky") { this.vy = 14; this.bounced = true; this.hitBoss(this.stomping ? 10 : 6); this.stomping = false; }
    else this.hurt("boss");
  }

  // ------------------------------------------------------------------ read-outs
  hud(): Hud {
    const b = this.boss, st = this.st;
    let goal: Hud["goal"];
    if (st.goalKind === "pumps") goal = { label: "Pumps", have: this.pumpsDown, need: st.need };
    else if (st.goalKind === "rescue") goal = { label: "Sprouts", have: this.rescued, need: st.need };
    else if (st.goalKind === "keys") goal = { label: "Keys", have: this.keys, need: st.need };
    else if (st.goalKind === "defend" && st.defend) goal = { label: "Well", have: this.wellHp, need: st.defend.hp, time: Math.max(0, st.defend.time - this.defendT) };
    else if (st.goalKind === "waves") { const g = this.gates[0]; goal = { label: "Wave", have: g ? (g.phase === "done" ? st.need : g.phase === "on" ? g.wave + 1 : 0) : 0, need: st.need }; }
    else if (st.goalKind === "vault") goal = { label: "Vault", have: 0, need: 0, time: this.vaultT };
    else if (st.goalKind === "escort" && st.escort) goal = { label: "Cart", have: this.escortHp, need: st.escort.hp };
    else if (st.goalKind === "hunt") goal = { label: "Elites", have: this.huntDown, need: st.need };
    const vertical = st.h > 40;
    const progress = vertical ? (st.goal.y > st.start.y ? (this.y - st.start.y) / (st.goal.y - st.start.y) : (st.start.y - this.y) / Math.max(1, st.start.y - st.goal.y)) : this.x / st.goal.x;
    return {
      hearts: this.hearts, maxHearts: this.maxHearts, lives: this.lives, coins: Math.floor(this.coins), drops: this.drops.size, friend: this.friend,
      weapon: this.weapon, bombs: this.bombs, maxBombs: this.maxBombs, storm: this.storm, superOn: this.superT > 0, combo: this.comboT > 0 ? this.combo : 0, mult: comboMult(this.combo),
      star: this.star, bossHp: b?.active && !b.down ? b.hp : undefined, bossMax: b?.max, progress: clamp(progress, 0, 1),
      checkpoint: this.cp + 1, time: this.t, dark: !!st.rules.dark, goal,
    };
  }
  result(): SimResult {
    const st = this.st;
    return {
      n: st.n, key: st.key, island: st.island, s: st.s, name: st.name, concept: st.concept, cleared: this.cleared, coins: Math.floor(this.coins), drops: this.drops.size,
      noHit: this.noHit, time: this.t, hits: this.hits, melted: this.melted, bestCombo: this.bestCombo, livesLeft: this.lives,
    };
  }
}
