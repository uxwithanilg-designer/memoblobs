// Tumble Truck's roads. A road is a height field (one height every half metre) built from layered noise plus designed
// features — bumpy whoops, sharp crests that throw a careless load, fallen logs, rock steps, boulders, rope bridges,
// kickers and gaps, steep climbs, valleys — and the surface zones: sticky mud, slippery ice, water fords and windy
// stretches. Checkpoints, the delivery yard at the end, coins, fuel cans, hearts, power-ups, the world's props and its
// animals are placed on it. Everything comes from the stage's seed, so a stage is the same for every player.
import { CARGO } from "./cargo";
import { stagePlan, type StagePlan } from "./stages";
import { WORLDS, worldOf, type AnimalKind, type PropKind, type RoadStyle, type World } from "./worlds";
import { chance, clamp, makeRng, noise1, pick, range, smooth, type Rng } from "./util";

export type PowerId = "nitro" | "net" | "bubble" | "magnet" | "double";
export const POWERS: { id: PowerId; label: string; secs: number }[] = [
  { id: "nitro", label: "Nitro", secs: 4 },
  { id: "net", label: "Cargo net", secs: 14 },
  { id: "bubble", label: "Bubble wrap", secs: 16 },
  { id: "magnet", label: "Magnet", secs: 12 },
  { id: "double", label: "Coins ×2", secs: 15 },
];
export type ItemKind = "coin" | "fuel" | "heart" | "power";
export interface Item { kind: ItemKind; x: number; y: number; value: number; power: PowerId | null; taken: boolean; phase: number }
export interface PropSpot { kind: PropKind; x: number; y: number; s: number; flip: boolean; back: boolean; seed: number }
export interface AnimalSpot { kind: AnimalKind; x: number; y: number; flip: boolean; seed: number; s: number }
export interface Span { x0: number; x1: number }
export interface Bridge extends Span { y0: number; y1: number; sag: number }
export interface Ford extends Span { level: number }
export interface Wind extends Span { s: number }
export interface Log { x: number; r: number; seed: number }
/** a warning sign by the road, a little before a hazard */
export type SignKind = "bump" | "jump" | "log" | "water" | "mud" | "ice" | "wind" | "bridge" | "rocks" | "holes" | "steep";
export interface Sign { x: number; kind: SignKind }

export const ZONE_NONE = 0, ZONE_MUD = 1, ZONE_ICE = 2;

