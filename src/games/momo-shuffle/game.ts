/* eslint-disable @typescript-eslint/no-explicit-any */
// Momo Shuffle — real-time version of the Track Momo videos.
// Same clay rigs, stage, choreography and sounds; endless levels; 3 / 4 / 6 cups.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { setFont, setClayQuality, clearClayCache, rng, clay, mesh, sphere, lumpy } from "./engine/clay.js";
import { PAL } from "./engine/characters.js";
import { MomoRig, KrankyRig, TikiRig, TileRig, Confetti, boil, MOMO_ARMS, waveArms } from "./engine/rig.js";
import { makeStage, addLights } from "./engine/sets.js";
import { CupTrack, E, arc, lerp, seg, landSquash, type Layout, type Move } from "./track";
import { audio, type SfxName, type MusicName } from "@/lib/audio";
import { cdn } from "@/lib/cdn";
import type { Difficulty, Settings } from "@/lib/store";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const blinkAt = (t: number, times: number[]) => {
  for (const b of times) { const u = (t - b) / 0.14; if (u >= 0 && u <= 1) return Math.sin(Math.PI * u); }
  return 0;
};

// ---------------------------------------------------------------- difficulty curves
export const DIFF: Record<Difficulty, { cups: number; label: string; color: string; coins: number; music: MusicName }> = {
  easy: { cups: 3, label: "EASY", color: "#2FA866", coins: 10, music: "shuffle_easy" },
  medium: { cups: 4, label: "MEDIUM", color: "#D99A1E", coins: 20, music: "shuffle_medium" },
  hard: { cups: 6, label: "HARD", color: "#E8504F", coins: 40, music: "shuffle_hard" },
};

export type Twist = "warmup" | "zigzag" | "fakeout" | "spin" | "blackout";
export const TWIST_LABEL: Record<Twist, string> = {
  warmup: "Warm-Up", zigzag: "Zigzag", fakeout: "Fake-Out", spin: "Triple Spin", blackout: "Lights Off",
};

// Speed + swap count per level. Medium/Hard start at a calm speed, then every level is a little
// faster with a few more swaps, all the way to a very fast cap (no sudden jumps):
//   Medium: L1 6 swaps @0.66s (×1.2) → L5 8 @0.58s → L10 11 @0.48s → L20 17 @0.28s → cap 0.26s
//   Hard:   L1 8 swaps @0.55s (×1.4) → L5 11 @0.48s → L10 14 @0.39s → L20 22 @0.21s → cap 0.20s
function curve(d: Difficulty, level: number, assist: boolean) {
  const L = level - 1;
  let count: number, dur: number, gap: number, mix: number, tease: number;
  if (d === "easy") {
    count = Math.min(16, 4 + Math.floor(L * 0.5)); dur = Math.max(0.38, 0.8 - L * 0.02); gap = 0.18;
    mix = L >= 8 ? 0.08 : 0; tease = 0;
  } else if (d === "medium") {
    count = Math.min(28, 6 + Math.floor(L * 0.6)); dur = Math.max(0.26, 0.66 - L * 0.02); gap = Math.max(0.1, 0.18 - L * 0.005);
    mix = L >= 4 ? Math.min(0.14, 0.06 + L * 0.006) : 0; tease = L >= 8 ? 0.05 : 0;
  } else {
    count = Math.min(34, 8 + Math.floor(L * 0.75)); dur = Math.max(0.2, 0.55 - L * 0.018); gap = Math.max(0.06, 0.16 - L * 0.006);
    mix = L >= 2 ? Math.min(0.16, 0.08 + L * 0.006) : 0; tease = L >= 6 ? 0.07 : 0;
  }
  if (assist) { dur *= 1.35; count = Math.max(3, count - 2); gap = 0.18; mix *= 0.5; tease = 0; }
  return { count, dur, gap, mix, tease };
}

function pickTwist(d: Difficulty, level: number, R: () => number): Twist {
  const at = (easy: number, medium: number, hard: number) => level >= (d === "easy" ? easy : d === "medium" ? medium : hard);
  if (!at(3, 2, 2)) return "warmup";
  const unlocked: Twist[] = ["zigzag"];
  if (at(5, 3, 2)) unlocked.push("fakeout");
  if (at(7, 5, 3)) unlocked.push("spin");
  if (at(12, 7, 5)) unlocked.push("blackout");
  if (R() < (d === "easy" ? 0.25 : d === "medium" ? 0.2 : 0.12)) return "warmup";
  return unlocked[Math.floor(R() * unlocked.length)];
}

/** chance a swap involves Momo's own cup: grows with level so later rounds are harder to follow */
function momoBiasFor(d: Difficulty, level: number) {
  if (d === "easy") return 0.3;
  const L = level - 1;
  return d === "medium" ? Math.min(0.6, 0.45 + L * 0.01) : Math.min(0.7, 0.5 + L * 0.012);
}

// ---------------------------------------------------------------- public types
export type Phase = "loading" | "lobby" | "intro" | "hide" | "shuffle" | "pick" | "reveal" | "result";
export interface HudState {
  phase: Phase;
  difficulty: Difficulty;
  level: number;
  streak: number;
  twist: Twist;
  bonus: boolean;
  speed: number;
  swaps: number;
  cups: number;
  blackout: boolean;
  focus: number;
  result: null | { correct: boolean; coins: number; answer: number; picked: number; newBest: boolean };
  waitingNext: boolean;
  nextAt: number;
  layout: Layout;
}
export interface RoundResult { correct: boolean; coins: number; level: number; streak: number; twist: Twist; difficulty: Difficulty }
export interface GameCallbacks {
  onProgress?: (p: number, label: string) => void;
  onHud?: (s: HudState) => void;
  onRound?: (r: RoundResult) => void;
  onFps?: (fps: number) => void;
  onFrame?: (cups: CupScreen[]) => void;
}
export interface CupScreen { x: number; y: number; r: number; top: number; visible: boolean }

interface Cue { t: number; s: SfxName; g?: number; p?: number; rate?: number }
interface MusicCue { t: number; m: MusicName }

interface Round {
  level: number;
  twist: Twist;
  bonus: boolean;
  intro: boolean;
  momoCup: number;
  moves: Move[];
  speed: number;
  T: { h: number; s0: number; s1: number; f0: number };
  blackouts: number[];
  cues: Cue[];
  music: MusicCue[];
  hover: number[];
  pick: null | { slot: number; cup: number; t: number; correct: boolean; answerSlot: number; end: number; coins: number; shown: boolean; newBest: boolean };
  outro: number;
}

