// Kiko's Jungle Quest models, built in code as glossy clay toys with vertex colours (+ a few canvas textures): Kiko the
// monkey (an animation rig: torso, head, arms, legs, curly tail), Pico the toucan, the Grumpy goon, the hazards, fruits,
// power-ups and the forest itself. Origin on the ground; the track runs along −z; Kiko faces −z (we see the back while
// running); obstacles start at z = 0 (their near edge) and reach toward −z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";
import { canvasTex } from "../dash/models";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rx = <T extends G>(g: T, a: number) => { g.rotateX(a); return g; };
const ry = <T extends G>(g: T, a: number) => { g.rotateY(a); return g; };
const rz = <T extends G>(g: T, a: number) => { g.rotateZ(a); return g; };
const cyl = (r0: number, r1: number, h: number, n = 14) => new THREE.CylinderGeometry(r0, r1, h, n);
const cone = (r: number, h: number, n = 10) => new THREE.ConeGeometry(r, h, n);
const rbox = (w: number, h: number, d: number, r = 0.06, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cap = (r: number, len: number, n = 10) => new THREE.CapsuleGeometry(r, len, 4, n);
const none = () => merge([tint(sphere(0.001, 3, 2), "#000")]);
const hash = (i: number, k = 0) => { let h = Math.imul(i * 374761393 + k * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** a tube along a curve that gets thinner toward its end */
function taperTube(pts: THREE.Vector3[], r0: number, r1: number, seg = 40, rad = 10): G {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  // close the thick end with a ball and the thin end with a little one
  return merge([g, at(sphere(r0, 10, 8), pts[0].x, pts[0].y, pts[0].z), at(sphere(r1, 8, 6), pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z)]);
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** colour a geometry by height (bands of two colours, or a gradient) */
function shade(g: G, f: (x: number, y: number, z: number) => string | THREE.Color): G {
  const p = g.getAttribute("position"), c = new THREE.Color(), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i)); if (typeof v === "string") c.set(v); else c.copy(v); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}
/** bumpy: push vertices in and out along their normals (bark, coconut hair, rocks); amt is relative to the size */
function bumpy(g: G, amt: number, seed = 1): G {
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const R = g.boundingSphere?.radius ?? 1;
  const p = g.getAttribute("position") as THREE.BufferAttribute, nrm = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 7.1 / R + seed) * Math.sin(y * 6.3 / R + seed * 2) * Math.sin(z * 5.7 / R + seed * 3) + 0.4 * Math.sin((x * 17 + y * 13) / R + seed);
    const d = amt * R * n;
    p.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}
const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

// ------------------------------------------------------------------ Kiko
export interface KikoRig { torso: G; head: G; arm: G; leg: G; tail: G }
export const KIKO_FUR: Record<string, [string, string, string]> = {
  kiko: ["#B0622E", "#F6CFA0", "#E8344E"], golden: ["#E0A43A", "#FFE7B8", "#2F8BE8"], snow: ["#E9E4F2", "#FFE2E8", "#7A5AE8"],
  cocoa: ["#6B3F22", "#E8BE91", "#2FCB8B"], ginger: ["#E06A2A", "#FFDDB0", "#FFD23F"], night: ["#3E3A6E", "#C9C2F2", "#FF8A3D"],
};
/** Kiko: torso (with the scarf), head (pivot at the neck), an arm (pivot at the shoulder), a leg (pivot at the hip), the curly tail (pivot at its root) */
export function kikoRig(look = "kiko"): KikoRig {
  const [fur, face, scarf] = KIKO_FUR[look] ?? KIKO_FUR.kiko;
  const dark = new THREE.Color(fur).multiplyScalar(0.62).getStyle();
  const t: G[] = [];
  t.push(tint(at(sq(sphere(0.3, 24, 18), 1, 1.12, 0.92), 0, 0.6, 0), fur));
  t.push(tint(at(sq(sphere(0.22, 18, 14), 1, 1.15, 0.6), 0, 0.56, -0.17), face));
  const sc = new THREE.TorusGeometry(0.2, 0.065, 10, 28); sc.rotateX(Math.PI / 2); sc.translate(0, 0.9, 0); t.push(tint(sc, scarf));
  t.push(tint(at(sphere(0.07, 10, 8), 0, 0.9, 0.23), scarf));
  for (const sx of [-1, 1]) { const tl = cap(0.045, 0.16, 8); tl.rotateZ(sx * 0.35); tl.rotateX(-0.25); tl.translate(sx * 0.06, 0.78, 0.27); t.push(tint(tl, scarf)); }
  // a few polka dots on the scarf
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; t.push(tint(at(sphere(0.022, 6, 4), Math.cos(a) * 0.205, 0.93, Math.sin(a) * 0.205), "#FFFFFF")); }
  const torso = merge(t);

  const h: G[] = [];
  h.push(tint(at(sphere(0.34, 28, 22), 0, 0.27, 0), fur));
  for (const sx of [-1, 1]) h.push(tint(at(sq(sphere(0.155, 18, 14), 1, 1.12, 0.72), sx * 0.1, 0.31, -0.19), face));
  h.push(tint(at(sq(sphere(0.2, 20, 14), 1.15, 0.8, 0.78), 0, 0.15, -0.24), face));
  for (const sx of [-1, 1]) {
    h.push(tint(at(sq(sphere(0.105, 18, 14), 1, 1.18, 0.8), sx * 0.105, 0.33, -0.3), "#FFFFFF"));
    h.push(tint(at(sq(sphere(0.07, 16, 12), 1, 1.12, 0.6), sx * 0.098, 0.318, -0.374), "#1B1530"));
    h.push(tint(at(sq(sphere(0.026, 8, 6), 1, 1, 0.5), sx * 0.098 - 0.024, 0.35, -0.414), "#FFFFFF"));
    h.push(tint(at(sq(sphere(0.012, 6, 4), 1, 1, 0.5), sx * 0.098 + 0.02, 0.298, -0.416), "#FFFFFF"));
    const br = cap(0.022, 0.09, 6); br.rotateZ(Math.PI / 2 - sx * 0.3); br.translate(sx * 0.115, 0.485, -0.29); h.push(tint(br, dark));
    h.push(tint(at(sphere(0.018, 6, 4), sx * 0.032, 0.2, -0.418), "#4A2414"));
    h.push(tint(at(sq(sphere(0.05, 10, 8), 1.3, 0.7, 0.4), sx * 0.2, 0.17, -0.27), "#FF8FA3"));
    // big round ears
    h.push(tint(at(sq(sphere(0.14, 18, 14), 1, 1.05, 0.42), sx * 0.37, 0.3, 0.02), fur));
    h.push(tint(at(sq(sphere(0.092, 14, 10), 1, 1.05, 0.3), sx * 0.375, 0.3, -0.035), "#F49B8E"));
  }
  const mouth = new THREE.TorusGeometry(0.075, 0.017, 6, 16, Math.PI); mouth.rotateZ(Math.PI); mouth.rotateX(0.2); mouth.translate(0, 0.12, -0.405); h.push(tint(mouth, "#5A2414"));
  h.push(tint(at(sq(sphere(0.032, 8, 6), 1.2, 0.7, 0.6), 0.03, 0.085, -0.4), "#FF6F8A"));
  // the curly tuft on top
  h.push(tint(taperTube([v3(0, 0.56, 0.06), v3(0.02, 0.68, 0), v3(-0.02, 0.75, -0.08), v3(-0.07, 0.71, -0.14), v3(-0.06, 0.65, -0.11)], 0.045, 0.02, 20, 8), dark));
  h.push(tint(taperTube([v3(0.06, 0.56, 0.05), v3(0.11, 0.64, 0.02), v3(0.13, 0.62, -0.04)], 0.03, 0.015, 12, 6), dark));
  const head = merge(h);

  const a: G[] = [];
  const up = cap(0.066, 0.34, 10); up.translate(0, -0.2, 0); a.push(tint(up, fur));
  a.push(tint(at(sq(sphere(0.085, 14, 10), 1, 0.9, 1.1), 0, -0.43, 0), face));
  for (const sx of [-0.04, 0, 0.04]) a.push(tint(at(sphere(0.03, 6, 4), sx, -0.5, -0.04), face));
  const arm = merge(a);

  const l: G[] = [];
  const lg = cap(0.078, 0.14, 10); lg.translate(0, -0.12, 0); l.push(tint(lg, fur));
  l.push(tint(at(sq(sphere(0.1, 14, 10), 1, 0.6, 1.7), 0, -0.3, -0.05), face));
  const leg = merge(l);

  const tail = tint(taperTube([v3(0, 0, 0), v3(0, 0.03, 0.22), v3(0, 0.22, 0.44), v3(0, 0.55, 0.52), v3(0, 0.8, 0.4), v3(0, 0.8, 0.2), v3(0, 0.66, 0.16), v3(0, 0.6, 0.26), v3(0, 0.66, 0.31)], 0.065, 0.03, 60, 10), fur);
  return { torso, head, arm, leg, tail };
}

