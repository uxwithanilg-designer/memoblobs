// Special vehicle builders: open-wheel formula racer, go-kart, dune buggy and farm tractor. They reuse the lofted
// Body for their shells (tub, side pods, nose, hood) and add tubes, wings, drivers and exposed mechanicals.
import * as THREE from "three";
import type { CarSpec } from "../types";
import type { CarShape } from "./shape";
import { buildRoadCar, finish, type Built, type WheelPlacement } from "./build";
import { Body, type Pt } from "./body";
import { Kit, K, V, box, cyl, sphere, tube, torus, type Bucket, type Col } from "./kit";
import { decal, ell, rect, pill, fFront, fTop } from "./details";
import type { WheelDef } from "./wheels";

export function buildSpecial(spec: CarSpec, sh: CarShape): Built {
  switch (sh.kind) {
    case "formula": return formula(spec, sh);
    case "kart": return kart(spec, sh);
    case "buggy": return buggy(spec, sh);
    case "tractor": return tractor(spec, sh);
    default: return buildRoadCar(spec, sh);
  }
}

const tubes = (kit: Kit, b: Bucket, c: Col, r: number, pts: THREE.Vector3[], seg = 6) => { for (let i = 0; i < pts.length - 1; i++) kit.geo(b, tube(pts[i], pts[i + 1], r, seg), c); };
const mirrorX = (p: THREE.Vector3) => new THREE.Vector3(-p.x, p.y, p.z);

/** helmeted driver: helmet + visor + shoulders (+ arms reaching to a point) */
function driver(kit: Kit, x: number, y: number, z: number, helmet: Col, suit: Col, hands?: THREE.Vector3) {
  kit.geo("trim", sphere(0.135, x, y, z, 1, 1.05, 1.1, 10, 8), helmet);
  kit.geo("metal", sphere(0.137, x, y + 0.01, z + 0.03, 0.92, 0.42, 1.0, 10, 5), 0x0c0d10);
  kit.geo("trim", box(0.1, 0.03, 0.2, x, y + 0.13, z - 0.02), helmet === 0xf4f1e6 ? 0xe8322b : 0xf4f1e6);
  kit.geo("trim", box(0.4, 0.2, 0.22, x, y - 0.24, z - 0.06), suit);
  if (hands) for (const sg of [1, -1]) {
    const sh = V(x + sg * 0.18, y - 0.2, z - 0.02), hd = V(hands.x + sg * 0.13, hands.y, hands.z);
    kit.geo("trim", tube(sh, hd, 0.045, 6), suit);
    kit.geo("trim", sphere(0.045, hd.x, hd.y, hd.z, 1, 1, 1, 6, 4), 0x1b1c20);
  }
}

/** cylindrical band around the X axis between angles (0 = straight up, + towards the front), both faces */
function arcBand(kit: Kit, b: Bucket, c: Col, r: number, x0: number, x1: number, cy: number, cz: number, a0: number, a1: number, seg = 12, inner: Col = K.black) {
  for (let k = 0; k < seg; k++) {
    const a = a0 + ((a1 - a0) * k) / seg, bb = a0 + ((a1 - a0) * (k + 1)) / seg;
    const P = (x: number, t: number, rr: number) => V(x, cy + Math.cos(t) * rr, cz + Math.sin(t) * rr);
    const n1 = V(0, Math.cos(a), Math.sin(a)), n2 = V(0, Math.cos(bb), Math.sin(bb));
    kit.tri(b, P(x0, a, r), P(x1, bb, r), P(x1, a, r), c, n1, n2, n1);
    kit.tri(b, P(x0, a, r), P(x0, bb, r), P(x1, bb, r), c, n1, n2, n2);
    const m1 = n1.clone().negate(), m2 = n2.clone().negate();
    kit.tri("trim", P(x0, a, r - 0.01), P(x1, a, r - 0.01), P(x1, bb, r - 0.01), inner, m1, m1, m2);
    kit.tri("trim", P(x0, a, r - 0.01), P(x1, bb, r - 0.01), P(x0, bb, r - 0.01), inner, m1, m2, m2);
  }
}

