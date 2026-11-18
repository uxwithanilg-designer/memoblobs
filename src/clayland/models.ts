// Puddo Clayland models: chunky glossy clay blocks, props for the 20 islands, critters, pots, coins and gadgets — built
// in code with vertex colours (merge + tint), like the other MOMOBLOBS 3D games. Characters face +z (the camera).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";
import type { Shape } from "./bestiary";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const at = <X extends G>(g: X, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <X extends G>(g: X, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rbox = (w: number, h: number, d: number, r = 0.08, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r0: number, r1: number, h: number, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
const cone = (r: number, h: number, n = 10) => new THREE.ConeGeometry(r, h, n);
export const shade = (hex: string, k: number) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };
export const mix = (a: string, b: string, t: number) => { const c = new THREE.Color(a); c.lerp(new THREE.Color(b), t); return `#${c.getHexString()}`; };

/** depth of the play strip (z from DEPTH_BACK to DEPTH_FRONT); characters walk at z = 0 */
export const DEPTH_FRONT = 0.95, DEPTH_BACK = -1.75;
const DEPTH = DEPTH_FRONT - DEPTH_BACK, ZC = (DEPTH_FRONT + DEPTH_BACK) / 2;

// ------------------------------------------------------------------ tiles (origin: tile's bottom-left-centre, x/y 0..1)
/** a deep ground block (white — tinted per instance) */
export function groundBlock(): G { const g = new THREE.BoxGeometry(1.0, 1.0, DEPTH); g.translate(0.5, 0.5, ZC); return tint(g, "#FFFFFF"); }
/** a pebble pressed into the front of the ground */
export function pebble(): G { const g = sphere(0.12, 8, 6); g.scale(1.3, 0.85, 0.45); return tint(g, "#FFFFFF"); }
/** a grass tuft or a little flower on top of a cap */
export function tuft(flower: boolean): G {
  const p: G[] = [];
  if (flower) { p.push(tint(at(cyl(0.02, 0.02, 0.28, 5), 0, 0.14, 0), "#3E9E3E")); for (let i = 0; i < 5; i++) p.push(tint(at(sphere(0.07, 6, 5), Math.cos(i * 1.26) * 0.08, 0.3, Math.sin(i * 1.26) * 0.08), "#FFFFFF")); p.push(tint(at(sphere(0.05, 6, 5), 0, 0.31, 0.02), "#FFD23F")); }
  else for (let i = 0; i < 4; i++) { const b = cone(0.07, 0.42, 4); b.rotateZ((i - 1.5) * 0.3); b.translate((i - 1.5) * 0.07, 0.2, 0); p.push(tint(b, "#FFFFFF")); }
  return merge(p);
}
/** the grassy/sandy/snowy cap on top of an exposed ground tile: rounded and slightly overhanging, with a lip */
export function topCap(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.06, 0.34, DEPTH + 0.12, 0.13, 3), 0.5, 0.86, ZC), "#FFFFFF"));
  // a soft drip edge on the front
  for (let i = 0; i < 3; i++) p.push(tint(sq(at(sphere(0.13, 10, 8), 0.18 + i * 0.32, 0.72, DEPTH_FRONT + 0.03), 1.25, 0.8, 0.6), "#FFFFFF"));
  return merge(p);
}
/** a brick block with mortar seams (light faces, dark seams via vertex colours) */
export function brickBlock(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.0, 1.0, DEPTH * 0.62, 0.06, 2), 0.5, 0.5, ZC + DEPTH * 0.19), "#C8C8C8"));
  const rows = [[0, 0.5, 1], [0.25, 0.75]] as const;
  for (let r = 0; r < 2; r++) {
    const xs = r === 0 ? [0.25, 0.75] : [0.0, 0.5, 1.0];
    for (const x of xs) {
      const w = r === 0 ? 0.46 : x === 0.5 ? 0.46 : 0.22;
      const cx = r === 0 ? x : x === 0 ? 0.12 : x === 1 ? 0.88 : 0.5;
      p.push(tint(at(rbox(w, 0.44, 0.12, 0.05), cx, 0.26 + r * 0.5, DEPTH_FRONT - 0.03), "#FFFFFF"));
    }
  }
  void rows;
  return merge(p);
}
/** a chunky floating block with a bevelled shine panel */
export function solidBlock(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.98, 0.98, 1.3, 0.14, 3), 0.5, 0.5, 0.05), "#FFFFFF"));
  p.push(tint(at(rbox(0.7, 0.7, 0.08, 0.06), 0.5, 0.5, 0.72), "#F2F2F2"));
  p.push(tint(sq(at(sphere(0.08, 8, 6), 0.3, 0.72, 0.77), 1, 1, 0.4), "#FFFFFF"));
  return merge(p);
}
/** a thin floating platform (one-way) */
export function slab(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.0, 0.3, 1.5, 0.12, 3), 0.5, 0.85, 0.0), "#FFFFFF"));
  p.push(tint(at(rbox(0.9, 0.06, 0.06, 0.02), 0.5, 0.72, 0.76), "#BBBBBB"));
  return merge(p);
}
/** a cracked block (stomp it) */
export function crackBlock(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.98, 0.98, 1.4, 0.1, 2), 0.5, 0.5, 0.0), "#FFFFFF"));
  for (const [x0, y0, x1, y1] of [[0.2, 0.8, 0.5, 0.45], [0.5, 0.45, 0.42, 0.15], [0.5, 0.45, 0.8, 0.3]]) {
    const len = Math.hypot(x1 - x0, y1 - y0), c = rbox(len, 0.05, 0.05, 0.02); c.rotateZ(Math.atan2(y1 - y0, x1 - x0)); c.translate((x0 + x1) / 2, (y0 + y1) / 2, 0.71); p.push(tint(c, "#3A2A1A"));
  }
  return merge(p);
}
export function spikesTile(): G {
  const p: G[] = [];
  for (let i = 0; i < 3; i++) for (const z of [-0.35, 0.3]) { const c = cone(0.16, 0.55, 8); c.translate(0.18 + i * 0.32, 0.27, z); p.push(tint(c, "#D8D8E8")); }
  p.push(tint(at(rbox(1, 0.1, 1.2, 0.03), 0.5, 0.05, 0), "#7A7A90"));
  return merge(p);
}
export function liquidBlock(): G { const g = new THREE.BoxGeometry(1.0, 1.0, DEPTH + 0.02); g.translate(0.5, 0.5, ZC); return g; }
export function bounceTile(): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.42, 0.46, 0.5, 16), 0.5, 0.25, 0), "#FFFFFF"));
  p.push(tint(sq(at(sphere(0.46, 16, 10), 0.5, 0.55, 0), 1, 0.55, 1), "#FF3D5E"));
  for (let i = 0; i < 4; i++) p.push(tint(sq(at(sphere(0.09, 8, 6), 0.5 + Math.cos(i * 1.57) * 0.25, 0.75, Math.sin(i * 1.57) * 0.25), 1, 0.5, 1), "#FFFFFF"));
  return merge(p);
}
export function beltTile(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.0, 0.85, DEPTH, 0.05), 0.5, 0.425, ZC), "#3A3A48"));
  for (let i = 0; i < 2; i++) p.push(tint(at(rbox(0.2, 0.06, DEPTH - 0.1, 0.02), 0.25 + i * 0.5, 0.88, ZC), "#FFC21A"));
  return merge(p);
}
export function cloudTile(): G {
  const p: G[] = [];
  for (const [x, y, r] of [[0.2, 0.62, 0.32], [0.5, 0.72, 0.4], [0.82, 0.62, 0.32], [0.5, 0.55, 0.36]]) p.push(tint(sq(at(sphere(r, 12, 9), x, y, 0), 1.1, 0.8, 1.6), "#FFFFFF"));
  return merge(p);
}
export function vineTile(): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.09, 0.09, 1.02, 8), 0.5, 0.5, 0.2), "#3E9E3E"));
  for (const [y, s] of [[0.25, 1], [0.75, -1]]) { const l = sphere(1, 10, 6); l.scale(0.24, 0.07, 0.13); l.rotateZ(s * 0.5); l.translate(0.5 + s * 0.2, y, 0.2); p.push(tint(l, "#6BD35C")); }
  return merge(p);
}

