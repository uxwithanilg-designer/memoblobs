// The world around the track. Moonlit Bay: a deep night sky with stars, a huge moon with a halo, drifting clouds, a sea
// that glitters along the moon's path, sea stacks and islands with waterfalls, a lighthouse with a turning beam, a
// castle with lit windows on a far cliff, and fireflies. Sunrise Meadows: a dawn sky with the sun, rolling hills,
// turning windmills, round trees, a lake that sparkles, and floating petals. Everything gently moves.
import * as THREE from "three";
import type { World } from "../data/worlds";
import type { Track } from "../track";
import { mergeStatic } from "./merge";
import { glow, moon, rock, sparkle } from "./tex";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

/** where a scenery cluster stands: its solid box, and for a hill its dome */
interface Foot { box: THREE.Box3; dome?: { x: number; z: number; r: number; h: number } }
/** the scenery along one stage's track */
interface Stretch { g: THREE.Group; tr: Track; seed: number; avoid: Track[]; foot: Foot[]; made: THREE.BufferGeometry[]; geos: THREE.BufferGeometry[]; mats: THREE.Material[] }
/** shared scenery parts (one set per world) */
interface Kit {
  coast: boolean; kind: string;
  stackGeo: THREE.BufferGeometry; capGeo: THREE.BufferGeometry; plane: THREE.BufferGeometry; palmSeg: THREE.BufferGeometry; frond: THREE.BufferGeometry;
  trunkGeo: THREE.BufferGeometry; crownGeo: THREE.BufferGeometry; winGeo: THREE.BufferGeometry;
  rock: THREE.Material; grass: THREE.Material; tree: THREE.Material; trunk: THREE.Material; wall: THREE.Material; roof: THREE.Material; red: THREE.Material;
  sail: THREE.Material; win: THREE.Material; lamp: THREE.Material; falls: THREE.Material; beam: THREE.Material;
  mist: THREE.SpriteMaterial; castleGlow: THREE.SpriteMaterial; halo: THREE.SpriteMaterial;
}
const BB = new THREE.Box3();
/** the solid footprint of a cluster (see-through parts like waterfalls and light beams don't count) */
function footOf(cg: THREE.Object3D, dome?: Foot["dome"]): Foot {
  cg.updateMatrixWorld(true);
  const box = new THREE.Box3();
  cg.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hill || (m.material as THREE.Material).transparent) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p.userData.dyn) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    BB.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); box.union(BB);
  });
  return { box, dome };
}
/** does a track run through this footprint? (passing well above it is fine) */
function hits(f: Foot, tr: Track) {
  const P = tr.pos, B = f.box, D = f.dome, empty = B.isEmpty(), M = 8;
  for (let i = 0; i < tr.n; i += 4) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (!empty && x > B.min.x - M && x < B.max.x + M && z > B.min.z - M && z < B.max.z + M && y < B.max.y + 4) return true;
    if (D) {
      const d = Math.hypot(x - D.x, z - D.z);
      if (d < D.r + M) { const q = Math.max(0, d - M) / D.r; const top = D.h * Math.sqrt(Math.max(0, 1 - q * q)) - 2; if (top > y - 3) return true; }
    }
  }
  return false;
}

