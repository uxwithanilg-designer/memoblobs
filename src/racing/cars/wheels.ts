// Wheels: a lathed tyre (rounded shoulders, sidewall bulge, optional white wall / off-road lugs) and a rim with
// real depth (lip, inner barrel, concave spokes, centre cap, lug nuts, brake disc). Built once per size/style and
// drawn as two InstancedMeshes per car (all tyres = 1 draw call, all rims = 1 draw call).
import * as THREE from "three";
import { col, type Col, K } from "./kit";

export type RimStyle = "spoke5" | "split" | "mesh" | "turbine" | "y6" | "star" | "dish" | "steel" | "offroad" | "classic" | "aero" | "three" | "tractor" | "truck";
export type TyreStyle = "road" | "slick" | "offroad" | "white" | "lug" | "kart";
export interface WheelDef { r: number; w: number; rim: RimStyle; rimColor: Col; tyre: TyreStyle; rimFrac?: number }

class G {
  p: number[] = []; n: number[] = []; c: number[] = [];
  private v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: Col, na?: THREE.Vector3, nb?: THREE.Vector3, nc?: THREE.Vector3) {
    const k = col(color);
    if (!na) { this.v[0].subVectors(b, a); this.v[1].subVectors(c, a); this.v[2].crossVectors(this.v[0], this.v[1]).normalize(); na = nb = nc = this.v[2]; }
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.n.push(na.x, na.y, na.z, nb!.x, nb!.y, nb!.z, nc!.x, nc!.y, nc!.z);
    for (let i = 0; i < 3; i++) this.c.push(k.r, k.g, k.b);
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: Col) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  geo(g: THREE.BufferGeometry, color: Col) {
    const s = g.index ? g.toNonIndexed() : g; if (!s.attributes.normal) s.computeVertexNormals();
    const P = s.attributes.position.array, N = s.attributes.normal.array, k = col(color);
    for (let i = 0; i < P.length; i++) { this.p.push(P[i]); this.n.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) this.c.push(k.r, k.g, k.b);
    if (s !== g) s.dispose(); g.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
/** point in wheel space: lateral x (outer face +x), radius r at angle a (around the axle) */
const W = (x: number, r: number, a: number) => new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r);

function tyreGeo(d: WheelDef) {
  const R = d.r, w = d.w, rr = R * (d.rimFrac ?? 0.64), h = R - rr, g = new G();
  const lug = d.tyre === "offroad" || d.tyre === "lug";
  const seg = lug ? 22 : d.r < 0.2 ? 12 : 18;
  // profile from the outer bead over the tread to the inner bead: [lateral, radius, colour]
  const side = d.tyre === "white" ? 0xf2f0ea : K.rubber;
  const prof: [number, number, Col][] = d.tyre === "slick" || d.tyre === "kart"
    ? [[w * 0.44, rr * 0.99, K.rubber], [w * 0.5, rr + h * 0.45, K.rubber], [w * 0.47, R - h * 0.12, K.rubber], [w * 0.36, R, 0x202124], [-w * 0.36, R, 0x202124], [-w * 0.47, R - h * 0.12, K.rubber], [-w * 0.5, rr + h * 0.45, K.rubber], [-w * 0.44, rr * 0.99, K.rubber]]
    : [[w * 0.44, rr * 0.99, K.rubber], [w * 0.5, rr + h * 0.3, side], [w * 0.5, rr + h * 0.62, d.tyre === "white" ? side : 0x26272b], [w * 0.43, R - h * 0.1, K.rubber], [w * 0.3, R, 0x1c1d20], [-w * 0.3, R, 0x1c1d20], [-w * 0.48, rr + h * 0.45, K.rubber], [-w * 0.44, rr * 0.99, K.rubber]];
  const n = prof.length;
  const P: THREE.Vector3[][] = [], N: THREE.Vector3[][] = [];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2, bump = lug && k % 2 === 0;
    P.push(prof.map(([x, r], j) => W(x * (bump && j >= 3 && j <= n - 4 ? 1.04 : 1), r + (bump && j >= 3 && j <= n - 4 ? h * 0.16 : 0), a)));
  }
  // smooth normals from the profile tangents (lathe)
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    N.push(prof.map((_, j) => {
      const p0 = prof[Math.max(0, j - 1)], p1 = prof[Math.min(n - 1, j + 1)];
      const tx = p1[0] - p0[0], tr = p1[1] - p0[1];
      // outward normal in (x, r): rotate tangent (going from outer side to inner side)
      let nx = tr, nr = -tx; const l = Math.hypot(nx, nr) || 1; nx /= l; nr /= l;
      return new THREE.Vector3(nx, Math.cos(a) * nr, Math.sin(a) * nr);
    }));
  }
  for (let k = 0; k < seg; k++) for (let j = 0; j < n - 1; j++) {
    const a = P[k][j], b = P[k][j + 1], c = P[k + 1][j + 1], e = P[k + 1][j];
    const ca = prof[j][2];
    g.tri(a, c, b, ca, N[k][j], N[k + 1][j + 1], N[k][j + 1]);
    g.tri(a, e, c, ca, N[k][j], N[k + 1][j], N[k + 1][j + 1]);
  }
  const geo = g.build();
  // make sure faces point outward (lathe winding depends on profile direction)
  return fixOutward(geo);
}

