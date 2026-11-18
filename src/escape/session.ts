// Momo Escape session: owns the canvas, the fixed-step simulation (60 ticks per second of game time, scaled by speed
// rushes / boosters / slow-mo), input (swipe, tap towards a spot, arrow keys / WASD — Momo only moves when the player
// says so), the building soundtracks, sound effects for every moment,
// and the endless supply of floors (built in a worker, three floors ahead).
import { audio, type Sound } from "@/lib/audio";
import { RollMusic } from "../roll/music";
import type { SongPlan, SongZone, SectionKind } from "../roll/types";
import { buildingOf } from "./data/buildings";
import { buildRoom, MODE_FLOORS, recipeFor, type EscapeMode, type FusionMemory, type ModeParams } from "./gen";
import { crushK, laserOn, pulseState, shots } from "./hazards";
import { EscapeRenderer } from "./render";
import { EscapeRenderer3D, type EscapeView, type Quality } from "./render3d";
import { EscapeSim, MAX_LIVES } from "./sim";
import { opp, TPS, U, type Dir, type Room, type SimEvent } from "./types";
import type { EscapeAsk, EscapeReply } from "./worker";

export type Phase = "count" | "play" | "over" | "done";
export interface EscapeHud {
  phase: Phase; count: number;
  floor: number; floorsDone: number; building: number; buildingName: string; emoji: string; roomName: string;
  lives: number; maxLives: number; coins: number; diamonds: number; roomDiamonds: number; buddies: number;
  speed: number; rush: number; boost: number; slowmo: number; shield: boolean; ghost: boolean; magnet: boolean;
  keyNeeded: boolean; hasKey: boolean; seconds: number; par: number; roomSeconds: number; moves: number;
}
export interface EscapeResult {
  mode: EscapeMode; completed: boolean; floorsDone: number; floor: number; building: number; coins: number; diamonds: number;
  buddies: number; seconds: number; deaths: number; concepts: string[]; fusions: { key: string; name: string; atoms: string[] }[]; series?: number; daily?: string;
}
export type SessionEvent =
  | { t: "building"; id: number; name: string; emoji: string }
  | { t: "speed"; tier: number }
  | { t: "life"; delta: number; lives: number }
  | { t: "power"; k: string }
  | { t: "key" } | { t: "switch" } | { t: "buddy" } | { t: "near" } | { t: "allDiamonds" }
  | { t: "floor"; n: number; name: string; fusion?: string; finale?: string };

export interface EscapeOptions {
  mode: EscapeMode;
  start: number;
  params: ModeParams;
  mem: FusionMemory;
  ch: { id: string; color: string };
  haptics: boolean; shake: boolean; reduced: boolean; kid: boolean;
  /** 3D graphics level (the 2D print look is the fallback when WebGL is missing) */
  quality?: Quality;
  onHud?: (h: EscapeHud) => void;
  onEvent?: (e: SessionEvent) => void;
  onEnd?: (r: EscapeResult) => void;
}

/** screen direction of a drag / tap offset (screen y grows downwards) */
const screenDir = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy < 0 ? 0 : 2);
const KEY_DIR: Record<string, Dir> = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["drop", 3], ["break", 1], ["verse", 2], ["chorus", 3]];

export class EscapeSession {
  readonly sim: EscapeSim;
  readonly r: EscapeView;
  private host: HTMLElement;
  private o: EscapeOptions;
  private music: RollMusic | null = null;
  private plan: SongPlan;
  private raf = 0;
  private last = 0;
  private acc = 0;
  phase: Phase = "count";
  private phaseT = 0;
  private count = 3;
  paused = false;
  private destroyed = false;
  private worker: Worker | null = null;
  private asked = 0;
  private nextN: number;
  private building = 0;
  speed = 1;
  private rush = 1;
  boostLeft = 0;
  slowLeft = 0;
  private tier = 1;
  private hudT = 0;
  private seconds = 0;
  private deaths = 0;
  private ro: ResizeObserver;
  private coinStreak = 0; private coinT = 0;
  private fusions: { key: string; name: string; atoms: string[] }[] = [];
  private concepts = new Set<string>();
  private lastSwitch = new Map<number, number>();
  private silentRoom = -1;
  private ending = false;