function wheelsOf(defF: WheelDef, defR: WheelDef, xf: number, zf: number, xr: number, zr: number): WheelPlacement[] {
  return [
    { x: xf, y: defF.r, z: zf, def: defF, steer: true, master: 0, camber: 0 },
    { x: -xf, y: defF.r, z: zf, def: defF, steer: true, master: 1, camber: 0 },
    { x: xr, y: defR.r, z: zr, def: defR, steer: false, master: 2, camber: 0 },
    { x: -xr, y: defR.r, z: zr, def: defR, steer: false, master: 3, camber: 0 },
  ];
}

// ---------------------------------------------------------------- formula racer
function formula(spec: CarSpec, sh: CarShape): Built {
  const kit = new Kit(), L = sh.len, hl = L / 2, H = sh.hgt;
  const helmet = sh.seat ?? "#ffd23a";
  const tubProf: Pt[] = [[-1, 0.14], [-1, 0.33], [-0.84, 0.4], [-0.58, 0.46], [-0.4, 0.56], [-0.27, 0.86], [-0.15, 0.9], [-0.08, 0.6], [0.08, 0.54], [0.3, 0.48], [0.55, 0.38], [0.78, 0.27], [0.95, 0.19], [0.97, 0.12]];
  const tub = new Body({ len: L * 0.97, wid: 0.78, hgt: H, profile: tubProf, belt: null, arches: [], round: 0.12, roundR: 0.3, noseW: 0.36, crown: 0.06, tuck: 0.12, shoulder: 0.1, rTop: 0.12, rBot: 0.03, res: 30, z0: -L * 0.015 });
  tub.buildLower(kit, K.carbon);
  const T = fTop(tub);
  // cockpit opening + headrest
  decal(kit, tub, "trim", 0x0c0d10, T, ell(0.05 * hl, 0, 0.36, 0.2), 8, 2, 0.012, true);
  const podProf: Pt[] = [[-1, 0.2], [-1, 0.42], [-0.5, 0.62], [0.2, 0.92], [0.82, 0.95], [1, 0.86], [1, 0.32], [0.94, 0.2]];
  for (const sg of [1, -1]) {
    const pod = new Body({ len: L * 0.4, wid: 0.42, hgt: 0.56, profile: podProf, belt: null, arches: [], round: 0.25, roundR: 0.45, crown: 0.05, tuck: 0.05, rTop: 0.1, res: 12, x0: sg * 0.5, z0: -L * 0.06 });
    pod.buildLower(kit, K.carbon);
    const F = fFront(pod);
    decal(kit, pod, "trim", 0x050506, F, pill(sg * 0.5 - 0.17, sg * 0.5 + 0.17, 0.3, 0.46), 6, 2, 0.006, true);
    // little mirror on the pod
    const mz = pod.xmax + pod.z0 - 0.15;
    kit.geo("trim", box(0.02, 0.12, 0.02, sg * 0.42, 0.62, mz), K.carbon);
    kit.geo("paint", box(0.13, 0.06, 0.05, sg * 0.46, 0.7, mz));
  }
  // floor, front wing, rear wing
  kit.geo("trim", box(1.24, 0.025, L * 0.55, 0, 0.1, -L * 0.07), K.carbon);
  const fwZ = hl - 0.18;
  kit.geo("trim", box(1.86, 0.03, 0.34, 0, 0.11, fwZ, 0.05), K.carbon);
  kit.geo("accent", box(1.7, 0.02, 0.2, 0, 0.17, fwZ - 0.14, -0.38));
  kit.geo("paint", box(1.4, 0.016, 0.14, 0, 0.215, fwZ - 0.24, -0.6));
  for (const sg of [1, -1]) kit.geo("paint", box(0.02, 0.17, 0.46, sg * 0.93, 0.17, fwZ - 0.05));
  const rwZ = -hl + 0.16, rwY = 0.92;
  kit.geo("trim", box(1.0, 0.035, 0.3, 0, rwY, rwZ, -0.08), K.carbon);
  kit.geo("accent", box(1.0, 0.022, 0.16, 0, rwY + 0.09, rwZ - 0.15, -0.55));
  kit.geo("trim", box(0.9, 0.02, 0.16, 0, 0.42, rwZ + 0.02, -0.15), K.carbon);
  for (const sg of [1, -1]) kit.geo("paint", box(0.02, 0.62, 0.5, sg * 0.5, rwY - 0.18, rwZ - 0.04));
  kit.geo("trim", box(0.04, 0.5, 0.12, 0, rwY - 0.27, rwZ + 0.05), K.carbon);
  kit.geo("tail", box(0.1, 0.06, 0.02, 0, 0.32, -hl + 0.06));
  // halo
  const cy = tub.topLower(0.05 * hl), top = cy + 0.22;
  const hp = [V(0.27, cy, -0.25), V(0.25, top, -0.05), V(0.17, top + 0.02, 0.18), V(0, top + 0.02, 0.3)];
  tubes(kit, "trim", 0x16171a, 0.025, hp); tubes(kit, "trim", 0x16171a, 0.025, hp.map(mirrorX));
  tubes(kit, "trim", 0x16171a, 0.03, [V(0, top + 0.02, 0.3), V(0, tub.topLower(0.62) + 0.02, 0.62)]);
  driver(kit, 0, cy + 0.14, -0.02, new THREE.Color(helmet).getHex(), 0x111216);
  // wheels & suspension arms
  const Rf = sh.wheelR, Rr = sh.rearR ?? sh.wheelR, zf = (sh.axleShift ?? 0) + sh.wheelbase / 2, zr = zf - sh.wheelbase;
  const fDef: WheelDef = { r: Rf, w: sh.wheelW, rim: sh.rims ?? "y6", rimColor: sh.rimColor ?? "#26292e", tyre: "slick", rimFrac: 0.62 };
  const rDef: WheelDef = { ...fDef, r: Rr, w: sh.rearW ?? sh.wheelW };
  const xf = sh.wid / 2 - fDef.w / 2, xr = sh.wid / 2 - rDef.w / 2 - 0.02;
  for (const [x, z, R, w] of [[xf, zf, Rf, fDef.w], [xr, zr, Rr, rDef.w]] as const) for (const sg of [1, -1]) {
    const hub = V(sg * (x - w / 2 - 0.03), R, z);
    for (const [dy, dz] of [[0.09, 0.18], [-0.07, -0.16], [0.09, -0.16], [-0.07, 0.18]]) kit.geo("trim", tube(hub, V(sg * 0.3, R + dy, z + dz), 0.016, 5), K.carbon);
  }
  // exhaust
  const ex = [{ p: V(0, 0.4, -hl + 0.02), d: V(0, 0, -1) }];
  kit.geo("metal", cyl(0.05, 0.14, "z", 0, 0.4, -hl + 0.08, 10, true), K.alu);
  const lamps = [V(0.6, 0.2, hl - 0.1), V(-0.6, 0.2, hl - 0.1)];
  const cams = { hood: V(0, 1.02, -0.05), bumper: V(0, 0.36, hl + 0.1) };
  return finish(spec, sh, { kit, exhausts: ex, lamps, flash: false }, wheelsOf(fDef, rDef, xf, zf, xr, zr), cams, { length: L, width: sh.wid, height: 1.05 }, Rr, false);
}

