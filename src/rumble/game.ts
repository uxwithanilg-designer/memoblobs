// Rumble Rally's game: the loop, the race, the rules and the cinematic camera.
//  - a race opens on the grid: the camera flies along the four trucks under letterbox bars while the crowd cheers,
//    then settles on your truck under the gantry; five red lights come on one by one and go out — GO;
//  - four monster trucks race on the same physics and the same track (a faster truck drives through a slower one);
//    catching a rival fast rams it (it loses speed and is thrown up, spinning), rockets home in on the truck ahead
//    and blast it (a shield blocks one), nitro pushes and lifts the top speed;
//  - the camera leads your truck, pulls back with speed and big air, frames a rival when one is alongside, punches in
//    on an overtake, slows time for a rocket hit, a flip and a photo finish, and swings wide on the finish line with
//    the grandstand going wild;
//  - your fuel drains with the throttle (oil cans refill it), coins bank at once, hearts add lives, powers run on
//    timers (shield, coin magnet, double coins) or refill (rocket pack, nitro can). A crash (roof down, a fall into a
//    gap, out of fuel) costs a life and puts you back on safe ground a little behind; with no lives left the race
//    starts again. Rivals crash too and come back the same way;
//  - finish in the place the race asks for (podium early on, top two later, a win in a final) to move on; once the
//    rivals have taken those places the race is lost and starts again.
import { FrameGovernor, autoQuality, isPhone, pixelRatioFor, type Quality } from "@/lib/perf";
import { STEP, Truck, type Pedals } from "./physics";
import { buildCourse, POWERS, type Course, type Item, type PowerId } from "./terrain";
import { rivalSpec, tuned, truckOf, type Levels, type TruckId, type TruckSpec } from "./trucks";
import { lookFor, type Look } from "./art/grade";
import { paintBackdrop, STRIP_H, STRIP_W, type Backdrop } from "./art/backdrop";
import { Sky } from "./art/sky";
import { GroundArt, drawItem, POWER_COLOR, type View } from "./art/ground";
import { PropSprites, propMotion } from "./art/props";
import { Animals } from "./art/animals";
import { drawRocket, drawTruck, type Driver, type Mood, type TruckFx } from "./art/truck";
import { CONFETTI, DIRT, DUST, FIRE, FLASH, MUD, Particles, RING, SHARD, SMOKE, SPARK, SPARKLE, SPLASH, STAR, WeatherFx } from "./art/fx";
import { drive, newBrain, targetSpeed, wantsFire, wantsNitro, type Brain } from "./ai";
import { ANIMAL_CALL, RumbleAudio, ambient, sfx, type RumbleSfx } from "./sound";
import { clamp, lerp, makeRng, mix, rgba, shade } from "./util";

export type Mode = "attract" | "grid" | "play" | "finish" | "over";
export interface Standing { name: string; color: string; you: boolean; progress: number; place: number; done: boolean; down: boolean }
export interface Hud {
  stage: number; place: number; pass: number; fuel: number; lives: number; coins: number; raceCoins: number; progress: number;
  standings: Standing[]; checkpoints: number[];
  nitro: number; burning: boolean; ammo: number; ammoMax: number; reload: number;
  powers: { id: PowerId; left: number; secs: number }[];
  mode: Mode; lowFuel: boolean; lights: number; speed: number; down: boolean;
  title: string; subtitle: string; cup: string; remix: boolean; big: boolean; finale: boolean; world: string; accent: string; wind: number;
}
export interface RaceStats {
  stage: number; place: number; pass: boolean; need: number; stars: number; coins: number; bonus: number; time: number; crashes: number; hits: number; overtakes: number;
  standings: { name: string; color: string; place: number; you: boolean }[];
}
export type GameEvent =
  | { k: "lights"; n: number } | { k: "go" } | { k: "checkpoint"; n: number }
  | { k: "overtake"; name: string; place: number } | { k: "passed"; name: string; place: number }
  | { k: "hit"; name: string } | { k: "struck"; name: string; blocked: boolean } | { k: "ram"; name: string }
  | { k: "air"; secs: number; coins: number } | { k: "pickup"; what: "fuel" | "heart" | PowerId }
  | { k: "crash"; why: "roof" | "fall" | "fuel"; livesLeft: number } | { k: "respawn" } | { k: "restart" }
  | { k: "lowFuel" } | { k: "noAmmo" } | { k: "photo" }
  | { k: "finish"; stats: RaceStats } | { k: "out"; stats: RaceStats };

export interface GameOptions {
  truck: TruckId; levels: Levels; lives: number; coins: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  onCoins: (total: number) => void; onLives: (n: number) => void;
}

interface Racer {
  i: number; name: string; you: boolean;
  truck: Truck; colors: TruckSpec["colors"]; driver: Driver;
  brain: Brain | null;
  pedals: Pedals;
  nitro: number; nitroMax: number; burning: boolean;
  ammo: number; ammoMax: number; reloadT: number;
  shield: number;
  /** finishing order (0: still racing) */
  done: number;
  /** > 0 while crashed, counting up */
  down: number; why: "roof" | "fall" | "fuel";
  bestX: number; bestT: number; upside: number;
  hurt: number; mood: Mood; moodT: number;
  ghost: boolean;
  fallX: number; falls: number;
  armor: number;
  fx: TruckFx;
  air: number;
}

const RK = 16;
const PLACE_BONUS = [0, 160, 90, 50, 15];
const YOU: Driver = { face: "#F08A3A", hat: "#FF6A2C", fox: true };

export class Game {
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1; private quality: Quality;
  private gov: FrameGovernor | null = null; private govScale = 1;
  private raf = 0; private lastT = 0; private acc = 0; private time = 0;
  private running = false;

  course!: Course; look!: Look; private backdrop!: Backdrop; private sky!: Sky; private ground!: GroundArt; private props!: PropSprites;
  private animals!: Animals; private weather!: WeatherFx;
  private fx: Particles;
  racers: Racer[] = [];
  private vignette: HTMLCanvasElement | null = null;

  private audio: RumbleAudio | null = null;
  mode: Mode = "attract";
  stage = 1;
  private keys = { gas: false, brake: false, nitro: false };
  private touch = { gas: 0, brake: 0, nitro: false };
  private fireQueued = false;
  // rules
  fuel = 100; private fuelMax = 100; lives = 3; coins = 0; private raceCoins = 0; private cp = 0;
  private power: Record<PowerId, number> = { shield: 0, magnet: 0, double: 0, rockets: 0, nitro: 0 };
  private stats = { crashes: 0, time: 0, hits: 0, overtakes: 0 };
  private outOfFuel = 0; private lowWarned = false;
  private airStart = 0; private bigAirDone = false;
  private modeT = 0; private lights = -1; private goAt = 5.6;
  private finishOrder = 0; private place = 4; private lastPlace = 4; private lost = false;
  private photoShown = false;
  private order: Racer[] = [];
  private wind = 0; private inWind = false; private wasWet = false;
  private cheer = 0;
  // rockets in flight
  private rk = { x: new Float32Array(RK), y: new Float32Array(RK), vx: new Float32Array(RK), vy: new Float32Array(RK), life: new Float32Array(RK), owner: new Int8Array(RK), target: new Int8Array(RK) };
  // camera
  private cam = { x: 0, y: 0, z: 1, rot: 0, shake: 0, bars: 0, slow: 1, fx: 0, fy: 0, f: 0, ox: 0, oy: 0 };
  private camBase = 30;
  private startY = 0;
  private slowMo = 0; private punch = 0;
  private hudT = 0;
  private lastCamX = 0; private lastCamY = 0;
  private opts: GameOptions;
  private reduced = false;
  private view: View = { x0: 0, x1: 0, y0: 0, y1: 0, scale: 1 };
  private tmp = { x: 0, y: 0 };
  private hud: Hud | null = null;
  private lastFlash = 0;

  constructor(private host: HTMLElement, opts: GameOptions) {
    this.opts = opts;
    this.quality = autoQuality();
    this.cv = document.createElement("canvas");
    this.cv.className = "rr-canvas";
    host.appendChild(this.cv);
    this.c = this.cv.getContext("2d", { alpha: false })!;
    this.fx = new Particles(this.quality === "low" ? 240 : 420);
    this.lives = opts.lives; this.coins = opts.coins;
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    this.gov = new FrameGovernor((s) => { this.govScale = s; this.resize(); }, 0.6);
    // QA and the art script (scripts/art/rumble_art.py) look at the game through this
    (window as unknown as { __rumbleRally?: Game }).__rumbleRally = this;
  }

