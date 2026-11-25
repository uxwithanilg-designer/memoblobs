// Cube Clash's 3D view (three.js on the shared mobile kit: device quality, pixel ratio, a FrameGovernor). It draws:
// - the sky: a gradient dome with a blocky sun or moon, stars at night, an aurora on aurora nights;
// - the backdrop, the part you see most: far floating islands with waterfalls, peaks, mesas, crystal spires, neon
//   towers, giant mushrooms, volcanoes, candy hills, temples or planets; drifting balloons and airships; and far below
//   the islands a sea of clouds, an ocean, a lava lake or the starry void; plus weather (petals, snow, leaves,
//   fireflies, ash, rain, sparks, bubbles, confetti);
// - the map, chunk by chunk (only what changed is rebuilt), lit by the time of day;
// - characters, effects, pickups and blob shadows.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor, shadowsFor, isPhone, type Quality } from "@/lib/perf";
import { paintAtlas } from "./blocks";
import { meshChunk } from "./mesher";
import { Debris, Fallers, Sparks, Tracers, tiledMaterial } from "./fx";
import type { GameMap, PickupKind } from "./gen";
import type { StagePlan } from "./stages";
import { THEMES, type Theme, type TimeOfDay } from "./worlds";
import { hash, makeRng, mix, rgb, shade } from "./util";

export interface Look { sky: [string, string, string]; fog: string; sun: string; light: string; ground: string; lightI: number; hemiI: number; exposure: number; night: boolean; sunDir: THREE.Vector3; fogNear: number; fogFar: number }

