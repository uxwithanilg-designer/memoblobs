// Momo Boing! models, all built in code as soft clay shapes with vertex colours (characters face the camera, +z).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";

type G = THREE.BufferGeometry;
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const at = <T extends G>(g: T, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <T extends G>(g: T, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };

// ------------------------------------------------------------------ the cast (origin at the feet, ~1.15 tall)
function eyes(parts: G[], y: number, z: number, gap = 0.17, r = 0.15) {
  for (const sx of [-1, 1]) {
    parts.push(tint(sq(at(sphere(r, 12, 10), sx * gap, y, z), 1, 1.1, 0.7), "#FFFFFF"));
    parts.push(tint(at(sphere(r * 0.55, 10, 8), sx * gap * 0.95, y - 0.01, z + r * 0.55), "#1B1530"));
    parts.push(tint(at(sphere(r * 0.18, 6, 4), sx * gap * 0.95 - 0.03, y + 0.04, z + r * 0.85), "#FFFFFF"));
  }
}
function smile(parts: G[], y: number, z: number, w = 0.11, col = "#5A2A1A") {
  const m = new THREE.TorusGeometry(w, 0.025, 5, 12, Math.PI); m.rotateZ(Math.PI); m.translate(0, y, z);
  parts.push(tint(m, col));
}
function blush(parts: G[], y: number, z: number, gap = 0.3) {
  for (const sx of [-1, 1]) parts.push(tint(sq(at(sphere(0.07, 8, 6), sx * gap, y, z), 1.3, 0.7, 0.4), "#FF8FA3"));
}

/** Momo: an orange clay egg with a cream belly and a green sprout */
export function momo(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 22, 16), 0, 0.56, 0), 1, 1.12, 0.95), "#FF8A3D"));
  parts.push(tint(sq(at(sphere(0.34, 16, 12), 0, 0.4, 0.27), 1.05, 1.05, 0.55), "#FFE6C9"));
  eyes(parts, 0.76, 0.36);
  smile(parts, 0.6, 0.47);
  blush(parts, 0.63, 0.38);
  for (const sx of [-1, 1]) {
    parts.push(tint(sq(at(sphere(0.13, 10, 8), sx * 0.2, 0.05, 0.12), 1.2, 0.55, 1.4), "#F07A2E"));
    const arm = new THREE.CapsuleGeometry(0.07, 0.18, 4, 8); arm.rotateZ(sx * 1.1); arm.translate(sx * 0.52, 0.55, 0.05); parts.push(tint(arm, "#FF8A3D"));
  }
  parts.push(tint(at(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 6), 0, 1.17, 0), "#3E9E3E"));
  for (const sx of [-1, 1]) { const leaf = sphere(1, 10, 6); leaf.scale(0.17, 0.05, 0.1); leaf.rotateZ(sx * 0.45); leaf.translate(sx * 0.13, 1.27, 0); parts.push(tint(leaf, "#5CCB52")); }
  return merge(parts);
}
/** Pip: navy penguin with a white belly, an orange beak and a red scarf */
export function pip(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.55, 0), 1, 1.12, 0.95), "#2F3D8F"));
  parts.push(tint(sq(at(sphere(0.36, 14, 10), 0, 0.42, 0.24), 1, 1.05, 0.6), "#FFFFFF"));
  eyes(parts, 0.78, 0.36, 0.16, 0.14);
  const beak = new THREE.ConeGeometry(0.08, 0.18, 8); beak.rotateX(Math.PI / 2); beak.translate(0, 0.66, 0.5); parts.push(tint(beak, "#FFA23A"));
  const scarf = new THREE.TorusGeometry(0.38, 0.08, 6, 18); scarf.rotateX(Math.PI / 2); scarf.translate(0, 0.52, 0.02); parts.push(tint(scarf, "#E8504F"));
  const tail = new RoundedBoxGeometry(0.12, 0.32, 0.06, 2, 0.03); tail.rotateZ(-0.25); tail.translate(0.22, 0.32, 0.46); parts.push(tint(tail, "#E8504F"));
  for (const sx of [-1, 1]) parts.push(tint(sq(at(sphere(0.12, 10, 8), sx * 0.18, 0.04, 0.12), 1.3, 0.5, 1.5), "#FFA23A"));
  parts.push(tint(sq(at(sphere(0.08, 8, 6), 0.04, 1.12, 0), 0.7, 1.5, 0.7), "#2F3D8F"));
  blush(parts, 0.66, 0.38, 0.3);
  return merge(parts);
}
/** Zib: purple one-eyed alien with an antenna */
export function zib(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.48, 20, 14), 0, 0.52, 0), 1, 1.08, 0.95), "#9B5BE0"));
  parts.push(tint(sq(at(sphere(0.25, 14, 12), 0, 0.68, 0.36), 1, 1, 0.6), "#FFFFFF"));
  parts.push(tint(at(sphere(0.12, 12, 10), 0, 0.68, 0.47), "#1B1530"));
  parts.push(tint(at(sphere(0.04, 6, 4), -0.04, 0.73, 0.57), "#FFFFFF"));
  smile(parts, 0.4, 0.43, 0.08, "#3B1D52");
  parts.push(tint(at(new THREE.CylinderGeometry(0.02, 0.025, 0.36, 6), 0, 1.18, 0), "#9B5BE0"));
  parts.push(tint(at(sphere(0.07, 10, 8), 0, 1.38, 0), "#FFE14D"));
  for (const sx of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.05, 0.22, 4, 8); arm.rotateZ(sx * 1.2); arm.translate(sx * 0.52, 0.5, 0); parts.push(tint(arm, "#9B5BE0"));
    parts.push(tint(sq(at(sphere(0.11, 10, 8), sx * 0.17, 0.04, 0.1), 1.2, 0.5, 1.3), "#7C3FC0"));
  }
  blush(parts, 0.48, 0.38, 0.28);
  return merge(parts);
}
/** Bolt: a mint robot with a screen face */
export function bolt(): G {
  const parts: G[] = [];
  parts.push(tint(at(new RoundedBoxGeometry(0.62, 0.42, 0.42, 3, 0.1), 0, 0.33, 0), "#7FD8C4"));
  const cols = ["#FF5F7E", "#FFD23F", "#3D8BFF", "#2FCB8B"];
  cols.forEach((c, i) => parts.push(tint(at(sphere(0.045, 8, 6), -0.15 + i * 0.1, 0.3, 0.22), c)));
  parts.push(tint(at(new RoundedBoxGeometry(0.72, 0.52, 0.5, 3, 0.12), 0, 0.82, 0), "#8FE3D0"));
  parts.push(tint(at(new RoundedBoxGeometry(0.56, 0.36, 0.06, 2, 0.06), 0, 0.82, 0.23), "#22303F"));
  for (const sx of [-1, 1]) { const e = new THREE.TorusGeometry(0.055, 0.02, 4, 10, Math.PI); e.translate(sx * 0.13, 0.85, 0.27); parts.push(tint(e, "#FFFFFF")); }
  smile(parts, 0.76, 0.27, 0.07, "#FFFFFF");
  parts.push(tint(at(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), 0, 1.17, 0), "#5FA898"));
  parts.push(tint(at(sphere(0.06, 8, 6), 0, 1.29, 0), "#FF7AB6"));
  for (const sx of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.05, 0.16, 4, 8); arm.rotateZ(sx * 0.9); arm.translate(sx * 0.4, 0.42, 0); parts.push(tint(arm, "#5FA898"));
    parts.push(tint(at(new RoundedBoxGeometry(0.16, 0.08, 0.2, 2, 0.03), sx * 0.15, 0.04, 0.03), "#5FA898"));
  }
  return merge(parts);
}

