// Slurp Lab models, built in code with vertex colours: glossy jelly Gloopies (with a colour-blind symbol on the belly),
// their eyes, the lab tray (tiles follow the board's shape), frosted glass walls, colour gates, the Slurpers' glass
// and neon rims, and the things floating in each lab's backdrop. Origin of a cell piece = the cell's centre on the tray.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";
import { DIRS } from "./types";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const at = <X extends G>(g: X, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <X extends G>(g: X, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rbox = (w: number, h: number, d: number, r = 0.08, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const shade = (hex: string, k: number) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };
const lighten = (hex: string, k: number) => { const c = new THREE.Color(hex); c.lerp(new THREE.Color("#ffffff"), k); return `#${c.getHexString()}`; };

/** the tile on top of the tray: a glossy rounded square, its top at y = 0 */
export function tileGeo(): G { return tint(at(rbox(0.94, 0.16, 0.94, 0.07), 0, -0.08, 0), "#ffffff"); }
/** the tray under a cell: a bit wider so neighbours join into one slab */
export function trayGeo(): G { return tint(at(rbox(1.04, 0.42, 1.04, 0.12), 0, -0.3, 0), "#ffffff"); }
/** a frosted glass wall block */
export function wallGeo(): G {
  const p: G[] = [tint(at(rbox(0.9, 0.62, 0.9, 0.14), 0, 0.31, 0), "#DDE8FF")];
  p.push(tint(at(rbox(0.7, 0.05, 0.7, 0.02), 0, 0.63, 0), "#FFFFFF"));
  return merge(p);
}
/** a colour gate: two posts and a glowing arch (the film is drawn by the renderer) */
export function gatePostsGeo(): G {
  const p: G[] = [];
  for (const sx of [-1, 1]) { p.push(tint(at(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 10), sx * 0.42, 0.31, 0), "#F1F3F5")); p.push(tint(at(sphere(0.09, 10, 8), sx * 0.42, 0.65, 0), "#FFFFFF")); }
  const arch = new THREE.TorusGeometry(0.42, 0.04, 8, 20, Math.PI); arch.translate(0, 0.62, 0); p.push(tint(arch, "#FFFFFF"));
  return merge(p);
}

// ------------------------------------------------------------------ Gloopies
function symbolGeo(kind: string): G {
  // a small flat shape on the belly, lying on +z (the renderer turns the Gloopy to face the camera)
  const s = 0.11;
  let g: G;
  switch (kind) {
    case "heart": { const sh = new THREE.Shape(); sh.moveTo(0, -s); sh.bezierCurveTo(-s * 1.6, s * 0.2, -s * 0.6, s * 1.3, 0, s * 0.5); sh.bezierCurveTo(s * 0.6, s * 1.3, s * 1.6, s * 0.2, 0, -s); g = new THREE.ShapeGeometry(sh, 8); break; }
    case "star": { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.45 : s; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g = new THREE.ShapeGeometry(sh); break; }
    case "drop": { const sh = new THREE.Shape(); sh.moveTo(0, s * 1.1); sh.bezierCurveTo(s * 0.9, 0, s * 0.8, -s, 0, -s); sh.bezierCurveTo(-s * 0.8, -s, -s * 0.9, 0, 0, s * 1.1); g = new THREE.ShapeGeometry(sh, 8); break; }
    case "leaf": { const sh = new THREE.Shape(); sh.moveTo(-s, -s * 0.6); sh.quadraticCurveTo(-s, s, s, s * 0.8); sh.quadraticCurveTo(s * 0.9, -s * 0.8, -s, -s * 0.6); g = new THREE.ShapeGeometry(sh, 8); break; }
    case "moon": { const sh = new THREE.Shape(); sh.absarc(0, 0, s, Math.PI * 0.35, Math.PI * 1.65, false); sh.absarc(s * 0.45, 0, s * 0.75, Math.PI * 1.45, Math.PI * 0.55, true); g = new THREE.ShapeGeometry(sh, 10); break; }
    case "triangle": g = new THREE.CircleGeometry(s * 1.1, 3); g.rotateZ(Math.PI / 2); break;
    case "square": g = new THREE.PlaneGeometry(s * 1.5, s * 1.5); break;
    default: g = new THREE.RingGeometry(s * 0.5, s, 16);
  }
  return g;
}
/** a Gloopy: a glossy jelly drop sitting on the tile, with a lighter belly and a symbol; faces +z */
export function gloopyGeo(color: string, symbol: string): G {
  const p: G[] = [];
  const body = sphere(0.38, 26, 20);
  // a soft teardrop: flatter bottom, a little peak on top
  const pos = body.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = y < 0 ? 0.78 : 1 + Math.max(0, y - 0.22) * 0.9;
    pos.setY(i, y * k);
    const pinch = y > 0.2 ? 1 - (y - 0.2) * 0.9 : 1;
    pos.setX(i, pos.getX(i) * pinch); pos.setZ(i, pos.getZ(i) * pinch);
  }
  body.computeVertexNormals();
  p.push(tint(at(body, 0, 0.3, 0), color));
  p.push(tint(sq(at(sphere(0.22, 16, 12), 0, 0.24, 0.17), 1, 0.85, 0.55), lighten(color, 0.35)));
  const sym = symbolGeo(symbol); sym.scale(0.85, 0.85, 1); sym.translate(0, 0.19, 0.305); p.push(tint(sym, lighten(color, 0.45)));
  // cheeks
  for (const sx of [-1, 1]) p.push(tint(sq(at(sphere(0.06, 8, 6), sx * 0.2, 0.33, 0.29), 1, 0.6, 0.4), "#FF9FB8"));
  // a tiny smile
  const smile = new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI); smile.rotateZ(Math.PI); smile.translate(0, 0.36, 0.34); p.push(tint(smile, shade(color, 0.35)));
  return merge(p);
}
/** both eyes (white, pupil, sparkle) — a separate instanced mesh so they can blink */
export function eyesGeo(): G {
  const p: G[] = [];
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(0.085, 14, 10), sx * 0.12, 0, 0), 1, 1.15, 0.6), "#FFFFFF"));
    p.push(tint(sq(at(sphere(0.052, 12, 8), sx * 0.12, -0.01, 0.04), 1, 1.15, 0.5), "#1B1530"));
    p.push(tint(at(sphere(0.018, 6, 4), sx * 0.12 + 0.02, 0.025, 0.07), "#FFFFFF"));
  }
  return merge(p);
}

