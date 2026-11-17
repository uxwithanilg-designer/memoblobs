// Scenery prop library. Each prop is ONE merged, vertex-coloured geometry drawn with an InstancedMesh
// (one draw call per prop kind). A small shader patch adds: per-vertex tint masks (only foliage/paint takes the
// per-instance colour), per-vertex glow (lava, windows, lanterns — some only at night), wind sway, bobbing
// and atlas cells (billboards / facades pick a picture per instance).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GfxQuality } from "../types";
import type { ThemeLook } from "./themes";
import * as TX from "./textures";

export type Placement = "scatter" | "roadside" | "far" | "water" | "corner" | "rows" | "air" | "flat";

export interface PropBuild {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** instances per 1800 m of track at density 1 (quality scales this) */
  base: number;
  /** distance beyond the barrier where props may start, and how far out they spread */
  minGap: number; range: number; spread: number;
  scale: [number, number];
  faceTrack?: boolean;
  tint?: string[];
  stretchX?: boolean; stretchY?: boolean;
  shadow?: boolean;
  place?: Placement;
  /** footprint radius (m at scale 1) used to stop big props overlapping each other */
  radius?: number;
  /** height above the road for "air" props */
  air?: [number, number];
  /** 0..1: group into clumps (forests) instead of a uniform scatter */
  cluster?: number;
  /** atlas cells to choose from per instance */
  cells?: number;
  /** a part that rotates every frame (windmill sails, turbine blades, ferris wheels) */
  spin?: { geometry: THREE.BufferGeometry; pivot: [number, number, number]; axis: "x" | "y" | "z"; speed: number };
  /** sink into the ground a bit so props sit well on slopes */
  sink?: number;
  /** row spacing (m) for "rows" placement */
  rowGap?: number;
}

export interface PropCtx { night: boolean; look: ThemeLook; q: GfxQuality }

// ---------------------------------------------------------------- shared shader patch
export const PROP_UNIFORMS = { uTime: { value: 0 }, uNight: { value: 0 } };

interface MatOpts { sway?: number; bob?: number; map?: THREE.Texture | null; rough?: number; metal?: number; flat?: boolean; cells?: [number, number]; side?: THREE.Side; lambert?: boolean; env?: number }
export function propMat(o: MatOpts = {}) {
  const p = { vertexColors: true, map: o.map ?? null, flatShading: o.flat ?? false, side: o.side ?? THREE.FrontSide };
  const m: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial = o.lambert
    ? new THREE.MeshLambertMaterial(p)
    : new THREE.MeshStandardMaterial({ ...p, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, envMapIntensity: o.env ?? 0.6 });
  const sway = { value: o.sway ?? 0 }, bob = { value: o.bob ?? 0 }, cells = { value: new THREE.Vector2(...(o.cells ?? [1, 1])) };
  if (o.cells) m.defines = { ...(m.defines ?? {}), USE_CELLS: "" };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = PROP_UNIFORMS.uTime; sh.uniforms.uNight = PROP_UNIFORMS.uNight;
    sh.uniforms.uSway = sway; sh.uniforms.uBob = bob; sh.uniforms.uCells = cells;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aTint; attribute float aGlow; attribute float aAtlas;
uniform float uTime; uniform float uNight; uniform float uSway; uniform float uBob; uniform vec2 uCells;
#ifdef USE_CELLS
attribute float iCell;
#endif
varying float vGlow;`)
      .replace("#include <color_vertex>", `#if defined( USE_COLOR )
vColor = color;
#ifdef USE_INSTANCING_COLOR
vColor *= mix(vec3(1.0), instanceColor.rgb, aTint);
#endif
#endif
vGlow = aGlow > 0.0 ? aGlow : -aGlow * uNight;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
float wph = instanceMatrix[3].x * 0.11 + instanceMatrix[3].z * 0.07;
#else
float wph = 0.0;
#endif
float whh = max(position.y, 0.0);
transformed.x += sin(uTime * 1.4 + wph) * uSway * whh * whh * 0.004;
transformed.z += cos(uTime * 1.1 + wph * 1.3) * uSway * whh * whh * 0.003;
transformed.y += sin(uTime * 0.8 + wph) * uBob;`)
      .replace("#include <uv_vertex>", `#include <uv_vertex>
#if defined( USE_CELLS ) && defined( USE_MAP )
vMapUv = mix(vMapUv, (vMapUv + vec2(mod(iCell, uCells.x), floor(iCell / uCells.x))) / uCells, aAtlas);
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;");
  };
  m.customProgramCacheKey = () => `wprop:${o.cells ? 1 : 0}`;
  return m;
}

// ---------------------------------------------------------------- geometry helpers
/** colour a part: tint = how much the per-instance colour applies (0..1), glow > 0 always, glow < 0 only at night */
export function P(g: THREE.BufferGeometry, color: string, tint = 0, glow = 0, atlas = 0) {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
  const n = geo.attributes.position.count, c = new THREE.Color(color);
  const col = new Float32Array(n * 3), t = new Float32Array(n).fill(tint), gl = new Float32Array(n).fill(glow), at = new Float32Array(n).fill(atlas);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aTint", new THREE.BufferAttribute(t, 1));
  geo.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
  geo.setAttribute("aAtlas", new THREE.BufferAttribute(at, 1));
  if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}
export const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts); g.computeBoundingSphere(); return g; };
/** darken towards the ground (cheap ambient occlusion) */
function ao(g: THREE.BufferGeometry, y0: number, y1: number, min = 0.55) {
  const p = g.attributes.position, c = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); const k = min + (1 - min) * t; c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
  return g;
}
/** per-triangle brightness jitter for organic, faceted surfaces */
function jitter(g: THREE.BufferGeometry, amt: number, seed = 1) {
  const c = g.attributes.color as THREE.BufferAttribute; let s = seed;
  for (let i = 0; i < c.count; i += 3) { s = (s * 16807) % 2147483647; const k = 1 + ((s / 2147483647) - 0.5) * 2 * amt; for (let j = 0; j < 3 && i + j < c.count; j++) c.setXYZ(i + j, c.getX(i + j) * k, c.getY(i + j) * k, c.getZ(i + j) * k); }
  return g;
}
/** random displacement of vertices (rocks, blobs) — keeps shared corners together by hashing positions */
function lumpy(g: THREE.BufferGeometry, amt: number, seed = 3) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453, r = h - Math.floor(h);
    const k = 1 + (r - 0.5) * 2 * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  const nr = g.attributes.normal;
  if (nr) for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1; nr.setXYZ(i, x / l, y / l, z / l); }
  return g;
}
const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const Cy = (rt: number, rb: number, h: number, s = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const Co = (r: number, h: number, s = 8) => new THREE.ConeGeometry(r, h, s);
const Ic = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const Sp = (r: number, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
const Do = (r: number) => new THREE.DodecahedronGeometry(r, 0);
const Hemi = (r: number, w = 14, h = 6) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2);
/** a thin cylinder from a to b */
function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, s = 4) {
  const l = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
  return Cy(r, r, l, s).translate(0, l / 2, 0).applyQuaternion(q).translate(a.x, a.y, a.z);
}
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const To = (r: number, t: number, rs = 6, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const La = (pts: [number, number][], s = 10) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);

const vc = (ctx: PropCtx, o: MatOpts = {}) => propMat({ lambert: ctx.q === "low", ...o });

/** a drooping leaf/frond: flat strip bent downwards, pointing +X */
function frond(len: number, wid: number, droop: number, seg = 4) {
  const g = new THREE.PlaneGeometry(len, wid, seg, 1).rotateX(-Math.PI / 2).translate(len / 2, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = x / len; p.setY(i, -droop * t * t); p.setZ(i, p.getZ(i) * (1 - t * 0.85)); }
  g.computeVertexNormals();
  return g;
}
/** simple four-legged animal facing +Z */
function quadruped(body: [number, number, number], legH: number, neck: { len: number; ang: number; r: number }, head: [number, number, number], color: string, dark: string, extra: THREE.BufferGeometry[] = []) {
  const [bw, bh, bl] = body, parts: THREE.BufferGeometry[] = [];
  parts.push(P(B(bw, bh, bl).translate(0, legH + bh / 2, 0), color));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(P(Cy(bw * 0.12, bw * 0.1, legH, 5).translate(sx * bw * 0.32, legH / 2, sz * bl * 0.38), dark));
  const nk = Cy(neck.r * 0.8, neck.r, neck.len, 6).translate(0, neck.len / 2, 0).rotateX(neck.ang).translate(0, legH + bh * 0.8, bl / 2 - neck.r);
  parts.push(P(nk, color));
  const top = new THREE.Vector3(0, neck.len, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), neck.ang).add(new THREE.Vector3(0, legH + bh * 0.8, bl / 2 - neck.r));
  parts.push(P(B(...head).translate(top.x, top.y, top.z + head[2] * 0.3), color));
  parts.push(P(Cy(0.04, 0.02, bh * 0.9, 4).rotateX(-0.5).translate(0, legH + bh * 0.6, -bl / 2 - 0.15), dark));
  return merge([...parts, ...extra]);
}
/** pitched-roof house; walls tinted, roof fixed colour */
function house(w: number, h: number, d: number, roof: string, opts: { wall?: string; roofH?: number; chimney?: boolean; windows?: string; lit?: boolean; door?: string; snow?: boolean; overhang?: number } = {}) {
  const parts: THREE.BufferGeometry[] = [];
  const rh = opts.roofH ?? h * 0.6, oh = opts.overhang ?? 0.4;
  parts.push(P(B(w, h, d).translate(0, h / 2, 0), opts.wall ?? "#ffffff", 1));
  const r = new THREE.CylinderGeometry(0.01, (w / 2 + oh) * Math.SQRT2, rh, 4, 1).rotateY(Math.PI / 4).scale(1, 1, (d + oh * 2) / (w + oh * 2)).translate(0, h + rh / 2, 0);
  parts.push(P(r, roof));
  if (opts.snow) parts.push(P(new THREE.CylinderGeometry(0.01, (w / 2 + oh) * Math.SQRT2 * 0.98, rh * 0.5, 4, 1).rotateY(Math.PI / 4).scale(1, 1, (d + oh * 2) / (w + oh * 2)).translate(0, h + rh * 0.78, 0), "#F4F8FF"));
  if (opts.chimney) parts.push(P(B(0.7, rh + 0.6, 0.7).translate(w * 0.25, h + rh / 2 + 0.4, d * 0.15), "#7A5A4A"));
  const win = opts.windows ?? "#8FB4D8", lit = opts.lit ?? false;
  for (const sz of [-1, 1]) for (let i = 0; i < Math.max(1, Math.floor(w / 3)); i++) {
    const x = -w / 2 + (i + 0.5) * (w / Math.max(1, Math.floor(w / 3)));
    if (sz > 0 && Math.abs(x) < 0.9 && opts.door !== undefined) continue;
    parts.push(P(B(0.9, 1.0, 0.08).translate(x, h * 0.6, sz * (d / 2 + 0.03)), win, 0, lit ? -1.6 : 0));
  }
  if (opts.door !== undefined) parts.push(P(B(1.1, 2, 0.1).translate(0, 1, d / 2 + 0.04), opts.door));
  return parts;
}
const stack = (...a: THREE.BufferGeometry[][]) => a.flat();

// ---------------------------------------------------------------- the library
type Builder = (ctx: PropCtx) => PropBuild;