// ------------------------------------------------------------------ Grumpies
/** a Grumpy (purple, cross face) — `wings` are a separate mesh so they can flap */
export function grumpy(color = "#8E6BD8", band?: string): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.42, 18, 12), 0, 0.42, 0), 1, 0.95, 0.95), color));
  for (const sx of [-1, 1]) {
    parts.push(tint(sq(at(sphere(0.11, 10, 8), sx * 0.14, 0.5, 0.33), 1, 1, 0.6), "#FFFFFF"));
    parts.push(tint(at(sphere(0.055, 8, 6), sx * 0.13, 0.48, 0.4), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.2, 0.05, 0.06); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.14, 0.64, 0.36); parts.push(tint(brow, "#2A2140"));
  }
  const frown = new THREE.TorusGeometry(0.08, 0.022, 5, 12, Math.PI); frown.translate(0, 0.27, 0.39); parts.push(tint(frown, "#2A2140"));
  if (band) { const b = new THREE.TorusGeometry(0.4, 0.07, 6, 20); b.rotateX(Math.PI / 2); b.translate(0, 0.32, 0); parts.push(tint(b, band)); const st = new THREE.ConeGeometry(0.07, 0.22, 6); st.rotateX(-Math.PI / 2); st.translate(0, 0.38, -0.46); parts.push(tint(st, "#2A2140")); }
  return merge(parts);
}
export function wing(): G {
  const w = sphere(0.26, 12, 8); w.scale(1, 0.55, 0.12); w.translate(0.24, 0, 0);
  return merge([tint(w, "#E8F6FF")]);
}

