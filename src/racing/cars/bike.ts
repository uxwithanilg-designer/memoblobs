// Procedural motorcycles + riders (Moto Rush GP). A bike is built from a side silhouette per style (sport fairing,
// naked, supermoto, scooter, cruiser, café racer, electric, chopper) extruded across the bike and pinched at the
// nose and tail, plus fork, swingarm, engine, exhausts, lights and a rider (tucked racer or upright) — every
// part merged per material so a bike + rider is ~12 draw calls. It returns the same CarModel contract as the car
// builder, plus `pose(wheelie, hang)`: the chassis pitches about the rear contact patch for wheelies and the rider
// hangs off into the corner. +Z is forward, +X is the bike's LEFT, the origin is on the ground under the middle.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CarModel, CarSpec } from "../types";
import { paintMat } from "./kit";

export type BikeStyle = "sport" | "naked" | "supermoto" | "scooter" | "cruiser" | "cafe" | "electric" | "chopper";
export interface BikeShape {
  kind: "bike";
  style: BikeStyle;
  /** wheelbase (m) and wheel radii / tyre widths */
  wb: number; wheelR: number; rearW: number; frontW: number;
  rim?: "spoke" | "alloy" | "disc";
  rimColor?: string;
  /** second paint colour (stripes, tail, tank panels) */
  accent?: string;
  livery?: "stripe" | "split" | "none";
  suit: [string, string];
  helmet: [string, string];
  exhaust?: "under" | "side" | "high" | "twin";
  /** fork / frame metal colour */
  metal?: string;
}

type Bucket = "paint" | "accent" | "dark" | "metal" | "glass" | "head" | "tail" | "suit" | "suit2" | "helmet" | "visor" | "skin";
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

class Parts {
  b = new Map<Bucket, THREE.BufferGeometry[]>();
  add(k: Bucket, g: THREE.BufferGeometry) {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const a of Object.keys(ng.attributes)) if (a !== "position" && a !== "normal") ng.deleteAttribute(a);
    let l = this.b.get(k); if (!l) this.b.set(k, (l = [])); l.push(ng);
  }
  box(k: Bucket, sx: number, sy: number, sz: number, p: THREE.Vector3, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(p.x, p.y, p.z); this.add(k, g);
  }
  /** a rounded rod from a to b */
  rod(k: Bucket, a: THREE.Vector3, b: THREE.Vector3, r: number, cap = true) {
    const len = a.distanceTo(b);
    const g = cap ? new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, 8) : new THREE.CylinderGeometry(r, r, len, 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); this.add(k, g);
  }
  ball(k: Bucket, r: number, p: THREE.Vector3, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz); g.translate(p.x, p.y, p.z); this.add(k, g);
  }
  /** side silhouette (z, y) extruded across the bike, pinched by width(z, y) */
  body(k: Bucket, pts: [number, number][], width: number, pinch: (z: number, y: number) => number) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); sh.splineThru(pts.slice(1).map(([z, y]) => new THREE.Vector2(z, y))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 18 });
    g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), y = pos.getY(i); pos.setX(i, pos.getX(i) * pinch(z, y)); }
    g.computeVertexNormals(); this.add(k, g);
  }
  merged() {
    const out = new Map<Bucket, THREE.BufferGeometry>();
    for (const [k, l] of this.b) { const g = mergeGeometries(l, false); if (g) { g.computeBoundingSphere(); out.set(k, g); } l.forEach((x) => x.dispose()); }
    return out;
  }
}

