// Builds a Wake Racers course from a stage plan: a winding water lane from the start grid to the finish (a smooth,
// seeded centre line that never doubles back on itself), the land around it as a height field worked out from the
// distance to the lane (so bends never fold the banks), the set pieces (ramps and jump chains, rapids, waterfalls,
// islands that split the lane, bridges on pillars, rock arches, tunnels, whirlpools, sliding lock gates, boost pads,
// buoy slaloms, narrows, open bays, log jams, minefields, rock gardens, crossing ferries), the pickups (coins, hearts,
// oil cans, power boxes), the checkpoints, the scenery near the water and the landmarks on the horizon.
// Pure data and maths: the renderer, the physics, the rivals and the QA bot in Node all read the same course.
import { clamp, fbm, lerp, makeRng, pick, range, ridge, smoothstep, vnoise, weighted } from "./util";
import { worldOf, type FarKind, type Feature, type Hazard, type Mood, type PropKind, type World } from "./worlds";
import type { StagePlan } from "./stages";

/** centre line sample spacing (m) */
export const DS = 2;
/** course drawn before the start line and after the finish (m) */
export const PRE = 180;
export const POST = 360;
/** land is modelled this far from the water's edge (m); beyond it a coarse far ring */
export const CORRIDOR = 210;

export type ItemKind = "coin" | "heart" | "fuel" | "box";
export interface Item { kind: ItemKind; s: number; d: number; h: number; x: number; y: number; z: number; taken: boolean; id: number }

export type Motion = "none" | "sway" | "cross" | "cruise" | "drift";
export interface Obstacle {
  id: number;
  kind: Hazard | "pillar" | "prop" | "gate" | "ferry" | "traffic" | "seastack" | "moored";
  /** rest place on the course */
  s0: number; d0: number;
  /** current place (moving ones are updated by the race) */
  s: number; d: number; x: number; z: number; y: number;
  /** circle radius, or a capsule: half length along an axis at `ang` to the course direction */
  r: number; hl: number; ang: number;
  /** height above the water (jump over anything lower than your hull) */
  h: number;
  damage: boolean; explode: boolean;
  /** knocked flying (soft things): where it's heading, for the art */
  knockX?: number; knockZ?: number;
  motion: Motion; amp: number; period: number; phase: number; speed: number;
  alive: boolean;
  /** scale for the art */
  size: number;
}

export interface Ramp { s: number; d: number; w: number; len: number; h: number; x: number; z: number; ang: number; kind: "wood" | "metal" | "rock" | "neon" }
export interface Pad { s: number; d: number; w: number; len: number; x: number; z: number; ang: number }
export interface Whirl { s: number; d: number; r: number; x: number; z: number; y: number }
export interface Zone { s0: number; s1: number; k: number }
export interface Fall { s: number; drop: number; x: number; z: number; ang: number; w: number; top: number }
export interface Island { s0: number; s1: number; d: number; w: number; h: number }
export interface Bridge { s: number; x: number; z: number; ang: number; w: number; deck: number; pillars: number[]; style: number }
export interface Cover { s0: number; s1: number; kind: "arch" | "tunnel" }
export interface Dock { s: number; d: number; w: number; len: number; x: number; z: number; ang: number }
export interface PropInst { k: PropKind; x: number; y: number; z: number; rot: number; scale: number; v: number }
export interface FarInst { k: FarKind; x: number; z: number; y: number; scale: number; rot: number }

export interface Course {
  plan: StagePlan;
  world: World;
  /** remix partner (props, sky and weather mix in) */
  partner: World | null;
  mood: Mood;
  /** samples: index i ↔ s = i·DS − PRE */
  count: number;
  px: Float32Array; pz: Float32Array; tx: Float32Array; tz: Float32Array;
  hw: Float32Array; wl: Float32Array; curv: Float32Array;
  /** the line a good driver takes (lateral offset, m) and a safe pace along it (m/s) */
  line: Float32Array; pace: Float32Array;
  length: number;
  baseWater: number;
  obstacles: Obstacle[];
  ramps: Ramp[]; pads: Pad[]; whirls: Whirl[]; rapids: Zone[]; falls: Fall[]; islands: Island[];
  bridges: Bridge[]; covers: Cover[]; dock: Dock | null;
  items: Item[];
  checkpoints: number[];
  /** hazards sorted by s0 (obstS mirrors their s0), and the ones that cruise the whole course */
  obstS: Float32Array; roam: number[];
  /** pickups sorted by s (itemS mirrors it), ramps sorted by s */
  itemS: Float32Array; rampS: Float32Array;
  /** the lane has built walls (quays) instead of banks */
  walls: boolean;
  bounds: { x0: number; x1: number; z0: number; z1: number };
  seed: number;
}

// ------------------------------------------------------------------ sampling helpers
export const idxOf = (c: Course, s: number) => clamp((s + PRE) / DS, 0, c.count - 1.001);
/** world position of (s, d): writes into out[0..1] (x, z) */
export function place(c: Course, s: number, d: number, out: { x: number; z: number }) {
  const f = idxOf(c, s), i = Math.floor(f), u = f - i;
  const tx = lerp(c.tx[i], c.tx[i + 1], u), tz = lerp(c.tz[i], c.tz[i + 1], u);
  const L = Math.hypot(tx, tz) || 1;
  // right of the direction of travel = (−tz, tx)
  out.x = lerp(c.px[i], c.px[i + 1], u) - (tz / L) * d;
  out.z = lerp(c.pz[i], c.pz[i + 1], u) + (tx / L) * d;
  return out;
}
export const headingAt = (c: Course, s: number) => { const i = Math.round(idxOf(c, s)); return Math.atan2(c.tx[i], c.tz[i]); };
export const waterAt = (c: Course, s: number) => c.wl[Math.round(idxOf(c, s))];
export const halfWidthAt = (c: Course, s: number) => { const f = idxOf(c, s), i = Math.floor(f); return lerp(c.hw[i], c.hw[i + 1], f - i); };

/** nearest course sample to a point, searched near a known index; returns the index (fractional) and signed offset */
export function locate(c: Course, x: number, z: number, hint: number, out: { i: number; s: number; d: number }) {
  let best = clamp(Math.round(hint), 0, c.count - 1), bd = 1e18;
  const a = Math.max(0, best - 12), b = Math.min(c.count - 1, best + 12);
  for (let i = a; i <= b; i++) { const dx = x - c.px[i], dz = z - c.pz[i], q = dx * dx + dz * dz; if (q < bd) { bd = q; best = i; } }
  // walk further if the best is on the edge of the window (a fast boat or a respawn)
  for (let guard = 0; guard < 400 && (best === a || best === b) && best > 0 && best < c.count - 1; guard++) {
    const n = best === a ? best - 1 : best + 1, dx = x - c.px[n], dz = z - c.pz[n], q = dx * dx + dz * dz;
    if (q < bd) { bd = q; best = n; } else break;
  }
  // project onto the segment for a smooth s
  const i = best, tx = c.tx[i], tz = c.tz[i];
  const dx = x - c.px[i], dz = z - c.pz[i];
  const along = clamp(dx * tx + dz * tz, -DS, DS);
  out.i = clamp(i + along / DS, 0, c.count - 1);
  out.s = out.i * DS - PRE;
  out.d = -dx * tz + dz * tx;
  return out;
}

