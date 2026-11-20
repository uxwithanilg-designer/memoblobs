// Momo Dash! models for worlds 3–12 and the Phase 2 pieces: more obstacle skins, gaps, ice, belts, ghost blocks, rails,
// geysers, zoom pads, portals, boosters, morph gates, world gates, and each world's houses, lamps and landmarks.
// Same rules as models.ts: glossy clay with vertex colours; origin on the ground; the track runs along −z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as C from "../crowd/models";
import { merge, tint } from "../crowd/models";
import * as B from "../boing/models";
import * as M from "./models";
import type { Part } from "./models";

type G = THREE.BufferGeometry;
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rbox = (w: number, h: number, d: number, r = 0.08, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r0: number, r1: number, h: number, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
const none = () => merge([tint(sphere(0.001, 3, 2), "#000")]);
const scaled = (g: G, s: number) => { g.scale(s, s, s); return g; };

// ------------------------------------------------------------------ obstacle skins
export function fenceSkin(skin: string): { g: G; glow: G } {
  if (skin === "barrier" || skin === "candy") return M.fence(skin);
  const p: G[] = [];
  if (skin === "log") {
    for (const sx of [-0.8, 0.8]) p.push(tint(at(cyl(0.12, 0.14, 1.0, 8), sx, 0.5, -0.25), "#6B4A2A"));
    const log = cyl(0.22, 0.22, 1.9, 12); log.rotateZ(Math.PI / 2); log.translate(0, 0.7, -0.25); p.push(tint(log, "#8B5A2B"));
    for (const sx of [-0.95, 0.95]) { const end = cyl(0.2, 0.2, 0.02, 12); end.rotateZ(Math.PI / 2); end.translate(sx, 0.7, -0.25); p.push(tint(end, "#D9A866")); }
    p.push(tint(sq(at(sphere(0.25, 10, 8), 0.4, 0.92, -0.25), 1.4, 0.5, 1), "#3FA84A"));
  } else if (skin === "snow") {
    for (let i = 0; i < 5; i++) p.push(tint(at(rbox(0.16, 0.95, 0.12, 0.04), -0.8 + i * 0.4, 0.47, -0.25), "#C98A55"));
    p.push(tint(at(rbox(1.9, 0.12, 0.1, 0.04), 0, 0.7, -0.25), "#B9774A"));
    p.push(tint(sq(at(sphere(0.6, 14, 10), 0, 0.1, -0.25), 1.8, 0.45, 0.6), "#FFFFFF"));
    for (let i = 0; i < 5; i++) p.push(tint(sq(at(sphere(0.12, 8, 6), -0.8 + i * 0.4, 0.97, -0.25), 1, 0.6, 1), "#FFFFFF"));
  } else if (skin === "rock") {
    for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.5, 0.9 - (i % 2) * 0.1, 0.5, 0.12), -0.72 + i * 0.48, 0.45, -0.25), i % 2 ? "#5E5468" : "#6E6478"));
  } else {
    for (let i = 0; i < 6; i++) p.push(tint(at(sphere(0.32, 12, 10), -0.8 + i * 0.32, 0.55 + (i % 2) * 0.12, -0.25), "#FFFFFF"));
  }
  return { g: merge(p), glow: none() };
}
export function barSkin(skin: string): { g: G; glow: G } {
  if (skin === "sign" || skin === "arch") return M.bar(skin === "sign" ? "sign" : "candy");
  const p: G[] = [], gl: G[] = [];
  if (skin === "branch") {
    for (const sx of [-0.95, 0.95]) p.push(tint(at(cyl(0.14, 0.18, 2.6, 8), sx, 1.3, -0.3), "#5A3A1A"));
    const br = cyl(0.17, 0.2, 2.1, 10); br.rotateZ(Math.PI / 2 + 0.05); br.translate(0, 1.15, -0.3); p.push(tint(br, "#6B4A2A"));
    for (let i = 0; i < 5; i++) p.push(tint(sq(at(sphere(0.28, 10, 8), -0.8 + i * 0.4, 1.4 + (i % 2) * 0.1, -0.3), 1.2, 0.7, 1), i % 2 ? "#3FA84A" : "#2E8A38"));
    for (let i = 0; i < 6; i++) { const ic = new THREE.ConeGeometry(0.05, 0.22, 5); ic.rotateX(Math.PI); ic.translate(-0.75 + i * 0.3, 0.92, -0.3); p.push(tint(ic, "#9FE6FF")); }
  } else {
    for (const sx of [-0.95, 0.95]) p.push(tint(at(cyl(0.12, 0.12, 2.6, 10), sx, 1.3, -0.3), "#4A4458"));
    const pipe = cyl(0.24, 0.24, 2.1, 14); pipe.rotateZ(Math.PI / 2); pipe.translate(0, 1.15, -0.3); p.push(tint(pipe, "#6E6478"));
    for (const sx of [-0.6, 0, 0.6]) { const ring = new THREE.TorusGeometry(0.26, 0.04, 6, 16); ring.rotateY(Math.PI / 2); ring.translate(sx, 1.15, -0.3); p.push(tint(ring, "#3A3448")); }
    for (let i = 0; i < 7; i++) gl.push(tint(at(sphere(0.05, 6, 4), -0.8 + i * 0.27, 0.9, -0.1), "#FF7A1F"));
  }
  return { g: merge(p), glow: gl.length ? merge(gl) : none() };
}
export function blockSkin(skin: string): G {
  if (skin === "crates" || skin === "gifts") return M.block(skin === "crates" ? "crates" : "candy");
  const p: G[] = [];
  if (skin === "stones" || skin === "basalt" || skin === "bricks") {
    const cols = skin === "stones" ? ["#9DA28C", "#8A8F7A"] : skin === "basalt" ? ["#3A302C", "#2E2624"] : ["#B9A99A", "#A8988A"];
    p.push(tint(at(rbox(1.9, 1.15, 1.9, 0.1), 0, 0.57, -1), cols[0]));
    p.push(tint(at(rbox(1.7, 1.15, 1.7, 0.1), 0, 1.72, -1), cols[1]));
    if (skin === "stones") { p.push(tint(at(rbox(0.9, 0.5, 0.06, 0.03), 0, 1.75, -0.12), "#6E735E")); p.push(tint(sq(at(sphere(0.4, 10, 8), 0.5, 2.3, -1), 1.5, 0.4, 1.2), "#4FA84A")); }
    if (skin === "basalt") for (const x of [-0.5, 0.3]) p.push(tint(at(rbox(0.06, 0.9, 0.02, 0.01), x, 1.2, -0.04), "#FF7A1F"));
    if (skin === "bricks") for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.32, 0.3, 0.32, 0.04), -0.6 + i * 0.4, 2.45, -0.2), cols[1]));
  } else if (skin === "ice") {
    p.push(tint(at(rbox(1.8, 2.2, 1.8, 0.2), 0, 1.1, -1), "#BFEFFF"));
    p.push(tint(sq(at(sphere(0.9, 14, 10), 0, 2.2, -1), 1.1, 0.35, 1.1), "#FFFFFF"));
  } else if (skin === "spooky") {
    p.push(tint(at(rbox(1.0, 2.2, 1.6, 0.1), -0.45, 1.1, -1), "#5A3E7A"));
    p.push(tint(at(rbox(0.6, 0.1, 0.06, 0.02), -0.45, 1.6, -0.18), "#FFD23F"), tint(at(rbox(0.1, 0.6, 0.06, 0.02), -0.45, 1.5, -0.18), "#FFD23F"));
    p.push(tint(at(C.pumpkin().scale(1.5, 1.5, 1.5), 0.5, 0, -0.9), "#FFFFFF"));
    p.push(tint(at(C.pumpkin(), 0.5, 1.2, -0.9), "#FFFFFF"));
  } else if (skin === "tech") {
    p.push(tint(at(rbox(1.9, 2.2, 1.9, 0.08), 0, 1.1, -1), "#3D6FD8"));
    for (let i = 0; i < 6; i++) p.push(tint(at(rbox(0.08, 2.0, 0.04, 0.02), -0.75 + i * 0.3, 1.1, -0.04), "#2B4FA8"));
    p.push(tint(at(rbox(1.2, 0.3, 0.05, 0.03), 0, 1.7, -0.03), "#FFC21A"));
  } else {
    // sky: a hay bale stack with a balloon
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [0, 1.0]] as const) { const h = cyl(0.5, 0.5, 0.95, 16); h.rotateZ(Math.PI / 2); h.translate(x, y + 0.5, -1); p.push(tint(h, "#E8C27A")); }
    p.push(tint(at(B.balloon("#FF5F7E").scale(0.6, 0.6, 0.6), 0.4, 1.6, -1), "#FFFFFF"));
  }
  return merge(p);
}
/** a rolling thing (boulder, snowball, toy ball, pumpkin, gumball, barrel); rolls along −z toward Momo */
export function rollerGeo(kind: string): G {
  if (kind === "ball") { const g = C.toyBall("#FF5F5F", "#FFFFFF"); g.translate(0, -0.5, 0); g.scale(1.4, 1.4, 1.4); g.translate(0, 0.7, -0.7); return g; }
  if (kind === "pumpkin") { const g = C.pumpkin(); g.translate(0, -0.4, 0); g.scale(1.6, 1.6, 1.6); g.translate(0, 0.7, -0.7); return g; }
  const col = kind === "snowball" ? "#FFFFFF" : kind === "gumball" ? "#FF5FA2" : kind === "barrel" ? "#B9774A" : "#8A8F7A";
  const p: G[] = [tint(at(sphere(0.7, 18, 14), 0, 0.7, -0.7), col)];
  if (kind === "boulder") for (let i = 0; i < 5; i++) p.push(tint(at(sphere(0.18, 6, 5), Math.cos(i * 1.3) * 0.6, 0.7 + Math.sin(i * 2.1) * 0.5, -0.7 + Math.sin(i * 1.3) * 0.5), "#6E735E"));
  if (kind === "snowball") for (let i = 0; i < 4; i++) p.push(tint(at(sphere(0.1, 6, 4), Math.cos(i * 1.6) * 0.62, 0.7 + Math.sin(i * 2) * 0.4, -0.7 + Math.sin(i * 1.6) * 0.4), "#DCEFFF"));
  if (kind === "barrel") for (const z of [-0.35, 0.35]) { const r = new THREE.TorusGeometry(0.69, 0.05, 6, 20); r.translate(0, 0.7, -0.7 + z); p.push(tint(r, "#4A3A3A")); }
  if (kind === "gumball") for (let i = 0; i < 6; i++) p.push(tint(at(sphere(0.12, 6, 4), Math.cos(i) * 0.6, 0.7 + Math.sin(i * 2) * 0.45, -0.7 + Math.sin(i) * 0.4), ["#FFFFFF", "#FFD23F", "#7FE0D0"][i % 3]));
  return merge(p);
}