export function lookFor(w: Theme, time: TimeOfDay, mods: string[] = []): Look {
  const s = w.sky;
  let sky: [string, string, string] = [s.top, s.mid, s.bot], fog = s.fog, sun = s.sun, light = s.light, ground = s.ground, lightI = 2.3, hemiI = 1.45;
  const sunDir = new THREE.Vector3(0.45, 0.8, 0.35);
  if (time === "golden") { sky = [mix(s.top, "#5B6FD8", 0.3), mix(s.mid, "#FFB27A", 0.45), mix(s.bot, "#FFD08A", 0.6)]; fog = mix(fog, "#FFC890", 0.45); light = mix(light, "#FFC07A", 0.55); sunDir.set(0.7, 0.35, 0.3); lightI = 2.2; }
  if (time === "dusk") { sky = [mix(s.top, "#1E2058", 0.55), mix(s.mid, "#B0507A", 0.5), mix(s.bot, "#FF8A5A", 0.55)]; fog = mix(fog, "#7A4E7A", 0.5); light = mix(light, "#FF9A7A", 0.5); ground = shade(ground, -0.3); sunDir.set(-0.7, 0.22, 0.4); lightI = 1.6; hemiI = 1.15; }
  if (time === "night") {
    const dark = w.sky.top.match(/^#0|^#1/) ? 0 : 0.75; // themes already made for the night keep their colours
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
  cubes: { rows: ["..BBB..", "..BWB..", "..BBB..", "RRRGGG.", "RWRGWG.", "RRRGGG."], pal: { B: "#3D8BFF", R: "#FF4D5E", G: "#38D96B", W: "#FFFFFF" }, depth: 3, px: 0.08 },
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
const PICKUP_KINDS: PickupKind[] = ["coin", "gem", "heart", "oil", "health", "power", "cubes"];

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
  blockAvg = new Float32Array(87);
  private stageObjs: THREE.Object3D[] = [];
  private stageKeep: { dispose: () => void }[] = [];
  private weather: THREE.InstancedMesh | null = null; private wx: Float32Array = new Float32Array(0); private wxKind = "none";
  private clouds: THREE.InstancedMesh | null = null;
  private liquid: THREE.Mesh | null = null; private liquidMat: THREE.ShaderMaterial | null = null;
  readonly debris: Debris; readonly sparks: Sparks; readonly tracers: Tracers; fallers: Fallers | null = null;
  readonly pickups = new Map<PickupKind, THREE.InstancedMesh>();
  readonly shadows: THREE.InstancedMesh;
  /** team crystals: glowing double pyramids */
  readonly crystals: THREE.InstancedMesh;
  private far: THREE.Group | null = null;
  private aurora: THREE.Mesh | null = null; private auroraMat: THREE.ShaderMaterial | null = null;
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
      const g = new THREE.OctahedronGeometry(0.62, 0); g.scale(1, 1.55, 1);
      this.crystals = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#ffffff" }), 4);
      this.crystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.crystals.frustumCulled = false; this.crystals.count = 0;
      this.crystals.setColorAt(0, _c.set("#ffffff"));
      sc.add(this.crystals);
    }
    {
      const g = new THREE.CircleGeometry(0.5, 14); g.rotateX(-Math.PI / 2);
      this.shadows = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }), 80);
      this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1;
      sc.add(this.shadows);
    }
  }

  // ------------------------------------------------------------------ a stage's world
  setStage(plan: StagePlan, map: GameMap) {
    this.clearStage();
    this.plan = plan;
    const w = THEMES[plan.themeIndex];
    const w2 = plan.blend ? THEMES.find((x) => x.id === plan.blend)! : null;
    const L = lookFor(w, plan.time, plan.mods);
    this.look = L;
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
    const V = map.vox, cx = V.X / 2, cz = V.Z / 2;
    this.sunL.position.set(cx + L.sunDir.x * 60, map.center.y + L.sunDir.y * 60, cz + L.sunDir.z * 60);
    this.sunL.target.position.set(cx, map.center.y, cz);
    const sh = this.sunL.shadow.camera; const ext = Math.max(V.X, V.Z) * 0.6; sh.left = -ext; sh.right = ext; sh.top = ext; sh.bottom = -ext; sh.updateProjectionMatrix();
    for (let i = 0; i < V.cx * V.cz; i++) this.rebuild(map, i);
    V.dirty.clear();
    this.buildFar(w, w2, L, cx, map.center.y, cz, plan.seed);
    this.buildBelow(w, L, map);
    this.buildClouds(w, L, cx, map.center.y, cz, plan.seed);
    this.buildWeather(plan.weather, w);
    if (plan.weather === "aurora" || w.id === "aurora") this.buildAurora();
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
    this.weather = null; this.clouds = null; this.liquid = null; this.liquidMat = null; this.far = null; this.aurora = null; this.auroraMat = null; this.fallers = null;
    this.debris.clear(); this.sparks.clear(); this.tracers.clear();
  }

  /** rebuild one chunk's meshes */
  rebuild(arena: GameMap, ci: number) {
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
  sync(arena: GameMap, max = 4) {
    let k = 0;
    for (const ci of arena.vox.dirty) { this.rebuild(arena, ci); arena.vox.dirty.delete(ci); if (++k >= max) break; }
  }

  /** the far ring: a rotating group of instanced boxes shaped into the theme's backdrop */
  private buildFar(w: Theme, w2: Theme | null, L: Look, cx: number, cy: number, cz: number, seed: number) {
    const r = makeRng(seed ^ 0x51ed27);
    const shapes: { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: string; glow?: boolean }[] = [];
    const ring = (th: Theme, from: number, to: number) => {
      const [c0, c1] = th.farCol;
      const count = this.phone ? 46 : 70;
      for (let i = 0; i < count; i++) {
        const a = from + ((i + r() * 0.5) / count) * (to - from);
        const d = 95 + r() * 75, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const near = 1 - (d - 95) / 75;
        const col = mix(mix(c0, c1, r()), L.fog, 0.18 + (1 - near) * 0.38);
        const big = 0.7 + r() * 0.8;
        const y0 = cy - 8 + (r() - 0.5) * 30;
        switch (th.far) {
          case "isles": case "temples": {
            // a floating island: grass cap, tapering rock, a waterfall
            const R = 6 + r() * 8;
            for (let k = 0; k < 4; k++) shapes.push({ x, y: y0 - k * 2.4, z, sx: R * 2 * (1 - k * 0.22), sy: 2.4, sz: R * 2 * (1 - k * 0.22), c: k === 0 ? mix(th.pal.top, L.fog, 0.25 + (1 - near) * 0.3) : shade(col, -0.05 * k) });
            if (r() < 0.5) shapes.push({ x: x + R * 0.6, y: y0 - 18, z, sx: 1.4, sy: 18, sz: 1.4, c: mix("#DDF4FF", L.fog, 0.35), glow: false });
            if (th.far === "temples" && r() < 0.6) for (let k = 0; k < 3; k++) shapes.push({ x, y: y0 + 1 + k * 3, z, sx: 8 - k * 2.4, sy: 3, sz: 8 - k * 2.4, c: shade(col, 0.1 + k * 0.03) });
            else if (r() < 0.6) shapes.push({ x: x - 2, y: y0 + 1, z, sx: 2, sy: 4 + r() * 4, sz: 2, c: mix(th.pal.leaves, L.fog, 0.4) });
            break;
          }
          case "peaks": case "volcanoes": {
            const h = 30 * big;
            for (let k = 0; k < 6; k++) shapes.push({ x, y: cy - 40 + k * h / 6, z, sx: (22 - k * 3.4) * big, sy: h / 6, sz: (22 - k * 3.4) * big, c: th.far === "peaks" && k > 3 ? mix("#ffffff", L.fog, 0.2) : shade(col, k * 0.03) });
            if (th.far === "volcanoes" && r() < 0.5) shapes.push({ x, y: cy - 40 + h, z, sx: 4, sy: 1, sz: 4, c: "#FF7A2A", glow: true });
            break;
          }
          case "mesas": { const h = 22 * big; shapes.push({ x, y: cy - 40, z, sx: 16 * big, sy: h, sz: 12 * big, c: col }); shapes.push({ x, y: cy - 40 + h, z, sx: 18 * big, sy: 2, sz: 14 * big, c: shade(col, 0.1) }); break; }
          case "spires": { const h = 28 * big; shapes.push({ x, y: cy - 30, z, sx: 3.5, sy: h, sz: 3.5, c: mix(th.pal.glass, L.fog, 0.3), glow: r() < 0.4 }); shapes.push({ x: x + 4, y: cy - 30, z, sx: 2.5, sy: h * 0.6, sz: 2.5, c: col }); break; }
          case "towers": {
            const h = 20 + r() * 34;
            shapes.push({ x, y: cy - 34, z, sx: 7 + r() * 5, sy: h, sz: 7 + r() * 5, c: col });
            for (let k = 0; k < 4; k++) shapes.push({ x: x + (r() - 0.5) * 5, y: cy - 34 + r() * h, z: z + (r() - 0.5) * 5, sx: 2.4, sy: 0.8, sz: 2.4, c: th.id === "neon" ? "#FF8FE6" : "#FFD97A", glow: L.night || th.id === "neon" });
            break;
          }
          case "shrooms": { const h = 20 * big; shapes.push({ x, y: cy - 30, z, sx: 3, sy: h, sz: 3, c: mix("#EFE4CC", L.fog, 0.4) }); shapes.push({ x, y: cy - 30 + h, z, sx: 14 * big, sy: 4, sz: 14 * big, c: mix(r() < 0.5 ? "#D2384E" : "#9B5DE5", L.fog, 0.35) }); break; }
          case "candy": { const h = 16 * big; shapes.push({ x, y: y0, z, sx: 1.5, sy: h, sz: 1.5, c: "#ffffff" }); shapes.push({ x, y: y0 + h, z, sx: 9 * big, sy: 9 * big, sz: 2, c: mix(r() < 0.5 ? "#FF5C8A" : "#7FE3FF", L.fog, 0.3) }); break; }
          case "planets": { if (i % 9 === 0) { const R = 10 + r() * 22; shapes.push({ x, y: cy + 20 + r() * 40, z, sx: R, sy: R, sz: R, c: mix(["#D8A070", "#8EB8E8", "#C8A0E8", "#E8D0A0"][i % 4], L.fog, 0.15), glow: true }); } else shapes.push({ x, y: cy - 30, z, sx: 14 * big, sy: 5, sz: 14 * big, c: col }); break; }
        }
        // balloons and airships drift among the islands
        if (i % 11 === 0 && th.far !== "planets") {
          const by = cy + 6 + r() * 24;
          if (r() < 0.6) { shapes.push({ x, y: by, z, sx: 4, sy: 5, sz: 4, c: ["#FF5C7A", "#FFD23F", "#7FD0FF", "#9CFF6B"][i % 4] }); shapes.push({ x, y: by - 2.4, z, sx: 1.6, sy: 1.2, sz: 1.6, c: "#8A5A35" }); }
          else { shapes.push({ x, y: by, z, sx: 12, sy: 3.6, sz: 3.6, c: mix("#C8B8A0", L.fog, 0.2) }); shapes.push({ x, y: by - 2.6, z, sx: 4, sy: 1.6, sz: 2, c: "#7A5236" }); }
        }
      }
    };
    if (w2) { ring(w, 0, Math.PI); ring(w2, Math.PI, Math.PI * 2); } else ring(w, 0, Math.PI * 2);
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const lit = shapes.filter((q) => !q.glow), glow = shapes.filter((q) => q.glow);
    const mk = (list: typeof shapes, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, list.length));
      list.forEach((q, i) => { _o.position.set(q.x - cx, q.y, q.z - cz); _o.rotation.set(0, hash(i, 7) * Math.PI, 0); _o.scale.set(q.sx, q.sy, q.sz); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.set(q.c)); });
      m.count = list.length; m.frustumCulled = false;
      return m;
    };
    const lm = new THREE.MeshLambertMaterial({ color: "#ffffff", fog: false }), gm = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
    const group = new THREE.Group(), inner = new THREE.Group();
    group.position.set(cx, 0, cz); group.add(inner);
    const a = mk(lit, lm), b = mk(glow, gm);
    inner.add(a, b);
    this.far = group;
    this.add(group, lm, gm, g, { dispose: () => { a.dispose(); b.dispose(); } });
  }

  /** far below the islands: a sea of clouds, an ocean, a lava lake or the void; ground maps get a grassy rim */
  private buildBelow(w: Theme, L: Look, map: GameMap) {
    const V = map.vox, cx = V.X / 2, cz = V.Z / 2;
    if (map.walled) {
      // the village: hills beyond the wall
      const g = new THREE.PlaneGeometry(900, 900); g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshLambertMaterial({ color: shade(w.pal.top, -0.12) });
      const plane = new THREE.Mesh(g, m); plane.position.set(cx, 2.98, cz);
      this.add(plane, g, m);
      return;
    }
    const kind = w.below;
    if (kind === "void") return;
    const y = map.center.y - (kind === "clouds" ? 24 : 34);
    const mat = new THREE.ShaderMaterial({
      fog: true, transparent: kind === "clouds",
      uniforms: { ...THREE.UniformsLib.fog, col: { value: new THREE.Color(w.belowColor) }, deep: { value: new THREE.Color(shade(w.belowColor, kind === "clouds" ? -0.12 : kind === "lava" ? -0.25 : -0.4)) }, t: { value: 0 }, kind: { value: kind === "clouds" ? 0 : kind === "sea" ? 1 : 2 }, sky: { value: new THREE.Color(L.sky[1]) } },
      vertexShader: "varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
      fragmentShader: `uniform vec3 col; uniform vec3 deep; uniform float t; uniform float kind; uniform vec3 sky; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec2 p = floor(vW.xz * (kind < 0.5 ? 0.25 : 1.0)) / (kind < 0.5 ? 0.25 : 1.0);
          float w = sin(p.x * 0.11 + t * 0.4) + sin(p.y * 0.13 - t * 0.3) + sin((p.x + p.y) * 0.05 + t * 0.2);
          vec3 c;
          if (kind < 0.5) { float puff = smoothstep(-0.8, 1.6, w); c = mix(deep, col, puff); }
          else if (kind < 1.5) { float k = smoothstep(-1.2, 1.6, w); c = mix(deep, col, k) + step(1.9, w) * 0.3; c = mix(c, sky, 0.15); }
          else { c = mix(deep, col, smoothstep(-1.0, 1.4, w)) * (1.15 + 0.2 * sin(t * 2.0 + p.x * 0.2)); }
          gl_FragColor = vec4(c, kind < 0.5 ? 0.96 : 1.0);
          #include <fog_fragment>
        }`,
    });
    const g = new THREE.PlaneGeometry(1200, 1200, 1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.set(cx, y, cz); m.renderOrder = -2;
    this.liquid = m; this.liquidMat = mat;
    this.add(m, g, mat);
  }

  private buildClouds(w: Theme, L: Look, cx: number, cy: number, cz: number, seed: number) {
    if (w.id === "moon" || w.id === "crystal") return;
    const r = makeRng(seed + 5);
    const n = this.phone ? 16 : 28, per = 5;
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: new THREE.Color(L.night ? "#1a2040" : "#4a4a54"), fog: false });
    const inst = new THREE.InstancedMesh(g, m, n * per);
    let i = 0;
    const col = L.night ? "#5A6488" : mix("#ffffff", L.sky[2], 0.2);
    for (let c = 0; c < n; c++) {
      const a = r() * Math.PI * 2, d = 40 + r() * 150, y = cy + (c % 3 === 0 ? -16 - r() * 8 : 10 + r() * 26);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      for (let k = 0; k < per; k++) {
        _o.position.set(x + (r() - 0.5) * 14, y + (r() - 0.5) * 2, z + (r() - 0.5) * 8); _o.scale.set(6 + r() * 10, 2 + r() * 2.5, 5 + r() * 7); _o.rotation.set(0, 0, 0); _o.updateMatrix();
        inst.setMatrixAt(i, _o.matrix); inst.setColorAt(i++, _c.set(shade(col, (r() - 0.5) * 0.08)));
      }
    }
    inst.frustumCulled = false;
    inst.position.set(cx, 0, cz);
    this.clouds = inst;
    this.add(inst, g, m, { dispose: () => inst.dispose() });
  }

  private buildWeather(kind: string, w: Theme) {
    this.wxKind = kind;
    if (kind === "none" || kind === "aurora") return;
    const n = this.phone ? 140 : 320;
    const g = kind === "rain" ? new THREE.BoxGeometry(0.03, 0.7, 0.03) : kind === "leaves" || kind === "petals" || kind === "confetti" ? new THREE.BoxGeometry(0.16, 0.03, 0.12) : new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const additive = kind === "fireflies" || kind === "sparks";
    const m = additive ? new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }) : new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: kind === "rain" || kind === "bubbles", opacity: kind === "rain" ? 0.55 : 0.75 });
    const inst = new THREE.InstancedMesh(g, m, n);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false;
    const cols: Record<string, string[]> = {
      snow: ["#ffffff", "#E8F2FF"], rain: ["#BFD8FF"], leaves: [w.pal.leaves, "#E8702A", "#FFB627"], petals: ["#FFB1D0", "#FF8AB8", "#ffffff"], ash: ["#3A3236", "#6E6468", "#FF7A2A"],
      fireflies: ["#FFF27A", "#B6FF5C"], bubbles: ["#E8FFFF"], sparks: ["#FFB627", "#FF6A2B"], confetti: ["#FF4D5E", "#3D8BFF", "#38D96B", "#FFC83D", "#FF8AC0"],
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

  /** northern lights: soft moving ribbons high in the sky */
  private buildAurora() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
      uniforms: { t: { value: 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform float t; varying vec3 vP;
        void main(){ float h = vP.y; if (h < 0.15) discard;
          float a = atan(vP.z, vP.x);
          float band = sin(a * 3.0 + t * 0.25 + sin(a * 7.0 + t * 0.4) * 0.6) * 0.5 + 0.5;
          float ribbon = smoothstep(0.08, 0.0, abs(h - 0.45 - band * 0.18)) * (0.6 + 0.4 * sin(a * 23.0 + t));
          vec3 c = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.4, 1.0), band) * ribbon * 0.55;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const g = new THREE.SphereGeometry(450, 32, 16);
    const m = new THREE.Mesh(g, mat); m.renderOrder = -9; m.frustumCulled = false;
    this.aurora = m; this.auroraMat = mat;
    this.add(m, g, mat);
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
    const counts: Record<string, number> = { coin: 0, gem: 0, heart: 0, oil: 0, health: 0, power: 0, cubes: 0 };
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
  drawCrystals(list: { team: number; x: number; y: number; z: number; hp: number; maxHp: number; alive: boolean }[], colors: string[]) {
    let n = 0;
    for (const c of list) {
      if (!c.alive || n >= 4) continue;
      const k = c.hp / c.maxHp;
      _o.position.set(c.x, c.y + 0.85 + Math.sin(this.t * 2 + c.team) * 0.12, c.z); _o.rotation.set(0, this.t * 1.2 + c.team, 0); _o.scale.setScalar(0.85 + k * 0.25); _o.updateMatrix();
      this.crystals.setMatrixAt(n, _o.matrix);
      const f = 0.75 + 0.35 * Math.abs(Math.sin(this.t * (k < 0.35 ? 10 : 3)));
      this.crystals.setColorAt(n++, _c.set(colors[c.team]).multiplyScalar(f));
    }
    this.crystals.count = n; this.crystals.instanceMatrix.needsUpdate = true; if (this.crystals.instanceColor) this.crystals.instanceColor.needsUpdate = true;
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
    if (this.clouds) this.clouds.rotation.y = this.t * 0.006;
    if (this.far) { this.far.children[0].rotation.y = this.t * 0.01; }
    if (this.auroraMat) { this.auroraMat.uniforms.t.value = this.t; if (this.aurora) this.aurora.position.copy(cam.position); }
    // weather: a box of bits around the camera, wrapping as it moves
    if (this.weather) {
      const k = this.wxKind, n = this.wx.length / 4;
      const fall = k === "rain" ? 16 : k === "snow" ? 1.6 : k === "leaves" || k === "petals" || k === "confetti" ? 1.2 : k === "ash" ? 0.8 : k === "bubbles" || k === "fireflies" || k === "sparks" ? -0.8 : 0.3;
      for (let i = 0; i < n; i++) {
        const ph = this.wx[i * 4 + 3];
        this.wx[i * 4 + 1] -= fall * dt;
        this.wx[i * 4] += Math.sin(this.t * 0.8 + ph) * dt * (k === "rain" ? 0 : 0.6) + (k === "rain" ? -1.5 * dt : 0);
        if (this.wx[i * 4 + 1] < -2) this.wx[i * 4 + 1] += 24; else if (this.wx[i * 4 + 1] > 22) this.wx[i * 4 + 1] -= 24;
        const wrap = (v: number) => ((((v + 20) % 40) + 40) % 40) - 20;
        const x = cam.position.x + wrap(this.wx[i * 4] - cam.position.x), z = cam.position.z + wrap(this.wx[i * 4 + 2] - cam.position.z);
        _o.position.set(x, this.wx[i * 4 + 1] + cam.position.y - 8, z);
        _o.rotation.set(k === "leaves" || k === "petals" || k === "confetti" ? this.t * 2 + ph : 0, this.t + ph, k === "rain" ? 0.1 : 0);
        const flick = k === "fireflies" ? 0.6 + Math.sin(this.t * 4 + ph) * 0.4 : 1;
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
    this.crystals.geometry.dispose(); (this.crystals.material as THREE.Material).dispose(); this.crystals.dispose();
    this.skyMat.dispose(); this.sky.geometry.dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
