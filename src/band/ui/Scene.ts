// The Band Bend pegboard in 3D (three.js): a thick white rounded board with grey pins, each band's two nails in its own
// colour, and glossy rubber bands stretched between them. Grab a band anywhere along a line and stretch it onto a pin,
// or grab a bend and move it (drop it in open space to let it go). Bands twang when they snap onto a pin. Renders only
// while something moves.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { pointsOf, type Band } from "../engine";
import { BAND_COLS, type World } from "../stage";

export type SceneSound = "grab" | "stretch" | "snap" | "release" | "denied";
/** a finished drag: grabbed segment `seg` (new bend) or bend `hook`, dropped on `pin` (-1 = open space) */
export interface Drag { band: number; seg: number; hook: number; pin: number }
export interface SceneHooks { canPlay: () => boolean; drop: (d: Drag) => boolean; sound: (e: SceneSound, pan: number) => void }

const S = 1;            // pin spacing
const R = 0.07;         // band radius
const MAX_SEG = 8;      // segment meshes per band (4 bends + slack)
interface BandView { segs: THREE.Mesh[]; joints: THREE.Mesh[]; mat: THREE.MeshStandardMaterial; y: number }

export class BandScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private root = new THREE.Group();
  private boardG = new THREE.Group();
  private views: BandView[] = [];
  private bands: Band[] = [];
  private cols = 3; private rows = 3;
  private pinMeshes: THREE.Mesh[] = [];
  private nailMeshes: THREE.Mesh[] = [];
  private ghost: THREE.Mesh[] = [];
  private segGeo = new THREE.CylinderGeometry(R, R, 1, 12, 1, true);
  private jointGeo = new THREE.SphereGeometry(R * 1.02, 12, 8);
  private pinGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.34, 16);
  private pinCapGeo = new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  private nailGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 24);
  private pinMat = new THREE.MeshStandardMaterial({ color: "#8a94a8", roughness: 0.35, metalness: 0.4 });
  private capMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
  private boardMat = new THREE.MeshStandardMaterial({ color: "#f4f6fa", roughness: 0.55 });
  private holeMat = new THREE.MeshStandardMaterial({ color: "#dde2ea", roughness: 0.8 });
  private ghostMat = new THREE.MeshBasicMaterial({ color: "#1a2a5a", transparent: true, opacity: 0.28, depthWrite: false });
  private bandMats = BAND_COLS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.05, emissive: c, emissiveIntensity: 0.08 }));
  private hintDot: THREE.Mesh;
  private hint: { from: THREE.Vector3; to: THREE.Vector3; t0: number } | null = null;
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  private ray = new THREE.Raycaster();
  private tmpV = new THREE.Vector3(); private tmpA = new THREE.Vector3(); private tmpB = new THREE.Vector3(); private ndc = new THREE.Vector2();
  private up = new THREE.Vector3(0, 1, 0); private dir = new THREE.Vector3();
  // the drag in progress: band, segment or hook, and where the grabbed point is now
  private drag: { band: number; seg: number; hook: number; at: THREE.Vector3; moved: boolean; x0: number; y0: number } | null = null;
  // a released point springing to its pin (or back): band, index in the drawn points, from → to
  private spring: { band: number; idx: number; from: THREE.Vector3; to: THREE.Vector3; t0: number; pts: THREE.Vector3[] } | null = null;
  private wobble: { band: number; t0: number } | null = null;
  private shakeAt = 0;
  private parts: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private sparkGeo = new THREE.OctahedronGeometry(0.07);
  private sparkMats = [new THREE.MeshBasicMaterial({ color: "#ffd23f" }), new THREE.MeshBasicMaterial({ color: "#ffffff" })];
  private peekUntil = 0;
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private shadows: boolean;
  private target: string[] = [];

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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 12, 7); sun.castShadow = this.shadows; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.bias = -0.0015; sun.shadow.radius = 3;
    this.scene.add(sun, this.root);
    this.root.add(this.boardG);
    this.hintDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9 }));
    this.hintDot.visible = false; this.root.add(this.hintDot);
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointercancel", this.onCancel);
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
  private frame3() {
    const bw = (this.cols - 1) * S + 1.3, bd = (this.rows - 1) * S + 1.3;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    // a steep three-quarter view: the board's depth looks a little shorter than it is
    const dist = Math.max(bw / 2 / Math.tan(hf / 2), (bd * 0.86) / 2 / Math.tan(vf / 2)) * 1.08 + 0.6;
    this.camera.position.set(0, dist * 0.9, dist * 0.44);
    this.camera.lookAt(0, 0, 0.05);
    this.camera.updateProjectionMatrix();
  }
  pinPos(p: number, out = new THREE.Vector3()) {
    const cx = p % this.cols, cy = Math.floor(p / this.cols);
    return out.set((cx - (this.cols - 1) / 2) * S, 0.2, (cy - (this.rows - 1) / 2) * S);
  }
  private panOf(x: number) { return Math.max(-0.85, Math.min(0.85, x / Math.max(1, (this.cols - 1) * S / 2) * 0.7)); }

  // ------------------------------------------------------------ build
  setStage(cols: number, rows: number, bands: Band[], target: string[], world: World) {
    this.cols = cols; this.rows = rows; this.target = target;
    this.clearBoard();
    this.boardMat.color.set(world.board); this.pinMat.color.set(world.pin);
    const bw = (cols - 1) * S + 1.3, bd = (rows - 1) * S + 1.3;
    const board = new THREE.Mesh(new RoundedBoxGeometry(bw, 0.36, bd, 5, 0.18), this.boardMat);
    board.position.y = -0.18; board.receiveShadow = this.shadows; board.castShadow = this.shadows;
    this.boardG.add(board);
    const nails = new Map<number, number>();
    bands.forEach((b) => { nails.set(b.a, b.color); nails.set(b.b, b.color); });
    for (let p = 0; p < cols * rows; p++) {
      const at = this.pinPos(p);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), this.holeMat);
      hole.rotation.x = -Math.PI / 2; hole.position.set(at.x, 0.002, at.z); this.boardG.add(hole);
      const c = nails.get(p);
      if (c !== undefined) {
        // a nail: a fat coloured head with an "x" groove look (two thin dark bars)
        const head = new THREE.Mesh(this.nailGeo, this.bandMats[c % this.bandMats.length]);
        head.position.set(at.x, 0.17, at.z); head.castShadow = this.shadows; this.boardG.add(head);
        const stem = new THREE.Mesh(this.pinGeo, this.pinMat); stem.position.set(at.x, 0.08, at.z); this.boardG.add(stem);
        for (const r of [Math.PI / 4, -Math.PI / 4]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.04), new THREE.MeshBasicMaterial({ color: "#1a1a2a", transparent: true, opacity: 0.55 }));
          bar.position.set(at.x, 0.22, at.z); bar.rotation.y = r; this.boardG.add(bar);
        }
        this.nailMeshes.push(head);
      } else {
        const pin = new THREE.Mesh(this.pinGeo, this.pinMat); pin.position.set(at.x, 0.17, at.z); pin.castShadow = this.shadows;
        const cap = new THREE.Mesh(this.pinCapGeo, this.capMat); cap.position.set(at.x, 0.34, at.z);
        this.boardG.add(pin, cap); this.pinMeshes.push(pin);
      }
    }
    // the target ghost (peek booster): thin dark lines over the board
    for (const e of target) {
      const [a, b] = e.split("-").map(Number);
      const m = new THREE.Mesh(this.segGeo, this.ghostMat);
      this.place(m, this.pinPos(a, this.tmpA).setY(0.05), this.pinPos(b, this.tmpB).setY(0.05), 1.8);
      m.visible = false; this.boardG.add(m); this.ghost.push(m);
    }
    this.views = bands.map((b, i) => {
      const mat = this.bandMats[b.color % this.bandMats.length];
      const segs: THREE.Mesh[] = [], joints: THREE.Mesh[] = [];
      for (let k = 0; k < MAX_SEG; k++) {
        const s = new THREE.Mesh(this.segGeo, mat); s.castShadow = this.shadows; s.visible = false; this.root.add(s); segs.push(s);
        const j = new THREE.Mesh(this.jointGeo, mat); j.visible = false; this.root.add(j); joints.push(j);
      }
      return { segs, joints, mat, y: 0.24 + i * 0.035 };
    });
    this.sync(bands);
    this.frame3();
    this.kick();
  }
  private clearBoard() {
    for (const c of [...this.boardG.children]) { this.boardG.remove(c); if (c instanceof THREE.Mesh && c.geometry !== this.segGeo && c.geometry !== this.pinGeo && c.geometry !== this.pinCapGeo && c.geometry !== this.nailGeo) c.geometry.dispose(); }
    for (const v of this.views) for (const m of [...v.segs, ...v.joints]) this.root.remove(m);
    for (const p of this.parts) this.root.remove(p.m);
    this.views = []; this.pinMeshes = []; this.nailMeshes = []; this.ghost = []; this.parts = [];
    this.drag = null; this.spring = null; this.hint = null; this.hintDot.visible = false;
  }
  /** show the bands as they are (instantly) */
  sync(bands: Band[]) {
    this.bands = bands.map((b) => ({ ...b, hooks: b.hooks.slice() }));
    this.bands.forEach((_, i) => this.layBand(i));
    this.kick();
  }
  private ptsOf(i: number): THREE.Vector3[] {
    const v = this.views[i], b = this.bands[i];
    const pts = pointsOf(b).map((p) => this.pinPos(p).setY(v.y));
    const d = this.drag;
    if (d && d.band === i && d.moved) {
      if (d.hook >= 0) pts[d.hook + 1] = d.at.clone().setY(v.y);
      else pts.splice(d.seg + 1, 0, d.at.clone().setY(v.y));
    }
    const s = this.spring;
    if (s && s.band === i) return s.pts;
    return pts;
  }
  private layBand(i: number, pts = this.ptsOf(i), thick = 1) {
    const v = this.views[i];
    for (let k = 0; k < MAX_SEG; k++) {
      const on = k < pts.length - 1;
      v.segs[k].visible = on; v.joints[k].visible = k < pts.length;
      if (on) this.place(v.segs[k], pts[k], pts[k + 1], thick);
      if (k < pts.length) v.joints[k].position.copy(pts[k]);
    }
  }
  private place(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, thick: number) {
    this.dir.subVectors(b, a);
    const len = this.dir.length() || 0.001;
    m.position.copy(a).addScaledVector(this.dir, 0.5);
    m.quaternion.setFromUnitVectors(this.up, this.dir.multiplyScalar(1 / len));
    m.scale.set(thick, len, thick);
  }

  // ------------------------------------------------------------ effects
  deny() { this.shakeAt = performance.now(); this.hooks.sound("denied", 0); this.kick(); }
  peek(ms: number) { this.peekUntil = performance.now() + ms; this.kick(); }
  /** show a drag: a glowing dot slides from the band to the pin, three times */
  showHint(band: number, seg: number, hook: number, pin: number) {
    const b = this.bands[band]; if (!b) return;
    const pts = pointsOf(b).map((p) => this.pinPos(p));
    const from = hook >= 0 ? pts[hook + 1].clone() : pts[seg].clone().add(pts[seg + 1]).multiplyScalar(0.5);
    const to = pin >= 0 ? this.pinPos(pin) : from.clone().add(new THREE.Vector3(0, 0, 0.9));
    from.y = to.y = 0.55;
    this.hint = { from, to, t0: performance.now() };
    this.kick();
  }
  sparkle(band: number) {
    const b = this.bands[band]; if (!b) return;
    for (const p of pointsOf(b)) {
      const at = this.pinPos(p);
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(this.sparkGeo, this.sparkMats[k % 2]); m.position.set(at.x, 0.5, at.z); this.root.add(m);
        this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3), life: 0.8 });
      }
    }
    this.kick();
  }
  celebrate() { this.bands.forEach((_, i) => setTimeout(() => { this.sparkle(i); this.wobble = { band: i, t0: performance.now() }; }, i * 120)); }

  // ------------------------------------------------------------ input
  private toBoard(cx: number, cy: number, out: THREE.Vector3) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out);
  }
  private nearestPin(at: THREE.Vector3) {
    let best = -1, bd = Infinity;
    for (let p = 0; p < this.cols * this.rows; p++) { const d = this.pinPos(p, this.tmpA).setY(at.y).distanceTo(at); if (d < bd) { bd = d; best = p; } }
    return { pin: best, d: bd };
  }
  private onDown = (e: PointerEvent) => {
    if (!this.hooks.canPlay() || this.spring) return;
    const at = this.toBoard(e.clientX, e.clientY, new THREE.Vector3()); if (!at) return;
    // a bend first (top band wins), then a line
    let pick: { band: number; seg: number; hook: number; d: number } | null = null;
    at.setY(0.2);
    for (let i = this.bands.length - 1; i >= 0; i--) {
      const hs = this.bands[i].hooks;
      for (let k = 0; k < hs.length; k++) { const d = this.pinPos(hs[k], this.tmpA).distanceTo(at); if (d < 0.34 && (!pick || d < pick.d)) pick = { band: i, seg: -1, hook: k, d }; }
    }
    if (!pick) {
      for (let i = this.bands.length - 1; i >= 0; i--) {
        const pts = pointsOf(this.bands[i]);
        for (let k = 0; k < pts.length - 1; k++) {
          const a = this.pinPos(pts[k], this.tmpA), b = this.pinPos(pts[k + 1], this.tmpB);
          const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, at.clone().sub(a).dot(ab) / ab.lengthSq()));
          // not right at a pin (that would grab nothing new)
          if (t < 0.08 || t > 0.92) continue;
          const d = a.clone().addScaledVector(ab, t).distanceTo(at);
          if (d < 0.3 && (!pick || d < pick.d - 0.02)) pick = { band: i, seg: k, hook: -1, d };
        }
      }
    }
    if (!pick) return;
    this.drag = { band: pick.band, seg: pick.seg, hook: pick.hook, at: at.clone(), moved: false, x0: e.clientX, y0: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.hooks.sound("grab", this.panOf(at.x));
    this.hint = null; this.hintDot.visible = false;
    this.kick();
  };
  private lastStretch = 0;
  private onMove = (e: PointerEvent) => {
    const d = this.drag; if (!d) return;
    const at = this.toBoard(e.clientX, e.clientY, this.tmpV); if (!at) return;
    const lim = { x: ((this.cols - 1) / 2) * S + 0.55, z: ((this.rows - 1) / 2) * S + 0.55 };
    d.at.set(Math.max(-lim.x, Math.min(lim.x, at.x)), 0.2, Math.max(-lim.z, Math.min(lim.z, at.z)));
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    const now = performance.now();
    if (d.moved && now - this.lastStretch > 120) { this.lastStretch = now; this.hooks.sound("stretch", this.panOf(d.at.x)); }
    this.kick();
  };
  private onCancel = () => { this.drag = null; this.sync(this.bands); };
  private onUp = () => {
    const d = this.drag; if (!d) return;
    this.drag = null;
    if (!d.moved) { this.layBand(d.band); this.kick(); return; }
    const near = this.nearestPin(d.at);
    const pin = near.d < 0.42 ? near.pin : -1;
    const v = this.views[d.band];
    const fromPts = (() => { const tmp = this.drag; this.drag = { ...d }; const p = this.ptsOf(d.band).map((x) => x.clone()); this.drag = tmp; return p; })();
    const idx = d.hook >= 0 ? d.hook + 1 : d.seg + 1;
    const ok = (d.hook >= 0 || pin >= 0) && this.hooks.drop({ band: d.band, seg: d.seg, hook: d.hook, pin });
    // spring the grabbed point to where it ends up: its pin, or back onto the straight line (it lets go)
    const from = fromPts[idx].clone();
    let to: THREE.Vector3;
    if (ok && pin >= 0) to = this.pinPos(pin).setY(v.y);
    else if (d.hook >= 0 && !ok) to = this.pinPos(this.bands[d.band].hooks[d.hook]).setY(v.y);
    else { const a = fromPts[idx - 1], b = fromPts[idx + 1]; to = a.clone().add(b).multiplyScalar(0.5); }
    const pts = fromPts;
    this.spring = { band: d.band, idx, from, to, t0: performance.now(), pts };
    this.wobble = { band: d.band, t0: performance.now() };
    this.hooks.sound(ok && pin >= 0 ? "snap" : "release", this.panOf(to.x));
    if (!ok && pin >= 0) this.deny();
    this.kick();
  };
  /** where a pin or a band's middle sits on screen (QA and the hint hand) */
  pinScreen(p: number) { const q = this.pinPos(p).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h }; }
  pointScreen(band: number, seg: number, hook: number) {
    const b = this.bands[band]; if (!b) return null;
    const pts = pointsOf(b).map((p) => this.pinPos(p));
    const v = hook >= 0 ? pts[hook + 1] : pts[seg].clone().lerp(pts[seg + 1], 0.5);
    const q = v.clone().setY(0.2).project(this.camera); return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h };
  }
  get busy() { return !!this.spring || !!this.drag; }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = false;
    // the spring: an elastic overshoot onto the pin, then the real bands take over
    const s = this.spring;
    if (s) {
      const u = Math.min(1, (now - s.t0) / 320);
      const e = 1 - Math.pow(1 - u, 3) + Math.sin(u * Math.PI * 2.5) * (1 - u) * 0.18;
      s.pts[s.idx].copy(s.from).lerp(s.to, e);
      if (u >= 1) { this.spring = null; this.layBand(s.band); } else this.layBand(s.band, s.pts);
      moving = true;
    }
    if (this.drag) { this.layBand(this.drag.band); moving = true; }
    // a twang: the band's thickness rings for a moment
    const w = this.wobble;
    if (w) {
      const t = (now - w.t0) / 1000;
      const k = 1 + Math.sin(t * 40) * 0.35 * Math.max(0, 1 - t / 0.5);
      if (!this.spring || this.spring.band !== w.band) this.layBand(w.band, this.ptsOf(w.band), k);
      if (t > 0.5) { this.wobble = null; this.layBand(w.band); } else moving = true;
    }
    // shake the board on a wrong drop
    const sh = now - this.shakeAt;
    this.root.position.x = sh < 360 ? Math.sin(sh / 22) * 0.05 * (1 - sh / 360) : 0;
    if (sh < 360) moving = true;
    // peek: the target shows on the board
    const peek = now < this.peekUntil;
    for (const g of this.ghost) g.visible = peek;
    if (peek) moving = true;
    // hint: a dot slides along the drag, three times
    const h = this.hint;
    if (h) {
      const t = (now - h.t0) / 1100;
      if (t > 3) { this.hint = null; this.hintDot.visible = false; }
      else {
        const u = Math.min(1, (t % 1) * 1.4), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        this.hintDot.visible = true; this.hintDot.position.copy(h.from).lerp(h.to, e);
        this.hintDot.scale.setScalar(1 + Math.sin(now / 90) * 0.15);
        moving = true;
      }
    }
    for (const p of this.parts) { p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 6; p.life -= dt; }
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
    this.clearBoard();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
