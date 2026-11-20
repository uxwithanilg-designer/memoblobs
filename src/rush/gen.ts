// Rollo Rush stage builder. Stage n of the journey brings exactly one new concept (data/worlds.ts teaching order); the
// builder lays a track out of sections — each a small, tuned piece that teaches or reuses one idea — in the order
// sign → practice → mix → set piece → goal, at the stage's difficulty. Hazard spacing comes from the runner's speed and
// a human reaction time, and every hazard leaves an intent (where to steer / when to jump) that the fairness bot
// replays with the real physics before the stage is accepted. After the built worlds, the Remix Run mixes the ideas
// learned so far into new named stages forever, with a freshness memory so mixes never come back soon.
import { hash32, Rng } from "../roll/rng";
import { CONCEPT } from "./data/concepts";
import { BUILT_WORLDS, STAGES_PER_WORLD, WORLDS, worldOf } from "./data/worlds";
import { parkSection, sigSection, treasure, witchSection } from "./magic";
import { MIX_MORE, MORE } from "./sections2";
import type { BossSpec, FenceKind, FloorKind, Intent, Moves, Obj, ObjKind, Seg, Stage, StageKind, StageRules, StageView } from "./types";

// ---------------------------------------------------------------- physics numbers shared with sim.ts
export const G = 32;
export const JUMP_V = 11;
export const DOUBLE_V = 10;
export const STEER = 10.5;
export const HEIGHT = 1.3;
export const BALL_HEIGHT = 0.75;
export const air = (v0: number) => (2 * v0) / G;

/** difficulty by stage number: a quick early climb, then it keeps getting harder (stage 1 → 0.2, 10 → 0.32, 20 → 0.45,
 * 40 → 0.64, 100 → 0.99, 200 → 1.25, 500 → 1.6) */
export const difficultyAt = (n: number) => 0.18 + 1.15 * (1 - Math.exp(-n / 75)) + 0.45 * Math.min(1, Math.max(0, (n - 150) / 550));
/** reaction time the stage allows (seconds) */
export const reactAt = (d: number) => Math.max(0.45, 1.15 - 0.45 * d);
export const runAt = (d: number) => 14 + 5.5 * Math.min(1.6, d);

const KIND_D: Record<StageKind, number> = { opener: -0.05, learn: 0, mix: 0.05, breather: -0.1, speed: 0.06, twist: 0.1, burner: 0.16, star: 0.04, boss: 0.08, remix: 0 };
const RHYTHM: StageKind[] = ["learn", "learn", "mix", "learn", "breather", "learn", "speed", "twist", "burner", "star"];

export interface Recipe {
  /** height the track starts at (where the stage before ended) */
  y0?: number;
  n: number; seed: number; world: number; stage: number; kind: StageKind; d: number; name: string;
  meet?: string;
  /** everything learned so far (sections may use any of it) */
  known: string[];
  /** the ideas this stage is about */
  focus: string[];
  remix?: { name: string; key: string; atoms: string[]; blend: number };
  look: { world: number; blend?: number };
  /** modes: which mode, the number that varies the signature obstacle and Mayamma's visits, no witch or big obstacle */
  mode?: string; alt?: number; calm?: boolean;
}
export interface RemixMemory { recent: string[]; seen: string[] }

const TAUGHT = BUILT_WORLDS * STAGES_PER_WORLD;
/** concepts learned by journey stage n (all built ones after the journey) */
export function knownAt(n: number): string[] {
  const out: string[] = [];
  const upto = Math.min(n, TAUGHT);
  for (let i = 1; i <= upto; i++) { const w = worldOf(Math.ceil(i / STAGES_PER_WORLD)); out.push(w.teach[(i - 1) % STAGES_PER_WORLD]); }
  if (!out.includes("M03")) out.push("M03");
  return out;
}
/** ideas a mixed section can be built round */
export const MIXABLE = new Set(["M02", "C02", "L02", "M03", "H01", "H02", "S01", "S02", "A01", "E01", "M04", "N01", "L07", "L29", "S03", "L03", "C03", "E02", "H03", "A02", "L06", "H04", "M06", "E03", "P01", "U01", "X01", "S04", "M07"]);

export function recipeFor(n: number, salt: number, mem: RemixMemory = { recent: [], seen: [] }): Recipe {
  const seed = hash32(n, salt, 0x5a11);
  const rng = new Rng(seed);
  if (n <= TAUGHT) {
    const world = Math.ceil(n / STAGES_PER_WORLD), stage = ((n - 1) % STAGES_PER_WORLD) + 1;
    const W = worldOf(world);
    const meet = W.teach[stage - 1];
    const kind: StageKind = stage === 1 ? "opener" : stage === STAGES_PER_WORLD ? "boss" : RHYTHM[(stage - 1) % 10];
    const d = Math.max(0.03, difficultyAt(n) + KIND_D[kind]);
    const name = kind === "boss" ? `Kranky: ${CONCEPT[meet]?.name}` : stage === 1 ? W.name : `New: ${CONCEPT[meet]?.name}`;
    return { n, seed, world, stage, kind, d, name, meet, known: knownAt(n), focus: [meet], look: { world } };
  }
  // ---- the Remix Run: 2–3 learned ideas, a blended look, the freshest mix wins
  const pool = knownAt(TAUGHT).filter((c) => MIXABLE.has(c));
  const depth = n - TAUGHT;
  const k = depth < 30 ? 2 : rng.int(2, 3);
  const recent = new Set(mem.recent);
  let best: string[] = [], bestScore = -Infinity;
  for (let t = 0; t < 24; t++) {
    const a = pool.slice(), atoms: string[] = [];
    while (atoms.length < k && a.length) atoms.push(a.splice(rng.int(0, a.length - 1), 1)[0]);
    const key = atoms.slice().sort().join("+");
    const score = -atoms.filter((x) => recent.has(x)).length * 2 - (mem.seen.includes(key) ? 4 : 0) + rng.next();
    if (score > bestScore) { bestScore = score; best = atoms; }
  }
  const w1 = 1 + (Math.floor(depth / 5) % BUILT_WORLDS), w2 = 1 + ((w1) % BUILT_WORLDS);
  const kind: StageKind = depth % 10 === 9 ? "burner" : depth % 10 === 4 ? "breather" : "remix";
  const d = difficultyAt(n) + KIND_D[kind] + Math.sin(depth * 1.3) * 0.06;
  const name = remixName(best, rng);
  return {
    n, seed, world: w1, stage: 0, kind, d, name, known: knownAt(TAUGHT), focus: best,
    remix: { name, key: best.slice().sort().join("+"), atoms: best, blend: rng.next() * 0.6 }, look: { world: w1, blend: w2 },
  };
}
const WORD: Record<string, string> = {
  M02: "Weave", C02: "Pearl", L02: "Curve", M03: "Hop", H01: "Spike", H02: "Gap", S01: "Turbo", S02: "Dash", A01: "Spring", E01: "Rollbot", M04: "Curl",
  N01: "Waterfall", L07: "Loop", L29: "Bridge", S03: "Slope", L03: "Bank", C03: "Arc", E02: "Hopper", H03: "Duck", A02: "Bounce", L06: "Bump",
  H04: "Wall", M06: "Double", E03: "Drone", P01: "High-Road", U01: "Magnet", X01: "Trick", S04: "Boost", M07: "Burst",
};
const TAIL = ["Rush", "Run", "Dash", "Sprint", "Glide", "Spin", "Blitz", "Zoom", "Flight", "Wave"];
function remixName(atoms: string[], rng: Rng) { return `${atoms.slice(0, 2).map((a) => WORD[a] ?? CONCEPT[a]?.name.split(" ")[0] ?? a).join(" ")} ${TAIL[rng.int(0, TAIL.length - 1)]}`; }