// ---------------------------------------------------------------- the game
export class MomoShuffleGame {
  readonly canvas: HTMLCanvasElement;
  private cb: GameCallbacks;
  private settings: Settings;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private env?: THREE.Texture;
  private keyLight?: THREE.DirectionalLight;
  private lights: { l: THREE.Light; i: number }[] = [];
  private stage?: THREE.Object3D;
  private momo: any;
  private kranky: any;
  private tiki: any;
  private cups: { root: THREE.Group; hit: THREE.Mesh }[] = [];
  private tiles: any[] = [];
  private confetti: any;
  private ring!: THREE.Mesh;
  private track!: CupTrack;
  private layout: Layout = "row";
  private diff: Difficulty = "easy";
  private cupColor = PAL.cup;
  private kpos = V(0, 0, -2.9);
  private rest: THREE.Vector3[] = [];
  private front = V(0.9, 0, 4.0);
  private round: Round | null = null;
  private t = 0;
  private lastCueT = -1;
  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private destroyed = false;
  private streak = 0;
  private bestStreak = 0;
  private level = 1;
  private hud: HudState;
  private hoverSlot = -1;
  private focusSlot = -1;
  private needsRender = true;
  private quality: "low" | "medium" | "high" = "high";
  private dpr = 1;
  private frameTimes: number[] = [];
  private fpsAcc = { n: 0, t: 0 };
  private lastFrameIdx = -1;
  private ro?: ResizeObserver;
  private size = { w: 1, h: 1 };
  private waitTimer = 0;
  private roundSeed = Math.floor(Math.random() * 1e9);
  private ray = new THREE.Raycaster();

  constructor(canvas: HTMLCanvasElement, settings: Settings, cb: GameCallbacks = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.cb = cb;
    this.hud = {
      phase: "loading", difficulty: "easy", level: 1, streak: 0, twist: "warmup", bonus: false, speed: 1, swaps: 0, cups: 3,
      blackout: false, focus: -1, result: null, waitingNext: false, nextAt: 0, layout: "row",
    };
  }

