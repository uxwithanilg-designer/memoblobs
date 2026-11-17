// Blob Brigade models, all built in code: soft clay-toy shapes with vertex colours (no texture downloads).
// Brigade blobs face up the board (−z, away from the camera); Grumpies face the camera (+z).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type G = THREE.BufferGeometry;

/** give a geometry one flat vertex colour (and make every part share the same attribute set for merging) */
export function tint(g: G, hex: string | number): G {
  const c = new THREE.Color(hex);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}
export function merge(parts: G[]): G {
  const m = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  if (!m) throw new Error("merge failed");
  parts.forEach((p) => p.dispose());
  return m;
}
const at = (g: G, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sphere = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

// ------------------------------------------------------------------ brigade blob ("Momo mini")
export function blobBody(detail = 1): G {
  const g = sphere(1, detail ? 16 : 9, detail ? 12 : 7);
  g.scale(1, 0.86, 1); g.translate(0, 0.86, 0);
  return g;
}
/** eyes (on the front-top, half visible from the camera) + a green sprout on top */
export function blobFace(): G {
  const parts: G[] = [];
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.27, 10, 8), sx * 0.34, 1.16, -0.7), "#FFFFFF"));
    parts.push(tint(at(sphere(0.13, 8, 6), sx * 0.34, 1.22, -0.93), "#1B1530"));
  }
  parts.push(tint(at(new THREE.CylinderGeometry(0.045, 0.06, 0.38, 6), 0, 1.86, 0), "#3E9E3E"));
  for (const sx of [-1, 1]) {
    const leaf = sphere(1, 8, 6); leaf.scale(0.26, 0.07, 0.14); leaf.rotateZ(sx * 0.35); leaf.translate(sx * 0.2, 2.05, 0);
    parts.push(tint(leaf, "#5CCB52"));
  }
  return merge(parts);
}
/** tier accessories: a blue bandana (big), a gold crown (giant), a rainbow crown (mega) */
export function bandana(): G {
  const t = new THREE.TorusGeometry(0.86, 0.13, 6, 20); t.rotateX(Math.PI / 2); t.translate(0, 1.12, 0);
  const knot = sphere(0.18, 8, 6); knot.translate(0, 1.12, 0.9);
  return merge([tint(t, "#2F6BFF"), tint(knot, "#2F6BFF")]);
}
export function crown(): G {
  const parts: G[] = [];
  const ring = new THREE.CylinderGeometry(0.62, 0.66, 0.3, 14, 1, true); ring.translate(0, 1.72, 0);
  parts.push(tint(ring, "#FFFFFF"));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, c = new THREE.ConeGeometry(0.16, 0.36, 6);
    c.translate(Math.cos(a) * 0.6, 2.02, Math.sin(a) * 0.6);
    parts.push(tint(c, "#FFFFFF"));
    const gem = sphere(0.08, 6, 4); gem.translate(Math.cos(a) * 0.64, 1.72, Math.sin(a) * 0.64);
    parts.push(tint(gem, "#FF4FA3"));
  }
  return merge(parts);
}

// ------------------------------------------------------------------ Grumpies
export function grumpBody(detail = 1): G {
  const g = sphere(1, detail ? 12 : 7, detail ? 9 : 5);
  g.scale(1, 0.92, 1); g.translate(0, 0.92, 0);
  return g;
}
/** angry eyebrows, small eyes, a big frown */
export function grumpFace(): G {
  const parts: G[] = [];
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.22, 8, 6), sx * 0.3, 1.08, 0.79), "#FFFFFF"));
    parts.push(tint(at(sphere(0.11, 6, 5), sx * 0.3 - sx * 0.03, 1.04, 0.98), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.46, 0.11, 0.12); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.3, 1.38, 0.86);
    parts.push(tint(brow, "#2A2140"));
  }
  const mouth = new THREE.TorusGeometry(0.2, 0.055, 5, 12, Math.PI); mouth.translate(0, 0.6, 0.93);
  parts.push(tint(mouth, "#2A2140"));
  return merge(parts);
}
export function saucepan(): G {
  const pot = new THREE.CylinderGeometry(0.66, 0.72, 0.46, 14); pot.translate(0, 1.84, 0);
  const rim = new THREE.TorusGeometry(0.72, 0.06, 5, 16); rim.rotateX(Math.PI / 2); rim.translate(0, 1.62, 0);
  const handle = new THREE.BoxGeometry(0.75, 0.09, 0.14); handle.translate(1.0, 1.7, 0); handle.rotateY(-0.5);
  return merge([tint(pot, "#B7C0CC"), tint(rim, "#8E98A6"), tint(handle, "#3B3550")]);
}
export function headband(): G {
  const t = new THREE.TorusGeometry(0.93, 0.12, 6, 18); t.rotateX(Math.PI / 2); t.translate(0, 1.2, 0);
  const tail = new THREE.BoxGeometry(0.12, 0.1, 0.55); tail.rotateX(0.5); tail.translate(0.2, 1.15, -1.1);
  return merge([tint(t, "#FF3B5C"), tint(tail, "#FF3B5C")]);
}

// ------------------------------------------------------------------ bubbles, tiles, effects
export const bubbleGeo = () => sphere(1, 10, 8);
export function tileSlab(w: number, d: number): G {
  const s = new THREE.Shape(), r = 0.16, x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0);
  return g;
}
export const confettiGeo = () => new THREE.PlaneGeometry(0.16, 0.1);
export const puffGeo = () => sphere(1, 8, 6);

