// The Plank Panic workshop in 3D (three.js): a wooden board standing upright with drilled holes, planks stacked on
// it in layers (extruded with real end holes and procedural wood grain, casting soft shadows on the board) and metal
// screws with a cross slot. Tap a screw: it lifts out spinning; tap a free hole: it arcs over and screws itself in.
// A plank left on one screw swings down on a damped pendulum; a plank with none falls away, tumbling. The camera
// frames the board; the table behind is CSS (cheap). Renders only while something moves.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { canLift, freeHoles, xy, type Board, type State } from "../engine";
import type { Shop } from "../stage";

export type SceneSound = "tap" | "lift" | "screw" | "swing" | "fall" | "denied" | "clink";
export interface SceneHooks {
  canPlay: () => boolean;
  /** a tap on a screw (index) or a hole (point) */
  tapScrew: (k: number) => void;
  tapHole: (p: number) => void;
  sound: (e: SceneSound, pan: number, n?: number) => void;
}

const T = 0.16; // plank thickness
const W = 0.62; // plank width
const HOLE_R = 0.17;
interface PlankView { group: THREE.Group; mesh: THREE.Mesh; angle: number; target: number; vel: number; pivot: THREE.Vector3; falling: boolean; fallV: THREE.Vector3; spin: number; z: number }
interface ScrewView { group: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; lifted: boolean; spin: number; hop: boolean }

