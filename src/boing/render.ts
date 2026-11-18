// Momo Boing! renderer (three.js). A tall sky column seen from slightly above, so platform tops show their clay.
// Depth comes in layers that all scroll with the camera: far landmarks in the haze (ground first, then floating
// islands and big clouds as you climb), a mid layer of islands, little clouds right behind the column, the play layer,
// and now and then a soft cloud drifting past in front. Most things are instanced; the CSS sky behind the canvas
// deepens as Momo climbs. Each of the 10 worlds has its own palette, light, scenery, platforms, Grumpies and villain;
// Spooky Night is dark (Momo carries a lantern), Space has stars, the Lava Sky's goo is real lava.
import * as THREE from "three";
import { balloonBaron, boatGeo, chefGrumble, ghostGeo, golemGeo, hatGeo, krankyKrab, magmaGeo, mechGeo, palmTree, pumpkin, roboGeo, stormCloud, tint, toyBall, toyBlocks, ufoGeo } from "../crowd/models";
import * as M from "./models";
import { FRIEND_ORDER, HALF, WORLDS } from "./levels";
import { MOMO_R, bridgeAngle, ghostLevel, liftOn, ventHot, type Sim } from "./sim";
import type { DropKind, FriendId, SimEvent, TimeOfDay, VillainKind, WorldId } from "./types";

/** what Momo wears (bought in the Wardrobe) */
export interface BoingLook { hat: string; trail: string }

export type Quality = "low" | "medium" | "high";

interface Theme {
  sky: [string, string, string]; high: [string, string, string]; fog: string;
  hemiSky: string; hemiGround: string; sun: string; sunI: number; hemiI?: number;
  base: string[]; top: string[]; crumble: string; move: string; drips: boolean; cloud: string[];
  pole: string; pole2: string; goo: string; gooDark: string; amb: string[];
  bee: [string, string]; wing: string; sitter: string;
  dark?: boolean; stars?: boolean;
}
const THEMES: Record<WorldId, Theme> = {
  garden: {
    sky: ["#5DB9FF", "#A9DEFF", "#E9FBFF"], high: ["#3A8FE8", "#7CC4FF", "#CDEBFF"], fog: "#BFE6FF",
    hemiSky: "#E8F6FF", hemiGround: "#7FB06A", sun: "#FFF4DD", sunI: 1.7,
    base: ["#B9784A", "#A86B40"], top: ["#5CC452", "#4FB548"], crumble: "#C9A27A", move: "#E0A060", drips: false, cloud: ["#FFFFFF"],
    pole: "#5CC452", pole2: "#3E9E3E", goo: "#8E4FD8", gooDark: "#5A2A9E", amb: ["#FFF6A8", "#FFFFFF", "#FFD8F0"],
    bee: ["#8E6BD8", "#FFD23F"], wing: "#E8F6FF", sitter: "#8E6BD8",
  },
  candy: {
    sky: ["#FF8FC7", "#FFC9E4", "#FFF0F7"], high: ["#C77DFF", "#F2A6E0", "#FFE0F2"], fog: "#FFD6EC",
    hemiSky: "#FFF0FA", hemiGround: "#C98AB8", sun: "#FFF0F5", sunI: 1.6,
    base: ["#D9935A", "#C98048"], top: ["#FF7AB6", "#FFFFFF", "#8FE3C0", "#FFD95E"], crumble: "#E6B47A", move: "#B58AE8", drips: true, cloud: ["#FFB3E0", "#B3D9FF", "#FFF2A8"],
    pole: "#FF3B5C", pole2: "#FFFFFF", goo: "#7E3FCB", gooDark: "#4E2290", amb: ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#FFFFFF"],
    bee: ["#8E6BD8", "#FF7AB6"], wing: "#FFF0FA", sitter: "#8E6BD8",
  },
  snow: {
    sky: ["#3E8FE0", "#8EC8F5", "#E3F4FF"], high: ["#2A5FB8", "#5E9EE6", "#B8DBFA"], fog: "#CBE6FA",
    hemiSky: "#EAF6FF", hemiGround: "#8FB1CC", sun: "#F4FAFF", sunI: 1.55,
    base: ["#7FA9C9", "#6E98B9"], top: ["#FFFFFF", "#F2F8FF"], crumble: "#B9D2E6", move: "#9C8FE0", drips: true, cloud: ["#FFFFFF"],
    pole: "#BFE6FF", pole2: "#FFFFFF", goo: "#7A4FD0", gooDark: "#47298E", amb: ["#FFFFFF", "#EAF6FF"],
    bee: ["#7A6BD8", "#BFE6FF"], wing: "#FFFFFF", sitter: "#7A6BD8",
  },
  toy: {
    sky: ["#FFAE6B", "#FFDDB0", "#FFF4E3"], high: ["#FF7F6B", "#FFB98A", "#FFE3C4"], fog: "#FFE3C4",
    hemiSky: "#FFF6E8", hemiGround: "#C98A6A", sun: "#FFF2DD", sunI: 1.6,
    base: ["#FF5F5F", "#3D8BFF", "#FFC21A", "#2FCB8B"], top: ["#FF8A8A", "#7FB2FF", "#FFE07A", "#7FE0B5"], crumble: "#D9B48A", move: "#B58AE8", drips: false, cloud: ["#FFFFFF"],
    pole: "#FFD23F", pole2: "#FF5F5F", goo: "#8E4FD8", gooDark: "#5A2A9E", amb: ["#FF5F5F", "#3D8BFF", "#FFD23F", "#2FCB8B"],
    bee: ["#8E6BD8", "#FF8A3D"], wing: "#FFFFFF", sitter: "#8E6BD8",
  },
  beach: {
    sky: ["#22B8E6", "#9EE6F2", "#FFF4DC"], high: ["#128FCF", "#55C3EA", "#BDEBF7"], fog: "#BDEBF7",
    hemiSky: "#F2FBFF", hemiGround: "#D9B27A", sun: "#FFF6E0", sunI: 1.7,
    base: ["#E3B878", "#D9A866"], top: ["#F7E3B5", "#F2D9A3"], crumble: "#C9A06A", move: "#5FC8EA", drips: false, cloud: ["#FFFFFF"],
    pole: "#1E9C91", pole2: "#FFFFFF", goo: "#7E3FCB", gooDark: "#4E2290", amb: ["#FFFFFF", "#DFF6FF"],
    bee: ["#F2F2F2", "#FFB000"], wing: "#FFFFFF", sitter: "#8E6BD8",
  },
  spooky: {
    sky: ["#150F38", "#34266A", "#6A4FA8"], high: ["#0A0722", "#1E1650", "#3A2A72"], fog: "#2A2156",
    hemiSky: "#8F7FD0", hemiGround: "#2B1D52", sun: "#C9D4FF", sunI: 0.75, hemiI: 0.7,
    base: ["#5B4A6E", "#4E4062"], top: ["#7FA05A", "#6B8F4E"], crumble: "#7A6A80", move: "#8A6AA8", drips: false, cloud: ["#C9C0E8"],
    pole: "#FF8A3D", pole2: "#2B1D52", goo: "#5FC84A", gooDark: "#2E7A28", amb: ["#FFE680", "#C8FF80"],
    bee: ["#3B2A5A", "#FF8A3D"], wing: "#5A4A80", sitter: "#6B4FA8", dark: true,
  },
  jungle: {
    sky: ["#4FBF8F", "#B5EDCF", "#F0FFF4"], high: ["#2A8F5E", "#6FD09E", "#C8F2DA"], fog: "#C8F0D8",
    hemiSky: "#F0FFF4", hemiGround: "#4F7A3A", sun: "#FFF6D6", sunI: 1.6,
    base: ["#8A5A34", "#7A5230"], top: ["#3FAE4A", "#4FBF55"], crumble: "#B08A5A", move: "#C9853F", drips: false, cloud: ["#FFFFFF"],
    pole: "#5C8A3C", pole2: "#3E6E2A", goo: "#8E4FD8", gooDark: "#5A2A9E", amb: ["#FFF6A8", "#C8FF80"],
    bee: ["#4FAE5A", "#2B3A1E"], wing: "#E8FFE0", sitter: "#8E6BD8",
  },
  lava: {
    sky: ["#2A1212", "#7A2E22", "#E8704A"], high: ["#140808", "#4A1A14", "#A84028"], fog: "#5A2A22",
    hemiSky: "#FFB080", hemiGround: "#3A1A14", sun: "#FFC090", sunI: 1.35,
    base: ["#6A4E46", "#5C433C"], top: ["#9A7466", "#8A685C"], crumble: "#8A6A5E", move: "#A0674C", drips: false, cloud: ["#B09A96"],
    pole: "#FF7A1F", pole2: "#3A2A26", goo: "#FF6A1F", gooDark: "#C2400E", amb: ["#FFB347", "#FF7A1F", "#FFD23F"],
    bee: ["#FF8A3D", "#2A1414"], wing: "#FFD9A0", sitter: "#8E5A44",
  },
  space: {
    sky: ["#060622", "#141446", "#2A206A"], high: ["#03031A", "#0A0A2E", "#1A144A"], fog: "#121238",
    hemiSky: "#B8C0FF", hemiGround: "#2B1D52", sun: "#F0F2FF", sunI: 1.35,
    base: ["#7FA9FF", "#FF8FB8", "#FFD23F", "#8FE3C0", "#B58AE8"], top: ["#FFFFFF"], crumble: "#8A84A8", move: "#7CE0FF", drips: false, cloud: ["#B8A8FF"],
    pole: "#7CE0FF", pole2: "#4B3DBF", goo: "#8E4FD8", gooDark: "#5A2A9E", amb: ["#FFFFFF", "#CFE0FF", "#FFF2A8"],
    bee: ["#8FE3C0", "#7CE0FF"], wing: "#CFE0FF", sitter: "#8E6BD8", stars: true,
  },
  castle: {
    sky: ["#FFAA6B", "#FFD6A8", "#FFF2DE"], high: ["#E8606B", "#FF9F8A", "#FFD6C4"], fog: "#FFD9C4",
    hemiSky: "#FFF6EA", hemiGround: "#A8908A", sun: "#FFEBD0", sunI: 1.65,
    base: ["#A9A3B8", "#9A94AC"], top: ["#E8E4F2", "#DCD6EA"], crumble: "#BDB3A0", move: "#C9A227", drips: false, cloud: ["#FFFFFF"],
    pole: "#C9A227", pole2: "#8F6BFF", goo: "#8E4FD8", gooDark: "#5A2A9E", amb: ["#FFD23F", "#FFFFFF"],
    bee: ["#8E6BD8", "#B8B8C8"], wing: "#FFFFFF", sitter: "#8E6BD8",
  },
};

