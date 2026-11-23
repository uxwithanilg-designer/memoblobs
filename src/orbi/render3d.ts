// Orbi GP on screen: the world, the road (streamed in chunks round the camera), the pieces on it, the marbles, the
// camera (a drone reveal of the course, a chase cam behind Orbi, a held shot when you fall, an orbit at the finish) and
// the effects (Orbi's glowing trail, sparks, coin glints, confetti). Reflections on the marbles come from a small
// environment map of the world's own sky. Stretches of weather (rain, snow, fog, sandstorms, smoke, petals, falling code,
// fireworks, the dark) change the fog, the light and a cloud of particles round the camera; camera twists film a stretch
// from the side, from above, low down, tilted, wide, far back or from the front (the page adds the screen effects).
import * as THREE from "three";
import { worldOf } from "./data/worlds";
import type { Sim } from "./sim";
import { MarbleView } from "./three/marble";
import { Pieces, type View } from "./three/pieces";
import { glowTex } from "./three/tex";
import { CHUNK, TrackMeshes, type Chunk } from "./three/trackMesh";
import { WorldScene } from "./three/world";
import type { Track } from "./track";
import type { Stage } from "./types";

export type Quality = "low" | "medium" | "high";
export type Shot = "showroom" | "intro" | "chase" | "finish";
export function autoQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return coarse ? (mem >= 6 ? "medium" : "low") : "high";
}

interface Spark { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; c: THREE.Color }

