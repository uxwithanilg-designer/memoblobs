// Procedural 3D car models. A side profile is LOFTED into a smooth body (bulging sides, tuck-under, crowned bonnet,
// flared arches), topped with a real glasshouse (pillars, framed windows, dark interior behind tinted glass) and
// finished with projected trim: lamp clusters with chrome bezels & LED signatures, grilles, intakes, plates, shut
// lines, handles, mirrors, diffusers, exhausts, spoilers, liveries and class extras. Special builders cover open
// wheelers, karts, buggies and tractors. Everything static is merged into ~7 material buckets and the wheels are
// instanced, so a car costs ~9 draw calls. Geometry is cached per car type and shared between instances.
import { buildBikeModel, isBike } from "./bike";
import * as THREE from "three";
import type { CarModel, CarSpec } from "../types";
import { Body, type Arch, type Pt } from "./body";
import { Kit, K, MAT, BUCKETS, box, cyl, paintMat, accentMat, contrast, type Bucket, shared } from "./kit";
import { front, rear, sides, mirrors, topDetails, spoiler, exhausts, liveries, extras, refs, decal, rect, fSide, type Ref } from "./details";
import { wheelGeos, type WheelDef } from "./wheels";
import { buildSpecial } from "./special";
import type { CarShape } from "./shape";

export type { Pt } from "./body";
export type { CarShape } from "./shape";
export { paintMat } from "./kit";

/** legacy material accessors (kept for compatibility) */
export const MATS = {
  glass: () => MAT.glass(),
  black: () => shared("legacy-black", () => new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.55, metalness: 0.2 })),
  chrome: () => shared("legacy-chrome", () => new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.12, metalness: 1, envMapIntensity: 1.4 })),
  tire: () => MAT.tyre(),
  rim: () => shared("legacy-rim", () => new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.22, metalness: 0.95, envMapIntensity: 1.3 })),
  darkrim: () => shared("legacy-darkrim", () => new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.8 })),
  head: () => shared("legacy-head", () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 1.6, roughness: 0.2 })),
  plate: () => shared("legacy-plate", () => new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.5 })),
};

/** height of the body silhouette at x (m from centre) — top surface (legacy helper) */
export function roofAt(sh: CarShape, xm: number) {
  const xn = xm / (sh.len / 2);
  let top = 0;
  const pr = sh.profile;
  for (let i = 0; i < pr.length; i++) {
    const [ax, ay] = pr[i], [bx, by] = pr[(i + 1) % pr.length];
    if ((ax - xn) * (bx - xn) <= 0 && ax !== bx) { const u = (xn - ax) / (bx - ax); top = Math.max(top, ay + (by - ay) * u); }
  }
  return top * sh.hgt + (sh.lift ?? 0);
}

// ---------------------------------------------------------------- built (cached) car type
export interface WheelPlacement { x: number; y: number; z: number; def: WheelDef; steer: boolean; master: number; camber: number; /** hidden inner dual wheel: tyre only */ inner?: boolean }
export interface Built {
  geos: Map<Bucket, THREE.BufferGeometry>;
  wheels: WheelPlacement[];
  wheelRadius: number;
  flames: THREE.BufferGeometry | null;
  beams: THREE.BufferGeometry | null;
  cams: { hood: THREE.Vector3; bumper: THREE.Vector3 };
  dims: { length: number; width: number; height: number };
  exhausts: THREE.Vector3[];
  exDir: THREE.Vector3;
  /** this type has flashing lamps (police / beacon) */
  flash: boolean;
  refs: number;
  tris: number;
}

const _cache = new Map<string, Built>();
const _idle: string[] = [];
function keyOf(spec: CarSpec) { return spec.id + "|" + JSON.stringify(spec.model); }
function acquire(spec: CarSpec) {
  const k = keyOf(spec);
  let b = _cache.get(k);
  if (!b) { b = construct(spec); _cache.set(k, b); }
  b.refs++;
  const i = _idle.indexOf(k); if (i >= 0) _idle.splice(i, 1);
  return { b, k };
}
function release(k: string) {
  const b = _cache.get(k); if (!b) return;
  b.refs--;
  if (b.refs > 0) return;
  _idle.push(k);
  while (_idle.length > 6) {
    const old = _idle.shift()!, e = _cache.get(old);
    if (e && e.refs <= 0) { e.geos.forEach((g) => g.dispose()); e.flames?.dispose(); e.beams?.dispose(); _cache.delete(old); }
  }
}

