// Tumble Truck's game: the loop, the stage, the rules and the cinematic camera.
//  - a stage opens with a fly-in: the camera sweeps from the road ahead back to the truck under letterbox bars while
//    the load settles in the bed, then a 3-2-1 and GO;
//  - the camera leads the truck, pulls back with speed and big air, tilts a touch with the hills, shakes on hard
//    landings, goes slow-motion for big jumps, a piece of cargo flying out, crashes and the delivery;
//  - fuel drains with the throttle (cans refill it), coins bank at once, hearts add lives, power-ups run on timers
//    (nitro, a cargo net over the bed, bubble wrap for fragile loads, a coin magnet, double coins);
//  - the load is the stage: a piece that falls out or breaks is gone, and when fewer than the stage needs are left the
//    run fails. A crash (roof on the ground, a fall into a gap, out of fuel) or a failed load costs a life and puts the
//    truck back at the last checkpoint with the load it had there; with no lives left the stage starts again;
//  - rolling onto the delivery pad stops the truck in slow motion, counts the load and awards stars, and the UI moves
//    straight on to the next stage.
import { FrameGovernor, autoQuality, isPhone, pixelRatioFor, type Quality } from "@/lib/perf";
import { ABOARD, BROKEN, LOST, STEP, Truck, type Pedals } from "./physics";
import { buildCourse, POWERS, type Course, type Item, type PowerId } from "./terrain";
import { stackLoad, CARGO, type CargoKind } from "./cargo";
import { bedLength, tuned, truckOf, type Levels, type TruckId } from "./trucks";
import { lookFor, type Look } from "./art/grade";
import { paintBackdrop, STRIP_H, STRIP_W, type Backdrop } from "./art/backdrop";
import { Sky } from "./art/sky";
import { GroundArt, drawItem, POWER_COLOR, type View } from "./art/ground";
import { PropSprites, propMotion } from "./art/props";
import { Animals } from "./art/animals";
import { CargoSprites, drawLooseCargo, drawTruck, type Mood, type TruckFx } from "./art/truck";
import { CONFETTI, DIRT, DUST, MUD, Particles, RING, SHARD, SMOKE, SPARK, SPARKLE, SPLASH, STAR, WeatherFx } from "./art/fx";
import { ANIMAL_CALL, HaulAudio, ambient, sfx, type HaulSfx } from "./sound";
import { clamp, lerp, mix, rgba, shade } from "./util";

export type Mode = "attract" | "intro" | "play" | "crash" | "deliver" | "over";
export interface Hud {
  stage: number; fuel: number; lives: number; coins: number; stageCoins: number; progress: number; checkpoints: number[];
  distance: number; speed: number; powers: { id: PowerId; left: number; secs: number }[]; mode: Mode; lowFuel: boolean;
  title: string; subtitle: string; remix: boolean; big: boolean; world: string; accent: string;
  cargo: CargoKind[]; aboard: number; count: number; need: number; from: string; to: string; wind: number;
}
export type GameEvent =
  | { k: "go" } | { k: "checkpoint"; n: number } | { k: "air"; secs: number; coins: number }
  | { k: "pickup"; what: "fuel" | "heart" | PowerId } | { k: "cargo"; what: "lost" | "broke"; left: number; need: number; kind: CargoKind }
  | { k: "crash"; why: "roof" | "fall" | "fuel" | "cargo"; livesLeft: number } | { k: "respawn" } | { k: "restart" }
  | { k: "deliver"; stats: StageStats } | { k: "lowFuel" } | { k: "stuck" } | { k: "wind" };
export interface StageStats { stage: number; coins: number; bonus: number; time: number; delivered: number; count: number; need: number; stars: number; crashes: number; kind: CargoKind }

export interface GameOptions {
  truck: TruckId; levels: Levels; lives: number; coins: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  onCoins: (total: number) => void; onLives: (n: number) => void; onCheckpoint: (stage: number, cp: number, carry: number) => void;
}

export class Game {
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1; private quality: Quality;
  private gov: FrameGovernor | null = null; private govScale = 1;
  private raf = 0; private lastT = 0; private acc = 0; private time = 0;
  private running = false;

  course!: Course; look!: Look; private backdrop!: Backdrop; private sky!: Sky; private ground!: GroundArt; private props!: PropSprites;
  private animals!: Animals; private cargoArt!: CargoSprites;
  private weather!: WeatherFx;
  private fx: Particles;
  truck!: Truck;
  private vignette: HTMLCanvasElement | null = null;

  private audio: HaulAudio | null = null;
  mode: Mode = "attract";
  stage = 1;
  private pedals: Pedals = { gas: 0, brake: 0 };
  private keys = { gas: false, brake: false };
  private touch = { gas: 0, brake: 0 };
  // rules
  fuel = 100; private fuelMax = 100; lives = 3; coins = 0; private stageCoins = 0; private cp = 0; private carry = 0;
  private power: Record<PowerId, number> = { nitro: 0, net: 0, bubble: 0, magnet: 0, double: 0 };
  private stats = { air: 0, crashes: 0, time: 0 };
  private outOfFuel = 0; private lowWarned = false; private upside = 0;
  private airStart = 0; private bigAirDone = false;
  private modeT = 0; private crashWhy: "roof" | "fall" | "fuel" | "cargo" = "roof";
  private bestX = 0; private bestT = 0; private stuck = false;
  private prevState = new Uint8Array(16);
  private delivered = 0; private starsShown = 0; private padding = 1;
  private wind = 0; private inWind = false; private wasWet = false; private creakT = 0; private thudT = 0;
  // camera
  private cam = { x: 0, y: 0, z: 1, rot: 0, shake: 0, bars: 0, slow: 1, focusX: 0, focusY: 0, focus: 0 };
  private camBase = 30;
  private startY = 0;
  private slowMo = 0;
  private mood: Mood = "happy";
  private hudT = 0;
  private lastCamX = 0; private lastCamY = 0;
  private opts: GameOptions;
  private reduced = false;
  private fxState: TruckFx = { mood: "happy", blink: false, gas: 0, brake: 0, t: 0, nitro: false, net: false, bubble: false, night: 0, light: "#FFFFFF" };
  private view: View = { x0: 0, x1: 0, y0: 0, y1: 0, scale: 1 };
  private tmp = { x: 0, y: 0 };

