// Hazard skins, boss set pieces and character balls for Momo Sky Roll (contracts in art/api.ts).
// Every model is a soft clay toy built from primitives. Geometries, materials and textures are made fresh on every
// call (the renderer disposes everything when a level ends — nothing here is cached at module level).
// Faces look towards +z: the camera sits behind Momo, who rolls towards −z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvas, glow, std, type BallView, type BossView, type DropperView, type LaserView, type PendulumView, type PopperView, type RollerView, type SliderView, type SpinnerView } from "./api";
import { DAISY_CORE_R, MALLET_HEAD_HALF, MALLET_HEAD_R, MALLET_LEN, MALLET_PIVOT_Y } from "../hazards";
import { makeClaw, makeKranky } from "../models";

const TAU = Math.PI * 2;
const PI = Math.PI;
/** +y, for orienting parts along a direction (read-only math constant, not a GPU resource) */
const UP = new THREE.Vector3(0, 1, 0);
type Geo = THREE.BufferGeometry;
type Mat = THREE.Material;

// ---------------------------------------------------------------- tiny builders
/** add a mesh to `parent` at (x, y, z) with scale (sx, sy, sz) and euler rotation (rx, ry, rz) */
function add(parent: THREE.Object3D, geo: Geo, mat: Mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}
function grp(parent?: THREE.Object3D, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent?.add(g);
  return g;
}
const sph = (r: number, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const hemi = (r: number, w = 14, h = 6) => new THREE.SphereGeometry(r, w, h, 0, TAU, 0, PI / 2);
const ico = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cyl = (rt: number, rb: number, h: number, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 10) => new THREE.ConeGeometry(r, h, s);
const tor = (R: number, r: number, rs = 6, ts = 16, arc = TAU) => new THREE.TorusGeometry(R, r, rs, ts, arc);
const capsule = (r: number, len: number, rs = 10) => new THREE.CapsuleGeometry(r, len, 3, rs);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const rbox = (w: number, h: number, d: number, rad = 0.08, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.005, Math.min(rad, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005)));
/** extrude a 2D shape (x, y) by `depth` along z, centred on z = 0, with a soft clay bevel */
function ext(shape: THREE.Shape, depth: number, bevel = 0.04, curve = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** a lathe around y from [radius, height] pairs */
const lathe = (pts: number[][], seg = 12) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
/** a tube along a list of points */
function tube(pts: number[][], r: number, seg = 32, rs = 6, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), closed);
  return new THREE.TubeGeometry(c, seg, r, rs, closed);
}
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
function texOf(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** shiny metal-ish clay (still soft) */
const metal = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => std(c, { roughness: 0.38, metalness: 0.35, ...o });
/** x offsets of `n` items spread over `w` lanes (one per lane) */
function lanes(w: number) {
  const n = Math.max(1, Math.round(w));
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (w / n));
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** a friendly face looking towards +z (or up, with `up`): dot eyes with a shine, pink cheeks and a little smile */
function face(parent: THREE.Object3D, x: number, y: number, z: number, s = 1, o: { cheeks?: boolean; smile?: boolean; up?: boolean; eye?: number } = {}) {
  const f = grp(parent, x, y, z);
  if (o.up) f.rotation.x = -PI / 2;
  const eye = std(o.eye ?? 0x2a1a3a, { roughness: 0.3 });
  const shine = std(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 });
  const big = s > 2; // boss-sized faces get smoother eyes
  const eg = sph(0.07 * s, big ? 14 : 8, big ? 10 : 6), sg = sph(0.024 * s, big ? 8 : 5, big ? 6 : 3);
  for (const sx of [-1, 1]) {
    add(f, eg, eye, sx * 0.13 * s, 0, 0, 1, 1.3, 0.6);
    add(f, sg, shine, sx * 0.13 * s + 0.024 * s, 0.035 * s, 0.04 * s);
  }
  if (o.cheeks !== false) {
    const cg = sph(0.055 * s, big ? 10 : 6, big ? 6 : 4), cm = std(0xff8a9a);
    for (const sx of [-1, 1]) add(f, cg, cm, sx * 0.25 * s, -0.08 * s, -0.01 * s, 1, 0.5, 0.4);
  }
  if (o.smile !== false) add(f, tor(0.055 * s, 0.014 * s, 4, 8, PI), eye, 0, -0.06 * s, 0.005, 1, 1, 1, 0, 0, PI);
  return f;
}

/** a puffy clay cloud (5 smooth puffs) */
function cloud(parent: THREE.Object3D, color = 0xffffff, s = 1, x = 0, y = 0, z = 0) {
  const g = grp(parent, x, y, z);
  const m = std(color, { roughness: 0.9 }), p = sph(1, 12, 8);
  for (const [px, py, pz, r] of [[0, 0, 0, 1], [1.1, -0.15, 0.1, 0.75], [-1.1, -0.2, -0.1, 0.7], [0.4, 0.45, 0.2, 0.62], [-0.45, 0.35, -0.15, 0.55]]) {
    add(g, p, m, px * s, py * s, pz * s, r * s * 1.15, r * s * 0.8, r * s);
  }
  return g;
}

/** a unit-length rope along y, centred on its origin (the renderer scales y to the rope length) */
function ropeMesh(kind: "rope" | "chain" | "rod", color: number, r = 0.04) {
  const g = cyl(r, r, 1, 6);
  if (kind === "rod") return new THREE.Mesh(g, metal(color));
  const [c, x] = canvas(16, 32);
  x.fillStyle = hex(color); x.fillRect(0, 0, 16, 32);
  if (kind === "chain") {
    x.strokeStyle = "rgba(30,30,50,0.65)"; x.lineWidth = 3;
    x.beginPath(); x.ellipse(8, 16, 5, 13, 0, 0, TAU); x.stroke();
  } else {
    x.fillStyle = "rgba(90,50,20,0.35)";
    for (const y of [0, 16]) { x.beginPath(); x.moveTo(0, y); x.lineTo(16, y + 8); x.lineTo(16, y + 14); x.lineTo(0, y + 6); x.fill(); }
  }
  const t = texOf(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, kind === "chain" ? 40 : 60);
  return new THREE.Mesh(g, std(0xffffff, { map: t, roughness: kind === "chain" ? 0.4 : 0.8, metalness: kind === "chain" ? 0.3 : 0 }));
}

/** a little teal Tiki bird (used on Tiki's sign cloud and elsewhere) */
function tikiBird(parent: THREE.Object3D, s = 1, x = 0, y = 0, z = 0) {
  const b = grp(parent, x, y, z);
  b.scale.setScalar(s);
  const teal = std(0x2ec4b6), purple = std(0x8e5be8), orange = std(0xff9a3d);
  add(b, sph(0.32, 12, 9), teal, 0, 0.3, 0, 1, 0.95, 0.9);
  add(b, sph(0.18, 10, 8), std(0xbff3ea), 0, 0.24, 0.17, 1, 1.1, 0.6);
  add(b, cone(0.07, 0.18, 8), orange, 0, 0.42, 0.33, 1, 1, 1, PI / 2);
  for (const k of [-1, 0, 1]) add(b, sph(0.06, 8, 6), purple, k * 0.07, 0.68, -0.02, 0.8, 2, 0.8, 0, 0, -k * 0.45);
  for (const k of [-1, 1]) add(b, sph(0.13, 8, 6), teal, k * 0.3, 0.3, -0.02, 0.4, 1, 0.8, 0, 0, k * 0.4);
  face(b, 0, 0.5, 0.27, 0.75, { smile: false });
  return b;
}

// ---------------------------------------------------------------- H01 pendulums
export function pendulumView(skin: string): PendulumView {
  const group = new THREE.Group(), head = new THREE.Group(), top = new THREE.Group();
  const R = MALLET_HEAD_R, H = MALLET_HEAD_HALF;
  let rope: THREE.Mesh;
  switch (skin) {
    case "axe": {
      const blade = new THREE.Shape();
      blade.moveTo(-0.52, 0.02);
      blade.absarc(0, 0.02, 0.52, PI, TAU, false);
      blade.quadraticCurveTo(0, -0.28, -0.52, 0.02);
      add(head, ext(blade, 0.62, 0.07, 12), metal(0xc8d4e6));
      add(head, rbox(0.5, 0.36, 0.88, 0.13), std(0xe8504f), 0, 0.14, 0);
      add(head, cyl(0.09, 0.09, 0.5, 8), std(0x8a5a3a), 0, 0.5, 0);
      face(head, 0, 0.15, 0.445, 0.8);
      rope = ropeMesh("rod", 0x8a5a3a, 0.06);
      cloud(top, 0xf2f4ff, 0.9);
      break;
    }
    case "sign": {
      add(head, rbox(0.86, 0.72, 0.76, 0.12), std(0xffc93c), 0, 0, 0);
      const [c, x] = canvas(256, 200);
      x.fillStyle = "#fff6e0"; x.fillRect(0, 0, 256, 200);
      x.strokeStyle = "#2ec4b6"; x.lineWidth = 16; x.strokeRect(8, 8, 240, 184);
      x.font = "900 62px 'Lilita One', system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "#7b3fe4"; x.fillText("LEVEL", 128, 72);
      x.fillStyle = "#ffc93c"; x.strokeStyle = "#e08a1a"; x.lineWidth = 5;
      x.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 40, a = -PI / 2 + (i / 10) * TAU; x.lineTo(128 + Math.cos(a) * r, 140 + Math.sin(a) * r); }
      x.closePath(); x.fill(); x.stroke();
      add(head, new THREE.PlaneGeometry(0.72, 0.56), std(0xffffff, { map: texOf(c), roughness: 0.7 }), 0, 0, 0.385);
      add(head, tor(0.08, 0.025, 6, 12), metal(0x9aa6b8), 0, 0.42, 0);
      for (const k of [-1, 0, 1]) add(head, sph(0.06, 8, 6), std(0x8e5be8), 0.36 + k * 0.05, 0.42, 0, 0.8, 2, 0.8, 0, 0, -0.5 - k * 0.4);
      rope = ropeMesh("rope", 0xe8d2a8);
      cloud(top, 0xffffff, 0.9);
      tikiBird(top, 1.2, 0.2, 0.55, 0.1);
      break;
    }
    case "metronome": {
      const w = add(head, cyl(0.4, 0.62, 0.78, 4), metal(0xffc533, { metalness: 0.2 }));
      w.rotation.y = PI / 4;
      add(head, cyl(0.55, 0.57, 0.12, 4), std(0x8a5a3a), 0, -0.25, 0, 1, 1, 1, 0, PI / 4);
      add(head, cyl(0.035, 0.035, 0.4, 6), metal(0xc0c8d8), 0, -0.55, 0);
      face(head, 0, 0.06, 0.37, 0.9);
      rope = ropeMesh("rod", 0xc0c8d8, 0.045);
      cloud(top, 0xffffff, 0.9);
      add(top, cyl(0.22, 0.5, 0.8, 4), std(0x8a5a3a), 0, 0.85, 0, 1, 1, 1, 0, PI / 4);
      add(top, cyl(0.08, 0.08, 0.04, 10), std(0xfff1d6), 0, 0.85, 0.28, 1, 1, 1, PI / 2 - 0.3);
      break;
    }
    case "lantern": {
      add(head, sph(0.5, 14, 10), glow(0xff8a3d, 0.7), 0, 0, 0, 1, 0.86, 0.92);
      const rib = std(0xb8323a), ribG = tor(0.5, 0.022, 4, 24);
      for (let i = 0; i < 3; i++) add(head, ribG, rib, 0, 0, 0, 1.01, 0.87, 1, 0, (i * PI) / 3);
      const gold = metal(0xffc533);
      add(head, cyl(0.22, 0.26, 0.1, 12), gold, 0, 0.44, 0);
      add(head, cyl(0.26, 0.22, 0.1, 12), gold, 0, -0.44, 0);
      add(head, cone(0.07, 0.18, 8), std(0xd23f3f), 0, -0.58, 0, 1, 1, 1, PI);
      face(head, 0, 0.02, 0.46, 1, { eye: 0x7a2a10 });
      rope = ropeMesh("rope", 0xd23f3f, 0.025);
      cloud(top, 0xfff3e6, 0.9);
      break;
    }
    case "anchor": {
      const blue = std(0x3f78c8, { roughness: 0.45 }), gold = metal(0xffc533);
      add(head, cyl(0.08, 0.08, 0.8, 10), blue, 0, 0, 0);
      add(head, tor(0.12, 0.04, 6, 12), gold, 0, 0.5, 0);
      add(head, capsule(0.065, 0.75, 8), gold, 0, 0.3, 0, 1, 1, 1, PI / 2);
      add(head, tor(0.4, 0.1, 6, 14, PI), blue, 0, 0, 0, 1, 1, 1.4, 0, 0, PI);
      for (const k of [-1, 1]) add(head, cone(0.15, 0.3, 8), blue, k * 0.4, 0.12, 0, 1, 1, 0.6, 0, 0, -k * 0.2);
      add(head, sph(0.14, 10, 8), blue, 0, -0.4, 0);
      face(head, 0, 0.05, 0.08, 0.5, { cheeks: false });
      rope = ropeMesh("chain", 0x9aa6b8, 0.05);
      cloud(top, 0xffffff, 0.9);
      add(top, rbox(1.0, 0.3, 0.45, 0.1), std(0xe8504f), 0, 0.72, 0);
      add(top, cyl(0.03, 0.03, 0.7, 6), std(0x8a5a3a), 0, 1.1, 0);
      add(top, cone(0.26, 0.55, 3), std(0xffffff), 0.14, 1.12, 0, 1, 1, 0.2);
      break;
    }
    case "icicle": {
      const ice = std(0xbfeaff, { roughness: 0.15, metalness: 0.1, emissive: 0x4a90c0, emissiveIntensity: 0.25 });
      add(head, sph(0.5, 14, 9), std(0xf4fbff, { roughness: 0.85 }), 0, 0.2, 0, 1, 0.5, 0.95);
      for (const [x, z, r, h] of [[0, 0, 0.26, 0.75], [0.28, 0.12, 0.17, 0.55], [-0.28, 0.12, 0.17, 0.55], [0, -0.26, 0.18, 0.5], [0.2, 0.3, 0.12, 0.4], [-0.2, 0.3, 0.12, 0.4], [0.3, -0.2, 0.12, 0.38], [-0.3, -0.2, 0.12, 0.38]]) {
        add(head, cone(r, h, 8), ice, x, 0.2 - h / 2, z, 1, 1, 1, PI);
      }
      face(head, 0, 0.24, 0.47, 0.9);
      rope = ropeMesh("rope", 0xe8d2a8);
      cloud(top, 0xe6f4ff, 0.9);
      break;
    }
    case "bell": {
      const gold = metal(0xffc533, { side: THREE.DoubleSide });
      add(head, lathe([[0.001, 0.36], [0.14, 0.35], [0.24, 0.28], [0.28, 0.12], [0.31, -0.08], [0.4, -0.28], [0.5, -0.4], [0.52, -0.46], [0.47, -0.46], [0.36, -0.36]], 16), gold);
      add(head, tor(0.5, 0.035, 6, 20), metal(0xe0a020), 0, -0.42, 0, 1, 1, 1, PI / 2);
      add(head, sph(0.11, 10, 8), std(0x7a4a2a), 0, -0.42, 0);
      const red = std(0xe8504f);
      for (const k of [-1, 1]) add(head, sph(0.1, 8, 6), red, k * 0.11, 0.38, 0, 1.3, 0.8, 0.5, 0, 0, k * 0.3);
      add(head, sph(0.06, 8, 6), red, 0, 0.38, 0);
      face(head, 0, -0.06, 0.33, 0.9);
      rope = ropeMesh("rope", 0xe8d2a8);
      cloud(top, 0xffffff, 0.9);
      break;
    }
    default: {
      // the classic clay mallet
      const red = std(0xe8504f, { roughness: 0.5 }), cream = std(0xfff1d6), dark = std(0xd23f3f);
      add(head, cyl(R, R, H * 2, 20), red, 0, 0, 0, 1, 1, 1, PI / 2);
      for (const z of [-0.3, 0.3]) add(head, tor(R + 0.01, 0.045, 6, 20), cream, 0, 0, z);
      const capG = hemi(R * 0.98, 18, 6);
      add(head, capG, dark, 0, 0, H, 1, 0.25, 1, PI / 2);
      add(head, capG, dark, 0, 0, -H, 1, 0.25, 1, -PI / 2);
      add(head, cyl(0.08, 0.08, 0.5, 8), std(0xc89a6a), 0, 0.62, 0);
      face(head, 0, 0.05, H + 0.11, 1.2);
      rope = ropeMesh("rope", 0xe8d2a8, 0.035);
      cloud(top, 0xffffff, 0.9);
    }
  }
  // default pose (hanging straight down) — the renderer overrides these every frame
  head.position.set(0, MALLET_PIVOT_Y - MALLET_LEN, 0);
  rope.position.set(0, (MALLET_PIVOT_Y + head.position.y) / 2, 0);
  rope.scale.y = MALLET_LEN - 0.3;
  top.position.set(0, MALLET_PIVOT_Y + 0.2, 0);
  group.add(rope, head, top);
  return { group, head, rope, top };
}

