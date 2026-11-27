// The Skyrift Gems board in 3D (three.js): a cream candy tray with tan checker cells, frosted ice plates, and glossy
// jelly-candy gems in six shapes and colours (heart, drop, rounded triangle, ring, diamond, square) that catch the light. Line gems carry white
// stripes, bombs a pulsing halo, prisms are rainbow stars; rocks and treasure chests sit among them. Swaps slide, bad
// swaps bounce back, matches pop with sparkles, blasts streak across the board, gems drop in with a bounce, and a
// shuffle spins everything. Renders only while something moves (a slow idle tick for the halos).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { CHEST, NONE, ROCK, S_BOMB, S_COL, S_PRISM, S_ROW, type Board, type Step } from "../engine";
import { GEM_COLS } from "../stage";

export type SceneSound = "swap" | "bad" | "match" | "make" | "line" | "bomb" | "prism" | "ice" | "rock" | "chest" | "land" | "shuffle";
export interface SceneHooks { canPlay: () => boolean; swap: (a: number, b: number) => void; tap: (i: number) => void; sound: (e: SceneSound, pan: number, chain?: number) => void }

interface Piece { g: THREE.Group; c: number; s: number; hp: number; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; pop: number; spin: number }
const POOL = 48;

export class SkyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardG = new THREE.Group();
  private b: Board | null = null;
  private pieces = new Map<number, Piece>();
  private dying: Piece[] = [];
  private iceMeshes = new Map<number, THREE.Mesh>();
  private gemGeo: THREE.BufferGeometry[];
  private gemMat: THREE.MeshStandardMaterial[];
  private prismGeo = new THREE.OctahedronGeometry(0.36, 0);
  private prismMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2, flatShading: true, emissive: "#ffffff", emissiveIntensity: 0.15 });
  private stripeMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  private shineGeo = new THREE.CircleGeometry(0.075, 16).scale(1.6, 0.8, 1);
  private shineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthWrite: false });
  private haloMat = new THREE.MeshBasicMaterial({ color: "#fff6b0", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  private rockMat = new THREE.MeshStandardMaterial({ color: "#8a8a96", roughness: 0.9, flatShading: true });
  private rockMat2 = new THREE.MeshStandardMaterial({ color: "#5a5a66", roughness: 0.95, flatShading: true });
  private chestMat = new THREE.MeshStandardMaterial({ color: "#a0602a", roughness: 0.6 });
  private goldMat = new THREE.MeshStandardMaterial({ color: "#ffd23a", roughness: 0.25, metalness: 0.8 });
  private iceMat = new THREE.MeshStandardMaterial({ color: "#c8f0ff", roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55 });
  private iceMat2 = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.75 });
  private plateA = new THREE.MeshStandardMaterial({ color: "#fbe6c6", roughness: 0.85 });
  private plateB = new THREE.MeshStandardMaterial({ color: "#e6c294", roughness: 0.85 });
  private grassMat = new THREE.MeshStandardMaterial({ color: "#f7dcb4", roughness: 0.55 });   // the tray's rim
  private soilMat = new THREE.MeshStandardMaterial({ color: "#c89a64", roughness: 0.8 });    // the tray's floor
  private sel = -1; private selMesh: THREE.Mesh;
  private hintPair: [number, number] | null = null; private hintAt = 0;
  private sparkGeo = new THREE.OctahedronGeometry(0.07);
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private sparkPool: THREE.Mesh[] = [];
  private beams: { m: THREE.Mesh; t0: number }[] = [];
  private beamGeo = new THREE.PlaneGeometry(1, 0.34);
  private queue: { step: Step; done?: () => void }[] = [];
  private stepEnd = 0;
  private onIdle: (() => void) | null = null;
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true; private idle = 0;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private down: { x: number; y: number; i: number } | null = null;
  private ray = new THREE.Raycaster(); private ndc = new THREE.Vector2(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3); private hit = new THREE.Vector3();
  private tmp = new THREE.Vector3(); private bA = new THREE.Vector3(); private bB = new THREE.Vector3();

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    const q = autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), alpha: true, powerPreference: "high-performance", stencil: false });
    const pr = pixelRatioFor(q);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    // no tone mapping: the candy colours stay bright and saturated
    this.renderer.toneMapping = THREE.NoToneMapping;
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb89a8a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 5, 8); this.scene.add(sun);
    this.scene.add(this.root); this.root.add(this.boardG);
    // six jelly candies: a heart, a drop, a rounded triangle, a ring, a diamond and a square — soft, puffy and glossy
    this.gemGeo = candyShapes();
    this.gemMat = GEM_COLS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.14, metalness: 0, emissive: c, emissiveIntensity: 0.22 }));
    // the prism's rainbow faces
    const pc = new Float32Array(this.prismGeo.attributes.position.count * 3), cc = new THREE.Color();
    for (let k = 0; k < this.prismGeo.attributes.position.count; k++) { cc.set(GEM_COLS[Math.floor(k / 3) % GEM_COLS.length]); pc.set([cc.r, cc.g, cc.b], k * 3); }
    this.prismGeo.setAttribute("color", new THREE.BufferAttribute(pc, 3));
    this.selMesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }));
    this.selMesh.visible = false; this.root.add(this.selMesh);
    for (let k = 0; k < POOL; k++) { const m = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color: "#ffffff" })); m.visible = false; this.root.add(m); this.sparkPool.push(m); }
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
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
    const b = this.b; const bw = (b?.w ?? 8) + 0.8, bh = (b?.h ?? 9) + 0.8;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(bw / 2 / Math.tan(hf / 2), bh / 2 / Math.tan(vf / 2)) * 1.02;
    this.camera.position.set(0, -dist * 0.1, dist);
    this.camera.lookAt(0, -0.1, 0);
    this.camera.updateProjectionMatrix();
  }
  cellPos(i: number, out = new THREE.Vector3()) {
    const b = this.b!; const x = i % b.w, y = Math.floor(i / b.w);
    return out.set(x - (b.w - 1) / 2, (b.h - 1) / 2 - y, 0.3);
  }
  private panOf(i: number) { const b = this.b; return b ? (((i % b.w) / Math.max(1, b.w - 1)) * 2 - 1) * 0.75 : 0; }

  // ------------------------------------------------------------ build
  setBoard(b: Board) {
    this.b = b; this.queue = []; this.sel = -1; this.selMesh.visible = false; this.hintPair = null;
    for (const c of [...this.boardG.children]) { this.boardG.remove(c); if (c instanceof THREE.Mesh) c.geometry.dispose(); }
    for (const p of this.pieces.values()) this.root.remove(p.g);
    for (const p of this.dying) this.root.remove(p.g);
    for (const m of this.iceMeshes.values()) this.root.remove(m);
    this.pieces.clear(); this.dying = []; this.iceMeshes.clear();
    // a cream candy tray with a soft rim, and tan checker cells inside
    const rim = new THREE.Mesh(new RoundedBoxGeometry(b.w + 0.55, b.h + 0.55, 0.42, 4, 0.16), this.grassMat); rim.position.z = -0.2; this.boardG.add(rim);
    const tray = new THREE.Mesh(new RoundedBoxGeometry(b.w + 0.18, b.h + 0.18, 0.2, 2, 0.08), this.soilMat); tray.position.z = -0.02; this.boardG.add(tray);
    const plate = new RoundedBoxGeometry(0.99, 0.99, 0.05, 1, 0.04);
    for (let i = 0; i < b.c.length; i++) {
      if (!b.mask[i]) continue;
      const x = i % b.w, y = Math.floor(i / b.w);
      const m = new THREE.Mesh(plate, (x + y) % 2 ? this.plateA : this.plateB); m.position.copy(this.cellPos(i)).setZ(0.05); this.boardG.add(m);
    }
    this.syncIce();
    for (let i = 0; i < b.c.length; i++) if (b.mask[i] && b.c[i] !== NONE) this.spawn(b.id[i], b.c[i], b.s[i], b.hp[i], i, 0, 0);
    this.frame3(); this.kick();
  }
  private syncIce() {
    const b = this.b!;
    for (let i = 0; i < b.c.length; i++) {
      const has = this.iceMeshes.get(i);
      if (!b.ice[i]) { if (has) { this.root.remove(has); this.iceMeshes.delete(i); } continue; }
      if (!has) { const m = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.12, 2, 0.1), this.iceMat); m.position.copy(this.cellPos(i)).setZ(0.12); this.root.add(m); this.iceMeshes.set(i, m); }
      this.iceMeshes.get(i)!.material = b.ice[i] > 1 ? this.iceMat2 : this.iceMat;
    }
  }
  private makeGroup(c: number, s: number, hp: number) {
    const g = new THREE.Group();
    if (c === ROCK) { const r = new THREE.Mesh(this.gemGeo[4], hp > 1 ? this.rockMat2 : this.rockMat); r.scale.setScalar(1.15); g.add(r); return g; }
    if (c === CHEST) {
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.42, 0.44, 2, 0.06), this.chestMat); box.position.y = -0.06; g.add(box);
      const lid = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.2, 0.48, 2, 0.08), this.goldMat); lid.position.y = 0.2; g.add(lid);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), this.goldMat); lock.position.set(0, 0.04, 0.24); g.add(lock);
      return g;
    }
    if (s === S_PRISM) { const p = new THREE.Mesh(this.prismGeo, this.prismMat); g.add(p); }
    else {
      const m = new THREE.Mesh(this.gemGeo[c % this.gemGeo.length], this.gemMat[c % this.gemMat.length]); m.scale.setScalar(1.34); g.add(m);
      // the jelly shine: a soft white glint up on the left
      const shine = new THREE.Mesh(this.shineGeo, this.shineMat); shine.position.set(-0.13, 0.15, 0.27); shine.rotation.z = 0.6; g.add(shine);
    }
    if (s === S_ROW || s === S_COL) for (const d of [-0.12, 0.12]) { const st = new THREE.Mesh(new THREE.BoxGeometry(s === S_ROW ? 0.7 : 0.06, s === S_ROW ? 0.06 : 0.7, 0.5), this.stripeMat); st.position.set(s === S_COL ? d : 0, s === S_ROW ? d : 0, 0); g.add(st); }
    if (s === S_BOMB) { const h = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.48, 24), this.haloMat); h.position.z = -0.05; g.add(h); }
    return g;
  }
  private spawn(id: number, c: number, s: number, hp: number, at: number, fromRow: number, delay: number) {
    const g = this.makeGroup(c, s, hp);
    const to = this.cellPos(at);
    const from = to.clone(); if (fromRow) from.y = (this.b!.h - 1) / 2 + fromRow;
    g.position.copy(from); this.root.add(g);
    this.pieces.set(id, { g, c, s, hp, from, to, t0: performance.now() + delay, dur: fromRow ? 180 + Math.abs(from.y - to.y) * 45 : 0, pop: 0, spin: 0 });
  }

  // ------------------------------------------------------------ playing steps
  /** run a move's steps one after another; `done` when all have played */
  playSteps(steps: Step[], board: Board, done: () => void) {
    this.b = board;
    for (const s of steps) this.queue.push({ step: s });
    // an end marker: snap everything to the final board, then tell the app
    this.queue.push({ step: { k: "swap", a: -1, b: -1, back: false }, done: () => { this.resync(); done(); } });
    this.stepEnd = 0;
    this.kick();
  }
  /** a swap that does nothing: slide and bounce back */
  bounce(a: number, c: number) { this.queue.push({ step: { k: "swap", a, b: c, back: true } }); this.hooks.sound("bad", this.panOf(a)); this.kick(); }
  private startStep(now: number) {
    const q = this.queue.shift(); if (!q) return;
    const s = q.step;
    let dur = 0;
    if (s.k === "swap") {
      if (s.a < 0) { q.done?.(); this.stepEnd = now; return; }
      const pa = this.pieceAt(s.a), pb = this.pieceAt(s.b);
      const A = this.cellPos(s.a), B = this.cellPos(s.b);
      if (pa) Object.assign(pa, { from: pa.g.position.clone(), to: s.back ? A.clone() : B.clone(), t0: now, dur: 170 });
      if (pb) Object.assign(pb, { from: pb.g.position.clone(), to: s.back ? B.clone() : A.clone(), t0: now, dur: 170 });
      if (s.back) { if (pa) pa.to = A; if (pb) pb.to = B; this.bounceA = pa ?? null; this.bounceB = pb ?? null; this.bounceAt = now; this.bounceCells = [s.a, s.b]; dur = 340; }
      else { this.hooks.sound("swap", this.panOf(s.a)); dur = 180; this.swapIds = [this.idAt(s.a), this.idAt(s.b)]; }
    } else if (s.k === "clear") {
      for (const id of s.ids) { const p = this.pieces.get(id); if (!p) continue; this.pieces.delete(id); p.pop = now; this.dying.push(p); this.burst(p.g.position, p.c); }
      for (const m of s.made) this.spawn(m.id, m.c, m.s, 0, m.i, 0, 0);
      for (const f of s.fired) this.fire(f.i, f.s, now);
      for (const r of s.rocks) { const p = this.pieceAtCell(r); if (p) { p.spin = now; } }
      if (s.ice.length) this.hooks.sound("ice", this.panOf(s.ice[0]));
      if (s.rocks.length) this.hooks.sound("rock", this.panOf(s.rocks[0]));
      if (s.chests.length) this.hooks.sound("chest", this.panOf(s.chests[0]));
      if (s.made.length) this.hooks.sound("make", this.panOf(s.made[0].i));
      if (s.cells.length && !s.chests.length) this.hooks.sound("match", this.panOf(s.cells[0]), s.chain);
      this.pendingIce = true;
      dur = 230 + (s.fired.length ? 120 : 0);
    } else if (s.k === "fall") {
      let longest = 0;
      for (let k = 0; k < s.ids.length; k++) {
        const id = s.ids[k], to = s.to[k], from = s.from[k];
        let p = this.pieces.get(id);
        if (!p) {
          const b = this.b!;
          // a new gem (its colour as it was when it dropped in): it starts above its column
          this.spawn(id, s.c[k], s.s[k], s.hp[k], to, -from, 0);
          p = this.pieces.get(id)!;
          const top = (b.h - 1) / 2 + 0.6 + (-from - 1);
          p.from.set(this.cellPos(to).x, top + 0.4, 0.3); p.g.position.copy(p.from);
        } else { p.from = p.g.position.clone(); }
        p.to = this.cellPos(to); p.t0 = now; p.dur = 150 + Math.abs(p.from.y - p.to.y) * 55;
        longest = Math.max(longest, p.dur);
      }
      dur = longest + 40;
      this.landAt = now + longest;
    } else if (s.k === "shuffle") {
      this.hooks.sound("shuffle", 0);
      this.resync(); for (const p of this.pieces.values()) p.spin = now; dur = 420;
    }
    if (this.pendingIce && s.k !== "clear") { this.syncIce(); this.pendingIce = false; }
    if (s.k === "clear") this.syncIceSoon = now + 150;
    this.stepEnd = now + dur;
    if (q.done) this.afterStep = q.done;
  }
  private afterStep: (() => void) | null = null;
  private pendingIce = false; private syncIceSoon = 0; private landAt = 0;
  private bounceA: Piece | null = null; private bounceB: Piece | null = null; private bounceAt = 0; private bounceCells: number[] = [];
  private swapIds: number[] = [];
  private idAt(i: number) { return this.b!.id[i]; }
  private pieceAt(i: number) {
    // before a swap is applied the scene still shows the old board: find the piece by position
    const at = this.cellPos(i, this.tmp);
    for (const p of this.pieces.values()) if (Math.abs(p.to.x - at.x) < 0.05 && Math.abs(p.to.y - at.y) < 0.05) return p;
    return null;
  }
  private pieceAtCell(i: number) { return this.pieceAt(i); }
  /** match the meshes to the board exactly (after a shuffle, a hammer, an undo) */
  resync() {
    const b = this.b!; const keep = new Set<number>();
    for (let i = 0; i < b.c.length; i++) {
      if (!b.mask[i] || b.c[i] === NONE) continue;
      const id = b.id[i]; keep.add(id);
      const p = this.pieces.get(id);
      if (!p || p.c !== b.c[i] || p.s !== b.s[i] || p.hp !== b.hp[i]) { if (p) this.root.remove(p.g); this.pieces.delete(id); this.spawn(id, b.c[i], b.s[i], b.hp[i], i, 0, 0); continue; }
      p.to = this.cellPos(i); p.from = p.g.position.clone(); p.t0 = performance.now(); p.dur = 220;
    }
    for (const [id, p] of [...this.pieces]) if (!keep.has(id)) { this.root.remove(p.g); this.pieces.delete(id); }
    this.syncIce(); this.kick();
  }
  private fire(i: number, s: number, now: number) {
    const at = this.cellPos(i);
    const b = this.b!;
    const beam = (horizontal: boolean, off = 0) => {
      const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color: "#fff6c8", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.scale.set(horizontal ? b.w + 1 : 1, 1, 1); if (!horizontal) { m.rotation.z = Math.PI / 2; m.scale.set(b.h + 1, 1, 1); }
      m.position.set(horizontal ? 0 : at.x + off, horizontal ? at.y + off : 0, 0.8); this.root.add(m); this.beams.push({ m, t0: now });
    };
    if (s === S_ROW || s === 7) beam(true);
    if (s === S_COL || s === 7) beam(false);
    if (s === 6) for (const d of [-1, 0, 1]) { beam(true, d); beam(false, d); }
    if (s === S_BOMB || s === 5) { const m = new THREE.Mesh(new THREE.CircleGeometry(s === 5 ? 2.6 : 1.6, 32), new THREE.MeshBasicMaterial({ color: "#ffd8a0", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(at.x, at.y, 0.8); this.root.add(m); this.beams.push({ m, t0: now }); }
    this.hooks.sound(s === S_PRISM ? "prism" : s === S_BOMB || s === 5 ? "bomb" : "line", this.panOf(i));
  }
  private burst(at: THREE.Vector3, c: number) {
    const color = c >= 0 && c < GEM_COLS.length ? GEM_COLS[c] : c === CHEST ? "#ffd23a" : "#c8c8d0";
    for (let k = 0; k < 6; k++) {
      const m = this.sparkPool.find((q) => !q.visible); if (!m) return;
      (m.material as THREE.MeshBasicMaterial).color.set(color); m.visible = true; m.position.copy(at); m.position.z = 0.6;
      const a = (k / 6) * Math.PI * 2 + Math.random();
      this.sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * 3, Math.sin(a) * 3 + 1, 1.5), life: 0.45 });
    }
  }

  // ------------------------------------------------------------ selection and hints
  select(i: number) { this.sel = i; if (i >= 0) { this.selMesh.position.copy(this.cellPos(i)).setZ(0.55); } this.selMesh.visible = i >= 0; this.kick(); }
  get selected() { return this.sel; }
  hint(a: number, c: number) { this.hintPair = [a, c]; this.hintAt = performance.now(); this.kick(); }
  get busy() { return this.queue.length > 0 || performance.now() < this.stepEnd; }

  // ------------------------------------------------------------ input
  private cellAt(cx: number, cy: number) {
    const b = this.b; if (!b) return -1;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return -1;
    const x = Math.round(this.hit.x + (b.w - 1) / 2), y = Math.round((b.h - 1) / 2 - this.hit.y);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
    const i = y * b.w + x; return b.mask[i] ? i : -1;
  }
  private onDown = (e: PointerEvent) => {
    if (!this.hooks.canPlay()) return;
    const i = this.cellAt(e.clientX, e.clientY); if (i < 0) return;
    this.down = { x: e.clientX, y: e.clientY, i };
  };
  private onMove = (e: PointerEvent) => {
    const d = this.down; if (!d || !this.b) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const cell = Math.min(this.w / (this.b.w + 1), this.h / (this.b.h + 1.5));
    if (Math.hypot(dx, dy) < cell * 0.35) return;
    this.down = null;
    const b = this.b, x = d.i % b.w, y = Math.floor(d.i / b.w);
    const [nx, ny] = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dy)];
    if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) return;
    this.select(-1);
    this.hooks.swap(d.i, ny * b.w + nx);
  };
  private onUp = () => { const d = this.down; this.down = null; if (d) this.hooks.tap(d.i); };
  screenOf(i: number) { const q = this.cellPos(i).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    // the step queue
    if (now >= this.stepEnd) {
      if (this.afterStep) { const f = this.afterStep; this.afterStep = null; f(); }
      if (this.queue.length) this.startStep(now);
    }
    if (this.syncIceSoon && now > this.syncIceSoon) { this.syncIceSoon = 0; this.syncIce(); }
    if (this.landAt && now > this.landAt) { this.landAt = 0; this.hooks.sound("land", 0); }
    let moving = this.queue.length > 0 || now < this.stepEnd || this.sparks.length > 0 || this.beams.length > 0 || this.dying.length > 0;
    for (const p of this.pieces.values()) {
      if (p.dur > 0) {
        const u = Math.max(0, Math.min(1, (now - p.t0) / p.dur));
        // falling pieces ease in and land with a small bounce
        const e = p.from.y > p.to.y + 0.01 ? (u < 1 ? u * u : 1) : u * u * (3 - 2 * u);
        p.g.position.lerpVectors(p.from, p.to, e);
        if (p.from.y > p.to.y + 0.01 && u >= 1) { const k = (now - p.t0 - p.dur) / 160; if (k < 1) { p.g.scale.set(1 + Math.sin(k * Math.PI) * 0.12, 1 - Math.sin(k * Math.PI) * 0.12, 1); moving = true; } else p.g.scale.setScalar(1); }
        if (u < 1) moving = true;
      }
      if (p.spin && now - p.spin < 420) { p.g.rotation.z = ((now - p.spin) / 420) * Math.PI * 2; moving = true; } else if (p.spin) { p.g.rotation.z = 0; p.spin = 0; }
      // a soft jelly wobble
      if (p.c >= 0 && p.c < 10) p.g.rotation.y = Math.sin(now / 1600 + p.to.x * 0.7 + p.to.y * 0.5) * 0.18;
      if (p.s === S_BOMB && p.g.children[1]) { const k = 1 + Math.sin(now / 160) * 0.12; p.g.children[1].scale.setScalar(k); }
    }
    // a swap that bounces back
    if (this.bounceA || this.bounceB) {
      const u = (now - this.bounceAt) / 340;
      if (u >= 1) { this.bounceA = this.bounceB = null; }
      else {
        const k = Math.sin(Math.min(1, u) * Math.PI) * 0.5;
        const A = this.cellPos(this.bounceCells[0], this.bA), B = this.cellPos(this.bounceCells[1], this.bB);
        if (this.bounceA) this.bounceA.g.position.lerpVectors(A, B, k);
        if (this.bounceB) this.bounceB.g.position.lerpVectors(B, A, k);
        moving = true;
      }
    }
    // pops
    for (let k = this.dying.length - 1; k >= 0; k--) {
      const p = this.dying[k], u = (now - p.pop) / 220;
      if (u >= 1) { this.root.remove(p.g); this.dying.splice(k, 1); continue; }
      p.g.scale.setScalar(1 + u * 0.5 - u * u * 1.5 > 0.01 ? 1 + u * 0.5 - u * u * 1.5 : 0.01); p.g.rotation.z += dt * 10;
    }
    for (let k = this.beams.length - 1; k >= 0; k--) {
      const bm = this.beams[k], u = (now - bm.t0) / 380;
      if (u >= 1) { this.root.remove(bm.m); if (bm.m.geometry !== this.beamGeo) bm.m.geometry.dispose(); this.beams.splice(k, 1); continue; }
      (bm.m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    }
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k]; s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt); s.life -= dt; s.m.scale.setScalar(Math.max(0.01, s.life * 2.5));
      if (s.life <= 0) { s.m.visible = false; this.sparks.splice(k, 1); }
    }
    // selection ring and hint pulse
    if (this.sel >= 0) { this.selMesh.scale.setScalar(1 + Math.sin(now / 150) * 0.06); moving = true; }
    if (this.hintPair) {
      const u = (now - this.hintAt) / 2600;
      if (u >= 1) { this.hintPair = null; }
      else for (const c of this.hintPair) { const p = this.pieceAt(c); if (p) { const k = 1 + Math.abs(Math.sin(now / 160)) * 0.2; p.g.scale.setScalar(k); } }
      moving = true;
    }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else if (!this.idle) this.idle = window.setTimeout(() => { this.idle = 0; this.kick(); }, 70);
    if (!moving && !this.queue.length && this.onIdle) { const f = this.onIdle; this.onIdle = null; f(); }
  };
  whenIdle(f: () => void) { if (!this.busy) f(); else this.onIdle = f; }

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

