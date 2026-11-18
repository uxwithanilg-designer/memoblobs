// Rain Raid models: Kranky's Dust Army (grey baked clay, cracks, orange dust-glow eyes), the generals' war machines,
// Dust Pumps, Sprout cages, the Rain Well, Puddo's Rain Blaster, the mine cart and the raft, crates, keys, doors,
// gates, rails, pellets, bombs and enemy shots. Built in code with vertex colours like the rest of Clayland.
// Critters face +z (the camera); the renderer turns them toward Puddo.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { merge, tint } from "../crowd/models";
import type { EnemyKind, Weapon } from "./types";

export type G = THREE.BufferGeometry;
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const at = <X extends G>(g: X, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const sq = <X extends G>(g: X, x: number, y: number, z: number) => { g.scale(x, y, z); return g; };
const rbox = (w: number, h: number, d: number, r = 0.08, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r0: number, r1: number, h: number, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
const cone = (r: number, h: number, n = 10) => new THREE.ConeGeometry(r, h, n);
const shade = (hex: string, k: number) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };
const GLOW = "#FF8A2A", DARK = "#2A2420";

/** angry glowing eyes, a slanted brow, on the front (+z) at height y */
function eyes(p: G[], y: number, z: number, gap = 0.16, r = 0.075, glow = GLOW) {
  for (const sx of [-1, 1]) {
    p.push(tint(sq(at(sphere(r, 10, 8), sx * gap, y, z), 1, 0.8, 0.6), glow));
    const br = rbox(r * 2.6, 0.04, 0.05, 0.015); br.rotateZ(-sx * 0.35); br.translate(sx * gap, y + r * 1.2, z + 0.01); p.push(tint(br, DARK));
  }
}
/** dry cracks pressed into the clay */
function cracks(p: G[], w: number, h: number, z: number, c: string, n = 3, y0 = 0.2) {
  for (let i = 0; i < n; i++) {
    const k = rbox(0.03, h * (0.18 + (i % 2) * 0.12), 0.03, 0.01);
    k.rotateZ((i % 2 ? 1 : -1) * (0.3 + i * 0.2)); k.translate((i - (n - 1) / 2) * w * 0.28, y0 + h * (0.3 + 0.12 * (i % 3)), z);
    p.push(tint(k, shade(c, 0.6)));
  }
}
function feet(p: G[], c: string, gap = 0.2, r = 0.13) { for (const sx of [-1, 1]) p.push(tint(sq(at(sphere(r, 10, 8), sx * gap, r * 0.6, 0.05), 1, 0.6, 1.3), shade(c, 0.8))); }
/** a stubby dust gun held in front */
function gun(p: G[], y: number, len = 0.42, r = 0.07, side = 0.26, double = false) {
  for (const k of double ? [-0.06, 0.06] : [0]) { const b = cyl(r, r * 1.1, len, 10); b.rotateX(Math.PI / 2); b.translate(side, y + k, 0.25 + len / 2); p.push(tint(b, "#4A4038")); }
  p.push(tint(at(rbox(0.2, 0.18, 0.28, 0.04), side, y, 0.22), "#6A5A48"));
  p.push(tint(at(sphere(r * 0.9, 8, 6), side, y, 0.27 + len), GLOW));
}
function helmet(p: G[], y: number, r: number, c: string) {
  const d = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); d.translate(0, y, 0); p.push(tint(d, shade(c, 0.72)));
  const rim = new THREE.TorusGeometry(r, 0.035, 6, 18); rim.rotateX(Math.PI / 2); rim.translate(0, y, 0); p.push(tint(rim, shade(c, 0.55)));
}

