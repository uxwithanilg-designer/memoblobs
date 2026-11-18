// Momo Escape 3D models — glossy clay toys built in code with vertex colours, sized in grid cells (1 = one cell).
// Characters face the camera (+z); everything is centred on its own origin unless noted.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { krankyKrab, merge, tint } from "../../crowd/models";
import * as BM from "../../boing/models";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const cyl = (r0: number, r1: number, h: number, n = 16) => new THREE.CylinderGeometry(r0, r1, h, n);
export const rbox = (w: number, h: number, d: number, r = 0.08, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)));

// ------------------------------------------------------------------ Momo (rigged: the renderer moves eyes, feet, arms, sprout)
export interface MomoRig {
  /** the clay body, white: the material colour is the character colour */ skin: G;
  /** belly, cheeks, smile (fixed colours) */ face: G;
  /** eye whites */ whites: G;
  /** pupils + sparkles (moved to look around) */ pupils: G;
  /** eyelids for blinking (scaled from 0) */ lids: G;
  brows: G;
  /** one sneaker, origin at the ankle */ foot: G;
  /** one arm, origin at the shoulder */ arm: G;
  /** sprout, origin at its base */ sprout: G;
  /** body radius (half the height of the egg) */ R: number;
}
export function momoRig(): MomoRig {
  const R = 0.33;
  const skin = sq(sphere(R, 32, 24), 1.02, 1.08, 0.94);
  const f: G[] = [];
  f.push(tint(at(sq(sphere(0.22, 24, 18), 1.05, 0.95, 0.5), 0, -0.11, 0.19), "#FFE9CC"));
  for (const sx of [-1, 1]) f.push(tint(at(sq(sphere(0.055, 12, 10), 1.4, 0.75, 0.45), sx * 0.2, -0.02, 0.245), "#FF8FA3"));
  // open happy mouth: dark half-disc with a pink tongue
  const mouth = new THREE.CircleGeometry(0.075, 18, Math.PI, Math.PI); mouth.translate(0, -0.035, 0.316); f.push(tint(mouth, "#5A1F14"));
  const tongue = new THREE.CircleGeometry(0.04, 14, Math.PI, Math.PI); tongue.scale(1, 0.7, 1); tongue.translate(0, -0.085, 0.318); f.push(tint(tongue, "#FF6F7F"));
  const face = merge(f);
  const w: G[] = [], p: G[] = [], l: G[] = [], b: G[] = [];
  for (const sx of [-1, 1]) {
    w.push(tint(at(sq(sphere(0.105, 20, 16), 0.9, 1.15, 0.6), sx * 0.115, 0.09, 0.24), "#FFFFFF"));
    p.push(tint(at(sq(sphere(0.068, 16, 12), 1, 1.15, 0.45), sx * 0.11, 0.08, 0.285), "#1B1530"));
    p.push(tint(at(sphere(0.022, 8, 6), sx * 0.11 - 0.024, 0.118, 0.312), "#FFFFFF"));
    p.push(tint(at(sphere(0.011, 6, 4), sx * 0.11 + 0.024, 0.052, 0.312), "#FFFFFF"));
    l.push(tint(at(sq(sphere(0.108, 16, 10), 0.92, 1.17, 0.8), sx * 0.115, 0.09, 0.255), "#FFFFFF"));
    const brow = new THREE.CapsuleGeometry(0.016, 0.07, 4, 8); brow.rotateZ(Math.PI / 2 + sx * -0.22); brow.translate(sx * 0.12, 0.235, 0.27); b.push(tint(brow, "#5A2A1A"));
  }
  const foot: G[] = [];
  foot.push(tint(at(rbox(0.14, 0.05, 0.2, 0.024), 0, -0.025, 0.02), "#FFFFFF"));
  foot.push(tint(at(sq(sphere(0.085, 16, 12), 0.92, 0.66, 1.32), 0, 0.02, 0.025), "#FF3D5E"));
  foot.push(tint(at(sq(sphere(0.045, 10, 8), 1.1, 0.7, 0.8), 0, 0.012, 0.12), "#FFFFFF"));
  const arm = new THREE.CapsuleGeometry(0.04, 0.1, 4, 10); arm.translate(0, -0.07, 0);
  const hand = at(sphere(0.05, 12, 10), 0, -0.15, 0);
  const s: G[] = [];
  s.push(tint(at(cyl(0.014, 0.02, 0.11, 8), 0, 0.055, 0), "#3E9E3E"));
  for (const sx of [-1, 1]) { const leaf = sphere(1, 14, 10); leaf.scale(0.1, 0.028, 0.055); leaf.rotateZ(sx * 0.5); leaf.translate(sx * 0.075, 0.118, 0); s.push(tint(leaf, "#5CCB52")); }
  return {
    skin, face, whites: merge(w), pupils: merge(p), lids: merge(l), brows: merge(b),
    foot: merge(foot), arm: merge([tint(arm, "#FFFFFF"), tint(hand, "#FFFFFF")]), sprout: merge(s), R,
  };
}

