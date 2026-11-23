// Tondu's Vine Climb renderer: the sky, balanced cinematic light (warm sun key, cool rim, sky/leaf fill), depth fog,
// god rays and drifting pollen, the stage views (the current one, the next one already built ahead, the last one
// fading below), Tondu himself, his rival Zeeza, Kaaki chasing, the guardians, particles for every event, and a
// cinematic camera rig: a follow cam with look-ahead that leans into turns, orbits the spiral trunks, pushes in at
// flower gates, cranes round at a new world, reveals the guardian, holds on a fall and slowly orbits on the title.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor, shadowsFor } from "@/lib/perf";
import { Lizard, LIZ_LEN } from "./lizard";
import * as M from "./models";
import { pathAt, trunkAt } from "./path";
import { Kit, PIPPI_Z, StageView, VR } from "./view";
import { GUARDIANS, WORLDS, type World } from "./worlds";
import type { Sim } from "./sim";
import type { SimEvent, Stage } from "./types";

export type Quality = "low" | "medium" | "high";
export interface VineLook { skin: string; hat: string }

const tP = [0, 0, 0], tT = [0, 0, 0], tN = [0, 0, 0];
const PT = { p: tP, t: tT, n: tN };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3(), vE = new THREE.Vector3();
const mA = new THREE.Matrix4(), qA = new THREE.Quaternion(), sA = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; color: THREE.Color; grav: number; spin: number; drag: number }
class Particles {
  mesh: THREE.InstancedMesh; parts: Part[] = []; max: number;
  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, max: number) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, new THREE.Color("#fff"));
    scene.add(this.mesh);
  }
  add(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: string | THREE.Color, grav = 0, drag = 0.5) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({ p: p.clone(), v: v.clone(), life, max: life, size, color: new THREE.Color(color), grav, spin: Math.random() * 6, drag });
  }
  update(dt: number, cam: THREE.Camera) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.v.y -= q.grav * dt; q.v.multiplyScalar(1 - q.drag * dt); q.p.addScaledVector(q.v, dt);
    }
    for (const q of this.parts) {
      const k = q.life / q.max, s = q.size * (k < 0.25 ? k * 4 : 1);
      qA.copy(cam.quaternion); qA.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), q.spin + (1 - k) * 3));
      mA.compose(q.p, qA, sA.set(s, s, s)); this.mesh.setMatrixAt(n, mA); this.mesh.setColorAt(n, q.color); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.parts = []; this.mesh.count = 0; }
}