// ------------------------------------------------------------------ jars, cages, piñatas
export function jarGeo(): G {
  const pts = [[0, 0], [0.55, 0], [0.78, 0.22], [0.9, 0.62], [0.86, 1.05], [0.62, 1.38], [0.5, 1.46], [0.55, 1.6], [0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(pts, 18);
  const band = new THREE.TorusGeometry(0.88, 0.07, 6, 22); band.rotateX(Math.PI / 2); band.translate(0, 0.86, 0);
  const lid = new THREE.CylinderGeometry(0.5, 0.56, 0.26, 16); lid.translate(0, 1.72, 0);
  const knob = sphere(0.16, 8, 6); knob.translate(0, 1.92, 0);
  return merge([tint(body, "#E07B4C"), tint(band, "#FFD23F"), tint(lid, "#B5532E"), tint(knob, "#FFD23F")]);
}
export function pinataGeo(): G {
  const cols = ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#B26BFF"];
  const parts: G[] = [];
  cols.forEach((c, i) => { const g = new THREE.CylinderGeometry(0.62 - Math.abs(i - 2) * 0.08, 0.62 - Math.abs(i - 1.5) * 0.08, 0.24, 14); g.translate(0, 0.25 + i * 0.24, 0); parts.push(tint(g, c)); });
  const top = new THREE.ConeGeometry(0.38, 0.4, 12); top.translate(0, 1.6, 0); parts.push(tint(top, "#FF4FA3"));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, t = new THREE.ConeGeometry(0.1, 0.5, 5); t.rotateZ(Math.PI); t.translate(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4);
    parts.push(tint(t, cols[i % cols.length]));
  }
  return merge(parts);
}

// ------------------------------------------------------------------ bosses
export function megaGrump(): G {
  const parts: G[] = [];
  const body = sphere(1, 20, 14); body.scale(1, 0.95, 0.92); body.translate(0, 1, 0); parts.push(tint(body, "#7E74AE"));
  const belly = sphere(0.62, 14, 10); belly.scale(1, 1, 0.5); belly.translate(0, 0.78, 0.68); parts.push(tint(belly, "#A79FD0"));
  for (const sx of [-1, 1]) {
    const arm = sphere(0.32, 10, 8); arm.scale(1, 1.3, 1); arm.translate(sx * 1.02, 0.85, 0.15); parts.push(tint(arm, "#7E74AE"));
    parts.push(tint(at(sphere(0.2, 10, 8), sx * 0.32, 1.32, 0.78), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1, 8, 6), sx * 0.28, 1.28, 0.96), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.5, 0.13, 0.14); brow.rotateZ(sx * 0.55); brow.translate(sx * 0.32, 1.62, 0.8); parts.push(tint(brow, "#2A2140"));
  }
  const mouth = new THREE.TorusGeometry(0.28, 0.07, 6, 14, Math.PI); mouth.translate(0, 0.98, 0.9); parts.push(tint(mouth, "#2A2140"));
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8, sp = new THREE.ConeGeometry(0.13, 0.42, 6);
    sp.rotateZ(-a * 0.6); sp.translate(Math.sin(a) * 0.62, 1.9 + Math.cos(a) * 0.05, -0.05); parts.push(tint(sp, "#3B3550"));
  }
  return merge(parts);
}
export function jellyKing(): { jelly: G; deco: G } {
  const box = new THREE.BoxGeometry(1.8, 1.6, 1.6, 8, 8, 8);
  // round the cube into a wobbly jelly
  const p = box.getAttribute("position") as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = v.clone().normalize().multiplyScalar(1.0);
    v.lerp(new THREE.Vector3(s.x * 0.95, s.y * 0.85, s.z * 0.88), 0.45);
    p.setXYZ(i, v.x, v.y + 0.85, v.z);
  }
  box.computeVertexNormals();
  const parts: G[] = [];
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.2, 10, 8), sx * 0.32, 1.12, 0.74), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1, 8, 6), sx * 0.3, 1.08, 0.92), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.44, 0.11, 0.12); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.32, 1.4, 0.78); parts.push(tint(brow, "#1E5B2A"));
  }
  const mouth = new THREE.TorusGeometry(0.24, 0.06, 6, 14, Math.PI); mouth.translate(0, 0.72, 0.86); parts.push(tint(mouth, "#1E5B2A"));
  const c = crown(); c.scale(1.05, 1.05, 1.05); c.translate(0, 0.02, 0);
  const col = c.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.9 && col.getY(i) > 0.9) col.setXYZ(i, 1, 0.82, 0.25);
  parts.push(c);
  return { jelly: box, deco: merge(parts) };
}

// ------------------------------------------------------------------ scenery
export function grassTuft(): G {
  const parts: G[] = [];
  const shades = ["#4FB548", "#62C455", "#3E9E3E"];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.ConeGeometry(0.07, 0.55 + (i % 3) * 0.18, 4);
    c.rotateZ((i - 1.5) * 0.25); c.rotateX((i % 2 ? 0.2 : -0.15)); c.translate((i - 1.5) * 0.09, 0.3, (i % 2) * 0.08);
    parts.push(tint(c, shades[i % 3]));
  }
  return merge(parts);
}
export function clover(): G {
  const parts: G[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, l = sphere(0.16, 7, 5); l.scale(1, 0.25, 1); l.translate(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
    parts.push(tint(l, i === 1 ? "#3E9E3E" : "#4FB548"));
  }
  return merge(parts);
}
export function mushroom(): G {
  const stem = new THREE.CylinderGeometry(0.16, 0.22, 0.5, 8); stem.translate(0, 0.25, 0);
  const cap = sphere(0.45, 12, 8, ); cap.scale(1, 0.6, 1); cap.translate(0, 0.55, 0);
  const parts = [tint(stem, "#FFF3DE"), tint(cap, "#FF5A4E")];
  for (let i = 0; i < 5; i++) { const a = i * 1.3; parts.push(tint(at(sphere(0.07, 6, 4), Math.cos(a) * 0.28, 0.76, Math.sin(a) * 0.28), "#FFFFFF")); }
  return merge(parts);
}
export function flower(color: string): G {
  const stem = new THREE.CylinderGeometry(0.025, 0.03, 0.45, 5); stem.translate(0, 0.22, 0);
  const parts = [tint(stem, "#3E9E3E")];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = sphere(0.09, 6, 4); p.scale(1, 0.5, 1); p.translate(Math.cos(a) * 0.1, 0.47, Math.sin(a) * 0.1); parts.push(tint(p, color)); }
  parts.push(tint(at(sphere(0.06, 6, 4), 0, 0.5, 0), "#FFD23F"));
  return merge(parts);
}
export function lollipop(colors: [string, string]): G {
  const stick = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6); stick.translate(0, 0.65, 0);
  const parts = [tint(stick, "#FFFFFF")];
  for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(0.12 + i * 0.11, 0.06, 5, 16); t.translate(0, 1.5, 0); parts.push(tint(t, colors[i % 2])); }
  parts.push(tint(at(sphere(0.1, 8, 6), 0, 1.5, 0), colors[0]));
  return merge(parts);
}
export function cupcake(frost: string): G {
  const wrap = new THREE.CylinderGeometry(0.42, 0.32, 0.45, 12); wrap.translate(0, 0.22, 0);
  const top = sphere(0.46, 12, 8); top.scale(1, 0.7, 1); top.translate(0, 0.55, 0);
  const cherry = sphere(0.1, 8, 6); cherry.translate(0, 0.9, 0);
  return merge([tint(wrap, "#FFFFFF"), tint(top, frost), tint(cherry, "#FF3B5C")]);
}
export function donut(icing: string): G {
  const base = new THREE.TorusGeometry(0.42, 0.2, 8, 16); base.rotateX(Math.PI / 2); base.translate(0, 0.2, 0);
  const ice = new THREE.TorusGeometry(0.42, 0.17, 8, 16); ice.rotateX(Math.PI / 2); ice.scale(1, 0.6, 1); ice.translate(0, 0.3, 0);
  return merge([tint(base, "#E2A05E"), tint(ice, icing)]);
}
export function gumdrop(color: string): G {
  const g = sphere(0.3, 10, 7); g.scale(1, 1.1, 1); g.translate(0, 0.25, 0);
  return merge([tint(g, color)]);
}