/** a roller friend from the other MOMOBLOBS games, scaled to Momo's size and centred */
export function friendBody(id: string): G | null {
  const make: Record<string, () => G> = { pip: BM.pip, zib: BM.zib, bolt: BM.bolt, gloop: BM.gloop, bonbon: BM.bonbon, hoot: BM.hoot, turbo: BM.turbo, noodle: BM.noodle, tiki: BM.tiki, kranky: krankyKrab };
  const fn = make[id];
  if (!fn) return null;
  const g = fn();
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  const k = 0.72 / size;
  g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  g.scale(k, k, k);
  return g;
}

// ------------------------------------------------------------------ pickups
/** gold coin, facing the camera, radius 0.2 */
export function coin(): G {
  const p: G[] = [];
  const disc = cyl(0.2, 0.2, 0.06, 24); disc.rotateX(Math.PI / 2); p.push(tint(disc, "#FFC21A"));
  const rim = new THREE.TorusGeometry(0.19, 0.026, 6, 24); p.push(tint(rim, "#FFE27A"));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.05 : 0.11; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (const side of [1, -1]) { const st = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }); if (side < 0) st.rotateY(Math.PI); st.translate(0, 0, side * 0.03); p.push(tint(st, "#FFF2B0")); }
  return merge(p);
}
/** a brilliant-cut gem, white (instance colour tints it), ~0.42 tall */
export function gem(): G {
  const crown = cyl(0.12, 0.21, 0.1, 8); crown.translate(0, 0.05, 0);
  const pav = new THREE.ConeGeometry(0.21, 0.27, 8); pav.rotateX(Math.PI); pav.translate(0, -0.135, 0);
  const table = cyl(0.12, 0.12, 0.012, 8); table.translate(0, 0.105, 0);
  const g = merge([tint(crown, "#FFFFFF"), tint(pav, "#FFFFFF"), tint(table, "#FFFFFF")]);
  g.translate(0, 0.04, 0);
  return g;
}
function heartShape(s: number) {
  const h = new THREE.Shape();
  h.moveTo(0, -s * 0.9);
  h.bezierCurveTo(-s * 1.6, s * 0.2, -s * 0.6, s * 1.3, 0, s * 0.45);
  h.bezierCurveTo(s * 0.6, s * 1.3, s * 1.6, s * 0.2, 0, -s * 0.9);
  return h;
}
/** puffy heart, ~0.4 wide */
export function heart(color = "#FF3D6E"): G {
  const g = new THREE.ExtrudeGeometry(heartShape(0.16), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4, curveSegments: 18 });
  g.translate(0, 0, -0.04);
  return merge([tint(g, color)]);
}
export function key(): G {
  const p: G[] = [];
  const bow = new THREE.TorusGeometry(0.085, 0.032, 10, 24); bow.translate(-0.13, 0, 0); p.push(tint(bow, "#FFC21A"));
  const shaft = cyl(0.026, 0.026, 0.26, 10); shaft.rotateZ(Math.PI / 2); shaft.translate(0.05, 0, 0); p.push(tint(shaft, "#FFC21A"));
  for (const x of [0.12, 0.17]) p.push(tint(at(rbox(0.035, 0.08, 0.04, 0.01, 2), x, -0.04, 0), "#FFC21A"));
  p.push(tint(at(sphere(0.03, 10, 8), -0.13, 0, 0), "#FFE27A"));
  return merge(p);
}
/** lightning bolt (booster) */
export function bolt(): G {
  const s = new THREE.Shape();
  const pts: [number, number][] = [[0.04, 0.2], [-0.1, -0.01], [-0.01, -0.01], [-0.05, -0.2], [0.1, 0.03], [0.01, 0.03]];
  s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
  g.translate(0, 0, -0.025);
  return merge([tint(g, "#FFE03D")]);
}
/** the icon inside a power bubble */
export function powerIcon(k: string): G {
  const p: G[] = [];
  switch (k) {
    case "shield": { const r = new THREE.TorusGeometry(0.11, 0.035, 10, 24); p.push(tint(r, "#FFFFFF")); p.push(tint(at(sphere(0.05, 12, 10), 0, 0, 0), "#FFFFFF")); break; }
    case "ghost": {
      p.push(tint(at(sphere(0.1, 16, 12), 0, 0.03, 0), "#FFFFFF"));
      const b = cyl(0.1, 0.1, 0.09, 16); b.translate(0, -0.02, 0); p.push(tint(b, "#FFFFFF"));
      for (const x of [-0.065, 0, 0.065]) p.push(tint(at(sphere(0.035, 8, 6), x, -0.07, 0), "#FFFFFF"));
      for (const sx of [-1, 1]) p.push(tint(at(sphere(0.018, 6, 4), sx * 0.035, 0.05, 0.09), "#1B1530"));
      break;
    }
    case "slowmo": {
      const face = cyl(0.12, 0.12, 0.04, 24); face.rotateX(Math.PI / 2); p.push(tint(face, "#FFFFFF"));
      const h1 = rbox(0.02, 0.09, 0.02, 0.008, 2); h1.translate(0, 0.04, 0.03); p.push(tint(h1, "#1B1530"));
      const h2 = rbox(0.07, 0.02, 0.02, 0.008, 2); h2.translate(0.03, 0, 0.03); p.push(tint(h2, "#1B1530"));
      break;
    }
    default: {
      const u = new THREE.TorusGeometry(0.085, 0.04, 10, 18, Math.PI); u.rotateZ(Math.PI); p.push(tint(u, "#E8504F"));
      for (const sx of [-1, 1]) p.push(tint(at(rbox(0.08, 0.06, 0.08, 0.015, 2), sx * 0.085, 0.03, 0), "#E6EEF5"));
    }
  }
  return merge(p);
}
export function switchBox(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.4, 0.14, 0.4, 0.05), 0, -0.1, 0), "#3A3550"));
  const dome = new THREE.SphereGeometry(0.13, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, -0.03, 0); p.push(tint(dome, "#FF3D3D"));
  return merge(p);
}
export function buddyCage(): G {
  const p: G[] = [];
  p.push(tint(at(sphere(0.15, 18, 14), 0, -0.05, 0), "#9BE34A"));
  for (const sx of [-1, 1]) { p.push(tint(at(sphere(0.04, 10, 8), sx * 0.055, -0.02, 0.13), "#FFFFFF")); p.push(tint(at(sphere(0.022, 8, 6), sx * 0.055, -0.02, 0.16), "#1B1530")); }
  for (const y of [-0.24, 0.24]) { const ring = new THREE.TorusGeometry(0.24, 0.02, 6, 24); ring.rotateX(Math.PI / 2); ring.translate(0, y, 0); p.push(tint(ring, "#C9CED8")); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const bar = cyl(0.012, 0.012, 0.48, 6); bar.translate(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24); p.push(tint(bar, "#C9CED8")); }
  return merge(p);
}
export function vend(cool: string): G {
  const p: G[] = [];
  p.push(tint(rbox(0.56, 0.78, 0.4, 0.07), cool));
  p.push(tint(at(rbox(0.4, 0.34, 0.06, 0.03), 0, 0.12, 0.19), "#E8F6FF"));
  const h = heart("#FF3D6E"); h.scale(0.55, 0.55, 0.55); h.translate(0, 0.12, 0.24); p.push(h);
  p.push(tint(at(rbox(0.2, 0.06, 0.06, 0.02, 2), 0, -0.22, 0.2), "#1B1530"));
  return merge(p);
}

