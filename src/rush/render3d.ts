// Rollo Rush renderer: the world (sky, sea, scenery), the track streamed in chunks ahead of Rollo, the objects on it
// (pearls drawn as one instanced batch), Rollo with his warm light, speed effects, the boss, and the cinematic camera.
// Built for phones: static scenery is merged per material, pearls are instanced, bloom only on strong devices.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { worldOf } from "./data/worlds";
import type { Ev, Sim } from "./sim";
import { CineCam } from "./three/camera";
import { Env } from "./three/env";
import { Fx } from "./three/fx";
import { mergeStatic } from "./three/merge";
import { ObjectArt, type View } from "./three/objects";
import { CHINTU, Rollo, type RolloLook } from "./three/rollo";
import { Witch } from "./three/witch";
import { elementOf } from "./magicdata";
import type { StoryFrame } from "./story/intro";
import { glow } from "./three/tex";
import { CHUNK, TrackMeshes, type Chunk } from "./three/trackMesh";
import type { Track } from "./track";
import type { Obj, Stage } from "./types";
import { antialiasFor, autoQuality as sharedAutoQuality, FrameGovernor, pixelRatioFor } from "@/lib/perf";

export type Quality = "low" | "medium" | "high";
export function autoQuality(): Quality { return sharedAutoQuality(); }

/** all pearls in view: one instanced mesh + one glow point cloud */
class PearlField {
  readonly mesh: THREE.InstancedMesh;
  readonly glows: THREE.Points;
  private ids: Obj[] = [];
  private ob = new THREE.Object3D();
  constructor(cap = 700) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.27, 2), new THREE.MeshStandardMaterial({ color: "#FFE29A", emissive: "#FFB840", emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.55 }), cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    this.glows = new THREE.Points(g, new THREE.PointsMaterial({ map: glow("#FFD27A"), size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#FFE6A0" }));
    this.glows.frustumCulled = false;
  }
  update(list: Obj[], owners: { tr: Track; sim: Sim }[], t: number) {
    const P = [0, 0, 0];
    const pos = this.glows.geometry.attributes.position as THREE.BufferAttribute;
    let n = 0;
    for (let k = 0; k < list.length; k++) {
      const o = list[k], { tr, sim } = owners[k];
      if (n >= this.mesh.instanceMatrix.count) break;
      const bob = Math.sin(t * 3 + o.s * 0.4) * 0.12;
      tr.point(o.s, sim.uOf(o), o.h + bob, P);
      this.ob.position.set(P[0], P[1], P[2]);
      this.ob.scale.setScalar(o.k === "bigPearl" ? 1.6 : 1);
      this.ob.rotation.y = t * 2 + o.s;
      this.ob.updateMatrix();
      this.mesh.setMatrixAt(n, this.ob.matrix);
      pos.setXYZ(n, P[0], P[1], P[2]);
      n++;
    }
    for (let i = n; i < pos.count; i++) pos.setXYZ(i, 0, -1e5, 0);
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; pos.needsUpdate = true;
    this.ids = list;
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.glows.geometry.dispose(); (this.glows.material as THREE.Material).dispose(); }
}

/** one stage's road and the things on it. The run never stops: the next stage's layer is drawn joined to the end of
 * this one before Rollo gets there, and the stage behind stays drawn until it is out of reach */
interface Layer {
  st: Stage; tr: Track; sim: Sim; meshes: TrackMeshes; art: ObjectArt;
  chunks: Map<number, Chunk>; views: Map<number, View>;
  /** Rollo's distance along this layer's track = r.s + off */
  off: number;
}

/** what chases you: a boulder, a wave, a tornado, an avalanche, rising lava, a giant Clanker, Kranky's shadow… */
function chaserArt(kind: string) {
  const g = new THREE.Group();
  const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  if (kind === "boulder" || kind === "giant" || kind === "tower" || kind === "fortress") {
    const spin = new THREE.Group(); spin.position.y = 4; g.add(spin); g.userData.spin = spin;
    spin.add(new THREE.Mesh(new THREE.DodecahedronGeometry(4, 1), M(kind === "giant" ? "#7C8899" : "#8A7A6A", { flatShading: true, metalness: kind === "giant" ? 0.6 : 0 })));
  } else if (kind === "tornado") {
    const m = new THREE.Mesh(new THREE.ConeGeometry(6, 16, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#C8D2E0", transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = Math.PI; m.position.y = 8; g.add(m); g.userData.spin = m;
  } else {
    // a wall coming after you: wave, tide, flood, avalanche, lava, shadow, cliff, airship debris
    const col = { wave: "#3AA0E8", tide: "#3AA0E8", flood: "#4A9AD8", avalanche: "#F4FAFF", lava: "#FF5A1A", shadow: "#140A20", cliff: "#8A6A5A", airship: "#E8504F", fall: "#8A5A36" }[kind] ?? "#7FD8FF";
    const m = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 3), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: kind === "shadow" ? 0.7 : 0.85, emissive: kind === "lava" ? col : "#000000", emissiveIntensity: kind === "lava" ? 0.9 : 0 }));
    m.position.y = 3.5; g.add(m);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 18, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: kind === "lava" ? "#FFB040" : "#FFFFFF", transparent: true, opacity: 0.8 }));
    crest.position.set(0, 7, -1); g.add(crest);
  }
  return g;
}
/** a rival runner: your ghost, a racing Clanker or a train */
function rivalArt(kind: string) {
  const g = new THREE.Group();
  if (kind === "train") { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), new THREE.MeshStandardMaterial({ color: "#E8504F", metalness: 0.4, roughness: 0.4 })); b.position.y = 1.4; g.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.4, 10), new THREE.MeshStandardMaterial({ color: "#2B2B33" })); c.position.set(0, 3.2, -2); g.add(c); return g; }
  const ghost = kind === "ghost";
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), new THREE.MeshStandardMaterial({ color: ghost ? "#BFE8FF" : "#FF5A7A", transparent: ghost, opacity: ghost ? 0.5 : 1, emissive: ghost ? "#7FD8FF" : "#000000", emissiveIntensity: ghost ? 0.6 : 0, metalness: ghost ? 0 : 0.5 }));
  body.position.y = 0.9; body.scale.set(1, 1.2, 1); g.add(body);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: "#FFFFFF" })); e.position.set(sx * 0.2, 1.15, -0.5); g.add(e); }
  return g;
}
/** a view leaves the scene (long things own their geometry) */
function dropView(v: View) { v.root.removeFromParent(); for (const g of (v.root.userData.geos as THREE.BufferGeometry[] | undefined) ?? []) g.dispose(); }