// ---------------------------------------------------------------- H02 spinners
export function spinnerView(skin: string, arms: number, len: number): SpinnerView {
  const group = new THREE.Group(), spin = grp(group);
  const n = Math.max(1, Math.round(arms));
  const C = DAISY_CORE_R, L = Math.max(0.3, len - C), mid = (C + len) / 2;
  /** build one arm along +x, `n` times evenly around the spin */
  const each = (build: (a: THREE.Group, i: number) => void) => {
    for (let i = 0; i < n; i++) { const a = grp(spin); a.rotation.y = (i / n) * TAU; build(a, i); }
  };
  switch (skin) {
    case "windmill": {
      const wood = std(0x9a6b45), cloth = std(0xf2e6d0, { roughness: 0.8 });
      each((a) => {
        add(a, box(L + 0.2, 0.1, 0.1), wood, mid + 0.1, 0.3, 0);
        const sail = grp(a, mid + 0.12, 0.3, 0.04);
        sail.rotation.x = 0.35;
        add(sail, rbox(L, 0.06, 0.34, 0.03), cloth);
        for (let k = 0; k <= 3; k++) add(sail, box(0.04, 0.08, 0.36), wood, -L / 2 + (k * L) / 3, 0, 0);
        add(sail, box(L, 0.08, 0.04), wood, 0, 0, 0.17);
      });
      add(group, cyl(C * 0.92, C, 0.44, 16), std(0xfff1d6), 0, 0.22, 0);
      add(group, cone(C * 1.02, 0.3, 16), std(0xe8504f), 0, 0.59, 0);
      add(group, rbox(0.2, 0.26, 0.08, 0.04), std(0x9a6b45), 0, 0.13, C * 0.95);
      face(group, 0, 0.33, C * 0.97, 0.8, { smile: false });
      break;
    }
    case "door": {
      const frame = std(0x9a6b45), glass = std(0xbfe8ff, { roughness: 0.15, metalness: 0.1, emissive: 0x335577, emissiveIntensity: 0.2 });
      each((a) => {
        add(a, rbox(L + 0.12, 0.5, 0.2, 0.06), frame, mid + 0.06, 0.27, 0);
        add(a, box(L * 0.72, 0.3, 0.22), glass, mid + 0.04, 0.29, 0);
        add(a, sph(0.05, 8, 6), metal(0xffc533), len - 0.05, 0.3, 0, 1, 1, 2.6);
      });
      add(group, cyl(C, C, 0.5, 18), std(0x7a4f30), 0, 0.25, 0);
      add(group, cyl(C * 0.62, C * 0.75, 0.1, 18), metal(0xffc533), 0, 0.55, 0);
      face(group, 0, 0.28, C + 0.01, 0.9);
      break;
    }
    case "broom": {
      const stick = std(0xc8915a), straw = std(0xe8c46a, { roughness: 0.85 }), band = std(0xe8504f);
      each((a) => {
        const hl = Math.max(0.1, L - 0.42);
        add(a, cyl(0.13, 0.13, hl + 0.1, 8), stick, C + hl / 2, 0.3, 0, 1, 1, 1, 0, 0, PI / 2);
        add(a, cyl(0.15, 0.25, 0.48, 10), straw, len - 0.22, 0.28, 0, 0.8, 1, 1, 0, 0, PI / 2);
        add(a, tor(0.155, 0.04, 5, 12), band, len - 0.44, 0.29, 0, 0.85, 1, 1, 0, PI / 2);
      });
      add(group, cyl(C, C * 0.82, 0.5, 16), std(0x46a0ff), 0, 0.25, 0);
      add(group, tor(C, 0.045, 6, 20), std(0x2f7fdc), 0, 0.5, 0, 1, 1, 1, PI / 2);
      const foam = std(0xffffff, { roughness: 0.9 });
      add(group, cyl(C * 0.94, C * 0.94, 0.04, 16), foam, 0, 0.47, 0);
      for (const [x, z, r] of [[0.15, 0.1, 0.12], [-0.18, -0.05, 0.1], [0.02, -0.2, 0.09]]) add(group, sph(r, 8, 6), foam, x, 0.5, z);
      face(group, 0, 0.24, C * 0.92, 0.9);
      break;
    }
    case "top": {
      const cols = [0xff6f91, 0xffc93c, 0x46a0ff, 0x6cd24a];
      const white = std(0xffffff);
      add(spin, lathe([[0.001, 0.0], [0.12, 0.03], [0.4, 0.2], [C, 0.3], [0.5, 0.38], [0.3, 0.46], [0.1, 0.5], [0.001, 0.5]], 18), std(0xff6f91, { roughness: 0.45 }));
      add(spin, tor(0.51, 0.035, 6, 22), white, 0, 0.32, 0, 1, 1, 1, PI / 2);
      add(spin, cyl(0.05, 0.06, 0.18, 8), std(0xffc93c), 0, 0.58, 0);
      add(spin, sph(0.075, 10, 8), std(0xffc93c), 0, 0.68, 0);
      face(spin, 0, 0.47, 0.12, 0.8, { up: true });
      each((a, i) => {
        const m = std(cols[(i + 1) % cols.length], { roughness: 0.45 });
        add(a, capsule(0.17, Math.max(0.05, L - 0.2), 10), m, mid + 0.02, 0.3, 0, 1, 1, 0.82, 0, 0, PI / 2);
        for (let x = C + 0.25; x < len - 0.1; x += 0.3) add(a, tor(0.165, 0.035, 4, 12), white, x, 0.3, 0, 1, 1, 0.82, 0, PI / 2);
      });
      break;
    }
    case "mixer": {
      const steel = metal(0xd0d8e8), grip = std(0xe8504f);
      add(group, lathe([[0.001, 0.02], [0.3, 0.03], [0.45, 0.15], [0.53, 0.4], [0.56, 0.47], [0.5, 0.47], [0.47, 0.4]], 18), std(0x7fb6ff, { side: THREE.DoubleSide }));
      add(group, cyl(0.47, 0.47, 0.04, 18), std(0xfff1d6, { roughness: 0.8 }), 0, 0.38, 0);
      face(group, 0, 0.22, 0.5, 0.85);
      each((a) => {
        const hl = Math.min(0.45, L * 0.35), lb = Math.max(0.2, len + 0.1 - (C + hl));
        add(a, cyl(0.13, 0.13, hl, 8), grip, C + hl / 2, 0.3, 0, 1, 1, 1, 0, 0, PI / 2);
        const loopG = tor(1, 0.14, 4, 20);
        for (let k = 0; k < 4; k++) add(a, loopG, steel, C + hl + lb / 2, 0.3, 0, lb / 2, 0.2, 0.2, (k * PI) / 4);
      });
      break;
    }
    case "fan": {
      add(group, cyl(C, C, 0.3, 18), std(0x7fd6ff), 0, 0.15, 0);
      add(group, hemi(C * 0.8, 16, 6), std(0xffffff), 0, 0.3, 0);
      face(group, 0, 0.17, C + 0.01, 0.8);
      const blade = std(0x7fd6ff, { roughness: 0.45 }), tipM = std(0xffffff), bladeG = sph(1, 12, 8);
      each((a) => {
        add(a, bladeG, blade, mid + 0.08, 0.32, 0, (L + 0.25) / 2, 0.07, 0.25, 0.3);
        add(a, bladeG, tipM, len - 0.05, 0.32, 0, 0.16, 0.075, 0.2, 0.3);
      });
      add(spin, sph(0.16, 10, 8), std(0xff6f91), 0, 0.5, 0);
      break;
    }
    case "starfish": {
      const orange = std(0xff8a5c, { roughness: 0.55 }), dot = std(0xffe0c8);
      add(spin, sph(C + 0.05, 16, 9), orange, 0, 0.22, 0, 1, 0.42, 1);
      face(spin, 0, 0.44, 0.08, 1, { up: true });
      each((a) => {
        add(a, cyl(0.13, 0.27, L + 0.1, 10), orange, C + (L + 0.1) / 2 - 0.1, 0.24, 0, 0.62, 1, 1, 0, 0, -PI / 2);
        add(a, sph(0.14, 10, 8), orange, len + 0.02, 0.24, 0, 1, 0.62, 1);
        for (let x = C + 0.15; x < len - 0.05; x += 0.28) add(a, sph(0.04, 6, 4), dot, x, 0.24 + 0.16 * (1 - (x - C) / (L + 0.1)) + 0.06, 0);
      });
      break;
    }
    case "gear": {
      const steel = metal(0x9aa6b8), yellow = std(0xffc93c);
      add(spin, cyl(C * 0.9, C * 0.9, 0.42, 18), steel, 0, 0.25, 0);
      const toothG = box(0.14, 0.4, 0.14);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; add(spin, toothG, steel, Math.cos(a) * C * 0.92, 0.25, Math.sin(a) * C * 0.92, 1, 1, 1, 0, -a); }
      add(spin, cyl(0.2, 0.2, 0.48, 6), yellow, 0, 0.26, 0);
      face(spin, 0, 0.5, 0.02, 0.7, { up: true, cheeks: false });
      each((a) => {
        add(a, rbox(L + 0.1, 0.32, 0.34, 0.06), steel, mid, 0.3, 0);
        const tg = box(0.12, 0.26, 0.1);
        for (let x = C + 0.15; x < len; x += 0.3) for (const z of [-0.19, 0.19]) add(a, tg, steel, x, 0.3, z);
        add(a, cyl(0.19, 0.19, 0.34, 12), yellow, len, 0.3, 0);
      });
      break;
    }
    case "propeller": {
      const red = std(0xe8504f, { roughness: 0.45 });
      add(spin, cyl(C, C, 0.22, 18), red, 0, 0.11, 0);
      add(spin, cone(C * 0.85, 0.42, 18), std(0xffffff), 0, 0.43, 0);
      add(spin, tor(C * 0.86, 0.04, 6, 20), red, 0, 0.23, 0, 1, 1, 1, PI / 2);
      const wood = std(0xd9a066, { roughness: 0.5 }), bladeG = sph(1, 12, 8);
      each((a) => {
        add(a, bladeG, wood, mid + 0.05, 0.3, 0, (L + 0.2) / 2, 0.08, 0.22, 0.45);
        add(a, bladeG, red, len - 0.08, 0.3, 0, 0.2, 0.09, 0.22, 0.45);
      });
      break;
    }
    default: {
      // the clay daisy
      const petal = sph(1, 16, 9), pm = std(0xffffff, { roughness: 0.55 }), tip = std(0xff8ac8, { roughness: 0.55 });
      each((a) => {
        add(a, petal, pm, (len + 0.15) / 2, 0.3, 0, (len + 0.15) / 2, 0.17, 0.23);
        add(a, petal, tip, len - 0.12, 0.31, 0, 0.24, 0.17, 0.22);
      });
      add(group, cyl(C, C * 1.05, 0.42, 20), std(0xffc93c, { roughness: 0.5 }), 0, 0.21, 0);
      face(group, 0, 0.43, 0.05, 1.1, { up: true });
    }
  }
  return { group, spin };
}

// ---------------------------------------------------------------- H05 / H31 droppers
// Built standing on y = 0 (the slammed pose), spanning x ∈ [−w/2, w/2], about 0.95 deep.
// setOpen(k): 1 = open / in the air (jaws open, stretched), 0 = slammed shut (squashed).
function hazardStripes(len: number) {
  const [c, x] = canvas(64, 16);
  x.fillStyle = "#ffc93c"; x.fillRect(0, 0, 64, 16);
  x.fillStyle = "#2a2a3a";
  for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * 16, 16); x.lineTo(i * 16 + 8, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 16); x.fill(); }
  const t = texOf(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = Math.max(1, Math.round(len * 3));
  return t;
}
function star(outer: number, inner: number, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = PI / 2 + (i / (points * 2)) * TAU;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
const squash = (o: THREE.Object3D, k: number, amt = 0.12) => { const q = 1 - clamp01(k); o.scale.set(1 + amt * 0.5 * q, 1 - amt * q, 1 + amt * 0.5 * q); };

export function dropperView(skin: string, w: number): DropperView {
  const group = new THREE.Group();
  const W = Math.max(0.9, w * 0.96);
  let setOpen: (k: number) => void = () => {};
  switch (skin) {
    case "claw": {
      const o = makeClaw();
      o.group.scale.setScalar(Math.max(0.55, (w + 0.3) / 2.8));
      group.add(o.group);
      setOpen = (k) => { o.upper.rotation.z = 0.5 * k; o.lower.rotation.z = -0.5 * k; };
      break;
    }
    case "stomper": {
      const teal = std(0x1e9c91, { roughness: 0.5 }), yellow = std(0xffc93c), grey = metal(0xc8d0dc);
      const foot = grp(group);
      add(foot, rbox(W, 0.5, 0.95, 0.16), teal, 0, 0.25, -0.02);
      add(foot, box(W * 0.9, 0.03, 0.02), std(0x0e6a62), 0, 0.42, 0.455);
      const toes = grp(foot, 0, 0.1, 0.25);
      const nt = Math.max(3, Math.round(W / 0.36)), toeG = sph(0.16, 10, 8);
      for (let i = 0; i < nt; i++) add(toes, toeG, grey, (i - (nt - 1) / 2) * ((W - 0.3) / Math.max(1, nt - 1)), 0.02, 0.22, 1, 0.75, 1);
      for (const s of [-1, 1]) add(foot, sph(0.05, 8, 6), yellow, s * (W / 2 + 0.005), 0.28, 0.1, 0.4, 1, 1);
      add(group, cyl(0.3, 0.34, 0.4, 14), grey, 0, 0.68, -0.05);
      add(group, cyl(0.24, 0.24, 2.4, 14), teal, 0, 2.05, -0.05);
      add(group, sph(0.32, 12, 9), yellow, 0, 3.2, -0.05);
      add(group, sph(0.08, 8, 6), glow(0x7ffcff, 1.4), 0, 0.72, 0.27);
      setOpen = (k) => { toes.rotation.x = -0.5 * clamp01(k); squash(foot, k, 0.1); };
      break;
    }
    case "book": {
      const D = 0.95, purple = std(0x7a5cff), pages = std(0xfff6e0, { roughness: 0.85 }), gold = metal(0xffc533);
      add(group, rbox(W, 0.1, D, 0.04), purple, 0, 0.05, 0);
      add(group, box(W - 0.08, 0.42, D - 0.1), pages, 0, 0.31, -0.03);
      add(group, cyl(0.27, 0.27, W, 14), purple, 0, 0.31, D / 2 - 0.27, 1, 1, 1, 0, 0, PI / 2);
      const bandG = tor(0.272, 0.03, 4, 18);
      for (const s of [-1, 1]) add(group, bandG, gold, s * W * 0.36, 0.31, D / 2 - 0.27, 1, 1, 1, 0, PI / 2);
      face(group, 0, 0.31, D / 2 + 0.005, 0.9);
      const cover = grp(group, 0, 0.56, D / 2 - 0.12);
      add(cover, rbox(W, 0.1, D, 0.04), purple, 0, 0, -D / 2 + 0.12);
      add(cover, ext(star(0.16, 0.07), 0.03, 0.01, 4), gold, 0, 0.06, -D / 2 + 0.1, 1, 1, 1, -PI / 2);
      setOpen = (k) => { cover.rotation.x = 0.55 * clamp01(k); };
      break;
    }
    case "rock": {
      const stone = std(0x9a8a7a, { roughness: 0.85 }), moss = std(0x6cb84a, { roughness: 0.9 });
      const body = grp(group);
      add(body, new THREE.DodecahedronGeometry(1, 1), stone, 0, 0.44, 0, W / 2, 0.45, 0.48);
      for (const x of lanes(w)) add(body, ico(0.26, 1), stone, x * 0.9, 0.7, -0.12, 1, 0.8, 1);
      add(body, sph(0.2, 10, 6), moss, -W * 0.2, 0.86, -0.05, 1.4, 0.35, 1.1);
      add(body, sph(0.14, 10, 6), moss, W * 0.25, 0.8, 0.1, 1.3, 0.35, 1);
      face(body, 0, 0.46, 0.47, 1, { smile: false });
      setOpen = (k) => squash(body, k, 0.1);
      break;
    }
    case "lightning": {
      const cs = Math.max(0.4, W * 0.3);
      cloud(group, 0x8a94b8, cs, 0, 2.9, 0);
      face(group, 0, 2.85, cs + 0.02, cs * 1.6, { smile: false });
      const zig = new THREE.Shape();
      zig.moveTo(-0.1, 2.6); zig.lineTo(0.3, 2.6); zig.lineTo(0.08, 1.6); zig.lineTo(0.32, 1.6);
      zig.lineTo(-0.1, 0); zig.lineTo(0, 1.2); zig.lineTo(-0.26, 1.2); zig.closePath();
      const boltM = glow(0xfff27a, 1.8), boltG = ext(zig, 0.18, 0.04, 2), zapG = ext(star(0.46, 0.2, 8), 0.04, 0.02, 2);
      const zaps: THREE.Object3D[] = [];
      for (const x of lanes(w)) {
        add(group, boltG, boltM, x, 0, 0);
        zaps.push(add(group, zapG, glow(0xffe65a, 1.4), x, 0.04, 0, 1, 1, 1, -PI / 2));
      }
      setOpen = (k) => { const s = 0.35 + 0.75 * (1 - clamp01(k)); for (const z of zaps) z.scale.set(s, s, 1); };
      break;
    }
    case "firework": {
      const R = Math.min(0.48, W / 2);
      const shell = grp(group);
      add(shell, sph(R, 14, 10), std(0xff5dc8, { roughness: 0.45 }), 0, R, 0);
      const white = std(0xffffff);
      add(shell, tor(R, 0.045, 5, 20), white, 0, R, 0, 1, 1, 1, PI / 2);
      add(shell, tor(R, 0.04, 5, 20), std(0xffc93c), 0, R, 0);
      add(shell, cyl(0.03, 0.03, 0.3, 6), std(0x8a5a3a), 0, 2 * R + 0.12, 0);
      add(shell, sph(0.08, 8, 6), glow(0xffd84d, 2), 0, 2 * R + 0.28, 0);
      face(shell, 0, R, R + 0.005, 0.9);
      // the burst sprays up and out like a fountain of sparks, staying over the slammed lanes
      const burst = grp(group, 0, R, 0), rayG = cone(0.08, 0.4, 8), cols = [0xff5dc8, 0xffd84d, 0x7fd6ff, 0x9be34a];
      const rayMs = cols.map((c) => glow(c, 1.5));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, r = R * 0.7;
        const ray = add(burst, rayG, rayMs[i % 4], Math.cos(a) * r, R * 0.5 + (i % 2) * 0.12, Math.sin(a) * r);
        ray.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize());
      }
      const spread = Math.min(1.4, (W / 2) / (R * 0.7 + 0.3));
      setOpen = (k) => {
        const q = 1 - clamp01(k);
        burst.visible = q > 0.05;
        burst.scale.setScalar(0.4 + q * spread);
        shell.scale.setScalar(1 - 0.25 * q);
      };
      setOpen(1);
      break;
    }
    case "anvil": {
      const iron = metal(0x4a4a5a, { roughness: 0.45 });
      const body = grp(group);
      add(body, rbox(W * 0.6, 0.22, 0.8, 0.06), iron, 0, 0.11, 0);
      add(body, rbox(W * 0.34, 0.3, 0.46, 0.06), iron, 0, 0.37, 0);
      add(body, rbox(W * 0.72, 0.26, 0.85, 0.08), iron, -W * 0.08, 0.64, 0);
      add(body, cone(0.2, W * 0.2, 12), iron, W * 0.38, 0.68, 0, 1, 1, 0.9, 0, 0, -PI / 2);
      face(body, -W * 0.05, 0.62, 0.43, 0.9);
      setOpen = (k) => squash(body, k, 0.08);
      break;
    }
    case "jelly": {
      const jel = std(0xff6fae, { roughness: 0.22, transparent: true, opacity: 0.88, emissive: 0xff3d8a, emissiveIntensity: 0.15 });
      const body = grp(group);
      add(body, rbox(W, 0.72, 0.9, 0.2, 3), jel, 0, 0.36, 0);
      const cream = std(0xffffff, { roughness: 0.8 }), cherry = std(0xe8304f, { roughness: 0.35 });
      for (const x of lanes(w)) {
        add(body, sph(0.2, 12, 8), cream, x * 0.9, 0.76, 0, 1, 0.6, 1);
        add(body, sph(0.08, 10, 8), cherry, x * 0.9, 0.92, 0);
        add(body, cyl(0.012, 0.012, 0.14, 4), std(0x3f9e3a), x * 0.9 + 0.03, 1.02, 0, 1, 1, 1, 0, 0, -0.4);
      }
      face(body, 0, 0.4, 0.455, 1);
      setOpen = (k) => squash(body, k, 0.28);
      break;
    }
    case "meteor": {
      const rock = std(0x6a4a3a, { roughness: 0.9 }), lava = glow(0xff7a3d, 1.4);
      const trailM = glow(0xffc04d, 1.2);
      trailM.transparent = true; trailM.opacity = 0.65;
      const trails: THREE.Object3D[] = [];
      for (const x of lanes(w)) {
        const m = grp(group, x, 0, 0);
        add(m, new THREE.DodecahedronGeometry(0.46, 1), rock, 0, 0.46, 0);
        for (const [a, b] of [[0.5, 0.3], [2.2, 0.6], [3.9, 0.2], [5.1, 0.75]]) add(m, ico(0.08, 0), lava, Math.cos(a) * 0.4, 0.46 + b * 0.35 - 0.1, Math.sin(a) * 0.4);
        face(m, 0, 0.5, 0.44, 0.8);
        const tr = grp(m, 0, 0.6, 0);
        add(tr, cone(0.4, 1.6, 10), trailM, 0, 0.9, -0.05);
        add(tr, cone(0.24, 1.1, 10), lava, 0, 0.62, -0.05);
        trails.push(tr);
      }
      setOpen = (k) => { const s = 0.35 + 0.65 * clamp01(k); for (const t of trails) t.scale.set(1, s, 1); };
      break;
    }
    case "piston": {
      const pad = grp(group);
      add(pad, rbox(W, 0.45, 0.95, 0.12), std(0xe8504f), 0, 0.225, 0);
      add(pad, rbox(W * 0.7, 0.18, 0.7, 0.06), metal(0xa0a8b8), 0, 0.52, 0);
      face(pad, 0, 0.23, 0.48, 0.9);
      add(group, cyl(0.2, 0.2, 2.6, 12), metal(0xd8dee8), 0, 1.9, 0);
      const ringG = tor(0.21, 0.04, 5, 14);
      for (const y of [1.2, 2.0, 2.8]) add(group, ringG, metal(0xa0a8b8), 0, y, 0, 1, 1, 1, PI / 2);
      add(group, cyl(0.38, 0.38, 0.9, 14), metal(0xa0a8b8), 0, 3.5, 0);
      setOpen = (k) => squash(pad, k, 0.18);
      break;
    }
    case "crusher":
    default: {
      const block = grp(group);
      add(block, rbox(W, 0.75, 0.95, 0.1), metal(0x7a8496, { metalness: 0.2 }), 0, 0.375, 0);
      add(block, new THREE.PlaneGeometry(W - 0.14, 0.16), std(0xffffff, { map: hazardStripes(W) }), 0, 0.12, 0.476);
      face(block, 0, 0.47, 0.478, 1);
      for (const px of [-W * 0.3, W * 0.3]) add(group, cyl(0.1, 0.1, 2.6, 10), metal(0xc8d0dc), px, 2.05, 0);
      add(group, rbox(W * 0.9, 0.5, 0.8, 0.1), metal(0x4a5262), 0, 3.4, 0);
      setOpen = (k) => squash(block, k, 0.12);
    }
  }
  return { group, setOpen };
}

