// Momo Boing! simulation (pure TS: the browser, the balance sweep and QA all run this).
// Momo bounces by himself; the player steers (`tx`, wrapped column) and taps. A tap just before a landing (or just
// after) is a PERFECT BOING; a chain of them fires a Comet. Friends picked up from bubbles stack on Momo's head: each
// one saves him once and lends a power while riding along. The Grumpy Goo rises from below and never falls far behind.
// Phase 2 worlds add trampolines, cannons, rolling beach balls, ghost platforms, lava vents, planets (low gravity),
// drawbridges, climbable vines, water spouts / lava geysers, lava bubbles from below and power cards on Safe Clouds.
import { CANNON_MUL, CARD_IDS, GRAVITY, GUM_MUL, HALF, JUMP_V, PERFECT_MUL, SPRING_MUL, TRAMP_MUL, apexOf, dxWrap, seededRng, wrapX } from "./levels";
import type { CardId, DropKind, EnemyKind, FriendId, PlatKind, PlatSpec, SimEvent, SimResult, StageSpec, VillainKind } from "./types";

export interface Plat extends PlatSpec { id: number; x0: number; alive: boolean; fallV: number; dy: number; squish: number; used: boolean }
export interface Enemy { id: number; kind: EnemyKind; x: number; y: number; y0: number; x0: number; x1: number; spd: number; dir: number; alive: boolean; deadT: number; ph: number }
export interface Item { id: number; kind: "coin" | "note" | "friend"; x: number; y: number; friend?: FriendId; taken: boolean; ph: number }
export interface Drop { id: number; kind: DropKind; x: number; y: number; vy: number; warnT: number; falling: boolean; up: boolean }
export interface Villain { kind: VillainKind; x: number; y: number; bonked: boolean; throwT: number }

/** the camera keeps Momo's highest point this far above the bottom of the screen */
export const VIEW_BELOW = 7;
export const MOMO_R = 0.42;
const COMET_V = 15;
const COMET_T = 1.7;
const MAX_STACK = 5;
const VINE_V = 7.5;

/** ghost platforms glow (and hold Momo) ~60% of the time; drawbridges are down ~65%; vents erupt ~25% */
export const ghostOn = (p: { ph?: number }, t: number) => Math.sin(t * 2.4 + (p.ph ?? 0)) > -0.25;
export const ghostLevel = (p: { ph?: number }, t: number) => Math.max(0, Math.min(1, (Math.sin(t * 2.4 + (p.ph ?? 0)) + 0.45) / 0.4));
export const bridgeDown = (p: { ph?: number }, t: number) => Math.sin(t * 1.5 + (p.ph ?? 0)) > -0.35;
export const bridgeAngle = (p: { ph?: number }, t: number) => Math.max(0, Math.min(1, (-Math.sin(t * 1.5 + (p.ph ?? 0)) - 0.1) / 0.4)) * 1.35;
export const ventHot = (p: { ph?: number }, t: number) => Math.sin(t * 1.8 + (p.ph ?? 0)) > 0.5;
export const liftOn = (l: { kind: string; ph: number }, t: number) => l.kind === "spout" || (t + l.ph) % 3.2 < 1.35;

export interface SimOptions { bot?: boolean; skill?: number }

export class Sim {
  spec: StageSpec;
  phase: "play" | "won" | "lost" = "play";
  t = 0;
  // Momo
  xr = 0; x = 0; y = 0; vy = 0; tx = 0; vx = 0;
  maxY = 0; floor = -VIEW_BELOW;
  /** where Momo last stood safely (a landing, a vine, a lift, a comet): the screen never scrolls past it */
  private safeY = 0;
  chain = 0; cometT = 0; invulnT = 0; stuckT = 0; stuckPlat: Plat | null = null; gumPerfect = false;
  slideV = 0; landT = -9; lastTap = -9; lastPerfect = false; lastLand: PlatKind = "solid";
  /** climbing a vine: its index, or −1 */
  vine = -1; private vineCd = 0;
  stack: FriendId[] = [];
  // power cards (from Safe Clouds)
  cards: CardId[] = [];
  /** three cards to choose from: the sim waits until one is picked */
  choosing: CardId[] | null = null;
  shields = 0; private cloudSaves = 0; private doubleUsed = false;
  // world
  plats: Plat[]; enemies: Enemy[]; items: Item[]; drops: Drop[] = []; villain: Villain | null = null;
  gooY: number; gooPause = 0;
  private dropT: number; private cakeT = 12; private snipT = 4;
  private ids = 0;
  cometNeed: number;
  readonly G: number; readonly V: number;
  stats = { coins: 0, notes: 0, perfects: 0, bestChain: 0, comets: 0, friends: 0, bumps: 0, stomps: 0, coinsTotal: 0 };
  events: SimEvent[] = [];
  // bot
  bot: boolean; skill: number;
  private botT = 0; private botAim = 0; private botTarget: Plat | null = null; private tappedFall = false;

