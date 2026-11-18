// Momo Dash! models, built in code as glossy clay toys with vertex colours (+ a few canvas textures). The track runs
// along −z; characters face +z toward the camera unless noted (the runner Momo faces −z, away from the camera).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rbox = (w: number, h: number, d: number, r = 0.08, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r0: number, r1: number, h: number, n = 14) => new THREE.CylinderGeometry(r0, r1, h, n);

// ------------------------------------------------------------------ canvas textures
export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = true): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
/** wooden planks running across the track, with grain */
export function woodTex(base = "#B9774A", dark = "#7A4A2A") {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = base; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      const y = i * 32, sh = (i * 37) % 5;
      c.fillStyle = `rgba(${sh * 6},${sh * 3},0,0.10)`; c.fillRect(0, y, 256, 32);
      c.strokeStyle = "rgba(60,30,10,0.18)"; c.lineWidth = 1;
      for (let k = 0; k < 6; k++) { c.beginPath(); const yy = y + 4 + k * 5; c.moveTo(0, yy); for (let x = 0; x <= 256; x += 32) c.lineTo(x, yy + Math.sin((x + i * 50 + k * 13) * 0.05) * 1.6); c.stroke(); }
      c.fillStyle = dark; c.fillRect(0, y + 30, 256, 2);
      c.fillStyle = "rgba(40,20,10,0.55)"; for (const x of [40 + (i * 53) % 150, 200 - (i * 29) % 120]) { c.beginPath(); c.arc(x, y + 16, 1.6, 0, 7); c.fill(); }
    }
  });
}
/** a building wall: a grid of windows (map) and which of them glow (emissive) */
export function windowTex(lit: boolean, seed = 1) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return canvasTex(256, 256, (c) => {
    c.fillStyle = lit ? "#000000" : "#FFFFFF"; c.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const x = 22 + k * 78, y = 26 + r * 76, on = rnd() < 0.62;
      if (lit) { if (on) { const g = c.createLinearGradient(x, y, x, y + 46); g.addColorStop(0, "#FFE7A3"); g.addColorStop(1, "#FFB347"); c.fillStyle = g; c.fillRect(x + 3, y + 3, 44, 42); } }
      else {
        c.fillStyle = "#E9E1D2"; c.fillRect(x - 4, y - 4, 58, 58);
        c.fillStyle = on ? "#FFD27A" : "#3A3560"; c.fillRect(x + 3, y + 3, 44, 42);
        c.fillStyle = "rgba(255,255,255,0.75)"; c.fillRect(x + 23, y + 3, 4, 42); c.fillRect(x + 3, y + 22, 44, 4);
      }
    }
  }, false);
}
export function stripeTex(a: string, b: string, n = 8) {
  return canvasTex(128, 32, (c) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect((i * 128) / n, 0, 128 / n + 1, 32); } });
}
/** candy road: frosting with sprinkles and dotted lane lines */
export function frostingTex() {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = "#FF8FC4"; c.fillRect(0, 0, 256, 256);
    c.fillStyle = "rgba(255,255,255,0.18)"; for (let y = 0; y < 256; y += 64) c.fillRect(0, y, 256, 24);
    const cols = ["#FFFFFF", "#7FE0D0", "#FFD23F", "#9F7BFF", "#FF5F7E", "#5FB8FF"];
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 260; i++) {
      c.save(); c.translate(rnd() * 256, rnd() * 256); c.rotate(rnd() * 3.14);
      c.fillStyle = cols[i % cols.length]; c.fillRect(-4, -1.3, 8, 2.6); c.restore();
    }
  });
}
export function checkerTex() {
  return canvasTex(128, 32, (c) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#1E1B3A" : "#FFFFFF"; c.fillRect(i * 8, j * 8, 8, 8); } }, false);
}

// ------------------------------------------------------------------ Momo the runner (parts animate separately)
export interface Rig { body: G; foot: G; arm: G; sprout: G }
export function momoRig(): Rig {
  const b: G[] = [];
  // body: origin at its bottom; Momo faces −z (we see the back while running)
  b.push(tint(sq(at(sphere(0.5, 28, 22), 0, 0.5, 0), 1, 1.08, 0.96), "#FF8A3D"));
  b.push(tint(sq(at(sphere(0.35, 20, 16), 0, 0.36, -0.27), 1.05, 1.05, 0.55), "#FFE6C9"));
  for (const sx of [-1, 1]) {
    b.push(tint(sq(at(sphere(0.15, 16, 12), sx * 0.17, 0.7, -0.36), 1, 1.12, 0.7), "#FFFFFF"));
    b.push(tint(at(sphere(0.085, 12, 10), sx * 0.165, 0.69, -0.45), "#1B1530"));
    b.push(tint(at(sphere(0.03, 8, 6), sx * 0.165 - 0.03, 0.73, -0.52), "#FFFFFF"));
    b.push(tint(sq(at(sphere(0.07, 10, 8), sx * 0.3, 0.55, -0.38), 1.3, 0.7, 0.4), "#FF8FA3"));
  }
  const m = new THREE.TorusGeometry(0.1, 0.025, 6, 14, Math.PI); m.rotateZ(Math.PI); m.rotateY(Math.PI); m.translate(0, 0.53, -0.47); b.push(tint(m, "#5A2A1A"));
  // a racing stripe and a little "M" patch on the back
  const band = new THREE.TorusGeometry(0.47, 0.035, 8, 40); band.rotateX(Math.PI / 2); band.scale(1, 1, 0.98); band.translate(0, 0.42, 0); b.push(tint(band, "#FFFFFF"));
  b.push(tint(sq(at(sphere(0.12, 14, 10), 0, 0.62, 0.45), 1, 1, 0.35), "#FFD23F"));
  const body = merge(b);
  // sneaker: red with a white sole and toe cap (origin under the ankle)
  const f: G[] = [];
  f.push(tint(at(rbox(0.26, 0.09, 0.4, 0.04), 0, 0.045, -0.04), "#FFFFFF"));
  f.push(tint(sq(at(sphere(0.15, 14, 10), 0, 0.13, -0.02), 0.9, 0.62, 1.35), "#FF3D5E"));
  f.push(tint(sq(at(sphere(0.08, 10, 8), 0, 0.11, -0.2), 1.1, 0.7, 0.8), "#FFFFFF"));
  for (let i = 0; i < 2; i++) f.push(tint(at(rbox(0.12, 0.02, 0.03, 0.01), 0, 0.2, -0.02 + i * 0.07), "#FFFFFF"));
  const foot = merge(f);
  const a: G[] = [];
  const arm = new THREE.CapsuleGeometry(0.065, 0.2, 4, 10); arm.translate(0, -0.13, 0); a.push(tint(arm, "#FF8A3D"));
  a.push(tint(at(sphere(0.085, 12, 10), 0, -0.28, 0), "#FFFFFF"));
  const armG = merge(a);
  const s: G[] = [];
  s.push(tint(at(cyl(0.025, 0.035, 0.2, 8), 0, 0.1, 0), "#3E9E3E"));
  for (const sx of [-1, 1]) { const leaf = sphere(1, 12, 8); leaf.scale(0.18, 0.05, 0.1); leaf.rotateZ(sx * 0.45); leaf.translate(sx * 0.13, 0.21, 0); s.push(tint(leaf, "#5CCB52")); }
  return { body, foot, arm: armG, sprout: merge(s) };
}

// ------------------------------------------------------------------ obstacles (origin: centre of the lane, on the ground, near edge at z=0 going −z)
/** obstacle skins: barrier/candy fences, sign/arch bars, crates/gifts blocks (more in models2.ts) */
export type WorldKey = string;
/** low fence to jump: depth 0.5, top 0.95 */
export function fence(w: WorldKey): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  if (w === "pier" || w === "barrier") {
    for (const sx of [-0.75, 0.75]) {
      for (const dz of [-0.05, -0.45]) { const leg = cyl(0.05, 0.05, 0.95, 8); leg.rotateX(dz < -0.2 ? 0.25 : -0.25); leg.translate(sx, 0.45, dz); p.push(tint(leg, "#E9E1D2")); }
    }
    for (let i = 0; i < 6; i++) p.push(tint(at(rbox(0.32, 0.26, 0.1, 0.03), -0.8 + i * 0.32, 0.72, -0.25), i % 2 ? "#FFFFFF" : "#FF3D4E"));
    for (const sx of [-0.85, 0.85]) gl.push(tint(at(sphere(0.07, 10, 8), sx, 0.95, -0.25), "#FFB347"));
  } else {
    for (let i = 0; i < 5; i++) {
      const post = cyl(0.07, 0.07, 0.95, 10); post.translate(-0.8 + i * 0.4, 0.475, -0.25);
      p.push(tint(post, i % 2 ? "#FFFFFF" : "#FF3D6E"));
      p.push(tint(at(sphere(0.11, 12, 10), -0.8 + i * 0.4, 0.98, -0.25), ["#FFD23F", "#7FE0D0", "#FF8FC7", "#9F7BFF", "#FFD23F"][i]));
    }
    for (const y of [0.45, 0.75]) { const r = rbox(1.9, 0.12, 0.1, 0.05); r.translate(0, y, -0.25); p.push(tint(r, "#FF8FC7")); }
  }
  return { g: merge(p), glow: gl.length ? merge(gl) : merge([tint(sphere(0.001, 3, 2), "#000")]) };
}
/** overhead bar to squish under: bottom 0.82 */
export function bar(w: WorldKey): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  if (w === "pier" || w === "sign") {
    for (const sx of [-0.92, 0.92]) p.push(tint(at(cyl(0.07, 0.08, 2.4, 10), sx, 1.2, -0.3), "#2B3A67"));
    p.push(tint(at(rbox(2.0, 0.62, 0.16, 0.06), 0, 1.2, -0.3), "#2FB5A8"));
    p.push(tint(at(rbox(1.7, 0.4, 0.18, 0.05), 0, 1.2, -0.3), "#FFF4DC"));
    for (let i = 0; i < 4; i++) p.push(tint(at(sphere(0.1, 12, 10), -0.5 + i * 0.33, 1.2, -0.17), ["#FF5F7E", "#FFD23F", "#3D8BFF", "#2FCB8B"][i]));
    for (let i = 0; i < 9; i++) gl.push(tint(at(sphere(0.045, 8, 6), -0.95 + i * 0.2375, 1.53, -0.2), "#FFE08A"));
    for (let i = 0; i < 9; i++) gl.push(tint(at(sphere(0.045, 8, 6), -0.95 + i * 0.2375, 0.87, -0.2), "#FFE08A"));
  } else {
    for (const sx of [-0.92, 0.92]) {
      for (let k = 0; k < 6; k++) p.push(tint(at(cyl(0.09, 0.09, 0.4, 12), sx, 0.2 + k * 0.4, -0.3), k % 2 ? "#FFFFFF" : "#FF3D6E"));
    }
    const tube = new THREE.TorusGeometry(0.92, 0.13, 10, 24, Math.PI); tube.translate(0, 2.35, -0.3); p.push(tint(tube, "#FF3D6E"));
    p.push(tint(at(rbox(1.84, 0.34, 0.3, 0.14), 0, 1.15, -0.3), "#6B2340"));
    for (let i = 0; i < 5; i++) p.push(tint(sq(at(sphere(0.13, 12, 10), -0.7 + i * 0.35, 1.38, -0.3), 1, 0.8, 1), ["#FFD23F", "#7FE0D0", "#FF8FC7", "#9F7BFF", "#5FB8FF"][i]));
    for (let i = 0; i < 7; i++) gl.push(tint(at(sphere(0.045, 8, 6), -0.8 + i * 0.27, 0.96, -0.12), "#FFF2A8"));
  }
  return { g: merge(p), glow: merge(gl) };
}
/** a block to dodge: 2.3 tall, 2 m deep, walkable top */
export function block(w: WorldKey): G {
  const p: G[] = [];
  if (w === "pier" || w === "crates") {
    const cr = (x: number, y: number, z: number, s: number, col: string) => {
      p.push(tint(at(rbox(s, s, s, 0.05), x, y + s / 2, z), col));
      for (const dy of [0.12, s - 0.12]) p.push(tint(at(rbox(s + 0.02, 0.07, s + 0.02, 0.02), x, y + dy, z), "#7A4A2A"));
      const xb = rbox(s * 1.25, 0.08, 0.03, 0.02); xb.rotateZ(0.78); xb.translate(x, y + s / 2, z + s / 2 + 0.01); p.push(tint(xb, "#7A4A2A"));
    };
    cr(-0.48, 0, -0.5, 0.92, "#C98A55"); cr(0.48, 0, -0.5, 0.92, "#B9774A"); cr(-0.48, 0, -1.45, 0.92, "#B9774A"); cr(0.48, 0, -1.45, 0.92, "#C98A55");
    cr(0, 0.92, -1.0, 0.95, "#D69A62");
    const bar2 = cyl(0.36, 0.36, 0.5, 16); bar2.translate(0.35, 2.12, -1.0); p.push(tint(bar2, "#2FB5A8"));
    p.push(tint(at(cyl(0.3, 0.3, 0.06, 16), 0.35, 2.38, -1.0), "#FFD23F"));
  } else {
    const gift = (x: number, y: number, z: number, s: number, col: string, rib: string) => {
      p.push(tint(at(rbox(s, s, s, 0.08), x, y + s / 2, z), col));
      p.push(tint(at(rbox(s + 0.02, s + 0.02, 0.14, 0.03), x, y + s / 2, z), rib));
      p.push(tint(at(rbox(0.14, s + 0.02, s + 0.02, 0.03), x, y + s / 2, z), rib));
    };
    gift(-0.45, 0, -0.95, 1.05, "#FF5FA2", "#FFFFFF"); gift(0.5, 0, -0.95, 1.0, "#7FE0D0", "#FF5FA2");
    gift(0, 1.03, -0.95, 1.15, "#9F7BFF", "#FFD23F");
    for (const sx of [-0.15, 0.15]) { const bow = sphere(0.16, 12, 10); bow.scale(1.3, 0.8, 0.8); bow.translate(sx, 2.25, -0.95); p.push(tint(bow, "#FFD23F")); }
  }
  return merge(p);
}
/** an oncoming go-kart with a Grumpy driver: faces +z (toward Momo), 2.6 m long, top 1.35 */
export function kart(w: WorldKey, colors?: [string, string]): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  const body = colors?.[0] ?? (w === "pier" ? "#2FB5A8" : "#FF5FA2"), trim = colors?.[1] ?? (w === "pier" ? "#FFFFFF" : "#FFE14D");
  p.push(tint(at(rbox(1.5, 0.55, 2.4, 0.22, 3), 0, 0.55, -1.3), body));
  p.push(tint(at(rbox(1.52, 0.12, 2.42, 0.05), 0, 0.62, -1.3), trim));
  p.push(tint(at(rbox(1.3, 0.35, 0.7, 0.15), 0, 0.82, -0.5), body));
  const glass = rbox(1.1, 0.4, 0.08, 0.04); glass.rotateX(-0.35); glass.translate(0, 1.08, -0.72); p.push(tint(glass, "#BFEFFF"));
  for (const [x, z] of [[-0.72, -0.5], [0.72, -0.5], [-0.72, -2.1], [0.72, -2.1]]) {
    const wh = cyl(0.3, 0.3, 0.22, 16); wh.rotateZ(Math.PI / 2); wh.translate(x, 0.3, z); p.push(tint(wh, "#2A2140"));
    const hub = cyl(0.13, 0.13, 0.24, 12); hub.rotateZ(Math.PI / 2); hub.translate(x, 0.3, z); p.push(tint(hub, "#E9E1D2"));
  }
  // the driver
  p.push(tint(sq(at(sphere(0.36, 16, 12), 0, 1.12, -1.35), 1, 0.92, 0.95), "#8E6BD8"));
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(0.1, 10, 8), sx * 0.12, 1.2, -1.05), 1, 1, 0.6), "#FFFFFF"));
    p.push(tint(at(sphere(0.05, 8, 6), sx * 0.11, 1.18, -0.99), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.17, 0.045, 0.05); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.12, 1.32, -1.03); p.push(tint(brow, "#2A2140"));
  }
  const wheel = new THREE.TorusGeometry(0.2, 0.04, 6, 16); wheel.rotateX(-0.6); wheel.translate(0, 1.0, -0.85); p.push(tint(wheel, "#2A2140"));
  if (w === "candy") { p.push(tint(at(cyl(0.22, 0.26, 0.3, 14), 0, 1.5, -1.35), "#FFFFFF")); p.push(tint(sq(at(sphere(0.3, 14, 10), 0, 1.72, -1.35), 1, 0.6, 1), "#FFFFFF")); }
  else { const flag = rbox(0.03, 0.9, 0.03, 0.01); flag.translate(0.6, 1.25, -2.3); p.push(tint(flag, "#E9E1D2")); p.push(tint(at(rbox(0.04, 0.26, 0.4, 0.02), 0.6, 1.58, -2.12), "#FF5F7E")); }
  for (const sx of [-0.5, 0.5]) gl.push(tint(at(sphere(0.12, 12, 10), sx, 0.62, -0.08), "#FFF6C8"));
  return { g: merge(p), glow: merge(gl) };
}
/** one row of jelly tram (n of these make a tram), roof at TRAM_H; faces +z */
export function tramSeg(len: number): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.86, 2.2, len - 0.04, 0.2, 3), 0, 1.25, -len / 2), "#FFFFFF"));
  for (const sx of [-0.94, 0.94]) for (let k = 0; k < 2; k++) p.push(tint(at(rbox(0.05, 0.55, len * 0.32, 0.03), sx, 1.55, -len * (0.27 + k * 0.46)), "#2B1D52"));
  p.push(tint(at(rbox(1.7, 0.1, len - 0.1, 0.04), 0, 2.38, -len / 2), "#FFFFFF"));
  return merge(p);
}
export function tramFront(): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  p.push(tint(at(rbox(1.7, 0.75, 0.08, 0.04), 0, 1.65, 0.02), "#BFEFFF"));
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(0.17, 14, 10), sx * 0.42, 1.68, 0.06), 1, 1.1, 0.5), "#FFFFFF"));
    p.push(tint(at(sphere(0.085, 10, 8), sx * 0.42, 1.66, 0.13), "#1B1530"));
    gl.push(tint(at(sphere(0.13, 12, 10), sx * 0.6, 0.6, 0.06), "#FFF6C8"));
  }
  const m = new THREE.TorusGeometry(0.16, 0.035, 6, 14, Math.PI); m.rotateZ(Math.PI); m.translate(0, 1.42, 0.08); p.push(tint(m, "#5A2A1A"));
  p.push(tint(at(rbox(1.9, 0.25, 0.2, 0.08), 0, 0.3, 0.05), "#FFD23F"));
  return { g: merge(p), glow: merge(gl) };
}
/** a ramp from the ground up to the tram roof over `len` metres (wedge) */
export function ramp(len: number, h: number): G {
  const g = new THREE.BufferGeometry();
  const w = 0.9;
  const v = [
    [-w, 0, 0], [w, 0, 0], [w, h, -len], [-w, h, -len], // slope
    [-w, 0, -len], [w, 0, -len], // back bottom
  ];
  const tri = (a: number, b: number, c: number) => [...v[a], ...v[b], ...v[c]];
  const pos = [
    ...tri(0, 1, 2), ...tri(0, 2, 3), // top
    ...tri(0, 3, 4), ...tri(1, 5, 2), // sides
    ...tri(4, 3, 2), ...tri(4, 2, 5), // back
  ];
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const out = tint(g, "#F2C27A");
  const p: G[] = [out];
  for (let i = 1; i < 6; i++) { const f = i / 6; const st = rbox(1.8, 0.05, 0.08, 0.02); st.rotateX(Math.atan2(h, len)); st.translate(0, h * f + 0.03, -len * f); p.push(tint(st, "#C98A4A")); }
  return merge(p);
}
/** a Grumpy standing in the lane (faces +z) */
export function grumpyStand(): G {
  const p: G[] = [];
  p.push(tint(sq(at(sphere(0.45, 20, 14), 0, 0.55, -0.4), 1, 0.95, 0.95), "#8E6BD8"));
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(0.12, 12, 10), sx * 0.15, 0.65, -0.05), 1, 1, 0.6), "#FFFFFF"));
    p.push(tint(at(sphere(0.06, 8, 6), sx * 0.14, 0.62, 0.02), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.21, 0.05, 0.06); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.15, 0.79, -0.02); p.push(tint(brow, "#2A2140"));
    p.push(tint(sq(at(sphere(0.12, 10, 8), sx * 0.2, 0.08, -0.35), 1.2, 0.6, 1.4), "#5A3EA8"));
  }
  const frown = new THREE.TorusGeometry(0.09, 0.024, 5, 12, Math.PI); frown.translate(0, 0.42, 0.02); p.push(tint(frown, "#2A2140"));
  return merge(p);
}
/** the Grumpy Guard who chases you after a stumble (faces −z, running after Momo) */
export function guard(): G {
  const p: G[] = [];
  p.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.62, 0), 1, 0.95, 0.95), "#6B4FC8"));
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(0.13, 12, 10), sx * 0.17, 0.74, -0.42), 1, 1, 0.6), "#FFFFFF"));
    p.push(tint(at(sphere(0.065, 8, 6), sx * 0.16, 0.72, -0.5), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.22, 0.05, 0.06); brow.rotateZ(-sx * 0.5); brow.translate(sx * 0.17, 0.9, -0.46); p.push(tint(brow, "#2A2140"));
  }
  p.push(tint(at(cyl(0.42, 0.46, 0.22, 18), 0, 1.12, 0), "#2B3A8F"));
  p.push(tint(sq(at(cyl(0.5, 0.5, 0.05, 18), 0, 1.02, -0.18), 1, 1, 0.75), "#1E2A66"));
  p.push(tint(at(sphere(0.07, 8, 6), 0, 1.18, -0.42), "#FFD23F"));
  const wh = cyl(0.05, 0.07, 0.22, 10); wh.rotateX(Math.PI / 2); wh.translate(0, 0.5, -0.58); p.push(tint(wh, "#C0C8D8"));
  return merge(p);
}

