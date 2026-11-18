// Side-island props for every world mood, built from clay primitives. Each kind returns ONE merged geometry with
// vertex colours + tint mask (art/api.ts `paint`): tint-1 parts take the mood's colour for that kind, glow-1 parts
// turn emissive at night. Origin = the base of the prop sitting on an island top (y = 0). Typical height 0.3 – 2.2,
// width ≤ ~1.4. Island kinds (the floating rocks under the props) have their top surface at y = 0 and hang below.
// Keep every kind low-poly enough to be instanced hundreds of times (≲ 1,500 triangles).
import * as THREE from "three";
import { merge, paint, place } from "./api";

type Geo = THREE.BufferGeometry;
type Builder = () => Geo;
/** optional transform: x, y, z, sx, sy, sz, rx, ry, rz (same order as `place`) */
type Xf = [x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number, rx?: number, ry?: number, rz?: number];

const PI = Math.PI, TAU = Math.PI * 2;
const TRUNK = 0x8a5a3a, STEM = 0x4f9e44, CREAM = 0xfff1d6;
const DARK = 0x2a2440, METAL = 0xb8c0cc, METAL_D = 0x5a6274, BRASS = 0xd9a441, WOOD = 0x9a6a42, STONE = 0xb8b09a;
const MOSS = 0x4fa84a, BASALT = 0x3a2a2a, BASALT2 = 0x4a3a3a, PAGE = 0xfff4dc, INK = 0x5a4a6a, SNOW = 0xf6fbff;
const LAMP = 0x3a3f55, WARM = 0xffd36b;
const RAINBOW = [0xff5a5a, 0xffa83a, 0xffe04a, 0x5ad06a, 0x4aa8ff, 0x9a6aff];
const SPRINKLES = [0xff5d8f, 0x46d2ff, 0xffd23d, 0x7ce05f];

// ---------------------------------------------------------------- primitive shorthands (low segment counts)
const sph = (r: number, w = 8, h = 6, ps = 0, pl = TAU, ts = 0, tl = PI) => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl);
const ico = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const dod = (r: number) => new THREE.DodecahedronGeometry(r, 0);
const cyl = (rt: number, rb: number, h: number, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r: number, h: number, s = 8) => new THREE.ConeGeometry(r, h, s);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const tor = (r: number, t: number, rs = 5, ts = 12, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const cap = (r: number, len: number, cs = 2, rs = 7) => new THREE.CapsuleGeometry(r, len, cs, rs);

/** a placed + painted part */
const part = (g: Geo, col: number, tint: number, glow: number, ...t: Xf) =>
  paint(place(g, t[0] ?? 0, t[1] ?? 0, t[2] ?? 0, t[3] ?? 1, t[4] ?? 1, t[5] ?? 1, t[6] ?? 0, t[7] ?? 0, t[8] ?? 0), col, tint, glow);
/** tinted part (takes the mood colour) */
const tp = (g: Geo, ...t: Xf) => part(g, 0xffffff, 1, 0, ...t);
/** tinted + glowing part */
const tg = (g: Geo, ...t: Xf) => part(g, 0xffffff, 1, 1, ...t);
/** fixed-colour part */
const fp = (g: Geo, col: number, ...t: Xf) => part(g, col, 0, 0, ...t);
/** fixed-colour glowing part */
const fg = (g: Geo, col: number, ...t: Xf) => part(g, col, 0, 1, ...t);
/** n items evenly around a circle: f(angle, index) */
const around = <T>(n: number, f: (a: number, i: number) => T): T[] => Array.from({ length: n }, (_, i) => f((i / n) * TAU, i));
/** horizontal ring (torus lying flat) */
const ring = (r: number, t: number, col: number, y: number, ts = 12) => fp(tor(r, t, 4, ts), col, 0, y, 0, 1, 1, 1, PI / 2);

/** a hexagonal crystal shard (prism + pointed tip) whose base sits at (x, y, z), tilted by rx / rz */
function shard(x: number, y: number, z: number, h: number, r: number, rx = 0, rz = 0, col = 0xffffff, tint = 1, glow = 1): Geo[] {
  const dx = -Math.sin(rz), dy = Math.cos(rz) * Math.cos(rx), dz = Math.cos(rz) * Math.sin(rx);
  const tip = h + r * 0.8;
  return [
    part(cyl(r, r * 0.85, h, 6), col, tint, glow, x + (dx * h) / 2, y + (dy * h) / 2, z + (dz * h) / 2, 1, 1, 1, rx, 0, rz),
    part(cone(r, r * 1.6, 6), col, tint, glow, x + dx * tip, y + dy * tip, z + dz * tip, 1, 1, 1, rx, 0, rz),
  ];
}

// ---------------------------------------------------------------- W01 Clay Garden (+ shared basics)
const GARDEN: Record<string, Builder> = {
  pine: () => merge([
    paint(place(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 7), 0, 0.25, 0), TRUNK, 0),
    paint(place(new THREE.ConeGeometry(0.62, 0.8, 8), 0, 0.75, 0), 0xffffff, 1),
    paint(place(new THREE.ConeGeometry(0.5, 0.7, 8), 0, 1.15, 0), 0xffffff, 1),
    paint(place(new THREE.ConeGeometry(0.36, 0.6, 8), 0, 1.52, 0), 0xffffff, 1),
  ]),
  round: () => merge([
    paint(place(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 7), 0, 0.35, 0), TRUNK, 0),
    paint(place(new THREE.IcosahedronGeometry(0.62, 1), 0, 1.05, 0, 1, 0.92, 1), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.34, 1), 0.38, 0.88, 0.1), 0xffffff, 1),
  ]),
  bush: () => merge([
    paint(place(new THREE.IcosahedronGeometry(0.34, 1), 0, 0.26, 0), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.26, 1), 0.3, 0.2, 0.06), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.24, 1), -0.28, 0.18, -0.04), 0xffffff, 1),
  ]),
  flower: () => {
    const parts = [
      paint(place(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 5), 0, 0.21, 0), STEM, 0),
      paint(place(new THREE.SphereGeometry(0.07, 8, 6), 0, 0.44, 0, 1, 0.7, 1), 0xffd23d, 0),
    ];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push(paint(place(new THREE.SphereGeometry(0.075, 7, 5), Math.cos(a) * 0.11, 0.44, Math.sin(a) * 0.11, 1, 0.45, 1.3, 0, -a, 0), 0xffffff, 1));
    }
    parts.push(paint(place(new THREE.SphereGeometry(0.06, 6, 4), 0.06, 0.12, 0, 1.6, 0.4, 0.8, 0, 0, 0.5), STEM, 0));
    return merge(parts);
  },
  sunflower: () => {
    const parts = [
      paint(place(new THREE.CylinderGeometry(0.035, 0.05, 1.3, 6), 0, 0.65, 0), STEM, 0),
      paint(place(new THREE.SphereGeometry(0.14, 8, 6), 0.14, 0.55, 0, 1.6, 0.35, 0.8, 0, 0, 0.6), STEM, 0),
      paint(place(new THREE.SphereGeometry(0.14, 8, 6), -0.14, 0.8, 0, 1.6, 0.35, 0.8, 0, 0, -0.6), STEM, 0),
      paint(place(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), 0, 1.36, 0.02, 1, 1, 1, Math.PI / 2 - 0.25, 0, 0), 0x6b3f1f, 0),
    ];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push(paint(place(new THREE.SphereGeometry(0.09, 7, 5), Math.cos(a) * 0.25, 1.36 + Math.sin(a) * 0.25 * 0.97, Math.sin(a) * 0.06 - 0.01, 0.55, 1.5, 0.5, 0.25, 0, a - Math.PI / 2), 0xffffff, 1));
    }
    return merge(parts);
  },
  mushroom: () => {
    const parts = [
      paint(place(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 9), 0, 0.27, 0), CREAM, 0),
      paint(place(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.5, 0, 1, 0.75, 1), 0xffffff, 1),
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, r = i % 2 ? 0.28 : 0.2;
      parts.push(paint(place(new THREE.SphereGeometry(0.06, 6, 4), Math.cos(a) * r, 0.5 + 0.75 * Math.sqrt(Math.max(0, 0.46 * 0.46 - r * r)) - 0.01, Math.sin(a) * r, 1, 0.45, 1), CREAM, 0));
    }
    return merge(parts);
  },
  lantern: () => merge([
    paint(place(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6), 0, 0.45, 0), STEM, 0),
    paint(place(new THREE.SphereGeometry(0.17, 12, 8), 0, 0.95, 0, 1, 1.15, 1), 0xffffff, 1, 1),
    paint(place(new THREE.ConeGeometry(0.12, 0.12, 8), 0, 1.16, 0), STEM, 0),
    paint(place(new THREE.SphereGeometry(0.1, 8, 6), 0.08, 0.3, 0, 1.6, 0.4, 0.8, 0, 0, 0.5), STEM, 0),
  ]),
  rock: () => merge([
    paint(place(new THREE.DodecahedronGeometry(0.3, 0), 0, 0.14, 0, 1.2, 0.7, 1), 0xffffff, 1),
    paint(place(new THREE.DodecahedronGeometry(0.18, 0), 0.3, 0.08, 0.1, 1, 0.7, 1), 0xffffff, 1),
  ]),
  /** floating island under the side props: tint = top colour; its top surface is at y = 0 */
  island: () => merge([
    paint(place(new THREE.CylinderGeometry(1, 0.96, 0.32, 14), 0, -0.16, 0), 0xffffff, 1),
    paint(place(new THREE.ConeGeometry(0.95, 1.6, 12), 0, -1.12, 0, 1, 1, 1, Math.PI, 0, 0), 0xa86b45, 0),
    paint(place(new THREE.IcosahedronGeometry(0.3, 0), 0.2, -1.9, 0.1), 0x8a5a3a, 0),
  ]),
  /** puffy cloud, tint = the mood's cloud colour */
  cloud: () => merge([
    paint(place(new THREE.IcosahedronGeometry(1, 2), 0, 0, 0, 1.4, 0.8, 1), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.8, 2), 1.2, -0.15, 0.1, 1.2, 0.75, 1), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.75, 2), -1.2, -0.2, -0.1, 1.2, 0.7, 1), 0xffffff, 1),
    paint(place(new THREE.IcosahedronGeometry(0.6, 2), 0.4, 0.45, 0.2), 0xffffff, 1),
  ]),
};

