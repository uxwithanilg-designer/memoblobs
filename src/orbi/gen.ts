// Orbi GP stage director. Journey stage n (1–500) teaches one idea: world w = ceil(n / 20), stage 1 of a world is its
// showcase, stage 20 its boss race, and stages 2–19 each teach the w-th idea of one family (the family order turns one
// step every world, so no two worlds share a rhythm). Every idea is built from the mechanics below — a small, tuned
// piece of road per mechanic — laid out sign → practice → mix, with joining curves and hills between, checkpoints,
// coins, gems, orbs, power capsules and three hidden stars. After stage 500 the Remix Grand Prix mixes 2–4 learned
// mechanics into new named courses forever, with a freshness memory so mixes never come back soon. A robot marble
// drives every stage before it is played; stages it cannot finish cleanly are rebuilt or trimmed.
import { hash32, Rng } from "../roll/rng";
import { CONCEPT, FAMILY_ORDER, type Family } from "./data/concepts";
import { JOURNEY, STAGES_PER_WORLD, WORLDS } from "./data/worlds";
import { IDEA2, IDEA_RULES, joiner, MECH2_LABEL, SECTIONS2, type IdeaRule, type Mech2 } from "./more";
import type { Intent, Obj, ObjKind, PowerKind, Seg, Stage, StageKind, StageRules, ZoneKind } from "./types";

// ---------------------------------------------------------------- difficulty
/** stage 1 → 0.15, 20 → 0.39, 50 → 0.67, 100 → 1.0, 200 → 1.3, 500 → 1.62, then a slow climb forever */
export const difficultyAt = (n: number) => 0.15 + 1.2 * (1 - Math.exp(-n / 90)) + 0.45 * Math.min(1, Math.max(0, (n - 200) / 600)) + Math.max(0, n - 800) * 0.0002;
/** cruising top speed (m/s): 113 km/h on stage 1 up to 160 km/h; boosts, pads and rocket boosters go to 350 */
export const vmaxAt = (d: number) => 30 + 9 * Math.min(1.6, d);
/** the road's usual width: wide early on, a narrow ribbon later */
export const widthAt = (d: number) => Math.max(4.6, 8.4 - 3 * Math.min(1.3, d));
/** a stage runs this long (s) for the robot — about 15 minutes for you */
export const STAGE_SECONDS = 820;

export type Mech = Mech1 | Mech2;
type Mech1 =
  | "runway" | "curves" | "banked" | "edges" | "hairpin" | "hills" | "dish" | "spiral" | "climb" | "downhill" | "twist" | "narrow" | "chicane"
  | "beam" | "planks" | "gap" | "padjump" | "kicker" | "drop" | "stones" | "islands" | "movers" | "bobbers" | "tiles" | "tramp"
  | "seesaw" | "tilt" | "log" | "wobble" | "bumpers" | "blocks" | "hammer" | "sweeper" | "pistons" | "lasers" | "spikes" | "lava"
  | "ice" | "sticky" | "sand" | "conveyor" | "arrows" | "vents" | "wind" | "lowg" | "heavyg" | "boostpads" | "orbs" | "capsules" | "gems";

const MECH1_LABEL: Record<Mech1, string> = {
  runway: "Runway", curves: "Curves", banked: "Banked Turns", edges: "No Rails", hairpin: "Hairpins", hills: "Roller Hills", dish: "Half-pipe",
  spiral: "Spiral", climb: "Climb", downhill: "Plunge", twist: "Twisted Road", narrow: "Narrow Road", chicane: "Chicane", beam: "Balance Beam",
  planks: "Plank Bridge", gap: "Gaps", padjump: "Jump Pads", kicker: "Kickers", drop: "Drops", stones: "Stepping Stones", islands: "Island Hops",
  movers: "Moving Platforms", bobbers: "Bobbing Platforms", tiles: "Falling Tiles", tramp: "Trampolines", seesaw: "Seesaws", tilt: "Rocking Plates",
  log: "Rolling Logs", wobble: "Wobble Bridge", bumpers: "Bumpers", blocks: "Sliding Blocks", hammer: "Hammers", sweeper: "Sweepers", pistons: "Pistons",
  lasers: "Lasers", spikes: "Pop-up Spikes", lava: "Lava", ice: "Ice", sticky: "Honey", sand: "Sand", conveyor: "Conveyors", arrows: "Speed Arrows",
  vents: "Updrafts", wind: "Wind", lowg: "Low Gravity", heavyg: "Heavy Gravity", boostpads: "Boost Pads", orbs: "Speed Orbs", capsules: "Power Capsules", gems: "Gem Lines",
};
export const MECH_LABEL: Record<Mech, string> = { ...MECH1_LABEL, ...MECH2_LABEL };

