// Tondu's Vine Climb — every model besides Tondu, built in code with vertex colours (one material per look): the
// vine's leaves, tendrils and flowers, thorns, thistle buds, burrs, the 30 bugs, fruit, pods, snails, bees, spiders,
// the guardians, the flower gate, pickups and the background props of the 30 worlds.
import * as THREE from "three";
import type { BugKind, Guardian } from "./worlds";

type G = THREE.BufferGeometry;
const C = (c: string | THREE.Color) => (c instanceof THREE.Color ? c : new THREE.Color(c));

/** give a geometry one vertex colour */
export function paint(g: G, color: string | THREE.Color, jitter = 0): G {
  const n = g.getAttribute("position").count, col = new Float32Array(n * 3), c = C(color);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * jitter : 1;
    col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
/** merge geometries that all have position / normal / color (non-indexed output is fine for small props) */
export function merge(parts: G[]): G {
  const ps: number[] = [], ns: number[] = [], cs: number[] = [];
  for (const g0 of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const p = g.getAttribute("position"), n = g.getAttribute("normal"), c = g.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      ps.push(p.getX(i), p.getY(i), p.getZ(i)); ns.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) cs.push(c.getX(i), c.getY(i), c.getZ(i)); else cs.push(1, 1, 1);
    }
    if (g !== g0) g.dispose();
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(cs, 3));
  return out;
}
const at = (g: G, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const rot = (g: G, x: number, y: number, z: number) => { g.rotateX(x); g.rotateY(y); g.rotateZ(z); return g; };
const sph = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cyl = (a: number, b: number, h: number, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r: number, h: number, s = 8) => new THREE.ConeGeometry(r, h, s);

// ------------------------------------------------------------------------------------------------ leaves & vine
/** a leaf: pointed oval, folded along the midrib, curling down at the tip (length along +Z, lying in XZ) */
export function leafGeo(len = 1, wid = 0.42, color = "#4FAF3A", rib = "#8CD26A"): G {
  const seg = 8, rows = 3, ps: number[] = [], cs: number[] = [], idx: number[] = [];
  const c1 = C(color), c2 = C(rib), cTip = C(color).multiplyScalar(0.8);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = Math.sin(Math.pow(t, 0.85) * Math.PI) * wid * 0.5;
    for (let j = -rows; j <= rows; j++) {
      const k = j / rows, x = k * w, fold = Math.abs(k) * w * 0.35, droop = -Math.pow(t, 2) * len * 0.22;
      ps.push(x, fold + droop, t * len);
      const c = Math.abs(j) === 0 ? c2 : c1.clone().lerp(cTip, t * 0.6);
      cs.push(c.r, c.g, c.b);
    }
  }
  const W = rows * 2 + 1;
  for (let i = 0; i < seg; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cs, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** a curly tendril (a little helix) */
export function tendrilGeo(color = "#7ACB4A"): G {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 5, r = 0.09 * (1 - t * 0.7); pts.push(new THREE.Vector3(Math.cos(a) * r, t * 0.45, Math.sin(a) * r)); }
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 5, false), color);
}
/** a small five-petal flower facing +Z */
export function flowerGeo(petal: string, heart = "#FFE14A", size = 0.16): G {
  const parts: G[] = [];
  for (let i = 0; i < 5; i++) {
    const p = paint(sph(size * 0.55, 8, 6), petal); p.scale(0.55, 1, 0.22); at(p, 0, size * 0.55, 0); p.rotateZ((i / 5) * Math.PI * 2); parts.push(p);
  }
  parts.push(at(paint(sph(size * 0.28, 8, 6), heart), 0, 0, size * 0.06));
  return merge(parts);
}