export class Terrain {
  /** zone per sample (mud / ice) and water level per sample (−1e9 = dry) */
  zone: Uint8Array; water: Float32Array;
  constructor(public x0: number, public dx: number, public h: Float32Array) {
    this.zone = new Uint8Array(h.length);
    this.water = new Float32Array(h.length).fill(-1e9);
  }
  get x1() { return this.x0 + (this.h.length - 1) * this.dx; }
  private idx(x: number) { return clamp(Math.round((x - this.x0) / this.dx), 0, this.h.length - 1); }
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
  zoneAt(x: number) { return this.zone[this.idx(x)]; }
  gripAt(x: number) { const z = this.zone[this.idx(x)]; return z === ZONE_MUD ? 0.62 : z === ZONE_ICE ? 0.36 : 1; }
  waterAt(x: number) { return this.water[this.idx(x)]; }
  /** the closest point on the ground to (cx, cy) within reach r (see the physics) */
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

export interface Course {
  plan: StagePlan;
  world: World;
  partner: World | null;
  terrain: Terrain;
  /** the ground's top as drawn (the chasm under a bridge drops away) */
  fill: Float32Array;
  pits: Span[];
  bridges: Bridge[];
  fords: Ford[];
  muds: Span[];
  ices: Span[];
  winds: Wind[];
  logs: Log[];
  signs: Sign[];
  ramps: number[];
  crests: number[];
  checkpoints: number[];
  /** the delivery yard starts here (the finish line) */
  finish: number;
  items: Item[];
  props: PropSpot[];
  animals: AnimalSpot[];
  gravity: number;
}

function blendRoad(a: RoadStyle, b: RoadStyle | undefined, t: number): RoadStyle {
  if (!b) return a;
  const o = { ...a };
  for (const k of Object.keys(a) as (keyof RoadStyle)[]) o[k] = a[k] + (b[k] - a[k]) * t * 1.4;
  return o;
}

type Feature = "ramp" | "pit" | "bridge" | "steps" | "whoops" | "steep" | "valley" | "rocks" | "logs" | "mud" | "ford" | "ice" | "crest"
  | "humps" | "holes" | "table" | "rest";
/** what every road in a world has at least once (the third feature, and the sixth on longer roads) */
const SIGNATURE: Record<World["id"], [Feature, Feature]> = {
  pinewood: ["bridge", "logs"], orchard: ["ford", "crest"], bayou: ["ford", "mud"], honey: ["whoops", "crest"], henhill: ["mud", "ford"],
  redrock: ["bridge", "rocks"], glowcap: ["steps", "logs"], timber: ["steep", "logs"], frost: ["ice", "bridge"], blossom: ["steps", "ford"],
  ember: ["rocks", "bridge"], starfall: ["crest", "rocks"],
};

export function buildCourse(planOrN: StagePlan | number): Course {
  const plan = typeof planOrN === "number" ? stagePlan(planOrN) : planOrN;
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const st = blendRoad(world.road, partner?.road, plan.blendAmt);
  const r = makeRng(plan.seed);
  const d = plan.difficulty;
  const L = plan.length, x0 = -45, dx = 0.5, end = L + 90;
  const N = Math.ceil((end - x0) / dx) + 1;
  const H = new Float32Array(N);
  const edge = new Uint8Array(N);
  const X = (i: number) => x0 + i * dx;
  const I = (x: number) => clamp(Math.round((x - x0) / dx), 0, N - 1);

  // ---- base: four octaves of noise and the world's trend; flat at the start and in the yard
  const n1 = noise1(plan.seed + 1), n2 = noise1(plan.seed + 2), n3 = noise1(plan.seed + 3), n4 = noise1(plan.seed + 4);
  const big = st.amp * (5 + 11 * d), mid = st.amp * (2 + 5 * d), small = st.bump * (0.4 + 1.6 * d), tiny = st.bump * (0.05 + 0.2 * d);
  for (let i = 0; i < N; i++) {
    const x = X(i);
    const env = smooth(clamp((x - 10) / 60, 0, 1));
    H[i] = env * (big * n1(x / 150) + mid * n2(x / 55) + small * n3(x / 17) + tiny * n4(x / 5)) + st.trend * Math.max(0, x) * (0.6 + d);
  }

  // ---- checkpoints first (features keep clear of them)
  const checkpoints: number[] = [];
  const parts = Math.max(2, Math.ceil(L / 330));
  for (let k = 1; k < parts; k++) checkpoints.push(Math.round((L * k) / parts));
  const nearCp = (x: number, m: number) => checkpoints.some((c) => Math.abs(c - x) < m);

  // ---- features
  const pits: Span[] = [], bridges: Bridge[] = [], ramps: number[] = [], crests: number[] = [];
  const fordSpans: Span[] = [], muds: Span[] = [], ices: Span[] = [], logs: Log[] = [], signs: Sign[] = [];
  const sign = (xs: number, kind: SignKind) => { if (xs > 25 && !signs.some((q) => Math.abs(q.x - xs) < 12)) signs.push({ x: xs, kind }); };
  const spots: { f: Feature; x: number; len: number }[] = [];
  const W: [Feature, number][] = [
    ["ramp", st.ramps * (0.3 + d)],
    ["pit", d > 0.5 ? st.gaps * (d - 0.25) : 0],
    ["bridge", st.bridges * 0.6],
    ["steps", d > 0.38 ? st.steps * (0.3 + d) : 0],
    ["whoops", st.whoops * (0.6 + 0.6 * d)],
    ["steep", st.steep * (0.35 + d)],
    ["valley", st.valleys * (0.3 + d)],
    ["rocks", st.rocks * (0.2 + d)],
    ["logs", st.logs * (0.4 + d)],
    ["mud", st.mud * 0.9],
    ["ford", st.fords * 0.8],
    ["ice", st.ice * 0.9],
    ["crest", st.crests * (0.4 + d)],
    ["humps", st.crests * (0.25 + 0.8 * d)],
    ["holes", st.bump * (0.25 + 0.7 * d)],
    ["table", st.ramps * (0.2 + 0.9 * d)],
    ["rest", 0.4 * (1 - d) + 0.1],
  ];
  const total = W.reduce((s, [, w]) => s + w, 0);
  const choose = (rr: Rng): Feature => { let v = rr() * total; for (const [f, w] of W) { v -= w; if (v <= 0) return f; } return "rest"; };
  const add = (xa: number, xb: number, f: (t: number) => number) => { for (let i = I(xa); i <= I(xb); i++) H[i] += f(clamp((X(i) - xa) / (xb - xa), 0, 1)); };
  const shiftFrom = (xa: number, v: number, ease: number) => { for (let i = I(xa); i < N; i++) H[i] += v * smooth(clamp((X(i) - xa) / ease, 0, 1)); };
  const markEdge = (xa: number, xb: number) => { for (let i = I(xa); i <= I(xb); i++) edge[i] = 1; };
  /** the steepest bit of ground between xa and xb (an average hides the noise's short steep pitches) */
  const steepAt = (xa: number, xb: number) => { let m = 0; for (let i = I(xa); i < I(xb); i++) m = Math.max(m, Math.abs(H[i + 1] - H[i]) / dx); return m; };

  // a fragile load can't take the landing of a gap jump (its minimum speed is a hard landing): bridges instead
  // …nor can a rolling load, or anything in low gravity (it floats out of the bed in the air)
  const fragileLoad = plan.cargo.some((k) => { const b = CARGO[k].breaks; return (b > 0 && b < 8) || CARGO[k].shape === "ball"; }) || world.gravity * (plan.twist === "lowgrav" ? 0.6 : 1) < 8;
  let x = 70;
  let firstLog = true;
  while (x < L - 70) {
    let f = choose(r);
    let len = 0;
    if (nearCp(x, 40) || nearCp(x + 50, 40)) f = "rest";
    // every road has a crest and a log early on: the load has to be driven carefully from the first stage
    else if (spots.length === 0) f = "crest";
    else if (spots.length === 1 && firstLog && st.logs > 0) f = "logs";
    // the world's signature features come back again and again along a long road
    else if (spots.length % 6 === 2) f = SIGNATURE[world.id][0];
    else if (spots.length % 6 === 5) f = SIGNATURE[world.id][1];
    // …and a kicker: rolled over slowly it's harmless, hit at full speed the truck flies and the load spills
    else if (spots.length === 3) f = "ramp";
    // jumps, steps, boulders and logs only on gentle ground (built into a steep hill they make walls and spikes)
    if ((f === "steps" || f === "rocks" || f === "logs") && steepAt(x - 4, x + 30) > 0.24) f = "whoops";
    if (f === "pit" && fragileLoad) f = "bridge";
    if ((f === "ramp" || f === "pit" || f === "table") && steepAt(x - 10, x + 26) > 0.24) f = "crest";
    if (f === "holes" && steepAt(x - 4, x + 30) > 0.24) f = "whoops";
    if ((f === "mud" || f === "ice" || f === "ford") && steepAt(x - 5, x + 30) > 0.3) f = "valley";
    switch (f) {
      case "ramp": {
        len = 8 + 5 * d;
        const rise = Math.min(0.24 * len, (1.1 + 1.6 * d) * range(r, 0.85, 1.1));
        const y0 = H[I(x)];
        for (let i = I(x - 8); i < I(x); i++) { const u = smooth(clamp((X(i) - (x - 8)) / 8, 0, 1)); H[i] = H[i] * (1 - u) + y0 * u; }
        for (let i = I(x); i <= I(x + len); i++) H[i] = y0 + rise * Math.pow(clamp((X(i) - x) / len, 0, 1), 1.7);
        // the back is a slope, not a ledge: taken slowly the truck rolls down it with its load; taken fast, it flies
        const back = rise / 0.42;
        shiftFrom(x + len + dx, y0 - H[I(x + len + back)], 0.01);
        for (let i = I(x + len + dx); i <= I(x + len + back); i++) H[i] = y0 + rise * (1 - smooth(clamp((X(i) - x - len) / back, 0, 1)));
        markEdge(x + len - 0.5, x + len + back + 0.5);
        add(x + len + back + 2, x + len + back + 20, (t) => -rise * 0.25 * Math.sin(Math.PI * t));
        ramps.push(x + len);
        len += back + 20;
        break;
      }
      case "pit": {
        const y0 = H[I(x)];
        for (let i = I(x - 40); i < I(x); i++) { const u = smooth(clamp((X(i) - (x - 40)) / 30, 0, 1)); H[i] = H[i] * (1 - u) + (y0 + (x - X(i)) * 0.04) * u; }
        const rl = 10 + 3 * d, rise = Math.min(0.22 * rl, 1.3 + 1.2 * d);
        for (let i = I(x); i <= I(x + rl); i++) H[i] = y0 + rise * Math.pow(clamp((X(i) - x) / rl, 0, 1), 1.6);
        const lip = x + rl, w = (3 + 3.5 * d) * range(r, 0.85, 1.1);
        const top = y0 + rise;
        shiftFrom(lip + dx, top - rise * 0.55 - 0.7 - H[I(lip + w + 0.5)], 0.01);
        for (let i = I(lip + 0.3); i <= I(lip + w); i++) H[i] = top - 30;
        markEdge(lip - 0.5, lip + w + 1);
        pits.push({ x0: lip, x1: lip + w });
        ramps.push(lip);
        // a long soft landing
        add(lip + w + 1, lip + w + 20, (t) => -0.6 * Math.sin(Math.PI * t));
        len = rl + w + 22;
        break;
      }
      case "bridge": {
        const w = 12 + 14 * r() + 6 * d;
        const a = H[I(x)];
        const drop = range(r, -1, 1);
        const b = H[I(x + w)];
        shiftFrom(x + w, a + drop - b, 0.01);
        const sag = 0.3 + 0.5 * r();
        bridges.push({ x0: x, x1: x + w, y0: a, y1: a + drop, sag });
        for (let i = I(x); i <= I(x + w); i++) { const t = (X(i) - x) / w; H[i] = a + drop * t - sag * Math.sin(Math.PI * t); }
        markEdge(x - 1, x + w + 1);
        len = w + 16;
        break;
      }
      case "steps": {
        const count = 2 + Math.floor(3 * d * r() + 2 * d);
        const rise = 0.16 + 0.22 * d;
        let cx = x;
        const down = chance(r, 0.4);
        for (let k = 0; k < count; k++) {
          const run = range(r, 3.6, 6);
          shiftFrom(cx, down ? -rise : rise, 0.5);
          markEdge(cx - 0.3, cx + 0.8);
          cx += run;
        }
        if (!down) shiftFrom(cx + 4, -rise * count * 0.5, 22);
        len = cx - x + 24;
        break;
      }
      case "whoops": {
        len = range(r, 26, 50);
        const amp = 0.16 + 0.4 * d, lam = range(r, 3.8, 5.6);
        add(x, x + len, (t) => amp * (1 - Math.cos((2 * Math.PI * t * len) / lam)) * 0.5 * Math.sin(Math.PI * t));
        break;
      }
      case "crest": {
        // a hump that throws the truck (and its load) into the air when taken fast
        len = range(r, 12, 18) + 4 * d;
        const hgt = (0.8 + 1.5 * d) * range(r, 0.8, 1.15);
        add(x, x + len, (t) => hgt * Math.pow(Math.sin(Math.PI * t), 1.6));
        crests.push(x + len * 0.5);
        len += 14;
        break;
      }
      case "steep": {
        len = range(r, 50, 75);
        const rise = (4 + 8 * d) * range(r, 0.8, 1.1) * (chance(r, 0.3) ? -0.8 : 1);
        shiftFrom(x, rise, len * 0.75);
        break;
      }
      case "valley": {
        len = range(r, 36, 64);
        const depth = 4 + 7 * d;
        add(x, x + len, (t) => -depth * Math.pow(Math.sin(Math.PI * t), 1.4));
        break;
      }
      case "rocks": {
        const count = 1 + Math.floor(r() * (1 + 2 * d));
        let cx = x;
        for (let k = 0; k < count; k++) {
          const R = 0.55 + 0.5 * d * range(r, 0.7, 1.2), hb = R * 0.5;
          add(cx - R, cx + R, (t) => hb * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)));
          markEdge(cx - R, cx + R);
          cx += range(r, 4, 8);
        }
        len = cx - x + 6;
        break;
      }
      case "logs": {
        // fallen logs across the road: round humps with a log drawn on them
        const count = firstLog ? 1 : 1 + Math.floor(r() * (1 + 2.2 * d));
        firstLog = false;
        let cx = x;
        for (let k = 0; k < count; k++) {
          // the ground under a log is a rounded hump (the half-metre height field can't hold a log's round face:
          // a narrow one became a spike a wheel couldn't climb)
          const R = (0.17 + 0.1 * d) * range(r, 0.85, 1.15);
          const xs = cx;
          add(xs - R * 2.8, xs + R * 2.8, (t) => 1.7 * R * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)));
          markEdge(xs - R * 2.8, xs + R * 2.8);
          logs.push({ x: xs, r: R, seed: Math.floor(r() * 1e9) });
          cx += range(r, 5, 10);
        }
        len = cx - x + 8;
        break;
      }
      case "mud": {
        len = range(r, 14, 28) + 8 * d;
        add(x, x + len, (t) => -0.32 * Math.pow(Math.sin(Math.PI * t), 0.6));
        muds.push({ x0: x + 1, x1: x + len - 1 });
        len += 10;
        break;
      }
      case "ford": {
        len = range(r, 12, 20) + 4 * d;
        const depth = 0.7 + 0.5 * d;
        add(x, x + len, (t) => -depth * Math.pow(Math.sin(Math.PI * t), 0.8));
        fordSpans.push({ x0: x, x1: x + len });
        len += 14;
        break;
      }
      case "ice": {
        len = range(r, 20, 40) + 10 * d;
        ices.push({ x0: x, x1: x + len });
        len += 8;
        break;
      }
      case "humps": {
        // camel humps: two or three crests in a row — at speed the truck bucks and the load jumps
        const n = 2 + (chance(r, 0.3 + 0.4 * d) ? 1 : 0);
        let cx = x;
        for (let k = 0; k < n; k++) {
          const hl = range(r, 8, 11), hh = (0.55 + 1.0 * d) * range(r, 0.8, 1.15);
          add(cx, cx + hl, (t) => hh * Math.pow(Math.sin(Math.PI * t), 1.4));
          crests.push(cx + hl / 2);
          cx += hl + range(r, 1, 4);
        }
        len = cx - x + 10;
        break;
      }
      case "holes": {
        // a stretch of potholes and ruts
        const n = 3 + Math.floor(r() * (2 + 3 * d));
        let cx = x;
        for (let k = 0; k < n; k++) {
          const w = range(r, 1.4, 2.6), dp = (0.15 + 0.25 * d) * range(r, 0.7, 1.1);
          add(cx, cx + w, (t) => -dp * Math.sin(Math.PI * t));
          cx += w + range(r, 1.5, 4);
        }
        len = cx - x + 6;
        break;
      }
      case "table": {
        // a tabletop: up onto a flat top and down again — fast, the truck flies off the top
        const up = range(r, 9, 12), top = range(r, 8, 16), down = range(r, 10, 14);
        const hgt = (1.2 + 1.4 * d) * range(r, 0.85, 1.1);
        add(x, x + up + top + down, (t) => {
          const u = t * (up + top + down);
          return u < up ? hgt * smooth(u / up) : u < up + top ? hgt : hgt * (1 - smooth((u - up - top) / down));
        });
        crests.push(x + up + top);
        len = up + top + down + 10;
        break;
      }
      default: len = range(r, 16, 28);
    }
    // a warning sign before each hazard
    const SIGN: Partial<Record<Feature, SignKind>> = { ramp: "jump", pit: "jump", table: "jump", crest: "bump", humps: "bump", whoops: "bump", logs: "log", ford: "water", mud: "mud", ice: "ice", bridge: "bridge", rocks: "rocks", steps: "rocks", holes: "holes", steep: "steep" };
    const sk = SIGN[f];
    if (sk) sign(x - range(r, 14, 22), sk);
    spots.push({ f, x, len });
    x += len + range(r, 0.6, 1.3) * (40 - 16 * d);
  }

  // ---- checkpoints sit on level ground (flattened before the slope cap, which then eases their joins)
  const level = (xc: number, half: number) => {
    const y = H[I(xc)];
    for (let i = I(xc - half - 10); i <= I(xc + half + 10); i++) {
      const dd = Math.abs(X(i) - xc);
      const t = dd <= half ? 1 : 1 - smooth((dd - half) / 10);
      if (!edge[i]) H[i] = H[i] + (y - H[i]) * t;
    }
  };
  for (const c of checkpoints) level(c, 9);

  // ---- slopes: nothing steeper than the cap except the designed edges (it works on height differences, so an edge
  // rides along with the ground it sits on), then a light smoothing. 22° on easy roads up to 25° on the hardest:
  // every truck crawls up that with a load, but full gas on it lifts the nose and slides the load back
  const maxS = (0.4 + 0.06 * d) * dx;
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
  for (const b of bridges) { const sh = H[I(b.x0)] - before[I(b.x0)]; b.y0 += sh; b.y1 += sh; }
  const tmp = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) {
    tmp.set(H);
    for (let i = 1; i < N - 1; i++) if (!edge[i - 1] && !edge[i] && !edge[i + 1]) H[i] = (tmp[i - 1] + 2 * tmp[i] + tmp[i + 1]) / 4;
  }
  // a rough road surface in patches — roots, ruts and gravel, 10 to 25 cm — added after the smoothing (which would
  // flatten it): driven slowly the truck rolls over it, at full speed it shakes the load loose
  const rough = noise1(plan.seed + 9), patch = noise1(plan.seed + 10);
  const ra = (0.07 + 0.13 * d) * st.bump;
  for (let i = 0; i < N; i++) {
    const x = X(i);
    if (edge[i] || x < 30 || x > L - 20 || nearCp(x, 12) || (i > 0 && i < N - 1 && Math.abs(H[i + 1] - H[i - 1]) / (2 * dx) > 0.3)) continue;
    const m = smooth(clamp(patch(x / 40) * 1.6 + 0.2, 0, 1));
    if (m <= 0) continue;
    H[i] += ra * m * (rough(x / 1.3) * 0.7 + rough(x / 0.7 + 50) * 0.3);
  }
  // the yard and the start sit on level ground
  const fy = H[I(L - 12)];
  for (let i = I(L - 12); i < N; i++) H[i] = fy;
  const sy = H[I(10)];
  for (let i = 0; i <= I(10); i++) H[i] = sy;

  const terrain = new Terrain(x0, dx, H);
  for (const m of muds) for (let i = I(m.x0); i <= I(m.x1); i++) terrain.zone[i] = ZONE_MUD;
  for (const m of ices) for (let i = I(m.x0); i <= I(m.x1); i++) terrain.zone[i] = ZONE_ICE;
  const fords: Ford[] = fordSpans.map((s) => {
    // the water stands a little below the lower rim
    let lo = Infinity;
    for (let i = I(s.x0); i <= I(s.x1); i++) lo = Math.min(lo, H[i]);
    // a ford is never deeper than a wheel and a half can wade (the hills around it may make the dip much deeper:
    // filled to the rim, that drowned the load)
    const rim = Math.min(H[I(s.x0)], H[I(s.x1)]);
    const level = Math.min(rim - 0.12, lo + 0.75 + 0.3 * d);
    let a = s.x0, b = s.x1;
    while (a < s.x1 && terrain.heightAt(a) > level) a += dx;
    while (b > s.x0 && terrain.heightAt(b) > level) b -= dx;
    for (let i = I(a); i <= I(b); i++) terrain.water[i] = level;
    return { x0: a, x1: b, level };
  }).filter((f) => f.x1 - f.x0 > 2);
  // logs ride on the final ground
  const fill = new Float32Array(H);
  for (const b of bridges) for (let i = I(b.x0 + 0.5); i <= I(b.x1 - 0.5); i++) fill[i] = Math.min(b.y0, b.y1) - 26;

  const inGap = (xx: number, m = 0) => pits.some((p) => xx > p.x0 - m && xx < p.x1 + m) || bridges.some((b) => xx > b.x0 - m && xx < b.x1 + m);
  const inWater = (xx: number, m = 0) => fords.some((f) => xx > f.x0 - m && xx < f.x1 + m);
  const nearRamp = (xx: number) => ramps.some((rp) => xx > rp - 14 && xx < rp + 3);
  const nearLog = (xx: number, m = 2) => logs.some((l) => Math.abs(l.x - xx) < m);

  // ---- wind: gusty stretches on breezy worlds and in storms (mostly a headwind, which blows the load backwards)
  const winds: Wind[] = [];
  const windW = st.wind + (plan.twist === "storm" ? 0.9 : 0) + (plan.weather === "dust" || plan.weather === "breeze" ? 0.3 : 0);
  if (windW > 0.1 && !world.space) {
    const nW = Math.min(3 + Math.floor(L / 1000), Math.floor(windW * (1 + 2 * d) * range(r, 0.6, 1.3) * (1 + L / 1500)));
    for (let k = 0; k < nW; k++) {
      const wx = L * range(r, 0.1 + (k * 0.85) / nW, 0.1 + ((k + 0.6) * 0.85) / nW);
      winds.push({ x0: wx, x1: wx + range(r, 40, 80), s: (chance(r, 0.8) ? -1 : 1) * (1.6 + 2.6 * d) * range(r, 0.8, 1.15) });
      sign(wx - 16, "wind");
    }
  }

  // ---- items
  const items: Item[] = [];
  const it = (kind: Item["kind"], xx: number, y: number, value = 0, power: PowerId | null = null) =>
    items.push({ kind, x: xx, y, value, power, taken: false, phase: r() * 6.28 });
  const ground = (xx: number) => terrain.heightAt(xx);
  const clear = (xx: number) => { let px = xx; for (let k = 0; k < 14 && (inGap(px, 4) || nearRamp(px) || inWater(px, 2) || nearLog(px)); k++) px += 5; return px; };
  // fuel cans
  // fuel cans close enough for a slow, careful driver (long roads are driven gently)
  const lowG = world.gravity * (plan.twist === "lowgrav" ? 0.6 : 1) < 8;
  const fuelGap = (170 + 70 * d) * (plan.twist === "nitro" ? 0.85 : 1) * (lowG ? 0.7 : 1);
  for (let fx = fuelGap * 0.75; fx < L - 40; fx += fuelGap * range(r, 0.9, 1.1)) { const px = clear(fx); it("fuel", px, ground(px) + 1.0); }
  for (const c of checkpoints) it("fuel", c + 18, ground(c + 18) + 1.0);
  // coins: lines along the road, arcs over crests and kickers
  const coinGap = plan.twist === "coins" ? 0.5 : 1;
  for (const rp of [...ramps, ...crests]) {
    for (let k = 0; k < 7; k++) {
      const cx = rp - 3 + k * 1.6;
      if (inGap(cx, 0.5)) continue;
      it("coin", cx, ground(cx) + 1.6 + Math.sin((k / 6) * Math.PI) * 1.6, k === 3 ? 25 : 5);
    }
  }
  for (let cx = 20; cx < L - 25; cx += range(r, 24, 52) * coinGap) {
    if (inGap(cx, 3) || nearRamp(cx) || inWater(cx, 1)) continue;
    const count = 4 + Math.floor(r() * 5);
    const gold = chance(r, 0.18 + 0.2 * d);
    for (let k = 0; k < count; k++) {
      const px = cx + k * 1.6;
      if (inGap(px, 1) || inWater(px)) break;
      it("coin", px, ground(px) + 1.35 + (nearLog(px, 1.2) ? 0.7 : 0), gold && k === Math.floor(count / 2) ? 25 : 5);
    }
    cx += count * 1.6;
  }
  // a gem or two up high (tempting, but a jump for a gem costs cargo)
  const gemAt = spots.filter((s) => s.f === "crest" || s.f === "pit" || s.f === "steep");
  for (let k = 0; k < Math.min(2, gemAt.length); k++) {
    const s = gemAt[Math.floor(r() * gemAt.length)];
    const gx = s.x + s.len * (s.f === "steep" ? 0.8 : 0.45);
    it("coin", gx, Math.max(ground(gx), ground(gx - 5)) + (s.f === "steep" ? 2.2 : 3.6), 100);
  }
  // hearts
  for (let k = 0; k < Math.max(1, Math.round(L / 1100)); k++) {
    if (k === 0 ? plan.n % 6 === 0 || plan.big || chance(r, 0.15) : chance(r, 0.35)) { const px = clear(L * range(r, 0.2 + k * 0.3, 0.45 + k * 0.3) % L); it("heart", px, ground(px) + 2.2); }
  }
  // power-ups, placed where they help
  const nPow = 1 + (d > 0.45 ? 1 : 0) + (plan.big ? 1 : 0) + (plan.twist === "nitro" ? 3 : 0);
  const usable = spots.filter((s) => s.f !== "rest");
  const fragile = plan.cargo.some((k) => k === "jar" || k === "egg" || k === "vase" || k === "potion" || k === "crystal" || k === "melon");
  for (let k = 0; k < nPow && usable.length; k++) {
    const s = usable[Math.floor(r() * usable.length)];
    const power: PowerId = plan.twist === "nitro" && k > 0 ? "nitro"
      : s.f === "steep" ? (chance(r, 0.6) ? "nitro" : "double")
        : s.f === "whoops" || s.f === "crest" || s.f === "logs" || s.f === "steps" || s.f === "rocks" || s.f === "pit" || s.f === "ramp"
          ? (fragile && chance(r, 0.55) ? "bubble" : "net")
          : pick(r, ["magnet", "double", "net", "magnet"] as PowerId[]);
    const px = clear(Math.max(30, s.x - 22));
    it("power", px, ground(px) + 1.5, 0, power);
  }

  // ---- props
  const props: PropSpot[] = [];
  const kinds: [PropKind, number][] = [...world.props, ...(partner ? partner.props.map(([k, w]) => [k, w * plan.blendAmt * 1.6] as [PropKind, number]) : [])];
  const kTotal = kinds.reduce((s, [, w]) => s + w, 0);
  const kind = () => { let v = r() * kTotal; for (const [k, w] of kinds) { v -= w; if (v <= 0) return k; } return kinds[0][0]; };
  for (let px = x0 + 4; px < end - 6; px += range(r, 2.4, 8)) {
    if (inGap(px, 2.5) || inWater(px, 1.5) || Math.abs(terrain.slopeAt(px)) > 0.4 || nearCp(px, 4) || (px > L - 8 && px < L + 30) || Math.abs(px) < 4) continue;
    const back = chance(r, 0.5);
    if (!back && nearLog(px, 2.5)) continue;
    props.push({ kind: kind(), x: px, y: ground(px), s: range(r, 0.8, 1.2) * (back ? 0.8 : 1), flip: chance(r, 0.5), back, seed: Math.floor(r() * 1e9) });
  }
  const marks = [...world.landmarks, ...(partner && plan.blendAmt > 0.3 ? partner.landmarks : [])];
  for (let k = 0; k < (L > 700 ? 2 : 1) && marks.length; k++) {
    let px = L * range(r, 0.15 + k * 0.4, 0.38 + k * 0.4);
    for (let q = 0; q < 20 && (inGap(px, 8) || inWater(px, 6) || Math.abs(terrain.slopeAt(px)) > 0.18); q++) px += 9;
    props.push({ kind: marks[k % marks.length], x: px, y: ground(px), s: 1, flip: chance(r, 0.5), back: true, seed: Math.floor(r() * 1e9) });
  }
  props.sort((a, b) => a.x - b.x);

  // ---- animals by the road (they scatter when the truck comes)
  const animals: AnimalSpot[] = [];
  const zoo = [...world.animals, ...(partner && plan.blendAmt > 0.25 ? partner.animals.slice(0, 1) : [])];
  for (let ax = 40 + r() * 40; ax < L - 20; ax += range(r, 45, 110)) {
    if (inGap(ax, 4) || Math.abs(terrain.slopeAt(ax)) > 0.3) continue;
    let kindA = pick(r, zoo);
    if ((kindA === "duck" || kindA === "frog") && fords.length && chance(r, 0.6)) {
      const f = pick(r, fords);
      ax = Math.max(ax, f.x0 + (f.x1 - f.x0) * range(r, 0.3, 0.7));
      animals.push({ kind: kindA, x: ax, y: kindA === "duck" ? f.level : terrain.heightAt(f.x0 - 1), flip: chance(r, 0.5), seed: Math.floor(r() * 1e9), s: range(r, 0.9, 1.1) });
      continue;
    }
    if (inWater(ax, 2)) kindA = "bird";
    const group = kindA === "bird" || kindA === "chicken" || kindA === "bee" || kindA === "firefly" ? 1 + Math.floor(r() * 3) : 1;
    for (let g = 0; g < group; g++) {
      const gx = ax + g * range(r, 0.9, 1.8);
      if (inGap(gx, 1) || inWater(gx)) continue;
      animals.push({ kind: kindA, x: gx, y: terrain.heightAt(gx), flip: chance(r, 0.5), seed: Math.floor(r() * 1e9), s: range(r, 0.85, 1.1) });
    }
  }
  items.sort((a, b) => a.x - b.x);

  const gravity = world.gravity * (plan.twist === "lowgrav" ? 0.6 : 1);
  signs.sort((a, b) => a.x - b.x);
  return { plan, world, partner, terrain, fill, pits, bridges, fords, muds, ices, winds, logs, signs, ramps, crests, checkpoints, finish: L, items, props, animals, gravity };
}

/** a world for screens that only need a look (menus): a short calm road */
export function previewCourse(worldIndex: number) {
  return buildCourse({ ...stagePlan(worldIndex * 50 + 2), difficulty: 0.2, length: 360 });
}
export const WORLD_COUNT = WORLDS.length;