/** every family idea, by its place in the family (1–25), is built from a mechanic */
const FAM_MECH: Record<Exclude<Family, "W" | "K">, Mech[]> = {
  T: ["runway", "curves", "banked", "edges", "hairpin", "hills", "curves", "dish", "narrow", "spiral", "climb", "hills", "banked", "curves", "narrow", "chicane", "dish", "dish", "kicker", "spiral", "twist", "twist", "narrow", "edges", "twist"],
  J: ["gap", "padjump", "kicker", "stones", "drop", "tramp", "padjump", "islands", "movers", "bobbers", "tiles", "tramp", "padjump", "padjump", "tilt", "tiles", "padjump", "movers", "padjump", "tramp", "islands", "stones", "padjump", "padjump", "padjump"],
  B: ["narrow", "planks", "beam", "seesaw", "tilt", "wobble", "tilt", "log", "log", "tiles", "seesaw", "beam", "beam", "wobble", "tilt", "planks", "log", "wobble", "tiles", "movers", "log", "conveyor", "beam", "tilt", "beam"],
  H: ["bumpers", "blocks", "hammer", "sweeper", "pistons", "pistons", "bumpers", "bumpers", "hammer", "blocks", "spikes", "sweeper", "pistons", "spikes", "hammer", "sweeper", "pistons", "bumpers", "bumpers", "sweeper", "lasers", "tiles", "hammer", "sweeper", "hammer"],
  F: ["arrows", "sand", "ice", "sticky", "tramp", "conveyor", "conveyor", "sand", "sticky", "ice", "tiles", "tiles", "heavyg", "sand", "sticky", "ice", "tiles", "lasers", "boostpads", "tiles", "lava", "bumpers", "conveyor", "wind", "ice"],
  A: ["vents", "wind", "lowg", "vents", "vents", "heavyg", "lowg", "conveyor", "wind", "wind", "lowg", "boostpads", "banked", "lowg", "wind", "spiral", "padjump", "lowg", "conveyor", "movers", "hills", "lowg", "padjump", "downhill", "wind"],
  M: ["runway", "bobbers", "dish", "padjump", "movers", "lasers", "bobbers", "bobbers", "movers", "conveyor", "spiral", "sweeper", "log", "log", "padjump", "bobbers", "curves", "vents", "log", "hammer", "sweeper", "chicane", "padjump", "blocks", "hammer"],
  N: ["wind", "sticky", "conveyor", "vents", "stones", "edges", "ice", "sand", "sand", "lava", "movers", "islands", "vents", "edges", "tramp", "conveyor", "wind", "edges", "arrows", "lowg", "wind", "lasers", "wind", "padjump", "ice"],
  D: ["edges", "sticky", "blocks", "blocks", "spikes", "spikes", "lasers", "tiles", "sticky", "lava", "hammer", "blocks", "sweeper", "sticky", "sticky", "bumpers", "spikes", "spikes", "lasers", "spikes", "blocks", "lasers", "lava", "blocks", "hammer"],
  S: ["boostpads", "downhill", "climb", "runway", "orbs", "orbs", "padjump", "hairpin", "arrows", "boostpads", "edges", "banked", "dish", "boostpads", "sand", "boostpads", "boostpads", "padjump", "arrows", "downhill", "dish", "arrows", "dish", "boostpads", "arrows"],
  R: ["runway", "curves", "bumpers", "chicane", "hills", "edges", "boostpads", "banked", "narrow", "curves", "hills", "downhill", "chicane", "runway", "banked", "arrows", "boostpads", "hairpin", "curves", "narrow", "sticky", "banked", "edges", "spiral", "hairpin"],
  P: Array(25).fill("capsules") as Mech[],
  C: ["runway", "gems", "capsules", "orbs", "gems", "capsules", "padjump", "gems", "orbs", "edges", "gems", "orbs", "islands", "runway", "gems", "edges", "capsules", "gems", "curves", "gems", "islands", "orbs", "gems", "capsules", "gems"],
  Q: ["runway", "curves", "boostpads", "gems", "edges", "padjump", "gems", "chicane", "curves", "curves", "beam", "narrow", "capsules", "narrow", "heavyg", "lasers", "sand", "padjump", "boostpads", "narrow", "tiles", "curves", "hairpin", "boostpads", "edges"],
  V: ["runway", "curves", "spiral", "edges", "padjump", "lasers", "chicane", "banked", "edges", "tiles", "twist", "arrows", "lasers", "lasers", "dish", "curves", "downhill", "hills", "spiral", "padjump", "narrow", "edges", "twist", "narrow", "twist"],
  X: ["padjump", "kicker", "hills", "bumpers", "beam", "banked", "hills", "padjump", "kicker", "tramp", "padjump", "tramp", "padjump", "chicane", "hairpin", "padjump", "kicker", "padjump", "tramp", "kicker", "tramp", "padjump", "edges", "padjump", "tramp"],
  E: ["runway", "downhill", "conveyor", "blocks", "movers", "spikes", "bumpers", "downhill", "sand", "lava", "tiles", "padjump", "hammer", "spiral", "tramp", "islands", "wind", "conveyor", "downhill", "lowg", "padjump", "tiles", "padjump", "hills", "hammer"],
  Y: ["boostpads", "tiles", "lasers", "gems", "padjump", "tiles", "hammer", "arrows", "edges", "boostpads", "edges", "lasers", "planks", "bobbers", "spikes", "vents", "padjump", "curves", "sweeper", "lowg", "lasers", "tramp", "bumpers", "tiles", "boostpads"],
};
/** ideas whose own name fits what is built (the rest show the mechanic: their own pieces come in later phases) */
const EXACT = new Set<string>([
  "T01", "T02", "T03", "T04", "T05", "T06", "T08", "T09", "T10", "T11", "T15", "T16", "T19", "T21", "T24",
  "J01", "J02", "J03", "J04", "J05", "J06", "J07", "J08", "J09", "J10", "J11", "J12", "J16", "J19", "J22",
  "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B12", "B13", "B14", "B23",
  "H01", "H02", "H03", "H04", "H05", "H06", "H09", "H11", "H12", "H14", "H15", "H16", "H23",
  "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10", "F11", "F12", "F15", "F16", "F17", "F21",
  "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A09", "A19",
  "M02", "M07", "M08", "M12", "M14", "M16", "M19",
  "N01", "N02", "N03", "N05", "N08", "N10", "N12", "N13", "N15", "N16", "N17", "N20",
  "D01", "D02", "D05", "D06", "D07", "D08", "D09", "D10", "D13", "D20",
  "S01", "S02", "S03", "S04", "S05", "S06", "S08", "S09", "S10", "S12", "S14", "S16", "S17", "S20", "S22", "S24",
  "R01", "R02", "R03", "R04", "R05", "R08", "R14", "R16", "R24",
  "P01", "P02", "P03", "P04", "P05", "P07", "P08", "P12", "P23",
  "C01", "C02", "C04", "C06", "C07", "C12",
  "Q01", "Q02", "Q03", "Q05", "Q08", "Q11", "Q24", "Q25",
  "X01", "X03", "X12", "X16", "X17",
  "E01", "E03", "E08", "E10", "E15", "E16", "E19", "E20", "E24",
  "Y01", "Y02", "Y07", "Y13",
]);
/** the powers, and the world that first hands each one out (the P family teaches one power per world) */
const POWER_WORLD: [PowerKind, number][] = [["turbo", 1], ["magnet", 2], ["shield", 3], ["jump", 4], ["giant", 5], ["feather", 8], ["bridge", 12], ["star", 23]];

export function mechOf(id: string): Mech {
  const f = id[0] as Family, k = parseInt(id.slice(1), 10) - 1;
  if (f === "W" || f === "K") return "runway";
  return IDEA2[id]?.[0] ?? FAM_MECH[f][Math.max(0, Math.min(24, k))];
}
/** the look or detail an idea's piece uses (a cannon or a catapult, rain or fog…) */
export const variantOf = (id: string) => IDEA2[id]?.[1] ?? "";
/** does the idea have a piece (or a rule) of its own? (the rest borrow the closest mechanic) */
export const isExact = (id: string) => EXACT.has(id) || id in IDEA2 || id in IDEA_RULES || id[0] === "W" || id[0] === "K";
/** mechanics the director never mixes in by chance (camera twists stay with their own ideas) */
const NO_MIX = new Set<Mech>(["view", "limit", "speedtrap", "paint", "glass"]);
/** every mechanic that journey stage n has taught (or the whole set after the journey) */
export function knownMechs(n: number): Mech[] {
  const out = new Set<Mech>(["runway", "curves"]);
  const upto = Math.min(n, JOURNEY);
  for (let i = 1; i <= upto; i++) { const c = conceptAt(i); if (c[0] !== "W" && c[0] !== "K") out.add(mechOf(c)); }
  return [...out];
}

/** the idea journey stage n teaches */
export function conceptAt(n: number): string {
  const w = Math.ceil(n / STAGES_PER_WORLD), s = ((n - 1) % STAGES_PER_WORLD) + 1;
  if (s === 1) return `W${String(w).padStart(2, "0")}`;
  if (s === STAGES_PER_WORLD) return `K${String(w).padStart(2, "0")}`;
  const fam = FAMILY_ORDER[(s - 2 + (w - 1)) % FAMILY_ORDER.length];
  return `${fam}${String(w).padStart(2, "0")}`;
}