// ------------------------------------------------------------------------------------------------ hazards
/** a cluster of three hooked thorns on a little woody base — reddish so it reads on any green */
export function thornGeo(): G {
  const parts: G[] = [paint(sph(0.11, 10, 6), "#6E3A1E").scale(1.1, 0.5, 1.1) as G];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const t = paint(cone(0.065, 0.36, 8), "#C2412A");
    rot(t, 0.25 * Math.cos(a), 0, 0.25 * Math.sin(a)); at(t, Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05);
    const tipC = paint(cone(0.028, 0.12, 6), "#FFE0B0"); rot(tipC, 0.25 * Math.cos(a), 0, 0.25 * Math.sin(a)); at(tipC, Math.cos(a) * 0.09, 0.33, Math.sin(a) * 0.09);
    parts.push(t, tipC);
  }
  const big = paint(cone(0.075, 0.5, 8), "#D04A2E"); at(big, 0, 0.25, 0); parts.push(big);
  const tip = paint(cone(0.03, 0.14, 6), "#FFE6C0"); at(tip, 0, 0.53, 0); parts.push(tip);
  return merge(parts);
}
/** a spiky burr ball (rolls down the vine) */
export function burrGeo(color = "#9CCB3A"): G {
  const parts: G[] = [paint(new THREE.IcosahedronGeometry(0.17, 1), color, 0.1)];
  const ico = new THREE.IcosahedronGeometry(1, 1), p = ico.getAttribute("position"), seen = new Set<string>();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize(), key = v.toArray().map((x) => x.toFixed(2)).join();
    if (seen.has(key)) continue; seen.add(key);
    const s = paint(cone(0.035, 0.2, 5), "#E6F08A");
    s.translate(0, 0.25, 0); s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v)); parts.push(s);
  }
  ico.dispose();
  return merge(parts);
}
/** a thistle bud: a round head with a crown of spikes (opens / closes by scaling the spikes) */
export function budHeadGeo(): G { return merge([paint(sph(0.16, 12, 8), "#7A5AB0"), at(paint(cyl(0.12, 0.08, 0.14, 10), "#5E8A3A"), 0, -0.12, 0)]); }
export function budSpikesGeo(): G {
  const parts: G[] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const s = paint(cone(0.03, 0.34, 5), i % 2 ? "#E07AE8" : "#B86AD8"); s.translate(0, 0.17, 0); s.rotateZ(0.9); s.rotateY(a); parts.push(s); }
  const top = paint(cone(0.035, 0.4, 5), "#F0A0F0"); at(top, 0, 0.2, 0); parts.push(top);
  return merge(parts);
}
export function antGeo(): G {
  return merge([
    at(paint(sph(0.035, 8, 6), "#2A1A14"), 0, 0.03, 0.05), at(paint(sph(0.03, 8, 6), "#3A221A"), 0, 0.03, 0), at(paint(sph(0.045, 8, 6), "#2A1A14").scale(1, 0.85, 1.3) as G, 0, 0.035, -0.07),
    ...[-1, 1].flatMap((sd) => [-0.03, 0, 0.03].map((z) => at(rot(paint(cyl(0.006, 0.006, 0.09, 4), "#1A100C"), 0, 0, sd * 1.1), sd * 0.04, 0.02, z))),
  ]);
}
export function beeGeo(body = "#F2B32A", stripe = "#2A2018"): G {
  const parts: G[] = [paint(sph(0.12, 12, 8), body).scale(1, 0.9, 1.35) as G];
  for (const z of [-0.06, 0.04]) parts.push(at(paint(cyl(0.118, 0.118, 0.035, 12), stripe).rotateX(Math.PI / 2) as G, 0, 0, z));
  parts.push(at(paint(sph(0.08, 10, 8), stripe), 0, 0.01, 0.17));
  for (const sd of [-1, 1]) { const w = paint(sph(0.12, 8, 6), "#E8F6FF"); w.scale(1, 0.12, 0.55); at(w, sd * 0.12, 0.11, 0.0); w.rotateZ(sd * 0.4); parts.push(w); }
  parts.push(at(paint(cone(0.02, 0.08, 5), stripe).rotateX(-Math.PI / 2) as G, 0, 0, -0.2));
  return merge(parts);
}
export function spiderGeo(body = "#4A3A5A", mark = "#FFD23F"): G {
  const parts: G[] = [paint(sph(0.15, 12, 8), body).scale(1, 0.85, 1.2) as G, at(paint(sph(0.09, 10, 8), body), 0, 0, 0.18), at(paint(sph(0.04, 8, 6), mark), 0, 0.12, -0.02)];
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 0.32;
    const l1 = paint(cyl(0.014, 0.012, 0.22, 5), body); l1.translate(0, 0.11, 0); l1.rotateZ(sd * -1.0); l1.rotateY(sd * (a - 1)); at(l1, sd * 0.08, 0.02, 0.1 - i * 0.07);
    parts.push(l1);
  }
  for (const sd of [-1, 1]) parts.push(at(paint(sph(0.022, 6, 6), "#FFFFFF"), sd * 0.035, 0.04, 0.26));
  return merge(parts);
}
export function mangoGeo(): G { return merge([paint(sph(0.2, 12, 10), "#FFB21E").scale(0.85, 1.15, 0.85) as G, at(paint(sph(0.12, 8, 6), "#FF7A2A").scale(0.7, 0.6, 0.7) as G, 0.06, 0.08, 0.1), at(paint(cyl(0.012, 0.012, 0.1, 5), "#5A3A1A"), 0, 0.24, 0)]); }
export function coconutGeo(): G { return merge([paint(sph(0.22, 12, 10), "#7A5230", 0.08), ...[0, 2.1, 4.2].map((a) => at(paint(sph(0.03, 6, 6), "#3A2414"), Math.cos(a) * 0.08, 0.19, Math.sin(a) * 0.08))]); }
export function nutGeo(): G { return merge([paint(sph(0.14, 10, 8), "#A8743A").scale(1, 1.2, 1) as G, at(paint(sph(0.15, 10, 6, ), "#6A4A2A").scale(1, 0.55, 1) as G, 0, 0.12, 0), at(paint(cyl(0.015, 0.015, 0.08, 5), "#4A3A20"), 0, 0.22, 0)]); }
export function podGeo(): G { return merge([paint(sph(0.15, 10, 8), "#6AB83A").scale(0.8, 1.25, 0.8) as G, ...[0, 1, 2, 3].map((i) => at(paint(sph(0.05, 6, 6), "#A8E070"), Math.cos(i * 1.57) * 0.1, 0.02, Math.sin(i * 1.57) * 0.1))]); }
export function snailGeo(): G {
  const parts: G[] = [];
  for (let i = 0; i < 26; i++) { const t = i / 26, a = t * Math.PI * 3.2, r = 0.18 * (1 - t * 0.75); parts.push(at(paint(sph(0.09 * (1 - t * 0.7), 8, 6), i % 3 ? "#C8823A" : "#8A4A22"), Math.cos(a) * r * 0.6, 0.2 + Math.sin(a) * r * 0.9, 0)); }
  parts.push(at(paint(sph(0.08, 10, 8), "#D8C8A0").scale(0.8, 0.6, 2.4) as G, 0, 0.05, 0.05));
  for (const sd of [-1, 1]) { parts.push(at(paint(cyl(0.01, 0.01, 0.14, 4), "#C8B890").rotateX(0.6) as G, sd * 0.03, 0.12, 0.25)); parts.push(at(paint(sph(0.02, 6, 6), "#2A2A2A"), sd * 0.03, 0.18, 0.29)); }
  return merge(parts);
}
export function dropGeo(): G { return paint(sph(0.07, 10, 8).scale(1, 1.4, 1) as G, "#9FE0FF"); }
/** a crawler segment (caterpillar / snake body), instanced along its length */
export function segGeo(color: string): G { return paint(sph(0.15, 12, 8), color); }

