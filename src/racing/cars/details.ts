// Trim & details: lamps, grilles, intakes, plates, door shut-lines, handles, mirrors, skirts, vents, stripes,
// liveries, spoilers, roof gear and class extras. Most flat details are PROJECTED onto the curved body (like
// decals with thickness), so they hug the surface from every camera angle.
import * as THREE from "three";
import { Body, type Arch } from "./body";
import { Kit, K, V, box, cyl, sphere, tube, type Bucket, type Col } from "./kit";
import type { CarShape } from "./shape";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- projected decals
export interface Frame { o: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; d: THREE.Vector3; /** max ray travel past the bounding box (m) */ depth?: number }
export interface Shape { u0: number; u1: number; vb: (u: number) => number; vt: (u: number) => number }
export const rect = (u0: number, u1: number, v0: number, v1: number): Shape => ({ u0, u1, vb: () => v0, vt: () => v1 });
/** parallelogram / trapezoid: bottom and top edges linear in u */
export const para = (u0: number, u1: number, b0: number, b1: number, t0: number, t1: number): Shape => ({
  u0, u1, vb: (u) => lerp(b0, b1, (u - u0) / (u1 - u0 || 1)), vt: (u) => lerp(t0, t1, (u - u0) / (u1 - u0 || 1)),
});
export const ell = (cu: number, cv: number, ru: number, rv: number): Shape => ({
  u0: cu - ru, u1: cu + ru,
  vb: (u) => cv - rv * Math.sqrt(Math.max(0, 1 - ((u - cu) / ru) ** 2)), vt: (u) => cv + rv * Math.sqrt(Math.max(0, 1 - ((u - cu) / ru) ** 2)),
});
/** rounded-end bar */
export const pill = (u0: number, u1: number, v0: number, v1: number): Shape => {
  const r = Math.min((v1 - v0) / 2, (u1 - u0) / 2), cv = (v0 + v1) / 2, hv = (v1 - v0) / 2;
  const f = (u: number) => { const d = Math.min(u - u0, u1 - u); return d >= r ? 1 : Math.sqrt(Math.max(0, 1 - ((r - d) / r) ** 2)); };
  return { u0, u1, vb: (u) => cv - hv * f(u), vt: (u) => cv + hv * f(u) };
};
export const mirU = (s: Shape): Shape => ({ u0: -s.u1, u1: -s.u0, vb: (u) => s.vb(-u), vt: (u) => s.vt(-u) });
export const mirV = (s: Shape): Shape => ({ u0: s.u0, u1: s.u1, vb: (u) => -s.vt(u), vt: (u) => -s.vb(u) });
/** shrink a shape by m on every side */
export const inset = (s: Shape, m: number): Shape => ({ u0: s.u0 + m, u1: s.u1 - m, vb: (u) => s.vb(u) + m, vt: (u) => Math.max(s.vb(u) + m + 0.001, s.vt(u) - m) });

const _o = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3();
/** project a (u,v) grid onto the body along the frame direction, lift it eps along the surface normal and add it */
export function decal(kit: Kit, B: Body, b: Bucket, color: Col, fr: Frame, sh: Shape, nu: number, nv: number, eps: number, walls = false, scale = 1) {
  const P: (THREE.Vector3 | null)[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = lerp(sh.u0, sh.u1, i / nu), v = lerp(sh.vb(u), sh.vt(u), j / nv);
    _o.copy(fr.o).addScaledVector(fr.u, u).addScaledVector(fr.v, v);
    P.push(B.project(_o, fr.d, new THREE.Vector3(), 8, fr.depth ?? Infinity));
  }
  const id = (i: number, j: number) => clamp(j, 0, nv) * (nu + 1) + clamp(i, 0, nu);
  const N = P.map((p, k) => {
    const n = new THREE.Vector3();
    if (!p) return n;
    const i = k % (nu + 1), j = Math.floor(k / (nu + 1));
    const pu1 = P[id(i + 1, j)] ?? p, pu0 = P[id(i - 1, j)] ?? p, pv1 = P[id(i, j + 1)] ?? p, pv0 = P[id(i, j - 1)] ?? p;
    _a.subVectors(pu1, pu0); _b.subVectors(pv1, pv0);
    if (_a.lengthSq() < 1e-8 || _b.lengthSq() < 1e-8) {
      // degenerate (ellipse tip): ask the surface directly
      const u = lerp(sh.u0, sh.u1, i / nu), v = lerp(sh.vb(u), sh.vt(u), j / nv), h = 0.01;
      const q = (du: number, dv: number) => B.project(_o.copy(fr.o).addScaledVector(fr.u, u + du).addScaledVector(fr.v, v + dv), fr.d, new THREE.Vector3(), 8, fr.depth ?? Infinity);
      const qa = q(h, 0), qb = q(0, h);
      if (qa && qb) { _a.subVectors(qa, p); _b.subVectors(qb, p); }
    }
    n.crossVectors(_a, _b);
    if (n.lengthSq() < 1e-12) n.copy(fr.d).negate();
    n.normalize(); if (n.dot(fr.d) > 0) n.negate();
    return n;
  });
  const T = P.map((p, k) => (p ? p.clone().addScaledVector(N[k], eps) : null));
  let all = true;
  const tri = (a: number, c: number, d: number) => {
    const A = T[a]!, C = T[c]!, D = T[d]!;
    _a.subVectors(C, A); _b.subVectors(D, A); _f.crossVectors(_a, _b);
    if (_f.lengthSq() < 1e-14) return;
    if (_f.dot(N[a]) < 0) kit.tri(b, A, D, C, color, N[a], N[d], N[c], scale); else kit.tri(b, A, C, D, color, N[a], N[c], N[d], scale);
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = id(i, j), c = id(i + 1, j), d = id(i + 1, j + 1), e = id(i, j + 1);
    if (!T[a] || !T[c] || !T[d] || !T[e]) { all = false; continue; }
    tri(a, c, d); tri(a, d, e);
  }
  if (walls) {
    const ring: number[] = [];
    for (let i = 0; i <= nu; i++) ring.push(id(i, 0));
    for (let j = 1; j <= nv; j++) ring.push(id(nu, j));
    for (let i = nu - 1; i >= 0; i--) ring.push(id(i, nv));
    for (let j = nv - 1; j > 0; j--) ring.push(id(0, j));
    const ctr = new THREE.Vector3(); let cn = 0;
    for (const p of P) if (p) { ctr.add(p); cn++; }
    ctr.divideScalar(Math.max(1, cn));
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], c = ring[(k + 1) % ring.length];
      if (!P[a] || !P[c] || a === c) continue;
      const A = T[a]!, C = T[c]!, A2 = P[a]!.clone().addScaledVector(N[a], -0.004), C2 = P[c]!.clone().addScaledVector(N[c], -0.004);
      if (A.distanceToSquared(C) < 1e-10) continue;
      const out = A.clone().add(C).multiplyScalar(0.5).sub(ctr);
      _a.subVectors(C, A); _b.subVectors(A2, A); _f.crossVectors(_a, _b);
      if (_f.dot(out) < 0) { kit.tri(b, A, A2, C, color, undefined, undefined, undefined, scale * 0.8); kit.tri(b, C, A2, C2, color, undefined, undefined, undefined, scale * 0.8); }
      else { kit.tri(b, A, C, A2, color, undefined, undefined, undefined, scale * 0.8); kit.tri(b, C, C2, A2, color, undefined, undefined, undefined, scale * 0.8); }
    }
  }
  return all;
}

