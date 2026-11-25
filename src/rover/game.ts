// Peak Rover's game: the loop, the stage, the rules and the cinematic camera.
//  - a stage starts with a fly-in (the camera sweeps from the vista down to the car under letterbox bars), then GO;
//  - the camera leads the car, zooms out with speed and big air, tilts a touch with the hills, shakes on hard landings,
//    goes slow-motion for crashes and the finish line;
//  - fuel drains with the throttle (cans refill it), coins bank at once, hearts add lives, power-ups run on timers;
//  - a crash (head on the ground, a fall into a gap, or out of fuel) costs a life and drops the car back at the last
//    checkpoint; with no lives left the stage starts again;
//  - crossing the finish rolls the car out in slow motion with confetti, then the UI moves straight on to the next.
import { FrameGovernor, autoQuality, isPhone, pixelRatioFor, type Quality } from "@/lib/perf";
import { Rover, STEP, type Pedals } from "./physics";
import { buildTrack, POWERS, type Item, type PowerId, type Track } from "./terrain";
import { tuned, vehicleOf, type Levels, type VehicleId } from "./vehicles";
import { lookFor, type Look } from "./art/grade";
import { paintBackdrop, STRIP_H, STRIP_W, type Backdrop } from "./art/backdrop";
import { Sky } from "./art/sky";
import { GroundArt, drawItem, powerColor, type View } from "./art/ground";
import { PropSprites, propMotion, PROP_BOBS, PROP_SPINS } from "./art/props";
import { drawRover, ScarfRope, type Mood } from "./art/rover-art";
import { CONFETTI, DIRT, DUST, Particles, RING, SMOKE, SPARK, SPARKLE, WeatherFx } from "./art/fx";
import { RoverAudio, sfx, type RoverSfx } from "./sound";
import { clamp, lerp, mix, rgba, shade } from "./util";

export type Mode = "attract" | "intro" | "play" | "crash" | "finish" | "over";
export interface Hud {
  stage: number; fuel: number; lives: number; coins: number; stageCoins: number; progress: number; checkpoints: number[];
  distance: number; speed: number; powers: { id: PowerId; left: number; secs: number }[]; mode: Mode; lowFuel: boolean;
  /** the stage's card */
  title: string; subtitle: string; remix: boolean; summit: boolean; world: string; accent: string;
}
export type GameEvent =
  | { k: "go" } | { k: "checkpoint"; n: number } | { k: "flip"; n: number; coins: number } | { k: "air"; secs: number; coins: number }
  | { k: "pickup"; what: "fuel" | "heart" | PowerId } | { k: "crash"; why: "head" | "fall" | "fuel"; livesLeft: number }
  | { k: "respawn"; rescue: boolean } | { k: "restart" } | { k: "finish"; stats: StageStats } | { k: "lowFuel" } | { k: "stuck" };
export interface StageStats { stage: number; coins: number; time: number; flips: number; air: number; crashes: number; best: boolean }

export interface GameOptions {
  vehicle: VehicleId; levels: Levels; lives: number; coins: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  /** coins banked (total), lives changed — saved by the UI */
  onCoins: (total: number) => void; onLives: (n: number) => void; onCheckpoint: (stage: number, cp: number) => void;
}

const SKY_RES = () => (isPhone() ? 1 : 1.25);

export class Game {
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1; private quality: Quality;
  private gov: FrameGovernor | null = null; private govScale = 1;
  private raf = 0; private lastT = 0; private acc = 0; private time = 0;
  private running = false;

  track!: Track; look!: Look; private backdrop!: Backdrop; private sky!: Sky; private ground!: GroundArt; private props!: PropSprites;
  private weather!: WeatherFx;
  private fx: Particles;
  rover!: Rover;
  private scarf = new ScarfRope();

  private audio: RoverAudio | null = null;
  mode: Mode = "attract";
  stage = 1;
  private pedals: Pedals = { gas: 0, brake: 0 };
  private keys = { gas: false, brake: false };
  private touch = { gas: 0, brake: 0 };
  // rules
  fuel = 100; private fuelMax = 100; lives = 3; coins = 0; private stageCoins = 0; private cp = 0;
  private power: Record<PowerId, number> = { turbo: 0, shield: 0, magnet: 0, feather: 0, double: 0 };
  private stats = { flips: 0, air: 0, crashes: 0, time: 0 };
  private outOfFuel = 0; private lowWarned = false;
  private airSpin = 0; private airStart = 0; private bigAirDone = false;
  private modeT = 0; private crashWhy: "head" | "fall" | "fuel" = "head";
  /** crashes since the last checkpoint (five in a row earn a rescue shield) and progress watch (stuck detection) */
  private failsHere = 0; private bestX = 0; private bestT = 0; private stuck = false;
  // camera
  private cam = { x: 0, y: 0, z: 1, rot: 0, shake: 0, bars: 0, slow: 1 };
  private camBaseScale = 30;
  private startY = 0;
  private mood: Mood = "happy";
  private hudT = 0;
  private lastCamX = 0; private lastCamY = 0;
  private opts: GameOptions;
  private reduced = false;