// ------------------------------------------------------------------ platforms (unit width; scaled in x per platform)
export function slab(): G { return merge([tint(at(new RoundedBoxGeometry(1, 0.46, 1.3, 3, 0.17), 0, -0.23, 0), "#FFFFFF")]); }
export function topLayer(): G { return merge([tint(at(new RoundedBoxGeometry(1.06, 0.17, 1.38, 2, 0.08), 0, -0.04, 0), "#FFFFFF")]); }
export function drip(): G { return merge([tint(sq(sphere(0.11, 8, 6), 1, 1.7, 0.8), "#FFFFFF")]); }
export function crackLines(): G {
  const parts: G[] = [];
  const pts: [number, number, number][] = [[-0.3, 0.1, 0.4], [-0.05, -0.15, 0.3], [0.22, 0.12, 0.35], [0.4, -0.05, 0.25]];
  for (const [x, z, l] of pts) { const b = new THREE.BoxGeometry(l, 0.012, 0.022); b.rotateY(z * 3); b.translate(x, 0.005, z); parts.push(tint(b, "#6B4A2E")); }
  const front = new THREE.BoxGeometry(0.022, 0.3, 0.02); front.rotateZ(0.4); front.translate(0.1, -0.2, 0.66); parts.push(tint(front, "#6B4A2E"));
  return merge(parts);
}
/** a soft cloud made of puffs, ~1 wide */
export function puffCloud(n = 7, seed = 1): G {
  const parts: G[] = [];
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), r = 0.22 + 0.14 * Math.sin(f * Math.PI) + rnd() * 0.05;
    parts.push(tint(at(sphere(r, 12, 9), -0.42 + f * 0.84, -0.08 + rnd() * 0.08, (rnd() - 0.5) * 0.3), "#FFFFFF"));
  }
  return merge(parts);
}
export function gumSlab(): G {
  const g = sphere(0.5, 18, 10); g.scale(1, 0.4, 1.15); g.translate(0, -0.12, 0);
  const bub = sphere(0.14, 12, 8); bub.translate(0.25, 0.12, 0.2);
  return merge([tint(g, "#FF7AB6"), tint(bub, "#FFB3D6")]);
}
export function iceSlab(): G { return merge([tint(at(new RoundedBoxGeometry(1, 0.4, 1.3, 2, 0.08), 0, -0.2, 0), "#FFFFFF")]); }
export function mushroomSpring(): G {
  const stem = new THREE.CylinderGeometry(0.13, 0.17, 0.3, 10); stem.translate(0, 0.15, 0);
  const cap = sphere(0.38, 16, 10, ); cap.scale(1, 0.55, 1); cap.translate(0, 0.38, 0);
  const parts = [tint(stem, "#FFF3DE"), tint(cap, "#FF4E5E")];
  for (let i = 0; i < 6; i++) { const a = i * 1.05; parts.push(tint(at(sphere(0.06, 6, 4), Math.cos(a) * 0.24, 0.52, Math.sin(a) * 0.24), "#FFFFFF")); }
  return merge(parts);
}
export function coilSpring(c1: string, c2: string): G {
  const parts: G[] = [];
  for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(0.2, 0.05, 6, 16); t.rotateX(Math.PI / 2); t.translate(0, 0.08 + i * 0.11, 0); parts.push(tint(t, i % 2 ? c2 : c1)); }
  const pad = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16); pad.translate(0, 0.42, 0); parts.push(tint(pad, c2));
  return merge(parts);
}
export function finishFlag(): G {
  const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8); pole.translate(0, 1.1, 0);
  const flag = new THREE.BoxGeometry(0.9, 0.55, 0.05); flag.translate(0.48, 1.9, 0);
  const pos = flag.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const c = new THREE.Color((Math.floor((pos.getX(i) + 0.2) * 4.4) + Math.floor((pos.getY(i) - 1.6) * 3.6)) % 2 ? "#FFFFFF" : "#2B1D52"); col.set([c.r, c.g, c.b], i * 3); }
  flag.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const ball = sphere(0.09, 8, 6); ball.translate(0, 2.25, 0);
  return merge([tint(pole, "#FFFFFF"), flag.index ? flag.toNonIndexed() : flag, tint(ball, "#FFD23F")]);
}