export interface Recipe {
  n: number; seed: number; world: number; stage: number; kind: StageKind; d: number; name: string;
  meet?: string; focus: Mech[]; known: Mech[];
  /** the focus piece's variant, a rule idea's extras */
  variant?: string; extra?: IdeaRule;
  /** a mode's fixed section count */
  sections?: number;
  remix?: { key: string; atoms: Mech[] };
  look: { world: number; blend?: number };
  rules: StageRules;
  y0?: number;
}
export interface RemixMemory { recent: string[]; seen: string[] }
/** a mode's course: its difficulty, how many sections, a world look (Endless, Daily Cup, Knockout Royale) */
export interface CourseOpts { d?: number; sections?: number; world?: number; collapse?: boolean }

const RHYTHM: StageKind[] = ["learn", "learn", "mix", "learn", "breather", "learn", "learn", "mix", "burner", "learn"];
const KIND_D: Record<StageKind, number> = { opener: -0.08, learn: 0, mix: 0.04, breather: -0.1, burner: 0.14, boss: 0.1, remix: 0 };

export function recipeFor(n: number, salt: number, mem: RemixMemory = { recent: [], seen: [] }, opts?: CourseOpts): Recipe {
  const seed = hash32(n, salt, 0x0b1);
  const rng = new Rng(seed);
  if (n <= JOURNEY) {
    const world = Math.ceil(n / STAGES_PER_WORLD), stage = ((n - 1) % STAGES_PER_WORLD) + 1;
    const meet = conceptAt(n);
    const kind: StageKind = stage === 1 ? "opener" : stage === STAGES_PER_WORLD ? "boss" : RHYTHM[(stage - 2) % RHYTHM.length];
    const d = Math.max(0.05, difficultyAt(n) + KIND_D[kind]);
    const c = CONCEPT[meet];
    const mech = mechOf(meet);
    const name = kind === "opener" ? WORLDS[world - 1].name : kind === "boss" ? `Kranky: ${c?.name ?? "Boss"}` : isExact(meet) ? c?.name ?? MECH_LABEL[mech] : MECH_LABEL[mech];
    // only a win (1st place) opens the next stage
    let rules: StageRules = { win: true };
    if (meet === "Q05" || meet === "Q11") rules.noFall = true;
    if (meet === "Q08" || meet === "Q25" || kind === "boss") rules.win = true;
    if (kind === "boss") rules.cores = 3;
    const extra = IDEA_RULES[meet];
    if (extra?.rules) rules = { ...rules, ...extra.rules, win: true, podium: false };
    return { n, seed, world, stage, kind, d, name, meet, focus: kind === "opener" || kind === "boss" ? [] : [mech], known: knownMechs(n), look: { world }, rules, variant: variantOf(meet), extra };
  }
  // ---- the Remix Grand Prix: 2–4 mechanics, a blended look, the freshest mix wins
  const pool = knownMechs(JOURNEY).filter((m) => !["runway", "orbs", "gems", "capsules"].includes(m) && !NO_MIX.has(m));
  const depth = n - JOURNEY;
  const k = depth < 20 ? 2 : depth < 120 ? rng.int(2, 3) : rng.int(2, 4);
  const recent = new Set(mem.recent), seen = new Set(mem.seen);
  let best: Mech[] = [], bestScore = -Infinity;
  for (let t = 0; t < 30; t++) {
    const a = pool.slice(), atoms: Mech[] = [];
    while (atoms.length < k && a.length) atoms.push(a.splice(rng.int(0, a.length - 1), 1)[0]);
    const key = atoms.slice().sort().join("+");
    const score = -atoms.filter((x) => recent.has(x)).length * 3 - (seen.has(key) ? 6 : 0) + rng.next();
    if (score > bestScore) { bestScore = score; best = atoms; }
  }
  const w1 = opts?.world ?? 1 + (Math.floor(depth / 5) % WORLDS.length), w2 = 1 + ((w1 + rng.int(2, 9)) % WORLDS.length);
  const kind: StageKind = opts ? "remix" : depth % 10 === 9 ? "burner" : depth % 10 === 4 ? "breather" : "remix";
  const d = opts?.d ?? difficultyAt(n) + KIND_D[kind] + Math.sin(depth * 1.3) * 0.05;
  const name = `${best.slice(0, 2).map((m) => MECH_LABEL[m].replace(/^The /, "").split(" ")[0]).join(" ")} ${["Rally", "Rush", "Run", "Cup", "Dash", "Sprint", "Derby", "Grand Prix"][rng.int(0, 7)]}`;
  return {
    n, seed, world: w1, stage: 0, kind, d, name, focus: opts?.collapse ? ["collapse", ...best] : best, known: knownMechs(JOURNEY),
    remix: { key: best.slice().sort().join("+"), atoms: best }, look: { world: w1, blend: w2 }, rules: opts ? { podium: true } : { win: true },
    sections: opts?.sections,
  };
}

// ---------------------------------------------------------------- the builder
export type Mode = "sign" | "use" | "mix";
export class B {
  segs: Seg[] = []; objs: Obj[] = []; intents: Intent[] = []; checks: number[] = [];
  s = 0; id = 1; elev = 0;
  /** where the road points (radians of turn so far): turns lean back toward the start heading, so a long course
   *  never curls round onto itself */
  heading = 0;
  rng: Rng; r: Recipe;
  width: number; rails: boolean; v: number;
  lastCheck = 0;
  /** the piece's variant (set before each section) and the music's beat (s) */
  vr = ""; beat: number;
  /** metres between checkpoints */
  every = 180;
  constructor(r: Recipe, rng: Rng) {
    this.r = r; this.rng = rng;
    this.width = widthAt(r.d); this.v = vmaxAt(r.d);
    this.rails = true;
    this.beat = beatOf(r.n, r.look.world);
  }
  get hw() { return this.width / 2; }
  /** the edge where a marble's centre can be */
  get free() { return this.width / 2 - 0.9; }
  seg(len: number, o: Partial<Seg> = {}) {
    const g: Seg = { len, yaw: 0, pitch: 0, width: this.width, railL: this.rails, railR: this.rails, floor: "road", ...o };
    this.segs.push(g); this.heading += g.yaw;
    const a = this.s; this.s += len;
    this.elev += Math.sin(g.pitch / 2) * len;
    return a;
  }
  straight(len: number, o: Partial<Seg> = {}) { return this.seg(len, o); }
  curve(len: number, yaw: number, o: Partial<Seg> = {}) { return this.seg(len, { yaw, ...o }); }
  /** a slope that ends level again (net height change ≈ L·sin(a)·0.75) */
  ramp(len: number, a: number, o: Partial<Seg> = {}) {
    const s0 = this.s;
    this.seg(len * 0.25, { pitch: a, ...o }); this.seg(len * 0.5, o); this.seg(len * 0.25, { pitch: -a, ...o });
    this.elev += Math.sin(a) * len * 0.5;
    return s0;
  }
  gap(len: number, o: Partial<Seg> = {}) { return this.seg(len, { floor: "gap", railL: false, railR: false, ...o }); }
  add(k: ObjKind, s: number, u: number, o: Partial<Obj> = {}) { const ob: Obj = { id: this.id++, k, s, u, ...o }; this.objs.push(ob); return ob; }
  intent(i: Intent) { this.intents.push(i); }
  steer(s0: number, s1: number, u: number, slow?: number) { this.intents.push({ s: s0, until: s1, u, slow }); }
  coins(s0: number, s1: number, u0 = 0, u1 = u0, step = 3.2, h = 0.6) {
    const n = Math.max(1, Math.floor((s1 - s0) / step));
    for (let i = 0; i <= n; i++) { const k = i / n; this.add("coin", s0 + (s1 - s0) * k, u0 + (u1 - u0) * k, { h, w: 0.5 }); }
  }
  /** coins along a jump arc (launch speed vh, rolling speed v) */
  arc(s0: number, u: number, vh: number, v = this.v * 0.95, n = 6) {
    const T = (2 * vh) / 26;
    for (let i = 1; i < n; i++) { const t = (T * i) / n; this.add("coin", s0 + v * t, u, { h: 0.6 + vh * t - 13 * t * t, w: 0.5 }); }
  }
  lane() { return this.rng.pick([-1, 0, 1]) * this.free * 0.6; }
  /** a speed hint as a share of top speed, for a real speed (m/s): technical bits stay as slow at 160 km/h as at 110 */
  at(v: number) { return clamp(v / this.v, 0.3, 1); }
  /** a turn direction (−1 / 1) that leans back toward the start heading */
  dir() { const h = this.heading; return Math.abs(h) < 0.7 ? this.rng.sign() : this.rng.chance(0.85) ? -Math.sign(h) : Math.sign(h); }
  /** a checkpoint gate here (on solid road) when the last one is far enough back */
  check(force = false) {
    if (!force && this.s - this.lastCheck < this.every) return;
    const s = this.straight(10);
    this.add("check", s + 5, 0, { w: this.hw });
    this.checks.push(s + 5); this.lastCheck = s + 5;
  }
  /** how far a pad jump flies at full speed */
  flight(vh: number) { return this.v * 0.95 * ((2 * vh) / 26); }
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** the beat of stage n's music (the session plays the world's tempo, nudged per stage) */
export function beatOf(n: number, world: number) { return 60 / (WORLDS[world - 1].music.bpm + ((n * 5) % 9) - 4); }