// ---------------------------------------------------------------- W02 Candy Kitchen
const CANDY: Record<string, Builder> = {
  lollipop: () => merge([
    fp(cyl(0.03, 0.03, 1.05, 6), CREAM, 0, 0.52, 0),
    tp(cyl(0.34, 0.34, 0.12, 16), 0, 1.3, 0, 1, 1, 1, PI / 2),
    ...[0.065, -0.065].flatMap((z) => [fp(tor(0.22, 0.035, 4, 16), 0xffffff, 0, 1.3, z), fp(tor(0.1, 0.03, 4, 10), 0xffffff, 0, 1.3, z)]),
  ]),
  cupcake: () => merge([
    fp(cyl(0.3, 0.22, 0.32, 12), 0xfff1f4, 0, 0.16),
    ring(0.3, 0.025, 0xf2c9a0, 0.31, 14),
    tp(ico(0.34), 0, 0.4, 0, 1, 0.5, 1),
    tp(ico(0.25), 0, 0.56, 0, 1, 0.6, 1),
    tp(ico(0.14), 0, 0.71, 0, 1, 0.8, 1),
    fg(sph(0.08), 0xff2e4d, 0, 0.86, 0),
    fp(cyl(0.008, 0.012, 0.14, 4), STEM, 0.03, 0.97, 0, 1, 1, 1, 0, 0, -0.4),
    ...around(6, (a, i) => fp(box(0.07, 0.022, 0.022), SPRINKLES[i % 4], Math.cos(a) * 0.25, 0.52, Math.sin(a) * 0.25, 1, 1, 1, 0, -a, 0.6)),
    ...around(4, (a, i) => fp(box(0.07, 0.022, 0.022), SPRINKLES[(i + 1) % 4], Math.cos(a + 0.6) * 0.15, 0.67, Math.sin(a + 0.6) * 0.15, 1, 1, 1, 0, -a, -0.6)),
  ]),
  donut: () => merge([
    fp(tor(0.3, 0.16, 8, 16), 0xe0a060, 0, 0.47, 0),
    ...[0.07, -0.07].map((z) => tp(tor(0.3, 0.14, 6, 16), 0, 0.47, z, 1.04, 1.04, 0.75)),
    ...[0.18, -0.18].flatMap((z) => around(8, (a, i) => fp(box(0.07, 0.022, 0.022), SPRINKLES[i % 4], Math.cos(a) * 0.3, 0.47 + Math.sin(a) * 0.3, z, 1, 1, 1, 0, 0, a + 0.8))),
  ]),
  candycane: () => merge([
    fp(cyl(0.07, 0.07, 1.25, 8), 0xffffff, 0, 0.625),
    fp(tor(0.2, 0.07, 6, 10, PI), 0xffffff, 0.2, 1.25, 0),
    fp(sph(0.07), 0xffffff, 0.4, 1.25, 0),
    ...[0.12, 0.38, 0.64, 0.9, 1.14].map((y) => tp(cyl(0.076, 0.076, 0.09, 8), 0, y, 0, 1, 1, 1, 0.45)),
    ...[0.35, 1.3, 2.25].map((a) => tp(tor(0.2, 0.076, 6, 2, 0.28), 0.2, 1.25, 0, 1, 1, 1, 0, 0, a)),
  ]),
  /** island: a frosted cookie with a chocolate drip underneath; tint = frosting */
  cookie: () => merge([
    tp(cyl(0.98, 0.98, 0.1, 16), 0, -0.05),
    ...around(7, (a) => tp(sph(0.13, 7, 5), Math.cos(a) * 0.9, -0.1, Math.sin(a) * 0.9, 1, 1.3, 1)),
    fp(cyl(1, 0.94, 0.36, 16), 0xd9a05b, 0, -0.26),
    ...around(9, (a, i) => fp(dod(0.08), 0x5a3420, Math.cos(a + 0.3) * 0.97, -0.24 + (i % 2) * 0.08, Math.sin(a + 0.3) * 0.97)),
    fp(cone(0.85, 1.2, 12), 0x7a4a2a, 0, -1.04, 0, 1, 1, 1, PI),
    fp(sph(0.16), 0x7a4a2a, 0, -1.7, 0.05, 1, 1.4, 1),
  ]),
};

// ---------------------------------------------------------------- W03 Ice Floe
const ICE: Record<string, Builder> = {
  icecrystal: () => merge([
    fp(dod(0.2), SNOW, 0, 0.05, 0, 1.4, 0.45, 1.3),
    ...shard(0, 0, 0, 0.75, 0.13),
    ...shard(0.08, 0, 0.03, 0.45, 0.09, 0.2, -0.5),
    ...shard(-0.07, 0, -0.04, 0.4, 0.085, -0.15, 0.5),
    ...shard(0.02, 0, 0.09, 0.3, 0.07, 0.55, 0),
  ]),
  snowman: () => merge([
    fp(ico(0.32), SNOW, 0, 0.28, 0, 1, 0.9, 1),
    fp(ico(0.24), SNOW, 0, 0.7, 0),
    fp(ico(0.18), SNOW, 0, 1.04, 0),
    tp(tor(0.17, 0.055, 5, 12), 0, 0.88, 0, 1, 1, 1, PI / 2),
    tp(box(0.09, 0.24, 0.05), 0.1, 0.77, 0.17, 1, 1, 1, 0.3, 0, 0.2),
    fp(cone(0.04, 0.18, 6), 0xff8a2a, 0, 1.03, 0.25, 1, 1, 1, PI / 2),
    fp(sph(0.028, 6, 4), 0x2a2a3a, -0.065, 1.1, 0.155),
    fp(sph(0.028, 6, 4), 0x2a2a3a, 0.065, 1.1, 0.155),
    fp(sph(0.03, 6, 4), 0x2a2a3a, 0, 0.74, 0.235),
    fp(sph(0.03, 6, 4), 0x2a2a3a, 0, 0.6, 0.218),
    fp(cyl(0.22, 0.22, 0.03, 12), 0x2a2a3a, 0, 1.19, 0),
    fp(cyl(0.13, 0.14, 0.22, 10), 0x2a2a3a, 0, 1.3, 0),
    tp(cyl(0.142, 0.142, 0.05, 10), 0, 1.24, 0),
  ]),
  igloo: () => merge([
    tp(sph(0.6, 12, 5, 0, TAU, 0, PI / 2), 0, 0, 0, 1, 0.85, 1),
    ring(0.552, 0.015, 0xb8dcf0, 0.2, 16),
    ring(0.425, 0.015, 0xb8dcf0, 0.36, 14),
    tp(box(0.4, 0.36, 0.4), 0, 0.18, 0.5),
    tp(cyl(0.2, 0.2, 0.4, 8), 0, 0.36, 0.5, 1, 1, 1, PI / 2),
    fg(box(0.24, 0.3, 0.02), 0xffc96b, 0, 0.15, 0.71),
    fg(cyl(0.12, 0.12, 0.02, 8), 0xffc96b, 0, 0.3, 0.71, 1, 1, 1, PI / 2),
  ]),
  /** island: a chunky ice floe with icicles; tint = the snowy top */
  icefloe: () => merge([
    tp(cyl(1, 0.97, 0.26, 7), 0, -0.13),
    fp(cyl(0.97, 0.8, 0.3, 7), 0xbfe8ff, 0, -0.41),
    fp(cone(0.8, 1.1, 7), 0x8fd0f5, 0, -1.11, 0, 1, 1, 1, PI),
    ...around(5, (a, i) => {
      const h = 0.4 + (i % 2) * 0.22;
      return fp(cone(0.09, h, 5), 0xd8f4ff, Math.cos(a) * 0.82, -0.52 - h / 2, Math.sin(a) * 0.82, 1, 1, 1, PI);
    }),
  ]),
};