// ------------------------------------------------------------------ Pico the toucan (faces −z), wing pivot at the shoulder
export function pico(): { body: G; wing: G } {
  const p: G[] = [];
  p.push(tint(at(sq(sphere(0.28, 20, 16), 0.9, 0.85, 1.3), 0, 0, 0), "#1E1A2E"));
  p.push(tint(at(sq(sphere(0.2, 16, 12), 0.95, 0.9, 0.9), 0, -0.02, -0.2), "#FFF4D6"));
  p.push(tint(at(sphere(0.2, 18, 14), 0, 0.2, -0.32), "#1E1A2E"));
  p.push(tint(at(sq(sphere(0.13, 14, 10), 1.2, 1, 0.9), 0, 0.11, -0.42), "#FFD23F"));
  const beak = at(sq(sphere(0.13, 18, 12), 0.72, 0.95, 2.5), 0, 0.17, -0.66);
  p.push(shade(beak, (x, y, z) => (z < -0.86 ? "#FF3D3D" : y > 0.22 ? "#7CDB4A" : z < -0.62 ? "#FF8A1F" : "#FFC21A")));
  for (const sx of [-1, 1]) {
    const ring = new THREE.TorusGeometry(0.055, 0.02, 6, 14); ring.rotateY(sx * 1.2); ring.translate(sx * 0.13, 0.26, -0.4); p.push(tint(ring, "#3DC8FF"));
    p.push(tint(at(sphere(0.042, 10, 8), sx * 0.14, 0.26, -0.41), "#1B1530"));
    p.push(tint(at(sphere(0.014, 6, 4), sx * 0.15, 0.275, -0.445), "#FFFFFF"));
  }
  p.push(tint(at(sq(sphere(0.16, 12, 10), 0.7, 0.35, 1.4), 0, -0.04, 0.42), "#1E1A2E"));
  p.push(tint(at(sq(sphere(0.08, 10, 8), 1, 0.6, 1), 0, -0.14, 0.24), "#FF3D5E"));
  for (const sx of [-1, 1]) p.push(tint(at(cyl(0.02, 0.02, 0.16, 6), sx * 0.08, -0.3, -0.05), "#FF8A1F"));
  const body = merge(p);
  const w = at(sq(sphere(0.24, 14, 10), 1.3, 0.22, 0.75), 0.26, 0, 0.05);
  const wing = shade(w, (x) => (x > 0.48 ? "#3DC8FF" : "#2A2540"));
  return { body, wing };
}

// ------------------------------------------------------------------ the Grumpy goon (a grumpy bramble bush, faces +z toward the camera) and the Golden Seed
export function goon(): G {
  const p: G[] = [];
  p.push(tint(sq(bumpy(at(sphere(0.6, 22, 16), 0, 0.75, 0), 0.08, 3), 1, 0.9, 1), "#3E6B2E"));
  for (let i = 0; i < 22; i++) {
    const u = hash(i, 1) * 2 - 1, a = hash(i, 2) * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const n = v3(Math.cos(a) * r, u, Math.sin(a) * r);
    if (n.z > 0.55 && Math.abs(n.y) < 0.5) continue;
    const c = cone(0.06, 0.24, 6); c.translate(0, 0.12, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), n));
    c.translate(n.x * 0.55, 0.75 + n.y * 0.5, n.z * 0.55);
    p.push(tint(c, i % 3 ? "#8A5A2B" : "#C23B3B"));
  }
  for (const sx of [-1, 1]) {
    p.push(tint(at(sq(sphere(0.13, 14, 10), 1, 0.85, 0.6), sx * 0.2, 0.9, 0.48), "#FFFFFF"));
    p.push(tint(at(sphere(0.065, 10, 8), sx * 0.18, 0.86, 0.56), "#1B1530"));
    const br = rbox(0.24, 0.06, 0.06, 0.02); br.rotateZ(sx * -0.5); br.translate(sx * 0.2, 1.06, 0.52); p.push(tint(br, "#1E2A14"));
    p.push(tint(at(cap(0.08, 0.2, 8), sx * 0.22, 0.12, 0), "#2E4A22"));
  }
  const m = new THREE.TorusGeometry(0.12, 0.025, 6, 14, Math.PI); m.translate(0, 0.62, 0.55); p.push(tint(m, "#1E2A14"));
  return merge(p);
}
export function seedGeo(): G {
  const s = at(sq(sphere(0.3, 18, 14), 0.8, 1.15, 0.8), 0, 0, 0);
  const tip = cone(0.16, 0.25, 12); tip.translate(0, 0.38, 0);
  const leaf = at(sq(sphere(0.14, 10, 8), 1.6, 0.35, 0.8), 0.12, 0.5, 0);
  return merge([tint(s, "#FFC21A"), tint(tip, "#FFC21A"), tint(leaf, "#5FD35A")]);
}