// ------------------------------------------------------------------ the scenery (z behind the play strip)
export type PropFamily = "beach" | "orchard" | "cave" | "reef" | "cliffs" | "candy" | "toys" | "mushroom" | "snow" | "desert" | "night" | "factory" | "temple" | "clouds" | "city" | "volcano" | "crystal" | "pirate" | "moon" | "castle";
function palm(): G {
  const p: G[] = [];
  for (let i = 0; i < 6; i++) { const s = cyl(0.13 - i * 0.008, 0.15 - i * 0.008, 0.5, 8); s.rotateZ(-0.06 * i); s.translate(i * 0.035, 0.25 + i * 0.48, 0); p.push(tint(s, i % 2 ? "#C8925A" : "#A8743F")); }
  for (let k = 0; k < 6; k++) { const l = sphere(1, 10, 6); l.scale(0.95, 0.08, 0.28); l.translate(0.8, 0, 0); l.rotateZ(-0.35); l.rotateY((k / 6) * Math.PI * 2); l.translate(0.2, 2.95, 0); p.push(tint(l, k % 2 ? "#3FB84F" : "#5FD35C")); }
  for (let k = 0; k < 3; k++) p.push(tint(at(sphere(0.12, 8, 6), 0.15 + Math.cos(k * 2.1) * 0.12, 2.75, Math.sin(k * 2.1) * 0.12), "#7A4A2A"));
  return merge(p);
}
function bush(c: string): G { const p: G[] = []; for (const [x, y, r] of [[-0.35, 0.3, 0.38], [0.05, 0.45, 0.48], [0.45, 0.3, 0.36]]) p.push(tint(at(sphere(r, 12, 9), x, y, 0), c)); return merge(p); }
function tree(trunk: string, leaf: string, round = true): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.12, 0.17, 1.4, 8), 0, 0.7, 0), trunk));
  if (round) for (const [x, y, r] of [[0, 1.9, 0.75], [-0.45, 1.55, 0.5], [0.45, 1.6, 0.55]]) p.push(tint(at(sphere(r, 12, 9), x, y, 0), leaf));
  else for (let i = 0; i < 3; i++) p.push(tint(at(cone(0.85 - i * 0.2, 1.0, 10), 0, 1.3 + i * 0.55, 0), leaf));
  return merge(p);
}
function rock(c: string): G { const g = new THREE.DodecahedronGeometry(0.6, 0); g.scale(1.2, 0.8, 1); g.translate(0, 0.4, 0); return tint(g, c); }
function mushroomProp(cap: string): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.18, 0.24, 1.2, 10), 0, 0.6, 0), "#FFF2DC"));
  p.push(tint(sq(at(sphere(0.75, 16, 10), 0, 1.25, 0), 1, 0.55, 1), cap));
  for (let i = 0; i < 5; i++) p.push(tint(sq(at(sphere(0.12, 8, 6), Math.cos(i * 1.3) * 0.45, 1.5, Math.sin(i * 1.3) * 0.45 + 0.1), 1, 0.4, 1), "#FFFFFF"));
  return merge(p);
}
function lollipop(c: string): G { const p: G[] = []; p.push(tint(at(cyl(0.05, 0.05, 1.8, 6), 0, 0.9, 0), "#FFFFFF")); const d = cyl(0.55, 0.55, 0.16, 20); d.rotateX(Math.PI / 2); d.translate(0, 2.0, 0); p.push(tint(d, c)); const s = new THREE.TorusGeometry(0.32, 0.06, 6, 16); s.translate(0, 2.0, 0.09); p.push(tint(s, "#FFFFFF")); return merge(p); }
function toyBlock(c: string, letter: string): G { const p: G[] = []; p.push(tint(at(rbox(1, 1, 1, 0.12), 0, 0.5, 0), c)); p.push(tint(at(rbox(0.6, 0.6, 0.06, 0.05), 0, 0.5, 0.51), letter)); return merge(p); }
function pine(): G { return tree("#7A4A2A", "#E8F4FF", false); }
function cactus(): G { const p: G[] = []; p.push(tint(at(new THREE.CapsuleGeometry(0.22, 1.4, 6, 10), 0, 0.9, 0), "#4FB84F")); for (const sx of [-1, 1]) { const a = new THREE.CapsuleGeometry(0.13, 0.5, 4, 8); a.translate(sx * 0.4, 1.0 + (sx > 0 ? 0.2 : 0), 0); p.push(tint(a, "#5FCB5F")); } p.push(tint(at(sphere(0.12, 8, 6), 0, 1.85, 0), "#FF8FC7")); return merge(p); }
function lanternPost(): G { const p: G[] = []; p.push(tint(at(cyl(0.05, 0.06, 1.8, 6), 0, 0.9, 0), "#3A2A4A")); p.push(tint(sq(at(sphere(0.28, 12, 9), 0, 1.95, 0), 1, 1.2, 1), "#FFC94D")); return merge(p); }
function gear(c: string): G { const p: G[] = []; const d = cyl(0.7, 0.7, 0.2, 18); d.rotateX(Math.PI / 2); d.translate(0, 0.9, 0); p.push(tint(d, c)); for (let i = 0; i < 8; i++) { const t = rbox(0.24, 0.3, 0.2, 0.04); t.translate(0, 0.82, 0); t.rotateZ((i / 8) * Math.PI * 2); t.translate(0, 0.9, 0); p.push(tint(t, c)); } const h = cyl(0.2, 0.2, 0.24, 10); h.rotateX(Math.PI / 2); h.translate(0, 0.9, 0.01); p.push(tint(h, "#2B2B33")); return merge(p); }
function pillar(c: string): G { const p: G[] = []; p.push(tint(at(cyl(0.3, 0.32, 2.4, 10), 0, 1.2, 0), c)); p.push(tint(at(rbox(0.85, 0.22, 0.85, 0.05), 0, 2.5, 0), shade(c, 0.9))); p.push(tint(at(rbox(0.85, 0.2, 0.85, 0.05), 0, 0.1, 0), shade(c, 0.9))); return merge(p); }
function building(c: string, h: number): G { const p: G[] = []; p.push(tint(at(rbox(1.6, h, 1.4, 0.06), 0, h / 2, 0), c)); for (let y = 0.6; y < h - 0.3; y += 0.7) for (const x of [-0.45, 0.45]) p.push(tint(at(rbox(0.36, 0.4, 0.05, 0.03), x, y, 0.71), "#FFE08A")); return merge(p); }
function crystal(c: string): G { const p: G[] = []; for (const [x, s, r] of [[0, 1.4, 0], [0.35, 0.9, 0.4], [-0.3, 1.0, -0.35]]) { const g = new THREE.OctahedronGeometry(0.4, 0); g.scale(0.6, s * 1.6, 0.6); g.rotateZ(r); g.translate(x, s * 0.55, 0); p.push(tint(g, c)); } return merge(p); }
function mast(): G { const p: G[] = []; p.push(tint(at(cyl(0.09, 0.11, 3.4, 8), 0, 1.7, 0), "#7A4A2A")); const sail = rbox(1.5, 1.4, 0.06, 0.05); sail.translate(0.1, 2.3, 0); p.push(tint(sail, "#F2E8D0")); p.push(tint(at(rbox(0.6, 0.35, 0.05, 0.03), 0.35, 3.35, 0), "#FF3D4E")); return merge(p); }
function antenna(): G { const p: G[] = []; p.push(tint(at(cyl(0.05, 0.07, 1.8, 6), 0, 0.9, 0), "#C8CCE0")); const d = sphere(0.55, 14, 8, ); d.scale(1, 0.35, 1); d.rotateZ(0.6); d.translate(0.15, 1.9, 0); p.push(tint(d, "#E8ECF8")); p.push(tint(at(sphere(0.08, 8, 6), 0.3, 2.15, 0), "#FF5FE0")); return merge(p); }
function tower(c: string, roof: string): G { const p: G[] = []; p.push(tint(at(cyl(0.6, 0.65, 3.2, 12), 0, 1.6, 0), c)); p.push(tint(at(cone(0.85, 1.3, 12), 0, 3.85, 0), roof)); for (let i = 0; i < 6; i++) { const b = rbox(0.25, 0.3, 0.25, 0.03); b.translate(Math.cos(i) * 0.58, 3.25, Math.sin(i) * 0.58); p.push(tint(b, c)); } return merge(p); }
function volcanoRock(): G { const p: G[] = []; p.push(tint(at(cone(0.9, 1.8, 9), 0, 0.9, 0), "#3A2424")); p.push(tint(at(cone(0.35, 0.5, 9), 0, 1.6, 0), "#FF5A1F")); return merge(p); }
function shell(c: string): G { const g = new THREE.TorusKnotGeometry(0.25, 0.12, 40, 8, 2, 3); g.translate(0, 0.35, 0); return tint(g, c); }
function coral(c: string): G { const p: G[] = []; for (let i = 0; i < 5; i++) { const b = cyl(0.07, 0.1, 0.6 + (i % 3) * 0.35, 6); b.rotateZ((i - 2) * 0.35); b.translate((i - 2) * 0.15, 0.4, 0); p.push(tint(b, c)); p.push(tint(at(sphere(0.11, 8, 6), (i - 2) * 0.28, 0.75 + (i % 3) * 0.33, 0), shade(c, 1.15))); } return merge(p); }

