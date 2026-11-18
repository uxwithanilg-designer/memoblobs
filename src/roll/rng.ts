// Seeded randomness for Momo Sky Roll: the same seed always builds the same level (fair, shareable, testable).

export function hash32(...xs: number[]): number {
  let h = 0x811c9dc5;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 0x9e3779b9; }
  /** mulberry32 → [0, 1) */
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  /** integer in [a, b] inclusive */
  int(a: number, b: number) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick<T>(a: readonly T[]): T { return a[Math.floor(this.next() * a.length)]; }
  chance(p: number) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}