// ---------------------------------------------------------------- W04 Neon Night
const NEON: Record<string, Builder> = {
  neonpillar: () => merge([
    fp(box(0.44, 0.12, 0.44), DARK, 0, 0.06),
    fp(box(0.18, 1.6, 0.18), DARK, 0, 0.9),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => tg(box(0.045, 1.5, 0.045), sx * 0.095, 0.9, sz * 0.095)),
    tg(box(0.46, 0.04, 0.46), 0, 0.14),
    tg(ico(0.15), 0, 1.82),
  ]),
  neonring: () => merge([
    fp(cyl(0.2, 0.26, 0.12, 8), DARK, 0, 0.06),
    fp(cyl(0.035, 0.035, 0.5, 6), DARK, 0, 0.35),
    tg(tor(0.42, 0.06, 6, 20), 0, 1.02),
    tg(tor(0.24, 0.045, 5, 16), 0, 1.02, 0, 1, 1, 1, 0, PI / 2),
    tg(sph(0.08), 0, 1.02),
  ]),
  speaker: () => merge([
    fp(box(0.62, 0.95, 0.5), DARK, 0, 0.475),
    fp(cyl(0.21, 0.21, 0.04, 14), 0x15151f, 0, 0.33, 0.25, 1, 1, 1, PI / 2),
    fp(sph(0.12, 10, 6), 0x3a3a4a, 0, 0.33, 0.24, 1, 1, 0.5),
    tg(tor(0.22, 0.03, 4, 16), 0, 0.33, 0.26),
    fp(cyl(0.1, 0.1, 0.04, 10), 0x15151f, 0, 0.74, 0.25, 1, 1, 1, PI / 2),
    tg(tor(0.11, 0.025, 4, 12), 0, 0.74, 0.26),
    tg(box(0.64, 0.04, 0.52), 0, 0.96),
  ]),
  /** island: a dark hex pad with a glowing rim; tint = rim glow */
  neonpad: () => merge([
    fp(cyl(1, 1, 0.24, 6), DARK, 0, -0.12),
    tg(tor(1, 0.05, 4, 6), 0, -0.02, 0, 1, 1, 1, PI / 2, 0, PI / 6),
    fp(cone(0.9, 1.3, 6), 0x1c1730, 0, -0.89, 0, 1, 1, 1, PI),
    tg(tor(0.7, 0.04, 4, 6), 0, -0.55, 0, 1, 1, 1, PI / 2, 0, PI / 6),
    tg(sph(0.13), 0, -1.6),
  ]),
};

// ---------------------------------------------------------------- W05 Slime Swamp
const SLIME: Record<string, Builder> = {
  slimeblob: () => merge([
    tp(ico(0.38, 2), 0, 0.22, 0, 1.05, 0.62, 1.05),
    tp(ico(0.2), 0.05, 0.47, 0.02, 1, 0.9, 1),
    tp(ico(0.09), 0.38, 0.05, 0.15, 1.2, 0.5, 1.2),
    fp(sph(0.07), 0xffffff, -0.1, 0.38, 0.24),
    fp(sph(0.07), 0xffffff, 0.1, 0.38, 0.24),
    fp(sph(0.035, 6, 4), 0x1a1a2a, -0.1, 0.38, 0.3),
    fp(sph(0.035, 6, 4), 0x1a1a2a, 0.1, 0.38, 0.3),
  ]),
  reed: () => merge([
    ...([[0, 0, 1.15], [0.14, 0.08, 0.9], [-0.12, -0.07, 1.0]] as const).flatMap(([x, z, h]) => [
      fp(cyl(0.018, 0.026, h, 5), 0x5f8f3a, x, h / 2, z),
      tp(cap(0.055, 0.2, 2, 6), x, h - 0.08, z),
      fp(cyl(0.008, 0.012, 0.14, 4), 0x5f8f3a, x, h + 0.08, z),
    ]),
    fp(cone(0.06, 0.8, 4), 0x6aa040, 0.06, 0.38, -0.08, 1, 1, 0.35, 0, 0.5, -0.3),
    fp(cone(0.05, 0.65, 4), 0x6aa040, -0.08, 0.3, 0.08, 1, 1, 0.35, 0, -0.4, 0.35),
  ]),
  bubblepod: () => merge([
    fp(cyl(0.035, 0.06, 0.7, 6), STEM, 0, 0.35),
    fp(sph(0.12, 7, 5), STEM, 0.1, 0.18, 0, 1.6, 0.35, 0.8, 0, 0, 0.5),
    fp(cone(0.1, 0.12, 6), STEM, 0, 0.68, 0, 1, 1, 1, PI),
    tg(ico(0.26), 0, 0.92),
    tg(ico(0.12), 0.26, 0.6, 0.08),
    tg(ico(0.08), -0.22, 1.24, -0.05),
  ]),
  /** island: a lily pad on a mud clump with slime drips; tint = the pad */
  lilyisle: () => merge([
    tp(cyl(1, 1, 0.12, 16), 0, -0.06),
    fp(cyl(0.96, 0.85, 0.3, 14), 0x5a4a2a, 0, -0.27),
    fp(cone(0.85, 1.1, 12), 0x4a3a22, 0, -0.97, 0, 1, 1, 1, PI),
    ...around(6, (a, i) => fp(sph(0.11, 7, 5), 0x7fd65a, Math.cos(a) * (0.88 - (i % 2) * 0.05), -0.3 - (i % 2) * 0.1, Math.sin(a) * (0.88 - (i % 2) * 0.05), 1, 1.6, 1)),
  ]),
};

// ---------------------------------------------------------------- W06 Toy Box
const TOYS: Record<string, Builder> = {
  toyblock: () => {
    const ry = 0.5, c = Math.cos(ry), s = Math.sin(ry);
    return merge([
      tp(box(0.44, 0.44, 0.44), 0, 0.22),
      fp(box(0.26, 0.26, 0.02), 0xfff6e0, 0, 0.22, 0.225),
      fp(cyl(0.07, 0.07, 0.02, 10), 0xff5d5d, 0, 0.22, 0.237, 1, 1, 1, PI / 2),
      fp(box(0.02, 0.26, 0.26), 0xfff6e0, 0.225, 0.22, 0),
      fp(box(0.36, 0.36, 0.36), 0xffd23d, 0.04, 0.62, 0.02, 1, 1, 1, 0, ry),
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
        const lx = sx * 0.09, lz = sz * 0.09;
        return fp(cyl(0.05, 0.05, 0.06, 8), 0xffd23d, 0.04 + lx * c + lz * s, 0.83, 0.02 - lx * s + lz * c);
      }),
      fp(box(0.28, 0.28, 0.28), 0x46a8ff, 0.38, 0.14, -0.12, 1, 1, 1, 0, -0.3),
    ]);
  },
  toyball: () => merge([
    fp(sph(0.36, 12, 8), 0xffffff, 0, 0.36),
    tp(sph(0.365, 3, 8, 0, PI / 3), 0, 0.36),
    fp(sph(0.365, 3, 8, (2 * PI) / 3, PI / 3), 0xffd23d, 0, 0.36),
    fp(sph(0.365, 3, 8, (4 * PI) / 3, PI / 3), 0x46a8ff, 0, 0.36),
    fp(sph(0.07, 6, 4), 0xffffff, 0, 0.72, 0, 1, 0.5, 1),
  ]),
  toytrain: () => merge([
    fp(box(0.66, 0.1, 0.36), 0xd8322a, 0, 0.17, 0),
    tp(cyl(0.15, 0.15, 0.38, 10), 0.11, 0.37, 0, 1, 1, 1, 0, 0, PI / 2),
    tp(box(0.26, 0.36, 0.36), -0.18, 0.4, 0),
    fp(box(0.32, 0.05, 0.42), 0xd8322a, -0.18, 0.605, 0),
    fg(box(0.14, 0.1, 0.37), 0xfff0b0, -0.18, 0.47, 0),
    fp(cyl(0.05, 0.07, 0.18, 8), 0x3a3a4a, 0.2, 0.58, 0),
    fp(cyl(0.09, 0.06, 0.06, 8), 0x3a3a4a, 0.2, 0.69, 0),
    fg(sph(0.05, 6, 4), 0xfff0b0, 0.31, 0.38, 0),
    ...[-0.2, 0, 0.2].flatMap((x) => [-0.19, 0.19].map((z) => fp(cyl(0.1, 0.1, 0.05, 10), 0x3a3a4a, x, 0.1, z, 1, 1, 1, PI / 2))),
  ]),
  /** island: a big building-brick plate on stacked blocks; tint = the plate */
  blockisle: () => merge([
    tp(box(1.7, 0.26, 1.7), 0, -0.13),
    ...[[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([x, z]) => tp(cyl(0.13, 0.13, 0.08, 10), x, 0.03, z)),
    fp(box(1.2, 0.5, 1.2), 0xffd23d, 0, -0.51, 0),
    fp(box(0.75, 0.45, 0.75), 0x46a8ff, 0.08, -0.98, 0.05, 1, 1, 1, 0, 0.4),
    fp(box(0.38, 0.38, 0.38), 0xff5d5d, -0.05, -1.38, 0, 1, 1, 1, 0, 0.9),
  ]),
};