  constructor(private host: HTMLElement, opts: GameOptions) {
    this.opts = opts;
    this.quality = autoQuality();
    this.cv = document.createElement("canvas");
    this.cv.className = "rv-canvas";
    host.appendChild(this.cv);
    this.c = this.cv.getContext("2d", { alpha: false })!;
    this.fx = new Particles(this.quality === "low" ? 180 : 320);
    this.lives = opts.lives; this.coins = opts.coins;
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    this.gov = new FrameGovernor((s) => { this.govScale = s; this.resize(); }, 0.6);
    // QA and the art scripts (scripts/art/rover_art.py) look at the game through this
    (window as unknown as { __peakRover?: Game }).__peakRover = this;
  }

  // ---------------------------------------------------------------- setup
  private resize = () => {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.dpr = pixelRatioFor(this.quality) * this.govScale;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = `${this.W}px`; this.cv.style.height = `${this.H}px`;
    // pixels per metre: about 22 m across a landscape screen; on a portrait phone about 13 m, never too tall a view
    const portrait = this.H > this.W;
    this.camBaseScale = portrait ? Math.min(this.W / 11, this.H / 17) : Math.max(this.W / 24, this.H / 13);
  };

  setVehicle(id: VehicleId, levels: Levels) {
    this.opts.vehicle = id; this.opts.levels = levels;
    if (!this.track) return;
    const spec = tuned(vehicleOf(id), levels);
    const x = this.rover?.x ?? 0;
    this.rover = new Rover(spec);
    this.rover.gravity = this.gravity(); this.rover.gripMul = this.track.world.grip;
    this.rover.place(this.track.terrain, x);
    this.fuelMax = spec.fuel; this.fuel = Math.min(this.fuel, spec.fuel);
    this.audio?.dispose(); this.audio = null;
  }
  private gravity() {
    const t = this.track; const g = t.world.gravity * (t.partner && !t.world.enclosed ? 1 : 1);
    return g * (t.plan.twist === "lowgrav" ? 0.55 : 1) * (this.power.feather > 0 ? 0.55 : 1);
  }

  /** build a stage; `cp` = checkpoint to start from (resume) */
  load(stage: number, cp = 0, mode: Mode = "intro") {
    this.stage = stage;
    this.track = buildTrack(stage);
    this.look = lookFor(this.track.plan);
    const res = SKY_RES();
    this.backdrop = paintBackdrop(this.look, this.track.plan.seed, res);
    this.sky = new Sky(this.look, this.track.plan.seed);
    this.ground = new GroundArt(this.track, this.look);
    this.props = new PropSprites(this.look, isPhone() ? 1 : 1.4);
    const weatherCount = (this.quality === "low" ? 60 : this.quality === "medium" ? 110 : 170) * (this.reduced ? 0.3 : 1);
    this.weather = new WeatherFx(this.track.plan.weather, Math.round(weatherCount), { leaf: ["#E8712A", "#F2A33A", "#C9402A", "#FFD23F"], glow: this.look.glow, haze: this.look.haze });
    const l = this.look;
    this.fx.setPalette([l.surface, shade(l.soil[0], 0.1), l.soil[0], mix(l.surface, l.haze, 0.5), "#B9BCC9", "#FFD27A", "#FF5D8F", "#FFD23F", "#2EC4B6", "#7B5CFF", "#FF8A3D", "#FFFFFF", "#FF4545", "#3EE08F", "#2E9BFF"]);
    this.fx.clear();
    const spec = tuned(vehicleOf(this.opts.vehicle), this.opts.levels);
    this.rover = new Rover(spec);
    this.power = { turbo: 0, shield: 0, magnet: 0, feather: 0, double: 0 };
    this.rover.gravity = this.gravity(); this.rover.gripMul = this.track.world.grip;
    this.fuelMax = spec.fuel; this.fuel = spec.fuel;
    this.cp = Math.min(cp, this.track.checkpoints.length);
    this.stageCoins = 0; this.stats = { flips: 0, air: 0, crashes: 0, time: 0 };
    this.place();
    this.startY = this.rover.y;
    this.audio?.setAmbience(this.track.world.ambience);
    this.setMode(mode);
    this.snapCamera(mode === "intro");
    this.pushHud(true);
  }