// ---------------------------------------------------------------- go-kart
function kart(spec: CarSpec, sh: CarShape): Built {
  const kit = new Kit(), L = sh.len, hl = L / 2;
  const helmet = new THREE.Color(sh.seat ?? "#f4f1e6").getHex();
  kit.geo("trim", box(0.82, 0.02, 1.3, 0, 0.07, 0), K.carbon);
  const rail = 0xc9ced6;
  for (const sg of [1, -1]) tubes(kit, "metal", rail, 0.016, [V(sg * 0.3, 0.08, -0.72), V(sg * 0.33, 0.08, 0.35), V(sg * 0.22, 0.09, 0.7)]);
  tubes(kit, "metal", rail, 0.016, [V(-0.22, 0.09, 0.7), V(0.22, 0.09, 0.7)]);
  // nose fairing & side pods (plastic bodywork)
  const nose = new Body({ len: 0.5, wid: 1.0, hgt: 0.3, profile: [[-1, 0.0], [-1, 0.6], [-0.4, 0.95], [0.5, 0.8], [0.95, 0.45], [1, 0.0]], belt: null, arches: [], round: 0.3, roundR: 0.1, crown: 0.06, tuck: 0.0, shoulder: 0.05, rTop: 0.1, rBot: 0.02, res: 10, z0: hl - 0.25, lift: 0.05 });
  nose.buildLower(kit);
  decal(kit, nose, "trim", 0xf4f1e6, fFront(nose), ell(0, 0.22, 0.11, 0.07), 6, 2, 0.006);
  for (const sg of [1, -1]) {
    const pod = new Body({ len: 0.78, wid: 0.2, hgt: 0.2, profile: [[-1, 0], [-1, 0.6], [-0.6, 1], [0.6, 1], [1, 0.6], [1, 0]], belt: null, arches: [], round: 0.3, crown: 0.05, tuck: 0, shoulder: 0.05, rTop: 0.06, rBot: 0.02, res: 8, x0: sg * 0.56, z0: 0.0, lift: 0.06, skin: "accent" });
    pod.buildLower(kit);
  }
  // rear bumper
  tubes(kit, "trim", K.black, 0.03, [V(-0.62, 0.16, -hl + 0.1), V(0.62, 0.16, -hl + 0.1)], 8);
  kit.geo("trim", box(1.1, 0.12, 0.1, 0, 0.16, -hl + 0.12), 0x222327);
  // number panel, steering wheel, seat
  kit.geo("paint", box(0.34, 0.24, 0.02, 0, 0.4, 0.46, -0.35));
  kit.geo("trim", box(0.2, 0.13, 0.01, 0, 0.4, 0.472, -0.35), 0xf4f1e6);
  tubes(kit, "metal", 0x8b9098, 0.016, [V(0, 0.12, 0.55), V(0, 0.5, 0.32)]);
  kit.geo("trim", torus(0.14, 0.018, 0, 0.52, 0.3, -0.9, 0, 5, 14), K.black);
  kit.geo("trim", box(0.42, 0.48, 0.07, 0, 0.36, -0.36, -0.32), 0x1a1b1f);
  kit.geo("trim", box(0.42, 0.06, 0.4, 0, 0.13, -0.18), 0x1a1b1f);
  // engine, chain guard, exhaust
  kit.geo("metal", box(0.22, 0.26, 0.26, -0.36, 0.28, -0.5), 0x9aa1aa);
  kit.geo("trim", box(0.2, 0.14, 0.2, -0.36, 0.48, -0.5), 0xe8322b);
  kit.geo("trim", box(0.08, 0.16, 0.4, -0.5, 0.15, -0.52), 0x1a1b1f);
  tubes(kit, "metal", K.chrome, 0.03, [V(-0.36, 0.3, -0.62), V(-0.24, 0.3, -0.75), V(-0.16, 0.3, -0.88)], 8);
  driver(kit, 0, 0.9, -0.16, helmet, new THREE.Color(sh.accent && sh.accent.startsWith("#") ? sh.accent : "#e8322b").getHex(), V(0, 0.5, 0.3));
  const R = sh.wheelR, Rr = sh.rearR ?? R, zf = (sh.axleShift ?? 0) + sh.wheelbase / 2, zr = zf - sh.wheelbase;
  const fDef: WheelDef = { r: R, w: sh.wheelW, rim: sh.rims ?? "three", rimColor: sh.rimColor ?? "#e9edf2", tyre: "kart", rimFrac: 0.6 };
  const rDef: WheelDef = { ...fDef, r: Rr, w: sh.rearW ?? sh.wheelW };
  const xf = sh.wid / 2 - fDef.w / 2, xr = sh.wid / 2 - rDef.w / 2;
  for (const sg of [1, -1]) { kit.geo("trim", tube(V(sg * 0.22, 0.1, zf), V(sg * (xf - fDef.w / 2), R, zf), 0.015, 5), K.black); }
  kit.geo("metal", cyl(0.022, xr * 2, "x", 0, Rr, zr, 8), 0x8b9098);
  const ex = [{ p: V(-0.16, 0.3, -0.92), d: V(0, 0, -1) }];
  const lamps = [V(0.25, 0.2, hl), V(-0.25, 0.2, hl)];
  const cams = { hood: V(0, 0.95, 0.12), bumper: V(0, 0.3, hl + 0.08) };
  return finish(spec, sh, { kit, exhausts: ex, lamps, flash: false }, wheelsOf(fDef, rDef, xf, zf, xr, zr), cams, { length: L, width: sh.wid, height: 1.05 }, Rr, false);
}

