// Kiko's Jungle Quest — Phase 2 models: the trees, plants and props of regions 3–15, more obstacle skins, the guardian
// rides, the 15 bosses, the things that chase Kiko, kites and ziplines. Same rules as models.ts: glossy clay with vertex
// colours, origin on the ground, the track runs along −z (obstacles reach from z = 0 toward −z).
import * as THREE from "three";
import { hatGeo, merge, stormCloud, tint } from "../crowd/models";
import { H, goon } from "./models";

type G = THREE.BufferGeometry;
/** a model made of parts, each drawn with one of the renderer's materials */
export type Mat = "clay" | "gloss" | "leaf" | "canopy" | "glow" | "glass";
export type Parts = { g: G; mat: Mat }[];
const { sphere, at, sq, cyl, cone, rbox, cap, shade, bumpy, taperTube, mix, hash, v3 } = H;
const rnd = (i: number, k: number) => hash(i, k);
const greens = ["#2F8F3E", "#3FAE4A", "#277A36", "#4FBF55"];

// ------------------------------------------------------------------ big trees (x = 0 at the trunk, +x reaches toward the path)
export function treeParts(kind: string, v: number): Parts {
  const t: G[] = [], l: G[] = [], gl: G[] = [];
  switch (kind) {
    case "bamboo": {
      for (let i = 0; i < 7; i++) {
        const a = rnd(i, v) * Math.PI * 2, d = 0.3 + rnd(i, v + 1) * 0.9, h = 8 + rnd(i, v + 2) * 6, x = Math.cos(a) * d, z = Math.sin(a) * d, lean = (rnd(i, v + 3) - 0.3) * 0.12;
        const p = cyl(0.13, 0.16, h, 8); p.translate(0, h / 2, 0); p.rotateZ(-lean); p.translate(x, 0, z);
        t.push(shade(p, (_x, y) => (Math.abs(((y + i) % 1.6) - 0.8) < 0.05 ? "#5E8A2A" : i % 2 ? "#8CC63F" : "#7AB83A")));
        for (let k = 0; k < 5; k++) { const lf = at(sq(sphere(0.5, 8, 6), 1.6, 0.18, 0.5), x + 0.6 + h * lean, h - k * 0.9, z + (k % 2 ? 0.4 : -0.4)); lf.rotateZ(0.2); l.push(tint(lf, greens[(i + k) % 4])); }
      }
      break;
    }
    case "toadstool": {
      const h = 6 + v * 1.6, capC = ["#FF4F5E", "#9B5BE0", "#FF8A3D"][v % 3];
      t.push(shade(at(cyl(0.6, 0.95, h, 16), 0, h / 2, 0), (_x, y) => mix("#F6E7C8", "#E8D2A8", y / h)));
      const c = new THREE.SphereGeometry(3.4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); c.scale(1, 0.55, 1); c.translate(1.2, h, 0);
      l.push(tint(c, capC));
      const gill = cyl(3.3, 3.3, 0.12, 28); gill.translate(1.2, h, 0); l.push(tint(gill, "#F2D8C0"));
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = i === 8 ? 0 : 2.1; l.push(tint(at(sq(sphere(0.38, 10, 8), 1, 0.4, 1), 1.2 + Math.cos(a) * r, h + (i === 8 ? 1.8 : 1.35), Math.sin(a) * r), "#FFFFFF")); }
      break;
    }
    case "pine": {
      const h = 10 + v * 2;
      t.push(tint(at(cyl(0.35, 0.55, h * 0.5, 10), 0, h * 0.25, 0), "#5E3A1E"));
      for (let i = 0; i < 5; i++) {
        const y = h * 0.25 + i * h * 0.15, r = 2.6 - i * 0.45;
        l.push(tint(at(cone(r, h * 0.26, 12), 0.3, y + h * 0.1, 0), i % 2 ? "#1F6A4A" : "#2A7A55"));
        l.push(tint(at(cone(r * 0.75, h * 0.08, 12), 0.3, y + h * 0.2, 0), "#F4FAFF"));
      }
      break;
    }
    case "maple": case "blossom": {
      const h = 7 + v * 1.4;
      t.push(shade(bumpy(at(cyl(0.45, 0.7, h, 12), 0, h / 2, 0), 0.05, v), () => (kind === "blossom" ? "#5A3A2E" : "#6B4226")));
      const br = cyl(0.18, 0.3, 4, 8); br.rotateZ(Math.PI / 2 - 0.4); br.translate(1.6, h - 1, 0); t.push(tint(br, "#6B4226"));
      const cols = kind === "maple" ? ["#FF6A2A", "#FF9A2A", "#E8432A", "#FFC23D"] : ["#FF9FD0", "#FFC2E2", "#FF7AB8", "#FFFFFF"];
      for (let i = 0; i < 8; i++) { const a = rnd(i, v + 5) * Math.PI * 2, d = 1 + rnd(i, v + 6) * 2.2; l.push(tint(bumpy(at(sq(sphere(1.7 + rnd(i, v) * 0.9, 18, 12), 1.2, 0.8, 1.1), Math.cos(a) * d + 1.2, h + rnd(i, v + 7) * 1.6, Math.sin(a) * d), 0.06, i), cols[i % 4])); }
      break;
    }
    case "acacia": {
      const h = 6 + v;
      const tr = taperTube([v3(0, 0, 0), v3(0.3, h * 0.5, 0), v3(1.4, h * 0.85, 0.2), v3(2.0, h, 0)], 0.45, 0.2, 20, 8); t.push(tint(tr, "#7A5232"));
      const tr2 = taperTube([v3(0.3, h * 0.5, 0), v3(-0.6, h * 0.8, 0.3), v3(-1.0, h - 0.2, 0.2)], 0.25, 0.14, 12, 6); t.push(tint(tr2, "#7A5232"));
      l.push(tint(bumpy(at(sq(sphere(3.6, 22, 10), 1.25, 0.24, 1.05), 0.6, h + 0.25, 0), 0.08, v), "#5F8A2A"));
      l.push(tint(bumpy(at(sq(sphere(2.6, 18, 8), 1.2, 0.22, 1), -0.8, h + 0.05, 0.4), 0.08, v + 2), "#6F9A32"));
      break;
    }
    case "baobab": {
      const h = 7 + v;
      t.push(shade(bumpy(at(sq(sphere(1.8, 18, 14), 1, h / 3.2, 1), 0, h / 2, 0), 0.03, v), () => "#A07A5A"));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = taperTube([v3(0, h - 0.2, 0), v3(Math.cos(a) * 1.4, h + 0.9, Math.sin(a) * 1.4), v3(Math.cos(a) * 2.2, h + 1.4, Math.sin(a) * 2.2)], 0.3, 0.1, 10, 6); t.push(tint(b, "#8A6A4A")); l.push(tint(at(sphere(0.8, 10, 8), Math.cos(a) * 2.2, h + 1.5, Math.sin(a) * 2.2), "#5F8A2A")); }
      break;
    }
    case "mangrove": {
      const h = 7 + v;
      t.push(tint(at(cyl(0.4, 0.5, h - 2, 10), 0, 2 + (h - 2) / 2, 0), "#5A4A3A"));
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + v; const r = taperTube([v3(0, 2.4, 0), v3(Math.cos(a) * 1.0, 1.6, Math.sin(a) * 1.0), v3(Math.cos(a) * 1.8, -0.3, Math.sin(a) * 1.8)], 0.16, 0.12, 12, 6); t.push(tint(r, "#6B5A48")); }
      for (let i = 0; i < 7; i++) { const a = rnd(i, v) * Math.PI * 2, d = 0.8 + rnd(i, v + 1) * 1.8; l.push(tint(bumpy(at(sphere(1.6, 16, 12), Math.cos(a) * d + 1, h + rnd(i, v + 2) * 1.2, Math.sin(a) * d), 0.07, i), ["#2F6A4A", "#3A7A55", "#2A5A42"][i % 3])); }
      break;
    }
    case "crystal": {
      for (let i = 0; i < 6; i++) {
        const h = 2 + rnd(i, v) * 6, a = rnd(i, v + 1) * Math.PI * 2, d = rnd(i, v + 2) * 1.4;
        const c = cyl(0.3 + rnd(i, v + 3) * 0.4, 0.45 + rnd(i, v + 3) * 0.4, h, 6); c.translate(0, h / 2, 0); c.rotateZ((rnd(i, v + 4) - 0.5) * 0.6); c.rotateX((rnd(i, v + 5) - 0.5) * 0.4); c.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
        const tip = cone(0.45 + rnd(i, v + 3) * 0.3, 0.9, 6); tip.translate(0, h + 0.45, 0); tip.rotateZ((rnd(i, v + 4) - 0.5) * 0.6); tip.rotateX((rnd(i, v + 5) - 0.5) * 0.4); tip.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
        const col = ["#3DE0FF", "#B58CFF", "#7CFFE0", "#FF8FE0"][(i + v) % 4];
        gl.push(tint(c, col), tint(tip, col));
      }
      t.push(tint(bumpy(at(sq(sphere(1.6, 14, 10), 1.3, 0.4, 1.2), 0, 0.1, 0), 0.1, v), "#3A2E5A"));
      break;
    }
    case "dead": {
      const h = 6 + v * 1.5;
      t.push(shade(at(cyl(0.3, 0.55, h, 9), 0, h / 2, 0), (_x, y) => mix("#2A2220", "#4A3A34", y / h)));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + v; const b = taperTube([v3(0, h * (0.5 + i * 0.1), 0), v3(Math.cos(a) * 1.4, h * (0.65 + i * 0.1), Math.sin(a) * 1.4), v3(Math.cos(a) * 2.4, h * (0.6 + i * 0.12) + 0.8, Math.sin(a) * 2.4)], 0.18, 0.05, 10, 5); t.push(tint(b, "#3A2E2A")); }
      for (let i = 0; i < 6; i++) gl.push(tint(at(sphere(0.12, 6, 4), (rnd(i, v) - 0.5) * 0.8, 0.4 + rnd(i, v + 1) * h * 0.6, 0.35), "#FF7A2A"));
      break;
    }
    case "night": {
      const h = 9 + v * 2;
      t.push(shade(bumpy(at(cyl(0.6, 0.9, h, 12), 0, h / 2, 0), 0.04, v), () => "#3A2E4A"));
      for (let i = 0; i < 8; i++) { const a = rnd(i, v) * Math.PI * 2, d = 1 + rnd(i, v + 1) * 2.6; l.push(tint(bumpy(at(sq(sphere(2, 16, 12), 1.2, 0.75, 1.1), Math.cos(a) * d + 1.6, h + rnd(i, v + 2) * 2, Math.sin(a) * d), 0.06, i), ["#1E3A4A", "#24485A", "#2A3A5E"][i % 3])); }
      for (let i = 0; i < 5; i++) { gl.push(tint(at(cyl(0.015, 0.015, 1.2, 4), 3 + i * 0.5, h - 1.6, (i % 2) - 0.5), "#FFE7A3")); gl.push(tint(at(sphere(0.18, 10, 8), 3 + i * 0.5, h - 2.3, (i % 2) - 0.5), ["#FFD23F", "#FF9A6A", "#9CFF6B"][i % 3])); }
      break;
    }
    default: return [];
  }
  const out: Parts = [];
  if (t.length) out.push({ g: merge(t), mat: "clay" });
  if (l.length) out.push({ g: merge(l), mat: "canopy" });
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}

