// Marble Merge 2048 physics: numbered marbles in a glass jar. A small, fixed-step 2D circle solver (no library), so the
// same drops always give the same jar: the stage builder's test player and the game run the very same code.
//
// Units: the jar is 100 wide (x 0…100) and 150 deep (y 0 at the rim, 150 at the floor, y grows downwards). A marble's
// size grows with its number. Two equal marbles that touch merge into one marble of double the number, popping out a
// little bigger at the point between them — that can push neighbours into new matches, so merges chain.
// Rocks never merge: a merge right next to one cracks it and the second crack smashes it. A frozen marble can't merge
// until a merge next to it thaws it. A resting marble above the danger line for too long overflows the jar.

export const JAR_W = 100, JAR_H = 150, DANGER = 24, SPAWN_Y = -12;
export const ROCK = -1;
export const DT = 1 / 120;
const G = 620;

export const rOf = (v: number) => (v < 0 ? 9.6 : 5.8 + 1.15 * (Math.log2(v) - 1));

export interface Ball { id: number; v: number; x: number; y: number; vx: number; vy: number; r: number; a: number; hp?: number; ice?: boolean; landed?: boolean; over?: number; age: number; z?: boolean; zc?: number }
export interface Seg { x1: number; y1: number; x2: number; y2: number; t: number }
export interface Peg { x: number; y: number; r: number }
export type JarKind = "classic" | "vee" | "bowl" | "ramp" | "pegs" | "divider" | "steps";
export interface JarSpec { kind: JarKind; w: number; flip: boolean; pegs: number; seed: number }
export interface Jar { spec: JarSpec; outline: [number, number][]; segs: Seg[]; pegs: Peg[]; left: number; right: number }

export type SimEvent =
  | { k: "merge"; x: number; y: number; v: number; chain: number; gained: number }
  | { k: "hit"; x: number; s: number }
  | { k: "crack"; x: number; y: number }
  | { k: "smash"; x: number; y: number }
  | { k: "thaw"; x: number; y: number };

/** the jar's walls from its spec (deterministic) */
export function jarOf(spec: JarSpec): Jar {
  const L = 50 - spec.w / 2, R = 50 + spec.w / 2, H = JAR_H, ch = 7;
  let pts: [number, number][];
  const pegs: Peg[] = [];
  const extra: Seg[] = [];
  switch (spec.kind) {
    case "vee": pts = [[L, 0], [L, H - 30], [50, H], [R, H - 30], [R, 0]]; break;
    case "bowl": pts = [[L, 0], [L, H * 0.45], [L + 9, H - ch], [L + 9 + ch, H], [R - 9 - ch, H], [R - 9, H - ch], [R, H * 0.45], [R, 0]]; break;
    case "ramp": pts = [[L, 0], [L, H - 22], [R - ch, H], [R, H - ch], [R, 0]]; break;
    case "steps": pts = [[L, 0], [L, H - ch], [L + ch, H], [50, H], [50, H - 16], [R - ch, H - 16], [R, H - 16 - ch], [R, 0]]; break;
    default: pts = [[L, 0], [L, H - ch], [L + ch, H], [R - ch, H], [R, H - ch], [R, 0]];
  }
  if (spec.flip) pts = pts.map(([x, y]) => [100 - x, y] as [number, number]).reverse();
  if (spec.kind === "pegs") {
    // a few round bumpers in the lower half, seeded
    let s = spec.seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const n = Math.max(2, spec.pegs);
    for (let i = 0; i < n; i++) {
      const row = i % 2, k = Math.floor(i / 2), per = Math.ceil(n / 2);
      const x = L + ((k + 0.5 + (row ? 0.5 : 0)) / (per + (row ? 1 : 0))) * spec.w + (rnd() - 0.5) * 4;
      pegs.push({ x: Math.max(L + 10, Math.min(R - 10, x)), y: 78 + row * 26 + (rnd() - 0.5) * 6, r: 2.6 });
    }
  }
  if (spec.kind === "divider") extra.push({ x1: 50, y1: H, x2: 50, y2: H - 34, t: 1.4 });
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push({ x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], t: 0 });
  segs.push(...extra);
  return { spec, outline: pts, segs, pegs, left: Math.min(L, R), right: Math.max(L, R) };
}

const mass = (b: Ball) => b.r * b.r * (b.v < 0 ? 1.6 : 1);
export const cloneBalls = (bs: Ball[]) => bs.map((b) => ({ ...b }));

