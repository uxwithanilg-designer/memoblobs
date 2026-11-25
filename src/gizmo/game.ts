// Gizmo Drive's game: the loop, the stage, the rules and the cinematic camera.
//  - a stage opens with a fly-over: the camera starts at the finish flag, zoomed out under letterbox bars, and glides
//    back along the course to the car (tap to skip), then a short countdown and GO;
//  - the camera leads the car, zooms out with speed and big air, frames the big contraptions (a lift's shaft, a loop,
//    a wrecking ball's swing), tilts a touch, shakes on hard landings and slows time for crashes, big jumps and the
//    finish;
//  - fuel drains with the throttle (oil cans refill it), coins bank at once, hearts add lives, power-ups run on timers
//    (turbo, helmet shield, coin magnet, floaty jumps, sticky tyres);
//  - a crash (the driver's head hits something, the car lands on its roof, falls in a pit, or runs dry) costs a life
//    and drops the car back at the last checkpoint with the contraptions reset; with no lives left the stage restarts;
//  - crossing the finish rolls the car out in slow motion with confetti, then the UI moves straight on to the next.
// On the menus the test driver (src/gizmo/bot.ts) drives the stage behind the buttons.
import { FrameGovernor, autoQuality, isPhone, pixelRatioFor, type Quality } from "@/lib/perf";
import { Car, STEP, type Pedals } from "./physics";
import { buildCourse, POWERS, type Course, type Item, type PowerId } from "./course";
import { Bot } from "./bot";
import { lookFor, type Look } from "./art/look";
import { paintBackdrop, STRIP_H, STRIP_W, type Strip } from "./art/backdrop";
import { Sky } from "./art/sky";
import { CourseArt, type View } from "./art/course-art";
import { ItemArt, powerColor } from "./art/items";
import { PropArt } from "./art/props";
import { Antenna, drawCar, type Mood } from "./art/car-art";
import { CHUNK, CONFETTI, DIRT, DROP, DUST, Particles, RING, SMOKE, SPARK, SPARKLE, WeatherFx } from "./art/fx";
import { GizmoAudio, sfx } from "./sound";
import { GIZMO_NAME } from "./stages";
import { topSpeed, type VehicleId } from "./vehicles";
import { clamp, lerp, mix, rgba, shade } from "./util";

export type Mode = "attract" | "preview" | "intro" | "play" | "crash" | "finish" | "over";
export interface Hud {
  stage: number; fuel: number; lives: number; coins: number; stageCoins: number; progress: number; checkpoints: number[];
  powers: { id: PowerId; left: number; secs: number }[]; mode: Mode; lowFuel: boolean;
  title: string; subtitle: string; remix: boolean; summit: boolean; finale: boolean; world: string; accent: string;
  ride: string; fresh: string | null;
}
export type GameEvent =
  | { k: "go" } | { k: "checkpoint"; n: number } | { k: "flip"; n: number; coins: number } | { k: "air"; coins: number }
  | { k: "pickup"; what: "fuel" | "heart" | "star" | PowerId } | { k: "crash"; why: Why; livesLeft: number }
  | { k: "respawn" } | { k: "restart" } | { k: "finish"; stats: StageStats } | { k: "lowFuel" } | { k: "stuck" }
  | { k: "gizmo"; name: string } | { k: "ride"; id: VehicleId; name: string };
export type Why = "head" | "fall" | "fuel" | "roof";
export interface StageStats { stage: number; coins: number; time: number; flips: number; crashes: number; stars: number }

export interface GameOptions {
  paint: string; lives: number; coins: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  onCoins: (total: number) => void; onLives: (n: number) => void; onCheckpoint: (stage: number, cp: number) => void;
  /** the keyboard's gas / brake changed (the on-screen pedals light up with them) */
  onKeys?: (gas: boolean, brake: boolean) => void;
}

/** where each backdrop layer's foot sits on screen (just about the ground line the camera keeps), by orientation */
const BASES_TALL = [0.6, 0.68, 0.76], BASES_WIDE = [0.64, 0.73, 0.83];
const PAR = [0.05, 0.13, 0.26];

export class Game {
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1; private quality: Quality;
  private gov: FrameGovernor | null = null; private govScale = 1;
  private raf = 0; private lastT = 0; private time = 0;
  private running = false;

  course!: Course; look!: Look; private strips: Strip[] = []; private sky!: Sky; private art!: CourseArt; private items = new ItemArt(); private props!: PropArt;
  private weather!: WeatherFx;
  private fx: Particles;
  car!: Car;
  private ant = new Antenna();
  private bot: Bot | null = null;
  private audio: GizmoAudio | null = null;
  mode: Mode = "attract";
  stage = 1;
  private modeT = 0;
  private pedals: Pedals = { gas: 0, brake: 0 };
  private keys = { gas: false, brake: false };
  private touch = { gas: 0, brake: 0 };
  // rules
  fuel = 40; private tank = 40; lives = 3; coins = 0; private stageCoins = 0; private cp = 0;
  private power: Record<PowerId, number> = { turbo: 0, shield: 0, magnet: 0, float: 0, grip: 0 };
  private stats = { flips: 0, crashes: 0, time: 0 };
  private outOfFuel = 0; private lowWarned = false; private roofT = 0;
  private airSpin = 0; private airStart = 0; private bigAir = false;
  private why: Why = "head";
  private bestX = 0; private bestT = 0; private stuck = false;
  private freshShown = false;
  // camera
  private cam = { x: 0, y: 0, z: 1, rot: 0, shake: 0, bars: 0, slow: 1, fx: 0, fy: 0, fz: 0 };
  private camBase = 30;
  private startY = 0;
  private mood: Mood = "happy";
  private hudT = 0;
  private lastCamX = 0; private lastCamY = 0;
  private vignette: HTMLCanvasElement | null = null;
  private edgeGlow: HTMLCanvasElement | null = null; private edgeGlowId = "";
  private reduced = false;
  private acc = 0;
  private stuckBot = 0;
  /** QA and the art script: the test driver drives the stage in play mode */
  autopilot = false;