// ------------------------------------------------------------------ mid plants and near props
export function propParts(kind: string, v = 0): Parts {
  const p: G[] = [], gl: G[] = [], lf: G[] = [];
  switch (kind) {
    case "bambooShoot":
      for (let i = 0; i < 3; i++) { const h = 2 + i * 0.8 + v * 0.4; p.push(shade(at(cyl(0.08, 0.1, h, 8), i * 0.3 - 0.3, h / 2, (i % 2) * 0.25), (_x, y) => (Math.abs((y % 0.9) - 0.45) < 0.04 ? "#5E8A2A" : "#8CC63F"))); lf.push(tint(at(sq(sphere(0.3, 6, 4), 1.6, 0.2, 0.5), i * 0.3, h, 0), "#4FAE48")); }
      break;
    case "lantern":
      p.push(tint(at(rbox(0.6, 0.2, 0.6, 0.05), 0, 0.1, 0), "#8A8A84"), tint(at(cyl(0.12, 0.16, 0.8, 8), 0, 0.6, 0), "#9A9A94"), tint(at(rbox(0.6, 0.12, 0.6, 0.04), 0, 1.06, 0), "#8A8A84"));
      p.push(tint(at(cone(0.55, 0.4, 4), 0, 1.75, 0), "#7A7A74"));
      gl.push(tint(at(rbox(0.36, 0.4, 0.36, 0.04), 0, 1.32, 0), "#FFC86A"));
      break;
    case "shrooms":
      for (let i = 0; i < 4; i++) { const s = 0.5 + rnd(i, v) * 0.7, x = (rnd(i, v + 1) - 0.5) * 0.9, z = (rnd(i, v + 2) - 0.5) * 0.9; p.push(tint(at(cyl(0.07 * s, 0.1 * s, 0.6 * s, 8), x, 0.3 * s, z), "#F6E7C8")); const c = new THREE.SphereGeometry(0.32 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(x, 0.6 * s, z); p.push(tint(c, ["#FF4F5E", "#FF8A3D", "#9B5BE0", "#FFD23F"][(i + v) % 4])); }
      break;
    case "glowShrooms":
      for (let i = 0; i < 4; i++) { const s = 0.5 + rnd(i, v) * 0.8, x = (rnd(i, v + 1) - 0.5), z = (rnd(i, v + 2) - 0.5); p.push(tint(at(cyl(0.06 * s, 0.09 * s, 0.7 * s, 8), x, 0.35 * s, z), "#C8E8FF")); const c = new THREE.SphereGeometry(0.34 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(x, 0.7 * s, z); gl.push(tint(c, ["#3DE0FF", "#7CFFB2", "#B58CFF"][(i + v) % 3])); }
      break;
    case "tulips":
      for (let i = 0; i < 9; i++) { const x = (i % 3) * 0.3 - 0.3, z = Math.floor(i / 3) * 0.3 - 0.3; p.push(tint(at(cyl(0.02, 0.02, 0.5, 4), x, 0.25, z), "#3FAE4A")); p.push(tint(at(sq(sphere(0.09, 8, 6), 1, 1.4, 1), x, 0.55, z), ["#FF4F7E", "#FFD23F", "#FF8FC7", "#B58CFF"][(i + v) % 4])); }
      break;
    case "pumpkin":
      p.push(shade(at(sq(sphere(0.55, 18, 12), 1.25, 0.8, 1.25), 0, 0.45, 0), (x, _y, z) => (Math.sin(Math.atan2(z, x) * 8) > 0.6 ? "#E06A1A" : "#FF8A2A")), tint(at(cyl(0.06, 0.08, 0.25, 6), 0, 0.95, 0), "#5E8A2A"));
      break;
    case "hay":
      p.push(shade(at(cyl(0.6, 0.6, 1.0, 16).rotateZ(Math.PI / 2), 0, 0.6, 0), (x) => (Math.abs(x) > 0.45 ? "#D9B85A" : "#E8C86A")));
      break;
    case "termite":
      p.push(shade(bumpy(at(sq(cone(0.9, 3.2 + v, 10), 1, 1, 0.9), 0, (3.2 + v) / 2, 0), 0.08, v), (_x, y) => mix("#C26A3A", "#E08A4A", y / 3)));
      break;
    case "dryGrass":
      for (let i = 0; i < 9; i++) { const c = cone(0.06, 0.8 + rnd(i, 1) * 0.7, 4); c.translate(0, 0.4, 0); c.rotateZ((rnd(i, 2) - 0.5) * 0.8); c.translate((rnd(i, 3) - 0.5) * 0.7, 0, (rnd(i, 4) - 0.5) * 0.7); p.push(tint(c, i % 2 ? "#E8C86A" : "#D9A84A")); }
      break;
    case "snowBush":
      for (const [x, y, r] of [[0, 0.4, 0.55], [0.4, 0.3, 0.4], [-0.4, 0.32, 0.42]] as const) p.push(tint(at(sphere(r, 14, 10), x, y, 0), "#F4FAFF"));
      p.push(tint(at(sphere(0.3, 8, 6), 0.1, 0.7, 0.3), "#2A7A55"));
      break;
    case "snowman":
      p.push(tint(at(sphere(0.55, 16, 12), 0, 0.5, 0), "#FFFFFF"), tint(at(sphere(0.4, 16, 12), 0, 1.2, 0), "#FFFFFF"), tint(at(sphere(0.28, 14, 10), 0, 1.72, 0), "#FFFFFF"));
      p.push(tint(at(cone(0.06, 0.3, 8).rotateX(Math.PI / 2), 0, 1.72, 0.38), "#FF8A1F"));
      for (const sx of [-1, 1]) p.push(tint(at(sphere(0.04, 6, 4), sx * 0.1, 1.82, 0.24), "#1B1530"));
      p.push(tint(at(cyl(0.3, 0.3, 0.08, 14), 0, 1.47, 0), "#E8344E"));
      break;
    case "iceRock":
      p.push(shade(at(sq(new THREE.IcosahedronGeometry(0.7, 0), 1.2, 1, 1), 0, 0.5, 0), (_x, y) => mix("#9FD8F2", "#E8F8FF", y)));
      break;
    case "lavaRock":
      p.push(tint(bumpy(at(sq(sphere(0.7, 12, 9), 1.3, 0.7, 1.1), 0, 0.35, 0), 0.15, v), "#2A2220"));
      gl.push(tint(at(sq(sphere(0.25, 8, 6), 2.6, 0.12, 0.4), 0.1, 0.55, 0.3), "#FF6A1A"));
      break;
    case "fireFlower":
      for (let i = 0; i < 5; i++) { const x = (rnd(i, v) - 0.5) * 0.8, z = (rnd(i, v + 1) - 0.5) * 0.8; p.push(tint(at(cyl(0.02, 0.02, 0.6, 4), x, 0.3, z), "#3A5A2A")); gl.push(tint(at(sq(sphere(0.12, 8, 6), 1, 0.6, 1), x, 0.62, z), i % 2 ? "#FF5A1F" : "#FFC23D")); }
      break;
    case "crystalSmall":
      for (let i = 0; i < 4; i++) { const h = 0.5 + rnd(i, v) * 1.2; const c = cyl(0.12, 0.18, h, 6); c.translate(0, h / 2, 0); c.rotateZ((rnd(i, v + 1) - 0.5) * 0.8); c.translate((rnd(i, v + 2) - 0.5) * 0.6, 0, (rnd(i, v + 3) - 0.5) * 0.6); gl.push(tint(c, ["#3DE0FF", "#B58CFF", "#7CFFE0"][(i + v) % 3])); }
      break;
    case "glowFlowers":
      for (let i = 0; i < 6; i++) { const x = (rnd(i, v) - 0.5), z = (rnd(i, v + 1) - 0.5); p.push(tint(at(cyl(0.015, 0.015, 0.4, 4), x, 0.2, z), "#2A5A3A")); gl.push(tint(at(sphere(0.07, 8, 6), x, 0.42, z), ["#9CFF6B", "#3DE0FF", "#FFE07A"][i % 3])); }
      break;
    case "stone":
      p.push(shade(bumpy(at(sq(sphere(0.6, 12, 9), 1.3, 0.6, 1), 0, 0.25, 0), 0.12, v), (_x, y) => mix("#6E6A62", "#9A958A", y)));
      break;
    case "puddle":
      p.push(tint(at(sq(new THREE.CircleGeometry(0.9, 18).rotateX(-Math.PI / 2), 1.4, 1, 1), 0, 0.03, 0), "#5A7A9A"));
      break;
    case "leafPile":
      for (let i = 0; i < 14; i++) p.push(tint(at(sq(sphere(0.18, 6, 4), 1.4, 0.35, 1), (rnd(i, v) - 0.5) * 1.2, 0.08 + rnd(i, v + 1) * 0.25, (rnd(i, v + 2) - 0.5) * 1.2), ["#FF6A2A", "#FF9A2A", "#E8432A", "#FFC23D"][i % 4]));
      break;
    default: return [];
  }
  const out: Parts = [];
  if (p.length) out.push({ g: merge(p), mat: "gloss" });
  if (lf.length) out.push({ g: merge(lf), mat: "leaf" });
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}

/** far landmarks: a snowy mountain, a smoking volcano, a mesa (scaled big in the renderer) */
export function farParts(kind: string): Parts {
  switch (kind) {
    case "mountain": {
      const m = cone(1, 1.2, 10); m.translate(0, 0.6, 0);
      return [{ g: shade(m, (_x, y) => (y > 0.82 ? "#F4FAFF" : y > 0.7 ? "#C8D8E8" : mix("#4A5A7A", "#6A7A9A", y))), mat: "clay" }];
    }
    case "volcano": {
      const m = cyl(0.18, 1, 0.9, 14); m.translate(0, 0.45, 0);
      const lava = cyl(0.16, 0.16, 0.02, 12); lava.translate(0, 0.91, 0);
      return [{ g: shade(m, (_x, y) => (y > 0.75 ? "#5A2A1A" : mix("#2A1E1E", "#4A3030", y))), mat: "clay" }, { g: tint(lava, "#FF6A1A"), mat: "glow" }];
    }
    case "mesa": {
      const m = cyl(0.8, 1, 0.6, 9); m.translate(0, 0.3, 0);
      return [{ g: shade(m, (_x, y) => (Math.sin(y * 30) > 0.5 ? "#C26A3A" : "#D98A4A")), mat: "clay" }];
    }
    case "pinesFar": {
      const p: G[] = [];
      for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.3, 1.2, 8), i * 0.5 - 1, 0.6, (i % 2) * 0.3), i % 2 ? "#2A5A4A" : "#3A6A5A"));
      return [{ g: merge(p), mat: "clay" }];
    }
    default: return [];
  }
}

