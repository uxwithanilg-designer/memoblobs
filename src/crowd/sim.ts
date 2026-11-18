// Blob Brigade simulation. Board space: x across (−6.4 … +6.4), z along the board — the brigade stands on the line
// z = 0 and everything else (Grumpies, tiles, gates, jars, bosses) comes down the board towards +z.
// Pure TypeScript: no three.js and no DOM, so it also runs in the par-bot sweep and in headless QA.
import type { BlockKind, BombKind, BossKind, Gate, GrumpKind, Lane, LeaderId, PowerUp, Segment, SimEvent, SimResult, StageSpec } from "./types";
import { GRUMP_HP, GRUMP_SPEED, HALF, RUSH, applyGate, endlessWave, gateGood, gateLabel, rushWave } from "./levels";
import { DEFAULT_LOADOUT, leaderOf, type Loadout } from "./leaders";

export const WALL_END = -4;
export const HOME_Z = -3.4;
export const BUBBLE_SPEED = 30;
/** bubbles pop before they leave the screen, so Grumpies are always cheered up where you can see it */
export const BUBBLE_END = -31;
/** blob value per tier: small, big, giant, mega */
export const TIER_VALUE = [1, 10, 100, 1000];
export const TIER_R = [0.27, 0.45, 0.7, 1.0];
export const BUBBLE_R = [0.16, 0.28, 0.45, 0.65];
export const KINDS: GrumpKind[] = ["grump", "helmet", "speedy", "jelly", "chunky", "spitter", "bouncer", "splitter", "shield", "balloon"];
const KIND_INDEX: Record<GrumpKind, number> = { grump: 0, helmet: 1, speedy: 2, jelly: 3, chunky: 4, spitter: 5, bouncer: 6, splitter: 7, shield: 8, balloon: 9 };
export const GRUMP_R = 0.28;
/** the brigade counter tops out here ("MAX!") */
export const MAX_BRIGADE = 9999;
export const BOSS_R: Record<BossKind, number> = {
  mega: 1.35, jelly: 1.3, kranky: 1.4, cloud: 1.5, balloon: 1.4, spiky: 1.2, chef: 1.3,
  yeti: 1.5, robo: 1.45, boat: 1.6, ghost: 1.3, golem: 1.6, magma: 1.5, ufo: 1.7, mech: 1.8,
};
/** villain walking speed relative to the march */
const BOSS_SPEED: Record<BossKind, number> = {
  mega: 0.7, jelly: 0.8, kranky: 0.75, cloud: 0.55, balloon: 0.55, spiky: 0.65, chef: 0.7,
  yeti: 0.62, robo: 0.6, boat: 0.5, ghost: 0.7, golem: 0.5, magma: 0.6, ufo: 0.5, mech: 0.45,
};

export interface Bomb { id: number; kind: BombKind; x0: number; z0: number; y0: number; x: number; z: number; t: number; dur: number; r: number; dmg: number }

export interface Unit { tier: number; ox: number; oz: number }
export interface Tile { id: number; lane: number; x: number; z: number; v: number; coin: boolean; moving: boolean; pw?: PowerUp }
export interface Zone { id: number; kind: "lava" | "vent"; x: number; w: number; t: number; /** vents: 0 idle, 1 warning, 2 erupting */ state: number }
export interface Boulder { id: number; x: number; z: number; dmg: number }
export interface Blocker { id: number; x: number; z: number; w: number; vx: number; x0: number; x1: number }
export interface Block { id: number; kind: BlockKind; x: number; z: number; hp: number; maxHp: number; r: number; moving: boolean; n: number; coins: number; tiles: number[]; alive: boolean; hitT: number }
export interface GateRow { id: number; z: number; gates: Gate[]; done: boolean; chosen: number }
export interface Boss { kind: BossKind; mini: boolean; x: number; z: number; cx: number; sway: number; hp: number; maxHp: number; r: number; rage: boolean; hitT: number; field: Lane; dmg: number; atkT: number; shieldT: number; roll: number; t: number; entered: boolean;
  /** ghost: 1 while faded; golem: core open; robot: armour on; ufo: tractor beam time left; mech: phase */
  fadeT: number; core: boolean; coreT: number; armor: boolean; pullT: number; phase: number }

/** splits a brigade of n blobs into tiers: up to 19 of a tier before ten of them merge into the next one */
export function decompose(n: number): number[] {
  const c = [Math.max(0, Math.floor(n)), 0, 0, 0];
  for (let t = 0; t < 3; t++) if (c[t] >= 20) { const m = Math.floor((c[t] - 10) / 10); c[t] -= m * 10; c[t + 1] += m; }
  return c;
}

/** a round, packed formation: biggest blobs in the middle, a sunflower spiral around them */
export function formation(c: number[], spread = 1): { units: Unit[]; R: number } {
  const units: Unit[] = [];
  let area = 0, R = 0.35, i = 0;
  for (let t = 3; t >= 0; t--) {
    for (let k = 0; k < c[t]; k++, i++) {
      const r = TIER_R[t];
      const rho = i === 0 ? 0 : Math.sqrt(area / Math.PI) + r * 0.45;
      const a = i * 2.399963;
      const u = { tier: t, ox: Math.cos(a) * rho * spread, oz: Math.sin(a) * rho * 0.88 };
      units.push(u);
      area += Math.PI * (r * 1.06) ** 2;
      R = Math.max(R, rho * spread + r);
    }
  }
  return { units, R };
}

class Horde {
  cap = 0; len = 0; alive = 0;
  x = new Float32Array(0); z = new Float32Array(0); hp = new Float32Array(0); max = new Float32Array(0);
  kind = new Uint8Array(0); on = new Uint8Array(0); /** 0 = none, else POWER_LIST index + 1 */ pw = new Uint8Array(0); lane = new Int8Array(0); phase = new Float32Array(0); hitT = new Float32Array(0); cd = new Float32Array(0); slow = new Float32Array(0);
  grow(need: number) {
    if (need <= this.cap) return;
    const cap = Math.max(need, this.cap * 2, 256);
    const f = (a: Float32Array) => { const b = new Float32Array(cap); b.set(a.subarray(0, this.len)); return b; };
    const u = (a: Uint8Array) => { const b = new Uint8Array(cap); b.set(a.subarray(0, this.len)); return b; };
    this.x = f(this.x); this.z = f(this.z); this.hp = f(this.hp); this.max = f(this.max); this.phase = f(this.phase); this.hitT = f(this.hitT); this.cd = f(this.cd); this.slow = f(this.slow);
    this.kind = u(this.kind); this.on = u(this.on); this.pw = u(this.pw);
    const l = new Int8Array(cap); l.set(this.lane.subarray(0, this.len)); this.lane = l;
    this.cap = cap;
  }
  /** drop dead Grumpies (only between waves, so indices stay stable while things fly) */
  compact() {
    let w = 0;
    for (let i = 0; i < this.len; i++) {
      if (!this.on[i]) continue;
      if (w !== i) {
        this.x[w] = this.x[i]; this.z[w] = this.z[i]; this.hp[w] = this.hp[i]; this.max[w] = this.max[i]; this.kind[w] = this.kind[i];
        this.on[w] = 1; this.pw[w] = this.pw[i]; this.lane[w] = this.lane[i]; this.phase[w] = this.phase[i]; this.hitT[w] = this.hitT[i]; this.cd[w] = this.cd[i]; this.slow[w] = this.slow[i];
      }
      w++;
    }
    this.len = w;
  }
  add(x: number, z: number, kind: GrumpKind, lane: number, phase: number, hpOverride?: number, pw = 0) {
    this.grow(this.len + 1);
    const i = this.len++;
    const hp = hpOverride ?? GRUMP_HP[kind];
    this.x[i] = x; this.z[i] = z; this.hp[i] = hp; this.max[i] = hp; this.kind[i] = KIND_INDEX[kind]; this.on[i] = 1; this.lane[i] = lane; this.phase[i] = phase; this.hitT[i] = 0; this.cd[i] = kind === "shield" ? 6 : 1.5 + Math.random() * 3; this.slow[i] = 0; this.pw[i] = pw;
    this.alive++;
  }
}