/** one of the Dust Army (geometry sized to the bestiary's w × h; origin at the feet) */
export function dustArmy(kind: EnemyKind, w: number, h: number, body: string, belly: string, glow: string): G {
  const p: G[] = [];
  switch (kind) {
    case "dustie": case "pebbleGunner": {
      p.push(tint(at(sq(sphere(0.5, 16, 12), w * 0.95, h * 0.82, 0.8), 0, h * 0.48, 0), body));
      p.push(tint(at(sq(sphere(0.32, 12, 10), w * 0.9, h * 0.6, 0.4), 0, h * 0.4, 0.25), belly));
      helmet(p, h * 0.78, w * 0.5, body);
      eyes(p, h * 0.66, 0.36, 0.15, 0.07, glow);
      cracks(p, w, h, 0.39, body);
      feet(p, body);
      gun(p, h * 0.42, kind === "pebbleGunner" ? 0.55 : 0.4, kind === "pebbleGunner" ? 0.08 : 0.065, 0.3, kind === "pebbleGunner");
      if (kind === "pebbleGunner") for (let i = 0; i < 4; i++) p.push(tint(at(sq(sphere(0.12, 8, 6), 1.3, 0.8, 1), -0.32 + i * 0.2, h * 0.12, 0.2), "#B89A6A"));
      break;
    }
    case "dustRunner": {
      const b = sq(sphere(0.45, 14, 10), w * 0.9, h * 0.9, 0.8); b.rotateX(0.35); b.translate(0, h * 0.5, 0); p.push(tint(b, body));
      for (let i = 0; i < 4; i++) p.push(tint(at(cone(0.08, 0.3, 6), 0, h * 0.95 - i * 0.12, -0.12 - i * 0.12), shade(body, 0.7)));
      eyes(p, h * 0.65, 0.34, 0.13, 0.065, glow);
      cracks(p, w, h, 0.36, body, 2);
      feet(p, body, 0.16, 0.12);
      break;
    }
    case "dustHopper": {
      p.push(tint(at(sq(sphere(0.48, 14, 10), w, h * 0.85, 0.9), 0, h * 0.55, 0), body));
      eyes(p, h * 0.7, 0.4, 0.15, 0.07, glow);
      cracks(p, w, h, 0.42, body);
      for (const sx of [-1, 1]) p.push(tint(sq(at(sphere(0.2, 10, 8), sx * 0.24, 0.12, 0.12), 1, 0.55, 1.5), shade(body, 0.75)));
      break;
    }
    case "mortar": {
      p.push(tint(at(sq(sphere(0.5, 14, 10), w, h * 0.7, 0.9), 0, h * 0.4, 0), body));
      helmet(p, h * 0.62, w * 0.45, body);
      eyes(p, h * 0.52, 0.42, 0.15, 0.07, glow);
      const tube = cyl(0.14, 0.17, 0.75, 12); tube.rotateX(-0.7); tube.translate(0, h * 0.75, -0.28); p.push(tint(tube, "#4A4038"));
      p.push(tint(at(new THREE.TorusGeometry(0.15, 0.04, 6, 14).rotateX(Math.PI / 2 - 0.7), 0, h * 0.75 + 0.27, -0.06), GLOW));
      feet(p, body, 0.24);
      break;
    }
    case "shieldDustie": {
      p.push(tint(at(sq(sphere(0.5, 14, 10), w * 0.9, h * 0.8, 0.8), 0, h * 0.48, -0.05), body));
      helmet(p, h * 0.78, w * 0.48, body);
      eyes(p, h * 0.68, 0.33, 0.14, 0.065, glow);
      feet(p, body);
      // the shield: a riveted slab on the front
      p.push(tint(at(rbox(w * 0.95, h * 0.78, 0.12, 0.06), 0, h * 0.42, 0.48), "#5A6E8A"));
      p.push(tint(at(rbox(w * 0.7, 0.08, 0.04, 0.02), 0, h * 0.62, 0.56), "#7A8EAA"));
      for (const [x, y] of [[-0.32, 0.2], [0.32, 0.2], [-0.32, 0.7], [0.32, 0.7]]) p.push(tint(at(sphere(0.04, 6, 5), x * w, y * h, 0.55), "#C8D4E0"));
      break;
    }
    case "brickBrute": {
      p.push(tint(at(rbox(w * 0.95, h * 0.7, 0.9, 0.18), 0, h * 0.52, 0), body));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) p.push(tint(at(rbox(w * 0.42, h * 0.18, 0.06, 0.03), (c - 0.5) * w * 0.46 + (r % 2) * 0.1, h * (0.3 + r * 0.2), 0.46), shade(body, 0.85 + ((r + c) % 2) * 0.1)));
      p.push(tint(at(rbox(w * 0.55, h * 0.26, 0.6, 0.1), 0, h * 0.95, 0.05), shade(body, 0.9)));
      eyes(p, h * 0.98, 0.36, 0.13, 0.06, glow);
      for (const sx of [-1, 1]) { p.push(tint(at(sq(sphere(0.28, 12, 9), 1, 1.1, 1), sx * w * 0.6, h * 0.42, 0.15), shade(body, 0.8))); p.push(tint(at(rbox(0.32, 0.4, 0.4, 0.08), sx * w * 0.25, 0.2, 0.05), shade(body, 0.7))); }
      break;
    }
    case "dustDrone": {
      p.push(tint(at(sq(sphere(0.38, 14, 10), 1, 0.75, 1), 0, h * 0.5, 0), body));
      p.push(tint(at(sphere(0.13, 10, 8), 0, h * 0.5, 0.3), glow));
      p.push(tint(at(cyl(0.03, 0.03, 0.25, 6), 0, h + 0.05, 0), "#4A4038"));
      const rot = rbox(1.0, 0.04, 0.12, 0.02); rot.translate(0, h + 0.18, 0); p.push(tint(rot, "#6A5A48"));
      break;
    }
    case "bombGull": case "diveHawk": {
      const b = sq(sphere(0.42, 14, 10), 1.25, 0.75, 0.85); b.translate(0, h * 0.5, 0); p.push(tint(b, body));
      for (const sx of [-1, 1]) { const wg = sq(sphere(0.5, 10, 6), 1, 0.12, 0.5); wg.rotateZ(sx * (kind === "diveHawk" ? 0.5 : 0.25)); wg.translate(sx * 0.55, h * 0.62, -0.05); p.push(tint(wg, shade(body, 0.85))); }
      const bk = cone(0.1, 0.32, 8); bk.rotateX(Math.PI / 2); bk.translate(0, h * 0.5, 0.42); p.push(tint(bk, "#E8A040"));
      eyes(p, h * 0.62, 0.28, 0.12, 0.055, glow);
      if (kind === "bombGull") { p.push(tint(at(sphere(0.18, 10, 8), 0, h * 0.12, 0), "#3A3430")); p.push(tint(at(cyl(0.02, 0.02, 0.12, 5), 0, h * 0.0, 0), GLOW)); }
      break;
    }
    case "wallTurret": case "ceilTurret": {
      const up = kind === "wallTurret" ? 1 : -1, base = kind === "wallTurret" ? 0 : h;
      p.push(tint(at(rbox(w * 0.95, 0.28, 0.8, 0.06), 0, base + up * 0.14, 0), shade(body, 0.8)));
      p.push(tint(at(sq(sphere(0.36, 14, 10), 1, 0.85, 1), 0, base + up * 0.48, 0), body));
      const b = cyl(0.08, 0.1, 0.55, 10); b.rotateX(Math.PI / 2); b.translate(0, base + up * 0.5, 0.42); p.push(tint(b, "#3A3430"));
      p.push(tint(at(sphere(0.1, 8, 6), 0, base + up * 0.5, 0.7), glow));
      p.push(tint(at(sphere(0.07, 8, 6), 0, base + up * 0.66, 0.26), glow));
      break;
    }
    case "dustHive": {
      for (const [x, y, r] of [[0, 0.6, 0.75], [-0.35, 0.35, 0.5], [0.38, 0.38, 0.5], [0, 1.25, 0.5]] as const) p.push(tint(at(sq(sphere(r, 14, 10), 1, 0.9, 0.85), x, y * (h / 1.9), 0), body));
      for (const [x, y] of [[-0.25, 0.75], [0.25, 0.55], [0, 1.1]] as const) { p.push(tint(at(sq(sphere(0.13, 10, 8), 1, 1.2, 0.5), x, y * (h / 1.9), 0.6), DARK)); p.push(tint(at(sphere(0.06, 6, 5), x, y * (h / 1.9), 0.66), glow)); }
      p.push(tint(at(cyl(0.14, 0.18, 0.5, 10), 0.2, h * 0.95, -0.1), shade(body, 0.7)));
      cracks(p, w, h, 0.62, body, 4, 0.1);
      break;
    }
    case "mineLayer": {
      p.push(tint(at(rbox(w * 0.9, h * 0.5, 0.75, 0.12), 0, h * 0.42, 0), body));
      for (const sx of [-1, 1]) { const t = cyl(0.14, 0.14, 0.8, 12); t.rotateX(Math.PI / 2); t.translate(sx * w * 0.42, 0.14, 0); p.push(tint(t, "#3A3430")); }
      p.push(tint(at(cyl(0.22, 0.22, 0.1, 14), 0, h * 0.72, -0.1), "#3A3430"));
      p.push(tint(at(sphere(0.06, 6, 5), 0, h * 0.8, -0.1), "#FF3A2A"));
      eyes(p, h * 0.5, 0.38, 0.14, 0.06, glow);
      break;
    }
    // ---- Phase B: Rasp's and Clinker's troops
    case "laserSniper": case "iceShooter": {
      p.push(tint(at(sq(sphere(0.5, 16, 12), w * 0.92, h * 0.78, 0.8), 0, h * 0.46, 0), body));
      p.push(tint(at(sq(sphere(0.3, 12, 10), w * 0.85, h * 0.55, 0.4), 0, h * 0.4, 0.24), belly));
      feet(p, body);
      if (kind === "laserSniper") {
        // a red visor and a long scoped rifle
        p.push(tint(at(rbox(w * 0.7, 0.14, 0.12, 0.04), 0, h * 0.7, 0.36), "#FF3A3A"));
        helmet(p, h * 0.8, w * 0.48, body);
        const rifle = cyl(0.05, 0.06, 0.95, 10); rifle.rotateX(Math.PI / 2); rifle.translate(0.28, h * 0.46, 0.55); p.push(tint(rifle, "#3A3430"));
        const scope = cyl(0.06, 0.06, 0.3, 10); scope.rotateX(Math.PI / 2); scope.translate(0.28, h * 0.58, 0.4); p.push(tint(scope, "#2A2420"));
        p.push(tint(at(sphere(0.06, 8, 6), 0.28, h * 0.46, 1.03), "#FF3A3A"));
      } else {
        // an icicle crown and a frosty gun
        eyes(p, h * 0.66, 0.35, 0.15, 0.07, glow);
        for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.06, 0.26, 6), (i - 2) * 0.12, h * 0.9, 0.05 - Math.abs(i - 2) * 0.04), "#BFEFFF"));
        gun(p, h * 0.42, 0.45, 0.07, 0.3, true);
      }
      cracks(p, w, h, 0.38, body, 2);
      break;
    }
    case "copterDustie": {
      p.push(tint(at(sq(sphere(0.48, 14, 10), w * 0.95, h * 0.95, 0.85), 0, h * 0.5, 0), body));
      eyes(p, h * 0.6, 0.38, 0.15, 0.07, glow);
      p.push(tint(at(rbox(0.36, 0.4, 0.22, 0.06), 0, h * 0.62, -0.36), "#6A5A48"));
      p.push(tint(at(cyl(0.03, 0.03, 0.35, 6), 0, h + 0.1, -0.2), DARK));
      p.push(tint(at(rbox(1.25, 0.04, 0.12, 0.02), 0, h + 0.28, -0.2), "#4A4038"));
      p.push(tint(at(rbox(0.12, 0.04, 1.0, 0.02), 0, h + 0.28, -0.2), "#4A4038"));
      gun(p, h * 0.3, 0.32, 0.06, 0, false);
      break;
    }
    case "kiteRider": {
      const kite = rbox(1.0, 1.0, 0.05, 0.02); kite.rotateZ(Math.PI / 4); kite.rotateX(-0.35); kite.translate(0, h * 0.95, -0.35); p.push(tint(kite, glow));
      const kite2 = rbox(0.7, 0.7, 0.06, 0.02); kite2.rotateZ(Math.PI / 4); kite2.rotateX(-0.35); kite2.translate(0, h * 0.95, -0.33); p.push(tint(kite2, shade(body, 0.85)));
      p.push(tint(at(sq(sphere(0.36, 12, 10), 1, 0.9, 0.9), 0, h * 0.3, 0.05), body));
      eyes(p, h * 0.36, 0.34, 0.12, 0.06, glow);
      for (const sx of [-1, 1]) p.push(tint(at(cyl(0.02, 0.02, 0.6, 5), sx * 0.2, h * 0.65, -0.15), "#5A4A3A"));
      for (let i = 0; i < 3; i++) p.push(tint(at(cone(0.07, 0.2, 5).rotateX(Math.PI), -0.15 + i * 0.15, h * 0.02, 0.05), "#C8CCD8"));
      break;
    }
    case "towerShield": {
      p.push(tint(at(sq(sphere(0.5, 14, 10), w * 0.85, h * 0.65, 0.8), 0, h * 0.4, -0.15), body));
      helmet(p, h * 0.66, w * 0.4, body);
      eyes(p, h * 0.56, 0.22, 0.13, 0.06, glow);
      feet(p, body, 0.22);
      p.push(tint(at(rbox(w * 1.05, h * 0.98, 0.16, 0.08), 0, h * 0.5, 0.42), shade(glow, 1)));
      p.push(tint(at(rbox(w * 0.85, h * 0.8, 0.05, 0.04), 0, h * 0.5, 0.51), shade(glow, 1.25)));
      p.push(tint(at(rbox(0.22, h * 0.12, 0.06, 0.03), 0, h * 0.72, 0.54), DARK));
      for (const [x, y] of [[-0.4, 0.15], [0.4, 0.15], [-0.4, 0.85], [0.4, 0.85]]) p.push(tint(at(sphere(0.05, 6, 5), x * w, y * h, 0.53), "#C8D4E0"));
      break;
    }
    case "gumBouncer": {
      p.push(tint(at(sphere(0.45, 18, 14), 0, h * 0.5, 0), body));
      p.push(tint(at(sq(sphere(0.12, 10, 8), 1.5, 1, 0.6), -0.18, h * 0.72, 0.34), "#FFFFFF"));
      for (const [x, y, c] of [[0.25, 0.35, "#FFE14A"], [-0.28, 0.3, "#7FD8FF"], [0.05, 0.15, "#9BE04A"]] as const) p.push(tint(at(sq(sphere(0.07, 8, 6), 1, 1, 0.4), x, y * h + h * 0.1, 0.42), c));
      eyes(p, h * 0.55, 0.42, 0.14, 0.065, glow);
      break;
    }
    case "candyCannon": case "sporeThrower": {
      if (kind === "candyCannon") {
        p.push(tint(at(cyl(0.45, 0.5, h * 0.45, 16), 0, h * 0.22, 0), body));
        for (let i = 0; i < 4; i++) p.push(tint(at(new THREE.TorusGeometry(0.47, 0.035, 6, 18).rotateX(Math.PI / 2), 0, h * (0.08 + i * 0.1), 0), i % 2 ? "#FFFFFF" : shade(body, 1.2)));
        const tube = cyl(0.17, 0.2, 0.7, 12); tube.rotateX(-0.75); tube.translate(0, h * 0.62, 0.12); p.push(tint(tube, "#FFFFFF"));
        for (let i = 0; i < 3; i++) { const st = new THREE.TorusGeometry(0.19, 0.03, 6, 14); st.rotateX(Math.PI / 2 - 0.75); st.translate(0, h * 0.5 + i * 0.13, 0.0 + i * 0.12); p.push(tint(st, "#FF5A8A")); }
        eyes(p, h * 0.3, 0.48, 0.15, 0.06, glow);
      } else {
        p.push(tint(at(sq(sphere(0.48, 14, 10), w * 0.9, h * 0.7, 0.85), 0, h * 0.4, 0), body));
        const cap = new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1); cap.translate(0, h * 0.72, 0); p.push(tint(cap, "#9A5AB4"));
        for (const [x, z] of [[-0.25, 0.3], [0.2, 0.36], [0.05, -0.1]]) p.push(tint(at(sphere(0.07, 8, 6), x, h * 0.88, z), "#E8E0FF"));
        eyes(p, h * 0.55, 0.38, 0.14, 0.065, glow);
        p.push(tint(at(sphere(0.2, 10, 8), 0.36, h * 0.35, 0.2), glow));
        feet(p, body);
      }
      break;
    }
    case "dustCart": {
      p.push(tint(at(rbox(w * 0.95, h * 0.55, 0.8, 0.08), 0, h * 0.42, 0), "#6A5A48"));
      p.push(tint(at(rbox(w * 0.98, 0.06, 0.84, 0.02), 0, h * 0.7, 0), "#8A7A62"));
      for (const sx of [-1, 1]) for (const z of [-0.36, 0.36]) { const wh = cyl(0.16, 0.16, 0.1, 12); wh.rotateX(Math.PI / 2); wh.translate(sx * w * 0.3, 0.16, z); p.push(tint(wh, DARK)); }
      p.push(tint(at(sq(sphere(0.48, 14, 10), w * 0.85, 0.7, 0.75), 0, h * 0.75, 0), body));
      eyes(p, h * 0.85, 0.33, 0.15, 0.07, glow);
      break;
    }
    case "windupSwarm": {
      p.push(tint(at(sq(sphere(0.3, 12, 10), 1, 1.1, 0.9), 0, h * 0.48, 0), body));
      helmet(p, h * 0.78, 0.24, "#C84A4A");
      eyes(p, h * 0.58, 0.25, 0.09, 0.045, glow);
      feet(p, body, 0.11, 0.08);
      // the wind-up key on his back
      p.push(tint(at(cyl(0.025, 0.025, 0.2, 6).rotateX(Math.PI / 2), 0, h * 0.5, -0.33), "#C8A040"));
      for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.08, 8, 6), 1, 1, 0.3), sx * 0.09, h * 0.5, -0.44), glow));
      break;
    }
    case "toyTank": {
      for (const z of [-0.32, 0.32]) { p.push(tint(at(rbox(w * 0.95, 0.3, 0.26, 0.12), 0, 0.15, z), DARK)); for (let i = 0; i < 4; i++) { const wh = cyl(0.1, 0.1, 0.28, 10); wh.rotateX(Math.PI / 2); wh.translate(-w * 0.35 + i * w * 0.233, 0.15, z); p.push(tint(wh, "#5A524A")); } }
      p.push(tint(at(rbox(w * 0.85, h * 0.32, 0.8, 0.08), 0, h * 0.42, 0), body));
      p.push(tint(at(sq(sphere(0.32, 14, 10), 1.1, 0.7, 1), 0, h * 0.72, 0), shade(body, 1.1)));
      const barrel = cyl(0.06, 0.07, 0.65, 10); barrel.rotateX(Math.PI / 2); barrel.translate(0, h * 0.74, 0.5); p.push(tint(barrel, DARK));
      p.push(tint(at(sphere(0.06, 8, 6), 0, h * 0.74, 0.83), glow));
      p.push(tint(at(rbox(0.25, 0.04, 0.02, 0.01), 0, h * 0.5, 0.41), "#FFC21A"));
      eyes(p, h * 0.78, 0.3, 0.1, 0.05, glow);
      break;
    }
    case "rootGrabber": {
      p.push(tint(at(sq(sphere(0.5, 14, 10), w * 0.85, h * 0.6, 0.8), 0, h * 0.32, 0), body));
      for (let i = 0; i < 5; i++) { const r = cone(0.07, h * 0.6, 6); r.rotateZ((i - 2) * 0.32); r.translate((i - 2) * 0.16, h * 0.68, 0.05 - Math.abs(i - 2) * 0.05); p.push(tint(r, shade(body, 0.8))); }
      for (const sx of [-1, 1]) { const c = cone(0.06, 0.3, 5); c.rotateZ(sx * 1.2); c.translate(sx * 0.45, h * 0.45, 0.2); p.push(tint(c, belly)); }
      eyes(p, h * 0.42, 0.36, 0.15, 0.07, glow);
      p.push(tint(at(sq(sphere(0.06, 6, 5), 2, 1, 1), 0, h * 1.0, 0), glow));
      break;
    }
    case "witchMoth": case "lanternGhost": {
      if (kind === "witchMoth") {
        p.push(tint(at(sq(sphere(0.3, 12, 10), 0.9, 1.3, 0.9), 0, h * 0.5, 0), body));
        for (const sx of [-1, 1]) { const wg = sq(sphere(0.42, 12, 8), 1, 0.85, 0.12); wg.rotateZ(sx * 0.3); wg.translate(sx * 0.42, h * 0.62, -0.08); p.push(tint(wg, belly)); p.push(tint(at(sq(sphere(0.1, 8, 6), 1, 1, 0.3), sx * 0.45, h * 0.66, -0.02), glow)); }
        const hat = cone(0.2, 0.42, 10); hat.translate(0, h * 1.02, 0); p.push(tint(hat, "#3A2A4A"));
        p.push(tint(at(cyl(0.3, 0.3, 0.03, 14), 0, h * 0.82, 0), "#3A2A4A"));
        eyes(p, h * 0.58, 0.25, 0.1, 0.05, glow);
      } else {
        p.push(tint(at(rbox(0.6, 0.62, 0.6, 0.08), 0, h * 0.55, 0), "#4A4038"));
        p.push(tint(at(sq(sphere(0.25, 12, 10), 1, 1.1, 1), 0, h * 0.55, 0), glow));
        p.push(tint(at(cone(0.38, 0.25, 4).rotateY(Math.PI / 4), 0, h * 0.98, 0), "#4A4038"));
        p.push(tint(at(new THREE.TorusGeometry(0.08, 0.02, 5, 10), 0, h * 1.14, 0), "#4A4038"));
        const tail = cone(0.28, 0.5, 10); tail.rotateX(Math.PI); tail.translate(0, h * 0.1, 0); p.push(tint(tail, belly));
        eyes(p, h * 0.58, 0.32, 0.1, 0.055, DARK);
      }
      break;
    }
    case "hoverSled": {
      p.push(tint(at(rbox(w, 0.14, 0.7, 0.06), 0, 0.12, 0), "#5A6E8A"));
      const tip = cyl(0.07, 0.07, 0.7, 10); tip.rotateX(Math.PI / 2); tip.translate(w * 0.5, 0.2, 0); p.push(tint(tip, "#5A6E8A"));
      for (const z of [-0.25, 0.25]) p.push(tint(at(sq(sphere(0.1, 8, 6), 1, 0.5, 1), -w * 0.42, 0.06, z), glow));
      p.push(tint(at(sq(sphere(0.38, 12, 10), 1, 0.95, 0.9), 0, h * 0.62, 0), body));
      p.push(tint(at(rbox(0.5, 0.12, 0.1, 0.04), 0, h * 0.78, 0.3), "#3DE0FF"));
      eyes(p, h * 0.62, 0.34, 0.12, 0.055, glow);
      break;
    }
    case "snowBrute": {
      p.push(tint(at(sphere(0.62, 16, 12), 0, h * 0.36, 0), belly));
      p.push(tint(at(sphere(0.45, 16, 12), 0, h * 0.78, 0.05), body));
      for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.26, 12, 9), 1, 1.2, 1), sx * w * 0.5, h * 0.5, 0.1), shade(body, 0.9)));
      for (let i = 0; i < 3; i++) p.push(tint(at(cone(0.08, 0.25, 6), -0.2 + i * 0.2, h * 1.02, -0.05), "#BFEFFF"));
      eyes(p, h * 0.82, 0.42, 0.14, 0.065, glow);
      cracks(p, w, h * 0.6, 0.6, belly, 3, 0.1);
      break;
    }
    case "sandBlower": {
      p.push(tint(at(sq(sphere(0.48, 14, 10), w * 0.9, h * 0.8, 0.85), 0, h * 0.45, 0), body));
      eyes(p, h * 0.66, 0.36, 0.14, 0.065, glow);
      // a big brass horn that blows sand
      const horn = cone(0.32, 0.7, 14, ); horn.rotateX(-Math.PI / 2); horn.translate(0.15, h * 0.42, 0.62); p.push(tint(horn, "#C8A040"));
      p.push(tint(at(new THREE.TorusGeometry(0.32, 0.04, 6, 16), 0.15, h * 0.42, 0.96), "#E8C060"));
      feet(p, body);
      break;
    }
    case "sandShark": {
      const b = sq(sphere(0.5, 16, 12), w * 0.9, h * 0.75, 0.75); b.translate(0, h * 0.45, 0); p.push(tint(b, body));
      const fin = cone(0.25, 0.6, 6); fin.scale(1, 1, 0.3); fin.translate(0, h * 0.95, -0.05); p.push(tint(fin, shade(body, 0.85)));
      p.push(tint(at(sq(sphere(0.3, 12, 8), 1.3, 0.5, 0.6), 0, h * 0.3, 0.28), belly));
      for (let i = 0; i < 5; i++) p.push(tint(at(cone(0.04, 0.1, 4).rotateX(Math.PI), -0.2 + i * 0.1, h * 0.42, 0.42), "#FFFFFF"));
      eyes(p, h * 0.6, 0.34, 0.2, 0.06, glow);
      break;
    }
    case "dropPod": {
      p.push(tint(at(sq(sphere(0.55, 16, 12), w * 0.85, h * 0.62, 0.85), 0, h * 0.55, 0), body));
      p.push(tint(at(cone(0.4, 0.4, 12), 0, h * 1.05, 0), shade(body, 0.85)));
      for (let i = 0; i < 3; i++) { const fin = rbox(0.06, 0.45, 0.3, 0.02); fin.rotateY(i * Math.PI * 2 / 3); fin.translate(Math.sin(i * Math.PI * 2 / 3) * 0.45, h * 0.2, Math.cos(i * Math.PI * 2 / 3) * 0.45); p.push(tint(fin, DARK)); }
      p.push(tint(at(rbox(0.45, 0.3, 0.05, 0.04), 0, h * 0.58, 0.47), "#3A3430"));
      for (const sx of [-1, 1]) p.push(tint(at(sphere(0.05, 6, 5), sx * 0.1, h * 0.6, 0.5), glow));
      for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.2, 0.05, 0.02, 0.01), -0.3 + i * 0.2, h * 0.38, 0.47), i % 2 ? DARK : "#FFC21A"));
      break;
    }
    case "kilnKnight": {
      p.push(tint(at(rbox(w * 0.8, h * 0.55, 0.7, 0.16), 0, h * 0.4, 0), body));
      p.push(tint(at(rbox(w * 0.6, h * 0.28, 0.6, 0.12), 0, h * 0.8, 0), shade(body, 1.15)));
      p.push(tint(at(rbox(w * 0.45, 0.06, 0.04, 0.02), 0, h * 0.8, 0.31), glow));
      const plume = sq(sphere(0.14, 8, 6), 0.6, 1.8, 1.4); plume.translate(0, h * 1.0, -0.05); p.push(tint(plume, "#FF4A1A"));
      for (const sx of [-1, 1]) p.push(tint(at(sq(sphere(0.2, 10, 8), 1, 0.7, 1), sx * w * 0.45, h * 0.66, 0), shade(body, 0.85)));
      const sword = rbox(0.08, 0.9, 0.04, 0.02); sword.rotateX(0.5); sword.translate(0.42, h * 0.55, 0.32); p.push(tint(sword, "#C8CCD8"));
      p.push(tint(at(rbox(0.26, 0.05, 0.06, 0.02), 0.42, h * 0.32, 0.18), "#C8A040"));
      feet(p, body, 0.2, 0.15);
      break;
    }
    case "spiderDustie": {
      p.push(tint(at(sq(sphere(0.4, 14, 10), 1, 0.8, 0.9), 0, h * 0.55, 0), body));
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const l = rbox(0.5, 0.05, 0.05, 0.02); l.rotateZ(sx * (0.6 - i * 0.05)); l.rotateY(sx * (i - 1.5) * 0.35); l.translate(sx * 0.42, h * 0.38, (i - 1.5) * 0.14); p.push(tint(l, DARK)); }
      for (const [x, y] of [[-0.1, 0.62], [0.1, 0.62], [-0.18, 0.5], [0.18, 0.5]]) p.push(tint(at(sphere(0.05, 6, 5), x, y * h + 0.1, 0.33), glow));
      p.push(tint(at(cyl(0.01, 0.01, 2.5, 4), 0, h + 1.25, 0), "#D8D0C8"));
      break;
    }
    case "laserTurret": {
      p.push(tint(at(rbox(w * 0.95, 0.3, 0.85, 0.06), 0, 0.15, 0), shade(body, 0.75)));
      const dome = new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, 0.3, 0); p.push(tint(dome, body));
      for (const sx of [-1, 1]) { const b = cyl(0.05, 0.06, 0.5, 8); b.rotateX(Math.PI / 2); b.translate(sx * 0.1, 0.5, 0.42); p.push(tint(b, DARK)); p.push(tint(at(sphere(0.06, 8, 6), sx * 0.1, 0.5, 0.68), glow)); }
      p.push(tint(at(sphere(0.07, 8, 6), 0, 0.68, 0.28), glow));
      break;
    }
    case "forgeBot": {
      p.push(tint(at(rbox(w * 0.8, h * 0.62, 0.75, 0.14), 0, h * 0.42, 0), body));
      p.push(tint(at(rbox(w * 0.45, h * 0.22, 0.06, 0.04), 0, h * 0.4, 0.38), glow));
      for (let i = 0; i < 3; i++) p.push(tint(at(rbox(w * 0.45, 0.025, 0.02, 0.01), 0, h * (0.33 + i * 0.07), 0.42), DARK));
      p.push(tint(at(cyl(0.1, 0.13, 0.35, 10), -0.2, h * 0.88, -0.1), DARK));
      eyes(p, h * 0.66, 0.38, 0.13, 0.06, glow);
      const noz = cyl(0.08, 0.13, 0.5, 10); noz.rotateX(Math.PI / 2); noz.translate(0.36, h * 0.35, 0.45); p.push(tint(noz, "#4A4038"));
      p.push(tint(at(sphere(0.1, 8, 6), 0.36, h * 0.35, 0.72), "#FFC21A"));
      feet(p, body, 0.22, 0.15);
      break;
    }
    case "crusherBot": {
      p.push(tint(at(rbox(w * 0.72, h * 0.6, 0.7, 0.16), 0, h * 0.45, 0), body));
      eyes(p, h * 0.66, 0.36, 0.13, 0.06, glow);
      for (const sx of [-1, 1]) { p.push(tint(at(rbox(0.42, 0.42, 0.5, 0.1), sx * w * 0.5, h * 0.42, 0.1), shade(body, 0.8))); p.push(tint(at(rbox(0.46, 0.06, 0.54, 0.02), sx * w * 0.5, h * 0.62, 0.1), "#FFC21A")); }
      for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.16, 0.05, 0.02, 0.01), -0.24 + i * 0.16, h * 0.22, 0.36), i % 2 ? DARK : "#FFC21A"));
      feet(p, body, 0.22, 0.16);
      break;
    }
    default: {
      p.push(tint(at(sq(sphere(0.5, 14, 10), w, h, 0.8), 0, h * 0.5, 0), body));
      eyes(p, h * 0.65, 0.38, 0.15, 0.07, glow);
    }
  }
  return merge(p);
}