// ------------------------------------------------------------------ villains (stage-end bosses)
/** Kranky Krab: red crab in a top hat with big claws and eyes on stalks */
export function krankyKrab(): G {
  const parts: G[] = [];
  const red = "#E8504F", dark = "#B3332F";
  const body = sphere(1, 18, 12); body.scale(1.1, 0.55, 0.85); body.translate(0, 0.75, 0); parts.push(tint(body, red));
  for (const sx of [-1, 1]) {
    const stalk = new THREE.CylinderGeometry(0.07, 0.08, 0.55, 6); stalk.translate(sx * 0.32, 1.45, 0.35); parts.push(tint(stalk, dark));
    parts.push(tint(at(sphere(0.22, 10, 8), sx * 0.32, 1.78, 0.38), "#FFFFFF"));
    parts.push(tint(at(sphere(0.11, 8, 6), sx * 0.3, 1.78, 0.58), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.34, 0.08, 0.1); brow.rotateZ(sx * 0.55); brow.translate(sx * 0.32, 2.02, 0.42); parts.push(tint(brow, "#2A2140"));
    // claw: an arm, a big palm and two pincers
    const arm = new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8); arm.rotateZ(sx * 1.0); arm.translate(sx * 1.05, 0.95, 0.35); parts.push(tint(arm, red));
    const palm = sphere(0.42, 12, 9); palm.scale(1, 0.75, 0.9); palm.translate(sx * 1.45, 1.25, 0.55); parts.push(tint(palm, red));
    for (const up of [1, -1]) {
      const pin = new THREE.ConeGeometry(0.15, 0.55, 7); pin.rotateX(Math.PI / 2); pin.rotateZ(up * 0.25); pin.translate(sx * 1.45, 1.25 + up * 0.17, 1.0); parts.push(tint(pin, dark));
    }
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.CylinderGeometry(0.05, 0.06, 0.75, 5); leg.rotateZ(sx * 0.9); leg.translate(sx * 0.95, 0.4, -0.35 + k * 0.32); parts.push(tint(leg, dark));
    }
  }
  const smirk = new THREE.TorusGeometry(0.22, 0.045, 5, 12, Math.PI); smirk.rotateZ(Math.PI); smirk.translate(0, 0.86, 0.86); parts.push(tint(smirk, "#2A2140"));
  const brim = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 18); brim.translate(0, 1.22, -0.05); parts.push(tint(brim, "#1B1530"));
  const hat = new THREE.CylinderGeometry(0.33, 0.35, 0.62, 18); hat.translate(0, 1.55, -0.05); parts.push(tint(hat, "#1B1530"));
  const band = new THREE.CylinderGeometry(0.355, 0.36, 0.12, 18); band.translate(0, 1.32, -0.05); parts.push(tint(band, "#FFD23F"));
  return merge(parts);
}

/** Storm Grump: an angry thundercloud */
export function stormCloud(): G {
  const parts: G[] = [];
  const puffs: [number, number, number, number][] = [[0, 0.1, 0, 0.95], [-0.85, -0.05, 0.05, 0.7], [0.85, -0.05, 0.05, 0.72], [-0.45, 0.45, -0.1, 0.6], [0.5, 0.42, -0.1, 0.62], [-1.35, -0.2, -0.05, 0.48], [1.35, -0.2, -0.05, 0.5]];
  puffs.forEach(([x, y, z, r], i) => parts.push(tint(at(sphere(r, 14, 10), x, y, z), i % 2 ? "#8F96AE" : "#A7AEC6")));
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.2, 10, 8), sx * 0.3, 0.2, 0.86), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1, 8, 6), sx * 0.28, 0.16, 1.03), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.42, 0.1, 0.12); brow.rotateZ(sx * 0.55); brow.translate(sx * 0.3, 0.48, 0.9); parts.push(tint(brow, "#2A2140"));
  }
  const mouth = new THREE.TorusGeometry(0.22, 0.05, 5, 12, Math.PI); mouth.translate(0, -0.22, 0.95); parts.push(tint(mouth, "#2A2140"));
  // a little lightning bolt hanging under it
  const zig = [[0, -0.9, 0.12, 0.45, -0.3], [0.1, -1.25, 0.12, 0.4, 0.5], [-0.02, -1.6, 0.12, 0.45, -0.3]];
  for (const [x, y, w, h, rz] of zig) { const b = new THREE.BoxGeometry(w, h, 0.1); b.rotateZ(rz); b.translate(x, y, 0.3); parts.push(tint(b, "#FFD23F")); }
  return merge(parts);
}

/** Balloon Baron: a striped hot-air balloon with a grumpy face and a basket */
export function balloonBaron(): G {
  const parts: G[] = [];
  const ball = new THREE.SphereGeometry(1, 16, 14); ball.scale(1, 1.1, 1);
  const pos = ball.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color("#8F6BFF"), b = new THREE.Color("#FFD23F");
  for (let i = 0; i < pos.count; i++) { const ang = Math.atan2(pos.getZ(i), pos.getX(i)); const c = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 2 ? a : b; col.set([c.r, c.g, c.b], i * 3); }
  ball.setAttribute("color", new THREE.BufferAttribute(col, 3));
  ball.translate(0, 1.0, 0); parts.push(ball.toNonIndexed());
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.2, 10, 8), sx * 0.3, 1.2, 0.95), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1, 8, 6), sx * 0.28, 1.16, 1.13), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.4, 0.1, 0.12); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.3, 1.46, 0.98); parts.push(tint(brow, "#2A2140"));
  }
  const mouth = new THREE.TorusGeometry(0.2, 0.05, 5, 12, Math.PI); mouth.translate(0, 0.78, 1.02); parts.push(tint(mouth, "#2A2140"));
  const basket = new THREE.BoxGeometry(0.7, 0.45, 0.7); basket.translate(0, -0.95, 0); parts.push(tint(basket, "#A0662F"));
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const rope = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 4); rope.translate(x, -0.35, z); parts.push(tint(rope, "#5A3A1A")); }
  const pilot = sphere(0.24, 10, 8); pilot.translate(0, -0.6, 0.05); parts.push(tint(pilot, "#8F86B8"));
  return merge(parts);
}

/** Sir Spikes: a grumpy hedgehog covered in spikes */
export function sirSpikes(): G {
  const parts: G[] = [];
  const body = sphere(1, 16, 12); body.scale(1, 0.85, 1.05); body.translate(0, 0.85, 0); parts.push(tint(body, "#8B5E3C"));
  const belly = sphere(0.62, 12, 9); belly.scale(1, 0.95, 0.55); belly.translate(0, 0.72, 0.62); parts.push(tint(belly, "#E8C79A"));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 46; i++) {
    const u = (i + 0.5) / 46, th = Math.acos(1 - u * 1.2), ph = i * 2.399963;
    const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    if (dir.z > 0.45) continue; // keep the face clear
    const c = new THREE.ConeGeometry(0.12, 0.55, 5); c.translate(0, 0.27, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    c.translate(dir.x * 0.95, 0.85 + dir.y * 0.8, dir.z * 1.0);
    parts.push(tint(c, i % 3 ? "#4A2E1A" : "#5E3B22"));
  }
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.18, 10, 8), sx * 0.3, 1.1, 0.88), "#FFFFFF"));
    parts.push(tint(at(sphere(0.09, 8, 6), sx * 0.28, 1.07, 1.04), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.36, 0.09, 0.1); brow.rotateZ(sx * 0.55); brow.translate(sx * 0.3, 1.33, 0.9); parts.push(tint(brow, "#2A2140"));
  }
  parts.push(tint(at(sphere(0.13, 8, 6), 0, 0.9, 1.08), "#1B1530"));
  return merge(parts);
}

/** Chef Grumble: a grumpy chef with a tall hat and a big moustache */
export function chefGrumble(): G {
  const parts: G[] = [];
  const body = sphere(1, 18, 13); body.scale(1, 0.95, 0.92); body.translate(0, 1, 0); parts.push(tint(body, "#B58AC0"));
  const apron = sphere(0.7, 14, 10); apron.scale(1, 1.1, 0.45); apron.translate(0, 0.72, 0.66); parts.push(tint(apron, "#FFFFFF"));
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.2, 10, 8), sx * 0.32, 1.35, 0.78), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1, 8, 6), sx * 0.3, 1.31, 0.96), "#1B1530"));
    const brow = new THREE.BoxGeometry(0.46, 0.11, 0.12); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.32, 1.63, 0.8); parts.push(tint(brow, "#2A2140"));
    const tache = sphere(0.26, 10, 8); tache.scale(1.3, 0.55, 0.6); tache.rotateZ(sx * -0.35); tache.translate(sx * 0.24, 1.03, 0.9); parts.push(tint(tache, "#3B2A20"));
    const arm = sphere(0.3, 10, 8); arm.scale(1, 1.25, 1); arm.translate(sx * 1.0, 0.95, 0.2); parts.push(tint(arm, "#B58AC0"));
  }
  const band = new THREE.CylinderGeometry(0.55, 0.58, 0.3, 18); band.translate(0, 1.95, -0.05); parts.push(tint(band, "#FFFFFF"));
  const puff = sphere(0.7, 14, 10); puff.scale(1, 0.7, 1); puff.translate(0, 2.4, -0.05); parts.push(tint(puff, "#FFFFFF"));
  const pin = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8); pin.rotateZ(Math.PI / 2); pin.translate(1.0, 0.7, 0.55); parts.push(tint(pin, "#D9A066"));
  return merge(parts);
}