/** frames */
export const fFront = (B: Body): Frame => ({ o: V(0, 0, B.xmax + B.z0 + 1), u: V(1, 0, 0), v: V(0, 1, 0), d: V(0, 0, -1), depth: 1.0 });
export const fRear = (B: Body): Frame => ({ o: V(0, 0, B.xmin + B.z0 - 1), u: V(1, 0, 0), v: V(0, 1, 0), d: V(0, 0, 1), depth: 0.9 });
export const fSide = (B: Body, sg: number): Frame => ({ o: V(sg * (B.W / 2 + 1.2 + Math.abs(B.x0)), 0, 0), u: V(0, 0, 1), v: V(0, 1, 0), d: V(-sg, 0, 0), depth: 0.7 });
export const fTop = (B: Body): Frame => ({ o: V(0, B.maxY + 1, 0), u: V(0, 0, 1), v: V(1, 0, 0), d: V(0, -1, 0) });
/** frame looking at the front from slightly above (for sloped noses) */
export const fFrontTilt = (B: Body, a: number): Frame => ({ o: V(0, Math.sin(a) * 3, B.xmax + Math.cos(a) * 3), u: V(1, 0, 0), v: V(0, Math.cos(a), -Math.sin(a)), d: V(0, -Math.sin(a), -Math.cos(a)) });

// ---------------------------------------------------------------- reference points
export interface Ref {
  fx: number; rx: number; fyb: number; fyc: number; fyn: number; ryb: number; ryc: number; ryn: number;
  hy: number; ty: number; hw: number; by: number; fa: Arch; ra: Arch; H: number; lift: number;
  /** head-lamp centres (for the night beams) */
  lamps: THREE.Vector3[];
}
export function refs(B: Body, sh: CarShape, fa: Arch, ra: Arch): Ref {
  const fx = B.xmax, rx = B.xmin;
  const [fyb, fyc] = B.span(fx - 0.004), [ryb, ryc] = B.span(rx + 0.004);
  const fyn = B.topLower(fx - 0.3), ryn = B.topLower(rx + 0.28);
  const lift = B.lift, H = B.H;
  const by = B.beltY - 0.04;
  const hy = sh.lampY != null ? sh.lampY * H + lift : lerp(fyb, Math.min(by, Math.max(fyc, fyn)), 0.64);
  const ty = sh.tailY != null ? sh.tailY * H + lift : lerp(ryb, Math.min(by, Math.max(ryc, ryn)), 0.76);
  return { fx, rx, fyb, fyc, fyn, ryb, ryc, ryn, hy, ty, hw: B.W / 2, by: B.beltY, fa, ra, H, lift, lamps: [] };
}

// ---------------------------------------------------------------- front
export function front(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const F = fFront(B), hw = R.hw, hy = R.hy, yb = R.fyb;
  const style = sh.head ?? "slim";
  const both = (f: (sg: number) => void) => { f(1); f(-1); };
  const S = (s: Shape, sg: number) => (sg > 0 ? s : mirU(s));
  const lampC = (u: number, v: number) => { const p = B.project(V(u, v, B.xmax + 1), V(0, 0, -1)); if (p) R.lamps.push(p); };
  const housing = 0x0b0c0f;
  if (style === "slim" || style === "cat") {
    const cat = style === "cat";
    both((sg) => {
      const u0 = hw * (cat ? 0.5 : 0.44), u1 = hw * 0.9, h = cat ? 0.05 : 0.065;
      const base = para(u0, u1, hy - h * 0.5 - (cat ? 0.035 : 0.012), hy - h * 0.5 + 0.02, hy + h * 0.25 - (cat ? 0.02 : 0), hy + h * 0.5 + 0.03);
      decal(kit, B, "metal", housing, F, S(base, sg), 7, 2, 0.007, true);
      decal(kit, B, "metal", 0x6b727c, F, S(inset(base, 0.012), sg), 6, 1, 0.009);
      // LED signature along the top edge + two projector eyes
      decal(kit, B, "head", K.white, F, S(para(u0 + 0.01, u1 - 0.012, base.vt(u0 + 0.01) - 0.016, base.vt(u1 - 0.012) - 0.016, base.vt(u0 + 0.01) - 0.004, base.vt(u1 - 0.012) - 0.004), sg), 7, 1, 0.012, false, 1.6);
      for (const t of [0.3, 0.62]) {
        const cu = lerp(u0, u1, t), cv = (base.vb(cu) + base.vt(cu)) / 2 - 0.006, r = h * 0.3;
        decal(kit, B, "metal", 0x9aa2ad, F, S(ell(cu, cv, r * 1.25, r * 1.25), sg), 8, 2, 0.0105);
        decal(kit, B, "head", K.lamp, F, S(ell(cu, cv, r, r), sg), 8, 2, 0.013, false, 1.3);
      }
      lampC(sg * lerp(u0, u1, 0.5), hy);
    });
  } else if (style === "round" || style === "bug" || style === "twin") {
    both((sg) => {
      const list = style === "twin" ? [[0.5, 0.075], [0.76, 0.075]] : [[0.64, style === "bug" ? 0.12 : 0.1]];
      for (const [cu0, r] of list) {
        const cu = hw * cu0;
        decal(kit, B, "metal", K.chrome, F, S(ell(cu, hy, r * 1.22, r * 1.22), sg), 10, 3, style === "bug" ? 0.03 : 0.012, true);
        decal(kit, B, "metal", 0x7d8590, F, S(ell(cu, hy, r, r), sg), 10, 3, style === "bug" ? 0.034 : 0.015);
        decal(kit, B, "head", K.lamp, F, S(ell(cu, hy, r * 0.55, r * 0.55), sg), 8, 2, style === "bug" ? 0.037 : 0.018, false, 1.4);
        lampC(sg * cu, hy);
      }
    });
  } else if (style === "square" || style === "big") {
    both((sg) => {
      const big = style === "big", u0 = hw * (big ? 0.5 : 0.48), u1 = hw * 0.9, h = big ? 0.2 : 0.12;
      const base = rect(u0, u1, hy - h / 2, hy + h / 2);
      decal(kit, B, "metal", K.chrome, F, S(base, sg), 5, 3, 0.012, true);
      decal(kit, B, "metal", housing, F, S(inset(base, 0.016), sg), 5, 2, 0.014);
      decal(kit, B, "head", K.lamp, F, S(rect(u0 + 0.03, lerp(u0, u1, 0.55), hy - h / 2 + 0.03, hy + h / 2 - 0.03), sg), 3, 2, 0.017, false, 1.3);
      decal(kit, B, "head", K.amber, F, S(rect(lerp(u0, u1, 0.62), u1 - 0.03, hy - h / 2 + 0.03, hy + h / 2 - 0.03), sg), 2, 2, 0.017, false, 0.9);
      lampC(sg * lerp(u0, u1, 0.3), hy);
    });
  } else if (style === "bar") {
    decal(kit, B, "metal", housing, F, pill(-hw * 0.86, hw * 0.86, hy - 0.022, hy + 0.022), 14, 1, 0.006, true);
    decal(kit, B, "head", K.white, F, pill(-hw * 0.84, hw * 0.84, hy - 0.008, hy + 0.008), 14, 1, 0.009, false, 1.7);
    both((sg) => { decal(kit, B, "head", K.lamp, F, S(pill(hw * 0.6, hw * 0.84, hy - 0.065, hy - 0.035), sg), 5, 1, 0.008, false, 1.2); lampC(sg * hw * 0.72, hy - 0.05); });
  } else if (style === "popup") {
    // closed pop-up lids on the bonnet + slim lamps low in the bumper
    const T = fTop(B);
    both((sg) => {
      const z0 = R.fx - 0.42, z1 = R.fx - 0.12;
      decal(kit, B, "trim", K.black, T, sg > 0 ? rect(z0, z1, hw * 0.42, hw * 0.78) : mirV(rect(z0, z1, hw * 0.42, hw * 0.78)), 3, 3, 0.002);
      decal(kit, B, "paint", 0xffffff, T, sg > 0 ? rect(z0 + 0.012, z1 - 0.012, hw * 0.42 + 0.012, hw * 0.78 - 0.012) : mirV(rect(z0 + 0.012, z1 - 0.012, hw * 0.42 + 0.012, hw * 0.78 - 0.012)), 3, 3, 0.004);
      const ly = lerp(yb, R.fyc, 0.55);
      decal(kit, B, "metal", housing, F, S(pill(hw * 0.5, hw * 0.9, ly - 0.03, ly + 0.03), sg), 6, 1, 0.006, true);
      decal(kit, B, "head", K.lamp, F, S(pill(hw * 0.53, hw * 0.75, ly - 0.016, ly + 0.016), sg), 5, 1, 0.009, false, 1.3);
      decal(kit, B, "head", K.amber, F, S(pill(hw * 0.77, hw * 0.88, ly - 0.016, ly + 0.016), sg), 3, 1, 0.009);
      lampC(sg * hw * 0.64, ly);
    });
  }
  // ---- grille & intakes
  const g = sh.grille ?? "mesh";
  const gTop = Math.min(hy - 0.02, R.fyn - 0.05), gBot = yb + 0.09;
  const slats = (s: Shape, n: number, color: Col, bk: Bucket = "trim", eps = 0.006) => {
    for (let k = 1; k < n; k++) {
      const t = k / n, cu = (s.u0 + s.u1) / 2;
      const v = lerp(s.vb(cu), s.vt(cu), t);
      decal(kit, B, bk, color, F, rect(s.u0 + 0.02, s.u1 - 0.02, v - 0.006, v + 0.006), 4, 1, eps);
    }
  };
  if (g === "mesh" || g === "bars") {
    const s = para(-hw * 0.4, hw * 0.4, gBot, gBot, gTop, gTop);
    const sh2: Shape = { u0: s.u0, u1: s.u1, vb: (u) => gBot + Math.abs(u) * 0.12, vt: () => gTop };
    decal(kit, B, "trim", K.grille, F, sh2, 6, 2, 0.003);
    frameStrips(kit, B, F, sh2, 0.014, g === "bars" ? "metal" : "metal", g === "bars" ? K.chrome : 0x15171b, 0.008);
    slats(sh2, g === "bars" ? 5 : 4, g === "bars" ? K.chrome : 0x2a2d33, g === "bars" ? "metal" : "trim");
  } else if (g === "slot" || g === "mouth" || g === "ev" || g === "smile") {
    if (g === "slot") decal(kit, B, "trim", K.grille, F, pill(-hw * 0.36, hw * 0.36, hy - 0.018, hy + 0.012), 8, 1, 0.004, true);
    // big lower mouth
    const mw = g === "ev" ? 0.38 : g === "smile" ? 0.36 : 0.56, mt = g === "ev" ? yb + 0.11 : lerp(yb, hy, 0.6);
    const mouth: Shape = g === "smile" ? ell(0, lerp(yb, hy, 0.42), hw * mw, (hy - yb) * 0.22) : { u0: -hw * mw, u1: hw * mw, vb: (u) => yb + 0.035 + (Math.abs(u) / hw) * 0.05, vt: (u) => mt - (Math.abs(u) / hw) * 0.06 };
    decal(kit, B, "trim", K.grille, F, mouth, 8, 2, 0.003);
    frameStrips(kit, B, F, mouth, 0.012, "metal", g === "smile" ? K.chrome : 0x15171b, 0.008);
    if (g !== "smile") slats(mouth, 3, 0x2a2d33);
  } else if (g === "truck") {
    const s = rect(-hw * 0.48, hw * 0.48, yb + 0.12, R.fyc - 0.05);
    decal(kit, B, "metal", K.chrome, F, s, 6, 4, 0.012, true);
    decal(kit, B, "trim", K.grille, F, inset(s, 0.04), 6, 4, 0.014);
    for (let k = 0; k <= 7; k++) { const u = lerp(s.u0 + 0.06, s.u1 - 0.06, k / 7); decal(kit, B, "metal", K.chrome, F, rect(u - 0.012, u + 0.012, s.vb(0) + 0.04, s.vt(0) - 0.04), 1, 4, 0.02); }
  }
  // side intakes / fog lamps / splitter (cars, not trucks)
  if (g !== "truck" && style !== "big") {
    both((sg) => {
      const s = para(hw * 0.62, hw * 0.9, yb + 0.04, yb + 0.05, yb + 0.12, yb + 0.15);
      decal(kit, B, "trim", K.grille, F, S(s, sg), 4, 1, 0.003);
      frameStrips(kit, B, F, S(s, sg), 0.01, "metal", 0x15171b, 0.007);
      decal(kit, B, "head", K.lamp, F, S(ell(hw * 0.76, yb + 0.09, 0.03, 0.022), sg), 6, 2, 0.01, false, 0.9);
    });
  }
  // number plate & badge
  if (sh.plate) plate(kit, B, F, 0, lerp(yb, gBot, 0.5) + 0.06, 0.016);
  decal(kit, B, "metal", K.chrome, F, ell(0, Math.min(gTop + 0.035, R.fyn - 0.03), 0.04, 0.022), 6, 2, 0.012);
}

