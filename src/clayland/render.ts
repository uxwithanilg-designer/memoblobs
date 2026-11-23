// Puddo's Clayland: Rain Raid renderer (three.js): a side-view clay diorama. The play strip is deep instanced clay
// blocks in chunks (only the ones near the camera are drawn); behind it, layers of district scenery give depth; the
// sky and light follow the stage's time of day. Puddo carries his Rain Blaster (and rides a cart or a raft), the Dust
// Army melts into mud and coins, bombs burst into thunder-splashes. The camera follows Puddo with a look-ahead — up and
// down too on tower and shaft stages — and frames the whole arena in boss fights.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { antialiasFor, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { bolt, gloop, hoot, noodle, pip, tiki, turbo, zib } from "../boing/models";
import { hatGeo, krankyKrab, merge, tint } from "../crowd/models";
import { momoRig } from "../dash/models";
import { fruitGeo, heartFruit } from "../jungle/models";
import { BEAST, BOSS } from "./bestiary";
import { ISLAND_BY_ID } from "./islands";
import * as M from "./models";
import * as M2 from "./models2";
import type { Shot, Sim } from "./sim";
import { T, type FriendId, type Gadget, type Island, type SimEvent, type TimeOfDay, type Weapon } from "./types";

export type Quality = "low" | "medium" | "high";
/** who's playing and what they wear (the wardrobe) */
export type CharId = "puddo" | "momo" | "pip" | "gloop" | "zib";
export interface ClayLookR { char: CharId; hat: string; trail: string }
export const TRAIL_COLORS: Record<string, string[]> = {
  stars: ["#FFD23F", "#FFF2A8"], hearts: ["#FF5F7E", "#FF8FB8"], rainbow: ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF", "#B58CFF"],
  bubbles: ["#CFF1FF", "#FFFFFF"], fire: ["#FF5A1F", "#FFC23D"], sparkle: ["#FFFFFF", "#9FE6FF", "#FFE08A"], leaves: ["#5CCB52", "#9FE07A"],
};
/** where hatGeo's hats sit in their own model space */
export const HAT_BASE = 1.5;
const HAT_Y: Record<string, number> = { puddo: 1.08, momo: 1.02, pip: 1.12, gloop: 0.98, zib: 1.04 };
const TOP_Y: Record<string, number> = { puddo: 1.1, momo: 1.06 };
const FRUITS = ["mango", "pineapple", "berries", "melon", "kiwi", "mango"];
/** the generals' war machines (built by models2.machine, not as critters) */
const MACHINES = new Set(["crawler", "copter", "worm", "sub", "gyro", "crusher", "express", "borer", "plow", "rig", "blimp", "forge"]);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color(), tmpE = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const hash = (a: number, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const CHUNK = 40;
const MUD = ["#8A7A6A", "#6A5A48", "#B8AA98", "#5A4A3A"];

interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; color: THREE.Color; grav: number }
interface Dyn { idx: number; tile: number; mesh: THREE.InstancedMesh; i: number; m: THREE.Matrix4; shown: boolean }
interface Boom { m: THREE.Mesh; t: number; r: number }

/** the stage's palette, sky and light: the zone's colours shifted per district and lit for the time of day */
function lookFor(isl: Island, district: number, tod: TimeOfDay) {
  const shift = [0, 0.035, -0.035, 0.07][district] ?? 0, light = [0, 0.03, -0.05, 0.02][district] ?? 0;
  const sh = (c: string, k = 1) => `#${new THREE.Color(c).offsetHSL(shift * k, 0, light * k).getHexString()}`;
  const pal = { ...isl.pal, ground: sh(isl.pal.ground), top: sh(isl.pal.top), brick: sh(isl.pal.brick), block: sh(isl.pal.block), mid: sh(isl.pal.mid, 0.7), far: sh(isl.pal.far, 0.5) };
  let sky: [string, string] = [...isl.pal.sky] as [string, string], fog = isl.pal.fog, hemi = 1.25, key = 2.1, keyC = "#ffffff", hemiC = "#ffffff";
  if (tod === "sunset") { sky = ["#FF8F6A", "#FFD9A8"]; fog = "#FFD0B0"; key = 1.7; keyC = "#FFC890"; hemi = 1.05; hemiC = "#FFE0D0"; }
  else if (tod === "night") { sky = ["#101A3C", "#34407A"]; fog = "#2A3360"; key = 0.9; keyC = "#AFC0FF"; hemi = 0.72; hemiC = "#8F9FFF"; }
  else if (tod === "storm") { sky = ["#4A5468", "#8E98AA"]; fog = "#7A8494"; key = 1.15; keyC = "#DDE6F0"; hemi = 0.95; hemiC = "#C8D2E0"; }
  return { pal, sky, fog, hemi, key, keyC, hemiC, night: tod === "night" || !!isl.night };
}

export class ClayRenderer {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  private gov: FrameGovernor | null = null;
  private w = 1; private h = 1; private q: Quality; private t = 0;
  private stageGroup = new THREE.Group(); private farGroup = new THREE.Group();
  private keep: { dispose: () => void }[] = [];
  private stageKeep: { dispose: () => void }[] = [];
  private clay: THREE.MeshPhysicalMaterial; private clayInst: THREE.MeshStandardMaterial; private glow: THREE.MeshBasicMaterial;
  private hemi: THREE.HemisphereLight; private key: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private sim: Sim | null = null; private isl: Island | null = null; private pal: Island["pal"] | null = null;
  private cam = { x: 0, y: 0, dist: 18, shake: 0, look: 0, lookY: 0 };
  // characters
  private momo = new THREE.Group(); private body!: THREE.Mesh; private feet: THREE.Mesh[] = []; private arms: THREE.Mesh[] = []; private sprout!: THREE.Mesh; private yaw = -2.1;
  private blaster!: THREE.Mesh; private cart!: THREE.Mesh; private raft!: THREE.Mesh;
  private momoMat: THREE.MeshPhysicalMaterial;
  private friendMeshes = new Map<FriendId, THREE.Object3D>(); private friendNow: FriendId | undefined;
  private foeMeshes = new Map<number, THREE.Group>(); private foeGeo = new Map<string, THREE.BufferGeometry>(); private eliteGeo: THREE.BufferGeometry | null = null;
  private bossMesh: THREE.Group | null = null; private bossSpin: THREE.Mesh | null = null; private bossSpinAxis: "x" | "y" | "z" = "y";
  private potMesh!: THREE.InstancedMesh; private crateMesh: THREE.InstancedMesh[] = []; private potIdx = new Map<number, [THREE.InstancedMesh, number]>();
  private items = new Map<string, THREE.InstancedMesh>(); private itemIdx = new Map<number, [THREE.InstancedMesh, number]>();
  private gadgetObjs = new Map<number, THREE.Object3D>(); private bell: THREE.Mesh | null = null;
  private targetObjs = new Map<number, THREE.Group>(); private well: THREE.Group | null = null; private wellFlash = 0;
  private gateMeshes: THREE.InstancedMesh[] = []; private doorMeshes: THREE.InstancedMesh[] = []; private gateShown = -2; private doorShown = -1;
  private lootCoins!: THREE.InstancedMesh; private lootPick = new Map<string, THREE.Mesh[]>();
  private shotPool = new Map<string, THREE.Mesh[]>(); private shotGeo = new Map<string, THREE.BufferGeometry>();
  private booms: Boom[] = [];
  private dyn: Dyn[] = []; private swA: THREE.InstancedMesh[] = []; private swB: THREE.InstancedMesh[] = []; private beatA: THREE.InstancedMesh[] = []; private beatB: THREE.InstancedMesh[] = [];
  private switchShown = -1; private beatShown = -1;
  private parts: Part[] = []; private partMesh: THREE.InstancedMesh; private partMax = 520;
  private weather: THREE.InstancedMesh | null = null; private weatherKind = "";
  private shadow: THREE.InstancedMesh;
  private chaseMesh: THREE.Object3D | null = null;
  // Phase B: the tank and the mech around Puddo, the escorted Rain Cart, the rising flood, snipers' aim lines
  private tank!: THREE.Mesh; private mech = new THREE.Group(); private mechLegs: THREE.Mesh[] = [];
  private escortMesh: THREE.Group | null = null; private escortFlash = 0; private riseMesh: THREE.Mesh | null = null;
  private aimLines: THREE.Mesh[] = []; private beamMat!: THREE.MeshBasicMaterial; private beamRed!: THREE.MeshBasicMaterial; private moundGeo: THREE.BufferGeometry | null = null;
  private liquidMats: THREE.MeshStandardMaterial[] = [];
  private gongWobble = 0; private rainT = 0;
  private look: ClayLookR = { char: "puddo", hat: "none", trail: "none" };
  private rigs: Record<"puddo" | "momo", { body: THREE.BufferGeometry; foot: THREE.BufferGeometry; arm: THREE.BufferGeometry; top: THREE.BufferGeometry }> | null = null;
  private charMesh: THREE.Mesh | null = null; private hatMesh: THREE.Mesh | null = null; private trailT = 0;
  private vertical = false;
  /** art: the hero alone on a flat colour, facing the camera (scripts/build_clay_art.py cuts it out) */
  portrait: string | null = null;
  /** art / QA: frame a fixed spot instead of following the hero */
  photo: { x: number; y: number; w: number } | null = null;