export interface FrameIn { sim: Sim; events: Ev[]; dt: number; paused: boolean; portrait: boolean }

export class RushRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2400);
  readonly cv: HTMLCanvasElement;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private env: Env | null = null;
  /** the next world (a world change): swapped in right at the join, behind a flash of light */
  private envNext: Env | null = null;
  private fx: Fx | null = null;
  rollo = new Rollo();
  /** Rollo's Locker: trail and Curl Ball colours */
  private kit = { trail: "#3FE8C0", ball: "#2FD6B0" };
  /** the Time Trial ghost: a see-through Rollo running your best run (samples: s x10, u x100, h x100, ten a second) */
  private ghost: Rollo | null = null;
  private ghostPath: number[] | null = null;
  private rolloLight: THREE.PointLight;
  private shadow: THREE.Mesh;
  private cine: CineCam | null = null;
  private cur: Layer | null = null;
  private next: Layer | null = null;
  private old: Layer[] = [];
  private pearls = new PearlField();
  private boss: { root: THREE.Group; parts: Record<string, THREE.Object3D>; kind: string } | null = null;
  private worldKey = "";
  private time = 0;
  private hitFlash = 0;
  private flash = 0;
  private flashEl: HTMLDivElement;
  private barsEl: HTMLDivElement[] = [];
  // ---- the story
  /** the cinematic drives the actors and the camera while this is set */
  story: StoryFrame | null = null;
  private witch: Witch | null = null;
  private chintu: Rollo | null = null;
  private pearlBall: THREE.Mesh | null = null;
  /** Mayamma in play: on her stretch, entering, casting, leaving */
  private hag = { on: false, t: 0, enter: 0, out: -1, cast: 0, s: 0, u: 0, h: 0, mark: null as Obj | null };
  /** her magic leaves her hand / lands; she arrives / leaves (the session plays the sounds) */
  onMagic?: (what: "cast" | "land", el: string, pan: number) => void;
  onWitch?: (what: "enter" | "exit") => void;
  /** the stage's view twists (dark, fog, rain, snow, mirror, dream, lightning, light show, day to night) */
  private view: NonNullable<Stage["view"]> = {};
  private bolt = 0; private boltT = 2;
  private weather: THREE.LineSegments | null = null;
  private chaser: { kind: string; root: THREE.Group } | null = null;
  private rival: { kind: string; root: THREE.Group } | null = null;
  private w = 1; private h = 1;

  private gov: FrameGovernor;
  constructor(host: HTMLElement, readonly quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    // a phone that can't keep up gets a lower resolution, step by step (and back up when there is room)
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(pixelRatioFor(quality) * k); this.renderer.setSize(this.w, this.h, false); });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.cv = this.renderer.domElement;
    this.cv.style.display = "block"; this.cv.style.width = "100%"; this.cv.style.height = "100%"; this.cv.style.touchAction = "none";
    host.appendChild(this.cv);
    // a warm flash of light when the world changes under you
    this.flashEl = document.createElement("div");
    this.flashEl.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 55%,#FFFFFF 0%,#FFF6DC 55%,#FFE2B0 100%)";
    host.appendChild(this.flashEl);
    // cinema bars for the story
    for (const top of [true, false]) { const b = document.createElement("div"); b.style.cssText = `position:absolute;left:0;right:0;${top ? "top" : "bottom"}:0;height:0;background:#000;pointer-events:none;transition:none`; host.appendChild(b); this.barsEl.push(b); }
    this.scene.add(this.camera);
    // a soft key light from the camera so Rollo and the Clankers always read clearly
    const key = new THREE.DirectionalLight("#FFF4E6", 0.9); key.position.set(0.4, 0.8, 0.2); key.target.position.set(0, 0, -6); this.camera.add(key, key.target);
    this.rolloLight = new THREE.PointLight("#FFC46B", 0, 11, 1.6);
    this.scene.add(this.rollo.root, this.rolloLight, this.pearls.mesh, this.pearls.glows);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshBasicMaterial({ map: glow("#000000"), transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.shadow);
    if (quality === "high") {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(this.w, this.h);
  }

  private get tr() { return this.cur?.tr ?? null; }

  /** start fresh on a stage (the first of a run, or a resume): everything is rebuilt round it */
  setStage(st: Stage, tr: Track, sim: Sim) {
    for (const L of [...this.old, this.cur, this.next]) if (L) this.dropLayer(L);
    this.old = []; this.cur = this.next = null;
    if (this.envNext) { this.envNext.dispose(); this.envNext = null; }
    this.dropBoss();
    const W = worldOf(st.look.world);
    if (String(st.look.world) !== this.worldKey || !this.env) this.useEnv(new Env(W, tr, st.look.seed, this.quality), st.look.world);
    else this.env.resetScenery(tr);
    this.cur = this.layer(st, tr, sim, 0, this.env!.look, W.scenery !== "meadow");
    if (!this.fx) { this.fx = new Fx(this.camera, this.env!.look.night); this.fx.setTrail(this.kit.trail, this.kit.ball); this.scene.add(this.fx.group); } else this.fx.reset();
    if (this.cine) this.cine.setTrack(tr); else this.cine = new CineCam(this.camera, tr);
    this.cine.play("intro");
    this.flash = 0;
    this.makeBoss();
    this.applyView();
  }
  /** the next stage, joined on at `join` (this stage's goal): drawn ahead, so there is never an end to the road */
  setNext(st: Stage, tr: Track, sim: Sim, join: number) {
    const cur = this.cur; if (!cur || !this.env) return;
    if (this.next) { this.dropLayer(this.next); this.next = null; }
    if (this.envNext) { this.envNext.dispose(); this.envNext = null; }
    const W = worldOf(st.look.world);
    let look = this.env.look;
    if (String(st.look.world) !== this.worldKey) {
      // a new world: built now, swapped in at the join; the scenery here keeps out of the new road meanwhile
      this.envNext = new Env(W, tr, st.look.seed, this.quality); look = this.envNext.look;
      this.env.avoidTrack(tr);
    } else this.env.addScenery(tr);
    // this stage's road now stops at the join (rebuild the piece that crosses it straight away, so nothing flickers)
    cur.meshes.end = join;
    for (const [i, c] of [...cur.chunks]) if ((i + 1) * CHUNK > join) { cur.meshes.disposeChunk(c); cur.chunks.delete(i); if (i * CHUNK < join) this.addChunk(cur, i); }
    this.next = this.layer(st, tr, sim, -join, look, W.scenery !== "meadow");
  }
  /** Rollo crossed the join: the next stage is now the one being played (nothing on screen changes) */
  advance() {
    const cur = this.cur, nx = this.next; if (!cur || !nx) return;
    cur.off = -nx.off; nx.off = 0;
    this.old.push(cur); this.cur = nx; this.next = null;
    while (this.old.length > 2) this.dropLayer(this.old.shift()!);
    this.dropBoss();
    if (this.envNext) { this.useEnv(this.envNext, nx.st.look.world); this.envNext = null; this.flash = 1; }
    this.cine?.setTrack(nx.tr, true);
    this.makeBoss();
    this.applyView();
  }
  playShot(s: "intro" | "goal" | "respawn" | "chase") { this.cine?.play(s); }

  private useEnv(env: Env, world: number) {
    if (this.env) { this.env.group.removeFromParent(); this.env.dispose(); }
    this.env = env; this.worldKey = String(world);
    this.scene.add(env.group);
    const L = env.look;
    this.scene.fog = new THREE.Fog(L.fog, L.night ? 140 : 180, L.night ? 900 : 1100);
    this.scene.background = new THREE.Color(L.sky[1]);
    this.rolloLight.intensity = L.night ? 4 : 1.5;
  }
  private layer(st: Stage, tr: Track, sim: Sim, off: number, look: Env["look"], coast: boolean): Layer {
    return { st, tr, sim, off, meshes: new TrackMeshes(tr, look, coast, this.quality, worldOf(st.look.world).scenery), art: new ObjectArt(tr, look.night), chunks: new Map(), views: new Map() };
  }
  private addChunk(L: Layer, i: number) {
    const c = L.meshes.build(i);
    c.merged = mergeStatic(c.group);
    this.scene.add(c.group); L.chunks.set(i, c);
  }
  private dropLayer(L: Layer) {
    for (const c of L.chunks.values()) L.meshes.disposeChunk(c);
    L.chunks.clear();
    for (const v of L.views.values()) dropView(v);
    L.views.clear();
    L.meshes.dispose(); L.art.dispose();
  }
  // ---------------------------------------------------------------- the story
  /** start (or end) the cinematic: Chintu, the glowing pearl and Mayamma join the scene */
  storyMode(on: boolean) {
    if (on) {
      this.chintu ??= new Rollo(CHINTU); this.scene.add(this.chintu.root);
      if (!this.pearlBall) { this.pearlBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), new THREE.MeshStandardMaterial({ color: "#FFE29A", emissive: "#FFB840", emissiveIntensity: 1.4 })); this.pearlBall.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("#FFD27A"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); (this.pearlBall.children[0] as THREE.Sprite).scale.setScalar(1.4); }
      this.scene.add(this.pearlBall);
      this.witchOn();
    } else {
      this.story = null;
      this.chintu?.root.removeFromParent(); this.pearlBall?.removeFromParent();
      if (!this.hag.on) this.witch?.root.removeFromParent();
      for (const b of this.barsEl) b.style.height = "0";
      this.renderer.toneMappingExposure = this.view.dark ? 0.85 : 1.2;
      // hand the camera to the chase without a jump
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look); look.multiplyScalar(10).add(this.camera.position);
      this.cine?.adopt(this.camera.position, look, this.camera.fov);
    }
  }
  /** dress Rollo from his Locker (armour, scarf, shoes, Curl Ball) and colour his trails */
  setLook(look: Partial<RolloLook>, trail = "#3FE8C0", ball = "#2FD6B0") {
    const old = this.rollo, parent = old.root.parent;
    this.rollo = new Rollo({ ...look, ball: look.ball ?? ball });
    this.rollo.root.position.copy(old.root.position); this.rollo.root.quaternion.copy(old.root.quaternion);
    if (parent) { parent.remove(old.root); parent.add(this.rollo.root); }
    old.dispose();
    this.kit = { trail, ball }; this.fx?.setTrail(trail, ball);
  }
  /** race a ghost (null: no ghost) */
  setGhost(p: number[] | null) {
    this.ghostPath = p && p.length >= 6 ? p : null;
    if (this.ghostPath && !this.ghost) {
      this.ghost = new Rollo({ gold: "#CFEFFF", goldDk: "#7FB8E8", peach: "#E8F6FF", coral: "#9FE0FF", indigo: "#7FB8E8", mint: "#BFF4FF", mintDk: "#7FD0F0" });
      this.ghost.root.traverse((o) => {
        const me = o as THREE.Mesh; if (!me.isMesh) return;
        const m = (me.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
        m.transparent = true; m.opacity = 0.55; m.depthWrite = false;
        if (m.emissive) { m.emissive.set("#3FB8FF"); m.emissiveIntensity = 0.75; }
        if (m.color) m.color.lerp(new THREE.Color("#BFEFFF"), 0.5);
        me.material = m;
      });
      // a cold glow round him, so he reads from far down the track
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("#7FD8FF"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
      halo.scale.set(1.8, 2.4, 1); halo.position.y = 0.9; this.ghost.root.add(halo);
    }
    if (this.ghost) { if (this.ghostPath) this.scene.add(this.ghost.root); else this.ghost.root.removeFromParent(); }
  }
  private ghostFrame(time: number, run: number, dt: number) {
    const P = this.ghostPath, g = this.ghost, tr = this.tr;
    if (!P || !g || !tr) return;
    const n = P.length / 3, x = time * 10, i = Math.max(0, Math.min(n - 2, Math.floor(x))), k = Math.max(0, Math.min(1, x - i));
    const at = (j: number) => P[i * 3 + j] + (P[(i + 1) * 3 + j] - P[i * 3 + j]) * k;
    const s = at(0) / 10, u = at(1) / 100, h = at(2) / 100;
    g.root.visible = !this.story && x < n + 20;
    const fr = tr.frame(s, new Float32Array(12)), pos = this.wp(s, u, h);
    g.root.position.copy(pos); g.root.up.set(fr[6], fr[7], fr[8]); g.root.lookAt(pos.x - fr[3], pos.y - fr[4], pos.z - fr[5]);
    g.update({ v: x < n ? run : 0, vu: 0, air: h > 0.25, vh: 0, ball: false, hit: false, blink: false, run: 0, dt, idle: x >= n });
  }
  /** she is speaking for this long (her jaw moves) */
  witchTalk(seconds: number) { this.witch?.talk(seconds); }
  private witchOn() { this.witch ??= new Witch(); if (!this.witch.root.parent) this.scene.add(this.witch.root); return this.witch; }
  private P3 = [0, 0, 0];
  private tp(s: number, u: number, h: number) { this.tr!.point(s, u, h, this.P3); return new THREE.Vector3(this.P3[0], this.P3[1], this.P3[2]); }
  private storyCast(S: StoryFrame | null, dt: number) {
    if (!S) return;
    const t = this.time;
    if (this.chintu) {
      const c = S.chintu;
      this.chintu.root.visible = !!c;
      if (c && this.witch && c.carried) {
        this.witch.root.updateMatrixWorld(true);
        const g = this.witch.grip.getWorldPosition(new THREE.Vector3());
        this.chintu.root.position.copy(g).add(new THREE.Vector3(0, -0.95, 0));
        this.chintu.root.up.set(0, 1, 0); this.chintu.root.rotation.set(0, this.witch.root.rotation.y, Math.sin(t * 6) * 0.25);
        this.chintu.update({ v: 0, vu: 0, air: true, vh: -1, ball: false, hit: false, blink: false, run: 0, dt, reach: 1 });
      } else if (c) {
        const p = this.tp(c.s, c.u, c.h), f = this.tr!.frame(c.s, new Float32Array(12));
        this.chintu.root.position.copy(p); this.chintu.root.up.set(f[6], f[7], f[8]);
        this.chintu.root.lookAt(p.x + f[3] * c.face * -1 * -1, p.y, p.z + f[5] * c.face * -1 * -1);
        if (c.face < 0) this.chintu.root.lookAt(p.x + f[3], p.y + f[4], p.z + f[5]);
        this.chintu.update({ v: 0, vu: 0, air: false, vh: 0, ball: false, hit: false, blink: false, run: 0, dt, idle: true, toss: c.toss });
      }
    }
    if (this.pearlBall) { this.pearlBall.visible = !!S.ball; if (S.ball) this.pearlBall.position.copy(this.tp(S.ball[0], S.ball[1], S.ball[2])); }
    const w = S.witch;
    if (this.witch) {
      this.witch.root.visible = !!w;
      if (w) {
        this.witch.root.scale.setScalar(1); this.witch.root.position.copy(this.tp(w.s, w.u, w.h));
        const look = this.tp(S.rollo.s, 0, 1); this.witch.root.lookAt(look.x, this.witch.root.position.y, look.z); this.witch.root.rotateY(Math.PI);
        if (w.laugh) this.witch.talk(0.1);
        this.witch.update({ dt, t, cast: w.cast, laugh: w.laugh, carry: w.carry, lean: w.lean });
      }
    }
  }
  private storyCamera(S: StoryFrame) {
    const c = S.cam, p = this.tp(c.pos[0], c.pos[1], c.pos[2]), l = this.tp(c.look[0], c.look[1], c.look[2]);
    this.camera.position.copy(p); this.camera.up.set(0, 1, 0); this.camera.lookAt(l);
    if (c.roll) this.camera.rotateZ(c.roll);
    if (Math.abs(this.camera.fov - c.fov) > 0.01) { this.camera.fov = c.fov; this.camera.updateProjectionMatrix(); }
  }
  /** Mayamma during play: swoops in from behind at the start of her stretch, hovers ahead casting, flies off at the end */
  private hagFrame(s: number, v: number, dt: number) {
    const H = this.hag, cur = this.cur!;
    let mark: Obj | null = null;
    for (const o of cur.st.objs) { if (o.k !== "witch") continue; if (s >= o.s - (o.ds ?? 50) - 20 && s <= o.s + (o.ds ?? 50) + 6) { mark = o; break; } }
    if (mark && !H.on) { H.on = true; H.t = 0; H.out = -1; H.mark = mark; this.witchOn(); this.flash = Math.max(this.flash, 0.7); this.onWitch?.("enter"); }
    if (!mark && H.on && H.out < 0) { H.out = 0; this.onWitch?.("exit"); }
    if (!H.on || !this.witch) return;
    H.t += dt; H.cast = Math.max(0, H.cast - dt * 2.5);
    const t = this.time;
    // where she wants to be: ahead and above, drifting from side to side
    const ahead = 15 + Math.sin(t * 0.5) * 3, tu = Math.sin(t * 0.7) * 2.4, th = 4.4 + Math.sin(t * 1.3) * 0.5;
    if (H.t < 2.4) {
      // the scare: she plunges out of the sky right in front of him, laughs in his face, then rises away ahead
      const drop = Math.min(1, H.t / 0.42), de = 1 - (1 - drop) ** 3;
      const rise = Math.max(0, Math.min(1, (H.t - 1.4) / 1.0)), re = rise * rise * (3 - 2 * rise);
      const near = 6.2 + Math.sin(t * 2.2) * 0.25;
      H.s = s + near + (ahead - near) * re; H.u = tu * re; H.h = (16 - 13.4 * de + Math.sin(t * 3) * 0.12) * (1 - re) + th * re;
    }
    else if (H.out >= 0) { H.out += dt; H.s += (v + 30) * dt; H.h += dt * 9; H.u += dt * 3; if (H.out > 2.6) { H.on = false; H.mark = null; this.witch.root.removeFromParent(); return; } }
    else { H.s = s + ahead; H.u += (tu - H.u) * Math.min(1, dt * 2); H.h += (th - H.h) * Math.min(1, dt * 2); }
    this.witch.root.visible = true; this.witch.root.scale.setScalar(1.3);
    this.witch.root.position.copy(this.tp(H.s, H.u, H.h));
    const look = this.tp(s, 0, 1); this.witch.root.lookAt(look.x, this.witch.root.position.y, look.z); this.witch.root.rotateY(Math.PI);
    this.witch.update({ dt, t, cast: H.cast, laugh: H.t < 1.8 || H.out >= 0, lean: H.out >= 0 ? 0.6 : 0.2 });
  }
  /** a magic in flight: from her hand (when she is here) along an arc to where it lands */
  private fly(v: View, o: Obj, s: number, u: number, rs: number) {
    const d = o.s - rs, land = o.land ?? 0, k = Math.max(0, Math.min(1, (d - land) / (o.drop ?? 20)));
    const ud = v.root.userData as { cast?: boolean; landed?: boolean };
    const el = elementOf((o.look ?? "").split(":")[1] ?? "fire").id;
    const mid = (o.look ?? "").slice(3);
    if (k < 1 && !ud.cast) { ud.cast = true; this.hag.cast = 1; this.onMagic?.("cast", mid, Math.max(-1, Math.min(1, u / 4))); }
    if (k <= 0 && !ud.landed) { ud.landed = true; this.fx?.burst(this.tp(s, u, 0.6), el === "ice" || el === "star" || el === "light" ? "spark" : el === "water" || el === "poison" ? "spray" : "dust", 22); this.cine?.kick(0.25); this.onMagic?.("land", mid, Math.max(-1, Math.min(1, u / 4))); }
    if (!this.hag.on || !this.witch || k <= 0) return;
    if (k >= 1) { v.root.visible = false; return; }
    v.root.visible = true;
    const palm = this.witch.palm.getWorldPosition(new THREE.Vector3()), ground = this.tp(s, u, o.h);
    v.root.position.copy(ground.lerp(palm, k)).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * 3, 0));
  }

  /** the stage's view twists, its chaser and its rival */
  private applyView() {
    const L = this.cur; if (!L || !this.env) return;
    const v = (this.view = L.st.view ?? {});
    const E = this.env.look;
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) { fog.near = v.dark ? 12 : v.fog ? 30 : E.night ? 140 : 180; fog.far = v.dark ? 110 : v.fog ? 220 : E.night ? 900 : 1100; fog.color.set(v.dark ? "#05060F" : E.fog); }
    this.renderer.toneMappingExposure = v.dark ? 0.85 : 1.2;
    // bloom is for glows in the dark: on a pale day sky almost everything is past the old threshold and the whole
    // screen went milky white (candy, sky islands, blossom). By day only the really bright things glow.
    if (this.bloom) { const day = !E.night && !v.dark; this.bloom.threshold = day ? 0.95 : 0.82; this.bloom.strength = day ? 0.38 : 0.55; }
    this.rolloLight.intensity = v.dark ? 7 : E.night ? 4 : 1.5; this.rolloLight.distance = v.dark ? 22 : 11;
    this.cv.style.transform = v.mirror ? "scaleX(-1)" : "";
    this.cv.style.filter = v.dream ? "saturate(1.35) brightness(1.06) hue-rotate(-12deg)" : v.underwater ? "hue-rotate(12deg) saturate(1.2)" : "";
    // rain or snow round the camera
    if (this.weather) { this.weather.removeFromParent(); this.weather.geometry.dispose(); (this.weather.material as THREE.Material).dispose(); this.weather = null; }
    if (v.rain || v.snow) {
      const n = this.quality === "low" ? 400 : 900, p = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60, len = v.snow ? 0.12 : 1.1; p.set([x, y, z, x + (v.snow ? 0.05 : 0.1), y - len, z], i * 6); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      this.weather = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: v.snow ? "#FFFFFF" : "#BFD8F0", transparent: true, opacity: v.snow ? 0.9 : 0.45 }));
      this.weather.frustumCulled = false; this.scene.add(this.weather);
    }
    // the chaser and the rival
    for (const x of [this.chaser, this.rival]) x?.root.removeFromParent();
    this.chaser = L.st.chase ? { kind: L.st.chase.kind, root: chaserArt(L.st.chase.kind) } : null;
    this.rival = L.st.rival ? { kind: L.st.rival.kind, root: rivalArt(L.st.rival.kind) } : null;
    if (this.chaser) this.scene.add(this.chaser.root);
    if (this.rival) this.scene.add(this.rival.root);
  }
  private makeBoss() {
    const L = this.cur; if (!L?.st.boss) return;
    const kind = L.st.boss.kind;
    const b = L.art.boss(kind); this.boss = { ...b, kind }; this.scene.add(b.root); b.root.visible = false;
  }
  private dropBoss() { if (this.boss) { this.boss.root.removeFromParent(); this.boss = null; } }

  /** the world position of a track point (for effects) */
  wp(s: number, u: number, h: number) { const P = [0, 0, 0]; this.tr!.point(s, u, h, P); return new THREE.Vector3(P[0], P[1], P[2]); }

  frame(f: FrameIn) {
    const sim = f.sim, cur = this.cur;
    if (!cur || !this.env || !this.fx || !this.cine) return;
    const tr = cur.tr, st = cur.st;
    const dt = f.paused ? 0 : f.dt;
    this.time += dt;
    const r = sim.r;
    // ---- every layer in reach: the stage behind, this one, the next one
    // how far ahead the road and the things on it are built (phones draw less)
    const reach = this.quality === "low" ? 260 : this.quality === "medium" ? 360 : 420, see = this.quality === "low" ? 180 : this.quality === "medium" ? 240 : 300;
    let budget = 2;
    const pearls: Obj[] = [], owners: Layer[] = [];
    for (const L of [...this.old, cur, ...(this.next ? [this.next] : [])]) {
      const s = r.s + L.off;
      // road chunks
      const lim = Math.min(L.tr.len + 160, L.meshes.end);
      const c0 = Math.max(0, Math.floor((s - 50) / CHUNK)), c1 = Math.floor((s + reach) / CHUNK);
      for (const [i, c] of L.chunks) if (i < c0 || i > c1) { L.meshes.disposeChunk(c); L.chunks.delete(i); }
      for (let i = c0; i <= c1 && budget > 0; i++) { if (L.chunks.has(i) || i * CHUNK >= lim) continue; this.addChunk(L, i); budget--; }
      // things on it
      const ahead = s + see, behind = s - 25, ls = L.sim;
      const seen = new Set<number>();
      const consider = (o: Obj) => {
        if (o.gone || o.s < behind || o.s > ahead || o.k === "goal") return; // no finish arch: the run just carries on
        // small pickups only come into view when they are near
        if ((o.k === "item" || o.k === "power" || o.k === "medal") && o.s > s + 120) return;
        if (this.story) return; // the cinematic plays on a clear beach
        if (o.k === "pearl" || o.k === "bigPearl") { pearls.push(o); owners.push(L); return; }
        seen.add(o.id);
        let v = L.views.get(o.id);
        if (!v) { const made = L.art.make(o); if (!made) return; v = made; L.views.set(o.id, v); this.scene.add(v.root); }
        const u = ls.uOf(o), h = ls.hOf(o);
        // long things (rails, painted zones, dividers) are built in place; the rest follow the track
        if (!v.root.userData.world) L.art.place(v.root, ls.sOf(o), u, h);
        if (o.look?.startsWith("mg:") && L === this.cur) {
          if (o.drop) this.fly(v, o, ls.sOf(o), u, r.s);
          else if (!v.root.userData.cast && o.s - r.s < 42 && this.hag.on) { v.root.userData.cast = true; this.hag.cast = 1; this.onMagic?.("cast", o.look.slice(3), Math.max(-1, Math.min(1, u / 4))); }
        }
        L.art.animate(v, dt, this.time, u, h, ls.on(o));
      };
      for (const o of L.st.objs) { if (o.s > ahead) break; consider(o); }
      for (const o of ls.dyn) consider(o);
      for (const [id, v] of L.views) if (!seen.has(id)) { dropView(v); L.views.delete(id); }
      L.meshes.frame(dt, this.time, L.chunks.values());
      L.art.frame(dt);
    }
    // the stage behind goes once nothing of it is in reach (and its scenery once it is well behind)
    this.old = this.old.filter((L) => { if (L.chunks.size || L.views.size) return true; this.dropLayer(L); return false; });
    if (r.s > 260) this.env.dropBefore(tr);
    this.env.cullFar = this.quality === "low" ? 230 : this.quality === "medium" ? 340 : Infinity;
    this.env.cull(this.camera.position, dt);
    this.pearls.update(pearls, owners, this.time);
    // ---- events → effects
    for (const e of f.events) this.onEvent(e, sim);
    // ---- Rollo
    const S = this.story;
    const rs = S ? S.rollo.s : r.s, ru = S ? S.rollo.u : r.u, rh = S ? S.rollo.h : r.h;
    const fr = tr.frame(rs, new Float32Array(12));
    const up = new THREE.Vector3(fr[6], fr[7], fr[8]);
    const pos = this.wp(rs, ru, rh);
    this.rollo.root.position.copy(pos);
    this.rollo.root.up.copy(up);
    this.rollo.root.lookAt(pos.x - fr[3], pos.y - fr[4], pos.z - fr[5]);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    if (S) this.rollo.update({ v: S.rollo.run * 16, vu: 0, air: false, vh: 0, ball: false, hit: false, blink: false, run: 0, dt, idle: S.rollo.run < 0.05, reach: S.rollo.reach, toss: S.rollo.toss });
    else this.rollo.update({ v: f.paused ? 0 : r.v, vu: r.vu, air: r.air, vh: r.vh, ball: r.ball, hit: this.hitFlash > 0, blink: r.blink > 0 && r.stun <= 0, run: 0, dt, idle: this.cine.shot === "intro" || this.cine.shot === "goal", fast: r.turbo > 0 || r.rush > 0 });
    if (this.ghostPath && !S) this.ghostFrame(r.time, this.cur?.st.run ?? 16, dt);
    const gpos = this.wp(r.s, r.u, Math.max(0, sim.groundAt(r.s, r.u, r.h)) + 0.02);
    this.rolloLight.position.copy(pos).addScaledVector(up, 3.2).addScaledVector(new THREE.Vector3(fr[3], fr[4], fr[5]), -1.2);
    this.shadow.position.copy(gpos).addScaledVector(up, 0.03);
    this.shadow.lookAt(gpos.x + up.x, gpos.y + up.y, gpos.z + up.z);
    const shadowK = Math.max(0.15, 1 - r.h / 6);
    this.shadow.scale.setScalar(shadowK); (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * shadowK;
    // ---- effects
    this.rollo.root.updateMatrixWorld(true);
    const soles = this.rollo.soles.map((o) => o.getWorldPosition(new THREE.Vector3()));
    this.fx.update(dt, { soles, ballPos: pos.clone().addScaledVector(up, 0.5), up, side: new THREE.Vector3(fr[9], fr[10], fr[11]), ground: gpos, ball: r.ball, speed: f.paused ? 0 : r.v, turbo: r.turbo > 0 || r.rush > 0, air: r.air });
    // ---- boss
    const b = sim.boss;
    if (this.boss && b) {
      this.boss.root.visible = b.phase !== "down" || b.ahead < 200;
      const bs = r.s + b.ahead;
      cur.art.place(this.boss.root, bs, b.u, 0);
      this.boss.root.rotateY(Math.PI);
      cur.art.animateBoss(this.boss.kind, this.boss.parts, this.time, b.phase);
      if (b.phase === "down") this.boss.root.position.y -= Math.min(20, (b.ahead - 26) * 0.3);
    }
    // ---- the story's cast, and Mayamma in play
    this.storyCast(S, dt);
    if (!S) this.hagFrame(r.s, r.v, dt);
    // ---- the camera
    const seg = tr.segAt(r.s);
    let loop: { s0: number; len: number } | null = null;
    if (seg.tag === "loop") { const gi = tr.seg[Math.floor(r.s)]; loop = { s0: tr.segStart[gi], len: seg.len }; }
    // a camera twist from a cam marker on this stretch
    let mode: string | null = null;
    for (const o of st.objs) { if (o.k !== "cam") continue; if (o.s - (o.ds ?? 30) > r.s) break; if (r.s <= o.s + (o.ds ?? 30)) { mode = o.cam ?? null; break; } }
    if (this.hag.on && this.hag.t < 1.55) mode = "witch";
    if (S) this.storyCamera(S);
    else this.cine.update({
      mode, front: !!this.view.front, hag: this.hag.on ? { s: this.hag.s, u: this.hag.u, h: this.hag.h } : null,
      s: r.s, u: r.u, h: r.h, v: r.v, run: st.run, air: r.air, ball: r.ball, tag: seg.tag, turbo: r.turbo > 0, rush: r.rush > 0,
      boss: b && b.phase !== "down" ? { s: r.s + b.ahead, u: b.u } : null, loop, portrait: f.portrait, dt: f.paused ? 0 : f.dt, time: this.time,
    });
    // ---- a new world: light swells as Rollo nears the join, the world swaps at its peak, then it fades
    if (this.next && this.envNext) { const d = -(r.s + this.next.off); this.flash = Math.max(this.flash, Math.min(1, 1 - d / Math.max(6, r.v * 0.35))); }
    else this.flash = Math.max(0, this.flash - dt * 1.4);
    if (S) { this.flash = Math.max(this.flash, S.flash); this.renderer.toneMappingExposure = 1.2 * (1 - S.dim * 0.5); }
    this.flashEl.style.opacity = (this.flash * 0.92).toFixed(3);
    const bh = S ? `${(S.bars * 10).toFixed(2)}%` : "0"; for (const b of this.barsEl) b.style.height = bh;
    // ---- view twists that move: weather round the camera, lightning, the light show, day turning to night
    const V = this.view;
    if (this.weather) { this.weather.position.copy(this.camera.position); this.weather.position.y -= 10; const a = this.weather.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array, fall = dt * (V.snow ? 3 : 24); for (let i = 1; i < arr.length; i += 3) { arr[i] -= fall; if (arr[i] < -2) arr[i] += 30; } a.needsUpdate = true; }
    if (V.flash) { this.boltT -= dt; if (this.boltT <= 0) { this.boltT = 1.4 + Math.random() * 2.6; this.bolt = 1; } this.bolt = Math.max(0, this.bolt - dt * 4); this.renderer.toneMappingExposure = (V.dark ? 0.55 : 1.0) + this.bolt * 2.2; }
    if (V.lightShow && this.scene.fog) { const hue = (this.time * 0.25) % 1; (this.scene.fog as THREE.Fog).color.setHSL(hue, 0.6, 0.35); this.renderer.toneMappingExposure = 1.1 + Math.max(0, Math.sin(this.time * Math.PI * 4)) * 0.25; }
    if (V.dayToNight) { const k = Math.min(1, r.s / Math.max(1, st.goal)); this.renderer.toneMappingExposure = 1.2 - k * 0.5; }
    if (this.chaser && st.chase) { const cs = r.s - Math.max(2, r.chase); const P = this.wp(cs, 0, 0); this.chaser.root.position.copy(P); this.chaser.root.lookAt(this.wp(cs + 5, 0, 0)); this.chaser.root.visible = r.s > st.chase.from; const sp = this.chaser.root.userData.spin as THREE.Object3D | undefined; if (sp) sp.rotation.x -= dt * r.v / 4; this.chaser.root.rotation.z += Math.sin(this.time * 3) * 0.002; }
    if (this.rival && st.rival) { const P = this.wp(r.rival, 2.2, 0); this.rival.root.position.copy(P); this.rival.root.lookAt(this.wp(r.rival - 5, 2.2, 0)); this.rival.root.position.y += Math.abs(Math.sin(this.time * 9)) * 0.1; }
    // ---- world motion
    this.env.frame(dt, this.camera);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  private onEvent(e: Ev, sim: Sim) {
    const fx = this.fx!, r = sim.r, cur = this.cur!;
    const at = (o: Obj, dh = 0) => this.wp(o.s, sim.uOf(o), o.h + dh);
    switch (e.t) {
      case "pearl": fx.burst(at(e.o), "pearl", 4); break;
      case "bigPearl": fx.burst(at(e.o), "pearl", 20); break;
      case "medal": fx.burst(at(e.o), "medal", 24); break;
      case "smash": fx.burst(at(e.o, 0.6), e.o.k === "crate" ? "splinter" : "spark", 22); this.cine?.kick(0.5); break;
      case "bonk": fx.burst(at(e.o, 0.6), "spark", 24); this.cine?.kick(0.4); break;
      case "spring": case "side": { const v = cur.views.get(e.o.id); if (v) v.hit = 1; fx.burst(at(e.o, 0.5), "spark", 10); break; }
      case "pad": fx.burst(at(e.o, 0.3), "rush", 16); this.cine?.kick(0.25); break;
      case "land": if (e.vh < -9) { fx.burst(this.wp(r.s, r.u, r.h), cur.tr.segAt(r.s).floor === "falls" ? "spray" : "dust", 12); this.cine?.kick(Math.min(0.6, -e.vh / 30)); } break;
      case "hit": this.hitFlash = 1; this.cine?.kick(1); fx.burst(this.wp(r.s, r.u, r.h + 0.8), "spark", 18); break;
      case "fall": fx.reset(); this.cine?.play("respawn"); break;
      case "check": { const o = cur.st.objs.find((x) => x.k === "lamp" && x.s === cur.st.checks[e.i]); const v = o && cur.views.get(o.id); if (v) cur.art.light(v); break; }
      case "boss": if (e.what === "hit" || e.what === "down") { fx.burst(this.wp(r.s + (sim.boss?.ahead ?? 10), sim.boss?.u ?? 0, 2.5), "spark", 60); this.cine?.kick(1); } break;
      case "turbo": case "burst": fx.burst(this.wp(r.s, r.u, r.h + 0.5), "rush", 16); break;
      case "magnet": fx.burst(at(e.o), "spark", 16); break;
      default: break;
    }
  }

  /** a JPEG of the current frame (store art) */
  capture(q = 0.92) { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); return this.cv.toDataURL("image/jpeg", q); }

  dispose() {
    this.gov.dispose();
    if (this.weather) { this.weather.geometry.dispose(); (this.weather.material as THREE.Material).dispose(); }
    for (const L of [...this.old, this.cur, this.next]) if (L) this.dropLayer(L);
    this.old = []; this.cur = this.next = null;
    this.env?.dispose(); this.envNext?.dispose(); this.fx?.dispose(); this.pearls.dispose(); this.rollo.dispose(); this.ghost?.dispose();
    this.composer?.dispose();
    this.witch?.dispose(); this.chintu?.dispose();
    this.renderer.dispose(); this.cv.remove(); this.flashEl.remove(); for (const b of this.barsEl) b.remove();
  }
}
