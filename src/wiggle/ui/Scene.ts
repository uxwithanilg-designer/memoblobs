// The Wiggle Way board in 3D (three.js): a side-on diorama seen slightly from above — chunky dirt blocks with thick
// grass tops, silver spikes, shiny apples with a leaf, purple plums, a spinning swirl portal, and a plump green worm of
// glossy segments with big eyes. Moves slide segment by segment, falls drop with a bounce, eating squashes the head,
// a fall into spikes or off the board flashes the worm, and a win swirls it into the portal. Renders only while
// something moves.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { GROUND, SPIKE, type Board } from "../engine";
import type { World } from "../stage";

export type SceneSound = "step" | "land" | "eat" | "plum" | "die" | "portal";
export interface SceneHooks { sound: (e: SceneSound, pan: number) => void; swipe: (d: 0 | 1 | 2 | 3) => void; canPlay: () => boolean }

interface Anim { from: THREE.Vector3[]; mid: THREE.Vector3[]; to: THREE.Vector3[]; t0: number; slide: number; fall: number; done?: () => void }

export class WiggleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardG = new THREE.Group();
  private b: Board | null = null;
  private segs: THREE.Group[] = [];
  private pos: THREE.Vector3[] = [];
  private anim: Anim | null = null;
  private items: (THREE.Group | null)[] = [];
  private portal: THREE.Group | null = null;
  private dirtMat = new THREE.MeshStandardMaterial({ color: "#a8703a", roughness: 0.9 });
  private grassMat = new THREE.MeshStandardMaterial({ color: "#5ad04a", roughness: 0.7 });
  private spikeMat = new THREE.MeshStandardMaterial({ color: "#d8dce8", roughness: 0.3, metalness: 0.6 });
  private wormMat = new THREE.MeshStandardMaterial({ color: "#6ad83a", roughness: 0.35 });
  private bellyMat = new THREE.MeshStandardMaterial({ color: "#c8f07a", roughness: 0.4 });
  private appleMat = new THREE.MeshStandardMaterial({ color: "#e8283a", roughness: 0.25 });
  private plumMat = new THREE.MeshStandardMaterial({ color: "#7a3ad8", roughness: 0.3 });
  private leafMat = new THREE.MeshStandardMaterial({ color: "#3ab84a", roughness: 0.5 });
  private stemMat = new THREE.MeshStandardMaterial({ color: "#6a4020", roughness: 0.8 });
  private whiteMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2 });
  private blackMat = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.2 });
  private segGeo = new THREE.SphereGeometry(0.46, 20, 14);
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private partGeo = new THREE.SphereGeometry(0.08, 6, 5);
  private squashAt = 0; private flashAt = 0; private winAt = 0; private dead = false;
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
    this.shadows = shadowsFor(q);
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-5, 10, 9); sun.castShadow = this.shadows; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    sun.shadow.bias = -0.0015;
    this.scene.add(sun, sun.target, this.root);
    this.root.add(this.boardG);
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", (e) => {
      const d0 = this.down; this.down = null; if (!d0 || !this.hooks.canPlay()) return;
      const dx = e.clientX - d0.x, dy = e.clientY - d0.y;
      if (Math.hypot(dx, dy) < 24) return;
      this.hooks.swipe(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : dy < 0 ? 2 : 3);
    });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }); this.io.observe(el);
    document.addEventListener("visibilitychange", this.kick);
    this.resize();
  }

  private resize() {
    this.w = this.el.clientWidth || 360; this.h = this.el.clientHeight || 640;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.frame3(); this.kick();
  }
  private frame3() {
    const b = this.b; if (!b) { this.camera.updateProjectionMatrix(); return; }
    const bw = b.w + 0.8, bh = b.h + 0.8;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(bw / 2 / Math.tan(hf / 2), bh / 2 / Math.tan(vf / 2)) * 1.04;
    this.camera.position.set(0, bh * 0.12, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }
  cellPos(i: number, out = new THREE.Vector3()) {
    const b = this.b!; const x = i % b.w, y = Math.floor(i / b.w);
    return out.set(x - (b.w - 1) / 2, y - (b.h - 1) / 2, 0);
  }
  private panOf(v: THREE.Vector3) { return this.b ? Math.max(-0.85, Math.min(0.85, v.x / (this.b.w / 2))) : 0; }

  // ------------------------------------------------------------ build
  setStage(b: Board, worm: number[], eaten: number, world: World) {
    this.b = b; this.dead = false; this.winAt = 0; this.anim = null;
    for (const c of [...this.boardG.children]) { this.boardG.remove(c); if (c instanceof THREE.Mesh || c instanceof THREE.InstancedMesh) c.geometry.dispose(); }
    for (const s of this.segs) this.root.remove(s); this.segs = []; this.pos = [];
    for (const it of this.items) if (it) this.root.remove(it); this.items = [];
    if (this.portal) this.root.remove(this.portal);
    this.dirtMat.color.set(world.dirt); this.grassMat.color.set(world.grass);
    // ground blocks (one instanced mesh) with grass caps on blocks open to the sky
    let n = 0, caps = 0, spikes = 0;
    for (let i = 0; i < b.cells.length; i++) { if (b.cells[i] === GROUND) { n++; if (i + b.w >= b.cells.length || b.cells[i + b.w] !== GROUND) caps++; } else if (b.cells[i] === SPIKE) spikes++; }
    const dirt = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), this.dirtMat, Math.max(1, n));
    const grass = new THREE.InstancedMesh(new RoundedBoxGeometry(1.06, 0.3, 1.06, 2, 0.1), this.grassMat, Math.max(1, caps));
    const spike = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.6, 8), this.spikeMat, Math.max(1, spikes * 3));
    const m = new THREE.Object3D(); const v = new THREE.Vector3();
    let di = 0, gi = 0, si = 0;
    for (let i = 0; i < b.cells.length; i++) {
      this.cellPos(i, v);
      if (b.cells[i] === GROUND) {
        m.position.copy(v); m.scale.setScalar(1); m.rotation.set(0, 0, 0); m.updateMatrix(); dirt.setMatrixAt(di++, m.matrix);
        if (i + b.w >= b.cells.length || b.cells[i + b.w] !== GROUND) { m.position.set(v.x, v.y + 0.42, v.z); m.updateMatrix(); grass.setMatrixAt(gi++, m.matrix); }
      } else if (b.cells[i] === SPIKE) {
        for (let k = 0; k < 3; k++) { m.position.set(v.x - 0.3 + k * 0.3, v.y - 0.2, v.z + (k === 1 ? 0.15 : -0.1)); m.updateMatrix(); spike.setMatrixAt(si++, m.matrix); }
      }
    }
    dirt.count = di; grass.count = gi; spike.count = si;
    for (const im of [dirt, grass, spike]) { im.castShadow = this.shadows; im.receiveShadow = this.shadows; this.boardG.add(im); }
    // items
    b.items.forEach((it, k) => {
      if (eaten & (1 << k)) { this.items.push(null); return; }
      const g = this.fruit(it.kind); g.position.copy(this.cellPos(it.at)); this.root.add(g); this.items.push(g);
    });
    // the portal: a spinning ring with a swirl disc
    const pg = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 10, 32), new THREE.MeshStandardMaterial({ color: "#ffd23a", emissive: "#ff9a1a", emissiveIntensity: 0.6, roughness: 0.3 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true }));
    disc.position.z = 0.01; pg.add(ring, disc); pg.position.copy(this.cellPos(b.portal)); this.root.add(pg); this.portal = pg;
    this.setWorm(worm, false);
    this.frame3(); this.kick();
  }
  private fruit(kind: "apple" | "plum") {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 14), kind === "apple" ? this.appleMat : this.plumMat);
    body.scale.set(1, kind === "apple" ? 0.92 : 1.05, 1); body.castShadow = this.shadows; g.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), this.stemMat); stem.position.y = 0.34; g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.leafMat); leaf.scale.set(1.4, 0.4, 0.7); leaf.position.set(0.1, 0.38, 0); leaf.rotation.z = -0.5; g.add(leaf);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 })); shine.position.set(-0.13, 0.12, 0.26); g.add(shine);
    return g;
  }
  private segment(head: boolean) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(this.segGeo, this.wormMat); s.castShadow = this.shadows; g.add(s);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), this.bellyMat); belly.position.set(0, -0.12, 0.22); belly.scale.set(1, 0.7, 0.6); g.add(belly);
    if (head) {
      for (const sx of [-0.17, 0.17]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), this.whiteMat); e.position.set(sx, 0.16, 0.36); g.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.blackMat); p.position.set(sx, 0.17, 0.5); g.add(p);
      }
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI), this.blackMat); mouth.position.set(0, -0.06, 0.44); mouth.rotation.z = Math.PI; g.add(mouth);
    }
    return g;
  }
  private ensureSegs(n: number) {
    while (this.segs.length < n) { const g = this.segment(this.segs.length === 0); this.root.add(g); this.segs.push(g); this.pos.push(new THREE.Vector3()); }
    while (this.segs.length > n) { const g = this.segs.pop()!; this.pos.pop(); this.root.remove(g); }
  }
  /** show the worm at these cells (instantly) */
  setWorm(worm: number[], kick = true) {
    this.ensureSegs(worm.length);
    worm.forEach((c, i) => { this.cellPos(c, this.pos[i]); this.segs[i].position.copy(this.pos[i]); });
    this.segs.forEach((s) => s.visible = true);
    this.dead = false; this.winAt = 0;
    if (kick) this.kick();
  }
  /** animate a move: old cells → new cells (before falling) → after falling `fell` rows */
  play(oldWorm: number[], newWorm: number[], fell: number, ate: { kind: "apple" | "plum"; k: number } | null, done: () => void) {
    const b = this.b!;
    const from = newWorm.map((_, i) => this.cellPos(oldWorm[Math.min(i, oldWorm.length - 1)]));
    // with a plum the last segment slides into the one before it
    const mid = newWorm.map((c) => this.cellPos(c + fell * b.w));
    const to = newWorm.map((c) => this.cellPos(c));
    this.ensureSegs(newWorm.length);
    this.anim = { from, mid, to, t0: performance.now(), slide: 120, fall: fell ? 90 + fell * 55 : 0, done };
    this.hooks.sound("step", this.panOf(mid[0]));
    if (ate) {
      const g = this.items[ate.k]; if (g) { this.burst(g.position, ate.kind === "apple" ? "#ff3a4a" : "#9a5aff", 12); this.root.remove(g); this.items[ate.k] = null; }
      this.squashAt = performance.now() + 60;
      this.hooks.sound(ate.kind === "apple" ? "eat" : "plum", this.panOf(mid[0]));
    }
    this.kick();
  }
  /** restore the items after an undo */
  syncItems(eaten: number) {
    const b = this.b!;
    b.items.forEach((it, k) => {
      const gone = !!(eaten & (1 << k));
      if (gone && this.items[k]) { this.root.remove(this.items[k]!); this.items[k] = null; }
      if (!gone && !this.items[k]) { const g = this.fruit(it.kind); g.position.copy(this.cellPos(it.at)); this.root.add(g); this.items[k] = g; }
    });
    this.kick();
  }
  die() { this.dead = true; this.flashAt = performance.now(); this.hooks.sound("die", 0); if (this.segs[0]) this.burst(this.segs[0].position, "#6ad83a", 16); this.kick(); }
  win() { this.winAt = performance.now(); this.hooks.sound("portal", 0); this.kick(); }
  bump() { this.squashAt = performance.now() + 30; this.kick(); }
  get busy() { return !!this.anim; }
  private burst(at: THREE.Vector3, color: string, n: number) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(this.partGeo, mat); m.position.copy(at); this.root.add(m); this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 2), life: 0.6 + Math.random() * 0.3 }); }
  }
  headScreen() { const s = this.segs[0]; if (!s) return null; const q = s.position.clone().project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    // something moving draws every frame; when idle the portal and the breathing worm tick at ~20 fps
    const moving = !!this.anim || this.parts.length > 0 || !!this.winAt || this.dead || now < this.squashAt + 200;
    const a = this.anim;
    if (a) {
      const t = now - a.t0;
      if (t < a.slide) {
        const u = t / a.slide, e = u * u * (3 - 2 * u);
        this.segs.forEach((s, i) => s.position.lerpVectors(a.from[i], a.mid[i], e));
      } else if (t < a.slide + a.fall) {
        const u = (t - a.slide) / a.fall, e = u * u;
        this.segs.forEach((s, i) => s.position.lerpVectors(a.mid[i], a.to[i], e));
      } else {
        this.segs.forEach((s, i) => { s.position.copy(a.to[i]); this.pos[i].copy(a.to[i]); });
        this.anim = null;
        if (a.fall) { this.squashAt = now + 40; this.hooks.sound("land", this.panOf(a.to[0])); }
        a.done?.();
      }
    }
    // head squash and the worm's gentle breathing wave
    const sq = Math.max(0, (this.squashAt + 160 - now) / 160);
    this.segs.forEach((s, i) => {
      const br = 1 + Math.sin(now / 260 - i * 0.7) * 0.035;
      s.scale.set(br * (1 + (i === 0 ? sq * 0.25 : 0)), br * (1 - (i === 0 ? sq * 0.2 : 0)), br);
      // face the way the head moves
      if (i === 0 && this.segs[1]) { const dx = s.position.x - this.segs[1].position.x; s.rotation.y = dx < -0.1 ? -0.45 : dx > 0.1 ? 0.45 : 0; }
    });
    if (this.dead) { const f = (now - this.flashAt) / 1000; this.wormMat.emissive.set(Math.floor(f * 8) % 2 ? "#ff2020" : "#000000"); this.wormMat.emissiveIntensity = f < 1 ? 0.7 : 0; }
    else { this.wormMat.emissive.set("#000000"); }
    if (this.winAt && this.portal) {
      // the worm spirals into the portal, head first
      const f = (now - this.winAt) / 1000;
      this.segs.forEach((s, i) => { const u = Math.max(0, Math.min(1, (f - i * 0.08) / 0.4)); s.position.lerpVectors(this.pos[i], this.portal!.position, u); s.scale.setScalar(1 - u); s.rotation.z += dt * 10 * u; });
    }
    if (this.portal) { this.portal.rotation.z += dt * 2.4; this.portal.children[1].rotation.z -= dt * 5; }
    this.items.forEach((g, k) => { if (g) { g.position.y = this.cellPos(this.b!.items[k].at).y + Math.sin(now / 400 + k) * 0.05; g.rotation.y = Math.sin(now / 700 + k) * 0.4; } });
    for (const p of this.parts) { p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.life -= dt; p.m.scale.setScalar(Math.max(0.01, p.life * 1.4)); }
    { let k = 0; for (let i = 0; i < this.parts.length; i++) { const p = this.parts[i]; if (p.life > 0) this.parts[k++] = p; else this.root.remove(p.m); } this.parts.length = k; }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else if (!this.idle) this.idle = window.setTimeout(() => { this.idle = 0; this.kick(); }, 50);
  };
  private idle = 0;

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.idle);
    this.gov.dispose();
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function swirlTex() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.4, "#9ad8ff"); gr.addColorStop(1, "#3a5ae8");
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 6;
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 3 + (k * Math.PI * 2) / 3, r = t * 56; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