// ------------------------------------------------------------------ hazards
/** laser emitter block, lens towards +y */
export function emitter(): G {
  const p: G[] = [];
  p.push(tint(rbox(0.3, 0.3, 0.5, 0.07), "#3A3550"));
  p.push(tint(at(cyl(0.09, 0.11, 0.06, 16), 0, 0.16, 0), "#C9CED8"));
  return merge(p);
}
/** spinning saw blade (radius 1, faces the camera) */
export function saw(): G {
  const s = new THREE.Shape();
  const n = 18;
  for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 1 : 0.8; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.18, 0, Math.PI * 2, true); s.holes.push(hole);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 8 });
  blade.translate(0, 0, -0.04);
  const hub = cyl(0.24, 0.24, 0.2, 18); hub.rotateX(Math.PI / 2);
  return merge([tint(blade, "#D9DEE8"), tint(hub, "#3A3550")]);
}
/** spike ball (radius 1): body white (tinted per skin), spikes separate colour */
export function spikeBall(spikes: string, body: string): G {
  const p: G[] = [tint(sphere(0.82, 24, 18), body)];
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; dirs.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  for (const z of [-1, 1]) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; dirs.push(new THREE.Vector3(Math.cos(a) * 0.6, Math.sin(a) * 0.6, z * 0.8).normalize()); }
  for (const d of dirs) {
    const c = new THREE.ConeGeometry(0.2, 0.5, 10); c.translate(0, 0.95, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
    p.push(tint(c, spikes));
  }
  return merge(p);
}
/** the angry face of a Grumpy, on a radius-1 ball */
export function grumpyFace(): G {
  const p: G[] = [];
  for (const sx of [-1, 1]) {
    p.push(tint(at(sq(sphere(0.24, 14, 10), 1, 0.85, 0.5), sx * 0.32, 0.08, 0.7), "#FFFFFF"));
    p.push(tint(at(sq(sphere(0.12, 10, 8), 1, 1, 0.5), sx * 0.29, 0.06, 0.8), "#1B1530"));
    const brow = rbox(0.42, 0.1, 0.1, 0.04, 2); brow.rotateZ(sx * -0.45); brow.translate(sx * 0.32, 0.38, 0.74); p.push(tint(brow, "#2A2140"));
  }
  const frown = new THREE.TorusGeometry(0.2, 0.05, 6, 14, Math.PI); frown.translate(0, -0.42, 0.74); p.push(tint(frown, "#2A2140"));
  return merge(p);
}
export function drone(): { body: G; rotor: G } {
  const p: G[] = [];
  p.push(tint(rbox(1.6, 0.5, 0.9, 0.2), "#3A3550"));
  for (const sx of [-1, 1]) p.push(tint(at(cyl(0.06, 0.06, 0.4, 8), sx * 0.8, 0.35, 0), "#3A3550"));
  p.push(tint(at(sphere(0.26, 16, 12), 0, 0, 0.4), "#1B1530"));
  const rotor = rbox(0.9, 0.05, 0.16, 0.025, 2);
  return { body: merge(p), rotor: merge([tint(rotor, "#C9CED8")]) };
}
export function bot(): G {
  const p: G[] = [];
  p.push(tint(rbox(1.5, 1.4, 1.1, 0.25), "#C9CED8"));
  p.push(tint(at(rbox(1.1, 0.45, 0.2, 0.12), 0, 0.15, 0.5), "#1B1530"));
  p.push(tint(at(cyl(0.04, 0.04, 0.45, 8), 0, 0.92, 0), "#3A3550"));
  p.push(tint(at(sphere(0.12, 10, 8), 0, 1.15, 0), "#FF3D3D"));
  for (const sx of [-1, 1]) p.push(tint(at(rbox(0.3, 0.5, 0.5, 0.1), sx * 0.85, -0.2, 0), "#3A3550"));
  return merge(p);
}
export function barrel(): G {
  const p: G[] = [];
  const b = cyl(0.92, 0.92, 1.3, 24); b.rotateX(Math.PI / 2); p.push(tint(b, "#C9925A"));
  for (const z of [-0.45, 0.45]) { const r = new THREE.TorusGeometry(0.93, 0.07, 8, 28); r.translate(0, 0, z); p.push(tint(r, "#6B4A2E")); }
  const lid = cyl(0.8, 0.8, 0.02, 24); lid.rotateX(Math.PI / 2); lid.translate(0, 0, 0.66); p.push(tint(lid, "#A8743F"));
  for (let i = 0; i < 4; i++) { const plank = rbox(0.06, 1.6, 0.02, 0.01, 1); plank.rotateZ((i / 4) * Math.PI); plank.translate(0, 0, 0.67); p.push(tint(plank, "#7A5230")); }
  return merge(p);
}
export function turret(): G {
  const p: G[] = [];
  const base = cyl(0.26, 0.3, 0.16, 18); p.push(tint(base, "#3A3550"));
  p.push(tint(at(sphere(0.2, 16, 12), 0, 0.12, 0), "#5A5570"));
  const barrel = cyl(0.08, 0.1, 0.34, 14); barrel.translate(0, 0.3, 0); p.push(tint(barrel, "#2A2540"));
  const muzzle = new THREE.TorusGeometry(0.09, 0.03, 8, 16); muzzle.rotateX(Math.PI / 2); muzzle.translate(0, 0.47, 0); p.push(tint(muzzle, "#C9CED8"));
  return merge(p);
}
/** a spike strip on a wall face: base at y = 0 along x ∈ [−0.45, 0.45], tips at y = 1 (scaled by the renderer), 3 × 2 cones */
export function spikeStrip(): G {
  const p: G[] = [];
  for (let i = 0; i < 3; i++) for (const z of [-0.28, 0.28]) { const c = new THREE.ConeGeometry(0.15, 1, 10); c.translate(-0.3 + i * 0.3, 0.5, z); p.push(tint(c, "#FFFFFF")); }
  const base = rbox(0.92, 0.06, 0.92, 0.02, 2); base.translate(0, 0.03, 0); p.push(tint(base, "#3A3550"));
  return merge(p);
}
export function bumper(): G {
  const p: G[] = [];
  const body = cyl(0.2, 0.22, 0.7, 24); body.rotateX(Math.PI / 2); p.push(tint(body, "#FF8A3D"));
  for (const z of [0.36, -0.36]) { const ring = new THREE.TorusGeometry(0.21, 0.045, 10, 24); ring.translate(0, 0, z); p.push(tint(ring, "#FFFFFF")); }
  const cap = sphere(0.16, 16, 10); cap.scale(1, 1, 0.4); cap.translate(0, 0, 0.38); p.push(tint(cap, "#FFD23F"));
  return merge(p);
}
export function padRing(): G {
  const p: G[] = [];
  const disc = cyl(0.4, 0.42, 0.06, 28); p.push(tint(disc, "#5A3FA8"));
  const ring = new THREE.TorusGeometry(0.36, 0.05, 10, 32); ring.rotateX(Math.PI / 2); ring.translate(0, 0.04, 0); p.push(tint(ring, "#C9A8FF"));
  return merge(p);
}

