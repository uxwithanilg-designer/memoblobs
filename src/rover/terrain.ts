// Peak Rover's tracks. A track is a height field (one height every half metre) built from layered noise plus designed
// features — kicker ramps, jumps over open gaps, rope bridges over chasms, rock steps, whoops, steep climbs, valleys and
// boulders — with checkpoints, a finish line, coins, fuel cans, hearts, power-ups and the world's props placed on it.
// Everything comes from the stage's seed, so a stage is the same for every player.
import { stagePlan, type StagePlan } from "./stages";
import { WORLDS, worldOf, type PropKind, type TerrainStyle, type World } from "./worlds";
import { chance, clamp, makeRng, noise1, pick, range, smooth, type Rng } from "./util";

export type PowerId = "turbo" | "shield" | "magnet" | "feather" | "double";
export const POWERS: { id: PowerId; label: string; secs: number }[] = [
  { id: "turbo", label: "Turbo", secs: 4 },
  { id: "shield", label: "Shield", secs: 12 },
  { id: "magnet", label: "Magnet", secs: 12 },
  { id: "feather", label: "Feather", secs: 8 },
  { id: "double", label: "Coins ×2", secs: 15 },
];
export type ItemKind = "coin" | "fuel" | "heart" | "power";
export interface Item { kind: ItemKind; x: number; y: number; value: number; power: PowerId | null; taken: boolean; phase: number }
export interface PropSpot { kind: PropKind; x: number; y: number; s: number; flip: boolean; back: boolean; seed: number }
export interface Span { x0: number; x1: number }
export interface Bridge extends Span { y0: number; y1: number; sag: number }

export class Terrain {
  constructor(public x0: number, public dx: number, public h: Float32Array) {}
  get x1() { return this.x0 + (this.h.length - 1) * this.dx; }
  heightAt(x: number) {
    const f = (x - this.x0) / this.dx;
    const n = this.h.length;
    if (f <= 0) return this.h[0];
    if (f >= n - 1) return this.h[n - 1];
    const i = Math.floor(f), t = f - i;
    return this.h[i] + (this.h[i + 1] - this.h[i]) * t;
  }
  slopeAt(x: number) {
    const f = (x - this.x0) / this.dx;
    const i = clamp(Math.floor(f), 0, this.h.length - 2);
    return (this.h[i + 1] - this.h[i]) / this.dx;
  }
  /**
   * The closest point on the ground to (cx, cy) within reach r: out.d = distance (negative when the point is under
   * the ground), out.n = the ground's normal there, out.q = the point. Returns false when nothing is in reach.
   */
  closest(cx: number, cy: number, r: number, out: { d: number; nx: number; ny: number; qx: number; qy: number }) {
    const h = this.h, dx = this.dx, n = h.length;
    const i0 = clamp(Math.floor((cx - r - this.x0) / dx) - 1, 0, n - 2);
    const i1 = clamp(Math.ceil((cx + r - this.x0) / dx) + 1, 0, n - 2);
    let best = Infinity, bx = 0, by = 0;
    for (let i = i0; i <= i1; i++) {
      const ax = this.x0 + i * dx, ay = h[i], ex = dx, ey = h[i + 1] - ay;
      let t = ((cx - ax) * ex + (cy - ay) * ey) / (ex * ex + ey * ey);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t, qy = ay + ey * t;
      const d2 = (cx - qx) * (cx - qx) + (cy - qy) * (cy - qy);
      if (d2 < best) { best = d2; bx = qx; by = qy; }
    }
    if (best === Infinity) return false;
    const d = Math.sqrt(best);
    const under = cy < this.heightAt(cx);
    out.qx = bx; out.qy = by;
    if (d > 1e-6 && !under) { out.d = d; out.nx = (cx - bx) / d; out.ny = (cy - by) / d; }
    else {
      const s = this.slopeAt(cx), inv = 1 / Math.sqrt(1 + s * s);
      out.nx = -s * inv; out.ny = inv; out.d = -d;
    }
    return true;
  }
}