  constructor(host: HTMLElement, quality: Quality) {
    this.q = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.environment = env; this.keep.push(env);
    const k = <X extends { dispose: () => void }>(x: X) => { this.keep.push(x); return x; };
    this.clay = k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: quality === "low" ? 0 : 0.55, clearcoatRoughness: 0.35, envMapIntensity: 0.6 }));
    this.clayInst = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.45 }));
    this.glow = k(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    this.momoMat = k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.2, envMapIntensity: 1.0 }));
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1.25); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight("#ffffff", 2.1); this.key.position.set(-6, 12, 10); this.scene.add(this.key); this.scene.add(this.key.target);
    const fill = new THREE.DirectionalLight("#ffffff", 0.5); fill.position.set(8, 3, 6); this.scene.add(fill);
    this.skyMat = k(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = smoothstep(-0.25, 0.65, vP.y); gl_FragColor = vec4(mix(bot, top, h), 1.0); }",
    }));
    this.sky = new THREE.Mesh(k(new THREE.SphereGeometry(300, 24, 12)), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    this.scene.add(this.stageGroup); this.scene.add(this.farGroup);
    // the hero: Puddo (or Momo as a guest) — body, feet, arms and the head-top part animate separately
    const pr = M.puddoRig(), mr = momoRig();
    this.rigs = { puddo: { body: k(pr.body), foot: k(pr.foot), arm: k(pr.arm), top: k(pr.hat) }, momo: { body: k(mr.body), foot: k(mr.foot), arm: k(mr.arm), top: k(mr.sprout) } };
    const rig = this.rigs.puddo;
    this.body = new THREE.Mesh(rig.body, this.momoMat);
    for (let i = 0; i < 2; i++) { this.feet.push(new THREE.Mesh(rig.foot, this.momoMat)); this.arms.push(new THREE.Mesh(rig.arm, this.momoMat)); }
    this.sprout = new THREE.Mesh(rig.top, this.momoMat);
    this.blaster = new THREE.Mesh(k(M2.blasterGeo()), this.momoMat);
    const inner = new THREE.Group(); inner.name = "inner";
    inner.add(this.body, ...this.feet, ...this.arms, this.sprout, this.blaster);
    this.momo.add(inner); this.scene.add(this.momo);
    this.cart = new THREE.Mesh(k(M2.cartGeo()), this.clay); this.cart.visible = false; this.scene.add(this.cart);
    this.raft = new THREE.Mesh(k(M2.raftGeo()), this.clay); this.raft.visible = false; this.scene.add(this.raft);
    this.tank = new THREE.Mesh(k(M2.tankGeo()), this.clay); this.tank.visible = false; this.scene.add(this.tank);
    const mg = M2.mechGeo(); k(mg.body); k(mg.leg);
    this.mech.add(new THREE.Mesh(mg.body, this.clay));
    for (const z of [-0.32, 0.32]) { const l = new THREE.Mesh(mg.leg, this.clay); l.position.set(0, 0, z); this.mechLegs.push(l); this.mech.add(l); }
    this.mech.visible = false; this.scene.add(this.mech);
    const aimMat = k(new THREE.MeshBasicMaterial({ color: "#FF3A3A", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    const aimGeo = k(new THREE.BoxGeometry(1, 0.05, 0.05).translate(0.5, 0, 0));
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(aimGeo, aimMat); m.visible = false; m.renderOrder = 5; this.aimLines.push(m); this.scene.add(m); }
    this.beamMat = k(new THREE.MeshBasicMaterial({ color: "#FFF2A8", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beamRed = k(new THREE.MeshBasicMaterial({ color: "#FF4A3A", transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    // particles, blob shadows, dropped coins, bomb flashes
    this.partMesh = new THREE.InstancedMesh(k(new THREE.SphereGeometry(1, 6, 5)), k(new THREE.MeshStandardMaterial({ roughness: 0.5 })), this.partMax);
    this.partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.partMesh.frustumCulled = false; this.partMesh.count = 0;
    this.partMesh.setColorAt(0, new THREE.Color("#fff")); this.scene.add(this.partMesh);
    const shGeo = new THREE.CircleGeometry(0.5, 20); shGeo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.InstancedMesh(k(shGeo), k(new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.22, depthWrite: false })), 96);
    this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadow.frustumCulled = false; this.shadow.renderOrder = 2; this.scene.add(this.shadow);
    this.lootCoins = new THREE.InstancedMesh(k(M.coinGeo()), this.clay, 220);
    this.lootCoins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.lootCoins.frustumCulled = false; this.lootCoins.count = 0; this.scene.add(this.lootCoins);
    const flashMat = k(new THREE.MeshBasicMaterial({ color: "#E8F6FF", transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    const flashGeo = k(new THREE.SphereGeometry(1, 18, 12));
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(flashGeo, flashMat.clone()); this.keep.push(m.material as THREE.Material); m.visible = false; m.renderOrder = 4; this.scene.add(m); this.booms.push({ m, t: 1, r: 1 }); }
  }

  /** dress the player: Puddo or a friend, a hat, a trail */
  setLook(look: ClayLookR) {
    // the shared hats (crowd/models hatGeo) are modelled sitting at y≈1.5 on a big crowd blob: drop them onto the head
    this.look = look;
    const inner = this.momo.getObjectByName("inner")!;
    if (this.charMesh) { inner.remove(this.charMesh); this.charMesh = null; }
    if (this.hatMesh) { this.hatMesh.removeFromParent(); this.hatMesh = null; }
    const rigged = look.char === "puddo" || look.char === "momo";
    [this.body, ...this.feet, ...this.arms, this.sprout].forEach((m) => (m.visible = rigged));
    if (rigged && this.rigs) {
      const r = this.rigs[look.char as "puddo" | "momo"];
      this.body.geometry = r.body; this.feet.forEach((f) => (f.geometry = r.foot)); this.arms.forEach((a) => (a.geometry = r.arm)); this.sprout.geometry = r.top;
    }
    if (!rigged) {
      const g = look.char === "pip" ? pip() : look.char === "gloop" ? gloop() : zib();
      this.keep.push(g);
      this.charMesh = new THREE.Mesh(g, this.momoMat); this.charMesh.rotation.y = Math.PI; this.charMesh.scale.setScalar(0.95);
      inner.add(this.charMesh);
    }
    const hg = look.hat && look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { this.keep.push(hg); this.hatMesh = new THREE.Mesh(hg, this.clay); this.hatMesh.scale.setScalar(0.5); this.hatMesh.position.set(0, (HAT_Y[look.char] ?? 1.02) - HAT_BASE * 0.5, 0); inner.add(this.hatMesh); }
    this.sprout.visible = rigged && !(hg && look.char === "puddo");
  }

  // ------------------------------------------------------------------ build a stage
  load(sim: Sim) {
    this.clearStage();
    this.sim = sim;
    const st = sim.st, isl = ISLAND_BY_ID[st.island]; this.isl = isl;
    this.vertical = st.h > 40;
    const L = lookFor(isl, st.district, st.tod), pal = L.pal; this.pal = pal;
    const sk = <X extends { dispose: () => void }>(x: X) => { this.stageKeep.push(x); return x; };
    (this.skyMat.uniforms.top.value as THREE.Color).set(L.sky[0]); (this.skyMat.uniforms.bot.value as THREE.Color).set(L.sky[1]);
    this.scene.fog = new THREE.Fog(L.fog, 38, 120);
    this.hemi.color.set(L.hemiC); this.hemi.groundColor.set(pal.mid); this.hemi.intensity = L.hemi;
    this.key.intensity = L.key; this.key.color.set(isl.id === "volcano" ? "#FFD0A0" : L.keyC);

    const W = st.w, H = st.h, tiles = sim.tiles;
    const at = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? 0 : tiles[y * W + x]);
    const solidish = (v: number) => v !== T.EMPTY && v !== T.WATER && v !== T.VINE && v !== T.LAVA && v !== T.POISON && v !== T.SPIKES && v !== T.GATE && v !== T.DOOR && v !== T.RAIL;
    type Spec = { key: string; geo: () => THREE.BufferGeometry; mat: THREE.Material; list: [number, number, THREE.Color, number][] };
    const specs = new Map<string, Spec>();
    const chunkOf = (x: number, y: number) => (this.vertical ? Math.floor(y / CHUNK) : Math.floor(x / CHUNK));
    const add = (key: string, geo: () => THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, c: string | THREE.Color, idx = -1) => {
      const k2 = `${key}#${chunkOf(x, y)}`;
      let s = specs.get(k2); if (!s) { s = { key, geo, mat, list: [] }; specs.set(k2, s); }
      s.list.push([x, y, c instanceof THREE.Color ? c : new THREE.Color(c), idx]);
    };
    const inst = this.clayInst;
    const water = sk(new THREE.MeshStandardMaterial({ color: isl.id === "mire" ? "#6B8F7A" : "#3DB8FF", transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0, depthWrite: false }));
    const lava = sk(new THREE.MeshStandardMaterial({ color: "#FF5A1F", emissive: "#FF3D00", emissiveIntensity: 1.4, roughness: 0.6 }));
    const poison = sk(new THREE.MeshStandardMaterial({ color: "#9B3DE8", emissive: "#7A1FCB", emissiveIntensity: 0.8, roughness: 0.3 }));
    this.liquidMats = [water, lava, poison];
    const ice = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.88 }));
    const ghost = sk(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false }));
    const neon = sk(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: "#ffffff", emissiveIntensity: 0.25, roughness: 0.3 }));
    const gateCols = new Map<number, number>(); st.gates.forEach((g, i) => { gateCols.set(g.x0, i); gateCols.set(g.x1, i); });
    const gateLists: [number, number][][] = st.gates.map(() => []);
    const doorList: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = at(x, y), idx = y * W + x;
      if (v === T.EMPTY) continue;
      const n = hash(x, y), above = at(x, y + 1);
      switch (v) {
        case T.GROUND: case T.CARAMEL: case T.SAND: case T.BOUNCE: case T.BELT_R: case T.BELT_L: {
          if (v === T.BELT_R || v === T.BELT_L) { add("belt", M.beltTile, inst, x, y, "#ffffff"); break; }
          let depthBelow = 0; for (let k = y + 1; k < Math.min(H, y + 5); k++) { const a = at(x, k); if (a === T.GROUND || a === T.CARAMEL || a === T.SAND || a === T.ICE) depthBelow++; else break; }
          tmpC.set(pal.ground).multiplyScalar(1 - Math.min(3, depthBelow) * 0.07 - n * 0.05);
          add("ground", M.groundBlock, inst, x, y, tmpC.clone());
          if (hash(x, y + 50) < 0.5) { const c2 = new THREE.Color(pal.ground).multiplyScalar(hash(x, y + 9) < 0.5 ? 0.78 : 1.15); add("pebble", M.pebble, inst, x + 0.2 + hash(x, y + 3) * 0.6, y + 0.2 + hash(x, y + 4) * 0.6, c2); }
          if (!solidish(above) || above === T.BOUNCE) {
            const capC = v === T.CARAMEL ? "#A8642A" : v === T.SAND ? "#E8C878" : pal.top;
            tmpC.set(capC).multiplyScalar(0.95 + n * 0.1);
            add("cap", M.topCap, inst, x, y, tmpC.clone());
            if (v === T.GROUND && above === T.EMPTY && hash(x, 77) < 0.42) {
              const fl = hash(x, 78) < 0.35;
              add(fl ? "flower" : "tuft", () => M.tuft(fl), this.clay, x + 0.2 + hash(x, 79) * 0.6, y + 1.0, fl ? ["#FF5F7E", "#FFFFFF", "#FFD23F", "#9F7BFF"][Math.floor(hash(x, 80) * 4)] : new THREE.Color(pal.top).multiplyScalar(0.62).getStyle());
            }
          }
          if (v === T.BOUNCE) add("bounce", M.bounceTile, this.clay, x, y + 0.72, "#ffffff");
          break;
        }
        case T.BRICK: case T.WALL: add("brick", M.brickBlock, inst, x, y, new THREE.Color(pal.brick).multiplyScalar((v === T.WALL ? 0.8 : 1) * (0.94 + n * 0.1))); break;
        case T.BLOCK: add("block", M.solidBlock, this.clay, x, y, new THREE.Color(pal.block).multiplyScalar(0.95 + n * 0.08)); break;
        case T.ONEWAY: add("slab", M.slab, this.clay, x, y, M.mix(pal.block, "#ffffff", 0.25), idx); break;
        case T.BREAK: add("crack", M.crackBlock, this.clay, x, y, M.mix(pal.brick, "#ffffff", 0.25), idx); break;
        case T.CRUMBLE: add("crumble", M.crackBlock, this.clay, x, y, isl.id === "candy" ? "#D9A06A" : "#C8A878", idx); break;
        case T.CLOUD: add("cloud", M.cloudTile, this.clay, x, y, "#ffffff", idx); break;
        case T.SPIKES: add("spikes", M.spikesTile, this.clay, x, y, "#ffffff"); break;
        case T.LAVA: add("lava", M.liquidBlock, lava, x, y, "#ffffff"); break;
        case T.POISON: add("poison", M.liquidBlock, poison, x, y, "#ffffff"); break;
        case T.ICE: add("ice", M.groundBlock, ice, x, y, "#CFF1FF"); if (!solidish(above)) add("cap", M.topCap, inst, x, y, "#F2FCFF"); break;
        case T.SW_A: add("swA", M.solidBlock, this.clay, x, y, "#FF5F5F"); add("swAg", M.solidBlock, ghost, x, y, "#FF5F5F"); break;
        case T.SW_B: add("swB", M.solidBlock, this.clay, x, y, "#3D8BFF"); add("swBg", M.solidBlock, ghost, x, y, "#3D8BFF"); break;
        case T.BEAT_A: add("beatA", M.solidBlock, neon, x, y, "#FF3DC8"); add("beatAg", M.solidBlock, ghost, x, y, "#FF3DC8"); break;
        case T.BEAT_B: add("beatB", M.solidBlock, neon, x, y, "#3DE0FF"); add("beatBg", M.solidBlock, ghost, x, y, "#3DE0FF"); break;
        case T.VINE: add("vine", M.vineTile, this.clay, x, y, "#ffffff"); break;
        case T.RAIL: add("rail", M2.railTile, this.clay, x, y - 0.0, "#ffffff"); break;
        case T.GATE: { const gi = gateCols.get(x); if (gi !== undefined) gateLists[gi].push([x, y]); break; }
        case T.DOOR: doorList.push([x, y]); break;
      }
    }
    for (const [, s] of specs) {
      const geo = sk(s.geo());
      const mesh = new THREE.InstancedMesh(geo, s.mat, s.list.length);
      s.list.forEach(([x, y, c, idx], i) => {
        tmpM.makeTranslation(x, y, s.key === "pebble" ? M.DEPTH_FRONT : s.key === "tuft" || s.key === "flower" ? 0.35 + hash(x * 3, y) * 0.5 : 0);
        if (s.key === "cloud" || s.key === "crack" || s.key === "crumble" || s.key === "slab") this.dyn.push({ idx, tile: s.key === "cloud" ? T.CLOUD : s.key === "crack" ? T.BREAK : s.key === "slab" ? T.ONEWAY : T.CRUMBLE, mesh, i, m: tmpM.clone(), shown: true });
        mesh.setMatrixAt(i, tmpM); mesh.setColorAt(i, c);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.stageGroup.add(mesh);
      if (s.key === "swA" || s.key === "swBg") this.swA.push(mesh); if (s.key === "swB" || s.key === "swAg") this.swB.push(mesh);
      if (s.key === "beatA" || s.key === "beatBg") this.beatA.push(mesh); if (s.key === "beatB" || s.key === "beatAg") this.beatB.push(mesh);
    }
    // only the slabs that can disappear (the collapsing bridge) need watching every frame
    if (!st.rules.chase) this.dyn = this.dyn.filter((d) => d.tile !== T.ONEWAY);
    // ambush gates (shown while their fight is on) and the exit door (until the goal is done)
    const gateGeo = sk(M2.gateTile()), doorGeo = sk(M2.doorTile());
    for (const list of gateLists) { const m = new THREE.InstancedMesh(gateGeo, this.clay, Math.max(1, list.length)); list.forEach(([x, y], i) => { tmpM.makeTranslation(x, y, 0); m.setMatrixAt(i, tmpM); }); m.computeBoundingSphere(); m.visible = false; this.stageGroup.add(m); this.gateMeshes.push(m); }
    if (doorList.length) { const m = new THREE.InstancedMesh(doorGeo, this.clay, doorList.length); doorList.forEach(([x, y], i) => { tmpM.makeTranslation(x, y, 0); m.setMatrixAt(i, tmpM); }); m.computeBoundingSphere(); this.stageGroup.add(m); this.doorMeshes.push(m); }
    this.gateShown = -2; this.doorShown = -1;
    // water: one smooth volume per rectangle of water tiles
    const seen = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (seen[y * W + x] || at(x, y) !== T.WATER) continue;
      let x1 = x; while (x1 + 1 < W && at(x1 + 1, y) === T.WATER && !seen[y * W + x1 + 1] && x1 - x < 120) x1++;
      let y1 = y; outer: while (y1 + 1 < H) { for (let k = x; k <= x1; k++) if (at(k, y1 + 1) !== T.WATER || seen[(y1 + 1) * W + k]) break outer; y1++; }
      for (let yy = y; yy <= y1; yy++) for (let k = x; k <= x1; k++) seen[yy * W + k] = 1;
      const g = sk(new THREE.BoxGeometry(x1 - x + 1, y1 - y + 1 - (at(x, y1 + 1) === T.WATER ? 0 : 0.12), M.DEPTH_FRONT - M.DEPTH_BACK));
      g.translate((x + x1 + 1) / 2, (y + y1 + 1) / 2 - (at(x, y1 + 1) === T.WATER ? 0 : 0.06), (M.DEPTH_FRONT + M.DEPTH_BACK) / 2);
      const m = new THREE.Mesh(g, water); m.renderOrder = 3; this.stageGroup.add(m);
    }
    this.switchShown = -1; this.beatShown = -1;
    this.buildScenery(st, isl, pal, L.night, at, sk);
    this.buildThings(sim, sk);
    // weather
    const wk = st.rules.dust ? "dust" : st.rules.rain ? "rain" : isl.weather === "snow" ? "snow" : isl.weather === "ash" ? "ash" : isl.weather === "sparkle" ? "sparkle" : isl.weather === "stars" || isl.weather === "night" || st.tod === "night" ? "stars" : isl.weather === "dust" ? "dust" : "";
    this.weatherKind = wk;
    if (wk && this.q !== "low") {
      const n = wk === "rain" ? 260 : wk === "stars" ? 160 : st.rules.dust ? 320 : 140;
      const g = wk === "rain" ? new THREE.BoxGeometry(0.02, 0.5, 0.02) : new THREE.SphereGeometry(wk === "stars" ? 0.12 : 0.06, 5, 4);
      const c = wk === "rain" ? "#BFE3FF" : wk === "snow" ? "#FFFFFF" : wk === "ash" ? "#5A4A4A" : wk === "sparkle" ? "#FFE0FF" : wk === "stars" ? "#FFF6C8" : "#E8C890";
      this.weather = new THREE.InstancedMesh(sk(g), sk(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: wk === "dust" ? 0.5 : 0.85, fog: wk !== "stars" })), n);
      this.weather.frustumCulled = false; this.weather.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.stageGroup.add(this.weather);
    }
    if (st.rules.chase && st.rules.chase.kind !== "collapse") { this.chaseMesh = new THREE.Mesh(sk(M.chaseWall(st.rules.chase.kind)), st.rules.chase.kind === "beam" ? this.glow : this.clay); this.stageGroup.add(this.chaseMesh); }
    this.cart.visible = st.ride?.kind === "cart"; this.raft.visible = st.ride?.kind === "raft";
    this.tank.visible = st.ride?.kind === "tank"; this.mech.visible = st.ride?.kind === "mech";
    if (st.rules.rise) {
      const lava = st.rules.rise.kind === "lava";
      const mat = sk(new THREE.MeshStandardMaterial({ color: lava ? "#FF5A1F" : "#8A7A62", emissive: lava ? "#FF3D00" : "#2A2018", emissiveIntensity: lava ? 1.3 : 0.4, roughness: 0.7, transparent: !lava, opacity: lava ? 1 : 0.92 }));
      this.riseMesh = new THREE.Mesh(sk(new THREE.BoxGeometry(st.w + 40, 60, 6)), mat); this.riseMesh.position.set(st.w / 2, -40, 0.6); this.riseMesh.renderOrder = 3; this.stageGroup.add(this.riseMesh);
    }
    if (st.escort) { const g = new THREE.Group(); g.add(new THREE.Mesh(sk(M2.rainCartGeo()), this.clay)); this.escortMesh = g; this.stageGroup.add(g); }
    this.cam.x = sim.x + 4; this.cam.y = sim.y + 2; this.t = 0;
    this.friendNow = undefined; this.friendMeshes.forEach((m) => (m.visible = false));
  }

  private buildScenery(st: Sim["st"], isl: Island, pal: Island["pal"], night: boolean, at: (x: number, y: number) => number, sk: <X extends { dispose: () => void }>(x: X) => X) {
    const W = st.w, H = st.h;
    const top = new Array<number>(W).fill(0);
    for (let x = 0; x < W; x++) for (let y = Math.min(H - 3, 30); y >= 0; y--) { const v = at(x, y); if (v === T.GROUND || v === T.BRICK || v === T.CARAMEL || v === T.SAND || v === T.ICE) { top[x] = y + 1; break; } }
    if (!this.vertical) {
      const backN = top.filter((h) => h > 0).length;
      if (backN) {
        const g = sk(tint(new THREE.BoxGeometry(1.02, 1, 7), "#FFFFFF")); g.translate(0.5, 0.5, -5.3);
        const m = new THREE.InstancedMesh(g, this.clayInst, backN); let i = 0;
        for (let x = 0; x < W; x++) if (top[x] > 0) { const hh = Math.max(0.5, top[x] - 0.35 + Math.sin(x * 0.35) * 0.25); tmpM.makeScale(1, hh, 1); tmpM.setPosition(x, 0, 0); m.setMatrixAt(i, tmpM); tmpC.set(pal.top).lerp(new THREE.Color(pal.mid), 0.55).multiplyScalar(0.92 + hash(x, 7) * 0.08); m.setColorAt(i, tmpC); i++; }
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere(); this.stageGroup.add(m);
      }
      const ug = sk(new THREE.BoxGeometry(W + 80, 30, 14)); ug.translate(W / 2, -15.6, -4);
      this.stageGroup.add(new THREE.Mesh(ug, sk(new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.fog).multiplyScalar(0.55) }))));
    }
    // caves, mines, the factory, the castle — and every tower and shaft: a brick back wall right behind the strip
    if (this.vertical || ["caves", "crystal", "factory", "castle"].includes(isl.id)) {
      const tex = sk(M.brickTexture(pal.brick, isl.id === "castle" ? 0.82 : 0.7));
      tex.repeat.set((W + 40) / 2, (this.vertical ? H + 20 : 22) / 2);
      const wall = new THREE.Mesh(sk(new THREE.PlaneGeometry(W + 40, this.vertical ? H + 20 : 22)), sk(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
      wall.position.set(W / 2, this.vertical ? H / 2 : 11, -2.1); this.stageGroup.add(wall);
      if (this.vertical) {
        // windows in the tower walls, so it feels like inside a building
        const winG = sk(tint(new THREE.BoxGeometry(1.4, 2, 0.1), "#9FD8FF"));
        const nw = Math.floor(H / 9) * 2, win = new THREE.InstancedMesh(winG, new THREE.MeshBasicMaterial({ vertexColors: true, color: night ? "#5A6AA0" : "#ffffff", fog: true }), nw);
        this.stageKeep.push(win.material as THREE.Material);
        for (let i = 0; i < nw; i++) { tmpM.makeTranslation(i % 2 ? W * 0.28 : W * 0.72, 5 + Math.floor(i / 2) * 9, -2.0); win.setMatrixAt(i, tmpM); }
        win.computeBoundingSphere(); this.stageGroup.add(win);
      }
    }
    // near props on the back terrain, mid props and hills, far mountains, sky clouds
    const props = M.propSet(isl.props[st.district] as M.PropFamily, pal).map((g) => sk(g));
    const place = (layer: "near" | "mid", count: number) => {
      const per = props.map(() => [] as THREE.Matrix4[]);
      for (let k = 0; k < count; k++) {
        const x = (k + hash(k, layer === "near" ? 3 : 9) * 0.8) * (W / count);
        const col = Math.max(0, Math.min(W - 1, Math.floor(x)));
        const base = layer === "near" ? Math.max(0, top[col] - 0.35) : -0.5 + hash(k, 5) * 1.5;
        const z = layer === "near" ? -3.2 - hash(k, 2) * 3.6 : -13 - hash(k, 4) * 8;
        const s = layer === "near" ? 0.8 + hash(k, 6) * 0.7 : 1.8 + hash(k, 8) * 1.4;
        if (layer === "near" && top[col] === 0) continue;
        tmpE.set(0, (hash(k, 1) - 0.5) * 1.2, 0); tmpQ.setFromEuler(tmpE);
        per[k % props.length].push(new THREE.Matrix4().compose(tmpP.set(x, base, z), tmpQ, tmpS.set(s, s, s)));
      }
      per.forEach((list, i) => {
        if (!list.length) return;
        const m = new THREE.InstancedMesh(props[i], this.clay, list.length);
        list.forEach((mat, j) => m.setMatrixAt(j, mat));
        m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
        (layer === "near" ? this.stageGroup : this.farGroup).add(m);
      });
    };
    if (!this.vertical) place("near", Math.round(W / 6));
    place("mid", Math.max(4, Math.round(W / 9)));
    const span = Math.max(W, 60);
    const hillG = sk(M.farShape(0, M.mix(pal.mid, pal.fog, 0.15), pal.mid));
    const nh = Math.ceil(span / 18) + 2, hills = new THREE.InstancedMesh(hillG, this.clayInst, nh);
    for (let i = 0; i < nh; i++) { tmpM.compose(tmpP.set(-10 + i * 18 + hash(i, 11) * 6 - (this.vertical ? 14 : 0), -2.6 + hash(i, 12) * 1.2, -26 - hash(i, 13) * 8), tmpQ.identity(), tmpS.set(0.75 + hash(i, 15) * 0.3, 0.45 + hash(i, 14) * 0.35, 1)); hills.setMatrixAt(i, tmpM); }
    hills.instanceMatrix.needsUpdate = true; hills.computeBoundingSphere(); this.farGroup.add(hills);
    const farKind = ["caves", "crystal", "factory", "volcano", "peaks", "temple", "castle"].includes(isl.id) ? 1 : ["shore", "lagoon", "pirate", "clouds"].includes(isl.id) ? 2 : 0;
    const farG = sk(M.farShape(farKind, pal.far, M.mix(pal.far, "#ffffff", isl.id === "peaks" ? 0.8 : 0.25)));
    const nf = Math.ceil(span / 40) + 3, far = new THREE.InstancedMesh(farG, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), nf);
    this.stageKeep.push(far.material as THREE.Material);
    for (let i = 0; i < nf; i++) { tmpM.compose(tmpP.set(-30 + i * 40 + hash(i, 21) * 10, -2, -70), tmpQ.identity(), tmpS.set(2.4, 2.2 + hash(i, 22), 1.5)); far.setMatrixAt(i, tmpM); }
    far.instanceMatrix.needsUpdate = true; far.computeBoundingSphere(); this.farGroup.add(far);
    if (!["caves", "crystal", "moon", "factory"].includes(isl.id)) {
      const cg = sk(M.skyCloud()), nc = Math.ceil(span / 14) + 4, clouds = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: night ? 0.25 : st.tod === "storm" ? 0.7 : 0.95, color: st.tod === "storm" ? "#9AA4B4" : st.tod === "sunset" ? "#FFD8C8" : "#ffffff" }), nc);
      this.stageKeep.push(clouds.material as THREE.Material);
      for (let i = 0; i < nc; i++) { const s = 1.4 + hash(i, 31) * 1.8; tmpM.compose(tmpP.set(-20 + i * 16 + hash(i, 32) * 8, 13 + hash(i, 33) * 8, -38 - hash(i, 34) * 14), tmpQ.identity(), tmpS.set(s, s * 0.8, s)); clouds.setMatrixAt(i, tmpM); }
      clouds.instanceMatrix.needsUpdate = true; clouds.computeBoundingSphere(); this.farGroup.add(clouds);
    }
  }

  private buildThings(sim: Sim, sk: <X extends { dispose: () => void }>(x: X) => X) {
    const st = sim.st;
    // items: coins, fruit (6 kinds), drops, hearts, juice, stars, keys, bombs, weapon pickups
    const groups = new Map<string, { geo: () => THREE.BufferGeometry; list: typeof st.items }>();
    for (const it of st.items) {
      const key = it.kind === "fruit" ? `fruit${it.fruit ?? 0}` : it.kind === "weapon" ? `w:${it.w}` : it.kind;
      if (!groups.has(key)) {
        const geo = it.kind === "coin" ? M.coinGeo : it.kind === "fruit" ? () => { const g = fruitGeo(FRUITS[it.fruit ?? 0]); g.scale(0.85, 0.85, 0.85); return g; } : it.kind === "drop" ? M.dropGeo : it.kind === "heart" ? heartFruit : it.kind === "juice" ? M.juiceGeo : it.kind === "key" ? M2.keyGeo : it.kind === "bombs" ? M2.bombGeo : it.kind === "weapon" ? () => M2.pickupGeo(M2.WEAPON_COLOR[it.w ?? "drizzle"]) : M.starGeo;
        groups.set(key, { geo, list: [] });
      }
      groups.get(key)!.list.push(it);
    }
    for (const [key, g] of groups) {
      const mesh = new THREE.InstancedMesh(sk(g.geo()), key === "drop" || key === "key" ? this.momoMat : this.clay, g.list.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.list.forEach((it, i) => { this.itemIdx.set(it.id, [mesh, i]); tmpM.makeTranslation(it.x, it.y, 0); mesh.setMatrixAt(i, tmpM); });
      mesh.computeBoundingSphere();
      this.items.set(key, mesh); this.stageGroup.add(mesh);
    }
    // pots and crates
    const pots = st.pots.filter((p) => !p.crate), crW = st.pots.filter((p) => p.crate && p.item.k === "weapon"), crB = st.pots.filter((p) => p.crate && p.item.k !== "weapon");
    this.potMesh = new THREE.InstancedMesh(sk(M.potGeo()), this.clay, Math.max(1, pots.length));
    pots.forEach((p, i) => { this.potIdx.set(p.id, [this.potMesh, i]); tmpM.makeTranslation(p.x, p.y, 0); this.potMesh.setMatrixAt(i, tmpM); });
    if (!pots.length) this.potMesh.setMatrixAt(0, ZERO);
    this.potMesh.computeBoundingSphere(); this.stageGroup.add(this.potMesh);
    for (const [list, bombs] of [[crW, false], [crB, true]] as const) {
      const m = new THREE.InstancedMesh(sk(M2.crateGeo(bombs)), this.clay, Math.max(1, list.length));
      list.forEach((p, i) => { this.potIdx.set(p.id, [m, i]); tmpM.makeTranslation(p.x, p.y, 0); m.setMatrixAt(i, tmpM); });
      if (!list.length) m.setMatrixAt(0, ZERO);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.computeBoundingSphere(); this.crateMesh.push(m); this.stageGroup.add(m);
    }
    // targets: Dust Pumps and Sprout cages
    const pumpG = sk(M2.pumpGeo()), cageG = sk(M2.cageGeo()), sproutG = sk(M2.sproutGeo());
    for (const tg of st.targets) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(tg.kind === "pump" ? pumpG : cageG, this.clay); b.name = "body"; g.add(b);
      if (tg.kind === "cage") { const sp = new THREE.Mesh(sproutG, this.momoMat); sp.name = "sprout"; sp.position.set(0, 0.2, 0); g.add(sp); }
      g.position.set(tg.x, tg.y, 0); this.targetObjs.set(tg.id, g); this.stageGroup.add(g);
    }
    if (st.defend) { const g = new THREE.Group(); g.add(new THREE.Mesh(sk(M2.wellGeo()), this.clay)); g.position.set(st.defend.x, st.defend.y, -0.6); this.well = g; this.stageGroup.add(g); }
    // enemies (meshes are made on demand: waves, hives and the well's attackers appear mid-stage)
    for (const f of sim.foes) this.foeMesh(f.id, f.kind, f.elite, sk);
    // the boss / the general's machine
    if (sim.boss) {
      const bd = BOSS[sim.boss.kind];
      const g = new THREE.Group();
      let body: THREE.Mesh;
      if (sim.boss.kind === "kranky") { const k = krankyKrab(); k.scale(1.45, 1.45, 1.45); body = new THREE.Mesh(sk(k), this.clay); }
      else if (MACHINES.has(sim.boss.kind)) {
        const parts = M2.machine(sim.boss.kind, bd.w, bd.h);
        body = new THREE.Mesh(sk(parts.body), this.clay);
        if (parts.spin) { const sp = new THREE.Mesh(sk(parts.spin), this.clay); sp.position.set(...(parts.spinAt ?? [0, 0, 0])); this.bossSpin = sp; this.bossSpinAxis = parts.spinAxis ?? "y"; body.add(sp); }
      } else body = new THREE.Mesh(sk(M.critter(bd.shape, bd.body, bd.belly, bd.w, bd.h)), this.clay);
      body.name = "body"; g.add(body);
      if (sim.boss.kind !== "kranky" && !MACHINES.has(sim.boss.kind)) { const c = new THREE.Mesh(sk(M.crown()), this.clay); c.position.y = bd.h * 0.98; c.scale.setScalar(Math.min(2, bd.w * 0.55)); c.name = "crown"; g.add(c); }
      const mound = new THREE.Mesh(sk(tint(new THREE.SphereGeometry(1, 12, 8), "#8A6A4A")), this.clay); mound.scale.set(1.3, 0.35, 0.9); mound.name = "mound"; mound.visible = false; g.add(mound);
      this.bossMesh = g; this.stageGroup.add(g);
      const bell = new THREE.Mesh(sk(M.bellGeo()), this.momoMat); bell.scale.setScalar(1.6); bell.visible = false; this.bell = bell; this.stageGroup.add(bell);
    }
    for (const gd of st.gadgets) { const o = this.gadgetObj(gd, sk); if (o) { o.position.set(gd.x, gd.y, 0); this.gadgetObjs.set(gd.id, o); this.stageGroup.add(o); } }
    for (const p of sim.plats) {
      const col = p.s.kind === "taxi" ? "#FFC21A" : p.s.kind === "rock" ? "#8A5A3A" : p.s.kind === "swing" ? "#C8925A" : M.mix(this.pal?.block ?? "#B8A0E8", "#ffffff", 0.15);
      const geo = sk(merge([tint(new THREE.BoxGeometry(p.w, 0.38, 1.4).translate(0, -0.19, 0), col), tint(new THREE.BoxGeometry(p.w - 0.2, 0.06, 0.06).translate(0, -0.3, 0.71), "#FFFFFF")]));
      const m = new THREE.Mesh(geo, this.clay); m.userData.plat = p; this.stageGroup.add(m);
      if (p.s.kind === "swing") { const r = new THREE.Mesh(sk(tint(new THREE.CylinderGeometry(0.04, 0.04, 1, 6).translate(0, 0.5, 0), "#8A5A3A")), this.clay); r.userData.rope = p; this.stageGroup.add(r); }
    }
  }
  private foeMesh(id: number, kind: Sim["foes"][number]["kind"], elite: boolean, sk: <X extends { dispose: () => void }>(x: X) => X = (x) => { this.stageKeep.push(x); return x; }) {
    let g = this.foeMeshes.get(id);
    if (g) return g;
    const b = BEAST[kind];
    let geo = this.foeGeo.get(kind);
    if (!geo) { geo = sk(b.shape === "army" ? M2.dustArmy(kind, b.w, b.h, b.body, b.belly, b.extra ?? "#FF8A2A") : M.critter(b.shape, M.mix(b.body, "#9A8F86", 0.18), b.belly, b.w, b.h)); this.foeGeo.set(kind, geo); }
    g = new THREE.Group();
    const body = new THREE.Mesh(geo, this.clay); body.name = "body"; g.add(body);
    if (elite) { if (!this.eliteGeo) this.eliteGeo = sk(M2.eliteMark()); const e = new THREE.Mesh(this.eliteGeo, this.momoMat); e.scale.setScalar(Math.max(b.w, 0.8)); e.position.y = b.h * 0.3; body.add(e); body.scale.setScalar(1.12); }
    this.foeMeshes.set(id, g); this.stageGroup.add(g);
    return g;
  }

  private gadgetObj(g: Gadget, sk: <X extends { dispose: () => void }>(x: X) => X): THREE.Object3D | null {
    const grp = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material = this.clay, name = "") => { const m = new THREE.Mesh(sk(geo), mat); m.name = name; grp.add(m); return m; };
    switch (g.kind) {
      case "bonfire": add(M.bonfireGeo()); add(M.flameGeo(), this.glow, "flame"); return grp;
      case "drip": add(tint(new THREE.ConeGeometry(0.25, 0.6, 8).rotateZ(Math.PI).translate(0, -0.3, 0), "#5A6AA0")); return grp;
      case "icicle": add(M.icicleGeo(), this.clay, "ice").position.y = -0.35; return grp;
      case "spider": { add(M.spiderGeo(), this.clay, "spider"); add(tint(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, 0.5, 0), "#FFFFFF"), this.glow, "thread"); return grp; }
      case "crusher": add(M.crusherGeo(g.w ?? 2), this.clay, "block"); return grp;
      case "laser": { add(M.laserPost()); const top = add(M.laserPost()); top.position.y = (g.h ?? 7); top.rotation.z = Math.PI; add(tint(new THREE.CylinderGeometry(0.08, 0.08, (g.h ?? 7), 8).translate(0, (g.h ?? 7) / 2, 0), "#FF3D5E"), this.glow, "beam"); return grp; }
      case "arrow": add(M.shooterGeo("arrow")); return grp;
      case "cannon": add(M.shooterGeo("cannon")).rotation.y = (g.dir ?? -1) > 0 ? Math.PI : 0; return grp;
      case "geyser": case "sandjet": { add(M.ventGeo(g.kind === "sandjet" ? "#D98A3F" : "#5A4A4A")); add(tint(new THREE.CylinderGeometry(0.35, 0.45, 1, 10).translate(0, 0.5, 0), g.kind === "sandjet" ? "#F7D07A" : "#FF7A3D"), g.kind === "sandjet" ? this.clay : this.glow, "jet"); return grp; }
      case "switch": add(M.switchGeo(), this.clay, "sw"); return grp;
      case "lantern": add(M.lanternGeo(), this.clay, "lamp"); return grp;
      case "raincloud": { add(M.rainCloudGeo()); return grp; }
      case "shade": add(M.umbrellaGeo()).position.x = (g.w ?? 3) / 2; return grp;
      case "checkpoint": { const t = add(tiki(), this.clay, "tiki"); t.scale.setScalar(0.85); add(M.signGeo(), this.clay, "sign"); return grp; }
      case "gong": add(M.gongGeo(), this.momoMat, "gong"); return grp;
      case "searchlight": {
        add(M2.searchlightGeo(g.h ?? 8));
        const head = new THREE.Group(); head.name = "head"; grp.add(head);
        const lamp = new THREE.Mesh(sk(M2.lampHeadGeo()), this.clay); head.add(lamp);
        const beam = new THREE.Mesh(sk(new THREE.ConeGeometry(1.4, 1, 20, 1, true).translate(0, -0.5, 0)), this.beamMat); beam.name = "beam"; beam.renderOrder = 4; head.add(beam);
        return grp;
      }
      default: return null;
    }
  }

  private clearStage() {
    for (const c of [...this.stageGroup.children]) this.stageGroup.remove(c);
    for (const c of [...this.farGroup.children]) this.farGroup.remove(c);
    for (const k of this.stageKeep) k.dispose();
    this.stageKeep = []; this.dyn = []; this.swA = []; this.swB = []; this.beatA = []; this.beatB = []; this.gateMeshes = []; this.doorMeshes = []; this.crateMesh = [];
    this.foeMeshes.clear(); this.foeGeo.clear(); this.eliteGeo = null; this.gadgetObjs.clear(); this.items.clear(); this.itemIdx.clear(); this.potIdx.clear(); this.targetObjs.clear();
    this.bossMesh = null; this.bossSpin = null; this.bell = null; this.weather = null; this.chaseMesh = null; this.well = null; this.parts = [];
    this.escortMesh = null; this.riseMesh = null; this.moundGeo = null; this.aimLines.forEach((m) => (m.visible = false));
    for (const list of this.shotPool.values()) list.forEach((m) => m.removeFromParent());
    this.shotPool.clear();
    for (const list of this.lootPick.values()) list.forEach((m) => m.removeFromParent());
    this.lootPick.clear();
    this.booms.forEach((b) => { b.m.visible = false; b.t = 1; });
  }

  // ------------------------------------------------------------------ friends
  private friendMesh(f: FriendId): THREE.Object3D {
    let m = this.friendMeshes.get(f);
    if (m) return m;
    const geo = f === "turbo" ? turbo() : f === "pip" ? pip() : f === "hoot" ? hoot() : f === "bolt" ? bolt() : f === "gloop" ? gloop() : f === "noodle" ? noodle() : zib();
    this.keep.push(geo);
    const g = new THREE.Group(); const mm = new THREE.Mesh(geo, this.clay); mm.scale.setScalar(f === "turbo" ? 0.95 : 0.7); g.add(mm);
    if (f === "zib") { const d = new THREE.Mesh(this.keepGeo(merge([tint(new THREE.CylinderGeometry(0.9, 0.5, 0.3, 20), "#C8CCE0"), tint(new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.12, 0), "#9FE6FF")])), this.clay); d.position.y = -0.2; g.add(d); mm.position.y = -0.05; mm.scale.setScalar(0.5); }
    this.scene.add(g); this.friendMeshes.set(f, g); m = g;
    return m;
  }
  private keepGeo(g: THREE.BufferGeometry) { this.keep.push(g); return g; }

  // ------------------------------------------------------------------ events → effects
  onEvent(e: SimEvent) {
    const s = this.sim; if (!s) return;
    switch (e.t) {
      case "jump": this.burst(s.x, s.y + 0.05, "#F2E6D0", 6, 2, 0.08); break;
      case "land": if (e.hard) { this.burst(s.x, s.y + 0.05, "#F2E6D0", 12, 3.5, 0.1); this.cam.shake = Math.max(this.cam.shake, 0.15); } break;
      case "shoot": this.burst(e.x + s.face * 0.25, e.y, M2.WEAPON_COLOR[e.w], 2, 2.5, 0.06, 2); break;
      case "hit": this.burst(e.x, e.y, "#E8F6FF", 3, 3, 0.06, 6); break;
      case "shield": this.burst(e.x, e.y, "#C8D4E0", 4, 3.5, 0.06, 8); break;
      case "melt": { for (let i = 0; i < 2; i++) this.burst(e.x, e.y, MUD[i + (e.elite ? 2 : 0)], 9, 4.2, 0.11, 14); this.burst(e.x, e.y, "#7FD8FF", 6, 3, 0.07, 10); if (e.elite) this.burst(e.x, e.y + 0.4, "#FFD23F", 12, 5, 0.09, 6); break; }
      case "boom": this.boom(e.x, e.y, e.r); break;
      case "coin": this.burst(e.x, e.y, "#FFD23F", 3, 2, 0.05, -4); break;
      case "fruit": this.burst(e.x, e.y, "#FF8A3D", 8, 3, 0.07, -5); break;
      case "drop": this.burst(e.x, e.y, "#3DB8FF", 16, 4, 0.08, -3); break;
      case "stomp": this.burst(e.x, e.y, "#F2E6D0", 14, 5, 0.1); this.cam.shake = Math.max(this.cam.shake, 0.2); break;
      case "break": this.burst(e.x, e.y, this.pal?.brick ?? "#C8925A", 10, 5, 0.12); break;
      case "pot": this.burst(e.x, e.y + 0.4, "#C8925A", 14, 4.5, 0.12); this.burst(e.x, e.y + 0.6, "#FFE08A", 8, 3, 0.07, -3); break;
      case "hurt": this.cam.shake = 0.3; this.burst(s.x, s.y + 0.6, "#FF8A3D", 10, 4, 0.09); break;
      case "bossHit": break;
      case "bossDown": if (s.boss) { for (const c of ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF", "#B58CFF"]) this.burst(s.boss.x, s.boss.y + 1.5, c, 14, 8, 0.12, 6); this.boom(s.boss.x, s.boss.y + s.boss.h * 0.5, 3.6); } this.cam.shake = 0.7; break;
      case "crusher": this.cam.shake = Math.max(this.cam.shake, 0.2); break;
      case "gong": this.gongWobble = 1.2; for (const c of ["#FF5F7E", "#FFD23F", "#2FCB8B", "#3D8BFF"]) this.burst(s.x, s.y + 2, c, 10, 6, 0.1, 5); break;
      case "bell": this.rainT = 6; break;
      case "splash": this.burst(s.boss && s.boss.kind === "sub" ? s.boss.x : s.x, (s.st.boss?.water ?? s.y) + 0.3, "#9FE6FF", 14, 5, 0.09); break;
      case "checkpoint": { const cp = s.st.checkpoints[e.n - 1]; if (cp) for (const c of ["#FFD23F", "#3FC1B0", "#FF5F7E"]) this.burst(cp.x, cp.y + 2, c, 8, 4, 0.08, 3); break; }
      case "spawn": this.burst(e.x, e.y, "#B8AEA4", 10, 3, 0.12, 2); break;
      case "pumpDown": this.boom(e.x, e.y, 2.6); for (const c of ["#8A8178", "#FF8A2A", "#7FD8FF"]) this.burst(e.x, e.y + 1, c, 14, 6, 0.13, 10); this.cam.shake = 0.5; break;
      case "cageOpen": for (const c of ["#7FD86A", "#FFD23F", "#FFFFFF"]) this.burst(e.x, e.y + 0.6, c, 10, 4, 0.09, 4); break;
      case "key": this.burst(s.x, s.y + 1, "#7FF0FF", 16, 4, 0.08, -2); break;
      case "wellHit": this.wellFlash = 0.3; if (s.st.defend) this.burst(s.st.defend.x, s.st.defend.y + 1, "#3DA8FF", 6, 3, 0.08); break;
      case "gateClose": this.cam.shake = Math.max(this.cam.shake, 0.3); break;
      case "super": this.rainT = 3.2; this.cam.shake = 0.35; break;
      case "pickup": this.burst(s.x, s.y + 0.8, M2.WEAPON_COLOR[e.w], 18, 4, 0.08, -2); break;
      case "foeShot": this.burst(e.x, e.y, "#FFB23A", 2, 1.5, 0.05, 0); break;
      case "cartHit": this.escortFlash = 0.3; this.burst(s.escortX, s.escortY + 1, "#3DA8FF", 6, 3, 0.08); break;
      case "alarm": this.burst(e.x, e.y + 1.5, "#FF4A3A", 10, 4, 0.08, 2); this.cam.shake = Math.max(this.cam.shake, 0.25); break;
      case "huntDown": for (const c of ["#FFD23F", "#FFFFFF"]) this.burst(s.x, s.y + 1.6, c, 10, 4, 0.08, 3); break;
      default: break;
    }
  }
  private burst(x: number, y: number, color: string, n: number, speed: number, size: number, grav = 14) {
    for (let i = 0; i < n && this.parts.length < this.partMax; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ p: new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.6), v: new THREE.Vector3(Math.cos(a) * s, Math.abs(Math.sin(a)) * s + 1, (Math.random() - 0.5) * s * 0.5), life: 0.5 + Math.random() * 0.4, max: 0.9, size: size * (0.6 + Math.random() * 0.8), color: new THREE.Color(color), grav });
    }
  }
  /** a Storm Bomb's thunder-splash: a bright bubble, rain bits and a shake */
  private boom(x: number, y: number, r: number) {
    const b = this.booms.find((q) => q.t >= 1) ?? this.booms[0];
    b.t = 0; b.r = r; b.m.position.set(x, y, 0.2); b.m.visible = true;
    this.burst(x, y, "#9FD8FF", 16, r * 3, 0.1, 10); this.burst(x, y, "#FFFFFF", 8, r * 2.4, 0.08, 6);
    this.cam.shake = Math.max(this.cam.shake, r > 2 ? 0.45 : 0.2);
  }

  // ------------------------------------------------------------------ per frame
  frame(dt: number) {
    const s = this.sim; if (!s) return;
    this.t += dt;
    const st = s.st;
    // -- camera
    const portrait = this.w < this.h;
    const tilesWide = this.photo?.w ?? (s.boss?.active ? (portrait ? 16 : 32) : this.vertical ? (portrait ? 13 : 24) : portrait ? 10 : this.w < 900 ? 18 : 21);
    const vfov = (this.camera.fov * Math.PI) / 180, aspect = this.w / this.h;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = tilesWide / 2 / Math.tan(hfov / 2);
    this.cam.dist = this.photo ? dist : lerp(this.cam.dist, dist, Math.min(1, dt * 2));
    const halfH = Math.tan(vfov / 2) * this.cam.dist;
    let tx: number, ty: number;
    if (this.photo) { tx = this.photo.x; ty = this.photo.y; }
    else if (s.boss?.active && st.boss) { tx = (st.boss.x0 + st.boss.x1) / 2; ty = st.boss.floor + halfH * 0.55; }
    else if (this.vertical) {
      const up = st.goal.y > st.start.y;
      this.cam.lookY = lerp(this.cam.lookY, up ? 2.2 : -2.6, Math.min(1, dt * 1.5));
      tx = st.w / 2 + (s.x - st.w / 2) * 0.35; ty = s.y + this.cam.lookY;
    } else {
      this.cam.look = lerp(this.cam.look, s.face * (portrait ? 1.4 : 3.2), Math.min(1, dt * 1.5));
      tx = s.x + this.cam.look;
      ty = s.y + (portrait ? halfH * 0.3 : 1.8);
    }
    tx = clamp(tx, tilesWide / 2 - 1, st.w - tilesWide / 2 + 1);
    ty = clamp(ty, halfH - 1.2, Math.max(halfH - 1.2, st.h - halfH + 2));
    this.cam.x = this.photo ? tx : lerp(this.cam.x, tx, Math.min(1, dt * 5));
    if (this.photo) this.cam.y = ty;
    const dy = ty - this.cam.y;
    if (this.vertical || Math.abs(dy) > 0.6 || s.ground) this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * (this.vertical ? 4 : s.ground ? 3.5 : 1.6)));
    this.cam.shake = Math.max(0, this.cam.shake - dt);
    const sh = this.cam.shake * 0.35;
    this.camera.position.set(this.cam.x + (Math.random() - 0.5) * sh, this.cam.y + 1.0 + (Math.random() - 0.5) * sh, this.cam.dist);
    this.camera.lookAt(this.cam.x, this.cam.y, 0);
    this.sky.position.copy(this.camera.position);
    this.key.position.set(this.cam.x - 6, this.cam.y + 12, 10); this.key.target.position.set(this.cam.x, this.cam.y, 0);
    // the far scenery drifts with the camera on tall stages (it's far away)
    this.farGroup.position.set(this.vertical ? this.cam.x - st.w / 2 : 0, Math.max(0, this.cam.y - 9) * 0.92, 0);

    // -- dynamic tiles, switches, gates, the door
    for (const d of this.dyn) {
      const now = s.tiles[d.idx] === d.tile;
      if (now !== d.shown) { d.shown = now; d.mesh.setMatrixAt(d.i, now ? d.m : ZERO); d.mesh.instanceMatrix.needsUpdate = true; }
      if (now && d.tile === T.CRUMBLE) { const stood = s.stand.get(d.idx) ?? 0; if (stood > 0) { tmpM.copy(d.m); tmpM.elements[12] += (Math.random() - 0.5) * 0.06; d.mesh.setMatrixAt(d.i, tmpM); d.mesh.instanceMatrix.needsUpdate = true; } }
    }
    const sw = s.switchOn ? 1 : 0;
    if (sw !== this.switchShown) { this.switchShown = sw; this.swA.forEach((m) => (m.visible = !s.switchOn)); this.swB.forEach((m) => (m.visible = s.switchOn)); }
    const bt = s.beatOn() ? 1 : 0;
    if (bt !== this.beatShown) { this.beatShown = bt; this.beatA.forEach((m) => (m.visible = s.beatOn())); this.beatB.forEach((m) => (m.visible = !s.beatOn())); }
    if (s.activeGate !== this.gateShown) { this.gateShown = s.activeGate; this.gateMeshes.forEach((m, i) => (m.visible = i === s.activeGate)); }
    const door = s.goalDone ? 1 : 0;
    if (door !== this.doorShown) { this.doorShown = door; this.doorMeshes.forEach((m) => (m.visible = !s.goalDone)); }
    const lv = this.liquidMats[1]; if (lv) lv.emissiveIntensity = 1.2 + Math.sin(this.t * 3) * 0.25;

    // -- Puddo, the ride, the friend
    this.syncPuddo(s, dt);
    this.syncFriend(s, dt);
    // -- enemies
    let shadowN = 0;
    const shadowAt = (x: number, y: number, r: number) => { if (shadowN >= 96) return; const gy = s.groundAt(x, y + 0.2); if (gy < -4 || y - gy > 8) return; const k = clamp(1 - (y - gy) / 8, 0.2, 1) * r; tmpM.compose(tmpP.set(x, gy + 0.03, 0.1), tmpQ.identity(), tmpS.set(k, 1, k * 0.7)); this.shadow.setMatrixAt(shadowN++, tmpM); };
    shadowAt(s.x, s.y, 0.9);
    const live = new Set<number>();
    for (const f of s.foes) {
      live.add(f.id);
      const near = Math.abs(f.x - this.cam.x) < 26 && Math.abs(f.y - this.cam.y) < 18;
      let g = this.foeMeshes.get(f.id);
      if (!g) { if (!f.alive || !near) continue; g = this.foeMesh(f.id, f.kind, f.elite); }
      g.visible = f.alive && near;
      if (!g.visible) continue;
      const body = g.getObjectByName("body")!;
      g.position.set(f.x, f.y, 0);
      const b = f.b, fly = b.b === "fly" || b.b === "swim" || b.b === "drone" || b.b === "bomber" || b.b === "dive" || b.b === "copter";
      // under the ground (a root, a sand shark) or still up in the sky (a drop pod): a moving mound, or nothing
      const hid = s.hidden(f);
      body.visible = !hid;
      if (b.b === "ambusher" || b.b === "burrower") {
        let mound = g.getObjectByName("mound");
        if (!mound) { if (!this.moundGeo) { this.moundGeo = tint(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#8A6A4A"); this.stageKeep.push(this.moundGeo); } mound = new THREE.Mesh(this.moundGeo, this.clay); mound.name = "mound"; g.add(mound); }
        mound.visible = hid; if (hid) { mound.scale.set(b.w * 0.9, 0.35 + Math.abs(Math.sin(this.t * 8 + f.id)) * 0.12, 0.8); if (Math.abs(f.vx) > 0.5 && Math.random() < 0.3) this.burst(f.x, f.y + 0.1, "#B89A6A", 1, 2, 0.07, 10); }
      }
      if (hid) continue;
      body.rotation.y = b.b === "hive" ? 0 : f.dir > 0 ? 0.9 : -0.9;
      body.position.y = fly ? Math.sin(this.t * 10 + f.id) * 0.05 : f.ground && Math.abs(f.vx) > 0.1 ? Math.abs(Math.sin(this.t * (b.b === "runner" ? 18 : 10) + f.id)) * 0.08 : 0;
      // squash on a stomp, pop on a hit, swell before an attack (the tell)
      const sq = f.squash > 0 ? 0.55 : 1;
      const tell = f.tell > 0 || f.flash > 0 ? 1 + Math.abs(Math.sin(this.t * 30)) * 0.12 : 1;
      const hit = f.hit > 0 ? 1.12 : 1;
      body.scale.set((f.elite ? 1.12 : 1) * hit * tell / Math.sqrt(sq), (f.elite ? 1.12 : 1) * sq * tell * (2 - hit), f.elite ? 1.12 : 1);
      if (b.b === "dive" || b.b === "drone") body.rotation.z = f.state === 2 ? -Math.atan2(f.vy, Math.abs(f.vx)) * Math.sign(f.vx || 1) * 0.6 : 0;
      if (!fly && !b.ceiling) shadowAt(f.x, f.y, b.w);
    }
    for (const [id, g] of this.foeMeshes) if (!live.has(id) && g.visible) g.visible = false;
    // snipers' red aiming lines (dodge before the shot)
    let aims = 0;
    for (const f of s.foes) {
      if (aims >= this.aimLines.length || !f.alive || f.b.b !== "sniper" || f.tell <= 0) continue;
      const m = this.aimLines[aims++], x0 = f.x, y0 = f.y + f.b.h * 0.7, dx = f.ax - x0, dy = f.ay - y0, len = Math.hypot(dx, dy) + 6;
      m.visible = Math.floor(this.t * (f.tell < 0.3 ? 20 : 8)) % 2 === 0 || f.tell > 0.3;
      m.position.set(x0, y0, 0.3); m.rotation.set(0, 0, Math.atan2(dy, dx)); m.scale.set(len, f.tell < 0.3 ? 1.8 : 1, 1);
    }
    for (let i = aims; i < this.aimLines.length; i++) this.aimLines[i].visible = false;
    // -- boss
    if (this.bossMesh && s.boss) {
      const b = s.boss, g = this.bossMesh, body = g.getObjectByName("body")!, mound = g.getObjectByName("mound")!;
      g.visible = !b.down || b.t < 1.2;
      g.position.set(b.x, b.y, 0);
      const machine = MACHINES.has(b.kind);
      body.visible = !b.under || b.kind === "sub";
      if (b.kind === "sub" && b.under) body.visible = true;
      mound.visible = b.under && b.kind !== "sub"; mound.position.y = (st.boss?.floor ?? b.y) - b.y + 0.1;
      // machines mirror (not turn) when they face left, so the general and the front details stay toward the camera
      body.rotation.y = machine ? (b.dir > 0 ? 0.25 : -0.25) : b.dir > 0 ? 0.7 : -0.7;
      if (b.kind === "copter" || b.kind === "gyro" || b.kind === "blimp") body.rotation.z = clamp(-b.vx * 0.04, -0.3, 0.3);
      const tell = b.state.endsWith("Tell") && Math.floor(this.t * 16) % 2 === 0;
      const k = tell ? 1.07 : 1; body.scale.set(machine && b.dir < 0 ? -k : k, k, k);
      if (this.bossSpin) { this.bossSpin.rotation[this.bossSpinAxis] += dt * (b.kind === "worm" || b.kind === "borer" || b.kind === "rig" ? 14 : b.kind === "crusher" ? 4 : b.kind === "blimp" ? 10 : 24); this.bossSpin.visible = !b.under; }
      if (b.down) { g.scale.setScalar(Math.max(0.01, 1 - b.t)); g.rotation.z = b.t * 4; }
      if (b.state === "dizzy") body.rotation.z = Math.sin(this.t * 12) * 0.12; else if (b.kind !== "copter" && b.kind !== "gyro" && b.kind !== "blimp") body.rotation.z = 0;
      if (b.under && b.state === "eruptTell" && Math.random() < 0.6) this.burst(b.x + (Math.random() - 0.5) * 1.2, st.boss!.floor + 0.2, "#B8A080", 2, 3, 0.1, 10);
      if (!b.under && b.kind !== "copter" && b.kind !== "gyro" && b.kind !== "blimp" && b.kind !== "puffer") shadowAt(b.x, b.y, b.w * 0.8);
      if (b.kind === "express" && Math.abs(b.vx) > 3 && Math.random() < 0.5) this.burst(b.x - b.dir * b.w * 0.2, b.y + b.h * 1.25, "#C8C0B8", 1, 2, 0.14, -3);
      if (b.kind === "forge" && Math.random() < 0.25) this.burst(b.x, b.y + b.h * 1.2, "#FF8A2A", 1, 2, 0.08, -4);
      if (this.bell) { this.bell.visible = b.down && !machine; if (b.down) { const gd = st.gadgets.find((q) => q.kind === "bell"); if (gd) { this.bell.position.set(gd.x, gd.y + Math.sin(this.t * 2) * 0.15, 0); this.bell.rotation.z = Math.sin(this.t * 5) * 0.25; } } }
    }
    // -- targets and the well
    for (const tg of st.targets) {
      const o = this.targetObjs.get(tg.id); if (!o) continue;
      const hp = s.tgtHp.get(tg.id) ?? 0, near = Math.abs(tg.x - this.cam.x) < 28;
      const body = o.getObjectByName("body")!, sp = o.getObjectByName("sprout");
      body.visible = hp > 0 && near;
      if (tg.kind === "pump") { body.position.x = hp > 0 && hp < tg.hp * 0.5 ? Math.sin(this.t * 40) * 0.03 : 0; body.position.y = Math.abs(Math.sin(this.t * 6 + tg.x)) * 0.04; }
      if (sp) {
        if (hp > 0) { sp.visible = near; sp.position.y = 0.2 + Math.abs(Math.sin(this.t * 3 + tg.x)) * 0.06; sp.rotation.y = Math.sin(this.t * 2) * 0.4; }
        else { const k = (sp.userData.t = (sp.userData.t ?? 0) + dt); sp.visible = k < 1.4; sp.position.y = 0.2 + Math.sin(Math.min(1, k) * Math.PI) * 2.2 + k * 0.6; sp.rotation.y += dt * 10; }
      }
    }
    if (this.well) { this.wellFlash = Math.max(0, this.wellFlash - dt); this.well.position.x = (st.defend?.x ?? 0) + (this.wellFlash > 0 ? Math.sin(this.t * 60) * 0.06 : 0); this.well.visible = s.wellHp > 0; }
    // -- items
    for (const it of st.items) {
      const ref = this.itemIdx.get(it.id); if (!ref) continue;
      const [mesh, i] = ref;
      if (s.taken.has(it.id)) { mesh.setMatrixAt(i, ZERO); mesh.instanceMatrix.needsUpdate = true; this.itemIdx.delete(it.id); continue; }
      if (Math.abs(it.x - this.cam.x) > 22 || Math.abs(it.y - this.cam.y) > 16) continue;
      const spin = it.kind === "coin" || it.kind === "key" ? this.t * 3 + it.x * 0.5 : Math.sin(this.t * 2 + it.x) * 0.4;
      tmpQ.setFromEuler(tmpE.set(0, spin, 0));
      tmpM.compose(tmpP.set(it.x, it.y + Math.sin(this.t * 3 + it.x) * 0.06, 0), tmpQ, tmpS.set(1, 1, 1));
      mesh.setMatrixAt(i, tmpM); mesh.instanceMatrix.needsUpdate = true;
    }
    // -- pots and crates
    for (const p of st.pots) {
      const ref = this.potIdx.get(p.id); if (!ref) continue;
      const [m, i] = ref;
      if (s.potsOpen.has(p.id)) { m.setMatrixAt(i, ZERO); this.potIdx.delete(p.id); }
      else { const wob = Math.sin(this.t * 3 + p.x) * (p.crate ? 0.02 : 0.06); tmpQ.setFromEuler(tmpE.set(0, 0, wob)); tmpM.compose(tmpP.set(p.x, p.y, 0), tmpQ, tmpS.set(1, 1, 1)); m.setMatrixAt(i, tmpM); }
      m.instanceMatrix.needsUpdate = true;
    }
    // -- gadgets, platforms
    for (const g of st.gadgets) this.syncGadget(g, s);
    for (const c of this.stageGroup.children) {
      const p = c.userData.plat, r = c.userData.rope;
      if (p) { c.position.set(p.x, p.y, 0); c.rotation.z = p.tilt; }
      if (r) { const ddx = r.s.x - r.x, ddy = r.s.y - r.y; c.position.set(r.x, r.y, 0); c.rotation.z = Math.atan2(-ddx, ddy); c.scale.y = Math.hypot(ddx, ddy); }
    }
    // -- shots, loot, bomb flashes
    this.syncShots(s.shots);
    for (const sh of s.shots) if (sh.foe && (sh.kind === "rock" || sh.kind === "meteor" || sh.kind === "icicle" || sh.kind === "drip" || sh.kind === "bombDrop" || sh.kind === "shell")) shadowAt(sh.x, sh.y, 0.7);
    this.shadow.count = shadowN; this.shadow.instanceMatrix.needsUpdate = true;
    this.syncLoot(s);
    for (const b of this.booms) {
      if (b.t >= 1) continue;
      b.t += dt * 3.2;
      const k = Math.min(1, b.t);
      b.m.scale.setScalar(b.r * (0.35 + 0.75 * Math.sqrt(k)));
      (b.m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      if (b.t >= 1) b.m.visible = false;
    }
    if (this.riseMesh) { this.riseMesh.visible = s.riseY > -8; this.riseMesh.position.y = s.riseY - 30 + Math.sin(this.t * 2.4) * 0.08; if (st.rules.rise?.kind === "lava" && Math.random() < 0.35) this.burst(s.x + (Math.random() - 0.5) * 16, s.riseY + 0.1, "#FFB23A", 1, 3, 0.08, 6); }
    if (this.escortMesh) {
      this.escortFlash = Math.max(0, this.escortFlash - dt);
      this.escortMesh.position.set(s.escortX + (this.escortFlash > 0 ? Math.sin(this.t * 60) * 0.06 : 0), s.escortY + Math.abs(Math.sin(this.t * 7)) * 0.03, -0.3);
      this.escortMesh.rotation.z = s.escortHp <= 0 ? 1.2 : 0;
      if (s.escortHp > 0 && Math.random() < 0.25 && this.parts.length < this.partMax) this.parts.push({ p: new THREE.Vector3(s.escortX + 0.3, s.escortY + 1.9, 0), v: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, 0), life: 0.5, max: 0.5, size: 0.06, color: new THREE.Color("#9FD8FF"), grav: 10 });
    }
    if (st.rules.train) {
      this.cam.shake = Math.max(this.cam.shake, 0.04);
      for (let i = 0; i < 2 && this.parts.length < this.partMax; i++) if (Math.random() < 0.7) this.parts.push({ p: new THREE.Vector3(this.cam.x + 14, this.cam.y - 4 + Math.random() * 12, -1.5 - Math.random() * 2), v: new THREE.Vector3(-42, 0, 0), life: 0.7, max: 0.7, size: 0.05, color: new THREE.Color("#FFFFFF"), grav: 0 });
    }
    if (this.chaseMesh && st.rules.chase) { const k = st.rules.chase.kind; this.chaseMesh.position.set(s.chaseX - (k === "boulder" ? 2.4 : 0.8), k === "boulder" ? s.groundAt(s.chaseX, 14) + 2.4 : -1, 0); if (k === "boulder") this.chaseMesh.rotation.z -= dt * 2.5; else this.chaseMesh.position.y += Math.sin(this.t * 3) * 0.2; }
    if (st.rules.chase?.kind === "collapse" && s.t > st.rules.chase.delay && Math.random() < 0.5) this.burst(s.chaseX - 0.5, (st.goal.y || 4) - 0.5 + Math.random() * 2, "#8A6A4A", 1, 4, 0.12, 14);
    this.syncParticles(dt);
    if (this.portrait) {
      this.stageGroup.visible = false; this.farGroup.visible = false; this.sky.visible = false; this.shadow.visible = false; this.partMesh.visible = false; this.lootCoins.visible = false;
      this.scene.background = new THREE.Color(this.portrait); this.scene.fog = null;
      const inner = this.momo.getObjectByName("inner")!; inner.rotation.set(0, Math.PI - 0.45, 0); inner.scale.set(1, 1, 1);
      this.momo.visible = true; this.momo.position.set(s.x, s.y, 0); this.cart.visible = false; this.raft.visible = false;
      this.camera.position.set(s.x + 0.15, s.y + 0.85, 3.6); this.camera.lookAt(s.x, s.y + 0.62, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.syncWeather();
    if (this.rainT > 0) { this.rainT -= dt; for (let i = 0; i < (s.superT > 0 ? 14 : 6) && this.parts.length < this.partMax; i++) this.parts.push({ p: new THREE.Vector3(this.cam.x + (Math.random() - 0.5) * 26, this.cam.y + 9, (Math.random() - 0.5) * 4), v: new THREE.Vector3(-1, -16, 0), life: 1.2, max: 1.2, size: 0.05, color: new THREE.Color("#9FD8FF"), grav: 0 }); }
    this.renderer.render(this.scene, this.camera);
  }

  private syncPuddo(s: Sim, dt: number) {
    const g = this.momo, inner = g.getObjectByName("inner")!;
    const target = s.face > 0 ? -2.1 : 2.1;
    this.yaw = lerp(this.yaw, target, Math.min(1, dt * 14));
    inner.rotation.y = this.yaw;
    const rk = s.st.ride?.kind;
    const ride = s.friend === "turbo" ? 0.55 : rk === "cart" ? 0.42 : rk === "raft" ? 0.28 : rk === "tank" ? 0.62 : rk === "mech" ? 1.1 : 0;
    g.position.set(s.x, s.y + ride, 0);
    let sx = 1, sy = 1;
    if (s.squeezed) { sx = 1.3; sy = 0.55; }
    else if (!s.ground) { const v = clamp(s.vy / 20, -1, 1); sy = 1 + v * 0.14; sx = 1 - v * 0.08; }
    if (s.anim.land > 0) { const k = s.anim.land / 0.18; sy *= 1 - 0.22 * k; sx *= 1 + 0.16 * k; }
    inner.scale.set(sx, sy, sx);
    const run = s.anim.run * 5.5, moving = s.ground && Math.abs(s.vx) > 0.4 && !s.st.ride;
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, ph = run + (i ? Math.PI : 0);
      const f = this.feet[i];
      f.position.set(sd * 0.2, moving ? Math.max(0, Math.sin(ph)) * 0.16 : 0, moving ? Math.cos(ph) * 0.22 : s.ground ? 0 : 0.12 * sd);
      f.rotation.x = moving ? -Math.cos(ph) * 0.5 : s.ground ? 0 : -0.4;
      const a = this.arms[i];
      a.position.set(sd * 0.47, 0.55, 0);
      a.rotation.z = sd * (s.ground ? 0.35 : 1.3);
      a.rotation.x = moving ? Math.cos(ph) * 0.8 : 0;
      if (i === 0) { a.rotation.z = -0.15; a.rotation.x = -1.35; a.position.set(-0.32, 0.6, -0.25); }
      if (i === 1 && s.anim.throw > 0) a.rotation.x = -2.2 * (s.anim.throw / 0.22);
    }
    // the Rain Blaster in front, aimed (and kicking back on each shot)
    const aim = Math.asin(clamp(s.aimY, -1, 1));
    this.blaster.position.set(-0.2, 0.62 + (s.squeezed ? -0.12 : 0), -0.42 + (s.anim.fire > 0 ? 0.06 : 0));
    this.blaster.rotation.set(aim, Math.PI, 0);
    this.blaster.scale.setScalar(s.anim.fire > 0 ? 1.08 : 1);
    this.body.position.y = moving ? Math.abs(Math.sin(run)) * 0.06 : Math.sin(this.t * 2.2) * 0.012;
    if (this.charMesh) { this.charMesh.position.y = moving ? Math.abs(Math.sin(run)) * 0.12 : Math.sin(this.t * 2.2) * 0.02; this.charMesh.rotation.z = moving ? Math.sin(run) * 0.08 : 0; }
    if (this.hatMesh) this.hatMesh.position.y = (HAT_Y[this.look.char] ?? 1.02) - HAT_BASE * 0.5 + (this.charMesh ? this.charMesh.position.y : this.body.position.y);
    const cols = TRAIL_COLORS[this.look.trail];
    if (cols && (Math.abs(s.vx) > 3 || !s.ground)) {
      this.trailT -= dt;
      if (this.trailT <= 0 && this.parts.length < this.partMax) {
        this.trailT = 0.045;
        const c = cols[Math.floor(Math.random() * cols.length)];
        this.parts.push({ p: new THREE.Vector3(s.x - s.face * 0.35, s.y + 0.45 + Math.random() * 0.4, -0.1), v: new THREE.Vector3(-s.face * 0.8, this.look.trail === "bubbles" ? 1.2 : 0.4, 0), life: 0.6, max: 0.6, size: this.look.trail === "hearts" || this.look.trail === "stars" ? 0.11 : 0.08, color: new THREE.Color(c), grav: this.look.trail === "fire" ? -2 : 1 });
      }
    }
    this.sprout.position.set(0, (TOP_Y[this.look.char] ?? 1.06) + this.body.position.y, 0); this.sprout.rotation.z = Math.sin(this.t * 6) * (this.look.char === "puddo" ? 0.06 : 0.15) + (s.ground ? 0 : -s.vy * 0.012);
    if (s.stomping) inner.rotation.x = lerp(inner.rotation.x, Math.PI * 2, Math.min(1, dt * 18)); else inner.rotation.x = 0;
    // star power: rainbow; Super Rain: glowing blue
    if (s.star > 0 || s.superT > 0) { tmpC.setHSL(s.superT > 0 ? 0.55 + Math.sin(this.t * 8) * 0.05 : (this.t * 1.5) % 1, 0.9, 0.62); this.momoMat.color.copy(tmpC); this.momoMat.emissive.copy(tmpC).multiplyScalar(0.35); }
    else { this.momoMat.color.setRGB(1, 1, 1); this.momoMat.emissive.setRGB(0, 0, 0); this.momoMat.clearcoat = 0.9; }
    g.visible = !(s.inv > 0 && Math.floor(this.t * 16) % 2 === 0);
    // the ride under Puddo
    if (rk === "tank" || rk === "mech") {
      const v = rk === "tank" ? this.tank : this.mech, face = s.face > 0 ? 0 : Math.PI;
      v.position.set(s.x, s.y + (rk === "tank" && s.ground && Math.abs(s.vx) > 0.5 ? Math.abs(Math.sin(this.t * 18)) * 0.03 : 0), 0);
      v.rotation.y = lerp(v.rotation.y, face, Math.min(1, dt * 12));
      v.rotation.z = s.ground ? 0 : clamp(s.vy * 0.01, -0.15, 0.15);
      if (rk === "mech") { const ph = s.anim.run * 5.5, walk = s.ground && Math.abs(s.vx) > 0.4; this.mechLegs.forEach((l, i) => { l.rotation.z = walk ? Math.sin(ph + i * Math.PI) * 0.45 : 0; }); }
      if (s.ground && Math.abs(s.vx) > 2 && Math.random() < 0.3) this.burst(s.x - s.face * 0.8, s.y + 0.1, "#B89A7A", 1, 2, 0.08, 6);
    } else if (rk === "cart" || rk === "raft") {
      const r = rk === "cart" ? this.cart : this.raft;
      r.visible = true;
      r.position.set(s.x, s.y + (rk === "raft" ? -0.25 + Math.sin(this.t * 3) * 0.05 : 0.02), 0);
      r.rotation.z = s.ground ? Math.sin(this.t * 9) * 0.02 : clamp(s.vy * 0.015, -0.2, 0.2);
      if (s.ground && Math.abs(s.vx) > 2 && Math.random() < 0.3) this.burst(s.x - 0.6, s.y + 0.1, rk === "cart" ? "#FFE08A" : "#BFEFFF", 1, 2, 0.06, 6);
    }
  }
  private syncFriend(s: Sim, dt: number) {
    const glide = s.st.ride?.kind === "glider";
    const want: FriendId | undefined = glide ? "hoot" : s.friend;
    if (this.friendNow !== want) { if (this.friendNow) this.friendMesh(this.friendNow).visible = false; this.friendNow = want; }
    if (!want) return;
    const m = this.friendMesh(want); m.visible = true;
    const f = want; let x = s.x - s.face * 0.9, y = s.y + 0.15 + Math.sin(this.t * 4) * 0.06;
    m.rotation.z = glide ? Math.sin(this.t * 14) * 0.1 : 0;
    m.scale.setScalar(glide ? 1.55 : 1);
    if (glide) { x = s.x - 0.1; y = s.y + 1.05 + Math.sin(this.t * 7) * 0.05; }
    else if (f === "turbo") { x = s.x; y = s.y - 0.05; }
    else if (f === "hoot" && s.gliding) { x = s.x; y = s.y + 1.25; }
    else if (f === "zib") { x = s.x - s.face * 0.3; y = s.y + 1.9 + Math.sin(this.t * 3) * 0.1; }
    else if (f === "gloop") { x = s.x - s.face * 0.35; y = s.y + 0.4; }
    else if (f === "hoot" || f === "bolt") { y += 0.9; }
    m.position.x = lerp(m.position.x || x, x, Math.min(1, dt * 12)); m.position.y = lerp(m.position.y || y, y, Math.min(1, dt * 12)); m.position.z = f === "turbo" ? 0 : -0.35;
    m.rotation.y = s.face > 0 ? 0.9 : -0.9;
  }
  private syncGadget(g: Gadget, s: Sim) {
    const o = this.gadgetObjs.get(g.id); if (!o) return;
    if (Math.abs(g.x - this.cam.x) > 28 || Math.abs(g.y - this.cam.y) > 20) { o.visible = false; return; }
    o.visible = true;
    switch (g.kind) {
      case "bonfire": { const f = o.getObjectByName("flame")!; f.scale.set(1 + Math.sin(this.t * 17) * 0.08, 1 + Math.sin(this.t * 11 + g.x) * 0.18, 1); break; }
      case "icicle": o.getObjectByName("ice")!.visible = !s.gs(g); break;
      case "spider": { const yy = -(g.h ?? 5) * (0.5 - 0.5 * Math.cos(s.cyc(g) * Math.PI * 2)); o.getObjectByName("spider")!.position.y = yy; const th = o.getObjectByName("thread")!; th.scale.y = Math.max(0.01, -yy); th.position.y = yy; break; }
      case "crusher": { const c = s.cyc(g), down = c < 0.35 ? 0 : c < 0.45 ? (c - 0.35) / 0.1 : c < 0.7 ? 1 : 1 - (c - 0.7) / 0.3; o.getObjectByName("block")!.position.y = -down * ((g.h ?? 5) - 0.1) - 1; break; }
      case "laser": { const on = s.gs(g) === 1, c = s.cyc(g); const beam = o.getObjectByName("beam")!; beam.visible = on || (c > 0.9 && Math.floor(this.t * 16) % 2 === 0); beam.scale.x = beam.scale.z = on ? 1 + Math.sin(this.t * 40) * 0.2 : 0.3; break; }
      case "geyser": case "sandjet": { const st2 = s.gs(g), jet = o.getObjectByName("jet")!; jet.visible = st2 >= (g.kind === "geyser" ? 2 : 1); jet.scale.y = jet.visible ? (g.kind === "geyser" ? (g.h ?? 6) : 3) * (0.85 + Math.sin(this.t * 20) * 0.08) : 0.01; break; }
      case "switch": { const m = o.getObjectByName("sw") as THREE.Mesh; m.scale.y = s.switchOn ? 0.75 : 1; m.rotation.y = s.switchOn ? Math.PI : 0; break; }
      case "lantern": { const lit = s.lit.has(g.id); const m = o.getObjectByName("lamp") as THREE.Mesh; m.material = lit ? this.glow : this.clay; break; }
      case "checkpoint": { const tk = o.getObjectByName("tiki")!, reached = s.st.checkpoints.findIndex((c) => Math.abs(c.x - g.x) < 0.01 && Math.abs(c.y - g.y) < 0.01) <= s.cp; tk.position.y = reached ? Math.abs(Math.sin(this.t * 6)) * 0.35 : 0; tk.rotation.y = reached ? Math.sin(this.t * 3) * 0.5 : 0.4; break; }
      case "searchlight": {
        const bx = s.gstate.get(g.id) ?? g.x, hh = g.h ?? 8, head = o.getObjectByName("head")!, beam = o.getObjectByName("beam") as THREE.Mesh;
        head.rotation.z = Math.atan2(bx - g.x, hh);
        beam.scale.set(1, Math.hypot(bx - g.x, hh) + 0.6, 1);
        beam.material = (s.gstate.get(g.id + 500000) ?? 0) > s.t ? this.beamRed : this.beamMat;
        break;
      }
      case "gong": { const m = o.getObjectByName("gong")!; this.gongWobble = Math.max(0, this.gongWobble - 1 / 60); m.rotation.y = Math.sin(this.t * 25) * this.gongWobble * 0.25; m.scale.setScalar(s.goalDone ? 1 : 0.85); break; }
    }
  }
  private shotGeometry(key: string): THREE.BufferGeometry {
    let geo = this.shotGeo.get(key);
    if (geo) return geo;
    if (key in M2.WEAPON_COLOR) geo = M2.pelletGeo(M2.WEAPON_COLOR[key as Weapon], key === "geyser" ? 0.24 : key === "hailstone" ? 0.19 : 0.16);
    else switch (key) {
      case "bomb": geo = M2.bombGeo(); break;
      case "dust": geo = M2.dustBallGeo(); break;
      case "shell": geo = M2.shellGeo(); break;
      case "bombDrop": geo = M2.bombGeo(); break;
      case "mine": geo = M2.mineGeo(); break;
      case "ball": geo = this.sim?.boss?.kind === "sub" ? M2.bubbleGeo() : M.ballGeo("#9F7BFF", 0.28); break;
      case "arrow": geo = M.arrowGeo(); break;
      case "icicle": geo = M.icicleGeo(); break;
      case "drip": geo = M.dripGeo(); break;
      case "rock": case "meteor": geo = M.rockGeo(key === "meteor" ? "#FF7A3D" : "#8A7A6A"); break;
      case "coconut": geo = M.ballGeo("#7A4A2A", 0.32); break;
      case "snow": geo = M.ballGeo("#FFFFFF", 0.32); break;
      case "cannon": geo = M.ballGeo("#2B2B33", 0.35); break;
      case "roller": geo = M.ballGeo(this.isl?.id === "peaks" ? "#FFFFFF" : "#7A4A2A", 1); break;
      case "note": geo = M.ballGeo("#FF3DC8", 0.26); break;
      case "laser": geo = tint(new THREE.BoxGeometry(0.6, 0.12, 0.12), "#FF3D5E"); break;
      case "fire": geo = M.ballGeo("#FF7A1F", 0.3); break;
      case "spike": geo = tint(new THREE.ConeGeometry(0.12, 0.42, 6).rotateZ(-Math.PI / 2), "#FFE08A"); break;
      case "spore": geo = merge([tint(new THREE.SphereGeometry(0.42, 12, 9), "#9BE04A"), tint(new THREE.SphereGeometry(0.22, 8, 6).translate(0.25, 0.2, 0.15), "#C8F08A"), tint(new THREE.SphereGeometry(0.2, 8, 6).translate(-0.25, 0.12, -0.1), "#7AC03A")]); break;
      case "orb": geo = merge([tint(new THREE.SphereGeometry(0.26, 12, 9), "#C86AFF"), tint(new THREE.SphereGeometry(0.12, 8, 6).translate(0.08, 0.08, 0.15), "#F0D8FF")]); break;
      case "ice": geo = tint(new THREE.ConeGeometry(0.12, 0.5, 6).rotateZ(-Math.PI / 2), "#BFEFFF"); break;
      case "flame": geo = merge([tint(new THREE.SphereGeometry(0.3, 10, 8), "#FF7A1F"), tint(new THREE.SphereGeometry(0.17, 8, 6).translate(0.08, 0.06, 0.1), "#FFD23F")]); break;
      case "tankShell": geo = merge([tint(new THREE.SphereGeometry(0.2, 10, 8).scale(1.5, 1, 1), "#3DA8FF"), tint(new THREE.SphereGeometry(0.1, 8, 6).translate(0.12, 0.05, 0.1), "#FFFFFF")]); break;
      default: geo = M.ballGeo("#9F7BFF", 0.28);
    }
    this.keep.push(geo); this.shotGeo.set(key, geo);
    return geo;
  }
  private syncShots(shots: Shot[]) {
    const used = new Map<string, number>();
    for (const sh of shots) {
      const key = sh.kind;
      let list = this.shotPool.get(key); if (!list) { list = []; this.shotPool.set(key, list); }
      const n = used.get(key) ?? 0; used.set(key, n + 1);
      let m = list[n];
      if (!m) {
        const glowy = key === "laser" || key === "fire" || key === "meteor" || key === "dust" || key === "thunder" || key === "rainbow" || key === "orb" || key === "flame";
        m = new THREE.Mesh(this.shotGeometry(key), glowy ? this.glow : !sh.foe && key !== "bomb" ? this.momoMat : this.clay);
        list.push(m); this.stageGroup.add(m);
      }
      m.visible = true; m.position.set(sh.x, sh.y, 0);
      if (key === "roller") { m.scale.setScalar(sh.r); m.rotation.z -= sh.vx * 0.016 / Math.max(0.2, sh.r); }
      else if (key === "arrow" || key === "spike" || key === "ice" || key === "laser" || key === "tankShell") m.rotation.set(0, 0, Math.atan2(sh.vy, sh.vx) + (key === "arrow" ? Math.PI : 0));
      else if (key === "spore") { m.rotation.y += 0.02; m.scale.setScalar(1 + Math.sin(this.t * 6 + sh.x) * 0.08); }
      else if (!sh.foe && key !== "bomb") m.rotation.set(0, 0, Math.atan2(sh.vy, sh.vx));
      else if (key === "mine") { m.rotation.set(0, this.t, 0); m.scale.setScalar(Math.floor(this.t * 4) % 2 ? 1 : 1.08); }
      else m.rotation.z += 0.2;
    }
    for (const [key, list] of this.shotPool) { const n = used.get(key) ?? 0; for (let i = n; i < list.length; i++) list[i].visible = false; }
  }
  private syncLoot(s: Sim) {
    let n = 0;
    const used = new Map<string, number>();
    for (const l of s.loot) {
      if (l.t > 1e8) continue;
      if (l.kind === "coin") {
        if (n >= 220) continue;
        tmpQ.setFromEuler(tmpE.set(0, this.t * 6 + l.id, 0));
        tmpM.compose(tmpP.set(l.x, l.y, 0.1), tmpQ, tmpS.setScalar(0.8)); this.lootCoins.setMatrixAt(n++, tmpM);
        continue;
      }
      const key = l.kind === "weapon" ? `w:${l.w}` : l.kind;
      let list = this.lootPick.get(key); if (!list) { list = []; this.lootPick.set(key, list); }
      const k = used.get(key) ?? 0; used.set(key, k + 1);
      let m = list[k];
      if (!m) { const geo = this.keepGeo(l.kind === "weapon" ? M2.pickupGeo(M2.WEAPON_COLOR[l.w ?? "drizzle"]) : l.kind === "bombs" ? M2.bombGeo() : M.heartGeo()); m = new THREE.Mesh(geo, l.kind === "weapon" ? this.momoMat : this.clay); list.push(m); this.scene.add(m); }
      m.visible = true; m.position.set(l.x, l.y + Math.sin(this.t * 4 + l.id) * 0.1, 0.1); m.rotation.y = this.t * 2;
      m.scale.setScalar(l.t > 11 && Math.floor(this.t * 8) % 2 === 0 ? 0.01 : 1.1);
    }
    this.lootCoins.count = n; this.lootCoins.instanceMatrix.needsUpdate = true;
    for (const [key, list] of this.lootPick) { const k = used.get(key) ?? 0; for (let i = k; i < list.length; i++) list[i].visible = false; }
  }
  private syncParticles(dt: number) {
    let n = 0;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of this.parts) {
      p.v.y -= p.grav * dt; p.p.addScaledVector(p.v, dt);
      const k = p.size * Math.min(1, p.life / (p.max * 0.5));
      tmpM.compose(p.p, tmpQ.identity(), tmpS.set(k, k, k));
      this.partMesh.setMatrixAt(n, tmpM); this.partMesh.setColorAt(n, p.color); n++;
    }
    this.partMesh.count = n; this.partMesh.instanceMatrix.needsUpdate = true; if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
  }
  private syncWeather() {
    const m = this.weather; if (!m) return;
    const n = m.count, k = this.weatherKind;
    for (let i = 0; i < n; i++) {
      const sp = k === "rain" ? 14 : k === "snow" ? 1.6 : k === "ash" ? 1.2 : k === "stars" ? 0 : 0.6;
      const span = 34, hgt = 22;
      const x = this.cam.x - span / 2 + ((hash(i, 1) * span + (k === "dust" ? this.t * 2 : 0)) % span);
      const yy = k === "stars" ? this.cam.y + 2 + hash(i, 2) * 14 : this.cam.y - hgt / 2 + (((hash(i, 2) * hgt - this.t * sp) % hgt) + hgt) % hgt;
      const z = k === "stars" ? -60 - hash(i, 3) * 20 : -6 + hash(i, 3) * 9;
      const wob = k === "snow" ? Math.sin(this.t * 1.5 + i) * 0.4 : 0;
      tmpS.setScalar(k === "stars" ? 1 + hash(i, 5) * 1.5 + Math.sin(this.t * 3 + i) * 0.3 : 1);
      tmpM.compose(tmpP.set(x + wob, yy, z), tmpQ.identity(), tmpS);
      m.setMatrixAt(i, tmpM);
    }
    m.instanceMatrix.needsUpdate = true;
  }

  /** stage coordinates → pixels on screen (for DOM labels) */
  screen(x: number, y: number): [number, number] {
    tmpP.set(x, y, 0).project(this.camera);
    return [(tmpP.x * 0.5 + 0.5) * this.w, (-tmpP.y * 0.5 + 0.5) * this.h];
  }
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.gov?.dispose();
    this.clearStage();
    for (const k of this.keep) k.dispose();
    this.friendMeshes.forEach((m) => m.removeFromParent());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