// ------------------------------------------------------------------------------------------------ bugs
export function bugGeo(b: BugKind | null): G {
  if (!b) {
    // the golden beetle (a coin)
    return merge([paint(sph(0.13, 14, 10), "#FFC83A").scale(1, 0.75, 1.25) as G, at(paint(sph(0.07, 10, 8), "#E09A10"), 0, 0.02, 0.15), at(paint(cyl(0.003, 0.003, 0.26, 4), "#C88A10").rotateX(Math.PI / 2) as G, 0, 0.04, 0.02)]);
  }
  const body = b.body, wing = b.wing, parts: G[] = [];
  const legs = (y = 0) => { for (const sd of [-1, 1]) for (const z of [-0.05, 0, 0.05]) parts.push(at(rot(paint(cyl(0.006, 0.005, 0.1, 4), "#2A2418"), 0, 0, sd * 1.05), sd * 0.06, y, z)); };
  const eyes = (z: number, y = 0.03, w = 0.035) => { for (const sd of [-1, 1]) parts.push(at(paint(sph(0.018, 6, 6), "#1A1A1A"), sd * w, y, z)); };
  switch (b.shape) {
    case "beetle": case "ladybird":
      parts.push(paint(sph(0.12, 12, 10), wing).scale(1, 0.7, 1.2) as G, at(paint(sph(0.07, 10, 8), body), 0, 0, 0.14));
      if (b.shape === "ladybird") for (const [x, z] of [[0.05, 0.03], [-0.05, 0.03], [0.04, -0.06], [-0.04, -0.06]]) parts.push(at(paint(sph(0.025, 6, 6), "#1A1A1A"), x, 0.075, z));
      parts.push(at(paint(cyl(0.004, 0.004, 0.24, 3), "#1A1A1A").rotateX(Math.PI / 2) as G, 0, 0.088, -0.01));
      legs(); eyes(0.18); break;
    case "cricket":
      parts.push(paint(sph(0.08, 10, 8), body).scale(0.9, 0.9, 2.2) as G, at(paint(sph(0.07, 10, 8), body), 0, 0.03, 0.17), at(paint(sph(0.07, 8, 6), wing).scale(0.8, 0.35, 2.4) as G, 0, 0.06, -0.03));
      for (const sd of [-1, 1]) { const hl = paint(cyl(0.012, 0.008, 0.26, 5), body); hl.rotateX(1.1); at(hl, sd * 0.07, 0.08, -0.08); parts.push(hl); }
      for (const sd of [-1, 1]) parts.push(at(paint(cyl(0.003, 0.003, 0.3, 3), "#3A3020").rotateX(-1.1) as G, sd * 0.03, 0.12, 0.3));
      legs(); eyes(0.21, 0.06); break;
    case "moth":
      parts.push(paint(sph(0.07, 10, 8), body).scale(1, 1, 2) as G);
      for (const sd of [-1, 1]) { const w = paint(sph(0.2, 10, 8), wing, 0.05); w.scale(1, 0.08, 0.75); at(w, sd * 0.19, 0.04, 0); parts.push(w); }
      for (const sd of [-1, 1]) parts.push(at(paint(cyl(0.004, 0.004, 0.14, 3), "#3A2A20").rotateX(-0.9) as G, sd * 0.03, 0.06, 0.16));
      eyes(0.13); break;
    case "fly": case "bee":
      if (b.shape === "bee") return beeGeo(body, "#2A2018").scale(0.75, 0.75, 0.75);
      parts.push(paint(sph(0.07, 10, 8), body).scale(1, 0.9, 1.6) as G, at(paint(sph(0.055, 8, 6), body), 0, 0, 0.12));
      for (const sd of [-1, 1]) { const w = paint(sph(0.11, 8, 6), wing); w.scale(0.6, 0.08, 1.2); at(w, sd * 0.07, 0.07, -0.04); w.rotateY(sd * 0.3); parts.push(w); }
      parts.push(...[-1, 1].map((sd) => at(paint(sph(0.03, 8, 6), "#C02A2A"), sd * 0.04, 0.02, 0.15)));
      legs(-0.02); break;
    case "dragonfly":
      parts.push(paint(cyl(0.025, 0.012, 0.42, 6), body).rotateX(Math.PI / 2) as G, at(paint(sph(0.06, 10, 8), body), 0, 0, 0.22));
      for (const sd of [-1, 1]) for (const z of [0.1, 0.0]) { const w = paint(sph(0.2, 8, 6), wing); w.scale(1, 0.05, 0.22); at(w, sd * 0.19, 0.03, z); parts.push(w); }
      parts.push(...[-1, 1].map((sd) => at(paint(sph(0.04, 8, 6), "#2A6AAA"), sd * 0.04, 0.02, 0.25)));
      break;
    case "stick":
      parts.push(paint(cyl(0.02, 0.016, 0.44, 5), body).rotateX(Math.PI / 2) as G, at(paint(sph(0.03, 8, 6), body), 0, 0, 0.23));
      for (const sd of [-1, 1]) for (const z of [-0.12, 0.02, 0.14]) parts.push(at(rot(paint(cyl(0.007, 0.006, 0.18, 4), body), 0.4, 0, sd * 1.0), sd * 0.08, 0.02, z));
      eyes(0.25, 0.02, 0.02); break;
    case "caterpillar":
      for (let i = 0; i < 7; i++) parts.push(at(paint(sph(0.06, 8, 6), i % 2 ? body : wing), 0, Math.sin(i * 0.9) * 0.02, -0.18 + i * 0.065));
      eyes(0.24, 0.03, 0.025); break;
  }
  if (b.glow) parts.push(at(paint(sph(0.06, 8, 6), "#FFFFA0"), 0, 0, -0.12));
  return merge(parts);
}