/** a little green cap for Spitter Grumpies */
export function spitCap(): G {
  const cap = sphere(0.72, 10, 6); cap.scale(1, 0.55, 1); cap.translate(0, 1.62, -0.05);
  const peak = new THREE.BoxGeometry(0.7, 0.07, 0.45); peak.translate(0, 1.52, 0.6);
  return merge([tint(cap, "#3FAE4A"), tint(peak, "#2E8A38")]);
}
/** a striped parachute for Grumpies the Balloon Baron drops */
export function parachute(): G {
  const canopy = new THREE.SphereGeometry(1.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); canopy.translate(0, 3.2, 0);
  const pos = canopy.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color("#FF5FA2"), b = new THREE.Color("#FFFFFF");
  for (let i = 0; i < pos.count; i++) { const ang = Math.atan2(pos.getZ(i), pos.getX(i)); const c = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 6) % 2 ? a : b; col.set([c.r, c.g, c.b], i * 3); }
  canopy.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const parts: G[] = [canopy.toNonIndexed()];
  for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const l = new THREE.CylinderGeometry(0.02, 0.02, 1.6, 3); l.rotateZ(-x * 0.55); l.rotateX(z * 0.55); l.translate(x * 0.6, 2.4, z * 0.6); parts.push(tint(l, "#FFFFFF")); }
  return merge(parts);
}
/** a zig-zag lightning bolt from the sky to the ground (8 units tall) */
export function boltGeo(): G {
  const parts: G[] = [];
  const pts = [[0, 8], [0.6, 6], [-0.3, 4.4], [0.5, 2.6], [-0.2, 1.2], [0.1, 0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    const b = new THREE.BoxGeometry(0.28, len, 0.28); b.rotateZ(-Math.atan2(x0 - x1, y0 - y1)); b.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    parts.push(tint(b, "#FFE45C"));
  }
  return merge(parts);
}

// ================================================================== Phase 2 models
// ------------------------------------------------------------------ new Grumpy accessories
/** Bouncer: long bunny ears (they hop) */
export function bunnyEars(): G {
  const parts: G[] = [];
  for (const sx of [-1, 1]) {
    const e = sphere(1, 8, 6); e.scale(0.16, 0.55, 0.1); e.rotateZ(sx * -0.25); e.translate(sx * 0.32, 2.2, -0.05); parts.push(tint(e, "#8F86B8"));
    const inner = sphere(1, 8, 6); inner.scale(0.09, 0.4, 0.05); inner.rotateZ(sx * -0.25); inner.translate(sx * 0.32, 2.2, 0.04); parts.push(tint(inner, "#FF9BC4"));
  }
  return merge(parts);
}
/** Splitter: a zip down the middle (it pops into two) */
export function zipper(): G {
  const parts: G[] = [];
  const line = new THREE.BoxGeometry(0.08, 1.5, 0.08); line.translate(0, 1.05, 0.97); parts.push(tint(line, "#FFD23F"));
  for (let i = 0; i < 6; i++) { const t = new THREE.BoxGeometry(0.22, 0.05, 0.06); t.translate(0, 0.45 + i * 0.25, 0.99); parts.push(tint(t, "#C99A1A")); }
  const pull = sphere(0.1, 6, 4); pull.translate(0.14, 1.75, 1.0); parts.push(tint(pull, "#FFD23F"));
  return merge(parts);
}
/** Shield Grumpy: a round wooden shield held in front */
export function woodShield(): G {
  const disc = new THREE.CylinderGeometry(0.78, 0.78, 0.14, 16); disc.rotateX(Math.PI / 2); disc.translate(0, 0.95, 1.1);
  const rim = new THREE.TorusGeometry(0.78, 0.07, 5, 18); rim.translate(0, 0.95, 1.16);
  const boss = sphere(0.18, 8, 6); boss.translate(0, 0.95, 1.22);
  const plank = new THREE.BoxGeometry(0.06, 1.4, 0.04); plank.translate(-0.25, 0.95, 1.19);
  const plank2 = plank.clone(); plank2.translate(0.5, 0, 0);
  return merge([tint(disc, "#B07A3E"), tint(rim, "#6B4A2A"), tint(boss, "#C9CED6"), tint(plank, "#8F6332"), tint(plank2, "#8F6332")]);
}
/** Balloon Grumpy: holds a red balloon on a string */
export function grumpBalloon(): G {
  const b = sphere(0.62, 12, 9); b.scale(1, 1.18, 1); b.translate(0.35, 3.35, 0);
  const knot = new THREE.ConeGeometry(0.1, 0.18, 6); knot.rotateZ(Math.PI); knot.translate(0.35, 2.6, 0);
  const str = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4); str.translate(0.32, 2.0, 0);
  const shine = sphere(0.12, 6, 4); shine.translate(0.18, 3.6, 0.45);
  return merge([tint(b, "#FF4D6D"), tint(knot, "#D6304E"), tint(str, "#FFFFFF"), tint(shine, "#FFC2CF")]);
}

// ------------------------------------------------------------------ hazards
export function boulderGeo(): G {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const k = 0.85 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.25; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals();
  return merge([tint(g, "#8C7B66")]);
}
/** a stack of toy blocks (swallows bubbles) */
export function toyBlocks(): G {
  const parts: G[] = [];
  const cols = ["#FF5F7E", "#3D8BFF", "#FFD23F", "#2FCB8B"];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.BoxGeometry(0.62, 0.62, 0.62); c.translate(-0.33 + (i % 2) * 0.66, 0.31 + Math.floor(i / 2) * 0.64, 0); c.rotateY(i * 0.15);
    parts.push(tint(c, cols[i]));
    const dot = sphere(0.12, 6, 4); dot.translate(-0.33 + (i % 2) * 0.66, 0.31 + Math.floor(i / 2) * 0.64, 0.33); parts.push(tint(dot, "#FFFFFF"));
  }
  const top = new THREE.BoxGeometry(0.62, 0.62, 0.62); top.translate(0.33, 0.95, 0); parts.push(tint(top, cols[3]));
  return merge(parts);
}