// ------------------------------------------------------------------ pickups
export function coin(): G {
  const p: G[] = [];
  const disc = cyl(0.36, 0.36, 0.09, 28); disc.rotateX(Math.PI / 2); p.push(tint(disc, "#FFC21A"));
  const rim = new THREE.TorusGeometry(0.33, 0.045, 8, 28); p.push(tint(rim, "#FFE27A"));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.09 : 0.2; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (const z of [0.05, -0.05]) { const st = new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }); st.translate(0, 0, z > 0 ? 0.035 : -0.065); p.push(tint(st, "#FFF2B0")); }
  return merge(p);
}
export function bubble(): G { return sphere(0.62, 28, 20); }
export function powerIcon(id: string): G {
  const p: G[] = [];
  if (id === "magnet") {
    const u = new THREE.TorusGeometry(0.22, 0.09, 10, 18, Math.PI); u.rotateZ(Math.PI); p.push(tint(u, "#FF3D4E"));
    for (const sx of [-0.22, 0.22]) { p.push(tint(at(cyl(0.09, 0.09, 0.18, 12), sx, 0.09, 0), "#FF3D4E")); p.push(tint(at(cyl(0.092, 0.092, 0.1, 12), sx, 0.22, 0), "#E9E1D2")); }
  } else if (id === "shield") {
    p.push(tint(sq(sphere(0.26, 18, 14), 1, 1.15, 0.5), "#4FC3FF"));
    p.push(tint(sq(at(sphere(0.12, 12, 10), 0, 0.02, 0.1), 1, 1, 0.5), "#FFFFFF"));
  } else if (id === "double") {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.13 : 0.3; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const st = new THREE.ExtrudeGeometry(star, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); st.translate(0, 0, -0.05); p.push(tint(st, "#FFC21A"));
  } else {
    for (const [x, y, r] of [[-0.16, 0, 0.17], [0.05, 0.07, 0.21], [0.22, -0.02, 0.15], [0, -0.08, 0.16]] as const) p.push(tint(at(sphere(r, 14, 10), x, y, 0), "#FFFFFF"));
    for (const sx of [-1, 1]) { const wg = sphere(0.14, 10, 8); wg.scale(1, 0.45, 0.25); wg.rotateZ(sx * 0.5); wg.translate(sx * 0.36, 0.12, 0); p.push(tint(wg, "#B58CFF")); }
  }
  return merge(p);
}
export function letterGeo(ch: string): G {
  const p: G[] = [];
  if (ch === "O") { const o = new THREE.TorusGeometry(0.3, 0.11, 12, 26); p.push(tint(o, "#FF5FA2")); }
  else {
    for (const sx of [-0.3, 0.3]) p.push(tint(at(new THREE.CapsuleGeometry(0.09, 0.55, 4, 10), sx, 0, 0), "#3FD3C8"));
    for (const sx of [-1, 1]) { const d = new THREE.CapsuleGeometry(0.085, 0.36, 4, 10); d.rotateZ(sx * 0.62); d.translate(sx * 0.15, 0.1, 0); p.push(tint(d, "#3FD3C8")); }
  }
  return merge(p);
}
export function cage(): G {
  const p: G[] = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.push(tint(at(cyl(0.035, 0.035, 1.3, 6), Math.cos(a) * 0.62, 0.75, Math.sin(a) * 0.62), "#FFC21A")); }
  for (const y of [0.1, 1.4]) { const r = new THREE.TorusGeometry(0.62, 0.06, 6, 24); r.rotateX(Math.PI / 2); r.translate(0, y, 0); p.push(tint(r, "#FFB000")); }
  p.push(tint(sq(at(sphere(0.66, 18, 10, ), 0, 1.4, 0), 1, 0.45, 1), "#FFC21A"));
  p.push(tint(at(sphere(0.1, 10, 8), 0, 1.75, 0), "#FF5F7E"));
  return merge(p);
}
export function pad(): { g: G; glow: G } {
  const base = tint(at(rbox(1.7, 0.1, 1.6, 0.05), 0, 0.05, -0.8), "#2B1D52");
  const gl: G[] = [];
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { const c = rbox(0.55, 0.06, 0.14, 0.03); c.rotateY(sx * 0.6); c.translate(sx * 0.22, 0.12, -0.35 - i * 0.42); gl.push(tint(c, "#7CFFB2")); }
  return { g: merge([base]), glow: merge(gl) };
}
/** the finish gate across the track */
export function gateGeo(): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  for (const sx of [-4.4, 4.4]) {
    for (let k = 0; k < 9; k++) p.push(tint(at(cyl(0.32, 0.32, 0.5, 18), sx, 0.25 + k * 0.5, 0), k % 2 ? "#FFFFFF" : "#FF5F7E"));
    p.push(tint(at(sphere(0.48, 18, 14), sx, 4.75, 0), "#FFD23F"));
    for (let b = 0; b < 4; b++) { const ba = sphere(0.36, 16, 12); ba.scale(1, 1.15, 1); ba.translate(sx + (b - 1.5) * 0.45, 5.6 + (b % 2) * 0.4, (b % 2) * 0.2); p.push(tint(ba, ["#FF5F7E", "#3D8BFF", "#2FCB8B", "#FFD23F"][b])); }
  }
  for (let i = 0; i < 22; i++) gl.push(tint(at(sphere(0.07, 8, 6), -4.1 + i * 0.39, 4.85, 0.2), i % 2 ? "#FFE08A" : "#FF9FC8"));
  return { g: merge(p), glow: merge(gl) };
}
export function gateBanner(): G { const g = new THREE.PlaneGeometry(8.4, 1.1); g.translate(0, 4.2, 0.05); return g; }