/** a few props for an island (near / mid scenery), each with its own colour */
export function propSet(f: PropFamily, pal: { top: string; mid: string; accent: string; block: string; brick: string }): G[] {
  switch (f) {
    case "beach": return [palm(), palm(), bush("#4FB36B"), rock("#C8B8A0"), shell("#FFB8C8")];
    case "orchard": return [tree("#8A5A3A", "#3FA34D"), tree("#8A5A3A", "#5FCB4A"), bush("#3FA34D"), (() => { const t = tree("#8A5A3A", "#4FB84F"); return t; })()];
    case "cave": return [rock("#5A4A8A"), crystal("#7FD8FF"), rock("#4A3A78"), mushroomProp("#FFB347")];
    case "reef": return [coral("#FF6FAE"), coral("#FFB347"), coral("#9F7BFF"), rock("#5FD3C4"), shell("#FFF2DC")];
    case "cliffs": return [tree("#8A6A4A", "#7FB06B"), rock("#A9A0C8"), (() => { const p: G[] = [tint(at(cyl(0.06, 0.08, 2.2, 6), 0, 1.1, 0), "#FFFFFF")]; for (let i = 0; i < 4; i++) { const b = rbox(0.7, 0.12, 0.04, 0.03); b.translate(0.35, 0, 0); b.rotateZ((i / 4) * Math.PI * 2); b.translate(0, 2.2, 0.06); p.push(tint(b, ["#FF5F7E", "#FFD23F", "#5FB8FF", "#4FD18B"][i])); } return merge(p); })(), bush("#7FB06B")];
    case "candy": return [lollipop("#FF5FA2"), lollipop("#7FE0D0"), lollipop("#FFD23F"), (() => { const p: G[] = []; for (let i = 0; i < 6; i++) { const s = cyl(0.12, 0.12, 0.3, 10); s.translate(0, 0.15 + i * 0.3, 0); p.push(tint(s, i % 2 ? "#FFFFFF" : "#FF3D5E")); } return merge(p); })()];
    case "toys": return [toyBlock("#FF5F5F", "#FFFFFF"), toyBlock("#5B8CFF", "#FFD23F"), toyBlock("#4FD18B", "#FFFFFF"), toyBlock("#FFD23F", "#FF5F5F")];
    case "mushroom": return [mushroomProp("#FF5FA2"), mushroomProp("#B84FE8"), mushroomProp("#FFB347"), bush("#3F6B4F")];
    case "snow": return [pine(), pine(), rock("#E8F4FF"), (() => { const p: G[] = [tint(at(sphere(0.5, 12, 9), 0, 0.5, 0), "#FFFFFF"), tint(at(sphere(0.36, 12, 9), 0, 1.25, 0), "#FFFFFF"), tint(at(sphere(0.25, 12, 9), 0, 1.8, 0), "#FFFFFF"), tint(at(cone(0.06, 0.3, 6).rotateX(Math.PI / 2), 0, 1.8, 0.3), "#FF8A3D")]; return merge(p); })()];
    case "desert": return [cactus(), cactus(), rock("#D98A3F"), (() => { const p: G[] = [tint(at(cone(1.4, 1.6, 4), 0, 0.8, 0), "#E8B060")]; return merge(p); })()];
    case "night": return [lanternPost(), tree("#3A2A4A", "#2B4F5F"), tree("#3A2A4A", "#3A5F6B"), mushroomProp("#5FE0FF")];
    case "factory": return [gear("#7A8494"), gear("#FFC21A"), building("#5F6B7A", 3), (() => { const p: G[] = [tint(at(cyl(0.3, 0.35, 3, 10), 0, 1.5, 0), "#8A94A4"), tint(at(cyl(0.36, 0.36, 0.2, 10), 0, 3.0, 0), "#FF7A1F")]; return merge(p); })()];
    case "temple": return [pillar("#B8A27A"), pillar("#A8926A"), tree("#6B4A2A", "#5F9A60"), rock("#8A7A5A")];
    case "clouds": return [cloudTile(), tower("#FFFFFF", "#FFB8E6"), (() => { const p: G[] = [tint(at(cyl(0.05, 0.05, 1.6, 6), 0, 0.8, 0), "#FFFFFF"), tint(sq(at(sphere(0.45, 12, 9), 0, 1.8, 0), 0.9, 1.15, 0.9), "#FF8FC7")]; return merge(p); })(), bush("#9FF0A8")];
    case "city": return [building("#3B2F7A", 4), building("#2B2550", 5.5), building("#4A3A8A", 3.2), (() => { const p: G[] = [tint(at(cyl(0.05, 0.05, 2.2, 6), 0, 1.1, 0), "#888"), tint(at(rbox(1.2, 0.5, 0.1, 0.04), 0, 2.3, 0), "#FF3DC8")]; return merge(p); })()];
    case "volcano": return [volcanoRock(), rock("#4A2E2E"), rock("#6B3A2E"), (() => { const p: G[] = [tint(at(cyl(0.06, 0.08, 1.2, 6), 0, 0.6, 0), "#3A5A2A")]; for (let i = 0; i < 5; i++) p.push(tint(at(sphere(0.18, 8, 6), Math.cos(i * 1.25) * 0.22, 1.3, Math.sin(i * 1.25) * 0.22), "#FF5A1F")); return merge(p); })()];
    case "crystal": return [crystal("#9F7BFF"), crystal("#5FF0E8"), crystal("#FF7AE0"), rock("#3A2F5F")];
    case "pirate": return [mast(), (() => { const p: G[] = []; const b = cyl(0.4, 0.4, 0.9, 12); b.translate(0, 0.45, 0); p.push(tint(b, "#8A5A3A")); for (const y of [0.15, 0.75]) { const r = new THREE.TorusGeometry(0.41, 0.03, 6, 16); r.rotateX(Math.PI / 2); r.translate(0, y, 0); p.push(tint(r, "#3A3A3A")); } return merge(p); })(), rock("#5A6A78"), palm()];
    case "moon": return [antenna(), rock("#8A8FA8"), rock("#6B7090"), (() => { const p: G[] = [tint(sq(at(sphere(0.7, 14, 8), 0, 0.3, 0), 1, 0.4, 1), "#C8CCE0"), tint(sq(at(sphere(0.35, 12, 8), 0, 0.55, 0), 1, 0.7, 1), "#7FFFB0")]; return merge(p); })()];
    case "castle": return [tower(pal.brick, "#FF5F3F"), tower(pal.brick, "#FFD23F"), (() => { const p: G[] = [tint(at(cyl(0.04, 0.04, 2, 6), 0, 1, 0), "#666"), tint(at(rbox(0.8, 0.5, 0.04, 0.03), 0.4, 1.75, 0), "#FF5F3F")]; return merge(p); })(), rock("#A8783F")];
  }
}