/** a gold sash and plume for elite Dusties */
export function eliteMark(): G {
  const p: G[] = [];
  const t = new THREE.TorusGeometry(0.42, 0.05, 6, 20); t.rotateX(Math.PI / 2); t.translate(0, 0.35, 0); p.push(tint(t, "#FFD23F"));
  p.push(tint(at(sq(sphere(0.12, 8, 6), 0.7, 1.6, 0.7), 0, 1.25, -0.05), "#FFD23F"));
  return merge(p);
}

// ------------------------------------------------------------------ the generals' war machines (origin at the bottom centre)
export interface MachineParts { body: G; spin?: G; spinAt?: [number, number, number]; spinAxis?: "y" | "z" | "x" }
export function machine(kind: string, w: number, h: number): MachineParts {
  const p: G[] = [];
  const hull = "#8A8178", dark = "#3A3430", stripe = "#FFC21A";
  // Sergeant Grit: a grey armadillo-bot head popping out of every hatch
  const grit = (x: number, y: number, z: number, s = 1) => {
    p.push(tint(at(sq(sphere(0.32 * s, 14, 10), 1, 0.9, 1.1), x, y, z), "#A89880"));
    for (let i = 0; i < 3; i++) p.push(tint(at(sq(new THREE.TorusGeometry(0.3 * s, 0.04, 5, 14, Math.PI), 1, 1, 1).rotateY(Math.PI / 2), x, y + 0.02 - i * 0.07, z - 0.1 + i * 0.05), "#7A6A58"));
    for (const sx of [-1, 1]) { p.push(tint(at(sq(sphere(0.08 * s, 8, 6), 1, 1.6, 0.6), x + sx * 0.18 * s, y + 0.28 * s, z), "#8A7A68")); p.push(tint(at(sphere(0.05 * s, 6, 5), x + sx * 0.1 * s, y + 0.06 * s, z + 0.3 * s), GLOW)); }
    const cap = rbox(0.5 * s, 0.12 * s, 0.5 * s, 0.03); cap.translate(x, y + 0.3 * s, z); p.push(tint(cap, "#5A6A3A"));
  };
  // Major Rasp: a beetle with a shiny green shell and a file for an arm (zones 5-8)
  const rasp = (x: number, y: number, z: number, s = 1) => {
    p.push(tint(at(sq(sphere(0.36 * s, 16, 12), 1.1, 0.85, 1.05), x, y, z), "#3E6A3A"));
    const seam = rbox(0.03, 0.5 * s, 0.03, 0.01); seam.rotateX(-0.3); seam.translate(x, y + 0.1 * s, z + 0.3 * s); p.push(tint(seam, "#1E3A1E"));
    p.push(tint(at(sq(sphere(0.12 * s, 10, 8), 1.6, 0.9, 1), x + 0.1 * s, y + 0.2 * s, z + 0.24 * s), "#8ADC6A"));
    p.push(tint(at(sq(sphere(0.22 * s, 12, 10), 1, 0.85, 1), x, y + 0.08 * s, z + 0.32 * s), "#2A4A2A"));
    for (const sx of [-1, 1]) {
      p.push(tint(at(sphere(0.06 * s, 8, 6), x + sx * 0.1 * s, y + 0.12 * s, z + 0.5 * s), GLOW));
      const ant = cyl(0.015 * s, 0.015 * s, 0.4 * s, 5); ant.rotateZ(sx * 0.5); ant.translate(x + sx * 0.14 * s, y + 0.38 * s, z + 0.32 * s); p.push(tint(ant, DARK));
      p.push(tint(at(sphere(0.04 * s, 6, 5), x + sx * 0.24 * s, y + 0.55 * s, z + 0.32 * s), "#8ADC6A"));
    }
    const horn = cone(0.06 * s, 0.32 * s, 8); horn.rotateX(0.6); horn.translate(x, y + 0.3 * s, z + 0.45 * s); p.push(tint(horn, "#1E3A1E"));
    // the rasp: a ridged steel file held up
    const file = rbox(0.1 * s, 0.75 * s, 0.05 * s, 0.02); file.rotateZ(-0.4); file.translate(x + 0.45 * s, y + 0.25 * s, z + 0.2 * s); p.push(tint(file, "#A8B0BC"));
    for (let i = 0; i < 5; i++) { const r = rbox(0.12 * s, 0.015, 0.06 * s, 0.005); r.rotateZ(-0.4); r.translate(x + 0.36 * s + i * 0.045 * s, y + 0.05 * s + i * 0.1 * s, z + 0.22 * s); p.push(tint(r, "#6A7480")); }
  };
  // Colonel Clinker: an iron robot head with a chimney cap and a glowing furnace grill (zones 9-12)
  const clinker = (x: number, y: number, z: number, s = 1) => {
    p.push(tint(at(rbox(0.6 * s, 0.5 * s, 0.55 * s, 0.08), x, y, z), "#4E5660"));
    p.push(tint(at(rbox(0.42 * s, 0.14 * s, 0.05 * s, 0.03), x, y - 0.1 * s, z + 0.28 * s), "#FF7A1F"));
    for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.025 * s, 0.14 * s, 0.03 * s, 0.01), x - 0.15 * s + i * 0.1 * s, y - 0.1 * s, z + 0.31 * s), DARK));
    for (const sx of [-1, 1]) { p.push(tint(at(cyl(0.07 * s, 0.07 * s, 0.05 * s, 10).rotateX(Math.PI / 2), x + sx * 0.14 * s, y + 0.08 * s, z + 0.28 * s), "#2A2420")); p.push(tint(at(sphere(0.045 * s, 8, 6), x + sx * 0.14 * s, y + 0.08 * s, z + 0.31 * s), "#FFC21A")); }
    p.push(tint(at(cyl(0.1 * s, 0.12 * s, 0.32 * s, 10), x + 0.12 * s, y + 0.4 * s, z - 0.05 * s), "#3A3430"));
    p.push(tint(at(cyl(0.13 * s, 0.13 * s, 0.05 * s, 10), x + 0.12 * s, y + 0.57 * s, z - 0.05 * s), "#2A2420"));
    for (const sx of [-1, 1]) p.push(tint(at(sphere(0.05 * s, 6, 5), x + sx * 0.3 * s, y + 0.18 * s, z + 0.2 * s), "#8A9098"));
  };
  const wheels = (n: number, y: number, r: number, zs: number[], x0: number, x1: number, c = "#4A4038") => { for (const z of zs) for (let i = 0; i < n; i++) { const wh = cyl(r, r, 0.3, 14); wh.rotateX(Math.PI / 2); wh.translate(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y, z); p.push(tint(wh, c)); p.push(tint(at(cyl(r * 0.4, r * 0.4, 0.32, 8).rotateX(Math.PI / 2), x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y, z), stripe)); } };
  switch (kind) {
    case "crawler": {
      p.push(tint(at(rbox(w, h * 0.42, 1.8, 0.2), 0, h * 0.42, 0), hull));
      for (const z of [-0.75, 0.75]) { const tr = rbox(w + 0.2, h * 0.3, 0.4, 0.15); tr.translate(0, h * 0.16, z); p.push(tint(tr, dark)); for (let i = 0; i < 5; i++) { const wh = cyl(0.17, 0.17, 0.42, 12); wh.rotateX(Math.PI / 2); wh.translate(-w / 2 + 0.4 + i * (w - 0.8) / 4, h * 0.16, z); p.push(tint(wh, "#6A5A48")); } }
      p.push(tint(at(rbox(w * 0.5, h * 0.3, 1.3, 0.15), -w * 0.08, h * 0.78, 0), shade(hull, 0.9)));
      const barrel = cyl(0.16, 0.2, w * 0.55, 12); barrel.rotateZ(Math.PI / 2); barrel.translate(w * 0.42, h * 0.82, 0); p.push(tint(barrel, dark));
      p.push(tint(at(sphere(0.14, 8, 6), w * 0.7, h * 0.82, 0), GLOW));
      for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.25, 0.08, 0.02, 0.01), -w * 0.35 + i * 0.45, h * 0.48, 0.91), i % 2 ? dark : stripe));
      p.push(tint(at(cyl(0.12, 0.16, 0.5, 10), -w * 0.42, h * 0.75, -0.4), dark));
      grit(-w * 0.12, h * 0.98, 0.1, 0.9);
      return { body: merge(p) };
    }
    case "copter": {
      p.push(tint(at(sq(sphere(0.9, 18, 12), w * 0.5, h * 0.42, 0.85), 0, h * 0.55, 0), hull));
      p.push(tint(at(sq(sphere(0.55, 16, 10), 1, 0.85, 1), w * 0.22, h * 0.62, 0.15), "#9FD8FF"));
      const tail = cyl(0.12, 0.25, w * 0.6, 10); tail.rotateZ(Math.PI / 2); tail.translate(-w * 0.55, h * 0.6, 0); p.push(tint(tail, hull));
      p.push(tint(at(rbox(0.1, 0.7, 0.5, 0.03), -w * 0.85, h * 0.75, 0), stripe));
      for (const z of [-0.5, 0.5]) p.push(tint(at(rbox(w * 0.7, 0.07, 0.07, 0.02), 0, 0.05, z), dark));
      p.push(tint(at(cyl(0.06, 0.06, 0.4, 6), 0, h * 0.95, 0), dark));
      grit(w * 0.2, h * 0.62, 0.2, 0.75);
      // the saw hangs under the belly
      p.push(tint(at(cyl(0.05, 0.05, 0.4, 6), 0, 0.25, 0), dark));
      const rotor = merge([tint(rbox(w * 1.15, 0.05, 0.18, 0.02), "#4A4038"), tint(rbox(0.18, 0.05, w * 1.15, 0.02), "#4A4038")]);
      return { body: merge(p), spin: rotor, spinAt: [0, h * 1.12, 0], spinAxis: "y" };
    }
    case "worm": {
      for (let i = 0; i < 4; i++) p.push(tint(at(cyl(w * 0.42 - i * 0.03, w * 0.44 - i * 0.03, h * 0.22, 16), 0, h * (0.12 + i * 0.2), 0), i % 2 ? hull : shade(hull, 0.85)));
      for (let i = 0; i < 4; i++) p.push(tint(at(new THREE.TorusGeometry(w * 0.44, 0.05, 6, 20).rotateX(Math.PI / 2), 0, h * (0.22 + i * 0.2), 0), stripe));
      grit(0, h * 0.7, w * 0.42, 0.85);
      const drill = cone(w * 0.42, h * 0.38, 12); drill.translate(0, h * 0.19, 0);
      const spiral: G[] = [tint(drill, "#C8CCD8")]; for (let i = 0; i < 4; i++) { const r = rbox(0.06, h * 0.32, 0.06, 0.02); r.rotateZ(0.6); r.rotateY(i * Math.PI / 2); r.translate(Math.cos(i * Math.PI / 2) * w * 0.18, h * 0.16, Math.sin(i * Math.PI / 2) * w * 0.18); spiral.push(tint(r, "#7A8090")); }
      return { body: merge(p), spin: merge(spiral), spinAt: [0, h * 0.86, 0], spinAxis: "y" };
    }
    case "sub": {
      const b = sq(sphere(1, 20, 14), w * 0.5, h * 0.36, 0.75); b.translate(0, h * 0.4, 0); p.push(tint(b, "#6E7E8E"));
      p.push(tint(at(rbox(w * 0.28, h * 0.32, 0.7, 0.12), w * 0.05, h * 0.78, 0), "#5E6E7E"));
      p.push(tint(at(cyl(0.05, 0.05, 0.55, 6), w * 0.12, h * 1.1, 0), dark));
      p.push(tint(at(rbox(0.2, 0.1, 0.1, 0.03), w * 0.17, h * 1.35, 0), dark));
      for (let i = 0; i < 3; i++) { const port = new THREE.TorusGeometry(0.16, 0.04, 6, 14); port.translate(-w * 0.2 + i * 0.55, h * 0.42, 0.74); p.push(tint(port, "#C8D4DE")); p.push(tint(at(sq(sphere(0.13, 10, 8), 1, 1, 0.3), -w * 0.2 + i * 0.55, h * 0.42, 0.74), "#9FD8FF")); }
      for (let i = 0; i < 5; i++) p.push(tint(at(rbox(0.3, 0.07, 0.02, 0.01), -w * 0.35 + i * 0.32, h * 0.18, 0.66), i % 2 ? dark : stripe));
      grit(w * 0.05, h * 1.0, 0.1, 0.7);
      const prop = merge([tint(rbox(0.06, 0.8, 0.14, 0.02), "#C8A040"), tint(rbox(0.06, 0.14, 0.8, 0.02), "#C8A040")]);
      return { body: merge(p), spin: prop, spinAt: [-w * 0.52, h * 0.4, 0], spinAxis: "x" };
    }    // ---- Phase B: Major Rasp's machines (zones 5-8)
    case "gyro": {
      p.push(tint(at(sq(sphere(0.9, 18, 12), w * 0.45, h * 0.4, 0.8), 0, h * 0.5, 0), "#7A8A6A"));
      p.push(tint(at(sq(sphere(0.5, 16, 10), 1, 0.8, 1), w * 0.2, h * 0.6, 0.12), "#9FD8FF"));
      const ring = new THREE.TorusGeometry(w * 0.48, 0.07, 6, 28); ring.rotateX(Math.PI / 2); ring.translate(0, h * 0.5, 0); p.push(tint(ring, stripe));
      for (const sx of [-1, 1]) { const st = rbox(0.06, 0.06, 0.5, 0.02); st.translate(sx * w * 0.36, h * 0.5, 0); p.push(tint(st, dark)); }
      for (const z of [-0.45, 0.45]) p.push(tint(at(rbox(w * 0.55, 0.07, 0.07, 0.02), 0, 0.05, z), dark));
      const gunL = cyl(0.08, 0.1, 0.8, 10); gunL.rotateZ(Math.PI / 2); gunL.translate(w * 0.42, h * 0.32, 0); p.push(tint(gunL, dark));
      p.push(tint(at(sphere(0.1, 8, 6), w * 0.62, h * 0.32, 0), "#FF3A3A"));
      p.push(tint(at(cyl(0.05, 0.05, 0.4, 6), 0, h * 0.95, 0), dark));
      rasp(w * 0.18, h * 0.62, 0.15, 0.7);
      const rotor = merge([tint(rbox(w * 1.1, 0.05, 0.2, 0.02), "#4A4038"), tint(rbox(0.2, 0.05, w * 1.1, 0.02), "#4A4038")]);
      return { body: merge(p), spin: rotor, spinAt: [0, h * 1.12, 0], spinAxis: "y" };
    }
    case "crusher": {
      const pink = "#C86A9A";
      p.push(tint(at(rbox(w * 0.8, h * 0.5, 1.6, 0.25), 0, h * 0.55, 0), pink));
      for (let i = 0; i < 5; i++) p.push(tint(at(rbox(w * 0.82, 0.08, 1.62, 0.03), 0, h * (0.36 + i * 0.09), 0), i % 2 ? "#FFFFFF" : "#FFD2EA"));
      // the press plate underneath
      p.push(tint(at(rbox(w, h * 0.16, 1.9, 0.08), 0, h * 0.1, 0), "#6A5A68"));
      for (let i = 0; i < 6; i++) p.push(tint(at(rbox(0.25, 0.06, 0.02, 0.01), -w * 0.4 + i * w * 0.16, h * 0.1, 0.96), i % 2 ? dark : stripe));
      for (const sx of [-1, 1]) { const c = cyl(0.14, 0.14, h * 0.6, 12); c.translate(sx * w * 0.42, h * 0.55, 0.7); p.push(tint(c, "#FFFFFF")); for (let i = 0; i < 4; i++) { const s = new THREE.TorusGeometry(0.15, 0.03, 5, 12); s.rotateX(Math.PI / 2); s.translate(sx * w * 0.42, h * (0.32 + i * 0.13), 0.7); p.push(tint(s, "#FF4A6A")); } }
      p.push(tint(at(sq(sphere(0.6, 16, 10), 1.2, 0.75, 1), 0, h * 0.88, 0), "#FFE0F0"));
      p.push(tint(at(sq(sphere(0.5, 14, 10), 1.1, 0.7, 0.9), 0, h * 0.9, 0), "#9FD8FF"));
      rasp(0, h * 0.88, 0.1, 0.8);
      const gear = merge([tint(cyl(0.45, 0.45, 0.12, 12).rotateX(Math.PI / 2), "#FFC21A"), ...Array.from({ length: 8 }, (_, i) => tint(rbox(0.16, 0.16, 0.12, 0.02).translate(Math.cos(i / 8 * Math.PI * 2) * 0.5, Math.sin(i / 8 * Math.PI * 2) * 0.5, 0), "#E0A81A"))]);
      return { body: merge(p), spin: gear, spinAt: [-w * 0.2, h * 0.55, 0.86], spinAxis: "z" };
    }
    case "express": {
      const red = "#D84A4A";
      const boiler = cyl(h * 0.32, h * 0.32, w * 0.62, 18); boiler.rotateZ(Math.PI / 2); boiler.translate(w * 0.12, h * 0.55, 0); p.push(tint(boiler, red));
      for (let i = 0; i < 3; i++) { const b = new THREE.TorusGeometry(h * 0.33, 0.04, 6, 20); b.rotateY(Math.PI / 2); b.translate(-w * 0.12 + i * w * 0.22, h * 0.55, 0); p.push(tint(b, stripe)); }
      p.push(tint(at(cyl(h * 0.32, h * 0.32, 0.1, 18).rotateZ(Math.PI / 2), w * 0.44, h * 0.55, 0), "#3A3430"));
      p.push(tint(at(sphere(0.16, 10, 8), w * 0.46, h * 0.62, 0), "#FFE14A"));
      // the cab at the back, with Rasp at the window
      p.push(tint(at(rbox(w * 0.3, h * 0.82, 1.4, 0.1), -w * 0.33, h * 0.5, 0), shade(red, 0.85)));
      p.push(tint(at(rbox(w * 0.34, 0.12, 1.5, 0.04), -w * 0.33, h * 0.95, 0), dark));
      p.push(tint(at(rbox(w * 0.18, h * 0.26, 0.05, 0.04), -w * 0.33, h * 0.68, 0.71), "#9FD8FF"));
      rasp(-w * 0.33, h * 0.66, 0.5, 0.6);
      p.push(tint(at(cyl(0.18, 0.26, 0.6, 12), w * 0.3, h * 1.0, 0), dark));
      p.push(tint(at(cyl(0.3, 0.3, 0.1, 12), w * 0.3, h * 1.3, 0), dark));
      // the cowcatcher
      for (let i = 0; i < 5; i++) { const g = rbox(0.06, h * 0.32, 0.06, 0.02); g.rotateZ(0.5); g.translate(w * 0.5, h * 0.18, -0.5 + i * 0.25); p.push(tint(g, "#6A5A48")); }
      wheels(3, h * 0.18, h * 0.18, [-0.62, 0.62], -w * 0.35, w * 0.3);
      return { body: merge(p) };
    }
    case "borer": {
      for (let i = 0; i < 3; i++) p.push(tint(at(cyl(w * 0.4 - i * 0.04, w * 0.43 - i * 0.04, h * 0.26, 16), 0, h * (0.32 + i * 0.22), 0), i % 2 ? "#6A5A40" : "#7A6A4A"));
      // mushroom caps grown over the hull
      for (const [x, y, r] of [[-0.6, 0.95, 0.4], [0.5, 0.8, 0.3], [0.1, 1.0, 0.28]] as const) { const cap = new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1); cap.translate(x, h * y, -0.1); p.push(tint(cap, "#9A5AB4")); p.push(tint(at(cyl(0.06, 0.08, 0.2, 8), x, h * y - 0.1, -0.1), "#E8E0D0")); }
      for (let i = 0; i < 6; i++) p.push(tint(at(sphere(0.07, 8, 6), Math.cos(i) * w * 0.42, h * (0.3 + (i % 3) * 0.2), Math.sin(i) * w * 0.42), "#9BE04A"));
      rasp(0, h * 0.7, w * 0.42, 0.75);
      const drill = cone(w * 0.4, h * 0.36, 12); drill.rotateX(Math.PI); drill.translate(0, -h * 0.18, 0);
      const spiral: G[] = [tint(drill, "#C8CCD8")]; for (let i = 0; i < 4; i++) { const r = rbox(0.06, h * 0.3, 0.06, 0.02); r.rotateZ(-0.6); r.rotateY(i * Math.PI / 2); r.translate(Math.cos(i * Math.PI / 2) * w * 0.17, -h * 0.17, Math.sin(i * Math.PI / 2) * w * 0.17); spiral.push(tint(r, "#7A8090")); }
      return { body: merge(p), spin: merge(spiral), spinAt: [0, h * 0.36, 0], spinAxis: "y" };
    }
    // ---- Phase B: Colonel Clinker's machines (zones 9-12)
    case "plow": {
      p.push(tint(at(rbox(w * 0.75, h * 0.4, 1.7, 0.2), -w * 0.08, h * 0.42, 0), "#8A96A6"));
      for (const z of [-0.72, 0.72]) { p.push(tint(at(rbox(w * 0.8, h * 0.28, 0.4, 0.14), -w * 0.08, h * 0.15, z), dark)); }
      wheels(4, h * 0.15, 0.17, [-0.72, 0.72], -w * 0.4, w * 0.24, "#5A6270");
      // the big plow blade in front
      const blade = rbox(0.18, h * 0.62, 2.1, 0.06); blade.rotateZ(-0.35); blade.translate(w * 0.42, h * 0.32, 0); p.push(tint(blade, "#E8EEF6"));
      for (let i = 0; i < 5; i++) { const s = rbox(0.2, 0.08, 0.3, 0.02); s.rotateZ(-0.35); s.translate(w * 0.44, h * (0.12 + i * 0.12), -0.8 + i * 0.4); p.push(tint(s, i % 2 ? dark : stripe)); }
      p.push(tint(at(rbox(w * 0.36, h * 0.34, 1.2, 0.12), -w * 0.18, h * 0.8, 0), "#6E7A8A"));
      p.push(tint(at(rbox(w * 0.2, h * 0.16, 0.05, 0.03), -w * 0.12, h * 0.84, 0.61), "#BFEFFF"));
      p.push(tint(at(cyl(0.14, 0.18, 0.6, 10), -w * 0.4, h * 0.85, -0.4), dark));
      clinker(-w * 0.2, h * 1.12, 0.1, 0.85);
      return { body: merge(p) };
    }
    case "rig": {
      p.push(tint(at(rbox(w * 0.9, h * 0.28, 1.6, 0.14), 0, h * 0.14, 0), "#8A7A5A"));
      // the derrick tower
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = cyl(0.06, 0.06, h * 0.75, 6); leg.rotateZ(sx * 0.12); leg.rotateX(-sz * 0.12); leg.translate(sx * w * 0.24, h * 0.62, sz * 0.4); p.push(tint(leg, "#B49A6A")); }
      for (let i = 0; i < 3; i++) p.push(tint(at(rbox(w * 0.5 - i * 0.12, 0.06, 0.9 - i * 0.1, 0.02), 0, h * (0.45 + i * 0.2), 0), stripe));
      p.push(tint(at(rbox(w * 0.3, h * 0.16, 0.6, 0.06), 0, h * 0.98, 0), "#6A5A40"));
      p.push(tint(at(sq(sphere(0.32, 12, 10), 1.2, 1, 1), w * 0.36, h * 0.38, 0.4), "#E0C898"));
      clinker(-w * 0.2, h * 0.5, 0.65, 0.75);
      const drill = cone(0.42, h * 0.5, 12); drill.rotateX(Math.PI); drill.translate(0, -h * 0.25, 0);
      const spiral: G[] = [tint(drill, "#C8CCD8"), tint(at(cyl(0.12, 0.12, h * 0.6, 8), 0, h * 0.3, 0), "#7A8090")];
      for (let i = 0; i < 4; i++) { const r = rbox(0.05, h * 0.38, 0.05, 0.02); r.rotateZ(-0.6); r.rotateY(i * Math.PI / 2); r.translate(Math.cos(i * Math.PI / 2) * 0.18, -h * 0.22, Math.sin(i * Math.PI / 2) * 0.18); spiral.push(tint(r, "#5A6070")); }
      return { body: merge(p), spin: merge(spiral), spinAt: [0, h * 0.28, 0], spinAxis: "y" };
    }
    case "blimp": {
      const bag = sq(sphere(1, 24, 16), w * 0.5, h * 0.38, 0.9); bag.translate(0, h * 0.68, 0); p.push(tint(bag, "#5A5070"));
      for (let i = 0; i < 4; i++) { const b = new THREE.TorusGeometry(1, 0.025, 6, 28); b.scale(h * 0.385, h * 0.385, 0.91); b.rotateY(Math.PI / 2); b.translate(-w * 0.3 + i * w * 0.2, h * 0.68, 0); p.push(tint(b, "#3A3048")); }
      for (const sz of [-1, 1, 0]) { const fin = rbox(0.8, 0.5, 0.06, 0.03); if (sz === 0) fin.rotateX(Math.PI / 2); fin.translate(-w * 0.46, h * 0.68 + (sz === 0 ? 0 : 0), sz * 0.4); if (sz !== 0) fin.rotateX(0); p.push(tint(fin, "#FFD23F")); }
      // the gondola with Clinker and two glowing lanterns
      p.push(tint(at(rbox(w * 0.36, h * 0.24, 1.0, 0.1), 0, h * 0.18, 0), "#4A4038"));
      for (const sx of [-1, 1]) p.push(tint(at(cyl(0.02, 0.02, h * 0.22, 4), sx * w * 0.15, h * 0.38, 0), dark));
      clinker(0, h * 0.34, 0.25, 0.65);
      for (const sx of [-1, 1]) { p.push(tint(at(rbox(0.26, 0.32, 0.26, 0.05), sx * w * 0.24, h * 0.02, 0.3), "#3A3430")); p.push(tint(at(sphere(0.12, 10, 8), sx * w * 0.24, h * 0.02, 0.3), "#FFD23F")); }
      p.push(tint(at(rbox(1.4, 0.3, 0.04, 0.04), 0, h * 0.7, 0.9 * h * 0.38 + 0.02), "#FFD23F"));
      const prop = merge([tint(rbox(0.06, 0.9, 0.16, 0.02), "#C8A040"), tint(rbox(0.06, 0.16, 0.9, 0.02), "#C8A040")]);
      return { body: merge(p), spin: prop, spinAt: [-w * 0.55, h * 0.68, 0], spinAxis: "x" };
    }
    case "forge": {
      const iron = "#5E6670";
      // two stubby legs
      for (const sz of [-0.45, 0.45]) { p.push(tint(at(rbox(0.55, h * 0.36, 0.45, 0.1), -0.1, h * 0.2, sz), shade(iron, 0.8))); p.push(tint(at(rbox(0.8, 0.16, 0.55, 0.06), 0.05, 0.08, sz), dark)); }
      p.push(tint(at(rbox(w * 0.7, h * 0.42, 1.4, 0.2), 0, h * 0.6, 0), iron));
      // the furnace belly
      p.push(tint(at(rbox(w * 0.4, h * 0.2, 0.06, 0.05), w * 0.12, h * 0.55, 0.71), "#FF7A1F"));
      for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.04, h * 0.2, 0.04, 0.01), w * 0.12 - w * 0.15 + i * w * 0.1, h * 0.55, 0.75), DARK));
      p.push(tint(at(sq(sphere(0.2, 10, 8), 1.5, 0.8, 0.3), w * 0.12, h * 0.55, 0.7), "#FFC21A"));
      for (const sz of [-0.85, 0.85]) {
        p.push(tint(at(sphere(0.32, 12, 10), 0, h * 0.72, sz), shade(iron, 0.9)));
        const arm = cyl(0.16, 0.2, 0.9, 10); arm.rotateZ(Math.PI / 2); arm.translate(w * 0.28, h * 0.6, sz); p.push(tint(arm, dark));
        p.push(tint(at(sphere(0.12, 8, 6), w * 0.5, h * 0.6, sz), "#FF5A1F"));
      }
      for (const sx of [-0.35, 0.05]) { p.push(tint(at(cyl(0.12, 0.15, 0.55, 10), sx * w, h * 0.95, -0.4), dark)); p.push(tint(at(sphere(0.1, 8, 6), sx * w, h * 1.2, -0.4), "#FF7A1F")); }
      clinker(w * 0.1, h * 0.92, 0.2, 0.9);
      return { body: merge(p) };
    }
  }
  return { body: tint(rbox(w, h, 1.2, 0.2).translate(0, h / 2, 0), hull) };
}