export interface Common { kit: Kit; exhausts: { p: THREE.Vector3; d: THREE.Vector3 }[]; lamps: THREE.Vector3[]; flash: boolean }

/** shared tail: wheel placements, arch liners & calipers, flames, beams */
export function finish(spec: CarSpec, sh: CarShape, c: Common, wheels: WheelPlacement[], cams: Built["cams"], dims: Built["dims"], wheelRadius: number, liners = true): Built {
  const kit = c.kit;
  const calC = sh.caliper ?? (spec.tier >= 3 ? "#d8262b" : spec.tier === 2 ? "#3b3f46" : "#5a5e66");
  for (const p of wheels) {
    const sg = Math.sign(p.x) || 1, R = p.def.r, rr = R * (p.def.rimFrac ?? 0.64), w = p.def.w;
    if (liners && !p.inner) kit.geo("trim", cyl(R * 1.1, 0.03, "x", p.x - sg * (w / 2 + 0.05), p.y, p.z, 10), 0x0b0c0e);
    if (!p.inner && p.def.tyre !== "kart" && rr > 0.15 && p.def.rim !== "steel" && p.def.rim !== "truck" && p.def.rim !== "tractor") {
      const th = 0.55, rad = rr * 0.6;
      kit.geo("trim", box(0.07, 0.07, rr * 0.55, p.x - sg * w * 0.08, p.y + Math.cos(th) * rad, p.z - Math.sin(th) * rad, -th), calC);
    }
  }
  // nitro flames: two nested cones per exhaust, oriented along the exhaust direction
  let flames: THREE.BufferGeometry | null = null;
  if (c.exhausts.length) {
    const fk = new Kit(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    for (const e of c.exhausts) {
      q.setFromUnitVectors(up, e.d);
      for (const [r, h, colr] of [[0.15, 0.75, 0xff7a1e], [0.085, 1.05, 0x8fd8ff]] as const) {
        const g = new THREE.ConeGeometry(r, h, 10, 1, true);
        g.rotateX(Math.PI); // apex away from the pipe once oriented
        g.applyQuaternion(q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)));
        g.translate(e.p.x + e.d.x * h / 2, e.p.y + e.d.y * h / 2, e.p.z + e.d.z * h / 2);
        fk.geo("head", g, colr);
      }
    }
    flames = fk.build().get("head") ?? null;
  }
  // headlight beams
  let beams: THREE.BufferGeometry | null = null;
  const lamps = c.lamps.length ? c.lamps : [new THREE.Vector3(dims.width * 0.32, 0.6, dims.length / 2), new THREE.Vector3(-dims.width * 0.32, 0.6, dims.length / 2)];
  {
    const bk = new Kit();
    // one beam per side (average of that side's lamps)
    for (const sg of [1, -1]) {
      const ls = lamps.filter((l) => Math.sign(l.x) === sg); if (!ls.length) continue;
      const p = ls.reduce((a, l) => a.add(l), new THREE.Vector3()).divideScalar(ls.length);
      const g = new THREE.ConeGeometry(2.4, 16, 16, 1, true);
      g.rotateX(-Math.PI / 2 - 0.05); g.translate(p.x, p.y - 0.4, p.z + 8);
      bk.geo("head", g, 0xffffff);
    }
    beams = bk.build().get("head") ?? null;
  }
  const geos = kit.build();
  let tris = 0; geos.forEach((g) => (tris += g.attributes.position.count / 3));
  return { geos, wheels, wheelRadius, flames, beams, cams, dims, exhausts: c.exhausts.map((e) => e.p), exDir: c.exhausts[0]?.d.clone() ?? new THREE.Vector3(0, 0, -1), flash: c.flash, refs: 0, tris };
}