// ------------------------------------------------------------------ hazards
/** a fallen log across the lane (jump it) */
export function logGeo(v = 0): G {
  const p: G[] = [];
  const bark = v === 1 ? "#6E5A44" : "#7A4A26";
  const lg = cyl(0.42, 0.42, 1.95, 16); lg.rotateZ(Math.PI / 2); lg.translate(0, 0.45, -0.35);
  p.push(shade(bumpy(lg, 0.04, 2), (x, y, z) => (Math.sin(z * 30 + x * 3) > 0.6 ? new THREE.Color(bark).multiplyScalar(0.7) : new THREE.Color(bark))));
  for (const sx of [-0.98, 0.98]) {
    const end = cyl(0.39, 0.39, 0.03, 16); end.rotateZ(Math.PI / 2); end.translate(sx, 0.45, -0.35);
    p.push(shade(end, (x, y, z) => { const r = Math.hypot(y - 0.45, z + 0.35); return Math.sin(r * 40) > 0.3 ? "#E7B877" : "#C9955A"; }));
  }
  p.push(tint(at(sq(sphere(0.3, 12, 8), 1.6, 0.35, 1), 0.35, 0.82, -0.35), "#4FB548"));
  p.push(tint(at(sq(sphere(0.2, 10, 8), 1.4, 0.35, 1), -0.5, 0.8, -0.3), "#6BCB4A"));
  p.push(tint(at(sq(sphere(0.09, 10, 8), 1, 0.55, 1), -0.2, 0.95, -0.2), "#FF6B4A"));
  p.push(tint(at(cyl(0.03, 0.035, 0.1, 6), -0.2, 0.89, -0.2), "#FFF2DC"));
  return merge(p);
}
/** a thorny bush (jump it) */
export function thornGeo(leaf = "#2F6B34", thorn = "#D9B98A", berry = "#7A3DE8"): G {
  const p: G[] = [];
  for (const [x, y, z, r] of [[-0.5, 0.45, -0.4, 0.42], [0.5, 0.45, -0.45, 0.42], [0, 0.6, -0.45, 0.48], [-0.2, 0.42, -0.1, 0.35], [0.25, 0.4, -0.15, 0.33]] as const)
    p.push(tint(bumpy(at(sphere(r, 14, 10), x, y, z), 0.12, x * 9), leaf));
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 3) * Math.PI * 2, u = hash(i, 4) * 0.9;
    const n = v3(Math.cos(a) * Math.sqrt(1 - u * u), u, Math.sin(a) * Math.sqrt(1 - u * u));
    const c = cone(0.045, 0.2, 5); c.translate(0, 0.1, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), n));
    c.translate(n.x * 0.75, 0.42 + n.y * 0.5, -0.35 + n.z * 0.42);
    p.push(tint(c, i % 4 ? thorn : "#C23B3B"));
  }
  for (let i = 0; i < 7; i++) p.push(tint(at(sphere(0.07, 8, 6), -0.7 + i * 0.23, 0.55 + Math.sin(i * 2) * 0.3, -0.05 - hash(i, 7) * 0.2), berry));
  return merge(p);
}
/** poison mushrooms: purple caps with white spots (jump them) */
export function shroomGeo(cap = "#9B3DE8"): G {
  const p: G[] = [];
  for (const [x, z, s] of [[-0.45, -0.3, 1], [0.35, -0.45, 0.85], [0.05, -0.15, 0.7]] as const) {
    p.push(tint(at(cyl(0.09 * s, 0.12 * s, 0.45 * s, 10), x, 0.22 * s, z), "#F2E8FF"));
    const c = new THREE.SphereGeometry(0.34 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); c.scale(1, 0.75, 1); c.translate(x, 0.42 * s, z);
    p.push(tint(c, cap));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + s; p.push(tint(at(sq(sphere(0.055 * s, 8, 6), 1, 0.5, 1), x + Math.cos(a) * 0.2 * s, 0.56 * s, z + Math.sin(a) * 0.2 * s), "#FFFFFF")); }
    p.push(tint(at(sq(sphere(0.06 * s, 8, 6), 1, 0.5, 1), x, 0.68 * s, z), "#FFFFFF"));
  }
  return merge(p);
}
/** a low branch across the lane with leaves (slide under); v1 a river branch, v2 a hanging bee hive */
export function lowGeo(v = 0): G {
  const p: G[] = [];
  const br = cyl(0.17, 0.2, 2.6, 10); br.rotateZ(Math.PI / 2 + 0.06); br.translate(0, 1.18, -0.3);
  p.push(tint(bumpy(br, 0.05, 4), v === 1 ? "#6E5A44" : "#6B4226"));
  for (const sx of [-1.25, 1.25]) {
    const post = cyl(0.12, 0.2, 1.3, 8); post.translate(sx, 0.62, -0.3); p.push(tint(post, "#5A361E"));
  }
  if (v === 2) {
    const hive = at(sq(sphere(0.3, 16, 12), 1, 1.25, 1), 0.15, 1.55, -0.3);
    p.push(shade(hive, (x, y) => (Math.sin(y * 34) > 0 ? "#E8A72A" : "#9A5A1E")));
    p.push(tint(at(sphere(0.06, 8, 6), 0.15, 1.35, -0.58), "#3A2414"));
  }
  for (let i = 0; i < 9; i++) {
    const x = -1.1 + i * 0.28, y = 1.1 - hash(i, 9) * 0.15;
    const leaf = at(sq(sphere(0.16, 8, 6), 0.7, 1.3, 0.25), x, y - 0.05, -0.3 + (hash(i, 8) - 0.5) * 0.3);
    p.push(tint(leaf, i % 3 ? "#3FAE4A" : "#7CD35A"));
  }
  return merge(p);
}
/** a big mossy rock (v0), a tree stump (v1 → river rock), a termite mound (v2) */
export function rockGeo(v = 0): G {
  const p: G[] = [];
  if (v === 1) {
    p.push(shade(bumpy(at(sq(sphere(1.0, 20, 14), 1, 1.0, 0.95), 0, 0.85, -1.0), 0.1, 7), (x, y) => mix("#5E6470", "#8D96A3", y / 1.8)));
    p.push(tint(at(sq(sphere(0.5, 12, 8), 1.4, 0.25, 1.2), 0.2, 1.75, -1.0), "#4FB548"));
  } else if (v === 2) {
    const st = cyl(0.85, 1.0, 2.2, 18); st.translate(0, 1.1, -1.0);
    p.push(shade(bumpy(st, 0.05, 2), (x, y, z) => (Math.sin(Math.atan2(z + 1, x) * 12) > 0.4 ? "#5E3A1E" : "#7A4A26")));
    const top = cyl(0.84, 0.84, 0.04, 18); top.translate(0, 2.21, -1.0);
    p.push(shade(top, (x, y, z) => (Math.sin(Math.hypot(x, z + 1) * 22) > 0.2 ? "#E7B877" : "#C9955A")));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const root = at(sq(sphere(0.35, 10, 8), 1.3, 0.5, 1.3), Math.cos(a) * 0.95, 0.15, -1 + Math.sin(a) * 0.95); p.push(tint(root, "#6B4226")); }
    p.push(tint(at(sq(sphere(0.25, 10, 8), 1.5, 0.3, 1), -0.3, 2.25, -0.8), "#4FB548"));
  } else {
    p.push(shade(bumpy(at(sq(sphere(1.0, 22, 16), 1.0, 1.15, 0.95), 0, 1.0, -1.0), 0.1, 3), (x, y) => mix("#6E6A62", "#A39D90", y / 2.2)));
    p.push(tint(bumpy(at(sq(sphere(0.75, 16, 10), 1.2, 0.35, 1.15), 0.1, 1.95, -1.0), 0.1, 5), "#4FAE48"));
    for (let i = 0; i < 4; i++) p.push(tint(at(sq(sphere(0.12, 8, 6), 1, 0.5, 1), -0.6 + i * 0.4, 2.12, -0.8 - hash(i, 1) * 0.4), i % 2 ? "#FFD23F" : "#FF8FA3"));
  }
  return merge(p);
}
/** a rolling coconut (v0) or watermelon (v1): origin at its centre */
export function rollerGeo(v = 0): G {
  if (v === 1) {
    const m = sq(sphere(0.55, 22, 16), 1, 1, 1.15);
    return shade(m, (x, y) => (Math.sin(Math.atan2(y, x) * 8) > 0.35 ? "#2E7D32" : "#7CC44A"));
  }
  const c = bumpy(sphere(0.55, 22, 16), 0.05, 9);
  const g = shade(c, (x, y, z) => (Math.sin(x * 40 + y * 30) * Math.sin(z * 35) > 0.3 ? "#5A3418" : "#7A4A26"));
  return merge([g, ...[0, 1, 2].map((i) => tint(at(sphere(0.07, 8, 6), Math.cos(i * 2.1) * 0.15, 0.48, Math.sin(i * 2.1) * 0.15), "#2E1A0E"))]);
}
/** a coconut that drops from the palm (origin at its centre) */
export function cocoGeo(): G {
  const c = bumpy(sq(sphere(0.32, 18, 14), 1, 1.1, 1), 0.05, 4);
  return merge([shade(c, (x, y, z) => (Math.sin(x * 40 + y * 30) * Math.sin(z * 35) > 0.3 ? "#5A3418" : "#8A5A2B")), ...[0, 1, 2].map((i) => tint(at(sphere(0.05, 8, 6), Math.cos(i * 2.1) * 0.1, 0.32, Math.sin(i * 2.1) * 0.1), "#2E1A0E"))]);
}
/** a banana peel (slippery!) */
export function peelGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const petal = taperTube([v3(0, 0.08, -0.4), v3(Math.cos(a) * 0.2, 0.06, -0.4 + Math.sin(a) * 0.2), v3(Math.cos(a) * 0.38, 0.03, -0.4 + Math.sin(a) * 0.38)], 0.08, 0.04, 10, 8);
    petal.scale(1, 0.45, 1);
    p.push(tint(petal, "#FFD23F"));
  }
  p.push(tint(at(cyl(0.05, 0.06, 0.12, 8), 0, 0.08, -0.4), "#7A5A1E"));
  return merge(p);
}
/** a pit in the forest floor (scaled along z by its length) */
export function pitGeo(): { g: G; dark: G } {
  const p: G[] = [];
  for (const sx of [-1.02, 1.02]) p.push(tint(at(rbox(0.16, 0.18, 1, 0.05), sx, 0.04, -0.5), "#6B4226"));
  for (const z of [0, -1]) p.push(tint(at(rbox(2.2, 0.14, 0.12, 0.05), 0, 0.03, z), "#7A5232"));
  const dark = new THREE.PlaneGeometry(2.0, 1); dark.rotateX(-Math.PI / 2); dark.translate(0, 0.012, -0.5);
  return { g: merge(p), dark: shade(dark, (x, y, z) => (Math.abs(x) > 0.85 || z > -0.06 || z < -0.94 ? "#2A170C" : "#050302")) };
}
/** a bouncy mushroom: red cap, white spots, squishy (Kiko lands on top) */
export function bounceGeo(cap = "#FF3D4E", rim = "#E02A3C", stem = "#FFF2DC"): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.28, 0.36, 0.3, 14), 0, 0.15, -0.8), stem));
  const capG = new THREE.SphereGeometry(0.95, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, 0.42, 1); capG.translate(0, 0.18, -0.8);
  p.push(tint(capG, cap));
  const rim2 = rim;
  const rimG = new THREE.TorusGeometry(0.92, 0.07, 8, 32); rimG.rotateX(Math.PI / 2); rimG.translate(0, 0.2, -0.8); p.push(tint(rimG, rim2));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = i === 8 ? 0 : 0.55;
    p.push(tint(at(sq(sphere(0.13, 10, 8), 1, 0.35, 1), Math.cos(a) * r, i === 8 ? 0.6 : 0.5, -0.8 + Math.sin(a) * r), "#FFFFFF"));
  }
  return merge(p);
}
/** a root ramp up to the branch road: unit length along −z, unit height (scaled to the ramp) */
export function rampGeo(): G {
  const p: G[] = [];
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-1, 1); s.lineTo(-1, 0.9); s.lineTo(-0.06, 0); s.lineTo(0, 0);
  const plank = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false }); plank.rotateY(-Math.PI / 2); plank.translate(0.95, 0, 0);
  p.push(shade(plank, (x, y, z) => (Math.sin(x * 16 + z * 3) > 0.5 ? "#5E3A1E" : "#7A4A26")));
  for (const sx of [-1.05, 1.05]) {
    const s2 = new THREE.Shape(); s2.moveTo(0, -0.1); s2.lineTo(-1.04, 1.02); s2.lineTo(-1.04, 0.78); s2.lineTo(-0.2, -0.1);
    const r = new THREE.ExtrudeGeometry(s2, { depth: 0.24, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 }); r.rotateY(-Math.PI / 2); r.translate(sx + 0.12, 0, 0);
    p.push(tint(r, "#5A361E"));
  }
  return merge(p);
}
/** a piece of the branch road: unit length along −z, top at y = 0.12 above the branch height */
export function branchGeo(): { g: G; leaves: G } {
  const b = cyl(0.55, 0.55, 1, 14, ); b.rotateX(Math.PI / 2); b.translate(0, -0.42, -0.5);
  const g = shade(b, (x, y, z) => (y > -0.05 ? (Math.sin(z * 9 + x * 4) > 0.4 ? "#5FA845" : "#4F9A3A") : Math.sin(x * 14 + y * 3) > 0.5 ? "#5E3A1E" : "#7A4A26"));
  const l: G[] = [];
  for (const sx of [-1, 1]) for (const z of [-0.2, -0.7]) l.push(tint(at(sq(sphere(0.32, 8, 6), 0.6, 0.9, 0.8), sx * 0.62, -0.62, z), sx > 0 ? "#3FAE4A" : "#2F8F3E"));
  return { g, leaves: merge(l) };
}
/** a vine rope from the branch road up into the canopy (unit height) */
export function ropeGeo(): G { const c = cyl(0.05, 0.05, 1, 6); c.translate(0, 0.5, 0); return tint(c, "#3E7A2E"); }
/** a snake on the branch road (jump it), coiled with its head up */
export function snakeGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(0.34 - i * 0.07, 0.11, 8, 22); t.rotateX(Math.PI / 2); t.translate(0, 0.12 + i * 0.18, -0.45); p.push(shade(t, (x, y, z) => (Math.sin(Math.atan2(z + 0.45, x) * 7) > 0.3 ? "#2FB84A" : "#FFD23F"))); }
  p.push(tint(taperTube([v3(0.05, 0.5, -0.45), v3(0.05, 0.68, -0.4), v3(0, 0.78, -0.3)], 0.1, 0.09, 10, 8), "#2FB84A"));
  p.push(tint(at(sq(sphere(0.15, 12, 10), 1.1, 0.8, 1.2), 0, 0.8, -0.22), "#2FB84A"));
  for (const sx of [-1, 1]) { p.push(tint(at(sphere(0.045, 8, 6), sx * 0.07, 0.88, -0.12), "#FFFFFF")); p.push(tint(at(sphere(0.025, 6, 4), sx * 0.07, 0.885, -0.08), "#1B1530")); }
  const tongue = rbox(0.03, 0.01, 0.16, 0.004); tongue.translate(0, 0.76, -0.02); p.push(tint(tongue, "#FF3D5E"));
  return merge(p);
}
/** a bee hive hanging over the branch road (slide under) — the branch above it is drawn as a twig */
export function hiveGeo(): G {
  const p: G[] = [];
  const hv = at(sq(sphere(0.32, 16, 12), 1, 1.3, 1), 0, 1.38, -0.3);
  p.push(shade(hv, (x, y) => (Math.sin(y * 30) > 0 ? "#E8A72A" : "#9A5A1E")));
  p.push(tint(at(sphere(0.07, 8, 6), 0, 1.18, -0.6), "#3A2414"));
  const twig = cyl(0.06, 0.06, 2.4, 6); twig.rotateZ(Math.PI / 2); twig.translate(0, 1.9, -0.3); p.push(tint(twig, "#6B4226"));
  p.push(tint(at(cyl(0.04, 0.04, 0.3, 6), 0, 1.75, -0.3), "#6B4226"));
  return merge(p);
}
/** a lily pad (origin at its centre) */
/** a stepping stone over lava (glowing rim) or an ice floe (origin at its centre) */
export function stoneGeo(kind: "lava" | "ice"): G {
  const g = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 7); g.translate(0, -0.08, 0);
  return kind === "lava" ? shade(g, (_x, y) => (y < -0.15 ? "#FF6A1A" : "#2A2220")) : shade(g, (_x, y) => (y > 0 ? "#F4FAFF" : "#9FD8F2"));
}
export function lilyGeo(flower = false): G {
  const s = new THREE.Shape(); s.absarc(0, 0, 0.85, 0.35, Math.PI * 2 - 0.05, false); s.lineTo(0, 0);
  const pad = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 24 }); pad.rotateX(-Math.PI / 2);
  const p: G[] = [shade(pad, (x, y, z) => mix("#2F9E44", "#7CD35A", Math.hypot(x, z) / 0.9))];
  if (flower) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(tint(at(sq(sphere(0.08, 8, 6), 1, 0.6, 1), -0.3 + Math.cos(a) * 0.08, 0.14, 0.2 + Math.sin(a) * 0.08), "#FF8FC7")); }
  if (flower) p.push(tint(at(sphere(0.05, 8, 6), -0.3, 0.16, 0.2), "#FFD23F"));
  return merge(p);
}
/** a rope bridge: one plank, the rope rails (unit length) and a post */
export function bridgeParts(): { plank: G; rope: G; post: G } {
  const plank = shade(rbox(2.1, 0.08, 0.42, 0.03), (x) => (Math.abs(x) > 0.9 ? "#8A5A2B" : "#B9774A")); plank.translate(0, 0.18, 0);
  const r: G[] = [];
  for (const sx of [-1.12, 1.12]) for (const y of [0.95, 0.35]) { const c = cyl(0.03, 0.03, 1, 6); c.rotateX(Math.PI / 2); c.translate(sx, y, -0.5); r.push(tint(c, "#D9B98A")); }
  const post = merge([tint(at(cyl(0.1, 0.12, 1.6, 8), 0, 0.3, 0), "#6B4226"), tint(at(sphere(0.12, 8, 6), 0, 1.12, 0), "#7A4A26")]);
  return { plank, rope: merge(r), post };
}
/** a crocodile in the water (faces +z, toward Kiko): body and the snapping jaw */
export function crocGeo(): { body: G; jaw: G } {
  const p: G[] = [];
  const b = at(sq(sphere(0.55, 20, 14), 0.95, 0.5, 2.0), 0, 0.2, -1.3);
  p.push(shade(b, (x, y) => (y < 0.12 ? "#C9E07A" : "#3E8E3A")));
  for (let i = 0; i < 6; i++) p.push(tint(at(sq(sphere(0.1, 8, 6), 1, 0.7, 1), 0, 0.45, -0.5 - i * 0.32), "#2F6B2E"));
  const head = at(sq(sphere(0.35, 16, 12), 1, 0.6, 1.5), 0, 0.32, 0.25); p.push(tint(head, "#3E8E3A"));
  for (const sx of [-1, 1]) {
    p.push(tint(at(sphere(0.12, 12, 10), sx * 0.18, 0.55, 0.05), "#3E8E3A"));
    p.push(tint(at(sphere(0.085, 10, 8), sx * 0.18, 0.6, 0.11), "#FFF8D6"));
    p.push(tint(at(sphere(0.045, 8, 6), sx * 0.18, 0.6, 0.18), "#1B1530"));
  }
  for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.035, 0.09, 4), -0.2 + i * 0.1, 0.17, 0.62), "#FFFFFF"));
  const tail = taperTube([v3(0, 0.2, -2.3), v3(0.15, 0.2, -2.9), v3(-0.1, 0.2, -3.4)], 0.22, 0.06, 14, 8); p.push(tint(tail, "#3E8E3A"));
  const jaw = at(sq(sphere(0.3, 14, 10), 0.95, 0.3, 1.5), 0, 0, 0.32);
  return { body: merge(p), jaw: shade(jaw, (x, y) => (y > 0.02 ? "#FF8FA3" : "#C9E07A")) };
}
/** the log raft Kiko rides */
export function raftGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 5; i++) { const lg = cyl(0.19, 0.19, 2.5, 10); lg.rotateX(Math.PI / 2); lg.translate(-0.76 + i * 0.38, 0.05, 0); p.push(shade(lg, (x, y, z) => (Math.sin(z * 9 + i) > 0.6 ? "#6B4226" : "#8A5A2B"))); }
  for (const z of [-0.8, 0.8]) { const rope = cyl(0.04, 0.04, 1.95, 6); rope.rotateZ(Math.PI / 2); rope.translate(0, 0.22, z); p.push(tint(rope, "#E7CF9A")); }
  const mast = cyl(0.04, 0.04, 1.2, 6); mast.translate(0.55, 0.8, 0.9); p.push(tint(mast, "#6B4226"));
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 0.5); s.lineTo(0.55, 0.25);
  const flag = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); flag.translate(0.57, 0.95, 0.9); p.push(tint(flag, "#FFD23F"));
  return merge(p);
}

