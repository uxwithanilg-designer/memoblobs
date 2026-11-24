// The Bubble Relics temple in 3D (three.js). A torch-lit stone chamber: a brick wall fading into the dark, a stone
// floor running away from you, carved pillars with flickering torches (real point lights), vines over the top beam.
// Glossy candy bubbles hang from the beam; some carry a golden relic gem. Aim from the stone launcher ring (drag on
// touch, move on desktop): a glowing laser guide shows the whole flight, wall bounces included, and a ring marks where
// the bubble will stick. Shots fly, bounce and stick with a squash and a ripple; groups pop into droplets one after
// another, cut-off bubbles tumble down, crystal ice cracks, bombs blast, and relics fly to the counter. When the wall
// is clear the stones crumble and the leftover shots go up as fireworks. Layout is in CSS pixels on the z = 0 plane
// (one world unit = one pixel there); grid units (bubble radius 1) are scaled by `s`.
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BOMB, BOMB_SHOT, COLS, LAUNCH_Y, MAX_ROWS, RAINBOW, STONE, W, cx, cy, fly, isColour, type Grid } from "../../sprout/grid";
import type { Game, ShotResult } from "../play";
import type { Realm } from "../stage";
import { buildSet, type SetHandle } from "./sets";

export type SceneSound = "bounce" | "stick" | "pop" | "blast" | "thaw" | "fall" | "relic" | "firework" | "swap" | "load" | "stone" | "crumble";
export interface RelicHooks {
  shoot: (angle: number) => void;
  swap: () => void;
  canAim: () => boolean;
  /** where collected relics fly to (CSS px in the canvas) */
  goal: () => { x: number; y: number };
  sound: (e: SceneSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

export const BUBBLE_COLOURS = ["#ff2a3d", "#ffd31a", "#22a6ff", "#36cf4a", "#b24dff", "#ff7a14"];
const MAX_ANGLE = 1.36;

interface Bub { g: THREE.Group; k: number; core: THREE.Mesh; ice?: THREE.Mesh; sprout?: THREE.Group; r: number; c: number; off: THREE.Vector2; vel: THREE.Vector2; born: number; ph: number }
interface Dying { b: Bub; t0: number; kind: "pop" | "fall"; v: THREE.Vector3; spin: THREE.Vector3 }
interface Flyer { g: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; done: () => void; grow?: boolean; path?: THREE.Vector3[]; cum?: number[]; passed?: number; onPass?: (i: number) => void }
interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; c: THREE.Color; g: number }

export class RelicScene {
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
  private geo = { sphere: new THREE.SphereGeometry(0.94, 30, 20), stone: new THREE.DodecahedronGeometry(0.9, 0), ice: new THREE.IcosahedronGeometry(1.04, 1), dot: new THREE.SphereGeometry(0.21, 10, 8), ring: new THREE.TorusGeometry(0.92, 0.07, 8, 40), gem: new THREE.OctahedronGeometry(1, 0), stem: new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), leaf: new THREE.SphereGeometry(1, 14, 10), fuse: new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), petal: new THREE.SphereGeometry(1, 18, 12) };
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
  private realm: Realm | null = null;
  private setH: SetHandle | null = null;
  private setArgs: { stage: number; realm: Realm } | null = null;
  private torches: { light: THREE.PointLight; flame: THREE.Sprite; glow: THREE.Sprite; ph: number }[] = [];
  private beam: THREE.InstancedMesh;
  private shotTex: THREE.CanvasTexture | null = null;
  private shotSprite: THREE.Sprite;
  private shotsN = -1;
  private wallTex: THREE.CanvasTexture; private floorTex: THREE.CanvasTexture;
  private pmrem: THREE.PMREMGenerator;
  private down = false;

  constructor(private el: HTMLElement, private hooks: RelicHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(autoQuality()), alpha: true, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(autoQuality()));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none" });
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0x302030, 0.75));
    const sun = new THREE.DirectionalLight(0xfff4e8, 1.5); sun.position.set(-300, 600, 800); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffe0f4, 0.6); rim.position.set(400, -200, 300); this.scene.add(rim);
    this.scene.add(this.board);
    this.board.add(this.frame, this.pod);

    BUBBLE_COLOURS.forEach((c) => {
      this.solid.push(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.12, iridescenceIOR: 1.3, sheen: 0.25, sheenColor: new THREE.Color("#ffffff"), envMapIntensity: 1.15 }));
      this.glass.push(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.6, iridescenceIOR: 1.3, transparent: true, opacity: 0.6, depthWrite: false, envMapIntensity: 1.3 }));
    });
    this.wallTex = brickTex(); this.floorTex = floorTex();
    this.mats = {
      wall: new THREE.MeshStandardMaterial({ map: this.wallTex, color: "#7a6a62", roughness: 0.92 }),
      floor: new THREE.MeshStandardMaterial({ map: this.floorTex, color: "#6a5a52", roughness: 0.85 }),
      pillar: new THREE.MeshStandardMaterial({ color: "#8a7a6a", roughness: 0.8 }),
      gold: new THREE.MeshPhysicalMaterial({ color: "#ffcf3a", metalness: 0.9, roughness: 0.22, clearcoat: 1, emissive: "#7a4a00", emissiveIntensity: 0.35 }),
      ring: new THREE.MeshPhysicalMaterial({ color: "#d9b25a", metalness: 0.85, roughness: 0.3, clearcoat: 0.6 }),
      ringStone: new THREE.MeshStandardMaterial({ color: "#5a4e48", roughness: 0.75 }),
      beamCore: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      stone: new THREE.MeshStandardMaterial({ color: "#8d8a86", roughness: 0.9, flatShading: true }),
      bomb: new THREE.MeshPhysicalMaterial({ color: "#2b2440", roughness: 0.3, clearcoat: 1, emissive: "#ff3b3b", emissiveIntensity: 0 }),
      fuse: new THREE.MeshStandardMaterial({ color: "#d9b37a", roughness: 0.8 }),
      ice: new THREE.MeshPhysicalMaterial({ color: "#dff6ff", roughness: 0.05, transparent: true, opacity: 0.55, flatShading: true, clearcoat: 1, emissive: "#6cc4ff", emissiveIntensity: 0.18, depthWrite: false }),
      stem: new THREE.MeshStandardMaterial({ color: "#3e9a3a", roughness: 0.6 }),
      leaf: new THREE.MeshPhysicalMaterial({ color: "#6fe05a", roughness: 0.35, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#eaffd0") }),
      rainbow: new THREE.MeshPhysicalMaterial({ map: rainbowTex(), roughness: 0.15, clearcoat: 1, iridescence: 1, emissive: "#ffffff", emissiveIntensity: 0.08 }),
      dot: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
      ghost: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthWrite: false }),
      danger: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false }),
      vine: new THREE.MeshStandardMaterial({ color: "#4f8a3a", roughness: 0.7 }),
    };
    this.aimDots = new THREE.InstancedMesh(this.geo.dot, this.mats.dot, 360);
    this.beam = new THREE.InstancedMesh(this.geo.dot, this.mats.beamCore, 360);
    this.beam.count = 0; this.beam.renderOrder = 6; this.beam.frustumCulled = false;
    this.shotSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.shotSprite.renderOrder = 30;
    this.aimDots.count = 0; this.aimDots.renderOrder = 5; this.aimDots.frustumCulled = false;
    this.ghost = new THREE.Mesh(this.geo.ring, this.mats.ghost); this.ghost.visible = false; this.ghost.renderOrder = 5;
    this.danger = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mats.danger);
    this.board.add(this.aimDots, this.beam, this.ghost, this.danger, this.shotSprite);

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
    this.rebuildSet();
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
  nextScreen() { return this.screen(this.wp(W / 2 + 3.4, LAUNCH_Y + 0.9)); }
  /** CSS px of a grid cell (QA hooks) */
  cellScreen(r: number, c: number) { return this.screen(this.cellW(r, c)); }

  private buildFrame() {
    this.frame.children.slice().forEach((o) => { this.frame.remove(o); const m = o as THREE.Mesh; if (m.geometry && !Object.values(this.geo).includes(m.geometry as never)) m.geometry.dispose(); if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.dispose(); });
    this.frame.traverse(() => undefined);
    this.torches.forEach((t) => this.frame.remove(t.light));
    this.torches = [];
    const s = this.s;
    const top = this.wp(0, 0), lp = this.wp(W / 2, LAUNCH_Y);
    // the stone beam on top, wrapped in vines with leaves
    const pw = W * s + s * 3.4;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(pw, s * 0.9, s * 1.4), this.mats.pillar);
    beam.position.set(0 + (top.x + this.wp(W, 0).x) / 2 - 0, top.y + s * 0.6, -s * 1.0);
    this.frame.add(beam);
    const vine = new THREE.Mesh(new THREE.TorusGeometry(pw / 2, s * 0.13, 6, 60, Math.PI), this.mats.vine);
    vine.scale.set(1, 0.06, 1); vine.rotation.z = Math.PI; vine.position.set(beam.position.x, top.y + s * 0.55, -s * 0.2);
    this.frame.add(vine);
    for (let i = 0; i < 16; i++) {
      const lf = new THREE.Mesh(this.geo.leaf, this.mats.leaf);
      lf.scale.set(s * 0.38, s * 0.15, s * 0.18);
      lf.position.set(beam.position.x - pw / 2 + (i + 0.5) * (pw / 16), top.y + s * (0.15 + (i % 3) * 0.18), -s * 0.1);
      lf.rotation.z = (i % 2 ? 0.8 : -0.8) + (i % 3) * 0.3;
      this.frame.add(lf);
    }
    // the danger line (a faint rune line on the floor of the wall)
    const dl = this.wp(W / 2, cy(MAX_ROWS) - 1.05);
    this.danger.scale.set(W * s, Math.max(2, s * 0.08), 1);
    this.danger.position.set(dl.x, dl.y, -s * 0.5);
    // the launcher: a golden ring set in a stone disc, the shot count under the bubble
    this.pod.children.slice().forEach((o) => this.pod.remove(o));
    this.pod.position.set(lp.x, lp.y, -s * 0.9);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.75, s * 1.95, s * 0.6, 40), this.mats.ringStone);
    disc.rotation.x = Math.PI / 2; disc.position.z = -s * 0.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 1.45, s * 0.16, 12, 48), this.mats.ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(s * 1.18, s * 0.06, 8, 48), this.mats.gold);
    ring2.userData.spin = 1;
    this.pod.add(disc, ring, ring2);
    const np = this.wp(W / 2 + 3.4, LAUNCH_Y + 0.9, -s * 0.6);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(s * 0.9, s * 0.1, 8, 32), this.mats.ring); pad.position.copy(np.sub(this.pod.position));
    this.pod.add(pad);
    this.shotSprite.scale.set(s * 2.6, s * 1.3, 1);
    this.shotSprite.position.copy(this.wp(W / 2, LAUNCH_Y + 1.45, s * 1.4));
  }

  /** the shots-left number on the launcher */
  setShots(n: number) {
    if (n === this.shotsN) return;
    this.shotsN = n;
    this.shotTex?.dispose();
    this.shotTex = numTex(n);
    this.shotSprite.material.map = this.shotTex; this.shotSprite.material.needsUpdate = true;
    this.kick();
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
    if (sprout) { b.sprout = this.seedling(); b.sprout.scale.setScalar(1.1); b.sprout.position.set(0, 0, 0.1); g.add(b.sprout); }
    if (ice) { b.ice = new THREE.Mesh(this.geo.ice, this.mats.ice); b.ice.renderOrder = 4; b.ice.rotation.set(0.4, 0.3, 0); g.add(b.ice); }
    g.scale.setScalar(this.s);
    this.board.add(g);
    return b;
  }
  private seedling() {
    // a golden relic: a faceted gem with a little halo
    const sp = new THREE.Group();
    const gem = new THREE.Mesh(this.geo.gem, this.mats.gold); gem.scale.set(0.42, 0.55, 0.42); gem.name = "gem";
    sp.add(gem);
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
    if (this.nxt) { this.nxt.g.position.copy(this.wp(W / 2 + 3.4, LAUNCH_Y + 0.9)); this.nxt.g.scale.setScalar(this.s * 0.72); }
  }

  /** the 3D set behind the wall: built from the chamber and the stage number, so every stage stands somewhere new */
  setSet(stage: number, realm: Realm) {
    this.setArgs = { stage, realm };
    this.setRealm(realm);
    this.rebuildSet();
  }
  private rebuildSet() {
    if (this.setH) { this.scene.remove(this.setH.group); this.setH.dispose(); this.setH = null; }
    if (!this.setArgs) return;
    this.setH = buildSet({ ...this.setArgs, W: this.W, H: this.H, s: this.s });
    this.scene.add(this.setH.group);
    this.scene.fog = this.setH.fog;
    this.kick();
  }

  setRealm(r: Realm) {
    this.realm = r;
    (this.mats.wall as THREE.MeshStandardMaterial).color.set(r.stone).multiplyScalar(0.85);
    (this.mats.floor as THREE.MeshStandardMaterial).color.set(r.stone).multiplyScalar(0.7);
    (this.mats.pillar as THREE.MeshStandardMaterial).color.set(r.stone).lerp(new THREE.Color("#ffffff"), 0.12);
    (this.mats.vine as THREE.MeshStandardMaterial).color.set(r.id === "crystal" || r.id === "moon" ? "#3a6a5a" : r.id === "dragon" ? "#5a6a2a" : "#3f7a32");
    this.torches.forEach((t) => { t.light.color.set(r.glow); t.flame.material.color.set(r.glow); t.glow.material.color.set(r.glow); });
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
    if (a === null || !this.game) { this.aimDots.count = 0; this.beam.count = 0; this.ghost.visible = false; this.kick(); return; }
    const f = fly(this.game.grid, a);
    // the laser: dense beads every 0.2 units — a soft coloured glow around a bright core
    const m = new THREE.Matrix4();
    let n = 0, carry = 0.2;
    const step = 0.2;
    for (let i = 1; i < f.path.length && n < 360; i++) {
      const [x0, y0] = f.path[i - 1], [x1, y1] = f.path[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = carry; d < len && n < 360; d += step) {
        const t = d / len, p = this.wp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, this.s * 0.2);
        m.makeScale(this.s * 0.9, this.s * 0.9, this.s * 0.9).setPosition(p);
        this.aimDots.setMatrixAt(n, m);
        m.makeScale(this.s * 0.38, this.s * 0.38, this.s * 0.38).setPosition(p);
        this.beam.setMatrixAt(n, m);
        n++;
        carry = d + step - len;
      }
    }
    this.aimDots.count = n; this.beam.count = n;
    this.aimDots.instanceMatrix.needsUpdate = true; this.beam.instanceMatrix.needsUpdate = true;
    const k = this.game.cur;
    (this.mats.dot as THREE.MeshBasicMaterial).color.set(isColour(k) ? BUBBLE_COLOURS[(k - 1) % 6] : k === BOMB_SHOT ? "#ff7a3a" : "#ffffff");
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
        if (pb.sprout) this.hooks.sound("relic", this.pan(cx(a, q)));
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
    // relics spin up and fly to the counter
    const goal = this.hooks.goal();
    const gw = new THREE.Vector3(goal.x - this.W / 2, this.H / 2 - goal.y, this.s * 2);
    sproutPos.forEach((p, i) => {
      const sp = this.seedling(); sp.scale.setScalar(this.s * 0.8); sp.position.copy(p); sp.position.z = this.s * 1.5;
      this.board.add(sp);
      setTimeout(() => this.fly(sp, sp.position, gw, 760, () => { this.board.remove(sp); this.burst(gw, "#ffd23f", 16, 1); this.hooks.sound("relic", 0, i + 1); }, true), 120 + i * 110);
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

  /** the wall is clear: the remaining stones crack and tumble down */
  crumble() {
    let i = 0;
    for (const [id, b] of this.bubs) {
      if (b.k !== STONE) continue;
      this.bubs.delete(id);
      const d = i++ * 70;
      setTimeout(() => { this.burst(b.g.position, "#b8ada0", 10, 1); this.dying.push({ b, t0: performance.now(), kind: "fall", v: new THREE.Vector3((Math.random() - 0.5) * this.s * 6, this.s * 4, 0), spin: new THREE.Vector3(3, 2, 4) }); this.hooks.sound("crumble", this.pan(cx(b.r, b.c))); this.kick(); }, d);
    }
    return i * 70 + 300;
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
      if (b.sprout) { b.sprout.rotation.y = t * 1.6 + b.ph; }
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
    this.pod.children.forEach((p) => { if (p.userData.spin) p.rotation.z = t * 0.8; });
    for (const tc of this.torches) {
      const f = 0.85 + Math.sin(t * 13 + tc.ph) * 0.08 + Math.sin(t * 23 + tc.ph * 2) * 0.06 + Math.random() * 0.05;
      tc.light.intensity = 2.2 * f;
      tc.flame.scale.set(s * 1.1 * (0.95 + (f - 0.85) * 0.8), s * 1.7 * f, 1);
      tc.glow.material.opacity = 0.42 + (f - 0.85) * 1.2;
    }
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
    this.setH?.update(t, dt);
    // the danger line glows when bubbles get close
    let low = -1;
    for (const b of this.bubs.values()) low = Math.max(low, b.r);
    const near = low >= MAX_ROWS - 3;
    const dm = this.mats.danger as THREE.MeshBasicMaterial;
    dm.opacity = near ? 0.55 + Math.sin(t * 8) * 0.3 : 0.28;
    dm.color.set(near ? "#ff4f5f" : this.realm?.glow ?? "#ffffff");
    // the laser shimmers
    if (this.aimDots.count) (this.mats.dot as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 14) * 0.08;
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
    this.setH?.dispose(); this.setH = null;
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
    this.wallTex.dispose(); this.floorTex.dispose(); this.shotTex?.dispose(); this.shotSprite.material.dispose();
    this.frame.traverse((o) => { if ((o as THREE.Sprite).isSprite) { (o as THREE.Sprite).material.map?.dispose(); (o as THREE.Sprite).material.dispose(); } });
    this.renderer.dispose(); c.remove();
  }
}

/** which grid width shows for the HUD (re-exported for the app) */
export const GRID_COLS = COLS;
export type { Grid };

const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

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

/** a stone-brick wall, drawn once */
function brickTex() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#8a8078"; g.fillRect(0, 0, 256, 256);
    const rows = 8, bh = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 32 : 0;
      for (let x = -64; x < 256; x += 64) {
        const v = 120 + ((r * 7 + x * 3) % 40);
        g.fillStyle = `rgb(${v},${v - 8},${v - 16})`;
        g.fillRect(x + off + 2, r * bh + 2, 60, bh - 4);
        g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x + off + 2, r * bh + 2, 60, 3);
        g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x + off + 2, r * bh + bh - 6, 60, 4);
      }
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** big flagstones for the floor */
function floorTex() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#5a5048"; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const v = 100 + ((r * 13 + c * 29) % 34);
      g.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
      g.fillRect(c * 64 + 3 + (r % 2) * 10, r * 64 + 3, 58, 58);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function numTex(n: number) {
  return canvasTex(128, 64, (g) => {
    g.font = "bold 46px 'Lilita One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 8; g.strokeStyle = "rgba(40,20,10,.85)"; g.strokeText(String(n), 64, 34);
    g.fillStyle = n <= 3 ? "#ff5a4a" : "#fff4d6"; g.fillText(String(n), 64, 34);
  });
}