function construct(spec: CarSpec): Built {
  const sh = spec.model as unknown as CarShape;
  if (sh.kind && sh.kind !== "car") return buildSpecial(spec, sh);
  return buildRoadCar(spec, sh);
}

function rimColorOf(sh: CarShape, tier: number) {
  if (sh.rimColor) return sh.rimColor;
  const r = sh.rims ?? "spoke5";
  return r === "steel" || r === "offroad" ? "#2c2f35" : r === "truck" ? "#c9ced6" : r === "classic" ? "#e9e4da" : tier >= 4 ? "#2a2d33" : "#c4c9d0";
}

export function buildRoadCar(spec: CarSpec, sh: CarShape): Built {
  const kit = new Kit();
  const H = sh.hgt, lift = sh.lift ?? 0, hl = sh.len / 2;
  const ca = sh.axleShift ?? 0, fz = ca + sh.wheelbase / 2, rz = ca - sh.wheelbase / 2;
  const Rf = sh.wheelR, Rr = sh.rearR ?? sh.wheelR;
  // dual rear wheels are drawn as one extra-wide tyre (same look, half the triangles)
  const rearW = (sh.rearW ?? sh.wheelW) * (sh.dually ? 1.9 : 1);
  const wellX = (w: number) => Math.max(0.15, sh.wid / 2 + (sh.flare ?? 0) - w - 0.12);
  const arches: Arch[] = [{ s: fz, y: Rf, r: Rf * 1.13, x: wellX(sh.wheelW) }, { s: rz, y: Rr, r: Rr * 1.13, x: wellX(rearW) }];
  if (sh.tandem) arches.push({ s: rz - sh.tandem, y: Rr, r: Rr * 1.13, x: wellX(rearW) });
  const g = sh.glass;
  const B = new Body({
    len: sh.len, wid: sh.wid, hgt: H, profile: sh.profile, belt: g ? g.belt : null, rt: g?.rt, ft: g?.ft,
    tumble: sh.tumble, round: sh.round, roundR: sh.roundR, flare: sh.flare, crown: sh.crown, lift, arches, fender: sh.fender,
    clad: sh.clad != null ? sh.clad * H + lift : undefined, rTop: sh.rTop, tuck: sh.tuck, noseW: sh.noseW, shoulder: sh.shoulder,
  });
  B.buildLower(kit);
  if (g) {
    const doors = sh.doors ?? 2;
    B.buildCabin(kit, { rb: g.rb, fb: g.fb, pillars: sh.pillars ?? (doors >= 4 ? [0.5] : [0.66]), dlo: sh.dlo === undefined ? "black" : sh.dlo, roof: sh.roof, pillarsBlack: sh.pillarsBlack });
    B.interior(kit, { seat: sh.seat, rear: doors >= 4, cage: sh.cage });
  }
  const R: Ref = refs(B, sh, arches[0], arches[1]);
  // cargo box / bed
  if (sh.box) cargoBox(kit, B, sh, arches);
  if (sh.bed) bed(kit, B, sh);
  front(kit, B, sh, R);
  rear(kit, B, sh, R);
  sides(kit, B, sh, R);
  if (sh.mirrors !== false) mirrors(kit, B);
  topDetails(kit, B, sh, R);
  liveries(kit, B, sh, R);
  spoiler(kit, B, sh, R);
  const ex = extras(kit, B, sh, R);
  if (new Set(sh.extras ?? []).has("monster")) monsterChassis(kit, B, sh, fz, rz);
  const tips = exhausts(kit, B, sh, R, spec.tier);
  // wheels
  const rimColor = rimColorOf(sh, spec.tier);
  const fDef: WheelDef = { r: Rf, w: sh.wheelW, rim: sh.rims ?? "spoke5", rimColor, tyre: sh.tyre ?? "road", rimFrac: sh.rimFrac };
  const rDef: WheelDef = { ...fDef, r: Rr, w: rearW, rimFrac: sh.rearRimFrac ?? sh.rimFrac };
  const poke = (sh.extras ?? []).includes("monster") ? 0.12 : 0;
  const tx = (s: number, d: WheelDef) => B.sideW(s, Math.min(d.r * 1.9, B.beltY - 0.05)) - d.w / 2 + 0.006 + poke;
  const cam = sh.camber ?? 0;
  const wheels: WheelPlacement[] = [];
  const add = (x: number, z: number, d: WheelDef, steer: boolean, master: number) => wheels.push({ x, y: d.r, z, def: d, steer, master, camber: cam });
  const xf = tx(fz, fDef), xr = tx(rz, rDef);
  add(xf, fz, fDef, true, 0); add(-xf, fz, fDef, true, 1); add(xr, rz, rDef, false, 2); add(-xr, rz, rDef, false, 3);
  if (sh.tandem) { const z2 = rz - sh.tandem; add(xr, z2, rDef, false, 2); add(-xr, z2, rDef, false, 3); }
  // camera mounts: hood cam above the bonnet just ahead of the windscreen, bumper cam on the nose
  const c = B.cab;
  const hoodZ = Math.min(B.xmax - 0.25, c ? c.sF + 0.22 : hl * 0.4);
  const hoodY = Math.max(B.topLower(hoodZ) + B.crownAt(hoodZ), c ? B.beltY : 0) + 0.34;
  const cams = { hood: new THREE.Vector3(0, hoodY, hoodZ), bumper: new THREE.Vector3(0, Math.max(0.42, R.fyb + 0.22), B.xmax + 0.12) };
  const exs = sh.extras ?? [];
  const height = Math.max(B.maxY, ...(c ? [c.top + c.crown] : [])) + (exs.includes("cone") ? 1.65 : exs.some((e) => e === "lightbar" || e === "taxi" || e === "rack" || e === "ladder") ? 0.18 : 0);
  const dims = { length: B.xmax - B.xmin, width: sh.wid + (sh.flare ?? 0) * 2 + poke * 2, height };
  return finish(spec, sh, { kit, exhausts: tips, lamps: R.lamps, flash: !!ex.flashA }, wheels, cams, dims, Rr);
}

