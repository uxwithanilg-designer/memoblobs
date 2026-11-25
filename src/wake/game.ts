// Wake Racers' game controller: builds a stage (course, race, 3D world), runs the loop (input → race → sounds, effects
// and camera moments → draw), and walks through the flow: the home screen (your boat idling at the start, the camera
// circling), the drone fly-over with the stage card, the countdown on the grid, the race, the slow-motion finish or
// wreck, then the result for the UI. Keyboard (arrows / WASD, space to jump, shift for nitro, E for your power, P to
// pause), the on-screen thumb buttons, and keys forwarded from the game page's frame all drive the same input.
import { autoQuality, type Quality } from "@/lib/perf";
import { buildCourse, type Course } from "./course";
import { stagePlan, type StagePlan } from "./stages";
import { Race, type Result, type PowerId, type Snapshot } from "./race";
import { newInput, type Input } from "./physics";
import { boatOf, type BoatId, type Upgrade } from "./boats";
import { WakeScene } from "./render/scene";
import { WakeAudio, sfx } from "./sound";
import { WakeMusic } from "./music";
import { worldOf } from "./worlds";
import { clamp } from "./util";
import { Driver } from "./ai";

export type Phase = "home" | "intro" | "countdown" | "race" | "finish" | "result";

export interface Hud {
  phase: Phase;
  place: number; of: number;
  progress: number; rivals: number[]; out: boolean[];
  coins: number; coinsTotal: number; need: number;
  hearts: number; maxHearts: number;
  fuel: number; nitro: number;
  power: PowerId | null; shield: number; magnet: number; ghost: number;
  timeLeft: number; timeLimit: number;
  speed: number;
  cp: number; cps: number;
  wrongWay: boolean;
  countdown: number;
  letterbox: number;
  /** metres to the finish */
  toGo: number;
}

export type GameEvent =
  | { k: "count"; n: number } | { k: "go" } | { k: "overtake"; place: number } | { k: "knockout"; name: string; you: boolean }
  | { k: "checkpoint"; idx: number } | { k: "timeAdd"; secs: number } | { k: "nearMiss" } | { k: "lowFuel" } | { k: "power"; id: PowerId }
  | { k: "gotPower"; id: PowerId } | { k: "hit"; hearts: number } | { k: "result"; result: Result; plan: StagePlan } | { k: "intro"; plan: StagePlan }
  | { k: "loading"; on: boolean } | { k: "smash" } | { k: "rivalFinish" } | { k: "saved"; snap: Snapshot; cp: number; of: number };

export interface GameOptions {
  onHud: (h: Hud) => void;
  onEvent: (e: GameEvent) => void;
  onProgress?: (p: number) => void;
}

export class WakeGame {
  readonly quality: Quality;
  scene: WakeScene;
  course: Course;
  race: Race;
  plan: StagePlan;
  phase: Phase = "home";
  private audio: WakeAudio;
  readonly music = new WakeMusic();
  private input: Input = newInput();
  private keys = { left: false, right: false, up: false, down: false, nitro: false, jump: false };
  touch = { left: false, right: false, brake: false, nitro: false };
  private raf = 0; private last = 0; private t = 0; private paused = false;
  private hudT = 0; private phaseT = 0;
  private airShot = false;
  private wrongT = 0;
  private resultSent = false;
  private boat: BoatId = "minnow"; private levels: Partial<Record<Upgrade, number>> = {}; private paint = "stock";
  /** the home screen's demo drive */
  autopilot = false;
  private bot = new Driver(0.85, 0);
  private disposed = false;
  private nearRivals = [0, 1, 2].map(() => ({ rpm: 0, throttle: 0, dist: 0, side: 0, closing: 0, voice: boatOf("minnow").voice }));

  constructor(private host: HTMLElement, private opts: GameOptions, stage: number, boat: BoatId, levels: Partial<Record<Upgrade, number>>, paint: string, quality?: Quality) {
    this.quality = quality ?? autoQuality();
    this.boat = boat; this.levels = levels; this.paint = paint;
    this.plan = stagePlan(stage);
    this.course = buildCourse(this.plan);
    this.race = this.makeRace();
    this.scene = new WakeScene(host, this.quality, this.course);
    this.scene.setBoats(this.race);
    this.scene.onThunder = () => this.audio.thunder();
    this.audio = new WakeAudio(boatOf(boat).voice);
    this.scene.director.cut("home");
    this.bindInput();
    this.resize();
  }

