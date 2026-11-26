// The Neon Tac Duel board in 3D (three.js): a dark glass slab tilted toward you with glowing neon grid tubes, neon X
// and O marks (bright cores with soft additive halos, so they glow without a bloom pass), crystal pillars, marks that
// draw themselves in, drop down their column (gravity), flicker and burst when they vanish (Infinity), and a neon beam
// through the winning line. Renders only while something moves.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { PILLAR, type Rules } from "../engine";

export type SceneSound = "place" | "drop" | "vanish" | "line" | "denied" | "hover";
export interface SceneHooks { canPlay: () => boolean; tap: (cell: number) => void; sound: (e: SceneSound, pan: number) => void }

const S = 1;
interface Mark { g: THREE.Group; p: number; cell: number; t0: number; dying: number }

function glowTex(kind: "dot" | "bar" | "ring") {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  if (kind === "dot") {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else if (kind === "bar") {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.45, "rgba(255,255,255,0)"); gr.addColorStop(0.66, "rgba(255,255,255,1)"); gr.addColorStop(0.86, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class TacScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardG = new THREE.Group();
  private r: Rules = { cols: 3, rows: 3, k: 3, gravity: false, keep: 0 };
  private marks = new Map<number, Mark>();
  private dying: Mark[] = [];
  private beam: { g: THREE.Group; a: THREE.Vector3; b: THREE.Vector3; t0: number } | null = null;
  private hover = -1; private hoverMesh: THREE.Mesh;
  private texDot = glowTex("dot"); private texBar = glowTex("bar"); private texRing = glowTex("ring");
  private cols: [THREE.Color, THREE.Color, THREE.Color] = [new THREE.Color("#ff3ec8"), new THREE.Color("#22e4ff"), new THREE.Color("#b44cff")];
  private coreX = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  private coreO = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  private haloX: THREE.MeshBasicMaterial; private haloO: THREE.MeshBasicMaterial; private haloGrid: THREE.MeshBasicMaterial;
  private gridMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  private slabMat = new THREE.MeshStandardMaterial({ color: "#160a34", roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 });
  private pillarMat = new THREE.MeshStandardMaterial({ color: "#3a2a7a", emissive: "#6a3aff", emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.2, flatShading: true });
  private barGeo = new THREE.CapsuleGeometry(0.055, 0.62, 4, 10);
  private torusGeo = new THREE.TorusGeometry(0.3, 0.06, 12, 40);
  private planeGeo = new THREE.PlaneGeometry(1, 1);
  private sparkGeo = new THREE.OctahedronGeometry(0.05);
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private warn = new Set<number>();
  private pulseAt = 0;
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private ray = new THREE.Raycaster(); private ndc = new THREE.Vector2(); private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); private hit = new THREE.Vector3();
  private down: { x: number; y: number } | null = null;

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    const q = autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), alpha: true, powerPreference: "high-performance", stencil: false });
    const pr = pixelRatioFor(q);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x200a40, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-3, 8, 5); this.scene.add(key);
    this.scene.add(this.root); this.root.add(this.boardG);
    const halo = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    this.haloX = halo(this.texDot); this.haloO = halo(this.texRing); this.haloGrid = halo(this.texBar); this.haloGrid.opacity = 0.55;
    this.hoverMesh = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.08, depthWrite: false }));
    this.hoverMesh.rotation.x = -Math.PI / 2; this.hoverMesh.visible = false; this.root.add(this.hoverMesh);
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerleave", () => { this.setHover(-1); });
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
    this.frame3(); this.kick();
  }
  private frame3() {
    const bw = this.r.cols * S + 0.7, bd = this.r.rows * S + 0.7;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(bw / 2 / Math.tan(hf / 2), (bd * 0.9) / 2 / Math.tan(vf / 2)) * 1.06 + 0.8;
    this.camera.position.set(0, dist * 0.92, dist * 0.42);
    this.camera.lookAt(0, 0, 0.1);
    this.camera.updateProjectionMatrix();
  }
  cellPos(i: number, out = new THREE.Vector3()) {
    const x = i % this.r.cols, y = Math.floor(i / this.r.cols);
    return out.set((x - (this.r.cols - 1) / 2) * S, 0, (y - (this.r.rows - 1) / 2) * S);
  }
  private panOf(i: number) { const x = i % this.r.cols; return this.r.cols > 1 ? ((x / (this.r.cols - 1)) * 2 - 1) * 0.7 : 0; }

  // ------------------------------------------------------------ build
  setStage(r: Rules, cells: ArrayLike<number>, c1: string, c2: string, grid: string) {
    this.r = r;
    this.cols[0].set(c1); this.cols[1].set(c2); this.cols[2].set(grid);
    this.coreX.color.set(this.cols[0]).lerp(new THREE.Color("#ffffff"), 0.3); this.haloX.color.set(this.cols[0]);
    this.coreO.color.set(this.cols[1]).lerp(new THREE.Color("#ffffff"), 0.3); this.haloO.color.set(this.cols[1]);
    this.gridMat.color.set(this.cols[2]).lerp(new THREE.Color("#ffffff"), 0.35); this.haloGrid.color.set(this.cols[2]);
    this.pillarMat.emissive.set(this.cols[2]);
    this.clear();
    const bw = r.cols * S + 0.5, bd = r.rows * S + 0.5;
    const slab = new THREE.Mesh(new RoundedBoxGeometry(bw, 0.22, bd, 4, 0.18), this.slabMat); slab.position.y = -0.13; this.boardG.add(slab);
    // neon grid tubes: inner lines, plus a dim rounded frame
    const tube = (x: number, z: number, len: number, along: "x" | "z", dim = 1) => {
      const core = new THREE.Mesh(new THREE.BoxGeometry(along === "x" ? len : 0.045, 0.02, along === "x" ? 0.045 : len), this.gridMat);
      core.position.set(x, 0.01, z); this.boardG.add(core);
      const halo = new THREE.Mesh(this.planeGeo, this.haloGrid); halo.rotation.x = -Math.PI / 2;
      if (along === "z") halo.rotation.z = Math.PI / 2;
      halo.scale.set(len + 0.1, 0.3 * dim, 1); halo.position.set(x, 0.005, z); this.boardG.add(halo);
    };
    for (let c = 1; c < r.cols; c++) tube((c - r.cols / 2) * S, 0, r.rows * S - 0.16, "z");
    for (let y = 1; y < r.rows; y++) tube(0, (y - r.rows / 2) * S, r.cols * S - 0.16, "x");
    // gravity: a little arrow strip on top so the drop rule reads
    if (r.gravity) for (let c = 0; c < r.cols; c++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 3), this.gridMat); a.rotation.x = Math.PI / 2; a.position.copy(this.cellPos(c)).add(new THREE.Vector3(0, 0.02, -0.62)); this.boardG.add(a);
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === PILLAR) {
      const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), this.pillarMat); p.position.copy(this.cellPos(i)).setY(0.3); p.scale.set(1, 1.3, 1); p.rotation.y = Math.PI / 4; this.boardG.add(p);
      const halo = new THREE.Mesh(this.planeGeo, this.haloX.clone()); (halo.material as THREE.MeshBasicMaterial).color.set(this.cols[2]); halo.rotation.x = -Math.PI / 2; halo.scale.setScalar(1); halo.position.copy(this.cellPos(i)).setY(0.01); this.boardG.add(halo);
    }
    this.sync(cells, false);
    this.frame3(); this.kick();
  }
  private clear() {
    for (const c of [...this.boardG.children]) { this.boardG.remove(c); if (c instanceof THREE.Mesh && c.geometry !== this.planeGeo) c.geometry.dispose(); }
    for (const m of this.marks.values()) this.root.remove(m.g);
    for (const m of this.dying) this.root.remove(m.g);
    for (const p of this.parts) this.root.remove(p.m);
    this.marks.clear(); this.dying = []; this.parts = []; this.warn.clear();
    if (this.beam) { this.root.remove(this.beam.g); this.beam = null; }
  }
  private makeMark(p: number): THREE.Group {
    const g = new THREE.Group();
    if (p === 1) {
      for (const a of [Math.PI / 4, -Math.PI / 4]) { const b = new THREE.Mesh(this.barGeo, this.coreX); b.rotation.set(Math.PI / 2, 0, a); b.position.y = 0.12; g.add(b); }
      const h = new THREE.Mesh(this.planeGeo, this.haloX); h.rotation.x = -Math.PI / 2; h.scale.setScalar(1.25); h.position.y = 0.02; g.add(h);
    } else {
      const t = new THREE.Mesh(this.torusGeo, this.coreO); t.rotation.x = Math.PI / 2; t.position.y = 0.12; g.add(t);
      const h = new THREE.Mesh(this.planeGeo, this.haloO); h.rotation.x = -Math.PI / 2; h.scale.setScalar(1.05); h.position.y = 0.02; g.add(h);
    }
    return g;
  }
  /** show the marks as they are; new ones animate in (`animate`), gone ones burst */
  sync(cells: ArrayLike<number>, animate = true) {
    const now = performance.now();
    for (const [i, m] of [...this.marks]) {
      if (cells[i] !== m.p) { this.marks.delete(i); if (animate) { m.dying = now; this.dying.push(m); this.burst(i, m.p); } else this.root.remove(m.g); }
    }
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if ((p === 1 || p === 2) && !this.marks.has(i)) {
        const g = this.makeMark(p); g.position.copy(this.cellPos(i)); this.root.add(g);
        const m: Mark = { g, p, cell: i, t0: animate ? now : now - 2000, dying: 0 };
        this.marks.set(i, m);
        if (animate) this.hooks.sound(this.r.gravity ? "drop" : "place", this.panOf(i));
      }
    }
    this.kick();
  }
  /** marks that vanish on their owner's next move (Infinity rule) blink */
  setWarn(cells: number[]) { this.warn = new Set(cells); this.kick(); }
  private burst(i: number, p: number) {
    const at = this.cellPos(i);
    const mat = new THREE.MeshBasicMaterial({ color: this.cols[p - 1], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let k = 0; k < 12; k++) {
      const m = new THREE.Mesh(this.sparkGeo, mat); m.position.set(at.x, 0.2, at.z); this.root.add(m);
      const a = (k / 12) * Math.PI * 2; this.parts.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.6, 1.5 + Math.random(), Math.sin(a) * 1.6), life: 0.6 });
    }
    this.hooks.sound("vanish", this.panOf(i));
  }
  /** the neon beam through a winning line */
  winLine(line: number[], p: number) {
    const a = this.cellPos(line[0]).setY(0.2), b = this.cellPos(line[line.length - 1]).setY(0.2);
    const dir = b.clone().sub(a), len = dir.length();
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1, 4, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    const halo = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: this.texBar, color: this.cols[p - 1], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; g.add(core, halo);
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.rotation.y = -Math.atan2(dir.z, dir.x);
    core.rotation.z = Math.PI / 2;
    g.userData = { len: len + 0.7 };
    this.root.add(g);
    this.beam = { g, a, b, t0: performance.now() };
    this.pulseAt = performance.now();
    for (const i of line) this.burst(i, p);
    this.hooks.sound("line", 0);
    this.kick();
  }
  deny(i: number) { this.hooks.sound("denied", this.panOf(i)); this.pulseAt = performance.now() - 10000; this.shakeAt = performance.now(); this.kick(); }
  private shakeAt = 0;
  private hintCell = -1; private hintAt = 0; private hintMesh: THREE.Mesh | null = null;
  hint(i: number) {
    if (!this.hintMesh) { this.hintMesh = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: this.texRing, color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.hintMesh.rotation.x = -Math.PI / 2; this.root.add(this.hintMesh); }
    this.hintCell = i; this.hintAt = performance.now(); this.hintMesh.position.copy(this.cellPos(i)).setY(0.03); this.kick();
  }

  // ------------------------------------------------------------ input
  private cellAt(cx: number, cy: number) {
    const rc = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return -1;
    const x = Math.round(this.hit.x / S + (this.r.cols - 1) / 2), y = Math.round(this.hit.z / S + (this.r.rows - 1) / 2);
    if (x < 0 || y < 0 || x >= this.r.cols || y >= this.r.rows) return -1;
    return y * this.r.cols + x;
  }
  private onUp = (e: PointerEvent) => {
    const d0 = this.down; this.down = null;
    if (!d0 || !this.hooks.canPlay() || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 20) return;
    const i = this.cellAt(e.clientX, e.clientY);
    if (i >= 0) this.hooks.tap(i);
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.setHover(this.hooks.canPlay() ? this.cellAt(e.clientX, e.clientY) : -1);
  };
  private setHover(i: number) {
    if (i === this.hover) return;
    this.hover = i;
    if (i >= 0 && this.r.gravity) { const c = i % this.r.cols; this.hoverMesh.scale.set(0.96, this.r.rows - 0.04, 1); this.hoverMesh.position.copy(this.cellPos(c)).setZ(0).setY(0.004); }
    else if (i >= 0) { this.hoverMesh.scale.set(0.96, 0.96, 1); this.hoverMesh.position.copy(this.cellPos(i)).setY(0.004); }
    this.hoverMesh.visible = i >= 0;
    this.kick();
  }
  screenOf(i: number) { const q = this.cellPos(i).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = false;
    for (const m of this.marks.values()) {
      const u = (now - m.t0) / 1000;
      if (u < 0.7) {
        moving = true;
        if (this.r.gravity) {
          // fall from above the board and bounce
          const e = Math.min(1, u / 0.38), fall = (1 - e * e) * 2.4, bounce = e >= 1 ? Math.abs(Math.sin((u - 0.38) * 14)) * 0.18 * Math.max(0, 1 - (u - 0.38) / 0.3) : 0;
          m.g.position.y = fall + bounce; m.g.scale.setScalar(1);
        } else {
          // pop in with an overshoot and a quarter spin
          const e = Math.min(1, u / 0.45), s = 1 + Math.sin(e * Math.PI) * 0.25 * (1 - e) + (e < 1 ? -(1 - e) : 0);
          m.g.scale.setScalar(Math.max(0.01, s)); m.g.rotation.y = (1 - e) * 1.2; m.g.position.y = 0;
        }
      } else { m.g.scale.setScalar(1); m.g.rotation.y = 0; m.g.position.y = 0; }
      // Infinity: the mark that goes next blinks
      const halo = m.g.children[m.g.children.length - 1] as THREE.Mesh;
      if (this.warn.has(m.cell)) { const k = 0.5 + 0.5 * Math.sin(now / 110); m.g.children.forEach((c) => (c.visible = c === halo || k > 0.25)); halo.scale.setScalar((m.p === 1 ? 1.25 : 1.05) * (0.8 + k * 0.3)); moving = true; }
      else { for (const c of m.g.children) c.visible = true; }
    }
    // vanished marks shrink away
    this.dying = this.dying.filter((m) => { const u = (now - m.dying) / 300; if (u >= 1) { this.root.remove(m.g); return false; } m.g.scale.setScalar(1 - u); m.g.position.y = u * 0.5; moving = true; return true; });
    // the win beam grows end to end, then breathes
    if (this.beam) {
      const u = Math.min(1, (now - this.beam.t0) / 420), len = this.beam.g.userData.len as number;
      const core = this.beam.g.children[0], halo = this.beam.g.children[1];
      core.scale.set(1, len * u, 1); halo.scale.set(len * u, 0.7 + Math.sin(now / 120) * 0.12, 1);
      moving = true;
    }
    // the board pulses after a win, shakes after a denied tap
    const pu = (now - this.pulseAt) / 600;
    this.boardG.scale.setScalar(pu >= 0 && pu < 1 ? 1 + Math.sin(pu * Math.PI) * 0.03 : 1);
    if (pu >= 0 && pu < 1) moving = true;
    const sh = now - this.shakeAt;
    this.root.position.x = sh < 300 ? Math.sin(sh / 20) * 0.06 * (1 - sh / 300) : 0;
    if (sh < 300) moving = true;
    if (this.hintMesh) {
      const u = (now - this.hintAt) / 2400;
      this.hintMesh.visible = this.hintCell >= 0 && u < 1;
      if (this.hintMesh.visible) { this.hintMesh.scale.setScalar(1 + ((now / 600) % 1) * 0.5); (this.hintMesh.material as THREE.MeshBasicMaterial).opacity = 1 - ((now / 600) % 1); moving = true; }
    }
    for (const p of this.parts) { p.v.y -= 6 * dt; p.m.position.addScaledVector(p.v, dt); p.life -= dt; p.m.scale.setScalar(Math.max(0.01, p.life * 1.6)); }
    if (this.parts.length) { this.parts = this.parts.filter((p) => { if (p.life > 0) return true; this.root.remove(p.m); return false; }); moving = true; }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
  };

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
