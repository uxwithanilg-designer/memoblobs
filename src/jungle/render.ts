// Kiko's Jungle Quest renderer (three.js). Kiko stays at the origin and the forest streams toward the camera; every
// material is bent by a small vertex-shader curve so the path rolls away over the horizon (and sways left and right).
// Look: glossy clay lit by an environment map baked from the sky, glowing bits through a bloom pass, fog and a gradient
// sky, and depth in layers — ferns and flowers up close, giant trees whose canopies arch over the path (with god rays
// through the leaves), banana plants and palms behind, misty hills and waterfalls far away. The path is drawn in short
// strips so chasms and rivers can cut through it. At each region gate the forest is rebuilt behind a white flash.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { hatGeo } from "../crowd/models";
import * as M from "./models";
import * as M2 from "./models2";
import { STYLES, type RegionStyle } from "./styles";
import { BR_H, LW, sectionOf, FINALE, STAGE_M } from "./levels";
import { PAD_H, RAFT_Y, geyserOn, geyserWarn, obZ, type Sim } from "./sim";
import type { FruitId, Item, PowerId, RegionId, RideId, Section, SimEvent, TimeOfDay, Weather } from "./types";

export type Quality = "low" | "medium" | "high";
/** what Kiko looks like (bought in the shop) */
/** the wardrobe: fur colour, hat, trail, tail ribbon and the runner (Kiko, or Momo as a guest) */
export interface KikoLook { fur: string; hat: string; trail: string; ribbon?: string; runner?: string }
export const TRAILS: Record<string, string[]> = {
  leaves: ["#5FBF4A", "#9AE05A"], petals: ["#FF8FC7", "#FFD1E8"], rainbow: ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF", "#B58CFF"],
  bubbles: ["#CFF1FF", "#FFFFFF"], stars: ["#FFD23F", "#FFF2A8"], fireflies: ["#FFF27A", "#B8FF7A"],
};
const FRUIT_ORDER: FruitId[] = ["mango", "pineapple", "berries", "melon", "kiwi", "dragon"];
const POWER_ORDER: PowerId[] = ["magnet", "helmet", "double", "glide"];
const RIDE_IDS: RideId[] = ["turtle", "panda", "frog", "boat", "squirrel", "elephant", "pelican", "sled", "dino"];

// ------------------------------------------------------------------ the bend
const BEND = { value: new THREE.Vector2(0.0016, 0) };
function bendify<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBend = BEND;
    sh.vertexShader = "uniform vec2 uBend;\n" + sh.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  mvPosition.y -= uBend.x * mvPosition.z * mvPosition.z;\n  mvPosition.x += uBend.y * mvPosition.z * mvPosition.z;\n  gl_Position = projectionMatrix * mvPosition;",
    );
  };
  m.customProgramCacheKey = () => "kiko-bend";
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
  dispose(geos = true) { this.meshes.flat().forEach((m) => { if (geos) m.geometry.dispose(); m.removeFromParent(); m.dispose(); }); }
}