// ------------------------------------------------------------------ scenery: Sunset Pier
export interface Part { g: G; mat: string }
/** a seaside shop: textured walls (windows), a roof, a striped awning and a little sign; faces +x (toward the track) */
export function shop(v: number): Part[] {
  const w = [5.2, 4.4, 6.0, 4.8][v % 4], h = [3.4, 4.6, 3.0, 5.6][v % 4], d = 5;
  const walls = rbox(d, h, w, 0.08); walls.translate(-d / 2, h / 2, 0);
  const roof: G[] = [];
  if (v % 2 === 0) {
    const r = new THREE.CylinderGeometry(0.01, d * 0.72, 1.6, 4, 1); r.rotateY(Math.PI / 4); r.scale(1, 1, w / d * 1.02); r.translate(-d / 2, h + 0.8, 0); roof.push(tint(r, ["#2B3A67", "#B03A48", "#2F6F6A", "#5B3A8F"][v % 4]));
  } else {
    roof.push(tint(at(rbox(d + 0.3, 0.35, w + 0.3, 0.08), -d / 2, h + 0.17, 0), "#E9E1D2"));
    for (let i = 0; i < 5; i++) roof.push(tint(at(sphere(0.18, 10, 8), 0.05, h + 0.35, -w / 2 + 0.5 + i * (w - 1) / 4), "#FFFFFF"));
  }
  roof.push(tint(at(rbox(0.25, 0.9, w * 0.55, 0.06), 0.1, h - 0.2, 0), "#FFF4DC"));
  const aw = new THREE.PlaneGeometry(1.6, w * 0.92, 1, 1); aw.rotateY(Math.PI / 2); aw.rotateZ(-0.55); aw.translate(0.62, 2.35, 0);
  const awn = tint(aw, "#FFFFFF");
  const posts: G[] = [];
  for (const sz of [-w * 0.42, w * 0.42]) posts.push(tint(at(cyl(0.05, 0.05, 2.0, 8), 1.25, 1.0, sz), "#E9E1D2"));
  posts.push(tint(at(rbox(0.6, 0.9, 1.2, 0.05), 0.35, 0.45, 0), "#7A4A2A"));
  return [{ g: walls, mat: "wall" }, { g: merge(roof), mat: "clay" }, { g: awn, mat: `awning${v % 3}` }, { g: merge(posts), mat: "clay" }];
}
export function lampPost(): { g: G; glow: G } {
  const p: G[] = [];
  p.push(tint(at(cyl(0.09, 0.13, 3.6, 10), 0, 1.8, 0), "#2B3A67"));
  p.push(tint(at(cyl(0.2, 0.25, 0.2, 10), 0, 0.1, 0), "#2B3A67"));
  p.push(tint(at(cyl(0.06, 0.24, 0.25, 10), 0, 3.95, 0), "#2B3A67"));
  return { g: merge(p), glow: merge([tint(at(sphere(0.2, 14, 10), 0, 3.7, 0), "#FFD58A")]) };
}
export function railing(len: number): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.14, 0.12, len, 0.04), 0, 1.0, -len / 2), "#F2E6D0"));
  p.push(tint(at(rbox(0.08, 0.08, len, 0.03), 0, 0.55, -len / 2), "#F2E6D0"));
  p.push(tint(at(cyl(0.07, 0.07, 1.05, 8), 0, 0.52, 0), "#F2E6D0"));
  return merge(p);
}
export function bench(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.5, 0.07, 1.8, 0.02), 0, 0.5, 0), "#B9774A"), tint(at(rbox(0.07, 0.42, 1.8, 0.02), -0.25, 0.76, 0), "#B9774A"));
  for (const sz of [-0.75, 0.75]) p.push(tint(at(rbox(0.5, 0.5, 0.08, 0.02), 0, 0.25, sz), "#2B3A67"));
  return merge(p);
}
export function barrel(): G {
  const p: G[] = [tint(at(cyl(0.38, 0.38, 0.9, 16), 0, 0.45, 0), "#B9774A")];
  for (const y of [0.15, 0.75]) p.push(tint(at(cyl(0.4, 0.4, 0.07, 16), 0, y, 0), "#4A3A3A"));
  p.push(tint(at(sphere(0.18, 10, 8), 0, 1.0, 0), "#FF8FA3"), tint(at(sphere(0.16, 10, 8), 0.15, 1.05, 0.1), "#FFD23F"));
  return merge(p);
}
export function boat(): G {
  const p: G[] = [];
  const hull = new THREE.CylinderGeometry(1.2, 0.7, 1.0, 14, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateY(Math.PI / 2); hull.scale(2.6, 1, 1); hull.translate(0, 0.2, 0); p.push(tint(hull, "#FFFFFF"));
  p.push(tint(at(rbox(4.6, 0.12, 2.0, 0.05), 0, 0.72, 0), "#3D8BFF"));
  p.push(tint(at(rbox(1.6, 0.9, 1.4, 0.1), -0.6, 1.2, 0), "#FFFFFF"));
  p.push(tint(at(cyl(0.05, 0.05, 3.2, 6), 0.8, 2.1, 0), "#E9E1D2"));
  const sail = new THREE.ConeGeometry(1.1, 2.6, 3); sail.scale(1, 1, 0.08); sail.translate(1.4, 2.1, 0); p.push(tint(sail, "#FFD9C2"));
  return merge(p);
}
/** a big lit Ferris wheel for the skyline (faces +x) */
export function ferris(): { g: G; glow: G } {
  const p: G[] = [], gl: G[] = [];
  const R = 11;
  const ring = new THREE.TorusGeometry(R, 0.28, 8, 56); ring.rotateY(Math.PI / 2); ring.translate(0, R + 3, 0); p.push(tint(ring, "#E9E1D2"));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sp = cyl(0.08, 0.08, R, 6); sp.translate(0, R / 2, 0); sp.rotateX(a); sp.translate(0, R + 3, 0); p.push(tint(sp, "#E9E1D2"));
    const cab = sphere(0.7, 12, 10); cab.translate(0, R + 3 + Math.cos(a) * R, Math.sin(a) * R); p.push(tint(cab, ["#FF5F7E", "#FFD23F", "#3D8BFF", "#2FCB8B"][i % 4]));
    for (let k = 0; k < 3; k++) { const b = (i + k / 3) / 16 * Math.PI * 2; gl.push(tint(at(sphere(0.22, 8, 6), 0.3, R + 3 + Math.cos(b) * R, Math.sin(b) * R), k % 2 ? "#FFD58A" : "#FF9FC8")); }
  }
  for (const sz of [-4, 4]) { const leg = cyl(0.3, 0.45, R + 4, 8); leg.rotateX(sz > 0 ? -0.32 : 0.32); leg.translate(0, (R + 3) / 2, sz * 0.9); p.push(tint(leg, "#2B3A67")); }
  return { g: merge(p), glow: merge(gl) };
}
export function lighthouse(): { g: G; glow: G } {
  const p: G[] = [];
  for (let k = 0; k < 6; k++) p.push(tint(at(cyl(1.4 - k * 0.12, 1.5 - k * 0.12, 2.2, 18), 0, 1.1 + k * 2.2, 0), k % 2 ? "#FFFFFF" : "#E8504F"));
  p.push(tint(at(cyl(1.0, 1.0, 0.3, 18), 0, 13.4, 0), "#2B3A67"));
  p.push(tint(at(new THREE.ConeGeometry(1.1, 1.4, 18), 0, 15.6, 0), "#E8504F"));
  return { g: merge(p), glow: merge([tint(at(cyl(0.75, 0.75, 1.3, 16), 0, 14.2, 0), "#FFF2C0")]) };
}
/** distant town blocks with lit windows (cheap silhouettes) */
export function skylineBlock(v: number): G {
  const w = 6 + (v % 3) * 3, h = 8 + ((v * 7) % 5) * 4;
  const g = rbox(w, h, 6, 0.3); g.translate(0, h / 2, 0);
  return g;
}