// ------------------------------------------------------------------ the land: nearest lane sample from anywhere
/** first index whose value is >= v in an ascending array */
export function lowerBound(a: Float32Array, v: number) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

export interface LandQuery { i: number; d: number; e: number; dist: number; wl: number; s: number }
export class Land {
  private profile: (q: LandQuery, x: number, z: number) => number;
  readonly H: number;
  private seed: number;
  constructor(readonly c: Course) {
    this.H = c.world.height;
    this.seed = c.seed % 997;
    this.profile = profileFor(c.world, this.seed);
  }
  /** where a point is relative to the lane. The course never turns back (its heading stays within ±70° of +z), so
   * z grows along it: start from the samples level with the point and search a window around them. */
  query(x: number, z: number, out: LandQuery): LandQuery {
    const c = this.c;
    const iz = lowerBound(c.pz, z);
    let best = -1, bd = 1e18;
    const scan = (from: number, to: number, step: number) => {
      for (let i = Math.max(0, from); i <= Math.min(c.count - 1, to); i += step) {
        const dx = x - c.px[i], dz = z - c.pz[i], q = dx * dx + dz * dz;
        if (q < bd) { bd = q; best = i; }
      }
    };
    scan(iz - 420, iz + 420, 6);
    if (bd > (CORRIDOR + 90) ** 2) scan(iz - 2600, iz + 2600, 30);
    const k = bd > (CORRIDOR + 90) ** 2 ? 30 : 6;
    const b0 = best;
    scan(b0 - k, b0 + k, 1);
    const dx = x - c.px[best], dz = z - c.pz[best];
    out.i = best; out.s = best * DS - PRE;
    out.d = -dx * c.tz[best] + dz * c.tx[best];
    out.dist = Math.sqrt(bd);
    out.e = out.dist - c.hw[best];
    out.wl = c.wl[best];
    return out;
  }
  private q: LandQuery = { i: 0, d: 0, e: 0, dist: 0, wl: 0, s: 0 };
  /** land height at a point (absolute y) */
  heightAt(x: number, z: number) { return this.heightQ(this.query(x, z, this.q), x, z); }
  /** land height from a query already made for this point */
  heightQ(q: LandQuery, x: number, z: number) {
    let h = this.profile(q, x, z);
    // islands that split the lane
    for (const is of this.c.islands) {
      if (q.s < is.s0 - 4 || q.s > is.s1 + 4) continue;
      const u = (q.s - is.s0) / (is.s1 - is.s0);
      const half = is.w * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(u, 0, 1))), 0.6);
      const k = half - Math.abs(q.d - is.d);
      if (k > -3) h = Math.max(h, -1.6 + Math.min(is.h, k * 0.55 + (k > 0 ? 0.6 : 0)) + (k > 3 ? 1.2 * vnoise(x * 0.2, z * 0.2, this.seed) : 0));
    }
    return q.wl + h;
  }
  /** a rough slope (for colours): height difference over 2 m */
  slopeAt(x: number, z: number, h: number) {
    const a = this.heightAt(x + 2, z) - h, b = this.heightAt(x, z + 2) - h;
    return Math.sqrt(a * a + b * b) / 2;
  }
}

/** how the land rises from the water's edge, world by world (height above the local water level) */
function profileFor(w: World, seed: number): (q: LandQuery, x: number, z: number) => number {
  const H = w.height;
  const n1 = (x: number, z: number) => fbm(x * 0.011, z * 0.011, 3, seed);
  const n2 = (x: number, z: number) => fbm(x * 0.045, z * 0.045, 2, seed + 5);
  const r1 = (x: number, z: number) => ridge(x * 0.009, z * 0.009, 3, seed + 9);
  const bed = (e: number, deep: number) => Math.max(-deep, -1.3 + e * 0.4);
  switch (w.profile) {
    case "beach": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 5.5);
      const sea = -4.2 + 1.6 * n2(x, z);
      // sandy banks come and go along each side
      const bankOn = vnoise(q.s * 0.004 + (q.d > 0 ? 40 : 0), 3, seed) > 0.5;
      const bank = bankOn ? Math.min(-1 + q.e * 0.17, 1.1 + 5 * n2(x, z) * smoothstep(14, 40, q.e)) : -99;
      const isl = smoothstep(0.55, 0.72, n1(x, z)) * smoothstep(12, 45, q.e);
      const island = isl > 0 ? -4 + isl * (7 + 9 * n2(x, z)) : -99;
      return Math.max(sea, bank, island);
    };
    case "cliffs": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 4.5);
      const ledge = q.e < 3 ? lerp(-0.6, 1.2, q.e / 3) : 1.2;
      const wall = H * (0.5 + 0.65 * r1(x, z)) * smoothstep(2.5, 10 + 9 * n2(x, z), q.e);
      return ledge + wall + 4 * n2(x, z) * smoothstep(12, 30, q.e);
    };
    case "quay": case "canal": case "neon": return (q, x, z) => {
      if (q.e < -0.2) return bed(q.e, 5);
      return 2.35 + (q.e > 40 ? 0.6 * n2(x, z) * smoothstep(40, 90, q.e) : 0);
    };
    case "mountains": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 8);
      const shore = q.e < 4 ? lerp(-0.5, 2.4, q.e / 4) : 2.4;
      return shore + H * (0.3 + 0.95 * r1(x, z)) * smoothstep(3, 46 + 34 * n2(x, z), q.e) + 3 * n2(x, z);
    };
    case "banks": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 3.5);
      const shore = q.e < 3 ? lerp(-0.4, 1, q.e / 3) : 1;
      return shore + H * (0.25 + 0.75 * n1(x, z)) * smoothstep(4, 42, q.e) + 1.8 * n2(x, z) * smoothstep(3, 10, q.e);
    };
    case "hills": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 3.2);
      const shore = q.e < 2.5 ? lerp(-0.3, 0.8, q.e / 2.5) : 0.8;
      return shore + H * (0.18 + 0.82 * n1(x, z)) * smoothstep(4, 64, q.e) + 1.2 * n2(x, z) * smoothstep(3, 12, q.e);
    };
    case "lava": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 4);
      const shore = q.e < 3 ? lerp(-0.5, 1.4, q.e / 3) : 1.4;
      return shore + H * (0.22 + 0.85 * r1(x, z)) * smoothstep(3, 32, q.e) + 3 * n2(x, z) * smoothstep(3, 9, q.e);
    };
    case "coast": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 5);
      if (q.d > 0) return -5.5 + 1.5 * n2(x, z) + Math.max(0, smoothstep(0.62, 0.76, n1(x, z)) * 14 - 3) * smoothstep(20, 50, q.e);
      const ledge = q.e < 3 ? lerp(-0.6, 1.4, q.e / 3) : 1.4;
      return ledge + H * (0.55 + 0.6 * r1(x, z)) * smoothstep(2.5, 12 + 10 * n2(x, z), q.e);
    };
    case "cave": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 4);
      const ledge = q.e < 2 ? lerp(-0.4, 1, q.e / 2) : 1;
      return ledge + H * (0.75 + 0.45 * r1(x, z)) * smoothstep(1.8, 12 + 6 * n2(x, z), q.e);
    };
    case "dunes": return (q, x, z) => {
      if (q.e < 0) return bed(q.e, 3.4);
      const shore = q.e < 3 ? lerp(-0.4, 0.8, q.e / 3) : 0.8;
      return shore + H * (0.2 + 0.8 * ridge(x * 0.011, z * 0.006, 2, seed + 3)) * smoothstep(4, 44, q.e);
    };
  }
}