  constructor(spec: StageSpec, o: SimOptions = {}) {
    this.spec = spec;
    this.bot = !!o.bot; this.skill = o.skill ?? 1;
    this.G = GRAVITY * (spec.grav ?? 1); this.V = JUMP_V * (spec.jump ?? 1);
    this.vy = this.V * 0.85;
    this.plats = spec.plats.map((p) => ({ ...p, id: this.ids++, x0: p.x, alive: true, fallV: 0, dy: 0, squish: 0, used: false }));
    this.enemies = spec.enemies.map((e) => ({ id: this.ids++, kind: e.kind, x: e.x, y: e.y, y0: e.y, x0: e.x0 ?? e.x - 1.5, x1: e.x1 ?? e.x + 1.5, spd: e.spd ?? 1.2, dir: 1, alive: true, deadT: 0, ph: (e.x * 13.7) % 6.28 }));
    this.items = spec.items.map((i) => ({ id: this.ids++, kind: i.kind, x: i.x, y: i.y, friend: i.friend, taken: false, ph: (i.y * 7.3) % 6.28 }));
    this.stats.coinsTotal = this.items.filter((i) => i.kind === "coin").length;
    this.gooY = spec.demo ? -1e9 : spec.goo.start;
    this.dropT = 3 + spec.drops.every * 0.5;
    this.cometNeed = spec.type === "comet" && !spec.endless ? 4 : 5;
    if (spec.villain) this.villain = { kind: spec.villain.kind, x: 0, y: spec.top + 4.6, bonked: false, throwT: 2 };
    this.y = 0.01;
  }

  get k() { return Math.min(1, this.spec.d + (this.spec.endless ? this.maxY / 700 : 0)); }
  get height() { return Math.max(0, this.maxY); }
  private count(id: FriendId) { let n = 0; for (const f of this.stack) if (f === id) n++; return n; }
  has(c: CardId) { return this.cards.includes(c); }
  get window() { return this.spec.window * (this.count("noodle") ? 1.4 : 1); }
  private landPad() { return MOMO_R * 0.55 + (this.count("gloop") ? 0.3 : 0) + (this.has("wide") ? 0.35 : 0); }
  private jumpMul() { return (1 + 0.08 * Math.min(2, this.count("bolt"))) * (this.has("spring") ? 1.08 : 1); }
  private perfectMul() { return PERFECT_MUL + (this.count("tiki") ? 0.1 : 0); }
  /** can Momo stand on this platform right now? */
  solid(p: Plat) {
    if (!p.alive) return false;
    if (p.kind === "ghost") return ghostOn(p, this.t);
    if (p.kind === "bridge") return bridgeDown(p, this.t);
    return true;
  }

  // ---------------------------------------------------------------- input
  /** a tap anywhere: arms a Perfect Boing for the next landing (or upgrades the one that just happened) */
  tap() {
    if (this.phase !== "play" || this.choosing) return;
    if (this.stuckT > 0) { this.gumPerfect = true; return; }
    if (this.vine >= 0) { this.leaveVine(this.V); return; }
    if (this.cometT <= 0 && this.t - this.landT < 0.075 && !this.lastPerfect && this.vy > 0 && this.lastLand !== "finish") {
      this.vy *= this.perfectMul(); this.lastPerfect = true; this.addPerfect();
      return;
    }
    // Double Boing card: one extra jump in the air (not when a landing is about to happen)
    if (this.has("double") && !this.doubleUsed && this.cometT <= 0 && this.vy < 3 && this.timeToLand() > this.window * 1.6) {
      this.doubleUsed = true; this.vy = this.V * 0.95; this.events.push({ t: "double", x: this.x, y: this.y });
      return;
    }
    this.lastTap = this.t;
  }
  /** a power card from a Safe Cloud */
  pickCard(id: CardId) {
    if (!this.choosing) return;
    this.choosing = null;
    this.cards.push(id);
    if (id === "shield") this.shields++;
    if (id === "cloud") this.cloudSaves++;
    if (id === "lucky") this.cometNeed = Math.max(3, this.cometNeed - 1);
    this.events.push({ t: "card", id });
  }
  private timeToLand() {
    if (this.vy > 0) return 9;
    let best = -1e9;
    for (const p of this.plats) if (this.solid(p) && p.y <= this.y && p.y > best && Math.abs(dxWrap(p.x, this.x)) <= p.w / 2 + this.landPad()) best = p.y;
    if (best < -1e8) return 9;
    return (this.y - best) / Math.max(0.5, -this.vy);
  }