// ------------------------------------------------------------------ obstacle skins (near edge at z = 0, reaching to −z)
/** rock / stump variants beyond models.ts (3 = bamboo bundle, 4 = crystal, 5 = ice block, 6 = termite mound, 7 = obsidian, 8 = giant toadstool, 9 = snowman, 10 = haystack) */
export function rockSkin(v: number): Parts {
  switch (v) {
    case 3: { const p: G[] = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, h = 2.2 + (i % 3) * 0.3; p.push(shade(at(cyl(0.17, 0.19, h, 8), Math.cos(a) * 0.5, h / 2, -1 + Math.sin(a) * 0.5), (_x, y) => (Math.abs((y % 0.8) - 0.4) < 0.04 ? "#5E8A2A" : "#8CC63F"))); } p.push(tint(at(cyl(0.75, 0.75, 0.12, 12), 0, 1.2, -1), "#C23B3B")); return [{ g: merge(p), mat: "gloss" }]; }
    case 4: { const p: G[] = []; for (let i = 0; i < 5; i++) { const h = 1.4 + rnd(i, 4) * 1.1; const c = cyl(0.25, 0.4, h, 6); c.translate(0, h / 2, 0); c.rotateZ((rnd(i, 5) - 0.5) * 0.6); c.translate((rnd(i, 6) - 0.5) * 1.2, 0, -1 + (rnd(i, 7) - 0.5) * 1.2); p.push(tint(c, ["#3DE0FF", "#B58CFF", "#7CFFE0"][i % 3])); } return [{ g: merge(p), mat: "glow" }, { g: tint(at(sq(sphere(0.9, 12, 8), 1.2, 0.35, 1.1), 0, 0.1, -1), "#2A2440"), mat: "gloss" }]; }
    case 5: return [{ g: shade(at(rbox(1.9, 2.1, 1.9, 0.2), 0, 1.05, -1), (_x, y) => mix("#9FD8F2", "#E8F8FF", y / 2)), mat: "glass" }];
    case 6: return [{ g: shade(bumpy(at(sq(cone(1.0, 2.6, 10), 1, 1, 0.9), 0, 1.3, -1), 0.1, 6), (_x, y) => mix("#C26A3A", "#E08A4A", y / 2.6)), mat: "gloss" }];
    case 7: return [{ g: shade(at(sq(new THREE.IcosahedronGeometry(1.1, 0), 1, 1.05, 0.95), 0, 1.05, -1), (_x, y) => mix("#1A1418", "#3A2E3A", y / 2)), mat: "gloss" }];
    case 8: { const c = new THREE.SphereGeometry(1.2, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2); c.scale(1, 0.6, 1); c.translate(0, 1.6, -1); const p = [tint(at(cyl(0.45, 0.6, 1.6, 12), 0, 0.8, -1), "#F6E7C8"), tint(c, "#9B5BE0")]; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(tint(at(sq(sphere(0.18, 8, 6), 1, 0.4, 1), Math.cos(a) * 0.7, 2.18, -1 + Math.sin(a) * 0.7), "#FFFFFF")); } return [{ g: merge(p), mat: "gloss" }]; }
    case 9: { const p = propParts("snowman"); p.forEach((x) => { x.g.scale(1.25, 1.25, 1.25); x.g.translate(0, 0, -1); }); return p; }
    case 10: return [{ g: shade(at(rbox(1.9, 1.9, 1.6, 0.25), 0, 0.95, -1), (_x, y) => (Math.sin(y * 18) > 0.6 ? "#D9B85A" : "#E8C86A")), mat: "gloss" }];
    default: return [];
  }
}
/** log variants (2 = bamboo bundle, 3 = snowy log, 4 = pumpkin row, 5 = basalt with glowing cracks, 6 = crystal bar) */
export function logSkin(v: number): Parts {
  switch (v) {
    case 2: { const p: G[] = []; for (let i = 0; i < 4; i++) { const c = cyl(0.17, 0.17, 2.0, 8); c.rotateZ(Math.PI / 2); c.translate(0, 0.2 + (i % 2) * 0.3 + Math.floor(i / 2) * 0.32, -0.35 + (i % 2 ? 0.12 : -0.12)); p.push(shade(c, (x) => (Math.abs((x + 1) % 0.7 - 0.35) < 0.03 ? "#5E8A2A" : "#8CC63F"))); } p.push(tint(at(cyl(0.2, 0.2, 0.75, 10).rotateX(Math.PI / 2), 0.7, 0.4, -0.35), "#C23B3B")); return [{ g: merge(p), mat: "gloss" }]; }
    case 3: { const lg = cyl(0.42, 0.42, 1.95, 14); lg.rotateZ(Math.PI / 2); lg.translate(0, 0.45, -0.35); return [{ g: merge([tint(lg, "#5E3A1E"), tint(at(sq(sphere(0.5, 12, 8), 2.0, 0.35, 0.9), 0, 0.82, -0.35), "#F4FAFF")]), mat: "gloss" }]; }
    case 4: { const p: G[] = []; for (const x of [-0.6, 0, 0.6]) { p.push(shade(at(sq(sphere(0.42, 16, 10), 1.1, 0.85, 1.1), x, 0.36, -0.35), (xx, _y, z) => (Math.sin(Math.atan2(z + 0.35, xx - x) * 8) > 0.6 ? "#E06A1A" : "#FF8A2A"))); p.push(tint(at(cyl(0.04, 0.06, 0.2, 6), x, 0.78, -0.35), "#5E8A2A")); } return [{ g: merge(p), mat: "gloss" }]; }
    case 5: { const lg = cyl(0.42, 0.42, 1.95, 7); lg.rotateZ(Math.PI / 2); lg.translate(0, 0.45, -0.35); const crack = rbox(1.8, 0.06, 0.1, 0.02); crack.translate(0, 0.86, -0.3); return [{ g: tint(lg, "#2A2220"), mat: "gloss" }, { g: tint(crack, "#FF6A1A"), mat: "glow" }]; }
    case 6: { const c = cyl(0.3, 0.3, 1.95, 6); c.rotateZ(Math.PI / 2); c.translate(0, 0.5, -0.35); return [{ g: tint(c, "#7CFFE0"), mat: "glow" }]; }
    default: return [];
  }
}
/** low (slide-under) variants (3 = bamboo bar, 4 = icicles, 5 = moss curtain, 6 = lantern string) */
export function lowSkin(v: number): Parts {
  const p: G[] = [], gl: G[] = [];
  const posts = (c: string) => { for (const sx of [-1.25, 1.25]) p.push(tint(at(cyl(0.12, 0.18, 1.4, 8), sx, 0.7, -0.3), c)); };
  switch (v) {
    case 3: { posts("#6B8A2A"); const b = cyl(0.17, 0.17, 2.6, 8); b.rotateZ(Math.PI / 2); b.translate(0, 1.2, -0.3); p.push(shade(b, (x) => (Math.abs((x + 1.3) % 0.8 - 0.4) < 0.04 ? "#5E8A2A" : "#8CC63F"))); for (let i = 0; i < 6; i++) p.push(tint(at(sq(sphere(0.16, 6, 4), 0.5, 1.2, 0.25), -1 + i * 0.4, 1.0, -0.3), "#4FAE48")); break; }
    case 4: { posts("#9FB8D8"); const b = rbox(2.6, 0.25, 0.4, 0.1); b.translate(0, 1.3, -0.3); p.push(tint(b, "#E8F8FF")); for (let i = 0; i < 9; i++) { const c = cone(0.08, 0.3 + rnd(i, 4) * 0.25, 6); c.rotateX(Math.PI); c.translate(-1.1 + i * 0.27, 1.05, -0.3); p.push(tint(c, "#BFE8FF")); } break; }
    case 5: { posts("#5A4A3A"); const b = cyl(0.15, 0.15, 2.6, 8); b.rotateZ(Math.PI / 2); b.translate(0, 1.3, -0.3); p.push(tint(b, "#5A4A3A")); for (let i = 0; i < 12; i++) { const s = cyl(0.05, 0.02, 0.45, 4); s.translate(-1.15 + i * 0.21, 1.05, -0.3); p.push(tint(s, i % 2 ? "#7A9A5A" : "#5F7A4A")); } break; }
    case 6: { posts("#6B4226"); const b = cyl(0.02, 0.02, 2.6, 4); b.rotateZ(Math.PI / 2); b.translate(0, 1.25, -0.3); p.push(tint(b, "#3A2A1A")); for (let i = 0; i < 5; i++) gl.push(tint(at(sq(sphere(0.16, 10, 8), 1, 1.3, 1), -0.9 + i * 0.45, 1.05, -0.3), ["#FF6A4A", "#FFD23F", "#FF8FC7"][i % 3])); break; }
    default: return [];
  }
  const out: Parts = [{ g: merge(p), mat: "gloss" }];
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}
/** roller variants (origin at the centre; 2 = acorn, 3 = snowball, 4 = boulder, 5 = crystal ball, 6 = lava ball) */
export function rollerSkin(v: number): Parts {
  switch (v) {
    case 2: return [{ g: merge([tint(at(sq(sphere(0.5, 18, 14), 1, 1.15, 1), 0, -0.05, 0), "#B5652B"), tint(at(sq(sphere(0.52, 16, 10), 1, 0.55, 1), 0, 0.3, 0), "#7A4A26"), tint(at(cyl(0.05, 0.06, 0.2, 6), 0, 0.6, 0), "#5A361E")]), mat: "gloss" }];
    case 3: return [{ g: shade(sphere(0.6, 20, 14), (_x, y) => mix("#DDEBFA", "#FFFFFF", y + 0.5)), mat: "clay" }];
    case 4: return [{ g: shade(bumpy(sphere(0.58, 16, 12), 0.1, 4), (_x, y) => mix("#6E6A62", "#A39D90", y + 0.5)), mat: "gloss" }];
    case 5: return [{ g: tint(new THREE.IcosahedronGeometry(0.58, 1), "#B58CFF"), mat: "glow" }];
    case 6: return [{ g: tint(bumpy(sphere(0.56, 14, 10), 0.12, 6), "#3A2220"), mat: "gloss" }, { g: tint(sq(sphere(0.6, 10, 8), 1.02, 0.25, 1.02), "#FF6A1A"), mat: "glow" }];
    default: return [];
  }
}
/** things that drop from above (origin at the centre; 1 = stalactite, 2 = icicle, 3 = acorn, 4 = ember rock, 5 = pinecone, 6 = hailstone) */
export function dropSkin(v: number): Parts {
  switch (v) {
    case 1: { const c = cone(0.3, 1.0, 7); c.rotateX(Math.PI); return [{ g: shade(c, (_x, y) => mix("#8A7A9A", "#B8A8C8", y + 0.5)), mat: "gloss" }]; }
    case 2: { const c = cone(0.22, 1.0, 7); c.rotateX(Math.PI); return [{ g: tint(c, "#CFF0FF"), mat: "glass" }]; }
    case 3: return rollerSkin(2).map((x) => { x.g.scale(0.65, 0.65, 0.65); return x; });
    case 4: return [{ g: tint(bumpy(sphere(0.32, 12, 9), 0.15, 2), "#2A2220"), mat: "gloss" }, { g: tint(sphere(0.2, 8, 6), "#FF6A1A"), mat: "glow" }];
    case 5: { const p: G[] = []; for (let i = 0; i < 6; i++) p.push(tint(at(sq(cone(0.24 - i * 0.03, 0.18, 8), 1, 1, 1), 0, -0.2 + i * 0.1, 0), i % 2 ? "#8A5A2B" : "#6B4226")); return [{ g: merge(p), mat: "gloss" }]; }
    case 6: return [{ g: tint(new THREE.IcosahedronGeometry(0.3, 1), "#E8F8FF"), mat: "glass" }];
    default: return [];
  }
}
/** a sticky spider web across the lane (slide under), with its spider */
export function webParts(): Parts {
  const p: G[] = [];
  for (const sx of [-1.15, 1.15]) p.push(tint(at(cyl(0.1, 0.13, 2.4, 8), sx, 1.2, -0.25), "#3A2E2A"));
  const cx = 0, cy = 1.5;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const s = cyl(0.012, 0.012, 1.15, 3); s.rotateZ(Math.PI / 2); s.translate(0.575, 0, 0); s.rotateZ(a); s.translate(cx, cy, -0.25); p.push(tint(s, "#F4F4FF")); }
  for (const r of [0.3, 0.55, 0.8, 1.05]) { const ring = new THREE.TorusGeometry(r, 0.01, 3, 24); ring.translate(cx, cy, -0.25); p.push(tint(ring, "#F4F4FF")); }
  p.push(tint(at(sphere(0.12, 10, 8), 0.3, 1.95, -0.22), "#1B1530"), tint(at(sphere(0.08, 8, 6), 0.3, 2.1, -0.22), "#1B1530"));
  for (const sx of [-1, 1]) p.push(tint(at(sphere(0.025, 6, 4), 0.3 + sx * 0.035, 2.12, -0.15), "#FFFFFF"));
  return [{ g: merge(p), mat: "gloss" }];
}
/** a geyser / lightning puddle: vent, the glowing core (scaled when it is about to spurt) and the jet */
export function geyserParts(v: number): { base: G; core: G; jet: G } {
  const vent = v === 1
    ? merge([tint(at(sq(new THREE.CircleGeometry(0.95, 18).rotateX(-Math.PI / 2), 1, 1, 1.1), 0, 0.03, -0.8), "#3A5A8A"), ...[0, 1, 2, 3, 4, 5].map((i) => tint(at(sphere(0.15, 6, 4), Math.cos(i) * 0.9, 0.05, -0.8 + Math.sin(i) * 0.9), "#5A6A7A"))])
    : merge([shade(at(cyl(0.85, 1.0, 0.35, 12), 0, 0.17, -0.8), () => "#3A2E2E"), tint(at(cyl(0.55, 0.55, 0.36, 12), 0, 0.18, -0.8), "#1A1414")]);
  const core = tint(at(cyl(0.45, 0.45, 0.06, 12), 0, 0.38, -0.8), v === 1 ? "#7AE8FF" : "#FF7A1A");
  const jet = cyl(0.35, 0.6, 3.6, 10, ); jet.translate(0, 2.1, -0.8);
  return { base: vent, core, jet: tint(jet, v === 1 ? "#BFF4FF" : "#FFB040") };
}
/** a wind gust: white swirls (transparent) */
export function gustParts(): G {
  const p: G[] = [];
  for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(0.35 + i * 0.15, 0.03, 4, 20, Math.PI * 1.3); t.rotateY(Math.PI / 2); t.translate(0, 0.8 + i * 0.5, -0.6); p.push(tint(t, "#FFFFFF")); }
  return merge(p);
}
/** a zipline: a post (with a little platform), the cable (unit length along −z) and the handle */
export function zipParts(): { post: G; cable: G; handle: G } {
  // a wooden gate over the lane: two legs on the lane edges and a beam the cable hangs from, so Kiko runs through it
  const post = merge([
    ...[-1, 1].map((sx) => tint(at(cyl(0.13, 0.17, 5.4, 8), sx * 1.12, 2.7, 0), "#6B4226")),
    tint(at(cyl(0.11, 0.11, 2.6, 8).rotateZ(Math.PI / 2), 0, 5.12, 0), "#7A4B2A"),
    ...[-1, 1].map((sx) => tint(at(cyl(0.05, 0.05, 1.0, 6).rotateZ(sx * 0.8), sx * 0.85, 4.75, 0), "#6B4226")),
    tint(at(sq(sphere(0.16, 10, 8), 1, 0.7, 1), 0, 5.0, 0), "#FFD23F"),
  ]);
  const cable = cyl(0.025, 0.025, 1, 4); cable.rotateX(Math.PI / 2); cable.translate(0, 0, -0.5);
  const handle = merge([tint(at(cyl(0.025, 0.025, 0.9, 4), 0, -0.45, 0), "#2A2A2A"), tint(at(cyl(0.05, 0.05, 0.6, 8).rotateZ(Math.PI / 2), 0, -0.9, 0), "#FF3D5E"), tint(at(sq(cyl(0.12, 0.12, 0.08, 10), 1, 1, 1), 0, 0.02, 0), "#9A9A9A")]);
  return { post, cable: tint(cable, "#3A3A3A"), handle };
}
/** a kite Kiko holds on a glide */
export function kiteGeo(): G {
  const s = new THREE.Shape(); s.moveTo(0, 0.9); s.lineTo(0.6, 0); s.lineTo(0, -1.0); s.lineTo(-0.6, 0); s.closePath();
  const k = new THREE.ShapeGeometry(s); k.rotateX(-0.9);
  const p: G[] = [shade(k, (x, y) => (x * y > 0 ? "#FF4F7E" : "#FFD23F"))];
  for (let i = 0; i < 4; i++) p.push(tint(at(sq(sphere(0.08, 6, 4), 1.4, 0.4, 1), 0, -0.9 - i * 0.28, 0.6 + i * 0.25), ["#3DC8FF", "#7CFF6B", "#FF8FC7", "#FFD23F"][i]));
  return merge(p);
}

