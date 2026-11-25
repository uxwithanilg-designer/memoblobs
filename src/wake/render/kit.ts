// The modelling kit for Wake Racers' 3D world: every model (land, props, boats, hazards) is built in code from
// primitives merged into one geometry with per-vertex colours, so a whole kind of prop is one instanced draw call.
// Vertex colour alpha carries a glow: up to 0.5 glows only at night (windows, lamps, lanterns), above 0.5 always
// (lava, crystals, neon), injected into the shared materials. Flat-shaded Lambert for the world (crisp facets, cheap
// on phones), glossy Phong for the boats.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rgb, srgbToLinear } from "../util";

export type V3 = [number, number, number];
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();

/** colour a geometry (rgba, alpha = glow) and move it into place; returns it ready to merge */
export function part(g: THREE.BufferGeometry, color: string, o: { p?: V3; r?: V3; s?: V3 | number; glow?: number } = {}) {
  const geo = g.index ? g : g;
  geo.deleteAttribute("uv");
  if (o.p || o.r || o.s !== undefined) {
    E.set(...(o.r ?? [0, 0, 0]));
    Q.setFromEuler(E);
    const sc = o.s === undefined ? 1 : o.s;
    if (typeof sc === "number") S.set(sc, sc, sc); else S.set(...sc);
    P.set(...(o.p ?? [0, 0, 0]));
    M.compose(P, Q, S);
    geo.applyMatrix4(M);
  }
  const n = geo.getAttribute("position").count;
  const col = new Float32Array(n * 4);
  const [r, gg, b] = rgb(color);
  const lr = srgbToLinear(r / 255), lg = srgbToLinear(gg / 255), lb = srgbToLinear(b / 255), a = o.glow ?? 0;
  for (let i = 0; i < n; i++) { col[i * 4] = lr; col[i * 4 + 1] = lg; col[i * 4 + 2] = lb; col[i * 4 + 3] = a; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
  return geo.index ? geo : geo;
}

/** merge parts into one geometry (all made indexed first so they merge) */
export function merge(parts: THREE.BufferGeometry[]) {
  const list = parts.map((g) => {
    if (!g.index) {
      const n = g.getAttribute("position").count, idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    return g;
  });
  const out = mergeGeometries(list, false)!;
  for (const g of list) g.dispose();
  out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------------ primitives
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
export const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg, 1);
export const ball = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
export const sphere = (r: number, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
export const torus = (r: number, t: number, rs = 6, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const lathe = (pts: [number, number][], seg = 10) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
/** a lumpy rock: an icosahedron with seeded jitter */
export function rock(r: number, seed: number, detail = 1, squash = 0.75) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) + Math.sin(y * 4.3 + seed * 0.7)) * 0.12;
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  g.computeVertexNormals();
  return g;
}
/** an extruded 2D outline (x, y) of depth d, centred on z */
export function extrude(pts: [number, number][], d: number, bevel = 0) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return g;
}

// ------------------------------------------------------------------ materials
export interface GlowUniforms { uGlowNight: { value: number }; uGlowAlways: { value: number } }
export const glowUniforms: GlowUniforms = { uGlowNight: { value: 0 }, uGlowAlways: { value: 1.6 } };

function injectGlow(mat: THREE.Material) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlowNight = glowUniforms.uGlowNight;
    sh.uniforms.uGlowAlways = glowUniforms.uGlowAlways;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlowNight; uniform float uGlowAlways;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      #if defined( USE_COLOR_ALPHA )
        float gA = vColor.a;
        float gK = gA > 0.5 ? (gA - 0.5) * 2.0 * uGlowAlways : gA * 2.0 * uGlowNight;
        totalEmissiveRadiance += vColor.rgb * gK;
        diffuseColor.a = 1.0;
      #endif`);
  };
  mat.customProgramCacheKey = () => "wake-glow";
}

/** the world's material: flat-shaded, vertex coloured, glowing where the colours say so */
export function worldMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  injectGlow(m);
  return m;
}
/** smooth version (round things: hulls of moored boats, mushrooms, balloons) */
export function smoothMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  injectGlow(m);
  return m;
}
/** the boats: glossy paint */
export function boatMaterial() {
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: new THREE.Color(0.35, 0.35, 0.35), side: THREE.DoubleSide });
  injectGlow(m);
  return m;
}

// ------------------------------------------------------------------ soft round sprites (glows, puffs)
let dotTex: THREE.Texture | null = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.max(0, 1 - r); const k = (y * n + x) * 4;
    data[k] = 255; data[k + 1] = 255; data[k + 2] = 255; data[k + 3] = Math.round(255 * a * a);
  }
  dotTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  dotTex.needsUpdate = true;
  return dotTex;
}

/** a reusable dummy for instance matrices (never allocate per frame) */
export const dummy = new THREE.Object3D();
export function setInstance(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, s: number, rx = 0, rz = 0) {
  dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.setScalar(s); dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix);
}
export function hide(m: THREE.InstancedMesh, i: number) {
  dummy.position.set(0, -9999, 0); dummy.scale.setScalar(0.0001); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
}