// ------------------------------------------------------------------ building
interface Seg { L: number; turn: number; wmul: number; feature: Feature | "start" | "finish" | "lead"; drop: number }

const ROOM: Partial<Record<Feature, [number, number]>> = {
  ramp: [70, 90], jumps: [170, 220], rapids: [130, 190], waterfall: [120, 140], island: [170, 230], bridge: [50, 60],
  arch: [60, 90], whirlpool: [90, 110], gates: [80, 100], boost: [80, 110], slalom: [130, 170], narrows: [100, 150],
  bay: [150, 190], logjam: [90, 110], minefield: [120, 160], rocks: [120, 160], ferry: [80, 100], pillars: [90, 120], tunnel: [100, 160],
};
/** set pieces that need a straight run (no bend across them) */
const STRAIGHT = new Set<Feature>(["ramp", "jumps", "waterfall", "bridge", "gates", "ferry", "pillars", "boost"]);

export function buildCourse(plan: StagePlan): Course {
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const moodWorld = partner && plan.seed % 2 === 0 ? partner : world;
  const mood = moodWorld.moods[plan.mood % moodWorld.moods.length];
  const r = makeRng(plan.seed ^ 0x5bd1e995);
  const d = plan.d;
  const [w0, w1] = world.width;
  // lanes get narrower as stages get harder
  const baseHw = lerp(w1, w0, clamp(d * 0.9 + r() * 0.15, 0, 1)) / 2;

  // ---- the plan of the lane: start straight, a lead-in bend before every set piece, the run to the finish
  const segs: Seg[] = [{ L: PRE + 70, turn: 0, wmul: 1, feature: "start", drop: 0 }];
  let theta = 0;
  const maxTheta = 1.2;
  const turnFor = (L: number, sharp: number) => {
    // a bend that keeps the lane heading roughly forward (never back on itself)
    const minR = Math.max(42, baseHw * 2.4);
    const maxTurn = Math.min(L / minR, 0.35 + sharp * 1.05);
    let t = range(r, 0.25, 1) * maxTurn * (r() < 0.5 ? -1 : 1);
    if (Math.abs(theta + t) > maxTheta) t = -t;
    if (Math.abs(theta + t) > maxTheta) t = clamp(-theta * 0.8, -maxTurn, maxTurn);
    theta += t;
    return t;
  };
  for (const f of plan.features) {
    const leadL = range(r, 70, 150 - 40 * d);
    segs.push({ L: leadL, turn: turnFor(leadL, d), wmul: 1, feature: "lead", drop: 0 });
    // an S-bend now and then for rhythm
    if (r() < 0.35 + 0.3 * d) { const L2 = range(r, 60, 110); segs.push({ L: L2, turn: turnFor(L2, d), wmul: 1, feature: "lead", drop: 0 }); }
    const [a, b] = ROOM[f] ?? [80, 120];
    const L = range(r, a, b);
    const wmul = f === "island" ? 2.35 : f === "bay" ? 1.85 : f === "narrows" ? 0.62 : f === "tunnel" ? 0.85 : f === "minefield" || f === "rocks" ? 1.15 : 1;
    const turn = STRAIGHT.has(f) ? 0 : f === "island" || f === "bay" ? turnFor(L, 0.15) : turnFor(L, d * 0.6);
    const drop = f === "waterfall" ? range(r, 6, 9 + 8 * d) : 0;
    segs.push({ L, turn, wmul, feature: f, drop });
  }
  // stretch or squeeze the lead-ins so the race is the planned length
  const raceL = segs.reduce((t, s) => t + (s.feature === "start" ? 70 : s.L), 0);
  const leadTotal = segs.filter((s) => s.feature === "lead").reduce((t, s) => t + s.L, 0);
  const want = plan.length - 140;
  if (leadTotal > 0) {
    const k = clamp(1 + (want - raceL) / leadTotal, 0.6, 3);
    for (const s of segs) if (s.feature === "lead") { s.L *= k; s.turn = clamp(s.turn, -s.L / Math.max(42, baseHw * 2.4), s.L / Math.max(42, baseHw * 2.4)); }
  }
  // the course must never turn back on itself (its heading stays within ±1.2 rad of +z, so z only grows along it)
  { let th = 0; for (const sg of segs) { sg.turn = clamp(sg.turn, -maxTheta - th, maxTheta - th); th += sg.turn; } }
  segs.push({ L: 140 + POST, turn: 0, wmul: 1, feature: "finish", drop: 0 });

  // ---- integrate the centre line
  const total = segs.reduce((t, s) => t + s.L, 0);
  const count = Math.floor(total / DS) + 2;
  const px = new Float32Array(count), pz = new Float32Array(count), tx = new Float32Array(count), tz = new Float32Array(count);
  const hw = new Float32Array(count), wl = new Float32Array(count), curv = new Float32Array(count);
  const segAt: Int16Array = new Int16Array(count);
  const segStart: number[] = [];
  {
    let acc = 0;
    for (const s of segs) { segStart.push(acc); acc += s.L; }
  }
  let th = 0, x = 0, z = -PRE, k = 0;
  const wm = new Float32Array(count);
  // waterfalls drop the water level at their middle
  const drops = segs.map((sg, j) => (sg.drop > 0 ? { at: segStart[j] + sg.L * 0.5, h: sg.drop } : null)).filter((v): v is { at: number; h: number } => !!v);
  for (let i = 0; i < count; i++) {
    const s = i * DS; // from the start of the drawn course
    while (k < segs.length - 1 && s >= segStart[k] + segs[k].L) k++;
    const sg = segs[k], u = clamp((s - segStart[k]) / sg.L, 0, 1);
    const kap = (sg.turn / sg.L) * 2 * Math.sin(Math.PI * u) ** 2;
    segAt[i] = k;
    curv[i] = kap;
    px[i] = x; pz[i] = z; tx[i] = Math.sin(th); tz[i] = Math.cos(th);
    // width eases towards the set piece's width
    wm[i] = sg.wmul === 1 ? 1 : lerp(1, sg.wmul, smoothstep(0, 0.22, u) * smoothstep(1, 0.78, u));
    let water = 0;
    for (const dr of drops) if (s >= dr.at) water -= dr.h;
    wl[i] = water;
    th += kap * DS;
    x += Math.sin(th) * DS; z += Math.cos(th) * DS;
  }
  for (let i = 0; i < count; i++) hw[i] = baseHw * wm[i] * (1 + 0.08 * Math.sin(i * DS * 0.013 + plan.seed));
  // the race runs from the start line (s = 0) to the finish, 140 m into the last straight
  const length = segStart[segStart.length - 1] - PRE + 140;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minW = 1e9;
  for (let i = 0; i < count; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]); minW = Math.min(minW, wl[i]); }

  const c: Course = {
    plan, world, partner, mood, count, px, pz, tx, tz, hw, wl, curv,
    line: new Float32Array(count), pace: new Float32Array(count), length, baseWater: minW,
    obstacles: [], ramps: [], pads: [], whirls: [], rapids: [], falls: [], islands: [], bridges: [], covers: [], dock: null,
    items: [], checkpoints: [], obstS: new Float32Array(0), roam: [], itemS: new Float32Array(0), rampS: new Float32Array(0),
    walls: world.profile === "quay" || world.profile === "canal" || world.profile === "neon",
    bounds: { x0: minX, x1: maxX, z0: minZ, z1: maxZ }, seed: plan.seed,
  };

  // ---- set pieces
  const tmp = { x: 0, z: 0 };
  let oid = 0;
  const hazardOf = () => weighted(r, world.hazards.concat(partner ? partner.hazards.map(([h, w]) => [h, w * 0.6] as [Hazard, number]) : []));
  const obstacle = (kind: Obstacle["kind"], s: number, dd: number, o: Partial<Obstacle> = {}) => {
    // a still hazard must leave a clear way through (a gap of 7 m or more across the lane)
    if ((o.motion ?? "none") === "none" && kind !== "pillar" && kind !== "gate" && !leavesGap(c, s, dd, (o.r ?? 1.2) + (o.hl ?? 0) * Math.abs(Math.sin(o.ang ?? 0)))) return null;
    place(c, s, dd, tmp);
    const ob: Obstacle = {
      id: oid++, kind, s0: s, d0: dd, s, d: dd, x: tmp.x, z: tmp.z, y: waterAt(c, s), r: 1.2, hl: 0, ang: 0, h: 1.2,
      damage: true, explode: false, motion: "none", amp: 0, period: 4, phase: 0, speed: 0, alive: true, size: 1, ...o,
    };
    c.obstacles.push(ob);
    bucketAdd(ob);
    return ob;
  };
  const hazard = (s: number, dd: number, kind?: Hazard) => {
    const h = kind ?? hazardOf();
    const size = range(r, 0.8, 1.25);
    const base: Partial<Obstacle> = { size };
    switch (h) {
      case "rock": return obstacle("rock", s, dd, { ...base, r: 1.5 * size, h: 1.6 * size });
      case "lavarock": return obstacle("lavarock", s, dd, { ...base, r: 1.5 * size, h: 1.6 * size });
      case "iceberg": return obstacle("iceberg", s, dd, { ...base, r: 2 * size, h: 2.4 * size, motion: "drift", amp: 0.8, period: range(r, 8, 12), phase: r() * 6 });
      case "crystal": return obstacle("crystal", s, dd, { ...base, r: 1.3 * size, h: 2.6 * size });
      case "log": return obstacle("log", s, dd, { ...base, r: 0.55, hl: 3.2 * size, ang: Math.PI / 2 + range(r, -0.5, 0.5), h: 0.7, motion: "drift", amp: 2.5, period: range(r, 6, 10), phase: r() * 6 });
      case "mine": return obstacle("mine", s, dd, { ...base, r: 1, h: 1.2, explode: true, motion: "drift", amp: 0.6, period: 3.2, phase: r() * 6 });
      case "barrel": return obstacle("barrel", s, dd, { ...base, r: 0.8, h: 1, damage: false });
      case "crate": return obstacle("crate", s, dd, { ...base, r: 1, h: 1.3, damage: false });
      case "debris": return obstacle("debris", s, dd, { ...base, r: 0.7, hl: 2.2, ang: range(r, 0, 3), h: 0.7, motion: "drift", amp: 1.4, period: 5, phase: r() * 6 });
      case "drone": return obstacle("drone", s, dd, { ...base, r: 1.2, h: 2.2, motion: "sway", amp: range(r, 3, 7), period: range(r, 2.6, 4.2), phase: r() * 6 });
      case "buoy": return obstacle("buoy", s, dd, { ...base, r: 0.75, h: 1.4, damage: false });
    }
  };
  const item = (kind: ItemKind, s: number, dd: number, h = 1.1) => {
    place(c, s, dd, tmp);
    c.items.push({ kind, s, d: dd, h, x: tmp.x, y: waterAt(c, s) + h, z: tmp.z, taken: false, id: c.items.length });
  };
  const coinLine = (s0: number, s1: number, dd0: number, dd1: number, h = 1.1, n?: number) => {
    const cnt = n ?? Math.max(3, Math.round((s1 - s0) / 6));
    for (let j = 0; j < cnt; j++) { const u = cnt === 1 ? 0.5 : j / (cnt - 1); item("coin", lerp(s0, s1, u), lerp(dd0, dd1, smoothstep(0, 1, u)), h); }
  };
  const hwAt = (s: number) => halfWidthAt(c, s);
  const lane = (s: number, f = 0.7) => range(r, -hwAt(s) * f, hwAt(s) * f);

  for (let k2 = 0; k2 < segs.length; k2++) {
    const sg = segs[k2];
    if (sg.feature === "start" || sg.feature === "finish") continue;
    const s0 = segStart[k2] - PRE, s1 = s0 + sg.L, sm = (s0 + s1) / 2;
    const f = sg.feature;
    if (f === "lead") {
      // lead-ins get a few hazards on harder stages and coins along the inside of the bend
      const n = Math.floor(sg.L / 70 * d * 1.4 + (r() < d * 0.8 ? 1 : 0));
      for (let j = 0; j < n; j++) hazard(range(r, s0 + 15, s1 - 15), lane(sm, 0.75));
      if (r() < 0.7) { const dd = -Math.sign(sg.turn || 1) * hwAt(sm) * 0.45; coinLine(s0 + sg.L * 0.25, s0 + sg.L * 0.7, dd, dd * 0.6); }
      continue;
    }
    switch (f) {
      case "ramp": case "jumps": {
        const n = f === "ramp" ? 1 : Math.round(range(r, 2, 3.4));
        const gap = (sg.L - 30) / n;
        for (let j = 0; j < n; j++) {
          const sr = s0 + 18 + j * gap, dd = f === "ramp" ? range(r, -0.35, 0.35) * hwAt(sr) : (j % 2 ? 1 : -1) * hwAt(sr) * range(r, 0, 0.3);
          const hgt = range(r, 2, 2.6 + 0.8 * d), len = 9;
          place(c, sr, dd, tmp);
          c.ramps.push({ s: sr, d: dd, w: range(r, 4.2, 5.6), len, h: hgt, x: tmp.x, z: tmp.z, ang: headingAt(c, sr), kind: world.profile === "neon" || world.profile === "quay" ? "metal" : world.profile === "cliffs" || world.profile === "lava" || world.profile === "cave" ? "rock" : "wood" });
          // a coin arc over the landing, a power box on the far side now and then
          for (let q = 0; q < 7; q++) item("coin", sr + len + 6 + q * 3.6, dd, 2.2 + Math.sin((q / 6) * Math.PI) * (hgt + 1.8));
          if (j === n - 1 && r() < 0.5) item("box", sr + len + 34, dd);
        }
        if (f === "jumps" && d > 0.45) hazard(s0 + 18 + gap * 0.5 + 9, -Math.sign(c.ramps[c.ramps.length - 1].d || 1) * hwAt(sm) * 0.5);
        break;
      }
      case "rapids": {
        c.rapids.push({ s0: s0 + 10, s1: s1 - 10, k: 0.6 + 0.6 * d });
        const n = Math.round(sg.L / 26 * (0.5 + d));
        for (let j = 0; j < n; j++) hazard(range(r, s0 + 14, s1 - 14), lane(sm, 0.9), r() < 0.7 ? "rock" : undefined);
        coinLine(s0 + 20, s1 - 20, lane(sm, 0.3), lane(sm, 0.3));
        break;
      }
      case "waterfall": {
        const sw = s0 + sg.L * 0.5;
        place(c, sw, 0, tmp);
        c.falls.push({ s: sw, drop: sg.drop, x: tmp.x, z: tmp.z, ang: headingAt(c, sw), w: hwAt(sw), top: waterAt(c, sw - 6) });
        c.rapids.push({ s0: sw - 40, s1: sw - 2, k: 0.5 });
        for (let q = 0; q < 8; q++) item("coin", sw + 4 + q * 4, lane(sw, 0.05), 1.5 + Math.sin((q / 7) * Math.PI) * 2 + (8 - q) * sg.drop / 9);
        if (r() < 0.6) item("heart", sw + 46, lane(sw, 0.5));
        break;
      }
      case "island": {
        const isW = hwAt(sm) * 0.52, isd = range(r, -0.1, 0.1) * hwAt(sm);
        c.islands.push({ s0: s0 + 18, s1: s1 - 18, d: isd, w: isW, h: range(r, 2.8, 6.5) });
        // the long way round has the treasure
        const side = r() < 0.5 ? -1 : 1, off = isd + side * (isW + (hwAt(sm) - isW) * 0.5);
        coinLine(s0 + 40, s1 - 40, off, off, 1.1, 10);
        item(r() < 0.5 ? "box" : "fuel", sm, off);
        if (d > 0.3) hazard(sm + range(r, -20, 20), isd - side * (isW + (hwAt(sm) - isW) * 0.5), "rock");
        break;
      }
      case "bridge": {
        place(c, sm, 0, tmp);
        const w = hwAt(sm), n = Math.max(1, Math.round(w * 2 / 13) - 1), pillars: number[] = [];
        for (let j = 1; j <= n; j++) pillars.push(-w + (2 * w * j) / (n + 1) + range(r, -1, 1));
        c.bridges.push({ s: sm, x: tmp.x, z: tmp.z, ang: headingAt(c, sm), w: w + 6, deck: range(r, 7, 11), pillars, style: Math.floor(r() * 3) });
        for (const p of pillars) obstacle("pillar", sm, p, { r: 1.4, h: 30, damage: true, size: 1 });
        const gapD = pillars.length ? (pillars[0] - w) / 2 : 0;
        coinLine(sm - 20, sm + 20, gapD, gapD, 1.1, 7);
        break;
      }
      case "arch": case "tunnel": {
        c.covers.push({ s0: f === "arch" ? sm - 8 : s0 + 10, s1: f === "arch" ? sm + 8 : s1 - 10, kind: f });
        if (f === "tunnel") { coinLine(s0 + 20, s1 - 20, lane(sm, 0.4), lane(sm, 0.4)); for (let j = 0; j < Math.round(d * 3); j++) hazard(range(r, s0 + 20, s1 - 20), lane(sm, 0.7)); }
        else coinLine(sm - 14, sm + 14, 0, 0, 1.1, 6);
        break;
      }
      case "whirlpool": {
        const dd = (r() < 0.5 ? -1 : 1) * hwAt(sm) * range(r, 0.15, 0.45);
        place(c, sm, dd, tmp);
        c.whirls.push({ s: sm, d: dd, r: range(r, 8, 10 + 4 * d), x: tmp.x, z: tmp.z, y: waterAt(c, sm) });
        coinLine(sm - 25, sm + 25, -dd * 1.2, -dd * 1.2, 1.1, 8);
        break;
      }
      case "gates": {
        // sliding lock gates: a wall across the lane with one gap that slides from side to side
        const n = d > 0.6 ? 2 : 1;
        for (let j = 0; j < n; j++) {
          const sg2 = s0 + 25 + j * 45, w = hwAt(sg2), period = range(r, 3.6, 5.6 - 1.4 * d), phase = r() * 6;
          const panel = w * 0.62;
          for (const side of [-1, 1]) obstacle("gate", sg2, side * (w - panel / 2 + 2), { r: 0.8, hl: panel / 2 + 1, ang: Math.PI / 2, h: 3.2, damage: false, motion: "sway", amp: w * 0.36, period, phase, size: panel });
        }
        break;
      }
      case "boost": {
        const n = Math.round(range(r, 2, 4));
        for (let j = 0; j < n; j++) {
          const sb = s0 + 15 + j * ((sg.L - 30) / Math.max(1, n - 1)), dd = (j % 2 ? 0.4 : -0.4) * hwAt(sb) * range(r, 0.3, 1);
          place(c, sb, dd, tmp);
          c.pads.push({ s: sb, d: dd, w: 3.4, len: 7, x: tmp.x, z: tmp.z, ang: headingAt(c, sb) });
          coinLine(sb + 9, sb + 20, dd, dd, 1.1, 3);
        }
        break;
      }
      case "slalom": {
        // a zig-zag of buoys: weave through at speed (coins show the way)
        const n = Math.round(sg.L / 20);
        for (let j = 0; j < n; j++) {
          const ss = s0 + 12 + j * 20, side = j % 2 ? 1 : -1, w = hwAt(ss);
          hazard(ss, side * w * 0.12, "buoy"); hazard(ss, side * w * 0.62, "buoy");
          item("coin", ss, -side * w * 0.42);
        }
        break;
      }
      case "narrows": {
        for (let j = 0; j < Math.round(d * 4); j++) hazard(range(r, s0 + 20, s1 - 20), lane(sm, 0.5), "rock");
        coinLine(s0 + 20, s1 - 20, 0, 0, 1.1);
        break;
      }
      case "bay": {
        for (let j = 0; j < Math.round(2 + d * 6); j++) hazard(range(r, s0 + 20, s1 - 20), lane(sm, 1.3));
        for (let j = 0; j < 3; j++) { const ss = range(r, s0 + 25, s1 - 25), dd = lane(ss, 1.2); coinLine(ss, ss + 18, dd, dd, 1.1, 5); }
        item("box", sm, lane(sm, 1));
        break;
      }
      case "logjam": {
        const rows = Math.round(2 + d * 2.5);
        for (let j = 0; j < rows; j++) { const ss = s0 + 15 + j * ((sg.L - 30) / rows); for (let q = 0; q < 2; q++) hazard(ss + q * 6, lane(ss, 0.8), "log"); }
        break;
      }
      case "minefield": {
        const n = Math.round(sg.L / 16 * (0.6 + d));
        for (let j = 0; j < n; j++) hazard(range(r, s0 + 12, s1 - 12), lane(sm, 0.95), "mine");
        item(r() < 0.5 ? "heart" : "box", sm, lane(sm, 0.4));
        break;
      }
      case "rocks": {
        const n = Math.round(sg.L / 18 * (0.6 + d));
        for (let j = 0; j < n; j++) hazard(range(r, s0 + 12, s1 - 12), lane(sm, 0.9), world.hazards[0][0] === "iceberg" ? "iceberg" : world.hazards[0][0] === "crystal" ? "crystal" : world.hazards[0][0] === "lavarock" ? "lavarock" : "rock");
        coinLine(s0 + 20, s1 - 20, lane(sm, 0.3), lane(sm, 0.3));
        break;
      }
      case "ferry": {
        // a big boat crossing the lane, back and forth
        const n = plan.mode === "traffic" || d > 0.55 ? 2 : 1;
        for (let j = 0; j < n; j++) {
          const ss = s0 + 25 + j * 40, w = hwAt(ss);
          obstacle("ferry", ss, 0, { r: 3.2, hl: 7, ang: Math.PI / 2, h: 6, damage: true, motion: "cross", amp: w + 12, period: range(r, 9, 13 - 3 * d), phase: r() * 6, size: 1 });
        }
        break;
      }
      case "pillars": {
        const rows = Math.max(2, Math.round(sg.L / 36));
        for (let j = 0; j < rows; j++) { const ss = s0 + 14 + j * 36, w = hwAt(ss), off = (j % 2) * 3; for (let p = -w + 6 + off; p < w - 4; p += 11) obstacle("pillar", ss, p, { r: 0.9, h: 6, damage: true, size: 0.7 }); }
        break;
      }
    }
  }
  // boats moored along the quays (canals, harbour): solid but harmless, at the lane's edges
  for (const rule of [...world.props, ...(partner && c.walls ? partner.props : [])]) {
    if (rule.k !== "moored" || rule.e[1] > 0) continue;
    for (let s = 60 + r() * rule.every; s < c.length - 40; s += rule.every * range(r, 0.7, 1.4)) {
      const side = r() < 0.5 ? -1 : 1, e = range(r, rule.e[0], rule.e[1]), sc = range(r, rule.scale[0], rule.scale[1]);
      obstacle("moored", s, side * (hwAt(s) + e), { r: 1.5 * sc, h: 3, damage: false, size: sc, ang: 0 });
    }
  }
  // traffic runs: slow boats cruising the lane both ways
  if (plan.mode === "traffic") {
    const n = Math.round(c.length / 170);
    for (let j = 0; j < n; j++) {
      const ss = range(r, 160, c.length - 120), dd = lane(ss, 0.7);
      obstacle("traffic", ss, dd, { r: 1.6, hl: 2.6, ang: 0, h: 2.4, damage: true, motion: "cruise", speed: (r() < 0.6 ? 1 : -1) * range(r, 6, 12), size: range(r, 0.8, 1.3) });
    }
  }
  // survival: hazards everywhere
  if (plan.mode === "survival") {
    const n = Math.round(c.length / 65 * (0.5 + d));
    for (let j = 0; j < n; j++) { const ss = range(r, 120, c.length - 60); hazard(ss, lane(ss, 0.9)); }
  }

  // ---- pickups along the whole race: oil cans by expected time, hearts, power boxes, coin trails
  const fuelEvery = clamp(560 + 260 * d, 560, 840) * (plan.twist === "lowfuel" ? 0.8 : 1);
  racingLine(c);
  for (let s = fuelEvery * 0.8; s < c.length - 120; s += fuelEvery * range(r, 0.9, 1.1)) {
    const i = Math.round((s + PRE) / DS), hw = halfWidthAt(c, s);
    item("fuel", s, clamp(c.line[Math.min(c.count - 1, i)] + range(r, -3, 3), -hw + 2.5, hw - 2.5));
  }
  const heartEvery = lerp(480, 720, d);
  for (let s = heartEvery * range(r, 0.6, 1); s < c.length - 80; s += heartEvery * range(r, 0.85, 1.2)) item("heart", s, lane(s, 0.8));
  // power boxes in a row across the lane, so everyone can take one
  for (let s = range(r, 160, 260); s < c.length - 120; s += range(r, 280, 420)) {
    const w = hwAt(s), n = w > 16 ? 4 : 3;
    for (let j = 0; j < n; j++) item("box", s, -w * 0.62 + (1.24 * w * j) / (n - 1));
  }
  // loose coin trails on open water
  for (let s = 80; s < c.length - 60; s += range(r, 60, 120)) { const a = lane(s, 0.7), b = lane(s + 30, 0.7); if (!nearItem(c, s, a, 8)) coinLine(s, s + 30, a, b, 1.1, 6); }
  // drop items that landed on an island, a pillar or a ramp
  c.items = c.items.filter((it) => !onIsland(c, it.s, it.d) && !bucketNear(it.s, 6).some((o) => o.motion === "none" && Math.abs(o.s0 - it.s) < o.r + 1.5 + o.hl && Math.abs(o.d0 - it.d) < o.r + 1.5 + o.hl));
  // keep hazards off islands and out of the start
  c.obstacles = c.obstacles.filter((o) => o.s0 > 60 && !onIsland(c, o.s0, o.d0));
  // sorted along the course, for quick windowed lookups (physics, rivals, pickups, the art)
  c.obstacles.sort((a, b) => a.s0 - b.s0);
  c.obstacles.forEach((o, i) => (o.id = i));
  c.obstS = Float32Array.from(c.obstacles, (o) => o.s0);
  c.roam = c.obstacles.filter((o) => o.motion === "cruise").map((o) => o.id);
  c.items.sort((a, b) => a.s - b.s);
  c.items.forEach((it, i) => (it.id = i));
  c.itemS = Float32Array.from(c.items, (it) => it.s);
  c.ramps.sort((a, b) => a.s - b.s);
  c.rampS = Float32Array.from(c.ramps, (rp) => rp.s);
  BUCKETS = null;

  // ---- checkpoints, the dock, the line and the pace
  if (plan.mode === "knockout") for (const f of [0.3, 0.5, 0.7, 0.86]) c.checkpoints.push(c.length * f);
  else { const ncp = Math.max(2, Math.round(c.length / 380)); for (let j = 1; j <= ncp; j++) c.checkpoints.push((c.length * j) / (ncp + 1)); }
  if (plan.mode === "dock") {
    const sd = c.length + 34, dd = (r() < 0.5 ? -1 : 1) * hwAt(sd) * 0.45;
    place(c, sd, dd, tmp);
    c.dock = { s: sd, d: dd, w: 4.4, len: 11, x: tmp.x, z: tmp.z, ang: headingAt(c, sd) };
  }
  racingLine(c);
  return c;
}

