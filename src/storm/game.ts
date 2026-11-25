// Blockstorm: the game itself. A third-person blaster fight on a blocky island: you (Rook, a pixel ranger) run, jump
// and shoot; every block can be chipped and broken, and whatever loses its hold on the ground topples and smashes onto
// whoever is below. Monsters pour out of gloom rifts and totems — hopping cubelings, digging grumblers, diving
// batbits, spitting spitters, fusebugs that blow up, wall-smashing brutes — and every ten stages a giant golem boss.
// Friends (an archer, a knight, a brawler) can be called in or freed from cages. Coins, gems, oil cans (your blaster
// runs on oil), hearts, health packs and ? boxes of power.
//
// Flow, with no menus between stages: a cinematic fly-over of the new island → play → the goal is met → slow-motion
// kill cam → a victory orbit → the camera rises into the sky → the next island → "Stage N started!" → play, forever.
// Coming back later starts the stage you were on.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import { autoQuality, isPhone } from "@/lib/perf";
import { B, BLOCKS } from "./blocks";
import { buildArena, type Arena, type Cage, type PickupKind } from "./gen";
import { POWERS, POWER_IDS, statsFor, type Levels, type PowerId, type Stats } from "./gear";
import { HERO_SKINS, newPose, poseBat, poseBug, poseCube, poseHuman, RigBatch, RIGS, type Pose, type RigKind } from "./rigs";
import { Ambience, ear, sfx, sfxAt, type StormSfx } from "./sound";
import { stagePlan, MOD_LABEL, type EnemyKind, type StagePlan } from "./stages";
import { View } from "./render";
import { STAGES_PER_WORLD, WORLDS, type World } from "./worlds";
import { angleTo, clamp, damp, lerp, makeRng, mix, rgb, smooth, type Rng } from "./util";
import type { RayHit } from "./voxels";

export type Mode = "attract" | "intro" | "play" | "clear" | "down" | "travel";
export interface Hud {
  stage: number; title: string; subtitle: string; world: string; accent: string; remix: boolean; mods: string[];
  goal: StagePlan["goal"]; goalText: string; progress: number;
  hp: number; maxHp: number; oil: number; lowOil: boolean; coins: number; lives: number;
  powers: { id: PowerId; left: number; secs: number }[];
  boss: { name: string; hp: number } | null; beacon: number | null; holdLeft: number | null;
  mode: Mode; allies: number; finale: boolean;
}
export interface StageStats { stage: number; kills: number; blocks: number; coins: number; time: number; stars: number; bonus: number; boss: boolean; worldDone: boolean }
export type GameEvent =
  | { k: "intro"; plan: StagePlan; next: boolean }
  | { k: "go" }
  | { k: "clear"; stats: StageStats }
  | { k: "lifeLost"; livesLeft: number }
  | { k: "outOfLives" }
  | { k: "beaconLost" }
  | { k: "pickup"; what: PickupKind }
  | { k: "power"; id: PowerId }
  | { k: "boss"; name: string }
  | { k: "totem"; left: number }
  | { k: "freed"; ally: string }
  | { k: "streak"; n: number }
  | { k: "collapse"; n: number }
  | { k: "lowOil" }
  | { k: "hint"; text: string };

interface Opts {
  levels: Levels; skin: string; lives: number; coins: number; autoFire: boolean; sens: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void; onCoins: (n: number) => void; onLives: (n: number) => void;
}

interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; h: number; onGround: boolean; yaw: number; bx: boolean; bz: boolean }
type Kind = EnemyKind | "golem";
interface Enemy extends Body {
  kind: Kind; rig: RigKind; hp: number; maxHp: number; speed: number; dmg: number; reach: number; coins: number; dig: number; scale: number;
  alive: boolean; pose: Pose; walk: number; walkAmt: number; atk: number; atkCd: number; flash: number; t: number; rise: number;
  fuse: number; hopCd: number; dive: number; stuck: number; digCd: number; color: [number, number, number];
  tx: number; ty: number; tz: number; retarget: number; hitT: number; throwCd: number; summonCd: number; enraged: boolean; idle: boolean; beacon: boolean;
}
interface Ally extends Body { kind: "archer" | "knight" | "brawler"; hp: number; maxHp: number; life: number; pose: Pose; walk: number; walkAmt: number; atk: number; atkCd: number; flash: number; cage: Cage | null; cheer: number }
interface Shot { x: number; y: number; z: number; vx: number; vy: number; vz: number; kind: "glob" | "arrow" | "rocket" | "boulder"; friendly: boolean; dmg: number; r: number; life: number; grav: number }
interface Drop { kind: PickupKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; alive: boolean; settled: boolean; life: number }

const ENEMY: Record<Kind, { rig: RigKind; hp: number; speed: number; dmg: number; reach: number; coins: number; dig: number; base: string }> = {
  cubeling: { rig: "cubeling", hp: 22, speed: 3.3, dmg: 4.5, reach: 0.9, coins: 1, dig: 0, base: "#8E5CFF" },
  grumbler: { rig: "grumbler", hp: 44, speed: 2.4, dmg: 7.5, reach: 1.25, coins: 2, dig: 1, base: "#6EB86A" },
  batbit: { rig: "batbit", hp: 16, speed: 4.6, dmg: 5, reach: 0.9, coins: 1, dig: 0, base: "#3A2A5A" },
  spitter: { rig: "spitter", hp: 34, speed: 2.3, dmg: 7, reach: 15, coins: 3, dig: 0, base: "#B8C85A" },
  fusebug: { rig: "fusebug", hp: 24, speed: 4.1, dmg: 22, reach: 2.1, coins: 2, dig: 1, base: "#4A4E66" },
  brute: { rig: "brute", hp: 190, speed: 1.9, dmg: 18, reach: 2.1, coins: 8, dig: 9, base: "#7E7A92" },
  golem: { rig: "golem", hp: 1300, speed: 1.6, dmg: 24, reach: 3.4, coins: 60, dig: 99, base: "#8C8F98" },
};
const ALLY = { archer: { hp: 90, speed: 4.6, dmg: 14, rate: 0.85, reach: 18 }, knight: { hp: 170, speed: 4.2, dmg: 24, rate: 0.75, reach: 1.7 }, brawler: { hp: 120, speed: 5.4, dmg: 10, rate: 0.32, reach: 1.4 } };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3();
const HIT: RayHit = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, id: 0 };