// ---------------------------------------------------------------- H04 / H07 sliders
// `w` lanes wide (centred on x = 0), ≤ 0.9 deep, ~0.95 tall — the hit box is ±0.42 rows deep and 0.95 high.
function sawShape(R: number, teeth: number) {
  const s = new THREE.Shape(), step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step, a1 = a0 + step * 0.7;
    if (i === 0) s.moveTo(Math.cos(a0) * R * 0.8, Math.sin(a0) * R * 0.8); else s.lineTo(Math.cos(a0) * R * 0.8, Math.sin(a0) * R * 0.8);
    s.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
  }
  s.closePath();
  return s;
}
function crateTexture() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = "#d39a5e"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "rgba(120,70,30,0.35)";
  for (const y of [40, 72, 104]) x.fillRect(0, y, 128, 3);
  x.strokeStyle = "#8a5a3a"; x.lineWidth = 16; x.strokeRect(8, 8, 112, 112);
  x.lineWidth = 14; x.beginPath(); x.moveTo(14, 114); x.lineTo(114, 14); x.stroke();
  x.fillStyle = "#5a3a20";
  for (const [px, py] of [[8, 8], [120, 8], [8, 120], [120, 120]]) { x.beginPath(); x.arc(px, py, 3.5, 0, TAU); x.fill(); }
  return texOf(c);
}
/** a 0..1 bump on every beat (for idle pulses) */
const kick = (beat: number) => Math.pow(1 - (((beat % 1) + 1) % 1), 3);

export function sliderView(skin: string, w: number): SliderView {
  const group = new THREE.Group();
  const W = Math.max(0.7, w - 0.08);
  let tick: SliderView["tick"];
  // sideways speed from the renderer moving group.position.x — turns wheels / rolls balls the right way
  let lastX = NaN;
  const dx = () => {
    const x = group.position.x, d = Number.isNaN(lastX) ? 0 : x - lastX;
    lastX = x;
    return Math.abs(d) > 2 ? 0 : d;
  };
  switch (skin) {
    case "crystal": {
      add(group, rbox(W, 0.2, 0.8, 0.08), std(0x8a7a8a, { roughness: 0.9 }), 0, 0.1, 0);
      const gem = std(0x8affea, { roughness: 0.15, metalness: 0.1, emissive: 0x2ad0c0, emissiveIntensity: 0.35 });
      const gem2 = std(0xc49bff, { roughness: 0.15, metalness: 0.1, emissive: 0x8a5ae0, emissiveIntensity: 0.35 });
      const crystal = (x: number, z: number, h: number, r: number, tz: number, tx: number, m: Mat) => {
        const c = grp(group, x, 0.15, z);
        c.rotation.set(tx, 0, tz);
        add(c, cyl(r, r * 1.1, h, 6), m, 0, h / 2, 0);
        add(c, cone(r, r * 1.5, 6), m, 0, h + r * 0.75, 0);
      };
      for (const x of lanes(w)) {
        crystal(x, 0, 0.5, 0.2, 0, 0, gem);
        crystal(x - 0.25, 0.1, 0.35, 0.14, 0.4, 0.1, gem2);
        crystal(x + 0.27, -0.1, 0.3, 0.13, -0.45, -0.1, gem);
        crystal(x + 0.05, -0.24, 0.36, 0.15, 0.1, -0.35, gem2);
        crystal(x - 0.05, 0.25, 0.25, 0.12, -0.15, 0.4, gem2);
      }
      tick = (_t, beat) => { const p = kick(beat); gem.emissiveIntensity = 0.3 + 0.4 * p; gem2.emissiveIntensity = 0.3 + 0.4 * p; };
      break;
    }
    case "toycar": {
      const blue = std(0x46a0ff, { roughness: 0.45 }), light = std(0xbfe8ff, { roughness: 0.2 }), tyre = std(0x2a2a3a), hub = std(0xffffff);
      add(group, rbox(W * 0.95, 0.38, 0.72, 0.12), blue, 0, 0.36, 0);
      add(group, rbox(W * 0.5, 0.34, 0.62, 0.1), std(0xff6f91, { roughness: 0.45 }), -W * 0.08, 0.7, 0);
      for (const z of [-0.315, 0.315]) add(group, box(W * 0.36, 0.18, 0.01), light, -W * 0.08, 0.72, z);
      const fg = grp(group, -W * 0.08 + W * 0.25 + 0.005, 0.72, 0);
      fg.rotation.y = PI / 2;
      face(fg, 0, 0, 0, 0.8);
      for (const z of [-0.2, 0.2]) add(group, sph(0.06, 8, 6), glow(0xfff27a, 1.2), W * 0.475, 0.4, z);
      const wheels: THREE.Group[] = [];
      const tyreG = cyl(0.17, 0.17, 0.12, 14), hubG = cyl(0.07, 0.07, 0.13, 8);
      for (const x of [-W * 0.3, W * 0.3]) for (const z of [-0.33, 0.33]) {
        const wg = grp(group, x, 0.17, z);
        add(wg, tyreG, tyre, 0, 0, 0, 1, 1, 1, PI / 2);
        add(wg, hubG, hub, 0, 0, 0, 1, 1, 1, PI / 2);
        add(wg, box(0.05, 0.2, 0.135), hub);
        wheels.push(wg);
      }
      const key = grp(group, -W * 0.475 - 0.02, 0.48, 0);
      const gold = metal(0xffc533);
      add(key, cyl(0.03, 0.03, 0.12, 6), gold, -0.04, 0, 0, 1, 1, 1, 0, 0, PI / 2);
      for (const s of [-1, 1]) add(key, tor(0.08, 0.03, 5, 12), gold, -0.1, s * 0.09, 0, 1, 1, 1, 0, PI / 2);
      tick = (t) => {
        const d = dx();
        for (const wg of wheels) wg.rotation.z -= d / 0.17;
        key.rotation.x = t * 5;
      };
      break;
    }
    case "penguin": {
      const navy = std(0x2e3f78), white = std(0xffffff), orange = std(0xff9a3d), red = std(0xe8304f), ball = sph(1, 14, 10);
      const L = W / 2;
      add(group, ball, navy, -0.04, 0.3, 0, L - 0.04, 0.3, 0.36);
      add(group, ball, white, 0, 0.24, 0, L - 0.08, 0.24, 0.33);
      const hx = L - 0.25;
      add(group, sph(0.27, 14, 10), navy, hx, 0.62, 0);
      add(group, sph(0.2, 12, 9), white, hx + 0.09, 0.6, 0.06, 0.8, 0.95, 1);
      add(group, cone(0.06, 0.14, 8), orange, hx + 0.3, 0.58, 0, 1, 1, 1, 0, 0, -PI / 2);
      const fg = grp(group, hx + 0.19, 0.68, 0.19);
      fg.rotation.y = PI / 4;
      face(fg, 0, 0, 0, 0.7);
      add(group, tor(0.22, 0.07, 6, 14), red, hx - 0.17, 0.5, 0, 1, 1, 1, 0, PI / 2, 0.4);
      const tail = grp(group, hx - 0.25, 0.62, 0.14);
      add(tail, rbox(0.34, 0.05, 0.12, 0.02), red, -0.17, 0, 0);
      for (const s of [-1, 1]) add(group, sph(0.15, 10, 8), navy, 0.02, 0.38, s * 0.36, 1.4, 0.3, 0.55, s * 0.3);
      for (const s of [-1, 1]) add(group, sph(0.1, 8, 6), orange, -L + 0.08, 0.3, s * 0.12, 0.8, 0.3, 0.5, 0, 0, 0.4);
      tick = (t) => { tail.rotation.z = 0.35 + Math.sin(t * 14) * 0.25; tail.rotation.y = Math.sin(t * 9) * 0.3; };
      break;
    }
    case "noodle": {
      const tan = std(0xd49452), brown = std(0x7a4a2a), dark = std(0x2a1a3a);
      const bodyLen = Math.max(0.1, W - 0.9);
      add(group, capsule(0.33, bodyLen, 12), tan, 0, 0.5, 0, 1, 1, 1, 0, 0, PI / 2);
      for (let x = -bodyLen / 2 + 0.1; x < bodyLen / 2; x += 0.55) add(group, sph(0.14, 10, 6), brown, x, 0.8, 0.05, 1.3, 0.3, 1.1);
      const hx = W / 2 - 0.38;
      add(group, sph(0.28, 14, 10), tan, hx, 0.66, 0);
      add(group, sph(0.16, 10, 8), std(0xe8b47a), hx + 0.24, 0.58, 0, 1.3, 0.85, 1);
      add(group, sph(0.06, 8, 6), dark, hx + 0.44, 0.62, 0);
      for (const s of [-1, 1]) add(group, sph(0.14, 10, 8), brown, hx - 0.04, 0.6, s * 0.27, 0.6, 1.3, 0.3, s * 0.3);
      const fg = grp(group, hx + 0.17, 0.74, 0.17);
      fg.rotation.y = PI / 4;
      face(fg, 0, 0, 0, 0.7, { smile: false });
      add(group, tor(0.28, 0.05, 5, 14), std(0xe8304f), hx - 0.22, 0.6, 0, 1, 1, 1, 0, PI / 2, 0.3);
      const legG = cyl(0.08, 0.08, 0.26, 8), pawG = sph(0.1, 8, 6);
      const legXs = [-W / 2 + 0.38, W / 2 - 0.42];
      for (let x = -W / 2 + 1.3; x < W / 2 - 1.2; x += 0.9) legXs.push(x);
      for (const x of legXs) for (const z of [-0.18, 0.18]) { add(group, legG, tan, x, 0.13, z); add(group, pawG, std(0xfff1d6), x + 0.03, 0.04, z, 1.1, 0.5, 1); }
      const tail = grp(group, -W / 2 + 0.16, 0.56, 0);
      add(tail, cyl(0.03, 0.07, 0.36, 8), tan, -0.08, 0.15, 0, 1, 1, 1, 0, 0, 0.5);
      tick = (t) => { tail.rotation.x = Math.sin(t * 14) * 0.6; };
      break;
    }
    case "turbo": {
      const body = std(0xc8e06a), shellM = std(0xff6b3d), cream = std(0xffe6b0), steel = metal(0xc8d0dc), lens = std(0x7fd6ff, { roughness: 0.15 });
      add(group, capsule(0.2, Math.max(0.05, W - 0.4), 10), body, 0, 0.2, 0, 1, 1, 1.5, 0, 0, PI / 2);
      const hx = W / 2 - 0.17;
      add(group, capsule(0.15, 0.26, 8), body, hx - 0.04, 0.4, 0, 1, 1, 1, 0, 0, -0.3);
      add(group, sph(0.19, 12, 9), body, hx, 0.6, 0);
      for (const s of [-1, 1]) {
        add(group, cyl(0.02, 0.025, 0.24, 6), body, hx + 0.02, 0.84, s * 0.08, 1, 1, 1, s * 0.25, 0, -0.3);
        add(group, sph(0.045, 8, 6), body, hx + 0.06, 0.96, s * 0.11);
      }
      const gog = grp(group, hx, 0.62, 0);
      gog.rotation.y = PI / 4;
      add(gog, tor(0.19, 0.025, 4, 18), std(0x6a3a2a), 0, 0, 0, 1, 1, 1, PI / 2);
      for (const s of [-1, 1]) {
        add(gog, tor(0.06, 0.022, 5, 12), steel, s * 0.07, 0.02, 0.18);
        add(gog, cyl(0.055, 0.055, 0.02, 10), lens, s * 0.07, 0.02, 0.185, 1, 1, 1, PI / 2);
      }
      const R = Math.min(0.36, W * 0.36), sx = -W / 2 + R + 0.04;
      add(group, sph(R, 14, 10), shellM, sx, 0.5, 0, 1, 1, 0.85);
      add(group, tor(R * 0.6, 0.05, 5, 16), cream, sx, 0.5, R * 0.8);
      add(group, tor(R * 0.28, 0.04, 5, 12), cream, sx, 0.5, R * 0.86);
      for (const s of [-1, 1]) add(group, cone(0.1, 0.22, 4), shellM, sx - R * 0.1, 0.5 + s * R * 0.75, 0, 1, 1, 0.3, 0, 0, s > 0 ? 0.6 : PI - 0.6);
      const flames: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        add(group, cyl(0.07, 0.1, 0.16, 10), steel, sx - R + 0.02, 0.5 + s * 0.12, 0, 1, 1, 1, 0, 0, PI / 2);
        const f = grp(group, sx - R - 0.06, 0.5 + s * 0.12, 0);
        add(f, cone(0.08, 0.26, 8), glow(0xffa53d, 1.8), -0.13, 0, 0, 1, 1, 1, 0, 0, PI / 2);
        add(f, cone(0.045, 0.16, 6), glow(0xfff27a, 2), -0.08, 0, 0, 1, 1, 1, 0, 0, PI / 2);
        flames.push(f);
      }
      tick = (t) => { flames.forEach((f, i) => f.scale.set(0.8 + 0.35 * Math.abs(Math.sin(t * 31 + i * 2)), 1, 1)); };
      break;
    }
    case "saw": {
      const yellow = std(0xffc93c);
      add(group, rbox(W, 0.2, 0.8, 0.06), yellow, 0, 0.1, 0);
      add(group, box(W * 0.8, 0.02, 0.12), std(0x2a2a3a), 0, 0.205, 0);
      for (const z of [-0.3, 0.3]) add(group, rbox(W, 0.36, 0.08, 0.03), yellow, 0, 0.3, z);
      const blades: THREE.Group[] = [], R = 0.42, sawG = ext(sawShape(R, 14), 0.14, 0.025, 2), steel = metal(0xd0d8e4, { roughness: 0.3 });
      for (const x of lanes(w)) {
        const b = grp(group, x, 0.5, 0);
        add(b, sawG, steel);
        add(b, cyl(0.13, 0.13, 0.22, 14), std(0xe8504f), 0, 0, 0, 1, 1, 1, PI / 2);
        blades.push(b);
        face(group, x, 0.5, 0.115, 0.5, { cheeks: false });
      }
      tick = (t) => { for (const b of blades) b.rotation.z = -t * 9; };
      break;
    }
    case "gloop": {
      const lime = std(0x9be34a, { roughness: 0.25, emissive: 0x3a8a10, emissiveIntensity: 0.12 });
      const blobs: THREE.Group[] = [];
      for (const x of lanes(w)) {
        const b = grp(group, x, 0, 0);
        add(b, cyl(0.44, 0.47, 0.08, 16), lime, 0, 0.04, 0);
        add(b, sph(0.43, 16, 12), lime, 0, 0.45, 0, 1, 1.05, 0.95);
        add(b, sph(0.09, 8, 6), lime, 0.3, 0.32, 0.26, 1, 1.4, 1);
        add(b, rbox(0.11, 0.13, 0.05, 0.02), std(0xffffff, { roughness: 0.3 }), 0.04, 0.33, 0.405, 1, 1, 1, 0.2);
        face(b, 0, 0.56, 0.39, 1.1, { smile: false });
        blobs.push(b);
      }
      tick = (_t, beat) => blobs.forEach((b, i) => { const s = Math.sin((beat + i * 0.25) * TAU * 2) * 0.06; b.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5); });
      break;
    }
    case "cake": {
      const D = 0.8, frost = std(0xff6f91, { roughness: 0.5 }), cream = std(0xfff6e0);
      add(group, rbox(W, 0.32, D, 0.06), std(0xffc0d8), 0, 0.16, 0);
      add(group, box(W - 0.02, 0.06, D - 0.02), cream, 0, 0.35, 0);
      add(group, rbox(W, 0.28, D, 0.06), std(0x7a4a2a), 0, 0.52, 0);
      add(group, rbox(W + 0.02, 0.1, D + 0.02, 0.05), frost, 0, 0.7, 0);
      face(group, 0, 0.5, D / 2 + 0.005, 0.9);
      const dripG = capsule(0.035, 0.08, 6), sprG = capsule(0.012, 0.04, 4), cols = [0xffc93c, 0x7fd6ff, 0x9be34a, 0xffffff];
      lanes(w).forEach((x, li) => {
        for (const d of [-0.3, 0.05, 0.32]) add(group, dripG, frost, x + d, 0.63, D / 2 + 0.005);
        add(group, sph(0.12, 10, 8), cream, x, 0.77, 0, 1, 0.6, 1);
        add(group, sph(0.09, 10, 8), std(0xe8304f, { roughness: 0.35 }), x, 0.86, 0);
        for (let i = 0; i < 6; i++) { const a = i * 1.7 + li; add(group, sprG, std(cols[i % 4]), x + Math.cos(a) * 0.3, 0.755, Math.sin(a) * 0.28, 1, 1, 1, PI / 2, 0, a); }
      });
      break;
    }
    case "pins": {
      const pinG = lathe([[0.001, 0], [0.11, 0.01], [0.16, 0.18], [0.17, 0.3], [0.12, 0.5], [0.07, 0.6], [0.075, 0.68], [0.1, 0.78], [0.09, 0.86], [0.04, 0.9], [0.001, 0.91]], 8);
      const pinM = std(0xffffff, { roughness: 0.35 }), stripeM = std(0xe8304f), stripeG = tor(0.075, 0.02, 4, 10);
      const pins: THREE.Group[] = [];
      for (const x of lanes(w)) for (const [ox, z] of [[-0.21, 0.18], [0.21, 0.18], [0, -0.18]]) {
        const p = grp(group, x + ox, 0, z);
        add(p, pinG, pinM);
        add(p, stripeG, stripeM, 0, 0.64, 0, 1, 1, 1, PI / 2);
        pins.push(p);
      }
      tick = (t) => pins.forEach((p, i) => { p.rotation.z = Math.sin(t * 5 + i * 1.3) * 0.05; });
      break;
    }
    case "hedge": {
      const leaf = std(0x3f9a4a, { roughness: 0.85 }), leaf2 = std(0x52b85a, { roughness: 0.85 }), bumpG = ico(0.14, 1);
      add(group, rbox(W, 0.82, 0.8, 0.16, 3), leaf, 0, 0.41, 0);
      let i = 0;
      for (let x = -W / 2 + 0.15; x <= W / 2 - 0.1; x += 0.28, i++) {
        add(group, bumpG, leaf2, x, 0.82, (i % 2 ? 0.12 : -0.14), 1, 0.7, 1);
        if (i % 2) add(group, bumpG, leaf2, x, 0.2 + (i % 3) * 0.08, 0.38, 0.8, 0.8, 0.5);
      }
      const fl = [std(0xff8ac8), std(0xffd84d)];
      lanes(w).forEach((x, k) => { add(group, sph(0.05, 8, 6), fl[k % 2], x + 0.28, 0.66, 0.405); add(group, sph(0.05, 8, 6), fl[(k + 1) % 2], x - 0.3, 0.3, 0.405); });
      face(group, 0, 0.48, 0.405, 1);
      break;
    }
    case "laserpost": {
      const dark = metal(0x3a3a4a), core = glow(0xff3df0, 1.8), ringG = tor(0.31, 0.045, 5, 16);
      const xs = lanes(w);
      for (const x of xs) {
        add(group, cyl(0.36, 0.38, 0.14, 16), dark, x, 0.07, 0);
        add(group, cyl(0.3, 0.3, 0.68, 16), core, x, 0.48, 0);
        for (const y of [0.3, 0.55]) add(group, ringG, dark, x, y, 0, 1, 1, 1, PI / 2);
        add(group, cyl(0.36, 0.34, 0.14, 16), dark, x, 0.87, 0);
      }
      const beamG = cyl(0.05, 0.05, 1, 6);
      for (let i = 0; i + 1 < xs.length; i++) for (const y of [0.3, 0.6]) add(group, beamG, core, (xs[i] + xs[i + 1]) / 2, y, 0, 1, xs[i + 1] - xs[i], 1, 0, 0, PI / 2);
      tick = (_t, beat) => { core.emissiveIntensity = 1.4 + 1.0 * kick(beat); };
      break;
    }
    case "cannonball": {
      const iron = metal(0x2a2a3a, { roughness: 0.3 }), band = metal(0x5a5a6e), spark = glow(0xffd84d, 2.2);
      const balls: THREE.Group[] = [], sparks: THREE.Object3D[] = [];
      for (const x of lanes(w)) {
        const b = grp(group, x, 0.45, 0);
        add(b, sph(0.45, 16, 12), iron);
        add(b, tor(0.452, 0.035, 4, 24), band, 0, 0, 0, 1, 1, 1, 0, PI / 2);
        add(b, sph(0.08, 8, 6), band, 0.3, 0.25, 0.25);
        balls.push(b);
        add(group, cyl(0.025, 0.03, 0.14, 6), std(0xe8d2a8), x, 0.94, 0, 1, 1, 1, 0, 0, 0.3);
        sparks.push(add(group, sph(0.06, 8, 6), spark, x - 0.04, 1.02, 0));
      }
      tick = (t) => {
        const d = dx();
        for (const b of balls) b.rotation.z -= d / 0.45;
        sparks.forEach((s, i) => s.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 23 + i))));
      };
      break;
    }
    case "crate": {
      const xs = lanes(w), cw = W / xs.length - 0.04;
      xs.forEach((x, i) => {
        const tex = crateTexture();
        add(group, rbox(cw, 0.9, 0.8, 0.05), std(0xffffff, { map: tex, roughness: 0.8 }), x, 0.45, 0, 1, 1, 1, 0, i % 2 ? 0.05 : -0.04);
      });
      break;
    }
    case "ghost": {
      const sheet = std(0xf4f0ff, { roughness: 0.7, emissive: 0xb8a8ff, emissiveIntensity: 0.18 }), dark = std(0x3a2a5a);
      const ghosts: THREE.Group[] = [];
      for (const x of lanes(w)) {
        const gg = grp(group, x, 0.04, 0);
        add(gg, sph(0.36, 16, 10), sheet, 0, 0.52, 0, 1, 1, 0.95);
        add(gg, cyl(0.36, 0.41, 0.38, 16), sheet, 0, 0.3, 0);
        const hemG = sph(0.1, 8, 6);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add(gg, hemG, sheet, Math.cos(a) * 0.36, 0.12, Math.sin(a) * 0.36); }
        for (const s of [-1, 1]) add(gg, sph(0.1, 8, 6), sheet, s * 0.42, 0.42, 0.05, 1.4, 0.7, 0.7, 0, 0, s * 0.5);
        face(gg, 0, 0.6, 0.34, 1, { smile: false });
        add(gg, sph(0.045, 8, 6), dark, 0, 0.47, 0.345, 1, 1.3, 0.5);
        ghosts.push(gg);
      }
      tick = (t) => ghosts.forEach((g, i) => { g.position.y = 0.04 + Math.sin(t * 3 + i) * 0.035; g.rotation.z = Math.sin(t * 2 + i) * 0.06; });
      break;
    }
    case "crab": {
      const red = std(0xe8504f), dark = std(0xc94343), white = std(0xffffff, { roughness: 0.3 }), black = std(0x1a1030, { roughness: 0.3 });
      const claws: THREE.Group[] = [], legs: THREE.Object3D[] = [];
      for (const x of lanes(w)) {
        const c = grp(group, x, 0, 0);
        add(c, sph(0.36, 14, 10), red, 0, 0.36, 0, 1.12, 0.7, 0.9);
        for (const s of [-1, 1]) {
          add(c, cyl(0.03, 0.035, 0.25, 6), red, s * 0.12, 0.66, 0.1);
          add(c, sph(0.08, 10, 8), white, s * 0.12, 0.8, 0.1);
          add(c, sph(0.04, 8, 6), black, s * 0.12, 0.81, 0.17);
          const cl = grp(c, s * 0.36, 0.5, 0.14);
          add(cl, sph(0.12, 10, 8), red, 0, 0.04, 0, 1.2, 0.55, 0.8);
          add(cl, sph(0.1, 10, 8), dark, 0, -0.04, 0, 1.1, 0.5, 0.75);
          cl.userData.s = s;
          claws.push(cl);
          for (const z of [-0.15, 0, 0.15]) legs.push(add(c, cyl(0.025, 0.02, 0.3, 6), dark, s * 0.34, 0.16, z, 1, 1, 1, 0, 0, s * 0.9));
        }
        add(c, tor(0.06, 0.015, 4, 10, PI), black, 0, 0.36, 0.32, 1, 1, 1, 0, 0, PI);
      }
      tick = (t, beat) => {
        const snap = Math.max(0, Math.sin(beat * TAU * 2)) * 0.5;
        for (const cl of claws) cl.rotation.z = (cl.userData.s as number) * (0.2 + snap);
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 16 + i) * 0.25; });
      };
      break;
    }
    case "cart": {
      const wood = std(0x9a6b45), iron = metal(0x5a5a6a);
      const binG = cyl(0.5, 0.38, 0.5, 4);
      binG.rotateY(PI / 4);
      add(group, binG, wood, 0, 0.5, 0, (W / 2) / 0.354, 1, 0.4 / 0.354);
      add(group, rbox(W + 0.04, 0.08, 0.84, 0.03), iron, 0, 0.76, 0);
      const nug = std(0xffc93c, { roughness: 0.35, metalness: 0.3, emissive: 0x8a6a00, emissiveIntensity: 0.25 }), gemM = std(0xff6fae, { roughness: 0.2, emissive: 0xa02060, emissiveIntensity: 0.25 });
      let i = 0;
      for (let x = -W / 2 + 0.18; x < W / 2 - 0.1; x += 0.24, i++) add(group, ico(0.12, 0), i % 3 === 2 ? gemM : nug, x, 0.82 + (i % 2) * 0.03, (i % 2 ? 0.12 : -0.1), 1, 1, 1, i, i * 2, 0);
      face(group, 0, 0.5, 0.36, 0.9);
      const wheels: THREE.Object3D[] = [], wheelG = cyl(0.15, 0.15, 0.08, 12);
      for (const x of [-W * 0.3, W * 0.3]) for (const z of [-0.36, 0.36]) {
        const wg = grp(group, x, 0.15, z);
        add(wg, wheelG, iron, 0, 0, 0, 1, 1, 1, PI / 2);
        add(wg, box(0.04, 0.26, 0.09), std(0x8a8a9a));
        wheels.push(wg);
      }
      tick = () => { const d = dx(); for (const wg of wheels) wg.rotation.z -= d / 0.15; };
      break;
    }
    case "grumpy": {
      // endless run: a spiky purple grump sitting on the road — touch it and a life is gone
      const R = Math.min(0.34, W * 0.42);
      const b = grp(group, 0, R + 0.06, 0);
      const skin = std(0x7b3fe0, { roughness: 0.45, emissive: 0x2a0a60, emissiveIntensity: 0.3 });
      const spikeM = std(0xff4d6d, { roughness: 0.35, emissive: 0xff1f4a, emissiveIntensity: 0.35 });
      add(b, sph(R, 20, 14), skin);
      const spikeG = cone(R * 0.24, R * 0.62, 8);
      const ico0 = new THREE.IcosahedronGeometry(1, 0), dirs = ico0.getAttribute("position");
      const seen = new Set<string>();
      for (let i = 0; i < dirs.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(dirs, i).normalize();
        const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
        if (seen.has(key) || v.y < -0.6 || (v.z > 0.6 && v.y < 0)) continue;
        seen.add(key);
        const sp = add(b, spikeG, spikeM, v.x * R * 1.05, v.y * R * 1.05, v.z * R * 1.05);
        sp.quaternion.setFromUnitVectors(UP, v);
      }
      ico0.dispose();
      const eyeW = std(0xffffff, { roughness: 0.3 }), dark = std(0x1a0a2a, { roughness: 0.3 });
      for (const sx of [-1, 1]) {
        add(b, sph(R * 0.22, 12, 9), eyeW, sx * R * 0.34, R * 0.12, R * 0.88, 1, 0.8, 0.5);
        add(b, sph(R * 0.11, 10, 8), dark, sx * R * 0.3, R * 0.08, R * 0.98, 1, 1, 0.6);
        add(b, box(R * 0.44, R * 0.1, R * 0.12), dark, sx * R * 0.34, R * 0.38, R * 0.88, 1, 1, 1, 0, 0, sx * 0.45);
      }
      add(b, tor(R * 0.2, R * 0.045, 6, 14, PI), dark, 0, -R * 0.36, R * 0.92);
      tick = (t, beat) => {
        const k = kick(beat);
        b.rotation.z = Math.sin(t * 3) * 0.12;
        b.rotation.y = Math.sin(t * 1.7) * 0.25;
        spikeM.emissiveIntensity = 0.3 + 0.7 * k;
        squash(b, 1 - 0.25 * k, 0.12);
      };
      break;
    }
    default: {
      // the clay block
      const b = grp(group);
      add(b, rbox(W, 0.9, 0.8, 0.14, 3), std(0xff8a3d), 0, 0.45, 0);
      add(b, rbox(W + 0.02, 0.1, 0.82, 0.05), std(0xffb070), 0, 0.7, 0);
      face(b, 0, 0.42, 0.405, 1.1);
      tick = (_t, beat) => squash(b, 1 - 0.35 * kick(beat), 0.12);
    }
  }
  return tick ? { group, tick } : { group };
}