// ---------------------------------------------------------------- W07 Space Port / W27 Moon Base
const SPACE: Record<string, Builder> = {
  antenna: () => merge([
    fp(cyl(0.14, 0.2, 0.18, 8), METAL, 0, 0.09),
    fp(cyl(0.035, 0.035, 0.6, 6), METAL, 0, 0.45),
    tp(cone(0.42, 0.16, 12), 0, 0.82, 0, 1, 1, 1, PI + 0.6),
    fp(cyl(0.015, 0.015, 0.3, 4), METAL_D, 0, 0.945, 0.085, 1, 1, 1, 0.6),
    tg(sph(0.05, 6, 4), 0, 1.07, 0.17),
  ]),
  planetlamp: () => merge([
    fp(cyl(0.16, 0.2, 0.08, 10), METAL_D, 0, 0.04),
    fp(cyl(0.03, 0.03, 0.95, 6), METAL_D, 0, 0.5),
    tg(ico(0.28, 2), 0, 1.25),
    fg(tor(0.44, 0.035, 4, 20), 0xfff2b8, 0, 1.25, 0, 1, 1, 1, PI / 2 - 0.4, 0, 0.3),
    fg(sph(0.06), 0xffffff, 0.42, 1.55, 0.1),
  ]),
  craterrock: () => merge([
    tp(dod(0.36), 0, 0.15, 0, 1.3, 0.55, 1.1),
    tp(dod(0.2), 0.36, 0.08, 0.2, 1, 0.6, 1),
    ring(0.1, 0.035, 0x8a86a0, 0.33, 8),
    fp(tor(0.06, 0.025, 4, 8), 0x8a86a0, 0.38, 0.19, 0.2, 1, 1, 1, PI / 2),
  ]),
  dome: () => merge([
    fp(cyl(0.5, 0.52, 0.14, 14), METAL, 0, 0.07),
    tg(sph(0.46, 14, 6, 0, TAU, 0, PI / 2), 0, 0.14),
    fp(tor(0.47, 0.025, 3, 12, PI), METAL_D, 0, 0.14, 0),
    fp(tor(0.47, 0.025, 3, 12, PI), METAL_D, 0, 0.14, 0, 1, 1, 1, 0, PI / 2),
    fp(box(0.22, 0.26, 0.16), METAL, 0, 0.13, 0.48),
    fg(box(0.12, 0.16, 0.02), 0x7af0ff, 0, 0.14, 0.565),
    fp(cyl(0.015, 0.015, 0.3, 4), METAL_D, 0.1, 0.72, 0),
    fg(sph(0.04, 6, 4), 0xff5a5a, 0.1, 0.88, 0),
  ]),
  /** island: a lumpy asteroid with a flat top; tint = the top */
  asteroid: () => merge([
    tp(cyl(1, 0.92, 0.22, 9), 0, -0.11),
    fp(dod(0.95), 0x7d7390, 0, -0.85, 0, 1, 0.75, 1),
    fp(dod(0.4), 0x6a6180, 0.45, -1.25, 0.2),
    fp(dod(0.3), 0x6a6180, -0.5, -0.6, -0.4),
    fp(tor(0.14, 0.04, 4, 8), 0x5a5270, 0.62, -0.55, 0.3, 1, 1, 1, 0, 1.0, 0),
  ]),
};

// ---------------------------------------------------------------- W08 Robot Factory
const ROBOT: Record<string, Builder> = {
  gear: () => merge([
    fp(box(0.36, 0.1, 0.26), METAL_D, 0, 0.05),
    fp(box(0.08, 0.3, 0.08), METAL_D, 0, 0.2),
    tp(cyl(0.36, 0.36, 0.14, 14), 0, 0.56, 0, 1, 1, 1, PI / 2),
    ...around(10, (a) => tp(box(0.12, 0.12, 0.14), Math.cos(a) * 0.4, 0.56 + Math.sin(a) * 0.4, 0, 1, 1, 1, 0, 0, a)),
    fp(cyl(0.12, 0.12, 0.18, 8), METAL_D, 0, 0.56, 0, 1, 1, 1, PI / 2),
    fp(tor(0.24, 0.025, 3, 14), METAL_D, 0, 0.56, 0.075),
    fp(tor(0.24, 0.025, 3, 14), METAL_D, 0, 0.56, -0.075),
  ]),
  pipe: () => merge([
    fp(cyl(0.17, 0.19, 0.1, 10), METAL_D, 0, 0.05),
    tp(cyl(0.12, 0.12, 0.85, 10), 0, 0.425),
    fp(cyl(0.155, 0.155, 0.06, 10), METAL_D, 0, 0.84),
    tp(tor(0.22, 0.12, 8, 8, PI / 2), 0.22, 0.85, 0, 1, 1, 1, 0, 0, PI / 2),
    tp(cyl(0.12, 0.12, 0.4, 10), 0.42, 1.07, 0, 1, 1, 1, 0, 0, PI / 2),
    fp(cyl(0.155, 0.155, 0.06, 10), METAL_D, 0.62, 1.07, 0, 1, 1, 1, 0, 0, PI / 2),
    fp(cyl(0.02, 0.02, 0.1, 4), METAL_D, 0, 0.55, 0.15, 1, 1, 1, PI / 2),
    fp(tor(0.09, 0.022, 4, 10), 0xff4a4a, 0, 0.55, 0.2),
    fg(cyl(0.07, 0.07, 0.03, 10), 0xfff4c0, 0, 0.27, 0.125, 1, 1, 1, PI / 2),
  ]),
  robotarm: () => merge([
    fp(cyl(0.26, 0.32, 0.14, 10), METAL_D, 0, 0.07),
    tp(cyl(0.15, 0.17, 0.18, 10), 0, 0.23),
    fg(sph(0.05, 6, 4), 0xffb020, 0, 0.24, 0.16),
    fp(sph(0.1), METAL_D, 0, 0.3, 0),
    tp(box(0.13, 0.62, 0.13), -0.121, 0.586, 0, 1, 1, 1, 0, 0, 0.4),
    fp(sph(0.1), METAL_D, -0.241, 0.871, 0),
    tp(box(0.11, 0.5, 0.11), -0.045, 1.027, 0, 1, 1, 1, 0, 0, -0.9),
    fp(sph(0.075), METAL_D, 0.15, 1.18, 0),
    fp(box(0.04, 0.18, 0.06), METAL_D, 0.1, 1.08, 0, 1, 1, 1, 0, 0, -0.25),
    fp(box(0.04, 0.18, 0.06), METAL_D, 0.2, 1.08, 0, 1, 1, 1, 0, 0, 0.25),
  ]),
  /** island: a riveted octagonal plate with a thruster; tint = the plate */
  metalplate: () => merge([
    tp(cyl(1, 1, 0.22, 8), 0, -0.11, 0, 1, 1, 1, 0, PI / 8),
    ...around(8, (a) => fp(sph(0.05, 6, 4), METAL_D, Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86, 1, 0.6, 1)),
    fp(cyl(0.8, 0.5, 0.5, 8), METAL, 0, -0.47, 0, 1, 1, 1, 0, PI / 8),
    fp(cyl(0.3, 0.4, 0.34, 10), METAL_D, 0, -0.89),
    fg(cone(0.24, 0.55, 10), 0xffa040, 0, -1.33, 0, 1, 1, 1, PI),
  ]),
};

// ---------------------------------------------------------------- W09 Floating Library
/** one book lying flat: cover (tinted or fixed) + a cream page edge on its +x side */
function book(w: number, h: number, d: number, y: number, ry: number, col: number | null): Geo[] {
  const ex = (w / 2 - 0.005) * Math.cos(ry), ez = -(w / 2 - 0.005) * Math.sin(ry);
  return [
    col === null ? tp(box(w, h, d), 0, y, 0, 1, 1, 1, 0, ry) : fp(box(w, h, d), col, 0, y, 0, 1, 1, 1, 0, ry),
    fp(box(0.02, h - 0.035, d - 0.04), PAGE, ex, y, ez, 1, 1, 1, 0, ry),
  ];
}

const LIBRARY: Record<string, Builder> = {
  bookstack: () => merge([
    ...book(0.62, 0.14, 0.44, 0.07, 0, null),
    ...book(0.56, 0.12, 0.4, 0.2, 0.25, 0x3a7ad8),
    ...book(0.6, 0.15, 0.42, 0.335, -0.15, null),
    ...book(0.48, 0.11, 0.36, 0.465, 0.4, 0xf2c14e),
    fp(box(0.1, 0.62, 0.44), 0x3abf7a, 0.42, 0.31, 0, 1, 1, 1, 0, 0, -0.12),
  ]),
  desklamp: () => merge([
    fp(cyl(0.2, 0.24, 0.07, 12), BRASS, 0, 0.035),
    fp(cyl(0.025, 0.025, 0.7, 6), BRASS, -0.103, 0.4, 0, 1, 1, 1, 0, 0, 0.3),
    fp(sph(0.045), BRASS, -0.207, 0.735, 0),
    fp(cyl(0.022, 0.022, 0.45, 6), BRASS, -0.031, 0.874, 0, 1, 1, 1, 0, 0, -0.9),
    tp(cone(0.22, 0.26, 12), 0.223, 0.905, 0, 1, 1, 1, 0, 0, 0.64),
    fg(sph(0.08), 0xfff1b0, 0.31, 0.79, 0),
  ]),
  scroll: () => merge([
    fp(box(0.7, 0.07, 0.24), WOOD, 0, 0.035),
    fp(cyl(0.025, 0.025, 0.95, 6), WOOD, -0.36, 0.5, 0),
    fp(cyl(0.025, 0.025, 0.95, 6), WOOD, 0.36, 0.5, 0),
    fp(box(0.56, 0.52, 0.02), 0xf6e6c0, 0, 0.6, 0),
    ...[0.88, 0.33].flatMap((y) => [
      tp(cyl(0.05, 0.05, 0.66, 8), 0, y, 0, 1, 1, 1, 0, 0, PI / 2),
      fp(sph(0.05, 6, 4), BRASS, -0.35, y, 0),
      fp(sph(0.05, 6, 4), BRASS, 0.35, y, 0),
    ]),
    ...[0, 1, 2, 3].flatMap((i) => [0.012, -0.012].map((z) => fp(box(0.36 - (i % 2) * 0.1, 0.025, 0.025), INK, -(i % 2) * 0.05, 0.74 - i * 0.09, z))),
  ]),
  /** island: a giant open book; tint = the covers */
  bookisle: () => merge([
    tp(box(0.96, 0.1, 1.5), -0.49, -0.13, 0, 1, 1, 1, 0, 0, -0.07),
    tp(box(0.96, 0.1, 1.5), 0.49, -0.13, 0, 1, 1, 1, 0, 0, 0.07),
    fp(box(0.9, 0.1, 1.42), PAGE, -0.47, -0.04, 0, 1, 1, 1, 0, 0, -0.07),
    fp(box(0.9, 0.1, 1.42), PAGE, 0.47, -0.04, 0, 1, 1, 1, 0, 0, 0.07),
    tp(cyl(0.08, 0.08, 1.5, 8), 0, -0.17, 0, 1, 1, 1, PI / 2),
    fp(box(0.07, 0.8, 0.012), 0xff4a5a, 0, -0.55, 0.55),
    ...[-0.4, -0.1, 0.2, 0.5].flatMap((z) => [-1, 1].map((sx) => fp(box(0.62, 0.012, 0.03), 0xd8ccb0, sx * 0.47, 0.012 + 0.012, z, 1, 1, 1, 0, 0, sx * 0.07))),
  ]),
};