// ------------------------------------------------------------------ new track pieces (unit length along −z; scaled per piece)
/** a gap: a dark pit with a lip (length 1, scaled) */
export function gapGeo(lip: string): G {
  const p: G[] = [];
  p.push(tint(at(new THREE.BoxGeometry(2.1, 0.02, 1), 0, 0.012, -0.5), "#120C24"));
  for (const z of [0, -1]) p.push(tint(at(new THREE.BoxGeometry(2.1, 0.1, 0.12), 0, 0.03, z), lip));
  for (const x of [-1.05, 1.05]) p.push(tint(at(new THREE.BoxGeometry(0.1, 0.08, 1), x, 0.03, -0.5), lip));
  return merge(p);
}
export function iceGeo(): G { const g = new THREE.BoxGeometry(2.0, 0.03, 1); g.translate(0, 0.015, -0.5); return merge([tint(g, "#CFF4FF")]); }
export function beltGeo(): G {
  const p: G[] = [tint(at(new THREE.BoxGeometry(2.0, 0.08, 1), 0, 0.04, -0.5), "#3A3448")];
  for (const x of [-1.02, 1.02]) p.push(tint(at(new THREE.BoxGeometry(0.1, 0.14, 1), x, 0.07, -0.5), "#FFC21A"));
  return merge(p);
}
/** chevrons on a belt, drawn with a scrolling texture */
export function beltTop(): G { const g = new THREE.PlaneGeometry(1.9, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.085, -0.5); return g; }
export function railGeo(): G {
  const p: G[] = [tint(at(rbox(0.5, 0.5, 1, 0.06), 0, 0.25, -0.5), "#5A5E6E")];
  p.push(tint(at(rbox(0.6, 0.12, 1, 0.04), 0, 0.56, -0.5), "#C0C8D8"));
  for (const x of [-0.75, 0.75]) p.push(tint(at(new THREE.BoxGeometry(0.08, 0.06, 1), x, 0.03, -0.5), "#8A8F9A"));
  return merge(p);
}
export function railFront(): G { return merge([tint(at(rbox(0.66, 0.66, 0.1, 0.04), 0, 0.33, 0.02), "#FFC21A")]); }
export function geyserBase(): G {
  const p: G[] = [tint(at(cyl(0.85, 0.95, 0.18, 18), 0, 0.09, -0.8), "#2E2624")];
  p.push(tint(at(new THREE.TorusGeometry(0.62, 0.1, 8, 20).rotateX(Math.PI / 2), 0, 0.18, -0.8), "#3A302C"));
  return merge(p);
}
export function geyserCore(): G { return merge([tint(at(cyl(0.55, 0.55, 0.04, 16), 0, 0.2, -0.8), "#FF7A1F")]); }
export function geyserJet(): G {
  const p: G[] = [tint(at(cyl(0.45, 0.62, 3.4, 14, ), 0, 1.7, -0.8), "#FF8A2F")];
  for (let i = 0; i < 4; i++) p.push(tint(at(sphere(0.38, 10, 8), Math.cos(i * 1.7) * 0.3, 3.3 + i * 0.12, -0.8 + Math.sin(i * 1.7) * 0.3), "#FFD23F"));
  return merge(p);
}
export function zoomGeo(): { g: G; glow: G } {
  const g = merge([tint(at(rbox(1.8, 0.08, 1.8, 0.04), 0, 0.04, -0.9), "#1E2A66")]);
  const gl: G[] = [];
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const c = rbox(0.6, 0.05, 0.14, 0.03); c.rotateY(sx * 0.6); c.translate(sx * 0.24, 0.1, -0.4 - i * 0.45); gl.push(tint(c, "#3DE0FF")); }
  return { g, glow: merge(gl) };
}
/** a gust zone across a lane: swirly streaks (glow) */
export function gustGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(0.35 + i * 0.12, 0.025, 4, 18, Math.PI * 1.3); t.rotateY(Math.PI / 2); t.translate(0, 0.9 + i * 0.25, -0.5); p.push(tint(t, "#FFFFFF")); }
  return merge(p);
}
/** a portal ring: gold for the Coin Lane, purple for the Star Lane */
export function portalGeo(): G {
  const p: G[] = [];
  const ring = new THREE.TorusGeometry(1.15, 0.16, 12, 36); ring.translate(0, 1.3, 0); p.push(tint(ring, "#FFFFFF"));
  for (const sx of [-1.15, 1.15]) p.push(tint(at(cyl(0.12, 0.16, 1.3, 10), sx, 0.65, 0), "#FFFFFF"));
  return merge(p);
}
export function portalFill(): G { const g = new THREE.CircleGeometry(1.0, 32); g.translate(0, 1.3, 0); return g; }
export function starGeo(): G {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.22 : 0.5; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }); g.translate(0, 0, -0.08);
  return merge([tint(g, "#FFE14D")]);
}
/** a heart (+1 life): a puffy red heart with a little shine */
export function heartGeo(): G {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(-0.08, -0.32, -0.5, -0.05, -0.5, 0.18);
  s.bezierCurveTo(-0.5, 0.42, -0.24, 0.5, -0.12, 0.45);
  s.bezierCurveTo(-0.05, 0.42, 0, 0.36, 0, 0.3);
  s.bezierCurveTo(0, 0.36, 0.05, 0.42, 0.12, 0.45);
  s.bezierCurveTo(0.24, 0.5, 0.5, 0.42, 0.5, 0.18);
  s.bezierCurveTo(0.5, -0.05, 0.08, -0.32, 0, -0.42);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 4, curveSegments: 14 }); g.translate(0, 0, -0.1);
  const shine = new THREE.SphereGeometry(0.08, 10, 8); shine.scale(1.3, 0.8, 0.4); shine.translate(-0.24, 0.24, 0.2);
  return merge([tint(g, "#FF2E63"), tint(shine, "#FFFFFF")]);
}
/** a booster rocket (red ×3, gold ×5) */
export function boostGeo(gold: boolean): G {
  const p: G[] = [];
  const body = cyl(0.22, 0.26, 0.9, 16); body.rotateX(Math.PI / 2); p.push(tint(body, gold ? "#FFC21A" : "#FF3D4E"));
  const nose = new THREE.ConeGeometry(0.22, 0.45, 16); nose.rotateX(-Math.PI / 2); nose.translate(0, 0, -0.67); p.push(tint(nose, "#FFFFFF"));
  for (let i = 0; i < 3; i++) { const fin = rbox(0.04, 0.3, 0.3, 0.02); fin.rotateZ((i / 3) * Math.PI * 2); fin.translate(Math.sin((i / 3) * Math.PI * 2) * 0.25, Math.cos((i / 3) * Math.PI * 2) * 0.25, 0.3); p.push(tint(fin, gold ? "#FF8A3D" : "#2B3A8F")); }
  p.push(tint(sq(at(sphere(0.12, 10, 8), 0, 0.12, -0.25), 1, 1, 0.5), "#9FE6FF"));
  return merge(p);
}
/** a morph gate: an arch with the morph's sign floating in it */
export function morphGate(): G {
  const p: G[] = [];
  const a = new THREE.TorusGeometry(0.95, 0.12, 10, 28, Math.PI); a.translate(0, 1.2, 0); p.push(tint(a, "#FFFFFF"));
  for (const sx of [-0.95, 0.95]) p.push(tint(at(cyl(0.12, 0.14, 1.2, 10), sx, 0.6, 0), "#FFFFFF"));
  return merge(p);
}
export function morphIcon(id: string): G {
  if (id === "ball") return merge([tint(sphere(0.32, 16, 12), "#FF8A3D"), tint(sq(sphere(0.33, 16, 4), 1, 0.12, 1), "#FFFFFF")]);
  if (id === "split") return merge([-0.3, 0, 0.3].map((x, i) => tint(at(sphere(0.16 + (i === 1 ? 0.03 : 0), 12, 10), x, 0, 0), "#FF8A3D")));
  if (id === "giant") return merge([tint(sphere(0.42, 16, 12), "#FF8A3D"), tint(at(new THREE.ConeGeometry(0.12, 0.25, 8), 0, 0.48, 0), "#FFC21A")]);
  return merge([tint(sq(sphere(0.2, 14, 10), 0.8, 2.2, 0.8), "#FF8A3D")]);
}
/** the gate at the start of each world */
export function worldGate(): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  for (const sx of [-4.6, 4.6]) {
    p.push(tint(at(rbox(1.0, 6.4, 1.0, 0.2), sx, 3.2, 0), "#FFFFFF"));
    p.push(tint(at(sphere(0.7, 16, 12), sx, 6.9, 0), "#FFC21A"));
  }
  const top = new THREE.TorusGeometry(4.6, 0.35, 10, 40, Math.PI); top.translate(0, 6.2, 0); p.push(tint(top, "#FFFFFF"));
  for (let i = 0; i < 26; i++) { const a = (i / 25) * Math.PI; gl.push(tint(at(sphere(0.13, 8, 6), Math.cos(a) * 4.6, 6.2 + Math.sin(a) * 4.6, 0.35), i % 2 ? "#FFE08A" : "#9FE6FF")); }
  return { g: merge(p), glow: merge(gl) };
}
/** the Jelly Board under Momo's feet */
export function boardGeo(): G {
  const p: G[] = [tint(at(rbox(0.75, 0.1, 1.5, 0.05), 0, 0.08, 0), "#FFFFFF")];
  for (const z of [-0.5, 0.5]) for (const x of [-0.25, 0.25]) p.push(tint(at(cyl(0.07, 0.07, 0.08, 10).rotateZ(Math.PI / 2), x, 0.02, z), "#2A2140"));
  return merge(p);
}

