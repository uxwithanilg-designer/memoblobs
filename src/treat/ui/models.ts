// Treatrio's 3D treats, built from simple shapes and merged into one vertex-coloured geometry each (one draw call per
// treat on the shelf). Every model stands on y = 0, is about 1 unit tall and at most ~0.8 wide, facing +z.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type G = THREE.BufferGeometry;
/** one coloured part: geometry placed by position / rotation / scale */
function part(g: G, color: string, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scl: [number, number, number] = [1, 1, 1]): G {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl));
  const out = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
  out.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = out.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.dispose();
  return out;
}
const merge = (parts: G[]) => { const g = mergeGeometries(parts, false)!; parts.forEach((p) => p.dispose()); g.computeBoundingBox(); return g; };
const PI = Math.PI;
const sph = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const tor = (r: number, t: number, arc = PI * 2) => new THREE.TorusGeometry(r, t, 12, 28, arc);
const cone = (r: number, h: number, s = 18) => new THREE.ConeGeometry(r, h, s);

/** sprinkles on the front of a donut */
function sprinkles(cy: number, r: number, z: number, n: number, seed: number): G[] {
  const cols = ["#ffffff", "#ffd23f", "#3fa2f5", "#7edc4a", "#ff6fb5"];
  const out: G[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + seed, rr = r * (0.85 + ((i * 37) % 7) / 30);
    out.push(part(box(0.05, 0.018, 0.018), cols[(i + seed) % cols.length], [Math.cos(a) * rr, cy + Math.sin(a) * rr, z], [0, 0, a * 1.7]));
  }
  return out;
}

const donut = (icing: string, seed: number) => merge([
  part(tor(0.24, 0.14), "#e3a35f", [0, 0.42, 0]),
  part(tor(0.24, 0.135), icing, [0, 0.42, 0.035], [0, 0, 0], [1.02, 1.02, 0.7]),
  ...sprinkles(0.42, 0.24, 0.16, 10, seed),
]);