// ---------------------------------------------------------------- the builder
export class B {
  segs: Seg[] = []; objs: Obj[] = []; intents: Intent[] = [];
  /** stage-wide rules, view twists, a chaser, a rival, gravity (set by the sections that teach them) */
  rules: StageRules = {}; view: StageView = {}; chase?: Stage["chase"]; rival?: Stage["rival"]; gravity?: number;
  s = 0; pitch = 0; elev = 24; heading = 0;
  id = 1;
  rng: Rng; r: Recipe; v: number; react: number; width: number; floor: FloorKind; fence: FenceKind;
  checks: number[] = [];
  concepts = new Set<string>();
  moves: Moves = { curl: false, double: false, burst: false, trick: false };
  target = 0;
  constructor(r: Recipe, rng: Rng) {
    this.r = r; this.rng = rng;
    this.v = runAt(r.d); this.react = reactAt(r.d);
    this.elev = r.y0 ?? 24;
    const W = worldOf(r.look.world);
    this.width = 7.6 - Math.min(1.8, r.d * 1.4);
    this.floor = FLOOR_OF[W.scenery] ?? "grass";
    this.fence = FENCE_OF[W.scenery] ?? "wood";
    const k = new Set(r.known);
    this.moves = {
      curl: k.has("M04"), double: k.has("M06"), burst: k.has("M07"), trick: k.has("X01"),
      pound: k.has("M08"), slide: k.has("M09"), drift: k.has("M10"), hop: k.has("M11"), dash: k.has("M13"), flick: k.has("M14"), brake: k.has("M15"),
      whip: k.has("M19"), guard: k.has("M20"), rush: k.has("S11"), skip: k.has("M23"), leap: k.has("M25"),
    };
  }
  /** a quick hazard this stage knows, and one placed at s */
  quickKind() { return quickKind(this); }
  hazardAt(k: string, s: number, L: number) { hazardAt(this, k, s, L); }
  knows(c: string) { return this.r.known.includes(c); }
  /** reaction distance (m) at this stage's speed */
  get R() { return this.v * this.react; }
  seg(len: number, o: Partial<Seg> = {}) {
    const g: Seg = { len, yaw: 0, pitch: 0, width: this.width, floor: this.floor, fence: this.fence, tag: "plain", ...o };
    // keep the track heading roughly forward and the height above the sea
    this.segs.push(g);
    this.heading += g.yaw;
    const p0 = this.pitch;
    this.pitch += g.tag === "loop" ? 0 : g.pitch;
    if (g.tag !== "loop") this.elev += Math.sin((p0 + this.pitch) / 2) * g.len;
    const at = this.s;
    this.s += len;
    return at;
  }
  add(k: ObjKind, s: number, u: number, h = 0, more: Partial<Obj> = {}) { const o: Obj = { id: this.id++, k, s, u, h, ...more }; this.objs.push(o); return o; }
  intent(i: Intent) { this.intents.push(i); }
  half() { return this.width / 2 - 0.7; }
  /** a free-ish lateral spot */
  lane(): number { return this.rng.pick([-1, 0, 1]) * (this.width / 2 - 1.6); }
  // ---- track shapes
  straight(len: number, o: Partial<Seg> = {}) { return this.seg(len, o); }
  /** a curve that turns back toward the main heading when the track has drifted */
  curve(len: number, amount: number) {
    let dir = this.rng.chance(0.5) ? 1 : -1;
    if (Math.abs(this.heading) > 0.5) dir = this.heading > 0 ? -1 : 1;
    return this.seg(len, { yaw: dir * amount, tag: amount > 0.5 ? "bank" : "plain" });
  }
  /** up / down so the track stays between the beach and the clifftops */
  slope(len: number, dir: 1 | -1, steep = 0.14) {
    let d = dir;
    if (this.elev < 26) d = 1; else if (this.elev > 70) d = -1;
    const a = this.seg(len * 0.25, { pitch: d * steep, tag: "hill" });
    this.seg(len * 0.5, { tag: "hill" });
    this.seg(len * 0.25, { pitch: -d * steep, tag: "hill" });
    return a;
  }
  hill(len: number, a = 0.18) {
    const at = this.seg(len * 0.25, { pitch: a, tag: "hill" });
    this.seg(len * 0.5, { pitch: -2 * a, tag: "hill" });
    this.seg(len * 0.25, { pitch: a, tag: "hill" });
    return at;
  }
  loop(radius = 9) {
    const len = Math.round(2 * Math.PI * radius);
    return this.seg(len, { pitch: Math.PI * 2, shift: this.width + 2, tag: "loop", hold: Math.max(this.v * 1.25, 18), fence: "none" });
  }
  falls(drop: number) {
    for (let i = 0; i < 4 && this.elev < drop + 30; i++) this.slope(110, 1, 0.26);
    // over the brink, down the water, and out at the bottom
    const steep = 0.75;
    const a = this.seg(10, { pitch: -steep, tag: "falls", floor: "falls", fence: "none", hold: this.v * 1.2, width: this.width + 1 });
    const run = Math.max(14, drop / Math.sin(steep));
    this.seg(run, { tag: "falls", floor: "falls", fence: "none", hold: this.v * 1.35, width: this.width + 1 });
    this.seg(12, { pitch: steep, tag: "falls", floor: "falls", fence: "none", hold: this.v * 1.3, width: this.width + 1 });
    return a;
  }
  bridge(len: number, width: number, fence: FenceKind = "stone") { return this.seg(len, { tag: "bridge", floor: "boards", width, fence }); }
  gap(len: number) { return this.seg(len, { gap: true, fence: "none" }); }