class Bubbles {
  cap = 900; len = 0;
  x = new Float32Array(this.cap); z = new Float32Array(this.cap); dmg = new Float32Array(this.cap); tier = new Uint8Array(this.cap); on = new Uint8Array(this.cap);
  /** sideways speed (Triple Shot fans out) */
  vx = new Float32Array(this.cap);
  add(x: number, z: number, tier: number, mul = 1, vx = 0) {
    // reuse a free slot near the end; the pool is big enough that dropping a shot on overflow is invisible
    let i = this.len < this.cap ? this.len++ : -1;
    if (i < 0) { for (let k = 0; k < this.cap; k++) if (!this.on[k]) { i = k; break; } }
    if (i < 0) return;
    this.x[i] = x; this.z[i] = z; this.dmg[i] = TIER_VALUE[tier] * mul; this.tier[i] = tier; this.on[i] = 1; this.vx[i] = vx;
  }
  trim() { while (this.len > 0 && !this.on[this.len - 1]) this.len--; }
}

/** every power-up, in a fixed order (Grumpy carriers store an index) */
export const POWER_LIST: PowerUp[] = ["beam", "freeze", "magnet", "bomb", "wall", "double", "triple", "rapid", "mega"];

const NB = 30, BW = 0.5;
const bucketOf = (x: number) => Math.max(0, Math.min(NB - 1, Math.floor((x + 7.5) / BW)));

/** how hard the adaptive difficulty leans on a bigger-than-expected brigade (0 = off, 1 = fully flat) */
export let ADAPT_EXP = 0.85;
export const setAdaptExp = (v: number) => { ADAPT_EXP = v; };
/** the share of the offered blobs a good player is expected to hold (tiles, jars, cages) */
export let EXPECT_SHARE = 0.7;
export const setExpectShare = (v: number) => { EXPECT_SHARE = v; };
export interface SimOptions { fireRate?: number; bot?: boolean; /** 0 = a careless kid … 1 = the perfect par bot */ skill?: number; loadout?: Loadout; /** play like a person who grabs every tile (balance sweeps) */ greedy?: boolean; /** balance sweeps only: every blob tile / cage is worth this much more to this player */ collectMul?: number }

export class Sim {
  spec: StageSpec;
  lanes: Lane[];
  walls: [number, number][] = [];
  fields: number[];
  t = 0;
  phase: "play" | "won" | "lost" = "play";
  events: SimEvent[] = [];
  // brigade
  bx = 0; tx = 0; n: number; peak: number; R = 0.35;
  tiers = [1, 0, 0, 0];
  units: Unit[] = [];
  private fireT: number[] = [];
  fireRate: number;
  // world
  horde = new Horde();
  bubbles = new Bubbles();
  tiles: Tile[] = [];
  blocks: Block[] = [];
  gates: GateRow[] = [];
  boss: Boss | null = null;
  bombs: Bomb[] = [];
  /** blobs a Spitter's goo ball takes */
  spit = 2;
  speed: number;
  bot: boolean;
  skill: number;
  private botT = 0;
  greedy = false;
  /** the brigade a good player would have right now: grows with every blob offered and every gate passed */
  ex = 1;
  private biteAcc = 0;
  private collectMul = 1;
  private botAim = 0;
  wave = 1;
  private ids = 1;
  private head = new Int32Array(NB);
  private next = new Int32Array(0);
  private coinAcc = 0;
  // leader + upgrades
  leader: LeaderId;
  dmgMul = 1; bubbleRMul = 1; moveSpeed = 16;
  /** adaptive difficulty: >1 when the brigade is bigger than the stage expects (bubbles hit the march softer) */
  adaptK = 1; spread = 1; tileReach = 0; gateMul = 1; coinMul = 1; bombSlow = 1;
  /** the POWER button fills 0 → 1 */
  power = 0; powerRate = 1 / 15;
  freezeT = 0; slowT = 0; guardT = 0; beamT = 0; fireBoostT = 0; magnetT = 0; wallT = 0; chillT = 0;
  /** bubble powers: three bubbles per shot / bigger, harder bubbles */
  tripleT = 0; megaT = 0;
  /** bubble size right now (Daily giant bubbles, Mega Bubbles) */
  get bubbleR() { return this.bubbleRMul * (this.megaT > 0 ? 1.45 : 1); }
  private gloopT = 4; private cakeT = 5;
  // world mechanics
  vx = 0;
  zones: Zone[] = [];
  boulders: Boulder[] = [];
  blockers: Blocker[] = [];
  surf = 0; surfT = 99; private boulderT = 99; private meteorT = 99; private burnAcc = 0;
  stats = { pops: 0, popHp: 0, coins: 0, jars: 0, jarsTotal: 0, cages: 0, cagesTotal: 0, pinatas: 0, pinatasTotal: 0, recruits: 0, lost: 0, gates: 0, bosses: 0 };

  constructor(spec: StageSpec, o: SimOptions = {}) {
    this.spec = spec;
    this.lanes = spec.lanes;
    for (let i = 0; i + 1 < spec.lanes.length; i++) this.walls.push([spec.lanes[i].x1, spec.lanes[i + 1].x0]);
    this.fields = spec.lanes.map((l, i) => (l.kind === "field" ? i : -1)).filter((i) => i >= 0);
    const lo = o.loadout ?? DEFAULT_LOADOUT, up = lo.up, L = lo.leader;
    this.leader = L;
    this.fireRate = (o.fireRate ?? 1.8) * (1 + 0.04 * up.fire) * (L === "bolt" ? 1.25 : 1);
    this.dmgMul = (1 + 0.06 * up.power) * (L === "momo" ? 1.1 : 1);
    this.moveSpeed = L === "turbo" ? 32 : 16;
    this.spread = L === "noodle" ? 1.5 : 1;
    this.tileReach = L === "zib" ? 1.3 : 0;
    this.gateMul = L === "tiki" ? 1.5 : 1;
    this.coinMul = (1 + 0.08 * up.coins) * (L === "kranky" ? 2 : 1);
    this.bombSlow = L === "hoot" ? 1.3 : 1;
    this.powerRate = (1 / leaderOf(L).charge) * (1 + 0.06 * up.charge);
    this.n = spec.start + 2 * up.start + (L === "gloop" ? 3 : 0); this.peak = this.n; this.ex = this.n;
    this.collectMul = o.collectMul ?? 1;
    // Daily Challenge twists
    const mods = spec.mods ?? [];
    if (mods.includes("giant")) { this.bubbleRMul = 1.6; this.dmgMul *= 1.2; }
    if (mods.includes("tiny")) this.fireRate *= 1.3;
    if (mods.includes("coins")) this.coinMul *= 2;
    this.bot = !!o.bot;
    this.skill = o.skill ?? 1;
    this.greedy = !!o.greedy;
    this.speed = spec.segment.speed;
    this.load(spec.segment);
    this.relayout();
    const m = spec.mech ?? {};
    const f = this.lanes[this.fields[0]];
    for (let k = 0; k < (m.blockers ?? 0); k++) {
      const w = 1.1, x0 = f.x0 + w / 2, x1 = f.x1 - w / 2;
      this.blockers.push({ id: this.ids++, x: x0 + Math.random() * (x1 - x0), z: -14 - k * 8, w, vx: (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 0.8), x0, x1 });
    }
    const nv = m.vents ?? 0;
    for (let k = 0; k < nv; k++) this.zones.push({ id: this.ids++, kind: "vent", x: -HALF + 1.4 + (k + 0.5) * ((2 * HALF - 2.8) / nv), w: 1.7, t: 1.5 + Math.random() * 3, state: 0 });
    if (m.waves) this.surfT = m.waves;
    if (m.boulders) this.boulderT = m.boulders * 0.7;
    if (m.meteors) this.meteorT = m.meteors;
  }