/** stage 101+: the same world at a different time of day */
function withTod(t: Theme, tod: TimeOfDay | undefined): Theme {
  switch (tod) {
    case "morning": return { ...t, sky: ["#FFC2DC", "#FFE6CF", "#FFFBF0"], high: ["#9FC8FF", "#CFE4FF", "#F0F6FF"], fog: "#FFE8DA", hemiSky: "#FFF4EA", sun: "#FFE6C8" };
    case "sunset": return { ...t, sky: ["#FF7A5A", "#FFB07A", "#FFE0B0"], high: ["#B8406A", "#FF7A6A", "#FFC08A"], fog: "#FFC0A0", hemiSky: "#FFE0C8", sun: "#FFB070", sunI: t.sunI * 0.95, dark: false };
    case "night": return { ...t, sky: ["#141038", "#2A2060", "#4A3A80"], high: ["#0A0822", "#1A1448", "#2E2460"], fog: "#241C50", hemiSky: "#8F7FD0", hemiGround: "#2B1D52", sun: "#C9D4FF", sunI: 0.75, hemiI: 0.7, dark: true };
    case "aurora": return { ...t, sky: ["#0B1636", "#16586A", "#4FC9A0"], high: ["#060C24", "#0F3A50", "#2E8A70"], fog: "#163A4A", hemiSky: "#9FE8D0", hemiGround: "#1B2A40", sun: "#D8F0FF", sunI: 0.85, hemiI: 0.8, dark: true };
    default: return t;
  }
}
const TRAILS: Record<string, string[]> = {
  stars: ["#FFD23F", "#FFF2A8", "#FFFFFF"], hearts: ["#FF5F7E", "#FF8FB8"], bubbles: ["#CFF1FF", "#FFFFFF", "#9FE6FF"],
  notes: ["#FF4FA3", "#8F6BFF", "#FFD23F"], sparkle: ["#FFFFFF", "#7CE0FF", "#B9A6FF"], rainbow: ["#FF5F5F", "#FF8A3D", "#FFD23F", "#2FCB8B", "#3D8BFF", "#8F6BFF"],
};

const put = (m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy = sx, ry = 0, sz = sx, rz = 0) => {
  const a = m.instanceMatrix.array as Float32Array, o = i * 16;
  const cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
  // R = Ry · Rz, then scale
  a[o] = cy * cz * sx; a[o + 1] = snz * sx; a[o + 2] = -sny * cz * sx; a[o + 3] = 0;
  a[o + 4] = -cy * snz * sy; a[o + 5] = cz * sy; a[o + 6] = sny * snz * sy; a[o + 7] = 0;
  a[o + 8] = sny * sz; a[o + 9] = 0; a[o + 10] = cy * sz; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
};
const setCol = (m: THREE.InstancedMesh, i: number, c: THREE.Color) => { const a = m.instanceColor!.array as Float32Array; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; };
const C = (h: string) => new THREE.Color(h);

interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s: number; c: THREE.Color; g: number }
interface Scenery { obj: THREE.Mesh; y: number; layer: 0 | 1 | 2 }
interface Flyer { id: FriendId; x: number; y: number; t: number; dir: number }

const FRIEND_GEO: Record<FriendId, () => THREE.BufferGeometry> = {
  pip: M.pip, zib: M.zib, bolt: M.bolt, gloop: M.gloop, bonbon: M.bonbon, hoot: M.hoot, turbo: M.turbo, noodle: M.noodle, tiki: M.tiki,
  kranky: () => krankyKrab().scale(0.42, 0.42, 0.42),
};
const VILLAIN_GEO: Record<VillainKind, () => THREE.BufferGeometry> = {
  balloon: balloonBaron, chef: chefGrumble, cloud: stormCloud, robo: roboGeo, boat: boatGeo, ghost: ghostGeo, golem: golemGeo, magma: magmaGeo, ufo: ufoGeo, mech: mechGeo,
};
const DROP_GEO: Record<DropKind, () => THREE.BufferGeometry> = {
  acorn: M.acorn, candy: M.candyDrop, snowball: M.snowball, toyball: () => toyBall("#FF5F5F", "#FFD23F").scale(0.6, 0.6, 0.6).translate(0, -0.3, 0), coconut: M.coconut,
  pumpkin: () => pumpkin().scale(0.45, 0.45, 0.45).translate(0, -0.25, 0), fruit: M.fruit, rock: M.lavaBall, meteor: M.meteor, cannonball: M.cannonball,
};

