// Rollo's physics in track space (s along, u across, h up). The game and the fairness bot both run this, so a stage the
// bot clears is exactly what the player gets. Moving things move with the runner's distance to them, never with the
// clock, so their timing is the same at any speed. Objects are a visual kind plus behaviour flags (hurts, blocks,
// blinks, bobs, rolls toward you, drops from above, zones, pickups, launches, gates…). Rules (clocks, no-hit runs,
// races, chasers), powers, rails, Star Hops and the generic Kranky bosses all run here too.
import { BALL_HEIGHT, DOUBLE_V, G, HEIGHT, JUMP_V, STEER } from "./gen";
import type { Track } from "./track";
import type { Need, Obj, PowerKind, Runner, SimEvent, Stage, ZoneKind } from "./types";

export interface Input { ut: number; jump: boolean; curl: boolean; burst: boolean; trick: boolean; brake?: boolean; flick?: number }
export type BossEvent = { t: "boss"; what: "attack" | "tired" | "hit" | "down" | "miss"; kind: string };
export type Ev = SimEvent | BossEvent;

const MAX_SCALES = 3;
const POWER_TIME: Record<PowerKind, number> = {
  shield: 30, fire: 12, water: 12, thunder: 10, shoes: 10, giant: 7, mini: 8, ghost: 6, double: 12, cape: 12, rocket: 6, snowball: 8,
  star: 8, slowmo: 5, storm: 4, scale: 0, autohop: 10, time: 0, buddy: 15, board: 10, skates: 12, bouncy: 8, wings: 10, mega: 0,
};
/** kinds that hurt by themselves */
const HARM = new Set(["spike", "bar", "wall", "bomb", "laser", "fire", "crusher", "roller", "faller", "saw", "mine", "thorn", "swing"]);
/** zones that act on you in the air too */
const AIR_ZONES = new Set<ZoneKind>(["wind", "updraft", "lowg", "underwater", "dark", "light", "fog", "rain", "pull", "headwind", "ride"]);

export interface BossState {
  kind: string; hp: number; t: number;
  /** distance ahead of the runner, lateral spot, current move */
  ahead: number; u: number; phase: "intro" | "attack" | "tired" | "recover" | "down"; next: number; cycle: number;
  /** where the weak spot waits (track s) while tired */
  at: number;
}

export class Sim {
  readonly st: Stage;
  readonly tr: Track;
  readonly r: Runner;
  readonly know: Set<string>;
  /** objects spawned during play (boss attacks) and objects that run on their own (friends, thieves) */
  dyn: Obj[] = [];
  boss: BossState | null = null;
  /** zones acting on the runner this tick */
  zones = new Set<ZoneKind>();
  private lo = 0;
  private pearlsAtCheck = 0;
  /** pearls carried in from the stages before (the HUD shows the running total) */
  pearlBase = 0;
  /** saved lives: one is used instead of going back to the lantern */
  lives = 0;
  /** a one-run mode (Moon Run, Boss Rush): running out of armour or falling with one scale left ends the run */
  oneRun = false;
  private nextId = 100000;
  private landedOn = new Map<number, number>();
  /** the ledge under the runner's feet (from the last ground check) */
  private underfoot: Obj | null = null;
  /** the bot runs without bosses and wants every hit reported */
  readonly bot: boolean;
  private lastZone: ZoneKind | "" = "";
  /** the finish line (a boss moves it on, so it is read each tick) */
  private readonly goalObj: Obj | null;

  constructor(st: Stage, tr: Track, know: string[], bot = false) {
    this.st = st; this.tr = tr; this.bot = bot;
    this.know = new Set(know);
    for (const o of st.objs) o.gone = false;
    this.goalObj = st.objs.find((o) => o.k === "goal") ?? null;
    // things that run on their own move out of the sorted list
    this.dyn = st.objs.filter((o) => o.pace).map((o) => ({ ...o }));
    this.r = {
      s: 2, u: 0, h: 0, v: st.run * 0.6, vu: 0, vh: 0, air: false, ball: false, slide: 0, ut: 0,
      boost: 0, turbo: 0, rush: 0, stun: 0, blink: 0, scales: MAX_SCALES, pearls: 0, streak: 0, jumps: 0, magnet: 0,
      check: -1, fell: false, done: false, time: 0, hits: 0, medals: 0, trick: 0,
      rail: 0, zone: "", powers: {}, homing: null, dash: 0, slowmo: 0, carry: null, pound: false, ballAt: -9, style: 0, combo: 0,
      keys: 0, letters: 0, shards: 0, bells: 0, switches: 0, colour: 0, lanterns: 0, bonks: 0, wiggle: 0,
      coins: 0, hearts: 0, timeLeft: st.rules?.time ?? 0, chase: st.chase?.gap ?? 0, rival: st.rival ? st.rival.lead : 0, sink: 0, drift: 0, heat: 0, failed: "",
    };
    if (st.boss && !bot) this.boss = { kind: st.boss.kind, hp: st.boss.hits, t: 0, ahead: 60, u: 0, phase: "intro", next: 3.5, cycle: 0, at: 0 };
  }

  /** start with pearls carried over from the stage before */
  carry(pearls: number) { this.r.pearls = pearls; this.pearlBase = pearls; this.pearlsAtCheck = pearls; }

  // ---------------------------------------------------------------- where things are right now
  uOf(o: Obj) {
    let u = o.amp ? o.u + o.amp * Math.sin((o.freq ?? 0.12) * (o.s - this.r.s) + (o.ph ?? 0)) : o.u;
    if (o.look === "E16" || o.look?.endsWith(":ghost")) u = this.r.u * 0.85 + o.u * 0.15; // the Mirror Bot copies you
    if (o.look === "E29") u = o.u + (Math.sin((o.s - this.r.s) * 0.25 + (o.ph ?? 0)) > 0 ? 1 : -1) * (o.amp ?? 2); // the Blink Bot jumps lane
    return u;
  }
  hOf(o: Obj) {
    const d = o.s - this.r.s;
    if (o.k === "hopper") return Math.abs(Math.sin((o.freq ?? 0.35) * d + (o.ph ?? 0))) * 1.9;
    let h = o.h;
    if (o.bob) h += o.bob[0] * Math.abs(Math.sin(o.bob[1] * d + o.bob[2]));
    if (o.drop) h += 9 * Math.max(0, Math.min(1, (d - (o.land ?? 0)) / o.drop));
    if (o.rise) h -= 2.8 * Math.max(0, Math.min(1, (d - (o.land ?? 0)) / o.rise));
    return h;
  }
  sOf(o: Obj) {
    if (!o.roll) return o.s;
    return o.s - o.roll * Math.max(0, Math.min(70, 70 - (o.s - this.r.s)));
  }
  /** is a blinking thing switched on right now */
  on(o: Obj) {
    if (!o.blink) return true;
    const [period, frac, ph] = o.blink;
    const x = (o.s - this.r.s) / period + ph;
    return x - Math.floor(x) < frac;
  }
  get height() {
    const r = this.r;
    if (r.powers.mini) return 0.6;
    if (r.ball || r.slide > 0) return this.st.moves.slide ? 0.5 : BALL_HEIGHT;
    return HEIGHT;
  }
  needMet(n: Need) {
    const r = this.r;
    switch (n.k) {
      case "switch": return (r.switches & (1 << (n.g ?? 0))) !== 0;
      case "key": return r.keys >= n.v;
      case "bells": return r.bells >= n.v;
      case "colour": return r.colour === n.v;
      case "speedMin": return r.v >= n.v || r.turbo > 0 || r.rush > 0;
      case "speedMax": return r.v <= n.v;
      case "pearls": return r.pearls - this.pearlBase >= n.v || this.bot;
      case "lanterns": return r.lanterns >= n.v || this.bot;
      case "bonks": return r.bonks >= n.v || this.bot;
    }
  }