/** flip any triangle whose face normal disagrees with its vertex normals */
function fixOutward(g: THREE.BufferGeometry) {
  const p = g.attributes.position.array as Float32Array, n = g.attributes.normal.array as Float32Array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
    f.subVectors(b, a).cross(c.sub(a));
    const dot = f.x * (n[i] + n[i + 3] + n[i + 6]) + f.y * (n[i + 1] + n[i + 4] + n[i + 7]) + f.z * (n[i + 2] + n[i + 5] + n[i + 8]);
    if (dot < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; const u = n[i + 3 + k]; n[i + 3 + k] = n[i + 6 + k]; n[i + 6 + k] = u; }
  }
  return g;
}

/** flat annulus (or cone) facing +x between radii r0..r1 at lateral x0 (inner) .. x1 (outer) */
function annulus(g: G, r0: number, r1: number, x0: number, x1: number, seg: number, color: Col, a0 = 0, arc = Math.PI * 2) {
  for (let k = 0; k < seg; k++) {
    const a = a0 + (k / seg) * arc, b = a0 + ((k + 1) / seg) * arc;
    if (r0 <= 1e-6) { orientTri(g, W(x0, 0, a), W(x1, r1, a), W(x1, r1, b), new THREE.Vector3(1, 0, 0), color); continue; }
    const p = [W(x0, r0, a), W(x1, r1, a), W(x1, r1, b), W(x0, r0, b)];
    orientQuad(g, p, new THREE.Vector3(1, 0, 0), color);
  }
}
function orientTri(g: G, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, want: THREE.Vector3, color: Col) {
  _o1.subVectors(b, a); _o2.subVectors(c, a); _o1.cross(_o2);
  if (_o1.dot(want) < 0) g.tri(a, c, b, color); else g.tri(a, b, c, color);
}
/** cylinder band at radius r from x0..x1; inward=true for the inner barrel */
function band(g: G, r: number, x0: number, x1: number, seg: number, color: Col, inward = false) {
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, b = ((k + 1) / seg) * Math.PI * 2;
    const p = [W(x0, r, a), W(x1, r, a), W(x1, r, b), W(x0, r, b)];
    const m = (a + b) / 2, nrm = new THREE.Vector3(0, Math.cos(m), Math.sin(m)).multiplyScalar(inward ? -1 : 1);
    orientQuad(g, p, nrm, color, true);
  }
}
const _o1 = new THREE.Vector3(), _o2 = new THREE.Vector3();
function orientQuad(g: G, p: THREE.Vector3[], want: THREE.Vector3, color: Col, smooth = false) {
  _o1.subVectors(p[1], p[0]); _o2.subVectors(p[2], p[0]); _o1.cross(_o2);
  const q = _o1.dot(want) < 0 ? [p[0], p[3], p[2], p[1]] : p;
  if (smooth) { const ns = q.map((v) => new THREE.Vector3(0, v.y, v.z).normalize().multiplyScalar(Math.sign(want.y * v.y + want.z * v.z) || 1)); g.tri(q[0], q[1], q[2], color, ns[0], ns[1], ns[2]); g.tri(q[0], q[2], q[3], color, ns[0], ns[2], ns[3]); }
  else g.quad(q[0], q[1], q[2], q[3], color);
}
/** a spoke prism from (r0, a0, x0) to (r1, a1, x1), widths w0→w1, thickness t (front face + two sides) */
function spoke(g: G, a0: number, a1: number, r0: number, r1: number, w0: number, w1: number, t: number, x0: number, x1: number, color: Col) {
  const c0 = W(x0, r0, a0), c1 = W(x1, r1, a1);
  const t0 = new THREE.Vector3(0, -Math.sin(a0), Math.cos(a0)), t1 = new THREE.Vector3(0, -Math.sin(a1), Math.cos(a1));
  const A = c0.clone().addScaledVector(t0, -w0 / 2), B = c0.clone().addScaledVector(t0, w0 / 2), C = c1.clone().addScaledVector(t1, w1 / 2), D = c1.clone().addScaledVector(t1, -w1 / 2);
  const back = (v: THREE.Vector3) => v.clone().add(new THREE.Vector3(-t, 0, 0));
  orientQuad(g, [A, D, C, B], new THREE.Vector3(1, 0, 0), color);
  const mid0 = c0.clone().lerp(c1, 0.5);
  for (const [p, q] of [[A, D], [B, C]] as const) {
    const side = p.clone().lerp(q, 0.5).sub(mid0); side.x = 0;
    orientQuad(g, [p, q, back(q), back(p)], side.normalize(), color);
  }
}
function disc(g: G, r: number, x: number, cy: number, cz: number, color: Col, seg = 8) {
  const ctr = new THREE.Vector3(x, cy, cz);
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, b = ((k + 1) / seg) * Math.PI * 2;
    const p = new THREE.Vector3(x, cy + Math.cos(a) * r, cz + Math.sin(a) * r), q = new THREE.Vector3(x, cy + Math.cos(b) * r, cz + Math.sin(b) * r);
    orientTri(g, ctr, p, q, new THREE.Vector3(1, 0, 0), color);
  }
}