  // ---- objects
  pearlLine(s0: number, s1: number, u0: number, u1 = u0, h = 0.9, step = 2.6) {
    for (let s = s0; s <= s1; s += step) { const t = (s - s0) / Math.max(1, s1 - s0); this.add("pearl", s, u0 + (u1 - u0) * t, h); }
  }
  /** pearls along a jump path starting at s (v0 = take-off speed) */
  pearlArc(s: number, u: number, v0 = JUMP_V, n = 6, h0 = 0) {
    const T = air(v0) + (h0 > 0 ? 0.25 : 0);
    for (let i = 1; i <= n; i++) { const t = (T * i) / (n + 1); this.add("pearl", s + this.v * t, u, Math.max(0.6, h0 + v0 * t - (G * t * t) / 2 + 0.6)); }
  }
  /** a gap for the bot: where to steer and until when */
  steerTo(s: number, u: number, until: number, at = until - 1) { this.intent({ s, act: "steer", u, until, at }); }
  /** a jump intent: s = where the hazard begins, the bot jumps at the best moment */
  jumpAt(s: number, act: "jump" | "double" = "jump") { this.intent({ s, act }); }
  curlAt(s: number, until: number) { this.intent({ s, act: "curl", until }); }
}

// ---------------------------------------------------------------- sections (one idea each)
export type Mode = "sign" | "use" | "mix" | "show";
export type Section = (b: B, m: Mode) => void;

/** each world's own floor and fence */
const FLOOR_OF: Record<string, FloorKind> = {
  coast: "path", meadow: "grass", canyon: "candy", forest: "path", cave: "crystal", city: "neon", snow: "snow", sky: "cloud", volcano: "rock", jungle: "stone",
  dunes: "sand", factory: "metal", carnival: "boards", sea: "glass", plains: "grass", shrooms: "grass", tower: "metal", highway: "rainbow", moors: "stone",
  space: "metal", grid: "neon", peaks: "stone", fortress: "metal",
};
const FENCE_OF: Record<string, FenceKind> = {
  coast: "wood", meadow: "wood", canyon: "wood", forest: "wood", cave: "stone", city: "neon", snow: "wood", sky: "none", volcano: "stone", jungle: "stone",
  dunes: "wood", factory: "metal", carnival: "metal", sea: "metal", plains: "wood", shrooms: "wood", tower: "metal", highway: "neon", moors: "wood",
  space: "metal", grid: "neon", peaks: "stone", fortress: "metal",
};

export const sp = (b: B, m: Mode) => (m === "sign" ? 1.6 : m === "use" ? 1.12 : 0.92) * Math.max(12, b.R * 1.3);