// ------------------------------------------------------------------ wall decor (on the back wall)
export function decor(k: string, cool: string, shade: string, hot: string): G | null {
  const p: G[] = [];
  switch (k) {
    case "sign": {
      p.push(tint(rbox(0.62, 0.38, 0.06, 0.05), cool));
      const s = new THREE.Shape(); s.moveTo(-0.16, 0.05); s.lineTo(0.04, 0.05); s.lineTo(0.04, 0.12); s.lineTo(0.18, 0); s.lineTo(0.04, -0.12); s.lineTo(0.04, -0.05); s.lineTo(-0.16, -0.05); s.closePath();
      const a = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }); a.translate(0, 0, 0.03); p.push(tint(a, "#FFFFFF"));
      break;
    }
    case "vent": { p.push(tint(rbox(0.6, 0.5, 0.06, 0.05), shade)); for (let i = -2; i <= 2; i++) p.push(tint(at(rbox(0.5, 0.04, 0.04, 0.015, 1), 0, i * 0.085, 0.04), "#1B1530")); break; }
    case "screen": { p.push(tint(rbox(0.7, 0.52, 0.08, 0.05), "#1A1030")); p.push(tint(at(cyl(0.14, 0.14, 0.02, 20).rotateX(Math.PI / 2), 0, 0, 0.05), "#E8504F")); break; }
    case "alarm": { const d = new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); d.rotateX(Math.PI / 2); p.push(tint(d, hot)); p.push(tint(at(cyl(0.2, 0.2, 0.04, 18).rotateX(Math.PI / 2), 0, 0, 0), "#3A3550")); break; }
    case "crate": { p.push(tint(rbox(0.56, 0.56, 0.5, 0.04), "#C9925A")); for (const r of [Math.PI / 4, -Math.PI / 4]) { const pl = rbox(0.7, 0.07, 0.03, 0.01, 1); pl.rotateZ(r); pl.translate(0, 0, 0.26); p.push(tint(pl, "#7A5230")); } break; }
    case "pipe": { p.push(tint(cyl(0.09, 0.09, 1, 14), shade)); p.push(tint(at(cyl(0.13, 0.13, 0.12, 14), 0, 0, 0), shade)); break; }
    case "trophy": {
      const cup = new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.2), new THREE.Vector2(0.1, -0.2), new THREE.Vector2(0.1, -0.17), new THREE.Vector2(0.03, -0.14), new THREE.Vector2(0.03, -0.04), new THREE.Vector2(0.15, 0.06), new THREE.Vector2(0.17, 0.2), new THREE.Vector2(0.15, 0.2)], 20);
      p.push(tint(cup, "#FFC21A"));
      break;
    }
    default: return null;
  }
  return merge(p);
}