// ---------------------------------------------------------------- the mechanics
const SECTIONS1: Record<Mech1, (b: B, m: Mode) => void> = {
  runway: (b) => { const a = b.straight(70); b.coins(a + 8, a + 62, -b.free * 0.5, b.free * 0.5); },
  curves: (b, m) => {
    const n = m === "sign" ? 2 : 3;
    for (let i = 0; i < n; i++) { const dir = i % 2 ? 1 : -1, a = b.curve(55, dir * (0.5 + b.r.d * 0.25)); b.coins(a + 6, a + 50, dir * b.free * 0.4); }
  },
  banked: (b, m) => { const dir = b.dir(); const a = b.curve(m === "sign" ? 80 : 70, dir * (1.1 + b.r.d * 0.3)); b.coins(a + 8, a + 70, dir * b.free * 0.6, dir * b.free * 0.6); b.straight(20); },
  edges: (b, m) => {
    const was = b.rails; b.rails = false;
    const dir = b.dir();
    const a = b.straight(30); b.curve(50, dir * (0.5 + b.r.d * 0.2)); b.curve(50, -dir * (0.5 + b.r.d * 0.2)); if (m !== "sign") b.curve(40, dir * 0.4);
    b.coins(a + 5, b.s - 5, 0, 0, 4);
    b.add("gem", a + 20, dir * b.free * 0.95, { h: 0.6, w: 0.5 });
    b.rails = was;
  },
  hairpin: (b, m) => {
    const dir = b.dir(), a = b.straight(20);
    b.curve(m === "sign" ? 60 : 46, dir * Math.PI * 0.95, { railL: true, railR: true });
    b.steer(a, a + 20, 0, 0.62); b.steer(a + 20, b.s, -dir * b.free * 0.3, 0.62);
    b.straight(20);
  },
  hills: (b, m) => {
    const n = m === "sign" ? 3 : 5, a0 = b.s;
    for (let i = 0; i < n; i++) { b.seg(10, { pitch: 0.22 }); b.seg(16, { pitch: -0.44 }); b.seg(10, { pitch: 0.22 }); }
    b.coins(a0 + 4, b.s - 4, 0, 0, 3, 1.2);
  },
  dish: (b) => { const a = b.straight(80, { crown: -0.35, railL: true, railR: true, width: b.width + 2 }); for (let i = 0; i < 4; i++) b.add("coin", a + 14 + i * 16, (i % 2 ? 1 : -1) * (b.hw + 0.4), { h: 0.9, w: 0.5 }); },
  spiral: (b, m) => {
    // a helix: four quarter turns, each one a little lower (or higher) than the last
    const dir = b.dir(), down = b.elev > -60 || m === "sign" ? -1 : 1, a = b.s;
    for (let q = 0; q < (m === "sign" ? 3 : 4); q++) {
      b.seg(8, { pitch: down * 0.14, railL: true, railR: true });
      b.curve(34, dir * Math.PI / 2, { railL: true, railR: true });
      b.seg(8, { pitch: -down * 0.14, railL: true, railR: true });
    }
    b.coins(a + 10, b.s - 10, dir * b.free * 0.5, dir * b.free * 0.5, 5);
  },
  climb: (b) => { const a = b.ramp(110, 0.2); b.coins(a + 10, a + 100, 0, 0, 5); b.add("orb", a + 60, b.lane(), { h: 0.7, w: 0.7 }); },
  downhill: (b) => { const a = b.ramp(120, -0.24); b.coins(a + 10, a + 110, -b.free * 0.4, b.free * 0.4, 4); b.add("boost", a + 40, 0, { ds: 1.4, w: b.hw }); },
  twist: (b) => { const a = b.straight(15); b.seg(35, { twist: 0.5, railL: true, railR: true }); b.seg(20, { railL: true, railR: true }); b.seg(35, { twist: -0.5, railL: true, railR: true }); b.coins(a + 18, a + 95, b.free * 0.5, b.free * 0.5, 4); },
  narrow: (b, m) => {
    const w0 = b.width, a = b.s;
    const w = m === "sign" ? 4.6 : clamp(4.4 - b.r.d * 1.2, 2.8, 4.4);
    b.straight(14, { width: (w0 + w) / 2 }); b.straight(m === "sign" ? 40 : 60, { width: w, railL: false, railR: false }); b.straight(10);
    b.coins(a + 16, a + 70, 0, 0, 4);
  },
  chicane: (b) => {
    const a = b.straight(80);
    for (let i = 0; i < 4; i++) { const u = (i % 2 ? 1 : -1) * b.free * 0.45; b.add("bumper", a + 14 + i * 16, u, { w: 0.7, tall: 1.2, p: 4 }); b.steer(a + 6 + i * 16, a + 22 + i * 16, -u * 0.9); }
  },
  beam: (b, m) => {
    const len = m === "sign" ? 34 : clamp(40 + b.r.d * 30, 40, 80), w = m === "sign" ? 2.2 : clamp(2 - b.r.d * 0.4, 1.4, 2);
    b.straight(8, { width: Math.min(b.width, 4) });
    const a = b.straight(len, { width: w, railL: false, railR: false, crown: 0.45, look: "beam" });
    b.straight(10);
    b.steer(a - 8, a + len, 0, 0.75);
    b.coins(a + 4, a + len - 4, 0, 0, 4);
  },
  planks: (b, m) => {
    const n = m === "sign" ? 5 : 8, gap = m === "sign" ? 0.9 : clamp(1 + b.r.d * 0.6, 1, 1.8);
    const a = b.s;
    for (let i = 0; i < n; i++) { b.straight(3.4, { look: "plank", width: Math.min(b.width, 5) }); b.gap(gap); }
    b.straight(8);
    b.steer(a - 6, b.s, 0, 0.85);
    b.coins(a + 2, b.s - 6, 0, 0, 3.6);
  },
  gap: (b, m) => {
    const n = m === "sign" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const a = b.straight(18), g = m === "sign" ? 2.4 : clamp(2.6 + b.r.d * 1.6, 2.6, 4.2);
      b.gap(g); b.straight(14);
      b.steer(a, a + 32, 0, 1); b.coins(a + 4, a + 30, 0, 0, 3.5, 0.9);
    }
  },
  padjump: (b, m) => {
    const n = m === "sign" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const vh = 11 + b.r.d * 1.5, a = b.straight(20), fl = b.flight(vh);
      const u = m === "mix" ? b.lane() : 0;
      b.add("pad", a + 18.2, u, { ds: 1.2, w: 1.6, p: vh });
      b.gap(fl * 0.62);
      b.straight(16);
      b.steer(a, a + 19, u, 1); b.arc(a + 18, u, vh);
    }
  },
  kicker: (b) => {
    const vh = 10.5 + b.r.d, a = b.straight(14), fl = b.flight(vh);
    b.seg(8, { pitch: 0.3, look: "kicker" });
    b.add("pad", b.s - 1, 0, { ds: 1, w: b.hw, p: vh, look: "lip" });
    b.gap(fl * 0.62, { pitch: -0.3 });
    b.straight(14);
    b.steer(a, a + 24, 0, 1); b.arc(b.s - 14 - fl * 0.62, 0, vh);
  },
  drop: (b) => {
    const a = b.straight(14);
    b.gap(6, { pitch: -0.55 }); b.gap(5, { pitch: 0.55 });
    b.straight(16);
    b.steer(a, a + 30, 0, 0.9); b.coins(a + 15, a + 30, 0, 0, 3, 0.8);
  },
  stones: (b, m) => {
    // the stones sit close enough to roll from one to the next (a gap of 1.4–2.2 m)
    const n = m === "sign" ? 4 : 6, R = m === "sign" ? 1.9 : clamp(1.8 - b.r.d * 0.3, 1.3, 1.8), step = 2 * R + clamp(1.4 + b.r.d * 0.6, 1.4, 2.2);
    const a = b.straight(10), g0 = b.s;
    b.gap(step * n + 2);
    let u = 0;
    for (let i = 0; i < n; i++) {
      u = m === "sign" ? 0 : clamp(u + b.rng.pick([-1.4, 0, 1.4]), -b.free * 0.6, b.free * 0.6);
      const s = g0 + 2 + step * i + step / 2;
      b.add("plat", s, u, { ds: R, w: R, look: "stone" });
      b.steer(s - step / 2, s + step / 2, u, 0.78);
      b.add("coin", s, u, { h: 0.6, w: 0.5 });
    }
    b.steer(a, g0, 0, 0.8);
    b.straight(12);
  },
  islands: (b, m) => {
    const n = m === "sign" ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const vh = 11, a = b.straight(16), fl = b.flight(vh);
      b.add("pad", a + 14.2, 0, { ds: 1.2, w: 1.8, p: vh });
      const g0 = b.gap(fl * 0.62);
      b.straight(18, { look: "island", width: b.width + 2 });
      b.steer(a, a + 15, 0, 1); b.arc(a + 14, 0, vh);
      void g0;
    }
  },
  movers: (b, m) => {
    const n = m === "sign" ? 2 : 3, L = 7, amp = clamp(1.6 + b.r.d * 1.2, 1.6, 3), P = clamp(4.4 - b.r.d * 1.2, 2.8, 4.4);
    const a = b.straight(10), g0 = b.s;
    b.gap(n * (L + 0.6) + 0.6);
    for (let i = 0; i < n; i++) {
      const s = g0 + 0.6 + i * (L + 0.6) + L / 2;
      const o = b.add("plat", s, 0, { ds: L / 2, w: 1.7, mov: { ax: "u", amp, period: P, phase: i * 1.1 }, look: "mover" });
      b.intent({ s: s - L / 2 - 4, until: s + L / 2, follow: o.id, slow: 0.62 });
    }
    b.steer(a, g0 - 3, 0, 0.62);
    b.straight(10);
  },
  bobbers: (b, m) => {
    const n = m === "sign" ? 3 : 4, L = 5;
    const a = b.straight(8), g0 = b.s;
    b.gap(n * (L + 0.8) + 0.8);
    for (let i = 0; i < n; i++) {
      const s = g0 + 0.8 + i * (L + 0.8) + L / 2;
      b.add("plat", s, 0, { ds: L / 2, w: 2.2, h: -0.5, mov: { ax: "h", amp: 0.5, period: 2.2, phase: i * 1.4 }, look: "bobber" });
    }
    b.steer(a, b.s, 0, 0.8);
    b.straight(10);
  },
  tiles: (b, m) => {
    const n = m === "sign" ? 6 : 9, L = 3.1;
    b.straight(8);
    const g0 = b.s;
    b.gap(n * L + 0.4);
    let u = 0;
    for (let i = 0; i < n; i++) {
      if (m !== "sign" && i % 3 === 2) u = clamp(u + b.rng.pick([-1.6, 1.6]), -b.free * 0.5, b.free * 0.5);
      const s = g0 + 0.2 + i * L + L / 2;
      b.add("tile", s, u, { ds: L / 2 - 0.08, w: 1.6, fall: clamp(0.6 - b.r.d * 0.15, 0.32, 0.6), look: "tile" });
      b.steer(s - L, s + L / 2, u, 0.9);
    }
    b.straight(10);
    b.coins(g0 + 2, g0 + n * L - 2, 0, 0, 3.1, 0.7);
  },
  tramp: (b, m) => {
    const n = m === "sign" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const a = b.straight(16), vh = 13, fl = b.v * 0.9 * ((2 * vh) / 26);
      b.add("tramp", a + 14.2, 0, { ds: 1.2, w: 1.8, p: vh });
      b.gap(fl * 0.62);
      b.straight(16);
      b.steer(a, a + 15, 0, 0.92); b.arc(a + 14, 0, vh, b.v * 0.9);
    }
  },
  seesaw: (b, m) => {
    const L = m === "sign" ? 12 : 14;
    const a = b.straight(8), g0 = b.s;
    b.gap(L + 1);
    b.add("seesaw", g0 + 0.5 + L / 2, 0, { ds: L / 2, w: 2.3, look: "seesaw" });
    b.straight(10);
    b.steer(a, b.s, 0, 0.72);
    b.coins(g0 + 2, g0 + L - 1, 0, 0, 3, 0.7);
  },
  tilt: (b, m) => {
    const n = m === "sign" ? 1 : 2, L = 12;
    const a = b.straight(8), g0 = b.s;
    b.gap(n * (L + 0.8) + 0.4);
    for (let i = 0; i < n; i++) b.add("tilt", g0 + 0.6 + i * (L + 0.8) + L / 2, 0, { ds: L / 2, w: 2.6, mov: { ax: "spin", amp: clamp(0.14 + b.r.d * 0.08, 0.14, 0.26), period: 3.2, phase: i * 1.7 }, look: "tilt" });
    b.straight(10);
    b.steer(a, b.s, 0, 0.75);
  },
  log: (b, m) => {
    const L = m === "sign" ? 14 : 20;
    const a = b.straight(8), g0 = b.s;
    b.gap(L + 1);
    b.add("log", g0 + 0.5 + L / 2, 0, { ds: L / 2, w: 1.25, p: b.rng.pick([-3, 3]), look: "log" });
    b.straight(10);
    b.steer(a, b.s, 0, 0.72);
  },
  wobble: (b) => {
    const L = 30, a = b.straight(8), g0 = b.s;
    b.gap(L + 1);
    b.add("tilt", g0 + 0.5 + L / 2, 0, { ds: L / 2, w: 2.2, mov: { ax: "spin", amp: 0.16, period: 2.6, phase: 0 }, look: "rope" });
    b.straight(10);
    b.steer(a, b.s, 0, 0.75);
  },
  bumpers: (b, m) => {
    const a = b.straight(m === "sign" ? 50 : 80, { railL: true, railR: true }), rows = m === "sign" ? 2 : 4;
    for (let r = 0; r < rows; r++) {
      const s = a + 14 + r * 16, k = r % 2;
      for (const u of k ? [-b.free * 0.5, b.free * 0.5] : [0]) b.add("bumper", s, u, { w: 0.8, tall: 1.4, p: 4 });
    }
    b.coins(a + 6, a + 70, -b.free * 0.7, -b.free * 0.7, 6);
  },
  blocks: (b, m) => {
    const n = m === "sign" ? 2 : 3, a = b.straight(30 + n * 18);
    for (let i = 0; i < n; i++) b.add("block", a + 16 + i * 18, 0, { ds: 0.9, w: 1.1, tall: 1.4, mov: { ax: "u", amp: b.free * 0.85, period: clamp(3.4 - b.r.d * 0.8, 2.2, 3.4), phase: i * 2.1 }, look: "block" });
  },
  hammer: (b, m) => {
    const n = m === "sign" ? 1 : 2, a = b.straight(26 + n * 22);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, amp = b.free * 0.55;
      b.add("hammer", a + 16 + i * 22, side * amp * 0.2, { ds: 0.9, w: 1.3, tall: 2.6, p: 11, mov: { ax: "u", amp, period: 2.6, phase: i * 1.6 }, look: "hammer" });
    }
  },
  sweeper: (b) => {
    const w0 = b.width; b.width = Math.max(w0, 11);
    const a = b.straight(40, { railL: true, railR: true });
    b.add("sweeper", a + 20, 0, { p: 3.6, tall: 1.2, mov: { ax: "spin", amp: 0, period: clamp(3.6 - b.r.d * 0.6, 2.6, 3.6), phase: 0 }, look: "sweeper" });
    const side = b.dir();
    b.steer(a, a + 40, side * (b.hw - 1.0), 0.85);
    b.width = w0; b.straight(10);
  },
  pistons: (b) => {
    const a = b.straight(70);
    for (let i = 0; i < 3; i++) { const side = i % 2 ? 1 : -1; b.add("block", a + 15 + i * 18, side * (b.hw - 1.2), { ds: 1, w: 1.4, tall: 1.4, mov: { ax: "u", amp: b.hw * 0.45, period: 2.4, phase: i * 1.3 }, look: "piston" }); }
  },
  lasers: (b, m) => {
    const n = m === "sign" ? 2 : 4, a = b.straight(26 + n * 16);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      b.add("laser", a + 14 + i * 16, side * b.hw * 0.5, { ds: 0.25, w: b.hw * 0.5, tall: 1.6, blink: [2.4, i * 0.6], look: "laser" });
      b.steer(a + 4 + i * 16, a + 18 + i * 16, -side * b.free * 0.6);
    }
  },
  spikes: (b, m) => {
    const n = m === "sign" ? 2 : 4, a = b.straight(24 + n * 16);
    for (let i = 0; i < n; i++) {
      const u = b.dir() * b.free * 0.5;
      b.add("spikes", a + 12 + i * 16, u, { ds: 1.2, w: b.free * 0.45, tall: 0.9, blink: [2, i * 0.7], look: "spikes" });
      b.steer(a + 2 + i * 16, a + 16 + i * 16, -u);
    }
  },
  lava: (b) => {
    const a = b.straight(90);
    const side = b.dir();
    b.add("zone", a + 22, side * b.hw * 0.45, { ds: 12, w: b.hw * 0.5, zone: "lava" });
    b.add("zone", a + 64, -side * b.hw * 0.45, { ds: 12, w: b.hw * 0.5, zone: "lava" });
    b.steer(a, a + 41, -side * b.free * 0.6, 0.9); b.steer(a + 41, a + 90, side * b.free * 0.6, 0.9);
  },
  ice: (b) => { const dir = b.dir(); const a = b.curve(70, dir * 0.7, { railL: true, railR: true }); b.add("zone", a + 35, 0, { ds: 35, w: b.hw, zone: "ice" }); b.steer(a, a + 70, 0, 0.8); },
  sticky: (b) => { const a = b.straight(60); b.add("zone", a + 30, b.hw * 0.4, { ds: 22, w: b.hw * 0.6, zone: "sticky" }); b.steer(a, a + 60, -b.free * 0.6); },
  sand: (b) => { const a = b.straight(70); b.add("zone", a + 35, 0, { ds: 28, w: b.hw, zone: "sand" }); b.coins(a + 10, a + 60, 0, 0, 5); },
  conveyor: (b, m) => {
    const a = b.straight(60);
    b.add("zone", a + 30, 0, { ds: 26, w: b.hw, zone: "conveyor", p: m === "sign" ? 8 : b.rng.pick([8, -6]) });
  },
  arrows: (b) => { const a = b.straight(60); b.add("zone", a + 30, 0, { ds: 24, w: b.hw * 0.5, zone: "speed" }); b.coins(a + 8, a + 54, 0, 0, 4); },
  vents: (b) => {
    const a = b.straight(14), g = clamp(14 + b.r.d * 8, 14, 24);
    b.gap(g);
    b.add("zone", a + 14 + g / 2, 0, { ds: g / 2 + 4, w: b.hw, zone: "vent", p: 34 });
    b.straight(14);
    b.steer(a, b.s, 0, 0.85);
    b.coins(a + 16, a + 12 + g, 0, 0, 3, 2.5);
  },
  wind: (b) => {
    const side = b.dir(), a = b.straight(70, side > 0 ? { railR: false } : { railL: false });
    b.add("zone", a + 35, 0, { ds: 30, w: b.hw, zone: "wind", p: side * clamp(5 + b.r.d * 3, 5, 9) });
    b.steer(a, a + 70, -side * b.free * 0.5);
  },
  lowg: (b) => {
    const a = b.straight(20), vh = 9, fl = b.flight(vh) * 2;
    b.add("zone", a + 10 + fl / 2, 0, { ds: fl / 2 + 16, w: b.hw + 4, zone: "lowg" });
    b.add("pad", a + 18.2, 0, { ds: 1.2, w: 1.8, p: vh });
    b.gap(fl * 0.62);
    b.straight(18);
    b.steer(a, b.s, 0, 1);
  },
  heavyg: (b) => { const a = b.straight(70); b.add("zone", a + 35, 0, { ds: 30, w: b.hw, zone: "heavyg" }); const u = b.dir() * b.free * 0.55; b.add("bumper", a + 35, u, { w: 0.7, tall: 1.2, p: 4 }); b.steer(a, a + 70, -u, 0.9); },
  boostpads: (b) => { const a = b.straight(70, { railL: true, railR: true }); for (let i = 0; i < 3; i++) b.add("boost", a + 12 + i * 20, (i - 1) * b.free * 0.5, { ds: 1.3, w: 1.4 }); },
  orbs: (b) => { const a = b.straight(60); for (let i = 0; i < 3; i++) b.add("orb", a + 10 + i * 18, b.lane(), { h: 0.7, w: 0.7 }); b.coins(a + 6, a + 56, 0, 0, 5); },
  capsules: (b) => { const a = b.straight(50); for (const u of [-b.free * 0.6, 0, b.free * 0.6]) b.add("capsule", a + 25, u, { h: 0.8, w: 0.8 }); },
  gems: (b) => {
    const was = b.rails; b.rails = false;
    const a = b.straight(60);
    const side = b.dir();
    for (let i = 0; i < 5; i++) b.add("gem", a + 8 + i * 10, side * (b.free + 0.2), { h: 0.6, w: 0.5 });
    b.rails = was;
  },
};