  constructor(private host: HTMLElement, private opts: GameOptions) {
    this.quality = autoQuality();
    this.cv = document.createElement("canvas");
    this.cv.className = "gz-canvas";
    host.appendChild(this.cv);
    this.c = this.cv.getContext("2d", { alpha: false })!;
    this.fx = new Particles(this.quality === "low" ? 220 : 380);
    this.lives = opts.lives; this.coins = opts.coins;
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.onKey, true);
    window.addEventListener("message", this.onMsg);
    window.addEventListener("blur", this.onBlur);
    this.gov = new FrameGovernor((s) => { this.govScale = s; this.resize(); }, 0.6);
    // QA and the art script (scripts/art/gizmo_art.py) look at the game through this
    (window as unknown as { __gizmo?: Game }).__gizmo = this;
  }

  // ---------------------------------------------------------------- setup
  private resize = () => {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.dpr = pixelRatioFor(this.quality) * this.govScale;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = `${this.W}px`; this.cv.style.height = `${this.H}px`;
    // pixels per metre: ~23 m across a landscape screen; ~12 m across a portrait phone
    const portrait = this.H > this.W;
    this.camBase = portrait ? Math.min(this.W / 10.5, this.H / 16) : Math.max(this.W / 23, this.H / 12.5);
    this.vignette = null;
  };

  setPaint(p: string) { this.opts.paint = p; }

  /** build a stage; `cp` = the checkpoint to start from (resume) */
  load(stage: number, cp = 0, mode: Mode = "preview") {
    this.stage = stage;
    this.course = buildCourse(stage);
    this.look = lookFor(this.course.plan);
    const res = isPhone() ? 0.75 : 1;
    this.freeArt();
    this.strips = paintBackdrop(this.look, res);
    this.sky = new Sky(this.look, this.quality);
    this.art = new CourseArt(this.course, this.look, this.quality);
    this.props = new PropArt(this.look, isPhone() ? 0.8 : 1.2);
    const wc = (this.quality === "low" ? 50 : this.quality === "medium" ? 90 : 140) * (this.reduced ? 0.3 : 1);
    this.weather = new WeatherFx(this.look.world.weather, Math.round(wc), this.look.glow, this.look.night);
    const g = this.look.ground;
    this.fx.setPalette([g.cap, g.body[0], g.detail, shade(g.body[1], 0.1), mix(this.look.haze, "#FFFFFF", 0.4), "#FFD27A", "#FF5D8F", "#FFD23F", "#2EC4B6", "#7B5CFF", "#FF8A3D", "#FFFFFF", "#FF4545", "#3EE08F", "#38BDF8", "#A78BFA", "#C08A4E", "#7CD4F2"]);
    this.fx.clear();
    this.car = new Car(this.course.vehicle);
    this.tank = this.course.vehicle.tank;
    this.bot = new Bot(this.course);
    this.power = { turbo: 0, shield: 0, magnet: 0, float: 0, grip: 0 };
    this.cp = Math.min(cp, this.course.checkpoints.length);
    this.art.cpPassed = this.cp;
    this.stageCoins = 0; this.stats = { flips: 0, crashes: 0, time: 0 };
    this.freshShown = false;
    this.place();
    this.startY = this.car.y;
    if (this.course.plan.twist === "turbo" && mode !== "attract") { this.power.turbo = 4; }
    this.audio?.dispose(); this.audio = null;
    this.setMode(mode);
    this.snapCamera();
    this.pushHud();
    this.opts.onEvent({ k: "ride", id: this.course.vehicle.id, name: this.course.vehicle.name });
  }

  /** release the last stage's painted backdrops and sprites at once (long sessions, stage after stage) */
  private freeArt() {
    for (const st of this.strips) { st.canvas.width = 0; st.canvas.height = 0; }
    this.strips = [];
    this.sky?.dispose();
    this.props?.dispose();
  }

  private place() {
    const c = this.course, W = c.physics;
    W.reset();
    const p = this.cp > 0 ? c.checkpoints[this.cp - 1] : c.start;
    this.car.place(p.x, (x) => W.groundAt(x, p.y + 3));
    this.applyPowers();
    this.ant.reset();
    this.fuel = this.tank; this.outOfFuel = 0; this.lowWarned = false; this.roofT = 0; this.mood = "happy";
    this.airSpin = 0; this.bigAir = false;
    this.bestX = this.car.x; this.bestT = 0; this.stuckBot = 0;
    this.bot?.reset();
  }
  private applyPowers() {
    const W = this.course.physics;
    W.g = this.course.g * (this.power.float > 0 ? 0.55 : 1);
    this.car.gripMul = this.power.grip > 0 ? 1.5 : 1;
    this.car.power = this.power.grip > 0 ? 1.12 : 1;
    this.car.shield = this.power.shield > 0;
    this.car.turbo = this.power.turbo;
  }

  private setMode(m: Mode) { this.mode = m; this.modeT = 0; }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.audio?.silence(); }
  get isRunning() { return this.running; }

  /** from the menu: the fly-over, then the countdown */
  play() {
    this.cp = Math.min(this.cp, this.course.checkpoints.length);
    this.place();
    this.setMode(this.cp > 0 ? "intro" : "preview");
    this.snapCamera();
    this.ensureAudio();
  }
  /** skip the fly-over */
  skip() { if (this.mode === "preview") { this.setMode("intro"); } }
  private ensureAudio() {
    if (!this.audio) { this.audio = new GizmoAudio(this.course.vehicle.voice); this.audio.start(this.look.world.ambience); }
  }

  setTouch(gas: number, brake: number) {
    this.touch.gas = gas; this.touch.brake = brake;
    if ((gas || brake) && this.mode === "preview" && this.modeT > 0.35) this.skip();
  }
  /** arrows and A/D (W/S too), on any keyboard layout (by key or by physical key) */
  private static side(key: string, code: string): "gas" | "brake" | "" {
    if (key === "ArrowRight" || key === "Right" || key === "ArrowUp" || key === "Up" || code === "ArrowRight" || code === "ArrowUp" || code === "KeyD" || code === "KeyW" || key === "d" || key === "D" || key === "w" || key === "W") return "gas";
    if (key === "ArrowLeft" || key === "Left" || key === "ArrowDown" || key === "Down" || code === "ArrowLeft" || code === "ArrowDown" || code === "KeyA" || code === "KeyS" || key === "a" || key === "A" || key === "s" || key === "S") return "brake";
    return "";
  }
  private key(key: string, code: string, down: boolean) {
    const side = Game.side(key, code);
    if (side) {
      const was = this.keys[side];
      this.keys[side] = down;
      if (was !== down) this.opts.onKeys?.(this.keys.gas, this.keys.brake);
    }
    if (down && this.mode === "preview" && this.modeT > 0.35 && (side || key === " " || key === "Enter")) this.skip();
    return side !== "" || key === " ";
  }
  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
    if (this.key(e.key, e.code, e.type === "keydown")) e.preventDefault();
  };
  /** keys the game page passes in (focus was on the page around the game's frame) */
  private onMsg = (e: MessageEvent) => {
    const d = e.data as { type?: string; key?: string; code?: string; down?: boolean } | null;
    if (e.origin !== window.location.origin || d?.type !== "momoblobs:key") return;
    this.key(d.key ?? "", d.code ?? "", !!d.down);
  };
  /** the window lost focus: let go of the keys (a key released elsewhere never sends its keyup here) */
  private onBlur = () => { if (this.keys.gas || this.keys.brake) { this.keys.gas = this.keys.brake = false; this.opts.onKeys?.(false, false); } };

  dispose() {
    this.stop();
    const w = window as unknown as { __gizmo?: Game };
    if (w.__gizmo === this) delete w.__gizmo;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.onKey, true);
    window.removeEventListener("message", this.onMsg);
    window.removeEventListener("blur", this.onBlur);
    this.gov?.dispose?.();
    this.audio?.dispose();
    this.freeArt();
    this.cv.remove();
  }

  // ---------------------------------------------------------------- loop
  frame(dt: number) {
    this.time += dt;
    this.modeT += dt;
    const sdt = dt * this.cam.slow;
    this.updateRules(sdt);
    this.acc += sdt;
    let steps = 0;
    const W = this.course.physics;
    while (this.acc >= STEP && steps < 24) { W.step(this.car, this.pedals); this.acc -= STEP; steps++; }
    if (steps >= 24) this.acc = 0;
    const R = this.car;
    if (!Number.isFinite(R.x + R.y + R.a + R.vx + R.wx[0] + R.wy[1])) { this.place(); this.cam.x = R.x; this.cam.y = R.y; }
    this.afterPhysics(sdt);
    this.ant.update(R, sdt);
    this.fx.update(sdt, W.g);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private updateRules(sdt: number) {
    const R = this.car, m = this.mode;
    let gas = 0, brake = 0;
    if (m === "play" && this.autopilot && this.bot) {
      this.bot.drive(R, this.pedals);
      gas = this.pedals.gas; brake = this.pedals.brake;
    } else if (m === "play") {
      gas = Math.max(this.keys.gas ? 1 : 0, this.touch.gas);
      brake = Math.max(this.keys.brake ? 1 : 0, this.touch.brake);
      if (this.fuel <= 0) gas = 0;
    } else if (m === "attract" && this.bot) {
      this.bot.drive(R, this.pedals);
      gas = this.pedals.gas; brake = this.pedals.brake;
    } else if (m === "finish") {
      gas = this.modeT < 0.5 ? 0.35 : 0; brake = this.modeT > 0.8 && R.forward > 0.5 ? 0.8 : 0;
    }
    this.pedals.gas = gas; this.pedals.brake = brake;
    if (m !== "play") return;
    this.stats.time += sdt;
    const use = (0.15 + 0.85 * gas) * (this.power.turbo > 0 ? 0.3 : 1);
    this.fuel = Math.max(0, this.fuel - use * sdt);
    if (this.fuel / this.tank < 0.25 && !this.lowWarned) { this.lowWarned = true; sfx("lowFuel"); this.opts.onEvent({ k: "lowFuel" }); }
    if (this.fuel / this.tank > 0.4) this.lowWarned = false;
    if (this.fuel <= 0) { this.outOfFuel = R.speed < 0.5 ? this.outOfFuel + sdt : 0; if (this.outOfFuel > 1.6) this.crash("fuel"); }
    // stuck: no headway for 12 s while trying to drive → back to the checkpoint (no life lost)
    this.bestT += sdt;
    if (R.x > this.bestX + 1.5) { this.bestX = R.x; this.bestT = 0; }
    if (this.bestT > 12 && (gas > 0 || brake > 0) && this.fuel > 0) { this.stuck = true; this.crash("head"); return; }
    let changed = false;
    for (const p of POWERS) if (this.power[p.id] > 0) { this.power[p.id] = Math.max(0, this.power[p.id] - sdt); if (this.power[p.id] === 0) changed = true; }
    if (changed) this.applyPowers();
    R.shield = this.power.shield > 0;
  }

  private afterPhysics(sdt: number) {
    const R = this.car, m = this.mode, W = this.course.physics;
    const q = this.quality === "low" ? 0.5 : 1;
    // dust from the tyres, exhaust
    for (let i = 0; i < 2; i++) {
      if (!R.touch[i]) continue;
      const sp = Math.abs(R.omega[i] * R.rad[i]);
      if ((R.slip > 0.15 || (this.pedals.gas > 0 && sp > 3)) && Math.random() < 0.5 * q) {
        const gx = R.wx[i] - 0.2, gy = R.wy[i] - R.rad[i] * 0.8;
        this.fx.spawn(DUST, gx, gy, -R.vx * 0.2 - 1 - Math.random() * 2, 0.6 + Math.random() * 1.2, 0.8, 0.18 + Math.random() * 0.18, 1);
        if (Math.random() < 0.35) this.fx.spawn(DIRT, gx, gy, -2 - Math.random() * 3 - R.slip * 4, 2 + Math.random() * 3, 0.7, 0.05 + Math.random() * 0.05, Math.random() < 0.5 ? 0 : 3);
      }
    }
    if ((m === "play" || m === "attract") && this.pedals.gas > 0 && Math.random() < 0.22 * q && R.spec.id !== "moonbug") {
      const ca = Math.cos(R.a), sa = Math.sin(R.a), back = R.spec.chassis.w * 0.5;
      this.fx.spawn(SMOKE, R.x - back * ca + 0.05 * sa, R.y - back * sa - 0.05 * ca, -ca * 1.2 + R.vx * 0.3, 0.4, 0.8, 0.1, 4);
    }
    if (this.power.turbo > 0 && Math.random() < 0.6 * q) this.fx.spawn(SPARK, R.x - R.spec.chassis.w * 0.55 * Math.cos(R.a), R.y - R.spec.chassis.w * 0.55 * Math.sin(R.a), -R.vx * 0.2 - 3, (Math.random() - 0.5) * 2, 0.35, 0.08, 10);
    if (R.scrape > 0.4 && Math.random() < 0.6) this.fx.spawn(SPARK, R.x, R.y - 0.3, -R.vx * 0.3 + (Math.random() - 0.5) * 3, Math.random() * 3, 0.4, 0.06, 5);
    R.scrape *= 0.8;
    // landings and hits
    if (R.landing > 0) {
      const hard = R.landing > 7;
      if (m === "play" || m === "finish") sfx(hard ? "landHard" : "land", { gain: clamp(R.landing / 10, 0.3, 1) });
      this.cam.shake = Math.max(this.cam.shake, clamp(R.landing / 14, 0, 0.55) * (this.reduced ? 0.3 : 1));
      for (let k = 0; k < (hard ? 10 : 5) * q; k++) this.fx.spawn(DUST, R.x + (Math.random() - 0.5) * 2, R.y - 0.9, (Math.random() - 0.5) * 4, Math.random() * 1.5, 1, 0.24, 1);
      R.landing = 0;
    }
    if (R.bodyHit > 2.5) { if (m === "play") sfx("bump", { gain: clamp(R.bodyHit / 8, 0.3, 1) }); R.bodyHit = 0; }
    // the contraptions' own moments
    for (const e of W.events) {
      const pan = clamp((e.x - this.cam.x) / 10, -0.8, 0.8);
      const audible = m === "play" || m === "finish";
      if (e.k === "break") {
        if (audible) sfx("crate", { pan });
        const b = W.bodies[e.body];
        for (let k = 0; k < 18 * q; k++) this.fx.spawn(CHUNK, b.x + (Math.random() - 0.5) * 1.6, b.y + Math.random() * 2.4, R.vx * 0.5 + (Math.random() - 0.3) * 5, 1 + Math.random() * 5, 1.4, 0.12 + Math.random() * 0.12, 16);
        this.cam.shake = Math.max(this.cam.shake, 0.3);
      } else if (e.k === "spring") { if (audible) sfx("spring", { pan }); this.fx.burst(RING, e.x, e.y, 1, 0, 0.5, 1.6, 6); }
      else if (e.k === "button") { if (audible) { sfx("button", { pan }); sfx("gate", { pan, delay: 0.15 }); } }
      else if (e.k === "fall") { if (audible) sfx(Math.random() < 0.5 ? "crumble" : "creak", { pan, rate: 0.9 + Math.random() * 0.2 }); }
      else if (e.k === "loop") { if (audible) sfx("loop", { pan }); }
    }
    W.events.length = 0;
    if (m !== "play") {
      if (m === "crash") this.crashStep();
      else if (m === "finish") this.finishStep();
      else if (m === "intro") this.introStep();
      else if (m === "preview") { if (this.modeT > this.previewLen()) this.setMode("intro"); }
      else if (m === "attract") this.attractStep();
      return;
    }
    // a new gizmo ahead: name it once
    const plan = this.course.plan;
    if (plan.fresh && !this.freshShown) {
      const mod = this.course.modules.find((q2) => q2.k === plan.fresh);
      if (mod && R.x > mod.x0 - 16) { this.freshShown = true; sfx("newGizmo"); this.opts.onEvent({ k: "gizmo", name: GIZMO_NAME[plan.fresh] }); }
    }
    // flips and big air
    if (!R.grounded) {
      if (R.airTime < 0.05) { this.airSpin = 0; this.airStart = R.a; this.bigAir = false; }
      this.airSpin = R.a - this.airStart;
      const h = this.course.heightAt(R.x);
      if (R.airTime > 0.9 && !this.bigAir && (!Number.isFinite(h) || R.y - h > 3)) { this.bigAir = true; this.mood = "wow"; }
    } else if (this.airSpin !== 0 || this.bigAir) {
      const flips = Math.floor(Math.abs(this.airSpin) / (Math.PI * 2) + 0.15);
      if (flips > 0) {
        const cn = 10 * flips * flips;
        this.addCoins(cn); this.stats.flips += flips; sfx("flip", { rate: 1 + flips * 0.08 });
        this.opts.onEvent({ k: "flip", n: flips, coins: cn });
        this.fx.burst(SPARKLE, R.x, R.y + 1, 14, 4, 0.8, 0.25, 7);
      } else if (this.bigAir) { this.addCoins(2); sfx("bigAir"); this.opts.onEvent({ k: "air", coins: 2 }); }
      this.airSpin = 0; this.bigAir = false; this.mood = "happy";
    }
    this.pickups();
    // checkpoints
    const cps = this.course.checkpoints;
    if (this.cp < cps.length && R.x > cps[this.cp].x && R.grounded) {
      this.cp++; this.art.cpPassed = this.cp;
      sfx("checkpoint");
      this.fx.burst(CONFETTI, cps[this.cp - 1].x, cps[this.cp - 1].y + 3, 26, 5, 1.6, 0.14, 6);
      this.opts.onEvent({ k: "checkpoint", n: this.cp });
      this.opts.onCheckpoint(this.stage, this.cp);
    }
    // crash rules
    if (R.shieldHit) {
      R.shieldHit = false; this.power.shield = 0; R.shield = false; sfx("shieldPop");
      const hp = R.headPos({ x: 0, y: 0 });
      this.fx.burst(RING, hp.x, hp.y, 1, 0, 0.6, 2.2, 14); this.fx.burst(SPARKLE, hp.x, hp.y, 12, 4, 0.6, 0.2, 14);
    }
    this.roofT = Math.cos(R.a) < -0.3 && R.speed < 0.6 ? this.roofT + sdt : 0;
    if (R.headHit) this.crash("head");
    else if (this.inPit() || R.y < W.killY) this.crash("fall");
    else if (this.roofT > 1.2) this.crash("roof");
    if (this.mood !== "wow" && Math.cos(R.a) < -0.1) this.mood = "scared";
    else if (this.mood === "scared" && Math.cos(R.a) > 0.5) this.mood = "happy";
    if (R.x > this.course.finish.x && R.grounded) this.finish();
  }

  private inPit() {
    const R = this.car;
    for (const p of this.course.pits) if (R.x > p.x0 && R.x < p.x1 && R.y < p.kill) return true;
    return false;
  }

  private pickups() {
    const R = this.car, items = this.course.items;
    const mag = this.power.magnet > 0;
    for (const it of items) {
      if (it.taken) continue;
      const dx = it.x - R.x;
      if (dx < -8) continue;
      if (dx > 10) break;
      if (mag && (it.kind === "coin" || it.kind === "star")) {
        const d = Math.hypot(dx, it.y - (R.y + 0.4));
        if (d < 7 && d > 0.01) { it.x -= (dx / d) * 0.3; it.y -= ((it.y - R.y - 0.4) / d) * 0.3; }
      }
      const reach = it.kind === "coin" ? 1.15 : 1.45;
      const hx = it.x - R.x, hy = it.y - (R.y + 0.4);
      if (hx * hx + hy * hy < reach * reach || this.wheelNear(it)) this.take(it);
    }
  }
  private wheelNear(it: Item) {
    const R = this.car;
    for (let i = 0; i < 2; i++) { const rr = R.rad[i] + 0.45, dx = it.x - R.wx[i], dy = it.y - R.wy[i]; if (dx * dx + dy * dy < rr * rr) return true; }
    return false;
  }
  private take(it: Item) {
    it.taken = true;
    const pan = clamp((it.x - this.cam.x) / 10, -0.8, 0.8);
    if (it.kind === "coin" || it.kind === "star") {
      const v = it.kind === "star" ? 10 : 1;
      this.addCoins(v); this.stageCoins += v;
      sfx(it.kind === "star" ? "star" : "coin", { pan, rate: 0.95 + Math.random() * 0.12 });
      this.fx.burst(SPARKLE, it.x, it.y, it.kind === "star" ? 12 : 4, 2.5, 0.5, it.kind === "star" ? 0.3 : 0.18, it.kind === "star" ? 15 : 7);
      if (it.kind === "star") this.opts.onEvent({ k: "pickup", what: "star" });
    } else if (it.kind === "fuel") {
      this.fuel = this.tank; this.lowWarned = false; this.outOfFuel = 0;
      sfx("fuel", { pan }); this.fx.burst(RING, it.x, it.y, 1, 0, 0.5, 1.6, 12); this.fx.burst(SPARKLE, it.x, it.y, 8, 3, 0.6, 0.22, 12);
      this.opts.onEvent({ k: "pickup", what: "fuel" });
    } else if (it.kind === "heart") {
      this.lives = Math.min(5, this.lives + 1); this.opts.onLives(this.lives);
      sfx("heart", { pan }); this.fx.burst(SPARKLE, it.x, it.y, 12, 3, 0.8, 0.3, 6);
      this.opts.onEvent({ k: "pickup", what: "heart" });
    } else if (it.power) {
      const p = POWERS.find((x) => x.id === it.power)!;
      this.power[p.id] = p.secs;
      this.applyPowers();
      sfx("power", { pan }); sfx(p.id, { delay: 0.08 });
      this.fx.burst(RING, it.x, it.y, 1, 0, 0.6, 2, 7 + ["turbo", "shield", "magnet", "float", "grip"].indexOf(p.id));
      this.opts.onEvent({ k: "pickup", what: p.id });
    }
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }

  private crash(why: Why) {
    if (this.mode !== "play") return;
    this.why = why;
    if (this.stuck) {
      this.setMode("crash"); this.modeT = 1.5; this.mood = "scared";
      this.opts.onEvent({ k: "stuck" });
      return;
    }
    this.stats.crashes++;
    this.lives = Math.max(0, this.lives - 1);
    this.opts.onLives(this.lives);
    this.setMode("crash");
    this.mood = why === "fuel" ? "scared" : "dizzy";
    const liquid = this.look.world.liquid;
    sfx(why === "fuel" ? "sputter" : why === "fall" && liquid !== "void" && liquid !== "space" && liquid !== "cloud" ? "splash" : "crash");
    if (why === "head" || why === "roof") {
      this.cam.shake = this.reduced ? 0.2 : 0.8;
      const hp = this.car.headPos({ x: 0, y: 0 });
      this.fx.burst(SMOKE, hp.x, hp.y, 10, 2, 1.2, 0.3, 4);
      this.fx.burst(SPARKLE, hp.x, hp.y + 0.4, 8, 3, 0.8, 0.28, 7);
    } else if (why === "fall") {
      const R = this.car;
      for (let k = 0; k < 20; k++) this.fx.spawn(DROP, R.x + (Math.random() - 0.5) * 2, R.y, (Math.random() - 0.5) * 4, 3 + Math.random() * 5, 1, 0.1, liquid === "choc" ? 16 : 17);
    }
    this.audio?.silence();
    this.opts.onEvent({ k: "crash", why, livesLeft: this.lives });
  }
  private crashStep() {
    if (this.modeT < 2.1) return;
    if (this.lives <= 0) {
      // out of lives: back one checkpoint further (on these long courses, not all the way to the start)
      this.lives = 3; this.opts.onLives(3);
      this.cp = Math.max(0, this.cp - 1); this.stuck = false;
      const from = this.cp > 0 ? this.course.checkpoints[this.cp - 1].x : -Infinity;
      for (const it of this.course.items) if (it.x0 > from) { it.taken = false; it.x = it.x0; it.y = it.y0; }
      this.art.cpPassed = this.cp;
      this.power = { turbo: 0, shield: 0, magnet: 0, float: 0, grip: 0 };
      this.place();
      this.setMode("intro"); this.snapCamera();
      this.opts.onEvent({ k: "restart" });
      sfx("lifeLost");
      return;
    }
    this.stuck = false;
    this.power = { turbo: 0, shield: 0, magnet: 0, float: 0, grip: 0 };
    this.place();
    this.setMode("intro"); this.modeT = 1.0;
    this.snapCamera();
    this.opts.onEvent({ k: "respawn" });
  }
  private introStep() {
    if (this.modeT > 2.3) {
      this.setMode("play");
      sfx("go");
      this.ensureAudio();
      this.opts.onEvent({ k: "go" });
    } else if (Math.abs(this.modeT - 1.3) < 0.02 || Math.abs(this.modeT - 1.8) < 0.02) sfx("beep");
  }
  private attractStep() {
    // the demo drive loops: back to the start after the finish or a spill
    const R = this.car, W = this.course.physics;
    const fell = R.headHit || this.inPit() || R.y < W.killY;
    this.stuckBot = R.speed < 0.2 ? this.stuckBot + 1 / 60 : 0;
    if (fell || R.x > this.course.finish.x + 6 || this.stuckBot > 14) { this.cp = 0; this.place(); this.cam.x = R.x + 4; this.cam.y = R.y + 1; }
  }
  private finish() {
    if (this.mode !== "play") return;
    this.setMode("finish");
    this.mood = "cheer";
    sfx("finish");
    const f = this.course.finish;
    for (let k = 0; k < 3; k++) this.fx.burst(CONFETTI, f.x + (k - 1) * 2.5, f.y + 5, this.quality === "low" ? 30 : 55, 7, 2.4, 0.16, 6, 4);
  }
  private finishStep() {
    if (this.modeT > 2.2 && this.mode === "finish") {
      const par = (this.course.finish.x - this.course.start.x) / (topSpeed(this.course.vehicle) * 0.42) + this.course.hints.filter((h) => h.k === "ride" || h.k === "gate" || h.k === "timed").length * 4;
      const stars = this.stats.crashes === 0 ? (this.stats.time <= par ? 3 : 2) : this.stats.crashes <= 2 ? 2 : 1;
      const s: StageStats = { stage: this.stage, coins: this.stageCoins, time: this.stats.time, flips: this.stats.flips, crashes: this.stats.crashes, stars };
      this.setMode("over");
      this.audio?.silence();
      this.opts.onEvent({ k: "finish", stats: s });
    }
  }

  // ---------------------------------------------------------------- camera
  private previewLen() { return clamp(1.8 + (this.course.finish.x - this.course.start.x) / 180, 2.4, 5.5); }
  private snapCamera() {
    const R = this.car;
    if (this.mode === "preview") { this.cam.x = this.course.finish.x; this.cam.y = this.course.finish.y + 3; this.cam.z = 0.6; this.cam.bars = 1; }
    else { this.cam.x = R.x + 3; this.cam.y = R.y + 1.2; this.cam.z = 1; this.cam.bars = 0.5; }
    this.cam.rot = 0; this.cam.fz = 0;
    this.lastCamX = this.cam.x; this.lastCamY = this.cam.y;
  }
  private updateCamera(dt: number) {
    const R = this.car, cam = this.cam, m = this.mode, c = this.course;
    const portrait = this.H > this.W;
    const sp = R.speed;
    const h = c.heightAt(R.x);
    const above = Number.isFinite(h) ? R.y - h : 2;
    let tx = R.x + clamp(R.vx * 0.3, -2.5, portrait ? 3 : 6) + (portrait ? 1.2 : 3.2);
    let ty = R.y + 1.1 + clamp(R.vy * 0.1, -1.6, 1.6);
    let tz = 1 / (1 + clamp(sp / 30, 0, portrait ? 0.25 : 0.4) + clamp((above - 2.2) / 14, 0, 0.3));
    let slow = 1, bars = 0, follow = 3.4;
    // cinematic framing of the big contraptions
    let zw = 0, zx = 0, zy = 0, zz = 1;
    if (m === "play" || m === "attract") for (const z of c.cams) {
      if (R.x < z.x0 - 3 || R.x > z.x1 + 3) continue;
      const w = clamp(Math.min(R.x - (z.x0 - 3), z.x1 + 3 - R.x) / 3, 0, 1);
      if (w > zw) { zw = w; zx = z.fx; zy = z.fy; zz = z.z; }
    }
    if (zw > 0) { tx = lerp(tx, zx, zw * 0.55); ty = lerp(ty, zy, zw * 0.55); tz = lerp(tz, tz * zz, zw); bars = zw * 0.25; }
    if (m === "attract") {
      const sc = this.camBase * 0.8;
      tz = 0.8; follow = 2.2;
      tx = R.x + (this.W * (portrait ? 0.05 : this.H < 520 ? 0.32 : 0.15)) / sc;
      ty = R.y + 0.8 - (this.H * (portrait ? 0.16 : 0.12)) / sc;
    } else if (m === "preview") {
      // glide from the finish back to the car
      const u = clamp(this.modeT / this.previewLen(), 0, 1), e = u * u * (3 - 2 * u);
      tx = lerp(c.finish.x, R.x + (portrait ? 1.2 : 3.2), e); ty = lerp(c.finish.y + 3, R.y + 1.2, e) + Math.sin(u * Math.PI) * 3;
      tz = lerp(0.6, 0.95, e) - Math.sin(u * Math.PI) * 0.08; bars = 1; follow = 9;
    } else if (m === "intro") {
      tz = 1.05; bars = Math.max(0, 0.8 - this.modeT * 0.5); follow = 5;
    } else if (m === "crash") {
      const hp = R.headPos({ x: 0, y: 0 });
      slow = this.why === "fuel" ? 1 : this.modeT < 1.0 ? 0.3 : 0.7;
      tx = hp.x; ty = Math.max(hp.y + 0.5, (this.why === "fall" ? R.y + 2 : -Infinity)); tz = this.why === "fuel" ? 1.1 : 1.4; bars = 0.85; follow = 2.4;
    } else if (m === "finish" || m === "over") {
      slow = this.modeT < 1.3 ? 0.35 : 0.85;
      tx = R.x + 1; ty = R.y + 1.3; tz = 1.3; bars = 0.9; follow = 2;
    } else if (R.airTime > 0.7 && above > 3.2) {
      tz *= 0.86; slow = this.reduced ? 1 : 0.8; bars = Math.max(bars, 0.35);
    }
    const k = 1 - Math.exp(-dt * follow);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * (1 - Math.exp(-dt * (m === "preview" ? 6 : 2)));
    cam.slow += (slow - cam.slow) * (1 - Math.exp(-dt * 8));
    cam.bars += (bars - cam.bars) * (1 - Math.exp(-dt * 4));
    const tr = this.reduced || m === "preview" ? 0 : clamp(R.a * 0.06, -0.05, 0.05);
    cam.rot += (tr - cam.rot) * (1 - Math.exp(-dt * 1.5));
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
  }

  // ---------------------------------------------------------------- drawing
  private render(dt: number) {
    const c = this.c, W = this.W, H = this.H, cam = this.cam, L = this.look, t = this.time;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scale = this.camBase * cam.z;
    const dy = cam.y - this.startY;
    this.sky.draw(c, W, H, cam.x, dy, t, dt);
    // backdrop layers (parallax)
    const sH = (H / STRIP_H) * 1.0;
    for (let i = 0; i < 3; i++) {
      const s = this.strips[i];
      const sw = STRIP_W * sH, sh = STRIP_H * sH;
      const shift = clamp(dy * scale * [0.05, 0.1, 0.18][i] * 0.35, -H * 0.12, H * 0.3);
      const bottom = H * (H > W ? BASES_TALL : BASES_WIDE)[i] + shift;
      const off = -(((cam.x * scale * PAR[i]) % sw) + sw) % sw;
      for (let x = off; x < W; x += sw) c.drawImage(s.canvas, x, bottom - sh, sw + 1, sh);
      if (bottom < H) { c.fillStyle = s.base; c.fillRect(0, bottom - 1, W, H - bottom + 1); }
      if (i === 0) this.sky.drawMid(c, W, H, cam.x, dy, t, dt);
    }
    // the world
    const shx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.5 : 0, shy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.5 : 0;
    const portrait = H > W;
    c.save();
    c.translate(W * 0.5, H * (portrait ? 0.56 : 0.58)); c.rotate(cam.rot); c.scale(scale, -scale); c.translate(-(cam.x + shx), -(cam.y + shy));
    const hw = (W / scale) * 0.75 + 4, hh = (H / scale) * 0.75 + 4;
    const v: View = { x0: cam.x - hw, x1: cam.x + hw, y0: cam.y - hh, y1: cam.y + hh, scale };
    this.art.drawPits(c, v, t);
    this.art.drawDecosBack(c, v, t);
    for (const p of this.course.props) if (p.x > v.x0 - 3 && p.x < v.x1 + 3) this.props.draw(c, p.x, p.y, p.s, p.seed, p.flip);
    this.art.drawGround(c, v, t);
    this.art.drawBodies(c, v, t);
    for (const it of this.course.items) if (!it.taken && it.x > v.x0 - 1 && it.x < v.x1 + 1) this.items.draw(c, it, t, L.night);
    this.fx.draw(c, v.x0, v.x1);
    drawCar(c, this.car, this.ant, {
      mood: this.mood, blink: t % 3.3 < 0.12, gas: this.pedals.gas, t, shield: this.power.shield, turbo: this.power.turbo > 0, float: this.power.float > 0, grip: this.power.grip > 0, night: L.night, paint: this.opts.paint,
    });
    this.art.drawDecosFront(c, v, t);
    c.restore();
    // weather and the grade
    this.weather.draw(c, W, H, dt, t, (cam.x - this.lastCamX) * scale, (cam.y - this.lastCamY) * scale);
    this.lastCamX = cam.x; this.lastCamY = cam.y;
    // (budget phones skip the two full-screen grading layers: the palette already carries the mood's tint)
    const lite = this.quality === "low";
    if (L.mood.tintAmt > 0 && !lite) { c.fillStyle = rgba(L.mood.tint, L.mood.tintAmt * 0.22); c.fillRect(0, 0, W, H); }
    if (!this.vignette && !lite) {
      const vg = document.createElement("canvas"); vg.width = 256; vg.height = 256;
      const g = vg.getContext("2d")!, rg = g.createRadialGradient(128, 140, 80, 128, 140, 200);
      rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, `rgba(0,0,0,${0.24 + L.night * 0.2})`);
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
      this.vignette = vg;
    }
    if (this.vignette && !lite) c.drawImage(this.vignette, 0, 0, W, H);
    if (this.power.turbo > 0 || this.power.float > 0) {
      // a soft glow at the screen's edges in the power's colour
      const id = this.power.turbo > 0 ? "turbo" : "float";
      if (!this.edgeGlow || this.edgeGlowId !== id) {
        const cv = document.createElement("canvas"); cv.width = 64; cv.height = 4;
        const g = cv.getContext("2d")!, lg = g.createLinearGradient(0, 0, 64, 0);
        lg.addColorStop(0, rgba(powerColor(id), 0.5)); lg.addColorStop(1, rgba(powerColor(id), 0));
        g.fillStyle = lg; g.fillRect(0, 0, 64, 4);
        this.edgeGlow = cv; this.edgeGlowId = id;
      }
      const gw = Math.max(40, W * 0.08);
      c.globalAlpha = 0.65 + 0.2 * Math.sin(t * 6);
      c.drawImage(this.edgeGlow, 0, 0, gw, H);
      c.save(); c.translate(W, 0); c.scale(-1, 1); c.drawImage(this.edgeGlow, 0, 0, gw, H); c.restore();
      c.globalAlpha = 1;
    }
    if (cam.bars > 0.01) {
      const bh = H * 0.085 * cam.bars;
      c.fillStyle = "#05060D"; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    }
    // the engine
    if (this.audio) {
      const R = this.car;
      const spin = Math.abs((R.omega[0] + R.omega[1]) * 0.5) / R.spec.maxSpin;
      const play = this.mode === "play";
      this.audio.update(dt, clamp(0.08 + spin * 0.85 + this.pedals.gas * (R.grounded ? 0.05 : 0.3), 0, 1), play ? this.pedals.gas : 0, clamp(R.speed / 15, 0, 1), !R.grounded);
    }
  }

  private pushHud() {
    const R = this.car, c = this.course, plan = c.plan;
    const start = c.start.x, len = c.finish.x - start;
    const h: Hud = {
      stage: this.stage, fuel: this.fuel / this.tank, lives: this.lives, coins: this.coins, stageCoins: this.stageCoins,
      progress: clamp((R.x - start) / len, 0, 1), checkpoints: c.checkpoints.map((p) => (p.x - start) / len),
      powers: POWERS.filter((p) => this.power[p.id] > 0).map((p) => ({ id: p.id, left: this.power[p.id], secs: p.secs })),
      mode: this.mode, lowFuel: this.fuel / this.tank < 0.25,
      title: plan.title, subtitle: plan.subtitle, remix: plan.remix > 0, summit: plan.summit, finale: plan.finale, world: c.world.id, accent: c.world.accent,
      ride: c.vehicle.name, fresh: plan.fresh ? GIZMO_NAME[plan.fresh] : null,
    };
    this.opts.onHud(h);
  }

  /** for the menus: the demo drive */
  attract() { this.setMode("attract"); this.audio?.silence(); this.cp = 0; this.place(); this.snapCamera(); }
}