const SECTIONS: Record<string, Section> = {
  /** auto-run: a long, gentle run with pearls down the middle and a curve */
  M01: (b) => { const a = b.straight(50); b.pearlLine(a + 6, a + 44, 0); b.curve(60, 0.4); },
  /** steering: pearl lines that weave side to side */
  M02: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      const L = Math.max(36, b.R * 2.2), a = b.straight(L);
      const u0 = b.rng.pick([-1, 1]) * (b.width / 2 - 1.4);
      b.pearlLine(a + 4, a + L - 4, u0, -u0);
    }
  },
  Q01: (b) => { const a = b.straight(40); b.pearlLine(a + 4, a + 36, 0); },
  /** pearls everywhere: lines, big pearls on the edges */
  C01: (b) => { const a = b.straight(60); b.pearlLine(a + 4, a + 56, -2); b.pearlLine(a + 4, a + 56, 2); b.add("bigPearl", a + 30, b.rng.pick([-1, 1]) * b.half(), 0.9); },
  L01: (b) => { const a = b.straight(80); b.pearlLine(a + 10, a + 70, b.lane()); },
  /** pearl lines that point the good way through what comes next */
  C02: (b, m) => { SECTIONS.H01?.(b, m === "sign" ? "use" : m); },
  L02: (b) => { const a = b.curve(70, 0.55); b.pearlLine(a + 6, a + 64, 0, b.rng.pick([-1.5, 1.5])); b.curve(60, 0.45); },
  /** hop: little hurdles across the whole track */
  M03: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.6);
      b.add("wall", s, 0, 0, { ds: 0.3, w: b.width / 2, tall: 0.65 });
      b.jumpAt(s - 0.3);
      if (i === 0 && m !== "mix") b.pearlArc(s - b.v * air(JUMP_V) * 0.42, 0, JUMP_V, 5);
    }
  },
  /** spike strips: steer round them (and later hop the full ones) */
  H01: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 2), gap = sp(b, m);
    const a = b.straight(gap * n + 12);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      const full = b.knows("M03") && m !== "sign" && b.rng.chance(0.3);
      if (full) {
        b.add("spike", s, 0, 0, { ds: 0.8, w: b.width / 2 });
        b.jumpAt(s - 0.8);
        continue;
      }
      // leave a safe gap the player can reach from the last one
      const reach = STEER * ((gap - 2) / b.v) * 0.75;
      const g = Math.max(-b.half() + 0.6, Math.min(b.half() - 0.6, last + (b.rng.next() * 2 - 1) * Math.min(reach, b.width * 0.7)));
      const gw = Math.max(2.2, 3.4 - b.r.d * 0.9);
      const L = -b.width / 2, Rr = b.width / 2;
      if (g - gw / 2 - L > 0.4) b.add("spike", s, (L + g - gw / 2) / 2, 0, { ds: 0.8, w: (g - gw / 2 - L) / 2 });
      if (Rr - (g + gw / 2) > 0.4) b.add("spike", s, (Rr + g + gw / 2) / 2, 0, { ds: 0.8, w: (Rr - g - gw / 2) / 2 });
      b.steerTo(s - gap * 0.7, g, s + 1);
      if (b.knows("C02")) b.pearlLine(s - Math.min(14, gap * 0.6), s + 4, g);
      last = g;
    }
  },
  /** pits: gaps in the track, with a pearl arc that shows the jump */
  H02: (b, m) => {
    const n = m === "sign" ? 2 : 3 + (m === "use" ? 1 : b.rng.int(0, 1));
    for (let i = 0; i < n; i++) {
      b.straight(Math.max(14, b.R * 1.05));
      const len = Math.min(7, 3 + b.r.d * 4 + b.rng.next() * 1.5);
      const s = b.gap(len);
      b.jumpAt(s);
      b.pearlArc(s - b.v * air(JUMP_V) * 0.3, 0, JUMP_V, 5);
    }
    b.straight(14);
  },
  /** speed tiers: a long pearl streak — every 20 in a row gives a burst of Turbo */
  S01: (b) => { const a = b.straight(110); b.pearlLine(a + 4, a + 104, 0, 0, 0.9, 2.2); b.curve(60, 0.4); },
  /** dash pads */
  S02: (b, m) => {
    const a = b.straight(30);
    b.add("pad", a + 10, 0); b.add("pad", a + 10, -2.6); b.add("pad", a + 10, 2.6);
    if (m !== "sign" && b.knows("H02")) { b.straight(10); const s = b.gap(Math.min(9, 6 + b.r.d * 3.5)); b.jumpAt(s); b.pearlArc(s - 4, 0, JUMP_V, 6); }
    const c = b.straight(50); b.pearlLine(c + 4, c + 46, 0);
  },
  /** springs throw you up through pearls (and over walls later) */
  A01: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      const L = Math.max(40, b.v * 2.6), a = b.straight(L);
      const u = b.lane();
      b.add("spring", a + 8, u, 0, { p: 17 });
      b.pearlArc(a + 8, u, 17, 8);
      if (m !== "sign" && i > 0) { b.add("wall", a + 8 + b.v * air(17) * 0.5, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6 }); b.steerTo(a + 2, u, a + 9, a + 8); }
    }
  },
  /** Rollbots sweep across the track: dodge them (or hop on them) */
  E01: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      const amp = Math.min(b.half() - 0.5, 1.6 + b.r.d * 2.4);
      const ph = b.rng.next() * Math.PI * 2;
      b.add("rollbot", s, 0, 0, { ds: 0.5, w: 0.6, tall: 0.95, amp, ph, freq: 0.12 });
      // the safe side when the runner arrives: the bot's position at the moment we pass
      const at = Math.sin(ph);
      b.steerTo(s - gap * 0.6, at > 0 ? -b.half() : b.half(), s + 1);
    }
  },
  /** the Curl Ball smashes crates */
  M04: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      for (let k = -1; k <= 1; k++) b.add("crate", s, k * 2.4, 0, { ds: 0.6, w: 0.9, tall: 1.1 });
      if (b.width > 8) { b.add("crate", s, -b.half() + 0.2, 0, { ds: 0.6, w: 0.8, tall: 1.1 }); b.add("crate", s, b.half() - 0.2, 0, { ds: 0.6, w: 0.8, tall: 1.1 }); }
      b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.5);
      b.pearlLine(s + 2, s + 10, 0);
    }
  },
  /** run down the waterfall */
  N01: (b, m) => {
    b.straight(20);
    b.add("pad", b.s - 8, 0);
    const a = b.falls(m === "sign" ? 26 : 34);
    b.pearlLine(a + 6, a + 40, 0, b.rng.pick([-1.5, 1.5]));
    b.straight(30);
  },
  /** loops (a dash pad before each) */
  L07: (b, m) => {
    const n = m === "sign" ? 1 : m === "use" ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = b.straight(26);
      b.add("pad", a + 12, 0);
      const l = b.loop(8 + b.rng.int(0, 2));
      for (let k = 0; k < 10; k++) b.add("pearl", l + 6 + k * 4.4, 0, 0.9);
    }
    b.straight(20);
  },
  /** the long bridge over the sea, toward the moon */
  L29: (b, m) => {
    const w = m === "sign" ? 5.4 : Math.max(4, 5.2 - b.r.d * 1.6);
    const len = m === "sign" ? 120 : 90;
    const a = b.bridge(len, w, b.r.d > 0.5 ? "none" : "stone");
    b.pearlLine(a + 6, a + len - 6, 0);
    if (m !== "sign" && b.knows("H02")) { const s = b.gap(5); b.jumpAt(s); b.pearlArc(s - 4, 0); b.bridge(40, w, "stone"); }
  },
  // ---------------- world 2
  /** grass: a flower meadow run with weaving pearls */
  T01: (b) => { const a = b.straight(70, { floor: "flowers" }); b.pearlLine(a + 6, a + 64, -2.5, 2.5); },
  /** slopes: down fast, up slow */
  S03: (b) => { const a = b.slope(140, -1, 0.2); b.pearlLine(a + 10, a + 60, 0); b.slope(120, 1, 0.16); },
  /** banked turns: lean in, pearls ride the high side */
  L03: (b) => { const a = b.curve(80, 1.0); b.pearlLine(a + 8, a + 72, -2.6); b.straight(20); b.curve(70, 0.9); },
  /** pearl arcs show where to jump */
  C03: (b, m) => { SECTIONS.H02(b, m === "sign" ? "use" : m); },
  /** Hopper Tins bounce up and down: pass under at the bottom, or hop over at the top */
  E02: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7), u = b.lane();
      b.add("hopper", s, u, 0, { ds: 0.5, w: 0.6, tall: 0.95, freq: 0.35, ph: b.rng.next() * 6 });
      b.steerTo(s - gap * 0.6, u > 0 ? -b.half() + 0.4 : b.half() - 0.4, s + 1);
    }
  },
  /** low bars: curl under them */
  H03: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      b.add("bar", s, 0, 0.95, { ds: 0.25, w: b.width / 2, tall: 0.6 });
      b.curlAt(s - Math.max(6, b.v * 0.45), s + 1);
    }
  },
  /** side springs bounce you across, away from spikes */
  A02: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      const L = Math.max(40, b.R * 2.2), a = b.straight(L);
      const side = b.rng.pick([-1, 1]);
      const u = side * (b.half() - 0.4);
      b.add("sideSpring", a + 8, u, 0, { p: -side * 9 });
      b.steerTo(a + 1, u, a + 8.5, a + 8);
      b.add("spike", a + 8 + Math.max(10, b.v * 0.9), u * 0.6, 0, { ds: 1.2, w: b.width * 0.32 });
      b.steerTo(a + 9, -u, a + 10 + b.v);
      b.pearlLine(a + 12, a + L - 4, -u * 0.9);
    }
  },
  /** hill hops: bumps that toss you into the air */
  L06: (b) => { for (let i = 0; i < 3; i++) { const a = b.hill(10, 0.42); b.add("pearl", a + 8, 0, 2.4); b.straight(14); } },
  /** high walls: hop over at the right moment */
  H04: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m) * 1.1;
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      const partial = m !== "sign" && b.rng.chance(0.5);
      if (partial) { const side = b.rng.pick([-1, 1]); b.add("wall", s, side * b.width * 0.22, 0, { ds: 0.4, w: b.width * 0.3, tall: 1.5 }); b.steerTo(s - gap * 0.6, -side * (b.half() - 0.4), s + 1); }
      else { b.add("wall", s, 0, 0, { ds: 0.4, w: b.width / 2, tall: 1.45 }); b.jumpAt(s - 0.4); }
    }
  },
  /** double hop: tall walls and long gaps */
  M06: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      b.straight(Math.max(18, b.R * 1.3));
      if (i % 2 === 0) { const s = b.straight(4); b.add("wall", s + 2, 0, 0, { ds: 0.4, w: b.width / 2, tall: 2.6 }); b.jumpAt(s + 1.6, "double"); }
      else { const s = b.gap(Math.min(10.5, 8 + b.r.d * 2.5)); b.jumpAt(s, "double"); b.pearlArc(s - 4, 0, JUMP_V, 6); }
    }
    b.straight(14);
  },
  /** Buzzdrones hover at jump height: don't hop into them */
  E03: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1), gap = sp(b, m);
    const a = b.straight(gap * n + 10);
    for (let i = 0; i < n; i++) {
      const s = a + gap * (i + 0.7);
      const ph = b.rng.next() * 6, amp = Math.min(b.half() - 0.6, 2.2);
      b.add("drone", s, 0, 1.55, { ds: 0.5, w: 0.7, tall: 0.7, amp, ph, freq: 0.1 });
      b.steerTo(s - gap * 0.6, Math.sin(ph) > 0 ? -b.half() : b.half(), s + 1);
      b.add("wall", s, 0, 0, { ds: 0.3, w: b.width / 2, tall: 0.5 });
      b.jumpAt(s - 0.3);
    }
  },
  /** Chase Cam: a camera show — loops and the bridge, filmed wide */
  V01: (b) => { SECTIONS.L07(b, "use"); SECTIONS.L29(b, "use"); },
  /** high road, low road: a spring up to a long ledge with pearls; hazards below */
  P01: (b) => {
    const a = b.straight(130);
    const u = b.rng.pick([-1, 1]) * (b.width / 2 - 2);
    b.add("spring", a + 10, u, 0, { p: 17 });
    b.add("platform", a + 64, u, 3.4, { ds: 44, w: 1.8, tall: 0.6 });
    b.pearlLine(a + 22, a + 104, u, u, 4.3);
    b.steerTo(a + 2, u, a + 108, a + 10);
    for (let s = a + 34; s < a + 104; s += 24) b.add("spike", s, -u * 0.5, 0, { ds: 0.8, w: b.width * 0.25 });
  },
  /** the pearl magnet */
  U01: (b) => { const a = b.straight(90); b.add("magnet", a + 8, 0, 1.0); for (let k = 0; k < 8; k++) b.pearlLine(a + 16 + k * 9, a + 18 + k * 9, (k % 2 ? 1 : -1) * (b.half() - 0.3)); },
  /** air tricks off kicker ramps */
  X01: (b, m) => {
    const n = m === "sign" ? 2 : m === "use" ? 4 : 3 + b.rng.int(0, 1);
    for (let i = 0; i < n; i++) { const a = b.straight(Math.max(40, b.v * 2.6)); b.add("trickRamp", a + 8, 0, 0, { p: 13, ds: 1.2, w: 2.2 }); b.pearlArc(a + 9, 0, 13, 6); }
  },
  /** the boost meter: pearls and tricks fill it; a full meter gives Turbo */
  S04: (b) => { const a = b.straight(120); b.pearlLine(a + 4, a + 116, 0, 0, 0.9, 2); },
  /** Burst: tap for speed — break the board walls */
  M07: (b, m) => {
    const n = m === "sign" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const a = b.straight(60);
      b.pearlLine(a + 4, a + 30, 0, 0, 0.9, 2);
      b.steerTo(a + 1, 0, a + 52, a + 4);
      b.add("crate", a + 50, 0, 0, { ds: 0.5, w: b.width / 2, tall: 2.2, p: 1 });
      b.intent({ s: a + 40, act: "burst" });
    }
  },
  /** pearl target: the gate at the goal opens with enough pearls */
  Q03: (b) => { const a = b.straight(80); b.pearlLine(a + 4, a + 76, -1.5, 1.5); },
};