// ------------------------------------------------------------------ rides (face −z like Kiko; seat height in RIDE_SEAT)
export const RIDE_SEAT: Record<string, number> = { turtle: 0.62, panda: 0.78, frog: 0.72, boat: 0.4, squirrel: 0.85, elephant: 2.15, pelican: 0.75, sled: 0.4, dino: 1.35 };
export function rideParts(id: string): Parts {
  const p: G[] = [], gl: G[] = [];
  const eyes = (x: number, y: number, z: number, r = 0.09) => { for (const sx of [-1, 1]) { p.push(tint(at(sphere(r, 10, 8), sx * x, y, z), "#FFFFFF")); p.push(tint(at(sphere(r * 0.55, 8, 6), sx * x, y, z - r * 0.7), "#1B1530")); } };
  switch (id) {
    case "turtle": {
      const shell = new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1, 0.62, 1.15); shell.translate(0, 0.12, 0);
      p.push(shade(shell, (x, _y, z) => (Math.sin(x * 7) * Math.sin(z * 7) > 0.3 ? "#3E8E3A" : "#6BC44A")));
      p.push(tint(at(sq(sphere(0.86, 18, 8), 1, 0.12, 1.15), 0, 0.12, 0), "#E8D27A"));
      p.push(tint(at(sq(sphere(0.3, 14, 10), 1, 0.9, 1.2), 0, 0.3, -1.05), "#8AD35A")); eyes(0.13, 0.42, -1.25, 0.07);
      for (const [x, z] of [[0.8, -0.6], [-0.8, -0.6], [0.7, 0.7], [-0.7, 0.7]] as const) p.push(tint(at(sq(sphere(0.22, 10, 8), 1.4, 0.4, 0.9), x, 0.08, z), "#8AD35A"));
      break;
    }
    case "panda": {
      p.push(tint(at(sq(sphere(0.5, 18, 14), 0.9, 0.8, 1.3), 0, 0.55, 0), "#D9532A"));
      p.push(tint(at(sphere(0.38, 16, 12), 0, 0.85, -0.65), "#D9532A"));
      p.push(tint(at(sq(sphere(0.22, 12, 10), 1.2, 0.8, 0.6), 0, 0.78, -0.95), "#FFFFFF")); eyes(0.13, 0.95, -0.95, 0.06);
      for (const sx of [-1, 1]) p.push(tint(at(cone(0.14, 0.22, 8), sx * 0.24, 1.2, -0.62), "#D9532A"));
      for (const [x, z] of [[0.3, -0.4], [-0.3, -0.4], [0.3, 0.45], [-0.3, 0.45]] as const) p.push(tint(at(cyl(0.11, 0.12, 0.4, 8), x, 0.2, z), "#3A2010"));
      p.push(shade(taperTube([v3(0, 0.6, 0.6), v3(0, 0.9, 1.1), v3(0, 1.4, 1.2)], 0.17, 0.12, 16, 8), (_x, y) => (Math.sin(y * 18) > 0 ? "#D9532A" : "#F2C29A")));
      break;
    }
    case "frog": {
      p.push(tint(at(sq(sphere(0.6, 18, 14), 1.1, 0.7, 1.1), 0, 0.42, 0), "#3FC45A"));
      p.push(tint(at(sq(sphere(0.48, 14, 10), 1, 0.4, 1), 0, 0.3, -0.25), "#C8F07A"));
      for (const sx of [-1, 1]) { p.push(tint(at(sphere(0.2, 12, 10), sx * 0.3, 0.75, -0.45), "#3FC45A")); p.push(tint(at(sphere(0.13, 10, 8), sx * 0.3, 0.8, -0.58), "#FFFFFF")); p.push(tint(at(sphere(0.07, 8, 6), sx * 0.3, 0.8, -0.68), "#1B1530")); }
      for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.25, 10, 8), 1, 0.5, 1.6), sx * 0.55, 0.15, 0.3), "#2FA84A"));
      break;
    }
    case "boat": {
      const hull = new THREE.SphereGeometry(0.9, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); hull.scale(0.8, 0.5, 1.6); hull.translate(0, 0.35, 0);
      p.push(tint(hull, "#7A4A26"));
      p.push(tint(at(sq(cyl(0.7, 0.7, 0.06, 18), 0.8, 1, 1.55), 0, 0.33, 0), "#B9774A"));
      for (let i = 0; i < 4; i++) gl.push(tint(at(sq(sphere(0.14, 10, 8), 1, 1, 1.6), (i % 2 ? 1 : -1) * 0.5, 0.55, -1 + i * 0.6), "#9CFF6B"));
      break;
    }
    case "squirrel": {
      p.push(tint(at(sq(sphere(0.55, 18, 14), 0.9, 0.85, 1.25), 0, 0.6, 0), "#B5652B"));
      p.push(tint(at(sphere(0.38, 16, 12), 0, 0.95, -0.7), "#B5652B")); p.push(tint(at(sq(sphere(0.2, 10, 8), 1.2, 0.8, 0.6), 0, 0.88, -1.0), "#F2D2A8")); eyes(0.14, 1.05, -0.98, 0.06);
      for (const sx of [-1, 1]) p.push(tint(at(cone(0.1, 0.25, 8), sx * 0.2, 1.32, -0.72), "#B5652B"));
      p.push(tint(taperTube([v3(0, 0.6, 0.6), v3(0, 1.3, 1.0), v3(0, 1.9, 0.7), v3(0, 2.0, 0.3)], 0.35, 0.22, 20, 10), "#C8783A"));
      p.push(tint(at(rbox(1.0, 0.1, 1.9, 0.05), 0, 0.08, 0), "#8A5A2B"));
      break;
    }
    case "elephant": {
      p.push(tint(at(sq(sphere(1.1, 22, 16), 1, 0.85, 1.35), 0, 1.75, 0), "#9AA0AE"));
      p.push(tint(at(sphere(0.75, 18, 14), 0, 2.15, -1.35), "#9AA0AE"));
      for (const sx of [-1, 1]) { p.push(tint(at(sq(sphere(0.6, 14, 10), 0.25, 1, 0.9), sx * 0.75, 2.1, -1.15), "#A8AEBC")); p.push(tint(at(sq(sphere(0.48, 12, 8), 0.2, 0.85, 0.75), sx * 0.8, 2.1, -1.2), "#E8A8B8")); }
      eyes(0.3, 2.35, -1.95, 0.09);
      p.push(tint(taperTube([v3(0, 1.95, -1.95), v3(0, 1.3, -2.25), v3(0, 0.75, -2.15), v3(0, 0.6, -1.95)], 0.24, 0.12, 20, 10), "#9AA0AE"));
      for (const sx of [-1, 1]) p.push(tint(taperTube([v3(sx * 0.32, 1.75, -1.9), v3(sx * 0.4, 1.45, -2.2), v3(sx * 0.3, 1.5, -2.45)], 0.07, 0.03, 10, 6), "#FFF8E8"));
      for (const [x, z] of [[0.6, -0.8], [-0.6, -0.8], [0.6, 0.8], [-0.6, 0.8]] as const) p.push(tint(at(cyl(0.3, 0.33, 1.2, 12), x, 0.6, z), "#8A909E"));
      p.push(tint(at(sq(sphere(0.6, 14, 10), 1.1, 0.25, 1.1), 0, 2.62, 0.05), "#E8344E"));
      break;
    }
    case "pelican": {
      p.push(tint(at(sq(sphere(0.55, 18, 14), 0.9, 0.75, 1.4), 0, 0.5, 0), "#FFFFFF"));
      p.push(tint(at(sphere(0.3, 14, 12), 0, 0.95, -0.75), "#FFFFFF")); eyes(0.16, 1.02, -0.92, 0.05);
      p.push(tint(at(sq(sphere(0.18, 12, 8), 0.7, 0.55, 2.6), 0, 0.82, -1.25), "#FFB03D"));
      p.push(tint(at(sq(sphere(0.2, 12, 8), 0.8, 0.8, 1.6), 0, 0.68, -1.1), "#FFC86A"));
      for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.5, 14, 8), 2.2, 0.15, 0.8), sx * 1.0, 0.65, 0.05), "#EDEDF5"));
      break;
    }
    case "sled": {
      p.push(tint(at(rbox(1.0, 0.1, 1.9, 0.05), 0, 0.32, 0), "#B9774A"));
      for (const sx of [-0.42, 0.42]) { p.push(tint(at(cyl(0.05, 0.05, 1.9, 6).rotateX(Math.PI / 2), sx, 0.08, 0), "#E8344E")); p.push(tint(at(new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI).rotateY(Math.PI / 2), sx, 0.28, -0.95), "#E8344E")); for (const z of [-0.6, 0.6]) p.push(tint(at(cyl(0.04, 0.04, 0.26, 6), sx, 0.2, z), "#E8344E")); }
      break;
    }
    case "dino": {
      p.push(tint(at(sq(sphere(0.8, 20, 16), 0.85, 0.75, 1.4), 0, 1.0, 0.1), "#7CD35A"));
      p.push(tint(taperTube([v3(0, 1.3, -0.8), v3(0, 2.0, -1.2), v3(0, 2.4, -1.4)], 0.3, 0.25, 16, 10), "#7CD35A"));
      p.push(tint(at(sq(sphere(0.38, 14, 12), 1, 0.85, 1.25), 0, 2.5, -1.6), "#7CD35A")); eyes(0.16, 2.62, -1.85, 0.07);
      p.push(tint(taperTube([v3(0, 1.0, 1.0), v3(0, 0.8, 1.7), v3(0, 0.5, 2.3)], 0.35, 0.08, 16, 8), "#7CD35A"));
      for (let i = 0; i < 6; i++) p.push(tint(at(cone(0.13, 0.32, 6), 0, 1.6 - i * 0.05 + (i < 3 ? 0.4 - i * 0.12 : 0), 0.6 - i * 0.35), "#FF4FA8"));
      for (const [x, z] of [[0.45, -0.4], [-0.45, -0.4], [0.45, 0.6], [-0.45, 0.6]] as const) p.push(tint(at(cyl(0.2, 0.24, 0.7, 10), x, 0.35, z), "#5FB84A"));
      break;
    }
    default: break;
  }
  const out: Parts = [];
  if (p.length) out.push({ g: merge(p), mat: "gloss" });
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}