  step(dt: number, inp: Input): Ev[] {
    const ev: Ev[] = [];
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n && !this.r.done; i++) {
      this.tick(h, inp, ev, i === 0);
      // a Star Hop or a teleport can carry Rollo over the finish line in one go, so the "crossed it this tick" check
      // never sees it — then he ran on past the end of the road for ever. Past the line and still running = he got there.
      const g = this.goalObj;
      if (g && !this.r.done && this.r.s > g.s + 0.05) this.atGoal(ev);
    }
    return ev;
  }

  private tick(dt: number, inp: Input, ev: Ev[], first: boolean) {
    const r = this.r, st = this.st, tr = this.tr, mv = st.moves;
    r.time += dt;
    const seg = tr.segAt(r.s);
    const hold = seg.hold ?? 0;
    // ---- timers
    r.turbo = Math.max(0, r.turbo - dt); r.stun = Math.max(0, r.stun - dt); r.blink = Math.max(0, r.blink - dt); r.magnet = Math.max(0, r.magnet - dt);
    r.dash = Math.max(0, r.dash - dt); r.slowmo = Math.max(0, r.slowmo - dt); r.heat = Math.max(0, r.heat - dt * 0.25);
    if (r.rush > 0) { r.rush = Math.max(0, r.rush - dt); if (r.rush === 0) ev.push({ t: "rush", on: false }); }
    for (const k of Object.keys(r.powers) as PowerKind[]) { const left = (r.powers[k] ?? 0) - dt; if (left <= 0) delete r.powers[k]; else r.powers[k] = left; }
    if (r.slide > 0) { r.slide = Math.max(0, r.slide - dt); if (r.slide === 0 && !r.powers.snowball) { r.ball = false; ev.push({ t: "curl", on: false }); } }
    // ---- input (once per frame)
    const webbed = r.wiggle > 0;
    if (first && r.stun <= 0) {
      if (webbed && (inp.jump || inp.curl || inp.flick)) { r.wiggle--; ev.push({ t: "wiggle", left: r.wiggle }); }
      else {
        if (inp.curl) {
          if (r.air && mv.pound && !r.rail) { r.vh = Math.min(r.vh, -24); r.pound = true; r.ball = true; r.slide = 0.6; r.ballAt = r.time; ev.push({ t: "pound" }); }
          else if (mv.curl) { if (!r.ball) ev.push({ t: "curl", on: true }); r.ball = true; r.slide = 0.9; r.ballAt = r.time; }
        }
        if (inp.jump && !hold && !this.zones.has("goo")) this.jump(ev);
        if (inp.burst) this.tap(ev);
        if (inp.trick && r.air && mv.trick && r.trick < 3) { r.trick++; r.combo++; r.style += 20; r.boost = Math.min(1, r.boost + 0.15); ev.push({ t: "trick", n: r.trick }); }
        if (inp.flick && mv.flick && !r.air) { r.vu = inp.flick * 16; r.ut = r.u + inp.flick * 2.6; }
      }
    }
    // ---- a Star Hop flies straight at its target
    if (r.homing) {
      const hm = r.homing, tgt = this.find(hm.id);
      hm.t += dt / 0.24;
      if (!tgt || tgt.gone) r.homing = null;
      else {
        const k = Math.min(1, hm.t), ts = this.sOf(tgt), tu = this.uOf(tgt), th = this.hOf(tgt) + (tgt.tall ?? 0.6) * 0.5;
        r.s = hm.s0 + (ts - hm.s0) * k; r.u = hm.u0 + (tu - hm.u0) * k; r.h = hm.h0 + (th - hm.h0) * k; r.ut = r.u;
        if (k >= 1) {
          r.homing = null; r.vh = 10; r.air = true; r.jumps = 1; r.combo++; r.style += 15;
          if (tgt.k === "bell") { r.bells++; tgt.gone = true; ev.push({ t: "item", o: tgt }); }
          else if (tgt.k === "balloon" || tgt.k === "drone" || tgt.k === "clanker" || tgt.k === "rollbot" || tgt.k === "hopper") { tgt.gone = true; r.bonks++; ev.push({ t: "bonk", o: tgt }); }
          else ev.push({ t: "hop", o: tgt });
          this.bossHop(tgt, ev);
        }
        return;
      }
    }
    // ---- speed
    const slope = tr.slope(r.s);
    const Z = this.zones;
    let target = st.run;
    if (r.turbo > 0 || Z.has("fast") || r.powers.shoes) target = st.turbo;
    if (r.rush > 0) target = st.run * 1.9;
    if (r.dash > 0) target = st.turbo * 1.15;
    if (Z.has("slow") || Z.has("mud")) target *= 0.62;
    if (Z.has("goo")) target *= 0.5;
    if (Z.has("headwind") && !r.ball) target *= 0.72;
    if (Z.has("underwater")) target *= 0.8;
    if (Z.has("light") === false && st.view?.dark && st.rules?.light) target *= 0.8;
    if (inp.brake && mv.brake) target *= 0.55;
    if (r.stun > 0) target = st.run * 0.55;
    if (webbed) target = 0;
    target += -slope * (r.ball ? 16 : 10);
    const k = target > r.v ? 2.4 : 3.2;
    r.v += (target - r.v) * Math.min(1, dt * k);
    if (hold) r.v = Math.max(r.v, hold);
    r.v = Math.max(webbed ? 0 : 4, r.v);
    const s0 = r.s;
    r.s += r.v * dt;
    // ---- steering (slippery floors steer late; belts, wind and pulls push)
    const W = tr.widthAt(r.s), fenced = seg.fence !== "none" || seg.tag === "loop" || seg.tag === "falls" || seg.tag === "tube" || seg.tag === "wall";
    const lim = W / 2 - 0.45;
    let lo = -lim, hi = lim;
    // lanes split by a divider
    for (const o of this.near(r.s)) {
      if (o.k !== "divider" || Math.abs(r.s - o.s) > (o.ds ?? 10)) continue;
      const half = (o.w ?? 0.3) + 0.45;
      if (r.u >= o.u) lo = Math.max(lo, o.u + half); else hi = Math.min(hi, o.u - half);
    }
    if (r.rail) { r.ut = r.u; }
    r.ut = Math.max(lo, Math.min(hi, inp.ut));
    if (r.rail && Math.abs(inp.ut - r.u) > 1.6 && first) { this.leaveRail(ev); r.vh = 7; r.vu = Math.sign(inp.ut - r.u) * 9; r.ut = inp.ut; }
    const slip = (Z.has("ice") && !r.powers.skates) || Z.has("rain") ? 3 : Z.has("oil") ? 0.3 : 14;
    const want = r.stun > 0 || r.rail ? 0 : Math.max(-STEER, Math.min(STEER, (r.ut - r.u) * 9));
    r.vu += (want - r.vu) * Math.min(1, dt * slip);
    let push = 0;
    for (const o of this.near(r.s)) {
      if (o.k !== "zone" || o.gone || !o.push || !this.inZone(o)) continue;
      if ((o.zone === "belt" || o.zone === "wind") && this.on(o)) push += o.push;
      if (o.zone === "pull") push += Math.sign(this.uOf(o) - r.u) * Math.abs(o.push);
    }
    r.u += (r.vu + push) * dt;
    if (fenced || lo > -lim || hi < lim) { if (r.u > hi) { r.u = hi; r.vu = Math.min(0, r.vu); } if (r.u < lo) { r.u = lo; r.vu = Math.max(0, r.vu); } }
    // ---- vertical
    if (r.carry) {
      r.h += (r.carry.h - r.h) * Math.min(1, dt * 3); r.vh = 0; r.air = true;
      if (r.s > r.carry.until) { r.carry = null; ev.push({ t: "carry", on: false }); }
    } else if (r.rail) {
      const rail = this.find(r.rail);
      if (!rail || r.s > rail.s + (rail.ds ?? 5)) this.leaveRail(ev);
      else { r.u = rail.u; r.h = rail.h; r.vh = 0; r.air = false; r.combo += 0; r.style += dt * 4; }
    } else {
      const ground = this.groundAt(r.s, r.u, r.h, W, fenced);
      const curv = hold || seg.tag === "loop" ? 0 : -(seg.pitch / seg.len);
      let g = G * (st.gravity ?? 1);
      if (Z.has("lowg")) g *= 0.4;
      if (Z.has("underwater")) g *= 0.5;
      if (r.rush > 0 && st.moves.leap) g *= 0.6;
      if ((r.powers.cape || r.powers.wings) && r.vh < 0) g *= 0.22;
      if (r.powers.rocket) g = 0;
      if (Z.has("updraft") && r.air) g -= 46;
      if (r.air) {
        r.vh += (-g + r.v * r.v * Math.max(0, curv)) * dt;
        if (r.powers.rocket) r.vh = (2.2 - r.h) * 3;
        const before = r.h;
        r.h += r.vh * dt;
        // grab a rail from above
        if (r.vh <= 0) for (const o of this.near(r.s)) {
          if (o.k !== "rail" || o.gone || Math.abs(r.s - o.s) > (o.ds ?? 5) || Math.abs(r.u - o.u) > 0.7) continue;
          if (before >= o.h - 0.1 && r.h <= o.h + 0.05) { r.rail = o.id; r.h = o.h; r.u = o.u; r.vh = 0; r.air = false; r.jumps = 0; ev.push({ t: "rail", on: true }); break; }
        }
        if (!r.rail && r.vh <= 0 && ground > -1e6 && r.h <= ground && before >= ground - 0.5) this.land(ev, ground);
      } else {
        if (ground < r.h - 0.05) { r.air = true; r.vh = 0; }
        else {
          r.h = ground;
          if (r.v * r.v * curv > g) { r.air = true; r.vh = 1.5; }
          if (Z.has("bounce") || r.powers.bouncy || r.powers.autohop) { r.vh = r.powers.autohop ? JUMP_V : 12; r.air = true; r.jumps = 1; ev.push({ t: "jump", double: false }); }
        }
      }
      // water: run fast or sink
      if (Z.has("water") && !r.air && !r.powers.water && !r.powers.board) {
        if (r.v < st.run * 1.12 && !(st.moves.skip && r.turbo > 0)) { r.sink += dt; if (r.sink > 0.5) { r.sink = 0; this.respawn(ev, true); return; } }
        else r.sink = 0;
      } else r.sink = 0;
    }
    if (r.h < -7) { this.respawn(ev, true); return; }
    // ---- objects
    Z.clear();
    this.touch(s0, r.s, ev);
    const zn = (Z.size ? [...Z][0] : "") as ZoneKind | "";
    if (zn !== this.lastZone) { this.lastZone = zn; r.zone = zn; ev.push({ t: "zone", z: zn }); }
    if (Z.has("hot") && r.v < st.run * 0.7) this.hit(null, "hot", ev);
    if (this.boss) this.bossTick(dt, ev);
    this.rules(dt, ev);
    // ---- drifting through tight turns charges a boost
    if (mv.drift) {
      const yawRate = Math.abs(seg.yaw / seg.len);
      if (yawRate > 0.02 && Math.abs(r.ut - r.u) > 0.8 && !r.air) r.drift = Math.min(3, r.drift + dt);
      else if (r.drift > 0.6) { r.turbo = Math.max(r.turbo, r.drift); r.drift = 0; ev.push({ t: "turbo" }); }
      else r.drift = 0;
    }
    // ---- the boost meter: Moon Rush once it is learned, else Turbo (until Burst is learned)
    if (r.boost >= 1) {
      if (mv.rush) { r.boost = 0; r.rush = 4; ev.push({ t: "rush", on: true }); }
      else if (this.know.has("S04") && !mv.burst) { r.boost = 0; r.turbo = Math.max(r.turbo, 2.5); ev.push({ t: "turbo" }); }
    }
  }

  private jump(ev: Ev[]) {
    const r = this.r;
    if (r.rail) { this.leaveRail(ev); r.vh = JUMP_V; r.air = true; r.jumps = 1; ev.push({ t: "jump", double: false }); return; }
    if (!r.air) { r.vh = JUMP_V * (r.powers.mini ? 0.85 : 1); r.air = true; r.jumps = 1; r.ball = false; r.slide = 0; ev.push({ t: "jump", double: false }); }
    else if (this.st.moves.double && r.jumps === 1) { r.vh = DOUBLE_V; r.jumps = 2; ev.push({ t: "jump", double: true }); }
  }
  /** a tap: Star Hop if a target glows, tail whip if something is in reach, air dash in the air, else a Burst */
  private tap(ev: Ev[]) {
    const r = this.r, mv = this.st.moves;
    if (mv.hop) {
      const t = this.hopTarget();
      if (t) { r.homing = { id: t.id, t: 0, s0: r.s, u0: r.u, h0: r.h }; r.rail = 0; ev.push({ t: "hop", o: t }); return; }
    }
    if (mv.whip) {
      for (const o of this.near(r.s)) {
        if (o.gone || !(o.k === "crate" || o.k === "cage" || o.k === "bell" || (o.k === "item" && o.item === "chest"))) continue;
        const d = this.sOf(o) - r.s;
        if (d > -0.5 && d < 3 && Math.abs(this.uOf(o) - r.u) < 2.2 && o.p !== 1) { o.gone = true; if (o.k === "bell") r.bells++; ev.push({ t: "smash", o }); return; }
      }
    }
    if (r.air && mv.dash && r.dash <= 0) { r.dash = 0.45; r.vh = Math.max(r.vh, 2); ev.push({ t: "dash" }); return; }
    if (mv.burst && r.boost >= 0.34 && r.heat < 2.5) { r.boost -= 0.34; r.turbo = Math.max(r.turbo, 1.6); if (this.know.has("S18")) r.heat += 1; ev.push({ t: "burst" }); }
  }
  /** the best Star Hop target ahead (within 11 m, in front, above the ground) */
  hopTarget(): Obj | null {
    const r = this.r;
    let best: Obj | null = null, bd = 1e9;
    for (const o of this.near(r.s)) {
      if (o.gone || !o.target) continue;
      const d = this.sOf(o) - r.s;
      if (d < 1 || d > 11) continue;
      const du = Math.abs(this.uOf(o) - r.u);
      if (du > 4.5) continue;
      if (d + du < bd) { bd = d + du; best = o; }
    }
    return best;
  }
  private land(ev: Ev[], ground: number) {
    const r = this.r;
    const vh = r.vh;
    r.h = ground; ev.push({ t: "land", vh }); r.vh = 0; r.air = false; r.jumps = 0; r.dash = 0;
    if (this.underfoot && !this.landedOn.has(this.underfoot.id)) this.landedOn.set(this.underfoot.id, r.time);
    if (r.trick > 0) { r.boost = Math.min(1, r.boost + 0.1 * r.trick); r.pearls += 3 * r.trick; }
    r.trick = 0;
    if (r.pound) { r.pound = false; this.poundAt(ev); }
    if ((this.st.rules?.softLand || this.st.rules?.egg) && vh < -19.5) this.fail("hard landing", ev);
  }
  private poundAt(ev: Ev[]) {
    const r = this.r;
    for (const o of this.near(r.s)) {
      if (o.gone || Math.abs(this.sOf(o) - r.s) > (o.ds ?? 1) + 0.8 || Math.abs(this.uOf(o) - r.u) > (o.w ?? 1) + 0.6) continue;
      if (o.k === "plate") { o.gone = true; r.switches |= 1 << (o.group ?? 0); if (o.launch) { r.vh = o.launch[0]; r.air = true; r.jumps = 1; } ev.push({ t: "switch", o }); }
      if (o.k === "crate" && o.p !== 1) { o.gone = true; ev.push({ t: "smash", o }); }
    }
  }
  private leaveRail(ev: Ev[]) { const r = this.r; if (!r.rail) return; r.rail = 0; r.air = true; ev.push({ t: "rail", on: false }); }
  private find(id: number) { return this.st.objs.find((o) => o.id === id) ?? this.dyn.find((o) => o.id === id); }

  /** the floor under (s, u) for a runner whose feet are at h: the track (unless a gap / off the edge) or a ledge */
  groundAt(s: number, u: number, h: number, W = this.tr.widthAt(s), fenced = true) {
    let g = this.tr.segAt(s).gap || (!fenced && Math.abs(u) > W / 2 + 0.15) ? -1e9 : 0;
    this.underfoot = null;
    for (const o of this.near(s)) {
      if (o.gone) continue;
      if (o.k === "zone" && o.zone === "crumble" && this.inZoneAt(o, s, u) && this.r.s - s > 2.5 && !this.r.powers.board) g = -1e9;
      if (o.k !== "platform" && o.k !== "ramp") continue;
      if (o.need && !this.needMet(o.need)) continue;
      const ou = this.uOf(o), oh = o.k === "ramp" ? o.h * Math.max(0, Math.min(1, (s - (o.s - (o.ds ?? 3))) / (2 * (o.ds ?? 3)))) : this.platH(o);
      if (Math.abs(s - o.s) <= (o.ds ?? 1) && Math.abs(u - ou) <= (o.w ?? 1) && h >= oh - (o.k === "ramp" ? 1.5 : 0.4) && oh >= g) { g = oh; this.underfoot = o; }
    }
    return g;
  }
  /** a ledge's height now (falling ledges drop after you land) */
  private platH(o: Obj) {
    let h = this.hOf(o);
    const t = this.landedOn.get(o.id);
    if (t !== undefined && o.look === "fall") h -= Math.max(0, this.r.time - t - 0.5) * 9;
    return h;
  }
  private inZone(o: Obj) { return this.inZoneAt(o, this.r.s, this.r.u); }
  private inZoneAt(o: Obj, s: number, u: number) { return Math.abs(s - o.s) <= (o.ds ?? 3) && Math.abs(u - this.uOf(o)) <= (o.w ?? 2); }
  private near(s: number): Obj[] {
    const a = this.st.objs;
    while (this.lo < a.length && a[this.lo].s + 80 < s) this.lo++;
    while (this.lo > 0 && a[this.lo - 1].s + 80 >= s) this.lo--;
    const out: Obj[] = [];
    for (let i = this.lo; i < a.length && a[i].s - 80 < s; i++) out.push(a[i]);
    for (const o of this.dyn) if (Math.abs(o.s - s) < 80) out.push(o);
    return out;
  }

  private touch(s0: number, s1: number, ev: Ev[]) {
    const r = this.r, st = this.st;
    const top = r.h + this.height;
    const wide = r.powers.giant ? 1.2 : 0;
    // friends and thieves run on their own
    for (const o of this.dyn) if (o.pace && !o.gone && r.s > o.s - 40) o.s += o.pace * st.run * (1 / 120);
    for (const o of this.near(s1)) {
      if (o.gone) continue;
      const os = this.sOf(o);
      // things we passed
      if (os < s0 - 1.2 && o.k !== "zone" && o.k !== "rail" && o.k !== "divider" && o.k !== "platform") {
        if (o.k === "pearl" && os > s0 - 1.2 - r.v / 60) { r.streak = 0; }
        continue;
      }
      // ---- zones: footprint only
      if (o.k === "zone") {
        if (this.inZone(o) && this.on(o) && (r.h < 0.6 || AIR_ZONES.has(o.zone!))) {
          const z = o.zone!;
          if (z === "lava" && !r.powers.fire) this.hit(o, "lava", ev);
          else if (z === "zap" && !r.powers.thunder) this.hit(o, "zap", ev);
          else if (z === "web" && r.wiggle === 0 && !r.ball && !r.powers.giant) { r.wiggle = 3; o.gone = true; ev.push({ t: "wiggle", left: 3 }); }
          else if (z === "shrink") r.powers.mini = Math.max(r.powers.mini ?? 0, 4);
          else this.zones.add(z);
        }
        continue;
      }
      // ---- markers you only have to pass
      const passed = os <= s1 && os > s0;
      if (o.k === "lamp" || o.k === "pearlGate" || o.k === "goal" || o.k === "tele") {
        if (!passed) continue;
      }
      if (o.k === "lamp" && passed) { o.gone = true; r.check = st.checks.indexOf(o.s); this.pearlsAtCheck = r.pearls; ev.push({ t: "check", i: r.check }); continue; }
      if (o.k === "pearlGate" && passed) {
        const ok = this.bot || r.pearls - this.pearlBase >= (o.p ?? 0);
        ev.push({ t: "gate", ok, o });
        if (!ok) { this.respawn(ev, false); return; }
        o.gone = true; continue;
      }
      if (o.k === "goal" && passed) { this.atGoal(ev); continue; }
      if (o.k === "cam" || o.k === "sign" || o.k === "rail" || o.k === "divider" || o.k === "platform" || o.k === "ramp" || o.k === "friend" || o.k === "witch") continue;
      if (o.k === "lantern") { if (Math.abs(os - r.s) < 2.5 && Math.abs(this.uOf(o) - r.u) < 3) { o.gone = true; r.lanterns++; ev.push({ t: "item", o }); } continue; }
      if (o.k === "tele" && passed && Math.abs(this.uOf(o) - r.u) < (o.w ?? 1.2) + 0.4) { r.s += o.p ?? 30; ev.push({ t: "tele", o }); return; }
      if (o.k === "hoop") {
        if (passed && Math.abs(this.uOf(o) - r.u) < 1.4 && Math.abs(this.hOf(o) - (r.h + 0.6)) < 1.5) {
          o.gone = true; r.turbo = Math.max(r.turbo, 1.2); r.boost = Math.min(1, r.boost + 0.12); r.style += 10; r.combo++; ev.push({ t: "hoop", o });
        }
        continue;
      }
      // ---- pearls (and the magnet's pull)
      if (o.k === "pearl" || o.k === "bigPearl" || o.k === "medal") {
        const reach = (r.magnet > 0 || r.powers.buddy) && o.k !== "medal" ? 6 : r.powers.giant ? 1.8 : 0.95;
        const ou = this.uOf(o), oh = this.hOf(o);
        if (!this.on(o)) continue;
        if (Math.abs(os - r.s) < reach + 0.3 && Math.abs(ou - r.u) < reach && oh > r.h - 0.6 && oh < top + 0.7 + (r.magnet > 0 ? 3 : 0)) {
          o.gone = true;
          const x2 = r.powers.double ? 2 : 1;
          if (o.k === "pearl") {
            r.pearls += x2; r.streak++;
            if (this.know.has("S04")) r.boost = Math.min(1, r.boost + 0.025);
            if (this.know.has("S01") && r.streak % 20 === 0) { r.turbo = Math.max(r.turbo, 1.6); ev.push({ t: "turbo" }); }
            if (r.pearls % 100 < x2 && r.scales < MAX_SCALES) r.scales++;
            ev.push({ t: "pearl", o, streak: r.streak });
          } else if (o.k === "bigPearl") { r.pearls += 10 * x2; r.boost = Math.min(1, r.boost + 0.12); ev.push({ t: "bigPearl", o }); }
          else { r.medals++; ev.push({ t: "medal", o }); }
        }
        continue;
      }
      // ---- everything else needs the boxes to touch
      const ds = o.ds ?? 0.45;
      const inS = os - ds - 0.35 <= s1 && os + ds + 0.35 >= s0;
      if (!inS) continue;
      const ou = this.uOf(o), oh = this.hOf(o);
      const inU = Math.abs(ou - r.u) < (o.w ?? 0.5) + 0.42 + wide;
      if (!inU) continue;
      const otop = oh + (o.tall ?? 0.6);
      const inH = r.h < otop && top > oh;
      const active = this.on(o);
      switch (o.k) {
        case "pad": if (r.h < 0.4) { o.gone = true; r.turbo = Math.max(r.turbo, 2.2); r.v = Math.max(r.v, st.turbo); if (this.know.has("S17")) { r.combo++; if (r.combo % 3 === 0) r.turbo = 4; } ev.push({ t: "pad", o }); } break;
        case "spring": case "trickRamp": case "cannon": case "pole": case "geyser": case "balloon":
          if (!active) break;
          if (o.k === "balloon") { if (inH && r.air && r.vh < 0) { o.gone = true; r.vh = o.p ?? 14; r.jumps = 1; r.bonks++; ev.push({ t: "bonk", o }); } break; }
          if (r.h < (o.k === "geyser" ? 1.2 : 0.5) + (o.k === "cannon" || o.k === "pole" ? 1.5 : 0) && !(r.air && r.vh > 0)) {
            const L = o.launch ?? [o.p ?? 17, 0, 0];
            r.vh = L[0]; r.air = true; r.jumps = 1; r.ball = o.k === "cannon"; r.slide = o.k === "cannon" ? 0.9 : 0; r.trick = 0;
            if (L[1]) { r.turbo = Math.max(r.turbo, L[1]); r.v = Math.max(r.v, st.turbo); }
            if (L[2]) { r.vu = L[2]; r.ut = r.u + L[2] * 0.8; }
            ev.push({ t: o.k === "spring" || o.k === "trickRamp" ? "spring" : "launch", o });
          }
          break;
        case "sideSpring": case "bumper":
          if (r.h < 1.2 && !(r.air && r.vh > 0 && o.k === "sideSpring")) {
            const p = o.k === "bumper" ? Math.sign(r.u - ou || 1) * Math.abs(o.push ?? 10) : o.p ?? 9;
            r.vu = p; r.ut = r.u + p * 0.8; r.vh = o.k === "bumper" ? Math.max(r.vh, 4) : 6; r.air = true; r.jumps = 1; ev.push({ t: "side", o });
            if (o.k === "bumper") r.style += 5;
          }
          break;
        case "carry": if (!r.carry && r.h < 2) { r.carry = { until: os + (o.carry ?? 30), h: o.p ?? 4 }; r.ball = false; ev.push({ t: "carry", on: true }); } break;
        case "magnet": if (inH) { o.gone = true; r.magnet = 10; ev.push({ t: "magnet", o }); } break;
        case "item": if (inH || r.magnet > 0) this.pick(o, ev); break;
        case "power": if (inH) { o.gone = true; this.power(o, ev); } break;
        case "switch": case "plate":
          if (o.k === "plate" && o.look === "pound") break; // needs a ground pound (handled on landing)
          if (r.h < 0.6) { o.gone = true; r.switches |= 1 << (o.group ?? 0); if (o.item === "colour") r.colour = o.p ?? 0; if (o.launch) { r.vh = o.launch[0]; r.air = true; r.jumps = 1; } ev.push({ t: "switch", o }); }
          break;
        case "bell": if (inH) { o.gone = true; r.bells++; r.style += 10; ev.push({ t: "item", o }); } break;
        case "gate": case "door":
          if (o.need && this.needMet(o.need)) { o.gone = true; ev.push({ t: "open", o }); break; }
          if (!active) break;
          if (inH && !r.powers.ghost) { if (r.rush > 0 || r.powers.giant || r.powers.star) { o.gone = true; ev.push({ t: "smash", o }); } else this.hit(o, o.k, ev); }
          break;
        case "crate": case "cage": {
          if (!inH) break;
          const strong = r.rush > 0 || r.powers.giant || r.powers.star || (o.p === 1 ? r.turbo > 0 || r.dash > 0 : r.ball || r.turbo > 0);
          if (strong) { o.gone = true; ev.push({ t: "smash", o }); if (o.k === "cage") { r.pearls += 10; r.combo++; } }
          else this.hit(o, o.k, ev);
          break;
        }
        case "rollbot": case "hopper": case "drone": case "clanker": case "critter": {
          if (!inH || !active) break;
          if (o.look === "thief") { o.gone = true; r.bonks++; ev.push({ t: "bonk", o }); break; }
          if (o.harm === false) break;
          const strong = r.rush > 0 || r.powers.giant || r.powers.star || r.powers.snowball;
          if (strong || (r.ball && o.ballOk !== false)) { this.bonk(o, ev); break; }
          if (r.powers.thunder) { this.bonk(o, ev); break; }
          if (o.stomp !== false && r.air && r.vh < 0 && r.h > oh + (o.tall ?? 0.6) * 0.45) { this.bonk(o, ev); r.vh = o.look === "E15" ? 16 : 9; r.jumps = 1; break; }
          this.hit(o, o.k, ev);
          break;
        }
        default: {
          // generic hazards: spikes, walls, bars, lasers, fire, crushers, rollers, fallers, saws, mines, thorns, swings, bombs
          if (!inH || !active || !(HARM.has(o.k) || o.harm)) break;
          if (r.rush > 0 || r.powers.star || (r.powers.giant && o.k !== "laser")) { o.gone = true; ev.push({ t: "smash", o }); break; }
          if (r.powers.ghost && o.k === "wall") break;
          if (r.powers.fire && o.k === "fire") break;
          if (o.ballOk && (r.ball || r.turbo > 0) && o.k !== "bomb") { o.gone = true; ev.push({ t: "smash", o }); break; }
          if (o.stomp && r.air && r.vh < 0 && r.h > oh + (o.tall ?? 0.6) * 0.5) { this.bonk(o, ev); r.vh = 9; break; }
          this.hit(o, o.k, ev);
          break;
        }
      }
    }
  }
  private bonk(o: Obj, ev: Ev[]) {
    const r = this.r;
    o.gone = true; r.bonks++; r.combo++; r.style += 12; r.boost = Math.min(1, r.boost + 0.1);
    ev.push({ t: "bonk", o });
    if (this.st.rules?.noBonk) this.fail("you bonked a Clanker", ev);
  }
  private pick(o: Obj, ev: Ev[]) {
    const r = this.r;
    o.gone = true;
    switch (o.item) {
      case "letter": r.letters++; break;
      case "shard": r.shards++; break;
      case "chest": r.pearls += 15; break;
      case "fruit": r.boost = 1; break;
      case "time": r.timeLeft += 5; break;
      case "key": r.keys++; break;
      case "clover": r.pearls += 25; break;
      case "gold": r.pearls += 50; break;
      case "colour": r.colour = o.p ?? 0; break;
      case "life": r.hearts++; this.lives = Math.min(9, this.lives + 1); break;
      case "coin": r.coins++; break;
      case "mystery": { const opts: PowerKind[] = ["shield", "double", "shoes", "star", "buddy", "cape"]; const p = opts[(o.id * 7) % opts.length]; r.powers[p] = POWER_TIME[p]; ev.push({ t: "power", o, p }); break; }
      default: break;
    }
    ev.push({ t: "item", o });
  }
  private power(o: Obj, ev: Ev[]) {
    const r = this.r, p = o.power ?? "shield";
    if (p === "scale") r.scales = Math.min(MAX_SCALES, r.scales + 1);
    else if (p === "time") r.timeLeft += 10;
    else if (p === "mega") r.boost = 1;
    else if (p === "storm") { for (let i = 0; i < 16; i++) this.spawn({ k: "pearl", s: r.s + 6 + i * 2.2, u: Math.sin(i * 1.7) * 2.2, h: 0.9 }); }
    else if (p === "slowmo") r.slowmo = 5;
    else r.powers[p] = POWER_TIME[p];
    if (p === "snowball") { r.ball = true; r.slide = 8; }
    ev.push({ t: "power", o, p });
  }

  private hit(o: Obj | null, why: string, ev: Ev[]) {
    const r = this.r;
    if (r.blink > 0) return;
    // scale guard: curled just before the hit
    if (this.st.moves.guard && r.ball && r.time - r.ballAt < 0.3 && why !== "lava" && why !== "zap") { r.blink = 0.6; r.vh = Math.max(r.vh, 6); r.air = true; ev.push({ t: "guard" }); return; }
    if (r.powers.shield) { delete r.powers.shield; r.blink = 1; ev.push({ t: "guard" }); return; }
    r.hits++; r.combo = 0;
    ev.push({ t: "hit", o, why });
    if (this.bot) { r.fell = true; return; }
    const R = this.st.rules;
    if (R?.noHit || R?.escort || R?.egg) { this.fail(R.escort ? "Momo fell off" : R.egg ? "the egg cracked" : "no bumps allowed", ev); return; }
    if (r.scales <= 0) {
      // a saved life: armour back on, right here
      if (this.lives > 0) { this.lives--; r.scales = MAX_SCALES; r.stun = 0.4; r.blink = 2.2; r.v = Math.min(r.v, this.st.run * 0.6); ev.push({ t: "life" }); return; }
      this.respawn(ev, false, true); return;
    }
    r.scales--; r.stun = 0.55; r.blink = 1.6; r.v = Math.min(r.v, this.st.run * 0.5); r.streak = 0;
    r.ball = false; r.slide = 0; r.rail = 0; r.homing = null;
    if (o && (o.k === "wall" || o.k === "crate" || o.k === "door" || o.k === "gate")) { r.vh = Math.max(r.vh, 4); r.air = true; }
  }
  private fail(why: string, ev: Ev[]) {
    const r = this.r;
    if (this.bot) { r.fell = true; r.failed = why; return; }
    r.failed = why;
    ev.push({ t: "fail", why });
    this.respawn(ev, false, true);
  }
  private atGoal(ev: Ev[]) {
    const r = this.r, R = this.st.rules;
    if (this.boss && this.boss.phase !== "down") return;
    if (!this.bot && R) {
      if (R.letters && r.letters < 5) { this.fail("spell R-O-L-L-O first", ev); return; }
      if (R.medals && r.medals < 3) { this.fail("find all three Moon Medals", ev); return; }
      if (R.bonkAll && r.bonks < R.bonkAll) { this.fail(`bonk ${R.bonkAll} Clankers`, ev); return; }
      if (R.lanterns && r.lanterns < R.lanterns) { this.fail(`light ${R.lanterns} lanterns`, ev); return; }
      if (R.combo && r.style < R.combo) { this.fail("build a bigger combo", ev); return; }
      if (R.thief && !this.dyn.some((o) => o.look === "thief" && o.gone)) { this.fail("the thief got away", ev); return; }
    }
    if (R?.race && r.rival > r.s) { this.fail(R.race === "ghost" ? "the ghost won" : "the rival won", ev); return; }
    r.done = true; ev.push({ t: "goal" });
  }
  /** clocks, minimum speed, chasers and races */
  private rules(dt: number, ev: Ev[]) {
    const r = this.r, st = this.st, R = st.rules;
    if (R?.time) { r.timeLeft -= dt; if (r.timeLeft <= 0) { r.timeLeft = 0; this.fail("out of time", ev); return; } }
    if (R?.sprint && r.check === st.checks.length - 1) { if (r.timeLeft <= 0) r.timeLeft = R.sprint; r.timeLeft -= dt; if (r.timeLeft <= 0) { this.fail("too slow at the end", ev); return; } }
    if (R?.minSpeed && r.time > 3 && r.v < R.minSpeed && r.stun <= 0 && !r.air) { this.fail("too slow", ev); return; }
    const c = st.chase;
    if (c && r.s > c.from && r.s < c.to) {
      r.chase += (r.v - c.speed * st.run) * dt;
      r.chase = Math.min(c.gap * 1.6, r.chase);
      if (r.chase < 2) { ev.push({ t: "caught" }); r.chase = c.gap; this.hit(null, "caught", ev); }
    }
    if (st.rival) r.rival += st.rival.speed * st.run * dt;
  }

  /** back to the last lamp (falls cost a scale; running out of scales refills them) */
  respawn(ev: Ev[], fell: boolean, refill = false) {
    const r = this.r, st = this.st;
    if (this.bot) { r.fell = true; r.done = true; return; }
    if (this.oneRun && this.lives <= 0 && (refill || (fell && r.scales <= 1))) { r.out = true; r.done = true; r.v = 0; ev.push({ t: "out" }); return; }
    let at = r.check >= 0 ? st.checks[r.check] : 2;
    // a fall with a saved life: back just before the drop, not to the lantern
    if (fell && this.lives > 0) {
      let s = r.s - 22;
      while (s > at + 2 && (this.tr.segAt(s).gap || this.tr.segAt(s + 3).gap || this.tr.segAt(s - 3).gap)) s -= 4;
      if (s > at + 2) { this.lives--; at = s; ev.push({ t: "life" }); }
    }
    for (const o of st.objs) if (o.s > at && o.k !== "lamp") o.gone = false;
    this.dyn = this.dyn.filter((o) => o.pace).map((o) => { const base = st.objs.find((x) => x.id === o.id); return base ? { ...base, s: Math.max(base.s, at + 20) } : o; });
    this.landedOn.clear();
    r.pearls = this.pearlsAtCheck; r.streak = 0;
    r.s = at; r.u = 0; r.ut = 0; r.h = 0; r.vh = 0; r.vu = 0; r.air = false; r.ball = false; r.slide = 0;
    r.v = st.run * 0.6; r.turbo = 0; r.stun = 0; r.blink = 1.8; r.trick = 0; r.rail = 0; r.homing = null; r.carry = null; r.wiggle = 0; r.dash = 0;
    r.scales = refill ? MAX_SCALES : fell ? Math.max(1, r.scales - 1) : r.scales;
    if (st.rules?.time) r.timeLeft = Math.max(r.timeLeft, st.rules.time * 0.5);
    if (st.chase) r.chase = st.chase.gap;
    if (st.rival) r.rival = at + st.rival.lead;
    if (this.boss && this.boss.phase !== "down") { this.boss.phase = "recover"; this.boss.next = 2; this.boss.ahead = 40; }
    this.lo = 0;
    ev.push({ t: "fall" });
  }

  // ---------------------------------------------------------------- bosses (one engine, 25 bosses)
  private spawn(o: Omit<Obj, "id">) { const x = { ...o, id: this.nextId++ } as Obj; this.dyn.push(x); return x; }
  private bossHop(tgt: Obj, ev: Ev[]) {
    const b = this.boss;
    if (!b || tgt.look !== "weak" || b.phase !== "tired") return;
    this.bossHit(ev);
  }
  private bossHit(ev: Ev[]) {
    const b = this.boss!, r = this.r, st = this.st;
    b.hp--; r.vh = 10; r.air = true; r.jumps = 1;
    ev.push({ t: "boss", what: b.hp <= 0 ? "down" : "hit", kind: b.kind });
    if (b.hp <= 0) {
      b.phase = "down";
      const goal = st.objs.find((o) => o.k === "goal");
      if (goal) { goal.s = r.s + 90; goal.gone = false; }
      for (let i = 0; i < 12; i++) this.spawn({ k: "pearl", s: r.s + 12 + i * 3, u: Math.sin(i) * 2, h: 1 + (i % 3) });
      return;
    }
    b.phase = "recover"; b.next = 1.6; b.ahead = 8;
  }
  private bossTick(dt: number, ev: Ev[]) {
    const b = this.boss!, r = this.r, st = this.st, spec = st.boss!;
    b.t += dt; b.next -= dt;
    this.dyn = this.dyn.filter((o) => (o.s > r.s - 20 && !o.gone) || o.pace);
    const W = this.tr.widthAt(r.s), half = W / 2 - 0.9;
    const R = Math.max(st.run * 1.0, 14);
    if (b.phase === "down") { b.ahead += dt * 30; return; }
    if (b.phase === "intro") { b.ahead += (26 - b.ahead) * Math.min(1, dt * 1.5); if (b.next <= 0) { b.phase = "attack"; b.next = 0.5; } return; }
    if (b.phase === "recover") { b.ahead += (26 - b.ahead) * Math.min(1, dt * 2); if (b.next <= 0) { b.phase = "attack"; b.next = 0.6; } return; }
    if (b.phase === "tired") {
      b.ahead = b.at - r.s;
      if (spec.weak === "hop") return; // hit by a Star Hop on the weak spot (bossHop)
      if (b.ahead < 1.2) {
        const near = Math.abs(r.u - b.u) < 2.2;
        const good = spec.weak === "ball" ? r.ball && near : spec.weak === "spring" ? r.h > 3 && near : (r.turbo > 0 || r.dash > 0 || r.rush > 0) && near;
        if (good) { this.bossHit(ev); return; }
        ev.push({ t: "boss", what: "miss", kind: b.kind }); if (near && spec.weak === "ball") this.hit(null, "boss", ev);
        b.phase = "recover"; b.next = 1.6; b.ahead = 8;
      }
      if (b.ahead < -6) { b.phase = "recover"; b.next = 1.6; b.ahead = 8; }
      return;
    }
    // attacking: run ahead and throw things into the path
    b.ahead += (26 - b.ahead) * Math.min(1, dt * 2);
    b.u = Math.sin(b.t * 0.6) * half * 0.6;
    if (b.next > 0) return;
    b.cycle++;
    ev.push({ t: "boss", what: "attack", kind: b.kind });
    const at = r.s + R + 8;
    if (b.cycle % 4 === 0) {
      // worn out: the weak spot waits ahead
      b.phase = "tired"; b.at = r.s + R + 22; b.u = 0;
      if (spec.weak === "spring") this.spawn({ k: "spring", s: b.at - Math.max(10, st.run * 0.75), u: 0, h: 0, p: 17 });
      if (spec.weak === "burst") { for (let i = 0; i < 10; i++) this.spawn({ k: "pearl", s: r.s + 6 + i * 2, u: 0, h: 0.9 }); r.boost = Math.max(r.boost, 0.4); }
      if (spec.weak === "hop") this.spawn({ k: "clanker", s: b.at, u: 0, h: 2.6, ds: 0.6, w: 0.8, tall: 1, target: true, look: "weak", harm: false });
      ev.push({ t: "boss", what: "tired", kind: b.kind });
      return;
    }
    const atk = spec.attacks[(b.cycle - 1) % spec.attacks.length];
    this.attack(atk, at, W, half);
    b.next = Math.max(1.0, 2.2 - st.d * 0.5);
  }
  /** one boss attack: hazards dropped into the path ahead (always leaving a way through) */
  private attack(atk: string, at: number, W: number, half: number) {
    const gapU = ((this.r.time * 7.13) % 2 - 1) * half;
    switch (atk) {
      case "hurdle": this.spawn({ k: "wall", s: at, u: 0, h: 0, ds: 0.4, w: W / 2, tall: 0.65 }); break;
      case "bar": this.spawn({ k: "bar", s: at, u: 0, h: 0.95, ds: 0.25, w: W / 2, tall: 0.6 }); break;
      case "crates": for (let u = -W / 2 + 0.8; u < W / 2; u += 1.6) if (Math.abs(u - gapU) > 1.6) this.spawn({ k: "crate", s: at, u, h: 0, ds: 0.5, w: 0.7, tall: 0.9, ballOk: true }); break;
      case "spikes": { const side = gapU > 0 ? -1 : 1; this.spawn({ k: "spike", s: at, u: side * W * 0.25, h: 0, ds: 0.8, w: W * 0.25, harm: true }); break; }
      case "rollers": this.spawn({ k: "roller", s: at + 20, u: 0, h: 0, ds: 0.5, w: W / 2, tall: 0.7, roll: 0.4, harm: true }); break;
      case "fallers": for (let u = -W / 2 + 1; u < W / 2; u += 2.2) if (Math.abs(u - gapU) > 1.8) this.spawn({ k: "faller", s: at, u, h: 0, ds: 0.6, w: 0.7, tall: 0.9, drop: 22, harm: true }); break;
      case "lasers": for (let u = -W / 2 + 1; u < W / 2; u += 2) if (Math.abs(u - gapU) > 1.4) this.spawn({ k: "laser", s: at, u, h: 0, ds: 0.2, w: 0.9, tall: 2.2, harm: true }); break;
      case "gust": this.spawn({ k: "zone", s: at, u: 0, h: 0, ds: 8, w: W / 2, zone: "wind", push: (gapU > 0 ? -1 : 1) * 4 }); break;
      case "bombs": for (let i = 0; i < 3; i++) { const u = -half + ((i + 0.5) / 3) * 2 * half; if (Math.abs(u - gapU) > 1.4) this.spawn({ k: "bomb", s: at + i * 4, u, h: 0, ds: 0.5, w: 0.6, tall: 0.8, drop: 18, harm: true }); } break;
      case "zap": { const side = gapU > 0 ? -1 : 1; this.spawn({ k: "zone", s: at, u: side * W * 0.25, h: 0, ds: 3, w: W * 0.25, zone: "zap" }); break; }
      case "mines": for (let i = 0; i < 2; i++) this.spawn({ k: "mine", s: at + i * 6, u: (i ? 1 : -1) * half * 0.6, h: 0.3, ds: 0.5, w: 0.6, tall: 0.8, harm: true }); break;
      case "drones": this.spawn({ k: "drone", s: at, u: 0, h: 1.55, ds: 0.5, w: 0.7, tall: 0.7, amp: half * 0.8, ph: this.r.time, freq: 0.1 }); this.spawn({ k: "wall", s: at, u: 0, h: 0, ds: 0.3, w: W / 2, tall: 0.5 }); break;
      default: this.spawn({ k: "wall", s: at, u: 0, h: 0, ds: 0.4, w: W / 2, tall: 0.65 });
    }
  }
}