// ------------------------------------------------------------------ pickups and drops
export function coin(): G {
  const c = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 20); c.rotateX(Math.PI / 2);
  const rim = new THREE.TorusGeometry(0.24, 0.035, 6, 20);
  const star = new THREE.CylinderGeometry(0.11, 0.11, 0.1, 5); star.rotateX(Math.PI / 2);
  return merge([tint(c, "#FFC21A"), tint(rim, "#FFD95E"), tint(star, "#FFE48A")]);
}
export function note(): G {
  const head = sphere(0.15, 12, 8); head.scale(1.25, 0.9, 0.7); head.rotateZ(0.35);
  const stem = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6); stem.translate(0.15, 0.27, 0);
  const flag = new THREE.BoxGeometry(0.22, 0.08, 0.06); flag.rotateZ(-0.6); flag.translate(0.24, 0.47, 0);
  return merge([tint(head, "#FF4FA3"), tint(stem, "#FF4FA3"), tint(flag, "#FF4FA3")]);
}
export function acorn(): G {
  const n = sphere(0.3, 12, 10); n.scale(0.9, 1.1, 0.9);
  const cap = new THREE.SphereGeometry(0.31, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(0, 0.08, 0);
  const st = new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6); st.translate(0, 0.4, 0);
  return merge([tint(n, "#C98A4B"), tint(cap, "#7A5230"), tint(st, "#5A3A20")]);
}
export function candyDrop(): G {
  const b = sphere(0.28, 14, 10);
  const parts = [tint(b, "#FF5FA2")];
  for (const sx of [-1, 1]) { const w = new THREE.ConeGeometry(0.16, 0.24, 8); w.rotateZ(sx * Math.PI / 2); w.translate(sx * 0.36, 0, 0); parts.push(tint(w, "#FFD23F")); }
  const stripe = new THREE.TorusGeometry(0.2, 0.05, 6, 16); stripe.rotateY(Math.PI / 2); parts.push(tint(stripe, "#FFFFFF"));
  return merge(parts);
}
export function snowball(): G {
  const parts = [tint(sphere(0.32, 14, 10), "#FFFFFF")];
  for (let i = 0; i < 5; i++) { const a = i * 1.3; parts.push(tint(at(sphere(0.12, 8, 6), Math.cos(a) * 0.25, Math.sin(a * 1.7) * 0.15, Math.sin(a) * 0.25), "#EAF4FF")); }
  return merge(parts);
}

// ------------------------------------------------------------------ scenery (far layer and floating islands)
export function hill(color: string, top: string): G {
  const h = sphere(1, 22, 12, ); h.scale(1, 0.55, 0.6);
  const cap = sphere(1.01, 22, 6); cap.scale(1, 0.55, 0.6);
  const pos = cap.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.25) pos.setY(i, 0.25);
  return merge([tint(h, color), tint(cap, top)]);
}
export function tree(leaf: string): G {
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1, 8); trunk.translate(0, 0.5, 0);
  return merge([tint(trunk, "#8A5A34"), tint(at(sphere(0.62, 14, 10), 0, 1.35, 0), leaf), tint(at(sphere(0.45, 12, 8), 0.4, 1.1, 0.1), leaf), tint(at(sphere(0.42, 12, 8), -0.38, 1.15, 0.05), leaf)]);
}
export function sunflower(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), 0, 1.2, 0), "#3E9E3E")];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const p = sphere(0.22, 8, 6); p.scale(1, 0.45, 0.2); p.translate(0.34, 0, 0); p.rotateZ(a); p.translate(0, 2.5, 0); parts.push(tint(p, "#FFC21A")); }
  parts.push(tint(sq(at(sphere(0.24, 12, 8), 0, 2.5, 0.04), 1, 1, 0.5), "#6B3E1E"));
  for (const sx of [-1, 1]) { const l = sphere(0.3, 8, 6); l.scale(1, 0.35, 0.5); l.translate(sx * 0.3, 1.2, 0); parts.push(tint(l, "#4FB548")); }
  return merge(parts);
}
/** a floating clay island: a soft bowl of earth with a thick top and a few dangling lumps */
export function island(base: string, top: string, seed = 3): G {
  const bowl = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bowl.scale(1.3, 0.95, 1.05); bowl.translate(0, -0.12, 0);
  const lid = new THREE.CylinderGeometry(1.3, 1.3, 0.12, 20); lid.translate(0, -0.12, 0);
  const cap = new THREE.CylinderGeometry(1.36, 1.3, 0.26, 20); cap.translate(0, 0.04, 0);
  const parts = [tint(bowl, base), tint(lid, base), tint(cap, top)];
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + seed, r = 0.35 + 0.4 * ((i * 37 + seed) % 5) / 5; parts.push(tint(sq(at(sphere(0.18 + 0.06 * (i % 2), 10, 8), Math.cos(a) * r, -0.95 - 0.1 * (i % 3), Math.sin(a) * r * 0.7), 1, 1.3, 1), base)); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + seed; parts.push(tint(sq(at(sphere(0.12, 8, 6), Math.cos(a) * 1.28, -0.1, Math.sin(a) * 1.02), 1, 1.6, 1), top)); }
  return merge(parts);
}
export function mountain(rock: string, snow: string): G {
  const m = new THREE.ConeGeometry(1, 1.6, 7, 3); m.translate(0, 0.8, 0);
  const cap = new THREE.ConeGeometry(0.45, 0.72, 7, 1); cap.translate(0, 1.25, 0);
  return merge([tint(m, rock), tint(cap, snow)]);
}
export function candyCane(): G {
  const parts: G[] = [];
  for (let i = 0; i < 8; i++) { const c = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10); c.translate(0, 0.15 + i * 0.3, 0); parts.push(tint(c, i % 2 ? "#FFFFFF" : "#FF3B5C")); }
  const hook = new THREE.TorusGeometry(0.35, 0.12, 8, 14, Math.PI); hook.translate(-0.35, 2.4, 0); parts.push(tint(hook, "#FF3B5C"));
  return merge(parts);
}
export function balloon(color: string): G {
  const b = sphere(0.45, 16, 12); b.scale(1, 1.18, 1); b.translate(0, 1.4, 0);
  const knot = new THREE.ConeGeometry(0.06, 0.1, 6); knot.translate(0, 0.84, 0);
  const str = new THREE.CylinderGeometry(0.008, 0.008, 0.85, 4); str.translate(0, 0.42, 0);
  return merge([tint(b, color), tint(knot, color), tint(str, "#FFFFFF")]);
}