// ------------------------------------------------------------------ fruit, bananas, goodies (origin at the centre)
export function bananaGeo(): G {
  const t = taperTube([v3(-0.26, 0.08, 0), v3(-0.12, -0.04, 0), v3(0.04, -0.07, 0), v3(0.18, -0.02, 0), v3(0.27, 0.1, 0)], 0.075, 0.035, 24, 10);
  const g = shade(t, (x) => (x > 0.24 || x < -0.24 ? "#6B4A1E" : x < -0.18 ? "#C8D24A" : "#FFD23F"));
  return g;
}
export function bunchGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 4; i++) { const b = bananaGeo(); b.rotateZ(0.35 - i * 0.22); b.rotateY(i * 0.3); b.translate(0.02 * i, -0.05 * i, 0.05 * i); p.push(b); }
  return merge(p);
}
export function fruitGeo(id: string): G {
  const p: G[] = [];
  switch (id) {
    case "mango": {
      p.push(shade(sq(sphere(0.32, 20, 16), 0.9, 1.0, 0.85), (x, y) => mix("#FF4F2A", "#FFC23D", (y + 0.32) / 0.64)));
      p.push(tint(at(sq(sphere(0.12, 8, 6), 1.6, 0.3, 0.7), 0.1, 0.34, 0), "#4FB548"));
      p.push(tint(at(cyl(0.02, 0.02, 0.08, 6), 0, 0.33, 0), "#6B4226"));
      break;
    }
    case "pineapple": {
      const b = sq(sphere(0.27, 18, 16), 1, 1.3, 1);
      p.push(shade(b, (x, y, z) => (Math.sin(Math.atan2(z, x) * 7 + y * 18) * Math.sin(Math.atan2(z, x) * 7 - y * 18) > 0.3 ? "#C98A1E" : "#FFC23D")));
      for (let i = 0; i < 7; i++) { const c = cone(0.06, 0.32, 5); c.translate(0, 0.16, 0); c.rotateZ((i - 3) * 0.22); c.rotateY(i * 0.9); c.translate(0, 0.33, 0); p.push(tint(c, "#3FAE4A")); }
      break;
    }
    case "berries": {
      for (const [x, y, z] of [[0, 0, 0], [0.15, 0.05, 0.05], [-0.15, 0.04, 0.03], [0.07, 0.18, -0.03], [-0.07, 0.17, 0.05], [0, -0.14, 0.04], [0.12, -0.11, -0.05], [-0.13, -0.1, -0.04]] as const)
        p.push(tint(at(sphere(0.1, 12, 10), x, y, z), "#5B4BE8"));
      p.push(tint(at(sq(sphere(0.12, 8, 6), 1.6, 0.3, 0.8), 0, 0.3, 0), "#4FB548"));
      break;
    }
    case "melon": {
      const w = new THREE.CylinderGeometry(0.38, 0.38, 0.16, 20, 1, false, 0, Math.PI); w.rotateX(Math.PI / 2); w.rotateZ(Math.PI);
      p.push(shade(w, (x, y) => { const r = Math.hypot(x, y); return r > 0.33 ? "#2E7D32" : r > 0.3 ? "#E9F7C8" : "#FF4F5E"; }));
      for (let i = 0; i < 5; i++) { const a = Math.PI + 0.4 + i * 0.55; p.push(tint(at(sq(sphere(0.022, 6, 4), 1, 1.5, 0.5), Math.cos(a) * 0.18, Math.sin(a) * -0.18 + 0, 0.085), "#1B1530")); }
      for (const g of p) g.translate(0, 0.12, 0);
      break;
    }
    case "kiwi": {
      const b = sq(sphere(0.28, 18, 14), 1, 0.9, 1);
      p.push(shade(b, (x, y, z) => (z < -0.18 ? (Math.hypot(x, y) < 0.06 ? "#FFF6D0" : Math.hypot(x, y) < 0.09 ? "#1B1530" : "#7CC44A") : "#8A5A2B")));
      break;
    }
    default: {
      const b = sq(sphere(0.3, 20, 16), 0.9, 1.1, 0.9);
      p.push(tint(b, "#FF3DA0"));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, y = -0.15 + (i % 3) * 0.15; const c = cone(0.05, 0.16, 5); c.rotateZ(-Math.PI / 2); c.rotateY(-a); c.translate(Math.cos(a) * 0.27, y, Math.sin(a) * 0.27); p.push(tint(c, "#7CD35A")); }
      p.push(tint(at(cone(0.08, 0.18, 6), 0, 0.38, 0), "#7CD35A"));
    }
  }
  return merge(p);
}
export function heartFruit(): G {
  const p: G[] = [];
  for (const sx of [-1, 1]) p.push(tint(at(sphere(0.2, 16, 12), sx * 0.13, 0.08, 0), "#FF2D55"));
  const c = cone(0.3, 0.38, 18); c.rotateZ(Math.PI); c.translate(0, -0.18, 0); p.push(tint(c, "#FF2D55"));
  p.push(tint(at(sq(sphere(0.1, 8, 6), 1.6, 0.35, 0.8), 0.08, 0.3, 0), "#4FB548"));
  p.push(tint(at(sq(sphere(0.06, 8, 6), 1, 1, 0.4), -0.12, 0.14, -0.15), "#FFFFFF"));
  return merge(p);
}
export function rottenGeo(): G {
  const p: G[] = [];
  p.push(shade(bumpy(sq(sphere(0.3, 16, 12), 1.05, 0.8, 1), 0.15, 2), (x, y, z) => (Math.sin(x * 20) * Math.sin(z * 18) > 0.4 ? "#3A2A14" : "#6B5A2A")));
  for (let i = 0; i < 4; i++) p.push(tint(at(sphere(0.035, 6, 4), Math.cos(i * 1.6) * 0.35, 0.3 + (i % 2) * 0.12, Math.sin(i * 1.6) * 0.35), "#1B1530"));
  return merge(p);
}
export function bubble(): G { return sphere(0.62, 28, 20); }
export function powerIcon(id: string): G {
  const p: G[] = [];
  if (id === "magnet") {
    const t = new THREE.TorusGeometry(0.22, 0.08, 10, 20, Math.PI); t.rotateZ(Math.PI); p.push(tint(t, "#FF3D5E"));
    for (const sx of [-0.22, 0.22]) p.push(tint(at(cyl(0.08, 0.08, 0.14, 10), sx, 0.07, 0), "#E9E4F2"));
    const b = bananaGeo(); b.scale(0.7, 0.7, 0.7); b.translate(0, -0.05, 0); p.push(b);
  } else if (id === "helmet") {
    const h = new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); h.translate(0, -0.08, 0);
    p.push(shade(bumpy(h, 0.04, 2), (x, y) => (Math.sin(x * 30 + y * 20) > 0.5 ? "#5A3418" : "#8A5A2B")));
    const rim = new THREE.TorusGeometry(0.3, 0.035, 6, 24); rim.rotateX(Math.PI / 2); rim.translate(0, -0.08, 0); p.push(tint(rim, "#F6E7C8"));
  } else if (id === "double") {
    for (const sx of [-0.12, 0.12]) { const b = bananaGeo(); b.rotateZ(Math.PI / 2 + sx * 2); b.translate(sx, 0, 0); p.push(b); }
    p.push(tint(at(sphere(0.06, 8, 6), 0, 0.28, 0), "#FFFFFF"));
  } else {
    const f = taperTube([v3(0, -0.3, 0), v3(0.06, 0, 0), v3(0.02, 0.3, 0)], 0.1, 0.03, 16, 8); f.scale(1.2, 1, 0.35);
    p.push(shade(f, (x, y) => (y > 0.1 ? "#3DC8FF" : y > -0.1 ? "#FFD23F" : "#FF8A1F")));
  }
  return merge(p);
}
/** a pepper rocket (the booster): red, or golden for ×5 */
export function pepperGeo(gold: boolean): G {
  const body = taperTube([v3(0, 0.32, 0), v3(0.05, 0.1, 0), v3(0.02, -0.15, 0), v3(-0.08, -0.34, 0)], 0.13, 0.03, 20, 12);
  const p = [tint(body, gold ? "#FFC21A" : "#FF2D2D"), tint(at(cyl(0.05, 0.08, 0.12, 8), 0, 0.42, 0), "#3FAE4A"), tint(at(sphere(0.06, 8, 6), 0.03, 0.5, 0), "#3FAE4A")];
  for (let i = 0; i < 3; i++) { const c = cone(0.06, 0.22, 6); c.rotateZ(Math.PI); c.translate(-0.08 + i * 0.03, -0.45 - i * 0.04, 0); p.push(tint(c, i === 1 ? "#FFD23F" : "#FF8A1F")); }
  return merge(p);
}
/** a banana bounce pad for the seed chase */
export function padGeo(): { g: G; glow: G } {
  const base = cyl(0.85, 0.95, 0.14, 24); base.translate(0, 0.07, 0);
  const ring = new THREE.TorusGeometry(0.78, 0.06, 6, 30); ring.rotateX(Math.PI / 2); ring.translate(0, 0.15, 0);
  const b = bananaGeo(); b.scale(2, 2, 2); b.rotateX(-Math.PI / 2); b.translate(0, 0.17, 0);
  return { g: merge([tint(base, "#2E7D32"), b]), glow: merge([tint(ring, "#7CFF6B")]) };
}
/** a banana flag (checkpoint) on a pole: pole + pennant (the pennant waves in the renderer) */
export function flagGeo(): { pole: G; cloth: G } {
  const pole = merge([tint(at(cyl(0.05, 0.06, 3.2, 8), 0, 1.6, 0), "#8A5A2B"), tint(at(sphere(0.1, 10, 8), 0, 3.25, 0), "#FFD23F"), tint(at(cyl(0.25, 0.3, 0.12, 10), 0, 0.06, 0), "#6B4226")]);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 0.9); s.lineTo(1.25, 0.45);
  const cl = new THREE.ShapeGeometry(s, 4); cl.translate(0.05, 2.15, 0);
  const b = bananaGeo(); b.scale(1.3, 1.3, 1.3); b.translate(0.45, 2.6, 0.03);
  return { pole, cloth: merge([shade(cl, (x, y) => (y > 2.62 ? "#FFE27A" : "#FFC21A")), b]) };
}
/** a region gate: two giant trees with a leafy arch and a banner of bananas */
export function gateGeo(): { g: G; glow: G } {
  const p: G[] = [];
  for (const sx of [-1, 1]) {
    p.push(shade(bumpy(at(cyl(0.7, 1.0, 9, 14), sx * 5.2, 4.5, 0), 0.05, sx), (x, y, z) => (Math.sin(Math.atan2(z, x - sx * 5.2) * 10 + y) > 0.5 ? "#5E3A1E" : "#7A4A26")));
    for (let i = 0; i < 4; i++) p.push(tint(at(sq(sphere(1.6, 12, 8), 1.2, 0.8, 1), sx * (4.5 - i * 0.6), 9 + (i % 2) * 0.6, (hash(i, 3) - 0.5) * 1.5), i % 2 ? "#3FAE4A" : "#2F8F3E"));
  }
  const arch = new THREE.TorusGeometry(5.2, 0.35, 10, 40, Math.PI); arch.translate(0, 6.2, 0); p.push(tint(arch, "#5E3A1E"));
  const g: G[] = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; g.push(tint(at(sphere(0.2, 8, 6), Math.cos(a) * 5.2, 6.2 + Math.sin(a) * 5.2 - 0.5, 0.2), ["#FFD23F", "#FF8FC7", "#7CFFB2"][i % 3])); }
  return { g: merge(p), glow: merge(g) };
}