// ---------------------------------------------------------------- H08 rollers
// A round thing of radius `r` (centre at y = r) rolling towards +z; the renderer spins `roll` about x.
// Wheels / donuts / barrels are made fat (≈ 0.8 r half-width) so they cover the hit circle.
function dirs(list: number[][]) { return list.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize()); }

export function rollerView(skin: string, r: number): RollerView {
  const group = new THREE.Group(), roll = grp(group, 0, r, 0);
  const spots = dirs([[1, 0.3, 0.2], [-0.8, 0.5, -0.3], [0.2, -0.9, 0.4], [0.1, 0.6, -0.9], [-0.4, -0.5, 0.8], [0.6, -0.2, -0.7], [-0.3, 0.9, 0.5]]);
  switch (skin) {
    case "snowball": {
      const snow = std(0xf4fbff, { roughness: 0.9 });
      add(roll, ico(r, 2), snow);
      spots.slice(0, 5).forEach((d) => add(roll, ico(r * 0.38, 1), snow, d.x * r * 0.75, d.y * r * 0.75, d.z * r * 0.75));
      const coal = std(0x2a2a3a);
      spots.slice(4).forEach((d) => add(roll, sph(r * 0.08, 8, 6), coal, d.x * r, d.y * r, d.z * r));
      const twig = add(roll, cyl(0.02, 0.03, r * 0.8, 5), std(0x7a4a2a), 0, 0, 0);
      twig.position.copy(spots[1]).multiplyScalar(r * 1.05);
      twig.quaternion.setFromUnitVectors(UP, spots[1]);
      break;
    }
    case "boulder": {
      add(roll, new THREE.DodecahedronGeometry(r, 1), std(0x8a7a6a, { roughness: 0.9 }));
      const moss = std(0x6cb84a, { roughness: 0.9 }), crack = std(0x5a4a3a);
      spots.slice(0, 3).forEach((d) => { const m = add(roll, sph(r * 0.3, 10, 6), moss, d.x * r * 0.9, d.y * r * 0.9, d.z * r * 0.9, 1, 0.35, 1); m.quaternion.setFromUnitVectors(UP, d); });
      spots.slice(3).forEach((d) => { const c = add(roll, box(r * 0.5, 0.03, 0.05), crack, d.x * r * 0.97, d.y * r * 0.97, d.z * r * 0.97); c.quaternion.setFromUnitVectors(UP, d); c.rotateY(0.7); });
      break;
    }
    case "donut": {
      add(roll, tor(r * 0.55, r * 0.45, 10, 20), std(0xe8b070, { roughness: 0.7 }), 0, 0, 0, 1, 1, 1.8, 0, PI / 2);
      const frost = std(0xffb0c8, { roughness: 0.45 }), sprG = capsule(0.015, 0.05, 4), cols = [0xffffff, 0x7fd6ff, 0xffd84d, 0x9be34a];
      for (const s of [-1, 1]) {
        add(roll, tor(r * 0.55, r * 0.36, 8, 20), frost, s * r * 0.28, 0, 0, 1, 1, 1.2, 0, PI / 2);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + s, rr = r * (0.38 + (i % 3) * 0.17);
          add(roll, sprG, std(cols[i % 4]), s * r * 0.72, Math.cos(a) * rr, Math.sin(a) * rr, 1, 1, 1, a, 0, PI / 2);
        }
      }
      break;
    }
    case "bowling": {
      add(roll, sph(r, 20, 14), std(0x3a2a63, { roughness: 0.22 }));
      add(roll, tor(r * 1.0, r * 0.06, 4, 28), std(0x8e5be8, { roughness: 0.3 }), 0, 0, 0, 1, 1, 1, 0.5, 0.3, 0);
      const hole = std(0x120a20);
      for (const d of dirs([[0.15, 0.8, 0.5], [-0.15, 0.8, 0.5], [0, 0.95, 0.15]])) {
        const h = add(roll, cyl(r * 0.13, r * 0.13, r * 0.1, 10), hole, d.x * r * 0.97, d.y * r * 0.97, d.z * r * 0.97);
        h.quaternion.setFromUnitVectors(UP, d);
      }
      break;
    }
    case "tumbleweed": {
      const twig = std(0xc8a060, { roughness: 0.9 }), ring = tor(r * 0.92, 0.035, 4, 20);
      for (let i = 0; i < 9; i++) add(roll, ring, twig, 0, 0, 0, 1, 1, 1, i * 0.7, i * 1.3, i * 0.4);
      add(roll, ico(r * 0.5, 1), std(0x9a7a4a, { roughness: 0.95 }));
      break;
    }
    case "wheel": {
      add(roll, tor(r * 0.72, r * 0.28, 8, 22), std(0x2a2a3a, { roughness: 0.75 }), 0, 0, 0, 1, 1, 2.6, 0, PI / 2);
      add(roll, cyl(r * 0.55, r * 0.55, r * 1.3, 18), std(0xe8504f), 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
      const white = std(0xffffff), spokeG = box(0.05, r * 0.95, r * 0.12);
      for (const s of [-1, 1]) {
        add(roll, cyl(r * 0.2, r * 0.2, 0.06, 12), white, s * r * 0.66, 0, 0, 1, 1, 1, 0, 0, PI / 2);
        for (let k = 0; k < 4; k++) add(roll, spokeG, white, s * r * 0.655, 0, 0, 1, 1, 1, (k * PI) / 4);
      }
      const nubG = box(r * 1.5, r * 0.08, r * 0.12);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; add(roll, nubG, std(0x3a3a4a), 0, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, 1, 1, 1, -a); }
      break;
    }
    case "orb": {
      add(roll, sph(r, 18, 12), glow(0x9b5de5, 0.6));
      const ringM = std(0xffc0f0, { roughness: 0.3, emissive: 0xff7ae0, emissiveIntensity: 0.5 });
      add(roll, tor(r * 1.03, r * 0.05, 4, 28), ringM, 0, 0, 0, 1, 1, 1, 0, PI / 2);
      add(roll, tor(r * 1.03, r * 0.05, 4, 28), ringM, 0, 0, 0, 1, 1, 1, PI / 2, 0, 0.6);
      const starG = new THREE.OctahedronGeometry(r * 0.12, 0), starM = glow(0xfff27a, 1.6);
      spots.forEach((d) => add(roll, starG, starM, d.x * r, d.y * r, d.z * r));
      break;
    }
    default: {
      // the wooden barrel
      const [c, x] = canvas(128, 64);
      x.fillStyle = "#b07440"; x.fillRect(0, 0, 128, 64);
      x.fillStyle = "rgba(90,50,20,0.45)";
      for (let i = 0; i < 128; i += 16) x.fillRect(i, 0, 2, 64);
      x.fillStyle = "rgba(255,220,170,0.18)";
      for (let i = 6; i < 128; i += 16) x.fillRect(i, 0, 4, 64);
      const bg = lathe([[0.001, -0.9 * r], [0.8 * r, -0.9 * r], [0.92 * r, -0.5 * r], [r, 0], [0.92 * r, 0.5 * r], [0.8 * r, 0.9 * r], [0.001, 0.9 * r]], 16);
      bg.rotateZ(PI / 2);
      add(roll, bg, std(0xffffff, { map: texOf(c), roughness: 0.7 }));
      const band = metal(0x5a5a6a);
      for (const s of [-1, 1]) {
        add(roll, tor(0.935 * r, 0.035, 4, 22), band, s * 0.5 * r, 0, 0, 1, 1, 1, 0, PI / 2);
        add(roll, tor(0.83 * r, 0.035, 4, 22), band, s * 0.82 * r, 0, 0, 1, 1, 1, 0, PI / 2);
      }
    }
  }
  return { group, roll };
}