  constructor(private host: HTMLElement, opts: GameOptions) {
    this.opts = opts;
    this.quality = autoQuality();
    this.cv = document.createElement("canvas");
    this.cv.className = "tt-canvas";
    host.appendChild(this.cv);
    this.c = this.cv.getContext("2d", { alpha: false })!;
    this.fx = new Particles(this.quality === "low" ? 200 : 360);
    this.lives = opts.lives; this.coins = opts.coins;
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    this.gov = new FrameGovernor((s) => { this.govScale = s; this.resize(); }, 0.6);
    // QA and the art script (scripts/art/haul_art.py) look at the game through this
    (window as unknown as { __tumbleTruck?: Game }).__tumbleTruck = this;
  }

  // ---------------------------------------------------------------- setup
  private resize = () => {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.dpr = pixelRatioFor(this.quality) * this.govScale;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = `${this.W}px`; this.cv.style.height = `${this.H}px`;
    // pixels per metre: about 20 m across a landscape screen; on a portrait phone about 11 m, the truck stays big
    const portrait = this.H > this.W;
    this.camBase = portrait ? Math.min(this.W / 8.2, this.H / 13) : Math.max(this.W / 19, this.H / 11);
    this.vignette = null;
  };

  setTruck(id: TruckId, levels: Levels) {
    this.opts.truck = id; this.opts.levels = levels;
    if (!this.course) return;
    this.load(this.stage, this.cp, this.mode === "attract" ? "attract" : "intro");
    this.audio?.dispose(); this.audio = null;
  }
  private spec() { return tuned(truckOf(this.opts.truck), this.opts.levels); }
  private gravity() { return this.course.gravity; }

  /** build a stage; `cp` = checkpoint to start from (resume), `carry` = pieces aboard there (0: the full load) */
  load(stage: number, cp = 0, mode: Mode = "intro", carry = 0) {
    this.stage = stage;
    this.course = buildCourse(stage);
    this.look = lookFor(this.course.plan);
    const res = isPhone() ? 0.85 : 1.15;
    this.backdrop = paintBackdrop(this.look, this.course.plan.seed, res);
    this.sky = new Sky(this.look, this.course.plan.seed);
    this.ground = new GroundArt(this.course, this.look);
    this.props = new PropSprites(this.look, isPhone() ? 34 : 48);
    this.animals = new Animals(this.course.animals, this.look.night, this.look.tint, this.look.tintAmt);
    this.cargoArt = new CargoSprites(this.look.night);
    const wc = (this.quality === "low" ? 60 : this.quality === "medium" ? 110 : 160) * (this.reduced ? 0.3 : 1);
    this.weather = new WeatherFx(this.course.plan.weather, Math.round(wc), { leaf: ["#E8712A", "#F2A33A", "#C9402A", "#FFD23F"], glow: this.look.glow, haze: this.look.haze });
    const l = this.look;
    const kind = this.course.plan.cargo[0];
    this.fx.setPalette([
      l.surface, shade(l.soil[0], 0.1), l.soil[0], mix(l.surface, l.haze, 0.5), // 0-3 ground
      "#B9BCC9", "#FFD27A", // 4 exhaust, 5 spark
      "#FF5D8F", "#FFD23F", "#2EC4B6", "#7B5CFF", "#FF8A3D", // 6-10 confetti
      "#FFFFFF", "#7CC8FF", "#5A3A22", // 11 white, 12 water, 13 mud
      CARGO[kind].color, CARGO[kind].dark, "#FFF3B0", // 14-16 shards & stars
      "#3EE08F", "#FF4F7A", "#7CF5FF", // 17-19 pickups
    ]);
    this.fx.clear();
    this.power = { nitro: 0, net: 0, bubble: 0, magnet: 0, double: 0 };
    this.cp = Math.min(cp, this.course.checkpoints.length);
    this.carry = this.cp > 0 && carry > 0 ? Math.min(carry, this.course.plan.count) : this.course.plan.count;
    this.stageCoins = 0; this.stats = { air: 0, crashes: 0, time: 0 };
    this.place();
    this.startY = this.truck.y;
    this.audio?.setAmbience(this.course.world.ambience);
    this.setMode(mode);
    this.snapCamera(mode === "intro");
    this.pushHud();
  }

  private place() {
    const spec = this.spec();
    this.truck = new Truck(spec);
    this.truck.gravity = this.gravity(); this.truck.gripMul = this.course.world.grip; this.truck.toughness = spec.padding;
    this.padding = spec.padding;
    this.fuelMax = spec.fuel; this.fuel = spec.fuel;
    const x = this.cp > 0 ? this.course.checkpoints[this.cp - 1] + 2 : 2;
    this.truck.place(this.course.terrain, x);
    this.truck.loadCargo(stackLoad(this.course.plan.cargo, this.carry, bedLength(spec), this.course.plan.seed + this.cp));
    // let the load settle before anyone sees it
    for (let i = 0; i < 160; i++) this.truck.step(this.course.terrain, { gas: 0, brake: 0 });
    this.prevState = new Uint8Array(this.truck.cargo.length);
    this.outOfFuel = 0; this.lowWarned = false; this.mood = "happy"; this.upside = 0;
    this.bigAirDone = false;
    this.bestX = this.truck.x; this.bestT = 0;
    this.animals.reset();
  }