/** cargo box behind the cab (box trucks, ice-cream vans, fire trucks) */
function cargoBox(kit: Kit, B: Body, sh: CarShape, arches: Arch[]) {
  const bx = sh.box!, hl = B.hl, z0 = bx.x0 * hl, z1 = bx.x1 * hl, zc = (z0 + z1) / 2, L = z1 - z0;
  const floor = B.topLower(zc) - 0.02, top = bx.top * B.H + B.lift;
  const prof: Pt[] = [[-1, 0], [-1, 0.6], [-1, 0.96], [-0.985, 1], [0, 1], [0.985, 1], [1, 0.96], [1, 0.6], [1, 0]];
  const box2 = new Body({
    len: L, wid: B.W * 1.01, hgt: top - floor, profile: prof, belt: null, lift: floor, round: 0.015, crown: 0.004, tuck: 0.0, shoulder: 0.004, res: 12,
    arches: arches.map((a) => ({ s: a.s - zc, y: a.y, r: a.r })).filter((a) => a.y + a.r > floor), z0: zc, rTop: 0.05, rBot: 0.02,
    skin: bx.color ? "trim" : bx.accent ? "accent" : "paint", skinColor: bx.color ?? 0xffffff,
  });
  box2.buildLower(kit);
  // fire-truck equipment lockers (roll-up doors) along the sides + ladder on top
  const ex = new Set(sh.extras ?? []);
  if (ex.has("compartments")) for (const sg of [1, -1]) {
    const F = fSide(box2, sg), segs: [number, number][] = [];
    let cur = z0 + 0.12;
    for (const a of [...arches].sort((p, q) => p.s - q.s)) {
      if (a.s - a.r > z1) continue;
      if (a.s - a.r - 0.08 > cur) segs.push([cur, a.s - a.r - 0.08]);
      cur = Math.max(cur, a.s + a.r + 0.08);
    }
    if (z1 - 0.12 > cur) segs.push([cur, z1 - 0.12]);
    for (const [a, b] of segs) {
      const n = Math.max(1, Math.round((b - a) / 1.1));
      for (let k = 0; k < n; k++) {
        const s0 = lerp(a, b, k / n) + 0.03, s1 = lerp(a, b, (k + 1) / n) - 0.03, v0 = floor + 0.12, v1 = top - 0.18;
        decal(kit, box2, "trim", 0xc9ced6, F, rect(s0, s1, v0, v1), 2, 3, 0.008, true);
        for (let j = 1; j < 9; j++) { const v = lerp(v0, v1, j / 9); decal(kit, box2, "trim", 0x8a9099, F, rect(s0 + 0.02, s1 - 0.02, v - 0.005, v + 0.005), 2, 1, 0.011); }
        kit.geo("metal", box(0.02, 0.03, 0.12, sg * (box2.sideW((s0 + s1) / 2, v0 + 0.1) + 0.02), v0 + 0.1, (s0 + s1) / 2), K.chrome);
      }
    }
  }
  if (ex.has("ladder")) {
    const y = top + 0.16, za = z0 + 0.25, zb = Math.min(B.xmax - 0.6, (B.cab ? B.cab.ftS : z1) + 0.2);
    kit.geo("trim", cyl(0.35, 0.14, "y", 0, top + 0.07, za + 0.3, 14), 0x2b2d33);
    for (const sg of [1, -1]) kit.geo("metal", box(0.07, 0.1, zb - za, sg * 0.36, y, (za + zb) / 2), K.alu);
    for (let z = za + 0.1; z < zb - 0.05; z += 0.34) kit.geo("metal", box(0.66, 0.035, 0.035, 0, y, z), K.alu);
    for (const z of [za + 0.6, zb - 0.4]) kit.geo("trim", box(0.12, Math.max(0.05, y - top), 0.12, 0, (y + top) / 2 - 0.05, z), 0x2b2d33);
  }
  for (const sg of [1, -1]) kit.geo("metal", box(0.05, top - floor - 0.04, 0.05, sg * (B.W * 0.505 - 0.02), (top + floor) / 2, z0 + 0.02), 0xb9c0c8);
  kit.geo("metal", box(B.W * 0.98, 0.05, 0.05, 0, top - 0.04, z0 + 0.02), 0xb9c0c8);
  kit.geo("metal", box(B.W * 0.98, 0.06, 0.05, 0, floor + 0.04, z0 + 0.01), 0x9aa1aa);
  for (let k = 1; k < 7; k++) kit.geo("trim", box(B.W * 0.9, 0.012, 0.01, 0, lerp(floor + 0.06, top - 0.06, k / 7), z0 - 0.004), 0x9aa1aa);
  // rear lamps on the box
  for (const sg of [1, -1]) { kit.geo("tail", box(0.08, 0.16, 0.03, sg * B.W * 0.42, floor + 0.2, z0 - 0.01)); kit.geo("head", box(0.08, 0.05, 0.03, sg * B.W * 0.42, floor + 0.36, z0 - 0.01), K.amber, 0.9); }
  // marker lamps along the top
  for (let k = 0; k < 3; k++) kit.geo("head", box(0.05, 0.03, 0.02, (k - 1) * 0.25, top - 0.06, z0 - 0.012), K.amber, 0.9);
}