// ---------------------------------------------------------------- dune buggy
function buggy(spec: CarSpec, sh: CarShape): Built {
  const kit = new Kit(), L = sh.len, hl = L / 2;
  const tub = new Body({ len: L * 0.86, wid: 1.25, hgt: 0.62, lift: 0.34, profile: [[-1, 0.0], [-1, 0.55], [-0.75, 0.7], [-0.4, 0.5], [0.15, 0.48], [0.5, 0.72], [0.85, 0.66], [1, 0.4], [0.97, 0.0]], belt: null, arches: [], round: 0.25, roundR: 0.2, crown: 0.04, tuck: 0.08, shoulder: 0.05, rTop: 0.08, res: 20 });
  tub.buildLower(kit);
  const F = fFront(tub);
  for (const sg of [1, -1]) {
    const c = sg * 0.4, y = tub.topLower(tub.xmax - 0.05) - 0.08;
    decal(kit, tub, "metal", K.chrome, F, ell(c, y, 0.085, 0.085), 8, 2, 0.02, true);
    decal(kit, tub, "head", K.lamp, F, ell(c, y, 0.06, 0.06), 8, 2, 0.024, false, 1.3);
  }
  decal(kit, tub, "trim", K.grille, F, rect(-0.25, 0.25, 0.42, 0.55), 4, 1, 0.006, true);
  const T = fTop(tub);
  decal(kit, tub, "trim", 0x0c0d10, T, rect(-0.75, 0.55, -0.48, 0.48), 4, 3, 0.006);
  // roll cage (accent paint)
  const cy0 = 0.78, top = 1.62;
  const hoopR = [V(0.56, cy0, -0.55), V(0.5, top, -0.42)], hoopF = [V(0.6, 0.92, 0.62), V(0.5, top - 0.05, 0.18)];
  for (const pts of [hoopR, hoopF]) { tubes(kit, "accent", 0xffffff, 0.035, pts, 7); tubes(kit, "accent", 0xffffff, 0.035, pts.map(mirrorX), 7); }
  tubes(kit, "accent", 0xffffff, 0.035, [V(-0.5, top, -0.42), V(0.5, top, -0.42)], 7);
  tubes(kit, "accent", 0xffffff, 0.035, [V(-0.5, top - 0.05, 0.18), V(0.5, top - 0.05, 0.18)], 7);
  for (const sg of [1, -1]) {
    tubes(kit, "accent", 0xffffff, 0.035, [V(sg * 0.5, top - 0.05, 0.18), V(sg * 0.5, top, -0.42), V(sg * 0.42, 1.0, -1.35)], 7);
    tubes(kit, "accent", 0xffffff, 0.03, [V(sg * 0.6, 0.92, 0.62), V(sg * 0.45, 0.62, 1.42)], 7);
  }
  tubes(kit, "accent", 0xffffff, 0.03, [V(0.5, top, -0.42), V(-0.56, cy0, -0.55)], 6);
  // front bumper bar
  tubes(kit, "trim", K.black, 0.035, [V(-0.55, 0.45, hl - 0.02), V(0.55, 0.45, hl - 0.02)], 8);
  // light bar on the cage
  kit.geo("trim", box(0.9, 0.09, 0.08, 0, top + 0.08, 0.16), K.black);
  const lamps: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) { const x = -0.33 + k * 0.22; kit.geo("head", cyl(0.04, 0.012, "z", x, top + 0.08, 0.205, 10), K.lamp, 1.4); lamps.push(V(x, top + 0.08, 0.21)); }
  // seats, wheel, driver
  for (const sg of [1, -1]) {
    kit.geo("trim", box(0.42, 0.62, 0.1, sg * 0.3, 0.98, -0.42, -0.25), 0x1a1b1f);
    kit.geo("trim", box(0.42, 0.08, 0.38, sg * 0.3, 0.72, -0.22), 0x1a1b1f);
  }
  kit.geo("trim", torus(0.16, 0.02, 0.3, 1.12, 0.24, -0.6, 0, 5, 14), K.black);
  driver(kit, 0.3, 1.35, -0.24, new THREE.Color(sh.seat ?? "#f4f1e6").getHex(), 0x2b2d33, V(0.3, 1.12, 0.22));
  // engine at the back
  kit.geo("metal", box(0.6, 0.34, 0.46, 0, 0.92, -1.12), 0x9aa1aa);
  for (const sg of [1, -1]) kit.geo("metal", cyl(0.08, 0.16, "y", sg * 0.18, 1.18, -1.05, 10), K.chrome);
  const ex: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
  for (const sg of [1, -1]) { tubes(kit, "metal", K.chrome, 0.04, [V(sg * 0.22, 0.95, -1.3), V(sg * 0.24, 1.05, -1.62)], 8); ex.push({ p: V(sg * 0.24, 1.06, -1.66), d: V(0, 0.2, -1).normalize() }); }
  // spare wheel on the engine cover + shocks
  kit.geo("trim", cyl(0.32, 0.2, "y", 0, 1.18, -1.0, 16), K.rubber);
  kit.geo("metal", cyl(0.17, 0.21, "y", 0, 1.18, -1.0, 10), 0x2c2f35);
  const R = sh.wheelR, zf = (sh.axleShift ?? 0) + sh.wheelbase / 2, zr = zf - sh.wheelbase;
  const fDef: WheelDef = { r: R, w: sh.wheelW, rim: sh.rims ?? "offroad", rimColor: sh.rimColor ?? "#2c2f35", tyre: "offroad", rimFrac: 0.56 };
  const rDef: WheelDef = { ...fDef, r: sh.rearR ?? R, w: sh.rearW ?? sh.wheelW };
  const xf = sh.wid / 2 - fDef.w / 2, xr = sh.wid / 2 - rDef.w / 2;
  for (const [x, z, Rw] of [[xf, zf, R], [xr, zr, rDef.r]] as const) for (const sg of [1, -1]) {
    const hub = V(sg * (x - 0.2), Rw, z);
    kit.geo("metal", tube(hub, V(sg * 0.5, 1.15, z * 0.85), 0.04, 8), 0xd0d4da);
    kit.geo("trim", tube(hub.clone().lerp(V(sg * 0.5, 1.15, z * 0.85), 0.25), hub.clone().lerp(V(sg * 0.5, 1.15, z * 0.85), 0.7), 0.06, 8), 0xe8322b);
    kit.geo("trim", tube(hub, V(sg * 0.35, 0.45, z), 0.03, 6), K.black);
  }
  const cams = { hood: V(0, 1.5, 0.45), bumper: V(0, 0.55, hl + 0.1) };
  return finish(spec, sh, { kit, exhausts: ex, lamps, flash: false }, wheelsOf(fDef, rDef, xf, zf, xr, zr), cams, { length: L, width: sh.wid, height: top + 0.15 }, rDef.r, false);
}