/** a frame of 4 strips around a shape (raised bezel) */
function frameStrips(kit: Kit, B: Body, F: Frame, s: Shape, t: number, bk: Bucket, color: Col, eps: number) {
  decal(kit, B, bk, color, F, { u0: s.u0, u1: s.u1, vb: (u) => s.vt(u) - t, vt: (u) => s.vt(u) }, 6, 1, eps, true);
  decal(kit, B, bk, color, F, { u0: s.u0, u1: s.u1, vb: (u) => s.vb(u), vt: (u) => s.vb(u) + t }, 6, 1, eps, true);
  decal(kit, B, bk, color, F, { u0: s.u0, u1: s.u0 + t, vb: (u) => s.vb(u), vt: (u) => s.vt(u) }, 1, 2, eps, true);
  decal(kit, B, bk, color, F, { u0: s.u1 - t, u1: s.u1, vb: (u) => s.vb(u), vt: (u) => s.vt(u) }, 1, 2, eps, true);
}

function plate(kit: Kit, B: Body, F: Frame, cu: number, cv: number, eps: number) {
  decal(kit, B, "trim", 0x1a1b1e, F, rect(cu - 0.27, cu + 0.27, cv - 0.065, cv + 0.065), 3, 1, eps, true);
  decal(kit, B, "trim", K.plate, F, rect(cu - 0.255, cu + 0.255, cv - 0.05, cv + 0.05), 3, 1, eps + 0.003);
  // fake characters
  for (let k = 0; k < 6; k++) { const u = cu - 0.19 + k * 0.076; decal(kit, B, "trim", 0x24262b, F, rect(u - 0.022, u + 0.022, cv - 0.03, cv + 0.03), 1, 1, eps + 0.005); }
}