  private setMode(m: Mode) { this.mode = m; this.modeT = 0; }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      // a frame's timestamp can come before the last one (the first frame after start, a tab coming back):
      // a negative step would run the camera and the shake backwards, so it is skipped
      const dt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (dt > 0) this.frame(Math.min(0.05, dt));
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.audio?.silence(); }
  get isRunning() { return this.running; }

  play() { this.setMode("intro"); this.snapCamera(true); this.ensureAudio(); }
  private ensureAudio() {
    if (!this.audio) { this.audio = new HaulAudio(this.truck.spec.voice); this.audio.start(this.course.world.ambience); }
  }

  setTouch(gas: number, brake: number) { this.touch.gas = gas; this.touch.brake = brake; }
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === "keydown";
    const k = e.key;
    if (k === "ArrowRight" || k === "d" || k === "D") { this.keys.gas = down; e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "a" || k === "A") { this.keys.brake = down; e.preventDefault(); }
    else if (k === "ArrowUp" || k === "ArrowDown" || k === " ") e.preventDefault();
  };

  dispose() {
    this.stop();
    const w = window as unknown as { __tumbleTruck?: Game };
    if (w.__tumbleTruck === this) delete w.__tumbleTruck;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.gov?.dispose?.();
    this.audio?.dispose();
    this.cv.remove();
  }

  // ---------------------------------------------------------------- loop
  frame(dt: number) {
    if (!(dt > 0)) return;
    this.time += dt;
    this.modeT += dt;
    const sdt = dt * this.cam.slow;
    this.updateRules(sdt);
    this.acc += sdt;
    let steps = 0;
    const T = this.course.terrain;
    while (this.acc >= STEP && steps < 24) { this.truck.step(T, this.pedals); this.acc -= STEP; steps++; }
    if (steps >= 24) this.acc = 0;
    const R = this.truck;
    if (!Number.isFinite(R.x + R.y + R.a + R.vx + R.wx[0] + R.wy[1])) { this.place(); this.cam.x = R.x; this.cam.y = R.y; }
    this.afterPhysics(sdt);
    this.fx.update(sdt, R.gravity);
    const fled = this.animals.update(sdt, R.x, Math.max(0, R.forward), (x) => T.heightAt(x));
    if (fled >= 0 && (this.mode === "play" || this.mode === "intro")) ambient(ANIMAL_CALL[this.animals.kindOf(fled)], clamp((this.animals.x[fled] - this.cam.x) / 10, -0.9, 0.9), 0.45);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private updateRules(sdt: number) {
    const R = this.truck, m = this.mode;
    let gas = 0, brake = 0;
    if (m === "play") {
      gas = Math.max(this.keys.gas ? 1 : 0, this.touch.gas);
      brake = Math.max(this.keys.brake ? 1 : 0, this.touch.brake);
      if (this.fuel <= 0) gas = 0;
    } else if (m === "deliver") {
      // roll onto the pad and stop gently (no reversing)
      gas = 0; brake = R.forward > 0.4 ? 0.55 : 0;
    }
    this.pedals.gas = gas; this.pedals.brake = brake;
    // wind (gusting) wherever it blows
    let w = 0;
    for (const z of this.course.winds) if (R.x > z.x0 && R.x < z.x1) w = z.s * (0.65 + 0.35 * Math.sin(this.time * 1.4 + z.x0));
    this.wind += (w - this.wind) * Math.min(1, sdt * 2);
    R.wind = m === "play" ? this.wind : 0;
    if (w !== 0 && !this.inWind && m === "play") { this.inWind = true; sfx("whoosh", { gain: 0.8 }); ambient("gust", -0.4, 0.5); this.opts.onEvent({ k: "wind" }); }
    if (w === 0) this.inWind = false;
    if (m !== "play") return;
    this.stats.time += sdt;
    const boost = this.power.nitro > 0;
    const use = R.spec.fuelUse * (0.12 + 0.88 * gas) * (boost ? 0.2 : 1);
    this.fuel = Math.max(0, this.fuel - use * sdt);
    if (this.fuel / this.fuelMax < 0.22 && !this.lowWarned) { this.lowWarned = true; sfx("lowFuel"); this.opts.onEvent({ k: "lowFuel" }); }
    if (this.fuel / this.fuelMax > 0.35) this.lowWarned = false;
    if (this.fuel <= 0) { this.outOfFuel = R.speed < 0.5 ? this.outOfFuel + sdt : 0; if (this.outOfFuel > 1.6) this.crash("fuel"); }
    // stuck: no headway for 10 s while trying to drive → back to the checkpoint (no life lost)
    this.bestT += sdt;
    if (R.x > this.bestX + 2) { this.bestX = R.x; this.bestT = 0; }
    if (this.bestT > 10 && gas > 0 && this.fuel > 0) { this.stuck = true; this.crash("roof"); return; }
    for (const p of POWERS) if (this.power[p.id] > 0) this.power[p.id] = Math.max(0, this.power[p.id] - sdt);
    R.net = this.power.net > 0;
    R.toughness = this.padding * (this.power.bubble > 0 ? 1.8 : 1);
  }

  private afterPhysics(sdt: number) {
    const R = this.truck, T = this.course.terrain, m = this.mode;
    const q = this.quality === "low" ? 0.5 : 1;
    // tyres: dust, dirt, mud, splashes
    for (let i = 0; i < 2; i++) {
      if (!R.touch[i]) continue;
      const sp = Math.abs(R.omega[i] * R.spec.wheel.r);
      const gx = R.wx[i] - 0.3, gy = R.wy[i] - R.spec.wheel.r * 0.8;
      const mud = T.zoneAt(R.wx[i]) === 1;
      if ((R.slip > 0.12 || (this.pedals.gas > 0 && sp > 3)) && Math.random() < 0.55 * q) {
        if (mud) { this.fx.spawn(MUD, gx, gy + 0.2, -R.vx * 0.2 - 1.5 - Math.random() * 3, 2 + Math.random() * 3, 0.8, 0.12 + Math.random() * 0.1, 13); if (Math.random() < 0.05) sfx("mud", { gain: 0.6 }); }
        else {
          this.fx.spawn(DUST, gx, gy, -R.vx * 0.2 - 1 - Math.random() * 2, 0.8 + Math.random() * 1.5, 0.9, 0.26 + Math.random() * 0.2, 3);
          if (Math.random() < 0.4) this.fx.spawn(DIRT, gx, gy, -2 - Math.random() * 3 - R.slip * 4, 2 + Math.random() * 3, 0.7, 0.08 + Math.random() * 0.06, Math.random() < 0.5 ? 1 : 2);
        }
      }
    }
    // water: a splash on the way in, a wake while wading
    const wet = R.water > 0.05;
    if (wet && !this.wasWet && R.speed > 2) {
      sfx("splash", { gain: clamp(R.speed / 8, 0.4, 1) });
      for (let k = 0; k < 18 * q; k++) this.fx.spawn(SPLASH, R.x + (Math.random() - 0.3) * 2, T.waterAt(R.x), (Math.random() - 0.3) * 5, 2 + Math.random() * 4, 0.9, 0.08 + Math.random() * 0.08, Math.random() < 0.5 ? 12 : 11);
    }
    if (wet && R.speed > 1 && Math.random() < 0.4 * q) this.fx.spawn(SPLASH, R.wx[1] + 0.6, T.waterAt(R.x), 1 + Math.random() * 2, 1 + Math.random() * 2, 0.6, 0.06 + Math.random() * 0.06, 12);
    this.wasWet = wet;
    // exhaust
    if (m === "play" && this.pedals.gas > 0 && Math.random() < 0.3 * q && R.spec.id !== "glowtail") {
      R.toWorld(R.spec.bed.x1 - 0.08, R.spec.cab.roof + 0.45, this.tmp);
      this.fx.spawn(SMOKE, this.tmp.x, this.tmp.y, -0.8 + R.vx * 0.4, 1.2 + R.vy * 0.4, 0.9, 0.16, 4);
    }
    if (this.power.nitro > 0 && Math.random() < 0.6 * q) { R.toWorld(R.spec.bed.x0 - 0.2, R.spec.bed.y, this.tmp); this.fx.spawn(SPARK, this.tmp.x, this.tmp.y, -R.vx * 0.2 - 3, (Math.random() - 0.5) * 2, 0.35, 0.08, 10); }
    if (R.scrape > 0.4 && Math.random() < 0.6) this.fx.spawn(SPARK, R.x, R.y - 0.5, -R.vx * 0.3 + (Math.random() - 0.5) * 3, Math.random() * 3, 0.4, 0.06, 5);
    // landings and knocks
    if (R.landing > 0) {
      const hard = R.landing > 6.5;
      if (m === "play" || m === "deliver") sfx(hard ? "landHard" : "land", { gain: clamp(R.landing / 10, 0.3, 1) });
      this.cam.shake = Math.max(this.cam.shake, clamp(R.landing / 14, 0, 0.6) * (this.reduced ? 0.3 : 1));
      for (let k = 0; k < (hard ? 12 : 6) * q; k++) this.fx.spawn(DUST, R.x + (Math.random() - 0.5) * 3, T.heightAt(R.x) + 0.1, (Math.random() - 0.5) * 4, Math.random() * 1.5, 1, 0.34, 3);
      R.landing = 0;
    }
    if (R.bodyHit > 2.5) { if (m === "play") sfx("bump", { gain: clamp(R.bodyHit / 8, 0.3, 1) }); R.bodyHit = 0; }
    R.scrape *= 0.8;
    // bridge creaks
    this.creakT -= sdt;
    if (m === "play" && this.creakT <= 0 && R.speed > 1 && this.course.bridges.some((b) => R.x > b.x0 && R.x < b.x1)) { this.creakT = 0.8 + Math.random(); sfx("creak", { rate: 0.85 + Math.random() * 0.3 }); }
    // the load: knocks, losses, breaks
    this.cargoEvents();
    if (m !== "play") { if (m === "crash") this.crashStep(); else if (m === "deliver") this.deliverStep(); else if (m === "intro") this.introStep(); return; }

    // big air
    if (!R.grounded) {
      if (R.airTime < 0.05) { this.airStart = this.time; this.bigAirDone = false; }
      if (R.airTime > 0.9 && !this.bigAirDone && R.y - T.heightAt(R.x) > 3.2) { this.bigAirDone = true; this.mood = "wow"; }
    } else if (this.bigAirDone) {
      const c = 10;
      this.addCoins(c); this.stats.air++; sfx("whoosh");
      this.opts.onEvent({ k: "air", secs: this.time - this.airStart, coins: c });
      this.bigAirDone = false; this.mood = "happy";
    }
    this.pickups();
    const cps = this.course.checkpoints;
    if (this.cp < cps.length && R.x > cps[this.cp]) {
      this.cp++;
      this.carry = R.aboard;
      sfx("checkpoint");
      this.fx.burst(CONFETTI, cps[this.cp - 1], T.heightAt(cps[this.cp - 1]) + 3.5, 26, 5, 1.6, 0.2, 6, 0, 5);
      this.opts.onEvent({ k: "checkpoint", n: this.cp });
      this.opts.onCheckpoint(this.stage, this.cp, this.carry);
    }
    if (R.roofHit) this.crash("roof");
    else if (this.inPit()) this.crash("fall");
    else if (R.x < T.x0 + 6) this.crash("fall");
    else if (R.aboard < this.course.plan.need) this.crash("cargo");
    // upside down and stopped
    this.upside = Math.cos(R.a) < -0.1 && R.speed < 1.2 ? this.upside + sdt : 0;
    if (this.upside > 1.2) this.crash("roof");
    if (this.mood !== "wow" && Math.cos(R.a) < 0.2) this.mood = "scared";
    else if (this.mood === "scared" && Math.cos(R.a) > 0.5) this.mood = "happy";
    if (R.x > this.course.finish + 1.5) this.deliver();
  }

  /** compare the load's states with last frame's: sounds, effects, slow motion, events */
  private cargoEvents() {
    const R = this.truck, cg = R.cargo, ps = this.prevState;
    this.thudT -= 1 / 60;
    for (let i = 0; i < cg.length; i++) {
      const q = cg[i], was = ps[i];
      if (q.state === was) continue;
      ps[i] = q.state;
      if (this.mode !== "play" && this.mode !== "deliver") continue;
      const pan = clamp((q.x - this.cam.x) / 10, -0.8, 0.8);
      if (q.state === LOST && was === ABOARD) {
        sfx("lost", { pan });
        if (!this.reduced) this.slowMo = 0.45;
        this.mood = "scared";
        this.opts.onEvent({ k: "cargo", what: "lost", left: R.aboard, need: this.course.plan.need, kind: q.kind });
      } else if (q.state === BROKEN) {
        const glassy = q.kind === "jar" || q.kind === "potion" || q.kind === "crystal" || q.kind === "orb";
        sfx(glassy ? "glass" : "crack", { pan });
        this.fx.burst(SHARD, q.x, q.y, 16, 3.5, 1.0, 0.07, 14, 2, 2);
        this.fx.burst(SPARKLE, q.x, q.y, 6, 2, 0.5, 0.18, 11);
        if (q.kind === "jar" || q.kind === "egg") this.fx.burst(SPLASH, q.x, q.y, 8, 2, 0.7, 0.07, q.kind === "jar" ? 5 : 11, 1);
        if (!this.reduced) this.slowMo = 0.5;
        this.mood = "dizzy";
        this.cam.shake = Math.max(this.cam.shake, 0.25);
        this.opts.onEvent({ k: "cargo", what: "broke", left: R.aboard, need: this.course.plan.need, kind: q.kind });
      }
    }
  }

  private inPit() {
    const R = this.truck;
    return this.course.pits.some((p) => R.x > p.x0 && R.x < p.x1 && R.y < this.course.terrain.heightAt(p.x0) - 5);
  }

  private pickups() {
    const R = this.truck, items = this.course.items;
    const mag = this.power.magnet > 0;
    for (const it of items) {
      if (it.taken) continue;
      const dx = it.x - R.x;
      if (dx < -7) continue;
      if (dx > 10) break;
      if (mag && it.kind === "coin") {
        const d = Math.hypot(dx, it.y - (R.y + 0.6));
        if (d < 8 && d > 0.01) { it.x -= (dx / d) * 0.4; it.y -= ((it.y - R.y - 0.6) / d) * 0.4; }
      }
      const reach = it.kind === "coin" ? 1.5 : 1.8;
      const hx = it.x - R.x, hy = it.y - (R.y + 0.6);
      if (hx * hx + hy * hy < reach * reach || this.wheelNear(it)) this.take(it);
    }
  }
  private wheelNear(it: Item) {
    const R = this.truck, rr = R.spec.wheel.r + 0.45;
    for (let i = 0; i < 2; i++) { const dx = it.x - R.wx[i], dy = it.y - R.wy[i]; if (dx * dx + dy * dy < rr * rr) return true; }
    return false;
  }
  private take(it: Item) {
    it.taken = true;
    const pan = clamp((it.x - this.cam.x) / 10, -0.8, 0.8);
    if (it.kind === "coin") {
      const v = it.value * (this.power.double > 0 ? 2 : 1);
      this.addCoins(v); this.stageCoins += v;
      sfx(it.value >= 100 ? "gem" : it.value >= 25 ? "coinBig" : "coin", { pan, rate: 0.95 + Math.random() * 0.12 });
      this.fx.burst(SPARKLE, it.x, it.y, it.value >= 25 ? 8 : 4, 2.5, 0.5, it.value >= 25 ? 0.3 : 0.2, it.value >= 100 ? 19 : 7);
    } else if (it.kind === "fuel") {
      this.fuel = this.fuelMax; this.lowWarned = false; this.outOfFuel = 0;
      sfx("fuel", { pan }); this.fx.burst(RING, it.x, it.y, 1, 0, 0.5, 1.6, 6); this.fx.burst(SPARKLE, it.x, it.y, 8, 3, 0.6, 0.22, 6);
      this.opts.onEvent({ k: "pickup", what: "fuel" });
    } else if (it.kind === "heart") {
      this.lives = Math.min(5, this.lives + 1); this.opts.onLives(this.lives);
      sfx("heart", { pan }); this.fx.burst(SPARKLE, it.x, it.y, 12, 3, 0.8, 0.3, 18);
      this.opts.onEvent({ k: "pickup", what: "heart" });
    } else if (it.power) {
      const p = POWERS.find((x) => x.id === it.power)!;
      this.power[p.id] = p.secs;
      if (p.id === "nitro") this.truck.nitro = p.secs;
      sfx("power", { pan }); sfx(p.id === "double" ? "coinBig" : (p.id as HaulSfx), { delay: 0.08 });
      this.fx.burst(RING, it.x, it.y, 1, 0, 0.6, 2, 17);
      this.opts.onEvent({ k: "pickup", what: p.id });
    }
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }

  private crash(why: "roof" | "fall" | "fuel" | "cargo") {
    if (this.mode !== "play") return;
    this.crashWhy = why;
    if (this.stuck) {
      this.setMode("crash"); this.modeT = 1.4; this.mood = "scared";
      this.opts.onEvent({ k: "stuck" });
      return;
    }
    this.stats.crashes++;
    this.lives = Math.max(0, this.lives - 1);
    this.opts.onLives(this.lives);
    this.setMode("crash");
    this.mood = why === "fuel" || why === "cargo" ? "scared" : "dizzy";
    sfx(why === "fuel" ? "sputter" : why === "cargo" ? "fail" : "crash");
    if (why === "roof" || why === "fall") {
      this.cam.shake = this.reduced ? 0.2 : 0.8;
      this.truck.toWorld(this.truck.spec.roof.x, this.truck.spec.roof.y, this.tmp);
      this.fx.burst(SMOKE, this.tmp.x, this.tmp.y, 10, 2, 1.2, 0.4, 4);
      this.fx.burst(SPARKLE, this.tmp.x, this.tmp.y + 0.4, 8, 3, 0.8, 0.3, 7);
    }
    this.audio?.silence();
    this.opts.onEvent({ k: "crash", why, livesLeft: this.lives });
  }
  private crashStep() {
    if (this.modeT < 2.2) return;
    if (this.lives <= 0) {
      this.lives = 3; this.opts.onLives(3);
      this.cp = 0; this.stuck = false;
      for (const it of this.course.items) it.taken = false;
      this.load(this.stage, 0, "intro");
      this.opts.onEvent({ k: "restart" });
      sfx("lifeLost");
      return;
    }
    this.stuck = false;
    this.power = { nitro: 0, net: 0, bubble: 0, magnet: 0, double: 0 };
    this.place();
    this.setMode("intro"); this.modeT = 1.2;
    this.snapCamera(false);
    this.opts.onEvent({ k: "respawn" });
  }

  private introStep() {
    if (this.modeT > 2.7) {
      this.setMode("play");
      sfx("go");
      this.ensureAudio();
      this.opts.onEvent({ k: "go" });
    } else if (Math.abs(this.modeT - 1.7) < 0.02 || Math.abs(this.modeT - 2.2) < 0.02) sfx("beep");
  }

  private deliver() {
    if (this.mode !== "play") return;
    this.setMode("deliver");
    this.delivered = this.truck.aboard; this.starsShown = 0;
    // nothing falls out on the pad
    this.truck.net = true;
    this.mood = "cheer";
    sfx("horn"); sfx("deliver", { delay: 0.25 });
    const f = this.course.finish, y = this.course.terrain.heightAt(f);
    for (let k = 0; k < 3; k++) this.fx.burst(CONFETTI, f + 3 + k * 4, y + 6.5, this.quality === "low" ? 30 : 55, 7, 2.6, 0.24, 6, 4, 5);
  }
  private deliverStep() {
    const R = this.truck;
    // the stars pop out of the bed one by one
    const plan = this.course.plan;
    const stars = this.starsFor(this.delivered);
    if (this.starsShown < stars && this.modeT >= 0.9 + this.starsShown * 0.35) {
      const k = this.starsShown++;
      sfx("star", { rate: 1 + k * 0.12 });
      R.toWorld((R.spec.bed.x0 + R.spec.bed.x1) / 2, R.spec.bed.y + 1.2, this.tmp);
      this.fx.burst(STAR, this.tmp.x + (k - 1) * 0.8, this.tmp.y + 0.6, 6, 3, 1.2, 0.3, 16, 2);
    }
    if (this.modeT > 3.0) {
      const bonus = this.delivered * 10 + stars * 15;
      this.addCoins(bonus);
      const s: StageStats = { stage: this.stage, coins: this.stageCoins, bonus, time: this.stats.time, delivered: this.delivered, count: plan.count, need: plan.need, stars, crashes: this.stats.crashes, kind: plan.cargo[0] };
      this.setMode("over");
      this.audio?.silence();
      this.opts.onEvent({ k: "deliver", stats: s });
    }
  }
  starsFor(got: number) {
    const p = this.course.plan;
    return got >= p.count ? 3 : got >= p.need + Math.ceil((p.count - p.need) / 2) ? 2 : 1;
  }

  // ---------------------------------------------------------------- camera
  private snapCamera(fly: boolean) {
    const R = this.truck;
    this.cam.x = R.x + (fly ? 30 : 4); this.cam.y = R.y + (fly ? 8 : 1.5); this.cam.z = fly ? 0.5 : 1; this.cam.rot = 0; this.cam.bars = fly ? 1 : 0.4;
    this.lastCamX = this.cam.x; this.lastCamY = this.cam.y;
  }
  private updateCamera(dt: number) {
    const R = this.truck, cam = this.cam, m = this.mode, T = this.course.terrain;
    const sp = R.speed;
    const portrait = this.H > this.W;
    let tx = R.x + clamp(R.vx * 0.32, -3, portrait ? 3 : 7.5) + (portrait ? 1.2 : 3.5);
    let ty = R.y + (portrait ? 1.4 : 0.8) + clamp(R.vy * 0.12, -2, 2);
    let tz = 1 / (1 + clamp(sp / 30, 0, portrait ? 0.28 : 0.42) + clamp((R.y - T.heightAt(R.x) - 2.4) / 16, 0, portrait ? 0.25 : 0.35));
    let slow = 1, bars = 0, follow = 3.2, rotK = 1;
    if (m === "attract") {
      const sc = this.camBase * 0.72;
      tz = 0.72; follow = 0.8;
      // portrait: the truck up and to the left, the ticket below; landscape: low on the left, under the logo
      tx = R.x + (this.W * (portrait ? 0.2 : 0.28)) / sc + Math.sin(this.time * 0.15) * 1.5;
      ty = portrait ? R.y + 0.8 - (this.H * 0.2) / sc : R.y + 1.4 + (this.H * 0.12) / sc;
    } else if (m === "intro") {
      // fly in from the road ahead, low, down to the truck
      const u = clamp(this.modeT / 2.3, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      tx = lerp(R.x + 30, R.x + (portrait ? 1.2 : 3.5), e); ty = lerp(R.y + 8, R.y + 1.4, e); tz = lerp(0.5, 1.05, e);
      bars = 1 - e; follow = 6; rotK = 0;
    } else if (m === "crash") {
      R.toWorld(R.spec.roof.x, R.spec.roof.y, this.tmp);
      slow = this.crashWhy === "fuel" || this.crashWhy === "cargo" ? 1 : this.modeT < 1.1 ? 0.28 : 0.7;
      tx = this.tmp.x; ty = this.tmp.y + 0.5; tz = this.crashWhy === "fuel" ? 1.15 : 1.35; bars = 0.8; follow = 2.5;
    } else if (m === "deliver" || m === "over") {
      // the delivery shot: slow motion onto the pad, then a close push-in that frames the truck and the depot
      slow = this.modeT < 1.2 ? 0.4 : 0.85;
      const u = clamp(this.modeT / 2.6, 0, 1);
      tx = R.x + lerp(0.5, 4.5, u); ty = R.y + lerp(1.2, 2.2, u); tz = lerp(1.4, 1.0, u * u); bars = 0.95; follow = 2; rotK = 0;
    } else {
      if (R.airTime > 0.7 && R.y - T.heightAt(R.x) > 3.2) { tz *= 0.86; slow = this.reduced ? 1 : 0.78; bars = 0.35; }
      if (this.slowMo > 0) { slow = Math.min(slow, 0.45); bars = Math.max(bars, 0.25); }
    }
    this.slowMo = Math.max(0, this.slowMo - dt);
    // never lose the truck (a stalled tab, a bad frame): snap back to it
    if (!Number.isFinite(cam.x + cam.y + cam.z) || Math.abs(cam.x - R.x) > 200 || Math.abs(cam.y - R.y) > 200 || cam.z > 4 || cam.z < 0.2) { cam.x = tx; cam.y = ty; cam.z = tz; cam.shake = 0; cam.rot = 0; }
    const k = 1 - Math.exp(-dt * follow);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 2));
    cam.slow += (slow - cam.slow) * (1 - Math.exp(-dt * 8));
    cam.bars += (bars - cam.bars) * (1 - Math.exp(-dt * 4));
    const s0 = T.slopeAt(R.x + 3);
    const tr = this.reduced ? 0 : clamp(Math.atan(s0) * 0.12, -0.06, 0.06) * rotK;
    cam.rot += (tr - cam.rot) * (1 - Math.exp(-dt * 1.5));
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
  }

  // ---------------------------------------------------------------- drawing
  private render(dt: number) {
    const c = this.c, W = this.W, H = this.H, dpr = this.dpr, cam = this.cam, l = this.look, t = this.time;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const skyShift = clamp((cam.y - this.startY) * 1.5, -40, 60);
    this.sky.draw(c, W, H, cam.x, skyShift, t);
    const scale = this.camBase * cam.z;
    // the painted strips are made for a wide screen: on a tall phone they are drawn a little smaller, so a barn, a
    // cottage or a pagoda still fits the view instead of being cropped by the narrow width
    const sH = (H > W ? Math.min(H, W * 1.35) : H) / STRIP_H;
    const par = [0.06, 0.15, 0.3], base = [0.74, 0.83, 0.93], pv = [0.05, 0.1, 0.18];
    for (let i = 0; i < 3; i++) {
      const s = this.backdrop.strips[i];
      const sw = STRIP_W * sH, sh = STRIP_H * sH;
      const shift = clamp((cam.y - this.startY) * scale * pv[i] * 0.35, -H * 0.12, H * 0.3);
      const bottom = H * base[i] + shift;
      const top = bottom - sh;
      const off = -(((cam.x * scale * par[i]) % sw) + sw) % sw;
      for (let x = off; x < W; x += sw) c.drawImage(s.canvas, x, top, sw + 1, sh);
      if (bottom < H) { c.fillStyle = s.base; c.fillRect(0, bottom - 1, W, H - bottom + 1); }
    }
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.6 : 0, shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.6 : 0;
    const ax = W * 0.5, ay = H * (H > W ? 0.56 : 0.55);
    c.save();
    c.translate(ax, ay); c.rotate(cam.rot); c.scale(scale, -scale); c.translate(-(cam.x + shakeX), -(cam.y + shakeY));
    const halfW = (W / scale) * 0.75 + 4, halfH = (H / scale) * 0.75 + 4;
    const v = this.view;
    v.x0 = cam.x - halfW; v.x1 = cam.x + halfW; v.y0 = cam.y - halfH; v.y1 = cam.y + halfH; v.scale = scale;
    this.drawProps(v, true);
    this.ground.draw(c, v, t);
    this.ground.drawMarks(c, v, t, this.cp);
    this.drawProps(v, false);
    this.animals.draw(c, v.x0, v.x1, t);
    for (const it of this.course.items) { if (!it.taken && it.x > v.x0 - 1 && it.x < v.x1 + 1) drawItem(c, it, t, l.night); }
    const R = this.truck, F = this.fxState;
    F.mood = this.mood; F.blink = t % 3.4 < 0.13; F.gas = this.pedals.gas; F.brake = this.pedals.brake; F.t = t;
    F.nitro = this.power.nitro > 0; F.net = this.power.net > 0; F.bubble = this.power.bubble > 0; F.night = l.night; F.light = l.light;
    drawTruck(c, R, this.cargoArt, F, this.course.terrain.heightAt(R.x));
    drawLooseCargo(c, R, this.cargoArt);
    this.ground.drawWater(c, v, t);
    this.fx.draw(c, v.x0, v.x1);
    c.restore();
    // weather, wind streaks and the grade
    this.weather.draw(c, W, H, dt, t, (cam.x - this.lastCamX) * scale, (cam.y - this.lastCamY) * scale, this.wind);
    this.lastCamX = cam.x; this.lastCamY = cam.y;
    if (Math.abs(this.wind) > 0.3) {
      c.strokeStyle = rgba("#FFFFFF", Math.min(0.35, Math.abs(this.wind) * 0.06)); c.lineWidth = 1.5;
      const dir = Math.sign(this.wind);
      for (let i = 0; i < 14; i++) {
        const y = ((i * 97) % 100) / 100 * H, sp = 600 + (i % 5) * 180;
        const x = ((((t * sp * dir) + i * 233) % (W + 200)) + W + 200) % (W + 200) - 100;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - dir * (60 + (i % 3) * 30), y + 4); c.stroke();
      }
    }
    if (l.tintAmt > 0) { c.fillStyle = rgba(l.tint, l.tintAmt * 0.18); c.fillRect(0, 0, W, H); }
    if (!this.vignette) this.vignette = this.paintVignette(W, H, l.night);
    c.drawImage(this.vignette, 0, 0, W, H);
    if (this.power.nitro > 0) { c.fillStyle = rgba(POWER_COLOR.nitro, 0.12); c.fillRect(0, 0, W * 0.06, H); c.fillRect(W * 0.94, 0, W * 0.06, H); }
    if (cam.bars > 0.01) {
      const bh = H * 0.09 * cam.bars;
      c.fillStyle = "#05060D"; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    }
    if (this.audio) {
      const spin = Math.abs((R.omega[0] + R.omega[1]) * 0.5) / R.spec.maxSpin;
      const play = this.mode === "play";
      this.audio.update(dt, clamp(0.08 + spin * 0.85 + this.pedals.gas * (R.grounded ? 0.05 : 0.35), 0, 1), play ? this.pedals.gas : 0, clamp(R.speed / 20, 0, 1), !R.grounded, true);
    }
  }

  private paintVignette(W: number, H: number, night: number) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(2, Math.round(W / 4)); cv.height = Math.max(2, Math.round(H / 4));
    const g = cv.getContext("2d")!, w = cv.width, h = cv.height;
    const gr = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.45, w / 2, h * 0.55, Math.max(w, h) * 0.85);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${0.22 + night * 0.18})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return cv;
  }

  private drawProps(v: View, back: boolean) {
    const c = this.c, t = this.time, props = this.course.props, night = this.look.night;
    for (const p of props) {
      if (p.back !== back) continue;
      if (p.x < v.x0 - 12) continue;
      if (p.x > v.x1 + 12) break;
      const s = this.props.get(p.kind, p.seed);
      const sc = p.s;
      c.save();
      c.translate(p.x, p.y - (back ? 0.3 : 0));
      if (back) c.globalAlpha = 0.92;
      c.scale(p.flip ? -sc : sc, -sc);
      c.drawImage(s.cv, -s.ax, -(s.h - s.ay), s.w, s.h);
      c.scale(p.flip ? -1 : 1, -1);
      propMotion(c, p.kind, t, p.seed % 100, night);
      c.restore();
    }
  }

  private pushHud() {
    const R = this.truck, tr = this.course, plan = tr.plan;
    const start = 2, prog = clamp((R.x - start) / (tr.finish - start), 0, 1);
    this.opts.onHud({
      stage: this.stage, fuel: this.fuel / this.fuelMax, lives: this.lives, coins: this.coins, stageCoins: this.stageCoins, progress: prog,
      checkpoints: tr.checkpoints.map((x) => (x - start) / (tr.finish - start)), distance: Math.max(0, Math.round(R.x)), speed: Math.round(Math.max(0, R.forward) * 3.6),
      powers: POWERS.filter((p) => this.power[p.id] > 0).map((p) => ({ id: p.id, left: this.power[p.id], secs: p.secs })),
      mode: this.mode, lowFuel: this.fuel / this.fuelMax < 0.22,
      title: plan.title, subtitle: plan.subtitle, remix: plan.remix > 0, big: plan.big, world: tr.world.id, accent: tr.world.accent,
      cargo: plan.cargo, aboard: this.mode === "deliver" || this.mode === "over" ? this.delivered : R.aboard, count: plan.count, need: plan.need, from: plan.from, to: plan.to, wind: this.wind,
    });
  }

  /** for the menus: a quiet look at the world */
  attract() { this.setMode("attract"); this.audio?.silence(); }
}