  // ------------------------------------------------------------ setup
  async init(opts: { difficulty: Difficulty; level: number; bestStreak: number; cupColor: string }) {
    this.diff = opts.difficulty; this.level = opts.level; this.bestStreak = opts.bestStreak; this.cupColor = opts.cupColor;
    const progress = (p: number, l: string) => this.cb.onProgress?.(p, l);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    progress(0.05, "Warming up the clay…");
    this.quality = this.resolveQuality();
    setClayQuality(this.quality);
    // perf-ok: its own resolution governor, and it honours the frame-rate setting
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance", stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.applyShadowSettings();
    this.measure();
    this.scene.background = new THREE.Color("#2a2030");
    this.env = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    this.scene.environment = this.env;
    const font = await new FontLoader().loadAsync(cdn("/fonts/helvetiker_bold.typeface.json"));
    if (this.destroyed) return;
    setFont(font);
    progress(0.2, "Building the stage…");
    await tick();
    if (this.destroyed) return;
    this.stage = mergeStatic(makeStage({ board: null }));
    this.scene.add(this.stage);
    this.keyLight = addLights(this.scene, { mapSize: this.shadowMapSize() });
    this.scene.traverse((o) => { if ((o as THREE.Light).isLight) this.lights.push({ l: o as THREE.Light, i: (o as THREE.Light).intensity }); });
    progress(0.45, "Waking up Momo…");
    await tick();
    if (this.destroyed) return;
    this.momo = new MomoRig(); this.scene.add(this.momo.root);
    progress(0.55, "Kranky is stretching his claws…");
    await tick();
    if (this.destroyed) return;
    this.kranky = new KrankyRig({ scale: 1 }); this.scene.add(this.kranky.root);
    this.tiki = new TikiRig(DIFF[this.diff].label, { signSide: 1, scale: 0.95 }); this.scene.add(this.tiki.root);
    this.confetti = new Confetti(100, 9); this.scene.add(this.confetti.root);
    const ringGeo = new THREE.TorusGeometry(1.45, 0.09, 12, 64); ringGeo.rotateX(Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: "#FFD25A", transparent: true, opacity: 0.95 }));
    this.ring.visible = false; this.scene.add(this.ring);
    progress(0.7, "Shaping the cups…");
    await tick();
    if (this.destroyed) return;
    this.setupCups();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement ?? this.canvas);
    progress(0.82, "Mixing paint…");
    this.poseLobby(0);
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { this.renderer.compile(this.scene, this.camera); }
    if (this.destroyed) return;
    progress(0.92, "Loading sounds…");
    await audio.preload(
      ["pop", "popBig", "boing", "hop", "squish", "thud", "lift", "whoosh", "whooshShort", "whooshLong", "swoosh", "slide", "clack",
        "tick", "tock", "drumroll", "impact", "tada", "sparkle", "confetti", "sadtrombone", "snicker", "sting", "gibberK", "gibberKShort",
        "gibberT", "hmm", "lightsOff", "lightsOn"],
      ["playful"],
    );
    if (this.destroyed) return;
    progress(1, "Ready!");
    this.setHud({ phase: "lobby", difficulty: this.diff, level: this.level, cups: DIFF[this.diff].cups });
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private resolveQuality(): "low" | "medium" | "high" {
    const q = this.settings.quality;
    if (q !== "auto") return q;
    const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
    if (mobile) return cores >= 8 ? "medium" : "low";
    return "high";
  }
  private shadowMapSize() { return !this.settings.shadows || this.quality === "low" ? 0 : this.quality === "medium" ? 1024 : 2048; }
  private applyShadowSettings() {
    const on = this.shadowMapSize() > 0;
    this.renderer.shadowMap.enabled = on;
    this.renderer.shadowMap.type = this.quality === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }

  private layoutFor(n: number): Layout {
    return n >= 6 && this.size.w / this.size.h < 1.15 ? "grid" : "row";
  }

  private setupCups() {
    for (const c of this.cups) { this.scene.remove(c.root); }
    for (const t of this.tiles) this.scene.remove(t.root);
    const n = DIFF[this.diff].cups;
    this.layout = this.layoutFor(n);
    this.track = new CupTrack(n, this.layout);
    const hitGeo = new THREE.CylinderGeometry(1.3, 1.5, 3.2, 16); hitGeo.translate(0, 1.6, 0);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.cups = Array.from({ length: n }, (_, i) => {
      const root = makeCupColored(this.cupColor);
      const hit = new THREE.Mesh(hitGeo, hitMat); hit.userData.cup = i; root.add(hit);
      this.scene.add(root);
      return { root, hit };
    });
    this.tiles = Array.from({ length: n }, (_, i) => { const tl = new TileRig(String(i + 1)); this.scene.add(tl.root); return tl; });
    const maxZ = Math.max(...this.track.slots.map((s) => s.z)), minZ = Math.min(...this.track.slots.map((s) => s.z));
    const ks = n >= 6 ? 1.15 : n === 4 ? 1.08 : 1;
    this.kpos = V(0, 0, minZ - 2.9);
    this.kranky.root.scale.setScalar(ks); this.kranky.k = ks;
    this.rest = [this.kpos.clone().add(V(-2.3 * ks, 4.5 * ks, 1.0 * ks)), this.kpos.clone().add(V(2.3 * ks, 4.5 * ks, 1.0 * ks))];
    this.front = V(n === 4 ? 0 : 0.9, 0, maxZ + 4.0);
    this.tiki.setSign(DIFF[this.diff].label);
    this.fitCamera();
    this.needsRender = true;
    this.setHud({ layout: this.layout, cups: n });
  }

  setCupColor(color: string) {
    if (color === this.cupColor || !this.cups.length) return;
    this.cupColor = color;
    for (const c of this.cups) {
      const fresh = makeCupColored(color);
      c.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m !== c.hit) m.geometry.dispose(); });
      c.root.clear();
      for (const ch of [...fresh.children]) c.root.add(ch);
      c.root.add(c.hit);
    }
    this.needsRender = true;
  }

  // ------------------------------------------------------------ settings / lifecycle
  updateSettings(s: Settings) {
    const prev = this.settings;
    this.settings = s;
    if (!this.renderer) return;
    if (prev.quality !== s.quality || prev.shadows !== s.shadows) {
      const q = this.resolveQuality();
      if (q !== this.quality) this.rebuildMaterials(q);
      this.applyShadowSettings();
      if (this.keyLight) { this.keyLight.castShadow = this.shadowMapSize() > 0; const m = Math.max(256, this.shadowMapSize()); this.keyLight.shadow.mapSize.set(m, m); this.keyLight.shadow.map?.dispose(); this.keyLight.shadow.map = null as never; }
    }
    if (prev.renderScale !== s.renderScale || prev.quality !== s.quality) this.resize();
    this.needsRender = true;
  }

  private rebuildMaterials(q: "low" | "medium" | "high") {
    this.quality = q;
    setClayQuality(q);
    const fresh = new Map<string, THREE.Material>();
    // swap every clay material for its equivalent at the new quality
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
      const old = m.material as THREE.MeshStandardMaterial & { userData: { clayArgs?: [string, object] } };
      const args = old.userData?.clayArgs;
      if (!args) return;
      const key = JSON.stringify(args) + (old.side === THREE.DoubleSide ? "|ds" : "");
      let nm = fresh.get(key);
      if (!nm) { nm = clay(args[0], args[1]); if (old.side === THREE.DoubleSide) { nm = nm!.clone(); nm.side = THREE.DoubleSide; nm.userData.clayArgs = args; } fresh.set(key, nm!); }
      m.material = nm!;
    });
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    window.clearTimeout(this.waitTimer);
    void audio.suspend();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.last = performance.now();
    void audio.resume();
    if (this.hud.waitingNext && this.settings.autoContinue) this.scheduleNext();
  }
  get isPaused() { return this.paused; }

  destroy() {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.waitTimer);
    this.ro?.disconnect();
    audio.stopMusic(0.2);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    clearClayCache();
    this.env?.dispose();
    this.renderer?.dispose();
  }

  private measure() {
    const el = this.canvas.parentElement ?? this.canvas;
    this.size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
    return this.size;
  }

  private resize() {
    const { w, h } = this.measure();
    const cap = this.quality === "high" ? 2 : this.quality === "medium" ? 1.5 : 1.25;
    this.dpr = Math.min(window.devicePixelRatio || 1, cap) * this.settings.renderScale;
    this.renderer?.setPixelRatio(this.dpr);
    this.renderer?.setSize(w, h, false);
    this.fitCamera();
    this.needsRender = true;
  }

  private camBase = { pos: V(0, 3.9, 14.5), tgt: V(0, 2.7, 0), fov: 50 };
  private fitCamera() {
    if (!this.track) return;
    // framing matches the videos: Shorts (9:16) = fov 50 @ z 14.5, long video (16:9) = fov 34 @ z 18.5
    const aspect = this.size.w / this.size.h;
    const fov = aspect < 1 ? 50 : aspect < 1.25 ? 42 : 34;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const maxX = Math.max(...this.track.slots.map((s) => Math.abs(s.x)));
    const halfW = maxX + 1.45 * this.track.scale + (aspect > 1.2 ? 1.6 : 0.2);
    const grid = this.layout === "grid";
    const halfH = grid ? 4.4 : aspect < 1 ? 5.0 : 5.6;
    const d = Math.max(halfW / (tanH * aspect), halfH / tanH);
    const ty = grid ? 1.7 : aspect < 1 ? 2.7 : 3.3;
    const tilt = grid ? 0.62 : aspect < 1 ? 0.083 : 0.076;
    const zc = (Math.max(...this.track.slots.map((s) => s.z)) + Math.min(...this.track.slots.map((s) => s.z))) / 2;
    this.camBase = { pos: V(0, ty + d * tilt, zc + d * Math.cos(Math.atan(tilt))), tgt: V(0, ty, zc), fov };
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // keep Tiki on screen: furthest x still visible at Tiki's depth
    const tz = this.front.z + 0.3, dist = this.camBase.pos.z - tz;
    const want = this.front.x + 1.6 + (this.cups.length >= 6 && this.layout === "row" ? 2.5 : 0);
    this.tikiX = -Math.min(want, dist * tanH * aspect - 0.85);
  }
  private tikiX = -2.5;

  // ------------------------------------------------------------ HUD
  private setHud(p: Partial<HudState>) {
    this.hud = { ...this.hud, ...p };
    this.cb.onHud?.(this.hud);
  }
  getHud() { return this.hud; }

  // ------------------------------------------------------------ flow
  /** Start (or switch to) a difficulty from the lobby / pause menu. */
  start(difficulty: Difficulty, level: number, bestStreak: number) {
    window.clearTimeout(this.waitTimer);
    const changed = difficulty !== this.diff;
    this.diff = difficulty; this.level = level; this.bestStreak = bestStreak; this.streak = 0;
    if (changed || this.layoutFor(DIFF[difficulty].cups) !== this.layout) this.setupCups();
    this.setHud({ difficulty, level, streak: 0, cups: DIFF[difficulty].cups, result: null, waitingNext: false });
    this.newRound(true);
  }

  backToLobby() {
    window.clearTimeout(this.waitTimer);
    this.round = null;
    audio.playMusic("playful");
    this.setHud({ phase: "lobby", result: null, waitingNext: false, blackout: false });
  }

  private newRound(intro: boolean) {
    window.clearTimeout(this.waitTimer);
    const n = DIFF[this.diff].cups;
    if (this.layoutFor(n) !== this.layout) this.setupCups();
    this.track.reset();
    const R = rng(this.roundSeed++);
    const twist = pickTwist(this.diff, this.level, R);
    const bonus = this.level % 5 === 0;
    const c = curve(this.diff, this.level, this.settings.speedAssist);
    const count = c.count + (bonus ? 3 : 0);
    const momoCup = Math.floor(R() * n);
    const h = intro ? 1.7 : 0.55;
    const T = { h, s0: h + 3.0, s1: 0, f0: 0 };
    const k = momoCup;
    this.track.lift(k, h + 0.4, h + 0.8, h + 2.0, h + 2.25, 2.5 * this.track.scale, 0.1);
    const sh = this.track.addShuffle(R, {
      count, dur: c.dur, gap: c.dur * c.gap,
      cycleP: twist === "spin" ? 0.45 : c.mix,
      teaseP: twist === "fakeout" ? 0.22 : c.tease,
      farBias: twist === "zigzag" ? 0.6 : this.diff === "hard" && this.level >= 4 ? 0.15 : 0,
      momoCup: k, momoBias: momoBiasFor(this.diff, this.level),
    }, T.s0);
    T.s1 = sh.t1; T.f0 = T.s1 + 0.45;
    const nm = sh.moves.length;
    const blackouts = twist === "blackout" ? [Math.floor(nm / 3), Math.floor((2 * nm) / 3)].map((i) => sh.moves[Math.min(nm - 1, i)].t0) : [];
    const speed = Math.round((0.78 / c.dur) * 10) / 10;
    const hover = Array.from({ length: 4 }, (_, i) => (this.level + i * 2 + Math.floor(R() * n)) % n);
    const round: Round = {
      level: this.level, twist, bonus, intro, momoCup, moves: sh.moves, speed, T, blackouts, hover,
      cues: [], music: [], pick: null, outro: Infinity,
    };
    round.cues = this.buildCues(round);
    round.music = [{ t: 0, m: "playful" }, { t: T.s0 - 0.1, m: DIFF[this.diff].music }, { t: T.f0, m: "think" }];
    this.round = round;
    this.t = 0; this.lastCueT = -0.001;
    this.setHud({
      phase: "intro", level: this.level, streak: this.streak, twist, bonus, speed, swaps: nm, cups: n, blackout: false,
      result: null, waitingNext: false, focus: -1,
    });
  }

  private buildCues(r: Round): Cue[] {
    const { h } = r.T;
    const c: Cue[] = [];
    if (r.intro) c.push({ t: 0.15, s: "pop", g: 0.7 }, { t: 0.45, s: "popBig", g: 0.8 }, { t: 0.35, s: "boing", g: 0.45 }, { t: 1.2, s: "boing", g: 0.45 });
    else c.push({ t: 0.05, s: "popBig", g: 0.6 });
    c.push({ t: h, s: "swoosh", g: 0.4 }, { t: h + 0.4, s: "lift", g: 0.6 }, { t: h + 0.8, s: "boing", g: 0.6 });
    c.push({ t: h + 1.25, s: "squish", g: 0.6 }, { t: h + 1.25, s: "boing", g: 0.55 }, { t: h + 1.7, s: "squish", g: 0.6 }, { t: h + 1.8, s: "sparkle", g: 0.35 });
    c.push({ t: h + 2.25, s: "thud", g: 0.85 }, { t: h + 2.35, s: "snicker", g: 0.6 });
    for (const m of r.moves) {
      if (m.type === "tease") { c.push({ t: m.t0, s: "lift", g: 0.5 }, { t: m.t1 - 0.12, s: "thud", g: 0.45 }); continue; }
      const xs = m.cups.map((cup) => this.track.slots[m.before[cup]].x);
      const pan = m.type === "swap" ? (xs[0] + xs[1]) / 10 : 0;
      c.push({ t: m.t0, s: m.d < 0.4 ? "whooshShort" : m.d > 0.75 ? "whooshLong" : "whoosh", g: 0.75, p: pan });
      c.push({ t: m.t0, s: "clack", g: 0.35 }, { t: m.t1 - 0.04, s: "slide", g: 0.35 });
    }
    for (const b of r.blackouts) c.push({ t: b - 0.05, s: "lightsOff", g: 0.8 }, { t: b + 0.62, s: "lightsOn", g: 0.6 });
    c.push({ t: r.T.s1 + 0.05, s: "impact", g: 0.45 });
    c.push({ t: r.T.f0 + 0.05, s: "popBig", g: 0.7 });
    for (let i = 0; i < this.cups.length; i++) c.push({ t: r.T.f0 + 0.2 + i * 0.1, s: "pop", g: 0.4, rate: 1 + i * 0.12 });
    c.push({ t: r.T.f0 + 0.35, s: "gibberK", g: 0.7 });
    return c.sort((a, b) => a.t - b.t);
  }

  /** Player picks a slot (0-based, numbered left→right / back→front). */
  pickSlot(slot: number) {
    const r = this.round;
    if (!r || r.pick || this.hud.phase !== "pick" || this.paused) return;
    if (slot < 0 || slot >= this.cups.length) return;
    const t = this.t;
    const cup = this.track.cupAt(slot, this.track.slotOf);
    const answerSlot = this.track.slotOf[r.momoCup];
    const correct = cup === r.momoCup;
    this.streak = correct ? this.streak + 1 : 0;
    const base = DIFF[this.diff].coins;
    const coins = correct ? Math.round((base + Math.min(this.streak - 1, 10) * base * 0.2) * (r.bonus ? 2 : 1)) : 0;
    const end = t + (correct ? 2.5 : 3.2);
    const newBest = correct && this.streak > this.bestStreak && this.streak >= 3;
    if (correct) this.bestStreak = Math.max(this.bestStreak, this.streak);
    r.pick = { slot, cup, t, correct, answerSlot, end, coins, shown: false, newBest };
    const sc = this.track.scale;
    this.track.lift(cup, t + 0.45, t + 0.7, end + 0.15, end + 0.45, 2.7 * sc, 0.22);
    if (!correct) this.track.lift(r.momoCup, t + 1.35, t + 1.6, end + 0.15, end + 0.45, 2.7 * sc, -0.2);
    const add = (dt: number, s: SfxName, g = 0.7, rate?: number) => r.cues.push({ t: t + dt, s, g, rate });
    add(0, "drumroll", 0.5); add(0.45, "lift", 0.6);
    if (correct) {
      add(0.72, "popBig", 0.8); add(0.75, "sparkle", 0.6); add(0.8, "tada", 0.7); add(0.85, "confetti", 0.5); add(1.6, "gibberT", 0.5);
    } else {
      add(0.72, "hmm", 0.7); add(0.85, "snicker", 0.7); add(1.0, "sadtrombone", 0.55); add(1.35, "lift", 0.6); add(1.62, "popBig", 0.6); add(2.1, "gibberKShort", 0.7);
    }
    r.cues.sort((a, b) => a.t - b.t);
    r.music.push({ t: t + 0.7, m: correct ? "celebrate" : "replay" });
    r.outro = end;
    this.focusSlot = -1; this.hoverSlot = -1;
    this.canvas.style.cursor = "";
    if (this.settings.haptics && typeof navigator.vibrate === "function") navigator.vibrate(correct ? [18, 40, 28] : [60]);
    this.setHud({ phase: "reveal", focus: -1, streak: this.streak });
  }

  private showResult(r: Round) {
    const P = r.pick!;
    P.shown = true;
    this.setHud({ result: { correct: P.correct, coins: P.coins, answer: P.answerSlot, picked: P.slot, newBest: P.newBest } });
    this.cb.onRound?.({ correct: P.correct, coins: P.coins, level: r.level, streak: this.streak, twist: r.twist, difficulty: this.diff });
    if (P.correct) { this.level++; this.setHud({ level: this.level }); }
  }

  private scheduleNext() {
    window.clearTimeout(this.waitTimer);
    if (!this.settings.autoContinue || this.paused) return;
    const ms = this.settings.autoDelay * 1000;
    this.setHud({ nextAt: Date.now() + ms });
    this.waitTimer = window.setTimeout(() => this.next(), ms);
  }

  /** Continue to the next round (button / auto). */
  next() {
    if (!this.round?.pick || this.paused) return;
    this.newRound(false);
  }

  setFocus(slot: number) {
    this.focusSlot = slot;
    this.setHud({ focus: slot });
    this.needsRender = true;
  }

  // ------------------------------------------------------------ input
  private slotFromEvent(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(p, this.camera);
    const hits = this.ray.intersectObjects(this.cups.map((c) => c.hit), false);
    if (!hits.length) return -1;
    const cup = hits[0].object.userData.cup as number;
    return this.track.slotOf[cup];
  }
  pointerMove(x: number, y: number) {
    if (this.hud.phase !== "pick") { if (this.hoverSlot !== -1) { this.hoverSlot = -1; this.needsRender = true; } return; }
    const s = this.slotFromEvent(x, y);
    if (s !== this.hoverSlot) { this.hoverSlot = s; this.needsRender = true; this.canvas.style.cursor = s >= 0 ? "pointer" : ""; }
  }
  pointerUp(x: number, y: number) {
    if (this.hud.phase === "pick") { const s = this.slotFromEvent(x, y); if (s >= 0) this.pickSlot(s); }
    else if (this.hud.waitingNext) this.next();
  }

  // ------------------------------------------------------------ loop
  private loop = (now: number) => {
    if (!this.running || this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const cap = this.settings.fpsCap;
    const elapsed = now - this.last;
    if (cap && elapsed < 1000 / cap - 2) return;
    this.last = now;
    const dt = Math.min(0.05, elapsed / 1000);
    this.trackFps(elapsed);
    if (!this.paused) this.step(dt);
    const stop = this.settings.stopMotion && !this.settings.reducedMotion;
    const fi = Math.floor(this.t * 12);
    const live = !this.paused && (!stop || fi !== this.lastFrameIdx || this.hud.phase === "lobby");
    if (live || this.needsRender) {
      this.lastFrameIdx = fi;
      this.pose(stop ? fi / 12 : this.t, fi, stop, now / 1000);
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
      this.emitCupScreens();
    }
  };

  private trackFps(ms: number) {
    this.fpsAcc.n++; this.fpsAcc.t += ms;
    if (this.fpsAcc.t >= 1000) {
      const fps = (this.fpsAcc.n * 1000) / this.fpsAcc.t;
      this.cb.onFps?.(fps);
      this.fpsAcc = { n: 0, t: 0 };
      // dynamic resolution when quality is Auto
      if (this.settings.quality === "auto" && !this.paused) {
        const cap = this.settings.fpsCap || 60;
        const base = Math.min(window.devicePixelRatio || 1, this.quality === "high" ? 2 : 1.5) * this.settings.renderScale;
        if (fps < cap * 0.7 && this.dpr > 0.6) { this.dpr = Math.max(0.6, this.dpr - 0.15); this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.size.w, this.size.h, false); }
        else if (fps > cap * 0.95 && this.dpr < base) { this.dpr = Math.min(base, this.dpr + 0.1); this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.size.w, this.size.h, false); }
      }
    }
  }

  private step(dt: number) {
    const r = this.round;
    if (!r) { this.t += dt; return; }
    const prev = this.t;
    this.t += dt;
    if (r.pick && !r.pick.shown && this.t >= r.pick.t + (r.pick.correct ? 0.75 : 1.65)) this.showResult(r);
    // cues
    for (const q of r.cues) if (q.t > prev && q.t <= this.t) audio.play(q.s, { gain: q.g, pan: q.p, rate: q.rate });
    let mu: MusicName | null = null;
    for (const m of r.music) if (m.t <= this.t) mu = m.m;
    if (mu && audio.musicName !== mu) void audio.playMusic(mu);
    // phases
    const { h, s0, s1, f0 } = r.T;
    if (!r.pick) {
      const ph: Phase = this.t < h ? "intro" : this.t < s0 - 0.2 ? "hide" : this.t < f0 ? "shuffle" : "pick";
      if (ph !== this.hud.phase) this.setHud({ phase: ph });
    } else if (this.t >= r.outro && !this.hud.waitingNext) {
      this.setHud({ phase: "result", waitingNext: true });
      this.scheduleNext();
    }
    const bo = r.blackouts.some((b) => this.t >= b && this.t < b + 0.6) && this.t < s1 + 0.1;
    if (bo !== this.hud.blackout) {
      this.setHud({ blackout: bo });
      const k = bo ? 0.16 : 1;
      for (const L of this.lights) L.l.intensity = L.i * k;
      this.renderer.toneMappingExposure = bo ? 0.6 : 1.05;
    }
  }

  // ------------------------------------------------------------ posing (mirrors the video's apply())
  private poseLobby(rt: number) {
    const n = this.cups.length;
    this.cups.forEach((c, i) => {
      const s = this.track.slots[i];
      const b = Math.max(0, Math.sin(rt * 3 - i * 0.9)) * 0.12;
      c.root.position.set(s.x, b, s.z); c.root.rotation.set(0, 0, Math.sin(rt * 3 - i * 0.9) * 0.03);
      c.root.scale.setScalar(this.track.scale);
    });
    this.tiles.forEach((tl) => tl.update({ x: 0, z: 0, scale: 0 }));
    this.momo.update({ expr: "grin", arms: waveArms(rt), x: this.front.x, z: this.front.z, y: Math.abs(Math.sin(rt * 3)) * 0.15, ry: -0.12, blink: blinkAt(rt % 4, [1.2]), sprout: Math.sin(rt * 7) * 0.08 });
    const a = Math.min(n - 1, 0), b = n - 1;
    this.kranky.update({
      x: this.kpos.x, y: 0, z: this.kpos.z, expr: "smirk", bob: Math.sin(rt * 3) * 0.04, blink: blinkAt(rt % 5, [2.5]),
      clawL: { p: this.track.knob(a, 0).add(V(0, 0.15 + Math.sin(rt * 4) * 0.08, 0)), open: 0.3 + Math.sin(rt * 5) * 0.1 },
      clawR: { p: this.track.knob(b, 0).add(V(0, 0.15 + Math.sin(rt * 4 + 1) * 0.08, 0)), open: 0.3 + Math.sin(rt * 5 + 1) * 0.1 },
    });
    this.tiki.update({ visible: true, x: this.tikiX, z: this.front.z + 0.3, ry: 0.35, squash: 1 + Math.sin(rt * 6) * 0.02 });
    this.confetti.update(0, null, V());
    this.ring.visible = false;
    const c = this.camBase;
    this.camera.fov = c.fov; this.camera.position.copy(c.pos).add(V(Math.sin(rt * 0.3) * 0.25, 0, 0)); this.camera.lookAt(c.tgt); this.camera.updateProjectionMatrix();
  }

  private pose(t: number, frame: number, stop: boolean, wall: number) {
    const r = this.round;
    if (!r) { this.poseLobby(wall); return; }
    const tr = this.track, X = (s: number) => tr.slots[s], sc = tr.scale;
    const { h, s0, s1, f0 } = r.T;
    const k = r.momoCup;
    const P = r.pick;
    // ---- cups
    this.cups.forEach((c, i) => {
      const p = tr.pose(i, t);
      c.root.position.set(p.x, p.y, p.z);
      c.root.rotation.set(p.rx, 0, p.rz);
      c.root.scale.set(sc / Math.sqrt(p.squash), sc * p.squash, sc / Math.sqrt(p.squash));
    });
    // waiting dance before the pick (cups hop in a wave, like the video's timer)
    if (!P && t > f0 + 1.2) {
      const env = seg(t, f0 + 1.2, f0 + 1.6);
      this.cups.forEach((c, i) => {
        const w = Math.sin(t * 7 - tr.slotOf[i] * 1.1);
        c.root.position.y += Math.max(0, w) * 0.16 * env;
        c.root.rotation.z += w * 0.035 * env;
      });
    }
    // ---- number tiles
    const pop = (a: number, b: number) => (t < a ? 0 : E.outBack(seg(t, a, a + 0.3)) * (1 - E.in(seg(t, b, b + 0.18))));
    const tileEnd = P ? P.t : 1e9;
    this.tiles.forEach((tl, i) => {
      const s = X(i);
      const sOn = this.settings.showNumbers && this.layout === "row" ? pop(f0 + 0.2 + i * 0.1, tileEnd) : 0;
      tl.update({ x: s.x, z: s.z + 1.75 * sc, scale: sOn * sc });
    });
    // ---- hover ring
    const hs = this.focusSlot >= 0 ? this.focusSlot : this.hoverSlot;
    if (this.hud.phase === "pick" && hs >= 0) {
      const s = X(hs);
      this.ring.visible = true;
      this.ring.position.set(s.x, 0.04, s.z);
      this.ring.scale.setScalar(sc * (1 + Math.sin(wall * 8) * 0.04));
    } else this.ring.visible = false;
    // ---- Momo
    const mk = X(tr.init[k]);
    const m: Record<string, unknown> = {
      expr: "grin", arms: MOMO_ARMS.down, x: this.front.x, y: 0, z: this.front.z, ry: -0.12, scale: sc < 1 ? 0.86 : 1,
      blink: blinkAt(t, [0.9, 2.2, f0 + 1]),
    };
    if (t < h + 0.8) {
      if (r.intro) {
        m.arms = waveArms(t);
        m.y = arc(seg(t, 0.35, 0.7)) * 0.35 + arc(seg(t, 1.1, 1.45)) * 0.35;
        m.squash = landSquash(t, 0.7) * landSquash(t, 1.45) * ((m.y as number) > 0.05 ? 1.08 : 1);
      } else {
        m.arms = MOMO_ARMS.cheer; m.expr = "happy";
        m.y = arc(seg(t, 0, 0.35)) * 0.25; m.squash = landSquash(t, 0.35);
      }
      if (t > h) { m.look = [mk.x > this.front.x ? 0.5 : -0.5, 0.2]; m.arms = MOMO_ARMS.cheer; m.expr = "happy"; }
    } else if (t < h + 2.25) {
      const start = this.front, end = V(mk.x, 0, mk.z + 0.15), mid = start.clone().lerp(end, 0.5).setY(0);
      m.expr = "happy";
      if (t < h + 1.7) {
        const first = t < h + 1.25, u = first ? seg(t, h + 0.8, h + 1.25) : seg(t, h + 1.25, h + 1.7);
        const a = first ? start : mid, b = first ? mid : end;
        m.x = lerp(a.x, b.x, u); m.z = lerp(a.z, b.z, u); m.y = arc(u) * 1.1; m.arms = MOMO_ARMS.up;
        m.squash = 1.1; m.ry = Math.atan2(b.x - a.x, b.z - a.z) * 0.35;
      } else { m.x = end.x; m.z = end.z; m.expr = "sly"; m.arms = MOMO_ARMS.tuck; m.ry = 0; m.squash = landSquash(t, h + 1.7); }
    } else if (!P || t < P.t + (P.correct ? 0.7 : 1.6)) {
      m.visible = false;
    } else if (t < P.end) {
      const t0 = P.t + (P.correct ? 0.7 : 1.6);
      const s = X(P.answerSlot);
      m.x = s.x; m.z = s.z + 0.35; m.ry = 0;
      const u = seg(t, t0, t0 + 0.6);
      m.y = arc(u) * 1.5; m.arms = MOMO_ARMS.cheer;
      m.squash = t < t0 + 0.6 ? 1.12 : landSquash(t, t0 + 0.6);
      m.expr = P.correct ? "grin" : t < t0 + 0.7 ? "surprised" : "happy";
      if (t > t0 + 0.9) { m.arms = waveArms(t); }
    } else {
      // hop back out to the front
      const s = X(P.answerSlot);
      const u = seg(t, P.end, P.end + 0.55);
      m.x = lerp(s.x, this.front.x, u); m.z = lerp(s.z + 0.35, this.front.z, u); m.y = arc(u) * 1.6;
      m.arms = u < 1 ? MOMO_ARMS.up : MOMO_ARMS.cheer; m.expr = u < 1 ? "happy" : "grin";
      m.squash = u < 1 ? 1.1 : landSquash(t, P.end + 0.55);
      if (u >= 1) m.arms = waveArms(t);
    }
    m.sprout = Math.sin(t * 7) * 0.08 + ((m.y as number) > 0.1 ? 0.2 : 0);
    this.momo.update(m);
    // ---- Tiki: intro with the level sign, then hops off stage
    const tikiX0 = this.tikiX;
    const ti: Record<string, unknown> = { x: tikiX0, z: this.front.z + 0.3, ry: 0.35, squash: 1 + Math.sin(t * 6) * 0.02, visible: true };
    if (!r.intro) { const u = E.outBack(seg(t, 0, 0.45)); ti.x = lerp(tikiX0 - 6, tikiX0, u); ti.y = arc(seg(t, 0, 0.45)) * 0.6; }
    if (t > h) {
      const u1 = seg(t, h, h + 0.4), u2 = seg(t, h + 0.4, h + 0.8);
      ti.x = t < h + 0.4 ? lerp(tikiX0, tikiX0 - 2.2, u1) : lerp(tikiX0 - 2.2, tikiX0 - 5.2, u2);
      ti.y = (t < h + 0.4 ? arc(u1) : arc(u2)) * 0.7; ti.ry = -0.9;
      ti.visible = t < h + 0.85;
    }
    if (P && P.correct && t > P.end) {
      const u = E.outBack(seg(t, P.end, P.end + 0.45));
      ti.visible = true; ti.x = lerp(tikiX0 - 5, tikiX0, u); ti.y = Math.abs(Math.sin(t * 10)) * 0.4; ti.ry = 0.35;
    }
    this.tiki.update(ti);
    // ---- Kranky
    const rest = this.rest;
    const kr: Record<string, unknown> = { x: this.kpos.x, y: 0, z: this.kpos.z, expr: "smirk", bob: Math.sin(t * 3) * 0.04, blink: blinkAt(t, [0.8, 3.5, f0 + 2.4]) };
    const idle = (side: number, open = 0.4) => ({ p: rest[side].clone().add(V(0, Math.sin(t * 4 + side) * 0.08, 0)), open: open + Math.sin(t * 6 + side) * 0.15 });
    const outer = [tr.cupAt(0, tr.init), tr.cupAt(this.layout === "grid" ? 2 : this.cups.length - 1, tr.init)];
    if (t < h) {
      kr.clawL = { p: tr.knob(outer[0], t), open: 0.3 + Math.sin(t * 5) * 0.1 };
      kr.clawR = { p: tr.knob(outer[1], t), open: 0.3 + Math.sin(t * 5 + 1) * 0.1 };
    } else if (t < s0 - 0.6) {
      const side = mk.x < 0 || (mk.x === 0 && k % 2 === 0) ? 0 : 1, other = 1 - side;
      const u = E.inOut(seg(t, h, h + 0.4));
      const from = [tr.knob(outer[0], h), tr.knob(outer[1], h)];
      const tgt = tr.knob(k, Math.min(t, h + 2.25));
      if (t > h + 2.25) tgt.y += E.out(seg(t, h + 2.25, h + 2.4)) * 0.4;
      const cl: { p: THREE.Vector3; open: number }[] = [];
      cl[side] = { p: from[side].clone().lerp(tgt, u), open: 0.15 };
      cl[other] = { p: from[other].clone().lerp(rest[other], u), open: 0.5 };
      kr.clawL = cl[0]; kr.clawR = cl[1];
      if (t > h + 2.3) { kr.expr = "laugh"; kr.bob = (kr.bob as number) + Math.sin(t * 30) * 0.05; kr.tilt = Math.sin(t * 15) * 0.04; }
    } else if (t <= s1) {
      const c = tr.claws(t, r.moves, rest) || [idle(0), idle(1)];
      kr.clawL = c[0]; kr.clawR = c[1];
      if (t < s0) {
        const u = E.inOut(seg(t, s0 - 0.6, s0));
        (kr.clawL as { p: THREE.Vector3 }).p.y += (1 - u) * 0.3; (kr.clawR as { p: THREE.Vector3 }).p.y += (1 - u) * 0.3;
      }
      kr.bob = (kr.bob as number) + Math.sin(t * 9) * 0.03;
    } else if (!P) {
      const u = E.out(seg(t, s1, s1 + 0.4));
      const lc = tr.claws(s1 - 0.001, r.moves, rest) || [idle(0), idle(1)];
      if (t < f0 + 1.6) {
        kr.clawL = { p: lc[0].p.clone().lerp(rest[0], u), open: lerp(0.15, 0.9, u) };
        kr.clawR = { p: lc[1].p.clone().lerp(rest[1], u), open: lerp(0.15, 0.9, u) };
        if (t > f0 + 0.35 && t < f0 + 1.6 && Math.floor(t * 9) % 2 === 0) kr.expr = "laugh";
      } else {
        // tease: hover over the cups one by one ("this one? …or this one?")
        const cyc = 1.55, ii = Math.floor((t - f0 - 1.6) / cyc) % r.hover.length;
        const local = (t - f0 - 1.6) % cyc;
        const slot = r.hover[ii], sx = X(slot).x, side = sx < 0 ? 0 : sx > 0 ? 1 : ii % 2;
        const hov = V(sx, 3.7 * sc + 0.4 + Math.sin(t * 8) * 0.12, X(slot).z + 0.3);
        const uu = E.inOut(clamp(local / 0.45));
        const cl: { p: THREE.Vector3; open: number }[] = [];
        cl[side] = { p: rest[side].clone().lerp(hov, uu * (1 - E.inOut(clamp((local - 1.1) / 0.45)))), open: 0.25 + Math.sin(t * 10) * 0.15 };
        cl[1 - side] = idle(1 - side, 0.8);
        kr.clawL = cl[0]; kr.clawR = cl[1];
        kr.look = [(sx / 2.5) * 0.5, -0.5]; kr.tilt = Math.sin(t * 9) * 0.07; kr.bob = (kr.bob as number) + Math.abs(Math.sin(t * 9)) * 0.08;
      }
    } else {
      // reveal: one claw lifts the picked cup; on a miss the other lifts Momo's cup
      const pickX = X(P.slot).x, side = pickX < 0 || (pickX === 0 && P.slot % 2 === 0) ? 0 : 1, other = 1 - side;
      const cl: { p: THREE.Vector3; open: number }[] = [];
      const u = E.inOut(seg(t, P.t, P.t + 0.42));
      const fromP = [rest[0].clone(), rest[1].clone()];
      cl[side] = { p: fromP[side].lerp(tr.knob(P.cup, t), u), open: lerp(0.9, 0.15, u) };
      if (!P.correct) {
        const u2 = E.inOut(seg(t, P.t + 0.9, P.t + 1.32));
        cl[other] = { p: rest[other].clone().lerp(tr.knob(k, t), u2), open: lerp(0.9, 0.15, u2) };
      } else cl[other] = idle(other, 0.9);
      if (t > P.end) {
        const ub = E.out(seg(t, P.end + 0.3, P.end + 0.7));
        cl[0].p.lerp(rest[0], ub); cl[1].p.lerp(rest[1], ub);
      }
      kr.clawL = cl[0]; kr.clawR = cl[1];
      if (t > P.t + 0.72) {
        if (P.correct) { kr.expr = "shock"; kr.hatHop = arc(seg(t, P.t + 0.72, P.t + 1.12)) * 0.5; }
        else if (t < P.t + 2.4) { kr.expr = "laugh"; kr.bob = (kr.bob as number) + Math.sin(t * 30) * 0.05; kr.tilt = Math.sin(t * 15) * 0.05; }
      }
    }
    this.kranky.update(kr);
    // ---- confetti on a correct find
    const ct = P && P.correct ? P.t + 0.75 : null;
    const ans = P ? X(P.answerSlot) : X(0);
    this.confetti.update(t, ct, V(ans.x, 2.4, ans.z + 0.6));
    if (stop) {
      boil(this.momo.root, frame, 1); boil(this.kranky.bodyG, frame, 2, 0.6); boil(this.tiki.root, frame, 3);
      this.cups.forEach((c, i) => boil(c.root, frame, 10 + i, 0.4));
    }
    // ---- camera
    const cb = this.camBase;
    const pos = cb.pos.clone(), tgt = cb.tgt.clone();
    let fov = cb.fov;
    if (r.intro && t < h) pos.z += lerp(1.2, 0, E.out(seg(t, 0, h)));
    if (t > s0 && t < s1 && this.settings.cameraShake && !this.settings.reducedMotion) {
      const a = 0.02 * r.speed; pos.x += Math.sin(t * 37) * a; pos.y += Math.cos(t * 29) * a;
    }
    let pu = 0;
    if (t >= s1) pu = E.out(seg(t, s1 + 0.2, f0 + 0.6)) * (P ? 1 - E.inOut(seg(t, P.end, P.end + 0.5)) : 1);
    pos.lerp(tgt, 0.07 * pu); tgt.y -= 0.25 * pu;
    if (P && t > P.t + 0.7 && t < P.end) fov = lerp(cb.fov - 3, cb.fov, E.out(seg(t, P.t + 0.7, P.t + 1.6)));
    this.camera.fov = fov; this.camera.position.copy(pos); this.camera.lookAt(tgt); this.camera.updateProjectionMatrix();
  }

  /** screen positions of each slot (for accessible number buttons over the canvas) */
  private emitCupScreens() {
    if (!this.cb.onFrame || !this.track) return;
    const out: CupScreen[] = [];
    const v = new THREE.Vector3(), w = new THREE.Vector3(), top = new THREE.Vector3();
    const sc = this.track.scale;
    for (let s = 0; s < this.track.slots.length; s++) {
      const cup = this.track.cupAt(s, this.track.slotOf);
      const root = this.cups[cup]?.root;
      if (!root) { out.push({ x: 0, y: 0, r: 0, top: 0, visible: false }); continue; }
      v.set(root.position.x, root.position.y + 1.1 * sc, root.position.z).project(this.camera);
      w.set(root.position.x + 1.15 * sc, root.position.y + 1.1 * sc, root.position.z).project(this.camera);
      top.set(root.position.x, root.position.y + 2.7 * sc, root.position.z).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * this.size.w, y = (-v.y * 0.5 + 0.5) * this.size.h;
      out.push({ x, y, r: Math.abs((w.x - v.x) * 0.5 * this.size.w), top: (-top.y * 0.5 + 0.5) * this.size.h, visible: v.z < 1 });
    }
    this.cb.onFrame(out);
  }

  /** Grab a PNG of the current frame. */
  async screenshot(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((res) => this.canvas.toBlob((b) => res(b), "image/png"));
  }
}