/** the candy shapes, each about 0.62 across, centred */
function candyShapes(): THREE.BufferGeometry[] {
  const puff = (shape: THREE.Shape, depth = 0.16) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.09, bevelSegments: 5, curveSegments: 18 });
    g.center(); g.computeVertexNormals(); return g;
  };
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.24); heart.bezierCurveTo(-0.08, -0.16, -0.3, -0.04, -0.3, 0.1); heart.bezierCurveTo(-0.3, 0.24, -0.16, 0.3, -0.08, 0.27);
  heart.bezierCurveTo(-0.03, 0.25, 0, 0.21, 0, 0.18); heart.bezierCurveTo(0, 0.21, 0.03, 0.25, 0.08, 0.27); heart.bezierCurveTo(0.16, 0.3, 0.3, 0.24, 0.3, 0.1);
  heart.bezierCurveTo(0.3, -0.04, 0.08, -0.16, 0, -0.24);
  const tri = new THREE.Shape();
  tri.moveTo(-0.26, 0.2); tri.quadraticCurveTo(0, 0.3, 0.26, 0.2); tri.quadraticCurveTo(0.3, 0.14, 0.24, 0.04); tri.lineTo(0.06, -0.22);
  tri.quadraticCurveTo(0, -0.28, -0.06, -0.22); tri.lineTo(-0.24, 0.04); tri.quadraticCurveTo(-0.3, 0.14, -0.26, 0.2);
  const drop = new THREE.SphereGeometry(0.28, 24, 18); drop.scale(0.92, 1.18, 0.82);
  const ring = new THREE.TorusGeometry(0.2, 0.12, 16, 32);
  const diamond = new RoundedBoxGeometry(0.42, 0.42, 0.3, 4, 0.11); diamond.rotateZ(Math.PI / 4);
  const square = new RoundedBoxGeometry(0.54, 0.54, 0.34, 4, 0.15);
  return [puff(heart), drop, puff(tri), ring, diamond, square];
}
