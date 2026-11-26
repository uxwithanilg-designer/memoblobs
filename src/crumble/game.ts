// Crumble Crew: the game. A heist flows with no screens in between:
//  - the van pulls up at the first site while the camera sweeps over the lot and the building under letterbox bars
//    ("The Velvet Anvil Job started!"); Rocco hops out and you see through his eyes (or over his shoulder);
//  - break in however you like — smash a window, hammer through brick, drill the steel, blow a hole with dynamite —
//    and the alarm trips: Bolt Security teleports in and never stops while the site's goals play out: grab the loot
//    quota, crack the vault, hold off the robots, bring the building down, beat the Vault Warden, get back to the van;
//  - every block breaks to the right tool; whatever loses its hold — a wall, a roof, a whole storey — comes down;
//    loot spills out of safes and gold blocks and falls with the floors;
//  - you move with the left thumb / WASD, look with the right / the mouse, USE the tool in hand (hold), JUMP, and pick
//    tools from the bar; robots drop coins, hearts, oil and power cubes; ammo crates refill the explosives;
//  - out of health costs a life; out of lives, the goal starts over — never the whole heist; progress is saved after
//    every goal;
//  - the van drives off with the camera riding along, and the next site (or the next heist) begins by itself.
import * as THREE from "three";
import { FrameGovernor, antialiasFor, autoQuality, isPhone, pixelRatioFor, shadowsFor, type Quality } from "@/lib/perf";
import { heistPlan, goalsIn, type GoalPlan, type HeistPlan, type SitePlan } from "./heists";
import { districtOf, type District, type BotKind } from "./districts";
import { VoxelWorld, VS, type Hit } from "./voxels";
import { buildSite, LOT, type SiteLayout } from "./build";
import { paintAtlas } from "./art/atlas";
import { buildBackdrop, lookFor, type Backdrop, type Look } from "./art/backdrop";
import { roccoRig, vanRig, toolGeometry, drillBit, pickupGeometry, sharedMat, type PickupKind, type Rig } from "./art/rigs";
import { Fx, DEBRIS, FIRE, FLASH, GLINT, SMOKE, SPARK } from "./fx";
import { botThink, makeBot, poseBot, type Bot, type Shot } from "./bots";
import { fallBody, moveBody, unstick, type Body } from "./physics";
import { TOOLS, magnetR, maxHealth, oilMax, outfitOf, runSpeed, toolOf, tuned, type SuitId, type ToolId, type ToolSpec } from "./gear";
import { AIR, GLASS, GOLD, MAT, SAFE, VAULT, canBreak } from "./materials";
import { CrumbleAudio, sfx, type CrumbleSfx } from "./sound";
import { angDiff, clamp, hex, lerp, makeRng, rgb } from "./util";

export type Mode = "attract" | "intro" | "play" | "clear" | "warp" | "dead";
export type PowerId = "mega" | "shield" | "magnet" | "speed" | "xray" | "double";
const POWER_SECS: Record<PowerId, number> = { mega: 14, shield: 10, magnet: 16, speed: 12, xray: 15, double: 15 };
const POWERS: PowerId[] = ["mega", "shield", "magnet", "speed", "xray", "double"];

export interface Hud {
  heist: number; codename: string; site: number; sites: number; siteName: string; goalNo: number; goals: number;
  obj: { kind: GoalPlan["kind"]; title: string; line: string; prog: number; done: boolean } | null;
  hp: number; maxHp: number; lives: number; oil: number; coins: number; loot: number; lootGoal: number;
  tool: ToolId; tools: { id: ToolId; ammo: number }[];
  powers: { id: PowerId; left: number; secs: number }[];
  alarm: boolean; mode: Mode; boss: { name: string; hp: number } | null; firstPerson: boolean; remix: boolean; accent: string;
}
export type GameEvent =
  | { k: "start"; heist: number; codename: string; minutes: number; sites: number; site: number; siteName: string; goal: number; remix: boolean; restart: boolean }
  | { k: "goal"; no: number; of: number; title: string; hint: string; kind: GoalPlan["kind"]; again: boolean }
  | { k: "goalDone"; title: string; coins: number } | { k: "alarm" } | { k: "boss"; name: string }
  | { k: "siteClear"; name: string; coins: number } | { k: "fail"; why: string }
  | { k: "clear"; heist: number; loot: number; time: number }
  | { k: "pickup"; what: PickupKind | PowerId; value: number } | { k: "hurt" } | { k: "down"; livesLeft: number }
  | { k: "collapse"; blocks: number } | { k: "lowOil" } | { k: "noAmmo"; tool: ToolId } | { k: "view"; first: boolean } | { k: "radio"; text: string };

export interface GameOptions {
  owned: ToolId[]; levels: Partial<Record<ToolId, number>>; ammo: Partial<Record<ToolId, number>>;
  suit: Record<SuitId, number>; outfit: string; lives: number; coins: number; firstPerson: boolean;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void;
  onCoins: (n: number) => void; onLives: (n: number) => void; onAmmo: (a: Partial<Record<ToolId, number>>) => void;
  onCheckpoint: (heist: number, site: number, goal: number, totals: { loot: number; blocks: number; bots: number }) => void;
  onDone: (next: number, totals: { loot: number; blocks: number; bots: number }) => void;
}

const BOLT = 0, ROCKET = 1, GRENADE = 2, DYNAMITE = 3, CANNON = 4;
interface Bolt { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; team: 0 | 1; power: number; radius: number; kind: number; hex: number; from: Bot | null; stuck: boolean; mesh: THREE.Mesh | null }
interface Pickup { kind: PickupKind; sub: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; mesh: THREE.Mesh; t: number; value: number; settled: boolean }
interface Num { x: number; y: number; z: number; v: number; life: number; col: string }
const GEM_COLS = ["#5BF0FF", "#FF5AC8", "#5CF08A", "#C87CFF", "#FFD23F"];
const ART_COLS = ["#5AB8FF", "#FF8A3A", "#C87CFF", "#5CE07A"];
const BREAK_SFX: Record<string, CrumbleSfx> = { wood: "smash_wood", glass: "smash_glass", brick: "smash_brick", stone: "smash_stone", metal: "smash_metal" };