Object.assign(SECTIONS, MORE);
// the story: Mayamma's stretch and each stage's signature obstacle
SECTIONS.WITCH = witchSection;
SECTIONS.SIG = sigSection;
SECTIONS.PARK = parkSection;
for (const c of MIX_MORE) MIXABLE.add(c);

/** a quick hazard in a joining piece, from the moves this stage knows (jumps are the most common): a full-width hurdle,
 * a pit, a full spike strip, a half-width spike strip to steer round, a crate row with one way through, or a Rollbot */
function filler(b: B) {
  const pool: [string, number][] = [];
  if (b.knows("M03")) pool.push(["hurdle", 3]);
  if (b.knows("H02")) pool.push(["pit", 3]);
  if (b.knows("H01")) pool.push(["side", 2]);
  if (b.knows("H01") && b.knows("M03")) pool.push(["strip", 2]);
  if (b.knows("M04")) pool.push(["crates", 1.5]);
  if (b.knows("E01")) pool.push(["bot", 1.5]);
  if (!pool.length) return;
  let t = b.rng.next() * pool.reduce((x, p) => x + p[1], 0), pick = pool[0][0];
  for (const [k, w] of pool) { t -= w; if (t <= 0) { pick = k; break; } }
  const L = Math.max(16, b.R * 1.05);
  if (pick === "pit") {
    b.straight(L * 0.7);
    const s = b.gap(Math.min(6.5, 2.8 + b.r.d * 3.4 + b.rng.next()));
    b.jumpAt(s);
    b.straight(L * 0.6);
    return;
  }
  const a = b.straight(L + 6);
  hazardAt(b, pick, a + L * 0.75, L);
}
/** pick a quick hazard the stage knows (no pits: those are track pieces) */
function quickKind(b: B): string | null {
  const pool: [string, number][] = [];
  if (b.knows("M03")) pool.push(["hurdle", 3]);
  if (b.knows("H01")) pool.push(["side", 2.5]);
  if (b.knows("H01") && b.knows("M03")) pool.push(["strip", 2]);
  if (b.knows("M04")) pool.push(["crates", 1.5]);
  if (b.knows("E01")) pool.push(["bot", 1.5]);
  if (!pool.length) return null;
  let t = b.rng.next() * pool.reduce((x, p) => x + p[1], 0);
  for (const [k, w] of pool) { t -= w; if (t <= 0) return k; }
  return pool[0][0];
}
/** one quick hazard at s (L = the lead the player gets to line up for it) */
function hazardAt(b: B, pick: string, s: number, L: number) {
  if (pick === "hurdle") { b.add("wall", s, 0, 0, { ds: 0.3, w: b.width / 2, tall: 0.65 }); b.jumpAt(s - 0.3); }
  else if (pick === "strip") { b.add("spike", s, 0, 0, { ds: 0.8, w: b.width / 2 }); b.jumpAt(s - 0.8); }
  else if (pick === "side") {
    const side = b.rng.pick([-1, 1]), w = b.width * (0.5 + b.r.d * 0.08);
    b.add("spike", s, side * (b.width / 2 - w / 2), 0, { ds: 0.8, w: w / 2 });
    b.steerTo(s - L * 0.7, -side * (b.width / 2 - Math.max(1.0, (b.width - w) / 2)), s + 1);
  } else if (pick === "crates") {
    const free = b.rng.pick([-1, 0, 1]);
    for (let k = -1; k <= 1; k++) if (k !== free) b.add("crate", s, k * 2.4, 0, { ds: 0.6, w: 0.9, tall: 1.1 });
    if (b.width > 7) { if (free !== -1) b.add("crate", s, -b.half() + 0.1, 0, { ds: 0.6, w: 0.7, tall: 1.1 }); if (free !== 1) b.add("crate", s, b.half() - 0.1, 0, { ds: 0.6, w: 0.7, tall: 1.1 }); }
    if (b.moves.curl) b.curlAt(s - Math.max(6, b.v * 0.45), s + 1.5); else b.steerTo(s - L * 0.7, free * 2.4, s + 1);
  } else {
    const amp = Math.min(b.half() - 0.5, 1.6 + b.r.d * 2.4), ph = b.rng.next() * Math.PI * 2;
    b.add("rollbot", s, 0, 0, { ds: 0.5, w: 0.6, tall: 0.95, amp, ph, freq: 0.12 });
    b.steerTo(s - L * 0.6, Math.sin(ph) > 0 ? -b.half() : b.half(), s + 1);
  }
}
/** the fill pass: long stretches with nothing to do get quick hazards (more of them as the game gets harder) — never on
 * loops, waterfalls, pits or boss arenas, never in the landing zone after a spring, pad or ramp, never next to a lamp */