// buckets of hazards by 10 m of course, while a course is being built (the gap check looks only nearby)
let BUCKETS: Map<number, Obstacle[]> | null = null;
function bucketAdd(o: Obstacle) {
  if (!BUCKETS) BUCKETS = new Map();
  const k = Math.floor(o.s0 / 10);
  const l = BUCKETS.get(k);
  if (l) l.push(o); else BUCKETS.set(k, [o]);
}
const NEAR: Obstacle[] = [];
function bucketNear(s: number, R: number) {
  NEAR.length = 0;
  if (!BUCKETS) return NEAR;
  for (let k = Math.floor((s - R) / 10); k <= Math.floor((s + R) / 10); k++) { const l = BUCKETS.get(k); if (l) for (const o of l) NEAR.push(o); }
  return NEAR;
}

/** would a still hazard at (s, d) of half-width r still leave a 7 m gap across the lane? */
function leavesGap(c: Course, s: number, d: number, r: number, need = 7) {
  const hw = halfWidthAt(c, s) - 1.4;
  const lo: number[] = [d - r - 1.4], hi: number[] = [d + r + 1.4];
  for (const o of bucketNear(s, 10)) {
    if (o.motion !== "none" || Math.abs(o.s0 - s) > 9) continue;
    const e = o.r + o.hl * Math.abs(Math.sin(o.ang)) + 1.4;
    lo.push(o.d0 - e); hi.push(o.d0 + e);
  }
  for (const is of c.islands) if (s > is.s0 - 4 && s < is.s1 + 4) { const u = clamp((s - is.s0) / (is.s1 - is.s0), 0, 1), half = is.w * Math.pow(Math.sin(Math.PI * u), 0.6); lo.push(is.d - half - 1.4); hi.push(is.d + half + 1.4); }
  const idx = lo.map((_, i) => i).sort((a, b) => lo[a] - lo[b]);
  let edge = -hw, best = 0;
  for (const i of idx) { best = Math.max(best, Math.min(hw, lo[i]) - edge); edge = Math.max(edge, hi[i]); }
  best = Math.max(best, hw - edge);
  return best >= need;
}