// ------------------------------------------------------------------------------------------------ pickups, gate
export function sunGeo(): G { return merge([paint(sph(0.2, 16, 12), "#FFC83A"), ...Array.from({ length: 10 }, (_, i) => { const r = paint(cone(0.05, 0.16, 5), "#FF9A2A"); r.translate(0, 0.27, 0); r.rotateZ((i / 10) * Math.PI * 2); return r; })]); }
export function glideGeo(): G { return leafGeo(0.7, 0.5, "#9AE07A", "#E8FFC8"); }
export function magnetGeo(): G { return merge([paint(new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI), "#E8402A"), at(paint(cyl(0.05, 0.05, 0.08, 8), "#E8F0FF"), 0.16, -0.04, 0), at(paint(cyl(0.05, 0.05, 0.08, 8), "#E8F0FF"), -0.16, -0.04, 0)]); }
export function shieldGeo(): G { return merge([paint(new THREE.IcosahedronGeometry(0.2, 1), "#5FC85A", 0.15), ...Array.from({ length: 6 }, (_, i) => at(paint(sph(0.06, 6, 6), "#9AF07A"), Math.cos(i) * 0.17, Math.sin(i * 2) * 0.12, Math.sin(i) * 0.17))]); }
/** the flower gate: a ring of leaves and big petals round the vine */
export function gateGeo(petal: string): G {
  const parts: G[] = [paint(new THREE.TorusGeometry(0.62, 0.07, 10, 32), "#3E9B2F")];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p = paint(sph(0.2, 10, 8), i % 2 ? petal : "#FFFFFF"); p.scale(0.5, 1, 0.25); p.translate(0, 0.78, 0); p.rotateZ(a); parts.push(p);
    const l = leafGeo(0.45, 0.24, "#4FAF3A"); l.rotateX(-Math.PI / 2); l.translate(0, 0.6, 0); l.rotateZ(a + 0.26); parts.push(l);
  }
  return merge(parts);
}
export function mossRingGeo(): G { return merge(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return at(paint(sph(0.09, 6, 5), i % 3 ? "#7ACB4A" : "#B8E870"), Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0); })); }
export function flowerPadGeo(petal: string): G {
  const parts: G[] = [];
  for (let i = 0; i < 8; i++) { const p = paint(sph(0.3, 10, 8), petal); p.scale(0.42, 0.12, 1); p.translate(0, 0, 0.3); p.rotateY((i / 8) * Math.PI * 2); parts.push(p); }
  parts.push(paint(sph(0.15, 10, 8), "#FFE14A").scale(1, 0.5, 1) as G);
  return merge(parts);
}
/** a hanging aerial root (the swinging rope) */
export function ropeGeo(): G {
  const pts = Array.from({ length: 12 }, (_, i) => new THREE.Vector3(Math.sin(i * 0.7) * 0.04, -i * 0.3, 0));
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.045, 6), "#8A6A3A");
}