function densify(b: B) {
  const r = b.r;
  if (r.n <= 3 || !quickKind(b)) return;
  const zones: [number, number][] = [[0, 50]];
  b.segs.reduce((s0, g) => { if (g.gap || ["loop", "falls", "boss", "tube", "wall", "spiral"].includes(g.tag)) zones.push([s0 - 12, s0 + g.len + 14]); return s0 + g.len; }, 0);
  for (const o of b.objs) {
    if (o.k === "pearl" || o.k === "bigPearl" || o.k === "medal") continue;
    if (["spring", "pad", "trickRamp", "sideSpring", "launch"].includes(o.k)) zones.push([o.s - 8, o.s + 34]);
    else zones.push([o.s - 9, o.s + 9]);
  }
  for (const i of b.intents) zones.push([i.s - 7, (i.until ?? i.s) + 7]);
  zones.sort((x, y) => x[0] - y[0]);
  const step = Math.max(16, b.R * 1.35);
  const p = Math.min(0.85, 0.35 + r.d * 0.5) * (r.kind === "breather" ? 0.5 : r.kind === "opener" ? 0.55 : 1);
  const end = b.s - 10;
  let at = 50;
  const free: [number, number][] = [];
  for (const [z0, z1] of zones) { if (z0 > at) free.push([at, Math.min(z0, end)]); at = Math.max(at, z1); }
  if (at < end) free.push([at, end]);
  for (const [f0, f1] of free) {
    for (let s = f0 + Math.max(step * 0.6, 12); s < f1 - 8; s += step) {
      if (!b.rng.chance(p)) continue;
      const k = quickKind(b); if (!k) return;
      hazardAt(b, k, s, Math.min(step, s - f0));
    }
  }
}

/** sections that only lay pearls or set pieces: in a mix they get a hazard after them */
const CALM = new Set(["M01", "M02", "Q01", "C01", "L01", "L02", "S01", "S02", "N01", "L07", "L29", "C02", "S03", "L06"]);

/** sections that may be mixed in (only ideas this stage already knows) */
function usable(b: B) { return Object.keys(SECTIONS).filter((c) => b.knows(c) && MIXABLE.has(c) && !["L29", "N01", "L07", "V01", "P01", "U01", "S04", "Q03", "S01"].includes(c)); }