/** open pickup bed: dark liner, rails and tailgate */
function bed(kit: Kit, B: Body, sh: CarShape) {
  const [x0, x1] = sh.bed!, z0 = x0 * B.hl + 0.03, z1 = x1 * B.hl - 0.03, zc = (z0 + z1) / 2;
  const y = B.topLower(zc), hw = B.sideW(zc, y - 0.05) - 0.05;
  kit.geo("trim", box(hw * 2 - 0.08, 0.02, z1 - z0 - 0.06, 0, y + 0.002, zc), 0x17181b);
  for (let k = 1; k < 6; k++) kit.geo("trim", box(0.04, 0.012, z1 - z0 - 0.1, lerp(-hw + 0.1, hw - 0.1, k / 6), y + 0.016, zc), 0x26282c);
  for (const sg of [1, -1]) kit.geo("paint", box(0.07, 0.05, z1 - z0 + 0.04, sg * (hw - 0.01), y + 0.025, zc));
  kit.geo("paint", box(hw * 2, 0.05, 0.07, 0, y + 0.025, z0 - 0.0));
  kit.geo("paint", box(hw * 2, 0.05, 0.07, 0, y + 0.025, z1 + 0.0));
  kit.geo("metal", box(0.2, 0.035, 0.02, 0, y - 0.09, B.xmin - 0.005), 0x16171a);
}

