// Blockstorm's 3D view (three.js on the shared mobile kit: device quality, pixel ratio, a FrameGovernor). It draws:
// - the sky: a gradient dome with the sun or moon and stars at night, drifting voxel clouds;
// - the backdrop, the part you see most: a ring of far blocky shapes per world (hills, mesas, towers with lit windows,
//   snow peaks, giant mushrooms, volcanoes, candy hills, coral, crystal spires, temples, ships at sea, factories,
//   pagodas, craters, glitch shards), the sea or lava or goo around the island (or the rocky underside of a floating
//   island), and weather (snow, rain, falling leaves and petals, ash, fireflies, bubbles, sparks, glitches);
// - the island itself, chunk by chunk (only what changed is rebuilt), lit by the time of day;
// - characters, effects, pickups and blob shadows.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor, shadowsFor, isPhone, type Quality } from "@/lib/perf";
import { paintAtlas } from "./blocks";
import { meshChunk } from "./mesher";
import { Debris, Fallers, Sparks, Tracers, tiledMaterial } from "./fx";
import type { Arena, PickupKind } from "./gen";
import type { StagePlan } from "./stages";
import { WORLDS, type TimeOfDay, type World } from "./worlds";
import { hash, makeRng, mix, rgb, shade } from "./util";

export interface Look { sky: [string, string, string]; fog: string; sun: string; light: string; ground: string; lightI: number; hemiI: number; exposure: number; night: boolean; sunDir: THREE.Vector3; fogNear: number; fogFar: number }

export function lookFor(w: World, time: TimeOfDay, mods: string[] = []): Look {
  const s = w.sky;
  let sky: [string, string, string] = [s.top, s.mid, s.bot], fog = s.fog, sun = s.sun, light = s.light, ground = s.ground, lightI = 2.3, hemiI = 1.45;
  const sunDir = new THREE.Vector3(0.45, 0.8, 0.35);
  if (time === "golden") { sky = [mix(s.top, "#5B6FD8", 0.3), mix(s.mid, "#FFB27A", 0.45), mix(s.bot, "#FFD08A", 0.6)]; fog = mix(fog, "#FFC890", 0.45); light = mix(light, "#FFC07A", 0.55); sunDir.set(0.7, 0.35, 0.3); lightI = 2.2; }
  if (time === "dusk") { sky = [mix(s.top, "#1E2058", 0.55), mix(s.mid, "#B0507A", 0.5), mix(s.bot, "#FF8A5A", 0.55)]; fog = mix(fog, "#7A4E7A", 0.5); light = mix(light, "#FF9A7A", 0.5); ground = shade(ground, -0.3); sunDir.set(-0.7, 0.22, 0.4); lightI = 1.6; hemiI = 1.15; }
  if (time === "night") {
    const dark = w.sky.top.match(/^#0|^#1/) ? 0 : 0.75; // worlds already made for the night keep their colours
    sky = [mix(s.top, "#050816", dark), mix(s.mid, "#101A44", dark), mix(s.bot, "#2A2E66", dark)]; fog = mix(fog, "#141A3A", dark * 0.85);
    light = mix(light, "#9DB4FF", 0.6); ground = shade(ground, -0.5); sunDir.set(-0.35, 0.7, -0.4); lightI = 1.05; hemiI = 0.95; sun = "#E8EEFF";
  }
  const fogged = mods.includes("fog");
  return { sky, fog, sun, light, ground, lightI, hemiI, exposure: s.exposure, night: time === "night", sunDir: sunDir.normalize(), fogNear: fogged ? 10 : 34, fogFar: fogged ? 55 : 170 };
}

// ------------------------------------------------------------------ pickup sprites (pixel art, extruded into voxels)
const PICKUP_ART: Record<PickupKind, { rows: string[]; pal: Record<string, string>; depth: number; px: number }> = {
  coin: { rows: ["..YYYY..", ".YWWYYO.", "YWYYYYOY", "YWYOOYOY", "YYYOOYOY", "YYYYYYOY", ".YOOOOY.", "..YYYY.."], pal: { Y: "#FFD23F", W: "#FFF6C8", O: "#E8A317" }, depth: 1, px: 0.06 },
  gem: { rows: ["..CCC..", ".CWCCC.", "CWCCCCD", "CCCCCDD", ".CCCDD.", "..CDD..", "...D..."], pal: { C: "#7CF5FF", W: "#FFFFFF", D: "#2E9BFF" }, depth: 2, px: 0.07 },
  heart: { rows: [".RR.RR.", "RWRRRRR", "RWRRRRR", "RRRRRRD", ".RRRRD.", "..RRD..", "...D..."], pal: { R: "#FF4F7A", W: "#FFFFFF", D: "#B0183F" }, depth: 2, px: 0.08 },
  oil: { rows: ["..KK..", ".RRRR.", "RRRRRR", "RYYYYR", "RYKKYR", "RYYYYR", "RRRRRR", "RDDDDR"], pal: { R: "#E23B3B", Y: "#FFC83D", K: "#22222A", D: "#8E1B1B" }, depth: 3, px: 0.075 },
  health: { rows: ["WWWWWWW", "WWWGWWW", "WWWGWWW", "WGGGGGW", "WWWGWWW", "WWWGWWW", "WWWWWWW"], pal: { W: "#F5F7FF", G: "#3EE08F" }, depth: 7, px: 0.065 },
  power: { rows: ["PPPPPPP", "PPYYYPP", "PYPPPYP", "PPPPYPP", "PPPYPPP", "PPPPPPP", "PPPYPPP"], pal: { P: "#9B5DE5", Y: "#FFE45C" }, depth: 7, px: 0.07 },
};
function spriteGeometry(rows: string[], pal: Record<string, string>, depth: number, px: number) {
  const pos: number[] = [], col: number[] = [], nrm: number[] = [];
  const H = rows.length, W = rows[0].length;
  const filled = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && rows[y][x] !== ".";
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], cl: [number, number, number]) => {
    for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); nrm.push(n[0], n[1], n[2]); col.push(cl[0], cl[1], cl[2]); }
  };
  const z0 = -depth / 2, z1 = depth / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x];
    if (ch === ".") continue;
    const [r, g, b] = rgb(pal[ch]); const c: [number, number, number] = [r / 255, g / 255, b / 255];
    const X0 = x - W / 2, X1 = X0 + 1, Y1 = H / 2 - y, Y0 = Y1 - 1;
    quad([X0, Y0, z1], [X1, Y0, z1], [X1, Y1, z1], [X0, Y1, z1], [0, 0, 1], c);
    quad([X1, Y0, z0], [X0, Y0, z0], [X0, Y1, z0], [X1, Y1, z0], [0, 0, -1], c);
    const dk: [number, number, number] = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
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