// ---------------------------------------------------------------- H06 poppers
// Pops out of the floor: setUp(0) = hidden under the tiles, setUp(1) = fully up (≈ 1.1 tall, ~0.8 deep, w lanes wide).
export function popperView(skin: string, w: number): PopperView {
  const group = new THREE.Group();
  const W = Math.max(0.7, w * 0.92), xs = lanes(w);
  const rimCol: Record<string, number> = { geyser: 0x7fd6ff, jet: 0x9aa6b8, mushroom: 0x6cb84a, flame: 0x5a5a6a, tentacle: 0x9b5de5 };
  // a hatch on the floor marks the spot
  const hatchM = std(0x3a2a4a, { roughness: 0.9 }), rimM = std(rimCol[skin] ?? 0xffc93c), hatchG = cyl(0.36, 0.36, 0.02, 18), rimG = tor(0.37, 0.035, 4, 20);
  for (const x of xs) { add(group, hatchG, hatchM, x, 0.012, 0); add(group, rimG, rimM, x, 0.022, 0, 1, 1, 1, PI / 2); }
  const rise = grp(group);
  // default pop: grows up from the hatch with a clay squash
  let pose = (k: number) => { const q = 1 - k; rise.scale.set(1 + 0.2 * q, Math.max(0.02, k), 1 + 0.2 * q); };
  switch (skin) {
    case "geyser":
    case "jet": {
      const jet = skin === "jet";
      const water = std(jet ? 0x46c8ff : 0x7fd6ff, { roughness: 0.15, transparent: true, opacity: 0.85, emissive: 0x2a7aa0, emissiveIntensity: 0.25 });
      const foam = std(0xffffff, { roughness: 0.6 }), foamG = sph(0.14, 10, 8);
      for (const x of xs) {
        if (jet) add(group, cyl(0.3, 0.33, 0.12, 14), metal(0x9aa6b8), x, 0.06, 0);
        add(rise, cyl(jet ? 0.24 : 0.3, 0.34, 0.92, 14), water, x, 0.46, 0);
        add(rise, tor(jet ? 0.2 : 0.26, 0.04, 4, 16), std(0xbff3ff, { roughness: 0.3 }), x, 0.6, 0, 1, 1, 1, PI / 2);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(rise, foamG, foam, x + Math.cos(a) * 0.22, 0.95 + (i % 2) * 0.05, Math.sin(a) * 0.22); }
        add(rise, sph(0.18, 10, 8), foam, x, 1.0, 0);
        for (const [dx, dz, y] of [[0.4, 0.1, 0.8], [-0.38, -0.12, 0.7], [0.1, 0.4, 0.9]]) add(rise, sph(0.05, 6, 4), water, x + dx, y, dz);
      }
      break;
    }
    case "jack": {
      const red = std(0xe8504f), yellow = std(0xffc93c), cream = std(0xffe6c8), steel = metal(0xc8d0dc);
      const boxes = grp(rise), tops: THREE.Group[] = [], lids: THREE.Group[] = [];
      for (const x of xs) {
        add(boxes, rbox(0.74, 0.46, 0.74, 0.06), red, x, 0.23, 0);
        add(boxes, ext(star(0.14, 0.06), 0.02, 0.01, 2), yellow, x, 0.24, 0.375);
        const lid = grp(boxes, x, 0.46, -0.37);
        add(lid, rbox(0.78, 0.06, 0.78, 0.03), yellow, 0, 0.03, 0.37);
        lids.push(lid);
        const top = grp(boxes, x, 0.46, 0);
        add(top, tube(Array.from({ length: 25 }, (_, i) => [Math.cos(i * 1.3) * 0.11, (i / 24) * 0.26, Math.sin(i * 1.3) * 0.11]), 0.025, 40, 4), steel);
        add(top, sph(0.19, 14, 10), cream, 0, 0.42, 0);
        face(top, 0, 0.44, 0.17, 0.7);
        add(top, sph(0.05, 8, 6), red, 0, 0.38, 0.19);
        add(top, cone(0.15, 0.24, 10), std(0x8e5be8), 0, 0.68, 0, 1, 1, 1, 0, 0, 0.15);
        add(top, sph(0.04, 6, 4), yellow, -0.03, 0.8, 0);
        tops.push(top);
      }
      pose = (k) => {
        const a = clamp01(k / 0.5), b = clamp01((k - 0.5) / 0.5);
        boxes.scale.set(1, Math.max(0.02, a), 1);
        for (const l of lids) l.rotation.x = -1.9 * b;
        for (const t of tops) { t.visible = b > 0.02; t.scale.set(1, Math.max(0.02, b), 1); }
      };
      break;
    }
    case "mushroom": {
      const capM = std(0xe8504f, { roughness: 0.5 }), dot = std(0xffffff), stem = std(0xfff1d6);
      for (const x of xs) {
        add(rise, cyl(0.16, 0.21, 0.72, 12), stem, x, 0.36, 0);
        add(rise, hemi(0.42, 16, 7), capM, x, 0.7, 0, 1, 0.8, 1);
        add(rise, cyl(0.42, 0.42, 0.04, 16), std(0xffe0c0), x, 0.7, 0);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.4, rr = i % 2 ? 0.26 : 0.18; add(rise, sph(0.06, 8, 6), dot, x + Math.cos(a) * rr, 0.7 + 0.8 * Math.sqrt(0.42 * 0.42 - rr * rr) - 0.01, Math.sin(a) * rr, 1, 0.45, 1); }
        add(rise, sph(0.07, 8, 6), dot, x, 1.03, 0, 1, 0.4, 1);
        face(rise, x, 0.4, 0.19, 0.6);
      }
      break;
    }
    case "spring": {
      const steel = metal(0xc8d0dc), pad = std(0xe8504f, { roughness: 0.45 });
      const coil = Array.from({ length: 41 }, (_, i) => [Math.cos((i / 40) * 5 * TAU) * 0.26, 0.08 + (i / 40) * 0.82, Math.sin((i / 40) * 5 * TAU) * 0.26]);
      for (const x of xs) {
        add(group, cyl(0.34, 0.36, 0.08, 14), metal(0x7a8496), x, 0.04, 0);
        add(rise, tube(coil.map(([cx, cy, cz]) => [cx + x, cy, cz]), 0.045, 60, 4), steel);
        add(rise, cyl(0.36, 0.34, 0.12, 16), pad, x, 0.96, 0);
        add(rise, ext(star(0.16, 0.07), 0.03, 0.01, 2), std(0xffc93c), x, 1.03, 0, 1, 1, 1, -PI / 2);
      }
      break;
    }
    case "ball": {
      const pink = std(0xff5d8f, { roughness: 0.35 }), white = std(0xffffff), yellow = std(0xffd84d);
      for (const x of xs) {
        add(rise, tube(Array.from({ length: 13 }, (_, i) => [x + Math.cos(i * 1.6) * 0.13, (i / 12) * 0.34, Math.sin(i * 1.6) * 0.13]), 0.03, 30, 4), metal(0xc8d0dc));
        add(rise, sph(0.38, 16, 12), pink, x, 0.7, 0);
        add(rise, tor(0.38, 0.04, 4, 24), white, x, 0.7, 0, 1, 1, 1, PI / 2);
        add(rise, tor(0.38, 0.04, 4, 24), yellow, x, 0.7, 0, 1, 1, 1, 0, 0, 0.3);
        face(rise, x, 0.78, 0.36, 0.9);
      }
      break;
    }
    case "flame": {
      const outer = glow(0xff7a1a, 1.4), mid = glow(0xffc04d, 1.8), inner = glow(0xfff6c8, 2.2);
      outer.transparent = true; outer.opacity = 0.85;
      for (const x of xs) {
        add(group, cyl(0.34, 0.36, 0.06, 14), metal(0x5a5a6a), x, 0.03, 0);
        add(rise, cone(0.36, 1.05, 12), outer, x, 0.52, 0);
        add(rise, cone(0.25, 0.8, 10), mid, x, 0.4, 0.04);
        add(rise, cone(0.13, 0.5, 8), inner, x, 0.26, 0.08);
        for (const [dx, h] of [[-0.24, 0.5], [0.25, 0.6]]) add(rise, cone(0.12, h, 8), outer, x + dx, h / 2 + 0.05, 0, 1, 1, 1, 0, 0, -dx * 0.8);
      }
      break;
    }
    case "tentacle": {
      const purple = std(0x9b5de5, { roughness: 0.5 }), sucker = std(0xe0c8ff), segG = sph(1, 10, 7);
      for (const x of xs) {
        for (let i = 0; i < 7; i++) {
          const t = i / 6, rr = 0.3 * (1 - 0.62 * t);
          add(rise, segG, purple, x + 0.2 * t * t, 0.12 + t * 0.85, 0, rr, rr * 1.15, rr);
          if (i < 6) add(rise, sph(0.05, 8, 6), sucker, x + 0.2 * t * t, 0.12 + t * 0.85, rr * 0.95, 1, 1, 0.4);
        }
        add(rise, tor(0.08, 0.04, 5, 10, PI * 1.3), purple, x + 0.14, 1.02, 0, 1, 1, 1, 0, 0, -0.6);
        face(rise, x + 0.02, 0.38, 0.26, 0.7);
      }
      break;
    }
    default: {
      // the clay pillar
      const pink = std(0xff6fae);
      add(rise, rbox(W, 1.1, 0.8, 0.16, 3), pink, 0, 0.55, 0);
      for (const y of [0.3, 0.75]) add(rise, rbox(W + 0.03, 0.1, 0.83, 0.05), std(0xffffff), 0, y, 0);
      face(rise, 0, 0.95, 0.405, 0.9);
    }
  }
  const setUp = (k: number) => { const e = clamp01(k); rise.visible = e > 0.02; pose(e); };
  setUp(0);
  return { group, setUp };
}

// ---------------------------------------------------------------- H10 / H11 lasers & doors
// Spans x ∈ [−w/2, w/2] (posts sit exactly on the edges); the danger is up to ~0.7 high and only ±0.12 rows deep.
// setOn(k): 0 = open / off, 1 = closed / on (blocking).
export function laserView(skin: string, w: number): LaserView {
  const group = new THREE.Group();
  const half = w / 2;
  const posts = (m: Mat, h: number, topM: Mat) => {
    for (const s of [-1, 1]) {
      add(group, cyl(0.08, 0.1, h, 10), m, s * half, h / 2, 0);
      add(group, sph(0.11, 10, 8), topM, s * half, h + 0.05, 0);
    }
  };
  let setOn: (k: number) => void;
  switch (skin) {
    case "doors": {
      const wood = std(0x9a6b45), light = std(0xc8915a), win = std(0xbfe8ff, { roughness: 0.2 });
      const lamp = glow(0x6cd24a, 1.4);
      posts(std(0x7a4f30), 0.86, lamp);
      const panels: THREE.Group[] = [];
      for (const s of [-1, 1]) {
        const p = grp(group, s * half, 0, 0);
        const inner = grp(p, -s * half / 2, 0, 0);
        add(inner, rbox(half - 0.02, 0.72, 0.16, 0.06), wood, 0, 0.38, 0);
        add(inner, box(half * 0.7, 0.42, 0.17), light, 0, 0.36, 0);
        add(inner, sph(0.11, 12, 8), win, 0, 0.5, 0, Math.min(1.4, half * 1.3), 1, 0.9);
        add(inner, sph(0.04, 8, 6), metal(0xffc533), -s * (half / 2 - 0.1), 0.36, 0.09);
        panels.push(p);
      }
      setOn = (k) => {
        const e = clamp01(k);
        for (const p of panels) p.scale.set(Math.max(0.05, e), 1, 1);
        const c = e > 0.5 ? 0xff4a4a : 0x6cd24a;
        lamp.color.setHex(c); lamp.emissive.setHex(c);
      };
      break;
    }
    case "sparkler": {
      posts(std(0x8a8a9a), 0.78, std(0x5a5a6a));
      const wireM = std(0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 0.15, roughness: 0.4 });
      const n = Math.max(3, Math.round(w * 3)), pts: number[][] = [];
      for (let i = 0; i <= n; i++) pts.push([-half + (i / n) * w, i % 2 ? 0.64 : 0.1, 0]);
      add(group, tube(pts, 0.03, n * 8, 5), wireM);
      const sparks: THREE.Object3D[] = [], sparkG = new THREE.OctahedronGeometry(0.07, 0), sparkM = glow(0xfff6a0, 2.2);
      pts.forEach(([x, y], i) => { for (const o of [-1, 1]) sparks.push(add(group, sparkG, sparkM, x + o * 0.06, y + (i % 2 ? 0.08 : -0.02) * o, 0.02 * o, 1, 1, 1, i, i * 0.5, 0)); });
      setOn = (k) => {
        const e = clamp01(k);
        wireM.emissiveIntensity = 0.15 + 2 * e;
        sparks.forEach((s, i) => { s.visible = e > 0.1; s.scale.setScalar(0.5 + e * (0.6 + 0.4 * ((i * 7) % 3) / 2)); });
      };
      break;
    }
    case "web": {
      const twig = std(0x7a4a2a);
      posts(twig, 0.8, std(0x6cb84a));
      const web = grp(group, 0, 0.38, 0), silk = std(0xffffff, { roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.25 });
      const rx = half - 0.04, ry = 0.36;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, l = Math.hypot(ex, ey);
        add(web, cyl(0.012, 0.012, l, 3), silk, ex / 2, ey / 2, 0, 1, 1, 1, 0, 0, Math.atan2(ey, ex) - PI / 2);
      }
      for (const f of [0.3, 0.55, 0.8, 1]) add(web, tor(1, 0.03, 3, 32), silk, 0, 0, 0, rx * f, ry * f, 0.4);
      const spider = grp(web, 0, 0, 0.04), body = std(0x6a3fb0);
      add(spider, sph(0.11, 12, 9), body, 0, 0, 0);
      add(spider, sph(0.08, 10, 8), body, 0, 0.12, 0);
      face(spider, 0, 0.13, 0.07, 0.45, { smile: false });
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(spider, cyl(0.012, 0.012, 0.16, 4), body, s * 0.13, 0.04 - k * 0.06, 0, 1, 1, 1, 0, 0, s * (1.2 + k * 0.3));
      setOn = (k) => { const e = clamp01(k); web.visible = e > 0.02; web.scale.set(Math.max(0.02, e), Math.max(0.02, e), 1); };
      break;
    }
    case "bars": {
      add(group, rbox(w, 0.04, 0.14, 0.02), metal(0x5a5a6a), 0, 0.02, 0);
      const rise = grp(group), steel = metal(0x7a8496), cap = std(0xffc93c), barG = cyl(0.045, 0.045, 0.72, 8), capG = sph(0.065, 8, 6);
      const n = Math.max(2, Math.round(w / 0.22));
      for (let i = 0; i <= n; i++) { const x = -half + 0.06 + (i / n) * (w - 0.12); add(rise, barG, steel, x, 0.36, 0); add(rise, capG, cap, x, 0.74, 0); }
      add(rise, rbox(w - 0.04, 0.06, 0.1, 0.02), steel, 0, 0.6, 0);
      setOn = (k) => { const e = clamp01(k); rise.visible = e > 0.02; rise.scale.set(1, Math.max(0.02, e), 1); };
      break;
    }
    default: {
      // the laser fence: three beams up to ball-jump height
      const beamM = glow(0xff2a6d, 2.2), haloM = glow(0xff2a6d, 1);
      haloM.transparent = true; haloM.opacity = 0.25; haloM.depthWrite = false;
      posts(metal(0x5a5a6a), 0.78, glow(0xff2a6d, 1.2));
      const beams: THREE.Object3D[] = [], beamG = cyl(0.035, 0.035, w, 8), haloG = cyl(0.09, 0.09, w, 10);
      for (const y of [0.15, 0.4, 0.65]) {
        const b = grp(group, 0, y, 0);
        add(b, beamG, beamM, 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
        add(b, haloG, haloM, 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
        beams.push(b);
      }
      setOn = (k) => {
        const e = clamp01(k);
        for (const b of beams) { b.visible = e > 0.05; b.scale.set(1, 0.3 + 0.7 * e, 0.3 + 0.7 * e); }
        beamM.emissiveIntensity = 0.6 + 2 * e;
      };
    }
  }
  setOn(0);
  return { group, setOn };
}

// ---------------------------------------------------------------- B01–B15 bosses
// Big set pieces (3–8 units) standing on y = 0 and facing +z. update(t, beat, k): idle motion + attack wobble (k 0..1).
type Upd = BossView["update"];
const beatBounce = (beat: number) => Math.abs(Math.sin(beat * PI));

/** rising smoke / steam puffs; returns a ticker */
function smokePuffs(parent: THREE.Object3D, n: number, color: number, x: number, y: number, z: number, rise = 2.5, size = 0.5) {
  const g = sph(1, 10, 8), puffs: { m: THREE.Mesh; mat: THREE.MeshStandardMaterial; o: number }[] = [];
  for (let i = 0; i < n; i++) {
    const mat = std(color, { roughness: 0.95, transparent: true, opacity: 0.8, depthWrite: false });
    puffs.push({ m: add(parent, g, mat, x, y, z), mat, o: i / n });
  }
  return (t: number, speed = 0.35) => {
    for (const p of puffs) {
      const f = (((t * speed + p.o) % 1) + 1) % 1;
      p.m.position.set(x + Math.sin((f + p.o) * 7) * 0.4 * f, y + f * rise, z - f * 0.4);
      p.m.scale.setScalar(size * (0.5 + f * 1.2));
      p.mat.opacity = 0.85 * (1 - f);
    }
  };
}
function zigShape(h: number) {
  const s = new THREE.Shape(), k = h / 2.6;
  s.moveTo(-0.1 * k, 2.6 * k); s.lineTo(0.3 * k, 2.6 * k); s.lineTo(0.08 * k, 1.6 * k); s.lineTo(0.32 * k, 1.6 * k);
  s.lineTo(-0.1 * k, 0); s.lineTo(0, 1.2 * k); s.lineTo(-0.26 * k, 1.2 * k); s.closePath();
  return s;
}

function bossKranky(group: THREE.Group): Upd {
  const o = makeKranky();
  const holder = grp(group);
  holder.add(o.group);
  holder.rotation.y = PI;
  holder.scale.setScalar(2.4);
  // bow tie + moustache (his front is −z before the turn)
  const black = std(0x1a1030, { roughness: 0.35 });
  for (const s of [-1, 1]) add(o.group, cone(0.14, 0.24, 8), black, s * 0.12, 1.22, -0.86, 1, 1, 0.6, 0, 0, s * PI / 2);
  add(o.group, sph(0.06, 8, 6), std(0xffc93c), 0, 1.22, -0.88);
  for (const s of [-1, 1]) add(o.group, tor(0.1, 0.03, 5, 10, PI * 0.8), black, s * 0.11, 1.0, -0.9, 1, 1, 1, 0, 0, s > 0 ? PI * 1.05 : -0.05);
  return (t, beat, k) => {
    holder.position.y = beatBounce(beat) * 0.4 * (0.5 + k);
    holder.rotation.z = Math.sin(beat * PI) * 0.05 * (1 + k);
    const snap = Math.max(0, Math.sin(beat * TAU)) * (0.3 + 0.5 * k);
    o.claws[0].rotation.z = 0.3 + snap;
    o.claws[1].rotation.z = -0.3 - snap;
    o.eyes.rotation.z = Math.sin(t * 2) * 0.05;
    o.hat.rotation.z = 0.12 + Math.sin(beat * PI) * 0.1;
  };
}