// ------------------------------------------------------------------ world bosses
const face = (parts: G[], y: number, z: number, sc = 1, brow = "#2A2140") => {
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.2 * sc, 10, 8), sx * 0.32 * sc, y, z), "#FFFFFF"));
    parts.push(tint(at(sphere(0.1 * sc, 8, 6), sx * 0.3 * sc, y - 0.04 * sc, z + 0.18 * sc), "#1B1530"));
    const b = new THREE.BoxGeometry(0.44 * sc, 0.1 * sc, 0.12 * sc); b.rotateZ(sx * 0.5); b.translate(sx * 0.32 * sc, y + 0.28 * sc, z + 0.02); parts.push(tint(b, brow));
  }
  const m = new THREE.TorusGeometry(0.22 * sc, 0.05 * sc, 5, 12, Math.PI); m.translate(0, y - 0.45 * sc, z + 0.08); parts.push(tint(m, brow));
};
/** Snow Grump Giant: a furry white yeti */
export function yetiGeo(): G {
  const parts: G[] = [];
  const body = sphere(1, 18, 13); body.scale(1, 1.05, 0.9); body.translate(0, 1.05, 0); parts.push(tint(body, "#F2F6FF"));
  const facePatch = sphere(0.62, 14, 10); facePatch.scale(1, 0.85, 0.5); facePatch.translate(0, 1.35, 0.6); parts.push(tint(facePatch, "#9FC6E8"));
  face(parts, 1.42, 0.85);
  for (const sx of [-1, 1]) {
    const arm = sphere(0.36, 10, 8); arm.scale(1, 1.4, 1); arm.translate(sx * 1.05, 0.9, 0.15); parts.push(tint(arm, "#E6EEFA"));
    const horn = new THREE.ConeGeometry(0.13, 0.5, 6); horn.rotateZ(sx * -0.6); horn.translate(sx * 0.62, 2.05, 0); parts.push(tint(horn, "#B9C3D6"));
  }
  for (let i = 0; i < 10; i++) { const tuft = new THREE.ConeGeometry(0.12, 0.3, 5); const a = (i / 10) * Math.PI * 2; tuft.translate(Math.cos(a) * 0.95, 0.35, Math.sin(a) * 0.85); parts.push(tint(tuft, "#FFFFFF")); }
  return merge(parts);
}
/** Robo Grump: a boxy wind-up robot (armour is a separate mesh) */
export function roboGeo(): G {
  const parts: G[] = [];
  const body = new THREE.BoxGeometry(1.7, 1.5, 1.3); body.translate(0, 1.1, 0); parts.push(tint(body, "#8F96AE"));
  const head = new THREE.BoxGeometry(1.1, 0.8, 0.95); head.translate(0, 2.25, 0.05); parts.push(tint(head, "#A7AEC6"));
  const screen = new THREE.BoxGeometry(0.85, 0.5, 0.05); screen.translate(0, 2.25, 0.55); parts.push(tint(screen, "#1B1530"));
  for (const sx of [-1, 1]) {
    parts.push(tint(at(sphere(0.11, 8, 6), sx * 0.2, 2.3, 0.6), "#FF4D6D"));
    const brow = new THREE.BoxGeometry(0.25, 0.06, 0.06); brow.rotateZ(sx * 0.5); brow.translate(sx * 0.2, 2.45, 0.6); parts.push(tint(brow, "#FF4D6D"));
    const arm = new THREE.CylinderGeometry(0.16, 0.16, 1.0, 8); arm.rotateZ(Math.PI / 2); arm.translate(sx * 1.25, 1.2, 0); parts.push(tint(arm, "#6C7390"));
    const claw = sphere(0.3, 10, 8); claw.translate(sx * 1.8, 1.2, 0.2); parts.push(tint(claw, "#FFD23F"));
    const leg = new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8); leg.translate(sx * 0.45, 0.25, 0); parts.push(tint(leg, "#6C7390"));
  }
  const ant = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5); ant.translate(0, 2.9, 0); parts.push(tint(ant, "#6C7390"));
  parts.push(tint(at(sphere(0.12, 8, 6), 0, 3.18, 0), "#FF4D6D"));
  const key = new THREE.TorusGeometry(0.3, 0.07, 5, 12); key.translate(0, 1.4, -0.9); parts.push(tint(key, "#FFD23F"));
  return merge(parts);
}
export function roboArmor(): G {
  const parts: G[] = [];
  const chest = new THREE.BoxGeometry(1.85, 1.2, 0.2); chest.translate(0, 1.15, 0.72); parts.push(tint(chest, "#C9A227"));
  for (const sx of [-1, 1]) { const pad = sphere(0.42, 10, 6, ); pad.scale(1, 0.6, 1); pad.translate(sx * 0.95, 1.9, 0); parts.push(tint(pad, "#C9A227")); }
  for (let i = 0; i < 4; i++) { const r = sphere(0.07, 6, 4); r.translate(-0.7 + i * 0.47, 1.65, 0.84); parts.push(tint(r, "#8C6A10")); }
  return merge(parts);
}
/** Captain Kranky's Boat: a little pirate ship */
export function boatGeo(): G {
  const parts: G[] = [];
  const hull = new THREE.CylinderGeometry(1.0, 0.7, 0.9, 16, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateY(Math.PI / 2); hull.scale(1.5, 1, 1.0); hull.translate(0, 0.55, 0);
  parts.push(tint(hull, "#8B5A2B"));
  const deck = new THREE.BoxGeometry(2.6, 0.12, 1.4); deck.translate(0, 0.98, 0); parts.push(tint(deck, "#B07A3E"));
  const mast = new THREE.CylinderGeometry(0.07, 0.08, 2.6, 6); mast.translate(0, 2.2, -0.2); parts.push(tint(mast, "#5A3A1A"));
  const sail = new THREE.BoxGeometry(1.6, 1.3, 0.05); sail.translate(0, 2.4, -0.15); parts.push(tint(sail, "#F5F0E6"));
  const skull = sphere(0.25, 10, 8); skull.scale(1.2, 0.8, 0.3); skull.translate(0, 2.45, -0.08); parts.push(tint(skull, "#E8504F"));
  const flag = new THREE.BoxGeometry(0.5, 0.3, 0.03); flag.translate(0.28, 3.4, -0.2); parts.push(tint(flag, "#1B1530"));
  for (const sx of [-1, 1]) { const can = new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8); can.rotateX(Math.PI / 2); can.translate(sx * 0.7, 1.15, 0.75); parts.push(tint(can, "#2A2140")); }
  // Kranky at the wheel
  const kr = sphere(0.36, 12, 8); kr.scale(1.2, 0.7, 1); kr.translate(0.8, 1.3, 0.2); parts.push(tint(kr, "#E8504F"));
  const hat = new THREE.CylinderGeometry(0.16, 0.18, 0.3, 10); hat.translate(0.8, 1.68, 0.2); parts.push(tint(hat, "#1B1530"));
  return merge(parts);
}
/** Grumpy Ghost: a floppy sheet with an angry face */
export function ghostGeo(): G {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.sin(t * Math.PI * 0.5) * 1.0 * (1 - t * 0.1) + 0.0001, 2.4 - t * 2.4 + (i === 12 ? 0 : 0))); }
  const sheet = new THREE.LatheGeometry(pts.reverse(), 20);
  const p = sheet.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.35) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + Math.sin(a * 6) * 0.15); }
  sheet.computeVertexNormals();
  const parts: G[] = [tint(sheet, "#F4F2FF")];
  face(parts, 1.7, 0.85, 1.1, "#3B2E66");
  for (const sx of [-1, 1]) { const arm = sphere(0.25, 8, 6); arm.scale(1.4, 0.6, 0.6); arm.translate(sx * 1.05, 1.2, 0.1); parts.push(tint(arm, "#F4F2FF")); }
  return merge(parts);
}
/** Stone Golem: stacked stones with a core (the glowing core is a separate mesh) */
export function golemGeo(): G {
  const parts: G[] = [];
  const stones: [number, number, number, number, number, number][] = [[0, 0.55, 0, 1.5, 1.0, 1.1], [0, 1.6, 0, 1.8, 1.1, 1.2], [0, 2.55, 0.05, 1.1, 0.8, 0.95], [-1.25, 1.55, 0.1, 0.6, 0.9, 0.6], [1.25, 1.55, 0.1, 0.6, 0.9, 0.6], [-1.3, 0.8, 0.25, 0.5, 0.6, 0.5], [1.3, 0.8, 0.25, 0.5, 0.6, 0.5]];
  stones.forEach(([x, y, z, w, h, d], i) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateY((i % 3 - 1) * 0.08); b.translate(x, y, z); parts.push(tint(b, i % 2 ? "#8A8F7A" : "#9DA28C")); });
  for (const sx of [-1, 1]) { const eye = new THREE.BoxGeometry(0.22, 0.12, 0.05); eye.translate(sx * 0.25, 2.6, 0.55); parts.push(tint(eye, "#7CFFB2")); }
  const moss = sphere(0.35, 8, 6); moss.scale(1.4, 0.4, 1); moss.translate(-0.3, 3.0, 0); parts.push(tint(moss, "#4FA84A"));
  return merge(parts);
}
/** Magma Grump: a hot rock blob with glowing cracks */
export function magmaGeo(): G {
  const parts: G[] = [];
  const body = sphere(1, 18, 13); body.scale(1, 0.95, 0.92); body.translate(0, 1, 0); parts.push(tint(body, "#3E2A24"));
  for (let i = 0; i < 9; i++) {
    const a = i * 0.9, c = new THREE.BoxGeometry(0.08, 0.6 + (i % 3) * 0.2, 0.05);
    c.rotateZ(Math.sin(i) * 0.8); c.translate(Math.cos(a) * 0.75, 0.7 + (i % 4) * 0.3, Math.sin(a) * 0.6 + 0.3);
    parts.push(tint(c, "#FF8A1F"));
  }
  face(parts, 1.3, 0.82, 1, "#FFB347");
  const top = new THREE.ConeGeometry(0.5, 0.6, 10); top.translate(0, 2.05, 0); parts.push(tint(top, "#2E1E1A"));
  const lava = sphere(0.3, 10, 6); lava.scale(1, 0.5, 1); lava.translate(0, 2.35, 0); parts.push(tint(lava, "#FF5A1F"));
  return merge(parts);
}
/** UFO Mothership: a saucer with a dome and a ring of lights */
export function ufoGeo(): G {
  const parts: G[] = [];
  const disc = sphere(1, 22, 10); disc.scale(1.6, 0.35, 1.6); disc.translate(0, 0, 0); parts.push(tint(disc, "#A7AEC6"));
  const rim = new THREE.TorusGeometry(1.55, 0.1, 6, 28); rim.rotateX(Math.PI / 2); parts.push(tint(rim, "#6C7390"));
  const dome = sphere(0.75, 16, 10, ); dome.scale(1, 0.8, 1); dome.translate(0, 0.3, 0); parts.push(tint(dome, "#8FE3FF"));
  const pilot = sphere(0.35, 10, 8); pilot.translate(0, 0.45, 0.1); parts.push(tint(pilot, "#8F86B8"));
  for (const sx of [-1, 1]) { parts.push(tint(at(sphere(0.08, 6, 4), sx * 0.12, 0.55, 0.42), "#FFFFFF")); const b = new THREE.BoxGeometry(0.14, 0.04, 0.04); b.rotateZ(sx * 0.5); b.translate(sx * 0.12, 0.65, 0.42); parts.push(tint(b, "#2A2140")); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push(tint(at(sphere(0.12, 6, 4), Math.cos(a) * 1.35, -0.08, Math.sin(a) * 1.35), i % 2 ? "#FFD23F" : "#FF5FA2")); }
  return merge(parts);
}
/** King Kranky Mech: Kranky in a big metal crab suit */
export function mechGeo(): G {
  const parts: G[] = [];
  const body = sphere(1, 18, 12); body.scale(1.3, 0.65, 1.0); body.translate(0, 1.1, 0); parts.push(tint(body, "#7D8597"));
  const belly = new THREE.BoxGeometry(1.4, 0.5, 0.2); belly.translate(0, 1.0, 0.95); parts.push(tint(belly, "#C9A227"));
  for (const sx of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.16, 0.18, 1.1, 8); arm.rotateZ(sx * 1.0); arm.translate(sx * 1.45, 1.35, 0.35); parts.push(tint(arm, "#5C6375"));
    const palm = sphere(0.55, 12, 9); palm.scale(1, 0.75, 0.9); palm.translate(sx * 2.0, 1.75, 0.65); parts.push(tint(palm, "#E8504F"));
    for (const up of [1, -1]) { const pin = new THREE.ConeGeometry(0.2, 0.7, 7); pin.rotateX(Math.PI / 2); pin.rotateZ(up * 0.25); pin.translate(sx * 2.0, 1.75 + up * 0.22, 1.25); parts.push(tint(pin, "#5C6375")); }
    for (let k = 0; k < 3; k++) { const leg = new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6); leg.rotateZ(sx * 0.8); leg.translate(sx * 1.3, 0.45, -0.45 + k * 0.45); parts.push(tint(leg, "#5C6375")); }
  }
  // Kranky in the cockpit with his crown
  const kr = sphere(0.5, 14, 10); kr.scale(1.2, 0.75, 0.95); kr.translate(0, 2.05, 0.1); parts.push(tint(kr, "#E8504F"));
  face(parts, 2.25, 0.55, 0.8);
  const cr = crown(); cr.scale(0.7, 0.7, 0.7); cr.translate(0, 1.35, 0.05);
  const col = cr.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.9 && col.getY(i) > 0.9) col.setXYZ(i, 1, 0.82, 0.25);
  parts.push(cr);
  return merge(parts);
}