// ---------------------------------------------------------------- rear
export function rear(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const F = fRear(B), hw = R.hw, ty = R.ty, yb = R.ryb;
  const style = sh.tail ?? "wrap";
  const both = (f: (sg: number) => void) => { f(1); f(-1); };
  const S = (s: Shape, sg: number) => (sg > 0 ? s : mirU(s));
  const red = 0xffffff;
  if (style === "wrap" || style === "slim" || style === "bar") {
    const slim = style !== "wrap";
    both((sg) => {
      const u0 = hw * (style === "bar" ? 0.52 : 0.5), u1 = hw * 0.93, h = slim ? 0.05 : 0.085;
      const base = para(u0, u1, ty - h / 2, ty - h / 2 - 0.01, ty + h / 2, ty + h / 2 + 0.012);
      decal(kit, B, "metal", 0x0b0c0f, F, S(base, sg), 7, 2, 0.007, true);
      decal(kit, B, "tail", red, F, S(inset(base, 0.008), sg), 7, 2, 0.01);
      // light-guide strip + reverse lamp
      decal(kit, B, "tail", red, F, S(para(u0 + 0.02, u1 - 0.02, base.vt(u0) - 0.02, base.vt(u1) - 0.02, base.vt(u0) - 0.008, base.vt(u1) - 0.008), sg), 6, 1, 0.013, false, 1.6);
      if (!slim) decal(kit, B, "head", K.white, F, S(rect(u0 + 0.02, u0 + 0.12, ty - 0.03, ty + 0.0), sg), 2, 1, 0.012, false, 0.8);
      decal(kit, B, "head", K.amber, F, S(rect(u1 - 0.1, u1 - 0.02, base.vb(u1 - 0.06) + 0.012, base.vb(u1 - 0.06) + 0.028), sg), 2, 1, 0.012, false, 0.8);
    });
    if (style === "bar") {
      decal(kit, B, "metal", 0x0b0c0f, F, rect(-hw * 0.52, hw * 0.52, ty - 0.022, ty + 0.022), 8, 1, 0.006, true);
      decal(kit, B, "tail", red, F, rect(-hw * 0.52, hw * 0.52, ty - 0.01, ty + 0.01), 8, 1, 0.009, false, 1.7);
    }
  } else if (style === "round") {
    both((sg) => {
      for (const cu of [hw * 0.55, hw * 0.8]) {
        decal(kit, B, "metal", K.chrome, F, S(ell(cu, ty, 0.07, 0.07), sg), 8, 2, 0.01, true);
        decal(kit, B, "tail", red, F, S(ell(cu, ty, 0.058, 0.058), sg), 8, 2, 0.013);
        decal(kit, B, "tail", red, F, S(ell(cu, ty, 0.025, 0.025), sg), 6, 1, 0.015, false, 1.8);
      }
    });
  } else if (style === "block" || style === "vertical") {
    both((sg) => {
      const v = style === "vertical";
      const s = v ? rect(hw * 0.78, hw * 0.94, ty - 0.2, ty + 0.2) : rect(hw * 0.52, hw * 0.92, ty - 0.07, ty + 0.07);
      decal(kit, B, "metal", K.chrome, F, S(s, sg), 3, 3, 0.008, true);
      decal(kit, B, "tail", red, F, S(inset(s, 0.012), sg), 3, 3, 0.011);
      const q = inset(s, 0.02);
      if (v) {
        decal(kit, B, "head", K.amber, F, S(rect(q.u0, q.u1, q.vt(0) - 0.07, q.vt(0)), sg), 2, 1, 0.013, false, 0.9);
        decal(kit, B, "head", K.white, F, S(rect(q.u0, q.u1, q.vb(0), q.vb(0) + 0.07), sg), 2, 1, 0.013, false, 0.8);
      } else {
        decal(kit, B, "head", K.amber, F, S(rect(q.u1 - 0.08, q.u1, q.vb(0), q.vt(0)), sg), 2, 1, 0.013, false, 0.9);
        decal(kit, B, "head", K.white, F, S(rect(q.u0, q.u0 + 0.08, q.vb(0), q.vt(0)), sg), 2, 1, 0.013, false, 0.8);
      }
    });
  }
  // bumper / diffuser
  const dTop = Math.min(ty - 0.12, yb + 0.13);
  decal(kit, B, "trim", K.plastic, F, { u0: -hw * 0.82, u1: hw * 0.82, vb: () => yb + 0.01, vt: (u) => dTop - (Math.abs(u) / hw) * 0.03 }, 8, 1, 0.004);
  for (let k = -3; k <= 3; k++) {
    const u = k * hw * 0.13, p = B.project(V(u, yb + 0.05, B.xmin - 1), V(0, 0, 1));
    if (p) kit.geo("trim", box(0.014, 0.08, 0.12, u, yb + 0.05, p.z + 0.02), K.carbon);
  }
  decal(kit, B, "tail", red, F, rect(-hw * 0.86, -hw * 0.74, dTop - 0.03, dTop - 0.012), 2, 1, 0.006);
  decal(kit, B, "tail", red, F, rect(hw * 0.74, hw * 0.86, dTop - 0.03, dTop - 0.012), 2, 1, 0.006);
  if (sh.plate !== false) plate(kit, B, F, 0, clamp(ty - 0.14, dTop + 0.08, ty - 0.08), 0.012);
  decal(kit, B, "metal", K.chrome, F, ell(0, ty + 0.06, 0.04, 0.022), 6, 2, 0.012);
}

// ---------------------------------------------------------------- sides
export function sides(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const by = R.by, fa = R.fa, ra = R.ra;
  const handles = sh.handles ?? "black";
  for (const sg of [1, -1]) {
    const F = fSide(B, sg);
    const line = (s: number, v0: number, v1: number) => decal(kit, B, "trim", 0x0a0b0d, F, rect(s - 0.0035, s + 0.0035, v0, v1), 1, 3, 0.002);
    const sillY = Math.max(B.sillY + 0.05, 0.05);
    // doors
    const doors = sh.doors ?? 2;
    if (B.cab && doors > 0) {
      const sF = Math.min(B.cab.sF - 0.06, fa.s - fa.r - 0.06);
      const top = by - 0.012;
      const pS = B.pillarS.length ? B.pillarS[B.pillarS.length - 1] : lerp(B.cab.sR, B.cab.sF, 0.4);
      const edges = [sF, pS];
      if (doors >= 4 && B.pillarS.length) edges.push(Math.max(ra.s + ra.r + 0.05, B.pillarS[0] - 0.55));
      const arches = [fa, ra];
      for (const e of edges) {
        let lo = sillY + 0.03;
        for (const a of arches) if (Math.abs(e - a.s) < a.r) lo = Math.max(lo, a.y + Math.sqrt(a.r * a.r - (e - a.s) ** 2) + 0.03);
        if (lo < top - 0.1) line(e, lo, top);
      }
      // handles just ahead of each door's rear edge
      if (handles !== "none") for (const e of edges.slice(1)) {
        const s = rect(e + 0.06, e + 0.2, by - 0.1, by - 0.075);
        decal(kit, B, handles === "chrome" ? "metal" : "trim", handles === "chrome" ? K.chrome : 0x111216, F, s, 2, 1, 0.012, true);
      }
      // window sill trim
    }
    // side skirt
    if (sh.skirt) {
      const s0 = ra.s + ra.r + 0.03, s1 = fa.s - fa.r - 0.03;
      if (s1 > s0) decal(kit, B, "trim", K.carbon, F, rect(s0, s1, sillY - 0.02, sillY + 0.05), 6, 1, 0.016, true);
    }
    // fuel filler flap on the left rear quarter
    if (sg > 0 && B.cab && sh.exhaust !== "none") {
      const fz = R.ra.s + R.ra.r * 0.9 + 0.12, fy = R.by - 0.12;
      if (fz < B.cab.sR + (B.cab.sF - B.cab.sR) * 0.5) decal(kit, B, "trim", 0x0a0b0d, F, ell(fz, fy, 0.075, 0.075), 8, 2, 0.0015);
    }
    // side indicator on the front fender
    if (fa.s + fa.r * 1.4 < B.xmax - 0.05) decal(kit, B, "head", K.amber, F, pill(fa.s + fa.r + 0.06, fa.s + fa.r + 0.14, fa.y + fa.r * 0.75, fa.y + fa.r * 0.75 + 0.022), 3, 1, 0.006);
  }
}

// ---------------------------------------------------------------- mirrors
export function mirrors(kit: Kit, B: Body) {
  const c = B.cab; if (!c) return;
  const by = B.beltY;
  // at the base of the A-pillar
  let s = c.sF - 0.12;
  for (const p of c.C) if (p.x > (c.sR + c.sF) / 2 && p.y - by > 0.07) s = Math.min(s, p.x);
  s = Math.max(s - 0.05, (c.sR + c.sF) / 2);
  for (const sg of [1, -1]) {
    const x = sg * (B.sideW(s, by) - 0.01);
    kit.geo("trim", box(0.09, 0.03, 0.07, x + sg * 0.03, by + 0.035, s), K.black);
    kit.geo("paint", sphere(0.1, x + sg * 0.12, by + 0.09, s - 0.02, 0.95, 0.6, 0.48, 8, 5));
    kit.geo("metal", box(0.15, 0.08, 0.008, x + sg * 0.12, by + 0.09, s - 0.066), 0x6b7380);
  }
}