// ------------------------------------------------------------------ Slurpers
/** the glass body: one rounded slab per cell (cells relative to the Slurper's anchor, x → x, y → z) */
export function slurperGlassGeo(cells: [number, number][]): G {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const p: G[] = [];
  for (const [x, y] of cells) {
    p.push(at(rbox(0.9, 0.3, 0.9, 0.08), x, 0.17, y));
    // bridges between neighbouring cells so the glass is one piece
    if (set.has(`${x + 1},${y}`)) p.push(at(rbox(0.22, 0.3, 0.9, 0.04), x + 0.5, 0.17, y));
    if (set.has(`${x},${y + 1}`)) p.push(at(rbox(0.9, 0.3, 0.22, 0.04), x, 0.17, y + 0.5));
  }
  return merge(p.map((g) => tint(g, "#ffffff")));
}
/** the neon rim: bars along the outline and round posts at the corners */
export function slurperRimGeo(cells: [number, number][]): G {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const p: G[] = [], posts = new Set<string>();
  const t = 0.11, y0 = 0.34, hw = 0.47;
  for (const [x, y] of cells) {
    DIRS.forEach(([dx, dy]) => {
      if (set.has(`${x + dx},${y + dy}`)) return;
      const horiz = dy !== 0;
      const bar = new THREE.BoxGeometry(horiz ? 0.96 : t, t, horiz ? t : 0.96);
      bar.translate(x + dx * hw, y0, y + dy * hw);
      p.push(bar);
      // corner posts at both ends of this edge
      const ends = horiz ? [[x - hw, y + dy * hw], [x + hw, y + dy * hw]] : [[x + dx * hw, y - hw], [x + dx * hw, y + hw]];
      for (const [ex, ey] of ends) { const k = `${ex.toFixed(2)},${ey.toFixed(2)}`; if (!posts.has(k)) { posts.add(k); p.push(at(new THREE.CylinderGeometry(t * 0.62, t * 0.62, t, 10), ex, y0, ey)); } }
    });
  }
  return merge(p.map((g) => tint(g, "#ffffff")));
}