// ------------------------------------------------------------------ world scenery
export function pineTree(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), 0, 0.3, 0), "#7A5230")];
  for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(0.75 - i * 0.18, 0.9, 8); c.translate(0, 0.9 + i * 0.5, 0); parts.push(tint(c, i === 2 ? "#FFFFFF" : "#2E7D5B")); }
  return merge(parts);
}
export function snowman(): G {
  const parts = [tint(at(sphere(0.5, 10, 8), 0, 0.45, 0), "#FFFFFF"), tint(at(sphere(0.36, 10, 8), 0, 1.15, 0), "#FFFFFF"), tint(at(sphere(0.26, 10, 8), 0, 1.65, 0), "#FFFFFF")];
  const nose = new THREE.ConeGeometry(0.06, 0.3, 6); nose.rotateX(Math.PI / 2); nose.translate(0, 1.65, 0.38); parts.push(tint(nose, "#FF8A3D"));
  const hat = new THREE.CylinderGeometry(0.18, 0.2, 0.3, 10); hat.translate(0, 1.95, 0); parts.push(tint(hat, "#2A2140"));
  return merge(parts);
}
export function igloo(): G {
  const d = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const door = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 10, 1, false, 0, Math.PI); door.rotateX(Math.PI / 2); door.translate(0, 0, 0.95);
  return merge([tint(d, "#EAF4FF"), tint(door, "#9FC6E8")]);
}
export function toyBall(c1: string, c2: string): G {
  const s = sphere(0.5, 14, 10); s.translate(0, 0.5, 0);
  const pos = s.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(c1), b = new THREE.Color(c2);
  for (let i = 0; i < pos.count; i++) { const c = Math.floor((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI / 3)) % 2 ? a : b; col.set([c.r, c.g, c.b], i * 3); }
  s.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return merge([s]);
}
export function palmTree(): G {
  const parts: G[] = [];
  for (let i = 0; i < 6; i++) { const seg = new THREE.CylinderGeometry(0.13, 0.16, 0.4, 7); seg.translate(i * 0.05, 0.2 + i * 0.38, 0); parts.push(tint(seg, i % 2 ? "#A0703C" : "#B8834A")); }
  for (let i = 0; i < 6; i++) { const leaf = sphere(1, 8, 4); leaf.scale(0.85, 0.06, 0.24); leaf.translate(0.75, 0, 0); leaf.rotateZ(-0.35); leaf.rotateY((i / 6) * Math.PI * 2); leaf.translate(0.3, 2.35, 0); parts.push(tint(leaf, i % 2 ? "#3FAE4A" : "#2E8A38")); }
  for (let i = 0; i < 3; i++) parts.push(tint(at(sphere(0.12, 6, 4), 0.3 + Math.cos(i * 2) * 0.18, 2.2, Math.sin(i * 2) * 0.18), "#6B4A2A"));
  return merge(parts);
}
export function beachUmbrella(): G {
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5); pole.translate(0, 0.8, 0);
  const top = new THREE.ConeGeometry(0.95, 0.4, 10); top.translate(0, 1.7, 0);
  const pos = top.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color("#FF5F7E"), b = new THREE.Color("#FFFFFF");
  for (let i = 0; i < pos.count; i++) { const c = Math.floor((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI / 5)) % 2 ? a : b; col.set([c.r, c.g, c.b], i * 3); }
  top.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return merge([tint(pole, "#FFFFFF"), top.index ? top.toNonIndexed() : top]);
}
export function sandBucket(): G {
  const b = new THREE.CylinderGeometry(0.3, 0.24, 0.45, 12); b.translate(0, 0.22, 0);
  const h = new THREE.TorusGeometry(0.28, 0.025, 4, 12, Math.PI); h.translate(0, 0.45, 0);
  const star = new THREE.ConeGeometry(0.25, 0.08, 5); star.translate(0.6, 0.04, 0.2);
  return merge([tint(b, "#2EC4B6"), tint(h, "#1B8F86"), tint(star, "#FF8A3D")]);
}
export function pumpkin(): G {
  const parts: G[] = [];
  for (let i = 0; i < 6; i++) { const s = sphere(0.36, 10, 8); s.scale(0.7, 1, 1); s.rotateY((i / 6) * Math.PI); s.translate(0, 0.38, 0); parts.push(tint(s, "#FF8A1F")); }
  const stem = new THREE.CylinderGeometry(0.05, 0.07, 0.2, 5); stem.translate(0, 0.78, 0); parts.push(tint(stem, "#3E7A2A"));
  for (const sx of [-1, 1]) { const e = new THREE.ConeGeometry(0.08, 0.12, 3); e.translate(sx * 0.13, 0.48, 0.34); parts.push(tint(e, "#FFE45C")); }
  const m = new THREE.BoxGeometry(0.28, 0.06, 0.05); m.translate(0, 0.3, 0.36); parts.push(tint(m, "#FFE45C"));
  return merge(parts);
}
export function gravestone(): G {
  const s = new THREE.BoxGeometry(0.6, 0.8, 0.18); s.translate(0, 0.4, 0);
  const top = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12, 1, false, 0, Math.PI); top.rotateX(Math.PI / 2); top.rotateZ(Math.PI / 2); top.rotateY(Math.PI / 2); top.translate(0, 0.8, 0);
  const crack = new THREE.BoxGeometry(0.04, 0.3, 0.02); crack.rotateZ(0.4); crack.translate(0.1, 0.5, 0.1);
  return merge([tint(s, "#8A8698"), tint(top, "#8A8698"), tint(crack, "#5A566A")]);
}
export function deadTree(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.1, 0.18, 1.8, 6), 0, 0.9, 0), "#3B2E2A")];
  for (let i = 0; i < 4; i++) { const b = new THREE.CylinderGeometry(0.03, 0.06, 0.8, 5); b.translate(0, 0.4, 0); b.rotateZ((i % 2 ? 1 : -1) * (0.6 + i * 0.1)); b.rotateY(i * 1.5); b.translate(0, 1.0 + i * 0.22, 0); parts.push(tint(b, "#3B2E2A")); }
  return merge(parts);
}
export function lanternPost(): G {
  const pole = new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6); pole.translate(0, 0.8, 0);
  const lamp = new THREE.BoxGeometry(0.3, 0.36, 0.3); lamp.translate(0, 1.75, 0);
  const glow = sphere(0.13, 8, 6); glow.translate(0, 1.75, 0);
  return merge([tint(pole, "#2A2140"), tint(lamp, "#3B3550"), tint(glow, "#FFD27A")]);
}
export function fern(): G {
  const parts: G[] = [];
  for (let i = 0; i < 7; i++) { const l = sphere(1, 6, 4); l.scale(0.12, 0.05, 0.6); l.translate(0, 0, 0.55); l.rotateX(-0.6); l.rotateY((i / 7) * Math.PI * 2); l.translate(0, 0.35, 0); parts.push(tint(l, i % 2 ? "#2E8A38" : "#3FAE4A")); }
  return merge(parts);
}
export function stoneHead(): G {
  const parts: G[] = [];
  const h = new THREE.BoxGeometry(0.9, 1.3, 0.8); h.translate(0, 0.65, 0); parts.push(tint(h, "#9DA28C"));
  const brow = new THREE.BoxGeometry(0.95, 0.15, 0.25); brow.translate(0, 0.95, 0.38); parts.push(tint(brow, "#8A8F7A"));
  const nose = new THREE.BoxGeometry(0.2, 0.4, 0.2); nose.translate(0, 0.65, 0.45); parts.push(tint(nose, "#8A8F7A"));
  const mouth = new THREE.BoxGeometry(0.5, 0.08, 0.05); mouth.translate(0, 0.35, 0.41); parts.push(tint(mouth, "#5A5E4E"));
  const moss = sphere(0.3, 8, 6); moss.scale(1.4, 0.4, 1); moss.translate(0.2, 1.3, 0); parts.push(tint(moss, "#4FA84A"));
  return merge(parts);
}
export function jungleTree(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 7), 0, 1.1, 0), "#6B4A2A")];
  for (const [x, y, z, r] of [[0, 2.4, 0, 0.9], [0.5, 2.2, 0.2, 0.6], [-0.5, 2.3, -0.1, 0.65], [0.1, 2.85, 0.1, 0.6]]) parts.push(tint(at(sphere(r, 10, 8), x, y, z), "#2E8A38"));
  return merge(parts);
}
export function basaltRock(): G {
  const g = new THREE.CylinderGeometry(0.4, 0.55, 1.0, 6); g.translate(0, 0.5, 0);
  const g2 = new THREE.CylinderGeometry(0.3, 0.4, 0.7, 6); g2.translate(0.5, 0.35, 0.2);
  const glow = new THREE.BoxGeometry(0.06, 0.6, 0.02); glow.translate(0.1, 0.5, 0.48);
  return merge([tint(g, "#2E2624"), tint(g2, "#3A302C"), tint(glow, "#FF7A1F")]);
}
export function crystal(color: string): G {
  const parts: G[] = [];
  for (let i = 0; i < 3; i++) { const c = new THREE.OctahedronGeometry(0.3, 0); c.scale(0.6, 1.6, 0.6); c.rotateZ((i - 1) * 0.35); c.translate((i - 1) * 0.25, 0.45, 0); parts.push(tint(c, color)); }
  return merge(parts);
}
export function antenna(): G {
  const pole = new THREE.CylinderGeometry(0.05, 0.08, 1.8, 6); pole.translate(0, 0.9, 0);
  const dish = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3); dish.rotateX(Math.PI * 0.75); dish.translate(0, 1.8, 0.1);
  const light = sphere(0.08, 6, 4); light.translate(0, 1.95, 0);
  return merge([tint(pole, "#A7AEC6"), tint(dish, "#D9DEEA"), tint(light, "#FF4D6D")]);
}
export function castleTower(): G {
  const parts: G[] = [tint(at(new THREE.CylinderGeometry(0.6, 0.7, 2.6, 10), 0, 1.3, 0), "#B9A99A")];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, m = new THREE.BoxGeometry(0.28, 0.3, 0.28); m.translate(Math.cos(a) * 0.55, 2.75, Math.sin(a) * 0.55); parts.push(tint(m, "#A8988A")); }
  const roof = new THREE.ConeGeometry(0.75, 1.0, 10); roof.translate(0, 3.4, 0); parts.push(tint(roof, "#E8504F"));
  const flag = new THREE.BoxGeometry(0.4, 0.25, 0.02); flag.translate(0.2, 4.1, 0); parts.push(tint(flag, "#FFD23F"));
  const pole = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4); pole.translate(0, 4.0, 0); parts.push(tint(pole, "#2A2140"));
  return merge(parts);
}
export function banner(): G {
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5); pole.translate(0, 1.0, 0);
  const cloth = new THREE.BoxGeometry(0.6, 0.9, 0.03); cloth.translate(0.32, 1.45, 0);
  const crab = sphere(0.14, 8, 6); crab.scale(1.3, 0.7, 0.3); crab.translate(0.32, 1.5, 0.03);
  return merge([tint(pole, "#5A3A1A"), tint(cloth, "#E8504F"), tint(crab, "#FFD23F")]);
}