// ------------------------------------------------------------------ Phase 2: the rest of the cast
/** Gloop: a lime slime with big eyes and one tooth */
export function gloop(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.5, 0), 1.05, 1.0, 0.95), "#8FD14F"));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(tint(sq(at(sphere(0.13, 10, 8), Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.32 + 0.04), 1, 0.7, 1), "#7CC23E")); }
  eyes(parts, 0.78, 0.36, 0.18, 0.17);
  const mouth = new THREE.TorusGeometry(0.13, 0.04, 6, 14, Math.PI); mouth.rotateZ(Math.PI); mouth.translate(0, 0.52, 0.45); parts.push(tint(mouth, "#3B5A1E"));
  parts.push(tint(at(new RoundedBoxGeometry(0.08, 0.09, 0.04, 1, 0.015), 0.03, 0.47, 0.48), "#FFFFFF"));
  for (const sx of [-1, 1]) { const arm = new THREE.CapsuleGeometry(0.07, 0.16, 4, 8); arm.rotateZ(sx * 0.9); arm.translate(sx * 0.52, 0.5, 0.05); parts.push(tint(arm, "#8FD14F")); }
  return merge(parts);
}
/** Bonbon: a pink hippo chef */
export function bonbon(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.52, 0), 1.08, 1.05, 0.95), "#FF9FC4"));
  parts.push(tint(sq(at(sphere(0.3, 14, 10), 0, 0.56, 0.36), 1.25, 0.8, 0.7), "#FFC4DA"));
  for (const sx of [-1, 1]) parts.push(tint(at(sphere(0.045, 8, 6), sx * 0.1, 0.6, 0.57), "#B85A80"));
  eyes(parts, 0.86, 0.3, 0.16, 0.12);
  parts.push(tint(at(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 14), 0, 1.06, 0), "#FFFFFF"));
  for (const [x, z] of [[0, 0], [-0.13, 0.05], [0.13, 0.05], [0, -0.1]]) parts.push(tint(at(sphere(0.15, 10, 8), x, 1.22, z), "#FFFFFF"));
  for (const sx of [-1, 1]) parts.push(tint(sq(at(sphere(0.09, 8, 6), sx * 0.3, 0.98, 0), 1, 0.7, 0.6), "#FF8FB8"));
  const apron = new RoundedBoxGeometry(0.34, 0.24, 0.05, 2, 0.04); apron.translate(0, 0.28, 0.46); parts.push(tint(apron, "#FFFFFF"));
  return merge(parts);
}
/** Prof. Hoot: a brown owl in glasses and a graduation cap */
export function hoot(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.56, 0), 1, 1.12, 0.92), "#9A6B45"));
  parts.push(tint(sq(at(sphere(0.34, 14, 10), 0, 0.4, 0.26), 1, 1.05, 0.55), "#F3E3C6"));
  eyes(parts, 0.8, 0.38, 0.17, 0.15);
  for (const sx of [-1, 1]) { const rim = new THREE.TorusGeometry(0.16, 0.025, 6, 16); rim.translate(sx * 0.17, 0.8, 0.46); parts.push(tint(rim, "#2B1D52")); }
  const beak = new THREE.ConeGeometry(0.06, 0.14, 6); beak.rotateX(Math.PI * 0.6); beak.translate(0, 0.64, 0.47); parts.push(tint(beak, "#FFB000"));
  const board = new THREE.BoxGeometry(0.62, 0.05, 0.62); board.rotateY(0.6); board.translate(0, 1.22, 0); parts.push(tint(board, "#2B2B4A"));
  parts.push(tint(at(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 12), 0, 1.15, 0), "#2B2B4A"));
  parts.push(tint(at(sphere(0.04, 6, 4), 0.25, 1.1, 0.12), "#FFD23F"));
  for (const sx of [-1, 1]) parts.push(tint(sq(at(sphere(0.12, 8, 6), sx * 0.15, 0.04, 0.1), 1.2, 0.5, 1.3), "#FFB000"));
  return merge(parts);
}
/** Turbo: a green snail with a rocket on its orange shell */
export function turbo(): G {
  const parts: G[] = [];
  const foot = new THREE.CapsuleGeometry(0.2, 0.55, 6, 12); foot.rotateZ(Math.PI / 2); foot.translate(0.05, 0.16, 0.05); parts.push(tint(foot, "#8FD16A"));
  const shell = new THREE.TorusGeometry(0.26, 0.17, 10, 20); shell.translate(-0.05, 0.6, -0.05); parts.push(tint(shell, "#FF8A3D"));
  parts.push(tint(at(sphere(0.12, 10, 8), -0.05, 0.6, 0.06), "#FFB98A"));
  const rocket = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10); rocket.rotateZ(Math.PI / 2); rocket.translate(-0.32, 0.85, -0.15); parts.push(tint(rocket, "#D9D9E8"));
  const tip = new THREE.ConeGeometry(0.09, 0.16, 10); tip.rotateZ(Math.PI / 2); tip.translate(-0.6, 0.85, -0.15); parts.push(tint(tip, "#FFD23F"));
  parts.push(tint(sq(at(sphere(0.2, 12, 10), 0.4, 0.5, 0.1), 1, 1.15, 1), "#8FD16A"));
  for (const sx of [-1, 1]) {
    parts.push(tint(at(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), 0.4 + sx * 0.08, 0.78, 0.1), "#8FD16A"));
    parts.push(tint(at(sphere(0.07, 8, 6), 0.4 + sx * 0.08, 0.94, 0.14), "#FFFFFF"));
    parts.push(tint(at(sphere(0.035, 6, 4), 0.4 + sx * 0.08, 0.94, 0.2), "#1B1530"));
  }
  smile(parts, 0.46, 0.29, 0.06, "#3B5A1E");
  return merge(parts);
}
/** Noodle: a long dachshund with floppy ears */
export function noodle(): G {
  const parts: G[] = [];
  const body = new THREE.CapsuleGeometry(0.22, 0.55, 6, 12); body.rotateZ(Math.PI / 2); body.translate(-0.08, 0.36, 0); parts.push(tint(body, "#D49452"));
  parts.push(tint(sq(at(sphere(0.18, 10, 8), -0.08, 0.3, 0.12), 1.8, 0.7, 0.6), "#F0D6B0"));
  for (const x of [-0.42, -0.2, 0.08, 0.3]) parts.push(tint(at(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6), x, 0.1, 0.08), "#C08040"));
  parts.push(tint(sq(at(sphere(0.24, 14, 10), 0.4, 0.66, 0.06), 1, 1.05, 0.95), "#D49452"));
  parts.push(tint(sq(at(sphere(0.12, 10, 8), 0.5, 0.58, 0.24), 1.2, 0.8, 1), "#E3B07A"));
  parts.push(tint(at(sphere(0.045, 8, 6), 0.56, 0.62, 0.34), "#2B1D30"));
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.055, 8, 6), 0.4 + sx * 0.1, 0.74, 0.25), "#1B1530"));
    const ear = sphere(0.11, 8, 6); ear.scale(0.6, 1.5, 0.4); ear.translate(0.4 + sx * 0.22, 0.6, 0); parts.push(tint(ear, "#9A6030"));
  }
  const tail = new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6); tail.rotateZ(0.9); tail.translate(-0.58, 0.48, 0); parts.push(tint(tail, "#D49452"));
  const tongue = sphere(0.04, 6, 4); tongue.scale(1, 1.6, 0.6); tongue.translate(0.52, 0.46, 0.26); parts.push(tint(tongue, "#FF6F91"));
  return merge(parts);
}
/** Tiki: a round teal bird with a purple crest */
export function tiki(): G {
  const parts: G[] = [];
  parts.push(tint(sq(at(sphere(0.5, 20, 14), 0, 0.52, 0), 1.05, 1.0, 0.95), "#3FC1B0"));
  parts.push(tint(sq(at(sphere(0.32, 14, 10), 0, 0.38, 0.26), 1.1, 1, 0.55), "#F6E7C8"));
  eyes(parts, 0.72, 0.38, 0.17, 0.13);
  const beak = new THREE.ConeGeometry(0.06, 0.14, 6); beak.rotateX(Math.PI / 2); beak.translate(0, 0.6, 0.5); parts.push(tint(beak, "#FFB000"));
  for (let i = 0; i < 3; i++) { const f = sphere(0.08, 8, 6); f.scale(0.5, 1.6, 0.5); f.rotateZ((i - 1) * 0.35); f.translate((i - 1) * 0.08, 1.08, 0); parts.push(tint(f, "#9B5BE0")); }
  for (const sx of [-1, 1]) { const w = sphere(0.18, 10, 8); w.scale(0.5, 1, 0.8); w.translate(sx * 0.5, 0.5, 0); parts.push(tint(w, "#2FA898")); parts.push(tint(sq(at(sphere(0.1, 8, 6), sx * 0.15, 0.04, 0.12), 1.2, 0.5, 1.4), "#FFB000")); }
  blush(parts, 0.6, 0.4, 0.3);
  return merge(parts);
}