/** monster-truck chassis: ladder frame, axles, shocks and springs under the lifted body */
function monsterChassis(kit: Kit, B: Body, sh: CarShape, fz: number, rz: number) {
  const lift = B.lift, R = sh.wheelR, y = lift + 0.05;
  for (const sg of [1, -1]) kit.geo("trim", box(0.12, 0.16, sh.wheelbase + 1.2, sg * 0.45, y, (fz + rz) / 2), 0x1b1c20);
  for (const z of [fz, rz]) {
    kit.geo("trim", cyl(0.09, B.W + 0.2, "x", 0, R, z, 10), 0x2b2d33);
    kit.geo("metal", cyl(0.22, 0.32, "x", 0, R, z, 14), 0x9aa1aa);
    for (const sg of [1, -1]) for (const dz of [-0.28, 0.28]) {
      const a = new THREE.Vector3(sg * 0.55, R + 0.05, z + dz), b2 = new THREE.Vector3(sg * 0.42, y + 0.05, z + dz * 0.6);
      kit.geo("metal", cyl(0.07, a.distanceTo(b2), "y", (a.x + b2.x) / 2, (a.y + b2.y) / 2, (a.z + b2.z) / 2, 10), 0xd0d4da);
      kit.geo("trim", cyl(0.09, a.distanceTo(b2) * 0.5, "y", (a.x + b2.x) / 2, (a.y + b2.y) / 2 + 0.05, (a.z + b2.z) / 2, 10), 0xe8322b);
    }
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- the model
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Matrix4(), _s = new THREE.Matrix4(), _flip = new THREE.Matrix4().makeRotationY(Math.PI);

export function buildCarModel(spec: CarSpec, color: string): CarModel {
  if (isBike(spec)) return buildBikeModel(spec, color);
  const { b: built, k: cacheKey } = acquire(spec);
  const sh = spec.model as unknown as CarShape;
  const group = new THREE.Group();
  group.name = spec.id;
  const paint = paintMat(color, sh.finish);
  const accentC = !sh.accent || sh.accent === "auto" ? contrast(color) : sh.accent === "body" ? color : sh.accent;
  const head = new THREE.MeshBasicMaterial({ vertexColors: true });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0606, emissive: 0xff1a12, emissiveIntensity: 0.85, roughness: 0.18, metalness: 0.25 });
  const flashA = new THREE.MeshBasicMaterial({ vertexColors: true }), flashB = new THREE.MeshBasicMaterial({ vertexColors: true });
  const matFor = (b: Bucket): THREE.Material => {
    switch (b) {
      case "paint": return paint;
      case "accent": return accentMat(accentC);
      case "glass": return MAT.glass();
      case "trim": return MAT.trim();
      case "metal": return MAT.metal();
      case "head": return head;
      case "tail": return tailMat;
      case "flashA": return flashA;
      case "flashB": return flashB;
    }
  };
  for (const b of BUCKETS) {
    const g = built.geos.get(b); if (!g) continue;
    const m = new THREE.Mesh(g, matFor(b));
    m.castShadow = b !== "head" && b !== "flashA" && b !== "flashB";
    m.name = b;
    group.add(m);
  }
  // wheels: steer/spin pivots (the contract) + instanced tyres & rims
  const pivots = built.wheels.map((p) => {
    const steer = new THREE.Object3D(); steer.position.set(p.x, p.y, p.z);
    const spin = new THREE.Object3D(); steer.add(spin); group.add(steer);
    return { steer, spin };
  });
  // one InstancedMesh for all tyres and one for all rims; other sizes are scaled from the first wheel's geometry
  const ref = built.wheels[0].def, geos = wheelGeos(ref);
  const tyreIdx = built.wheels.map((_, i) => i), rimIdx = built.wheels.map((p, i) => (p.inner ? -1 : i)).filter((i) => i >= 0);
  const inst: { mesh: THREE.InstancedMesh; idx: number[] }[] = [];
  for (const [g, mat, idx] of [[geos.tyre, MAT.tyre(), tyreIdx], [geos.rim, MAT.rim(), rimIdx]] as const) {
    const mesh = new THREE.InstancedMesh(g, mat, idx.length);
    mesh.castShadow = true; mesh.name = "wheels";
    group.add(mesh); inst.push({ mesh, idx });
  }
  const main = pivots.slice(0, 4);
  const sync = () => {
    for (const { mesh, idx } of inst) {
      idx.forEach((wi, k) => {
        const p = built.wheels[wi], pv = pivots[wi], m = main[p.master] ?? pv;
        const ang = m.spin.rotation.x * (built.wheelRadius / p.def.r);
        pv.steer.rotation.y = p.steer ? m.steer.rotation.y : 0;
        pv.steer.updateMatrix();
        const sg = p.x >= 0 ? 1 : -1;
        _m.copy(pv.steer.matrix);
        if (p.camber) _m.multiply(_c.makeRotationZ(sg * p.camber));
        _m.multiply(_r.makeRotationX(ang));
        if (sg < 0) _m.multiply(_flip);
        if (p.def.r !== ref.r || p.def.w !== ref.w) _m.multiply(_s.makeScale(p.def.w / ref.w, p.def.r / ref.r, p.def.r / ref.r));
        mesh.setMatrixAt(k, _m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  sync();
  for (const { mesh } of inst) { mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.3; }
  let synced = false;
  if (inst.length) inst[0].mesh.onBeforeRender = () => { if (!synced) sync(); synced = false; };
  // nitro flames & night beams
  const flames = built.flames ? new THREE.Mesh(built.flames, MAT.flame()) : null;
  if (flames) { flames.visible = false; flames.renderOrder = 2; group.add(flames); }
  const beams = built.beams ? new THREE.Mesh(built.beams, MAT.beam()) : null;
  if (beams) { beams.visible = false; group.add(beams); }
  const fPiv = built.exhausts.reduce((a, e) => a.add(e), new THREE.Vector3()).divideScalar(Math.max(1, built.exhausts.length));
  const fDir = new THREE.Vector3(Math.abs(built.exDir.x), Math.abs(built.exDir.y), Math.abs(built.exDir.z));
  let lightsOn = false;
  const ordered = [main[0], main[1], main[2], main[3]].map((w) => ({ steer: w.steer, spin: w.spin }));
  return {
    group, wheels: ordered, wheelRadius: built.wheelRadius,
    cams: { hood: built.cams.hood.clone(), bumper: built.cams.bumper.clone() },
    dims: { ...built.dims }, exhausts: built.exhausts.map((e) => e.clone()),
    setBrake(on) { tailMat.emissiveIntensity = on ? 3.2 : lightsOn ? 1.3 : 0.85; },
    setNitro(on, t) {
      sync(); synced = true;
      if (flames) {
        flames.visible = on;
        if (on) {
          // flicker: stretch along the exhaust direction about the pipe tips
          const k = 0.82 + Math.sin(t * 57) * 0.14 + Math.sin(t * 23.3) * 0.1;
          flames.scale.set(1 + (k - 1) * fDir.x, 1 + (k - 1) * fDir.y, 1 + (k - 1) * fDir.z);
          flames.position.set(fPiv.x * (1 - flames.scale.x), fPiv.y * (1 - flames.scale.y), fPiv.z * (1 - flames.scale.z));
        }
      }
      if (built.flash) {
        const a = Math.sin(t * 13) > 0, b2 = Math.sin(t * 13 + Math.PI * 0.5) > 0.3;
        flashA.color.setScalar(a ? 2.2 : 0.25); flashB.color.setScalar(b2 ? 2.2 : 0.25);
      }
    },
    setLights(on) { lightsOn = on; if (beams) beams.visible = on; head.color.setScalar(on ? 1.5 : 1); tailMat.emissiveIntensity = on ? 1.3 : 0.85; },
    dispose() {
      paint.dispose(); head.dispose(); tailMat.dispose(); flashA.dispose(); flashB.dispose();
      for (const { mesh } of inst) mesh.dispose();
      release(cacheKey);
    },
  };
}
