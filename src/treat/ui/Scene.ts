// The Treatrio shop wall in 3D (three.js). Cabinets in a grid, three spots in each front row and the rows behind set
// back and a little higher, dimmed (or gift-wrapped on mystery stages). Drag a front-row treat to another box — or tap
// it, then tap a box. Treats glide along an arc, three alike lift, spin and burst into sparkles, the next row slides
// forward, gifts unwrap as they reach the front, ice shatters, locks pop off. Picky boxes wear a sign with their treat,
// recipe locks show the treat that opens them, hurry treats carry a move countdown and droop when they melt. Layout is in CSS pixels on the z = 0
// plane (one world unit = one pixel there), the loop runs fast only while something moves.
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { ITEMS } from "../items";
import { isOpen, type Game, type MoveResult, type Treat } from "../play";
import { treatGeometry } from "./models";

export interface SceneHooks {
  canPick: (box: number, slot: number) => boolean;
  /** try to move; return the spot used and the result (or null when the box can't take it) */
  tryMove: (from: number, slot: number, to: number, nearX: number) => { at: number; res: MoveResult } | null;
  onPick?: (box: number) => void;
  onNope?: (box: number) => void;
  onLand?: (box: number, col: number) => void;
  /** a pop happened at this screen point (CSS px in the canvas) */
  onPop?: (x: number, y: number, t: number, k: number) => void;
}

const MAX_ROWS_SHOWN = 3;
const DIM = new THREE.Color(0.58, 0.58, 0.68);

interface Mesh3 { mesh: THREE.Mesh; ice?: THREE.Mesh; badge?: THREE.Sprite; badgeN?: number; melt?: number; t: number; shown: number; pos: THREE.Vector3; to: THREE.Vector3; sc: number; scTo: number; arc?: { from: THREE.Vector3; t0: number; dur: number }; delay: number; dim: number; dimTo: number; spin: number; flip?: number }
interface Dying { mesh: THREE.Mesh; t0: number; from: THREE.Vector3; center: THREE.Vector3; sc: number; delay: number }
interface Spark { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; c: THREE.Color }