export class BoingRenderer {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.5, 220);
  private sim: Sim; private th: Theme; private q: Quality; private host: HTMLElement; private theme: WorldId;
  private w = 1; private h = 1; private dist = 22; viewH = 16;
  camY = 0; private shake = 0; private time = 0; private skyT = 0; private skyKey = "";
  private keepList: { dispose(): void }[] = [];
  private keep<T extends { dispose(): void }>(x: T): T { this.keepList.push(x); return x; }
  // play layer
  private slabs: THREE.InstancedMesh; private tops: THREE.InstancedMesh; private drips: THREE.InstancedMesh; private cracks: THREE.InstancedMesh;
  private springs: THREE.InstancedMesh; private gums: THREE.InstancedMesh; private ices: THREE.InstancedMesh; private clouds: THREE.InstancedMesh;
  private deco: THREE.InstancedMesh; private deco2: THREE.InstancedMesh; private endPuffs: THREE.InstancedMesh;
  private tramps: THREE.InstancedMesh; private cannons: THREE.InstancedMesh; private balls: THREE.InstancedMesh; private ghostsOn: THREE.InstancedMesh; private ghostsOff: THREE.InstancedMesh;
  private vents: THREE.InstancedMesh; private planets: THREE.InstancedMesh; private planks: THREE.InstancedMesh; private vineSegs: THREE.InstancedMesh; private columns: THREE.InstancedMesh;
  private flag: THREE.Mesh; private poles: THREE.InstancedMesh;
  private coins: THREE.InstancedMesh; private notes: THREE.InstancedMesh; private bubbles: THREE.InstancedMesh;
  private friendInst = {} as Record<FriendId, THREE.InstancedMesh>;
  private bees: THREE.InstancedMesh; private wings: THREE.InstancedMesh; private sitters: THREE.InstancedMesh;
  private dropMesh: THREE.InstancedMesh; private riseMesh: THREE.InstancedMesh;
  private momo: THREE.Mesh; private ghost: THREE.Mesh;
  private villain: THREE.Mesh | null = null; private villainSpin = 0;
  private ring: THREE.Mesh; private shadow: THREE.Mesh; private glow: THREE.PointLight; private lantern: THREE.PointLight | null = null;
  private moon: THREE.Mesh | null = null;
  private goo: THREE.Mesh; private gooGrumps: THREE.InstancedMesh; private gooBase: Float32Array;
  private parts: Part[] = []; private partMesh: THREE.InstancedMesh;
  private scenery: Scenery[] = [];
  private fgClouds: THREE.Mesh[] = [];
  private groundGeos: THREE.BufferGeometry[] = []; private skyGeos: THREE.BufferGeometry[] = [];
  private amb: THREE.InstancedMesh; private ambP: { x: number; y: number; z: number; s: number; ph: number }[] = [];
  // Momo's squash & stretch and the wobbly friend tower
  private landT = 9; private stackX: { x: number; v: number }[] = []; private lastMomoX = 0;
  private flyers: Flyer[] = [];
  private hat: THREE.Mesh | null = null; private trail: string[] | null = null; private trailT = 0;
  private ghostRun: THREE.Mesh | null = null; private ghostPath: number[] | null = null;
  private ambFall = 0.25; private ambStars = false; private ambCols: string[] = [];
  private colors: Record<string, THREE.Color> = {};
  private seed = 1;

  constructor(host: HTMLElement, sim: Sim, quality: Quality, look?: BoingLook, ghostPath?: number[]) {
    this.host = host; this.sim = sim; this.q = quality;
    this.theme = sim.spec.theme;
    this.th = withTod(THEMES[this.theme] ?? THEMES.garden, sim.spec.tod);
    const th = this.th, theme = this.theme;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", alpha: true, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : quality === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = th.dark ? 1.2 : 1.08;
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    this.paintSky(0, true);

    const sc = this.scene;
    sc.fog = new THREE.Fog(th.fog, th.dark ? 26 : 34, th.dark ? 80 : 105);
    sc.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI ?? 1.15));
    const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.position.set(-6, 12, 9); sc.add(sun);
    const rim = new THREE.DirectionalLight(theme === "lava" ? "#FF8A5A" : theme === "space" ? "#9F8AFF" : "#FFFFFF", th.dark ? 0.5 : 0.35); rim.position.set(7, 4, -6); sc.add(rim);

    const clay = (o: THREE.MeshStandardMaterialParameters = {}) => this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, ...o }));
    const lam = () => this.keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const inst = (g: THREE.BufferGeometry, m: THREE.Material, cap: number, color = false) => {
      const mesh = new THREE.InstancedMesh(this.keep(g), m, cap);
      mesh.frustumCulled = false; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (color) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      sc.add(mesh);
      return mesh;
    };
    const clayM = clay();
    this.slabs = inst(M.slab(), clayM, 90, true);
    this.tops = inst(M.topLayer(), clay({ roughness: 0.6 }), 90, true);
    this.drips = inst(M.drip(), clay({ roughness: 0.55 }), 360, true);
    this.cracks = inst(M.crackLines(), clayM, 40);
    this.springs = inst(theme === "candy" ? M.coilSpring("#FF5FA2", "#FFFFFF") : theme === "snow" ? M.coilSpring("#3D8BFF", "#FFFFFF") : theme === "jungle" ? M.mushroomSpring().scale(1.1, 1.1, 1.1) : M.mushroomSpring(), clay({ roughness: 0.5 }), 24);
    this.gums = inst(M.gumSlab(), clay({ roughness: 0.25, emissive: "#40102A", emissiveIntensity: 0.2 }), 30);
    this.ices = inst(M.iceSlab(), clay({ roughness: 0.1, transparent: true, opacity: 0.84, emissive: "#3FB8F0", emissiveIntensity: 0.18 }), 40, true);
    this.clouds = inst(M.puffCloud(7, 5), clay({ roughness: 0.95 }), 40, true);
    this.endPuffs = inst(tint(new THREE.SphereGeometry(0.2, 10, 8), "#FFFFFF"), clay({ roughness: 0.95 }), 80);
    const decoGeo = theme === "candy" || theme === "toy" ? tint(new THREE.CapsuleGeometry(0.025, 0.08, 2, 4), "#FFFFFF")
      : theme === "snow" ? tint(new THREE.ConeGeometry(0.05, 0.28, 5).rotateX(Math.PI), "#FFFFFF")
      : theme === "jungle" ? M.vineSeg().scale(0.5, 0.6, 0.5).rotateX(Math.PI)
      : theme === "spooky" ? tint(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8).translate(0, 0.09, 0), "#FFF2C8")
      : M.tree("#4FB548").scale(0.18, 0.18, 0.18);
    this.deco = inst(decoGeo, theme === "spooky" ? clay({ emissive: "#FFB347", emissiveIntensity: 0.9 }) : clay(), 400, true);
    this.deco2 = inst(theme === "garden" ? M.sunflower().scale(0.16, 0.16, 0.16) : theme === "beach" ? palmTree().scale(0.22, 0.22, 0.22) : theme === "spooky" ? pumpkin().scale(0.22, 0.22, 0.22) : tint(new THREE.SphereGeometry(0.07, 8, 6), "#FFFFFF"), clay(), 120, theme !== "garden" && theme !== "beach" && theme !== "spooky");
    this.tramps = inst(M.trampMat(), clay({ roughness: 0.5 }), 30);
    this.cannons = inst(M.cannon(), clay({ roughness: 0.4, metalness: 0.2 }), 20);
    this.balls = inst(M.beachBall(), clay({ roughness: 0.35 }), 30);
    this.ghostsOn = inst(M.slab(), this.keep(new THREE.MeshStandardMaterial({ color: "#B9A6FF", emissive: "#7A5AE8", emissiveIntensity: 0.9, transparent: true, opacity: 0.88, roughness: 0.4 })), 40, true);
    this.ghostsOff = inst(M.slab(), this.keep(new THREE.MeshBasicMaterial({ color: "#B9A6FF", transparent: true, opacity: 0.16, depthWrite: false })), 40);
    this.vents = inst(M.ventGlow(), this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF" })), 40, true);
    this.planets = inst(M.planet(), clay({ roughness: 0.55 }), 50, true);
    this.planks = inst(M.plank(), clay({ roughness: 0.7 }), 30);
    this.vineSegs = inst(M.vineSeg(), clay({ roughness: 0.7 }), 160);
    this.columns = inst(M.column(), this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", emissive: "#FFFFFF", emissiveIntensity: 0.25, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false })), 60, true);
    this.flag = new THREE.Mesh(this.keep(M.finishFlag()), clayM); sc.add(this.flag);
    this.poles = inst(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), clay({ vertexColors: false }), 80, true);
    this.coins = inst(M.coin(), clay({ roughness: 0.3, metalness: 0.35, emissive: "#8A5A00", emissiveIntensity: 0.35 }), 80);
    this.notes = inst(M.note(), clay({ roughness: 0.35, emissive: "#8A1A50", emissiveIntensity: 0.35 }), 40);
    this.bubbles = inst(new THREE.SphereGeometry(0.62, 22, 16), this.keep(new THREE.MeshStandardMaterial({ color: "#CFF1FF", transparent: true, opacity: 0.3, roughness: 0.05, emissive: "#8FDCFF", emissiveIntensity: 0.3, depthWrite: false })), 10);
    this.bubbles.renderOrder = 2;
    const friendMat = clay({ roughness: 0.55 });
    for (const id of FRIEND_ORDER) this.friendInst[id] = inst(FRIEND_GEO[id](), friendMat, 12);
    this.bees = inst(theme === "space" ? M.grumpy(th.bee[0], th.bee[1]).scale(1, 0.9, 1) : M.grumpy(th.bee[0], th.bee[1]), clay({ roughness: 0.6, emissive: theme === "lava" ? "#FF5A1F" : "#000000", emissiveIntensity: theme === "lava" ? 0.35 : 0 }), 30);
    this.wings = inst(M.wing(), this.keep(new THREE.MeshStandardMaterial({ color: th.wing, vertexColors: true, transparent: true, opacity: 0.8, roughness: 0.2 })), 60);
    this.sitters = inst(M.grumpy(th.sitter), clay({ roughness: 0.6 }), 24);
    this.dropMesh = inst(DROP_GEO[sim.spec.drops.kind](), clay({ roughness: 0.6, emissive: sim.spec.drops.kind === "meteor" ? "#FF7A3D" : "#000000", emissiveIntensity: 0.4 }), 12);
    this.riseMesh = inst(M.lavaBall(), this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: "#FF6A1F", emissiveIntensity: 0.9, roughness: 0.4 })), 12);
    const momoGeo = this.keep(M.momo());
    const momoMat = clay({ roughness: 0.62 });
    this.momo = new THREE.Mesh(momoGeo, momoMat); this.ghost = new THREE.Mesh(momoGeo, momoMat);
    sc.add(this.momo, this.ghost);
    // the Wardrobe: a hat on Momo's head and a trail behind him
    const hg = look?.hat && look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { hg.scale(0.52, 0.52, 0.52); hg.translate(0, 0.3, 0); this.hat = new THREE.Mesh(this.keep(hg), momoMat); sc.add(this.hat); }
    this.trail = look?.trail && TRAILS[look.trail] ? TRAILS[look.trail] : null;
    // your best try at this stage bounces along as a see-through ghost
    if (ghostPath && ghostPath.length >= 4) {
      this.ghostPath = ghostPath;
      this.ghostRun = new THREE.Mesh(momoGeo, this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.32, depthWrite: false })));
      this.ghostRun.renderOrder = 2; sc.add(this.ghostRun);
    }
    if (sim.villain) {
      this.villain = new THREE.Mesh(this.keep(VILLAIN_GEO[sim.villain.kind]()), clay({ roughness: 0.6 }));
      sc.add(this.villain);
    }
    this.ring = new THREE.Mesh(this.keep(new THREE.TorusGeometry(1, 0.06, 6, 40)), this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.8, depthWrite: false })));
    this.ring.rotation.x = -Math.PI / 2; sc.add(this.ring);
    this.shadow = new THREE.Mesh(this.keep(new THREE.CircleGeometry(0.5, 20)), this.keep(new THREE.MeshBasicMaterial({ color: "#1B1530", transparent: true, opacity: 0.22, depthWrite: false })));
    this.shadow.rotation.x = -Math.PI / 2; sc.add(this.shadow);
    this.glow = new THREE.PointLight("#FFB347", 0, 9, 1.4); sc.add(this.glow);
    // Spooky Night: Momo carries a warm lantern and a big moon hangs in the sky
    if (th.dark) {
      this.lantern = new THREE.PointLight("#FFC27A", 22, 11, 1.3); sc.add(this.lantern);
      this.moon = new THREE.Mesh(this.keep(new THREE.SphereGeometry(5, 32, 20)), this.keep(new THREE.MeshBasicMaterial({ color: "#FFF4C8", fog: false })));
      sc.add(this.moon);
    }
    // the Grumpy Goo (real lava in the Lava Sky): a wobbly surface, Grumpy faces bobbing in it
    const gg = new THREE.PlaneGeometry(60, 18, 120, 1);
    gg.translate(0, -9, 0);
    this.goo = new THREE.Mesh(this.keep(gg), this.keep(new THREE.MeshStandardMaterial({ color: th.goo, roughness: 0.3, emissive: th.gooDark, emissiveIntensity: theme === "lava" ? 1.1 : 0.45 })));
    this.goo.position.z = 0.9; sc.add(this.goo);
    this.gooBase = Float32Array.from((gg.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);
    this.gooGrumps = inst(M.grumpy(th.gooDark), clay({ roughness: 0.4 }), 12);
    this.partMesh = inst(new THREE.SphereGeometry(0.09, 6, 5), this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF" })), quality === "low" ? 160 : 320, true);
    // ambient bits: the world's own, or the weather of a stage after 100
    const wx = sim.spec.weather ?? "none";
    const stars = !!th.stars || wx === "stars";
    this.ambStars = stars;
    this.ambCols = wx === "snow" ? ["#FFFFFF", "#EAF6FF"] : wx === "sprinkles" ? ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF"] : wx === "fireflies" ? ["#FFE680", "#C8FF80"]
      : wx === "leaves" ? ["#7FD86A", "#FFB347", "#5CC452"] : wx === "embers" ? ["#FFB347", "#FF7A1F", "#FFD23F"] : wx === "bubbles" ? ["#CFF1FF", "#FFFFFF"] : wx === "stars" ? ["#FFFFFF", "#CFE0FF", "#FFF2A8"] : th.amb;
    this.ambFall = wx === "snow" ? 0.9 : wx === "sprinkles" ? 1.6 : wx === "fireflies" || wx === "stars" ? 0 : wx === "leaves" ? 0.5 : wx === "embers" ? -1.2 : wx === "bubbles" ? -0.6
      : theme === "snow" ? 0.9 : theme === "lava" ? -1.2 : stars ? 0 : 0.25;
    const ambGeo = wx === "sprinkles" || (wx === "none" && theme === "candy") ? new THREE.CapsuleGeometry(0.03, 0.1, 2, 4) : wx === "leaves" ? new THREE.SphereGeometry(0.09, 6, 4).scale(1, 0.35, 0.6) : new THREE.SphereGeometry(stars ? 0.07 : wx === "bubbles" ? 0.09 : 0.05, 6, 4);
    this.amb = inst(ambGeo, this.keep(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: wx === "bubbles" ? 0.55 : 0.9, fog: !stars })), stars ? 120 : 60, true);
    const nAmb = stars ? (quality === "low" ? 70 : 120) : quality === "low" ? 24 : 50;
    for (let i = 0; i < nAmb; i++) this.ambP.push({ x: (this.rnd() - 0.5) * (stars ? 40 : 16), y: this.rnd() * 30, z: stars ? -10 - this.rnd() * 30 : -8 + this.rnd() * 10, s: 0.6 + this.rnd() * 0.8, ph: this.rnd() * 6 });
    this.buildScenery(lam);
    for (const c of [...th.base, ...th.top, ...th.cloud, th.crumble, th.move, th.pole, th.pole2, ...th.amb, "#FFF6C8", "#FFFFFF", "#9FE6FF", "#FFE7A0"]) this.colors[c] = C(c);
  }

  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  private col(h: string) { return this.colors[h] ?? (this.colors[h] = C(h)); }

  // ---------------------------------------------------------------- sky + scenery layers
  private paintSky(p: number, force = false) {
    const th = this.th, a = th.sky, b = th.high, f = Math.min(1, Math.max(0, p));
    const mix = (x: string, y: string) => `#${C(x).lerp(C(y), f).getHexString()}`;
    const key = `${Math.round(f * 40)}`;
    if (!force && key === this.skyKey) return;
    this.skyKey = key;
    this.host.style.background = `linear-gradient(180deg, ${mix(a[0], b[0])} 0%, ${mix(a[1], b[1])} 55%, ${mix(a[2], b[2])} 100%)`;
  }

  private buildScenery(lam: () => THREE.Material) {
    const theme = this.theme, mat = lam(), K = <T extends THREE.BufferGeometry>(g: T) => this.keep(g);
    const sets: Record<WorldId, [() => THREE.BufferGeometry[], () => THREE.BufferGeometry[]]> = {
      garden: [() => [M.hill("#6FCF5A", "#8EDB6E"), M.tree("#4FB548"), M.hill("#5CC452", "#7FD86A")], () => [M.island("#B9784A", "#5CC452", 2), M.puffCloud(8, 2), M.balloon("#FF8A3D")]],
      candy: [() => [M.hill("#FF9ACB", "#FFFFFF"), M.candyCane(), M.hill("#B58AE8", "#FFE0F2")], () => [M.island("#D9935A", "#FF7AB6", 3), M.puffCloud(8, 3), M.balloon("#FF5FA2")]],
      snow: [() => [M.mountain("#7FA9C9", "#FFFFFF"), M.mountain("#6E98B9", "#F2F8FF"), M.tree("#2E7D5B")], () => [M.island("#8FB1CC", "#FFFFFF", 5), M.puffCloud(8, 7), M.puffCloud(6, 11)]],
      toy: [() => [toyBlocks(), toyBall("#FF5F5F", "#FFD23F"), M.hill("#FFB86B", "#FFE3B3")], () => [M.island("#3D8BFF", "#FF5F5F", 4), M.balloon("#3D8BFF"), M.balloon("#FFD23F"), M.puffCloud(7, 9)]],
      beach: [() => [palmTree(), M.hill("#E3B878", "#F7E3B5"), palmTree()], () => [M.island("#D9A866", "#F7E3B5", 6), M.puffCloud(8, 4), M.balloon("#1E9C91")]],
      spooky: [() => [pumpkin(), M.deadTree(), M.hill("#3A2A5A", "#4A6A3A")], () => [M.island("#4E4062", "#6B8F4E", 7), M.deadTree(), M.puffCloud(7, 8)]],
      jungle: [() => [palmTree(), M.tree("#2E8A38"), M.hill("#3FAE4A", "#5CC452")], () => [M.island("#8A5A34", "#3FAE4A", 8), M.tree("#2E8A38"), M.puffCloud(8, 6)]],
      lava: [() => [M.volcano(), M.mountain("#4A3A36", "#FF7A1F"), M.volcano()], () => [M.island("#3E302C", "#FF7A1F", 9), M.puffCloud(7, 12), M.meteor().scale(3, 3, 3)]],
      space: [() => [M.ringPlanet("#7FA9FF"), M.ringPlanet("#FF8FB8"), M.ringPlanet("#FFD23F")], () => [M.ringPlanet("#8FE3C0"), M.meteor().scale(3, 3, 3), M.ringPlanet("#B58AE8")]],
      castle: [() => [M.tower("#8F6BFF"), M.tower("#FF5F7E"), M.hill("#C9B88A", "#E8DDB0")], () => [M.tower("#C9A227"), M.puffCloud(8, 10), M.balloon("#C9A227")]],
    };
    const [ground, sky] = sets[theme];
    // a blended chapter borrows the other world's sky pieces (and one landmark)
    const mix = this.sim.spec.mix ? sets[this.sim.spec.mix] : null;
    this.groundGeos = [...ground(), ...(mix ? mix[0]().slice(0, 1) : [])].map(K); this.skyGeos = [...sky(), ...(mix && theme !== "space" ? mix[1]() : [])].map(K);
    const make = (layer: 0 | 1 | 2, y: number) => {
      const m = new THREE.Mesh(this.groundGeos[0], mat);
      this.scene.add(m);
      const s: Scenery = { obj: m, y, layer };
      this.placeScenery(s, layer === 0 && y < 6);
      this.scenery.push(s);
    };
    // far (0): every 9 units; mid (1): every 7; near (2): every 6
    for (let i = 0; i < 12; i++) make(0, -8 + i * 9);
    for (let i = 0; i < 10; i++) make(1, -4 + i * 7 + 3);
    for (let i = 0; i < 8; i++) make(2, i * 6 + 2);
    // a soft cloud now and then drifts past in front of the column
    const fgMat = this.keep(new THREE.MeshLambertMaterial({ color: this.th.dark ? "#8A7AB8" : theme === "lava" ? "#A08080" : "#FFFFFF", transparent: true, opacity: theme === "space" ? 0.15 : 0.3, depthWrite: false }));
    const fgGeo = K(M.puffCloud(9, 13));
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(fgGeo, fgMat);
      m.scale.set(5.5, 2.5, 2); m.position.set((i ? 1 : -1) * 4.8, 22 + i * 26, 6.5); m.renderOrder = 3;
      this.scene.add(m); this.fgClouds.push(m);
    }
  }
  private placeScenery(s: Scenery, ground: boolean) {
    const r = () => this.rnd(), side = r() < 0.5 ? -1 : 1, m = s.obj;
    const space = this.theme === "space";
    const pool = ground ? this.groundGeos : this.skyGeos;
    // in space only the far layer has ringed planets (near ones would look like platforms): asteroids drift closer in
    m.geometry = space && s.layer > 0 ? this.skyGeos[1] : pool[Math.floor(r() * pool.length)];
    if (s.layer === 0) {
      const z = -48 - r() * 18;
      if (ground && !space) { m.position.set((r() - 0.5) * 70, s.y - 6, z); const k = 6 + r() * 7; m.scale.set(k * (1.2 + r() * 0.6), k, k); }
      else { m.position.set(side * (14 + r() * 22), s.y, z); const k = (space ? 4 : 3) + r() * 4; m.scale.set(k * (space ? 1 : 1.3), k, k); }
    } else if (s.layer === 1) {
      m.position.set(side * (9 + r() * 9), s.y, -18 - r() * 8); const k = (space ? 1.6 : 1.3) + r() * 1.5; m.scale.set(k * (space ? 1 : 1.4), k, k);
    } else {
      m.position.set(side * (5 + r() * 4), s.y, -5 - r() * 3); const k = 0.9 + r() * 0.8; m.scale.set(k * 1.5, k * 0.9, k);
    }
    m.rotation.y = (r() - 0.5) * 0.8;
  }
  private updateScenery() {
    const cy = this.camY;
    for (const s of this.scenery) {
      const span = s.layer === 0 ? 108 : s.layer === 1 ? 70 : 48, below = s.layer === 0 ? 45 : s.layer === 1 ? 26 : 16;
      if (s.y < cy - below) { s.y += span; this.placeScenery(s, false); }
    }
    for (const m of this.fgClouds) if (m.position.y < cy - 22) { m.position.y += 52 + this.rnd() * 20; m.position.x = (this.rnd() < 0.5 ? -1 : 1) * (3.5 + this.rnd() * 2.5); }
    if (this.moon) this.moon.position.set(-16, cy + 11, -75);
  }

  // ---------------------------------------------------------------- view
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    const aspect = this.w / this.h, tan = Math.tan((this.camera.fov * Math.PI) / 360);
    // the whole column fits the width on phones; wide screens show at least 15.5 units of sky
    this.viewH = Math.max((HALF * 2 + 0.9) / aspect, 15.5);
    this.dist = this.viewH / (2 * tan);
    this.camera.aspect = aspect; this.camera.far = this.dist + 120;
    this.camera.updateProjectionMatrix();
  }
  screen(x: number, y: number, z = 0): [number, number] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h];
  }

  // ---------------------------------------------------------------- effects
  private burst(x: number, y: number, n: number, sp: number, cols: string[], g = 12, size = 1) {
    const cap = this.partMesh.instanceMatrix.count;
    for (let i = 0; i < n && this.parts.length < cap; i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.6);
      this.parts.push({ x, y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s + sp * 0.3, vz: (Math.random() - 0.3) * sp * 0.5, life: 0, max: 0.5 + Math.random() * 0.4, s: (0.7 + Math.random() * 0.8) * size, c: this.col(cols[i % cols.length]), g });
    }
  }
  private onEvent(e: SimEvent) {
    const th = this.th, s = this.sim;
    const conf = ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#B26BFF"];
    switch (e.t) {
      case "land": this.landT = 0; this.burst(e.x, e.y + 0.05, e.perfect ? 4 : 6, 2.2, ["#FFFFFF", "#F4EEE6"], 6, 0.9); break;
      case "perfect": this.burst(e.x, e.y + 0.3, 14 + Math.min(10, e.chain * 2), 5.5, ["#FFD23F", "#FFFFFF", "#FF8A3D"], 4); break;
      case "stomp": this.burst(e.x, e.y + 0.4, 22, 6, conf, 9); this.shake = Math.min(1, this.shake + 0.25); break;
      case "coin": this.burst(e.x, e.y, 6, 3, ["#FFD23F", "#FFF2A8"], 2, 0.8); break;
      case "note": this.burst(e.x, e.y, 10, 3.5, ["#FF4FA3", "#FFD8F0", "#FFFFFF"], 2); break;
      case "friendJoin": this.burst(e.x, e.y, 18, 5, ["#CFF1FF", "#FFFFFF", "#8FDCFF"], 3); break;
      case "friendSave": this.flyers.push({ id: e.id, x: e.x, y: e.y + 1.4, t: 0, dir: e.x > 0 ? -1 : 1 }); this.burst(e.x, e.y, 24, 6, ["#FFFFFF", "#FFD23F", "#7CE0FF"], 6); this.shake = Math.min(1, this.shake + 0.5); break;
      case "hit": this.shake = Math.min(1, this.shake + 0.45); this.burst(e.x, e.y + 0.5, 10, 4, ["#FF5F7E", "#FFFFFF"], 8); break;
      case "crumble": this.burst(e.x, e.y - 0.2, 12, 3, [th.crumble, th.base[0]], 14, 1.1); break;
      case "spring": this.burst(e.x, e.y + 0.4, 10, 4, ["#FFFFFF", "#FFD23F"], 6); break;
      case "gum": this.burst(e.x, e.y + 0.2, 12, 4, ["#FF7AB6", "#FFB3D6", "#FFFFFF"], 8); break;
      case "cannon": this.burst(e.x, e.y + 1, 26, 7, ["#FFFFFF", "#D9D9E8", "#FFD23F", "#FF8A3D"], 3, 1.4); this.shake = Math.min(1, this.shake + 0.55); break;
      case "vine": this.burst(e.x, e.y + 0.5, 10, 3, ["#5CCB52", "#3FAE4A"], 8); break;
      case "lift": this.burst(e.x, e.y + 0.2, 14, 4.5, this.theme === "lava" ? ["#FFB347", "#FF6A1F", "#FFD23F"] : ["#FFFFFF", "#9FE6FF", "#5FC8EA"], 6); break;
      case "cake": for (let i = 0; i < 6; i++) this.burst((i - 2.5) * 1.3, s.y + 2 + (i % 3) * 2, 18, 6, ["#FF8FB8", "#FFFFFF", "#FFD23F", "#FF4FA3"], 6, 1.2); this.shake = Math.min(1, this.shake + 0.4); break;
      case "snip": this.burst(e.x, e.y + 0.3, 16, 5, ["#E8504F", "#FFFFFF"], 6); break;
      case "double": this.burst(e.x, e.y + 0.1, 12, 3, ["#FFFFFF", "#FF8A3D"], 4); this.landT = 0; break;
      case "card": this.burst(s.x, s.y + 1, 30, 6, ["#FFD23F", "#FFFFFF", "#8F6BFF"], 4); break;
      case "comet": if (e.on) { this.shake = Math.min(1, this.shake + 0.4); this.burst(s.x, s.y, 26, 7, ["#FFD23F", "#FF8A3D", "#FFFFFF"], 2); } break;
      case "safe": this.burst(s.x, e.y + 0.6, 30, 6, conf, 5); break;
      case "end": if (e.won) for (let i = 0; i < 4; i++) this.burst(s.x + (i - 1.5) * 1.6, s.y + 1, 26, 8, [...conf, "#FFFFFF"], 7); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number, events: SimEvent[]) {
    this.time += dt;
    const s = this.sim, t = this.time, th = this.th, theme = this.theme;
    for (const e of events) this.onEvent(e);
    // camera: the death line sits at the bottom of the screen; it only ever goes up
    const target = s.floor + this.viewH / 2 - 0.4;
    this.camY = this.camY === 0 && target > 0 ? target : this.camY + (Math.max(this.camY, target) - this.camY) * Math.min(1, dt * 7);
    if (s.phase === "play" && target > this.camY) this.camY = Math.max(this.camY, target - 3);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.25;
    this.camera.position.set((Math.random() - 0.5) * sh, this.camY + 3.4 + (Math.random() - 0.5) * sh, this.dist);
    this.camera.lookAt(0, this.camY, 0);
    const y0 = this.camY - this.viewH / 2 - 2.5, y1 = this.camY + this.viewH / 2 + 3.5;
    this.skyT -= dt;
    if (this.skyT <= 0) { this.skyT = 0.3; this.paintSky(s.spec.demo ? 0.2 : s.maxY / Math.max(1, s.spec.top)); }
    this.updateScenery();

    // ---- platforms
    let ns = 0, nt = 0, nd = 0, nc = 0, nsp = 0, ng = 0, ni = 0, ncl = 0, nde = 0, nd2 = 0, nep = 0;
    let ntr = 0, nca = 0, nba = 0, ngo = 0, ngf = 0, nve = 0, npl = 0, npk = 0;
    const capDrip = this.drips.instanceMatrix.count, capDeco = this.deco.instanceMatrix.count, capD2 = this.deco2.instanceMatrix.count;
    this.flag.visible = false;
    for (const p of s.plats) {
      const py = p.y + p.dy;
      if (py < y0 || py > y1) continue;
      if (!p.alive && p.kind !== "crumble") continue;
      const sq = 1 - p.squish * 0.22, w = p.w, idv = p.id;
      const fall = !p.alive ? Math.min(1, -p.dy / 3) : 0, rot = !p.alive ? p.dy * 0.15 * (idv % 2 ? 1 : -1) : 0;
      switch (p.kind) {
        case "cloud": case "safe": case "finish": {
          if (ncl >= 40) continue;
          put(this.clouds, ncl, p.x, py - 0.12 - p.squish * 0.12, 0, w * 1.15, 0.9 * sq + 0.15, 0, 1.2);
          setCol(this.clouds, ncl, this.col(p.kind === "finish" ? "#FFE7A0" : p.kind === "safe" ? "#FFFFFF" : th.cloud[idv % th.cloud.length]));
          ncl++;
          if (p.kind === "finish") { this.flag.visible = true; this.flag.position.set(p.x + w * 0.32, py + 0.1, -0.2); this.flag.rotation.y = Math.sin(t * 2) * 0.1; }
          continue;
        }
        case "gum": if (ng < 30) put(this.gums, ng++, p.x, py - p.squish * 0.08, 0, w, 1 - p.squish * 0.35, 0, 1); continue;
        case "ice": if (ni < 40) { put(this.ices, ni, p.x, py, 0, w, sq, 0, 1); setCol(this.ices, ni, this.col("#9FE6FF")); ni++; } continue;
        case "ball": if (nba < 30) put(this.balls, nba++, p.x, py - p.squish * 0.06, 0, w, 1 - p.squish * 0.2, -(p.x - p.x0) * 0.9, 1); continue;
        case "planet": if (npl < 50) { const r = w * 0.5; put(this.planets, npl, p.x, py - r * 0.92 - p.squish * 0.05, 0, w, w * (1 - p.squish * 0.12), t * 0.4 + idv, w); setCol(this.planets, npl, this.col(th.base[idv % th.base.length])); npl++; } continue;
        case "ghost": {
          const lv = ghostLevel(p, s.t);
          if (lv > 0.5 && ngo < 40) { put(this.ghostsOn, ngo, p.x, py, 0, w, sq * (0.7 + lv * 0.3), 0, 1); setCol(this.ghostsOn, ngo, this.col(lv > 0.85 ? "#FFFFFF" : "#D8CCFF")); ngo++; }
          else if (ngf < 40) put(this.ghostsOff, ngf++, p.x, py, 0, w, 0.8, 0, 1);
          continue;
        }
        case "bridge": {
          if (npk >= 30) continue;
          const a = bridgeAngle(p, s.t), px = p.x - w / 2;
          put(this.planks, npk++, px + (w / 2) * Math.cos(a), py + (w / 2) * Math.sin(a) - p.squish * 0.05, 0, w, 1, 0, 1, a);
          if (ns < 90) { put(this.slabs, ns, px - 0.12, py - 0.3, 0, 0.3, 1.6, 0, 0.4); setCol(this.slabs, ns, this.col(th.base[0])); ns++; }
          continue;
        }
        default: break;
      }
      if (ns >= 90) continue;
      put(this.slabs, ns, p.x, py, 0, w, sq * (1 - fall * 0.3), 0, 1, rot);
      setCol(this.slabs, ns, this.col(p.kind === "crumble" ? th.crumble : p.kind === "move" ? th.move : th.base[idv % th.base.length]));
      ns++;
      if (p.kind === "cannon") { if (nca < 20) put(this.cannons, nca++, p.x, py, 0.05, 1, 1 - p.squish * 0.15 + (s.stuckPlat === p ? Math.sin(t * 40) * 0.04 : 0)); continue; }
      put(this.tops, nt, p.x, py, 0, w, sq, 0, 1, rot);
      setCol(this.tops, nt, this.col(th.top[idv % th.top.length]));
      nt++;
      if (p.kind === "tramp" && ntr < 30) put(this.tramps, ntr++, p.x, py + 0.12, 0.05, w * 0.95, 1 - p.squish * 0.5, 0, 1.05);
      if (p.kind === "vent" && nve < 40) {
        const hot = ventHot(p, s.t), lv = Math.max(0, Math.min(1, (Math.sin(s.t * 1.8 + (p.ph ?? 0)) + 0.2) / 0.7));
        put(this.vents, nve, p.x, py + 0.04, 0.05, w * 0.9, 1, 0, 1);
        setCol(this.vents, nve, this.col(hot ? "#FFE680" : lv > 0.5 ? "#FF9A3D" : "#8A2A12")); nve++;
        if (hot && Math.random() < dt * 20) this.parts.length < this.partMesh.instanceMatrix.count && this.parts.push({ x: p.x + (Math.random() - 0.5) * w * 0.7, y: py + 0.1, z: 0.3, vx: (Math.random() - 0.5), vy: 4 + Math.random() * 3, vz: 0, life: 0, max: 0.6, s: 1.2, c: this.col(Math.random() < 0.5 ? "#FFB347" : "#FF6A1F"), g: 2 });
      }
      if (th.drips && nd + 3 < capDrip && p.kind !== "move") {
        const tc = this.col(th.top[idv % th.top.length]);
        for (let k = 0; k < 3; k++) { const fx = (k - 1) * w * 0.3 + ((idv * 7 + k * 3) % 5 - 2) * 0.04; put(this.drips, nd, p.x + fx, py - 0.14 - fall, 0.66, 1, 0.7 + ((idv + k) % 3) * 0.25, 0, 1, rot); setCol(this.drips, nd, tc); nd++; }
      }
      if (p.kind === "crumble" && p.alive && nc < 40) put(this.cracks, nc++, p.x, py + 0.04, 0, w, 1, 0, 1);
      if (p.kind === "spring" && nsp < 24) put(this.springs, nsp++, p.x, py + 0.05, 0.05, 1, 1 - p.squish * 0.45, 0, 1);
      if (p.kind === "move" && nep + 2 <= 80) for (const sx of [-1, 1]) put(this.endPuffs, nep++, p.x + sx * (w / 2 + 0.05), py - 0.18 + Math.sin(t * 6 + idv) * 0.04, 0, 1.2 + Math.sin(t * 8 + sx) * 0.15);
      // little decorations on the tops (garden trees, candy sprinkles, snow icicles, spooky candles, jungle moss…)
      if (p.alive && p.kind !== "move" && p.kind !== "tramp" && p.kind !== "vent") {
        if (theme === "candy" || theme === "toy") {
          for (let k = 0; k < (theme === "toy" ? 3 : 6) && nde < capDeco; k++) { const fx = ((idv * 13 + k * 7) % 11 / 10 - 0.5) * w * 0.8, fz = ((idv + k * 5) % 7 / 6 - 0.5) * 0.9; put(this.deco, nde, p.x + fx, py + 0.05, fz, theme === "toy" ? 1.8 : 1, theme === "toy" ? 1.8 : 1, k * 1.3, theme === "toy" ? 1.8 : 1, Math.PI / 2); setCol(this.deco, nde, this.col(th.amb[(idv + k) % th.amb.length])); nde++; }
        } else if (theme === "snow") {
          for (let k = 0; k < 3 && nde < capDeco; k++) { put(this.deco, nde, p.x + (k - 1) * w * 0.28, py - 0.48, 0.55, 1, 0.8 + ((idv + k) % 3) * 0.3); setCol(this.deco, nde, this.col("#DFF4FF")); nde++; }
          if (nd2 < capD2) { put(this.deco2, nd2, p.x + ((idv % 5) - 2) * 0.15 * w, py + 0.06, 0.2, 1.4, 0.7); setCol(this.deco2, nd2, this.col("#FFFFFF")); nd2++; }
        } else if (theme === "jungle") {
          for (let k = 0; k < 2 && nde < capDeco; k++) { put(this.deco, nde, p.x + (k ? 0.3 : -0.3) * w, py - 0.25, 0.6, 1, 0.8 + ((idv + k) % 3) * 0.4); setCol(this.deco, nde, this.col("#FFFFFF")); nde++; }
        } else if (theme === "spooky") {
          if (idv % 2 === 0 && nde < capDeco) { put(this.deco, nde, p.x + (idv % 4 ? 0.32 : -0.32) * w, py - 0.02, 0.3, 1); setCol(this.deco, nde, this.col("#FFF2C8")); nde++; }
          if (idv % 5 === 1 && nd2 < capD2 && w > 1.3) put(this.deco2, nd2++, p.x - 0.3 * w, py - 0.02, -0.3, 1, 1, idv);
        } else if (theme === "beach") {
          if (idv % 4 === 0 && nd2 < capD2 && w > 1.4) put(this.deco2, nd2++, p.x + (idv % 8 ? 0.36 : -0.36) * w, py - 0.02, -0.35, 1, 1, idv);
        } else if (theme === "garden") {
          if (idv % 3 === 0 && nd2 < capD2 && w > 1.3) put(this.deco2, nd2++, p.x + (idv % 2 ? 0.35 : -0.35) * w, py - 0.02, -0.35, 1, 1, idv);
          else if (idv % 3 === 1 && nde < capDeco && w > 1.2) { put(this.deco, nde, p.x + (idv % 2 ? -0.38 : 0.38) * w, py - 0.02, -0.4, 1, 1, idv); setCol(this.deco, nde, this.col("#FFFFFF")); nde++; }
        }
      }
    }
    this.slabs.count = ns; this.tops.count = nt; this.drips.count = nd; this.cracks.count = nc; this.springs.count = nsp; this.gums.count = ng; this.ices.count = ni;
    this.clouds.count = ncl; this.deco.count = nde; this.deco2.count = nd2; this.endPuffs.count = nep;
    this.tramps.count = ntr; this.cannons.count = nca; this.balls.count = nba; this.ghostsOn.count = ngo; this.ghostsOff.count = ngf; this.vents.count = nve; this.planets.count = npl; this.planks.count = npk;

    // ---- vines and lifts (water spouts / lava geysers)
    let nv = 0, ncol = 0;
    for (const v of s.spec.vines) {
      if (v.y1 < y0 || v.y0 > y1) continue;
      for (let yy = Math.max(v.y0, y0 - 1); yy < Math.min(v.y1, y1 + 1) && nv < 160; yy += 1) put(this.vineSegs, nv++, v.x + Math.sin(t * 1.3 + yy * 0.7) * 0.06, yy, -0.2, 1, 1, yy * 1.7, 1, Math.sin(t + yy) * 0.05);
    }
    for (const l of s.spec.lifts) {
      if (l.y1 < y0 || l.y0 > y1) continue;
      const on = liftOn(l, s.t), lava = l.kind === "geyser";
      const top = on ? l.y1 : l.y0 + 0.8;
      for (let yy = l.y0; yy < top && ncol < 60; yy += 1) {
        put(this.columns, ncol, l.x, yy, 0.1, 1 + Math.sin(t * 9 + yy) * 0.08, Math.min(1, top - yy), t * 3 + yy);
        setCol(this.columns, ncol, this.col(lava ? (on ? "#FF8A3D" : "#5A2A22") : "#7FD8FF")); ncol++;
      }
      if (on && Math.random() < dt * 14) this.parts.length < this.partMesh.instanceMatrix.count && this.parts.push({ x: l.x + (Math.random() - 0.5) * 0.8, y: top, z: 0.3, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 2, vz: 0, life: 0, max: 0.5, s: 1.3, c: this.col(lava ? "#FFD23F" : "#FFFFFF"), g: 9 });
    }
    this.vineSegs.count = nv; this.columns.count = ncol;

    // ---- the wrap edges: two decorated poles
    let np = 0;
    const segY = Math.floor(y0 / 1.2) * 1.2;
    for (let yy = segY; yy < y1 + 1.2 && np + 2 <= 80; yy += 1.2) for (const sx of [-1, 1]) { put(this.poles, np, sx * (HALF + 0.55), yy, -0.6, 1); setCol(this.poles, np, this.col(Math.round(yy / 1.2) % 2 ? th.pole : th.pole2)); np++; }
    this.poles.count = np;

    // ---- pickups
    let nco = 0, nno = 0, nb = 0;
    const fc = Object.fromEntries(FRIEND_ORDER.map((f) => [f, 0])) as Record<FriendId, number>;
    for (const it of s.items) {
      if (it.taken || it.y < y0 || it.y > y1) continue;
      const bob = Math.sin(t * 3 + it.ph) * 0.12;
      if (it.kind === "coin" && nco < 80) put(this.coins, nco++, it.x, it.y + bob, 0.2, 1, 1, t * 3 + it.ph);
      else if (it.kind === "note" && nno < 40) put(this.notes, nno++, it.x, it.y + bob, 0.2, 1.3, 1.3, Math.sin(t * 2 + it.ph) * 0.6);
      else if (it.kind === "friend" && it.friend && nb < 10) {
        const k = 1 + Math.sin(t * 4 + it.ph) * 0.04;
        put(this.bubbles, nb++, it.x, it.y + bob, 0.1, k, k * 0.96);
        const fm = this.friendInst[it.friend];
        if (fc[it.friend] < 12) put(fm, fc[it.friend]++, it.x, it.y + bob - 0.42, 0.1, 0.62, 0.62, Math.sin(t * 2 + it.ph) * 0.4);
      }
    }
    this.coins.count = nco; this.notes.count = nno; this.bubbles.count = nb;

    // ---- Grumpies
    let nbe = 0, nw = 0, nsi = 0;
    for (const e of s.enemies) {
      if (e.y < y0 || e.y > y1) continue;
      const pop = e.alive ? 0 : e.deadT;
      if (!e.alive && pop > 0.22) continue;
      const k = e.alive ? 0.85 : 0.85 * (1 + pop * 3), sy = e.alive ? 1 : Math.max(0.05, 1 - pop * 4);
      if (e.kind === "bee" && nbe < 30) {
        put(this.bees, nbe++, e.x, e.y + 0.05, 0, k, k * sy, e.dir * 0.35);
        if (e.alive && nw + 2 <= 60) {
          const fl = Math.abs(Math.sin(t * (theme === "spooky" ? 14 : 28) + e.ph));
          const ws = theme === "spooky" ? 1.5 : theme === "beach" ? 1.4 : 1;
          put(this.wings, nw++, e.x - 0.08, e.y + 0.62, -0.1, ws, (0.4 + fl * 0.8) * ws, 0.5 + e.dir * 0.3, ws, 0.5);
          put(this.wings, nw++, e.x + 0.08, e.y + 0.62, -0.1, ws, (0.4 + fl * 0.8) * ws, Math.PI - 0.5 + e.dir * 0.3, ws, 0.5);
        }
      } else if (e.kind === "sitter" && nsi < 24) {
        const br = e.alive ? 1 + Math.sin(t * 3 + e.ph) * 0.05 : 1;
        put(this.sitters, nsi++, e.x, e.y, 0, k, k * sy * br);
      }
    }
    this.bees.count = nbe; this.wings.count = nw; this.sitters.count = nsi;

    // ---- drops (the "!" warning is a DOM marker from the session); lava bubbles rise from below
    let ndr = 0, nri = 0;
    for (const d of s.drops) {
      if (!d.falling || d.y < y0 - 2 || d.y > y1 + 4) continue;
      if (d.up) { if (nri < 12) put(this.riseMesh, nri++, d.x, d.y, 0.2, 1 + Math.sin(t * 20 + d.id) * 0.08); }
      else if (ndr < 12) put(this.dropMesh, ndr++, d.x, d.y, 0.2, 1, 1, t * 4 + d.id, 1, t * 3);
    }
    this.dropMesh.count = ndr; this.riseMesh.count = nri;

    // ---- villain
    if (this.villain && s.villain) {
      const v = s.villain;
      if (v.bonked) { this.villainSpin += dt; this.villain.rotation.z += dt * 9; this.villain.position.y += dt * 6; this.villain.position.x += dt * 4; this.villain.scale.setScalar(Math.max(0.01, 1.25 - this.villainSpin * 0.6)); }
      else { this.villain.position.set(v.x, v.y + Math.sin(t * 1.6) * 0.35, -0.5); this.villain.rotation.y = Math.sin(t * 0.8) * 0.3; this.villain.scale.setScalar(1.25); }
    }

    // ---- Momo
    this.landT += dt;
    const mm = this.momo, comet = s.cometT > 0, stuck = s.stuckT > 0, climbing = s.vine >= 0;
    let sx = 1, sy = 1;
    if (stuck) { sx = 1.25; sy = 0.7; if (s.stuckPlat?.kind === "cannon") { sx = 0.6; sy = 0.6; } }
    else if (comet) { sx = 0.82; sy = 1.3; }
    else if (climbing) { const c = Math.sin(t * 16) * 0.08; sx = 1 - c; sy = 1 + c; }
    else if (this.landT < 0.13) { const f = 1 - this.landT / 0.13; sx = 1 + 0.28 * f; sy = 1 - 0.3 * f; }
    else { const st = Math.max(-0.12, Math.min(0.16, s.vy * 0.011)); sx = 1 - st * 0.6; sy = 1 + st; }
    const blink = s.invulnT > 0 && Math.floor(t * 14) % 2 === 0;
    const sc = 0.95;
    const momoY = stuck && s.stuckPlat?.kind === "cannon" ? s.y + 0.45 : s.y;
    mm.position.set(s.x, momoY, 0.35); mm.scale.set(sc * sx, sc * sy, sc * sx);
    mm.rotation.set(0, Math.max(-0.5, Math.min(0.5, s.vx * 0.04)), comet ? 0 : Math.max(-0.35, Math.min(0.35, -s.vx * 0.03)));
    mm.visible = !blink;
    const nearEdge = Math.abs(s.x) > HALF - 0.7;
    this.ghost.visible = nearEdge && !blink;
    if (nearEdge) { this.ghost.position.set(s.x - Math.sign(s.x) * HALF * 2, momoY, 0.35); this.ghost.scale.copy(mm.scale); this.ghost.rotation.copy(mm.rotation); }
    this.glow.intensity = comet ? 26 : 0;
    this.glow.position.set(s.x, s.y + 0.6, 1.5);
    if (this.lantern) this.lantern.position.set(s.x, s.y + 1.2, 2.2);
    if (this.hat) { this.hat.position.copy(mm.position); this.hat.scale.copy(mm.scale); this.hat.rotation.copy(mm.rotation); this.hat.visible = mm.visible; }
    if (this.trail && s.phase === "play" && !stuck && (comet || Math.abs(s.vy) > 2)) {
      this.trailT -= dt;
      if (this.trailT <= 0 && this.parts.length < this.partMesh.instanceMatrix.count) {
        this.trailT = 0.035;
        const c = this.trail[Math.floor(t * 12) % this.trail.length];
        this.parts.push({ x: s.x + (Math.random() - 0.5) * 0.3, y: s.y + 0.3, z: 0.1, vx: (Math.random() - 0.5) * 0.6, vy: this.trail === TRAILS.bubbles ? 0.8 : -0.4, vz: 0, life: 0, max: 0.6, s: 1.3, c: this.col(c), g: 0 });
      }
    }
    if (this.ghostRun && this.ghostPath) {
      const gp = this.ghostPath, f = s.t / 0.1, i = Math.floor(f), k = (i + 1) * 2 + 1;
      if (k < gp.length) {
        const a = f - i, gx = gp[i * 2] + (gp[i * 2 + 2] - gp[i * 2]) * a, gy2 = gp[i * 2 + 1] + (gp[i * 2 + 3] - gp[i * 2 + 1]) * a;
        this.ghostRun.visible = Math.abs(gp[i * 2 + 2] - gp[i * 2]) < 3; this.ghostRun.position.set(gx, gy2, 0.1); this.ghostRun.scale.setScalar(0.9);
      } else this.ghostRun.visible = false;
    }
    if (comet) for (let i = 0; i < 3; i++) this.parts.length < this.partMesh.instanceMatrix.count && this.parts.push({ x: s.x + (Math.random() - 0.5) * 0.5, y: s.y + 0.1, z: 0.2, vx: (Math.random() - 0.5) * 1.5, vy: -3 - Math.random() * 3, vz: 0, life: 0, max: 0.55, s: 2.2 + Math.random(), c: this.col(i % 2 ? "#FFD23F" : "#FF8A3D"), g: 0 });

    // ---- the friend tower (each one wobbles after the one below)
    const stack = s.stack;
    while (this.stackX.length < stack.length) this.stackX.push({ x: 0, v: 0 });
    this.stackX.length = stack.length;
    const fcount = { ...fc };
    // offsets from Momo: when he moves, each friend lags behind the one below and springs back (wobbly tower)
    let mdx = s.x - this.lastMomoX; if (mdx > HALF) mdx -= HALF * 2; if (mdx < -HALF) mdx += HALF * 2;
    mdx = Math.max(-1.5, Math.min(1.5, mdx)); this.lastMomoX = s.x;
    let prevOff = 0, hy = momoY + 1.08 * sc * sy;
    for (let i = 0; i < stack.length; i++) {
      const o = this.stackX[i];
      o.x -= mdx;
      o.v += ((prevOff - o.x) * 90 - o.v * 9) * Math.min(dt, 0.05); o.x += o.v * Math.min(dt, 0.05);
      o.x = Math.max(-1.1, Math.min(1.1, o.x));
      const id = stack[i], fm = this.friendInst[id], k = 0.66;
      if (fcount[id] < 12 && !blink) put(fm, fcount[id]++, s.x + o.x, hy, 0.3, k, k * (comet ? 1.15 : sy), Math.sin(t * 2 + i) * 0.25, k, Math.max(-0.4, Math.min(0.4, -o.v * 0.05)));
      prevOff = o.x; hy += 0.8 * k * (comet ? 1.15 : 1);
    }
    // friends flying off after a save
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i]; f.t += dt;
      if (f.t > 1.4) { this.flyers.splice(i, 1); continue; }
      const fm = this.friendInst[f.id];
      if (fcount[f.id] < 12) put(fm, fcount[f.id]++, f.x + f.dir * f.t * 3, f.y + f.t * 5 - f.t * f.t * 2, 0.6, 0.66, 0.66, f.t * 8, 0.66, f.t * 6 * f.dir);
    }
    for (const id of FRIEND_ORDER) this.friendInst[id].count = fcount[id];

    // ---- landing shadow + the Perfect Boing ring on the platform below
    let below: { x: number; y: number; w: number } | null = null;
    for (const p of s.plats) if (s.solid(p) && p.y <= s.y + 0.01 && Math.abs(((s.x - p.x + HALF * 3) % (HALF * 2)) - HALF) <= p.w / 2 + MOMO_R * 0.55 && (!below || p.y > below.y)) below = p;
    if (below && !comet && !climbing && s.phase === "play") {
      const hgt = s.y - below.y;
      this.shadow.visible = true; this.shadow.position.set(s.x, below.y + 0.03, 0.35);
      const ss = Math.max(0.35, 1 - hgt * 0.08); this.shadow.scale.set(ss * 1.2, ss, 1);
      const ttl = s.vy < 0 ? hgt / Math.max(0.5, -s.vy) : 9;
      if (ttl < 0.55 && !s.spec.demo && !stuck) {
        const inWin = ttl <= s.window;
        this.ring.visible = true; this.ring.position.set(s.x, below.y + 0.06, 0.35);
        const rr = 0.42 + Math.min(1, ttl / 0.55) * 1.0; this.ring.scale.set(rr * 1.25, rr, 1);
        const rm = this.ring.material as THREE.MeshBasicMaterial;
        rm.color.set(inWin ? "#FFD23F" : "#FFFFFF"); rm.opacity = inWin ? 0.95 : 0.55;
      } else this.ring.visible = false;
    } else { this.shadow.visible = false; this.ring.visible = false; }

    // ---- the Grumpy Goo
    const gy = s.gooY;
    this.goo.visible = gy > y0 - 2 && !s.spec.demo;
    let ngg = 0;
    if (this.goo.visible) {
      this.goo.position.y = gy;
      const pos = this.goo.geometry.getAttribute("position") as THREE.BufferAttribute, arr = pos.array as Float32Array, base = this.gooBase;
      const cols = 121;
      for (let i = 0; i < cols; i++) { const x = base[i * 3]; arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x * 0.9 + t * 2.4) * 0.22 + Math.sin(x * 2.3 - t * 3.1) * 0.1; }
      pos.needsUpdate = true;
      for (let i = 0; i < 9; i++) {
        const x = -5.6 + i * 1.4 + Math.sin(t * 0.7 + i) * 0.3, bob = Math.sin(t * 2.2 + i * 1.7) * 0.18;
        put(this.gooGrumps, ngg++, x, gy - 0.55 + bob + Math.sin(x * 0.9 + t * 2.4) * 0.22, 1.1, 0.8, 0.8, Math.sin(t + i) * 0.4);
      }
      if (Math.random() < dt * 6 && this.parts.length < this.partMesh.instanceMatrix.count) this.parts.push({ x: (Math.random() - 0.5) * 10, y: gy + 0.05, z: 1.2, vx: 0, vy: 1.4, vz: 0, life: 0, max: 0.6, s: 1.5 + Math.random() * 1.5, c: this.col(theme === "lava" ? "#FFD23F" : th.goo), g: 2.5 });
    }
    this.gooGrumps.count = ngg;

    // ---- ambient sparkles (pollen, sprinkles, snowflakes, fireflies, embers, stars)
    let na = 0;
    const fallV = this.ambFall, starry = this.ambStars, fireflies = this.sim.spec.weather === "fireflies";
    for (const a of this.ambP) {
      a.y -= dt * fallV; if (!starry) a.x += Math.sin(t * (fireflies ? 1.4 : 0.6) + a.ph) * dt * (fireflies ? 0.9 : 0.4);
      if (fireflies) a.y += Math.cos(t * 1.1 + a.ph) * dt * 0.5;
      const span = starry ? 60 : y1 - y0 + 2, base = starry ? this.camY - 30 : y0 - 1;
      if (a.y < base) a.y += span; if (a.y > base + span) a.y -= span;
      const tw = starry || fireflies ? 0.6 + 0.4 * Math.abs(Math.sin(t * (fireflies ? 3 : 1.5) + a.ph * 3)) : 1;
      put(this.amb, na, a.x, a.y, a.z, a.s * tw, a.s * tw, t + a.ph, a.s * tw, t * 0.7 + a.ph); setCol(this.amb, na, this.col(this.ambCols[na % this.ambCols.length])); na++;
    }
    this.amb.count = na;

    // ---- particles
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.s * (1 - p.life / p.max);
      put(this.partMesh, n, p.x, p.y, p.z, k); setCol(this.partMesh, n, p.c); n++;
    }
    this.partMesh.count = n;

    for (const m of [this.slabs, this.tops, this.drips, this.cracks, this.springs, this.gums, this.ices, this.clouds, this.deco, this.deco2, this.endPuffs, this.poles, this.coins, this.notes, this.bubbles,
      this.tramps, this.cannons, this.balls, this.ghostsOn, this.ghostsOff, this.vents, this.planets, this.planks, this.vineSegs, this.columns,
      this.bees, this.wings, this.sitters, this.dropMesh, this.riseMesh, this.gooGrumps, this.amb, this.partMesh, ...Object.values(this.friendInst)]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    for (const k of this.keepList) k.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export const worldName = (i: number) => WORLDS[i]?.name ?? "";