  private place() {
    const x = this.cp > 0 ? this.track.checkpoints[this.cp - 1] + 2 : 2;
    this.rover.place(this.track.terrain, x);
    this.scarf = new ScarfRope();
    this.outOfFuel = 0; this.lowWarned = false; this.mood = "happy";
    this.airSpin = 0; this.bigAirDone = false;
    this.bestX = this.rover.x; this.bestT = 0;
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

  /** play from the menu: begin the stage's fly-in */
  play() { this.setMode("intro"); this.snapCamera(true); this.ensureAudio(); }
  private ensureAudio() {
    if (!this.audio) { this.audio = new RoverAudio(this.rover.spec.voice); this.audio.start(this.track.world.ambience); }
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
    const w = window as unknown as { __peakRover?: Game };
    if (w.__peakRover === this) delete w.__peakRover;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.gov?.dispose?.();
    this.audio?.dispose();
    this.cv.remove();
  }

  // ---------------------------------------------------------------- loop
  private frame(dt: number) {
    this.time += dt;
    this.modeT += dt;
    const slow = this.cam.slow;
    const sdt = dt * slow;
    this.updateRules(sdt);
    // physics at a fixed 240 Hz
    this.acc += sdt;
    let steps = 0;
    while (this.acc >= STEP && steps < 24) { this.rover.step(this.track.terrain, this.pedals); this.acc -= STEP; steps++; }
    if (steps >= 24) this.acc = 0;
    // never let a bad step stick: back to the checkpoint
    if (!Number.isFinite(this.rover.x + this.rover.y + this.rover.a + this.rover.vx + this.rover.wx[0] + this.rover.wy[1])) { this.place(); this.cam.x = this.rover.x; this.cam.y = this.rover.y; }
    this.afterPhysics(sdt);
    this.fx.update(sdt, this.rover.gravity);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(false); }
  }

  private updateRules(sdt: number) {
    const R = this.rover;
    const m = this.mode;
    // pedals
    let gas = 0, brake = 0;
    if (m === "play") {
      gas = Math.max(this.keys.gas ? 1 : 0, this.touch.gas);
      brake = Math.max(this.keys.brake ? 1 : 0, this.touch.brake);
      if (this.fuel <= 0) gas = 0;
    } else if (m === "finish") {
      // roll on through the line, then a gentle stop (brake only while still rolling forward: no reversing)
      gas = this.modeT < 0.6 ? 0.35 : 0; brake = this.modeT > 0.9 && R.forward > 0.5 ? 0.8 : 0;
    }
    this.pedals.gas = gas; this.pedals.brake = brake;
    if (m !== "play") return;
    this.stats.time += sdt;
    // fuel
    const turbo = this.power.turbo > 0;
    const use = R.spec.fuelUse * (0.22 + 0.78 * gas) * (turbo ? 0.2 : 1);
    this.fuel = Math.max(0, this.fuel - use * sdt);
    if (this.fuel / this.fuelMax < 0.22 && !this.lowWarned) { this.lowWarned = true; sfx("lowFuel"); this.opts.onEvent({ k: "lowFuel" }); }
    if (this.fuel / this.fuelMax > 0.35) this.lowWarned = false;
    if (this.fuel <= 0) {
      this.outOfFuel = R.speed < 0.5 ? this.outOfFuel + sdt : 0;
      if (this.outOfFuel > 1.6) this.crash("fuel");
    }
    // stuck: no headway for 9 s while trying to drive → back to the checkpoint (no life lost)
    this.bestT += sdt;
    if (R.x > this.bestX + 2) { this.bestX = R.x; this.bestT = 0; }
    if (this.bestT > 9 && gas > 0 && this.fuel > 0) { this.stuck = true; this.crash("head"); return; }
    // powers tick down
    for (const p of POWERS) if (this.power[p.id] > 0) {
      this.power[p.id] = Math.max(0, this.power[p.id] - sdt);
      if (this.power[p.id] === 0 && p.id === "feather") R.gravity = this.gravity();
    }
    R.shield = this.power.shield > 0;
  }