function onIsland(c: Course, s: number, d: number) {
  for (const is of c.islands) {
    if (s < is.s0 || s > is.s1) continue;
    const u = (s - is.s0) / (is.s1 - is.s0), half = is.w * Math.pow(Math.sin(Math.PI * u), 0.6);
    if (Math.abs(d - is.d) < half + 2.5) return true;
  }
  return false;
}
function nearItem(c: Course, s: number, d: number, R: number) {
  // (items are made roughly in order along the course: look at the recent ones first)
  for (let k = c.items.length - 1, n = 0; k >= 0 && n < 400; k--, n++) { const it = c.items[k]; if (Math.abs(it.s - s) < R * 3 && Math.abs(it.d - d) < R) return true; }
  return false;
}

/** the line through the bends (inside of each bend, smoothed) and a pace a careful driver can hold along it */
function racingLine(c: Course) {
  const n = c.count, raw = new Float32Array(n), sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // average curvature over the next 30 m
    let k = 0;
    for (let j = 0; j < 15; j++) k += c.curv[Math.min(n - 1, i + j)];
    k /= 15;
    raw[i] = clamp(-Math.sign(k) * Math.min(1, Math.abs(k) * 55) * (c.hw[i] - 4), -c.hw[i] + 3.5, c.hw[i] - 3.5);
  }
  for (let i = 0; i < n; i++) { let a = 0, w = 0; for (let j = -12; j <= 12; j++) { const q = clamp(i + j, 0, n - 1), f = 13 - Math.abs(j); a += raw[q] * f; w += f; } sm[i] = a / w; }
  // around islands, take the wider side
  for (const is of c.islands) {
    const i0 = Math.max(0, Math.floor((is.s0 - 30 + PRE) / DS)), i1 = Math.min(n - 1, Math.ceil((is.s1 + 30 + PRE) / DS));
    for (let i = i0; i <= i1; i++) {
      const s = i * DS - PRE, u = clamp((s - is.s0) / (is.s1 - is.s0), 0, 1), half = is.w * Math.pow(Math.sin(Math.PI * u), 0.6);
      const side = is.d <= 0 ? 1 : -1;
      const want = is.d + side * (half + (c.hw[i] - half - Math.abs(is.d)) * 0.5 + 0.5);
      const f = smoothstep(is.s0 - 30, is.s0 + 5, s) * smoothstep(is.s1 + 30, is.s1 - 5, s);
      sm[i] = lerp(sm[i], want, f);
    }
  }
  c.line.set(sm);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let j = 0; j < 20; j++) k = Math.max(k, Math.abs(c.curv[Math.min(n - 1, i + j)]));
    c.pace[i] = clamp(Math.sqrt(9.5 / Math.max(1e-4, k)), 18, 60);
  }
}