/** silhouettes, front axle at z = +wb/2, rear at -wb/2 (values scaled from a 1.4 m wheelbase) */
function profile(st: BikeStyle): [number, number][] {
  switch (st) {
    case "sport": case "electric": return [[-0.97, 1.0], [-0.84, 1.0], [-0.56, 0.89], [-0.24, 0.86], [-0.1, 0.92], [0.12, 0.98], [0.3, 0.95], [0.56, 0.93], [0.78, 0.82], [0.88, 0.7], [0.74, 0.55], [0.52, 0.43], [0.12, 0.38], [-0.18, 0.44], [-0.5, 0.76], [-0.86, 0.92]];
    case "naked": return [[-0.9, 0.86], [-0.78, 0.94], [-0.5, 0.86], [-0.2, 0.84], [0.1, 1.0], [0.36, 0.98], [0.42, 0.86], [0.2, 0.72], [-0.2, 0.7], [-0.6, 0.74]];
    case "cafe": return [[-0.88, 0.88], [-0.74, 1.0], [-0.55, 0.88], [-0.2, 0.84], [0.1, 0.98], [0.36, 0.95], [0.42, 0.84], [0.15, 0.74], [-0.3, 0.72], [-0.7, 0.76]];
    case "supermoto": return [[-0.95, 0.98], [-0.6, 1.02], [-0.1, 0.98], [0.2, 1.04], [0.45, 1.0], [0.4, 0.86], [0.1, 0.8], [-0.4, 0.82], [-0.85, 0.9]];
    case "scooter": return [[-0.82, 0.62], [-0.72, 0.88], [-0.4, 0.86], [-0.15, 0.78], [-0.1, 0.42], [0.32, 0.42], [0.42, 0.62], [0.48, 1.05], [0.6, 1.08], [0.66, 0.9], [0.62, 0.42], [0.45, 0.28], [-0.2, 0.28], [-0.62, 0.36]];
    case "cruiser": case "chopper": return [[-0.95, 0.66], [-0.8, 0.74], [-0.45, 0.66], [-0.15, 0.7], [0.12, 0.86], [0.42, 0.84], [0.5, 0.74], [0.2, 0.62], [-0.2, 0.58], [-0.6, 0.6]];
  }
}
const pinchFor = (st: BikeStyle) => (z: number, y: number) => {
  if (st === "scooter") return z > 0.4 ? 0.9 : z < -0.6 ? 0.7 : 1;
  const tail = z < -0.45 ? Math.max(0.36, 1 - (-0.45 - z) * 1.5) : 1;
  const sporty = st === "sport" || st === "electric";
  const nose = sporty && z > 0.55 ? Math.max(0.45, 1 - (z - 0.55) * 1.8) : 1;
  const low = sporty && y < 0.62 ? 0.72 + Math.max(0, y - 0.4) * 0.9 : 1;
  const tank = y > 0.92 && z > -0.1 ? 1.08 : 1;
  return tail * nose * low * tank;
};

const _cache = new Map<string, Built>();
type Built = ReturnType<typeof construct>;