// ---------------------------------------------------------------- W10 Coral Reef / W26 Bubble Sea
const REEF: Record<string, Builder> = {
  coral: () => merge([
    fp(dod(0.16), 0xb8a890, 0, 0.06, 0, 1.3, 0.6, 1.3),
    tp(cyl(0.06, 0.09, 0.55, 6), 0, 0.3, 0),
    tp(cyl(0.045, 0.06, 0.45, 6), 0.14, 0.62, 0, 1, 1, 1, 0, 0, -0.6),
    tp(cyl(0.045, 0.06, 0.42, 6), -0.13, 0.6, 0.05, 1, 1, 1, 0.2, 0, 0.65),
    tp(cyl(0.04, 0.05, 0.4, 6), 0.02, 0.75, -0.12, 1, 1, 1, -0.55, 0, 0),
    tg(sph(0.075, 7, 5), 0, 0.6, 0),
    tg(sph(0.065, 7, 5), 0.267, 0.806, 0),
    tg(sph(0.065, 7, 5), -0.257, 0.764, 0.083),
    tg(sph(0.06, 7, 5), 0.02, 0.92, -0.225),
  ]),
  shell: () => merge([
    tp(sph(0.32, 10, 4, 0, TAU, PI / 2, PI / 2), 0, 0.15, 0, 1, 0.5, 0.9),
    fp(cyl(0.31, 0.31, 0.02, 10), 0xffd8e0, 0, 0.15, 0, 1, 1, 0.9),
    tp(sph(0.32, 10, 4, 0, TAU, 0, PI / 2), 0, 0.27, -0.13, 1, 0.5, 0.9, -0.6),
    fp(cyl(0.31, 0.31, 0.02, 10), 0xffe8ee, 0, 0.27, -0.13, 1, 1, 0.9, -0.6),
    fg(sph(0.09, 8, 6), 0xfff5fa, 0, 0.21, 0.06),
  ]),
  kelp: () => {
    const parts: Geo[] = [];
    for (const [x, z, h, ph] of [[0, 0, 1.7, 0], [0.16, 0.1, 1.3, 1.5], [-0.14, -0.08, 1.1, 3]]) {
      const n = 5, seg = h / n;
      for (let i = 0; i < n; i++) {
        const w = Math.sin(i * 1.3 + ph);
        parts.push(tp(sph(0.09, 6, 4), x + w * 0.07, (i + 0.5) * seg, z, 0.75, (seg / 0.18) * 1.2, 0.3, 0, ph, w * 0.3));
      }
      parts.push(tp(sph(0.05, 6, 4), x, h + 0.02, z));
    }
    return merge(parts);
  },
  bubblecluster: () => merge([
    fp(dod(0.14), 0x8a9aa8, 0, 0.05, 0, 1.3, 0.5, 1.2),
    tg(ico(0.2, 2), 0, 0.32, 0),
    fp(sph(0.05, 6, 4), 0xffffff, -0.08, 0.4, 0.15, 1, 1, 0.5),
    tg(ico(0.14), 0.2, 0.62, 0.05),
    tg(ico(0.11), -0.12, 0.85, -0.04),
    tg(ico(0.08), 0.08, 1.05, 0.06),
    tg(ico(0.06), -0.05, 1.22, 0),
  ]),
  /** island: a sandy reef rock with coral bits and hanging seaweed; tint = the sand */
  seaisle: () => merge([
    tp(cyl(1, 0.95, 0.22, 12), 0, -0.11),
    fp(cone(0.92, 1.3, 9), 0x6a8aa0, 0, -0.87, 0, 1, 1, 1, PI),
    ...around(5, (a, i) => fp(dod(0.13), [0xff7a9a, 0xffb03a, 0xb06aff][i % 3], Math.cos(a) * 0.9, -0.2, Math.sin(a) * 0.9)),
    ...around(4, (a) => fp(box(0.05, 0.6, 0.02), 0x3aa86a, Math.cos(a + 0.4) * 0.5, -0.95, Math.sin(a + 0.4) * 0.5, 1, 1, 1, 0, -a, 0)),
  ]),
};

// ---------------------------------------------------------------- W11 Desert Pyramids
const DESERT: Record<string, Builder> = {
  cactus: () => merge([
    tp(cap(0.15, 0.85, 3, 8), 0, 0.57),
    tp(cyl(0.08, 0.08, 0.22, 7), 0.16, 0.6, 0, 1, 1, 1, 0, 0, PI / 2),
    tp(cap(0.09, 0.28, 2, 7), 0.28, 0.82),
    tp(cyl(0.07, 0.07, 0.18, 7), -0.15, 0.48, 0, 1, 1, 1, 0, 0, PI / 2),
    tp(cap(0.08, 0.2, 2, 7), -0.25, 0.62),
    fp(sph(0.07, 6, 4), 0xff6aa8, 0, 1.16, 0, 1, 0.6, 1),
  ]),
  pyramid: () => merge([
    tp(cone(0.62, 0.8, 4), 0, 0.4, 0, 1, 1, 1, 0, PI / 4),
    fp(tor(0.41, 0.025, 3, 4), 0xc89a50, 0, 0.27, 0, 1, 1, 1, PI / 2, 0, PI / 4),
    fp(tor(0.209, 0.025, 3, 4), 0xc89a50, 0, 0.53, 0, 1, 1, 1, PI / 2, 0, PI / 4),
    fg(cone(0.1, 0.13, 4), 0xffd23d, 0, 0.74, 0, 1, 1, 1, 0, PI / 4),
    fp(box(0.16, 0.2, 0.04), 0x3a2a1a, 0, 0.1, 0.37, 1, 1, 1, -0.5),
  ]),
  palm: () => {
    const parts: Geo[] = [];
    for (let i = 0; i < 5; i++) parts.push(fp(cyl(0.075 - i * 0.006, 0.09 - i * 0.006, 0.3, 7), 0xa8743f, i * i * 0.012, 0.15 + i * 0.28, 0, 1, 1, 1, 0, 0, -i * 0.06));
    parts.push(...around(6, (a) => tp(sph(0.12, 7, 4), 0.21 + Math.cos(a) * 0.32, 1.38, Math.sin(a) * 0.32, 3, 0.35, 1.1, 0, -a, -0.45)));
    parts.push(...around(3, (a) => fp(sph(0.07, 6, 4), 0x6b4a2a, 0.21 + Math.cos(a) * 0.08, 1.3, Math.sin(a) * 0.08)));
    return merge(parts);
  },
  /** island: a sandstone mesa; tint = the sand top */
  dune: () => merge([
    tp(cyl(1, 0.96, 0.24, 12), 0, -0.12),
    fp(cyl(0.96, 0.86, 0.3, 12), 0xe0a560, 0, -0.39),
    fp(cone(0.86, 1.1, 10), 0xc98a4a, 0, -1.09, 0, 1, 1, 1, PI),
    fp(dod(0.2), 0xb87a3a, 0.5, -0.75, 0.3),
  ]),
};

// ---------------------------------------------------------------- W12 Jungle Ruins
const JUNGLE: Record<string, Builder> = {
  ruinpillar: () => merge([
    fp(box(0.5, 0.14, 0.5), STONE, 0, 0.07),
    tp(cyl(0.17, 0.19, 1.05, 8), 0, 0.665),
    fp(box(0.46, 0.13, 0.46), STONE, 0.02, 1.25, 0, 1, 1, 1, 0, 0, 0.06),
    tp(dod(0.12), 0.32, 0.08, 0.18),
    fp(sph(0.13, 7, 5), MOSS, 0.1, 1.33, 0.05, 1.3, 0.4, 1.2),
    fp(sph(0.1, 7, 5), MOSS, -0.17, 0.15, 0.14, 1, 0.6, 1),
    fp(tor(0.19, 0.03, 4, 10), MOSS, 0, 0.6, 0, 1, 1, 1, PI / 2 + 0.3),
    fp(tor(0.185, 0.03, 4, 10), MOSS, 0, 0.95, 0, 1, 1, 1, PI / 2 - 0.25),
  ]),
  bigleaf: () => merge([
    fp(cyl(0.03, 0.05, 0.35, 5), STEM, 0, 0.175),
    tp(cone(0.06, 0.7, 5), 0, 0.4, 0),
    ...around(5, (a, i) => tp(sph(0.14, 7, 4), Math.cos(a) * 0.34, 0.32 + (i % 2) * 0.1, Math.sin(a) * 0.34, 3.2, 0.25, 1.1, 0, -a, 0.8)),
  ]),
};

