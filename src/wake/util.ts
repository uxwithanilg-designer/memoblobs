// Small shared helpers for Wake Racers: a seeded random generator (every stage is the same for every player), smooth
// 2D noise for the land, the islands and the clouds, and colour mixing for the world palettes. No DOM and no three.js
// here: the course, the physics and the QA bot all run in Node too.

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoothstep = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
export const TAU = Math.PI * 2;
/** the shortest signed angle from a to b */
export const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** frame-rate independent easing towards a target: k = rate per second */
export const ease = (v: number, target: number, k: number, dt: number) => v + (target - v) * (1 - Math.exp(-k * dt));

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
/** a weighted pick: [item, weight][] */
export function weighted<T>(r: Rng, list: readonly (readonly [T, number])[]): T {
  let sum = 0;
  for (const [, w] of list) sum += w;
  let x = r() * sum;
  for (const [it, w] of list) { x -= w; if (x <= 0) return it; }
  return list[list.length - 1][0];
}
export function shuffle<T>(r: Rng, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/** a stable hash of two integers (for per-cell randomness without a generator) */
export function hash2(x: number, y: number, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ noise
/** smooth value noise in 2D, roughly 0..1 (no allocation; deterministic per seed) */
export function vnoise(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fractal noise: `oct` octaves of value noise, 0..1 */
export function fbm(x: number, y: number, oct = 4, seed = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}
/** ridged noise (sharp crests for mountains and dunes), 0..1 */
export function ridge(x: number, y: number, oct = 4, seed = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f, seed + i * 31) * 2 - 1); s += amp * n * n; norm += amp; amp *= 0.5; f *= 2.1; }
  return s / norm;
}

// ------------------------------------------------------------------ colours
/** "#rrggbb" → [r, g, b] 0..255 */
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
/** "#rrggbb" → linear-ish 0..1 floats written into out[o..o+2] (sRGB → linear, for vertex colours) */
export function writeColor(out: Float32Array | number[], o: number, hex: string, k = 1) {
  const [r, g, b] = rgb(hex);
  out[o] = srgbToLinear(r / 255) * k; out[o + 1] = srgbToLinear(g / 255) * k; out[o + 2] = srgbToLinear(b / 255) * k;
}
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