// ------------------------------------------------------------------ scenery: Candy Town
export function candyHouse(v: number): Part[] {
  const w = [5.0, 4.4, 5.8, 4.6][v % 4], h = [3.4, 4.2, 3.0, 4.8][v % 4], d = 4.6;
  const walls = rbox(d, h, w, 0.12); walls.translate(-d / 2, h / 2, 0);
  const roof: G[] = [];
  const rc = ["#FF8FC7", "#7FE0D0", "#B9A6FF", "#FFD23F"][v % 4];
  const r = new THREE.CylinderGeometry(0.01, d * 0.78, 2.0, 4, 1); r.rotateY(Math.PI / 4); r.scale(1, 1, w / d * 1.05); r.translate(-d / 2, h + 1.0, 0); roof.push(tint(r, rc));
  for (let i = 0; i < 7; i++) roof.push(tint(sq(at(sphere(0.22, 10, 8), 0.12, h - 0.05, -w / 2 + 0.3 + i * (w - 0.6) / 6), 1, 1.5, 1), rc));
  roof.push(tint(sq(at(sphere(0.42, 14, 10), -d / 2, h + 2.0, 0), 1, 0.9, 1), ["#FF5F7E", "#2FCB8B", "#FFD23F", "#9F7BFF"][v % 4]));
  // icing trim around the door and windows
  roof.push(tint(at(rbox(0.2, 1.7, 1.2, 0.08), 0.05, 0.85, 0), "#FFFFFF"));
  roof.push(tint(at(rbox(0.22, 1.5, 0.95, 0.08), 0.1, 0.75, 0), "#FF5FA2"));
  for (const sz of [-w * 0.32, w * 0.32]) { const l = cyl(0.12, 0.12, 2.6, 12); l.translate(0.2, 1.3, sz); roof.push(tint(l, "#FFFFFF")); for (let k = 0; k < 4; k++) { const st = new THREE.TorusGeometry(0.125, 0.03, 4, 12); st.rotateX(Math.PI / 2); st.translate(0.2, 0.4 + k * 0.6, sz); roof.push(tint(st, "#FF3D6E")); } }
  return [{ g: walls, mat: "wall" }, { g: merge(roof), mat: "clay" }];
}
export function lollipop(v: number): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.08, 0.08, 3.2, 8), 0, 1.6, 0), "#FFFFFF"));
  const disc = cyl(1.0, 1.0, 0.25, 26); disc.rotateZ(Math.PI / 2); disc.translate(0, 3.9, 0); p.push(tint(disc, ["#FF5F7E", "#7FE0D0", "#FFD23F", "#B9A6FF"][v % 4]));
  for (let k = 0; k < 3; k++) { const t = new THREE.TorusGeometry(0.25 + k * 0.25, 0.06, 6, 24); t.rotateY(Math.PI / 2); t.translate(0.14, 3.9, 0); p.push(tint(t, "#FFFFFF")); }
  return merge(p);
}
export function candyLamp(): { g: G; glow: G } {
  const p: G[] = [];
  for (let k = 0; k < 8; k++) p.push(tint(at(cyl(0.11, 0.11, 0.45, 10), 0, 0.22 + k * 0.45, 0), k % 2 ? "#FFFFFF" : "#FF3D6E"));
  const hook = new THREE.TorusGeometry(0.35, 0.11, 8, 16, Math.PI); hook.translate(0.35, 3.6, 0); p.push(tint(hook, "#FF3D6E"));
  return { g: merge(p), glow: merge([tint(at(sphere(0.22, 12, 10), 0.7, 3.3, 0), "#FFF2C0")]) };
}
export function gumdrop(c: string): G { const g = sphere(0.6, 16, 10, ); g.scale(1, 0.85, 1); g.translate(0, 0.3, 0); return merge([tint(g, c)]); }
export function cupcakeTower(): G {
  const p: G[] = [];
  p.push(tint(at(cyl(4.5, 3.6, 5, 24), 0, 2.5, 0), "#C98A55"));
  for (let k = 0; k < 4; k++) p.push(tint(sq(at(sphere(4.6 - k * 1.0, 22, 14), 0, 5.5 + k * 1.9, 0), 1, 0.55, 1), k % 2 ? "#FFFFFF" : "#FF8FC7"));
  p.push(tint(at(sphere(0.9, 14, 10), 0, 13.2, 0), "#FF3D4E"));
  return merge(p);
}
export function candyMountain(c: string): G {
  const p: G[] = [];
  const m = new THREE.ConeGeometry(18, 26, 9); m.translate(0, 13, 0); p.push(tint(m, c));
  const cap = new THREE.ConeGeometry(7.2, 10.4, 9); cap.translate(0, 21, 0); p.push(tint(cap, "#FFFFFF"));
  return merge(p);
}
/** soft cloud puffs for the sky */
export function cloudPuff(): G {
  const p: G[] = [];
  for (const [x, y, r] of [[0, 0, 3], [3.2, -0.6, 2.4], [-3.2, -0.5, 2.3], [1.4, 1.4, 2.2], [-1.6, 1.1, 2.0]] as const) p.push(tint(at(sphere(r, 14, 10), x, y, 0), "#FFFFFF"));
  return merge(p);
}