export class Game {
  readonly view: View;
  private host: HTMLElement;
  private o: Opts;
  private raf = 0; private last = 0; private running = false;
  // stage
  stage = 1; plan!: StagePlan; world!: World; arena!: Arena;
  mode: Mode = "attract";
  private modeT = 0;
  private grav = 26;
  private batches = new Map<RigKind, RigBatch>();
  private hero: RigBatch | null = null; private heroSkin = "";
  // the player
  readonly p: Body & { hp: number; maxHp: number; oil: number; maxOil: number; inv: number; walk: number; walkAmt: number; hurt: number; dead: boolean; stepY: number } = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.7, onGround: false, yaw: 0, bx: false, bz: false,
    hp: 100, maxHp: 100, oil: 100, maxOil: 100, inv: 0, walk: 0, walkAmt: 0, hurt: 0, dead: false, stepY: 0,
  };
  private heroPose = newPose("hero");
  stats: Stats;
  private levels: Levels;
  coins: number; lives: number;
  private autoFire: boolean; private sens: number;
  private touch = isPhone();
  // input
  private mv = { x: 0, y: 0 }; private keys = new Set<string>();
  private firing = false; private sprint = false; private wantJump = false;
  private fireCd = 0;
  camYaw = 0; camPitch = -0.12;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camDist = 4;
  private shake = 0; private timeScale = 1; private slowTarget = 1; private slowT = 0;
  // actors
  enemies: Enemy[] = [];
  allies: Ally[] = [];
  private shots: Shot[] = [];
  drops: Drop[] = [];
  private booms: { x: number; y: number; z: number; t: number; r: number; dmg: number; friendly: boolean }[] = [];
  powers = new Map<PowerId, number>();
  // goal
  private kills = 0; private spawned = 0; private spawnCd = 0; private blocksBroken = 0; private coinsAtStart = 0; private lostLife = false;
  private calm = 0;
  private stageTime = 0; private beaconHp = 100; private holdLeft = 0; private wreck = 0; private goalTick = 0;
  private boss: Enemy | null = null; private focus = new THREE.Vector3(); private streak = 0; private streakT = 0;
  private hudT = 0; private lowOilSaid = false; private won = false;
  private ambience = new Ambience();
  private rng: Rng = makeRng(1);
  private nextId = 1;
  // overlay (crosshair, markers)
  private ov: HTMLCanvasElement; private ovx: CanvasRenderingContext2D; private vignette: HTMLCanvasElement | null = null;
  private hitMark = 0; private killMark = 0; private dmgDir = 0; private dmgT = 0; private aimOn = false;
  private ro: ResizeObserver;

  constructor(host: HTMLElement, o: Opts, quality: Quality = autoQuality()) {
    this.host = host; this.o = o;
    this.levels = o.levels; this.stats = statsFor(o.levels);
    this.coins = o.coins; this.lives = Math.max(1, o.lives);
    this.autoFire = o.autoFire; this.sens = o.sens;
    this.view = new View(host, quality);
    this.ov = document.createElement("canvas");
    Object.assign(this.ov.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
    host.appendChild(this.ov);
    this.ovx = this.ov.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.view.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    (window as unknown as { __blockstorm?: Game }).__blockstorm = this;
  }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.view.resize(w, h);
    this.ov.width = w; this.ov.height = h;
    const portrait = h > w;
    this.view.camera.fov = portrait ? 76 : 62;
    this.view.camera.updateProjectionMatrix();
    // the red edges shown when you're hurt, drawn once per size
    const v = document.createElement("canvas"); v.width = w; v.height = h;
    const c = v.getContext("2d")!;
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(255,40,60,0)"); g.addColorStop(1, "rgba(255,40,60,0.75)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    this.vignette = v;
  }

  // ------------------------------------------------------------------ settings from the UI
  setLevels(l: Levels) { this.levels = l; const s = statsFor(l); const hp01 = this.p.hp / this.p.maxHp; this.stats = s; this.p.maxHp = s.hp; this.p.hp = Math.max(1, hp01 * s.hp); this.p.maxOil = s.oil; this.p.oil = Math.min(this.p.oil, s.oil); }
  setSkin(id: string) { if (id === this.heroSkin) return; this.heroSkin = id; this.hero?.dispose(); const sk = HERO_SKINS.find((x) => x.id === id) ?? HERO_SKINS[0]; this.hero = new RigBatch("hero", sk.look, "#000000", 1, 3); this.hero.addTo(this.view.scene); }
  setAutoFire(on: boolean) { this.autoFire = on; }
  setSens(v: number) { this.sens = v; }
  setMove(x: number, y: number) { this.mv.x = clamp(x, -1, 1); this.mv.y = clamp(y, -1, 1); }
  look(dx: number, dy: number, mouse = false) {
    if (this.mode !== "play" && this.mode !== "attract") return;
    const k = (mouse ? 0.0024 : 0.0058) * this.sens;
    this.camYaw -= dx * k;
    this.camPitch = clamp(this.camPitch - dy * k, -1.05, 0.8);
  }
  setFire(on: boolean) { this.firing = on; }
  setSprint(on: boolean) { this.sprint = on; }
  jump() { this.wantJump = true; }
  skipIntro() { if (this.mode === "intro" && this.modeT > 0.4) this.modeT = 99; }

  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(k)) { if (this.mode === "play") e.preventDefault(); }
    this.keys.add(k);
    if (k === " ") this.wantJump = true;
    if (k === "shift") this.sprint = true;
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); this.keys.delete(k); if (k === "shift") this.sprint = false; };
  private onBlur = () => { this.keys.clear(); this.firing = false; this.sprint = false; };
  private mouseHeld = false;
  private onMouseDown = (e: MouseEvent) => {
    if (this.touch || this.mode !== "play") return;
    this.mouseHeld = true;
    if (document.pointerLockElement !== this.view.renderer.domElement) { this.view.renderer.domElement.requestPointerLock?.(); }
    if (e.button === 0) this.firing = true;
  };
  private onMouseUp = (e: MouseEvent) => { this.mouseHeld = false; if (!this.touch && e.button === 0) this.firing = false; };
  private onMouseMove = (e: MouseEvent) => {
    if (this.touch) return;
    if (document.pointerLockElement === this.view.renderer.domElement) this.look(e.movementX, e.movementY, true);
    else if (this.mouseHeld) this.look(e.movementX * 1.6, e.movementY * 1.6, true);
  };
  get pointerLocked() { return typeof document !== "undefined" && document.pointerLockElement === this.view.renderer.domElement; }

  // ------------------------------------------------------------------ loop
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.firing = false; if (this.pointerLocked) document.exitPointerLock?.(); }

  // ------------------------------------------------------------------ stages
  load(n: number, mode: "attract" | "intro", next = false) {
    this.stage = n;
    this.plan = stagePlan(n);
    this.world = WORLDS.find((w) => w.id === this.plan.world)!;
    this.arena = buildArena(this.plan);
    this.view.setStage(this.plan, this.arena);
    if (this.view.fallers) this.view.fallers.onImpact = this.onImpact;
    this.grav = this.world.gravity * (this.plan.mods.includes("lowgrav") && this.world.id !== "moon" ? 0.55 : 1);
    this.rng = makeRng(this.plan.seed + 3);
    // characters for this stage: its monsters (tinted for the world), the friends, the hero
    for (const b of this.batches.values()) b.dispose();
    this.batches.clear();
    const tint = this.world.tint;
    const cap = Math.max(6, this.cap() + 4);
    const kinds = new Set<RigKind>(this.plan.enemies.map((e) => ENEMY[e.kind].rig));
    if (this.plan.goal === "boss") kinds.add("golem");
    for (const k of kinds) { const b = new RigBatch(k, HERO_SKINS[0].look, tint, k === "golem" ? 1 : cap, this.plan.seed); b.addTo(this.view.scene); this.batches.set(k, b); }
    const friends: [RigKind, string, string, string][] = [["archer", "#2FBF71", "#5E8C3A", "#3A2A1E"], ["knight", "#E8402E", "#9AA6B8", "#3A3F4E"], ["brawler", "#E8402E", "#FFB627", "#2B2B33"]];
    for (const [k, a, b, c] of friends) { const rb = new RigBatch(k, { a, b, c, skin: "#E8B48E", glow: "#FFE45C", dark: "#1B1B22" }, tint, 4, 11); rb.addTo(this.view.scene); this.batches.set(k, rb); }
    if (!this.hero) this.setSkin(this.o.skin);
    // reset
    this.enemies = []; this.allies = []; this.shots = []; this.booms = []; this.powers.clear();
    this.drops = this.arena.pickups.map((p) => ({ ...p, vx: 0, vy: 0, vz: 0, t: Math.random() * 6, alive: true, settled: true, life: Infinity }));
    this.kills = 0; this.spawned = 0; this.spawnCd = 2.2; this.blocksBroken = 0; this.coinsAtStart = this.coins; this.lostLife = false; this.won = false;
    this.stageTime = 0; this.beaconHp = 100; this.holdLeft = this.plan.goal === "hold" ? this.plan.goalCount : 0; this.wreck = 0; this.boss = null; this.streak = 0;
    this.lowOilSaid = false;
    const sp = this.arena.spawn;
    Object.assign(this.p, { x: sp.x, y: sp.y + 0.01, z: sp.z, vx: 0, vy: 0, vz: 0, hp: this.stats.hp, maxHp: this.stats.hp, oil: this.stats.oil, maxOil: this.stats.oil, inv: 0, dead: false, yaw: 0, stepY: 0 });
    this.camYaw = 0; this.camPitch = -0.12;
    for (const c of this.arena.cages) this.addAlly(c.ally, c.x + 0.5, c.y, c.z + 0.5, Infinity, c);
    if (this.plan.goal === "boss" && this.arena.boss) this.spawnEnemy("golem", this.arena.boss.x, this.arena.boss.z, true);
    this.ambience.set(this.world.ambient);
    this.mode = mode; this.modeT = 0; this.timeScale = 1; this.slowTarget = 1;
    if (mode === "attract") {
      // a few monsters wander about for the home screen
      for (let i = 0; i < 4; i++) { const k = this.pickKind(); const r = this.arena.rifts[i % this.arena.rifts.length]; const e = this.spawnEnemy(k, r.x + (Math.random() - 0.5) * 6, r.z + (Math.random() - 0.5) * 6, false, true); if (e) { e.idle = true; e.rise = 1; } }
    }
    if (mode === "intro") { this.o.onEvent({ k: "intro", plan: this.plan, next }); sfx("stageStart"); }
    this.placeCameraNow();
    this.emitHud(true);
  }
  /** from the home screen: fly over the island, then fight */
  play() {
    if (this.mode === "attract") {
      // the wanderers go home; the stage begins properly
      for (const e of this.enemies) if (!e.kind.startsWith("golem")) e.alive = false;
      this.enemies = this.enemies.filter((e) => e.alive);
      this.mode = "intro"; this.modeT = 0;
      this.o.onEvent({ k: "intro", plan: this.plan, next: false });
      sfx("stageStart");
    }
  }
  restartStage() { this.load(this.stage, "intro"); }
  private cap() { return Math.max(3, Math.min(this.plan.maxAlive, this.touch ? 9 : 14)); }
  private pickKind(): EnemyKind {
    const list = this.plan.enemies;
    let s = 0; for (const e of list) s += e.w;
    let r = this.rng() * s;
    for (const e of list) { r -= e.w; if (r <= 0) return e.kind; }
    return list[0].kind;
  }

  // ------------------------------------------------------------------ actors
  private spawnEnemy(kind: Kind, x: number, z: number, boss = false, quiet = false): Enemy | null {
    const S = ENEMY[kind], d = this.plan.difficulty;
    const giants = this.plan.mods.includes("giants");
    const scale = (giants && kind !== "golem" ? 1.35 : 1) * (boss && this.plan.finale ? 1.25 : 1);
    const hpMul = (1 + 1.5 * d) * (giants ? 1.8 : 1) * (this.plan.remix ? 1.15 : 1) * (boss ? (1 + d * 1.4) * (this.plan.finale ? 1.6 : 1) : 1);
    const def = RIGS[S.rig];
    const y = this.arena.vox.top(x, z) + (kind === "batbit" ? 2.5 : 0.01);
    const base = mix(S.base, this.world.tint, kind === "golem" ? 0.25 : 0.4);
    const c = rgb(base);
    const e: Enemy = {
      x, y, z, vx: 0, vy: 0, vz: 0, r: def.radius * scale, h: def.height * scale, onGround: false, yaw: Math.PI, bx: false, bz: false,
      kind, rig: S.rig, hp: S.hp * hpMul, maxHp: S.hp * hpMul, speed: S.speed * (1 + d * 0.3) * (giants ? 0.85 : 1), dmg: S.dmg * (1 + 1.1 * d), reach: S.reach * (kind === "spitter" ? 1 : scale), coins: S.coins,
      dig: S.dig, scale, alive: true, pose: newPose(S.rig), walk: Math.random() * 6, walkAmt: 0, atk: 0, atkCd: 1 + Math.random(), flash: 0, t: 0, rise: 0,
      fuse: 0, hopCd: Math.random() * 0.5, dive: 0, stuck: 0, digCd: 0, color: [c[0] / 255, c[1] / 255, c[2] / 255],
      tx: x, ty: y, tz: z, retarget: 0, hitT: 0, throwCd: 5, summonCd: 12, enraged: false, idle: false, beacon: this.plan.goal === "hold" && kind !== "batbit" && kind !== "spitter" && this.nextId % 3 !== 0,
    };
    this.nextId++;
    this.enemies.push(e);
    if (boss) { this.boss = e; e.rise = 1; e.yaw = Math.atan2(this.arena.spawn.x - x, this.arena.spawn.z - z); }
    else if (!quiet) { this.view.sparks.burst(x, y + 0.5, z, 10, 0.9, 0.3, 1, 4, 0.14, 0.5, -2); sfxAt("rift", x, y, z, { gain: 0.6 }); }
    return e;
  }
  private addAlly(kind: Ally["kind"], x: number, y: number, z: number, life: number, cage: Cage | null = null) {
    const def = RIGS[kind];
    this.allies.push({ x, y: y + 0.01, z, vx: 0, vy: 0, vz: 0, r: def.radius, h: def.height, onGround: false, yaw: 0, bx: false, bz: false, kind, hp: ALLY[kind].hp, maxHp: ALLY[kind].hp, life, pose: newPose(kind), walk: 0, walkAmt: 0, atk: 0, atkCd: 0.5, flash: 0, cage, cheer: 0 });
  }

  /** move a body through the blocks: slides along walls, steps up one-block ledges, lands on tops */
  private moveBody(b: Body, dt: number, step: boolean) {
    const V = this.arena.vox;
    b.bx = false; b.bz = false;
    let nx = b.x + b.vx * dt;
    if (V.boxHits(nx - b.r, b.y + 0.02, b.z - b.r, nx + b.r, b.y + b.h, b.z + b.r)) {
      if (step && b.onGround && !V.boxHits(nx - b.r, b.y + 1.02, b.z - b.r, nx + b.r, b.y + 1 + b.h, b.z + b.r) && !V.boxHits(b.x - b.r, b.y + 1.02, b.z - b.r, b.x + b.r, b.y + 1 + b.h, b.z + b.r)) {
        const ny = Math.floor(b.y + 0.02) + 1;
        if (b === (this.p as Body)) this.p.stepY -= ny - b.y;
        b.y = ny;
      } else { nx = b.x; b.vx = 0; b.bx = true; }
    }
    b.x = nx;
    let nz = b.z + b.vz * dt;
    if (V.boxHits(b.x - b.r, b.y + 0.02, nz - b.r, b.x + b.r, b.y + b.h, nz + b.r)) {
      if (step && b.onGround && !V.boxHits(b.x - b.r, b.y + 1.02, nz - b.r, b.x + b.r, b.y + 1 + b.h, nz + b.r) && !V.boxHits(b.x - b.r, b.y + 1.02, b.z - b.r, b.x + b.r, b.y + 1 + b.h, b.z + b.r)) {
        const ny = Math.floor(b.y + 0.02) + 1;
        if (b === (this.p as Body)) this.p.stepY -= ny - b.y;
        b.y = ny;
      } else { nz = b.z; b.vz = 0; b.bz = true; }
    }
    b.z = nz;
    const ny = b.y + b.vy * dt;
    if (V.boxHits(b.x - b.r, ny, b.z - b.r, b.x + b.r, ny + b.h, b.z + b.r)) {
      if (b.vy <= 0) { b.y = Math.floor(ny) + 1; b.onGround = true; }
      else { b.y = Math.floor(ny + b.h) - b.h - 0.001; }
      b.vy = 0;
    } else { b.y = ny; b.onGround = false; }
    // pushed inside a block (a block fell on us, or we stepped oddly): climb out
    if (V.boxHits(b.x - b.r, b.y + 0.05, b.z - b.r, b.x + b.r, b.y + b.h - 0.05, b.z + b.r)) b.y += Math.min(1, dt * 12);
  }

  // ------------------------------------------------------------------ the frame
  frame(rawDt: number) {
    // slow motion eases in and out
    this.slowT -= rawDt;
    if (this.slowT <= 0) this.slowTarget = 1;
    this.timeScale = damp(this.timeScale, this.slowTarget, this.slowTarget < 1 ? 0.04 : 0.2, rawDt);
    const dt = rawDt * this.timeScale;
    this.modeT += rawDt;
    const V = this.arena.vox;
    if (this.mode === "play") this.stageTime += dt;
    this.updatePlayer(dt);
    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.separate();
    for (const a of this.allies) this.updateAlly(a, dt);
    this.updateShots(dt);
    this.updateDrops(dt);
    this.updateBooms(dt);
    if (this.mode === "play") { this.spawning(dt); this.goals(dt); this.updatePowers(dt); }
    this.flow();
    this.enemies = this.enemies.length > 40 ? this.enemies.filter((e) => e.alive) : this.enemies;
    this.updateCamera(rawDt);
    // ears follow the camera
    const cam = this.view.camera;
    ear.x = cam.position.x; ear.y = cam.position.y; ear.z = cam.position.z;
    cam.getWorldDirection(_dir); ear.rx = -_dir.z; ear.rz = _dir.x;
    if (this.mode !== "attract") this.ambience.update(rawDt);
    // draw
    this.view.sync(this.arena, 3);
    this.drawActors();
    this.view.drawPickups(this.drops);
    this.view.render(dt, this.grav, V);
    this.drawOverlay(rawDt);
    this.hudT -= rawDt;
    if (this.hudT <= 0) { this.hudT = 0.12; this.emitHud(); }
  }

  // ------------------------------------------------------------------ the player
  private updatePlayer(dt: number) {
    const p = this.p;
    p.inv -= dt; p.hurt -= dt; this.calm += dt;
    if (this.calm > 3 && !p.dead && p.hp < p.maxHp && this.mode === "play") p.hp = Math.min(p.maxHp, p.hp + dt * 9);
    p.stepY = damp(p.stepY, 0, 0.06, dt);
    if (p.dead || (this.mode !== "play" && this.mode !== "intro" && this.mode !== "clear")) {
      p.vx = damp(p.vx, 0, 0.1, dt); p.vz = damp(p.vz, 0, 0.1, dt); p.vy -= this.grav * dt;
      this.moveBody(p, dt, false);
      p.walkAmt = damp(p.walkAmt, 0, 0.1, dt);
      return;
    }
    const playing = this.mode === "play";
    // movement relative to the camera
    let mx = this.mv.x, my = this.mv.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) mx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) mx += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) my += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) my -= 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (!playing) { mx = 0; my = 0; }
    const yaw = this.camYaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const sprint = this.sprint || (this.touch && ml > 0.92);
    const sp = (sprint ? 7.4 : 5.2) * (this.inLiquid(p.x, p.y, p.z) ? 0.6 : 1);
    const wx = (fx * my + rx * mx) * sp, wz = (fz * my + rz * mx) * sp;
    const acc = p.onGround ? 0.05 : 0.18;
    p.vx = damp(p.vx, wx, acc, dt); p.vz = damp(p.vz, wz, acc, dt);
    if (this.wantJump && p.onGround && playing) { p.vy = Math.sqrt(2 * this.grav * 1.35); sfx("jump", { rate: 0.95 + Math.random() * 0.1 }); }
    this.wantJump = false;
    const wasAir = !p.onGround, vyBefore = p.vy;
    p.vy -= this.grav * dt;
    this.moveBody(p, dt, true);
    if (wasAir && p.onGround && vyBefore < -6) { sfx("land", { gain: Math.min(1, -vyBefore / 14) }); this.view.debris.smoke(p.x, p.y, p.z, 3, 0.85, 0.35); }
    const speed = Math.hypot(p.vx, p.vz);
    p.walkAmt = damp(p.walkAmt, p.onGround ? Math.min(1, speed / 5) : 0.3, 0.08, dt);
    p.walk += speed * dt * 2.1;
    p.yaw = this.camYaw;
    // hazards
    if (this.inLiquid(p.x, p.y, p.z)) {
      const lq = this.world.liquid;
      if (lq === "lava") this.hurtPlayer(30 * dt, p.x, p.z, true);
      else if (lq === "goo") this.hurtPlayer(9 * dt, p.x, p.z, true);
    }
    if (p.y < -12) { this.hurtPlayer(30, p.x, p.z); const sp2 = this.arena.spawn; p.x = sp2.x; p.y = sp2.y + 1; p.z = sp2.z; p.vy = 0; }
    // the blaster
    this.fireCd -= dt;
    const target = playing ? this.assistTarget() : null;
    this.aimOn = !!target;
    const auto = this.touch && this.autoFire && target !== null;
    if (playing && (this.firing || auto) && this.fireCd <= 0) this.shoot(target);
    // a little aim help on phones: the camera leans toward the monster you're shooting at
    if (target && this.touch && (this.firing || auto)) {
      const a = Math.atan2(target.x - this.camPos.x, target.z - this.camPos.z);
      this.camYaw += angleTo(this.camYaw, a) * Math.min(1, dt * 3.5) * 0.45;
    }
  }
  private inLiquid(x: number, y: number, z: number) {
    return this.arena.liquidY > 0 && y < this.arena.liquidY - 0.2 && this.arena.vox.top(x, z) <= 1 && x > 0 && z > 0 && x < this.arena.size && z < this.arena.size;
  }

  /** the monster nearest the crosshair (within a small cone), if one is in clear view */
  private assistTarget(): Enemy | null {
    const cam = this.view.camera;
    cam.getWorldDirection(_dir);
    const cone = this.touch ? 0.12 : 0.05;
    let best: Enemy | null = null, bestA = cone;
    for (const e of this.enemies) {
      if (!e.alive || e.rise < 1 || e.idle) continue;
      _v.set(e.x - cam.position.x, e.y + e.h * 0.55 - cam.position.y, e.z - cam.position.z);
      const d = _v.length();
      if (d > 40 || d < 1) continue;
      const a = Math.acos(clamp(_v.dot(_dir) / d, -1, 1)) * Math.min(1.6, Math.max(0.7, d / 12));
      if (a < bestA) {
        // line of sight from the camera
        _v.normalize();
        if (this.arena.vox.raycast(cam.position.x, cam.position.y, cam.position.z, _v.x, _v.y, _v.z, d - e.r, HIT)) continue;
        best = e; bestA = a;
      }
    }
    return best;
  }

  private muzzle(out: THREE.Vector3) {
    const p = this.p, yaw = this.camYaw, pitch = this.camPitch;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    return out.set(p.x + fx * 1.0 * Math.cos(pitch) + rx * 0.44, p.y + 1.0 + Math.sin(pitch) * 1.0, p.z + fz * 1.0 * Math.cos(pitch) + rz * 0.44);
  }

  private shoot(target: Enemy | null) {
    const s = this.stats, p = this.p;
    const rapid = this.powers.has("rapid"), triple = this.powers.has("triple"), rocket = this.powers.has("rocket");
    const dry = p.oil <= 0 && !rapid;
    this.fireCd = 1 / (s.rate * (rapid ? 2.1 : 1) * (dry ? 0.4 : 1));
    if (!rapid && p.oil > 0) {
      p.oil = Math.max(0, p.oil - (rocket ? 2 : 1));
      if (p.oil / p.maxOil < 0.2 && !this.lowOilSaid) { this.lowOilSaid = true; this.o.onEvent({ k: "lowOil" }); sfx("lowOil"); }
    }
    const cam = this.view.camera;
    cam.getWorldDirection(_dir);
    // where the crosshair points: from the camera (past the hero) into the world
    const start = this.camDist * 0.95;
    const ox = cam.position.x + _dir.x * start, oy = cam.position.y + _dir.y * start, oz = cam.position.z + _dir.z * start;
    let ax: number, ay: number, az: number;
    if (target) { ax = target.x; ay = target.y + target.h * 0.55; az = target.z; }
    else {
      const t = this.arena.vox.raycast(ox, oy, oz, _dir.x, _dir.y, _dir.z, 80, HIT) ? HIT.t : 80;
      const et = this.rayEnemies(ox, oy, oz, _dir.x, _dir.y, _dir.z, t);
      const tt = et ? et.t : t;
      ax = ox + _dir.x * tt; ay = oy + _dir.y * tt; az = oz + _dir.z * tt;
    }
    const m = this.muzzle(_v2);
    const mx = m.x, my = m.y, mz = m.z;
    const look = HERO_SKINS.find((x) => x.id === this.heroSkin)?.look ?? HERO_SKINS[0].look;
    const [gr, gg, gb] = rgb(look.glow).map((v) => v / 255);
    this.view.sparks.flash(mx, my, mz, 0.45, gr * 1.2, gg * 1.2, gb * 1.2, 0.06);
    this.shake = Math.max(this.shake, 0.06);
    this.camPitch = Math.min(0.8, this.camPitch + 0.004);
    const n = triple ? 3 : 1;
    for (let k = 0; k < n; k++) {
      let dx = ax - mx, dy = ay - my, dz = az - mz;
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      if (k > 0) { const a = (k === 1 ? 1 : -1) * 0.07, c = Math.cos(a), sn = Math.sin(a); const nx = dx * c - dz * sn, nz = dx * sn + dz * c; dx = nx; dz = nz; }
      if (rocket) {
        this.shots.push({ x: mx, y: my, z: mz, vx: dx * 34, vy: dy * 34, vz: dz * 34, kind: "rocket", friendly: true, dmg: s.dmg * 3.2, r: 0.25, life: 3, grav: 0 });
        continue;
      }
      // a bolt of light: blocks first, then the nearest monster in front of them
      const bt = this.arena.vox.raycast(mx, my, mz, dx, dy, dz, 70, HIT) ? HIT.t : 70;
      const hitBlock = bt < 70 ? { x: HIT.x, y: HIT.y, z: HIT.z, nx: HIT.nx, ny: HIT.ny, nz: HIT.nz, id: HIT.id } : null;
      const eh = this.rayEnemies(mx, my, mz, dx, dy, dz, bt);
      const end = eh ? eh.t : bt;
      const hx = mx + dx * end, hy = my + dy * end, hz = mz + dz * end;
      this.view.tracers.add(mx, my, mz, hx, hy, hz, gr, gg, gb, dry ? 0.04 : 0.08);
      if (eh) {
        const dmg = s.dmg * (dry ? 0.6 : 1) * (0.9 + Math.random() * 0.2);
        this.damageEnemy(eh.e, dmg, dx, dz);
        this.view.sparks.burst(hx, hy, hz, 5, gr, gg, gb, 4, 0.08, 0.25, 4);
      } else if (hitBlock) {
        this.hitBlock(hitBlock.x, hitBlock.y, hitBlock.z, s.blockDmg * (dry ? 0.5 : 1), dx, dz, hx, hy, hz);
      }
    }
    sfx(rocket ? "rocket" : dry ? "shootDry" : "shoot", { rate: (rapid ? 1.08 : 1) * (0.94 + Math.random() * 0.12) });
  }

  /** nearest monster along a ray (box test) before maxT */
  private rayEnemies(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): { e: Enemy; t: number } | null {
    let best: Enemy | null = null, bt = maxT;
    for (const e of this.enemies) {
      if (!e.alive || e.rise < 1) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, e.x - e.r, e.y, e.z - e.r, e.x + e.r, e.y + e.h, e.z + e.r);
      if (t >= 0 && t < bt) { bt = t; best = e; }
    }
    return best ? { e: best, t: bt } : null;
  }

  // ------------------------------------------------------------------ blocks
  private chip = 0;
  /** a shot hits a block: wear it, break it, topple what it held up */
  private hitBlock(x: number, y: number, z: number, dmg: number, dx: number, dz: number, hx: number, hy: number, hz: number) {
    const V = this.arena.vox;
    const id = V.get(x, y, z);
    if (!id) return;
    const A = this.view.blockAvg;
    const broke = V.damage(x, y, z, Math.max(1, Math.round(dmg)));
    if (!broke) {
      this.view.debris.spawn(hx, hy, hz, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.1, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 0.8);
      this.view.sparks.burst(hx, hy, hz, 3, 1, 0.9, 0.6, 3, 0.06, 0.18, 6);
      if ((this.chip = (this.chip + 1) % 2) === 0) sfxAt("hitBlock", hx, hy, hz, { rate: 0.9 + Math.random() * 0.2 });
      return;
    }
    this.blockBroken(x, y, z, id, dx, dz);
    this.topple([x, y, z], dx, dz);
  }
  private blockBroken(x: number, y: number, z: number, id: number, dx = 0, dz = 0, quiet = false) {
    const A = this.view.blockAvg;
    this.blocksBroken++;
    const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
    this.view.debris.burst(cx, cy, cz, this.view.phone ? 5 : 8, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 3.5, 0.2);
    if (!quiet) {
      const mat = BLOCKS[id].mat;
      const k: StormSfx = id === B.CORE ? "coreBreak" : mat === "wood" ? "breakWood" : mat === "stone" ? "breakStone" : mat === "metal" ? "breakMetal" : mat === "glass" ? "breakGlass" : mat === "gloom" ? "breakGloom" : "breakSoft";
      sfxAt(k, cx, cy, cz, { rate: 0.9 + Math.random() * 0.2 });
    }
    void dx; void dz;
    if (id === B.CORE) { this.view.sparks.burst(cx, cy, cz, 18, 1, 0.3, 1, 7, 0.16, 0.6, 3); this.shake = Math.max(this.shake, 0.25); }
    if (id === B.GLOOM) this.view.sparks.burst(cx, cy, cz, 4, 0.8, 0.3, 1, 3, 0.08, 0.3, 2);
    if (id === B.BOOM) this.booms.push({ x: cx, y: cy, z: cz, t: 0.12, r: 2.6, dmg: 40, friendly: true });
    if (id === B.CHEST) { for (let k = 0; k < 6; k++) this.dropAt("coin", cx, cy, cz); sfxAt("coin", cx, cy, cz); }
    if (id === B.CRYSTAL) this.dropAt("gem", cx, cy, cz);
  }
  /** after blocks broke: anything that no longer reaches the ground falls */
  private topple(cells: number[], dx: number, dz: number) {
    const groups = this.arena.vox.loosened(cells, 1500);
    let n = 0;
    for (const g of groups) {
      this.view.fallers?.drop(g, [dx * 1.5, 0.5, dz * 1.5]);
      n += g.length / 4;
    }
    if (n >= 10) {
      this.o.onEvent({ k: "collapse", n });
      sfx("collapse", { gain: Math.min(1, 0.5 + n / 60) });
      this.shake = Math.max(this.shake, Math.min(0.6, 0.2 + n / 80));
      if (n >= 24) this.slow(0.45, 0.7);
    }
  }
  private crumbleT = 0;
  private onImpact = (x: number, y: number, z: number, id: number, speed: number) => {
    const A = this.view.blockAvg;
    this.view.debris.burst(x, y + 0.3, z, this.view.phone ? 3 : 5, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 3, 0.2);
    const now = performance.now();
    if (now - this.crumbleT > 70) { this.crumbleT = now; sfxAt("crumble", x, y, z, { rate: 0.85 + Math.random() * 0.3 }); }
    if (id === B.BOOM) this.booms.push({ x, y: y + 0.5, z, t: 0.02, r: 2.6, dmg: 40, friendly: true });
    if (id === B.CHEST) for (let k = 0; k < 4; k++) this.dropAt("coin", x, y + 0.5, z);
    if (id === B.CORE) this.view.sparks.burst(x, y + 0.5, z, 12, 1, 0.3, 1, 6, 0.14, 0.5, 3);
    // crushing: monsters under falling blocks get hurt
    if (speed > 3) {
      for (const e of this.enemies) {
        if (!e.alive || e.kind === "golem") continue;
        if (Math.abs(e.x - x) < e.r + 0.7 && Math.abs(e.z - z) < e.r + 0.7 && y > e.y - 0.5 && y < e.y + e.h + 1.2) this.damageEnemy(e, 18 + speed * 3, 0, 0, true);
      }
      if (this.boss && this.boss.alive && Math.hypot(this.boss.x - x, this.boss.z - z) < this.boss.r + 0.8 && y > this.boss.y + this.boss.h * 0.5) this.damageEnemy(this.boss, 8 + speed, 0, 0, true);
    }
  };
  private explode(x: number, y: number, z: number, r: number, dmg: number, friendly = true) {
    const V = this.arena.vox;
    const cells: number[] = [];
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      if (Math.hypot(bx + 0.5 - x, by + 0.5 - y, bz + 0.5 - z) > r) continue;
      const id = V.get(bx, by, bz);
      if (!id || id === B.BEDROCK) continue;
      if (V.damage(bx, by, bz, 99)) { this.blockBroken(bx, by, bz, id, 0, 0, true); cells.push(bx, by, bz); }
    }
    if (cells.length) this.topple(cells, 0, 0);
    this.view.sparks.flash(x, y, z, r * 1.6, 1.4, 0.9, 0.4, 0.14);
    this.view.sparks.burst(x, y, z, this.view.phone ? 16 : 28, 1, 0.6, 0.2, 9, 0.2, 0.55, 6);
    this.view.debris.smoke(x, y, z, this.view.phone ? 4 : 7, 0.45, 0.9);
    sfxAt("boom", x, y, z, { rate: 0.9 + Math.random() * 0.2, far: 60 });
    const d0 = Math.hypot(this.p.x - x, this.p.z - z);
    this.shake = Math.max(this.shake, clamp(0.8 - d0 / 20, 0.1, 0.8));
    // damage (monsters too: a fusebug can take its friends with it)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y + e.h / 2 - y, e.z - z);
      if (d < r + e.r + 0.6) this.damageEnemy(e, dmg * (1 - d / (r + 2)) * (friendly ? 1 : 0.6), (e.x - x) / (d || 1), (e.z - z) / (d || 1), true);
    }
    const pd = Math.hypot(this.p.x - x, this.p.y + 0.9 - y, this.p.z - z);
    if (pd < r + 0.8 && !friendly) this.hurtPlayer(dmg * (1 - pd / (r + 1.5)), x, z);
    if (pd < r * 0.8 && friendly) this.hurtPlayer(6, x, z); // careful with rockets up close
    for (const a of this.allies) { const d = Math.hypot(a.x - x, a.z - z); if (d < r && !friendly) a.hp -= dmg * 0.5; }
  }
  private updateBooms(dt: number) {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.t -= dt;
      if (b.t <= 0) { this.booms.splice(i, 1); this.explode(b.x, b.y, b.z, b.r, b.dmg, b.friendly); }
    }
  }

  // ------------------------------------------------------------------ damage
  private damageEnemy(e: Enemy, dmg: number, kx: number, kz: number, quiet = false) {
    if (!e.alive || e.rise < 1) return;
    e.hp -= dmg;
    e.flash = 0.09; e.hitT = 0.15;
    if (e.kind !== "golem" && e.kind !== "brute") { e.vx += kx * 3; e.vz += kz * 3; }
    this.hitMark = 0.16;
    if (!quiet) sfxAt("hit", e.x, e.y + 1, e.z, { rate: 0.9 + Math.random() * 0.25 });
    if (e.kind === "fusebug" && e.hp <= 0) { e.alive = false; this.killed(e); this.booms.push({ x: e.x, y: e.y + 0.5, z: e.z, t: 0.05, r: 2.4, dmg: e.dmg * 1.4, friendly: true }); return; }
    if (e.hp <= 0) { e.alive = false; this.killed(e); }
  }
  private killed(e: Enemy) {
    const [r, g, b] = e.color;
    const big = e.kind === "brute" || e.kind === "golem";
    this.view.debris.burst(e.x, e.y + e.h * 0.5, e.z, big ? 22 : this.view.phone ? 9 : 14, r, g, b, big ? 7 : 5, 0.16 * e.scale * (big ? 2 : 1));
    this.view.sparks.burst(e.x, e.y + e.h * 0.5, e.z, 10, 1, 0.9, 0.5, 5, 0.1, 0.4, 3);
    sfxAt(big ? "enemyDieBig" : "enemyDie", e.x, e.y + 1, e.z, { rate: 0.9 + Math.random() * 0.2 });
    if (e.idle) return;
    this.kills++;
    this.killMark = 0.3;
    const gold = this.plan.mods.includes("gold") ? 2 : 1;
    for (let k = 0; k < Math.min(10, e.coins * gold); k++) this.dropAt("coin", e.x, e.y + 0.6, e.z);
    // sometimes a little help
    const roll = this.rng();
    if (roll < 0.06) this.dropAt("health", e.x, e.y + 0.6, e.z);
    else if (roll < 0.12) this.dropAt("oil", e.x, e.y + 0.6, e.z);
    else if (roll < 0.15) this.dropAt("power", e.x, e.y + 0.6, e.z);
    this.streak++; this.streakT = 1.6;
    if (this.streak >= 3) this.o.onEvent({ k: "streak", n: this.streak });
    if (e === this.boss) { this.focus.set(e.x, e.y + e.h * 0.5, e.z); }
  }
  private hurtPlayer(dmg: number, fromX: number, fromZ: number, silent = false) {
    const p = this.p;
    if (p.dead || this.mode !== "play") return;
    if (this.powers.has("shield")) { if (!silent && p.inv <= 0) { this.view.sparks.burst(p.x, p.y + 1, p.z, 8, 0.5, 1, 1, 4, 0.1, 0.3, 0); sfx("shieldPop", { gain: 0.5 }); p.inv = 0.3; } return; }
    if (p.inv > 0 && !silent) return;
    p.hp -= dmg;
    this.calm = 0;
    if (!silent) {
      p.inv = 0.22; p.hurt = 0.35;
      this.dmgDir = Math.atan2(fromX - p.x, fromZ - p.z); this.dmgT = 0.9;
      sfx("hurt", { rate: 0.9 + Math.random() * 0.2 });
      this.shake = Math.max(this.shake, 0.25);
    }
    if (p.hp <= 0) this.playerDown();
  }
  private playerDown() {
    const p = this.p;
    p.dead = true; p.hp = 0;
    this.lostLife = true;
    this.lives = Math.max(0, this.lives - 1);
    this.o.onLives(this.lives);
    sfx("die");
    this.view.debris.burst(p.x, p.y + 1, p.z, 12, 1, 0.55, 0.25, 5, 0.16);
    this.mode = "down"; this.modeT = 0;
    this.slow(0.3, 1.2);
    if (this.lives > 0) this.o.onEvent({ k: "lifeLost", livesLeft: this.lives });
    else this.o.onEvent({ k: "outOfLives" });
  }

  // ------------------------------------------------------------------ monsters
  private updateEnemy(e: Enemy, dt: number) {
    e.t += dt; e.atkCd -= dt; e.flash -= dt; e.hitT -= dt; e.digCd -= dt;
    if (e.rise < 1) { e.rise = Math.min(1, e.rise + dt * 2.2); return; }
    const V = this.arena.vox;
    // pick who to go for
    e.retarget -= dt;
    if (e.retarget <= 0) {
      e.retarget = 0.4 + Math.random() * 0.3;
      let tx = this.p.x, ty = this.p.y, tz = this.p.z, best = this.p.dead ? 1e9 : Math.hypot(e.x - this.p.x, e.z - this.p.z) * 0.85;
      for (const a of this.allies) { if (a.cage && !a.cage.freed) continue; const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < best) { best = d; tx = a.x; ty = a.y; tz = a.z; } }
      if (e.beacon && this.arena.beacon) { const b = this.arena.beacon; tx = b.x; ty = b.y; tz = b.z; }
      if (e.idle) { if (Math.random() < 0.3) { tx = e.x + (Math.random() - 0.5) * 10; tz = e.z + (Math.random() - 0.5) * 10; ty = e.y; } else { tx = e.tx; ty = e.ty; tz = e.tz; } }
      e.tx = tx; e.ty = ty; e.tz = tz;
    }
    if (this.mode !== "play" && !e.idle) { e.vx = damp(e.vx, 0, 0.2, dt); e.vz = damp(e.vz, 0, 0.2, dt); if (e.kind !== "batbit") { e.vy -= this.grav * dt; this.moveBody(e, dt, true); } e.walkAmt = damp(e.walkAmt, 0, 0.2, dt); return; }
    const dx = e.tx - e.x, dz = e.tz - e.z, dist = Math.hypot(dx, dz) || 0.001;
    const ux = dx / dist, uz = dz / dist;
    const want = Math.atan2(dx, dz);
    e.yaw += angleTo(e.yaw, want) * Math.min(1, dt * 8);
    let sp = e.idle ? e.speed * 0.35 : e.speed;
    if (this.inLiquid(e.x, e.y, e.z)) sp *= 0.6;
    const reach = e.reach + e.r;
    switch (e.kind) {
      case "batbit": {
        // circle above the target, then dive
        e.dive -= dt;
        const tyAir = e.ty + (e.dive > 0 && e.dive < 0.9 ? 0.9 : 2.8);
        const orbit = e.dive > 0 && e.dive < 0.9 ? 0 : 3.2;
        const ang = e.t * 1.6 + e.maxHp;
        const gx = e.tx + Math.cos(ang) * orbit - e.x, gz = e.tz + Math.sin(ang) * orbit - e.z, gy = tyAir - e.y;
        const gl = Math.hypot(gx, gy, gz) || 1;
        const s2 = e.dive > 0 && e.dive < 0.9 ? sp * 1.9 : sp;
        e.vx = damp(e.vx, (gx / gl) * s2, 0.12, dt); e.vy = damp(e.vy, (gy / gl) * s2, 0.12, dt); e.vz = damp(e.vz, (gz / gl) * s2, 0.12, dt);
        if (e.dive <= 0) e.dive = 2.4 + Math.random() * 1.5;
        e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
        if (V.solidAt(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z))) e.y += dt * 6;
        e.x = clamp(e.x, 0.5, this.arena.size - 0.5); e.z = clamp(e.z, 0.5, this.arena.size - 0.5);
        if (Math.hypot(e.tx - e.x, e.ty + 1 - e.y, e.tz - e.z) < reach + 0.4 && e.atkCd <= 0) { e.atkCd = 1.1; this.strike(e, e.dmg); }
        if (Math.random() < dt * 0.4) sfxAt("flap", e.x, e.y, e.z, { gain: 0.6 });
        return;
      }
      case "cubeling": {
        e.hopCd -= dt;
        if (e.onGround) {
          e.vx = damp(e.vx, 0, 0.05, dt); e.vz = damp(e.vz, 0, 0.05, dt);
          if (e.hopCd <= 0) { e.hopCd = 0.55 + Math.random() * 0.3; const hs = dist < reach + 0.5 ? 0.5 : 1; e.vx = ux * sp * hs; e.vz = uz * sp * hs; e.vy = Math.sqrt(2 * this.grav * 1.25); if (Math.random() < 0.3) sfxAt("hop", e.x, e.y, e.z, { rate: 0.9 + Math.random() * 0.3 }); }
        }
        if (dist < reach && Math.abs(e.ty - e.y) < 1.6 && e.atkCd <= 0 && !e.idle) { e.atkCd = 1.25 - this.plan.difficulty * 0.35; this.strike(e, e.dmg); }
        break;
      }
      case "spitter": {
        // keep a distance and spit
        const k = dist > 11 ? 1 : dist < 6 ? -0.8 : 0.25 * Math.sin(e.t * 0.9);
        e.vx = damp(e.vx, (ux * k + uz * 0.4 * Math.sin(e.t * 0.7)) * sp, 0.15, dt); e.vz = damp(e.vz, (uz * k - ux * 0.4 * Math.sin(e.t * 0.7)) * sp, 0.15, dt);
        if (dist < e.reach && e.atkCd <= 0 && !e.idle) {
          const sx = e.x + ux * 0.5, sy = e.y + e.h * 0.8, sz = e.z + uz * 0.5;
          const ty = e.ty + 1, gx = e.tx - sx, gy = ty - sy, gz = e.tz - sz, gd = Math.hypot(gx, gz);
          if (!V.raycast(sx, sy, sz, gx / Math.hypot(gx, gy, gz), gy / Math.hypot(gx, gy, gz), gz / Math.hypot(gx, gy, gz), Math.hypot(gx, gy, gz) - 0.8, HIT)) {
            e.atkCd = 2.2 - this.plan.difficulty * 0.7; e.atk = 0.01;
            const speed = 13, tt = gd / speed, g = this.grav * 0.5;
            this.shots.push({ x: sx, y: sy, z: sz, vx: (gx / gd) * speed, vy: gy / tt + 0.5 * g * tt, vz: (gz / gd) * speed, kind: "glob", friendly: false, dmg: e.dmg, r: 0.22, life: 4, grav: g });
            sfxAt("spit", sx, sy, sz);
          } else e.atkCd = 0.4;
        }
        break;
      }
      case "fusebug": {
        if (e.fuse > 0) {
          e.fuse += dt; e.vx = damp(e.vx, 0, 0.1, dt); e.vz = damp(e.vz, 0, 0.1, dt);
          if (Math.random() < dt * 30) this.view.sparks.spawn(e.x, e.y + 1.1 * e.scale, e.z - 0.1, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, 0.07, 1, 0.8, 0.3, 0.3, 1, 3);
          if (e.fuse > 0.9) { e.alive = false; this.booms.push({ x: e.x, y: e.y + 0.5, z: e.z, t: 0, r: 2.6, dmg: e.dmg, friendly: false }); this.view.debris.burst(e.x, e.y + 0.5, e.z, 8, e.color[0], e.color[1], e.color[2], 5, 0.16); this.boomEnemy(e); }
        } else {
          e.vx = damp(e.vx, ux * sp, 0.12, dt); e.vz = damp(e.vz, uz * sp, 0.12, dt);
          if (dist < reach && !e.idle) { e.fuse = 0.001; sfxAt("fuse", e.x, e.y, e.z); }
        }
        break;
      }
      default: {
        // walkers: grumbler, brute, golem
        const stop = dist < reach * 0.85;
        e.vx = damp(e.vx, stop ? 0 : ux * sp, 0.15, dt); e.vz = damp(e.vz, stop ? 0 : uz * sp, 0.15, dt);
        if (dist < reach && e.atkCd <= 0 && !e.idle && Math.abs(e.ty - e.y) < 2.5) { e.atk = 0.001; e.atkCd = e.kind === "golem" ? 2.4 : e.kind === "brute" ? 2.2 : 1.5 - this.plan.difficulty * 0.4; sfxAt("swing", e.x, e.y + 1, e.z, { rate: e.kind === "grumbler" ? 1.1 : 0.7 }); }
        if (e.kind === "golem") this.bossBrain(e, dt, dist);
        if (Math.random() < dt * 0.15) sfxAt(e.kind === "grumbler" ? "growl" : "growlBig", e.x, e.y + 1, e.z, { rate: 0.85 + Math.random() * 0.3 });
      }
    }
    // the attack swing lands part-way through
    if (e.atk > 0) {
      const before = e.atk;
      e.atk += dt / (e.kind === "golem" ? 0.9 : 0.55);
      if (before < 0.45 && e.atk >= 0.45 && e.kind !== "spitter") {
        if (e.kind === "golem" || e.kind === "brute") this.slam(e);
        else if (Math.hypot(e.tx - e.x, e.tz - e.z) < reach + 0.4) this.strike(e, e.dmg);
      }
      if (e.atk >= 1) e.atk = 0;
    }
    e.vy -= this.grav * dt;
    this.moveBody(e, dt, e.kind !== "cubeling");
    // stuck against a wall: jump, then dig through
    if ((e.bx || e.bz) && e.onGround && !e.idle) {
      e.stuck += dt;
      if (e.stuck > 0.35 && e.stuck < 0.4 && e.kind !== "golem" && e.kind !== "brute") e.vy = Math.sqrt(2 * this.grav * 1.3);
      if (e.dig > 0 && e.stuck > 0.6 && e.digCd <= 0) {
        e.digCd = e.kind === "brute" || e.kind === "golem" ? 0.25 : 0.7;
        const fx = Math.floor(e.x + ux * (e.r + 0.5)), fz = Math.floor(e.z + uz * (e.r + 0.5));
        const cells: number[] = [];
        const tall = Math.ceil(e.h);
        for (let yy = Math.floor(e.y + 0.1); yy < Math.floor(e.y) + tall; yy++) {
          const id = V.get(fx, yy, fz);
          if (!id || id === B.BEDROCK) continue;
          if (V.damage(fx, yy, fz, e.dig)) { this.blockBroken(fx, yy, fz, id); cells.push(fx, yy, fz); }
          else if (yy === Math.floor(e.y + 0.1)) sfxAt("hitBlock", fx, yy, fz, { rate: 0.7 });
          if (e.kind === "grumbler") break;
        }
        if (cells.length) this.topple(cells, ux, uz);
      }
    } else e.stuck = 0;
    const s = Math.hypot(e.vx, e.vz);
    e.walk += s * dt * (e.kind === "brute" || e.kind === "golem" ? 1.3 : 2.4) / e.scale;
    e.walkAmt = damp(e.walkAmt, e.onGround ? Math.min(1, s / Math.max(0.5, e.speed)) : 0.2, 0.1, dt);
    if (e.y < -10) { e.alive = false; this.killed(e); }
    if (this.inLiquid(e.x, e.y, e.z) && this.world.liquid === "lava") this.damageEnemy(e, 20 * dt, 0, 0, true);
  }
  private boomEnemy(e: Enemy) { if (!e.idle) { this.kills++; this.killMark = 0.3; } }
  /** a melee hit on whatever the monster is after (the hero, a friend, the beacon) */
  private strike(e: Enemy, dmg: number) {
    if (e.beacon && this.arena.beacon && Math.hypot(e.x - this.arena.beacon.x, e.z - this.arena.beacon.z) < e.reach + 2.2) {
      this.beaconHp -= dmg * 0.6; sfxAt("beaconHit", this.arena.beacon.x, this.arena.beacon.y + 2, this.arena.beacon.z);
      this.view.sparks.burst(this.arena.beacon.x, this.arena.beacon.y + 2, this.arena.beacon.z, 6, 0.5, 1, 1, 4, 0.1, 0.3, 2);
      return;
    }
    const pd = Math.hypot(e.x - this.p.x, e.z - this.p.z);
    if (pd < e.reach + e.r + 0.7 && Math.abs(this.p.y - e.y) < 2.2 + (e.kind === "batbit" ? 1.5 : 0)) { this.hurtPlayer(dmg, e.x, e.z); this.p.vx += (this.p.x - e.x) / (pd || 1) * 4; this.p.vz += (this.p.z - e.z) / (pd || 1) * 4; return; }
    for (const a of this.allies) {
      if (a.cage && !a.cage.freed) continue;
      if (Math.hypot(e.x - a.x, e.z - a.z) < e.reach + e.r + 0.6) { a.hp -= dmg * (a.kind === "knight" ? 0.5 : 1); a.flash = 0.1; return; }
    }
  }
  /** the brute's and the golem's ground slam: a shockwave that knocks back and breaks what's near */
  private slam(e: Enemy) {
    const r = e.kind === "golem" ? 4.2 : 2.6;
    const fx = e.x + Math.sin(e.yaw) * e.r, fz = e.z + Math.cos(e.yaw) * e.r;
    sfxAt("slam", fx, e.y, fz, { far: 50 });
    this.shake = Math.max(this.shake, e.kind === "golem" ? 0.7 : 0.4);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; this.view.debris.spawn(fx + Math.cos(a) * 0.6, e.y + 0.2, fz + Math.sin(a) * 0.6, Math.cos(a) * r * 2.2, 2 + Math.random() * 2, Math.sin(a) * r * 2.2, 0.22, e.color[0], e.color[1], e.color[2], 0.8); }
    this.view.debris.smoke(fx, e.y, fz, 5, 0.7, 0.8);
    const pd = Math.hypot(this.p.x - fx, this.p.z - fz);
    if (pd < r && Math.abs(this.p.y - e.y) < 2.5) { this.hurtPlayer(e.dmg * (1 - pd / (r * 1.4)), fx, fz); this.p.vx += (this.p.x - fx) / (pd || 1) * 9; this.p.vz += (this.p.z - fz) / (pd || 1) * 9; this.p.vy = 6; }
    for (const a of this.allies) { const d = Math.hypot(a.x - fx, a.z - fz); if (d < r) a.hp -= e.dmg * 0.6; }
    if (e.beacon && this.arena.beacon && Math.hypot(this.arena.beacon.x - fx, this.arena.beacon.z - fz) < r + 1) this.beaconHp -= e.dmg * 0.5;
    // the slam cracks the blocks around
    const V = this.arena.vox, cells: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.7;
      const bx = Math.floor(fx + Math.cos(a) * d), bz = Math.floor(fz + Math.sin(a) * d), by = Math.floor(e.y) - 1;
      const id = V.get(bx, by, bz);
      if (id && id !== B.BEDROCK && by > 1 && V.damage(bx, by, bz, 2)) { this.blockBroken(bx, by, bz, id, 0, 0, true); cells.push(bx, by, bz); }
    }
    if (cells.length) this.topple(cells, 0, 0);
  }
  private bossBrain(e: Enemy, dt: number, dist: number) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) { e.enraged = true; e.speed *= 1.35; sfx("bossRoar"); this.o.onEvent({ k: "hint", text: `${this.plan.bossName} is angry!` }); this.shake = 0.6; }
    e.throwCd -= dt; e.summonCd -= dt;
    if (e.throwCd <= 0 && dist > 5) {
      e.throwCd = (e.enraged ? 3.2 : 5) + Math.random() * 1.5;
      e.atk = 0.001;
      const sx = e.x, sy = e.y + e.h * 0.9, sz = e.z, gx = e.tx - sx, gz = e.tz - sz, gd = Math.hypot(gx, gz) || 1;
      const speed = 15, tt = gd / speed, g = this.grav * 0.6;
      this.shots.push({ x: sx, y: sy, z: sz, vx: (gx / gd) * speed, vy: (e.ty + 0.5 - sy) / tt + 0.5 * g * tt, vz: (gz / gd) * speed, kind: "boulder", friendly: false, dmg: e.dmg * 0.8, r: 0.6, life: 5, grav: g });
      sfxAt("whoosh", sx, sy, sz, { rate: 0.6 });
    }
    if (e.summonCd <= 0) {
      e.summonCd = e.enraged ? 10 : 14;
      sfx("bossRoar", { gain: 0.8 });
      const n = Math.min(3, this.cap() - this.enemies.filter((x) => x.alive).length);
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2; this.spawnEnemy(this.pickKind(), clamp(e.x + Math.cos(a) * 4, 2, this.arena.size - 2), clamp(e.z + Math.sin(a) * 4, 2, this.arena.size - 2)); }
    }
  }
  /** monsters don't stand inside each other */
  private separate() {
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const a = E[i]; if (!a.alive) continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.r + b.r;
        if (d < m && d > 0.001 && Math.abs(a.y - b.y) < 1.5) {
          const push = (m - d) * 0.5, ux = dx / d, uz = dz / d;
          const wa = a.kind === "golem" ? 0.1 : 1, wb = b.kind === "golem" ? 0.1 : 1;
          a.x -= ux * push * wa; a.z -= uz * push * wa; b.x += ux * push * wb; b.z += uz * push * wb;
        }
      }
      // and not inside the hero
      const dx = a.x - this.p.x, dz = a.z - this.p.z, d = Math.hypot(dx, dz), m = a.r + this.p.r;
      if (d < m && d > 0.001 && Math.abs(a.y - this.p.y) < 1.5 && a.kind !== "batbit") { a.x += (dx / d) * (m - d); a.z += (dz / d) * (m - d); }
    }
  }

  // ------------------------------------------------------------------ friends
  private updateAlly(a: Ally, dt: number) {
    a.atkCd -= dt; a.flash -= dt; a.cheer -= dt;
    if (a.cage && !a.cage.freed) {
      // waiting inside the cage, waving for help
      a.vx = 0; a.vz = 0; a.vy -= this.grav * dt; this.moveBody(a, dt, false);
      a.yaw += angleTo(a.yaw, Math.atan2(this.p.x - a.x, this.p.z - a.z)) * Math.min(1, dt * 3);
      a.cheer = 0.5;
      return;
    }
    if (a.life !== Infinity) a.life -= dt;
    if (a.hp <= 0 || a.life <= 0) {
      this.view.sparks.burst(a.x, a.y + 1, a.z, 14, 0.8, 0.6, 1, 4, 0.14, 0.6, -1);
      a.hp = 0; a.life = 0;
      this.allies = this.allies.filter((x) => x !== a);
      return;
    }
    const st = ALLY[a.kind];
    // the nearest monster
    let tgt: Enemy | null = null, best = a.kind === "archer" ? st.reach : 14;
    for (const e of this.enemies) { if (!e.alive || e.rise < 1 || e.idle) continue; const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < best) { best = d; tgt = e; } }
    let gx: number, gz: number, speed = st.speed;
    if (tgt) {
      const d = best, ux = (tgt.x - a.x) / (d || 1), uz = (tgt.z - a.z) / (d || 1);
      a.yaw += angleTo(a.yaw, Math.atan2(ux, uz)) * Math.min(1, dt * 10);
      if (a.kind === "archer") { const k = d > 12 ? 1 : d < 6 ? -0.7 : 0; gx = ux * k; gz = uz * k; }
      else { const k = d > st.reach + tgt.r ? 1 : 0; gx = ux * k; gz = uz * k; }
      if (a.atkCd <= 0 && (a.kind === "archer" ? d < st.reach : d < st.reach + tgt.r + 0.3)) {
        a.atkCd = st.rate; a.atk = 0.001;
        if (a.kind === "archer") {
          const sx = a.x + ux * 0.4, sy = a.y + 1.2, sz = a.z + uz * 0.4, ty = tgt.y + tgt.h * 0.5, l = Math.hypot(tgt.x - sx, ty - sy, tgt.z - sz) || 1;
          this.shots.push({ x: sx, y: sy, z: sz, vx: (tgt.x - sx) / l * 32, vy: (ty - sy) / l * 32, vz: (tgt.z - sz) / l * 32, kind: "arrow", friendly: true, dmg: st.dmg, r: 0.15, life: 2, grav: 0 });
          sfxAt("arrow", sx, sy, sz, { gain: 0.6 });
        } else {
          this.damageEnemy(tgt, st.dmg * (1 + this.plan.difficulty * 0.5), ux, uz, true);
          sfxAt(a.kind === "knight" ? "sword" : "punch", a.x, a.y + 1, a.z, { rate: 0.9 + Math.random() * 0.2 });
        }
      }
    } else {
      // follow the hero
      const dx = this.p.x - a.x, dz = this.p.z - a.z, d = Math.hypot(dx, dz);
      const k = d > 4 ? 1 : 0;
      gx = (dx / (d || 1)) * k; gz = (dz / (d || 1)) * k;
      if (d > 0.5) a.yaw += angleTo(a.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5);
      if (d > 30) { a.x = this.p.x - Math.sin(this.camYaw) * 2; a.z = this.p.z - Math.cos(this.camYaw) * 2; a.y = this.p.y + 1; }
      speed *= d > 9 ? 1.4 : 1;
    }
    a.vx = damp(a.vx, gx * speed, 0.12, dt); a.vz = damp(a.vz, gz * speed, 0.12, dt);
    a.vy -= this.grav * dt;
    this.moveBody(a, dt, true);
    if ((a.bx || a.bz) && a.onGround) a.vy = Math.sqrt(2 * this.grav * 1.3);
    const s = Math.hypot(a.vx, a.vz);
    a.walk += s * dt * 2.3; a.walkAmt = damp(a.walkAmt, Math.min(1, s / 4), 0.1, dt);
    if (a.atk > 0) { a.atk += dt / 0.4; if (a.atk >= 1) a.atk = 0; }
  }

  // ------------------------------------------------------------------ projectiles
  private updateShots(dt: number) {
    const V = this.arena.vox;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.vy -= s.grav * dt;
      const steps = 2;
      let done = false;
      for (let k = 0; k < steps && !done; k++) {
        s.x += (s.vx * dt) / steps; s.y += (s.vy * dt) / steps; s.z += (s.vz * dt) / steps;
        // blocks
        if (V.solidAt(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z)) || s.y < 0) {
          done = true;
          this.shotImpact(s, null, Math.floor(s.x), Math.floor(s.y), Math.floor(s.z));
          break;
        }
        // bodies
        if (s.friendly) {
          for (const e of this.enemies) {
            if (!e.alive || e.rise < 1) continue;
            if (Math.abs(e.x - s.x) < e.r + s.r && Math.abs(e.z - s.z) < e.r + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) { done = true; this.shotImpact(s, e, 0, 0, 0); break; }
          }
        } else {
          const p = this.p;
          if (!p.dead && Math.abs(p.x - s.x) < p.r + s.r && Math.abs(p.z - s.z) < p.r + s.r && s.y > p.y - s.r && s.y < p.y + p.h + s.r) { done = true; this.shotImpact(s, null, -1, -1, -1); }
          for (const a of this.allies) { if (done) break; if (Math.abs(a.x - s.x) < a.r + s.r && Math.abs(a.z - s.z) < a.r + s.r && s.y > a.y && s.y < a.y + a.h) { done = true; a.hp -= s.dmg * 0.8; a.flash = 0.1; this.view.sparks.burst(s.x, s.y, s.z, 6, 0.6, 1, 0.3, 3, 0.1, 0.3, 4); } }
          if (!done && this.arena.beacon && s.kind === "boulder" && Math.hypot(s.x - this.arena.beacon.x, s.z - this.arena.beacon.z) < 1.2 && s.y < this.arena.beacon.y + 4) { done = true; this.beaconHp -= s.dmg * 0.5; this.shotImpact(s, null, -2, -2, -2); }
        }
      }
      // trail
      if (!done) {
        const g = s.kind === "glob", rk = s.kind === "rocket", bo = s.kind === "boulder";
        this.view.sparks.flash(s.x, s.y, s.z, s.r * (bo ? 2.6 : 2.2), g ? 0.5 : rk ? 1 : bo ? 0.8 : 1, g ? 1 : rk ? 0.6 : bo ? 0.5 : 0.95, g ? 0.2 : rk ? 0.2 : bo ? 0.3 : 0.7, dt * 1.6);
        if (s.kind === "rocket" || s.kind === "boulder") this.view.debris.spawn(s.x, s.y, s.z, 0, 0.3, 0, s.kind === "boulder" ? 0.5 : 0.25, 0.6, 0.6, 0.62, 0.6, 1);
        if (s.kind === "boulder") this.view.debris.spawn(s.x, s.y, s.z, 0, 0, 0, 0.9, e2(this.view.blockAvg, B.ROCK, 0), e2(this.view.blockAvg, B.ROCK, 1), e2(this.view.blockAvg, B.ROCK, 2), dt * 1.5);
      }
      if (done || s.life <= 0) this.shots.splice(i, 1);
    }
  }
  private shotImpact(s: Shot, e: Enemy | null, bx: number, by: number, bz: number) {
    if (s.kind === "rocket") { this.explode(s.x, s.y, s.z, 2.4, s.dmg, true); return; }
    if (s.kind === "boulder") { this.explode(s.x, s.y, s.z, 1.9, s.dmg, false); return; }
    if (s.kind === "arrow") {
      if (e) this.damageEnemy(e, s.dmg, s.vx / 32, s.vz / 32, true);
      this.view.sparks.burst(s.x, s.y, s.z, 4, 1, 0.9, 0.6, 3, 0.06, 0.2, 4);
      return;
    }
    // a glob: splat
    this.view.sparks.burst(s.x, s.y, s.z, 8, 0.5, 1, 0.2, 4, 0.1, 0.35, 6);
    sfxAt("splat", s.x, s.y, s.z, { rate: 0.9 + Math.random() * 0.2 });
    if (bx === -1) this.hurtPlayer(s.dmg, s.x - s.vx, s.z - s.vz);
    void by; void bz;
  }

  // ------------------------------------------------------------------ pickups
  private dropAt(kind: PickupKind, x: number, y: number, z: number) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
    this.drops.push({ kind, x, y, z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 3, vz: Math.sin(a) * sp, t: Math.random() * 6, alive: true, settled: false, life: kind === "coin" ? 25 : 40 });
  }
  private updateDrops(dt: number) {
    const p = this.p, V = this.arena.vox;
    const mag = this.stats.magnet * (this.powers.has("magnet") ? 4 : 1);
    let dead = 0;
    for (const d of this.drops) {
      if (!d.alive) { dead++; continue; }
      d.t += dt;
      if (d.life !== Infinity) { d.life -= dt; if (d.life <= 0) { d.alive = false; continue; } }
      const dx = p.x - d.x, dy = p.y + 0.9 - d.y, dz = p.z - d.z, dist = Math.hypot(dx, dy, dz);
      if (!p.dead && this.mode === "play" && dist < mag + 1.2) {
        // pulled to the hero
        const k = Math.min(1, dt * (dist < mag ? 9 : 3));
        d.x += dx * k; d.y += dy * k; d.z += dz * k; d.settled = true;
        if (dist < 0.9) { d.alive = false; this.collect(d.kind, d.x, d.y, d.z); }
        continue;
      }
      if (!d.settled) {
        d.vy -= this.grav * dt;
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
        if (V.solidAt(Math.floor(nx), Math.floor(ny - 0.2), Math.floor(nz)) && d.vy < 0) { d.y = Math.floor(ny - 0.2) + 1.2; d.vy = 0; d.vx = 0; d.vz = 0; d.settled = true; }
        else { if (V.solidAt(Math.floor(nx), Math.floor(d.y), Math.floor(nz))) { d.vx = 0; d.vz = 0; } else { d.x = nx; d.z = nz; } d.y = ny; }
        if (d.y < -8) d.alive = false;
      } else if (!V.solidAt(Math.floor(d.x), Math.floor(d.y - 0.75), Math.floor(d.z))) d.settled = false; // the block under it broke
    }
    if (dead > 60) this.drops = this.drops.filter((d) => d.alive);
  }
  private collect(kind: PickupKind, x: number, y: number, z: number) {
    const p = this.p;
    switch (kind) {
      case "coin": this.addCoins(this.plan.mods.includes("gold") ? 2 : 1); sfx("coin", { rate: 0.95 + Math.random() * 0.15 }); this.view.sparks.burst(x, y, z, 3, 1, 0.85, 0.3, 2, 0.06, 0.25, 0); return;
      case "gem": this.addCoins(10); sfx("gem"); break;
      case "oil": p.oil = Math.min(p.maxOil, p.oil + p.maxOil * 0.45); this.lowOilSaid = false; sfx("oil"); break;
      case "heart": this.lives = Math.min(9, this.lives + 1); this.o.onLives(this.lives); sfx("heart"); break;
      case "health": p.hp = Math.min(p.maxHp, p.hp + 35); sfx("health"); break;
      case "power": {
        const pool = POWER_IDS.filter((id) => !(id === "ally" && this.allies.filter((a) => a.life !== Infinity).length >= 2));
        const id = pool[Math.floor(this.rng() * pool.length)];
        this.givePower(id);
        break;
      }
    }
    this.view.sparks.burst(x, y, z, 10, 1, 1, 0.8, 4, 0.1, 0.4, 0);
    this.o.onEvent({ k: "pickup", what: kind });
  }
  givePower(id: PowerId) {
    this.powers.set(id, POWERS[id].secs);
    sfx(id === "shield" ? "shield" : id === "ally" ? "ally" : "power");
    if (id === "ally") {
      const kinds: Ally["kind"][] = ["archer", "knight", "brawler"];
      const k = kinds[Math.floor(this.rng() * 3)];
      const a = Math.random() * Math.PI * 2;
      this.addAlly(k, clamp(this.p.x + Math.cos(a) * 1.5, 1, this.arena.size - 1), this.p.y + 0.5, clamp(this.p.z + Math.sin(a) * 1.5, 1, this.arena.size - 1), POWERS.ally.secs);
      this.view.sparks.burst(this.p.x, this.p.y + 1, this.p.z, 20, 0.7, 0.5, 1, 5, 0.14, 0.6, -2);
    }
    this.o.onEvent({ k: "power", id });
  }
  private addCoins(n: number) { this.coins += n; this.o.onCoins(this.coins); }
  private updatePowers(dt: number) {
    for (const [id, left] of this.powers) { const l = left - dt; if (l <= 0) { this.powers.delete(id); if (id === "shield") sfx("shieldPop"); } else this.powers.set(id, l); }
    this.streakT -= dt; if (this.streakT <= 0) this.streak = 0;
  }

  // ------------------------------------------------------------------ waves and goals
  private spawning(dt: number) {
    const g = this.plan.goal;
    this.spawnCd -= dt;
    if (this.spawnCd > 0) return;
    const alive = this.enemies.reduce((n, e) => n + (e.alive && e.kind !== "golem" ? 1 : 0), 0);
    let cap = this.cap();
    if (g === "boss") cap = Math.min(cap, 4);
    if (g === "hold") cap = Math.round(cap * (0.6 + 0.6 * (1 - this.holdLeft / this.plan.goalCount)));
    if (alive >= cap) { this.spawnCd = 0.5; return; }
    if (g === "clear" && this.spawned >= this.plan.goalCount) return;
    let x: number, z: number;
    if (g === "totems") {
      const live = this.arena.totems.filter((t) => t.alive);
      if (!live.length) return;
      const t = live[Math.floor(this.rng() * live.length)];
      const a = this.rng() * Math.PI * 2;
      x = t.x + Math.cos(a) * 2.6; z = t.z + Math.sin(a) * 2.6;
    } else {
      // the rift furthest from the hero (so nothing appears right on top of you)
      const rs = this.arena.rifts;
      let r = rs[0], bd = -1;
      for (const c of rs) { const d = Math.hypot(c.x - this.p.x, c.z - this.p.z) + this.rng() * 8; if (d > bd) { bd = d; r = c; } }
      x = r.x + (this.rng() - 0.5) * 3; z = r.z + (this.rng() - 0.5) * 3;
    }
    x = clamp(x, 1, this.arena.size - 1.5); z = clamp(z, 1, this.arena.size - 1.5);
    if (g === "boss" && this.boss && !this.boss.alive) return;
    this.spawnEnemy(this.pickKind(), x, z);
    this.spawned++;
    const d = this.plan.difficulty;
    this.spawnCd = (this.stageTime < 4 && d > 0.35 ? 0.7 : 2.4 - d * 1.3) * (g === "boss" ? 2.5 : 1) * (this.plan.mods.includes("swarm") ? 0.6 : 1);
  }
  private goals(dt: number) {
    if (this.won) return;
    const g = this.plan.goal, A = this.arena;
    this.goalTick -= dt;
    const tick = this.goalTick <= 0;
    if (tick) this.goalTick = 0.25;
    let win = false;
    switch (g) {
      case "clear": if (this.kills >= this.plan.goalCount) { win = true; const last = this.lastDeadEnemy(); if (last) this.focus.set(last.x, last.y + 1, last.z); } break;
      case "totems": if (tick) {
        for (const t of A.totems) {
          if (!t.alive) continue;
          let any = false;
          for (let k = 0; k < t.cores.length; k += 3) if (A.vox.get(t.cores[k], t.cores[k + 1], t.cores[k + 2]) === B.CORE) { any = true; break; }
          if (!any) {
            t.alive = false;
            const left = A.totems.filter((x) => x.alive).length;
            this.o.onEvent({ k: "totem", left });
            this.focus.set(t.x, t.y + 4, t.z);
            this.view.sparks.burst(t.x, t.y + 5, t.z, 30, 1, 0.3, 1, 8, 0.2, 0.8, 2);
            // the rest of the totem crumbles
            const cells: number[] = [];
            for (let y = Math.floor(t.y); y < Math.floor(t.y) + 12; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
              const bx = Math.floor(t.x) + dx, bz = Math.floor(t.z) + dz, id = A.vox.get(bx, y, bz);
              if (id === B.GLOOM && A.vox.damage(bx, y, bz, 99)) { this.blockBroken(bx, y, bz, id, 0, 0, true); cells.push(bx, y, bz); }
            }
            this.topple(cells, 0, 0);
            sfx("coreBreak", { rate: 0.7 });
          }
        }
        if (A.totems.every((t) => !t.alive)) win = true;
      } break;
      case "wreck": if (tick && A.fortress) {
        const f = A.fortress; let left = 0;
        for (let y = 1; y < A.vox.Y; y++) for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) { const id = A.vox.data[A.vox.idx(x, y, z)]; if (id === B.GLOOM || id === B.CORE) left++; }
        this.wreck = 1 - left / Math.max(1, f.total);
        if (this.wreck >= this.plan.goalCount / 100) { win = true; this.focus.set((f.x0 + f.x1) / 2, 6, (f.z0 + f.z1) / 2); }
      } break;
      case "hold":
        this.holdLeft = Math.max(0, this.holdLeft - dt);
        if (this.beaconHp <= 0) { this.beaconLost(); return; }
        if (this.holdLeft <= 0) { win = true; if (A.beacon) this.focus.set(A.beacon.x, A.beacon.y + 2, A.beacon.z); }
        break;
      case "rescue": if (tick) {
        for (const c of A.cages) {
          if (c.freed) continue;
          let solid = 0;
          for (let y = c.y; y < c.y + 2; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; if (A.vox.get(c.x + dx, y, c.z + dz)) solid++; }
          const lock = A.vox.get(c.x, c.y + 3, c.z) === B.CORE;
          if (solid <= 13 || !lock) {
            c.freed = true;
            const ally = this.allies.find((a) => a.cage === c);
            if (ally) { ally.cheer = 1.5; ally.life = Infinity; }
            this.o.onEvent({ k: "freed", ally: c.ally });
            sfx("freed");
            this.view.sparks.burst(c.x + 0.5, c.y + 1.5, c.z + 0.5, 24, 1, 0.9, 0.4, 6, 0.14, 0.7, -2);
          }
        }
        if (A.cages.every((c) => c.freed)) { win = true; const c = A.cages[A.cages.length - 1]; if (c) this.focus.set(c.x, c.y + 1, c.z); }
      } break;
      case "boss": if (this.boss && !this.boss.alive) win = true; break;
    }
    if (win) this.win();
  }
  private lastDeadEnemy() { for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].alive) return this.enemies[i]; return null; }
  private beaconLost() {
    this.o.onEvent({ k: "beaconLost" });
    this.lostLife = true;
    this.lives = Math.max(0, this.lives - 1);
    this.o.onLives(this.lives);
    this.p.dead = true;
    this.mode = "down"; this.modeT = 0;
    if (this.lives <= 0) this.o.onEvent({ k: "outOfLives" });
  }
  private win() {
    this.won = true;
    this.mode = "clear"; this.modeT = 0;
    this.firing = false;
    if (this.pointerLocked) document.exitPointerLock?.();
    this.slow(0.22, 1.1);
    sfx("clear");
    // whatever is left vanishes
    setTimeout(() => {
      for (const e of this.enemies) if (e.alive) { e.alive = false; this.view.debris.burst(e.x, e.y + e.h / 2, e.z, 6, e.color[0], e.color[1], e.color[2], 3, 0.14); this.view.sparks.burst(e.x, e.y + 1, e.z, 6, 1, 1, 1, 3, 0.1, 0.4, -1); }
    }, 900);
    const time = this.stageTime;
    const bonus = 15 + Math.floor(this.stage / 4) + (this.plan.goal === "boss" ? 60 : 0) + (this.plan.finale ? 150 : 0);
    this.addCoins(bonus);
    const stars = this.lostLife ? 1 : this.p.hp > this.p.maxHp * 0.5 ? 3 : 2;
    const worldDone = !this.plan.remix && this.plan.local === STAGES_PER_WORLD;
    this.o.onEvent({ k: "clear", stats: { stage: this.stage, kills: this.kills, blocks: this.blocksBroken, coins: this.coins - this.coinsAtStart, time, stars, bonus, boss: this.plan.goal === "boss", worldDone } });
  }
  private slow(scale: number, secs: number) { this.slowTarget = scale; this.slowT = secs; }

  /** the stage's mode changes over time: intro → play, clear → victory → the next island, down → respawn */
  private flow() {
    const t = this.modeT;
    if (this.mode === "intro" && t > (this.plan.goal === "boss" ? 4.6 : 3.4)) {
      this.mode = "play"; this.modeT = 0;
      this.o.onEvent({ k: "go" }); sfx("go");
      if (this.plan.goal === "boss") { this.o.onEvent({ k: "boss", name: this.plan.bossName }); }
      if (this.plan.mods.length) this.o.onEvent({ k: "hint", text: this.plan.mods.map((m) => MOD_LABEL[m]).join(" · ") });
    }
    if (this.mode === "clear" && t > 4.2) { this.mode = "travel"; this.modeT = 0; sfx("whoosh"); }
    if (this.mode === "travel" && t > 1.1) this.load(this.stage + 1, "intro", true);
    if (this.mode === "down" && t > 1.8) {
      if (this.lives <= 0) { this.lives = 3; this.o.onLives(3); this.load(this.stage, "intro"); return; }
      if (this.plan.goal === "hold" && this.beaconHp <= 0) { this.load(this.stage, "intro"); return; }
      const sp = this.arena.spawn, p = this.p;
      Object.assign(p, { x: sp.x, y: this.arena.vox.top(sp.x, sp.z) + 0.01, z: sp.z, vx: 0, vy: 0, vz: 0, hp: p.maxHp, dead: false, inv: 0 });
      this.powers.set("shield", 3);
      this.mode = "play"; this.modeT = 0;
      this.camYaw = 0;
    }
  }

  // ------------------------------------------------------------------ the camera
  private placeCameraNow() { this.cameraPose(this.camPos, this.camLook); this.view.camera.position.copy(this.camPos); this.view.camera.lookAt(this.camLook); }
  /** the over-the-shoulder camera (pulled in when a wall is behind) */
  private cameraPose(pos: THREE.Vector3, look: THREE.Vector3) {
    const p = this.p, yaw = this.camYaw, pitch = this.camPitch;
    const { w, h } = this.view.size;
    const portrait = h > w;
    const dist = portrait ? 4.9 : 4.1, sh = portrait ? 0.5 : 0.85;
    const dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const px = p.x + rx * sh, py = p.y + 1.55 + p.stepY, pz = p.z + rz * sh;
    let d = dist;
    // keep the camera out of the blocks
    const bx = -dx, by = -dy + 0.12, bz = -dz, bl = Math.hypot(bx, by, bz);
    if (this.arena.vox.raycast(px, py, pz, bx / bl, by / bl, bz / bl, dist + 0.3, HIT)) d = Math.max(0.6, HIT.t - 0.35);
    this.camDist = d;
    pos.set(px - dx * d, py - dy * d + 0.12 * (d / dist) + 0.15, pz - dz * d);
    look.set(pos.x + dx, pos.y + dy, pos.z + dz);
  }
  /** art and checks: a fixed camera (position, then the point it looks at) */
  photoCam: [number, number, number, number, number, number] | null = null;
  private updateCamera(dt: number) {
    const cam = this.view.camera, A = this.arena, t = this.modeT;
    if (this.photoCam) { const c = this.photoCam; cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]); return; }
    const cx = A.center.x, cz = A.center.z, S = A.size;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    switch (this.mode) {
      case "attract": {
        // a slow orbit high over the island
        const a = this.view.t * 0.06 + 0.6, r = S * 0.85;
        this.camPos.set(cx + Math.sin(a) * r, 16 + S * 0.22, cz + Math.cos(a) * r);
        this.camLook.set(cx, 4, cz);
        cam.position.lerp(this.camPos, Math.min(1, dt * 2));
        cam.lookAt(this.camLook);
        return;
      }
      case "intro": {
        // a sweeping fly-over that lands behind the hero (bosses get a close-up on the way)
        const dur = this.plan.goal === "boss" ? 4.6 : 3.4;
        const k = smooth(Math.min(1, t / dur));
        this.cameraPose(_v, _v2);
        const a = lerp(Math.PI * 1.15, 0, k), r = lerp(S * 0.75, 8, k), hgt = lerp(S * 0.55, 5, k);
        const ox = cx + Math.sin(a) * r, oz = cz - Math.cos(a) * r * 0.9, oy = hgt;
        let lx = cx, ly = 3, lz = cz;
        if (this.boss && t > 1.4 && t < 3.4) { const kb = smooth(Math.min(1, (t - 1.4) / 0.6)) * (1 - smooth(Math.max(0, (t - 2.8) / 0.6))); lx = lerp(cx, this.boss.x, kb); ly = lerp(3, this.boss.y + this.boss.h * 0.7, kb); lz = lerp(cz, this.boss.z, kb); if (t > 1.9 && t < 1.95) { sfx("bossRoar"); this.shake = 0.5; } }
        const blend = smooth(clamp((k - 0.62) / 0.38, 0, 1));
        let px = ox, py = oy, pz = oz;
        if (this.boss && t > 1.2 && t < 3.6) {
          const kb = smooth(Math.min(1, (t - 1.2) / 0.7)) * (1 - smooth(Math.max(0, (t - 3.0) / 0.6)));
          const b = this.boss, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
          px = lerp(ox, b.x + fx * 9 + fz * 2, kb); py = lerp(oy, b.y + b.h * 0.75, kb); pz = lerp(oz, b.z + fz * 9 - fx * 2, kb);
        }
        cam.position.set(lerp(px, _v.x, blend), lerp(py, _v.y, blend), lerp(pz, _v.z, blend));
        this.camLook.set(lerp(lx, _v2.x, blend), lerp(ly, _v2.y, blend), lerp(lz, _v2.z, blend));
        cam.lookAt(this.camLook);
        this.camPos.copy(cam.position);
        return;
      }
      case "clear": {
        // slow-motion kill cam around the last hit, then a victory orbit around the hero
        if (t < 1.3) {
          const a = t * 0.9 + this.camYaw + Math.PI * 0.75;
          _v.set(this.focus.x + Math.sin(a) * 7, this.focus.y + 3, this.focus.z + Math.cos(a) * 7);
          cam.position.lerp(_v, Math.min(1, dt * 3));
          cam.lookAt(this.focus);
        } else {
          const k = t - 1.3, a = this.camYaw + 0.45 + k * 0.55;
          _v.set(this.p.x + Math.sin(a) * 3.8, this.p.y + 1.6, this.p.z + Math.cos(a) * 3.8);
          cam.position.lerp(_v, Math.min(1, dt * 4));
          _v2.set(this.p.x, this.p.y + 1.25, this.p.z);
          cam.lookAt(_v2);
        }
        return;
      }
      case "travel": {
        // up into the sky
        _v.set(cam.position.x, cam.position.y + dt * (14 + t * 40), cam.position.z);
        cam.position.copy(_v);
        _v2.set(this.p.x, this.p.y, this.p.z);
        cam.lookAt(_v2);
        return;
      }
      case "down": {
        _v.set(this.p.x + Math.sin(this.camYaw + Math.PI) * 6, this.p.y + 4 + t * 2, this.p.z + Math.cos(this.camYaw + Math.PI) * 6);
        cam.position.lerp(_v, Math.min(1, dt * 2));
        _v2.set(this.p.x, this.p.y + 0.5, this.p.z);
        cam.lookAt(_v2);
        return;
      }
      default: {
        this.cameraPose(this.camPos, this.camLook);
        cam.position.copy(this.camPos);
        if (this.shake > 0) { const s = this.shake * this.shake * 0.25; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s; }
        cam.lookAt(this.camLook);
      }
    }
  }

  // ------------------------------------------------------------------ drawing actors
  private drawActors() {
    const v = this.view;
    for (const b of this.batches.values()) b.begin();
    v.beginShadows();
    const t = v.t;
    // the hero
    if (this.hero) {
      this.hero.begin();
      const p = this.p, hp = this.heroPose;
      if (!p.dead) {
        hp.x = p.x; hp.y = p.y; hp.z = p.z; hp.yaw = p.yaw; hp.scale = 1; hp.bob = 0; hp.squash = 1;
        const cheer = this.mode === "clear" && this.modeT > 1.2 ? 1 : 0;
        const aim = this.mode === "play" || this.mode === "intro" ? this.camPitch : this.mode === "attract" ? -0.3 : null;
        poseHuman(hp, "hero", p.walk, p.walkAmt, cheer ? null : aim, 0, cheer, t);
        const f = p.hurt > 0 ? 1 + p.hurt * 4 : 1;
        hp.r = f * (p.hurt > 0 ? 1.4 : 1); hp.g = f * (p.hurt > 0 ? 0.6 : 1); hp.b = f * (p.hurt > 0 ? 0.6 : 1);
        if (this.powers.has("shield")) { const s = 1.2 + Math.sin(t * 12) * 0.2; hp.r *= 0.8; hp.g *= s; hp.b *= s * 1.2; }
        this.hero.push(hp);
        v.shadow(p.x, v.plan ? this.arena.vox.floorBelow(p.x, p.y + 0.5, p.z) : p.y, p.z, 0.45);
      }
      this.hero.end();
    }
    // monsters
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const b = this.batches.get(e.rig); if (!b) continue;
      const P = e.pose;
      const rise = smooth(e.rise);
      P.x = e.x; P.y = e.y - (1 - rise) * e.h; P.z = e.z; P.yaw = e.yaw; P.scale = e.scale * (0.4 + 0.6 * rise); P.bob = 0; P.squash = 1;
      if (e.kind === "batbit") poseBat(P, e.t);
      else if (e.kind === "cubeling") poseCube(P, e.onGround ? 0 : clamp(0.5 - e.vy / 20, 0, 1));
      else if (e.kind === "fusebug") poseBug(P, e.walk, e.walkAmt, e.fuse);
      else {
        const arms = e.kind === "grumbler" ? -1.25 : e.kind === "spitter" ? -0.6 : null;
        poseHuman(P, e.rig, e.walk, e.walkAmt, null, e.atk, 0, t);
        if (arms !== null && e.atk <= 0) { const parts = RIGS[e.rig].parts; for (let i = 0; i < parts.length; i++) if (parts[i].role === "armL" || parts[i].role === "armR") P.rot[i * 3] = arms + Math.sin(e.walk + i) * 0.15; }
      }
      const fl = e.flash > 0 ? 3.2 : e.fuse > 0 && Math.sin(e.fuse * 30) > 0 ? 2.2 : 1;
      P.r = fl; P.g = fl; P.b = fl;
      b.push(P);
      if (e.kind !== "batbit") v.shadow(e.x, e.y, e.z, e.r * 1.2 * rise);
      else v.shadow(e.x, this.arena.vox.floorBelow(e.x, e.y, e.z), e.z, 0.3);
    }
    // friends
    for (const a of this.allies) {
      const b = this.batches.get(a.kind); if (!b) continue;
      const P = a.pose;
      P.x = a.x; P.y = a.y; P.z = a.z; P.yaw = a.yaw; P.scale = 1; P.bob = 0; P.squash = 1;
      poseHuman(P, a.kind, a.walk, a.walkAmt, a.kind === "archer" && a.atk > 0 ? 0 : null, a.kind === "archer" ? 0 : a.atk, a.cheer > 0 ? 1 : 0, t + a.maxHp);
      const fl = a.flash > 0 ? 2.6 : 1; P.r = fl; P.g = fl; P.b = fl;
      b.push(P);
      v.shadow(a.x, a.y, a.z, 0.42);
    }
    for (const b of this.batches.values()) b.end();
    v.endShadows();
    // rifts shimmer
    if (this.mode === "play" || this.mode === "attract") {
      for (const r of this.arena.rifts) if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; this.view.sparks.spawn(r.x + Math.cos(a) * 1.2, this.arena.vox.top(r.x, r.z) + 0.2 + Math.random() * 2, r.z + Math.sin(a) * 1.2, -Math.cos(a) * 0.8, 0.6, -Math.sin(a) * 0.8, 0.1, 0.8, 0.3, 1, 0.8, 0.5, -0.5); }
      for (const tt of this.arena.totems) if (tt.alive && Math.random() < 0.4) this.view.sparks.spawn(tt.x + (Math.random() - 0.5) * 3, tt.y + Math.random() * 7, tt.z + (Math.random() - 0.5) * 3, 0, 0.8, 0, 0.08, 1, 0.3, 1, 0.9, 0.5, -0.3);
    }
  }

  // ------------------------------------------------------------------ the overlay: crosshair, hit marks, markers
  private drawOverlay(dt: number) {
    const c = this.ovx, W = this.ov.width, H = this.ov.height;
    c.clearRect(0, 0, W, H);
    this.hitMark -= dt; this.killMark -= dt; this.dmgT -= dt;
    if (this.mode !== "play") return;
    const p = this.p;
    // hurt: red edges
    const hpLow = p.hp / p.maxHp < 0.3 ? 0.25 + Math.sin(this.view.t * 5) * 0.1 : 0;
    const red = Math.max(hpLow, p.hurt > 0 ? p.hurt * 1.6 : 0);
    if (red > 0 && this.vignette) { c.globalAlpha = Math.min(1, red); c.drawImage(this.vignette, 0, 0); c.globalAlpha = 1; }
    const cx = W / 2, cy = H / 2;
    // where the last hit came from
    if (this.dmgT > 0) {
      const a = this.dmgDir - this.camYaw;
      c.save(); c.translate(cx, cy); c.rotate(-a + Math.PI);
      c.globalAlpha = Math.min(1, this.dmgT * 1.5);
      c.fillStyle = "#FF3B4E";
      c.beginPath(); c.moveTo(-18, -78); c.lineTo(18, -78); c.lineTo(0, -98); c.closePath(); c.fill();
      c.restore(); c.globalAlpha = 1;
    }
    // objective markers: totems, cages, the beacon, the boss
    const mark = (x: number, y: number, z: number, col: string, label: string) => {
      _v.set(x, y, z).project(this.view.camera);
      const behind = _v.z > 1;
      let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      if (behind) { sx = W - sx; sy = H - 30; }
      const m = 26;
      const off = sx < m || sx > W - m || sy < m + 70 || sy > H - m || behind;
      sx = clamp(sx, m, W - m); sy = clamp(sy, m + 70, H - m);
      c.fillStyle = col; c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sx, sy - 9); c.lineTo(sx + 8, sy); c.lineTo(sx, sy + 9); c.lineTo(sx - 8, sy); c.closePath(); c.stroke(); c.fill();
      if (off || label) { c.font = "800 11px system-ui, sans-serif"; c.textAlign = "center"; c.lineWidth = 3; c.strokeText(label, sx, sy + 22); c.fillStyle = "#fff"; c.fillText(label, sx, sy + 22); }
    };
    const dist = (x: number, z: number) => `${Math.round(Math.hypot(x - p.x, z - p.z))} m`;
    for (const t of this.arena.totems) if (t.alive) mark(t.x, t.y + 9, t.z, "#FF5CE1", dist(t.x, t.z));
    for (const cg of this.arena.cages) if (!cg.freed) mark(cg.x + 0.5, cg.y + 4.5, cg.z + 0.5, "#FFD23F", dist(cg.x, cg.z));
    if (this.arena.beacon) mark(this.arena.beacon.x, this.arena.beacon.y + 5, this.arena.beacon.z, "#7CF5FF", "");
    if (this.arena.fortress && this.plan.goal === "wreck") { const f = this.arena.fortress; mark((f.x0 + f.x1) / 2, 12, (f.z0 + f.z1) / 2, "#FF5CE1", dist((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2)); }
    // monsters off screen: small arrows at the edge
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.rise < 1 || n > 8) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > 26) continue;
      _v.set(e.x, e.y + e.h, e.z).project(this.view.camera);
      if (_v.z < 1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1) continue;
      n++;
      const a = Math.atan2(e.x - p.x, e.z - p.z) - this.camYaw;
      const r = Math.min(W, H) * 0.36;
      const ax = cx - Math.sin(a) * r, ay = cy - Math.cos(a) * r;
      c.save(); c.translate(ax, ay); c.rotate(-a);
      c.globalAlpha = clamp(1.2 - d / 26, 0.3, 0.9);
      c.fillStyle = e.kind === "golem" ? "#FF5CE1" : "#FF6B5A";
      c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 4); c.lineTo(-7, 4); c.closePath(); c.fill();
      c.restore(); c.globalAlpha = 1;
    }
    // the crosshair
    const spread = 7 + (this.fireCd > -0.15 && (this.firing || this.aimOn) ? 4 : 0);
    const col = this.aimOn ? "#FF4F6A" : "#ffffff";
    c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 4; c.lineCap = "round";
    const seg = (x0: number, y0: number, x1: number, y1: number) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    for (const pass of [0, 1]) {
      if (pass) { c.strokeStyle = col; c.lineWidth = 2; }
      seg(cx - spread - 7, cy, cx - spread, cy); seg(cx + spread, cy, cx + spread + 7, cy); seg(cx, cy - spread - 7, cx, cy - spread); seg(cx, cy + spread, cx, cy + spread + 7);
    }
    c.fillStyle = col; c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    if (this.hitMark > 0 || this.killMark > 0) {
      const k = this.killMark > 0 ? 1.4 : 1;
      c.strokeStyle = this.killMark > 0 ? "#FFD23F" : "#ffffff"; c.lineWidth = 2.5;
      const a = 6 * k, b = 13 * k;
      seg(cx - b, cy - b, cx - a, cy - a); seg(cx + b, cy - b, cx + a, cy - a); seg(cx - b, cy + b, cx - a, cy + a); seg(cx + b, cy + b, cx + a, cy + a);
    }
    if (!this.touch && !this.pointerLocked) {
      c.font = "800 13px system-ui, sans-serif"; c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.85)";
      c.fillText("Click to aim with the mouse", cx, cy + 46);
    }
  }

  // ------------------------------------------------------------------ HUD
  private emitHud(force = false) {
    void force;
    const pl = this.plan, p = this.p;
    let goalText = "", progress = 0;
    switch (pl.goal) {
      case "clear": goalText = `Monsters ${Math.min(this.kills, pl.goalCount)}/${pl.goalCount}`; progress = this.kills / pl.goalCount; break;
      case "totems": { const left = this.arena.totems.filter((t) => t.alive).length, all = this.arena.totems.length || 1; goalText = `Totems ${all - left}/${all}`; progress = (all - left) / all; break; }
      case "wreck": goalText = `Fortress ${Math.round(Math.min(1, this.wreck / (pl.goalCount / 100)) * 100)}%`; progress = this.wreck / (pl.goalCount / 100); break;
      case "hold": goalText = `Hold ${Math.ceil(this.holdLeft)}s`; progress = 1 - this.holdLeft / pl.goalCount; break;
      case "rescue": { const f = this.arena.cages.filter((c) => c.freed).length, all = this.arena.cages.length || 1; goalText = `Freed ${f}/${all}`; progress = f / all; break; }
      case "boss": goalText = pl.bossName; progress = this.boss ? 1 - this.boss.hp / this.boss.maxHp : 0; break;
    }
    const w = this.world;
    this.o.onHud({
      stage: this.stage, title: pl.title, subtitle: pl.subtitle, world: pl.blend ? `${w.name} × ${WORLDS.find((x) => x.id === pl.blend)!.name}` : w.name, accent: w.accent, remix: pl.remix, mods: pl.mods.map((m) => MOD_LABEL[m]),
      goal: pl.goal, goalText, progress: clamp(progress, 0, 1),
      hp: Math.max(0, p.hp), maxHp: p.maxHp, oil: p.oil / p.maxOil, lowOil: p.oil / p.maxOil < 0.2, coins: this.coins, lives: this.lives,
      powers: [...this.powers].map(([id, left]) => ({ id, left, secs: POWERS[id].secs })),
      boss: this.boss && this.boss.alive ? { name: pl.bossName, hp: this.boss.hp / this.boss.maxHp } : null,
      beacon: this.arena.beacon ? Math.max(0, this.beaconHp) / 100 : null, holdLeft: pl.goal === "hold" ? this.holdLeft : null,
      mode: this.mode, allies: this.allies.filter((a) => !a.cage || a.cage.freed).length, finale: pl.finale,
    });
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.view.renderer.domElement.removeEventListener("mousedown", this.onMouseDown);
    for (const b of this.batches.values()) b.dispose();
    this.batches.clear();
    this.hero?.dispose(); this.hero = null;
    this.view.dispose();
    this.ov.remove();
    const w = window as unknown as { __blockstorm?: Game };
    if (w.__blockstorm === this) delete w.__blockstorm;
  }
}

/** ray vs box: the distance along the ray where it enters the box, or -1 */
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  let tmin = 0, tmax = 1e9;
  const slab = (o: number, d: number, lo: number, hi: number) => {
    if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(ox, dx, x0, x1) || !slab(oy, dy, y0, y1) || !slab(oz, dz, z0, z1)) return -1;
  return tmin;
}
const e2 = (a: Float32Array, id: number, k: number) => a[id * 3 + k];