  private makeRace() {
    const w = worldOf(this.plan.world);
    return new Race(this.course, {
      boat: this.boat, levels: this.levels, paint: this.paint, mode: this.plan.mode, need: this.plan.need, rivals: this.plan.rivals,
      pace: this.plan.pace, skill: this.plan.skill, twist: this.plan.twist, d: this.plan.d, bossBoat: w.boss.boat as BoatId, bossName: w.boss.name,
    });
  }

  /** (re)build a stage; used for the next stage, retries and the stage map */
  load(stage: number, boat = this.boat, levels = this.levels, paint = this.paint) {
    this.boat = boat; this.levels = levels; this.paint = paint;
    const same = stage === this.plan.n;
    this.plan = stagePlan(stage);
    if (!same) { this.course = buildCourse(this.plan); this.scene.setCourse(this.course, this.opts.onProgress); }
    else for (const it of this.course.items) it.taken = false;
    for (const o of this.course.obstacles) { o.alive = true; o.s = o.s0; o.d = o.d0; }
    this.race = this.makeRace();
    this.scene.setBoats(this.race);
    this.audio.setVoice(boatOf(boat).voice);
    this.phase = "home"; this.phaseT = 0; this.resultSent = false; this.airShot = false;
    this.scene.director.cut("home");
    this.scene.director.timeScale = 1;
  }

  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** go: the fly-over, then the countdown, then the race (or, from a saved checkpoint, straight to a countdown there) */
  play(resume: Snapshot | null = null) {
    if (this.phase !== "home") return;
    if (resume) {
      this.music.stage(this.plan);
      this.audio.start(worldOf(this.plan.world).ambience);
      this.race.continueFrom(resume);
      this.phase = "countdown"; this.phaseT = 0;
      this.scene.director.cut("grid", 0.4);
      this.opts.onEvent({ k: "count", n: 3 });
      return;
    }
    this.phase = "intro"; this.phaseT = 0;
    const d = this.scene.director;
    d.flyLen = clamp(this.course.length * 0.45, 260, 900); d.flyTime = clamp(3.4 + this.course.length / 1400, 3.6, 5.5);
    d.cut("flyover", 0.6);
    this.music.stage(this.plan);
    this.audio.start(worldOf(this.plan.world).ambience);
    sfx("whoosh");
    this.opts.onEvent({ k: "intro", plan: this.plan });
  }
  skipIntro() { if (this.phase === "intro") this.toCountdown(); }
  /** after a wreck, an empty tank or the clock: pick the race up at the last checkpoint */
  continueRace() {
    const sn = this.race.lastSnap;
    if (!sn || !this.race.result || this.race.result.ok) return false;
    this.race.continueFrom(sn);
    this.phase = "countdown"; this.phaseT = 0; this.resultSent = false; this.airShot = false;
    this.scene.director.cut("grid", 0.4);
    this.scene.director.timeScale = 1;
    this.music.resume();
    return true;
  }
  private toCountdown() {
    this.phase = "countdown"; this.phaseT = 0;
    this.scene.director.cut("grid", 0.5);
    this.race.start();
  }

  pause(on: boolean) {
    if (on === this.paused) return;
    this.paused = on;
    if (on) { this.audio.silence(); this.music.pause(); } else { this.music.resume(); this.last = performance.now(); }
  }
  get isPaused() { return this.paused; }

  usePower() { if (this.race.usePower()) { /* sound on the event */ } }
  jump() { this.keys.jump = true; }

