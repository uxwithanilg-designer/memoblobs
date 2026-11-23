// Momo Escape 3D renderer (three.js). Every floor is built from glossy rounded toy blocks in the building's ink colours
// on a tiled back wall with real shadows; Momo (or the chosen roller) is a rigged clay toy that squashes, stretches,
// blinks and looks where he dashes; coins spin, gems sparkle, and every trap is a 3D object driven by the same hazard
// maths as the game. Screen-wide effects (lights out, fog, alarm, strobe, speed streaks, flashes, the building stamp) are
// drawn on a thin 2D overlay. Mirror / upside-down / tilted floors transform the 3D canvas itself.
import * as THREE from "three";
import { antialiasFor, autoQuality as sharedAutoQuality, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tint } from "../crowd/models";
import { buildingOf, type Building } from "./data/buildings";
import { crushK, crushSoon, floodY, laserOn, laserSeg, laserSoon, moverPos, pulseState, shots, spikeRect, spikesOn, spikesSoon, turretCharge } from "./hazards";
import type { FrameFx } from "./render";
import type { EscapeSim } from "./sim";
import * as M from "./three/models";
import { COLS, DX, DY, U, type Dir, type Hazard, type Pickup, type Room } from "./types";

export type Quality = "low" | "medium" | "high";

/** what the session needs from a renderer (the 3D one, or the 2D fallback) */
export interface EscapeView {
  readonly cv: HTMLCanvasElement;
  resize(w: number, h: number): void;
  draw(sim: EscapeSim, alpha: number, dt: number, fx: FrameFx): void;
  stamp(text: string): void;
  hit(x: number, y: number, hot: string): void;
  dust(x: number, y: number, g: Dir, n?: number): void;
  sparkle(x: number, y: number, color: string, n?: number, conf?: boolean): void;
  land(): void;
  leap(): void;
  nudge(): void;
  momoAt(): { x: number; y: number } | null;
  dispose(): void;
}

const TAU = Math.PI * 2;
const FONT = "'Lilita One', ui-rounded, system-ui, sans-serif";
/** wall thickness towards the camera (cells); the back wall sits at −DEPTH/2 */
const DEPTH = 1.3, ZF = DEPTH / 2, ZB = -DEPTH / 2;
const cu = (u: number) => u / U;
/** rotation that points a model's −y (feet) along a direction */
const FEET: Record<Dir, number> = { 0: Math.PI, 1: Math.PI / 2, 2: 0, 3: -Math.PI / 2 };
/** rotation that points a model's +y along a direction */
const UPTO: Record<Dir, number> = { 0: 0, 1: -Math.PI / 2, 2: Math.PI, 3: Math.PI / 2 };
const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: THREE.Color; box: boolean; rot: number; vr: number; grav: number }
interface HazView { obj: THREE.Object3D; update(t: number, live: boolean, switched: boolean, time: number): void }
interface Other { p: Pickup; obj: THREE.Object3D }
interface RoomView {
  n: number; room: Room; group: THREE.Group; withCeiling: boolean;
  wallMat: THREE.MeshStandardMaterial; walls: THREE.Mesh; fake: THREE.Mesh | null;
  own: { dispose(): void }[];
  hz: HazView[]; others: Other[];
  doors: THREE.Object3D | null; exitLock: THREE.Object3D | null; inLid: THREE.Object3D;
  conveyor: THREE.Texture | null; portals: THREE.Object3D[];
}

export class EscapeRenderer3D implements EscapeView {
  readonly cv: HTMLCanvasElement;
  private ov: HTMLCanvasElement;
  private og: CanvasRenderingContext2D;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
  private q: Quality;
  private w = 1; private h = 1; private dpr = 1;
  private dist = 30; private viewH = 20;
  private camY = 0; private camInit = false; private shake = 0; private time = 0;
  private keepList: { dispose(): void }[] = [];
  private keep<T extends { dispose(): void }>(x: T): T { this.keepList.push(x); return x; }
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight; private lamp: THREE.PointLight;
  private bg: THREE.Mesh; private bgMat: THREE.MeshBasicMaterial;
  private rooms = new Map<number, RoomView>();
  private bld: Building = buildingOf(1); private bldKey = -1;
  // shared looks
  private clay: THREE.MeshStandardMaterial; private metal: THREE.MeshStandardMaterial; private glossy: THREE.MeshStandardMaterial;
  private tileTex = new Map<number, THREE.Texture>();
  private colMat = new Map<string, THREE.MeshStandardMaterial>();
  private glowMat = new Map<string, THREE.MeshBasicMaterial>();
  private geo: Record<string, THREE.BufferGeometry> = {};
  // pickups drawn in bulk
  private coins: THREE.InstancedMesh; private plates: THREE.InstancedMesh; private gems: THREE.InstancedMesh; private hearts: THREE.InstancedMesh;
  // Momo
  private momo = new THREE.Group(); private body = new THREE.Group();
  private skinMat: THREE.MeshPhysicalMaterial; private faceMat: THREE.MeshStandardMaterial;
  private pupils: THREE.Mesh | null = null; private lids: THREE.Mesh | null = null; private brows: THREE.Mesh | null = null;
  private feet: THREE.Mesh[] = []; private arms: THREE.Mesh[] = []; private sprout: THREE.Mesh | null = null;
  private bubble: THREE.Mesh; private ring: THREE.Mesh;
  private chKey = "";
  private ang = 0; private off = 0; private squash = 0; private blinkT = 2;
  private trail: THREE.InstancedMesh; private trailPts: { x: number; y: number; a: number }[] = [];
  // particles
  private parts: Part[] = []; private dots: THREE.InstancedMesh; private bits: THREE.InstancedMesh;
  // overlay state
  private flash = 0; private flashColor = "#fff";
  private stampT = 0; private stampText = "";
  private momoPt: { x: number; y: number } | null = null;
  private cssKey = "";
  private m4 = new THREE.Matrix4(); private q4 = new THREE.Quaternion(); private v3 = new THREE.Vector3(); private s3 = new THREE.Vector3(); private e3 = new THREE.Euler(); private c3 = new THREE.Color();