  // ---------------------------------------------------------------- loading
  private load(seg: Segment) {
    this.speed = seg.speed;
    this.spit = seg.spit ?? 2;
    for (const g of seg.horde) {
      const lane = this.laneAt(g.x);
      this.horde.add(g.x, g.z, g.kind, lane, Math.random() * 6.28, g.hp, g.pw ? POWER_LIST.indexOf(g.pw) + 1 : 0);
    }
    const tileIds = new Map<number, number[]>();
    for (const t of seg.tiles) this.tiles.push({ id: this.ids++, lane: t.lane, x: this.laneMid(t.lane), z: t.z, v: t.v, coin: !!t.coin, moving: true, pw: t.pw });
    for (const j of seg.jars) {
      const ids: number[] = [];
      j.tiles.forEach((v, k) => { const id = this.ids++; ids.push(id); this.tiles.push({ id, lane: j.lane, x: this.laneMid(j.lane), z: j.z - 2.4 - k * 1.35, v, coin: false, moving: false }); });
      const id = this.ids++; tileIds.set(id, ids);
      this.blocks.push({ id, kind: "jar", x: this.laneMid(j.lane), z: j.z, hp: j.hp, maxHp: j.hp, r: 0.95, moving: false, n: 0, coins: j.coins, tiles: ids, alive: true, hitT: 0 });
      this.stats.jarsTotal++;
    }
    for (const c of seg.cages) { this.blocks.push({ id: this.ids++, kind: "cage", x: c.x, z: c.z, hp: c.hp, maxHp: c.hp, r: 0.62, moving: true, n: c.n, coins: 3, tiles: [], alive: true, hitT: 0 }); this.stats.cagesTotal++; }
    for (const p of seg.pinatas) { this.blocks.push({ id: this.ids++, kind: "pinata", x: p.x, z: p.z, hp: p.hp, maxHp: p.hp, r: 0.6, moving: true, n: 0, coins: p.coins, tiles: [], alive: true, hitT: 0 }); this.stats.pinatasTotal++; }
    for (const g of seg.gates) this.gates.push({ id: this.ids++, z: g.z, gates: g.gates, done: false, chosen: -1 });
    if (seg.boss) {
      const f = this.lanes[this.fields[0]], r = BOSS_R[seg.boss.kind] * (seg.boss.mini ? 0.78 : 1);
      const cx = (f.x0 + f.x1) / 2;
      this.boss = {
        kind: seg.boss.kind, mini: !!seg.boss.mini, x: cx, z: seg.boss.z, cx, sway: Math.max(0, (f.x1 - f.x0) / 2 - r - 0.2), hp: seg.boss.hp, maxHp: seg.boss.hp,
        r, rage: false, hitT: 0, field: f, dmg: seg.boss.dmg ?? 3, atkT: 1.2, shieldT: 0, roll: 0, t: 0, entered: false,
        fadeT: 0, core: false, coreT: 3, armor: seg.boss.kind === "robo", pullT: 0, phase: 1,
      };
    }
  }
  laneAt(x: number) { for (let i = 0; i < this.lanes.length; i++) if (x >= this.lanes[i].x0 - 0.05 && x <= this.lanes[i].x1 + 0.05) return i; return this.fields[0] ?? 0; }
  laneMid(i: number) { const l = this.lanes[i]; return (l.x0 + l.x1) / 2; }

  // ---------------------------------------------------------------- brigade
  private relayout() {
    const c = decompose(this.n);
    for (let t = 1; t < 4; t++) if (c[t] > this.tiers[t]) { this.events.push({ t: "merge", tier: t }); break; }
    this.tiers = c;
    const f = formation(c, this.spread);
    this.units = f.units; this.R = f.R;
    while (this.fireT.length < this.units.length) this.fireT.push(Math.random() / this.fireRate);
    this.fireT.length = this.units.length;
  }
  private setCount(v: number) {
    const before = this.n;
    this.n = Math.max(0, Math.min(MAX_BRIGADE, Math.round(v)));
    if (this.n > this.peak) this.peak = this.n;
    if (this.n !== before) this.relayout();
  }

  // ---------------------------------------------------------------- step
  step(dt: number) {
    if (this.phase !== "play") return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const dec = (v: number) => (v > 0 ? Math.max(0, v - dt) : 0);
    this.freezeT = dec(this.freezeT); this.slowT = dec(this.slowT); this.guardT = dec(this.guardT); this.beamT = dec(this.beamT);
    this.fireBoostT = dec(this.fireBoostT); this.magnetT = dec(this.magnetT); this.wallT = dec(this.wallT); this.chillT = dec(this.chillT);
    this.tripleT = dec(this.tripleT); this.megaT = dec(this.megaT);
    this.power = Math.min(1, this.power + dt * this.powerRate);
    if (this.bot && this.power >= 1 && (this.horde.alive > 15 || (this.boss && this.boss.entered)) && Math.random() < dt * (1 + this.skill * 8)) this.usePower();
    if (this.bot) {
      // a less skilled bot reacts late and aims roughly — like a real kid on a phone
      this.botT -= dt;
      if (this.botT <= 0) {
        const k = 1 - this.skill;
        this.botT = 0.05 + 0.6 * k * (0.6 + Math.random() * 0.8);
        this.botAim = this.botTarget() + (Math.random() - 0.5) * 2.2 * k;
      }
      this.tx = this.botAim;
    }
    const lim = HALF - 0.6;
    this.tx = Math.max(-lim, Math.min(lim, this.tx));
    const ms = this.moveSpeed * (this.chillT > 0 ? 0.5 : 1);
    if (this.spec.mech?.ice) {
      // on ice the brigade builds up speed slowly and keeps sliding
      const want = Math.max(-ms, Math.min(ms, (this.tx - this.bx) * 5));
      this.vx += (want - this.vx) * Math.min(1, dt * 2.2);
      this.bx = Math.max(-lim, Math.min(lim, this.bx + this.vx * dt));
    } else {
      const d = this.tx - this.bx, mv = ms * dt;
      this.bx += Math.abs(d) < mv ? d : Math.sign(d) * mv;
    }
    // Pip's freeze stops the march; Prof. Hoot's slow-mo slows it
    const ts = this.freezeT > 0 ? 0 : this.slowT > 0 ? 0.4 : 1;
    // adaptive difficulty: a bigger-than-expected brigade fights harder grumps; in the first worlds a smaller-than-expected
    // one gets a quiet helping hand (grumps bite less, bubbles hit harder)
    const floor = (this.spec.world ?? 9) <= 1 ? 0.7 : (this.spec.world ?? 9) === 2 ? 0.85 : 1;
    this.adaptK = this.spec.expect ? Math.min(4, Math.max(floor, (this.n / Math.max(12, this.ex)) ** ADAPT_EXP)) : 1;
    this.fire(dt);
    this.stepHorde(dt * ts);
    this.stepBubbles(dt);
    this.stepTiles(dt);
    this.stepBlocks(dt * ts);
    this.stepGates(dt);
    this.stepBoss(dt * ts);
    this.stepBombs(dt * (this.slowT > 0 ? 0.4 : 1));
    this.stepMechanics(dt);
    this.checkEnd();
  }

  private fire(dt: number) {
    const per = 1 / (this.fireRate * (this.fireBoostT > 0 ? 2.5 : 1));
    for (let i = 0; i < this.units.length; i++) {
      this.fireT[i] -= dt;
      if (this.fireT[i] > 0) continue;
      this.fireT[i] += per * (0.85 + Math.random() * 0.3);
      const u = this.units[i], bx = this.bx + u.ox + (Math.random() - 0.5) * 0.08, bz = u.oz - TIER_R[u.tier] * 0.6;
      const mul = this.dmgMul * (this.megaT > 0 ? 1.6 : 1);
      this.bubbles.add(bx, bz, u.tier, mul);
      if (this.tripleT > 0) { this.bubbles.add(bx - 0.1, bz, u.tier, mul, -3.2); this.bubbles.add(bx + 0.1, bz, u.tier, mul, 3.2); }
    }
  }