// ------------------------------------------------------------------ Phase 2 platforms
export function trampMat(): G {
  const frame = new THREE.TorusGeometry(0.5, 0.07, 6, 24); frame.rotateX(Math.PI / 2); frame.scale(1, 1, 0.62);
  const mat = new THREE.CylinderGeometry(0.47, 0.47, 0.04, 24); mat.scale(1, 1, 0.62); mat.translate(0, 0.01, 0);
  const parts = [tint(frame, "#FF5F5F"), tint(mat, "#2B3A8F")];
  for (const [x, z] of [[-0.38, 0.2], [0.38, 0.2], [-0.38, -0.2], [0.38, -0.2]]) parts.push(tint(at(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), x, -0.15, z), "#9A9AB8"));
  return merge(parts);
}
export function cannon(): G {
  const parts: G[] = [];
  const barrel = new THREE.CylinderGeometry(0.3, 0.36, 0.95, 18, 1, true); barrel.translate(0, 0.5, 0); parts.push(tint(barrel, "#3B3F5C"));
  const lip = new THREE.TorusGeometry(0.3, 0.06, 8, 18); lip.rotateX(Math.PI / 2); lip.translate(0, 0.97, 0); parts.push(tint(lip, "#FFD23F"));
  const band = new THREE.TorusGeometry(0.35, 0.05, 8, 18); band.rotateX(Math.PI / 2); band.translate(0, 0.3, 0); parts.push(tint(band, "#FFD23F"));
  const inside = new THREE.CircleGeometry(0.28, 18); inside.rotateX(-Math.PI / 2); inside.translate(0, 0.9, 0); parts.push(tint(inside, "#15182A"));
  for (const sx of [-1, 1]) { const w = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16); w.rotateZ(Math.PI / 2); w.translate(sx * 0.42, 0.18, 0); parts.push(tint(w, "#C9853F")); }
  return merge(parts);
}
export function beachBall(): G {
  const s = new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); s.scale(1, 0.7, 1.25);
  const pos = s.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const cols = ["#FF5F5F", "#FFFFFF", "#3D8BFF", "#FFFFFF", "#FFD23F", "#FFFFFF"].map((c) => new THREE.Color(c));
  for (let i = 0; i < pos.count; i++) { const c = cols[Math.floor((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI / 3)) % 6]; col.set([c.r, c.g, c.b], i * 3); }
  s.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!s.getAttribute("uv")) s.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  const lid = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20); lid.scale(1, 1, 1.25); lid.translate(0, -0.03, 0);
  return merge([s.index ? s.toNonIndexed() : s, tint(lid, "#FFFFFF")]);
}
export function planet(): G {
  const p = sphere(0.5, 22, 16);
  const ring = new THREE.TorusGeometry(0.72, 0.05, 6, 32); ring.rotateX(Math.PI / 2 - 0.25);
  const crater = (x: number, y: number, z: number, r: number) => tint(sq(at(sphere(r, 8, 6), x, y, z), 1, 1, 0.4), "#D8D8E8");
  return merge([tint(p, "#FFFFFF"), tint(ring, "#FFE7A0"), crater(0.18, 0.12, 0.44, 0.09), crater(-0.22, -0.1, 0.42, 0.07), crater(0.05, -0.25, 0.42, 0.06)]);
}
export function plank(): G {
  const parts: G[] = [tint(at(new RoundedBoxGeometry(1, 0.22, 1.2, 2, 0.06), 0, -0.11, 0), "#A0703C")];
  for (let i = 0; i < 4; i++) parts.push(tint(at(new THREE.BoxGeometry(0.02, 0.23, 1.21), -0.375 + i * 0.25, -0.11, 0), "#7A5230"));
  return merge(parts);
}
export function ventGlow(): G { return merge([tint(at(new RoundedBoxGeometry(0.7, 0.05, 0.9, 2, 0.02), 0, 0.01, 0), "#FFFFFF")]); }
export function vineSeg(): G {
  const c = new THREE.CylinderGeometry(0.07, 0.07, 1.02, 6); c.translate(0, 0.5, 0);
  const leaf = sphere(0.16, 8, 6); leaf.scale(1, 0.3, 0.55); leaf.rotateZ(0.5); leaf.translate(0.14, 0.55, 0.05);
  const leaf2 = sphere(0.14, 8, 6); leaf2.scale(1, 0.3, 0.55); leaf2.rotateZ(-0.5); leaf2.translate(-0.13, 0.15, 0.05);
  return merge([tint(c, "#3E8E3E"), tint(leaf, "#5CCB52"), tint(leaf2, "#4FB548")]);
}
export function column(): G { return merge([tint(new THREE.CylinderGeometry(0.42, 0.5, 1, 16, 1, true), "#FFFFFF")]); }