const SECTIONS: Record<Mech, (b: B, m: Mode) => void> = { ...SECTIONS1, ...SECTIONS2 };

/** one of Kranky's machines: an arch over the road with its glowing core on the road below, cannonballs flying */
function station(b: B, look: number, k: number) {
  const was = b.width; b.width = Math.max(was, 10);
  const a = b.straight(64, { railL: true, railR: true }), u = (k % 2 ? 1 : -1) * b.free * 0.45;
  b.add("deco", a + 34, 0, { look: "boss", p: look, w: b.hw, h: k });
  b.add("core", a + 34, u, { ds: 1.3, w: 1.4, look: "core" });
  b.steer(a + 6, a + 35, u, 0.95);
  for (const s of [a + 14, a + 52]) b.add("block", s, 0, { ds: 0.5, w: 0.5, tall: 0.9, mov: { ax: "u", amp: b.hw + 1.5, period: 2.2, phase: s * 0.7 }, look: "bossball" });
  b.width = was;
}

// ---------------------------------------------------------------- one stage
export const BUILD = { built: 0, retried: 0, trimmed: 0 };
export interface Verdict { ok: boolean; at: number; time: number; checkT: Record<number, number> }
let validate: ((s: Stage, from: number) => Verdict) | null = null;
export function setValidator(f: ((s: Stage, from: number) => Verdict) | null) { validate = f; }