  private stepHorde(dt: number) {
    const h = this.horde, sp = this.speed, front = -this.R * 0.85 - 0.22;
    let lost = 0, hx = 0, hz = 0, hits = 0;
    for (let i = 0; i < h.len; i++) {
      if (!h.on[i]) continue;
      const k = KINDS[h.kind[i]];
      // paratroopers float down first (hitT < 0 while falling)
      if (h.hitT[i] < 0) { h.hitT[i] = Math.min(0, h.hitT[i] + dt); continue; }
      let v = sp * GRUMP_SPEED[k] * (h.slow[i] > 0 ? 0.55 : 1);
      if (h.slow[i] > 0) h.slow[i] -= dt;
      // bouncers stand still, then hop forward
      if (h.kind[i] === 6) v = (this.t + h.phase[i]) % 1.6 < 0.4 ? sp * 3.6 : 0;
      let z = h.z[i] + v * dt;
      let x = h.x[i];
      if (this.wallT > 0 && h.z[i] <= -4.6 && z > -4.6) z = -4.6;
      if (h.hitT[i] > 0) h.hitT[i] -= dt;
      if (h.kind[i] === 5) {
        h.cd[i] -= dt;
        if (h.cd[i] <= 0 && z > -24 && z < -4 && this.bombs.length < 4) {
          h.cd[i] = 4 + Math.random() * 2.5;
          this.throwBomb("goo", x, z, 0.9, this.spit, 0.9, 1.25);
        }
      }
      if (z < WALL_END + 0.4) {
        const l = this.lanes[h.lane[i]];
        if (l) x = Math.max(l.x0 + 0.26, Math.min(l.x1 - 0.26, x));
      } else if (z > HOME_Z) {
        // out of the field mouth: everybody heads for the brigade
        const dx = this.bx - x, m = (4.2 + GRUMP_SPEED[k]) * dt;
        x += Math.abs(dx) < m ? dx : Math.sign(dx) * m;
        if (z > 0.25) z = 0.25;
      }
      h.x[i] = x; h.z[i] = z;
      if (z >= front && Math.abs(x - this.bx) <= this.R + 0.3) {
        if (this.guardT > 0) { this.popGrump(i, false); continue; }
        // a bigger-than-expected brigade also takes bigger bites (adaptK), so a huge crowd still has to fight
        lost += h.hp[i] * this.adaptK; hx += x; hz += z; hits++;
        h.on[i] = 0; h.alive--;
      }
    }
    if (hits) {
      // weak Grumpies take fractions of a blob: keep the remainder for the next bite
      this.biteAcc += lost;
      const bite = Math.floor(this.biteAcc);
      this.biteAcc -= bite;
      this.stats.lost += bite;
      this.events.push({ t: "hit", x: hx / hits, z: hz / hits, n: bite });
      this.setCount(this.n - bite);
      if (this.n <= 0) this.lose();
    }
    // spatial buckets for the bubbles
    if (this.next.length < h.cap) this.next = new Int32Array(h.cap);
    this.head.fill(-1);
    for (let i = 0; i < h.len; i++) {
      if (!h.on[i] || h.z[i] < BUBBLE_END - 1) continue;
      const b = bucketOf(h.x[i]);
      this.next[i] = this.head[b]; this.head[b] = i;
    }
  }

  private stepBubbles(dt: number) {
    const B = this.bubbles, h = this.horde, wallZ = WALL_END;
    for (let i = 0; i < B.len; i++) {
      if (!B.on[i]) continue;
      const z0 = B.z[i], z1 = z0 - BUBBLE_SPEED * dt, x = B.x[i] + B.vx[i] * dt, r = BUBBLE_R[B.tier[i]] * this.bubbleR;
      B.x[i] = x;
      B.z[i] = z1;
      if (z1 < BUBBLE_END) { B.on[i] = 0; continue; }
      // walls between lanes swallow bubbles
      if (z1 < wallZ) {
        let wall = false;
        for (const [a, b] of this.walls) if (x > a - r * 0.4 && x < b + r * 0.4) { wall = true; break; }
        if (wall) { B.on[i] = 0; continue; }
      }
      let limit = z0 + 0.3, guard = 0;
      while (B.on[i] && guard++ < 8) {
        // nearest thing along the path: a Grumpy, a block or the boss
        let best = -1, bestZ = -1e9, what = 0;
        const b0 = bucketOf(x - r - GRUMP_R), b1 = bucketOf(x + r + GRUMP_R);
        for (let b = b0; b <= b1; b++) {
          for (let g = this.head[b]; g >= 0; g = this.next[g]) {
            if (!h.on[g]) continue;
            const gz = h.z[g];
            if (gz > limit || gz < z1 - 0.3 || gz <= bestZ) continue;
            if (Math.abs(h.x[g] - x) > r + GRUMP_R) continue;
            best = g; bestZ = gz; what = 1;
          }
        }
        for (let k = 0; k < this.blocks.length; k++) {
          const o = this.blocks[k];
          if (!o.alive || o.z > limit || o.z < z1 - o.r || o.z <= bestZ) continue;
          if (Math.abs(o.x - x) > r + o.r) continue;
          best = k; bestZ = o.z; what = 2;
        }
        for (const bk of this.blockers) if (bk.z <= limit && bk.z >= z1 - 0.4 && bk.z > bestZ && Math.abs(bk.x - x) < bk.w / 2 + r) { best = 0; bestZ = bk.z; what = 4; }
        const s = this.boss;
        if (s && !(s.kind === "ghost" && s.fadeT > 0) && s.z <= limit && s.z >= z1 - s.r && s.z > bestZ && Math.abs(s.x - x) <= r + s.r * 0.9) { best = 0; bestZ = s.z; what = 3; }
        if (best < 0) break;
        limit = bestZ - 0.001;
        if (what === 4) { B.dmg[i] = 0; B.on[i] = 0; break; }
        if (what === 1 && h.kind[best] === 8 && h.cd[best] > 0) {
          // a Shield Grumpy's board soaks small bubbles; a big bubble smashes it
          if (B.tier[i] >= 1) h.cd[best] = 0;
          else { h.cd[best] -= B.dmg[i] / this.adaptK; B.dmg[i] = 0; h.hitT[best] = 0.1; if (this.leader === "pip") h.slow[best] = 1.2; B.on[i] = 0; break; }
        }
        if (what === 1) {
          if (this.leader === "pip") h.slow[best] = 1.2;
          const a = this.adaptK, dealt = Math.min(B.dmg[i] / a, h.hp[best]);
          h.hp[best] -= dealt; B.dmg[i] -= dealt * a;
          if (h.hp[best] <= 0.001) this.popGrump(best, B.tier[i] > 0);
          else { h.hitT[best] = 0.18; h.z[best] -= 0.06; }
        } else if (what === 2) {
          const o = this.blocks[best], dealt = Math.min(B.dmg[i], o.hp);
          o.hp -= dealt; B.dmg[i] -= dealt; o.hitT = 0.12;
          this.events.push({ t: "blockHit", id: o.id, kind: o.kind });
          if (o.hp <= 0.001) this.breakBlock(o);
          else B.dmg[i] = 0; // blocks soak the whole bubble
        } else if (s) {
          const mul = this.bossMul(s) / this.adaptK;
          if (mul <= 0) { B.dmg[i] = 0; s.hitT = 0.05; }
          else {
            const dealt = Math.min(B.dmg[i] * mul, s.hp);
            s.hp -= dealt; s.hitT = 0.12; B.dmg[i] = 0;
            this.events.push({ t: "bossHit" });
            if (s.hp <= 0.001) this.bossDown();
          }
        }
        if (B.dmg[i] <= 0.001) B.on[i] = 0;
      }
    }
    B.trim();
  }

  private popGrump(i: number, big: boolean) {
    const h = this.horde;
    h.on[i] = 0; h.alive--;
    this.stats.pops++; this.stats.popHp += h.max[i];
    this.coinAcc += 0.25 * h.max[i];
    if (this.coinAcc >= 1) { const c = Math.floor(this.coinAcc); this.coinAcc -= c; this.stats.coins += c; }
    this.events.push({ t: "pop", x: h.x[i], z: h.z[i], kind: KINDS[h.kind[i]], big });
    if (h.pw[i]) { const pw = POWER_LIST[h.pw[i] - 1]; h.pw[i] = 0; this.applyPower(pw, h.x[i], h.z[i]); }
    if (h.kind[i] === 7) for (const o of [-0.28, 0.28]) this.horde.add(h.x[i] + o, h.z[i] + 0.2, "grump", h.lane[i], Math.random() * 6.28);
    if (h.kind[i] === 9) { this.ex += (2 * this.ex) / Math.max(1, this.n); this.stats.recruits += 2; this.setCount(this.n + 2); this.events.push({ t: "recruit", x: h.x[i], z: h.z[i], n: 2 }); }
  }