export class Sim {
  balls: Ball[] = [];
  t = 0; nextId = 1; score = 0; chain = 0; best = 0;
  events: SimEvent[] | null = null;
  private quiet = 0; private calm = 0;
  constructor(public jar: Jar, balls?: Ball[]) {
    if (balls) { this.balls = cloneBalls(balls); this.nextId = balls.reduce((m, b) => Math.max(m, b.id), 0) + 1; }
    this.best = this.maxValue();
  }
  maxValue() { return this.balls.reduce((m, b) => (b.v > m ? b.v : m), 0); }
  rocks() { return this.balls.reduce((n, b) => n + (b.v === ROCK ? 1 : 0), 0); }
  add(v: number, x: number, y: number, o: Partial<Ball> = {}): Ball {
    const b: Ball = { id: this.nextId++, v, x, y, vx: 0, vy: 0, r: rOf(v), a: 0, age: 0, ...o };
    if (v === ROCK && b.hp === undefined) b.hp = 2;
    this.balls.push(b);
    if (v > this.best) this.best = v;
    this.quiet = 0; this.calm = 0;
    return b;
  }
  /** the x range a marble of this number can be dropped at */
  aimRange(v: number) { const r = rOf(v); return [this.jar.left + r + 0.5, this.jar.right - r - 0.5] as const; }
  drop(v: number, x: number): Ball {
    const [a, b] = this.aimRange(v);
    this.chain = 0;
    return this.add(v, Math.max(a, Math.min(b, x)), SPAWN_Y, { vy: 40 });
  }

