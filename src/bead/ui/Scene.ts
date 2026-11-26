// The Bead Rush track in 3D (three.js): a dark glossy runway with faint lane lines, a chain of glossy white beads that
// follows your finger, chunky rounded number blocks coloured by how many beads they cost (cheap = green → deadly =
// purple), glowing bead orbs, red minus orbs, ×2 / ½ gates, neon wall bars and a chequered finish arch. Blocks squash
// and flash while you chew them and burst when they break. The run itself lives in engine.ts (step()).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { HEAD_R, laneX, newRun, step, type Run, type RunEvent, type Track } from "../engine";

export interface SceneHooks { active: () => boolean; event: (e: RunEvent, run: Run) => void; started: () => void }

const MAX_BEADS = 260, SPACING = 0.62, VIEW = 44, POOL = 60;
const BLOCK_COLS = ["#3ad86a", "#9ae03a", "#f8d23a", "#ff9a2a", "#ff5a3a", "#f0324a", "#c03ad8", "#7a3aff"];
const WHITE = new THREE.Color("#ffffff");

function labelTex(text: string, fg = "#ffffff", bg: string | null = null) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill(); }
  g.font = `900 ${text.length > 2 ? 58 : 78}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 12; g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeText(text, 64, 68);
  g.fillStyle = fg; g.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}

export class BeadScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private root = new THREE.Group();
  private track: Track | null = null;
  run: Run | null = null;
  private target = 0; private dragFrom: { px: number; tx: number } | null = null;
  private beads: THREE.InstancedMesh; private head: THREE.Mesh; private headLabel: THREE.Sprite;
  private blocks: THREE.InstancedMesh | null = null; private blockIdx: number[][] = [];
  private orbs: THREE.InstancedMesh | null = null; private orbIdx: number[][] = [];
  private extras: THREE.Object3D[] = [];
  private labels: THREE.Sprite[] = [];
  private tex = new Map<string, THREE.CanvasTexture>();
  private dummy = new THREE.Object3D(); private col = new THREE.Color();
  /** chewed blocks still squashing: row * 16 + lane → until (ms) */
  private squash = new Map<number, number>();
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private partPool: THREE.Mesh[] = [];
  private partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private floorMat = new THREE.MeshStandardMaterial({ color: "#2e2e66", roughness: 0.45, metalness: 0.2 });
  private blockMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.05 });
  private beadMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.18, metalness: 0.1, emissive: "#b8c8ff", emissiveIntensity: 0.12 });
  private orbMat = new THREE.MeshStandardMaterial({ color: "#fff6c8", roughness: 0.15, emissive: "#ffd23a", emissiveIntensity: 0.6 });
  private minusMat = new THREE.MeshStandardMaterial({ color: "#ff3a4a", roughness: 0.25, emissive: "#ff2030", emissiveIntensity: 0.4 });
  private wallMat = new THREE.MeshBasicMaterial({ color: "#7af0ff" });
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private started = false; private ended = 0; private evs: RunEvent[] = [];
  private shake = 0; private camX = 0;

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    const q = autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), alpha: true, powerPreference: "high-performance", stencil: false });
    const pr = pixelRatioFor(q);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none", width: "100%", height: "100%" });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404070, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 9, -2); this.scene.add(key, key.target);
    this.scene.fog = new THREE.Fog(0x141432, 24, VIEW + 2);
    this.scene.add(this.root);
    const sph = new THREE.SphereGeometry(0.3, 16, 12);
    this.beads = new THREE.InstancedMesh(sph, this.beadMat, MAX_BEADS); this.beads.count = 0; this.root.add(this.beads);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 20, 14), this.beadMat); this.root.add(this.head);
    this.headLabel = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); this.headLabel.scale.setScalar(0.9); this.root.add(this.headLabel);
    for (let i = 0; i < POOL; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); s.visible = false; this.root.add(s); this.labels.push(s); }
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(this.partGeo, new THREE.MeshBasicMaterial({ color: "#ffffff" })); m.visible = false; this.root.add(m); this.partPool.push(m); }
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", () => { this.dragFrom = null; });
    cv.addEventListener("pointercancel", () => { this.dragFrom = null; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }); this.io.observe(el);
    document.addEventListener("visibilitychange", this.kick);
    this.resize();
  }

  private resize() {
    this.w = this.el.clientWidth || 360; this.h = this.el.clientHeight || 640;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    // keep all five lanes in view on a narrow phone
    this.camera.fov = this.camera.aspect < 0.7 ? 62 : 50;
    this.camera.updateProjectionMatrix();
    this.kick();
  }
  private texOf(key: string, make: () => THREE.CanvasTexture) { let t = this.tex.get(key); if (!t) { t = make(); this.tex.set(key, t); } return t; }
  private colorOf(v: number, L: number) {
    // relative to your beads: green = easy, purple = more than you have
    const r = v / Math.max(1, L);
    const i = Math.min(BLOCK_COLS.length - 1, Math.floor(r * 5));
    return BLOCK_COLS[i];
  }

  // ------------------------------------------------------------ build
  setStage(t: Track, floor: string, fog: string) {
    this.clear();
    this.track = t; this.run = newRun(t); this.target = 0; this.started = false; this.ended = 0; this.camX = 0;
    this.floorMat.color.set(floor);
    (this.scene.fog as THREE.Fog).color.set(fog);
    const len = t.end + 20, wid = t.lanes + 0.8;
    const floorM = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.3, len), this.floorMat); floorM.position.set(0, -0.15, len / 2 - 6); this.add(floorM);
    // lane lines and glowing edges
    const lineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.07 });
    for (let g = 0; g < t.lanes - 1; g++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.04, len), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(laneX(g, t.lanes) + 0.5, 0.005, len / 2 - 6); this.add(m); }
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, len), this.wallMat); e.position.set(sx * (wid / 2), 0.05, len / 2 - 6); this.add(e); }
    // blocks (one instanced mesh)
    let nb = 0, no = 0;
    for (const r of t.rows) for (const c of r.cells) { if (c?.t === "block") nb++; else if (c && (c.t === "orb" || c.t === "minus")) no++; }
    this.blocks = new THREE.InstancedMesh(new RoundedBoxGeometry(0.94, 0.9, 0.94, 3, 0.16), this.blockMat, Math.max(1, nb));
    this.orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 16, 12), this.orbMat, Math.max(1, no));
    const minus = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 16, 12), this.minusMat, Math.max(1, no));
    this.blockIdx = []; this.orbIdx = [];
    let bi = 0, oi = 0, mi = 0;
    t.rows.forEach((r, ri) => {
      const brow: number[] = [], orow: number[] = [];
      r.cells.forEach((c, li) => {
        const x = laneX(li, t.lanes);
        brow.push(-1); orow.push(-1);
        if (!c) return;
        if (c.t === "block") { this.dummy.position.set(x, 0.45, r.z); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.blocks!.setMatrixAt(bi, this.dummy.matrix); this.blocks!.setColorAt(bi, this.col.set(this.colorOf(c.v, t.start))); brow[li] = bi++; }
        else if (c.t === "orb") { this.dummy.position.set(x, 0.35, r.z); this.dummy.scale.setScalar(0.8 + Math.min(0.6, c.v * 0.06)); this.dummy.updateMatrix(); this.orbs!.setMatrixAt(oi, this.dummy.matrix); orow[li] = oi++; }
        else if (c.t === "minus") { this.dummy.position.set(x, 0.35, r.z); this.dummy.scale.setScalar(0.8 + Math.min(0.6, c.v * 0.06)); this.dummy.updateMatrix(); minus.setMatrixAt(mi, this.dummy.matrix); orow[li] = -2 - mi++; }
        else {
          // a gate: a translucent glowing panel with ×2 or ½
          const up = c.t === "x2";
          const gate = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.4), new THREE.MeshBasicMaterial({ color: up ? "#3affa0" : "#ff4a8a", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
          gate.position.set(x, 0.7, r.z); gate.userData = { row: ri, lane: li }; this.add(gate);
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texOf(up ? "x2" : "half", () => labelTex(up ? "×2" : "½", "#ffffff")), transparent: true })); s.position.set(x, 0.8, r.z - 0.05); s.scale.setScalar(0.8); s.userData = { row: ri, lane: li }; this.add(s);
        }
      });
      this.blockIdx.push(brow); this.orbIdx.push(orow);
    });
    this.blocks.count = bi; this.orbs.count = oi; minus.count = mi;
    this.blocks.instanceMatrix.needsUpdate = true; if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    this.add(this.blocks); this.add(this.orbs); this.add(minus);
    this.minusMesh = minus;
    // walls
    for (const w of t.walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, w.z1 - w.z0), this.wallMat);
      m.position.set(laneX(w.g, t.lanes) + 0.5, 0.35, (w.z0 + w.z1) / 2); this.add(m);
    }
    // the finish arch: two posts and a chequered banner
    const ck = document.createElement("canvas"); ck.width = 128; ck.height = 32; const cg = ck.getContext("2d")!;
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { cg.fillStyle = (x + y) % 2 ? "#111" : "#fff"; cg.fillRect(x * 8, y * 8, 8, 8); }
    const ct = new THREE.CanvasTexture(ck); ct.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(wid, 0.6), new THREE.MeshBasicMaterial({ map: ct, side: THREE.DoubleSide })); banner.position.set(0, 2.2, t.end); this.add(banner);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5, 10), this.wallMat); post.position.set(sx * wid / 2, 1.2, t.end); this.add(post); }
    this.syncBeads(); this.placeCamera(1);
    this.kick();
  }
  private minusMesh: THREE.InstancedMesh | null = null;
  private add(o: THREE.Object3D) { this.root.add(o); this.extras.push(o); }
  private clear() {
    for (const o of this.extras) { this.root.remove(o); if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) { if (o.geometry !== this.partGeo) o.geometry.dispose(); } }
    this.extras = []; this.blocks = null; this.orbs = null; this.minusMesh = null;
    for (const p of this.parts) p.m.visible = false; this.parts = [];
    this.squash.clear();
  }

  // ------------------------------------------------------------ input
  private onDown = (e: PointerEvent) => {
    if (!this.hooks.active()) return;
    this.dragFrom = { px: e.clientX, tx: this.target };
    if (!this.started && this.run) { this.started = true; this.hooks.started(); this.kick(); }
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragFrom || !this.track) return;
    // a full lane sweep across about 60% of the screen width
    const per = (this.track.lanes) / Math.max(220, this.w * 0.62);
    const half = (this.track.lanes - 1) / 2 + 0.2;
    this.target = Math.max(-half, Math.min(half, this.dragFrom.tx + (e.clientX - this.dragFrom.px) * per));
  };
  /** keyboard / QA: steer to a lane offset */
  steer(x: number) { this.target = x; if (!this.started && this.run && this.hooks.active()) { this.started = true; this.hooks.started(); } this.kick(); }
  begin() { if (!this.started && this.run) { this.started = true; this.hooks.started(); this.kick(); } }
  get isStarted() { return this.started; }

  // ------------------------------------------------------------ effects
  private burst(x: number, y: number, z: number, color: string, n = 10) {
    for (let k = 0; k < n; k++) {
      const m = this.partPool.find((p) => !p.visible); if (!m) break;
      (m.material as THREE.MeshBasicMaterial).color.set(color); m.visible = true; m.position.set(x, y, z); m.scale.setScalar(1);
      this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.2) * 4), life: 0.6 + Math.random() * 0.3 });
    }
  }
  private syncBeads() {
    const r = this.run; if (!r) return;
    this.head.position.set(r.x, HEAD_R, r.z);
    const n = Math.min(MAX_BEADS, Math.max(0, r.L - 1));
    // walk back along the head's path, one bead every SPACING
    let k = r.trail.length - 2, px = r.x, pz = r.z, need = SPACING, placed = 0;
    while (placed < n && k >= 0) {
      const tx = r.trail[k], tz = r.trail[k + 1];
      const d = Math.hypot(tx - px, tz - pz);
      if (d >= need) {
        const f = need / d; px += (tx - px) * f; pz += (tz - pz) * f;
        this.dummy.position.set(px, 0.3, pz); this.dummy.scale.setScalar(1 - Math.min(0.25, placed * 0.004)); this.dummy.updateMatrix();
        this.beads.setMatrixAt(placed++, this.dummy.matrix); need = SPACING;
      } else { need -= d; px = tx; pz = tz; k -= 2; }
    }
    // not enough path yet (the start): stack the rest straight behind
    while (placed < n) { pz -= SPACING; this.dummy.position.set(px, 0.3, pz); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.beads.setMatrixAt(placed++, this.dummy.matrix); }
    this.beads.count = placed; this.beads.instanceMatrix.needsUpdate = true;
    const lbl = String(r.L);
    (this.headLabel.material as THREE.SpriteMaterial).map = this.texOf("L" + lbl, () => labelTex(lbl, "#ffffff")); (this.headLabel.material as THREE.SpriteMaterial).needsUpdate = true;
    this.headLabel.position.set(r.x, 1.05, r.z);
  }
  private placeCamera(k: number) {
    const r = this.run; if (!r) return;
    this.camX += (r.x * 0.35 - this.camX) * k;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    // high behind the head, looking down the track: the head sits low on screen with the road ahead in view
    this.camera.position.set(this.camX + sh, 9.5, r.z - 5.4);
    this.camera.lookAt(this.camX * 0.6, 0, r.z + 5.2);
  }
  private labelPass() {
    const t = this.track, r = this.run; if (!t || !r) return;
    let used = 0;
    for (let ri = 0; ri < t.rows.length && used < POOL; ri++) {
      const row = t.rows[ri]; if (row.z < r.z - 2 || row.z > r.z + VIEW) continue;
      for (let li = 0; li < t.lanes && used < POOL; li++) {
        const c = r.cells[ri][li]; if (!c || !("v" in c)) continue;
        const s = this.labels[used++];
        const text = c.t === "minus" ? `-${c.v}` : c.t === "orb" ? String(c.v) : String(c.v);
        const key = (c.t === "block" ? "b" : c.t === "minus" ? "m" : "o") + text;
        const mat = s.material as THREE.SpriteMaterial;
        const tex = this.texOf(key, () => labelTex(text, c.t === "block" ? "#ffffff" : c.t === "minus" ? "#ffd0d0" : "#ffffff"));
        if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
        s.visible = true;
        const x = laneX(li, t.lanes);
        if (c.t === "block") { s.position.set(x, 0.55, row.z - 0.52); s.scale.setScalar(0.78); }
        else { s.position.set(x, 0.95, row.z); s.scale.setScalar(0.6); }
      }
    }
    for (let i = used; i < POOL; i++) this.labels[i].visible = false;
  }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.04, (now - this.last) / 1000)); this.last = now;
    const t = this.track, r = this.run;
    let moving = this.parts.length > 0 || this.squash.size > 0 || this.shake > 0.01;
    if (t && r && this.started && this.hooks.active() && (r.state === "run" || r.state === "chew")) {
      // fixed sub-steps keep the run the same at any frame rate
      let left = dt;
      while (left > 1e-4) { const h = Math.min(1 / 120, left); left -= h; this.evs.length = 0; step(t, r, h, this.target, this.evs); for (const e of this.evs) this.onEvent(e, r); if ((r.state as string) === "dead" || (r.state as string) === "done") break; }
      moving = true;
    }
    if (r) { this.syncBeads(); this.placeCamera(Math.min(1, dt * 6)); }
    this.labelPass();
    // chewed blocks squash and flash
    if (this.blocks && t && r) {
      for (const [key, until] of this.squash) {
        const ri = key >> 4, li = key & 15; const idx = this.blockIdx[ri][li];
        const u = (until - now) / 140;
        if (u <= 0 || !r.cells[ri][li]) { this.squash.delete(key); if (!r.cells[ri][li]) { this.dummy.scale.setScalar(0); } else this.dummy.scale.setScalar(1); }
        else this.dummy.scale.set(1 + u * 0.12, 1 - u * 0.14, 1 + u * 0.12);
        this.dummy.position.set(laneX(li, t.lanes), 0.45, t.rows[ri].z); this.dummy.updateMatrix(); this.blocks.setMatrixAt(idx, this.dummy.matrix);
        const c = r.cells[ri][li]; this.blocks.setColorAt(idx, this.col.set(c && c.t === "block" ? this.colorOf(c.v, r.L) : "#ffffff").lerp(WHITE, Math.max(0, u) * 0.6));
      }
      this.blocks.instanceMatrix.needsUpdate = true; if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    }
    for (const p of this.parts) { p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 8; p.life -= dt; p.m.scale.setScalar(Math.max(0.01, p.life * 1.5)); if (p.life <= 0) p.m.visible = false; }
    { let k = 0; for (let i = 0; i < this.parts.length; i++) { const p = this.parts[i]; if (p.life > 0) this.parts[k++] = p; } this.parts.length = k; }
    this.shake *= Math.pow(0.02, dt);
    // the head bobs a little while running
    if (r && r.state === "run" && this.started) this.head.position.y = HEAD_R + Math.abs(Math.sin(now / 90)) * 0.05;
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
  };
  private onEvent(e: RunEvent, r: Run) {
    const t = this.track!;
    const x = e.lane !== undefined ? laneX(e.lane, t.lanes) : r.x, z = e.row !== undefined ? t.rows[e.row].z : r.z;
    if (e.e === "bite") { this.squash.set(e.row! * 16 + e.lane!, performance.now() + 140); this.burst(r.x, 0.3, r.z + 0.2, "#ffffff", 2); this.shake = Math.max(this.shake, 0.08); }
    if (e.e === "break") { const idx = this.blockIdx[e.row!][e.lane!]; this.dummy.position.set(x, -5, z); this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); this.blocks?.setMatrixAt(idx, this.dummy.matrix); this.squash.delete(e.row! * 16 + e.lane!); this.burst(x, 0.5, z, "#ffd23a", 14); this.shake = 0.25; }
    if (e.e === "orb" || e.e === "minus") {
      const idx = this.orbIdx[e.row!][e.lane!];
      this.dummy.position.set(0, -5, 0); this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
      if (idx >= 0) { this.orbs?.setMatrixAt(idx, this.dummy.matrix); if (this.orbs) this.orbs.instanceMatrix.needsUpdate = true; }
      else if (idx <= -2 && this.minusMesh) { this.minusMesh.setMatrixAt(-2 - idx, this.dummy.matrix); this.minusMesh.instanceMatrix.needsUpdate = true; }
      this.burst(x, 0.4, z, e.e === "orb" ? "#ffe060" : "#ff3a4a", 8);
    }
    if (e.e === "x2" || e.e === "half") {
      for (const o of this.extras) if (o.userData?.row === e.row) o.visible = false;
      this.burst(x, 0.8, z, e.e === "x2" ? "#3affa0" : "#ff4a8a", 14);
    }
    if (e.e === "dead") { this.burst(r.x, 0.4, r.z, "#ffffff", 18); this.head.visible = true; this.shake = 0.4; }
    if (e.e === "done") this.burst(r.x, 1, r.z, "#ffd23a", 24);
    this.hooks.event(e, r);
  }
  headScreen() { const r = this.run; if (!r) return null; const q = new THREE.Vector3(r.x, 0.3, r.z).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }
  wake() { this.kick(); }
  /** a shield: the next block breaks for free */
  shieldOn() { if (this.run) this.run.shield = 1; }
  /** back from out-of-beads: the block that stopped you breaks and you get `n` beads */
  revive(n: number) {
    const r = this.run; if (!r || r.state !== "dead") return;
    if (r.chewing) { const [ri, li] = r.chewing; r.cells[ri][li] = null; r.chewing = null; this.onEvent({ e: "break", row: ri, lane: li }, r); }
    r.L = n; r.state = "run"; this.kick();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.gov.dispose();
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    this.clear();
    for (const t of this.tex.values()) t.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