const clamp = (u: number) => Math.max(0, Math.min(1, u));

// Cup with a custom clay colour (same build as characters.js makeCup).
function makeCupColored(color: string) {
  const g = new THREE.Group(); g.name = "cup";
  const m = clay(color, { bump: 1.8, freq: 0.9 });
  const rOf = (y: number) => 1.15 - 0.15 * y;
  g.add(mesh(lumpy(new THREE.CylinderGeometry(0.82, 1.15, 2.2, 72, 12), { amp: 0.025, freq: 1.8 }), m, { p: [0, 1.1, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(rOf(0.6), 0.075, 14, 72), { amp: 0.01 }), clay(PAL.cupStripe), { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(rOf(1.5), 0.065, 14, 72), { amp: 0.01 }), clay(PAL.cupStripe2), { p: [0, 1.5, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(lumpy(new THREE.TorusGeometry(1.15, 0.09, 14, 72), { amp: 0.012 }), clay(PAL.cupStripe), { p: [0, 0.07, 0], r: [Math.PI / 2, 0, 0] }));
  g.add(mesh(sphere(0.26), clay(PAL.cupStripe), { p: [0, 2.3, 0], s: [1, 0.85, 1] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.add(mesh(sphere(0.07), clay(PAL.cupStripe2), { p: [Math.sin(a) * rOf(1.05), 1.05, Math.cos(a) * rOf(1.05)], s: [1, 1, 0.5], r: [0, a, 0] }));
  }
  return g;
}

// Merge the static stage into one mesh per material: hundreds of draw calls → a few dozen.
function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; recv: boolean }>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) { keep.push(m); return; }
    g.morphAttributes = {};
    const key = m.material.uuid;
    let e = groups.get(key);
    if (!e) { e = { mat: m.material, geos: [], cast: false, recv: false }; groups.set(key, e); }
    e.geos.push(g); e.cast ||= m.castShadow; e.recv ||= m.receiveShadow;
  });
  const out = new THREE.Group();
  for (const e of groups.values()) {
    const merged = mergeGeometries(e.geos, false);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, e.mat);
    mm.castShadow = e.cast; mm.receiveShadow = e.recv;
    out.add(mm);
    for (const g of e.geos) g.dispose();
  }
  return out;
}