function construct(sh: BikeShape) {
  const P = new Parts(), R = new Parts();
  const k = sh.wb / 1.4, r = sh.wheelR, fz = sh.wb / 2, rz = -sh.wb / 2, st = sh.style;
  const sc = (z: number, y: number): [number, number] => [z * k, y * (0.92 + r * 0.25)];
  const widthBody = st === "scooter" ? 0.42 : st === "cruiser" || st === "chopper" ? 0.4 : st === "supermoto" ? 0.26 : st === "sport" || st === "electric" ? 0.3 : 0.34;
  P.body("paint", profile(st).map(([z, y]) => sc(z, y)), widthBody, pinchFor(st));
  // seat
  const seatY = st === "cruiser" || st === "chopper" ? 0.68 : st === "scooter" ? 0.9 : st === "supermoto" ? 1.04 : 0.9;
  P.box("dark", widthBody * 0.85, 0.07, st === "scooter" ? 0.52 : 0.42, V(0, seatY, (st === "scooter" ? -0.42 : st === "supermoto" ? -0.2 : -0.42) * k));
  // livery
  // livery: a racing stripe along the fairing side, or a tank stripe on the others (not on cruisers / scooters)
  if (sh.livery === "stripe" && (st === "sport" || st === "electric")) P.box("accent", widthBody + 0.08, 0.05, 0.7 * k, V(0, 0.64, 0.25 * k), -0.12);
  else if (sh.livery === "stripe" && st !== "scooter" && st !== "cruiser" && st !== "chopper") P.box("accent", 0.08, 0.02, 0.42 * k, V(0, 1.0 * (0.92 + r * 0.25) + 0.04, 0.14 * k));
  else if (sh.livery === "stripe" && (st === "cruiser" || st === "chopper")) P.ball("accent", 0.12, V(0, 0.83, 0.28 * k), 1.25, 0.6, 1.8);
  if (sh.livery === "split") P.body("accent", profile(st).map(([z, y]) => sc(z, y)).filter(([z]) => z < -0.45 * k).concat([[-0.45 * k, 0.86], [-0.45 * k, 0.7]]), widthBody + 0.012, () => 1.01);
  // forks, yoke, bars
  const metal: Bucket = "metal";
  const fork = st === "chopper" ? 0.95 : st === "cruiser" ? 0.5 : 0.36;
  const yoke = V(0, st === "scooter" ? 1.0 : st === "cruiser" || st === "chopper" ? 0.96 : 0.98, fz - fork * 0.8);
  for (const sx of [-0.09, 0.09]) P.rod(metal, V(sx, r, fz), V(sx, yoke.y, yoke.z), 0.028, false);
  if (st !== "scooter") {
    const barY = st === "sport" || st === "electric" || st === "cafe" ? yoke.y - 0.02 : st === "chopper" ? yoke.y + 0.32 : yoke.y + 0.12;
    const barW = st === "cruiser" || st === "chopper" ? 0.38 : st === "supermoto" ? 0.36 : st === "naked" ? 0.33 : 0.27;
    P.rod("dark", V(-barW, barY, yoke.z - 0.06), V(barW, barY, yoke.z - 0.06), 0.018);
  }
  // front fender
  if (st !== "sport" && st !== "electric") P.box("paint", 0.14, 0.03, 0.42 * k, V(0, r * 2 + (st === "supermoto" ? 0.12 : 0.04), fz), -0.15);
  else P.box("paint", 0.14, 0.02, 0.36, V(0, r * 2 + 0.03, fz + 0.02), -0.12);
  // swingarm, engine, frame
  const pivot = V(0, 0.46, -0.12 * k);
  for (const sx of [-0.1, 0.1]) P.rod(metal, V(sx, pivot.y, pivot.z), V(sx, r, rz), 0.03, false);
  if (st !== "scooter") {
    P.box("dark", 0.28, 0.3, 0.34 * k, V(0, 0.44, 0.08 * k));
    if (st !== "sport" && st !== "electric") {
      for (const sx of [-0.12, 0.12]) P.rod(metal, V(sx, 0.95, 0.38 * k), V(sx, 0.5, -0.12 * k), 0.025);
      P.ball("metal", 0.07, V(0.16, 0.42, 0.08 * k), 1, 1, 1.4);
    }
  }
  // exhaust
  const ex = sh.exhaust ?? (st === "sport" || st === "electric" ? "under" : st === "supermoto" ? "high" : st === "cruiser" || st === "chopper" ? "twin" : "side");
  const tips: THREE.Vector3[] = [];
  if (st === "electric") { /* silent */ }
  else if (ex === "under") { P.box("metal", 0.16, 0.12, 0.4, V(0, 0.28, -0.1 * k)); tips.push(V(0, 0.28, -0.3 * k)); }
  else if (ex === "high") { P.rod("metal", V(-0.16, 0.5, 0.0), V(-0.15, 0.9, -0.6 * k), 0.05); tips.push(V(-0.15, 0.9, -0.62 * k)); }
  else if (ex === "twin") { for (const y of [0.32, 0.46]) { P.rod("metal", V(-0.17, y, 0.2 * k), V(-0.2, y - 0.02, -0.85 * k), 0.035); tips.push(V(-0.2, y - 0.02, -0.86 * k)); } }
  else { P.rod("metal", V(-0.16, 0.36, 0.05 * k), V(-0.2, 0.55, -0.62 * k), 0.055); tips.push(V(-0.2, 0.56, -0.64 * k)); }
  // lights
  const nose = st === "sport" || st === "electric" ? V(0, 0.8, 0.86 * k) : st === "scooter" ? V(0, 0.98, 0.64 * k) : V(0, yoke.y - 0.06, yoke.z + 0.12);
  if (st === "sport" || st === "electric") { for (const sx of [-0.06, 0.06]) P.box("head", 0.07, 0.03, 0.02, V(sx, nose.y, nose.z)); }
  else P.ball("head", 0.08, nose, 1, 1, 0.5);
  P.box("tail", 0.12, 0.035, 0.02, V(0, (st === "cruiser" || st === "chopper" ? 0.68 : st === "scooter" ? 0.8 : 0.9), (st === "scooter" ? -0.82 : -0.92) * k));
  if (st === "sport" || st === "electric" || st === "cafe") P.box("glass", 0.26, 0.16, 0.02, V(0, 1.1, 0.52 * k), -0.9);
  if (st === "scooter") P.box("glass", 0.36, 0.26, 0.02, V(0, 1.2, 0.56 * k), -0.35);
  // ------------------------------------------------------------- rider
  const tuck = st === "sport" || st === "electric" || st === "cafe";
  const hip = V(0, seatY + 0.1, (st === "scooter" ? -0.42 : st === "supermoto" ? -0.18 : -0.4) * k);
  const shoulder = tuck ? V(0, hip.y + 0.26, hip.z + 0.42) : st === "cruiser" || st === "chopper" ? V(0, hip.y + 0.48, hip.z + 0.02) : V(0, hip.y + 0.46, hip.z + 0.18);
  const head = tuck ? V(0, shoulder.y + 0.13, shoulder.z + 0.12) : V(0, shoulder.y + 0.2, shoulder.z + 0.04);
  R.rod("suit", hip, shoulder, 0.15);
  R.rod("suit2", hip.clone().add(V(0, 0.05, 0.02)), shoulder.clone().add(V(0, -0.02, -0.02)), 0.155, false);
  R.ball("suit", 0.17, shoulder.clone().lerp(hip, 0.3), 1.15, 0.9, 1);
  R.ball("helmet", 0.135, head, 1, 1, 1.1);
  R.ball("visor", 0.1, head.clone().add(V(0, 0.0, 0.07)), 1.15, 0.6, 0.8);
  const bars = V(0, st === "chopper" ? yoke.y + 0.32 : st === "cruiser" ? yoke.y + 0.12 : st === "scooter" ? 1.02 : yoke.y + (tuck ? -0.02 : 0.1), yoke.z - 0.06);
  for (const sx of [-1, 1]) {
    const sh2 = shoulder.clone().add(V(0.17 * sx, -0.03, 0)), hand = bars.clone().add(V((st === "cruiser" || st === "chopper" ? 0.34 : tuck ? 0.24 : 0.3) * sx, 0, 0));
    const elbow = sh2.clone().lerp(hand, 0.5).add(V(0.06 * sx, tuck ? -0.08 : -0.06, 0));
    R.rod("suit", sh2, elbow, 0.065); R.rod("suit", elbow, hand, 0.058); R.ball("dark", 0.055, hand);
    const hp = hip.clone().add(V(0.12 * sx, 0, 0));
    const knee = st === "scooter" ? hp.clone().add(V(0.06 * sx, -0.02, 0.38)) : st === "cruiser" || st === "chopper" ? hp.clone().add(V(0.12 * sx, -0.02, 0.42)) : hp.clone().add(V(0.12 * sx, -0.1, 0.34));
    const foot = st === "scooter" ? V(0.15 * sx, 0.38, (0.05) * k) : st === "cruiser" || st === "chopper" ? V(0.24 * sx, 0.36, 0.42 * k) : V(0.16 * sx, 0.46, -0.24 * k);
    R.rod("suit", hp, knee, 0.09); R.rod("suit", knee, foot, 0.07); R.box("dark", 0.1, 0.1, 0.22, foot.clone().add(V(0, -0.02, 0.06)));
  }
  const geos = P.merged(), rider = R.merged();
  const height = head.y + 0.16;
  return { geos, rider, tips, nose, hip, head, refs: 0, dims: { length: sh.wb + r * 2 + 0.25, width: st === "cruiser" || st === "chopper" ? 0.95 : 0.78, height } };
}