const POWERS_AT = (world: number): PowerKind[] => POWER_WORLD.filter(([, w]) => w <= world).map(([p]) => p);
const HAZ = new Set<ObjKind>(["bumper", "block", "hammer", "sweeper", "laser", "spikes"]);
const OPENER: Mech[] = ["curves", "banked", "hills", "padjump", "islands", "downhill", "spiral"];
/** sections with hazards to dodge (or pads to hit) need a road wide enough to dodge on */
const ROOMY = new Set<Mech>(["bumpers", "blocks", "hammer", "pistons", "lasers", "spikes", "lava", "chicane", "heavyg", "sticky", "boostpads", "orbs", "capsules", "boulders", "doors", "clappers", "cannonballs", "lightning", "lasergrid", "spores", "fork", "paint", "speedtrap", "blackhole", "chaser", "treasure", "presses"]);
const BOSS_POOL: Mech[] = ["hammer", "sweeper", "blocks", "tiles", "movers", "beam", "lasers", "padjump", "seesaw", "log"];

function layout(r: Recipe, rng: Rng): Stage {
  const b = new B(r, rng);
  // ---- the grid: a wide straight for the start, and the first stretch
  const w0 = b.width; b.width = Math.max(b.width, 10);
  b.straight(36, { look: "grid", railL: true, railR: true });
  b.add("deco", 6, 0, { look: "startgate", w: b.hw });
  b.width = w0;
  b.straight(20);
  b.coins(40, 54, 0, 0, 3.5);
  const known = r.known.filter((m) => SECTIONS[m] && !NO_MIX.has(m));
  const old = (): Mech => known.length ? known[rng.int(0, known.length - 1)] : "curves";
  const final = r.n === JOURNEY;
  const R = r.rules, X = r.extra;
  if (R.elim || R.lead) b.every = 120;
  // ---- how long: a mode's course has a set number of sections; a stage runs 20+ minutes
  const target = r.sections ? Infinity : STAGE_SECONDS * b.v * 0.8 * (final ? 1.1 : 1);
  const most = r.sections ?? 100000;
  const boss = r.kind === "boss" || final;
  const stations = boss ? [0.3, 0.62, 0.9] : [];
  const bossPool = BOSS_POOL.filter((m) => r.known.includes(m) || r.world > 1).concat(known.slice(-6));
  const openers = OPENER.slice();
  const rails0 = clamp(0.7 - r.d * 0.55, 0.06, 0.7);
  let fk = 0, st = 0;
  for (let i = 0; i < most && b.s < target; i++) {
    // ---- the next section: the stage's own idea about two times in five, older ideas round it
    let mech: Mech, mode: Mode = "mix";
    if (r.kind === "opener") { mech = openers[i % openers.length]; mode = i < openers.length ? "sign" : "use"; }
    else if (boss) mech = bossPool[rng.int(0, bossPool.length - 1)] ?? "curves";
    else if (r.remix) { const own = i < r.focus.length || rng.chance(0.45); mech = own ? r.focus[i % r.focus.length] : old(); mode = i < r.focus.length ? "use" : "mix"; }
    else if (i === 0 || rng.chance(0.4)) { mech = r.focus[0]; mode = fk === 0 ? "sign" : fk === 1 ? "use" : "mix"; fk++; }
    else mech = old();
    // woven in: power capsules, speed orbs and the goal's own pieces
    if (i > 0 && i % 5 === 2 && r.n >= 3 && !R.nopower) mech = "capsules";
    if (i > 0 && i % 4 === 1 && r.n >= 2) mech = "orbs";
    if (R.powers && i % 3 === 2) mech = "capsules";
    if (R.tricks && i % 6 === 3) mech = "trickpark";
    if (R.escape && i % 8 === 4) mech = "chaser";
    b.rails = rng.chance(rails0);
    b.vr = (mech === r.focus[0] && r.variant) || (mech === "weather" ? rng.pick(["rain", "fog", "snow", "petals"]) : "");
    const roomy = ROOMY.has(mech), wSave = b.width;
    if (roomy) b.width = Math.max(b.width, 6.4);
    SECTIONS[mech](b, mode);
    b.width = wSave;
    // Kranky's machine stands over the road three times on a boss stage (and on the final cup)
    const frac = r.sections ? (i + 1) / most : b.s / target;
    if (st < stations.length && frac >= stations[st]) { station(b, r.look.world - 1, st); st++; }
    // ---- the stretch to the next section: never plain road
    b.rails = rng.chance(rails0 * 0.6);
    joiner(b);
    if (i % 2 === 1) b.check();
  }
  while (st < stations.length) { station(b, r.look.world - 1, st); st++; }
  // ---- the finish: a long straight to the arch
  b.rails = true; b.width = Math.max(b.width, 9);
  const g = b.straight(60, { look: "finish" });
  b.add("finish", g + 40, 0, { w: b.hw });
  // ---- three hidden stars, off the obvious line (the last coin of a risky row, the edge after a jump…)
  const spots = b.objs.filter((o) => o.k === "coin" || o.k === "gem").filter((o) => Math.abs(o.u) > 0.8 || (o.h ?? 0) > 1.5);
  for (let i = 0; i < 3; i++) {
    const pick = spots.length ? spots[Math.floor(((i + 0.5) / 3) * spots.length)] : null;
    if (pick) { pick.k = "star"; pick.w = 0.7; }
    else b.add("star", (b.s * (i + 1)) / 4, 0, { h: 0.7, w: 0.7 });
  }
  // the O-R-B-I letters (spell them for a bonus) from world 3, hearts on long stages, now and then a chest
  const coinsLeft = b.objs.filter((o) => o.k === "coin");
  const letters = r.meet === "C08" || r.meet === "C21" || (r.world >= 3 && rng.chance(0.4));
  if (letters && coinsLeft.length > 12) for (let k = 0; k < 4; k++) { const c = coinsLeft[Math.floor(((k + 0.7) / 4.4) * coinsLeft.length)]; c.k = "letter"; c.p = k; c.w = 0.7; }
  const hearts = X?.hearts ? 6 : Math.min(5, Math.floor(b.s / 6000));
  for (let k = 0; k < hearts && coinsLeft.length > 8; k++) { const c = coinsLeft[Math.floor(((k + 0.5) / hearts) * coinsLeft.length)]; if (c.k === "coin") { c.k = "heart"; c.w = 0.7; } }
  for (let k = 0; k < Math.floor(b.s / 5000) && spots.length > 8; k++) { const c = spots[(k * 7 + 3) % spots.length]; if (c.k === "coin" || c.k === "gem") { c.k = "chest"; c.w = 0.9; c.h = 0; } }
  if (R.coins) R.coins = Math.max(10, Math.min(R.coins * Math.max(1, Math.floor(b.s / 2000)), Math.floor(b.objs.filter((o) => o.k === "coin").length * 0.55)));
  b.objs.sort((x, y) => x.s - y.s);
  const W = WORLDS[r.look.world - 1];
  return {
    n: r.n, seed: r.seed, world: r.world, stage: r.stage, kind: r.kind, d: r.d, name: r.name, meet: r.meet, mix: r.remix?.atoms,
    concepts: r.meet ? [r.meet] : [], segs: b.segs, objs: b.objs, intents: b.intents.sort((x, y) => x.s - y.s),
    checks: b.checks, finish: g + 40,
    rivals: X?.rivals ?? (r.n <= 1 ? 5 : r.n <= 6 ? 7 : 9), skill: clamp(0.15 + r.d * 0.52 + (X?.skill ?? 0) + (final ? 0.2 : 0), 0.18, 0.98),
    vmax: vmaxAt(r.d), powers: POWERS_AT(W.id), rules: R,
    look: { world: r.look.world, blend: r.look.blend, seed: hash32(r.seed, 7) }, gold: 0, y0: r.y0,
    beat: b.beat, boss: boss ? r.look.world - 1 : undefined, special: final ? "final" : X?.special,
  };
}