function bossGloopKing(group: THREE.Group): Upd {
  const lime = std(0x9be34a, { roughness: 0.25, emissive: 0x3a8a10, emissiveIntensity: 0.15 });
  const body = grp(group);
  add(body, sph(2.2, 28, 20), lime, 0, 2.0, 0, 1.1, 0.92, 1);
  add(body, cyl(2.3, 2.5, 0.2, 28), lime, 0, 0.1, 0);
  for (const [a, h] of [[0.5, 1.2], [1.3, 0.9], [2.1, 1.4], [-0.6, 1.0], [-1.4, 1.3]]) {
    add(body, capsule(0.18, h * 0.5, 8), lime, Math.sin(a) * 2.25, 0.4 + h * 0.3, Math.cos(a) * 2.05);
  }
  add(body, sph(0.6, 16, 10), std(0x2a5a10), 0, 1.35, 2.0, 1.5, 0.7, 0.4);
  add(body, rbox(0.42, 0.5, 0.2, 0.08), std(0xffffff, { roughness: 0.3 }), 0.25, 1.45, 2.22);
  face(body, 0, 2.55, 2.12, 4.5, { smile: false });
  const crown = grp(body, 0, 3.95, 0), gold = metal(0xffc533, { roughness: 0.3 });
  add(crown, cyl(0.95, 0.85, 0.5, 18), gold, 0, 0.25, 0);
  const gems = [std(0xe8304f, { roughness: 0.2 }), std(0x46a0ff, { roughness: 0.2 })];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    add(crown, cone(0.2, 0.5, 8), gold, Math.sin(a) * 0.85, 0.7, Math.cos(a) * 0.85);
    add(crown, sph(0.08, 8, 6), gold, Math.sin(a) * 0.85, 0.98, Math.cos(a) * 0.85);
    add(crown, sph(0.11, 8, 6), gems[i % 2], Math.sin(a) * 0.93, 0.25, Math.cos(a) * 0.93);
  }
  return (t, beat, k) => {
    const s = Math.sin(beat * TAU) * 0.04 * (1 + 2 * k);
    body.scale.set(1 - s / 2, 1 + s, 1 - s / 2);
    crown.position.y = 3.95 + beatBounce(beat) * 0.25 * (0.4 + k);
    crown.rotation.z = Math.sin(t * 2) * 0.08;
  };
}

function bossMothership(group: THREE.Group): Upd {
  const ufo = grp(group, 0, 4.2, 0), saucer = grp(ufo);
  add(saucer, sph(3, 32, 12), metal(0xb8b0d8, { metalness: 0.3 }), 0, 0, 0, 1, 0.22, 1);
  add(saucer, tor(3, 0.18, 8, 40), std(0x8e5be8), 0, 0, 0, 1, 1, 1, PI / 2);
  const lights: THREE.MeshStandardMaterial[] = [], cols = [0xff6fd8, 0x7ffcff, 0xffe65a];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, m = glow(cols[i % 3], 1);
    lights.push(m);
    add(saucer, sph(0.16, 8, 6), m, Math.cos(a) * 2.7, 0.22, Math.sin(a) * 2.7);
  }
  add(ufo, hemi(1.3, 20, 8), std(0xd8c8ff, { roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.5, 0);
  // Zib in the cockpit: purple, one huge eye, glowing antenna
  const purple = std(0x8e5be8);
  add(ufo, sph(0.75, 18, 12), purple, 0, 0.85, 0);
  add(ufo, sph(0.38, 16, 12), std(0xffffff, { roughness: 0.25 }), 0, 1.0, 0.52, 1, 1, 0.7);
  add(ufo, sph(0.18, 12, 8), std(0x2a1a3a, { roughness: 0.3 }), 0, 1.0, 0.76, 1, 1, 0.5);
  add(ufo, sph(0.06, 6, 4), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }), 0.06, 1.07, 0.84);
  add(ufo, cyl(0.03, 0.04, 0.4, 6), purple, 0, 1.68, 0);
  const tip = glow(0x9be34a, 1.6);
  add(ufo, sph(0.09, 8, 6), tip, 0, 1.68 + 0.22, 0);
  add(ufo, hemi(1.0, 18, 6), glow(0x9be3ff, 1.2), 0, -0.45, 0, 1, 0.5, 1, PI);
  const beamM = glow(0xb8f0ff, 1);
  beamM.transparent = true; beamM.opacity = 0.2; beamM.depthWrite = false; beamM.side = THREE.DoubleSide;
  const beam = add(ufo, new THREE.ConeGeometry(2.2, 4.2, 24, 1, true), beamM, 0, -0.5 - 2.1, 0);
  return (t, beat, k) => {
    ufo.position.y = 4.2 + Math.sin(t * 1.5) * 0.25;
    ufo.rotation.z = Math.sin(t) * 0.05;
    saucer.rotation.y = t * 0.6;
    lights.forEach((m, i) => { m.emissiveIntensity = 0.6 + 1.4 * Math.max(0, Math.sin(beat * PI - i * 0.5)); });
    beamM.opacity = 0.12 + 0.4 * k + 0.08 * Math.sin(t * 8);
    beam.scale.set(0.7 + 0.3 * k, 1, 0.7 + 0.3 * k);
    tip.emissiveIntensity = 1 + Math.abs(Math.sin(t * 5));
  };
}

function bossMegaRobot(group: THREE.Group): Upd {
  const teal = std(0x1e9c91, { roughness: 0.5 }), dark = std(0x0e6a62), grey = metal(0xc8d0dc), yellow = std(0xffc93c);
  const bot = grp(group);
  for (const s of [-1, 1]) {
    add(bot, rbox(1.0, 0.4, 1.4, 0.15), teal, s * 0.8, 0.2, 0.15);
    add(bot, cyl(0.32, 0.36, 1.4, 14), grey, s * 0.8, 1.1, 0);
    add(bot, sph(0.4, 14, 10), yellow, s * 0.8, 1.9, 0);
  }
  const body = grp(bot, 0, 2.1, 0);
  add(body, rbox(2.6, 2.2, 1.6, 0.3), teal, 0, 1.1, 0);
  add(body, box(2.2, 0.04, 0.02), dark, 0, 1.75, 0.81);
  const btn = [0xe8504f, 0xffc93c, 0x6cd24a, 0x46a0ff];
  btn.forEach((c, i) => add(body, cyl(0.17, 0.17, 0.12, 14), std(c, { roughness: 0.35 }), (i % 2 ? 0.4 : -0.4), i < 2 ? 1.2 : 0.75, 0.82, 1, 1, 1, PI / 2));
  const head = grp(body, 0, 2.3, 0);
  add(head, rbox(1.8, 1.3, 1.3, 0.25), teal, 0, 0.65, 0);
  add(head, rbox(1.4, 0.9, 0.06, 0.03), std(0x10302e, { roughness: 0.3 }), 0, 0.65, 0.65);
  const eyeM = glow(0x7ffcff, 1.6), eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) eyes.push(add(head, rbox(0.24, 0.32, 0.03, 0.06), eyeM, s * 0.3, 0.76, 0.69));
  add(head, tor(0.2, 0.04, 4, 12, PI), eyeM, 0, 0.5, 0.69, 1, 1, 1, 0, 0, PI);
  for (const s of [-1, 1]) add(head, cyl(0.24, 0.24, 0.2, 12), grey, s * 0.95, 0.65, 0, 1, 1, 1, 0, 0, PI / 2);
  add(head, cyl(0.05, 0.05, 0.6, 6), grey, 0, 1.6, 0);
  const tip = glow(0xff4a4a, 1.4);
  add(head, sph(0.15, 10, 8), tip, 0, 1.95, 0);
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const a = grp(body, s * 1.55, 1.8, 0);
    add(a, sph(0.42, 14, 10), yellow);
    add(a, cyl(0.24, 0.24, 1.0, 12), grey, 0, -0.55, 0);
    add(a, sph(0.3, 12, 9), teal, 0, -1.1, 0);
    add(a, cyl(0.26, 0.22, 0.9, 12), grey, 0, -1.6, 0);
    add(a, sph(0.42, 14, 10), teal, 0, -2.2, 0.05, 1, 0.9, 1);
    a.userData.s = s;
    arms.push(a);
  }
  return (t, beat, k) => {
    bot.position.y = beatBounce(beat) * 0.15;
    body.rotation.z = Math.sin(beat * PI) * 0.05;
    head.rotation.y = Math.sin(t * 0.8) * 0.2;
    arms.forEach((a, i) => {
      const s = a.userData.s as number;
      a.rotation.x = Math.sin(beat * PI + i * PI) * 0.3 * (0.5 + k);
      a.rotation.z = s * (0.15 + 1.2 * k * beatBounce(beat * 0.5));
    });
    const blink = (t % 3.2) < 0.12 ? 0.1 : 1;
    for (const e of eyes) e.scale.y = blink;
    tip.emissiveIntensity = 0.8 + 1.5 * Math.pow(1 - (((beat % 1) + 1) % 1), 3);
  };
}

function bossVolcano(group: THREE.Group): Upd {
  const rock = std(0x8a5a4a, { roughness: 0.85, side: THREE.DoubleSide });
  add(group, lathe([[3.6, 0], [3.4, 0.5], [2.6, 1.6], [1.6, 3.0], [1.1, 3.9], [0.9, 4.2], [0.6, 4.0]], 22), rock);
  const lavaM = glow(0xff5a1a, 1.5);
  add(group, cyl(0.75, 0.6, 0.1, 16), lavaM, 0, 3.98, 0);
  for (const phi of [-0.35, 0.1, 0.5]) {
    const axis = new THREE.Vector3(Math.sin(phi) * 1.5, -2.3, Math.cos(phi) * 1.5).normalize();
    const m = add(group, capsule(0.16, 1.6, 8), lavaM, Math.sin(phi) * 1.95, 2.75, Math.cos(phi) * 1.95);
    m.quaternion.setFromUnitVectors(UP, axis);
  }
  const f = face(group, 0, 2.0, 2.36, 3.2);
  f.rotation.x = -0.5;
  const stone = std(0x6a4a3a, { roughness: 0.9 });
  for (const [x, z, r] of [[2.8, 1.9, 0.5], [-3.0, 1.5, 0.4], [3.4, -0.6, 0.45], [-2.2, 2.6, 0.3]]) add(group, new THREE.DodecahedronGeometry(r, 0), stone, x, r * 0.7, z);
  const smoke = smokePuffs(group, 6, 0x9a94a8, 0, 4.3, 0, 3.2, 0.7);
  return (t, beat, k) => {
    lavaM.emissiveIntensity = 1.2 + 1.5 * k + 0.6 * Math.pow(1 - (((beat % 1) + 1) % 1), 3);
    smoke(t, 0.25 + 0.35 * k);
    group.children[0].scale.set(1, 1 + 0.02 * k * Math.sin(t * 20), 1);
  };
}

function bossWave(group: THREE.Group): Upd {
  const sea = std(0x2ec4e6, { roughness: 0.35 }), deep = std(0x1a8ac8, { roughness: 0.4 }), foamM = std(0xffffff, { roughness: 0.6 });
  const wave = grp(group);
  add(wave, sph(1, 20, 10), deep, 0, 0.2, 0, 3.6, 1.4, 2.4);
  const curl = tor(1.6, 0.85, 12, 28, PI * 1.7);
  curl.rotateZ(-PI / 2);
  curl.rotateY(PI / 2);
  add(wave, curl, sea, 0, 2.5, 0, 3.2, 1, 1);
  const foam = grp(wave), fg = sph(1, 10, 8);
  for (let x = -2.7, i = 0; x <= 2.7; x += 0.6, i++) {
    add(foam, fg, foamM, x, 4.65 + (i % 2) * 0.12, 0.6, 0.42, 0.34, 0.42);
    add(foam, fg, foamM, x + 0.3, 1.45, 1.75 + (i % 2) * 0.1, 0.36, 0.3, 0.36);
  }
  const f = face(wave, 0, 3.75, 2.15, 2.6);
  f.rotation.x = -0.65;
  return (t, beat, k) => {
    wave.position.z = Math.sin(beat * PI * 0.5) * 0.4 * (0.5 + k);
    wave.scale.y = 1 + 0.05 * Math.sin(beat * PI);
    foam.position.y = Math.sin(t * 3) * 0.1;
  };
}

function bossAvalanche(group: THREE.Group): Upd {
  const snow = std(0xf4fbff, { roughness: 0.9 }), shade = std(0xd8ecff, { roughness: 0.9 });
  const wall = grp(group);
  add(wall, rbox(8, 2.4, 1.6, 0.6, 3), snow, 0, 1.2, -0.6);
  const lump = sph(1, 12, 8);
  for (let x = -3.6, i = 0; x <= 3.6; x += 0.9, i++) {
    const r = 0.6 + (i % 3) * 0.15;
    add(wall, lump, i % 2 ? shade : snow, x, 2.35 + (i % 2) * 0.15, -0.5 + (i % 2) * 0.3, r, r * 0.85, r);
    if (i % 2) add(wall, lump, shade, x + 0.3, 0.6 + (i % 3) * 0.4, 0.22, 0.32, 0.3, 0.2);
  }
  face(wall, 0, 1.55, 0.21, 2.5);
  const balls: THREE.Group[] = [];
  [-2.4, 0, 2.4].forEach((x, i) => {
    const b = grp(group, x, 0.7, 1.3);
    add(b, ico(0.7, 2), snow);
    for (const [dx, dy, dz] of [[0.5, 0.3, 0.1], [-0.4, -0.2, 0.4], [0.1, 0.5, -0.45]]) add(b, ico(0.25, 1), shade, dx, dy, dz);
    b.userData.i = i;
    balls.push(b);
  });
  return (t, beat, k) => {
    wall.position.x = Math.sin(t * 20) * 0.05 * k;
    for (const b of balls) {
      const i = b.userData.i as number;
      b.rotation.x = t * 3 + i;
      b.position.y = 0.7 + Math.abs(Math.sin(beat * PI + i)) * 0.4 * (0.4 + k);
      b.position.z = 1.3 + Math.sin(t + i) * 0.3;
    }
  };
}

function bossTower(group: THREE.Group): Upd {
  const cols = [0xff6f91, 0xffc93c, 0x46a0ff, 0x6cd24a, 0x9b5de5, 0xff8a3d, 0x2ec4b6];
  const blocks: THREE.Group[] = [];
  let parent: THREE.Object3D = group;
  for (let i = 0; i < 7; i++) {
    const w = 2.2 - i * 0.12, b = grp(parent, i ? (i % 2 ? 0.12 : -0.1) : 0, i ? 0.85 : 0, 0);
    add(b, rbox(w, 0.85, w * 0.8, 0.14), std(cols[i]), 0, 0.425, 0, 1, 1, 1, 0, (i % 3) * 0.08 - 0.08);
    add(b, ext(star(0.18, 0.08), 0.03, 0.01, 2), std(0xffffff), (i % 2 ? -0.5 : 0.5) * w * 0.5, 0.43, w * 0.4 + 0.02);
    blocks.push(b);
    parent = b;
  }
  face(blocks[6], 0, 0.45, (2.2 - 6 * 0.12) * 0.4 + 0.005, 1.3);
  return (t, beat, k) => {
    blocks.forEach((b, i) => { b.rotation.z = Math.sin(t * 2 + i * 0.5) * (0.012 + 0.03 * k) + Math.sin(beat * PI) * 0.01 * k; });
  };
}