// ------------------------------------------------------------------ backdrop floaters
export function floaterGeo(kind: string): G {
  switch (kind) {
    case "sprinkles": return tint(new THREE.CapsuleGeometry(0.08, 0.35, 4, 8), "#ffffff");
    case "leaves": { const g = sq(sphere(0.3, 10, 6), 1, 0.15, 0.6); return tint(g, "#ffffff"); }
    case "crystals": return tint(new THREE.OctahedronGeometry(0.35, 0), "#ffffff");
    case "fish": { const p: G[] = [sq(sphere(0.3, 12, 8), 1.4, 0.8, 0.6)]; const tail = new THREE.ConeGeometry(0.2, 0.3, 6); tail.rotateZ(Math.PI / 2); tail.translate(-0.5, 0, 0); p.push(tail); return merge(p.map((g) => tint(g, "#ffffff"))); }
    default: return tint(sphere(0.3, 14, 10), "#ffffff");
  }
}
export { sphere, at, sq, rbox, lighten, shade };

// ------------------------------------------------------------------ Phase 2: Gloopy twists
/** a rainbow Gloopy: the same jelly drop in stripes of every colour */
export function rainbowGloopyGeo(): G {
  const g = gloopyGeo("#ffffff", "star");
  const pos = g.getAttribute("position") as THREE.BufferAttribute, col = g.getAttribute("color") as THREE.BufferAttribute;
  const bands = ["#FF3B5C", "#FF7A1A", "#FFC300", "#4CD137", "#16B8F3", "#8C4DF0"].map((h) => new THREE.Color(h));
  for (let i = 0; i < pos.count; i++) {
    const c = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i));
    // only the body (near-white) gets the stripes; eyes' cheeks and smile keep their colours
    if (c.r > 0.9 && c.g > 0.9 && c.b > 0.9) { const k = Math.max(0, Math.min(bands.length - 1, Math.floor((pos.getY(i) / 0.85) * bands.length))); col.setXYZ(i, bands[k].r, bands[k].g, bands[k].b); }
  }
  col.needsUpdate = true;
  return g;
}
/** the soap bubble around a bubbled Gloopy */
export function bubbleShellGeo(): G { return tint(at(sphere(0.47, 22, 16), 0, 0.33, 0), "#ffffff"); }
/** the frost shell over a frosted Gloopy (with a few crystals) */
export function frostShellGeo(): G {
  const p: G[] = [tint(at(sq(sphere(0.43, 18, 14), 1, 1.12, 1), 0, 0.33, 0), "#F1F8FF")];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(tint(at(new THREE.OctahedronGeometry(0.07, 0), Math.cos(a) * 0.3, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.3), "#CFE8FF")); }
  return merge(p);
}
/** a bomb Gloopy's cap and wick */
export function bombCapGeo(): G {
  const p: G[] = [tint(at(sq(sphere(0.2, 14, 10), 1, 0.55, 1), 0, 0.74, 0), "#2B2B38")];
  p.push(tint(at(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), 0.05, 0.9, 0), "#C8A060"));
  p.push(tint(at(sphere(0.05, 8, 6), 0.07, 1.0, 0), "#FFB000"));
  return merge(p);
}
/** the little top Gloopy on a double */
export function doubleTopGeo(color: string, symbol: string): G { const g = gloopyGeo(color, symbol); g.scale(0.62, 0.62, 0.62); g.translate(0, 0.5, 0); return g; }