/** clear the trouble round s: gaps become road; hazards, mines, moving floors and zones nearby go */
function trim(st: Stage, at: number, k = 1) {
  let s0 = 0;
  for (const g of st.segs) { if (g.floor === "gap" && s0 < at + 30 * k && s0 + g.len > at - 40 * k) { g.floor = "road"; g.railL = g.railR = true; } s0 += g.len; }
  st.objs = st.objs.filter((o) => (!HAZ.has(o.k) && o.k !== "mine" && o.k !== "zone" && !["plat", "tile", "seesaw", "log", "tilt", "disc", "pad", "tramp", "chaser", "boost", "rocket"].includes(o.k)) || Math.abs(o.s - at) > 35 * k || (o.k === "zone" && (o.ds ?? 0) > 40));
  // round a repeat failure (or a fall off the side), curbs go up
  if (k > 1) { s0 = 0; for (const g of st.segs) { if (s0 < at + 30 * k && s0 + g.len > at - 60 * k) { g.railL = g.railR = true; g.crown = 0; g.twist = 0; } s0 += g.len; } }
  st.intents = st.intents.filter((i) => Math.abs(i.s - at) > 35 || i.follow === undefined);
}

/** build a stage the fairness robot can finish cleanly: it drives the whole course; where it falls, the trouble is
 *  cleared and it carries on from the checkpoint before (so even a 30 km stage is checked in a moment) */
