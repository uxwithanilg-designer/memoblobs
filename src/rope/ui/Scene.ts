// The Rope Loop workshop in 3D (three.js): white spools with a coloured core on a soft floor, wound with thick twisted
// rope (each coil is a few torus rings with a twist texture). Tap a spool: its top rope lifts. Tap another: the rope
// unwinds ring by ring, arcs over and winds down onto the new spool. A spool that fills with one colour gets its cap
// and a sparkle. Hidden coils are grey with a "?" until they're on top. Renders only while something moves.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { run } from "../engine";
import { ROPE_COLS, type World } from "../stage";

export type SceneSound = "pick" | "drop" | "wind" | "done" | "denied";
export interface SceneHooks { canPlay: () => boolean; tap: (i: number) => void; sound: (e: SceneSound, pan: number, n?: number) => void }

const RINGS = 2;           // torus rings per coil
const RING_H = 0.17;       // height of one ring
const COIL_H = RINGS * RING_H;
interface Ring { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number }
interface SpoolView { g: THREE.Group; x: number; z: number; cap: THREE.Mesh; rings: THREE.Mesh[][]; q: THREE.Sprite[] }

export class RopeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  private root = new THREE.Group();
  private spools: SpoolView[] = [];
  private flying: Ring[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private hiddenMat: THREE.MeshStandardMaterial;
  private ringGeo = new THREE.TorusGeometry(0.4, 0.09, 10, 28);
  private qTex: THREE.CanvasTexture;
  private spoolMat: THREE.MeshStandardMaterial; private coreMat: THREE.MeshStandardMaterial;
  private cap = 4; private world: World | null = null;
  private sel = -1; private selAt = 0;
  private shakeI = -1; private shakeAt = 0;
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private sparkGeo = new THREE.OctahedronGeometry(0.06);
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private shadows: boolean;
  private down: { x: number; y: number } | null = null;

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    const q = autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), alpha: true, powerPreference: "high-performance", stencil: false });
    const pr = pixelRatioFor(q);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.shadows = shadowsFor(q);
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9098a8, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-6, 12, 6); sun.castShadow = this.shadows; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    sun.shadow.bias = -0.001; sun.shadow.radius = 4;
    this.scene.add(sun, this.root);
    // a soft floor that only catches shadows
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = this.shadows; this.root.add(floor);
    const twist = twistTex();
    this.mats = ROPE_COLS.map((c) => new THREE.MeshStandardMaterial({ color: c, map: twist, roughness: 0.75 }));
    this.hiddenMat = new THREE.MeshStandardMaterial({ color: "#6a6a78", map: twist, roughness: 0.85 });
    this.spoolMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
    this.coreMat = new THREE.MeshStandardMaterial({ color: "#cfe4f6", roughness: 0.35 });
    this.qTex = qTexture();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", this.onUp);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }); this.io.observe(el);
    document.addEventListener("visibilitychange", this.kick);
    this.resize();
  }

  // ------------------------------------------------------------ layout
  private resize() {
    this.w = this.el.clientWidth || 360; this.h = this.el.clientHeight || 640;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.frame3();
    this.kick();
  }
  private perRow(n: number) { const portrait = this.h > this.w * 1.1; return portrait ? (n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3)) : n <= 7 ? n : Math.ceil(n / 2); }
  private frame3() {
    const n = this.spools.length; if (!n) { this.camera.updateProjectionMatrix(); return; }
    const per = this.perRow(n), rows = Math.ceil(n / per);
    const span = per * 1.35, depth = rows * 2.4, tall = this.cap * COIL_H + 0.8;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(span / 2 / Math.tan(hf / 2), (depth + tall) / 2 / Math.tan(vf / 2)) * 1.1 + 2;
    this.camera.position.set(0, dist * 0.62, dist * 0.8);
    this.camera.lookAt(0, tall * 0.35, 0.2);
    this.camera.updateProjectionMatrix();
  }
  private slotPos(i: number, k: number) { const s = this.spools[i]; return new THREE.Vector3(s.x, 0.22 + k * COIL_H, s.z); }
  private panOf(i: number) { const s = this.spools[i]; const xs = this.spools.map((q) => q.x); const span = Math.max(1, Math.max(...xs) - Math.min(...xs)); return Math.max(-0.85, Math.min(0.85, (s.x / span) * 1.6)); }

  // ------------------------------------------------------------ build
  setStage(cap: number, spools: number[][], hid: boolean[][], world: World) {
    this.cap = cap; this.world = world;
    this.clear();
    this.spoolMat.color.set(world.spool); this.coreMat.color.set(world.core);
    const n = spools.length, per = this.perRow(n), rows = Math.ceil(n / per);
    spools.forEach((_, i) => {
      const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per);
      const x = (c - (inRow - 1) / 2) * 1.35, z = (r - (rows - 1) / 2) * 2.4;
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 32), this.spoolMat); base.position.y = 0.08;
      const coreH = cap * COIL_H + 0.25;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, coreH, 24), this.coreMat); core.position.y = 0.16 + coreH / 2;
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24), this.spoolMat); lip.position.y = 0.16 + coreH;
      const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 28), this.spoolMat); capM.position.y = 0.16 + coreH + 0.05; capM.visible = false;
      for (const m of [base, core, lip, capM]) { m.castShadow = this.shadows; m.receiveShadow = this.shadows; g.add(m); }
      this.root.add(g);
      this.spools.push({ g, x, z, cap: capM, rings: [], q: [] });
    });
    this.sync(spools, hid);
    this.frame3();
    this.kick();
  }
  private clear() {
    for (const s of this.spools) { for (const c of s.rings) for (const m of c) this.root.remove(m); for (const q of s.q) this.root.remove(q); this.root.remove(s.g); }
    this.spools = []; this.flying = []; this.sel = -1;
    for (const p of this.parts) this.root.remove(p.m);
    this.parts = [];
  }
  private coil(color: number, hidden: boolean, at: THREE.Vector3) {
    const out: THREE.Mesh[] = [];
    for (let r = 0; r < RINGS; r++) {
      const m = new THREE.Mesh(this.ringGeo, hidden ? this.hiddenMat : this.mats[color % this.mats.length]);
      m.rotation.x = Math.PI / 2; m.rotation.z = r * 0.7; m.position.set(at.x, at.y + r * RING_H + RING_H / 2, at.z);
      m.castShadow = this.shadows; this.root.add(m); out.push(m);
    }
    return out;
  }
  /** rebuild the coils to match (instantly) */
  sync(spools: number[][], hid: boolean[][]) {
    for (const s of this.spools) { for (const c of s.rings) for (const m of c) this.root.remove(m); for (const q of s.q) this.root.remove(q); s.rings = []; s.q = []; }
    spools.forEach((sp, i) => {
      sp.forEach((c, k) => {
        const hidden = hid[i]?.[k] ?? false;
        this.spools[i].rings.push(this.coil(c, hidden, this.slotPos(i, k)));
        if (hidden) { const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.qTex, transparent: true, depthTest: false })); q.scale.setScalar(0.32); const p = this.slotPos(i, k); q.position.set(p.x, p.y + COIL_H / 2, p.z + 0.55); this.root.add(q); this.spools[i].q.push(q); }
      });
      const full = sp.length === this.cap && run(sp) === this.cap;
      this.spools[i].cap.visible = full;
    });
    this.sel = -1;
    this.kick();
  }
  select(i: number) { this.sel = i; this.selAt = performance.now(); this.hooks.sound("pick", this.panOf(i)); this.kick(); }
  deselect() { this.sel = -1; this.kick(); }
  deny(i: number) { this.shakeI = i; this.shakeAt = performance.now(); this.hooks.sound("denied", this.panOf(i)); this.kick(); }
  get selected() { return this.sel; }
  get busy() { return this.flying.length > 0; }

  /** animate `n` coils flying from spool `from` (top) to spool `to`; then call `done` */
  move(from: number, to: number, n: number, colorOf: (k: number) => number, toLen: number, done: () => void) {
    const src = this.spools[from], dst = this.spools[to];
    this.sel = -1;
    const now = performance.now();
    for (let k = 0; k < n; k++) {
      const coil = src.rings.pop(); if (!coil) break;
      const slot = toLen + k;
      coil.forEach((m, r) => {
        const target = this.slotPos(to, slot); target.y += r * RING_H + RING_H / 2;
        m.material = this.mats[colorOf(k) % this.mats.length];
        this.flying.push({ m, from: m.position.clone(), to: target, t0: now + (k * RINGS + r) * 70, dur: 520 });
      });
      dst.rings.push(coil);
    }
    this.hooks.sound("wind", this.panOf(to), n);
    const total = n * RINGS * 70 + 540;
    setTimeout(() => { this.hooks.sound("drop", this.panOf(to)); done(); }, total);
    this.kick();
  }
  sparkle(i: number) {
    const s = this.spools[i];
    for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color: k % 2 ? "#ffd23f" : "#ffffff" })); m.position.set(s.x, this.cap * COIL_H + 0.6, s.z); this.root.add(m); this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.9 }); }
    this.hooks.sound("done", this.panOf(i));
    this.kick();
  }
  celebrate() { this.spools.forEach((_, i) => setTimeout(() => this.sparkle(i), i * 60)); }

  // ------------------------------------------------------------ input
  private onUp = (e: PointerEvent) => {
    const d0 = this.down; this.down = null;
    if (!d0 || !this.hooks.canPlay() || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 24) return;
    const r = this.renderer.domElement.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = Infinity;
    this.spools.forEach((s, i) => {
      // the whole spool column counts: from its base to its top
      const a = this.screen(new THREE.Vector3(s.x, 0.1, s.z)), b = this.screen(new THREE.Vector3(s.x, this.cap * COIL_H + 0.5, s.z));
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / Math.max(1, (b.x - a.x) ** 2 + (b.y - a.y) ** 2)));
      const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t, d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = i; }
    });
    const unit = this.unitPx();
    if (best >= 0 && bd < unit * 0.75) this.hooks.tap(best);
  };
  private screen(v: THREE.Vector3) { const q = v.clone().project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }
  private unitPx() { const a = this.screen(new THREE.Vector3(0, 0, 0)), b = this.screen(new THREE.Vector3(1, 0, 0)); return Math.max(24, Math.hypot(b.x - a.x, b.y - a.y)); }
  spoolScreen(i: number) { const s = this.spools[i]; return s ? this.screen(new THREE.Vector3(s.x, this.cap * COIL_H * 0.5, s.z)) : null; }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = false;
    // the selected spool's top run floats up and bobs
    this.spools.forEach((s, i) => {
      const lift = i === this.sel ? 0.55 + Math.sin((now - this.selAt) / 180) * 0.05 : 0;
      const n = s.rings.length, topRun = i === this.sel ? this.topRunLen(i) : 0;
      s.rings.forEach((coil, k) => coil.forEach((m, r) => {
        if (this.flying.some((f) => f.m === m)) return;
        const base = this.slotPos(i, k); const want = base.y + r * RING_H + RING_H / 2 + (k >= n - topRun ? lift : 0);
        m.position.y += (want - m.position.y) * Math.min(1, dt * 14); m.position.x = s.x; m.position.z = s.z;
        if (Math.abs(want - m.position.y) > 0.002) moving = true;
      }));
      if (i === this.shakeI && now - this.shakeAt < 380) { s.g.position.x = s.x + Math.sin((now - this.shakeAt) / 25) * 0.08; moving = true; } else s.g.position.x = s.x;
    });
    if (this.sel >= 0) moving = true;
    // flying rings: up, over, down, spinning as they wind
    this.flying = this.flying.filter((f) => {
      const u = (now - f.t0) / f.dur;
      if (u < 0) return true;
      const e = Math.min(1, u), ee = e < 0.5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2;
      const peak = Math.max(f.from.y, f.to.y) + 1.4;
      f.m.position.set(f.from.x + (f.to.x - f.from.x) * ee, f.from.y + (f.to.y - f.from.y) * ee + Math.sin(e * Math.PI) * (peak - Math.max(f.from.y, f.to.y)), f.from.z + (f.to.z - f.from.z) * ee);
      f.m.rotation.z += dt * 12;
      return u < 1;
    });
    if (this.flying.length) moving = true;
    for (const p of this.parts) { p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 6; p.life -= dt; }
    this.parts = this.parts.filter((p) => { if (p.life > 0) return true; this.root.remove(p.m); return false; });
    if (this.parts.length) moving = true;
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
  };
  private colorsCache: number[][] = [];
  /** the selected spool's top run length (set by the app before selecting) */
  setColors(spools: number[][]) { this.colorsCache = spools; }
  private topRunLen(i: number) { const s = this.colorsCache[i]; return s && s.length ? run(s) : 0; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.gov.dispose();
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function twistTex() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 32);
  // diagonal twist lines like a braided rope
  for (let x = -32; x < 160; x += 10) { g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.stroke(); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 4, 32); g.lineTo(x + 20, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function qTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(30,30,40,.85)"; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.font = "900 40px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