// ------------------------------------------------------------------ the forest (origin on the ground)
/** a giant jungle tree: trunk with buttress roots + canopy blobs reaching over the road (v = variant) */
export function bigTree(v: number): { trunk: G; leaves: G } {
  const t: G[] = [], l: G[] = [];
  const h = 13 + v * 2.5, r = 0.9 + v * 0.25;
  t.push(shade(bumpy(at(cyl(r * 0.75, r, h, 16), 0, h / 2, 0), 0.04, v), (x, y, z) => (Math.sin(Math.atan2(z, x) * 9 + y * 0.3) > 0.5 ? "#4E2E16" : y < 2 ? "#5E3A1E" : "#6B4226")));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + v;
    const root = sq(sphere(1, 12, 10), 0.32, 1.5, 1.25); root.translate(0, 0.25, 0.55); root.rotateY(a); root.translate(Math.sin(a) * r * 0.62, 0, Math.cos(a) * r * 0.62);
    t.push(tint(root, i % 2 ? "#5E3A1E" : "#6B4226"));
  }
  t.push(tint(at(sq(sphere(r * 1.1, 10, 8), 1.02, 0.2, 1.02), 0, h * 0.35, 0), "#4FAE48"));
  const greens = ["#2F8F3E", "#3FAE4A", "#277A36", "#4FBF55"];
  for (let i = 0; i < 9; i++) {
    const a = hash(i, v + 1) * Math.PI * 2, d = 1.5 + hash(i, v + 2) * 3;
    l.push(tint(bumpy(at(sq(sphere(2.2 + hash(i, v + 3) * 1.4, 20, 14), 1.2, 0.75, 1.1), Math.cos(a) * d + 2.2, h - 0.5 + hash(i, v + 4) * 2.5, Math.sin(a) * d), 0.06, i), greens[i % 4]));
  }
  // a long branch reaching over the road (+x is toward the road; the renderer mirrors it for the right side)
  const br = cyl(0.25, 0.4, 7, 8); br.rotateZ(Math.PI / 2 - 0.25); br.translate(3.4, h - 2.6, 0); t.push(tint(br, "#6B4226"));
  for (let i = 0; i < 4; i++) l.push(tint(bumpy(at(sq(sphere(1.6, 18, 12), 1.2, 0.6, 1), 5.5 + i * 0.9, h - 1.2 - i * 0.4, (hash(i, 9) - 0.5) * 2), 0.06, i + 4), greens[(i + 1) % 4]));
  return { trunk: merge(t), leaves: merge(l) };
}
/** a hanging vine (decor) from the canopy, unit length down (scaled), with leaves */
export function hangVine(): G {
  const p: G[] = [];
  const c = cyl(0.04, 0.04, 1, 5); c.translate(0, -0.5, 0); p.push(tint(c, "#3E7A2E"));
  for (let i = 0; i < 6; i++) p.push(tint(at(sq(sphere(0.06, 6, 4), 1.4, 0.6, 0.4), (i % 2 ? 1 : -1) * 0.06, -0.1 - i * 0.16, 0), "#5FBF4A"));
  return merge(p);
}
/** a banana plant: trunk, big curved leaves, a bunch of bananas */
export function bananaPlant(v: number): G {
  const p: G[] = [];
  const h = 3.2 + v * 0.6;
  p.push(shade(at(cyl(0.22, 0.32, h, 10), 0, h / 2, 0), (x, y) => mix("#6B8A3A", "#9AB85A", y / h)));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + v;
    const leaf = new THREE.PlaneGeometry(0.9, 2.6, 2, 6);
    const pos = leaf.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k) + 1.3; pos.setXYZ(k, pos.getX(k) * Math.sin((y / 2.6) * Math.PI) * 1.2, y, -0.25 * y * y + Math.abs(pos.getX(k)) * 0.3); }
    leaf.computeVertexNormals(); leaf.rotateX(-0.6); leaf.rotateY(a); leaf.translate(0, h - 0.2, 0);
    p.push(shade(leaf, (x, y, z) => (Math.abs(Math.sin(a) * z + Math.cos(a) * x) < 0.05 ? "#C8E07A" : i % 2 ? "#3FAE4A" : "#5FBF4A")));
  }
  for (let i = 0; i < 6; i++) { const b = bananaGeo(); b.scale(1.3, 1.3, 1.3); b.rotateZ(1.2); b.rotateY(i * 1.05); b.translate(Math.cos(i * 1.05) * 0.18, h - 0.7 - (i % 2) * 0.15, Math.sin(i * 1.05) * 0.18); p.push(b); }
  return merge(p.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** a palm tree (coconuts up top) */
export function palm(v: number): G {
  const p: G[] = [];
  const h = 7 + v * 1.5;
  for (let i = 0; i < 9; i++) { const y = (i / 9) * h; p.push(tint(at(cyl(0.25 - i * 0.008, 0.3 - i * 0.008, h / 9 + 0.05, 9), Math.sin(y / h * 1.4) * 1.2, y + h / 18, 0), i % 2 ? "#8A6A3A" : "#A07A44")); }
  const tx = Math.sin(1.4) * 1.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fr = new THREE.PlaneGeometry(0.7, 3.4, 2, 8);
    const pos = fr.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k) + 1.7; pos.setXYZ(k, pos.getX(k) * Math.sin((y / 3.4) * Math.PI), y, -0.18 * y * y); }
    fr.computeVertexNormals(); fr.rotateX(-1.05); fr.rotateY(a); fr.translate(tx, h, 0);
    p.push(tint(fr, i % 2 ? "#2F9E44" : "#4FBF55"));
  }
  for (let i = 0; i < 3; i++) p.push(tint(at(sphere(0.18, 10, 8), tx + Math.cos(i * 2.1) * 0.2, h - 0.25, Math.sin(i * 2.1) * 0.2), "#6B4226"));
  return merge(p);
}
/** a fern clump */
export function fern(v: number): G {
  const p: G[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + v;
    const fr = new THREE.PlaneGeometry(0.35, 1.3, 1, 6);
    const pos = fr.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k) + 0.65; pos.setXYZ(k, pos.getX(k) * Math.sin((y / 1.3) * Math.PI), y, -0.45 * y * y); }
    fr.computeVertexNormals(); fr.rotateX(-0.5); fr.rotateY(a);
    p.push(tint(fr, i % 2 ? "#3FAE4A" : "#6BCB4A"));
  }
  return merge(p);
}
/** a flowering bush (hibiscus) */
export function flowerBush(color: string): G {
  const p: G[] = [];
  for (const [x, y, z, r] of [[0, 0.5, 0, 0.6], [0.45, 0.4, 0.2, 0.45], [-0.4, 0.42, -0.1, 0.5], [0.1, 0.85, -0.1, 0.4]] as const) p.push(tint(bumpy(at(sphere(r, 12, 9), x, y, z), 0.1, x * 5), "#2F8F3E"));
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 2) * Math.PI * 2, u = 0.2 + hash(i, 3) * 0.7;
    const x = Math.cos(a) * 0.6, z = Math.sin(a) * 0.55, y = 0.4 + u * 0.7;
    for (let k = 0; k < 5; k++) { const b = (k / 5) * Math.PI * 2; p.push(tint(at(sq(sphere(0.08, 6, 4), 1, 1, 0.4), x + Math.cos(b) * 0.08, y + Math.sin(b) * 0.08, z + 0.05), color)); }
    p.push(tint(at(sphere(0.04, 6, 4), x, y, z + 0.08), "#FFD23F"));
  }
  return merge(p);
}
/** a mossy rock with a little mushroom family */
export function mossRock(v: number): G {
  const p: G[] = [];
  p.push(shade(bumpy(at(sq(sphere(0.7, 14, 10), 1.3, 0.75, 1), 0, 0.35, 0), 0.12, v), (x, y) => (y > 0.55 ? "#4FAE48" : mix("#6E6A62", "#9A958A", y))));
  for (let i = 0; i < 3; i++) {
    const x = 0.7 + i * 0.18, z = 0.2 - i * 0.15, s = 0.6 + i * 0.2;
    p.push(tint(at(cyl(0.03 * s, 0.04 * s, 0.2 * s, 6), x, 0.1 * s, z), "#FFF2DC"));
    const c = new THREE.SphereGeometry(0.1 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(x, 0.2 * s, z); p.push(tint(c, v % 2 ? "#FF8A3D" : "#FF4F5E"));
  }
  return merge(p);
}
/** a tall grass tuft */
export function grass(): G {
  const p: G[] = [];
  for (let i = 0; i < 7; i++) { const c = cone(0.07, 0.9 + hash(i, 1) * 0.6, 4); c.translate(0, 0.45, 0); c.rotateZ((hash(i, 2) - 0.5) * 0.7); c.translate((hash(i, 3) - 0.5) * 0.5, 0, (hash(i, 4) - 0.5) * 0.5); p.push(tint(c, i % 2 ? "#5FBF4A" : "#8AD35A")); }
  return merge(p);
}
/** Kiko's Treehouse (at the very start) */
export function treehouse(): G {
  const p: G[] = [];
  p.push(shade(bumpy(at(cyl(1.3, 1.8, 14, 16), 0, 7, 0), 0.04, 3), (x, y, z) => (Math.sin(Math.atan2(z, x) * 9 + y * 0.3) > 0.5 ? "#4E2E16" : "#6B4226")));
  p.push(tint(at(rbox(4.2, 0.3, 4.2, 0.1), 0, 6.2, 0), "#8A5A2B"));
  p.push(tint(at(rbox(3.2, 2.4, 3.0, 0.15), 0, 7.5, 0), "#C98A55"));
  const roof = cone(2.9, 2.0, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 9.6, 0); p.push(tint(roof, "#3FAE4A"));
  p.push(tint(at(rbox(0.9, 1.3, 0.1, 0.05), 0.6, 7.1, 1.52), "#5A361E"));
  p.push(tint(at(rbox(0.7, 0.6, 0.1, 0.05), -0.8, 7.9, 1.52), "#FFE7A3"));
  for (let i = 0; i < 10; i++) p.push(tint(at(rbox(0.6, 0.07, 0.12, 0.02), 1.9, 0.5 + i * 0.6, 1.6), "#B9774A"));
  for (const sx of [1.7, 2.1]) p.push(tint(at(cyl(0.04, 0.04, 6, 5), sx, 3.2, 1.6), "#D9B98A"));
  for (let i = 0; i < 8; i++) p.push(tint(bumpy(at(sq(sphere(2.4, 12, 8), 1.2, 0.7, 1.1), Math.cos(i) * 2.5, 12 + (i % 3), Math.sin(i) * 2.5), 0.1, i), i % 2 ? "#3FAE4A" : "#2F8F3E"));
  const sign = rbox(1.8, 0.5, 0.08, 0.05); sign.translate(0, 6.7, 2.2); p.push(tint(sign, "#FFD23F"));
  return merge(p);
}
/** reeds / cattails by the river */
export function reeds(): G {
  const p: G[] = [];
  for (let i = 0; i < 6; i++) {
    const x = (hash(i, 1) - 0.5) * 0.8, z = (hash(i, 2) - 0.5) * 0.8, h = 1.4 + hash(i, 3) * 0.8;
    const s = cyl(0.025, 0.03, h, 5); s.translate(x, h / 2, z); p.push(tint(s, "#6B9A3A"));
    if (i % 2 === 0) p.push(tint(at(cap(0.06, 0.25, 6), x, h - 0.1, z), "#7A4A26"));
    const lf = cone(0.05, h * 0.8, 3); lf.translate(x + 0.08, h * 0.4, z); lf.rotateZ(0.1); p.push(tint(lf, "#8AC44A"));
  }
  return merge(p);
}
/** a mango tree (round canopy with mangoes) */
export function mangoTree(v: number): G {
  const p: G[] = [];
  const h = 4 + v;
  p.push(shade(bumpy(at(cyl(0.35, 0.5, h, 10), 0, h / 2, 0), 0.05, v), () => "#6B4226"));
  for (let i = 0; i < 6; i++) p.push(tint(bumpy(at(sphere(1.5 + hash(i, v) * 0.6, 20, 14), Math.cos(i) * 1.3, h + 0.8 + (i % 2) * 0.6, Math.sin(i) * 1.3), 0.05, i), i % 2 ? "#2F8F3E" : "#3FAE4A"));
  for (let i = 0; i < 9; i++) { const a = hash(i, 4) * Math.PI * 2; p.push(shade(at(sq(sphere(0.18, 10, 8), 0.9, 1, 0.85), Math.cos(a) * 2.1, h + 0.2 + hash(i, 5) * 1.2, Math.sin(a) * 2.1), (x, y) => mix("#FF4F2A", "#FFC23D", y - h))); }
  return merge(p);
}
/** a wooden dock post with a rope */
export function dockPost(): G {
  return merge([tint(at(cyl(0.16, 0.18, 2.2, 8), 0, 0.6, 0), "#6B4226"), tint(at(new THREE.TorusGeometry(0.2, 0.04, 6, 14).rotateX(Math.PI / 2), 0, 1.2, 0), "#E7CF9A")]);
}
/** a distant hill (scaled big in the renderer) */
export function hill(): G { return shade(sq(sphere(1, 18, 10), 1, 0.6, 1), (x, y) => (y > 0.35 ? "#4F9A6A" : "#3E7A5A")); }
/** a waterfall on a cliff, far away: cliff + glowing water strip */
export function waterfall(): { g: G; glow: G } {
  const cliff = bumpy(at(rbox(14, 22, 6, 1), 0, 11, 0), 0.05, 5);
  const g = merge([shade(cliff, (x, y) => (y > 21 ? "#3FAE4A" : mix("#5E6E62", "#8A9A88", y / 22))), tint(bumpy(at(sq(sphere(5, 12, 8), 1.6, 0.6, 1), 0, 22, 0), 0.1, 2), "#2F8F3E")]);
  const fall = new THREE.PlaneGeometry(3.2, 21, 1, 1); fall.translate(0, 10.5, 3.05);
  const pool = at(sq(sphere(3, 14, 8), 1.4, 0.15, 0.9), 0, 0.2, 5);
  return { g, glow: merge([tint(fall, "#E9FBFF"), tint(pool, "#FFFFFF")]) };
}
/** a cloud */
export function cloudPuff(): G {
  const p: G[] = [];
  for (const [x, y, r] of [[0, 0, 3], [3.2, -0.6, 2.4], [-3.2, -0.5, 2.3], [1.4, 1.4, 2.2], [-1.6, 1.1, 2.0]] as const) p.push(tint(at(sphere(r, 14, 10), x, y, 0), "#FFFFFF"));
  return merge(p);
}
/** a god ray: a soft light shaft (unit, leaning) */
export function rayGeo(): G {
  const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, -0.5, 0);
  return shade(g, (x, y) => mix("#FFFFFF", "#000000", -y));
}
export { none, ry, rx, rz };
/** building helpers for models2.ts */
export const H = { sphere, at, sq, cyl, cone, rbox, cap, shade, bumpy, taperTube, mix, hash, v3 };