export function buildStage(r: Recipe): Stage {
  BUILD.built++;
  const st = layout(r, new Rng(hash32(r.seed, 0, 0xb17)));
  if (!validate) return st;
  let from = 0, t0 = 0, cut = 0, lastAt = -1e9, rep = 1;
  for (let k = 0; k < 120; k++) {
    const res = validate(st, from);
    if (res.ok) { st.gold = Math.round((t0 + res.time) * 0.97 * 10) / 10; if (cut) BUILD.trimmed++; return st; }
    BUILD.retried++; cut++;
    rep = Math.abs(res.at - lastAt) < 40 ? rep + 1 : 1; lastAt = res.at;
    trim(st, res.at, rep);
    // carry on from the last checkpoint passed well before the trouble
    let ci = -1;
    for (let i = st.checks.length - 1; i >= 0; i--) if (st.checks[i] < res.at - 25 && st.checks[i] >= from && res.checkT[i] !== undefined) { ci = i; break; }
    if (ci >= 0) { t0 += res.checkT[ci]; from = st.checks[ci]; }
  }
  BUILD.trimmed++;
  for (const g of st.segs) g.floor = "road";
  st.objs = st.objs.filter((o) => !HAZ.has(o.k) && o.k !== "mine");
  st.gold = Math.round((st.finish / st.vmax) * 1.2);
  return st;
}

void ({} as ZoneKind);