// ------------------------------------------------------------------ Phase 2: tiles and gadgets (centred on the cell, top of the tray at y = 0)
export function arrowDecalGeo(): G { const sh = new THREE.Shape(); sh.moveTo(0, 0.32); sh.lineTo(0.26, 0.02); sh.lineTo(0.1, 0.02); sh.lineTo(0.1, -0.3); sh.lineTo(-0.1, -0.3); sh.lineTo(-0.1, 0.02); sh.lineTo(-0.26, 0.02); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, 0.01, 0); return tint(g, "#ffffff"); }
export function turnDecalGeo(): G { const p: G[] = []; const ring = new THREE.TorusGeometry(0.26, 0.05, 6, 24, Math.PI * 1.5); ring.rotateX(Math.PI / 2); ring.translate(0, 0.03, 0); p.push(ring); const head = new THREE.ConeGeometry(0.1, 0.2, 10); head.rotateZ(Math.PI / 2); head.rotateY(Math.PI / 2); head.translate(0.26, 0.03, 0.06); p.push(head); return merge(p.map((g) => tint(g, "#ffffff"))); }
export function chevronGeo(): G { const p: G[] = []; for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.26, 0.03, 0.07); b.rotateY(sx * 0.7); b.translate(sx * 0.09, 0.02, 0.06); p.push(b); } return merge(p.map((g) => tint(g, "#ffffff"))); }
export function portalGeo(): G { const p: G[] = [tint(at(new THREE.TorusGeometry(0.34, 0.07, 10, 28).rotateX(Math.PI / 2), 0, 0.06, 0), "#ffffff")]; p.push(tint(at(new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2), 0, 0.03, 0), "#B9A8FF")); return merge(p); }
export function gooGeo(): G { const p: G[] = [tint(at(sq(sphere(0.4, 16, 8), 1, 0.12, 1), 0, 0.02, 0), "#FFB733")]; for (const [x, z] of [[0.2, 0.15], [-0.18, -0.1], [0.05, -0.22]]) p.push(tint(at(sq(sphere(0.12, 10, 6), 1, 0.4, 1), x, 0.05, z), "#FFD27A")); return merge(p); }
export function splatGeo(): G { const sh = new THREE.Shape(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 0.24 : 0.36; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0); return tint(g, "#ffffff"); }
export function switchGeo(): G { return merge([tint(at(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 20), 0, 0.04, 0), "#E9ECEF"), tint(at(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 20), 0, 0.12, 0), "#ffffff")]); }
export function swBlockGeo(): G { return tint(at(rbox(0.88, 0.6, 0.88, 0.12), 0, 0.3, 0), "#ffffff"); }
export function glassBlockGeo(): G {
  const p: G[] = [tint(at(rbox(0.88, 0.56, 0.88, 0.1), 0, 0.28, 0), "#BFE8FF")];
  for (let i = 0; i < 4; i++) { const k = rbox(0.03, 0.4, 0.03, 0.01); k.rotateZ((i % 2 ? 1 : -1) * (0.5 + i * 0.2)); k.translate(-0.25 + i * 0.17, 0.3, 0.45); p.push(tint(k, "#FFFFFF")); }
  return merge(p);
}
export function crumbleGeo(): G { return tint(at(rbox(0.92, 0.12, 0.92, 0.05), 0, -0.04, 0), "#ffffff"); }
export function fenceGeo(): G { return merge([tint(at(rbox(0.1, 0.5, 0.96, 0.04), 0, 0.25, 0), "#E7F5FF"), tint(at(rbox(0.12, 0.06, 0.98, 0.02), 0, 0.52, 0), "#FFFFFF")]); }
export function crateGeo(): G {
  const p: G[] = [tint(at(rbox(0.84, 0.7, 0.84, 0.1), 0, 0.35, 0), "#E8A960")];
  for (const y of [0.12, 0.58]) p.push(tint(at(rbox(0.88, 0.08, 0.88, 0.03), 0, y, 0), "#B9773A"));
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) p.push(tint(at(rbox(0.09, 0.72, 0.09, 0.03), x, 0.35, z), "#B9773A"));
  return merge(p);
}
/** a link (chain) between two Slurpers: a thin glowing bar, stretched by the renderer along x */
export function linkBarGeo(): G { return tint(new THREE.CylinderGeometry(0.05, 0.05, 1, 8).rotateZ(Math.PI / 2), "#ffffff"); }
export function floater2Geo(kind: string): G {
  switch (kind) {
    case "snow": return tint(new THREE.OctahedronGeometry(0.22, 0), "#ffffff");
    case "stars": { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.14 : 0.32; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return tint(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), "#ffffff"); }
    case "gears": return tint(new THREE.TorusGeometry(0.28, 0.1, 6, 12), "#ffffff");
    case "planets": return merge([tint(sphere(0.3, 14, 10), "#ffffff"), tint(new THREE.TorusGeometry(0.46, 0.03, 4, 24).rotateX(1.2), "#ffffff")]);
    case "drops": return tint(sq(sphere(0.25, 12, 10), 1, 1.3, 1), "#ffffff");
    default: return floaterGeo(kind);
  }
}
