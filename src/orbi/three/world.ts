// The world round the road: a gradient sky with a sun (or stars), an endless sea of clouds below, puffs of cloud
// drifting by, and floating islands all along the course dressed in the world's own scenery — meadow trees and
// windmills, lollipops, palms, toy blocks, bamboo, crystals, neon, pines, pyramids, volcanoes, ruins, masts, gears,
// haunted trees, glowing mushrooms, coral, tesla towers, chimneys, rainbow arches, craters, ringed planets, cyber cubes,
// pagodas, circus tents and fortress towers. All islands and props are merged into two draw calls (lit + glowing).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { World } from "../data/worlds";
import type { Track } from "../track";
import { cloudFloorTex, glowTex, puffTex } from "./tex";

type Part = { g: THREE.BufferGeometry; c: string; glow?: boolean };
const rnd = (seed: number) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };

function painted(g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) {
  const ng = (g.index ? g.toNonIndexed() : g.clone());
  ng.applyMatrix4(m);
  for (const k of Object.keys(ng.attributes)) if (k !== "position" && k !== "normal") ng.deleteAttribute(k);
  if (!ng.attributes.normal) ng.computeVertexNormals();
  const c = new THREE.Color(color), n = ng.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  ng.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return ng;
}
const M = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 10), cone4: new THREE.ConeGeometry(1, 1, 4),
  sph: new THREE.SphereGeometry(1, 12, 9), ico: new THREE.IcosahedronGeometry(1, 0), oct: new THREE.OctahedronGeometry(1, 0), tor: new THREE.TorusGeometry(1, 0.22, 8, 24),
  half: new THREE.TorusGeometry(1, 0.12, 6, 20, Math.PI),
};

