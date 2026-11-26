// Cube Clash: the game itself — a third-person blocky shooter with building. You run, jump (hold jump in the air for
// the jetpack, which burns oil), shoot your cube blaster (it breaks blocks and knocks people back) and place cubes
// (bridge across gaps, wall yourself in). Every stage is one of:
// - Sky Clash: rivals on their own islands bridge toward you and shoot; knock them into the void or blast them down;
// - Crystal Clash: teams of bots; break the enemy crystals, guard your own — a team without a crystal can't come back;
// - Zombie Night: waves of shamblers, jelly hoppers and wisps pour through the village gates;
// - Obby Run: a parkour course with jump pads, lava, ice, crumbling clouds and targets you shoot to build bridges;
// - Titan Fight: a giant that stomps (and can knock you off the arena), throws boulders and calls its mobs.
// No menus between stages: cinematic fly-over → play → the win → slow-motion → a victory orbit → up into the sky → the
// next map → "Stage N started!" → play, forever. Coming back later starts the stage you were on.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import { autoQuality, isPhone } from "@/lib/perf";
import { B, BLOCKS, TEAM_COLORS, TEAM_CUBE, unbreakable } from "./blocks";
import { buildMap, type Crystal, type GameMap, type PickupKind } from "./gen";
import { POWERS, POWER_IDS, statsFor, type Levels, type PowerId, type Stats } from "./gear";
import { OUTFITS, newPose, poseHopper, poseHuman, poseWisp, RigBatch, RIGS, rivalLook, type Pose, type RigKind } from "./rigs";
import { Ambience, ear, sfx, sfxAt, type ClashSfx } from "./sound";
import { BOT_NAMES, MODE_LABEL, MOD_LABEL, stagePlan, type StagePlan } from "./stages";
import { View } from "./render";
import { STAGES_PER_THEME, THEMES, type Theme } from "./worlds";
import { angleTo, clamp, damp, lerp, makeRng, mix, rgb, smooth, type Rng } from "./util";
import type { RayHit } from "./voxels";

export type Phase = "attract" | "intro" | "play" | "clear" | "down" | "travel";
export interface Hud {
  stage: number; title: string; subtitle: string; theme: string; accent: string; remix: boolean; mods: string[]; modeLabel: string;
  goalText: string; progress: number; hp: number; maxHp: number; oil: number; cubes: number; coins: number; lives: number;
  powers: { id: PowerId; left: number; secs: number }[]; boss: { name: string; hp: number } | null;
  crystals: { team: number; hp: number; alive: boolean }[] | null; phase: Phase; finale: boolean;
}
export interface StageStats { stage: number; kos: number; coins: number; time: number; stars: number; bonus: number; worldDone: boolean; mode: StagePlan["mode"] }
export type GameEvent =
  | { k: "intro"; plan: StagePlan; next: boolean } | { k: "go" } | { k: "clear"; stats: StageStats }
  | { k: "lifeLost"; livesLeft: number; why: string } | { k: "outOfLives" } | { k: "failed"; why: string }
  | { k: "elim"; name: string; by: "you" | "void" | "other"; left: number } | { k: "crystal"; team: number; mine: boolean }
  | { k: "wave"; n: number; of: number } | { k: "checkpoint" } | { k: "titan"; name: string } | { k: "pickup"; what: PickupKind }
  | { k: "power"; id: PowerId } | { k: "noCubes" } | { k: "lowOil" } | { k: "hint"; text: string } | { k: "streak"; n: number };

interface Opts {
  levels: Levels; outfit: string; lives: number; coins: number; autoFire: boolean; sens: number;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void; onCoins: (n: number) => void; onLives: (n: number) => void;
}
interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; h: number; onGround: boolean; yaw: number; bx: boolean; bz: boolean }
interface Rival extends Body {
  id: number; name: string; team: number; batch: RigBatch; pose: Pose; hp: number; maxHp: number; alive: boolean; out: boolean; respawn: number;
  walk: number; walkAmt: number; fireCd: number; think: number; placeCd: number; cubes: number; strafe: number; flash: number; role: "attack" | "defend";
  gx: number; gy: number; gz: number; target: Rival | null; targetPlayer: boolean; targetCrystal: Crystal | null; aimP: number; jumpT: number; home: { x: number; y: number; z: number }; knockT: number; axis: number; stuck: number; detour: number; detourDir: number; climb: number;
}
type MobKind = "shambler" | "hopper" | "wisp" | "titan";
interface Mob extends Body {
  kind: MobKind; hp: number; maxHp: number; alive: boolean; pose: Pose; walk: number; walkAmt: number; atk: number; atkCd: number; flash: number;
  hopCd: number; t: number; rise: number; speed: number; dmg: number; coins: number; scale: number; color: [number, number, number]; throwCd: number; callCd: number;
}
interface Shot { x: number; y: number; z: number; vx: number; vy: number; vz: number; kind: "bolt" | "orb" | "boulder" | "rocket"; team: number; dmg: number; knock: number; r: number; life: number; grav: number; mine: boolean }
interface Drop { kind: PickupKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; alive: boolean; settled: boolean; life: number }