  private afterPhysics(sdt: number) {
    const R = this.rover, T = this.track.terrain, m = this.mode;
    // scarf
    const hp = R.headPos({ x: 0, y: 0 });
    this.scarf.update(hp.x - 0.15 * Math.cos(R.a), hp.y - 0.32, R.vx, R.vy, Math.max(sdt, 1 / 240));
    // dust from the tyres, exhaust
    const q = this.quality === "low" ? 0.5 : 1;
    for (let i = 0; i < 2; i++) {
      if (!R.touch[i]) continue;
      const sp = Math.abs(R.omega[i] * R.spec.wheel.r);
      if ((R.slip > 0.15 || (this.pedals.gas > 0 && sp > 3)) && Math.random() < 0.55 * q) {
        const gx = R.wx[i] - 0.2, gy = R.wy[i] - R.spec.wheel.r * 0.8;
        this.fx.spawn(DUST, gx, gy, -R.vx * 0.2 - 1 - Math.random() * 2, 0.8 + Math.random() * 1.5, 0.9, 0.22 + Math.random() * 0.2, 3);
        if (Math.random() < 0.4) this.fx.spawn(DIRT, gx, gy, -2 - Math.random() * 3 - R.slip * 4, 2 + Math.random() * 3, 0.7, 0.07 + Math.random() * 0.06, Math.random() < 0.5 ? 1 : 2);
      }
    }
    if (m === "play" && this.pedals.gas > 0 && Math.random() < 0.25 * q && R.spec.id !== "comet") {
      const ca = Math.cos(R.a), sa = Math.sin(R.a), ex = R.x - 1.45 * ca + 0.05 * sa, ey = R.y - 1.45 * sa - 0.05 * ca;
      this.fx.spawn(SMOKE, ex, ey, -ca * 1.2 + R.vx * 0.3, 0.4, 0.8, 0.12, 4);
    }
    if (this.power.turbo > 0 && Math.random() < 0.6 * q) { this.fx.spawn(SPARK, R.x - 1.4 * Math.cos(R.a), R.y - 1.4 * Math.sin(R.a), -R.vx * 0.2 - 3, (Math.random() - 0.5) * 2, 0.35, 0.08, 10); }
    if (R.scrape > 0.4 && Math.random() < 0.6) { this.fx.spawn(SPARK, R.x, R.y - 0.3, -R.vx * 0.3 + (Math.random() - 0.5) * 3, Math.random() * 3, 0.4, 0.06, 5); }
    // landings, hits
    if (R.landing > 0) {
      const hard = R.landing > 7;
      if (m === "play" || m === "finish") sfx(hard ? "landHard" : "land", { gain: clamp(R.landing / 10, 0.3, 1) });
      this.cam.shake = Math.max(this.cam.shake, clamp(R.landing / 14, 0, 0.6) * (this.reduced ? 0.3 : 1));
      for (let k = 0; k < (hard ? 10 : 5) * q; k++) this.fx.spawn(DUST, R.x + (Math.random() - 0.5) * 2, T.heightAt(R.x) + 0.1, (Math.random() - 0.5) * 4, Math.random() * 1.5, 1, 0.3, 3);
      R.landing = 0;
    }
    if (R.bodyHit > 2.5) { if (m === "play") sfx("bump", { gain: clamp(R.bodyHit / 8, 0.3, 1) }); R.bodyHit = 0; }
    R.scrape *= 0.8;
    if (m !== "play") { if (m === "crash") this.crashStep(); else if (m === "finish") this.finishStep(); else if (m === "intro") this.introStep(); return; }

    // flips and big air
    if (!R.grounded) {
      if (R.airTime < 0.05) { this.airSpin = 0; this.airStart = R.a; this.bigAirDone = false; }
      this.airSpin = R.a - this.airStart;
      if (R.airTime > 1.1 && !this.bigAirDone && R.y - T.heightAt(R.x) > 3.5) { this.bigAirDone = true; this.mood = "wow"; }
    } else if (this.airSpin !== 0 || this.bigAirDone) {
      const flips = Math.floor(Math.abs(this.airSpin) / (Math.PI * 2) + 0.15);
      if (flips > 0) {
        const c = 25 * flips * flips;
        this.addCoins(c); this.stats.flips += flips; sfx("flip", { rate: 1 + flips * 0.08 });
        this.opts.onEvent({ k: "flip", n: flips, coins: c });
        this.fx.burst(SPARKLE, R.x, R.y + 1, 14, 4, 0.8, 0.25, 7);
      } else if (this.bigAirDone) {
        const c = 10;
        this.addCoins(c); this.stats.air++; sfx("bigAir");
        this.opts.onEvent({ k: "air", secs: R.airTime, coins: c });
      }
      this.airSpin = 0; this.bigAirDone = false; this.mood = "happy";
    }
    // pickups
    this.pickups();
    // checkpoints
    const cps = this.track.checkpoints;
    if (this.cp < cps.length && R.x > cps[this.cp]) {
      this.cp++;
      sfx("checkpoint");
      this.fx.burst(CONFETTI, cps[this.cp - 1], T.heightAt(cps[this.cp - 1]) + 3, 26, 5, 1.6, 0.2, 6);
      this.failsHere = 0;
      this.opts.onEvent({ k: "checkpoint", n: this.cp });
      this.opts.onCheckpoint(this.stage, this.cp);
    }
    // crash rules: head on the ground; fell into a gap; went back off the start
    if (R.shieldHit) { R.shieldHit = false; this.power.shield = 0; R.shield = false; sfx("shieldPop"); this.fx.burst(RING, R.x, R.y + 0.5, 1, 0, 0.6, 2.2, 14); this.fx.burst(SPARKLE, R.x, R.y + 0.6, 12, 4, 0.6, 0.2, 14); }
    if (R.headHit) this.crash("head");
    else if (this.inPit()) this.crash("fall");
    else if (R.x < this.track.terrain.x0 + 6) this.crash("fall");
    // scared when flipping over
    if (this.mood !== "wow" && Math.cos(R.a) < -0.2) this.mood = "scared";
    else if (this.mood === "scared" && Math.cos(R.a) > 0.4) this.mood = "happy";
    // the finish
    if (R.x > this.track.finish) this.finish();
  }