// ---------------------------------------------------------------- farm tractor
function tractor(spec: CarSpec, sh: CarShape): Built {
  const kit = new Kit(), L = sh.len, hl = L / 2;
  const Rf = sh.wheelR, Rr = sh.rearR ?? 0.8;
  const zf = (sh.axleShift ?? 0) + sh.wheelbase / 2, zr = zf - sh.wheelbase;
  // engine hood
  const hood = new Body({ len: 1.95, wid: 0.82, hgt: 0.72, lift: 0.82, profile: [[-1, 0], [-1, 0.9], [-0.92, 1], [0.7, 0.98], [0.94, 0.86], [1, 0.55], [1, 0]], belt: null, arches: [], round: 0.12, crown: 0.05, tuck: 0.02, shoulder: 0.04, rTop: 0.1, rBot: 0.02, res: 16, z0: hl - 0.98 });
  hood.buildLower(kit);
  const F = fFront(hood);
  decal(kit, hood, "metal", K.chrome, F, rect(-0.3, 0.3, 0.88, 1.36), 4, 4, 0.01, true);
  decal(kit, hood, "trim", K.grille, F, rect(-0.26, 0.26, 0.92, 1.32), 4, 4, 0.012);
  for (let k = 1; k < 6; k++) decal(kit, hood, "metal", 0x9aa1aa, F, rect(-0.25, 0.25, 0.92 + k * 0.067 - 0.008, 0.92 + k * 0.067 + 0.008), 3, 1, 0.016);
  const lamps: THREE.Vector3[] = [];
  for (const sg of [1, -1]) {
    const T = fTop(hood), z = hood.xmax + hood.z0 - 0.25;
    decal(kit, hood, "trim", 0x0c0d10, T, sg > 0 ? rect(z - 0.5, z, 0.25, 0.36) : rect(z - 0.5, z, -0.36, -0.25), 4, 1, 0.004);
    // round lamps on the hood sides
    kit.geo("metal", cyl(0.075, 0.06, "z", sg * 0.36, 1.32, hood.xmax + hood.z0 - 0.08, 12), K.chrome);
    kit.geo("head", cyl(0.06, 0.01, "z", sg * 0.36, 1.32, hood.xmax + hood.z0 - 0.045, 12), K.lamp, 1.3);
    lamps.push(V(sg * 0.36, 1.32, hood.xmax + hood.z0 - 0.04));
  }
  // chassis, front axle and weights
  kit.geo("trim", box(0.62, 0.36, 2.3, 0, 0.66, 0.1), 0x24262b);
  kit.geo("trim", box(1.0, 0.12, 0.16, 0, Rf + 0.05, zf), 0x24262b);
  for (let k = 0; k < 5; k++) kit.geo("trim", box(0.7, 0.07, 0.16, 0, 0.62 + k * 0.08, hl - 0.06), k % 2 ? 0x2f3237 : 0x24262b);
  // exhaust stack + air intake
  const stackZ = hood.z0 + 0.3;
  kit.geo("metal", cyl(0.055, 1.0, "y", 0.22, 1.95, stackZ, 10), K.chrome);
  kit.geo("trim", cyl(0.06, 0.04, "y", 0.22, 2.46, stackZ, 10), 0x111216);
  kit.geo("trim", cyl(0.07, 0.6, "y", -0.22, 1.75, stackZ + 0.2, 10), 0x24262b);
  // cab
  const c0 = zr - 0.55, c1 = zr + 0.75, cyF = 1.32, cyT = 2.58, cw = 0.68;
  kit.geo("trim", box(cw * 2 + 0.1, 0.08, c1 - c0 + 0.1, 0, cyF, (c0 + c1) / 2), 0x24262b);
  for (const sx of [1, -1]) for (const z of [c0, c1]) kit.geo("trim", tube(V(sx * cw, cyF, z), V(sx * (cw - 0.04), cyT, z), 0.03, 6), K.black);
  kit.geo("paint", box(cw * 2 + 0.22, 0.09, c1 - c0 + 0.3, 0, cyT + 0.04, (c0 + c1) / 2));
  kit.geo("trim", box(cw * 2 + 0.24, 0.03, c1 - c0 + 0.32, 0, cyT - 0.01, (c0 + c1) / 2), 0xf4f1e6);
  kit.geo("glass", box(cw * 2 - 0.04, cyT - cyF - 0.12, 0.012, 0, (cyF + cyT) / 2, c1));
  kit.geo("glass", box(cw * 2 - 0.04, cyT - cyF - 0.5, 0.012, 0, (cyF + cyT) / 2 + 0.2, c0));
  for (const sx of [1, -1]) kit.geo("glass", box(0.012, cyT - cyF - 0.5, c1 - c0 - 0.06, sx * cw, (cyF + cyT) / 2 + 0.2, (c0 + c1) / 2));
  kit.geo("trim", box(0.5, 0.5, 0.12, 0, cyF + 0.38, c0 + 0.25, -0.15), 0x1a1b1f);
  kit.geo("trim", box(0.5, 0.1, 0.45, 0, cyF + 0.2, c0 + 0.45), 0x1a1b1f);
  kit.geo("trim", torus(0.17, 0.02, 0, cyF + 0.72, c1 - 0.3, -0.9, 0, 5, 14), K.black);
  kit.geo("trim", tube(V(0, cyF + 0.1, c1 - 0.15), V(0, cyF + 0.7, c1 - 0.3), 0.025, 6), K.black);
  // work lamps + beacon
  for (const sg of [1, -1]) { kit.geo("trim", box(0.12, 0.09, 0.07, sg * 0.5, cyT + 0.13, c1 + 0.1), K.black); kit.geo("head", box(0.1, 0.07, 0.01, sg * 0.5, cyT + 0.13, c1 + 0.14), K.lamp, 1.3); }
  kit.geo("trim", cyl(0.07, 0.03, "y", -0.45, cyT + 0.1, (c0 + c1) / 2, 10), K.black);
  kit.geo("flashA", cyl(0.06, 0.1, "y", -0.45, cyT + 0.17, (c0 + c1) / 2, 10), 0xffa000);
  // rear fenders over the big wheels (+ tail lamps)
  const xr = sh.wid / 2 - (sh.rearW ?? 0.48) / 2, wr = sh.rearW ?? 0.48;
  for (const sg of [1, -1]) {
    arcBand(kit, "paint", 0xffffff, Rr + 0.1, sg * (xr - wr / 2 - 0.04), sg * (xr + wr / 2 + 0.04), Rr, zr, -1.25, 1.35, 14);
    kit.geo("tail", box(0.08, 0.1, 0.03, sg * (xr + 0.1), Rr + 0.5, zr - Rr - 0.02));
  }
  kit.geo("trim", box(0.3, 0.12, 0.25, 0, 0.55, zr - 0.6), 0x24262b);
  const fDef: WheelDef = { r: Rf, w: sh.wheelW, rim: sh.rims ?? "tractor", rimColor: sh.rimColor ?? "#f2c230", tyre: "lug", rimFrac: 0.55 };
  const rDef: WheelDef = { ...fDef, r: Rr, w: wr, rimFrac: 0.6 };
  const xf = 0.65;
  const ex = [{ p: V(0.22, 2.5, stackZ), d: V(0, 1, 0) }];
  const cams = { hood: V(0, 1.98, hood.z0 - 0.35), bumper: V(0, 0.8, hl + 0.12) };
  return finish(spec, sh, { kit, exhausts: ex, lamps, flash: true }, wheelsOf(fDef, rDef, xf, zf, xr, zr), cams, { length: L, width: sh.wid, height: cyT + 0.25 }, Rr, false);
}