  // ---------------------------------------------------------------- setup
  private resize = () => {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.dpr = pixelRatioFor(this.quality) * this.govScale;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = `${this.W}px`; this.cv.style.height = `${this.H}px`;
    // pixels per metre: about 22 m across a landscape screen; on a portrait phone about 12 m
    const portrait = this.H > this.W;
    this.camBase = portrait ? Math.min(this.W / 9, this.H / 14) : Math.max(this.W / 21, this.H / 12);
    this.vignette = null;
  };

  setTruck(id: TruckId, levels: Levels) {
    this.opts.truck = id; this.opts.levels = levels;
    if (!this.course) return;
    this.load(this.stage, this.mode === "attract" ? "attract" : "grid");
    this.audio?.dispose(); this.audio = null;
  }
  private spec() { return tuned(truckOf(this.opts.truck), this.opts.levels); }
  get you() { return this.racers[0]; }

  /** build a race */
  load(stage: number, mode: Mode = "grid") {
    this.stage = stage;
    this.course = buildCourse(stage);
    this.look = lookFor(this.course.plan);
    const res = isPhone() ? 0.85 : 1.15;
    this.backdrop = paintBackdrop(this.look, this.course.plan.seed, res);
    this.sky = new Sky(this.look, this.course.plan.seed);
    this.ground = new GroundArt(this.course, this.look);
    this.props = new PropSprites(this.look, isPhone() ? 34 : 48);
    this.animals = new Animals(this.course.animals, this.look.night, this.look.tint, this.look.tintAmt);
    const wc = (this.quality === "low" ? 60 : this.quality === "medium" ? 110 : 160) * (this.reduced ? 0.3 : 1);
    this.weather = new WeatherFx(this.course.plan.weather, Math.round(wc), { leaf: ["#E8712A", "#F2A33A", "#C9402A", "#FFD23F"], glow: this.look.glow, haze: this.look.haze });
    const l = this.look;
    this.fx.setPalette([
      l.surface, shade(l.soil[0], 0.1), l.soil[0], mix(l.surface, l.haze, 0.5), // 0-3 ground
      "#B9BCC9", "#FFD27A", // 4 exhaust, 5 spark
      "#FF5D8F", "#FFD23F", "#2EC4B6", "#7B5CFF", "#FF8A3D", // 6-10 confetti
      "#FFFFFF", "#7CC8FF", "#5A3A22", // 11 white, 12 water, 13 mud
      "#8A90A0", "#4A4E5E", "#FFF3B0", // 14-16 shards, stars
      "#3EE08F", "#FF4F7A", "#7CF5FF", // 17-19 pickups
      "#FF8A2A", "#FFE6B0", "#5AE8FF", // 20 fire, 21 flash, 22 nitro
    ]);
    this.fx.clear();
    for (let k = 0; k < RK; k++) this.rk.life[k] = 0;
    this.power = { shield: 0, magnet: 0, double: 0, rockets: 0, nitro: 0 };
    this.raceCoins = 0; this.stats = { crashes: 0, time: 0, hits: 0, overtakes: 0 };
    this.cp = 0; this.finishOrder = 0; this.lost = false; this.photoShown = false; this.lights = -1;
    this.goAt = 5.5 + makeRng(this.course.plan.seed + 3)() * 0.7;
    for (const it of this.course.items) it.taken = false;
    this.makeRacers();
    this.startY = this.you.truck.y;
    this.audio?.setAmbience(this.course.world.ambience);
    this.setMode(mode);
    this.snapCamera(mode === "grid");
    this.pushHud();
  }

  private makeRacers() {
    const co = this.course, plan = co.plan, T = co.terrain;
    const mine = this.spec();
    this.racers = [];
    const mk = (i: number, spec: TruckSpec, name: string, colors: TruckSpec["colors"], driver: Driver, brain: Brain | null, x: number): Racer => {
      const truck = new Truck({ ...spec });
      truck.gravity = co.gravity; truck.gripMul = co.world.grip;
      truck.place(T, x);
      // settle on the springs (the brake pedal reverses a stopped truck, so it stays off)
      for (let k = 0; k < 120; k++) truck.step(T, { gas: 0, brake: 0 });
      return {
        i, name, you: i === 0, truck, colors, driver, brain, pedals: { gas: 0, brake: 0 },
        nitro: spec.nitro, nitroMax: spec.nitro, burning: false, ammo: spec.rockets, ammoMax: spec.rockets, reloadT: 0, shield: 0,
        done: 0, down: 0, why: "roof", bestX: x, bestT: 0, upside: 0, hurt: 0, mood: "happy", moodT: 0, ghost: false, fallX: -1e9, falls: 0,
        armor: spec.armor, air: 0,
        fx: { mood: "happy", blink: false, gas: 0, brake: 0, t: 0, nitro: false, shield: 0, night: 0, light: "#FFFFFF", ammo: spec.rockets, hurt: 0 },
      };
    };
    const g = co.grid;
    this.racers.push(mk(0, mine, "You", mine.colors, YOU, null, g[0]));
    plan.rivals.forEach((rv, k) => {
      const spec = rivalSpec(rv.truck, rv.colors, rv.skill);
      this.racers.push(mk(k + 1, spec, rv.name, rv.colors, { face: rv.face, hat: rv.hat, fox: false }, newBrain(rv.skill, plan.seed + k * 31), g[k + 1]));
    });
    this.fuelMax = mine.fuel; this.fuel = mine.fuel;
    this.outOfFuel = 0; this.lowWarned = false; this.bigAirDone = false;
    this.order = this.racers.slice();
    this.place = this.lastPlace = 4;
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
      // a frame's timestamp can come before the last one (the first frame after start, a tab coming back): skip it
      const dt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (dt > 0) this.frame(Math.min(0.05, dt));
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.audio?.silence(); }
  get isRunning() { return this.running; }

  /** start the race on the grid (from the menus) */
  play() { if (this.mode === "attract" || this.mode === "over") this.load(this.stage, "grid"); this.ensureAudio(); }
  private ensureAudio() {
    if (!this.audio) { this.audio = new RumbleAudio(this.you.truck.spec.voice); this.audio.start(this.course.world.ambience); }
  }