/** the props near the water for the stretch [s0, s1) of the course (seeded by the stretch: always the same) */
export function propsFor(c: Course, land: Land, s0: number, s1: number, seg: number, density = 1): PropInst[] {
  const out: PropInst[] = [];
  const rules = c.world.props.map((p) => ({ p, w: 1 }));
  if (c.partner) for (const p of c.partner.props) if (!["house", "tower", "neontower", "crane", "containers", "lamp", "bridgeLights"].includes(p.k) || c.walls) rules.push({ p, w: 0.5 });
  const q: LandQuery = { i: 0, d: 0, e: 0, dist: 0, wl: 0, s: 0 };
  const tmp = { x: 0, z: 0 };
  const sA = Math.max(s0, -PRE + 20), sB = Math.min(s1, c.length + POST - 40);
  rules.forEach(({ p, w }, ri) => {
    // moorings inside the lane are hazards (made with the course); only the ones outside are scenery
    if (p.k === "moored" && p.e[1] <= 0) return;
    const r = makeRng((c.seed ^ Math.imul(seg + 7, 2654435761) ^ Math.imul(ri + 3, 40503)) >>> 0);
    for (const side of [-1, 1] as const) {
      if (p.side && p.side !== side) continue;
      for (let s = sA + r() * p.every / w; s < sB; s += (p.every / w / density) * range(r, 0.6, 1.4)) {
        const n = p.cluster ? 1 + Math.floor(r() * p.cluster) : 1;
        for (let j = 0; j < n; j++) {
          const ss = clamp(s + (j ? range(r, -6, 6) : 0), -PRE + 20, c.length + POST - 40);
          const e = range(r, p.e[0], p.e[1]) + (j ? range(r, -2, 2) : 0);
          place(c, ss, side * (halfWidthAt(c, ss) + e), tmp);
          // the point must really be that far from the lane (bends!)
          land.query(tmp.x, tmp.z, q);
          if (Math.abs(q.e - e) > 4 && e > 0) continue;
          // nothing stands inside the lane but lilies, reeds and the gates over it
          if (q.e < 0.5 && p.k !== "lily" && p.k !== "reeds" && p.k !== "gate" && p.k !== "bridgeLights") continue;
          if (onIsland(c, q.s, q.d)) continue;
          const y = land.heightQ(q, tmp.x, tmp.z);
          const wet = y < q.wl - 0.3;
          // land props need land; water props need water
          const waterProp = p.k === "lily" || p.k === "iceberg" || p.k === "seastack" || p.k === "wreck" || p.k === "moored";
          if (waterProp !== wet && p.k !== "reeds" && p.k !== "hut" && p.k !== "gate" && p.k !== "bridgeLights") continue;
          const scale = range(r, p.scale[0], p.scale[1]);
          const rot = p.k === "house" || p.k === "lamp" || p.k === "gate" || p.k === "stonelantern" || p.k === "bridgeLights" || p.k === "hut" || p.k === "moored" ? headingAt(c, ss) + (side < 0 ? Math.PI / 2 : -Math.PI / 2) : r() * Math.PI * 2;
          out.push({ k: p.k, x: tmp.x, y: waterProp || p.k === "hut" || p.k === "gate" ? q.wl : y, z: tmp.z, rot, scale, v: r() });
        }
      }
    }
  });
  return out;
}

