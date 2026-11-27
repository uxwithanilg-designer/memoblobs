// The Flutter Pairs board in 3D (three.js): soft felt blocks with stitched edges and little faces stacked on wooden
// stumps, a leafy rope hanging across at the height limit, and a wooden belt along the bottom carrying the next blocks
// (the one in your hand rides up front). Drop a block: it hops in an arc to the stack; a matching pair sprouts felt
// wings and flutters away; a full stack that gets the wrong block wobbles and topples. Renders only while something
// moves (a slow idle tick for the blinking faces and swaying rope).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { ERASE, type Stack } from "../engine";
import { BLOCK_COLS } from "../stage";

export type SceneSound = "hop" | "land" | "pop" | "flap" | "topple" | "erase" | "belt" | "select" | "swap" | "deny";
export interface SceneHooks { canPlay: () => boolean; tapStack: (i: number) => void; tapBlock: (stack: number, k: number) => void; sound: (e: SceneSound, pan: number) => void }

const GAP = 1.38, BH = 0.6, BW = 0.94;
interface Fly { g: THREE.Group; v: THREE.Vector3; t0: number; wings: THREE.Mesh[] }

function feltTexture(color: string, face: boolean) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, 128, 96);
  // felt fuzz
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.08})`; g.fillRect(Math.random() * 128, Math.random() * 96, 2, 2); }
  // a stitched border
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3; g.setLineDash([7, 6]); g.strokeRect(10, 10, 108, 76); g.setLineDash([]);
  if (face) {
    g.fillStyle = "#2a1a1a";
    g.beginPath(); g.ellipse(46, 44, 6, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(82, 44, 6, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(48, 41, 2.2, 0, Math.PI * 2); g.arc(84, 41, 2.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a1a1a"; g.lineWidth = 3; g.beginPath(); g.arc(64, 56, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = "rgba(255,120,140,.45)"; g.beginPath(); g.ellipse(34, 58, 7, 4, 0, 0, Math.PI * 2); g.ellipse(94, 58, 7, 4, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture(top: boolean) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  if (top) {
    g.fillStyle = "#e8c48a"; g.fillRect(0, 0, 128, 128);
    for (let r = 58; r > 4; r -= 7) { g.strokeStyle = `rgba(150,96,50,${0.35 + (r % 14) / 60})`; g.lineWidth = 2.5; g.beginPath(); g.arc(64 + Math.sin(r) * 2, 64, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = "#8a5a2a"; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.stroke();
  } else {
    g.fillStyle = "#8a5a32"; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 6) { g.strokeStyle = `rgba(60,34,14,${0.2 + Math.random() * 0.3})`; g.lineWidth = 2 + Math.random() * 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.random() * 6 - 3, 128); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class FlutterScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardG = new THREE.Group();
  private blockGeo = new RoundedBoxGeometry(BW, BH * 0.94, 0.8, 3, 0.14);
  private mats: THREE.MeshStandardMaterial[][] = [];       // [color][0 plain, 1 with a face]
  private eraseMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
  private wingGeo = new THREE.CircleGeometry(0.32, 20);
  private wingMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  private stacks: THREE.Group[][] = [];
  private data: Stack[] = [];
  private beltBlocks: THREE.Group[] = [];
  private flies: Fly[] = [];
  private hops: { g: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; done: () => void }[] = [];
  private falls: { g: THREE.Group; v: THREE.Vector3; spin: THREE.Vector3; t0: number }[] = [];
  private shake: { i: number; t0: number } | null = null;
  private highlight = -1; private selBlock: [number, number] | null = null; private hint = -1; private hintAt = 0;
  private cap = 4; private n = 3;
  private rope: THREE.Mesh | null = null; private leaves: THREE.Mesh[] = [];
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true; private idle = 0;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private shadows: boolean;
  private ray = new THREE.Raycaster(); private ndc = new THREE.Vector2(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); private hit = new THREE.Vector3();
  private down: { x: number; y: number } | null = null;
  private tmp = new THREE.Vector3();

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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc8a888, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-3, 8, 7); sun.castShadow = this.shadows; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -4 }); sun.shadow.bias = -0.002;
    this.scene.add(sun, sun.target, this.root);
    this.root.add(this.boardG);
    this.mats = BLOCK_COLS.map((c) => [new THREE.MeshStandardMaterial({ map: feltTexture(c, false), roughness: 0.95 }), new THREE.MeshStandardMaterial({ map: feltTexture(c, true), roughness: 0.95 })]);
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
    this.frame3(); this.kick();
  }
  private frame3() {
    const bw = this.n * GAP + 0.6, top = this.ropeY() + 1.0, bottom = -2.3;
    const bh = top - bottom;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(bw / 2 / Math.tan(hf / 2), bh / 2 / Math.tan(vf / 2)) * 1.04;
    const cy = (top + bottom) / 2;
    this.camera.position.set(0, cy + dist * 0.18, dist);
    this.camera.lookAt(0, cy, 0);
    this.camera.updateProjectionMatrix();
  }
  private ropeY() { return 0.18 + this.cap * BH + 0.12; }
  stackX(i: number) { return (i - (this.n - 1) / 2) * GAP; }
  slotPos(i: number, k: number, out = new THREE.Vector3()) { return out.set(this.stackX(i), 0.18 + BH * 0.5 + k * BH, 0); }
  private beltPos(k: number, out = new THREE.Vector3()) {
    // the hand block sits big at the front left of the belt; the next ones follow, smaller
    if (k === 0) return out.set(-((this.n - 1) / 2) * GAP + 0.1, -1.55, 0.9);
    return out.set(-((this.n - 1) / 2) * GAP + 0.75 + k * 0.72, -1.72, 0.7);
  }
  private panOf(i: number) { return this.n > 1 ? ((i / (this.n - 1)) * 2 - 1) * 0.7 : 0; }

  // ------------------------------------------------------------ build
  setStage(stacks: Stack[], cap: number) {
    this.cap = cap; this.n = stacks.length;
    for (const c of [...this.boardG.children]) { this.boardG.remove(c); if (c instanceof THREE.Mesh && c.geometry !== this.wingGeo) c.geometry.dispose(); }
    for (const col of this.stacks) for (const g of col) this.root.remove(g);
    for (const g of this.beltBlocks) this.root.remove(g);
    for (const f of this.flies) this.root.remove(f.g);
    for (const f of this.falls) this.root.remove(f.g);
    this.stacks = []; this.beltBlocks = []; this.flies = []; this.falls = []; this.hops = []; this.leaves = [];
    // stumps
    const side = new THREE.MeshStandardMaterial({ map: woodTexture(false), roughness: 0.9 }), topM = new THREE.MeshStandardMaterial({ map: woodTexture(true), roughness: 0.85 });
    for (let i = 0; i < this.n; i++) {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.6, 24), [side, topM, side]);
      stump.position.set(this.stackX(i), -0.12, 0); stump.castShadow = this.shadows; stump.receiveShadow = this.shadows; this.boardG.add(stump);
      const root = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.08, 8, 24), side); root.rotation.x = Math.PI / 2; root.position.set(this.stackX(i), -0.4, 0); this.boardG.add(root);
    }
    // a soft felt ground strip
    const ground = new THREE.Mesh(new RoundedBoxGeometry(this.n * GAP + 2.4, 0.3, 3.2, 3, 0.14), new THREE.MeshStandardMaterial({ color: "#8fcf6a", roughness: 1 }));
    ground.position.set(0, -0.58, 0.4); ground.receiveShadow = this.shadows; this.boardG.add(ground);
    // the belt: a wooden plank with rollers
    const belt = new THREE.Mesh(new RoundedBoxGeometry(this.n * GAP + 1.2, 0.22, 1.1, 2, 0.08), new THREE.MeshStandardMaterial({ map: woodTexture(false), roughness: 0.85 }));
    belt.position.set(0, -2.05, 0.75); belt.receiveShadow = this.shadows; this.boardG.add(belt);
    // the rope with leaves: a sagging line across all stacks at the height limit
    const y = this.ropeY(), x0 = this.stackX(0) - 0.9, x1 = this.stackX(this.n - 1) + 0.9;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * 0.12, 0.5)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 6), new THREE.MeshStandardMaterial({ color: "#b08a5a", roughness: 0.9 }));
    this.boardG.add(this.rope);
    const leafGeo = new THREE.SphereGeometry(0.1, 8, 6); leafGeo.scale(1.6, 0.6, 0.4);
    const leafMat = new THREE.MeshStandardMaterial({ color: "#5abf4a", roughness: 0.7 });
    for (let k = 1; k < 12; k++) { const p = curve.getPoint(k / 12); const l = new THREE.Mesh(leafGeo, leafMat); l.position.copy(p).add(new THREE.Vector3(0, -0.05, 0.02)); l.rotation.z = (k % 2 ? 1 : -1) * 0.7; this.boardG.add(l); this.leaves.push(l); }
    for (const x of [x0, x1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, y + 0.6, 8), side); post.position.set(x, (y - 0.6) / 2, 0.5); this.boardG.add(post); }
    this.syncStacks(stacks);
    this.frame3(); this.kick();
  }
  private block(c: number, face = true) {
    const g = new THREE.Group();
    if (c === ERASE) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), this.eraseMat); g.add(ball);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: "#ff5a8a" })); band.rotation.y = Math.PI / 2; g.add(band);
      return g;
    }
    const mats = this.mats[c % this.mats.length];
    // the face only on the front (+z) side
    const m = new THREE.Mesh(this.blockGeo, [mats[0], mats[0], mats[0], mats[0], face ? mats[1] : mats[0], mats[0]]);
    m.castShadow = this.shadows; g.add(m);
    return g;
  }
  /** show the stacks exactly (instantly) */
  syncStacks(stacks: Stack[]) {
    this.data = stacks.map((s) => s.slice());
    for (const col of this.stacks) for (const g of col) this.root.remove(g);
    this.stacks = stacks.map((s, i) => s.map((c, k) => { const g = this.block(c); this.slotPos(i, k, g.position); this.root.add(g); return g; }));
    this.kick();
  }
  /** show the belt: the hand and the next five */
  syncBelt(next: number[], slide = false) {
    for (const g of this.beltBlocks) this.root.remove(g);
    this.beltBlocks = next.slice(0, 6).map((c, k) => {
      const g = this.block(c, k === 0); this.beltPos(k, g.position);
      g.scale.setScalar(k === 0 ? 1 : 0.62);
      if (slide) { g.position.x += 0.72; g.userData.slide = performance.now(); }
      this.root.add(g); return g;
    });
    if (slide) this.hooks.sound("belt", 0);
    this.kick();
  }

  // ------------------------------------------------------------ moves
  /** the hand block hops onto stack i; then the outcome plays; `done` when it's all settled */
  play(i: number, out: "pop" | "push" | "erase" | "topple", color: number, done: () => void) {
    const hand = this.beltBlocks.shift(); if (!hand) { done(); return; }
    const col = this.stacks[i];
    const k = out === "push" || out === "topple" ? col.length : Math.max(0, col.length - 1);
    const to = this.slotPos(i, out === "pop" || out === "erase" ? col.length : k);
    hand.scale.setScalar(1);
    this.hooks.sound("hop", this.panOf(i));
    hand.userData.hop = true;
    this.hops.push({ g: hand, from: hand.position.clone(), to, t0: performance.now(), dur: 360, done: () => {
      if (out === "push") { col.push(hand); this.squash(hand); this.hooks.sound("land", this.panOf(i)); setTimeout(done, 120); }
      else if (out === "pop") { const top = col.pop(); this.flyAway(hand, -1); if (top) this.flyAway(top, 1); this.hooks.sound("pop", this.panOf(i)); setTimeout(() => this.hooks.sound("flap", this.panOf(i)), 120); setTimeout(done, 420); }
      else if (out === "erase") { const top = col.pop(); this.root.remove(hand); if (top) this.poof(top); this.hooks.sound("erase", this.panOf(i)); setTimeout(done, 380); }
      else { col.push(hand); this.topple(i); setTimeout(done, 900); }
    } });
    void color;
    this.kick();
  }
  /** the move power: a stack's top block hops onto another stack */
  moveTop(from: number, to: number, out: "pop" | "push", done: () => void) {
    const a = this.stacks[from], b = this.stacks[to];
    const g = a.pop(); if (!g) { done(); return; }
    const dest = this.slotPos(to, out === "pop" ? b.length : b.length);
    this.hooks.sound("hop", this.panOf(to));
    g.userData.hop = true;
    this.hops.push({ g, from: g.position.clone(), to: dest, t0: performance.now(), dur: 380, done: () => {
      if (out === "push") { b.push(g); this.squash(g); this.hooks.sound("land", this.panOf(to)); setTimeout(done, 120); }
      else { const top = b.pop(); this.flyAway(g, -1); if (top) this.flyAway(top, 1); this.hooks.sound("pop", this.panOf(to)); setTimeout(done, 420); }
    } });
    this.kick();
  }
  private squash(g: THREE.Group) { g.userData.squash = performance.now(); }
  private flyAway(g: THREE.Group, side: number) {
    // two felt wings sprout and flap; the block flutters up and away
    const wings: THREE.Mesh[] = [];
    for (const s of [-1, 1]) { const w = new THREE.Mesh(this.wingGeo, this.wingMat); w.scale.set(1, 0.6, 1); w.position.set(s * 0.5, 0.12, -0.1); w.rotation.y = s * 0.4; g.add(w); wings.push(w); }
    this.flies.push({ g, v: new THREE.Vector3(side * (0.6 + Math.random() * 0.6), 3.2 + Math.random(), 0.4), t0: performance.now(), wings });
  }
  private poof(g: THREE.Group) { g.userData.poof = performance.now(); this.flies.push({ g, v: new THREE.Vector3(0, 0, 0), t0: performance.now(), wings: [] }); }
  private topple(i: number) {
    this.shake = { i, t0: performance.now() };
    setTimeout(() => {
      const col = this.stacks[i]; this.stacks[i] = [];
      col.forEach((g, k) => this.falls.push({ g, v: new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2), 2 + k * 0.4, 1 + Math.random()), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, (Math.random() - 0.5) * 8), t0: performance.now() }));
      this.hooks.sound("topple", this.panOf(i));
    }, 380);
    this.kick();
  }
  /** swap two blocks (positions only; the app keeps the data) */
  swapBlocks(a: [number, number], b: [number, number], done: () => void) {
    const ga = this.stacks[a[0]][a[1]], gb = this.stacks[b[0]][b[1]];
    if (!ga || !gb) { done(); return; }
    this.stacks[a[0]][a[1]] = gb; this.stacks[b[0]][b[1]] = ga;
    ga.userData.hop = true; gb.userData.hop = true;
    this.hops.push({ g: ga, from: ga.position.clone(), to: this.slotPos(b[0], b[1]), t0: performance.now(), dur: 360, done: () => undefined });
    this.hops.push({ g: gb, from: gb.position.clone(), to: this.slotPos(a[0], a[1]), t0: performance.now(), dur: 360, done });
    this.hooks.sound("swap", 0);
    this.kick();
  }
  setHighlight(i: number) { this.highlight = i; this.kick(); }
  setSelBlock(b: [number, number] | null) { this.selBlock = b; this.kick(); }
  showHint(i: number) { this.hint = i; this.hintAt = performance.now(); this.kick(); }
  deny(i: number) { this.shake = { i, t0: performance.now() - 200 }; this.hooks.sound("deny", this.panOf(i)); this.kick(); }
  get busy() { return this.hops.length > 0 || this.falls.length > 0; }
  stackScreen(i: number) { const q = this.slotPos(i, 1).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }

  // ------------------------------------------------------------ input
  private onUp = (e: PointerEvent) => {
    const d0 = this.down; this.down = null;
    if (!d0 || !this.hooks.canPlay() || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 24) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    // the nearest stack column (from the stump up past the rope)
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.n; i++) { const d = Math.abs(this.hit.x - this.stackX(i)); if (d < bd) { bd = d; best = i; } }
    if (best < 0 || bd > GAP * 0.55 || this.hit.y < -0.6 || this.hit.y > this.ropeY() + 1.2) return;
    const k = Math.floor((this.hit.y - 0.18) / BH);
    if (k >= 0 && k < this.data[best]?.length) this.hooks.tapBlock(best, k);
    this.hooks.tapStack(best);
  };
  setData(stacks: Stack[]) { this.data = stacks.map((s) => s.slice()); }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = this.hops.length > 0 || this.flies.length > 0 || this.falls.length > 0;
    for (let k = this.hops.length - 1; k >= 0; k--) {
      const h = this.hops[k], u = Math.min(1, (now - h.t0) / h.dur), e = u * u * (3 - 2 * u);
      h.g.position.lerpVectors(h.from, h.to, e); h.g.position.y += Math.sin(u * Math.PI) * 1.2; h.g.position.z += Math.sin(u * Math.PI) * 0.4;
      h.g.rotation.z = Math.sin(u * Math.PI) * 0.3;
      if (u >= 1) { h.g.position.copy(h.to); h.g.rotation.z = 0; h.g.userData.hop = false; this.hops.splice(k, 1); h.done(); }
    }
    for (let k = this.flies.length - 1; k >= 0; k--) {
      const f = this.flies[k], t = (now - f.t0) / 1000;
      if (f.g.userData.poof) { f.g.scale.setScalar(Math.max(0.01, 1 - t * 3)); if (t > 0.35) { this.root.remove(f.g); this.flies.splice(k, 1); } continue; }
      f.g.position.addScaledVector(f.v, dt); f.g.position.x += Math.sin(t * 9) * 0.02;
      f.g.rotation.z = Math.sin(t * 7) * 0.25;
      for (const w of f.wings) w.rotation.y = (w.position.x < 0 ? -1 : 1) * (0.4 + Math.sin(now / 45) * 0.9);
      f.g.scale.setScalar(Math.max(0.3, 1 - t * 0.35));
      if (t > 1.6) { this.root.remove(f.g); this.flies.splice(k, 1); }
    }
    for (let k = this.falls.length - 1; k >= 0; k--) {
      const f = this.falls[k], t = (now - f.t0) / 1000;
      f.v.y -= 12 * dt; f.g.position.addScaledVector(f.v, dt); f.g.rotation.x += f.spin.x * dt; f.g.rotation.y += f.spin.y * dt; f.g.rotation.z += f.spin.z * dt;
      if (t > 1.6) { this.root.remove(f.g); this.falls.splice(k, 1); }
    }
    // stacks: squash on landing, a wobble before a topple, the selected stack lifts a touch
    for (let i = 0; i < this.stacks.length; i++) { const col = this.stacks[i]; for (let k = 0; k < col.length; k++) { const g = col[k];
      if (g.userData.hop) continue;
      const sq = g.userData.squash ? Math.max(0, 1 - (now - g.userData.squash) / 180) : 0;
      g.scale.set(1 + sq * 0.12, 1 - sq * 0.16, 1 + sq * 0.12);
      if (sq > 0) moving = true;
      const lift = i === this.highlight ? 0.12 + Math.sin(now / 180) * 0.03 : 0;
      const sel = this.selBlock && this.selBlock[0] === i && this.selBlock[1] === k ? 0.18 : 0;
      this.slotPos(i, k, this.tmp); g.position.set(this.tmp.x, this.tmp.y + lift + sel, sel ? 0.3 : 0);
      if (this.shake && this.shake.i === i && now - this.shake.t0 < 400) { g.rotation.z = Math.sin((now - this.shake.t0) / 30) * 0.08 * (k + 1) / col.length; moving = true; } else g.rotation.z = 0;
    } }
    if (this.highlight >= 0 || this.selBlock) moving = true;
    // the belt slides in
    for (let k = 0; k < this.beltBlocks.length; k++) { const g = this.beltBlocks[k]; if (!g.userData.slide) continue; const u = Math.min(1, (now - g.userData.slide) / 260); this.beltPos(k, this.tmp); g.position.x = this.tmp.x + (1 - u * u * (3 - 2 * u)) * 0.72; if (u >= 1) g.userData.slide = 0; else moving = true; }
    // the hand block bobs, the rope's leaves sway, the hint stack pulses
    if (this.beltBlocks[0]) { this.beltPos(0, this.tmp); this.beltBlocks[0].position.y = this.tmp.y + Math.sin(now / 300) * 0.05; }
    for (let k = 0; k < this.leaves.length; k++) this.leaves[k].rotation.x = Math.sin(now / 700 + k) * 0.3;
    if (this.hint >= 0) { const u = (now - this.hintAt) / 2500; if (u > 1) this.hint = -1; else { const col = this.stacks[this.hint]; const top = col[col.length - 1]; if (top) top.position.y += Math.abs(Math.sin(now / 150)) * 0.15; moving = true; } }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else if (!this.idle) this.idle = window.setTimeout(() => { this.idle = 0; this.kick(); }, 90);
  };

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