const keyOf = (s: BikeShape) => JSON.stringify([s.style, s.wb, s.wheelR, s.livery, s.exhaust]);

function wheel(r: number, w: number, rim: BikeShape["rim"]) {
  const tyre = new THREE.TorusGeometry(r - w * 0.42, w * 0.45, 10, 28); tyre.rotateY(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [];
  const hub = new THREE.CylinderGeometry(0.05, 0.05, w * 0.9, 10); hub.rotateZ(Math.PI / 2); parts.push(hub);
  if (rim === "disc") { const d = new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.02, 24); d.rotateZ(Math.PI / 2); parts.push(d); }
  else {
    const n = rim === "spoke" ? 12 : 5;
    for (let i = 0; i < n; i++) {
      const b = new THREE.BoxGeometry(0.02, r * 0.62, rim === "spoke" ? 0.008 : 0.035);
      b.translate(0, r * 0.33, 0); b.rotateX((i / n) * Math.PI * 2); parts.push(b);
    }
    const rr = new THREE.TorusGeometry(r * 0.66, 0.012, 6, 28); rr.rotateY(Math.PI / 2); parts.push(rr);
  }
  const disc = new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.012, 20); disc.rotateZ(Math.PI / 2); disc.translate(w * 0.32, 0, 0); parts.push(disc);
  const rimG = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const a of Object.keys(g.attributes)) if (a !== "position" && a !== "normal") g.deleteAttribute(a); return g; }), false)!;
  return { tyre, rim: rimG };
}