// ------------------------------------------------------------------ bosses (face +z toward Kiko and the camera, ~2.5 m tall)
export function bossParts(id: string): Parts {
  const p: G[] = [], gl: G[] = [];
  const face = (y: number, z: number, s = 1, eyeC = "#FFFFFF") => {
    for (const sx of [-1, 1]) {
      p.push(tint(at(sq(sphere(0.16 * s, 12, 10), 1, 0.85, 0.6), sx * 0.22 * s, y, z), eyeC));
      p.push(tint(at(sphere(0.07 * s, 8, 6), sx * 0.2 * s, y - 0.02, z + 0.08 * s), "#1B1530"));
      const br = rbox(0.26 * s, 0.06 * s, 0.06, 0.02); br.rotateZ(sx * -0.45); br.translate(sx * 0.22 * s, y + 0.16 * s, z + 0.04); p.push(tint(br, "#1B1530"));
    }
    const m = new THREE.TorusGeometry(0.13 * s, 0.025 * s, 6, 14, Math.PI); m.translate(0, y - 0.32 * s, z + 0.02); p.push(tint(m, "#1B1530"));
  };
  const hat = (kind: string, y: number, s: number) => { const h = hatGeo(kind); if (h) { h.scale(s, s, s); h.translate(0, y, 0); p.push(h.index ? h.toNonIndexed() : h); } };
  switch (id) {
    case "crocking": {
      p.push(tint(at(sq(sphere(0.75, 18, 14), 0.9, 1.3, 0.8), 0, 1.15, 0), "#3E8E3A"), tint(at(sq(sphere(0.55, 14, 10), 0.8, 1.1, 0.5), 0, 1.05, 0.35), "#C9E07A"));
      p.push(tint(at(sq(sphere(0.4, 14, 10), 1, 0.7, 1.8), 0, 2.15, 0.45), "#3E8E3A")); for (let i = 0; i < 6; i++) p.push(tint(at(cone(0.04, 0.1, 4), -0.2 + i * 0.08, 2.0, 1.05), "#FFFFFF"));
      face(2.35, 0.2, 0.9); hat("crown", 1.05, 0.55);
      for (const sx of [-1, 1]) p.push(tint(at(cap(0.13, 0.4, 8), sx * 0.6, 0.35, 0), "#3E8E3A"));
      break;
    }
    case "storm": { const c = stormCloud(); c.scale(1.4, 1.4, 1.4); c.translate(0, 1.6, 0); p.push(c.index ? c.toNonIndexed() : c); for (let i = 0; i < 3; i++) gl.push(tint(at(sq(cone(0.12, 0.6, 4), 1, 1, 0.3), -0.5 + i * 0.5, 0.6, 0), "#FFE14D")); break; }
    case "woodpecker": case "queenbee": case "nightgrump": case "bandit": case "warden": case "puffcap": case "golem": case "scarecrow": case "rhino": case "witch": case "yeti": case "gatekeeper": case "baron":
    default: {
      const col: Record<string, [string, string]> = {
        gatekeeper: ["#3E6B2E", "#8A5A2B"], bandit: ["#D9532A", "#2A2A2A"], warden: ["#3DA8FF", "#E8F8FF"], puffcap: ["#F6E7C8", "#FF4F5E"], woodpecker: ["#E8344E", "#1B1530"],
        nightgrump: ["#3A2A6E", "#FFD23F"], queenbee: ["#FFC21A", "#2A2010"], golem: ["#6A5A8A", "#3DE0FF"], scarecrow: ["#C8A050", "#7A3A2A"], rhino: ["#8A8E9A", "#C8C8D0"],
        witch: ["#4F8A3A", "#5A3DC2"], yeti: ["#F4F8FF", "#7A9ACF"], baron: ["#2A3A1E", "#C23B3B"],
      };
      const [c1, c2] = col[id] ?? col.gatekeeper;
      const big = id === "baron" ? 1.35 : id === "yeti" || id === "golem" || id === "rhino" ? 1.2 : 1;
      if (id === "golem") { for (let i = 0; i < 5; i++) p.push(tint(at(new THREE.IcosahedronGeometry(0.5 - i * 0.04, 0), (i % 2 ? 0.2 : -0.2), 0.6 + i * 0.42, 0), c1)); for (let i = 0; i < 6; i++) { const c = cyl(0.1, 0.16, 0.6, 6); c.rotateZ((i - 2.5) * 0.4); c.translate((i - 2.5) * 0.22, 2.55, -0.1); gl.push(tint(c, c2)); } face(1.9, 0.42, 1, "#3DE0FF"); break; }
      if (id === "scarecrow") {
        p.push(tint(at(cyl(0.07, 0.07, 2.6, 6), 0, 1.3, -0.2), "#7A5A3A"), tint(at(cyl(0.06, 0.06, 1.8, 6).rotateZ(Math.PI / 2), 0, 1.6, -0.2), "#7A5A3A"));
        p.push(shade(at(rbox(0.9, 0.9, 0.5, 0.12), 0, 1.4, 0), (x, y) => (Math.abs((x * 6) % 1) < 0.15 || Math.abs((y * 6) % 1) < 0.15 ? "#3A2A6A" : c2)));
        p.push(tint(at(sphere(0.42, 16, 12), 0, 2.2, 0), "#D9C28A")); face(2.25, 0.32, 0.9); hat("cowboy", 1.0, 0.5);
        break;
      }
      p.push(tint(bumpy(at(sq(sphere(0.75 * big, 22, 16), 1, 1.05, 0.9), 0, 1.05 * big, 0), 0.05, 3), c1));
      if (id === "gatekeeper" || id === "baron") for (let i = 0; i < 18; i++) {
        const u = rnd(i, 1) * 2 - 1, a = rnd(i, 2) * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const n = v3(Math.cos(a) * r, u, Math.sin(a) * r); if (n.z > 0.5 && Math.abs(n.y) < 0.5) continue;
        const c = cone(0.07, 0.3, 6); c.translate(0, 0.15, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), n)); c.translate(n.x * 0.72 * big, 1.05 * big + n.y * 0.75 * big, n.z * 0.68 * big); p.push(tint(c, c2));
      }
      if (id === "queenbee") { p.push(shade(at(sq(sphere(0.7, 18, 12), 0.9, 0.95, 1.3), 0, 1.0, -0.5), (_x, _y, z) => (Math.sin(z * 10) > 0 ? c1 : c2))); for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.5, 12, 8), 1.4, 0.1, 0.7), sx * 0.7, 1.7, -0.3), "#E8F8FF")); hat("crown", 0.6, 0.5); }
      if (id === "woodpecker") { p.push(tint(at(sq(cone(0.18, 0.7, 10).rotateX(Math.PI / 2), 1, 1, 1), 0, 1.3, 0.95), "#FFC23D")); for (let i = 0; i < 4; i++) p.push(tint(at(cone(0.1, 0.4, 6), 0, 1.95 + i * 0.05, -0.2 - i * 0.15), "#FF3D3D")); hat("crown", 0.75, 0.5); }
      if (id === "nightgrump") { for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.6, 12, 8), 1.4, 0.8, 0.12), sx * 1.0, 1.4, -0.2), "#2A1A4A")); }
      if (id === "bandit") { p.push(tint(at(sq(rbox(0.9, 0.2, 0.2, 0.06), 1, 1, 1), 0, 1.25, 0.6), "#1B1530")); p.push(tint(at(cone(0.95, 0.45, 18), 0, 1.95, 0), "#E8C86A")); }
      if (id === "warden") { for (let i = 0; i < 5; i++) gl.push(tint(at(sphere(0.08, 6, 4), (rnd(i, 3) - 0.5) * 1.2, 0.6 + rnd(i, 4) * 1.2, 0.6), "#E8F8FF")); hat("propeller", 0.55, 0.5); }
      if (id === "puffcap") { const c = new THREE.SphereGeometry(1.0, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2); c.scale(1.2, 0.6, 1.2); c.translate(0, 1.75, 0); p.push(tint(c, c2)); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(tint(at(sq(sphere(0.15, 8, 6), 1, 0.4, 1), Math.cos(a) * 0.7, 2.2, Math.sin(a) * 0.7), "#FFFFFF")); } p.push(tint(at(new THREE.TorusGeometry(0.12, 0.02, 6, 16), 0.22, 1.2, 0.68), "#FFC23D")); }
      if (id === "rhino") { p.push(tint(at(cone(0.16, 0.6, 10).rotateX(-0.6), 0, 1.25, 0.85), "#F2E8D8")); for (const sx of [-1, 1]) p.push(tint(at(cone(0.1, 0.3, 8), sx * 0.4, 1.9, 0.2), c1)); }
      if (id === "witch") hat("wizard", 0.6, 0.6);
      if (id === "yeti") { for (const sx of [-1, 1]) p.push(tint(at(cone(0.12, 0.4, 8).rotateZ(sx * -0.5), sx * 0.6, 2.25, 0), "#DDE6F2")); p.push(tint(at(sq(sphere(0.45, 14, 10), 1, 0.8, 0.4), 0, 1.25, 0.6), c2)); }
      if (id === "gatekeeper") hat("cowboy", 0.6, 0.55);
      if (id === "baron") { hat("pirate", 1.0, 0.6); p.push(tint(at(new THREE.TorusGeometry(0.13, 0.025, 6, 16), 0.3, 1.6, 0.9), "#FFC23D")); }
      face(id === "queenbee" ? 1.25 : 1.3 * big, 0.62 * big, big, id === "nightgrump" ? "#FFE14D" : "#FFFFFF");
      for (const sx of [-1, 1]) p.push(tint(at(cap(0.12 * big, 0.3, 8), sx * 0.35 * big, 0.25, 0), c1));
    }
  }
  if (id === "gatekeeper") { const key = merge([tint(at(new THREE.TorusGeometry(0.18, 0.05, 6, 14), 0.9, 1.5, 0.3), "#FFC23D"), tint(at(cyl(0.04, 0.04, 0.7, 6), 0.9, 1.05, 0.3), "#FFC23D")]); p.push(key); }
  const out: Parts = [{ g: merge(p), mat: "gloss" }];
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}
/** the goon for the region chase (kept for the grove) */
export { goon };

