// Obby Bike Blaster's 3D view (three.js on the shared mobile kit: device quality, pixel ratio, a FrameGovernor):
// - the sky: a gradient dome with a pixel sun or moon, stars at night;
// - the backdrop, the part you see most, which travels with you along the course: a ring of far blocky shapes (floating
//   islands, mesas, towers with lit windows, snow peaks, mushrooms, volcanoes, temples, ships, pagodas, factories,
//   craters, crystals, toy blocks, storm clouds, rainbow arcs, glitch shards), the world's giant landmark (a castle, a
//   lollipop, a stone arch, an idol, a lighthouse, a robot, a ringed planet…), drifting voxel clouds, and below the
//   course a sea, lava, goo, a sea of clouds or the void with floating rocks; plus weather;
// - the course: every still box merged into one mesh per material, with world-space pixel textures (16 px a metre, the
//   decks a 2 m checker) and soft shading at the bottom of every side; moving pieces as their own meshes;
// - checkpoint flags, the finish arch, pickups, blob shadows and effects.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor, shadowsFor, isPhone, type Quality } from "@/lib/perf";
import type { Course, LevelPlan, Mat, Piece, PickupKind } from "./course";
import { BIG_MATS, GLOW_MATS, paintMaterials, textureOf } from "./tex";
import { Debris, Sparks, Tracers } from "./fx";
import { WORLDS, type TimeOfDay, type World } from "./worlds";
import { hash, makeRng, mix, rgb, shade } from "./util";

export interface Look { sky: [string, string, string]; fog: string; sun: string; light: string; ground: string; lightI: number; hemiI: number; exposure: number; night: boolean; sunDir: THREE.Vector3; fogNear: number; fogFar: number }
export function lookFor(w: World, time: TimeOfDay, mods: string[] = []): Look {
  const s = w.sky;
  let sky: [string, string, string] = [s.top, s.mid, s.bot], fog = s.fog, sun = s.sun, light = s.light, ground = s.ground, lightI = 2.3, hemiI = 1.45;
  const sunDir = new THREE.Vector3(0.45, 0.75, 0.5);
  if (time === "golden") { sky = [mix(s.top, "#5B6FD8", 0.3), mix(s.mid, "#FFB27A", 0.45), mix(s.bot, "#FFD08A", 0.6)]; fog = mix(fog, "#FFC890", 0.45); light = mix(light, "#FFC07A", 0.55); sunDir.set(0.7, 0.35, 0.5); lightI = 2.2; }
  if (time === "dusk") { sky = [mix(s.top, "#1E2058", 0.55), mix(s.mid, "#B0507A", 0.5), mix(s.bot, "#FF8A5A", 0.55)]; fog = mix(fog, "#7A4E7A", 0.5); light = mix(light, "#FF9A7A", 0.5); ground = shade(ground, -0.3); sunDir.set(-0.7, 0.25, 0.6); lightI = 1.6; hemiI = 1.15; }
  if (time === "night") {
    const dark = s.top.match(/^#0|^#1/) ? 0 : 0.75;
    sky = [mix(s.top, "#050816", dark), mix(s.mid, "#101A44", dark), mix(s.bot, "#2A2E66", dark)]; fog = mix(fog, "#141A3A", dark * 0.85);
    light = mix(light, "#9DB4FF", 0.6); ground = shade(ground, -0.5); sunDir.set(-0.35, 0.7, 0.4); lightI = 1.05; hemiI = 0.95; sun = "#E8EEFF";
  }
  const fogged = mods.includes("fog");
  return { sky, fog, sun, light, ground, lightI, hemiI, exposure: s.exposure, night: time === "night", sunDir: sunDir.normalize(), fogNear: fogged ? 14 : 45, fogFar: fogged ? 70 : 240 };
}

// ------------------------------------------------------------------ pickup sprites (pixel art, extruded into voxels)
const PICKUP_ART: Record<PickupKind, { rows: string[]; pal: Record<string, string>; depth: number; px: number }> = {
  coin: { rows: ["..YYYY..", ".YWWYYO.", "YWYYYYOY", "YWYOOYOY", "YYYOOYOY", "YYYYYYOY", ".YOOOOY.", "..YYYY.."], pal: { Y: "#FFD23F", W: "#FFF6C8", O: "#E8A317" }, depth: 1, px: 0.06 },
  gem: { rows: ["..CCC..", ".CWCCC.", "CWCCCCD", "CCCCCDD", ".CCCDD.", "..CDD..", "...D..."], pal: { C: "#7CF5FF", W: "#FFFFFF", D: "#2E9BFF" }, depth: 2, px: 0.08 },
  heart: { rows: [".RR.RR.", "RWRRRRR", "RWRRRRR", "RRRRRRD", ".RRRRD.", "..RRD..", "...D..."], pal: { R: "#FF4F7A", W: "#FFFFFF", D: "#B0183F" }, depth: 2, px: 0.09 },
  oil: { rows: ["..KK..", ".RRRR.", "RRRRRR", "RYYYYR", "RYKKYR", "RYYYYR", "RRRRRR", "RDDDDR"], pal: { R: "#E23B3B", Y: "#FFC83D", K: "#22222A", D: "#8E1B1B" }, depth: 3, px: 0.08 },
  power: { rows: ["PPPPPPP", "PPYYYPP", "PYPPPYP", "PPPPYPP", "PPPYPPP", "PPPPPPP", "PPPYPPP"], pal: { P: "#9B5DE5", Y: "#FFE45C" }, depth: 7, px: 0.075 },
};
function spriteGeometry(rows: string[], pal: Record<string, string>, depth: number, px: number) {
  const pos: number[] = [], col: number[] = [], nrm: number[] = [];
  const H = rows.length, Wd = rows[0].length;
  const filled = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < Wd && rows[y][x] !== ".";
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], cl: number[]) => { for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); nrm.push(n[0], n[1], n[2]); col.push(cl[0], cl[1], cl[2]); } };
  const z0 = -depth / 2, z1 = depth / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
    const ch = rows[y][x];
    if (ch === ".") continue;
    const [r, g, b] = rgb(pal[ch]); const c = [r / 255, g / 255, b / 255], dk = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
    const X0 = x - Wd / 2, X1 = X0 + 1, Y1 = H / 2 - y, Y0 = Y1 - 1;
    quad([X0, Y0, z1], [X1, Y0, z1], [X1, Y1, z1], [X0, Y1, z1], [0, 0, 1], c);
    quad([X1, Y0, z0], [X0, Y0, z0], [X0, Y1, z0], [X1, Y1, z0], [0, 0, -1], c);
    if (!filled(x, y - 1)) quad([X0, Y1, z1], [X1, Y1, z1], [X1, Y1, z0], [X0, Y1, z0], [0, 1, 0], c);
    if (!filled(x, y + 1)) quad([X0, Y0, z0], [X1, Y0, z0], [X1, Y0, z1], [X0, Y0, z1], [0, -1, 0], dk);
    if (!filled(x - 1, y)) quad([X0, Y0, z0], [X0, Y0, z1], [X0, Y1, z1], [X0, Y1, z0], [-1, 0, 0], dk);
    if (!filled(x + 1, y)) quad([X1, Y0, z1], [X1, Y0, z0], [X1, Y1, z0], [X1, Y1, z1], [1, 0, 0], dk);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos.map((v) => v * px), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ boxes and ramps with world-space pixel UVs