  private inPit() {
    const R = this.rover;
    return this.track.pits.some((p) => R.x > p.x0 && R.x < p.x1 && R.y < this.track.terrain.heightAt(p.x0) - 5);
  }

  private pickups() {
    const R = this.rover, items = this.track.items;
    const mag = this.power.magnet > 0;
    for (const it of items) {
      if (it.taken) continue;
      const dx = it.x - R.x;
      if (dx < -6) continue;
      if (dx > 9) break;
      if (mag && it.kind === "coin") {
        const d = Math.hypot(dx, it.y - (R.y + 0.5));
        if (d < 7) { it.x -= (dx / d) * 0.35; it.y -= ((it.y - R.y - 0.5) / d) * 0.35; }
      }
      const reach = it.kind === "coin" ? 1.25 : 1.5;
      const hx = it.x - R.x, hy = it.y - (R.y + 0.45);
      if (hx * hx + hy * hy < reach * reach || this.wheelNear(it)) this.take(it);
    }
  }
  private wheelNear(it: Item) {
    const R = this.rover, rr = R.spec.wheel.r + 0.5;
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
      this.fx.burst(SPARKLE, it.x, it.y, it.value >= 25 ? 8 : 4, 2.5, 0.5, it.value >= 25 ? 0.3 : 0.2, it.value >= 100 ? 14 : 7);
    } else if (it.kind === "fuel") {
      this.fuel = this.fuelMax; this.lowWarned = false; this.outOfFuel = 0;
      sfx("fuel", { pan }); this.fx.burst(RING, it.x, it.y, 1, 0, 0.5, 1.6, 12); this.fx.burst(SPARKLE, it.x, it.y, 8, 3, 0.6, 0.22, 12);
      this.opts.onEvent({ k: "pickup", what: "fuel" });
    } else if (it.kind === "heart") {
      this.lives = Math.min(5, this.lives + 1); this.opts.onLives(this.lives);
      sfx("heart", { pan }); this.fx.burst(SPARKLE, it.x, it.y, 12, 3, 0.8, 0.3, 6);
      this.opts.onEvent({ k: "pickup", what: "heart" });
    } else if (it.power) {
      const p = POWERS.find((x) => x.id === it.power)!;
      this.power[p.id] = p.secs;
      if (p.id === "turbo") this.rover.turbo = p.secs;
      if (p.id === "feather") this.rover.gravity = this.gravity();
      if (p.id === "shield") this.rover.shield = true;
      sfx("power", { pan }); sfx(p.id === "double" ? "coinBig" : p.id as RoverSfx, { delay: 0.08 });
      this.fx.burst(RING, it.x, it.y, 1, 0, 0.6, 2, 7 + ["turbo", "shield", "magnet", "feather", "double"].indexOf(p.id));
      this.opts.onEvent({ k: "pickup", what: p.id });
    }
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }

  private crash(why: "head" | "fall" | "fuel") {
    if (this.mode !== "play") return;
    this.crashWhy = why;
    this.failsHere++;
    if (this.stuck) {
      // not a crash: just a lift back to the checkpoint
      this.setMode("crash"); this.modeT = 1.4; this.mood = "scared";
      this.opts.onEvent({ k: "stuck" });
      return;
    }
    this.stats.crashes++;
    this.lives = Math.max(0, this.lives - 1);
    this.opts.onLives(this.lives);
    this.setMode("crash");
    this.mood = why === "fuel" ? "scared" : "dizzy";
    sfx(why === "fuel" ? "sputter" : "crash");
    if (why !== "fuel") {
      this.cam.shake = this.reduced ? 0.2 : 0.8;
      const hp = this.rover.headPos({ x: 0, y: 0 });
      this.fx.burst(SMOKE, hp.x, hp.y, 10, 2, 1.2, 0.35, 4);
      this.fx.burst(SPARKLE, hp.x, hp.y + 0.4, 8, 3, 0.8, 0.3, 7);
    }
    this.audio?.silence();
    this.opts.onEvent({ k: "crash", why, livesLeft: this.lives });
  }
  private crashStep() {
    // after the slow-motion moment: back to the checkpoint (or the start, out of lives)
    if (this.modeT < 2.1) return;
    if (this.lives <= 0) {
      this.lives = 3; this.opts.onLives(3);
      this.cp = 0; this.failsHere = 0; this.stuck = false;
      for (const it of this.track.items) it.taken = false;
      this.load(this.stage, 0, "intro");
      this.opts.onEvent({ k: "restart" });
      sfx("lifeLost");
      return;
    }
    this.fuel = this.fuelMax;
    this.stuck = false;
    this.place();
    this.power = { turbo: 0, shield: 0, magnet: 0, feather: 0, double: 0 };
    // a stretch that has beaten you five times in a row: one shield (it saves your head once), nothing more
    const rescue = this.failsHere >= 5;
    if (rescue) { this.power.shield = 8; this.rover.shield = true; this.failsHere = 0; }
    this.rover.gravity = this.gravity();
    this.setMode("intro"); this.modeT = 1.2; // a short drop-in
    this.snapCamera(false);
    this.opts.onEvent({ k: "respawn", rescue });
  }

  private introStep() {
    if (this.modeT > 2.6) {
      this.setMode("play");
      sfx("go");
      this.ensureAudio();
      this.opts.onEvent({ k: "go" });
    } else if (Math.abs(this.modeT - 1.6) < 0.02 || Math.abs(this.modeT - 2.1) < 0.02) sfx("beep");
  }

  private finish() {
    if (this.mode !== "play") return;
    this.setMode("finish");
    this.mood = "cheer";
    sfx("finish");
    const f = this.track.finish, y = this.track.terrain.heightAt(f);
    for (let k = 0; k < 3; k++) this.fx.burst(CONFETTI, f + (k - 1) * 2.5, y + 5.5, this.quality === "low" ? 30 : 55, 7, 2.4, 0.24, 6, 4);
  }
  private finishStep() {
    if (this.modeT > 2.2) {
      const s: StageStats = { stage: this.stage, coins: this.stageCoins, time: this.stats.time, flips: this.stats.flips, air: this.stats.air, crashes: this.stats.crashes, best: this.stats.crashes === 0 };
      this.setMode("over");
      this.audio?.silence();
      this.opts.onEvent({ k: "finish", stats: s });
    }
  }

  // ---------------------------------------------------------------- camera
  private snapCamera(fly: boolean) {
    const R = this.rover;
    this.cam.x = R.x + (fly ? 26 : 4); this.cam.y = R.y + (fly ? 9 : 1.5); this.cam.z = fly ? 0.55 : 1; this.cam.rot = 0; this.cam.bars = fly ? 1 : 0.4;
    this.lastCamX = this.cam.x; this.lastCamY = this.cam.y;
  }
  private updateCamera(dt: number) {
    const R = this.rover, cam = this.cam, m = this.mode;
    const sp = R.speed;
    const portrait = this.H > this.W;
    // a portrait phone is narrow: the car stays bigger there (less zoom-out, a shorter look ahead)
    let tx = R.x + clamp(R.vx * 0.32, -3, portrait ? 3.4 : 8) + (portrait ? 1.6 : 4);
    let ty = R.y + 1.2 + clamp(R.vy * 0.12, -2, 2);
    let tz = 1 / (1 + clamp(sp / 34, 0, portrait ? 0.3 : 0.45) + clamp((R.y - this.track.terrain.heightAt(R.x) - 2) / 18, 0, portrait ? 0.25 : 0.35));
    let slow = 1, bars = 0, follow = 3.2;
    if (m === "attract") {
      // the menu covers the lower half: the car sits up and to the left, the world opens out to its right
      const sc = this.camBaseScale * 0.72;
      tz = 0.72; follow = 0.8;
      tx = R.x + (this.W * 0.2) / sc + Math.sin(this.time * 0.15) * 1.5;
      ty = R.y + 0.8 - (this.H * (portrait ? 0.2 : 0.16)) / sc;
    }
    else if (m === "intro") {
      // sweep from the vista down to the car
      const u = clamp(this.modeT / 2.2, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      tx = lerp(R.x + 26, R.x + (portrait ? 1.6 : 4), e); ty = lerp(R.y + 9, R.y + 1.2, e); tz = lerp(0.55, 1, e);
      bars = 1 - e; follow = 6;
    } else if (m === "crash") {
      const hp = R.headPos({ x: 0, y: 0 });
      slow = this.crashWhy === "fuel" ? 1 : this.modeT < 1.1 ? 0.28 : 0.7;
      tx = hp.x; ty = hp.y + 0.5; tz = this.crashWhy === "fuel" ? 1.1 : 1.35; bars = 0.8; follow = 2.5;
    } else if (m === "finish" || m === "over") {
      slow = this.modeT < 1.4 ? 0.35 : 0.8;
      tx = R.x + 1; ty = R.y + 1.4; tz = 1.25; bars = 0.9; follow = 2;
    } else if (R.airTime > 0.8 && R.y - this.track.terrain.heightAt(R.x) > 3.5) {
      // big air: pull back and let it hang
      tz *= 0.85; slow = this.reduced ? 1 : 0.82; bars = 0.35;
    }
    const k = 1 - Math.exp(-dt * follow);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 2));
    cam.slow += (slow - cam.slow) * (1 - Math.exp(-dt * 8));
    cam.bars += (bars - cam.bars) * (1 - Math.exp(-dt * 4));
    // a gentle tilt with the hills
    const s0 = this.track.terrain.slopeAt(R.x + 3);
    const tr = this.reduced ? 0 : clamp(Math.atan(s0) * 0.12, -0.06, 0.06);
    cam.rot += (tr - cam.rot) * (1 - Math.exp(-dt * 1.5));
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
  }

  // ---------------------------------------------------------------- drawing
  private render(dt: number) {
    const c = this.c, W = this.W, H = this.H, dpr = this.dpr, cam = this.cam, l = this.look, t = this.time;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const skyShift = clamp((cam.y - this.startY) * 1.5, -40, 60);
    this.sky.draw(c, W, H, cam.x, skyShift, t);
    // ridges (parallax)
    const scale = this.camBaseScale * cam.z;
    const sH = H / STRIP_H * 1.0;
    const par = [0.06, 0.14, 0.28], base = [0.74, 0.82, 0.92], pv = [0.05, 0.1, 0.18];
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
    // world
    const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.6 : 0, shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 0.6 : 0;
    const portrait = H > W;
    const ax = W * (portrait ? 0.5 : 0.5), ay = H * (portrait ? 0.56 : 0.58);
    c.save();
    c.translate(ax, ay); c.rotate(cam.rot); c.scale(scale, -scale); c.translate(-(cam.x + shakeX), -(cam.y + shakeY));
    const halfW = (W / scale) * 0.75 + 4, halfH = (H / scale) * 0.75 + 4;
    const view: View = { x0: cam.x - halfW, x1: cam.x + halfW, y0: cam.y - halfH, y1: cam.y + halfH, scale };
    // props behind the ground
    this.drawProps(view, true);
    this.ground.draw(c, view, t);
    this.ground.drawMarks(c, view, t, this.cp);
    this.drawProps(view, false);
    // items
    for (const it of this.track.items) { if (!it.taken && it.x > view.x0 - 1 && it.x < view.x1 + 1) drawItem(c, it, t, l.night); }
    this.fx.draw(c, view.x0, view.x1);
    drawRover(c, this.rover, this.track.terrain, this.scarf, {
      mood: this.mood, blink: t % 3.4 < 0.13, gas: this.pedals.gas, brake: this.pedals.brake, t, thrust: !this.rover.grounded && this.rover.spec.id === "comet" && (this.pedals.gas > 0 || this.pedals.brake > 0),
      shield: this.power.shield, turbo: this.power.turbo > 0, feather: this.power.feather > 0,
    });
    c.restore();
    // weather and the grade
    this.weather.draw(c, W, H, dt, t, (cam.x - this.lastCamX) * scale, (cam.y - this.lastCamY) * scale);
    this.lastCamX = cam.x; this.lastCamY = cam.y;
    if (l.tintAmt > 0) { c.fillStyle = rgba(l.tint, l.tintAmt * 0.18); c.fillRect(0, 0, W, H); }
    // vignette
    const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.45, W / 2, H * 0.55, Math.max(W, H) * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.22 + l.night * 0.18})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // power glows at the screen's edge
    if (this.power.turbo > 0 || this.power.feather > 0) {
      const col = this.power.turbo > 0 ? powerColor("turbo") : powerColor("feather");
      const g = c.createLinearGradient(0, 0, W * 0.25, 0); g.addColorStop(0, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(0, 0, W * 0.25, H);
    }
    // letterbox bars
    if (cam.bars > 0.01) {
      const bh = H * 0.085 * cam.bars;
      c.fillStyle = "#05060D"; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    }
    // engine sound
    if (this.audio) {
      const R = this.rover;
      const spin = Math.abs((R.omega[0] + R.omega[1]) * 0.5) / R.spec.maxSpin;
      const play = this.mode === "play";
      this.audio.update(dt, clamp(0.08 + spin * 0.85 + this.pedals.gas * (R.grounded ? 0.05 : 0.35), 0, 1), play ? this.pedals.gas : 0, clamp(R.speed / 22, 0, 1), !R.grounded, this.power.turbo > 0, true);
    }
  }

  private drawProps(v: View, back: boolean) {
    const c = this.c, t = this.time, props = this.track.props;
    for (const p of props) {
      if (p.back !== back) continue;
      if (p.x < v.x0 - 10) continue;
      if (p.x > v.x1 + 10) break;
      const s = this.props.get(p.kind, p.seed, p.back);
      const sc = p.s;
      c.save();
      const bob = PROP_BOBS[p.kind] ?? 0;
      c.translate(p.x, p.y - (back ? 0.35 : 0) + (bob ? bob + Math.sin(t * 0.6 + p.seed) * 0.6 : 0));
      if (PROP_SPINS[p.kind]) { c.translate(0, 0.5 * sc); c.rotate(-t * 2 - p.seed); c.translate(0, -0.5 * sc); }
      c.scale(p.flip ? -sc : sc, -sc);
      c.drawImage(s.cv, -s.ax, -(s.h - s.ay), s.w, s.h);
      c.scale(p.flip ? -1 : 1, -1);
      propMotion(c, p.kind, t, p.seed % 100, this.look.night, 1);
      c.restore();
    }
  }

  private pushHud(force: boolean) {
    const R = this.rover, tr = this.track;
    const start = 2, prog = clamp((R.x - start) / (tr.finish - start), 0, 1);
    const h: Hud = {
      stage: this.stage, fuel: this.fuel / this.fuelMax, lives: this.lives, coins: this.coins, stageCoins: this.stageCoins, progress: prog,
      checkpoints: tr.checkpoints.map((x) => (x - start) / (tr.finish - start)), distance: Math.max(0, Math.round(R.x)), speed: Math.round(R.speed * 3.6),
      powers: POWERS.filter((p) => this.power[p.id] > 0).map((p) => ({ id: p.id, left: this.power[p.id], secs: p.secs })),
      mode: this.mode, lowFuel: this.fuel / this.fuelMax < 0.22,
      title: tr.plan.title, subtitle: tr.plan.subtitle, remix: tr.plan.remix > 0, summit: tr.plan.summit, world: tr.world.id, accent: tr.world.accent,
    };
    void force;
    this.opts.onHud(h);
  }

  /** for the menus: a quick look of a world (attract mode) */
  attract() { this.setMode("attract"); this.audio?.silence(); }
}