  // ------------------------------------------------------------------ input
  private onKey = (e: KeyboardEvent) => this.key(e.key, e.code, e.type === "keydown", e);
  private onMsg = (e: MessageEvent) => {
    const m = e.data as { type?: string; key?: string; code?: string; down?: boolean } | null;
    if (!m || m.type !== "momoblobs:key") return;
    this.key(m.key ?? "", m.code ?? "", !!m.down, null);
  };
  private onBlur = () => { for (const k of Object.keys(this.keys) as (keyof typeof this.keys)[]) this.keys[k] = false; };
  private key(key: string, code: string, down: boolean, e: KeyboardEvent | null) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    let used = true;
    if (k === "ArrowLeft" || code === "KeyA" || k === "a") this.keys.left = down;
    else if (k === "ArrowRight" || code === "KeyD" || k === "d") this.keys.right = down;
    else if (k === "ArrowUp" || code === "KeyW" || k === "w") this.keys.up = down;
    else if (k === "ArrowDown" || code === "KeyS" || k === "s") this.keys.down = down;
    else if (k === " " || code === "Space") { if (down) { if (this.phase === "intro") this.skipIntro(); else this.keys.jump = true; } }
    else if (k === "Shift" || code === "ShiftLeft" || code === "ShiftRight" || k === "n") this.keys.nitro = down;
    else if (k === "e" || k === "f" || code === "KeyE" || code === "KeyF") { if (down) this.usePower(); }
    else used = false;
    if (used && e && this.phase !== "home" && this.phase !== "result") e.preventDefault();
  }
  private bindInput() {
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    window.addEventListener("message", this.onMsg);
    window.addEventListener("blur", this.onBlur);
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.scene.resize(r.width, r.height);
  }

  // ------------------------------------------------------------------ the loop
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused || this.disposed) return;
    this.frame(real);
  };

  private frame(real: number) {
    const d = this.scene.director, race = this.race;
    const dt = real * d.timeScale;
    this.t += dt; this.phaseT += real;
    // input
    const I = this.input;
    if (this.autopilot && this.phase !== "home") {
      this.bot.drive(this.course, race.player.boat, I, { fuel01: race.fuel / race.tank, hearts: race.hearts, nitro: race.player.nitro, hasPower: !!race.power }, dt, race.t);
    } else {
      const L = this.keys.left || this.touch.left, R = this.keys.right || this.touch.right;
      I.steer += ((L === R ? 0 : L ? -1 : 1) - I.steer) * Math.min(1, real * (L === R ? 12 : 9));
      I.brake = this.keys.down || this.touch.brake ? 1 : 0;
      I.throttle = I.brake ? 0 : 1;
      I.boost = this.keys.nitro || this.touch.nitro;
      I.jump = this.keys.jump;
    }
    this.keys.jump = false;
    // phases
    if (this.phase === "intro" && this.phaseT > d.flyTime) this.toCountdown();
    if (this.phase === "countdown" && race.phase === "race") { this.phase = "race"; d.cut("chase", 0.8); }
    if (this.phase === "home" || this.phase === "intro") { /* the grid waits */ }
    race.update(this.phase === "home" || this.phase === "intro" ? 0 : dt, I);
    this.handleEvents();
    if (race.result && this.phase === "race") this.onResult();
    if (this.phase === "finish" && this.phaseT > 1.7 && d.shot !== "orbit" && d.shot !== "wreck") d.cut("orbit", 1.4);
    if (this.phase === "finish" && this.phaseT > 2.6 && !this.resultSent) {
      this.resultSent = true; this.phase = "result";
      this.opts.onEvent({ k: "result", result: race.result!, plan: this.plan });
    }
    // sound: your engine, the rivals nearby
    const p = race.player.boat;
    const speed01 = Math.max(0, p.fwd) / p.spec.top;
    if (this.phase !== "home") {
      this.audio.update(real, speed01, I.throttle, p.boostT > 0, !p.grounded, Math.min(1, Math.abs(p.lat) / 6));
      // the three nearest rivals' engines (reused objects: nothing allocated per frame)
      const near = this.nearRivals;
      let n = 0;
      for (const r of race.racers) {
        if (r.isPlayer || r.out) continue;
        const dist = r.boat.s - p.s;
        if (Math.abs(dist) > 80) continue;
        let k = n < 3 ? n++ : -1;
        if (k < 0) { let wi = 0; for (let j = 1; j < 3; j++) if (Math.abs(near[j].dist) > Math.abs(near[wi].dist)) wi = j; if (Math.abs(near[wi].dist) > Math.abs(dist)) k = wi; }
        if (k < 0) continue;
        const o = near[k];
        o.rpm = Math.min(1, 0.2 + r.boat.fwd / 40); o.throttle = r.input.throttle; o.dist = dist; o.side = r.boat.d - p.d; o.closing = p.fwd - r.boat.fwd; o.voice = boatOf(r.boatId).voice;
      }
      this.audio.rivals(near, n);
      this.music.fever(p.boostT > 0);
    }
    // wrong way?
    const ci = Math.round(p.i), headErr = Math.atan2(Math.sin(p.heading - Math.atan2(this.course.tx[ci], this.course.tz[ci])), Math.cos(p.heading - Math.atan2(this.course.tx[ci], this.course.tz[ci])));
    this.wrongT = this.phase === "race" && Math.abs(headErr) > 2 && p.speed > 3 ? this.wrongT + real : 0;
    // draw
    this.scene.frame(this.t, dt, race, Math.min(1.3, speed01), p.boostT > 0);
    this.hudT += real;
    if (this.hudT > 0.08) { this.hudT = 0; this.pushHud(speed01); }
  }

  private onResult() {
    const r = this.race.result!, d = this.scene.director;
    this.phase = "finish"; this.phaseT = 0;
    if (r.ok) { d.cut("finish", 0.45); d.slowMo(0.3, 1.5); sfx("finish"); sfx("cheer", { delay: 0.3 }); }
    else { d.cut("wreck", 0.8); d.slowMo(0.5, 1.1); sfx(r.reason.includes("wrecked") ? "wreck" : "lose"); }
    const p = this.race.player.boat;
    if (r.ok) for (let k = 0; k < 4; k++) this.scene.fx.burst("confetti", p.x, p.y + 6 + k, p.z, 40, 9, 0.6);
  }

  private handleEvents() {
    const race = this.race, p = race.player.boat, fx = this.scene.fx, d = this.scene.director;
    for (const e of race.events) {
      const mine = e.who === 0;
      const pan = clamp((e.x - p.x) * Math.cos(p.heading) - (e.z - p.z) * Math.sin(p.heading), -20, 20) / -20;
      const far = Math.hypot(e.x - p.x, e.z - p.z), vol = clamp(1 - far / 90, 0, 1);
      switch (e.k) {
        case "beep": sfx("beep", { rate: 1 }); this.opts.onEvent({ k: "count", n: e.v }); break;
        case "go": sfx("go"); sfx("horn", { gain: 0.6 }); this.opts.onEvent({ k: "go" }); break;
        case "coin": sfx("coin", { rate: 1 + Math.min(0.5, (e.v % 10) * 0.04) }); fx.burst("sparkle", e.x, e.y, e.z, 5, 3, 0.4); break;
        case "heart": sfx("heart"); fx.burst("sparkle", e.x, e.y, e.z, 12, 4, 0.5, "#FF5A7A"); break;
        case "fuel": sfx("fuel"); fx.burst("sparkle", e.x, e.y, e.z, 10, 4, 0.5, "#FFB21F"); break;
        case "box": sfx("box"); fx.burst("sparkle", e.x, e.y, e.z, 14, 5, 0.5, "#B98CFF"); this.opts.onEvent({ k: "gotPower", id: e.s as PowerId }); break;
        case "power": {
          const id = e.s as PowerId;
          sfx(id === "turbo" ? "turbo" : id === "shield" ? "shield" : id === "magnet" ? "magnet" : id === "wave" ? "wave" : id === "ghost" ? "ghost" : id === "jump" ? "hop" : "freeze");
          if (id === "wave") { fx.burst("splash", e.x, e.y, e.z, 60, 14, 0.4); d.shake(0.5); }
          if (id === "turbo") { d.shake(0.3); }
          this.opts.onEvent({ k: "power", id });
          break;
        }
        case "launch": if (mine) {
          sfx("jump", { gain: 0.6 });
          fx.burst("spray", e.x, e.y, e.z, 10, 4, 0.6);
          // a big jump or a waterfall: the side camera, in slow motion
          const fall = this.course.falls.some((f) => Math.abs(f.s - p.s) < 12);
          if ((e.v > 7.2 || fall) && this.phase === "race" && !this.airShot) { this.airShot = true; d.cut("air", 0.3); d.slowMo(0.42, fall ? 1.1 : 0.75); sfx("whoosh"); }
        } break;
        case "land":
          if (mine) {
            const big = e.v > 9;
            sfx(big ? "splashBig" : "land", { gain: clamp(e.v / 12, 0.3, 1) });
            fx.burst("splash", e.x, e.y, e.z, big ? 30 : 12, big ? 7 : 4, 0.7);
            fx.burst("foam", e.x, e.y + 0.1, e.z, 8, 3, 0);
            if (big) d.shake(0.5);
            if (this.airShot) { this.airShot = false; d.cut("chase", 0.45); }
          } else if (vol > 0.2) { sfx("land", { gain: vol * 0.5, pan }); fx.burst("splash", e.x, e.y, e.z, 8, 4, 0.6); }
          break;
        case "hit": sfx("hit"); fx.burst("splash", e.x, e.y + 0.5, e.z, 24, 7, 0.6); fx.burst("spark", e.x, e.y + 0.8, e.z, 16, 9, 0.5); d.shake(0.9); this.opts.onEvent({ k: "hit", hearts: race.hearts }); break;
        case "bump": if (mine) { sfx("bump", { gain: clamp(e.v / 8, 0.3, 1) }); fx.burst("spray", e.x, e.y + 0.3, e.z, 6, 3, 0.5); d.shake(0.2); } break;
        case "wall": sfx("wall", { gain: clamp(e.v / 10, 0.3, 1) }); fx.burst("spray", p.x, p.y + 0.3, p.z, 10, 4, 0.5); d.shake(0.3); break;
        case "smash": if (vol > 0.1) { sfx("smash", { gain: vol, pan }); fx.burst("splash", e.x, e.y + 0.5, e.z, 10, 4, 0.6); if (mine) this.opts.onEvent({ k: "smash" }); } break;
        case "mine": sfx("mine", { gain: Math.max(0.4, vol), pan }); fx.burst("blast", e.x, e.y + 1, e.z, 18, 6, 0.6); fx.burst("splash", e.x, e.y, e.z, 40, 10, 0.9); fx.burst("smoke", e.x, e.y + 2, e.z, 10, 2, 0.6); if (vol > 0.5) d.shake(1.1); break;
        case "pad": sfx("pad"); fx.burst("flame", p.x, p.y + 0.4, p.z, 10, 4, 0.2); break;
        case "nitro": sfx("nitro"); break;
        case "nearMiss": sfx("nearMiss"); this.opts.onEvent({ k: "nearMiss" }); break;
        case "checkpoint": if (e.v >= 0) { sfx("checkpoint"); this.opts.onEvent({ k: "checkpoint", idx: e.v }); } break;
        case "timeAdd": sfx("timeAdd"); this.opts.onEvent({ k: "timeAdd", secs: e.v }); break;
        case "knockout": {
          const you = e.who === 0;
          sfx("knockout", { pan: you ? 0 : pan });
          fx.burst("smoke", e.x, e.y + 1, e.z, 14, 2, 0.6);
          this.opts.onEvent({ k: "knockout", name: e.s, you });
          break;
        }
        case "overtake": sfx("overtake", { rate: 1 + (6 - e.v) * 0.04 }); this.opts.onEvent({ k: "overtake", place: e.v }); break;
        case "lowFuel": sfx("lowFuel"); this.opts.onEvent({ k: "lowFuel" }); break;
        case "rivalFinish": if (vol > 0.1) sfx("horn", { gain: 0.3, pan }); this.opts.onEvent({ k: "rivalFinish" }); break;
        case "shieldPop": sfx("shieldPop"); fx.burst("sparkle", p.x, p.y + 1, p.z, 20, 6, 0.5, "#36E3FF"); d.shake(0.4); break;
        case "docked": sfx("docked"); break;
        case "saved": if (race.lastSnap) this.opts.onEvent({ k: "saved", snap: race.lastSnap, cp: e.v + 1, of: this.course.checkpoints.length }); break;
        case "finish": case "fail": break;
      }
    }
    race.events.length = 0;
  }

  private pushHud(speed01: number) {
    const r = this.race, p = r.player;
    const h: Hud = {
      phase: this.phase, place: p.place, of: r.racers.filter((x) => !x.out).length,
      progress: r.progress(), rivals: r.racers.slice(1).map((x) => r.progress(x)), out: r.racers.slice(1).map((x) => x.out),
      coins: r.coins, coinsTotal: r.coinsTotal, need: r.need,
      hearts: r.hearts, maxHearts: r.maxHearts, fuel: r.fuel / r.tank, nitro: p.nitro,
      power: r.power, shield: r.shield, magnet: r.magnet, ghost: p.boat.ghost,
      timeLeft: r.timeLeft, timeLimit: r.timeLimit, speed: Math.round(Math.max(0, p.boat.fwd) * 3.6),
      cp: p.cp, cps: this.course.checkpoints.length, wrongWay: this.wrongT > 1.2,
      countdown: r.phase === "countdown" ? Math.ceil(r.countdown) : 0, letterbox: this.scene.director.letterbox,
      toGo: Math.max(0, this.course.length - p.boat.s),
    };
    void speed01;
    this.opts.onHud(h);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
    window.removeEventListener("message", this.onMsg);
    window.removeEventListener("blur", this.onBlur);
    this.audio.dispose(); this.music.dispose();
    this.scene.dispose();
  }
}
