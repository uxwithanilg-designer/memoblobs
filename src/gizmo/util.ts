// Small shared helpers for Gizmo Drive: a seeded random generator (every stage is the same for every player) and
// colour mixing for the world palettes. No DOM here: the course, the physics and the QA bot all use it in Node too.

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
/** a weighted pick: [item, weight][] */
export function weighted<T>(r: Rng, list: readonly (readonly [T, number])[]): T {
  let sum = 0;
  for (const [, w] of list) sum += w;
  let x = r() * sum;
  for (const [it, w] of list) { x -= w; if (x <= 0) return it; }
  return list[list.length - 1][0];
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
/** "#rrggbb" + alpha → "rgba(...)" */
export function rgba(c: string, a: number) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