/** a big far-away silhouette: hills / mountains / islands (wide, flat colour) */
export function farShape(kind: number, c: string, c2: string): G {
  const p: G[] = [];
  if (kind === 0) { for (const [x, r, h] of [[-6, 5, 1.0], [0, 7, 1.3], [7, 5.5, 0.9]]) p.push(tint(sq(at(sphere(r, 20, 12), x, 0, 0), 1, h, 0.4), c)); }
  else if (kind === 1) { for (const [x, r, h] of [[-5, 4, 2.2], [1, 5.5, 3], [8, 4.2, 2.4]]) p.push(tint(at(cone(r, h * 3, 7), x, h * 1.5 - 0.5, 0), c)); for (const [x, r, h] of [[1, 2, 3]]) p.push(tint(at(cone(r, 2.2, 7), x, h * 3 - 1.6, 0.4), c2)); }
  else { for (const [x, r] of [[-4, 4], [3, 5]]) p.push(tint(sq(at(sphere(r, 18, 10), x, -0.5, 0), 1.4, 0.75, 0.4), c)); for (const [x] of [[-4], [3]]) p.push(tint(sq(at(sphere(1.6, 12, 8), x, 2.2, 0.6), 1, 0.6, 0.5), c2)); }
  return merge(p);
}
/** a repeating brick wall texture (the back wall of caves, mines, the factory and the castle) */
export function brickTexture(base: string, mortar = 0.7): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
  const c = cv.getContext("2d")!;
  c.fillStyle = shade(base, mortar); c.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const x = k * 64 + (r % 2 ? 32 : 0) + 3, y = r * 32 + 3;
    const g = c.createLinearGradient(0, y, 0, y + 26); g.addColorStop(0, shade(base, 1.18)); g.addColorStop(1, shade(base, 0.95));
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, 58, 26, 5); c.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export function skyCloud(): G { const p: G[] = []; for (const [x, y, r] of [[-0.9, 0, 0.8], [0, 0.35, 1.1], [0.95, 0, 0.85], [0.3, -0.25, 0.9]]) p.push(tint(sq(at(sphere(r, 12, 9), x, y, 0), 1.2, 0.8, 0.6), "#FFFFFF")); return merge(p); }