export function buildBikeModel(spec: CarSpec, color: string): CarModel {
  const sh = spec.model as unknown as BikeShape;
  const key = keyOf(sh);
  let built = _cache.get(key);
  if (!built) { built = construct(sh); _cache.set(key, built); }
  built.refs++;
  const B = built;
  const accent = sh.accent ?? "#F4F1E6";
  const mats: Record<Bucket, THREE.Material> = {
    paint: paintMat(color), accent: paintMat(accent),
    dark: new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.6, metalness: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: sh.metal ?? "#B9BEC6", roughness: 0.28, metalness: 0.9, envMapIntensity: 1.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8cc, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff6dc }),
    tail: new THREE.MeshStandardMaterial({ color: 0x7a0606, emissive: 0xff1a12, emissiveIntensity: 0.9 }),
    suit: paintMat(sh.suit[0], "matte"), suit2: paintMat(sh.suit[1], "matte"),
    helmet: paintMat(sh.helmet[0]), visor: new THREE.MeshPhysicalMaterial({ color: sh.helmet[1], roughness: 0.08, metalness: 0.6, clearcoat: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }),
  };
  const group = new THREE.Group(); group.name = spec.id;
  // chassis pivots about the rear contact patch (wheelies); the rider rides in the chassis and can hang off
  const rearZ = -sh.wb / 2;
  const chassis = new THREE.Group(); chassis.position.set(0, 0, rearZ); group.add(chassis);
  const body = new THREE.Group(); body.position.set(0, 0, -rearZ); chassis.add(body);
  for (const [b, g] of built.geos) { const m = new THREE.Mesh(g, mats[b]); m.castShadow = b !== "head" && b !== "glass"; body.add(m); }
  const rider = new THREE.Group(); body.add(rider);
  rider.position.copy(built.hip); const riderIn = new THREE.Group(); riderIn.position.copy(built.hip).multiplyScalar(-1); rider.add(riderIn);
  for (const [b, g] of built.rider) { const m = new THREE.Mesh(g, mats[b]); m.castShadow = true; riderIn.add(m); }
  // wheels
  const mk = (z: number, w: number) => {
    const steer = new THREE.Object3D(); steer.position.set(0, sh.wheelR, z);
    const spin = new THREE.Object3D(); steer.add(spin); body.add(steer);
    const wg = wheel(sh.wheelR, w, sh.rim);
    const t = new THREE.Mesh(wg.tyre, mats.dark), rimM = new THREE.Mesh(wg.rim, new THREE.MeshStandardMaterial({ color: sh.rimColor ?? "#2a2c31", roughness: 0.35, metalness: 0.8 }));
    t.castShadow = true; spin.add(t, rimM);
    return { steer, spin, geos: [wg.tyre, wg.rim], mat: rimM.material as THREE.Material };
  };
  const F = mk(sh.wb / 2, sh.frontW), Rw = mk(-sh.wb / 2, sh.rearW);
  // flames for nitro
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = new THREE.Group();
  for (const tp of built.tips) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 8).rotateX(-Math.PI / 2), flameMat); f.position.copy(tp).add(V(0, 0, -0.22)); flames.add(f); }
  flames.visible = false; body.add(flames);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 3.6), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.copy(built.nose); beam.visible = false; body.add(beam);
  const tailMat = mats.tail as THREE.MeshStandardMaterial;
  let lights = false;
  return {
    group, wheels: [F, F, Rw, Rw].map((w) => ({ steer: w.steer, spin: w.spin })), wheelRadius: sh.wheelR,
    cams: { hood: built.head.clone().add(V(0, 0.08, 0.1)), bumper: V(0, 0.55, sh.wb / 2 + sh.wheelR + 0.1) },
    dims: { ...built.dims }, exhausts: built.tips.map((t) => t.clone().add(V(0, 0, rearZ * 0))),
    setBrake(on) { tailMat.emissiveIntensity = on ? 3.2 : lights ? 1.3 : 0.9; },
    setNitro(on, t) { flames.visible = on; if (on) flames.scale.setScalar(0.8 + Math.sin(t * 50) * 0.15); },
    setLights(on) { lights = on; beam.visible = on; tailMat.emissiveIntensity = on ? 1.3 : 0.9; },
    pose(wheelie: number, hang: number) {
      chassis.rotation.x = -wheelie;
      rider.rotation.z = hang * 0.35; rider.position.x = built.hip.x - hang * 0.16;
    },
    dispose() {
      Object.values(mats).forEach((m) => m.dispose()); F.mat.dispose(); Rw.mat.dispose(); flameMat.dispose();
      for (const w of [F, Rw]) w.geos.forEach((g) => g.dispose());
      flames.children.forEach((f) => (f as THREE.Mesh).geometry.dispose()); (beam.geometry as THREE.BufferGeometry).dispose(); (beam.material as THREE.Material).dispose();
      B.refs--;
      if (B.refs <= 0) { B.geos.forEach((g) => g.dispose()); B.rider.forEach((g) => g.dispose()); _cache.delete(key); }
    },
  };
}

export const isBike = (spec: CarSpec) => (spec.model as { kind?: string }).kind === "bike";