/** landmarks on the horizon for the stretch [s0, s1) */
export function farFor(c: Course, land: Land, s0: number, s1: number, seg: number): FarInst[] {
  const out: FarInst[] = [];
  const kinds = c.partner ? [...c.world.far, ...c.partner.far.slice(0, 1)] : c.world.far;
  const r = makeRng((c.seed ^ Math.imul(seg + 11, 2246822519)) >>> 0);
  const tmp = { x: 0, z: 0 };
  const q: LandQuery = { i: 0, d: 0, e: 0, dist: 0, wl: 0, s: 0 };
  for (let s = s0 + r() * 60; s < s1; s += range(r, 70, 130)) {
    for (const side of [-1, 1]) {
      const k = pick(r, kinds);
      const dist = range(r, CORRIDOR + 160, CORRIDOR + 760);
      const ss = clamp(s, -PRE, c.length + POST - 2);
      place(c, ss, side * (halfWidthAt(c, ss) + dist), tmp);
      land.query(tmp.x, tmp.z, q);
      if (q.e < CORRIDOR + 60) continue;
      out.push({ k, x: tmp.x, z: tmp.z, y: c.baseWater + (k === "isles" ? -2 : 0), scale: range(r, 0.7, 1.5), rot: r() * Math.PI * 2 });
    }
  }
  // the big ones ahead of the finish, so the run home has a view
  if (s1 > c.length && s0 <= c.length + POST) {
    place(c, c.length + POST - 2, range(r, -200, 200), tmp);
    out.push({ k: kinds[0], x: tmp.x + c.tx[c.count - 1] * 500, z: tmp.z + c.tz[c.count - 1] * 500, y: c.baseWater, scale: 2.2, rot: r() * 6 });
  }
  return out;
}

