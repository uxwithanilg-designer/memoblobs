// Momo Dash! renderer (three.js). Momo stays at the origin and the world streams toward the camera; every material
// is bent by a small vertex-shader curve so the track rolls away over the horizon (and sways left and right).
// Look: glossy clay (clearcoat) lit by an environment map baked from the world's sky, glowing bulbs through a bloom
// pass, fog and a gradient sky dome, and depth in layers — near props, the house rows, water or lava, far landmarks.
// The run passes through 12 worlds: at each world gate the renderer rebuilds the world (road, houses, props, obstacle
// skins, sky, light) behind a white flash; until then, nothing past the gate is drawn (the gate glows white).
import * as THREE from "three";
import { FrameGovernor } from "@/lib/perf";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { bolt, bonbon, gloop, hoot, noodle, pip, tiki, turbo, zib } from "../boing/models";
import { chefGrumble, hatGeo, krankyKrab, merge, tint } from "../crowd/models";
import * as M from "./models";
import * as X from "./models2";
import { LW, TRAM_H, WORLD_TOD, sectionOf } from "./levels";
import { geyserOn, geyserWarn, ghostOn, obZ, type Sim } from "./sim";
import { styleOf, withTod, type Theme, type WorldStyle } from "./worlds";
import type { FriendId, Item, MorphId, Section, SimEvent, Weather, WorldId } from "./types";

export type Quality = "low" | "medium" | "high";
/** what Momo looks like (bought in the shop) */
export interface DashLook { char: string; hat: string; trail: string; board: string }
export const TRAILS: Record<string, string[]> = {
  stars: ["#FFD23F", "#FFF2A8"], hearts: ["#FF5F7E", "#FF8FB8"], rainbow: ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF", "#B58CFF"],
  bubbles: ["#CFF1FF", "#FFFFFF"], fire: ["#FF5A1F", "#FFC23D"], sparkle: ["#FFFFFF", "#9FE6FF", "#FFE08A"],
};
export const BOARDS: Record<string, string> = { jelly: "#FF5FA2", lime: "#7CFF6B", ocean: "#3DE0FF", gold: "#FFC21A", night: "#7A3FCB" };
const FRIEND_IDS: FriendId[] = ["zib", "pip", "bolt", "gloop", "bonbon", "hoot", "turbo", "noodle", "tiki", "kranky"];
const friendGeo = (id: FriendId) => {
  switch (id) {
    case "zib": return zib(); case "pip": return pip(); case "bolt": return bolt(); case "gloop": return gloop(); case "bonbon": return bonbon();
    case "hoot": return hoot(); case "turbo": return turbo(); case "noodle": return noodle(); case "tiki": return tiki();
    default: { const k = krankyKrab(); k.scale(0.42, 0.42, 0.42); return k; }
  }
};
const fi = (id?: FriendId) => Math.max(0, FRIEND_IDS.indexOf(id ?? "zib"));

// ------------------------------------------------------------------ the bend
const BEND = { value: new THREE.Vector2(0.0017, 0) };
function bendify<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBend = BEND;
    sh.vertexShader = "uniform vec2 uBend;\n" + sh.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  mvPosition.y -= uBend.x * mvPosition.z * mvPosition.z;\n  mvPosition.x += uBend.y * mvPosition.z * mvPosition.z;\n  gl_Position = projectionMatrix * mvPosition;",
    );
  };
  m.customProgramCacheKey = () => "dash-bend";
  return m;
}

/** many copies of a few prop variants (each variant may have several parts with their own materials) */
class Layer {
  private meshes: THREE.InstancedMesh[][];
  private n: number[];
  private d = new THREE.Object3D();
  private colored: boolean;
  constructor(sc: THREE.Object3D, variants: { g: THREE.BufferGeometry; m: THREE.Material }[][], cap: number, colored: boolean | "first" = false) {
    this.colored = !!colored;
    this.meshes = variants.map((parts) => parts.map(({ g, m }, pi) => {
      const mesh = new THREE.InstancedMesh(g, m, cap);
      mesh.frustumCulled = false; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colored === true || (colored === "first" && pi === 0)) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      sc.add(mesh);
      return mesh;
    }));
    this.n = variants.map(() => 0);
  }
  begin() { this.n.fill(0); }
  put(v: number, x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, col?: THREE.Color, rx = 0, rz = 0) {
    const parts = this.meshes[v], i = this.n[v];
    if (!parts || i >= parts[0].instanceMatrix.count) return;
    const d = this.d;
    d.position.set(x, y, z); d.rotation.set(rx, ry, rz);
    if (typeof s === "number") d.scale.setScalar(s); else d.scale.set(s[0], s[1], s[2]);
    d.updateMatrix();
    for (const m of parts) { m.setMatrixAt(i, d.matrix); if (col && this.colored && m.instanceColor) m.setColorAt(i, col); }
    this.n[v] = i + 1;
  }
  end() {
    this.meshes.forEach((parts, v) => parts.forEach((m) => {
      m.count = this.n[v]; m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }));
  }
  /** geometries go too (materials are disposed by their owner) */
  dispose(geos = true) { this.meshes.flat().forEach((m) => { if (geos) m.geometry.dispose(); m.removeFromParent(); m.dispose(); }); }
}