export class OrbiRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.1, 5000);
  readonly cv: HTMLCanvasElement;
  private env: THREE.Texture | null = null;
  private world: WorldScene | null = null;
  private meshes: TrackMeshes | null = null;
  private pieces: Pieces | null = null;
  private chunks = new Map<number, Chunk>();
  private views = new Map<number, View>();
  private marbles: MarbleView[] = [];
  private st: Stage | null = null; private tr: Track | null = null; private sim: Sim | null = null;
  shot: Shot = "showroom"; private shotT = 0;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camUp = new THREE.Vector3(0, 1, 0); private camFirst = true;
  private F = new Float32Array(12);
  private w = 1; private h = 1;
  time = 0;
  // effects
  private trail: THREE.Mesh; private trailPts: THREE.Vector3[] = []; private trailGeo: THREE.BufferGeometry;
  private sparks: Spark[] = []; private sparkPts: THREE.Points; private sparkGeo: THREE.BufferGeometry;
  private shadowBlobs: THREE.Mesh[] = [];
  private fov = 64;
  // weather and camera twists
  private base = { sun: 1, hemi: 1, near: 380, far: 2000, color: new THREE.Color() };
  private atmo = { dark: 0, fog: 0, flash: 0 };
  private wx: THREE.Points; private wxGeo: THREE.BufferGeometry; private wxKind = ""; private wxVel = new Float32Array(700 * 3);
  /** the camera twist (or screen effect) on the stretch Orbi is on now */
  view = ""; weather = "";
  private fwT = 0;
  /** your Time Trial ghost: its marble and its path (s dm, u cm, h cm every 0.1 s) */
  private ghost: { view: MarbleView; g: number[] } | null = null;
  private chasers: Stage["objs"] = [];

  constructor(host: HTMLElement, readonly quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "medium" ? 1.6 : 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cv = this.renderer.domElement;
    this.cv.style.display = "block"; this.cv.style.width = "100%"; this.cv.style.height = "100%"; this.cv.style.touchAction = "none";
    host.appendChild(this.cv);
    this.scene.add(this.camera);
    // trail: a ribbon of the last positions
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 2 * 3), 3));
    const ta = new Float32Array(40 * 2 * 4); for (let i = 0; i < 40; i++) { const k = 0.32 * Math.pow(1 - i / 39, 2); for (let j = 0; j < 2; j++) ta.set([0.25, 0.85, 1, k], (i * 2 + j) * 4); }
    this.trailGeo.setAttribute("color", new THREE.BufferAttribute(ta, 4));
    const idx: number[] = []; for (let i = 0; i < 39; i++) { const p = i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); } this.trailGeo.setIndex(idx);
    this.trail = new THREE.Mesh(this.trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false; this.scene.add(this.trail);
    // sparks
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(500 * 3), 3));
    this.sparkGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(500 * 3), 3));
    this.sparkPts = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ size: 0.35, map: glowTex("#ffffff"), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkPts.frustumCulled = false; this.scene.add(this.sparkPts);
    // weather particles round the camera
    this.wxGeo = new THREE.BufferGeometry();
    this.wxGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(700 * 3), 3));
    this.wxGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(700 * 3), 3));
    this.wx = new THREE.Points(this.wxGeo, new THREE.PointsMaterial({ size: 0.3, map: glowTex("#ffffff"), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.wx.frustumCulled = false; this.wx.visible = false; this.scene.add(this.wx);
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
  }
  get portrait() { return this.h >= this.w; }

  /** a small environment map of this world's sky, for reflections on the marbles and pieces */
  private makeEnv(st: Stage) {
    const W = worldOf(st.look.world);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const sc = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { a: { value: new THREE.Color(W.pal.top) }, b: { value: new THREE.Color(W.pal.horizon) }, c: { value: new THREE.Color(W.pal.cloud) } },
      vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 a; uniform vec3 b; uniform vec3 c; varying vec3 v; void main(){ vec3 col = v.y > 0.0 ? mix(b, a, v.y) : mix(b, c, -v.y * 2.0); gl_FragColor = vec4(col * 1.2, 1.0); }" });
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(W.pal.light).multiplyScalar(5) }));
    lamp.position.set(-5, 6, -4); sc.add(lamp);
    const rt = pm.fromScene(sc, 0.02);
    pm.dispose(); mat.dispose();
    return rt.texture;
  }

  /** start fresh on a stage */
  setStage(st: Stage, tr: Track, sim: Sim) {
    this.clearStage();
    this.st = st; this.tr = tr; this.sim = sim;
    this.chasers = st.objs.filter((o) => o.k === "chaser");
    const W = worldOf(st.look.world);
    this.env?.dispose(); this.env = this.makeEnv(st);
    this.world = new WorldScene(W, tr, st.look.seed, this.quality);
    this.scene.add(this.world.group);
    this.scene.fog = new THREE.Fog(W.pal.horizon, this.quality === "low" ? 220 : 380, this.quality === "low" ? 1100 : 2000);
    this.base = { sun: this.world.sun.intensity, hemi: this.world.hemi.intensity, near: (this.scene.fog as THREE.Fog).near, far: (this.scene.fog as THREE.Fog).far, color: new THREE.Color(W.pal.horizon) };
    this.atmo = { dark: 0, fog: 0, flash: 0 }; if (this.view) this.screenFx(""); this.view = ""; this.weather = ""; this.wxKind = ""; this.wx.visible = false;
    this.meshes = new TrackMeshes(tr, W, this.quality);
    this.pieces = new Pieces(tr, W, this.env);
    this.scene.add(this.pieces.group);
    this.marbles = sim.marbles.map((m) => new MarbleView(m.skin, m.name, m.id === 0, this.quality, this.env));
    for (const v of this.marbles) this.scene.add(v.root);
    // soft round shadows under the marbles (cheap and always readable)
    this.shadowBlobs = sim.marbles.map(() => { const me = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex("#000000"), transparent: true, opacity: 0.45, depthWrite: false })); this.scene.add(me); return me; });
    this.trailPts = []; this.sparks = [];
    this.camFirst = true;
    this.shot = "showroom"; this.shotT = 0;
  }
  private clearStage() {
    this.setGhost(null);
    for (const c of this.chunks.values()) this.meshes?.disposeChunk(c);
    this.chunks.clear();
    for (const v of this.views.values()) this.pieces?.drop(v);
    this.views.clear();
    for (const v of this.marbles) { v.root.removeFromParent(); v.dispose(); }
    for (const b of this.shadowBlobs) { b.removeFromParent(); b.geometry.dispose(); (b.material as THREE.Material).dispose(); }
    this.marbles = []; this.shadowBlobs = [];
    this.world?.dispose(); this.world = null;
    this.pieces?.group.removeFromParent(); this.pieces?.dispose(); this.pieces = null;
    this.meshes?.dispose(); this.meshes = null;
  }
  setGhost(g: number[] | null) {
    if (this.ghost) { this.ghost.view.root.removeFromParent(); this.ghost.view.dispose(); this.ghost = null; }
    if (!g || !this.st) return;
    const view = new MarbleView(0, "You", true, this.quality, this.env); view.ghostify();
    this.scene.add(view.root); this.ghost = { view, g };
  }
  play(shot: Shot) { this.shot = shot; this.shotT = 0; if (shot === "chase") this.camFirst = true; }

  // ---------------------------------------------------------------- effects
  burst(p: THREE.Vector3, color: string, n: number, speed = 6, up = 4) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.sparks.length < 500; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * up + 1, (Math.random() - 0.5) * speed);
      this.sparks.push({ p: p.clone(), v, life: 0, max: 0.5 + Math.random() * 0.6, c: c.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, 0) });
    }
  }
  confetti(p: THREE.Vector3) { const cols = ["#FF5A7A", "#FFD23A", "#5CF2C9", "#5AA8FF", "#B88CFF"]; for (let k = 0; k < 5; k++) this.burst(p.clone().add(new THREE.Vector3(0, 6, 0)), cols[k], 30, 14, 10); }
  /** the world point at track coordinates */
  wp(s: number, u: number, h: number) { const P = [0, 0, 0]; this.tr!.point(s, u, h, P); return new THREE.Vector3(P[0], P[1], P[2]); }

  // ---------------------------------------------------------------- one frame
  frame(dt: number) {
    const st = this.st, tr = this.tr, sim = this.sim;
    if (!st || !tr || !sim || !this.meshes || !this.pieces || !this.world) return;
    this.time += dt; this.shotT += dt;
    const me = sim.marbles[0];
    const camS = this.shot === "intro" ? this.introS() : me.s;
    // ---- road chunks round the camera
    const reach = this.quality === "low" ? 300 : 420;
    const c0 = Math.max(0, Math.floor((camS - 80) / CHUNK)), c1 = Math.floor((camS + reach) / CHUNK);
    for (const [i, c] of this.chunks) if (i < c0 || i > c1) { this.meshes.disposeChunk(c); this.chunks.delete(i); }
    let budget = 2;
    for (let i = c0; i <= c1 && budget > 0; i++) { if (this.chunks.has(i) || i * CHUNK > tr.len) continue; const c = this.meshes.build(i); this.scene.add(c.group); this.chunks.set(i, c); budget--; }
    // ---- pieces round the camera
    const ahead = camS + (this.quality === "low" ? 220 : 300), behind = camS - 40;
    const seen = new Set<number>();
    const pieces = this.pieces;
    const show = (o: (typeof st.objs)[number]) => {
      seen.add(o.id);
      let v = this.views.get(o.id);
      if (!v) { const made = pieces.make(o); if (!made) return; v = made; this.views.set(o.id, v); this.scene.add(v.root); }
      pieces.place(v, sim, this.time);
    };
    // only the stretch round the camera (a long course has thousands of things on it)
    const objs = st.objs; let lo = 0, hi = objs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (objs[mid].s < behind - 60) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < objs.length; i++) {
      const o = objs[i];
      if (o.s > ahead) break;
      if (o.s < behind - ((o.ds ?? 0) > 40 ? o.ds ?? 0 : 0) || o.k === "coin" || o.k === "chaser") continue;
      show(o);
    }
    // chasers roll a long way from their mark: shown wherever they are
    for (const o of this.chasers) { const cs = sim.os(o); if (cs > behind - 20 && cs < ahead) show(o); }
    for (const [id, v] of this.views) if (!seen.has(id)) { this.pieces.drop(v); this.views.delete(id); }
    this.pieces.coinsFrame(st.objs, sim, behind, ahead, this.time);
    // ---- marbles
    sim.marbles.forEach((m, i) => {
      const view = this.marbles[i]; if (!view) return;
      const fr = tr.frame(m.s, this.F);
      const up = new THREE.Vector3(fr[6], fr[7], fr[8]);
      const p = this.wp(m.s, m.u, m.h + m.r);
      view.root.visible = !(m.ghost > 0 && Math.floor(this.time * 12) % 2 === 0 && m.fallT <= 0);
      view.place(p, m.r, up, dt, m.boostT > 0 ? 1 : 0);
      if (view.tag) view.tag.visible = this.shot !== "showroom" && !m.out;
      if (m.out) view.root.visible = false;
      // shadow on the ground below (only when there is ground)
      const b = this.shadowBlobs[i];
      const g = m.fallT > 0 ? null : sim.ground(m, m.s, m.u);
      if (g && this.quality === "low") { b.visible = true; b.position.copy(this.wp(m.s, m.u, g.h + 0.03)); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); const k = Math.max(0.3, 1 - (m.h - g.h) / 8); b.scale.setScalar(m.r * 1.2 * k); (b.material as THREE.MeshBasicMaterial).opacity = 0.45 * k; }
      else b.visible = false;
    });
    // ---- your ghost (Time Trial)
    if (this.ghost) {
      const g = this.ghost.g, k = Math.max(0, sim.t * 10), i = Math.min(Math.floor(k), g.length / 3 - 2), f = Math.min(1, k - i);
      if (i >= 0 && g.length >= 6) {
        const at = (j: number, o: number) => g[j * 3 + o] * (1 - f) + g[(j + 1) * 3 + o] * f;
        const s = at(i, 0) / 10, u = at(i, 1) / 100, h = at(i, 2) / 100, fr = tr.frame(s, this.F);
        this.ghost.view.root.visible = this.shot === "chase" || this.shot === "finish";
        this.ghost.view.place(this.wp(s, u, h + 0.55), 0.55, new THREE.Vector3(fr[6], fr[7], fr[8]), dt);
      }
    }
    // ---- Orbi's trail
    const P0 = this.wp(me.s, me.u, me.h + me.r * 0.3);
    if (me.fallT <= 0) { this.trailPts.unshift(P0); if (this.trailPts.length > 40) this.trailPts.pop(); }
    const pos = this.trailGeo.attributes.position as THREE.BufferAttribute;
    const fr0 = tr.frame(me.s, this.F), side = new THREE.Vector3(fr0[9], fr0[10], fr0[11]);
    // the glow trail only streams out behind a boost
    const wide = me.boostT > 0 || (me.active.turbo ?? 0) > 0 || (me.active.star ?? 0) > 0 ? 0.6 : 0;
    for (let i = 0; i < 40; i++) { const q = this.trailPts[Math.min(i, this.trailPts.length - 1)] ?? P0; const w = wide * (1 - i / 40) * Math.min(1, me.vs / 10); pos.setXYZ(i * 2, q.x - side.x * w, q.y - side.y * w, q.z - side.z * w); pos.setXYZ(i * 2 + 1, q.x + side.x * w, q.y + side.y * w, q.z + side.z * w); }
    pos.needsUpdate = true;
    // ---- sparks
    const sp = this.sparkGeo.attributes.position as THREE.BufferAttribute, sc = this.sparkGeo.attributes.color as THREE.BufferAttribute;
    this.sparks = this.sparks.filter((s) => (s.life += dt) < s.max);
    this.sparks.forEach((s, i) => { s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt); sp.setXYZ(i, s.p.x, s.p.y, s.p.z); const k = 1 - s.life / s.max; sc.setXYZ(i, s.c.r * k, s.c.g * k, s.c.b * k); });
    this.sparkGeo.setDrawRange(0, this.sparks.length); sp.needsUpdate = true; sc.needsUpdate = true;
    // ---- weather and camera twists on this stretch
    this.atmosphere(dt, sim);
    // ---- camera + world
    this.cameraStep(dt);
    this.world.follow(this.camera.position, this.time, camS);
    this.renderer.render(this.scene, this.camera);
  }

  /** weather: fog, light and particles ease in and out as Orbi rolls into a stretch of it */
  private atmosphere(dt: number, sim: Sim) {
    const me = sim.marbles[0], live = this.shot === "chase";
    const wz = live ? sim.zoneAt(me.s, "weather") : null, vz = live ? sim.zoneAt(me.s, "view") : null;
    this.weather = wz?.look ?? "";
    const view = vz?.look ?? "";
    if (view !== this.view) this.screenFx(view);
    this.view = view;
    if (view === "kaleido") this.cv.style.filter = `hue-rotate(${Math.round(this.time * 90) % 360}deg) saturate(1.6)`;
    const k = this.weather;
    const dark = k === "dark" || k === "night" || k === "neon" || k === "lanterns" || k === "storm" ? (k === "storm" ? 0.55 : 0.78) : this.view === "nightvision" ? 0.7 : 0;
    const fog = k === "fog" ? 1 : k === "sandstorm" ? 0.85 : k === "smoke" ? 0.7 : k === "storm" || k === "rain" || k === "snow" ? 0.45 : k === "code" ? 0.4 : 0;
    const e = 1 - Math.exp(-2.2 * dt);
    this.atmo.dark += (dark - this.atmo.dark) * e; this.atmo.fog += (fog - this.atmo.fog) * e;
    // lightning in a storm, the strobe on its stretch
    if (k === "storm" && Math.random() < dt * 0.35) this.atmo.flash = 1;
    if (this.view === "strobe") this.atmo.flash = Math.max(this.atmo.flash, (this.time * 2.1) % 1 < 0.12 ? 0.8 : 0);
    this.atmo.flash = Math.max(0, this.atmo.flash - dt * 5);
    const W = this.world!, f = this.scene.fog as THREE.Fog, light = (1 - this.atmo.dark * 0.85) + this.atmo.flash * 1.5;
    W.sun.intensity = this.base.sun * light; W.hemi.intensity = this.base.hemi * Math.max(0.2, 1 - this.atmo.dark * 0.7 + this.atmo.flash);
    f.near = this.base.near * (1 - this.atmo.fog * 0.93); f.far = this.base.far * (1 - this.atmo.fog * 0.9);
    const tint = k === "sandstorm" ? "#E0B070" : k === "smoke" ? "#8A8A92" : k === "code" ? "#0A3A1A" : this.atmo.dark > 0.3 ? "#101830" : "";
    f.color.copy(this.base.color); if (tint) f.color.lerp(new THREE.Color(tint), Math.max(this.atmo.fog, this.atmo.dark) * 0.8);
    // fireworks overhead
    if (k === "fireworks") { this.fwT -= dt; if (this.fwT <= 0) { this.fwT = 0.5 + Math.random() * 0.6; const p = this.wp(me.s + 40 + Math.random() * 60, (Math.random() - 0.5) * 40, 18 + Math.random() * 14); this.burst(p, ["#FF5A7A", "#FFD23A", "#5CF2C9", "#5AA8FF", "#B88CFF"][Math.floor(Math.random() * 5)], 40, 16, 6); } }
    // particles
    const kind = k === "rain" || k === "storm" ? "rain" : k === "snow" || k === "sandstorm" || k === "smoke" || k === "petals" || k === "code" || k === "rainbow" || k === "solar" ? k : "";
    if (kind !== this.wxKind) this.seedWx(kind);
    if (!kind) return;
    const P = this.wxGeo.attributes.position as THREE.BufferAttribute, c = this.camera.position, V = this.wxVel;
    for (let i = 0; i < 700; i++) {
      let x = P.getX(i) + V[i * 3] * dt, y = P.getY(i) + V[i * 3 + 1] * dt, z = P.getZ(i) + V[i * 3 + 2] * dt;
      if (kind === "petals") x += Math.sin(this.time * 2 + i) * dt * 2;
      if (y < c.y - 12) y += 24; if (y > c.y + 12) y -= 24;
      if (x < c.x - 30) x += 60; if (x > c.x + 30) x -= 60;
      if (z < c.z - 30) z += 60; if (z > c.z + 30) z -= 60;
      P.setXYZ(i, x, y, z);
    }
    P.needsUpdate = true;
  }
  /** screen effects of a camera twist: mirrored, upside down, chunky pixels, night vision */
  private screenFx(v: string) {
    const s = this.cv.style;
    s.transform = v === "mirror" ? "scaleX(-1)" : v === "flip" ? "rotate(180deg)" : "";
    s.filter = v === "nightvision" ? "grayscale(1) sepia(1) hue-rotate(70deg) saturate(4) brightness(1.15)" : "";
    s.imageRendering = v === "pixel" ? "pixelated" : "";
    const pr = Math.min(window.devicePixelRatio || 1, this.quality === "high" ? 2 : this.quality === "medium" ? 1.6 : 1.25);
    this.renderer.setPixelRatio(v === "pixel" ? 0.2 : pr);
    this.renderer.setSize(this.w, this.h, false);
  }
  private seedWx(kind: string) {
    this.wxKind = kind; this.wx.visible = !!kind; if (!kind) return;
    const P = this.wxGeo.attributes.position as THREE.BufferAttribute, C = this.wxGeo.attributes.color as THREE.BufferAttribute, c = this.camera.position, V = this.wxVel;
    const col: Record<string, string[]> = { rain: ["#BFD8FF"], snow: ["#FFFFFF"], sandstorm: ["#F2C98A", "#D8A060"], smoke: ["#8A8A92", "#6A6A72"], petals: ["#FFB8DC", "#FF8AC8", "#FFFFFF"], code: ["#5CFF8A", "#2ACB5A"], rainbow: ["#FF5A7A", "#FFD23A", "#5CF2C9", "#5AA8FF", "#B88CFF"], solar: ["#FFE9A8", "#FFD23A"] };
    const cs = col[kind] ?? ["#ffffff"], tmp = new THREE.Color();
    for (let i = 0; i < 700; i++) {
      P.setXYZ(i, c.x + (Math.random() - 0.5) * 60, c.y + (Math.random() - 0.5) * 24, c.z + (Math.random() - 0.5) * 60);
      tmp.set(cs[i % cs.length]); C.setXYZ(i, tmp.r, tmp.g, tmp.b);
      const r = Math.random();
      if (kind === "rain") V.set([0, -38 - r * 10, 0], i * 3);
      else if (kind === "snow") V.set([(r - 0.5) * 2, -3 - r * 2, (Math.random() - 0.5) * 2], i * 3);
      else if (kind === "sandstorm") V.set([14 + r * 8, (Math.random() - 0.5) * 2, 4], i * 3);
      else if (kind === "smoke") V.set([(r - 0.5) * 2, 1 + r, (Math.random() - 0.5) * 2], i * 3);
      else if (kind === "code") V.set([0, -9 - r * 8, 0], i * 3);
      else V.set([(r - 0.5) * 3, -1.5 - r * 2, (Math.random() - 0.5) * 3], i * 3);
    }
    P.needsUpdate = true; C.needsUpdate = true;
    const m = this.wx.material as THREE.PointsMaterial;
    m.size = kind === "rain" ? 0.2 : kind === "smoke" ? 3.2 : kind === "sandstorm" ? 0.5 : kind === "code" ? 0.25 : 0.35;
    m.opacity = kind === "smoke" ? 0.35 : kind === "rain" ? 0.85 : 0.9;
  }

  /** the drone reveal flies from the far end of the course back to the grid */
  private introS() { const k = Math.min(1, this.shotT / 3.2), e = 1 - Math.pow(1 - k, 3); return (this.st!.finish * 0.55) * (1 - e) + 0 * e; }

  private cameraStep(dt: number) {
    const tr = this.tr!, sim = this.sim!, me = sim.marbles[0];
    const F = tr.frame(Math.max(0, me.s), this.F);
    const fwd = new THREE.Vector3(F[3], F[4], F[5]), up = new THREE.Vector3(F[6], F[7], F[8]);
    const ball = this.wp(me.s, me.u * 0.6, me.h + me.r);
    let pos: THREE.Vector3, look: THREE.Vector3, k = 7;
    const portrait = this.portrait;
    if (this.shot === "showroom") {
      const a = this.time * 0.25, R = 6.5;
      pos = ball.clone().add(new THREE.Vector3(Math.sin(a) * R, 2.2 + Math.sin(this.time * 0.4) * 0.5, Math.cos(a) * R));
      look = ball.clone().add(new THREE.Vector3(0, 0.4, 0)); k = 3;
    } else if (this.shot === "intro") {
      const s = this.introS(), G = tr.frame(s, new Float32Array(12));
      const g = new THREE.Vector3(G[0], G[1], G[2]), gf = new THREE.Vector3(G[3], G[4], G[5]);
      const kk = Math.min(1, this.shotT / 3.2);
      pos = g.clone().addScaledVector(gf, 30 * (1 - kk) - 8 * kk).add(new THREE.Vector3(0, 40 * (1 - kk) + 4 * kk, 0));
      look = g.clone().addScaledVector(gf, -12 * (1 - kk) + 8 * kk);
      k = 12;
    } else if (this.shot === "finish") {
      const a = this.shotT * 0.4 + 0.6, R = 7;
      pos = ball.clone().add(new THREE.Vector3(Math.sin(a) * R, 2.6, Math.cos(a) * R)); look = ball.clone(); k = 4;
    } else {
      // chase: behind and above, looking down the road; held still while Orbi falls away
      // high behind the marble, looking down the road (the road fills the screen, the sky a little of it)
      const fast = Math.min(1, Math.max(0, (me.vs - 30) / 60));
      const dist = (portrait ? 7.6 : 6.8) + fast * 2.2, height = (portrait ? 5.4 : 4.4) - fast * 0.9;
      const road = this.wp(me.s, me.u * 0.6, Math.max(0, Math.min(me.h, 3)));
      const side = new THREE.Vector3(F[9], F[10], F[11]), v = this.view;
      if (me.fallT > 0) { pos = this.camPos.clone(); look = ball; k = 4; }
      else if (v === "side") { pos = road.clone().addScaledVector(side, 11).addScaledVector(up, 3).addScaledVector(fwd, 2); look = road.clone().addScaledVector(fwd, 4); k = 4; }
      else if (v === "top") { pos = road.clone().addScaledVector(up, 18).addScaledVector(fwd, -3); look = road.clone().addScaledVector(fwd, 5); k = 4; }
      else if (v === "low") { pos = road.clone().addScaledVector(fwd, -2.6).addScaledVector(up, 1.1); look = road.clone().addScaledVector(fwd, 12).addScaledVector(up, 0.8); k = 10; }
      else if (v === "far") { pos = road.clone().addScaledVector(fwd, -18).addScaledVector(up, 12); look = road.clone().addScaledVector(fwd, 14); k = 3; }
      else if (v === "front") { pos = road.clone().addScaledVector(fwd, 9).addScaledVector(up, 3.2); look = road.clone().addScaledVector(fwd, -6); k = 6; }
      else { pos = road.clone().addScaledVector(fwd, -dist).addScaledVector(up, height); look = road.clone().addScaledVector(fwd, portrait ? 9 : 10).addScaledVector(up, -0.4); }
    }
    if (this.camFirst) { this.camPos.copy(pos); this.camLook.copy(look); this.camFirst = false; }
    const a = 1 - Math.exp(-k * dt), b = 1 - Math.exp(-(k + 3) * dt);
    this.camPos.lerp(pos, a); this.camLook.lerp(look, b);
    // through loops and corkscrews the camera rolls with the road; elsewhere it keeps the horizon mostly level
    const keep = this.shot === "chase" ? Math.max(0, Math.min(0.7, (up.y - 0.35) * 1.4)) : 0.7;
    const want = up.clone().lerp(new THREE.Vector3(0, 1, 0), keep).normalize();
    if (this.view === "tilt") want.applyAxisAngle(fwd, 0.32);
    this.camUp.lerp(want, 1 - Math.exp(-(keep < 0.5 ? 8 : 3) * dt)).normalize();
    this.camera.position.copy(this.camPos); this.camera.up.copy(this.camUp); this.camera.lookAt(this.camLook);
    const boost = me.boostT > 0 || (me.active.turbo ?? 0) > 0;
    const fovT = (portrait ? 70 : 60) + (boost ? 6 : 0) + Math.min(22, Math.max(0, me.vs - 30) * 0.33) + (this.view === "fisheye" ? 34 : 0) + (this.view === "low" ? 8 : 0);
    this.fov += (fovT - this.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.05) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }

  capture(q = 0.9) { this.renderer.render(this.scene, this.camera); return this.cv.toDataURL("image/jpeg", q); }
  dispose() {
    this.clearStage(); this.env?.dispose();
    this.trailGeo.dispose(); (this.trail.material as THREE.Material).dispose(); this.sparkGeo.dispose(); (this.sparkPts.material as THREE.Material).dispose();
    this.wxGeo.dispose(); (this.wx.material as THREE.Material).dispose();
    this.renderer.dispose(); this.cv.remove();
  }
}