  // ---------------------------------------------------------------- step
  step(dt: number) {
    if (this.phase !== "play") return;
    if (this.choosing) { if (this.bot) this.pickCard(this.choosing[0]); return; }
    dt = Math.min(dt, 0.05);
    this.t += dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.vineCd > 0) this.vineCd -= dt;
    if (this.bot) this.think(dt);
    this.steer(dt);
    this.movePlatforms(dt);
    this.moveMomo(dt);
    if (this.phase !== "play") return;
    this.stepFriends(dt);
    this.stepEnemies(dt);
    this.stepItems(dt);
    this.stepDrops(dt);
    this.stepVillain(dt);
    this.stepGoo(dt);
  }

  private steer(dt: number) {
    const prev = this.xr;
    // wind bands and ice slides push Momo *and* the aim, so the player has to steer back
    for (const w of this.spec.winds) if (this.y >= w.y0 && this.y <= w.y1) { this.xr += w.force * dt; this.tx += w.force * dt; }
    if (Math.abs(this.slideV) > 0.05) { this.xr += this.slideV * dt; this.tx += this.slideV * dt; this.slideV *= Math.exp(-dt * 1.5); }
    if (this.stuckT <= 0 && this.vine < 0) {
      const d = this.tx - this.xr, mv = (this.count("turbo") ? 20 : 14) * dt;
      this.xr += Math.abs(d) <= mv ? d : Math.sign(d) * mv;
    }
    // keep the raw numbers small (the column wraps)
    if (Math.abs(this.xr) > 50) { const s = wrapX(this.xr) - this.xr; this.xr += s; this.tx += s; }
    this.vx = (this.xr - prev) / dt;
    this.x = wrapX(this.xr);
  }

  private movePlatforms(dt: number) {
    for (const p of this.plats) {
      if (p.squish > 0) p.squish = Math.max(0, p.squish - dt * 3.5);
      if ((p.kind === "move" || p.kind === "ball") && p.alive) p.x = wrapX(p.x0 + (p.amp ?? 1) * Math.sin(this.t * (p.spd ?? 1) + (p.ph ?? 0)));
      if (!p.alive && p.kind === "crumble") { p.fallV += 22 * dt; p.dy -= p.fallV * dt; }
    }
  }

  private moveMomo(dt: number) {
    const G = this.G, V = this.V;
    if (this.stuckT > 0) {
      const p = this.stuckPlat!;
      this.stuckT -= dt; this.y = p.y;
      if (p.kind === "move" || p.kind === "ball") { const d = dxWrap(this.x, p.x); this.xr += d; this.tx += d; this.x = wrapX(this.xr); }
      if (this.stuckT <= 0) {
        const mul = p.kind === "cannon" ? CANNON_MUL : GUM_MUL;
        this.vy = V * mul * this.jumpMul() * (this.gumPerfect ? this.perfectMul() : 1);
        if (this.gumPerfect) this.addPerfect(); else this.chain = 0;
        this.events.push(p.kind === "cannon" ? { t: "cannon", x: this.x, y: this.y } : { t: "gum", x: this.x, y: this.y });
        this.landT = this.t; this.lastPerfect = this.gumPerfect; this.gumPerfect = false; this.stuckPlat = null;
      }
      return;
    }
    if (this.cometT > 0) {
      this.cometT -= dt;
      this.y += COMET_V * dt;
      this.safeY = Math.max(this.safeY, this.y - 4);
      if (this.cometT <= 0) { this.vy = V * 0.9; this.invulnT = Math.max(this.invulnT, 0.7); this.events.push({ t: "comet", on: false }); }
      this.track();
      if (this.y >= this.spec.top - 0.4 && !this.spec.demo) { this.cometT = 0; this.vy = 4; }
      return;
    }
    if (this.vine >= 0) {
      const v = this.spec.vines[this.vine];
      this.y += VINE_V * dt; this.vy = VINE_V;
      this.safeY = Math.max(this.safeY, this.y);
      const d = dxWrap(this.x, v.x); this.xr += d * Math.min(1, dt * 12); this.tx = this.xr; this.x = wrapX(this.xr);
      this.track();
      if (this.y >= v.y1 - 0.2) this.leaveVine(V * 1.12);
      return;
    }
    const py = this.y;
    this.vy -= G * dt;
    // water spouts and lava geysers carry Momo up
    for (const l of this.spec.lifts) if (this.y >= l.y0 && this.y <= l.y1 && Math.abs(dxWrap(l.x, this.x)) < 0.6 && liftOn(l, this.t)) {
      if (this.vy < 12) { if (this.vy < 0) this.events.push({ t: "lift", x: this.x, y: this.y }); this.vy = Math.min(12, this.vy + 60 * dt); this.vy = Math.max(this.vy, 4); }
    }
    this.y += this.vy * dt;
    // grab a vine
    if (this.vineCd <= 0) for (let i = 0; i < this.spec.vines.length; i++) {
      const v = this.spec.vines[i];
      if (this.y >= v.y0 - 0.3 && this.y <= v.y1 - 0.8 && Math.abs(dxWrap(v.x, this.x)) < 0.42) { this.vine = i; this.chain = 0; this.doubleUsed = false; this.events.push({ t: "vine", x: v.x, y: this.y }); return; }
    }
    if (this.vy < 0) {
      let best: Plat | null = null;
      const pad = this.landPad();
      for (const p of this.plats) {
        if (!this.solid(p)) continue;
        if (py >= p.y - 0.001 && this.y <= p.y && Math.abs(dxWrap(p.x, this.x)) <= p.w / 2 + pad && (!best || p.y > best.y)) best = p;
      }
      if (best) this.land(best);
    }
    this.track();
    if (this.y < this.floor - 0.6) this.bump("fall");
  }

  private leaveVine(v: number) { this.vine = -1; this.vineCd = 0.6; this.vy = v; this.landT = this.t; this.lastPerfect = true; }

  private track() {
    if (this.y > this.maxY) this.maxY = this.y;
    // the bottom of the screen follows the highest point, but never past the platform Momo bounced from
    this.floor = Math.max(this.floor, Math.min(this.maxY - VIEW_BELOW, this.safeY - 1.5));
  }

  private land(p: Plat) {
    this.y = p.y;
    this.safeY = Math.max(this.safeY, p.y);
    this.doubleUsed = false;
    // a Grumpy sitting there gets stomped first
    for (const e of this.enemies) if (e.alive && e.kind === "sitter" && Math.abs(e.y - p.y) < 0.05 && Math.abs(dxWrap(e.x, this.x)) < 0.75) { this.stomp(e); return; }
    const perfect = this.t - this.lastTap <= this.window && p.kind !== "finish";
    this.lastTap = -9;
    p.squish = 1;
    this.lastLand = p.kind;
    const V = this.V;
    if (p.kind === "finish") {
      this.vy = V * 0.6;
      this.events.push({ t: "land", x: this.x, y: this.y, perfect: false, kind: p.kind, chain: this.chain });
      this.win();
      return;
    }
    if (p.kind === "gum" || p.kind === "cannon") {
      this.stuckT = p.kind === "cannon" ? 0.45 : 0.38; this.stuckPlat = p; this.vy = 0; this.gumPerfect = perfect;
      if (p.kind === "cannon") { const d = dxWrap(this.x, p.x); this.xr += d; this.tx = this.xr; this.x = wrapX(this.xr); }
      this.events.push({ t: "land", x: this.x, y: this.y, perfect: false, kind: p.kind, chain: this.chain });
      return;
    }
    let v = V * this.jumpMul();
    if (p.kind === "spring") { v *= SPRING_MUL; this.events.push({ t: "spring", x: this.x, y: this.y }); }
    if (p.kind === "tramp") { v *= TRAMP_MUL; this.events.push({ t: "spring", x: this.x, y: this.y }); }
    if (p.kind === "vent" && ventHot(p, this.t)) { v *= 1.8; this.events.push({ t: "lift", x: this.x, y: this.y }); }
    if (p.kind === "crumble") { p.alive = false; this.events.push({ t: "crumble", x: p.x, y: p.y }); }
    if (p.kind === "cloud") { p.alive = false; p.dy = -100; this.events.push({ t: "crumble", x: p.x, y: p.y }); }
    if (p.kind === "ice") this.slideV = Math.max(-6, Math.min(6, this.vx * 0.85 + (this.vx === 0 ? 0 : Math.sign(this.vx) * 0.8)));
    if (p.kind === "safe" && !this.spec.demo && !p.used) {
      p.used = true;
      this.gooY = Math.min(this.gooY, this.floor - this.spec.goo.lag - 3); this.gooPause = 3;
      this.events.push({ t: "safe", y: p.y });
      this.offerCards(p.id);
    }
    if (perfect) v *= this.perfectMul();
    this.vy = v; this.landT = this.t; this.lastPerfect = perfect;
    if (perfect) this.addPerfect(); else this.chain = 0;
    this.events.push({ t: "land", x: this.x, y: this.y, perfect, kind: p.kind, chain: this.chain });
    if (this.chain >= this.cometNeed) this.startComet();
  }

  private offerCards(salt: number) {
    const r = seededRng(this.spec.seed + salt * 31 + this.cards.length * 7);
    const left = CARD_IDS.filter((c) => !this.cards.includes(c) || c === "shield" || c === "cloud");
    const ids: CardId[] = [];
    while (ids.length < 3 && left.length) ids.push(left.splice(Math.floor(r() * left.length), 1)[0]);
    if (!ids.length) return;
    this.choosing = ids;
    this.events.push({ t: "cards", ids });
  }

  private addPerfect() {
    this.chain++; this.stats.perfects++;
    if (this.chain > this.stats.bestChain) this.stats.bestChain = this.chain;
    this.events.push({ t: "perfect", chain: this.chain, x: this.x, y: this.y });
    if (this.chain >= this.cometNeed && this.cometT <= 0 && this.stuckT <= 0 && this.vy > 0) this.startComet();
  }

  private startComet() {
    if (this.cometT > 0) return;
    this.chain = 0; this.cometT = COMET_T; this.stats.comets++; this.vine = -1;
    this.events.push({ t: "comet", on: true });
  }

  private stomp(e: Enemy) {
    e.alive = false; e.deadT = 0; this.stats.stomps++;
    const perfect = this.t - this.lastTap <= this.window;
    this.lastTap = -9; this.doubleUsed = false;
    this.vy = this.V * 1.08 * this.jumpMul() * (perfect ? this.perfectMul() : 1);
    this.landT = this.t; this.lastPerfect = perfect; this.lastLand = "solid";
    this.events.push({ t: "stomp", x: e.x, y: e.y });
    if (perfect) this.addPerfect();
  }

  /** hit by a Grumpy, a falling thing, the goo, or a fall: a friend saves Momo, or the climb is over */
  private bump(by: "enemy" | "drop" | "goo" | "fall") {
    if (this.phase !== "play") return;
    if ((this.invulnT > 0 || this.cometT > 0) && by !== "fall") return;
    this.events.push({ t: "hit", x: this.x, y: this.y, by });
    // a Grumpy or a falling thing only bonks Momo down (the fall that may follow is the real danger)
    if (by === "enemy" || by === "drop") {
      this.stats.bumps++;
      this.invulnT = 1.1; this.chain = 0; this.stuckT = 0; this.stuckPlat = null; this.vine = -1; this.vineCd = 0.6;
      this.vy = Math.min(this.vy, -2.5);
      return;
    }
    // Cloud Maker card: a cloud pops up under Momo
    if (by === "fall" && this.cloudSaves > 0) {
      this.cloudSaves--; this.stats.bumps++;
      const p: Plat = { x: this.x, y: this.floor + 0.6, w: 2.4, kind: "cloud", id: this.ids++, x0: this.x, alive: true, fallV: 0, dy: 0, squish: 1, used: false };
      this.plats.push(p);
      this.y = p.y; this.safeY = p.y; this.vy = this.V * 1.3; this.invulnT = 1.2;
      this.events.push({ t: "card", id: "cloud" });
      return;
    }
    let saver: FriendId | "shield" | undefined;
    if (this.shields > 0) { this.shields--; saver = "shield"; } else saver = this.stack.pop();
    if (!saver) { this.lose(); return; }
    this.stats.bumps++;
    this.invulnT = 1.6; this.chain = 0; this.stuckT = 0; this.stuckPlat = null; this.vine = -1;
    if (this.y < this.floor + 0.4) this.y = this.floor + 0.4;
    this.safeY = Math.max(this.safeY, this.y);
    this.vy = this.V * (by === "fall" || by === "goo" ? 1.45 : 1.25);
    this.gooY = Math.min(this.gooY, this.y - 5);
    if (saver === "shield") this.events.push({ t: "card", id: "shield" });
    else this.events.push({ t: "friendSave", id: saver, x: this.x, y: this.y });
  }

  private win() { this.phase = "won"; if (this.villain) this.villain.bonked = true; this.events.push({ t: "end", won: true }); }
  private lose() { this.phase = "lost"; this.events.push({ t: "end", won: false }); }

  // ---------------------------------------------------------------- the rest of the sky
  private near(ax: number, ay: number, r: number) {
    const dx = dxWrap(ax, this.x), dy = this.y + 0.4 - ay;
    return dx * dx + dy * dy < r * r;
  }
  private inView(y: number) { return y > this.floor - 1 && y < this.floor + VIEW_BELOW + 11; }

  /** friends with an active power: Bonbon's cake bomb and Kranky's claws */
  private stepFriends(dt: number) {
    if (this.count("bonbon")) {
      this.cakeT -= dt;
      if (this.cakeT <= 0) {
        this.cakeT = 12;
        let any = false;
        for (const e of this.enemies) if (e.alive && this.inView(e.y)) { e.alive = false; e.deadT = 0; this.stats.stomps++; any = true; }
        if (this.drops.length) any = true;
        this.drops.length = 0;
        if (any) this.events.push({ t: "cake" });
        else this.cakeT = 2;
      }
    }
    if (this.count("kranky")) {
      this.snipT -= dt;
      if (this.snipT <= 0) {
        this.snipT = 0.5;
        for (const e of this.enemies) if (e.alive && e.kind === "bee" && this.near(e.x, e.y + 0.3, 1.9)) { e.alive = false; e.deadT = 0; this.stats.stomps++; this.snipT = 4; this.events.push({ t: "snip", x: e.x, y: e.y }); break; }
        if (this.snipT < 1) for (let i = this.drops.length - 1; i >= 0; i--) { const d = this.drops[i]; if (d.falling && this.near(d.x, d.y, 1.9)) { this.drops.splice(i, 1); this.snipT = 4; this.events.push({ t: "snip", x: d.x, y: d.y }); break; } }
      }
    }
  }

  private stepEnemies(dt: number) {
    const pip = this.count("pip") > 0;
    for (const e of this.enemies) {
      if (!e.alive) { e.deadT += dt; continue; }
      if (e.y < this.floor - 3 || e.y > this.floor + 22) continue;
      if (e.kind === "bee") {
        const slow = pip && Math.abs(dxWrap(e.x, this.x)) < 2.6 && Math.abs(e.y - this.y) < 2.6 ? 0.35 : 1;
        e.x += e.dir * e.spd * slow * dt;
        if (e.x > e.x1) { e.x = e.x1; e.dir = -1; } else if (e.x < e.x0) { e.x = e.x0; e.dir = 1; }
        e.y = e.y0 + Math.sin(this.t * 3 + e.ph) * 0.15;
      }
      if (!this.near(e.x, e.y + 0.3, MOMO_R + 0.38)) continue;
      if (this.cometT > 0) { e.alive = false; this.stats.stomps++; this.events.push({ t: "stomp", x: e.x, y: e.y }); continue; }
      if (this.vy < 0 && this.y > e.y + 0.05 && this.vine < 0) this.stomp(e);
      else this.bump("enemy");
    }
  }

  private stepItems(dt: number) {
    const zib = this.count("zib");
    const mag = this.cometT > 0 ? 2.8 : Math.max(zib ? 1.6 + 0.5 * (zib - 1) : 0, this.has("magnet") ? 2.2 : 0);
    for (const it of this.items) {
      if (it.taken || it.y < this.floor - 2 || it.y > this.floor + 20) continue;
      const dx = dxWrap(it.x, this.x), dy = this.y + 0.4 - it.y, d2 = dx * dx + dy * dy;
      if (mag && it.kind !== "friend" && d2 < mag * mag) { const f = Math.min(1, dt * 9); it.x = wrapX(it.x + dx * f); it.y += dy * f; }
      const r = it.kind === "friend" ? 0.95 : 0.6;
      if (d2 > r * r) continue;
      it.taken = true;
      if (it.kind === "coin") { this.stats.coins++; this.events.push({ t: "coin", x: it.x, y: it.y }); }
      else if (it.kind === "note") { this.stats.notes++; this.events.push({ t: "note", x: it.x, y: it.y }); }
      else if (it.friend) {
        this.stats.friends++;
        if (this.stack.length < MAX_STACK) this.stack.push(it.friend); else this.stats.coins += 5;
        this.events.push({ t: "friendJoin", id: it.friend, x: it.x, y: it.y });
      }
    }
  }

  private stepDrops(dt: number) {
    const top = this.floor + VIEW_BELOW + 11, bottom = this.floor - 1.5;
    const ramp = this.spec.endless ? 1 + this.maxY / 900 : 1;
    if (this.spec.drops.every > 0 && !this.spec.demo && this.y < this.spec.top - 8) {
      this.dropT -= dt * ramp;
      if (this.dropT <= 0) {
        this.dropT = this.spec.drops.every * (0.75 + Math.random() * 0.5);
        const x = wrapX(this.x + (Math.random() - 0.5) * 2.6), up = !!this.spec.rising;
        this.drops.push({ id: this.ids++, kind: this.spec.drops.kind, x, y: up ? bottom : top, vy: (up ? 1 : -1) * (9 + 4 * this.k), warnT: 1.05, falling: false, up });
        this.events.push({ t: "warn", x, up });
      }
    }
    const slow = this.count("pip") > 0 ? 0.6 : 1;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d.falling) {
        d.warnT -= dt;
        d.y = d.up ? Math.min(d.y, bottom) : Math.max(d.y, top);
        if (d.warnT <= 0) d.falling = true;
        continue;
      }
      d.y += d.vy * slow * dt;
      if ((!d.up && d.y < this.floor - 3) || (d.up && d.y > top + 2)) { this.drops.splice(i, 1); continue; }
      if (this.near(d.x, d.y, MOMO_R + 0.36)) {
        this.drops.splice(i, 1);
        if (this.cometT > 0) { this.events.push({ t: "stomp", x: d.x, y: d.y }); continue; }
        this.bump("drop");
      }
    }
  }

  private stepVillain(dt: number) {
    const v = this.villain;
    if (!v || v.bonked || !this.spec.villain) return;
    v.x += Math.sign(dxWrap(v.x, this.x)) * Math.min(Math.abs(dxWrap(v.x, this.x)), 0.9 * dt);
    v.x = wrapX(v.x);
    if (v.y - this.y > 34 || this.y > this.spec.top - 3) return;
    v.throwT -= dt;
    if (v.throwT <= 0) {
      v.throwT = this.spec.villain.every * (0.8 + Math.random() * 0.4);
      const x = wrapX(this.x + (Math.random() - 0.5) * 2.2);
      const y = Math.min(v.y - 1, this.floor + VIEW_BELOW + 11);
      this.drops.push({ id: this.ids++, kind: this.spec.drops.kind, x, y, vy: -(10 + 4 * this.k), warnT: 0.75, falling: false, up: false });
      this.events.push({ t: "throw", x: v.x, y: v.y }, { t: "warn", x });
    }
  }

  private stepGoo(dt: number) {
    if (this.spec.demo) return;
    if (this.gooPause > 0) this.gooPause -= dt;
    else this.gooY += this.spec.goo.speed * (this.count("hoot") ? 0.7 : 1) * (this.has("slowgoo") ? 0.65 : 1) * (this.spec.endless ? 1 + this.maxY / 900 : 1) * dt;
    this.gooY = Math.max(this.gooY, this.floor - this.spec.goo.lag);
    if (this.y < this.gooY + 0.1 && this.cometT <= 0) this.bump("goo");
  }

  // ---------------------------------------------------------------- the bot (title demo, balance sweeps, QA)
  private think(dt: number) {
    const skill = this.skill;
    this.botT -= dt;
    if (this.botT <= 0) {
      this.botT = 0.08 + (1 - skill) * 0.3;
      const t = this.pickTarget();
      this.botTarget = t;
      let aim = t ? t.x : this.x;
      // a moving platform: aim where it will be when Momo comes down
      if (t && (t.kind === "move" || t.kind === "ball")) {
        const up = this.vy > 0 ? this.vy / this.G : 0, top = this.y + (this.vy > 0 ? apexOf(this.vy, this.G) : 0);
        const down = Math.sqrt(Math.max(0, 2 * (top - t.y) / this.G)) - (this.vy < 0 ? -this.vy / this.G : 0);
        aim = wrapX(t.x0 + (t.amp ?? 1) * Math.sin((this.t + up + Math.max(0, down)) * (t.spd ?? 1) + (t.ph ?? 0)));
      }
      const apex = this.y + (this.vy > 0 ? apexOf(this.vy, this.G) : 0);
      // a vine or a lift on the way up is a free ride
      if (this.vy > 0) {
        for (const v of this.spec.vines) if (v.y0 < apex - 0.5 && v.y1 > this.y + 2 && v.y0 > this.y - 1) aim = v.x;
        for (const l of this.spec.lifts) if (l.y0 < this.y + 1 && l.y1 > this.y + 3 && liftOn(l, this.t)) aim = l.x;
      }
      // already riding a spout or geyser: stay in it to the top
      for (const l of this.spec.lifts) if (this.y >= l.y0 && this.y < l.y1 - 0.3 && Math.abs(dxWrap(l.x, this.x)) < 0.9 && liftOn(l, this.t)) aim = l.x;
      // keep out of a bee's way on the way up
      for (const e of this.enemies) if (e.alive && e.kind === "bee" && e.y > this.y - 0.5 && e.y - this.y < 4 && Math.abs(dxWrap(e.x, aim)) < 1.3) aim = wrapX(aim + (dxWrap(e.x, aim) >= 0 ? 1.5 : -1.5));
      // step around a drop that is about to land here
      for (const d of this.drops) if (Math.abs(dxWrap(d.x, aim)) < 0.9 && (d.falling ? Math.abs(d.y - this.y) < 7 : true)) aim = wrapX(aim + (dxWrap(d.x, aim) >= 0 ? 1.6 : -1.6));
      // a friend bubble within reach is worth a detour
      for (const it of this.items) if (!it.taken && it.kind === "friend" && it.y > this.y - 0.5 && it.y < apex + 0.3 && this.vy > 0 && (!t || Math.abs(dxWrap(it.x, t.x)) < 1.8)) aim = it.x;
      this.botAim = wrapX(aim + (Math.random() - 0.5) * 1.6 * (1 - skill));
    }
    this.tx = this.xr + dxWrap(this.x, this.botAim);
    // taps: just before landing on the target (or while stuck in gum / a cannon)
    if (this.vy > 0) this.tappedFall = false;
    if (this.stuckT > 0 && !this.gumPerfect && this.stuckT < 0.3 && Math.random() < dt * 8 * skill) this.tap();
    const p = this.botTarget;
    if (p && this.vy < 0 && !this.tappedFall && this.cometT <= 0 && this.vine < 0) {
      const ttl = (this.y - p.y) / Math.max(0.1, -this.vy);
      if (ttl > 0 && ttl < this.window * 0.7) { this.tappedFall = true; if (Math.random() < 0.8 * skill) this.tap(); }
    }
  }

  private pickTarget(): Plat | null {
    const apex = this.y + (this.vy > 0 ? apexOf(this.vy, this.G) : 0);
    let best: Plat | null = null, bs = -1e9;
    const pad = this.landPad();
    for (const p of this.plats) {
      if (!p.alive || p.y > apex - 0.25 || p.y < this.floor - 0.2) continue;
      if (this.vy < 0) {
        if (p.y > this.y) continue;
        // falling: can Momo still get across in time?
        const dy = this.y - p.y, tFall = (this.vy + Math.sqrt(this.vy * this.vy + 2 * this.G * dy)) / this.G;
        if (Math.abs(dxWrap(this.x, p.x)) - p.w / 2 - pad > 14 * tFall) continue;
        // will it still be there?
        if ((p.kind === "ghost" && !ghostOn(p, this.t + tFall)) || (p.kind === "bridge" && !bridgeDown(p, this.t + tFall))) continue;
      }
      let s = p.y * 1.0;
      // always try to climb: a platform above the last landing beats bouncing in place
      if (p.y > this.safeY + 0.3) s += 3;
      if (p.kind === "crumble" || p.kind === "cloud") s -= 1.4;
      if (p.kind === "ghost" || p.kind === "bridge") s -= 0.8;
      if (p.kind === "spring" || p.kind === "gum" || p.kind === "safe" || p.kind === "tramp" || p.kind === "cannon") s += 1.5;
      if (p.kind === "vent" && ventHot(p, this.t + 0.5)) s += 1.2;
      if (p.kind === "finish") s += 100;
      for (const e of this.enemies) if (e.alive && e.kind === "bee" && Math.abs(e.y - (p.y + this.y) / 2) < 1.6 && Math.abs(dxWrap(e.x, p.x)) < 1.4) s -= 2.5;
      // a sitting Grumpy is a free stomp
      for (const e of this.enemies) if (e.alive && e.kind === "sitter" && Math.abs(e.y - p.y) < 0.05 && Math.abs(dxWrap(e.x, p.x)) < 0.8) s += 0.8;
      // careless kids sometimes just go for the closest one
      if (this.skill < 0.6) s -= Math.abs(dxWrap(this.x, p.x)) * (1 - this.skill) * 1.2;
      if (s > bs) { bs = s; best = p; }
    }
    return best;
  }

  // ---------------------------------------------------------------- result
  goalMet(): boolean {
    const g = this.spec.goal, st = this.stats;
    if (this.spec.endless) return false;
    switch (g.kind) {
      case "perfects": return st.perfects >= g.value;
      case "notes": return st.notes >= g.value;
      case "friends": return st.friends >= g.value;
      case "comets": return st.comets >= g.value;
      case "stack": return this.stack.length >= g.value;
      case "coins": return st.coins >= g.value;
      case "time": return this.t <= g.value;
      case "stomps": return st.stomps >= g.value;
    }
  }
  result(): SimResult {
    const won = this.phase === "won", st = this.stats, goalMet = won && this.goalMet();
    const stars = this.spec.endless ? 0 : won ? 1 + (goalMet ? 1 : 0) + (goalMet && st.bumps === 0 ? 1 : 0) : 0;
    const height = Math.round(Math.min(this.spec.top, this.maxY));
    const score = height * 5 + st.coins * 10 + st.notes * 20 + st.perfects * 15 + st.stomps * 25 + st.friends * 50 + (won ? 500 : 0);
    return {
      won, stars, goalMet, height, top: Math.round(this.spec.top), time: this.t, coins: st.coins, notes: st.notes, perfects: st.perfects,
      bestChain: st.bestChain, comets: st.comets, friends: st.friends, stack: this.stack.length, bumps: st.bumps, stomps: st.stomps, score,
    };
  }
}

export { HALF };
