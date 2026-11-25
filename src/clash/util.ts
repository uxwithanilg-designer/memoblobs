// Small shared helpers for Cube Clash: a seeded random generator (every stage is the same for every player), value
// noise for the islands and maps, and colour mixing for the world palettes and the pixel textures.

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;
/** shortest signed angle from a to b */
export function angleTo(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}
/** frame-rate independent smoothing: move `cur` toward `to` with a half-life of `hl` seconds */
export const damp = (cur: number, to: number, hl: number, dt: number) => to + (cur - to) * Math.pow(0.5, dt / Math.max(1e-4, hl));

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
export const irange = (r: Rng, a: number, b: number) => Math.floor(a + (b - a + 1) * r());
export const pick = <T,>(r: Rng, list: readonly T[]) => list[Math.floor(r() * list.length) % list.length];
export const chance = (r: Rng, p: number) => r() < p;
export function shuffle<T>(r: Rng, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/** a stable hash of integers → [0, 1) */
export function hash(a: number, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2-D value noise in [0, 1], smooth, seeded */
export function noise2(seed: number) {
  const r = makeRng(seed);
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x: number, y: number) => P[((y & 255) << 8) | (x & 255)];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };
}
/** fractal noise (a few octaves of noise2) in about [0, 1] */
export function fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 3) {
  let s = 0, a = 0.5, f = 1, t = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; }
  return s / t;
}

// ------------------------------------------------------------------ colours
/** "#rrggbb" → [r, g, b] */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
export function rgba(c: string, a: number) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