export interface Track {
  plan: StagePlan;
  world: World;
  partner: World | null;
  terrain: Terrain;
  /** the ground's top as drawn: the same as the terrain, except under bridges (the chasm below) */
  fill: Float32Array;
  pits: Span[];
  bridges: Bridge[];
  /** ramp lips (for coin arcs and the camera) */
  ramps: number[];
  checkpoints: number[];
  finish: number;
  items: Item[];
  props: PropSpot[];
}

function blendStyle(a: TerrainStyle, b: TerrainStyle | undefined, t: number): TerrainStyle {
  if (!b) return a;
  const o = { ...a };
  for (const k of Object.keys(a) as (keyof TerrainStyle)[]) o[k] = a[k] + (b[k] - a[k]) * t * 1.4;
  return o;
}

type Feature = "ramp" | "pit" | "bridge" | "steps" | "whoops" | "steep" | "valley" | "rocks" | "rest";

export function buildTrack(planOrN: StagePlan | number): Track {
  const plan = typeof planOrN === "number" ? stagePlan(planOrN) : planOrN;
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const st = blendStyle(world.terrain, partner?.terrain, plan.blendAmt);
  const r = makeRng(plan.seed);
  const d = plan.difficulty;
  const L = plan.length, x0 = -45, dx = 0.5, end = L + 110;
  const N = Math.ceil((end - x0) / dx) + 1;
  const H = new Float32Array(N);
  const edge = new Uint8Array(N);
  const X = (i: number) => x0 + i * dx;
  const I = (x: number) => clamp(Math.round((x - x0) / dx), 0, N - 1);

  // ---- base: four octaves of noise, the world's trend, flat at the start and the finish
  const n1 = noise1(plan.seed + 1), n2 = noise1(plan.seed + 2), n3 = noise1(plan.seed + 3), n4 = noise1(plan.seed + 4);
  const big = st.amp * (7 + 15 * d), mid = st.amp * (2.5 + 7 * d), small = st.bump * (0.5 + 2.2 * d), tiny = st.bump * (0.04 + 0.28 * d);
  for (let i = 0; i < N; i++) {
    const x = X(i);
    const env = smooth(clamp((x - 8) / 70, 0, 1));
    H[i] = env * (big * n1(x / 160) + mid * n2(x / 60) + small * n3(x / 19) + tiny * n4(x / 5.5)) + st.trend * Math.max(0, x) * (0.6 + d);
  }

  // ---- checkpoints first (features keep clear of them)
  const checkpoints: number[] = [];
  const parts = L > 760 ? Math.ceil(L / 460) : 1;
  for (let k = 1; k < parts; k++) checkpoints.push(Math.round((L * k) / parts));
  const nearCp = (x: number, m: number) => checkpoints.some((c) => Math.abs(c - x) < m);

  // ---- features
  const pits: Span[] = [], bridges: Bridge[] = [], ramps: number[] = [];
  const spots: { f: Feature; x: number; len: number }[] = [];
  const W: [Feature, number][] = [
    ["ramp", st.ramps * (0.5 + d)],
    ["pit", d > 0.28 ? st.gaps * (d + 0.1) : 0],
    ["bridge", st.bridges * 0.75],
    ["steps", d > 0.12 ? st.steps * (0.3 + d) : 0],
    ["whoops", st.whoops * 0.8],
    ["steep", st.steep * (0.4 + d)],
    ["valley", st.valleys * (0.3 + d)],
    ["rocks", d > 0.2 ? st.rocks * (0.3 + d) : 0],
    ["rest", 0.55 * (1 - d) + 0.15],
  ];
  const total = W.reduce((s, [, w]) => s + w, 0);
  const choose = (rr: Rng): Feature => { let v = rr() * total; for (const [f, w] of W) { v -= w; if (v <= 0) return f; } return "rest"; };
  /** add y(t) for t in 0..1 across [xa, xb] */
  const add = (xa: number, xb: number, f: (t: number) => number) => { for (let i = I(xa); i <= I(xb); i++) H[i] += f(clamp((X(i) - xa) / (xb - xa), 0, 1)); };
  /** shift everything from xa on by v, eased in over `ease` metres */
  const shiftFrom = (xa: number, v: number, ease: number) => { for (let i = I(xa); i < N; i++) H[i] += v * smooth(clamp((X(i) - xa) / ease, 0, 1)); };
  const markEdge = (xa: number, xb: number) => { for (let i = I(xa); i <= I(xb); i++) edge[i] = 1; };

  let x = 80;
  while (x < L - 90) {
    let f = choose(r);
    let len = 0;
    if (nearCp(x, 45) || nearCp(x + 60, 45)) f = "rest";
    // every stage has at least two kickers (by a third and two thirds of the way): hold the gas in the air and you flip
    else if (f !== "pit" && f !== "ramp" && ramps.length < 2 && x > (L * (ramps.length + 1)) / 3.2) f = "ramp";
    // steps and boulders only on gentle ground (on a steep hillside they would add up to a wall)
    if ((f === "steps" || f === "rocks") && Math.abs(H[I(x + 30)] - H[I(x)]) / 30 > 0.22) f = "whoops";
    // the same for kickers: one built into a steep climb leaves a spike and a drop instead of a jump
    if (f === "ramp" && Math.abs(H[I(x + 24)] - H[I(x - 8)]) / 32 > 0.2) f = "whoops";
    switch (f) {
      case "ramp": {
        // a designed kicker (not added on top of the hills, so its lip is always about 15–25°): a short level run-in,
        // the curve up, a drop back to the ramp's foot, and a soft dip that catches the landing
        len = 9 + 6 * d;
        const rise = Math.min(0.26 * len, 1.4 + 2.6 * d * range(r, 0.7, 1.1));
        const y0 = H[I(x)];
        for (let i = I(x - 8); i < I(x); i++) { const u = smooth(clamp((X(i) - (x - 8)) / 8, 0, 1)); H[i] = H[i] * (1 - u) + y0 * u; }
        for (let i = I(x); i <= I(x + len); i++) H[i] = y0 + rise * Math.pow(clamp((X(i) - x) / len, 0, 1), 1.7);
        // everything after the lip continues from the ramp's foot
        shiftFrom(x + len + dx, y0 - H[I(x + len + 1.5)], 0.01);
        for (let i = I(x + len + dx); i <= I(x + len + 1.5); i++) H[i] = y0 + rise * (1 - clamp((X(i) - x - len) / 1.5, 0, 1));
        markEdge(x + len - 0.5, x + len + 2);
        add(x + len + 4, x + len + 26, (t) => -rise * 0.35 * Math.sin(Math.PI * t));
        ramps.push(x + len);
        len += 26;
        break;
      }
      case "pit": {
        // a run-up: the 45 m before the ramp ease into a gentle downhill, so there's always speed for the jump
        const y0 = H[I(x)];
        for (let i = I(x - 45); i < I(x); i++) { const u = smooth(clamp((X(i) - (x - 45)) / 35, 0, 1)); H[i] = H[i] * (1 - u) + (y0 + (x - X(i)) * 0.05) * u; }
        // a designed kicker with a lip of about 20°
        const rl = 11 + 4 * d, rise = Math.min(0.24 * rl, 1.6 + 1.8 * d);
        for (let i = I(x); i <= I(x + rl); i++) H[i] = y0 + rise * Math.pow(clamp((X(i) - x) / rl, 0, 1), 1.6);
        const lip = x + rl, w = (4 + 5.5 * d) * range(r, 0.85, 1.1);
        const top = y0 + rise;
        // the far side always lands lower than the lip (whatever the hills around it do)
        shiftFrom(lip + dx, top - rise * 0.6 - 0.9 - H[I(lip + w + 0.5)], 0.01);
        for (let i = I(lip + 0.3); i <= I(lip + w); i++) H[i] = top - 34;
        markEdge(lip - 0.5, lip + w + 1);
        pits.push({ x0: lip, x1: lip + w });
        ramps.push(lip);
        len = rl + w + 22;
        break;
      }
      case "bridge": {
        const w = 14 + 16 * r() + 6 * d;
        const a = H[I(x)];
        const drop = range(r, -1.2, 1.2);
        // the chasm's far side at the bridge's height
        const b = H[I(x + w)];
        shiftFrom(x + w, a + drop - b, 0.01);
        const sag = 0.25 + 0.45 * r();
        bridges.push({ x0: x, x1: x + w, y0: a, y1: a + drop, sag });
        for (let i = I(x); i <= I(x + w); i++) { const t = (X(i) - x) / w; H[i] = a + drop * t - sag * Math.sin(Math.PI * t); }
        markEdge(x - 1, x + w + 1);
        len = w + 18;
        break;
      }
      case "steps": {
        const count = 3 + Math.floor(4 * d * r() + 2 * d);
        // each step stays below the axle of the smallest wheel, with a face you can climb with a run-up
        const rise = 0.18 + 0.28 * d;
        let cx = x;
        for (let k = 0; k < count; k++) {
          const run = range(r, 3.2, 5.5);
          shiftFrom(cx, rise, 0.6);
          markEdge(cx - 0.3, cx + 0.9);
          cx += run;
        }
        shiftFrom(cx + 4, -rise * count * 0.5, 22);
        len = cx - x + 26;
        break;
      }
      case "whoops": {
        len = range(r, 28, 55);
        const amp = 0.22 + 0.5 * d, lam = range(r, 3.6, 5.2);
        add(x, x + len, (t) => amp * (1 - Math.cos((2 * Math.PI * t * len) / lam)) * 0.5 * Math.sin(Math.PI * t));
        break;
      }
      case "steep": {
        len = range(r, 55, 80);
        const rise = (5 + 9 * d) * range(r, 0.8, 1.1);
        shiftFrom(x, rise, len * 0.75);
        break;
      }
      case "valley": {
        len = range(r, 40, 70);
        const depth = 5 + 9 * d;
        add(x, x + len, (t) => -depth * Math.pow(Math.sin(Math.PI * t), 1.4));
        break;
      }
      case "rocks": {
        const count = 2 + Math.floor(r() * 3);
        let cx = x;
        for (let k = 0; k < count; k++) {
          // a rounded boulder (no vertical sides at its foot)
          const R = 0.6 + 0.6 * d * range(r, 0.7, 1.2), hb = R * 0.55;
          add(cx - R, cx + R, (t) => hb * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)));
          markEdge(cx - R, cx + R);
          cx += range(r, 3.5, 7);
        }
        len = cx - x + 6;
        break;
      }
      default: len = range(r, 18, 30);
    }
    spots.push({ f, x, len });
    x += len + range(r, 0.6, 1.3) * (55 - 22 * d);
  }

  // ---- checkpoints sit on level ground. Flattened before the slope cap below, which then eases their joins into the
  // hills (flattened after it, a checkpoint on a mountainside was left with a near-vertical wall beside it)
  const level = (xc: number, half: number) => {
    const y = H[I(xc)];
    for (let i = I(xc - half - 10); i <= I(xc + half + 10); i++) {
      const dd = Math.abs(X(i) - xc);
      const t = dd <= half ? 1 : 1 - smooth((dd - half) / 10);
      if (!edge[i]) H[i] = H[i] + (y - H[i]) * t;
    }
  };
  for (const c of checkpoints) level(c, 9);

  // ---- slopes: nothing steeper than the cap except the designed edges, then a light smoothing
  // 31° on easy stages up to 36° on the hardest: every ride can crawl up that with bare tyres, but full gas on it lifts
  // the nose (speed control). Short designed edges (ramp lips, steps, boulders) may be steeper.
  // It works on the height *differences*, so a designed edge rides along with the ground it sits on (skipping edges
  // while lowering the ground around them turned a 0.8 m boulder or a ramp lip into a wall)
  const maxS = (0.6 + 0.12 * d) * dx;
  const before = new Float32Array(H);
  for (let pass = 0; pass < 2; pass++) {
    let prevOld = H[0];
    for (let i = 1; i < N; i++) {
      const old = H[i];
      let v = old - prevOld;
      prevOld = old;
      if (!edge[i] && !edge[i - 1]) v = v > maxS ? maxS : v < -maxS ? -maxS : v;
      H[i] = H[i - 1] + v;
    }
  }
  // the bridges were hung at absolute heights: move them with their ground
  for (const b of bridges) { const sh = H[I(b.x0)] - before[I(b.x0)]; b.y0 += sh; b.y1 += sh; }
  const tmp = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) {
    tmp.set(H);
    for (let i = 1; i < N - 1; i++) if (!edge[i - 1] && !edge[i] && !edge[i + 1]) H[i] = (tmp[i - 1] + 2 * tmp[i] + tmp[i + 1]) / 4;
  }
  // the finish and the start sit on level ground too
  const fy = H[I(L - 10)];
  for (let i = I(L - 10); i < N; i++) H[i] = fy;
  const sy = H[I(10)];
  for (let i = 0; i <= I(10); i++) H[i] = sy;

  const terrain = new Terrain(x0, dx, H);
  const fill = new Float32Array(H);
  for (const b of bridges) for (let i = I(b.x0 + 0.5); i <= I(b.x1 - 0.5); i++) fill[i] = Math.min(b.y0, b.y1) - 30;
  const inGap = (xx: number, m = 0) => pits.some((p) => xx > p.x0 - m && xx < p.x1 + m) || bridges.some((b) => xx > b.x0 - m && xx < b.x1 + m);
  const nearRamp = (xx: number) => ramps.some((rp) => xx > rp - 14 && xx < rp + 3);

  // ---- items
  const items: Item[] = [];
  const it = (kind: Item["kind"], xx: number, y: number, value = 0, power: PowerId | null = null) =>
    items.push({ kind, x: xx, y, value, power, taken: false, phase: r() * 6.28 });
  const ground = (xx: number) => terrain.heightAt(xx);
  // fuel
  const fuelGap = (200 + 140 * d) * (plan.twist === "turbo" ? 0.85 : 1);
  for (let fx = fuelGap * 0.7; fx < L - 40; fx += fuelGap * range(r, 0.9, 1.1)) {
    let px = fx;
    for (let k = 0; k < 12 && (inGap(px, 4) || nearRamp(px)); k++) px += 6;
    it("fuel", px, ground(px) + 0.9);
  }
  for (const c of checkpoints) it("fuel", c + 22, ground(c + 22) + 0.9);
  // coins: lines along the ground, arcs over every jump
  const coinGap = plan.twist === "coins" ? 0.55 : 1;
  for (const rp of ramps) {
    const v = 12 + 4 * d, ang = 0.42;
    const vx = v * Math.cos(ang), vy = v * Math.sin(ang), g = worldOf(plan.world).gravity * (plan.twist === "lowgrav" ? 0.55 : 1);
    const y0 = ground(rp) + 1.2;
    for (let k = 1; k <= 9; k++) {
      const t = k * 0.13;
      const cx = rp + vx * t, cy = y0 + vy * t - 0.5 * g * t * t;
      if (cy < ground(cx) + 0.8) break;
      it("coin", cx, cy, k === 5 ? 25 : 5);
    }
  }
  for (let cx = 22; cx < L - 25; cx += range(r, 26, 58) * coinGap) {
    if (inGap(cx, 3) || nearRamp(cx)) continue;
    const count = 4 + Math.floor(r() * 5);
    const gold = chance(r, 0.18 + 0.2 * d);
    for (let k = 0; k < count; k++) {
      const px = cx + k * 1.55;
      if (inGap(px, 1)) break;
      it("coin", px, ground(px) + 1.25, gold && k === Math.floor(count / 2) ? 25 : 5);
    }
    cx += count * 1.55;
  }
  // one or two gems in daring places: high over a jump, or on top of a big climb
  const gemAt = spots.filter((s) => s.f === "steep" || s.f === "pit");
  for (let k = 0; k < Math.min(2, gemAt.length); k++) {
    const s = gemAt[Math.floor(r() * gemAt.length)];
    const gx = s.f === "pit" ? s.x + s.len * 0.45 : s.x + s.len * 0.8;
    it("coin", gx, Math.max(ground(gx), ground(gx - 6)) + (s.f === "pit" ? 4.5 : 2.2), 100);
  }
  // hearts
  if (plan.n % 7 === 0 || plan.summit || chance(r, 0.1)) {
    const hx = L * range(r, 0.4, 0.75);
    let px = hx;
    for (let k = 0; k < 12 && inGap(px, 4); k++) px += 7;
    it("heart", px, ground(px) + 2.6);
  }
  // power-ups, placed where they help
  const nPow = 1 + (d > 0.35 ? 1 : 0) + (plan.summit ? 1 : 0) + (plan.twist === "turbo" ? 3 : 0);
  const usable = spots.filter((s) => s.f !== "rest");
  for (let k = 0; k < nPow && usable.length; k++) {
    const s = usable[Math.floor(r() * usable.length)];
    const power: PowerId = plan.twist === "turbo" && k > 0 ? "turbo"
      : s.f === "steep" ? (chance(r, 0.7) ? "turbo" : "double")
        : s.f === "pit" || s.f === "ramp" ? (chance(r, 0.6) ? "feather" : "shield")
          : s.f === "steps" || s.f === "rocks" ? (chance(r, 0.65) ? "shield" : "magnet")
            : pick(r, ["magnet", "double", "turbo", "shield", "feather"] as PowerId[]);
    let px = s.x - 22;
    for (let q = 0; q < 8 && (inGap(px, 4) || nearRamp(px) || px < 30); q++) px += 5;
    it("power", px, ground(px) + 1.4, 0, power);
  }

  // ---- props
  const props: PropSpot[] = [];
  const kinds: [PropKind, number][] = [...world.props, ...(partner ? partner.props.map(([k, w]) => [k, w * plan.blendAmt * 1.6] as [PropKind, number]) : [])];
  const kTotal = kinds.reduce((s, [, w]) => s + w, 0);
  const kind = () => { let v = r() * kTotal; for (const [k, w] of kinds) { v -= w; if (v <= 0) return k; } return kinds[0][0]; };
  for (let px = x0 + 4; px < end - 6; px += range(r, 2.6, 9)) {
    if (inGap(px, 2.5) || Math.abs(terrain.slopeAt(px)) > 0.42 || nearCp(px, 4) || Math.abs(px - L) < 5 || Math.abs(px) < 3) continue;
    const back = chance(r, 0.45);
    props.push({ kind: kind(), x: px, y: ground(px), s: range(r, 0.8, 1.2) * (back ? 0.78 : 1), flip: chance(r, 0.5), back, seed: Math.floor(r() * 1e9) });
  }
  // a landmark or two, standing back on level ground
  const marks = [...world.landmarks, ...(partner && plan.blendAmt > 0.3 ? partner.landmarks : [])];
  for (let k = 0; k < (L > 1100 ? 2 : 1) && marks.length; k++) {
    let px = L * range(r, 0.15 + k * 0.45, 0.4 + k * 0.45);
    for (let q = 0; q < 20 && (inGap(px, 8) || Math.abs(terrain.slopeAt(px)) > 0.2); q++) px += 9;
    props.push({ kind: marks[k % marks.length], x: px, y: ground(px), s: 1, flip: chance(r, 0.5), back: true, seed: Math.floor(r() * 1e9) });
  }
  props.sort((a, b) => a.x - b.x);
  items.sort((a, b) => a.x - b.x);

  return { plan, world, partner, terrain, fill, pits, bridges, ramps, checkpoints, finish: L, items, props };
}

/** a world for screens that only need a look (menus): a short calm track */
export function previewTrack(worldIndex: number) {
  return buildTrack({ ...stagePlan(worldIndex * 50 + 2), difficulty: 0.15, length: 420 });
}
export const WORLD_COUNT = WORLDS.length;