  setTouch(gas: number, brake: number) { this.touch.gas = gas; this.touch.brake = brake; }
  setNitro(on: boolean) { this.touch.nitro = on; }
  fire() { this.fireQueued = true; }
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === "keydown";
    const k = e.key;
    if (k === "ArrowRight" || k === "d" || k === "D") { this.keys.gas = down; e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "a" || k === "A") { this.keys.brake = down; e.preventDefault(); }
    else if (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "Shift") { this.keys.nitro = down; e.preventDefault(); }
    else if ((k === "x" || k === "X" || k === "Enter" || k === "f" || k === "F" || k === "ArrowDown" || k === "s" || k === "S") && down && !e.repeat) { this.fireQueued = true; e.preventDefault(); }
  };

  dispose() {
    this.stop();
    const w = window as unknown as { __rumbleRally?: Game };
    if (w.__rumbleRally === this) delete w.__rumbleRally;
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
    const T = this.course.terrain, rs = this.racers;
    while (this.acc >= STEP && steps < 24) {
      for (const r of rs) if (!r.ghost) { r.truck.nitro = r.burning; r.truck.step(T, r.pedals); }
      this.acc -= STEP; steps++;
    }
    if (steps >= 24) this.acc = 0;
    this.rams(sdt);
    for (const r of rs) {
      const R = r.truck;
      if (!Number.isFinite(R.x + R.y + R.a + R.vx + R.wx[0] + R.wy[1])) this.respawn(r, Math.max(2, r.bestX - 6));
    }
    for (const r of rs) this.afterPhysics(r, sdt);
    this.rockets(sdt);
    this.standings();
    this.fx.update(sdt, this.course.gravity);
    const Y = this.you.truck;
    const fled = this.animals.update(sdt, Y.x, Math.max(0, Y.forward), (x) => T.heightAt(x));
    if (fled >= 0 && this.mode !== "attract") ambient(ANIMAL_CALL[this.animals.kindOf(fled)], clamp((this.animals.x[fled] - this.cam.x) / 10, -0.9, 0.9), 0.45);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  // ---------------------------------------------------------------- rules
  private updateRules(sdt: number) {
    const m = this.mode, you = this.you, co = this.course;
    this.cheer = Math.max(0, this.cheer - sdt * 0.4);
    if (m === "grid") this.gridStep();
    else if (this.lights === 6 && this.modeT > 2) this.lights = -1;
    // wind (gusting) wherever it blows
    let w = 0;
    for (const z of co.winds) if (you.truck.x > z.x0 && you.truck.x < z.x1) w = z.s * (0.65 + 0.35 * Math.sin(this.time * 1.4 + z.x0));
    this.wind += (w - this.wind) * Math.min(1, sdt * 2);
    if (w !== 0 && !this.inWind && m === "play") { this.inWind = true; sfx("whoosh", { gain: 0.8 }); ambient("gust", -0.4, 0.5); }
    if (w === 0) this.inWind = false;
    for (const r of this.racers) {
      r.hurt = Math.max(0, r.hurt - sdt * 2.5);
      r.moodT -= sdt; if (r.moodT <= 0 && r.mood !== "happy" && r.down === 0) r.mood = "happy";
      r.shield = Math.max(0, r.shield - sdt);
      r.truck.spec.armor = r.shield > 0 ? 0.92 : r.armor;
      r.truck.wind = m === "play" ? this.windAt(r.truck.x) : 0;
      // rockets reload one at a time; nitro trickles back
      if (r.ammo < r.ammoMax) { r.reloadT += sdt; if (r.reloadT >= r.truck.spec.reload) { r.reloadT = 0; r.ammo++; } } else r.reloadT = 0;
      if (!r.burning && r.nitro < r.nitroMax) r.nitro = Math.min(r.nitroMax, r.nitro + sdt * 0.12);
      if (m === "grid" || m === "attract") { r.pedals.gas = 0; r.pedals.brake = r.truck.forward > 0.3 ? 0.5 : 0; r.burning = false; continue; }
      if (r.down > 0) { r.pedals.gas = 0; r.pedals.brake = 0; r.burning = false; continue; }
      if (r.done > 0) { r.pedals.gas = 0; r.pedals.brake = r.truck.forward > 0.4 ? 0.6 : 0; r.burning = false; continue; }
      if (r.you) this.playerInput(r, sdt);
      else this.rivalThink(r, sdt);
      if (r.burning) { r.nitro = Math.max(0, r.nitro - sdt); if (r.nitro <= 0) r.burning = false; }
    }
    if (m === "play" || m === "finish") this.stats.time += m === "play" ? sdt : 0;
    if (m !== "play") return;
    // the player's fuel
    const R = you.truck, gas = you.pedals.gas;
    const use = R.spec.fuelUse * (0.12 + 0.88 * gas) * (you.burning ? 0.3 : 1);
    this.fuel = Math.max(0, this.fuel - use * sdt);
    if (this.fuel / this.fuelMax < 0.22 && !this.lowWarned) { this.lowWarned = true; sfx("lowFuel"); this.opts.onEvent({ k: "lowFuel" }); }
    if (this.fuel / this.fuelMax > 0.35) this.lowWarned = false;
    if (this.fuel <= 0 && you.down === 0) { this.outOfFuel = R.speed < 0.5 ? this.outOfFuel + sdt : 0; if (this.outOfFuel > 1.6) this.crash(you, "fuel"); }
    for (const p of POWERS) if (p.secs > 0 && this.power[p.id] > 0) this.power[p.id] = Math.max(0, this.power[p.id] - sdt);
    you.shield = Math.max(you.shield, this.power.shield);
  }
  private windAt(x: number) {
    for (const z of this.course.winds) if (x > z.x0 && x < z.x1) return z.s * (0.65 + 0.35 * Math.sin(this.time * 1.4 + z.x0));
    return 0;
  }

  private playerInput(r: Racer, sdt: number) {
    let gas = Math.max(this.keys.gas ? 1 : 0, this.touch.gas);
    const brake = Math.max(this.keys.brake ? 1 : 0, this.touch.brake);
    if (this.fuel <= 0) gas = 0;
    r.pedals.gas = gas; r.pedals.brake = brake;
    const want = this.keys.nitro || this.touch.nitro;
    if (want && r.nitro > 0.05 && !r.burning) { r.burning = true; sfx("nitro", { gain: 0.8 }); this.music?.(true); }
    if ((!want || r.nitro <= 0) && r.burning) { r.burning = false; this.music?.(false); }
    if (this.fireQueued) {
      this.fireQueued = false;
      if (r.ammo > 0) this.launch(r);
      else { sfx("tap", { rate: 0.6 }); this.opts.onEvent({ k: "noAmmo" }); }
    }
    void sdt;
  }
  /** the UI hands the game a way to switch the music's nitro sparkle */
  music: ((on: boolean) => void) | null = null;

  private rivalThink(r: Racer, sdt: number) {
    const b = r.brain!, R = r.truck, you = this.you;
    const lead = R.x - you.truck.x;
    const tgt = r.done ? 0 : targetSpeed(R, this.course, b, lead);
    drive(R, this.course, b, tgt, r.pedals);
    // nitro
    const go = wantsNitro(R, this.course, b, lead, r.nitro, sdt);
    if (go && !r.burning && r.nitro > 0.3) { r.burning = true; if (Math.abs(lead) < 25) sfx("nitro", { gain: 0.35, pan: this.pan(R.x) }); }
    else if (!go && r.burning) r.burning = false;
    // rockets at the truck just ahead
    if (r.ammo > 0 && this.mode === "play") {
      let best: Racer | null = null, bd = 1e9;
      for (const o of this.racers) {
        if (o === r || o.down > 0 || o.done) continue;
        const dx = o.truck.x - R.x;
        if (dx > 0 && dx < bd) { bd = dx; best = o; }
      }
      if (best && wantsFire(b, bd, best.truck.y - R.y, best.you, sdt)) this.launch(r);
    }
    // a ghost (far off screen) moves along at its pace
    if (r.ghost) {
      const v = tgt * 0.92;
      const x = R.x + v * sdt;
      R.x = x; R.y = this.course.terrain.heightAt(x) + 1.2; R.vx = v; R.vy = 0;
    }
  }

  private afterPhysics(r: Racer, sdt: number) {
    const R = r.truck, T = this.course.terrain, co = this.course, m = this.mode;
    const you = r.you, q = this.quality === "low" ? 0.5 : 1;
    const near = Math.abs(R.x - this.cam.x) < 30;
    // far rivals become ghosts (no physics); they come back on safe ground when the player nears
    if (!you && m === "play" && r.down === 0) {
      const far = Math.abs(R.x - this.you.truck.x) > 130;
      if (far && !r.ghost && r.done === 0) r.ghost = true;
      else if (!far && r.ghost) { r.ghost = false; this.respawn(r, R.x, true); }
    }
    if (r.ghost) { if (r.done === 0 && m === "play" && R.x > co.finish) this.cross(r); return; }
    if (near) this.tyreFx(r, q);
    // landings
    if (R.landing > 0) {
      const hard = R.landing > 6.5;
      if (near && (m === "play" || m === "finish")) sfx(hard ? "landHard" : "land", { gain: clamp(R.landing / 10, 0.3, 1) * (you ? 1 : 0.5), pan: this.pan(R.x) });
      if (you) this.cam.shake = Math.max(this.cam.shake, clamp(R.landing / 14, 0, 0.6) * (this.reduced ? 0.3 : 1));
      if (near) for (let k = 0; k < (hard ? 12 : 6) * q; k++) this.fx.spawn(DUST, R.x + (Math.random() - 0.5) * 3, T.heightAt(R.x) + 0.1, (Math.random() - 0.5) * 4, Math.random() * 1.5, 1, 0.34, 3);
      R.landing = 0;
    }
    if (R.scrape > 0.4 && near && Math.random() < 0.6) this.fx.spawn(SPARK, R.x, R.y - 0.5, -R.vx * 0.3 + (Math.random() - 0.5) * 3, Math.random() * 3, 0.4, 0.06, 5);
    R.scrape *= 0.8; R.bodyHit = 0; R.bump = 0;
    if (r.burning && near && Math.random() < 0.7 * q) { R.toWorld(R.spec.body.x0 - 1.2, R.spec.body.y0 + 0.2, this.tmp); this.fx.spawn(SPARK, this.tmp.x, this.tmp.y, -R.vx * 0.1 - 4, (Math.random() - 0.5) * 2, 0.3, 0.09, 22); }
    if (m === "play" && r.pedals.gas > 0 && near && Math.random() < 0.25 * q) {
      R.toWorld(R.spec.cab.x0 - 0.06, R.spec.cab.roof + 0.4, this.tmp);
      this.fx.spawn(SMOKE, this.tmp.x, this.tmp.y, -0.8 + R.vx * 0.4, 1.2 + R.vy * 0.4, 0.9, 0.16, 4);
    }
    // crashed: wait, then come back
    if (r.down > 0) {
      r.down += sdt;
      if (you) { if (r.down > (this.lives <= 0 ? 2.4 : 1.7)) this.afterCrash(r); }
      else if (r.down > 1.5) this.respawn(r, this.retryX(r));
      return;
    }
    if (m !== "play" && m !== "finish") return;
    // air time and big air (yours)
    if (!R.grounded) { if (R.airTime < 0.05) { r.air = this.time; if (you) this.bigAirDone = false; } }
    if (you && m === "play") {
      if (!R.grounded && R.airTime > 0.9 && !this.bigAirDone && R.y - T.heightAt(R.x) > 3.2) { this.bigAirDone = true; r.mood = "wow"; r.moodT = 1; }
      else if (R.grounded && this.bigAirDone) {
        const c = 10; this.addCoins(c); sfx("whoosh");
        this.opts.onEvent({ k: "air", secs: this.time - r.air, coins: c });
        this.bigAirDone = false;
      }
      this.pickups();
      const cps = co.checkpoints;
      if (this.cp < cps.length && R.x > cps[this.cp]) {
        this.cp++;
        sfx("checkpoint");
        this.fx.burst(CONFETTI, cps[this.cp - 1] + 1.3, T.heightAt(cps[this.cp - 1]) + 4.8, 22, 4, 1.5, 0.18, 6, 0, 5);
        this.opts.onEvent({ k: "checkpoint", n: this.cp });
      }
    }
    if (r.done === 0) {
      if (R.roofHit) this.crash(r, "roof");
      else if (this.inPit(R)) this.crash(r, "fall");
      else if (R.x < T.x0 + 6) this.crash(r, "fall");
      r.upside = Math.cos(R.a) < -0.1 && R.speed < 1.2 ? r.upside + sdt : 0;
      if (r.upside > 1.2) this.crash(r, "roof");
      if (r.mood === "happy" && Math.cos(R.a) < 0.2) { r.mood = "scared"; r.moodT = 0.6; }
      // stuck: no headway for a while
      r.bestT += sdt;
      if (R.x > r.bestX + 2) { r.bestX = R.x; r.bestT = 0; }
      if (r.bestT > (you ? 9 : 6) && (r.pedals.gas > 0 || !you)) { r.bestT = 0; this.respawn(r, you ? R.x : R.x + 8); if (you) this.opts.onEvent({ k: "respawn" }); }
      if (R.x > co.finish) this.cross(r);
    }
  }

  private tyreFx(r: Racer, q: number) {
    const R = r.truck, T = this.course.terrain;
    for (let i = 0; i < 2; i++) {
      if (!R.touch[i]) continue;
      const sp = Math.abs(R.omega[i] * R.spec.wheel.r);
      const gx = R.wx[i] - 0.3, gy = R.wy[i] - R.spec.wheel.r * 0.8;
      const mud = T.zoneAt(R.wx[i]) === 1;
      if ((R.slip > 0.12 || (r.pedals.gas > 0 && sp > 3)) && Math.random() < 0.5 * q) {
        if (mud) { this.fx.spawn(MUD, gx, gy + 0.2, -R.vx * 0.2 - 1.5 - Math.random() * 3, 2 + Math.random() * 3, 0.8, 0.12 + Math.random() * 0.1, 13); if (r.you && Math.random() < 0.05) sfx("mud", { gain: 0.6 }); }
        else {
          this.fx.spawn(DUST, gx, gy, -R.vx * 0.2 - 1 - Math.random() * 2, 0.8 + Math.random() * 1.5, 0.9, 0.26 + Math.random() * 0.2, 3);
          if (Math.random() < 0.4) this.fx.spawn(DIRT, gx, gy, -2 - Math.random() * 3 - R.slip * 4, 2 + Math.random() * 3, 0.7, 0.08 + Math.random() * 0.06, Math.random() < 0.5 ? 1 : 2);
        }
      }
    }
    if (r.you) {
      const wet = R.water > 0.05;
      if (wet && !this.wasWet && R.speed > 2) {
        sfx("splash", { gain: clamp(R.speed / 8, 0.4, 1) });
        for (let k = 0; k < 18 * q; k++) this.fx.spawn(SPLASH, R.x + (Math.random() - 0.3) * 2, T.waterAt(R.x), (Math.random() - 0.3) * 5, 2 + Math.random() * 4, 0.9, 0.08 + Math.random() * 0.08, Math.random() < 0.5 ? 12 : 11);
      }
      if (wet && R.speed > 1 && Math.random() < 0.4 * q) this.fx.spawn(SPLASH, R.wx[1] + 0.6, T.waterAt(R.x), 1 + Math.random() * 2, 1 + Math.random() * 2, 0.6, 0.06 + Math.random() * 0.06, 12);
      this.wasWet = wet;
    }
  }

  private inPit(R: Truck) {
    return this.course.pits.some((p) => R.x > p.x0 && R.x < p.x1 && R.y < this.course.terrain.heightAt(p.x0) - 5);
  }

  /** safe ground at or behind x: not in a gap, on a bridge, in water, on a steep bit or at a kicker's lip */
  private safeSpot(x: number, skip?: Racer) {
    const co = this.course, T = co.terrain;
    let px = Math.max(-8, x);
    for (let k = 0; k < 90; k++) {
      const bad = co.pits.some((p) => px > p.x0 - 7 && px < p.x1 + 2) || co.bridges.some((b) => px > b.x0 - 4 && px < b.x1 + 3)
        || co.fords.some((f) => px > f.x0 - 3 && px < f.x1 + 3) || Math.abs(T.slopeAt(px)) > 0.3 || Math.abs(T.slopeAt(px + 2)) > 0.35
        || co.ramps.some((rp) => px > rp - 9 && px < rp + 4) || co.logs.some((l) => Math.abs(l.x - px) < 4)
        || this.racers.some((o) => o !== skip && !o.ghost && Math.abs(o.truck.x - px) < 5.5 && o.down === 0);
      if (!bad) return px;
      px -= 2;
    }
    return Math.max(-8, x - 40);
  }
  /** where a crashed rival comes back: behind the crash, or past a gap it keeps failing */
  private retryX(r: Racer) {
    const R = r.truck;
    if (r.why === "fall") {
      if (Math.abs(r.fallX - R.x) < 30) r.falls++; else { r.falls = 1; r.fallX = R.x; }
      if (r.falls >= 2) { const p = this.course.pits.find((q) => q.x1 > R.x - 20 && q.x0 < R.x + 20); if (p) { r.falls = 0; return p.x1 + 8; } }
    }
    return R.x - 4;
  }

  private respawn(r: Racer, x: number, keepSpeed = false) {
    const R = r.truck, T = this.course.terrain;
    const sx = this.safeSpot(x, r);
    R.place(T, sx);
    if (keepSpeed) {
      const v = Math.max(6, Math.min(16, R.spec.maxSpin * R.spec.wheel.r * 0.6)), a = R.a;
      R.vx = Math.cos(a) * v; R.vy = Math.sin(a) * v;
      for (let i = 0; i < 2; i++) { R.wvx[i] = R.vx; R.wvy[i] = R.vy; R.omega[i] = -v / R.spec.wheel.r; }
    }
    R.outline();
    r.down = 0; r.upside = 0; r.bestX = sx; r.bestT = 0; r.burning = false;
    r.shield = Math.max(r.shield, r.you ? 2 : 1);
    if (r.you) { this.outOfFuel = 0; if (this.fuel <= 0) this.fuel = this.fuelMax * 0.5; }
  }

  private crash(r: Racer, why: "roof" | "fall" | "fuel") {
    if (r.down > 0 || r.done) return;
    r.down = 0.001; r.why = why; r.burning = false;
    r.mood = why === "fuel" ? "scared" : "dizzy"; r.moodT = 3;
    const R = r.truck;
    if (why !== "fuel" && Math.abs(R.x - this.cam.x) < 40) {
      R.toWorld(R.spec.roof.x, R.spec.roof.y, this.tmp);
      this.fx.burst(SMOKE, this.tmp.x, this.tmp.y, 10, 2, 1.2, 0.4, 4);
      this.fx.burst(SPARKLE, this.tmp.x, this.tmp.y + 0.4, 8, 3, 0.8, 0.3, 7);
    }
    if (!r.you) { if (Math.abs(R.x - this.cam.x) < 30) sfx("crash", { gain: 0.5, pan: this.pan(R.x) }); return; }
    this.stats.crashes++;
    this.lives = Math.max(0, this.lives - 1);
    this.opts.onLives(this.lives);
    sfx(why === "fuel" ? "sputter" : "crash");
    if (why !== "fuel") { this.cam.shake = this.reduced ? 0.2 : 0.8; if (!this.reduced) this.slowMo = 0.9; }
    this.music?.(false);
    this.opts.onEvent({ k: "crash", why, livesLeft: this.lives });
  }
  private afterCrash(r: Racer) {
    if (this.lives <= 0) {
      this.lives = 3; this.opts.onLives(3);
      this.load(this.stage, "grid");
      this.opts.onEvent({ k: "restart" });
      sfx("lifeLost");
      return;
    }
    this.power.shield = 0;
    this.respawn(r, r.truck.x - 4);
    this.opts.onEvent({ k: "respawn" });
  }

  // ---------------------------------------------------------------- rams and rockets
  /**
   * Rams. The trucks race side by side on the same track (a faster one drives through a slower one), but catching a
   * rival fast with your front bumper rams it: it loses speed and is thrown up, spinning, while you lose a little.
   * A shield turns a ram away. Each pair can ram again a moment later.
   */
  private rams(sdt: number) {
    const rs = this.racers, cool = this.ramCool;
    for (let k = 0; k < cool.length; k++) cool[k] = Math.max(0, cool[k] - sdt);
    if (this.mode !== "play" && this.mode !== "finish") return;
    for (let a = 0; a < rs.length; a++) for (let b = 0; b < rs.length; b++) {
      if (a === b) continue;
      const A = rs[a], B = rs[b];
      if (A.ghost || B.ghost || A.down > 0 || B.down > 0 || A.done || B.done) continue;
      const k = Math.min(a, b) * 4 + Math.max(a, b);
      if (cool[k] > 0) continue;
      const P = A.truck, Q = B.truck;
      // A's nose reaching B's tail, A closing fast
      const gap = (Q.x + Q.spec.body.x0) - (P.x + P.spec.body.x1 + 0.3), dy = Math.abs(Q.y - P.y), close = P.vx - Q.vx;
      if (gap > 0.2 || gap < -1.8 || dy > 1.6 || close < 2.5) continue;
      cool[k] = 1.4;
      this.onRam(A, B, close);
    }
  }
  private ramCool = new Float32Array(16);
  private onRam(A: Racer, B: Racer, v: number) {
    const P = A.truck, Q = B.truck;
    const x = (P.x + P.spec.body.x1 + Q.x + Q.spec.body.x0) / 2, y = (P.y + Q.y) / 2 + 0.3;
    if (B.shield > 0) {
      // the shield turns it away: the rammer bounces off
      P.vx *= 0.75; for (let i = 0; i < 2; i++) { P.wvx[i] *= 0.75; P.omega[i] *= 0.75; }
      this.fx.burst(RING, Q.x, Q.y + 0.3, 1, 0, 0.5, 3, 19);
      if (A.you || B.you) sfx("shieldHit", { pan: this.pan(x) });
      return;
    }
    const hit = clamp(v / 6, 0.5, 1.4) * A.truck.spec.ram * (1 - B.truck.spec.armor * 0.7);
    const keep = clamp(1 - 0.22 * hit, 0.6, 0.95);
    Q.vx *= keep; for (let i = 0; i < 2; i++) { Q.wvx[i] *= keep; Q.omega[i] *= keep; }
    Q.knock(0, Q.M * 2.2 * hit, (Math.random() < 0.5 ? 1 : -1) * 1.6 * hit);
    P.vx *= 0.93; for (let i = 0; i < 2; i++) { P.wvx[i] *= 0.93; P.omega[i] *= 0.93; }
    B.hurt = Math.max(B.hurt, 0.7); B.mood = B.you ? "scared" : "angry"; B.moodT = 1.2; B.burning = false;
    A.mood = A.you ? "cheer" : "angry"; A.moodT = 0.8;
    const near = Math.abs(x - this.cam.x) < 30;
    if (near) {
      this.fx.burst(SPARK, x, y, Math.min(16, 6 + v * 1.2), 4 + v * 0.4, 0.4, 0.07, 5);
      this.fx.burst(SHARD, x, y, 5, 3, 0.8, 0.06, 14, 1, 2);
    }
    if (A.you || B.you) {
      sfx("ram", { gain: clamp(v / 8, 0.45, 1), pan: this.pan(x), rate: 0.9 + Math.random() * 0.2 });
      this.cam.shake = Math.max(this.cam.shake, clamp(v / 14, 0.15, 0.5) * (this.reduced ? 0.4 : 1));
      if (A.you) { this.addCoins(10); this.raceCoins += 10; this.opts.onEvent({ k: "ram", name: B.name }); }
      else this.opts.onEvent({ k: "struck", name: A.name, blocked: false });
    } else if (near) sfx("ram", { gain: 0.35, pan: this.pan(x) });
  }

  private launch(r: Racer) {
    let k = 0;
    while (k < RK && this.rk.life[k] > 0) k++;
    if (k === RK) return;
    const R = r.truck, s = R.spec;
    r.ammo--; r.reloadT = 0;
    R.toWorld(s.cab.x0 + 0.1, s.body.y1 + 0.2, this.tmp);
    const ca = Math.cos(R.a), sa = Math.sin(R.a), v = 26 + Math.max(0, R.forward);
    this.rk.x[k] = this.tmp.x; this.rk.y[k] = this.tmp.y; this.rk.vx[k] = ca * v - sa * 1.5; this.rk.vy[k] = sa * v + ca * 1.5;
    this.rk.life[k] = 2.6; this.rk.owner[k] = r.i;
    // lock on to the nearest truck ahead
    let best = -1, bd = 45;
    for (const o of this.racers) { if (o === r || o.down > 0 || o.ghost) continue; const dx = o.truck.x - R.x; if (dx > 2 && dx < bd) { bd = dx; best = o.i; } }
    this.rk.target[k] = best;
    if (Math.abs(R.x - this.cam.x) < 35) sfx("launch", { pan: this.pan(R.x), gain: r.you ? 1 : 0.6 });
    this.fx.burst(SMOKE, this.tmp.x, this.tmp.y, 5, 1.5, 0.8, 0.25, 4);
    // a little kick back
    R.vx -= ca * 0.4; R.vy -= sa * 0.4;
  }

  private rockets(sdt: number) {
    const k0 = this.rk, T = this.course.terrain;
    for (let k = 0; k < RK; k++) {
      if (k0.life[k] <= 0) continue;
      k0.life[k] -= sdt;
      const tg = k0.target[k] >= 0 ? this.racers[k0.target[k]] : null;
      if (tg && tg.down === 0 && !tg.ghost) {
        // steer gently towards the target
        const dx = tg.truck.x - k0.x[k], dy = tg.truck.y + 0.3 - k0.y[k];
        if (dx > -1) {
          const sp = Math.hypot(k0.vx[k], k0.vy[k]), want = Math.atan2(dy, dx), cur = Math.atan2(k0.vy[k], k0.vx[k]);
          let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          const turn = clamp(d, -2.6 * sdt, 2.6 * sdt), a = cur + turn;
          k0.vx[k] = Math.cos(a) * sp; k0.vy[k] = Math.sin(a) * sp;
        }
      } else k0.vy[k] -= 3 * sdt;
      k0.x[k] += k0.vx[k] * sdt; k0.y[k] += k0.vy[k] * sdt;
      // smoke trail
      if (Math.abs(k0.x[k] - this.cam.x) < 35 && Math.random() < 0.35) this.fx.spawn(SMOKE, k0.x[k] - k0.vx[k] * 0.05, k0.y[k] + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.8, 0.4, 0.6, 0.16, 4);
      // what it hits
      let hit: Racer | null = null;
      for (const o of this.racers) {
        if (o.i === k0.owner[k] && k0.life[k] > 2.3) continue;
        if (o.down > 0 || o.ghost) continue;
        const dx = k0.x[k] - o.truck.x, dy = k0.y[k] - (o.truck.y + 0.25);
        if (dx * dx * 0.35 + dy * dy < 1.6) { hit = o; break; }
      }
      if (hit || k0.y[k] < T.heightAt(k0.x[k]) || k0.life[k] <= 0) this.blast(k, hit);
    }
  }
  private blast(k: number, hit: Racer | null) {
    const k0 = this.rk, x = k0.x[k], y = k0.y[k], owner = this.racers[k0.owner[k]];
    k0.life[k] = 0;
    const near = Math.abs(x - this.cam.x) < 40, q = this.quality === "low" ? 0.6 : 1;
    if (near) {
      this.fx.burst(FLASH, x, y, 1, 0, 0.25, 2.4, 21);
      this.fx.burst(FIRE, x, y, Math.round(14 * q), 3.5, 0.9, 0.45, 20, 1);
      this.fx.burst(SMOKE, x, y, Math.round(10 * q), 2.5, 1.6, 0.6, 4, 1);
      this.fx.burst(SPARK, x, y, Math.round(12 * q), 7, 0.5, 0.08, 5);
      this.fx.burst(DIRT, x, y, Math.round(8 * q), 5, 0.8, 0.12, 1, 2);
      sfx("blast", { pan: this.pan(x), gain: clamp(1 - Math.abs(x - this.cam.x) / 45, 0.3, 1) });
      this.cam.shake = Math.max(this.cam.shake, clamp(0.7 - Math.abs(x - this.you.truck.x) / 40, 0.1, 0.7) * (this.reduced ? 0.3 : 1));
    }
    // the blast pushes every truck near it; the one it struck takes the full hit
    for (const o of this.racers) {
      if (o.down > 0 || o.ghost) continue;
      const R = o.truck, dx = R.x - x, dy = R.y - y, d = Math.hypot(dx, dy);
      if (o !== hit && d > 3.2) continue;
      const full = o === hit ? 1 : 0.4 * (1 - d / 3.2);
      if (o.shield > 0) {
        if (o === hit) { o.shield = 0; if (o.you) this.power.shield = 0; sfx("shieldHit", { pan: this.pan(R.x) }); this.fx.burst(RING, R.x, R.y + 0.3, 1, 0, 0.5, 3, 19); }
        if (o.you && o === hit) this.opts.onEvent({ k: "struck", name: owner.name, blocked: true });
        continue;
      }
      // a hit costs the target its speed: it's thrown up and back, spinning
      const M = R.M, keep = 1 - 0.45 * full, back = Math.sign(R.vx) || 1;
      R.vx *= keep; for (let i = 0; i < 2; i++) { R.wvx[i] *= keep; R.omega[i] *= keep; }
      R.knock(-back * M * 2.5 * full, M * 6.5 * full, (dx > 0 ? -1 : 1) * 2.8 * full);
      o.hurt = 1; o.mood = o.you ? "scared" : "angry"; o.moodT = 1.4; o.burning = false;
      if (o === hit) {
        if (o.you) {
          sfx("hit", { pan: this.pan(R.x) });
          if (!this.reduced) { this.slowMo = 0.7; this.cam.fx = x; this.cam.fy = y; this.cam.f = 1; }
          this.opts.onEvent({ k: "struck", name: owner.name, blocked: false });
        } else if (owner.you) {
          this.stats.hits++; this.addCoins(20); this.raceCoins += 20;
          if (!this.reduced) { this.slowMo = 0.6; this.cam.fx = x; this.cam.fy = y; this.cam.f = 1; }
          this.opts.onEvent({ k: "hit", name: o.name });
        }
      }
    }
  }

  // ---------------------------------------------------------------- places and the finish
  private standings() {
    const o = this.order;
    o.sort((a, b) => (a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : b.truck.x - a.truck.x));
    const place = o.indexOf(this.you) + 1;
    this.place = place;
    if (this.mode === "play" && this.you.done === 0 && this.modeT > 1.5 && place !== this.lastPlace) {
      if (place < this.lastPlace) {
        const passed = o[place]; this.stats.overtakes++;
        sfx("overtake"); this.punch = this.reduced ? 0 : 0.7; this.addCoins(5); this.raceCoins += 5;
        this.opts.onEvent({ k: "overtake", name: passed?.name ?? "", place });
      } else {
        const by = o[place - 2];
        sfx("passed", { pan: 0.4 }); if (by && Math.random() < 0.5) sfx("horn", { pan: 0.5, gain: 0.5, delay: 0.1 });
        this.opts.onEvent({ k: "passed", name: by?.name ?? "", place });
      }
    }
    this.lastPlace = place;
    // photo finish: a rival alongside near the line
    if (this.mode === "play" && !this.photoShown) {
      const R = this.you.truck, f = this.course.finish;
      if (f - R.x < 28 && f - R.x > 4 && this.racers.some((r) => !r.you && !r.done && Math.abs(r.truck.x - R.x) < 7)) {
        this.photoShown = true; if (!this.reduced) this.slowMo = 1.6;
        this.opts.onEvent({ k: "photo" });
      }
    }
    // the race is lost once the rivals have taken the places that move you on
    const need = this.course.plan.pass;
    if (this.mode === "play" && this.you.done === 0 && !this.lost) {
      const ahead = this.racers.filter((r) => !r.you && r.done > 0).length;
      if (ahead >= need) {
        this.lost = true;
        sfx("lose");
        this.setMode("over");
        this.music?.(false);
        this.audio?.silence();
        this.opts.onEvent({ k: "out", stats: this.result(ahead + 1) });
      }
    }
  }

  private cross(r: Racer) {
    if (r.done) return;
    r.done = ++this.finishOrder;
    r.burning = false;
    if (!r.you) {
      if (Math.abs(r.truck.x - this.cam.x) < 40) sfx("horn", { pan: this.pan(r.truck.x), gain: 0.5 });
      return;
    }
    // you crossed the line
    this.setMode("finish");
    this.cheer = 1;
    r.mood = "cheer"; r.moodT = 99;
    this.music?.(false);
    const place = r.done, pass = place <= this.course.plan.pass;
    sfx("finish"); sfx(pass ? (place === 1 ? "win" : "podium") : "lose", { delay: 0.35 }); sfx("cheer", { delay: 0.2 });
    const f = this.course.finish, y = this.course.terrain.heightAt(f);
    if (pass) for (let k = 0; k < 3; k++) this.fx.burst(CONFETTI, f + 2 + k * 4, y + 7, this.quality === "low" ? 30 : 55, 7, 2.6, 0.24, 6, 4, 5);
  }
  private finishStep() {
    const r = this.you;
    if (r.done && this.modeT > 0.8 && this.modeT < 2.6 && Math.random() < 0.08) {
      const f = this.course.finish, y = this.course.terrain.heightAt(f);
      const fx = f + 4 + Math.random() * 18, fy = y + 9 + Math.random() * 5;
      this.fx.burst(STAR, fx, fy, 10, 4, 1.1, 0.25, 6 + Math.floor(Math.random() * 5), 0);
      this.fx.burst(SPARKLE, fx, fy, 12, 5, 0.9, 0.2, 16);
      sfx("blast", { gain: 0.25, rate: 1.6, pan: this.pan(fx) });
    }
    if (this.modeT > 3.2) {
      this.setMode("over");
      this.audio?.silence();
      const s = this.result(r.done);
      if (s.pass) this.addCoins(s.bonus);
      this.opts.onEvent({ k: "finish", stats: s });
    }
  }
  private result(place: number): RaceStats {
    const plan = this.course.plan, pass = place <= plan.pass && !this.lost;
    const stars = pass ? Math.max(1, 4 - place) : 0;
    const bonus = pass ? Math.round(PLACE_BONUS[place] * (1 + Math.min(4, Math.floor(this.stage / 60) * 0.25))) + this.stats.hits * 10 : 0;
    const st = this.order.map((o, k) => ({ name: o.name, color: o.colors.body, place: k + 1, you: o.you }));
    return { stage: this.stage, place, pass, need: plan.pass, stars, coins: this.raceCoins, bonus, time: this.stats.time, crashes: this.stats.crashes, hits: this.stats.hits, overtakes: this.stats.overtakes, standings: st };
  }

  // ---------------------------------------------------------------- the grid and its lights
  private gridStep() {
    const t = this.modeT;
    if (t < 0.1 && this.lights < 0) { this.cheer = 0.8; sfx("crowd"); }
    const n = t < 2.9 ? -1 : Math.min(5, 1 + Math.floor((t - 2.9) / 0.55));
    if (n > this.lights && n <= 5) { this.lights = n; sfx("light", { rate: 1 }); this.opts.onEvent({ k: "lights", n }); }
    if (t >= this.goAt) {
      this.lights = 6;
      this.setMode("play");
      this.cheer = 1;
      sfx("go"); sfx("cheer", { gain: 0.6 });
      this.ensureAudio();
      this.opts.onEvent({ k: "go" });
    }
  }

  // ---------------------------------------------------------------- pickups
  private pickups() {
    const R = this.you.truck, items = this.course.items;
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
      const reach = it.kind === "coin" ? 1.6 : 1.9;
      const hx = it.x - R.x, hy = it.y - (R.y + 0.6);
      if (hx * hx + hy * hy < reach * reach || this.wheelNear(it)) this.take(it);
    }
  }
  private wheelNear(it: Item) {
    const R = this.you.truck, rr = R.spec.wheel.r + 0.45;
    for (let i = 0; i < 2; i++) { const dx = it.x - R.wx[i], dy = it.y - R.wy[i]; if (dx * dx + dy * dy < rr * rr) return true; }
    return false;
  }
  private take(it: Item) {
    it.taken = true;
    const pan = this.pan(it.x), you = this.you;
    if (it.kind === "coin") {
      const v = it.value * (this.power.double > 0 ? 2 : 1);
      this.addCoins(v); this.raceCoins += v;
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
      if (p.id === "rockets") { you.ammo = you.ammoMax; you.reloadT = 0; }
      else if (p.id === "nitro") you.nitro = you.nitroMax;
      else { this.power[p.id] = p.secs; if (p.id === "shield") you.shield = p.secs; }
      sfx("power", { pan });
      const s: Partial<Record<PowerId, RumbleSfx>> = { shield: "shield", magnet: "magnet", rockets: "rocketPick", nitro: "nitro", double: "coinBig" };
      sfx(s[p.id] ?? "power", { delay: 0.08 });
      this.fx.burst(RING, it.x, it.y, 1, 0, 0.6, 2, 17);
      this.opts.onEvent({ k: "pickup", what: p.id });
    }
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }
  private pan(x: number) { return clamp((x - this.cam.x) / 12, -0.9, 0.9); }

  // ---------------------------------------------------------------- camera
  private snapCamera(fly: boolean) {
    const R = this.you.truck;
    const front = this.racers[this.racers.length - 1]?.truck.x ?? R.x;
    this.cam.x = fly ? front + 16 : R.x + 4; this.cam.y = R.y + (fly ? 3 : 1.5); this.cam.z = fly ? 0.8 : 1; this.cam.rot = 0; this.cam.bars = fly ? 1 : 0.4;
    this.cam.f = 0; this.cam.ox = this.cam.x - R.x; this.cam.oy = this.cam.y - R.y;
    this.lastCamX = this.cam.x; this.lastCamY = this.cam.y;
  }
  private updateCamera(dt: number) {
    const you = this.you, R = you.truck, cam = this.cam, m = this.mode, T = this.course.terrain;
    const sp = R.speed;
    const portrait = this.H > this.W;
    let tx = R.x + clamp(R.vx * 0.32, -3, portrait ? 3 : 7.5) + (portrait ? 1.4 : 3.5);
    let ty = R.y + (portrait ? 1.4 : 0.9) + clamp(R.vy * 0.12, -2, 2);
    let tz = 1 / (1 + clamp(sp / 30, 0, portrait ? 0.3 : 0.42) + clamp((R.y - T.heightAt(R.x) - 2.4) / 16, 0, portrait ? 0.25 : 0.35));
    let slow = 1, bars = 0, follow = 3.2, rotK = 1;
    if (m === "attract") {
      const sc = this.camBase * 0.72;
      tz = 0.72; follow = 0.8;
      const g = this.course.grid;
      tx = (portrait ? R.x + 3.4 : (g[0] + g[g.length - 1]) / 2 + 1 + (this.W * 0.12) / sc) + Math.sin(this.time * 0.15) * 1.2;
      ty = portrait ? R.y + 0.8 - (this.H * 0.18) / sc : R.y + 1.4 + (this.H * 0.12) / sc;
    } else if (m === "grid") {
      // fly along the grid from the front truck back to yours, then hold on you under the gantry
      const u = clamp(this.modeT / 2.6, 0, 1), e = u * u * (3 - 2 * u);
      const front = this.racers[this.racers.length - 1].truck.x;
      tx = lerp(front + 14, R.x + (portrait ? 3 : 7), e); ty = lerp(R.y + 3.5, R.y + (portrait ? 2.2 : 2.6), e); tz = lerp(0.85, portrait ? 1.0 : 0.95, e);
      bars = lerp(1, 0.55, e); follow = this.modeT < 2.6 ? 5 : 3; rotK = 0;
    } else if (m === "finish" || m === "over") {
      // the finish shot: slow motion over the line, then wide, with the grandstand behind
      slow = this.modeT < 1.0 ? 0.4 : 0.85;
      const u = clamp(this.modeT / 2.6, 0, 1);
      tx = R.x + lerp(0.5, portrait ? -1.2 : 2.5, u); ty = R.y + lerp(1.2, portrait ? 3.4 : 2.8, u); tz = lerp(1.35, portrait ? 0.86 : 0.8, u * u); bars = 0.95; follow = 2; rotK = 0;
      if (this.lost) { tz = 0.9; bars = 0.9; slow = 1; }
    } else {
      if (you.down > 0) {
        R.toWorld(R.spec.roof.x, R.spec.roof.y, this.tmp);
        slow = you.why === "fuel" ? 1 : you.down < 0.9 ? 0.3 : 0.75;
        tx = this.tmp.x; ty = this.tmp.y + 0.6; tz = you.why === "fuel" ? 1.1 : 1.3; bars = 0.8; follow = 2.5;
      } else {
        // a rival alongside: frame both
        let near: Racer | null = null, nd = 16;
        for (const r of this.racers) { if (r.you || r.ghost || r.down > 0) continue; const d = Math.abs(r.truck.x - R.x); if (d < nd) { nd = d; near = r; } }
        if (near) {
          const mid = (near.truck.x + R.x) / 2;
          tx = lerp(tx, mid + (portrait ? 0.5 : 2), 0.45); ty = lerp(ty, (near.truck.y + R.y) / 2 + 1.2, 0.3);
          tz = Math.min(tz, 1 / (1 + Math.max(0, nd - 6) / 22));
        }
        if (R.airTime > 0.7 && R.y - T.heightAt(R.x) > 3.2) { tz *= 0.86; slow = this.reduced ? 1 : 0.78; bars = 0.35; }
        if (this.punch > 0) { tz *= 1 + 0.12 * Math.sin((this.punch / 0.7) * Math.PI); bars = Math.max(bars, 0.2); slow = Math.min(slow, this.reduced ? 1 : 0.8); }
        if (this.slowMo > 0) { slow = Math.min(slow, 0.38); bars = Math.max(bars, 0.35); }
        if (this.photoShown && this.course.finish - R.x > -2 && this.course.finish - R.x < 26) { slow = Math.min(slow, this.reduced ? 1 : 0.55); bars = Math.max(bars, 0.7); tz *= 1.1; }
        if (you.burning) tz *= 0.93;
      }
      // blend toward a blast for a moment
      if (cam.f > 0.01) { tx = lerp(tx, cam.fx, 0.35 * cam.f); ty = lerp(ty, cam.fy, 0.35 * cam.f); }
    }
    this.slowMo = Math.max(0, this.slowMo - dt);
    this.punch = Math.max(0, this.punch - dt);
    cam.f = Math.max(0, cam.f - dt * 1.4);
    if (m === "finish") this.finishStep();
    if (!Number.isFinite(cam.x + cam.y + cam.z + cam.ox + cam.oy) || Math.abs(cam.x - R.x) > 200 || Math.abs(cam.y - R.y) > 200 || cam.z > 4 || cam.z < 0.2) { cam.x = tx; cam.y = ty; cam.z = tz; cam.ox = tx - R.x; cam.oy = ty - R.y; cam.shake = 0; cam.rot = 0; }
    const k = 1 - Math.exp(-dt * follow);
    if (m === "play" || m === "finish" || m === "over") {
      // racing: the camera rides with the truck and only its offset eases (at 25 m/s a lagging camera would drop the
      // truck off a phone's narrow screen)
      cam.ox += (tx - R.x - cam.ox) * k; cam.oy += (ty - R.y - cam.oy) * k;
      cam.x = R.x + cam.ox; cam.y = R.y + cam.oy;
    } else {
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      cam.ox = cam.x - R.x; cam.oy = cam.y - R.y;
    }
    cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 2));
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
    this.ground.drawBack(c, v, t, Math.max(this.cheer, this.mode === "finish" || this.mode === "over" ? 1 : 0.15));
    this.ground.draw(c, v, t);
    this.ground.drawMarks(c, v, t, this.cp, this.mode === "grid" ? this.lights : this.mode === "play" && this.modeT < 2 ? 6 : -1);
    this.drawProps(v, false);
    this.animals.draw(c, v.x0, v.x1, t);
    for (const it of this.course.items) { if (!it.taken && it.x > v.x0 - 1 && it.x < v.x1 + 1) drawItem(c, it, t, l.night); }
    for (let k = 0; k < RK; k++) if (this.rk.life[k] > 0 && this.rk.x[k] > v.x0 - 2 && this.rk.x[k] < v.x1 + 2) drawRocket(c, this.rk.x[k], this.rk.y[k], Math.atan2(this.rk.vy[k], this.rk.vx[k]), t, this.racers[this.rk.owner[k]].colors.accent);
    for (let i = this.racers.length - 1; i >= 0; i--) {
      const r = this.racers[i], R = r.truck;
      if (r.ghost || R.x < v.x0 - 6 || R.x > v.x1 + 6) continue;
      const F = r.fx;
      F.mood = r.mood; F.blink = (t + i * 0.7) % 3.4 < 0.13; F.gas = r.pedals.gas; F.brake = r.pedals.brake; F.t = t;
      F.nitro = r.burning; F.shield = r.shield > 0 ? Math.min(1, r.shield) : 0; F.night = l.night; F.light = l.light; F.ammo = r.ammo; F.hurt = r.hurt;
      drawTruck(c, R, r.colors, r.driver, F);
    }
    this.ground.drawWater(c, v, t);
    this.fx.draw(c, v.x0, v.x1);
    c.restore();
    // rivals' name tags (only on screen)
    if (this.mode !== "attract") this.tags(ax, ay, scale);
    // weather, wind streaks, lightning and the grade
    this.weather.draw(c, W, H, dt, t, (cam.x - this.lastCamX) * scale, (cam.y - this.lastCamY) * scale, this.wind);
    this.lastCamX = cam.x; this.lastCamY = cam.y;
    if (Math.abs(this.wind) > 0.3) {
      c.strokeStyle = rgba("#FFFFFF", Math.min(0.35, Math.abs(this.wind) * 0.06)); c.lineWidth = 1.5;
      const dir = Math.sign(this.wind);
      for (let i = 0; i < 14; i++) {
        const y = (((i * 97) % 100) / 100) * H, sp = 600 + (i % 5) * 180;
        const x = ((((t * sp * dir) + i * 233) % (W + 200)) + W + 200) % (W + 200) - 100;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - dir * (60 + (i % 3) * 30), y + 4); c.stroke();
      }
    }
    if (this.sky.flash > 0) {
      c.fillStyle = rgba("#E8F0FF", this.sky.flash * 0.22); c.fillRect(0, 0, W, H);
      if (this.lastFlash <= 0 && this.mode !== "attract") ambient("thunder", (Math.random() - 0.5) * 1.4, 0.55);
    }
    this.lastFlash = this.sky.flash;
    if (l.tintAmt > 0) { c.fillStyle = rgba(l.tint, l.tintAmt * 0.18); c.fillRect(0, 0, W, H); }
    if (!this.vignette) this.vignette = this.paintVignette(W, H, l.night);
    c.drawImage(this.vignette, 0, 0, W, H);
    if (this.you.burning) { if (!this.nitroEdge) this.nitroEdge = this.paintEdge(POWER_COLOR.nitro); c.drawImage(this.nitroEdge, 0, 0, W, H); }
    if (this.you.hurt > 0.3) { c.fillStyle = rgba("#FF3A3A", (this.you.hurt - 0.3) * 0.25); c.fillRect(0, 0, W, H); }
    if (cam.bars > 0.01) {
      const bh = H * 0.09 * cam.bars;
      c.fillStyle = "#05060D"; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    }
    if (this.audio) {
      const R = this.you.truck;
      const spin = Math.abs((R.omega[0] + R.omega[1]) * 0.5) / R.spec.maxSpin;
      const play = this.mode === "play" && this.you.down === 0;
      this.audio.update(dt, clamp(0.08 + spin * 0.85 + this.you.pedals.gas * (R.grounded ? 0.05 : 0.35), 0, 1), play ? this.you.pedals.gas : 0, clamp(R.speed / 20, 0, 1), !R.grounded, true, this.you.burning);
    }
  }

  private tags(ax: number, ay: number, scale: number) {
    const c = this.c, cam = this.cam;
    c.font = "800 12px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const r of this.racers) {
      if (r.ghost) continue;
      const R = r.truck;
      const sx = ax + (R.x - cam.x) * scale, sy = ay - (R.y + R.spec.cab.roof + 1.3 - cam.y) * scale;
      if (sx < -60 || sx > this.W + 60 || sy < -30 || sy > this.H) continue;
      if (r.you && this.mode !== "grid") continue;
      const label = r.you ? "YOU" : r.name, w = c.measureText(label).width + 16, h = 20;
      c.globalAlpha = 0.92;
      c.fillStyle = r.you ? "#FF6A2C" : r.colors.trim; this.pill(sx - w / 2, sy - h / 2, w, h);
      c.fillStyle = r.you ? "#FFFFFF" : r.colors.body; c.fillRect(sx - w / 2 + 5, sy - 3, 3, 6);
      c.fillStyle = "#FFFFFF"; c.fillText(label, sx + 2, sy + 0.5);
      c.beginPath(); c.moveTo(sx - 5, sy + h / 2); c.lineTo(sx, sy + h / 2 + 6); c.lineTo(sx + 5, sy + h / 2); c.fillStyle = r.you ? "#FF6A2C" : r.colors.trim; c.fill();
      c.globalAlpha = 1;
    }
  }
  private pill(x: number, y: number, w: number, h: number) {
    const c = this.c, r = h / 2;
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2); c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill();
  }

  private nitroEdge: HTMLCanvasElement | null = null;
  /** a soft glow down both sides of the screen (nitro) */
  private paintEdge(col: string) {
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 2;
    const g = cv.getContext("2d")!, gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, rgba(col, 0.3)); gr.addColorStop(0.12, rgba(col, 0)); gr.addColorStop(0.88, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.3));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 2);
    return cv;
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
    const you = this.you, R = you.truck, co = this.course, plan = co.plan;
    const start = co.grid[0], span = co.finish - start;
    const prog = (x: number) => clamp((x - start) / span, 0, 1);
    const st: Standing[] = this.order.map((r, k) => ({ name: r.name, color: r.you ? "#FF6A2C" : r.colors.body, you: r.you, progress: r.done ? 1 : prog(r.truck.x), place: k + 1, done: r.done > 0, down: r.down > 0 }));
    const h: Hud = {
      stage: this.stage, place: this.place, pass: plan.pass, fuel: this.fuel / this.fuelMax, lives: this.lives, coins: this.coins, raceCoins: this.raceCoins,
      progress: prog(R.x), standings: st, checkpoints: co.checkpoints.map(prog),
      nitro: you.nitro / you.nitroMax, burning: you.burning, ammo: you.ammo, ammoMax: you.ammoMax, reload: you.ammo < you.ammoMax ? you.reloadT / R.spec.reload : 1,
      powers: POWERS.filter((p) => p.secs > 0 && this.power[p.id] > 0).map((p) => ({ id: p.id, left: this.power[p.id], secs: p.secs })),
      mode: this.mode, lowFuel: this.fuel / this.fuelMax < 0.22, lights: this.lights, speed: Math.round(Math.max(0, R.forward) * 3.6), down: you.down > 0,
      title: plan.title, subtitle: plan.subtitle, cup: plan.cup, remix: plan.remix > 0, big: plan.big, finale: plan.finale, world: co.world.id, accent: co.world.accent, wind: this.wind,
    };
    this.hud = h;
    this.opts.onHud(h);
  }

  /** for the menus: a quiet look at the world */
  attract() { this.setMode("attract"); this.audio?.silence(); }
}