// ---------------------------------------------------------------- top: stripes, vents, scoops
export function topDetails(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const T = fTop(B), c = B.cab, ex = new Set(sh.extras ?? []), liv = new Set(sh.livery ?? []);
  const stripes = sh.stripe || liv.has("stripes");
  if (stripes) {
    const bk: Bucket = sh.stripe && sh.stripe !== "accent" ? "trim" : "accent", colr = sh.stripe && sh.stripe !== "accent" ? sh.stripe : 0xffffff;
    const ranges: [number, number][] = c ? [[c.sF + 0.03, R.fx - 0.01], [c.rtS + 0.02, c.ftS - 0.02], [R.rx + 0.01, c.sR - 0.03]] : [[R.rx + 0.02, R.fx - 0.02]];
    for (const [z0, z1] of ranges) if (z1 - z0 > 0.1) for (const sg of [1, -1]) {
      const s = rect(z0, z1, 0.06, 0.18);
      decal(kit, B, bk, colr, T, sg > 0 ? s : mirV(s), Math.max(2, Math.round((z1 - z0) / 0.07)), 1, 0.006);
    }
  }
  if (liv.has("flames") && c) {
    for (const sg of [1, -1]) {
      const z0 = c.sF + 0.05, z1 = R.fx - 0.05;
      const fl: Shape = { u0: z0, u1: z1, vb: () => 0.05, vt: (u) => 0.12 + 0.28 * Math.pow(Math.abs(Math.sin(((u - z0) / (z1 - z0)) * Math.PI * 3.5)), 0.6) * ((u - z0) / (z1 - z0)) };
      decal(kit, B, "accent", 0xffffff, T, sg > 0 ? fl : mirV(fl), 18, 2, 0.004);
    }
  }
  if (ex.has("hoodvents") && c) {
    for (const sg of [1, -1]) {
      const z = lerp(c.sF, R.fx, 0.42), s = para(z - 0.16, z + 0.16, R.hw * 0.18, R.hw * 0.22, R.hw * 0.44, R.hw * 0.36);
      decal(kit, B, "trim", K.grille, T, sg > 0 ? s : mirV(s), 4, 2, 0.003);
      for (let k = 0; k < 4; k++) { const zz = z - 0.12 + k * 0.08; decal(kit, B, "trim", 0x25272c, T, sg > 0 ? rect(zz - 0.012, zz + 0.012, R.hw * 0.2, R.hw * 0.4) : mirV(rect(zz - 0.012, zz + 0.012, R.hw * 0.2, R.hw * 0.4)), 1, 2, 0.007); }
    }
  }
  if (ex.has("scoop") && c) {
    const z = lerp(c.sF, R.fx, 0.38), y = B.topLower(z) + B.crownAt(z);
    kit.geo("paint", box(0.5, 0.1, 0.62, 0, y + 0.03, z, 0.06));
    kit.geo("trim", box(0.42, 0.06, 0.02, 0, y + 0.05, z + 0.31), K.grille);
  }
}

// ---------------------------------------------------------------- spoilers
export function spoiler(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const sp = sh.spoiler ?? "none"; if (sp === "none") return;
  const W = B.W, c = B.cab;
  if (sp === "roof" && c) {
    // hatch roof spoiler over the rear glass
    const z = c.rtS + 0.02, y = B.cabTop(z) + c.crown * 0.5, w = B.cw(z, y) * 2 - 0.02;
    kit.geo("paint", box(w, 0.025, 0.3, 0, y + 0.01, z - 0.1, 0.1));
    for (const sg of [1, -1]) kit.geo("paint", box(0.025, 0.06, 0.3, sg * w / 2, y - 0.01, z - 0.1, 0.1));
    kit.geo("tail", box(0.32, 0.018, 0.02, 0, y - 0.01, z - 0.25));
    return;
  }
  const zEdge = R.rx + 0.1, yd = B.topLower(zEdge);
  if (sp === "lip" || sp === "duck") {
    if (B.inCabin(zEdge)) return;
    // raised lip hugging the boot edge
    const T = fTop(B), duck = sp === "duck";
    decal(kit, B, "paint", 0xffffff, T, rect(R.rx + 0.015, R.rx + (duck ? 0.2 : 0.11), -B.hwPlan(R.rx + 0.1) * 0.86, B.hwPlan(R.rx + 0.1) * 0.86), 8, 2, duck ? 0.045 : 0.028, true);
    return;
  }
  const big = sp === "gt" || sp === "swan";
  const wy = yd + (big ? Math.min(0.4, Math.max(0.24, ((c ? c.top : yd + 0.4) - yd) * 0.8)) : 0.2), wz = zEdge + 0.06;
  const ww = W * (big ? 1.0 : 0.86), chord = big ? 0.34 : 0.26;
  // aerofoil: two boxes give a cambered look
  kit.geo(big ? "trim" : "paint", box(ww, 0.035, chord, 0, wy, wz, -0.1), big ? K.carbon : 0xffffff);
  kit.geo(big ? "paint" : "trim", box(ww, 0.018, chord * 0.42, 0, wy + 0.05, wz - chord * 0.42, -0.35), big ? 0xffffff : K.carbon);
  for (const sg of [1, -1]) {
    // endplates & stands
    kit.geo(big ? "paint" : "trim", box(0.02, 0.17, chord * 1.25, sg * ww / 2, wy + 0.02, wz - 0.02), big ? 0xffffff : K.carbon);
    if (sp === "swan") {
      const a = V(sg * W * 0.24, wy + 0.06, wz + 0.03), b = V(sg * W * 0.24, yd + 0.02, wz + 0.22);
      kit.geo("trim", tube(a, b, 0.02, 5), K.carbon);
    } else {
      kit.geo("trim", box(0.025, wy - yd, 0.09, sg * W * 0.3, (wy + yd) / 2, wz + 0.02), K.carbon);
    }
  }
  if (R.lamps) kit.geo("tail", box(0.24, 0.016, 0.012, 0, wy - 0.02, wz - chord / 2 - 0.006));
}

// ---------------------------------------------------------------- exhausts → returns tips
export function exhausts(kit: Kit, B: Body, sh: CarShape, R: Ref, tier: number): { p: THREE.Vector3; d: THREE.Vector3 }[] {
  const st = sh.exhaust ?? (tier >= 3 ? "dual" : "single");
  const out: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
  const back = V(0, 0, -1);
  const tip = (x: number, y: number, r: number) => {
    const p = B.project(V(x, y, B.xmin - 1), V(0, 0, 1));
    const z = (p ? p.z : B.xmin) - 0.035;
    kit.geo("metal", cyl(r, 0.16, "z", x, y, z + 0.06, 12, true), K.chrome);
    kit.geo("metal", cyl(r * 1.08, 0.02, "z", x, y, z - 0.015, 12, true), K.chrome);
    kit.geo("trim", cyl(r * 0.85, 0.01, "z", x, y, z + 0.03, 10), 0x050505);
    out.push({ p: V(x, y, z - 0.02), d: back.clone() });
  };
  const y = R.ryb + 0.065, hw = R.hw;
  if (st === "single") tip(hw * 0.55, y, 0.045);
  else if (st === "dual") { tip(hw * 0.62, y, 0.05); tip(-hw * 0.62, y, 0.05); }
  else if (st === "quad") for (const x of [0.55, 0.72]) { tip(hw * x, y, 0.042); tip(-hw * x, y, 0.042); }
  else if (st === "center") { tip(0.08, y + 0.03, 0.05); tip(-0.08, y + 0.03, 0.05); }
  else if (st === "side") {
    for (const sg of [1, -1]) {
      const z0 = R.ra.s + R.ra.r + 0.05, z1 = R.fa.s - R.fa.r - 0.1, x = sg * (B.sideW(lerp(z0, z1, 0.5), B.sillY + 0.1) + 0.05);
      kit.geo("metal", cyl(0.055, z1 - z0, "z", x, B.sillY + 0.11, (z0 + z1) / 2, 10), K.chrome);
      out.push({ p: V(x, B.sillY + 0.11, z0 - 0.02), d: back.clone() });
    }
  } else if (st === "stack") {
    const c = B.cab, z = c ? c.sR - 0.12 : R.rx + 0.4, top = (c ? c.top : B.maxY) + 0.45;
    for (const sg of [1, -1]) {
      const x = sg * (B.W / 2 - 0.08);
      kit.geo("metal", cyl(0.07, top - B.beltY + 0.3, "y", x, (top + B.beltY - 0.3) / 2, z, 12), K.chrome);
      kit.geo("trim", cyl(0.06, 0.01, "y", x, top + 0.005, z, 10), 0x050505);
      out.push({ p: V(x, top + 0.02, z), d: V(0, 1, 0) });
    }
  } else if (st === "none") {
    // electric: nitro glow from the diffuser
    out.push({ p: V(hw * 0.3, R.ryb + 0.08, R.rx - 0.05), d: back.clone() }, { p: V(-hw * 0.3, R.ryb + 0.08, R.rx - 0.05), d: back.clone() });
  }
  return out;
}