/** one scenery prop of the world's kind, at local (x, y, z) on an island top, size k */
function prop(kind: World["scenery"], r: () => number, x: number, y: number, z: number, k: number, pal: World["pal"], out: Part[]) {
  const P = (g: THREE.BufferGeometry, c: string, m: THREE.Matrix4, glow = false) => out.push({ g: painted(g, c, m), c, glow });
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (kind) {
    case "meadow": if (r() < 0.25) { P(G.cyl, "#F4F4F4", M(x, y + 3 * k, z, 0.4 * k, 6 * k, 0.4 * k)); for (let i = 0; i < 4; i++) P(G.box, "#E8344A", M(x, y + 6 * k, z + 0.3 * k, 0.35 * k, 3 * k, 0.1 * k, 0, 0, (i * Math.PI) / 2 + 0.3)); }
      else { P(G.cyl, "#8A5A34", M(x, y + 1 * k, z, 0.22 * k, 2 * k, 0.22 * k)); P(G.sph, pick(["#5DBB4A", "#4CAA44", "#7ACC5A"]), M(x, y + 2.6 * k, z, 1.2 * k)); P(G.sph, "#6CCB5A", M(x + 0.5 * k, y + 3.3 * k, z, 0.8 * k)); } break;
    case "candy": if (r() < 0.5) { P(G.cyl, "#FFFFFF", M(x, y + 1.6 * k, z, 0.12 * k, 3.2 * k, 0.12 * k)); P(G.cyl, pick(["#FF5AA8", "#7AD8FF", "#FFD23A"]), M(x, y + 3.6 * k, z, 1.1 * k, 0.3 * k, 1.1 * k, 0, Math.PI / 2)); P(G.tor, "#FFFFFF", M(x, y + 3.6 * k, z + 0.1 * k, 0.75 * k, 0.75 * k, 0.75 * k)); }
      else P(G.cone, pick(["#FF8AC8", "#9AF2C8", "#FFE08A", "#C8A8FF"]), M(x, y + 0.9 * k, z, 1.1 * k, 1.8 * k)); break;
    case "lagoon": for (let i = 0; i < 4; i++) P(G.cyl, "#B88A54", M(x + i * 0.25 * k, y + (0.8 + i * 1.4) * k, z, 0.22 * k, 1.5 * k, 0.22 * k, 0, 0, -0.12 * i));
      for (let i = 0; i < 6; i++) P(G.cone, "#3EAA4A", M(x + 1 * k, y + 6 * k, z, 0.35 * k, 2.4 * k, 0.12 * k, (i * Math.PI) / 3, 0, 1.2)); break;
    case "toys": for (let i = 0; i < 3; i++) P(G.box, pick(["#E8344A", "#3A8BF0", "#FFD23A", "#4CC46A"]), M(x + (r() - 0.5) * 0.5 * k, y + (0.6 + i * 1.2) * k, z, 1.2 * k, 1.2 * k, 1.2 * k, r() * 0.6)); break;
    case "bamboo": for (let i = 0; i < 5; i++) P(G.cyl, "#7ABF4A", M(x + (r() - 0.5) * 2 * k, y + 3 * k, z + (r() - 0.5) * 2 * k, 0.14 * k, 6 * k, 0.14 * k, 0, (r() - 0.5) * 0.2)); if (r() < 0.5) P(G.sph, "#FF4A3A", M(x, y + 2 * k, z + k, 0.45 * k), true); break;
    case "crystal": for (let i = 0; i < 4; i++) P(G.oct, pick(["#5CF2E0", "#B88CFF", "#7CC8FF"]), M(x + (r() - 0.5) * 2 * k, y + 1.2 * k, z + (r() - 0.5) * 2 * k, 0.5 * k, (1.5 + r() * 1.5) * k, 0.5 * k, r(), (r() - 0.5) * 0.5), true); break;
    case "arcade": P(G.box, pick(["#FF2EC8", "#2EF2FF", "#FFE14D"]), M(x, y + 3 * k, z, 0.3 * k, 6 * k, 0.3 * k), true); P(G.box, "#1A1430", M(x + 1.4 * k, y + 1.2 * k, z, 1.2 * k, 2.4 * k, 1 * k)); P(G.box, "#2EF2FF", M(x + 1.4 * k, y + 1.7 * k, z + 0.51 * k, 0.9 * k, 0.7 * k, 0.02 * k), true); break;
    case "frost": if (r() < 0.6) for (let i = 0; i < 3; i++) P(G.cone, i === 2 ? "#F4FBFF" : "#2E7A5A", M(x, y + (1.2 + i * 1.1) * k, z, (1.5 - i * 0.4) * k, 1.8 * k)); else P(G.cone, "#BFEFFF", M(x, y + 1.6 * k, z, 0.5 * k, 3.2 * k)); break;
    case "desert": if (r() < 0.4) P(G.cone4, "#E8C27A", M(x, y + 2 * k, z, 2.6 * k, 4 * k, 2.6 * k, Math.PI / 4)); else { P(G.cyl, "#4C9A4A", M(x, y + 1.5 * k, z, 0.3 * k, 3 * k, 0.3 * k)); P(G.cyl, "#4C9A4A", M(x + 0.5 * k, y + 2 * k, z, 0.2 * k, 1 * k, 0.2 * k)); } break;
    case "volcano": P(G.cone, "#2A2224", M(x, y + 2 * k, z, 2.2 * k, 4 * k)); P(G.sph, "#FF6A1A", M(x, y + 4 * k, z, 0.6 * k), true); break;
    case "jungle": if (r() < 0.5) { P(G.cyl, "#6A4A2A", M(x, y + 2 * k, z, 0.35 * k, 4 * k, 0.35 * k)); P(G.sph, "#2E8A3A", M(x, y + 4.4 * k, z, 1.8 * k, 1.2 * k, 1.8 * k)); } else { P(G.box, "#8A9A7A", M(x, y + 1 * k, z, 1.6 * k, 2 * k, 1.6 * k)); P(G.box, "#7A8A6A", M(x, y + 2.3 * k, z, 1.2 * k, 0.6 * k, 1.2 * k)); } break;
    case "pirate": P(G.cyl, "#6A4A2A", M(x, y + 3 * k, z, 0.18 * k, 6 * k, 0.18 * k)); P(G.box, "#F6E8D0", M(x, y + 3.6 * k, z + 0.3 * k, 2.2 * k, 2.4 * k, 0.08 * k)); P(G.cyl, "#8A5A34", M(x + 1.5 * k, y + 0.5 * k, z, 0.5 * k, 1 * k, 0.5 * k)); break;
    case "clock": P(G.tor, "#C8A050", M(x, y + 2 * k, z, 1.3 * k, 1.3 * k, 1.6 * k, r())); P(G.cyl, "#8A7A6A", M(x, y + 1 * k, z, 0.2 * k, 2 * k, 0.2 * k)); break;
    case "haunted": P(G.cyl, "#3A3444", M(x, y + 1.5 * k, z, 0.15 * k, 3 * k, 0.15 * k, 0, 0, 0.1)); P(G.cyl, "#3A3444", M(x + 0.5 * k, y + 2.4 * k, z, 0.08 * k, 1.4 * k, 0.08 * k, 0, 0, -0.8)); P(G.sph, "#9AFF7A", M(x - 0.8 * k, y + 0.8 * k, z, 0.3 * k), true); P(G.box, "#6A6A7A", M(x + 1 * k, y + 0.5 * k, z + 1 * k, 0.6 * k, 1 * k, 0.15 * k)); break;
    case "shroom": P(G.cyl, "#F4E8D8", M(x, y + 1 * k, z, 0.3 * k, 2 * k, 0.3 * k)); P(G.sph, pick(["#FF7CF0", "#7CF2C8", "#FFB04A"]), M(x, y + 2.1 * k, z, 1.4 * k, 0.7 * k, 1.4 * k), true); break;
    case "sea": for (let i = 0; i < 3; i++) P(G.cyl, pick(["#FF7A6A", "#FFB04A", "#FF5AB8"]), M(x + (r() - 0.5) * 1.5 * k, y + 1 * k, z + (r() - 0.5) * 1.5 * k, 0.2 * k, (1.5 + r() * 2) * k, 0.2 * k, 0, (r() - 0.5) * 0.6)); P(G.sph, "#9FE8FF", M(x, y + 3.5 * k, z, 0.3 * k), true); break;
    case "thunder": P(G.cyl, "#5A6070", M(x, y + 2.5 * k, z, 0.25 * k, 5 * k, 0.25 * k)); P(G.sph, "#FFE04A", M(x, y + 5.2 * k, z, 0.5 * k), true); P(G.tor, "#8A93A8", M(x, y + 3.5 * k, z, 0.7 * k, 0.7 * k, 0.7 * k, 0, Math.PI / 2)); break;
    case "factory": P(G.cyl, "#6A7078", M(x, y + 2.5 * k, z, 0.5 * k, 5 * k, 0.5 * k)); P(G.cyl, "#FFC600", M(x, y + 4.6 * k, z, 0.55 * k, 0.4 * k, 0.55 * k)); P(G.box, "#4A5058", M(x + 1.5 * k, y + 0.8 * k, z, 1.8 * k, 1.6 * k, 1.4 * k)); break;
    case "rainbow": { const c = ["#FF5A7A", "#FFB04A", "#FFE14D", "#5CF2C9", "#5AA8FF", "#B88CFF"]; for (let i = 0; i < 6; i++) P(G.half, c[i], M(x, y, z, (3 - i * 0.3) * k, (3 - i * 0.3) * k, (3 - i * 0.3) * k), true); break; }
    case "moon": P(G.sph, "#A0A0AA", M(x, y, z, 1.6 * k, 0.6 * k, 1.6 * k)); P(G.cyl, "#D8DEE8", M(x + 1.5 * k, y + 1 * k, z, 0.1 * k, 2 * k, 0.1 * k)); P(G.sph, "#D8DEE8", M(x + 1.5 * k, y + 2.2 * k, z, 0.6 * k, 0.25 * k, 0.6 * k)); break;
    case "orbit": P(G.sph, pick(["#E8B07A", "#7AB8E8", "#C88AE8"]), M(x, y + 2 * k, z, 1.4 * k)); P(G.tor, "#FFE0B0", M(x, y + 2 * k, z, 2.2 * k, 2.2 * k, 0.6 * k, 0, Math.PI / 2.4)); break;
    case "cyber": for (let i = 0; i < 3; i++) P(G.box, i % 2 ? "#2EF2FF" : "#FF2EC8", M(x + (r() - 0.5) * 2 * k, y + (0.5 + r() * 2) * k, z + (r() - 0.5) * 2 * k, 0.7 * k, 0.7 * k, 0.7 * k, r()), true); break;
    case "dragon": if (r() < 0.5) { for (let i = 0; i < 3; i++) { P(G.box, "#C8202A", M(x, y + (0.6 + i * 1.3) * k, z, (1.6 - i * 0.3) * k, 1 * k, (1.6 - i * 0.3) * k)); P(G.cone4, "#2A2A2A", M(x, y + (1.25 + i * 1.3) * k, z, (1.5 - i * 0.3) * 1.3 * k, 0.5 * k, (1.5 - i * 0.3) * 1.3 * k, Math.PI / 4)); } }
      else { P(G.cyl, "#5A3A2A", M(x, y + 1.2 * k, z, 0.2 * k, 2.4 * k, 0.2 * k)); P(G.sph, "#FFB0D0", M(x, y + 2.8 * k, z, 1.5 * k, 1 * k, 1.5 * k)); } break;
    case "carnival": if (r() < 0.6) { P(G.cone, pick(["#FF3D3D", "#FFD23A", "#5AA8FF"]), M(x, y + 1.6 * k, z, 1.8 * k, 2 * k)); P(G.cyl, "#FFFFFF", M(x, y + 0.5 * k, z, 1.7 * k, 1 * k, 1.7 * k)); } else P(G.tor, "#FFD23A", M(x, y + 3.2 * k, z, 3 * k, 3 * k, 3 * k), true); break;
    case "fortress": P(G.cyl, "#4A4A58", M(x, y + 2.5 * k, z, 0.9 * k, 5 * k, 0.9 * k)); P(G.cone, "#C8202A", M(x, y + 5.6 * k, z, 1.1 * k, 1.4 * k)); P(G.sph, "#FF3D3D", M(x + 0.9 * k, y + 3 * k, z, 0.2 * k), true); break;
  }
  void pal;
}