// ------------------------------------------------------------------------------------------------ guardians
/** a guardian built from its model kind and colours; faces +Z, about 1 m tall at size 1 */
export function guardianGeo(g: Guardian): { body: G; wings?: G } {
  const [a, b, c] = g.colors;
  switch (g.model) {
    case "bird": {
      const body = merge([
        paint(sph(0.42, 16, 12), a).scale(0.9, 0.85, 1.25) as G, at(paint(sph(0.28, 14, 10), a), 0, 0.32, 0.38),
        at(paint(cone(0.09, 0.34, 8), c).rotateX(Math.PI / 2) as G, 0, 0.28, 0.75), at(paint(sph(0.3, 12, 8), b).scale(0.8, 0.7, 0.9) as G, 0, -0.08, 0.18),
        ...[-1, 1].map((sd) => at(paint(sph(0.065, 8, 6), "#FFFFFF"), sd * 0.16, 0.38, 0.55)), ...[-1, 1].map((sd) => at(paint(sph(0.04, 8, 6), "#111111"), sd * 0.18, 0.39, 0.6)),
        at(paint(cone(0.24, 0.6, 6), a).rotateX(-Math.PI / 2 - 0.3) as G, 0, 0.05, -0.62),
        ...[-1, 1].map((sd) => at(paint(cyl(0.02, 0.02, 0.32, 5), c), sd * 0.14, -0.42, 0.05)),
      ]);
      const wings = merge([-1, 1].map((sd) => { const w = paint(sph(0.5, 12, 8), b); w.scale(1.2, 0.12, 0.6); w.translate(sd * 0.55, 0, 0); return w; }));
      return { body, wings };
    }
    case "monkey": return { body: merge([
      paint(sph(0.4, 14, 10), a).scale(1, 1.1, 0.9) as G, at(paint(sph(0.3, 14, 10), a), 0, 0.55, 0.05), at(paint(sph(0.2, 12, 8), b).scale(1, 0.85, 0.7) as G, 0, 0.5, 0.22),
      ...[-1, 1].map((sd) => at(paint(sph(0.11, 10, 8), b), sd * 0.3, 0.62, 0)), ...[-1, 1].map((sd) => at(paint(sph(0.05, 8, 6), "#1A1A1A"), sd * 0.09, 0.6, 0.31)),
      ...[-1, 1].map((sd) => at(rot(paint(cyl(0.07, 0.06, 0.6, 6), a), 0, 0, sd * 0.6), sd * 0.38, 0.2, 0.05)), at(paint(new THREE.TorusGeometry(0.35, 0.05, 6, 16, Math.PI * 1.3), a).rotateY(Math.PI / 2) as G, 0, -0.1, -0.4),
      at(paint(sph(0.1, 8, 6), c), 0.45, -0.1, 0.25),
    ]) };
    case "snake": return { body: merge([paint(sph(0.24, 14, 10), a).scale(0.9, 0.7, 1.4) as G, ...[-1, 1].map((sd) => at(paint(sph(0.06, 8, 6), "#FFE14A"), sd * 0.13, 0.1, 0.18)), ...[-1, 1].map((sd) => at(paint(sph(0.03, 6, 6), "#111"), sd * 0.15, 0.11, 0.22)), at(paint(cyl(0.008, 0.008, 0.18, 3), "#E8402A").rotateX(Math.PI / 2) as G, 0, -0.02, 0.4)]) };
    case "beetle": return { body: merge([paint(sph(0.4, 14, 10), a).scale(1, 0.7, 1.3) as G, at(paint(sph(0.24, 12, 8), b), 0, 0.05, 0.5), at(paint(cone(0.07, 0.45, 6).rotateX(-0.5) as G, c), 0, 0.3, 0.7), ...[-1, 1].flatMap((sd) => [-0.25, 0, 0.25].map((z) => at(rot(paint(cyl(0.03, 0.025, 0.45, 5), c), 0, 0, sd * 1.1), sd * 0.38, -0.05, z)))]) };
    case "crab": return { body: merge([paint(sph(0.4, 14, 10), a).scale(1.3, 0.6, 1) as G, ...[-1, 1].map((sd) => at(paint(sph(0.18, 10, 8), b).scale(1.2, 0.8, 0.9) as G, sd * 0.7, 0.1, 0.35)), ...[-1, 1].map((sd) => at(paint(cyl(0.025, 0.025, 0.2, 5), c), sd * 0.12, 0.3, 0.25)), ...[-1, 1].map((sd) => at(paint(sph(0.05, 8, 6), "#111"), sd * 0.12, 0.42, 0.25)), ...[-1, 1].flatMap((sd) => [-0.2, 0, 0.2].map((z) => at(rot(paint(cyl(0.03, 0.02, 0.5, 5), a), 0, 0, sd * 1.2), sd * 0.55, -0.1, z)))]) };
    case "spider": return { body: spiderGeo(a, c).scale(3, 3, 3) as G };
    case "wasp": return { body: beeGeo(a, b).scale(3.2, 3.2, 3.2) as G };
    case "bat": {
      const body = merge([paint(sph(0.3, 12, 10), a).scale(1, 1.1, 0.9) as G, ...[-1, 1].map((sd) => at(paint(cone(0.1, 0.25, 5), a), sd * 0.16, 0.38, 0)), ...[-1, 1].map((sd) => at(paint(sph(0.05, 6, 6), "#FFD23F"), sd * 0.1, 0.12, 0.25))]);
      const wings = merge([-1, 1].map((sd) => { const w = paint(sph(0.6, 10, 6), b); w.scale(1.1, 0.06, 0.6); w.translate(sd * 0.65, 0, 0); return w; }));
      return { body, wings };
    }
    case "frog": return { body: merge([paint(sph(0.5, 16, 12), a).scale(1.1, 0.75, 1) as G, ...[-1, 1].map((sd) => at(paint(sph(0.16, 12, 8), a), sd * 0.28, 0.32, 0.25)), ...[-1, 1].map((sd) => at(paint(sph(0.11, 10, 8), "#FFFFFF"), sd * 0.3, 0.38, 0.33)), ...[-1, 1].map((sd) => at(paint(sph(0.06, 8, 6), "#111"), sd * 0.3, 0.4, 0.42)), at(paint(sph(0.38, 12, 8), b).scale(1, 0.4, 0.8) as G, 0, -0.18, 0.18)]) };
    case "moth": {
      const body = merge([paint(sph(0.22, 12, 10), b).scale(1, 1, 2.2) as G, ...[-1, 1].map((sd) => at(paint(cyl(0.01, 0.01, 0.4, 3), b).rotateX(-0.8) as G, sd * 0.08, 0.2, 0.45))]);
      const wings = merge([-1, 1].map((sd) => { const w = paint(sph(0.7, 12, 8), a, 0.05); w.scale(1, 0.05, 0.75); w.translate(sd * 0.7, 0, 0); return w; }));
      return { body, wings };
    }
    default: return { body: paint(sph(0.4), a) };
  }
}