// ---------------------------------------------------------------- liveries on the sides
export function liveries(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const liv = new Set(sh.livery ?? []);
  const by = R.by, fa = R.fa, ra = R.ra, sill = B.sillY;
  for (const sg of [1, -1]) {
    const F = fSide(B, sg);
    const strip = (v0: number, v1: number, b: Bucket, color: Col, s0 = R.rx + 0.08, s1 = R.fx - 0.12, scale = 1) => {
      // skip the wheel-arch openings
      const segs: [number, number][] = [];
      let cur = s0;
      for (const a of [ra, fa].sort((p, q) => p.s - q.s)) {
        const topA = a.y + a.r;
        if (v0 < topA + 0.02) { if (a.s - a.r - 0.03 > cur) segs.push([cur, a.s - a.r - 0.03]); cur = Math.max(cur, a.s + a.r + 0.03); }
      }
      if (s1 > cur) segs.push([cur, s1]);
      for (const [a, b2] of segs) if (b2 - a > 0.08) decal(kit, B, b, color, F, rect(a, b2, v0, v1), Math.max(2, Math.round((b2 - a) / 0.2)), 1, 0.003, false, scale);
    };
    if (liv.has("side")) strip(by - 0.07, by - 0.035, "accent", 0xffffff);
    if (liv.has("pin")) strip(by - 0.045, by - 0.035, "accent", 0xffffff);
    if (liv.has("twotone")) strip(sill + 0.02, lerp(sill, by, 0.42), "accent", 0xffffff);
    if (liv.has("fire")) { strip(lerp(sill, by, 0.45), lerp(sill, by, 0.45) + 0.08, "trim", 0xf4f1e6); strip(lerp(sill, by, 0.45) + 0.08, lerp(sill, by, 0.45) + 0.11, "trim", 0xffd22e); }
    if (liv.has("bus")) { strip(lerp(sill, by, 0.5), lerp(sill, by, 0.5) + 0.12, "accent", 0xffffff); strip(by - 0.05, by - 0.02, "trim", 0x16181d); }
    if (liv.has("checker")) {
      const y0 = lerp(sill, by, 0.62), n = 18, s0 = ra.s + ra.r * 0.2, s1 = fa.s - fa.r * 0.2;
      for (let k = 0; k < n; k++) for (const row of [0, 1]) if ((k + row) % 2 === 0) {
        const a = lerp(s0, s1, k / n), b2 = lerp(s0, s1, (k + 1) / n);
        decal(kit, B, "trim", 0x121316, F, rect(a, b2, y0 + row * 0.05, y0 + row * 0.05 + 0.05), 1, 1, 0.003);
      }
    }
    if (liv.has("police") && B.cab) {
      const s0 = Math.max(ra.s + ra.r + 0.08, B.cab.sR + 0.1), s1 = Math.min(fa.s - fa.r - 0.05, B.cab.sF);
      decal(kit, B, "accent", 0xffffff, F, rect(s0, s1, sill + 0.06, by - 0.03), 8, 4, 0.004);
      decal(kit, B, "trim", 0x1d4ed8, F, rect(s0 + 0.05, s1 - 0.05, lerp(sill, by, 0.55), lerp(sill, by, 0.55) + 0.06), 5, 1, 0.004);
    }
    if (liv.has("rally")) {
      const s0 = ra.s + ra.r + 0.05, s1 = fa.s - fa.r - 0.05;
      decal(kit, B, "accent", 0xffffff, F, para(s0, s1, sill + 0.05, sill + 0.05, by - 0.25, by - 0.04), 6, 2, 0.002);
    }
    if (liv.has("number") || sh.number != null) {
      const s = B.cab ? lerp(B.cab.sR, B.cab.sF, 0.5) : (fa.s + ra.s) / 2, v = lerp(sill, by, 0.55);
      decal(kit, B, "trim", 0xf4f1e6, F, ell(s, v, 0.17, 0.17), 10, 3, 0.004);
      digits(kit, B, F, sh.number ?? 7, s, v, sg);
    }
  }
}
/** 7-segment race numbers */
export function digits(kit: Kit, B: Body, F: Frame, n: number, cs: number, cv: number, sg: number) {
  const SEG = ["1111110", "0110000", "1101101", "1111001", "0110011", "1011011", "1011111", "1110000", "1111111", "1111011"];
  const str = String(n), w = 0.075, h = 0.14, t = 0.018, gap = 0.03;
  const total = str.length * w + (str.length - 1) * gap;
  str.split("").forEach((ch, i) => {
    const m = SEG[+ch] ?? SEG[0];
    // along the car the reading direction flips per side
    const x0 = cs - sg * (-total / 2 + i * (w + gap)), dir = -sg;
    const L = (a: number, b2: number) => [Math.min(x0 + dir * a, x0 + dir * b2), Math.max(x0 + dir * a, x0 + dir * b2)] as const;
    const segs: [number, number, number, number][] = [
      [0, w, h - t, h], [w - t, w, h / 2, h], [w - t, w, 0, h / 2], [0, w, 0, t], [0, t, 0, h / 2], [0, t, h / 2, h], [0, w, h / 2 - t / 2, h / 2 + t / 2],
    ];
    segs.forEach(([a, b2, v0, v1], k) => {
      if (m[k] !== "1") return;
      const [u0, u1] = L(a, b2);
      decal(kit, B, "trim", 0x121316, F, rect(u0, u1, cv - h / 2 + v0, cv - h / 2 + v1), 1, 1, 0.007);
    });
  });
}