// ================================================================== Phase 3: hats for the brigade (unit space: blob body top ≈ 1.72)
const bands = (g: G, a: string, b: string, axis: "y" | "a", n: number) => {
  const pos = g.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const A = new THREE.Color(a), B = new THREE.Color(b);
  for (let i = 0; i < pos.count; i++) {
    const v = axis === "y" ? Math.floor(pos.getY(i) * n) : Math.floor(((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI * 2)) * n);
    const c = v % 2 ? A : B; col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
};
export function hatGeo(id: string): G | null {
  switch (id) {
    case "party": {
      const c = new THREE.ConeGeometry(0.42, 0.95, 14); c.translate(0, 0.47, 0);
      const cone = bands(c, "#FF5FA2", "#FFD23F", "y", 6); cone.translate(0, 1.55, 0);
      return merge([cone, tint(at(sphere(0.13, 8, 6), 0, 2.55, 0), "#3D8BFF")]);
    }
    case "flower": {
      const parts: G[] = [];
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; parts.push(tint(at(sphere(0.17, 8, 6), Math.cos(a) * 0.62, 1.6, Math.sin(a) * 0.62), ["#FF6FB1", "#FFD23F", "#FFFFFF", "#B26BFF"][i % 4])); parts.push(tint(at(sphere(0.07, 6, 4), Math.cos(a) * 0.68, 1.66, Math.sin(a) * 0.68), "#FF8A1F")); }
      return merge(parts);
    }
    case "cowboy": {
      const brim = new THREE.CylinderGeometry(1.05, 1.05, 0.08, 20); brim.translate(0, 1.55, 0);
      const crown = new THREE.CylinderGeometry(0.48, 0.56, 0.55, 16); crown.translate(0, 1.85, 0);
      const band = new THREE.CylinderGeometry(0.565, 0.565, 0.1, 16); band.translate(0, 1.65, 0);
      return merge([tint(brim, "#A0662F"), tint(crown, "#B8783A"), tint(band, "#4A2A12")]);
    }
    case "pirate": {
      const hat = new THREE.CylinderGeometry(0.75, 0.85, 0.32, 3); hat.rotateY(Math.PI / 6); hat.translate(0, 1.72, 0);
      const top = sphere(0.5, 12, 8); top.scale(1, 0.6, 1); top.translate(0, 1.9, 0);
      const skull = sphere(0.13, 8, 6); skull.translate(0, 1.82, -0.62);
      return merge([tint(hat, "#1B1530"), tint(top, "#1B1530"), tint(skull, "#FFFFFF")]);
    }
    case "wizard": {
      const brim = new THREE.CylinderGeometry(0.85, 0.85, 0.06, 18); brim.translate(0, 1.6, 0);
      const cone = new THREE.ConeGeometry(0.5, 1.35, 14); cone.rotateZ(0.12); cone.translate(0.05, 2.28, 0);
      const parts = [tint(brim, "#5A3DC2"), tint(cone, "#6B4CFF")];
      for (const [x, y] of [[0.22, 2.0], [-0.15, 2.35], [0.12, 2.65]]) parts.push(tint(at(sphere(0.08, 6, 4), x, y, -0.32), "#FFD23F"));
      return merge(parts);
    }
    case "santa": {
      const cone = new THREE.ConeGeometry(0.5, 1.0, 14); cone.rotateZ(0.35); cone.translate(0.18, 2.0, 0);
      const trim = new THREE.TorusGeometry(0.52, 0.12, 6, 18); trim.rotateX(Math.PI / 2); trim.translate(0, 1.55, 0);
      return merge([tint(cone, "#E53950"), tint(trim, "#FFFFFF"), tint(at(sphere(0.16, 8, 6), 0.55, 2.45, 0), "#FFFFFF")]);
    }
    case "propeller": {
      const cap = new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const capB = bands(cap, "#FF5F7E", "#3D8BFF", "a", 6); capB.translate(0, 1.5, 0);
      const stick = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5); stick.translate(0, 2.2, 0);
      const b1 = new THREE.BoxGeometry(1.1, 0.04, 0.16); b1.translate(0, 2.36, 0); const b2 = b1.clone(); b2.rotateY(Math.PI / 2);
      return merge([capB, tint(stick, "#FFD23F"), tint(b1, "#FFD23F"), tint(b2, "#2FCB8B")]);
    }
    case "viking": {
      const helm = new THREE.SphereGeometry(0.66, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); helm.translate(0, 1.45, 0);
      const rim = new THREE.TorusGeometry(0.66, 0.07, 5, 18); rim.rotateX(Math.PI / 2); rim.translate(0, 1.47, 0);
      const parts = [tint(helm, "#A7AEC6"), tint(rim, "#C9A227")];
      for (const sx of [-1, 1]) { const h = new THREE.ConeGeometry(0.13, 0.6, 8); h.rotateZ(sx * -0.9); h.translate(sx * 0.78, 1.85, 0); parts.push(tint(h, "#FFF6E0")); }
      return merge(parts);
    }
    case "chef": {
      const band = new THREE.CylinderGeometry(0.5, 0.52, 0.32, 16); band.translate(0, 1.7, 0);
      const puff = sphere(0.62, 14, 10); puff.scale(1, 0.7, 1); puff.translate(0, 2.12, 0);
      return merge([tint(band, "#FFFFFF"), tint(puff, "#FFFFFF")]);
    }
    case "crown": {
      const c = crown(); c.translate(0, -0.12, 0);
      const col = c.getAttribute("color") as THREE.BufferAttribute;
      for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.9 && col.getY(i) > 0.9) col.setXYZ(i, 1, 0.8, 0.2);
      return c;
    }
    default: return null;
  }
}
