// RaceSession — owns the three.js renderer, the world, every car, items, camera, effects and audio
// for one race, and runs the game loop. React talks to it through callbacks (HUD frames + events).
// Mobile-first: touch steering is smoothed/speed-sensitive with a lane-keeping assist, the hot loop is
// allocation-free, AI planning is throttled, and quality steps down (shadow rate → particles → resolution)
// when the frame rate drops.
import * as THREE from "three";
import { audio } from "@/lib/audio";
import type { AiLevel, CameraView, CarModel, CarSpec, GfxQuality, HudFrame, InputState, RaceConfig, RaceEvent, RaceResult, RacerView, ThemeSpec, TrackItem } from "./types";
import { Track, mulberry } from "./track";
import { Vehicle, paramsFor, idealRaceTime, type VehicleParams } from "./physics";
import { Driver, PERSONALITIES, type Personality } from "./ai";
import { ItemField, HAZARDS, LIFE_HAZARDS, RAMP_POWER } from "./items";
import { RaceAudio, RACE_SOUNDS } from "./audio";
import { buildCarModel } from "./cars/build";
import { gameOf, getCar, getTheme } from "./games";
import { buildWorld, type World } from "./world/build";
import { Particles, SkidMarks } from "./fx";
import { CameraRig, type CamTarget } from "./camera";
import { DriftScore, driftPotential, driftWord, nextCall, type PaceNote } from "./drift";
import { TrafficField, type TrafficCar } from "./traffic";
import { antialiasFor, pixelRatioFor, shadowsFor } from "@/lib/perf";

export interface SessionOptions {
  quality: GfxQuality;
  camera: CameraView;
  renderScale: number;
  onHud: (f: HudFrame) => void;
  onEvent: (e: RaceEvent) => void;
  onProgress?: (p: number, label: string) => void;
}

export const RIVALS = [
  { name: "Kranky", avatar: "/brand/kranky.webp" }, { name: "Turbo", avatar: "/brand/chars/turbo-happy.webp" },
  { name: "Zib", avatar: "/brand/chars/zib-happy.webp" }, { name: "Bolt", avatar: "/brand/chars/bolt-happy.webp" },
  { name: "Gloop", avatar: "/brand/chars/gloop-happy.webp" }, { name: "Bonbon", avatar: "/brand/chars/bonbon-happy.webp" },
  { name: "Pip", avatar: "/brand/chars/pip-happy.webp" }, { name: "Prof. Hoot", avatar: "/brand/chars/hoot-happy.webp" },
  { name: "Noodle", avatar: "/brand/chars/noodle-happy.webp" }, { name: "Tiki", avatar: "/brand/tiki-sign.webp" },
];

interface Racer {
  id: number; idx: number; name: string; avatar: string; spec: CarSpec; color: string;
  car: Vehicle; model: CarModel; driver: Driver | null; isPlayer: boolean; boss: boolean;
  finished: boolean; finishTime: number; out: boolean; outOrder: number; outT: number;
  lapStart: number; bestLap: number; lastLap: number; lapsDone: number;
  wheelRot: number; roll: number; pitch: number; draftShown: boolean;
  wasWreck: boolean; tumble: number; lastItem: number; lastItemT: number;
  /** drift chain scoring (Drift Kings) */
  drift: DriftScore;
  /** Highway Heat: a police car (not in the standings) and a suspect's health in Takedown */
  cop: boolean; hp: number;
}

const DIFF: Record<AiLevel, number> = { easy: 0.15, normal: 0.4, hard: 0.65, pro: 0.9 };
const NEXT_LEVEL: Record<AiLevel, AiLevel> = { easy: "normal", normal: "hard", hard: "pro", pro: "pro" };
const NO_UP = { speed: 0, accel: 0, handling: 0, nitro: 0 };
const GHOST_DT = 0.1;
const hashStr = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