const MOB: Record<MobKind, { hp: number; speed: number; dmg: number; coins: number; base: string }> = {
  shambler: { hp: 40, speed: 2.4, dmg: 8, coins: 2, base: "#7CC46C" },
  hopper: { hp: 28, speed: 3.2, dmg: 6, coins: 1, base: "#5EE07A" },
  wisp: { hp: 22, speed: 3.4, dmg: 7, coins: 2, base: "#7CC8FF" },
  titan: { hp: 1400, speed: 1.7, dmg: 22, coins: 60, base: "#8A9478" },
};
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3();
const HIT: RayHit = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, t: 0, id: 0 };
/** keys the game uses (lower-case KeyboardEvent.key) */
const GAME_KEYS = new Set(["w", "a", "s", "d", " ", "shift", "e", "q", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

export class Game {
  readonly view: View;
  private host: HTMLElement;
  private o: Opts;
  private raf = 0; private last = 0; private running = false;
  stage = 1; plan!: StagePlan; theme!: Theme; map!: GameMap;
  phase: Phase = "attract";
  private phaseT = 0;
  private grav = 25;
  private hero: RigBatch | null = null; private outfit = "";
  private mobBatches = new Map<RigKind, RigBatch>();
  readonly p: Body & { hp: number; maxHp: number; oil: number; maxOil: number; cubes: number; inv: number; walk: number; walkAmt: number; hurt: number; dead: boolean; stepY: number; jetting: boolean } = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.75, onGround: false, yaw: 0, bx: false, bz: false,
    hp: 100, maxHp: 100, oil: 100, maxOil: 100, cubes: 32, inv: 0, walk: 0, walkAmt: 0, hurt: 0, dead: false, stepY: 0, jetting: false,
  };
  private heroPose = newPose("avatar");
  stats: Stats; private levels: Levels;
  coins: number; lives: number;
  private autoFire: boolean; private sens: number; private touch = isPhone();
  // input
  private mv = { x: 0, y: 0 }; private keys = new Set<string>();
  private firing = false; private building = false; private sprint = false; private jumpHeld = false; private wantJump = false;
  private fireCd = 0; private buildCd = 0;
  camYaw = 0; camPitch = -0.1;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camDist = 4;
  private shake = 0; private timeScale = 1; private slowTarget = 1; private slowT = 0;
  // world
  rivals: Rival[] = []; mobs: Mob[] = [];
  private shots: Shot[] = []; drops: Drop[] = [];
  private booms: { x: number; y: number; z: number; t: number; r: number; dmg: number; mine: boolean }[] = [];
  powers = new Map<PowerId, number>();
  private kos = 0; private coinsAtStart = 0; private lostLife = false; private stageTime = 0; private won = false;
  private wave = 0; private waveLeft = 0; private waveCd = 0; private spawnCd = 0; private checkpoint = { x: 0, y: 0, z: 0 };
  private titan: Mob | null = null; private focus = new THREE.Vector3(); private streak = 0; private streakT = 0;
  private crumbling = new Map<number, number>();
  private hudT = 0; private lowOilSaid = false; private calm = 0;
  private ambience = new Ambience();
  private rng: Rng = makeRng(1); private nextId = 1;
  private ov: HTMLCanvasElement; private ovx: CanvasRenderingContext2D; private vignette: HTMLCanvasElement | null = null;
  private hitMark = 0; private killMark = 0; private dmgDir = 0; private dmgT = 0; private aimOn = false;
  private ro: ResizeObserver;
  photoCam: [number, number, number, number, number, number] | null = null;

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
    // capture phase: Space is "jump" here, so the player shell's own Space-to-pause never sees it (P / Esc still pause)
    window.addEventListener("keydown", this.onKey, true); window.addEventListener("keyup", this.onKeyUp, true); window.addEventListener("blur", this.onBlur);
    window.addEventListener("message", this.onMsg);
    this.view.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    this.view.renderer.domElement.addEventListener("contextmenu", this.onContext);
    window.addEventListener("mouseup", this.onMouseUp); document.addEventListener("mousemove", this.onMouseMove);
    (window as unknown as { __cubeclash?: Game }).__cubeclash = this;
  }
  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.view.resize(w, h);
    this.ov.width = w; this.ov.height = h;
    this.view.camera.fov = h > w ? 76 : 62; this.view.camera.updateProjectionMatrix();
    const v = document.createElement("canvas"); v.width = w; v.height = h;
    const c = v.getContext("2d")!, g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(255,40,60,0)"); g.addColorStop(1, "rgba(255,40,60,0.75)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    this.vignette = v;
  }

  // ------------------------------------------------------------------ settings and input
  setLevels(l: Levels) { this.levels = l; const s = statsFor(l), k = this.p.hp / this.p.maxHp; this.stats = s; this.p.maxHp = s.hp; this.p.hp = Math.max(1, k * s.hp); this.p.maxOil = s.oil; }
  setOutfit(id: string) { if (id === this.outfit) return; this.outfit = id; this.hero?.dispose(); const o = OUTFITS.find((x) => x.id === id) ?? OUTFITS[0]; this.hero = new RigBatch("avatar", o.look, "#000", 1, 3); this.hero.addTo(this.view.scene); }
  setAutoFire(on: boolean) { this.autoFire = on; }
  setSens(v: number) { this.sens = v; }
  setMove(x: number, y: number) { this.mv.x = clamp(x, -1, 1); this.mv.y = clamp(y, -1, 1); }
  look(dx: number, dy: number, mouse = false) { if (this.phase !== "play") return; const k = (mouse ? 0.0024 : 0.0058) * this.sens; this.camYaw -= dx * k; this.camPitch = clamp(this.camPitch - dy * k, -1.1, 0.85); }
  setFire(on: boolean) { this.firing = on; }
  setBuild(on: boolean) { this.building = on; if (on) this.buildCd = 0; }
  setJump(on: boolean) { if (on && !this.jumpHeld) this.wantJump = true; this.jumpHeld = on; }
  skipIntro() { if (this.phase === "intro" && this.phaseT > 0.4) this.phaseT = 99; }
  /** keep the opening fly-over waiting at its end (the controls card is up) */
  setHoldIntro(on: boolean) { this.holdIntro = on; }
  /** aim with the mouse (call from a click or key press) */
  lockMouse() {
    if (this.touch || !this.running || this.pointerLocked) return;
    // newer browsers return a promise that rejects when the lock isn't allowed right now (the next click tries again)
    const r = this.view.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  }
  private holdIntro = false;
  /** a stage is on screen and running: the game's keys are the game's (not the page's or the player shell's) */
  private get ownsKeys() { return this.running && this.phase !== "attract"; }
  private keyDown(k: string) {
    this.keys.add(k);
    if (k === " " && this.phase === "play") this.setJump(true);
    if (k === "shift") this.sprint = true;
    if (k === "e" || k === "q") this.setBuild(true);
  }
  private keyUp(k: string) { this.keys.delete(k); if (k === " ") this.setJump(false); if (k === "shift") this.sprint = false; if (k === "e" || k === "q") this.setBuild(false); }
  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
    const k = e.key.toLowerCase();
    if (this.ownsKeys && GAME_KEYS.has(k)) {
      e.preventDefault(); // no page scroll, and Space doesn't press a focused button
      if (k === " ") e.stopPropagation();
    }
    if (!e.repeat) this.keyDown(k);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (this.ownsKeys && GAME_KEYS.has(k)) { e.preventDefault(); if (k === " ") e.stopPropagation(); }
    this.keyUp(k);
  };
  /** keys the game page passes in (focus was on the page around the game's frame) */
  private onMsg = (e: MessageEvent) => {
    const d = e.data as { type?: string; key?: string; down?: boolean } | null;
    if (e.origin !== window.location.origin || d?.type !== "momoblobs:key" || !d.key) return;
    const k = d.key.toLowerCase();
    if (d.down) this.keyDown(k); else this.keyUp(k);
  };
  private onBlur = () => { this.keys.clear(); this.firing = false; this.building = false; this.sprint = false; this.jumpHeld = false; };
  private mouseHeld = false;
  private onContext = (e: Event) => e.preventDefault();
  private onMouseDown = (e: MouseEvent) => {
    if (this.touch || this.phase !== "play") return;
    this.mouseHeld = true;
    this.lockMouse();
    if (e.button === 0) this.firing = true;
    if (e.button === 2) this.setBuild(true);
  };
  private onMouseUp = (e: MouseEvent) => { this.mouseHeld = false; if (this.touch) return; if (e.button === 0) this.firing = false; if (e.button === 2) this.setBuild(false); };
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
    const loop = (now: number) => { if (!this.running) return; const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now; this.frame(dt); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.firing = false; this.building = false; if (this.pointerLocked) document.exitPointerLock?.(); }

  // ------------------------------------------------------------------ stages
  load(n: number, phase: "attract" | "intro", next = false) {
    this.holdIntro = false;
    this.stage = n;
    this.plan = stagePlan(n);
    this.theme = THEMES[this.plan.themeIndex];
    this.map = buildMap(this.plan);
    this.view.setStage(this.plan, this.map);
    if (this.view.fallers) this.view.fallers.onImpact = this.onImpact;
    this.grav = this.theme.gravity * (this.plan.mods.includes("lowgrav") && this.theme.id !== "moon" ? 0.55 : 1);
    this.rng = makeRng(this.plan.seed + 7);
    for (const r of this.rivals) r.batch.dispose();
    for (const b of this.mobBatches.values()) b.dispose();
    this.rivals = []; this.mobs = []; this.mobBatches.clear();
    if (!this.hero) this.setOutfit(this.o.outfit);
    this.shots = []; this.booms = []; this.powers.clear(); this.crumbling.clear();
    this.drops = this.map.pickups.map((q) => ({ ...q, vx: 0, vy: 0, vz: 0, t: Math.random() * 6, alive: true, settled: true, life: Infinity }));
    this.kos = 0; this.coinsAtStart = this.coins; this.lostLife = false; this.won = false; this.stageTime = 0;
    this.wave = 0; this.waveLeft = 0; this.waveCd = 2.5; this.spawnCd = 0; this.titan = null; this.streak = 0; this.lowOilSaid = false;
    const sp = this.map.spawn, s = this.stats;
    Object.assign(this.p, { x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 0, hp: s.hp, maxHp: s.hp, oil: s.oil, maxOil: s.oil, cubes: s.cubes, inv: 0, dead: false, yaw: sp.yaw, stepY: 0 });
    this.checkpoint = { x: sp.x, y: sp.y, z: sp.z };
    this.camYaw = sp.yaw; this.camPitch = -0.1;
    // the cast
    const mode = this.plan.mode, d = this.plan.difficulty;
    if (mode === "sky") {
      for (let i = 1; i <= this.plan.rivals; i++) { const isle = this.map.isles[i + 1] ?? this.map.isles[0]; this.addRival(i, isle.x + 0.5, isle.y + 1.01, isle.z + 0.5, null, "attack"); }
    } else if (mode === "crystal") {
      for (let t = 0; t < this.plan.teams; t++) {
        const isle = this.map.isles[t + 1];
        const members = t === 0 ? this.plan.teamSize - 1 : this.plan.teamSize;
        const look = rivalLook(this.plan.seed + t * 101, TEAM_COLORS[t]);
        for (let m = 0; m < members; m++) this.addRival(t, isle.x + 0.5 + (m - 1) * 1.5, isle.y + 1.01, isle.z + 2.5, look, t === 0 ? (m % 2 ? "defend" : "attack") : (m === 0 && d > 0.4 ? "defend" : "attack"));
      }
    } else if (mode === "titan") {
      const c = this.map.center;
      const t = this.spawnMob("titan", c.x + 0.5, c.z + 9.5);
      if (t) { this.titan = t; t.rise = 1; t.yaw = Math.PI; }
    } else if (mode === "obby") {
      // wisps hover over parts of the course as moving hazards
      const n2 = Math.floor(d * 6);
      for (let i = 0; i < n2; i++) { const z = 16 + ((i + 1) / (n2 + 1)) * (this.map.vox.Z - 40); const m = this.spawnMob("wisp", this.map.vox.X / 2, z); if (m) { m.rise = 1; m.y = this.map.vox.top(m.x, m.z) + 3; } }
    }
    this.ambience.set(this.theme.ambient);
    this.phase = phase; this.phaseT = 0; this.timeScale = 1; this.slowTarget = 1;
    if (phase === "intro") { this.o.onEvent({ k: "intro", plan: this.plan, next }); sfx("stageStart"); }
    this.placeCameraNow();
    this.emitHud();
  }
  play() { if (this.phase === "attract") { this.phase = "intro"; this.phaseT = 0; this.o.onEvent({ k: "intro", plan: this.plan, next: false }); sfx("stageStart"); } }
  restartStage() { this.load(this.stage, "intro"); }

  private addRival(team: number, x: number, y: number, z: number, look: ReturnType<typeof rivalLook> | null, role: Rival["role"]) {
    const id = this.nextId++;
    const lk = look ?? rivalLook(this.plan.seed + id * 31, null);
    const batch = new RigBatch("avatar", lk, "#000", 1, id);
    batch.addTo(this.view.scene);
    const d = this.plan.difficulty;
    const hp = 100 * (1 + d * 0.8) * (this.plan.remix ? 1.1 : 1);
    const name = BOT_NAMES[(this.plan.seed + id * 7) % BOT_NAMES.length];
    this.rivals.push({
      x, y, z, vx: 0, vy: 0, vz: 0, r: 0.32, h: 1.75, onGround: false, yaw: Math.atan2(this.map.center.x - x, this.map.center.z - z), bx: false, bz: false,
      id, name, team, batch, pose: newPose("avatar"), hp, maxHp: hp, alive: true, out: false, respawn: 0, walk: 0, walkAmt: 0,
      fireCd: 2 + Math.random() * 2, think: Math.random() * 0.3, placeCd: 0, cubes: 48 + Math.round(d * 40), strafe: Math.random() < 0.5 ? -1 : 1, flash: 0, role,
      gx: x, gy: y, gz: z, target: null, targetPlayer: false, targetCrystal: null, aimP: 0, jumpT: 0, home: { x, y, z }, knockT: 0, axis: -1, stuck: 0, detour: 0, detourDir: 1, climb: 0,
    });
  }
  private spawnMob(kind: MobKind, x: number, z: number): Mob | null {
    const S = MOB[kind], d = this.plan.difficulty;
    const giants = this.plan.mods.includes("giants") && kind !== "titan";
    const scale = (giants ? 1.35 : 1) * (kind === "titan" && this.plan.finale ? 1.2 : 1);
    const hpMul = (1 + d * 1.3) * (giants ? 1.8 : 1) * (kind === "titan" ? (1 + d) * (this.plan.finale ? 1.5 : 1) : 1);
    const rk: RigKind = kind;
    if (!this.mobBatches.has(rk)) { const b = new RigBatch(rk, OUTFITS[0].look, this.theme.mobTint, kind === "titan" ? 1 : 24, this.plan.seed); b.addTo(this.view.scene); this.mobBatches.set(rk, b); }
    const def = RIGS[rk];
    const y = this.map.vox.top(x, z) + (kind === "wisp" ? 2.2 : 0.01);
    const c = rgb(mix(S.base, this.theme.mobTint, 0.35));
    const m: Mob = {
      x, y, z, vx: 0, vy: 0, vz: 0, r: def.radius * scale, h: def.height * scale, onGround: false, yaw: 0, bx: false, bz: false,
      kind, hp: S.hp * hpMul, maxHp: S.hp * hpMul, alive: true, pose: newPose(rk), walk: Math.random() * 6, walkAmt: 0, atk: 0, atkCd: 1, flash: 0,
      hopCd: Math.random(), t: Math.random() * 9, rise: 0, speed: S.speed * (1 + d * 0.3), dmg: S.dmg * (1 + d), coins: S.coins, scale, color: [c[0] / 255, c[1] / 255, c[2] / 255], throwCd: 5, callCd: 12,
    };
    this.mobs.push(m);
    this.view.sparks.burst(x, y + 0.5, z, 8, 0.6, 1, 0.5, 4, 0.12, 0.5, -2);
    return m;
  }

  /** move a body through the blocks: slides along walls, steps up one-block ledges, lands on tops */
  private moveBody(b: Body, dt: number, step: boolean) {
    const V = this.map.vox;
    b.bx = false; b.bz = false;
    let nx = b.x + b.vx * dt;
    if (V.boxHits(nx - b.r, b.y + 0.02, b.z - b.r, nx + b.r, b.y + b.h, b.z + b.r)) {
      if (step && b.onGround && !V.boxHits(nx - b.r, b.y + 1.02, b.z - b.r, nx + b.r, b.y + 1 + b.h, b.z + b.r) && !V.boxHits(b.x - b.r, b.y + 1.02, b.z - b.r, b.x + b.r, b.y + 1 + b.h, b.z + b.r)) {
        const ny = Math.floor(b.y + 0.02) + 1; if (b === (this.p as Body)) this.p.stepY -= ny - b.y; b.y = ny;
      } else { nx = b.x; b.vx = 0; b.bx = true; }
    }
    b.x = nx;
    let nz = b.z + b.vz * dt;
    if (V.boxHits(b.x - b.r, b.y + 0.02, nz - b.r, b.x + b.r, b.y + b.h, nz + b.r)) {
      if (step && b.onGround && !V.boxHits(b.x - b.r, b.y + 1.02, nz - b.r, b.x + b.r, b.y + 1 + b.h, nz + b.r) && !V.boxHits(b.x - b.r, b.y + 1.02, b.z - b.r, b.x + b.r, b.y + 1 + b.h, b.z + b.r)) {
        const ny = Math.floor(b.y + 0.02) + 1; if (b === (this.p as Body)) this.p.stepY -= ny - b.y; b.y = ny;
      } else { nz = b.z; b.vz = 0; b.bz = true; }
    }
    b.z = nz;
    const ny = b.y + b.vy * dt;
    if (V.boxHits(b.x - b.r, ny, b.z - b.r, b.x + b.r, ny + b.h, b.z + b.r)) {
      if (b.vy <= 0) { b.y = Math.floor(ny) + 1; b.onGround = true; } else b.y = Math.floor(ny + b.h) - b.h - 0.001;
      b.vy = 0;
    } else { b.y = ny; b.onGround = false; }
    if (V.boxHits(b.x - b.r, b.y + 0.05, b.z - b.r, b.x + b.r, b.y + b.h - 0.05, b.z + b.r)) b.y += Math.min(1, dt * 12);
  }
  /** the block under a body's feet */
  private under(b: Body) { return this.map.vox.get(Math.floor(b.x), Math.floor(b.y - 0.05), Math.floor(b.z)); }

  // ------------------------------------------------------------------ the frame
  frame(rawDt: number) {
    this.slowT -= rawDt; if (this.slowT <= 0) this.slowTarget = 1;
    this.timeScale = damp(this.timeScale, this.slowTarget, this.slowTarget < 1 ? 0.04 : 0.2, rawDt);
    const dt = rawDt * this.timeScale;
    this.phaseT += rawDt;
    if (this.phase === "play") this.stageTime += dt;
    this.updatePlayer(dt);
    for (const r of this.rivals) this.updateRival(r, dt);
    for (const m of this.mobs) if (m.alive) this.updateMob(m, dt);
    this.separate();
    this.updateShots(dt);
    this.updateDrops(dt);
    this.updateBooms(dt);
    this.updateCrumbles(dt);
    if (this.phase === "play") { this.waves(dt); this.goals(); this.updatePowers(dt); }
    this.flow();
    if (this.mobs.length > 50) this.mobs = this.mobs.filter((m) => m.alive);
    this.updateCamera(rawDt);
    const cam = this.view.camera;
    ear.x = cam.position.x; ear.y = cam.position.y; ear.z = cam.position.z;
    cam.getWorldDirection(_dir); ear.rx = -_dir.z; ear.rz = _dir.x;
    if (this.phase !== "attract") this.ambience.update(rawDt);
    this.view.sync(this.map, 3);
    this.drawActors();
    this.view.drawPickups(this.drops);
    this.view.render(dt, this.grav, this.map.vox);
    this.drawOverlay(rawDt);
    this.hudT -= rawDt;
    if (this.hudT <= 0) { this.hudT = 0.12; this.emitHud(); }
  }

  // ------------------------------------------------------------------ the player
  private updatePlayer(dt: number) {
    const p = this.p;
    p.inv -= dt; p.hurt -= dt; this.calm += dt;
    p.stepY = damp(p.stepY, 0, 0.06, dt);
    if (this.calm > 3.5 && !p.dead && p.hp < p.maxHp && this.phase === "play") p.hp = Math.min(p.maxHp, p.hp + dt * 8);
    const playing = this.phase === "play";
    if (p.dead || !(playing || this.phase === "intro" || this.phase === "clear")) {
      p.vx = damp(p.vx, 0, 0.1, dt); p.vz = damp(p.vz, 0, 0.1, dt); if (!p.dead) { p.vy -= this.grav * dt; this.moveBody(p, dt, false); } p.walkAmt = damp(p.walkAmt, 0, 0.1, dt);
      return;
    }
    let mx = this.mv.x, my = this.mv.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) mx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) mx += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) my += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) my -= 1;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (!playing) { mx = 0; my = 0; }
    const yaw = this.camYaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const fast = this.powers.has("speed") ? 1.35 : 1;
    const sp = ((this.sprint || (this.touch && ml > 0.92)) ? 7.2 : 5.1) * fast;
    const below = this.under(p);
    const ice = below === B.ICE;
    const wx = (fx * my + rx * mx) * sp, wz = (fz * my + rz * mx) * sp;
    const acc = p.onGround ? (ice ? 0.5 : 0.05) : 0.22;
    p.vx = damp(p.vx, wx, acc, dt); p.vz = damp(p.vz, wz, acc, dt);
    if (this.wantJump && p.onGround && playing) { p.vy = Math.sqrt(2 * this.grav * 1.3) * (this.powers.has("speed") ? 1.15 : 1); sfx("jump", { rate: 0.95 + Math.random() * 0.1 }); this.wantJump = false; }
    if (p.onGround) this.wantJump = false;
    // the jetpack: hold jump in the air
    p.jetting = false;
    if (playing && this.jumpHeld && !p.onGround && p.vy < 3.5) {
      if (p.oil > 0) {
        p.jetting = true; p.vy += (this.grav * 1.55) * dt; p.oil = Math.max(0, p.oil - dt * 26);
        if (Math.random() < dt * 40) this.view.sparks.spawn(p.x - fx * 0.3, p.y + 0.6, p.z - fz * 0.3, (Math.random() - 0.5) * 0.6, -3, (Math.random() - 0.5) * 0.6, 0.12, 1, 0.6, 0.2, 0.3, 1, 2);
        if (Math.random() < dt * 6) sfx("jet", { rate: 0.9 + Math.random() * 0.2 });
        if (p.oil / p.maxOil < 0.2 && !this.lowOilSaid) { this.lowOilSaid = true; this.o.onEvent({ k: "lowOil" }); }
      } else if (Math.random() < dt * 2) sfx("jetEmpty");
    }
    const wasAir = !p.onGround, vy0 = p.vy;
    p.vy -= this.grav * dt;
    this.moveBody(p, dt, true);
    if (wasAir && p.onGround && vy0 < -7) { sfx("land", { gain: Math.min(1, -vy0 / 14) }); this.view.debris.smoke(p.x, p.y, p.z, 3, 0.85, 0.35); }
    const spd = Math.hypot(p.vx, p.vz);
    p.walkAmt = damp(p.walkAmt, p.onGround ? Math.min(1, spd / 5) : 0.3, 0.08, dt); p.walk += spd * dt * 2.1;
    p.yaw = this.camYaw;
    // what you stand on
    if (playing && p.onGround) {
      const ub = this.under(p);
      if (ub === B.PAD) { p.vy = Math.sqrt(2 * this.grav * 6.5); sfx("pad"); this.view.sparks.burst(p.x, p.y, p.z, 12, 0.7, 1, 0.4, 5, 0.12, 0.5, 0); }
      else if (ub === B.LAVA) { this.hurtPlayer(35 * dt, p.x, p.z, true); p.vy = 5; if (Math.random() < dt * 8) this.view.sparks.burst(p.x, p.y, p.z, 4, 1, 0.5, 0.1, 3, 0.1, 0.4, 0); }
      else if (ub === B.CHECK) { const c = this.checkpoint; const fx2 = Math.floor(p.x), fz2 = Math.floor(p.z); if (Math.hypot(c.x - p.x, c.z - p.z) > 3) { this.checkpoint = { x: fx2 + 0.5, y: Math.floor(p.y) + 0.01, z: fz2 + 0.5 }; this.o.onEvent({ k: "checkpoint" }); sfx("checkpoint"); } }
      else if (ub === B.FINISH && this.plan.mode === "obby" && !this.won) { this.focus.set(p.x, p.y + 1, p.z); this.win(); }
      else if (ub === B.CLOUD) { const fx2 = Math.floor(p.x), fy2 = Math.floor(p.y - 0.05), fz2 = Math.floor(p.z); const k = this.map.vox.idx(fx2, fy2, fz2); if (!this.crumbling.has(k)) this.crumbling.set(k, 0.55); }
    }
    // falling into the void
    if (p.y < this.map.voidY - (this.map.walled ? 99 : 0) && playing) this.fellOff();
    // shooting and building
    this.fireCd -= dt; this.buildCd -= dt;
    const target = playing ? this.assistTarget() : null;
    this.aimOn = !!target;
    const auto = this.touch && this.autoFire && target !== null;
    if (playing && (this.firing || auto) && this.fireCd <= 0) this.shoot(target);
    if (playing && this.building && this.buildCd <= 0) this.build();
    if (target && this.touch && (this.firing || auto)) { const a = Math.atan2(target.x - this.camPos.x, target.z - this.camPos.z); this.camYaw += angleTo(this.camYaw, a) * Math.min(1, dt * 3.5) * 0.45; }
  }
  private fellOff() {
    const p = this.p;
    sfx("fall");
    if (this.plan.mode === "obby") { this.hurtPlayer(25, p.x, p.z, true); if (!p.dead) this.respawnAt(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z); return; }
    if (this.plan.mode === "crystal") {
      const mine = this.map.crystals.find((c) => c.team === 0);
      if (mine && !mine.alive) { this.failStage("You fell — and your crystal is gone"); return; }
    }
    this.playerDown("You fell into the void");
  }
  private respawnAt(x: number, y: number, z: number) {
    const p = this.p;
    Object.assign(p, { x, y: y + 0.2, z, vx: 0, vy: 0, vz: 0, dead: false });
    this.powers.set("shield", Math.max(this.powers.get("shield") ?? 0, 2.5));
    sfx("respawn");
  }

  /** the target nearest the crosshair (a rival, a mob, an enemy crystal), if one is in clear view */
  private assistTarget(): { x: number; y: number; z: number; h: number } | null {
    const cam = this.view.camera; cam.getWorldDirection(_dir);
    const cone = this.touch ? 0.12 : 0.05;
    let best: { x: number; y: number; z: number; h: number } | null = null, bestA = cone;
    const test = (x: number, y: number, z: number, h: number) => {
      _v.set(x - cam.position.x, y + h * 0.55 - cam.position.y, z - cam.position.z);
      const d = _v.length(); if (d > 42 || d < 1) return;
      const a = Math.acos(clamp(_v.dot(_dir) / d, -1, 1)) * Math.min(1.6, Math.max(0.7, d / 12));
      if (a >= bestA) return;
      _v.normalize();
      if (this.map.vox.raycast(cam.position.x, cam.position.y, cam.position.z, _v.x, _v.y, _v.z, d - 0.6, HIT)) return;
      best = { x, y, z, h }; bestA = a;
    };
    for (const r of this.rivals) if (r.alive && r.team !== 0) test(r.x, r.y, r.z, r.h);
    for (const m of this.mobs) if (m.alive && m.rise >= 1) test(m.x, m.y, m.z, m.h);
    for (const c of this.map.crystals) if (c.alive && c.team !== 0) test(c.x, c.y - 0.2, c.z, 1.4);
    return best;
  }
  private muzzle(out: THREE.Vector3) {
    const p = this.p, yaw = this.camYaw, pitch = this.camPitch;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    return out.set(p.x + fx * 1.05 * Math.cos(pitch) + rx * 0.36, p.y + 1.25 + Math.sin(pitch) * 1.05, p.z + fz * 1.05 * Math.cos(pitch) + rz * 0.36);
  }
  /** where the crosshair points, from the camera past the hero */
  private aimPoint(target: { x: number; y: number; z: number; h: number } | null, out: THREE.Vector3) {
    if (target) return out.set(target.x, target.y + target.h * 0.55, target.z);
    const cam = this.view.camera; cam.getWorldDirection(_dir);
    const st = this.camDist * 0.95;
    const ox = cam.position.x + _dir.x * st, oy = cam.position.y + _dir.y * st, oz = cam.position.z + _dir.z * st;
    let t = this.map.vox.raycast(ox, oy, oz, _dir.x, _dir.y, _dir.z, 80, HIT) ? HIT.t : 80;
    const hb = this.rayBodies(ox, oy, oz, _dir.x, _dir.y, _dir.z, t);
    if (hb) t = hb.t;
    return out.set(ox + _dir.x * t, oy + _dir.y * t, oz + _dir.z * t);
  }
  private shoot(target: { x: number; y: number; z: number; h: number } | null) {
    const s = this.stats, rapid = this.powers.has("rapid"), rocket = this.powers.has("rocket");
    this.fireCd = 1 / (s.rate * (rapid ? 2 : 1));
    const a = this.aimPoint(target, _v2), ax = a.x, ay = a.y, az = a.z;
    const m = this.muzzle(_v), mx = m.x, my = m.y, mz = m.z;
    let dx = ax - mx, dy = ay - my, dz = az - mz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const look = OUTFITS.find((o) => o.id === this.outfit)?.look ?? OUTFITS[0].look;
    const [gr, gg, gb] = rgb(look.glow).map((v) => v / 255);
    this.view.sparks.flash(mx, my, mz, 0.42, gr * 1.2, gg * 1.2, gb * 1.2, 0.06);
    this.shake = Math.max(this.shake, 0.05);
    sfx(rocket ? "boom" : "shoot", { rate: (rocket ? 1.5 : 1) * (0.94 + Math.random() * 0.12), gain: rocket ? 0.4 : 1 });
    if (rocket) { this.shots.push({ x: mx, y: my, z: mz, vx: dx * 34, vy: dy * 34, vz: dz * 34, kind: "rocket", team: 0, dmg: s.dmg * 2.2, knock: s.knock * 2, r: 0.25, life: 3, grav: 0, mine: true }); return; }
    const bt = this.map.vox.raycast(mx, my, mz, dx, dy, dz, 70, HIT) ? HIT.t : 70;
    const block = bt < 70 ? { x: HIT.x, y: HIT.y, z: HIT.z, id: HIT.id } : null;
    const hb = this.rayBodies(mx, my, mz, dx, dy, dz, bt);
    const end = hb ? hb.t : bt;
    const hx = mx + dx * end, hy = my + dy * end, hz = mz + dz * end;
    this.view.tracers.add(mx, my, mz, hx, hy, hz, gr, gg, gb, 0.08);
    if (hb) {
      const dmg = s.dmg * (0.9 + Math.random() * 0.2);
      if (hb.rival) this.hitRival(hb.rival, dmg, dx, dz, s.knock, true);
      else if (hb.mob) this.hitMob(hb.mob, dmg, dx, dz, true);
      else if (hb.crystal) this.hitCrystal(hb.crystal, 4 + s.dmg * 0.2, true);
      this.view.sparks.burst(hx, hy, hz, 5, gr, gg, gb, 4, 0.08, 0.25, 4);
    } else if (block) this.hitBlock(block.x, block.y, block.z, s.blockDmg, dx, dz, hx, hy, hz, true);
  }
  /** the nearest rival, mob or crystal along a ray before maxT */
  private rayBodies(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): { t: number; rival?: Rival; mob?: Mob; crystal?: Crystal } | null {
    let best: { t: number; rival?: Rival; mob?: Mob; crystal?: Crystal } | null = null, bt = maxT;
    for (const r of this.rivals) { if (!r.alive || r.team === 0) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, r.x - r.r, r.y, r.z - r.r, r.x + r.r, r.y + r.h, r.z + r.r); if (t >= 0 && t < bt) { bt = t; best = { t, rival: r }; } }
    for (const m of this.mobs) { if (!m.alive || m.rise < 1) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, m.x - m.r, m.y, m.z - m.r, m.x + m.r, m.y + m.h, m.z + m.r); if (t >= 0 && t < bt) { bt = t; best = { t, mob: m }; } }
    for (const c of this.map.crystals) { if (!c.alive || c.team === 0) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, c.x - 0.6, c.y - 0.2, c.z - 0.6, c.x + 0.6, c.y + 1.6, c.z + 0.6); if (t >= 0 && t < bt) { bt = t; best = { t, crystal: c }; } }
    return best;
  }

  // ------------------------------------------------------------------ building
  private build() {
    const p = this.p, V = this.map.vox;
    const free = this.powers.has("builder");
    if (!free && p.cubes <= 0) { this.buildCd = 0.5; this.o.onEvent({ k: "noCubes" }); return; }
    this.buildCd = 0.13;
    let cx = 0, cy = 0, cz = 0, ok = false;
    // 1) the face the crosshair points at, if it's close
    const cam = this.view.camera; cam.getWorldDirection(_dir);
    const st = this.camDist * 0.95, ox = cam.position.x + _dir.x * st, oy = cam.position.y + _dir.y * st, oz = cam.position.z + _dir.z * st;
    if (V.raycast(ox, oy, oz, _dir.x, _dir.y, _dir.z, 7, HIT)) { cx = HIT.x + HIT.nx; cy = HIT.y + HIT.ny; cz = HIT.z + HIT.nz; ok = Math.hypot(cx + 0.5 - p.x, cy + 0.5 - (p.y + 1), cz + 0.5 - p.z) < 5.5; }
    // 2) otherwise bridge: the cell ahead of your feet, or right under you
    if (!ok || !this.canPlace(cx, cy, cz)) {
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const fy = Math.floor(p.y - 0.5);
      const opts: [number, number, number][] = [[Math.floor(p.x + fx * 0.95), fy, Math.floor(p.z + fz * 0.95)], [Math.floor(p.x), fy, Math.floor(p.z)], [Math.floor(p.x + fx * 1.9), fy, Math.floor(p.z + fz * 1.9)]];
      ok = false;
      for (const [x, y, z] of opts) if (this.canPlace(x, y, z) && this.touchesBlock(x, y, z)) { cx = x; cy = y; cz = z; ok = true; break; }
    }
    if (!ok || !this.canPlace(cx, cy, cz)) return;
    V.set(cx, cy, cz, TEAM_CUBE[0]);
    if (!free) p.cubes--;
    sfxAt("place", cx + 0.5, cy + 0.5, cz + 0.5, { rate: 0.95 + Math.random() * 0.15 });
    this.view.sparks.burst(cx + 0.5, cy + 0.5, cz + 0.5, 5, 0.5, 0.8, 1.2, 2, 0.08, 0.25, 0);
  }
  private canPlace(x: number, y: number, z: number) {
    const V = this.map.vox, p = this.p;
    if (!V.inside(x, y, z) || V.get(x, y, z)) return false;
    // never inside someone
    const hit = (b: Body) => x + 1 > b.x - b.r && x < b.x + b.r && z + 1 > b.z - b.r && z < b.z + b.r && y + 1 > b.y + 0.05 && y < b.y + b.h;
    if (hit(p)) return false;
    for (const r of this.rivals) if (r.alive && hit(r)) return false;
    return true;
  }
  private touchesBlock(x: number, y: number, z: number) {
    const V = this.map.vox;
    return !!(V.get(x + 1, y, z) || V.get(x - 1, y, z) || V.get(x, y + 1, z) || V.get(x, y - 1, z) || V.get(x, y, z + 1) || V.get(x, y, z - 1));
  }

  // ------------------------------------------------------------------ blocks
  private chip = 0;
  private hitBlock(x: number, y: number, z: number, dmg: number, dx: number, dz: number, hx: number, hy: number, hz: number, mine: boolean) {
    const V = this.map.vox, id = V.get(x, y, z);
    if (!id) return;
    const A = this.view.blockAvg;
    if (id === B.TARGET) { this.hitTarget(x, y, z); return; }
    if (!V.damage(x, y, z, Math.max(1, Math.round(dmg)))) {
      this.view.debris.spawn(hx, hy, hz, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.1, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 0.8);
      if ((this.chip = (this.chip + 1) % 2) === 0) sfxAt(unbreakable(id) ? "hitBlock" : "hitBlock", hx, hy, hz, { rate: 0.9 + Math.random() * 0.2 });
      return;
    }
    this.blockBroken(x, y, z, id, mine);
    this.topple([x, y, z], dx, dz);
  }
  private blockBroken(x: number, y: number, z: number, id: number, mine: boolean, quiet = false) {
    const A = this.view.blockAvg, cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
    this.view.debris.burst(cx, cy, cz, this.view.phone ? 5 : 8, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 3.5, 0.2);
    if (!quiet) {
      const mat = BLOCKS[id].mat;
      const k: ClashSfx = mat === "cube" ? "breakCube" : mat === "wood" ? "breakWood" : mat === "stone" || mat === "metal" ? "breakStone" : mat === "glass" ? "breakGlass" : "breakSoft";
      sfxAt(k, cx, cy, cz, { rate: 0.9 + Math.random() * 0.2 });
    }
    if (mine) this.p.cubes = Math.min(99, this.p.cubes + 1);
    if (id === B.CHEST) { for (let k = 0; k < 6; k++) this.dropAt("coin", cx, cy, cz); this.dropAt(this.rng() < 0.5 ? "cubes" : this.rng() < 0.5 ? "oil" : "power", cx, cy, cz); }
    if (id === B.ORE) for (let k = 0; k < 3; k++) this.dropAt("coin", cx, cy, cz);
  }
  private topple(cells: number[], dx: number, dz: number) {
    const groups = this.map.vox.loosened(cells, 1500);
    let n = 0;
    for (const g of groups) { this.view.fallers?.drop(g, [dx * 1.5, 0.5, dz * 1.5]); n += g.length / 4; }
    if (n >= 10) { sfx("collapse", { gain: Math.min(1, 0.5 + n / 60) }); this.shake = Math.max(this.shake, Math.min(0.6, 0.2 + n / 80)); if (n >= 30) this.slow(0.45, 0.6); }
  }
  private crumbleT = 0;
  private onImpact = (x: number, y: number, z: number, id: number, speed: number) => {
    const A = this.view.blockAvg;
    this.view.debris.burst(x, y + 0.3, z, this.view.phone ? 3 : 5, A[id * 3], A[id * 3 + 1], A[id * 3 + 2], 3, 0.2);
    const now = performance.now();
    if (now - this.crumbleT > 70) { this.crumbleT = now; sfxAt("crumble", x, y, z, { rate: 0.85 + Math.random() * 0.3 }); }
    if (speed > 3) {
      for (const r of this.rivals) if (r.alive && Math.abs(r.x - x) < 0.9 && Math.abs(r.z - z) < 0.9 && y > r.y - 0.5 && y < r.y + r.h + 1) this.hitRival(r, 15 + speed * 2, 0, 0, 1, false);
      for (const m of this.mobs) if (m.alive && m.kind !== "titan" && Math.abs(m.x - x) < m.r + 0.6 && Math.abs(m.z - z) < m.r + 0.6 && y > m.y - 0.5 && y < m.y + m.h + 1) this.hitMob(m, 18 + speed * 3, 0, 0, false);
    }
  };
  private updateCrumbles(dt: number) {
    if (!this.crumbling.size) return;
    const V = this.map.vox;
    for (const [k, t] of this.crumbling) {
      const left = t - dt;
      if (left > 0) { this.crumbling.set(k, left); if (Math.random() < dt * 10) { const x = k % V.X, z = Math.floor(k / V.X) % V.Z, y = Math.floor(k / (V.X * V.Z)); this.view.debris.spawn(x + Math.random(), y, z + Math.random(), 0, -1, 0, 0.1, 1, 1, 1, 0.5); } continue; }
      this.crumbling.delete(k);
      const x = k % V.X, z = Math.floor(k / V.X) % V.Z, y = Math.floor(k / (V.X * V.Z));
      if (V.get(x, y, z) === B.CLOUD) { V.set(x, y, z, 0); this.view.debris.burst(x + 0.5, y + 0.5, z + 0.5, 6, 1, 1, 1, 2, 0.2); sfxAt("crumble", x, y, z, { rate: 1.4 }); }
    }
  }
  private hitTarget(x: number, y: number, z: number) {
    const V = this.map.vox;
    V.set(x, y, z, 0);
    this.view.sparks.burst(x + 0.5, y + 0.5, z + 0.5, 20, 1, 0.3, 0.3, 6, 0.14, 0.6, 2);
    sfx("target");
    const t = this.map.targets.find((q) => q.x === x && q.y === y && q.z === z);
    if (t && !t.done) {
      t.done = true;
      for (let k = 0; k < t.cells.length; k += 3) {
        const cx = t.cells[k], cy = t.cells[k + 1], cz = t.cells[k + 2];
        setTimeout(() => { if (!V.get(cx, cy, cz)) { V.set(cx, cy, cz, B.CUBE_GOLD); this.view.sparks.burst(cx + 0.5, cy + 0.5, cz + 0.5, 6, 1, 0.9, 0.3, 3, 0.1, 0.4, 0); sfxAt("place", cx, cy, cz, { rate: 1 + k * 0.02 }); } }, (k / 3) * 70);
      }
      setTimeout(() => sfx("bridge"), 80);
      this.o.onEvent({ k: "hint", text: "Bridge built!" });
    }
  }
  private explode(x: number, y: number, z: number, r: number, dmg: number, mine: boolean) {
    const V = this.map.vox, cells: number[] = [], R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      if (Math.hypot(bx + 0.5 - x, by + 0.5 - y, bz + 0.5 - z) > r) continue;
      const id = V.get(bx, by, bz);
      if (!id || unbreakable(id)) continue;
      if (id === B.TARGET) { this.hitTarget(bx, by, bz); continue; }
      if (V.damage(bx, by, bz, 99)) { this.blockBroken(bx, by, bz, id, false, true); cells.push(bx, by, bz); }
    }
    if (cells.length) this.topple(cells, 0, 0);
    this.view.sparks.flash(x, y, z, r * 1.6, 1.4, 0.9, 0.4, 0.14);
    this.view.sparks.burst(x, y, z, this.view.phone ? 16 : 26, 1, 0.6, 0.2, 9, 0.2, 0.55, 6);
    this.view.debris.smoke(x, y, z, this.view.phone ? 4 : 7, 0.45, 0.9);
    sfxAt("boom", x, y, z, { rate: 0.9 + Math.random() * 0.2, far: 60 });
    this.shake = Math.max(this.shake, clamp(0.8 - Math.hypot(this.p.x - x, this.p.z - z) / 20, 0.1, 0.8));
    for (const rv of this.rivals) { if (!rv.alive) continue; const d = Math.hypot(rv.x - x, rv.y + 0.9 - y, rv.z - z); if (d < r + 1 && (rv.team !== 0 || !mine)) this.hitRival(rv, dmg * (1 - d / (r + 2)), (rv.x - x) / (d || 1), (rv.z - z) / (d || 1), this.stats.knock * 2, mine); }
    for (const m of this.mobs) { if (!m.alive) continue; const d = Math.hypot(m.x - x, m.y + m.h / 2 - y, m.z - z); if (d < r + m.r + 0.5) this.hitMob(m, dmg * (1 - d / (r + 2)), (m.x - x) / (d || 1), (m.z - z) / (d || 1), mine); }
    const pd = Math.hypot(this.p.x - x, this.p.y + 0.9 - y, this.p.z - z);
    if (pd < r + 0.8 && !mine) { this.hurtPlayer(dmg * (1 - pd / (r + 1.5)), x, z); this.knockPlayer((this.p.x - x) / (pd || 1), (this.p.z - z) / (pd || 1), 7); }
  }
  private updateBooms(dt: number) { for (let i = this.booms.length - 1; i >= 0; i--) { const b = this.booms[i]; b.t -= dt; if (b.t <= 0) { this.booms.splice(i, 1); this.explode(b.x, b.y, b.z, b.r, b.dmg, b.mine); } } }

  // ------------------------------------------------------------------ hits
  private hitRival(r: Rival, dmg: number, kx: number, kz: number, knock: number, byMe: boolean) {
    if (!r.alive) return;
    r.hp -= dmg; r.flash = 0.1;
    const kl = Math.hypot(kx, kz) || 1;
    r.vx += (kx / kl) * knock; r.vz += (kz / kl) * knock; r.vy = Math.max(r.vy, 3.2); r.onGround = false; r.knockT = 0.8;
    if (byMe) { this.hitMark = 0.16; sfxAt("hit", r.x, r.y + 1, r.z, { rate: 0.9 + Math.random() * 0.25 }); if (knock > 4) sfxAt("knock", r.x, r.y + 1, r.z, { gain: 0.6 }); }
    if (r.hp <= 0) this.eliminate(r, byMe ? "you" : "other");
  }
  private eliminate(r: Rival, by: "you" | "void" | "other") {
    if (!r.alive) return;
    r.alive = false;
    const c = rgb(TEAM_COLORS[Math.min(3, r.team)] ?? "#ffffff");
    this.view.debris.burst(r.x, r.y + 1, r.z, 14, c[0] / 255, c[1] / 255, c[2] / 255, 5, 0.16);
    this.view.sparks.burst(r.x, r.y + 1, r.z, 12, 1, 1, 0.6, 5, 0.1, 0.5, 2);
    sfxAt("elim", r.x, r.y, r.z, { far: 80 });
    const canReturn = this.plan.mode === "crystal" && this.map.crystals.some((q) => q.team === r.team && q.alive);
    if (canReturn) r.respawn = 5; else r.out = true;
    if (r.team !== 0 && (by === "you" || by === "void")) {
      this.kos++; this.killMark = 0.3;
      for (let k = 0; k < 4; k++) this.dropAt("coin", r.x, Math.max(r.y, this.map.center.y) + 0.6, r.z);
      if (this.rng() < 0.35) this.dropAt(this.rng() < 0.5 ? "oil" : "cubes", r.x, Math.max(r.y, this.map.center.y) + 0.6, r.z);
      this.streak++; this.streakT = 2; if (this.streak >= 2) this.o.onEvent({ k: "streak", n: this.streak });
    }
    const left = this.rivals.filter((x) => x.team !== 0 && !x.out).length;
    this.o.onEvent({ k: "elim", name: r.name, by, left });
    this.focus.set(r.x, Math.max(r.y, this.map.center.y - 4) + 1, r.z);
  }
  private hitMob(m: Mob, dmg: number, kx: number, kz: number, byMe: boolean) {
    if (!m.alive || m.rise < 1) return;
    m.hp -= dmg; m.flash = 0.09;
    if (m.kind !== "titan") { m.vx += kx * 3; m.vz += kz * 3; }
    if (byMe) { this.hitMark = 0.16; sfxAt("hit", m.x, m.y + 1, m.z, { rate: 0.85 + Math.random() * 0.25 }); }
    if (m.hp <= 0) {
      m.alive = false;
      const big = m.kind === "titan";
      this.view.debris.burst(m.x, m.y + m.h * 0.5, m.z, big ? 26 : this.view.phone ? 9 : 13, m.color[0], m.color[1], m.color[2], big ? 7 : 5, 0.16 * m.scale * (big ? 2 : 1));
      sfxAt(big ? "titanRoar" : "zDie", m.x, m.y + 1, m.z, { rate: 0.9 + Math.random() * 0.2 });
      this.kos++; this.killMark = 0.3;
      const gold = this.plan.mods.includes("gold") ? 2 : 1;
      for (let k = 0; k < Math.min(10, m.coins * gold); k++) this.dropAt("coin", m.x, m.y + 0.6, m.z);
      const roll = this.rng();
      if (roll < 0.06) this.dropAt("health", m.x, m.y + 0.6, m.z); else if (roll < 0.12) this.dropAt("oil", m.x, m.y + 0.6, m.z); else if (roll < 0.15) this.dropAt("power", m.x, m.y + 0.6, m.z);
      this.streak++; this.streakT = 1.6; if (this.streak >= 3) this.o.onEvent({ k: "streak", n: this.streak });
      this.focus.set(m.x, m.y + m.h * 0.5, m.z);
    }
  }
  private hitCrystal(c: Crystal, dmg: number, byMe: boolean) {
    if (!c.alive) return;
    c.hp -= dmg;
    if (byMe) this.hitMark = 0.16;
    const col = rgb(TEAM_COLORS[c.team]);
    this.view.sparks.burst(c.x, c.y + 0.8, c.z, 5, col[0] / 255, col[1] / 255, col[2] / 255, 4, 0.1, 0.3, 2);
    sfxAt("crystalHit", c.x, c.y, c.z, { rate: 0.9 + Math.random() * 0.2 });
    if (c.team === 0 && Math.random() < 0.08) this.o.onEvent({ k: "hint", text: "Your crystal is under attack!" });
    if (c.hp <= 0) {
      c.alive = false; c.hp = 0;
      this.view.sparks.burst(c.x, c.y + 0.8, c.z, 40, col[0] / 255, col[1] / 255, col[2] / 255, 9, 0.2, 0.9, 4);
      this.view.debris.burst(c.x, c.y + 0.8, c.z, 18, col[0] / 255, col[1] / 255, col[2] / 255, 6, 0.2);
      sfx("crystalBreak"); this.shake = 0.5;
      this.o.onEvent({ k: "crystal", team: c.team, mine: c.team === 0 });
      this.focus.set(c.x, c.y + 1, c.z);
    }
  }
  private hurtPlayer(dmg: number, fromX: number, fromZ: number, silent = false) {
    const p = this.p;
    if (p.dead || this.phase !== "play") return;
    if (this.powers.has("shield")) { if (!silent && p.inv <= 0) { this.view.sparks.burst(p.x, p.y + 1, p.z, 8, 0.5, 1, 1, 4, 0.1, 0.3, 0); sfx("shieldPop", { gain: 0.5 }); p.inv = 0.3; } return; }
    if (p.inv > 0 && !silent) return;
    p.hp -= dmg; this.calm = 0;
    if (!silent) { p.inv = 0.2; p.hurt = 0.35; this.dmgDir = Math.atan2(fromX - p.x, fromZ - p.z); this.dmgT = 0.9; sfx("hit", { rate: 0.7 }); this.shake = Math.max(this.shake, 0.22); }
    if (p.hp <= 0) this.playerDown("Knocked out");
  }
  private knockPlayer(kx: number, kz: number, k: number) {
    if (this.powers.has("shield")) return;
    const l = Math.hypot(kx, kz) || 1, p = this.p;
    p.vx += (kx / l) * k; p.vz += (kz / l) * k; p.vy = Math.max(p.vy, 3.5); p.onGround = false;
  }
  private playerDown(why: string) {
    const p = this.p;
    if (p.dead) return;
    p.dead = true; p.hp = 0; this.lostLife = true;
    this.lives = Math.max(0, this.lives - 1); this.o.onLives(this.lives);
    sfx("out");
    this.view.debris.burst(p.x, p.y + 1, p.z, 12, 0.3, 0.6, 1, 5, 0.16);
    this.phase = "down"; this.phaseT = 0; this.slow(0.3, 1.1);
    if (this.lives > 0) this.o.onEvent({ k: "lifeLost", livesLeft: this.lives, why }); else this.o.onEvent({ k: "outOfLives" });
  }
  private failStage(why: string) {
    const p = this.p;
    p.dead = true; this.lostLife = true;
    this.lives = Math.max(0, this.lives - 1); this.o.onLives(this.lives);
    sfx("out");
    this.phase = "down"; this.phaseT = 0;
    this.o.onEvent({ k: "failed", why });
    this.restartAfterDown = true;
  }
  private restartAfterDown = false;

  // ------------------------------------------------------------------ rivals (bots)
  private updateRival(r: Rival, dt: number) {
    if (!r.alive) {
      if (r.out) return;
      r.respawn -= dt;
      if (r.respawn <= 0) { Object.assign(r, { x: r.home.x, y: r.home.y + 0.5, z: r.home.z, vx: 0, vy: 0, vz: 0, hp: r.maxHp, alive: true }); this.view.sparks.burst(r.x, r.y + 1, r.z, 12, 0.6, 0.8, 1, 4, 0.12, 0.5, -2); }
      return;
    }
    r.fireCd -= dt; r.placeCd -= dt; r.flash -= dt; r.think -= dt; r.jumpT -= dt; r.knockT -= dt;
    const V = this.map.vox, d = this.plan.difficulty;
    const playing = this.phase === "play";
    if (r.think <= 0 && playing) { r.think = 0.3 + Math.random() * 0.2; this.rivalThink(r); }
    let gx = r.gx - r.x, gz = r.gz - r.z; const gd = Math.hypot(gx, gz) || 0.001; gx /= gd; gz /= gd;
    // target position for aiming
    let tx = r.gx, ty = r.gy, tz = r.gz, hasT = false;
    if (r.targetPlayer && !this.p.dead) { tx = this.p.x; ty = this.p.y + 1; tz = this.p.z; hasT = true; }
    else if (r.target && r.target.alive) { tx = r.target.x; ty = r.target.y + 1; tz = r.target.z; hasT = true; }
    else if (r.targetCrystal && r.targetCrystal.alive) { tx = r.targetCrystal.x; ty = r.targetCrystal.y + 0.6; tz = r.targetCrystal.z; hasT = true; }
    const tdist = Math.hypot(tx - r.x, tz - r.z);
    const los = hasT && tdist < 28 && !V.raycast(r.x, r.y + 1.5, r.z, (tx - r.x) / Math.max(0.01, Math.hypot(tx - r.x, ty - r.y - 1.5, tz - r.z)), (ty - r.y - 1.5) / Math.max(0.01, Math.hypot(tx - r.x, ty - r.y - 1.5, tz - r.z)), (tz - r.z) / Math.max(0.01, Math.hypot(tx - r.x, ty - r.y - 1.5, tz - r.z)), Math.hypot(tx - r.x, ty - r.y - 1.5, tz - r.z) - 0.8, HIT);
    // movement: toward the goal in straight lines (one axis at a time, so bridges are neat), strafing in a fight
    let wx = 0, wz = 0;
    // close in (bridging as it goes) until ~8 m away, then strafe and duel
    const fighting = los && tdist < 8 + (1 - d) * 3;
    if (playing) {
      if (fighting) { const k = tdist > 9 ? 0.7 : tdist < 5 ? -0.5 : 0; wx = gx * k + -gz * r.strafe * 0.8; wz = gz * k + gx * r.strafe * 0.8; if (Math.random() < dt * 0.6) r.strafe = -r.strafe; }
      else if (gd > 1.2) {
        // step along whichever axis is further off (a 4-connected path: every bridge cube touches the last one)
        const ddx = r.gx - r.x, ddz = r.gz - r.z;
        r.axis = Math.abs(ddx) > Math.abs(ddz) + (r.axis === 0 ? -0.6 : 0.6) ? 0 : 1;
        if (r.axis === 0) wx = Math.sign(ddx); else wz = Math.sign(ddz);
      }
    }
    const sp = (fighting ? 3.2 : 4.4) * (0.85 + d * 0.3);
    // how far down a bot is happy to drop (only toward a lower goal)
    const drop = r.gy < r.y - 1.5 ? 6 : 1;
    const fy0 = Math.floor(r.y - 0.05);
    /** somewhere to stand at (x, z): a step up, the same level, or a drop the bot accepts */
    const ground = (x: number, z: number) => { const ix = Math.floor(x), iz = Math.floor(z); for (let k = -1; k <= drop; k++) if (V.get(ix, fy0 - k, iz)) return true; return false; };
    // bridging: nothing to stand on ahead → place a cube first (one higher when the goal is above: stairs up)
    if (playing && r.onGround && !fighting && (wx || wz) && (wx === 0 || wz === 0)) {
      const ax = r.x + wx * 0.95, az = r.z + wz * 0.95;
      if (V.inside(Math.floor(ax), fy0, Math.floor(az)) && !ground(ax, az)) {
        if (wx) r.z += (Math.floor(r.z) + 0.5 - r.z) * Math.min(1, dt * 8); else r.x += (Math.floor(r.x) + 0.5 - r.x) * Math.min(1, dt * 8);
        const lv = r.gy > r.y + 1.5 && !V.get(Math.floor(r.x), fy0 + 3, Math.floor(r.z)) ? 1 : 0;
        if (r.cubes > 0 && r.placeCd <= 0) { V.set(Math.floor(ax), fy0 + lv, Math.floor(az), TEAM_CUBE[r.team === 0 ? 0 : r.team % 4]); r.cubes--; r.placeCd = 0.34 - d * 0.14; sfxAt("place", ax, fy0 + lv, az, { gain: 0.6 }); }
        wx *= 0.3; wz *= 0.3;
      }
    }
    // climbing: a wall too high to jump, or the goal well above and close → pillar up (jump, place a cube underfoot)
    if ((r.bx || r.bz) && r.onGround && playing) r.climb += dt; else if (r.onGround) r.climb = 0;
    // only over low walls (up to 3 blocks), and never far above the goal
    let wallH = 0;
    if (r.climb > 0.7) { const fx = Math.floor(r.x + Math.sign(r.vx || wx) * 0.9), fz = Math.floor(r.z + Math.sign(r.vz || wz) * 0.9); while (wallH < 5 && V.get(fx, fy0 + 1 + wallH, fz)) wallH++; if (wallH > 3) { r.axis = 1 - r.axis; r.climb = 0; } }
    const pillar = playing && r.cubes > 0 && r.y < r.gy + 3 && ((r.climb > 0.7 && wallH <= 3) || (r.targetPlayer && r.gy > r.y + 2.2 && gd < 3));
    if (pillar) {
      wx = 0; wz = 0; r.vx *= 0.5; r.vz *= 0.5; // straight up
      if (r.onGround && r.jumpT <= 0) { r.vy = Math.sqrt(2 * this.grav * 1.25); r.jumpT = 0.5; }
      const fy = Math.floor(r.y - 0.3);
      if (!r.onGround && r.vy < 1 && !V.get(Math.floor(r.x), fy, Math.floor(r.z)) && r.placeCd <= 0) { V.set(Math.floor(r.x), fy, Math.floor(r.z), TEAM_CUBE[r.team === 0 ? 0 : r.team % 4]); r.cubes--; r.placeCd = 0.25; r.climb = 0.5; }
    }
    r.vx = damp(r.vx, wx * sp, r.onGround ? 0.08 : 0.6, dt); r.vz = damp(r.vz, wz * sp, r.onGround ? 0.08 : 0.6, dt);
    // never walk off an edge (unless knocked back)
    if (r.onGround && r.knockT <= 0) {
      const look = 0.16 + r.r;
      if (r.vx && !ground(r.x + Math.sign(r.vx) * look, r.z)) r.vx = 0;
      if (r.vz && !ground(r.x, r.z + Math.sign(r.vz) * look)) r.vz = 0;
      if (r.vx && r.vz && !ground(r.x + Math.sign(r.vx) * look, r.z + Math.sign(r.vz) * look)) { if (Math.abs(r.vx) > Math.abs(r.vz)) r.vz = 0; else r.vx = 0; }
    }
    if ((r.bx || r.bz) && r.onGround && r.jumpT <= 0 && playing && !pillar) { r.vy = Math.sqrt(2 * this.grav * 1.3); r.jumpT = 0.6; }
    r.vy -= this.grav * dt;
    this.moveBody(r, dt, true);
    if (hasT) r.yaw += angleTo(r.yaw, Math.atan2(tx - r.x, tz - r.z)) * Math.min(1, dt * 8);
    else if (wx || wz) r.yaw += angleTo(r.yaw, Math.atan2(wx, wz)) * Math.min(1, dt * 6);
    r.aimP = hasT ? Math.atan2(ty - (r.y + 1.4), Math.max(0.5, tdist)) : 0;
    const s = Math.hypot(r.vx, r.vz); r.walk += s * dt * 2.2; r.walkAmt = damp(r.walkAmt, r.onGround ? Math.min(1, s / 4) : 0.3, 0.1, dt);
    // shooting
    if (playing && los && tdist < 26 && r.fireCd <= 0) {
      r.fireCd = (1.5 - d * 0.7) * (0.8 + Math.random() * 0.5);
      const sx = r.x + Math.sin(r.yaw) * 0.6, sy = r.y + 1.3, sz = r.z + Math.cos(r.yaw) * 0.6;
      const speed = 26;
      let ax = tx, ay = ty, az = tz;
      if (r.targetPlayer) { const t = tdist / speed; ax += this.p.vx * t * (0.4 + d * 0.5); az += this.p.vz * t * (0.4 + d * 0.5); }
      const spread = (0.09 - d * 0.06) * tdist;
      ax += (Math.random() - 0.5) * spread; ay += (Math.random() - 0.5) * spread * 0.6; az += (Math.random() - 0.5) * spread;
      const l = Math.hypot(ax - sx, ay - sy, az - sz) || 1;
      this.shots.push({ x: sx, y: sy, z: sz, vx: (ax - sx) / l * speed, vy: (ay - sy) / l * speed, vz: (az - sz) / l * speed, kind: "bolt", team: r.team, dmg: 7 + d * 7, knock: 4 + d * 2.5, r: 0.16, life: 2, grav: 0, mine: false });
      sfxAt("shoot", sx, sy, sz, { rate: 1.15, gain: 0.7 });
    }
    if (r.y < this.map.voidY) { r.vy = 0; this.eliminate(r, r.team === 0 ? "other" : "void"); }
  }
  /** choose what a bot goes for: the nearest enemy (you count a bit closer), an enemy crystal, or home to defend */
  private rivalThink(r: Rival) {
    const crystals = this.map.crystals;
    let best = Infinity; r.target = null; r.targetPlayer = false; r.targetCrystal = null;
    // bots go for you first; another bot only when it's right next to them
    if (r.team !== 0 && !this.p.dead) { best = Math.hypot(this.p.x - r.x, this.p.z - r.z) * 0.5; r.targetPlayer = true; }
    for (const o of this.rivals) { if (!o.alive || o === r || o.team === r.team) continue; const dd = Math.hypot(o.x - r.x, o.z - r.z); if (dd < Math.min(best, r.team === 0 ? 30 : 9)) { best = dd; r.target = o; r.targetPlayer = false; } }
    let gx = r.target ? r.target.x : r.targetPlayer ? this.p.x : this.map.center.x, gy = r.target ? r.target.y : r.targetPlayer ? this.p.y : this.map.center.y, gz = r.target ? r.target.z : r.targetPlayer ? this.p.z : this.map.center.z;
    if (this.plan.mode === "crystal") {
      const mine = crystals.find((c) => c.team === r.team);
      if (r.role === "defend" && mine?.alive) {
        if (best > 14) { gx = mine.x + Math.sin(r.id) * 3; gy = mine.y; gz = mine.z + Math.cos(r.id) * 3; }
      } else {
        // attackers go for the nearest enemy crystal (yours is close to the top of their list)
        let cb = Infinity, cc: Crystal | null = null;
        for (const c of crystals) { if (!c.alive || c.team === r.team) continue; const dd = Math.hypot(c.x - r.x, c.z - r.z) * (c.team === 0 ? 0.8 : 1); if (dd < cb) { cb = dd; cc = c; } }
        if (cc && best > 10) { r.targetCrystal = cc; r.target = null; r.targetPlayer = false; gx = cc.x; gy = cc.y; gz = cc.z; }
      }
    }
    r.gx = gx; r.gy = gy; r.gz = gz;
  }

  // ------------------------------------------------------------------ mobs
  private updateMob(m: Mob, dt: number) {
    m.t += dt; m.atkCd -= dt; m.flash -= dt;
    if (m.rise < 1) { m.rise = Math.min(1, m.rise + dt * 2); return; }
    const p = this.p, V = this.map.vox;
    const playing = this.phase === "play";
    const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz) || 0.001, ux = dx / dist, uz = dz / dist;
    m.yaw += angleTo(m.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
    const reach = m.r + 0.9;
    switch (m.kind) {
      case "wisp": {
        const ty = (this.plan.mode === "obby" ? V.top(m.x, m.z) + 2.5 + Math.sin(m.t) : p.y + 2.6), ang = m.t * 0.9 + m.maxHp;
        const goalX = this.plan.mode === "obby" ? m.x + Math.sin(m.t * 0.7) * 0.05 : p.x + Math.cos(ang) * 5, goalZ = this.plan.mode === "obby" ? m.z : p.z + Math.sin(ang) * 5;
        m.vx = damp(m.vx, (goalX - m.x) * 1.2, 0.3, dt); m.vz = damp(m.vz, (goalZ - m.z) * 1.2, 0.3, dt); m.vy = damp(m.vy, (ty - m.y) * 1.5, 0.3, dt);
        m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
        if (playing && m.atkCd <= 0 && dist < 18 && !p.dead) {
          m.atkCd = 2.6 - this.plan.difficulty;
          const sy = m.y + 0.2, l = Math.hypot(p.x - m.x, p.y + 1 - sy, p.z - m.z) || 1, sp = 11;
          this.shots.push({ x: m.x, y: sy, z: m.z, vx: (p.x - m.x) / l * sp, vy: (p.y + 1 - sy) / l * sp, vz: (p.z - m.z) / l * sp, kind: "orb", team: -1, dmg: m.dmg, knock: 3, r: 0.25, life: 4, grav: 0, mine: false });
          sfxAt("orb", m.x, m.y, m.z);
        }
        if (Math.random() < dt * 0.2) sfxAt("zWisp", m.x, m.y, m.z, { gain: 0.6 });
        return;
      }
      case "hopper": {
        m.hopCd -= dt;
        if (m.onGround) { m.vx = damp(m.vx, 0, 0.05, dt); m.vz = damp(m.vz, 0, 0.05, dt); if (m.hopCd <= 0 && playing) { m.hopCd = 0.55 + Math.random() * 0.3; m.vx = ux * m.speed; m.vz = uz * m.speed; m.vy = Math.sqrt(2 * this.grav * 1.2); if (Math.random() < 0.3) sfxAt("zHop", m.x, m.y, m.z); } }
        if (playing && dist < reach && Math.abs(p.y - m.y) < 1.6 && m.atkCd <= 0) { m.atkCd = 1.1; this.hurtPlayer(m.dmg, m.x, m.z); this.knockPlayer(ux, uz, 4); }
        break;
      }
      default: {
        const stop = dist < reach * 0.85;
        m.vx = damp(m.vx, playing && !stop ? ux * m.speed : 0, 0.15, dt); m.vz = damp(m.vz, playing && !stop ? uz * m.speed : 0, 0.15, dt);
        if (playing && dist < reach + (m.kind === "titan" ? 1.5 : 0.2) && m.atkCd <= 0 && Math.abs(p.y - m.y) < 3) { m.atk = 0.001; m.atkCd = m.kind === "titan" ? 2.6 : 1.4; }
        if (m.kind === "titan" && playing) this.titanBrain(m, dt, dist);
        if (Math.random() < dt * 0.15) sfxAt(m.kind === "titan" ? "titanRoar" : "zGrowl", m.x, m.y + 1, m.z, { rate: 0.85 + Math.random() * 0.3, gain: m.kind === "titan" ? 0.4 : 1 });
      }
    }
    if (m.atk > 0) {
      const before = m.atk; m.atk += dt / (m.kind === "titan" ? 0.9 : 0.55);
      if (before < 0.45 && m.atk >= 0.45) {
        if (m.kind === "titan") this.stomp(m);
        else if (Math.hypot(p.x - m.x, p.z - m.z) < reach + 0.5) { this.hurtPlayer(m.dmg, m.x, m.z); this.knockPlayer(ux, uz, 4.5); }
      }
      if (m.atk >= 1) m.atk = 0;
    }
    m.vy -= this.grav * dt;
    this.moveBody(m, dt, m.kind !== "hopper");
    if ((m.bx || m.bz) && m.onGround && m.kind === "shambler") m.vy = Math.sqrt(2 * this.grav * 1.3);
    const s = Math.hypot(m.vx, m.vz); m.walk += s * dt * (m.kind === "titan" ? 1.2 : 2.4) / m.scale; m.walkAmt = damp(m.walkAmt, m.onGround ? Math.min(1, s / Math.max(0.5, m.speed)) : 0.2, 0.1, dt);
    if (m.y < this.map.voidY - 4) { m.alive = false; if (m === this.titan) this.focus.set(m.x, this.map.center.y, m.z); }
  }
  private stomp(m: Mob) {
    const r = 5, fx = m.x + Math.sin(m.yaw) * m.r, fz = m.z + Math.cos(m.yaw) * m.r;
    sfxAt("titanSlam", fx, m.y, fz, { far: 60 }); this.shake = 0.7;
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; this.view.debris.spawn(fx + Math.cos(a) * 0.6, m.y + 0.2, fz + Math.sin(a) * 0.6, Math.cos(a) * r * 2.2, 2 + Math.random() * 2, Math.sin(a) * r * 2.2, 0.24, m.color[0], m.color[1], m.color[2], 0.8); }
    const p = this.p, pd = Math.hypot(p.x - fx, p.z - fz);
    if (pd < r && Math.abs(p.y - m.y) < 3) { this.hurtPlayer(m.dmg * (1 - pd / (r * 1.4)), fx, fz); this.knockPlayer(p.x - fx, p.z - fz, 11); }
    // the stomp cracks the ground around it
    const V = this.map.vox, cells: number[] = [];
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * r; const bx = Math.floor(fx + Math.cos(a) * d), bz = Math.floor(fz + Math.sin(a) * d), by = Math.floor(m.y) - 1; const id = V.get(bx, by, bz); if (id && !unbreakable(id) && V.damage(bx, by, bz, 3)) { this.blockBroken(bx, by, bz, id, false, true); cells.push(bx, by, bz); } }
    if (cells.length) this.topple(cells, 0, 0);
  }
  private titanBrain(m: Mob, dt: number, dist: number) {
    m.throwCd -= dt; m.callCd -= dt;
    if (m.throwCd <= 0 && dist > 6) {
      m.throwCd = 4 + Math.random() * 1.5; m.atk = 0.001;
      const sx = m.x, sy = m.y + m.h * 0.9, sz = m.z, gx = this.p.x - sx, gz = this.p.z - sz, gd = Math.hypot(gx, gz) || 1, speed = 15, tt = gd / speed, g = this.grav * 0.6;
      this.shots.push({ x: sx, y: sy, z: sz, vx: (gx / gd) * speed, vy: (this.p.y + 0.5 - sy) / tt + 0.5 * g * tt, vz: (gz / gd) * speed, kind: "boulder", team: -1, dmg: m.dmg * 0.8, knock: 8, r: 0.6, life: 5, grav: g, mine: false });
      sfxAt("whoosh", sx, sy, sz, { rate: 0.6 });
    }
    if (m.callCd <= 0) {
      m.callCd = 13; sfx("titanRoar", { gain: 0.8 });
      for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; this.spawnMob(k % 2 ? "hopper" : "shambler", m.x + Math.cos(a) * 4, m.z + Math.sin(a) * 4); }
    }
  }
  private separate() {
    const all: Body[] = [];
    for (const r of this.rivals) if (r.alive) all.push(r);
    for (const m of this.mobs) if (m.alive && m.kind !== "wisp") all.push(m);
    all.push(this.p);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m2 = a.r + b.r;
      if (d < m2 && d > 0.001 && Math.abs(a.y - b.y) < 1.5) {
        const push = (m2 - d) * 0.5, ux = dx / d, uz = dz / d;
        const wa = a === this.p ? 0.3 : 1, wb = b === this.p ? 0.3 : 1;
        a.x -= ux * push * wa; a.z -= uz * push * wa; b.x += ux * push * wb; b.z += uz * push * wb;
      }
    }
  }

  // ------------------------------------------------------------------ projectiles
  private updateShots(dt: number) {
    const V = this.map.vox;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt; s.vy -= s.grav * dt;
      let done = false;
      for (let k = 0; k < 2 && !done; k++) {
        s.x += (s.vx * dt) / 2; s.y += (s.vy * dt) / 2; s.z += (s.vz * dt) / 2;
        if (V.inside(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z)) && V.get(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))) {
          done = true;
          if (s.kind === "rocket" || s.kind === "boulder") this.explode(s.x, s.y, s.z, s.kind === "rocket" ? 2.4 : 1.9, s.dmg, s.mine);
          else { this.view.sparks.burst(s.x, s.y, s.z, 4, 1, 0.9, 0.6, 3, 0.06, 0.2, 4); if (s.kind === "bolt") { const bx = Math.floor(s.x), by = Math.floor(s.y), bz = Math.floor(s.z); const id = V.get(bx, by, bz); if (id && !unbreakable(id) && BLOCKS[id].mat === "cube" && V.damage(bx, by, bz, 1)) { this.blockBroken(bx, by, bz, id, false); this.topple([bx, by, bz], s.vx / 26, s.vz / 26); } } }
          break;
        }
        // the player
        const p = this.p;
        if (!s.mine && s.team !== 0 && !p.dead && Math.abs(p.x - s.x) < p.r + s.r && Math.abs(p.z - s.z) < p.r + s.r && s.y > p.y - s.r && s.y < p.y + p.h + s.r) {
          done = true;
          if (s.kind === "boulder") this.explode(s.x, s.y, s.z, 1.9, s.dmg, false);
          else { this.hurtPlayer(s.dmg, s.x - s.vx, s.z - s.vz); this.knockPlayer(s.vx, s.vz, s.knock); }
          break;
        }
        // rivals of other teams (and your rockets)
        for (const r of this.rivals) {
          if (!r.alive || r.team === s.team) continue;
          if (Math.abs(r.x - s.x) < r.r + s.r && Math.abs(r.z - s.z) < r.r + s.r && s.y > r.y - s.r && s.y < r.y + r.h + s.r) {
            done = true;
            if (s.kind === "rocket") this.explode(s.x, s.y, s.z, 2.4, s.dmg, s.mine); else this.hitRival(r, s.dmg, s.vx, s.vz, s.knock, s.mine);
            break;
          }
        }
        if (done) break;
        if (s.mine) for (const m of this.mobs) {
          if (!m.alive || m.rise < 1) continue;
          if (Math.abs(m.x - s.x) < m.r + s.r && Math.abs(m.z - s.z) < m.r + s.r && s.y > m.y - s.r && s.y < m.y + m.h + s.r) { done = true; this.explode(s.x, s.y, s.z, 2.4, s.dmg, true); break; }
        }
        if (done) break;
        // crystals
        for (const c of this.map.crystals) {
          if (!c.alive || c.team === s.team) continue;
          if (Math.abs(c.x - s.x) < 0.7 && Math.abs(c.z - s.z) < 0.7 && s.y > c.y - 0.3 && s.y < c.y + 1.7) { done = true; this.hitCrystal(c, s.kind === "rocket" ? 12 : 3, s.mine); break; }
        }
      }
      if (!done) {
        const bolt = s.kind === "bolt", orb = s.kind === "orb";
        const tc = bolt ? rgb(TEAM_COLORS[Math.max(0, s.team) % 4]) : null;
        this.view.sparks.flash(s.x, s.y, s.z, s.r * (s.kind === "boulder" ? 2.6 : 2.4), tc ? tc[0] / 200 : orb ? 0.5 : 1, tc ? tc[1] / 200 : orb ? 0.8 : 0.6, tc ? tc[2] / 200 : orb ? 1.2 : 0.3, dt * 1.6);
      }
      if (done || s.life <= 0 || s.y < this.map.voidY - 20) this.shots.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ pickups
  private dropAt(kind: PickupKind, x: number, y: number, z: number) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
    this.drops.push({ kind, x, y, z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 3, vz: Math.sin(a) * sp, t: Math.random() * 6, alive: true, settled: false, life: kind === "coin" ? 25 : 40 });
  }
  private updateDrops(dt: number) {
    const p = this.p, V = this.map.vox, mag = this.stats.magnet * (this.powers.has("magnet") ? 4 : 1);
    let dead = 0;
    for (const d of this.drops) {
      if (!d.alive) { dead++; continue; }
      d.t += dt;
      if (d.life !== Infinity) { d.life -= dt; if (d.life <= 0) { d.alive = false; continue; } }
      const dx = p.x - d.x, dy = p.y + 0.9 - d.y, dz = p.z - d.z, dist = Math.hypot(dx, dy, dz);
      if (!p.dead && this.phase === "play" && dist < mag + 1.2) { const k = Math.min(1, dt * (dist < mag ? 9 : 3)); d.x += dx * k; d.y += dy * k; d.z += dz * k; d.settled = true; if (dist < 0.9) { d.alive = false; this.collect(d.kind, d.x, d.y, d.z); } continue; }
      if (!d.settled) {
        d.vy -= this.grav * dt;
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
        if (V.solidAt(Math.floor(nx), Math.floor(ny - 0.2), Math.floor(nz)) && d.vy < 0) { d.y = Math.floor(ny - 0.2) + 1.2; d.vy = 0; d.vx = 0; d.vz = 0; d.settled = true; }
        else { if (V.solidAt(Math.floor(nx), Math.floor(d.y), Math.floor(nz))) { d.vx = 0; d.vz = 0; } else { d.x = nx; d.z = nz; } d.y = ny; }
        if (d.y < this.map.voidY - 10) d.alive = false;
      } else if (!V.solidAt(Math.floor(d.x), Math.floor(d.y - 0.75), Math.floor(d.z))) d.settled = false;
    }
    if (dead > 60) this.drops = this.drops.filter((d) => d.alive);
  }
  private collect(kind: PickupKind, x: number, y: number, z: number) {
    const p = this.p;
    switch (kind) {
      case "coin": this.addCoins(this.plan.mods.includes("gold") ? 2 : 1); sfx("coin", { rate: 0.95 + Math.random() * 0.15 }); this.view.sparks.burst(x, y, z, 3, 1, 0.85, 0.3, 2, 0.06, 0.25, 0); return;
      case "gem": this.addCoins(10); sfx("gem"); break;
      case "oil": p.oil = Math.min(p.maxOil, p.oil + p.maxOil * 0.5); this.lowOilSaid = false; sfx("oil"); break;
      case "heart": this.lives = Math.min(9, this.lives + 1); this.o.onLives(this.lives); sfx("heart"); break;
      case "health": p.hp = Math.min(p.maxHp, p.hp + 40); sfx("health"); break;
      case "cubes": p.cubes = Math.min(99, p.cubes + 16); sfx("cubes"); break;
      case "power": this.givePower(POWER_IDS[Math.floor(this.rng() * POWER_IDS.length)]); break;
    }
    this.view.sparks.burst(x, y, z, 10, 1, 1, 0.8, 4, 0.1, 0.4, 0);
    this.o.onEvent({ k: "pickup", what: kind });
  }
  givePower(id: PowerId) { this.powers.set(id, POWERS[id].secs); sfx(id === "shield" ? "shield" : "power"); this.o.onEvent({ k: "power", id }); }
  private addCoins(n: number) { this.coins += n; this.o.onCoins(this.coins); }
  private updatePowers(dt: number) {
    for (const [id, left] of this.powers) { const l = left - dt; if (l <= 0) { this.powers.delete(id); if (id === "shield") sfx("shieldPop"); } else this.powers.set(id, l); }
    this.streakT -= dt; if (this.streakT <= 0) this.streak = 0;
  }

  // ------------------------------------------------------------------ waves and goals
  private waves(dt: number) {
    if (this.plan.mode !== "zombie") return;
    const alive = this.mobs.reduce((n, m) => n + (m.alive ? 1 : 0), 0);
    if (this.waveLeft <= 0 && alive === 0) {
      if (this.wave >= this.plan.waves) return;
      this.waveCd -= dt;
      if (this.waveCd > 0) return;
      this.wave++;
      this.waveLeft = Math.round((4 + this.wave * 2 + this.plan.difficulty * 6) * (this.plan.mods.includes("swarm") ? 1.5 : 1));
      this.waveCd = 4;
      this.o.onEvent({ k: "wave", n: this.wave, of: this.plan.waves }); sfx("wave");
    }
    this.spawnCd -= dt;
    const cap = this.touch ? 9 : 14;
    if (this.waveLeft > 0 && this.spawnCd <= 0 && alive < cap) {
      this.spawnCd = 0.7 - this.plan.difficulty * 0.3;
      const g = this.map.gates[Math.floor(this.rng() * this.map.gates.length)];
      const roll = this.rng(), d = this.plan.difficulty;
      const kind: MobKind = roll < 0.18 + d * 0.1 && this.wave > 1 ? "wisp" : roll < 0.45 ? "hopper" : "shambler";
      this.spawnMob(kind, g.x + 0.5 + (this.rng() - 0.5) * 2, g.z + 0.5 + (this.rng() - 0.5) * 2);
      this.waveLeft--;
    }
  }
  private goals() {
    if (this.won) return;
    const m = this.plan.mode;
    let win = false;
    if (m === "sky") win = this.rivals.every((r) => r.out);
    else if (m === "crystal") win = this.rivals.filter((r) => r.team !== 0).every((r) => r.out) && this.map.crystals.filter((c) => c.team !== 0).every((c) => !c.alive);
    else if (m === "zombie") win = this.wave >= this.plan.waves && this.waveLeft <= 0 && this.mobs.every((q) => !q.alive);
    else if (m === "titan") win = !!this.titan && !this.titan.alive;
    if (win) this.win();
  }
  private win() {
    this.won = true;
    this.phase = "clear"; this.phaseT = 0;
    this.firing = false; this.building = false;
    if (this.pointerLocked) document.exitPointerLock?.();
    this.slow(0.22, 1.1);
    sfx("clear");
    setTimeout(() => { for (const q of this.mobs) if (q.alive) { q.alive = false; this.view.debris.burst(q.x, q.y + q.h / 2, q.z, 6, q.color[0], q.color[1], q.color[2], 3, 0.14); } }, 900);
    const bonus = 15 + Math.floor(this.stage / 4) + (this.plan.mode === "titan" ? 60 : 0) + (this.plan.finale ? 150 : 0);
    this.addCoins(bonus);
    const stars = this.lostLife ? 1 : this.p.hp > this.p.maxHp * 0.5 ? 3 : 2;
    const worldDone = !this.plan.remix && this.plan.local === STAGES_PER_THEME;
    this.o.onEvent({ k: "clear", stats: { stage: this.stage, kos: this.kos, coins: this.coins - this.coinsAtStart, time: this.stageTime, stars, bonus, worldDone, mode: this.plan.mode } });
  }
  private slow(scale: number, secs: number) { this.slowTarget = scale; this.slowT = secs; }

  private flow() {
    const introLen = this.plan.mode === "titan" ? 4.6 : 3.4;
    if (this.phase === "intro" && this.holdIntro) this.phaseT = Math.min(this.phaseT, introLen - 0.02);
    const t = this.phaseT;
    if (this.phase === "intro" && t > introLen) {
      this.phase = "play"; this.phaseT = 0;
      this.o.onEvent({ k: "go" }); sfx("go");
      if (this.plan.mode === "titan") this.o.onEvent({ k: "titan", name: this.plan.titan });
      if (this.plan.mods.length) this.o.onEvent({ k: "hint", text: this.plan.mods.map((q) => MOD_LABEL[q]).join(" · ") });
    }
    if (this.phase === "clear" && t > 4.2) { this.phase = "travel"; this.phaseT = 0; sfx("whoosh"); }
    if (this.phase === "travel" && t > 1.1) this.load(this.stage + 1, "intro", true);
    if (this.phase === "down" && t > 1.8) {
      if (this.lives <= 0) { this.lives = 3; this.o.onLives(3); this.restartAfterDown = false; this.load(this.stage, "intro"); return; }
      if (this.restartAfterDown) { this.restartAfterDown = false; this.load(this.stage, "intro"); return; }
      const sp = this.plan.mode === "obby" ? this.checkpoint : this.map.spawn;
      this.respawnAt(sp.x, sp.y, sp.z);
      this.p.hp = this.p.maxHp;
      this.powers.set("shield", 3);
      this.phase = "play"; this.phaseT = 0;
    }
  }

  // ------------------------------------------------------------------ camera
  private placeCameraNow() { this.cameraPose(this.camPos, this.camLook); this.view.camera.position.copy(this.camPos); this.view.camera.lookAt(this.camLook); }
  private cameraPose(pos: THREE.Vector3, look: THREE.Vector3) {
    const p = this.p, yaw = this.camYaw, pitch = this.camPitch, { w, h } = this.view.size, portrait = h > w;
    const dist = portrait ? 4.9 : 4.1, sh = portrait ? 0.5 : 0.85;
    const dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const px = p.x + rx * sh, py = p.y + 1.6 + p.stepY, pz = p.z + rz * sh;
    let d = dist;
    const bx = -dx, by = -dy + 0.12, bz = -dz, bl = Math.hypot(bx, by, bz);
    if (this.map.vox.raycast(px, py, pz, bx / bl, by / bl, bz / bl, dist + 0.3, HIT)) d = Math.max(0.6, HIT.t - 0.35);
    this.camDist = d;
    pos.set(px - dx * d, py - dy * d + 0.12 * (d / dist) + 0.15, pz - dz * d);
    look.set(pos.x + dx, pos.y + dy, pos.z + dz);
  }
  private updateCamera(dt: number) {
    const cam = this.view.camera, M = this.map, t = this.phaseT, c = M.center;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.photoCam) { const q = this.photoCam; cam.position.set(q[0], q[1], q[2]); cam.lookAt(q[3], q[4], q[5]); return; }
    const S = Math.max(M.vox.X, M.vox.Z);
    switch (this.phase) {
      case "attract": {
        const a = this.view.t * 0.06 + 0.6, r = Math.min(60, S * 0.7);
        this.camPos.set(c.x + Math.sin(a) * r, c.y + 14 + S * 0.12, c.z + Math.cos(a) * r);
        this.camLook.set(c.x, c.y, c.z);
        cam.position.lerp(this.camPos, Math.min(1, dt * 2)); cam.lookAt(this.camLook);
        return;
      }
      case "intro": {
        const dur = this.plan.mode === "titan" ? 4.6 : 3.4, k = smooth(Math.min(1, t / dur));
        this.cameraPose(_v, _v2);
        let ox: number, oy: number, oz: number, lx = c.x, ly = c.y, lz = c.z;
        if (this.plan.mode === "obby") {
          // fly down the course from the finish back to the start
          const f = M.finish ?? c;
          ox = lerp(f.x + 6, this.p.x - 2, k); oy = lerp(f.y + 14, this.p.y + 6, k); oz = lerp(f.z + 10, this.p.z - 8, k);
          lx = lerp(f.x, this.p.x, k); ly = lerp(f.y, this.p.y, k); lz = lerp(f.z, this.p.z + 6, k);
        } else {
          const a = lerp(Math.PI * 1.1, 0, k) + this.camYaw, r = lerp(S * 0.62, 9, k), hgt = lerp(c.y + S * 0.4, this.p.y + 5, k);
          ox = this.p.x + (c.x - this.p.x) * (1 - k) - Math.sin(a) * r * 0.5; oy = hgt; oz = this.p.z + (c.z - this.p.z) * (1 - k) - Math.cos(a) * r;
        }
        if (this.titan && t > 1.2 && t < 3.6) {
          const kb = smooth(Math.min(1, (t - 1.2) / 0.7)) * (1 - smooth(Math.max(0, (t - 3.0) / 0.6)));
          const b = this.titan, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
          ox = lerp(ox, b.x + fx * 11 + fz * 3, kb); oy = lerp(oy, b.y + b.h * 0.7, kb); oz = lerp(oz, b.z + fz * 11 - fx * 3, kb);
          lx = lerp(lx, b.x, kb); ly = lerp(ly, b.y + b.h * 0.7, kb); lz = lerp(lz, b.z, kb);
          if (t > 1.9 && t < 1.95) { sfx("titanRoar"); this.shake = 0.5; }
        }
        const blend = smooth(clamp((k - 0.62) / 0.38, 0, 1));
        cam.position.set(lerp(ox, _v.x, blend), lerp(oy, _v.y, blend), lerp(oz, _v.z, blend));
        this.camLook.set(lerp(lx, _v2.x, blend), lerp(ly, _v2.y, blend), lerp(lz, _v2.z, blend));
        cam.lookAt(this.camLook); this.camPos.copy(cam.position);
        return;
      }
      case "clear": {
        if (t < 1.3) { const a = t * 0.9 + this.camYaw + Math.PI * 0.75; _v.set(this.focus.x + Math.sin(a) * 7, this.focus.y + 3, this.focus.z + Math.cos(a) * 7); cam.position.lerp(_v, Math.min(1, dt * 3)); cam.lookAt(this.focus); }
        else { const k = t - 1.3, a = this.camYaw + 0.45 + k * 0.55; _v.set(this.p.x + Math.sin(a) * 3.8, this.p.y + 1.7, this.p.z + Math.cos(a) * 3.8); cam.position.lerp(_v, Math.min(1, dt * 4)); _v2.set(this.p.x, this.p.y + 1.3, this.p.z); cam.lookAt(_v2); }
        return;
      }
      case "travel": { cam.position.y += dt * (14 + t * 40); _v2.set(this.p.x, this.p.y, this.p.z); cam.lookAt(_v2); return; }
      case "down": { _v.set(this.p.x + Math.sin(this.camYaw + Math.PI) * 6, Math.max(this.p.y, M.voidY) + 4 + t * 2, this.p.z + Math.cos(this.camYaw + Math.PI) * 6); cam.position.lerp(_v, Math.min(1, dt * 2)); _v2.set(this.p.x, Math.max(this.p.y, M.voidY) + 0.5, this.p.z); cam.lookAt(_v2); return; }
      default: {
        this.cameraPose(this.camPos, this.camLook);
        cam.position.copy(this.camPos);
        if (this.shake > 0) { const s = this.shake * this.shake * 0.25; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s; }
        cam.lookAt(this.camLook);
      }
    }
  }

  // ------------------------------------------------------------------ drawing
  private drawActors() {
    const v = this.view, t = v.t;
    v.beginShadows();
    if (this.hero) {
      this.hero.begin();
      const p = this.p, hp = this.heroPose;
      if (!p.dead) {
        hp.x = p.x; hp.y = p.y; hp.z = p.z; hp.yaw = p.yaw; hp.scale = 1; hp.bob = 0; hp.squash = 1;
        const cheer = this.phase === "clear" && this.phaseT > 1.2 ? 1 : 0;
        const aim = this.phase === "play" || this.phase === "intro" ? this.camPitch : this.phase === "attract" ? -0.3 : null;
        poseHuman(hp, "avatar", p.walk, p.walkAmt, cheer ? null : aim, 0, cheer, t);
        const f = p.hurt > 0 ? 1 + p.hurt * 4 : 1;
        hp.r = f * (p.hurt > 0 ? 1.4 : 1); hp.g = f * (p.hurt > 0 ? 0.6 : 1); hp.b = f * (p.hurt > 0 ? 0.6 : 1);
        if (this.powers.has("shield")) { const s = 1.2 + Math.sin(t * 12) * 0.2; hp.r *= 0.8; hp.g *= s; hp.b *= s * 1.2; }
        this.hero.push(hp);
        v.shadow(p.x, this.map.vox.floorBelow(p.x, p.y + 0.5, p.z), p.z, 0.42);
        if (p.jetting) for (let k = 0; k < 2; k++) v.sparks.spawn(p.x - Math.sin(p.yaw) * 0.25 + (k - 0.5) * 0.2, p.y + 0.55, p.z - Math.cos(p.yaw) * 0.25, 0, -2.5, 0, 0.14, 1.2, 0.6, 0.2, 0.12, 0, 0);
      }
      this.hero.end();
    }
    for (const r of this.rivals) {
      r.batch.begin();
      if (r.alive) {
        const P = r.pose;
        P.x = r.x; P.y = r.y; P.z = r.z; P.yaw = r.yaw; P.scale = 1; P.bob = 0; P.squash = 1;
        poseHuman(P, "avatar", r.walk, r.walkAmt, this.phase === "attract" ? null : r.aimP, 0, this.phase === "clear" && r.team === 0 ? 1 : 0, t + r.id);
        const fl = r.flash > 0 ? 3 : 1; P.r = fl; P.g = fl; P.b = fl;
        r.batch.push(P);
        v.shadow(r.x, this.map.vox.floorBelow(r.x, r.y + 0.5, r.z), r.z, 0.42);
      }
      r.batch.end();
    }
    for (const b of this.mobBatches.values()) b.begin();
    for (const m of this.mobs) {
      if (!m.alive) continue;
      const b = this.mobBatches.get(m.kind); if (!b) continue;
      const P = m.pose, rise = smooth(m.rise);
      P.x = m.x; P.y = m.y - (1 - rise) * m.h; P.z = m.z; P.yaw = m.yaw; P.scale = m.scale * (0.4 + 0.6 * rise); P.bob = 0; P.squash = 1;
      if (m.kind === "wisp") poseWisp(P, m.t);
      else if (m.kind === "hopper") poseHopper(P, m.onGround ? 0 : clamp(0.5 - m.vy / 20, 0, 1));
      else poseHuman(P, m.kind, m.walk, m.walkAmt, null, m.atk, 0, t, m.kind === "shambler");
      const fl = m.flash > 0 ? 3.2 : 1; P.r = fl; P.g = fl; P.b = fl;
      b.push(P);
      v.shadow(m.x, m.kind === "wisp" ? this.map.vox.floorBelow(m.x, m.y, m.z) : m.y, m.z, m.r * (m.kind === "wisp" ? 0.8 : 1.2) * rise);
    }
    for (const b of this.mobBatches.values()) b.end();
    v.endShadows();
    // crystals: spinning and glowing (faster pulses when nearly broken), with sparkles rising
    v.drawCrystals(this.map.crystals, TEAM_COLORS);
    for (const c of this.map.crystals) {
      if (!c.alive || Math.random() > 0.5) continue;
      const col = rgb(TEAM_COLORS[c.team]);
      v.sparks.spawn(c.x + (Math.random() - 0.5) * 1.2, c.y + Math.random() * 1.6, c.z + (Math.random() - 0.5) * 1.2, 0, 0.8, 0, 0.1, col[0] / 255, col[1] / 255, col[2] / 255, 0.7, 0.5, -0.3);
    }
  }

  private drawOverlay(dt: number) {
    const c = this.ovx, W = this.ov.width, H = this.ov.height;
    c.clearRect(0, 0, W, H);
    this.hitMark -= dt; this.killMark -= dt; this.dmgT -= dt;
    if (this.phase !== "play") return;
    const p = this.p;
    const red = Math.max(p.hp / p.maxHp < 0.3 ? 0.25 + Math.sin(this.view.t * 5) * 0.1 : 0, p.hurt > 0 ? p.hurt * 1.6 : 0);
    if (red > 0 && this.vignette) { c.globalAlpha = Math.min(1, red); c.drawImage(this.vignette, 0, 0); c.globalAlpha = 1; }
    const cx = W / 2, cy = H / 2;
    if (this.dmgT > 0) { const a = this.dmgDir - this.camYaw; c.save(); c.translate(cx, cy); c.rotate(-a + Math.PI); c.globalAlpha = Math.min(1, this.dmgT * 1.5); c.fillStyle = "#FF3B4E"; c.beginPath(); c.moveTo(-18, -78); c.lineTo(18, -78); c.lineTo(0, -98); c.closePath(); c.fill(); c.restore(); c.globalAlpha = 1; }
    c.textAlign = "center";
    // nametags over the rivals
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const d = Math.hypot(r.x - p.x, r.z - p.z);
      if (d > 45) continue;
      _v.set(r.x, r.y + r.h + 0.45, r.z).project(this.view.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
      const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      const col = r.team === 0 ? "#7CC4FF" : this.plan.mode === "crystal" ? TEAM_COLORS[r.team] : "#FF7A8A";
      c.font = "800 12px system-ui, sans-serif"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.6)";
      c.strokeText(r.name, sx, sy - 7); c.fillStyle = col; c.fillText(r.name, sx, sy - 7);
      c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(sx - 18, sy - 2, 36, 5);
      c.fillStyle = col; c.fillRect(sx - 17, sy - 1, 34 * Math.max(0, r.hp / r.maxHp), 3);
    }
    // objective markers: enemy crystals, your crystal, the finish
    const mark = (x: number, y: number, z: number, col: string, label: string) => {
      _v.set(x, y, z).project(this.view.camera);
      const behind = _v.z > 1;
      let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      if (behind) { sx = W - sx; sy = H - 30; }
      const m = 26; sx = clamp(sx, m, W - m); sy = clamp(sy, m + 80, H - m);
      c.fillStyle = col; c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sx, sy - 9); c.lineTo(sx + 8, sy); c.lineTo(sx, sy + 9); c.lineTo(sx - 8, sy); c.closePath(); c.stroke(); c.fill();
      if (label) { c.font = "800 11px system-ui, sans-serif"; c.lineWidth = 3; c.strokeText(label, sx, sy + 22); c.fillStyle = "#fff"; c.fillText(label, sx, sy + 22); }
    };
    for (const q of this.map.crystals) if (q.alive) mark(q.x, q.y + 2.6, q.z, TEAM_COLORS[q.team], q.team === 0 ? "YOURS" : `${Math.round(Math.hypot(q.x - p.x, q.z - p.z))} m`);
    if (this.map.finish) mark(this.map.finish.x, this.map.finish.y + 3, this.map.finish.z, "#FFD23F", `${Math.round(Math.hypot(this.map.finish.x - p.x, this.map.finish.z - p.z))} m`);
    if (this.titan && this.titan.alive) mark(this.titan.x, this.titan.y + this.titan.h + 1, this.titan.z, "#FF5CE1", "");
    for (const t of this.map.targets) if (!t.done && Math.hypot(t.x - p.x, t.z - p.z) < 16) mark(t.x + 0.5, t.y + 1.6, t.z + 0.5, "#FF3B4E", "SHOOT");
    // crosshair
    const spread = 7 + ((this.firing || this.aimOn) ? 4 : 0), col = this.aimOn ? "#FF4F6A" : "#ffffff";
    c.lineCap = "round";
    const seg = (x0: number, y0: number, x1: number, y1: number) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? col : "rgba(0,0,0,.5)"; c.lineWidth = pass ? 2 : 4;
      seg(cx - spread - 7, cy, cx - spread, cy); seg(cx + spread, cy, cx + spread + 7, cy); seg(cx, cy - spread - 7, cx, cy - spread); seg(cx, cy + spread, cx, cy + spread + 7);
    }
    c.fillStyle = col; c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    if (this.hitMark > 0 || this.killMark > 0) { const k = this.killMark > 0 ? 1.4 : 1; c.strokeStyle = this.killMark > 0 ? "#FFD23F" : "#ffffff"; c.lineWidth = 2.5; const a = 6 * k, b = 13 * k; seg(cx - b, cy - b, cx - a, cy - a); seg(cx + b, cy - b, cx + a, cy - a); seg(cx - b, cy + b, cx - a, cy + a); seg(cx + b, cy + b, cx + a, cy + a); }
    if (!this.touch && !this.pointerLocked) { c.font = "800 13px system-ui, sans-serif"; c.fillStyle = "rgba(255,255,255,.85)"; c.fillText("Click to aim with the mouse", cx, cy + 46); }
  }

  private emitHud() {
    const pl = this.plan, p = this.p;
    let goalText = "", progress = 0;
    switch (pl.mode) {
      case "sky": { const left = this.rivals.filter((r) => !r.out).length; goalText = `Rivals left ${left}`; progress = 1 - left / Math.max(1, this.rivals.length); break; }
      case "crystal": { const en = this.map.crystals.filter((c) => c.team !== 0), broken = en.filter((c) => !c.alive).length, rv = this.rivals.filter((r) => r.team !== 0 && !r.out).length; goalText = `Crystals ${broken}/${en.length} · Enemies ${rv}`; progress = (broken + (1 - rv / Math.max(1, this.rivals.filter((r) => r.team !== 0).length))) / (en.length + 1); break; }
      case "zombie": goalText = this.wave === 0 ? "Get ready…" : `Wave ${this.wave}/${pl.waves}`; progress = Math.max(0, this.wave - 1) / pl.waves + (this.wave > 0 ? 1 / pl.waves : 0) * 0.5; break;
      case "obby": { const f = this.map.finish; const tot = f ? Math.max(1, f.z - this.map.spawn.z) : 1; progress = clamp((p.z - this.map.spawn.z) / tot, 0, 1); goalText = f ? `Finish ${Math.max(0, Math.round(f.z - p.z))} m` : ""; break; }
      case "titan": goalText = pl.titan; progress = this.titan ? 1 - this.titan.hp / this.titan.maxHp : 0; break;
    }
    const th = this.theme;
    this.o.onHud({
      stage: this.stage, title: pl.title, subtitle: pl.subtitle, theme: pl.blend ? `${th.name} × ${THEMES.find((x) => x.id === pl.blend)!.name}` : th.name, accent: th.accent, remix: pl.remix, mods: pl.mods.map((m) => MOD_LABEL[m]), modeLabel: MODE_LABEL[pl.mode],
      goalText, progress: clamp(progress, 0, 1), hp: Math.max(0, p.hp), maxHp: p.maxHp, oil: p.oil / p.maxOil, cubes: this.powers.has("builder") ? 99 : p.cubes, coins: this.coins, lives: this.lives,
      powers: [...this.powers].map(([id, left]) => ({ id, left, secs: POWERS[id].secs })),
      boss: this.titan && this.titan.alive ? { name: pl.titan, hp: this.titan.hp / this.titan.maxHp } : null,
      crystals: this.map.crystals.length ? this.map.crystals.map((c) => ({ team: c.team, hp: c.hp / c.maxHp, alive: c.alive })) : null,
      phase: this.phase, finale: pl.finale,
    });
  }

  dispose() {
    this.stop(); this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey, true); window.removeEventListener("keyup", this.onKeyUp, true); window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("message", this.onMsg);
    window.removeEventListener("mouseup", this.onMouseUp); document.removeEventListener("mousemove", this.onMouseMove);
    this.view.renderer.domElement.removeEventListener("mousedown", this.onMouseDown); this.view.renderer.domElement.removeEventListener("contextmenu", this.onContext);
    for (const r of this.rivals) r.batch.dispose();
    for (const b of this.mobBatches.values()) b.dispose();
    this.hero?.dispose(); this.hero = null;
    this.view.dispose(); this.ov.remove();
    const w = window as unknown as { __cubeclash?: Game };
    if (w.__cubeclash === this) delete w.__cubeclash;
  }
}

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