// ------------------------------------------------------------------ Phase 2 drops
export function coconut(): G { const c = sphere(0.3, 14, 10); c.scale(1, 1.08, 1); return merge([tint(c, "#7A4A2A"), tint(at(sphere(0.05, 6, 4), 0.08, 0.2, 0.22), "#3B2414"), tint(at(sphere(0.05, 6, 4), -0.08, 0.2, 0.22), "#3B2414")]); }
export function fruit(): G {
  const m = sphere(0.28, 14, 10); m.scale(1, 1.2, 0.95);
  const leaf = sphere(0.12, 8, 6); leaf.scale(1, 0.3, 0.5); leaf.rotateZ(0.6); leaf.translate(0.08, 0.36, 0);
  return merge([tint(m, "#FFB000"), tint(leaf, "#3FAE4A"), tint(sq(at(sphere(0.2, 10, 8), 0.06, -0.05, 0.12), 1, 1.1, 0.6), "#FF7A3D")]);
}
export function meteor(): G {
  const r = new THREE.DodecahedronGeometry(0.3, 1);
  const pos = r.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const k = 1 + 0.12 * Math.sin(i * 1.7); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
  return merge([tint(r, "#8A7A9A")]);
}
export function cannonball(): G { return merge([tint(sphere(0.3, 14, 10), "#2A2140"), tint(at(sphere(0.06, 6, 4), -0.1, 0.12, 0.25), "#8A84A8")]); }
export function lavaBall(): G { return merge([tint(sphere(0.3, 14, 10), "#FF6A1F"), tint(at(sphere(0.14, 8, 6), 0.08, 0.1, 0.2), "#FFD23F")]); }