export class PlankScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardMesh: THREE.Mesh | null = null;
  private holeMeshes: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private planks: PlankView[] = [];
  private screws: ScrewView[] = [];
  private woodMats: THREE.MeshStandardMaterial[] = [];
  private boardMat: THREE.MeshStandardMaterial;
  private metal: THREE.MeshStandardMaterial; private slot: THREE.MeshStandardMaterial; private holeMat: THREE.MeshBasicMaterial; private ringMat: THREE.MeshBasicMaterial;
  private screwGeo: { head: THREE.CylinderGeometry; dome: THREE.SphereGeometry; slot: THREE.BoxGeometry; shank: THREE.CylinderGeometry };
  private b: Board | null = null; private s: State | null = null; private shop: Shop | null = null;
  private lifted = -1;
  private shakeAt = 0; private shakeK = -1;
  private hint: { k: number; to: number; at: number } | null = null;
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true; private idle = 0;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private shadows: boolean;
  private sun: THREE.DirectionalLight;
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private chip: THREE.BoxGeometry; private chipMat: THREE.MeshStandardMaterial;

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    const q = autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), alpha: true, powerPreference: "high-performance", stencil: false });
    const pr = pixelRatioFor(q);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.shadows = shadowsFor(q);
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6a4a30, 0.9));
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.6);
    this.sun.position.set(-4, 7, 12);
    this.sun.castShadow = this.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -8; this.sun.shadow.camera.right = 8; this.sun.shadow.camera.top = 9; this.sun.shadow.camera.bottom = -9;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.root);
    this.boardMat = new THREE.MeshStandardMaterial({ map: woodTex("#f3d9a8", 7, 0.18), roughness: 0.75 });
    this.metal = new THREE.MeshStandardMaterial({ color: "#e8c25a", metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
    this.slot = new THREE.MeshStandardMaterial({ color: "#5a4210", metalness: 0.6, roughness: 0.5 });
    this.holeMat = new THREE.MeshBasicMaterial({ color: "#2a1608" });
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#6aff8a", transparent: true, opacity: 0.85, depthWrite: false });
    this.screwGeo = { head: new THREE.CylinderGeometry(0.2, 0.2, 0.07, 28), dome: new THREE.SphereGeometry(0.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), slot: new THREE.BoxGeometry(0.26, 0.05, 0.05), shank: new THREE.CylinderGeometry(0.06, 0.04, 0.6, 10) };
    this.chip = new THREE.BoxGeometry(0.07, 0.07, 0.03); this.chipMat = new THREE.MeshStandardMaterial({ color: "#d8a870", roughness: 0.8 });
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
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
    this.frameCamera();
    this.kick();
  }
  private frameCamera() {
    const b = this.b; if (!b) { this.camera.updateProjectionMatrix(); return; }
    // fit the board (plus room for hanging planks below) in view, looking slightly down at it
    const bw = b.cols + 0.6, bh = b.rows + 0.9;
    const vf = (this.camera.fov * Math.PI) / 180;
    const dist = Math.max(bh / 2 / Math.tan(vf / 2), bw / 2 / Math.tan(vf / 2) / this.camera.aspect) * 1.12 + 1.5;
    this.camera.position.set(0, 0.9, dist);
    this.camera.lookAt(0, 0.1, 0);
    this.camera.updateProjectionMatrix();
  }
  /** a lattice point in world space */
  private wp(p: number, z = 0) { const b = this.b!; const [x, y] = xy(b, p); return new THREE.Vector3(x - (b.cols - 1) / 2, (b.rows - 1) / 2 - y, z); }
  private wpOff(x: number, y: number, z = 0) { const b = this.b!; return new THREE.Vector3(x - (b.cols - 1) / 2, (b.rows - 1) / 2 - y, z); }
  private screenOf(v: THREE.Vector3) { const q = v.clone().applyMatrix4(this.root.matrixWorld).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }
  private panOf(p: number) { const b = this.b!; return Math.max(-0.85, Math.min(0.85, ((xy(b, p)[0] + 0.5) / b.cols * 2 - 1) * 0.85)); }
  holeScreen(p: number) { return this.screenOf(this.wp(p)); }
  screwScreen(k: number) { const s = this.s; return s ? this.screenOf(this.wp(s.screws[k].at)) : null; }

  // ------------------------------------------------------------ build
  setStage(b: Board, s: State, shop: Shop) {
    this.b = b; this.shop = shop;
    this.clear();
    this.boardMat.map?.dispose();
    this.boardMat.map = woodTex(shop.board, 7, 0.16); this.boardMat.needsUpdate = true;
    this.woodMats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    this.woodMats = shop.woods.map((c, i) => new THREE.MeshStandardMaterial({ map: woodTex(c, 3 + i, 0.32), roughness: 0.62 }));
    // the board: a thick rounded slab, its edge a touch darker
    const bw = b.cols - 1 + 1.2, bh = b.rows - 1 + 1.2;
    const shape = roundRect(bw, bh, 0.35);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 });
    geo.translate(0, 0, -0.36);
    fitUV(geo, bw, bh);
    this.boardMesh = new THREE.Mesh(geo, this.boardMat);
    this.boardMesh.receiveShadow = this.shadows;
    this.root.add(this.boardMesh);
    // drilled holes: dark discs with a soft rim
    const hg = new THREE.CircleGeometry(0.2, 24), rg = new THREE.RingGeometry(0.2, 0.26, 24);
    const rimMat = new THREE.MeshBasicMaterial({ color: "#b8905a" });
    b.holes.forEach((h, p) => {
      if (!h) return;
      const m = new THREE.Mesh(hg, this.holeMat); m.position.copy(this.wp(p, 0.005)); this.root.add(m); this.holeMeshes.push(m);
      const r = new THREE.Mesh(rg, rimMat); r.position.copy(this.wp(p, 0.004)); this.root.add(r); this.holeMeshes.push(r);
    });
    this.sync(s, true);
    this.frameCamera();
    this.kick();
  }
  private clear() {
    for (const m of this.holeMeshes) this.root.remove(m);
    this.holeMeshes = [];
    for (const r of this.rings) this.root.remove(r);
    this.rings = [];
    for (const p of this.planks) { this.root.remove(p.group); p.mesh.geometry.dispose(); }
    this.planks = [];
    for (const s of this.screws) this.root.remove(s.group);
    this.screws = [];
    if (this.boardMesh) { this.root.remove(this.boardMesh); this.boardMesh.geometry.dispose(); this.boardMesh = null; }
    this.lifted = -1; this.hint = null;
  }
  private makePlank(len: number, mat: THREE.Material) {
    const L = len, r = W / 2;
    const s = new THREE.Shape();
    s.moveTo(0, -r); s.lineTo(L, -r); s.absarc(L, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, r); s.absarc(0, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
    for (const hx of [0, L]) { const h = new THREE.Path(); h.absarc(hx, 0, HOLE_R, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 14 });
    fitUV(g, L + W, W);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = this.shadows; m.receiveShadow = this.shadows;
    return m;
  }
  private makeScrew() {
    const g = new THREE.Group();
    const head = new THREE.Mesh(this.screwGeo.head, this.metal); head.rotation.x = Math.PI / 2;
    const dome = new THREE.Mesh(this.screwGeo.dome, this.metal); dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.35, 1); dome.position.z = 0.035;
    const s1 = new THREE.Mesh(this.screwGeo.slot, this.slot); s1.position.z = 0.09;
    const s2 = s1.clone(); s2.rotation.z = Math.PI / 2;
    const shank = new THREE.Mesh(this.screwGeo.shank, this.metal); shank.rotation.x = Math.PI / 2; shank.position.z = -0.32;
    g.add(head, dome, s1, s2, shank);
    g.traverse((o) => { (o as THREE.Mesh).castShadow = this.shadows; });
    return g;
  }
  private zOf(id: number) { return 0.06 + id * (T + 0.07); }
  private screwZ(pins: number[]) { return pins.length ? this.zOf(Math.max(...pins)) + T + 0.04 : 0.04; }
  private angleOf(s: State, id: number) {
    const e = s.ends[id]!;
    if (e[1] < 0) return -Math.PI / 2;
    const a = this.wp(e[0]), c = this.wp(e[1]);
    return Math.atan2(c.y - a.y, c.x - a.x);
  }

  /** match the view to a state (instantly when `snap`, otherwise planks swing / fall and screws stay put) */
  sync(s: State, snap = false) {
    const b = this.b!; this.s = s;
    // planks
    b.planks.forEach((pl, id) => {
      let v = this.planks[id];
      if (!v) {
        const group = new THREE.Group(), mesh = this.makePlank(pl.len, this.woodMats[pl.tint % this.woodMats.length]);
        group.add(mesh); this.root.add(group);
        v = { group, mesh, angle: 0, target: 0, vel: 0, pivot: new THREE.Vector3(), falling: false, fallV: new THREE.Vector3(), spin: 0, z: this.zOf(id) };
        this.planks[id] = v;
      }
      const e = s.ends[id];
      if (!e) {
        if (snap) { v.group.visible = false; v.falling = false; }
        else if (!v.falling && v.group.visible) { v.falling = true; v.fallV.set((Math.random() - 0.5) * 2, 1.5, 3 + Math.random() * 2); v.spin = (Math.random() - 0.5) * 6; this.hooks.sound("fall", 0, pl.len); this.chips(v.pivot, 10); }
        return;
      }
      v.group.visible = true; v.falling = false; v.group.rotation.set(0, 0, 0); v.group.scale.setScalar(1);
      const pivot = this.wp(e[0], v.z), target = this.angleOf(s, id);
      if (snap) { v.pivot.copy(pivot); v.angle = target; v.target = target; v.vel = 0; }
      else {
        if (!v.pivot.equals(pivot)) {
          // re-anchor at the new pivot without a jump: the plank's current direction seen from the new pivot
          const tipX = v.pivot.x + Math.cos(v.angle) * pl.len, tipY = v.pivot.y + Math.sin(v.angle) * pl.len;
          const fromOther = Math.abs(tipX - pivot.x) < 0.05 && Math.abs(tipY - pivot.y) < 0.05;
          v.angle = fromOther ? v.angle + Math.PI : v.angle;
          v.pivot.copy(pivot);
        }
        if (Math.abs(norm(target - v.angle)) > 0.01) { this.hooks.sound("swing", this.panOf(e[0])); }
        v.target = target;
        v.angle = target - norm(target - v.angle);
      }
    });
    // screws
    s.screws.forEach((q, k) => {
      let v = this.screws[k];
      const pos = this.wp(q.at, this.screwZ(q.pins));
      if (!v) { const group = this.makeScrew(); this.root.add(group); v = { group, from: pos.clone(), to: pos.clone(), t0: 0, dur: 0, lifted: false, spin: 0, hop: false }; this.screws[k] = v; }
      if (snap || v.to.distanceTo(pos) < 1e-3) { v.group.position.copy(pos); v.from.copy(pos); v.to.copy(pos); v.t0 = 0; }
      v.lifted = false;
    });
    this.lifted = -1;
    this.showRings();
    this.kick();
  }
  /** a screw lifts out (tap 1 of a move) */
  lift(k: number) {
    const v = this.screws[k], s = this.s; if (!v || !s) return;
    this.lifted = k;
    v.from.copy(v.group.position); v.to.copy(v.group.position).setZ(v.group.position.z + 0.75); v.t0 = performance.now(); v.dur = 260; v.lifted = true; v.spin = 1; v.hop = false;
    this.hooks.sound("lift", this.panOf(s.screws[k].at));
    this.showRings();
    this.kick();
  }
  /** the lifted screw is put back */
  drop() {
    const k = this.lifted; if (k < 0 || !this.s) return;
    const v = this.screws[k], q = this.s.screws[k];
    v.from.copy(v.group.position); v.to.copy(this.wp(q.at, this.screwZ(q.pins))); v.t0 = performance.now(); v.dur = 220; v.lifted = false; v.spin = -1;
    this.lifted = -1; this.showRings(); this.kick();
  }
  /** the lifted screw flies to a hole and screws in; the state is the one after the move */
  moveTo(k: number, s: State) {
    const v = this.screws[k]; if (!v) return;
    const q = s.screws[k];
    v.from.copy(v.group.position); v.to.copy(this.wp(q.at, this.screwZ(q.pins))); v.t0 = performance.now(); v.dur = 520; v.lifted = false; v.spin = -2; v.hop = true;
    this.lifted = -1;
    this.sync(s);
    setTimeout(() => this.hooks.sound("screw", this.panOf(q.at)), 360);
    this.kick();
  }
  /** the pliers pulled a screw out: rebuild the screws (the list changed), planks swing or fall as usual */
  yanked(at: number, s: State) {
    for (const v of this.screws) this.root.remove(v.group);
    this.screws = [];
    this.chips(this.wp(at, 0.4), 8);
    this.hooks.sound("clink", this.panOf(at));
    this.sync(s);
  }
  /** a screw that can't come out wiggles */
  deny(k: number) { this.shakeAt = performance.now(); this.shakeK = k; this.hooks.sound("denied", this.s ? this.panOf(this.s.screws[k].at) : 0); this.kick(); }
  showHint(k: number, to: number) { this.hint = { k, to, at: performance.now() }; this.kick(); }
  celebrate() { for (let i = 0; i < 40; i++) this.chips(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 1), 1); this.kick(); }

  private showRings() {
    for (const r of this.rings) this.root.remove(r);
    this.rings = [];
    const b = this.b, s = this.s; if (!b || !s || this.lifted < 0) return;
    const rg = new THREE.RingGeometry(0.22, 0.3, 28);
    for (const p of freeHoles(b, s, this.lifted)) { const r = new THREE.Mesh(rg, this.ringMat); r.position.copy(this.wp(p, 0.02)); this.root.add(r); this.rings.push(r); }
  }
  private chips(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.chip, this.chipMat); m.position.copy(at); this.root.add(m);
      this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, Math.random() * 3), life: 0.8 + Math.random() * 0.5 });
    }
  }

  // ------------------------------------------------------------ input: pick the nearest screw or hole on screen
  private onDown = (e: PointerEvent) => {
    const b = this.b, s = this.s; if (!b || !s || !this.hooks.canPlay()) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const near = (pt: { x: number; y: number }) => Math.hypot(pt.x - x, pt.y - y);
    const reach = Math.max(22, this.unitPx() * 0.45);
    // screws first (but a hole wins when a screw is lifted and the tap is on a hole)
    let bestK = -1, bd = reach;
    s.screws.forEach((q, k) => { if (k === this.lifted) return; const d = near(this.screenOf(this.screws[k]?.group.position ?? this.wp(q.at))); if (d < bd) { bd = d; bestK = k; } });
    let bestP = -1, bp = reach;
    b.holes.forEach((h, p) => { if (!h) return; const d = near(this.screenOf(this.wp(p))); if (d < bp) { bp = d; bestP = p; } });
    if (this.lifted >= 0) {
      const lifted = this.screws[this.lifted];
      if (lifted && near(this.screenOf(lifted.group.position)) < reach) { this.hooks.tapScrew(this.lifted); return; }
      if (bestP >= 0 && (bestK < 0 || bp <= bd + 4)) { this.hooks.tapHole(bestP); return; }
    }
    if (bestK >= 0) { this.hooks.sound("tap", this.panOf(s.screws[bestK].at)); this.hooks.tapScrew(bestK); }
    else if (bestP >= 0) this.hooks.tapHole(bestP);
  };
  private unitPx() { const a = this.screenOf(this.wpOff(0, 0)), c = this.screenOf(this.wpOff(1, 0)); return Math.hypot(c.x - a.x, c.y - a.y); }
  canLiftNow(k: number) { return !!this.b && !!this.s && canLift(this.b, this.s, k); }
  get liftedScrew() { return this.lifted; }

  // ------------------------------------------------------------ loop
  private kick = () => { this.idle = 0; if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = false;
    // planks: damped pendulum toward the target angle, or falling
    for (const v of this.planks) {
      if (!v) continue;
      if (v.falling) {
        v.fallV.y -= 18 * dt; v.group.position.addScaledVector(v.fallV, dt); v.group.rotation.z += v.spin * dt; v.group.rotation.x += v.spin * 0.4 * dt;
        if (v.group.position.y < -14) { v.falling = false; v.group.visible = false; } else moving = true;
        continue;
      }
      if (!v.group.visible) continue;
      const d = norm(v.target - v.angle);
      v.vel += (d * 60 - v.vel * 5.5) * dt;
      v.angle += v.vel * dt;
      if (Math.abs(d) < 0.002 && Math.abs(v.vel) < 0.01) { v.angle = v.target; v.vel = 0; } else moving = true;
      v.group.position.copy(v.pivot);
      v.group.rotation.set(0, 0, v.angle);
    }
    // screws: lift / fly / screw in, with spin
    for (let k = 0; k < this.screws.length; k++) {
      const v = this.screws[k]; if (!v) continue;
      if (v.t0) {
        const u = Math.min(1, (now - v.t0) / v.dur), e = 1 - (1 - u) ** 3;
        v.group.position.lerpVectors(v.from, v.to, e);
        if (v.hop) v.group.position.z += Math.sin(u * Math.PI) * 1.1;
        v.group.rotation.z += v.spin * dt * 14;
        if (u >= 1) { v.t0 = 0; v.group.position.copy(v.to); } else moving = true;
      } else if (v.lifted) { v.group.rotation.z += dt * 4; v.group.position.z = v.to.z + Math.sin(now / 160) * 0.05; moving = true; }
      if (k === this.shakeK && now - this.shakeAt < 380) { v.group.rotation.z = Math.sin((now - this.shakeAt) / 25) * 0.35; moving = true; }
    }
    // hint: pulse the screw and its hole
    if (this.hint && now - this.hint.at < 2600 && this.s) {
      const v = this.screws[this.hint.k]; if (v) { const p = 1 + Math.sin((now - this.hint.at) / 120) * 0.15; v.group.scale.setScalar(p); }
      moving = true;
    } else if (this.hint) { this.screws[this.hint.k]?.group.scale.setScalar(1); this.hint = null; }
    for (const r of this.rings) { r.scale.setScalar(1 + Math.sin(now / 180) * 0.08); moving = true; }
    // wood chips
    for (const p of this.parts) { p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 9; p.m.rotation.y += dt * 7; p.life -= dt; }
    { let k = 0; for (let i = 0; i < this.parts.length; i++) { const p = this.parts[i]; if (p.life > 0) this.parts[k++] = p; else this.root.remove(p.m); } this.parts.length = k; }
    if (this.parts.length) moving = true;
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

function norm(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2; return a; }
function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** planar UVs over an extruded shape's footprint (so the grain runs along the plank) */
function fitUV(g: THREE.BufferGeometry, w: number, h: number) {
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / Math.max(w, h) + 0.5, pos.getY(i) / Math.max(w, h) + 0.5);
  uv.needsUpdate = true;
}
/** a procedural wood-grain texture in a base colour */
function woodTex(base: string, seed: number, contrast: number): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const y = rnd() * 256, a = 0.05 + rnd() * contrast * 0.5, dark = rnd() < 0.6;
    g.strokeStyle = dark ? `rgba(80,40,10,${a})` : `rgba(255,240,210,${a * 0.8})`; g.lineWidth = 1 + rnd() * 3;
    g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / (30 + rnd() * 10) + i) * (3 + rnd() * 3)); g.stroke();
  }
  for (let k = 0; k < 2; k++) { const x = rnd() * 256, y = rnd() * 256; g.strokeStyle = `rgba(80,40,10,${contrast})`; g.lineWidth = 1.5; for (let r = 3; r < 14; r += 3) { g.beginPath(); g.ellipse(x, y, r * 2.2, r * 0.8, 0, 0, Math.PI * 2); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