// ------------------------------------------------------------------ goals and structures
export function pumpGeo(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.8, 0.5, 1.4, 0.08), 0, 0.25, 0), "#5A524A"));
  p.push(tint(at(cyl(0.55, 0.6, 1.5, 16), -0.2, 1.25, 0), "#8A8178"));
  for (let i = 0; i < 3; i++) p.push(tint(at(new THREE.TorusGeometry(0.58, 0.05, 6, 18).rotateX(Math.PI / 2), -0.2, 0.7 + i * 0.5, 0), "#4A4038"));
  p.push(tint(at(cyl(0.1, 0.1, 0.8, 8), 0.55, 1.6, 0), "#4A4038"));
  p.push(tint(at(rbox(0.4, 0.25, 0.4, 0.05), 0.55, 2.05, 0), "#6A5A48"));
  const pipe = cyl(0.12, 0.12, 1.1, 8); pipe.rotateZ(Math.PI / 2); pipe.translate(0.5, 0.6, 0.3); p.push(tint(pipe, "#4A4038"));
  for (let i = 0; i < 5; i++) p.push(tint(at(rbox(0.28, 0.12, 0.02, 0.01), -0.7 + i * 0.32, 0.25, 0.71), i % 2 ? "#2A2420" : "#FFC21A"));
  p.push(tint(at(sphere(0.16, 10, 8), -0.2, 2.1, 0), "#FF8A2A"));
  p.push(tint(at(sq(sphere(0.28, 10, 8), 1, 0.7, 1), -0.2, 2.35, 0), "#B8AEA4"));
  return merge(p);
}
/** a cage of dust-baked bars with a little Sprout inside (the sprout is a separate mesh so it can cheer) */
export function cageGeo(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.4, 0.2, 1.1, 0.05), 0, 0.1, 0), "#5A524A"));
  p.push(tint(at(rbox(1.4, 0.18, 1.1, 0.05), 0, 1.5, 0), "#5A524A"));
  for (let i = 0; i < 6; i++) { const x = -0.6 + i * 0.24; p.push(tint(at(cyl(0.035, 0.035, 1.3, 6), x, 0.8, 0.48), "#7A6E64")); p.push(tint(at(cyl(0.035, 0.035, 1.3, 6), x, 0.8, -0.48), "#7A6E64")); }
  p.push(tint(at(rbox(0.3, 0.3, 0.12, 0.05), 0.4, 0.9, 0.55), "#C8A040"));
  return merge(p);
}
export function sproutGeo(): G {
  const p: G[] = [];
  p.push(tint(at(sq(sphere(0.3, 14, 10), 1, 1.15, 1), 0, 0.35, 0), "#7FD86A"));
  for (const sx of [-1, 1]) { p.push(tint(at(sphere(0.06, 8, 6), sx * 0.1, 0.42, 0.26), "#1B1530")); p.push(tint(at(sq(sphere(0.05, 6, 5), 1.3, 0.7, 0.4), sx * 0.18, 0.32, 0.25), "#FF8FA3")); }
  const l = sq(sphere(0.2, 10, 6), 1.2, 0.18, 0.6); l.rotateZ(0.4); l.translate(0.12, 0.78, 0); p.push(tint(l, "#3FB84F"));
  const l2 = sq(sphere(0.2, 10, 6), 1.2, 0.18, 0.6); l2.rotateZ(-0.4); l2.translate(-0.12, 0.76, 0); p.push(tint(l2, "#5FCB52"));
  return merge(p);
}
/** the Rain Well: a stone ring with blue water, a little roof and a bucket */
export function wellGeo(): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.95, 1.0, 1.0, 20), 0, 0.5, 0), "#A89A88"));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.push(tint(at(rbox(0.36, 0.22, 0.22, 0.04), Math.cos(a) * 0.98, 0.3 + (i % 2) * 0.35, Math.sin(a) * 0.98), i % 2 ? "#8A7E70" : "#B8AA98")); }
  p.push(tint(at(cyl(0.82, 0.82, 0.05, 20), 0, 0.92, 0), "#3DA8FF"));
  for (const sx of [-1, 1]) p.push(tint(at(cyl(0.06, 0.07, 1.8, 8), sx * 0.85, 1.6, 0), "#7A4A2A"));
  const roof = cone(1.35, 0.7, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 2.75, 0); p.push(tint(roof, "#4F8FD8"));
  const bar = cyl(0.05, 0.05, 1.8, 8); bar.rotateZ(Math.PI / 2); bar.translate(0, 2.2, 0); p.push(tint(bar, "#7A4A2A"));
  p.push(tint(at(cyl(0.18, 0.14, 0.26, 10), 0, 1.6, 0), "#C8925A"));
  return merge(p);
}
export function keyGeo(): G {
  const p: G[] = [];
  const ring = new THREE.TorusGeometry(0.2, 0.07, 8, 16); ring.translate(0, 0.25, 0); p.push(tint(ring, "#7FF0FF"));
  p.push(tint(at(cyl(0.05, 0.05, 0.5, 8), 0, -0.2, 0), "#7FF0FF"));
  for (const y of [-0.3, -0.42]) p.push(tint(at(rbox(0.16, 0.07, 0.07, 0.02), 0.09, y, 0), "#5FD8F0"));
  p.push(tint(at(new THREE.OctahedronGeometry(0.1, 0), 0, 0.25, 0), "#FFFFFF"));
  return merge(p);
}
/** Puddo's Rain Blaster: his clay bucket turned cannon, with a little water tank (origin at the grip; points +z) */
export function blasterGeo(): G {
  const p: G[] = [];
  const b = cyl(0.17, 0.13, 0.42, 14); b.rotateX(Math.PI / 2); b.translate(0, 0, 0.12); p.push(tint(b, "#7A4A2A"));
  const rim = new THREE.TorusGeometry(0.17, 0.03, 6, 14); rim.translate(0, 0, 0.33); p.push(tint(rim, "#A8743F"));
  const n = cyl(0.07, 0.1, 0.22, 12); n.rotateX(Math.PI / 2); n.translate(0, 0, 0.42); p.push(tint(n, "#4F8FD8"));
  p.push(tint(at(sq(sphere(0.1, 10, 8), 1, 1, 1.4), 0, 0.17, 0.02), "#7FD8FF"));
  p.push(tint(at(sphere(0.06, 8, 6), 0, 0, 0.53), "#BFF0FF"));
  return merge(p);
}
export function cartGeo(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.3, 0.55, 0.95, 0.06), 0, 0.42, 0), "#8A5A3A"));
  p.push(tint(at(rbox(1.36, 0.08, 1.0, 0.03), 0, 0.72, 0), "#5A3A22"));
  for (const sx of [-1, 1]) for (const z of [-0.4, 0.4]) { const w = cyl(0.17, 0.17, 0.1, 12); w.rotateX(Math.PI / 2); w.translate(sx * 0.4, 0.14, z); p.push(tint(w, "#3A3430")); }
  for (let i = 0; i < 3; i++) p.push(tint(at(rbox(0.06, 0.5, 0.02, 0.01), -0.4 + i * 0.4, 0.42, 0.48), "#C8925A"));
  return merge(p);
}
export function raftGeo(): G {
  const p: G[] = [];
  for (let i = 0; i < 5; i++) { const l = cyl(0.15, 0.15, 1.1, 10); l.rotateX(Math.PI / 2); l.translate(-0.6 + i * 0.3, 0.12, 0); p.push(tint(l, i % 2 ? "#A8743F" : "#8A5A3A")); }
  for (const z of [-0.35, 0.35]) { const r = cyl(0.04, 0.04, 1.5, 6); r.rotateZ(Math.PI / 2); r.translate(0, 0.27, z); p.push(tint(r, "#E8D8B0")); }
  p.push(tint(at(cyl(0.03, 0.03, 1.2, 6), -0.55, 0.85, -0.3), "#7A4A2A"));
  p.push(tint(at(rbox(0.5, 0.35, 0.02, 0.02), -0.3, 1.2, -0.3), "#7FD8FF"));
  return merge(p);
}
/** a Rain crate: a weapon pickup (blue drop) or bombs (a bomb on the side) */
export function crateGeo(bombs: boolean): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.85, 0.85, 0.85, 0.06), 0, 0.42, 0), "#C8925A"));
  for (const y of [0.1, 0.74]) p.push(tint(at(rbox(0.88, 0.1, 0.88, 0.02), 0, y, 0), "#8A5A3A"));
  for (const sx of [-1, 1]) p.push(tint(at(rbox(0.1, 0.85, 0.88, 0.02), sx * 0.38, 0.42, 0), "#8A5A3A"));
  if (bombs) { p.push(tint(at(sphere(0.18, 10, 8), 0, 0.42, 0.44), "#3A3430")); p.push(tint(at(cyl(0.02, 0.02, 0.12, 5), 0.08, 0.6, 0.44), "#FF8A2A")); }
  else { p.push(tint(at(sq(sphere(0.15, 10, 8), 1, 1.2, 0.3), 0, 0.4, 0.44), "#3DA8FF")); p.push(tint(at(cone(0.11, 0.18, 10), 0, 0.58, 0.44), "#3DA8FF")); }
  return merge(p);
}
/** a glowing weapon pickup (a big rain drop in the weapon's colour) */
export function pickupGeo(color: string): G {
  const p: G[] = [];
  p.push(tint(sq(sphere(0.26, 14, 10), 1, 1.1, 1), color));
  const c = cone(0.18, 0.3, 12); c.translate(0, 0.33, 0); p.push(tint(c, color));
  p.push(tint(at(sphere(0.08, 8, 6), -0.08, 0.06, 0.22), "#FFFFFF"));
  return merge(p);
}
export function bombGeo(): G {
  const p: G[] = [];
  p.push(tint(sq(sphere(0.26, 14, 10), 1, 0.9, 1), "#8A5A3A"));
  p.push(tint(at(cyl(0.14, 0.18, 0.1, 12), 0, 0.24, 0), "#6A3A22"));
  for (const [x, y, r] of [[-0.1, 0.38, 0.13], [0.06, 0.42, 0.16], [0.18, 0.36, 0.11]] as const) p.push(tint(at(sphere(r, 10, 8), x, y, 0), "#E8F2FF"));
  p.push(tint(at(rbox(0.05, 0.16, 0.03, 0.01), 0.02, 0.0, 0.25), "#FFE14A"));
  return merge(p);
}
export function pelletGeo(color: string, r: number): G { const p: G[] = []; p.push(tint(sq(sphere(r, 10, 8), 1.5, 0.85, 0.85), color)); p.push(tint(at(sphere(r * 0.45, 6, 5), r * 0.3, r * 0.25, r * 0.4), "#FFFFFF")); return merge(p); }
export function dustBallGeo(): G { const p: G[] = []; p.push(tint(sphere(0.24, 10, 8), "#FF8A2A")); p.push(tint(sq(sphere(0.3, 10, 8), 1, 1, 0.3), "#5A3A22")); return merge(p); }
export function shellGeo(): G { const p: G[] = []; p.push(tint(sq(sphere(0.26, 12, 9), 1, 1.3, 1), "#4A4038")); p.push(tint(at(cyl(0.1, 0.1, 0.12, 8), 0, 0.3, 0), "#FF5A1F")); return merge(p); }
export function mineGeo(): G { const p: G[] = []; p.push(tint(sq(sphere(0.32, 14, 8), 1, 0.4, 1), "#3A3430")); p.push(tint(at(sphere(0.08, 8, 6), 0, 0.12, 0), "#FF3A2A")); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.push(tint(at(cone(0.05, 0.14, 5).rotateZ(-Math.cos(a) * 1.4).rotateX(Math.sin(a) * 1.4), Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3), "#5A524A")); } return merge(p); }
export function bubbleGeo(): G { const p: G[] = []; p.push(tint(sphere(0.32, 14, 10), "#BFEFFF")); p.push(tint(at(sphere(0.09, 8, 6), -0.12, 0.12, 0.24), "#FFFFFF")); return merge(p); }