export class TreatScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
  board = new THREE.Group();
  private W = 360; private H = 600;
  private game: Game | null = null;
  private mystery = false;
  private cols = 3;
  private items = new Map<number, Mesh3>();
  private dying: Dying[] = [];
  private sparks: Spark[] = [];
  private cabinets: { group: THREE.Group; mat: THREE.MeshStandardMaterial; lock: THREE.Sprite; frost: THREE.Mesh; lockN: number; glow: number; keyTreat?: THREE.Mesh; sign?: THREE.Group }[] = [];
  private miniMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
  private matFront: THREE.MeshStandardMaterial;
  private iceMat: THREE.MeshStandardMaterial;
  private spPts: THREE.Points; private spGeo: THREE.BufferGeometry;
  private raf = 0; private last = 0; private disposed = false; private idle = 0;
  private drag: { id: number; box: number; slot: number; sx: number; sy: number; moved: boolean; over: number } | null = null;
  selected: { id: number; box: number; slot: number } | null = null;
  private ray = new THREE.Raycaster();
  private wood = "#e8b07a"; private trim = "#fff1d6"; private glowC = new THREE.Color("#ffcf6b");
  private ro: ResizeObserver;
  private layoutCache: { bw: number; bh: number; bd: number; pos: { x: number; y: number }[] } | null = null;

  constructor(private el: HTMLElement, private hooks: SceneHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(autoQuality()), alpha: true, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(autoQuality()));
    this.renderer.setClearColor(0x000000, 0);
    el.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: "block", touchAction: "none" });
    this.scene.add(new THREE.HemisphereLight(0xfff6ee, 0x6a5a7a, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-250, 450, 650); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffe0f0, 0.5); fill.position.set(300, -100, 400); this.scene.add(fill);
    this.scene.add(this.board);
    this.matFront = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.04 });
    this.iceMat = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.1, emissive: 0x5fb0ff, emissiveIntensity: 0.25, depthWrite: false });
    // sparkles
    const SP = 260;
    this.spGeo = new THREE.BufferGeometry();
    this.spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    this.spGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    this.spPts = new THREE.Points(this.spGeo, new THREE.PointsMaterial({ size: 14, map: starTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.spPts.frustumCulled = false; this.spPts.renderOrder = 20;
    this.scene.add(this.spPts);
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", this.down);
    c.addEventListener("pointermove", this.move);
    c.addEventListener("pointerup", this.up);
    c.addEventListener("pointercancel", this.cancel);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
  }

  // ------------------------------------------------------------ layout
  private layout() {
    if (this.layoutCache) return this.layoutCache;
    const g = this.game;
    const n = g ? g.boxes.length : 3;
    const cols = Math.min(this.cols, n), rows = Math.ceil(n / cols);
    const gap = 12, side = 10;
    // as wide as the screen allows, then as tall as it allows (tall boxes show the rows waiting behind)
    let bw = Math.min(280, (this.W - side * 2 - gap * (cols - 1)) / cols);
    const availH = this.H - 24;
    let bh = Math.min(bw * 0.95, (availH - gap * rows) / rows / 1.12);
    if (bh < bw * 0.6) { bh = (availH - gap * rows) / rows / 1.12; bw = Math.min(bw, bh / 0.6); }
    const totalW = cols * bw + (cols - 1) * gap, totalH = rows * bh + (rows - 1) * (gap + bh * 0.12);
    // a little above centre: the camera looks slightly down, which pushes the shelf low
    const x0 = (this.W - totalW) / 2, y0 = Math.max(12, (this.H - totalH) / 2 - this.H * 0.06);
    const pos = Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, n - r * cols);
      const rowX0 = (this.W - (inRow * bw + (inRow - 1) * gap)) / 2;
      return { x: (inRow < cols ? rowX0 : x0) + c * (bw + gap) + bw / 2, y: y0 + r * (bh + gap + bh * 0.12) + bh / 2 };
    });
    this.layoutCache = { bw, bh, bd: bw * 0.5, pos };
    return this.layoutCache;
  }
  private toW(x: number, y: number) { return new THREE.Vector3(x - this.W / 2, this.H / 2 - y, 0); }

  /** where treat (box, row, slot) sits, in board coordinates */
  private spot(box: number, row: number, slot: number) {
    const L = this.layout(), p = L.pos[box];
    const c = this.toW(p.x, p.y);
    const r = Math.min(row, MAX_ROWS_SHOWN);
    return new THREE.Vector3(c.x + (slot - 1) * L.bw * 0.31, c.y - L.bh / 2 + 3 + r * L.bh * 0.16, -L.bd * 0.2 - r * L.bd * 0.26);
  }
  private scaleFor(row: number) {
    const L = this.layout();
    const s = Math.min((L.bw * 0.31) / 0.8, L.bh * 0.62);
    return s * (row === 0 ? 1 : 0.9);
  }

  // ------------------------------------------------------------ cabinets
  private buildCabinets() {
    for (const c of this.cabinets) { this.board.remove(c.group); c.mat.dispose(); c.lock.material.map?.dispose(); c.lock.material.dispose(); (c.frost.material as THREE.Material).dispose(); c.group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); }
    this.cabinets = [];
    const g = this.game; if (!g) return;
    const L = this.layout();
    g.boxes.forEach((_, i) => {
      const p = L.pos[i], c = this.toW(p.x, p.y);
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: this.wood, roughness: 0.65, metalness: 0.02, emissive: this.glowC, emissiveIntensity: 0 });
      const inner = new THREE.MeshStandardMaterial({ color: this.trim, roughness: 0.8 });
      const t = Math.max(3, L.bw * 0.035), w = L.bw, h = L.bh, d = L.bd;
      const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); group.add(mesh); return mesh; };
      add(new THREE.BoxGeometry(w + t * 2, t * 1.6, d + t), mat, 0, -h / 2 - t * 0.8, -d / 2);      // floor
      add(new THREE.BoxGeometry(t, h + t * 1.6, d + t), mat, -w / 2 - t / 2, 0, -d / 2);            // left wall
      add(new THREE.BoxGeometry(t, h + t * 1.6, d + t), mat, w / 2 + t / 2, 0, -d / 2);             // right wall
      add(new THREE.BoxGeometry(w + t * 2, t * 1.2, d + t), mat, 0, h / 2 + t * 0.6, -d / 2);        // top
      add(new THREE.BoxGeometry(w, h, t), inner, 0, 0, -d - t / 2);                                  // back panel
      add(new THREE.BoxGeometry(w + t * 2, t * 0.9, t * 1.4), mat, 0, -h / 2 + t * 0.2, t * 0.4);   // front lip
      const frost = add(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.0, roughness: 0.1, depthWrite: false }), 0, 0, t * 1.5);
      frost.renderOrder = 15;
      const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lockTex(1), transparent: true, depthTest: false }));
      lock.scale.set(L.bh * 0.5, L.bh * 0.58, 1); lock.position.set(0, 0, d * 0.4); lock.visible = false; lock.renderOrder = 16;
      group.add(lock);
      const B = g.boxes[i];
      // recipe lock: the treat that opens it, floating in front of the frosted glass
      let keyTreat: THREE.Mesh | undefined;
      if (B.key) { keyTreat = new THREE.Mesh(treatGeometry(B.key), this.miniMat); const ks = Math.min(L.bh * 0.42, L.bw * 0.3); keyTreat.scale.setScalar(ks); keyTreat.position.set(0, -h * 0.12, d * 0.45); keyTreat.renderOrder = 17; group.add(keyTreat); }
      // picky box: a round sign on the top board with its treat
      let sign: THREE.Group | undefined;
      if (B.only) {
        sign = new THREE.Group();
        const r = Math.min(L.bw * 0.2, L.bh * 0.25);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t * 0.8, 28), new THREE.MeshStandardMaterial({ color: "#fffaf2", roughness: 0.5 }));
        plate.rotation.x = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r, t * 0.35, 8, 32), new THREE.MeshStandardMaterial({ color: ITEMS[B.only - 1]?.color ?? "#ff6fb5", roughness: 0.35, emissive: ITEMS[B.only - 1]?.color ?? "#ff6fb5", emissiveIntensity: 0.25 }));
        const mini = new THREE.Mesh(treatGeometry(B.only), this.miniMat); mini.scale.setScalar(r * 1.25); mini.position.set(0, -r * 0.6, t * 0.6);
        sign.add(plate, rim, mini);
        // hanging from the front of the top board, and the box takes on its treat's colour
        sign.position.set(0, h / 2 - r * 0.35, t * 2.4);
        group.add(sign);
        mat.color.lerp(new THREE.Color(ITEMS[B.only - 1]?.color ?? "#ff6fb5"), 0.35);
      }
      group.position.copy(c);
      this.board.add(group);
      this.cabinets.push({ group, mat, lock, frost, lockN: 0, glow: 0, keyTreat, sign });
    });
  }

  // ------------------------------------------------------------ state → meshes
  /** show a new stage */
  setStage(g: Game, opts: { mystery: boolean; cols: number; wood: string; trim: string; glow: string }) {
    for (const m of this.items.values()) { this.board.remove(m.mesh); (m.mesh.material as THREE.Material).dispose(); }
    for (const d of this.dying) { this.board.remove(d.mesh); (d.mesh.material as THREE.Material).dispose(); }
    this.items.clear(); this.dying = [];
    this.mystery = opts.mystery; this.cols = opts.cols;
    this.wood = opts.wood; this.trim = opts.trim; this.glowC.set(opts.glow);
    this.game = g; this.layoutCache = null; this.selected = null; this.drag = null;
    this.buildCabinets();
    this.sync(g, null, true);
  }

  /** bring the meshes in line with the game; `res` (after a move) drives the pop / slide animations */
  sync(g: Game, res: MoveResult | null, instant = false, movedId = -1) {
    this.game = g;
    const seen = new Set<number>();
    const popIds = new Map<number, { box: number; k: number }>();
    res?.popped.forEach((p, k) => p.ids.forEach((id) => popIds.set(id, { box: p.box, k })));
    g.boxes.forEach((b, bi) => b.rows.forEach((row, ri) => row.forEach((x, si) => {
      if (!x) return;
      seen.add(x.id);
      this.place(x, bi, ri, si, instant, movedId, res ? 0.33 : 0);
    })));
    // popped treats: lift, spin, burst
    for (const [id, m] of this.items) {
      if (seen.has(id)) continue;
      const pop = popIds.get(id);
      if (pop) {
        const L = this.layout(), c = this.toW(L.pos[pop.box].x, L.pos[pop.box].y);
        // the treat you just dropped flies straight from your finger into the burst
        this.dying.push({ mesh: m.mesh, t0: performance.now(), from: id === movedId ? m.pos.clone() : m.to.clone(), center: new THREE.Vector3(c.x, c.y + L.bh * 0.1, 40), sc: m.scTo, delay: (id === movedId ? 0.05 : 0.2) + pop.k * 0.12 });
      } else { this.board.remove(m.mesh); (m.mesh.material as THREE.Material).dispose(); }
      this.items.delete(id);
    }
    this.kick();
  }

  private place(x: Treat, box: number, row: number, slot: number, instant: boolean, movedId: number, settleDelay: number) {
    let m = this.items.get(x.id);
    const pos = this.spot(box, row, slot), sc = this.scaleFor(row);
    const showT = row > 0 && this.mystery ? 0 : x.t;
    if (!m) {
      const mesh = new THREE.Mesh(treatGeometry(showT), this.matFront.clone());
      mesh.userData.id = x.id; mesh.userData.t = x.t;
      this.board.add(mesh);
      m = { mesh, t: x.t, shown: showT, pos: pos.clone(), to: pos.clone(), sc, scTo: sc, delay: 0, dim: row ? 1 : 0, dimTo: row ? 1 : 0, spin: 0 };
      this.items.set(x.id, m);
    }
    const g = this.game!;
    const moving = !instant && !m.to.equals(pos);
    if (moving) {
      if (x.id === movedId) m.arc = { from: m.pos.clone(), t0: performance.now(), dur: 260 };
      else m.delay = settleDelay * 1000 + (row === 0 ? 120 : 160); // rows slide forward after the pop
    }
    m.to.copy(pos); m.scTo = sc; m.dimTo = row ? 1 : 0;
    m.mesh.visible = row < MAX_ROWS_SHOWN;
    if (instant) { m.pos.copy(pos); m.sc = sc; m.dim = m.dimTo; }
    // unwrap a gift when it reaches the front
    if (showT !== m.shown) { m.shown = showT; m.flip = performance.now() + (moving ? m.delay + 180 : 0); }
    // ice
    const iced = x.ice > g.pops;
    if (iced && !m.ice) { m.ice = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.08, 0.7), this.iceMat); m.ice.position.y = 0.5; m.ice.renderOrder = 10; m.mesh.add(m.ice); }
    if (!iced && m.ice) { m.mesh.remove(m.ice); m.ice.geometry.dispose(); m.ice = undefined; this.burst(m.to.clone().add(new THREE.Vector3(0, sc * 0.5, 20)), "#d8f4ff", 14); }
    // hurry treat: a countdown of moves left floats above it
    if (x.bomb !== undefined) {
      const left = Math.max(0, x.bomb - g.moves);
      if (!m.badge) { m.badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); m.badge.scale.set(0.62, 0.62, 1); m.badge.position.set(0.3, 1.05, 0.2); m.badge.renderOrder = 18; m.mesh.add(m.badge); }
      if (left > 0) m.melt = undefined; // back from an undo
      if (m.badgeN !== left) { m.badge.material.map?.dispose(); m.badge.material.map = timerTex(left); m.badge.material.needsUpdate = true; m.badgeN = left; }
      m.badge.visible = row === 0;
    }
  }

  /** hurry treats that ran out: they droop and go grey */
  melt(ids: number[]) { const now = performance.now(); ids.forEach((id) => { const m = this.items.get(id); if (m) m.melt = now; }); this.kick(); }

  // ------------------------------------------------------------ effects
  burst(p: THREE.Vector3, color: string, n: number) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 70 + Math.random() * 200;
      this.sparks.push({ p: p.clone(), v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 70, (Math.random() - 0.3) * 90), life: 0.9, max: 0.9, c: Math.random() < 0.35 ? new THREE.Color(1, 1, 1) : c });
    }
    this.kick();
  }
  celebrate() {
    const L = this.layout();
    L.pos.forEach((p, i) => setTimeout(() => this.burst(this.toW(p.x, p.y).add(new THREE.Vector3(0, 0, 40)), ["#ff6fb5", "#ffd23f", "#6fd3ff", "#9fe04a"][i % 4], 26), i * 90));
  }
  shakeBox(b: number) { const c = this.cabinets[b]; if (c) { c.glow = -1; this.kick(); } }
  /** highlight a move (hint) */
  hint(from: number, slot: number, to: number) {
    const x = this.game?.boxes[from]?.rows[0][slot];
    if (!x) return;
    const m = this.items.get(x.id);
    if (m) { m.spin = 1; }
    const c = this.cabinets[to]; if (c) c.glow = 1.6;
    this.kick();
  }

  // ------------------------------------------------------------ input
  private px(e: PointerEvent) { const r = this.renderer.domElement.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private pickAt(x: number, y: number): { id: number; box: number; slot: number } | null {
    const g = this.game; if (!g) return null;
    this.ray.setFromCamera(new THREE.Vector2((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1), this.camera);
    const fronts: THREE.Object3D[] = [];
    const where = new Map<number, { box: number; slot: number }>();
    g.boxes.forEach((b, bi) => b.rows[0].forEach((q, si) => { if (q) { const m = this.items.get(q.id); if (m) { fronts.push(m.mesh); where.set(q.id, { box: bi, slot: si }); } } }));
    const hit = this.ray.intersectObjects(fronts, false)[0];
    if (hit) { const id = hit.object.userData.id as number; const w = where.get(id)!; return { id, ...w }; }
    // generous fallback: the nearest front treat within reach of the finger
    let best: { id: number; box: number; slot: number } | null = null, bd = 1e9;
    for (const [id, w] of where) {
      const s = this.screenOf(this.items.get(id)!.to, this.scaleFor(0) * 0.45);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < this.scaleFor(0) * 0.6 && d < bd) { bd = d; best = { id, ...w }; }
    }
    return best;
  }
  private screenOf(p: THREE.Vector3, up = 0) {
    const v = p.clone(); v.y += up;
    this.board.localToWorld(v);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H };
  }
  private boxAt(x: number, y: number): number {
    const L = this.layout();
    let best = -1, bd = 1e9;
    L.pos.forEach((p, i) => {
      const s = this.screenOf(this.toW(p.x, p.y));
      const dx = Math.abs(x - s.x), dy = Math.abs(y - s.y);
      if (dx < L.bw * 0.6 && dy < L.bh * 0.75 && dx + dy < bd) { bd = dx + dy; best = i; }
    });
    return best;
  }
  private down = (e: PointerEvent) => {
    const { x, y } = this.px(e);
    const hit = this.pickAt(x, y);
    if (hit && this.hooks.canPick(hit.box, hit.slot)) {
      e.preventDefault();
      this.renderer.domElement.setPointerCapture(e.pointerId);
      this.drag = { id: hit.id, box: hit.box, slot: hit.slot, sx: x, sy: y, moved: false, over: -1 };
      this.hooks.onPick?.(hit.box);
      this.kick();
      return;
    }
    if (hit) { this.hooks.onNope?.(hit.box); this.shakeItem(hit.id); return; }
    // a tap on a box while a treat is selected: move it there
    const b = this.boxAt(x, y);
    if (this.selected && b >= 0) { this.commit(this.selected, b, x); this.selected = null; }
  };
  private move = (e: PointerEvent) => {
    const d = this.drag; if (!d) return;
    const { x, y } = this.px(e);
    if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 8) { d.moved = true; this.selected = null; }
    if (!d.moved) return;
    const m = this.items.get(d.id); if (!m) return;
    // follow the finger on a plane in front of the shelf, lifted a little above it on touch screens
    const lift = e.pointerType === "mouse" ? 0 : this.scaleFor(0) * 0.7;
    const w = this.unproject(x, y - lift, 60);
    m.pos.copy(w); m.to.copy(w); m.arc = undefined;
    m.scTo = this.scaleFor(0) * 1.15;
    const over = this.boxAt(x, y);
    if (over !== d.over) { if (d.over >= 0) this.cabinets[d.over].glow = 0; d.over = over; if (over >= 0 && over !== d.box) this.cabinets[over].glow = 1; }
    this.kick();
  };
  private up = (e: PointerEvent) => {
    const d = this.drag; if (!d) return;
    this.drag = null;
    const { x, y } = this.px(e);
    if (d.over >= 0) this.cabinets[d.over].glow = 0;
    if (!d.moved) {
      // tap: select (or deselect)
      if (this.selected?.id === d.id) this.selected = null; else this.selected = { id: d.id, box: d.box, slot: d.slot };
      this.kick();
      return;
    }
    const to = this.boxAt(x, y);
    if (to < 0 || to === d.box || !this.commit(d, to, x)) this.back(d.id, d.box, d.slot);
  };
  private cancel = () => { const d = this.drag; this.drag = null; if (d) this.back(d.id, d.box, d.slot); };
  private commit(d: { id: number; box: number; slot: number }, to: number, x: number): boolean {
    if (to === d.box) return false;
    const r = this.hooks.tryMove(d.box, d.slot, to, x);
    if (!r) { this.hooks.onNope?.(to); this.cabinets[to].glow = -1; this.back(d.id, d.box, d.slot); return false; }
    return true;
  }
  private back(id: number, box: number, slot: number) {
    const m = this.items.get(id); if (!m) return;
    m.to.copy(this.spot(box, 0, slot)); m.scTo = this.scaleFor(0); m.arc = { from: m.pos.clone(), t0: performance.now(), dur: 200 };
    this.kick();
  }
  private shakeItem(id: number) { const m = this.items.get(id); if (m) { m.spin = -1; this.kick(); } }
  private unproject(x: number, y: number, z: number) {
    const v = new THREE.Vector3((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const t = (z - this.camera.position.z) / dir.z;
    const w = this.camera.position.clone().addScaledVector(dir, t);
    return this.board.worldToLocal(w);
  }
  /** screen position of a box (for pop texts) */
  boxScreen(b: number) { const L = this.layout(), p = L.pos[b]; return this.screenOf(this.toW(p.x, p.y)); }
  itemScreen(box: number, slot: number) { return this.screenOf(this.spot(box, 0, slot), this.scaleFor(0) * 0.5); }

  // ------------------------------------------------------------ frame
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    let busy = this.sparks.length > 0 || this.dying.length > 0 || !!this.drag;
    const g = this.game;
    for (const [id, m] of this.items) {
      const mesh = m.mesh;
      if (m.delay > 0) { m.delay -= dt * 1000; busy = true; }
      else if (m.arc) {
        const k = Math.min(1, (now - m.arc.t0) / m.arc.dur), e = 1 - Math.pow(1 - k, 3);
        m.pos.lerpVectors(m.arc.from, m.to, e);
        m.pos.y += Math.sin(k * Math.PI) * this.scaleFor(0) * 0.6; m.pos.z += Math.sin(k * Math.PI) * 50;
        if (k >= 1) { m.arc = undefined; m.pos.copy(m.to); m.sc = m.scTo * 1.12; }
        busy = true;
      } else if (m.pos.distanceToSquared(m.to) > 0.02) { m.pos.lerp(m.to, Math.min(1, dt * 12)); busy = true; }
      else m.pos.copy(m.to);
      if (Math.abs(m.sc - m.scTo) > 0.01) { m.sc += (m.scTo - m.sc) * Math.min(1, dt * 14); busy = true; }
      if (Math.abs(m.dim - m.dimTo) > 0.01 && m.delay <= 0) { m.dim += (m.dimTo - m.dim) * Math.min(1, dt * 8); busy = true; } else if (m.delay <= 0) m.dim = m.dimTo;
      // gift unwrap: a quick spin, swapping the model halfway
      let ry = 0;
      if (m.flip !== undefined) {
        const k = (now - m.flip) / 380;
        if (k >= 0) {
          if (k >= 0.5 && mesh.geometry !== treatGeometry(m.shown)) { mesh.geometry = treatGeometry(m.shown); this.burst(m.pos.clone().add(new THREE.Vector3(0, m.sc * 0.5, 10)), "#ffd23f", 8); }
          ry = Math.min(1, k) * Math.PI * 2;
          if (k >= 1) m.flip = undefined;
        }
        busy = true;
      }
      if (m.spin) { m.spin *= Math.pow(0.02, dt); if (Math.abs(m.spin) < 0.02) m.spin = 0; busy = true; }
      const sel = this.selected?.id === id;
      const bob = sel ? Math.sin(now / 140) * 0.06 + 0.12 : 0;
      if (sel) busy = true;
      mesh.position.copy(m.pos); mesh.position.y += bob * m.sc;
      if (sel) mesh.position.z += 30;
      mesh.scale.setScalar(m.sc * (sel ? 1.08 : 1));
      mesh.rotation.set(0, ry + (m.spin > 0 ? Math.sin(now / 60) * 0.5 * m.spin : 0) + Math.sin(now / 1500 + id) * 0.05, m.spin < 0 ? Math.sin(now / 30) * 0.3 * m.spin : 0);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setRGB(1, 1, 1).lerp(DIM, m.dim);
      // locked boxes: their treats look frosted
      const lockedBox = g?.boxes.findIndex((b) => b.rows.some((r) => r.some((q) => q && q.id === id))) ?? -1;
      if (lockedBox >= 0 && g && !isOpen(g, lockedBox)) mat.color.multiplyScalar(0.75);
      if (m.melt !== undefined) { const k = Math.min(1, (now - m.melt) / 700); mesh.scale.set(m.sc * (1 + 0.25 * k), m.sc * (1 - 0.55 * k), m.sc * (1 + 0.25 * k)); mat.color.lerp(new THREE.Color(0.55, 0.5, 0.5), k); if (k < 1) busy = true; }
      if (m.badge && m.badgeN !== undefined && m.badgeN <= 3) { const s2 = 0.62 * (1 + Math.sin(now / 110) * 0.12); m.badge.scale.set(s2, s2, 1); busy = true; }
    }
    // popping treats
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      const k = (now - d.t0) / 1000 - d.delay;
      busy = true;
      if (k < 0) continue;
      const a = Math.min(1, k / 0.32), b2 = Math.max(0, (k - 0.32) / 0.22);
      d.mesh.position.lerpVectors(d.from, d.center, easeOut(a));
      d.mesh.scale.setScalar(d.sc * (1 + 0.35 * a) * (1 - b2));
      d.mesh.rotation.y = a * Math.PI * 2;
      if (b2 >= 1) {
        this.board.remove(d.mesh); (d.mesh.material as THREE.Material).dispose();
        this.dying.splice(i, 1);
        const t = (d.mesh.userData.t as number) ?? 1;
        const color = ITEMS[t - 1]?.color ?? "#ffd23f";
        this.burst(d.center.clone(), color, 10);
      }
    }
    // cabinets: glow (target), red flash (no), locks
    this.cabinets.forEach((c, i) => {
      const locked = !!g && !isOpen(g, i);
      const numLeft = g ? g.boxes[i].lock - g.pops : 0;
      // a recipe lock (waiting for its treat) shows the treat; a count lock shows the pops still needed
      const left = numLeft > 0 ? numLeft : 0;
      c.lock.visible = locked;
      if (c.keyTreat) { c.keyTreat.visible = locked; if (locked) { c.keyTreat.rotation.y = now / 900; busy = true; } }
      if (c.sign) c.sign.rotation.z = Math.sin(now / 700 + i) * 0.05;
      (c.frost.material as THREE.MeshStandardMaterial).opacity += ((locked ? 0.42 : 0) - (c.frost.material as THREE.MeshStandardMaterial).opacity) * Math.min(1, dt * 6);
      if (locked && c.lockN !== left) { c.lock.material.map?.dispose(); c.lock.material.map = lockTex(left); c.lock.material.needsUpdate = true; c.lockN = left; }
      if (c.keyTreat && locked) { c.lock.position.set(0, this.layout().bh * 0.18, this.layout().bd * 0.4); c.lock.scale.set(this.layout().bh * 0.3, this.layout().bh * 0.35, 1); }
      if (c.glow > 0) { c.mat.emissive.copy(this.glowC); c.mat.emissiveIntensity = 0.35 + Math.sin(now / 120) * 0.12; if (c.glow > 1) { c.glow -= dt; if (c.glow <= 1) c.glow = 0; } busy = true; }
      else if (c.glow < 0) { c.mat.emissive.set("#ff3b4f"); c.mat.emissiveIntensity = -c.glow * 0.5; c.glow = Math.min(0, c.glow + dt * 2.5); busy = true; }
      else c.mat.emissiveIntensity = 0;
    });
    // sparkles
    const pa = this.spGeo.getAttribute("position") as THREE.BufferAttribute, ca = this.spGeo.getAttribute("color") as THREE.BufferAttribute;
    let n = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.life -= dt; s.v.y -= 200 * dt; s.p.addScaledVector(s.v, dt);
      if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
      if (n < 260) { pa.setXYZ(n, s.p.x, s.p.y, s.p.z); const a = s.life / s.max; ca.setXYZ(n, s.c.r * a, s.c.g * a, s.c.b * a); n++; }
    }
    this.spGeo.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
    (this.spPts.material as THREE.PointsMaterial).size = Math.max(10, this.scaleFor(0) * 0.35);

    this.renderer.render(this.scene, this.camera);
    this.idle = busy ? 0 : this.idle + 1;
    // full speed while something moves, then stop (a tap or a change wakes it)
    if (busy || this.idle < 3) this.raf = requestAnimationFrame(this.frame); else this.raf = 0;
  };
  kick() { if (!this.disposed && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }

  resize() {
    this.W = this.el.clientWidth || 360; this.H = this.el.clientHeight || 600;
    this.renderer.setSize(this.W, this.H, false);
    Object.assign(this.renderer.domElement.style, { width: `${this.W}px`, height: `${this.H}px` });
    this.camera.aspect = this.W / this.H;
    this.camera.position.set(0, 0, this.H / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.camera.near = 10; this.camera.far = this.camera.position.z * 3;
    this.camera.updateProjectionMatrix();
    // look slightly down into the cabinets
    this.board.rotation.x = 0.16;
    this.layoutCache = null;
    if (this.game) { this.buildCabinets(); this.sync(this.game, null, true); }
    this.kick();
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect();
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.down); c.removeEventListener("pointermove", this.move); c.removeEventListener("pointerup", this.up); c.removeEventListener("pointercancel", this.cancel);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); });
    for (const cab of this.cabinets) cab.group.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
    this.spGeo.dispose();
    this.renderer.dispose(); c.remove();
  }
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const starTex = () => canvasTex(64, 64, (g) => { g.translate(32, 32); g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = (i * Math.PI) / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
const lockTex = (n: number) => canvasTex(96, 112, (g) => {
  g.lineWidth = 10; g.strokeStyle = "#ffe08a"; g.beginPath(); g.arc(48, 42, 24, Math.PI, 0); g.stroke();
  g.fillStyle = "#ffb52e"; g.beginPath(); g.roundRect(14, 40, 68, 60, 12); g.fill();
  if (n > 0) { g.fillStyle = "#3a2000"; g.font = "bold 44px 'Lilita One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), 48, 72); }
  else { g.fillStyle = "#3a2000"; g.beginPath(); g.arc(48, 64, 9, 0, Math.PI * 2); g.fill(); g.fillRect(44, 66, 8, 20); }
});
/** a little stopwatch with the moves left (hurry treats) */
const timerTex = (n: number) => canvasTex(96, 96, (g) => {
  const red = n <= 3;
  g.fillStyle = red ? "#ff3b4f" : "#ff8a3d"; g.beginPath(); g.arc(48, 52, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(48, 52, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = red ? "#ff3b4f" : "#ff8a3d"; g.fillRect(40, 4, 16, 12);
  g.fillStyle = red ? "#c8102e" : "#7a3a00"; g.font = "bold 40px 'Lilita One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), 48, 55);
});
