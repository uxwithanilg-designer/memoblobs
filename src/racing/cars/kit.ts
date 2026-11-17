// Geometry kit for the car builder: every static part is appended to one of a few material "buckets"
// (paint, accent, glass, trim, metal, lamps…) with per-vertex colours, so a whole car ends up as ~8 draw calls.
import * as THREE from "three";

export type Bucket = "paint" | "accent" | "glass" | "trim" | "metal" | "head" | "tail" | "flashA" | "flashB";
export const BUCKETS: Bucket[] = ["paint", "accent", "glass", "trim", "metal", "head", "tail", "flashA", "flashB"];
export type Col = string | number;

const _cols = new Map<Col, THREE.Color>();
/** cached linear-space colour */
export function col(c: Col): THREE.Color {
  let v = _cols.get(c);
  if (!v) { v = new THREE.Color(c); _cols.set(c, v); }
  return v;
}

/** common trim colours */
export const K = {
  black: 0x111215, rubber: 0x202124, grille: 0x0a0b0d, plastic: 0x1d1f23, carbon: 0x1a1c20,
  interior: 0x26282d, seat: 0x34373e, dash: 0x1b1c20, plate: 0xf1efe6, chrome: 0xe6eaef, alu: 0xb9c0c8,
  gun: 0x3b3f46, dark: 0x22252a, amber: 0xffa21a, white: 0xffffff, red: 0xd81e1e, lamp: 0xfff6e8, housing: 0x0c0d10,
};

interface Buf { p: number[]; n: number[]; c: number[] }

export class Kit {
  private data = new Map<Bucket, Buf>();
  private buf(b: Bucket) { let d = this.data.get(b); if (!d) { d = { p: [], n: [], c: [] }; this.data.set(b, d); } return d; }

  /** append a geometry (consumed & disposed) with a uniform colour */
  geo(b: Bucket, g: THREE.BufferGeometry, color: Col = 0xffffff, scale = 1) {
    const src = g.index ? g.toNonIndexed() : g;
    if (!src.attributes.normal) src.computeVertexNormals();
    const P = src.attributes.position.array, N = src.attributes.normal.array, d = this.buf(b), c = col(color);
    for (let i = 0; i < P.length; i++) { d.p.push(P[i]); d.n.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) d.c.push(c.r * scale, c.g * scale, c.b * scale);
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** one triangle; normals optional (flat if omitted) */
  tri(b: Bucket, a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3, color: Col, na?: THREE.Vector3, nb?: THREE.Vector3, nc?: THREE.Vector3, scale = 1) {
    if (!Number.isFinite(a.x + a.y + a.z + bb.x + bb.y + bb.z + c.x + c.y + c.z)) return;
    const d = this.buf(b), k = col(color);
    if (!na) { _e1.subVectors(bb, a); _e2.subVectors(c, a); _fn.crossVectors(_e1, _e2).normalize(); na = nb = nc = _fn; }
    d.p.push(a.x, a.y, a.z, bb.x, bb.y, bb.z, c.x, c.y, c.z);
    d.n.push(na.x, na.y, na.z, nb!.x, nb!.y, nb!.z, nc!.x, nc!.y, nc!.z);
    for (let i = 0; i < 3; i++) d.c.push(k.r * scale, k.g * scale, k.b * scale);
  }

  /** quad a-b-c-d (counter-clockwise seen from the front) */
  quad(b: Bucket, a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3, dd: THREE.Vector3, color: Col, scale = 1) {
    this.tri(b, a, bb, c, color, undefined, undefined, undefined, scale);
    this.tri(b, a, c, dd, color, undefined, undefined, undefined, scale);
  }

  has(b: Bucket) { const d = this.data.get(b); return !!d && d.p.length > 0; }
  triCount() { let n = 0; for (const d of this.data.values()) n += d.p.length / 9; return n; }

  build() {
    const out = new Map<Bucket, THREE.BufferGeometry>();
    for (const [b, d] of this.data) {
      if (!d.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      out.set(b, g);
    }
    return out;
  }
}
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _fn = new THREE.Vector3();

// ---------------------------------------------------------------- primitives (already positioned)
export function rot(g: THREE.BufferGeometry, rx = 0, ry = 0, rz = 0) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); return g; }
export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return rot(new THREE.BoxGeometry(w, h, d), rx, ry, rz).translate(x, y, z);
}
/** cylinder along an axis */
export function cyl(r: number, len: number, axis: "x" | "y" | "z", x = 0, y = 0, z = 0, seg = 12, open = false, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, open);
  if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
}
export function sphere(r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ws = 10, hs = 7) {
  return new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
}
/** cylinder between two points */
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _dir = new THREE.Vector3();
export function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 6, r2 = r) {
  _dir.subVectors(b, a); const len = _dir.length();
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, true);
  _q.setFromUnitVectors(_up, _dir.normalize());
  g.applyQuaternion(_q);
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/** torus in the XY plane by default */
export function torus(R: number, r: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rs = 6, ts = 16, arc = Math.PI * 2) {
  return rot(new THREE.TorusGeometry(R, r, rs, ts, arc), rx, ry).translate(x, y, z);
}
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- materials (shared ones are cached forever)
const _mats = new Map<string, THREE.Material>();
export function shared<T extends THREE.Material>(key: string, make: () => T): T {
  let m = _mats.get(key) as T | undefined;
  if (!m) { m = make(); _mats.set(key, m); }
  return m;
}
export const MAT = {
  glass: () => shared("glass", () => new THREE.MeshPhysicalMaterial({ color: 0x0a1119, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, transparent: true, opacity: 0.8 })),
  trim: () => shared("trim", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.12, envMapIntensity: 0.9 })),
  metal: () => shared("metal", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.17, metalness: 1, envMapIntensity: 1.35 })),
  /** alloy wheels: part diffuse so they never read as black holes against a dark sky */
  rim: () => shared("rim", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.25 })),
  tyre: () => shared("tyre", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.6 })),
  flame: () => shared("flame", () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
  beam: () => shared("beam", () => new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
};
/** shared clear-coated accent paint (stripes, liveries, two-tone roofs) */
export function accentMat(c: Col) {
  return shared("accent:" + c, () => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }));
}
/** the car's body paint: deep clear-coat; light colours stay solid, dark ones get a metallic flake */
export function paintMat(color: string, finish: "gloss" | "matte" | "metal" = "gloss") {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  const metal = finish === "metal" ? 0.85 : finish === "matte" ? 0.25 : 0.12 + 0.5 * (1 - Math.min(1, hsl.l * 1.6));
  return new THREE.MeshPhysicalMaterial({
    color, metalness: metal, roughness: finish === "matte" ? 0.55 : 0.3, clearcoat: finish === "matte" ? 0.15 : 1, clearcoatRoughness: 0.04,
    envMapIntensity: 1.25,
  });
}
/** a readable contrast colour for stripes on a given paint */
export function contrast(color: string) {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  return hsl.l > 0.55 ? "#16181d" : "#f4f1e6";
}