const BUILD: Record<number, () => G> = {
  1: () => donut("#ff7ab6", 1),
  2: () => donut("#5a321c", 3),
  3: () => merge([
    part(cyl(0.3, 0.22, 0.38, 18), "#ff9fd0", [0, 0.19, 0]),
    part(sph(0.33), "#fff0f6", [0, 0.48, 0], [0, 0, 0], [1, 0.62, 1]),
    part(cone(0.22, 0.28), "#ffe0ef", [0, 0.68, 0]),
    part(sph(0.08), "#e0102e", [0, 0.86, 0]),
  ]),
  4: () => merge([
    part(cyl(0.33, 0.33, 0.15, 24), "#7fe0b5", [0, 0.12, 0]),
    part(cyl(0.3, 0.3, 0.1, 24), "#fffaf0", [0, 0.24, 0]),
    part(cyl(0.33, 0.33, 0.15, 24), "#7fe0b5", [0, 0.36, 0]),
    part(sph(0.33, 24, 10), "#8ff0c5", [0, 0.44, 0], [0, 0, 0], [1, 0.25, 1]),
  ]),
  5: () => merge([
    part(cyl(0.33, 0.33, 0.15, 24), "#c77dff", [0, 0.12, 0]),
    part(cyl(0.3, 0.3, 0.1, 24), "#fff0fa", [0, 0.24, 0]),
    part(cyl(0.33, 0.33, 0.15, 24), "#c77dff", [0, 0.36, 0]),
    part(sph(0.33, 24, 10), "#d79aff", [0, 0.44, 0], [0, 0, 0], [1, 0.25, 1]),
  ]),
  6: () => merge([
    part(cone(0.2, 0.55), "#d8963f", [0, 0.28, 0], [PI, 0, 0]),
    part(tor(0.19, 0.04), "#c07a2a", [0, 0.55, 0], [PI / 2, 0, 0]),
    part(sph(0.24), "#fff0c0", [0, 0.68, 0]),
    part(sph(0.2), "#ffb0c8", [0, 0.88, 0]),
    part(sph(0.06), "#e0102e", [0, 1.04, 0]),
  ]),
  7: () => merge([
    part(cyl(0.025, 0.025, 0.55, 8), "#ffffff", [0, 0.27, 0]),
    part(cyl(0.32, 0.32, 0.08, 28), "#ff4f9a", [0, 0.7, 0], [PI / 2, 0, 0]),
    part(tor(0.2, 0.035), "#ffffff", [0, 0.7, 0.045]),
    part(tor(0.1, 0.03), "#ffd23f", [0, 0.7, 0.045]),
  ]),
  8: () => merge([
    part(sph(0.22), "#ffd23f", [0, 0.4, 0], [0, 0, 0], [1.25, 1, 1]),
    part(cone(0.16, 0.24, 12), "#ffe68a", [-0.36, 0.4, 0], [0, 0, -PI / 2]),
    part(cone(0.16, 0.24, 12), "#ffe68a", [0.36, 0.4, 0], [0, 0, PI / 2]),
    part(tor(0.16, 0.025), "#ff8a3d", [0, 0.4, 0], [0, PI / 2, 0]),
  ]),
  9: () => {
    const chips: G[] = [];
    for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.08 + (i % 3) * 0.07; chips.push(part(sph(0.04, 8, 6), "#4a2a14", [Math.cos(a) * r, 0.4 + Math.sin(a) * r, 0.06])); }
    return merge([part(cyl(0.34, 0.34, 0.1, 26), "#d9a066", [0, 0.4, 0], [PI / 2, 0, 0]), ...chips]);
  },
  10: () => merge([
    part(tor(0.22, 0.12, PI * 1.1), "#e8a24a", [0, 0.25, 0], [0, 0, -0.05 * PI]),
    part(sph(0.16), "#f0b860", [0, 0.42, 0], [0, 0, 0], [1.2, 0.9, 1]),
    part(tor(0.22, 0.125, PI * 0.25), "#c98030", [0, 0.25, 0.02], [0, 0, PI * 0.4]),
  ]),
  11: () => {
    const prof = [[0, 0.02], [0.12, 0.06], [0.24, 0.2], [0.29, 0.38], [0.27, 0.52], [0.15, 0.6], [0, 0.61]].map(([x, y]) => new THREE.Vector2(x, y));
    const seeds: G[] = [];
    for (let i = 0; i < 9; i++) seeds.push(part(sph(0.022, 6, 4), "#ffe68a", [((i % 3) - 1) * 0.12, 0.18 + Math.floor(i / 3) * 0.13, 0.25 - Math.abs((i % 3) - 1) * 0.03]));
    return merge([part(new THREE.LatheGeometry(prof, 18), "#ff3b4f"), part(cone(0.22, 0.12, 6), "#3fae3a", [0, 0.64, 0], [PI, 0, 0]), part(cyl(0.02, 0.02, 0.12, 6), "#3f8e2a", [0, 0.74, 0]), ...seeds]);
  },
  12: () => merge([
    part(sph(0.16), "#c8102e", [-0.14, 0.17, 0]),
    part(sph(0.16), "#d81e3c", [0.14, 0.2, 0.02]),
    part(cyl(0.018, 0.018, 0.55, 6), "#3f8e2a", [-0.07, 0.5, 0], [0, 0, -0.3]),
    part(cyl(0.018, 0.018, 0.52, 6), "#3f8e2a", [0.07, 0.52, 0], [0, 0, 0.25]),
    part(sph(0.09, 8, 6), "#58c43a", [0.08, 0.8, 0], [0, 0, 0], [1.6, 0.6, 0.4]),
  ]),
  13: () => merge([
    part(cyl(0.2, 0.3, 0.42, 20), "#3fd3a0", [0, 0.21, 0]),
    part(cyl(0.2, 0.2, 0.03, 20), "#7ff0c8", [0, 0.43, 0]),
    part(sph(0.12), "#ffffff", [0, 0.5, 0], [0, 0, 0], [1, 0.7, 1]),
    part(sph(0.05), "#e0102e", [0, 0.6, 0]),
    part(cyl(0.34, 0.34, 0.03, 22), "#f4f8ff", [0, 0.015, 0]),
  ]),
  14: () => merge([
    part(box(0.36, 0.52, 0.14), "#ff8a3d", [0, 0.56, 0]),
    part(cyl(0.18, 0.18, 0.14, 20), "#ff8a3d", [0, 0.82, 0], [PI / 2, 0, 0]),
    part(box(0.36, 0.12, 0.145), "#ffd23f", [0, 0.42, 0]),
    part(box(0.07, 0.34, 0.05), "#e8c08a", [0, 0.17, 0]),
  ]),
  15: () => {
    const prof = [[0, 0], [0.22, 0], [0.24, 0.04], [0.24, 0.5], [0.16, 0.66], [0.12, 0.74], [0.12, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y));
    return merge([part(new THREE.LatheGeometry(prof, 20), "#f4f8ff"), part(cyl(0.135, 0.135, 0.07, 16), "#3fa2f5", [0, 0.83, 0]), part(cyl(0.245, 0.245, 0.16, 20), "#9cc8ff", [0, 0.3, 0])]);
  },
  16: () => merge([
    part(cyl(0.22, 0.22, 0.62, 22), "#3fa2f5", [0, 0.32, 0]),
    part(cyl(0.225, 0.225, 0.14, 22), "#ffffff", [0, 0.34, 0]),
    part(cyl(0.19, 0.22, 0.05, 22), "#c8d0e0", [0, 0.655, 0]),
    part(cyl(0.2, 0.22, 0.03, 22), "#c8d0e0", [0, 0.015, 0]),
  ]),
  17: () => merge([
    part(box(0.38, 0.52, 0.26), "#9be04a", [0, 0.26, 0]),
    part(box(0.26, 0.2, 0.01), "#ffffff", [0, 0.28, 0.135]),
    part(sph(0.07, 10, 8), "#ff8a3d", [0, 0.28, 0.14], [0, 0, 0], [1, 1, 0.3]),
    part(cyl(0.02, 0.02, 0.32, 6), "#ff6fb5", [0.08, 0.62, 0], [0, 0, -0.35]),
  ]),
  18: () => merge([
    part(cyl(0.38, 0.38, 0.03, 26), "#ffffff", [0, 0.015, 0]),
    part(cyl(0.28, 0.2, 0.32, 22), "#ffffff", [0, 0.2, 0]),
    part(cyl(0.26, 0.26, 0.02, 22), "#a0603a", [0, 0.35, 0]),
    part(tor(0.09, 0.025), "#ffffff", [0.31, 0.22, 0], [0, 0, 0]),
    part(tor(0.29, 0.012), "#ffb0c8", [0, 0.3, 0], [PI / 2, 0, 0]),
  ]),
  19: () => merge([
    part(cyl(0.36, 0.36, 0.03, 24), "#ffffff", [0, 0.015, 0]),
    part(cyl(0.2, 0.3, 0.36, 22), "#ffd27a", [0, 0.21, 0]),
    part(cyl(0.21, 0.21, 0.06, 22), "#9a4a10", [0, 0.41, 0]),
    part(sph(0.06), "#e0102e", [0, 0.48, 0]),
  ]),
  20: () => {
    const s = new THREE.Shape(); s.moveTo(-0.34, 0); s.lineTo(0.34, 0); s.lineTo(0.34, 0.12); s.lineTo(-0.34, 0.5); s.closePath();
    const wedge = (h: number) => new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    return merge([
      part(wedge(0.28), "#ffe0f0", [0, 0, -0.14]),
      part(box(0.7, 0.04, 0.29), "#ff7ab6", [0, 0.06, 0]),
      part(sph(0.07), "#e0102e", [0.24, 0.24, 0]),
      part(sph(0.07, 10, 8), "#ffffff", [0.08, 0.28, 0], [0, 0, 0], [1, 0.6, 1]),
    ]);
  },
  21: () => merge([part(sph(0.31, 24, 18), "#8a6bff", [0, 0.32, 0]), part(sph(0.06), "#ffffff", [-0.1, 0.45, 0.24], [0, 0, 0], [1, 0.7, 0.4])]),
  22: () => {
    const squares: G[] = [];
    for (let i = 0; i < 6; i++) squares.push(part(box(0.15, 0.13, 0.04), "#6a3a20", [((i % 2) - 0.5) * 0.18, 0.62 + Math.floor(i / 2) * 0.15 - 0.15, 0.06]));
    return merge([part(box(0.42, 0.78, 0.1), "#5a321c", [0, 0.39, 0]), part(box(0.43, 0.36, 0.11), "#e0283a", [0, 0.18, 0]), part(box(0.44, 0.05, 0.115), "#ffd23f", [0, 0.3, 0]), ...squares]);
  },
  23: () => merge([
    part(sph(0.3, 22, 16), "#58c43a", [0, 0.3, 0], [0, 0, 0], [1, 0.92, 1]),
    part(cyl(0.02, 0.025, 0.16, 6), "#6a4020", [0, 0.6, 0], [0, 0, 0.2]),
    part(sph(0.09, 8, 6), "#3fae3a", [0.1, 0.62, 0], [0, 0, 0.6], [1.6, 0.5, 0.3]),
    part(sph(0.07), "#e8ffb0", [-0.12, 0.42, 0.22], [0, 0, 0], [1, 1, 0.4]),
  ]),
  24: () => merge([
    part(cyl(0.26, 0.26, 0.48, 22), "#ffb52e", [0, 0.24, 0]),
    part(cyl(0.29, 0.27, 0.1, 22), "#e03a3a", [0, 0.52, 0]),
    part(sph(0.29, 18, 8), "#ff6a6a", [0, 0.56, 0], [0, 0, 0], [1, 0.3, 1]),
    part(box(0.3, 0.18, 0.01), "#fff0c0", [0, 0.26, 0.262]),
  ]),
};

/** the mystery wrapper shown on hidden treats in back rows */
const GIFT = () => merge([
  part(box(0.56, 0.5, 0.42), "#8a6bff", [0, 0.25, 0]),
  part(box(0.1, 0.51, 0.43), "#ffd23f", [0, 0.25, 0]),
  part(box(0.57, 0.1, 0.43), "#ffd23f", [0, 0.25, 0]),
  part(tor(0.08, 0.03), "#ffd23f", [-0.07, 0.56, 0], [0, 0, 0.5]),
  part(tor(0.08, 0.03), "#ffd23f", [0.07, 0.56, 0], [0, 0, -0.5]),
]);

const cache = new Map<number, G>();
/** the geometry for treat type t (0 = the mystery gift); cached, never dispose the result */
export function treatGeometry(t: number): G {
  let g = cache.get(t);
  if (!g) { g = t === 0 ? GIFT() : (BUILD[t] ?? BUILD[21])(); cache.set(t, g); }
  return g;
}
export function disposeTreatGeometries() { for (const g of cache.values()) g.dispose(); cache.clear(); }