function spriteTexture(draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const crownTex = () => spriteTexture((g) => {
  const gr = g.createRadialGradient(64, 70, 10, 64, 70, 62); gr.addColorStop(0, "rgba(255,210,90,0.55)"); gr.addColorStop(1, "rgba(255,210,90,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.beginPath(); g.moveTo(24, 92); g.lineTo(18, 38); g.lineTo(44, 62); g.lineTo(64, 26); g.lineTo(84, 62); g.lineTo(110, 38); g.lineTo(104, 92); g.closePath();
  g.fillStyle = "#FFD25A"; g.fill(); g.lineWidth = 7; g.strokeStyle = "#7a4a00"; g.stroke();
  g.fillStyle = "#E8504F"; for (const [x, y] of [[44, 78], [64, 74], [84, 78]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
});
const lightTexCache = new Map<string, THREE.Texture>();
const lightTex = (col: string) => {
  let t = lightTexCache.get(col);
  if (!t) {
    t = spriteTexture((g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.18, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    lightTexCache.set(col, t);
  }
  return t;
};
const dangerTex = () => spriteTexture((g) => {
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62); gr.addColorStop(0, "rgba(255,60,80,0.6)"); gr.addColorStop(1, "rgba(255,60,80,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.beginPath(); g.moveTo(30, 34); g.lineTo(98, 34); g.lineTo(64, 100); g.closePath();
  g.fillStyle = "#FF3B55"; g.fill(); g.lineWidth = 7; g.strokeStyle = "#ffffff"; g.stroke();
  g.fillStyle = "#ffffff"; g.font = "bold 40px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("!", 64, 72);
});

export class RaceSession {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 5000);
  track!: Track;
  world!: World;
  theme!: ThemeSpec;
  racers: Racer[] = [];
  player!: Racer;
  items!: ItemField;
  fx!: Particles;
  skids!: SkidMarks;
  sound!: RaceAudio;
  /** player controls, written by keyboard + on-screen controls */
  input: InputState = { steer: 0, gas: 0, brake: 0, nitro: false, drift: false };
  touch = { left: false, right: false, gas: false, brake: false, nitro: false, drift: false, tilt: 0, useTilt: false, autoGas: false };
  /** steering assist 0..1 (lane keeping, softer understeer, wall avoidance), used only with Auto drive on. 1 on touch devices, 0.5 otherwise. */
  steerAssist = 0.5;
  /** the player's Auto drive setting (off: no self-steering, gas is the player's) */
  autoDrive = false;
  cameraView: CameraView;
  phase: HudFrame["phase"] = "loading";
  /** difficulty 0..1 used for AI talent, item density and star targets */
  diff = 0.4;
  /** coin rush: coins for 1/2/3 stars · time trial: total ms for 3/2/1 stars */
  targets: number[] = [];
  /** coin rush: seconds each checkpoint gate adds */
  gateBonus = 0;
  rig!: CameraRig;
  private keys = new Set<string>();
  private raf = 0; private last = 0; private destroyed = false; private paused = false; private hidden = false;
  private t = 0; private introT = 0; private countT = 0; private raceT = 0; private finishT = 0;
  private countdown = 3;
  private perfectWindow = false; private perfectDone = false;
  private hudT = 0;
  private coins = 0; private lives: number | null = null; private timeLeft: number | null = null;
  private elimT = 0; private elimWarn = 0; private takedowns = 0; private outCount = 0;
  private nearMisses = 0; private perfectNitros = 0; private checkpoints = 0;
  private gateIdx = 0; private gateLap = 0; private lastBeep = 99;
  private coinChain = 0; private coinChainT = 0;
  private slowmo = 0;
  private ro: ResizeObserver | null = null;
  private fpsAcc = 0; private fpsN = 0; private pixelRatio = 1; private basePixelRatio = 1; private perfLevel = 0; private goodWindows = 0; private frame = 0; private shadowEvery = 1;
  private finishedEmitted = false;
  private resultCache: RaceResult | null = null;
  private gripMul = 1; private night = false; private rain = false;
  private aliveCars: Vehicle[] = [];
  private autopilot: Driver | null = null;
  private nitroWas = false; private lastTap = -9; private lastTapFull = false; private respawnKeyT = 0; private lastTouchT = -99;
  private nm = { prev: new Float32Array(8), min: new Float32Array(8).fill(99), hit: new Uint8Array(8) };
  private hazNear = new Int32Array(0);
  private leaderDoneT = -1; private bossShock = false;
  private boss: Racer | null = null; private crown: THREE.Sprite | null = null; private danger: THREE.Sprite | null = null; private lastPlace: Racer | null = null;
  private ghost: { model: CarModel; mats: THREE.Material[] } | null = null;
  private ghostBest: { data: Float32Array; n: number; lap: number } | null = null;
  private rec = new Float32Array(4 * 6000); private recN = 0;
  private tmp = { p: V(), f: V(), r: V(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), x: V(), y: V(), z: V(), w: V(), e: V(), b: V() };
  private snd = { rpm: 0, throttle: 0, gear: 1, speed01: 0, boosting: false, slip: 0, drifting: false, offroad: false, air: false };
  private rivalObjs = [0, 1, 2].map(() => ({ rpm: 0, throttle: 0, gear: 1, dist: 0, side: 0, closing: 0, voice: undefined as CarSpec["engine"] | undefined, d2: 0 }));
  private rivalList: { rpm: number; throttle: number; gear: number; dist: number; side: number; closing: number; voice?: CarSpec["engine"] }[] = [];
  private camT!: CamTarget;
  private dots: { xy: [number, number]; player: boolean; color: string }[] = [];
  /** game physics / scoring style ("drift" = Drift Kings) */
  style: "race" | "drift" | "bike" = "race";
  /** timed solo modes with a ghost and star times: time trial, rally stage */
  private tt = false;
  private call: PaceNote | null = null; private callKey = -999; private callT = 0;
  private tandemOn = false; private tandemShownT = -9;
  /** Highway Heat */
  traffic: TrafficField | null = null;
  private timed = false; private chase = false;
  private score = 0; private dist = 0; private combo = 0; private comboT = 0; private heat = 1; private bust = 0; private damage = 0;
  private smashes = 0; private copTakedowns = 0; private nextBlock = 6; private copT = 0; private sirenT = 0; private busted = false; private copsShown = false;
  private cops: Racer[] = [];
  private lights: { r: THREE.Sprite; b: THREE.Sprite; g: THREE.Object3D; h: number; live: () => boolean }[] = [];

  constructor(private container: HTMLElement, public cfg: RaceConfig, private o: SessionOptions) {
    this.cameraView = o.camera;
    this.rig = new CameraRig(this.camera, o.camera);
  }

  private progress(p: number, label: string) { this.o.onProgress?.(p, label); return new Promise((r) => setTimeout(r, 0)); }

  async init() {
    const q = this.o.quality;
    await this.progress(0.05, "Starting engines");
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), powerPreference: "high-performance", stencil: false });
    this.basePixelRatio = this.pixelRatio = pixelRatioFor(q) * this.o.renderScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = shadowsFor(q);
    this.renderer.shadowMap.type = q === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const cv = this.renderer.domElement;
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    this.container.appendChild(cv);
    this.steerAssist = window.matchMedia?.("(pointer: coarse)")?.matches ? 1 : 0.5;
    this.diff = clamp(this.cfg.difficulty ?? DIFF[this.cfg.ai], 0, 1);
    this.style = gameOf(this.cfg.game).style;
    this.tt = this.cfg.mode === "timetrial" || this.cfg.mode === "rally";
    this.timed = this.cfg.mode === "coinrush" || this.cfg.mode === "heat" || this.cfg.mode === "wheelie";
    this.chase = this.cfg.mode === "heat" || this.cfg.mode === "escape";

    this.theme = getTheme(this.cfg.themeId);
    const night = this.cfg.night === "auto" ? this.theme.night : this.cfg.night;
    const weather = this.cfg.weather === "auto" ? this.theme.weather : this.cfg.weather;
    this.night = night; this.rain = weather === "rain";
    const road = (this.theme.look as { road?: { kind?: string } }).road?.kind;
    this.gripMul = this.rain ? 0.88 : road === "ice" ? 0.82 : road === "snow" ? 0.86 : road === "dirt" || road === "sand" ? 0.93 : 1;
    this.renderer.toneMappingExposure = night ? 1.15 : 1.0;
    await this.progress(0.12, "Building the track");
    const tt = this.theme.track;
    this.track = new Track({ seed: hashStr(`${this.theme.id}:${this.cfg.variant}`), width: tt.width, curviness: tt.curviness, hills: tt.hills, size: tt.size, reverse: this.cfg.reverse });
    await this.progress(0.22, `Painting ${this.theme.name}`);
    this.world = buildWorld(this.theme, this.track, this.renderer, { quality: q, night, weather });
    this.scene.add(this.world.root);
    this.scene.fog = this.world.fog;
    this.scene.background = this.world.background;
    this.scene.environment = this.world.envMap;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.container);
    await this.progress(0.5, "Rolling out the cars");
    await this.spawnRacers(night);
    await this.progress(0.72, "Placing coins & hazards");
    this.setupItems();
    const G = gameOf(this.cfg.game);
    if (G.traffic) {
      await this.progress(0.76, "Filling the highway");
      const d = this.diff, cop = getCar(this.cfg.copCar ?? G.copCar ?? G.cars[0].id);
      this.traffic = new TrafficField(this.track, G.traffic.cars.map(getCar), { seed: hashStr(this.theme.id) + this.cfg.variant * 13 + 5, night, count: Math.round(G.traffic.count * (0.8 + d * 0.45)), speed: [14 + d * 3, 25 + d * 5], blockSpec: cop });
      this.traffic.place(this.player.car.s);
      this.scene.add(this.traffic.group);
      for (const b of this.traffic.blocks) this.addLights(b.model.group, b.model.dims.height, () => b.active);
    }
    this.fx = new Particles(q === "low" ? 500 : q === "medium" ? 1100 : 1700);
    this.scene.add(this.fx.group);
    const roadKind = road ?? "asphalt";
    this.skids = new SkidMarks(q === "low" ? 160 : q === "medium" ? 420 : 800, roadKind === "snow" || roadKind === "ice" ? "#5a6470" : roadKind === "dirt" || roadKind === "sand" ? "#4a3a28" : "#0e0e12", q === "low" ? 6 : 10);
    this.scene.add(this.skids.mesh);
    this.resize();
    await this.progress(0.8, "Tuning the engines");
    this.sound = new RaceAudio(this.player.spec.engine);
    this.sound.musicKey = this.theme.music;
    await audio.preload(RACE_SOUNDS, [`a:race_${this.theme.music}_action`, `a:race_${this.theme.music}_calm`]);
    // mode setup
    if (this.timed) { this.lives = 3; this.timeLeft = this.cfg.timeLimit ?? 50; }
    if (this.cfg.mode === "takedown") this.timeLeft = this.cfg.timeLimit ?? 90;
    if (this.cfg.mode === "escape") this.heat = 2;
    if (this.cfg.mode === "elimination") { this.elimT = this.elimInterval() + 8; this.timeLeft = this.elimT; }
    if (this.tt) this.setupGhost();
    this.camT = { pos: this.player.model.group.position, quat: this.player.model.group.quaternion, s: 0, d: 0, v: 0, vmax: 1, boosting: false, drifting: false, driftDir: 0, steer: 0, air: false, dims: this.player.model.dims, cams: this.player.model.cams };
    // warm up shaders (async where supported so phones don't freeze)
    await this.progress(0.9, "Warming up");
    this.placeAll(0);
    this.cameraStep(0.016);
    const r = this.renderer as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> };
    try { if (r.compileAsync) await r.compileAsync(this.scene, this.camera); else r.compile(this.scene, this.camera); } catch { /* compile is only a warm-up */ }
    if (this.destroyed) return;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    await this.progress(1, "Ready");
    if (this.destroyed) return;
    this.bindKeys();
    this.phase = "intro";
    this.sound.start();
    this.sound.music(false);
    this.introToasts();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __race?: RaceSession }).__race = this;
  }

  /** dev/QA: advance game time quickly (headless browsers render slowly) */
  debugAdvance(seconds: number, stepDt = 1 / 30) { for (let t = 0; t < seconds; t += stepDt) { this.t += stepDt; this.step(stepDt); } this.renderer.shadowMap.needsUpdate = true; this.renderer.render(this.scene, this.camera); }
  /** dev/QA: let an AI drive the player's car (null = off). "collector" chases coins (Coin Rush QA). */
  debugAutopilot(level: AiLevel | null, personality: Personality = "racer") {
    this.autopilot = level ? new Driver(this.player.car, level, 1, 99, personality) : null;
    if (this.autopilot) this.autopilot.driftShow = this.style === "drift";
  }
  /** dev/QA: summary of the race state */
  debugState() {
    const P = this.player.car;
    return { phase: this.phase, t: +this.raceT.toFixed(1), lap: P.lap, s: Math.round(P.s), d: +P.d.toFixed(1), kmh: Math.round(P.v * 3.6), nitro: +P.nitro.toFixed(2), coins: this.coins, lives: this.lives, timeLeft: this.timeLeft == null ? null : +this.timeLeft.toFixed(1), checkpoints: this.checkpoints, nearMisses: this.nearMisses, takedowns: this.takedowns, targets: this.targets, drift: this.player.drift.total, chain: Math.round(this.player.drift.chain), mult: this.player.drift.mult, rival: this.boss ? this.boss.drift.total : null, call: this.call ? `${this.call.dir < 0 ? "L" : "R"}${this.call.grade}@${this.call.dist}` : null, pos: this.standings().find((x) => x.isPlayer)!.pos, out: this.racers.filter((r) => r.out).length, result: this.resultCache ? { stars: this.resultCache.stars, pos: this.resultCache.pos, time: Math.round(this.resultCache.time), completed: this.resultCache.completed, coins: this.resultCache.coins } : null };
  }

  private elimInterval() { return Math.round(clamp(25 - this.cfg.opponents * 1.1 - this.diff * 3, 15, 24)); }

  private async spawnRacers(night: boolean) {
    const cfg = this.cfg, solo = cfg.mode === "coinrush" || cfg.mode === "timetrial" || cfg.mode === "drift" || cfg.mode === "rally" || cfg.mode === "heat" || cfg.mode === "escape" || cfg.mode === "wheelie";
    // a drift battle is a one-on-one like the boss duel: the rival starts ahead and slides through every bend
    const battle = cfg.mode === "battle", duel = cfg.mode === "duel" || battle;
    const n = solo ? 0 : duel ? 1 : Math.max(1, Math.min(7, cfg.opponents));
    const pSpec = getCar(cfg.carId), CARS = gameOf(cfg.game).cars;
    const rnd = mulberry(hashStr(cfg.themeId) + cfg.variant * 77 + (Date.now() % 1000));
    // rivals drive cars of your class and similar strength; difficulty comes from tuning, talent and racecraft
    const score = (c: CarSpec) => c.stats.speed * 1.4 + c.stats.accel + c.stats.handling * 0.8 + c.stats.nitro * 0.5;
    const cap = score(pSpec) + ({ easy: -2, normal: 0, hard: 1, pro: 2 } as const)[cfg.ai];
    let pool = CARS.filter((c) => c.tier === pSpec.tier && c.id !== pSpec.id && score(c) <= cap);
    if (pool.length < 3) pool = CARS.filter((c) => c.id !== pSpec.id && Math.abs(c.tier - pSpec.tier) <= 1).sort((a, b) => Math.abs(score(a) - cap + 1) - Math.abs(score(b) - cap + 1)).slice(0, 4);
    if (!pool.length) pool = CARS.filter((c) => c.id !== pSpec.id);
    if (!pool.length) pool = [pSpec];
    const rivals = RIVALS.slice(1).sort(() => rnd() - 0.5);
    const pers: Personality[] = [...PERSONALITIES].filter((p) => p !== "rookie" || cfg.ai === "easy" || cfg.ai === "normal").sort(() => rnd() - 0.5);
    const lvl = (u: number) => Math.max(0, Math.min(5, Math.round(u)));
    const pu = cfg.upgrades, playerUp = (pu.speed + pu.accel + pu.handling + pu.nitro) / 4;
    const aiUp = playerUp * 0.6 + ({ easy: -1.5, normal: -0.5, hard: 0.3, pro: 0.7 } as const)[cfg.ai] + this.diff * 0.7;
    const grid = (k: number) => ({ s: this.track.wrap(-7 - k * 8.5), d: (k % 2 ? 1 : -1) * this.track.halfWidth * 0.42 });
    const make = (i: number, spec: CarSpec, color: string, isPlayer: boolean, name: string, avatar: string, slot: number, driver: ((car: Vehicle) => Driver) | null, boss = false): Racer => {
      const model = buildCarModel(spec, color);
      model.setLights(night);
      this.scene.add(model.group);
      const u = lvl(aiUp + (rnd() - 0.5));
      const car = new Vehicle(paramsFor(spec, isPlayer ? cfg.upgrades : boss ? { speed: lvl(aiUp - 1.5), accel: lvl(aiUp - 1), handling: lvl(aiUp - 0.5), nitro: lvl(aiUp) } : { speed: u, accel: u, handling: u, nitro: u }, model.dims), spec.engine.gears);
      car.style = this.style;
      const g = grid(slot);
      car.s = g.s; car.d = g.d; car.lap = -1; car.progress = -this.track.length + g.s;
      const r: Racer = { id: i, idx: 0, name, avatar, spec, color, car, model, driver: null, isPlayer, boss, finished: false, finishTime: 0, out: false, outOrder: 0, outT: 0, lapStart: 0, bestLap: 0, lastLap: 0, lapsDone: 0, wheelRot: 0, roll: 0, pitch: 0, draftShown: false, wasWreck: false, tumble: 1, lastItem: -1, lastItemT: 0, drift: new DriftScore(), cop: false, hp: 100 };
      if (driver) { r.driver = driver(car); r.driver.driftShow = this.style === "drift"; }
      car.onImpact = (kind, k) => this.onImpact(r, kind, k);
      if (isPlayer) car.onDrift = (level) => this.onPlayerDrift(level);
      return r;
    };
    // grid: the player starts mid-pack on easy, at the back on pro (duel: side by side)
    const playerSlot = duel ? 1 : Math.min(n, Math.round(n * (0.45 + this.diff * 0.55)));
    let slot = 0;
    for (let i = 0; i < n; i++) {
      if (slot === playerSlot) slot++;
      let spec = pool[Math.floor(rnd() * pool.length)];
      if (duel) spec = getCar(cfg.rivalCar ?? gameOf(cfg.game).bossCar);
      const rv = duel ? RIVALS[0] : rivals[i % rivals.length];
      const level: AiLevel = duel && this.diff > 0.75 ? NEXT_LEVEL[cfg.ai] : cfg.ai;
      const talent = duel ? 0.985 + this.diff * 0.035 : 0.975 + rnd() * 0.045 + this.diff * 0.015;
      const p: Personality = duel ? (battle ? "drifter" : "boss") : pers[i % pers.length];
      const r = make(i + 1, spec, spec.colors[Math.floor(rnd() * spec.colors.length)], false, rv.name, rv.avatar, duel ? 0 : slot, (car) => new Driver(car, level, talent, i * 31 + 7 + (hashStr(cfg.themeId) % 997), p), duel);
      this.racers.push(r);
      if (duel) this.boss = r;
      slot++;
      if (i % 2 === 1) await this.progress(0.5 + (0.2 * i) / Math.max(1, n), "Rolling out the cars");
    }
    this.player = make(0, pSpec, pSpec.colors[cfg.paint] ?? pSpec.colors[0], true, "You", "/brand/momo-cheer.webp", playerSlot, null);
    this.racers.unshift(this.player);
    this.racers.forEach((r, i) => (r.idx = i));
    if (this.boss) {
      // the boss car is a class above, but it must stay beatable: cap its edge over your car
      const bp = this.boss.car.params, pp = this.player.car.params;
      bp.vmax = Math.min(bp.vmax, pp.vmax * (1.03 + this.diff * 0.05));
      bp.accel = Math.min(bp.accel, pp.accel * (1.05 + this.diff * 0.08));
      bp.grip = Math.min(bp.grip, pp.grip * (1.04 + this.diff * 0.06));
    }
    if (solo) { this.player.car.s = this.track.wrap(-6); this.player.car.d = 0; }
    // Highway Heat: police cars wait off-screen until the heat brings them in
    const G = gameOf(cfg.game), copsN = this.chase ? 3 : 0;
    if (copsN) {
      const cs = getCar(cfg.copCar ?? G.copCar ?? pSpec.id), lvl: AiLevel = cfg.ai === "easy" ? "normal" : cfg.ai;
      for (let i = 0; i < copsN; i++) {
        const r = make(90 + i, cs, cs.colors[0], false, "Police", "/brand/chars/bolt-happy.webp", 0, (car) => new Driver(car, lvl, 1 + this.diff * 0.05, 400 + i * 37, "cop"));
        r.cop = true; r.driver!.target = this.player.car; r.out = true; r.outT = 0; r.model.group.visible = false;
        this.racers.push(r); this.cops.push(r);
        this.addLights(r.model.group, r.model.dims.height, () => !r.out);
      }
      this.racers.forEach((r, i) => (r.idx = i));
    }
    // Takedown: you drive the interceptor; the suspects get a head start
    if (cfg.mode === "takedown") {
      this.addLights(this.player.model.group, this.player.model.dims.height, () => true);
      let k = 0;
      for (const r of this.racers) {
        if (r.isPlayer) continue;
        r.car.s = this.track.wrap(this.player.car.s + 55 + k * 22); r.car.d = (k % 2 ? 1 : -1) * this.track.halfWidth * 0.4;
        r.car.lap = 0; r.car.progress = r.car.s; r.hp = 100; k++;
      }
    }
    if (this.boss) {
      this.crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: crownTex(), transparent: true, depthWrite: false }));
      this.crown.scale.set(1.6, 1.6, 1); this.scene.add(this.crown);
    }
    if (this.cfg.mode === "elimination") {
      this.danger = new THREE.Sprite(new THREE.SpriteMaterial({ map: dangerTex(), transparent: true, depthWrite: false }));
      this.danger.scale.set(1.5, 1.5, 1); this.danger.visible = false; this.scene.add(this.danger);
    }
  }

  /** reference car for star targets: career → the car you'd expect at this point; quick race → your own car */
  private refParams(): VehicleParams {
    if (!this.cfg.levelId) return this.player.car.params;
    const d = this.diff;
    return paramsFor({ stats: { speed: 3 + d * 5.5, accel: 5 + d * 3, handling: 5.5 + d * 2.5, nitro: 4 + d * 3, mass: 1.1 } }, NO_UP);
  }

  private setupItems() {
    const cfg = this.cfg, ref = this.refParams(), own = this.player.car.params, L = this.track.length;
    const lap = (p: VehicleParams) => Math.max(1, idealRaceTime(this.track, p, 2, this.gripMul) - idealRaceTime(this.track, p, 1, this.gripMul));
    const refV = L / lap(ref), ownV = ref === own ? refV : L / lap(own);
    // drift events reuse the race layout (coins, nitro, soft hazards); rally stages the clean time-trial one
    const itemMode = cfg.mode === "rally" ? "timetrial" : cfg.mode === "heat" || cfg.mode === "wheelie" ? "coinrush" : cfg.mode === "drift" || cfg.mode === "battle" || cfg.mode === "escape" || cfg.mode === "takedown" ? "race" : cfg.mode;
    this.items = new ItemField(this.track, itemMode, this.theme, { pickups: cfg.pickups, hazards: cfg.hazards, seed: hashStr(this.theme.id) + cfg.variant * 31 + (cfg.reverse ? 7 : 0), difficulty: this.diff, refSpeed: ownV * 0.88 });
    this.scene.add(this.items.group);
    this.hazNear = new Int32Array(this.items.items.length).fill(-9);
    const d = this.diff;
    if (this.timed) {
      // gates pay back part of the time it takes YOUR car to reach them, so the clock always runs down (~1.5–2 min runs);
      // coin targets come from the reference car, so a faster car makes the stars easier
      const G = L / Math.max(1, this.items.gates.length);
      const ratio = 0.52 - 0.1 * d, pv = 0.85;
      this.gateBonus = Math.max(3, Math.round((G / ownV) * ratio));
      const T0 = cfg.timeLimit ?? 50;
      const T = T0 / Math.max(0.3, 1 - ratio * pv);
      const potential = (this.items.coinCount / L) * refV * pv * T;
      const r5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
      this.targets = [r5(potential * (0.27 + 0.05 * d)), r5(potential * (0.45 + 0.05 * d)), r5(potential * (0.62 + 0.08 * d))];
      if (this.targets[1] <= this.targets[0]) this.targets[1] = this.targets[0] + 5;
      if (this.targets[2] <= this.targets[1]) this.targets[2] = this.targets[1] + 5;
      if (cfg.mode === "wheelie") {
        // Wheelie Challenge: points flow while the front wheel is up, so targets come from the straight-line share of the lap
        let straight = 0; for (let x = 0; x < L; x += 4) if (Math.abs(this.track.kappa(x)) < 0.009) straight += 4;
        const wheelieSecs = T * (straight / L) * 0.45, r50 = (x: number) => Math.max(50, Math.round(x / 50) * 50);
        const pot = wheelieSecs * refV * 3.6 * 0.6 * 1.7;
        // a player who wheelies every straight to ×4 scores ~3× pot; ★★★ asks for under half of that
        this.targets = [r50(pot * (0.4 + 0.1 * d)), r50(pot * (0.8 + 0.2 * d)), r50(pot * (1.3 + 0.3 * d))];
      }
      if (cfg.mode === "heat") {
        // Heat Run score = metres driven + near-miss combos + smashes: from the distance the reference car covers
        const dist = refV * pv * T, r100 = (x: number) => Math.max(100, Math.round(x / 100) * 100);
        const pot = dist * 1.45;
        this.targets = [r100(pot * (0.34 + 0.06 * d)), r100(pot * (0.53 + 0.08 * d)), r100(pot * (0.74 + 0.1 * d))];
      }
    } else if (cfg.mode === "drift") {
      if (cfg.driftTarget) this.targets = [...cfg.driftTarget];
      else {
        // from how much of the track bends; harder events want cleaner, longer chains
        const pot = driftPotential(this.track) * Math.max(1, cfg.laps);
        const r50 = (x: number) => Math.max(50, Math.round(x / 50) * 50);
        this.targets = [r50(pot * (0.2 + 0.08 * d)), r50(pot * (0.38 + 0.1 * d)), r50(pot * (0.56 + 0.14 * d))];
      }
    } else if (this.tt) {
      if (cfg.timeTargets) this.targets = [...cfg.timeTargets];
      else {
        // calibrated against autopilot runs: a clean drifter with nitro beats ~0.9×, a cautious driver ~1.02×
        const T = idealRaceTime(this.track, ref, Math.max(1, cfg.laps), this.gripMul * 1.3) * 1000;
        const r = (x: number) => Math.round(x / 100) * 100;
        this.targets = [r(T * (1.0 - 0.07 * d)), r(T * (1.08 - 0.06 * d)), r(T * (1.2 - 0.07 * d))];
      }
    }
  }

  private introToasts() {
    const E = (text: string, tone: "gold" | "blue" | "red" | "green" | "pink", big = false, delay = 0) => setTimeout(() => { if (!this.destroyed && (this.phase === "intro" || this.phase === "countdown")) this.o.onEvent({ type: "toast", text, tone, big }); }, delay);
    const fmt = (ms: number) => { const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
    if (this.cfg.mode === "duel" && this.boss) { E("👑 BOSS DUEL", "gold", true, 150); E(`${this.boss.name.toUpperCase()} · ${this.boss.spec.name}`, "red", false, 1100); }
    else if (this.cfg.mode === "wheelie") { E("🏍️ WHEELIE CHALLENGE", "gold", true, 150); E(`Hold WHEELIE on the straights · ★★★ ${this.targets[2].toLocaleString("en-US")} pts`, "gold", false, 1100); }
    else if (this.cfg.mode === "heat") { E("🚨 HEAT RUN", "red", true, 150); E(`Weave the traffic · ★★★ ${this.targets[2].toLocaleString("en-US")} pts`, "gold", false, 1100); }
    else if (this.cfg.mode === "escape") { E("🚔 ESCAPE!", "red", true, 150); E("Outrun the cops to the finish!", "blue", false, 1100); }
    else if (this.cfg.mode === "takedown") { E("🚓 TAKEDOWN", "blue", true, 150); E(`Ram the suspects until they're BUSTED · ${Math.round(this.timeLeft ?? 90)}s`, "red", false, 1100); }
    else if (this.cfg.mode === "coinrush") { E("💰 COIN RUSH", "gold", true, 150); E(`Grab ${this.targets[2]} coins for ★★★ · gates +${this.gateBonus}s`, "gold", false, 1100); }
    else if (this.cfg.mode === "timetrial") { E("⏱️ TIME TRIAL", "blue", true, 150); E(`★★★ ${fmt(this.targets[0])}${this.ghostBest ? " · ghost ready" : ""}`, "blue", false, 1100); }
    else if (this.cfg.mode === "elimination") { E("💥 ELIMINATION", "red", true, 150); E("Last place is knocked out!", "red", false, 1100); }
    else if (this.cfg.mode === "drift") { E("🌀 DRIFT ATTACK", "pink", true, 150); E(`★★★ ${this.targets[2].toLocaleString("en-US")} pts · hold HANDBRAKE + steer`, "pink", false, 1100); }
    else if (this.cfg.mode === "battle" && this.boss) { E("⚔️ DRIFT BATTLE", "gold", true, 150); E(`Out-drift ${this.boss.name.toUpperCase()} · slide close for TANDEM ×1.5`, "pink", false, 1100); }
    else if (this.cfg.mode === "rally") { E("🚩 RALLY STAGE", "green", true, 150); E(`★★★ ${fmt(this.targets[0])} · listen to the co-driver`, "green", false, 1100); }
  }

  // ---------------------------------------------------------------- input
  private bindKeys() {
    const down = (e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault(); if (e.key.toLowerCase() === "c") this.cycleCamera(); };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    const vis = () => { this.hidden = document.hidden; if (this.hidden) { this.keys.clear(); this.sound?.silence(); } else this.last = performance.now(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    this.unbind = () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", vis); };
  }
  private unbind: (() => void) | null = null;
  cycleCamera() { this.cameraView = this.rig.cycle(); return this.cameraView; }

  private readInput(dt: number) {
    const k = this.keys, t = this.touch, c = this.player.car;
    const left = k.has("arrowleft") || k.has("a") || t.left, right = k.has("arrowright") || k.has("d") || t.right;
    if (t.left || t.right || t.brake || t.nitro || t.drift) this.lastTouchT = this.t;
    const v01 = clamp(c.v / 60, 0, 1);
    const cur = this.input.steer;
    let steer: number;
    if (t.useTilt && !left && !right) {
      // tilt: dead-zone + gentle curve + smoothing
      const raw = clamp(t.tilt, -1.5, 1.5), dz = 0.08, a = Math.max(0, Math.abs(raw) - dz) / (1 - dz);
      const want = Math.sign(raw) * Math.min(1, Math.pow(Math.min(1, a), 1.25));
      steer = cur + (want - cur) * Math.min(1, dt * 10);
    } else {
      // digital buttons/keys → analog: ramp in (slower at speed, so taps are small corrections), snap back to centre
      const want = (right ? 1 : 0) - (left ? 1 : 0);
      const rate = want === 0 ? 9 : cur !== 0 && Math.sign(want) !== Math.sign(cur) ? 14 : 7.5 - v01 * 3.5;
      steer = want > cur ? Math.min(want, cur + rate * dt) : Math.max(want, cur - rate * dt);
    }
    this.input.steer = steer;
    const brake = k.has("arrowdown") || k.has("s") || t.brake;
    const gas = k.has("arrowup") || k.has("w") || t.gas || (t.autoGas && (!brake || c.drifting));
    this.input.gas = gas ? 1 : 0;
    this.input.brake = brake ? 1 : 0;
    const nitro = k.has("shift") || k.has("n") || k.has(" ") || t.nitro;
    // double-tap NITRO with a full bar → PERFECT NITRO
    if (nitro && !this.nitroWas) {
      if (this.phase === "racing" && this.t - this.lastTap < 0.36 && this.lastTapFull && c.perfectNitro()) { this.onPerfectNitro(); this.lastTap = -9; }
      else { this.lastTapFull = c.nitro >= 0.95; this.lastTap = this.t; }
    }
    this.nitroWas = nitro;
    this.input.nitro = nitro;
    this.input.drift = k.has("x") || k.has("control") || t.drift;
    this.respawnKeyT = Math.max(0, this.respawnKeyT - dt);
    if (k.has("r") && this.respawnKeyT <= 0 && this.phase === "racing" && !this.player.finished && this.raceT > 3) { this.respawnKeyT = 3; this.respawnRacer(this.player); }
  }

  // ---------------------------------------------------------------- loop
  private loop = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused || this.hidden) return;
    this.fpsAcc += real; this.fpsN++;
    if (this.fpsAcc > 2) { this.autoQuality(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    const dt = this.slowmo > 0 ? real * 0.38 : real;
    this.slowmo = Math.max(0, this.slowmo - real);
    this.t += dt;
    this.step(dt);
    this.frame++;
    if (this.renderer.shadowMap.enabled && this.frame % this.shadowEvery === 0) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  };

  /** step quality down when the frame rate drops (shadow rate → particles → resolution) and back up when it recovers */
  private autoQuality(fps: number) {
    if (this.phase === "loading" || this.phase === "intro") return;
    if (fps < 42 && this.perfLevel < 5) { this.perfLevel++; this.goodWindows = 0; }
    else if (fps > 57) { if (++this.goodWindows >= 3 && this.perfLevel > 0) { this.perfLevel--; this.goodWindows = 0; } else return; }
    else return;
    const L = this.perfLevel;
    this.shadowEvery = L >= 3 ? 4 : L >= 1 ? 2 : 1;
    this.fx.budget = L >= 4 ? 0.45 : L >= 2 ? 0.7 : 1;
    const pr = this.basePixelRatio * (L >= 5 ? 0.6 : L >= 4 ? 0.7 : L >= 2 ? 0.85 : 1);
    if (Math.abs(pr - this.pixelRatio) > 0.01) { this.pixelRatio = Math.max(0.5, pr); this.renderer.setPixelRatio(this.pixelRatio); this.resize(); }
  }

  private step(dt: number) {
    this.readInput(dt);
    const P = this.player.car;
    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 2.4) { this.phase = "countdown"; this.countT = 0; this.countdown = 3; this.sound.beep(false); this.o.onEvent({ type: "toast", text: "3", big: true }); }
    } else if (this.phase === "countdown") {
      this.countT += dt;
      const c = 3 - Math.floor(this.countT);
      if (c !== this.countdown && c > 0) { this.countdown = c; this.sound.beep(false); this.o.onEvent({ type: "toast", text: String(c), big: true }); }
      this.perfectWindow = this.countT > 2.65;
      if (this.perfectWindow && this.input.nitro && !this.perfectDone) this.perfectDone = true;
      // revving on the grid
      const s = this.snd; s.rpm = this.input.gas ? 0.55 + Math.sin(this.t * 9) * 0.08 : 0.08; s.throttle = this.input.gas; s.gear = 1; s.speed01 = 0; s.boosting = false; s.slip = 0; s.drifting = false; s.offroad = false; s.air = false;
      this.sound.update(s);
      if (this.countT >= 3) this.go();
    } else if (this.phase === "racing" || this.phase === "finished") {
      this.raceT += dt;
      if (this.phase === "racing" && !this.perfectDone && this.raceT < 0.3 && this.input.nitro) this.perfectStart();
      this.updateRacers(dt);
      if (this.phase === "racing") this.modeRules(dt);
      if (this.phase === "finished") {
        this.finishT += dt;
        if (this.resultCache && this.resultCache.stars > 0 && this.finishT < 1.6 && Math.floor(this.finishT * 5) !== Math.floor((this.finishT - dt) * 5)) this.fx.confetti(this.player.model.group.position, 36);
        if (this.finishT > 2.6 && !this.finishedEmitted) { this.finishedEmitted = true; this.o.onEvent({ type: "finish", result: this.resultCache! }); }
      }
    }
    this.items.update(this.t, P.s);
    this.placeAll(dt);
    this.fx.update(dt);
    this.skids.update(this.t);
    this.world.update(dt, this.tmp.p.copy(this.player.model.group.position), this.camera);
    this.cameraStep(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.08; this.o.onHud(this.hud()); }
  }

  private go() {
    this.phase = "racing"; this.raceT = 0;
    this.sound.beep(true); this.sound.sfx("go");
    this.o.onEvent({ type: "toast", text: "GO!", big: true, tone: "green" });
    this.sound.music(true);
    for (const r of this.racers) { r.lapStart = 0; if (!r.isPlayer) r.car.v = 1.5; }
    if (this.perfectDone) this.perfectStart();
  }
  private hornT = -9;
  /** Highway Heat's HORN button (a beep with a short cooldown — on the grid too) */
  honk() {
    if (this.phase === "loading") return;
    if (this.t - this.hornT < 0.45) return;
    this.hornT = this.t;
    this.sound.sfx("horn", { rate: 0.95 + Math.random() * 0.1 });
  }
  private perfectStart() {
    this.perfectDone = true;
    const c = this.player.car; c.v += 12; c.nitro = Math.min(1, c.nitro + 0.3);
    this.sound.sfx("perfect"); this.sound.sfx("boostStart");
    this.o.onEvent({ type: "toast", text: "PERFECT START!", tone: "gold" });
    this.rig.kick(0.4);
  }
  private onPerfectNitro() {
    this.perfectNitros++;
    this.sound.sfx("perfect"); this.sound.sfx("boostStart", { rate: 0.8 });
    this.o.onEvent({ type: "toast", text: "PERFECT NITRO!", tone: "pink", big: false });
    this.rig.kick(0.55);
    this.fx.ring(this.player.model.group.position, 0xff7cf0, 14, 0.7);
  }
  private onPlayerDrift(level: number) {
    if (level <= 0 || this.phase !== "racing") return;
    // Drift Kings scores every slide on screen already — the mini-turbo just sounds off
    if (level >= 2 && this.style !== "drift") this.o.onEvent({ type: "toast", text: level === 3 ? "ULTRA TURBO!" : "SUPER TURBO", tone: level === 3 ? "pink" : "gold" });
    this.sound.sfx("boostStart", { gain: 0.4 + level * 0.15, rate: 1.1 });
    this.rig.kick(0.12 + level * 0.06);
  }

  // ---------------------------------------------------------------- simulation
  private updateRacers(dt: number) {
    const P = this.player, pc = P.car, tr = this.track;
    const alive = this.aliveCars; alive.length = 0;
    for (const r of this.racers) if (!r.out) alive.push(r.car);
    if (this.traffic) { for (const t of this.traffic.cars) if (t.active) alive.push(t.car); for (const b of this.traffic.blocks) if (b.active) alive.push(b.car); }
    // controls
    // Auto drive off (the default): the car never steers itself — the player drives
    pc.assist = !this.autoDrive ? 0 : this.t - this.lastTouchT < 4 || this.touch.useTilt ? Math.max(this.steerAssist, 0.8) : this.steerAssist;
    if (!P.finished) {
      if (this.autopilot) this.autopilot.drive(dt, tr, alive, pc, this.raceT, this.items);
      else { const ci = pc.input, i = this.input; const v01 = clamp(pc.v / 60, 0, 1); ci.steer = i.steer * (1 - v01 * 0.18 * (1 - pc.slip)); ci.gas = i.gas; ci.brake = i.brake; ci.nitro = i.nitro; ci.drift = i.drift; }
    }
    for (const r of this.racers) {
      if (r.out) continue;
      if (r.driver) r.driver.drive(dt, tr, alive, pc, this.raceT, this.items);
      else if (r.finished) { // cruise after the flag
        const ci = r.car.input; ci.gas = r.car.v > 28 ? 0 : 0.5; ci.brake = r.car.v > 34 ? 0.3 : 0; ci.nitro = false; ci.drift = false;
        ci.steer = clamp(-r.car.d * 0.2 - r.car.vd * 0.1, -1, 1);
      }
    }
    // physics (2 substeps keeps fast cars stable)
    const sub = dt > 1 / 45 ? 2 : 1;
    for (let k = 0; k < sub; k++) for (const r of this.racers) if (!r.out) r.car.step(dt / sub, tr, this.gripMul);
    this.slipstream(dt);
    this.collide();
    if (this.traffic) this.trafficStep(dt);
    if (this.phase === "racing") this.respawns();
    // laps
    const target = this.lapsTarget();
    for (const r of this.racers) {
      if (r.out || r.cop) continue;
      const c = r.car;
      while (c.lap >= 1 && r.lapsDone < c.lap) {
        r.lapsDone++;
        const lt = this.raceT - r.lapStart; r.lapStart = this.raceT; r.lastLap = lt;
        const best = !r.bestLap || lt < r.bestLap; if (best) r.bestLap = lt;
        if (r.isPlayer && !r.finished) this.onPlayerLap(lt, best);
        if (!r.finished && target && r.lapsDone >= target) this.finishRacer(r);
      }
    }
    if (this.tt && !P.finished) this.recordGhost();
    if (this.style === "drift") this.driftScoring(dt);
    if (this.cfg.mode === "wheelie" && !P.finished) this.wheelieScoring(dt);
    if (this.cfg.mode === "rally" && !P.finished) this.coDriver(dt);
    this.nearMiss();
    this.effects(dt);
    // the boss shows off
    if (this.boss && !this.boss.out) {
      const b = this.boss.car;
      if (b.shock > 2.7 && !this.bossShock && Math.abs(tr.delta(pc.s, b.s)) < 120) this.o.onEvent({ type: "toast", text: `${this.boss.name.toUpperCase()}: PERFECT NITRO!`, tone: "red" });
      this.bossShock = b.shock > 2.7;
    }
    // sound (player)
    const s = this.snd; s.rpm = pc.rpm; s.throttle = pc.input.gas; s.gear = pc.gear; s.speed01 = Math.min(1, pc.v / pc.params.vmax); s.boosting = pc.boosting; s.slip = pc.slip; s.drifting = pc.drifting; s.offroad = pc.offroad || pc.kerb; s.air = pc.air;
    this.sound.update(s);
    this.rivalAudio();
    // items: player
    if (!P.finished) {
      const hits = this.items.touching(pc.s, pc.d, P.car.params.halfLength, pc.magnet, pc.y, pc.params.halfWidth);
      for (let i = 0; i < hits.length; i++) this.pickup(hits[i]);
    }
    // items: AI (same rules, but they don't use up the items)
    for (const r of this.racers) {
      if (r.isPlayer || r.out) continue;
      const c = r.car, hits = this.items.touching(c.s, c.d, c.params.halfLength, 0, c.y, c.params.halfWidth);
      for (let i = 0; i < hits.length; i++) {
        const it = hits[i];
        if (it.id === r.lastItem && this.t - r.lastItemT < 3) continue;
        r.lastItem = it.id; r.lastItemT = this.t;
        if (it.kind === "oil") c.spinOut(Math.random() < 0.5 ? -1 : 1);
        else if (it.kind === "puddle") c.v *= 0.88;
        else if (it.kind === "cones") c.v *= 0.8;
        else if (it.kind === "ramp") c.jump(RAMP_POWER);
        else if (it.kind === "nitro") c.nitro = Math.min(1, c.nitro + 0.3);
        else if (LIFE_HAZARDS.has(it.kind)) c.wreckOut(1.2);
      }
    }
  }

  private lapsTarget() { const m = this.cfg.mode; return m === "coinrush" || m === "elimination" || m === "heat" || m === "takedown" || m === "wheelie" ? 0 : this.cfg.laps; }

  private slipstream(dt: number) {
    const tr = this.track;
    for (const r of this.racers) {
      if (r.out) continue;
      const c = r.car;
      let draft = false;
      if (c.v > 25) for (const o of this.racers) {
        if (o === r || o.out) continue;
        const ds = tr.delta(c.s, o.car.s);
        if (ds > 4 && ds < 30 && Math.abs(o.car.d - c.d) < 1.9) { draft = true; break; }
      }
      c.draft = clamp(c.draft + (draft ? dt * 1.4 : -dt * 2), 0, 1);
      if (draft) c.nitro = Math.min(1, c.nitro + dt * 0.07);
      if (r.isPlayer && !r.finished) {
        if (c.draft > 0.8 && !r.draftShown) { r.draftShown = true; this.o.onEvent({ type: "toast", text: "SLIPSTREAM!", tone: "blue" }); this.sound.sfx("whoosh"); }
        if (c.draft < 0.1) r.draftShown = false;
      }
    }
  }

  private collide() {
    const rs = this.racers, tr = this.track, wall = tr.halfWidth + tr.shoulder;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.out || b.out) continue;
      const A = a.car, B = b.car;
      // respawning (ghost) and wrecked cars don't collide — no pile-ups behind a takedown
      if (A.ghost > 0 || B.ghost > 0 || A.wreck > 0 || B.wreck > 0 || A.air !== B.air) continue;
      const ds = tr.delta(A.s, B.s); // B relative to A
      const lenSum = A.params.halfLength + B.params.halfLength, widSum = A.params.halfWidth + B.params.halfWidth;
      const dd = B.d - A.d;
      if (Math.abs(ds) >= lenSum || Math.abs(dd) >= widSum) continue;
      const ma = A.params.mass, mb = B.params.mass, tot = ma + mb;
      const oS = lenSum - Math.abs(ds), oD = widSum - Math.abs(dd);
      let hit = 0, side = false;
      let rearCar = A, frontCar = B;
      if (oS > oD * 1.3) {
        // side by side: push apart sideways
        side = true;
        const sgn = Math.sign(dd) || 1;
        A.d -= sgn * oD * (mb / tot); B.d += sgn * oD * (ma / tot);
        hit = Math.abs(A.vd - B.vd);
        const avd = A.vd; A.vd = B.vd * (mb / tot) - sgn * 2.2 * (mb / tot) * 2; B.vd = avd * (ma / tot) + sgn * 2.2 * (ma / tot) * 2;
      } else {
        // nose to tail
        [frontCar, rearCar] = ds > 0 ? [B, A] : [A, B];
        hit = Math.max(0, rearCar.v - frontCar.v);
        const m1 = rearCar.params.mass, m2 = frontCar.params.mass;
        const v = (rearCar.v * m1 + frontCar.v * m2) / (m1 + m2);
        rearCar.v = v - 1.5; frontCar.v = v + 1.2 * (m1 / (m1 + m2));
        this.shiftS(rearCar, -(oS + 0.05));
      }
      const pl = a.isPlayer ? a : b.isPlayer ? b : null, other = pl === a ? b : a;
      if (pl) this.nm.hit[other.idx] = 1;
      // ---- takedowns
      if (pl && other.car.wreck <= 0 && !other.finished) {
        const P = pl.car, O = other.car;
        const shock = P.shock > 0, heavy = P.params.mass > O.params.mass * 1.45;
        const ramming = !side && rearCar === P && hit > (shock ? 2.5 : P.boosting || heavy ? 6 : 99);
        const slam = side && hit > (shock ? 2 : 4.5) && Math.abs(O.d) > wall - O.params.halfWidth - 2.2 && Math.sign(O.d - P.d) === Math.sign(O.d);
        if ((ramming || slam || (shock && hit > 2)) && O.wreckOut()) {
          this.takedowns++; P.nitro = Math.min(1, P.nitro + 0.35);
          if (other.cop) { this.copTakedowns++; this.score += 500; }
          if (this.cfg.mode === "takedown" && !other.cop) { other.hp = 0; this.bustSuspect(other); }
          other.tumble = Math.sign(O.d - P.d) || 1;
          this.o.onEvent({ type: "toast", text: `TAKEDOWN! ${other.name}`, tone: "red" });
          this.sound.sfx("takedown"); this.rig.kick(0.6); this.slowmo = 0.7;
          this.fx.sparks(this.worldAt(O.s, O.d, 0.6, this.tmp.w), 30);
          this.fx.ring(other.model.group.position, 0xff5a6e, 9, 0.5);
          continue;
        }
        // rivals can wreck you too on hard/pro (aggressive ones, boosting into your rear)
        const agg = other.driver && (other.driver.personality === "aggressive" || other.driver.personality === "boss") && (this.cfg.ai === "hard" || this.cfg.ai === "pro");
        if (agg && !side && rearCar === O && O.boosting && hit > 8.5 && this.cfg.mode !== "coinrush" && P.wreckOut()) {
          pl.tumble = Math.sign(P.d - O.d) || 1;
          this.o.onEvent({ type: "toast", text: `WRECKED by ${other.name}!`, tone: "red" });
          this.sound.sfx("crash"); this.rig.kick(0.8);
          this.fx.sparks(this.worldAt(P.s, P.d, 0.6, this.tmp.w), 26);
          continue;
        }
      } else if (!pl && hit > 10 && (A.boosting || B.boosting)) {
        // AI pile-ups happen too
        const victim = frontCar === A ? a : b;
        if (Math.random() < 0.4 && victim.car.wreckOut()) victim.tumble = Math.random() < 0.5 ? -1 : 1;
      }
      // Highway Heat: cops dent you; in Takedown your rams wear the suspect down
      if (pl && other.cop && this.chase && hit > 1.5 && this.phase === "racing") {
        this.damage = Math.min(100, this.damage + Math.min(18, hit * 2.4));
        if (hit > 4) this.o.onEvent({ type: "toast", text: `RAMMED! ${Math.round(this.damage)}% damage`, tone: "red" });
      }
      if (pl && this.cfg.mode === "takedown" && !other.cop && !other.out && hit > 2 && this.phase === "racing") {
        const P = pl.car, dmg = Math.min(48, hit * 5.5) * (P.shock > 0 ? 2 : P.boosting ? 1.5 : 1);
        other.hp = Math.max(0, other.hp - dmg);
        if (other.hp <= 0) this.bustSuspect(other);
        else this.o.onEvent({ type: "toast", text: `HIT! ${other.name} ${Math.round(other.hp)}%`, tone: "blue" });
      }
      if (hit > 2 && pl) {
        this.sound.sfx("hit", { gain: Math.min(1, hit / 10), pan: clamp((other.car.d - pl.car.d) / 3, -1, 1) });
        this.rig.kick(Math.min(0.4, hit / 20));
        this.fx.sparks(this.worldAt((A.s + (A.s + ds)) / 2, (A.d + B.d) / 2, 0.5, this.tmp.w), 10);
      }
    }
  }

  /** move a car along the road, keeping lap/progress consistent when it crosses the line */
  private shiftS(c: Vehicle, by: number) {
    const L = this.track.length, ns = c.s + by;
    if (ns < 0) c.lap--; else if (ns >= L) c.lap++;
    c.s = this.track.wrap(ns); c.progress = c.lap * L + c.s;
  }

  /** passing a rival close at speed without touching → NEAR MISS (nitro) */
  private nearMiss() {
    const P = this.player, pc = P.car, tr = this.track, nm = this.nm;
    if (P.finished) return;
    for (const r of this.racers) {
      if (r.isPlayer || r.out) continue;
      const i = r.idx, c = r.car;
      const ds = tr.delta(pc.s, c.s);
      const lenSum = pc.params.halfLength + c.params.halfLength;
      const clear = Math.abs(c.d - pc.d) - pc.params.halfWidth - c.params.halfWidth;
      if (Math.abs(ds) < lenSum + 2) nm.min[i] = Math.min(nm.min[i], clear);
      if (nm.prev[i] > 0 && ds <= 0 && ds > -12) {
        if (nm.min[i] < 0.9 && !nm.hit[i] && pc.v > 28 && pc.v - c.v > 1.5 && c.wreck <= 0 && pc.ghost <= 0) {
          this.nearMisses++; pc.nitro = Math.min(1, pc.nitro + 0.12);
          this.o.onEvent({ type: "toast", text: "NEAR MISS! +NITRO", tone: "blue" });
          this.sound.sfx("whoosh", { rate: 1.2, pan: clamp((c.d - pc.d) / 2, -1, 1) });
        }
        nm.min[i] = 99; nm.hit[i] = 0;
      }
      if (Math.abs(ds) > lenSum + 8) { nm.min[i] = 99; nm.hit[i] = 0; }
      nm.prev[i] = ds;
    }
    // close calls with life hazards (coin rush)
    if (this.timed && pc.v > 25 && pc.ghost <= 0) this.items.each(pc.s - pc.params.halfLength - 2, pc.s - pc.params.halfLength, this.closeCall);
  }
  private closeCall = (it: TrackItem) => {
    const pc = this.player.car;
    if (it.taken || !LIFE_HAZARDS.has(it.kind) || this.hazNear[it.id] === pc.lap) return;
    const clear = Math.abs(it.d - pc.d) - pc.params.halfWidth;
    const hitW = 1.0 + (it.kind === "spikes" ? 1.6 : it.kind === "rock" ? 0.6 : 0.25);
    if (clear < hitW + 0.9 && clear > hitW - 0.35) {
      this.hazNear[it.id] = pc.lap;
      this.nearMisses++; pc.nitro = Math.min(1, pc.nitro + 0.08);
      this.o.onEvent({ type: "toast", text: "CLOSE CALL! +NITRO", tone: "blue" });
      this.sound.sfx("whoosh", { rate: 1.3 });
    }
  };

  /** auto-respawn when stuck, off the road too long, going the wrong way or after a wreck off the tarmac */
  private respawns() {
    const hw = this.track.halfWidth;
    for (const r of this.racers) {
      if (r.out || r.finished) continue;
      const c = r.car, wreckEnded = r.wasWreck && c.wreck <= 0;
      r.wasWreck = c.wreck > 0;
      if (this.raceT < 4 && !wreckEnded) continue;
      if (c.stuckT > (r.isPlayer ? 2.2 : 3) || c.offT > 3.5 || c.backT > 2.5 || (wreckEnded && Math.abs(c.d) > hw + 0.5)) this.respawnRacer(r);
    }
  }
  private respawnRacer(r: Racer) {
    const c = r.car, hw = this.track.halfWidth, tr = this.track;
    let best = 0, bestScore = Infinity;
    for (const lane of [-hw * 0.45, 0, hw * 0.45]) {
      let score = Math.abs(lane - clamp(c.d, -hw, hw)) * 0.2;
      for (const o of this.racers) if (o !== r && !o.out && Math.abs(tr.delta(c.s, o.car.s)) < 14 && Math.abs(o.car.d - lane) < 2.6) score += 10;
      this.items.each(c.s - 3, c.s + 30, (it) => { if (!it.taken && HAZARDS.has(it.kind) && Math.abs(it.d - lane) < 2.6) score += 6; });
      if (score < bestScore) { bestScore = score; best = lane; }
    }
    // rivals (and Auto drive) roll away at speed; the player's own car only moves when they hold gas
    const roll = !r.isPlayer || this.autoDrive || c.input.gas > 0.1;
    c.respawn(best, roll ? Math.max(10, c.params.vmax * 0.35) : 0, 1.8);
    r.tumble = 1;
    this.fx.ring(this.worldAt(c.s, best, 0.1, this.tmp.w), 0x7cf2ff, 6, 0.5);
    if (r.isPlayer) { this.o.onEvent({ type: "toast", text: "BACK ON TRACK", tone: "blue" }); this.sound.sfx("whoosh", { rate: 0.8 }); }
  }

  private onImpact(r: Racer, kind: string, k: number) {
    if (this.style === "drift" && this.phase === "racing") {
      if (kind === "wall") { if (r.drift.lose() === "lost" && r.isPlayer) this.chainLost(r.drift.last); }
      else if (kind === "scrape") r.drift.scrape();
    }
    if (!r.isPlayer) return;
    const c = r.car, w = this.tmp.e;
    if (kind === "wall") { this.sound.sfx("crash", { gain: Math.min(1, k / 12), pan: Math.sign(c.d) * 0.7 }); this.rig.kick(Math.min(0.6, k / 18)); this.fx.sparks(this.worldAt(c.s, c.d + Math.sign(c.d) * 0.9, 0.5, w), 18); }
    else if (kind === "scrape") { if (Math.random() < 0.12) this.sound.sfx("scrape", { pan: Math.sign(c.d) * 0.8 }); if (Math.random() < 0.6) this.fx.sparks(this.worldAt(c.s, c.d + Math.sign(c.d) * 0.95, 0.4, w), 3); }
    else if (kind === "land") {
      this.sound.sfx("land", { gain: Math.min(1, k / 10) }); this.rig.land(Math.min(0.6, k / 12));
      if (c.airT > 0.6 && this.phase === "racing") { c.nitro = Math.min(1, c.nitro + Math.min(0.2, c.airT * 0.15)); this.o.onEvent({ type: "toast", text: c.airT > 1 ? "HUGE AIR! +NITRO" : "BIG AIR! +NITRO", tone: "gold" }); }
    }
  }

  private pickup(it: TrackItem) {
    if (this.phase !== "racing") return;
    const P = this.player, c = P.car, now = this.t, coinrush = this.timed;
    const pan = clamp((it.d - c.d) / 4, -1, 1);
    const at = this.worldAt(it.s, it.d, 0.5 + (it.h ?? 0), this.tmp.w);
    if (HAZARDS.has(it.kind)) {
      if (c.ghost > 0) return;
      if (it.kind === "puddle") { c.v *= 0.86; this.items.take(it, now, 3); this.fx.splash(at); this.sound.sfx("whoosh", { rate: 0.6 }); if (coinrush) this.o.onEvent({ type: "toast", text: "SPLASH!", tone: "blue" }); return; }
      if (c.shield > 0) { c.shield = 0; this.items.take(it, now, coinrush ? 25 : 8); this.o.onEvent({ type: "toast", text: "SHIELD SAVED YOU!", tone: "blue" }); this.sound.sfx("shield"); this.fx.burst(at, "#7CF2FF", 24); return; }
      this.items.take(it, now, coinrush ? 25 : 10);
      if (it.kind === "oil") { c.spinOut(Math.random() < 0.5 ? -1 : 1); this.sound.sfx("spin"); this.o.onEvent({ type: "toast", text: "OIL SLICK!", tone: "red" }); }
      else if (it.kind === "cones") { c.v *= 0.75; this.sound.sfx("hit", { pan }); this.fx.sparks(at, 8); this.o.onEvent({ type: "toast", text: "CONES!", tone: "red" }); }
      else { // fire, rock, spikes: hurt
        if (it.kind === "fire") { this.sound.sfx("fire"); this.fx.fire(at); } else { this.sound.sfx("crash", { pan }); this.fx.sparks(at, 20); }
        if (it.kind === "spikes") { c.v *= 0.45; c.spinOut(Math.random() < 0.5 ? -1 : 1); } else { P.tumble = Math.random() < 0.5 ? -1 : 1; c.wreckOut(coinrush ? 1.1 : 1.6); }
        this.rig.kick(0.55);
        if (this.lives != null) {
          this.lives--;
          c.ghost = 2.6; // a moment to recover — no chain hits
          this.o.onEvent({ type: "toast", text: this.lives > 0 ? `OUCH! ${this.lives} ♥ left` : "OUT OF LIVES!", tone: "red", big: this.lives <= 0 });
          if (this.lives <= 0) this.endRace();
        } else this.o.onEvent({ type: "toast", text: it.kind === "spikes" ? "SPIKES!" : "CRASH!", tone: "red" });
      }
      return;
    }
    switch (it.kind) {
      case "coin": {
        this.coins++; this.items.take(it, now, coinrush ? 25 : 30);
        this.coinChain = now - this.coinChainT < 1.4 ? this.coinChain + 1 : 1; this.coinChainT = now;
        this.sound.sfx("coin", { pan, rate: 1 + Math.min(10, this.coinChain) * 0.03 });
        this.fx.coinSparkle(at);
        if (this.coinChain > 0 && this.coinChain % 25 === 0) { this.o.onEvent({ type: "toast", text: `COIN STREAK ×${this.coinChain}!`, tone: "gold" }); c.nitro = Math.min(1, c.nitro + 0.05); }
        break;
      }
      case "nitro": c.nitro = Math.min(1, c.nitro + (coinrush ? 0.5 : 0.4)); this.items.take(it, now, coinrush ? 25 : 20); this.sound.sfx("nitroPickup", { pan }); this.fx.burst(at, "#3BA8FF"); this.o.onEvent({ type: "toast", text: "+NITRO", tone: "blue" }); break;
      case "shield": c.shield = 12; this.items.take(it, now, 40); this.sound.sfx("shield", { pan }); this.fx.burst(at, "#7CF2FF"); this.o.onEvent({ type: "toast", text: "SHIELD!", tone: "blue" }); break;
      case "magnet": c.magnet = 10; this.items.take(it, now, 40); this.sound.sfx("magnet", { pan }); this.fx.burst(at, "#FF5A8E"); this.o.onEvent({ type: "toast", text: "COIN MAGNET!", tone: "gold" }); break;
      case "ramp": if (!c.air) { c.jump(RAMP_POWER); this.sound.sfx("jump"); } break;
    }
  }

  private onPlayerLap(lt: number, best: boolean) {
    const target = this.lapsTarget(), P = this.player;
    if (this.timed || this.cfg.mode === "elimination" || this.cfg.mode === "takedown") return;
    this.o.onEvent({ type: "lap", lap: P.lapsDone, time: lt, best });
    this.sound.sfx("lap");
    if (this.tt && this.ghostBest && P.lapsDone >= 1) {
      const d = lt - this.ghostBest.lap;
      this.o.onEvent({ type: "toast", text: `${d <= 0 ? "−" : "+"}${Math.abs(d).toFixed(2)}s vs ghost`, tone: d <= 0 ? "green" : "red" });
    }
    if (target && P.lapsDone === target - 1) { this.o.onEvent({ type: "toast", text: "FINAL LAP!", tone: "pink", big: true }); this.sound.sfx("finalLap"); }
    else if (best && P.lapsDone > 1) this.o.onEvent({ type: "toast", text: "BEST LAP!", tone: "green" });
    if (this.tt) this.saveGhost(lt);
  }

  private modeRules(dt: number) {
    const P = this.player, pc = P.car;
    if (this.chase) this.pursuit(dt);
    if (this.cfg.mode === "takedown" && this.timeLeft != null) {
      this.timeLeft -= dt;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec >= 1 && sec !== this.lastBeep) { this.lastBeep = sec; this.sound.sfx("countdown"); }
      if (sec > 5) this.lastBeep = 99;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.o.onEvent({ type: "toast", text: "THEY GOT AWAY!", tone: "red", big: true }); this.endRace(true); return; }
      // your own siren while you hunt
      this.sirenT -= dt;
      if (this.sirenT <= 0) { this.sirenT = 1.3; this.sound.sfx("siren", { gain: 0.32 }); }
    }
    if (this.timed && this.timeLeft != null) {
      this.timeLeft -= dt;
      // checkpoint gates
      const gates = this.items.gates;
      if (gates.length) {
        const L = this.track.length;
        const gp = this.gateLap * L + gates[this.gateIdx];
        if (pc.progress >= gp) {
          this.timeLeft += this.gateBonus; this.checkpoints++;
          this.sound.sfx("checkpoint");
          this.o.onEvent({ type: "toast", text: `CHECKPOINT +${this.gateBonus}s`, tone: "green" });
          this.fx.ring(this.worldAt(gates[this.gateIdx], 0, 0.2, this.tmp.w), 0x3cff8f, 12, 0.6);
          this.items.setGate(this.gateIdx, 2);
          this.gateIdx++;
          if (this.gateIdx >= gates.length) {
            this.gateIdx = 0; this.gateLap++;
            for (let i = 0; i < gates.length; i++) this.items.setGate(i, 0);
            this.items.resetAll(this.t);
            this.o.onEvent({ type: "toast", text: "LAP COMPLETE — COINS RESTOCKED!", tone: "gold" });
          }
          this.items.setGate(this.gateIdx, 1);
        }
        this.items.pulseGate(this.gateIdx, this.t);
      }
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec >= 1 && sec !== this.lastBeep) { this.lastBeep = sec; this.sound.sfx("countdown"); }
      if (sec > 5) this.lastBeep = 99;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.o.onEvent({ type: "toast", text: "TIME UP!", tone: "red", big: true }); this.endRace(); }
    }
    if (this.cfg.mode === "elimination") {
      this.elimT -= dt;
      this.timeLeft = this.elimT;
      // who's last right now
      let last: Racer | null = null, aliveN = 0;
      for (const r of this.racers) { if (r.out) continue; aliveN++; if (!last || r.car.progress < last.car.progress) last = r; }
      this.lastPlace = last;
      const sec = Math.ceil(this.elimT);
      if (sec <= 3 && sec >= 1 && sec !== this.lastBeep) { this.lastBeep = sec; this.sound.beep(false); }
      if (sec > 3) this.lastBeep = 99;
      if (last?.isPlayer && this.elimT < 6 && this.elimWarn <= 0) { this.elimWarn = 7; this.o.onEvent({ type: "toast", text: "DANGER! OVERTAKE NOW!", tone: "red" }); }
      this.elimWarn -= dt;
      if (this.elimT <= 0 && last) {
        this.elimT = this.elimInterval();
        last.out = true; last.outOrder = ++this.outCount; last.outT = 1.3;
        last.car.v *= 0.3;
        this.sound.sfx("eliminated");
        const at = last.model.group.position;
        this.fx.fire(at); this.fx.sparks(at, 24); this.fx.ring(at, 0xff3b55, 10, 0.6);
        if (Math.abs(this.track.delta(pc.s, last.car.s)) < 60) this.rig.kick(0.35);
        this.o.onEvent({ type: "toast", text: last.isPlayer ? "YOU'RE OUT!" : `${last.name} ELIMINATED!`, tone: "red", big: last.isPlayer });
        if (last.isPlayer || aliveN - 1 <= 1) this.endRace();
        else if (aliveN - 1 === 2) this.o.onEvent({ type: "toast", text: "FINAL DUEL!", tone: "pink", big: true });
      }
    }
    // laps modes: if the field has finished long ago, close the race (no endless waiting)
    if (this.lapsTarget()) {
      if (this.leaderDoneT < 0 && this.racers.some((r) => r.finished && !r.isPlayer)) this.leaderDoneT = this.raceT;
      if (this.leaderDoneT >= 0 && this.raceT - this.leaderDoneT > 45 && !P.finished) { this.o.onEvent({ type: "toast", text: "RACE OVER", tone: "red" }); this.endRace(true); }
    }
  }

  private finishRacer(r: Racer) {
    r.finished = true; r.finishTime = this.raceT;
    if (r.isPlayer) this.endRace();
  }

  private standings(): RacerView[] {
    const list = this.racers.filter((r) => !r.cop).sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      if (a.out && b.out) return b.outOrder - a.outOrder;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.car.progress - a.car.progress;
    });
    const leader = list[0];
    const laps = Math.max(1, this.lapsTarget() || this.cfg.laps);
    return list.map((r, i) => ({
      id: r.id, name: r.name, avatar: r.avatar, carId: r.spec.id, color: r.color, isPlayer: r.isPlayer, pos: i + 1,
      lap: Math.max(1, Math.min(laps, r.car.lap + 1)), progress: r.car.progress, finished: r.finished, time: r.finishTime, out: r.out,
      gap: r.out ? 0 : (leader.car.progress - r.car.progress) / Math.max(20, r.car.v || 30),
    }));
  }

  private endRace(timeout = false) {
    if (this.phase === "finished") return;
    this.phase = "finished"; this.finishT = 0;
    const P = this.player, st = this.standings();
    const me = st.find((x) => x.isPlayer)!;
    let pos = me.pos;
    const mode = this.cfg.mode, L = this.track.length, target = this.lapsTarget();
    // drift scoring: bank whatever is still in the air
    let rivalPoints: number | undefined;
    if (this.style === "drift") for (const r of this.racers) r.drift.bank();
    if (mode === "battle" && this.boss) {
      let rp = this.boss.drift.total;
      // the rival is still sliding round: project its score to the flag
      if (!this.boss.finished && !timeout) rp = Math.round(rp * clamp((target * L) / Math.max(L * 0.3, this.boss.car.progress), 1, 1.4));
      rivalPoints = rp;
      pos = P.drift.total >= rp ? 1 : 2;
    }
    // project finish times for cars still running so results show a full field
    if (target) for (const v of st) {
      if (v.finished || v.out || v.isPlayer) continue;
      const r = this.racers.find((x) => x.id === v.id)!;
      const remain = Math.max(0, target * L - r.car.progress), avg = Math.max(15, r.car.progress / Math.max(1, this.raceT));
      v.time = this.raceT + remain / avg; v.finished = true;
    }
    if (target && !P.finished) me.time = this.raceT;
    let stars: 0 | 1 | 2 | 3 = 0, margin: number | undefined;
    // podium stars scale with the field: last place never earns a star
    const n = this.racers.length;
    const podium = (p: number): 0 | 1 | 2 | 3 => (p === 1 ? 3 : p === 2 && n >= 3 ? (n >= 4 ? 2 : 1) : p === 3 && n >= 5 ? 1 : 0);
    if (mode === "race") stars = timeout ? 0 : podium(pos);
    if (mode === "duel") {
      const boss = st.find((x) => !x.isPlayer);
      margin = boss ? (boss.time || this.raceT) - this.raceT : 0;
      stars = timeout || pos !== 1 ? 0 : margin >= 2 ? 3 : 2;
    }
    if (mode === "elimination") stars = podium(pos);
    const heatScore = Math.round(this.dist) + this.score;
    if (mode === "wheelie") { const t = this.targets, sc = Math.round(this.score); stars = sc >= t[2] ? 3 : sc >= t[1] ? 2 : sc >= t[0] ? 1 : 0; }
    if (mode === "heat") { const t = this.targets; stars = heatScore >= t[2] ? 3 : heatScore >= t[1] ? 2 : heatScore >= t[0] ? 1 : 0; }
    if (mode === "escape") { stars = this.busted || timeout || !P.finished ? 0 : this.damage < 35 ? 3 : this.damage < 70 ? 2 : 1; pos = stars > 0 ? 1 : 2; }
    let suspects: [number, number] | undefined;
    if (mode === "takedown") {
      const sus = this.racers.filter((r) => !r.isPlayer && !r.cop), got = sus.filter((r) => r.hp <= 0).length;
      suspects = [got, sus.length];
      const frac = (this.timeLeft ?? 0) / Math.max(1, this.cfg.timeLimit ?? 90);
      stars = got < sus.length ? (got > 0 && sus.length > 1 ? 1 : 0) : frac > 0.45 ? 3 : frac > 0.2 ? 2 : 1;
      pos = got === sus.length ? 1 : 2;
    }
    if (mode === "drift") { const t = this.targets, dp = P.drift.total; stars = dp >= t[2] ? 3 : dp >= t[1] ? 2 : dp >= t[0] ? 1 : 0; }
    if (mode === "battle") { const ratio = P.drift.total / Math.max(1, rivalPoints ?? 0); stars = timeout ? 0 : ratio >= 1.15 ? 3 : ratio >= 1 ? 2 : ratio >= 0.8 ? 1 : 0; }
    if (this.tt) { const tt = this.targets, ms = this.raceT * 1000; stars = timeout ? 0 : ms <= tt[0] ? 3 : ms <= tt[1] ? 2 : ms <= tt[2] ? 1 : 0; }
    if (mode === "coinrush") { const ct = this.targets; stars = this.coins >= ct[2] ? 3 : this.coins >= ct[1] ? 2 : this.coins >= ct[0] ? 1 : 0; }
    const completed = stars > 0;
    const posBonus = mode === "race" ? [120, 80, 55, 35, 25, 20, 15, 10][pos - 1] ?? 10 : mode === "duel" || mode === "battle" || mode === "takedown" ? (pos === 1 ? 150 : 20) : mode === "escape" ? (stars > 0 ? 130 : 20) : mode === "elimination" ? [140, 90, 60, 40, 25, 20, 15, 10][pos - 1] ?? 10 : 40;
    const driftPoints = this.style === "drift" ? P.drift.total : undefined;
    const reward = this.coins + posBonus + stars * 25 + this.takedowns * 10 + this.nearMisses * 2 + this.perfectNitros * 5 + Math.round((driftPoints ?? 0) / 100) + (mode === "heat" ? Math.round(heatScore / 150) : mode === "wheelie" ? Math.round(this.score / 120) : 0);
    this.resultCache = {
      mode, completed, pos, racers: this.racers.length, time: this.raceT * 1000, bestLap: P.bestLap * 1000, coins: this.coins, stars, reward,
      takedowns: this.takedowns, driftScore: Math.round(P.car.driftScore), topSpeed: Math.round(P.car.topSpeed), standings: st,
      nearMisses: this.nearMisses, perfectNitros: this.perfectNitros, targets: this.targets.length ? [...this.targets] : undefined,
      checkpoints: mode === "coinrush" ? this.checkpoints : undefined, margin,
      driftPoints, bestChain: driftPoints != null ? P.drift.best : undefined, rivalPoints, rivalName: mode === "battle" ? this.boss?.name : undefined,
      score: mode === "heat" ? heatScore : mode === "wheelie" ? Math.round(this.score) : undefined, busted: this.chase ? this.busted : undefined, damage: this.chase ? Math.round(this.damage) : undefined,
      suspects, copTakedowns: this.chase ? this.copTakedowns : undefined,
    };
    this.sound.sfx(stars > 0 ? "finish" : "lose");
    if (stars >= 2) this.sound.sfx("win");
    const versus = mode === "race" || mode === "duel" || mode === "elimination" || mode === "battle";
    const head = mode === "battle" ? (pos === 1 ? "BATTLE WON!" : "BATTLE LOST") : mode === "drift" ? `${(driftPoints ?? 0).toLocaleString("en-US")} PTS`
      : mode === "heat" ? `${heatScore.toLocaleString("en-US")} PTS` : mode === "wheelie" ? `${Math.round(this.score).toLocaleString("en-US")} PTS` : mode === "escape" ? (stars > 0 ? "ESCAPED!" : "BUSTED!") : mode === "takedown" ? (pos === 1 ? "ALL BUSTED!" : "THEY GOT AWAY") : null;
    this.o.onEvent({ type: "toast", text: head ?? (stars > 0 ? (pos === 1 && versus ? (mode === "duel" ? "BOSS DEFEATED!" : "1ST PLACE!") : "FINISH!") : mode === "coinrush" ? `${this.coins} COINS` : "RACE OVER"), big: true, tone: stars > 0 ? "gold" : "red" });
    // the player car keeps rolling on autopilot
    P.finished = true; if (!P.finishTime) P.finishTime = this.raceT;
    P.driver = new Driver(P.car, "easy", 0.9, 5, "racer");
    this.autopilot = null;
    this.slowmo = 1.1;
    this.sound.music(false);
  }

  // ---------------------------------------------------------------- Highway Heat: traffic, cops, heat
  private addLights(g: THREE.Object3D, h: number, live: () => boolean) {
    const mk = (col: string) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightTex(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(2.2, 2.2, 1); sp.visible = false; this.scene.add(sp); return sp;
    };
    this.lights.push({ r: mk("#FF2A3A"), b: mk("#2A6BFF"), g, h, live });
  }

  private trafficStep(dt: number) {
    const T = this.traffic!, tr = this.track, P = this.player, pc = P.car;
    T.update(dt, pc.s);
    if (this.phase === "racing" && !P.finished) this.dist += Math.max(0, pc.v) * dt;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    for (const r of this.racers) {
      if (r.out || r.car.air || r.car.ghost > 0 || r.car.wreck > 0) continue;
      const A = r.car;
      for (const list of [T.cars, T.blocks]) for (const t of list) {
        if (!t.active) continue;
        const B = t.car, ds = tr.delta(A.s, B.s);
        if (Math.abs(ds) > 12) continue;
        const lenSum = A.params.halfLength + B.params.halfLength, widSum = A.params.halfWidth + B.params.halfWidth, dd = B.d - A.d;
        if (Math.abs(ds) >= lenSum || Math.abs(dd) >= widSum) continue;
        this.trafficHit(r, t, ds, dd, lenSum - Math.abs(ds), widSum - Math.abs(dd));
      }
    }
    if (!P.finished) this.trafficNearMiss();
  }

  private trafficHit(r: Racer, t: TrafficCar, ds: number, dd: number, oS: number, oD: number) {
    const A = r.car, B = t.car, sgn = Math.sign(dd) || 1, T = this.traffic!;
    // after the flag (autopilot cruise) the player car is just another car: no penalties, no toasts
    const pl = r.isPlayer && this.phase === "racing" && !r.finished, esc = this.cfg.mode === "escape";
    if (pl) t.nmHit = true;
    const at = this.worldAt((A.s + B.s) / 2, (A.d + B.d) / 2, 0.5, this.tmp.w);
    if (oS > oD * 1.3 && !t.block) {
      // side swipe: shove apart, a few sparks
      A.d -= sgn * oD * 0.85; B.d += sgn * oD * 0.15; A.vd = -sgn * 2.5; A.v *= 0.985;
      if (pl) { if (Math.random() < 0.3) this.sound.sfx("scrape", { pan: sgn * 0.7 }); this.fx.sparks(at, 4); if (esc) this.damage = Math.min(100, this.damage + 0.3); }
      return;
    }
    if (ds > 0 || t.block) {
      const impact = A.v - B.v;
      const smash = !t.block && (A.shock > 0 || (A.boosting && impact > 4) || A.params.mass > B.params.mass * 1.6);
      if (smash) {
        T.hit(t, Math.random() < 0.5 ? -1 : 1, -sgn * 5, true); B.v = Math.max(B.v, A.v * 0.7); A.v -= impact * 0.1;
        if (pl) {
          this.smashes++; this.score += 100;
          this.o.onEvent({ type: "toast", text: "SMASH! +100", tone: "gold" });
          this.sound.sfx("crash", { gain: 0.6 }); this.fx.sparks(at, 22); this.rig.kick(0.35);
        }
      } else if (impact > 12 || (t.block && impact > 5)) {
        T.hit(t, sgn, -sgn * 2, false); B.v += impact * 0.25; A.v = Math.max(0, B.v - 4); this.shiftS(A, -(oS + 0.1));
        if (pl) this.playerCrash(t.block ? "ROADBLOCK!" : "CRASH!", impact, at);
        else if (!r.cop) { r.tumble = sgn; A.wreckOut(1.0); }
        else A.v *= 0.5;
      } else {
        A.v = Math.max(0, B.v - 1); if (!t.block) B.v += Math.max(0, impact) * 0.4; this.shiftS(A, -(oS + 0.05));
        if (pl) { this.sound.sfx("hit", { gain: 0.45 }); this.rig.kick(0.15); if (esc) this.damage = Math.min(100, this.damage + Math.max(0, impact) * 0.6); }
      }
    } else if (!t.block) {
      // it caught us up (we're slow): it brakes behind us
      B.v = Math.max(0, A.v - 2); B.s = this.track.wrap(B.s - (oS + 0.05));
    }
  }

  private playerCrash(text: string, impact: number, at: THREE.Vector3) {
    const P = this.player, c = P.car;
    P.tumble = Math.random() < 0.5 ? -1 : 1; c.wreckOut(1.1);
    this.rig.kick(0.6); this.sound.sfx("crash"); this.fx.sparks(at, 24);
    this.combo = 0; this.comboT = 0;
    // Heat Run: crashes cost lives; Escape: they dent the car
    if (this.cfg.mode === "escape") this.damage = Math.min(100, this.damage + 12 + impact * 0.5);
    if (this.lives != null) {
      this.lives--; c.ghost = 2.6;
      this.o.onEvent({ type: "toast", text: this.lives > 0 ? `${text} ${this.lives} ♥ left` : "OUT OF LIVES!", tone: "red", big: this.lives <= 0 });
      if (this.lives <= 0) this.endRace();
    } else this.o.onEvent({ type: "toast", text, tone: "red" });
  }

  /** passing traffic close at speed: near miss, and quick ones in a row build a combo */
  private trafficNearMiss() {
    const pc = this.player.car, tr = this.track;
    for (const t of this.traffic!.cars) {
      if (!t.active) continue;
      const B = t.car, ds = tr.delta(pc.s, B.s);
      const lenSum = pc.params.halfLength + B.params.halfLength;
      const clear = Math.abs(B.d - pc.d) - pc.params.halfWidth - B.params.halfWidth;
      if (Math.abs(ds) < lenSum + 1) t.nmMin = Math.min(t.nmMin, clear);
      if (t.nmPrev > 0 && ds <= 0 && ds > -15) {
        if (t.nmMin < 1.1 && !t.nmHit && pc.v > 20 && pc.v - B.v > 4 && pc.ghost <= 0 && this.phase === "racing") {
          this.combo = this.comboT > 0 ? Math.min(10, this.combo + 1) : 1; this.comboT = 3.2;
          const pts = 100 * this.combo;
          this.score += pts; this.nearMisses++; pc.nitro = Math.min(1, pc.nitro + 0.07);
          this.o.onEvent({ type: "toast", text: this.combo > 1 ? `NEAR MISS ×${this.combo} +${pts}` : `NEAR MISS +${pts}`, tone: this.combo >= 4 ? "pink" : "blue" });
          this.sound.sfx("whoosh", { rate: 1.1 + this.combo * 0.04, pan: clamp((B.d - pc.d) / 2, -1, 1) });
        }
        t.nmMin = 99; t.nmHit = false;
      }
      if (Math.abs(ds) > lenSum + 10) { t.nmMin = 99; t.nmHit = false; }
      t.nmPrev = ds;
    }
  }

  private activateCop(r: Racer, behind: number) {
    const P = this.player.car, c = r.car, L = this.track.length;
    const lanes = this.traffic?.lanes ?? [-this.track.halfWidth * 0.4, this.track.halfWidth * 0.4];
    c.respawn(lanes[Math.floor(Math.random() * lanes.length)], Math.max(14, P.v), 1.0);
    const raw = P.s - behind;
    c.s = this.track.wrap(raw); c.lap = P.lap - (raw < 0 ? 1 : 0); c.progress = c.lap * L + c.s; c.nitro = 0.7;
    r.out = false; r.outT = 0; r.finished = false; r.model.group.visible = true;
  }

  private pursuit(dt: number) {
    const P = this.player, pc = P.car, tr = this.track, mode = this.cfg.mode;
    // heat rises with time (Escape starts hot)
    const want = Math.min(5, mode === "escape" ? 2 + Math.floor(this.raceT / 30) : 1 + Math.floor(this.raceT / 20));
    if (want > this.heat) {
      this.heat = want;
      this.o.onEvent({ type: "toast", text: `🚨 HEAT LEVEL ${want}!`, tone: "red" });
      this.sound.sfx("siren", { gain: 0.7 });
    }
    const wanted = this.heat >= 5 ? 3 : this.heat >= 3 ? 2 : this.heat >= 2 ? 1 : 0;
    let active = 0, nearest = 999, nearPan = 0, near = false;
    for (const r of this.cops) {
      if (r.out) continue;
      const g = tr.delta(r.car.s, pc.s); // >0: you're ahead of this cop
      if (g > 330 || g < -220) { r.out = true; r.model.group.visible = false; continue; }
      active++;
      const dist = Math.hypot(g, r.car.d - pc.d);
      if (dist < nearest) { nearest = dist; nearPan = clamp((r.car.d - pc.d) / 6, -1, 1); }
      if (Math.abs(g) < 7.5 && Math.abs(r.car.d - pc.d) < 3.8 && r.car.wreck <= 0) near = true;
    }
    this.copT -= dt;
    if (active < wanted && this.copT <= 0 && this.raceT > 2.5) {
      const r = this.cops.find((x) => x.out);
      if (r) {
        this.activateCop(r, 75 + Math.random() * 45); this.copT = 5;
        if (!this.copsShown) { this.copsShown = true; this.o.onEvent({ type: "toast", text: "🚔 COPS ON YOUR TAIL!", tone: "red", big: true }); }
      }
    }
    // roadblocks from heat 3
    if (this.traffic && this.heat >= 3) {
      this.nextBlock -= dt;
      if (this.nextBlock <= 0 && this.traffic.roadblock(pc.s, 340, Math.floor(Math.random() * this.traffic.lanes.length))) {
        this.nextBlock = 30 - this.heat * 3;
        this.o.onEvent({ type: "toast", text: "⚠️ ROADBLOCK AHEAD!", tone: "gold" });
      }
    }
    // busted: a cop right beside you while you're crawling
    if (near && pc.v < 15 && this.phase === "racing") this.bust = Math.min(1, this.bust + dt / 2.4);
    else this.bust = Math.max(0, this.bust - dt / 1.4);
    // siren: louder as the nearest cop closes in
    this.sirenT -= dt;
    if (nearest < 170 && this.sirenT <= 0) { this.sirenT = 1.3; this.sound.sfx("siren", { gain: 0.15 + 0.45 * (1 - nearest / 170), pan: nearPan }); }
    if (this.bust >= 1 || this.damage >= 100) {
      this.busted = true;
      this.o.onEvent({ type: "toast", text: this.damage >= 100 ? "WRECKED!" : "BUSTED!", tone: "red", big: true });
      this.sound.sfx("siren", { gain: 0.8 });
      this.endRace(true);
    }
  }

  private bustSuspect(r: Racer) {
    if (r.out) return;
    r.out = true; r.outOrder = ++this.outCount; r.outT = 2.2; r.car.wreckOut(2.2);
    this.o.onEvent({ type: "toast", text: `🚓 ${r.name.toUpperCase()} BUSTED!`, tone: "green", big: true });
    this.sound.sfx("siren", { gain: 0.7 }); this.rig.kick(0.5); this.slowmo = 0.8;
    this.fx.ring(r.model.group.position, 0x2a6bff, 12, 0.6);
    if (this.racers.every((x) => x.isPlayer || x.cop || x.out)) this.endRace();
  }

  // ---------------------------------------------------------------- wheelies (Moto Rush GP)
  private wheelieOn = false; private wheelieRun = 0;
  private wheelieScoring(dt: number) {
    if (this.phase !== "racing") return;
    const c = this.player.car, up = c.wheelie > 0.55;
    if (up) {
      // longer wheelies score faster: ×2 after 1.5 s, ×3 after 3 s, ×4 after 4.5 s
      const mult = Math.min(4, 1 + Math.floor(c.wheelieT / 1.5));
      if (mult > this.combo && this.combo > 0) { this.o.onEvent({ type: "toast", text: `WHEELIE ×${mult}!`, tone: mult >= 3 ? "pink" : "gold" }); this.sound.sfx("blowoff", { gain: 0.45, rate: 1.2 }); }
      this.combo = mult; this.comboT = 0.6;
      const pts = dt * Math.max(0, c.v) * 3.6 * 0.6 * mult;
      this.score += pts; this.wheelieRun += pts;
    } else if (this.wheelieOn) {
      const v = Math.round(this.wheelieRun);
      if (v >= 40) { this.o.onEvent({ type: "toast", text: `+${v.toLocaleString("en-US")} WHEELIE`, tone: v > 600 ? "pink" : "gold", big: v > 1200 }); this.sound.sfx("checkpoint", { gain: 0.55 }); }
      this.wheelieRun = 0; this.combo = 0;
    }
    this.wheelieOn = up;
  }

  // ---------------------------------------------------------------- drift scoring (Drift Kings)
  private driftScoring(dt: number) {
    if (this.phase !== "racing") return;
    const P = this.player, tr = this.track, battle = this.cfg.mode === "battle", boss = this.boss;
    // TANDEM: sliding close behind the rival while the rival slides too
    let bonus = 1;
    if (battle && boss && !P.finished) {
      const gap = tr.delta(P.car.s, boss.car.s);
      const on = P.car.drifting && boss.car.drifting && gap > 2.5 && gap < 16 && Math.abs(boss.car.d - P.car.d) < 6;
      if (on && !this.tandemOn && this.t - this.tandemShownT > 3) {
        this.tandemShownT = this.t;
        this.o.onEvent({ type: "toast", text: "TANDEM! ×1.5", tone: "pink" });
        this.sound.sfx("nearMiss");
      }
      this.tandemOn = on;
      if (on) bonus = 1.5;
    } else this.tandemOn = false;
    for (const r of this.racers) {
      if (r.out || r.finished) continue;
      const scored = r.isPlayer || (battle && r === boss);
      if (!scored) continue;
      // the battle rival's flair scales with difficulty
      const ev = r.drift.update(dt, r.car, r.isPlayer ? bonus : 0.95 + this.diff * 0.85);
      if (!r.isPlayer || !ev) continue;
      const d = r.drift;
      if (ev === "mult") { this.o.onEvent({ type: "toast", text: `×${d.mult} DRIFT`, tone: d.mult >= 4 ? "pink" : "gold" }); this.sound.sfx("blowoff", { gain: 0.5, rate: 0.9 + d.mult * 0.06 }); }
      else if (ev === "linked") {
        // a quiet whoosh every link; a toast only now and then so the screen stays readable
        this.sound.sfx("whoosh", { rate: 1.3, gain: 0.5 });
        if (d.links === 1 || d.links % 4 === 0) this.o.onEvent({ type: "toast", text: d.links === 1 ? "LINKED!" : `${d.links} LINKS!`, tone: "blue" });
      }
      else if (ev === "banked") {
        const v = d.last, big = v >= 3500;
        this.o.onEvent({ type: "toast", text: `+${v.toLocaleString("en-US")} ${driftWord(v)}`, tone: big ? "pink" : "gold", big });
        this.sound.sfx("checkpoint", { gain: 0.7 }); if (big) this.sound.sfx("crowd", { gain: 0.6 });
        P.car.nitro = Math.min(1, P.car.nitro + Math.min(0.25, v / 12000));
        if (v >= 1800) this.fx.ring(P.model.group.position, big ? 0xff7cf0 : 0xffd25a, big ? 12 : 8, 0.5);
      } else if (ev === "lost") this.chainLost(d.last);
    }
  }
  private chainLost(v: number) {
    if (v < 150) return;
    this.o.onEvent({ type: "toast", text: `CHAIN BROKEN −${v.toLocaleString("en-US")}`, tone: "red" });
    this.sound.sfx("crunch", { gain: 0.6 });
  }
  /** rally co-driver: the next pace note, with a chime when a new bend is called */
  private coDriver(dt: number) {
    this.callT -= dt;
    if (this.callT > 0 || this.phase !== "racing") return;
    this.callT = 0.15;
    const c = this.player.car;
    const n = nextCall(this.track, c.s, 16, 80 + Math.max(0, c.v) * 2.4);
    this.call = n;
    if (n && Math.abs(this.track.delta(this.callKey, n.at)) > 20) { this.callKey = n.at; this.sound.sfx("beep", { gain: 0.35, rate: n.caution ? 0.85 : 1.25 }); }
  }

  // ---------------------------------------------------------------- ghost (time trial)
  private ghostKey() { return `nitro-ghost:${this.cfg.themeId}:${this.cfg.variant}:${this.cfg.reverse ? "r" : "f"}`; }
  private setupGhost() {
    try {
      const raw = localStorage.getItem(this.ghostKey());
      if (raw) { const g = JSON.parse(raw) as { lap: number; d: number[] }; if (g.lap > 0 && g.d.length >= 8) this.ghostBest = { data: new Float32Array(g.d), n: g.d.length / 4, lap: g.lap }; }
    } catch { /* no ghost */ }
    const model = buildCarModel(this.player.spec, "#7CF2FF");
    const mats: THREE.Material[] = [];
    model.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const cl = src.map((x) => { const c = x.clone(); c.transparent = true; c.opacity = 0.32; c.depthWrite = false; mats.push(c); return c; });
      m.material = Array.isArray(m.material) ? cl : cl[0];
      m.castShadow = false;
    });
    model.group.visible = false;
    this.scene.add(model.group);
    this.ghost = { model, mats };
  }
  private recordGhost() {
    const P = this.player, c = P.car, lt = this.raceT - P.lapStart;
    while (this.recN * GHOST_DT <= lt && this.recN < this.rec.length / 4) {
      const o = this.recN * 4;
      this.rec[o] = c.progress - P.lapsDone * this.track.length; this.rec[o + 1] = c.d; this.rec[o + 2] = c.yaw; this.rec[o + 3] = c.y;
      this.recN++;
    }
  }
  private saveGhost(lt: number) {
    const n = this.recN; this.recN = 0;
    if (n < 8 || (this.ghostBest && lt >= this.ghostBest.lap)) return;
    this.ghostBest = { data: this.rec.slice(0, n * 4), n, lap: lt };
    try { localStorage.setItem(this.ghostKey(), JSON.stringify({ lap: lt, d: Array.from(this.ghostBest.data, (x) => Math.round(x * 100) / 100) })); } catch { /* storage full */ }
  }
  /** ghost sample at lap time t → writes s/d/yaw/y into out */
  private ghostAt(t: number, out: { x: number; d: number; yaw: number; y: number }) {
    const g = this.ghostBest!; const f = Math.min(g.n - 1.001, Math.max(0, t / GHOST_DT)), i = Math.floor(f), u = f - i, a = i * 4, b = (i + 1) * 4, D = g.data;
    out.x = D[a] + (D[b] - D[a]) * u; out.d = D[a + 1] + (D[b + 1] - D[a + 1]) * u; out.yaw = D[a + 2] + (D[b + 2] - D[a + 2]) * u; out.y = D[a + 3] + (D[b + 3] - D[a + 3]) * u;
    return out;
  }
  private gs = { x: 0, d: 0, yaw: 0, y: 0 };
  /** seconds behind (+) / ahead (−) of the ghost at the player's current point of the lap */
  private ghostDelta(): number | null {
    const g = this.ghostBest, P = this.player;
    if (!g || this.phase !== "racing") return null;
    const x = P.car.progress - P.lapsDone * this.track.length, D = g.data;
    let lo = 0, hi = g.n - 1;
    if (x <= D[0] || x >= D[hi * 4]) return null;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m * 4] < x) lo = m; else hi = m; }
    const u = (x - D[lo * 4]) / Math.max(1e-3, D[hi * 4] - D[lo * 4]);
    return (this.raceT - P.lapStart) - (lo + u) * GHOST_DT;
  }

  // ---------------------------------------------------------------- effects
  private effects(dt: number) {
    const tr = this.track, T = this.tmp, pc = this.player.car;
    void dt;
    for (const r of this.racers) {
      const c = r.car;
      if (r.out) { if (r.outT > 0) this.fx.burn(r.model.group.position, 1); continue; }
      const dist = Math.abs(tr.delta(pc.s, c.s));
      if (dist > (r.isPlayer ? 0 : 90)) continue;
      const hl = c.params.halfLength, hwid = c.params.halfWidth - 0.15;
      const sliding = c.drifting || c.slip > 0.35 || (c.input.brake > 0.5 && c.v > 25) || c.spin > 0;
      if (sliding && !c.air && !c.offroad) {
        const rs = c.s - hl * 0.62, yawOff = Math.sin(c.yaw) * hl * 0.62;
        tr.right(rs, T.r);
        for (let w = 0; w < 2; w++) {
          const wd = c.d - yawOff + (w ? hwid : -hwid);
          tr.point(rs, wd, T.w);
          this.skids.mark(r.idx * 2 + w, T.w, T.r, 0.24, c.drifting || c.spin > 0 ? 0.5 : 0.32, this.t);
          T.w.y += 0.25;
          this.fx.smoke(T.w, r.isPlayer ? 0.85 : 0.4, 1.2);
        }
      }
      if (c.offroad && c.v > 8 && !c.air) this.fx.dust(this.worldAt(c.s - hl * 0.8, c.d, 0.2, T.w), (this.theme.look as { shoulder?: string }).shoulder ?? "#9a8a70");
      if (this.rain && c.v > 15 && !c.air && dist < 60) {
        tr.tangent(c.s, T.b).multiplyScalar(-1);
        this.fx.spray(this.worldAt(c.s - hl * 0.7, c.d + (Math.random() < 0.5 ? -hwid : hwid), 0.2, T.w), T.b, c.v);
      }
      if (c.boosting || c.turbo > 0) {
        const g = r.model.group;
        T.b.set(0, 0, -1).applyQuaternion(g.quaternion);
        for (let e = 0; e < r.model.exhausts.length; e++) {
          T.w.copy(r.model.exhausts[e]).applyQuaternion(g.quaternion).add(g.position);
          if (c.boosting) this.fx.exhaust(T.w, T.b, c.shock > 0);
          else if (Math.random() < 0.5) this.fx.exhaust(T.w, T.b, c.turboLvl >= 3);
        }
      }
      if (c.wreck > 0) this.fx.burn(r.model.group.position, 0.8);
    }
  }

  private rivalAudio() {
    const pc = this.player.car, tr = this.track, objs = this.rivalObjs;
    let n = 0;
    for (const o of objs) o.d2 = 1e9;
    for (const r of this.racers) {
      if (r.isPlayer || r.out) continue;
      const ds = tr.delta(pc.s, r.car.s), a = Math.abs(ds);
      if (a > 70) continue;
      // insert into the 3 nearest
      let slot = -1;
      for (let i = 0; i < 3; i++) if (a < objs[i].d2 && (slot < 0 || objs[i].d2 > objs[slot].d2)) slot = i;
      if (slot < 0) continue;
      const o = objs[slot];
      o.d2 = a; o.rpm = r.car.rpm; o.throttle = r.car.input.gas; o.gear = r.car.gear; o.dist = ds; o.side = (r.car.d - pc.d) / 6; o.closing = (ds > 0 ? -1 : 1) * (r.car.v - pc.v); o.voice = r.spec.engine;
    }
    const list = this.rivalList; list.length = 0;
    for (const o of objs) if (o.d2 < 1e9) { list.push(o); n++; }
    list.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
    if (n >= 0) this.sound.rivalsUpdate(list);
  }

  // ---------------------------------------------------------------- transforms & camera
  private worldAt(s: number, d: number, y: number, out = V()) { this.track.point(s, d, out); out.y += y; return out; }

  private placeAll(dt: number) {
    const tr = this.track, T = this.tmp;
    for (const r of this.racers) {
      const c = r.car, g = r.model.group;
      if (r.out) {
        // knocked out: burn briefly, then vanish
        if (r.outT > 0) { r.outT -= dt; g.position.y -= dt * 0.4; if (r.outT <= 0) g.visible = false; }
        continue;
      }
      this.placeCar(g, c.s, c.d, c.y, c.yaw);
      if (r.model.pose) {
        // bikes: lean into the bend (centripetal angle + steering), rider hangs off, wheelies pitch the chassis
        const leanT = c.wreck > 0 ? r.tumble * 1.35 : clamp(Math.atan2(c.v * c.v * tr.kappa(c.s) + c.vd * Math.max(4, c.v) * 0.35, 9.8), -0.95, 0.95);
        r.roll += (leanT - r.roll) * Math.min(1, dt * (c.wreck > 0 ? 8 : 5));
        g.rotateZ(r.roll);
        r.model.pose(c.wreck > 0 ? 0 : c.wheelie * 0.55, c.wreck > 0 ? 0 : r.roll / 0.95);
        if (c.wreck > 0) g.position.y += 0.08;
      } else {
      // body roll / pitch for weight transfer
      const rollT = clamp(-c.vd * 0.012 + (c.drifting ? -c.driftDir * 0.05 : 0), -0.09, 0.09);
      const pitchT = clamp((c.input.brake && !c.drifting ? 0.03 : 0) - (c.boosting ? 0.03 : 0) + (c.air ? -0.08 : 0), -0.1, 0.1);
      r.roll += (rollT - r.roll) * Math.min(1, dt * 6); r.pitch += (pitchT - r.pitch) * Math.min(1, dt * 6);
      g.rotateZ(r.roll); g.rotateX(r.pitch);
      }
      // wreck: hop and barrel-roll (cars)
      if (c.wreck > 0 && !r.model.pose) {
        const u = clamp(1 - c.wreck / c.wreckT0, 0, 1), hop = Math.sin(Math.min(1, u * 1.6) * Math.PI);
        g.position.y += hop * 1.3;
        g.rotateZ(r.tumble * Math.min(1, u * 1.6) * Math.PI * 2);
        g.rotateY(Math.sin(this.t * 7) * 0.1 * (1 - u));
      }
      // wheels
      r.wheelRot += (c.v * dt) / r.model.wheelRadius;
      for (let i = 0; i < 4; i++) { const w = r.model.wheels[i]; w.spin.rotation.x = r.wheelRot; if (i < 2) w.steer.rotation.y = -c.input.steer * 0.42; }
      r.model.setBrake((c.input.brake > 0.1 && !c.drifting) || c.v < 0);
      r.model.setNitro(c.boosting, this.t);
      // invulnerable after a respawn / lost life: blink
      g.visible = c.ghost > 0 ? Math.floor(this.t * 12) % 2 === 0 : true;
    }
    // highway traffic and the police light bars
    if (this.traffic) {
      for (const list of [this.traffic.cars, this.traffic.blocks]) for (const t of list) {
        if (!t.active) continue;
        const c = t.car;
        this.placeCar(t.model.group, c.s, c.d, 0, c.yaw + t.spinYaw);
        for (let i = 0; i < 4; i++) t.model.wheels[i].spin.rotation.x = t.wheelRot;
        t.model.setBrake(c.v < t.cruise - 2 || t.block);
      }
    }
    if (this.lights.length) {
      const ph = Math.floor(this.t * 7) % 2;
      for (const L of this.lights) {
        const on = L.live() && L.g.visible;
        L.r.visible = on && ph === 0; L.b.visible = on && ph === 1;
        if (on) { const p = L.g.position; L.r.position.set(p.x, p.y + L.h + 0.25, p.z); L.b.position.copy(L.r.position); }
      }
    }
    // boss crown & knock-out marker
    if (this.crown && this.boss) { const b = this.boss.model.group; this.crown.position.copy(b.position); this.crown.position.y += this.boss.model.dims.height + 1.3 + Math.sin(this.t * 3) * 0.12; this.crown.visible = !this.boss.out; }
    if (this.danger) {
      const lp = this.lastPlace, show = !!lp && !lp.out && this.phase === "racing" && this.elimT < 8;
      this.danger.visible = show;
      if (show) { const p = lp!.model.group.position; this.danger.position.set(p.x, p.y + lp!.model.dims.height + 1.4, p.z); const k = 1.3 + Math.sin(this.t * 10) * 0.25; this.danger.scale.set(k, k, 1); }
    }
    // time-trial ghost
    if (this.ghost) {
      const show = !!this.ghostBest && this.phase === "racing" && !this.player.finished;
      this.ghost.model.group.visible = show;
      if (show) { const s = this.ghostAt(this.raceT - this.player.lapStart, this.gs); this.placeCar(this.ghost.model.group, s.x, s.d, s.y, s.yaw); }
    }
    void T;
  }
  private placeCar(g: THREE.Object3D, s: number, d: number, y: number, yaw: number) {
    const tr = this.track, T = this.tmp;
    tr.point(s, d, T.p); T.p.y += y;
    tr.tangent(s, T.f); tr.right(s, T.r);
    T.z.copy(T.f).multiplyScalar(Math.cos(yaw)).addScaledVector(T.r, Math.sin(yaw)).normalize();
    const bank = tr.bankAt(s);
    T.y.copy(UP).addScaledVector(T.r, -bank).normalize();
    T.x.crossVectors(T.y, T.z).normalize(); T.y.crossVectors(T.z, T.x).normalize();
    T.m.makeBasis(T.x, T.y, T.z);
    g.position.copy(T.p);
    g.quaternion.setFromRotationMatrix(T.m);
  }

  private cameraStep(dt: number) {
    const P = this.player, c = P.car, ct = this.camT;
    const phase = this.phase === "intro" || this.phase === "loading" ? "intro" : this.phase === "finished" ? "finish" : "race";
    const pt = phase === "intro" ? this.introT : phase === "finish" ? this.finishT : 0;
    ct.s = c.s; ct.d = c.d; ct.v = c.v; ct.vmax = c.params.vmax; ct.boosting = c.boosting; ct.drifting = c.drifting; ct.driftDir = c.driftDir; ct.steer = c.input.steer; ct.air = c.air;
    this.rig.update(dt, ct, this.track, phase, pt, this.heightAt);
  }
  private heightAt = (x: number, z: number) => this.world.heightAt(x, z);

  private resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const scale = (h * this.pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(66) / 2));
    this.fx?.setScale(scale);
    this.items?.setGlowScale(scale);
  }

  // ---------------------------------------------------------------- HUD
  private hud(): HudFrame {
    const P = this.player, c = P.car, st = this.standings();
    const pos = st.find((x) => x.isPlayer)!.pos;
    const laps = this.lapsTarget();
    let nextGate: number | null = null;
    if (this.timed && this.items.gates.length) nextGate = Math.max(0, Math.round(this.gateLap * this.track.length + this.items.gates[this.gateIdx] - c.progress));
    let boss: HudFrame["boss"] = null;
    if (this.boss) boss = { name: this.boss.name, gap: (c.progress - this.boss.car.progress) / Math.max(20, c.v) };
    return {
      phase: this.phase, countdown: this.countdown,
      speed: Math.round(Math.abs(c.v) * 3.6), gear: c.v < -0.5 ? 0 : c.gear, rpm: c.rpm, nitro: c.nitro, boosting: c.boosting,
      lap: Math.max(1, Math.min(this.cfg.laps, c.lap + 1)), laps: laps || 0, pos, racers: st.filter((x) => !x.out).length,
      time: this.raceT * 1000, lapTime: (this.raceT - P.lapStart) * 1000, bestLap: P.bestLap * 1000,
      coins: this.coins, lives: this.lives, timeLeft: this.timeLeft, drift: c.drifting ? Math.round(c.driftTime * 100) : 0,
      shield: c.shield, magnet: c.magnet, wrongWay: c.v < -3, standings: st,
      nitroFull: c.nitro >= 0.95 && c.shock <= 0, perfectNitro: c.shock > 0, draft: c.draft, driftLevel: c.drifting ? c.driftLevel : 0,
      targets: this.targets.length ? this.targets : undefined, ghostDelta: this.tt ? this.ghostDelta() : undefined,
      nextGate, gateBonus: this.gateBonus || undefined, danger: this.cfg.mode === "elimination" ? this.lastPlace === P : undefined,
      boss, ghost: c.ghost, nearMisses: this.nearMisses,
      ...(this.style === "drift" ? {
        driftChain: Math.round(P.drift.chain), driftMult: P.drift.mult, driftPoints: P.drift.total, tandem: this.tandemOn,
        rival: this.cfg.mode === "battle" && this.boss ? { name: this.boss.name, points: this.boss.drift.live } : null,
      } : {}),
      call: this.cfg.mode === "rally" && this.phase === "racing" && !P.finished ? this.call : null,
      ...(this.cfg.mode === "wheelie" ? { score: Math.round(this.score), combo: this.combo } : {}),
      wheelie: this.style === "bike" ? c.wheelie : undefined,
      ...(this.traffic || this.chase || this.cfg.mode === "takedown" ? {
        score: Math.round(this.dist) + this.score, combo: this.comboT > 0 ? this.combo : 0, heat: this.chase ? this.heat : undefined,
        bust: this.chase ? this.bust : undefined, damage: this.chase ? this.damage : undefined,
        suspects: this.cfg.mode === "takedown" ? this.racers.filter((r) => !r.isPlayer && !r.cop).map((r) => ({ name: r.name, hp: Math.round(r.hp), out: r.out })) : undefined,
      } : {}),
    };
  }
  /** normalised minimap data */
  minimap() { return { outline: this.track.outline(140), cars: this.mapDots() }; }
  /** minimap dots — reuses its array/objects (read them immediately) */
  mapDots() {
    const out = this.dots; out.length = 0;
    for (const r of this.racers) {
      if (r.out) continue;
      let o = (r as Racer & { dot?: { xy: [number, number]; player: boolean; color: string } }).dot;
      if (!o) { o = { xy: [0, 0], player: r.isPlayer, color: r.color }; (r as Racer & { dot?: typeof o }).dot = o; }
      this.track.mapXYInto(r.car.s, r.car.d, o.xy);
      out.push(o);
    }
    return out;
  }

  // ---------------------------------------------------------------- lifecycle
  pause() { if (this.paused) return; this.paused = true; this.keys.clear(); this.sound?.silence(); void audio.suspend(); }
  resume() { if (!this.paused) return; this.paused = false; this.last = performance.now(); void audio.resume(); }
  /** quit mid-race (counts as not completed) */
  abandon() { this.destroy(); }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.ro?.disconnect();
    this.sound?.dispose();
    audio.stopMusic(0.4);
    for (const r of this.racers) r.model.dispose();
    if (this.ghost) { this.ghost.model.dispose(); for (const m of this.ghost.mats) m.dispose(); }
    for (const s of [this.crown, this.danger]) if (s) { s.material.map?.dispose(); s.material.dispose(); }
    this.items?.dispose();
    this.fx?.dispose();
    this.skids?.dispose();
    this.world?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

// dev/QA: expose the class so headless scripts can start any mode without clicking through the menus
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __RaceSession?: typeof RaceSession }).__RaceSession = RaceSession;