/** a soft round sprite texture (for glow particles and god rays) */
function softTex(kind: "dot" | "ray"): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = kind === "dot" ? 64 : 32; cv.height = kind === "dot" ? 64 : 256;
  const c = cv.getContext("2d")!;
  if (kind === "dot") { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
  else { const g = c.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 32, 256); const f = c.createLinearGradient(0, 0, 0, 256); f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(0.3, "rgba(0,0,0,1)"); f.addColorStop(1, "rgba(0,0,0,0)"); c.globalCompositeOperation = "destination-in"; c.fillStyle = f; c.fillRect(0, 0, 32, 256); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export interface Cine { kind: "gate" | "world" | "guardian" | "tail" | "fall" | "rush" | "mid"; t: number; dur: number }

export class VineRenderer {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private gov: FrameGovernor | null = null;
  private q: Quality; private w = 1; private h = 1; private t = 0;
  private keep: { dispose: () => void }[] = [];
  kit: Kit;
  views: StageView[] = [];
  liz: Lizard;
  private rival: Lizard | null = null;
  private crow: THREE.Group; private crowWings: THREE.Mesh | null = null;
  private pippi: THREE.Group; private pippiWings: THREE.Mesh | null = null;
  private guard: { g: THREE.Group; wings: THREE.Mesh | null; id: string } | null = null;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private rim: THREE.DirectionalLight; private flash = 0;
  private rays: THREE.Mesh[] = []; private rayMat: THREE.MeshBasicMaterial;
  private leaves: Particles; private glows: Particles; private motes: Particles;
  private rain: THREE.InstancedMesh; private rainPos: THREE.Vector3[] = [];
  private droppedTail: { m: THREE.Mesh; v: THREE.Vector3; w: number; life: number } | null = null;
  private fog: THREE.Fog;
  // camera rig
  private camPos = new THREE.Vector3(0, 0, 20); private camLook = new THREE.Vector3(); private camInit = false;
  private shake = 0; private fovKick = 0; private cine: Cine | null = null;
  private insetTop = 0; private insetBottom = 0;
  /** the title screen: a slow orbit round Tondu */
  title = false;
  /** art renders: a fixed camera (offsets from Tondu's head) */
  artCam: { off: THREE.Vector3; look: THREE.Vector3; fov?: number } | null = null;
  private head = new THREE.Vector3(); private headUp = new THREE.Vector3(0, 1, 0);
  private lastS = 0; private fallT = -1; private fallV = new THREE.Vector3();
  private tailGrow = 1; private snap = 0; private flushK = 0;
  private world: World = WORLDS[0];
  private look: VineLook;

  constructor(host: HTMLElement, quality: Quality, look: VineLook) {
    this.q = quality; this.look = look;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false, alpha: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    if (shadowsFor(quality)) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", display: "block" });
    const k = <X extends { dispose: () => void }>(x: X) => { this.keep.push(x); return x; };
    this.kit = new Kit();
    // light: sky / leaf fill, a warm sun key with soft shadows, a cool rim from behind
    this.hemi = new THREE.HemisphereLight("#DFF3FF", "#5E9A48", 1.0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#FFF1D6", 2.6); this.sun.position.set(-6, 10, 9); this.scene.add(this.sun); this.scene.add(this.sun.target);
    if (quality !== "low") {
      const sz = quality === "high" ? 2048 : 1024;
      this.sun.castShadow = true; this.sun.shadow.mapSize.set(sz, sz);
      const sc = this.sun.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 40; this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    }
    this.rim = new THREE.DirectionalLight("#BFE6FF", 0.9); this.rim.position.set(6, 4, -8); this.scene.add(this.rim);
    // sky
    this.skyMat = k(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color("#7EC8F0") }, hor: { value: new THREE.Color("#E6F7D2") }, sunDir: { value: new THREE.Vector3(-0.4, 0.5, -0.75).normalize() }, sunCol: { value: new THREE.Color("#FFF4D6") } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = clamp(vP.y * 0.9 + 0.25, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.8)); float s = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 64.0) * 0.9 + pow(s, 6.0) * 0.18); gl_FragColor = vec4(c, 1.0); }",
    }));
    this.sky = new THREE.Mesh(k(new THREE.SphereGeometry(300, 32, 16)), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    this.fog = new THREE.Fog("#CDEBC0", 30, 95); this.scene.fog = this.fog;
    // god rays
    const rayTex = k(softTex("ray"));
    this.rayMat = k(new THREE.MeshBasicMaterial({ map: rayTex, color: "#FFF4C8", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, side: THREE.DoubleSide }));
    const rg = k(new THREE.PlaneGeometry(1, 1));
    for (let i = 0; i < (quality === "low" ? 2 : 5); i++) { const m = new THREE.Mesh(rg, this.rayMat); m.renderOrder = 2; this.scene.add(m); this.rays.push(m); }
    // particles: leaves / petals (lit), glows (additive), pollen motes
    const dotTex = k(softTex("dot"));
    const leafP = k(new THREE.PlaneGeometry(0.22, 0.12)); const leafPM = k(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, side: THREE.DoubleSide }));
    this.leaves = new Particles(this.scene, leafP, leafPM, 220);
    const glowG = k(new THREE.PlaneGeometry(0.3, 0.3)); const glowM = k(new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.glows = new Particles(this.scene, glowG, glowM, 320);
    this.motes = new Particles(this.scene, glowG, glowM.clone(), 90); this.keep.push(this.motes.mesh.material as THREE.Material);
    // rain streaks
    const rgeo = k(new THREE.BoxGeometry(0.012, 0.5, 0.012)); const rmat = k(new THREE.MeshBasicMaterial({ color: "#D8ECFF", transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain = new THREE.InstancedMesh(rgeo, rmat, 260); this.rain.frustumCulled = false; this.rain.count = 0; this.scene.add(this.rain);
    for (let i = 0; i < 260; i++) this.rainPos.push(new THREE.Vector3((Math.random() - 0.5) * 24, Math.random() * 30 - 15, -Math.random() * 10 + 4));
    // Tondu
    this.liz = new Lizard(look.skin, look.hat); this.scene.add(this.liz.group);
    // Kaaki for crow chases
    const kg = M.guardianGeo(GUARDIANS.kaaki1);
    this.crow = new THREE.Group(); const cb = new THREE.Mesh(k(kg.body), this.kit.glossy); this.crow.add(cb);
    if (kg.wings) { this.crowWings = new THREE.Mesh(k(kg.wings), this.kit.mat); this.crow.add(this.crowWings); }
    this.crow.visible = false; this.scene.add(this.crow);
    // Pippi the tailorbird (mirror stages)
    const pg = M.guardianGeo({ id: "pippi", name: "Pippi", model: "bird", behaviour: "mimic", colors: ["#7ACB4A", "#F2E8C8", "#E8902A"], size: 0.5 });
    this.pippi = new THREE.Group(); this.pippi.add(new THREE.Mesh(k(pg.body), this.kit.glossy));
    if (pg.wings) { this.pippiWings = new THREE.Mesh(k(pg.wings), this.kit.mat); this.pippi.add(this.pippiWings); }
    this.pippi.scale.setScalar(0.55); this.pippi.visible = false; this.scene.add(this.pippi);
  }

  setInsets(top: number, bottom: number) { this.insetTop = top; this.insetBottom = bottom; this.applyOffset(); }
  private applyOffset() {
    const oy = (this.insetTop - this.insetBottom) / 2;
    if (Math.abs(oy) > 1) this.camera.setViewOffset(this.w, this.h, 0, -oy, this.w, this.h); else this.camera.clearViewOffset();
  }
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.applyOffset();
  }

  // ------------------------------------------------------------------ stages
  addView(st: Stage, off: THREE.Vector3): StageView {
    const v = new StageView(st, off, this.kit, this.q);
    this.scene.add(v.g); this.views.push(v);
    return v;
  }
  dropView(v: StageView) { v.dispose(); this.views = this.views.filter((x) => x !== v); }
  viewOf(st: Stage) { return this.views.find((v) => v.st === st) ?? null; }

  /** where Tondu is: on the vine surface at s, round it by angle (0 = side +1, π = side -1, π/2 = toward the camera) */
  surface(v: StageView, s: number, angle: number, br: number, out: THREE.Vector3, up: THREE.Vector3): THREE.Vector3 {
    const p = v.st.path;
    if (s < 0) {
      // below the stage start (laying the body down): the previous stage's vine if there is one, else straight down
      const prev = this.views[this.views.indexOf(v) - 1];
      if (prev) return this.surface(prev, prev.st.path.len + s, angle, 0, out, up);
      pathAt(p, 0, PT); out.set(tP[0], tP[1] + s, tP[2]).add(v.off);
    } else { pathAt(p, s, PT); out.set(tP[0], tP[1], tP[2]).add(v.off); }
    vA.set(tT[0], tT[1], tT[2]).normalize(); vB.set(tN[0], tN[1], tN[2]).normalize(); vC.crossVectors(vA, vB).normalize();
    const fs = v.forkShift(Math.max(0, s), br); out.addScaledVector(vB, fs);
    up.copy(vB).multiplyScalar(Math.cos(angle)).addScaledVector(vC, Math.sin(angle)).normalize();
    out.addScaledVector(up, VR);
    return out;
  }
  /** lay Tondu's body down behind s (after a restart / at the title) */
  resetLizard(v: StageView, s: number, angle: number) {
    this.liz.reset((d, p, up) => this.surface(v, s - d, angle, 0, p, up));
    this.lastS = s; this.fallT = -1; this.camInit = false;
  }
  setWorld(w: World) {
    this.world = w;
  }
  setLook(l: VineLook) {
    this.look = l;
    const old = this.liz; const g = old.group.parent;
    this.liz = new Lizard(l.skin, l.hat); g?.add(this.liz.group);
    old.dispose();
  }
  setGuardian(id: string | null) {
    if (this.guard) { this.guard.g.removeFromParent(); this.guard.g.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); this.guard = null; }
    if (!id || !GUARDIANS[id]) return;
    const gd = GUARDIANS[id];
    if (gd.model === "lizard") {
      if (!this.rival) { this.rival = new Lizard("leaf", "none"); this.scene.add(this.rival.group); }
      return;
    }
    const geo = M.guardianGeo(gd), g = new THREE.Group();
    g.add(new THREE.Mesh(geo.body, this.kit.glossy));
    let wings: THREE.Mesh | null = null;
    if (geo.wings) { wings = new THREE.Mesh(geo.wings, this.kit.mat); g.add(wings); }
    g.scale.setScalar(gd.size * 1.6);
    this.scene.add(g); this.guard = { g, wings, id };
  }
  setRival(on: boolean) {
    if (on && !this.rival) { this.rival = new Lizard("leaf", "none"); this.scene.add(this.rival.group); }
    if (!on && this.rival) { this.rival.dispose(); this.rival = null; }
  }
  cinematic(kind: Cine["kind"], dur = 1.2) { this.cine = { kind, t: 0, dur }; if (kind === "tail") this.shake = Math.max(this.shake, 0.35); }

  // ------------------------------------------------------------------ events → effects
  onEvent(e: SimEvent, sim: Sim, v: StageView) {
    const h = this.head;
    const up = this.headUp;
    switch (e.t) {
      case "flip": for (let i = 0; i < 6; i++) this.leaves.add(h, vA.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.2).multiplyScalar(2.6), 0.9, 1, this.world.leaf[i % 3], 3, 1.2); break;
      case "snap": {
        const b = sim.st.bugs[e.i];
        const p = v.sidePoint(b.s, b.side === 0 ? sim.side : b.side, 0.32, b.br).add(v.off);
        this.snap = 1;
        for (let i = 0; i < (e.gold ? 14 : 7); i++) this.glows.add(p, vA.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(e.gold ? 3.4 : 2.2), 0.45, e.gold ? 0.55 : 0.35, e.gold ? "#FFD34A" : "#E8FFB0", 0, 2);
        if (e.combo > 0 && e.combo % 10 === 0) { this.flushK = 1; for (let i = 0; i < 20; i++) this.glows.add(h, vA.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(4), 0.7, 0.5, "#FF8A3A", 1, 1.4); }
        break;
      }
      case "tail": {
        this.cinematic("tail", 0.5);
        // the tail drops and wiggles away
        const tailG = new THREE.CylinderGeometry(0.035, 0.004, 1.25, 8, 6); tailG.rotateX(Math.PI / 2);
        const tm = new THREE.Mesh(tailG, new THREE.MeshStandardMaterial({ color: this.liz.skin.base, roughness: 0.6 }));
        tm.position.copy(h).addScaledVector(up, -0.1); this.scene.add(tm);
        this.droppedTail = { m: tm, v: vA.copy(up).multiplyScalar(1.5).add(new THREE.Vector3(0, 1.2, 1.2)).clone(), w: 0, life: 1.8 };
        this.tailGrow = 0.12; this.liz.tailK = 0.12;
        for (let i = 0; i < 12; i++) this.leaves.add(h, vA.set(Math.random() - 0.5, Math.random(), Math.random()).multiplyScalar(3), 1, 1, "#C8B080", 4, 1);
        break;
      }
      case "regrow": this.tailGrow = 1; for (let i = 0; i < 10; i++) this.glows.add(h, vA.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(2), 0.6, 0.4, "#B8FF8A", 0, 1.5); break;
      case "shield": this.shake = 0.2; for (let i = 0; i < 16; i++) this.glows.add(h, vA.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4), 0.6, 0.5, "#7CFF6A", 0, 1.5); break;
      case "smash": { const hz = sim.st.haz[e.i]; const p = v.sidePoint(hz.s, hz.side === 0 ? 1 : hz.side, 0.2).add(v.off); v.smash(e.i); for (let i = 0; i < 10; i++) this.leaves.add(p, vA.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(4.5), 0.9, 0.9, "#C2412A", 6, 0.8); this.shake = Math.max(this.shake, 0.12); break; }
      case "leap": for (let i = 0; i < 8; i++) this.leaves.add(h, vA.set(Math.random() - 0.5, -Math.random(), Math.random() - 0.5).multiplyScalar(2), 0.8, 0.9, this.world.vine[2], 4, 1); break;
      case "land": this.shake = Math.max(this.shake, 0.08); for (let i = 0; i < 6; i++) this.leaves.add(h, vA.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(2), 0.6, 0.8, this.world.leaf[0], 3, 1.2); break;
      case "pick": for (let i = 0; i < 16; i++) this.glows.add(h, vA.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3.5), 0.7, 0.5, e.kind === "sun" ? "#FFB43A" : e.kind === "shield" ? "#7CFF6A" : e.kind === "magnet" ? "#FF6A5A" : "#C8FF9A", 0, 1.4); break;
      case "rush": this.cinematic("rush", 0.8); this.flushK = 1; break;
      case "gate": {
        this.cinematic("gate", 0.9);
        for (let i = 0; i < 30; i++) this.leaves.add(h.clone().addScaledVector(UP, 0.6), vA.set(Math.random() - 0.5, Math.random() * 1.2, Math.random() - 0.5).multiplyScalar(4), 1.6, 1.1, i % 2 ? this.world.accent : "#FFFFFF", 1.5, 1.1);
        break;
      }
      case "mid": this.cinematic("mid", 0.6); for (let i = 0; i < 14; i++) this.glows.add(h, vA.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(2.5), 0.7, 0.45, "#B8FF7A", 0, 1.2); break;
      case "fall": this.fallT = 0; this.fallV.copy(up).multiplyScalar(1.5).add(new THREE.Vector3(0, 2, 2)); this.cinematic("fall", 1.4); break;
      case "chase": this.shake = 0.25; break;
      case "arm": {
        const hz = sim.st.haz[e.i];
        if (hz.kind === "lightning") this.flash = 1;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ frame
  frame(dt: number, sim: Sim | null, v: StageView | null) {
    this.t += dt;
    const t = this.t;
    // ---------------------------------------------------- Tondu's pose
    if (sim && v) {
      const angle = sim.angle();
      let moved = Math.max(0, sim.s - this.lastS);
      this.lastS = sim.s;
      if (this.fallT >= 0) {
        // falling: off the vine, tumbling down
        this.fallT += dt;
        this.fallV.y -= 14 * dt;
        this.head.addScaledVector(this.fallV, dt);
        this.headUp.applyAxisAngle(vA.set(0, 0, 1), dt * 5).normalize();
        moved = 0.05;
      } else if (sim.leap) {
        const L = sim.leap, k = Math.min(1, L.k);
        const a = this.surface(v, L.from, angle, sim.branch, vD.set(0, 0, 0), vE.set(0, 0, 0)).clone(), ua = vE.clone();
        const b = this.surface(v, L.to, angle, sim.branch, vD, vE).clone(), ub = vE.clone();
        const hgt = 0.7 + (L.to - L.from) * 0.12;
        pathAt(v.st.path, (L.from + L.to) / 2, PT);
        vC.crossVectors(vA.set(tT[0], tT[1], tT[2]).normalize(), vB.set(tN[0], tN[1], tN[2]).normalize()).normalize();
        this.head.copy(a).lerp(b, ease(k)).addScaledVector(ua.clone().lerp(ub, k).normalize(), Math.sin(k * Math.PI) * hgt).addScaledVector(vC, Math.sin(k * Math.PI) * 0.6);
        this.headUp.copy(ua).lerp(ub, k).normalize();
      } else {
        this.surface(v, sim.s, angle, sim.branch, this.head, this.headUp);
      }
      this.snap = Math.max(0, this.snap - dt * 6);
      this.flushK = Math.max(sim.rush > 0 ? 1 : 0, this.flushK - dt * 0.6);
      this.liz.tailK += ((sim.tail ? Math.max(this.tailGrow, 1) : 0.12) - this.liz.tailK) * Math.min(1, dt * (sim.tail ? 1.6 : 8));
      this.liz.update({ head: this.head, up: this.headUp, moved, airborne: !!sim.leap || this.fallT >= 0, cling: sim.clinging ? 1 : 0, flush: this.flushK, snap: Math.sin(this.snap * Math.PI) * (this.snap > 0 ? 1 : 0), bob: 0, vineR: VR }, dt);
      // Sun Rush trail
      if (sim.rush > 0 && Math.random() < 0.7) this.glows.add(this.head, vA.set(Math.random() - 0.5, -1, Math.random() - 0.5).multiplyScalar(1.2), 0.5, 0.45, Math.random() < 0.5 ? "#FF9A2A" : "#FFE04A", 0, 1);
      // rival, crow, guardian
      if (this.rival && sim.st.rival) {
        const rs = Math.min(sim.st.path.len, sim.rivalS);
        this.surface(v, rs, Math.PI / 2 + 0.9, 0, vD, vE); vD.z -= 1.2;
        this.rival.update({ head: vD, up: vE, moved: Math.max(0, sim.st.rival.v * dt), airborne: false, cling: 0, flush: 0, snap: 0, bob: 0, vineR: VR }, dt);
        this.rival.group.visible = true;
      } else if (this.rival) this.rival.group.visible = false;
      // Pippi mirrors Tondu on his own vine behind
      const mirror = sim.st.haz.some((h) => h.mirror);
      this.pippi.visible = mirror;
      if (mirror) { this.surface(v, sim.s, angle + Math.PI, 0, vD, vE); vD.z += PIPPI_Z; vD.addScaledVector(vE, 0.25); this.pippi.position.copy(vD); this.pippi.quaternion.setFromUnitVectors(UP, vE); if (this.pippiWings) this.pippiWings.rotation.z = Math.sin(t * 16) * 0.5; }
      this.crow.visible = !!sim.st.chase;
      if (sim.st.chase) {
        const cs = Math.max(0, Math.min(sim.st.path.len, sim.chaseS));
        this.surface(v, cs, 0, 0, vD, vE);
        this.crow.position.lerp(vD.addScaledVector(UP, -0.4).add(new THREE.Vector3(0, 0, 1.2)), damp(6, dt));
        this.crow.lookAt(this.head);
        if (this.crowWings) this.crowWings.rotation.z = Math.sin(t * 14) * 0.6;
      }
      if (this.guard) {
        // the guardian hovers ahead of Tondu, off to the side, bobbing; swoops through armed dives / throws
        const ahead = Math.min(sim.st.path.len, sim.s + 9);
        this.surface(v, ahead, 0, 0, vD, vE);
        const side = Math.sin(t * 0.35) > 0 ? 1 : -1;
        vD.x += side * 2.4; vD.z += 1.4; vD.y += Math.sin(t * 2.2) * 0.4;
        this.guard.g.position.lerp(vD, damp(2.5, dt));
        this.guard.g.lookAt(this.head);
        if (this.guard.wings) this.guard.wings.rotation.z = Math.sin(t * 10) * 0.55;
      }
    }
    // the dropped tail
    if (this.droppedTail) {
      const d = this.droppedTail; d.life -= dt; d.v.y -= 12 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.y = Math.sin(t * 30) * 0.8; d.m.rotation.x += dt * 4;
      if (d.life <= 0) { d.m.removeFromParent(); d.m.geometry.dispose(); (d.m.material as THREE.Material).dispose(); this.droppedTail = null; }
    }
    // ---------------------------------------------------- views
    for (const vv of this.views) vv.update(sim && v === vv ? sim : null, t, this.camera.position);
    // ---------------------------------------------------- world look (blends into the next world near the gate)
    const wA = v ? v.world : this.world;
    let wB = wA, blend = 0;
    if (v && sim) {
      const nxt = this.views[this.views.indexOf(v) + 1];
      if (nxt && nxt.world !== v.world) { wB = nxt.world; blend = ease((sim.s - (sim.st.path.len - 45)) / 45); }
    }
    this.applyWorld(wA, wB, blend, dt);
    // ---------------------------------------------------- camera
    this.updateCamera(dt, sim, v);
    // light follows Tondu (shadow box)
    this.sun.target.position.copy(this.head); this.sun.position.copy(this.head).add(vA.set(-6, 10, 9));
    // god rays stay in the background round the camera
    this.rays.forEach((r, i) => {
      r.position.set(this.camPos.x - 9 + i * 4.5, this.camPos.y + 4 + Math.sin(t * 0.2 + i) * 1.5, -14 - i * 2);
      r.scale.set(2.2 + i * 0.4, 46, 1); r.rotation.set(0, 0, -0.42 + Math.sin(t * 0.15 + i * 2) * 0.04);
    });
    // pollen / fireflies drifting in the air
    const night = this.world.weather === "night";
    if (Math.random() < (night ? 0.5 : 0.25)) {
      const p = vA.copy(this.camLook).add(vB.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8 + 2));
      this.motes.add(p, vB.set((Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 0.3, 0), 4 + Math.random() * 3, night ? 0.3 : 0.14, night ? "#FFE36A" : "#FFF6D0", -0.02, 0.1);
    }
    // rain
    const raining = this.world.weather === "rain" || this.world.weather === "storm" || (sim?.st.zones.some((z) => z.kind === "rain") ?? false);
    if (raining) {
      this.rain.count = this.rain.instanceMatrix.count;
      this.rainPos.forEach((p, i) => {
        p.y -= dt * 18; if (p.y < -16) p.y += 32;
        mA.compose(vA.set(this.camLook.x + p.x, this.camLook.y + p.y, p.z), qA.setFromAxisAngle(vB.set(0, 0, 1), 0.12), sA.set(1, 1, 1));
        this.rain.setMatrixAt(i, mA);
      });
      this.rain.instanceMatrix.needsUpdate = true;
    } else this.rain.count = 0;
    // lightning flash
    if (this.flash > 0) { this.flash -= dt * 3; this.hemi.intensity += Math.max(0, this.flash) * 2.5; }
    this.leaves.update(dt, this.camera); this.glows.update(dt, this.camera); this.motes.update(dt, this.camera);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  private cA = new THREE.Color(); private cB = new THREE.Color();
  private applyWorld(a: World, b: World, k: number, dt: number) {
    const mix = (x: string, y: string, out: THREE.Color) => out.set(x).lerp(this.cB.set(y), k);
    const u = this.skyMat.uniforms;
    (u.top.value as THREE.Color).lerp(mix(a.sky[0], b.sky[0], this.cA), damp(2, dt));
    (u.hor.value as THREE.Color).lerp(mix(a.sky[1], b.sky[1], this.cA), damp(2, dt));
    (u.sunCol.value as THREE.Color).lerp(mix(a.sun, b.sun, this.cA), damp(2, dt));
    this.fog.color.lerp(mix(a.fog, b.fog, this.cA), damp(2, dt));
    const night = (w: World) => (w.weather === "night" ? 1 : 0), dim = (w: World) => (w.weather === "storm" ? 0.75 : w.weather === "rain" ? 0.85 : w.weather === "dusk" ? 0.9 : 1);
    const nk = lerp(night(a), night(b), k), dk = lerp(dim(a), dim(b), k);
    this.hemi.color.lerp(this.cA.set(nk > 0.5 ? "#9FC8FF" : "#E4F4FF"), damp(2, dt));
    this.hemi.groundColor.lerp(mix(a.leaf[1], b.leaf[1], this.cA), damp(2, dt));
    this.hemi.intensity = lerp(1.0, 0.95, nk) * dk;
    this.sun.color.lerp(mix(a.sun, b.sun, this.cA), damp(2, dt));
    this.sun.intensity = lerp(2.6, 1.1, nk) * dk;
    this.rim.color.set(nk > 0.5 ? "#7CFFB4" : "#BFE6FF"); this.rim.intensity = lerp(0.9, 1.3, nk);
    this.renderer.toneMappingExposure = lerp(1.02, 1.25, nk);
    this.rayMat.opacity = (a.weather === "night" || a.weather === "storm" || a.weather === "rain" ? 0.03 : a.weather === "golden" ? 0.16 : 0.11) * (1 - k * 0.5);
    this.rayMat.color.set(a.sun);
    this.fog.near = a.weather === "mist" ? 20 : 30; this.fog.far = a.weather === "mist" ? 70 : 95;
    this.world = k > 0.5 ? b : a;
  }

  private updateCamera(dt: number, sim: Sim | null, v: StageView | null) {
    const cam = this.camera, head = this.head;
    if (this.artCam) {
      cam.position.copy(head).add(this.artCam.off); cam.lookAt(vA.copy(head).add(this.artCam.look));
      if (this.artCam.fov && cam.fov !== this.artCam.fov) { cam.fov = this.artCam.fov; cam.updateProjectionMatrix(); }
      return;
    }
    const portrait = this.h > this.w;
    let D = portrait ? 15.5 + Math.max(0, (0.56 - this.w / this.h)) * 12 : 11.5;
    const want = new THREE.Vector3(), look = new THREE.Vector3();
    if (this.title || !sim || !v) {
      // the title: a slow orbit round Tondu, close and low
      const a = this.t * 0.18;
      look.copy(head).add(vA.set(0, 0.6, 0));
      want.copy(look).add(vA.set(Math.sin(a) * 5.5, 1.0 + Math.sin(this.t * 0.3) * 0.6, Math.cos(a) * 3.5 + 5.5));
    } else {
      const speed = sim.st.def.speed;
      D *= 1 + (speed - 3.2) * 0.04;
      // look ahead along the vine
      const aheadS = Math.min(sim.st.path.len + 6, sim.s + speed * 1.15 + 2);
      pathAt(v.st.path, Math.min(v.st.path.len, aheadS), PT);
      const ahead = vA.set(tP[0], tP[1], tP[2]).add(v.off);
      if (aheadS > v.st.path.len) ahead.y += aheadS - v.st.path.len;
      // frame Tondu in the lower part of the screen with the vine ahead above him; sideways the camera stays mostly on him
      look.set(lerp(head.x, ahead.x, 0.3), lerp(head.y, ahead.y, 0.55), lerp(head.z, ahead.z, 0.4));
      // lean the camera a little with the vine's direction
      pathAt(v.st.path, sim.s, PT);
      const yaw = -tT[0] * 0.16 + Math.sin(this.t * 0.25) * 0.025;
      const pitch = 0.1;
      want.copy(look).add(vB.set(Math.sin(yaw) * D, -Math.sin(pitch) * D, Math.cos(yaw) * D));
      // spiral trunk: orbit so we stay outside the trunk, facing Tondu
      const tr = trunkAt(v.st.path, sim.s);
      if (tr) {
        const cx = tr.x + v.off.x, cz = tr.z + v.off.z;
        const dir = vC.set(head.x - cx, 0, head.z - cz); if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1); dir.normalize();
        const into = Math.min(1, Math.min(sim.s - (tr.s0 - 2), (tr.s1 + 2) - sim.s) / 4);
        const orbit = vD.set(cx, look.y, cz).addScaledVector(dir, tr.r + D * 0.62).add(vE.set(0, -D * 0.08, 0));
        want.lerp(orbit, ease(into));
        look.lerp(vE.set(head.x, head.y + 1.2, head.z), ease(into) * 0.6);
      }
      if (sim.st.zones.some((z) => z.kind === "hole" && sim.s > z.s0 && sim.s < z.s1)) want.lerp(look.clone().add(vB.set(0, -0.5, D * 0.62)), 0.5);
      // the fall: hold position, look down at him
      if (this.fallT >= 0) { want.copy(this.camPos); look.copy(head); }
    }
    // cinematic moments
    let fov = 40;
    if (this.cine) {
      const c = this.cine; c.t += dt; const k = c.t / c.dur, bell = Math.sin(Math.min(1, k) * Math.PI);
      if (c.kind === "gate") { want.lerp(look.clone().add(want.clone().sub(look).multiplyScalar(0.8)), bell); fov -= 5 * bell; }
      if (c.kind === "world") { const a = (1 - ease(k)) * 0.9; want.sub(look).applyAxisAngle(UP, a).multiplyScalar(1 + 0.25 * (1 - ease(k))).add(look).add(vA.set(0, -2.5 * (1 - ease(k)), 0)); }
      if (c.kind === "guardian" && this.guard) { look.lerp(this.guard.g.position, bell * 0.65); want.lerp(want.clone().add(vA.set(0, 0, 6)), bell); }
      if (c.kind === "rush") fov += 7 * bell;
      if (c.kind === "tail") fov -= 3 * bell;
      if (k >= 1) this.cine = null;
    }
    if (sim && sim.rush > 0) fov += 4;
    if (!this.camInit) { this.camPos.copy(want); this.camLook.copy(look); this.camInit = true; }
    this.camPos.lerp(want, damp(this.title ? 1.5 : 3.2, dt));
    this.camLook.lerp(look, damp(this.title ? 2 : 5, dt));
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; const s = this.shake * 0.35; cam.position.add(vA.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0)); }
    cam.lookAt(this.camLook);
    this.fovKick += (fov - 40 - this.fovKick) * damp(4, dt);
    const f = 40 + this.fovKick;
    if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
  }

  /** pose Tondu for the title / wardrobe (a gentle curl round a vine, push-ups) */
  titlePose(v: StageView, s: number, dt: number) {
    // upright on top of the vine (whichever side is up there), turned a little toward the camera
    pathAt(v.st.path, s, PT);
    const ang = tN[1] >= 0 ? 0.3 : Math.PI - 0.3;
    this.surface(v, s, ang, 0, this.head, this.headUp);
    this.liz.update({ head: this.head, up: this.headUp, moved: 0, airborne: false, cling: 0, flush: 0, snap: 0, bob: (Math.sin(this.t * 0.7) > 0.6 ? 1 : 0), vineR: VR }, dt);
  }

  screenOf(p: THREE.Vector3): [number, number] { const v = p.clone().project(this.camera); return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h]; }
  headScreen(): [number, number] { return this.screenOf(this.head); }

  clearFx() { this.leaves.clear(); this.glows.clear(); }
  dispose() {
    this.gov?.dispose();
    for (const v of this.views) v.dispose();
    this.views = [];
    this.liz.dispose(); this.rival?.dispose();
    this.setGuardian(null);
    this.crow.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.kit.dispose();
    for (const k of this.keep) k.dispose();
    this.leaves.mesh.geometry.dispose(); this.glows.mesh.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
export { LIZ_LEN };