// ------------------------------------------------------------------ textures
/** the path: packed earth (or stone, sand, snow, planks, basalt…) with specks, litter and two rows of stones marking the lanes */
export function pathTex(look: { base: [string, string, string]; stones: string; litter: string[]; edge: string; planks?: boolean; cracks?: string }) {
  const edgeRGB = new THREE.Color(look.edge);
  const er = Math.round(edgeRGB.r * 255), eg = Math.round(edgeRGB.g * 255), eb = Math.round(edgeRGB.b * 255);
  return canvasTex(256, 256, (c) => {
    const base = look.base;
    c.fillStyle = base[0]; c.fillRect(0, 0, 256, 256);
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    if (look.planks) {
      for (let y = 0; y < 256; y += 32) {
        c.fillStyle = y % 64 ? base[1] : base[2]; c.fillRect(0, y, 256, 30);
        c.strokeStyle = "rgba(60,30,10,0.25)"; c.lineWidth = 1;
        for (let k = 0; k < 4; k++) { c.beginPath(); const yy = y + 5 + k * 6; c.moveTo(0, yy); for (let x = 0; x <= 256; x += 32) c.lineTo(x, yy + Math.sin((x + y) * 0.05) * 1.4); c.stroke(); }
        c.fillStyle = "rgba(40,20,5,0.6)"; c.fillRect(0, y + 30, 256, 2);
        for (const x of [20, 236]) { c.beginPath(); c.arc(x, y + 15, 2, 0, 7); c.fill(); }
      }
    } else {
      for (let i = 0; i < 900; i++) { c.fillStyle = base[1 + (i % 2)]; c.globalAlpha = 0.35; const x = r() * 256, y = r() * 256; c.beginPath(); c.ellipse(x, y, 2 + r() * 7, 1 + r() * 4, r() * 3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      for (let i = 0; i < 70; i++) { c.fillStyle = look.stones; const x = r() * 256, y = r() * 256; c.beginPath(); c.ellipse(x, y, 1.5 + r() * 2.5, 1 + r() * 2, r() * 3, 0, 7); c.fill(); }
    }
    for (let i = 0; i < (look.litter.length ? 26 : 0); i++) { c.fillStyle = look.litter[i % look.litter.length]; c.globalAlpha = 0.8; const x = r() * 256, y = r() * 256; c.beginPath(); c.ellipse(x, y, 5, 2.4, r() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    if (look.cracks) { c.strokeStyle = look.cracks; c.lineWidth = 2.5; for (let i = 0; i < 7; i++) { c.beginPath(); let x = r() * 256, y = r() * 256; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += r() * 30; c.lineTo(x, y); } c.stroke(); } }
    if (!look.planks) for (const lx of [256 / 3, (256 * 2) / 3]) for (let y = 6; y < 256; y += 21) { c.fillStyle = look.stones; c.beginPath(); c.ellipse(lx + (r() - 0.5) * 4, y, 5, 4, 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.ellipse(lx - 1.5, y - 1.5, 2, 1.4, 0, 0, 7); c.fill(); }
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, `rgba(${er},${eg},${eb},0.85)`); g.addColorStop(0.07, `rgba(${er},${eg},${eb},0)`); g.addColorStop(0.93, `rgba(${er},${eg},${eb},0)`); g.addColorStop(1, `rgba(${er},${eg},${eb},0.85)`);
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  });
}
/** the ground beside the path: grass blades and little dots (flowers, petals, snow sparkles…) */
export function grassTex(look: { base: string; blades: string[]; dots: string[] }) {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = look.base; c.fillRect(0, 0, 256, 256);
    let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 1400; i++) { c.fillStyle = look.blades[i % look.blades.length]; const x = r() * 256, y = r() * 256; c.fillRect(x, y, 2, 4 + r() * 4); }
    for (let i = 0; i < (look.dots.length ? 34 : 0); i++) { c.fillStyle = look.dots[i % look.dots.length]; c.beginPath(); c.arc(r() * 256, r() * 256, 1.7, 0, 7); c.fill(); }
  });
}
/** lava: dark crust with glowing cracks (used as an emissive map too) */
export function lavaTex(glow: boolean) {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = glow ? "#000000" : "#2A1A16"; c.fillRect(0, 0, 256, 256);
    let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    c.strokeStyle = glow ? "#FF8A2A" : "#FF5A1A"; c.lineWidth = 6;
    for (let i = 0; i < 14; i++) { c.beginPath(); let x = r() * 256, y = r() * 256; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; c.lineTo(x, y); } c.stroke(); }
    if (glow) { c.fillStyle = "#FFC23D"; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(r() * 256, r() * 256, 2 + r() * 4, 0, 7); c.fill(); } }
  });
}
/** river water: soft ripples */
export function waterTex() {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = "#2E9FB8"; c.fillRect(0, 0, 256, 256);
    let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 120; i++) { c.strokeStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(20,80,110,0.25)"; c.lineWidth = 1 + r() * 2; const x = r() * 256, y = r() * 256; c.beginPath(); c.ellipse(x, y, 8 + r() * 16, 2 + r() * 3, 0, 0, Math.PI * 2); c.stroke(); }
  });
}
export function glintTex() {
  return canvasTex(64, 64, (c) => {
    c.fillStyle = "#000000"; c.fillRect(0, 0, 64, 64);
    c.fillStyle = "rgba(255,240,210,0.95)";
    for (let i = 0; i < 9; i++) c.fillRect((i * 23) % 60, (i * 37) % 62, 3 + (i % 3), 1);
  });
}
export function radialTex() {
  return canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }, false);
}
/** cliff wall for chasms: layered rock with roots */
export function cliffTex() {
  return canvasTex(128, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#6B4A2E"); g.addColorStop(0.3, "#4A3A2E"); g.addColorStop(1, "#140E0A");
    c.fillStyle = g; c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 12; i++) { c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, 20 + i * 19, 128, 3); }
    c.strokeStyle = "#7A5A2E"; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { c.beginPath(); const x = 10 + i * 21; c.moveTo(x, 0); c.bezierCurveTo(x + 8, 30, x - 8, 60, x + 4, 90 + i * 8); c.stroke(); }
  });
}
void ry; void rx; void rz; void none;