// ------------------------------------------------------------------ things that chase Kiko
export function chaserParts(what: string): Parts {
  switch (what) {
    case "avalanche": return [{ g: shade(bumpy(sphere(2.6, 24, 18), 0.06, 3), (_x, y) => mix("#DDEBFA", "#FFFFFF", y / 5 + 0.5)), mat: "clay" }];
    case "boulder": return [{ g: tint(bumpy(sphere(2.4, 20, 16), 0.1, 5), "#3A2E2A"), mat: "gloss" }, { g: tint(sq(sphere(2.45, 16, 10), 1, 0.15, 1), "#FF6A1A"), mat: "glow" }];
    case "bees": { const p: G[] = []; for (let i = 0; i < 9; i++) { const x = (rnd(i, 1) - 0.5) * 4.4, y = 0.45 + rnd(i, 2) * 1.3, z = (rnd(i, 3) - 0.5) * 2; p.push(shade(at(sq(sphere(0.22, 10, 8), 0.9, 0.9, 1.3), x, y, z), (_x, _y, zz) => (Math.sin((zz - z) * 30) > 0 ? "#FFC21A" : "#2A2010"))); for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.15, 8, 6), 1.4, 0.15, 0.7), x + sx * 0.2, y + 0.18, z), "#E8F8FF")); } return [{ g: merge(p), mat: "gloss" }]; }
    case "bats": { const p: G[] = []; for (let i = 0; i < 8; i++) { const x = (rnd(i, 1) - 0.5) * 4.6, y = 0.6 + rnd(i, 2) * 1.5, z = (rnd(i, 3) - 0.5) * 2; p.push(tint(at(sphere(0.2, 10, 8), x, y, z), "#3A2A4A")); for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.3, 8, 6), 1.6, 0.12, 0.7), x + sx * 0.35, y + 0.05, z), "#2A1A3A")); for (const sx of [-1, 1]) p.push(tint(at(sphere(0.04, 6, 4), x + sx * 0.07, y + 0.05, z + 0.17), "#FFE14D")); } return [{ g: merge(p), mat: "gloss" }]; }
    case "stampede": default: {
      const p: G[] = [];
      for (let i = 0; i < 4; i++) {
        const x = -3.3 + i * 2.2, z = (i % 2) * 1.5;
        p.push(shade(at(sq(sphere(0.7, 16, 12), 0.75, 0.7, 1.3), x, 1.3, z), (xx, _y, zz) => (i % 2 && Math.sin(zz * 9 + xx) > 0.3 ? "#1B1530" : i % 2 ? "#F4F4F4" : "#6A5A4A")));
        p.push(tint(at(sq(sphere(0.38, 12, 10), 0.8, 0.9, 1.2), x, 1.7, z + 0.95), i % 2 ? "#F4F4F4" : "#6A5A4A"));
        for (const [dx, dz] of [[0.3, -0.5], [-0.3, -0.5], [0.3, 0.5], [-0.3, 0.5]] as const) p.push(tint(at(cyl(0.08, 0.08, 0.9, 6), x + dx, 0.45, z + dz), "#3A2A20"));
        for (const sx of [-1, 1]) p.push(tint(at(sphere(0.07, 6, 4), x + sx * 0.14, 1.85, z + 1.3), "#FFFFFF"));
      }
      return [{ g: merge(p), mat: "gloss" }];
    }
  }
}