// ---------------------------------------------------------------- W13 Cloud Kingdom
const SKY: Record<string, Builder> = {
  balloon: () => merge([
    fp(cyl(0.05, 0.07, 0.08, 6), WOOD, 0, 0.04),
    fp(cyl(0.008, 0.008, 0.62, 3), 0x8a7a6a, 0, 0.35),
    fp(cyl(0.12, 0.09, 0.16, 8), 0xc08a50, 0, 0.74),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => fp(cyl(0.008, 0.008, 0.36, 3), 0x8a7a6a, sx * 0.1, 1, sz * 0.1)),
    tp(ico(0.4, 2), 0, 1.5, 0, 1, 1.12, 1),
    ring(0.4, 0.035, 0xffffff, 1.5, 16),
    tp(cone(0.18, 0.2, 8), 0, 1.07, 0, 1, 1, 1, PI),
  ]),
  rainbowarc: () => merge([
    ...RAINBOW.map((c, i) => fp(tor(0.62 - i * 0.075, 0.042, 4, 14, PI), c, 0, 0.12, 0)),
    ...[-1, 1].flatMap((s) => [
      tp(ico(0.2), s * 0.43, 0.12, 0),
      tp(ico(0.14), s * 0.6, 0.06, 0.08),
      tp(ico(0.14), s * 0.28, 0.08, -0.06),
    ]),
  ]),
  /** island: a fluffy white cloud (fixed colours, so it stays a cloud in every mood) */
  cloudpuff: () => merge([
    fp(ico(1, 2), 0xf8faff, 0, -0.2, 0, 1, 0.26, 1),
    fp(ico(0.62), 0xe6eaf8, 0.4, -0.66, 0.15),
    fp(ico(0.58), 0xe6eaf8, -0.42, -0.6, -0.2),
    fp(ico(0.5), 0xdfe4f6, 0.05, -0.75, 0.38),
    fp(ico(0.42), 0xdfe4f6, -0.1, -1.05, -0.1),
  ]),
};

// ---------------------------------------------------------------- W14 Festival of Lights / W29 Holi
const FESTIVAL: Record<string, Builder> = {
  diya: () => merge([
    fp(cyl(0.1, 0.16, 0.12, 8), BRASS, 0, 0.06),
    tp(sph(0.22, 10, 4, 0, TAU, PI / 2, PI / 2), 0, 0.3, 0, 1.2, 0.75, 1),
    fp(cyl(0.215, 0.215, 0.02, 10), 0x6a3a1a, 0, 0.29, 0, 1.2, 1, 1),
    fp(tor(0.22, 0.03, 4, 12), 0xffc94a, 0, 0.3, 0, 1.2, 1, 1, PI / 2),
    tp(cone(0.07, 0.16, 6), 0.3, 0.32, 0, 1, 1, 0.7, 0, 0, -PI / 2),
    fg(cone(0.06, 0.2, 6), 0xffb030, 0.34, 0.46, 0),
    fg(sph(0.05, 6, 4), 0xfff3a0, 0.34, 0.41, 0),
  ]),
  lanternstring: () => {
    const R = 1.2, half = 0.55, al = Math.asin(half / R), cy = 1.3 + Math.sqrt(R * R - half * half);
    return merge([
      fp(cyl(0.03, 0.04, 1.35, 6), WOOD, -half, 0.675, 0),
      fp(cyl(0.03, 0.04, 1.35, 6), WOOD, half, 0.675, 0),
      fp(sph(0.045, 6, 4), BRASS, -half, 1.37, 0),
      fp(sph(0.045, 6, 4), BRASS, half, 1.37, 0),
      fp(tor(R, 0.01, 3, 10, 2 * al), 0x4a3a2a, 0, cy, 0, 1, 1, 1, 0, 0, 1.5 * PI - al),
      ...[-0.4, -0.2, 0, 0.2, 0.4].flatMap((x) => {
        const y = cy - Math.sqrt(R * R - x * x);
        return [fp(cyl(0.03, 0.03, 0.04, 6), 0x4a3a2a, x, y - 0.02, 0), tg(sph(0.08, 8, 6), x, y - 0.11, 0, 1, 1.2, 1)];
      }),
    ]);
  },
  rangoli: () => merge([
    tp(cyl(0.52, 0.54, 0.04, 16), 0, 0.02),
    ...around(8, (a, i) => fp(sph(0.1, 6, 3), i % 2 ? 0xff4fa0 : 0xffd23d, Math.cos(a) * 0.32, 0.045, Math.sin(a) * 0.32, 1.7, 0.3, 0.8, 0, -a, 0)),
    ...around(8, (a) => fp(sph(0.04, 5, 3), 0xffffff, Math.cos(a + 0.39) * 0.46, 0.045, Math.sin(a + 0.39) * 0.46, 1, 0.4, 1)),
    fp(cyl(0.16, 0.16, 0.05, 12), 0x46c8ff, 0, 0.04),
    fp(cyl(0.07, 0.05, 0.06, 8), 0xd8643a, 0, 0.09),
    fg(cone(0.05, 0.14, 6), 0xffc040, 0, 0.19),
  ]),
  powderpot: () => merge([
    fp(sph(0.26, 10, 6, 0, TAU, PI * 0.3, PI * 0.7), 0xc8643a, 0, 0.25, 0, 1, 0.9, 1),
    ring(0.262, 0.018, 0xffd23d, 0.25, 14),
    ring(0.21, 0.035, 0xd8744a, 0.39),
    tp(ico(0.22), 0, 0.42, 0, 1, 0.6, 1),
    tp(ico(0.14), 0.3, 0.03, 0.15, 1.4, 0.3, 1.2),
  ]),
};

// ---------------------------------------------------------------- W15 Music Hall
const MUSIC: Record<string, Builder> = {
  drum: () => merge([
    fp(cyl(0.22, 0.26, 0.1, 10), 0x5a3a2a, 0, 0.05),
    tp(cyl(0.3, 0.3, 0.4, 14), 0, 0.32),
    ...[0.11, 0.53].flatMap((y) => [fp(cyl(0.31, 0.31, 0.03, 14), CREAM, 0, y), ring(0.31, 0.025, BRASS, y, 16)]),
    ...around(8, (a, i) => fp(box(0.02, 0.42, 0.02), CREAM, Math.cos(a) * 0.305, 0.32, Math.sin(a) * 0.305, 1, 1, 1, 0, -a - PI / 2, i % 2 ? 0.5 : -0.5)),
    fp(cyl(0.018, 0.018, 0.45, 5), WOOD, -0.05, 0.58, 0.05, 1, 1, 1, 0, 0.5, 1.35),
    fp(cyl(0.018, 0.018, 0.45, 5), WOOD, 0.05, 0.58, -0.05, 1, 1, 1, 0, -0.5, 1.35),
  ]),
  notesign: () => merge([
    tg(ico(0.18), -0.1, 0.2, 0, 1.35, 0.95, 0.75, 0, 0, 0.45),
    tg(box(0.07, 0.95, 0.07), 0.12, 0.68, 0),
    tg(box(0.32, 0.08, 0.07), 0.25, 1.07, 0, 1, 1, 1, 0, 0, -0.55),
    tg(box(0.28, 0.07, 0.07), 0.24, 0.92, 0, 1, 1, 1, 0, 0, -0.55),
  ]),
  horn: () => merge([
    fp(box(0.42, 0.24, 0.42), WOOD, 0, 0.12),
    fp(cyl(0.16, 0.16, 0.03, 12), 0x2a2a3a, 0, 0.255),
    fp(cyl(0.035, 0.035, 0.34, 6), BRASS, 0, 0.415, -0.045, 1, 1, 1, -0.28),
    tp(cone(0.32, 0.6, 12), 0, 0.82, 0.08, 1, 1, 1, PI + 0.6),
    fp(cyl(0.26, 0.26, 0.02, 12), 0x3a2a1a, 0, 1.076, 0.255, 1, 1, 1, 0.6),
  ]),
};

// ---------------------------------------------------------------- W16 Haunted Castle / W22 Autumn
const HAUNTED: Record<string, Builder> = {
  tombstone: () => merge([
    fp(sph(0.3, 8, 4, 0, TAU, 0, PI / 2), 0x3f5a3f, 0, 0, 0, 1.2, 0.35, 1),
    tp(box(0.42, 0.5, 0.12), 0, 0.3, -0.05),
    tp(cyl(0.21, 0.21, 0.12, 10), 0, 0.55, -0.05, 1, 1, 1, PI / 2),
    fp(box(0.05, 0.22, 0.02), 0x5a5470, 0, 0.4, 0.015),
    fp(box(0.15, 0.05, 0.02), 0x5a5470, 0, 0.45, 0.015),
  ]),
  deadtree: () => merge([
    tp(cyl(0.12, 0.2, 0.12, 6), 0, 0.06),
    tp(cone(0.14, 1.4, 6), 0, 0.7),
    tp(cyl(0.025, 0.05, 0.5, 5), 0.18, 0.95, 0, 1, 1, 1, 0, 0, -0.9),
    tp(cyl(0.02, 0.045, 0.42, 5), -0.13, 0.6, 0.05, 1, 1, 1, 0.2, 0, 0.85),
    tp(cyl(0.015, 0.035, 0.35, 5), 0.05, 1.12, -0.12, 1, 1, 1, -0.8, 0, -0.2),
    tp(cyl(0.015, 0.03, 0.25, 4), 0.39, 1.22, 0, 1, 1, 1, 0, 0, -0.2),
  ]),
  pumpkin: () => merge([
    ...around(6, (a) => tp(sph(0.2, 8, 6), Math.cos(a) * 0.17, 0.25, Math.sin(a) * 0.17, 0.85, 1.15, 1.05, 0, -a, 0)),
    fp(cyl(0.035, 0.05, 0.16, 5), 0x5a7a2a, 0, 0.52, 0, 1, 1, 1, 0, 0, 0.25),
    fg(cone(0.06, 0.08, 3), 0xffd040, -0.1, 0.32, 0.3, 1, 1, 1, PI / 2),
    fg(cone(0.06, 0.08, 3), 0xffd040, 0.1, 0.32, 0.3, 1, 1, 1, PI / 2),
    fg(box(0.18, 0.05, 0.06), 0xffd040, 0, 0.18, 0.31),
  ]),
};