// ------------------------------------------------------------------------------------------------ background props
/** a background prop, about 1 unit tall (scaled by the placer); colours from the world */
export function propGeo(kind: string, leaf: [string, string, string], trunk: string, accent: string): G {
  const [l1, l2, l3] = leaf;
  const blobs = (n: number, r: number, cy: number, col: string[], spread = 1) => Array.from({ length: n }, (_, i) => {
    const a = i * 2.4, rr = r * (0.6 + ((i * 37) % 10) / 25);
    const g = paint(sph(rr, 12, 9), col[i % col.length], 0.06); g.scale(1, 0.82, 1);
    return at(g, Math.cos(a) * r * 0.9 * spread, cy + Math.sin(i * 1.7) * r * 0.5, Math.sin(a) * r * 0.6);
  });
  switch (kind) {
    case "tree": return merge([at(paint(cyl(0.07, 0.12, 1, 8), trunk), 0, 0.5, 0), ...blobs(6, 0.36, 1.05, [l1, l2, l3])]);
    case "mango": return merge([at(paint(cyl(0.07, 0.12, 1, 8), trunk), 0, 0.5, 0), ...blobs(6, 0.36, 1.05, [l1, l2]), ...Array.from({ length: 6 }, (_, i) => at(paint(sph(0.06, 8, 6), accent).scale(0.8, 1.2, 0.8) as G, Math.cos(i * 1.9) * 0.35, 0.82 + (i % 3) * 0.12, Math.sin(i * 1.9) * 0.3 + 0.2))]);
    case "fern": return merge(Array.from({ length: 9 }, (_, i) => { const l = leafGeo(0.7, 0.2, i % 2 ? l1 : l2); l.rotateX(-0.9 + (i % 3) * 0.2); l.rotateY((i / 9) * Math.PI * 2); return l; }));
    case "bamboo": return merge(Array.from({ length: 4 }, (_, k) => [at(paint(cyl(0.035, 0.04, 1.4, 8), k % 2 ? "#8CC24A" : "#A8D25A"), (k - 1.5) * 0.12, 0.7, (k % 2) * 0.08), ...[0.3, 0.6, 0.9, 1.2].map((y) => at(paint(cyl(0.045, 0.045, 0.02, 8), "#6E9A30"), (k - 1.5) * 0.12, y, (k % 2) * 0.08)), at(rot(leafGeo(0.28, 0.08, l1), -0.6, k, 0), (k - 1.5) * 0.12, 1.3, 0)]).flat());
    case "banana": return merge([at(paint(cyl(0.05, 0.07, 0.8, 8), "#8AA04A"), 0, 0.4, 0), ...Array.from({ length: 6 }, (_, i) => { const l = leafGeo(0.75, 0.32, i % 2 ? l1 : l2); l.rotateX(-1.0); l.rotateY((i / 6) * Math.PI * 2); l.translate(0, 0.8, 0); return l; }), at(paint(sph(0.07, 8, 6), accent).scale(1, 2, 1) as G, 0.08, 0.7, 0.05)]);
    case "palm": { const parts: G[] = []; for (let i = 0; i < 10; i++) parts.push(at(paint(cyl(0.045, 0.05, 0.12, 7), trunk), Math.sin(i * 0.15) * 0.12, i * 0.11, 0)); for (let i = 0; i < 8; i++) { const l = leafGeo(0.7, 0.18, i % 2 ? l1 : l2); l.rotateX(-0.6); l.rotateY((i / 8) * Math.PI * 2); l.translate(0.17, 1.1, 0); parts.push(l); } parts.push(at(paint(sph(0.06, 8, 6), "#7A5230"), 0.2, 1.05, 0.06)); return merge(parts); }
    case "teabush": return merge(blobs(7, 0.3, 0.25, [l1, l2], 1.6));
    case "hedge": return merge([...blobs(7, 0.26, 0.3, [l1, l2, l3], 2.0), ...Array.from({ length: 4 }, (_, i) => at(flowerGeo(accent, "#FFF2A0", 0.08), (i - 1.5) * 0.28, 0.48, 0.2))]);
    case "rose": return merge([...blobs(5, 0.28, 0.3, [l2, l3], 1.3), ...Array.from({ length: 7 }, (_, i) => at(paint(sph(0.07, 8, 6), accent), Math.cos(i * 2.1) * 0.32, 0.38 + (i % 2) * 0.15, Math.sin(i * 2.1) * 0.2 + 0.18))]);
    case "mushroom": return merge([at(paint(cyl(0.07, 0.09, 0.5, 8), "#F2E8D2"), 0, 0.25, 0), at(paint(sph(0.32, 14, 8, ), accent).scale(1, 0.55, 1) as G, 0, 0.52, 0), ...Array.from({ length: 6 }, (_, i) => at(paint(sph(0.05, 6, 6), "#FFFFFF"), Math.cos(i) * 0.2, 0.66, Math.sin(i) * 0.2))]);
    case "sunflower": return merge([at(paint(cyl(0.025, 0.03, 1.2, 6), "#5A9A2A"), 0, 0.6, 0), at(paint(sph(0.1, 10, 8), "#6A4A1A").scale(1, 1, 0.4) as G, 0, 1.22, 0.05), ...Array.from({ length: 14 }, (_, i) => { const p = paint(sph(0.07, 6, 4), accent); p.scale(0.5, 1.3, 0.2); p.translate(0, 0.16, 0); p.rotateZ((i / 14) * Math.PI * 2); p.translate(0, 1.22, 0.05); return p; }), at(rot(leafGeo(0.3, 0.16, l1), -0.5, 1, 0), 0, 0.6, 0)]);
    case "ruin": return merge([at(paint(cyl(0.16, 0.18, 1.2, 8), "#A8A898", 0.1), 0, 0.6, 0), at(paint(new THREE.BoxGeometry(0.5, 0.12, 0.5), "#B8B8A8"), 0, 1.25, 0), ...blobs(4, 0.12, 0.9, [l1, "#7ACB4A"], 1.2)]);
    case "waterfall": return merge([at(paint(new THREE.BoxGeometry(0.7, 2, 0.05), "#CFF2FF"), 0, 1, 0), at(paint(new THREE.IcosahedronGeometry(0.35, 1), "#8A8A7A", 0.1), -0.45, 0.2, 0), at(paint(new THREE.IcosahedronGeometry(0.3, 1), "#9A9A8A", 0.1), 0.45, 0.25, 0), ...blobs(3, 0.2, 2.0, [l1, l2], 1.6)]);
    case "roots": return merge(Array.from({ length: 6 }, (_, i) => at(paint(cyl(0.02, 0.025, 1.6, 5), trunk), (i - 2.5) * 0.12, 0.8, Math.sin(i) * 0.08)).concat(blobs(4, 0.3, 1.65, [l1, l2], 1.4)));
    case "gourd": return merge([...[-0.4, 0, 0.4].map((x) => at(paint(cyl(0.02, 0.02, 1.2, 5), "#9A7A4A"), x, 0.6, 0)), at(paint(cyl(0.015, 0.015, 0.9, 5), "#9A7A4A").rotateZ(Math.PI / 2) as G, 0, 1.0, 0), ...blobs(5, 0.16, 0.9, [l1, l2], 2.2), ...[-0.25, 0.2].map((x) => at(paint(sph(0.1, 10, 8), accent).scale(0.8, 1.3, 0.8) as G, x, 0.62, 0.05))]);
    case "orchid": return merge([...blobs(3, 0.2, 0.25, [l1, l2], 1.2), ...Array.from({ length: 5 }, (_, i) => at(flowerGeo(accent, "#FFF0F8", 0.12), Math.cos(i * 1.3) * 0.25, 0.5 + i * 0.08, 0.15))]);
    case "mangrove": return merge([...Array.from({ length: 6 }, (_, i) => at(rot(paint(cyl(0.025, 0.03, 0.6, 5), trunk), 0, 0, (i - 2.5) * 0.25), (i - 2.5) * 0.12, 0.25, 0)), at(paint(cyl(0.06, 0.08, 0.6, 7), trunk), 0, 0.75, 0), ...blobs(5, 0.3, 1.15, [l1, l2])]);
    case "pine": return merge([at(paint(cyl(0.05, 0.07, 0.5, 7), trunk), 0, 0.25, 0), ...[0, 1, 2, 3].map((k) => at(paint(cone(0.42 - k * 0.09, 0.42, 9), k % 2 ? l2 : l3), 0, 0.5 + k * 0.25, 0))]);
    case "pepper": return merge([at(paint(cyl(0.04, 0.05, 1.5, 7), "#8A6A40"), 0, 0.75, 0), ...blobs(7, 0.13, 0.7, [l1, l2], 0.8).map((g, i) => at(g, 0, i * 0.12 - 0.3, 0)), ...Array.from({ length: 5 }, (_, i) => at(paint(sph(0.03, 6, 5), accent), Math.cos(i * 2) * 0.12, 0.5 + i * 0.18, Math.sin(i * 2) * 0.12))]);
    case "blossom": return merge([at(paint(cyl(0.06, 0.1, 1, 8), trunk), 0, 0.5, 0), ...blobs(6, 0.36, 1.05, [accent, "#FFD0E2", l2])]);
    case "temple": return merge([at(paint(new THREE.BoxGeometry(1, 0.3, 0.6), "#9AA890"), 0, 0.15, 0), at(paint(new THREE.BoxGeometry(0.75, 0.3, 0.45), "#A8B49A"), 0, 0.45, 0), at(paint(new THREE.BoxGeometry(0.5, 0.3, 0.32), "#B8C2A8"), 0, 0.75, 0), at(paint(cone(0.3, 0.3, 4), accent), 0, 1.05, 0), ...blobs(3, 0.14, 0.35, [l1], 3)]);
    case "glow": return merge([...Array.from({ length: 5 }, (_, i) => at(paint(cyl(0.02, 0.03, 0.8 + i * 0.1, 5), l2), (i - 2) * 0.15, 0.4, 0)), ...Array.from({ length: 5 }, (_, i) => at(paint(sph(0.08, 8, 6), accent), (i - 2) * 0.15, 0.85 + i * 0.05, 0))]);
    case "bramble": return merge([...blobs(5, 0.3, 0.3, [l2, l3], 1.4), ...Array.from({ length: 10 }, (_, i) => at(rot(paint(cone(0.03, 0.18, 4), "#8A3A2A"), i, i * 2, 0), Math.cos(i * 1.7) * 0.4, 0.3 + Math.sin(i) * 0.2, Math.sin(i * 1.7) * 0.3))]);
    case "cloud": return merge(blobs(6, 0.4, 0.4, ["#FFFFFF", "#F2F8FF"], 1.6));
    case "island": return merge([at(paint(cone(0.6, 0.8, 7), "#8A7A5A", 0.1).rotateX(Math.PI) as G, 0, 0.4, 0), at(paint(cyl(0.6, 0.6, 0.12, 9), l1), 0, 0.82, 0), ...blobs(3, 0.22, 1.1, [l1, l2]), at(paint(cyl(0.03, 0.05, 0.4, 6), trunk), 0.2, 1.0, 0)]);
    case "giant": return merge([at(paint(cyl(0.35, 0.45, 3, 12), trunk, 0.06), 0, 1.5, 0), ...Array.from({ length: 5 }, (_, i) => at(paint(cyl(0.03, 0.04, 2.2, 5), trunk), Math.cos(i * 1.3) * 0.5, 1.8, Math.sin(i * 1.3) * 0.3)), ...blobs(5, 0.7, 3.1, [l1, l2, l3], 1.4)]);
    case "lotus": return merge([at(paint(cyl(0.38, 0.38, 0.02, 14), l1), 0, 0, 0), at(flowerGeo(accent, "#FFE14A", 0.22).rotateX(-Math.PI / 2) as G, 0.1, 0.12, 0), at(paint(cyl(0.012, 0.012, 0.4, 4), "#5A9A3A"), -0.25, 0.2, 0.1)]);
    default: return merge(blobs(5, 0.35, 0.6, [l1, l2]));
  }
}