// ------------------------------------------------------------------ Kiko's Treehouse decorations (around the treehouse from models.ts; origin at the tree)
export const DECOS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "flag", name: "Banana Flag", icon: "🚩", price: 150 }, { id: "hammock", name: "Hammock", icon: "🛏️", price: 200 },
  { id: "swing", name: "Rope Swing", icon: "🤸", price: 250 }, { id: "garden", name: "Flower Garden", icon: "🌻", price: 300 },
  { id: "lanterns", name: "Lanterns", icon: "🏮", price: 300 }, { id: "nest", name: "Pico's Nest", icon: "🐦", price: 350 },
  { id: "stand", name: "Fruit Stand", icon: "🍉", price: 400 }, { id: "drums", name: "Drum Set", icon: "🥁", price: 450 },
  { id: "slide", name: "Slide", icon: "🎢", price: 500 }, { id: "telescope", name: "Telescope", icon: "🔭", price: 600 },
  { id: "pool", name: "Splash Pool", icon: "🏊", price: 800 }, { id: "upstairs", name: "Second Floor", icon: "🏠", price: 1200 },
];
export function decoParts(id: string): Parts {
  const p: G[] = [], gl: G[] = [];
  switch (id) {
    case "flag": p.push(tint(at(cyl(0.06, 0.06, 3, 6), 1.6, 11.6, 1.6), "#8A5A2B"), tint(at(sq(rbox(1, 0.6, 0.04, 0.02), 1, 1, 1), 2.1, 12.8, 1.6), "#FFD23F")); break;
    case "hammock": { for (const x of [-2.6, 1.0]) p.push(tint(at(cyl(0.15, 0.18, 2.4, 8), x, 1.2, 3.2), "#6B4226")); const h = new THREE.CylinderGeometry(0.6, 0.6, 3.4, 12, 1, true, Math.PI, Math.PI); h.rotateZ(Math.PI / 2); h.translate(-0.8, 1.8, 3.2); p.push(tint(h, "#FF5F7E")); break; }
    case "swing": { p.push(tint(at(cyl(0.12, 0.14, 4, 8).rotateZ(Math.PI / 2), 2.6, 6.0, -1.2), "#6B4226")); for (const z of [-1.5, -0.9]) p.push(tint(at(cyl(0.025, 0.025, 4, 4), 3.8, 4.0, z), "#E7CF9A")); p.push(tint(at(rbox(0.5, 0.08, 0.9, 0.03), 3.8, 2.0, -1.2), "#B9774A")); break; }
    case "garden": for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 3.2 + (i % 2) * 0.6; p.push(tint(at(cyl(0.03, 0.03, 0.6, 4), Math.cos(a) * r, 0.3, Math.sin(a) * r), "#3FAE4A")); p.push(tint(at(sphere(0.18, 8, 6), Math.cos(a) * r, 0.65, Math.sin(a) * r), ["#FFD23F", "#FF5F7E", "#FF8FC7", "#B58CFF"][i % 4])); } break;
    case "lanterns": for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gl.push(tint(at(sq(sphere(0.2, 10, 8), 1, 1.3, 1), Math.cos(a) * 2.4, 5.7, Math.sin(a) * 2.4), ["#FF6A4A", "#FFD23F", "#FF8FC7"][i % 3])); p.push(tint(at(cyl(0.01, 0.01, 0.4, 3), Math.cos(a) * 2.4, 6.1, Math.sin(a) * 2.4), "#3A2A1A")); } break;
    case "nest": { p.push(tint(at(sq(sphere(0.6, 14, 10), 1, 0.4, 1), -1.8, 12.4, -1.4), "#8A5A2B")); const pc = new THREE.SphereGeometry(0.28, 12, 10); pc.translate(-1.8, 12.75, -1.4); p.push(tint(pc, "#1E1A2E")); p.push(tint(at(sq(sphere(0.12, 10, 8), 0.7, 0.9, 2.2), -1.8, 12.78, -1.05), "#FF8A1F")); break; }
    case "stand": { p.push(tint(at(rbox(1.6, 0.9, 0.8, 0.06), 3.4, 0.45, 1.8), "#C98A55"), tint(at(cone(1.2, 0.6, 4).rotateY(Math.PI / 4), 3.4, 1.9, 1.8), "#FF5F7E")); for (const x of [-0.6, 0.6]) p.push(tint(at(cyl(0.05, 0.05, 1.2, 6), 3.4 + x, 1.2, 1.8), "#8A5A2B")); for (let i = 0; i < 5; i++) p.push(tint(at(sphere(0.16, 8, 6), 2.9 + i * 0.25, 1.0, 1.8), ["#FFA62B", "#FF4F5E", "#FFD23F", "#7CC44A", "#6B5BFF"][i])); break; }
    case "drums": for (let i = 0; i < 3; i++) { p.push(tint(at(cyl(0.35, 0.35, 0.6, 14), -3.2 + i * 0.75, 0.3, 1.6), ["#E8344E", "#FFC21A", "#3D8BFF"][i])); p.push(tint(at(cyl(0.36, 0.36, 0.04, 14), -3.2 + i * 0.75, 0.62, 1.6), "#FFF4D6")); } break;
    case "slide": { const sl = rbox(0.9, 0.1, 6.5, 0.04); sl.rotateX(-0.85); sl.translate(-2.6, 3.4, -2.2); p.push(tint(sl, "#3DC8FF")); for (const x of [-3.05, -2.15]) { const r = rbox(0.08, 0.3, 6.5, 0.03); r.rotateX(-0.85); r.translate(x, 3.6, -2.2); p.push(tint(r, "#FFD23F")); } break; }
    case "telescope": p.push(tint(at(cyl(0.12, 0.2, 1.4, 10).rotateZ(-0.9), 1.4, 9.6, 1.2), "#B9774A"), tint(at(cyl(0.04, 0.04, 1.0, 6), 1.2, 8.9, 1.2), "#3A2A1A")); break;
    case "pool": p.push(tint(at(cyl(2.0, 2.0, 0.4, 24), -3.6, 0.2, -3.2), "#E8D2A8")); gl.push(tint(at(cyl(1.8, 1.8, 0.05, 24), -3.6, 0.42, -3.2), "#7AD3FF")); break;
    case "upstairs": p.push(tint(at(rbox(2.4, 1.8, 2.2, 0.15), 0.2, 11.4, 0), "#E8B07A"), tint(at(cone(2.2, 1.4, 4).rotateY(Math.PI / 4), 0.2, 13.0, 0), "#FF8A3D")); gl.push(tint(at(rbox(0.6, 0.5, 0.1, 0.04), 0.2, 11.6, 1.12), "#FFE7A3")); break;
    default: break;
  }
  const out: Parts = [];
  if (p.length) out.push({ g: merge(p), mat: "gloss" });
  if (gl.length) out.push({ g: merge(gl), mat: "glow" });
  return out;
}