export const PROP_BUILDERS: Record<string, Builder> = {
  // ===================================================== trees & plants
  tree: (ctx) => {
    const parts = [P(Cy(0.28, 0.45, 4.2, 7).translate(0, 2.1, 0), "#5E4330"), P(Cy(0.12, 0.18, 2, 5).rotateZ(0.7).translate(0.8, 3.6, 0), "#5E4330")];
    const blobs: [number, number, number, number][] = ctx.q === "high" ? [[0, 5.8, 0, 2.6], [1.3, 4.9, 0.6, 1.9], [-1.2, 5.1, -0.5, 2.0], [0.2, 4.6, -1.3, 1.7], [-0.3, 7.0, 0.3, 1.7]] : [[0, 5.9, 0, 2.7], [1.3, 4.9, 0.5, 2.0], [-1.2, 5.0, -0.6, 2.1]];
    for (const [x, y, z, r] of blobs) parts.push(jitter(ao(P(lumpy(Ic(r, 1), 0.12, x + y).translate(x, y, z), "#ffffff", 1), 3.5, 7.5, 0.6), 0.1));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.5 }), base: 230, minGap: 4, range: 160, spread: 1.4, scale: [0.85, 1.6], tint: ["#4E9A2E", "#5DAA36", "#3F8A2A"], stretchY: true, cluster: 0.5, radius: 2.5 };
  },
  // groves: 7-9 low-poly trees in one instance, for dense woodland further from the road at low cost
  grove: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    const shades = ["#ffffff", "#e6e0d0", "#f4e8d8", "#d8d4c8", "#fff0e0", "#ece4dc", "#dcd8cc", "#f8f0e8", "#e0dcd0"];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996, r = i === 0 ? 0 : 3 + (i % 3) * 2.6, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 4 + ((i * 7) % 5) * 0.8;
      parts.push(P(Cy(0.2, 0.32, h, 4).translate(x, h / 2, z), "#5E4330"));
      parts.push(jitter(ao(P(lumpy(Ic(2.2 + (i % 3) * 0.5, 0), 0.12, i).scale(1, 1.15, 1).translate(x, h + 1.2, z), shades[i], 1), h - 1, h + 3, 0.6), 0.1, i + 2));
    }
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.25 }), base: 70, minGap: 22, range: 260, spread: 1.2, scale: [0.9, 1.4], tint: ["#4E9A2E", "#5DAA36", "#3F8A2A"], radius: 9, cluster: 0.5, stretchY: true };
  },
  pinegrove: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    const shades = ["#ffffff", "#e8ece8", "#d8dcd8", "#f0f4f0", "#e0e4e0", "#ccd0cc", "#f4f8f4", "#dce0dc", "#e8e8e8"];
    const snow = !!ctx.look.ground.snowCaps;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996, r = i === 0 ? 0 : 2.6 + (i % 3) * 2.4, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 7 + ((i * 5) % 4) * 1.6;
      parts.push(P(Cy(0.15, 0.25, 2, 4).translate(x, 1, z), "#5A3D25"));
      parts.push(ao(P(Co(1.9, h, 6).translate(x, 1.2 + h / 2, z), shades[i], 1), 1, h, 0.55));
      if (snow) parts.push(P(Co(1.0, h * 0.35, 6).translate(x, 1.25 + h * 0.84, z), "#F4F8FF"));
    }
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.15 }), base: 70, minGap: 22, range: 280, spread: 1.2, scale: [0.9, 1.4], tint: ["#2E6B3A", "#265C32", "#3A7A45"], radius: 8, cluster: 0.5, stretchY: true };
  },
  birch: (ctx) => {
    const parts = [P(Cy(0.16, 0.24, 7, 6).translate(0, 3.5, 0), "#ECE8DE")];
    for (let i = 0; i < 6; i++) parts.push(P(B(0.36, 0.12, 0.36).translate(0, 1 + i * 1.0, 0), "#2A2A2A"));
    for (const [x, y, z, r] of [[0, 7, 0, 1.6], [0.7, 6, 0.4, 1.2], [-0.6, 6.3, -0.3, 1.3]] as const) parts.push(jitter(P(lumpy(Ic(r, 1), 0.15, x).scale(1, 1.3, 1).translate(x, y, z), "#ffffff", 1), 0.12));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.6 }), base: 160, minGap: 4, range: 140, spread: 1.4, scale: [0.9, 1.4], tint: ["#F2B134", "#E8C040", "#D9A030"], cluster: 0.5, radius: 1.5 };
  },
  pine: (ctx) => {
    const parts = [P(Cy(0.22, 0.38, 3, 6).translate(0, 1.5, 0), "#5A3D25")];
    [[2.7, 3.8, 3.6], [2.2, 3.4, 5.6], [1.7, 3.0, 7.4], [1.1, 2.4, 9.0]].forEach(([r, h, y], i) => parts.push(jitter(ao(P(Co(r, h, 9).translate(0, y, 0), "#ffffff", 1), 2, 10, 0.55), 0.08, i + 1)));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.3 }), base: 240, minGap: 4, range: 180, spread: 1.3, scale: [0.9, 1.8], tint: ["#2E6B3A", "#265C32", "#3A7A45"], stretchY: true, cluster: 0.6, radius: 2.2 };
  },
  snowpine: (ctx) => {
    const parts = [P(Cy(0.22, 0.38, 3, 6).translate(0, 1.5, 0), "#5A3D25")];
    [[2.7, 3.8, 3.6], [2.2, 3.4, 5.6], [1.7, 3.0, 7.4], [1.1, 2.4, 9.0]].forEach(([r, h, y]) => {
      parts.push(ao(P(Co(r, h, 9).translate(0, y, 0), "#ffffff", 1), 2, 10, 0.6));
      parts.push(P(Co(r * 0.72, h * 0.42, 9).translate(0, y + h * 0.22, 0), "#F4F8FF"));
      parts.push(P(Cy(r * 0.98, r * 1.0, 0.12, 9).translate(0, y - h / 2 + 0.1, 0), "#E8F0FA"));
    });
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.2 }), base: 240, minGap: 4, range: 180, spread: 1.3, scale: [0.9, 1.8], tint: ["#2A5E3A", "#24502F", "#346A44"], stretchY: true, cluster: 0.6, radius: 2.2 };
  },
  cypress: (ctx) => ({
    geometry: merge([P(Cy(0.2, 0.3, 1.5, 5).translate(0, 0.75, 0), "#5A4030"), jitter(P(lumpy(Sp(1.2, 9, 8), 0.08).scale(1, 4.2, 1).translate(0, 5.6, 0), "#ffffff", 1), 0.12)]),
    material: vc(ctx, { sway: 0.4 }), base: 160, minGap: 3, range: 120, spread: 1.6, scale: [0.85, 1.4], tint: ["#2E4A2A", "#355432", "#28422A"], stretchY: true, radius: 1.3,
  }),
  olive: (ctx) => {
    const parts = [P(Cy(0.25, 0.4, 2.4, 6).rotateZ(0.15).translate(0, 1.2, 0), "#6A5A48"), P(Cy(0.15, 0.22, 1.6, 5).rotateZ(-0.6).translate(0.5, 2.4, 0), "#6A5A48")];
    for (const [x, y, z, r] of [[0, 3.4, 0, 1.7], [1.2, 3.0, 0.4, 1.3], [-1.0, 3.1, -0.4, 1.3]] as const) parts.push(jitter(P(lumpy(Ic(r, 1), 0.2, x).scale(1, 0.7, 1).translate(x, y, z), "#ffffff", 1), 0.15));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.4 }), base: 140, minGap: 4, range: 130, spread: 1.4, scale: [0.9, 1.3], tint: ["#8A9A6A", "#7A8A5E", "#9AA67A"], radius: 2 };
  },
  sakura: (ctx) => {
    const parts = [P(Cy(0.3, 0.45, 3.4, 7).translate(0, 1.7, 0), "#3A2A2A"), P(Cy(0.14, 0.22, 2.4, 5).rotateZ(0.8).translate(0.9, 3.4, 0), "#3A2A2A"), P(Cy(0.14, 0.22, 2.4, 5).rotateZ(-0.8).translate(-0.9, 3.4, 0.2), "#3A2A2A")];
    const blobs: [number, number, number, number][] = ctx.q === "high" ? [[0, 5.2, 0, 2.4], [1.9, 4.6, 0.4, 1.8], [-1.9, 4.7, -0.3, 1.9], [0.4, 4.4, -1.5, 1.6], [-0.4, 6.2, 0.6, 1.5]] : [[0, 5.3, 0, 2.6], [1.9, 4.6, 0.4, 1.9], [-1.9, 4.7, -0.3, 2.0]];
    for (const [x, y, z, r] of blobs) parts.push(jitter(ao(P(lumpy(Ic(r, 1), 0.14, x * 3).scale(1.15, 0.85, 1.15).translate(x, y, z), "#ffffff", 1), 3.5, 6.5, 0.75), 0.08));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.4 }), base: 220, minGap: 3, range: 140, spread: 1.5, scale: [0.85, 1.4], tint: ["#FFB7D5", "#FF9AC8", "#FFC8E0", "#F7A8C8", "#FFD6E6"], cluster: 0.4, radius: 2.6 };
  },
  palm: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) { const t = i / 7; parts.push(P(Cy(0.26 - t * 0.08, 0.3 - t * 0.08, 1.35, 6).translate(t * t * 1.6, 0.65 + i * 1.28, 0), i % 2 ? "#9C7A4E" : "#86663F")); }
    const top = new THREE.Vector3(1.6, 9.2, 0);
    for (let i = 0; i < 9; i++) parts.push(P(frond(4.4, 1.1, 2.0).rotateZ(0.35).rotateY((i / 9) * Math.PI * 2 + i * 0.3).translate(top.x, top.y, top.z), "#ffffff", 1));
    for (let i = 0; i < 3; i++) parts.push(P(Sp(0.22, 6, 4).translate(top.x + Math.cos(i * 2) * 0.35, top.y - 0.35, Math.sin(i * 2) * 0.35), "#5A4022"));
    return { geometry: merge(parts), material: vc(ctx, { sway: 1, side: THREE.DoubleSide }), base: 170, minGap: 3, range: 110, spread: 1.5, scale: [0.9, 1.35], tint: ["#3E9A3A", "#4FAE45", "#5AA83E"], radius: 1.5 };
  },
  cactus: (ctx) => ({
    geometry: merge([
      jitter(P(new THREE.CapsuleGeometry(0.5, 4, 3, 8).translate(0, 2.4, 0), "#ffffff", 1), 0.06),
      P(new THREE.CapsuleGeometry(0.3, 1.2, 3, 7).rotateZ(Math.PI / 2).translate(0.85, 2.4, 0), "#ffffff", 1),
      P(new THREE.CapsuleGeometry(0.3, 1.6, 3, 7).translate(1.5, 3.2, 0), "#ffffff", 1),
      P(new THREE.CapsuleGeometry(0.28, 0.9, 3, 7).rotateZ(Math.PI / 2).translate(-0.7, 3.2, 0), "#ffffff", 1),
      P(new THREE.CapsuleGeometry(0.28, 1.1, 3, 7).translate(-1.15, 3.8, 0), "#ffffff", 1),
    ]),
    material: vc(ctx), base: 170, minGap: 3, range: 150, spread: 1.5, scale: [0.8, 1.5], tint: ["#3E8E47", "#4FA055", "#2F7A3B"], radius: 1.2,
  }),
  deadtree: (ctx) => {
    const parts = [P(Cy(0.18, 0.4, 5, 6).translate(0, 2.5, 0), "#ffffff", 1)];
    const br: [number, number, number, number][] = [[0.9, 3.4, 0.6, 2.2], [-0.8, 0.9, 4.0, 1.8], [0.3, -0.9, 4.6, 1.5], [-0.5, 2.0, 2.8, 1.6], [0.7, -2.4, 3.2, 1.4]];
    for (const [rz, ry, y, l] of br) parts.push(P(Cy(0.05, 0.12, l, 4).translate(0, l / 2, 0).rotateZ(rz).rotateY(ry).translate(0, y, 0), "#ffffff", 1));
    return { geometry: merge(parts), material: vc(ctx), base: 150, minGap: 3, range: 150, spread: 1.4, scale: [0.9, 1.7], tint: ["#3A3230", "#4A403A", "#2E2A2A"], radius: 1.5 };
  },
  acacia: (ctx) => {
    const parts = [P(Cy(0.22, 0.36, 3.2, 6).translate(0, 1.6, 0), "#5A4632"), P(Cy(0.12, 0.2, 2.6, 5).rotateZ(0.7).translate(0.8, 3.8, 0), "#5A4632"), P(Cy(0.12, 0.2, 2.6, 5).rotateZ(-0.6).translate(-0.7, 3.8, 0.3), "#5A4632")];
    parts.push(jitter(P(lumpy(Ic(3.4, 1), 0.15).scale(1.25, 0.24, 1.0).translate(0, 5.3, 0), "#ffffff", 1), 0.12));
    parts.push(jitter(P(lumpy(Ic(2.2, 1), 0.15, 7).scale(1.2, 0.25, 1.0).translate(1.6, 4.9, 0.8), "#ffffff", 1), 0.12));
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.3 }), base: 120, minGap: 6, range: 220, spread: 1.3, scale: [0.9, 1.5], tint: ["#6E8A3A", "#7A9440", "#5E7A32"], radius: 4 };
  },
  baobab: (ctx) => {
    const parts = [P(La([[0, 0], [1.6, 0], [1.9, 1.5], [1.7, 4], [1.0, 6.5], [0.8, 7], [0, 7]], 9), "#8A7A6A")];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(P(Cy(0.12, 0.25, 2.4, 5).translate(0, 1.2, 0).rotateZ(0.8).rotateY(a).translate(0, 6.6, 0), "#7A6A5A")); parts.push(P(Ic(0.9, 0).translate(Math.cos(a) * 1.8, 8.2, -Math.sin(a) * 1.8), "#6E8A3A", 1)); }
    return { geometry: merge(parts), material: vc(ctx, { flat: true }), base: 40, minGap: 10, range: 260, spread: 1.2, scale: [0.9, 1.4], tint: ["#6E8A3A"], radius: 3 };
  },
  jungletree: (ctx) => {
    const parts = [P(Cy(0.45, 0.8, 14, 7).translate(0, 7, 0), "#6A5A44")];
    for (let i = 0; i < 4; i++) parts.push(P(B(0.15, 2.4, 1.6).translate(0, 1.2, 0.8).rotateY((i / 4) * Math.PI * 2), "#5E4E3A"));
    for (const [x, y, z, r, k] of ([[0, 15, 0, 4.2, 0.45], [2.4, 13, 1, 3, 0.5], [-2.6, 13.4, -0.8, 3.1, 0.5], [0.4, 11, -2.4, 2.6, 0.55]] as const).slice(0, ctx.q === "high" ? 4 : 3)) parts.push(jitter(ao(P(lumpy(Ic(r, 1), 0.15, x).scale(1, k, 1).translate(x, y, z), "#ffffff", 1), 9, 16, 0.6), 0.1));
    for (let i = 0; i < 6; i++) { const a = i * 1.1; parts.push(P(B(0.08, 5 + (i % 3), 0.08).translate(Math.cos(a) * 2.6, 10.2 - (i % 3), Math.sin(a) * 2.6), "#3A6A2A")); }
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.15 }), base: 150, minGap: 5, range: 170, spread: 1.3, scale: [0.85, 1.4], tint: ["#2F7A2A", "#3A8A32", "#2A6A24", "#4A8A3A"], cluster: 0.5, radius: 4 };
  },
  fern: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) parts.push(P(frond(1.8, 0.55, 0.9, 3).rotateZ(0.9).rotateY((i / 9) * Math.PI * 2 + i).translate(0, 0.15, 0), "#ffffff", 1));
    return { geometry: merge(parts), material: vc(ctx, { sway: 6, side: THREE.DoubleSide }), base: 320, minGap: 1.5, range: 70, spread: 1.6, scale: [0.8, 1.6], tint: ["#3E8A2E", "#4E9A36", "#2E7A2A"], shadow: false, cluster: 0.4 };
  },
  bamboo: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4, r = 0.4 + (i % 3) * 0.5, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 8 + (i % 4) * 1.6;
      parts.push(P(Cy(0.09, 0.11, h, 5).translate(x, h / 2, z), "#ffffff", 1));
      for (let k = 1; k < 5; k++) parts.push(P(Cy(0.125, 0.125, 0.1, 5).translate(x, (h / 5) * k, z), "#7A8A3A"));
      for (let k = 0; k < 3; k++) parts.push(P(frond(1.4, 0.3, 0.4, 2).rotateY(a + k * 2).translate(x, h - k * 0.9, z), "#5E9A3A"));
    }
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.5, side: THREE.DoubleSide }), base: 150, minGap: 3, range: 90, spread: 1.4, scale: [0.9, 1.3], tint: ["#8AA850", "#7A9A44", "#9AB45A"], cluster: 0.7, radius: 1.6 };
  },
  bush: (ctx) => ({
    geometry: merge([[0, 0.7, 0, 1.1], [0.9, 0.55, 0.3, 0.8], [-0.8, 0.6, -0.2, 0.85]].map(([x, y, z, r], i) => jitter(ao(P(lumpy(Ic(r, ctx.q === "high" ? 1 : 0), 0.15, i).translate(x, y, z), "#ffffff", 1), 0, 1.6, 0.6), 0.12))),
    material: vc(ctx), base: 200, minGap: 2, range: 90, spread: 1.6, scale: [0.8, 1.6], tint: ["#4E8A36", "#5A9A3E", "#3E7A2E"], shadow: false, cluster: 0.4,
  }),
  lavender: (ctx) => {
    const parts = [ao(P(lumpy(Ic(0.9, 0), 0.1).scale(1.4, 0.55, 1).translate(0, 0.42, 0), "#6E8A4E"), 0, 0.8, 0.6)];
    for (let i = 0; i < 6; i++) { const a = i * 2.39996, r = 0.25 + (i % 3) * 0.3; parts.push(P(Co(0.16, 0.65, 3).translate(Math.cos(a) * r * 1.3, 0.95, Math.sin(a) * r), "#ffffff", 1)); }
    return { geometry: merge(parts), material: vc(ctx, { sway: 8 }), base: 900, minGap: 2, range: 0, spread: 1, scale: [0.9, 1.2], tint: ["#8E6FD0", "#9B7BEA", "#7E62C2"], shadow: false, place: "rows", rowGap: 2.2 };
  },
  wheat: (ctx) => {
    const g = B(6, 1.1, 1.1).translate(0, 0.55, 0);
    return { geometry: merge([jitter(P(g, "#ffffff", 1), 0.08)]), material: vc(ctx, { sway: 10 }), base: 700, minGap: 2, range: 0, spread: 1, scale: [0.9, 1.1], tint: ["#D9B44A", "#E4C65A", "#C9A23C"], shadow: false, place: "rows", rowGap: 2.0, faceTrack: true };
  },
  sunflower: (ctx) => {
    const parts = [P(Cy(0.05, 0.06, 2, 4).translate(0, 1, 0), "#4E7A2E"), P(Cy(0.45, 0.45, 0.1, 10).rotateX(Math.PI / 2).translate(0, 2.05, 0.08), "#F2C230"), P(Cy(0.22, 0.22, 0.12, 8).rotateX(Math.PI / 2).translate(0, 2.05, 0.13), "#5A3A1A"), P(frond(0.6, 0.25, 0.2, 2).translate(0, 1.2, 0), "#4E8A2E")];
    return { geometry: merge(parts), material: vc(ctx, { sway: 2 }), base: 500, minGap: 2, range: 0, spread: 1, scale: [0.85, 1.15], shadow: false, place: "rows", rowGap: 1.6, faceTrack: true };
  },
  haybale: (ctx) => ({
    geometry: merge([jitter(P(Cy(0.85, 0.85, 1.3, 12).rotateZ(Math.PI / 2).translate(0, 0.85, 0), "#ffffff", 1), 0.06), P(Cy(0.6, 0.6, 1.32, 12).rotateZ(Math.PI / 2).translate(0, 0.85, 0), "#B8913A")]),
    material: vc(ctx), base: 90, minGap: 4, range: 120, spread: 1.4, scale: [0.9, 1.1], tint: ["#D9B45A", "#C9A24A"], cluster: 0.6, radius: 1.2,
  }),
  pumpkin: (ctx) => {
    const g = La(Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [Math.sin(a) * 0.95 + 0.001, -Math.cos(a) * 0.7 + 0.7] as [number, number]; }), 12);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.cos(a * 8) * 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    const glow = -2.4;
    return {
      geometry: merge([P(g, "#ffffff", 1), P(Cy(0.07, 0.1, 0.4, 5).translate(0, 1.5, 0), "#4A5A2A"),
        P(Co(0.15, 0.2, 3).rotateX(-Math.PI / 2).translate(-0.3, 0.85, 0.86), "#FFD24A", 0, glow), P(Co(0.15, 0.2, 3).rotateX(-Math.PI / 2).translate(0.3, 0.85, 0.86), "#FFD24A", 0, glow), P(B(0.6, 0.14, 0.1).translate(0, 0.5, 0.9), "#FFD24A", 0, glow)]),
      material: vc(ctx), base: 90, minGap: 1.5, range: 50, spread: 1.6, scale: [0.7, 1.4], tint: ["#F07A1F", "#E86A14", "#F28A2A"], faceTrack: true, shadow: false,
    };
  },
  // ===================================================== rocks & landforms
  rock: (ctx) => ({
    geometry: merge([jitter(P(lumpy(Do(2), 0.18).scale(1.3, 0.8, 1), "#ffffff", 1), 0.15), jitter(P(lumpy(Do(1.1), 0.2, 5).translate(1.8, -0.2, 0.8), "#ffffff", 1), 0.15)]),
    material: vc(ctx, { flat: true, rough: 1 }), base: 140, minGap: 2, range: 170, spread: 1.6, scale: [0.6, 2.4], tint: ["#8A817A", "#9C948C", "#776F69"], stretchX: true, sink: 0.5, cluster: 0.3,
  }),
  mesa: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    const bands = ["#ffffff", "#e6d0c0", "#ffffff", "#d8b8a0", "#f2e2d6", "#ffffff"];
    for (let i = 0; i < 6; i++) parts.push(jitter(P(lumpy(Cy(26 - i * 0.6, 27 - i * 0.6, 7, 9), 0.06, i).translate(0, 3.5 + i * 7, 0), bands[i], 1), 0.06));
    parts.push(jitter(P(lumpy(Cy(30, 36, 8, 9), 0.1, 9).translate(0, 2, 0), "#c8a890", 1), 0.08));
    return { geometry: merge(parts), material: vc(ctx, { flat: true, rough: 1 }), base: 12, minGap: 170, range: 560, spread: 1, scale: [1.5, 3.0], tint: ["#C2683E", "#B65A34", "#CF7A4A"], stretchY: true, place: "far", radius: 30, sink: 4 };
  },
  rockarch: (ctx) => ({
    geometry: merge([jitter(P(lumpy(To(14, 3.4, 6, 12, Math.PI), 0.1), "#ffffff", 1), 0.12), jitter(P(lumpy(Do(4.5), 0.15).scale(1, 1.2, 1).translate(-14, 0, 0), "#ffffff", 1), 0.12), jitter(P(lumpy(Do(4.5), 0.15, 8).scale(1, 1.2, 1).translate(14, 0, 0), "#ffffff", 1), 0.12)]),
    material: vc(ctx, { flat: true, rough: 1 }), base: 10, minGap: 25, range: 220, spread: 1.2, scale: [0.8, 1.3], tint: ["#C2683E", "#B65A34"], faceTrack: true, radius: 18, sink: 2,
  }),
  hoodoo: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    let y = 0;
    for (let i = 0; i < 5; i++) { const r = 1.6 - i * 0.18 + (i % 2) * 0.35, h = 2.2 + (i % 2); parts.push(jitter(P(lumpy(Cy(r * 0.85, r, h, 7), 0.08, i).translate(0, y + h / 2, 0), i % 2 ? "#ffffff" : "#e8d2c2", 1), 0.08)); y += h; }
    parts.push(P(lumpy(Do(1.6), 0.15).scale(1.2, 0.5, 1.2).translate(0, y + 0.3, 0), "#8A6A5A"));
    return { geometry: merge(parts), material: vc(ctx, { flat: true, rough: 1 }), base: 60, minGap: 8, range: 220, spread: 1.3, scale: [0.8, 1.6], tint: ["#C2683E", "#D07A4A", "#B65A34"], stretchY: true, radius: 3, sink: 1 };
  },
  tumbleweed: (ctx) => ({
    geometry: merge([P(new THREE.IcosahedronGeometry(0.7, 1), "#9A7A4A"), P(new THREE.IcosahedronGeometry(0.55, 0).rotateY(0.5), "#B8935A")]),
    material: vc(ctx, { flat: true, bob: 0.15 }), base: 120, minGap: 1, range: 70, spread: 1.6, scale: [0.6, 1.3], shadow: false,
  }),
  termite: (ctx) => ({
    geometry: merge([jitter(P(lumpy(Co(1.3, 4.2, 7), 0.12).translate(0, 2.1, 0), "#ffffff", 1), 0.1), jitter(P(lumpy(Co(0.6, 2.4, 6), 0.15, 4).translate(0.7, 1.6, 0.3), "#ffffff", 1), 0.1), P(lumpy(Sp(1.5, 8, 5), 0.1).scale(1, 0.35, 1), "#ffffff", 1)]),
    material: vc(ctx, { flat: true, rough: 1 }), base: 60, minGap: 4, range: 180, spread: 1.4, scale: [0.6, 1.6], tint: ["#B8643A", "#A85A34", "#C2703E"], stretchY: true, radius: 1.5, sink: 0.3,
  }),
  lavarock: (ctx) => {
    const g = P(lumpy(Do(2), 0.22).scale(1.3, 0.85, 1.1), "#2A2422");
    const c = g.attributes.color as THREE.BufferAttribute, gl = g.attributes.aGlow as THREE.BufferAttribute;
    for (let i = 0; i < c.count; i += 3) if ((i * 7919) % 11 < 2) for (let j = 0; j < 3; j++) { c.setXYZ(i + j, 1, 0.35, 0.08); gl.setX(i + j, 1.8); }
    return { geometry: merge([jitter(g, 0.15)]), material: vc(ctx, { flat: true, rough: 1 }), base: 170, minGap: 2, range: 170, spread: 1.5, scale: [0.6, 2.4], stretchX: true, sink: 0.6, cluster: 0.3 };
  },
  lavapool: (ctx) => ({
    geometry: merge([P(new THREE.CircleGeometry(3, 14).rotateX(-Math.PI / 2).translate(0, 0.35, 0), "#FF6A1F", 0, 2.6), P(lumpy(To(3.1, 0.55, 5, 14), 0.15).rotateX(Math.PI / 2).translate(0, 0.25, 0), "#1E1816"), P(new THREE.CircleGeometry(1.4, 10).rotateX(-Math.PI / 2).translate(0.6, 0.37, 0.3), "#FFD04A", 0, 3)]),
    material: vc(ctx), base: 50, minGap: 4, range: 120, spread: 1.4, scale: [0.8, 2.2], shadow: false, place: "flat", radius: 4,
  }),
  basalt: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = (i % 3) * 0.9, h = 2 + ((i * 37) % 7) * 0.9; parts.push(P(Cy(0.55, 0.55, h, 6).translate(Math.cos(a) * r, h / 2, Math.sin(a) * r), i % 2 ? "#ffffff" : "#e0e0e0", 1)); }
    return { geometry: merge(parts), material: vc(ctx, { flat: true, rough: 0.9 }), base: 60, minGap: 3, range: 140, spread: 1.4, scale: [0.9, 2], tint: ["#2E2A2A", "#3A3434"], stretchY: true, radius: 2.5, sink: 0.4 };
  },
  smoker: (ctx) => ({
    geometry: merge([jitter(P(lumpy(Co(2.4, 3, 8), 0.12).translate(0, 1.5, 0), "#2A2220"), 0.15), P(Cy(0.7, 0.7, 0.1, 8).translate(0, 3.0, 0), "#FF8A30", 0, 3)]),
    material: vc(ctx, { flat: true }), base: 40, minGap: 4, range: 150, spread: 1.4, scale: [0.8, 1.6], radius: 2.5,
  }),
  crystal: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) { const a = i * 1.9, h = 1.5 + (i % 3) * 1.2; parts.push(P(Cy(0.0, 0.32, h, 5).translate(0, h / 2, 0).rotateZ(Math.cos(a) * 0.4).rotateX(Math.sin(a) * 0.4).translate(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4), "#ffffff", 1, 0.8)); }
    return { geometry: merge(parts), material: vc(ctx, { flat: true, rough: 0.2, metal: 0.1 }), base: 90, minGap: 2, range: 100, spread: 1.5, scale: [0.7, 1.8], tint: ["#7AF0D0", "#B266FF"], shadow: false, cluster: 0.4 };
  },
  icecrystal: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) { const a = i * 1.7, h = 2.5 + (i % 4) * 1.4; parts.push(P(Cy(0.0, 0.55, h, 6).translate(0, h / 2, 0).rotateZ(Math.cos(a) * 0.35).rotateX(Math.sin(a) * 0.35).translate(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6), "#ffffff", 1, 0.35)); }
    return { geometry: merge(parts), material: vc(ctx, { flat: true, rough: 0.1, metal: 0.2, env: 1.2 }), base: 110, minGap: 2, range: 130, spread: 1.4, scale: [0.7, 2.2], tint: ["#9ADCF5", "#BFEFFF", "#7AC8F0"], cluster: 0.4, radius: 1.5 };
  },
  icespike: (ctx) => ({
    geometry: merge([jitter(P(lumpy(Co(2.2, 9, 6), 0.1).translate(0, 4.5, 0), "#ffffff", 1), 0.1), jitter(P(lumpy(Co(1.4, 6, 6), 0.1, 3).translate(1.8, 3, 0.6), "#ffffff", 1), 0.1)]),
    material: vc(ctx, { flat: true, rough: 0.15, env: 1.2 }), base: 90, minGap: 4, range: 200, spread: 1.3, scale: [0.7, 1.8], tint: ["#CFEFFF", "#A8DCF2"], stretchY: true, radius: 2.5, sink: 0.5,
  }),
  iceberg: (ctx) => ({
    geometry: merge([jitter(P(lumpy(Do(6), 0.25).scale(1.4, 0.8, 1.1).translate(0, 1.5, 0), "#F2FAFF"), 0.12), jitter(P(lumpy(Do(3.5), 0.2, 4).translate(4, 3.5, 1), "#DDF2FF"), 0.12)]),
    material: vc(ctx, { flat: true, rough: 0.3 }), base: 50, minGap: 20, range: 500, spread: 1, scale: [0.6, 2.2], place: "water", radius: 8,
  }),
  crater: (ctx) => ({
    geometry: merge([jitter(P(lumpy(To(5, 1.1, 5, 16), 0.15).rotateX(Math.PI / 2).scale(1, 1, 0.6).translate(0, 0.1, 0), "#ffffff", 1), 0.1), P(new THREE.CircleGeometry(4.6, 14).rotateX(-Math.PI / 2).translate(0, -0.15, 0), "#6A6A6E")]),
    material: vc(ctx, { flat: true, rough: 1 }), base: 70, minGap: 3, range: 220, spread: 1.4, scale: [0.6, 2.4], tint: ["#9A9A9E", "#8A8A8E"], shadow: false, place: "flat", radius: 5,
  }),
  // ===================================================== fantasy / candy
  giantmushroom: (ctx) => {
    const cap = La([[0, 3.0], [1.8, 2.8], [3.2, 2.0], [3.8, 1.0], [3.4, 0.6], [0.8, 0.9], [0, 1.0]], 14).translate(0, 6, 0);
    const parts = [P(Cy(0.5, 0.8, 7, 9).translate(0, 3.5, 0), "#EFE6D8", 0, -0.25), P(cap, "#ffffff", 1, -0.5), P(Cy(1.0, 0.7, 0.4, 9).translate(0, 4.5, 0), "#E6DCCB")];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 1.2 + (i % 3) * 0.8; parts.push(P(Sp(0.32, 6, 4).translate(Math.cos(a) * r, 6 + 2.6 - r * 0.42, Math.sin(a) * r), "#F8FFF0", 0, 1.2)); }
    return { geometry: merge(parts), material: vc(ctx, { sway: 0.1 }), base: 90, minGap: 4, range: 170, spread: 1.4, scale: [0.8, 1.9], tint: ["#E0304A", "#B266FF", "#2FC8B8", "#FF7AD9"], stretchY: true, radius: 4 };
  },
  mushrooms: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) { const a = i * 2.2, r = 0.3 + i * 0.25, h = 0.4 + (i % 3) * 0.35, s = 0.3 + (i % 2) * 0.2; parts.push(P(Cy(0.06, 0.08, h, 5).translate(Math.cos(a) * r, h / 2, Math.sin(a) * r), "#EFE6D8")); parts.push(P(Sp(s, 8, 4, ).scale(1, 0.55, 1).translate(Math.cos(a) * r, h, Math.sin(a) * r), "#ffffff", 1, 1.1)); }
    return { geometry: merge(parts), material: vc(ctx), base: 200, minGap: 1, range: 60, spread: 1.6, scale: [0.8, 1.8], tint: ["#7AF0D0", "#FF7AD9", "#FFE47A", "#B266FF"], shadow: false, cluster: 0.5 };
  },
  lollipop: (ctx) => {
    const disc = Cy(1.6, 1.6, 0.45, 18).rotateX(Math.PI / 2).translate(0, 5.6, 0);
    const c = P(disc, "#ffffff", 1);
    const swirl = P(To(1.0, 0.18, 5, 18).translate(0, 5.6, 0.24), "#FFFFFF");
    return { geometry: merge([P(Cy(0.12, 0.12, 5, 6).translate(0, 2.5, 0), "#F4F1E6"), c, swirl, P(To(0.5, 0.12, 5, 14).translate(0, 5.6, 0.26), "#FFFFFF")]), material: vc(ctx, { rough: 0.3 }), base: 120, minGap: 3, range: 120, spread: 1.4, scale: [0.8, 1.6], tint: ["#FF3B7A", "#FFB547", "#7FD7FF", "#B78BFF", "#5BE37A"], faceTrack: true, radius: 1.6 };
  },
  candycane: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) parts.push(P(Cy(0.3, 0.3, 0.8, 8).translate(0, 0.4 + i * 0.8, 0), i % 2 ? "#FFFFFF" : "#ffffff", i % 2 ? 0 : 1));
    for (let i = 0; i < 8; i++) parts.push(P(To(0.9, 0.3, 6, 3, Math.PI / 8).rotateZ((i * Math.PI) / 8).translate(0.9, 6.4, 0), i % 2 ? "#FFFFFF" : "#ffffff", i % 2 ? 0 : 1));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.25 }), base: 100, minGap: 2, range: 110, spread: 1.5, scale: [0.8, 1.6], tint: ["#FF3B7A", "#E8304A", "#5BE37A"], radius: 1.2 };
  },
  gumdrop: (ctx) => ({
    geometry: merge([jitter(P(La([[0, 0], [1.4, 0], [1.4, 0.5], [1.1, 1.5], [0.6, 2.0], [0, 2.1]], 12), "#ffffff", 1), 0.05)]),
    material: vc(ctx, { rough: 0.35 }), base: 170, minGap: 2, range: 120, spread: 1.5, scale: [0.6, 2.0], tint: ["#FF5FA2", "#FFE14A", "#7FD7FF", "#7FE0A6", "#B78BFF", "#FF8A3D"], cluster: 0.4,
  }),
  cupcake: (ctx) => ({
    geometry: merge([P(Cy(1.9, 1.5, 2.2, 14).translate(0, 1.1, 0), "#F2C080"), jitter(P(La([[0, 3.8], [0.8, 3.7], [1.8, 3.2], [2.2, 2.6], [2.0, 2.2], [0, 2.2]], 14), "#ffffff", 1), 0.05), P(Sp(0.45, 8, 6).translate(0, 4.1, 0), "#E8304A")]),
    material: vc(ctx, { rough: 0.5 }), base: 40, minGap: 3, range: 130, spread: 1.4, scale: [0.9, 2.2], tint: ["#FFB7D9", "#FFFFFF", "#B9F0D0", "#C9A6F2"], radius: 2.4,
  }),
  icecream: (ctx) => ({
    geometry: merge([P(Co(1.0, 3.6, 10).rotateX(Math.PI).translate(0, 1.8, 0), "#D9A35A"), P(Sp(1.15, 10, 7).translate(0, 4.0, 0), "#ffffff", 1), P(Sp(0.95, 10, 7).translate(0, 5.3, 0), "#ffffff", 0.6), P(Sp(0.3, 6, 4).translate(0, 6.3, 0), "#E8304A")]),
    material: vc(ctx, { rough: 0.5 }), base: 40, minGap: 3, range: 120, spread: 1.4, scale: [0.9, 2.0], tint: ["#FFB7D9", "#B9F0D0", "#FFF2A8", "#C9A6F2"], radius: 1.4,
  }),
  donut: (ctx) => ({
    geometry: merge([P(To(1.6, 0.8, 8, 16).translate(0, 2.4, 0), "#D9A35A"), P(To(1.6, 0.82, 8, 16, Math.PI).translate(0, 2.4, 0.06), "#ffffff", 1)]),
    material: vc(ctx, { rough: 0.5 }), base: 30, minGap: 3, range: 130, spread: 1.4, scale: [0.9, 1.8], tint: ["#FF5FA2", "#7A4A2A", "#7FD7FF"], faceTrack: true, radius: 2.4,
  }),
  candytree: (ctx) => ({
    geometry: merge([P(Cy(0.25, 0.35, 3, 6).translate(0, 1.5, 0), "#F4F1E6"), ...[[0, 4.4, 0, 2.2], [1.2, 3.8, 0.4, 1.5], [-1.1, 4.0, -0.3, 1.6]].map(([x, y, z, r], i) => jitter(P(lumpy(Ic(r, 1), 0.08, i).translate(x, y, z), "#ffffff", 1), 0.04))]),
    material: vc(ctx, { sway: 0.4, rough: 0.6 }), base: 150, minGap: 3, range: 140, spread: 1.4, scale: [0.9, 1.5], tint: ["#FFB7D9", "#B9E6FF", "#FFF2A8", "#D9C2FF"], cluster: 0.4, radius: 2,
  }),
  cloudpuff: (ctx) => ({
    geometry: merge([[0, 0, 0, 3.4], [3, -0.6, 0.6, 2.6], [-3, -0.5, -0.4, 2.7], [1, 1.4, -0.6, 2.4], [-1.4, 0.9, 1.2, 2.2]].map(([x, y, z, r], i) => P(Ic(r, 1).translate(x, y, z), "#FFFFFF", 0, 0.25 + i * 0.02))),
    material: vc(ctx, { bob: 0.6, rough: 1 }), base: 140, minGap: 4, range: 240, spread: 1.3, scale: [0.7, 2.2], shadow: false, place: "air", air: [-26, 10], stretchX: true,
  }),
  floatisland: (ctx) => {
    const parts = [jitter(P(lumpy(Co(9, 12, 8), 0.15).rotateX(Math.PI).translate(0, -6, 0), "#9A7A5A"), 0.15), P(Cy(9.2, 9.2, 1.2, 10).translate(0, 0.6, 0), "#6ACB5A"), P(Cy(0.3, 0.5, 3, 6).translate(2, 2.5, 1), "#6B4A2E"), P(Ic(2.2, 1).translate(2, 5, 1), "#4FAE45"), P(Cy(1.6, 1.6, 2.4, 8).translate(-3, 2.4, -2), "#F4F1E6"), P(Co(2, 2.2, 8).translate(-3, 4.7, -2), "#FF5FA2")];
    return { geometry: merge(parts), material: vc(ctx, { bob: 1.2 }), base: 30, minGap: 30, range: 420, spread: 1.1, scale: [0.8, 1.8], place: "air", air: [-40, 60], radius: 10 };
  },
  balloon: (ctx) => {
    const env = La([[0.01, 0], [1.2, 0.6], [2.6, 2.2], [3.4, 4.4], [3.3, 6.2], [2.4, 7.6], [0.01, 8.2]], 12).translate(0, 3, 0);
    const c = P(env, "#ffffff", 1), pos = c.attributes.position;
    const tintMask = c.attributes.aTint as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); tintMask.setX(i, Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0 ? 1 : 0); }
    return { geometry: merge([c, P(B(1.0, 0.8, 1.0).translate(0, 0.4, 0), "#8A6A42"), P(Cy(0.02, 0.02, 2.4, 3).translate(0.45, 1.9, 0.45), "#3a3a3a"), P(Cy(0.02, 0.02, 2.4, 3).translate(-0.45, 1.9, -0.45), "#3a3a3a")]), material: vc(ctx, { bob: 1.5 }), base: 30, minGap: 10, range: 300, spread: 1.2, scale: [0.9, 1.6], tint: ["#FF4F6D", "#FFB547", "#4FC3FF", "#9B6BFF", "#5BE37A"], place: "air", air: [12, 70], shadow: false };
  },
  starpickup: (ctx) => {
    const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.9 : 2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false }).translate(0, 0, -0.3);
    return { geometry: merge([P(g, "#FFE14A", 0, 0.9)]), material: vc(ctx, { bob: 1 }), base: 60, minGap: 6, range: 120, spread: 1.4, scale: [0.8, 1.6], place: "air", air: [4, 30], shadow: false };
  },
  castle: (ctx) => {
    const parts = [jitter(P(lumpy(Co(40, 50, 9), 0.12).rotateX(Math.PI).translate(0, -25, 0), "#F2EEFF"), 0.06), P(B(40, 14, 30).translate(0, 7, 0), "#F4EEFF")];
    for (const [x, z] of [[-20, -15], [20, -15], [-20, 15], [20, 15]]) { parts.push(P(Cy(4, 4, 26, 10).translate(x, 13, z), "#F4EEFF")); parts.push(P(Co(5.2, 10, 10).translate(x, 31, z), "#FF5FA2")); }
    parts.push(P(Cy(6, 6, 40, 10).translate(0, 20, 0), "#FFF4FA"), P(Co(7.5, 16, 10).translate(0, 48, 0), "#9B6BFF"));
    return { geometry: merge(parts), material: vc(ctx), base: 3, minGap: 200, range: 400, spread: 1, scale: [1, 1.3], place: "air", air: [-10, 40], radius: 40, shadow: false };
  },
  // ===================================================== underwater
  coral: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) { const a = i * 0.9, l = 1.6 + (i % 3) * 0.6; parts.push(P(Cy(0.12, 0.2, l, 5).translate(0, l / 2, 0).rotateZ(Math.cos(a) * 0.6).rotateX(Math.sin(a) * 0.6).translate(0, 0.3, 0), "#ffffff", 1)); parts.push(P(Sp(0.22, 5, 4).translate(Math.sin(Math.cos(a) * -0.6) * l, l * 0.85, Math.sin(Math.sin(a) * 0.6) * l), "#ffffff", 1, 0.2)); }
    parts.push(jitter(P(lumpy(Sp(1.1, 9, 6), 0.12).scale(1, 0.7, 1).translate(1.4, 0.5, 0.8), "#ffffff", 0.5), 0.15));
    return { geometry: merge(parts), material: vc(ctx, { sway: 1.5 }), base: 220, minGap: 2, range: 120, spread: 1.5, scale: [0.8, 2.2], tint: ["#FF6A8A", "#FF9A4A", "#B266FF", "#FFD04A", "#4FD8C8"], cluster: 0.5 };
  },
  kelp: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) { const h = 8 + i * 2.2, g = new THREE.PlaneGeometry(0.7, h, 1, 8).translate(0, h / 2, 0); const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setX(k, p.getX(k) + Math.sin(p.getY(k) * 0.5 + i) * 0.5); g.computeVertexNormals(); parts.push(P(g.rotateY(i * 1.3).translate(Math.cos(i * 2) * 0.6, 0, Math.sin(i * 2) * 0.6), "#ffffff", 1)); }
    return { geometry: merge(parts), material: vc(ctx, { sway: 1.6, side: THREE.DoubleSide }), base: 200, minGap: 2, range: 130, spread: 1.4, scale: [0.8, 1.6], tint: ["#3E7A2E", "#5A8A2A", "#2E6A3A"], shadow: false, cluster: 0.6 };
  },
  anemone: (ctx) => {
    const parts = [P(Cy(0.5, 0.7, 0.5, 8).translate(0, 0.25, 0), "#ffffff", 0.5)];
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.15 + (i % 3) * 0.15; parts.push(P(Cy(0.04, 0.07, 0.9, 4).translate(0, 0.45, 0).rotateZ(Math.cos(a) * 0.4).rotateX(Math.sin(a) * 0.4).translate(Math.cos(a) * r, 0.45, Math.sin(a) * r), "#ffffff", 1, 0.4)); }
    return { geometry: merge(parts), material: vc(ctx, { sway: 12 }), base: 200, minGap: 1.5, range: 70, spread: 1.6, scale: [0.8, 1.8], tint: ["#FF7A9A", "#FFB547", "#B78BFF", "#7AF0D0"], shadow: false, cluster: 0.5 };
  },
  fish: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) { const x = Math.cos(i * 2.3) * (1 + i * 0.35), y = Math.sin(i * 1.7) * 1.2, z = Math.sin(i * 2.3) * (1 + i * 0.3); parts.push(P(Sp(0.3, 6, 4).scale(0.5, 0.8, 1.4).translate(x, y, z), "#ffffff", 1, 0.15)); parts.push(P(Co(0.25, 0.4, 3).rotateX(Math.PI / 2).translate(x, y, z - 0.55), "#ffffff", 1)); }
    return { geometry: merge(parts), material: vc(ctx, { bob: 0.8 }), base: 40, minGap: 2, range: 60, spread: 1.4, scale: [0.8, 1.6], tint: ["#FFB547", "#4FC3FF", "#FF7A9A", "#FFE14A"], faceTrack: true, place: "air", air: [3, 14], shadow: false };
  },
  seadome: (ctx) => ({
    geometry: merge([P(Hemi(10, 16, 6), "#BFF6FF", 0, -0.4), P(Cy(10.4, 10.8, 1.6, 16).translate(0, 0.4, 0), "#5A6A7A"), ...Array.from({ length: 8 }, (_, i) => P(To(10.05, 0.18, 4, 12, Math.PI / 2).rotateY((i / 8) * Math.PI).rotateX(0), "#E6EEF2")), P(Cy(10.1, 10.1, 1.2, 16, true).translate(0, 3.5, 0), "#FFE2A0", 0, 1.2)]),
    material: vc(ctx, { rough: 0.15, metal: 0.3, env: 1.2 }), base: 18, minGap: 14, range: 260, spread: 1.2, scale: [0.7, 1.6], radius: 11, sink: 1,
  }),
  shipwreck: (ctx) => ({
    geometry: merge([jitter(P(La([[0.01, 0], [3, 0.6], [4.2, 2.5], [4.6, 5]], 10).scale(1, 1, 4).rotateZ(0.4).translate(0, 1, 0), "#5A4A3A"), 0.2), P(Cy(0.25, 0.3, 12, 6).rotateZ(0.9).translate(-2, 6, 0), "#4A3A2A"), P(B(9, 0.3, 4).rotateZ(0.4).translate(0, 4.5, 0), "#6A5A4A")]),
    material: vc(ctx, { flat: true }), base: 3, minGap: 30, range: 220, spread: 1, scale: [1, 1.4], radius: 14,
  }),
  // ===================================================== animals
  cow: (ctx) => ({ geometry: quadruped([1.0, 1.0, 2.2], 0.8, { len: 0.6, ang: 0.9, r: 0.25 }, [0.5, 0.5, 0.8], "#F2F0EA", "#3A2A2A", [P(B(0.6, 0.5, 0.6).translate(0.3, 1.6, 0.2), "#2A2422")]), material: vc(ctx), base: 50, minGap: 6, range: 90, spread: 1.4, scale: [0.9, 1.1], cluster: 0.8, radius: 1.5 }),
  camel: (ctx) => ({ geometry: quadruped([0.8, 1.0, 2.0], 1.6, { len: 1.2, ang: 0.7, r: 0.22 }, [0.35, 0.4, 0.8], "#C9A06A", "#9A7A4A", [P(Sp(0.55, 7, 5).translate(0, 3.1, 0), "#C9A06A")]), material: vc(ctx), base: 50, minGap: 8, range: 150, spread: 1.3, scale: [1, 1.2], cluster: 0.8, radius: 1.5 }),
  giraffe: (ctx) => ({ geometry: quadruped([0.8, 1.0, 1.8], 2.0, { len: 2.6, ang: 0.35, r: 0.2 }, [0.3, 0.35, 0.8], "#E0A84A", "#8A5A2A"), material: vc(ctx), base: 50, minGap: 10, range: 200, spread: 1.3, scale: [1, 1.2], cluster: 0.8, radius: 1.5 }),
  elephant: (ctx) => ({ geometry: quadruped([1.8, 1.9, 3.0], 1.4, { len: 0.5, ang: 1.3, r: 0.5 }, [1.2, 1.3, 1.0], "#8A8686", "#6A6666", [P(Cy(0.15, 0.25, 1.8, 5).translate(0, 2.2, 2.4), "#8A8686"), P(B(0.1, 1.2, 1.0).translate(0.75, 3.2, 1.6), "#7A7676"), P(B(0.1, 1.2, 1.0).translate(-0.75, 3.2, 1.6), "#7A7676")]), material: vc(ctx), base: 30, minGap: 14, range: 220, spread: 1.3, scale: [1, 1.2], cluster: 0.8, radius: 3 }),
  reindeer: (ctx) => ({ geometry: quadruped([0.6, 0.8, 1.6], 1.0, { len: 0.8, ang: 0.6, r: 0.18 }, [0.3, 0.35, 0.6], "#8A6A4A", "#5A4232", [P(Cy(0.04, 0.05, 0.9, 3).rotateZ(0.5).translate(0.25, 2.9, 0.9), "#D9C8A8"), P(Cy(0.04, 0.05, 0.9, 3).rotateZ(-0.5).translate(-0.25, 2.9, 0.9), "#D9C8A8")]), material: vc(ctx), base: 50, minGap: 6, range: 120, spread: 1.4, scale: [1, 1.2], cluster: 0.8, radius: 1.2 }),
  // ===================================================== circuit furniture
  grandstand: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    const crowd = ["#FF6F91", "#FFD25A", "#4FC3FF", "#74C94E", "#9B5DE5", "#F4F1E6", "#FF8A3D", "#2F2F3A"];
    for (let i = 0; i < 7; i++) {
      parts.push(P(B(30, 0.9, 1.6).translate(0, 0.45 + i * 0.9, -i * 1.6), "#9AA0AA"));
      for (let k = 0; k < 20; k++) parts.push(P(B(0.9, 0.75, 0.55).translate(-14 + k * 1.45 + (i % 2) * 0.5, 1.25 + i * 0.9, -i * 1.6 + 0.2), crowd[(k * 3 + i * 5) % crowd.length]));
    }
    parts.push(P(B(32, 0.4, 13).translate(0, 9.6, -5).rotateX(-0.06), "#ffffff", 1));
    for (const x of [-15, 0, 15]) parts.push(P(B(0.5, 9.6, 0.5).translate(x, 4.8, -11), "#4a4f57"));
    parts.push(P(B(32, 6.5, 0.4).translate(0, 3.2, -11.2), "#5a5f68"));
    return { geometry: merge(parts), material: vc(ctx), base: 9, minGap: 3, range: 6, spread: 1, scale: [1, 1], faceTrack: true, tint: ["#E8504F", "#3B82F6", "#2FA866"], radius: 16, place: "roadside" };
  },
  billboard: (ctx) => {
    const night = ctx.night, map = TX.adAtlas(false);
    const board = P(new THREE.PlaneGeometry(10, 5).translate(0, 7, 0.26), "#ffffff", 0, night ? 0.9 : 0, 1);
    const back = P(new THREE.PlaneGeometry(10, 5).rotateY(Math.PI).translate(0, 7, -0.26), "#ffffff", 0, night ? 0.9 : 0, 1);
    const frame = [P(B(0.4, 7, 0.4).translate(-3.5, 3.5, 0), "#4a4f57"), P(B(0.4, 7, 0.4).translate(3.5, 3.5, 0), "#4a4f57"), P(B(10.4, 5.4, 0.45).translate(0, 7, 0), "#3a3f47"), P(B(10.4, 0.3, 1.0).translate(0, 4.2, 0.4), "#4a4f57")];
    for (const f of frame) { const uv = f.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.01); }
    return { geometry: merge([board, back, ...frame]), material: vc(ctx, { map, cells: [2, 4], rough: 0.6 }), base: 26, minGap: 3, range: 30, spread: 2, scale: [1, 1.2], faceTrack: true, cells: 8, radius: 5.5 };
  },
  neonsign: (ctx) => {
    const map = TX.adAtlas(true);
    const board = P(new THREE.PlaneGeometry(4, 8).translate(0, 9, 0.21), "#ffffff", 0, 1.4, 1);
    const g = board.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < g.count; i++) { const u = g.getX(i), v = g.getY(i); g.setXY(i, v, 1 - u); }
    const frame = [P(B(0.3, 9, 0.3).translate(0, 4.5, -0.2), "#2a2a33"), P(B(4.2, 8.2, 0.35).translate(0, 9, 0), "#15121f")];
    for (const f of frame) { const uv = f.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.01); }
    return { geometry: merge([board, ...frame]), material: vc(ctx, { map, cells: [2, 4], rough: 0.5 }), base: 40, minGap: 3, range: 40, spread: 1.6, scale: [0.9, 1.3], faceTrack: true, cells: 8, radius: 2.5 };
  },
  chevron: (ctx) => {
    const parts = [P(B(3.2, 1.1, 0.12).translate(0, 1.6, 0), "#E8304A"), P(B(0.12, 1.6, 0.12).translate(-1.2, 0.8, -0.06), "#6a6f78"), P(B(0.12, 1.6, 0.12).translate(1.2, 0.8, -0.06), "#6a6f78")];
    for (let i = 0; i < 3; i++) { const x = -1 + i; parts.push(P(B(0.16, 0.62, 0.02).rotateZ(0.6).translate(x - 0.15, 1.75, 0.07), "#FFFFFF", 0, -0.4)); parts.push(P(B(0.16, 0.62, 0.02).rotateZ(-0.6).translate(x - 0.15, 1.45, 0.07), "#FFFFFF", 0, -0.4)); }
    return { geometry: merge(parts), material: vc(ctx, { side: THREE.DoubleSide }), base: 30, minGap: 0.8, range: 0.8, spread: 1, scale: [1, 1.1], place: "corner", shadow: false };
  },
  tyres: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) parts.push(P(To(0.38, 0.17, 6, 10).rotateX(Math.PI / 2).translate(s * 1.05 - 1.05, 0.17 + i * 0.34, 0), i === 3 ? "#ffffff" : "#1e1e22", i === 3 ? 1 : 0));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.9 }), base: 26, minGap: 0.6, range: 1.5, spread: 1, scale: [1, 1], place: "corner", tint: ["#E8504F", "#F4F1E6", "#3B82F6"], shadow: false };
  },
  flags: (ctx) => {
    const flag = new THREE.PlaneGeometry(1.6, 1.0, 4, 1).translate(0.8, 0, 0); const p = flag.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.4) * 0.15); flag.computeVertexNormals();
    return { geometry: merge([P(Cy(0.05, 0.06, 6, 5).translate(0, 3, 0), "#c9ced6"), P(flag.translate(0.05, 5.4, 0), "#ffffff", 1)]), material: vc(ctx, { sway: 0.4, side: THREE.DoubleSide }), base: 60, minGap: 1.2, range: 3, spread: 1, scale: [1, 1.1], faceTrack: true, tint: ["#E8504F", "#3B82F6", "#FFD25A", "#2FA866", "#FFFFFF"], place: "roadside", shadow: false };
  },
  floodlight: (ctx) => {
    const parts = [P(Cy(0.25, 0.4, 22, 6).translate(0, 11, 0), "#9aa0aa"), P(B(5, 3, 0.5).translate(0, 22.5, 0.3), "#3a3f47")];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) parts.push(P(B(1, 1, 0.1).translate(-1.8 + i * 1.2, 21.8 + j * 1.3, 0.6), "#FFF6DA", 0, -2.5));
    return { geometry: merge(parts), material: vc(ctx), base: 10, minGap: 6, range: 20, spread: 1, scale: [1, 1], faceTrack: true, place: "roadside", radius: 2 };
  },
  // ===================================================== buildings
  tower: (ctx) => {
    const map = TX.facades(ctx.night);
    const g = P(B(16, 48, 16).translate(0, 24, 0), "#ffffff", 0.35, ctx.night ? 0.95 : 0, 1);
    const uv = g.attributes.uv as THREE.BufferAttribute, pos = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const y = pos.getY(i); const side = Math.abs(nrm.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i); uv.setXY(i, (side / 16 + 0.5), Math.abs(nrm.getY(i)) > 0.5 ? 0.98 : (y / 48) * 0.98); }
    const roof = [P(B(10, 3, 10).translate(0, 49.5, 0), "#5a5f68"), P(Cy(0.15, 0.2, 8, 4).translate(3, 55, 2), "#5a5f68"), P(Sp(0.35, 5, 3).translate(3, 59, 2), "#FF3030", 0, -3), P(Cy(1.6, 1.6, 2.4, 8).translate(-3, 52, -2), "#6a5a4a")];
    for (const f of roof) { const u = f.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < u.count; i++) u.setXY(i, 0.01, 0.99); }
    return { geometry: merge([g, ...roof]), material: vc(ctx, { map, cells: [4, 1], rough: 0.55, metal: 0.15 }), base: 110, minGap: 12, range: 300, spread: 1.15, scale: [0.8, 1.5], stretchX: true, stretchY: true, faceTrack: true, cells: 4, radius: 12, tint: ctx.night ? ["#ffffff", "#d8d0ff", "#ffe0f0"] : ["#ffffff", "#E8EEF6", "#F4E6D8", "#DDE6EE"] };
  },
  glasstower: (ctx) => {
    const g = P(Cy(7, 9, 70, 6).translate(0, 35, 0), "#ffffff", 1);
    const parts = [g, P(Cy(5, 7, 8, 6).translate(0, 74, 0), "#ffffff", 1), P(Cy(0.2, 0.3, 14, 4).translate(0, 85, 0), "#9aa0aa"), P(Sp(0.4, 5, 3).translate(0, 92, 0), "#FF3030", 0, -3)];
    for (let k = 0; k < 14; k++) parts.push(P(Cy(9.05 - k * 0.14, 9.05 - k * 0.14, 0.35, 6).translate(0, 2 + k * 5, 0), ctx.night ? "#9FE8FF" : "#DDE6EE", 0, ctx.night ? 1.4 : 0));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.12, metal: 0.65, env: 1.4, flat: true }), base: 40, minGap: 20, range: 320, spread: 1.1, scale: [0.8, 1.4], stretchY: true, radius: 10, tint: ctx.night ? ["#3A4A7A", "#4A3A6A", "#2A5A7A"] : ["#7FA8D0", "#8AB8D8", "#6A98C0"] };
  },
  trafficlight: (ctx) => ({
    geometry: merge([P(Cy(0.12, 0.15, 6, 6).translate(0, 3, 0), "#3a3f47"), P(B(4, 0.15, 0.15).translate(2, 6, 0), "#3a3f47"), P(B(0.5, 1.4, 0.4).translate(3.6, 5.2, 0), "#1a1a1e"), P(Sp(0.15, 6, 4).translate(3.6, 5.65, 0.22), "#FF3030", 0, 2.2), P(Sp(0.15, 6, 4).translate(3.6, 5.2, 0.22), "#3a2a10"), P(Sp(0.15, 6, 4).translate(3.6, 4.75, 0.22), "#103a10")]),
    material: vc(ctx), base: 50, minGap: 0.8, range: 1, spread: 1, scale: [1, 1], faceTrack: true, place: "roadside", shadow: false,
  }),
  house: (ctx) => ({ geometry: merge(house(8, 4, 7, "#A8433A", { chimney: true, door: "#6A4A3A" })), material: vc(ctx), base: 40, minGap: 8, range: 160, spread: 1.3, scale: [0.9, 1.3], tint: ["#F2EDE0", "#E8D8C0", "#D8E0E8"], radius: 6 }),
  chalet: (ctx) => ({ geometry: merge([...house(9, 4.5, 8, "#4A3426", { wall: "#ffffff", snow: true, chimney: true, door: "#3A2A1E", windows: ctx.night ? "#FFD08A" : "#8FB4D8", lit: true, roofH: 3.2, overhang: 1.2 }), P(B(9.4, 1.2, 8.4).translate(0, 0.6, 0), "#9A9690")]), material: vc(ctx), base: 30, minGap: 8, range: 180, spread: 1.3, scale: [0.9, 1.3], tint: ["#8A5A36", "#7A4A2E", "#9A6A40"], radius: 7, faceTrack: true }),
  cabin: (ctx) => ({ geometry: merge(house(7, 3.4, 6, "#3A3A3A", { wall: "#ffffff", chimney: true, door: "#3A2A1E", windows: ctx.night ? "#FFC870" : "#8FB4D8", lit: true, overhang: 0.6 })), material: vc(ctx), base: 30, minGap: 8, range: 160, spread: 1.3, scale: [0.9, 1.2], tint: ["#7A4A2E", "#8A5A36"], radius: 6, faceTrack: true }),
  beachhut: (ctx) => {
    const parts = [...house(4, 2.6, 4, "#D9B46A", { wall: "#ffffff", roofH: 2.0, overhang: 0.8 }).map((g) => g.translate(0, 1.2, 0))];
    for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) parts.push(P(Cy(0.12, 0.12, 1.3, 5).translate(x, 0.6, z), "#8A6A42"));
    return { geometry: merge(parts), material: vc(ctx), base: 30, minGap: 6, range: 90, spread: 1.4, scale: [0.9, 1.2], tint: ["#4FC3D9", "#FFB547", "#FF7A8A", "#F4F1E6"], radius: 4, faceTrack: true };
  },
  beachhouse: (ctx) => ({ geometry: merge(house(10, 5, 8, "#3A6EA5", { wall: "#ffffff", door: "#3A6EA5", windows: ctx.night ? "#FFD08A" : "#8FB4D8", lit: true })), material: vc(ctx), base: 30, minGap: 8, range: 150, spread: 1.3, scale: [0.9, 1.3], tint: ["#F4F1E6", "#FFE8D0", "#E0F0F4"], radius: 7, faceTrack: true }),
  farmhouse: (ctx) => ({ geometry: merge([...house(11, 5, 8, "#C2683E", { wall: "#ffffff", chimney: true, door: "#5A7A8A", windows: "#5A7A8A", roofH: 2.2 })]), material: vc(ctx), base: 30, minGap: 10, range: 200, spread: 1.2, scale: [0.9, 1.3], tint: ["#E6D6BA", "#D8C6A6", "#EFE2C8"], radius: 8, faceTrack: true }),
  hauntedhouse: (ctx) => {
    const parts = [...house(9, 7, 8, "#2A2430", { wall: "#ffffff", chimney: true, door: "#1A1418", windows: "#FFB45A", lit: true, roofH: 4.5 })];
    parts.push(P(Cy(1.6, 1.6, 11, 8).translate(4.5, 5.5, 3.5), "#ffffff", 1), P(Co(2.2, 4.5, 8).translate(4.5, 13.2, 3.5), "#2A2430"), P(B(0.8, 1.0, 0.1).translate(4.5, 8, 5.1), "#FFB45A", 0, -2));
    const g = merge(parts); g.rotateZ(0.04);
    return { geometry: g, material: vc(ctx), base: 30, minGap: 10, range: 160, spread: 1.3, scale: [0.9, 1.3], tint: ["#4A4450", "#3A3A44", "#54485A"], radius: 7, faceTrack: true };
  },
  saloon: (ctx) => {
    const parts = [P(B(10, 5, 9).translate(0, 2.5, 0), "#ffffff", 1), P(B(10.4, 3, 0.3).translate(0, 6.4, 4.4), "#ffffff", 1), P(B(10, 0.2, 2.6).translate(0, 3.2, 5.6), "#6A4A2E"), P(B(9.6, 0.3, 2.6).translate(0, 0.15, 5.6), "#6A4A2E"), P(B(6, 0.9, 0.1).translate(0, 6.6, 4.6), "#F2E6C8")];
    for (const x of [-4.6, -1.6, 1.6, 4.6]) parts.push(P(Cy(0.1, 0.1, 3, 4).translate(x, 1.6, 6.7), "#5A3A22"));
    for (const x of [-3, 3]) parts.push(P(B(1.4, 1.6, 0.1).translate(x, 2.4, 4.52), ctx.night ? "#FFC870" : "#4A3A2E", 0, -1.2));
    return { geometry: merge(parts), material: vc(ctx), base: 30, minGap: 7, range: 120, spread: 1.4, scale: [0.9, 1.2], tint: ["#A87A50", "#9A6A44", "#B88A5A", "#C8A070"], radius: 7, faceTrack: true };
  },
  barn: (ctx) => {
    const parts = [P(B(12, 6, 16).translate(0, 3, 0), "#ffffff", 1)];
    const roof = new THREE.CylinderGeometry(7.4, 7.4, 16.6, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.75, 1).translate(0, 6, 0);
    parts.push(P(roof, "#4A4A4E"), P(B(4, 4.4, 0.2).translate(0, 2.2, 8.05), "#F2EDE0"), P(B(3.4, 3.8, 0.22).translate(0, 2.2, 8.06), "#ffffff", 1), P(B(1.4, 1.4, 0.2).translate(0, 8, 8.05), "#F2EDE0"));
    return { geometry: merge(parts), material: vc(ctx), base: 22, minGap: 12, range: 220, spread: 1.2, scale: [0.9, 1.2], tint: ["#B8322A", "#A82A24", "#C23A2E"], radius: 10, faceTrack: true };
  },
  silo: (ctx) => ({ geometry: merge([P(Cy(2.6, 2.6, 14, 12).translate(0, 7, 0), "#ffffff", 1), P(Sp(2.65, 12, 6, ).scale(1, 0.6, 1).translate(0, 14, 0), "#9AA0AA"), ...[2, 5, 8, 11].map((y) => P(Cy(2.65, 2.65, 0.2, 12).translate(0, y, 0), "#8A9098"))]), material: vc(ctx, { metal: 0.3, rough: 0.5 }), base: 22, minGap: 12, range: 220, spread: 1.2, scale: [0.9, 1.3], tint: ["#D8DCE2", "#C8CCD2", "#B8322A"], radius: 3.5 }),
  windmill: (ctx) => {
    const sails = merge([0, 1, 2, 3].map((i) => P(B(1.4, 8.5, 0.12).translate(0.45, 4.6, 0).rotateZ((i * Math.PI) / 2), "#F2EDE0")).concat([P(Cy(0.35, 0.35, 0.8, 8).rotateX(Math.PI / 2), "#5A4A3A")]));
    return { geometry: merge([P(Cy(2.2, 3.6, 12, 8).translate(0, 6, 0), "#ffffff", 1), P(Co(3.0, 3.8, 8).translate(0, 13.9, 0), "#5A4A3A"), P(B(1.2, 2, 0.2).translate(0, 1, 3.3), "#5A3A22"), P(Cy(3.8, 3.8, 0.3, 8).translate(0, 4, 0), "#6A5A4A")]), material: vc(ctx), base: 8, minGap: 20, range: 260, spread: 1.1, scale: [1, 1.3], tint: ["#E6DCCB", "#F2EDE0"], radius: 5, faceTrack: true, spin: { geometry: sails, pivot: [0, 12.5, 3.3], axis: "z", speed: 0.8 } };
  },
  turbine: (ctx) => {
    const blades = merge([0, 1, 2].map((i) => P(B(1.0, 22, 0.25).translate(0, 11, 0).rotateZ((i * Math.PI * 2) / 3), "#F4F6F8")).concat([P(Sp(1.1, 8, 6).scale(1, 1, 1.5), "#F4F6F8")]));
    return { geometry: merge([P(Cy(1.0, 1.9, 60, 10).translate(0, 30, 0), "#F4F6F8"), P(B(2.4, 2.4, 6).translate(0, 61, -1), "#F4F6F8"), P(Sp(0.25, 5, 3).translate(0, 62.4, -1), "#FF3030", 0, -3)]), material: vc(ctx, { rough: 0.5 }), base: 14, minGap: 60, range: 700, spread: 1, scale: [0.9, 1.1], place: "far", radius: 12, spin: { geometry: blades, pivot: [0, 61, 2.3], axis: "z", speed: 1.4 } };
  },
  ferriswheel: (ctx) => {
    const R = 16, glow = ctx.night ? -1.8 : 0;
    const wheel: THREE.BufferGeometry[] = [P(To(R, 0.35, 6, 40), "#F4F4F8", 0, glow), P(To(R * 0.93, 0.18, 5, 40), "#E8304A", 0, glow), P(Cy(1.2, 1.2, 2.2, 10).rotateX(Math.PI / 2), "#9aa0aa")];
    const cab = ["#E8304A", "#FFB547", "#3B82F6", "#2FA866", "#9B5DE5", "#FF8AC2"];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      wheel.push(P(B(0.16, R, 0.16).translate(0, R / 2, 0).rotateZ(a), "#D8DCE2"));
      wheel.push(P(B(1.5, 1.7, 1.5).translate(Math.cos(a) * R, Math.sin(a) * R - 1.3, 0), cab[i % cab.length], 0, ctx.night ? -0.6 : 0));
    }
    const legs = [V3(-7, 0, -2.5), V3(7, 0, -2.5), V3(-7, 0, 2.5), V3(7, 0, 2.5)].map((b) => P(beam(b, V3(0, R + 2, Math.sign(b.z) * 1.3), 0.35, 6), "#C9CED6"));
    legs.push(P(B(16, 0.8, 7).translate(0, 0.4, 0), "#6a6f78"), P(B(4, 3, 3).translate(0, 1.5, 4), "#E8E4DC"));
    return { geometry: merge(legs), material: vc(ctx, { metal: 0.3, rough: 0.5 }), base: 3, minGap: 25, range: 160, spread: 1.2, scale: [1, 1.15], faceTrack: true, radius: 12, spin: { geometry: merge(wheel), pivot: [0, R + 2, 0], axis: "z", speed: 0.12 } };
  },
  watertower: (ctx) => {
    const parts = [P(Cy(3, 3, 4.5, 12).translate(0, 10.5, 0), "#8A6A48"), P(Co(3.3, 1.8, 12).translate(0, 13.6, 0), "#5A4632")];
    for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) parts.push(P(Cy(0.18, 0.22, 8.5, 5).translate(x, 4.25, z), "#6A5032"));
    for (const y of [3, 6]) parts.push(P(Cy(0.08, 0.08, 6.8, 4).rotateZ(Math.PI / 2).translate(0, y, 2.4), "#6A5032"), P(Cy(0.08, 0.08, 6.8, 4).rotateZ(Math.PI / 2).translate(0, y, -2.4), "#6A5032"));
    return { geometry: merge(parts), material: vc(ctx), base: 12, minGap: 10, range: 160, spread: 1.3, scale: [0.9, 1.2], radius: 4 };
  },
  windpump: (ctx) => {
    const fan = merge(Array.from({ length: 12 }, (_, i) => P(B(0.5, 2.0, 0.05).translate(0, 1.2, 0).rotateZ((i / 12) * Math.PI * 2), "#C9CED6")));
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(P(Cy(0.07, 0.07, 10, 4).translate(0, 5, 0).rotateZ(-x * 0.08).rotateX(z * 0.08).translate(x, 0, z), "#7A6A5A"));
    parts.push(P(B(0.6, 0.6, 1.6).translate(0, 10, 0), "#5A5A5E"), P(B(0.05, 1.4, 1.8).translate(0, 10, -1.6), "#C9CED6"));
    return { geometry: merge(parts), material: vc(ctx), base: 14, minGap: 8, range: 160, spread: 1.3, scale: [0.9, 1.2], radius: 2, spin: { geometry: fan, pivot: [0, 10, 0.9], axis: "z", speed: 2.2 } };
  },
  lighthouse: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) parts.push(P(Cy(2.6 - (i + 1) * 0.18, 2.6 - i * 0.18, 3.6, 12).translate(0, 1.8 + i * 3.6, 0), i % 2 ? "#E8304A" : "#F4F4F0"));
    parts.push(P(Cy(1.8, 1.8, 0.4, 12).translate(0, 21.8, 0), "#2a2a33"), P(Cy(1.2, 1.2, 2.2, 10).translate(0, 23.1, 0), "#FFF2C0", 0, ctx.night ? 3 : 0.6), P(Co(1.5, 1.6, 10).translate(0, 25, 0), "#2a2a33"), P(B(5, 3, 4).translate(3.5, 1.5, 0), "#F4F4F0"), P(B(5.4, 0.6, 4.4).translate(3.5, 3.3, 0), "#E8304A"));
    return { geometry: merge(parts), material: vc(ctx), base: 5, minGap: 30, range: 300, spread: 1.1, scale: [1, 1.2], radius: 5 };
  },
  crane: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (const x of [-6, 6]) for (const z of [-4, 4]) parts.push(P(B(0.8, 22, 0.8).translate(x, 11, z), "#ffffff", 1));
    for (const x of [-6, 6]) parts.push(P(B(1, 1, 9).translate(x, 22, 0), "#ffffff", 1));
    parts.push(P(B(13, 2, 1.4).translate(0, 23, 0), "#ffffff", 1), P(B(3, 1.6, 34).translate(0, 24.8, 6), "#ffffff", 1), P(B(4, 3, 4).translate(0, 22, 0), "#3a3f47"), P(B(0.15, 10, 0.15).translate(0, 19, 18), "#2a2a2e"), P(B(3, 1.2, 1.2).translate(0, 14, 18), "#F2C230"));
    return { geometry: merge(parts), material: vc(ctx, { metal: 0.3, rough: 0.5 }), base: 16, minGap: 12, range: 120, spread: 1.2, scale: [0.9, 1.2], tint: ["#F2C230", "#E8504F", "#3B82F6"], faceTrack: true, radius: 10 };
  },
  containers: (ctx) => {
    const cols = ["#C2412E", "#2E6CB0", "#2FA866", "#F2A230", "#7A4AB0", "#E8E4DC", "#3A8A8A", "#B8322A"];
    const parts: THREE.BufferGeometry[] = [];
    let k = 0;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3 - (x % 2); y++) for (let z = 0; z < 2; z++) { const c = cols[(k++ * 5 + x * 3) % cols.length]; parts.push(jitter(P(B(2.44, 2.6, 6.06).translate(x * 2.6 - 2.6, 1.3 + y * 2.6, z * 6.3 - 3.15), c), 0.06, k)); for (let r = 0; r < 5; r++) parts.push(P(B(2.46, 2.3, 0.08).translate(x * 2.6 - 2.6, 1.3 + y * 2.6, z * 6.3 - 3.15 - 2.4 + r * 1.2), c)); }
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.6, metal: 0.2 }), base: 60, minGap: 4, range: 100, spread: 1.4, scale: [0.9, 1.1], faceTrack: true, radius: 7 };
  },
  warehouse: (ctx) => {
    const parts = [P(B(24, 8, 16).translate(0, 4, 0), "#ffffff", 1)];
    for (let i = 0; i < 4; i++) parts.push(P(Cy(0.01, 3.4, 2.4, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 1, 16 / 6.8).translate(-9 + i * 6, 9, 0), "#8A9098"));
    parts.push(P(B(6, 5, 0.2).translate(-5, 2.5, 8.05), "#5A6068"), P(B(6, 5, 0.2).translate(5, 2.5, 8.05), "#5A6068"), P(B(10, 1.2, 0.1).translate(0, 6.8, 8.06), "#F2E6C8"));
    return { geometry: merge(parts), material: vc(ctx), base: 24, minGap: 8, range: 160, spread: 1.3, scale: [0.9, 1.3], tint: ["#B8C0C8", "#A8B0B8", "#C8B8A8"], faceTrack: true, radius: 14 };
  },
  boat: (ctx) => {
    const hull = La([[0.01, 0], [1.2, 0.2], [1.6, 0.9], [1.7, 1.4]], 10).scale(1, 1, 2.6);
    return { geometry: merge([P(hull, "#ffffff", 1), P(B(1.6, 1.2, 2.2).translate(0, 1.9, -0.6), "#F4F4F0"), P(B(1.7, 0.15, 2.4).translate(0, 2.55, -0.6), "#3a3f47"), P(Cy(0.06, 0.06, 4, 4).translate(0, 3.5, 1.2), "#9aa0aa")]), material: vc(ctx), base: 50, minGap: 10, range: 360, spread: 1.1, scale: [0.9, 1.6], tint: ["#E8504F", "#3B82F6", "#F4F1E6", "#2FA866"], place: "water", radius: 4.5 };
  },
  ship: (ctx) => {
    const parts = [P(B(9, 4, 50).translate(0, 1, 0), "#ffffff", 1), P(B(9.2, 1.2, 50.2).translate(0, 3.4, 0), "#E8E4DC"), P(B(8, 8, 6).translate(0, 7.5, -20), "#F4F4F0"), P(Cy(1, 1, 4, 8).translate(0, 13, -20), "#E8504F")];
    const cols = ["#C2412E", "#2E6CB0", "#2FA866", "#F2A230", "#7A4AB0"];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) parts.push(P(B(2.4, 2.5, 5.9).translate(-2.6 + j * 2.6, 5.3, -12 + i * 6.2), cols[(i * 3 + j) % 5]));
    return { geometry: merge(parts), material: vc(ctx), base: 10, minGap: 40, range: 500, spread: 1, scale: [0.9, 1.3], tint: ["#2A3A4A", "#3A2A2A", "#1E3A5A"], place: "water", radius: 26 };
  },
  buoy: (ctx) => ({ geometry: merge([P(Cy(0.5, 0.7, 1.2, 8).translate(0, 0.3, 0), "#ffffff", 1), P(Co(0.4, 1.3, 8).translate(0, 1.5, 0), "#ffffff", 1), P(Sp(0.15, 5, 3).translate(0, 2.3, 0), "#FFF2A0", 0, -3)]), material: vc(ctx, { bob: 0.25 }), base: 40, minGap: 6, range: 200, spread: 1.2, scale: [1, 1.3], tint: ["#E8304A", "#2FA866"], place: "water", shadow: false }),
  longship: (ctx) => {
    const hull = La([[0.01, 0], [1.4, 0.3], [2, 1.2], [2.1, 1.6]], 10).scale(1, 1, 4.5);
    const parts = [P(hull, "#7A5A3A"), P(Cy(0.12, 0.15, 8, 5).translate(0, 5, 0), "#5A4030"), P(B(5, 4, 0.1).translate(0, 6, 0.2), "#ffffff", 1), P(Cy(0.2, 0.25, 2.5, 5).rotateX(0.5).translate(0, 2.4, 9.8), "#7A5A3A")];
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) parts.push(P(Cy(0.4, 0.4, 0.1, 8).rotateZ(Math.PI / 2).translate(s * 2.1, 1.4, -6 + i * 2), ["#E8504F", "#F2C230", "#3B82F6"][i % 3]));
    return { geometry: merge(parts), material: vc(ctx), base: 20, minGap: 14, range: 380, spread: 1.1, scale: [1, 1.4], tint: ["#E8504F", "#F4F1E6", "#C23A2E"], place: "water", radius: 9 };
  },
  // ===================================================== space
  moondome: (ctx) => ({
    geometry: merge([P(Hemi(8, 16, 6), "#ffffff", 1), P(Cy(8.3, 8.6, 1.2, 16).translate(0, 0.3, 0), "#7A7E86"), P(Cy(8.05, 8.05, 0.8, 16, true).translate(0, 2.4, 0), "#BEE6FF", 0, ctx.night ? 1.6 : 0.4), P(B(3, 3, 6).translate(0, 1.5, 9), "#D8DCE2")]),
    material: vc(ctx, { rough: 0.35, metal: 0.4 }), base: 24, minGap: 12, range: 220, spread: 1.2, scale: [0.6, 1.4], tint: ["#E8ECF2", "#D8DCE2"], radius: 10, faceTrack: true,
  }),
  rocket: (ctx) => {
    const parts = [P(Cy(2.2, 2.2, 30, 12).translate(0, 17, 0), "#F4F6F8"), P(Co(2.2, 7, 12).translate(0, 35.5, 0), "#E8304A"), P(Cy(2.25, 2.25, 2, 12).translate(0, 26, 0), "#2a2a33")];
    for (let i = 0; i < 4; i++) parts.push(P(B(0.3, 5, 3).translate(0, 4, 3).rotateY((i * Math.PI) / 2), "#E8304A"));
    for (let i = 0; i < 5; i++) parts.push(P(B(0.4, 40, 0.4).translate(6 + (i % 2), 20, -2 + (i >> 1) * 2), "#9aa0aa"));
    parts.push(P(B(5, 0.4, 0.4).translate(4, 30, 0), "#9aa0aa"), P(Sp(0.4, 5, 3).translate(7, 40.5, 0), "#FF3030", 0, -3));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.4, metal: 0.2 }), base: 5, minGap: 30, range: 260, spread: 1.1, scale: [0.9, 1.2], radius: 9 };
  },
  dish: (ctx) => ({
    geometry: merge([P(La([[0.01, 0], [2, 0.3], [3.6, 1.2], [4.2, 1.9]], 14).rotateX(-0.9).translate(0, 6.5, 0), "#E8ECF2"), P(Cy(0.4, 0.6, 6, 8).translate(0, 3, 0), "#9aa0aa"), P(Cy(0.05, 0.05, 3, 4).rotateX(-0.9 + Math.PI / 2).translate(0, 7.6, 1.2), "#9aa0aa"), P(B(3, 1.2, 3).translate(0, 0.6, 0), "#7A7E86")]),
    material: vc(ctx, { rough: 0.4, metal: 0.4, side: THREE.DoubleSide }), base: 20, minGap: 8, range: 200, spread: 1.2, scale: [0.8, 1.4], radius: 5, faceTrack: true,
  }),
  solarpanel: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) { parts.push(P(B(3, 0.1, 2).rotateX(-0.5).translate(i * 3.3 - 5, 1.6, 0), "#1E3A6A")); parts.push(P(B(0.12, 1.4, 0.12).translate(i * 3.3 - 5, 0.7, 0), "#9aa0aa")); }
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.15, metal: 0.6, env: 1.3 }), base: 40, minGap: 5, range: 160, spread: 1.3, scale: [0.9, 1.2], faceTrack: true, radius: 7, shadow: false };
  },
  rover: (ctx) => {
    const parts = [P(B(2.4, 1.0, 3.4).translate(0, 1.2, 0), "#E8ECF2"), P(B(2.0, 0.6, 1.0).translate(0, 1.9, 1.0), "#2a2a33"), P(Cy(0.05, 0.05, 1.6, 4).translate(0.8, 2.6, -1), "#9aa0aa"), P(Sp(0.3, 6, 4).translate(0.8, 3.4, -1), "#9aa0aa"), P(B(2.8, 0.06, 1.6).translate(0, 1.75, -1.2), "#1E3A6A")];
    for (const x of [-1.3, 1.3]) for (const z of [-1.2, 0, 1.2]) parts.push(P(Cy(0.45, 0.45, 0.35, 8).rotateZ(Math.PI / 2).translate(x, 0.45, z), "#3a3a40"));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.5, metal: 0.3 }), base: 20, minGap: 5, range: 100, spread: 1.3, scale: [1, 1.2], radius: 2.5 };
  },
  antenna: (ctx) => ({
    geometry: merge([P(Cy(0.1, 0.5, 16, 3).translate(0, 8, 0), "#9aa0aa"), P(Sp(0.3, 5, 3).translate(0, 16.4, 0), "#FF3030", 0, 3), P(B(1.6, 0.1, 0.1).translate(0, 12, 0), "#9aa0aa"), P(B(1.2, 0.1, 0.1).translate(0, 14, 0), "#9aa0aa")]),
    material: vc(ctx, { flat: true }), base: 30, minGap: 6, range: 160, spread: 1.3, scale: [0.9, 1.4], shadow: false, radius: 1,
  }),
  // ===================================================== ancient / cultural
  pyramid: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 10; i++) parts.push(jitter(P(B(80 - i * 8, 6.6, 80 - i * 8).translate(0, 3.3 + i * 6.6, 0), i % 2 ? "#ffffff" : "#f2ead8", 1), 0.03, i));
    parts.push(P(Co(5.6, 6, 4).rotateY(Math.PI / 4).translate(0, 69, 0), "#F2C230"));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.95 }), base: 4, minGap: 140, range: 520, spread: 1, scale: [0.8, 1.5], tint: ["#D9B47A", "#CFA86A"], place: "far", radius: 60, sink: 3 };
  },
  obelisk: (ctx) => ({ geometry: merge([P(Cy(0.7, 1.2, 14, 4).rotateY(Math.PI / 4).translate(0, 7.6, 0), "#D9BE86"), P(Co(0.98, 1.6, 4).rotateY(Math.PI / 4).translate(0, 15.4, 0), "#F2C230"), P(B(3.4, 0.8, 3.4).translate(0, 0.4, 0), "#C8AE7E")]), material: vc(ctx), base: 30, minGap: 4, range: 120, spread: 1.4, scale: [0.8, 1.4], radius: 2 }),
  sphinx: (ctx) => ({
    geometry: merge([jitter(P(B(8, 6, 20).translate(0, 3, -2), "#D9B47A"), 0.08), jitter(P(B(5, 7, 5).translate(0, 8, 8), "#D9B47A"), 0.08), P(B(7, 4, 4).translate(0, 9.5, 7.2), "#3A5A9A"), P(B(2.5, 2, 9).translate(-2.6, 1, 10), "#CFA86A"), P(B(2.5, 2, 9).translate(2.6, 1, 10), "#CFA86A")]),
    material: vc(ctx, { flat: true }), base: 2, minGap: 40, range: 200, spread: 1, scale: [1, 1.3], faceTrack: true, radius: 14, sink: 1,
  }),
  column: (ctx) => {
    const parts = [P(Cy(0.9, 1.0, 8, 10).translate(0, 4.6, 0), "#E6D2A8"), P(Cy(1.4, 0.9, 1.2, 10).translate(0, 9.2, 0), "#2F6FB0"), P(B(2.8, 0.6, 2.8).translate(0, 0.3, 0), "#D9C08A")];
    for (let i = 0; i < 4; i++) parts.push(P(Cy(1.02, 1.02, 0.3, 10).translate(0, 2 + i * 1.8, 0), "#C9A86A"));
    return { geometry: merge(parts), material: vc(ctx), base: 50, minGap: 3, range: 100, spread: 1.4, scale: [0.8, 1.3], stretchY: true, radius: 1.5, cluster: 0.7 };
  },
  ruinpillar: (ctx) => {
    const parts = [jitter(P(Cy(0.8, 0.9, 5, 8).translate(0, 2.5, 0), "#ffffff", 1), 0.1), P(B(2.2, 0.6, 2.2).translate(0, 0.3, 0), "#ffffff", 1), jitter(P(Cy(0.8, 0.8, 3, 8).rotateZ(Math.PI / 2).translate(2.5, 0.8, 1), "#ffffff", 1), 0.1), P(B(1.2, 0.9, 1.4).rotateY(0.4).translate(-1.6, 0.45, -1.2), "#ffffff", 1)];
    for (let i = 0; i < 4; i++) parts.push(P(B(0.15, 3, 0.4).translate(0.85 * Math.cos(i), 2.5, 0.85 * Math.sin(i)), "#3A7A2A"));
    return { geometry: merge(parts), material: vc(ctx, { rough: 1 }), base: 60, minGap: 3, range: 120, spread: 1.4, scale: [0.8, 1.6], tint: ["#9A9A8A", "#8A8A7A", "#A8A496"], stretchY: true, radius: 2.5, cluster: 0.6 };
  },
  steppyramid: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) parts.push(jitter(P(B(46 - i * 6, 4.4, 46 - i * 6).translate(0, 2.2 + i * 4.4, 0), "#ffffff", 1), 0.06, i));
    parts.push(P(B(4, 30, 10).translate(0, 15, 20), "#8A8A7A"), P(B(10, 6, 10).translate(0, 33.8, 0), "#7A7A6A"), P(B(3, 3.4, 0.4).translate(0, 32.5, 5.1), "#2a2a2a"));
    return { geometry: merge(parts), material: vc(ctx, { rough: 1 }), base: 4, minGap: 60, range: 300, spread: 1, scale: [0.9, 1.3], tint: ["#8A9A7A", "#9A9A8A"], faceTrack: true, radius: 26, sink: 2 };
  },
  stonehead: (ctx) => ({
    geometry: merge([jitter(P(B(3, 6, 2.6).translate(0, 3, 0), "#ffffff", 1), 0.1), jitter(P(B(3.2, 1.2, 2.8).translate(0, 5.4, 0.2), "#ffffff", 1), 0.1), P(B(0.7, 2, 1).translate(0, 3.6, 1.5), "#ffffff", 1), P(B(2.2, 0.4, 0.3).translate(0, 2.2, 1.35), "#4A4A40"), P(B(0.6, 0.3, 0.3).translate(-0.8, 4.4, 1.35), "#2A2A20"), P(B(0.6, 0.3, 0.3).translate(0.8, 4.4, 1.35), "#2A2A20")]),
    material: vc(ctx, { flat: true, rough: 1 }), base: 16, minGap: 5, range: 120, spread: 1.4, scale: [0.9, 1.6], tint: ["#7A7A6A", "#8A8A7A"], faceTrack: true, radius: 2.5, sink: 0.4,
  }),
  stonelantern: (ctx) => ({
    geometry: merge([P(Cy(0.7, 0.9, 0.4, 6).translate(0, 0.2, 0), "#9A968C"), P(Cy(0.22, 0.3, 1.4, 6).translate(0, 1.1, 0), "#9A968C"), P(Cy(0.6, 0.5, 0.3, 6).translate(0, 1.95, 0), "#9A968C"), P(B(0.65, 0.6, 0.65).translate(0, 2.4, 0), "#FFD08A", 0, -2.2), P(Co(0.9, 0.7, 6).translate(0, 3.05, 0), "#8A867C"), P(Sp(0.15, 5, 3).translate(0, 3.5, 0), "#8A867C")]),
    material: vc(ctx), base: 70, minGap: 1.5, range: 30, spread: 1.6, scale: [0.9, 1.3], radius: 0.8,
  }),
  pagoda: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const w = 8 - i * 1.2, y = i * 4.2;
      parts.push(P(B(w * 0.7, 3.4, w * 0.7).translate(0, y + 1.7, 0), "#ffffff", 1));
      parts.push(P(new THREE.CylinderGeometry(w * 0.32, w * 0.82, 1.4, 4).rotateY(Math.PI / 4).translate(0, y + 3.8, 0), "#3A3A44"));
    }
    parts.push(P(Cy(0.12, 0.12, 5, 5).translate(0, 23.5, 0), "#C9A23C"));
    return { geometry: merge(parts), material: vc(ctx), base: 6, minGap: 18, range: 260, spread: 1.1, scale: [0.9, 1.3], tint: ["#C2412E", "#B8322A"], radius: 6, faceTrack: true };
  },
  shrine: (ctx) => {
    const parts = [P(B(5, 3, 4).translate(0, 2.0, 0), "#ffffff", 1), P(B(5.6, 0.5, 4.6).translate(0, 0.25, 0), "#8A867C"), P(new THREE.CylinderGeometry(1.4, 4.4, 1.8, 4).rotateY(Math.PI / 4).scale(1, 1, 0.85).translate(0, 4.4, 0), "#2E3A44")];
    for (const x of [-2.2, 2.2]) parts.push(P(Cy(0.15, 0.15, 3, 6).translate(x, 2, 2.2), "#C2412E"));
    parts.push(P(B(1.4, 1.6, 0.1).translate(0, 2.2, 2.05), "#FFD08A", 0, -1.5));
    return { geometry: merge(parts), material: vc(ctx), base: 14, minGap: 6, range: 120, spread: 1.3, scale: [0.9, 1.2], tint: ["#E8DCC8", "#C2412E"], radius: 4, faceTrack: true };
  },
  runestone: (ctx) => {
    const g = jitter(P(lumpy(B(1.6, 4, 0.6).translate(0, 2, 0), 0.06), "#ffffff", 1), 0.12);
    const parts = [g];
    for (let i = 0; i < 6; i++) parts.push(P(B(0.9 - (i % 2) * 0.3, 0.06, 0.02).translate(0, 0.8 + i * 0.5, 0.32), "#8A3A2A"));
    return { geometry: merge(parts), material: vc(ctx, { flat: true }), base: 40, minGap: 3, range: 90, spread: 1.5, scale: [0.8, 1.4], tint: ["#7A7E80", "#8A8E8A"], faceTrack: true, radius: 1 };
  },
  longhouse: (ctx) => {
    const roof = new THREE.CylinderGeometry(4.6, 4.6, 20, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.9, 1).translate(0, 3, 0);
    return { geometry: merge([P(B(8, 3, 19).translate(0, 1.5, 0), "#6A4A2E"), P(roof, "#ffffff", 1), P(B(1.4, 2.2, 0.2).translate(0, 1.1, 9.6), "#3A2A1E"), P(B(0.2, 2.4, 0.2).rotateZ(0.6).translate(-0.8, 7.2, 10), "#5A3A22"), P(B(0.2, 2.4, 0.2).rotateZ(-0.6).translate(0.8, 7.2, 10), "#5A3A22")]), material: vc(ctx), base: 18, minGap: 10, range: 180, spread: 1.3, scale: [0.9, 1.2], tint: ["#5A7A3A", "#6A8A44", "#8A7A4A"], radius: 10, faceTrack: true };
  },
  stavechurch: (ctx) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) { const w = 10 - i * 2.4; parts.push(P(B(w * 0.8, 3, w * 0.8).translate(0, 1.5 + i * 3.4, 0), "#3A2A1E")); parts.push(P(new THREE.CylinderGeometry(0.1, w * 0.72, 2.2, 4).rotateY(Math.PI / 4).translate(0, 4 + i * 3.4, 0), "#2A1E16")); }
    parts.push(P(Co(1, 6, 4).rotateY(Math.PI / 4).translate(0, 17, 0), "#2A1E16"));
    return { geometry: merge(parts), material: vc(ctx), base: 3, minGap: 25, range: 220, spread: 1.1, scale: [1, 1.2], radius: 8 };
  },
  gravestone: (ctx) => ({
    geometry: merge([jitter(P(B(0.9, 1.1, 0.22).translate(0, 0.55, 0), "#ffffff", 1), 0.1), P(Cy(0.45, 0.45, 0.22, 8, false).rotateX(Math.PI / 2).translate(0, 1.1, 0), "#ffffff", 1), P(B(1.2, 0.15, 0.6).translate(0, 0.07, 0.2), "#5A5A50")]),
    material: vc(ctx), base: 260, minGap: 1.5, range: 60, spread: 1.4, scale: [0.8, 1.4], tint: ["#8A8A90", "#9A9A98", "#7A7A80"], shadow: false, cluster: 0.7,
  }),
  crypt: (ctx) => ({
    geometry: merge([P(B(5, 4, 7).translate(0, 2, 0), "#7A7A80"), P(new THREE.CylinderGeometry(0.01, 3.9, 2.4, 4).rotateY(Math.PI / 4).scale(1, 1, 1.35).translate(0, 5.2, 0), "#5A5A60"), P(B(1.6, 2.6, 0.1).translate(0, 1.3, 3.55), "#1A1418"), P(B(0.3, 1.6, 0.3).translate(0, 7.2, 0), "#7A7A80"), P(B(1, 0.3, 0.3).translate(0, 7.5, 0), "#7A7A80")]),
    material: vc(ctx), base: 10, minGap: 6, range: 120, spread: 1.3, scale: [0.9, 1.2], radius: 4.5, faceTrack: true,
  }),
  igloo: (ctx) => {
    const dome = P(Hemi(3, 14, 6), "#F4F8FF");
    const c = dome.attributes.color as THREE.BufferAttribute, p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) if (Math.abs(Math.sin(p.getY(i) * 5.5)) < 0.18) c.setXYZ(i, 0.82, 0.88, 0.95);
    return { geometry: merge([dome, P(Cy(1.1, 1.1, 2.2, 8, false, ).rotateX(Math.PI / 2).translate(0, 0.6, 3.1), "#E8F0FA"), P(B(1.2, 1.2, 0.1).translate(0, 0.7, 4.2), ctx.night ? "#FFC870" : "#3A4A5A", 0, -1.8)]), material: vc(ctx), base: 30, minGap: 5, range: 120, spread: 1.4, scale: [0.9, 1.3], radius: 3.5, faceTrack: true };
  },
  snowman: (ctx) => ({ geometry: merge([P(Sp(1.0, 10, 8).translate(0, 0.9, 0), "#F4F8FF"), P(Sp(0.7, 10, 8).translate(0, 2.3, 0), "#F4F8FF"), P(Sp(0.5, 10, 8).translate(0, 3.3, 0), "#F4F8FF"), P(Co(0.1, 0.6, 5).rotateX(Math.PI / 2).translate(0, 3.3, 0.7), "#F28A2A"), P(Cy(0.4, 0.4, 0.6, 8).translate(0, 3.95, 0), "#2a2a2a"), P(Cy(0.6, 0.6, 0.06, 8).translate(0, 3.66, 0), "#2a2a2a"), P(B(1.5, 0.2, 0.2).translate(0, 2.4, 0.4), "#E8504F")]), material: vc(ctx), base: 20, minGap: 3, range: 60, spread: 1.5, scale: [0.9, 1.3], faceTrack: true, radius: 1 }),
  skilift: (ctx) => ({ geometry: merge([P(Cy(0.35, 0.5, 14, 6).translate(0, 7, 0), "#9aa0aa"), P(B(8, 0.6, 0.6).translate(0, 14, 0), "#7a808a"), P(Cy(0.6, 0.6, 0.3, 10).rotateZ(Math.PI / 2).translate(-3.8, 13.6, 0), "#3a3f47"), P(Cy(0.6, 0.6, 0.3, 10).rotateZ(Math.PI / 2).translate(3.8, 13.6, 0), "#3a3f47"), P(B(1.4, 1.2, 1.0).translate(3.8, 10.2, 0), "#E8504F"), P(B(0.06, 3.2, 0.06).translate(3.8, 12, 0), "#2a2a2e")]), material: vc(ctx, { metal: 0.4, rough: 0.5 }), base: 12, minGap: 20, range: 260, spread: 1.1, scale: [1, 1.3], radius: 4 }),
  umbrella: (ctx) => {
    const top = P(Co(1.8, 0.7, 10).translate(0, 2.6, 0), "#ffffff", 1); const c = top.attributes.aTint as THREE.BufferAttribute, p = top.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); c.setX(i, Math.floor(((a + Math.PI) / (Math.PI * 2)) * 10) % 2 ? 0 : 1); }
    return { geometry: merge([top, P(Cy(0.04, 0.04, 2.6, 4).translate(0, 1.3, 0), "#F4F1E6"), P(B(0.7, 0.1, 1.8).translate(0.9, 0.3, 0.3), "#ffffff", 1)]), material: vc(ctx), base: 60, minGap: 3, range: 80, spread: 1.4, scale: [1, 1.2], tint: ["#E8304A", "#3B82F6", "#FFB547", "#2FA866"], shadow: false, cluster: 0.6, radius: 1.8 };
  },
  lifeguard: (ctx) => ({ geometry: merge([P(B(2.4, 2, 2.4).translate(0, 4, 0), "#E8304A"), P(B(2.8, 0.3, 2.8).translate(0, 5.1, 0), "#F4F1E6"), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => P(Cy(0.1, 0.12, 3, 5).translate(x, 1.5, z), "#F4F1E6")), P(B(1, 0.1, 3).rotateX(0.7).translate(0, 1.6, 2.2), "#C9A46A")]), material: vc(ctx), base: 8, minGap: 8, range: 60, spread: 1.4, scale: [1, 1.1], faceTrack: true, radius: 2.5 }),
  barrel: (ctx) => ({ geometry: merge([[0, 0], [1.1, 0.3], [0.4, 1.0]].flatMap(([x, z]) => [P(Cy(0.45, 0.45, 1.2, 9).translate(x, 0.6, z), "#8A5A32"), P(Cy(0.47, 0.47, 0.08, 9).translate(x, 0.25, z), "#3a3a3a"), P(Cy(0.47, 0.47, 0.08, 9).translate(x, 0.95, z), "#3a3a3a")])), material: vc(ctx), base: 40, minGap: 1.5, range: 40, spread: 1.4, scale: [0.9, 1.1], shadow: false }),
  // ===================================================== cyber
  datatower: (ctx) => {
    const parts = [P(B(6, 50, 6).translate(0, 25, 0), "#12101e")];
    for (let i = 0; i < 4; i++) parts.push(P(B(0.25, 50, 0.25).translate(i % 2 ? 3 : -3, 25, i < 2 ? 3 : -3), "#ffffff", 1, 1.6));
    for (let k = 0; k < 8; k++) parts.push(P(B(6.1, 0.3, 6.1).translate(0, 4 + k * 6, 0), "#ffffff", 1, 1.4));
    parts.push(P(Co(3, 6, 4).rotateY(Math.PI / 4).translate(0, 53, 0), "#ffffff", 1, 1.2));
    return { geometry: merge(parts), material: vc(ctx, { rough: 0.3, metal: 0.5 }), base: 60, minGap: 14, range: 280, spread: 1.15, scale: [0.7, 1.5], stretchY: true, tint: ["#00E5FF", "#FF3FD8", "#9B6BFF"], radius: 6 };
  },
  wirepyramid: (ctx) => {
    const parts = [P(Co(14, 20, 4).rotateY(Math.PI / 4).translate(0, 10, 0), "#0A0816")];
    const top = V3(0, 20, 0), c = [V3(-10, 0, -10), V3(10, 0, -10), V3(10, 0, 10), V3(-10, 0, 10)];
    for (let i = 0; i < 4; i++) { parts.push(P(beam(c[i], top, 0.25), "#ffffff", 1, 1.6)); parts.push(P(beam(c[i], c[(i + 1) % 4], 0.25), "#ffffff", 1, 1.6)); }
    return { geometry: merge(parts), material: vc(ctx, { flat: true }), base: 14, minGap: 20, range: 300, spread: 1.1, scale: [0.7, 1.6], tint: ["#00E5FF", "#FF3FD8"], radius: 14 };
  },
  cube: (ctx) => ({ geometry: merge([P(B(3, 3, 3), "#0A0816"), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([a, b]) => [P(B(3.1, 0.15, 0.15).translate(0, a * 1.5, b * 1.5), "#ffffff", 1, 1.8), P(B(0.15, 3.1, 0.15).translate(a * 1.5, 0, b * 1.5), "#ffffff", 1, 1.8), P(B(0.15, 0.15, 3.1).translate(a * 1.5, b * 1.5, 0), "#ffffff", 1, 1.8)])]), material: vc(ctx), base: 50, minGap: 6, range: 160, spread: 1.3, scale: [0.6, 1.8], tint: ["#00E5FF", "#FF3FD8", "#9B6BFF"], place: "air", air: [4, 30], shadow: false }),
};

/** a few props are mostly for distant scenery; the quality setting thins them differently */
export const FAR_PROPS = new Set(["mesa", "pyramid", "turbine", "steppyramid", "castle", "ship"]);