// ------------------------------------------------------------------ houses (face +x toward the track; walls take the window texture)
const wallBox = (d: number, h: number, w: number) => { const g = rbox(d, h, w, 0.1); g.translate(-d / 2, h / 2, 0); return g; };
const gable = (d: number, w: number, h: number, y: number, col: string) => { const r = new THREE.CylinderGeometry(0.01, d * 0.74, h, 4, 1); r.rotateY(Math.PI / 4); r.scale(1, 1, w / d * 1.04); r.translate(-d / 2, y + h / 2, 0); return tint(r, col); };
export function ruin(v: number): Part[] {
  const w = [5, 4.4, 5.6, 4.8][v % 4], h = [3, 4, 2.6, 4.6][v % 4], d = 4.4, p: G[] = [];
  for (let k = 0; k < 3; k++) p.push(tint(at(rbox(d - k * 1.1, 0.9, w - k * 1.1, 0.06), -d / 2, h + 0.45 + k * 0.9, 0), k % 2 ? "#8A8F7A" : "#9DA28C"));
  for (let i = 0; i < 4; i++) p.push(tint(sq(at(sphere(0.4, 8, 6), -0.2, h - 0.2 - i * 0.6, -w / 2 + 0.5 + i * 1.1), 0.5, 1.2, 0.8), "#3FA84A"));
  p.push(tint(at(rbox(0.3, 1.8, 1.2, 0.05), 0.1, 0.9, 0), "#2A2E22"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function chalet(v: number): Part[] {
  const w = [5, 4.4, 5.6, 4.6][v % 4], h = [3.2, 4.2, 2.8, 4.6][v % 4], d = 4.4, p: G[] = [];
  p.push(gable(d, w, 2.0, h, "#7A4A2A"));
  p.push(tint(sq(at(sphere(1, 14, 8), -d / 2, h + 1.0, 0), d * 0.55, 0.5, w * 0.56), "#FFFFFF"));
  for (let i = 0; i < 7; i++) { const ic = new THREE.ConeGeometry(0.07, 0.35, 5); ic.rotateX(Math.PI); ic.translate(0.12, h - 0.15, -w / 2 + 0.4 + i * (w - 0.8) / 6); p.push(tint(ic, "#CFF4FF")); }
  p.push(tint(at(rbox(0.2, 1.6, 1.0, 0.05), 0.08, 0.8, 0), "#5A3A1A"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function toyHouse(v: number): Part[] {
  const w = [5, 4.4, 5.4, 4.6][v % 4], h = [3.2, 4.4, 3.0, 4.8][v % 4], d = 4.4, p: G[] = [];
  const cols = ["#FF5F5F", "#3D8BFF", "#FFC21A", "#2FCB8B", "#B58CFF"];
  for (let i = 0; i < 3; i++) p.push(tint(at(rbox(1.4, 1.0, 1.4, 0.12), -d / 2 + (i - 1) * 1.3, h + 0.5, (i - 1) * 0.9), cols[(v + i) % 5]));
  const gear = new THREE.TorusGeometry(0.7, 0.18, 6, 12); gear.rotateY(Math.PI / 2); gear.translate(0.1, h * 0.7, w * 0.25); p.push(tint(gear, "#C0C8D8"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function tent(v: number): Part[] {
  const w = [5, 4.4, 5.4, 4.6][v % 4], h = [2.6, 3.4, 2.4, 3.8][v % 4], d = 4.2, p: G[] = [];
  const r = new THREE.ConeGeometry(Math.max(d, w) * 0.62, 2.6, 8); r.translate(-d / 2, h + 1.3, 0); p.push(tint(r, ["#7A3FCB", "#FF8A1F", "#3A2C8F", "#C2306F"][v % 4]));
  p.push(tint(at(cyl(0.04, 0.04, 0.8, 5), -d / 2, h + 2.9, 0), "#2A2140"), tint(at(rbox(0.4, 0.25, 0.02, 0.01), -d / 2 + 0.2, h + 3.15, 0), "#FFD23F"));
  p.push(tint(at(C.pumpkin(), 0.6, 0, w * 0.3), "#FFFFFF"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function adobe(v: number): Part[] {
  const w = [5, 4.4, 5.6, 4.6][v % 4], h = [2.8, 3.6, 2.6, 4.0][v % 4], d = 4.4, p: G[] = [];
  for (let i = 0; i < 5; i++) { const b = cyl(0.09, 0.09, 0.8, 6); b.rotateZ(Math.PI / 2); b.translate(0.2, h - 0.35, -w / 2 + 0.5 + i * (w - 1) / 4); p.push(tint(b, "#6B4A2A")); }
  p.push(tint(at(rbox(d + 0.2, 0.2, w + 0.2, 0.05), -d / 2, h + 0.1, 0), "#C9704A"));
  p.push(tint(at(rbox(0.2, 1.7, 1.1, 0.05), 0.06, 0.85, 0), "#5A3A1A"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function skyscraper(v: number): Part[] {
  const w = [4.6, 4.0, 5.2, 4.4][v % 4], h = [9, 13, 7.5, 16][v % 4], d = 4.6, p: G[] = [];
  p.push(tint(at(rbox(d * 0.7, 1.2, w * 0.7, 0.08), -d / 2, h + 0.6, 0), "#2A2E4A"));
  p.push(tint(at(cyl(0.05, 0.05, 2.2, 5), -d / 2, h + 2.3, 0), "#A7AEC6"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }, { g: merge([tint(at(rbox(0.12, h * 0.9, 0.12, 0.04), 0.02, h * 0.5, w / 2 - 0.1), "#FFFFFF"), tint(at(rbox(0.12, h * 0.9, 0.12, 0.04), 0.02, h * 0.5, -w / 2 + 0.1), "#FFFFFF"), tint(at(sphere(0.12, 6, 4), -d / 2, h + 3.4, 0), "#FFFFFF")]), mat: "neon" }];
}
export function factory(v: number): Part[] {
  const w = [5.4, 4.6, 6, 5][v % 4], h = [3.6, 4.6, 3.2, 5][v % 4], d = 4.6, p: G[] = [];
  for (let i = 0; i < 2; i++) p.push(tint(at(cyl(0.35, 0.45, 3.2, 10), -d / 2 - 0.6 + i * 1.2, h + 1.6, (i - 0.5) * 1.6), "#4A4458"));
  const pipe = cyl(0.25, 0.25, w, 10); pipe.rotateX(Math.PI / 2); pipe.translate(0.15, h * 0.7, 0); p.push(tint(pipe, "#6E6478"));
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }, { g: merge([tint(at(rbox(0.06, 0.2, w * 0.9, 0.02), 0.32, h * 0.7 - 0.25, 0), "#FFFFFF")]), mat: "neon" }];
}
export function floatHouse(v: number): Part[] {
  const w = [4.6, 4.0, 5.0, 4.2][v % 4], h = [2.8, 3.4, 2.6, 3.8][v % 4], d = 4.0, p: G[] = [];
  const isl = B.island("#8B6A4A", "#5CC452", v); isl.scale(2.2, 1.6, 2.2); isl.translate(-d / 2, -0.2, 0); p.push(isl);
  p.push(gable(d, w, 1.8, h, ["#FF5F7E", "#3D8BFF", "#FFC21A", "#2FCB8B"][v % 4]));
  const bal = B.balloon("#FF8FC7"); bal.translate(-d / 2 + 1, h + 2.2, w * 0.3); p.push(bal);
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}
export function dome(v: number): Part[] {
  const r = [2.4, 2.0, 2.8, 2.2][v % 4], p: G[] = [];
  const d = new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); d.translate(-r, 0.6, 0); p.push(tint(d, "#D9DEEA"));
  p.push(tint(at(cyl(r, r, 0.6, 20), -r, 0.3, 0), "#8F6BFF"));
  p.push(tint(at(C.antenna().scale(1.4, 1.4, 1.4), -r, r * 0.9, 0), "#FFFFFF"));
  return [{ g: merge([tint(at(rbox(0.1, 0.8, 1.6, 0.05), 0.02, 1.0, 0), "#FFFFFF")]), mat: "wall" }, { g: merge(p), mat: "gloss" }, { g: merge([tint(at(new THREE.TorusGeometry(r * 0.98, 0.05, 6, 30).rotateX(Math.PI / 2), -r, 0.62, 0), "#FFFFFF")]), mat: "neon" }];
}
export function castleWall(v: number): Part[] {
  const w = 7.4, h = [4.2, 5.0, 4.4, 5.4][v % 4], d = 3.2, p: G[] = [];
  for (let i = 0; i < 6; i++) p.push(tint(at(rbox(0.7, 0.6, 0.7, 0.05), -0.3, h + 0.3, -w / 2 + 0.6 + i * (w - 1.2) / 5), "#A8988A"));
  if (v % 2 === 0) { const t = C.castleTower(); t.scale(1.6, 1.8, 1.6); t.translate(-d / 2, 0, w / 2 - 0.6); p.push(t); }
  const bn = C.banner(); bn.scale(1.4, 1.4, 1.4); bn.rotateY(Math.PI / 2); bn.translate(0.3, h - 2.6, 0); p.push(bn);
  return [{ g: wallBox(d, h, w), mat: "wall" }, { g: merge(p), mat: "clay" }];
}

// ------------------------------------------------------------------ lamps (glow parts separate)
export function lampOf(kind: string): { g: G; glow: G } {
  if (kind === "pier") return M.lampPost();
  if (kind === "candy") return M.candyLamp();
  const p: G[] = [], gl: G[] = [];
  const pole = (col: string, h = 3.6) => p.push(tint(at(cyl(0.08, 0.12, h, 8), 0, h / 2, 0), col));
  switch (kind) {
    case "torch": pole("#6B4A2A", 3.2); p.push(tint(at(cyl(0.22, 0.12, 0.4, 8), 0, 3.3, 0), "#8B5A2B")); gl.push(tint(sq(at(sphere(0.24, 10, 8), 0, 3.6, 0), 1, 1.5, 1), "#FFB347")); break;
    case "neon": pole("#2A2E4A", 3.8); gl.push(tint(at(rbox(0.12, 1.4, 0.12, 0.05), 0.0, 3.1, 0), "#FF3DCB"), tint(at(sphere(0.18, 10, 8), 0, 3.9, 0), "#3DE0FF")); break;
    case "space": pole("#A7AEC6", 3.6); gl.push(tint(at(new THREE.TorusGeometry(0.3, 0.06, 8, 18).rotateX(Math.PI / 2), 0, 3.7, 0), "#3DE0FF")); break;
    case "lava": pole("#3A3448", 3.6); p.push(tint(at(rbox(0.5, 0.3, 0.5, 0.05), 0, 3.7, 0), "#4A4458")); gl.push(tint(at(rbox(0.4, 0.12, 0.4, 0.04), 0, 3.52, 0), "#FF7A1F")); break;
    case "snow": pole("#2A2140", 3.4); p.push(tint(at(rbox(0.36, 0.42, 0.36, 0.05), 0, 3.6, 0), "#3B3550"), tint(sq(at(sphere(0.3, 10, 8), 0, 3.9, 0), 1, 0.4, 1), "#FFFFFF")); gl.push(tint(at(sphere(0.15, 8, 6), 0, 3.6, 0), "#FFD58A")); break;
    case "toy": for (let k = 0; k < 6; k++) p.push(tint(at(cyl(0.12, 0.12, 0.6, 8), 0, 0.3 + k * 0.6, 0), ["#FF5F5F", "#3D8BFF", "#FFC21A"][k % 3])); gl.push(tint(at(sphere(0.25, 12, 10), 0, 3.85, 0), "#FFF2C0")); break;
    case "spooky": pole("#2A2140", 3.4); p.push(tint(at(C.pumpkin(), 0, 3.3, 0), "#FFFFFF")); gl.push(tint(at(sphere(0.18, 8, 6), 0, 3.7, 0.15), "#FF9A3D")); break;
    case "mine": pole("#6B4A2A", 3.4); p.push(tint(at(rbox(0.8, 0.12, 0.12, 0.04), 0.3, 3.3, 0), "#6B4A2A")); gl.push(tint(at(sphere(0.18, 8, 6), 0.6, 3.05, 0), "#FFC85A")); break;
    case "sky": pole("#FFFFFF", 3.4); gl.push(tint(at(sphere(0.28, 12, 10), 0, 3.6, 0), "#FFF2C0")); p.push(tint(at(B.balloon("#FF5F7E").scale(0.4, 0.4, 0.4), 0.3, 3.9, 0), "#FFFFFF")); break;
    case "castle": pole("#5A4A3A", 3.0); p.push(tint(at(cyl(0.25, 0.15, 0.35, 8), 0, 3.15, 0), "#3A3028")); gl.push(tint(sq(at(sphere(0.24, 10, 8), 0, 3.45, 0), 1, 1.6, 1), "#FF9A3D")); break;
    default: return M.lampPost();
  }
  return { g: merge(p), glow: merge(gl) };
}

// ------------------------------------------------------------------ near props and far landmarks
export function cactus(): G {
  const p: G[] = [tint(at(new THREE.CapsuleGeometry(0.28, 1.8, 4, 10), 0, 1.2, 0), "#3FA84A")];
  for (const [sx, y] of [[-1, 1.2], [1, 1.6]] as const) { const a = new THREE.CapsuleGeometry(0.18, 0.6, 4, 8); a.translate(sx * 0.55, y + 0.3, 0); p.push(tint(a, "#3FA84A")); const j = new THREE.CapsuleGeometry(0.16, 0.3, 4, 8); j.rotateZ(Math.PI / 2); j.translate(sx * 0.35, y, 0); p.push(tint(j, "#3FA84A")); }
  p.push(tint(at(sphere(0.12, 8, 6), 0, 2.35, 0), "#FF5F9E"));
  return merge(p);
}
export function mesa(col: string): G {
  const g = new THREE.CylinderGeometry(14, 18, 16, 9); g.translate(0, 8, 0);
  const top = new THREE.CylinderGeometry(14.2, 14.2, 1.2, 9); top.translate(0, 16, 0);
  return merge([tint(g, col), tint(top, "#E8A06A")]);
}
export function hydrant(): G { return merge([tint(at(cyl(0.2, 0.24, 0.7, 10), 0, 0.35, 0), "#FF3D4E"), tint(at(sphere(0.22, 10, 8), 0, 0.72, 0), "#FF3D4E"), tint(at(cyl(0.08, 0.08, 0.5, 6).rotateZ(Math.PI / 2), 0, 0.45, 0), "#C0C8D8")]); }
export function pipeStack(): G { return merge([0, 1, 2].map((i) => { const c = cyl(0.3, 0.3, 2.2, 12); c.rotateZ(Math.PI / 2); c.translate(0, 0.3 + (i === 2 ? 0.52 : 0), (i === 2 ? 0 : i * 0.6 - 0.3)); return tint(c, "#6E6478"); })); }
export function windmill(): G {
  const p: G[] = [tint(at(cyl(0.3, 0.5, 3.4, 10), 0, 1.7, 0), "#FFFFFF"), tint(at(new THREE.ConeGeometry(0.55, 0.8, 10), 0, 3.8, 0), "#FF5F7E")];
  for (let i = 0; i < 4; i++) { const b = rbox(0.25, 1.6, 0.05, 0.03); b.translate(0, 0.8, 0); b.rotateZ((i / 4) * Math.PI * 2 + 0.3); b.translate(0, 3.3, 0.55); p.push(tint(b, "#FFF4DC")); }
  return merge(p);
}
export function rocket(): G {
  const p: G[] = [tint(at(cyl(1.2, 1.4, 10, 18), 0, 5, 0), "#FFFFFF"), tint(at(new THREE.ConeGeometry(1.2, 3, 18), 0, 11.5, 0), "#FF3D4E")];
  for (let i = 0; i < 3; i++) { const f = rbox(0.2, 3, 2.4, 0.05); f.translate(0, 1.5, 1.6); f.rotateY((i / 3) * Math.PI * 2); p.push(tint(f, "#3D6FD8")); }
  p.push(tint(at(sphere(0.6, 12, 10), 0, 7.5, 1.15), "#9FE6FF"));
  return merge(p);
}
export const scale = scaled;
export { C as crowd, B as boing };