/** an equirect clay ball texture: base colour, a character pattern, then soft speckles / thumbprints */
function ballTex(base: string, pattern?: (x: CanvasRenderingContext2D) => void, speck = true) {
  const [c, x] = canvas(256, 128);
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  pattern?.(x);
  if (speck) {
    for (let i = 0; i < 300; i++) {
      x.globalAlpha = 0.04 + Math.random() * 0.07;
      x.fillStyle = Math.random() < 0.5 ? "#ffffff" : "#000000";
      x.beginPath(); x.arc(Math.random() * 256, Math.random() * 128, 0.6 + Math.random() * 1.6, 0, TAU); x.fill();
    }
  }
  x.globalAlpha = 1;
  const t = texOf(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
/** Momo's soft bands + dots (any colours) */
const momoBands = (band: string, dot: string) => (x: CanvasRenderingContext2D) => {
  x.globalAlpha = 0.22; x.fillStyle = band;
  for (const y of [22, 96]) { x.beginPath(); x.ellipse(128, y, 160, 9, 0, 0, TAU); x.fill(); }
  x.globalAlpha = 0.22; x.fillStyle = dot;
  for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * 32 + 16, 64, 7, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
};

function bossTrain(group: THREE.Group): Upd {
  const red = std(0xe8504f), blue = std(0x46a0ff), yellow = std(0xffc93c), dark = std(0x2a2a3a), gold = metal(0xffc533), cream = std(0xfff1d6), win = std(0xbfe8ff, { roughness: 0.2 });
  const train = grp(group);
  add(train, rbox(2.2, 0.4, 4.6, 0.1), dark, 0, 0.75, 0);
  add(train, cyl(1.0, 1.0, 2.6, 22), red, 0, 1.95, 0.8, 1, 1, 1, PI / 2);
  add(train, cyl(0.98, 0.98, 0.12, 22), cream, 0, 1.95, 2.13, 1, 1, 1, PI / 2);
  face(train, 0, 2.05, 2.2, 3);
  for (const z of [0.0, 1.0, 1.95]) add(train, tor(1.02, 0.06, 5, 24), gold, 0, 1.95, z);
  add(train, cyl(0.3, 0.42, 0.9, 14), dark, 0, 3.25, 1.5);
  add(train, cyl(0.5, 0.36, 0.25, 14), dark, 0, 3.75, 1.5);
  add(train, hemi(0.4, 12, 6), gold, 0, 2.88, 0.55);
  add(train, rbox(2.2, 2.0, 1.6, 0.15), blue, 0, 2.05, -1.4);
  add(train, rbox(2.5, 0.2, 1.9, 0.08), red, 0, 3.15, -1.4);
  add(train, box(1.4, 0.5, 0.02), win, 0, 2.62, -0.59);
  for (const s of [-1, 1]) add(train, box(0.02, 0.6, 0.8), win, s * 1.11, 2.4, -1.4);
  add(train, cone(0.95, 0.7, 4), yellow, 0, 0.55, 2.5, 1, 1, 1, PI / 2, PI / 4);
  add(train, sph(0.2, 10, 8), glow(0xfff27a, 1.4), 0, 3.0, 1.95);
  const wheels: THREE.Group[] = [], rods: THREE.Object3D[] = [];
  const wheelG = cyl(0.55, 0.55, 0.2, 18), hubG = cyl(0.15, 0.15, 0.22, 10), spokeG = box(0.22, 0.9, 0.1);
  for (const s of [-1, 1]) {
    for (const z of [1.4, 0.2, -1.2]) {
      const wg = grp(train, s * 1.15, 0.6, z);
      add(wg, wheelG, red, 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
      add(wg, hubG, gold, 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
      add(wg, spokeG, cream);
      wheels.push(wg);
    }
    rods.push(add(train, box(0.08, 0.1, 2.75), gold, s * 1.28, 0.6, 0.1));
  }
  const smoke = smokePuffs(train, 5, 0xf0f0f8, 0, 3.9, 1.5, 3, 0.6);
  return (t, beat, k) => {
    train.position.y = Math.abs(Math.sin(beat * TAU)) * 0.05;
    train.rotation.z = Math.sin(beat * PI) * 0.02;
    const a = -t * 5 * (1 + k);
    for (const w of wheels) w.rotation.x = a;
    for (const r of rods) { r.position.y = 0.6 + Math.sin(a) * 0.3; r.position.z = 0.1 + Math.cos(a) * 0.3; }
    smoke(t, 0.5 + 0.5 * k);
  };
}

function bossDragonKite(group: THREE.Group): Upd {
  const kite = grp(group, 0, 5, 0);
  const red = std(0xe8504f, { roughness: 0.85 }), gold = std(0xffc93c, { roughness: 0.7 }), green = std(0x6cd24a, { roughness: 0.85 });
  const white = std(0xffffff, { roughness: 0.3 }), dark = std(0x2a1a3a, { roughness: 0.3 });
  add(kite, rbox(1.6, 1.3, 1.2, 0.3), red);
  add(kite, rbox(1.2, 0.7, 0.9, 0.25), red, 0, -0.25, 0.85);
  for (const s of [-1, 1]) {
    add(kite, sph(0.07, 8, 6), dark, s * 0.25, -0.05, 1.3);
    add(kite, sph(0.3, 14, 10), white, s * 0.42, 0.38, 0.55);
    add(kite, sph(0.14, 10, 8), dark, s * 0.4, 0.38, 0.82);
    add(kite, sph(0.045, 6, 4), white, s * 0.4 + 0.05, 0.45, 0.94);
    add(kite, cone(0.14, 0.7, 8), gold, s * 0.45, 0.9, -0.2, 1, 1, 1, -0.5, 0, -s * 0.3);
    add(kite, tube([[s * 0.6, -0.35, 1.2], [s * 1.1, -0.5, 1.3], [s * 1.5, -0.3, 1.1], [s * 1.7, -0.6, 0.9]], 0.03, 16, 4), gold);
    add(kite, sph(0.12, 8, 6), std(0xff8a9a), s * 0.5, -0.3, 1.25, 1, 0.5, 0.4);
  }
  add(kite, tor(0.2, 0.04, 4, 12, PI), dark, 0, -0.42, 1.31, 1, 1, 1, 0, 0, PI);
  for (let i = 0; i < 5; i++) add(kite, cone(0.25, 0.7, 8), green, -0.6 + i * 0.3, 0.6, -0.6, 1, 1, 0.5, -0.9);
  const segCols = [gold, green, red, std(0x46a0ff, { roughness: 0.85 })];
  const segs: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) {
    const sg = grp(kite, 0, 0, -1.2 - i * 0.75), sz = 0.9 - i * 0.05;
    add(sg, box(sz, sz, 0.06), segCols[i % 4], 0, 0, 0, 1, 1, 1, 0, 0, PI / 4);
    add(sg, cone(0.08, 0.5, 6), segCols[(i + 2) % 4], 0, -sz * 0.75, 0, 1, 1, 0.3, 0, 0, PI);
    segs.push(sg);
  }
  const str = add(kite, cyl(0.015, 0.015, 1, 4), std(0xffffff), 0, -2.8, 0.8);
  const dir = new THREE.Vector3(0, -4.4, 1.6);
  str.scale.y = dir.length();
  str.quaternion.setFromUnitVectors(UP, dir.normalize());
  return (t, _beat, k) => {
    kite.position.set(Math.sin(t * 0.7) * 0.6 * (1 + k), 5 + Math.sin(t * 1.3) * 0.4, 0);
    kite.rotation.z = Math.sin(t * 1.1) * 0.12 * (1 + k);
    kite.rotation.x = Math.sin(t * 0.9) * 0.08;
    segs.forEach((sg, i) => {
      sg.position.x = Math.sin(t * 2.2 - i * 0.6) * 0.5 * (1 + k);
      sg.position.y = -0.2 + Math.sin(t * 3 - i * 0.5) * 0.3 - i * 0.08;
      sg.rotation.y = Math.sin(t * 2.2 - i * 0.6) * 0.4;
    });
  };
}

function bossStormMachine(group: THREE.Group): Upd {
  const red = std(0xe8504f), dark = metal(0x4a5262), brass = metal(0xffc533), cream = std(0xfff1d6), black = std(0x1a1030);
  const mach = grp(group);
  add(mach, rbox(3, 2.2, 2, 0.25), red, 0, 1.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(mach, cyl(0.12, 0.16, 0.4, 8), dark, sx * 1.2, 0.2, sz * 0.75);
  const needles: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    add(mach, cyl(0.38, 0.38, 0.08, 20), cream, s * 0.8, 1.85, 1.02, 1, 1, 1, PI / 2);
    add(mach, tor(0.38, 0.05, 5, 20), brass, s * 0.8, 1.85, 1.05);
    const n = grp(mach, s * 0.8, 1.85, 1.08);
    add(n, box(0.04, 0.3, 0.02), black, 0, 0.13, 0);
    needles.push(n);
    add(mach, cyl(0.15, 0.15, 1.6, 10), brass, s * 0.9, 3.3, 0);
  }
  add(mach, box(0.7, 0.08, 0.04), black, 0, 0.85, 1.02);
  add(mach, box(0.45, 0.5, 0.04), black, 0, 1.12, 1.02);
  add(mach, box(0.46, 0.08, 0.05), std(0xffc93c), 0, 0.95, 1.03);
  [0x6cd24a, 0xffc93c, 0x46a0ff].forEach((c, i) => add(mach, cyl(0.1, 0.1, 0.1, 10), std(c), -0.5 + i * 0.5, 2.58, 0.6));
  const lever = grp(mach, 1.55, 1.6, 0.3);
  add(lever, cyl(0.05, 0.05, 0.9, 6), dark, 0, 0.4, 0);
  add(lever, sph(0.14, 10, 8), std(0xff4a4a), 0, 0.85, 0);
  const cl = cloud(group, 0x8a94b8, 1.4, 0, 4.7, 0);
  face(cl, 0, -0.1, 1.42, 2.2, { smile: false });
  const boltM = glow(0xfff27a, 2), boltG = ext(zigShape(2.6), 0.2, 0.04, 2), bolts: THREE.Object3D[] = [];
  for (const [x, z] of [[-2.2, 0], [2.3, 0.2], [-0.4, 0.9]]) bolts.push(add(group, boltG, boltM, x, 1.4, z));
  return (t, beat, k) => {
    cl.position.y = 4.7 + Math.sin(t * 1.2) * 0.15;
    needles.forEach((n, i) => { n.rotation.z = Math.sin(t * 3 + i * 2) * 1.2 * (0.4 + k); });
    lever.rotation.z = -0.3 + Math.sin(beat * PI) * 0.4 * k;
    mach.position.x = Math.sin(t * 30) * 0.03 * k;
    const p = ((beat % 1) + 1) % 1, b = Math.floor(beat);
    bolts.forEach((bo, i) => { bo.visible = k > 0.15 && p < 0.22 && (b + i) % 2 === 0; });
  };
}

function bossMirrorMomo(group: THREE.Group): Upd {
  const body = grp(group, 0, 2.2, 0);
  const tex = ballTex("#8e5be8", momoBands("#ffffff", "#3a1a6a"));
  add(body, sph(2.2, 32, 24), std(0xffffff, { map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15 }));
  const white = std(0xffffff, { roughness: 0.25 }), dark = std(0x2a1a3a, { roughness: 0.3 });
  for (const s of [-1, 1]) {
    add(body, sph(0.62, 16, 12), white, s * 0.65, 0.5, 1.8, 1, 1.1, 0.6);
    add(body, sph(0.3, 12, 9), dark, s * 0.58, 0.42, 2.12, 1, 1, 0.5);
    add(body, sph(0.08, 6, 4), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }), s * 0.58 + 0.1, 0.52, 2.24);
    add(body, capsule(0.07, 0.5, 6), dark, s * 0.65, 1.32, 1.82, 1, 1, 1, 0, 0, PI / 2 + s * 0.3);
  }
  add(body, tor(0.35, 0.06, 5, 12, PI * 0.8), dark, 0.1, -0.3, 2.08, 1, 1, 1, 0, 0, PI + 0.2);
  const sprout = grp(body, 0, 2.15, 0);
  add(sprout, cyl(0.12, 0.16, 0.9, 8), std(0xc03fa0), 0, 0.45, 0);
  const leaf = std(0xff6fd8, { roughness: 0.5 });
  for (const s of [-1, 1]) add(sprout, sph(0.45, 12, 8), leaf, s * 0.42, 0.95, 0, 1.5, 0.35, 0.8, 0, 0, s * 0.5);
  const sparks: THREE.Object3D[] = [], sg = new THREE.OctahedronGeometry(0.2, 0), sm = glow(0xf0e0ff, 1.6);
  for (let i = 0; i < 4; i++) sparks.push(add(group, sg, sm, Math.cos(i * 1.6) * 3, 1.5 + i * 0.8, Math.sin(i * 1.6) * 1.5 + 0.8));
  return (t, beat, k) => {
    const b = beatBounce(beat), sq = (1 - b) * 0.08;
    body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    body.position.y = 2.2 * (1 - sq) + b * 0.6 * (0.4 + k);
    body.rotation.y = Math.sin(t * 0.7) * 0.25;
    sprout.rotation.z = Math.sin(t * 4) * 0.15;
    sparks.forEach((s, i) => { s.rotation.y = t * 2 + i; s.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 3 + i))); });
  };
}

function bossClock(group: THREE.Group): Upd {
  const brick = std(0xd98a5a), cream = std(0xfff1d6), gold = metal(0xffc533), dark = std(0x2a1a3a);
  const tower = grp(group);
  add(tower, rbox(2.6, 5.2, 2.0, 0.2), brick, 0, 2.6, 0);
  add(tower, rbox(2.8, 0.25, 2.2, 0.08), cream, 0, 5.25, 0);
  add(tower, rbox(2.8, 0.3, 2.2, 0.08), cream, 0, 0.15, 0);
  const roofG = cone(1.98, 1.6, 4);
  roofG.rotateY(PI / 4);
  add(tower, roofG, std(0x5a6ad0), 0, 6.2, 0);
  add(tower, sph(0.18, 10, 8), gold, 0, 7.1, 0);
  const [c, x] = canvas(256, 256);
  x.fillStyle = "#fff6e0"; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "#5a3a6a"; x.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, big = i % 3 === 0;
    x.lineWidth = big ? 9 : 5;
    x.beginPath(); x.moveTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); x.lineTo(128 + Math.sin(a) * (big ? 92 : 100), 128 - Math.cos(a) * (big ? 92 : 100)); x.stroke();
  }
  x.fillStyle = "#7b3fe4"; x.font = "900 40px 'Lilita One', system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  for (const [n, a] of [["12", 0], ["3", 0.25], ["6", 0.5], ["9", 0.75]] as const) x.fillText(n, 128 + Math.sin(a * TAU) * 72, 128 - Math.cos(a * TAU) * 72);
  add(tower, new THREE.CircleGeometry(1.05, 32), std(0xffffff, { map: texOf(c), roughness: 0.6 }), 0, 3.6, 1.012);
  add(tower, tor(1.08, 0.09, 6, 32), gold, 0, 3.6, 1.02);
  const minute = grp(tower, 0, 3.6, 1.06), hour = grp(tower, 0, 3.6, 1.04);
  add(minute, rbox(0.1, 0.85, 0.04, 0.03), dark, 0, 0.35, 0);
  add(hour, rbox(0.15, 0.55, 0.04, 0.04), dark, 0, 0.22, 0);
  add(tower, sph(0.09, 8, 6), gold, 0, 3.6, 1.09);
  add(tower, rbox(0.8, 1.2, 0.1, 0.1), std(0x7a4f30), 0, 0.75, 1.0);
  for (const s of [-1, 1]) add(tower, rbox(0.4, 0.6, 0.06, 0.05), std(0xbfe8ff, { roughness: 0.2 }), s * 0.7, 1.9, 1.0);
  const gears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = grp(tower, s * 1.32, 1.8 + (s > 0 ? 1.2 : 0), 0.2), inner = grp(g);
    add(inner, cyl(0.5, 0.5, 0.12, 16), gold, 0, 0, 0, 1, 1, 1, 0, 0, PI / 2);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; add(inner, box(0.12, 0.18, 0.18), gold, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 1, 1, 1, a); }
    inner.userData.s = s;
    gears.push(inner);
  }
  return (t, beat, k) => {
    const b = Math.floor(beat) + Math.min(1, (((beat % 1) + 1) % 1) * 6);
    minute.rotation.z = (-b * TAU) / 12;
    hour.rotation.z = (-b * TAU) / 144;
    for (const g of gears) g.rotation.x = t * (0.8 + 2 * k) * (g.userData.s as number);
    tower.rotation.z = Math.sin(beat * PI) * 0.012 * k;
  };
}

function bossPinball(group: THREE.Group): Upd {
  const base = std(0x3a2a63, { roughness: 0.45 }), white = std(0xffffff), chrome = std(0xe0e8f0, { metalness: 0.8, roughness: 0.15 });
  add(group, rbox(7, 0.3, 3.4, 0.12), base, 0, 0.15, 0);
  const neon = glow(0xff6fd8, 1.2);
  for (const z of [-1.7, 1.7]) add(group, box(7, 0.08, 0.08), neon, 0, 0.32, z);
  add(group, rbox(7, 3, 0.4, 0.15), base, 0, 1.65, -1.9);
  add(group, ext(star(0.7, 0.3), 0.1, 0.03, 2), std(0xffc93c), 0, 1.7, -1.66);
  const lights: THREE.MeshStandardMaterial[] = [], lc = [0xff6fd8, 0x7ffcff, 0xffe65a, 0x9be34a];
  for (let i = 0; i < 7; i++) { const m = glow(lc[i % 4], 1); lights.push(m); add(group, sph(0.16, 8, 6), m, -3 + i, 2.85, -1.68); }
  const rings: THREE.MeshStandardMaterial[] = [];
  [[-2, -0.5, 0xff6fd8], [2, -0.5, 0x7ffcff], [0, 0.4, 0xffe65a]].forEach(([x, z, c]) => {
    const b = grp(group, x, 0.3, z), rm = glow(c, 1);
    add(b, cyl(0.65, 0.7, 0.8, 20), white, 0, 0.4, 0);
    add(b, cyl(0.72, 0.72, 0.16, 20), rm, 0, 0.55, 0);
    add(b, hemi(0.55, 16, 6), std(c), 0, 0.8, 0);
    face(b, 0, 0.32, 0.67, 1.2);
    rings.push(rm);
  });
  const fs = new THREE.Shape();
  fs.absarc(0, 0, 0.35, PI / 2, (3 * PI) / 2, false);
  fs.lineTo(1.8, -0.14);
  fs.absarc(1.8, 0, 0.14, -PI / 2, PI / 2, false);
  fs.lineTo(0, 0.35);
  const flipG = ext(fs, 0.3, 0.05, 10), pivots: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const m = grp(group, s * 1.5, 0.48, 1.25);
    m.scale.x = -s;
    const inner = grp(m);
    add(inner, flipG, std(s < 0 ? 0xe8504f : 0xffc93c, { roughness: 0.45 }), 0, 0, 0, 1, 1, 1, -PI / 2);
    pivots.push(inner);
  }
  const ball = add(group, sph(0.5, 20, 14), chrome, 0, 0.85, 0);
  return (t, beat, k) => {
    const p = ((beat % 1) + 1) % 1;
    const flip = (p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.35)) * (0.5 + 0.5 * k);
    for (const pv of pivots) pv.rotation.y = -0.4 + flip * 0.9;
    const kk = Math.pow(1 - p, 3);
    for (const r of rings) r.emissiveIntensity = 0.8 + 1.5 * kk;
    lights.forEach((m, i) => { m.emissiveIntensity = (Math.floor(beat * 2) + i) % 3 === 0 ? 2 : 0.5; });
    ball.position.set(Math.sin(t * 1.7) * 2.4, 0.85 + Math.abs(Math.sin(t * 4)) * 0.5 * (0.5 + k), Math.cos(t * 1.3) * 0.6);
  };
}

function bossPiano(group: THREE.Group): Upd {
  const black = std(0x1a1a2a, { roughness: 0.25 }), white = std(0xffffff, { roughness: 0.4 }), gold = metal(0xffc533);
  const s = new THREE.Shape();
  s.moveTo(-2.4, 0); s.lineTo(2.4, 0); s.lineTo(2.4, 1.6);
  s.bezierCurveTo(2.4, 3.0, 0.4, 2.6, 0.1, 4.4);
  s.quadraticCurveTo(-0.2, 5.6, -1.4, 5.6);
  s.lineTo(-2.4, 5.6); s.closePath();
  add(group, ext(s, 1.0, 0.08, 12), black, 0, 1.6, 0, 1, 1, 1, -PI / 2);
  const lid = grp(group, -2.45, 2.15, 0);
  add(lid, ext(s, 0.06, 0.02, 12), black, 2.45, 0, 0, 1, 1, 1, -PI / 2);
  lid.rotation.z = 0.55;
  add(group, cyl(0.04, 0.04, 1.6, 6), gold, 1.2, 2.8, -2.6, 1, 1, 1, 0, 0, 0.3);
  for (const [x, z] of [[-2.1, -0.5], [2.1, -0.5], [-1.7, -4.8]]) {
    add(group, cyl(0.14, 0.1, 1.1, 10), black, x, 0.55, z);
    add(group, sph(0.12, 8, 6), gold, x, 0.06, z);
  }
  add(group, rbox(4.9, 0.25, 1.0, 0.06), black, 0, 1.3, 0.45);
  face(group, 0, 1.85, 0.09, 1.5);
  const keys: THREE.Group[] = [], bkeys: THREE.Group[] = [], wk = box(0.32, 0.16, 0.85), bk = box(0.2, 0.16, 0.5);
  for (let i = 0; i < 14; i++) { const kg = grp(group, -2.24 + i * 0.345, 1.5, 0.5); add(kg, wk, white); keys.push(kg); }
  for (const i of [0, 1, 3, 4, 5, 7, 8, 10, 11, 12]) { const kg = grp(group, -2.24 + (i + 0.5) * 0.345, 1.62, 0.3); add(kg, bk, black); bkeys.push(kg); }
  add(group, rbox(2.2, 0.9, 0.08, 0.04), black, 0, 2.55, -0.25, 1, 1, 1, -0.25);
  const [c, x] = canvas(128, 64);
  x.fillStyle = "#fff6e0"; x.fillRect(0, 0, 128, 64);
  x.strokeStyle = "#7a6a8a"; x.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(6, 16 + i * 8); x.lineTo(122, 16 + i * 8); x.stroke(); }
  x.fillStyle = "#3a2a5a";
  for (let i = 0; i < 6; i++) { const nx = 18 + i * 19, ny = 20 + ((i * 5) % 4) * 7; x.beginPath(); x.ellipse(nx, ny + 6, 5, 4, -0.4, 0, TAU); x.fill(); x.fillRect(nx + 3.5, ny - 12, 2, 18); }
  add(group, new THREE.PlaneGeometry(1.9, 0.7), std(0xffffff, { map: texOf(c), roughness: 0.7 }), 0, 2.56, -0.2, 1, 1, 1, -0.25);
  const notes: { g: THREE.Group; o: number }[] = [], noteCols = [0xff6fd8, 0xffd84d, 0x7fd6ff];
  for (let i = 0; i < 3; i++) {
    const g = grp(group), m = std(noteCols[i], { emissive: noteCols[i], emissiveIntensity: 0.4 });
    add(g, sph(0.16, 10, 8), m, 0, 0, 0, 1.2, 0.9, 0.7);
    add(g, cyl(0.03, 0.03, 0.5, 6), m, 0.15, 0.25, 0);
    notes.push({ g, o: i / 3 });
  }
  return (t, beat, k) => {
    const step = Math.floor(beat * 2);
    keys.forEach((kg, i) => {
      const on = i === step % 14 || i === (step * 5 + 3) % 14 || (k > 0.5 && i === (step * 3 + 7) % 14);
      kg.position.y = on ? 1.42 : 1.5;
    });
    bkeys.forEach((kg, i) => { kg.position.y = i === (step * 7 + 2) % 10 ? 1.55 : 1.62; });
    lid.rotation.z = 0.55 + Math.sin(beat * PI) * 0.05 * k;
    for (const n of notes) {
      const f = (((t * 0.3 + n.o) % 1) + 1) % 1;
      n.g.position.set(-1.8 + n.o * 3.6 + Math.sin(f * 6 + n.o * 4) * 0.3, 2.6 + f * 2.8, 0.4);
      n.g.scale.setScalar(Math.sin(f * PI) * 1.2);
    }
  };
}