const _o = new THREE.Object3D();
const _c = new THREE.Color();
const PICKUP_KINDS: PickupKind[] = ["coin", "gem", "heart", "oil", "health", "power"];

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.08, 600);
  readonly q: Quality;
  readonly phone = isPhone();
  readonly world = new THREE.Group();
  private gov: FrameGovernor;
  private w = 1; private h = 1;
  private hemi: THREE.HemisphereLight; private sunL: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  /** a soft light from the camera, so faces turned toward you never go murky */
  private headL: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private stars: THREE.Points;
  private chunks = new Map<number, { lit: THREE.Mesh | null; glow: THREE.Mesh | null }>();
  private atlas: THREE.CanvasTexture | null = null;
  atlasMat: THREE.MeshLambertMaterial | null = null;
  private glowMat: THREE.MeshBasicMaterial | null = null;
  fallMat: THREE.MeshLambertMaterial | null = null;
  /** each block's average colour (for debris) */
  blockAvg = new Float32Array(78);
  private stageObjs: THREE.Object3D[] = [];
  private stageKeep: { dispose: () => void }[] = [];
  private weather: THREE.InstancedMesh | null = null; private wx: Float32Array = new Float32Array(0); private wxKind = "none";
  private clouds: THREE.InstancedMesh | null = null;
  private liquid: THREE.Mesh | null = null; private liquidMat: THREE.ShaderMaterial | null = null;
  readonly debris: Debris; readonly sparks: Sparks; readonly tracers: Tracers; fallers: Fallers | null = null;
  readonly pickups = new Map<PickupKind, THREE.InstancedMesh>();
  readonly shadows: THREE.InstancedMesh;
  private beam: THREE.Mesh | null = null;
  look: Look | null = null;
  plan: StagePlan | null = null;
  shadowsOn: boolean;
  t = 0;

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
    sc.add(this.world);
    sc.fog = new THREE.Fog("#ffffff", 30, 170);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1); sc.add(this.hemi);
    this.sunL = new THREE.DirectionalLight("#ffffff", 2.4); sc.add(this.sunL); sc.add(this.sunL.target);
    this.fill = new THREE.DirectionalLight("#ffffff", 0.6); this.fill.position.set(-5, 4, -6); sc.add(this.fill);
    this.headL = new THREE.DirectionalLight("#ffffff", 0.42); sc.add(this.headL); sc.add(this.headL.target);
    if (this.shadowsOn) {
      this.sunL.castShadow = true;
      const s = this.sunL.shadow;
      s.mapSize.set(this.phone ? 1024 : 2048, this.phone ? 1024 : 2048);
      s.camera.left = -34; s.camera.right = 34; s.camera.top = 34; s.camera.bottom = -34; s.camera.near = 1; s.camera.far = 140;
      s.bias = -0.0008; s.normalBias = 0.04;
    }
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.3, -1) }, moon: { value: 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunDir; uniform float moon; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h));
        float s = max(dot(vP, sunDir), 0.0);
        // a blocky sun / moon: a square disc (pixel style) with a soft glow
        vec3 sd = normalize(sunDir); vec3 ax = normalize(cross(sd, vec3(0.0,1.0,0.0))); vec3 ay = cross(ax, sd);
        vec2 q = vec2(dot(vP, ax), dot(vP, ay)) / 0.06;
        float disc = step(abs(q.x), 1.0) * step(abs(q.y), 1.0) * step(0.0, s);
        float crater = moon * step(0.35, fract(q.x * 1.5 + 0.2)) * step(0.5, fract(q.y * 1.5 + 0.6)) * 0.25;
        c += sun * (disc * (1.6 - crater) + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; sc.add(this.sky);
    // stars
    {
      const n = 700, p = new Float32Array(n * 3), r = makeRng(99);
      for (let i = 0; i < n; i++) { const u = r() * 0.95 + 0.05, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * 420; p[i * 3 + 1] = u * 420; p[i * 3 + 2] = Math.sin(a) * s * 420; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
      this.stars.frustumCulled = false; sc.add(this.stars);
    }
    const cap = this.phone ? 1 : 1.7;
    this.debris = new Debris(Math.round(260 * cap)); sc.add(this.debris.mesh); this.debris.mesh.castShadow = false;
    this.sparks = new Sparks(Math.round(220 * cap)); sc.add(this.sparks.mesh);
    this.tracers = new Tracers(40); sc.add(this.tracers.mesh);
    for (const k of PICKUP_KINDS) {
      const a = PICKUP_ART[k];
      const m = new THREE.InstancedMesh(spriteGeometry(a.rows, a.pal, a.depth, a.px), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(k === "coin" ? "#3a2a00" : k === "gem" ? "#0a3a44" : "#1a1a1a") }), k === "coin" ? 160 : 24);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.castShadow = this.shadowsOn;
      this.pickups.set(k, m); sc.add(m);
    }
    {
      const g = new THREE.CircleGeometry(0.5, 14); g.rotateX(-Math.PI / 2);
      this.shadows = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }), 80);
      this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1;
      sc.add(this.shadows);
    }
  }

  // ------------------------------------------------------------------ a stage's world
  setStage(plan: StagePlan, arena: Arena) {
    this.clearStage();
    this.plan = plan;
    const w = WORLDS.find((x) => x.id === plan.world)!;
    const w2 = plan.blend ? WORLDS.find((x) => x.id === plan.blend)! : null;
    const L = lookFor(w, plan.time, plan.mods);
    this.look = L;
    // block textures
    const { canvas, avg } = paintAtlas(w, L.night);
    this.blockAvg = avg;
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.magFilter = THREE.NearestFilter; this.atlas.minFilter = THREE.NearestFilter; this.atlas.generateMipmaps = false; this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlasMat = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.glowMat = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true });
    this.fallMat = tiledMaterial(this.atlas);
    this.fallers = new Fallers(this.phone ? 220 : 420, this.fallMat);
    this.scene.add(this.fallers.mesh);
    this.stageKeep.push(this.atlas, this.atlasMat, this.glowMat, this.fallMat, this.fallers);
    // light and sky
    const sc = this.scene;
    (sc.fog as THREE.Fog).color.set(L.fog); (sc.fog as THREE.Fog).near = L.fogNear; (sc.fog as THREE.Fog).far = L.fogFar;
    this.skyMat.uniforms.top.value.set(L.sky[0]); this.skyMat.uniforms.mid.value.set(L.sky[1]); this.skyMat.uniforms.bot.value.set(L.sky[2]);
    this.skyMat.uniforms.sun.value.set(L.sun).multiplyScalar(L.night ? 0.8 : 1);
    this.skyMat.uniforms.sunDir.value.copy(L.sunDir);
    this.skyMat.uniforms.moon.value = L.night ? 1 : 0;
    this.stars.visible = L.night || w.sky.top.startsWith("#0");
    this.hemi.color.set(mix(L.sky[1], "#ffffff", 0.35)); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sunL.color.set(L.light); this.sunL.intensity = L.lightI;
    this.fill.color.set(L.sky[1]);
    this.renderer.toneMappingExposure = L.exposure;
    const S = arena.size;
    this.sunL.position.set(S / 2 + L.sunDir.x * 60, L.sunDir.y * 60, S / 2 + L.sunDir.z * 60);
    this.sunL.target.position.set(S / 2, 0, S / 2);
    // the island
    for (let i = 0; i < arena.vox.cx * arena.vox.cz; i++) this.rebuild(arena, i);
    arena.vox.dirty.clear();
    // the backdrop
    this.buildSkyline(w, w2, L, S, plan.seed);
    this.buildSurroundings(w, L, arena);
    this.buildClouds(w, L, S, plan.seed);
    this.buildWeather(plan.weather, w);
    if (arena.beacon) {
      const g = new THREE.BoxGeometry(0.6, 60, 0.6); g.translate(0, 30, 0);
      const m = new THREE.MeshBasicMaterial({ color: "#7CF5FF", transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      this.beam = new THREE.Mesh(g, m); this.beam.position.set(arena.beacon.x, arena.beacon.y + 4, arena.beacon.z);
      this.add(this.beam, g, m);
    }
  }
  private add(o: THREE.Object3D, ...keep: { dispose: () => void }[]) { this.scene.add(o); this.stageObjs.push(o); this.stageKeep.push(...keep); }
  clearStage() {
    for (const c of this.chunks.values()) { for (const m of [c.lit, c.glow]) if (m) { m.removeFromParent(); m.geometry.dispose(); } }
    this.chunks.clear();
    for (const o of this.stageObjs) o.removeFromParent();
    this.stageObjs = [];
    if (this.fallers) { this.fallers.mesh.removeFromParent(); }
    for (const k of this.stageKeep) k.dispose();
    this.stageKeep = [];
    this.weather = null; this.clouds = null; this.liquid = null; this.liquidMat = null; this.beam = null; this.fallers = null;
    this.debris.clear(); this.sparks.clear(); this.tracers.clear();
  }

  /** rebuild one chunk's meshes */
  rebuild(arena: Arena, ci: number) {
    const old = this.chunks.get(ci);
    if (old) for (const m of [old.lit, old.glow]) if (m) { m.removeFromParent(); m.geometry.dispose(); }
    const g = meshChunk(arena.vox, ci, !!this.look?.night);
    const lit = g.lit ? new THREE.Mesh(g.lit, this.atlasMat!) : null;
    const glow = g.glow ? new THREE.Mesh(g.glow, this.glowMat!) : null;
    if (lit) { lit.castShadow = this.shadowsOn; lit.receiveShadow = this.shadowsOn; this.world.add(lit); }
    if (glow) this.world.add(glow);
    this.chunks.set(ci, { lit, glow });
  }
  /** rebuild changed chunks (a few per frame) */
  sync(arena: Arena, max = 4) {
    let k = 0;
    for (const ci of arena.vox.dirty) { this.rebuild(arena, ci); arena.vox.dirty.delete(ci); if (++k >= max) break; }
  }

  private buildSkyline(w: World, w2: World | null, L: Look, S: number, seed: number) {
    const r = makeRng(seed ^ 0x9e3779b9);
    const shapes: { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: string; glow?: boolean }[] = [];
    const ring = (wd: World, from: number, to: number) => {
      const [c0, c1] = wd.skyCol;
      const cx = S / 2, cz = S / 2;
      const count = this.phone ? 70 : 110;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + r() * 0.05;
        if (a < from || a > to) continue;
        const d = 90 + r() * 70, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const near = 1 - (d - 90) / 70;
        const col = mix(mix(c0, c1, r()), L.fog, 0.25 + (1 - near) * 0.35);
        const big = 0.7 + r() * 0.8;
        switch (wd.skyline) {
          case "hills": case "forest": case "temples": case "pagodas": case "wastes": {
            const h = (wd.skyline === "forest" ? 14 : 10) * big;
            for (let k = 0; k < 4; k++) shapes.push({ x: x + (r() - 0.5) * 10, y: 0, z: z + (r() - 0.5) * 10, sx: (16 - k * 3) * big, sy: h * (0.4 + k * 0.25), sz: (16 - k * 3) * big, c: shade(col, k * 0.04) });
            if (wd.skyline === "temples" && r() < 0.3) for (let k = 0; k < 4; k++) shapes.push({ x, y: k * 4, z, sx: 14 - k * 3, sy: 4, sz: 14 - k * 3, c: shade(col, -0.05 + k * 0.03) });
            if (wd.skyline === "pagodas" && r() < 0.3) for (let k = 0; k < 4; k++) { shapes.push({ x, y: 6 + k * 6, z, sx: 10 - k * 1.5, sy: 1.2, sz: 10 - k * 1.5, c: shade("#8E2E3A", -0.2 + near * 0.1) }); shapes.push({ x, y: 6 + k * 6 - 4, z, sx: 6 - k, sy: 4, sz: 6 - k, c: col }); }
            break;
          }
          case "mesas": { const h = 14 * big; shapes.push({ x, y: 0, z, sx: 18 * big, sy: h, sz: 14 * big, c: col }); shapes.push({ x, y: h, z, sx: 20 * big, sy: 2, sz: 16 * big, c: shade(col, 0.08) }); break; }
          case "towers": case "circuits": case "factory": {
            const h = (wd.skyline === "factory" ? 18 : 30) * big + r() * 30;
            shapes.push({ x, y: 0, z, sx: 8 + r() * 6, sy: h, sz: 8 + r() * 6, c: col });
            if (r() < 0.7) shapes.push({ x: x + (r() - 0.5) * 2, y: h, z, sx: 2, sy: 6, sz: 2, c: shade(col, 0.1) });
            // lit windows (glowing strips)
            if (L.night || wd.skyline !== "factory") for (let k = 0; k < 4; k++) shapes.push({ x: x + (r() - 0.5) * 6, y: r() * h, z: z + (r() - 0.5) * 6, sx: 2.5, sy: 0.8, sz: 2.5, c: pickGlow(wd), glow: true });
            if (wd.skyline === "factory") shapes.push({ x: x + 3, y: h, z, sx: 2, sy: 12, sz: 2, c: shade(col, -0.1) });
            break;
          }
          case "peaks": case "volcano": case "craters": {
            const h = (wd.skyline === "craters" ? 8 : 34) * big;
            for (let k = 0; k < 6; k++) shapes.push({ x, y: k * h / 6, z, sx: (20 - k * 3) * big, sy: h / 6, sz: (20 - k * 3) * big, c: wd.skyline === "peaks" && k > 3 ? mix("#ffffff", L.fog, 0.2) : shade(col, k * 0.03) });
            if (wd.skyline === "volcano" && r() < 0.5) shapes.push({ x, y: h, z, sx: 4, sy: 1, sz: 4, c: "#FF7A2A", glow: true });
            break;
          }
          case "shrooms": { const h = 20 * big; shapes.push({ x, y: 0, z, sx: 3, sy: h, sz: 3, c: mix("#E8DCC4", L.fog, 0.4) }); shapes.push({ x, y: h, z, sx: 14 * big, sy: 4, sz: 14 * big, c: mix(r() < 0.5 ? "#C8374F" : "#9B5DE5", L.fog, 0.35) }); break; }
          case "candy": { const h = 16 * big; shapes.push({ x, y: 0, z, sx: 1.5, sy: h, sz: 1.5, c: "#ffffff" }); shapes.push({ x, y: h, z, sx: 9 * big, sy: 9 * big, sz: 2, c: mix(r() < 0.5 ? "#FF5C8A" : "#7FE3FF", L.fog, 0.3) }); shapes.push({ x: x + 12, y: 0, z, sx: 16, sy: 8 * big, sz: 16, c: col }); break; }
          case "coral": { const h = 12 * big; for (let k = 0; k < 3; k++) shapes.push({ x: x + (r() - 0.5) * 8, y: 0, z: z + (r() - 0.5) * 8, sx: 3, sy: h * (0.5 + r()), sz: 3, c: mix(["#FF6F91", "#FFB347", "#7CF5FF"][k], L.fog, 0.45) }); break; }
          case "spires": case "crystals": case "glitch": { const h = 26 * big; shapes.push({ x, y: 0, z, sx: 4, sy: h, sz: 4, c: wd.skyline === "glitch" ? (r() < 0.5 ? "#FF3DF0" : "#3DF5FF") : mix("#B98AFF", L.fog, 0.3), glow: wd.skyline !== "spires" && r() < 0.5 }); shapes.push({ x: x + 4, y: 0, z, sx: 3, sy: h * 0.6, sz: 3, c: col }); break; }
          case "islands": { const y0 = 10 + r() * 30; for (let k = 0; k < 4; k++) shapes.push({ x, y: y0 - k * 3, z, sx: (14 - k * 3) * big, sy: 3, sz: (14 - k * 3) * big, c: k === 0 ? mix("#9FE08A", L.fog, 0.3) : shade(col, -k * 0.05) }); break; }
          case "sea": { if (r() < 0.25) { shapes.push({ x, y: 1, z, sx: 14, sy: 3, sz: 4, c: "#7A5A3A" }); shapes.push({ x, y: 4, z, sx: 1, sy: 10, sz: 1, c: "#5A4030" }); shapes.push({ x, y: 7, z, sx: 6, sy: 6, sz: 0.5, c: mix("#ffffff", L.fog, 0.2) }); } else shapes.push({ x, y: 0, z, sx: 18 * big, sy: 4 * big, sz: 18 * big, c: col }); break; }
        }
      }
    };
    if (w2) { ring(w, 0, Math.PI); ring(w2, Math.PI, Math.PI * 2); } else ring(w, 0, Math.PI * 2);
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const lit = shapes.filter((s) => !s.glow), glow = shapes.filter((s) => s.glow);
    const mk = (list: typeof shapes, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, list.length));
      list.forEach((s, i) => { _o.position.set(s.x, s.y - 2, s.z); _o.rotation.set(0, hash(i, 7) * Math.PI, 0); _o.scale.set(s.sx, s.sy, s.sz); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.set(s.c)); });
      m.count = list.length; m.frustumCulled = false;
      return m;
    };
    const lm = new THREE.MeshLambertMaterial({ color: "#ffffff", fog: false }), gm = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
    const a = mk(lit, lm), b = mk(glow, gm);
    this.add(a, lm); this.add(b, gm);
    this.stageKeep.push(g, { dispose: () => { a.dispose(); b.dispose(); } });
  }

  private buildSurroundings(w: World, L: Look, arena: Arena) {
    const S = arena.size;
    if (w.liquid !== "void") {
      // the sea (water, lava or goo) all the way to the horizon, gently moving
      const mat = new THREE.ShaderMaterial({
        transparent: w.liquid === "water", fog: true,
        uniforms: { ...THREE.UniformsLib.fog, col: { value: new THREE.Color(w.liquidColor) }, deep: { value: new THREE.Color(shade(w.liquidColor, w.liquid === "lava" ? -0.25 : -0.45)) }, t: { value: 0 }, glow: { value: w.liquid === "lava" ? 1 : w.liquid === "goo" ? 0.35 : 0 }, sky: { value: new THREE.Color(L.sky[1]) } },
        vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
          void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <fog_pars_vertex>/, "\n#include <fog_pars_vertex>\n").replace(/#include <fog_vertex>/, "\n#include <fog_vertex>\n"),
        fragmentShader: `uniform vec3 col; uniform vec3 deep; uniform float t; uniform float glow; uniform vec3 sky; varying vec3 vW;
          #include <fog_pars_fragment>
          void main(){
            // pixel ripples: quantised waves
            vec2 p = floor(vW.xz * 2.0) / 2.0;
            float w = sin(p.x * 0.7 + t * 1.3) * 0.5 + sin(p.y * 0.9 - t * 1.1) * 0.5 + sin((p.x + p.y) * 0.35 + t * 0.6);
            float k = smoothstep(-1.2, 1.6, w);
            vec3 c = mix(deep, col, k);
            float spark = step(1.75, w) * (1.0 - glow);
            c += spark * 0.35 + glow * (0.35 + 0.25 * sin(t * 2.0 + p.x * 0.3)) * col;
            c = mix(c, sky, 0.12 * (1.0 - glow));
            gl_FragColor = vec4(c, ${w.liquid === "water" ? "0.86" : "1.0"});
            #include <fog_fragment>
          }`,
      });
      const g = new THREE.PlaneGeometry(900, 900, 1, 1); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set(S / 2, arena.liquidY > 0 ? arena.liquidY : 1.6, S / 2);
      m.renderOrder = 2;
      this.liquid = m; this.liquidMat = mat;
      this.add(m, g, mat);
      // a sandy / rocky shelf around the island, under the surface
      const sg = new THREE.PlaneGeometry(900, 900); sg.rotateX(-Math.PI / 2);
      const sm = new THREE.MeshLambertMaterial({ color: shade(w.pal.soil, -0.3) });
      const sh = new THREE.Mesh(sg, sm); sh.position.set(S / 2, 0.2, S / 2);
      this.add(sh, sg, sm);
    } else {
      // a floating island: its rocky underside steps down into the void
      const g = new THREE.BoxGeometry(1, 1, 1);
      const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
      const layers = 9, inst = new THREE.InstancedMesh(g, m, layers * 4 + 40);
      let i = 0;
      const r = makeRng(arena.size * 31);
      for (let k = 0; k < layers; k++) {
        const s = S * (1 - k * 0.1) - r() * 2, h = 2.2;
        _o.position.set(S / 2 + (r() - 0.5) * 2, -k * h - h / 2, S / 2 + (r() - 0.5) * 2); _o.scale.set(s, h, s); _o.rotation.set(0, 0, 0); _o.updateMatrix();
        inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i++, _c.set(shade(k < 1 ? w.pal.soil : w.pal.stone, -0.15 - k * 0.05)));
      }
      // drifting rocks below
      for (let k = 0; k < 30; k++) {
        const a = r() * Math.PI * 2, d = S * 0.6 + r() * 50, s = 1 + r() * 4;
        _o.position.set(S / 2 + Math.cos(a) * d, -6 - r() * 30, S / 2 + Math.sin(a) * d); _o.scale.set(s, s * 0.8, s); _o.rotation.set(r(), r(), 0); _o.updateMatrix();
        inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i++, _c.set(shade(w.pal.stone, -0.2 - r() * 0.2)));
      }
      inst.count = i; inst.frustumCulled = false;
      this.add(inst, g, m, { dispose: () => inst.dispose() });
    }
  }

  private buildClouds(w: World, L: Look, S: number, seed: number) {
    if (w.id === "moon" || w.id === "grid" || w.id === "crystal") return;
    const r = makeRng(seed + 5);
    const n = this.phone ? 14 : 24, per = 5;
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: new THREE.Color(L.night ? "#1a2040" : "#3a3a44"), fog: false });
    const inst = new THREE.InstancedMesh(g, m, n * per);
    let i = 0;
    const col = L.night ? "#5A6488" : mix("#ffffff", L.sky[2], 0.25);
    for (let c = 0; c < n; c++) {
      const a = r() * Math.PI * 2, d = 50 + r() * 140, y = 34 + r() * 30;
      const x = S / 2 + Math.cos(a) * d, z = S / 2 + Math.sin(a) * d;
      for (let k = 0; k < per; k++) {
        _o.position.set(x + (r() - 0.5) * 14, y + (r() - 0.5) * 2, z + (r() - 0.5) * 8); _o.scale.set(6 + r() * 10, 2 + r() * 2.5, 5 + r() * 7); _o.rotation.set(0, 0, 0); _o.updateMatrix();
        inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i++, _c.set(shade(col, (r() - 0.5) * 0.1)));
      }
    }
    inst.frustumCulled = false;
    this.clouds = inst;
    this.add(inst, g, m, { dispose: () => inst.dispose() });
  }

  private buildWeather(kind: string, w: World) {
    this.wxKind = kind;
    if (kind === "none") return;
    const n = this.phone ? 140 : 320;
    const g = kind === "rain" ? new THREE.BoxGeometry(0.03, 0.7, 0.03) : kind === "leaves" || kind === "petals" ? new THREE.BoxGeometry(0.16, 0.03, 0.12) : new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const additive = kind === "fireflies" || kind === "sparks" || kind === "glitch";
    const m = additive ? new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }) : new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: kind === "rain" || kind === "bubbles", opacity: kind === "rain" ? 0.55 : 0.7 });
    const inst = new THREE.InstancedMesh(g, m, n);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false;
    const cols: Record<string, string[]> = {
      snow: ["#ffffff", "#E8F2FF"], rain: ["#BFD8FF"], leaves: [w.pal.leaves, w.pal.leaves2, "#E8702A"], petals: ["#FFB1D0", "#FF8AB8", "#ffffff"], ash: ["#3A3236", "#6E6468", "#FF7A2A"],
      fireflies: ["#FFF27A", "#B6FF5C"], bubbles: ["#E8FFFF"], sparks: ["#FFB627", "#FF6A2B"], dust: [shade(w.pal.top, -0.1), w.pal.top], glitch: ["#FF3DF0", "#3DF5FF"],
    };
    const list = cols[kind] ?? ["#ffffff"];
    this.wx = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      this.wx[i * 4] = (Math.random() - 0.5) * 40; this.wx[i * 4 + 1] = Math.random() * 22; this.wx[i * 4 + 2] = (Math.random() - 0.5) * 40; this.wx[i * 4 + 3] = Math.random() * 100;
      inst.setColorAt(i, _c.set(list[i % list.length]));
    }
    this.weather = inst;
    this.add(inst, g, m, { dispose: () => inst.dispose() });
  }

  // ------------------------------------------------------------------ per frame
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }
  get size() { return { w: this.w, h: this.h }; }

  /** pickups: every kind's list of positions and spin/bob phase */
  drawPickups(list: { kind: PickupKind; x: number; y: number; z: number; t: number; alive: boolean }[]) {
    const counts: Record<string, number> = { coin: 0, gem: 0, heart: 0, oil: 0, health: 0, power: 0 };
    for (const p of list) {
      if (!p.alive) continue;
      const m = this.pickups.get(p.kind)!;
      const i = counts[p.kind];
      if (i >= m.instanceMatrix.count) continue;
      _o.position.set(p.x, p.y + Math.sin(this.t * 3 + p.t) * 0.12 + 0.15, p.z);
      _o.rotation.set(p.kind === "health" || p.kind === "power" ? 0.4 : 0, this.t * (p.kind === "coin" ? 3.2 : 1.6) + p.t, 0);
      _o.scale.setScalar(p.kind === "power" ? 1 + Math.sin(this.t * 6 + p.t) * 0.06 : 1);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      counts[p.kind] = i + 1;
    }
    for (const k of PICKUP_KINDS) { const m = this.pickups.get(k)!; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; }
  }
  private shadowN = 0;
  beginShadows() { this.shadowN = 0; }
  shadow(x: number, y: number, z: number, r: number, a = 1) {
    if (this.shadowN >= 80) return;
    _o.position.set(x, y + 0.03, z); _o.rotation.set(0, 0, 0); _o.scale.set(r * 2 * a, 1, r * 2 * a); _o.updateMatrix();
    this.shadows.setMatrixAt(this.shadowN++, _o.matrix);
  }
  endShadows() { this.shadows.count = this.shadowN; this.shadows.instanceMatrix.needsUpdate = true; }

  render(dt: number, grav: number, V: import("./voxels").Voxels | null) {
    this.t += dt;
    const cam = this.camera;
    this.sky.position.copy(cam.position);
    cam.getWorldDirection(this.headL.position).multiplyScalar(-4).add(cam.position);
    cam.getWorldDirection(this.headL.target.position).multiplyScalar(4).add(cam.position);
    this.stars.position.copy(cam.position);
    if (this.liquidMat) this.liquidMat.uniforms.t.value = this.t;
    if (this.glowMat) { const k = 0.85 + Math.sin(this.t * 4) * 0.15; this.glowMat.color.setRGB(k, k, k); }
    if (this.clouds) this.clouds.rotation.y = this.t * 0.004;
    if (this.beam) (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(this.t * 3) * 0.05;
    // weather: a box of bits around the camera, wrapping as it moves
    if (this.weather) {
      const k = this.wxKind, n = this.wx.length / 4;
      const fall = k === "rain" ? 16 : k === "snow" ? 1.6 : k === "leaves" || k === "petals" ? 1.2 : k === "ash" ? 0.8 : k === "bubbles" || k === "fireflies" || k === "sparks" ? -0.8 : 0.3;
      for (let i = 0; i < n; i++) {
        const ph = this.wx[i * 4 + 3];
        this.wx[i * 4 + 1] -= fall * dt;
        this.wx[i * 4] += Math.sin(this.t * 0.8 + ph) * dt * (k === "rain" ? 0 : 0.6) + (k === "rain" ? -1.5 * dt : 0);
        if (this.wx[i * 4 + 1] < -2) this.wx[i * 4 + 1] += 24; else if (this.wx[i * 4 + 1] > 22) this.wx[i * 4 + 1] -= 24;
        const wrap = (v: number) => ((((v + 20) % 40) + 40) % 40) - 20;
        const x = cam.position.x + wrap(this.wx[i * 4] - cam.position.x), z = cam.position.z + wrap(this.wx[i * 4 + 2] - cam.position.z);
        _o.position.set(x, this.wx[i * 4 + 1] + cam.position.y - 8, z);
        _o.rotation.set(k === "leaves" || k === "petals" ? this.t * 2 + ph : 0, this.t + ph, k === "rain" ? 0.1 : 0);
        const flick = k === "fireflies" ? 0.6 + Math.sin(this.t * 4 + ph) * 0.4 : k === "glitch" ? (Math.sin(this.t * 17 + ph * 3) > 0.6 ? 1.6 : 0.2) : 1;
        _o.scale.setScalar(flick);
        _o.updateMatrix();
        this.weather.setMatrixAt(i, _o.matrix);
      }
      this.weather.instanceMatrix.needsUpdate = true;
    }
    this.debris.update(dt, V, grav); this.debris.draw();
    this.sparks.update(dt); this.sparks.draw();
    this.tracers.update(dt); this.tracers.draw();
    if (this.fallers && V) { this.fallers.update(dt, V, grav); this.fallers.draw(); }
    this.renderer.render(this.scene, cam);
  }

  dispose() {
    this.clearStage();
    this.gov.dispose();
    this.debris.dispose(); this.sparks.dispose(); this.tracers.dispose();
    for (const m of this.pickups.values()) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    this.shadows.geometry.dispose(); (this.shadows.material as THREE.Material).dispose(); this.shadows.dispose();
    this.skyMat.dispose(); this.sky.geometry.dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
function pickGlow(w: World) { return w.id === "neon" ? "#FF8FE6" : w.id === "grid" ? "#3DF5FF" : "#FFD97A"; }