// ------------------------------------------------------------------ Phase 2 scenery
export function volcano(): G {
  const m = new THREE.CylinderGeometry(0.32, 1, 1.4, 10, 3, true); m.translate(0, 0.7, 0);
  const lava = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12); lava.translate(0, 1.38, 0);
  return merge([tint(m, "#5A3A36"), tint(lava, "#FF7A1F")]);
}
export function ringPlanet(c: string): G {
  const p = sphere(1, 24, 16);
  const ring = new THREE.TorusGeometry(1.55, 0.09, 6, 40); ring.rotateX(Math.PI / 2 - 0.35);
  return merge([tint(p, c), tint(ring, "#FFE7A0")]);
}
export function tower(roof: string): G {
  const body = new THREE.CylinderGeometry(0.5, 0.56, 2.2, 14); body.translate(0, 1.1, 0);
  const top = new THREE.ConeGeometry(0.66, 0.9, 14); top.translate(0, 2.65, 0);
  const parts = [tint(body, "#E8E4F2"), tint(top, roof)];
  for (let i = 0; i < 3; i++) parts.push(tint(at(new RoundedBoxGeometry(0.16, 0.26, 0.05, 1, 0.03), Math.sin(i * 2.1) * 0.3, 1.1 + i * 0.5, 0.5), "#5A4A80"));
  const flag = new THREE.BoxGeometry(0.4, 0.24, 0.03); flag.translate(0.22, 3.25, 0); parts.push(tint(flag, "#FF5F7E"));
  parts.push(tint(at(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), 0, 3.25, 0), "#FFFFFF"));
  return merge(parts);
}
export function deadTree(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.1, 0.18, 1.4, 7), 0, 0.7, 0), "#3B2A4A")];
  for (const [a, h] of [[0.7, 1.1], [-0.6, 1.25], [0.3, 1.4]] as const) { const b = new THREE.CylinderGeometry(0.03, 0.06, 0.7, 5); b.translate(0, 0.35, 0); b.rotateZ(a); b.translate(0, h, 0); parts.push(tint(b, "#3B2A4A")); }
  return merge(parts);
}
