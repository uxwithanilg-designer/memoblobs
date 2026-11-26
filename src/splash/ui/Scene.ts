// The Slide Splash maze in 3D (three.js), seen from above at a tilt: raised rounded walls, floor tiles that start grey
// and pop up in the world's paint colour as the cube slides over them (a little wave), spiky mines spinning slowly,
// and the hero — a soft jelly cube with a face that squashes when it starts, stretches as it slides and wobbles when it
// stops. A mine pops the cube in a puff; a cleared maze ripples with colour and confetti. Swipe or use the arrow keys.
// Instanced meshes for tiles and walls (light on any phone); renders only while something moves.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { antialiasFor, autoQuality, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { FLOOR, MINE, WALL, type Dir, type Maze } from "../engine";
import type { World } from "../stage";

export type SceneSound = "slide" | "stop" | "paint" | "pop" | "shield" | "bump";
export interface SceneHooks {
  canPlay: () => boolean;
  move: (d: Dir) => void;
  sound: (e: SceneSound, pan: number, n?: number) => void;
}
interface Fly { from: THREE.Vector3; to: THREE.Vector3; cells: number[]; t0: number; dur: number; dir: Dir; dead: boolean; bump: boolean }
interface Part { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number }

export class SplashScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private root = new THREE.Group();
  private tiles: THREE.InstancedMesh | null = null;
  private walls: THREE.InstancedMesh | null = null;
  private tileIdx = new Map<number, number>();
  private paintAt = new Map<number, number>();
  private mines: THREE.Group[] = [];
  private mineCell = new Map<number, THREE.Group>();
  private cube: THREE.Group;
  private cubeBody: THREE.Mesh;
  private shieldMesh: THREE.Mesh;
  private m: Maze | null = null; private world: World | null = null;
  private fly: Fly | null = null; private queue: Dir[] = [];
  private wobble = 0;
  private parts: Part[] = []; private partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private winAt = 0; private shake = 0;
  private colPaint = new THREE.Color(); private colFloor = new THREE.Color();
  private w = 1; private h = 1;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver; private gov: FrameGovernor;
  private shadows: boolean;
  private down: { x: number; y: number } | null = null;
  private dummy = new THREE.Object3D();

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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-5, 14, 8); sun.castShadow = this.shadows;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    sun.shadow.bias = -0.001; sun.shadow.radius = 3;
    this.scene.add(sun, this.root);
    // the hero: a soft jelly cube with eyes and a smile
    this.cube = new THREE.Group();
    this.cubeBody = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.78, 0.78, 4, 0.2), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
    this.cubeBody.castShadow = this.shadows;
    const eyeMat = new THREE.MeshBasicMaterial({ color: "#1e1a2a" }), eyeGeo = new THREE.SphereGeometry(0.07, 12, 8);
    for (const sx of [-0.17, 0.17]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(sx, 0.1, 0.395); e.scale.set(1, 1.3, 0.5); this.cubeBody.add(e); }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 16, Math.PI), eyeMat); smile.position.set(0, -0.07, 0.395); smile.rotation.z = Math.PI; this.cubeBody.add(smile);
    const blushMat = new THREE.MeshBasicMaterial({ color: "#ff8aa8", transparent: true, opacity: 0.6 }), blushGeo = new THREE.CircleGeometry(0.06, 12);
    for (const sx of [-0.28, 0.28]) { const b = new THREE.Mesh(blushGeo, blushMat); b.position.set(sx, -0.04, 0.392); this.cubeBody.add(b); }
    this.cube.add(this.cubeBody);
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshPhysicalMaterial({ color: "#7ad8ff", transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false }));
    this.shieldMesh.visible = false; this.cube.add(this.shieldMesh);
    this.root.add(this.cube);
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pr * k); this.resize(); });
    const cv = this.renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
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
    const m = this.m; if (!m) { this.camera.updateProjectionMatrix(); return; }
    const bw = m.cols + 0.4, bd = m.rows + 0.4;
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const tilt = 0.5; // radians from straight down
    const dist = Math.max((bd * Math.cos(tilt)) / 2 / Math.tan(vf / 2), bw / 2 / Math.tan(hf / 2)) * 1.08 + 1.2;
    this.camera.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
    this.camera.lookAt(0, 0, 0.3);
    this.camera.updateProjectionMatrix();
  }
  private cellPos(i: number, y = 0) { const m = this.m!; const x = i % m.cols, z = Math.floor(i / m.cols); return new THREE.Vector3(x - (m.cols - 1) / 2, y, z - (m.rows - 1) / 2); }
  private panOf(i: number) { const m = this.m!; return Math.max(-0.85, Math.min(0.85, (((i % m.cols) + 0.5) / m.cols * 2 - 1) * 0.85)); }

  // ------------------------------------------------------------ build
  setStage(m: Maze, world: World, painted: number[], pos: number, burst: number[]) {
    this.m = m; this.world = world;
    this.clear();
    // grey floor tiles that read clearly against the white walls
    this.colPaint.set(world.paint); this.colFloor.set(world.floor).multiplyScalar(0.74);
    const tileGeo = new RoundedBoxGeometry(0.94, 0.16, 0.94, 2, 0.05);
    const wallGeo = new RoundedBoxGeometry(1, 0.62, 1, 2, 0.12);
    const floors = m.cells.map((c, i) => (c === FLOOR || c === MINE ? i : -1)).filter((i) => i >= 0);
    const wallsAt = m.cells.map((c, i) => (c === WALL || burst.includes(i) ? i : -1)).filter((i) => i >= 0);
    this.tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), floors.length);
    this.tiles.receiveShadow = this.shadows;
    floors.forEach((c, k) => { this.tileIdx.set(c, k); this.dummy.position.copy(this.cellPos(c, -0.08)); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); this.tiles!.setMatrixAt(k, this.dummy.matrix); this.tiles!.setColorAt(k, this.colFloor); });
    this.walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(world.wall).lerp(new THREE.Color(world.paint), 0.07), roughness: 0.4 }), wallsAt.length);
    this.walls.castShadow = this.shadows; this.walls.receiveShadow = this.shadows;
    wallsAt.forEach((c, k) => { this.dummy.position.copy(this.cellPos(c, 0.31)); this.dummy.updateMatrix(); this.walls!.setMatrixAt(k, this.dummy.matrix); });
    this.root.add(this.tiles, this.walls);
    // mines: dark spiky balls
    const core = new THREE.IcosahedronGeometry(0.24, 1), spike = new THREE.ConeGeometry(0.07, 0.22, 6);
    const mat = new THREE.MeshStandardMaterial({ color: "#2a2630", roughness: 0.35, metalness: 0.4 }), tip = new THREE.MeshStandardMaterial({ color: "#f4f4f8", roughness: 0.3 });
    m.cells.forEach((c, i) => {
      if (c !== MINE || burst.includes(i)) return;
      const g = new THREE.Group(); g.add(new THREE.Mesh(core, mat));
      const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]];
      for (const [x, y, z] of dirs) { const s = new THREE.Mesh(spike, tip); s.position.set(x * 0.28, y * 0.28, z * 0.28); s.lookAt(x * 2, y * 2, z * 2); s.rotateX(Math.PI / 2); g.add(s); }
      g.position.copy(this.cellPos(i, 0.3)); g.traverse((o) => { (o as THREE.Mesh).castShadow = this.shadows; });
      this.root.add(g); this.mines.push(g); this.mineCell.set(i, g);
    });
    // paint what's painted (no animation), place the cube
    for (const c of painted) this.setTile(c, 1, 1);
    this.tiles.instanceColor!.needsUpdate = true; this.tiles.instanceMatrix.needsUpdate = true;
    this.cube.position.copy(this.cellPos(pos, 0.39)); this.cube.scale.setScalar(1); this.cube.visible = true;
    (this.cubeBody.material as THREE.MeshPhysicalMaterial).color.set("#ffffff");
    this.fly = null; this.queue = []; this.winAt = 0;
    this.frameCamera();
    this.kick();
  }
  private clear() {
    for (const o of [this.tiles, this.walls]) if (o) { this.root.remove(o); o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    this.tiles = null; this.walls = null; this.tileIdx.clear(); this.paintAt.clear();
    for (const g of this.mines) this.root.remove(g);
    this.mines = []; this.mineCell.clear();
    for (const p of this.parts) this.root.remove(p.m);
    this.parts = [];
  }
  /** a tile's paint (0 → 1) and pop height */
  private setTile(c: number, paint: number, pop: number) {
    const k = this.tileIdx.get(c); if (k === undefined || !this.tiles) return;
    const col = this.colFloor.clone().lerp(this.colPaint, paint);
    this.tiles.setColorAt(k, col);
    this.dummy.position.copy(this.cellPos(c, -0.08 + (1 - pop) * 0.12 * Math.sin(pop * Math.PI)));
    const s = 1 + Math.sin(Math.min(1, pop) * Math.PI) * 0.08;
    this.dummy.scale.set(s, 1, s); this.dummy.updateMatrix(); this.tiles.setMatrixAt(k, this.dummy.matrix);
  }

  // ------------------------------------------------------------ moves
  /** animate a slide along `cells` (the cube ends on the last one; a mine pops it; `bump` = no move) */
  slide(dir: Dir, cells: number[], dead: boolean, shieldBurst = -1) {
    if (!this.m) return;
    const from = this.cube.position.clone();
    const end = cells.length ? cells[cells.length - 1] : -1;
    const to = end >= 0 ? this.cellPos(end, 0.39) : from.clone();
    this.fly = { from, to, cells, t0: performance.now(), dur: Math.max(140, cells.length * 70), dir, dead, bump: !cells.length };
    if (cells.length) this.hooks.sound("slide", this.panOf(end), cells.length);
    if (shieldBurst >= 0) { const g = this.mineCell.get(shieldBurst); if (g) { this.puff(g.position, "#7ad8ff", 18); this.root.remove(g); this.mineCell.delete(shieldBurst); } this.shieldMesh.visible = false; this.hooks.sound("shield", this.panOf(shieldBurst)); }
    this.kick();
  }
  setShield(on: boolean) { this.shieldMesh.visible = on; this.kick(); }
  get busy() { return !!this.fly; }
  celebrate() { this.winAt = performance.now(); for (let i = 0; i < 60; i++) this.puff(new THREE.Vector3((Math.random() - 0.5) * 6, 1, (Math.random() - 0.5) * 6), ["#ffd23f", "#ff5a9a", "#5ac8ff", "#7ae05a", this.world?.paint ?? "#fff"][i % 5], 1); this.kick(); }
  private puff(at: THREE.Vector3, col: string, n: number) {
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.partGeo, mat); m.position.copy(at); this.root.add(m); this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6), life: 0, max: 0.7 + Math.random() * 0.5 }); }
  }

  // ------------------------------------------------------------ input
  private onUp = (e: PointerEvent) => {
    const d0 = this.down; this.down = null;
    if (!d0 || !this.hooks.canPlay()) return;
    const dx = e.clientX - d0.x, dy = e.clientY - d0.y;
    if (Math.hypot(dx, dy) < 18) return;
    this.send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
  };
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const d = k === "arrowup" || k === "w" ? 0 : k === "arrowright" || k === "d" ? 1 : k === "arrowdown" || k === "s" ? 2 : k === "arrowleft" || k === "a" ? 3 : -1;
    if (d < 0 || !this.hooks.canPlay()) return;
    e.preventDefault(); this.send(d as Dir);
  };
  /** queue a move (one buffered while a slide plays) */
  send(d: Dir) { if (this.fly) { if (this.queue.length < 1) this.queue.push(d); return; } this.hooks.move(d); }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let moving = false;
    const f = this.fly;
    if (f) {
      moving = true;
      const u = Math.min(1, (now - f.t0) / f.dur);
      const e = u < 1 ? 1 - (1 - u) ** 2 : 1;
      this.cube.position.lerpVectors(f.from, f.to, e);
      // stretch along the slide
      const along = f.dir === 1 || f.dir === 3 ? "x" : "z";
      const st = f.bump ? 1 : 1 + Math.sin(u * Math.PI) * 0.22;
      this.cubeBody.scale.set(along === "x" ? st : 1 / Math.sqrt(st), 1 / st, along === "z" ? st : 1 / Math.sqrt(st));
      // paint the tiles as the cube passes them
      f.cells.forEach((c, i) => { if (!this.paintAt.has(c) && (i + 1) / f.cells.length <= e + 0.02) { this.paintAt.set(c, now); if (i % 2 === 0) this.hooks.sound("paint", this.panOf(c), i); } });
      if (u >= 1) {
        this.fly = null;
        this.cubeBody.scale.set(1, 1, 1);
        if (f.dead) { this.cube.visible = false; this.puff(this.cube.position, "#ffffff", 22); this.puff(this.cube.position, "#2a2630", 10); this.shake = 0.35; this.hooks.sound("pop", 0); }
        else { this.wobble = 1; this.hooks.sound(f.bump ? "bump" : "stop", f.cells.length ? this.panOf(f.cells[f.cells.length - 1]) : 0); }
        const q = this.queue.shift(); if (q !== undefined && !f.dead && this.hooks.canPlay()) this.hooks.move(q);
      }
    }
    if (this.wobble > 0.01) { this.wobble *= Math.pow(0.02, dt); const w = Math.sin(now / 40) * this.wobble * 0.12; this.cubeBody.scale.set(1 + w, 1 - w, 1 + w); moving = true; } else if (!this.fly) this.cubeBody.scale.set(1, 1, 1);
    // tile pops
    let tilesDirty = false;
    for (const [c, t0] of this.paintAt) {
      const k = Math.min(1, (now - t0) / 320);
      if (k < 1) { this.setTile(c, k, k); tilesDirty = true; moving = true; } else if (k >= 1) { this.setTile(c, 1, 1); tilesDirty = true; this.paintAt.delete(c); }
    }
    // the win ripple
    if (this.winAt && this.m && this.tiles) {
      const t = (now - this.winAt) / 1000;
      if (t < 2.2) {
        for (const [c, k] of this.tileIdx) { const p = this.cellPos(c); const dd = Math.hypot(p.x, p.z); const h = Math.max(0, Math.sin((t * 6 - dd) * 1.5)) * Math.max(0, 1 - t / 2.2) * 0.25; this.dummy.position.set(p.x, -0.08 + h, p.z); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); this.tiles.setMatrixAt(k, this.dummy.matrix); }
        this.cube.position.y = 0.39 + Math.abs(Math.sin(t * 8)) * 0.35 * Math.max(0, 1 - t / 2.2);
        tilesDirty = true; moving = true;
      }
    }
    if (tilesDirty && this.tiles) { this.tiles.instanceMatrix.needsUpdate = true; if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true; }
    // mines spin, the shield shimmers
    for (const g of this.mines) if (g.parent) { g.rotation.y += dt * 0.8; g.rotation.x += dt * 0.3; }
    if (this.shieldMesh.visible) { this.shieldMesh.rotation.y += dt; moving = true; }
    for (const p of this.parts) { p.life += dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 8; p.m.rotation.y += dt * 6; }
    this.parts = this.parts.filter((p) => { if (p.life < p.max) return true; this.root.remove(p.m); return false; });
    if (this.parts.length) moving = true;
    if (this.shake > 0.01) { this.shake *= Math.pow(0.01, dt); this.root.position.set((Math.random() - 0.5) * this.shake, 0, (Math.random() - 0.5) * this.shake); moving = true; } else this.root.position.set(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else if (this.mines.length) setTimeout(this.kick, 80);
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.gov.dispose();
    this.ro.disconnect(); this.io.disconnect();
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.kick);
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