export function bossView(id: string): BossView {
  const group = new THREE.Group();
  const builders: Record<string, (g: THREE.Group) => Upd> = {
    "kranky-giant": bossKranky, "gloop-king": bossGloopKing, mothership: bossMothership, "mega-robot": bossMegaRobot,
    volcano: bossVolcano, wave: bossWave, avalanche: bossAvalanche, tower: bossTower, train: bossTrain,
    "dragon-kite": bossDragonKite, "storm-machine": bossStormMachine, "mirror-momo": bossMirrorMomo,
    clock: bossClock, pinball: bossPinball, piano: bossPiano,
  };
  const update = (builders[id] ?? bossKranky)(group);
  update(0, 0, 0);
  return { group, update };
}

// ---------------------------------------------------------------- characters
// `body` (radius 0.34) rolls; `top` stays upright. Like Momo's sprout, `top` is placed by the renderer with its origin
// on top of the ball (≈ 0.32 above the centre, so the centre is at about (0, −0.32, 0) in `top` space). Front = −z
// (the rolling direction); the chase camera sees the +z side, so the back gets the fun bits (fins, tails, scarf ends).
type Pattern = (x: CanvasRenderingContext2D) => void;
const dots = (col: string, alpha: number, pts: number[][]): Pattern => (x) => {
  x.globalAlpha = alpha; x.fillStyle = col;
  for (const [px, py, r] of pts) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
};
const LOOK: Record<string, { base: string; pattern: Pattern; rough?: number }> = {
  momo: { base: "#ff8a3d", pattern: momoBands("#ffffff", "#b8481a") },
  kranky: {
    base: "#e8504f",
    pattern: (x) => {
      x.globalAlpha = 0.45; x.fillStyle = "#ff9a8a"; x.fillRect(0, 54, 256, 20);
      dots("#a02a2a", 0.35, [[20, 24, 8], [70, 34, 6], [120, 20, 9], [170, 30, 7], [220, 22, 8], [40, 100, 7], [100, 108, 9], [150, 96, 6], [205, 104, 8]])(x);
    },
  },
  tiki: {
    base: "#2ec4b6",
    pattern: (x) => {
      x.globalAlpha = 0.5; x.strokeStyle = "#13857a"; x.lineWidth = 5; x.lineCap = "round";
      for (const [y, off] of [[28, 0], [98, 16]]) for (let i = 0; i < 8; i++) { const cx = i * 32 + off; x.beginPath(); x.moveTo(cx - 10, y - 8); x.lineTo(cx, y + 4); x.lineTo(cx + 10, y - 8); x.stroke(); }
      x.globalAlpha = 0.8; x.fillStyle = "#8e5be8"; x.fillRect(0, 58, 256, 12);
      x.globalAlpha = 1;
    },
  },
  pip: {
    base: "#2e3f78",
    pattern: (x) => {
      x.fillStyle = "#ffffff";
      x.beginPath(); x.moveTo(128, 0);
      for (let y = 0; y <= 128; y += 8) x.lineTo(128 + Math.sin(y / 20) * 5, y);
      x.lineTo(256, 128); x.lineTo(256, 0); x.closePath(); x.fill();
      dots("#ff9a3d", 0.9, [[192, 118, 7], [210, 118, 7]])(x);
    },
  },
  gloop: {
    base: "#9be34a",
    rough: 0.22,
    pattern: (x) => {
      dots("#5aa02a", 0.35, [[30, 40, 10], [90, 90, 14], [150, 30, 8], [200, 80, 12], [240, 20, 7]])(x);
      x.globalAlpha = 0.6; x.strokeStyle = "#e6ffb8"; x.lineWidth = 3;
      for (const [px, py, r] of [[60, 30, 8], [120, 70, 6], [180, 110, 9], [230, 50, 5], [20, 100, 6]]) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.stroke(); }
      x.globalAlpha = 1;
    },
  },
  hoot: {
    base: "#9a6b45",
    pattern: (x) => {
      x.fillStyle = "#f0d8b0"; x.beginPath(); x.ellipse(64, 70, 42, 34, 0, 0, TAU); x.fill();
      x.globalAlpha = 0.45; x.strokeStyle = "#5a3a20"; x.lineWidth = 3;
      for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
        const cx = i * 22 + (row % 2) * 11, cy = 14 + row * 20;
        if (Math.hypot((cx - 64) / 42, (cy - 70) / 34) < 1) continue;
        x.beginPath(); x.arc(cx, cy, 8, 0.2, PI - 0.2); x.stroke();
      }
      x.globalAlpha = 1;
    },
  },
  bonbon: {
    base: "#ff6f91",
    pattern: (x) => {
      x.fillStyle = "#fff6e0"; x.fillRect(0, 36, 256, 14);
      for (let i = 0; i < 16; i++) { x.beginPath(); x.ellipse(i * 16 + 8, 50, 5, 6 + (i % 3) * 3, 0, 0, TAU); x.fill(); }
      const cols = ["#ffd84d", "#7fd6ff", "#9be34a", "#ffffff", "#8e5be8"];
      x.lineWidth = 3; x.lineCap = "round";
      for (let i = 0; i < 40; i++) {
        const px = (i * 53) % 256, py = 66 + ((i * 37) % 56), a = i * 1.3;
        x.strokeStyle = cols[i % cols.length];
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6); x.stroke();
      }
    },
  },
  zib: {
    base: "#8e5be8",
    pattern: (x) => {
      dots("#c49bff", 0.75, [[24, 30, 10], [80, 60, 14], [140, 24, 8], [190, 70, 12], [240, 34, 9], [50, 104, 9], [120, 100, 11], [210, 112, 8]])(x);
      dots("#fff27a", 0.9, [[60, 20, 2.5], [110, 46, 2], [170, 100, 2.5], [228, 84, 2], [20, 70, 2]])(x);
    },
  },
  turbo: {
    base: "#ff6b3d",
    pattern: (x) => {
      x.strokeStyle = "#ffe6b0"; x.lineWidth = 5; x.globalAlpha = 0.85;
      for (const cx of [64, 192]) {
        x.beginPath();
        for (let a = 0; a < 4 * PI; a += 0.2) { const r = 3 + a * 4.2; x.lineTo(cx + Math.cos(a) * r, 64 + Math.sin(a) * r); }
        x.stroke();
      }
      x.globalAlpha = 1;
    },
  },
  bolt: {
    base: "#1e9c91",
    pattern: (x) => {
      x.strokeStyle = "#0e6a62"; x.lineWidth = 3;
      for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
      for (const y of [32, 64, 96]) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
      x.fillStyle = "#c8d0dc";
      for (let i = 0; i < 256; i += 32) for (const y of [32, 64, 96]) { x.beginPath(); x.arc(i + 4, y + 4, 2.5, 0, TAU); x.fill(); }
      ["#e8504f", "#ffc93c", "#6cd24a", "#46a0ff"].forEach((c, i) => { x.fillStyle = c; x.fillRect(42 + (i % 2) * 22, 42 + Math.floor(i / 2) * 22, 16, 16); });
    },
  },
  noodle: {
    base: "#d49452",
    pattern: (x) => {
      x.fillStyle = "#f0c890"; x.fillRect(0, 92, 256, 20);
      x.globalAlpha = 0.7; x.fillStyle = "#7a4a2a";
      for (const [px, py, rx, ry] of [[40, 40, 22, 14], [130, 30, 16, 12], [200, 56, 24, 16], [90, 74, 12, 9]]) { x.beginPath(); x.ellipse(px, py, rx, ry, 0.4, 0, TAU); x.fill(); }
      x.globalAlpha = 1;
    },
  },
};

function buildTop(id: string, top: THREE.Group) {
  const dark = () => std(0x1a1030, { roughness: 0.35 });
  switch (id) {
    case "kranky": {
      const red = std(0xe8504f), white = std(0xffffff, { roughness: 0.3 }), black = dark();
      const hat = grp(top, 0, -0.01, 0.04);
      hat.rotation.z = 0.15;
      add(hat, cyl(0.17, 0.17, 0.025, 16), black);
      add(hat, cyl(0.11, 0.12, 0.18, 14), black, 0, 0.1, 0);
      add(hat, cyl(0.122, 0.125, 0.04, 14), std(0xffc93c), 0, 0.035, 0);
      for (const s of [-1, 1]) {
        add(top, cyl(0.015, 0.02, 0.16, 6), red, s * 0.1, 0.02, -0.15, 1, 1, 1, -0.3);
        add(top, sph(0.045, 10, 8), white, s * 0.1, 0.1, -0.18);
        add(top, sph(0.022, 8, 6), black, s * 0.1, 0.1, -0.22);
      }
      break;
    }
    case "tiki": {
      const purple = std(0x8e5be8), teal = std(0x2ec4b6), fg = sph(0.05, 8, 6);
      for (const k of [-1, 0, 1]) add(top, fg, purple, k * 0.05, 0.09 - Math.abs(k) * 0.02, 0.02, 0.8, 2.2, 0.8, 0, 0, -k * 0.45);
      for (const s of [-1, 1]) add(top, fg, teal, s * 0.05, -0.12, 0.33, 0.7, 2, 0.7, 0.9, 0, s * 0.3);
      add(top, cone(0.035, 0.09, 8), std(0xff9a3d), 0, -0.1, -0.34, 1, 1, 1, -PI / 2);
      break;
    }
    case "pip": {
      const red = std(0xe8304f), black = dark();
      add(top, tor(0.27, 0.05, 6, 22), red, 0, -0.1, 0, 1, 1, 1, PI / 2);
      add(top, sph(0.06, 8, 6), red, 0.14, -0.08, 0.23);
      add(top, rbox(0.06, 0.18, 0.025, 0.02), red, 0.13, -0.19, 0.27, 1, 1, 1, 0.3, 0, 0.2);
      add(top, rbox(0.06, 0.16, 0.025, 0.02), red, 0.2, -0.18, 0.24, 1, 1, 1, 0.3, 0, -0.3);
      for (const k of [-1, 0, 1]) add(top, sph(0.025, 6, 4), black, k * 0.025, 0.03, 0, 1, 2.4, 1, 0, 0, -k * 0.4);
      add(top, cone(0.035, 0.08, 8), std(0xff9a3d), 0, -0.07, -0.31, 1, 1, 1, -PI / 2);
      break;
    }
    case "gloop": {
      const lime = std(0x9be34a, { roughness: 0.22, emissive: 0x3a8a10, emissiveIntensity: 0.15 }), white = std(0xffffff, { roughness: 0.3 });
      add(top, sph(0.07, 10, 8), lime, 0, 0, 0);
      add(top, cone(0.06, 0.15, 10), lime, 0.01, 0.1, 0, 1, 1, 1, 0, 0, -0.3);
      add(top, rbox(0.08, 0.1, 0.04, 0.015), white, 0.03, -0.14, -0.31, 1, 1, 1, 0.3);
      for (const s of [-1, 1]) {
        add(top, sph(0.05, 10, 8), white, s * 0.07, -0.01, -0.18);
        add(top, sph(0.024, 8, 6), dark(), s * 0.07, -0.01, -0.225);
        add(top, sph(0.04, 8, 6), lime, s * 0.31, -0.25, 0.06, 1, 1.5, 1);
      }
      break;
    }
    case "hoot": {
      const navy = std(0x2a2a4a), gold = std(0xffc93c), black = dark(), lens = std(0xbfe8ff, { roughness: 0.1, transparent: true, opacity: 0.6 });
      add(top, cyl(0.12, 0.13, 0.08, 14), navy, 0, 0.03, 0);
      add(top, box(0.32, 0.025, 0.32), navy, 0, 0.08, 0, 1, 1, 1, 0, PI / 4);
      add(top, sph(0.025, 6, 4), gold, 0, 0.095, 0);
      add(top, cyl(0.01, 0.01, 0.12, 4), gold, 0.17, 0.03, 0.04);
      add(top, sph(0.025, 6, 4), gold, 0.17, -0.04, 0.04);
      for (const s of [-1, 1]) {
        add(top, tor(0.07, 0.015, 5, 16), black, s * 0.08, -0.08, -0.3);
        add(top, cyl(0.065, 0.065, 0.01, 14), lens, s * 0.08, -0.08, -0.3, 1, 1, 1, PI / 2);
        add(top, cone(0.04, 0.1, 6), std(0x7a4f30), s * 0.15, 0.0, -0.05, 1, 1, 1, 0, 0, -s * 0.4);
      }
      add(top, box(0.03, 0.015, 0.015), black, 0, -0.08, -0.3);
      break;
    }
    case "bonbon": {
      const white = std(0xffffff, { roughness: 0.75 }), pink = std(0xff6f91);
      add(top, cyl(0.13, 0.12, 0.08, 16), white, 0, 0.04, 0);
      for (const [x, z] of [[0.06, 0.06], [-0.06, 0.06], [0.06, -0.06], [-0.06, -0.06]]) add(top, sph(0.09, 10, 8), white, x, 0.13, z);
      add(top, sph(0.11, 12, 9), white, 0, 0.17, 0);
      for (const s of [-1, 1]) add(top, sph(0.05, 8, 6), pink, s * 0.17, -0.04, 0.02, 1, 1.1, 0.6);
      break;
    }
    case "zib": {
      const purple = std(0x8e5be8);
      add(top, cyl(0.012, 0.016, 0.12, 6), purple, 0, 0.06, 0);
      add(top, cyl(0.012, 0.012, 0.1, 6), purple, 0.02, 0.15, 0, 1, 1, 1, 0, 0, -0.4);
      add(top, sph(0.04, 10, 8), glow(0x9be34a, 1.6), 0.045, 0.21, 0);
      add(top, sph(0.11, 14, 10), std(0xffffff, { roughness: 0.25 }), 0, -0.12, -0.27, 1, 1, 0.6);
      add(top, sph(0.05, 10, 8), dark(), 0, -0.12, -0.335, 1, 1, 0.5);
      break;
    }
    case "turbo": {
      const steel = metal(0xc8d0dc), lens = std(0x7fd6ff, { roughness: 0.15 }), body = std(0xc8e06a), orange = std(0xff6b3d);
      add(top, tor(0.27, 0.025, 4, 22), std(0x6a3a2a), 0, -0.1, 0, 1, 1, 1, PI / 2);
      for (const s of [-1, 1]) {
        add(top, tor(0.05, 0.016, 5, 12), steel, s * 0.08, -0.08, -0.29);
        add(top, cyl(0.045, 0.045, 0.01, 12), lens, s * 0.08, -0.08, -0.29, 1, 1, 1, PI / 2);
        add(top, cyl(0.012, 0.015, 0.16, 5), body, s * 0.05, 0.07, -0.06, 1, 1, 1, -0.4, 0, -s * 0.2);
        add(top, sph(0.025, 6, 4), body, s * 0.07, 0.14, -0.1);
      }
      for (const a of [-0.9, 0, 0.9]) add(top, box(0.02, 0.12, 0.1), orange, Math.sin(a) * 0.08, -0.06 + Math.cos(a) * 0.04, 0.29, 1, 1, 1, 0.5, 0, a);
      add(top, cyl(0.05, 0.065, 0.08, 10), steel, 0, -0.14, 0.33, 1, 1, 1, PI / 2);
      add(top, cone(0.04, 0.12, 8), glow(0xffa53d, 1.8), 0, -0.14, 0.42, 1, 1, 1, PI / 2);
      break;
    }
    case "bolt": {
      const steel = metal(0xc8d0dc), screen = std(0x10302e, { roughness: 0.3 }), eyeM = glow(0x7ffcff, 1.6);
      add(top, cyl(0.012, 0.012, 0.16, 6), steel, 0, 0.08, 0);
      add(top, sph(0.035, 8, 6), glow(0xff4a4a, 1.4), 0, 0.18, 0);
      add(top, rbox(0.2, 0.13, 0.04, 0.02), screen, 0, 0.0, -0.13, 1, 1, 1, 0.35);
      for (const s of [-1, 1]) {
        add(top, box(0.025, 0.035, 0.01), eyeM, s * 0.04, 0.02, -0.155, 1, 1, 1, 0.35);
        add(top, cyl(0.04, 0.04, 0.05, 10), steel, s * 0.32, -0.2, 0, 1, 1, 1, 0, 0, PI / 2);
      }
      add(top, tor(0.025, 0.007, 3, 8, PI), eyeM, 0, -0.015, -0.152, 1, 1, 1, 0.35, 0, PI);
      break;
    }
    case "noodle": {
      const brown = std(0x7a4a2a), tan = std(0xd49452);
      for (const s of [-1, 1]) add(top, sph(0.07, 10, 8), brown, s * 0.2, -0.06, -0.05, 0.6, 1.5, 0.35, 0, 0, s * 0.5);
      add(top, sph(0.035, 8, 6), dark(), 0, -0.16, -0.31);
      add(top, cyl(0.015, 0.025, 0.14, 6), tan, 0, -0.08, 0.33, 1, 1, 1, 0.7);
      add(top, tor(0.27, 0.025, 4, 22), std(0xe8304f), 0, -0.1, 0, 1, 1, 1, PI / 2);
      add(top, sph(0.025, 8, 6), metal(0xffc533), 0, -0.13, -0.27);
      break;
    }
    default: {
      // Momo's sprout
      add(top, cyl(0.022, 0.03, 0.2, 6), std(0x3f9e3a), 0, 0.1, 0);
      const leafG = sph(0.075, 10, 6), leafM = std(0x5fd14a, { roughness: 0.5 });
      add(top, leafG, leafM, 0.08, 0.21, 0, 1.5, 0.35, 0.8, 0, 0, 0.5);
      add(top, leafG, leafM, -0.08, 0.2, 0, 1.5, 0.35, 0.8, 0, 0, -0.5);
    }
  }
}

export function ballView(ch: string): BallView {
  const id = LOOK[ch] ? ch : "momo";
  const look = LOOK[id];
  const group = new THREE.Group();
  const tex = ballTex(look.base, look.pattern);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 32, 22),
    std(0xffffff, { map: tex, roughness: look.rough ?? 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 }),
  );
  group.add(body);
  const top = new THREE.Group();
  buildTop(id, top);
  return { group, body, top };
}
