// Small shared helpers for Crumble Crew: a seeded random generator (every heist is the same for every player), value
// noise, colour mixing for the district palettes, and angle helpers.

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

/** a small, fast seeded generator (mulberry32): rng() → [0, 1) */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = ReturnType<typeof makeRng>;
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, list: readonly T[]) => list[Math.floor(r() * list.length) % list.length];
export const chance = (r: Rng, p: number) => r() < p;
/** a weighted pick: [[value, weight], …] */
export function weighted<T>(r: Rng, list: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of list) total += w;
  let v = r() * total;
  for (const [x, w] of list) { v -= w; if (v <= 0) return x; }
  return list[0][0];
}

/** 1-D value noise in [-1, 1], smooth (cosine-eased), seeded */
export function noise1(seed: number) {
  const r = makeRng(seed);
  const table = new Float32Array(512);
  for (let i = 0; i < table.length; i++) table[i] = r() * 2 - 1;
  return (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = table[i & 511], b = table[(i + 1) & 511];
    return lerp(a, b, (1 - Math.cos(f * Math.PI)) * 0.5);
  };
}

// ------------------------------------------------------------------ colours
const cache = new Map<string, [number, number, number]>();
/** "#rrggbb" → [r, g, b] */
export function rgb(hex: string): [number, number, number] {
  const hit = cache.get(hex);
  if (hit) return hit;
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  const v: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  if (cache.size < 4000) cache.set(hex, v);
  return v;
}
const hx = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
export const toHex = (c: [number, number, number]) => `#${hx(c[0])}${hx(c[1])}${hx(c[2])}`;
/** mix two "#rrggbb" colours: t = 0 → a, 1 → b */
export function mix(a: string, b: string, t: number) {
  const x = rgb(a), y = rgb(b);
  return toHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
}
/** lighten (t > 0, towards white) or darken (t < 0, towards black) */
export const shade = (c: string, t: number) => (t >= 0 ? mix(c, "#ffffff", t) : mix(c, "#000000", -t));
/** "#rrggbb" + alpha → "rgba(...)" */
export function rgba(c: string, a: number) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${Math.round(clamp(a, 0, 1) * 1000) / 1000})`;
}

/** the shortest signed difference between two angles (radians) */
export function angDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
/** "#rrggbb" → 0xrrggbb */
export const hex = (c: string) => parseInt(c.slice(1, 7), 16);