// ---------------------------------------------------------------- bosses
/** each world's Kranky boss: its model, its attacks and how you hit its weak spot */
export function bossFor(world: number): BossSpec {
  const id = `K${String(world).padStart(2, "0")}`;
  const name = CONCEPT[id]?.name ?? "Kranky";
  const B: Record<number, [string, BossSpec["weak"], string[]]> = {
    1: ["crab", "ball", ["hurdle", "crates", "hurdle"]], 2: ["windmill", "spring", ["bar", "hurdle", "spikes"]],
    3: ["sub", "spring", ["rollers", "hurdle", "bombs"]], 4: ["gumball", "ball", ["rollers", "crates", "rollers"]],
    5: ["bopper", "burst", ["bar", "spikes", "hurdle"]], 6: ["golem", "ball", ["fallers", "crates", "spikes"]],
    7: ["tank", "spring", ["lasers", "bar", "lasers"]], 8: ["plough", "burst", ["hurdle", "crates", "rollers"]],
    9: ["zeppelin", "spring", ["bombs", "drones", "bombs"]], 10: ["drill", "hop", ["spikes", "fallers", "zap"]],
    11: ["guardian", "ball", ["bar", "hurdle", "fallers"]], 12: ["worm", "spring", ["rollers", "spikes", "gust"]],
    13: ["mecha", "hop", ["crates", "bombs", "hurdle"]], 14: ["coaster", "burst", ["hurdle", "bar", "rollers"]],
    15: ["angler", "hop", ["mines", "lasers", "mines"]], 16: ["blower", "ball", ["gust", "crates", "gust"]],
    17: ["turbine", "spring", ["gust", "zap", "drones"]], 18: ["mushroom", "hop", ["fallers", "spikes", "bombs"]],
    19: ["knight", "burst", ["bar", "lasers", "hurdle"]], 20: ["racer", "burst", ["lasers", "rollers", "drones"]],
    21: ["train", "ball", ["rollers", "bar", "mines"]], 22: ["cannon", "spring", ["bombs", "lasers", "fallers"]],
    23: ["snake", "hop", ["lasers", "zap", "crates"]], 24: ["kite", "spring", ["drones", "gust", "bombs"]],
    25: ["fortress", "hop", ["lasers", "bombs", "rollers", "fallers", "drones", "zap"]],
  };
  const [kind, weak, attacks] = B[world] ?? B[2];
  const hits = world >= 25 ? 6 : world >= 17 ? 4 : world >= 9 ? 4 : 3;
  return { kind, hits, weak, attacks, look: id, name };
}

// ---------------------------------------------------------------- the stage
export const BUILD_STATS = { built: 0, retried: 0, trimmed: 0 };
export function buildStage(r: Recipe): Stage {
  BUILD_STATS.built++;
  let best: Stage | null = null, bestAt = -1;
  for (let attempt = 0; attempt < 6; attempt++) {
    const st = layout(r, new Rng(hash32(r.seed, attempt, 0xa7)));
    if (!validate) return st;
    const res = validate(st);
    if (res.ok) return st;
    BUILD_STATS.retried++;
    if (res.at > bestAt) { bestAt = res.at; best = st; }
  }
  // last resort: keep the best layout and clear the trouble round each spot the bot could not pass, until it can —
  // pits there get a floor (their jump stays, as a hop), hazards there go
  BUILD_STATS.trimmed++;
  const st = best!;
  for (let k = 0; k < 12; k++) {
    const res = validate!(st);
    if (res.ok) break;
    let s0 = 0;
    for (const g of st.segs) { if (g.gap && s0 < res.at + 30 && s0 + g.len > res.at - 40) g.gap = false; s0 += g.len; }
    st.objs = st.objs.filter((o) => !HAZARD.has(o.k) || Math.abs(o.s - res.at) > 30);
    // dangerous floors there go too (water you would sink in, lava, zaps, webs, pulls, crumbling ground)
    st.objs = st.objs.filter((o) => o.k !== "zone" || !HARM_ZONE.has(o.zone!) || Math.abs(o.s - res.at) > (o.ds ?? 3) + 30);
    st.intents = st.intents.filter((i) => i.act === "steer" || Math.abs(i.s - res.at) > 30);
    if (k === 11) { st.objs = st.objs.filter((o) => !HAZARD.has(o.k)); for (const g of st.segs) g.gap = false; }
  }
  return st;
}
const HARM_ZONE = new Set(["water", "lava", "zap", "web", "pull", "crumble", "hot", "wind", "goo", "oil", "ice", "headwind", "shrink"]);
const HAZARD = new Set<ObjKind>(["spike", "bar", "wall", "crate", "rollbot", "hopper", "drone", "sideSpring", "bomb", "laser", "fire", "crusher", "roller", "faller", "saw", "mine", "thorn", "swing", "clanker", "door", "gate", "cage"]);
/** set by bot.ts (kept out of this file so the builder has no physics import cycle) */
let validate: ((s: Stage) => { ok: boolean; at: number }) | null = null;
export function setValidator(f: (s: Stage) => { ok: boolean; at: number }) { validate = f; }

