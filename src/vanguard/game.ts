// Voxel Vanguard: the game. An operation flows with no screens in between:
//  - the squad drops from the sky onto the landing pad on jet flames while the camera sweeps in over the sector under
//    letterbox bars ("Operation Iron Fern started!"); then phase after phase of the mission plays out in that sector:
//    clear the robots out, survive the onslaught, defend the world's core (robots rush it), destroy the robot beacons
//    that keep calling robots in, stand in the relay rings until they're yours, beat a squad of gold elites — and at
//    the very end, a boss. Robots never stop teleporting in from the gates while a phase runs;
//  - you run (left stick / WASD), look and aim (drag on the right / the mouse), fire (hold), jump and fly the jetpack
//    (hold; it burns oil, oil cans refill it), swap blasters, and switch between the over-the-shoulder view and first
//    person. Aim helps on phones: the crosshair settles on the robot nearest it;
//  - when a phase is won, every robot still standing blows apart; between sectors the camera orbits the squad and
//    they warp on to the next place (a new arena, the day moving on); progress is saved after every phase;
//  - robots drop coins (and sometimes hearts, oil and power cubes); hearts heal, or add a life when you're healthy;
//  - losing all your health costs a life (slow motion, the camera rises) and you're back on the pad; with no lives
//    left, or if the core you defend falls, the phase starts over — never the whole operation;
//  - the boss goes down in a slow-motion kill cam, the camera orbits the squad cheering, a white flash — and the next
//    operation begins by itself, forever (after 1200 come endless remixes).
import * as THREE from "three";
import { FrameGovernor, antialiasFor, autoQuality, isPhone, pixelRatioFor, shadowsFor, type Quality } from "@/lib/perf";
import { phasesIn, sectorView, stagePlan, type Objective, type Phase, type StagePlan } from "./stages";
import { buildArena, cellOf, clearLine, CELL_LAVA, CELL_WATER, solidAt, type Arena } from "./map";
import { paintAtlas } from "./art/atlas";
import { buildBackdrop, lookFor, type Backdrop, type Look } from "./art/backdrop";
import { gunGeometry, gunMaterial, pickupGeometry, POWER_COL, SQUAD, type PickupKind } from "./art/rigs";
import { Fx, DEBRIS, EXHAUST, FLASH, GLINT, SMOKE, SPARK } from "./fx";
import { allyThink, fall, inVoid, makeHuman, makeRobot, muzzleOf, pose, robotThink, walkTo, type Shot, type Unit, type World3 } from "./units";
import { ROBOTS, jetTank, maxHealth, outfitOf, runSpeed, tunedWeapon, weaponOf, type OutfitId, type WeaponId, type WeaponSpec } from "./gear";
import { VanguardAudio, sfx, type VanguardSfx } from "./sound";
import type { RobotKind } from "./worlds";
import { angDiff, clamp, hex, lerp, makeRng } from "./util";
import { Builder, C } from "./art/voxel";

export type Mode = "attract" | "intro" | "play" | "clear" | "warp" | "dead";
export type PowerId = "rapid" | "damage" | "shield" | "magnet" | "speed";
const POWER_SECS: Record<PowerId, number> = { rapid: 12, damage: 12, shield: 10, magnet: 14, speed: 12 };
export interface Hud {
  stage: number; codename: string; sector: number; sectors: number; sectorName: string; phase: number; phases: number;
  /** the phase's objective: what to do, and how far along it is */
  obj: { kind: Objective; title: string; line: string; prog: number; done: boolean } | null;
  hp: number; maxHp: number; lives: number; fuel: number; ammo: number; mag: number; reload: number;
  weapon: WeaponId; slot: 0 | 1; weapons: [WeaponId, WeaponId];
  coins: number; powers: { id: PowerId; left: number; secs: number }[];
  mode: Mode; boss: { name: string; hp: number } | null;
  allies: { name: string; color: string; hp: number; down: boolean }[];
  title: string; subtitle: string; world: string; accent: string; firstPerson: boolean; remix: boolean;
}
export type GameEvent =
  | { k: "start"; stage: number; codename: string; minutes: number; sectors: number; sector: number; sectorName: string; phase: number; remix: boolean; restart: boolean }
  | { k: "phase"; phase: number; phases: number; title: string; hint: string; kind: Objective; again: boolean }
  | { k: "phaseClear"; title: string; coins: number } | { k: "zone"; left: number }
  | { k: "sectorClear"; name: string; coins: number } | { k: "fail"; why: string } | { k: "boss"; name: string }
  | { k: "clear"; stage: number; kills: number; coins: number; time: number }
  | { k: "pickup"; what: PickupKind } | { k: "hurt" } | { k: "down"; livesLeft: number } | { k: "restart" }
  | { k: "ally"; name: string; up: boolean } | { k: "lowFuel" } | { k: "kill"; streak: number } | { k: "reload" } | { k: "fell" } | { k: "view"; first: boolean };

export interface GameOptions {
  weapons: [WeaponId, WeaponId]; levels: Partial<Record<WeaponId, number>>;
  suit: { armor: number; jet: number; boots: number }; outfit: OutfitId;
  lives: number; coins: number; firstPerson: boolean;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  onCoins: (n: number) => void; onLives: (n: number) => void; onStage: (next: number, kills: number) => void;
  /** a phase is won: where to come back to, and the robots destroyed since the last save */
  onCheckpoint: (stage: number, sector: number, phase: number, kills: number) => void;
}

interface Bolt { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; team: 0 | 1; splash: number; pierce: boolean; hex: number; kind: number; len: number; w: number; g: number; owner: number; hit: number; from: Unit | null }
const BOLT = 0, ROCKET = 1, MORTAR = 2, MISSILE = 3, CANNON = 4;
interface Beam { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; life: number; max: number; hex: number; w: number; jag: number }
interface Pickup { kind: PickupKind; x: number; y: number; z: number; vy: number; mesh: THREE.Mesh; t: number; value: number; settled: boolean }
interface Num { x: number; y: number; z: number; v: number; life: number; crit: boolean }

const ROBOT_COLS = [0x7a8296, 0x3a3e4e, 0xff8a2a, 0x9aa4b8, 0xff3a3a];
const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
const ZONE_R = 3.4;
// the relay rings' shapes and the core's material are shared by every phase
let zoneRingGeo: THREE.TorusGeometry | null = null, zoneDiscGeo: THREE.CircleGeometry | null = null;
const coreMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
interface Zone { x: number; y: number; z: number; prog: number; taken: boolean; ring: THREE.Mesh; fill: THREE.Mesh }
interface Core { x: number; y: number; z: number; hp: number; max: number; mesh: THREE.Mesh; top: THREE.Mesh; hurt: number; cells: [number, number][] }