/** append one box (or a ramp whose top slopes along z) to growing arrays; uv = world metres × scale */
function pushBox(pos: number[], nrm: number[], uv: number[], col: number[], idx: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, sc: number, ramp?: 1 | -1, ox = 0, oy = 0, oz = 0) {
  // ramps: the top at z0 and z1
  const topA = ramp ? (ramp > 0 ? y0 + 1 : y1) : y1, topB = ramp ? (ramp > 0 ? y1 : y0 + 1) : y1;
  const face = (vs: number[][], n: number[], uvs: number[][], shadeV: number[]) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(vs[i][0] - ox, vs[i][1] - oy, vs[i][2] - oz); nrm.push(n[0], n[1], n[2]); uv.push(uvs[i][0] * sc, uvs[i][1] * sc); col.push(shadeV[i], shadeV[i], shadeV[i]); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const lo = 0.62, hi = 1;
  // top (sloped for ramps)
  const ny = ramp ? Math.cos(Math.atan2(topB - topA, z1 - z0)) : 1, nz = ramp ? -Math.sin(Math.atan2(topB - topA, z1 - z0)) : 0;
  face([[x0, topB, z1], [x1, topB, z1], [x1, topA, z0], [x0, topA, z0]], [0, ny, nz], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]], [hi, hi, hi, hi]);
  // bottom
  face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [0.5, 0.5, 0.5, 0.5]);
  // +z and -z
  face([[x0, y0, z1], [x1, y0, z1], [x1, topB, z1], [x0, topB, z1]], [0, 0, 1], [[x0, y0], [x1, y0], [x1, topB], [x0, topB]], [lo, lo, hi, hi]);
  face([[x1, y0, z0], [x0, y0, z0], [x0, topA, z0], [x1, topA, z0]], [0, 0, -1], [[-x1, y0], [-x0, y0], [-x0, topA], [-x1, topA]], [lo, lo, hi, hi]);
  // +x and -x
  face([[x1, y0, z1], [x1, y0, z0], [x1, topA, z0], [x1, topB, z1]], [1, 0, 0], [[-z1, y0], [-z0, y0], [-z0, topA], [-z1, topB]], [lo, lo, hi, hi]);
  face([[x0, y0, z0], [x0, y0, z1], [x0, topB, z1], [x0, topA, z0]], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, topB], [z0, topA]], [lo, lo, hi, hi]);
}
function geometryOf(pos: number[], nrm: number[], uv: number[], col: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
/** pieces that move or change: drawn on their own */
export const isDynamic = (p: Piece) => !!p.move || !!p.spin || p.kind === "fall" || p.kind === "bridge" || p.kind === "crate" || p.kind === "target" || p.kind === "laser" || p.kind === "belt";

const _o = new THREE.Object3D();
const _c = new THREE.Color();
const PICKUPS: PickupKind[] = ["coin", "gem", "heart", "oil", "power"];

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.08, 900);
  readonly q: Quality;
  readonly phone = isPhone();
  private gov: FrameGovernor;
  private w = 1; private h = 1;
  private hemi: THREE.HemisphereLight; private sunL: THREE.DirectionalLight; private fill: THREE.DirectionalLight; private headL: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh; private stars: THREE.Points;
  /** everything far away that travels with the camera */
  private backdrop = new THREE.Group();
  private stageObjs: THREE.Object3D[] = [];
  private keep: { dispose: () => void }[] = [];
  private mats = new Map<Mat, THREE.Material>();
  private texs = new Map<Mat, THREE.Texture>();
  /** a mesh per moving piece (id → mesh) */
  readonly dyn = new Map<number, THREE.Mesh>();
  private flags: { mesh: THREE.Mesh; x: number; z: number; section: number }[] = [];
  private weather: THREE.InstancedMesh | null = null; private wx = new Float32Array(0); private wxKind = "none";
  private clouds: THREE.InstancedMesh | null = null; private liquidMat: THREE.ShaderMaterial | null = null; private below: THREE.Object3D | null = null;
  readonly debris: Debris; readonly sparks: Sparks; readonly tracers: Tracers;
  readonly pickups = new Map<PickupKind, THREE.InstancedMesh>();
  readonly shadows: THREE.InstancedMesh;
  look: Look | null = null; plan: LevelPlan | null = null;
  shadowsOn: boolean;
  t = 0;
  private beltTex: THREE.Texture[] = []; private boostTex: THREE.Texture | null = null;
  private killMat: THREE.MeshBasicMaterial | null = null;
  private killCol = new THREE.Color();

  constructor(host: HTMLElement, quality: Quality) {
    this.q = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.shadowsOn = shadowsFor(quality);
    this.renderer.shadowMap.enabled = this.shadowsOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    const sc = this.scene;
    sc.fog = new THREE.Fog("#ffffff", 45, 240);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1); sc.add(this.hemi);
    this.sunL = new THREE.DirectionalLight("#ffffff", 2.3); sc.add(this.sunL); sc.add(this.sunL.target);
    this.fill = new THREE.DirectionalLight("#ffffff", 0.55); this.fill.position.set(-5, 4, -6); sc.add(this.fill);
    this.headL = new THREE.DirectionalLight("#ffffff", 0.4); sc.add(this.headL); sc.add(this.headL.target);
    if (this.shadowsOn) {
      this.sunL.castShadow = true;
      const s = this.sunL.shadow;
      s.mapSize.set(this.phone ? 1024 : 2048, this.phone ? 1024 : 2048);
      s.camera.left = -22; s.camera.right = 22; s.camera.top = 22; s.camera.bottom = -22; s.camera.near = 1; s.camera.far = 120;
      s.bias = -0.0008; s.normalBias = 0.04;
    }
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.3, 1) }, moon: { value: 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunDir; uniform float moon; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h));
        float s = max(dot(vP, sunDir), 0.0);
        vec3 sd = normalize(sunDir); vec3 ax = normalize(cross(sd, vec3(0.0,1.0,0.0))); vec3 ay = cross(ax, sd);
        vec2 q = vec2(dot(vP, ax), dot(vP, ay)) / 0.06;
        float disc = step(abs(q.x), 1.0) * step(abs(q.y), 1.0) * step(0.0, s);
        float crater = moon * step(0.35, fract(q.x * 1.5 + 0.2)) * step(0.5, fract(q.y * 1.5 + 0.6)) * 0.25;
        c += sun * (disc * (1.6 - crater) + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; sc.add(this.sky);
    {
      const n = 700, p = new Float32Array(n * 3), r = makeRng(99);
      for (let i = 0; i < n; i++) { const u = r() * 0.95 + 0.05, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * 600; p[i * 3 + 1] = u * 600; p[i * 3 + 2] = Math.sin(a) * s * 600; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
      this.stars.frustumCulled = false; sc.add(this.stars);
    }
    sc.add(this.backdrop);
    const cap = this.phone ? 1 : 1.7;
    this.debris = new Debris(Math.round(220 * cap)); sc.add(this.debris.mesh);
    this.sparks = new Sparks(Math.round(240 * cap)); sc.add(this.sparks.mesh);
    this.tracers = new Tracers(30); sc.add(this.tracers.mesh);
    for (const k of PICKUPS) {
      const a = PICKUP_ART[k];
      const m = new THREE.InstancedMesh(spriteGeometry(a.rows, a.pal, a.depth, a.px), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(k === "coin" ? "#3a2a00" : k === "gem" ? "#0a3a44" : "#1a1a1a") }), k === "coin" ? 240 : 40);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
      this.pickups.set(k, m); sc.add(m);
    }
    {
      const g = new THREE.CircleGeometry(0.5, 14); g.rotateX(-Math.PI / 2);
      this.shadows = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }), 40);
      this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1;
      sc.add(this.shadows);
    }
  }

  // ------------------------------------------------------------------ a level's world
  setLevel(plan: LevelPlan, course: Course) {
    this.clearLevel();
    this.plan = plan;
    const w = WORLDS.find((x) => x.id === plan.world)!, w2 = plan.blend ? WORLDS.find((x) => x.id === plan.blend)! : null;
    const L = lookFor(w, plan.time, plan.mods);
    this.look = L;
    // materials
    const cvs = paintMaterials(w, L.night);
    for (const m of Object.keys(cvs) as Mat[]) {
      const t = textureOf(cvs[m]); this.texs.set(m, t); this.keep.push(t);
      const glow = GLOW_MATS.includes(m);
      const mat = glow ? new THREE.MeshBasicMaterial({ map: t, vertexColors: true }) : new THREE.MeshLambertMaterial({ map: t, vertexColors: true });
      if (m === "kill") this.killMat = mat as THREE.MeshBasicMaterial;
      if (m === "boost") this.boostTex = t;
      this.mats.set(m, mat); this.keep.push(mat);
    }
    // light and sky
    const sc = this.scene, fog = sc.fog as THREE.Fog;
    fog.color.set(L.fog); fog.near = L.fogNear; fog.far = L.fogFar;
    this.skyMat.uniforms.top.value.set(L.sky[0]); this.skyMat.uniforms.mid.value.set(L.sky[1]); this.skyMat.uniforms.bot.value.set(L.sky[2]);
    this.skyMat.uniforms.sun.value.set(L.sun).multiplyScalar(L.night ? 0.8 : 1);
    this.skyMat.uniforms.sunDir.value.copy(L.sunDir);
    this.skyMat.uniforms.moon.value = L.night ? 1 : 0;
    this.stars.visible = L.night || w.sky.top.startsWith("#0");
    this.hemi.color.set(mix(L.sky[1], "#ffffff", 0.35)); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sunL.color.set(L.light); this.sunL.intensity = L.lightI;
    this.fill.color.set(L.sky[1]);
    this.renderer.toneMappingExposure = L.exposure;
    // the course: still pieces merged per material
    const buf = new Map<Mat, { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] }>();
    for (const p of course.pieces) {
      if (isDynamic(p)) { this.addDynamic(p); continue; }
      let b = buf.get(p.mat);
      if (!b) buf.set(p.mat, (b = { pos: [], nrm: [], uv: [], col: [], idx: [] }));
      pushBox(b.pos, b.nrm, b.uv, b.col, b.idx, p.x0, p.y0, p.z0, p.x1, p.y1, p.z1, BIG_MATS.includes(p.mat) ? 0.5 : 1, p.ramp);
    }
    for (const [m, b] of buf) {
      const g = geometryOf(b.pos, b.nrm, b.uv, b.col, b.idx);
      const mesh = new THREE.Mesh(g, this.mats.get(m)!);
      mesh.frustumCulled = false; mesh.receiveShadow = this.shadowsOn; mesh.castShadow = this.shadowsOn;
      this.add(mesh, g);
    }
    // checkpoint flags and the finish arch
    const flagG = new THREE.BoxGeometry(0.08, 0.6, 1.0); flagG.translate(0, 0, 0.5);
    const poleG = new THREE.BoxGeometry(0.12, 3, 0.12); poleG.translate(0, 1.5, 0);
    const poleM = new THREE.MeshLambertMaterial({ color: "#E8ECF5" });
    this.keep.push(flagG, poleG, poleM);
    course.checkpoints.forEach((c) => {
      const pole = new THREE.Mesh(poleG, poleM); pole.position.set(c.x + 2.2, c.y, c.z); this.add(pole);
      const fm = new THREE.MeshLambertMaterial({ color: w.pal.accent, emissive: new THREE.Color(w.pal.accent).multiplyScalar(0.25) });
      const flag = new THREE.Mesh(flagG, fm); flag.position.set(c.x + 2.2, c.y + 2.4, c.z); this.add(flag, fm);
      this.flags.push({ mesh: flag, x: c.x, z: c.z, section: c.section });
    });
    {
      const f = course.finish;
      const am = this.mats.get("finish")!;
      const pg = new THREE.BoxGeometry(1, 6, 1); pg.translate(0, 3, 0);
      const tg = new THREE.BoxGeometry(8, 1.4, 1);
      const a = new THREE.Mesh(pg, am); a.position.set(f.x - 3.5, f.y, f.z); this.add(a, pg);
      const b = new THREE.Mesh(pg, am); b.position.set(f.x + 3.5, f.y, f.z); this.add(b);
      const t = new THREE.Mesh(tg, this.mats.get("cp")!); t.position.set(f.x, f.y + 6.5, f.z); this.add(t, tg);
    }
    // the backdrop
    this.buildSkyline(w, w2, L, plan.seed);
    this.buildLandmark(w2 && plan.n % 2 ? w2 : w, L, course);
    this.buildBelow(w, L, course);
    this.buildClouds(w, L, plan.seed);
    this.buildWeather(plan.weather, w);
    // sun shadows follow the rider
    this.sunL.position.set(L.sunDir.x * 60, L.sunDir.y * 60, L.sunDir.z * 60);
  }
  private add(o: THREE.Object3D, ...keep: { dispose: () => void }[]) { this.scene.add(o); this.stageObjs.push(o); this.keep.push(...keep); }
  private addDynamic(p: Piece) {
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    const cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2, cz = (p.z0 + p.z1) / 2;
    pushBox(pos, nrm, uv, col, idx, p.x0, p.y0, p.z0, p.x1, p.y1, p.z1, BIG_MATS.includes(p.mat) ? 0.5 : 1, p.ramp, cx, cy, cz);
    const g = geometryOf(pos, nrm, uv, col, idx);
    let mat = this.mats.get(p.mat)!;
    if (p.kind === "belt") {
      // each belt scrolls its own copy of the texture, arrows pointing the way it pushes
      const t = this.texs.get("belt")!.clone(); t.needsUpdate = true;
      t.rotation = (p.belt?.vx ?? 0) > 0 ? -Math.PI / 2 : Math.PI / 2; t.center.set(0.5, 0.5);
      this.beltTex.push(t);
      mat = new THREE.MeshLambertMaterial({ map: t, vertexColors: true });
      this.keep.push(t, mat);
    }
    const m = new THREE.Mesh(g, mat);
    m.position.set(cx, cy, cz);
    m.castShadow = this.shadowsOn; m.receiveShadow = this.shadowsOn;
    this.add(m, g);
    this.dyn.set(p.id, m);
  }
  clearLevel() {
    for (const o of this.stageObjs) o.removeFromParent();
    this.stageObjs = [];
    for (const k of this.keep) k.dispose();
    this.keep = []; this.mats.clear(); this.texs.clear(); this.dyn.clear(); this.flags = []; this.beltTex = []; this.boostTex = null; this.killMat = null;
    for (const c of [...this.backdrop.children]) c.removeFromParent();
    this.weather = null; this.clouds = null; this.liquidMat = null; this.below = null;
    this.debris.clear(); this.sparks.clear(); this.tracers.clear();
  }

  // ------------------------------------------------------------------ the backdrop
  private bd(o: THREE.Object3D, ...keep: { dispose: () => void }[]) { this.backdrop.add(o); this.keep.push(...keep); }
  private boxes(list: { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: string; glow?: boolean; ry?: number }[], fog = false) {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const lit = list.filter((s) => !s.glow), glow = list.filter((s) => s.glow);
    const mk = (l: typeof list, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, l.length));
      l.forEach((s, i) => { _o.position.set(s.x, s.y, s.z); _o.rotation.set(0, s.ry ?? hash(i, 7) * Math.PI, 0); _o.scale.set(s.sx, s.sy, s.sz); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.set(s.c)); });
      m.count = l.length; m.frustumCulled = false;
      return m;
    };
    const lm = new THREE.MeshLambertMaterial({ color: "#ffffff", fog }), gm = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
    const a = mk(lit, lm), b = mk(glow, gm);
    this.bd(a, lm, g, { dispose: () => a.dispose() }); this.bd(b, gm, { dispose: () => b.dispose() });
  }
  private buildSkyline(w: World, w2: World | null, L: Look, seed: number) {
    const r = makeRng(seed ^ 0x9e3779b9);
    const shapes: Parameters<View["boxes"]>[0] = [];
    const ring = (wd: World, from: number, to: number) => {
      const [c0, c1] = wd.skyCol;
      const count = this.phone ? 64 : 100;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + r() * 0.05;
        if (a < from || a > to) continue;
        const d = 150 + r() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d;
        const near = 1 - (d - 150) / 120;
        const col = mix(mix(c0, c1, r()), L.fog, 0.2 + (1 - near) * 0.4);
        const big = 0.8 + r() * 1.0, y0 = -30;
        switch (wd.skyline) {
          case "islands": { const yy = -10 + r() * 50; for (let k = 0; k < 4; k++) shapes.push({ x, y: yy - k * 4, z, sx: (20 - k * 4.5) * big, sy: 4, sz: (20 - k * 4.5) * big, c: k === 0 ? mix(wd.pal.top, L.fog, 0.35) : shade(col, -k * 0.06) }); if (r() < 0.4) shapes.push({ x, y: yy + 4, z, sx: 3, sy: 7 * big, sz: 3, c: mix(wd.pal.platA, L.fog, 0.4) }); break; }
          case "hills": case "forest": case "temples": case "pagodas": { for (let k = 0; k < 4; k++) shapes.push({ x: x + (r() - 0.5) * 14, y: y0, z: z + (r() - 0.5) * 14, sx: (22 - k * 4) * big, sy: 30 + 14 * big * (0.4 + k * 0.25), sz: (22 - k * 4) * big, c: shade(col, k * 0.04) }); break; }
          case "mesas": { const h = 50 + 20 * big; shapes.push({ x, y: y0, z, sx: 26 * big, sy: h, sz: 20 * big, c: col }); shapes.push({ x, y: y0 + h, z, sx: 28 * big, sy: 3, sz: 22 * big, c: shade(col, 0.08) }); break; }
          case "towers": case "circuits": case "factory": { const h = 60 + r() * 60; shapes.push({ x, y: y0, z, sx: 10 + r() * 8, sy: h, sz: 10 + r() * 8, c: col }); for (let k = 0; k < 5; k++) shapes.push({ x: x + (r() - 0.5) * 8, y: y0 + r() * h, z: z + (r() - 0.5) * 8, sx: 3, sy: 1, sz: 3, c: wd.pal.glow, glow: true }); break; }
          case "peaks": case "volcano": case "craters": { const h = (wd.skyline === "craters" ? 34 : 80) * big; for (let k = 0; k < 6; k++) shapes.push({ x, y: y0 + (k * h) / 6, z, sx: (30 - k * 4.5) * big, sy: h / 6, sz: (30 - k * 4.5) * big, c: wd.skyline === "peaks" && k > 3 ? mix("#ffffff", L.fog, 0.2) : shade(col, k * 0.03) }); if (wd.skyline === "volcano" && r() < 0.5) shapes.push({ x, y: y0 + h, z, sx: 6, sy: 1.5, sz: 6, c: "#FF7A2A", glow: true }); break; }
          case "shrooms": { const h = 40 + 20 * big; shapes.push({ x, y: y0, z, sx: 4, sy: h, sz: 4, c: mix("#E8DCC4", L.fog, 0.4) }); shapes.push({ x, y: y0 + h, z, sx: 20 * big, sy: 5, sz: 20 * big, c: mix(r() < 0.5 ? "#C8374F" : "#9B5DE5", L.fog, 0.35) }); break; }
          case "candy": case "toys": { const h = 30 + 20 * big; shapes.push({ x, y: y0, z, sx: 2, sy: h, sz: 2, c: "#ffffff" }); shapes.push({ x, y: y0 + h, z, sx: 12 * big, sy: 12 * big, sz: 2.5, c: mix(pickC(r, wd), L.fog, 0.3) }); shapes.push({ x: x + 16, y: y0, z, sx: 16 * big, sy: 34 * big, sz: 16 * big, c: mix(pickC(r, wd), L.fog, 0.45) }); break; }
          case "sea": { if (r() < 0.3) { shapes.push({ x, y: -12, z, sx: 18, sy: 4, sz: 5, c: "#7A5A3A" }); shapes.push({ x, y: -8, z, sx: 1.2, sy: 14, sz: 1.2, c: "#5A4030" }); shapes.push({ x, y: -4, z, sx: 8, sy: 8, sz: 0.6, c: mix("#ffffff", L.fog, 0.2) }); } else shapes.push({ x, y: -14, z, sx: 24 * big, sy: 8 * big, sz: 24 * big, c: col }); break; }
          case "crystals": case "glitch": case "rainbow": case "storm": { const h = 50 * big; const glowC = wd.skyline === "rainbow" ? ["#FF6F6F", "#FFB347", "#FFE45C", "#3EE08F", "#6FB8FF", "#B06CFF"][i % 6] : wd.skyline === "glitch" ? (r() < 0.5 ? "#FF3DF0" : "#3DF5FF") : wd.skyline === "storm" ? mix("#5E6678", L.fog, 0.3) : "#B98AFF"; shapes.push({ x, y: y0 + (wd.skyline === "storm" ? 40 + r() * 30 : 0), z, sx: wd.skyline === "storm" ? 26 * big : 5, sy: wd.skyline === "storm" ? 8 : h, sz: wd.skyline === "storm" ? 18 * big : 5, c: glowC, glow: wd.skyline !== "storm" && r() < 0.6 }); break; }
        }
      }
    };
    if (w2) { ring(w, 0, Math.PI); ring(w2, Math.PI, Math.PI * 2); } else ring(w, 0, Math.PI * 2);
    this.boxes(shapes);
  }
  /** one giant thing in the distance, ahead and to the side of the course: the world's landmark */
  private buildLandmark(w: World, L: Look, course: Course) {
    void course;
    const S: Parameters<View["boxes"]>[0] = [];
    const ax = 120, az = 220, y0 = -30;
    const P = w.pal, f = (c: string, k = 0.25) => mix(c, L.fog, k);
    const col = (x: number, z: number, h: number, sx: number, c: string, y = y0) => S.push({ x: ax + x, y, z: az + z, sx, sy: h, sz: sx, c: f(c), ry: 0 });
    switch (w.landmark) {
      case "castle": for (const [x, z] of [[-24, -10], [24, -10], [-24, 10], [24, 10]]) { col(x, z, 90, 12, P.stone); col(x, z, 8, 14, P.wall, 60); } col(0, 0, 70, 40, P.stone); col(0, 0, 40, 18, P.platA, 40); break;
      case "lolly": col(0, 0, 90, 4, "#FFFFFF"); for (let k = 0; k < 6; k++) S.push({ x: ax, y: 60 + k * 0.5, z: az, sx: 46 - k * 7, sy: 46 - k * 7, sz: 4, c: f(k % 2 ? P.platA : P.accent), ry: 0 }); break;
      case "arch": col(-30, 0, 90, 16, P.platB); col(30, 0, 90, 16, P.platB); S.push({ x: ax, y: 60, z: az, sx: 76, sy: 18, sz: 16, c: f(P.platB), ry: 0 }); break;
      case "idol": col(0, 0, 50, 46, P.stone); col(0, 0, 40, 30, P.platB, 20); S.push({ x: ax - 7, y: 45, z: az - 15.5, sx: 5, sy: 5, sz: 1, c: P.accent, glow: true, ry: 0 }); S.push({ x: ax + 7, y: 45, z: az - 15.5, sx: 5, sy: 5, sz: 1, c: P.accent, glow: true, ry: 0 }); break;
      case "iceTower": for (let k = 0; k < 8; k++) col(0, 0, 18, 26 - k * 3, k % 2 ? P.ice : P.platA, y0 + k * 18); break;
      case "lighthouse": for (let k = 0; k < 8; k++) col(0, 0, 14, 14 - k * 0.6, k % 2 ? "#ffffff" : "#E8402E", y0 + k * 14); S.push({ x: ax, y: y0 + 112, z: az, sx: 10, sy: 8, sz: 10, c: "#FFE45C", glow: true, ry: 0 }); break;
      case "tower": case "spire": for (let k = 0; k < 10; k++) { col(0, 0, 16, 20 - k * 1.5, P.metal, y0 + k * 16); S.push({ x: ax, y: y0 + k * 16 + 14, z: az, sx: 21 - k * 1.5, sy: 1.2, sz: 21 - k * 1.5, c: P.edge, glow: true, ry: 0 }); } break;
      case "volcano": for (let k = 0; k < 8; k++) col(0, 0, 14, 110 - k * 13, P.platB, y0 + k * 14); S.push({ x: ax, y: y0 + 112, z: az, sx: 14, sy: 2, sz: 14, c: "#FF6A2B", glow: true, ry: 0 }); break;
      case "robot": col(-10, 0, 40, 12, P.platB); col(10, 0, 40, 12, P.platB); col(0, 0, 40, 34, P.platA, 10); col(0, 0, 22, 24, P.wall, 50); S.push({ x: ax - 6, y: 62, z: az - 12.5, sx: 5, sy: 5, sz: 1, c: "#7CF5FF", glow: true, ry: 0 }); S.push({ x: ax + 6, y: 62, z: az - 12.5, sx: 5, sy: 5, sz: 1, c: "#7CF5FF", glow: true, ry: 0 }); col(-24, 0, 8, 8, P.platB, 34); col(24, 0, 8, 8, P.platB, 34); break;
      case "mushroom": col(0, 0, 80, 12, "#E8DCC4"); col(0, 0, 14, 80, P.platA, 50); col(0, 0, 8, 60, P.platA, 62); break;
      case "manor": col(0, 0, 50, 60, P.platB); for (const x of [-26, 26]) col(x, 0, 80, 12, P.platB); for (let k = 0; k < 6; k++) S.push({ x: ax - 20 + k * 8, y: 0, z: az - 30.5, sx: 4, sy: 6, sz: 1, c: "#FFB347", glow: true, ry: 0 }); break;
      case "pagoda": for (let k = 0; k < 5; k++) { col(0, 0, 14, 34 - k * 5, P.platA, y0 + k * 18); col(0, 0, 3, 46 - k * 6, P.wall, y0 + k * 18 + 14); } break;
      case "clock": col(0, 0, 100, 30, P.platB); S.push({ x: ax, y: 40, z: az - 15.5, sx: 22, sy: 22, sz: 1, c: "#FFF6DC", glow: true, ry: 0 }); S.push({ x: ax, y: 50, z: az - 16, sx: 1.5, sy: 10, sz: 1, c: "#2A2A33", ry: 0 }); break;
      case "geode": for (let k = 0; k < 7; k++) S.push({ x: ax + (k - 3) * 12, y: y0, z: az + (k % 2) * 10, sx: 7, sy: 60 + (k % 3) * 25, sz: 7, c: k % 2 ? P.accent : P.edge, glow: true, ry: k }); break;
      case "planet": S.push({ x: ax - 40, y: 120, z: az + 200, sx: 90, sy: 90, sz: 90, c: f("#E8A86A", 0.1), ry: 0.4 }); S.push({ x: ax - 40, y: 160, z: az + 200, sx: 170, sy: 3, sz: 170, c: f("#FFE0B0", 0.1), ry: 0.7 }); break;
      case "dome": for (let k = 0; k < 5; k++) col(0, 0, 8, 70 - k * 13, k % 2 ? P.platA : "#D8DCE8", y0 + 30 + k * 8); S.push({ x: ax + 90, y: 160, z: az + 260, sx: 60, sy: 60, sz: 60, c: f("#5EA8F0", 0.1), ry: 0.3 }); break;
      case "rainbow": for (let k = 0; k < 6; k++) for (let a = 0; a < 16; a++) { const t = (a / 15) * Math.PI, rr = 110 - k * 7; S.push({ x: ax + Math.cos(t) * rr, y: y0 + Math.sin(t) * rr, z: az + 40, sx: 14, sy: 14, sz: 6, c: ["#FF6F6F", "#FFB347", "#FFE45C", "#3EE08F", "#6FB8FF", "#B06CFF"][k], glow: true, ry: 0 }); } break;
      case "core": for (let k = 0; k < 4; k++) S.push({ x: ax, y: 40, z: az, sx: 50 - k * 10, sy: 50 - k * 10, sz: 50 - k * 10, c: k % 2 ? "#FF3DF0" : "#1E0A2E", glow: k % 2 === 1, ry: k * 0.4 }); break;
    }
    this.boxes(S);
  }
  private buildBelow(w: World, L: Look, course: Course) {
    const y = course.minY - (w.below === "clouds" ? 18 : 10);
    if (w.below === "sea" || w.below === "lava" || w.below === "goo") {
      const glow = w.below === "lava" ? 1 : w.below === "goo" ? 0.35 : 0;
      const mat = new THREE.ShaderMaterial({
        transparent: w.below === "sea", fog: true,
        uniforms: { ...THREE.UniformsLib.fog, col: { value: new THREE.Color(w.belowColor) }, deep: { value: new THREE.Color(shade(w.belowColor, glow ? -0.25 : -0.45)) }, t: { value: 0 }, glow: { value: glow }, sky: { value: new THREE.Color(L.sky[1]) } },
        vertexShader: "varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
        fragmentShader: `uniform vec3 col; uniform vec3 deep; uniform float t; uniform float glow; uniform vec3 sky; varying vec3 vW;
          #include <fog_pars_fragment>
          void main(){ vec2 p = floor(vW.xz * 1.0) / 1.0;
            float w = sin(p.x * 0.35 + t * 1.3) * 0.5 + sin(p.y * 0.45 - t * 1.1) * 0.5 + sin((p.x + p.y) * 0.18 + t * 0.6);
            vec3 c = mix(deep, col, smoothstep(-1.2, 1.6, w)); c += step(1.75, w) * (1.0 - glow) * 0.35 + glow * (0.35 + 0.25 * sin(t * 2.0 + p.x * 0.2)) * col;
            c = mix(c, sky, 0.12 * (1.0 - glow));
            gl_FragColor = vec4(c, ${w.below === "sea" ? "0.9" : "1.0"});
            #include <fog_fragment>
          }`,
      });
      const g = new THREE.PlaneGeometry(1400, 1400); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat); m.position.y = y; m.renderOrder = 2;
      this.liquidMat = mat; this.below = m;
      this.bd(m, g, mat);
    } else if (w.below === "clouds") {
      // a sea of puffy voxel clouds under the course
      const g = new THREE.BoxGeometry(1, 1, 1);
      const m = new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: new THREE.Color(L.night ? "#141a30" : "#2a2a34") });
      const n = this.phone ? 160 : 260, inst = new THREE.InstancedMesh(g, m, n), r = makeRng(31);
      for (let i = 0; i < n; i++) { _o.position.set((r() - 0.5) * 500, y + r() * 6, (r() - 0.5) * 500); _o.scale.set(14 + r() * 22, 4 + r() * 5, 12 + r() * 18); _o.rotation.set(0, 0, 0); _o.updateMatrix(); inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i, _c.set(mix(w.belowColor, L.sky[2], r() * 0.4))); }
      inst.frustumCulled = false;
      this.below = inst;
      this.bd(inst, g, m, { dispose: () => inst.dispose() });
    } else {
      // the void: drifting rocks far below and a dim glow
      const g = new THREE.BoxGeometry(1, 1, 1);
      const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
      const n = 70, inst = new THREE.InstancedMesh(g, m, n), r = makeRng(41);
      for (let i = 0; i < n; i++) { const s = 2 + r() * 9; _o.position.set((r() - 0.5) * 400, y - 10 - r() * 60, (r() - 0.5) * 400); _o.scale.set(s, s * 0.8, s); _o.rotation.set(r(), r(), 0); _o.updateMatrix(); inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i, _c.set(shade(w.pal.platB, -0.2 - r() * 0.2))); }
      inst.frustumCulled = false;
      this.below = inst;
      this.bd(inst, g, m, { dispose: () => inst.dispose() });
    }
  }
  private buildClouds(w: World, L: Look, seed: number) {
    if (w.id === "moon" || w.id === "station" || w.id === "grid" || w.id === "crystal") return;
    const r = makeRng(seed + 5), n = this.phone ? 14 : 24, per = 5;
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: new THREE.Color(L.night ? "#1a2040" : "#3a3a44"), fog: false });
    const inst = new THREE.InstancedMesh(g, m, n * per);
    let i = 0;
    const col = L.night ? "#5A6488" : mix("#ffffff", L.sky[2], 0.25);
    for (let c = 0; c < n; c++) {
      const a = r() * Math.PI * 2, d = 60 + r() * 180, y = 40 + r() * 40;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      for (let k = 0; k < per; k++) { _o.position.set(x + (r() - 0.5) * 16, y + (r() - 0.5) * 2, z + (r() - 0.5) * 9); _o.scale.set(7 + r() * 11, 2 + r() * 2.5, 5 + r() * 8); _o.rotation.set(0, 0, 0); _o.updateMatrix(); inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i++, _c.set(shade(col, (r() - 0.5) * 0.1))); }
    }
    inst.frustumCulled = false;
    this.clouds = inst;
    this.bd(inst, g, m, { dispose: () => inst.dispose() });
  }
  private buildWeather(kind: string, w: World) {
    this.wxKind = kind;
    if (kind === "none") return;
    const n = this.phone ? 140 : 300;
    const g = kind === "rain" ? new THREE.BoxGeometry(0.03, 0.7, 0.03) : kind === "leaves" || kind === "petals" || kind === "confetti" ? new THREE.BoxGeometry(0.16, 0.03, 0.12) : new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const additive = kind === "fireflies" || kind === "sparks" || kind === "glitch";
    const m = additive ? new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }) : new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: kind === "rain", opacity: kind === "rain" ? 0.55 : 1 });
    const inst = new THREE.InstancedMesh(g, m, n);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false;
    const cols: Record<string, string[]> = {
      snow: ["#ffffff", "#E8F2FF"], rain: ["#BFD8FF"], leaves: ["#5FBF4A", "#E8702A", "#FFB627"], petals: ["#FFB1D0", "#FF8AB8", "#ffffff"], ash: ["#3A3236", "#6E6468", "#FF7A2A"],
      fireflies: ["#FFF27A", "#B6FF5C"], bubbles: ["#E8FFFF"], sparks: ["#FFB627", "#FF6A2B"], dust: [shade(w.pal.top, -0.1), w.pal.top], glitch: ["#FF3DF0", "#3DF5FF"], confetti: ["#FF5C8A", "#FFE45C", "#7FE3FF", "#9BFF7A"],
    };
    const list = cols[kind] ?? ["#ffffff"];
    this.wx = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { this.wx[i * 4] = (Math.random() - 0.5) * 44; this.wx[i * 4 + 1] = Math.random() * 24; this.wx[i * 4 + 2] = (Math.random() - 0.5) * 44; this.wx[i * 4 + 3] = Math.random() * 100; inst.setColorAt(i, _c.set(list[i % list.length])); }
    this.weather = inst;
    this.add(inst, g, m, { dispose: () => inst.dispose() });
  }

  // ------------------------------------------------------------------ per frame
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
  }
  get size() { return { w: this.w, h: this.h }; }
  /** a moving piece's mesh follows the piece */
  syncPiece(p: Piece, near: boolean, angle = 0) {
    const m = this.dyn.get(p.id);
    if (!m) return;
    const show = near && (p.on || p.kind === "fall" || p.kind === "laser") && !(p.kind === "fall" && p.t > 3) && !(p.kind === "bridge" && !p.on && p.t <= 0);
    m.visible = show;
    if (!show) return;
    m.position.set((p.x0 + p.x1) / 2 + p.dx, (p.y0 + p.y1) / 2 + p.dy, (p.z0 + p.z1) / 2 + p.dz);
    if (p.spin) {
      if (p.spin.swing) { m.position.set(p.spin.cx + Math.sin(angle) * p.spin.len, p.spin.cy - Math.cos(angle) * p.spin.len, p.spin.cz); m.rotation.set(0, 0, angle); }
      else m.rotation.set(0, angle, 0);
    }
    if (p.kind === "laser") { m.visible = p.on; }
    if (p.kind === "fall" && p.t > 0 && p.t < 0.8) m.position.x += Math.sin(this.t * 60) * 0.05;
    if (p.kind === "bridge") m.scale.set(1, 1, p.on ? 1 : Math.min(1, Math.max(0.01, p.t)));
  }
  /** checkpoint flags: reached ones turn green and wave */
  flagsReached(section: number) {
    for (const f of this.flags) {
      const m = f.mesh.material as THREE.MeshLambertMaterial;
      if (f.section < section) { m.color.set("#3EE08F"); m.emissive.set("#0e3a22"); }
      f.mesh.rotation.y = Math.sin(this.t * 3 + f.z) * 0.25;
    }
  }
  drawPickups(list: { kind: PickupKind; x: number; y: number; z: number; t: number; alive: boolean }[], camZ: number) {
    const counts: Record<string, number> = { coin: 0, gem: 0, heart: 0, oil: 0, power: 0 };
    for (const p of list) {
      if (!p.alive || Math.abs(p.z - camZ) > 110) continue;
      const m = this.pickups.get(p.kind)!, i = counts[p.kind];
      if (i >= m.instanceMatrix.count) continue;
      _o.position.set(p.x, p.y + Math.sin(this.t * 3 + p.t) * 0.12 + 0.55, p.z);
      _o.rotation.set(p.kind === "power" ? 0.4 : 0, this.t * (p.kind === "coin" ? 3.2 : 1.6) + p.t, 0);
      _o.scale.setScalar(p.kind === "power" ? 1 + Math.sin(this.t * 6 + p.t) * 0.06 : 1);
      _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); counts[p.kind] = i + 1;
    }
    for (const k of PICKUPS) { const m = this.pickups.get(k)!; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; }
  }
  private shadowN = 0;
  beginShadows() { this.shadowN = 0; }
  shadow(x: number, y: number, z: number, r: number) { if (this.shadowN >= 40) return; _o.position.set(x, y + 0.03, z); _o.rotation.set(0, 0, 0); _o.scale.set(r * 2, 1, r * 2); _o.updateMatrix(); this.shadows.setMatrixAt(this.shadowN++, _o.matrix); }
  endShadows() { this.shadows.count = this.shadowN; this.shadows.instanceMatrix.needsUpdate = true; }

  render(dt: number, grav: number, solid: { solidAt(x: number, y: number, z: number): boolean } | null) {
    this.t += dt;
    const cam = this.camera;
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position);
    this.backdrop.position.set(cam.position.x, 0, cam.position.z);
    if (this.liquidMat) this.liquidMat.uniforms.t.value = this.t;
    if (this.clouds) this.clouds.rotation.y = this.t * 0.004;
    for (const t of this.beltTex) t.offset.y = (t.offset.y - dt * 1.2) % 1;
    if (this.boostTex) this.boostTex.offset.y = (this.boostTex.offset.y + dt * 2) % 1;
    if (this.killMat) { const k = 0.8 + Math.sin(this.t * 5) * 0.2; this.killMat.color.copy(this.killCol.setRGB(k, k, k)); }
    cam.getWorldDirection(this.headL.position).multiplyScalar(-4).add(cam.position);
    cam.getWorldDirection(this.headL.target.position).multiplyScalar(4).add(cam.position);
    if (this.shadowsOn) { this.sunL.target.position.set(cam.position.x, cam.position.y - 6, cam.position.z + 8); this.sunL.position.copy(this.sunL.target.position).addScaledVector(this.look?.sunDir ?? this.sunL.position, 60); }
    if (this.weather) {
      const k = this.wxKind, n = this.wx.length / 4;
      const fall = k === "rain" ? 16 : k === "snow" ? 1.6 : k === "leaves" || k === "petals" || k === "confetti" ? 1.2 : k === "ash" ? 0.8 : k === "bubbles" || k === "fireflies" || k === "sparks" ? -0.8 : 0.3;
      for (let i = 0; i < n; i++) {
        const ph = this.wx[i * 4 + 3];
        this.wx[i * 4 + 1] -= fall * dt;
        this.wx[i * 4] += Math.sin(this.t * 0.8 + ph) * dt * (k === "rain" ? 0 : 0.6);
        if (this.wx[i * 4 + 1] < -2) this.wx[i * 4 + 1] += 26; else if (this.wx[i * 4 + 1] > 24) this.wx[i * 4 + 1] -= 26;
        const wrap = (v: number) => ((((v + 22) % 44) + 44) % 44) - 22;
        _o.position.set(cam.position.x + wrap(this.wx[i * 4] - cam.position.x), this.wx[i * 4 + 1] + cam.position.y - 9, cam.position.z + wrap(this.wx[i * 4 + 2] - cam.position.z));
        _o.rotation.set(k === "leaves" || k === "petals" || k === "confetti" ? this.t * 2 + ph : 0, this.t + ph, k === "rain" ? 0.1 : 0);
        _o.scale.setScalar(k === "fireflies" ? 0.6 + Math.sin(this.t * 4 + ph) * 0.4 : k === "glitch" ? (Math.sin(this.t * 17 + ph * 3) > 0.6 ? 1.6 : 0.2) : 1);
        _o.updateMatrix(); this.weather.setMatrixAt(i, _o.matrix);
      }
      this.weather.instanceMatrix.needsUpdate = true;
    }
    this.debris.update(dt, solid, grav); this.debris.draw();
    this.sparks.update(dt); this.sparks.draw();
    this.tracers.update(dt); this.tracers.draw();
    this.renderer.render(this.scene, cam);
  }
  dispose() {
    this.clearLevel();
    this.gov.dispose();
    this.debris.dispose(); this.sparks.dispose(); this.tracers.dispose();
    for (const m of this.pickups.values()) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    this.shadows.geometry.dispose(); (this.shadows.material as THREE.Material).dispose(); this.shadows.dispose();
    this.skyMat.dispose(); this.sky.geometry.dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
function pickC(r: () => number, w: World) { const l = [w.pal.platA, w.pal.platB, w.pal.accent, w.pal.accent2, w.pal.wall]; return l[Math.floor(r() * l.length)]; }