  constructor(host: HTMLElement, o: EscapeOptions) {
    this.host = host; this.o = o;
    let view: EscapeView;
    try { view = new EscapeRenderer3D(host, o.quality ?? "medium"); } catch { view = new EscapeRenderer(host); }
    this.r = view;
    const first = buildRoom(recipeFor(o.mode, o.start, o.params, o.mem), 6);
    // the title screen shows the first floor ticking away with Momo waiting in the hatch — nobody plays for the player
    this.sim = new EscapeSim(first, { lives: o.kid ? MAX_LIVES : 3, maxLives: MAX_LIVES, kid: o.kid });
    this.nextN = o.start + 1;
    this.plan = { bpm: 120, root: 48 + (o.start % 7), seed: 0x51a + o.start, zones: [], beats: 0 };
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const cv = this.r.cv;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointercancel", this.onCancel);
    cv.addEventListener("contextmenu", this.noMenu);
    window.addEventListener("keydown", this.onKey);
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
      this.worker.onmessage = (ev: MessageEvent<EscapeReply>) => this.onRoom(ev.data);
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; };
    } catch { this.worker = null; }
    this.want();
    if (o.mode !== "attract") {
      try { this.music = new RollMusic(this.plan, o.kid ? 0.85 : 1); } catch { this.music = null; }
    }
    this.enterBuilding(first.building, 0);
    if (o.mode === "attract") { this.phase = "play"; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- floors supply
  private maxFloor() { return this.o.start + MODE_FLOORS[this.o.mode] - 1; }
  private want() {
    const s = this.sim;
    const ahead = s.rooms.length - 1 - s.cur;
    if (ahead >= 3 || this.nextN > this.maxFloor() || this.asked) return;
    const top = s.rooms[s.rooms.length - 1];
    const ask: EscapeAsk = { id: this.nextN, mode: this.o.mode, n: this.nextN, params: { ...this.o.params, kid: this.o.kid }, inX: top.outX, mem: this.o.mem };
    if (this.worker) { this.asked = this.nextN; this.worker.postMessage(ask); }
    else this.onRoom({ id: ask.id, room: buildRoom(recipeFor(ask.mode, ask.n, ask.params, ask.mem), ask.inX) });
  }
  private onRoom(rep: EscapeReply) {
    if (this.destroyed) return;
    if (rep.id !== this.nextN) return;
    this.asked = 0;
    const top = this.sim.rooms[this.sim.rooms.length - 1];
    const room = rep.room ?? buildRoom(recipeFor(this.o.mode, rep.id, this.o.params, this.o.mem), top.outX);
    this.sim.add(room);
    this.nextN++;
    this.want();
  }
  /** never let Momo reach an exit with nothing above it */
  private ensureAbove() {
    const s = this.sim;
    if (s.cur < s.rooms.length - 1 || this.nextN > this.maxFloor()) return;
    const top = s.rooms[s.rooms.length - 1];
    if (s.r.y < (top.y0 + top.h * 0.55) * U) return;
    this.asked = 0;
    this.onRoom({ id: this.nextN, room: buildRoom(recipeFor(this.o.mode, this.nextN, { ...this.o.params, kid: this.o.kid }, this.o.mem), top.outX) });
  }

  // ---------------------------------------------------------------- music
  private enterBuilding(id: number, beat: number) {
    if (id === this.building) return;
    this.building = id;
    const B = buildingOf(id);
    const z = this.plan.zones;
    const from = Math.ceil(beat + 1);
    while (z.length && z[z.length - 1].beat0 >= from) z.pop();
    this.addZones(from, 12, B.style, B.mood);
    this.music?.setTempo((B.bpm / 120) * this.speed);
    if (this.o.mode !== "attract") {
      this.r.stamp(B.name.toUpperCase());
      this.o.onEvent?.({ t: "building", id, name: B.name, emoji: B.emoji });
    }
  }
  private addZones(from: number, n: number, style: string, mood: string) {
    let b = from;
    for (let i = 0; i < n; i++) {
      const [section, intensity] = SECTIONS[i % SECTIONS.length];
      const zone: SongZone = { beat0: b, beats: 16, mood, section, intensity, style };
      this.plan.zones.push(zone);
      b += 16;
    }
    this.plan.beats = b + 64;
  }

  // ---------------------------------------------------------------- input
  // Swipe anywhere: Momo dashes that way (keep the finger down and turn to queue the next dash). A plain tap moves him
  // towards the spot you tapped. Arrow keys / WASD on a keyboard. Directions are what the player SEES (mirror / flip
  // floors turn them back into world directions).
  private swipe: { id: number; x: number; y: number; last: number; fired: boolean } | null = null;
  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    audio.ensure(); void audio.resume();
    this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, last: -1, fired: false };
    try { this.r.cv.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  };
  private onMove = (e: PointerEvent) => {
    const s = this.swipe;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    const d = screenDir(dx, dy);
    s.x = e.clientX; s.y = e.clientY;
    if (d === s.last) return;
    s.last = d; s.fired = true;
    this.go(d);
  };
  private onUp = (e: PointerEvent) => {
    const s = this.swipe;
    if (!s || s.id !== e.pointerId) return;
    this.swipe = null;
    if (s.fired) return;
    const m = this.r.momoAt();
    if (!m) return;
    const b = this.r.cv.getBoundingClientRect();
    const dx = e.clientX - b.left - m.x, dy = e.clientY - b.top - m.y;
    if (Math.hypot(dx, dy) < 10) return;
    this.go(screenDir(dx, dy));
  };
  private onCancel = () => { this.swipe = null; };
  private noMenu = (e: Event) => e.preventDefault();
  private onKey = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.code];
    if (d === undefined || e.repeat || this.phase !== "play" || this.paused) return;
    e.preventDefault();
    audio.ensure(); void audio.resume();
    this.go(d);
  };
  /** a direction on screen → a dash in the world */
  private go(screen: Dir) {
    if (this.phase !== "play" || this.paused || this.o.mode === "attract") return;
    const rules = this.sim.room.rules;
    let d = screen;
    if (rules.flip) d = opp(d);
    if (rules.mirror && (d === 1 || d === 3)) d = opp(d);
    this.sim.move(d);
  }

  private resize() { const b = this.host.getBoundingClientRect(); this.r.resize(b.width, b.height); }

  pause() { if (this.paused) return; this.paused = true; this.music?.stop(0.2); }
  resume() {
    if (!this.paused) return;
    this.paused = false; this.last = performance.now();
    if (this.phase === "play") { this.phase = "count"; this.phaseT = 0; this.count = 3; }
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const fx = { speed: this.speed - 1, boost: this.boostLeft > 0, beat: this.music?.beatNow() ?? this.seconds * 2, shakeOn: this.o.shake, reduced: this.o.reduced, ch: this.o.ch };
    if (this.paused) { this.r.draw(this.sim, 0, 0, fx); return; }
    this.phaseT += dt;
    if (this.phase === "count") {
      const left = 3 - Math.floor(this.phaseT / 0.45);
      if (left !== this.count && left > 0) { this.count = left; this.sfx("tick", 0.5, 0, 1); }
      if (this.phaseT > 1.35) {
        this.phase = "play"; this.phaseT = 0; this.count = 0;
        this.sfx("a:go", 0.5);
        if (this.music && this.silentRoom !== this.sim.cur) this.music.start(this.music.beatNow());
      }
    } else if (this.phase === "play") {
      this.play(dt);
    }
    this.r.draw(this.sim, 0, dt, fx);
    this.hudT += dt;
    if (this.hudT > 0.09) { this.hudT = 0; this.pushHud(); }
  };

  private play(dt: number) {
    const s = this.sim;
    this.seconds += dt;
    // speed: base · rush floor · booster · slow-mo
    const room = s.room;
    this.rush += (room.rush - this.rush) * Math.min(1, dt * 1.8);
    if (this.boostLeft > 0) this.boostLeft = Math.max(0, this.boostLeft - dt);
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dt);
    const base = this.o.kid ? 0.75 : 1.08;
    this.speed = Math.min(2.2, base * this.rush * (this.boostLeft > 0 ? 1.4 : 1)) * (this.slowLeft > 0 ? 0.6 : 1) * (room.rules.water ? 0.82 : room.rules.lowg ? 0.9 : 1);
    const B = buildingOf(room.building);
    this.music?.setTempo((B.bpm / 120) * Math.max(0.6, Math.min(2.2, this.speed)));
    const tier = room.rush >= 1.9 ? 2 : room.rush >= 1.4 ? 1.5 : 1;
    if (tier !== this.tier) { this.tier = tier; this.o.onEvent?.({ t: "speed", tier }); if (tier > 1) this.sfx("whooshLong", 0.4); }
    // music zones keep coming
    if (this.music && this.music.beatNow() > this.plan.beats - 96) this.addZones(this.plan.beats - 64, 8, B.style, B.mood);
    // simulate
    this.acc += dt * TPS * this.speed;
    let steps = 0;
    while (this.acc >= 1 && steps < 10) {
      this.acc -= 1; steps++;
      const before = s.cur;
      this.hazardSounds();
      s.step();
      for (const e of s.drain()) this.handle(e);
      if (s.cur !== before) this.onFloor(before);
      if (s.dead || this.phase !== "play") { this.acc = 0; break; }
    }
    if (this.acc > 3) this.acc = 0;
    this.ensureAbove();
    if (this.coinT > 0) { this.coinT -= dt; if (this.coinT <= 0) this.coinStreak = 0; }
  }

  private onFloor(prev: number) {
    const s = this.sim, room = s.room, done = s.rooms[prev];
    for (const c of done.concepts) this.concepts.add(c);
    if (done.fusion) this.fusions.push(done.fusion);
    this.enterBuilding(room.building, this.music?.beatNow() ?? 0);
    this.o.onEvent?.({ t: "floor", n: room.n, name: room.name, fusion: room.fusion?.name, finale: room.finale });
    // silent floors drop the music
    if (room.rules.silent) { this.silentRoom = s.cur; this.music?.stop(0.6); }
    else if (this.silentRoom >= 0) { this.silentRoom = -1; this.music?.start(this.music.beatNow()); }
    this.want();
    // last floor of a fixed-length mode
    if (room.n > this.maxFloor()) this.finish(true);
  }

  private handle(e: SimEvent) {
    const s = this.sim;
    const pan = (x: number) => Math.max(-0.8, Math.min(0.8, (x / U - 6.5) / 7));
    const B = buildingOf(s.room.building);
    switch (e.t) {
      case "leap": this.r.leap(); this.r.dust(e.x, e.y, s.r.g, 5); this.sfx("hop", 0.32, pan(e.x), 1.05 + Math.random() * 0.15); this.buzz(6); break;
      case "land": this.r.land(); this.r.dust(e.x, e.y, e.g, 7); this.sfx("a:tink", 0.18, pan(e.x), 0.8 + Math.random() * 0.2); break;
      case "bump": this.r.nudge(); this.sfx("a:tink", 0.12, pan(e.x), 0.55); this.buzz(4); break;
      case "bounce": this.sfx("boing", 0.45); break;
      case "teleport": this.sfx("a:teleport", 0.45); this.r.sparkle(s.r.x, s.r.y, "#9b6bff", 16); break;
      case "pickup": {
        const y = e.y;
        switch (e.k) {
          case "coin": this.coinStreak = Math.min(16, this.coinStreak + 1); this.coinT = 0.9; this.sfx("a:coin", 0.32, pan(e.x), 1 + this.coinStreak * 0.035); this.r.sparkle(e.x, y, "#ffc533", 5); break;
          case "diamond": this.sfx("a:ding", 0.5, pan(e.x), 1.2); this.sfx("sparkle", 0.35); this.r.sparkle(e.x, y, B.inks.cool, 18, true); this.buzz([10, 30, 10]); if (e.n === 3) this.o.onEvent?.({ t: "allDiamonds" }); break;
          case "heart": case "vend": this.sfx("a:levelup", 0.45); this.r.sparkle(e.x, y, "#ff3d6e", 20, true); this.buzz([10, 30, 10]); break;
          case "booster": this.boostLeft = 30; this.sfx("a:rocket", 0.5); this.sfx("whooshLong", 0.4); this.r.sparkle(e.x, y, "#3dd8ff", 24, true); this.o.onEvent?.({ t: "power", k: "booster" }); this.buzz([20, 40, 20]); break;
          case "slowmo": this.slowLeft = 8; this.sfx("rewind", 0.4); this.o.onEvent?.({ t: "power", k: "slowmo" }); break;
          case "shield": case "ghost": case "magnet": this.sfx("a:twinkle", 0.45); this.o.onEvent?.({ t: "power", k: e.k }); break;
          case "key": this.sfx("a:tink", 0.5, 0, 1.4); this.sfx("a:doorOpen", 0.4); this.o.onEvent?.({ t: "key" }); break;
          case "switch": this.sfx("a:click", 0.5); this.sfx("lightsOff", 0.35); this.o.onEvent?.({ t: "switch" }); break;
          case "buddy": this.sfx("a:giggle", 0.5); this.r.sparkle(e.x, y, "#9be34a", 20, true); this.o.onEvent?.({ t: "buddy" }); break;
          case "plate": this.sfx("a:blip", 0.35, pan(e.x), 1.3); break;
        }
        break;
      }
      case "hit":
        this.r.hit(e.x, e.y, B.inks.hot);
        if (e.shield) { this.sfx("a:bubble", 0.55); this.buzz(20); }
        else { this.sfx("a:splat", 0.55, pan(e.x)); this.sfx("a:bonk", 0.4); this.buzz([50, 30, 70]); this.deaths++; }
        break;
      case "life": this.o.onEvent?.({ t: "life", delta: e.delta, lives: e.lives }); break;
      case "respawn": this.sfx("a:poof", 0.4); break;
      case "dead": this.sfx("sadtrombone", 0.45); this.music?.stop(0.5); this.finish(false); break;
      case "exit": this.sfx("a:doorClose", 0.28, 0, 1.2); this.sfx("clack", 0.25); break;
      case "nearmiss": this.sfx("whooshShort", 0.25); this.o.onEvent?.({ t: "near" }); break;
      default: break;
    }
  }

  /** hazards make noise when they fire / slam / spark near Momo */
  private hazardSounds() {
    if (this.o.mode === "attract") return;
    const s = this.sim, room = s.room, st = s.state;
    if (!st.active) return;
    const t = s.localT(s.cur);
    const lx = s.r.x, ly = s.r.y - room.y0 * U;
    for (const h of room.hazards) {
      let x = 0, y = 0, ev = false, name: Sound = "a:blip", gain = 0.2;
      switch (h.k) {
        case "turret": { const a = shots(h, t).length, b = shots(h, t + 1).length; if (b > a) { ev = true; x = (h.cx + 0.5) * U; y = (h.cy + 0.5) * U; name = h.skin === "ink" ? "a:plop" : "a:blip"; } break; }
        case "crusher": if (crushK(h, t + 1) >= 1 && crushK(h, t) < 1) { ev = true; x = h.x + h.ex; y = h.y + h.ey; name = "thud"; gain = 0.35; } break;
        case "laser": if (h.mode === "blink" && laserOn(h, t + 1) && !laserOn(h, t)) { ev = true; x = (h.ax + h.bx) / 2; y = (h.ay + h.by) / 2; name = "a:zap"; gain = 0.14; } break;
        case "pulse": if (pulseState(h, t + 1) === 2 && pulseState(h, t) !== 2) { ev = true; x = h.x + h.w / 2; y = h.y + h.h / 2; name = h.skin === "steam" ? "a:sizzle" : h.skin === "bolt" ? "a:zap" : "a:crunch"; gain = 0.3; } break;
        default: break;
      }
      if (!ev) continue;
      const d = Math.hypot(x - lx, y - ly) / U;
      if (d > 9) continue;
      const k = this.lastSwitch.get(h.id) ?? -99;
      if (t - k < 6) continue;
      this.lastSwitch.set(h.id, t);
      this.sfx(name, gain * (1 - d / 10), Math.max(-0.8, Math.min(0.8, (x - lx) / (7 * U))), 0.9 + Math.random() * 0.2);
    }
  }

  private sfx(name: Sound, gain: number, pan = 0, rate = 1) {
    if (this.o.mode === "attract") return;
    try { audio.play(name, { gain, pan, rate, duck: false }); } catch { /* audio not ready */ }
  }
  private buzz(p: number | number[]) {
    if (!this.o.haptics || this.o.mode === "attract") return;
    try { navigator.vibrate?.(p); } catch { /* unsupported */ }
  }

  private pushHud() {
    const s = this.sim, room = s.room, B = buildingOf(room.building);
    this.o.onHud?.({
      phase: this.phase, count: this.count,
      floor: room.n, floorsDone: s.floorsDone, building: room.building, buildingName: B.name, emoji: B.emoji, roomName: room.fusion?.name ?? room.name,
      lives: s.lives, maxLives: MAX_LIVES, coins: s.coins, diamonds: s.diamonds, roomDiamonds: s.roomDiamonds, buddies: s.buddies,
      speed: Math.round(this.speed * 10) / 10, rush: room.rush, boost: this.boostLeft, slowmo: this.slowLeft, shield: s.shield, ghost: s.ghostT > 0, magnet: s.magnetT > 0,
      keyNeeded: room.key, hasKey: s.state.key, seconds: this.seconds, par: room.par / TPS, roomSeconds: s.localT(s.cur) / TPS, moves: s.state.leaps,
    });
  }

  private finish(completed: boolean) {
    if (this.ending) return;
    this.ending = true;
    this.phase = completed ? "done" : "over";
    if (completed) { this.sfx("tada", 0.5); this.sfx("a:cheer", 0.4); this.music?.stop(1); }
    this.pushHud();
    this.o.onEnd?.(this.result(completed));
  }

  result(completed = false): EscapeResult {
    const s = this.sim;
    const concepts = new Set(this.concepts);
    for (const c of s.room.concepts) concepts.add(c);
    return {
      mode: this.o.mode, completed, floorsDone: s.floorsDone, floor: s.room.n, building: s.room.building, coins: s.coins, diamonds: s.diamonds,
      buddies: s.buddies, seconds: Math.round(this.seconds * 100) / 100, deaths: this.deaths, concepts: [...concepts], fusions: this.fusions,
      series: this.o.params.series, daily: this.o.params.daily,
    };
  }

  /** keep going after the last heart (the caller takes the coins) */
  revive() {
    if (this.phase !== "over") return false;
    this.sim.revive();
    this.ending = false;
    this.phase = "count"; this.phaseT = 0; this.count = 3;
    return true;
  }

  spend(coins: number) { this.sim.coins = Math.max(0, this.sim.coins - coins); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.r.cv.removeEventListener("pointerdown", this.onDown);
    this.r.cv.removeEventListener("pointermove", this.onMove);
    this.r.cv.removeEventListener("pointerup", this.onUp);
    this.r.cv.removeEventListener("pointercancel", this.onCancel);
    this.r.cv.removeEventListener("contextmenu", this.noMenu);
    window.removeEventListener("keydown", this.onKey);
    this.worker?.terminate();
    this.music?.stop(0.2);
    setTimeout(() => this.music?.dispose(), 400);
    this.r.dispose();
  }
}

// dev/QA hook
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __escape?: { last?: EscapeSession } }).__escape ??= {};
}
export const registerDev = (s: EscapeSession) => {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __escape: { last?: EscapeSession } }).__escape.last = s;
};
export type { Room };
