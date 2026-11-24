// The Sproutpop greenhouse in 3D (three.js). Glossy, iridescent bubbles hang from a vine beam inside a glass frame;
// some hold a little seedling. Aim from the flower pod at the bottom (drag on touch, move on desktop): a dotted guide
// shows the whole flight, wall bounces included, and a ghost ring marks where the bubble will stick. Shots fly,
// bounce, stick with a squash and a ripple through their neighbours; groups pop into droplets one after another,
// cut-off bubbles tumble down, ice cracks, bombs blast, and freed seedlings grow and fly up to the counter. Leftover
// shots go up as fireworks when a stage is cleared. Layout is in CSS pixels on the z = 0 plane (one world unit = one
// pixel there); grid units (bubble radius 1) are scaled by `s`.
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BOMB, BOMB_SHOT, COLS, LAUNCH_Y, MAX_ROWS, RAINBOW, STONE, W, cx, cy, fly, isColour, type Grid } from "../grid";
import type { Game, ShotResult } from "../play";
import type { Garden } from "../stage";

export type SceneSound = "bounce" | "stick" | "pop" | "blast" | "thaw" | "fall" | "sprout" | "firework" | "swap" | "load" | "stone";
export interface SproutHooks {
  shoot: (angle: number) => void;
  swap: () => void;
  canAim: () => boolean;
  /** where freed seedlings fly to (CSS px in the canvas) */
  goal: () => { x: number; y: number };
  sound: (e: SceneSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

export const BUBBLE_COLOURS = ["#ff4f6d", "#ffc531", "#3fd36b", "#3ea8ff", "#a565ff", "#ff8b2e"];
const MAX_ANGLE = 1.36;

interface Bub { g: THREE.Group; k: number; core: THREE.Mesh; ice?: THREE.Mesh; sprout?: THREE.Group; r: number; c: number; off: THREE.Vector2; vel: THREE.Vector2; born: number; ph: number }
interface Dying { b: Bub; t0: number; kind: "pop" | "fall"; v: THREE.Vector3; spin: THREE.Vector3 }
interface Flyer { g: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; done: () => void; grow?: boolean; path?: THREE.Vector3[]; cum?: number[]; passed?: number; onPass?: (i: number) => void }
interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; c: THREE.Color; g: number }

export class SproutScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 10, 8000);
  board = new THREE.Group();
  private W = 360; private H = 640; private s = 18; private ox = 0; private oy = 0;
  private game: Game | null = null;
  private bubs = new Map<number, Bub>();
  private dying: Dying[] = [];
  private flyers: Flyer[] = [];
  private parts: Part[] = [];
  private geo = { sphere: new THREE.SphereGeometry(0.94, 30, 20), stone: new THREE.DodecahedronGeometry(0.9, 0), ice: new THREE.IcosahedronGeometry(1.04, 1), dot: new THREE.SphereGeometry(0.21, 10, 8), ring: new THREE.TorusGeometry(0.92, 0.07, 8, 40), stem: new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), leaf: new THREE.SphereGeometry(1, 14, 10), fuse: new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), petal: new THREE.SphereGeometry(1, 18, 12) };
  private solid: THREE.MeshPhysicalMaterial[] = [];
  private glass: THREE.MeshPhysicalMaterial[] = [];
  private mats: Record<string, THREE.Material> = {};
  private frame = new THREE.Group();
  private pod = new THREE.Group();
  private aimDots: THREE.InstancedMesh;
  private ghost: THREE.Mesh;
  private danger: THREE.Mesh;
  private cur: Bub | null = null; private nxt: Bub | null = null;
  private aimAngle: number | null = null;
  private busy = false;
  private shake = 0;
  private ptsGeo: THREE.BufferGeometry; private pts: THREE.Points;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver;
  private garden: Garden | null = null;
  private pmrem: THREE.PMREMGenerator;
  private down = false;

  constructor(private el: HTMLElement, private hooks: SproutHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(autoQuality()), alpha: true, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(autoQuality()));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none" });
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-300, 600, 800); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffe0f4, 0.6); rim.position.set(400, -200, 300); this.scene.add(rim);
    this.scene.add(this.board);
    this.board.add(this.frame, this.pod);

    BUBBLE_COLOURS.forEach((c) => {
      this.solid.push(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.35, iridescenceIOR: 1.35, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), envMapIntensity: 1 }));
      this.glass.push(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.6, iridescenceIOR: 1.3, transparent: true, opacity: 0.6, depthWrite: false, envMapIntensity: 1.3 }));
    });
    this.mats = {
      stone: new THREE.MeshStandardMaterial({ color: "#8d8a86", roughness: 0.9, flatShading: true }),
      bomb: new THREE.MeshPhysicalMaterial({ color: "#2b2440", roughness: 0.3, clearcoat: 1, emissive: "#ff3b3b", emissiveIntensity: 0 }),
      fuse: new THREE.MeshStandardMaterial({ color: "#d9b37a", roughness: 0.8 }),
      ice: new THREE.MeshPhysicalMaterial({ color: "#dff6ff", roughness: 0.05, transparent: true, opacity: 0.55, flatShading: true, clearcoat: 1, emissive: "#6cc4ff", emissiveIntensity: 0.18, depthWrite: false }),
      stem: new THREE.MeshStandardMaterial({ color: "#3e9a3a", roughness: 0.6 }),
      leaf: new THREE.MeshPhysicalMaterial({ color: "#6fe05a", roughness: 0.35, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#eaffd0") }),
      rainbow: new THREE.MeshPhysicalMaterial({ map: rainbowTex(), roughness: 0.15, clearcoat: 1, iridescence: 1, emissive: "#ffffff", emissiveIntensity: 0.08 }),
      dot: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }),
      ghost: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthWrite: false }),
      danger: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false }),
      petal: new THREE.MeshPhysicalMaterial({ color: "#ff8fc0", roughness: 0.35, clearcoat: 0.8, sheen: 0.8, sheenColor: new THREE.Color("#ffffff") }),
      cup: new THREE.MeshPhysicalMaterial({ color: "#ffd54a", roughness: 0.4, clearcoat: 0.6 }),
      pad: new THREE.MeshPhysicalMaterial({ color: "#58c94a", roughness: 0.45, clearcoat: 0.5 }),
      vine: new THREE.MeshStandardMaterial({ color: "#4f8a3a", roughness: 0.7 }),
      glassPane: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, clearcoat: 1 }),
    };
    this.aimDots = new THREE.InstancedMesh(this.geo.dot, this.mats.dot, 80);
    this.aimDots.count = 0; this.aimDots.renderOrder = 5; this.aimDots.frustumCulled = false;
    this.ghost = new THREE.Mesh(this.geo.ring, this.mats.ghost); this.ghost.visible = false; this.ghost.renderOrder = 5;
    this.danger = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mats.danger);
    this.board.add(this.aimDots, this.ghost, this.danger);

    const SP = 600;
    this.ptsGeo = new THREE.BufferGeometry();
    this.ptsGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    this.ptsGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    this.pts = new THREE.Points(this.ptsGeo, new THREE.PointsMaterial({ size: 12, map: dropTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 20;
    this.scene.add(this.pts);

    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onCancel);
    c.addEventListener("pointerleave", this.onLeave);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); });
    this.io.observe(el);
    document.addEventListener("visibilitychange", this.kick);
    this.resize();
  }

  // ------------------------------------------------------------ layout
  private resize() {
    const w = this.el.clientWidth || 360, h = this.el.clientHeight || 640;
    this.W = w; this.H = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`; this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0, h / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.camera.near = 10; this.camera.far = this.camera.position.z * 3;
    this.camera.updateProjectionMatrix();
    const totalH = LAUNCH_Y + 2.4;
    this.s = Math.min((w - 20) / (W + 0.8), (h - 10) / totalH, 34);
    this.ox = (w - W * this.s) / 2;
    this.oy = Math.max(4, (h - totalH * this.s) / 2);
    this.buildFrame();
    this.placeAll();
    this.kick();
  }
  /** grid units → world (px) */
  private wp(x: number, y: number, z = 0) { return new THREE.Vector3(this.ox + x * this.s - this.W / 2, this.H / 2 - (this.oy + y * this.s), z); }
  private cellW(r: number, c: number) { return this.wp(cx(r, c), cy(r)); }
  private pan(xUnits: number) { return Math.max(-1, Math.min(1, (xUnits / W) * 2 - 1)) * 0.8; }
  /** a world point → CSS px in the canvas */
  private screen(v: THREE.Vector3) { return { x: v.x + this.W / 2, y: this.H / 2 - v.y }; }
  launcherScreen() { return this.screen(this.wp(W / 2, LAUNCH_Y)); }
  nextScreen() { return this.screen(this.wp(W / 2 - 3.6, LAUNCH_Y + 0.5)); }
  /** CSS px of a grid cell (QA hooks) */
  cellScreen(r: number, c: number) { return this.screen(this.cellW(r, c)); }

  private buildFrame() {
    this.frame.children.slice().forEach((o) => { this.frame.remove(o); if ((o as THREE.Mesh).geometry && (o as THREE.Mesh).geometry.type !== "SphereGeometry") (o as THREE.Mesh).geometry.dispose(); });
    const s = this.s;
    const top = this.wp(0, 0), bot = this.wp(W, cy(MAX_ROWS) + 0.4);
    // the glass pane behind the bubbles
    const pw = W * s + s * 0.8, ph = top.y - bot.y + s * 0.6;
    const pane = new THREE.Mesh(roundRect(pw, ph, s * 0.9), this.mats.glassPane);
    pane.position.set((top.x + bot.x) / 2, (top.y + bot.y) / 2, -s * 1.6);
    this.frame.add(pane);
    // the vine beam on top and the two vine walls
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.32, s * 0.32, pw + s * 0.4, 16), this.mats.vine);
    beam.rotation.z = Math.PI / 2; beam.position.set((top.x + bot.x) / 2, top.y + s * 0.25, -s * 0.4);
    this.frame.add(beam);
    for (const x of [top.x - s * 0.25, bot.x + s * 0.25]) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, top.y - this.wp(0, LAUNCH_Y + 0.6).y, 12), this.mats.vine);
      wall.position.set(x, (top.y + this.wp(0, LAUNCH_Y + 0.6).y) / 2, -s * 0.4);
      this.frame.add(wall);
      // leaves along the wall
      for (let i = 0; i < 9; i++) {
        const lf = new THREE.Mesh(this.geo.leaf, this.mats.leaf);
        const y = top.y - (i + 0.5) * ((top.y - this.wp(0, LAUNCH_Y).y) / 9);
        const side = x < 0 ? -1 : 1;
        lf.scale.set(s * 0.42, s * 0.16, s * 0.2);
        lf.position.set(x + side * s * 0.28 * (i % 2 ? 1 : -1), y, -s * 0.2);
        lf.rotation.z = (i % 2 ? 0.6 : -0.6) * side + (i % 2 ? 0 : Math.PI);
        this.frame.add(lf);
      }
    }
    // little leaves hanging from the beam
    for (let i = 0; i < 12; i++) {
      const lf = new THREE.Mesh(this.geo.leaf, this.mats.leaf);
      lf.scale.set(s * 0.32, s * 0.13, s * 0.16);
      lf.position.set(top.x + (i + 0.5) * (pw / 12) - s * 0.4, top.y + s * 0.02, -s * 0.15);
      lf.rotation.z = i % 2 ? 0.9 : -0.9;
      this.frame.add(lf);
    }
    // the danger line (a dashed vine of light)
    const dl = this.wp(W / 2, cy(MAX_ROWS) - 1.05);
    this.danger.scale.set(W * s, Math.max(2, s * 0.08), 1);
    this.danger.position.set(dl.x, dl.y, -s * 0.5);
    // the flower pod
    this.pod.children.slice().forEach((o) => this.pod.remove(o));
    const lp = this.wp(W / 2, LAUNCH_Y + 0.15, -s * 0.6);
    this.pod.position.copy(lp);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.PI / 14;
      const p = new THREE.Mesh(this.geo.petal, this.mats.petal);
      p.scale.set(s * 0.55, s * 1.05, s * 0.28);
      p.position.set(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.75, -s * 0.2);
      p.rotation.z = a - Math.PI / 2;
      p.userData.a = a;
      this.pod.add(p);
    }
    const cup = new THREE.Mesh(this.geo.petal, this.mats.cup); cup.scale.set(s * 1.05, s * 0.55, s * 0.6); cup.position.set(0, -s * 0.55, s * 0.2);
    this.pod.add(cup);
    const pad = new THREE.Mesh(this.geo.petal, this.mats.pad); pad.scale.set(s * 1.1, s * 0.3, s * 0.6);
    const np = this.wp(W / 2 - 3.6, LAUNCH_Y + 1.05, -s * 0.5); pad.position.copy(np.sub(lp));
    this.pod.add(pad);
  }

  // ------------------------------------------------------------ bubbles
  private makeBub(k: number, sprout = false, ice = false): Bub {
    const g = new THREE.Group();
    let core: THREE.Mesh;
    if (k === STONE) { core = new THREE.Mesh(this.geo.stone, this.mats.stone); core.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); }
    else if (k === BOMB || k === BOMB_SHOT) {
      core = new THREE.Mesh(this.geo.sphere, this.mats.bomb.clone());
      const fuse = new THREE.Mesh(this.geo.fuse, this.mats.fuse); fuse.position.set(0.35, 0.9, 0); fuse.rotation.z = -0.5; core.add(fuse);
      const spark = new THREE.Mesh(this.geo.dot, new THREE.MeshBasicMaterial({ color: "#ffd25a" })); spark.position.set(0.5, 1.15, 0); spark.name = "spark"; core.add(spark);
    } else if (k === RAINBOW) core = new THREE.Mesh(this.geo.sphere, this.mats.rainbow);
    else core = new THREE.Mesh(this.geo.sphere, (sprout ? this.glass : this.solid)[(k - 1) % 6]);
    if (sprout) core.renderOrder = 3;
    g.add(core);
    const b: Bub = { g, k, core, r: -1, c: -1, off: new THREE.Vector2(), vel: new THREE.Vector2(), born: performance.now(), ph: Math.random() * 6 };
    if (sprout) { b.sprout = this.seedling(); b.sprout.scale.setScalar(1.05); b.sprout.position.set(0, -0.42, 0.25); g.add(b.sprout); }
    if (ice) { b.ice = new THREE.Mesh(this.geo.ice, this.mats.ice); b.ice.renderOrder = 4; b.ice.rotation.set(0.4, 0.3, 0); g.add(b.ice); }
    g.scale.setScalar(this.s);
    this.board.add(g);
    return b;
  }
  private seedling() {
    const sp = new THREE.Group();
    const stem = new THREE.Mesh(this.geo.stem, this.mats.stem); stem.position.y = 0.3; sp.add(stem);
    for (const side of [-1, 1]) {
      const lf = new THREE.Mesh(this.geo.leaf, this.mats.leaf);
      lf.scale.set(0.36, 0.14, 0.2); lf.position.set(side * 0.3, 0.72, 0.04); lf.rotation.z = side * 0.45;
      lf.name = side < 0 ? "lL" : "lR";
      sp.add(lf);
    }
    const seed = new THREE.Mesh(this.geo.leaf, new THREE.MeshStandardMaterial({ color: "#8a5a32", roughness: 0.7 })); seed.scale.set(0.2, 0.14, 0.16); seed.position.y = -0.08; sp.add(seed);
    return sp;
  }
  private freeBub(b: Bub) {
    this.board.remove(b.g);
    if (b.k === BOMB || b.k === BOMB_SHOT) (b.core.material as THREE.Material).dispose();
    b.g.traverse((o) => { if (o.name === "spark") ((o as THREE.Mesh).material as THREE.Material).dispose(); });
  }
  private placeAll() {
    for (const b of this.bubs.values()) { b.g.scale.setScalar(this.s); b.g.position.copy(this.cellW(b.r, b.c)); }
    this.placeLauncher();
  }
  private placeLauncher() {
    if (this.cur) { this.cur.g.position.copy(this.wp(W / 2, LAUNCH_Y)); this.cur.g.scale.setScalar(this.s); }
    if (this.nxt) { this.nxt.g.position.copy(this.wp(W / 2 - 3.6, LAUNCH_Y + 0.5)); this.nxt.g.scale.setScalar(this.s * 0.72); }
  }

  setGarden(g: Garden) {
    this.garden = g;
    (this.mats.vine as THREE.MeshStandardMaterial).color.set(g.id === "moonflower" ? "#3a5a7a" : g.id === "cactus" ? "#7a9a3a" : "#4f8a3a");
    (this.mats.petal as THREE.MeshPhysicalMaterial).color.set(g.glow);
    (this.mats.danger as THREE.MeshBasicMaterial).color.set(g.id === "moonflower" ? "#a8f0ff" : "#ffffff");
    this.kick();
  }

  /** show a fresh board (or a resumed one) without animation */
  setStage(game: Game) {
    for (const b of this.bubs.values()) this.freeBub(b);
    this.bubs.clear();
    this.dying.forEach((d) => this.freeBub(d.b)); this.dying = [];
    this.game = game;
    const now = performance.now();
    game.grid.forEach((row, r) => row.forEach((x, c) => {
      if (!x) return;
      const b = this.makeBub(x.k, x.sprout, x.ice);
      b.r = r; b.c = c; b.g.position.copy(this.cellW(r, c));
      b.born = now + (r * 40 + Math.abs(c - 4) * 25);
      this.bubs.set(r * 16 + c, b);
    }));
    this.loadLauncher(game, true);
    this.busy = false;
    this.kick();
  }

  /** match the meshes to a game state (after undo-like changes or as a safety net after animations) */
  sync(game: Game) {
    this.game = game;
    const want = new Set<number>();
    game.grid.forEach((row, r) => row.forEach((x, c) => {
      if (!x) return;
      const id = r * 16 + c; want.add(id);
      const b = this.bubs.get(id);
      if (b && b.k === x.k && !!b.sprout === !!x.sprout) { if (!x.ice && b.ice) { b.g.remove(b.ice); b.ice = undefined; } return; }
      if (b) this.freeBub(b);
      const nb = this.makeBub(x.k, x.sprout, x.ice); nb.r = r; nb.c = c; nb.g.position.copy(this.cellW(r, c));
      this.bubs.set(id, nb);
    }));
    for (const [id, b] of this.bubs) if (!want.has(id)) { this.freeBub(b); this.bubs.delete(id); }
    this.loadLauncher(game, false);
    this.kick();
  }

  private loadLauncher(game: Game, fresh: boolean) {
    if (this.cur && this.cur.k !== game.cur) { this.freeBub(this.cur); this.cur = null; }
    if (this.nxt && this.nxt.k !== game.nxt) { this.freeBub(this.nxt); this.nxt = null; }
    const now = performance.now();
    if (!this.cur) { this.cur = this.makeBub(game.cur); this.cur.born = now + (fresh ? 500 : 0); }
    if (!this.nxt) { this.nxt = this.makeBub(game.nxt); this.nxt.born = now + (fresh ? 650 : 120); }
    this.placeLauncher();
  }

  /** the shot and next bubbles trade places */
  swap(game: Game) {
    const a = this.cur, b = this.nxt;
    this.game = game;
    if (a && b) {
      this.cur = b; this.nxt = a;
      const pa = a.g.position.clone(), pb = b.g.position.clone();
      this.fly(b.g, pb, pa, 220, () => {}, false);
      this.fly(a.g, pa, pb, 220, () => {}, false);
      setTimeout(() => this.placeLauncher(), 240);
    } else this.loadLauncher(game, false);
    this.kick();
  }

  // ------------------------------------------------------------ aiming
  private angleAt(e: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const l = this.launcherScreen();
    if (py > l.y - this.s * 0.9) return null;
    const a = Math.atan2(px - l.x, l.y - py);
    return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));
  }
  private onLauncher(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const l = this.launcherScreen(), n = this.nextScreen();
    return Math.hypot(px - l.x, py - l.y) < this.s * 1.4 || Math.hypot(px - n.x, py - n.y) < this.s * 1.3;
  }
  private onDown = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canAim()) return;
    if (this.onLauncher(e)) { this.hooks.swap(); return; }
    this.down = true;
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
    this.setAim(this.angleAt(e));
  };
  private onMove = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canAim()) { if (this.aimAngle !== null) this.setAim(null); return; }
    if (this.down || e.pointerType === "mouse") this.setAim(this.angleAt(e));
  };
  private onUp = (e: PointerEvent) => {
    const was = this.down; this.down = false;
    if (this.busy || !this.hooks.canAim()) return;
    if (!was && e.pointerType !== "mouse") return;
    const a = this.angleAt(e);
    this.setAim(null);
    if (a !== null && (was || e.pointerType === "mouse")) this.hooks.shoot(a);
  };
  private onCancel = () => { this.down = false; this.setAim(null); };
  private onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") this.setAim(null); };

  private setAim(a: number | null) {
    this.aimAngle = a;
    if (a === null || !this.game) { this.aimDots.count = 0; this.ghost.visible = false; this.kick(); return; }
    const f = fly(this.game.grid, a);
    // dots every ~0.95 units along the path
    const m = new THREE.Matrix4();
    let n = 0, carry = 0.4;
    for (let i = 1; i < f.path.length && n < 80; i++) {
      const [x0, y0] = f.path[i - 1], [x1, y1] = f.path[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = carry; d < len && n < 80; d += 0.95) {
        const t = d / len, p = this.wp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, this.s * 0.2);
        const sc = this.s * (1 - n * 0.006);
        m.makeScale(sc, sc, sc).setPosition(p);
        this.aimDots.setMatrixAt(n++, m);
        carry = d + 0.95 - len;
      }
    }
    this.aimDots.count = n;
    this.aimDots.instanceMatrix.needsUpdate = true;
    const k = this.game.cur;
    (this.mats.dot as THREE.MeshBasicMaterial).color.set(isColour(k) ? BUBBLE_COLOURS[(k - 1) % 6] : k === BOMB_SHOT ? "#ff7a3a" : "#ffffff").lerp(new THREE.Color("#ffffff"), 0.15);
    if (f.cell) { this.ghost.visible = true; this.ghost.position.copy(this.cellW(f.cell[0], f.cell[1])); this.ghost.position.z = this.s * 0.3; this.ghost.scale.setScalar(this.s); (this.mats.ghost as THREE.MeshBasicMaterial).color.copy((this.mats.dot as THREE.MeshBasicMaterial).color); }
    else this.ghost.visible = false;
    this.kick();
  }

  // ------------------------------------------------------------ a shot
  private fly(g: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, dur: number, done: () => void, grow = false) {
    this.flyers.push({ g: g as THREE.Group, from: from.clone(), to: to.clone(), t0: performance.now(), dur, done, grow });
    this.kick();
  }
  private wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

  /** animate a shot that the game has already applied; resolves when everything has landed */
  async play(res: ShotResult, game: Game): Promise<void> {
    this.busy = true;
    this.setAim(null);
    const shot = this.cur;
    this.cur = null;
    const b = shot ?? this.makeBub(res.k);
    if (shot) b.g.scale.setScalar(this.s);
    // fly along the path
    const pts = res.flight.path.map(([x, y]) => this.wp(x, y));
    const speed = this.s * 70; // px per second
    // one continuous flight along the whole path at a steady speed: the bubble glances off the walls without stopping
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    await new Promise<void>((done) => {
      this.flyers.push({ g: b.g, from: pts[0], to: pts[pts.length - 1], t0: performance.now(), dur: Math.max(60, (cum[cum.length - 1] / speed) * 1000), done, path: pts, cum, passed: 1,
        onPass: (i) => { if (i >= pts.length - 1) return; this.hooks.sound("bounce", this.pan(res.flight.path[i][0])); this.burst(pts[i], "#ffffff", 7, 0.6); b.g.scale.set(this.s * 0.82, this.s * 1.14, this.s); } });
      this.kick();
    });
    const out = res.out;
    if (!res.flight.cell || !out) { this.freeBub(b); this.sync(game); this.busy = false; return; }
    const [r, c] = res.flight.cell;
    const at = this.cellW(r, c);
    await new Promise<void>((rs) => this.fly(b.g, b.g.position, at, 70, rs));
    b.r = r; b.c = c; b.born = performance.now() - 1000;
    // a rainbow shot turns into the colour it matched
    let k = res.k;
    if (k === RAINBOW) {
      const after = game.grid[r]?.[c]?.k;
      const popCol = out.popped.map(([a, q]) => this.bubs.get(a * 16 + q)?.k).find((x) => x !== undefined && isColour(x));
      k = after ?? popCol ?? 1;
      this.freeBub(b);
      const nb = this.makeBub(k); nb.r = r; nb.c = c; nb.g.position.copy(at);
      this.bubs.set(r * 16 + c, nb);
      this.burst(at, "#ffffff", 16, 1);
    } else this.bubs.set(r * 16 + c, b);
    const hitB = this.bubs.get(r * 16 + c)!;
    hitB.g.scale.set(this.s * 1.18, this.s * 0.84, this.s);
    hitB.vel.set(0, 0);
    // ripple through the neighbours
    for (const o of this.bubs.values()) {
      if (o === hitB) continue;
      const d = o.g.position.distanceTo(at) / this.s;
      if (d > 4.2) continue;
      const dir = new THREE.Vector2(o.g.position.x - at.x, o.g.position.y - at.y).normalize();
      o.vel.addScaledVector(dir, (4.6 - d) * this.s * 1.4);
    }
    this.hooks.sound(k === BOMB_SHOT ? "blast" : "stick", this.pan(cx(r, c)));
    await this.wait(90);

    // pops, nearest first
    const popped = out.popped.slice().sort((p, q) => Math.hypot(cx(p[0], p[1]) - cx(r, c), cy(p[0]) - cy(r)) - Math.hypot(cx(q[0], q[1]) - cx(r, c), cy(q[0]) - cy(r)));
    const freedSet = new Set(out.freed.map(([a, q]) => a * 16 + q));
    const sproutPos: THREE.Vector3[] = [];
    let pi = 0;
    for (const [a, q] of popped) {
      const id = a * 16 + q, pb = this.bubs.get(id);
      if (!pb) continue;
      this.bubs.delete(id);
      if (freedSet.has(id)) sproutPos.push(pb.g.position.clone());
      const col = pb.k === STONE ? "#b8b2aa" : pb.k === BOMB || pb.k === BOMB_SHOT ? "#ff8a3a" : isColour(pb.k) ? BUBBLE_COLOURS[(pb.k - 1) % 6] : "#ffffff";
      const delay = pi * 38;
      const n = pi++;
      setTimeout(() => {
        this.dying.push({ b: pb, t0: performance.now(), kind: "pop", v: new THREE.Vector3(), spin: new THREE.Vector3() });
        this.burst(pb.g.position, col, pb.k === BOMB ? 30 : 13, pb.k === BOMB ? 1.8 : 1);
        this.burst(pb.g.position, "#ffffff", 4, 0.6);
        this.hooks.sound(pb.k === BOMB ? "blast" : pb.k === STONE ? "stone" : "pop", this.pan(cx(a, q)), n);
        if (pb.sprout) this.hooks.sound("sprout", this.pan(cx(a, q)));
        this.kick();
      }, delay);
    }
    // ice that thawed
    for (const [a, q] of out.thawed) {
      const tb = this.bubs.get(a * 16 + q);
      if (tb?.ice) { const ice = tb.ice; setTimeout(() => { tb.g.remove(ice); this.burst(tb.g.position, "#d8f4ff", 12, 1.1); }, 120 + pi * 38); tb.ice = undefined; }
    }
    if (out.thawed.length) setTimeout(() => this.hooks.sound("thaw", this.pan(cx(out.thawed[0][0], out.thawed[0][1]))), 140 + pi * 38);
    if (out.popped.length && res.gained) setTimeout(() => { const p = this.screen(at); this.hooks.float(p.x, p.y - this.s, `+${res.gained}`, res.gained >= 300); }, 120 + pi * 38);
    await this.wait(60 + pi * 38);

    // cut-off bubbles fall
    if (out.fallen.length) {
      for (const [a, q] of out.fallen) {
        const id = a * 16 + q, fb = this.bubs.get(id);
        if (!fb) continue;
        this.bubs.delete(id);
        if (freedSet.has(id)) sproutPos.push(fb.g.position.clone());
        this.dying.push({ b: fb, t0: performance.now() + Math.random() * 60, kind: "fall", v: new THREE.Vector3((Math.random() - 0.5) * this.s * 8, this.s * (3 + Math.random() * 5), 0), spin: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3) });
      }
      this.hooks.sound("fall", this.pan(cx(out.fallen[0][0], out.fallen[0][1])), out.fallen.length);
    }
    // freed seedlings grow and fly up to the counter
    const goal = this.hooks.goal();
    const gw = new THREE.Vector3(goal.x - this.W / 2, this.H / 2 - goal.y, this.s * 2);
    sproutPos.forEach((p, i) => {
      const sp = this.seedling(); sp.scale.setScalar(this.s * 0.8); sp.position.copy(p); sp.position.z = this.s * 1.5;
      this.board.add(sp);
      setTimeout(() => this.fly(sp, sp.position, gw, 760, () => { this.board.remove(sp); this.burst(gw, "#b8ff7a", 14, 1); this.hooks.sound("sprout", 0, i + 1); }, true), 120 + i * 110);
    });
    this.kick();
    await this.wait(Math.max(120, sproutPos.length ? 880 + sproutPos.length * 110 : 0));
    // reload
    this.game = game;
    if (this.nxt && this.nxt.k === game.cur) { this.cur = this.nxt; this.nxt = null; const from = this.cur.g.position.clone(); this.fly(this.cur.g, from, this.wp(W / 2, LAUNCH_Y), 180, () => this.placeLauncher()); }
    this.loadLauncher(game, false);
    this.hooks.sound("load", 0);
    await this.wait(200);
    this.sync(game);
    this.busy = false;
    this.kick();
  }

  /** leftover shots go up as fireworks, one by one */
  async celebrate(n: number, onEach?: (i: number) => void) {
    this.busy = true;
    const count = Math.min(n, 15);
    for (let i = 0; i < count; i++) {
      const k = 1 + (i % 6);
      const b = this.makeBub(k);
      const from = this.wp(W / 2, LAUNCH_Y), to = this.wp(2 + Math.random() * (W - 4), 2 + Math.random() * 9);
      b.g.position.copy(from);
      b.g.scale.setScalar(this.s * 0.7);
      this.fly(b.g, from, to, 420, () => {
        this.freeBub(b);
        this.burst(to, BUBBLE_COLOURS[(k - 1) % 6], 34, 2.2);
        this.burst(to, "#ffffff", 10, 1.4);
        this.hooks.sound("firework", this.pan(((to.x + this.W / 2 - this.ox) / this.s)), i);
        onEach?.(i);
      });
      await this.wait(170);
    }
    if (this.cur) { this.freeBub(this.cur); this.cur = null; }
    await this.wait(500);
  }

  /** the board jolts (lost) */
  jolt() { this.shake = performance.now(); this.kick(); }

  // ------------------------------------------------------------ particles
  private burst(at: THREE.Vector3, col: string, n: number, power: number) {
    const c = new THREE.Color(col);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = this.s * (4 + Math.random() * 7) * power;
      this.parts.push({ p: new THREE.Vector3(at.x, at.y, this.s * 1.2), v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + this.s * 3, 0), life: 0.6 + Math.random() * 0.4, max: 1, c: c.clone().lerp(new THREE.Color(1, 1, 1), Math.random() * 0.3), g: this.s * 26 });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    this.kick();
  }

  // ------------------------------------------------------------ loop
  kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } };
  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, s = this.s;
    // bubbles: appear, breathe, ripple springs
    for (const b of this.bubs.values()) {
      const home = this.cellW(b.r, b.c);
      const k = Math.min(1, Math.max(0, (now - b.born) / 380));
      const pop = k < 1 ? easeBack(k) : 1;
      b.vel.addScaledVector(b.off, -170 * dt); b.vel.multiplyScalar(Math.max(0, 1 - 9 * dt));
      b.off.addScaledVector(b.vel, dt);
      if (b.off.length() > s * 0.6) b.off.setLength(s * 0.6);
      const sq = b.g.scale.y / Math.max(0.001, b.g.scale.x);
      const breathe = 1 + Math.sin(t * 2 + b.ph) * 0.012;
      if (Math.abs(sq - 1) > 0.01 && k >= 1) { b.g.scale.x += (s - b.g.scale.x) * Math.min(1, dt * 14); b.g.scale.y += (s - b.g.scale.y) * Math.min(1, dt * 14); }
      else b.g.scale.setScalar(s * pop * breathe);
      b.g.position.set(home.x + b.off.x, home.y + b.off.y + (k < 1 ? (1 - k) * s * 1.5 : 0), 0);
      if (b.sprout) { b.sprout.rotation.z = Math.sin(t * 1.8 + b.ph) * 0.12; }
      if (b.k === BOMB) { const sp = b.core.getObjectByName("spark"); if (sp) sp.scale.setScalar(0.8 + Math.random() * 0.8); (b.core.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.15 + Math.sin(t * 6) * 0.12; }
      if (b.ice) b.ice.rotation.y = t * 0.2 + b.ph;
    }
    for (const b of [this.cur, this.nxt]) {
      if (!b) continue;
      const k = Math.min(1, Math.max(0, (now - b.born) / 300));
      const base = b === this.cur ? s : s * 0.72;
      if (!this.flyers.some((f) => f.g === b.g)) b.g.scale.setScalar(base * (k < 1 ? easeBack(k) : 1 + Math.sin(t * 3) * 0.02));
      if (b.k === RAINBOW) b.core.rotation.y = t * 2;
      if (b.k === BOMB_SHOT) { const sp = b.core.getObjectByName("spark"); if (sp) sp.scale.setScalar(0.8 + Math.random() * 0.8); }
    }
    // the pod's petals sway
    this.pod.children.forEach((p, i) => { if (p.userData.a !== undefined) p.rotation.z = (p.userData.a as number) - Math.PI / 2 + Math.sin(t * 1.5 + i) * 0.06; });
    // flyers
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      const k = Math.min(1, Math.max(0, (now - f.t0) / f.dur));
      if (f.grow) {
        const e = easeInOut(k);
        f.g.position.lerpVectors(f.from, f.to, e);
        f.g.position.x += Math.sin(k * Math.PI) * s * 2.5 * (f.from.x < f.to.x ? -1 : 1);
        f.g.scale.setScalar(s * (0.8 + Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.9 - k * k * 0.6));
        f.g.rotation.z = Math.sin(k * 10) * 0.2;
      } else if (f.path && f.cum) {
        // along the path: find the piece we're on, and fire each wall bounce as we pass it
        const total = f.cum[f.cum.length - 1], d = total * k;
        while (f.passed! < f.cum.length - 1 && d >= f.cum[f.passed!]) { f.onPass?.(f.passed!); f.passed!++; }
        let j = 1; while (j < f.cum.length - 1 && d > f.cum[j]) j++;
        const seg = f.cum[j] - f.cum[j - 1] || 1;
        f.g.position.lerpVectors(f.path[j - 1], f.path[j], (d - f.cum[j - 1]) / seg);
        // a quick squash off the wall springs back to round
        f.g.scale.x += (s - f.g.scale.x) * Math.min(1, dt * 18); f.g.scale.y += (s - f.g.scale.y) * Math.min(1, dt * 18);
      } else f.g.position.lerpVectors(f.from, f.to, k);
      if (k >= 1) { this.flyers.splice(i, 1); f.done(); }
    }
    // dying bubbles
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      const age = (now - d.t0) / 1000;
      if (age < 0) continue;
      if (d.kind === "pop") {
        const k = Math.min(1, age / 0.14);
        d.b.g.scale.setScalar(s * (1 + k * 0.35));
        d.b.g.visible = k < 1;
        if (k >= 1) { this.freeBub(d.b); this.dying.splice(i, 1); }
      } else {
        d.v.y -= s * 60 * dt;
        d.b.g.position.addScaledVector(d.v, dt);
        d.b.g.rotation.x += d.spin.x * dt; d.b.g.rotation.y += d.spin.y * dt; d.b.g.rotation.z += d.spin.z * dt;
        if (d.b.g.position.y < -this.H / 2 + this.oy * 0 + s * 0.5 && d.v.y < 0 && !d.b.g.userData.bounced) {
          d.b.g.userData.bounced = true; d.v.y = -d.v.y * 0.35; this.burst(d.b.g.position, isColour(d.b.k) ? BUBBLE_COLOURS[(d.b.k - 1) % 6] : "#ffffff", 8, 0.8);
        }
        if (d.b.g.position.y < -this.H / 2 - s * 3 || age > 2.4) { this.freeBub(d.b); this.dying.splice(i, 1); }
      }
    }
    // the danger line glows when bubbles get close
    let low = -1;
    for (const b of this.bubs.values()) low = Math.max(low, b.r);
    const near = low >= MAX_ROWS - 3;
    const dm = this.mats.danger as THREE.MeshBasicMaterial;
    dm.opacity = near ? 0.55 + Math.sin(t * 8) * 0.3 : 0.28;
    dm.color.set(near ? "#ff4f5f" : this.garden?.id === "moonflower" ? "#a8f0ff" : "#ffffff");
    // aim dots march
    if (this.aimDots.count) (this.mats.dot as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(t * 9) * 0.2;
    // shake
    if (this.shake) { const k = (now - this.shake) / 500; if (k >= 1) { this.shake = 0; this.board.position.set(0, 0, 0); } else this.board.position.set(Math.sin(k * 40) * s * 0.4 * (1 - k), 0, 0); }
    // particles
    const pa = this.ptsGeo.getAttribute("position") as THREE.BufferAttribute, ca = this.ptsGeo.getAttribute("color") as THREE.BufferAttribute;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt; p.v.y -= p.g * dt; p.v.multiplyScalar(1 - 1.5 * dt); p.p.addScaledVector(p.v, dt);
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (n < 600) { const a = Math.min(1, p.life * 2); pa.setXYZ(n, p.p.x, p.p.y, p.p.z); ca.setXYZ(n, p.c.r * a, p.c.g * a, p.c.b * a); n++; }
    }
    this.ptsGeo.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
    (this.pts.material as THREE.PointsMaterial).size = Math.max(8, s * 0.62);
    this.renderer.render(this.scene, this.camera);
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.onDown); c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp); c.removeEventListener("pointercancel", this.onCancel); c.removeEventListener("pointerleave", this.onLeave);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    [...this.solid, ...this.glass, ...Object.values(this.mats)].forEach((m) => m.dispose());
    Object.values(this.geo).forEach((g) => g.dispose());
    this.scene.environment?.dispose(); this.pmrem.dispose();
    (this.pts.material as THREE.PointsMaterial).map?.dispose(); (this.pts.material as THREE.Material).dispose();
    this.renderer.dispose(); c.remove();
  }
}

/** which grid width shows for the HUD (re-exported for the app) */
export const GRID_COLS = COLS;
export type { Grid };

const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6);
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dropTex() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}
function rainbowTex() {
  return canvasTex(256, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 256, 0);
    BUBBLE_COLOURS.concat(BUBBLE_COLOURS[0]).forEach((c, i) => gr.addColorStop(i / 6, c));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
  });
}