/** metres of road per scenery chunk */
const WCH = 500;
export class WorldScene {
  readonly group = new THREE.Group();
  floorY = -40;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** the sun and the stars ride along with the sky */
  private skyBits = new THREE.Group();
  private sky: THREE.Mesh;
  constructor(readonly world: World, tr: Track, seed: number, quality: "low" | "medium" | "high") {
    const W = world, pal = W.pal;
    const r = rnd(seed);
    // ---- the height of things: the cloud sea sits well under the lowest road
    let minY = Infinity; for (let i = 0; i < tr.n; i += 4) minY = Math.min(minY, tr.pos[i * 3 + 1]);
    this.floorY = minY - 55;
    // ---- sky dome
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(pal.top) }, hor: { value: new THREE.Color(pal.horizon) }, low: { value: new THREE.Color(pal.cloud) } },
      vertexShader: "varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 hor; uniform vec3 low; varying vec3 vp; void main(){ float y = vp.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0),0.55)) : mix(hor, low, clamp(-y*3.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }",
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 16), skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.group.add(this.sky); this.mats.push(skyMat);
    // ---- sun / moon and stars
    const night = W.sky === "night" || W.sky === "space" || W.sky === "deep" || W.sky === "neon";
    const sunM = new THREE.SpriteMaterial({ map: glowTex(pal.light), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const sunS = new THREE.Sprite(sunM); sunS.scale.setScalar(night ? 220 : 380); sunS.position.set(-900, 700, -1400); this.skyBits.add(sunS); this.mats.push(sunM);
    this.group.add(this.skyBits);
    if (night || W.sky === "storm") {
      const n = 900, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = r() * Math.PI * 0.45; a[i * 3] = Math.cos(th) * Math.cos(ph) * 2200; a[i * 3 + 1] = Math.sin(ph) * 2200 + 100; a[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 2200; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3));
      const m = new THREE.PointsMaterial({ color: "#ffffff", size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false });
      const p = new THREE.Points(g, m); p.frustumCulled = false; this.skyBits.add(p); this.geos.push(g); this.mats.push(m);
    }
    // ---- lights
    this.hemi = new THREE.HemisphereLight(pal.top, pal.cloud, night ? 0.75 : 1.05);
    this.sun = new THREE.DirectionalLight(pal.light, night ? 1.1 : 1.9);
    this.sun.castShadow = quality !== "low";
    if (this.sun.castShadow) { const S = this.sun.shadow; S.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024); S.camera.left = -28; S.camera.right = 28; S.camera.top = 28; S.camera.bottom = -28; S.camera.near = 1; S.camera.far = 160; S.bias = -0.0006; S.normalBias = 0.04; }
    this.group.add(this.hemi, this.sun, this.sun.target);
    // ---- the cloud sea: it follows you, hanging under the road round you
    const ft = cloudFloorTex().clone(); ft.needsUpdate = true; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(24, 24);
    const fm = new THREE.MeshLambertMaterial({ map: ft, color: pal.cloud, transparent: false });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2), fm);
    this.floor.position.y = this.floorY; this.group.add(this.floor); this.geos.push(this.floor.geometry); this.mats.push(fm); this.floorTex = ft;
    // the lowest road in every 200 m (the cloud sea and the islands hang under the road near you)
    this.low = new Float32Array(Math.ceil(tr.len / 200) + 2).fill(1e9);
    for (let i = 0; i < tr.n; i += 4) { const k = Math.floor(i / 200); this.low[k] = Math.min(this.low[k], tr.pos[i * 3 + 1]); }
    // ---- puffs and islands are built in chunks along the road as you go (a long course has a lot of sky)
    this.tr = tr; this.seed = seed; this.step = quality === "low" ? 70 : 48;
    this.puffMats = [46, 90].map((size) => new THREE.PointsMaterial({ map: puffTex(), size, color: pal.cloud, transparent: true, depthWrite: false, opacity: 0.75 }));
    this.litMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.mats.push(...this.puffMats, this.litMat, this.glowMat);
  }

  private tr: Track; private seed: number; private step: number;
  private floor: THREE.Mesh; private floorTex: THREE.Texture; private low: Float32Array; private floorSet = false;
  private puffMats: THREE.PointsMaterial[]; private litMat: THREE.Material; private glowMat: THREE.Material;
  private chunks = new Map<number, { obj: THREE.Object3D[]; geos: THREE.BufferGeometry[] }>();
  private lowAt(s: number) { const k = Math.floor(s / 200); let lo = 1e9; for (let j = k - 3; j <= k + 3; j++) if (j >= 0 && j < this.low.length) lo = Math.min(lo, this.low[j]); return lo < 1e8 ? lo : 0; }

  /** the sky's puffs and floating islands for one stretch of road */
  private build(c: number) {
    const tr = this.tr, W = this.world, pal = W.pal, r = rnd(this.seed * 31 + c * 7919 + 1), P = new Float32Array(12);
    const s0 = c * WCH, s1 = Math.min(tr.len, s0 + WCH), obj: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [];
    this.chunks.set(c, { obj, geos });
    if (s0 >= tr.len || c < 0) return;
    for (const [count, band] of [[18, 0], [8, 1]] as const) {
      const a = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const s = s0 + r() * (s1 - s0); tr.frame(s, P);
        const side = r() < 0.5 ? -1 : 1, off = 80 + r() * 320;
        a[i * 3] = P[0] + P[9] * side * off; a[i * 3 + 1] = band ? this.lowAt(s) - 45 + r() * 40 : P[1] - 35 - r() * 70; a[i * 3 + 2] = P[2] + P[11] * side * off;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3));
      const pts = new THREE.Points(g, this.puffMats[band]); this.group.add(pts); obj.push(pts); geos.push(g);
    }
    const lit: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
    const i0 = Math.max(0, Math.floor(s0 - 300)), i1 = Math.min(tr.n - 1, Math.floor(s1 + 300));
    const near = (x: number, y: number, z: number, rad: number) => {
      for (let i = i0; i < i1; i += 6) { const dx = tr.pos[i * 3] - x, dy = tr.pos[i * 3 + 1] - y, dz = tr.pos[i * 3 + 2] - z; if (dx * dx + dy * dy * 0.3 + dz * dz < rad * rad) return true; }
      return false;
    };
    for (let s = s0 + 20 * r(); s < s1; s += this.step * (0.7 + r() * 0.6)) {
      tr.frame(s, P);
      for (const side of [-1, 1]) {
        if (r() < 0.25) continue;
        const R = 5 + r() * 11, off = tr.widthAt(s) / 2 + 16 + R + r() * 60, dy = -14 - r() * 38 + (r() < 0.2 ? 30 : 0);
        const x = P[0] + P[9] * side * off, y = P[1] + dy, z = P[2] + P[11] * side * off;
        if (near(x, y, z, R + 14)) continue;
        const parts: Part[] = [];
        const ry = r() * Math.PI;
        parts.push({ g: painted(G.cone, pal.rock, M(x, y - R * 0.75, z, R, R * 1.5, R, ry, Math.PI)), c: pal.rock });
        parts.push({ g: painted(G.cyl, pal.grass, M(x, y + 0.2, z, R * 1.02, 0.6, R * 1.02, ry)), c: pal.grass });
        parts.push({ g: painted(G.ico, pal.rock, M(x + R * 0.4, y - R * 1.4, z, R * 0.35, R * 0.5, R * 0.35, ry)), c: pal.rock });
        const props = 1 + Math.floor(R / 6);
        for (let k = 0; k < props; k++) { const a = r() * Math.PI * 2, d = r() * R * 0.6; prop(W.scenery, r, x + Math.cos(a) * d, y + 0.5, z + Math.sin(a) * d, 0.8 + r() * 0.7 + R * 0.05, pal, parts); }
        for (const p of parts) (p.glow ? glow : lit).push(p.g);
      }
    }
    for (const [list, mat] of [[lit, this.litMat], [glow, this.glowMat]] as const) {
      if (!list.length) continue;
      const g = mergeGeometries(list, false); for (const x of list) x.dispose();
      if (g) { const me = new THREE.Mesh(g, mat); this.group.add(me); obj.push(me); geos.push(g); }
    }
  }
  private drop(c: number) { const ch = this.chunks.get(c); if (!ch) return; for (const o of ch.obj) o.removeFromParent(); for (const g of ch.geos) g.dispose(); this.chunks.delete(c); }

  /** keep the sky, the sun's shadow box and the cloud sea round the player; build the scenery ahead, drop it behind */
  follow(p: THREE.Vector3, t: number, s = 0) {
    this.sky.position.copy(p); this.skyBits.position.copy(p);
    this.sun.position.set(p.x - 30, p.y + 60, p.z + 20); this.sun.target.position.copy(p);
    const fy = this.lowAt(s) - 55;
    this.floor.position.set(p.x, this.floorSet ? this.floor.position.y + (fy - this.floor.position.y) * 0.02 : fy, p.z); this.floorSet = true;
    this.floorTex.offset.set(p.x / (7000 / 24), -p.z / (7000 / 24));
    const c = Math.floor(s / WCH);
    for (const k of [...this.chunks.keys()]) if (k < c - 1 || k > c + 3) this.drop(k);
    for (let k = c - 1; k <= c + 3; k++) if (!this.chunks.has(k)) { this.build(k); break; }
    void t;
  }
  dispose() { for (const k of [...this.chunks.keys()]) this.drop(k); this.group.removeFromParent(); for (const g of this.geos) g.dispose(); for (const m of this.mats) m.dispose(); }
}