// ---------------------------------------------------------------- W17 Volcano Forge
const VOLCANO: Record<string, Builder> = {
  lavarock: () => merge([
    fp(dod(0.34), BASALT, 0, 0.2, 0, 1.2, 0.7, 1),
    fp(dod(0.2), BASALT, 0.32, 0.1, 0.15, 1, 0.8, 1),
    tg(cyl(0.17, 0.17, 0.04, 8), 0, 0.42, 0, 1, 1, 0.9),
    tg(box(0.035, 0.3, 0.035), 0.05, 0.2, 0.31, 1, 1, 1, 0, 0, 0.3),
    tg(box(0.035, 0.26, 0.035), -0.37, 0.18, 0.05, 1, 1, 1, 0.4, 0, 0),
    tg(box(0.035, 0.24, 0.035), 0.2, 0.18, -0.26, 1, 1, 1, 0, 0, -0.4),
    tg(sph(0.08, 6, 4), 0.38, 0.17, 0.18, 1, 0.6, 1),
  ]),
  obsidian: () => merge([
    fg(cyl(0.22, 0.26, 0.05, 8), 0xff6a1a, 0, 0.025),
    ...shard(0, 0, 0, 0.75, 0.13, 0, 0, 0xffffff, 1, 0),
    ...shard(0.04, 0, 0.02, 0.5, 0.1, 0.1, -0.4, 0xffffff, 1, 0),
    ...shard(-0.03, 0, -0.03, 0.45, 0.09, -0.25, 0.45, 0xffffff, 1, 0),
  ]),
  ventstack: () => merge([
    fp(cyl(0.2, 0.34, 0.8, 8), BASALT2, 0, 0.4),
    tg(tor(0.2, 0.06, 4, 8), 0, 0.8, 0, 1, 1, 1, PI / 2),
    tg(cyl(0.16, 0.16, 0.04, 8), 0, 0.79),
    tg(cap(0.05, 0.3, 2, 5), 0.216, 0.55, 0.125),
    fp(ico(0.16), 0x8a8090, 0.02, 1.02, 0),
    fp(ico(0.13), 0x8a8090, 0.1, 1.28, 0.04),
    fp(ico(0.1), 0x8a8090, 0.02, 1.5, -0.03),
  ]),
  /** island: a basalt hex slab with hanging columns and a glowing lava seam; tint = the top */
  basalt: () => merge([
    tp(cyl(1, 1, 0.24, 6), 0, -0.12),
    fg(tor(1, 0.045, 3, 6), 0xff6a1a, 0, -0.27, 0, 1, 1, 1, PI / 2, 0, PI / 6),
    fp(cyl(0.95, 0.95, 0.3, 6), BASALT, 0, -0.42),
    ...([[0, 0, 1.3], [0.45, 0.25, 0.9], [-0.42, 0.3, 1.0], [0.1, -0.5, 0.8], [-0.3, -0.35, 1.15], [0.5, -0.3, 0.6]] as const)
      .map(([x, z, h]) => fp(cyl(0.28, 0.28, h, 6), BASALT2, x, -0.55 - h / 2, z)),
    fg(cone(0.1, 0.25, 6), 0xff6a1a, 0, -1.97, 0, 1, 1, 1, PI),
  ]),
};

// ---------------------------------------------------------------- W18 Crystal Caves
const CRYSTAL: Record<string, Builder> = {
  crystal: () => merge([
    fp(dod(0.2), 0x5a4a7a, 0, 0.06, 0, 1.4, 0.5, 1.2),
    ...shard(0, 0, 0, 0.8, 0.14),
    ...shard(0.08, 0, 0.03, 0.5, 0.1, 0.15, -0.5),
    ...shard(-0.07, 0, -0.03, 0.45, 0.09, -0.2, 0.55),
    ...shard(0.01, 0, 0.09, 0.35, 0.08, 0.6, 0.1),
    ...shard(-0.03, 0, -0.09, 0.3, 0.07, -0.6, -0.1),
  ]),
  geode: () => merge([
    fp(sph(0.36, 10, 5, 0, TAU, PI / 2, PI / 2), 0x6a6080, 0, 0.3, 0, 1, 0.85, 1),
    ring(0.35, 0.05, 0x8a80a0, 0.3),
    tg(cyl(0.33, 0.33, 0.03, 12), 0, 0.29),
    ...around(7, (a, i) => shard(Math.cos(a) * 0.17, 0.29, Math.sin(a) * 0.17, 0.1 + (i % 3) * 0.05, 0.05, Math.sin(a) * 0.4, -Math.cos(a) * 0.4)).flat(),
    ...shard(0, 0.29, 0, 0.22, 0.07),
  ]),
};

// ---------------------------------------------------------------- W19 Dream Dimension
const DREAM_BASE = 0xe8dcff;
const DREAM: Record<string, Builder> = {
  floatcube: () => merge([
    fp(cyl(0.12, 0.18, 0.12, 8), DREAM_BASE, 0, 0.06),
    fp(cyl(0.04, 0.1, 0.3, 6), DREAM_BASE, 0, 0.27),
    tg(box(0.42, 0.42, 0.42), 0, 0.92, 0, 1, 1, 1, 0.62, 0.3, 0.62),
    fg(tor(0.42, 0.015, 3, 20), 0xffffff, 0, 0.92, 0, 1, 1, 1, PI / 2 + 0.3, 0, 0.2),
    fg(sph(0.06, 6, 4), 0xffffff, 0.38, 0.95, 0.1),
    fg(sph(0.05, 6, 4), 0xffffff, -0.3, 1.22, -0.15),
    fg(sph(0.05, 6, 4), 0xffffff, 0.08, 0.6, -0.3),
  ]),
  swirl: () => {
    const parts: Geo[] = [fp(cyl(0.035, 0.05, 0.3, 6), DREAM_BASE, 0, 0.15)];
    for (let i = 0; i < 26; i++) {
      const t = i / 25, a = t * TAU * 2.2, r = 0.06 + 0.32 * t;
      parts.push(tg(sph(0.06 + 0.04 * t, 6, 4), Math.cos(a) * r, 0.28 + t * 1.2, Math.sin(a) * r));
    }
    parts.push(fg(sph(0.07, 6, 4), 0xffffff, 0, 1.62, 0));
    return merge(parts);
  },
};

// ---------------------------------------------------------------- W20 Rainbow Summit
const RAINBOW_PROPS: Record<string, Builder> = {
  rainbowpillar: () => merge([
    ...RAINBOW.map((c, i) => fp(cyl(0.24 - i * 0.012, 0.25 - i * 0.012, 0.18, 10), c, 0, 0.09 + i * 0.18)),
    fp(cyl(0.12, 0.2, 0.08, 10), 0xffffff, 0, 1.12),
    tg(ico(0.17), 0, 1.3),
  ]),
  starpole: () => merge([
    fp(cyl(0.035, 0.045, 1.25, 6), 0xffffff, 0, 0.625),
    ...[0.25, 0.55, 0.85].map((y) => tp(cyl(0.05, 0.05, 0.08, 6), 0, y, 0, 1, 1, 1, 0, 0, 0.35)),
    tg(sph(0.12, 8, 6), 0, 1.42, 0, 1, 1, 0.55),
    ...around(5, (a) => {
      const b = a + PI / 2;
      return tg(cone(0.08, 0.2, 4), Math.cos(b) * 0.17, 1.42 + Math.sin(b) * 0.17, 0, 1, 1, 0.55, 0, 0, b - PI / 2);
    }),
  ]),
};