// ------------------------------------------------------------------ critters (enemies and bosses), origin at the feet
function eyes(p: G[], y: number, x: number, z: number, r = 0.11, angry = false) {
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(r, 10, 8), sx * x, y, z), 1, 1.15, 0.7), "#FFFFFF"));
    p.push(tint(at(sphere(r * 0.55, 8, 6), sx * x, y - 0.01, z + r * 0.5), "#1B1530"));
    if (angry) { const b = rbox(r * 2.1, r * 0.45, 0.05, 0.02); b.rotateZ(sx * -0.4); b.translate(sx * x, y + r * 1.15, z + 0.04); p.push(tint(b, "#2B1B1B")); }
  }
}
export function critter(shape: Shape, body: string, belly: string, w: number, h: number, angry = true): G {
  const p: G[] = [];
  const hw = w / 2;
  switch (shape) {
    case "blob": case "furry": {
      p.push(tint(sq(at(sphere(0.5, 18, 12), 0, 0.5, 0), w, h, w * 0.9), body));
      p.push(tint(sq(at(sphere(0.32, 14, 10), 0, 0.36, 0.2), w * 1.05, h, w * 0.55), belly));
      if (shape === "furry") for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.08, 0.2, 6), (i - 2) * w * 0.15, h * 0.98, 0), body));
      eyes(p, h * 0.66, hw * 0.35, w * 0.4, 0.12 * Math.min(1.4, w), angry);
      for (const sx of [-1, 1]) p.push(tint(sq(at(sphere(0.12, 8, 6), sx * hw * 0.55, 0.08, 0.1), 1.3, 0.6, 1.4), shade(body, 0.8)));
      break;
    }
    case "crab": {
      p.push(tint(sq(at(sphere(0.5, 16, 10), 0, h * 0.45, 0), w, h * 0.9, w * 0.75), body));
      p.push(tint(sq(at(sphere(0.3, 12, 8), 0, h * 0.35, w * 0.22), w, h * 0.6, w * 0.4), belly));
      for (const sx of [-1, 1]) {
        p.push(tint(at(cyl(0.035, 0.04, h * 0.35, 6), sx * hw * 0.3, h * 0.9, w * 0.15), shade(body, 0.85)));
        p.push(tint(at(sphere(0.1 * Math.min(1.5, w), 10, 8), sx * hw * 0.3, h * 1.08, w * 0.17), "#FFFFFF"));
        p.push(tint(at(sphere(0.055 * Math.min(1.5, w), 8, 6), sx * hw * 0.3, h * 1.08, w * 0.17 + 0.08 * Math.min(1.5, w)), "#1B1530"));
        const claw = sphere(0.22 * Math.min(1.6, w), 10, 8); claw.scale(1, 0.75, 0.75); claw.translate(sx * hw * 1.05, h * 0.55, w * 0.1); p.push(tint(claw, body));
        for (let k = 0; k < 3; k++) { const l = cyl(0.03, 0.03, 0.3, 5); l.rotateZ(sx * 0.9); l.translate(sx * (hw * 0.5 + k * 0.08), 0.12, -0.1 + k * 0.12); p.push(tint(l, shade(body, 0.8))); }
      }
      break;
    }
    case "shell": {
      p.push(tint(sq(at(sphere(0.25, 12, 9), hw * 0.45, 0.3, 0.1), 1.2, 1, 0.9), belly));
      const s = new THREE.TorusGeometry(0.28 * w, 0.16 * w, 10, 18); s.translate(-0.05, h * 0.5, 0); p.push(tint(s, body));
      p.push(tint(at(sphere(0.14 * w, 10, 8), -0.05, h * 0.5, 0), shade(body, 0.8)));
      eyes(p, 0.5, 0.08, 0.22, 0.07, angry);
      break;
    }
    case "bird": case "bug": {
      p.push(tint(sq(at(sphere(0.4, 14, 10), 0, h * 0.5, 0), w * 1.1, h * 1.2, w * 0.9), body));
      p.push(tint(sq(at(sphere(0.25, 12, 8), 0, h * 0.4, 0.15), w, h, w * 0.5), belly));
      for (const sx of [-1, 1]) { const wg = sphere(0.3, 10, 6); wg.scale(shape === "bug" ? 0.6 : 1, 0.25, 0.6); wg.rotateZ(sx * 0.5); wg.translate(sx * hw * 0.9, h * 0.75, -0.05); p.push(tint(wg, shape === "bug" ? "#E8F4FF" : shade(body, 0.9))); }
      if (shape === "bird") { const b = cone(0.08, 0.22, 6); b.rotateX(Math.PI / 2); b.translate(0, h * 0.55, w * 0.42); p.push(tint(b, "#FFB000")); }
      else for (let i = 0; i < 2; i++) p.push(tint(at(cyl(0.02, 0.02, 0.25, 4), (i - 0.5) * 0.16, h * 1.05, 0.05), "#2B2B2B"));
      eyes(p, h * 0.66, hw * 0.3, w * 0.33, 0.09, angry);
      break;
    }
    case "fish": {
      p.push(tint(sq(at(sphere(0.4, 14, 10), 0, h * 0.5, 0), w * 1.2, h * 1.3, w * 0.6), body));
      const tail = cone(0.22, 0.35, 6); tail.rotateZ(Math.PI / 2); tail.translate(-w * 0.55, h * 0.5, 0); p.push(tint(tail, belly));
      eyes(p, h * 0.62, w * 0.18, w * 0.22, 0.08, angry);
      break;
    }
    case "box": {
      p.push(tint(at(rbox(w * 0.9, h * 0.85, w * 0.75, 0.1), 0, h * 0.45, 0), body));
      p.push(tint(at(rbox(w * 0.6, h * 0.35, 0.06, 0.04), 0, h * 0.55, w * 0.38), belly));
      eyes(p, h * 0.58, w * 0.15, w * 0.42, 0.07, angry);
      for (const sx of [-1, 1]) p.push(tint(at(rbox(0.16, 0.18, 0.24, 0.04), sx * w * 0.25, 0.08, 0), shade(body, 0.7)));
      break;
    }
    case "spiky": {
      p.push(tint(sq(at(sphere(0.45, 16, 10), 0, h * 0.5, 0), w * 1.05, h, w), body));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, c = cone(0.07, 0.3, 6); c.translate(0, 0.32, 0); c.rotateZ(a); c.translate(0, h * 0.5, 0); p.push(tint(c, belly)); }
      eyes(p, h * 0.6, w * 0.16, w * 0.4, 0.09, angry);
      break;
    }
    case "snake": {
      for (let i = 0; i < 4; i++) p.push(tint(at(sphere(0.2 - i * 0.02, 10, 8), -i * 0.22, 0.2 + Math.sin(i) * 0.05, 0), i % 2 ? belly : body));
      p.push(tint(sq(at(sphere(0.24, 12, 9), 0.2, 0.42, 0), 1.2, 0.9, 1), body));
      eyes(p, 0.5, 0.1, 0.2, 0.06, angry);
      break;
    }
    case "cone": {
      p.push(tint(at(cyl(0.18 * w, 0.22 * w, h * 0.5, 10), 0, h * 0.25, 0), belly));
      p.push(tint(sq(at(sphere(0.5, 16, 10), 0, h * 0.62, 0), w, h * 0.65, w), body));
      eyes(p, h * 0.42, w * 0.13, w * 0.2, 0.08, angry);
      break;
    }
    case "jelly": {
      p.push(tint(sq(at(sphere(0.42, 14, 10), 0, h * 0.6, 0), w, h * 0.8, w), body));
      for (let i = 0; i < 5; i++) p.push(tint(at(cyl(0.03, 0.02, 0.45, 4), (i - 2) * 0.12, h * 0.25, 0), belly));
      eyes(p, h * 0.66, w * 0.14, w * 0.33, 0.07, false);
      break;
    }
  }
  return merge(p);
}
/** a little crown for bosses */
export function crown(): G { const p: G[] = []; p.push(tint(at(cyl(0.35, 0.38, 0.22, 12), 0, 0.11, 0), "#FFC21A")); for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.08, 0.22, 6), Math.cos((i / 5) * Math.PI * 2) * 0.32, 0.32, Math.sin((i / 5) * Math.PI * 2) * 0.32), "#FFD23F")); p.push(tint(at(sphere(0.06, 8, 6), 0, 0.15, 0.36), "#FF3D6E")); return merge(p); }