  step(dt = DT) {
    const bs = this.balls;
    this.t += dt;
    let maxSp = 0;
    for (const b of bs) {
      b.age += dt;
      if (b.z) continue;
      b.vy += G * dt;
      b.vx *= 0.9995; b.vy *= 0.9995;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.a += (b.vx * dt) / b.r;
    }
    // sweep and prune: keep the list sorted by x (nearly sorted already → insertion sort)
    for (let i = 1; i < bs.length; i++) { const b = bs[i]; let j = i - 1; while (j >= 0 && bs[j].x - bs[j].r > b.x - b.r) { bs[j + 1] = bs[j]; j--; } bs[j + 1] = b; }
    const merges: [Ball, Ball][] = [];
    const used = new Set<number>();
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (used.has(a.id)) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          if (b.x - b.r > a.x + a.r) break;
          if (used.has(b.id)) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          if (a.v > 0 && a.v === b.v && !a.ice && !b.ice) { used.add(a.id); used.add(b.id); merges.push([a, b]); break; }
          if (a.z && b.z) continue;
          const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d, pen = rr - d;
          // a resting marble acts like a wall unless it's hit hard
          if (a.z || b.z) {
            const sl = a.z ? a : b, mv = a.z ? b : a, sg = a.z ? 1 : -1;
            const vn0 = (mv.vx * nx + mv.vy * ny) * sg;
            if (vn0 < -70) { sl.z = false; sl.zc = 0; }
            else {
              mv.x += nx * pen * sg; mv.y += ny * pen * sg;
              if (vn0 < 0) { mv.vx -= (1.04 * vn0) * nx * sg; mv.vy -= (1.04 * vn0) * ny * sg; mv.vx *= 0.985; mv.vy *= 0.985; }
              if (sl.landed) mv.landed = true;
              continue;
            }
          }
          const wa = 1 / mass(a), wb = 1 / mass(b), corr = Math.min(pen, rr * 0.4) / (wa + wb) * 0.85;
          a.x -= nx * corr * wa; a.y -= ny * corr * wa; b.x += nx * corr * wb; b.y += ny * corr * wb;
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const e = vn < -80 ? 0.22 : 0.05;
            const imp = (-(1 + e) * vn) / (wa + wb);
            a.vx -= imp * nx * wa; a.vy -= imp * ny * wa; b.vx += imp * nx * wb; b.vy += imp * ny * wb;
            // a little friction along the contact
            const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, ft = (vt * 0.06) / (wa + wb);
            a.vx += ft * tx * wa; a.vy += ft * ty * wa; b.vx -= ft * tx * wb; b.vy -= ft * ty * wb;
            if (it === 0 && vn < -90 && this.events) this.events.push({ k: "hit", x: (a.x + b.x) / 2, s: Math.min(1, -vn / 400) });
          }
          if (a.landed || b.landed) { a.landed = b.landed = true; }
          a.vx *= 0.997; a.vy *= 0.997; b.vx *= 0.997; b.vy *= 0.997;
        }
      }
      for (const b of bs) { if (used.has(b.id) || b.z) continue; this.walls(b, it === 0); }
    }
    for (const [a, b] of merges) this.merge(a, b);
    if (merges.length) this.wake();
    let awake = 0;
    for (const b of this.balls) {
      if (b.z) continue;
      const sp = b.vx * b.vx + b.vy * b.vy;
      if (sp > 250000) { const k = 500 / Math.sqrt(sp); b.vx *= k; b.vy *= k; }
      if (b.landed && sp < 9) { b.vx *= 0.85; b.vy *= 0.9; }
      if (sp > maxSp) maxSp = sp;
      // never leave the jar
      if (b.y > JAR_H - b.r + 4) { b.y = JAR_H - b.r; b.vy = Math.min(0, b.vy); }
      if (b.x < this.jar.left + b.r - 2) b.x = this.jar.left + b.r;
      if (b.x > this.jar.right - b.r + 2) b.x = this.jar.right - b.r;
      // fall asleep after resting a moment
      if (b.landed && sp < 160) { b.zc = (b.zc ?? 0) + 1; if (b.zc > 18) { b.z = true; b.vx = b.vy = 0; } } else b.zc = 0;
      if (!b.z) awake++;
    }
    this.quiet = awake === 0 && maxSp < 400 ? this.quiet + 1 : 0;
    // a marble that keeps wobbling slowly must not hold the jar 'busy' forever
    this.calm = maxSp < 1600 && !merges.length ? this.calm + 1 : 0;
  }

  private walls(b: Ball, first: boolean) {
    for (const s of this.jar.segs) {
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1, l2 = ex * ex + ey * ey;
      let t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.x1 + ex * t, py = s.y1 + ey * t;
      this.push(b, px, py, s.t, first);
    }
    for (const p of this.jar.pegs) this.push(b, p.x, p.y, p.r, first);
  }
  private push(b: Ball, px: number, py: number, rad: number, first: boolean) {
    const dx = b.x - px, dy = b.y - py, R = b.r + rad, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
    b.x += nx * (R - d); b.y += ny * (R - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const e = vn < -100 ? 0.25 : 0.04;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      b.vx *= 0.985; b.vy *= 0.985;
      if (first && vn < -110 && this.events) this.events.push({ k: "hit", x: b.x, s: Math.min(1, -vn / 420) });
    }
    b.landed = true;
  }

  private merge(a: Ball, b: Ball) {
    const i = this.balls.indexOf(a), j = this.balls.indexOf(b);
    if (i < 0 || j < 0) return;
    const v = a.v * 2;
    const x = (a.x + b.x) / 2, y = Math.max(a.y, b.y) - (Math.abs(a.y - b.y) / 2);
    this.balls = this.balls.filter((q) => q !== a && q !== b);
    this.chain++;
    const gained = Math.round(v * (1 + (this.chain - 1) * 0.5));
    this.score += gained;
    const n = this.add(v, x, y, { vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2) - 55, landed: true, a: (a.a + b.a) / 2 });
    n.y = Math.min(n.y, JAR_H - n.r);
    this.events?.push({ k: "merge", x: n.x, y: n.y, v, chain: this.chain, gained });
    // cracks and thaws next to the merge
    const reach = n.r + 5;
    for (const q of [...this.balls]) {
      if (q === n) continue;
      const d = Math.hypot(q.x - n.x, q.y - n.y);
      if (d > reach + q.r) continue;
      if (q.v === ROCK) {
        q.hp = (q.hp ?? 2) - 1;
        if (q.hp <= 0) { this.balls = this.balls.filter((z) => z !== q); this.events?.push({ k: "smash", x: q.x, y: q.y }); }
        else this.events?.push({ k: "crack", x: q.x, y: q.y });
      } else if (q.ice) { q.ice = false; this.events?.push({ k: "thaw", x: q.x, y: q.y }); }
    }
  }

  /** wake every marble (after a merge or a removal, so marbles above can fall) */
  wake() { for (const b of this.balls) { b.z = false; b.zc = 0; } this.quiet = 0; this.calm = 0; }
  isQuiet() { return this.quiet > 2 || this.calm > 180; }
  /** step until everything rests (or the time cap) */
  settle(maxT = 2.6) { const end = this.t + maxT; while (this.t < end) { this.step(); if (this.isQuiet()) return true; } return false; }
  /** the highest marble top among resting marbles (smaller = fuller) */
  topY() { let m = JAR_H; for (const b of this.balls) if (b.landed && b.y - b.r < m) m = b.y - b.r; return m; }
  overflow() { return this.topY() < DANGER; }
}