function rimGeo(d: WheelDef) {
  const R = d.r, w = d.w, rr = R * (d.rimFrac ?? 0.64), g = new G();
  const rc = d.rimColor, dark = new THREE.Color(rc).multiplyScalar(0.45).getHex(), xf = w * 0.4;
  const seg = R < 0.2 ? 12 : 16;
  // lip + inner barrel + back plate (so you never see through the wheel)
  annulus(g, rr * 0.87, rr * 1.0, xf - 0.004, xf, seg, rc);
  band(g, rr * 0.87, -w * 0.42, xf - 0.004, seg, dark, true);
  annulus(g, 0, rr * 0.86, -w * 0.4, -w * 0.4, 10, 0x141518);
  // brake disc + hat
  const xd = -w * 0.08;
  annulus(g, rr * 0.3, rr * 0.78, xd, xd, seg, 0x8d9096);
  annulus(g, 0, rr * 0.3, xd + 0.03, xd + 0.03, 8, 0x3d4046);
  // face
  const st = d.rim, hubR = rr * 0.2, xr = xf - 0.012;
  const dish = st === "dish" || st === "steel" || st === "classic" || st === "aero" || st === "tractor" || st === "truck";
  const xh = xf - (st === "offroad" || st === "steel" || st === "truck" || st === "tractor" ? w * 0.28 : st === "mesh" || st === "dish" ? w * 0.06 : w * 0.16);
  const S = (n: number, f: (i: number, a: number) => void) => { for (let i = 0; i < n; i++) f(i, (i / n) * Math.PI * 2); };
  if (st === "spoke5") S(5, (_, a) => spoke(g, a, a, hubR, rr * 0.9, rr * 0.3, rr * 0.2, 0.03, xh, xr, rc));
  else if (st === "split") S(5, (_, a) => { for (const o of [-0.1, 0.1]) spoke(g, a + o * 0.4, a + o, hubR, rr * 0.9, rr * 0.11, rr * 0.08, 0.025, xh, xr, rc); });
  else if (st === "y6") S(6, (_, a) => { spoke(g, a, a, hubR, rr * 0.55, rr * 0.16, rr * 0.13, 0.03, xh, lerp(xh, xr, 0.6), rc); for (const o of [-0.17, 0.17]) spoke(g, a, a + o, rr * 0.5, rr * 0.9, rr * 0.08, rr * 0.07, 0.025, lerp(xh, xr, 0.55), xr, rc); });
  else if (st === "mesh") S(12, (_, a) => { spoke(g, a, a + 0.32, hubR, rr * 0.9, rr * 0.07, rr * 0.06, 0.02, xh, xr, rc); spoke(g, a, a - 0.32, hubR, rr * 0.9, rr * 0.07, rr * 0.06, 0.02, xh + 0.006, xr + 0.006, rc); });
  else if (st === "turbine") S(14, (_, a) => spoke(g, a, a + 0.55, hubR, rr * 0.9, rr * 0.09, rr * 0.15, 0.02, xh, xr, rc));
  else if (st === "star") S(7, (_, a) => spoke(g, a, a, hubR, rr * 0.9, rr * 0.13, rr * 0.08, 0.03, xh, xr, rc));
  else if (st === "three") S(3, (_, a) => spoke(g, a, a, hubR, rr * 0.9, rr * 0.45, rr * 0.3, 0.03, xh, xr, rc));
  else if (st === "offroad") {
    S(6, (_, a) => spoke(g, a, a, hubR, rr * 0.9, rr * 0.26, rr * 0.22, 0.04, xh, xr, rc));
    annulus(g, rr * 0.86, rr * 0.98, xf + 0.008, xf + 0.008, seg, K.gun);
    S(12, (_, a) => disc(g, rr * 0.03, xf + 0.012, Math.cos(a) * rr * 0.92, Math.sin(a) * rr * 0.92, K.chrome, 5));
  } else if (dish) {
    annulus(g, hubR, rr * 0.9, xh, xr, seg, rc);
    if (st === "steel" || st === "tractor") S(st === "steel" ? 8 : 6, (_, a) => disc(g, rr * (st === "steel" ? 0.075 : 0.12), lerp(xh, xr, 0.55) + 0.003, Math.cos(a) * rr * 0.58, Math.sin(a) * rr * 0.58, 0x0d0e10));
    if (st === "aero") S(5, (_, a) => { for (let k = 0; k < 4; k++) { const b = a + k * 0.05; disc(g, rr * 0.035, lerp(xh, xr, 0.85) + 0.003, Math.cos(b) * rr * 0.78, Math.sin(b) * rr * 0.78, 0x101114, 5); } });
    if (st === "dish") S(6, (_, a) => disc(g, rr * 0.07, lerp(xh, xr, 0.7) + 0.003, Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.7, 0x101114));
    if (st === "classic") { // chrome dome hub cap
      const capR = rr * 0.62;
      for (let k = 0; k < 3; k++) annulus(g, capR * Math.cos(((k + 1) / 3) * 1.2), capR * Math.cos((k / 3) * 1.2), xh + 0.012 + Math.sin(((k + 1) / 3) * 1.2) * capR * 0.35, xh + 0.012 + Math.sin((k / 3) * 1.2) * capR * 0.35, seg, K.chrome);
      annulus(g, 0, capR * Math.cos(1.2), xh + 0.012 + Math.sin(1.2) * capR * 0.35, xh + 0.012 + Math.sin(1.2) * capR * 0.35, seg, K.chrome);
    }
    if (st === "truck") S(10, (_, a) => disc(g, rr * 0.035, xh + 0.006, Math.cos(a) * rr * 0.36, Math.sin(a) * rr * 0.36, K.chrome, 6));
  }
  // hub: centre cap and lug nuts
  if (st !== "classic") {
    band(g, hubR, xh - 0.01, xh + 0.022, 8, rc);
    annulus(g, 0, hubR, xh + 0.022, xh + 0.022, 8, st === "steel" || st === "truck" ? K.chrome : dark);
    S(st === "truck" ? 0 : 5, (_, a) => disc(g, rr * 0.03, xh + 0.024, Math.cos(a + 0.3) * hubR * 0.62, Math.sin(a + 0.3) * hubR * 0.62, K.chrome, 6));
  }
  return g.build();
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- cache (ref-counted by the builder)
const _wheelCache = new Map<string, { tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }>();
export function wheelKey(d: WheelDef) { return `${d.r.toFixed(3)}|${d.w.toFixed(3)}|${d.rim}|${d.rimColor}|${d.tyre}|${d.rimFrac ?? 0.64}`; }
export function wheelGeos(d: WheelDef) {
  const k = wheelKey(d);
  let e = _wheelCache.get(k);
  if (!e) { e = { tyre: tyreGeo(d), rim: rimGeo(d) }; _wheelCache.set(k, e); }
  return e;
}
export function dropWheelGeos(key: string) {
  const e = _wheelCache.get(key); if (!e) return;
  e.tyre.dispose(); e.rim.dispose(); _wheelCache.delete(key);
}