  private stepTiles(dt: number) {
    const v = this.spec.tileSpeed;
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i];
      if (!t.moving) continue;
      t.z += v * dt;
      if (t.z >= -0.75 && t.z <= 1.1) {
        const l = this.lanes[t.lane], reach = this.R * 0.55 + this.tileReach;
        if ((this.bx >= l.x0 - reach && this.bx <= l.x1 + reach) || (this.magnetT > 0 && t.v > 0)) {
          if (t.pw) this.applyPower(t.pw, t.x, t.z);
          else if (t.coin) this.stats.coins += t.v;
          else if (t.v < 0) { this.stats.lost += -t.v; this.setCount(Math.max(1, this.n + t.v)); }
          else { const v = Math.round(t.v * this.collectMul); this.ex += t.v * EXPECT_SHARE; this.stats.recruits += v; this.setCount(this.n + v); }
          if (!t.pw) this.events.push({ t: "recruit", x: t.x, z: t.z, n: t.v, coin: t.coin });
          this.tiles.splice(i, 1);
          continue;
        }
      }
      if (t.z > 2) { if (t.v > 0 && !t.coin && !t.pw) this.ex += t.v * EXPECT_SHARE; this.tiles.splice(i, 1); }
    }
  }

  private breakBlock(o: Block) {
    o.alive = false; o.hp = 0;
    this.stats.coins += o.coins;
    if (o.kind === "jar") { this.stats.jars++; for (const t of this.tiles) if (o.tiles.includes(t.id)) t.moving = true; }
    if (o.kind === "cage") { const v = Math.round(o.n * this.collectMul); this.ex += o.n * EXPECT_SHARE; this.stats.cages++; this.stats.recruits += v; this.setCount(this.n + v); }
    if (o.kind === "pinata") this.stats.pinatas++;
    this.events.push({ t: "blockBreak", id: o.id, kind: o.kind, x: o.x, z: o.z, n: o.n, coins: o.coins });
  }

  private stepBlocks(dt: number) {
    for (const o of this.blocks) {
      if (o.hitT > 0) o.hitT -= dt;
      if (!o.alive || !o.moving) continue;
      o.z += this.speed * dt;
      if (o.z > -o.r - 0.4) { o.alive = false; this.events.push({ t: "blockLost", id: o.id, kind: o.kind }); }
    }
  }

  private stepGates(dt: number) {
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.z += this.spec.gateSpeed * dt;
      if (!g.done && g.z >= 0) {
        g.done = true;
        const w = (2 * HALF) / g.gates.length;
        const idx = Math.max(0, Math.min(g.gates.length - 1, Math.floor((this.bx + HALF) / w)));
        g.chosen = idx;
        const gate = g.gates[idx], before = this.n;
        let after = applyGate(this.n, gate);
        if (this.gateMul !== 1 && after > before) after = before + Math.round((after - before) * this.gateMul);
        const e0 = Math.max(1, Math.round(this.ex));
        this.ex = Math.max(...g.gates.map((x) => { const a = applyGate(e0, x); return a > e0 ? e0 + (a - e0) * this.gateMul : a; }));
        this.stats.gates++;
        if (after > before) this.stats.recruits += after - before;
        this.setCount(after);
        this.events.push({ t: "gate", good: gateGood(gate), label: gateLabel(gate), x: -HALF + w * (idx + 0.5), before, after });
      }
      if (g.z > 4) this.gates.splice(i, 1);
    }
  }

  private stepBoss(dt: number) {
    const s = this.boss;
    if (!s) return;
    s.t += dt;
    if (s.hitT > 0) s.hitT -= dt;
    if (s.shieldT > 0) { s.shieldT -= dt; if (s.shieldT <= 0) this.events.push({ t: "bossShield", on: false }); }
    let mul = BOSS_SPEED[s.kind];
    if (s.kind === "spiky") {
      // Sir Spikes curls up and rolls forward in bursts
      const rolling = s.t % (s.rage ? 2.4 : 3.2) > (s.rage ? 1.3 : 2.0);
      if (rolling && s.roll <= 0) this.events.push({ t: "bossCharge" });
      s.roll = rolling ? 1 : 0;
      mul = rolling ? 2.0 : 0.45;
    }
    s.z += this.speed * mul * dt;
    if (!s.entered && s.z >= -34) { s.entered = true; this.events.push({ t: "bossIn", kind: s.kind, mini: s.mini }); }
    const freq = s.kind === "kranky" ? 1.5 : s.kind === "cloud" || s.kind === "balloon" ? 0.5 : 0.7;
    s.x = s.cx + Math.sin(s.t * freq) * s.sway;
    if (s.kind === "ghost" || s.kind === "golem") {
      s.coreT -= dt;
      if (s.coreT <= 0) {
        if (s.kind === "ghost") {
          if (s.fadeT > 0) { s.fadeT = 0; s.coreT = 3; s.cx = (s.field.x0 + s.field.x1) / 2 + (Math.random() - 0.5) * s.sway * 2; this.events.push({ t: "bossFade", on: false }); }
          else { s.fadeT = 1; s.coreT = 1.6; this.events.push({ t: "bossFade", on: true }); }
        } else { s.core = !s.core; s.coreT = s.core ? 1.8 : 3.2; this.events.push({ t: "bossCore", open: s.core }); }
      }
    }
    if (s.kind === "robo" && s.armor && s.hp < s.maxHp * 0.5) { s.armor = false; this.events.push({ t: "bossArmor" }); }
    if (s.pullT > 0) {
      s.pullT -= dt;
      const d = s.x - this.bx;
      this.bx += Math.sign(d) * Math.min(Math.abs(d), 2.8 * dt); this.tx = this.bot ? this.tx : this.tx + Math.sign(d) * Math.min(Math.abs(d), 2.8 * dt);
      if (s.pullT <= 0) this.events.push({ t: "bossBeam", on: false });
    }
    if (s.entered && s.z > -30) { s.atkT -= dt; if (s.atkT <= 0) this.bossAttack(s); }
    if (!s.rage && s.hp < s.maxHp * 0.5) { s.rage = true; this.events.push({ t: "bossRage", kind: s.kind }); this.bossRage(s); }
    if (s.z >= -this.R * 0.85 - s.r * 0.7) {
      const dmg = Math.ceil(s.hp * this.adaptK);
      this.events.push({ t: "bossSmash", n: dmg });
      this.boss = null;
      this.stats.lost += dmg;
      this.setCount(this.n - dmg);
      if (this.n <= 0) this.lose();
    }
  }

  /** each villain has its own attack; enraged villains attack faster */
  private bossAttack(s: Boss) {
    const k = s.rage ? 0.7 : 1, y = s.kind === "cloud" ? 4.4 : s.kind === "balloon" ? 4.8 : 2.2;
    switch (s.kind) {
      case "mega":
        if (s.rage) this.throwBomb("goo", s.x, s.z, y, s.dmg, 1.25, 1.3);
        s.atkT = 3.6 * k; break;
      case "jelly":
        this.throwBomb("goo", s.x, s.z, y, s.dmg, 1.0, 1.2);
        s.atkT = 4.2 * k; break;
      case "kranky":
        this.throwBomb("goo", s.x, s.z, y, s.dmg, 0.95, 1.2, -1.2);
        this.throwBomb("goo", s.x, s.z, y, s.dmg, 0.95, 1.4, 1.2);
        // the claw shield comes up every other volley (every third once he is angry) and only briefly
        if (Math.floor(s.t / 3.4) % (s.rage ? 3 : 2) === 1) { s.shieldT = 1.2; this.events.push({ t: "bossShield", on: true }); }
        s.atkT = 3.4 * k; break;
      case "cloud":
        this.throwBomb("zap", s.x, s.z, y, s.dmg, 1.15, 1.0);
        s.atkT = 2.5 * k; break;
      case "balloon":
        this.dropTroopers(s, s.rage ? 7 : 5);
        s.atkT = 4.2 * k; break;
      case "spiky":
        if (s.rage) for (const o of [-1.6, 0, 1.6]) this.throwBomb("goo", s.x, s.z, 1.2, Math.max(1, Math.round(s.dmg * 0.6)), 0.8, 1.0, o);
        s.atkT = 3.4; break;
      case "chef":
        this.throwBomb("cake", s.x, s.z, y, s.dmg, 1.35, 1.35);
        s.atkT = 3.0 * k; break;
      case "yeti":
        if (s.rage) for (const o of [-1.7, 0, 1.7]) this.throwBomb("snow", s.x, s.z, 2.6, s.dmg, 1.15, 1.3, o);
        else this.throwBomb("snow", s.x, s.z, 2.6, s.dmg, 1.35, 1.3);
        s.atkT = s.rage ? 2.6 : 3.0; break;
      case "robo":
        this.throwBomb("zap", s.x, s.z, 2.6, s.dmg, 1.0, 0.95, s.rage ? -1.2 : 0);
        if (s.rage) this.throwBomb("zap", s.x, s.z, 2.6, s.dmg, 1.0, 1.1, 1.2);
        s.atkT = s.rage ? 1.9 : 2.3; break;
      case "boat":
        for (const o of [-1.8, 0, 1.8]) this.throwBomb("cannon", s.x, s.z, 2.2, s.dmg, 0.95, 1.3 + Math.abs(o) * 0.08, o);
        s.atkT = 4.2 * k; break;
      case "ghost":
        if (s.fadeT <= 0) this.throwBomb("goo", s.x, s.z, 2.4, s.dmg, 1.0, 1.2);
        s.atkT = 3.2 * k; break;
      case "golem":
        this.spawnBoulder(this.bx, s.z + s.r + 1);
        s.atkT = 4.5 * k; break;
      case "magma":
        this.throwBomb("lava", s.x, s.z, 2.4, s.dmg, 1.2, 1.3, s.rage ? -1.3 : 0);
        if (s.rage) this.throwBomb("lava", s.x, s.z, 2.4, s.dmg, 1.2, 1.45, 1.3);
        s.atkT = 3.4 * k; break;
      case "ufo":
        if (s.pullT <= 0 && Math.floor(s.t / 4) % 2 === 0) { s.pullT = 2.2; this.events.push({ t: "bossBeam", on: true }); }
        else this.throwBomb("zap", s.x, s.z, 4.6, s.dmg, 1.1, 1.0);
        s.atkT = 2.6 * k; break;
      case "mech": {
        const ph = s.hp > s.maxHp * 0.66 ? 1 : s.hp > s.maxHp * 0.33 ? 2 : 3;
        if (ph !== s.phase) { s.phase = ph; this.events.push({ t: "bossPhase", phase: ph }); }
        if (ph === 1) {
          this.throwBomb("goo", s.x, s.z, 2.8, s.dmg, 1.0, 1.2, -1.3); this.throwBomb("goo", s.x, s.z, 2.8, s.dmg, 1.0, 1.4, 1.3);
          if (Math.floor(s.t / 3) % 2 === 1) { s.shieldT = 1.2; this.events.push({ t: "bossShield", on: true }); }
          s.atkT = 3.0;
        } else if (ph === 2) {
          this.throwBomb("zap", s.x, s.z, 2.8, s.dmg, 1.0, 0.95, -1.2); this.throwBomb("zap", s.x, s.z, 2.8, s.dmg, 1.0, 1.05, 1.2);
          s.atkT = 2.0;
        } else {
          this.dropTroopers(s, 6); this.throwBomb("rock", this.bx, -14, 12, s.dmg, 1.2, 1.5);
          s.atkT = 2.6;
        }
        break;
      }
    }
  }
  private bossRage(s: Boss) {
    const f = s.field, cols = Math.floor((f.x1 - f.x0) / 0.5), lane = this.laneAt((f.x0 + f.x1) / 2);
    if (s.kind === "mega") for (let c = 0; c < cols; c++) this.horde.add(f.x0 + (c + 0.5) * ((f.x1 - f.x0) / cols), s.z + s.r + 0.8, "grump", lane, Math.random() * 6.28);
    else if (s.kind === "jelly" || s.kind === "chef") for (let c = 0; c < 5; c++) this.horde.add(f.x0 + 0.6 + c * ((f.x1 - f.x0 - 1.2) / 4), s.z + s.r + 0.6, "jelly", lane, Math.random() * 6.28);
    else if (s.kind === "balloon" || s.kind === "boat" || s.kind === "ufo") this.dropTroopers(s, s.kind === "balloon" ? 8 : 6);
    else s.sway = Math.min(s.sway * 1.4, (f.x1 - f.x0) / 2 - s.r * 0.6);
  }
  private dropTroopers(s: Boss, k: number) {
    const f = s.field, lane = this.laneAt((f.x0 + f.x1) / 2), z = Math.min(-8, s.z + 6);
    for (let i = 0; i < k; i++) {
      this.horde.add(f.x0 + 0.4 + Math.random() * (f.x1 - f.x0 - 0.8), z + (Math.random() - 0.5) * 2, "grump", lane, Math.random() * 6.28);
      this.horde.hitT[this.horde.len - 1] = -0.7 - Math.random() * 0.3;
    }
    this.events.push({ t: "bossDrop", n: k });
  }

  /** a lobbed goo ball / cake / lightning strike aimed where the brigade is now; it lands after `dur` seconds */
  private throwBomb(kind: Bomb["kind"], x0: number, z0: number, y0: number, dmg: number, r: number, dur: number, off = 0) {
    const lim = HALF - 0.8;
    const x = Math.max(-lim, Math.min(lim, this.bx + off + (Math.random() - 0.5) * 0.7));
    this.bombs.push({ id: this.ids++, kind, x0, z0, y0, x, z: -0.2, t: 0, dur, r, dmg });
    this.events.push({ t: "throw", kind, x, z: -0.2 });
  }
  private stepBombs(dt: number) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt / this.bombSlow;
      if (b.t < b.dur) continue;
      this.bombs.splice(i, 1);
      if (b.kind === "lava") this.zones.push({ id: this.ids++, kind: "lava", x: b.x, w: 2.4, t: 4.5, state: 2 });
      const hit = Math.abs(this.bx - b.x) < b.r + this.R * 0.55 && this.guardT <= 0;
      if (hit && b.kind === "snow") { this.chillT = 2; this.events.push({ t: "chill" }); }
      const n = hit ? Math.min(this.n, Math.round(b.dmg * this.adaptK)) : 0;
      this.events.push({ t: "land", kind: b.kind, x: b.x, z: b.z, hit, n });
      if (hit) {
        this.stats.lost += n;
        this.setCount(this.n - n);
        if (this.n <= 0) { this.lose(); return; }
      }
    }
  }

  private bossDown() {
    const s = this.boss;
    if (!s) return;
    this.boss = null;
    this.stats.bosses++;
    this.stats.coins += s.mini ? 10 : 25;
    this.events.push({ t: "bossDown", kind: s.kind, x: s.x, z: s.z });
    if (s.kind === "jelly") {
      // the Jelly King splits into little jellies
      const k = s.mini ? 3 : 5;
      for (let i = 0; i < k; i++) this.horde.add(s.x + (i - (k - 1) / 2) * 0.7, s.z + (i % 2) * 0.5, "jelly", this.laneAt(s.cx), Math.random() * 6.28);
    }
  }

  private lose() { if (this.phase !== "play") return; this.n = 0; this.phase = "lost"; this.events.push({ t: "end", won: false }); }

  private checkEnd() {
    if (this.phase !== "play") return;
    const blocksLeft = this.blocks.some((o) => o.alive && o.moving);
    if (this.horde.alive > 0 || this.boss || blocksLeft) return;
    if (this.spec.endless) {
      this.events.push({ t: "waveClear", k: this.wave });
      this.wave++;
      this.horde.compact();
      this.blocks = this.blocks.filter((o) => o.alive);
      this.load(endlessWave(this.wave, this.spec.seed, this.spec.math, this.lanes, this.n));
      this.events.push({ t: "wave", k: this.wave });
      return;
    }
    if (this.spec.rush && this.wave < RUSH.length) {
      this.events.push({ t: "waveClear", k: this.wave });
      this.wave++;
      this.horde.compact();
      this.blocks = this.blocks.filter((o) => o.alive);
      this.load(rushWave(this.wave, this.spec.seed, this.lanes, Math.round(this.n * this.dmgMul * (this.fireRate / 1.8))));
      this.events.push({ t: "wave", k: this.wave });
      return;
    }
    if (this.spec.rush) this.wave = RUSH.length + 1;
    this.phase = "won";
    this.events.push({ t: "end", won: true });
  }

  /** remaining horde hit points (for the HUD bar) */
  hordeHpLeft(): number {
    const h = this.horde;
    let s = 0;
    for (let i = 0; i < h.len; i++) if (h.on[i]) s += h.hp[i];
    return s + (this.boss ? this.boss.hp : 0);
  }

  // ================================================================ Phase 2: leaders, power-ups and world mechanics
  /** the leader's POWER (the button in the HUD) */
  usePower(): boolean {
    if (this.power < 1 || this.phase !== "play") return false;
    this.power = 0;
    this.events.push({ t: "leaderPower", id: this.leader });
    const h = this.horde, s = this.boss;
    switch (this.leader) {
      case "momo":
        for (let i = 0; i < h.len; i++) if (h.on[i] && h.z[i] > -16) h.z[i] -= 6;
        if (s && s.z > -20) s.z -= 3;
        break;
      case "pip": this.freezeT = 3; break;
      case "gloop": this.grow(Math.max(5, Math.round(this.n / 3))); break;
      case "bolt": this.fireBoostT = 5; break;
      case "bonbon": for (let k = 0; k < 6; k++) this.cakeBomb(1.4, Math.max(6, this.n * 0.25)); break;
      case "hoot": this.slowT = 4; break;
      case "turbo": this.guardT = 3; break;
      case "zib": this.beamT = 3; break;
      case "noodle":
        for (let i = 0; i < h.len; i++) if (h.on[i] && h.z[i] > -7) this.popGrump(i, true);
        if (s && s.z > -9) this.hurtBoss(s, s.maxHp * 0.15, true);
        break;
      case "tiki": this.grow(Math.max(4, Math.round(this.n / 5))); break;
      case "kranky":
        if (s && s.entered) this.hurtBoss(s, s.maxHp * 0.12, true);
        else for (let i = 0; i < h.len; i++) if (h.on[i] && h.z[i] > -6) this.popGrump(i, true);
        break;
    }
    return true;
  }
  private grow(k: number) {
    if (k <= 0) return;
    // powers and passives keep their full value: the expectation grows by the same share
    this.ex += (k * this.ex) / Math.max(1, this.n);
    this.stats.recruits += k;
    this.setCount(this.n + k);
    this.events.push({ t: "recruit", x: this.bx, z: -0.5, n: k });
  }
  private applyPower(pw: PowerUp, x: number, z: number) {
    this.events.push({ t: "power", kind: pw, x, z });
    if (pw === "beam") this.beamT = 3;
    else if (pw === "freeze") this.freezeT = 3;
    else if (pw === "magnet") this.magnetT = 8;
    else if (pw === "bomb") this.cakeBomb(2.6, Math.max(30, this.n * 1.2));
    else if (pw === "wall") this.wallT = 5;
    else if (pw === "double") this.grow(Math.min(this.n, 150));
    else if (pw === "triple") this.tripleT = 6;
    else if (pw === "rapid") this.fireBoostT = Math.max(this.fireBoostT, 5);
    else if (pw === "mega") this.megaT = 6;
  }
  /** a cake (or bubble bomb) lands on the thickest part of the march near the front */
  private cakeBomb(r: number, dmg: number) {
    const h = this.horde, P = new Float32Array(NB);
    let any = false;
    for (let i = 0; i < h.len; i++) if (h.on[i] && h.z[i] > -24 && h.hitT[i] >= 0) { P[bucketOf(h.x[i])] += h.hp[i] * (1 + (h.z[i] + 24) / 8); any = true; }
    let x: number, z: number;
    if (any) {
      let best = 0;
      for (let b = 1; b < NB; b++) if (P[b] > P[best]) best = b;
      x = -7.5 + (best + 0.5) * BW + (Math.random() - 0.5) * 1.2;
      z = -1e9;
      for (let i = 0; i < h.len; i++) if (h.on[i] && Math.abs(h.x[i] - x) < 1 && h.z[i] > z && h.z[i] > -24) z = h.z[i];
      if (z < -100) z = -10;
    } else if (this.boss) { x = this.boss.x; z = this.boss.z; } else return;
    for (let i = 0; i < h.len; i++) {
      if (!h.on[i] || Math.abs(h.x[i] - x) > r || Math.abs(h.z[i] - z) > r) continue;
      h.hp[i] -= dmg * this.dmgMul;
      if (h.hp[i] <= 0.001) this.popGrump(i, true); else h.hitT[i] = 0.2;
    }
    const s = this.boss;
    if (s && Math.abs(s.x - x) < r + s.r && Math.abs(s.z - z) < r + s.r) this.hurtBoss(s, dmg * this.dmgMul * 0.5, false);
    this.events.push({ t: "cakeBomb", x, z });
  }
  /** damage that ignores the bubble path (powers, cakes, beams); respects ghost fade, golem core and robot armour */
  private hurtBoss(s: Boss, dmg: number, power: boolean) {
    const mul = power ? (s.kind === "ghost" && s.fadeT > 0 ? 0 : 1) : this.bossMul(s);
    if (mul <= 0) return;
    s.hp -= dmg * mul; s.hitT = 0.15;
    this.events.push({ t: "bossHit" });
    if (s.hp <= 0.001) this.bossDown();
  }
  private bossMul(s: Boss): number {
    if (s.kind === "ghost" && s.fadeT > 0) return 0;
    if (s.kind === "golem" && !s.core) return 0.25;
    if (s.kind === "robo" && s.armor) return 0.35;
    if (s.shieldT > 0) return 0;
    return 1;
  }

  private stepMechanics(dt: number) {
    const m = this.spec.mech, h = this.horde;
    // Zib's UFO beam / the Rainbow Beam: a column of light that melts everything in front of the brigade
    if (this.beamT > 0) {
      const dps = Math.max(25, this.n * 2.2) * this.dmgMul * dt;
      for (let i = 0; i < h.len; i++) {
        if (!h.on[i] || Math.abs(h.x[i] - this.bx) > 1.0 || h.z[i] < -38) continue;
        h.hp[i] -= dps;
        if (h.hp[i] <= 0.001) this.popGrump(i, false);
      }
      const s = this.boss;
      if (s && s.entered && Math.abs(s.x - this.bx) < 1 + s.r * 0.6) this.hurtBoss(s, dps * 0.6, false);
    }
    // Gloop grows, Bonbon bakes
    if (this.leader === "gloop") { this.gloopT -= dt; if (this.gloopT <= 0) { this.gloopT = 4; this.grow(1); } }
    if (this.leader === "bonbon") { this.cakeT -= dt; if (this.cakeT <= 0) { this.cakeT = 5; this.cakeBomb(1.3, Math.max(6, this.n * 0.25)); } }
    // toy blocks slide across the field
    for (const b of this.blockers) {
      b.x += b.vx * dt;
      if (b.x < b.x0 || b.x > b.x1) { b.vx = -b.vx; b.x = Math.max(b.x0, Math.min(b.x1, b.x)); }
    }
    // surf waves (Beach Day)
    if (m.waves) {
      this.surfT -= dt;
      if (this.surf === 0 && this.surfT <= 1.3) { this.surf = Math.random() < 0.5 ? -1 : 1; this.events.push({ t: "surf", dir: this.surf, stage: "warn" }); }
      if (this.surfT <= 0) {
        const dir = this.surf || 1;
        this.bx = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, this.bx + dir * 3.2));
        this.tx = this.bx; this.vx = dir * 6;
        for (let i = this.tiles.length - 1; i >= 0; i--) if (this.tiles[i].moving && this.tiles[i].z > -7 && !this.tiles[i].pw) this.tiles.splice(i, 1);
        this.events.push({ t: "surf", dir, stage: "hit" });
        this.surf = 0; this.surfT = m.waves * (0.8 + Math.random() * 0.4);
      }
    }
    // boulders (Jungle Ruins)
    if (m.boulders) { this.boulderT -= dt; if (this.boulderT <= 0) { this.boulderT = m.boulders * (0.8 + Math.random() * 0.4); this.spawnBoulder(Math.random() < 0.55 ? this.bx : undefined, -42); } }
    for (let k = this.boulders.length - 1; k >= 0; k--) {
      const b = this.boulders[k];
      b.z += 9 * dt;
      for (let i = 0; i < h.len; i++) if (h.on[i] && Math.abs(h.x[i] - b.x) < 0.9 && Math.abs(h.z[i] - b.z) < 0.9) this.popGrump(i, false);
      if (b.z >= -this.R * 0.8) {
        const hit = Math.abs(this.bx - b.x) < 1.0 + this.R * 0.5 && this.guardT <= 0;
        const n = hit ? Math.min(this.n, b.dmg) : 0;
        this.events.push({ t: "boulderHit", x: b.x, hit, n });
        this.boulders.splice(k, 1);
        if (hit) { this.stats.lost += n; this.setCount(this.n - n); if (this.n <= 0) { this.lose(); return; } }
      }
    }
    // meteors (Space Station)
    if (m.meteors) { this.meteorT -= dt; if (this.meteorT <= 0) { this.meteorT = m.meteors * (0.8 + Math.random() * 0.4); this.throwBomb("rock", this.bx + (Math.random() - 0.5) * 4, -14, 12, Math.max(2, Math.round(this.n * 0.08)), 1.1, 1.5); } }
    // lava vents and puddles
    let burning = false;
    for (let k = this.zones.length - 1; k >= 0; k--) {
      const zn = this.zones[k];
      zn.t -= dt;
      if (zn.kind === "vent") {
        if (zn.t <= 0) {
          zn.state = (zn.state + 1) % 3;
          zn.t = zn.state === 0 ? 2.6 + Math.random() * 2 : zn.state === 1 ? 1.2 : 1.6;
          this.events.push({ t: "vent", x: zn.x, state: zn.state === 1 ? "warn" : zn.state === 2 ? "erupt" : "off" });
        }
        if (zn.state === 2 && Math.abs(this.bx - zn.x) < zn.w / 2 + this.R * 0.4) burning = true;
      } else {
        if (zn.t <= 0) { this.zones.splice(k, 1); continue; }
        if (Math.abs(this.bx - zn.x) < zn.w / 2 + this.R * 0.4) burning = true;
      }
    }
    if (burning && this.guardT <= 0) {
      this.burnAcc += dt;
      while (this.burnAcc >= 0.25) {
        this.burnAcc -= 0.25;
        const n = Math.min(this.n, Math.max(1, Math.round(this.n * 0.01)));
        this.stats.lost += n; this.setCount(this.n - n);
        this.events.push({ t: "burn", n });
        if (this.n <= 0) { this.lose(); return; }
      }
    } else this.burnAcc = 0;
  }
  private spawnBoulder(x: number | undefined, z: number) {
    const f = this.lanes[this.fields[0]];
    const bx = x ?? f.x0 + 0.8 + Math.random() * (f.x1 - f.x0 - 1.6);
    this.boulders.push({ id: this.ids++, x: Math.max(-HALF + 0.9, Math.min(HALF - 0.9, bx)), z, dmg: Math.max(3, Math.round(this.n * 0.08)) });
    this.events.push({ t: "boulder", x: bx });
  }

  // ---------------------------------------------------------------- the par bot (autopilot, attract mode, QA, balance sweep)
  botTarget(): number {
    const h = this.horde, L = this.lanes;
    // dodge boulders, erupting vents and lava puddles
    for (const b of this.boulders) {
      if (b.z < -15 || Math.abs(this.bx - b.x) > 1.0 + this.R * 0.5 + 0.4) continue;
      const away = this.bx >= b.x ? 1 : -1, gap = 1.6 + this.R * 0.6;
      let tx = b.x + away * gap;
      if (Math.abs(tx) > HALF - 0.6) tx = b.x - away * gap;
      return tx;
    }
    for (const zn of this.zones) {
      if (!(zn.kind === "lava" || zn.state >= 1) || Math.abs(this.bx - zn.x) > zn.w / 2 + this.R * 0.4 + 0.3) continue;
      const away = this.bx >= zn.x ? 1 : -1, gap = zn.w / 2 + this.R * 0.5 + 0.5;
      let tx = zn.x + away * gap;
      if (Math.abs(tx) > HALF - 0.6) tx = zn.x - away * gap;
      return tx;
    }
    // dodge anything about to land on us
    for (const b of this.bombs) {
      if (b.dur - b.t > 0.95 || Math.abs(this.bx - b.x) > b.r + this.R * 0.55 + 0.35) continue;
      const away = this.bx >= b.x ? 1 : -1, gap = b.r + this.R * 0.6 + 0.6;
      let tx = b.x + away * gap;
      if (Math.abs(tx) > HALF - 0.6) tx = b.x - away * gap;
      return tx;
    }
    const rec = L.findIndex((l) => l.kind === "recruit"), bonus = L.findIndex((l) => l.kind === "bonus");
    for (const g of this.gates) {
      if (g.done || g.z < -7) continue;
      let best = 0, bv = -1;
      g.gates.forEach((gate, i) => { const v = applyGate(this.n, gate); if (v > bv) { bv = v; best = i; } });
      const w = (2 * HALF) / g.gates.length;
      return -HALF + w * (best + 0.5);
    }
    // pressure per column: close and tough Grumpies weigh most
    const P = new Float32Array(NB);
    let frontZ = -1e9;
    for (let i = 0; i < h.len; i++) {
      if (!h.on[i]) continue;
      const z = h.z[i];
      if (z > frontZ) frontZ = z;
      if (z > -26) P[bucketOf(h.x[i])] += h.hp[i] * (1 + (z + 26) / 6);
    }
    const tArrive = (-frontZ - this.R) / Math.max(0.5, this.speed);
    const s = this.boss;
    let bestB = -1, bestP = 0;
    for (let b = 0; b < NB; b++) {
      const p = P[b] + (b > 0 ? P[b - 1] * 0.6 : 0) + (b < NB - 1 ? P[b + 1] * 0.6 : 0);
      if (p > bestP) { bestP = p; bestB = b; }
    }
    const defendX = bestB >= 0 ? -7.5 + (bestB + 0.5) * BW : 0;
    // must defend: the march is at the door
    const g = this.greedy;
    if (frontZ > (g ? -2.6 : -4.5)) return defendX;
    // a Grumpy carrying a power is worth aiming at
    for (let i = 0; i < h.len; i++) if (h.on[i] && h.pw[i] && h.z[i] > -16 && h.z[i] < -3) return h.x[i];
    // a power tile is always worth a quick dash
    const pwT = this.tiles.find((t) => t.pw && t.moving && t.z > -6 && t.z < 0.6);
    if (pwT && frontZ < (g ? -3.5 : -5.5)) return this.laneMid(pwT.lane);
    if (s && s.z > (g ? -12 : -16)) return s.x;
    const soon = (lane: number) => this.tiles.some((t) => t.lane === lane && t.moving && t.z > -9 && t.z < 0.6);
    const jar = this.blocks.find((o) => o.alive && o.kind === "jar" && o.z > BUBBLE_END + 2);
    if (jar && tArrive > (g ? 3.5 : 6) && this.n * this.fireRate * (g ? 2 : 3) > jar.hp) return jar.x;
    // grow while there is time; a big brigade grows only when the march is far away
    if (rec >= 0 && soon(rec) && (tArrive > (g ? 0.8 : 2.5) || this.n < (g ? 30 : 12))) return this.laneMid(rec);
    if (bonus >= 0 && soon(bonus) && tArrive > (g ? 1 : 2.5)) return this.laneMid(bonus);
    if (s && s.z > -30) return s.x;
    const mover = this.blocks.filter((o) => o.alive && o.moving).sort((a, b) => b.z - a.z)[0];
    if (mover && mover.z > -26 && (tArrive > 4 || this.horde.alive === 0)) return mover.x;
    if (s) return s.x;
    return bestB >= 0 ? defendX : this.bx;
  }

  // ---------------------------------------------------------------- result
  result(): SimResult {
    const won = this.phase === "won";
    const g = this.spec.goal, st = this.stats;
    let goalMet = false;
    if (g.kind === "jars") goalMet = st.jarsTotal > 0 && st.jars >= st.jarsTotal;
    else if (g.kind === "keep") goalMet = this.n >= g.value * this.peak;
    else if (g.kind === "count") goalMet = this.peak >= g.value;
    else if (g.kind === "cages") goalMet = st.cages >= st.cagesTotal;
    else if (g.kind === "fast") goalMet = this.t <= g.value;
    else if (g.kind === "pinatas") goalMet = st.pinatas >= g.value;
    let stars = 0;
    if (this.spec.type === "pinata") {
      const f = st.pinatasTotal ? st.pinatas / st.pinatasTotal : 0;
      stars = won ? (f >= 1 ? 3 : f >= 0.7 ? 2 : f >= 0.4 ? 1 : 0) : 0;
    } else if (won) {
      const keep = this.n >= 0.4 * this.peak;
      stars = 1 + (keep ? 1 : 0) + (keep && goalMet ? 1 : 0);
    }
    const res: SimResult = {
      won, stars, count: this.n, peak: this.peak, pops: st.pops, coins: Math.round(st.coins * this.coinMul), time: this.t, goalMet,
      jars: st.jars, jarsTotal: st.jarsTotal, cages: st.cages, cagesTotal: st.cagesTotal, pinatas: st.pinatas, pinatasTotal: st.pinatasTotal,
    };
    if (this.spec.endless) { res.wave = this.wave; res.score = Math.round(st.popHp + 100 * (this.wave - 1) + st.coins); }
    if (this.spec.rush) { res.wave = this.wave - 1; res.score = Math.round(this.t * 10) / 10; }
    return res;
  }
}