// ------------------------------------------------------------------ pots, items, gadgets
export function potGeo(): G {
  const pts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.24, 0.0), new THREE.Vector2(0.36, 0.2), new THREE.Vector2(0.38, 0.45), new THREE.Vector2(0.28, 0.68), new THREE.Vector2(0.2, 0.74), new THREE.Vector2(0.26, 0.82), new THREE.Vector2(0.24, 0.86)];
  const p: G[] = [tint(new THREE.LatheGeometry(pts, 16), "#D9824A")];
  const band = new THREE.TorusGeometry(0.37, 0.035, 6, 20); band.rotateX(Math.PI / 2); band.translate(0, 0.42, 0); p.push(tint(band, "#FFE08A"));
  for (let i = 0; i < 6; i++) p.push(tint(at(sphere(0.045, 6, 5), Math.cos(i) * 0.36, 0.3, Math.sin(i) * 0.36), "#FFFFFF"));
  p.push(tint(at(sphere(0.07, 8, 6), 0, 0.83, 0), "#7A4A2A"));
  return merge(p);
}
export function coinGeo(): G {
  const p: G[] = [];
  const d = cyl(0.3, 0.3, 0.1, 22); d.rotateX(Math.PI / 2); p.push(tint(d, "#FFC21A"));
  const r = new THREE.TorusGeometry(0.3, 0.05, 8, 22); p.push(tint(r, "#FFE07A"));
  const s = rbox(0.09, 0.3, 0.13, 0.03); p.push(tint(s, "#FFE9A0"));
  return merge(p);
}
export function dropGeo(): G { const p: G[] = []; const s = sphere(0.3, 16, 12); p.push(tint(s, "#3DB8FF")); const c = cone(0.21, 0.4, 16); c.translate(0, 0.3, 0); p.push(tint(c, "#3DB8FF")); p.push(tint(at(sphere(0.08, 8, 6), -0.1, 0.12, 0.22), "#FFFFFF")); return merge(p); }
export function heartGeo(): G { const p: G[] = []; for (const sx of [-1, 1]) p.push(tint(at(sphere(0.2, 12, 9), sx * 0.15, 0.1, 0), "#FF3D6E")); const c = cone(0.3, 0.4, 16); c.rotateZ(Math.PI); c.translate(0, -0.12, 0); p.push(tint(c, "#FF3D6E")); return merge(p); }
export function starGeo(): G { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.16 : 0.38, a = (i / 10) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }); g.translate(0, 0, -0.06); return tint(g, "#FFD23F"); }
export function juiceGeo(): G { const p: G[] = []; p.push(tint(at(cyl(0.2, 0.22, 0.45, 12), 0, 0.22, 0), "#FF8A3D")); p.push(tint(at(cyl(0.12, 0.12, 0.08, 10), 0, 0.49, 0), "#FFFFFF")); p.push(tint(at(cyl(0.025, 0.025, 0.3, 6), 0.06, 0.62, 0), "#FF3D6E")); return merge(p); }
export function splatGeo(): G { return tint(sq(sphere(0.26, 12, 9), 1, 0.92, 1), "#FF8A3D"); }
export function wrapGeo(): G { const p: G[] = []; p.push(tint(at(sphere(0.6, 16, 12), 0, 0.5, 0), "#E8955A")); for (let i = 0; i < 6; i++) p.push(tint(at(sphere(0.18, 8, 6), Math.cos(i * 1.05) * 0.5, 0.5 + Math.sin(i * 2.3) * 0.35, Math.sin(i * 1.05) * 0.5), "#D9824A")); return merge(p); }
export function ballGeo(c: string, r = 1): G { return tint(sphere(r, 14, 10), c); }
export function bonfireGeo(): G { const p: G[] = []; for (let i = 0; i < 3; i++) { const l = cyl(0.07, 0.07, 0.8, 6); l.rotateZ(Math.PI / 2); l.rotateY(i * 1.05); l.translate(0, 0.08, 0); p.push(tint(l, "#7A4A2A")); } for (let i = 0; i < 5; i++) p.push(tint(at(sphere(0.09, 6, 5), Math.cos(i * 1.25) * 0.3, 0.05, Math.sin(i * 1.25) * 0.3), "#8A8A8A")); return merge(p); }
export function flameGeo(): G { const p: G[] = []; p.push(tint(at(cone(0.28, 0.75, 10), 0, 0.5, 0), "#FF7A1F")); p.push(tint(at(cone(0.16, 0.5, 10), 0, 0.42, 0.06), "#FFD23F")); return merge(p); }
export function crusherGeo(w: number): G { const p: G[] = []; p.push(tint(at(rbox(w, 1.0, 1.4, 0.1), 0, 0.5, 0), "#8A8F9F")); for (const sx of [-1, 1]) { p.push(tint(at(sphere(0.12, 8, 6), sx * 0.3, 0.55, 0.7), "#FFFFFF")); p.push(tint(at(sphere(0.06, 6, 5), sx * 0.3, 0.52, 0.78), "#1B1530")); } p.push(tint(at(rbox(w * 0.9, 0.12, 1.42, 0.03), 0, 0.06, 0), "#5A5F6F")); for (let i = 0; i < 4; i++) p.push(tint(at(cone(0.1, 0.22, 4).rotateZ(Math.PI), -w / 2 + 0.2 + i * (w - 0.4) / 3, -0.1, 0), "#C8C8D8")); return merge(p); }
export function laserPost(): G { const p: G[] = []; p.push(tint(at(cyl(0.16, 0.2, 0.4, 10), 0, 0.2, 0), "#4A5568")); p.push(tint(at(sphere(0.12, 8, 6), 0, 0.42, 0), "#FF3D5E")); return merge(p); }
export function shooterGeo(kind: "arrow" | "cannon"): G {
  const p: G[] = [];
  if (kind === "cannon") { const b = cyl(0.25, 0.3, 0.9, 12); b.rotateZ(Math.PI / 2); b.translate(-0.2, 0, 0); p.push(tint(b, "#2B2B33")); p.push(tint(at(cyl(0.3, 0.3, 0.2, 10).rotateX(Math.PI / 2), 0.1, -0.28, 0.25), "#7A4A2A")); p.push(tint(at(cyl(0.3, 0.3, 0.2, 10).rotateX(Math.PI / 2), 0.1, -0.28, -0.25), "#7A4A2A")); }
  else { p.push(tint(at(rbox(0.5, 0.6, 1.0, 0.06), 0, 0, 0), "#9A8A6A")); p.push(tint(at(sphere(0.12, 8, 6), -0.26, 0, 0), "#1B1530")); }
  return merge(p);
}
export function arrowGeo(): G { const p: G[] = []; const s = cyl(0.03, 0.03, 0.8, 5); s.rotateZ(Math.PI / 2); p.push(tint(s, "#8A5A3A")); const h = cone(0.08, 0.18, 6); h.rotateZ(Math.PI / 2); h.translate(-0.48, 0, 0); p.push(tint(h, "#C8C8D8")); return merge(p); }
export function ventGeo(c: string): G { const p: G[] = []; p.push(tint(at(cyl(0.38, 0.48, 0.25, 12), 0, 0.12, 0), c)); p.push(tint(at(cyl(0.26, 0.26, 0.04, 12), 0, 0.26, 0), "#1B1530")); return merge(p); }
export function switchGeo(): G { const p: G[] = []; p.push(tint(at(rbox(0.9, 0.4, 0.9, 0.08), 0, 0.2, 0), "#3A3A48")); p.push(tint(at(cyl(0.3, 0.32, 0.18, 14), 0, 0.48, 0), "#FFFFFF")); return merge(p); }
export function lanternGeo(): G { const p: G[] = []; p.push(tint(at(cyl(0.04, 0.05, 1.3, 6), 0, 0.65, 0), "#3A2A1A")); p.push(tint(sq(at(sphere(0.3, 12, 10), 0, 1.55, 0), 1, 1.25, 1), "#FFFFFF")); p.push(tint(at(cyl(0.18, 0.18, 0.08, 8), 0, 1.95, 0), "#3A2A1A")); return merge(p); }
export function gongGeo(): G {
  const p: G[] = [];
  for (const sx of [-1, 1]) p.push(tint(at(cyl(0.08, 0.1, 5.6, 8), sx * 0.75, 2.8, -0.2), "#8A5A3A"));
  p.push(tint(at(rbox(1.8, 0.18, 0.2, 0.06), 0, 5.6, -0.2), "#7A4A2A"));
  const disc = cyl(0.62, 0.62, 0.12, 28); disc.rotateX(Math.PI / 2); disc.translate(0, 3.6, -0.2); p.push(tint(disc, "#FFC21A"));
  const rim = new THREE.TorusGeometry(0.62, 0.06, 8, 28); rim.translate(0, 3.6, -0.13); p.push(tint(rim, "#FFE07A"));
  p.push(tint(at(sphere(0.18, 10, 8), 0, 3.6, -0.1), "#FFE9A0"));
  // the flag on top
  p.push(tint(at(cyl(0.03, 0.03, 1.2, 6), 0, 6.2, -0.2), "#FFFFFF"));
  const fl = rbox(0.8, 0.5, 0.04, 0.02); fl.translate(0.42, 6.55, -0.2); p.push(tint(fl, "#5CCB52"));
  return merge(p);
}
export function bellGeo(): G {
  const pts = [new THREE.Vector2(0.0, 0.95), new THREE.Vector2(0.12, 0.93), new THREE.Vector2(0.3, 0.75), new THREE.Vector2(0.38, 0.4), new THREE.Vector2(0.55, 0.08), new THREE.Vector2(0.58, 0.0), new THREE.Vector2(0.5, 0.0)];
  const p: G[] = [tint(new THREE.LatheGeometry(pts, 20), "#FFC21A")];
  p.push(tint(at(sphere(0.12, 8, 6), 0, 0.02, 0), "#FFE07A"));
  const ring = new THREE.TorusGeometry(0.1, 0.03, 6, 12); ring.translate(0, 1.02, 0); p.push(tint(ring, "#FFC21A"));
  return merge(p);
}
/** the checkpoint sign Tiki holds up */
export function signGeo(): G { const p: G[] = []; p.push(tint(at(cyl(0.04, 0.04, 1.2, 6), 0.55, 0.9, 0.1), "#8A5A3A")); p.push(tint(at(rbox(0.7, 0.5, 0.06, 0.04), 0.55, 1.6, 0.12), "#FFF2DC")); return merge(p); }
export function umbrellaGeo(): G { const p: G[] = []; p.push(tint(at(cyl(0.04, 0.04, 3.4, 6), 0, 1.7, -0.6), "#FFFFFF")); const t = sphere(1.7, 20, 8, ); t.scale(1, 0.32, 0.9); t.translate(0, 3.4, -0.6); p.push(tint(t, "#FF5F7E")); return merge(p); }
export function rainCloudGeo(): G { const p: G[] = []; for (const [x, y, r] of [[-0.8, 0, 0.7], [0, 0.25, 0.95], [0.85, 0, 0.75]]) p.push(tint(sq(at(sphere(r, 12, 9), x, y, 0), 1.2, 0.75, 0.8), "#B8C8E0")); return merge(p); }
export function spiderGeo(): G { const p: G[] = []; p.push(tint(at(sphere(0.3, 12, 9), 0, 0, 0), "#3A2A4A")); for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { const l = cyl(0.025, 0.025, 0.45, 4); l.rotateZ(sx * (0.8 + i * 0.2)); l.translate(sx * 0.3, -0.05 - i * 0.03, -0.1 + i * 0.08); p.push(tint(l, "#2B1B3A")); } for (const sx of [-1, 1]) p.push(tint(at(sphere(0.07, 6, 5), sx * 0.1, 0.05, 0.27), "#FF3D5E")); return merge(p); }
export function icicleGeo(): G { const c = cone(0.16, 0.7, 8); c.rotateZ(Math.PI); return tint(c, "#BFE8FF"); }
export function dripGeo(): G { const p: G[] = []; p.push(tint(sphere(0.13, 10, 8), "#7FD8FF")); const c = cone(0.09, 0.18, 8); c.translate(0, 0.14, 0); p.push(tint(c, "#7FD8FF")); return merge(p); }
export function rockGeo(c = "#8A7A6A"): G { const g = new THREE.DodecahedronGeometry(0.4, 0); return tint(g, c); }
/** a wall of danger following Puddo on chase stages */
export function chaseWall(kind: string): G {
  const p: G[] = [];
  if (kind === "boulder") { p.push(tint(new THREE.DodecahedronGeometry(2.6, 1), "#8A7A6A")); }
  else if (kind === "wave") { for (let i = 0; i < 9; i++) p.push(tint(sq(at(sphere(1.4, 14, 10), 0, i * 1.6, 0), 1, 1, 1.6), i % 2 ? "#3DB8FF" : "#7FD8FF")); }
  else if (kind === "lava") { for (let i = 0; i < 9; i++) p.push(tint(sq(at(sphere(1.4, 12, 8), 0, i * 1.6, 0), 1, 1, 1.6), i % 2 ? "#FF5A1F" : "#FFC23D")); }
  else if (kind === "swarm" || kind === "storm") { for (let i = 0; i < 26; i++) p.push(tint(at(sphere(0.5 + (i % 3) * 0.2, 8, 6), Math.sin(i * 2.3) * 0.9, (i * 0.62) % 14, Math.cos(i * 1.7) * 1.2), kind === "swarm" ? (i % 2 ? "#5A4B7A" : "#C8B8FF") : (i % 2 ? "#E8C890" : "#C8A060"))); }
  else { p.push(tint(at(new THREE.BoxGeometry(1.2, 18, 3), 0, 8, 0), "#FFD23F")); }
  return merge(p);
}