// ------------------------------------------------------------------ canvas textures
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
/** diagonal hazard stripes */
export const stripeTex = (a: string, b: string) => canvasTex(128, 128, (c) => {
  c.fillStyle = a; c.fillRect(0, 0, 128, 128);
  c.fillStyle = b;
  for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 32, 128); c.lineTo(i * 32 + 16, 128); c.lineTo(i * 32 + 144, 0); c.lineTo(i * 32 + 128, 0); c.fill(); }
}, true);
/** the back wall of a building: soft tiles in the paper colour (one tile per cell) */
export const tileTex = (paper: string, shade: string) => canvasTex(128, 128, (c) => {
  c.fillStyle = paper; c.fillRect(0, 0, 128, 128);
  const img = c.getImageData(0, 0, 128, 128);
  for (let i = 0; i < 128 * 128; i++) { const n = (Math.random() - 0.5) * 10; img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n; }
  c.putImageData(img, 0, 0);
  c.globalAlpha = 0.16; c.strokeStyle = shade; c.lineWidth = 4; c.strokeRect(2, 2, 124, 124);
  c.globalAlpha = 0.08; c.fillStyle = "#FFFFFF"; c.fillRect(6, 6, 116, 12);
}, true);
/** "EXIT" lightbox face */
export const exitTex = (hot: string) => canvasTex(256, 128, (c) => {
  c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = hot; c.font = "bold 84px 'Lilita One', ui-rounded, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("EXIT", 128, 70);
});
/** the building's big poster word, for the far background */
export const posterTex = (paper: string, shade: string, word: string) => canvasTex(1024, 1024, (c) => {
  const g = c.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, paper); g.addColorStop(1, shade);
  c.fillStyle = paper; c.fillRect(0, 0, 1024, 1024);
  c.globalAlpha = 0.18; c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
  c.globalAlpha = 0.1; c.fillStyle = shade; c.font = "260px 'Lilita One', ui-rounded, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.save(); c.translate(512, 300); c.rotate(-0.16); c.fillText(word, 0, 0); c.restore();
  c.save(); c.translate(420, 760); c.rotate(-0.16); c.fillText(word, 0, 0); c.restore();
}, true);