export class Game {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
  private overlay: HTMLCanvasElement; private oc: CanvasRenderingContext2D;
  private quality: Quality;
  private gov: FrameGovernor;
  private W = 1; private H = 1; private pr = 1; private opr = 1;
  private raf = 0; private last = 0; private running = false; time = 0;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); private sunL = new THREE.DirectionalLight(0xffffff, 1.6);
  // the stage
  stage = 1; plan!: StagePlan; arena!: Arena; look!: Look;
  private stageGroup = new THREE.Group();
  private atlasMat: THREE.MeshLambertMaterial | null = null;
  private backdrop: Backdrop | null = null;
  private liquid: THREE.Mesh | null = null; private liquidTex: THREE.Texture | null = null;
  private mills: THREE.Mesh[] = []; private gateRings: THREE.Mesh[] = [];
  private fx = new Fx();
  // units
  player!: Unit; allies: Unit[] = []; robots: Unit[] = []; squad: Unit[] = [];
  private bolts: Bolt[] = []; private beams: Beam[] = []; private pickups: Pickup[] = []; private nums: Num[] = [];
  private pickGroup = new THREE.Group();
  // rules
  mode: Mode = "attract"; private modeT = 0;
  lives = 3; coins = 0; private stageCoins = 0; private kills = 0; private streak = 0; private streakT = 0; private stageT = 0;
  /** the whole operation (this.plan is the sector being fought) */
  op!: StagePlan; sectorI = 0; phaseI = 0;
  phase: Phase | null = null; phaseT = 0; private phaseWait = 0; phaseDone = false; phaseKills = 0; private spawnT = 0; private bossUp = false;
  core: Core | null = null; zones: Zone[] = []; towers: Unit[] = [];
  private goalPt = { x: 0, z: 0 }; private goalOn = false;
  private warpTo: { stage: number; sector: number; phase: number } | null = null;
  private killsBanked = 0;
  private boss: Unit | null = null;
  fuel = 1; private fuelMax = 3.2; private lowFuelWarned = false;
  private power: Record<PowerId, number> = { rapid: 0, damage: 0, shield: 0, magnet: 0, speed: 0 };
  private slot: 0 | 1 = 0; private ammo: [number, number] = [0, 0]; private reloadT = 0; private fireT = 0; private spec: [WeaponSpec, WeaponSpec];
  private gun: THREE.Mesh; private viewGun: THREE.Mesh;
  // input
  private move = { x: 0, y: 0 }; private keys = new Set<string>(); private firing = false; private jetting = false; private jetPress = false; private sprint = false;
  firstPerson = false;
  // camera
  private camYaw = 0; private camPitch = -0.12; private camDist = 4.4;
  private cam = new THREE.Vector3(); private camLook = new THREE.Vector3(); private shake = 0; private slow = 1; private slowT = 0; private bars = 0;
  private killCam: { x: number; y: number; z: number; t: number } | null = null;
  private bossCam = 0;
  private aim = new THREE.Vector3(); private locked: Unit | null = null; private hitMark = 0; private killMark = 0; private hurtT = 0;
  private opts: GameOptions;
  private audio: VanguardAudio | null = null;
  private hudT = 0;
  private reduced = false;
  private stepT = 0;
  // scratch
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private v3 = new THREE.Vector3(); private fwd = new THREE.Vector3(); private right = new THREE.Vector3();
  private proj = new THREE.Vector3();
  private onKey = (e: KeyboardEvent) => this.key(e);
  private onMouse = (e: MouseEvent) => this.mouse(e);
  private onResize = () => this.resize();

  constructor(host: HTMLElement, opts: GameOptions) {
    this.host = host; this.opts = opts;
    this.quality = autoQuality();
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(this.quality), powerPreference: "high-performance", stencil: false });
    this.pr = pixelRatioFor(this.quality);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = shadowsFor(this.quality);
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "vv-canvas";
    host.appendChild(this.renderer.domElement);
    this.overlay = document.createElement("canvas"); this.overlay.className = "vv-overlay";
    host.appendChild(this.overlay);
    this.oc = this.overlay.getContext("2d")!;
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(this.pr * k); this.resize(); });
    this.scene.add(this.hemi, this.sunL, this.sunL.target, this.stageGroup, this.fx.solid, this.fx.glow, this.pickGroup);
    this.sunL.castShadow = this.renderer.shadowMap.enabled;
    if (this.sunL.castShadow) { this.sunL.shadow.mapSize.set(1024, 1024); const s = this.sunL.shadow.camera; s.left = -30; s.right = 30; s.top = 30; s.bottom = -30; s.near = 1; s.far = 140; this.sunL.shadow.bias = -0.0015; }
    this.scene.add(this.camera);
    this.lives = opts.lives; this.coins = opts.coins; this.firstPerson = opts.firstPerson;
    this.spec = [this.tuned(opts.weapons[0]), this.tuned(opts.weapons[1])];
    this.gun = new THREE.Mesh(gunGeometry(this.spec[0].id, this.spec[0].color), gunMaterial);
    this.viewGun = new THREE.Mesh(gunGeometry(this.spec[0].id, this.spec[0].color), gunMaterial);
    this.viewGun.position.set(-0.32, -0.3, 0.55); this.viewGun.rotation.y = Math.PI; this.viewGun.scale.setScalar(1.25);
    this.camera.add(this.viewGun);
    this.resize();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey); window.addEventListener("keyup", this.onKey);
    window.addEventListener("mousemove", this.onMouse);
    this.renderer.domElement.addEventListener("mousedown", this.onMouse);
    window.addEventListener("mouseup", this.onMouse);
    // QA and the art script (scripts/art/vanguard_art.py) look at the game through this
    (window as unknown as { __voxelVanguard?: Game }).__voxelVanguard = this;
  }
  private tuned(id: WeaponId) { return tunedWeapon(weaponOf(id), this.opts.levels[id] ?? 0); }

  // ---------------------------------------------------------------- setup
  resize() {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.renderer.setSize(this.W, this.H, false);
    this.renderer.domElement.style.width = `${this.W}px`; this.renderer.domElement.style.height = `${this.H}px`;
    this.opr = Math.min(2, pixelRatioFor(this.quality));
    this.overlay.width = Math.round(this.W * this.opr); this.overlay.height = Math.round(this.H * this.opr);
    this.overlay.style.width = `${this.W}px`; this.overlay.style.height = `${this.H}px`;
    this.camera.aspect = this.W / this.H;
    // a tall phone sees wider with a little more field of view
    this.camera.fov = this.H > this.W ? 78 : 66;
    this.camera.updateProjectionMatrix();
  }

  setLoadout(weapons: [WeaponId, WeaponId], levels: Partial<Record<WeaponId, number>>, suit: GameOptions["suit"], outfit: OutfitId) {
    this.opts.weapons = weapons; this.opts.levels = levels; this.opts.suit = suit; this.opts.outfit = outfit;
    this.spec = [this.tuned(weapons[0]), this.tuned(weapons[1])];
    this.ammo = [this.spec[0].mag, this.spec[1].mag];
    if (this.plan) this.load(this.stage, this.mode === "attract" ? "attract" : "intro", false, { sector: this.sectorI, phase: this.phaseI });
  }

  /** build a stage */
  load(stage: number, mode: Mode = "intro", restart = false, at: { sector: number; phase: number } | null = null) {
    this.stage = stage;
    this.clearStage();
    this.op = stagePlan(stage);
    this.sectorI = clamp(at?.sector ?? 0, 0, this.op.sectors.length - 1);
    this.phaseI = clamp(at?.phase ?? 0, 0, this.op.sectors[this.sectorI].phases.length - 1);
    this.plan = sectorView(this.op, this.sectorI);
    this.arena = buildArena(this.plan);
    this.look = lookFor(this.plan);
    const l = this.look;
    // the arena mesh, with the world's pixel block atlas
    const tex = paintAtlas(l.world, l.partner, this.plan.blendAmt, this.plan.seed);
    this.atlasMat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    const ground = new THREE.Mesh(this.arena.geometry, this.atlasMat);
    ground.receiveShadow = this.renderer.shadowMap.enabled; ground.castShadow = this.renderer.shadowMap.enabled;
    this.stageGroup.add(ground);
    if (this.arena.liquid > -50) this.addLiquid();
    for (const m of this.arena.mills) {
      const b = new THREE.BoxGeometry(0.5, 7, 0.12), cross = new THREE.Mesh(b, new THREE.MeshLambertMaterial({ color: 0xf2eadb }));
      const s2 = new THREE.Mesh(b, cross.material); s2.rotation.z = Math.PI / 2; cross.add(s2);
      cross.position.set(m.x, m.y, m.z); this.stageGroup.add(cross); this.mills.push(cross);
    }
    // the robots' gates: glowing rings that pulse while they bring robots in
    const ringGeo = new THREE.TorusGeometry(1.25, 0.12, 4, 16), ringMat = new THREE.MeshBasicMaterial({ color: hex(l.world.palette.glow), transparent: true, opacity: 0.8 });
    for (const g of this.arena.gates) { const m = new THREE.Mesh(ringGeo, ringMat); m.rotation.x = Math.PI / 2; m.position.set(g.x, solidAt(this.arena, g.x, g.z) + 0.15, g.z); this.stageGroup.add(m); this.gateRings.push(m); }
    this.backdrop = buildBackdrop(l, this.plan, this.quality);
    this.scene.add(this.backdrop.group);
    this.scene.fog = new THREE.Fog(new THREE.Color(l.fog), l.fogNear, l.fogFar);
    this.scene.background = new THREE.Color(l.sky[2]);
    this.hemi.color.set(l.hemiSky); this.hemi.groundColor.set(l.hemiGround); this.hemi.intensity = l.hemiI * 1.55;
    this.sunL.color.set(l.sun); this.sunL.intensity = l.sunI;
    // the squad
    // on the home screen the squad stands out in the arena (the scenery behind them); in a fight they start on the pad
    let sp = this.arena.spawn;
    if (mode === "attract") {
      // an open spot near the middle: the squad's mates on flat ground and nothing between them and the camera in front
      const A = this.arena;
      let bd = 1e9;
      for (const q of A.spots) {
        if (Math.abs(q.x) >= A.half - 6) continue;
        const y = solidAt(A, q.x, q.z);
        let open = Math.abs(solidAt(A, q.x + 2, q.z - 1) - y) < 0.3 && Math.abs(solidAt(A, q.x - 2, q.z - 1) - y) < 0.3;
        for (let s = -0.6; s <= 0.61 && open; s += 0.3) open = clearLine(A, q.x + Math.sin(s) * 8.5, y + 2.4, q.z + Math.cos(s) * 8.5, q.x, y + 0.5, q.z);
        const d = Math.hypot(q.x, q.z + 3) + (open ? 0 : 1000);
        if (d < bd) { bd = d; sp = q; }
      }
    }
    const o = outfitOf(this.opts.outfit), py = solidAt(this.arena, sp.x, sp.z);
    this.player = makeHuman("ace", o, sp.x, sp.z, py, maxHealth(this.opts.suit.armor));
    this.player.rig.parts.armR.add(this.gun);
    this.gun.position.set(0, -0.58, 0.04); this.gun.rotation.set(Math.PI / 2, 0, 0);
    this.allies = [makeHuman("juno", o, sp.x + 2, sp.z - 1, py, 90), makeHuman("brick", o, sp.x - 2, sp.z - 1, py, 130)];
    for (const a of this.allies) { const g = new THREE.Mesh(gunGeometry(a.kind === "brick" ? "scatter" : "pulse", a.kind === "brick" ? "#FFB23A" : "#7CFF6A"), gunMaterial); g.position.set(0, -0.58, 0.04); g.rotation.set(Math.PI / 2, 0, 0); a.rig.parts.armR.add(g); }
    this.squad = [this.player, ...this.allies];
    for (const u of this.squad) { u.yaw = 0; this.stageGroup.add(u.rig.root); u.rig.root.traverse((m) => { (m as THREE.Mesh).castShadow = this.renderer.shadowMap.enabled; }); }
    this.camYaw = 0; this.camPitch = -0.12;
    this.fuelMax = jetTank(this.opts.suit.jet); this.fuel = 1;
    this.power = { rapid: 0, damage: 0, shield: 0, magnet: 0, speed: 0 };
    this.spec = [this.tuned(this.opts.weapons[0]), this.tuned(this.opts.weapons[1])];
    this.ammo = [this.spec[0].mag, this.spec[1].mag]; this.reloadT = 0; this.slot = 0; this.setGun();
    this.stageCoins = 0; this.kills = 0; this.killsBanked = 0; this.streak = 0; this.stageT = 0; this.boss = null;
    this.resetPhase(); this.phaseWait = 1.4;
    this.seedPickups();
    this.setMode(mode);
    if (mode === "intro") {
      // the squad drops in from the sky
      for (const u of this.squad) { u.y += 22 + Math.random() * 3; u.vy = -4; u.spawnT = 1; u.grounded = false; }
      this.opts.onEvent({ k: "start", stage, codename: this.op.codename, minutes: this.op.minutes, sectors: this.op.sectors.length, sector: this.sectorI, sectorName: this.sector.name, phase: this.phaseI, remix: this.op.remix > 0, restart });
    }
    this.placeCamera(true);
    this.audio?.setAmbience(l.world.ambience);
    this.pushHud();
  }

  private addLiquid() {
    const a = this.arena, lava = !!a.world.lava, cv = document.createElement("canvas");
    cv.width = cv.height = 16;
    const c = cv.getContext("2d")!, base = lava ? "#FF5A1A" : a.world.palette.water;
    c.fillStyle = base; c.fillRect(0, 0, 16, 16);
    const r = makeRng(3);
    for (let k = 0; k < 14; k++) { c.fillStyle = lava ? (k % 2 ? "#FFD27A" : "#C8301A") : "rgba(255,255,255,0.45)"; c.fillRect(Math.floor(r() * 14), Math.floor(r() * 16), 2 + Math.floor(r() * 3), 1); }
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(a.n / 2, a.n / 2); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(a.n, a.n), lava ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.82 }));
    m.rotation.x = -Math.PI / 2; m.position.y = a.liquid;
    this.liquid = m; this.liquidTex = t;
    this.stageGroup.add(m);
  }

  private clearStage() {
    for (const u of [...this.squad, ...this.robots]) { u.rig.mat.dispose(); }
    this.stageGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && m.geometry !== this.arena?.geometry) { /* shared rig geometry stays cached */ } });
    if (this.arena) this.arena.geometry.dispose();
    this.atlasMat?.map?.dispose(); this.atlasMat?.dispose(); this.atlasMat = null;
    this.liquidTex?.dispose(); this.liquid?.geometry.dispose(); (this.liquid?.material as THREE.Material | undefined)?.dispose(); this.liquid = null; this.liquidTex = null;
    for (const m of this.mills) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.mills = []; this.gateRings = [];
    this.clearObjective();
    this.stageGroup.clear();
    if (this.backdrop) { this.scene.remove(this.backdrop.group); this.backdrop.dispose(); this.backdrop = null; }
    for (const p of this.pickups) this.pickGroup.remove(p.mesh);
    this.pickups = []; this.bolts = []; this.beams = []; this.nums = []; this.robots = []; this.allies = []; this.squad = [];
    this.fx.clear();
  }

  private setMode(m: Mode) { this.mode = m; this.modeT = 0; }

  // ---------------------------------------------------------------- the loop
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0) this.frame(Math.min(0.05, dt));
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.audio?.silence(); }
  get isRunning() { return this.running; }
  /** from the menus into the fight */
  play() { if (this.mode === "attract") this.load(this.stage, "intro", false, { sector: this.sectorI, phase: this.phaseI }); this.ensureAudio(); }
  attract() { this.load(this.stage, "attract", false, { sector: this.sectorI, phase: this.phaseI }); this.audio?.silence(); }
  private ensureAudio() { if (!this.audio) { this.audio = new VanguardAudio(); this.audio.start(this.look.world.ambience); } }

  frame(dt: number) {
    if (!(dt > 0)) return;
    this.time += dt;
    this.modeT += dt;
    this.slowT = Math.max(0, this.slowT - dt);
    const target = this.slowT > 0 ? 0.28 : this.mode === "dead" && this.modeT < 1 ? 0.35 : 1;
    this.slow += (target - this.slow) * Math.min(1, dt * 10);
    const sdt = dt * this.slow;
    this.update(sdt, dt);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private update(dt: number, realDt: number) {
    const a = this.arena, p = this.player, m = this.mode;
    const g = a.world.gravity * (this.plan.twist === "lowgrav" ? 0.55 : 1);
    const w: World3 = { arena: a, squad: this.squad, player: p, diff: this.phase?.d ?? this.op.difficulty, g, goal: this.goalOn && this.phase && !this.phaseDone ? this.goalPt : null };
    this.stageT += m === "play" ? dt : 0;
    this.streakT -= dt; if (this.streakT <= 0) this.streak = 0;
    this.hurtT = Math.max(0, this.hurtT - realDt);
    this.hitMark = Math.max(0, this.hitMark - realDt); this.killMark = Math.max(0, this.killMark - realDt);
    for (const k of Object.keys(this.power) as PowerId[]) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt);
    // the squad landing (intro) / everyone's bodies
    if (m === "intro" || m === "attract") {
      for (const u of this.squad) {
        if (u.spawnT > 0 || !u.grounded) { u.jetting = u.y > solidAt(a, u.x, u.z) + 0.6; if (u.jetting) { u.vy = Math.max(u.vy, -9); u.vy += 14 * dt; } }
        const hit = fall(a, u, dt, g);
        if (hit > 3 && m === "intro") { this.fx.burst(SMOKE, u.x, u.y + 0.1, u.z, 8, 3, 0.8, 0.45, 0xd8d0c0, 0.5); if (u === p) { sfx("land", { gain: 0.9 }); this.shake = 0.35; } }
        if (u.grounded) { u.spawnT = 0; u.jetting = false; }
        u.speed = 0;
        pose(u, dt, this.time, m === "intro" && u.grounded, m === "attract" && u !== p && Math.sin(this.time * 0.6 + u.id) > 0.85);
      }
      if (m === "intro" && this.modeT > 3.1) { this.setMode("play"); this.ensureAudio(); }
      this.updatePickups(dt);
      this.fx.update(dt, (x, z) => solidAt(a, x, z));
      return;
    }
    if (m === "play" || m === "dead" || m === "clear") {
      if (m === "play") this.controlPlayer(dt, g);
      else { p.speed = 0; p.jetting = false; fall(a, p, dt, g); }
      for (let i = 0; i < this.allies.length; i++) {
        const u = this.allies[i];
        if (u.down > 0) { u.down -= dt; if (u.down <= 0) { u.down = 0; u.hp = u.maxHp * 0.6; u.flash = 1; this.opts.onEvent({ k: "ally", name: u.kind === "juno" ? SQUAD.juno.name : SQUAD.brick.name, up: true }); sfx("revive"); } }
        if (m === "play") allyThink(w, u, i, dt, this.robots, (s) => this.enemyOrAllyShot(s));
        else { u.speed = 0; fall(a, u, dt, g); }
      }
      // robots
      if (m === "play") {
        for (const r of this.robots) {
          if (!r.alive) continue;
          robotThink(w, r, dt, (s) => this.enemyOrAllyShot(s), (u) => this.rollerBlast(u), (u, kind, n) => this.summon(u, kind, n));
          // a robot that walks off an island into the void is gone (it counts as yours)
          if (r.y < -5) { r.alive = false; r.dead = 0; this.kills++; this.phaseKills++; if (r === this.boss) this.boss = null; }
          // stuck behind a wall for long: it teleports back in at a gate
          else if (r.stuck > 4 && !r.spec!.boss) { const gt = a.gates[r.id % a.gates.length]; r.x = gt.x; r.z = gt.z; r.y = solidAt(a, gt.x, gt.z); r.vy = 0; r.stuck = 0; r.spawnT = 0.9; }
        }
        this.phases(dt);
      }
      for (const r of this.robots) if (r.alive) pose(r, dt, this.time, true);
      for (const u of this.squad) pose(u, dt, this.time, u === p ? (m === "play" && (this.firing || !!this.locked)) || this.firstPerson : !!u.target, m === "clear" && this.modeT > 0.9);
      // dead robots finish falling apart, then go
      for (let i = this.robots.length - 1; i >= 0; i--) { const r = this.robots[i]; if (!r.alive) { r.dead += dt; if (r.dead > 0.05) { this.stageGroup.remove(r.rig.root); r.rig.mat.dispose(); this.robots.splice(i, 1); } } }
    }
    this.updateBolts(dt);
    this.updatePickups(dt);
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].life -= dt; if (this.beams[i].life <= 0) this.beams.splice(i, 1); }
    for (let i = this.nums.length - 1; i >= 0; i--) { const n = this.nums[i]; n.life -= realDt; n.y += realDt * 1.2; if (n.life <= 0) this.nums.splice(i, 1); }
    this.fx.update(dt, (x, z) => solidAt(a, x, z));
    if (m === "dead" && this.modeT > 2.2) this.respawn();
    if (m === "clear") this.clearStep(dt);
    if (m === "warp" && this.modeT > 0.55) { const to = this.warpTo; this.warpTo = null; this.load(to?.stage ?? this.stage, "intro", false, to ? { sector: to.sector, phase: to.phase } : null); }
    void realDt;
  }

  // ---------------------------------------------------------------- you
  private controlPlayer(dt: number, g: number) {
    const p = this.player, a = this.arena;
    // move, relative to the camera
    let mx = this.move.x, my = this.move.y;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const sprint = (this.sprint || this.keys.has("ShiftLeft") || ml > 0.95) && my > 0.3 && !this.firing;
    const water = this.cellKind(p) === CELL_WATER && p.y < a.liquid + 0.2;
    const sp = runSpeed(this.opts.suit.boots) * (sprint ? 1.3 : 1) * (this.power.speed > 0 ? 1.35 : 1) * (water ? 0.6 : 1) * (this.firing ? 0.85 : 1);
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const dx = (sy * my - cy * mx) * sp * dt, dz = (cy * my + sy * mx) * sp * dt;
    walkTo(a, p, dx, dz, p.grounded ? 0.55 : 0.3);
    p.speed = ml * sp;
    // face where you aim
    p.yaw += clamp(angDiff(p.yaw, this.camYaw), -dt * 14, dt * 14);
    p.aimPitch = this.camPitch;
    // jump, jetpack
    const jetKey = this.jetting || this.keys.has("Space");
    if (jetKey && !this.jetPress && p.grounded) { p.vy = 8.6; p.grounded = false; sfx("jump", { gain: 0.6 }); }
    this.jetPress = jetKey;
    p.jetting = false;
    if (jetKey && !p.grounded && this.fuel > 0 && p.vy < 6.5) {
      p.vy += (g + 16) * dt; p.jetting = true;
      this.fuel = Math.max(0, this.fuel - dt / this.fuelMax);
      if (Math.random() < 0.9) { const bx = p.x - Math.sin(p.yaw) * 0.32, bz = p.z - Math.cos(p.yaw) * 0.32; this.fx.spawn(EXHAUST, bx, p.y + 0.55, bz, (Math.random() - 0.5), -5 - Math.random() * 2, (Math.random() - 0.5), 0.35, 0.22, 0xffb03a); }
      this.audio?.jet(true);
      if (this.fuel < 0.2 && !this.lowFuelWarned) { this.lowFuelWarned = true; this.opts.onEvent({ k: "lowFuel" }); sfx("lowFuel"); }
    } else this.audio?.jet(false);
    if (p.grounded) this.fuel = Math.min(1, this.fuel + dt * 0.05);
    if (this.fuel > 0.35) this.lowFuelWarned = false;
    const hit = fall(a, p, dt, g);
    if (hit > 6) { sfx("land", { gain: clamp(hit / 14, 0.3, 1) }); this.fx.burst(SMOKE, p.x, p.y + 0.05, p.z, 6, 2.5, 0.6, 0.35, 0xd8d0c0, 0.4); this.shake = Math.max(this.shake, clamp(hit / 30, 0.05, 0.3)); }
    // footsteps
    if (p.grounded && p.speed > 1) { this.stepT -= dt * p.speed; if (this.stepT <= 0) { this.stepT = 2.2; sfx("step", { gain: 0.25, rate: 0.9 + Math.random() * 0.2 }); } }
    // lava, the void
    if (this.cellKind(p) === CELL_LAVA && p.y < a.liquid + 0.3) this.damagePlayer(28 * dt, null, true);
    if (inVoid(a, p)) { this.damagePlayer(30, null, true); this.opts.onEvent({ k: "fell" }); if (p.alive) this.toPad(p); }
    // weapons
    this.fireT -= dt;
    const ws = this.spec[this.slot];
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo[this.slot] = ws.mag; sfx("reloaded", { gain: 0.6 }); } }
    if (this.keys.has("KeyR") && this.reloadT <= 0 && this.ammo[this.slot] < ws.mag) this.reload();
    if (this.firing && this.fireT <= 0 && this.reloadT <= 0) {
      if (this.ammo[this.slot] <= 0) this.reload();
      else this.shoot(ws);
    }
  }
  private cellKind(u: Unit) { const c = cellOf(this.arena, u.x, u.z); return c < 0 ? 0 : this.arena.kind[c]; }
  private toPad(u: Unit) { const sp = this.arena.spawn; u.x = sp.x; u.z = sp.z; u.y = solidAt(this.arena, sp.x, sp.z) + 4; u.vy = 0; }
  private reload() { if (this.reloadT > 0) return; this.reloadT = this.spec[this.slot].reload; sfx("reload", { gain: 0.7 }); this.opts.onEvent({ k: "reload" }); }
  swap() {
    if (this.mode !== "play" || this.opts.weapons[0] === this.opts.weapons[1]) return;
    this.slot = this.slot === 0 ? 1 : 0; this.reloadT = 0; this.fireT = 0.25;
    this.setGun(); sfx("swap");
  }
  private setGun() {
    const s = this.spec[this.slot];
    this.gun.geometry = gunGeometry(s.id, s.color); this.viewGun.geometry = gunGeometry(s.id, s.color);
  }

  private shoot(ws: WeaponSpec) {
    const p = this.player;
    this.ammo[this.slot]--;
    const rate = ws.rate * (this.power.rapid > 0 ? 1.8 : 1);
    this.fireT = 1 / rate;
    const dmgMul = this.power.damage > 0 ? 2 : 1;
    const m = this.firstPerson ? this.viewMuzzle() : muzzleOf(p);
    const aim = this.aim;
    p.recoil = 1;
    this.shake = Math.max(this.shake, ws.recoil * 0.12);
    this.fx.cube(m.x, m.y, m.z, 0.28 + ws.recoil * 0.25, hex(ws.glow), 1.4);
    this.fx.spawn(FLASH, m.x, m.y, m.z, 0, 0, 0, 0.06, 0.35 + ws.recoil * 0.3, hex(ws.glow));
    sfx(`fire_${ws.id}` as VanguardSfx, { gain: 0.6, rate: 0.95 + Math.random() * 0.1 });
    // camera kick
    this.camPitch = clamp(this.camPitch + ws.recoil * 0.012, -1.1, 0.85);
    const dx = aim.x - m.x, dy = aim.y - m.y, dz = aim.z - m.z, d = Math.hypot(dx, dy, dz) || 1;
    if (ws.id === "rail" || ws.id === "arc") { this.hitscan(ws, m.x, m.y, m.z, dx / d, dy / d, dz / d, dmgMul); return; }
    for (let k = 0; k < ws.pellets; k++) {
      const sp = ws.spread * (this.firstPerson ? 0.8 : 1);
      const ex = (Math.random() - 0.5) * 2 * sp, ey = (Math.random() - 0.5) * 2 * sp, ez = (Math.random() - 0.5) * 2 * sp;
      const vx = dx / d + ex, vy = dy / d + ey, vz = dz / d + ez, vl = Math.hypot(vx, vy, vz);
      this.bolts.push({ x: m.x, y: m.y, z: m.z, vx: (vx / vl) * ws.speed, vy: (vy / vl) * ws.speed, vz: (vz / vl) * ws.speed, life: ws.range / ws.speed, dmg: ws.damage * dmgMul, team: 0, splash: ws.splash, pierce: ws.pierce, hex: hex(ws.color), kind: ws.id === "boom" ? ROCKET : BOLT, len: ws.id === "boom" ? 0.7 : ws.pellets > 1 ? 0.5 : 1.1, w: ws.id === "boom" ? 0.24 : 0.12, g: 0, owner: p.id, hit: 0, from: p });
    }
  }
  /** rail: a piercing beam; arc: lightning that jumps from robot to robot */
  private hitscan(ws: WeaponSpec, x: number, y: number, z: number, dx: number, dy: number, dz: number, mul: number) {
    const a = this.arena;
    let end = ws.range;
    for (let t = 0.4; t < ws.range; t += 0.4) if (y + dy * t < solidAt(a, x + dx * t, z + dz * t)) { end = t; break; }
    if (ws.id === "rail") {
      for (const r of this.robots) {
        if (!r.alive || r.spawnT > 0) continue;
        const cx = r.x - x, cy = r.y + r.height * 0.5 - y, cz = r.z - z, t = cx * dx + cy * dy + cz * dz;
        if (t < 0 || t > end) continue;
        const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
        if (px * px + py * py + pz * pz < (r.radius + 0.35) * (r.radius + 0.35) * (r.spec!.boss ? 3 : 1.6)) this.hurtRobot(r, ws.damage * mul, x + dx * t, y + dy * t, z + dz * t);
      }
      this.beams.push({ x0: x, y0: y, z0: z, x1: x + dx * end, y1: y + dy * end, z1: z + dz * end, life: 0.22, max: 0.22, hex: hex(ws.color), w: 0.12, jag: 0 });
      this.fx.burst(SPARK, x + dx * end, y + dy * end, z + dz * end, 8, 6, 0.3, 0.08, hex(ws.glow));
      return;
    }
    // arc: the locked robot (or the one under the crosshair), then two more close by
    let first = this.locked;
    if (!first || !first.alive) {
      let best = 1e9;
      for (const r of this.robots) {
        if (!r.alive || r.spawnT > 0) continue;
        const cx = r.x - x, cy = r.y + r.height * 0.5 - y, cz = r.z - z, t = cx * dx + cy * dy + cz * dz;
        if (t < 0 || t > Math.min(end, ws.range)) continue;
        const off = Math.hypot(cx - dx * t, cy - dy * t, cz - dz * t);
        if (off < 1.8 && t < best) { best = t; first = r; }
      }
    }
    if (!first) { this.beams.push({ x0: x, y0: y, z0: z, x1: x + dx * Math.min(end, 14), y1: y + dy * Math.min(end, 14), z1: z + dz * Math.min(end, 14), life: 0.08, max: 0.08, hex: hex(ws.color), w: 0.07, jag: 0.4 }); return; }
    const hitSet: Unit[] = [first];
    let fx = x, fy = y, fz = z, cur: Unit | null = first, dmg = ws.damage * mul;
    for (let k = 0; k < 3 && cur; k++) {
      const tx = cur.x, ty = cur.y + cur.height * 0.5, tz = cur.z;
      this.beams.push({ x0: fx, y0: fy, z0: fz, x1: tx, y1: ty, z1: tz, life: 0.1, max: 0.1, hex: hex(ws.color), w: 0.08, jag: 0.5 });
      this.hurtRobot(cur, dmg, tx, ty, tz);
      fx = tx; fy = ty; fz = tz; dmg *= 0.75;
      let next: Unit | null = null, nd = 7;
      for (const r of this.robots) { if (!r.alive || hitSet.includes(r) || r.spawnT > 0) continue; const d = Math.hypot(r.x - tx, r.z - tz); if (d < nd) { nd = d; next = r; } }
      if (next) hitSet.push(next);
      cur = next;
    }
  }
  private viewMuzzle() {
    this.v1.set(-0.32, -0.26, -1.0).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    return { x: this.v1.x, y: this.v1.y, z: this.v1.z };
  }

  // ---------------------------------------------------------------- shots in flight
  private enemyOrAllyShot(s: Shot) {
    const u = s.from, spec = u.spec;
    const dx = s.tx - s.x, dy = s.ty - s.y, dz = s.tz - s.z, d = Math.hypot(dx, dy, dz) || 1;
    const near = this.nearCam(s.x, s.z, 40);
    if (u.team === 0) {
      const sp = 70, dmg = u.kind === "brick" ? 13 : 9;
      this.bolts.push({ x: s.x, y: s.y, z: s.z, vx: (dx / d) * sp, vy: (dy / d) * sp, vz: (dz / d) * sp, life: 0.8, dmg, team: 0, splash: 0, pierce: false, hex: u.kind === "brick" ? 0xffb23a : 0x7cff6a, kind: BOLT, len: 0.9, w: 0.1, g: 0, owner: u.id, hit: 0, from: u });
      if (near) sfx(u.kind === "brick" ? "fire_scatter" : "fire_pulse", { gain: 0.2, pan: this.pan(s.x, s.z) });
      this.fx.cube(s.x, s.y, s.z, 0.25, 0xd8ffc8, 1);
      return;
    }
    const dmg = (spec?.damage ?? 7) * (0.95 + (this.phase?.d ?? this.op.difficulty) * 0.95);
    if (s.kind === "beam") {
      this.beams.push({ x0: s.x, y0: s.y, z0: s.z, x1: s.tx, y1: s.ty, z1: s.tz, life: 0.25, max: 0.25, hex: 0xff5af0, w: 0.14, jag: 0 });
      const t = u.target;
      if (t) { if (t === this.player) this.damagePlayer(dmg, u); else this.hurtAlly(t, dmg); }
      sfx("beam", { pan: this.pan(s.x, s.z), gain: 0.7 });
      return;
    }
    if (s.kind === "mortar" || s.kind === "missile") {
      // a lobbed shell: aimed to land at the target in a fixed time
      const T = s.kind === "missile" ? 1.3 : 1.5, gg = 16;
      this.bolts.push({ x: s.x, y: s.y, z: s.z, vx: dx / T, vy: (dy + 0.5 * gg * T * T) / T, vz: dz / T, life: T + 1, dmg: dmg * (s.kind === "missile" ? 1 : 1.1), team: 1, splash: 2.6, pierce: false, hex: s.kind === "missile" ? 0xff6a3a : 0xffb03a, kind: s.kind === "missile" ? MISSILE : MORTAR, len: 0.5, w: 0.28, g: gg, owner: u.id, hit: 0, from: u });
      if (near) sfx("mortar", { pan: this.pan(s.x, s.z), gain: 0.5 });
      return;
    }
    const cannon = s.kind === "cannon", sp = spec?.shot ?? 32;
    this.bolts.push({ x: s.x, y: s.y, z: s.z, vx: (dx / d) * sp, vy: (dy / d) * sp, vz: (dz / d) * sp, life: 2.4, dmg, team: 1, splash: cannon ? 1.6 : 0, pierce: false, hex: cannon ? 0xff8a2a : 0xff3a3a, kind: cannon ? CANNON : BOLT, len: cannon ? 0.5 : 0.8, w: cannon ? 0.34 : 0.13, g: 0, owner: u.id, hit: 0, from: u });
    this.fx.cube(s.x, s.y, s.z, cannon ? 0.5 : 0.25, 0xff7a5a, 1.2);
    if (near) sfx(cannon ? "cannon" : "enemyShot", { pan: this.pan(s.x, s.z), gain: cannon ? 0.6 : 0.35, rate: 0.9 + Math.random() * 0.2 });
  }

  private updateBolts(dt: number) {
    const a = this.arena;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy, b.vz) * dt) / 0.5));
      const h = dt / steps;
      let dead = b.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        b.vy -= b.g * h;
        b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        if (b.kind === ROCKET || b.kind === MISSILE) if (Math.random() < 0.4) this.fx.spawn(SMOKE, b.x, b.y, b.z, 0, 0.3, 0, 0.5, 0.22, 0x8a8a92);
        // blocks
        if (b.y < solidAt(a, b.x, b.z)) { dead = true; this.impact(b, true); break; }
        // units
        const targets = b.team === 0 ? this.robots : this.squad;
        for (const u of targets) {
          if (!u.alive || u.down > 0 || (u.spawnT > 0 && u.team === 1) || u.id === b.hit) continue;
          const cy = u.y + u.height * 0.5, rr = u.radius + (b.kind === MORTAR || b.kind === MISSILE ? 0.3 : 0.15);
          const dxu = b.x - u.x, dzu = b.z - u.z, dyu = b.y - cy;
          if (dxu * dxu + dzu * dzu < rr * rr * (u.spec?.boss ? 2.2 : 1.4) && Math.abs(dyu) < u.height * 0.55 + 0.1) {
            if (u.team === 1) this.hurtRobot(u, b.dmg, b.x, b.y, b.z);
            else if (u === this.player) this.damagePlayer(b.dmg, b.from);
            else this.hurtAlly(u, b.dmg);
            if (b.pierce) { b.hit = u.id; continue; }
            dead = true; this.impact(b, false); break;
          }
        }
      }
      if (dead || Math.abs(b.x) > a.half + 4 || Math.abs(b.z) > a.half + 4) this.bolts.splice(i, 1);
    }
  }
  private impact(b: Bolt, wall: boolean) {
    const near = this.nearCam(b.x, b.z, 45);
    if (b.splash > 0) {
      if (near) { this.fx.explode(b.x, b.y, b.z, b.splash * 0.5, [0x5a5e6e, 0x3a3e4e, 0xffb03a], this.quality === "low" ? 0.5 : 1); sfx("boom", { pan: this.pan(b.x, b.z), gain: clamp(1 - this.distCam(b.x, b.z) / 50, 0.25, 1) }); }
      this.shake = Math.max(this.shake, clamp(0.5 - this.distCam(b.x, b.z) / 40, 0, 0.5));
      const targets = b.team === 0 ? this.robots : this.squad;
      for (const u of targets) {
        if (!u.alive || u.down > 0) continue;
        const d = Math.hypot(u.x - b.x, u.y + u.height * 0.4 - b.y, u.z - b.z);
        if (d > b.splash) continue;
        const k = 1 - d / b.splash * 0.6;
        if (u.team === 1) this.hurtRobot(u, b.dmg * k, u.x, u.y + u.height * 0.5, u.z);
        else if (u === this.player) this.damagePlayer(b.dmg * k * 0.8, b.from);
        else this.hurtAlly(u, b.dmg * k * 0.6);
      }
      return;
    }
    if (near) {
      this.fx.burst(SPARK, b.x, b.y, b.z, wall ? 4 : 6, 5, 0.25, 0.07, b.hex);
      if (wall) this.fx.burst(DEBRIS, b.x, b.y, b.z, 2, 3, 0.5, 0.08, 0x8a8a8a);
    }
  }

  // ---------------------------------------------------------------- damage
  private hurtRobot(r: Unit, dmg: number, x: number, y: number, z: number) {
    if (!r.alive) return;
    r.hp -= dmg; r.flash = 1;
    this.hitMark = 0.12;
    if (this.nums.length < 24 && this.nearCam(x, z, 50)) this.nums.push({ x, y: y + 0.3, z, v: Math.round(dmg), life: 0.7, crit: dmg > 40 });
    if (this.nearCam(x, z, 40) && Math.random() < 0.5) sfx("hit", { pan: this.pan(x, z), gain: 0.35, rate: 0.9 + Math.random() * 0.3 });
    if (r.hp <= 0) this.killRobot(r);
  }
  private killRobot(r: Unit, chain = false) {
    r.alive = false; r.dead = 0;
    const spec = r.spec!;
    const y = r.y + r.height * 0.45;
    this.fx.explode(r.x, y, r.z, spec.boss ? 4 : spec.scale, r.elite ? [0xc8a040, 0x3a3e4e, 0xffd27a] : r.kind === "tower" ? [0x3a3e4e, 0xff3a6a, 0xffd23f] : ROBOT_COLS, this.quality === "low" || chain ? 0.6 : 1);
    if (!chain || Math.random() < 0.35) sfx(spec.boss ? "bossDown" : "boom", { pan: this.pan(r.x, r.z), gain: spec.boss ? 1 : 0.7 });
    if (!chain) this.phaseKills++;
    this.shake = Math.max(this.shake, spec.boss ? 1 : clamp(0.35 - this.distCam(r.x, r.z) / 60, 0.05, 0.35));
    this.kills++; this.streak++; this.streakT = 3;
    this.killMark = 0.25;
    if (this.streak >= 3) this.opts.onEvent({ k: "kill", streak: this.streak });
    // loot: coins always, now and then a heart, an oil can or a power cube
    const coins = Math.round(spec.coins * (1 + this.stage / 200) * (r.elite ? 2 : 1) * (this.plan.twist === "coins" ? 2 : 1));
    const pieces = spec.boss ? 14 : Math.min(5, 1 + Math.floor(coins / 6));
    for (let k = 0; k < pieces; k++) this.drop(k % 7 === 6 ? "gem" : "coin", r.x, y, r.z, k % 7 === 6 ? Math.ceil(coins / pieces) * 3 : Math.ceil(coins / pieces));
    const hpLow = this.player.hp / this.player.maxHp < 0.45;
    const roll = Math.random();
    if (roll < (hpLow ? 0.16 : 0.06)) this.drop("heart", r.x, y, r.z, 1);
    else if (roll < 0.15) this.drop("oil", r.x, y, r.z, 1);
    else if (roll < 0.2 || spec.boss) this.drop((["rapid", "damage", "shield", "magnet", "speed"] as PickupKind[])[Math.floor(Math.random() * 5)], r.x, y, r.z, 1);
    if (r === this.boss) { this.boss = null; this.slowT = 1.4; }
    // the robot that wins the phase: a slow-motion kill cam
    const ph = this.phase;
    if (!chain && ph && !this.phaseDone && ((ph.kind === "boss" && spec.boss) || ((ph.kind === "assault" || ph.kind === "elite") && this.phaseKills >= ph.count) || (ph.kind === "sabotage" && r.kind === "tower" && !this.towers.some((t) => t.alive)))) {
      if (!this.reduced) this.slowT = 1.2;
      this.killCam = { x: r.x, y, z: r.z, t: 1.3 };
    }
  }
  private hurtAlly(u: Unit, dmg: number) {
    if (u.down > 0 || this.mode !== "play") return;
    u.hp -= dmg * 0.7; u.flash = 1;
    if (u.hp <= 0) { u.hp = 0; u.down = 7; this.opts.onEvent({ k: "ally", name: u.kind === "juno" ? SQUAD.juno.name : SQUAD.brick.name, up: false }); sfx("downed", { pan: this.pan(u.x, u.z) }); }
  }
  private damagePlayer(dmg: number, from: Unit | null, env = false) {
    const p = this.player;
    if (this.mode !== "play" || !p.alive) return;
    if (p.shield > 0 || (this.power.shield > 0 && !env)) { if (!env) { sfx("shieldHit", { gain: 0.5 }); this.fx.burst(SPARK, p.x, p.y + 1, p.z, 5, 4, 0.2, 0.07, 0x5ab8ff); } return; }
    p.hp -= dmg; p.flash = 0.35;
    this.hurtT = 0.35; this.shake = Math.max(this.shake, clamp(dmg / 40, 0.08, 0.4));
    if (!env) sfx("hurt", { gain: 0.6 });
    if (from && !env) this.hitFrom = { x: from.x, z: from.z, t: 1 };
    this.opts.onEvent({ k: "hurt" });
    if (p.hp <= 0) this.playerDown();
  }
  hitFrom: { x: number; z: number; t: number } | null = null;
  private playerDown() {
    const p = this.player;
    p.hp = 0; p.down = 99;
    this.lives = Math.max(0, this.lives - 1); this.opts.onLives(this.lives);
    sfx("lifeLost");
    this.setMode("dead");
    this.firing = false;
    this.opts.onEvent({ k: "down", livesLeft: this.lives });
  }
  private respawn() {
    if (this.lives <= 0) {
      this.lives = 3; this.opts.onLives(3);
      this.restartPhase("Out of lives");
      return;
    }
    const p = this.player;
    p.down = 0; p.hp = p.maxHp; p.alive = true; p.shield = 3;
    this.toPad(p); p.y -= 3.5;
    this.fx.burst(FLASH, p.x, p.y + 1, p.z, 1, 0, 0.3, 2.5, 0x9af0ff);
    this.setMode("play");
  }
  private rollerBlast(u: Unit) {
    u.hp = 0;
    const b: Bolt = { x: u.x, y: u.y + 0.4, z: u.z, vx: 0, vy: 0, vz: 0, life: 0, dmg: (u.spec?.damage ?? 24) * (0.95 + (this.phase?.d ?? this.op.difficulty) * 0.8), team: 1, splash: 2.6, pierce: false, hex: 0xff8a2a, kind: CANNON, len: 0, w: 0, g: 0, owner: u.id, hit: 0, from: u };
    this.killRobot(u);
    this.impact(b, false);
  }
  private summon(u: Unit, kind: RobotKind, n: number) {
    if (u.kind === "tower" && this.phase) {
      kind = this.pickKind();
      let alive = 0; for (const r of this.robots) if (r.alive && r.kind !== "tower") alive++;
      if (alive >= this.phase.cap + 3) return;
    }
    if (this.robots.length > 34) return;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, x = clamp(u.x + Math.cos(a) * 3, -this.arena.half + 3, this.arena.half - 3), z = clamp(u.z + Math.sin(a) * 3, -this.arena.half + 3, this.arena.half - 3);
      this.spawnRobot(kind, false, x, z);
    }
  }

  // ---------------------------------------------------------------- phases
  private get sector() { return this.op.sectors[this.sectorI]; }
  private resetPhase() {
    this.phase = null; this.phaseT = 0; this.phaseDone = false; this.phaseKills = 0; this.spawnT = 0; this.bossUp = false;
    this.goalOn = false; this.towers = [];
    this.clearObjective();
  }
  /** this phase's number counted through the whole operation (1-based) */
  get phaseNo() { let n = 0; for (let i = 0; i < this.sectorI; i++) n += this.op.sectors[i].phases.length; return n + this.phaseI + 1; }
  private pickKind(): RobotKind {
    const mix = this.phase!.mix;
    let t = 0; for (const [, w] of mix) t += w;
    let v = Math.random() * t;
    for (const [k, w] of mix) { v -= w; if (v <= 0) return k; }
    return mix[0][0];
  }
  /** n arena spots spread far apart (and away from the landing pad) */
  private spread(n: number) {
    const a = this.arena, pad = a.spawn, out: { x: number; z: number }[] = [];
    if (!a.spots.length) { for (let k = 0; k < n; k++) out.push({ x: pad.x + (k - n / 2) * 3, z: pad.z + 6 }); return out; }
    const py = solidAt(a, pad.x, pad.z);
    const ok = a.spots.filter((q) => Math.hypot(q.x - pad.x, q.z - pad.z) > 8 && Math.abs(q.x) < a.half - 3 && Math.abs(q.z) < a.half - 3 && Math.abs(solidAt(a, q.x, q.z) - py) <= 2);
    const pool = ok.length >= n ? ok : a.spots;
    out.push(pool[Math.floor(Math.random() * pool.length)]);
    while (out.length < n) {
      let best = pool[0], bd = -1;
      for (const q of pool) { let d = 1e9; for (const o of out) d = Math.min(d, Math.hypot(q.x - o.x, q.z - o.z)); if (d > bd) { bd = d; best = q; } }
      out.push(best);
    }
    return out;
  }
  private phases(dt: number) {
    if (!this.phase) { this.phaseWait -= dt; if (this.phaseWait <= 0) this.startPhase(); return; }
    const ph = this.phase;
    if (this.phaseDone) { this.phaseWait -= dt; if (this.phaseWait <= 0) this.nextPhase(); return; }
    this.phaseT += dt;
    // robots keep teleporting in from the gates for as long as the phase runs
    let alive = 0;
    for (const r of this.robots) if (r.alive && r.kind !== "tower") alive++;
    const cap = Math.min(ph.cap, this.quality === "low" ? 11 : this.quality === "medium" ? 15 : 19);
    const more = ph.kind === "assault" || ph.kind === "elite" ? this.phaseKills + alive < ph.count : true;
    this.spawnT -= dt;
    if (more && alive < cap && this.spawnT <= 0) {
      const gate = this.arena.gates[Math.floor(Math.random() * this.arena.gates.length)];
      this.spawnRobot(this.pickKind(), Math.random() < ph.elite, gate.x + (Math.random() - 0.5) * 2, gate.z + (Math.random() - 0.5) * 2);
      // they pour in when a phase opens, then come at the phase's pace
      this.spawnT = (this.phaseT < 8 ? 0.4 : ph.every) * (0.7 + Math.random() * 0.6);
    }
    switch (ph.kind) {
      case "assault": case "elite": if (this.phaseKills >= ph.count) this.completePhase(); break;
      case "survive": if (this.phaseT >= ph.secs) this.completePhase(); break;
      case "defend": {
        const c = this.core!;
        // up to five robots on the ground beside it drain it; left alone, it slowly repairs itself
        let at = 0;
        for (const r of this.robots) if (r.alive && r.kind !== "tower" && !r.spec!.flying && r.spawnT <= 0 && Math.abs(r.x - c.x) < 3.6 && Math.abs(r.z - c.z) < 3.6 && at < 5) { at++; c.hp -= r.spec!.damage * 0.45 * (r.elite ? 1.5 : 1) * dt; c.hurt = 0.35; }
        if (at === 0) c.hp = Math.min(c.max, c.hp + c.max * 0.012 * dt);
        if (c.hp <= 0) { this.coreLost(); break; }
        if (this.phaseT >= ph.secs) this.completePhase();
        break;
      }
      case "sabotage": if (!this.towers.some((t) => t.alive)) this.completePhase(); break;
      case "capture": {
        const p = this.player;
        let open = 0, near: Zone | null = null, nd = 1e9;
        for (const z of this.zones) {
          if (z.taken) continue;
          open++;
          const d = Math.hypot(p.x - z.x, p.z - z.z);
          if (d < nd) { nd = d; near = z; }
          if (d < ZONE_R && p.alive && p.down <= 0 && Math.abs(p.y - z.y) < 3) {
            let contested = false;
            for (const r of this.robots) if (r.alive && r.spawnT <= 0 && Math.hypot(r.x - z.x, r.z - z.z) < ZONE_R) { contested = true; break; }
            {
              // a robot in the ring slows the capture down (it never stops it)
              z.prog += (dt / ph.secs) * (contested ? 0.35 : 1);
              if (z.prog >= 1) { z.prog = 1; z.taken = true; open--; sfx("waveClear"); this.fx.burst(GLINT, z.x, z.y + 1, z.z, 24, 6, 0.8, 0.16, 0x5cf08a, 2); if (open > 0) this.opts.onEvent({ k: "zone", left: open }); }
            }
          }
        }
        if (near) { this.goalPt.x = near.x; this.goalPt.z = near.z; }
        if (open <= 0) this.completePhase();
        break;
      }
      case "boss": if (this.bossUp && !this.boss) this.completePhase(); break;
    }
  }
  private startPhase(again = false) {
    const ph = this.sector.phases[this.phaseI];
    this.resetPhase();
    this.phase = ph;
    const a = this.arena;
    switch (ph.kind) {
      case "defend": {
        // the core stands on the open spot nearest the middle of the arena
        let sp = a.spots[0], bd = 1e9;
        for (const q of a.spots) { const d = Math.hypot(q.x, q.z) + (Math.hypot(q.x - a.spawn.x, q.z - a.spawn.z) < 6 ? 50 : 0); if (d < bd) { bd = d; sp = q; } }
        this.core = this.makeCore(sp.x, sp.z, 1500 + 3000 * ph.d);
        this.goalPt.x = sp.x; this.goalPt.z = sp.z; this.goalOn = true;
        break;
      }
      case "capture":
        for (const q of this.spread(ph.zones)) this.zones.push(this.makeZone(q.x, q.z));
        this.goalPt.x = this.zones[0].x; this.goalPt.z = this.zones[0].z; this.goalOn = true;
        break;
      case "sabotage":
        for (const q of this.spread(ph.towers)) { const t = this.spawnRobot("tower", false, q.x, q.z); t.summon = 3 + Math.random() * 4; this.towers.push(t); }
        break;
      case "boss": {
        const gate = a.gates[Math.floor(Math.random() * a.gates.length)];
        const b = this.spawnRobot(this.op.boss, false, gate.x, gate.z);
        this.boss = b; this.bossUp = true; this.bossCam = 2.4;
        this.opts.onEvent({ k: "boss", name: ROBOTS[this.op.boss].name });
        sfx("bossRoar");
        this.audio?.boss(true);
        break;
      }
    }
    // supplies dropped for the new phase: a heart, an oil can and now and then a power cube
    const sp = this.spread(3);
    this.place("heart", sp[0].x + 1, sp[0].z, 1); this.place("oil", sp[1].x - 1, sp[1].z, 1);
    if (Math.random() < 0.6) this.place((["rapid", "damage", "shield", "magnet", "speed"] as PickupKind[])[Math.floor(Math.random() * 5)], sp[2].x, sp[2].z + 1, 1);
    this.spawnT = 1;
    sfx("wave");
    this.opts.onEvent({ k: "phase", phase: this.phaseNo, phases: phasesIn(this.op), title: ph.title, hint: ph.hint, kind: ph.kind, again });
  }
  private completePhase() {
    if (this.phaseDone || !this.phase) return;
    this.phaseDone = true;
    const ph = this.phase;
    // every robot still standing blows apart (their coins are yours)
    for (const r of this.robots) if (r.alive && r !== this.boss) this.killRobot(r, true);
    this.goalOn = false;
    const bonus = Math.round(30 + this.stage * 0.5 + ph.d * 60);
    this.addCoins(bonus); this.stageCoins += bonus;
    sfx("waveClear");
    const lastInSector = this.phaseI >= this.sector.phases.length - 1, lastSector = this.sectorI >= this.op.sectors.length - 1;
    if (!(lastInSector && lastSector)) {
      const next = lastInSector ? { sector: this.sectorI + 1, phase: 0 } : { sector: this.sectorI, phase: this.phaseI + 1 };
      this.opts.onCheckpoint(this.stage, next.sector, next.phase, this.kills - this.killsBanked);
      this.killsBanked = this.kills;
    }
    this.opts.onEvent({ k: "phaseClear", title: ph.title, coins: bonus });
    this.phaseWait = lastInSector ? 2.2 : 5;
  }
  private nextPhase() {
    this.clearObjective();
    if (this.phaseI < this.sector.phases.length - 1) { this.phaseI++; this.startPhase(); return; }
    if (this.sectorI < this.op.sectors.length - 1) { this.sectorClear(); return; }
    this.stageClear();
  }
  /** no lives left, or the core fell: this phase starts over (never the whole operation) */
  private restartPhase(why: string) {
    for (const r of this.robots) { this.stageGroup.remove(r.rig.root); r.rig.mat.dispose(); }
    this.robots = []; this.boss = null; this.bolts.length = 0; this.beams.length = 0;
    this.audio?.boss(false);
    const p = this.player;
    p.down = 0; p.hp = p.maxHp; p.alive = true; p.shield = 3;
    this.toPad(p); p.y -= 3.5;
    for (const u of this.allies) { u.down = 0; u.hp = u.maxHp; }
    this.fx.burst(FLASH, p.x, p.y + 1, p.z, 1, 0, 0.3, 2.5, 0x9af0ff);
    this.resetPhase();
    this.phaseWait = 2.5;
    this.setMode("play");
    this.opts.onEvent({ k: "fail", why });
  }
  private coreLost() {
    const c = this.core!;
    this.fx.explode(c.x, c.y + 1.4, c.z, 2.6, [0x3a3e4e, hex(this.look.world.accent), 0xffd27a], 1);
    sfx("bossDown"); this.shake = 1;
    this.restartPhase(`The ${this.look.world.core.toLowerCase()} was destroyed`);
  }
  private makeCore(x: number, z: number, max: number): Core {
    const y = solidAt(this.arena, x, z), acc = C(this.look.world.accent), glow = C(this.look.world.palette.glow);
    const b = new Builder();
    b.box(0, 0.25, 0, 2.6, 0.5, 2.6, 0x2a2d3a); b.box(0, 0.6, 0, 2, 0.2, 2, 0x5a5e6e);
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.box(dx * 0.95, 1.1, dz * 0.95, 0.3, 1.2, 0.3, 0x3a3e4e);
    b.box(0, 1.3, 0, 1, 1.4, 1, acc); b.box(0, 2.1, 0, 1.3, 0.25, 1.3, 0x2a2d3a);
    const mesh = new THREE.Mesh(b.geometry(), coreMat); mesh.position.set(x, y, z);
    const t = new Builder(); t.box(0, 0, 0, 0.7, 0.7, 0.7, glow); t.box(0, 0, 0, 0.9, 0.18, 0.18, 0xffffff); t.box(0, 0, 0, 0.18, 0.18, 0.9, 0xffffff);
    const top = new THREE.Mesh(t.geometry(), coreMat); top.position.set(x, y + 2.9, z);
    if (this.renderer.shadowMap.enabled) { mesh.castShadow = true; top.castShadow = true; }
    this.stageGroup.add(mesh, top);
    this.fx.burst(GLINT, x, y + 1.5, z, 20, 5, 0.8, 0.14, glow, 2);
    // the core is solid: nobody walks or shoots through it (the cells go back when the phase ends)
    const cells: [number, number][] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const c = cellOf(this.arena, x + dx, z + dz); if (c >= 0) { cells.push([c, this.arena.solid[c]]); this.arena.solid[c] = Math.max(this.arena.solid[c], y + 2.2); } }
    return { x, y, z, hp: max, max, mesh, top, hurt: 0, cells };
  }
  private makeZone(x: number, z: number): Zone {
    zoneRingGeo ??= new THREE.TorusGeometry(ZONE_R, 0.14, 4, 40);
    zoneDiscGeo ??= new THREE.CircleGeometry(ZONE_R - 0.1, 40);
    const y = solidAt(this.arena, x, z);
    const ring = new THREE.Mesh(zoneRingGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.12, z);
    const fill = new THREE.Mesh(zoneDiscGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.set(x, y + 0.08, z);
    this.stageGroup.add(ring, fill);
    return { x, y, z, prog: 0, taken: false, ring, fill };
  }
  private clearObjective() {
    if (this.core) { for (const [c, v] of this.core.cells) this.arena.solid[c] = v; this.stageGroup.remove(this.core.mesh, this.core.top); this.core.mesh.geometry.dispose(); this.core.top.geometry.dispose(); this.core = null; }
    for (const z of this.zones) { this.stageGroup.remove(z.ring, z.fill); (z.ring.material as THREE.Material).dispose(); (z.fill.material as THREE.Material).dispose(); }
    this.zones = [];
  }
  private spawnRobot(kind: RobotKind | "titan" | "carrier" | "overlord" | "tower", elite: boolean, x: number, z: number) {
    const d = this.phase?.d ?? this.op.difficulty, boss = kind === "titan" || kind === "carrier" || kind === "overlord";
    const hpScale = kind === "tower" ? 1 + d * 0.8 : (1.25 + d * 1.55) * (this.op.remix ? 1.1 : 1) * (boss ? 1.5 + d * 0.9 : 1);
    const u = makeRobot(kind, elite, x, z, solidAt(this.arena, x, z), hpScale);
    u.yaw = Math.atan2(this.player.x - x, this.player.z - z);
    this.robots.push(u);
    this.stageGroup.add(u.rig.root);
    if (this.renderer.shadowMap.enabled) u.rig.root.traverse((m) => { (m as THREE.Mesh).castShadow = true; });
    this.fx.burst(GLINT, x, u.y + 1, z, 12, 3, 0.6, 0.12, hex(this.look.world.palette.glow), 2);
    this.fx.spawn(FLASH, x, u.y + 1, z, 0, 0, 0, 0.3, 2, hex(this.look.world.palette.glow));
    if (this.nearCam(x, z, 40)) sfx("teleport", { pan: this.pan(x, z), gain: 0.4 });
    return u;
  }

  // ---------------------------------------------------------------- a sector's end, the operation's end
  private sectorClear() {
    this.setMode("clear");
    this.firing = false;
    this.audio?.boss(false);
    const bonus = Math.round(80 + this.stage * 0.8);
    this.addCoins(bonus); this.stageCoins += bonus;
    sfx("stageClear");
    for (const pk of this.pickups) if (pk.kind === "coin" || pk.kind === "gem") pk.t = -99;
    this.opts.onEvent({ k: "sectorClear", name: this.sector.name, coins: bonus });
    this.warpTo = { stage: this.stage, sector: this.sectorI + 1, phase: 0 };
  }
  private stageClear() {
    this.setMode("clear");
    this.firing = false;
    this.audio?.boss(false);
    const bonus = Math.round(300 + this.stage * 2);
    this.addCoins(bonus); this.stageCoins += bonus;
    sfx("stageClear");
    // grab the loot lying around
    for (const pk of this.pickups) if (pk.kind === "coin" || pk.kind === "gem") pk.t = -99;
    this.opts.onEvent({ k: "clear", stage: this.stage, kills: this.kills, coins: this.stageCoins, time: this.stageT });
    this.opts.onStage(this.stage + 1, this.kills - this.killsBanked);
    this.killsBanked = this.kills;
    this.warpTo = { stage: this.stage + 1, sector: 0, phase: 0 };
  }
  private clearStep(dt: number) {
    void dt;
    if (this.modeT > 3.6) {
      this.setMode("warp");
      sfx("warp");
    }
  }

  // ---------------------------------------------------------------- pickups
  private seedPickups() {
    const a = this.arena, r = makeRng(this.plan.seed + 41);
    const spots = a.spots.slice();
    const take = () => spots.splice(Math.floor(r() * spots.length), 1)[0];
    const clusters = 6 + Math.floor(this.op.difficulty * 5) + (this.plan.twist === "coins" ? 8 : 0);
    for (let k = 0; k < clusters && spots.length; k++) { const s = take(); for (let q = 0; q < 4; q++) this.place("coin", s.x + Math.cos(q * 1.57) * 0.8, s.z + Math.sin(q * 1.57) * 0.8, 3); }
    for (let k = 0; k < 2 && spots.length; k++) { const s = take(); this.place("heart", s.x, s.z, 1); }
    for (let k = 0; k < 3 && spots.length; k++) { const s = take(); this.place("oil", s.x, s.z, 1); }
    for (let k = 0; k < 2 && spots.length; k++) { const s = take(); this.place((["rapid", "damage", "shield", "magnet", "speed"] as PickupKind[])[Math.floor(r() * 5)], s.x, s.z, 1); }
    if (spots.length) { const s = take(); this.place("gem", s.x, s.z, 25); }
  }
  private place(kind: PickupKind, x: number, z: number, value: number) {
    const mesh = new THREE.Mesh(pickupGeometry(kind), gunMaterial);
    const y = solidAt(this.arena, x, z) + 0.8;
    mesh.position.set(x, y, z);
    this.pickGroup.add(mesh);
    this.pickups.push({ kind, x, y, z, vy: 0, mesh, t: Math.random() * 6, value, settled: true });
  }
  private drop(kind: PickupKind, x: number, y: number, z: number, value: number) {
    if (this.pickups.length > 90) return;
    const mesh = new THREE.Mesh(pickupGeometry(kind), gunMaterial);
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5;
    const pk: Pickup = { kind, x, y, z, vy: 5 + Math.random() * 3, mesh, t: Math.random() * 6, value, settled: false };
    (pk as unknown as { vx: number; vz: number }).vx = Math.cos(a) * s; (pk as unknown as { vx: number; vz: number }).vz = Math.sin(a) * s;
    mesh.position.set(x, y, z);
    this.pickGroup.add(mesh);
    this.pickups.push(pk);
  }
  private updatePickups(dt: number) {
    const p = this.player, a = this.arena;
    const magnet = this.power.magnet > 0 ? 9 : 2.6;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      const pv = pk as unknown as { vx?: number; vz?: number };
      if (!pk.settled) {
        pk.vy -= 20 * dt; pk.x += (pv.vx ?? 0) * dt; pk.z += (pv.vz ?? 0) * dt; pk.y += pk.vy * dt;
        const f = solidAt(a, pk.x, pk.z) + 0.7;
        if (pk.y < f) { pk.y = f; pk.vy = 0; pk.settled = true; }
      }
      const dx = p.x - pk.x, dy = p.y + 0.9 - pk.y, dz = p.z - pk.z, d = Math.hypot(dx, dy, dz);
      const isCoin = pk.kind === "coin" || pk.kind === "gem";
      if ((this.mode === "play" || this.mode === "clear") && p.alive && p.down <= 0 && ((isCoin && (d < magnet || pk.t < -50)) || d < 1.6)) {
        const k = Math.min(1, dt * (pk.t < -50 ? 6 : 12) / Math.max(0.3, d));
        pk.x += dx * k; pk.y += dy * k; pk.z += dz * k; pk.settled = true;
        if (d < 0.9) { this.take(pk); this.pickGroup.remove(pk.mesh); this.pickups.splice(i, 1); continue; }
      }
      pk.mesh.position.set(pk.x, pk.y + (pk.settled ? Math.sin(pk.t * 3) * 0.12 : 0), pk.z);
      pk.mesh.rotation.y = pk.t * (isCoin ? 3 : 1.6);
    }
  }
  private take(pk: Pickup) {
    const p = this.player;
    switch (pk.kind) {
      case "coin": case "gem": this.addCoins(pk.value); this.stageCoins += pk.value; sfx(pk.kind === "gem" ? "gem" : "coin", { rate: 0.95 + Math.random() * 0.15, gain: 0.5 }); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 3, 2, 0.3, 0.1, 0xffe07a); return;
      case "heart":
        if (p.hp < p.maxHp - 1) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45);
        else { this.lives = Math.min(5, this.lives + 1); this.opts.onLives(this.lives); }
        sfx("heart"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 10, 3, 0.6, 0.14, 0xff5a8a); break;
      case "oil": this.fuel = 1; this.lowFuelWarned = false; sfx("oil"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 8, 3, 0.5, 0.12, 0xff8a3a); break;
      default: {
        const id = pk.kind as PowerId;
        this.power[id] = POWER_SECS[id];
        if (id === "shield") p.shield = 0;
        sfx("power"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 12, 4, 0.6, 0.14, hex(POWER_COL[id]));
      }
    }
    this.opts.onEvent({ k: "pickup", what: pk.kind });
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }

  // ---------------------------------------------------------------- camera and aim
  private placeCamera(snap: boolean) {
    const p = this.player;
    if (snap) { this.cam.set(p.x, p.y + 30, p.z + 30); this.camLook.set(p.x, p.y + 1, p.z); }
  }
  private updateCamera(dt: number) {
    const p = this.player, a = this.arena, m = this.mode, t = this.modeT;
    const cam = this.camera;
    const portrait = this.H > this.W;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.bossCam = Math.max(0, this.bossCam - dt);
    let bars = 0;
    // the view direction
    const fx = Math.sin(this.camYaw) * Math.cos(this.camPitch), fy = Math.sin(this.camPitch), fz = Math.cos(this.camYaw) * Math.cos(this.camPitch);
    this.fwd.set(fx, fy, fz);
    this.right.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const want = this.v2, look = this.v3;
    if (m === "attract") {
      // the home screen: a slow orbit round the squad on the pad
      // in front of the squad (they face into the arena), swaying from side to side
      const ang = Math.sin(this.time * 0.15) * 0.55, r = portrait ? 7.5 : 8.5;
      want.set(p.x + Math.sin(ang) * r, p.y + 2.4, p.z + Math.cos(ang) * r);
      look.set(p.x, p.y + (portrait ? 0.4 : 1.3), p.z);
      this.cam.lerp(want, Math.min(1, dt * 2)); this.camLook.lerp(look, Math.min(1, dt * 3));
    } else if (m === "intro") {
      // the fly-in: from high over the arena down behind the squad as they land
      const u = clamp(t / 3, 0, 1), e = u * u * (3 - 2 * u);
      const back = this.behind(4.6);
      // a low sweep across the arena (the scenery on the horizon) that curves round to the squad's backs
      const sx = a.half * 0.75 * Math.cos(u * 1.4), sz = a.half * 0.55 * Math.cos(u * 1.1);
      want.set(lerp(sx, back.x, e), lerp(13 - u * 4, back.y, e), lerp(sz, back.z, e));
      look.set(lerp(p.x, p.x + fx * 6, e), lerp(p.y + 3, p.y + 1.4, e), lerp(p.z, p.z + fz * 6, e));
      this.cam.copy(want); this.camLook.copy(look);
      bars = 1 - e;
    } else if (m === "clear") {
      // kill cam, then a victory orbit round the squad
      if (this.killCam && this.killCam.t > 0) {
        this.killCam.t -= dt;
        const k = this.killCam;
        want.set(k.x + Math.cos(this.time * 0.4) * 6, k.y + 2.2, k.z + Math.sin(this.time * 0.4) * 6);
        look.set(k.x, k.y, k.z);
        this.cam.lerp(want, Math.min(1, dt * 4)); this.camLook.lerp(look, Math.min(1, dt * 6));
      } else {
        const ang = this.camYaw + Math.PI + t * 0.5;
        want.set(p.x + Math.sin(ang) * 5.5, p.y + 2.2, p.z + Math.cos(ang) * 5.5);
        look.set(p.x, p.y + 1.2, p.z);
        this.cam.lerp(want, Math.min(1, dt * 2.5)); this.camLook.lerp(look, Math.min(1, dt * 4));
      }
      bars = 0.9;
    } else if (m === "warp") {
      this.cam.y += dt * 30; this.camLook.y += dt * 10; bars = 1;
    } else if (m === "dead") {
      const ang = t * 0.6;
      want.set(p.x + Math.sin(ang) * 6, p.y + 4 + t * 2, p.z + Math.cos(ang) * 6);
      look.set(p.x, p.y + 0.5, p.z);
      this.cam.lerp(want, Math.min(1, dt * 2)); this.camLook.lerp(look, Math.min(1, dt * 4));
      bars = 0.8;
    } else if (this.bossCam > 0 && this.boss) {
      // the boss's entrance
      const b = this.boss;
      want.set(b.x + Math.sin(b.yaw) * b.height * 1.6 + 2, b.y + b.height * 0.35, b.z + Math.cos(b.yaw) * b.height * 1.6);
      look.set(b.x, b.y + b.height * 0.6, b.z);
      this.cam.lerp(want, Math.min(1, dt * 5)); this.camLook.lerp(look, Math.min(1, dt * 6));
      bars = 1;
    } else if (this.firstPerson) {
      this.cam.set(p.x, p.y + 1.62 + (p.grounded ? Math.abs(Math.sin(p.walk)) * 0.04 : 0), p.z);
      this.camLook.copy(this.cam).add(this.fwd);
    } else {
      // over the shoulder: a step back and to the right; pulled back when flying; never through a wall
      const dist = this.camDist + (p.jetting || !p.grounded ? 1.2 : 0) + (p.speed > 8 ? 0.4 : 0);
      const pivot = this.v1.set(p.x, p.y + 1.6, p.z);
      want.copy(pivot).addScaledVector(this.right, portrait ? 0.55 : 0.85).addScaledVector(this.fwd, -dist);
      want.y += 0.35;
      // a low wall behind you: the camera rises over it; a tall one: the camera comes in closer
      let best = 1;
      for (let s = 0.15; s <= 1; s += 0.08) {
        const x = pivot.x + (want.x - pivot.x) * s, y = pivot.y + (want.y - pivot.y) * s, z = pivot.z + (want.z - pivot.z) * s, top = solidAt(a, x, z);
        if (y < top + 0.3) { if (top < pivot.y + 1.6) want.y = Math.max(want.y, top + 0.6); else { best = Math.max(0.12, s - 0.1); break; } }
      }
      want.set(pivot.x + (want.x - pivot.x) * best, pivot.y + (want.y - pivot.y) * best, pivot.z + (want.z - pivot.z) * best);
      this.cam.lerp(want, Math.min(1, dt * 16));
      this.camLook.copy(this.cam).addScaledVector(this.fwd, 10);
    }
    this.bars += (bars - this.bars) * Math.min(1, dt * 4);
    cam.position.copy(this.cam);
    if (this.shake > 0 && !this.reduced) cam.position.add(this.v1.set((Math.random() - 0.5) * this.shake * 0.35, (Math.random() - 0.5) * this.shake * 0.35, (Math.random() - 0.5) * this.shake * 0.35));
    cam.lookAt(this.camLook);
    const fov = (this.H > this.W ? 78 : 66) + (p.jetting && m === "play" ? 6 : 0) + (p.speed > 8 && m === "play" ? 4 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }
    // the player's body is hidden in first person
    p.rig.root.visible = !(this.firstPerson && m === "play");
    this.viewGun.visible = this.firstPerson && m === "play";
    if (this.viewGun.visible) { this.viewGun.position.z = -0.55 - p.recoil * 0.08; this.viewGun.position.x = 0.32; this.viewGun.position.y = -0.3 + Math.sin(p.walk) * 0.012 * Math.min(1, p.speed / 4); }
    if (m === "play") this.updateAim(dt);
    // the sun's shadow follows the action
    this.sunL.position.copy(this.look.sunDir).multiplyScalar(60).add(this.v1.set(p.x, 0, p.z));
    this.sunL.target.position.set(p.x, 0, p.z);
  }
  private behind(d: number) {
    const p = this.player;
    return this.v1.set(p.x - Math.sin(this.camYaw) * d - Math.cos(this.camYaw) * 0.8, p.y + 2.1, p.z - Math.cos(this.camYaw) * d + Math.sin(this.camYaw) * 0.8);
  }
  private updateAim(dt: number) {
    const a = this.arena, cam = this.camera.position, f = this.fwd;
    // what's under the crosshair: blocks…
    let end = 80;
    for (let t = 1; t < 80; t += 0.5) if (cam.y + f.y * t < solidAt(a, cam.x + f.x * t, cam.z + f.z * t)) { end = t; break; }
    // …or the robot nearest the crosshair within the aim-assist cone
    const touch = isPhone() || this.move.x !== 0 || this.move.y !== 0;
    const cone = touch ? 0.14 : 0.05;
    let best: Unit | null = null, bestA = cone;
    for (const r of this.robots) {
      if (!r.alive || r.spawnT > 0) continue;
      const cx = r.x - cam.x, cy = r.y + r.height * 0.5 - cam.y, cz = r.z - cam.z, d = Math.hypot(cx, cy, cz);
      if (d > 70 || d > end + 2) continue;
      const ang = Math.acos(clamp((cx * f.x + cy * f.y + cz * f.z) / d, -1, 1));
      const allow = bestA * (r.spec!.boss ? 2 : 1) + Math.atan(r.radius / d);
      if (ang < allow && clearLine(a, cam.x, cam.y, cam.z, r.x, r.y + r.height * 0.5, r.z)) { bestA = ang; best = r; }
    }
    this.locked = best;
    if (best) {
      this.aim.set(best.x, best.y + best.height * 0.5, best.z);
      // on phones the view drifts onto the locked robot while you fire
      if (touch && this.firing) {
        const want = Math.atan2(best.x - this.player.x, best.z - this.player.z);
        this.camYaw += angDiff(this.camYaw, want) * Math.min(1, dt * 2.2);
      }
    } else this.aim.set(cam.x + f.x * end, cam.y + f.y * end, cam.z + f.z * end);
    if (this.hitFrom) { this.hitFrom.t -= dt; if (this.hitFrom.t <= 0) this.hitFrom = null; }
  }

  // ---------------------------------------------------------------- drawing
  private render(dt: number) {
    const l = this.look;
    // moving bits: gate rings, windmills, liquid, clouds, weather
    for (let i = 0; i < this.gateRings.length; i++) { const r = this.gateRings[i]; r.rotation.z += dt * 1.5; const s = 1 + Math.sin(this.time * 3 + i) * 0.08 + (this.phase && !this.phaseDone && this.mode === "play" ? 0.15 : 0); r.scale.set(s, s, s); }
    if (this.core) {
      const c = this.core;
      c.hurt = Math.max(0, c.hurt - dt);
      c.top.rotation.y += dt * 1.6; c.top.position.y = c.y + 2.9 + Math.sin(this.time * 2.4) * 0.15;
      coreMat.emissive.setRGB(c.hurt * 1.6, c.hurt * 0.2, c.hurt * 0.2);
    }
    for (const z of this.zones) {
      z.ring.rotation.z += dt * (z.taken ? 0.4 : 1.4);
      const fm = z.fill.material as THREE.MeshBasicMaterial, rm = z.ring.material as THREE.MeshBasicMaterial;
      if (z.taken) { fm.color.setHex(0x5cf08a); rm.color.setHex(0x5cf08a); fm.opacity = 0.3; z.fill.scale.setScalar(1); }
      else { fm.opacity = 0.16 + z.prog * 0.3; z.fill.scale.setScalar(Math.max(0.06, z.prog)); }
    }
    for (const m of this.mills) m.rotation.z += dt * 0.8;
    if (this.liquidTex) { this.liquidTex.offset.x += dt * 0.02; this.liquidTex.offset.y += dt * 0.012; }
    if (this.backdrop) { this.backdrop.clouds.rotation.y += dt * 0.004; this.backdrop.weather?.update(dt, this.time, this.camera.position.x, this.camera.position.y, this.camera.position.z); }
    // bolts and beams as glowing bars, on top of the particles
    this.fx.begin();
    for (const b of this.bolts) this.fx.bar(b.x, b.y, b.z, b.vx, b.vy, b.vz, b.len, b.w, b.hex, b.kind === BOLT ? 1.6 : 1.3);
    for (const bm of this.beams) {
      const k = bm.life / bm.max;
      if (bm.jag > 0) {
        // lightning: three jagged segments
        let px = bm.x0, py = bm.y0, pz = bm.z0;
        for (let s = 1; s <= 3; s++) {
          const u = s / 3, j = s < 3 ? bm.jag : 0;
          const nx = bm.x0 + (bm.x1 - bm.x0) * u + (Math.random() - 0.5) * j, ny = bm.y0 + (bm.y1 - bm.y0) * u + (Math.random() - 0.5) * j, nz = bm.z0 + (bm.z1 - bm.z0) * u + (Math.random() - 0.5) * j;
          const d = Math.hypot(nx - px, ny - py, nz - pz);
          this.fx.bar(nx, ny, nz, nx - px, ny - py, nz - pz, d, bm.w, bm.hex, 1.8 * k);
          px = nx; py = ny; pz = nz;
        }
      } else {
        const d = Math.hypot(bm.x1 - bm.x0, bm.y1 - bm.y0, bm.z1 - bm.z0);
        this.fx.bar(bm.x1, bm.y1, bm.z1, bm.x1 - bm.x0, bm.y1 - bm.y0, bm.z1 - bm.z0, d, bm.w * (0.5 + k), bm.hex, 1.6 * k);
      }
    }
    // snipers' charging beams (a thin warning line)
    for (const r of this.robots) if (r.alive && r.charge > 0 && r.target) {
      const m = muzzleOf(r), t = r.target, ty = t.y + t.height * 0.55;
      const d = Math.hypot(t.x - m.x, ty - m.y, t.z - m.z);
      this.fx.bar(t.x, ty, t.z, t.x - m.x, ty - m.y, t.z - m.z, d, 0.03 + r.charge * 0.03, 0xff5af0, 0.6 + r.charge);
    }
    // the shield bubble and power aura around you
    const p = this.player;
    if ((p.shield > 0 || this.power.shield > 0) && this.mode === "play") for (let k = 0; k < 6; k++) { const a2 = this.time * 2 + k * 1.05; this.fx.cube(p.x + Math.cos(a2) * 0.9, p.y + 0.4 + (k % 3) * 0.5, p.z + Math.sin(a2) * 0.9, 0.12, 0x5ab8ff, 1.2); }
    this.fx.end();
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay();
    void l;
    // engine-ish sound of the world
    this.audio?.update(dt, this.mode === "play");
  }

  private toScreen(x: number, y: number, z: number) {
    this.proj.set(x, y, z).project(this.camera);
    return this.proj.z < 1 ? this.proj : null;
  }
  private drawOverlay() {
    const c = this.oc, W = this.W, H = this.H, r = this.opr;
    c.setTransform(r, 0, 0, r, 0, 0);
    c.clearRect(0, 0, W, H);
    const play = this.mode === "play";
    // damage numbers
    c.font = "900 15px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of this.nums) {
      const s = this.toScreen(n.x, n.y, n.z); if (!s) continue;
      const sx = (s.x * 0.5 + 0.5) * W, sy = (-s.y * 0.5 + 0.5) * H;
      c.globalAlpha = Math.min(1, n.life * 2.5);
      c.lineWidth = 3; c.strokeStyle = "#14102a"; c.strokeText(String(n.v), sx, sy);
      c.fillStyle = n.crit ? "#FFD23F" : "#FFFFFF"; c.fillText(String(n.v), sx, sy);
    }
    c.globalAlpha = 1;
    // robots' health bars (only those you've hurt), elite badges
    for (const rb of this.robots) {
      if (!rb.alive || rb.spec!.boss || (rb.hp >= rb.maxHp && !rb.elite)) continue;
      const s = this.toScreen(rb.x, rb.y + rb.height + 0.35, rb.z); if (!s) continue;
      const d = this.distCam(rb.x, rb.z); if (d > 45) continue;
      const sx = (s.x * 0.5 + 0.5) * W, sy = (-s.y * 0.5 + 0.5) * H, w = clamp(60 - d, 22, 46);
      c.fillStyle = "rgba(10,10,20,0.7)"; c.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 6);
      c.fillStyle = rb.elite ? "#FFD23F" : "#FF4A4A"; c.fillRect(sx - w / 2, sy, w * Math.max(0, rb.hp / rb.maxHp), 4);
    }
    if (!play) return;
    // the objectives: the core and its health, the relay rings, the beacons — pinned to the screen's edge when off it
    if (this.phase && !this.phaseDone) {
      if (this.core) this.marker(this.core.x, this.core.y + 3.6, this.core.z, "#5BF0FF", this.core.hp / this.core.max, "DEFEND");
      for (const z of this.zones) if (!z.taken) this.marker(z.x, z.y + 1.6, z.z, "#FFD23F", z.prog, "HOLD");
      for (const t of this.towers) if (t.alive) this.marker(t.x, t.y + t.height + 0.6, t.z, "#FF3A6A", t.hp / t.maxHp, "DESTROY");
    }
    // the crosshair: four ticks, red when locked on, an X when you hit
    const cx = W / 2, cy = H / 2, sp = 8 + (this.firing ? 4 : 0) + this.player.recoil * 6;
    const col = this.locked ? "#FF4A5A" : "#FFFFFF";
    c.fillStyle = "rgba(0,0,0,0.45)";
    for (const [dx, dy, w, h] of [[-sp - 7, -1.5, 7, 3], [sp, -1.5, 7, 3], [-1.5, -sp - 7, 3, 7], [-1.5, sp, 3, 7]]) c.fillRect(cx + dx + 1, cy + dy + 1, w, h);
    c.fillStyle = col;
    for (const [dx, dy, w, h] of [[-sp - 7, -1.5, 7, 3], [sp, -1.5, 7, 3], [-1.5, -sp - 7, 3, 7], [-1.5, sp, 3, 7]]) c.fillRect(cx + dx, cy + dy, w, h);
    c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    if (this.locked) { c.strokeStyle = "rgba(255,74,90,0.85)"; c.lineWidth = 2; const s2 = this.toScreen(this.locked.x, this.locked.y + this.locked.height * 0.5, this.locked.z); if (s2) { const lx = (s2.x * 0.5 + 0.5) * W, ly = (-s2.y * 0.5 + 0.5) * H, q = 14; c.beginPath(); c.moveTo(lx - q, ly - q + 5); c.lineTo(lx - q, ly - q); c.lineTo(lx - q + 5, ly - q); c.moveTo(lx + q - 5, ly - q); c.lineTo(lx + q, ly - q); c.lineTo(lx + q, ly - q + 5); c.moveTo(lx - q, ly + q - 5); c.lineTo(lx - q, ly + q); c.lineTo(lx - q + 5, ly + q); c.moveTo(lx + q - 5, ly + q); c.lineTo(lx + q, ly + q); c.lineTo(lx + q, ly + q - 5); c.stroke(); } }
    if (this.hitMark > 0 || this.killMark > 0) {
      c.strokeStyle = this.killMark > 0 ? "#FF4A5A" : "#FFFFFF"; c.lineWidth = 3; const q = 7 + (this.killMark > 0 ? 4 : 0);
      c.beginPath(); c.moveTo(cx - q - 5, cy - q - 5); c.lineTo(cx - q, cy - q); c.moveTo(cx + q + 5, cy - q - 5); c.lineTo(cx + q, cy - q); c.moveTo(cx - q - 5, cy + q + 5); c.lineTo(cx - q, cy + q); c.moveTo(cx + q + 5, cy + q + 5); c.lineTo(cx + q, cy + q); c.stroke();
    }
    // where a hit came from: a red arc at the screen's edge
    if (this.hitFrom) {
      const p = this.player, ang = Math.atan2(this.hitFrom.x - p.x, this.hitFrom.z - p.z), rel = angDiff(this.camYaw, ang);
      const a2 = -rel - Math.PI / 2, R = Math.min(W, H) * 0.32;
      c.strokeStyle = `rgba(255,60,70,${0.7 * this.hitFrom.t})`; c.lineWidth = 8;
      c.beginPath(); c.arc(cx, cy, R, a2 - 0.35, a2 + 0.35); c.stroke();
    }
    // the radar: robots, squad mates, pickups worth knowing about
    const portrait = H > W, rr = portrait ? 44 : 52, rx = W - rr - 14, ry = (portrait ? 118 : 74) + rr;
    c.fillStyle = "rgba(10,12,28,0.72)"; c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.arc(rx, ry, rr * 0.5, 0, Math.PI * 2); c.stroke();
    const sc = rr / 30, p = this.player, sy = Math.sin(this.camYaw), cyw = Math.cos(this.camYaw);
    const dotAt = (x: number, z: number, col2: string, s: number) => {
      const dx = x - p.x, dz = z - p.z;
      let ux = -(dx * cyw - dz * sy), uy = -(dx * sy + dz * cyw);
      const dl = Math.hypot(ux, uy) * sc;
      if (dl > rr - 4) { ux *= (rr - 4) / dl; uy *= (rr - 4) / dl; } else { ux *= sc; uy *= sc; }
      if (dl > rr - 4) { c.fillStyle = col2; c.fillRect(rx + ux - s / 2, ry + uy - s / 2, s, s); return; }
      c.fillStyle = col2; c.fillRect(rx + ux - s / 2, ry + uy - s / 2, s, s);
    };
    for (const pk of this.pickups) if (pk.kind !== "coin") dotAt(pk.x, pk.z, pk.kind === "heart" ? "#FF5A8A" : pk.kind === "oil" ? "#FF8A3A" : "#FFD23F", 4);
    for (const g2 of this.arena.gates) dotAt(g2.x, g2.z, "rgba(160,255,240,0.7)", 5);
    for (const a2 of this.allies) dotAt(a2.x, a2.z, a2.down > 0 ? "#5A6A8A" : "#5AB8FF", 6);
    for (const rb of this.robots) if (rb.alive) dotAt(rb.x, rb.z, rb.spec!.boss || rb.kind === "tower" ? "#FF2A6A" : "#FF4A4A", rb.spec!.boss ? 9 : rb.kind === "tower" ? 8 : 5);
    if (this.core) dotAt(this.core.x, this.core.z, "#5BF0FF", 9);
    for (const z of this.zones) dotAt(z.x, z.z, z.taken ? "#5CF08A" : "#FFD23F", 8);
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.moveTo(rx, ry - 6); c.lineTo(rx + 4.5, ry + 4); c.lineTo(rx - 4.5, ry + 4); c.closePath(); c.fill();
  }

  /** an objective marker: a diamond with a progress bar over the thing, or an arrow at the screen's edge */
  private marker(x: number, y: number, z: number, col: string, k: number, label: string) {
    const c = this.oc, W = this.W, H = this.H;
    this.proj.set(x, y, z).project(this.camera);
    let sx = (this.proj.x * 0.5 + 0.5) * W, sy = (-this.proj.y * 0.5 + 0.5) * H;
    const behind = this.proj.z > 1, m = 34;
    const off = behind || sx < m || sx > W - m || sy < m + 40 || sy > H - m;
    if (behind) { sx = W - sx; sy = H - sy; }
    if (off) {
      // to the edge, along the line from the centre
      const dx = sx - W / 2, dy = sy - H / 2, s = Math.min((W / 2 - m) / Math.max(1, Math.abs(dx)), (H / 2 - m - 20) / Math.max(1, Math.abs(dy)));
      sx = W / 2 + dx * s; sy = H / 2 + dy * s;
      const a = Math.atan2(dy, dx);
      c.save(); c.translate(sx, sy); c.rotate(a);
      c.fillStyle = "rgba(10,10,20,0.6)"; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-8, 10); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill();
      c.restore();
      return;
    }
    c.save(); c.translate(sx, sy); c.rotate(Math.PI / 4);
    c.fillStyle = "rgba(10,10,20,0.65)"; c.fillRect(-9, -9, 18, 18);
    c.strokeStyle = col; c.lineWidth = 2.5; c.strokeRect(-7, -7, 14, 14);
    c.restore();
    c.fillStyle = "rgba(10,10,20,0.7)"; c.fillRect(sx - 23, sy + 13, 46, 6);
    c.fillStyle = col; c.fillRect(sx - 22, sy + 14, 44 * clamp(k, 0, 1), 4);
    c.font = "900 10px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.lineWidth = 3; c.strokeStyle = "#14102a"; c.strokeText(label, sx, sy - 16); c.fillStyle = col; c.fillText(label, sx, sy - 16);
  }
  private nearCam(x: number, z: number, d: number) { return this.distCam(x, z) < d; }
  private distCam(x: number, z: number) { return Math.hypot(x - this.camera.position.x, z - this.camera.position.z); }
  private pan(x: number, z: number) {
    const dx = x - this.camera.position.x, dz = z - this.camera.position.z;
    return clamp(-(dx * Math.cos(this.camYaw) - dz * Math.sin(this.camYaw)) / 12, -0.9, 0.9);
  }

  // ---------------------------------------------------------------- input
  setMove(x: number, y: number) { this.move.x = x; this.move.y = y; }
  /** turn the view (pixels dragged / mouse movement) */
  turn(dx: number, dy: number) {
    if (this.mode !== "play") return;
    const s = isPhone() ? 0.0062 : 0.0045;
    this.camYaw -= dx * s; this.camPitch = clamp(this.camPitch - dy * s, -1.1, 0.85);
  }
  setFire(on: boolean) { this.firing = on && this.mode === "play"; }
  setJet(on: boolean) { this.jetting = on; }
  setSprint(on: boolean) { this.sprint = on; }
  toggleView() { this.firstPerson = !this.firstPerson; return this.firstPerson; }
  private key(e: KeyboardEvent) {
    const down = e.type === "keydown";
    const code = e.code;
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
    if (!down || e.repeat) return;
    if (code === "KeyQ" || code === "Digit1" || code === "Digit2") { if (code === "KeyQ" || (code === "Digit1" ? 0 : 1) !== this.slot) this.swap(); }
    if (code === "KeyV" || code === "KeyP") { const f = this.toggleView(); this.opts.onEvent({ k: "view", first: f }); }
  }
  private mouse(e: MouseEvent) {
    if (e.type === "mousemove") { if (document.pointerLockElement === this.renderer.domElement) this.turn(e.movementX, e.movementY); return; }
    if (e.type === "mousedown") {
      if (this.mode !== "play") return;
      if (document.pointerLockElement !== this.renderer.domElement) { this.renderer.domElement.requestPointerLock?.(); return; }
      if (e.button === 0) this.setFire(true);
      if (e.button === 2) this.swap();
    } else if (e.type === "mouseup" && e.button === 0) this.setFire(false);
  }

  dispose() {
    this.stop();
    const w = window as unknown as { __voxelVanguard?: Game };
    if (w.__voxelVanguard === this) delete w.__voxelVanguard;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("mousemove", this.onMouse); window.removeEventListener("mouseup", this.onMouse);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouse);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock?.();
    this.clearStage();
    this.fx.dispose();
    this.gov.dispose();
    this.audio?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove(); this.overlay.remove();
  }

  // ---------------------------------------------------------------- HUD
  private pushHud() {
    const p = this.player, plan = this.plan, ph = this.phase;
    const ws = this.spec[this.slot];
    let obj: Hud["obj"] = null;
    if (ph) {
      let line = "", prog = 0;
      switch (ph.kind) {
        case "assault": case "elite": line = `${Math.min(this.phaseKills, ph.count)} / ${ph.count} ${ph.kind === "elite" ? "elites" : "robots"}`; prog = this.phaseKills / ph.count; break;
        case "survive": line = `Hold on · ${fmt(Math.max(0, ph.secs - this.phaseT))}`; prog = this.phaseT / ph.secs; break;
        case "defend": line = `${this.look.world.core} ${this.core ? Math.max(0, Math.ceil((this.core.hp / this.core.max) * 100)) : 0}% · ${fmt(Math.max(0, ph.secs - this.phaseT))}`; prog = this.phaseT / ph.secs; break;
        case "sabotage": { const left = this.towers.filter((t) => t.alive).length; line = `${ph.towers - left} / ${ph.towers} beacons down`; prog = (ph.towers - left) / ph.towers; break; }
        case "capture": { let got = 0, part = 0; for (const z of this.zones) { if (z.taken) got++; else part = Math.max(part, z.prog); } line = `${got} / ${ph.zones} relays${part > 0 ? ` · ${Math.round(part * 100)}%` : ""}`; prog = (got + part) / ph.zones; break; }
        case "boss": line = this.boss ? `${ROBOTS[this.op.boss].name}` : "Boss down!"; prog = this.boss ? 1 - this.boss.hp / this.boss.maxHp : 1; break;
      }
      if (this.phaseDone) line = "Phase clear!";
      obj = { kind: ph.kind, title: ph.title, line, prog: clamp(prog, 0, 1), done: this.phaseDone };
    }
    const h: Hud = {
      stage: this.stage, codename: this.op.codename, sector: this.sectorI + 1, sectors: this.op.sectors.length, sectorName: this.sector.name, phase: this.phaseNo, phases: phasesIn(this.op), obj,
      hp: Math.max(0, p.hp), maxHp: p.maxHp, lives: this.lives, fuel: this.fuel, ammo: this.ammo[this.slot], mag: ws.mag, reload: this.reloadT > 0 ? 1 - this.reloadT / ws.reload : -1,
      weapon: ws.id, slot: this.slot, weapons: this.opts.weapons, coins: this.coins,
      powers: (Object.keys(this.power) as PowerId[]).filter((k) => this.power[k] > 0).map((id) => ({ id, left: this.power[id], secs: POWER_SECS[id] })),
      mode: this.mode, boss: this.boss ? { name: ROBOTS[this.boss.kind as "titan"].name, hp: this.boss.hp / this.boss.maxHp } : null,
      allies: this.allies.map((u) => ({ name: u.kind === "juno" ? SQUAD.juno.name : SQUAD.brick.name, color: u.kind === "juno" ? SQUAD.juno.color : SQUAD.brick.color, hp: u.hp / u.maxHp, down: u.down > 0 })),
      title: plan.title, subtitle: plan.subtitle, world: plan.world, accent: this.look.world.accent, firstPerson: this.firstPerson, remix: plan.remix > 0,
    };
    this.opts.onHud(h);
  }
}