const hash = (i: number, k = 0) => { let h = Math.imul(i * 374761393 + k * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s: number; c: THREE.Color; g: number }
interface Theme {
  sky: [string, string, string]; sun: string; sunDir: [number, number, number]; fog: string; fogNear: number; fogFar: number;
  hemiSky: string; hemiGround: string; hemiI: number; key: string; keyI: number; rim: string; rimI: number; exposure: number; bloom: number; stars: boolean; rays: number;
}
const THEMES: Record<TimeOfDay, Theme> = {
  morning: { sky: ["#6FBCFF", "#BFE6FF", "#FFE9C2"], sun: "#FFE2A8", sunDir: [0.5, 0.32, -1], fog: "#CBE6D2", fogNear: 28, fogFar: 175, hemiSky: "#E2F4FF", hemiGround: "#4A6A3A", hemiI: 1.1, key: "#FFE2B0", keyI: 2.5, rim: "#FFD9A0", rimI: 0.7, exposure: 1.0, bloom: 0.5, stars: false, rays: 0.16 },
  day: { sky: ["#3FA2FF", "#8FD3FF", "#E8F7FF"], sun: "#FFF4D6", sunDir: [0.3, 0.6, -0.6], fog: "#BCE2CF", fogNear: 40, fogFar: 205, hemiSky: "#FFFFFF", hemiGround: "#3E6A3A", hemiI: 1.15, key: "#FFF6E0", keyI: 2.6, rim: "#FFFFFF", rimI: 0.6, exposure: 1.0, bloom: 0.42, stars: false, rays: 0.12 },
  sunset: { sky: ["#5A4BC4", "#FF9A6A", "#FFD27A"], sun: "#FFB070", sunDir: [0.6, 0.14, -1], fog: "#E8A87A", fogNear: 30, fogFar: 175, hemiSky: "#FFD2B0", hemiGround: "#5A3A3A", hemiI: 1.0, key: "#FFB070", keyI: 2.4, rim: "#FF7AA8", rimI: 0.9, exposure: 1.0, bloom: 0.62, stars: false, rays: 0.2 },
  cave: { sky: ["#0A0612", "#140C22", "#1E1430"], sun: "#7A5AE8", sunDir: [0.2, 0.9, -0.4], fog: "#160E26", fogNear: 16, fogFar: 105, hemiSky: "#9A8AF0", hemiGround: "#2A2038", hemiI: 0.95, key: "#C8B8FF", keyI: 1.3, rim: "#3DE0FF", rimI: 1.1, exposure: 1.15, bloom: 0.55, stars: false, rays: 0 },
  night: { sky: ["#0E1440", "#1E2A6E", "#3A3A8A"], sun: "#DDE6FF", sunDir: [-0.4, 0.5, -1], fog: "#1E2A5A", fogNear: 24, fogFar: 140, hemiSky: "#8FA8FF", hemiGround: "#1E2A3A", hemiI: 0.62, key: "#BFD0FF", keyI: 1.15, rim: "#7AE8FF", rimI: 0.85, exposure: 1.1, bloom: 0.95, stars: true, rays: 0 },
};
type RL = {
  strips: Layer; trees: Layer; leaves: Layer; plants: Layer; near: Layer; far: Layer; glowFar: Layer; rays: Layer; hang: Layer;
  zone: Layer; zoneGlow: Layer; water: THREE.Mesh[]; arches: Layer;
};

export class JungleRenderer {
  renderer: THREE.WebGLRenderer;
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sim: Sim; private q: Quality; private look: KikoLook;
  private keep: { dispose: () => void }[] = [];
  private rkeep: { dispose: () => void }[] = [];
  private rl!: RL; private sec!: Section; private th!: Theme; private region: RegionId = "grove";
  private t = 0; private w = 1; private h = 1;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial; private stars: THREE.Points;
  private hemi: THREE.HemisphereLight; private key: THREE.DirectionalLight; private rim: THREE.DirectionalLight;
  private clouds: THREE.InstancedMesh; private cloudMat: THREE.MeshStandardMaterial;
  private clay: THREE.Material; private gloss: THREE.Material; private glow: THREE.Material; private glowSoft: THREE.Material; private leaf: THREE.Material; private canopy: THREE.Material;
  private rayMat: THREE.MeshBasicMaterial; private waterMat: THREE.MeshStandardMaterial; private waterTex: THREE.Texture;
  private bananas: Layer; private items: Layer; private obs: Record<string, Layer> = {}; private shadows: Layer; private flags: Layer; private gates: Layer; private vines: Layer;
  // Kiko
  private kiko = new THREE.Group(); private body = new THREE.Group(); private torso: THREE.Mesh; private head: THREE.Group; private arms: THREE.Group[] = []; private legs: THREE.Group[] = []; private tail: THREE.Group;
  private kikoMat: THREE.MeshPhysicalMaterial; private hat: THREE.Mesh | null = null; private helmet: THREE.Mesh;
  private raft: THREE.Mesh; private pepper: THREE.Mesh; private pepperGold: THREE.Mesh;
  private shadow: THREE.Mesh; private magnetRing: THREE.Mesh; private stars3: THREE.InstancedMesh;
  private pico = new THREE.Group(); private picoWings: THREE.Mesh[] = [];
  private goon = new THREE.Group(); private seed: THREE.Mesh; private greatTree: THREE.Group | null = null;
  private treehouse: THREE.Mesh;
  private parts: Particle[] = []; private partMesh: THREE.InstancedMesh; private streaks: THREE.InstancedMesh;
  private streakData: { x: number; y: number; z: number; v: number }[] = [];
  private wx: THREE.InstancedMesh; private wxData: { x: number; y: number; z: number; p: number }[] = []; private weather: Weather = "none";
  private dummy = new THREE.Object3D(); private col = new THREE.Color();
  private runPh = 0; private squashT = 0; private shakeT = 0; private ySmooth = 0; private lean = 0; private spin = 0; private swingA = 0; private danceT = 0; private yuckT = 0;
  private introT = 0; private attract: boolean; private bendX = 0;
  private pulled = new Set<number>();
  private pending: { n: number; t: number } | null = null;
  private style: RegionStyle = STYLES.grove;
  private glass!: THREE.Material; private glowDim!: THREE.Material; private lavaMat!: THREE.MeshStandardMaterial; private mudMat!: THREE.Material; private snowMat!: THREE.Material; private lavaTex!: THREE.Texture;
  private rideMeshes = new Map<string, THREE.Group>(); private bossMeshes = new Map<string, THREE.Group>(); private chaserMeshes = new Map<string, THREE.Group>();
  private kite!: THREE.Mesh; private zips!: Layer; private rides!: Layer; private flashT = 0; private bolt!: THREE.Mesh; private chaserZ = -12;
  private envRT: THREE.WebGLRenderTarget | null = null;
  /** art / QA: a close 3/4 shot of Kiko */
  photoCam: { d: number; h: number; side: number; dx: number } | null = null;

  constructor(host: HTMLElement, sim: Sim, quality: Quality, attract = false, look: KikoLook = { fur: "kiko", hat: "none", trail: "none" }) {
    this.sim = sim; this.q = quality; this.attract = attract; this.look = look;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1));
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
    this.clouds = new THREE.InstancedMesh(M.cloudPuff(), this.cloudMat, 12);
    this.clouds.frustumCulled = false;
    for (let i = 0; i < 12; i++) {
      const a = -1.2 + (i / 11) * 2.4, r = 260 + hash(i, 3) * 80;
      this.dummy.position.set(Math.sin(a) * r, 46 + hash(i, 4) * 50, -Math.cos(a) * r);
      this.dummy.scale.set(4 + hash(i, 5) * 4, 1.6 + hash(i, 6), 2); this.dummy.rotation.set(0, -a, 0); this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    sc.add(this.clouds);

    const k = <T extends { dispose: () => void }>(x: T) => { this.keep.push(x); return x; };
    this.clay = k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.55 })));
    this.gloss = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.22, envMapIntensity: 1.0 })));
    this.leaf = k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, envMapIntensity: 0.5 })));
    this.canopy = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.78, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color("#C8FFB0"), envMapIntensity: 0.45 })));
    this.glow = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.0, 3.0, 3.0), fog: false })));
    this.glowDim = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.35, 1.35, 1.35) })));
    this.glass = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.82, envMapIntensity: 1.6 })));
    this.lavaTex = k(M.lavaTex(false));
    this.lavaMat = k(bendify(new THREE.MeshStandardMaterial({ map: this.lavaTex, emissiveMap: k(M.lavaTex(true)), emissive: new THREE.Color("#FF7A2A"), emissiveIntensity: 1.6, roughness: 0.6 })));
    this.mudMat = k(bendify(new THREE.MeshPhysicalMaterial({ color: "#6A4A2A", roughness: 0.25, clearcoat: 0.8, envMapIntensity: 0.9 })));
    this.snowMat = k(bendify(new THREE.MeshStandardMaterial({ color: "#F4F8FF", roughness: 0.5, envMapIntensity: 0.6 })));
    this.glowSoft = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.55, depthWrite: false, fog: false })));
    this.rayMat = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true, color: "#FFF4D0", transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })));
    this.waterTex = k(M.waterTex()); this.waterTex.repeat.set(1, 1);
    const glint = k(M.glintTex());
    this.waterMat = k(bendify(new THREE.MeshStandardMaterial({ map: this.waterTex, color: "#9ADFEE", roughness: 0.22, metalness: 0.1, envMapIntensity: 0.75, emissiveMap: glint, emissive: new THREE.Color("#FFF2D8"), emissiveIntensity: 0.7, transparent: true, opacity: 0.95 })));
    const fruitM = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3, sheen: 0.3, sheenColor: new THREE.Color("#FFFFFF") })));
    const goldM = k(bendify(new THREE.MeshPhysicalMaterial({ color: "#FFC21A", metalness: 0.8, roughness: 0.2, clearcoat: 1, envMapIntensity: 1.8, emissive: new THREE.Color("#FFB000"), emissiveIntensity: 0.45 })));
    const bananaM = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.1, emissive: new THREE.Color("#FFB000"), emissiveIntensity: 0.1 })));
    const bubM = k(bendify(new THREE.MeshPhysicalMaterial({ color: "#FFFFFF", roughness: 0.05, transparent: true, opacity: 0.26, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3, envMapIntensity: 2, depthWrite: false })));
    const shM = k(bendify(new THREE.MeshBasicMaterial({ map: k(M.radialTex()), transparent: true, depthWrite: false, color: "#000000", opacity: 0.36 })));
    const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);

    // ---- bananas, fruit and goodies
    const bunch = M.bananaGeo();
    this.bananas = new Layer(sc, [[{ g: bunch, m: bananaM }]], 480);
    const pad = M.padGeo();
    this.items = new Layer(sc, [
      ...FRUIT_ORDER.map((f) => [{ g: M.fruitGeo(f), m: fruitM }]),
      [{ g: (() => { const g = M.bananaGeo(); g.scale(1.7, 1.7, 1.7); return g; })(), m: goldM }],
      [{ g: M.heartFruit(), m: fruitM }],
      [{ g: M.rottenGeo(), m: this.clay }],
      [{ g: M.bubble(), m: bubM }],
      ...POWER_ORDER.map((p) => [{ g: M.powerIcon(p), m: this.gloss }]),
      [{ g: M.pepperGeo(false), m: this.gloss }], [{ g: M.pepperGeo(true), m: goldM }],
      [{ g: pad.g, m: this.gloss }, { g: pad.glow, m: this.glow }],
      [{ g: at(new THREE.TorusGeometry(0.62, 0.04, 6, 28), 0, 0, 0, "#FFE27A"), m: this.glowSoft }],
    ], 40);
    this.shadows = new Layer(sc, [[{ g: shGeo, m: shM }]], 160);
    this.rides = new Layer(sc, RIDE_IDS.map((id) => M2.rideParts(id).map(({ g, mat }) => ({ g, m: this.matOf(mat) }))), 4);
    const fl = M.flagGeo();
    this.flags = new Layer(sc, [[{ g: fl.pole, m: this.gloss }], [{ g: fl.cloth, m: this.leaf }]], 8);
    const gt = M.gateGeo();
    this.gates = new Layer(sc, [[{ g: gt.g, m: this.clay }, { g: gt.glow, m: this.glow }]], 2);
    this.vines = new Layer(sc, [[{ g: M.ropeGeo(), m: this.clay }], [{ g: M.hangVine(), m: this.leaf }], [{ g: at(new THREE.TorusGeometry(0.42, 0.05, 6, 24), 0, 0, 0, "#FFFFFF"), m: this.glow }]], 60, true);

    // ---- obstacles
    const O = this.obs, L = (v: { g: THREE.BufferGeometry; m: THREE.Material }[][], cap: number, c: boolean | "first" = false) => new Layer(this.world, v, cap, c);
    const P = (parts: M2.Parts) => parts.map(({ g, mat }) => ({ g, m: this.matOf(mat) }));
    const G1 = (g: THREE.BufferGeometry) => [{ g, m: this.gloss }];
    O.log = L([G1(M.logGeo(0)), G1(M.logGeo(1)), ...[2, 3, 4, 5, 6].map((v) => P(M2.logSkin(v)))], 40);
    O.thorn = L([G1(M.thornGeo()), G1(M.thornGeo("#3A1E1E", "#FF5A1F", "#FF8A2A")), G1(M.thornGeo("#9FC8D8", "#FFFFFF", "#7AD3FF"))], 30);
    O.shroom = L([G1(M.shroomGeo()), [{ g: M.shroomGeo("#3DE0FF"), m: this.glow }]], 30);
    O.low = L([G1(M.lowGeo(0)), G1(M.lowGeo(1)), G1(M.lowGeo(2)), ...[3, 4, 5, 6].map((v) => P(M2.lowSkin(v)))], 40);
    O.rock = L([G1(M.rockGeo(0)), G1(M.rockGeo(1)), G1(M.rockGeo(2)), ...[3, 4, 5, 6, 7, 8, 9, 10].map((v) => P(M2.rockSkin(v)))], 40);
    O.roller = L([G1(M.rollerGeo(0)), G1(M.rollerGeo(1)), ...[2, 3, 4, 5, 6].map((v) => P(M2.rollerSkin(v)))], 20);
    O.coco = L([G1(M.cocoGeo()), ...[1, 2, 3, 4, 5, 6].map((v) => P(M2.dropSkin(v)))], 24);
    O.peel = L([G1(M.peelGeo())], 20);
    const pit = M.pitGeo();
    const darkM = k(bendify(new THREE.MeshBasicMaterial({ vertexColors: true })));
    O.gap = L([[{ g: pit.g, m: this.clay }, { g: pit.dark, m: darkM }], [{ g: pit.g.clone(), m: this.clay }, { g: pit.dark.clone(), m: darkM }, ...P(M2.propParts("leafPile"))], [{ g: pit.g.clone(), m: this.clay }, { g: pit.dark.clone(), m: this.lavaMat }]], 30);
    O.bounce = L([G1(M.bounceGeo()), [{ g: M.bounceGeo("#3DE0FF", "#2AA8D8", "#C8E8FF"), m: this.gloss }], G1(M.bounceGeo("#9CE05A", "#5E8A2A", "#7AB83A"))], 24);
    O.ramp = L([[{ g: M.rampGeo(), m: this.clay }]], 8);
    O.web = L([P(M2.webParts())], 20);
    const mudG = new THREE.PlaneGeometry(2.0, 1); mudG.rotateX(-Math.PI / 2); mudG.translate(0, 0.025, -0.5);
    O.mud = L([[{ g: mudG, m: this.mudMat }]], 20);
    const iceG = new THREE.PlaneGeometry(2.1, 1); iceG.rotateX(-Math.PI / 2); iceG.translate(0, 0.02, -0.5);
    O.ice = L([[{ g: at(iceG, 0, 0, 0, "#CFF0FF"), m: this.glass }]], 20);
    const gy0 = M2.geyserParts(0), gy1 = M2.geyserParts(1);
    O.geyser = L([[{ g: gy0.base, m: this.gloss }], [{ g: gy0.core, m: this.glow }], [{ g: gy0.jet, m: this.glowSoft }], [{ g: gy1.base, m: this.gloss }], [{ g: gy1.core, m: this.glow }], [{ g: gy1.jet, m: this.glowSoft }]], 20);
    O.gust = L([[{ g: M2.gustParts(), m: this.glowSoft }]], 20);
    const zp = M2.zipParts();
    this.zips = new Layer(sc, [[{ g: zp.post, m: this.gloss }], [{ g: zp.cable, m: this.clay }], [{ g: zp.handle, m: this.gloss }]], 30);
    const bg = M.branchGeo();
    O.branch = L([[{ g: bg.g, m: this.clay }, { g: bg.leaves, m: this.leaf }]], 40);
    // the piece of branch right over Kiko turns see-through, so he never disappears under the branch road
    O.branchGhost = L([[{ g: bg.g.clone(), m: k(bendify(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.8 }))) }]], 6);
    O.snake = L([[{ g: M.snakeGeo(), m: this.gloss }]], 20);
    O.hive = L([[{ g: M.hiveGeo(), m: this.gloss }]], 20);
    O.lily = L([[{ g: M.lilyGeo(false), m: this.gloss }], [{ g: M.lilyGeo(true), m: this.gloss }], [{ g: M.stoneGeo("lava"), m: this.gloss }], [{ g: M.stoneGeo("ice"), m: this.glass }]], 160);
    const bp = M.bridgeParts();
    O.bridge = L([[{ g: bp.plank, m: this.clay }], [{ g: bp.rope, m: this.clay }], [{ g: bp.post, m: this.clay }]], 260);
    const cr = M.crocGeo();
    O.croc = L([[{ g: cr.body, m: this.gloss }], [{ g: cr.jaw, m: this.gloss }]], 20);
    O.flog = L([[{ g: M.logGeo(1), m: this.gloss }]], 20);

    // ---- Kiko
    const rig = M.runnerRig(look), fit = M.RUNNER_FIT[look.runner === "momo" ? "momo" : "kiko"];
    this.kikoMat = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.46, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.95, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color("#FFD2A8") })));
    const km = this.kikoMat;
    this.torso = new THREE.Mesh(rig.torso, km); this.body.add(this.torso);
    this.head = new THREE.Group(); this.head.position.set(0, 0.9, 0); this.head.add(new THREE.Mesh(rig.head, km)); this.body.add(this.head);
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.3, 0.82, 0); a.add(new THREE.Mesh(rig.arm, km)); this.arms.push(a); this.body.add(a);
      const l = new THREE.Group(); l.position.set(sx * 0.14, 0.36, 0); l.add(new THREE.Mesh(rig.leg, km)); this.legs.push(l); this.body.add(l);
    }
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.45, 0.24); this.tail.add(new THREE.Mesh(rig.tail, km)); this.body.add(this.tail);
    const hg = look.hat && look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { this.hat = new THREE.Mesh(hg, this.gloss); this.hat.scale.setScalar(fit.hatS); this.hat.position.set(0, fit.hatY, 0); this.head.add(this.hat); }
    const rb = M.RIBBONS[look.ribbon ?? "none"];
    if (rb) { const bow = new THREE.Mesh(M.ribbonGeo(rb.color, rb.style), this.gloss); bow.position.set(...fit.bow); this.tail.add(bow); }
    const helm = M.powerIcon("helmet"); helm.scale(1.25, 1.25, 1.25);
    this.helmet = new THREE.Mesh(helm, this.gloss); this.helmet.position.set(0, 0.6, 0); this.helmet.visible = false; this.head.add(this.helmet);
    this.kiko.add(this.body);
    this.raft = new THREE.Mesh(M.raftGeo(), this.gloss); this.raft.visible = false; sc.add(this.raft);
    this.pepper = new THREE.Mesh(M.pepperGeo(false), this.gloss); this.pepper.visible = false; this.kiko.add(this.pepper);
    this.pepperGold = new THREE.Mesh(M.pepperGeo(true), goldM); this.pepperGold.visible = false; this.kiko.add(this.pepperGold);
    sc.add(this.kiko);
    this.shadow = new THREE.Mesh(shGeo, shM); this.shadow.renderOrder = 1; sc.add(this.shadow);
    const ring = new THREE.TorusGeometry(1.0, 0.05, 6, 40); ring.rotateX(Math.PI / 2);
    this.magnetRing = new THREE.Mesh(ring, k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 0.9), transparent: true, opacity: 0.8, fog: false }))));
    this.magnetRing.visible = false; sc.add(this.magnetRing);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.05 : 0.12; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    this.stars3 = new THREE.InstancedMesh(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), k(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 0.6), fog: false })), 4);
    this.stars3.frustumCulled = false; this.stars3.count = 0; sc.add(this.stars3);
    const pg = M.pico();
    this.pico.add(new THREE.Mesh(pg.body, this.gloss));
    const wingM = k(bendify(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.8, side: THREE.DoubleSide })));
    for (const sx of [-1, 1]) { const wg = k(pg.wing.clone()); if (sx < 0) wg.scale(-1, 1, 1); const w = new THREE.Mesh(wg, wingM); w.position.set(sx * 0.18, 0.08, 0); this.picoWings.push(w); this.pico.add(w); }
    this.pico.visible = false; sc.add(this.pico);
    this.goon.add(new THREE.Mesh(M.goon(), this.gloss));
    this.seed = new THREE.Mesh(M.seedGeo(), goldM); this.seed.visible = false; sc.add(this.seed);
    this.goon.visible = false; sc.add(this.goon);
    this.treehouse = new THREE.Mesh(M.treehouse(), this.gloss); this.treehouse.visible = false; sc.add(this.treehouse);
    this.kite = new THREE.Mesh(M2.kiteGeo(), this.leaf); this.kite.visible = false; sc.add(this.kite);
    const boltG = new THREE.CylinderGeometry(0.15, 0.4, 60, 5); boltG.translate(0, 30, 0);
    this.bolt = new THREE.Mesh(boltG, k(new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 5), transparent: true, opacity: 0.9, fog: false }))); this.bolt.visible = false; sc.add(this.bolt);

    this.partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.08, 0), k(bendify(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), fog: false }))), 520);
    this.partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1560), 3);
    this.partMesh.frustumCulled = false; this.partMesh.count = 0; sc.add(this.partMesh);
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 1.6), k(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.5, fog: false })), 60);
    this.streaks.frustumCulled = false; this.streaks.count = 0; sc.add(this.streaks);
    for (let i = 0; i < 60; i++) this.streakData.push({ x: 0, y: 0, z: 99, v: 0 });
    this.wx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.12), k(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.9, fog: false, side: THREE.DoubleSide })), 150);
    this.wx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(450).fill(1), 3);
    this.wx.frustumCulled = false; this.wx.count = 0; sc.add(this.wx);
    for (let i = 0; i < 150; i++) this.wxData.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 14, z: -Math.random() * 60, p: Math.random() * 6 });

    if (quality !== "low") {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(sc, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.setRegion(sim.sec);
    this.introT = attract ? 0 : 2.4;
  }

  // ------------------------------------------------------------------ regions
  private matOf(m: M2.Mat): THREE.Material {
    return m === "clay" ? this.clay : m === "leaf" ? this.leaf : m === "canopy" ? this.canopy : m === "glow" ? this.glowDim : m === "glass" ? this.glass : this.gloss;
  }
  /** a tree, plant or prop of any region, as layer parts */
  private partsOf(kind: string, v: number): { g: THREE.BufferGeometry; m: THREE.Material }[] {
    const P = (parts: M2.Parts) => parts.map(({ g, mat }) => ({ g, m: this.matOf(mat) }));
    if (kind.startsWith("flowers:")) return [{ g: M.flowerBush(kind.slice(8)), m: this.gloss }];
    switch (kind) {
      case "jungle": { const t = M.bigTree(v); return [{ g: t.trunk, m: this.clay }, { g: t.leaves, m: this.canopy }]; }
      case "banana": return [{ g: M.bananaPlant(v), m: this.leaf }];
      case "palm": return [{ g: M.palm(v), m: this.leaf }];
      case "mango": return [{ g: M.mangoTree(v), m: this.canopy }];
      case "fern": return [{ g: M.fern(v), m: this.leaf }];
      case "mossRock": return [{ g: M.mossRock(v), m: this.gloss }];
      case "grass": return [{ g: M.grass(), m: this.leaf }];
      case "reeds": return [{ g: M.reeds(), m: this.leaf }];
      case "dock": return [{ g: M.dockPost(), m: this.gloss }];
      case "lilyFlower": return [{ g: M.lilyGeo(true), m: this.gloss }];
      case "blossomTree": return P(M2.treeParts("blossom", v));
      default: { const t = M2.treeParts(kind, v); return t.length ? P(t) : P(M2.propParts(kind, v)); }
    }
  }
  /** build the forest of a region (and its sky for this place's time of day) */
  setRegion(sec: Section) {
    this.sec = sec;
    if (this.rl) {
      const o = this.rl;
      [o.strips, o.trees, o.leaves, o.plants, o.near, o.far, o.glowFar, o.rays, o.hang, o.zone, o.zoneGlow, o.arches].forEach((l) => l.dispose());
      o.water.forEach((w) => { w.geometry.dispose(); w.removeFromParent(); });
      this.rkeep.forEach((d) => d.dispose()); this.rkeep = [];
    }
    this.region = sec.scene;
    const st = (this.style = STYLES[sec.scene] ?? STYLES.grove);
    this.applySky(sec);
    const k = <T extends { dispose: () => void }>(x: T) => { this.rkeep.push(x); return x; };
    // ---- the path in 2 m strips (left ground, the path, right ground)
    const S = 2, PW = 8.4;
    const pathM = k(bendify(new THREE.MeshStandardMaterial({ map: k(M.pathTex(st.path)), roughness: st.path.planks ? 0.75 : 0.92, envMapIntensity: 0.4 })));
    const sideM = k(bendify(new THREE.MeshStandardMaterial({ map: k(M.grassTex(st.ground)), roughness: 0.95, envMapIntensity: 0.35 })));
    const strip = (w: number, x: number, u: number, v: number) => { const g = new THREE.PlaneGeometry(w, S); g.rotateX(-Math.PI / 2); g.translate(x, 0, -S / 2); scaleUV(g, u, v); return g; };
    const path = strip(PW, 0, 1, S / 8);
    const sideL = strip(44, -(22 + PW / 2), 5, S / 8); sideL.translate(0, -0.02, 0);
    const sideR = strip(44, 22 + PW / 2, 5, S / 8); sideR.translate(0, -0.02, 0);
    const edge = merge2([at(new THREE.BoxGeometry(0.5, 0.25, S), -PW / 2 - 0.1, 0.02, -S / 2, st.path.edge), at(new THREE.BoxGeometry(0.5, 0.25, S), PW / 2 + 0.1, 0.02, -S / 2, st.path.edge)]);
    const stripParts: { g: THREE.BufferGeometry; m: THREE.Material }[] = [{ g: path, m: pathM }, { g: edge, m: this.clay }];
    if (st.water !== "both") stripParts.push({ g: sideR, m: sideM });
    if (st.water === "none") stripParts.push({ g: sideL, m: sideM });
    if (st.path.planks) { const posts = merge2([-PW / 2 - 0.1, PW / 2 + 0.1].map((x) => at(new THREE.CylinderGeometry(0.14, 0.16, 2.4, 8), x, -1.1, -1, st.path.edge))); stripParts.push({ g: posts, m: this.clay }); }
    const rl: RL = { strips: new Layer(this.world, [stripParts], 150), trees: null!, leaves: null!, plants: null!, near: null!, far: null!, glowFar: null!, rays: null!, hang: null!, zone: null!, zoneGlow: null!, water: [], arches: null! };
    const sides = st.water === "both" ? [-1, 1] : st.water === "left" ? [-1] : [];
    for (const sx of sides) {
      const g = new THREE.PlaneGeometry(500, 700); g.rotateX(-Math.PI / 2); g.translate(sx * (250 + PW / 2 + 0.2), -0.32, -300); scaleUV(g, 30, 42);
      const mesh = new THREE.Mesh(g, st.lava ? this.lavaMat : this.waterMat); mesh.frustumCulled = false; this.world.add(mesh); rl.water.push(mesh);
    }
    // ---- big trees (trunks + canopies), plants, near props, far landmarks
    const treeVariants = st.trees.map((kind, v) => this.partsOf(kind, v));
    const trunkOf = treeVariants.map((parts) => parts.filter((x) => x.m !== this.canopy));
    const leafOf = treeVariants.map((parts) => parts.filter((x) => x.m === this.canopy));
    rl.trees = new Layer(this.world, trunkOf.map((p) => (p.length ? p : [{ g: M.none(), m: this.clay }])), 60);
    rl.leaves = new Layer(this.world, leafOf.map((p) => (p.length ? p : [{ g: M.none(), m: this.clay }])), 60);
    rl.plants = new Layer(this.world, st.plants.map((kind, v) => this.partsOf(kind, v)), 80);
    rl.near = new Layer(this.world, st.near.map((kind, v) => this.partsOf(kind, v % 2)), 200);
    const wf = M.waterfall();
    const farVariants: { g: THREE.BufferGeometry; m: THREE.Material }[][] = [[{ g: M.hill(), m: this.clay }], [{ g: wf.g, m: this.clay }], [{ g: M.palm(2), m: this.leaf }]];
    for (const kind of ["mountain", "volcano", "mesa", "pinesFar"]) farVariants.push(M2.farParts(kind).map(({ g, mat }) => ({ g, m: this.matOf(mat) })));
    const ft = M.bigTree(2); farVariants.push([{ g: ft.trunk, m: this.clay }, { g: ft.leaves, m: this.clay }]);
    rl.far = new Layer(this.world, farVariants, 60, "first");
    rl.glowFar = new Layer(this.world, [[{ g: wf.glow, m: this.glowSoft }]], 6);
    rl.rays = new Layer(this.world, [[{ g: M.rayGeo(), m: this.rayMat }]], 24);
    rl.hang = new Layer(this.world, [[{ g: M.hangVine(), m: this.leaf }]], 60);
    // ---- caves: rock arches over the path, with crystals and stalactites
    const arch = new THREE.TorusGeometry(7.5, 1.6, 8, 24, Math.PI); arch.scale(1, 1.15, 1);
    const archParts: THREE.BufferGeometry[] = [at(arch, 0, 0, 0, "#2E2440")];
    for (let i = 0; i < 7; i++) { const c = new THREE.ConeGeometry(0.35, 1.6 + (i % 3) * 0.6, 6); c.rotateX(Math.PI); c.translate(-5 + i * 1.7, 7.4 - (i % 2) * 0.4, 0); archParts.push(at(c, 0, 0, 0, "#3A3050")); }
    const archGlow = merge2([0, 1, 2, 3].map((i) => at(new THREE.CylinderGeometry(0.18, 0.28, 1.2, 6), -6 + i * 4, 6 + (i % 2), 0.6, ["#3DE0FF", "#B58CFF"][i % 2])));
    rl.arches = new Layer(this.world, [[{ g: merge2(archParts), m: this.clay }, { g: archGlow, m: this.glow }]], 20);
    // ---- chasms, rivers, lava and slides across the path
    const cliffM = k(bendify(new THREE.MeshStandardMaterial({ map: k(M.cliffTex()), roughness: 0.95, side: THREE.DoubleSide })));
    const wall = new THREE.PlaneGeometry(100, 16); wall.translate(0, -8, 0);
    const bottom = new THREE.PlaneGeometry(100, 1); bottom.rotateX(-Math.PI / 2); bottom.translate(0, -15, -0.5);
    const lip = merge2([at(new THREE.BoxGeometry(100, 0.5, 0.7), 0, -0.2, 0, st.path.edge)]);
    const water = new THREE.PlaneGeometry(100, 1); water.rotateX(-Math.PI / 2); water.translate(0, -0.3, -0.5);
    const lava = water.clone();
    const slide = new THREE.PlaneGeometry(8.4, 1); slide.rotateX(-Math.PI / 2); slide.translate(0, -0.02, -0.5);
    const bank = merge2([at(new THREE.BoxGeometry(100, 0.5, 1.2), 0, -0.25, 0, st.lava ? "#2A2220" : "#D9BE8A")]);
    const dock = merge2([at(new THREE.BoxGeometry(7.6, 0.18, 3), 0, 0.05, -1.5, "#B9774A"), ...[-3.5, 3.5].map((x) => at(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 8), x, -0.3, -2.8, "#6B4226"))]);
    const anchor = merge2([at(new THREE.CylinderGeometry(0.35, 0.45, 8.2, 10).rotateZ(Math.PI / 2), 0, 10.6, 0, "#6B4226")]);
    const slideWalls = merge2([-4.3, 4.3].map((x) => at(new THREE.BoxGeometry(0.35, 0.7, 1), x, 0.2, -0.5, "#8A6A4A")));
    rl.zone = new Layer(this.world, [
      [{ g: wall, m: cliffM }], [{ g: bottom, m: k(bendify(new THREE.MeshBasicMaterial({ color: "#0A0604" }))) }], [{ g: lip, m: this.clay }],
      [{ g: water, m: this.waterMat }], [{ g: bank, m: this.clay }], [{ g: dock, m: this.clay }], [{ g: anchor, m: this.clay }],
      [{ g: lava, m: this.lavaMat }], [{ g: slide, m: this.mudMat }], [{ g: slide.clone(), m: this.snowMat }], [{ g: slideWalls, m: this.gloss }],
    ], 30);
    const mist = new THREE.PlaneGeometry(100, 1); mist.rotateX(-Math.PI / 2); mist.translate(0, -3, -0.5);
    rl.zoneGlow = new Layer(this.world, [[{ g: mist, m: k(bendify(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.22, depthWrite: false }))) }]], 10);
    this.rl = rl;
  }
  private applySky(sec: Section) {
    const th0 = THEMES[sec.tod], th: Theme = { ...th0 };
    if (sec.weather === "mist") { th.fogNear = 12; th.fogFar = 105; th.fog = sec.tod === "night" ? "#2A3A6A" : "#E2EEE8"; }
    if (sec.weather === "rain") { th.keyI *= 0.7; th.rays = 0; th.fogNear *= 0.6; th.fogFar *= 0.75; th.sky = [mul(th.sky[0], 0.7), mul(th.sky[1], 0.75), mul(th.sky[2], 0.8)]; }
    if (sec.weather === "storm") { th.keyI *= 0.55; th.rays = 0; th.fogNear *= 0.55; th.fogFar *= 0.7; th.sky = [mul(th.sky[0], 0.5), mul(th.sky[1], 0.55), mul(th.sky[2], 0.6)]; th.fog = mul(th.fog, 0.6); }
    if (sec.weather === "snow") { th.fog = "#E8F0FA"; th.fogNear *= 0.7; th.rays = 0; }
    if (sec.weather === "ash") { th.fog = sec.tod === "night" ? "#2A1A1A" : "#8A5A4A"; th.fogNear *= 0.6; th.fogFar *= 0.75; th.sky = [mul(th.sky[0], 0.6), "#C86A4A", "#E8945A"]; th.rays = 0; }
    if (sec.weather === "dust") { th.fog = "#E8C08A"; th.fogNear *= 0.6; th.fogFar *= 0.8; }
    const wet = STYLES[sec.scene]?.water !== "none" && sec.scene !== "volcano";
    if (wet) th.fog = new THREE.Color(th.fog).lerp(new THREE.Color("#9FD8E8"), sec.tod === "night" || sec.tod === "cave" ? 0.1 : 0.3).getStyle();
    this.th = th;
    this.skyMat.uniforms.top.value.set(th.sky[0]); this.skyMat.uniforms.mid.value.set(th.sky[1]); this.skyMat.uniforms.bot.value.set(th.sky[2]);
    this.skyMat.uniforms.sun.value.set(th.sun); (this.skyMat.uniforms.sunDir.value as THREE.Vector3).set(...th.sunDir).normalize();
    this.scene.background = new THREE.Color(th.sky[2]);
    const f = this.scene.fog as THREE.Fog; f.color.set(th.fog); f.near = th.fogNear; f.far = th.fogFar;
    this.hemi.color.set(th.hemiSky); this.hemi.groundColor.set(th.hemiGround); this.hemi.intensity = th.hemiI;
    this.key.color.set(th.key); this.key.intensity = th.keyI; this.key.position.set(th.sunDir[0] * 10, 8, -6);
    this.rim.color.set(th.rim); this.rim.intensity = th.rimI;
    this.renderer.toneMappingExposure = th.exposure;
    if (this.bloom) { this.bloom.strength = th.bloom; this.bloom.threshold = sec.tod === "night" ? 0.84 : sec.tod === "cave" ? 0.9 : 0.93; }
    this.stars.visible = th.stars;
    this.cloudMat.color.set(sec.tod === "night" ? "#3A4A8A" : sec.tod === "sunset" ? "#FFC8A8" : "#FFFFFF");
    this.clouds.visible = sec.tod !== "cave";
    this.cloudMat.emissive.set(sec.tod === "sunset" ? "#FF9A6A" : "#FFFFFF"); this.cloudMat.emissiveIntensity = sec.tod === "night" ? 0.05 : 0.25;
    this.waterMat.color.set(sec.tod === "night" || sec.tod === "cave" ? "#4A6AAF" : sec.tod === "sunset" ? "#E8B890" : (STYLES[sec.scene]?.waterColor ?? "#9ADFEE"));
    this.rayMat.opacity = th.rays;
    this.envRT?.dispose();
    this.scene.environment = this.makeEnv(th);
    this.weather = sec.weather;
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
    const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.sun).multiplyScalar(6) }));
    sun.position.copy(sd.multiplyScalar(40)); es.add(sun);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(["#7CFF6B", "#FFD23F", "#FF8FC7"][i % 3]).multiplyScalar(1.4) }));
      l.position.set(Math.cos(i * 1.3) * 35, 6 + (i % 3) * 5, Math.sin(i * 1.3) * 35); es.add(l);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(es, 0.03);
    pm.dispose();
    es.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
    this.envRT = rt;
    return rt.texture;
  }

  // ------------------------------------------------------------------ per frame
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
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
  kikoScreen(dy = 1.5): [number, number] { return this.screen(this.sim.x, this.sim.y + dy, this.sim.z); }
  /** how far ahead the forest is drawn: up to the next region gate */
  private limit() {
    for (const r of this.sim.track.regions) if (r.z > this.sim.z + 1) return r.z;
    return Infinity;
  }

  update(dt: number, ev: SimEvent[]) {
    this.t += dt;
    const s = this.sim, pz = s.z;
    if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
    this.events(ev);
    if (this.pending && (this.pending.t -= dt) <= 0) { this.setRegion(sectionOf(this.pending.n)); this.pending = null; }
    this.bendX = Math.sin(pz / 140) * 0.0011 + Math.sin(pz / 57) * 0.0004;
    BEND.value.set(0.0016, this.bendX);
    const R = (z: number) => -(z - pz);
    const lim = this.limit();
    this.waterTex.offset.set((this.t * 0.02) % 1, (-pz / 12) % 1);
    for (const w of this.rl.water) w.position.z = pz % 12.5;
    this.ground(pz, R, lim);
    this.scenery(pz, R, lim);
    this.obstacles(pz, R, lim);
    this.pickups(pz, R, lim);
    this.characters(dt, R);
    this.effects(dt);
    this.weatherFx(dt);
    this.cameraMove(dt);
  }

  /** the path strips (skipping chasms, rivers and lava), the zones themselves, and the cave arches */
  private ground(pz: number, R: (z: number) => number, lim: number) {
    const rl = this.rl, tr = this.sim.track;
    rl.strips.begin(); rl.zone.begin(); rl.zoneGlow.begin(); rl.arches.begin();
    const z0 = Math.floor((pz - 16) / 2) * 2;
    let zi = 0;
    const zones = tr.zones;
    for (let z = z0; z < pz + 250 && z < lim; z += 2) {
      while (zi < zones.length && zones[zi].z1 < z) zi++;
      const zn = zones[zi];
      if (zn && z + 1 > zn.z0 && z + 1 < zn.z1 && !(zn.slide && zn.slide !== "water")) continue;
      rl.strips.put(0, 0, 0, R(z));
    }
    for (const zn of zones) {
      if (zn.z1 < pz - 20 || zn.z0 > pz + 250 || zn.z0 > lim) continue;
      const len = zn.z1 - zn.z0;
      if (zn.kind === "chasm") {
        rl.zone.put(0, 0, 0, R(zn.z1));
        rl.zone.put(0, 0, 0, R(zn.z0), Math.PI);
        rl.zone.put(1, 0, 0, R(zn.z0), 0, [1, 1, len]);
        rl.zone.put(2, 0, 0, R(zn.z0)); rl.zone.put(2, 0, 0, R(zn.z1));
        rl.zoneGlow.put(0, 0, 0, R(zn.z0), 0, [1, 1, len]);
      } else if (zn.slide === "mud" || zn.slide === "snow") {
        rl.zone.put(zn.slide === "mud" ? 8 : 9, 0, 0, R(zn.z0), 0, [1, 1, len]);
        rl.zone.put(10, 0, 0, R(zn.z0), 0, [1, 1, len]);
      } else {
        rl.zone.put(zn.kind === "lava" ? 7 : 3, 0, 0, R(zn.z0 - 0.3), 0, [1, 1, len + 0.6]);
        rl.zone.put(4, 0, 0, R(zn.z0)); rl.zone.put(4, 0, 0, R(zn.z1), Math.PI);
        if (zn.raft && !zn.slide) rl.zone.put(5, 0, 0, R(zn.z0 - 1));
        if (zn.slide) rl.zone.put(10, 0, 0, R(zn.z0), 0, [1, 1, len]);
      }
    }
    // vine anchors: a big branch high over each chasm with vines (ziplines have their own posts)
    for (const v of tr.vines) if (!v.zip && v.z > pz - 30 && v.z < pz + 200 && v.z < lim) rl.zone.put(6, v.lane * LW, 0, R(v.z + v.len * 0.45), 0, [1.0, 1, 1]);
    if (this.style.tunnel) for (let i = Math.floor((pz - 20) / 14); i < (pz + 200) / 14; i++) if (i * 14 < lim) rl.arches.put(0, 0, 0, R(i * 14), 0, [1, 1, 1 + hash(i, 3) * 0.6]);
    rl.strips.end(); rl.zone.end(); rl.zoneGlow.end(); rl.arches.end();
  }

  private scenery(pz: number, R: (z: number) => number, lim: number) {
    const rl = this.rl, st = this.style;
    rl.trees.begin(); rl.leaves.begin(); rl.plants.begin(); rl.near.begin(); rl.far.begin(); rl.glowFar.begin(); rl.rays.begin(); rl.hang.begin();
    const TS = 11, wetL = st.water !== "none", wetR = st.water === "both";
    for (let i = Math.floor((pz - 24) / TS); i < (pz + 210) / TS; i++) {
      const z = i * TS + hash(i, 1) * 4;
      if (z > lim) break;
      for (const sx of [-1, 1]) {
        if ((sx < 0 && wetL && st.water === "left") || (st.treeSides === "right" && sx < 0)) continue;
        const k = i * 2 + (sx > 0 ? 1 : 0);
        if (hash(k, 2) < 0.18) continue;
        const v = Math.floor(hash(k, 3) * 3), x = sx * (st.treeX + hash(k, 4) * 4.5), ry = sx > 0 ? Math.PI + (hash(k, 5) - 0.5) * 0.5 : (hash(k, 5) - 0.5) * 0.5;
        const s = (0.85 + hash(k, 6) * 0.35) * st.treeScale, y = st.treeY + (wetR || (sx < 0 && wetL) ? -0.3 : 0);
        rl.trees.put(v, x, y, R(z), ry, s);
        rl.leaves.put(v, x, y, R(z), ry, s);
        if (st.hang && st.trees[v] === "jungle" && hash(k, 7) < 0.6) for (let j = 0; j < 2; j++) rl.hang.put(0, x - sx * (3.5 + j * 1.6), (13 + v * 2.5) * s - 3.2 + st.treeY, R(z + j * 1.5), 0, [1, 3 + hash(k, 8 + j) * 3.5, 1]);
      }
      if (st.water === "left") { const k = i * 2; rl.far.put(7, -(40 + hash(k, 9) * 30), 0, R(z), hash(k, 3) * 6, 1.2 + hash(k, 4) * 0.5); }
    }
    for (let i = Math.floor((pz - 20) / 7); i < (pz + 170) / 7; i++) {
      const z = i * 7 + hash(i, 11) * 3;
      if (z > lim) break;
      for (const sx of [-1, 1]) {
        const k = i * 2 + (sx > 0 ? 1 : 0), h = hash(k, 12);
        const water = sx < 0 ? wetL : wetR;
        if (water) { if (h < 0.3) rl.plants.put(0, sx * (6.0 + hash(k, 14) * 2.5), -0.3, R(z), hash(k, 15) * 6, 0.8); continue; }
        if (h < 0.45) rl.plants.put(Math.floor(hash(k, 13) * 2), sx * (6.3 + hash(k, 14) * 2.5), st.treeY ? -0.4 : 0, R(z), hash(k, 15) * 6, 0.9 + hash(k, 16) * 0.4);
        else if (h < 0.62) rl.plants.put(2 + Math.floor(hash(k, 13) * 2), sx * (12 + hash(k, 14) * 8), 0, R(z), hash(k, 15) * 6, st.plants[2] === "maple" || st.plants[2] === "acacia" || st.plants[2] === "dead" || st.plants[2] === "pine" || st.plants[2] === "mangrove" || st.plants[2] === "blossomTree" ? 0.55 : 1);
      }
    }
    for (let i = Math.floor((pz - 16) / 2.6); i < (pz + 130) / 2.6; i++) {
      const z = i * 2.6 + hash(i, 21) * 1.5;
      if (z > lim) break;
      for (const sx of [-1, 1]) {
        const k = i * 2 + (sx > 0 ? 1 : 0), h = hash(k, 22);
        const water = sx < 0 ? wetL : wetR;
        if (water) {
          // the water side: reeds, lily pads and posts
          if (st.lava) { if (h < 0.15) rl.near.put(0, sx * (5 + hash(k, 23) * 6), -0.3, R(z), hash(k, 24) * 6, 0.8); continue; }
          if (h < 0.35) rl.near.put(st.near.indexOf("reeds") >= 0 ? st.near.indexOf("reeds") : 7, sx * (4.9 + hash(k, 23) * 1.2), -0.3, R(z), hash(k, 24) * 6, 0.9 + hash(k, 25) * 0.4);
          continue;
        }
        if (h > 0.8) continue;
        const v = Math.min(st.near.length - 1, Math.floor(h * 1.25 * st.near.length));
        rl.near.put(v, sx * (4.75 + hash(k, 23) * 1.6), 0, R(z), hash(k, 24) * 6, 0.8 + hash(k, 25) * 0.5);
      }
    }
    // god rays through the canopy
    if (this.th.rays > 0 && !st.tunnel) for (let i = Math.floor((pz - 10) / 23); i < (pz + 150) / 23; i++) {
      const z = i * 23 + hash(i, 31) * 10;
      if (z > lim || hash(i, 32) < 0.35) continue;
      const x = (hash(i, 33) - 0.5) * 9;
      rl.rays.put(0, x, 15, R(z), 0.4 + hash(i, 34) * 0.4, [2.2 + hash(i, 35) * 2.5, 16, 1], undefined, 0, 0.32 * (x > 0 ? -1 : 1));
    }
    // far: hills, mountains, volcanoes, mesas, waterfalls
    const FAR: Record<string, number> = { hill: 0, waterfall: 1, palm: 2, mountain: 3, volcano: 4, mesa: 5, pinesFar: 6 };
    if (!st.tunnel) for (let i = Math.floor((pz - 60) / 70); i < (pz + 520) / 70; i++) for (const sx of [-1, 1]) {
      const k = i * 2 + (sx > 0 ? 1 : 0), h = hash(k, 41);
      const z = i * 70 + h * 40;
      if (z > lim + 260) continue;
      this.col.set(st.hillColor);
      rl.far.put(0, sx * (70 + h * 60), -2, R(z), 0, [30 + h * 25, 20 + hash(k, 42) * 18, 30 + h * 20], this.col);
      const kind = st.far[Math.floor(hash(k, 43) * st.far.length)], fv = FAR[kind] ?? 0;
      if (hash(k, 44) < 0.35 && fv !== 0) {
        if (fv === 1) { if (!(st.water !== "none" && sx < 0)) { rl.far.put(1, sx * (58 + h * 20), -1, R(z + 20), sx > 0 ? -0.5 : 0.5, 1); rl.glowFar.put(0, sx * (58 + h * 20), -1, R(z + 20), sx > 0 ? -0.5 : 0.5, 1); } }
        else if (fv === 2 || fv === 6) rl.far.put(fv, sx * (24 + h * 14), 0, R(z + 35), h * 6, fv === 6 ? 8 : 1.3);
        else rl.far.put(fv, sx * (90 + h * 50), -1, R(z + 30), h * 6, fv === 3 ? [55, 60 + h * 30, 55] : fv === 4 ? [60, 45, 60] : [40, 25, 40]);
      }
    }
    rl.trees.end(); rl.leaves.end(); rl.plants.end(); rl.near.end(); rl.far.end(); rl.glowFar.end(); rl.rays.end(); rl.hang.end();
    // Kiko's Treehouse at the very start
    const th = this.sim.spec.start === 1 && pz < 120;
    this.treehouse.visible = th;
    if (th) this.treehouse.position.set(-11, 0, R(-2));
  }

  private obstacles(pz: number, R: (z: number) => number, lim: number) {
    const O = this.obs, s = this.sim, t = this.t, st = this.style;
    const skin = (kind: keyof RegionStyle["skins"], id: number) => { const a = st.skins[kind] ?? [0]; return a[(id * 7 + 3) % a.length]; };
    for (const key of Object.keys(O)) O[key].begin();
    this.shadows.begin(); this.vines.begin(); this.zips.begin();
    const obs = s.track.obs;
    let lo = 0, hi = obs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].z < pz - 40) lo = m + 1; else hi = m; }
    for (let i = lo; i < obs.length && obs[i].z < pz + 210; i++) {
      const o = obs[i];
      if (o.smashed) continue;
      const cz = obZ(o, pz);
      if (cz > pz + 210 || cz + o.len < pz - 16 || cz > lim - 1) continue;
      const x = o.lane * LW, z = R(cz);
      let shadow = true;
      switch (o.kind) {
        case "log": O.log.put(skin("log", o.id), x, 0, z); break;
        case "thorn": O.thorn.put(skin("thorn", o.id), x, 0, z); break;
        case "shroom": O.shroom.put(skin("shroom", o.id), x, 0, z); break;
        case "low": O.low.put(o.v === 1 ? 1 : o.v === 2 && (st.skins.low ?? [0]).includes(2) ? 2 : skin("low", o.id), x, 0, z); shadow = false; break;
        case "rock": { const v = o.v === 1 ? 1 : skin("rock", o.id); O.rock.put(v, x, o.v === 1 ? -0.35 : 0, z); break; }
        case "roller": O.roller.put(skin("roller", o.id), x, 0.55, z - 0.65, 0, 1, undefined, (pz - o.z) * 1.4); break;
        case "web": O.web.put(0, x, 0, z); shadow = false; break;
        case "mud": O.mud.put(0, x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "ice": O.ice.put(0, x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "gust": for (const sx of [-0.5, 0.5]) O.gust.put(0, x + sx + Math.sin(t * 3 + o.id) * 0.3, 0, z - o.len / 2, t * 4 * (o.dir ?? 1), 1); shadow = false; break;
        case "geyser": {
          const lk = (st.skins.geyserLook ?? [1])[0] ? 3 : 0, on = geyserOn(o, t), warn = geyserWarn(o, t);
          O.geyser.put(lk, x, 0, z);
          O.geyser.put(lk + 1, x, 0, z, 0, on || warn ? [1, 1 + (on ? 0 : Math.abs(Math.sin(t * 30)) * 3), 1] : [0.4, 1, 0.4]);
          if (on) O.geyser.put(lk + 2, x, 0, z, t * 3, [1, 0.85 + Math.sin(t * 25) * 0.15, 1]);
          shadow = false;
          break;
        }
        case "coco": {
          // the coconut drops when Kiko gets close (the shadow shows where)
          const d = cz - pz, drop = Math.max(0, Math.min(1, (s.speed * 1.25 - d) / (s.speed * 0.5)));
          const y = 9 * (1 - drop * drop);
          O.coco.put(skin("coco", o.id), x, 0.32 + y, z - 0.35, drop * 6);
          this.shadows.put(0, x, 0.03, z - 0.35, 0, 0.8 + drop * 0.8);
          shadow = false;
          break;
        }
        case "peel": O.peel.put(0, x, 0, z, o.id); shadow = false; break;
        case "gap": O.gap.put(skin("gapLook", o.id), x, 0, z, 0, [1, 1, o.len]); shadow = false; break;
        case "bounce": {
          const sq = s.lastBounce.id === o.id ? Math.max(0, 1 - (s.t - s.lastBounce.t) / 0.35) : 0;
          O.bounce.put(skin("bounce", o.id), x, 0, z, 0, [1 + sq * 0.25, 1 - sq * 0.45 + Math.sin(t * 4 + o.id) * 0.03, 1 + sq * 0.25]);
          break;
        }
        case "ramp": O.ramp.put(0, x, 0, z, 0, [1, BR_H, o.len]); shadow = false; break;
        case "branch": {
          const over = s.y < BR_H - 0.6 && Math.abs(x - s.x) < 1.6 && cz < pz + 14 && cz + o.len > pz - 6;
          (over ? O.branchGhost : O.branch).put(0, x, BR_H, z, 0, [1, 1, o.len]);
          // thick vines hold the branch up from the canopy (on the outer side only, so they never cross the view)
          if (o.lane !== 0 && (o.id % 2) === 0) this.vines.put(0, x + o.lane * 0.85, BR_H, z - o.len * 0.5, 0, [1.6, 10, 1.6], this.col.set("#4E8A32"));
          this.shadows.put(0, x, 0.03, z - o.len / 2, 0, [2.0, 1, o.len]);
          shadow = false;
          break;
        }
        case "snake": O.snake.put(0, x, o.y, z, Math.sin(t * 2.5 + o.id) * 0.4); shadow = false; break;
        case "hive": O.hive.put(0, x + Math.sin(t * 1.7 + o.id) * 0.05, o.y, z); shadow = false; if (Math.random() < 0.15) this.burst(x + (Math.random() - 0.5), o.y + 1.4, cz + 0.3, 1, "#FFD23F", 1.2, 0.35, 0.5, 0); break;
        case "lily": {
          for (let zz = 0.8; zz < o.len - 0.4; zz += 1.65) { const k = o.id * 31 + Math.floor(zz); const lv = o.v === 2 ? 2 : this.region === "snow" ? 3 : hash(k, 1) < 0.2 ? 1 : 0; O.lily.put(lv, x + (hash(k, 2) - 0.5) * 0.3, PAD_H.lily! - 0.04 + (lv < 2 ? Math.sin(t * 2 + zz) * 0.02 : 0), z - zz, hash(k, 3) * 6, 1); }
          shadow = false;
          break;
        }
        case "bridge": {
          const sway = Math.sin(t * 1.6 + o.id) * 0.03;
          for (let zz = 0.25; zz < o.len; zz += 0.5) {
            // a collapsing bridge: the planks behind Kiko fall away
            const behind = o.v === 9 ? pz - (cz + zz) - 1.5 : 0;
            if (behind > 14) continue;
            const fall = behind > 0 ? behind * behind * 0.12 : 0;
            O.bridge.put(0, x + (behind > 0 ? Math.sin(zz * 9) * behind * 0.05 : 0), sway * Math.sin((zz / o.len) * Math.PI) - fall, z - zz, (hash(o.id * 7 + Math.floor(zz * 2), 1) - 0.5) * 0.08 + behind * 0.08 * Math.sin(zz * 5));
          }
          O.bridge.put(1, x, 0, z, 0, [1, 1, o.len]);
          O.bridge.put(2, x - 1.12, 0, z); O.bridge.put(2, x + 1.12, 0, z); O.bridge.put(2, x - 1.12, 0, z - o.len); O.bridge.put(2, x + 1.12, 0, z - o.len);
          shadow = false;
          break;
        }
        case "croc": {
          const bob = Math.sin(t * 2 + o.id) * 0.05, snap = Math.max(0, Math.sin(t * 3.2 + o.id));
          O.croc.put(0, x, -0.1 + bob, z - 0.75); O.croc.put(1, x, 0.08 + bob, z - 0.75 + 0.28, 0, 1, undefined, snap * 0.5);
          shadow = false;
          break;
        }
        case "flog": O.flog.put(0, x, -0.22 + Math.sin(t * 2 + o.id) * 0.05, z, 0, 1, undefined, 0, Math.sin(t * 1.3 + o.id) * 0.05); shadow = false; break;
      }
      if (shadow) this.shadows.put(0, x, 0.03, z - o.len / 2, 0, [2.0, 1, Math.max(1.1, o.len + 0.7)]);
    }
    // vines over chasms (the one Kiko swings on follows his hands)
    for (const v of s.track.vines) {
      if (v.z < pz - 50 || v.z > pz + 200 || v.z > lim) continue;
      if (v.zip) {
        const x = v.lane * LW, zA = v.z + 1.0, zB = v.z + v.len - 1.5, yA = 4.95, yB = 2.75;
        const dz = zB - zA, dy = yB - yA, len = Math.hypot(dz, dy);
        this.zips.put(0, x, 0, R(zA - 1.2)); this.zips.put(0, x, 0, R(zB + 1.2), 0, [1, 0.6, 1]);
        this.zips.put(1, x, yA, R(zA), 0, [1, 1, len], undefined, Math.asin(dy / len));
        let hz = v.z + 0.5, hy = yA - 0.05, hx = x;
        if (s.swing?.v === v) { hz = s.z; hy = s.y + 2.2; hx = s.x; }
        else if (v.used || s.z > v.z + 0.6) { hz = zB; hy = yB - 0.05; }
        this.zips.put(2, hx, hy, R(hz));
        if (!v.used && !s.swing && v.z - s.z < 14 && v.z - s.z > -1) {
          const near = s.vineNear() === v;
          this.vines.put(2, hx, hy - 0.9, R(hz), 0, near ? 1.25 + Math.sin(this.t * 14) * 0.12 : 0.9, this.col.set(near ? "#7CFF6B" : "#FFFFFF"));
        }
        continue;
      }
      const ax = v.lane * LW, ay = 10.4, az = v.z + v.len * 0.45;
      let bx = ax, by = 2.3, bz = v.z + Math.sin(this.t * 1.6 + v.id) * 0.4;
      if (s.swing?.v === v) { bx = s.x; by = s.y + 1.3; bz = s.z; }
      else if (v.used || s.z > v.z + 0.6) { bz = az + Math.sin(this.t * 1.2 + v.id) * 2.5; by = 3.2; }
      const dx = bx - ax, dy = by - ay, dzz = bz - az, len = Math.hypot(dx, dy, dzz);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, -dzz).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      this.vines.put(0, ax, ay, R(az), e.y, [1.4, len, 1.4], this.col.set("#4E8A32"), e.x, e.z);
      this.vines.put(1, bx, by + 1.2, R(bz), 0, [1.2, 2.2, 1.2], this.col.set("#FFFFFF"));
      // the grab ring shows when Kiko can reach this vine
      if (!v.used && !s.swing && v.z - s.z < 14 && v.z - s.z > -1) {
        const near = s.vineNear() === v;
        this.vines.put(2, bx, by, R(bz), 0, near ? 1.25 + Math.sin(this.t * 14) * 0.12 : 0.9, this.col.set(near ? "#7CFF6B" : "#FFFFFF"));
      }
    }
    for (const key of Object.keys(O)) O[key].end();
    this.shadows.end(); this.vines.end(); this.zips.end();
    // banana flags (checkpoints) and region gates
    this.flags.begin();
    for (const fz of s.track.flags) if (fz > pz - 12 && fz < pz + 200 && fz < lim) { this.flags.put(0, -4.4, 0, R(fz)); this.flags.put(1, -4.4, 0, R(fz), Math.sin(this.t * 3 + fz) * 0.25); }
    this.flags.end();
    this.gates.begin();
    for (const r of s.track.regions) if (r.z > pz - 20 && r.z < pz + 260 && r.z > 0) this.gates.put(0, 0, 0, R(r.z));
    this.gates.end();
  }

  private pickups(pz: number, R: (z: number) => number, lim: number) {
    const s = this.sim, items = s.track.items;
    this.bananas.begin(); this.items.begin(); this.rides.begin();
    let lo = 0, hi = items.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].z < pz - 12) lo = m + 1; else hi = m; }
    const spin = this.t * 3.2;
    for (let i = lo; i < items.length && items[i].z < pz + 190; i++) {
      const it = items[i];
      if (it.z > lim - 1) break;
      let x = it.lane * LW, y = it.y, z = it.z;
      if (it.got) {
        const a = it.t != null ? (s.t - it.t) / 0.2 : 1;
        if (it.kind !== "banana" || a >= 1 || !this.pulled.has(it.id)) continue;
        x += (s.x - x) * a; y += (s.y + 0.7 - y) * a; z += (s.z - z) * a;
      }
      const rz = R(z), bob = Math.sin(this.t * 3 + it.id) * 0.1;
      switch (it.kind) {
        case "banana": this.bananas.put(0, x, y + bob * 0.6, rz, spin + it.z * 0.3, 1.25, undefined, 0, 0.3); break;
        case "fruit": this.items.put(FRUIT_ORDER.indexOf(it.fruit ?? "mango"), x, y + bob, rz, spin * 0.7, 1.15); break;
        case "gold": this.items.put(6, x, y + bob, rz, spin * 1.3, 1.2, undefined, 0, 0.3); this.items.put(17, x, y + bob, rz, 0, 1.1 + Math.sin(this.t * 6) * 0.08); break;
        case "heart": this.items.put(7, x, y + bob, rz, Math.sin(this.t * 2) * 0.5, 1.2 + Math.sin(this.t * 7) * 0.06); break;
        case "rotten": this.items.put(8, x, y + bob * 0.3, rz, 0, 1.1); if (Math.random() < 0.12) this.burst(x, y + 0.5, z, 1, "#7A9A3A", 0.8, 0.3, 0.6, 0); break;
        case "power": this.items.put(9, x, y + bob, rz, 0, 1); this.items.put(10 + POWER_ORDER.indexOf(it.power ?? "magnet"), x, y + bob, rz, Math.sin(this.t * 2) * 0.6, 1.25); break;
        case "boost": this.items.put(9, x, y + 0.2 + bob, rz, 0, 1.25); this.items.put(it.boost === 5 ? 15 : 14, x, y + 0.2 + bob, rz, this.t * 1.5, 1.4, undefined, 0, 0.3); break;
        case "pad": this.items.put(16, x, 0, rz, this.t, 1); break;
        case "ride": { const ri = RIDE_IDS.indexOf(it.ride ?? "turtle"); this.rides.put(Math.max(0, ri), x, 0, rz, Math.PI + Math.sin(this.t * 2 + it.id) * 0.3, 1); this.items.put(17, x, 1.0 + (M2.RIDE_SEAT[it.ride ?? "turtle"] ?? 0.6), rz, 0, 1.6 + Math.sin(this.t * 6) * 0.1); break; }
      }
    }
    if (s.ride && s.rideT > 0) { const ri = RIDE_IDS.indexOf(s.ride); this.rides.put(Math.max(0, ri), s.x, s.y + (s.ride === "frog" ? 0 : 0), 0, s.ride === "panda" ? Math.sin(this.runPh) * 0.06 : 0, 1, undefined, s.ride === "elephant" || s.ride === "dino" ? Math.sin(this.runPh * 0.5) * 0.04 : 0, this.lean * 0.3); }
    this.bananas.end(); this.items.end(); this.rides.end();
  }

  private characters(dt: number, R: (z: number) => number) {
    const s = this.sim;
    const boost = s.boostT > 0, glide = s.glideT > 0, swing = !!s.swing, ouch = s.ouchT > 0, hold = s.holdT > 0;
    const sitting = (!!s.ride && s.rideT > 0) || (!!s.slideZone && !s.air);
    const run = !s.air && s.slideT <= 0 && s.phase === "play" && !ouch && !hold && !sitting;
    this.runPh += dt * (run ? Math.min(s.speed, 22) * 0.95 : 2);
    const ph = this.runPh;
    this.squashT = Math.max(0, this.squashT - dt);
    this.danceT = Math.max(0, this.danceT - dt);
    this.yuckT = Math.max(0, this.yuckT - dt);
    const vx = s.lane * LW - s.x;
    this.lean += (Math.max(-1, Math.min(1, vx * 0.6)) * -0.3 - this.lean) * Math.min(1, dt * 12);
    const riding = !!s.ride && s.rideT > 0, seat = riding ? M2.RIDE_SEAT[s.ride!] ?? 0.6 : 0;
    this.kiko.position.set(s.x, s.y + seat, 0);
    this.kiko.visible = !(s.invT > 0 && s.invT < 1.6 && !hold && Math.floor(s.invT * 14) % 2 === 0) || glide || boost;
    const b = this.body;
    // the slide is a curled-up roll; the slip a spin; the swing hangs from the arms
    this.spin = s.slipT > 0 ? this.spin + dt * 16 : this.danceT > 0 ? this.spin + dt * 9 : 0;
    const slide = s.slideT > 0 && !s.air;
    this.swingA = swing ? Math.sin(Math.PI * Math.min(1, (s.z - s.swing!.z0) / Math.max(1, s.swing!.z1 - s.swing!.z0))) : this.swingA * Math.max(0, 1 - dt * 6);
    b.position.set(0, run ? Math.abs(Math.cos(ph)) * 0.08 : hold ? Math.abs(Math.sin(this.t * 6)) * 0.12 : 0, 0);
    b.rotation.set(slide ? -1.15 : boost ? -0.5 : swing ? -0.25 - this.swingA * 0.5 : s.air && !glide ? -0.15 : run ? 0.14 : 0, this.spin, this.lean + (s.wobbleT > 0 ? Math.sin(s.wobbleT * 30) * 0.35 * s.wobbleT : 0) + (ouch && s.ouchBy !== "fall" && s.ouchBy !== "water" ? Math.sin(this.t * 7) * 0.2 : 0));
    if (slide) b.position.y = 0.12;
    const sq = this.squashT > 0 ? this.squashT / 0.18 : 0;
    b.scale.set(1 + 0.14 * sq, 1 - 0.2 * sq, 1 + 0.14 * sq);
    this.head.rotation.set(run ? Math.sin(ph * 2) * 0.06 : 0, Math.sin(this.t * 0.7) * (hold ? 0.4 : 0.08), 0);
    this.tail.rotation.set(-0.2 + Math.sin(ph * 0.5) * 0.15 + (s.air ? 0.4 : 0), 0, Math.sin(ph) * 0.25 + this.lean * -0.5);
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1, p = ph + (i ? Math.PI : 0), a = this.arms[i], l = this.legs[i];
      if (swing || glide) { a.rotation.set(Math.PI * 0.92, 0, sgn * -0.25); l.rotation.set(0.4 + Math.sin(this.t * 6 + i) * 0.2, 0, sgn * 0.12); }
      else if (sitting && !boost) { a.rotation.set(-0.9 + Math.sin(this.t * 8 + i) * 0.15, 0, sgn * 0.45); l.rotation.set(-1.45, 0, sgn * 0.25); }
      else if (boost) { a.rotation.set(-1.4, 0, sgn * 0.4); l.rotation.set(0.6, 0, sgn * 0.1); }
      else if (ouch && (s.ouchBy === "fall" || s.ouchBy === "water")) { a.rotation.set(Math.PI * 0.9 + Math.sin(this.t * 20 + i) * 0.4, 0, sgn * -0.5); l.rotation.set(Math.sin(this.t * 18 + i * 2) * 0.6, 0, 0); }
      else if (ouch) { a.rotation.set(0.2, 0, sgn * 0.9); l.rotation.set(0, 0, sgn * 0.15); }
      else if (slide) { a.rotation.set(-2.6, 0, sgn * 0.3); l.rotation.set(-1.4, 0, 0); }
      else if (s.air) { a.rotation.set(-2.3, 0, sgn * 0.5); l.rotation.set(0.9 - i * 0.6, 0, sgn * 0.08); }
      else if (this.danceT > 0) { a.rotation.set(Math.PI * 0.85 + Math.sin(this.t * 14 + i * Math.PI) * 0.3, 0, sgn * -0.3); l.rotation.set(Math.sin(this.t * 14 + i * Math.PI) * 0.4, 0, 0); }
      else if (run) { a.rotation.set(Math.cos(p) * 1.15, 0, sgn * 0.2); l.rotation.set(-Math.cos(p) * 1.0, 0, 0); }
      else { a.rotation.set(Math.sin(this.t * 3 + i) * 0.1, 0, sgn * 0.15); l.rotation.set(0, 0, 0); }
    }
    // star power: Kiko flashes through the rainbow and sparkles; rotten fruit turns him a little green
    if (boost) {
      this.kikoMat.emissive.setHSL((this.t * 2.4) % 1, 1, 0.5); this.kikoMat.emissiveIntensity = 0.55 + 0.3 * Math.sin(this.t * 18);
      if (Math.random() < 0.5) this.burst(s.x + (Math.random() - 0.5) * 1.2, s.y + 0.4 + Math.random() * 1.2, s.z - 0.2, 1, ["#FF5F7E", "#FFD23F", "#7CFFB2", "#5FB8FF", "#C8A6FF"][Math.floor(Math.random() * 5)], 1.2, 0.45, 0.45);
    } else if (this.yuckT > 0) { this.kikoMat.emissive.set("#5FA02A"); this.kikoMat.emissiveIntensity = this.yuckT * 0.6; }
    else if (this.kikoMat.emissiveIntensity !== 0) this.kikoMat.emissiveIntensity = 0;
    this.pepper.visible = boost && !s.rushing && s.boostX < 5; this.pepperGold.visible = boost && !s.rushing && s.boostX >= 5;
    for (const r of [this.pepper, this.pepperGold]) if (r.visible) { r.position.set(0, -0.3 + Math.sin(this.t * 20) * 0.03, 0.1); r.rotation.set(Math.PI / 2, 0, 0); }
    this.helmet.visible = s.helmetT > 0;
    // the raft under Kiko on the river
    this.raft.visible = s.onRaft && !glide && !boost;
    if (this.raft.visible) { this.raft.position.set(s.x, RAFT_Y - 0.28 + Math.sin(this.t * 2.4) * 0.04, -0.15); this.raft.rotation.set(Math.sin(this.t * 1.8) * 0.03, 0, Math.sin(this.t * 1.3) * 0.04 - this.lean * 0.2); if (Math.random() < 0.3) this.burst(s.x + (Math.random() - 0.5) * 2, 0, s.z - 1.3, 1, "#E9FBFF", 1.4, 0.35, 0.5); }
    // Pico (or a kite) carries Kiko on a glide
    this.kite.visible = glide && s.kite;
    if (this.kite.visible) { this.kite.position.set(s.x, s.y + 2.3, -0.4); this.kite.rotation.set(0.2, Math.sin(this.t * 1.5) * 0.2, Math.sin(this.t * 2.2) * 0.15); }
    this.pico.visible = glide && !s.kite;
    if (glide) { this.pico.position.set(s.x, s.y + 1.75, -0.1); this.pico.rotation.set(-0.1, 0, Math.sin(this.t * 2) * 0.1); this.picoWings.forEach((w, i) => { w.rotation.set(0, 0, (i ? -1 : 1) * (0.3 + Math.sin(this.t * 14) * 0.7)); }); }
    // dizzy stars after a bump
    this.stars3.count = 0;
    if (ouch && s.ouchBy !== "fall" && s.ouchBy !== "water") {
      for (let i = 0; i < 3; i++) { const a = this.t * 5 + (i / 3) * Math.PI * 2; this.dummy.position.set(s.x + Math.cos(a) * 0.4, s.y + 1.55, Math.sin(a) * 0.4); this.dummy.rotation.set(0, a, 0); this.dummy.scale.setScalar(1.3); this.dummy.updateMatrix(); this.stars3.setMatrixAt(i, this.dummy.matrix); }
      this.stars3.count = 3; this.stars3.instanceMatrix.needsUpdate = true;
    }
    const surf = s.surface(s.x, s.y + 0.05, s.z).h;
    const sh = surf > -1 ? surf : -50;
    const hgt = Math.max(0, s.y - Math.max(0, sh));
    this.shadow.position.set(s.x, Math.max(0, sh) + 0.04, 0.05);
    this.shadow.scale.setScalar(Math.max(0.35, 1.2 - hgt * 0.16));
    this.shadow.visible = sh > -1 && !ouch;
    this.magnetRing.visible = s.magnetT > 0 || boost;
    if (this.magnetRing.visible) { this.magnetRing.position.set(s.x, s.y + 0.1 + Math.sin(this.t * 8) * 0.05, 0); this.magnetRing.scale.setScalar(1 + 0.15 * Math.sin(this.t * 10)); }
    // the region's boss runs ahead with a Golden Seed during the chase
    const c = s.chase != null ? s.track.chases.find((q) => q.id === s.chase) : null;
    this.goon.visible = false;
    for (const [id, g] of this.bossMeshes) g.visible = !!c && c.boss === id;
    this.seed.visible = !!c;
    if (c) {
      const g = this.bossMesh(c.boss);
      const gap = Math.max(7, 30 - s.pads * 8);
      g.position.set(Math.sin(this.t * 0.8) * LW, Math.abs(Math.sin(this.t * 9)) * 0.25 + (s.onBranch ? BR_H : 0), R(s.z + gap));
      g.rotation.set(0, Math.sin(this.t * 9) * 0.15, Math.sin(this.t * 4.5) * 0.08);
      this.seed.position.set(g.position.x, g.position.y + 3.0, g.position.z); this.seed.rotation.y = this.t * 2;
    }
    // the finale: the Great Fruit Tree stands over the path in place 301
    const tz = s.track.stageZ(FINALE) + STAGE_M * 0.6;
    if (tz - s.z < 320 && tz - s.z > -40) {
      if (!this.greatTree) {
        const g = new THREE.Group();
        for (const { g: geo, mat } of M2.greatTreeParts()) { this.keep.push(geo); g.add(new THREE.Mesh(geo, this.matOf(mat))); }
        this.greatTree = g; this.scene.add(g);
      }
      this.greatTree.visible = true;
      this.greatTree.position.set(0, 0, R(tz));
      this.greatTree.rotation.y = 0;
    } else if (this.greatTree) this.greatTree.visible = false;
    // something rolls or flies along behind Kiko
    for (const [w, g] of this.chaserMeshes) g.visible = s.chaser === w;
    if (s.chaser && s.phase === "play") {
      const g = this.chaserMesh(s.chaser);
      this.chaserZ += ((3.4 + Math.sin(this.t * 0.9) * 0.8) - this.chaserZ) * Math.min(1, dt * 2);
      const roll = s.chaser === "boulder" || s.chaser === "avalanche";
      g.position.set(s.x * 0.5, roll ? 0.15 : 0.3 + Math.sin(this.t * 5) * 0.2, this.chaserZ);
      if (roll) { g.rotation.x -= dt * s.speed / 1.6; this.shakeT = Math.max(this.shakeT, 0.05); if (Math.random() < 0.4) this.burst(s.x + (Math.random() - 0.5) * 3, 0.3, s.z - this.chaserZ + 1, 1, s.chaser === "avalanche" ? "#FFFFFF" : "#8A7A6A", 2.5, 0.5, 0.6); }
      else g.rotation.set(0, Math.sin(this.t * 3) * 0.2, 0);
    } else this.chaserZ = 12;
  }
  private bossMesh(id: string) {
    let g = this.bossMeshes.get(id);
    if (!g) {
      g = new THREE.Group();
      for (const { g: geo, mat } of M2.bossParts(id)) { this.keep.push(geo); g.add(new THREE.Mesh(geo, this.matOf(mat))); }
      g.scale.setScalar(1.15); g.visible = false; this.scene.add(g); this.bossMeshes.set(id, g);
    }
    return g;
  }
  private chaserMesh(what: string) {
    let g = this.chaserMeshes.get(what);
    if (!g) {
      g = new THREE.Group();
      for (const { g: geo, mat } of M2.chaserParts(what)) { this.keep.push(geo); g.add(new THREE.Mesh(geo, this.matOf(mat))); }
      if (what === "boulder" || what === "avalanche") g.scale.setScalar(0.65);
      if (what === "stampede") g.scale.setScalar(0.75);
      g.visible = false; this.scene.add(g); this.chaserMeshes.set(what, g);
    }
    return g;
  }

  private events(ev: SimEvent[]) {
    const s = this.sim;
    for (const e of ev) {
      switch (e.t) {
        case "land": this.squashT = 0.18; if (e.v < -6) this.burst(s.x, s.y + 0.05, s.z, 8, "#E9D9B8", 2.2, 0.35, 0.8); break;
        case "jump": this.burst(s.x, s.y + 0.05, s.z, 6, "#E9D9B8", 1.6, 0.3, 0.6); break;
        case "bounce": this.burst(s.x, 0.6, s.z, 14, "#FF6B7A", 3.5, 0.45, 0.8); this.burst(s.x, 0.6, s.z, 8, "#FFFFFF", 3, 0.35, 0.7); break;
        case "slide": case "slam": this.burst(s.x, 0.1, s.z, 8, "#C9A47A", 2.5, 0.35, 0.7); break;
        case "banana": {
          const it = this.findItem(e.id);
          if (e.pull) this.pulled.add(e.id);
          if (this.pulled.size > 600) this.pulled.clear();
          if (it) this.burst(it.lane * LW, it.y, it.z, e.line ? 5 : 4, "#FFE27A", 2.4, 0.35, 0.5);
          break;
        }
        case "fruit": { const col = ({ mango: "#FFA62B", pineapple: "#FFD23F", berries: "#7A6BFF", melon: "#FF4F5E", kiwi: "#9AD35A", dragon: "#FF4FA8" } as Record<string, string>)[e.id]; this.burst(s.x, s.y + 0.9, s.z + 0.5, 16, col ?? "#FFFFFF", 4, 0.45, 0.8); break; }
        case "salad": this.danceT = 1.2; for (let i = 0; i < 3; i++) this.burst(s.x, s.y + 1.4, s.z, 10, ["#FFA62B", "#FF4FA8", "#9AD35A"][i], 5, 0.6, 1.1); break;
        case "gold": this.burst(s.x, s.y + 1, s.z, 26, "#FFE14D", 6, 0.7, 1.2); break;
        case "heart": this.burst(s.x, s.y + 1.2, s.z, 22, "#FF5F7E", 4.5, 0.6, 1.1); break;
        case "maxUp": this.burst(s.x, s.y + 1.2, s.z, 30, "#FF8FB8", 6, 0.6, 1.3); break;
        case "rotten": this.yuckT = 1; this.burst(s.x, s.y + 1, s.z, 14, "#7A9A3A", 3, 0.45, 0.9); break;
        case "melody": for (let i = 0; i < 3; i++) this.burst(s.x, s.y + 1.4, s.z, 8, ["#FF9FC8", "#9FE6FF", "#FFE08A"][i], 4, 0.6, 1.1); break;
        case "power": this.burst(s.x, s.y + 0.8, s.z, 26, "#FFFFFF", 5, 0.6, 1.2); break;
        case "boost": this.burst(s.x, s.y + 0.8, s.z, 30, e.rush ? "#FF8FC7" : "#FFC21A", 6, 0.7, 1.2); if (e.on) this.shakeT = 0.3; break;
        case "smash": this.burst(s.x, 0.9, s.z + 1.2, 16, ["#FFD23F", "#7CD35A", "#C98A55"][Math.floor(Math.random() * 3)], 6, 0.6, 1.0); this.shakeT = Math.max(this.shakeT, 0.12); break;
        case "helmetPop": this.burst(s.x, s.y + 1.3, s.z + 0.5, 24, "#C98A55", 5, 0.6, 1.0); this.shakeT = 0.3; break;
        case "hurt": this.shakeT = 0.5; if (e.by !== "fall" && e.by !== "water") this.burst(s.x, s.y + 0.8, s.z + 0.8, 26, "#FF6B8A", 6, 0.7, 1.3); break;
        case "splash": for (let i = 0; i < 2; i++) this.burst(e.x, 0, e.z, 24, e.lava ? (i ? "#FFC23D" : "#FF5A1F") : i ? "#FFFFFF" : "#9FE6FF", 7, 0.6, 1.1); break;
        case "stumble": this.shakeT = 0.25; this.burst(s.x, 1.0, s.z, Math.max(4, e.lost), "#FFD23F", 4, 0.45, 0.9); break;
        case "slip": this.burst(s.x, 0.1, s.z, 10, "#FFD23F", 3, 0.4, 0.7); break;
        case "trick": this.burst(s.x, s.y + 1.2, s.z, 12, e.kind === "vine" ? "#7CFF6B" : "#FFE08A", 4.5, 0.5, 0.9); break;
        case "grab": this.burst(s.x, s.y + 1.6, s.z, 10, "#7CD35A", 3, 0.4, 0.7); break;
        case "pad": this.burst(s.x, 0.3, s.z, 22, "#7CFF6B", 5, 0.5, 1); this.shakeT = 0.2; break;
        case "caught": for (let i = 0; i < 4; i++) this.burst(s.x, 2, s.z + 6, 20, ["#FFD23F", "#FF5F7E", "#2FCB8B", "#3D8BFF"][i], 7, 0.9, 1.6); break;
        case "flag": this.burst(-4.4, 2.6, s.z, 14, "#FFD23F", 3.5, 0.45, 0.9); break;
        case "region": this.pending = { n: e.n, t: 0.12 }; break;
        case "ride": this.burst(s.x, s.y + 1, s.z, e.on ? 30 : 16, e.on ? "#FFD23F" : "#FFFFFF", 5, 0.6, 1.1); if (e.on) this.shakeT = 0.25; break;
        case "stuck": this.burst(s.x, s.y + 1.2, s.z + 0.5, 14, "#F4F4FF", 3, 0.4, 0.8); break;
        case "mud": this.burst(s.x, 0.2, s.z, 10, "#6A4A2A", 3, 0.4, 0.7); break;
        case "gust": for (let i = 0; i < 12; i++) this.burst(s.x - e.dir * 2, 1 + Math.random(), s.z + 1, 1, "#FFFFFF", 3, 0.4, 0.6); break;
        case "throw": this.burst(e.lane * LW, 3, s.z + 18, 10, "#FFE14D", 3, 0.4, 0.6); break;
        case "chaser": if (e.on) this.chaserZ = 12; break;
        case "place": { const sec = sectionOf(e.n); if (sec.scene === this.region && (sec.tod !== this.sec.tod || sec.weather !== this.sec.weather)) { this.sec = sec; this.applySky(sec); } break; }
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
  private burst(x: number, y: number, z: number, n: number, color: string, sp: number, size: number, life: number, g = 7) {
    const c = new THREE.Color(color).multiplyScalar(1.8);
    for (let i = 0; i < n && this.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      this.parts.push({ x, y, z, vx: Math.cos(a) * r * sp, vy: Math.abs(u) * sp + 1, vz: Math.sin(a) * r * sp, life: 0, max: life * (0.6 + Math.random() * 0.6), s: size * (0.6 + Math.random() * 0.8), c, g });
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
      if (s.doubleT > 0 && Math.random() < 0.5) this.burst(s.x, s.y + 0.6, s.z - 0.3, 1, "#FFE08A", 0.8, 0.45, 0.5);
      if (s.boostT > 0) for (let i = 0; i < 3; i++) if (this.parts.length < 500) this.parts.push({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y + 0.2, z: s.z - 0.9, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() - 0.5, vz: -6 - Math.random() * 4, life: 0, max: 0.35, s: 1.6 + Math.random(), c: new THREE.Color(s.rushing ? ["#FF8FC7", "#FFD23F", "#7CFFB2"][i] : Math.random() < 0.5 ? "#FFC23D" : "#FF5A1F").multiplyScalar(2.2), g: 0 });
      const tr = TRAILS[this.look.trail];
      if (tr && Math.random() < 0.5 && !s.air) this.burst(s.x + (Math.random() - 0.5) * 0.4, s.y + 0.25, s.z - 0.4, 1, tr[Math.floor(this.t * 10) % tr.length], 0.6, 0.4, 0.6);
    }
    this.partMesh.count = n; this.partMesh.instanceMatrix.needsUpdate = true;
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
    const fast = s.phase === "play" && !this.attract ? Math.max(0, (s.speed - 12.5) / 6) + (s.glideT > 0 ? 0.6 : 0) + (s.boostT > 0 ? 1.5 : 0) : 0;
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
  /** leaves, rain, snow, petals, ash, dust, fireflies, butterflies or mist around the camera (storms flash with lightning) */
  private weatherFx(dt: number) {
    const w = this.weather, s = this.sim, d = this.dummy;
    if (w === "storm") {
      this.flashT -= dt;
      if (this.flashT < -3 - Math.random() * 6) { this.flashT = 0.18; this.bolt.position.set((Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40), 0, -80 - Math.random() * 60); this.lightning?.(); }
      this.bolt.visible = this.flashT > 0;
      this.hemi.intensity = this.th.hemiI * (this.flashT > 0 ? 3 : 1);
    } else if (this.bolt.visible) { this.bolt.visible = false; this.hemi.intensity = this.th.hemiI; }
    if (w === "none" || this.q === "low") { this.wx.count = 0; return; }
    const cols: Record<Weather, string[]> = {
      none: [], leaves: ["#7CC44A", "#FFC23D", "#5FAE3A", "#E8A04A"], rain: ["#CFE4FF"], storm: ["#BFD4F2"], fireflies: ["#FFF27A", "#B8FF7A"],
      butterflies: ["#FF8FC7", "#FFD23F", "#7AD3FF", "#FFFFFF", "#B58CFF"], mist: ["#FFFFFF"], snow: ["#FFFFFF"], wind: ["#7CC44A", "#FFFFFF", "#9AE05A"],
      petals: ["#FF9FD0", "#FFC2E2", "#FFFFFF"], ash: ["#8A8A8A", "#5A5A5A", "#FF7A2A"], dust: ["#E8C08A", "#C8A06A"],
      fruitrain: ["#FFA62B", "#FFD23F", "#FF5F7E", "#7CC44A", "#6B5BFF", "#FF4FA8", "#FFE14D"],
    };
    const fall = w === "rain" || w === "storm" || w === "leaves" || w === "snow" || w === "petals" || w === "ash" || w === "fruitrain" ? 1 : 0;
    const v = w === "rain" ? 16 : w === "storm" ? 22 : w === "leaves" ? 1.3 : w === "snow" ? 1.6 : w === "petals" ? 1.0 : w === "ash" ? 0.8 : w === "fruitrain" ? 3.2 : 0.6;
    const side = w === "wind" ? 9 : w === "storm" ? 3 : w === "dust" ? 4 : 0;
    let n = 0;
    for (let i = 0; i < this.wxData.length; i++) {
      const p = this.wxData[i];
      p.p += dt;
      p.y -= fall * v * dt; p.z += s.speed * dt * 0.95; p.x += side * dt;
      if (fall === 0) { p.x += Math.sin(p.p * 1.3 + i) * dt * (w === "butterflies" ? 1.4 : 0.6); p.y += Math.cos(p.p * (w === "butterflies" ? 2.2 : 1) + i) * dt * 0.5; }
      else p.x += Math.sin(p.p + i) * dt * (w === "leaves" || w === "petals" || w === "snow" ? 1.4 : 0.3);
      if (p.y < -1 || p.y > 16 || p.z > 8 || Math.abs(p.x - s.x) > 18) { p.x = (Math.random() - 0.5) * 30 + s.x - side * 1.2; p.y = fall > 0 ? 10 + Math.random() * 6 : 0.5 + Math.random() * (w === "butterflies" ? 4 : 8); p.z = -10 - Math.random() * 60; }
      d.position.set(p.x, p.y, p.z);
      if (w === "rain" || w === "storm") { d.scale.set(0.15, 5, 1); d.rotation.set(0, 0, w === "storm" ? 0.35 : 0.1); }
      else if (w === "butterflies") { const f = Math.abs(Math.sin(p.p * 14 + i)); d.scale.set(1.6 * (0.3 + f), 1.2, 1); d.rotation.set(0.4, p.p, 0); }
      else if (w === "leaves" || w === "petals" || w === "wind") { d.scale.set(w === "wind" ? 2.4 : 1.5, 0.8, 1); d.rotation.set(p.p * 2, p.p, p.p); }
      else if (w === "snow") { d.scale.setScalar(1.1 + (i % 3) * 0.3); d.rotation.set(p.p, p.p, 0); }
      else if (w === "fruitrain") { d.scale.setScalar(2.6 + (i % 3) * 0.6); d.rotation.set(p.p * 3, p.p * 2, p.p); }
      else { d.scale.setScalar(w === "fireflies" ? 0.45 + Math.sin(p.p * 6 + i) * 0.25 : w === "ash" || w === "dust" ? 0.9 : 2.4); d.rotation.set(p.p, p.p * 0.7, 0); }
      d.updateMatrix();
      this.wx.setMatrixAt(n, d.matrix);
      const cs = cols[w]; this.col.set(cs[i % cs.length]).multiplyScalar(w === "fireflies" ? 1.9 : w === "ash" && i % 3 === 2 ? 2.0 : w === "mist" ? 0.9 : 1.1);
      this.wx.setColorAt(n, this.col); n++;
    }
    (this.wx.material as THREE.MeshBasicMaterial).opacity = w === "mist" ? 0.12 : w === "dust" ? 0.5 : 0.9;
    this.wx.count = n; this.wx.instanceMatrix.needsUpdate = true;
    if (this.wx.instanceColor) this.wx.instanceColor.needsUpdate = true;
  }
  /** the session plays the thunder */
  lightning: (() => void) | null = null;

  private cameraMove(dt: number) {
    const s = this.sim, cam = this.camera;
    const yT = s.ouchT > 0 || s.phase !== "play" ? Math.max(0, s.y) : s.y;
    this.ySmooth += (Math.min(yT, 7) * (s.glideT > 0 ? 0.75 : 0.6) - this.ySmooth) * Math.min(1, dt * (s.air ? 2.5 : 5));
    const aspect = this.w / this.h;
    const fov = 62 + Math.min(8, Math.max(0, s.speed - 11.5) * 0.8) + (s.glideT > 0 ? 4 : 0) + (s.boostT > 0 ? 8 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    const tanH = Math.tan((cam.fov * Math.PI) / 360) * aspect;
    const dist = Math.max(6.6, Math.min(10.5, 3.05 / Math.max(0.05, tanH)));
    const shake = this.shakeT > 0 ? (this.shakeT -= dt, this.shakeT * 0.6) : 0;
    const sx = (Math.random() - 0.5) * shake, sy2 = (Math.random() - 0.5) * shake;
    const bx = s.x * 0.6 + sx, by = 3.2 + dist * 0.12 + this.ySmooth + sy2, bz = dist * 0.92;
    const lx = s.x * 0.8, ly = 1.25 + this.ySmooth * 0.9, lz = -11;
    if (this.photoCam) {
      const p = this.photoCam;
      cam.position.set(s.x + p.side * p.d * 0.55, s.y + p.h, -p.d);
      cam.lookAt(s.x + p.dx, s.y + 0.85, 0);
      return;
    }
    if (this.attract) {
      const a = Math.sin(this.t * 0.25) * 0.35;
      cam.position.set(Math.max(-2.6, Math.min(3.2, s.x * 0.4 + Math.sin(a) * 2.4 + 0.9)), s.y + 1.9, -5.4 - Math.cos(a) * 0.6);
      cam.lookAt(s.x, s.y + 1.05, 0.5);
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
  /** art: Kiko alone on a flat colour (for the character cut-out) */
  portrait(color = "#FF00FF") {
    this.scene.children.forEach((o) => { if (o !== this.kiko && !(o instanceof THREE.Light)) o.visible = false; });
    this.scene.background = new THREE.Color(color); this.scene.fog = null;
    this.renderer.toneMapping = THREE.NoToneMapping;
    if (this.bloom) this.bloom.enabled = false;
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const o = this.rl;
    [o.strips, o.trees, o.leaves, o.plants, o.near, o.far, o.glowFar, o.rays, o.hang, o.zone, o.zoneGlow, o.arches].forEach((l) => l.dispose());
    o.water.forEach((w) => w.geometry.dispose());
    [this.zips, this.rides].forEach((l) => l.dispose());
    Object.values(this.obs).forEach((l) => l.dispose());
    [this.bananas, this.items, this.shadows, this.flags, this.gates, this.vines].forEach((l) => l.dispose());
    this.rkeep.forEach((d) => d.dispose());
    this.keep.forEach((d) => d.dispose());
    this.envRT?.dispose();
    this.scene.traverse((ob) => { const m = ob as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ------------------------------------------------------------------ helpers
function at(g: THREE.BufferGeometry, x: number, y: number, z: number, color?: string) {
  g.translate(x, y, z);
  if (color) {
    const c = new THREE.Color(color), n = g.getAttribute("position").count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  }
  return g;
}
function merge2(parts: THREE.BufferGeometry[]) {
  return parts.length === 1 ? (parts[0].index ? parts[0].toNonIndexed() : parts[0]) : mergeColored(parts);
}
function mergeColored(parts: THREE.BufferGeometry[]) {
  const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let total = 0; for (const p of nonIdx) total += p.getAttribute("position").count;
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const p of nonIdx) {
    const n = p.getAttribute("position").count;
    pos.set(p.getAttribute("position").array as Float32Array, o * 3);
    nrm.set(p.getAttribute("normal").array as Float32Array, o * 3);
    const c = p.getAttribute("color"); if (c) col.set(c.array as Float32Array, o * 3); else col.fill(1, o * 3, (o + n) * 3);
    const u = p.getAttribute("uv"); if (u) uv.set(u.array as Float32Array, o * 2);
    o += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
const mul = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k).getStyle();