// ------------------------------------------------------------------ tiles (origin: the tile's bottom-left)
export function railTile(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(0.9, 0.16, 1.4, 0.03), 0.5, 0.88, 0), "#7A4A2A"));
  for (const z of [-0.45, 0.45]) p.push(tint(at(new THREE.BoxGeometry(1.02, 0.1, 0.1), 0.5, 1.0, z), "#9AA0AE"));
  return merge(p);
}
export function doorTile(): G {
  const p: G[] = [];
  p.push(tint(at(new THREE.BoxGeometry(1, 1, 1.6), 0.5, 0.5, -0.2), "#6A5A48"));
  p.push(tint(at(new THREE.BoxGeometry(0.9, 0.1, 0.06), 0.5, 0.5, 0.62), "#FFC21A"));
  for (const x of [0.2, 0.8]) p.push(tint(at(sphere(0.06, 6, 5), x, 0.8, 0.62), "#C8CCD8"));
  return merge(p);
}
export function gateTile(): G {
  const p: G[] = [];
  p.push(tint(at(new THREE.BoxGeometry(0.9, 1, 1.4), 0.5, 0.5, -0.1), "#8A8178"));
  p.push(tint(at(new THREE.BoxGeometry(0.06, 0.9, 0.04), 0.35, 0.5, 0.62), "#FF8A2A"));
  p.push(tint(at(new THREE.BoxGeometry(0.06, 0.6, 0.04), 0.65, 0.45, 0.62), "#FF8A2A"));
  return merge(p);
}
export const WEAPON_COLOR: Record<Weapon, string> = { drizzle: "#7FD8FF", sprinkler: "#5FE0C8", downpour: "#3DA8FF", hailstone: "#E8F6FF", thunder: "#FFE14A", rainbow: "#FF8FE0", geyser: "#9FE6FF" };