function layout(r: Recipe, rng: Rng): Stage {
  const b = new B(r, rng);
  const W = worldOf(r.look.world);
  b.floor = W.scenery === "meadow" ? "grass" : "path";
  // ---- start: a calm straight with a line of pearls
  const a0 = b.straight(44);
  b.pearlLine(a0 + 14, a0 + 40, 0);
  const plan: [string, Mode][] = [];
  const old = usable(b).filter((c) => !r.focus.includes(c));
  const pickOld = () => (old.length ? old[rng.int(0, old.length - 1)] : "M02");
  const focus = r.focus.filter((c) => SECTIONS[c]);
  const len = r.kind === "breather" ? 5 : r.kind === "burner" || r.kind === "twist" ? 8 : r.kind === "opener" ? 5 : 7;
  if (r.kind === "opener") {
    // the world's showcase: wide curves, a loop, the waterfall and the bridge when this world has them — no hazards
    const wc = `W${String(r.world).padStart(2, "0")}`;
    if (SECTIONS[wc]) plan.push([wc, "show"]);
    plan.push(["M01", "show"], ["L02", "show"], ["L07", "show"], ["C01", "show"]);
    plan.push(r.world === 1 ? ["L29", "show"] : ["S03", "show"]);
    // the very first run: hurdles about 15–20 seconds in
    if (r.n === 1) plan.splice(2, 0, ["M03", "use"]);
    if (r.world > 1) plan.splice(3, 0, [pickOld(), "mix"], [pickOld(), "mix"]);
  } else if (r.kind === "boss") {
    plan.push(["L01", "show"]);
  } else if (r.mode === "park") {
    // Trick Park: the park's own pieces between loops, hills and kickers
    const fun = ["X01", "A01", "L07", "S02", "A02", "L06", "S03", "L29", "C03"].filter((c) => SECTIONS[c]);
    for (let i = 0; i < 5; i++) plan.push(["PARK", "use"], [fun[rng.int(0, fun.length - 1)], i % 2 ? "use" : "sign"]);
  } else if (r.remix) {
    for (let i = 0; i < len; i++) plan.push([focus[i % focus.length] ?? pickOld(), i < 2 ? "use" : "mix"]);
  } else {
    const f = focus[0];
    plan.push([f ?? "M02", "sign"]);
    for (let i = 1; i < len; i++) {
      if (!f) { plan.push([pickOld(), "mix"]); continue; }
      plan.push(i % 2 === 1 ? [f, i === 1 ? "use" : "mix"] : [pickOld(), "mix"]);
    }
  }
  // ---- every stage has its own big obstacle; every second stage Mayamma flies in mid-way
  const nv = r.alt ?? r.n;
  if (!r.calm && r.kind !== "boss" && nv >= 2) plan.splice(Math.max(1, Math.floor(plan.length / 3)), 0, ["SIG", "use"]);
  if (!r.calm && r.kind !== "boss" && nv >= 2 && nv % 2 === 0) plan.splice(Math.max(2, Math.floor(plan.length * 0.6)), 0, ["WITCH", "use"]);
  // ---- lay it out, with variety between sections (curves, slopes, scenery shapes) and checkpoints
  const checkEvery = Math.max(2, Math.ceil(plan.length / 3));
  plan.forEach(([c, m], i) => {
    if (i > 0 && i % checkEvery === 0) { const s = b.straight(14); b.add("lamp", s + 7, 0); b.checks.push(s + 7); }
    const sec = SECTIONS[c];
    if (sec) { sec(b, m === "show" ? "sign" : m); b.concepts.add(c); }
    // a quick hazard after calm stretches and in most joins (from stage 4 on; never in the world showcase)
    const busy = m !== "show" && m !== "sign" && r.n > 3;
    if (busy && CALM.has(c)) filler(b);
    if (busy && rng.chance(Math.min(0.9, 0.45 + r.d * 0.45))) { filler(b); if (rng.chance(Math.min(0.6, r.d * 0.5))) filler(b); }
    // a joining piece so no two stages read the same
    const j = rng.int(0, 5);
    if (j === 0) b.curve(rng.int(40, 70), 0.3 + rng.next() * 0.5);
    else if (j === 1) b.slope(rng.int(60, 100), rng.chance(0.5) ? 1 : -1, 0.08 + rng.next() * 0.08);
    else if (j === 2) b.straight(rng.int(16, 30));
    else b.curve(rng.int(30, 50), 0.15 + rng.next() * 0.3);
    // keep the road near its world: drops (plunges, dives) are climbed back before they stack up, so a stage never ends
    // up in a canyon hundreds of metres below the scenery (stage 474 used to finish 250 m under the sea)
    for (let k = 0; k < 4 && b.elev < 6; k++) b.slope(110, 1, 0.22);
    for (let k = 0; k < 4 && b.elev > 120; k++) b.slope(110, -1, 0.22);
  });
  // ---- nothing long and empty: quick hazards in the quiet stretches; then the treasure
  densify(b);
  treasure(b);
  let boss: BossSpec | undefined;
  if (r.kind === "boss") {
    boss = bossFor(r.world);
    // a long arena; the goal appears when the boss is beaten
    for (let i = 0; i < 12; i++) {
      // a lamp every few stretches, so running out of scales mid-fight doesn't send Rollo back kilometres
      if (i % 3 === 0) { const s = b.straight(14); b.add("lamp", s + 7, 0); b.checks.push(s + 7); }
      b.straight(rng.int(120, 180), { tag: "boss" }); b.curve(rng.int(60, 90), 0.2 + rng.next() * 0.2);
    }
  }
  if (b.target || r.focus.includes("Q03") || (r.remix && rng.chance(0.15))) {
    const pearls = b.objs.filter((o) => o.k === "pearl").length;
    b.target = Math.max(10, Math.round(pearls * (0.55 + r.d * 0.15)));
  }
  // ---- the goal
  const g = b.straight(60);
  if (b.target) b.add("pearlGate", g + 20, 0, 0, { p: b.target, w: b.width / 2 });
  b.add("goal", g + 40, 0);
  // hidden Moon Medals: three per stage, off the obvious line
  const spots = b.objs.filter((o) => o.k === "pearl" && Math.abs(o.u) > 1.5).map((o) => o.s);
  for (let i = 0; i < 3; i++) {
    const s = spots.length ? spots[Math.floor(((i + 0.5) / 3) * spots.length)] : (b.s * (i + 1)) / 4;
    b.add("medal", s + 1.3, -Math.sign(b.objs.find((o) => o.s >= s && o.k === "pearl")?.u ?? 1) * (b.width / 2 - 0.9), 1.0);
  }
  for (const c of r.focus) b.concepts.add(c);
  b.objs.sort((x, y) => x.s - y.s);
  // clocks are set from the finished length: generous for a clean run at Run speed
  const R = b.rules;
  if (R.time) R.time = Math.round((g + 40) / b.v * 1.3 + 10);
  if (R.sprint) { const last = b.checks.length ? b.checks[b.checks.length - 1] : 0; R.sprint = Math.round(((g + 40) - last) / b.v * 1.45 + 5); }
  if (R.survive) delete R.survive;
  const W2 = r.look.blend ? WORLDS[r.look.blend - 1] : null;
  return {
    n: r.n, seed: r.seed, world: r.world, stage: r.stage, kind: r.kind, d: r.d, name: r.name, meet: r.meet,
    concepts: [...b.concepts].filter((c) => CONCEPT[c]), remix: r.remix && W2 ? { ...r.remix } : r.remix,
    segs: b.segs, objs: b.objs, intents: b.intents.sort((x, y) => x.s - y.s), checks: b.checks, goal: g + 40,
    run: b.v, turbo: b.v * 1.45, target: b.target || undefined, boss, moves: b.moves,
    rules: Object.keys(R).length ? R : undefined, view: Object.keys(b.view).length ? b.view : undefined,
    chase: b.chase, rival: b.rival, gravity: b.gravity,
    look: { world: r.look.world, blend: r.look.blend, seed: hash32(r.seed, 3) },
    y0: r.y0 ?? 24, mode: r.mode, alt: r.alt,
  };
}