export interface EnvLook { night: boolean; sky: [string, string, string]; light: string; water: string; grass: string; rock: string; fog: string; sunDir: THREE.Vector3 }
export function lookOf(w: World): EnvLook {
  // dark skies (night, the deep sea, storms, space) get the moon, the stars and the night lighting
  const night = w.sky === "night" || w.sky === "deep" || w.sky === "space" || w.sky === "storm";
  const p = w.pal;
  return {
    night, sky: [p.top, p.horizon, night ? `#${new THREE.Color(p.horizon).lerp(new THREE.Color("#3A4FA0"), 0.5).getHexString()}` : w.sky === "dusk" ? "#FFC890" : "#FFE6C0"], light: p.light, water: p.water, grass: p.grass, rock: p.rock,
    fog: night ? `#${new THREE.Color(p.horizon).lerp(new THREE.Color("#0A0F2A"), 0.45).getHexString()}` : p.horizon,
    sunDir: night ? v3(-0.25, 0.32, -1).normalize() : v3(0.45, 0.16, -1).normalize(),
  };
}

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 top; uniform vec3 hor; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glowK; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float y = d.y;
  vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, low, clamp(-y*6.0,0.0,1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * glowK;
  gl_FragColor = vec4(c, 1.0); }`;

const SEA_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_FS = `uniform vec3 col; uniform vec3 deep; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 fogCol; uniform float time; uniform vec3 cam; uniform float fogNear; uniform float fogFar; varying vec3 vW;
float h(vec2 p){ return sin(p.x*0.21+time*0.9)*0.5 + sin(p.y*0.17-time*0.7)*0.5 + sin((p.x+p.y)*0.43+time*1.7)*0.25 + sin((p.x-p.y)*0.91-time*2.3)*0.12; }
void main(){
  vec2 p = vW.xz;
  float e = 0.6;
  vec3 n = normalize(vec3(h(p-vec2(e,0.))-h(p+vec2(e,0.)), 2.2, h(p-vec2(0.,e))-h(p+vec2(0.,e))));
  vec3 v = normalize(cam - vW);
  vec3 r = reflect(-v, n);
  float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 90.0);
  float glint = pow(max(dot(r, normalize(sunDir)), 0.0), 900.0);
  float fres = pow(1.0 - max(dot(v, vec3(0.,1.,0.)), 0.0), 3.0);
  vec3 c = mix(deep, col, 0.35 + 0.4*fres) + sunCol * (spec*0.55 + glint*1.1);
  float d = length(cam.xz - vW.xz);
  float f = smoothstep(fogNear, fogFar, d);
  gl_FragColor = vec4(mix(c, fogCol, f), 1.0);
}`;

export class Env {
  readonly group = new THREE.Group();
  /** phones: scenery props further than this from the camera are not drawn (centres and radii measured once) */
  cullFar = Infinity;
  private cullT = 0;
  cull(cam: THREE.Vector3, dt: number) {
    if (!Number.isFinite(this.cullFar)) return;
    this.cullT -= dt; if (this.cullT > 0) return; this.cullT = 0.25;
    const box = new THREE.Box3(), sph = new THREE.Sphere();
    for (const e of this.stretches) for (const c of e.g.children) {
      let b = c.userData.cullS as THREE.Sphere | undefined;
      if (!b) { box.setFromObject(c); if (box.isEmpty()) continue; b = box.getBoundingSphere(sph.clone()); c.userData.cullS = b; }
      // big merged pieces (a whole stretch of rocks) always stay
      if (b.radius > 120) continue;
      c.visible = b.center.distanceTo(cam) - b.radius < this.cullFar;
    }
  }
  private sky: THREE.Mesh;
  private sea: THREE.Mesh | null = null;
  private seaMat: THREE.ShaderMaterial | null = null;
  private stars: THREE.Points | null = null;
  private clouds: THREE.Sprite[] = [];
  private flies: THREE.Points;
  private flyBase: Float32Array;
  private spinners: { o: THREE.Object3D; axis: "x" | "y" | "z"; speed: number }[] = [];
  private beams: THREE.Object3D[] = [];
  private lit: THREE.Sprite[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  readonly look: EnvLook;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private t = 0;
  private seaY = 0;

  constructor(readonly world: World, track: Track, seed: number, readonly quality: "low" | "medium" | "high") {
    rs = (seed % 2147483646) + 1;
    const L = (this.look = lookOf(world));
    // ---- sky dome
    const skyMat = this.m(new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(L.sky[0]) }, hor: { value: new THREE.Color(L.sky[1]) }, low: { value: new THREE.Color(L.sky[2]) }, sunDir: { value: L.sunDir }, sunCol: { value: new THREE.Color(L.light) }, glowK: { value: L.night ? 0.6 : 1.2 } },
    }));
    this.sky = new THREE.Mesh(this.g(new THREE.SphereGeometry(1800, 32, 16)), skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.sky.userData.dyn = true;
    this.group.add(this.sky);
    // ---- lights
    this.hemi = new THREE.HemisphereLight(L.night ? "#8FA6FF" : "#FFE2C0", L.night ? "#2A3A60" : "#5A7A3A", L.night ? 1.35 : 1.25);
    this.sun = new THREE.DirectionalLight(L.night ? "#DDE8FF" : "#FFE0B0", L.night ? 1.8 : 2.4);
    this.sun.position.copy(L.sunDir).multiplyScalar(100);
    this.group.add(this.hemi, this.sun, this.sun.target);
    // ---- moon / sun with glow and halo
    const far = 1500;
    const disc = new THREE.Sprite(this.m(new THREE.SpriteMaterial({ map: L.night ? moon() : glow("#FFF6D8"), fog: false, depthWrite: false, color: L.night ? "#FFFFFF" : "#FFF2C0" })));
    disc.position.copy(L.sunDir).multiplyScalar(far); disc.scale.setScalar(L.night ? 210 : 240);
    const halo = new THREE.Sprite(this.m(new THREE.SpriteMaterial({ map: glow(L.light), fog: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: L.night ? 0.55 : 0.7 })));
    halo.position.copy(disc.position).multiplyScalar(1.001); halo.scale.setScalar(L.night ? 900 : 1100);
    disc.renderOrder = -9; halo.renderOrder = -9;
    this.group.add(halo, disc);
    // ---- stars
    if (L.night) {
      const n = quality === "low" ? 700 : 1600, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, rr = Math.sqrt(1 - y * y);
        p.set([Math.cos(th) * rr * 1700, y * 1700, Math.sin(th) * rr * 1700], i * 3);
        const w = 0.7 + rnd() * 0.3; c.set([w, w, 0.85 + rnd() * 0.15], i * 3);
      }
      const g = this.g(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      this.stars = new THREE.Points(g, this.m(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false })));
      this.stars.frustumCulled = false; this.stars.renderOrder = -8;
      this.group.add(this.stars);
    }
    // ---- clouds
    const cloudTex = cloud();
    for (let i = 0; i < (quality === "low" ? 8 : 16); i++) {
      const sp = new THREE.Sprite(this.m(new THREE.SpriteMaterial({ map: cloudTex, color: L.night ? "#5A6AB0" : "#FFE9D6", transparent: true, opacity: L.night ? 0.55 : 0.85, depthWrite: false, fog: false })));
      const a = rnd() * Math.PI * 2, d = 700 + rnd() * 600;
      sp.position.set(Math.cos(a) * d, 120 + rnd() * 260, Math.sin(a) * d);
      sp.scale.set(300 + rnd() * 300, 90 + rnd() * 80, 1); sp.renderOrder = -7;
      this.clouds.push(sp); this.group.add(sp);
    }
    // ---- sea (coast) or a lake + meadow ground
    this.seaMat = this.m(new THREE.ShaderMaterial({
      vertexShader: SEA_VS, fragmentShader: SEA_FS,
      uniforms: { col: { value: new THREE.Color(L.water) }, deep: { value: new THREE.Color(L.water).multiplyScalar(0.35) }, sunDir: { value: L.sunDir }, sunCol: { value: new THREE.Color(L.light) }, fogCol: { value: new THREE.Color(L.fog) }, time: { value: 0 }, cam: { value: v3() }, fogNear: { value: 300 }, fogFar: { value: 1500 } },
    }));
    this.sea = new THREE.Mesh(this.g(new THREE.PlaneGeometry(6000, 6000)), this.seaMat);
    this.sea.rotation.x = -Math.PI / 2; this.sea.userData.dyn = true;
    // the ground far below: the sea, a lake, a lava sea, a sea of clouds, a dark city floor — none in space
    const kind = world.scenery;
    this.seaY = kind === "meadow" ? -2 : kind === "sky" ? -40 : kind === "city" || kind === "grid" || kind === "highway" || kind === "fortress" ? -30 : 0;
    this.sea.position.y = this.seaY;
    if (kind === "space") this.sea.visible = false;
    if (kind === "volcano") { (this.seaMat.uniforms.col.value as THREE.Color).set("#FF5A1A"); (this.seaMat.uniforms.deep.value as THREE.Color).set("#6A1A08"); }
    if (kind === "sky") { (this.seaMat.uniforms.col.value as THREE.Color).set("#F4F8FF"); (this.seaMat.uniforms.deep.value as THREE.Color).set("#C8DCF2"); }
    this.group.add(this.sea);
    // ---- far scenery along the track
    this.addScenery(track);
    // ---- fireflies (night) / petals and pollen (day) round the camera
    const nf = quality === "low" ? 60 : 140;
    this.flyBase = new Float32Array(nf * 3);
    for (let i = 0; i < nf; i++) this.flyBase.set([(rnd() - 0.5) * 60, rnd() * 10 - 1, (rnd() - 0.5) * 80], i * 3);
    const fg = this.g(new THREE.BufferGeometry()); fg.setAttribute("position", new THREE.BufferAttribute(this.flyBase.slice(), 3));
    this.flies = new THREE.Points(fg, this.m(new THREE.PointsMaterial({ map: sparkle(), size: L.night ? 0.5 : 0.35, color: L.night ? "#FFE58A" : "#FFC2DE", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.flies.frustumCulled = false;
    this.group.add(this.flies);
  }
  private m<T extends THREE.Material>(x: T): T { (this.ml ?? this.mats).push(x); return x; }
  private g<T extends THREE.BufferGeometry>(x: T): T { (this.gl ?? this.geos).push(x); return x; }

  // ---------------------------------------------------------------- scenery, one stretch per stage's track
  // The run never stops, so scenery is added stretch by stretch as each new track joins on. Nothing may stand in the
  // road: every cluster (a sea stack with its palm, a hill with its windmill and trees) keeps a footprint, a cluster
  // that a track runs through is left out, and when a new track runs through an older stretch, that stretch is rebuilt
  // from its own seed without the pieces in the way (the rest comes back exactly as it was).
  private stretches: Stretch[] = [];
  private kit: Kit | null = null;
  /** where the scenery helpers add their parts (the cluster being built) */
  private into: THREE.Object3D = this.group;
  /** geometries and materials made while a stretch is built belong to it */
  private gl: THREE.BufferGeometry[] | null = null;
  private ml: THREE.Material[] | null = null;

  /** scenery along a new track (older stretches it runs through are rebuilt around it; the oldest go) */
  addScenery(tr: Track) {
    this.avoidTrack(tr);
    this.kitFor();
    const e: Stretch = { g: new THREE.Group(), tr, seed: rs, avoid: this.stretches.map((x) => x.tr), foot: [], made: [], geos: [], mats: [] };
    e.g.userData.dyn = true; // merged on its own, never by the whole world
    this.group.add(e.g); this.stretches.push(e);
    this.build(e, false);
    while (this.stretches.length > 3) this.dropStretch(this.stretches.shift()!);
  }
  /** Rollo is well into this track: the scenery of the stretches before it is behind him now */
  dropBefore(tr: Track) {
    const i = this.stretches.findIndex((e) => e.tr === tr);
    for (let k = 0; k < i; k++) this.dropStretch(this.stretches.shift()!);
  }
  /** a track is coming: rebuild any stretch that stands in its way */
  avoidTrack(tr: Track) {
    for (const e of this.stretches) if (e.tr !== tr && e.foot.some((f) => hits(f, tr))) { e.avoid.push(tr); this.build(e, true); }
  }
  /** start over on a fresh track (a resume) */
  resetScenery(tr: Track) { while (this.stretches.length) this.dropStretch(this.stretches.pop()!); this.addScenery(tr); }

  private kitFor(): Kit {
    if (this.kit) return this.kit;
    const L = this.look, coast = this.world.scenery !== "meadow";
    const stackGeo = this.g(new THREE.CylinderGeometry(1, 1.25, 1, 9, 3));
    // jitter the stack geometry so it reads as rock
    const pa = stackGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) { const k = 0.85 + rnd() * 0.3; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); }
    stackGeo.computeVertexNormals();
    const add = <T extends THREE.Material>(x: T) => this.m(x);
    this.kit = {
      coast, kind: this.world.scenery, stackGeo,
      capGeo: this.g(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
      plane: this.g(new THREE.PlaneGeometry(1, 1)),
      palmSeg: this.g(new THREE.CylinderGeometry(0.28, 0.36, 1, 7)), frond: this.g(leafGeo()),
      trunkGeo: this.g(new THREE.CylinderGeometry(0.4, 0.6, 1, 7)), crownGeo: this.g(new THREE.IcosahedronGeometry(1, 1)),
      winGeo: this.g(new THREE.PlaneGeometry(0.9, 1.5)),
      rock: add(new THREE.MeshStandardMaterial({ map: rock(L.rock), color: "#FFFFFF", roughness: 0.95 })),
      grass: add(new THREE.MeshStandardMaterial({ color: L.grass, roughness: 0.9 })),
      tree: add(new THREE.MeshStandardMaterial({ color: coast ? "#2F7A4A" : "#4FA84A", roughness: 0.85 })),
      trunk: add(new THREE.MeshStandardMaterial({ color: "#6B4A2E", roughness: 0.9 })),
      wall: add(new THREE.MeshStandardMaterial({ color: coast ? "#B9B3C9" : "#F2E6D0", roughness: 0.8 })),
      roof: add(new THREE.MeshStandardMaterial({ color: coast ? "#3D4E9A" : "#C8553D", roughness: 0.6 })),
      red: add(new THREE.MeshStandardMaterial({ color: "#E8504F", roughness: 0.6 })),
      sail: add(new THREE.MeshStandardMaterial({ color: "#FFF8EA", roughness: 0.8, side: THREE.DoubleSide })),
      win: add(new THREE.MeshBasicMaterial({ color: "#FFD27A" })),
      lamp: add(new THREE.MeshBasicMaterial({ color: "#FFF0B0" })),
      falls: add(new THREE.MeshBasicMaterial({ color: "#BFE6FF", transparent: true, opacity: 0.85, side: THREE.DoubleSide })),
      beam: add(new THREE.MeshBasicMaterial({ color: "#FFF4C8", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
      mist: add(new THREE.SpriteMaterial({ map: glow("#FFFFFF"), transparent: true, opacity: 0.35, depthWrite: false })),
      castleGlow: add(new THREE.SpriteMaterial({ map: glow("#FFC46B"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })),
      halo: add(new THREE.SpriteMaterial({ map: glow("#FFF0B0"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })),
    };
    return this.kit;
  }

  /** build (or rebuild) a stretch from its own seed, leaving out clusters that stand on any track it must avoid */
  private build(e: Stretch, again: boolean) {
    const K = this.kitFor();
    this.clearStretch(e);
    const save = rs; rs = e.seed;
    this.gl = e.geos; this.ml = e.mats;
    const tracks = [e.tr, ...e.avoid];
    try {
      const tr = e.tr, coast = K.coast;
      const fr = new Float32Array(12);
      const step = coast ? 140 : 110;
      let castle = false, light = false;
      for (let s = 60; s < tr.len + 40; s += step) {
        tr.frame(Math.min(s, tr.len), fr);
        const side = rnd() < 0.5 ? -1 : 1;
        // heading right vector on the ground plane
        const rx = fr[9], rz = fr[11], rl = Math.hypot(rx, rz) || 1;
        const fx = fr[3], fz = fr[5];
        for (let k = 0; k < 2; k++) {
          const cg = new THREE.Group(); this.into = cg;
          let dome: Foot["dome"];
          const d = (k === 0 ? 90 : 220) + rnd() * 200;
          const sd = k === 0 ? side : -side;
          const x = fr[0] + (rx / rl) * d * sd + fx * rnd() * 60, z = fr[2] + (rz / rl) * d * sd + fz * rnd() * 60;
          if (K.kind !== "coast" && K.kind !== "meadow") {
            this.cluster2(K.kind, x, z, k);
          } else if (coast) {
            // a sea stack / island with grass on top, sometimes a waterfall and a palm
            const R = 14 + rnd() * 30, H = 20 + rnd() * 50;
            const st = new THREE.Mesh(K.stackGeo, K.rock); st.scale.set(R, H, R * (0.8 + rnd() * 0.4)); st.position.set(x, H / 2 - 2, z); st.rotation.y = rnd() * 6; cg.add(st);
            const cap = new THREE.Mesh(K.capGeo, K.grass); cap.scale.set(R * 1.05, 4 + rnd() * 3, R * 1.05); cap.position.set(x, H - 2, z); cg.add(cap);
            if (rnd() < 0.45) {
              const wf = new THREE.Mesh(K.plane, K.falls); wf.scale.set(4 + rnd() * 5, H, 1);
              wf.position.set(x - (rx / rl) * sd * R * 0.98, H / 2 - 2, z - (rz / rl) * sd * R * 0.98); wf.lookAt(fr[0], H / 2, fr[2]); cg.add(wf);
              const mist = new THREE.Sprite(K.mist);
              mist.position.set(wf.position.x, 3, wf.position.z); mist.scale.set(18, 10, 1); cg.add(mist);
            }
            if (rnd() < 0.7) this.palm(x + (rnd() - 0.5) * R, H + 1, z + (rnd() - 0.5) * R, 7 + rnd() * 5);
            if (!castle && s > 300 && k === 1) { castle = true; this.castle(x, H - 2, z); }
            else if (!light && s > 150 && k === 0 && rnd() < 0.5) { light = true; this.lighthouse(x, H - 2, z); }
          } else {
            // rolling hills, windmills, trees
            const R = 60 + rnd() * 120;
            const hill = new THREE.Mesh(K.capGeo, K.grass); hill.scale.set(R, 18 + rnd() * 30, R * (0.7 + rnd() * 0.5)); hill.position.set(x, -2, z); hill.userData.hill = true; cg.add(hill);
            dome = { x, z, r: Math.max(hill.scale.x, hill.scale.z), h: hill.scale.y };
            if (rnd() < 0.5) this.windmill(x, hill.scale.y - 4, z);
            for (let t = 0; t < 4; t++) this.tree(x + (rnd() - 0.5) * R, -1, z + (rnd() - 0.5) * R, 5 + rnd() * 4);
          }
          const f = footOf(cg, dome);
          if (tracks.every((t) => !hits(f, t))) { e.g.add(cg); e.foot.push(f); }
          else this.prune();
        }
      }
    } finally {
      this.into = this.group; this.gl = null; this.ml = null;
      if (again) rs = save;
    }
    e.made = mergeStatic(e.g);
  }
  private clearStretch(e: Stretch) {
    for (const c of [...e.g.children]) c.removeFromParent();
    for (const g of e.made) g.dispose();
    for (const g of e.geos) g.dispose();
    for (const m of e.mats) m.dispose();
    e.made = []; e.geos = []; e.mats = []; e.foot = [];
    this.prune();
  }
  private dropStretch(e: Stretch) { this.clearStretch(e); e.g.removeFromParent(); this.prune(); }
  /** forget animated parts that are no longer in the world */
  private prune() {
    const on = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === this.group) return true; return false; };
    this.spinners = this.spinners.filter((x) => on(x.o)); this.beams = this.beams.filter(on); this.lit = this.lit.filter(on);
  }

  // ---------------------------------------------------------------- the other 21 worlds' scenery
  private km = new Map<string, THREE.Material>();
  private kg = new Map<string, THREE.BufferGeometry>();
  /** a shared material / geometry for this world's scenery (made once, freed with the world) */
  private M(key: string, f: () => THREE.Material) { let x = this.km.get(key); if (!x) { x = this.m(f()); this.km.set(key, x); } return x; }
  private Gm(key: string, f: () => THREE.BufferGeometry) { let x = this.kg.get(key); if (!x) { x = f(); this.geos.push(x); this.kg.set(key, x); } return x; }
  private std(c: string, o: THREE.MeshStandardMaterialParameters = {}) { return this.M(`s:${c}:${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o })); }
  private glowMat(c: string, k = 1) { return this.M(`e:${c}:${k}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 })); }
  private put(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; this.into.add(m); return m;
  }
  private halo(c: string, x: number, y: number, z: number, s: number, op = 0.5) {
    const sp = new THREE.Sprite(this.M(`h:${c}:${op}`, () => new THREE.SpriteMaterial({ map: glow(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op })) as THREE.SpriteMaterial);
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); this.into.add(sp); return sp;
  }
  /** one cluster of a world's scenery at (x, z); k = 0 near the track, 1 far */
  private cluster2(kind: string, x: number, z: number, k: number) {
    const L = this.look, r = rnd, wid = this.world.id;
    const sph = this.Gm("sph", () => new THREE.SphereGeometry(1, 16, 12)), cyl = this.Gm("cyl", () => new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0));
    const cone = this.Gm("cone", () => new THREE.ConeGeometry(1, 1, 12).translate(0, 0.5, 0)), box = this.Gm("box", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const ico = this.Gm("ico", () => new THREE.IcosahedronGeometry(1, 0)), dome = this.Gm("dome", () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    const torus = this.Gm("torus", () => new THREE.TorusGeometry(1, 0.08, 8, 40));
    const S = 1 + k * 0.8 + r() * 0.6;
    switch (kind) {
      case "canyon": { // striped candy mesas, lollipops and gumdrops
        const R = 14 * S, H = 24 + r() * 50;
        this.put(cyl, this.M("candyMesa", () => new THREE.MeshStandardMaterial({ map: stripesH(L.grass, "#FFFFFF"), roughness: 0.6 })), x, -2, z, R, H, R * (0.8 + r() * 0.4));
        this.put(dome, this.std("#FFFFFF", { roughness: 0.4 }), x, H - 2, z, R * 1.04, 3, R * 1.04);
        for (let i = 0; i < 3; i++) { const lx = x + (r() - 0.5) * R * 3, lz = z + (r() - 0.5) * R * 3, h = 8 + r() * 8; this.put(cyl, this.std("#FFFFFF"), lx, -2, lz, 0.4, h, 0.4); this.put(this.Gm("lolly", () => new THREE.CylinderGeometry(1, 1, 0.6, 24).rotateX(Math.PI / 2)), this.M("lollyM", () => new THREE.MeshStandardMaterial({ map: swirl(["#FF5A9A", "#FFE066", "#5CF2C9"][i % 3]), roughness: 0.4 })), lx, h, lz, 3.4, 3.4, 1, r() * 6); }
        for (let i = 0; i < 3; i++) this.put(cone, this.std(["#B98CFF", "#5CF2C9", "#FFB347"][i], { roughness: 0.3 }), x + (r() - 0.5) * R * 2.5, -2, z + (r() - 0.5) * R * 2.5, 4, 5, 4);
        break;
      }
      case "forest": { // bamboo groves (Bamboo Breeze) or round autumn trees (Autumn Woods)
        if (wid === 16) for (let i = 0; i < 9; i++) { const tx = x + (r() - 0.5) * 70 * S, tz = z + (r() - 0.5) * 70 * S, h = 10 + r() * 12; this.put(cyl, this.std("#6B4A2E"), tx, -2, tz, 0.7, h * 0.6, 0.7); this.put(sph, this.std(["#E8662A", "#FFB347", "#C8352A", "#FFD066"][i % 4], { roughness: 0.85 }), tx, h * 0.75, tz, h * 0.45, h * 0.42, h * 0.45); }
        else { for (let i = 0; i < 16; i++) { const tx = x + (r() - 0.5) * 40 * S, tz = z + (r() - 0.5) * 40 * S, h = 24 + r() * 26; this.put(cyl, this.std("#7FB85A", { roughness: 0.5 }), tx, -2, tz, 0.6, h, 0.6); this.put(sph, this.std("#5FA65A"), tx, h - 2, tz, 4, 1.4, 4); } this.halo("#FFC46B", x, 10, z, 10, 0.4); }
        break;
      }
      case "cave": { // dark rock mounds studded with glowing crystals
        const R = 20 * S;
        this.put(ico, this.std(L.rock, { roughness: 0.95, flatShading: true }), x, -4, z, R, R * (0.8 + r() * 0.8), R);
        for (let i = 0; i < 6; i++) { const cx = x + (r() - 0.5) * R * 1.6, cz = z + (r() - 0.5) * R * 1.6, h = 6 + r() * 14; const c = this.put(this.Gm("crystal", () => new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0)), this.glowMat(i % 2 ? "#7FE8FF" : "#C9A8FF", 0.8), cx, R * 0.5, cz, h * 0.25, h, h * 0.25); c.rotation.z = (r() - 0.5) * 0.6; }
        this.halo("#9F7AFF", x, R * 0.8, z, R * 2, 0.35);
        break;
      }
      case "city": { // towers with lit windows, billboards
        for (let i = 0; i < 4; i++) { const bx = x + (r() - 0.5) * 40 * S, bz = z + (r() - 0.5) * 40 * S, w = 10 + r() * 14, h = 30 + r() * 90; this.put(box, this.M(`win${i % 2}`, () => new THREE.MeshStandardMaterial({ map: windows(i % 2 ? "#FF5FD8" : "#5CF2C9"), emissiveMap: windows(i % 2 ? "#FF5FD8" : "#5CF2C9", true), emissive: "#FFFFFF", emissiveIntensity: 0.9, roughness: 0.6 })), bx, -20, bz, w, h + 20, w * (0.8 + r() * 0.4)); if (r() < 0.6) this.halo(i % 2 ? "#FF5FD8" : "#5CF2C9", bx, h - 4, bz, 26, 0.45); }
        break;
      }
      case "snow": { // white peaks and dark pines with snowy tips
        const R = 40 * S, H = 60 + r() * 90;
        this.put(cone, this.std("#9FB6C8", { roughness: 0.9, flatShading: true }), x, -4, z, R, H, R);
        this.put(cone, this.std("#FFFFFF", { roughness: 0.7, flatShading: true }), x, -4 + H * 0.55, z, R * 0.46, H * 0.46, R * 0.46);
        for (let i = 0; i < 6; i++) { const px = x + (r() - 0.5) * R * 2.4, pz = z + (r() - 0.5) * R * 2.4, h = 8 + r() * 8; this.put(cone, this.std("#2F6A4A"), px, -2, pz, h * 0.3, h, h * 0.3); this.put(cone, this.std("#FFFFFF"), px, -2 + h * 0.62, pz, h * 0.16, h * 0.4, h * 0.16); }
        break;
      }
      case "sky": { // floating islands with a tree, big cloud puffs
        const R = 12 * S, y = 10 + r() * 50;
        this.put(cone, this.std(L.rock, { flatShading: true }), x, y, z, R, -R * 1.6, R);
        this.put(dome, this.std(L.grass), x, y - 0.5, z, R * 1.02, 2, R * 1.02);
        this.put(cyl, this.std("#6B4A2E"), x, y, z, 0.6, 6, 0.6); this.put(sph, this.std("#7AC85A"), x, y + 7, z, 4, 3.4, 4);
        for (let i = 0; i < 4; i++) this.put(sph, this.std("#FFFFFF", { roughness: 1 }), x + (r() - 0.5) * 60, -20 + r() * 10, z + (r() - 0.5) * 60, 14 + r() * 10, 6 + r() * 4, 14 + r() * 10);
        break;
      }
      case "volcano": { // black cones with glowing craters and lava runs
        const R = 34 * S, H = 50 + r() * 80;
        this.put(cone, this.std("#1E1412", { roughness: 0.95, flatShading: true }), x, -4, z, R, H, R);
        this.halo("#FF6A2A", x, H - 4, z, R * 1.2, 0.7);
        this.put(cyl, this.glowMat("#FF5A1A", 1.4), x, H - 6, z, R * 0.18, 2, R * 0.18);
        break;
      }
      case "jungle": { // great trees and a stepped temple
        if (k === 1 && r() < 0.6) { const w = 30 * S; for (let i = 0; i < 4; i++) this.put(box, this.std(i % 2 ? "#8A8070" : "#9A9080", { roughness: 0.9 }), x, -2 + i * 7, z, w - i * 7, 7, w - i * 7); this.put(box, this.std("#5A8A4A"), x, 26, z, w * 0.3, 4, w * 0.3); }
        else for (let i = 0; i < 5; i++) { const tx = x + (r() - 0.5) * 50 * S, tz = z + (r() - 0.5) * 50 * S, h = 18 + r() * 20; this.put(cyl, this.std("#5A3E2A"), tx, -2, tz, 1.2, h, 1.2); this.put(sph, this.std("#3E8A3A"), tx, h, tz, h * 0.5, h * 0.3, h * 0.5); }
        break;
      }
      case "dunes": { // sand dunes, a palm oasis, sandstone arches
        const R = 50 * S;
        this.put(dome, this.std(L.grass, { roughness: 1 }), x, -2, z, R, 10 + r() * 20, R * (0.5 + r() * 0.4), r() * 3);
        if (r() < 0.4) { const a = this.put(this.Gm("arch", () => new THREE.TorusGeometry(1, 0.22, 10, 24, Math.PI)), this.std(L.rock, { flatShading: true }), x, -2, z, 16 * S, 16 * S, 10, r() * 3); void a; }
        else for (let i = 0; i < 3; i++) { const tx = x + (r() - 0.5) * 30, tz = z + (r() - 0.5) * 30; this.put(cyl, this.std("#8A6A44"), tx, -2, tz, 0.5, 10, 0.5); this.put(sph, this.std("#3E8A3A"), tx, 9, tz, 4, 1.2, 4); }
        break;
      }
      case "factory": { // giant toy blocks and turning gears
        for (let i = 0; i < 4; i++) this.put(box, this.std(["#FF5A7A", "#5AA0FF", "#FFE066", "#5CF2C9"][i], { roughness: 0.4 }), x + (r() - 0.5) * 40, -2 + (i % 2) * 16 * S, z + (r() - 0.5) * 40, 16 * S, 16 * S, 16 * S, r() * 2);
        const gear = new THREE.Group(); gear.position.set(x, 20 * S, z); gear.rotation.y = r() * 3; this.into.add(gear);
        const gm = new THREE.Mesh(this.Gm("gear", () => gearGeo()), this.std("#C9D2DE", { metalness: 0.7, roughness: 0.3 })); gm.scale.setScalar(12 * S); gear.add(gm);
        gear.userData.dyn = true; this.spinners.push({ o: gear, axis: "z", speed: 0.25 });
        break;
      }
      case "carnival": { // a big wheel, striped tents, strings of lights
        if (k === 1) { const wheel = new THREE.Group(); wheel.position.set(x, 30 * S, z); this.into.add(wheel); const rim = new THREE.Mesh(torus, this.glowMat("#FFD36B", 0.8)); rim.scale.setScalar(26 * S); wheel.add(rim); for (let i = 0; i < 10; i++) { const sp = new THREE.Mesh(box, this.std("#FFFFFF")); sp.scale.set(0.3, 26 * S, 0.3); sp.rotation.z = (i / 10) * Math.PI * 2; wheel.add(sp); const c = new THREE.Mesh(sph, this.std(["#FF5A7A", "#5CF2C9", "#FFE066"][i % 3])); const a = (i / 10) * Math.PI * 2; c.position.set(Math.cos(a) * 26 * S, Math.sin(a) * 26 * S, 0); c.scale.setScalar(2); wheel.add(c); } for (const mg of mergeStatic(wheel)) this.g(mg); wheel.userData.dyn = true; this.spinners.push({ o: wheel, axis: "z", speed: 0.15 }); this.put(box, this.std("#3A3F4E"), x, -2, z, 2, 32 * S, 2); }
        else for (let i = 0; i < 3; i++) { const tx = x + (r() - 0.5) * 40, tz = z + (r() - 0.5) * 40; this.put(cone, this.M(`tent${i}`, () => new THREE.MeshStandardMaterial({ map: stripesV(["#FF5A7A", "#5AA0FF", "#FFB347"][i], "#FFFFFF"), roughness: 0.6 })), tx, -2, tz, 9, 14, 9); this.halo("#FFD36B", tx, 14, tz, 8, 0.6); }
        break;
      }
      case "sea": { // coral, kelp, glowing fish on the sea floor
        for (let i = 0; i < 5; i++) { const cx = x + (r() - 0.5) * 40, cz = z + (r() - 0.5) * 40, h = 6 + r() * 12; for (let b = 0; b < 4; b++) { const m = this.put(cyl, this.std(["#FF8FA0", "#FFB347", "#B98CFF"][i % 3], { roughness: 0.6 }), cx, -2, cz, 0.8, h, 0.8); m.rotation.z = (b - 1.5) * 0.4; } }
        for (let i = 0; i < 6; i++) this.put(cyl, this.std("#2E8A5A"), x + (r() - 0.5) * 50, -2, z + (r() - 0.5) * 50, 0.5, 20 + r() * 30, 0.5);
        this.halo("#7FF2FF", x, 14, z, 12, 0.5);
        break;
      }
      case "plains": { // low hills, lightning rods, dark clouds
        this.put(dome, this.std(L.grass, { roughness: 1 }), x, -2, z, 60 * S, 12 + r() * 10, 50 * S);
        for (let i = 0; i < 2; i++) { const px = x + (r() - 0.5) * 40, pz = z + (r() - 0.5) * 40; this.put(cyl, this.std("#7C8899", { metalness: 0.6 }), px, -2, pz, 0.4, 30, 0.4); this.halo("#E8F0FF", px, 28, pz, 6, 0.8); }
        this.put(sph, this.std("#3A4458", { roughness: 1 }), x, 70 + r() * 30, z, 40, 10, 30);
        break;
      }
      case "shrooms": { // giant glowing mushrooms
        for (let i = 0; i < 4; i++) { const mx = x + (r() - 0.5) * 50, mz = z + (r() - 0.5) * 50, h = 10 + r() * 24; const c = ["#9FFFB8", "#FF8FC8", "#7FE8FF", "#FFE066"][i]; this.put(cyl, this.std("#F2E6D0"), mx, -2, mz, h * 0.1, h, h * 0.1); this.put(dome, this.glowMat(c, 0.6), mx, h - 2, mz, h * 0.45, h * 0.28, h * 0.45); this.halo(c, mx, h, mz, h, 0.35); }
        break;
      }
      case "tower": { // clock towers and turning gears
        const h = 60 + r() * 60;
        this.put(box, this.std("#6A5A3A", { roughness: 0.8 }), x, -2, z, 14, h, 14);
        this.put(cone, this.std("#3A2A1A"), x, h - 2, z, 11, 14, 11);
        this.halo("#FFE0A0", x, h * 0.75, z - 7.2, 10, 0.7);
        const gear = new THREE.Group(); gear.position.set(x + 14, h * 0.5, z); this.into.add(gear);
        const gm = new THREE.Mesh(this.Gm("gear", () => gearGeo()), this.std("#C9A04A", { metalness: 0.7, roughness: 0.3 })); gm.scale.setScalar(10); gear.add(gm);
        gear.userData.dyn = true; this.spinners.push({ o: gear, axis: "z", speed: 0.2 });
        break;
      }
      case "highway": { // rainbow arcs and glowing pylons in a night sky
        const arc = new THREE.Group(); arc.position.set(x, -20, z); arc.rotation.y = r() * 3; this.into.add(arc);
        ["#FF5A7A", "#FFB347", "#FFE066", "#5CF2C9", "#5AA0FF", "#B98CFF"].forEach((c, i) => { const m = new THREE.Mesh(this.Gm("halfRing", () => new THREE.TorusGeometry(1, 0.03, 6, 40, Math.PI)), this.glowMat(c, 0.9)); m.scale.setScalar(60 * S - i * 2); arc.add(m); });
        for (let i = 0; i < 3; i++) this.put(cyl, this.glowMat("#7FE8FF", 1), x + (r() - 0.5) * 50, -20, z + (r() - 0.5) * 50, 0.8, 40 + r() * 30, 0.8);
        break;
      }
      case "moors": { // crooked trees, standing stones, lanterns in the fog
        for (let i = 0; i < 4; i++) { const tx = x + (r() - 0.5) * 50, tz = z + (r() - 0.5) * 50, h = 8 + r() * 10; const t = this.put(cyl, this.std("#2A2626"), tx, -2, tz, 0.5, h, 0.5); t.rotation.z = (r() - 0.5) * 0.5; for (let b = 0; b < 3; b++) { const br = this.put(cyl, this.std("#2A2626"), tx, h * (0.5 + b * 0.15), tz, 0.2, 4, 0.2); br.rotation.z = (b % 2 ? 1 : -1) * 0.9; } }
        for (let i = 0; i < 3; i++) this.put(box, this.std("#4A4A44", { flatShading: true }), x + (r() - 0.5) * 30, -2, z + (r() - 0.5) * 30, 2.4, 5 + r() * 4, 1, r() * 3);
        this.halo("#CFE8FF", x, 4, z, 10, 0.35);
        break;
      }
      case "space": { // planets with rings, asteroids, station spokes
        if (k === 1) { const y = 80 + r() * 160; const p = this.put(sph, this.std(["#B98CFF", "#FFB347", "#5AA0FF"][Math.floor(r() * 3)], { roughness: 0.8 }), x * 1.6, y, z * 1.6, 40 + r() * 50, 40 + r() * 50, 40 + r() * 50); const ring = new THREE.Mesh(torus, this.glowMat("#FFE0A0", 0.4)); ring.scale.setScalar(p.scale.x * 1.7); ring.rotation.x = 1.2; ring.position.copy(p.position); this.into.add(ring); }
        else for (let i = 0; i < 5; i++) this.put(ico, this.std("#5A5A7A", { flatShading: true }), x + (r() - 0.5) * 60, -10 + r() * 50, z + (r() - 0.5) * 60, 3 + r() * 6, 3 + r() * 5, 3 + r() * 6);
        break;
      }
      case "grid": { // glowing wireframe pyramids and cubes
        const edges = this.Gm("pyrEdges", () => new THREE.EdgesGeometry(new THREE.ConeGeometry(1, 1.4, 4).translate(0, 0.7, 0)));
        const cube = this.Gm("cubeEdges", () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)));
        const lm = this.M("gridLine", () => new THREE.LineBasicMaterial({ color: L.light }));
        for (let i = 0; i < 3; i++) { const l = new THREE.LineSegments(i % 2 ? cube : edges, lm); l.position.set(x + (r() - 0.5) * 40, -10, z + (r() - 0.5) * 40); l.scale.setScalar(16 + r() * 30); this.into.add(l); }
        break;
      }
      case "peaks": { // blossom mountains, pagodas, pink trees
        const R = 40 * S, H = 70 + r() * 70;
        this.put(cone, this.std(L.rock, { flatShading: true }), x, -4, z, R, H, R);
        this.put(cone, this.std("#FFFFFF", { flatShading: true }), x, -4 + H * 0.6, z, R * 0.4, H * 0.4, R * 0.4);
        if (r() < 0.5) { for (let i = 0; i < 3; i++) { this.put(box, this.std("#C8352A"), x + R * 0.8, -2 + i * 6, z, 10 - i * 2, 5, 10 - i * 2); this.put(cone, this.std("#3A2A2A"), x + R * 0.8, 3 + i * 6, z, 8 - i * 1.6, 2.4, 8 - i * 1.6); } }
        for (let i = 0; i < 4; i++) { const tx = x + (r() - 0.5) * R * 2, tz = z + (r() - 0.5) * R * 2; this.put(cyl, this.std("#5A3E2A"), tx, -2, tz, 0.5, 6, 0.5); this.put(sph, this.std("#FFB0CF"), tx, 7, tz, 4, 3, 4); }
        break;
      }
      case "fortress": { // dark towers, red lights, storm clouds
        for (let i = 0; i < 3; i++) { const tx = x + (r() - 0.5) * 40, tz = z + (r() - 0.5) * 40, h = 40 + r() * 60; this.put(cyl, this.std("#4A4F5E", { metalness: 0.5, roughness: 0.5 }), tx, -10, tz, 6, h, 6); this.put(cone, this.std("#2A1F26"), tx, h - 10, tz, 8, 10, 8); this.halo("#FF5A3A", tx, h - 4, tz, 10, 0.7); }
        this.put(sph, this.std("#2A1F26", { roughness: 1 }), x, 90 + r() * 30, z, 50, 12, 40);
        break;
      }
      default: this.put(dome, this.std(L.grass), x, -2, z, 40, 16, 40);
    }
  }

  private palm(x: number, y: number, z: number, h: number) {
    const K = this.kit!;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const bend = (rnd() - 0.5) * 0.5;
    for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(K.palmSeg, K.trunk); seg.scale.set(1, h / 6, 1); seg.position.set(Math.sin(bend) * i * i * 0.08, (i + 0.5) * (h / 6), 0); g.add(seg); }
    const crown = new THREE.Group(); crown.position.set(Math.sin(bend) * 36 * 0.08, h, 0); g.add(crown);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(K.frond, K.tree); f.rotation.set(0.5 + rnd() * 0.3, (i / 7) * Math.PI * 2, 0); crown.add(f); }
    this.into.add(g);
  }
  private tree(x: number, y: number, z: number, h: number) {
    const K = this.kit!;
    const t = new THREE.Mesh(K.trunkGeo, K.trunk); t.scale.set(1, h * 0.5, 1); t.position.set(x, y + h * 0.25, z); this.into.add(t);
    const c = new THREE.Mesh(K.crownGeo, K.tree); c.scale.setScalar(h * 0.42); c.position.set(x, y + h * 0.7, z); this.into.add(c);
  }
  private castle(x: number, y: number, z: number) {
    const K = this.kit!;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const towers: [number, number, number, number][] = [[0, 0, 7, 34], [-14, 6, 5, 24], [13, 4, 5, 26], [-6, -10, 4, 20], [8, -9, 4.5, 22]];
    for (const [tx, tz, r, h] of towers) {
      const t = new THREE.Mesh(this.g(new THREE.CylinderGeometry(r, r * 1.08, h, 14)), K.wall); t.position.set(tx, h / 2, tz); g.add(t);
      const cone = new THREE.Mesh(this.g(new THREE.ConeGeometry(r * 1.25, h * 0.45, 14)), K.roof); cone.position.set(tx, h + h * 0.22, tz); g.add(cone);
      for (let w = 0; w < 6; w++) { const wnd = new THREE.Mesh(K.winGeo, K.win); const a = (w / 6) * Math.PI * 2; wnd.position.set(tx + Math.cos(a) * (r + 0.05), h * (0.45 + (w % 3) * 0.15), tz + Math.sin(a) * (r + 0.05)); wnd.lookAt(tx + Math.cos(a) * 10, wnd.position.y, tz + Math.sin(a) * 10); g.add(wnd); }
    }
    const keep = new THREE.Mesh(this.g(new THREE.BoxGeometry(24, 12, 16)), K.wall); keep.position.set(0, 6, 0); g.add(keep);
    const glowS = new THREE.Sprite(K.castleGlow);
    glowS.position.set(0, 16, 0); glowS.scale.set(90, 60, 1); g.add(glowS); this.lit.push(glowS);
    g.scale.setScalar(1.3);
    this.into.add(g);
  }
  private lighthouse(x: number, y: number, z: number) {
    const K = this.kit!;
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(this.g(new THREE.CylinderGeometry(2.6 - i * 0.3, 2.9 - i * 0.3, 5, 14)), i % 2 ? K.red : K.wall); b.position.y = 2.5 + i * 5; g.add(b); }
    const lamp = new THREE.Mesh(this.g(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 12)), K.lamp); lamp.position.y = 21.2; g.add(lamp);
    const cap = new THREE.Mesh(this.g(new THREE.ConeGeometry(2.4, 2.6, 12)), K.roof); cap.position.y = 23.7; g.add(cap);
    const beam = new THREE.Group(); beam.position.y = 21.2; g.add(beam);
    const cone = new THREE.Mesh(this.g(new THREE.ConeGeometry(14, 120, 16, 1, true)), K.beam);
    cone.rotation.z = Math.PI / 2; cone.position.x = 60; beam.add(cone);
    beam.userData.dyn = true; this.spinners.push({ o: beam, axis: "y", speed: 0.6 }); this.beams.push(beam);
    const halo = new THREE.Sprite(K.halo);
    halo.position.y = 21.2; halo.scale.set(16, 16, 1); g.add(halo);
    this.into.add(g);
  }
  private windmill(x: number, y: number, z: number) {
    const K = this.kit!;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const tower = new THREE.Mesh(this.g(new THREE.CylinderGeometry(2.2, 3.4, 14, 10)), K.wall); tower.position.y = 7; g.add(tower);
    const cap = new THREE.Mesh(this.g(new THREE.ConeGeometry(3, 4, 10)), K.roof); cap.position.y = 16; g.add(cap);
    const hub = new THREE.Group(); hub.position.set(0, 13, 3.2); g.add(hub);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(K.plane, K.sail); b.scale.set(1.8, 9, 1); b.position.y = 4.5; const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(b); hub.add(arm); }
    hub.userData.dyn = true; this.spinners.push({ o: hub, axis: "z", speed: 0.7 + rnd() * 0.5 });
    g.rotation.y = rnd() * 6;
    this.into.add(g);
  }

  /** gentle motion every frame; the sky, sea and fireflies follow the camera */
  frame(dt: number, cam: THREE.Camera) {
    this.t += dt;
    const p = cam.position;
    this.sky.position.copy(p);
    if (this.stars) { this.stars.position.copy(p); (this.stars.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(this.t * 1.3) * 0.15; }
    if (this.sea && this.seaMat) {
      this.sea.position.x = Math.round(p.x / 50) * 50; this.sea.position.z = Math.round(p.z / 50) * 50;
      this.seaMat.uniforms.time.value = this.t; (this.seaMat.uniforms.cam.value as THREE.Vector3).copy(p);
    }
    for (const c of this.clouds) { c.position.x += dt * 3; if (c.position.x - p.x > 1300) c.position.x -= 2600; }
    for (const sp of this.spinners) sp.o.rotation[sp.axis] += sp.speed * dt;
    for (const l of this.lit) (l.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(this.t * 2.1) * 0.05;
    // fireflies / petals drift around the camera
    const pos = this.flies.geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array, b = this.flyBase;
    for (let i = 0; i < a.length; i += 3) {
      const k = i * 0.37;
      a[i] = p.x + b[i] + Math.sin(this.t * 0.7 + k) * 1.5;
      a[i + 1] = p.y + b[i + 1] + Math.sin(this.t * 1.1 + k * 1.3) * 0.8 - (this.look.night ? 0 : ((this.t * 0.6 + k) % 10));
      a[i + 2] = p.z + b[i + 2] + Math.cos(this.t * 0.6 + k) * 1.5;
    }
    pos.needsUpdate = true;
  }

  dispose() {
    while (this.stretches.length) this.dropStretch(this.stretches.pop()!);
    for (const g of this.geos) g.dispose(); for (const m of this.mats) m.dispose();
  }
}

/** horizontal bands (candy mesas), vertical stripes (tents), a lollipop swirl, lit windows, a gear */
function stripesH(a: string, b: string) { return canvasTex(`sH:${a}:${b}`, 64, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) { g.fillStyle = (y / 32) % 2 ? b : a; g.fillRect(0, y, w, 32); } }); }
function stripesV(a: string, b: string) { return canvasTex(`sV:${a}:${b}`, 256, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? b : a; g.fillRect(x, 0, 32, h); } }); }
function swirl(a: string) { return canvasTex(`sw:${a}`, 128, 128, (g, w, h) => { g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.strokeStyle = a; g.lineWidth = 9; g.beginPath(); for (let t = 0; t < 30; t += 0.1) { const r = t * 2.1; g.lineTo(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } g.stroke(); }); }
function windows(c: string, em = false) { return canvasTex(`win:${c}:${em}`, 128, 256, (g, w, h) => { g.fillStyle = em ? "#000000" : "#1A1830"; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 16) { if (rnd() < 0.45) continue; g.fillStyle = em ? c : "#FFE9A8"; g.fillRect(x, y, 8, 9); } }); }
const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = texCache.get(key); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(key, t); return t;
}
function gearGeo() {
  const sh = new THREE.Shape(), n = 12;
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 0.82 : 1; sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.3, 0, Math.PI * 2, true); sh.holes.push(hole);
  return new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09);
}
function leafGeo() {
  // a long drooping palm frond
  const g = new THREE.PlaneGeometry(1.4, 6, 1, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 3; p.setY(i, y); p.setZ(i, -y * y * 0.06); p.setX(i, p.getX(i) * (1 - y / 7)); }
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}
let cloudTexCache: THREE.Texture | null = null;
function cloud() {
  if (cloudTexCache) return cloudTexCache;
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 22; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 20 + Math.random() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  cloudTexCache = new THREE.CanvasTexture(c); cloudTexCache.colorSpace = THREE.SRGBColorSpace;
  return cloudTexCache;
}