export class Game {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, 1, 0.05, 900);
  private overlay: HTMLCanvasElement; private oc: CanvasRenderingContext2D;
  private quality: Quality; private gov: FrameGovernor;
  private W = 1; private H = 1; private pr = 1; private opr = 1;
  private raf = 0; private last = 0; private running = false; time = 0;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); private sunL = new THREE.DirectionalLight(0xffffff, 1.6);
  // the heist and the site
  heist = 1; plan!: HeistPlan; siteI = 0; goalI = 0; site!: SitePlan; district!: District; look!: Look;
  world!: VoxelWorld; layout!: SiteLayout;
  private siteGroup = new THREE.Group(); private atlas: THREE.Texture | null = null; private backdrop: Backdrop | null = null;
  fx = new Fx();
  // the crew
  player: Body & { yaw: number; pitch: number; hp: number; maxHp: number; alive: boolean; walk: number; speed: number; shield: number } = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, hw: 0.3, h: 1.7, grounded: false, yaw: 0, pitch: 0, hp: 100, maxHp: 100, alive: true, walk: 0, speed: 0, shield: 0 };
  private rocco!: Rig; private van!: Rig; private vanX = 0; private vanZ = 0; private vanYaw = 0;
  bots: Bot[] = []; private bolts: Bolt[] = []; pickups: Pickup[] = []; private nums: Num[] = [];
  private pickGroup = new THREE.Group();
  boss: Bot | null = null;
  // rules
  mode: Mode = "attract"; private modeT = 0;
  lives = 3; coins = 0; loot = 0; lootTotal = 1; private siteLoot = 0;
  alarm = false; private goal: GoalPlan | null = null; goalT = 0; private goalWait = 0; goalDone = false; private spawnT = 0;
  blocksBroken = 0; vaultBroken = 0; private bossUp = false; private siteT = 0;
  private totals = { loot: 0, blocks: 0, bots: 0 }; private banked = { loot: 0, blocks: 0, bots: 0 };
  private power: Record<PowerId, number> = { mega: 0, shield: 0, magnet: 0, speed: 0, xray: 0, double: 0 };
  oil = 30; private oilMax = 30; private lowOilWarned = false;
  // tools
  tool: ToolId = "hammer"; private useT = 0; private swing = 0; private using = false; private paintCol = 0;
  private viewTool: THREE.Mesh; private viewBit: THREE.Mesh; private handTool: THREE.Mesh;
  private aimHit: Hit = { i: 0, j: 0, k: 0, nx: 0, ny: 0, nz: 0, t: 0, m: 0 }; private aimOk = false; private aimBot: Bot | null = null;
  private outline: THREE.LineSegments;
  private camHit: Hit = { i: 0, j: 0, k: 0, nx: 0, ny: 0, nz: 0, t: 0, m: 0 }; private rightV = new THREE.Vector3();
  // input
  private move = { x: 0, y: 0 }; private keys = new Set<string>(); private jumpPress = false; private jumpKey = false;
  firstPerson = true;
  // camera
  camYaw = 0; camPitch = -0.05; private cam = new THREE.Vector3(); private camLook = new THREE.Vector3(); private eyeY = 1.55;
  private shake = 0; private slow = 1; private slowT = 0; private bossCam = 0; private hurtT = 0; private hitMark = 0;
  private opts: GameOptions; private audio: CrumbleAudio | null = null; private hudT = 0; private reduced = false; private stepT = 0;
  private broken: number[] = []; private fallen: number[] = [];
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private v3 = new THREE.Vector3(); private fwd = new THREE.Vector3(); private proj = new THREE.Vector3();
  private onKey = (e: KeyboardEvent) => this.key(e); private onMouse = (e: MouseEvent) => this.mouse(e); private onResize = () => this.resize();

  constructor(host: HTMLElement, opts: GameOptions) {
    this.host = host; this.opts = opts;
    this.quality = autoQuality();
    this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(this.quality), powerPreference: "high-performance", stencil: false });
    this.pr = pixelRatioFor(this.quality);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = shadowsFor(this.quality); this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "cc-canvas";
    host.appendChild(this.renderer.domElement);
    this.overlay = document.createElement("canvas"); this.overlay.className = "cc-overlay"; host.appendChild(this.overlay);
    this.oc = this.overlay.getContext("2d")!;
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(this.pr * k); this.resize(); });
    this.scene.add(this.hemi, this.sunL, this.sunL.target, this.siteGroup, this.fx.solid, this.fx.glow, this.pickGroup, this.camera);
    this.sunL.castShadow = this.renderer.shadowMap.enabled;
    if (this.sunL.castShadow) { this.sunL.shadow.mapSize.set(1024, 1024); const s = this.sunL.shadow.camera; s.left = -30; s.right = 30; s.top = 30; s.bottom = -30; s.near = 1; s.far = 160; this.sunL.shadow.bias = -0.0015; }
    this.lives = opts.lives; this.coins = opts.coins; this.firstPerson = opts.firstPerson;
    // the tool in your hands (first person) and in Rocco's paw (third person)
    this.viewTool = new THREE.Mesh(toolGeometry("hammer"), sharedMat); this.viewBit = new THREE.Mesh(drillBit(), sharedMat);
    this.viewTool.scale.setScalar(0.62);
    this.viewTool.add(this.viewBit); this.viewBit.visible = false; this.viewBit.position.set(0, 0, 0.2);
    this.camera.add(this.viewTool);
    this.handTool = new THREE.Mesh(toolGeometry("hammer"), sharedMat);
    // the outline of the block you're aiming at
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(VS * 1.02, VS * 1.02, VS * 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    this.outline.visible = false; this.scene.add(this.outline);
    this.resize();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey); window.addEventListener("keyup", this.onKey);
    window.addEventListener("mousemove", this.onMouse); this.renderer.domElement.addEventListener("mousedown", this.onMouse); window.addEventListener("mouseup", this.onMouse);
    // QA and the art script (scripts/art/crumble_art.py) look at the game through this
    (window as unknown as { __crumble?: Game }).__crumble = this;
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.renderer.setSize(this.W, this.H, false);
    this.renderer.domElement.style.width = `${this.W}px`; this.renderer.domElement.style.height = `${this.H}px`;
    this.opr = Math.min(2, pixelRatioFor(this.quality));
    this.overlay.width = Math.round(this.W * this.opr); this.overlay.height = Math.round(this.H * this.opr);
    this.overlay.style.width = `${this.W}px`; this.overlay.style.height = `${this.H}px`;
    this.camera.aspect = this.W / this.H;
    this.camera.fov = this.H > this.W ? 80 : 70;
    this.camera.updateProjectionMatrix();
    // the tool sits low and to the right; a little more in on tall phones
    const portrait = this.H > this.W;
    this.viewTool.position.set(portrait ? 0.2 : 0.3, -0.34, -0.62);
  }
  private spec(id: ToolId): ToolSpec { return tuned(toolOf(id), this.opts.levels[id] ?? 0); }
  setGear(o: Pick<GameOptions, "owned" | "levels" | "ammo" | "suit" | "outfit">) {
    Object.assign(this.opts, o);
    if (!this.opts.owned.includes(this.tool)) this.tool = "hammer";
    if (this.plan) this.load(this.heist, this.mode === "attract" ? "attract" : "intro", false, { site: this.siteI, goal: this.goalI });
  }

  // ---------------------------------------------------------------- building a site
  load(heist: number, mode: Mode = "intro", restart = false, at: { site: number; goal: number } | null = null) {
    this.heist = heist;
    this.clearSite();
    this.plan = heistPlan(heist);
    this.siteI = clamp(at?.site ?? 0, 0, this.plan.sites.length - 1);
    this.site = this.plan.sites[this.siteI];
    this.goalI = clamp(at?.goal ?? 0, 0, this.site.goals.length - 1);
    const d = districtOf(this.plan.district), partner = this.plan.blend ? districtOf(this.plan.blend) : null;
    this.district = d;
    this.look = lookFor({ district: d, partner, blendAmt: this.plan.blendAmt, time: this.site.time, weather: this.site.weather, seed: this.site.seed });
    const l = this.look;
    // the blocks
    this.atlas = paintAtlas(d, partner, this.plan.blendAmt, this.site.seed);
    const w = new VoxelWorld(LOT.nx, LOT.ny, LOT.nz, this.atlas);
    w.shadows = this.renderer.shadowMap.enabled;
    this.world = w;
    this.colourWorld(d, partner);
    this.layout = buildSite(w, this.site.building, d, this.site.seed, this.site.size);
    // a goal later in the site: the building is already broken in (the alarm is up)
    w.all(); w.rebuild(Infinity);
    this.siteGroup.add(w.group);
    this.backdrop = buildBackdrop(l, { district: d, partner, blendAmt: this.plan.blendAmt, time: this.site.time, weather: this.site.weather, seed: this.site.seed }, this.quality);
    this.scene.add(this.backdrop.group);
    // the street beyond the lot
    const street = new THREE.Mesh(new THREE.PlaneGeometry(400, 14), new THREE.MeshLambertMaterial({ color: new THREE.Color(d.palette.road).multiplyScalar(0.9) }));
    street.rotation.x = -Math.PI / 2; street.position.set(0, VS - 0.01, w.wz(7.5)); this.siteGroup.add(street);
    this.scene.fog = new THREE.Fog(new THREE.Color(l.fog), l.fogNear, l.fogFar);
    this.scene.background = new THREE.Color(l.sky[2]);
    this.hemi.color.set(l.hemiSky); this.hemi.groundColor.set(l.hemiGround); this.hemi.intensity = l.hemiI * 1.5;
    this.sunL.color.set(l.sun); this.sunL.intensity = l.sunI;
    // the van and Rocco
    this.van = vanRig(); this.siteGroup.add(this.van.root);
    this.vanX = this.layout.van.x; this.vanZ = this.layout.van.z; this.vanYaw = this.layout.van.yaw;
    this.rocco = roccoRig(outfitOf(this.opts.outfit).hoodie); this.siteGroup.add(this.rocco.root);
    this.rocco.parts.armR.add(this.handTool); this.handTool.position.set(0, -0.48, 0.1); this.handTool.rotation.set(Math.PI / 2, 0, 0);
    const p = this.player, sp = this.layout.spawn;
    p.x = sp.x; p.z = sp.z; p.y = VS; p.vx = p.vy = p.vz = 0; p.grounded = true;
    p.maxHp = maxHealth(this.opts.suit.armor); p.hp = p.maxHp; p.alive = true; p.shield = 0;
    this.camYaw = 0; this.camPitch = -0.05;
    this.oilMax = oilMax(this.opts.suit.tank); this.oil = this.oilMax;
    this.power = { mega: 0, shield: 0, magnet: 0, speed: 0, xray: 0, double: 0 };
    if (!this.opts.owned.includes(this.tool)) this.tool = "hammer";
    this.setTool(this.tool);
    // the loot
    // the loot quota counts what's outside the vaults (the vaults' gold is a bonus for cracking them)
    const inVault = (x: number, z: number) => { const i = w.ci(x), k = w.ck(z); return this.layout.vaults.some((v) => i >= v.i0 && i <= v.i1 && k >= v.k0 && k <= v.k1); };
    let total = 0;
    for (const s of this.layout.loot) { this.place(s.kind, s.x, s.y, s.z, s.value * (this.site.twist === "gold" ? 2 : 1)); if (!inVault(s.x, s.z)) total += s.value; }
    let gold = 0, safes = 0;
    const plane = w.nx * w.nz;
    for (let c = 0; c < w.data.length; c++) {
      const m = w.data[c];
      if (m !== GOLD && m !== SAFE) continue;
      const rem = c % plane, k = Math.floor(rem / w.nx), i = rem - k * w.nx;
      if (inVault(w.wx(i), w.wz(k))) continue;
      if (m === GOLD) gold++; else safes++;
    }
    this.lootTotal = Math.max(1, Math.round((total + gold * 45 + safes * 110) * (this.site.twist === "gold" ? 2 : 1)));
    this.siteLoot = 0; this.blocksBroken = 0; this.vaultBroken = 0; this.siteT = 0;
    this.totals = { loot: 0, blocks: 0, bots: 0 }; this.banked = { loot: 0, blocks: 0, bots: 0 };
    // turrets wait, asleep, on the walls
    for (const t of this.layout.turrets) { const b = this.addBot("turret", false, t.x, t.y, t.z); b.yaw = t.yaw; b.mount = { x: t.x - Math.sin(t.yaw) * 0.5, y: t.y + 0.3, z: t.z - Math.cos(t.yaw) * 0.5 }; b.spawnT = 0; }
    this.alarm = false; this.audio?.alarm(false);
    this.resetGoal(); this.goalWait = 1.2;
    // a later goal of a site: the building's already been broken into
    if (this.goalI > 0) { this.alarm = true; }
    this.setMode(mode);
    if (mode === "intro") {
      this.vanX = this.layout.van.x - 34;
      this.opts.onEvent({ k: "start", heist, codename: this.plan.codename, minutes: this.plan.minutes, sites: this.plan.sites.length, site: this.siteI, siteName: this.site.name, goal: this.goalI, remix: this.plan.remix > 0, restart });
      sfx("van_engine", { gain: 0.6 });
    }
    this.cam.set(p.x, 30, p.z - 30); this.camLook.set(0, 4, 8);
    this.audio?.setAmbience(d.ambience);
    this.pushHud();
  }
  private colourWorld(d: District, partner: District | null) {
    const w = this.world, P = (k: keyof District["palette"]) => (partner ? mixHex(d.palette[k], partner.palette[k], this.plan.blendAmt * 0.8) : d.palette[k]);
    const set = (m: number, top: string, side = top) => w.setColour(m, hex(top), hex(side));
    set(1, P("top"), P("side")); set(2, P("road")); set(3, "#C89060"); set(4, P("glass")); set(5, "#FFFFFF"); set(6, "#FFFFFF"); set(7, "#FFFFFF"); set(8, "#FFFFFF");
    set(9, "#FFFFFF"); set(10, "#FFFFFF"); set(11, "#FFFFFF"); set(12, "#FFFFFF"); set(13, "#FFFFFF"); set(14, "#FFFFFF"); set(15, "#FFFFFF"); set(16, "#FFFFFF");
    set(17, "#FFFFFF"); set(18, "#FFFFFF"); set(19, "#FFFFFF"); set(20, "#FFFFFF"); set(21, "#FFFFFF"); set(22, "#FFFFFF"); set(23, "#FFFFFF"); set(24, "#FFFFFF");
    // the atlas carries the colour; ground and road are tinted a touch
    set(1, "#FFFFFF", "#E8E8E8"); set(2, "#FFFFFF");
  }
  private clearSite() {
    for (const b of this.bots) b.rig.mat.dispose();
    if (this.world) this.world.dispose();
    this.atlas?.dispose(); this.atlas = null;
    if (this.rocco) { this.rocco.parts.armR.remove(this.handTool); this.rocco.mat.dispose(); }
    if (this.van) this.van.mat.dispose();
    this.siteGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && (m.geometry as THREE.BufferGeometry).type === "PlaneGeometry") { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.siteGroup.clear();
    if (this.backdrop) { this.scene.remove(this.backdrop.group); this.backdrop.dispose(); this.backdrop = null; }
    for (const p of this.pickups) this.pickGroup.remove(p.mesh);
    for (const b of this.bolts) if (b.mesh) this.scene.remove(b.mesh);
    this.pickups = []; this.bolts = []; this.nums = []; this.bots = []; this.boss = null;
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
  play() { if (this.mode === "attract") this.load(this.heist, "intro", false, { site: this.siteI, goal: this.goalI }); this.ensureAudio(); }
  attract() { this.load(this.heist, "attract", false, { site: this.siteI, goal: this.goalI }); this.audio?.silence(); }
  private ensureAudio() { if (!this.audio) { this.audio = new CrumbleAudio(); this.audio.setAmbience(this.district.ambience); } }

  frame(dt: number) {
    if (!(dt > 0)) return;
    this.time += dt; this.modeT += dt;
    this.slowT = Math.max(0, this.slowT - dt);
    const target = this.slowT > 0 ? 0.3 : this.mode === "dead" && this.modeT < 1 ? 0.35 : 1;
    this.slow += (target - this.slow) * Math.min(1, dt * 10);
    const sdt = dt * this.slow;
    this.update(sdt, dt);
    this.updateCamera(dt);
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private update(dt: number, realDt: number) {
    const w = this.world, p = this.player, m = this.mode;
    const g = this.district.gravity * (this.site.twist === "lowgrav" ? 0.55 : 1);
    this.hurtT = Math.max(0, this.hurtT - realDt); this.hitMark = Math.max(0, this.hitMark - realDt);
    for (const k of POWERS) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt);
    if (m === "play") { this.siteT += dt; this.controlPlayer(dt, g); this.goals(dt); }
    else if (m === "dead") { p.speed = 0; fallBody(w, p, dt, g); }
    // robots
    const bw = { w, px: p.x, py: p.y, pz: p.z, pAlive: m === "play" && p.alive, d: this.site.d, g, t: this.time };
    for (const b of this.bots) {
      if (!b.alive) continue;
      if (b.kind === "turret") {
        // asleep until the alarm; falls when its wall goes
        if (b.mount && !w.solidAt(b.mount.x, b.mount.y, b.mount.z)) { b.mount = null; b.vy = 0; }
        if (!b.mount) { const hit = fallBody(w, b, dt, g); if (hit > 4) this.killBot(b, true); continue; }
        if (!this.alarm || m !== "play") continue;
      }
      if (m === "play" || m === "dead") botThink(bw, b, dt, (s) => this.botShot(s), (bb) => this.summon(bb));
      if (b.stuck > 5 && b.kind !== "warden") this.reposition(b);
    }
    for (const b of this.bots) if (b.alive) poseBot(b, dt, this.time);
    for (let i = this.bots.length - 1; i >= 0; i--) { const b = this.bots[i]; if (!b.alive) { b.dead += dt; if (b.dead > 0.05) { this.siteGroup.remove(b.rig.root); b.rig.mat.dispose(); this.bots.splice(i, 1); } } }
    this.updateBolts(dt);
    this.updatePickups(dt);
    for (let i = this.nums.length - 1; i >= 0; i--) { const n = this.nums[i]; n.life -= realDt; n.y += realDt * 1.2; if (n.life <= 0) this.nums.splice(i, 1); }
    this.fx.update(dt, (x, y, z) => w.floorBelow(x, y, z));
    // the world catches up with what broke
    w.rebuild(this.quality === "low" ? 2 : 3);
    // the van
    this.updateVan(dt);
    // Rocco's body
    this.poseRocco(dt);
    if (m === "dead" && this.modeT > 2.2) this.respawn();
    if (m === "intro" && this.modeT > 4.4) { this.setMode("play"); this.ensureAudio(); }
    if (m === "clear" && this.modeT > 4) { this.setMode("warp"); sfx("warp"); }
    if (m === "warp" && this.modeT > 0.6) { const to = this.warpTo; this.warpTo = null; this.load(to?.heist ?? this.heist, "intro", false, to ? { site: to.site, goal: 0 } : null); }
  }
  private warpTo: { heist: number; site: number } | null = null;

  // ---------------------------------------------------------------- you
  private controlPlayer(dt: number, g: number) {
    const p = this.player, w = this.world;
    if (!p.alive) return;
    let mx = this.move.x, my = this.move.y;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const sprint = (this.keys.has("ShiftLeft") || ml > 0.95) && my > 0.3 && !this.using;
    const sp = runSpeed(this.opts.suit.boots) * (sprint ? 1.3 : 1) * (this.power.speed > 0 ? 1.35 : 1) * (this.using && this.tool === "drill" ? 0.6 : 1);
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    moveBody(w, p, (sy * my - cy * mx) * sp * dt, (cy * my + sy * mx) * sp * dt, true);
    p.speed = ml * sp; p.yaw = this.camYaw; p.pitch = this.camPitch;
    const jump = this.jumpKey || this.keys.has("Space");
    if (jump && !this.jumpPress && p.grounded) { p.vy = 8.2 + this.opts.suit.boots * 0.25; p.grounded = false; sfx("jump", { gain: 0.5 }); }
    this.jumpPress = jump;
    const hit = fallBody(w, p, dt, g);
    unstick(w, p);
    if (hit > 7) { sfx("land", { gain: clamp(hit / 16, 0.3, 1) }); this.shake = Math.max(this.shake, clamp(hit / 40, 0.05, 0.3)); if (hit > 15) this.damagePlayer((hit - 15) * 4, null, true); }
    if (p.grounded && p.speed > 1) { this.stepT -= dt * p.speed; p.walk += dt * p.speed * 1.6; if (this.stepT <= 0) { this.stepT = 2.1; sfx("step", { rate: 0.9 + Math.random() * 0.2 }); } }
    // the tool
    this.useT -= dt; this.swing = Math.max(0, this.swing - dt * 3.2);
    this.aim();
    const firing = this.using || (this.keys.has("KeyF"));
    if (firing && this.useT <= 0) this.useTool();
    if (!(firing && this.tool === "drill")) this.audio?.drill(false);
    if (this.oil < this.oilMax * 0.2 && !this.lowOilWarned && this.tool === "drill") { this.lowOilWarned = true; this.opts.onEvent({ k: "lowOil" }); }
    if (this.oil > this.oilMax * 0.35) this.lowOilWarned = false;
  }
  /** what's under the crosshair: a robot (with aim help on phones) or a block in reach */
  private aim() {
    const cam = this.camera.position, f = this.fwd;
    this.camera.getWorldDirection(f);
    const reach = this.tool === "paint" ? 7 : this.tool === "drill" ? 2.8 : this.tool === "hammer" ? 3 : 60;
    this.aimOk = this.world.raycast(cam.x, cam.y, cam.z, f.x, f.y, f.z, reach, this.aimHit);
    // robots near the crosshair
    const touch = isPhone() || this.move.x !== 0 || this.move.y !== 0;
    const cone = touch ? 0.13 : 0.05;
    let best: Bot | null = null, bestA = cone;
    for (const b of this.bots) {
      if (!b.alive || b.spawnT > 0) continue;
      const cx = b.x - cam.x, cy2 = b.y + b.h * 0.5 - cam.y, cz = b.z - cam.z, d = Math.hypot(cx, cy2, cz);
      if (d > 60 || (this.aimOk && d > this.aimHit.t + 1)) continue;
      const ang = Math.acos(clamp((cx * f.x + cy2 * f.y + cz * f.z) / d, -1, 1));
      if (ang < bestA + Math.atan(b.hw / d) && this.world.clearLine(cam.x, cam.y, cam.z, b.x, b.y + b.h * 0.5, b.z, true)) { bestA = ang; best = b; }
    }
    this.aimBot = best;
    const near = this.aimOk && (this.tool === "hammer" || this.tool === "drill" || this.tool === "paint");
    this.outline.visible = near && this.mode === "play";
    if (near) this.outline.position.set(this.world.wx(this.aimHit.i), this.world.wy(this.aimHit.j), this.world.wz(this.aimHit.k));
  }
  setTool(id: ToolId) {
    if (!this.opts.owned.includes(id)) return;
    this.tool = id;
    const g = toolGeometry(id);
    this.viewTool.geometry = g; this.handTool.geometry = g;
    this.viewBit.visible = id === "drill";
    this.viewTool.rotation.set(id === "hammer" ? -0.4 : 0, id === "hammer" ? 0.3 : Math.PI, 0);
    if (id === "hammer") this.viewTool.rotation.set(-0.5, 0.2, 0.3);
    sfx("equip", { gain: 0.4 });
  }
  cycleTool(dir = 1) {
    const own = TOOLS.map((t) => t.id).filter((id) => this.opts.owned.includes(id));
    const i = own.indexOf(this.tool);
    this.setTool(own[(i + dir + own.length) % own.length]);
  }
  private ammoOf(id: ToolId) { return this.opts.ammo[id] ?? 0; }
  private spend(id: ToolId) {
    const n = this.ammoOf(id);
    if (n <= 0) { this.opts.onEvent({ k: "noAmmo", tool: id }); this.useT = 0.6; return false; }
    this.opts.ammo[id] = n - 1; this.opts.onAmmo({ [id]: n - 1 });
    return true;
  }
  private useTool() {
    const s = this.spec(this.tool), cam = this.camera.position, f = this.fwd;
    const mega = this.power.mega > 0;
    this.useT = 1 / s.rate;
    switch (this.tool) {
      case "hammer": {
        this.swing = 1; sfx("swing", { gain: 0.5, rate: 0.9 + Math.random() * 0.2 });
        if (this.aimBot && Math.hypot(this.aimBot.x - this.player.x, this.aimBot.z - this.player.z) < 3.2) { this.hurtBot(this.aimBot, s.damage * (mega ? 1.8 : 1), this.aimBot.x, this.aimBot.y + this.aimBot.h * 0.6, this.aimBot.z); this.shake = Math.max(this.shake, 0.12); break; }
        if (!this.aimOk) break;
        const h = this.aimHit, cx = this.world.wx(h.i) - h.nx * 0.15, cy = this.world.wy(h.j) - h.ny * 0.15, cz = this.world.wz(h.k) - h.nz * 0.15;
        const power = s.power + (mega ? 1 : 0), r = s.radius * (mega ? 1.7 : 1);
        if (!canBreak(h.m, power)) { sfx("clank", { gain: 0.6 }); this.fx.burst(SPARK, cx + h.nx * 0.3, cy + h.ny * 0.3, cz + h.nz * 0.3, 6, 4, 0.25, 0.06, 0xffe07a, 1); this.shake = Math.max(this.shake, 0.08); break; }
        this.smash(cx, cy, cz, r, power, h.nx, h.ny, h.nz, 3);
        this.shake = Math.max(this.shake, 0.16);
        break;
      }
      case "blaster": {
        const t = this.aimBot ? this.v1.set(this.aimBot.x, this.aimBot.y + this.aimBot.h * 0.55, this.aimBot.z) : this.v1.set(cam.x + f.x * 40, cam.y + f.y * 40, cam.z + f.z * 40);
        const m = this.v2.set(0.25, -0.2, -0.6).applyMatrix4(this.camera.matrixWorld);
        const dx = t.x - m.x, dy = t.y - m.y, dz = t.z - m.z, d = Math.hypot(dx, dy, dz) || 1, sp = 70;
        this.bolts.push({ x: m.x, y: m.y, z: m.z, vx: (dx / d) * sp, vy: (dy / d) * sp, vz: (dz / d) * sp, life: 1, dmg: s.damage, team: 0, power: s.power, radius: s.radius, kind: BOLT, hex: 0x5bf0ff, from: null, stuck: false, mesh: null });
        this.fx.spawn(FLASH, m.x, m.y, m.z, 0, 0, 0, 0.05, 0.3, 0x9af0ff);
        sfx("blaster", { gain: 0.45, rate: 0.95 + Math.random() * 0.1 });
        this.swing = 0.3;
        break;
      }
      case "drill": {
        if (this.oil <= 0) { this.opts.onEvent({ k: "lowOil" }); this.useT = 0.8; this.audio?.drill(false); break; }
        this.oil = Math.max(0, this.oil - 1 / s.rate);
        const metal = this.aimOk && MAT[this.aimHit.m].sound === "metal";
        this.audio?.drill(true, metal);
        if (this.aimBot && Math.hypot(this.aimBot.x - this.player.x, this.aimBot.z - this.player.z) < 3) this.hurtBot(this.aimBot, s.damage / s.rate * 1.2, this.aimBot.x, this.aimBot.y + this.aimBot.h * 0.5, this.aimBot.z);
        if (this.aimOk) {
          const h = this.aimHit, cx = this.world.wx(h.i), cy = this.world.wy(h.j), cz = this.world.wz(h.k);
          this.fx.burst(SPARK, cx + h.nx * 0.28, cy + h.ny * 0.28, cz + h.nz * 0.28, 3, 5, 0.25, 0.05, metal ? 0xffe07a : 0xd8c8a8, 1);
          if (canBreak(h.m, s.power)) this.smash(cx, cy, cz, s.radius, s.power, h.nx, h.ny, h.nz, 1, true);
        }
        break;
      }
      case "grenade": case "dynamite": case "rocket": {
        if (!this.spend(this.tool)) break;
        const m = this.v2.set(0.2, -0.15, -0.5).applyMatrix4(this.camera.matrixWorld);
        if (this.tool === "rocket") {
          const sp = 32;
          this.bolts.push({ x: m.x, y: m.y, z: m.z, vx: f.x * sp, vy: f.y * sp, vz: f.z * sp, life: 4, dmg: s.damage, team: 0, power: s.power, radius: s.radius, kind: ROCKET, hex: 0xff8a3a, from: null, stuck: false, mesh: this.projMesh("rocket") });
          sfx("rocket"); this.shake = Math.max(this.shake, 0.2);
        } else {
          const sp = this.tool === "grenade" ? 15 : 9;
          this.bolts.push({ x: m.x, y: m.y, z: m.z, vx: f.x * sp, vy: f.y * sp + 3, vz: f.z * sp, life: this.tool === "grenade" ? 1.7 : 3, dmg: s.damage, team: 0, power: s.power, radius: s.radius, kind: this.tool === "grenade" ? GRENADE : DYNAMITE, hex: 0xff3a3a, from: null, stuck: false, mesh: this.projMesh(this.tool) });
          sfx("throw"); if (this.tool === "dynamite") sfx("fuse", { delay: 0.2 });
        }
        this.swing = 1;
        break;
      }
      case "paint": {
        if (!this.aimOk) break;
        const h = this.aimHit;
        if (this.world.paint(h.i, h.j, h.k, this.paintCol)) {
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (h.nx !== 0) this.world.paint(h.i, h.j + a, h.k + b, this.paintCol); else if (h.ny !== 0) this.world.paint(h.i + a, h.j, h.k + b, this.paintCol); else this.world.paint(h.i + a, h.j + b, h.k, this.paintCol); }
          if (Math.random() < 0.3) sfx("spray", { gain: 0.35 });
        }
        break;
      }
    }
  }
  /** next paint colour */
  cyclePaint() { this.paintCol = (this.paintCol + 1) % 8; return this.paintCol; }
  private projMesh(id: ToolId) {
    const m = new THREE.Mesh(toolGeometry(id), sharedMat);
    if (id === "rocket") m.scale.setScalar(0.6);
    this.scene.add(m);
    return m;
  }

  // ---------------------------------------------------------------- breaking things
  /**
   * Break blocks in a sphere: chunks fly from the hole (pushed out along the face you hit), the material makes its
   * sound, gold and safes pay out, the building may come down, and the alarm trips.
   */
  private smash(x: number, y: number, z: number, r: number, power: number, nx: number, ny: number, nz: number, chunks: number, quiet = false) {
    const w = this.world, out = this.broken;
    out.length = 0;
    const n = w.carve(x, y, z, r, power, out, 300);
    if (n === 0) return 0;
    let best = "wood", bestN = 0;
    const counts: Record<string, number> = {};
    for (let q = 0; q < out.length; q += 4) {
      const i = out[q], j = out[q + 1], k = out[q + 2], m = out[q + 3];
      const snd = MAT[m].sound; counts[snd] = (counts[snd] ?? 0) + 1; if (counts[snd] > bestN) { bestN = counts[snd]; best = snd; }
      const cx = w.wx(i), cy = w.wy(j), cz = w.wz(k);
      if (q / 4 < chunks * 6 + 6) {
        for (let c = 0; c < chunks; c++) {
          const s = 2 + Math.random() * 4;
          this.fx.chunk(cx + (Math.random() - 0.5) * 0.3, cy + (Math.random() - 0.5) * 0.3, cz + (Math.random() - 0.5) * 0.3, nx * s + (Math.random() - 0.5) * 3, ny * s + 2 + Math.random() * 3, nz * s + (Math.random() - 0.5) * 3, 0.1 + Math.random() * 0.12, this.blockHex(m));
        }
      }
      if (m === GLASS) this.fx.burst(GLINT, cx, cy, cz, 2, 3, 0.4, 0.06, 0xc8f0ff, 0);
      if (MAT[m].loot === "gold" && Math.random() < 0.6) this.drop("gold", cx, cy, cz, 45);
      if (MAT[m].loot === "cash") { for (let c = 0; c < 3; c++) this.drop("cash", cx, cy, cz, 36); sfx("crack", { pan: this.pan(cx, cz) }); }
      if (m === VAULT) this.vaultBroken++;
      if (this.inBuilding(i, j, k)) this.blocksBroken++;
    }
    let inside = false;
    for (let q = 0; q < out.length && !inside; q += 4) if (this.inBuilding(out[q], out[q + 1], out[q + 2])) inside = true;
    this.fx.burst(SMOKE, x, y, z, Math.min(8, 2 + n), 1.5, 0.9, 0.35, this.blockHex(out[3]), 0.6);
    if (!quiet || Math.random() < 0.3) sfx(BREAK_SFX[best], { pan: this.pan(x, z), rate: 0.9 + Math.random() * 0.2, gain: quiet ? 0.5 : 1 });
    this.totals.blocks += n;
    // loot standing on what broke drops through the hole
    for (const pk of this.pickups) if (pk.settled && Math.abs(pk.x - x) < r + 1.5 && Math.abs(pk.z - z) < r + 1.5) pk.settled = false;
    if (inside) this.trip();
    this.collapse(out);
    return n;
  }
  /** whatever lost its hold falls: tumbling chunks, dust and a rumble */
  private collapse(broken: number[]) {
    const w = this.world, fell = this.fallen;
    fell.length = 0;
    const n = w.settle(broken, fell, 7000);
    if (n === 0) return;
    let shown = 0;
    const every = Math.max(1, Math.floor(n / 220));
    for (let q = 0; q < fell.length; q += 4) {
      const i = fell[q], j = fell[q + 1], k = fell[q + 2], m = fell[q + 3];
      if (this.inBuilding(i, j, k)) this.blocksBroken++;
      if (MAT[m].loot === "gold" && Math.random() < 0.5) this.drop("gold", w.wx(i), w.wy(j), w.wz(k), 45);
      if (MAT[m].loot === "cash") this.drop("cash", w.wx(i), w.wy(j), w.wz(k), 60);
      if ((q / 4) % every !== 0) continue;
      this.fx.chunk(w.wx(i), w.wy(j), w.wz(k), (Math.random() - 0.5) * 1.5, -1 - Math.random() * 2, (Math.random() - 0.5) * 1.5, VS * (0.7 + Math.random() * 0.3), this.blockHex(m), 2.6);
      if (shown++ % 6 === 0) this.fx.spawn(SMOKE, w.wx(i), w.wy(j), w.wz(k), 0, 0.5, 0, 1.6, 0.8, 0xc8c0b0);
    }
    this.totals.blocks += n;
    sfx(n > 120 ? "collapse" : "crumble", { pan: this.pan(w.wx(fell[0]), w.wz(fell[2])), gain: Math.min(1, 0.4 + n / 300) });
    this.shake = Math.max(this.shake, Math.min(0.9, 0.15 + n / 500));
    if (n > 200 && !this.reduced) this.slowT = Math.max(this.slowT, 0.6);
    if (n > 60) this.opts.onEvent({ k: "collapse", blocks: n });
    // anything standing on what fell drops with it
    for (const pk of this.pickups) pk.settled = false;
  }
  private inBuilding(i: number, j: number, k: number) { const b = this.layout.box; return i >= b.i0 - 4 && i <= b.i1 + 1 && k >= b.k0 - 4 && k <= b.k1 + 1 && j >= 1 && j <= b.j1; }
  private blockHex(m: number) {
    const c = BLOCK_HEX[m] ?? 0x9a9aa0;
    if (m === 5 || m === 1) return hex(m === 5 ? this.district.palette.wall : this.district.palette.top);
    if (m === 6) return hex(this.district.palette.wall2);
    if (m === 8) return hex(this.district.palette.roof);
    if (m === 14) return hex(this.district.palette.leaf);
    return c;
  }
  /** an explosion: a sphere of broken blocks, hurt robots (and you, a little), fire, smoke, a flash, a shock ring */
  private explode(x: number, y: number, z: number, r: number, power: number, dmg: number, team: 0 | 1) {
    this.smash(x, y, z, r, power, 0, 1, 0, 2);
    this.fx.explode(x, y, z, r * 0.55, [0x8a8a90, 0x5a5048, 0xff8a2a], this.quality === "low" ? 0.6 : 1);
    this.fx.burst(SMOKE, x, y + 0.5, z, 6, 2.4, 1.6, 0.4, 0xc8c0b4, 1.4);
    sfx(r > 2.2 ? "boom_big" : "boom", { pan: this.pan(x, z), gain: clamp(1.2 - this.distCam(x, z) / 60, 0.3, 1) });
    this.shake = Math.max(this.shake, clamp(1.1 - this.distCam(x, z) / 30, 0.1, 1));
    if (r > 2.2 && !this.reduced) this.slowT = Math.max(this.slowT, 0.25);
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - x, b.y + b.h * 0.5 - y, b.z - z);
      if (d < r * 1.6) this.hurtBot(b, dmg * (1 - d / (r * 1.6)) * (team === 1 ? 0.3 : 1), b.x, b.y + b.h * 0.6, b.z);
    }
    const p = this.player, d = Math.hypot(p.x - x, p.y + 1 - y, p.z - z);
    if (d < r * 1.5) this.damagePlayer(dmg * (1 - d / (r * 1.5)) * (team === 0 ? 0.14 : 0.6), null, team === 0);
  }
  /** the alarm trips the first time the building is touched */
  private trip() {
    if (this.alarm) return;
    this.alarm = true;
    this.audio?.alarm(true);
    sfx("bell"); sfx("alarm", { delay: 0.3 });
    this.opts.onEvent({ k: "alarm" });
    this.spawnT = 2.5;
  }

  // ---------------------------------------------------------------- projectiles
  private botShot(s: Shot) {
    const b = s.from, spec = b.spec, d = this.site.d;
    const dmg = spec.damage * (0.95 + d * 0.9) * (b.elite ? 1.3 : 1);
    if (spec.melee) { if (Math.hypot(this.player.x - b.x, this.player.z - b.z) < spec.range + 0.6) { this.damagePlayer(dmg, b); sfx("hound", { pan: this.pan(b.x, b.z), gain: 0.6 }); } return; }
    const dx = s.tx - s.x, dy = s.ty - s.y, dz = s.tz - s.z, dist = Math.hypot(dx, dy, dz) || 1;
    const rocket = s.kind === "rocket", sp = rocket ? 18 : s.kind === "cannon" ? 30 : 34;
    this.bolts.push({ x: s.x, y: s.y, z: s.z, vx: (dx / dist) * sp, vy: (dy / dist) * sp, vz: (dz / dist) * sp, life: 3, dmg, team: 1, power: rocket ? 3 : 1, radius: rocket ? 1.4 : 0.3, kind: rocket ? ROCKET : s.kind === "cannon" ? CANNON : BOLT, hex: rocket ? 0xff6a3a : 0xff3a5a, from: b, stuck: false, mesh: rocket ? this.projMesh("rocket") : null });
    if (this.nearCam(s.x, s.z, 40)) sfx(b.kind === "turret" ? "turret_shot" : rocket ? "rocket" : "robot_shot", { pan: this.pan(s.x, s.z), gain: 0.4 });
  }
  private updateBolts(dt: number) {
    const w = this.world, p = this.player;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      let boom = b.life <= 0 && (b.kind === GRENADE || b.kind === DYNAMITE || b.kind === ROCKET);
      if (b.life <= 0 && !boom) { this.dropBolt(i); continue; }
      if (!b.stuck && !boom) {
        if (b.kind === GRENADE || b.kind === DYNAMITE) b.vy -= 20 * dt;
        const steps = b.kind === BOLT || b.kind === CANNON ? 3 : 2;
        for (let s = 0; s < steps && !boom; s++) {
          const nx = b.x + b.vx * dt / steps, ny = b.y + b.vy * dt / steps, nz = b.z + b.vz * dt / steps;
          const m = w.at(nx, ny, nz);
          if (m !== AIR || ny < VS) {
            if (b.kind === GRENADE) {
              // bounce off the face it hit
              if (w.at(nx, b.y, b.z) !== AIR) b.vx *= -0.45; if (w.at(b.x, ny, b.z) !== AIR || ny < VS) b.vy *= -0.4; if (w.at(b.x, b.y, nz) !== AIR) b.vz *= -0.45;
              b.vx *= 0.8; b.vz *= 0.8;
              if (Math.abs(b.vy) > 1.5) sfx("bounce", { pan: this.pan(b.x, b.z), gain: 0.4 });
              break;
            }
            if (b.kind === DYNAMITE) { b.stuck = true; b.vx = b.vy = b.vz = 0; break; }
            if (b.kind === ROCKET || b.kind === CANNON) { boom = true; b.x = nx; b.y = ny; b.z = nz; break; }
            // a bolt: chips weak blocks
            if (canBreak(m, b.power)) this.smash(nx, ny, nz, b.radius, b.power, -b.vx / 70, -b.vy / 70, -b.vz / 70, 1, true);
            else this.fx.burst(SPARK, b.x, b.y, b.z, 3, 3, 0.2, 0.05, b.hex, 0);
            boom = false; b.life = -1; break;
          }
          b.x = nx; b.y = ny; b.z = nz;
          // hits
          if (b.team === 0) {
            for (const r of this.bots) {
              if (!r.alive || r.spawnT > 0) continue;
              const dx = b.x - r.x, dy = b.y - (r.y + r.h * 0.5), dz = b.z - r.z, rr = r.hw + (b.kind === BOLT ? 0.25 : 0.4);
              if (dx * dx + dz * dz < rr * rr && Math.abs(dy) < r.h * 0.6) {
                if (b.kind !== BOLT) { boom = true; break; }
                // a riot bot's shield stops shots from the front
                if (r.kind === "shield" && Math.abs(angDiff(r.yaw, Math.atan2(-b.vx, -b.vz))) < 0.9) { this.fx.burst(SPARK, b.x, b.y, b.z, 5, 4, 0.2, 0.05, 0x9af0ff, 0); sfx("clank", { gain: 0.35 }); }
                else this.hurtBot(r, b.dmg, b.x, b.y, b.z);
                b.life = -1; break;
              }
            }
          } else if (p.alive && this.mode === "play") {
            const dx = b.x - p.x, dy = b.y - (p.y + 0.9), dz = b.z - p.z;
            if (dx * dx + dz * dz < 0.35 && Math.abs(dy) < 1) { if (b.kind === ROCKET) boom = true; else { this.damagePlayer(b.dmg, b.from); b.life = -1; } break; }
          }
          if (b.life < 0) break;
        }
        if (b.life < 0 && !boom) { this.dropBolt(i); continue; }
      }
      if (b.kind === DYNAMITE && Math.random() < 0.6) this.fx.spawn(SPARK, b.x, b.y + 0.2, b.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, 0.25, 0.06, 0xffd27a);
      if (b.kind === ROCKET && Math.random() < 0.8) this.fx.spawn(SMOKE, b.x, b.y, b.z, 0, 0.4, 0, 0.7, 0.25, 0x8a8a90);
      if (b.mesh) { b.mesh.position.set(b.x, b.y, b.z); if (b.kind === ROCKET) b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); else b.mesh.rotation.x += dt * 8; }
      if (boom) {
        const big = b.kind === DYNAMITE;
        const mega = this.power.mega > 0 && b.team === 0;
        this.explode(b.x, b.y, b.z, b.radius * (mega ? 1.3 : 1), b.power, b.dmg, b.team);
        if (big) this.fx.spawn(FIRE, b.x, b.y + 1, b.z, 0, 2, 0, 0.8, 3, 0xffb03a);
        this.dropBolt(i);
      }
    }
  }
  private dropBolt(i: number) { const b = this.bolts[i]; if (b.mesh) this.scene.remove(b.mesh); this.bolts.splice(i, 1); }

  // ---------------------------------------------------------------- robots
  private addBot(kind: BotKind | "warden", elite: boolean, x: number, y: number, z: number) {
    const d = this.site.d;
    const hpScale = (1.2 + d * 1.5) * (this.plan.remix ? 1.1 : 1) * (kind === "warden" ? 1.4 + d * 1.2 : 1);
    const b = makeBot(kind, elite, x, y, z, hpScale);
    b.yaw = Math.atan2(this.player.x - x, this.player.z - z);
    this.bots.push(b);
    this.siteGroup.add(b.rig.root);
    if (this.renderer.shadowMap.enabled) b.rig.root.traverse((m) => { (m as THREE.Mesh).castShadow = true; });
    return b;
  }
  /** an open spot near you (not too near) where a robot can teleport in */
  private spotNear(minD: number, maxD: number, flying: boolean) {
    const w = this.world, p = this.player;
    for (let t = 0; t < 24; t++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = clamp(p.x + Math.cos(a) * d, w.x0 + 2, -w.x0 - 2), z = clamp(p.z + Math.sin(a) * d, w.z0 + 2, -w.z0 - 2);
      const y = w.floorBelow(x, p.y + 2.5, z);
      if (Math.abs(y - p.y) > 3.2) continue;
      if (w.boxHits(x - 0.4, y + 0.05, z - 0.4, x + 0.4, y + 1.9, z + 0.4)) continue;
      return this.v3.set(x, flying ? y + 2.5 : y, z);
    }
    const h = this.layout.hatches[Math.floor(Math.random() * this.layout.hatches.length)];
    return this.v3.set(h.x, flying ? h.y + 3 : h.y, h.z);
  }
  private spawnBot(kind: BotKind | "warden", elite: boolean) {
    const flying = kind === "drone";
    const s = this.spotNear(kind === "warden" ? 10 : 7, kind === "warden" ? 18 : 16, flying);
    const b = this.addBot(kind, elite, s.x, s.y, s.z);
    this.fx.burst(GLINT, s.x, s.y + 1, s.z, 12, 3, 0.6, 0.12, 0xff4a5a, 2);
    this.fx.spawn(FLASH, s.x, s.y + 1, s.z, 0, 0, 0, 0.3, 1.6, 0xff6a7a);
    if (this.nearCam(s.x, s.z, 30)) sfx(kind === "drone" ? "drone" : kind === "hound" ? "hound" : "warp", { pan: this.pan(s.x, s.z), gain: 0.35 });
    return b;
  }
  private reposition(b: Bot) { const s = this.spotNear(6, 14, b.kind === "drone"); b.x = s.x; b.y = s.y; b.z = s.z; b.vy = 0; b.stuck = 0; b.spawnT = 0.9; }
  private summon(b: Bot) { for (let k = 0; k < 2; k++) { if (this.bots.length > 26) return; this.spawnBot(this.pickBot(), false); } void b; }
  private pickBot(): BotKind {
    const mix = this.site.bots.filter(([k]) => k !== "turret");
    let t = 0; for (const [, wt] of mix) t += wt;
    let v = Math.random() * t;
    for (const [k, wt] of mix) { v -= wt; if (v <= 0) return k; }
    return mix[0]?.[0] ?? "guard";
  }
  private hurtBot(b: Bot, dmg: number, x: number, y: number, z: number) {
    if (!b.alive) return;
    b.hp -= dmg; b.flash = 1; this.hitMark = 0.12;
    if (this.nums.length < 24) this.nums.push({ x, y: y + 0.3, z, v: Math.round(dmg), life: 0.7, col: dmg > 60 ? "#FFD23F" : "#FFFFFF" });
    if (Math.random() < 0.5) sfx("robot_hit", { pan: this.pan(x, z), rate: 0.9 + Math.random() * 0.3 });
    if (b.hp <= 0) this.killBot(b, false);
  }
  private killBot(b: Bot, quiet: boolean) {
    b.alive = false; b.dead = 0;
    const y = b.y + b.h * 0.45, big = b.kind === "warden";
    this.fx.explode(b.x, y, b.z, big ? 3.5 : b.kind === "heavy" ? 1.4 : 1, b.elite ? [0xc8a040, 0x2a2d3a, 0xffd27a] : [0x2a3a6a, 0x2a2d3a, 0x8a92a6, 0xff3a3a], this.quality === "low" ? 0.6 : 1);
    if (!quiet) sfx(big ? "boom_big" : "robot_down", { pan: this.pan(b.x, b.z), gain: big ? 1 : 0.6 });
    this.shake = Math.max(this.shake, big ? 1 : 0.12);
    this.totals.bots++;
    const coins = Math.round(b.spec.coins * (1 + this.heist / 120) * (b.elite ? 2 : 1));
    for (let k = 0; k < (big ? 16 : 2); k++) this.drop("coin", b.x, y, b.z, Math.ceil(coins / (big ? 16 : 2)));
    const lowHp = this.player.hp / this.player.maxHp < 0.45, roll = Math.random();
    if (roll < (lowHp ? 0.16 : 0.07)) this.drop("heart", b.x, y, b.z, 1);
    else if (roll < 0.14) this.drop("oil", b.x, y, b.z, 1);
    else if (roll < 0.2) this.drop("ammo", b.x, y, b.z, 1);
    else if (roll < 0.25 || big) this.drop("power", b.x, y, b.z, 1);
    if (b === this.boss) { this.boss = null; if (!this.reduced) this.slowT = 1.4; this.audio?.alarm(true); }
  }

  // ---------------------------------------------------------------- you, hurt
  private damagePlayer(dmg: number, from: Bot | null, env = false) {
    const p = this.player;
    if (this.mode !== "play" || !p.alive) return;
    if (p.shield > 0 || (this.power.shield > 0 && !env)) { if (!env) { sfx("clank", { gain: 0.4 }); this.fx.burst(SPARK, p.x, p.y + 1, p.z, 5, 4, 0.2, 0.07, 0x5ab8ff, 0); } return; }
    p.hp -= dmg; this.hurtT = 0.35;
    this.shake = Math.max(this.shake, clamp(dmg / 40, 0.08, 0.4));
    sfx("hurt", { gain: 0.6 });
    if (from) this.hitFrom = { x: from.x, z: from.z, t: 1 };
    this.opts.onEvent({ k: "hurt" });
    if (p.hp <= 0) this.playerDown();
  }
  hitFrom: { x: number; z: number; t: number } | null = null;
  private playerDown() {
    const p = this.player;
    p.hp = 0; p.alive = false;
    this.lives = Math.max(0, this.lives - 1); this.opts.onLives(this.lives);
    sfx("fail");
    this.setMode("dead"); this.using = false;
    this.opts.onEvent({ k: "down", livesLeft: this.lives });
  }
  private respawn() {
    const p = this.player;
    if (this.lives <= 0) { this.lives = 3; this.opts.onLives(3); this.restartGoal("Out of lives"); return; }
    p.alive = true; p.hp = p.maxHp; p.shield = 3;
    this.toVan(); this.setMode("play");
    this.fx.burst(FLASH, p.x, p.y + 1, p.z, 1, 0, 0.3, 2.5, 0x9af0ff, 0);
  }
  private toVan() { const p = this.player, sp = this.layout.spawn; p.x = sp.x; p.z = sp.z; p.y = VS + 0.2; p.vy = 0; unstick(this.world, p); }

  // ---------------------------------------------------------------- loot and pickups
  private place(kind: PickupKind, x: number, y: number, z: number, value: number) {
    const sub = kind === "gem" ? GEM_COLS[Math.floor(Math.random() * GEM_COLS.length)] : kind === "art" ? ART_COLS[Math.floor(Math.random() * ART_COLS.length)] : "";
    const mesh = new THREE.Mesh(pickupGeometry(kind, sub), sharedMat);
    mesh.position.set(x, y + 0.2, z);
    this.pickGroup.add(mesh);
    this.pickups.push({ kind, sub, x, y: y + 0.2, z, vx: 0, vy: 0, vz: 0, mesh, t: Math.random() * 6, value, settled: false });
  }
  private drop(kind: PickupKind, x: number, y: number, z: number, value: number) {
    if (this.pickups.length > 160) return;
    const sub = kind === "power" ? POWERS[Math.floor(Math.random() * POWERS.length)] : kind === "gem" ? GEM_COLS[0] : "";
    const mesh = new THREE.Mesh(pickupGeometry(kind, sub), sharedMat);
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5;
    mesh.position.set(x, y, z);
    this.pickGroup.add(mesh);
    this.pickups.push({ kind, sub, x, y, z, vx: Math.cos(a) * s, vy: 4 + Math.random() * 3, vz: Math.sin(a) * s, mesh, t: Math.random() * 6, value, settled: false });
  }
  private updatePickups(dt: number) {
    const p = this.player, w = this.world;
    const magnet = this.power.magnet > 0 ? 10 : magnetR(this.opts.suit.bag);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      if (!pk.settled) {
        pk.vy -= 18 * dt; pk.x += pk.vx * dt; pk.z += pk.vz * dt; pk.y += pk.vy * dt; pk.vx *= 0.98; pk.vz *= 0.98;
        const f = w.floorBelow(pk.x, pk.y + 0.3, pk.z) + 0.25;
        if (pk.y < f) { pk.y = f; if (Math.abs(pk.vy) < 2) { pk.vy = 0; pk.vx = 0; pk.vz = 0; pk.settled = true; } else pk.vy *= -0.3; }
      }
      const dx = p.x - pk.x, dy = p.y + 0.9 - pk.y, dz = p.z - pk.z, d = Math.hypot(dx, dy, dz);
      const isLoot = pk.kind === "cash" || pk.kind === "gold" || pk.kind === "gem" || pk.kind === "art" || pk.kind === "coin";
      if ((this.mode === "play" || this.mode === "clear") && p.alive && ((isLoot && d < magnet) || d < 1.5 || pk.t < -50)) {
        const k = Math.min(1, dt * (pk.t < -50 ? 6 : 10) / Math.max(0.3, d));
        pk.x += dx * k; pk.y += dy * k; pk.z += dz * k; pk.settled = true;
        if (d < 0.8) { this.take(pk); this.pickGroup.remove(pk.mesh); this.pickups.splice(i, 1); continue; }
      }
      pk.mesh.position.set(pk.x, pk.y + (pk.settled ? Math.sin(pk.t * 3) * 0.08 : 0), pk.z);
      pk.mesh.rotation.y = pk.t * (pk.kind === "art" ? 0.8 : 2.2);
    }
  }
  private take(pk: Pickup) {
    const p = this.player;
    switch (pk.kind) {
      case "cash": case "gold": case "gem": case "art": case "coin": {
        const v = Math.round(pk.value * (this.power.double > 0 ? 2 : 1));
        this.addCoins(v);
        if (pk.kind !== "coin") { this.loot += v; this.siteLoot += v; this.totals.loot += v; }
        sfx(pk.kind === "cash" ? "cash" : pk.kind === "gold" ? "gold" : pk.kind === "gem" || pk.kind === "art" ? "gem" : "coin", { rate: 0.95 + Math.random() * 0.12 });
        this.fx.burst(GLINT, pk.x, pk.y, pk.z, 4, 2, 0.3, 0.1, 0xffe07a, 1);
        if (pk.kind !== "coin" && pk.kind !== "cash") this.opts.onEvent({ k: "pickup", what: pk.kind, value: v });
        if (pk.kind !== "coin") this.trip();
        return;
      }
      case "heart":
        if (p.hp < p.maxHp - 1) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45); else { this.lives = Math.min(5, this.lives + 1); this.opts.onLives(this.lives); }
        sfx("heart"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 10, 3, 0.6, 0.14, 0xff5a8a, 1); break;
      case "oil": this.oil = this.oilMax; sfx("oil"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 8, 3, 0.5, 0.12, 0xff8a3a, 1); break;
      case "ammo": {
        const a: Partial<Record<ToolId, number>> = {};
        for (const id of ["grenade", "dynamite", "rocket"] as ToolId[]) if (this.opts.owned.includes(id)) { const t = toolOf(id); a[id] = Math.min(t.ammo * 4, this.ammoOf(id) + Math.max(1, Math.round(t.pack / 2))); this.opts.ammo[id] = a[id]; }
        this.opts.onAmmo(a); sfx("ammo"); break;
      }
      case "power": {
        const id = (pk.sub || "mega") as PowerId;
        this.power[id] = POWER_SECS[id];
        sfx("power"); this.fx.burst(GLINT, pk.x, pk.y, pk.z, 12, 4, 0.6, 0.14, 0xffd23f, 1);
        this.opts.onEvent({ k: "pickup", what: id, value: 0 });
        return;
      }
    }
    this.opts.onEvent({ k: "pickup", what: pk.kind, value: 0 });
  }
  private addCoins(v: number) { this.coins += v; this.opts.onCoins(this.coins); }

  // ---------------------------------------------------------------- goals
  private resetGoal() { this.goal = null; this.goalT = 0; this.goalDone = false; this.bossUp = false; }
  get goalNo() { let n = 0; for (let i = 0; i < this.siteI; i++) n += this.plan.sites[i].goals.length; return n + this.goalI + 1; }
  private insideBuilding() { const b = this.layout.box, w = this.world, i = w.ci(this.player.x), k = w.ck(this.player.z); return i > b.i0 && i < b.i1 && k > b.k0 && k < b.k1; }
  private goals(dt: number) {
    if (!this.goal) { this.goalWait -= dt; if (this.goalWait <= 0) this.startGoal(); return; }
    const g = this.goal, s = this.site;
    if (this.goalDone) { this.goalWait -= dt; if (this.goalWait <= 0) this.nextGoal(); return; }
    this.goalT += dt;
    // security pours in once the alarm is up, harder while you hold out
    if (this.alarm) {
      let alive = 0; for (const b of this.bots) if (b.alive && b.kind !== "turret") alive++;
      // lighter while you search and smash, all-out while you hold out, with the boss, and on the run
      const busy = g.kind === "loot" || g.kind === "vault" || g.kind === "wreck" || g.kind === "breach";
      const capK = g.kind === "hold" ? 1.25 : g.kind === "boss" ? 0.55 : g.kind === "escape" ? 0.9 : busy ? 0.55 : 1;
      const cap = Math.min(Math.max(2, Math.round(s.cap * capK)), this.quality === "low" ? 9 : this.quality === "medium" ? 12 : 15);
      this.spawnT -= dt;
      if (alive < cap && this.spawnT <= 0) {
        this.spawnBot(this.pickBot(), Math.random() < s.elite);
        this.spawnT = s.every * (g.kind === "hold" ? 0.6 : g.kind === "escape" ? 0.8 : busy ? 1.7 : 1) * (0.7 + Math.random() * 0.6);
      }
    }
    switch (g.kind) {
      case "breach": if (this.alarm || this.insideBuilding()) this.completeGoal(); break;
      case "loot": if (this.siteLoot >= g.share * this.lootTotal) this.completeGoal(); break;
      case "vault": {
        let near = !this.layout.vaults.length;
        for (const v of this.layout.vaults) if (Math.hypot(this.player.x - v.x, this.player.z - (v.z + 1.8)) < 2.4 && Math.abs(this.player.y - VS) < 1.5) near = true;
        if (near || this.vaultBroken >= 10) this.completeGoal();
        break;
      }
      case "hold": if (this.goalT >= g.secs) this.completeGoal(); break;
      case "wreck": if (this.blocksBroken >= g.share * this.layout.blocks) this.completeGoal(); break;
      case "boss": if (this.bossUp && !this.boss) this.completeGoal(); break;
      case "escape": {
        if (Math.hypot(this.player.x - this.vanX, this.player.z - (this.vanZ + 1.6)) < 3.4) { this.completeGoal(); break; }
        if (this.goalT > g.secs) { this.goalT = 0; this.opts.onEvent({ k: "radio", text: "Pip: I had to go round the block — I'm back, hurry!" }); for (let k = 0; k < 3; k++) this.spawnBot(this.pickBot(), false); }
        break;
      }
    }
  }
  private startGoal(again = false) {
    const g = this.site.goals[this.goalI];
    this.resetGoal();
    this.goal = g;
    switch (g.kind) {
      case "boss": {
        const b = this.spawnBot("warden", false);
        this.boss = b; this.bossUp = true; this.bossCam = 2.6;
        this.opts.onEvent({ k: "boss", name: "The Vault Warden" });
        sfx("warden"); this.trip();
        break;
      }
      case "escape": sfx("van_horn"); this.opts.onEvent({ k: "radio", text: "Pip: Van's out front — run!" }); this.trip(); break;
      case "hold": this.trip(); break;
    }
    // supplies for the next goal: a heart and an oil can nearby, now and then an ammo crate
    if (g.kind !== "breach") {
      const s1 = this.spotNear(3, 7, false); this.place("heart", s1.x, s1.y, s1.z, 1);
      const s2 = this.spotNear(3, 7, false); this.place("oil", s2.x, s2.y, s2.z, 1);
      if (g.kind === "vault" || Math.random() < 0.6) { const s3 = this.spotNear(3, 8, false); this.place("ammo", s3.x, s3.y, s3.z, 1); }
    }
    this.opts.onEvent({ k: "goal", no: this.goalNo, of: goalsIn(this.plan), title: g.title, hint: g.hint, kind: g.kind, again });
    sfx("radio", { gain: 0.6 });
  }
  private completeGoal() {
    if (this.goalDone || !this.goal) return;
    this.goalDone = true;
    const g = this.goal;
    const bonus = Math.round(25 + this.heist * 0.6 + this.site.d * 60);
    this.addCoins(bonus);
    sfx("goal");
    const lastGoal = this.goalI >= this.site.goals.length - 1, lastSite = this.siteI >= this.plan.sites.length - 1;
    const delta = { loot: this.totals.loot - this.banked.loot, blocks: this.totals.blocks - this.banked.blocks, bots: this.totals.bots - this.banked.bots };
    this.banked = { ...this.totals };
    if (!(lastGoal && lastSite)) this.opts.onCheckpoint(this.heist, lastGoal ? this.siteI + 1 : this.siteI, lastGoal ? 0 : this.goalI + 1, delta);
    this.opts.onEvent({ k: "goalDone", title: g.title, coins: bonus });
    this.goalWait = 2.6;
    if (g.kind === "escape") this.siteClear(lastSite, delta);
  }
  private nextGoal() { if (this.goalI < this.site.goals.length - 1) { this.goalI++; this.startGoal(); } }
  /** out of lives: this goal starts over (never the whole heist) */
  private restartGoal(why: string) {
    for (const b of this.bots) if (b.kind !== "turret") { this.siteGroup.remove(b.rig.root); b.rig.mat.dispose(); b.alive = false; }
    this.bots = this.bots.filter((b) => b.alive);
    this.boss = null;
    for (const b of this.bolts) if (b.mesh) this.scene.remove(b.mesh);
    this.bolts = [];
    const p = this.player;
    p.alive = true; p.hp = p.maxHp; p.shield = 3;
    this.toVan();
    this.resetGoal(); this.goalWait = 2.5;
    this.setMode("play");
    this.opts.onEvent({ k: "fail", why });
  }
  private siteClear(lastSite: boolean, delta: { loot: number; blocks: number; bots: number }) {
    this.setMode("clear"); this.using = false;
    this.audio?.alarm(false); this.audio?.drill(false);
    const bonus = Math.round(lastSite ? 400 + this.heist * 3 : 120 + this.heist);
    this.addCoins(bonus);
    sfx(lastSite ? "heist_clear" : "site_clear"); sfx("van_door"); sfx("van_engine", { delay: 0.5 });
    for (const pk of this.pickups) if (pk.kind === "coin") pk.t = -99;
    for (const b of this.bots) if (b.alive && b.kind !== "turret") this.killBot(b, true);
    if (lastSite) {
      this.opts.onEvent({ k: "clear", heist: this.heist, loot: this.loot, time: this.siteT });
      this.opts.onDone(this.heist + 1, delta);
      this.warpTo = { heist: this.heist + 1, site: 0 };
      this.loot = 0;
    } else {
      this.opts.onEvent({ k: "siteClear", name: this.site.name, coins: bonus });
      this.warpTo = { heist: this.heist, site: this.siteI + 1 };
    }
  }

  // ---------------------------------------------------------------- the van and Rocco
  private updateVan(dt: number) {
    const v = this.van, m = this.mode, t = this.modeT, target = this.layout.van.x;
    if (m === "intro") { const u = clamp(t / 3, 0, 1), e = 1 - (1 - u) * (1 - u) * (1 - u); this.vanX = lerp(target - 34, target, e); }
    else if (m === "clear" || m === "warp") { const u = Math.max(0, (m === "warp" ? 4 : 0) + t - 0.9); this.vanX = target + u * u * 2.2; }
    else this.vanX = target;
    v.root.position.set(this.vanX, VS, this.vanZ);
    v.pose.rotation.y = this.vanYaw;
    const moving = m === "intro" ? t < 3 : m === "clear" || m === "warp";
    for (const wh of v.extra) wh.rotation.x += moving ? dt * 12 : 0;
    v.pose.position.y = moving ? Math.sin(this.time * 18) * 0.02 : 0;
    if (v.parts.pipHead) v.parts.pipHead.rotation.y = Math.sin(this.time * 0.8) * 0.4;
  }
  private poseRocco(dt: number) {
    const r = this.rocco, p = this.player, m = this.mode, P = r.parts;
    const inVan = (m === "intro" && this.modeT < 3) || (m === "clear" && this.modeT > 0.7) || m === "warp";
    r.root.visible = !inVan && !(this.firstPerson && m === "play") && m !== "dead";
    if (m === "attract") { p.x = this.layout.spawn.x; p.z = this.layout.spawn.z + 1.5; }
    r.root.position.set(p.x, p.y, p.z);
    r.pose.rotation.y = m === "attract" ? Math.PI * 0.15 + Math.sin(this.time * 0.5) * 0.2 : m === "intro" ? 0 : this.camYaw;
    const moving = Math.min(1, p.speed / 4), sw = Math.sin(p.walk) * 0.7 * moving;
    P.legL.rotation.x = p.grounded ? sw : -0.4; P.legR.rotation.x = p.grounded ? -sw : 0.3;
    P.tail.rotation.y = Math.sin(this.time * 3) * 0.3; P.tail.rotation.x = -0.2 + Math.sin(this.time * 2) * 0.1;
    const swing = this.swing;
    if (m === "clear" && this.modeT < 0.7) { P.armL.rotation.set(Math.PI - 0.3, 0, 0.2); P.armR.rotation.set(Math.PI - 0.3, 0, -0.2); }
    else if (m === "attract") { P.armR.rotation.set(-0.3 + Math.sin(this.time * 2) * 0.1, 0, 0); P.armL.rotation.set(Math.sin(this.time * 1.3) * 0.15, 0, 0.1); P.head.rotation.y = Math.sin(this.time * 0.6) * 0.3; }
    else { P.armR.rotation.set(-1.2 - p.pitch * 0.5 + swing * 1.6 - (this.tool === "hammer" ? 0.4 : 0), 0, 0); P.armL.rotation.set(sw * 0.8, 0, 0.05); P.head.rotation.x = -p.pitch * 0.5; }
    void dt;
  }

  // ---------------------------------------------------------------- camera
  private updateCamera(dt: number) {
    const p = this.player, m = this.mode, t = this.modeT, cam = this.camera, w = this.world;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.bossCam = Math.max(0, this.bossCam - dt);
    const want = this.v2, look = this.v3;
    const portrait = this.H > this.W;
    const bc = this.layout.box, bx = (w.wx(bc.i0) + w.wx(bc.i1)) / 2, bz = (w.wz(bc.k0) + w.wz(bc.k1)) / 2, by = bc.j1 * VS * 0.45;
    this.fwd.set(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch));
    let fpv = false;
    if (m === "attract") {
      // the home screen: a slow orbit of the lot, the building and the van, the district behind
      const a = -Math.PI / 2 + Math.sin(this.time * 0.09) * 0.75, r = portrait ? 40 : 34;
      want.set(bx + Math.cos(a) * r, by + (portrait ? 16 : 12), bz + Math.sin(a) * r);
      look.set(bx, by + (portrait ? 1 : 2), bz - 2);
      this.cam.lerp(want, Math.min(1, dt * 1.5)); this.camLook.lerp(look, Math.min(1, dt * 2));
    } else if (m === "intro") {
      // the van pulls up: a sweep from high over the lot down beside the van, then into Rocco's eyes
      const u = clamp(t / 3, 0, 1), e = u * u * (3 - 2 * u);
      if (t < 3) {
        want.set(lerp(bx + 26, this.vanX + 6, e), lerp(by + 22, 3.2, e), lerp(bz - 6, this.vanZ - 8, e));
        look.set(lerp(bx, this.vanX, e), lerp(by, 1.4, e), lerp(bz, this.vanZ, e));
        this.cam.copy(want); this.camLook.copy(look);
      } else {
        const k = clamp((t - 3) / 1.3, 0, 1), ke = k * k * (3 - 2 * k);
        want.set(p.x, p.y + this.eyeY, p.z);
        look.copy(want).addScaledVector(this.fwd, 10);
        this.cam.lerp(want, ke); this.camLook.lerp(look, ke);
      }
    } else if (m === "clear" || m === "warp") {
      // the getaway: the van drives off down the street, the camera rides beside it, then rises
      const k = m === "warp" ? 1 : clamp(t / 4, 0, 1);
      want.set(this.vanX - 7 + k * 3, 2.6 + (m === "warp" ? t * 30 : k * 4), this.vanZ - 7);
      look.set(this.vanX + 2, 1.4, this.vanZ);
      this.cam.lerp(want, Math.min(1, dt * 3)); this.camLook.lerp(look, Math.min(1, dt * 4));
    } else if (m === "dead") {
      const a = t * 0.6;
      want.set(p.x + Math.sin(a) * 6, p.y + 4 + t * 2, p.z + Math.cos(a) * 6);
      look.set(p.x, p.y + 0.5, p.z);
      this.cam.lerp(want, Math.min(1, dt * 2)); this.camLook.lerp(look, Math.min(1, dt * 4));
    } else if (this.bossCam > 0 && this.boss) {
      const b = this.boss;
      want.set(b.x + Math.sin(b.yaw) * 7 + 2.5, b.y + 3, b.z + Math.cos(b.yaw) * 7);
      look.set(b.x, b.y + b.h * 0.6, b.z);
      this.cam.lerp(want, Math.min(1, dt * 5)); this.camLook.lerp(look, Math.min(1, dt * 6));
    } else if (this.firstPerson) {
      fpv = true;
      this.eyeY += ((1.55 + (p.grounded ? Math.abs(Math.sin(p.walk)) * 0.035 * Math.min(1, p.speed / 4) : 0)) - this.eyeY) * Math.min(1, dt * 14);
      this.cam.set(p.x, p.y + this.eyeY, p.z);
      this.camLook.copy(this.cam).add(this.fwd);
    } else {
      // over the shoulder; pulled in so a wall never gets between
      const pivot = this.v1.set(p.x, p.y + 1.6, p.z);
      const right = this.rightV.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
      want.copy(pivot).addScaledVector(right, portrait ? 0.5 : 0.8).addScaledVector(this.fwd, -3.4); want.y += 0.4;
      const dx = want.x - pivot.x, dy = want.y - pivot.y, dz = want.z - pivot.z, dl = Math.hypot(dx, dy, dz);
      if (w.raycast(pivot.x, pivot.y, pivot.z, dx / dl, dy / dl, dz / dl, dl, this.camHit, true)) { const k = Math.max(0.15, (this.camHit.t - 0.3) / dl); want.set(pivot.x + dx * k, pivot.y + dy * k, pivot.z + dz * k); }
      this.cam.lerp(want, Math.min(1, dt * 16));
      this.camLook.copy(this.cam).addScaledVector(this.fwd, 10);
    }
    cam.position.copy(this.cam);
    if (this.shake > 0 && !this.reduced) cam.position.add(this.v1.set((Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3));
    cam.lookAt(this.camLook);
    this.viewTool.visible = fpv && p.alive;
    if (fpv) {
      // the tool in your hands: bob, swing, kick
      const bob = Math.sin(p.walk) * 0.015 * Math.min(1, p.speed / 4), s = this.swing;
      const portraitX = portrait ? 0.2 : 0.3;
      this.viewTool.position.set(portraitX + bob, -0.34 + Math.abs(bob) - s * 0.06 + (this.tool === "hammer" ? -0.06 : 0), -0.62 + s * (this.tool === "hammer" ? -0.1 : 0.05));
      if (this.tool === "hammer") this.viewTool.rotation.set(-0.5 - s * 1.4 + Math.sin(s * Math.PI) * 0.4, 0.2, 0.3 - s * 0.3);
      else if (this.tool === "drill") { this.viewTool.rotation.set(0, Math.PI, 0); if (this.using) { this.viewTool.position.x += (Math.random() - 0.5) * 0.006; this.viewBit.rotation.z += dt * 40; } }
      else this.viewTool.rotation.set(s * 0.25, Math.PI, 0);
    }
    this.sunL.position.copy(this.look.sunDir).multiplyScalar(70).add(this.v1.set(p.x, 0, p.z));
    this.sunL.target.position.set(p.x, 0, p.z);
  }

  // ---------------------------------------------------------------- drawing
  private render(dt: number) {
    if (this.backdrop) { this.backdrop.clouds.rotation.y += dt * 0.004; this.backdrop.weather?.update(dt, this.time, this.camera.position.x, this.camera.position.y, this.camera.position.z); }
    this.fx.begin();
    for (const b of this.bolts) if (b.kind === BOLT || b.kind === CANNON) this.fx.bar(b.x, b.y, b.z, b.vx, b.vy, b.vz, b.kind === CANNON ? 0.8 : 0.6, b.kind === CANNON ? 0.16 : 0.08, b.hex, 1.6);
    const p = this.player;
    if ((p.shield > 0 || this.power.shield > 0) && this.mode === "play" && !this.firstPerson) for (let k = 0; k < 6; k++) { const a2 = this.time * 2 + k * 1.05; this.fx.cube(p.x + Math.cos(a2) * 0.9, p.y + 0.4 + (k % 3) * 0.5, p.z + Math.sin(a2) * 0.9, 0.12, 0x5ab8ff, 1.2); }
    // sparkles over the loot so you can spot it
    for (let i = 0; i < this.pickups.length; i += 1) { const pk = this.pickups[i]; if ((Math.floor(this.time * 4) + i) % 9 === 0 && pk.kind !== "coin") this.fx.cube(pk.x + Math.sin(this.time * 3 + i) * 0.2, pk.y + 0.3, pk.z, 0.05, 0xfff0a0, 1.5); }
    this.fx.end();
    this.p0 = p.shield; p.shield = Math.max(0, p.shield - dt);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay();
    this.audio?.update(dt, this.mode === "play");
  }
  private p0 = 0;
  private nearLoot: Pickup[] = [];
  private toScreen(x: number, y: number, z: number) { this.proj.set(x, y, z).project(this.camera); return this.proj.z < 1 ? this.proj : null; }
  private drawOverlay() {
    const c = this.oc, W = this.W, H = this.H, r = this.opr;
    c.setTransform(r, 0, 0, r, 0, 0);
    c.clearRect(0, 0, W, H);
    const play = this.mode === "play";
    c.font = "900 15px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const n of this.nums) {
      const s = this.toScreen(n.x, n.y, n.z); if (!s) continue;
      const sx = (s.x * 0.5 + 0.5) * W, sy = (-s.y * 0.5 + 0.5) * H;
      c.globalAlpha = Math.min(1, n.life * 2.5); c.lineWidth = 3; c.strokeStyle = "#14102a"; c.strokeText(String(n.v), sx, sy); c.fillStyle = n.col; c.fillText(String(n.v), sx, sy);
    }
    c.globalAlpha = 1;
    for (const b of this.bots) {
      if (!b.alive || b.kind === "warden" || (b.hp >= b.maxHp && !b.elite)) continue;
      const s = this.toScreen(b.x, b.y + b.h + 0.35, b.z); if (!s) continue;
      const d = this.distCam(b.x, b.z); if (d > 40) continue;
      const sx = (s.x * 0.5 + 0.5) * W, sy = (-s.y * 0.5 + 0.5) * H, ww = clamp(56 - d, 20, 44);
      c.fillStyle = "rgba(10,10,20,0.7)"; c.fillRect(sx - ww / 2 - 1, sy - 1, ww + 2, 6);
      c.fillStyle = b.elite ? "#FFD23F" : "#FF4A4A"; c.fillRect(sx - ww / 2, sy, ww * Math.max(0, b.hp / b.maxHp), 4);
    }
    if (!play) return;
    // x-ray: every bit of loot, through the walls
    if (this.power.xray > 0) for (const pk of this.pickups) { if (pk.kind === "coin" || pk.kind === "heart" || pk.kind === "oil") continue; const s = this.toScreen(pk.x, pk.y, pk.z); if (!s) continue; const sx = (s.x * 0.5 + 0.5) * W, sy = (-s.y * 0.5 + 0.5) * H; c.strokeStyle = "#C87CFF"; c.lineWidth = 2; c.strokeRect(sx - 6, sy - 6, 12, 12); }
    // the objective: the vault, the van, the boss
    const g = this.goal;
    if (g && !this.goalDone) {
      if (g.kind === "escape") this.marker(this.vanX, 3, this.vanZ, "#5BF0FF", "VAN");
      if (g.kind === "vault") for (const v of this.layout.vaults) this.marker(v.x, v.y + 2.5, v.z + 1.8, "#FFD23F", "VAULT");
      if ((g.kind === "breach") && !this.alarm) this.marker(0, 3, this.world.wz(this.layout.box.k0), "#FFD23F", "BREAK IN");
      if (g.kind === "loot") {
        // the three nearest bits of loot
        const p = this.player, near = this.nearLoot;
        near.length = 0;
        for (const pk of this.pickups) { if (pk.kind === "coin" || pk.kind === "heart" || pk.kind === "oil" || pk.kind === "power" || pk.kind === "ammo") continue; near.push(pk); }
        near.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y, a.z - p.z) - Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z));
        for (let k = 0; k < Math.min(3, near.length); k++) this.marker(near[k].x, near[k].y + 0.6, near[k].z, "#5CE07A", "$");
      }
    }
    // the crosshair: a ring for the hammer and drill (filled when you can break the block), ticks for the guns
    const cx = W / 2, cy = H / 2, tool = this.tool;
    const can = this.aimOk && canBreak(this.aimHit.m, this.spec(tool).power + (this.power.mega > 0 && tool === "hammer" ? 1 : 0));
    const col = this.aimBot ? "#FF4A5A" : "#FFFFFF";
    c.lineWidth = 2.5; c.strokeStyle = "rgba(0,0,0,0.45)";
    if (tool === "hammer" || tool === "drill" || tool === "paint") {
      c.beginPath(); c.arc(cx + 1, cy + 1, 9, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = this.aimOk ? (can ? "#5CF08A" : "#FF8A3A") : col; c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.stroke();
      c.fillStyle = c.strokeStyle; c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    } else {
      const sp = 8 + this.swing * 6;
      c.fillStyle = "rgba(0,0,0,0.45)";
      for (const [dx, dy, ww, hh] of [[-sp - 7, -1.5, 7, 3], [sp, -1.5, 7, 3], [-1.5, -sp - 7, 3, 7], [-1.5, sp, 3, 7]]) c.fillRect(cx + dx + 1, cy + dy + 1, ww, hh);
      c.fillStyle = col;
      for (const [dx, dy, ww, hh] of [[-sp - 7, -1.5, 7, 3], [sp, -1.5, 7, 3], [-1.5, -sp - 7, 3, 7], [-1.5, sp, 3, 7]]) c.fillRect(cx + dx, cy + dy, ww, hh);
    }
    if (this.hitMark > 0) { c.strokeStyle = "#FFFFFF"; c.lineWidth = 3; const q = 8; c.beginPath(); c.moveTo(cx - q - 5, cy - q - 5); c.lineTo(cx - q, cy - q); c.moveTo(cx + q + 5, cy - q - 5); c.lineTo(cx + q, cy - q); c.moveTo(cx - q - 5, cy + q + 5); c.lineTo(cx - q, cy + q); c.moveTo(cx + q + 5, cy + q + 5); c.lineTo(cx + q, cy + q); c.stroke(); }
    if (this.hitFrom) {
      this.hitFrom.t -= 1 / 60;
      const p = this.player, ang = Math.atan2(this.hitFrom.x - p.x, this.hitFrom.z - p.z), rel = angDiff(this.camYaw, ang);
      const a2 = -rel - Math.PI / 2, R = Math.min(W, H) * 0.32;
      c.strokeStyle = `rgba(255,60,70,${0.7 * Math.max(0, this.hitFrom.t)})`; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, R, a2 - 0.35, a2 + 0.35); c.stroke();
      if (this.hitFrom.t <= 0) this.hitFrom = null;
    }
    // the radar
    const portrait = H > W, rr = portrait ? 42 : 50, rx = W - rr - 14, ry = (portrait ? 118 : 76) + rr;
    c.fillStyle = "rgba(10,12,28,0.72)"; c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 1.5; c.stroke();
    const sc = rr / 26, p = this.player, sy2 = Math.sin(this.camYaw), cyw = Math.cos(this.camYaw);
    const dotAt = (x: number, z: number, col2: string, s: number) => {
      const dx = x - p.x, dz = z - p.z;
      let ux = -(dx * cyw - dz * sy2) * sc, uy = -(dx * sy2 + dz * cyw) * sc;
      const dl = Math.hypot(ux, uy);
      if (dl > rr - 4) { ux *= (rr - 4) / dl; uy *= (rr - 4) / dl; }
      c.fillStyle = col2; c.fillRect(rx + ux - s / 2, ry + uy - s / 2, s, s);
    };
    for (const pk of this.pickups) if (pk.kind !== "coin") dotAt(pk.x, pk.z, pk.kind === "heart" ? "#FF5A8A" : pk.kind === "oil" ? "#FF8A3A" : "#FFD23F", 3);
    dotAt(this.vanX, this.vanZ, "#5BF0FF", 7);
    for (const b of this.bots) if (b.alive && (b.kind !== "turret" || this.alarm)) dotAt(b.x, b.z, b.kind === "warden" ? "#FF2A6A" : "#FF4A4A", b.kind === "warden" ? 9 : 5);
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.moveTo(rx, ry - 6); c.lineTo(rx + 4.5, ry + 4); c.lineTo(rx - 4.5, ry + 4); c.closePath(); c.fill();
  }
  /** an objective marker: a diamond over the thing, or an arrow at the screen's edge */
  private marker(x: number, y: number, z: number, col: string, label: string) {
    const c = this.oc, W = this.W, H = this.H;
    this.proj.set(x, y, z).project(this.camera);
    let sx = (this.proj.x * 0.5 + 0.5) * W, sy = (-this.proj.y * 0.5 + 0.5) * H;
    const behind = this.proj.z > 1, m = 34;
    if (behind) { sx = W - sx; sy = H - sy; }
    if (behind || sx < m || sx > W - m || sy < m + 40 || sy > H - m) {
      const dx = sx - W / 2, dy = sy - H / 2, s = Math.min((W / 2 - m) / Math.max(1, Math.abs(dx)), (H / 2 - m - 20) / Math.max(1, Math.abs(dy)));
      sx = W / 2 + dx * s; sy = H / 2 + dy * s;
      c.save(); c.translate(sx, sy); c.rotate(Math.atan2(dy, dx));
      c.fillStyle = "rgba(10,10,20,0.6)"; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-8, 10); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill();
      c.restore();
      return;
    }
    c.save(); c.translate(sx, sy); c.rotate(Math.PI / 4);
    c.fillStyle = "rgba(10,10,20,0.65)"; c.fillRect(-9, -9, 18, 18); c.strokeStyle = col; c.lineWidth = 2.5; c.strokeRect(-7, -7, 14, 14);
    c.restore();
    c.font = "900 10px system-ui, sans-serif"; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "#14102a"; c.strokeText(label, sx, sy - 16); c.fillStyle = col; c.fillText(label, sx, sy - 16);
  }
  private nearCam(x: number, z: number, d: number) { return this.distCam(x, z) < d; }
  private distCam(x: number, z: number) { return Math.hypot(x - this.camera.position.x, z - this.camera.position.z); }
  private pan(x: number, z: number) { const dx = x - this.camera.position.x, dz = z - this.camera.position.z; return clamp(-(dx * Math.cos(this.camYaw) - dz * Math.sin(this.camYaw)) / 12, -0.9, 0.9); }

  // ---------------------------------------------------------------- input
  setMove(x: number, y: number) { this.move.x = x; this.move.y = y; }
  turn(dx: number, dy: number) {
    if (this.mode !== "play") return;
    const s = isPhone() ? 0.0062 : 0.0042;
    this.camYaw -= dx * s; this.camPitch = clamp(this.camPitch - dy * s, -1.3, 1.25);
  }
  setUse(on: boolean) {
    this.using = on && this.mode === "play";
    if (on && this.tool === "paint" && this.useT <= 0) this.useT = 0;
  }
  setJump(on: boolean) { this.jumpKey = on; }
  toggleView() { this.firstPerson = !this.firstPerson; return this.firstPerson; }
  private key(e: KeyboardEvent) {
    const down = e.type === "keydown", code = e.code;
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
    if (!down || e.repeat) return;
    const n = Number(code.replace("Digit", ""));
    if (code.startsWith("Digit") && n >= 1 && n <= 7) { const id = TOOLS[n - 1].id; if (this.opts.owned.includes(id)) this.setTool(id); }
    if (code === "KeyQ") this.cycleTool(-1);
    if (code === "KeyE") this.cycleTool(1);
    if (code === "KeyC") this.cyclePaint();
    if (code === "KeyV") { const f = this.toggleView(); this.opts.onEvent({ k: "view", first: f }); }
  }
  private mouse(e: MouseEvent) {
    if (e.type === "mousemove") { if (document.pointerLockElement === this.renderer.domElement) this.turn(e.movementX, e.movementY); return; }
    if (e.type === "mousedown") {
      if (this.mode !== "play") return;
      if (document.pointerLockElement !== this.renderer.domElement) { this.renderer.domElement.requestPointerLock?.(); return; }
      if (e.button === 0) this.setUse(true);
      if (e.button === 2) this.cycleTool(1);
    } else if (e.type === "mouseup" && e.button === 0) this.setUse(false);
  }

  dispose() {
    this.stop();
    const w = window as unknown as { __crumble?: Game };
    if (w.__crumble === this) delete w.__crumble;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("mousemove", this.onMouse); window.removeEventListener("mouseup", this.onMouse);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouse);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock?.();
    this.clearSite();
    this.fx.dispose(); this.gov.dispose();
    this.audio?.silence();
    this.outline.geometry.dispose(); (this.outline.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove(); this.overlay.remove();
  }

  // ---------------------------------------------------------------- HUD
  private pushHud() {
    const p = this.player, g = this.goal;
    let obj: Hud["obj"] = null;
    if (g) {
      let line = "", prog = 0;
      const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      switch (g.kind) {
        case "breach": line = this.alarm ? "You're in!" : "Smash a way into the building"; prog = this.alarm ? 1 : 0; break;
        case "loot": { const need = Math.round(g.share * this.lootTotal); line = `$${Math.min(this.siteLoot, need).toLocaleString()} / $${need.toLocaleString()}`; prog = this.siteLoot / need; break; }
        case "vault": line = this.layout.vaults.length ? `Vault wall ${Math.min(100, this.vaultBroken * 10)}%` : "No vault here"; prog = this.vaultBroken / 10; break;
        case "hold": line = `Hold on · ${fmt(Math.max(0, g.secs - this.goalT))}`; prog = this.goalT / g.secs; break;
        case "wreck": { const need = Math.round(g.share * this.layout.blocks); line = `${Math.min(this.blocksBroken, need).toLocaleString()} / ${need.toLocaleString()} blocks`; prog = this.blocksBroken / need; break; }
        case "boss": line = this.boss ? "Take down the Vault Warden" : "Warden down!"; prog = this.boss ? 1 - this.boss.hp / this.boss.maxHp : 1; break;
        case "escape": line = `To the van · ${fmt(Math.max(0, g.secs - this.goalT))}`; prog = this.goalT / g.secs; break;
      }
      if (this.goalDone) line = "Goal complete!";
      obj = { kind: g.kind, title: g.title, line, prog: clamp(prog, 0, 1), done: this.goalDone };
    }
    const h: Hud = {
      heist: this.heist, codename: this.plan.codename, site: this.siteI + 1, sites: this.plan.sites.length, siteName: this.site.name, goalNo: this.goalNo, goals: goalsIn(this.plan), obj,
      hp: Math.max(0, p.hp), maxHp: p.maxHp, lives: this.lives, oil: this.oil / this.oilMax, coins: this.coins, loot: this.siteLoot, lootGoal: this.lootTotal,
      tool: this.tool, tools: TOOLS.filter((t) => this.opts.owned.includes(t.id)).map((t) => ({ id: t.id, ammo: t.ammo ? this.ammoOf(t.id) : -1 })),
      powers: POWERS.filter((k) => this.power[k] > 0).map((id) => ({ id, left: this.power[id], secs: POWER_SECS[id] })),
      alarm: this.alarm, mode: this.mode, boss: this.boss ? { name: "Vault Warden", hp: this.boss.hp / this.boss.maxHp } : null, firstPerson: this.firstPerson, remix: this.plan.remix > 0, accent: this.district.accent,
    };
    this.opts.onHud(h);
  }
}

const BLOCK_HEX: Record<number, number> = { 3: 0xc89060, 4: 0xb8e8ff, 7: 0x9a9aa0, 9: 0xd8d0c0, 10: 0x8a2a3a, 11: 0x8a92a6, 12: 0x5a6070, 13: 0xf2b830, 15: 0x6a4426, 16: 0xf2f2ea, 17: 0xeeeae4, 18: 0xff4fd8, 19: 0xe8e0d0, 20: 0xa8703e, 21: 0x3a4a5a, 22: 0x8a5a36, 23: 0x6a7080, 24: 0xf4f4f4 };
const mixHex = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return `#${[0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, "0")).join("")}`; };
void makeRng; void DEBRIS;