const hash = (i: number, k = 0) => { let h = Math.imul(i * 374761393 + k * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s: number; c: THREE.Color; g: number }
type WL = { tiles: Layer; walls: Layer; props: Layer; glowProps: Layer; bulbs: Layer; far: Layer; obs: Record<string, Layer>; belts: THREE.Texture[] };

export class DashRenderer {
  renderer: THREE.WebGLRenderer;
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sim: Sim; private q: Quality; private look: DashLook;
  private keep: { dispose: () => void }[] = [];
  private wkeep: { dispose: () => void }[] = [];
  private wl!: WL; private st!: WorldStyle; private ts!: WorldStyle; private th!: Theme; private sec!: Section;
  private farSpec: ReturnType<WorldStyle["far"]> = [];
  private t = 0; private w = 1; private h = 1;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial; private stars: THREE.Points;
  private hemi: THREE.HemisphereLight; private key: THREE.DirectionalLight; private rim: THREE.DirectionalLight;
  private clouds: THREE.InstancedMesh; private cloudMat: THREE.MeshStandardMaterial;
  private waters: THREE.Mesh[] = [];
  private TILE = 12;
  private clay: THREE.Material; private gloss: THREE.Material; private glow: THREE.Material; private glowSoft: THREE.Material;
  private coins: Layer; private items: Layer; private friendsL: Layer; private conga: Layer; private minis: Layer; private gates: Layer; private shadows: Layer;
  private momo = new THREE.Group(); private body: THREE.Mesh; private feet: THREE.Mesh[] = []; private arms: THREE.Mesh[] = []; private sprout: THREE.Mesh | null = null;
  private hat: THREE.Mesh | null = null; private boardMesh: THREE.Mesh; private rocket: THREE.Mesh; private rocketGold: THREE.Mesh;
  private shadow: THREE.Mesh; private shield: THREE.Mesh; private magnetRing: THREE.Mesh; private skyCloud: THREE.Mesh;
  private congaHist: { x: number; y: number; z: number }[] = [];
  private guard: THREE.Mesh; private guardZ = 14;
  private thief: THREE.Group; private thiefVillain: THREE.Mesh;
  private parts: Particle[] = []; private partMesh: THREE.InstancedMesh; private streaks: THREE.InstancedMesh;
  private streakData: { x: number; y: number; z: number; v: number }[] = [];
  private wx: THREE.InstancedMesh; private wxData: { x: number; y: number; z: number; p: number }[] = []; private weather: Weather = "none";
  private dummy = new THREE.Object3D(); private col = new THREE.Color();
  private runPh = 0; private squashT = 0; private wobbleT = 0; private shakeT = 0; private ySmooth = 0; private lean = 0; private roll = 0;
  private introT = 0; private attract: boolean; private bendX = 0; private zone = 0;
  private pulled = new Set<number>();
  private momoMat!: THREE.MeshPhysicalMaterial;
  /** the next world, built a moment after the white flash starts */
  private pending: { n: number; t: number } | null = null;
  /** art / QA: a close 3/4 shot of Momo */
  photoCam: { d: number; h: number; side: number; dx: number } | null = null;

  constructor(host: HTMLElement, sim: Sim, quality: Quality, attract = false, look: DashLook = { char: "momo", hat: "none", trail: "none", board: "jelly" }) {
    this.sim = sim; this.q = quality; this.attract = attract; this.look = look;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1));
    // lower the resolution a step if this device can't hold the frame rate (and back up when it can)
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    const sc = this.scene;
    sc.add(this.world);
    sc.fog = new THREE.Fog("#ffffff", 70, 230);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1); sc.add(this.hemi);
    this.key = new THREE.DirectionalLight("#ffffff", 2); sc.add(this.key);
    this.rim = new THREE.DirectionalLight("#ffffff", 0.6); this.rim.position.set(-6, 4, 8); sc.add(this.rim);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.3, -1) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h)) : mix(bot, mid, smoothstep(-0.02, 0.18, h));
        float s = max(dot(vP, sunDir), 0.0); c += sun * (pow(s, 600.0) * 2.2 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.keep.push(this.skyMat);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; sc.add(this.sky);
    this.stars = this.makeStars(); sc.add(this.stars);
    this.cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false });
    this.keep.push(this.cloudMat);
    this.clouds = new THREE.InstancedMesh(M.cloudPuff(), this.cloudMat, 14);
    this.clouds.frustumCulled = false;
    for (let i = 0; i < 14; i++) {
      const a = -1.2 + (i / 13) * 2.4, r = 260 + hash(i, 3) * 80;
      this.dummy.position.set(Math.sin(a) * r, 40 + hash(i, 4) * 50, -Math.cos(a) * r);
      this.dummy.scale.set(4 + hash(i, 5) * 4, 1.6 + hash(i, 6), 2); this.dummy.rotation.set(0, -a, 0); this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    sc.add(this.clouds);

    const k = <T extends { dispose: () => void }>(x: T) => { this.keep.push(x); return x; };
    this.clay = k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.55 })));
    this.gloss = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.22, envMapIntensity: 1.0 })));
    this.glow = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.2, 3.2, 3.2), fog: false })));
    this.glowSoft = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.55, depthWrite: false, fog: false })));
    const coinM = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.22, clearcoat: 1, envMapIntensity: 1.6, emissive: new THREE.Color("#FFB000"), emissiveIntensity: 0.32 })));
    const bubM = k(bendify(new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", roughness: 0.05, transparent: true, opacity: 0.26, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3, envMapIntensity: 2, depthWrite: false })));
    const portalFill = k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false })));
    const shM = k(bendify(new THREE.MeshBasicMaterial({ map: k(radialTex()), transparent: true, depthWrite: false, color: "#000000", opacity: 0.38 })));
    const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);

    this.coins = this.layer(sc, [[{ g: M.coin(), m: coinM }]], 460);
    const padG = M.pad();
    this.items = this.layer(sc, [
      [{ g: M.bubble(), m: bubM }],
      ...["magnet", "shield", "double", "sky"].map((id) => [{ g: M.powerIcon(id), m: this.gloss }]),
      [{ g: M.letterGeo("M"), m: this.gloss }], [{ g: M.letterGeo("O"), m: this.gloss }],
      [{ g: M.cage(), m: coinM }],
      [{ g: padG.g, m: this.gloss }, { g: padG.glow, m: k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.6), fog: false }))) }],
      [{ g: X.boostGeo(false), m: this.gloss }], [{ g: X.boostGeo(true), m: coinM }],
      [{ g: X.starGeo(), m: coinM }],
      [{ g: X.morphGate(), m: this.gloss }],
      ...(["ball", "split", "giant", "stretch"] as MorphId[]).map((id) => [{ g: X.morphIcon(id), m: this.gloss }]),
      [{ g: X.portalGeo(), m: this.gloss }, { g: X.portalFill(), m: portalFill }],
    ], 40, "first");
    this.friendsL = this.layer(sc, FRIEND_IDS.map((id) => [{ g: friendGeo(id), m: this.gloss }]), 8);
    this.conga = this.layer(sc, FRIEND_IDS.map((id) => [{ g: friendGeo(id), m: this.gloss }]), 6);
    const wg = X.worldGate();
    const gateFill = new THREE.CircleGeometry(4.6, 40, 0, Math.PI); gateFill.translate(0, 6.2, -0.1);
    const gateRect = new THREE.PlaneGeometry(9.2, 6.2); gateRect.translate(0, 3.1, -0.1);
    const whiteM = k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6), fog: false })));
    this.gates = this.layer(sc, [[{ g: wg.g, m: this.gloss }, { g: wg.glow, m: this.glow }, { g: gateFill, m: whiteM }, { g: gateRect, m: whiteM }]], 2);
    this.shadows = this.layer(sc, [[{ g: shGeo, m: shM }]], 200);

    // ---- Momo (or the friend you play as)
    const rig = M.momoRig();
    const momoM = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.25, sheen: 0.4, sheenColor: new THREE.Color("#FFD2A8") })));
    const isMomo = !look.char || look.char === "momo";
    const charG = isMomo ? rig.body : (() => { const g = friendGeo(look.char as FriendId); g.rotateY(Math.PI); return g; })();
    this.momoMat = momoM;
    this.body = new THREE.Mesh(charG, momoM); this.body.position.y = 0.18;
    if (isMomo) { this.sprout = new THREE.Mesh(rig.sprout, momoM); this.sprout.position.set(0, 1.08, 0); this.body.add(this.sprout); }
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(rig.foot, momoM); f.position.set(sx * 0.2, 0, 0); this.feet.push(f); this.momo.add(f);
      const a = new THREE.Mesh(rig.arm, momoM); a.position.set(sx * 0.46, 0.62, 0); a.rotation.z = sx * 0.5; a.visible = isMomo; this.arms.push(a); this.body.add(a);
    }
    const hg = look.hat && look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { this.hat = new THREE.Mesh(hg, this.gloss); this.hat.scale.setScalar(0.5); this.hat.position.set(0, isMomo ? 1.02 : 1.08, 0); this.body.add(this.hat); }
    this.momo.add(this.body);
    this.keep.push(rig.body, rig.foot, rig.arm, rig.sprout, charG);
    this.boardMesh = new THREE.Mesh(X.boardGeo(), k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: BOARDS[look.board] ?? BOARDS.jelly, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92, envMapIntensity: 1.4 }))));
    this.boardMesh.visible = false; this.momo.add(this.boardMesh);
    this.rocket = new THREE.Mesh(X.boostGeo(false), this.gloss); this.rocket.scale.setScalar(1.3); this.rocket.visible = false; this.momo.add(this.rocket);
    this.rocketGold = new THREE.Mesh(X.boostGeo(true), coinM); this.rocketGold.scale.setScalar(1.3); this.rocketGold.visible = false; this.momo.add(this.rocketGold);
    sc.add(this.momo);
    this.minis = this.layer(sc, [[{ g: charG, m: momoM }]], 3);
    this.shadow = new THREE.Mesh(shGeo, shM); this.shadow.renderOrder = 1; sc.add(this.shadow);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 20), k(bendify(new THREE.MeshPhysicalMaterial({ color: "#BFE9FF", roughness: 0.05, transparent: true, opacity: 0.28, iridescence: 1, iridescenceIOR: 1.35, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }))));
    this.shield.visible = false; sc.add(this.shield);
    const ring = new THREE.TorusGeometry(1.0, 0.05, 6, 40); ring.rotateX(Math.PI / 2);
    this.magnetRing = new THREE.Mesh(ring, k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 0.9), transparent: true, opacity: 0.8, fog: false }))));
    this.magnetRing.visible = false; sc.add(this.magnetRing);
    this.skyCloud = new THREE.Mesh(M.cloudPuff(), k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.4 }))));
    this.skyCloud.scale.set(0.26, 0.17, 0.26); this.skyCloud.visible = false; sc.add(this.skyCloud);
    this.guard = new THREE.Mesh(M.guard(), this.gloss); this.guard.scale.setScalar(1.25); sc.add(this.guard);
    this.thief = new THREE.Group();
    const tk = new THREE.Mesh(M.kart("pier").g, this.gloss); tk.scale.setScalar(1.25); tk.rotation.y = Math.PI; this.thief.add(tk);
    this.thiefVillain = new THREE.Mesh(villainGeo(), this.gloss); this.thiefVillain.position.set(0, 0.85, 0.2); this.thief.add(this.thiefVillain);
    this.thief.visible = false; sc.add(this.thief);

    this.partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.08, 0), k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), fog: false }))), 520);
    this.partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1560), 3);
    this.partMesh.frustumCulled = false; this.partMesh.count = 0; sc.add(this.partMesh);
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 1.6), k(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, fog: false })), 60);
    this.streaks.frustumCulled = false; this.streaks.count = 0; sc.add(this.streaks);
    for (let i = 0; i < 60; i++) this.streakData.push({ x: 0, y: 0, z: 99, v: 0 });
    this.wx = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), k(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, fog: false })), 140);
    this.wx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(420).fill(1), 3);
    this.wx.frustumCulled = false; this.wx.count = 0; sc.add(this.wx);
    for (let i = 0; i < 140; i++) this.wxData.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 14, z: -Math.random() * 60, p: Math.random() * 6 });

    if (quality !== "low") {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(sc, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.setWorld(sim.sec);
    this.introT = attract ? 0 : 2.4;
  }

  private layer(parent: THREE.Object3D, v: { g: THREE.BufferGeometry; m: THREE.Material }[][], cap: number, colored: boolean | "first" = false) {
    return new Layer(parent, v, cap, colored);
  }

  // ------------------------------------------------------------------ worlds
  /** build a world (road and obstacles from sec.world, scenery and sky from sec.scene) */
  setWorld(sec: Section) {
    this.sec = sec;
    if (this.wl) {
      const old = this.wl;
      [old.tiles, old.walls, old.props, old.glowProps, old.bulbs, old.far, ...Object.values(old.obs)].forEach((l) => l.dispose());
      this.wkeep.forEach((d) => d.dispose()); this.wkeep = [];
      this.waters.forEach((w) => { w.geometry.dispose(); w.removeFromParent(); }); this.waters = [];
    }
    const st = styleOf(sec.scene), ts = styleOf(sec.world);
    this.st = st; this.ts = ts;
    const th = (this.th = withTod(st.theme, sec.tod, WORLD_TOD[sec.scene]));
    const foggy = sec.twist === "fog";
    const k = <T extends { dispose: () => void }>(x: T) => { this.wkeep.push(x); return x; };
    this.skyMat.uniforms.top.value.set(th.sky[0]); this.skyMat.uniforms.mid.value.set(th.sky[1]); this.skyMat.uniforms.bot.value.set(th.sky[2]);
    this.skyMat.uniforms.sun.value.set(th.sun); (this.skyMat.uniforms.sunDir.value as THREE.Vector3).set(...th.sunDir).normalize();
    this.scene.background = new THREE.Color(th.sky[2]);
    const f = this.scene.fog as THREE.Fog; f.color.set(foggy ? "#D8D8E8" : th.fog); f.near = foggy ? 18 : th.fogNear; f.far = foggy ? 110 : th.fogFar;
    this.hemi.color.set(th.hemiSky); this.hemi.groundColor.set(th.hemiGround); this.hemi.intensity = th.hemiI;
    this.key.color.set(th.key); this.key.intensity = th.keyI; this.key.position.set(th.sunDir[0] * 10, 8, -6);
    this.rim.color.set(th.rim); this.rim.intensity = th.rimI;
    this.renderer.toneMappingExposure = th.exposure;
    if (this.bloom) { this.bloom.strength = th.bloom; this.bloom.threshold = th.bloom < 0.4 ? 0.95 : 0.86; }
    this.stars.visible = th.stars;
    this.cloudMat.emissive.set(st.cloud); this.cloudMat.emissiveIntensity = st.cloudGlow; this.cloudMat.color.set(st.cloud);
    this.scene.environment = this.makeEnv(th);
    this.weather = sec.weather;

    // ---- the road (from the track world)
    const R = ts.road, dw = R.w;
    const deck = new THREE.PlaneGeometry(dw, this.TILE); deck.rotateX(-Math.PI / 2); deck.translate(0, 0, -this.TILE / 2); scaleUV(deck, 1, R.v);
    const deckMat = k(bendify(new THREE.MeshStandardMaterial({ map: k(R.tex()), roughness: R.rough, envMapIntensity: 0.6 })));
    const sideMat = k(bendify(new THREE.MeshStandardMaterial({ map: k(st.road.side()), roughness: 0.85, envMapIntensity: 0.4 })));
    const lanes: THREE.BufferGeometry[] = [];
    for (const lx of [-LW / 2, LW / 2]) {
      if (!R.dash) lanes.push(tint(at(new THREE.BoxGeometry(0.12, 0.04, this.TILE), lx, 0.02, -this.TILE / 2), R.lane));
      else for (let i = 0; i < 4; i++) lanes.push(tint(at(new THREE.BoxGeometry(0.14, 0.03, 1.4), lx, 0.015, -1.5 - i * 3), R.lane));
    }
    for (const ex of [-dw / 2, dw / 2]) lanes.push(tint(at(new THREE.BoxGeometry(0.4, 0.22, this.TILE), ex, 0.06, -this.TILE / 2), R.edge));
    if (R.posts) for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const p = new THREE.CylinderGeometry(0.22, 0.22, 3.2, 10); p.translate(sx * (dw / 2 - 0.2), -1.6, -i * 4); lanes.push(tint(p, R.posts)); }
    const water = st.water;
    const tv: { g: THREE.BufferGeometry; m: THREE.Material }[] = [{ g: deck, m: deckMat }, { g: merge(lanes), m: this.clay }];
    const mkSide = (sx: number) => { const g = new THREE.PlaneGeometry(40, this.TILE); g.rotateX(-Math.PI / 2); g.translate(sx * (20 + dw / 2), -0.02, -this.TILE / 2); scaleUV(g, 6, 2); return g; };
    if (!water) tv.push({ g: mkSide(-1), m: sideMat }, { g: mkSide(1), m: sideMat });
    else if (!water.both) tv.push({ g: mkSide(-1), m: sideMat });
    const wl: WL = { tiles: this.layer(this.world, [tv], 26), walls: null!, props: null!, glowProps: null!, bulbs: null!, far: null!, obs: {}, belts: [] };
    if (water) {
      const glint = k(canvasGlint());
      const wm = k(bendify(new THREE.MeshStandardMaterial({ color: water.color, roughness: water.rough, metalness: 0.1, envMapIntensity: 0.55, emissiveMap: glint, emissive: new THREE.Color(water.glint), emissiveIntensity: sec.scene === "lava" ? 2.2 : 1.2 })));
      for (const sx of water.both ? [-1, 1] : [1]) {
        const g = new THREE.PlaneGeometry(500, 700); g.rotateX(-Math.PI / 2); g.translate(sx * (250 + dw / 2), water.y, -300); scaleUV(g, 40, 56);
        const mesh = new THREE.Mesh(g, wm); mesh.frustumCulled = false; this.world.add(mesh); this.waters.push(mesh);
      }
    }
    // ---- houses, lamps, props, landmarks (from the scenery world)
    const wallMat = k(bendify(new THREE.MeshStandardMaterial({ map: k(M.windowTex(false, 3)), emissiveMap: k(M.windowTex(true, 3)), emissive: new THREE.Color(st.houses.glow), emissiveIntensity: th.windowGlow, roughness: 0.75, envMapIntensity: 0.4 })));
    const awn = [0, 1, 2].map((i) => k(bendify(new THREE.MeshStandardMaterial({ map: k(M.stripeTex(["#FF5F7E", "#2FB5A8", "#FFC21A"][i], "#FFFFFF")), side: THREE.DoubleSide, roughness: 0.7 }))));
    const neon = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(st.houses.glow).multiplyScalar(1.5), fog: true })));
    const matOf = (m: string) => (m === "wall" ? wallMat : m.startsWith("awning") ? awn[Number(m.slice(6))] : m === "gloss" ? this.gloss : m === "neon" ? neon : this.clay);
    wl.walls = this.layer(this.world, [0, 1, 2, 3].map((v) => st.houses.build(v).map((p) => ({ g: p.g, m: matOf(p.mat) }))), 44, "first");
    const lamp = X.lampOf(st.lamp);
    wl.props = this.layer(this.world, [[{ g: lamp.g, m: this.gloss }], ...st.near().map((g) => [{ g, m: this.gloss }])], 160);
    wl.glowProps = this.layer(this.world, [[{ g: lamp.glow, m: this.glow }]], 60);
    wl.bulbs = this.layer(this.world, [[{ g: new THREE.SphereGeometry(0.075, 8, 6), m: k(bendify(new THREE.MeshBasicMaterial({ color: "#FFFFFF", fog: false }))) }], [{ g: new THREE.CylinderGeometry(0.012, 0.012, 1, 4), m: k(bendify(new THREE.MeshBasicMaterial({ color: "#2A2140" }))) }]], 700, true);
    const fars = st.far();
    const litBlocks = (glow: string) => k(bendify(new THREE.MeshStandardMaterial({ color: sec.scene === "neon" ? "#2A2E4A" : "#3B2E6E", emissiveMap: k(M.windowTex(true, 9)), emissive: new THREE.Color(glow), emissiveIntensity: 1.8, roughness: 0.9 })));
    wl.far = this.layer(this.world, fars.map((fa) => fa.glow ? [{ g: fa.g, m: this.clay }, { g: fa.glow, m: this.glow }] : [{ g: fa.g, m: fa.x[0] < 0 || sec.scene === "neon" ? litBlocks(sec.scene === "neon" ? "#3DE0FF" : "#FFB050") : this.clay }]), 40);
    this.farSpec = fars;

    // ---- obstacles (skins from the track world)
    const S = ts.skin, O = wl.obs;
    const fence = X.fenceSkin(S.fence), bar = X.barSkin(S.bar), kart = M.kart(sec.world === "candy" ? "candy" : "x", S.kart), tf = M.tramFront();
    const jelly = S.jelly ? k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.86, envMapIntensity: 1.4, sheen: 0.6, sheenColor: new THREE.Color("#FFFFFF") }))) : this.gloss;
    O.fence = this.layer(this.world, [[{ g: fence.g, m: this.gloss }, { g: fence.glow, m: this.glow }]], 60);
    O.bar = this.layer(this.world, [[{ g: bar.g, m: this.gloss }, { g: bar.glow, m: this.glow }]], 60);
    O.block = this.layer(this.world, [[{ g: X.blockSkin(S.block), m: this.gloss }]], 60);
    O.cart = this.layer(this.world, [[{ g: kart.g, m: this.gloss }, { g: kart.glow, m: this.glow }]], 40);
    O.tram = this.layer(this.world, [[{ g: M.tramSeg(3.6), m: jelly }], [{ g: tf.g, m: this.gloss }, { g: tf.glow, m: this.glow }]], 90, "first");
    O.ramp = this.layer(this.world, [[{ g: M.ramp(1, 1), m: this.clay }]], 30);
    O.grumpy = this.layer(this.world, [[{ g: M.grumpyStand(), m: this.gloss }]], 40);
    O.roller = this.layer(this.world, [[{ g: X.rollerGeo(S.roller), m: this.gloss }]], 30);
    O.gap = this.layer(this.world, [[{ g: X.gapGeo(S.gapLip), m: this.clay }]], 40);
    O.ice = this.layer(this.world, [[{ g: X.iceGeo(), m: k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8, envMapIntensity: 1.6 }))) }]], 40);
    const beltTex = [-1, 1].map((d) => k(chevronTex(d)));
    wl.belts = beltTex;
    O.belt = this.layer(this.world, beltTex.map((tx) => [{ g: X.beltGeo(), m: this.clay }, { g: X.beltTop(), m: k(bendify(new THREE.MeshBasicMaterial({ map: tx, transparent: true, color: new THREE.Color(1.6, 1.4, 0.6) }))) }]), 30);
    const ghostG = merge([tint(at(new THREE.BoxGeometry(1.8, 2.2, 1.9), 0, 1.1, -1), "#B9A6FF")]);
    O.ghostOn = this.layer(this.world, [[{ g: ghostG, m: k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color("#7A5AE8"), emissiveIntensity: 0.8, transparent: true, opacity: 0.88, roughness: 0.4 }))) }]], 30);
    O.ghostOff = this.layer(this.world, [[{ g: ghostG.clone(), m: k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.14, depthWrite: false }))) }]], 30);
    O.rail = this.layer(this.world, [[{ g: X.railGeo(), m: this.gloss }], [{ g: X.railFront(), m: this.gloss }]], 40);
    O.geyser = this.layer(this.world, [[{ g: X.geyserBase(), m: this.gloss }], [{ g: X.geyserCore(), m: this.glow }], [{ g: X.geyserJet(), m: this.glowSoft }]], 30);
    O.gust = this.layer(this.world, [[{ g: X.gustGeo(), m: this.glowSoft }]], 40);
    const zg = X.zoomGeo();
    O.zoom = this.layer(this.world, [[{ g: zg.g, m: this.gloss }, { g: zg.glow, m: this.glow }]], 20);
    this.wl = wl;
    this.thiefVillain.geometry.dispose(); this.thiefVillain.geometry = villainGeo(sec.world);
  }
  private makeStars() {
    const n = 300, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = hash(i, 1) * Math.PI * 2, e = 0.25 + hash(i, 2) * 1.2;
      p[i * 3] = Math.cos(a) * Math.cos(e) * 500; p[i * 3 + 1] = Math.sin(e) * 500; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 500 - 100;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: "#FFFFFF", size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 });
    this.keep.push(g, m);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    return pts;
  }
  /** a small scene of the sky (plus warm lights) baked into a reflection map: this is what makes things shine */
  private makeEnv(th: Theme): THREE.Texture {
    const es = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16);
    const col: number[] = [], pos = g.getAttribute("position");
    const top = new THREE.Color(th.sky[0]), mid = new THREE.Color(th.sky[1]), bot = new THREE.Color(th.sky[2]), gr = new THREE.Color(th.hemiGround);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50;
      const c = y > 0.2 ? mid.clone().lerp(top, Math.min(1, (y - 0.2) / 0.6)) : y > -0.05 ? bot.clone().lerp(mid, (y + 0.05) / 0.25) : gr.clone().multiplyScalar(0.6);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sd = new THREE.Vector3(...th.sunDir).normalize();
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.envGlow).multiplyScalar(6) }));
    sun.position.copy(sd.multiplyScalar(40)); es.add(sun);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.bulbs[i % th.bulbs.length]).multiplyScalar(3) }));
      l.position.set(Math.cos(i) * 35, 8 + (i % 3) * 6, Math.sin(i) * 35); es.add(l);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(es, 0.03);
    pm.dispose();
    es.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
    this.wkeep.push(rt);
    return rt.texture;
  }

  // ------------------------------------------------------------------ per frame
  private gov: FrameGovernor | null = null;
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.renderer.setSize(this.w, this.h, false);
    this.composer?.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }
  /** track metres → screen pixels (with the bend), for DOM labels */
  screen(x: number, y: number, z: number): [number, number] {
    const v = new THREE.Vector3(x, y, -(z - this.sim.z)).applyMatrix4(this.camera.matrixWorldInverse);
    v.y -= BEND.value.x * v.z * v.z; v.x += BEND.value.y * v.z * v.z;
    v.applyMatrix4(this.camera.projectionMatrix);
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h];
  }
  momoScreen(dy = 1.4): [number, number] { return this.screen(this.sim.x, this.sim.y + dy, this.sim.z); }
  /** how far ahead the world is drawn: up to the next world gate */
  private limit() {
    for (const w of this.sim.track.worlds) if (w.z > this.sim.z + 1) return w.z;
    return Infinity;
  }

  update(dt: number, ev: SimEvent[]) {
    this.t += dt;
    const s = this.sim, pz = s.z;
    if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
    this.events(ev);
    if (this.pending && (this.pending.t -= dt) <= 0) { this.setWorld(sectionOf(this.pending.n)); this.pending = null; }
    this.bendX = Math.sin(pz / 140) * 0.0011 + Math.sin(pz / 57) * 0.0004;
    BEND.value.set(0.0017, this.bendX);
    const R = (z: number) => -(z - pz);
    const lim = this.limit();
    const wl = this.wl;
    wl.tiles.begin();
    const t0 = Math.floor((pz - 14) / this.TILE);
    for (let i = t0; i < t0 + 22; i++) if (i * this.TILE < lim) wl.tiles.put(0, 0, 0, R(i * this.TILE));
    wl.tiles.end();
    for (const w of this.waters) w.position.z = pz % 12.5;
    wl.belts.forEach((tx, i) => { tx.offset.x = (this.t * 1.6 * (i ? -1 : 1)) % 1; });
    this.scenery(pz, R, lim);
    this.obstacles(pz, R, lim);
    this.pickups(pz, R, lim);
    this.characters(dt, R);
    this.effects(dt);
    this.weatherFx(dt);
    this.cameraMove(dt);
  }

  private scenery(pz: number, R: (z: number) => number, lim: number) {
    const st = this.st, wl = this.wl, H = st.houses;
    wl.walls.begin(); wl.props.begin(); wl.glowProps.begin(); wl.bulbs.begin(); wl.far.begin();
    const sides: number[] = H.both ? [-1, 1] : [-1];
    for (let i = Math.floor((pz - 20) / H.spacing); i < (pz + 200) / H.spacing; i++) {
      if (i * H.spacing + 2 > lim) break;
      for (const sx of sides) {
        const k = i * 2 + (sx > 0 ? 1 : 0);
        if (hash(k, 9) < 0.12) continue;
        const v = Math.floor(hash(k, 1) * 4), x = sx * H.x - sx * hash(k, 2) * 0.4;
        this.col.set(H.walls[Math.floor(hash(k, 3) * H.walls.length)]);
        wl.walls.put(v, x, 0, R(i * H.spacing + 2), sx > 0 ? Math.PI : 0, 1, this.col);
      }
    }
    const LS = 16;
    for (let i = Math.floor((pz - 20) / LS); i < (pz + 190) / LS; i++) {
      if (i * LS > lim) break;
      const z = R(i * LS);
      for (const sx of [-1, 1]) { wl.props.put(0, sx * 4.95, 0, z, sx > 0 ? Math.PI : 0, [1, 1.5, 1]); wl.glowProps.put(0, sx * 4.95, 0, z, sx > 0 ? Math.PI : 0, [1, 1.5, 1]); }
      if (st.strings && i % 2 === 0) this.stringLights(i, z);
    }
    const pier = this.sec.scene === "pier";
    for (let i = Math.floor((pz - 20) / 9); i < (pz + 160) / 9; i++) {
      if (i * 9 + 4 > lim) break;
      const h = hash(i, 11), z = R(i * 9 + 4);
      if (pier) { if (h < 0.3) wl.props.put(1, -4.55, 0, z, Math.PI / 2); else if (h < 0.5) wl.props.put(2, -4.6, 0, z); }
      else if (h < 0.55) wl.props.put(1 + (Math.floor(h * 7.27) % 4), (h < 0.27 ? 1 : -1) * (5.2 + h * 1.5), 0, z, h * 6, 0.7 + h * 0.7);
    }
    if (pier) {
      for (let i = Math.floor((pz - 16) / 4); i < (pz + 170) / 4; i++) if (i * 4 < lim) wl.props.put(3, 4.85, 0, R(i * 4));
      for (let i = Math.floor((pz - 30) / 47); i < (pz + 240) / 47; i++) { const h = hash(i, 21); if (i * 47 < lim) wl.props.put(4, 16 + h * 30, -0.6, R(i * 47 + h * 20), h * 6, 1.1 + h * 0.6); }
    }
    this.farSpec.forEach((fa, v) => {
      for (let i = Math.floor((pz - 40) / fa.every); i < (pz + 420) / fa.every; i++) for (const sx of fa.both ? [-1, 1] : [fa.x[0] < 0 ? -1 : 1]) {
        const h = hash(i * 2 + (sx > 0 ? 1 : 0), 31 + v);
        const z = i * fa.every + h * fa.every * 0.5;
        if (z > lim + 200) continue;
        const sc = fa.s[0] + (fa.s[1] - fa.s[0]) * hash(i, 41 + v);
        const ax = Math.abs(fa.x[0]) + (Math.abs(fa.x[1]) - Math.abs(fa.x[0])) * h;
        wl.far.put(v, sx * ax, fa.y, R(z), h * 6, fa.x[0] < 0 ? [sc, sc * (1 + hash(i, 7)), 1] : sc);
      }
    });
    wl.walls.end(); wl.props.end(); wl.glowProps.end(); wl.bulbs.end(); wl.far.end();
  }
  /** a sagging string of bulbs across the track between two lamps */
  private stringLights(i: number, z: number) {
    const n = 15, cols = this.th.bulbs, wl = this.wl;
    for (let k = 0; k <= n; k++) {
      const f = k / n, x = -4.95 + f * 9.9, y = 5.6 - Math.sin(f * Math.PI) * 0.6;
      this.col.set(cols[(k + i) % cols.length]).multiplyScalar(this.q === "low" ? 1.4 : 3.2);
      wl.bulbs.put(0, x, y - 0.07, z, 0, 1, this.col);
      if (k < n) {
        const x2 = -4.95 + (k + 1) / n * 9.9, y2 = 5.6 - Math.sin((k + 1) / n * Math.PI) * 0.6, len = Math.hypot(x2 - x, y2 - y);
        this.col.set("#2A2140");
        wl.bulbs.put(1, (x + x2) / 2, (y + y2) / 2, z, 0, [1, len, 1], this.col, 0, Math.atan2(x2 - x, y2 - y) * -1 + Math.PI);
      }
    }
  }

  private obstacles(pz: number, R: (z: number) => number, lim: number) {
    const L = this.wl.obs, s = this.sim, t = s.t;
    for (const key of Object.keys(L)) L[key].begin();
    this.shadows.begin();
    const obs = s.track.obs;
    let lo = 0, hi = obs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].z < pz - 40) lo = m + 1; else hi = m; }
    for (let i = lo; i < obs.length && obs[i].z < pz + 210; i++) {
      const o = obs[i];
      if (o.smashed || !s.vis(o)) continue;
      const cz = obZ(o, pz);
      if (cz > pz + 210 || cz + o.len < pz - 14 || cz > lim - 1) continue;
      const x = o.lane * LW, z = R(cz);
      let shadow = true;
      switch (o.kind) {
        case "fence": L.fence.put(0, x, 0, z); break;
        case "bar": L.bar.put(0, x, 0, z); shadow = false; break;
        case "block": L.block.put(0, x, 0, z); break;
        case "cart": L.cart.put(0, x, Math.abs(Math.sin(this.t * 14 + o.id)) * 0.04, z - (o.k < 0 ? o.len : 0), o.k < 0 ? Math.PI : 0); break;
        case "grumpy": L.grumpy.put(0, x + Math.sin(this.t * 2.2 + o.id) * 0.18, Math.abs(Math.sin(this.t * 5 + o.id)) * 0.12, z, Math.sin(this.t * 3 + o.id) * 0.25); break;
        case "ramp": L.ramp.put(0, x, 0, z, 0, [1, TRAM_H, o.len]); shadow = false; break;
        case "roller": L.roller.put(0, x, 0, z, 0, 1, undefined, (pz - o.z) * 0.9); break;
        case "gap": L.gap.put(0, x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "ice": L.ice.put(0, x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "belt": L.belt.put((o.dir ?? 1) < 0 ? 0 : 1, x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "ghost": (ghostOn(o, t) ? L.ghostOn : L.ghostOff).put(0, x, 0, z); break;
        case "rail": L.rail.put(0, x, 0, z, 0, [1, 1, o.len]); L.rail.put(1, x, 0, z); break;
        case "geyser": {
          L.geyser.put(0, x, 0, z);
          const on = geyserOn(o, t), warn = geyserWarn(o, t);
          L.geyser.put(1, x, 0, z, 0, on || warn ? [1, 1 + (on ? 0 : Math.abs(Math.sin(this.t * 30)) * 3), 1] : [0.4, 1, 0.4]);
          if (on) L.geyser.put(2, x, 0, z, this.t * 3, [1, 0.85 + Math.sin(this.t * 25) * 0.15, 1]);
          shadow = false;
          break;
        }
        case "gust": for (const sx of [-0.6, 0.6]) L.gust.put(0, x + sx + Math.sin(this.t * 3 + o.id) * 0.3, 0, z - o.len / 2, this.t * 4 * (o.dir ?? 1), 1); shadow = false; break;
        case "zoom": L.zoom.put(0, x, 0, z); shadow = false; break;
        case "tram": {
          const rows = o.rows ?? 1, seg = (o.len + 0.5) / rows;
          this.col.set(this.ts.skin.tram[o.id % this.ts.skin.tram.length]);
          for (let r = 0; r < rows; r++) L.tram.put(0, x, 0, z - r * seg, 0, [1, 1, seg / 3.6], this.col);
          L.tram.put(1, x, 0, z);
          break;
        }
      }
      if (shadow) this.shadows.put(0, x, 0.03, z - o.len / 2, 0, [2.2, 1, Math.max(1.2, o.len + 0.8)]);
    }
    for (const key of Object.keys(L)) L[key].end();
    this.shadows.end();
    this.gates.begin();
    for (const w of s.track.worlds) if (w.z > pz - 20 && w.z < pz + 260 && w.z > 0) this.gates.put(0, 0, 0, R(w.z));
    this.gates.end();
  }

  private pickups(pz: number, R: (z: number) => number, lim: number) {
    const s = this.sim, items = s.track.items;
    this.coins.begin(); this.items.begin(); this.friendsL.begin();
    let lo = 0, hi = items.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].z < pz - 12) lo = m + 1; else hi = m; }
    const spin = this.t * 3.2;
    for (let i = lo; i < items.length && items[i].z < pz + 190; i++) {
      const it = items[i];
      if (it.z > lim - 1) break;
      if (it.kind !== "portal" && !s.vis(it)) continue;
      let x = it.lane * LW, y = it.y, z = it.z;
      if (it.got) {
        const a = it.t != null ? (s.t - it.t) / 0.2 : 1;
        if (it.kind !== "coin" || a >= 1 || !this.pulled.has(it.id)) continue;
        x += (s.x - x) * a; y += (s.y + 0.7 - y) * a; z += (s.z - z) * a;
      }
      const rz = R(z), bob = Math.sin(this.t * 3 + it.id) * 0.1;
      switch (it.kind) {
        case "coin": this.coins.put(0, x, y + bob * 0.6, rz, spin + it.z * 0.3); break;
        case "power": this.items.put(0, x, y + bob, rz, 0, 1); this.items.put(1 + ["magnet", "shield", "double", "sky"].indexOf(it.power ?? "magnet"), x, y + bob, rz, Math.sin(this.t * 2) * 0.6, 1.25); break;
        case "letter": this.items.put(it.letter === "M" ? 5 : 6, x, y + 0.4 + bob, rz, spin, 1.3); break;
        case "friend": this.items.put(0, x, y + bob, rz, 0, 1.15); this.friendsL.put(fi(it.friend), x, y + bob - 0.45, rz, Math.sin(this.t * 2 + it.id) * 0.4, 0.62); break;
        case "cage": this.items.put(7, x, 0, rz, this.t * 0.3, 1); this.friendsL.put(fi(it.friend), x, 0.15, rz, Math.sin(this.t * 3) * 0.5, 0.7); break;
        case "pad": this.items.put(8, x, 0, rz); break;
        case "boost": this.items.put(0, x, y + 0.2 + bob, rz, 0, 1.25); this.items.put(it.boost === 5 ? 10 : 9, x, y + 0.2 + bob, rz, this.t * 1.5, 1.05, undefined, 0.3); break;
        case "star": this.items.put(11, x, y + 0.3 + bob, rz, spin, 1.2); break;
        case "morph":
          this.items.put(12, x, 0, rz);
          this.items.put(13 + (["ball", "split", "giant", "stretch"] as MorphId[]).indexOf(it.morph ?? "ball"), x, 1.25 + bob, rz, spin, 1);
          break;
        case "portal":
          if (s.branch.has(it.port ?? 0)) break;
          this.col.set(it.side ? "#B58CFF" : "#FFC21A");
          this.items.put(17, x, 0, rz, 0, 1.15, this.col);
          break;
      }
    }
    this.coins.end(); this.items.end(); this.friendsL.end();
  }

  private characters(dt: number, R: (z: number) => number) {
    const s = this.sim, morph = s.morph?.id;
    const run = !s.air && s.squishT <= 0 && s.phase === "play";
    this.runPh += dt * (run ? Math.min(s.speed, 22) * 0.95 : 2);
    const ph = this.runPh;
    this.squashT = Math.max(0, this.squashT - dt);
    this.wobbleT = Math.max(0, this.wobbleT - dt);
    const vx = (s.lane * LW - s.x);
    this.lean += (Math.max(-1, Math.min(1, vx * 0.6)) * -0.32 - this.lean) * Math.min(1, dt * 12);
    const giant = morph === "giant", ball = morph === "ball", stretch = morph === "stretch", split = morph === "split";
    const boost = s.boostT > 0, board = s.boardT > 0;
    this.momo.position.set(s.x, s.y + (board && !boost ? 0.14 : 0), 0);
    this.momo.scale.setScalar(giant ? 2.2 : 1);
    this.momo.visible = !split && (!(s.invT > 0 && s.invT < 1.5 && Math.floor(s.invT * 14) % 2 === 0) || s.skyT > 0 || boost);
    let sy = 1, sxz = 1;
    if (ball) { sy = 0.9; sxz = 1.05; }
    else if (stretch) { sy = s.squishT > 0 ? 0.6 : 1.75; sxz = s.squishT > 0 ? 1.2 : 0.78; }
    else if (s.squishT > 0 && !s.air) { sy = 0.46; sxz = 1.32; }
    else if (s.air && !boost) { sy = s.vy > 0 ? 1.12 : 0.96; sxz = s.vy > 0 ? 0.92 : 1.03; }
    else if (this.squashT > 0) { const kk = this.squashT / 0.18; sy = 1 - 0.22 * kk; sxz = 1 + 0.16 * kk; }
    else { const b = Math.abs(Math.sin(ph)); sy = 1 - 0.05 * b; sxz = 1 + 0.03 * b; }
    this.body.scale.set(sxz, sy, sxz);
    this.body.position.y = run && !ball ? 0.18 + Math.abs(Math.cos(ph)) * 0.09 : 0.18;
    this.roll = ball ? this.roll - dt * s.speed * 1.6 : 0;
    this.body.rotation.set(ball ? this.roll : boost ? -0.35 : s.air ? -0.18 : run ? 0.12 : 0, 0, this.lean + (this.wobbleT > 0 ? Math.sin(this.wobbleT * 30) * 0.35 * this.wobbleT : 0));
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], a = this.arms[i], sgn = i ? 1 : -1, p = ph + (i ? Math.PI : 0);
      f.visible = !ball;
      if (boost) { f.position.set(sgn * 0.2, 0.05, 0.1); f.rotation.x = 0.2; }
      else if (s.air || board) { f.position.set(sgn * 0.22, board ? 0.02 : 0.18, 0.05); f.rotation.x = board ? 0 : 0.5; }
      else if (s.squishT > 0) { f.position.set(sgn * 0.34, 0, 0.1); f.rotation.x = 0; }
      else if (run) { f.position.set(sgn * 0.2, Math.max(0, -Math.sin(p)) * 0.26, Math.cos(p) * 0.3); f.rotation.x = Math.sin(p) * 0.5; }
      else { f.position.set(sgn * 0.2, 0, 0); f.rotation.x = 0; }
      a.rotation.x = boost ? -2.8 : s.air ? -2.4 : s.squishT > 0 ? -0.2 : run ? Math.cos(p) * 1.1 : 0;
      a.rotation.z = sgn * (boost ? 0.2 : s.air ? 0.3 : s.squishT > 0 ? 1.3 : 0.45);
    }
    if (this.sprout) { this.sprout.rotation.z = Math.sin(ph * 0.5) * 0.25 + this.lean * -0.6; this.sprout.rotation.x = s.air || boost ? 0.5 : -0.2; }
    this.boardMesh.visible = board && !boost;
    // star power: Momo flashes through the rainbow and sparkles while boosting
    if (boost) { this.momoMat.emissive.setHSL((this.t * 2.4) % 1, 1, 0.5); this.momoMat.emissiveIntensity = 0.55 + 0.3 * Math.sin(this.t * 18); if (Math.random() < 0.5) this.burst(s.x + (Math.random() - 0.5) * 1.2, s.y + 0.4 + Math.random() * 1.2, s.z - 0.2, 1, ["#FF5F7E", "#FFD23F", "#7CFFB2", "#5FB8FF", "#C8A6FF"][Math.floor(Math.random() * 5)], 1.2, 0.45, 0.45); }
    else if (this.momoMat.emissiveIntensity !== 0) this.momoMat.emissiveIntensity = 0;
    this.rocket.visible = boost && s.boostX < 5; this.rocketGold.visible = boost && s.boostX >= 5;
    for (const r of [this.rocket, this.rocketGold]) if (r.visible) { r.position.set(0, -0.35 + Math.sin(this.t * 20) * 0.03, 0.1); r.rotation.set(0, Math.PI, 0); }
    const sh = s.surface(s.x, s.y + 0.05, s.z).h;
    const hgt = Math.max(0, s.y - Math.max(0, sh));
    this.shadow.position.set(s.x, Math.max(0, sh) + 0.04, 0.05);
    this.shadow.scale.setScalar(Math.max(0.35, (giant ? 2.4 : 1.25) - hgt * 0.18));
    this.shadow.visible = sh > -1 && !split;
    this.minis.begin();
    if (split) for (const l of s.minis) this.minis.put(0, l * LW, s.y + 0.12 + Math.abs(Math.cos(ph + l)) * 0.09, 0, 0, 0.72);
    this.minis.end();
    this.shield.visible = s.shieldT > 0;
    if (this.shield.visible) { this.shield.position.set(s.x, s.y + 0.62, 0); this.shield.scale.setScalar((giant ? 2.2 : 1) * (1 + Math.sin(this.t * 6) * 0.04)); this.shield.rotation.y = this.t; }
    this.magnetRing.visible = s.magnetT > 0 || boost;
    if (this.magnetRing.visible) { this.magnetRing.position.set(s.x, s.y + 0.1 + Math.sin(this.t * 8) * 0.05, 0); this.magnetRing.scale.setScalar(1 + 0.15 * Math.sin(this.t * 10)); }
    this.skyCloud.visible = s.skyT > 0;
    if (this.skyCloud.visible) this.skyCloud.position.set(s.x, s.y - 0.12, 0.2);

    this.congaHist.unshift({ x: s.x, y: s.y, z: s.z });
    if (this.congaHist.length > 240) this.congaHist.pop();
    this.conga.begin();
    s.friends.forEach((id, kk) => {
      const back = 1.15 * (kk + 1) * (giant ? 1.6 : 1);
      let hp = this.congaHist[this.congaHist.length - 1];
      for (const hh of this.congaHist) if (s.z - hh.z >= back) { hp = hh; break; }
      const hop = Math.abs(Math.sin(this.runPh + kk * 1.3)) * 0.22;
      const sway = Math.sin(this.runPh * 0.5 + kk * 1.7) * 0.32;
      this.conga.put(fi(id), hp.x + sway, hp.y + hop, R(s.z - back), Math.PI + sway * 0.6, 0.56);
    });
    this.conga.end();

    const want = s.stumbleT > 0 ? 2.3 + (1 - s.stumbleT / 5.5) * 0.8 : 14;
    this.guardZ += (want - this.guardZ) * Math.min(1, dt * (s.stumbleT > 0 ? 6 : 1.5));
    this.guard.visible = this.guardZ < 12;
    this.guard.position.set(s.x + (s.x > 0 ? -1.15 : 1.15) + Math.sin(this.t * 3) * 0.15, Math.abs(Math.sin(this.t * 12)) * 0.16, this.guardZ);

    const c = s.chase != null ? s.track.chases.find((q) => q.id === s.chase) : null;
    this.thief.visible = !!c;
    if (c) {
      const gap = Math.max(6, 32 - s.pads * 8.5);
      this.thief.position.set(Math.sin(this.t * 0.8) * LW, Math.abs(Math.sin(this.t * 10)) * 0.05, R(s.z + gap));
    }
  }

  private events(ev: SimEvent[]) {
    const s = this.sim;
    for (const e of ev) {
      switch (e.t) {
        case "land": this.squashT = 0.18; if (e.v < -6) this.burst(s.x, s.y + 0.05, s.z, 8, "#FFFFFF", 2.2, 0.35, 0.8); break;
        case "jump": this.burst(s.x, s.y + 0.05, s.z, 6, "#FFFFFF", 1.6, 0.3, 0.6); break;
        case "squish": case "slam": this.burst(s.x, 0.1, s.z, 8, "#E9E1D2", 2.5, 0.35, 0.7); break;
        case "coin": {
          const it = this.findItem(e.id);
          if (e.pull) this.pulled.add(e.id);
          if (this.pulled.size > 600) this.pulled.clear();
          if (it) this.burst(it.lane * LW, it.y, it.z, e.line ? 5 : 4, "#FFE27A", 2.4, 0.35, 0.5);
          break;
        }
        case "melody": for (let i = 0; i < 3; i++) this.burst(s.x, s.y + 1.4, s.z, 8, ["#FF9FC8", "#9FE6FF", "#FFE08A"][i], 4, 0.6, 1.1); break;
        case "power": this.burst(s.x, s.y + 0.8, s.z, 26, "#FFFFFF", 5, 0.6, 1.2); break;
        case "boost": this.burst(s.x, s.y + 0.8, s.z, 30, "#FFC21A", 6, 0.7, 1.2); if (e.on) this.shakeT = 0.3; break;
        case "morph": this.burst(s.x, s.y + 0.8, s.z, 30, "#FF8A3D", 5, 0.7, 1.2); break;
        case "miniPop": this.burst(e.lane * LW, 0.6, s.z, 14, "#FF8A3D", 4, 0.5, 0.9); break;
        case "smash": this.burst(s.x, 0.9, s.z + 1.2, 16, ["#FFD23F", "#FF5F7E", "#7CFFB2"][Math.floor(Math.random() * 3)], 6, 0.6, 1.0); this.shakeT = Math.max(this.shakeT, 0.12); break;
        case "friendJoin": case "free": this.burst(s.x, s.y + 1, s.z, 18, "#BFE9FF", 4, 0.55, 1.1); break;
        case "friendSave": case "shieldPop": this.burst(s.x, s.y + 0.8, s.z + 1, 30, e.t === "shieldPop" ? "#9FE6FF" : "#FFD23F", 6, 0.7, 1.3); this.shakeT = 0.35; break;
        case "board": this.burst(s.x, s.y + 0.2, s.z, 20, BOARDS[this.look.board] ?? "#FF5FA2", 4, 0.5, 1); break;
        case "crash": this.shakeT = 0.5; this.burst(s.x, s.y + 0.8, s.z + 0.8, 26, "#FF6B8A", 6, 0.7, 1.3); break;
        case "stumble": this.wobbleT = 0.6; this.shakeT = 0.25; this.burst(s.x, 0.4, s.z, 10, "#E9E1D2", 3, 0.4, 0.8); break;
        case "trick": this.burst(s.x, s.y + 1.2, s.z, 14, e.kind === "bonk" ? "#C8A6FF" : "#FFE08A", 4.5, 0.5, 0.9); break;
        case "pad": case "zoom": this.burst(s.x, 0.3, s.z, 22, e.t === "zoom" ? "#3DE0FF" : "#7CFFB2", 5, 0.5, 1); this.shakeT = 0.2; break;
        case "star": this.burst(s.x, s.y + 1.2, s.z, 24, "#FFE14D", 6, 0.7, 1.2); break;
        case "cake": case "snip": this.burst(s.x, 1.2, s.z + 6, 30, e.t === "cake" ? "#FF8FC7" : "#E8504F", 6, 0.7, 1.2); break;
        case "gust": for (let i = 0; i < 12; i++) this.burst(s.x - e.dir * 2, 1 + Math.random(), s.z + 1, 1, "#FFFFFF", 3, 0.4, 0.6); break;
        case "caught": for (let i = 0; i < 4; i++) this.burst(s.x, 2, s.z + 6, 20, ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF"][i], 7, 0.9, 1.6); break;
        case "world": this.pending = { n: e.n, t: 0.12 }; break;
        case "portal": this.zone = 1.2; break;
        default: break;
      }
    }
  }
  private findItem(id: number): Item | null {
    const items = this.sim.track.items, z = this.sim.z;
    let lo = 0, hi = items.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].z < z - 12) lo = m + 1; else hi = m; }
    for (let i = lo; i < items.length && items[i].z < z + 14; i++) if (items[i].id === id) return items[i];
    return null;
  }
  private burst(x: number, y: number, z: number, n: number, color: string, sp: number, size: number, life: number) {
    const c = new THREE.Color(color).multiplyScalar(1.8);
    for (let i = 0; i < n && this.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      this.parts.push({ x, y, z, vx: Math.cos(a) * r * sp, vy: Math.abs(u) * sp + 1, vz: Math.sin(a) * r * sp, life: 0, max: life * (0.6 + Math.random() * 0.6), s: size * (0.6 + Math.random() * 0.8), c, g: 7 });
    }
  }
  private effects(dt: number) {
    const s = this.sim, d = this.dummy;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const kk = 1 - p.life / p.max;
      d.position.set(p.x, p.y, -(p.z - s.z)); d.scale.setScalar(p.s * kk * 3); d.rotation.set(p.life * 7, p.life * 5, 0); d.updateMatrix();
      this.partMesh.setMatrixAt(n, d.matrix); this.partMesh.setColorAt(n, p.c); n++;
    }
    if (s.phase === "play") {
      if ((s.doubleT > 0 || s.feverT > 0) && Math.random() < 0.6) this.burst(s.x, s.y + 0.6, s.z - 0.3, 1, s.feverT > 0 ? ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF"][Math.floor(this.t * 8) % 4] : "#FFE08A", 0.8, 0.45, 0.5);
      if (s.boostT > 0) for (let i = 0; i < 3; i++) if (this.parts.length < 500) this.parts.push({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y - 0.3, z: s.z - 0.9, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() - 0.5, vz: -6 - Math.random() * 4, life: 0, max: 0.35, s: 1.6 + Math.random(), c: new THREE.Color(Math.random() < 0.5 ? "#FFC23D" : "#FF5A1F").multiplyScalar(2.2), g: 0 });
      const tr = TRAILS[this.look.trail];
      if (tr && Math.random() < 0.5 && !s.air) this.burst(s.x + (Math.random() - 0.5) * 0.4, s.y + 0.25, s.z - 0.4, 1, tr[Math.floor(this.t * 10) % tr.length], 0.6, 0.4, 0.6);
    }
    this.partMesh.count = n; this.partMesh.instanceMatrix.needsUpdate = true;
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
    const fast = s.phase === "play" && !this.attract ? Math.max(0, (s.speed - 12) / 6) + (s.skyT > 0 ? 0.6 : 0) + (s.feverT > 0 ? 0.4 : 0) + (s.boostT > 0 ? 1.5 : 0) + (this.zone > 0 ? 1 : 0) : 0;
    if (this.zone > 0) this.zone -= dt;
    let m = 0;
    for (const st of this.streakData) {
      st.z += (st.v + s.speed) * dt;
      if (st.z > 8) {
        if (Math.random() < fast * 0.5) { st.z = -30 - Math.random() * 20; const a = Math.random() * Math.PI * 2; st.x = s.x + Math.cos(a) * (3 + Math.random() * 3); st.y = 2 + Math.sin(a) * 2.6; st.v = 10 + Math.random() * 10; }
        else continue;
      }
      d.position.set(st.x, st.y, st.z); d.scale.set(1, 1, 1 + fast * (s.boostT > 0 ? 3 : 1)); d.rotation.set(0, 0, 0); d.updateMatrix();
      this.streaks.setMatrixAt(m++, d.matrix);
    }
    this.streaks.count = m; this.streaks.instanceMatrix.needsUpdate = true;
  }
  /** snow, rain, fireflies, leaves, embers, stars, bubbles or sprinkles around the camera */
  private weatherFx(dt: number) {
    const w = this.weather, s = this.sim, d = this.dummy;
    if (w === "none" || this.q === "low") { this.wx.count = 0; return; }
    const cols: Record<Weather, string[]> = { none: [], snow: ["#FFFFFF"], rain: ["#BFD8FF"], fireflies: ["#FFF27A", "#B8FF7A"], leaves: ["#FF9A3D", "#7CC44A", "#FFC23D"], embers: ["#FF7A1F", "#FFC23D"], stars: ["#FFFFFF", "#FFF2A8"], bubbles: ["#CFF1FF"], sprinkles: ["#FF5F7E", "#FFD23F", "#7FE0D0", "#B58CFF"] };
    const fall = w === "embers" || w === "bubbles" ? -1 : w === "fireflies" || w === "stars" ? 0 : 1;
    const v = w === "rain" ? 14 : w === "snow" ? 1.6 : w === "leaves" ? 1.4 : w === "sprinkles" ? 2.2 : 1.0;
    let n = 0;
    for (let i = 0; i < this.wxData.length; i++) {
      const p = this.wxData[i];
      p.p += dt;
      p.y -= fall * v * dt; p.z += s.speed * dt * 0.95;
      if (fall === 0) { p.x += Math.sin(p.p * 1.3 + i) * dt * 0.6; p.y += Math.cos(p.p + i) * dt * 0.3; }
      else p.x += Math.sin(p.p + i) * dt * (w === "leaves" ? 1.2 : 0.3);
      if (p.y < -1 || p.y > 16 || p.z > 8) { p.x = (Math.random() - 0.5) * 30 + s.x; p.y = fall > 0 ? 10 + Math.random() * 6 : fall < 0 ? -0.5 : 0.5 + Math.random() * 8; p.z = -10 - Math.random() * 60; }
      d.position.set(p.x, p.y, p.z);
      if (w === "rain") d.scale.set(0.3, 6, 0.3); else if (w === "leaves" || w === "sprinkles") d.scale.set(1.6, 0.5, 1); else d.scale.setScalar(w === "fireflies" || w === "stars" ? 0.9 + Math.sin(p.p * 6 + i) * 0.5 : w === "bubbles" ? 2 : 1.2);
      d.rotation.set(p.p * 2, p.p, 0); d.updateMatrix();
      this.wx.setMatrixAt(n, d.matrix);
      const cs = cols[w]; this.col.set(cs[i % cs.length]).multiplyScalar(w === "fireflies" || w === "embers" || w === "stars" ? 2.4 : 1.1);
      this.wx.setColorAt(n, this.col); n++;
    }
    this.wx.count = n; this.wx.instanceMatrix.needsUpdate = true;
    if (this.wx.instanceColor) this.wx.instanceColor.needsUpdate = true;
  }

  private cameraMove(dt: number) {
    const s = this.sim, cam = this.camera, giant = s.morph?.id === "giant";
    this.ySmooth += (Math.min(s.y, 7) * (s.skyT > 0 ? 0.75 : 0.55) - this.ySmooth) * Math.min(1, dt * (s.air ? 2.5 : 5));
    const aspect = this.w / this.h;
    const fov = 62 + Math.min(8, Math.max(0, s.speed - 11) * 0.8) + (s.skyT > 0 ? 4 : 0) + (s.boostT > 0 ? 8 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    const tanH = Math.tan((cam.fov * Math.PI) / 360) * aspect;
    const dist = Math.max(6.6, Math.min(10.5, 3.05 / Math.max(0.05, tanH))) * (giant ? 1.3 : 1);
    const shake = this.shakeT > 0 ? (this.shakeT -= dt, this.shakeT * 0.6) : 0;
    const sx = (Math.random() - 0.5) * shake, sy2 = (Math.random() - 0.5) * shake;
    const bx = s.x * 0.6 + sx, by = 3.2 + dist * 0.12 + this.ySmooth + sy2 + (giant ? 1.4 : 0), bz = dist * 0.92;
    const lx = s.x * 0.8, ly = 1.25 + this.ySmooth * 0.9, lz = -11;
    if (this.photoCam) {
      const p = this.photoCam;
      cam.position.set(s.x + p.side * p.d * 0.55, p.h, -p.d);
      cam.lookAt(s.x + p.dx, 0.85, 0);
      return;
    }
    if (this.attract) {
      const a = Math.sin(this.t * 0.25) * 0.35;
      cam.position.set(Math.max(-2.6, Math.min(3.2, s.x * 0.4 + Math.sin(a) * 2.4 + 0.9)), 1.9, -5.4 - Math.cos(a) * 0.6);
      cam.lookAt(s.x, 1.05, 0.5);
      return;
    }
    if (this.introT > 0) {
      const k = Math.min(1, Math.max(0, (2.4 - this.introT - 0.5) / 1.7)), e = k * k * (3 - 2 * k);
      const ang = Math.PI * 0.82 * (1 - e), r = 5.2 + (Math.hypot(bx - s.x, bz) - 5.2) * e;
      cam.position.set(s.x + Math.sin(ang) * r, 1.7 + (by - 1.7) * e, Math.cos(ang) * r);
      cam.lookAt(new THREE.Vector3(s.x, 0.95, 0).lerp(new THREE.Vector3(lx, ly, lz), e * e));
      return;
    }
    cam.position.set(bx, by, bz);
    cam.lookAt(lx, ly, lz);
  }

  /** art / QA: drop the sparkles */
  clearFx() { this.parts.length = 0; this.partMesh.count = 0; }

  render() {
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.gov?.dispose();
    const wl = this.wl;
    [wl.tiles, wl.walls, wl.props, wl.glowProps, wl.bulbs, wl.far, ...Object.values(wl.obs)].forEach((l) => l.dispose());
    [this.coins, this.items, this.friendsL, this.conga, this.gates, this.shadows].forEach((l) => l.dispose());
    this.minis.dispose(false);
    this.waters.forEach((w) => w.geometry.dispose());
    this.wkeep.forEach((d) => d.dispose());
    this.keep.forEach((d) => d.dispose());
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ------------------------------------------------------------------ helpers
function at<T extends THREE.BufferGeometry>(g: T, x: number, y: number, z: number) { g.translate(x, y, z); return g; }
function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
function radialTex() {
  return M.canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }, false);
}
function canvasGlint() {
  return M.canvasTex(64, 64, (c) => {
    c.fillStyle = "#000000"; c.fillRect(0, 0, 64, 64);
    c.fillStyle = "rgba(255,220,180,0.9)";
    for (let i = 0; i < 9; i++) c.fillRect((i * 23) % 60, (i * 37) % 62, 3 + (i % 3), 1);
  });
}
function chevronTex(dir: number) {
  return M.canvasTex(128, 64, (c) => {
    c.clearRect(0, 0, 128, 64);
    c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 10; c.lineCap = "round";
    for (let i = 0; i < 2; i++) { const x = 30 + i * 64; c.beginPath(); c.moveTo(x - dir * 14, 12); c.lineTo(x + dir * 14, 32); c.lineTo(x - dir * 14, 52); c.stroke(); }
  });
}
/** the villain riding the thief's kart in each world */
function villainGeo(w: WorldId = "pier"): THREE.BufferGeometry {
  if (w === "candy") { const g = chefGrumble(); g.scale(0.62, 0.62, 0.62); return g; }
  const g = M.grumpyStand(); g.scale(1.5, 1.5, 1.5); g.translate(0, 0, 0.6);
  const hats: Record<string, string> = { pier: "pirate", jungle: "cowboy", snow: "santa", toy: "propeller", spooky: "wizard", canyon: "cowboy", neon: "party", lava: "viking", sky: "propeller", space: "party", castle: "crown" };
  const hg = hatGeo(hats[w] ?? "pirate");
  if (!hg) return g;
  hg.scale(0.8, 0.8, 0.8); hg.translate(0, 1.5, 0.6);
  return merge([g, hg.index ? hg.toNonIndexed() : hg]);
}