/** where the lane crosses open water, a chain of little buoys marks its edges (for the stretch [s0, s1)) */
export function buoysFor(c: Course, land: Land, s0: number, s1: number) {
  const out: { x: number; z: number; y: number }[] = [];
  if (c.walls) return out;
  const tmp = { x: 0, z: 0 };
  for (let s = Math.max(4, Math.ceil(s0 / 7) * 7); s < Math.min(s1, c.length + 40); s += 7) {
    for (const side of [-1, 1]) {
      const hwv = halfWidthAt(c, s);
      if (onIsland(c, s, side * hwv)) continue;
      place(c, s, side * (hwv + 0.6), tmp);
      const y = land.heightAt(tmp.x, tmp.z), wl = waterAt(c, s);
      if (y < wl - 0.6) {
        place(c, s, side * (hwv + 3), tmp);
        if (land.heightAt(tmp.x, tmp.z) < wl - 0.4) { place(c, s, side * (hwv + 0.6), tmp); out.push({ x: tmp.x, z: tmp.z, y: wl }); }
      }
    }
  }
  return out;
}

/** where an obstacle is right now (moving ones follow their clock); writes o.s, o.d, o.x, o.z */
const tmpP = { x: 0, z: 0 };
export function moveObstacle(c: Course, o: Obstacle, t: number) {
  if (o.motion === "none") return;
  const w = (Math.PI * 2) / o.period;
  switch (o.motion) {
    case "sway": o.d = o.d0 + Math.sin(t * w + o.phase) * o.amp; break;
    case "drift": o.d = o.d0 + Math.sin(t * w + o.phase) * o.amp; o.s = o.s0 + Math.cos(t * w * 0.7 + o.phase) * o.amp * 0.4; break;
    case "cross": o.d = Math.sin(t * w + o.phase) * o.amp; break;
    case "cruise": {
      const span = c.length - 200;
      o.s = 120 + ((((o.s0 - 120 + o.speed * t) % span) + span) % span);
      break;
    }
  }
  place(c, o.s, o.d, tmpP);
  o.x = tmpP.x; o.z = tmpP.z; o.y = waterAt(c, o.s);
}

/** where a moving obstacle will be at time t (without moving it): writes out.s, out.d */
export function predict(c: Course, o: Obstacle, t: number, out: { s: number; d: number }) {
  out.s = o.s0; out.d = o.d0;
  if (o.motion === "none") return out;
  const w = (Math.PI * 2) / o.period;
  switch (o.motion) {
    case "sway": out.d = o.d0 + Math.sin(t * w + o.phase) * o.amp; break;
    case "drift": out.d = o.d0 + Math.sin(t * w + o.phase) * o.amp; out.s = o.s0 + Math.cos(t * w * 0.7 + o.phase) * o.amp * 0.4; break;
    case "cross": out.d = Math.sin(t * w + o.phase) * o.amp; break;
    case "cruise": { const span = c.length - 200; out.s = 120 + ((((o.s0 - 120 + o.speed * t) % span) + span) % span); out.d = o.d0; break; }
  }
  return out;
}

/** convenience for the QA tools: how much hazard there is */
export function hazardCount(c: Course) { return c.obstacles.filter((o) => o.damage).length; }