  constructor(host: HTMLElement, quality: Quality) {
    this.q = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), alpha: false, powerPreference: "high-performance", stencil: false });
    this.cv = this.renderer.domElement;
    Object.assign(this.cv.style, { display: "block", position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", transformOrigin: "50% 50%" });
    this.cv.setAttribute("aria-label", "Momo Escape game");
    host.appendChild(this.cv);
    this.ov = document.createElement("canvas");
    Object.assign(this.ov.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
    host.appendChild(this.ov);
    this.og = this.ov.getContext("2d")!;
    const R = this.renderer;
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.08;
    R.shadowMap.enabled = true;
    R.shadowMap.type = quality === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(R);
    this.scene.environment = this.keep(pm.fromScene(new RoomEnvironment(), 0.04).texture);
    pm.dispose();

    // light: a soft sky, a warm key light with shadows, a cool fill, and a lantern on Momo for night buildings
    this.hemi = new THREE.HemisphereLight("#FFFFFF", "#8A7FB0", 1.1);
    this.sun = new THREE.DirectionalLight("#FFF4E0", 1.7);
    this.sun.castShadow = true;
    const sm = quality === "high" ? 2048 : quality === "medium" ? 1024 : 768;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.fill = new THREE.DirectionalLight("#CFE4FF", 0.45);
    this.lamp = new THREE.PointLight("#FFD9A0", 0, 7, 1.6);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.lamp);

    // far background: the building's poster word on its paper, moving slower than the tower
    this.bgMat = this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF" }));
    this.bg = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(220, 220)), this.bgMat);
    this.bg.position.set(COLS / 2, 0, -9);
    this.scene.add(this.bg);

    // shared materials
    this.clay = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.55 }));
    this.metal = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.75, envMapIntensity: 1.1 }));
    this.glossy = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.25, envMapIntensity: 1 }));
    // shared shapes
    const G = this.geo;
    G.emitter = M.emitter(); G.saw = M.saw(); G.strip = M.spikeStrip(); G.turret = M.turret(); G.bumper = M.bumper(); G.pad = M.padRing();
    G.grumpy = M.spikeBall("#FF4D6D", "#7B3FE0"); G.grumpyFace = M.grumpyFace(); G.mine = M.spikeBall("#FFFFFF", "#2A2540"); G.mace = M.spikeBall("#C9CED8", "#5A5570");
    const dr = M.drone(); G.drone = dr.body; G.rotor = dr.rotor; G.bot = M.bot(); G.barrel = M.barrel();
    G.key = M.key(); G.bolt = M.bolt(); G.switch = M.switchBox(); G.buddy = M.buddyCage();
    for (const k of ["shield", "ghost", "slowmo", "magnet"]) G["icon_" + k] = M.powerIcon(k);
    G.cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false); G.sphere = new THREE.SphereGeometry(1, 24, 18); G.box = M.rbox(1, 1, 1, 0.12, 3);
    G.lock = this.lockGeo();
    for (const g of Object.values(G)) this.keep(g);

    // bulk pickups
    const coinMat = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.65, emissive: "#6A4200", emissiveIntensity: 0.3, envMapIntensity: 1.2 }));
    this.coins = this.inst(this.keep(M.coin()), coinMat, 260);
    this.plates = this.inst(this.keep(M.coin()), this.keep(new THREE.MeshStandardMaterial({ color: "#7FD8FF", roughness: 0.25, metalness: 0.5, envMapIntensity: 1.1 })), 40);
    this.gems = this.inst(this.keep(M.gem()), this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.15, flatShading: true, emissive: "#3A2A60", emissiveIntensity: 0.25, envMapIntensity: 1.6 })), 40);
    this.hearts = this.inst(this.keep(M.heart()), this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: "#5A0018", emissiveIntensity: 0.25, envMapIntensity: 0.8 })), 20);

    // Momo + his shield bubble and booster ring
    this.skinMat = this.keep(new THREE.MeshPhysicalMaterial({ color: "#FF8A3D", roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.3, envMapIntensity: 0.7 }));
    this.faceMat = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, envMapIntensity: 0.6 }));
    this.momo.add(this.body);
    this.bubble = new THREE.Mesh(G.sphere, this.keep(new THREE.MeshStandardMaterial({ color: "#7AFFEA", transparent: true, opacity: 0.22, roughness: 0.05, emissive: "#3FD8C8", emissiveIntensity: 0.35, depthWrite: false })));
    this.bubble.scale.setScalar(0.56);
    this.ring = new THREE.Mesh(this.keep(new THREE.TorusGeometry(0.5, 0.035, 8, 40)), this.glow("#46D2FF", 0.75));
    this.momo.add(this.bubble, this.ring);
    this.scene.add(this.momo);
    this.trail = this.inst(G.sphere, this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.6, transparent: true, opacity: 0.5, depthWrite: false })), 18, false);
    this.dots = this.inst(G.sphere, this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.5, envMapIntensity: 0.4 })), 340, false);
    this.bits = this.inst(this.keep(new THREE.BoxGeometry(1, 0.5, 0.12)), this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.5 })), 160, false);
    for (const im of [this.dots, this.bits, this.trail]) { const cap = im.instanceMatrix.count; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); im.count = 0; }
  }

  private inst(g: THREE.BufferGeometry, m: THREE.Material, cap: number, shadow = true) {
    const im = new THREE.InstancedMesh(g, m, cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0; im.frustumCulled = false;
    im.castShadow = shadow && true;
    this.scene.add(im);
    this.keep({ dispose: () => im.dispose() });
    return im;
  }
  private col(c: string, o: THREE.MeshStandardMaterialParameters = {}) {
    const k = c + JSON.stringify(o);
    let m = this.colMat.get(k);
    if (!m) { m = this.keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, envMapIntensity: 0.6, ...o })); this.colMat.set(k, m); }
    return m;
  }
  private glow(c: string, opacity = 0.5) {
    const k = c + opacity;
    let m = this.glowMat.get(k);
    if (!m) { m = this.keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); this.glowMat.set(k, m); }
    return m;
  }
  private lockGeo() {
    const p: THREE.BufferGeometry[] = [];
    const body = M.rbox(0.26, 0.2, 0.08, 0.04, 2); body.translate(0, -0.04, 0); p.push(tint(body, "#FFC21A"));
    const shackle = new THREE.TorusGeometry(0.08, 0.025, 8, 16, Math.PI); shackle.translate(0, 0.06, 0); p.push(tint(shackle, "#E6EEF5"));
    const hole = new THREE.CircleGeometry(0.03, 12); hole.translate(0, -0.04, 0.045); p.push(tint(hole, "#1B1530"));
    return mergeGeometries(p.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  }

  // ---------------------------------------------------------------- sizing
  /** lowers the resolution a step if this device can't hold the frame rate (and back up when it can) */
  private gov: FrameGovernor | null = typeof window !== "undefined" ? new FrameGovernor(() => this.resize(this.w, this.h)) : null;
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.dpr = pixelRatioFor(this.q) * (this.gov?.scale ?? 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.ov.width = Math.round(this.w * this.dpr); this.ov.height = Math.round(this.h * this.dpr);
    const aspect = this.w / this.h;
    this.camera.aspect = aspect;
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // the whole width (13 columns + a margin) always fits at the front of the walls; on wide screens ~12.5 rows fit too
    const dW = 13.7 / (2 * tanH * aspect), dH = 12.5 / (2 * tanH);
    this.dist = ZF + (this.h >= this.w ? dW : Math.max(dW, dH));
    this.viewH = 2 * this.dist * tanH;
    this.camera.near = Math.max(0.5, this.dist - 20); this.camera.far = this.dist + 30;
    this.camera.updateProjectionMatrix();
    const s = this.sun.shadow.camera;
    const half = Math.max(this.viewH, 18) / 2 + 4;
    s.left = -half; s.right = half; s.top = half; s.bottom = -half; s.near = 0.5; s.far = 80;
    s.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- effects API (positions in sim units)
  stamp(text: string) { this.stampText = text; this.stampT = 2.4; }
  hit(x: number, y: number, hot: string) {
    this.shake = Math.max(this.shake, 1);
    this.flash = 0.3; this.flashColor = hot;
    const c1 = new THREE.Color(hot), c2 = new THREE.Color(this.bld.inks.shade);
    for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, s = 0.04 + Math.random() * 0.12; this.part(cu(x), cu(y), 0.2, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.3) * 0.12, 0.6 + Math.random() * 0.5, 0.05 + Math.random() * 0.07, i % 3 ? c1 : c2, i % 4 === 0); }
  }
  dust(x: number, y: number, g: Dir, n = 6) {
    const nx = -DX[g], ny = -DY[g];
    const c = new THREE.Color("#FFFFFF").lerp(new THREE.Color(this.bld.inks.shade), 0.35);
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.4, s = 0.02 + Math.random() * 0.04;
      this.part(cu(x) + DX[g] * 0.38, cu(y) + DY[g] * 0.38, (Math.random() - 0.5) * 0.5, (nx + Math.cos(a) * 0.9) * s, (ny + Math.sin(a) * 0.9) * s, (Math.random() - 0.5) * 0.03, 0.35 + Math.random() * 0.25, 0.06 + Math.random() * 0.06, c, false, 0);
    }
  }
  sparkle(x: number, y: number, color: string, n = 10, conf = false) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 0.02 + Math.random() * 0.07; this.part(cu(x), cu(y), 0.25, Math.cos(a) * s, Math.sin(a) * s + 0.03, (Math.random() - 0.3) * 0.06, 0.5 + Math.random() * 0.5, conf ? 0.08 + Math.random() * 0.06 : 0.035 + Math.random() * 0.04, c, conf); }
  }
  land() { this.squash = 1; }
  leap() { this.squash = -1; }
  nudge() { this.squash = 0.6; }
  momoAt() { return this.momoPt; }
  private part(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.Color, box: boolean, grav = 0.0025) {
    if (this.parts.length > 320) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, life, max: life, size, color: color.clone(), box, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, grav });
  }

  // ---------------------------------------------------------------- the building look
  private setBuilding(B: Building) {
    if (this.bldKey === B.id) return;
    this.bldKey = B.id; this.bld = B;
    const night = !!B.night;
    this.hemi.color.set(night ? "#B9B4FF" : "#FFFFFF");
    this.hemi.groundColor.set(B.inks.shade);
    this.hemi.intensity = night ? 0.6 : 0.8;
    this.sun.intensity = night ? 1.2 : 2.3;
    this.sun.color.set(night ? "#C9D4FF" : "#FFF4E0");
    this.lamp.intensity = night ? 2.2 : 0;
    this.renderer.toneMappingExposure = night ? 1.15 : 1.06;
    this.scene.background = new THREE.Color(B.inks.paper).lerp(new THREE.Color(B.inks.shade), 0.25);
    const old = this.bgMat.map;
    const tex = M.posterTex(B.inks.paper, B.inks.shade, B.poster);
    tex.repeat.set(5, 5);
    this.bgMat.map = tex; this.bgMat.color.set(night ? "#9A94C0" : "#E8E2D8"); this.bgMat.needsUpdate = true;
    old?.dispose();
  }
  private tiles(B: Building) {
    let t = this.tileTex.get(B.id);
    if (!t) { t = this.keep(M.tileTex(B.inks.paper, B.inks.shade)); this.tileTex.set(B.id, t); }
    return t;
  }

  // ---------------------------------------------------------------- characters
  private setCharacter(ch: { id: string; color: string }) {
    const key = ch.id + ch.color;
    if (key === this.chKey) return;
    this.chKey = key;
    for (const c of [...this.body.children]) { this.body.remove(c); if (c instanceof THREE.Mesh) c.geometry.dispose(); }
    this.pupils = this.lids = this.brows = this.sprout = null; this.feet = []; this.arms = [];
    this.skinMat.color.set(ch.color);
    const friend = ch.id === "momo" ? null : M.friendBody(ch.id);
    const shadow = true;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, y = 0) => { const mesh = new THREE.Mesh(g, m); mesh.position.y = y; mesh.castShadow = shadow; this.body.add(mesh); return mesh; };
    // the body group's origin is at the feet: squashing keeps him planted on his wall
    if (friend) { add(friend, this.faceMat, 0.4); return; }
    const rig = M.momoRig();
    const by = 0.4;
    add(rig.skin, this.skinMat, by);
    add(rig.face, this.faceMat, by);
    add(rig.whites, this.faceMat, by);
    this.pupils = add(rig.pupils, this.faceMat, by);
    this.lids = add(rig.lids, this.skinMat, by); this.lids.visible = false;
    this.brows = add(rig.brows, this.faceMat, by);
    this.sprout = add(rig.sprout, this.faceMat, by + rig.R * 1.06);
    for (const sx of [-1, 1]) {
      const f = add(sx < 0 ? rig.foot : rig.foot.clone(), this.faceMat, 0.06); f.position.x = sx * 0.11; this.feet.push(f);
      const a = add(sx < 0 ? rig.arm : rig.arm.clone(), this.skinMat, by + 0.02); a.position.x = sx * 0.3; a.rotation.z = sx * 0.5; this.arms.push(a);
    }
  }

  // ---------------------------------------------------------------- rooms
  private buildRoom(sim: EscapeSim, i: number): RoomView {
    const room = sim.rooms[i], B = buildingOf(room.building);
    const group = new THREE.Group();
    group.position.y = room.y0;
    const own: { dispose(): void }[] = [];
    const withCeiling = i === sim.rooms.length - 1;
    const wallMat = new THREE.MeshStandardMaterial({ color: B.inks.wall, roughness: 0.5, metalness: 0.02, envMapIntensity: 0.35 });
    own.push(wallMat);
    const walls = new THREE.Mesh(this.wallGeo(room, withCeiling, false), wallMat);
    walls.castShadow = walls.receiveShadow = true;
    own.push(walls.geometry);
    group.add(walls);
    let fake: THREE.Mesh | null = null;
    if (room.fake.some((v) => v)) {
      const fm = new THREE.MeshStandardMaterial({ color: B.inks.wall, roughness: 0.5, transparent: true, opacity: 0.82 });
      fake = new THREE.Mesh(this.wallGeo(room, true, true), fm);
      own.push(fm, fake.geometry);
      group.add(fake);
    }
    // back wall
    const rows = room.h;
    const back = new THREE.PlaneGeometry(COLS, rows);
    const uv = back.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * COLS, uv.getY(k) * rows);
    back.translate(COLS / 2, rows / 2, ZB + 0.01);
    const backMat = new THREE.MeshStandardMaterial({ map: this.tiles(B), roughness: 0.85, envMapIntensity: 0.2 });
    const backMesh = new THREE.Mesh(back, backMat);
    backMesh.receiveShadow = true;
    own.push(back, backMat);
    group.add(backMesh);
    // special wall faces
    const faceParts: THREE.BufferGeometry[] = [], belt: THREE.BufferGeometry[] = [];
    for (const f of room.faces) {
      const [x, y, w, h] = spikeRect(f.cx, f.cy, f.n, 2.2);
      const g = M.rbox(cu(w), cu(h), DEPTH * 0.94, 0.05, 2);
      g.translate(cu(x + w / 2), cu(y + h / 2), 0);
      if (f.k === "conveyor") { belt.push(g); continue; }
      faceParts.push(tint(g, f.k === "ice" ? "#9BE6FF" : f.k === "honey" ? "#FFC53D" : f.k === "speed" ? "#3DFFA8" : "#FF8A3D"));
      if (f.k === "honey") for (const s of [-0.25, 0.2]) { const d = new THREE.SphereGeometry(0.05, 10, 8); d.scale(1, 1.6, 1); d.translate(cu(x + w / 2) + (f.n === 0 || f.n === 2 ? s : 0), cu(y + h / 2) - (f.n === 0 ? 0.12 : f.n === 2 ? 0.12 : 0) + (f.n === 1 || f.n === 3 ? s : 0), ZF - 0.05); faceParts.push(tint(d, "#FFB000")); }
    }
    if (faceParts.length) { const g = this.mergeAll(faceParts); own.push(g); const m = new THREE.Mesh(g, this.glossy); m.castShadow = true; group.add(m); }
    let conveyor: THREE.Texture | null = null;
    if (belt.length) {
      conveyor = M.stripeTex("#2A2540", "#FFD23F");
      conveyor.repeat.set(2, 1);
      const g = this.mergeAll(belt);
      const mat = new THREE.MeshStandardMaterial({ map: conveyor, roughness: 0.5 });
      own.push(g, mat, conveyor);
      group.add(new THREE.Mesh(g, mat));
    }
    // decor on the back wall, next to the wall it belongs to
    const dec: THREE.BufferGeometry[] = [];
    for (const d of room.decor) {
      const g = M.decor(d.k, B.inks.cool, B.inks.shade, B.inks.hot);
      if (!g) continue;
      g.translate(d.cx + 0.5 + DX[d.n] * 0.8, d.cy + 0.5 + DY[d.n] * 0.8, ZB + 0.09);
      dec.push(g);
    }
    if (dec.length) { const g = this.mergeAll(dec); own.push(g); const m = new THREE.Mesh(g, this.clay); m.receiveShadow = true; group.add(m); }
    // EXIT lightbox on the back wall under the hatch, hazard stripes beside the hatch
    const exitTex = M.exitTex(B.inks.hot);
    const exitMat = new THREE.MeshStandardMaterial({ map: exitTex, emissive: "#FFFFFF", emissiveMap: exitTex, emissiveIntensity: 0.55, roughness: 0.4 });
    own.push(exitTex, exitMat);
    const box = new THREE.Mesh(this.geo.box, this.col(B.inks.wall));
    box.scale.set(0.98, 0.5, 0.12); box.position.set(room.outX + 0.5, room.h - 1.6, ZB + 0.07);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), exitMat);
    own.push(face.geometry);
    face.position.set(room.outX + 0.5, room.h - 1.6, ZB + 0.135);
    group.add(box, face);
    const stripes = M.stripeTex(B.inks.hot, "#1B1530");
    const sMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 });
    own.push(stripes, sMat);
    for (const sx of [-1, 1]) {
      const cx = room.outX + sx;
      if (cx < 0 || cx >= COLS) continue;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), sMat);
      own.push(pl.geometry);
      pl.position.set(cx + 0.5, room.h - 0.5, ZF + 0.012);
      group.add(pl);
    }
    // bumpers and teleport portals
    for (const b of room.bumpers) { const m = new THREE.Mesh(this.geo.bumper, this.clay); m.position.set(b.cx + 0.5, b.cy + 0.5, 0); m.castShadow = true; group.add(m); }
    const portals: THREE.Object3D[] = [];
    for (const p of room.pads) for (const [px, py] of [[p.ax, p.ay], [p.bx, p.by]]) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(this.geo.pad, this.glossy); ring.rotation.x = Math.PI / 2;
      const halo = new THREE.Mesh(this.geo.sphere, this.glow("#9B6BFF", 0.35)); halo.scale.set(0.42, 0.42, 0.05);
      g.add(ring, halo); g.position.set(px + 0.5, py + 0.5, ZB + 0.12);
      group.add(g); portals.push(g);
    }
    // doors, the locked exit, the entrance lid
    let doors: THREE.Object3D | null = null;
    if (room.door.some((v) => v)) {
      doors = new THREE.Group();
      for (let c = 0; c < room.door.length; c++) if (room.door[c]) doors.add(this.slab((c % COLS) + 0.5, Math.floor(c / COLS) + 0.5, B.inks.cool, true));
      group.add(doors);
    }
    const exitLock = room.key ? this.slab(room.outX + 0.5, room.h - 0.5, B.inks.cool, true) : null;
    if (exitLock) group.add(exitLock);
    const inLid = this.slab(room.inX + 0.5, 0.5, B.inks.wall, false);
    inLid.visible = false;
    group.add(inLid);
    // hazards and the pickups that are not drawn in bulk
    const hz = room.hazards.map((h) => this.hazard(h, room, B, own));
    for (const v of hz) group.add(v.obj);
    const others: Other[] = [];
    for (const p of room.pickups) {
      const obj = this.pickupObj(p, B, own);
      if (!obj) continue;
      obj.position.set(cu(p.x), cu(p.y), 0.05);
      group.add(obj); others.push({ p, obj });
    }
    this.scene.add(group);
    return { n: room.n, room, group, withCeiling, wallMat, walls, fake, own, hz, others, doors, exitLock, inLid, conveyor, portals };
  }
  private mergeAll(parts: THREE.BufferGeometry[]) {
    const m = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
    parts.forEach((g) => g.dispose());
    return m;
  }
  /** walls as greedy rectangles of rounded toy blocks (the shared ceiling row is drawn by the floor above) */
  private wallGeo(room: Room, withCeiling: boolean, fake: boolean) {
    const rows = withCeiling ? room.h : room.h - 1;
    const solid = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < rows && room.cells[y * COLS + x] === 1 && (fake ? room.fake[y * COLS + x] === 1 : room.fake[y * COLS + x] !== 1);
    const used = new Uint8Array(COLS * room.h);
    const parts: THREE.BufferGeometry[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < COLS; x++) {
      if (!solid(x, y) || used[y * COLS + x]) continue;
      let w = 1;
      while (solid(x + w, y) && !used[y * COLS + x + w]) w++;
      let h = 1;
      grow: for (;;) {
        for (let k = 0; k < w; k++) if (!solid(x + k, y + h) || used[(y + h) * COLS + x + k]) break grow;
        h++;
      }
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) used[(y + j) * COLS + x + k] = 1;
      const g = M.rbox(w - 0.035, h - 0.035, DEPTH, 0.15, this.q === "low" ? 2 : 3);
      g.translate(x + w / 2, y + h / 2, 0);
      parts.push(g);
    }
    if (!parts.length) return new THREE.BufferGeometry();
    return this.mergeAll(parts);
  }
  private slab(x: number, y: number, color: string, lock: boolean) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(this.geo.box, this.col(color, { roughness: 0.3 }));
    b.scale.set(0.94, 0.94, DEPTH * 0.92); b.castShadow = true;
    g.add(b);
    if (lock) { const l = new THREE.Mesh(this.geo.lock, this.metal); l.position.z = DEPTH * 0.47; l.scale.setScalar(1.3); g.add(l); }
    g.position.set(x, y, 0);
    return g;
  }
  private disposeRoom(v: RoomView) {
    this.scene.remove(v.group);
    for (const d of v.own) d.dispose();
  }

  // ---------------------------------------------------------------- pickups (the ones not drawn in bulk)
  private pickupObj(p: Pickup, B: Building, own: { dispose(): void }[]): THREE.Object3D | null {
    const G = this.geo, shadow = true;
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, s = 1) => { const x = new THREE.Mesh(g, m); x.scale.setScalar(s); x.castShadow = shadow; return x; };
    switch (p.k) {
      case "coin": case "plate": case "diamond": case "heart": return null;
      case "key": return mesh(G.key, this.metal, 1.25);
      case "switch": return mesh(G.switch, this.glossy);
      case "buddy": return mesh(G.buddy, this.clay);
      case "vend": { const g = M.vend(B.inks.cool); own.push(g); return mesh(g, this.clay); }
      case "booster": {
        const g = new THREE.Group();
        g.add(mesh(G.sphere, this.col("#3DD8FF", { roughness: 0.15, transparent: true, opacity: 0.55, emissive: "#1A7FA8", emissiveIntensity: 0.4 }), 0.27), mesh(G.bolt, this.glossy, 1.1));
        return g;
      }
      default: {
        const tintC = p.k === "shield" ? "#7AFFEA" : p.k === "ghost" ? "#C9D8FF" : p.k === "slowmo" ? "#FFD23D" : "#FF5D8F";
        const g = new THREE.Group();
        g.add(mesh(G.sphere, this.col(tintC, { roughness: 0.1, transparent: true, opacity: 0.45, emissive: tintC, emissiveIntensity: 0.25 }), 0.27), mesh(G["icon_" + p.k] ?? G.sphere, this.glossy, p.k in { shield: 1, ghost: 1, slowmo: 1, magnet: 1 } ? 1 : 0.1));
        return g;
      }
    }
  }

  // ---------------------------------------------------------------- hazards
  private hazard(h: Hazard, room: Room, B: Building, own: { dispose(): void }[]): HazView {
    const mine = <T extends { dispose(): void }>(x: T): T => { own.push(x); return x; };
    const G = this.geo, hot = B.inks.hot, wall = B.inks.wall, shadow = true;
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { const x = new THREE.Mesh(g, m); x.castShadow = shadow; return x; };
    const obj = new THREE.Group();
    const bar = (m: THREE.Mesh, ax: number, ay: number, bx: number, by: number, r: number) => {
      const dx = bx - ax, dy = by - ay, len = Math.max(0.001, Math.hypot(dx, dy));
      m.position.set((ax + bx) / 2, (ay + by) / 2, m.position.z);
      m.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
      m.scale.set(r, len, r);
    };
    switch (h.k) {
      case "laser": {
        const col = h.skin === "flame" ? "#FF7A1A" : h.skin === "arc" ? "#7AD8FF" : h.skin === "light" ? "#FFF0A0" : hot;
        const solid = h.skin === "blade" || h.skin === "hand";
        // a bright coloured core (reads on light and dark walls) inside a soft additive glow
        const core = solid ? mesh(G.box, h.skin === "blade" ? this.metal : this.col(wall)) : new THREE.Mesh(G.cyl, this.col(col, { emissive: col, emissiveIntensity: 1.1, roughness: 0.3, transparent: h.skin === "light", opacity: h.skin === "light" ? 0.55 : 1 }));
        const glowM = new THREE.Mesh(G.cyl, this.glow(col, h.skin === "light" ? 0.22 : 0.3));
        const warn = new THREE.Mesh(G.cyl, this.glow(col, 0.28));
        const ends: THREE.Object3D[] = [];
        if (h.mode === "spin") { const hub = mesh(G.cyl, this.col(wall, { roughness: 0.3 })); hub.rotation.x = Math.PI / 2; hub.scale.set(0.2, 0.5, 0.2); hub.position.set(cu(h.px), cu(h.py), 0); obj.add(hub); }
        else for (let k = 0; k < 2; k++) { const e = mesh(G.emitter, this.clay); obj.add(e); ends.push(e); }
        let tip: THREE.Mesh | null = null;
        if (h.skin === "hand") { tip = mesh(G.sphere, this.col(hot, { emissive: hot, emissiveIntensity: 0.3 })); tip.scale.setScalar(0.17); obj.add(tip); }
        obj.add(core, glowM, warn);
        const rCore = solid ? 0.09 : Math.max(0.035, cu(h.w) * 0.42), rGlow = Math.max(0.1, cu(h.w) * 1.4);
        return { obj, update: (t, live, sw, time) => {
          const [ax, ay, bx, by] = laserSeg(h, t).map(cu) as [number, number, number, number];
          const off = !!h.off && sw;
          const on = live && laserOn(h, t) && !off;
          const flick = h.skin === "flame" ? 0.75 + Math.random() * 0.5 : h.skin === "arc" ? 0.6 + Math.random() * 0.8 : 1;
          if (solid) { bar(core, ax, ay, bx, by, 1); core.scale.set(rCore * 2, core.scale.y, h.skin === "blade" ? 0.5 : 0.12); }
          else bar(core, ax, ay, bx, by, rCore * flick);
          bar(glowM, ax, ay, bx, by, rGlow * flick);
          bar(warn, ax, ay, bx, by, 0.03);
          if (h.skin === "arc" && on) { core.position.x += (Math.random() - 0.5) * 0.06; core.position.y += (Math.random() - 0.5) * 0.06; }
          core.visible = solid ? !off : on; glowM.visible = on && !solid;
          warn.visible = !on && live && !off && laserSoon(h, t) && Math.floor(time * 14) % 2 === 0;
          if (tip) tip.position.set(bx, by, 0);
          if (ends.length) {
            const a = Math.atan2(by - ay, bx - ax);
            ends[0].position.set(ax, ay, 0); ends[0].rotation.z = a - Math.PI / 2;
            ends[1].position.set(bx, by, 0); ends[1].rotation.z = a + Math.PI / 2;
          }
        } };
      }
      case "spikes": {
        const col = h.skin === "crumble" ? "#C9925A" : h.skin === "spark" ? "#FFE03D" : hot;
        const mat = this.col(col, { roughness: 0.3, metalness: h.skin === "crumble" ? 0 : 0.3, emissive: h.skin === "spark" ? "#FFB000" : "#000000", emissiveIntensity: 0.4 });
        const strips = h.faces.map((f) => {
          const m = mesh(G.strip, mat);
          m.position.set(f.cx + 0.5 + DX[f.n] * 0.5, f.cy + 0.5 + DY[f.n] * 0.5, 0);
          m.rotation.z = UPTO[f.n];
          m.scale.y = 0.3;
          obj.add(m);
          return m;
        });
        return { obj, update: (t, live, sw, time) => {
          const on = !live || spikesOn(h, t), soon = live && spikesSoon(h, t);
          const want = on ? 0.32 : soon ? 0.14 + 0.03 * Math.sin(time * 40) : 0.05;
          for (const m of strips) m.scale.y += (want - m.scale.y) * 0.45;
          void sw;
        } };
      }
      case "crusher": {
        const tex = M.stripeTex(h.skin === "piston" ? "#9AA6B8" : hot, wall);
        tex.repeat.set(Math.max(1, cu(h.w)), Math.max(1, cu(h.h)));
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2, emissive: "#FFFFFF", emissiveIntensity: 0 });
        mine(tex); mine(mat);
        const block = mesh(mine(M.rbox(cu(h.w), cu(h.h), DEPTH * 0.86, 0.12, 3)), mat);
        const rail = new THREE.Mesh(G.cyl, this.col(wall, { transparent: true, opacity: 0.35 })); rail.position.z = ZB + 0.1;
        bar(rail, cu(h.x + h.w / 2), cu(h.y + h.h / 2), cu(h.x + h.ex + h.w / 2), cu(h.y + h.ey + h.h / 2), 0.05);
        obj.add(rail, block);
        let lastK = 0;
        return { obj, update: (t, live, _sw, time) => {
          const k = crushK(h, t);
          block.position.set(cu(h.x + h.ex * k + h.w / 2), cu(h.y + h.ey * k + h.h / 2), 0);
          mat.emissiveIntensity = live && crushSoon(h, t) && Math.floor(time * 16) % 2 ? 0.55 : 0;
          if (live && k >= 1 && lastK < 1) this.shake = Math.max(this.shake, 0.35);
          lastK = k;
        } };
      }
      case "turret": {
        const base = mesh(G.turret, this.clay);
        base.position.set(h.cx + 0.5 + DX[h.n] * 0.5, h.cy + 0.5 + DY[h.n] * 0.5, 0);
        base.rotation.z = UPTO[h.n];
        const muzzle = new THREE.Mesh(G.sphere, this.glow(hot, 0.9));
        muzzle.position.set(base.position.x + DX[h.n] * 0.48, base.position.y + DY[h.n] * 0.48, 0);
        const ball = h.skin === "ball" || h.skin === "fast";
        const shotMat = this.col(h.skin === "ink" ? B.inks.shade : h.skin === "ball" ? "#D23D3D" : hot, { roughness: 0.3, emissive: h.skin === "ink" ? "#000000" : hot, emissiveIntensity: 0.3 });
        const pool = new THREE.InstancedMesh(ball ? G.sphere : G.box, shotMat, 10);
        pool.castShadow = shadow; pool.frustumCulled = false; pool.count = 0;
        mine({ dispose: () => pool.dispose() });
        obj.add(base, muzzle, pool);
        const buf: number[] = [];
        return { obj, update: (t, live, _sw, time) => {
          const ch = live ? turretCharge(h, t) : 0;
          muzzle.scale.setScalar(0.06 + 0.12 * ch);
          const s = live ? shots(h, t, buf) : [];
          let n = 0;
          const size = cu(h.size);
          for (let j = 0; j < s.length && n < 10; j += 2, n++) {
            this.v3.set(cu(s[j]), cu(s[j + 1]), 0);
            this.e3.set(time * 3, time * 2, 0); this.q4.setFromEuler(this.e3);
            this.s3.setScalar(ball ? size / 2 : size);
            pool.setMatrixAt(n, this.m4.compose(this.v3, this.q4, this.s3));
          }
          pool.count = n; pool.instanceMatrix.needsUpdate = true;
        } };
      }
      case "mover": {
        const r = cu(h.r);
        let body: THREE.Object3D;
        let spin: THREE.Object3D[] = [];
        let light: THREE.Mesh | null = null;
        switch (h.skin) {
          case "saw": { const m = mesh(G.saw, this.metal); m.scale.setScalar(r); body = m; spin = [m]; break; }
          case "grumpy": { const g = new THREE.Group(); g.add(mesh(G.grumpy, this.clay), mesh(G.grumpyFace, this.clay)); g.scale.setScalar(r * 0.9); body = g; break; }
          case "mine": { const g = new THREE.Group(); g.add(mesh(G.mine, this.metal)); light = new THREE.Mesh(G.sphere, this.glow(hot, 0.95)); light.scale.setScalar(0.3); light.position.z = 0.8; g.add(light); g.scale.setScalar(r * 0.85); body = g; break; }
          case "bubble": { const m = new THREE.Mesh(G.sphere, this.col("#9BE6FF", { transparent: true, opacity: 0.35, roughness: 0.05, emissive: "#3FA8D8", emissiveIntensity: 0.2, depthWrite: false })); m.scale.setScalar(r); body = m; break; }
          case "drone": { const g = new THREE.Group(); g.add(mesh(G.drone, this.clay)); for (const sx of [-1, 1]) { const ro = mesh(G.rotor, this.metal); ro.position.set(sx * 0.8, 0.58, 0); g.add(ro); spin.push(ro); } light = new THREE.Mesh(G.sphere, this.glow(hot, 0.9)); light.scale.setScalar(0.16); light.position.set(0, 0, 0.62); g.add(light); g.scale.setScalar(r); body = g; break; }
          case "bot": { const m = mesh(G.bot, this.clay); m.scale.setScalar(r * 0.75); body = m; break; }
          case "barrel": { const m = mesh(G.barrel, this.clay); m.scale.setScalar(r); body = m; break; }
          case "lamp": { const g = new THREE.Group(); g.add(new THREE.Mesh(G.sphere, this.col("#FFE9A8", { emissive: "#FFC94A", emissiveIntensity: 0.6 }))); const halo = new THREE.Mesh(G.sphere, this.glow("#FFE9A8", 0.1)); halo.scale.setScalar(1.7); g.add(halo); g.scale.setScalar(r); body = g; break; }
          default: { const m = mesh(G.mace, this.metal); m.scale.setScalar(r * 0.85); body = m; }
        }
        obj.add(body);
        // chains, arms and tracks
        let link: THREE.Mesh | null = null;
        if (h.path === "pendulum" || (h.path === "orbit" && h.skin !== "drone")) { link = mesh(G.cyl, this.col("#5A5570", { metalness: 0.6, roughness: 0.3 })); obj.add(link); }
        if (h.path === "line" && (h.skin === "saw" || h.skin === "bot" || h.skin === "barrel")) {
          const track = new THREE.Mesh(G.cyl, this.col(wall, { transparent: true, opacity: 0.4 })); track.position.z = ZB + 0.08;
          bar(track, cu(h.x), cu(h.y), cu(h.x + h.ex), cu(h.y + h.ey), 0.05);
          obj.add(track);
        }
        return { obj, update: (t, live, _sw, time) => {
          const [x, y] = moverPos(h, t).map(cu) as [number, number];
          body.position.set(x, y, 0);
          if (link) bar(link, cu(h.x), cu(h.y), x, y, 0.035);
          if (h.skin === "saw") for (const s of spin) s.rotation.z = -time * 9;
          else if (h.skin === "drone") for (const s of spin) s.rotation.y = time * 40;
          else if (h.skin === "barrel") body.rotation.z = -x / Math.max(0.2, r);
          else if (h.skin === "grumpy") { const k = 1 + 0.05 * Math.sin(time * 5 + h.id); body.scale.setScalar(r * 0.9 * k); body.rotation.z = Math.sin(time * 2 + h.id) * 0.15; }
          else if (h.skin === "mine") { body.rotation.z = time * 0.8; if (light) light.visible = Math.floor(time * 4) % 2 === 0; }
          else if (h.skin === "bot") body.rotation.y = Math.sin(time * 2) * 0.3;
          else if (h.skin !== "lamp" && h.skin !== "bubble") body.rotation.z = time * 1.5;
          void live;
        } };
      }
      case "pulse": {
        const solidCol = h.skin === "steam" ? "#EEF6FF" : h.skin === "bolt" ? "#FFF36B" : h.skin === "jaws" ? wall : hot;
        const mat = new THREE.MeshStandardMaterial({ color: solidCol, transparent: true, opacity: 0.9, roughness: 0.4, emissive: h.skin === "jaws" || h.skin === "steam" ? "#000000" : solidCol, emissiveIntensity: 0.6, depthWrite: false });
        mine(mat);
        const box = new THREE.Mesh(mine(M.rbox(cu(h.w), cu(h.h), DEPTH * 0.8, 0.08, 2)), mat);
        box.position.set(cu(h.x + h.w / 2), cu(h.y + h.h / 2), 0);
        const warn = new THREE.Mesh(box.geometry, this.glow(hot, 0.22)); warn.position.copy(box.position);
        obj.add(box, warn);
        return { obj, update: (t, live, _sw, time) => {
          const s = live ? pulseState(h, t) : 0;
          warn.visible = s === 1 && Math.floor(time * 10) % 2 === 0;
          box.visible = s === 2 || h.skin === "glitch" || h.skin === "jaws";
          if (s === 2) {
            mat.opacity = h.skin === "steam" ? 0.75 : 0.92;
            if (h.skin === "glitch") mat.color.set(Math.random() < 0.5 ? hot : B.inks.cool);
            box.scale.set(1, 1, 1);
            if (h.skin === "bolt") { this.flash = Math.max(this.flash, 0.05); box.scale.x = 0.8 + Math.random() * 0.4; }
          } else if (h.skin === "glitch") { mat.opacity = 0.18; mat.color.set(B.inks.cool); }
          else if (h.skin === "jaws") { mat.opacity = 0.9; box.scale.set(1, 0.25, 1); box.position.y = cu(h.y) + cu(h.h) * 0.125; }
          if (s === 2 && h.skin === "jaws") box.position.y = cu(h.y + h.h / 2);
        } };
      }
      case "flood": {
        const col = h.skin === "lava" ? "#FF5A1F" : h.skin === "dino" ? "#8FBF3A" : "#6BE04A";
        const n = 28;
        const g = new THREE.PlaneGeometry(COLS + 0.4, 1, n, 1);
        const mat = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.82, roughness: 0.15, emissive: col, emissiveIntensity: h.skin === "lava" ? 0.8 : 0.35, depthWrite: false });
        mine(g); mine(mat);
        const sheet = new THREE.Mesh(g, mat);
        sheet.position.set(COLS / 2, 0, ZF + 0.06);
        const pos = g.getAttribute("position") as THREE.BufferAttribute;
        obj.add(sheet);
        return { obj, update: (t, _live, _sw, time) => {
          const top = cu(floodY(h, t)), bottom = top - room.h - 6;
          for (let k = 0; k < pos.count; k++) {
            const isTop = k <= n;
            const x = pos.getX(k);
            pos.setY(k, isTop ? top + Math.sin(time * 4 + x * 1.6) * 0.12 : bottom);
          }
          pos.needsUpdate = true;
          g.computeBoundingSphere();
        } };
      }
    }
  }

  // ---------------------------------------------------------------- frame
  draw(sim: EscapeSim, alpha: number, dt: number, fx: FrameFx) {
    this.time += dt;
    const time = this.time;
    const room = sim.room, B = buildingOf(room.building);
    this.setBuilding(B);
    this.setCharacter(fx.ch);
    const r = sim.r;
    const mx = cu(r.x), my = cu(r.y);

    // camera: follows Momo, looking a little ahead (up) and slightly from below
    const want = my + this.viewH * 0.12;
    if (!this.camInit) { this.camY = want; this.camInit = true; }
    this.camY += (want - this.camY) * Math.min(1, dt * 4.5);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const sk = fx.shakeOn && !fx.reduced ? this.shake * this.shake * 0.35 : 0;
    const shx = (Math.random() - 0.5) * sk, shy = (Math.random() - 0.5) * sk;
    const cx = COLS / 2;
    this.camera.position.set(cx + shx, this.camY - this.dist * 0.07 + shy, this.dist);
    this.camera.lookAt(cx + shx, this.camY + shy, 0);
    this.sun.target.position.set(cx, this.camY, 0);
    this.sun.position.set(cx - 6, this.camY + 10, 14);
    this.fill.position.set(cx + 8, this.camY - 4, 10);
    this.bg.position.y = this.camY * 0.55;
    this.lamp.position.set(mx, my, 1.4);

    // rooms near the view: build, refresh the ceiling when a new floor arrives, drop far ones
    const lo = this.camY - this.viewH * 0.75 - 3, hi = this.camY + this.viewH * 0.75 + 3;
    const keepN = new Set<number>();
    for (let i = 0; i < sim.rooms.length; i++) {
      const rm = sim.rooms[i];
      if (rm.y0 + rm.h < lo || rm.y0 > hi) continue;
      keepN.add(rm.n);
      let v = this.rooms.get(rm.n);
      if (!v) { v = this.buildRoom(sim, i); this.rooms.set(rm.n, v); }
      else if (v.withCeiling && i < sim.rooms.length - 1) {
        v.walls.geometry.dispose();
        const g = this.wallGeo(rm, false, false);
        v.walls.geometry = g; v.own.push(g); v.withCeiling = false;
      }
      this.updateRoom(sim, i, v, time);
    }
    for (const [n, v] of this.rooms) if (!keepN.has(n)) { this.disposeRoom(v); this.rooms.delete(n); }
    this.updatePickups(sim, time);
    this.updateMomo(sim, dt, time, fx);
    this.updateParts(dt);

    // floors that twist the view: mirror, upside down, tilt (the canvas itself turns; directions follow the screen)
    const rules = room.rules;
    const mxs = (rules.mirror ? -1 : 1) * (rules.flip ? -1 : 1), mys = rules.flip ? -1 : 1;
    const tilt = rules.tilt ? Math.sin(time * 0.6) * 0.07 + 0.06 : 0, ts = rules.tilt ? 1.14 : 1;
    const css = `${mxs},${mys},${tilt.toFixed(3)}`;
    if (css !== this.cssKey) { this.cssKey = css; this.cv.style.transform = mxs === 1 && mys === 1 && !tilt ? "" : `rotate(${tilt}rad) scale(${ts * mxs}, ${ts * mys})`; }

    this.renderer.render(this.scene, this.camera);

    // Momo on screen (for tap-to-move and the lights-out spotlight)
    this.v3.set(mx, my, 0).project(this.camera);
    let px = (this.v3.x * 0.5) * this.w, py = (-this.v3.y * 0.5) * this.h;
    px *= ts * mxs; py *= ts * mys;
    const ca = Math.cos(tilt), sa = Math.sin(tilt);
    this.momoPt = { x: this.w / 2 + px * ca - py * sa, y: this.h / 2 + px * sa + py * ca };
    this.overlay(fx, rules, dt);
    void alpha;
  }

  private updateRoom(sim: EscapeSim, i: number, v: RoomView, time: number) {
    const st = sim.st[i], t = sim.localT(i), live = st.active;
    for (const hv of v.hz) hv.update(live ? t : 0, live, st.switched, time);
    if (v.doors) v.doors.visible = !st.key;
    if (v.exitLock) v.exitLock.visible = v.room.key && !st.key;
    v.inLid.visible = st.inClosed && i > 0;
    for (const o of v.others) {
      const got = st.got.has(o.p.id);
      o.obj.visible = !got;
      if (got) continue;
      o.obj.position.y = cu(o.p.y) + Math.sin(time * 3 + o.p.id) * 0.05;
      o.obj.rotation.y = o.p.k === "switch" ? 0 : Math.sin(time * 1.6 + o.p.id) * 0.6;
      if (o.p.k === "key") o.obj.rotation.z = Math.sin(time * 3) * 0.3;
    }
    if (v.conveyor) v.conveyor.offset.x = -time * 1.2;
    for (const p of v.portals) { const k = 1 + 0.08 * Math.sin(time * 6); p.scale.set(k, k, 1); p.rotation.z = time * 1.5; }
    // memory floors: the walls fade after a moment
    if (v.room.rules.memory && live) {
      const tt = t / 60, a = tt < 2.5 ? 1 : Math.max(0.12, 1 - (tt - 2.5) * 0.6);
      v.wallMat.transparent = a < 1; v.wallMat.opacity = a;
    }
  }

  private updatePickups(sim: EscapeSim, time: number) {
    let nc = 0, np = 0, ng = 0, nh = 0;
    for (let i = 0; i < sim.rooms.length; i++) {
      const room = sim.rooms[i];
      if (!this.rooms.has(room.n)) continue;
      const st = sim.st[i];
      const cool = this.c3.set(buildingOf(room.building).inks.cool);
      for (const p of room.pickups) {
        if (st.got.has(p.id)) continue;
        const x = cu(p.x), y = cu(p.y) + room.y0 + Math.sin(time * 3 + p.id) * 0.05;
        this.v3.set(x, y, 0.05);
        switch (p.k) {
          case "coin": case "plate": {
            this.e3.set(0, time * 3 + p.id * 0.7, 0); this.q4.setFromEuler(this.e3); this.s3.setScalar(1);
            const im = p.k === "coin" ? this.coins : this.plates;
            const n = p.k === "coin" ? nc++ : np++;
            if (n < im.instanceMatrix.count) im.setMatrixAt(n, this.m4.compose(this.v3, this.q4, this.s3));
            break;
          }
          case "diamond": {
            this.e3.set(0.25, time * 1.4 + p.id, Math.sin(time * 2 + p.id) * 0.15); this.q4.setFromEuler(this.e3);
            this.s3.setScalar(1 + 0.06 * Math.sin(time * 5 + p.id));
            if (ng < 40) { this.gems.setMatrixAt(ng, this.m4.compose(this.v3, this.q4, this.s3)); this.gems.setColorAt(ng, cool); ng++; }
            break;
          }
          case "heart": {
            this.e3.set(0, Math.sin(time * 1.5 + p.id) * 0.5, 0); this.q4.setFromEuler(this.e3);
            this.s3.setScalar(1 + 0.08 * Math.sin(time * 6));
            if (nh < 20) this.hearts.setMatrixAt(nh++, this.m4.compose(this.v3, this.q4, this.s3));
            break;
          }
          default: break;
        }
      }
    }
    for (const [im, n] of [[this.coins, nc], [this.plates, np], [this.gems, ng], [this.hearts, nh]] as const) {
      im.count = Math.min(n, im.instanceMatrix.count);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  private updateMomo(sim: EscapeSim, dt: number, time: number, fx: FrameFx) {
    const r = sim.r, k = Math.min(1, dt * 18);
    const dash = r.mode === 1;
    // he jumps head first (feet still towards the wall he left) and turns onto the new wall as he lands
    const dir: Dir = r.g;
    this.ang += angDiff(this.ang, FEET[dir]) * Math.min(1, dt * 14);
    // resting: feet on the wall; dashing: centred on his path
    const wantOff = dash ? 0 : 0.085;
    this.off += (wantOff - this.off) * k;
    const x = cu(r.x) + DX[dir] * this.off, y = cu(r.y) + DY[dir] * this.off;
    this.momo.position.set(x, y, 0);
    this.momo.rotation.z = this.ang;
    this.momo.visible = !sim.dead && !(sim.frozen > 0 && Math.floor(time * 10) % 2);
    // squash on landing, stretch while dashing, breathe while waiting
    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const breathe = dash ? 0 : 0.025 * Math.sin(time * 3);
    if (dash) {
      // stretch along the dash: head-to-feet for up/down jumps, sideways for side jumps
      const along = r.d === r.g || r.d === ((r.g + 2) % 4);
      this.body.scale.set(along ? 0.88 : 1.15, along ? 1.16 : 0.9, 0.9);
    } else {
      const sy = 1 - 0.22 * Math.max(0, this.squash) + 0.12 * Math.max(0, -this.squash) + breathe;
      const sxz = 1 + 0.16 * Math.max(0, this.squash) - 0.06 * Math.max(0, -this.squash) - breathe * 0.5;
      this.body.scale.set(sxz, sy, sxz);
    }
    this.body.position.y = -0.4;
    // eyes: look along the dash, glance about while waiting; blink now and then
    if (this.pupils) {
      let lx = 0, ly = 0;
      if (dash) { const a = -this.ang; lx = DX[r.d] * Math.cos(a) - DY[r.d] * Math.sin(a); ly = DX[r.d] * Math.sin(a) + DY[r.d] * Math.cos(a); }
      else { lx = Math.sin(time * 0.7) * 0.5; ly = 0.2 + Math.sin(time * 0.43) * 0.3; }
      this.pupils.position.x += (lx * 0.03 - this.pupils.position.x) * k;
      this.pupils.position.y += (0.4 + ly * 0.025 - this.pupils.position.y) * k;
    }
    if (this.lids) {
      this.blinkT -= dt;
      if (this.blinkT < -0.13) this.blinkT = 2 + Math.random() * 3;
      this.lids.visible = this.blinkT < 0;
    }
    if (this.brows) this.brows.position.y = 0.4 + (dash ? 0.025 : 0);
    // feet planted or tucked, arms down or thrown back, sprout wiggling
    for (let s = 0; s < this.feet.length; s++) {
      const sx = s ? 1 : -1, f = this.feet[s];
      f.position.y += ((dash ? 0.14 : 0.06) - f.position.y) * k;
      f.rotation.x = dash ? -0.5 : 0;
      const a = this.arms[s];
      if (a) a.rotation.z += ((dash ? sx * 2.5 : sx * (0.45 + 0.06 * Math.sin(time * 3))) - a.rotation.z) * k;
    }
    if (this.sprout) this.sprout.rotation.z = Math.sin(time * 4) * 0.15 + (dash ? 0.4 * Math.sin(time * 30) : 0);
    // ghost / shield / booster
    const ghost = sim.ghostT > 0;
    this.skinMat.transparent = ghost; this.skinMat.opacity = ghost ? (Math.floor(time * 14) % 2 ? 0.35 : 0.75) : 1;
    this.bubble.visible = sim.shield; this.bubble.scale.setScalar(0.56 + Math.sin(time * 6) * 0.02);
    this.ring.visible = fx.boost; this.ring.rotation.z = time * 4;
    // ink trail while dashing
    if (dash) this.trailPts.push({ x: cu(r.x), y: cu(r.y), a: 1 });
    for (const p of this.trailPts) p.a -= dt * 4.5;
    this.trailPts = this.trailPts.filter((p) => p.a > 0).slice(-18);
    const tc = this.c3.set(fx.ch.color).lerp(new THREE.Color("#FFFFFF"), 0.35);
    this.trailPts.forEach((p, i) => {
      this.v3.set(p.x, p.y, -0.05); this.s3.setScalar(0.24 * p.a); this.q4.identity();
      this.trail.setMatrixAt(i, this.m4.compose(this.v3, this.q4, this.s3));
      this.trail.setColorAt(i, tc);
    });
    this.trail.count = this.trailPts.length;
    this.trail.instanceMatrix.needsUpdate = true;
    if (this.trail.instanceColor) this.trail.instanceColor.needsUpdate = true;
  }

  private updateParts(dt: number) {
    const f = dt * 60;
    let nd = 0, nb = 0;
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * f; p.y += p.vy * f; p.z += p.vz * f; p.vy -= p.grav * f; p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96; p.rot += p.vr * dt;
      const a = Math.max(0, p.life / p.max);
      const s = p.size * (p.box ? 1 : 0.5 + 0.8 * Math.min(1, a * 1.5));
      this.v3.set(p.x, p.y, p.z);
      if (p.box) {
        if (nb >= 160) continue;
        this.e3.set(p.rot, p.rot * 0.7, p.rot * 0.3); this.q4.setFromEuler(this.e3); this.s3.setScalar(s * 2);
        this.bits.setMatrixAt(nb, this.m4.compose(this.v3, this.q4, this.s3)); this.bits.setColorAt(nb, p.color); nb++;
      } else {
        if (nd >= 340) continue;
        this.q4.identity(); this.s3.setScalar(s);
        this.dots.setMatrixAt(nd, this.m4.compose(this.v3, this.q4, this.s3)); this.dots.setColorAt(nd, p.color); nd++;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.dots.count = nd; this.bits.count = nb;
    for (const im of [this.dots, this.bits]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- 2D overlay: lights out, fog, alarm, strobe, speed, flash, stamp
  private overlay(fx: FrameFx, rules: Room["rules"], dt: number) {
    const g = this.og, w = this.w, h = this.h, ink = this.bld.inks;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const cs = w / 13.7;
    if (rules.dark && this.momoPt) {
      const rad = cs * 3.4;
      const grd = g.createRadialGradient(this.momoPt.x, this.momoPt.y, rad * 0.35, this.momoPt.x, this.momoPt.y, rad);
      grd.addColorStop(0, "rgba(10,6,20,0)"); grd.addColorStop(1, "rgba(10,6,20,0.94)");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }
    if (rules.fog) { const grd = g.createLinearGradient(0, 0, 0, h * 0.5); grd.addColorStop(0, ink.paper); grd.addColorStop(1, "rgba(255,255,255,0)"); g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(0, 0, w, h * 0.5); g.globalAlpha = 1; }
    if (rules.alarm) { g.globalAlpha = 0.1 + 0.08 * Math.sin(this.time * 8); g.fillStyle = "#ff2040"; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
    if (rules.strobe && !fx.reduced) { const kk = Math.pow(1 - ((fx.beat % 1) + 1) % 1, 6); if (kk > 0.05) { g.globalAlpha = kk * 0.22; g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.globalAlpha = 1; } }
    const sp = Math.max(0, Math.min(1.2, fx.speed));
    if (sp > 0.25 && !fx.reduced) {
      g.strokeStyle = fx.boost ? "rgba(70,200,255,0.5)" : ink.shade; g.lineWidth = Math.max(1, cs * 0.05);
      g.globalAlpha = Math.min(0.5, (sp - 0.2) * 0.6);
      for (let i = 0; i < 14; i++) {
        const sx = ((i * 97.13) % 1) * w * 0.9 + w * 0.05;
        const len = h * (0.08 + 0.1 * sp);
        const y = ((this.time * h * (1.2 + sp) + i * 211) % (h + len)) - len;
        g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + len); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (this.flash > 0) { g.globalAlpha = this.flash; g.fillStyle = this.flashColor; g.fillRect(0, 0, w, h); g.globalAlpha = 1; this.flash = Math.max(0, this.flash - dt * 1.4); }
    if (this.stampT > 0) {
      this.stampT -= dt;
      const t = 2.4 - this.stampT;
      const s = t < 0.25 ? 1.8 - (t / 0.25) * 0.8 : 1;
      const a = this.stampT < 0.4 ? this.stampT / 0.4 : 1;
      g.save(); g.globalAlpha = a; g.translate(w / 2, h * 0.36); g.rotate(-0.12); g.scale(s, s);
      g.font = `${Math.round(Math.min(w * 0.12, 56))}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      const tw = g.measureText(this.stampText).width;
      g.fillStyle = "rgba(255,255,255,0.75)"; g.fillRect(-tw / 2 - 18, -36, tw + 36, 72);
      g.strokeStyle = ink.hot; g.lineWidth = 5; g.strokeRect(-tw / 2 - 18, -36, tw + 36, 72);
      g.fillStyle = ink.hot; g.fillText(this.stampText, 3, 3);
      g.fillStyle = ink.wall; g.fillText(this.stampText, 0, 0);
      g.restore();
    }
  }

  dispose() {
    this.gov?.dispose();
    for (const v of this.rooms.values()) this.disposeRoom(v);
    this.rooms.clear();
    for (const c of this.body.children) if (c instanceof THREE.Mesh) c.geometry.dispose();
    this.bgMat.map?.dispose();
    for (const k of this.keepList) k.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.cv.remove(); this.ov.remove();
  }
}

/** a sensible default for "auto" graphics */
export function autoQuality(): Quality { return sharedAutoQuality(); }