// ---------------------------------------------------------------- bonus themes 21–30
const BONUS: Record<string, Builder> = {
  // W21 Cherry Blossom
  blossomtree: () => merge([
    fp(cyl(0.08, 0.13, 0.8, 7), 0x6a4a3a, 0, 0.4, 0, 1, 1, 1, 0, 0, 0.08),
    fp(cyl(0.04, 0.06, 0.45, 6), 0x6a4a3a, 0.18, 0.75, 0, 1, 1, 1, 0, 0, -0.8),
    tp(ico(0.42), 0, 1.08, 0, 1.25, 0.8, 1.1),
    tp(ico(0.3), 0.42, 0.95, 0.12),
    tp(ico(0.28), -0.38, 1.0, -0.12),
    tp(ico(0.24), 0.08, 1.38, 0.15),
    tp(cyl(0.38, 0.4, 0.02, 12), 0.05, 0.01, 0.05),
  ]),
  stonelantern: () => merge([
    fp(cyl(0.2, 0.24, 0.1, 6), 0xb8b4aa, 0, 0.05),
    fp(cyl(0.07, 0.08, 0.42, 6), 0xb8b4aa, 0, 0.31),
    fp(cyl(0.2, 0.17, 0.07, 6), 0xb8b4aa, 0, 0.555),
    tg(box(0.22, 0.2, 0.22), 0, 0.69),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => fp(box(0.05, 0.2, 0.05), 0xb8b4aa, sx * 0.11, 0.69, sz * 0.11)),
    fp(cone(0.3, 0.2, 6), 0xb8b4aa, 0, 0.89),
    fp(sph(0.05, 6, 4), 0xb8b4aa, 0, 1.0),
  ]),
  // W22 Autumn Woods
  autumntree: () => merge([
    fp(cyl(0.08, 0.12, 0.75, 7), TRUNK, 0, 0.375),
    tp(ico(0.5), 0, 1.05, 0, 1, 0.85, 1),
    tp(ico(0.34), 0.38, 0.9, 0.12),
    tp(ico(0.3), -0.36, 0.92, -0.1),
    tp(ico(0.26), 0.05, 1.4, 0.05),
    tp(ico(0.12), 0.32, 0.05, 0.25, 1.4, 0.4, 1.2),
    tp(ico(0.1), -0.28, 0.04, 0.2, 1.4, 0.4, 1.2),
  ]),
  // W23 Snowy Village
  snowyhouse: () => merge([
    tp(box(0.62, 0.46, 0.52), 0, 0.23),
    fp(cone(0.56, 0.42, 4), SNOW, 0, 0.67, 0, 1.12, 1, 0.98, 0, PI / 4),
    fp(box(0.1, 0.24, 0.1), 0xa0523a, 0.17, 0.78, -0.08),
    fp(box(0.13, 0.05, 0.13), SNOW, 0.17, 0.92, -0.08),
    fp(box(0.14, 0.24, 0.03), 0x6a4a3a, -0.14, 0.12, 0.265),
    fg(box(0.15, 0.13, 0.03), WARM, 0.14, 0.27, 0.265),
    fg(box(0.03, 0.13, 0.15), WARM, 0.315, 0.25, 0),
  ]),
  // W30 Rainy Night City (also W23)
  streetlamp: () => merge([
    fp(cyl(0.1, 0.14, 0.12, 8), LAMP, 0, 0.06),
    fp(cyl(0.035, 0.045, 1.6, 6), LAMP, 0, 0.88),
    fp(tor(0.14, 0.03, 4, 8, PI), LAMP, 0.14, 1.68, 0),
    fp(cone(0.14, 0.14, 8), LAMP, 0.28, 1.6, 0),
    tg(sph(0.09, 8, 6), 0.28, 1.5, 0),
  ]),
  umbrella: () => merge([
    fp(cyl(0.02, 0.025, 1.2, 5), LAMP, 0, 0.6),
    tp(sph(0.55, 10, 4, 0, TAU, 0, PI * 0.36), 0, 0.82, 0, 1, 0.7, 1),
    tp(cyl(0.497, 0.497, 0.01, 10), 0, 0.985),
    ...around(8, (a) => fp(sph(0.03, 5, 3), LAMP, Math.cos(a) * 0.5, 0.98, Math.sin(a) * 0.5)),
    fp(cyl(0.012, 0.012, 0.1, 4), LAMP, 0, 1.25),
  ]),
  cityblock: () => {
    const parts: Geo[] = [
      tp(box(0.5, 1.2, 0.5), 0, 0.6),
      fp(box(0.56, 0.06, 0.56), LAMP, 0, 1.23),
      fp(cyl(0.08, 0.08, 0.16, 8), 0x8a6a5a, 0.12, 1.34, 0.1),
      fp(box(0.14, 0.2, 0.02), 0x3a3040, 0, 0.1, 0.255),
    ];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
      const lit = (r + c) % 3 !== 1, col = lit ? 0xffe08a : 0x2a3040, g = lit ? 1 : 0;
      parts.push(part(box(0.1, 0.12, 0.02), col, 0, g, -0.11 + c * 0.22, 0.36 + r * 0.22, 0.255));
      parts.push(part(box(0.02, 0.12, 0.1), col, 0, g, 0.255, 0.36 + r * 0.22, -0.11 + c * 0.22));
    }
    return merge(parts);
  },
  /** island: a chunk of pavement with dangling pipes; tint = the paving */
  cityisle: () => merge([
    tp(cyl(1, 0.97, 0.22, 10), 0, -0.11),
    fp(cyl(0.3, 0.3, 0.012, 10), 0x6a8ab0, 0.35, 0.004, -0.3, 1.4, 1, 1),
    fp(cyl(0.97, 0.9, 0.22, 10), 0x6a7080, 0, -0.33),
    fp(cone(0.9, 1.1, 10), 0x50586a, 0, -0.99, 0, 1, 1, 1, PI),
    fp(cyl(0.06, 0.06, 0.7, 6), 0x8a909a, 0.35, -0.85, 0.2),
    fp(cyl(0.05, 0.05, 0.5, 6), 0x8a909a, -0.3, -0.75, -0.3),
    fp(sph(0.05, 6, 4), 0x9ad8ff, 0.35, -1.27, 0.2, 1, 1.4, 1),
  ]),
  // W24 Pixel Arcade
  pixeltree: () => merge([
    fp(box(0.18, 0.55, 0.18), 0x8a5a3a, 0, 0.275),
    tp(box(0.66, 0.36, 0.66), 0, 0.7),
    tp(box(0.46, 0.3, 0.46), 0, 1.0),
    tp(box(0.24, 0.22, 0.24), 0, 1.24),
    fp(box(0.12, 0.12, 0.12), 0xff4a4a, 0.2, 0.62, 0.33),
    fp(box(0.12, 0.12, 0.12), 0xff4a4a, -0.33, 0.75, -0.1),
  ]),
  arcade: () => merge([
    tp(box(0.5, 1.05, 0.42), 0, 0.525),
    fg(box(0.38, 0.3, 0.03), 0x7af0ff, 0, 0.78, 0.2, 1, 1, 1, -0.15),
    fp(box(0.5, 0.08, 0.26), DARK, 0, 0.55, 0.3),
    fp(cyl(0.015, 0.015, 0.1, 4), DARK, -0.1, 0.64, 0.32),
    fp(sph(0.04, 6, 4), 0xff3b5a, -0.1, 0.69, 0.32),
    fg(cyl(0.03, 0.03, 0.03, 8), 0xffd23d, 0.06, 0.6, 0.33),
    fg(cyl(0.03, 0.03, 0.03, 8), 0x3bf0ff, 0.15, 0.6, 0.3),
    fg(box(0.48, 0.12, 0.04), 0xfff27a, 0, 0.98, 0.215),
  ]),
  /** island: a stepped block of pixel dirt; tint = the grass top */
  pixelisle: () => merge([
    tp(box(1.6, 0.24, 1.6), 0, -0.12),
    fp(box(1.3, 0.4, 1.3), 0x8a5a3a, 0, -0.44),
    fp(box(0.9, 0.4, 0.9), 0x6a4430, 0, -0.84),
    fp(box(0.5, 0.4, 0.5), 0x8a5a3a, 0, -1.24),
    fp(box(0.2, 0.2, 0.2), 0xb0b0b8, 0.45, -0.5, 0.66),
  ]),
  // W25 Paper Craft
  papertree: () => merge([
    fp(box(0.1, 0.55, 0.1), 0xc8a27a, 0, 0.275),
    tp(cone(0.46, 0.55, 4), 0, 0.75, 0, 1, 1, 1, 0, 0.2),
    tp(cone(0.36, 0.45, 4), 0, 1.08, 0, 1, 1, 1, 0, 0.9),
    tp(cone(0.24, 0.35, 4), 0, 1.36, 0, 1, 1, 1, 0, 0.4),
  ]),
  paperhouse: () => merge([
    tp(box(0.5, 0.42, 0.44), 0, 0.21),
    tp(box(0.35, 0.35, 0.44), 0, 0.42, 0, 1, 1, 1, 0, 0, PI / 4),
    fp(box(0.38, 0.025, 0.54), 0xfff6e6, 0.145, 0.54, 0, 1, 1, 1, 0, 0, -0.7),
    fp(box(0.38, 0.025, 0.54), 0xfff6e6, -0.145, 0.54, 0, 1, 1, 1, 0, 0, 0.7),
    fp(box(0.12, 0.2, 0.02), 0x6a4a8a, -0.08, 0.1, 0.225),
    fg(box(0.1, 0.1, 0.02), 0xffe08a, 0.13, 0.25, 0.225),
  ]),
  // W28 Circus Tent
  circustent: () => merge([
    fp(cyl(0.5, 0.5, 0.5, 12), 0xfff4e4, 0, 0.25),
    ...around(6, (a) => tp(box(0.14, 0.5, 0.03), Math.cos(a) * 0.5, 0.25, Math.sin(a) * 0.5, 1, 1, 1, 0, -a - PI / 2, 0)),
    tp(cone(0.62, 0.55, 12), 0, 0.775),
    ...around(12, (a) => fp(sph(0.07, 6, 4), 0xffd23d, Math.cos(a) * 0.6, 0.5, Math.sin(a) * 0.6, 1, 0.7, 1)),
    fp(cyl(0.015, 0.015, 0.3, 4), 0x6a4a3a, 0, 1.15, 0),
    fp(cone(0.08, 0.18, 3), 0xffd23d, 0.07, 1.22, 0, 1, 1, 0.3, 0, 0, -PI / 2),
    fp(box(0.18, 0.3, 0.02), 0x3a2a3a, 0, 0.15, 0.5),
  ]),
};

// ---------------------------------------------------------------- registry
const BUILDERS: Record<string, Builder> = {
  ...GARDEN, ...CANDY, ...ICE, ...NEON, ...SLIME, ...TOYS, ...SPACE, ...ROBOT, ...LIBRARY, ...REEF, ...DESERT, ...JUNGLE,
  ...SKY, ...FESTIVAL, ...MUSIC, ...HAUNTED, ...VOLCANO, ...CRYSTAL, ...DREAM, ...RAINBOW_PROPS, ...BONUS,
};

/** every prop kind this module can build */
export const PROP_KINDS = Object.keys(BUILDERS);

export function propGeometry(kind: string): THREE.BufferGeometry {
  return (BUILDERS[kind] ?? BUILDERS.bush)();
}