// ------------------------------------------------------------------ Phase B rides and props (origin at Puddo's feet; facing +x)
/** the Mud Tank: tracks, a hull, a hatch Puddo pops out of, a stubby Rain cannon */
export function tankGeo(): G {
  const p: G[] = [];
  for (const z of [-0.5, 0.5]) {
    p.push(tint(at(rbox(1.9, 0.42, 0.3, 0.16), 0, 0.21, z), "#3A3430"));
    for (let i = 0; i < 5; i++) { const w = cyl(0.13, 0.13, 0.32, 12); w.rotateX(Math.PI / 2); w.translate(-0.72 + i * 0.36, 0.2, z); p.push(tint(w, "#6A5A48")); }
  }
  p.push(tint(at(rbox(1.7, 0.38, 1.0, 0.12), 0, 0.55, 0), "#5E8A4A"));
  p.push(tint(at(rbox(1.72, 0.06, 1.02, 0.02), 0, 0.73, 0), "#4A6E3A"));
  p.push(tint(at(cyl(0.42, 0.46, 0.2, 18), -0.1, 0.84, 0), "#6E9A5A"));
  const barrel = cyl(0.1, 0.12, 0.85, 12); barrel.rotateZ(Math.PI / 2); barrel.translate(0.62, 0.86, 0); p.push(tint(barrel, "#3A3430"));
  p.push(tint(at(new THREE.TorusGeometry(0.11, 0.035, 6, 12).rotateY(Math.PI / 2), 1.05, 0.86, 0), "#7FD8FF"));
  for (let i = 0; i < 4; i++) p.push(tint(at(rbox(0.22, 0.06, 0.02, 0.01), -0.55 + i * 0.36, 0.55, 0.51), i % 2 ? "#3A3430" : "#FFC21A"));
  p.push(tint(at(sq(sphere(0.12, 8, 6), 1, 1, 0.4), -0.75, 0.6, 0.5), "#7FD8FF"));
  return merge(p);
}
/** the Clay Mech: two legs, a seat for Puddo, twin Downpour cannons */
export function mechGeo(): { body: G; leg: G } {
  const p: G[] = [];
  p.push(tint(at(rbox(1.1, 0.4, 0.9, 0.14), 0, 0.92, 0), "#C8A060"));
  p.push(tint(at(rbox(1.14, 0.06, 0.94, 0.02), 0, 1.1, 0), "#8A6A3A"));
  p.push(tint(at(rbox(0.7, 0.12, 0.7, 0.04), -0.05, 1.16, 0), "#6A5A48"));
  for (const z of [-0.55, 0.55]) {
    p.push(tint(at(sphere(0.2, 12, 9), 0.05, 1.0, z), "#8A6A3A"));
    const gun = cyl(0.09, 0.11, 0.8, 10); gun.rotateZ(Math.PI / 2); gun.translate(0.5, 0.95, z); p.push(tint(gun, "#3A3430"));
    p.push(tint(at(sphere(0.1, 8, 6), 0.9, 0.95, z), "#3DA8FF"));
  }
  for (let i = 0; i < 3; i++) p.push(tint(at(rbox(0.2, 0.06, 0.02, 0.01), -0.3 + i * 0.3, 0.9, 0.46), i % 2 ? "#3A3430" : "#FFC21A"));
  const leg: G[] = [];
  leg.push(tint(at(rbox(0.22, 0.75, 0.24, 0.08), 0, -0.38, 0), "#8A6A3A"));
  leg.push(tint(at(rbox(0.5, 0.14, 0.34, 0.05), 0.08, -0.78, 0), "#3A3430"));
  const lg = merge(leg); lg.translate(0, 0.78, 0);
  return { body: merge(p), leg: lg };
}
/** the Rain Cart Puddo escorts: a cart with a big water tank and a sprinkler on top */
export function rainCartGeo(): G {
  const p: G[] = [];
  p.push(tint(at(rbox(1.8, 0.4, 1.0, 0.08), 0, 0.42, 0), "#8A5A3A"));
  for (const sx of [-1, 1]) for (const z of [-0.45, 0.45]) { const w = cyl(0.22, 0.22, 0.12, 14); w.rotateX(Math.PI / 2); w.translate(sx * 0.6, 0.22, z); p.push(tint(w, "#3A3430")); p.push(tint(at(cyl(0.08, 0.08, 0.14, 8).rotateX(Math.PI / 2), sx * 0.6, 0.22, z), "#FFC21A")); }
  const tank = cyl(0.48, 0.48, 1.5, 18); tank.rotateZ(Math.PI / 2); tank.translate(0, 1.05, 0); p.push(tint(tank, "#3DA8FF"));
  for (const sx of [-0.5, 0, 0.5]) p.push(tint(at(new THREE.TorusGeometry(0.49, 0.035, 6, 20).rotateY(Math.PI / 2), sx, 1.05, 0), "#1E6AB0"));
  p.push(tint(at(sq(sphere(0.2, 10, 8), 1.4, 0.7, 0.4), -0.2, 1.2, 0.42), "#BFEFFF"));
  p.push(tint(at(cyl(0.05, 0.05, 0.4, 8), 0.3, 1.65, 0), "#5A6E8A"));
  p.push(tint(at(sq(sphere(0.18, 10, 8), 1, 0.5, 1), 0.3, 1.88, 0), "#7FD8FF"));
  return merge(p);
}
/** a searchlight on a pole: the pole (from the ground up to the lamp) and the lamp head */
export function searchlightGeo(h: number): G {
  const p: G[] = [];
  p.push(tint(at(cyl(0.09, 0.12, h, 8), 0, -h / 2, -0.6), "#4A4038"));
  for (let i = 1; i < h; i += 1.5) p.push(tint(at(rbox(0.5, 0.05, 0.05, 0.02), 0, -i, -0.6), "#6A5A48"));
  p.push(tint(at(rbox(1.2, 0.12, 0.8, 0.04), 0, -0.05, -0.6), "#5A524A"));
  return merge(p);
}
export function lampHeadGeo(): G {
  const p: G[] = [];
  const body = cyl(0.3, 0.22, 0.55, 14); body.translate(0, -0.25, 0); p.push(tint(body, "#3A3430"));
  p.push(tint(at(cyl(0.28, 0.28, 0.04, 14), 0, -0.53, 0), "#FFF6C8"));
  return merge(p);
}