// ------------------------------------------------------------------ Puddo, the hero (faces −z like the Dash rig; parts animate separately)
/**
 * Puddo: a little sprite of rain-soaked riverbank clay — a soft terracotta bean with big eyes and rosy cheeks, a
 * broad leaf on his head that catches the rain (a raindrop sits on it), a clay bucket on his back that he scoops his
 * splats from, and stubby clay feet. Wet clay is glossy; when he dries out the renderer pales him and dulls the shine.
 */
export interface PuddoRig { body: G; foot: G; arm: G; hat: G }
export const PUDDO = { clay: "#D9824A", belly: "#F4C08C", foot: "#B8683A", leaf: "#4FB84A" };
export function puddoRig(): PuddoRig {
  const b: G[] = [];
  // every face part is placed on the body's surface (the body is an ellipsoid: centre y BY, radii BX/BR/BZ)
  const BY = 0.59, BX = 0.47, BR = 0.56, BZ = 0.45;
  const surf = (x: number, y: number) => -BZ * Math.sqrt(Math.max(0, 1 - (x / BX) ** 2 - ((y - BY) / BR) ** 2));
  const blob = (r: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string) => tint(at(sq(sphere(r, 16, 12), sx, sy, sz), x, y, z), c);
  b.push(tint(at(sq(sphere(0.5, 30, 24), 0.94, 1.12, 0.9), 0, BY, 0), PUDDO.clay));
  b.push(tint(at(sq(sphere(0.28, 32, 24), 1.05, 0.95, 0.5), 0, 0.33, surf(0, 0.33) + 0.11), PUDDO.belly));
  // a few fingerprint dents: it's hand-made clay
  for (const [x, y] of [[0.27, 0.95], [-0.33, 0.3], [0.35, 0.24]]) b.push(blob(0.06, x, y, surf(x, y) + 0.006, 1.4, 0.8, 0.3, "#C46F3C"));
  for (const sx of [-1, 1]) {
    // big glossy eyes: a white set into the clay, a large dark pupil laid on it, two shines
    const ex = sx * 0.165, ey = 0.76, wz = surf(ex, ey) + 0.045, wf = wz - 0.155 * 0.72;
    b.push(blob(0.155, ex, ey, wz, 1, 1.12, 0.72, "#FFFFFF"));
    b.push(blob(0.1, ex - sx * 0.008, ey - 0.02, wf + 0.04, 1, 1.12, 0.55, "#1B1530"));
    b.push(blob(0.036, ex - sx * 0.008 - 0.035, ey + 0.025, wf - 0.004, 1, 1, 0.5, "#FFFFFF"));
    b.push(blob(0.018, ex - sx * 0.008 + 0.035, ey - 0.055, wf - 0.004, 1, 1, 0.5, "#FFFFFF"));
    // rosy cheeks
    b.push(blob(0.075, sx * 0.3, 0.57, surf(sx * 0.3, 0.57) + 0.012, 1.35, 0.7, 0.4, "#FF8FA3"));
    // little clay brows
    const br = rbox(0.12, 0.035, 0.04, 0.015); br.rotateZ(sx * 0.18); br.translate(sx * 0.17, 0.95, surf(sx * 0.17, 0.95) - 0.005); b.push(tint(br, "#8A4A22"));
  }
  const smile = new THREE.TorusGeometry(0.085, 0.024, 6, 14, Math.PI); smile.rotateZ(Math.PI); smile.rotateY(Math.PI); smile.translate(0, 0.58, surf(0, 0.55) - 0.005); b.push(tint(smile, "#5A2A1A"));
  // the bucket on his back, full of fresh clay, on a strap
  const bucket = cyl(0.17, 0.14, 0.28, 16); bucket.rotateX(0.25); bucket.translate(0.05, 0.56, 0.44); b.push(tint(bucket, "#7A4A2A"));
  const rim = new THREE.TorusGeometry(0.17, 0.03, 6, 16); rim.rotateX(Math.PI / 2 + 0.25); rim.translate(0.05, 0.7, 0.48); b.push(tint(rim, "#A8743F"));
  b.push(blob(0.15, 0.05, 0.71, 0.48, 1, 0.45, 1, "#E8955A"));
  // the strap wraps round his back and sides only — never across the face
  const strap = new THREE.TorusGeometry(0.47, 0.026, 6, 30, Math.PI + 0.6); strap.rotateZ(-0.3); strap.rotateX(Math.PI / 2); strap.scale(1.01, 1, 0.98); strap.translate(0, 0.47, 0); b.push(tint(strap, "#8A5A3A"));
  const body = merge(b);
  // stubby clay feet with toe bumps (origin under the ankle)
  const f: G[] = [];
  f.push(tint(at(sq(sphere(0.16, 14, 10), 0.95, 0.6, 1.35), 0, 0.055, -0.055), PUDDO.foot));
  for (let i = -1; i <= 1; i++) f.push(tint(at(sphere(0.05, 8, 6), i * 0.07, 0.07, -0.24), PUDDO.foot));
  const foot = merge(f);
  // arms: soft clay tubes with mitten hands
  const a: G[] = [];
  const arm = new THREE.CapsuleGeometry(0.07, 0.2, 4, 10); arm.translate(0, -0.13, 0); a.push(tint(arm, PUDDO.clay));
  a.push(tint(at(sq(sphere(0.09, 12, 10), 1, 0.9, 1), 0, -0.25, 0), PUDDO.belly));
  const armG = merge(a);
  // the leaf hat: a broad leaf with a midrib and veins, a stem, and a raindrop resting on it (origin at the top of the head)
  const h: G[] = [];
  const leaf = sphere(1, 20, 10); leaf.scale(0.56, 0.07, 0.4); leaf.rotateZ(0.12); leaf.translate(0.04, 0.1, 0.02); h.push(tint(leaf, PUDDO.leaf));
  const rib = rbox(1.0, 0.03, 0.035, 0.012); rib.rotateZ(0.12); rib.translate(0.04, 0.165, 0.02); h.push(tint(rib, "#2F8A3A"));
  for (const s2 of [-1, 1]) for (const k of [-0.25, 0.05, 0.3]) { const v = rbox(0.28, 0.02, 0.025, 0.01); v.rotateY(s2 * 0.8); v.translate(k, 0.16 + k * 0.12, s2 * 0.1); h.push(tint(v, "#3FA34D")); }
  const stem = cyl(0.025, 0.035, 0.16, 6); stem.translate(0, 0.04, 0); h.push(tint(stem, "#3E9E3E"));
  const drop = sphere(0.07, 12, 10); drop.scale(1, 1.15, 1); drop.translate(-0.24, 0.21, -0.05); h.push(tint(drop, "#7FD8FF"));
  h.push(tint(at(sphere(0.02, 6, 5), -0.26, 0.24, -0.1), "#FFFFFF"));
  return { body, foot, arm: armG, hat: merge(h) };
}