// ---------------------------------------------------------------- roof gear & class extras
export function extras(kit: Kit, B: Body, sh: CarShape, R: Ref) {
  const ex = new Set(sh.extras ?? []), c = B.cab, W = B.W, hw = R.hw;
  const roofY = c ? c.top + c.crown : B.maxY;
  const roofS0 = c ? c.rtS : 0, roofS1 = c ? c.ftS : 0, roofMid = (roofS0 + roofS1) / 2;
  const roofHW = c ? B.cw(roofMid, c.top) - 0.06 : hw * 0.8;
  const out: { flashA?: boolean } = {};
  if (ex.has("roofbar") || ex.has("rack") || ex.has("rails")) {
    for (const sg of [1, -1]) {
      const x = sg * (roofHW - 0.02), z0 = roofS0 - 0.05, z1 = roofS1 + 0.02;
      kit.geo("metal", box(0.035, 0.03, z1 - z0, x, roofY + 0.05, (z0 + z1) / 2), ex.has("rack") ? 0x23262b : K.alu);
      for (const z of [z0 + 0.05, z1 - 0.05]) kit.geo("trim", box(0.04, 0.05, 0.06, x, roofY + 0.02, z), K.black);
    }
    if (ex.has("rack")) {
      for (let k = 0; k <= 4; k++) { const z = lerp(roofS0, roofS1, k / 4); kit.geo("metal", box(roofHW * 2, 0.025, 0.03, 0, roofY + 0.07, z), 0x23262b); }
      for (const sg of [1, -1]) kit.geo("metal", box(0.03, 0.09, roofS1 - roofS0, sg * (roofHW - 0.05), roofY + 0.11, roofMid), 0x23262b);
      // spot lamps on the rack
      for (const x of [-0.3, -0.1, 0.1, 0.3]) { kit.geo("trim", cyl(0.055, 0.06, "z", x * W, roofY + 0.14, roofS1 + 0.02, 8), K.black); kit.geo("head", cyl(0.045, 0.01, "z", x * W, roofY + 0.14, roofS1 + 0.055, 8), K.lamp, 1.2); }
    }
  }
  if (ex.has("lightbar")) {
    const z = roofMid + 0.05, y = roofY + 0.02;
    kit.geo("trim", box(roofHW * 1.7, 0.04, 0.2, 0, y + 0.02, z), K.black);
    kit.geo("flashA", box(roofHW * 0.8, 0.07, 0.17, -roofHW * 0.42, y + 0.075, z), 0xff2020);
    kit.geo("flashB", box(roofHW * 0.8, 0.07, 0.17, roofHW * 0.42, y + 0.075, z), 0x2060ff);
    kit.geo("metal", box(0.08, 0.07, 0.17, 0, y + 0.075, z), K.chrome);
    out.flashA = true;
  }
  if (ex.has("beacon")) {
    const z = roofMid, y = roofY;
    kit.geo("trim", cyl(0.07, 0.03, "y", 0, y + 0.015, z, 10), K.black);
    kit.geo("flashA", cyl(0.06, 0.1, "y", 0, y + 0.08, z, 10), 0xffa000);
    out.flashA = true;
  }
  if (ex.has("taxi")) {
    const z = roofMid - 0.05, y = roofY;
    kit.geo("trim", box(0.6, 0.03, 0.2, 0, y + 0.015, z), K.black);
    kit.geo("head", box(0.56, 0.15, 0.17, 0, y + 0.105, z), 0xffd23a, 1.1);
    kit.geo("trim", box(0.4, 0.06, 0.18, 0, y + 0.1, z), 0x151619);
  }
  if (ex.has("roofscoop") && c) {
    kit.geo("paint", box(0.36, 0.08, 0.4, 0, roofY + 0.035, roofMid + 0.05));
    kit.geo("trim", box(0.3, 0.05, 0.02, 0, roofY + 0.04, roofMid + 0.25), K.grille);
  }
  if (ex.has("horns") && c) for (const sg of [1, -1]) kit.geo("metal", cyl(0.035, 0.42, "z", sg * 0.22, roofY + 0.06, roofS1 - 0.2, 10, false, 0.012), K.chrome);
  if (ex.has("visor") && c) { const yv = B.cabTop(roofS1) - 0.03; kit.geo("paint", box(B.cw(roofS1, yv) * 2 + 0.04, 0.03, 0.26, 0, yv, roofS1 + 0.12, -0.18)); }
  // ---- front gear
  const fz = R.fx;
  if (ex.has("bullbar") || ex.has("pushbar")) {
    const pb = ex.has("pushbar"), y0 = R.fyb + 0.08, y1 = Math.min(R.hy + (pb ? 0.1 : 0.05), R.fyn + 0.05), bw = W * (pb ? 0.42 : 0.78) / 2, z = fz + 0.1;
    const tc = pb ? K.black : K.chrome, bk: Bucket = pb ? "trim" : "metal";
    for (const sg of [1, -1]) kit.geo(bk, tube(V(sg * bw, y0, z), V(sg * bw, y1, z), 0.03, 7), tc);
    kit.geo(bk, tube(V(-bw, y1, z), V(bw, y1, z), 0.03, 7), tc);
    kit.geo(bk, tube(V(-bw, lerp(y0, y1, 0.45), z + 0.02), V(bw, lerp(y0, y1, 0.45), z + 0.02), 0.03, 7), tc);
    if (pb) kit.geo("trim", box(bw * 2, 0.12, 0.02, 0, lerp(y0, y1, 0.75), z), 0x1d1e22);
  }
  if (ex.has("lightpod")) {
    const y = R.fyn + 0.02, z = fz - 0.25;
    kit.geo("trim", box(W * 0.7, 0.12, 0.05, 0, y + 0.05, z), K.black);
    for (let k = 0; k < 4; k++) { const x = (-0.75 + k * 0.5) * W * 0.32; kit.geo("metal", cyl(0.06, 0.04, "z", x, y + 0.06, z + 0.03, 12), K.chrome); kit.geo("head", cyl(0.05, 0.01, "z", x, y + 0.06, z + 0.052, 12), K.lamp, 1.3); }
  }
  if (ex.has("towhook")) kit.geo("trim", box(0.05, 0.04, 0.1, hw * 0.55, R.fyb + 0.06, fz + 0.04), 0xe8322b);
  if (ex.has("snorkel") && c) {
    const zA = c.sF - 0.02, x0 = B.sideW(zA, R.by - 0.1) + 0.035, zT = zA - 0.3, xT = B.cw(zT, c.top - 0.05) + 0.06;
    kit.geo("trim", tube(V(x0, R.by - 0.25, zA + 0.05), V(x0, R.by + 0.02, zA), 0.045, 8), K.black);
    kit.geo("trim", tube(V(x0, R.by + 0.02, zA), V(xT, c.top - 0.04, zT), 0.045, 8), K.black);
    kit.geo("trim", box(0.11, 0.1, 0.15, xT, c.top + 0.0, zT - 0.02), K.black);
  }
  // ---- rear gear
  if (ex.has("spare")) {
    const y = lerp(R.ryb, Math.max(R.ryc, R.ryn), 0.55), z = R.rx - 0.12, r = Math.min(0.36, (B.maxY - R.ryb) * 0.32);
    kit.geo("trim", cyl(r, 0.22, "z", 0, y, z, 16), K.rubber);
    kit.geo("metal", cyl(r * 0.6, 0.02, "z", 0, y, z - 0.111, 12), K.alu);
    kit.geo("paint", cyl(r * 0.92, 0.012, "z", 0, y, z - 0.115, 16));
  }
  if (ex.has("mudflaps")) for (const a of [R.fa, R.ra]) for (const sg of [1, -1]) {
    const x = sg * (B.sideW(a.s, a.y) - 0.12);
    kit.geo("trim", box(0.2, 0.22, 0.012, x, a.y - a.r * 0.5 + 0.02, a.s - a.r * 0.95), a === R.ra ? 0xe8322b : K.black);
  }
  if (ex.has("sidepipes")) for (const sg of [1, -1]) {
    const z0 = R.ra.s + R.ra.r + 0.04, z1 = R.fa.s - R.fa.r - 0.04;
    kit.geo("metal", cyl(0.05, z1 - z0, "z", sg * (B.sideW((z0 + z1) / 2, B.sillY + 0.1) + 0.045), B.sillY + 0.08, (z0 + z1) / 2, 10), K.chrome);
  }
  if (ex.has("chromebumpers")) {
    kit.geo("metal", box(W * 0.8, 0.065, 0.06, 0, R.fyb + 0.09, fz + 0.03), K.chrome);
    kit.geo("metal", box(W * 0.8, 0.065, 0.06, 0, R.ryb + 0.09, R.rx - 0.03), K.chrome);
    for (const sg of [1, -1]) { kit.geo("metal", box(0.05, 0.12, 0.06, sg * W * 0.25, R.fyb + 0.13, fz + 0.04), K.chrome); kit.geo("metal", box(0.05, 0.12, 0.06, sg * W * 0.25, R.ryb + 0.13, R.rx - 0.04), K.chrome); }
  }
  if (ex.has("louvres") && c) {
    for (let k = 1; k < 7; k++) {
      const z = lerp(c.sR, c.rtS, k / 7), y = B.cabTop(z) + 0.012;
      kit.geo("trim", box(B.cw(z, y) * 1.85, 0.015, 0.035, 0, y, z), K.black);
    }
  }
  // ---- class extras
  if (ex.has("intake")) for (const sg of [1, -1]) {
    // a scoop that narrows towards the door
    const F = fSide(B, sg), s0 = R.ra.s + R.ra.r + 0.05, s1 = s0 + Math.min(0.55, B.hl * 0.25), yT = R.by - 0.035, yB = Math.max(B.sillY + 0.12, R.by - 0.3);
    const sh2 = para(s0, s1, yB, yT - 0.07, yT, yT);
    decal(kit, B, "trim", K.grille, F, sh2, 5, 2, 0.003, true);
    decal(kit, B, "trim", 0x2a2d33, F, para(s0 + 0.03, s1 - 0.12, lerp(yB, yT, 0.45), yT - 0.06, lerp(yB, yT, 0.45) + 0.012, yT - 0.048), 3, 1, 0.006);
  }
  if (ex.has("sharkfin") && c) {
    const zA = Math.max(c.sR + 0.06, lerp(c.rtS, R.rx, 0.25)), zB = R.rx + 0.3;
    const A = V(0, B.cabTop(zA) + c.crown * 0.8 - 0.005, zA), Bp = V(0, Math.max(B.topLower(zB), B.cabTop(zB)) + B.crownAt(zB) + 0.09, zB);
    const A2 = V(0, A.y - 0.06, A.z + 0.08), B2 = V(0, Bp.y - 0.12, Bp.z);
    for (const sg of [1, -1]) {
      const o = (p: THREE.Vector3) => V(sg * 0.008, p.y, p.z);
      if (sg > 0) kit.quad("paint", o(A2), o(B2), o(Bp), o(A), 0xffffff); else kit.quad("paint", o(A2), o(A), o(Bp), o(B2), 0xffffff);
    }
    kit.quad("paint", V(0.008, A.y, A.z), V(0.008, Bp.y, Bp.z), V(-0.008, Bp.y, Bp.z), V(-0.008, A.y, A.z), 0xffffff);
  }
  if (ex.has("ac") && c) kit.geo("trim", box(roofHW * 1.1, 0.24, 1.9, 0, roofY + 0.1, lerp(c.rtS, c.ftS, 0.3)), 0xd9dde3);
  if (ex.has("destination") && c) {
    kit.geo("trim", box(roofHW * 1.6, 0.22, 0.05, 0, c.top - 0.16, R.fx + 0.005), 0x0b0c0f);
    for (let k = 0; k < 7; k++) kit.geo("head", box(0.12, 0.08, 0.01, -0.45 + k * 0.15, c.top - 0.16, R.fx + 0.033), K.amber, 1.2);
  }
  if (ex.has("busdoor")) {
    const F = fSide(B, -1), s0 = R.fa.s + R.fa.r + 0.12, s1 = Math.min(s0 + 1.05, R.fx - 0.25), top = c ? c.top - 0.22 : R.by + 0.6, bot = B.sillY + 0.06;
    decal(kit, B, "metal", 0x2a2d33, F, rect(s0, s1, bot, top), 4, 4, 0.006, true);
    for (const [a, b2] of [[s0 + 0.04, (s0 + s1) / 2 - 0.02], [(s0 + s1) / 2 + 0.02, s1 - 0.04]]) decal(kit, B, "glass", 0xffffff, F, rect(a, b2, bot + 0.08, top - 0.06), 2, 4, 0.01);
  }
  if (ex.has("tanks")) for (const sg of [1, -1]) {
    const z0 = R.ra.s + R.ra.r + 0.15, z1 = R.fa.s - R.fa.r - 0.15, x = sg * (B.W / 2 - 0.24);
    if (z1 - z0 > 0.4) {
      kit.geo("metal", cyl(0.27, z1 - z0, "z", x, 0.72, (z0 + z1) / 2, 14), K.chrome);
      for (const z of [z0 + 0.12, z1 - 0.12]) kit.geo("trim", cyl(0.285, 0.05, "z", x, 0.72, z, 14), 0x1b1c20);
      kit.geo("trim", box(0.38, 0.04, 0.3, sg * (B.W / 2 - 0.2), 0.42, z1 + 0.05), 0x1b1c20);
    }
  }
  if (ex.has("fifth")) {
    const z0 = R.rx + 0.05, z1 = c ? c.sR - 0.08 : R.rx + 2, y = B.topLower((z0 + z1) / 2);
    kit.geo("trim", box(B.W * 0.82, 0.02, z1 - z0, 0, y + 0.01, (z0 + z1) / 2), 0x16171a);
    kit.geo("trim", cyl(0.55, 0.1, "y", 0, y + 0.06, lerp(z0, z1, 0.55), 18), 0x2b2d33);
    kit.geo("metal", cyl(0.12, 0.12, "y", 0, y + 0.08, lerp(z0, z1, 0.55) - 0.25, 10), K.chrome);
    for (const sg of [1, -1]) {
      kit.geo("trim", box(0.5, 0.42, 0.015, sg * (B.W / 2 - 0.3), 0.42, R.rx + 0.03), K.black);
      kit.geo("tail", box(0.14, 0.07, 0.03, sg * (B.W / 2 - 0.2), y - 0.08, R.rx - 0.02));
    }
  }
  if (ex.has("cone") && c) {
    const z = lerp(c.sR, c.sF, 0.3), y = roofY;
    kit.geo("trim", cyl(0.3, 0.06, "y", 0, y + 0.03, z, 12), 0xd9dde3);
    const cone = new THREE.ConeGeometry(0.38, 0.85, 12, 1, true); cone.rotateX(Math.PI); cone.translate(0, y + 0.06 + 0.425, z);
    kit.geo("trim", cone, 0xd9a35b);
    kit.geo("trim", sphere(0.36, 0, y + 0.95, z, 1, 0.85, 1, 12, 8), 0xff9cc2);
    kit.geo("trim", sphere(0.3, 0, y + 1.2, z, 1, 0.85, 1, 12, 8), 0xfff4e0);
    kit.geo("trim", sphere(0.22, 0, y + 1.42, z, 1, 0.85, 1, 10, 7), 0x7b4a2e);
    kit.geo("trim", sphere(0.07, 0.02, y + 1.6, z, 1, 1, 1, 8, 6), 0xe0202a);
    const spr = [0xff3b3b, 0x3bb4ff, 0xffd23a, 0x6ee06e];
    for (let k = 0; k < 10; k++) { const a = k * 2.4, r = 0.3; kit.geo("trim", box(0.06, 0.02, 0.02, Math.cos(a) * r * 0.8, y + 0.98 + (k % 3) * 0.12, z + Math.sin(a) * r * 0.8, 0, a, 0.5), spr[k % 4]); }
  }
  if ((ex.has("serving") || ex.has("awning")) && c) {
    const F = fSide(B, 1), s0 = lerp(c.sR, c.sF, 0.18), s1 = lerp(c.sR, c.sF, 0.58), y0 = R.by + 0.1, y1 = R.by + 0.62;
    if (ex.has("serving")) {
      decal(kit, B, "glass", 0xffffff, F, rect(s0, s1, y0, y1), 4, 2, 0.006);
      frameStrips(kit, B, F, rect(s0, s1, y0, y1), 0.03, "metal", K.chrome, 0.01);
      kit.geo("metal", box(0.2, 0.03, s1 - s0, B.cw((s0 + s1) / 2, y0) + 0.1, y0 - 0.02, (s0 + s1) / 2), K.alu);
    }
    if (ex.has("awning")) {
      const n = 9, x0 = B.cw((s0 + s1) / 2, y1) + 0.01;
      for (let k = 0; k < n; k++) {
        const z = lerp(s0 - 0.05, s1 + 0.05, (k + 0.5) / n);
        kit.geo("trim", box(0.5, 0.02, (s1 - s0 + 0.1) / n, x0 + 0.22, y1 + 0.08, z, 0, 0, -0.42), k % 2 ? 0xf4f1e6 : 0xff6f91);
      }
    }
  }
  if (ex.has("fin") && c) kit.geo("trim", box(0.012, 0.08, 0.3, 0, roofY + 0.03, roofS0 - 0.05), K.carbon);
  if (!ex.has("nowipers") && c && sh.kind !== "formula") for (const sg of [1, -1]) {
    const z = c.sF - 0.06, y = B.beltY + 0.03;
    kit.geo("trim", box(0.5, 0.015, 0.02, sg * 0.24, y, z, 0, sg * 0.15, 0), K.black);
  }
  return out;
}
