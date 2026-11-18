// Momo Dash! — one continuous run, Subway-style: every run starts at the beginning and the stages keep coming one
// after another (the player never sees a stage number) until Momo is caught. A stage is STAGE_M metres; 20 stages make
// a world (Sunset Pier → Candy Town → … → Grumpy Castle), and after the 240 hand-tuned stages the Remix Loop mixes two
// worlds at a time forever. Each stage sets the difficulty (chunk tiers, row spacing), which pieces may appear and the
// speed, which climbs in waves inside a world (up to a limit), dips back to normal now and then, and starts again a
// little higher in the next world. The track is built a few hundred metres ahead from the chunk library; portals split
// it into a Coin Lane and a Star Lane; a freshness memory keeps chunks seen in recent runs rare.
import { CHUNKS, isCoinOnly, type Chunk } from "./chunks";
import type { FriendId, Item, MorphId, Ob, ObKind, PowerId, RunSpec, Section, TimeOfDay, Twist, Weather, WorldId } from "./types";

export const LW = 2.2;
export const ROW = 3.2;
export const TRAM_H = 2.5;
export const RAIL_H = 0.62;
export const STAGES_PER_WORLD = 20;
export const HAND_STAGES = 240;
/** one stage of the run, in metres (a world is 20 of them) */
export const STAGE_M = 80;
/** the speed limit (m/s); boosters go past it */
export const SPEED_CAP = 18.5;

export interface WorldDef {
  id: WorldId; name: string; emoji: string; accent: string; accent2: string; villain: string; newIdea: string; blurb: string;
  tune: number[]; weather: Weather[];
}
export const WORLDS: WorldDef[] = [
  { id: "pier", name: "Sunset Pier", emoji: "🎡", accent: "#FF8A3D", accent2: "#7B5CFF", villain: "Captain Grumble", newIdea: "oncoming go-karts", blurb: "A boardwalk at sunset: string lights, snack stalls and the sea.", weather: ["none", "stars", "fireflies"],
    tune: [72, 76, 79, 84, 83, 79, 76, 79, 77, 81, 84, 81, 79, 76, 74, 76, 72, 76, 79, 81, 84, 86, 88, 84, 86, 83, 79, 83, 84, 79, 76, 72] },
  { id: "candy", name: "Candy Town", emoji: "🍭", accent: "#FF5FA2", accent2: "#3FD3C8", villain: "Chef Grumble", newIdea: "jelly trams — ramp up and run on the roofs", blurb: "Frosting roads, gingerbread houses and wobbly jelly trams.", weather: ["sprinkles", "none", "bubbles"],
    tune: [77, 81, 84, 81, 77, 79, 81, 84, 86, 84, 81, 79, 77, 79, 81, 77, 84, 86, 89, 86, 84, 81, 79, 81, 82, 81, 79, 77, 76, 77, 79, 77] },
  { id: "jungle", name: "Jungle Ruins", emoji: "🌴", accent: "#2FB86B", accent2: "#FFC23D", villain: "Stone Golem", newIdea: "gaps to jump and rolling boulders", blurb: "Old temple roads deep in the jungle, with gaps and rolling stones.", weather: ["leaves", "fireflies", "none"],
    tune: [76, 79, 81, 83, 86, 83, 81, 79, 76, 74, 76, 79, 81, 79, 76, 74, 71, 74, 76, 79, 81, 83, 86, 88, 86, 83, 81, 79, 76, 79, 76, 76] },
  { id: "snow", name: "Snowy Village", emoji: "⛄", accent: "#3D8BFF", accent2: "#9FE6FF", villain: "Storm Grump", newIdea: "slippery ice and rolling snowballs", blurb: "Chalets, pine trees and icy streets — careful, ice makes lane changes slow!", weather: ["snow", "snow", "none"],
    tune: [74, 78, 81, 86, 85, 81, 78, 81, 79, 83, 86, 83, 81, 78, 76, 78, 74, 78, 81, 83, 86, 88, 90, 86, 88, 85, 81, 85, 86, 81, 78, 74] },
  { id: "toy", name: "Toy Factory", emoji: "🧸", accent: "#FF6B4A", accent2: "#3D8BFF", villain: "Robo Grump", newIdea: "conveyor belts — and the Ball morph!", blurb: "Conveyor belts, giant toy blocks and Morph Gates.", weather: ["none", "bubbles", "sprinkles"],
    tune: [79, 83, 86, 83, 79, 81, 83, 86, 88, 86, 83, 81, 79, 81, 83, 79, 86, 88, 90, 91, 90, 88, 86, 83, 84, 86, 83, 81, 79, 81, 78, 79] },
  { id: "spooky", name: "Spooky Fair", emoji: "🎃", accent: "#9F6BFF", accent2: "#FF9A3D", villain: "Ghost Grump", newIdea: "ghost blocks that blink — and portals!", blurb: "A night fair with lanterns, ghost blocks and portals to Coin Lane or Star Lane.", weather: ["fireflies", "none", "leaves"],
    tune: [74, 77, 81, 77, 74, 76, 77, 81, 82, 81, 77, 76, 74, 76, 77, 74, 81, 82, 86, 82, 81, 77, 76, 77, 81, 77, 76, 73, 74, 76, 73, 74] },
  { id: "canyon", name: "Canyon Mines", emoji: "🌵", accent: "#E07A3D", accent2: "#FFD23F", villain: "Dusty Grump", newIdea: "rails to grind — and the Split morph!", blurb: "Red rocks, mine carts and rails you can jump on and grind.", weather: ["none", "leaves", "stars"],
    tune: [69, 72, 74, 76, 79, 76, 74, 72, 74, 76, 79, 81, 79, 76, 74, 72, 76, 79, 81, 84, 81, 79, 76, 74, 72, 74, 76, 74, 72, 71, 69, 69] },
  { id: "neon", name: "Neon City", emoji: "🌃", accent: "#3DE0FF", accent2: "#FF3DCB", villain: "Mech Grump", newIdea: "slow traffic and zoom pads", blurb: "Glowing towers, busy streets and speed-boost pads.", weather: ["rain", "none", "stars"],
    tune: [76, 79, 83, 88, 86, 83, 79, 83, 81, 84, 88, 84, 81, 79, 76, 79, 76, 79, 83, 86, 88, 91, 88, 86, 84, 83, 81, 79, 78, 79, 76, 76] },
  { id: "lava", name: "Lava Works", emoji: "🌋", accent: "#FF5A1F", accent2: "#FFC23D", villain: "Magma Grump", newIdea: "lava geysers — and the Giant morph!", blurb: "A hot factory of pipes and lava geysers that erupt on a beat.", weather: ["embers", "embers", "none"],
    tune: [72, 75, 79, 75, 72, 74, 75, 79, 80, 79, 75, 74, 72, 74, 75, 72, 79, 80, 84, 80, 79, 75, 74, 75, 79, 75, 74, 71, 72, 74, 71, 72] },
  { id: "sky", name: "Sky Islands", emoji: "🎈", accent: "#5FB8FF", accent2: "#FFD23F", villain: "Balloon Baron", newIdea: "wind gusts that push you a lane", blurb: "Floating islands, rope bridges and big gusts of wind.", weather: ["none", "bubbles", "leaves"],
    tune: [81, 85, 88, 85, 81, 83, 85, 88, 90, 88, 85, 83, 81, 83, 85, 81, 88, 90, 93, 90, 88, 85, 83, 85, 88, 85, 83, 81, 83, 85, 83, 81] },
  { id: "space", name: "Space Port", emoji: "🚀", accent: "#8F6BFF", accent2: "#3DE0FF", villain: "UFO Grump", newIdea: "floaty low gravity — and the Stretch morph!", blurb: "Domes, rockets and low gravity: every jump floats.", weather: ["stars", "stars", "none"],
    tune: [81, 84, 88, 84, 81, 83, 84, 88, 91, 88, 84, 83, 81, 83, 84, 81, 88, 91, 93, 91, 88, 84, 83, 84, 88, 84, 83, 79, 81, 83, 79, 81] },
  { id: "castle", name: "Grumpy Castle", emoji: "🏰", accent: "#FFC23D", accent2: "#9F6BFF", villain: "the Grumpy King", newIdea: "everything at once — catch the Grumpy King!", blurb: "The Grumpy King's castle: every trick you have learned, all together.", weather: ["none", "fireflies", "stars"],
    tune: [75, 79, 82, 79, 75, 77, 79, 82, 84, 82, 79, 77, 75, 77, 79, 75, 82, 84, 87, 84, 82, 79, 77, 79, 82, 79, 77, 75, 77, 79, 77, 75] },
];
export const worldIndex = (id: WorldId) => Math.max(0, WORLDS.findIndex((w) => w.id === id));

export const FRIENDS: Record<FriendId, { name: string; power: string; color: string; at: number }> = {
  zib: { name: "Zib", power: "pulls in coins from the next lane", color: "#9B5BE0", at: 1 },
  pip: { name: "Pip", power: "the Grumpy Guard can't catch you", color: "#2F3D8F", at: 1 },
  bolt: { name: "Bolt", power: "jumps higher", color: "#4FB8A4", at: 1 },
  gloop: { name: "Gloop", power: "side bumps don't make you stumble", color: "#3FC46A", at: 21 },
  bonbon: { name: "Bonbon", power: "cake bomb clears the lane ahead", color: "#FF6FA8", at: 41 },
  hoot: { name: "Prof. Hoot", power: "power-ups last longer", color: "#B9874A", at: 61 },
  turbo: { name: "Turbo", power: "faster lane changes", color: "#FF5A3D", at: 81 },
  noodle: { name: "Noodle", power: "morphs last longer", color: "#FFC23D", at: 101 },
  tiki: { name: "Tiki", power: "coin melodies are worth double", color: "#E08A2F", at: 121 },
  kranky: { name: "Kranky", power: "snips Grumpies and fences ahead", color: "#E8504F", at: 141 },
};
export const FRIEND_ORDER: FriendId[] = ["zib", "pip", "bolt", "gloop", "bonbon", "hoot", "turbo", "noodle", "tiki", "kranky"];
export const friendsAt = (n: number) => FRIEND_ORDER.filter((f) => n >= FRIENDS[f].at);
export const POWERS: Record<PowerId, { name: string; icon: string; time: number; color: string }> = {
  magnet: { name: "Coin Magnet", icon: "🧲", time: 10, color: "#FF4D6D" },
  shield: { name: "Bubble Shield", icon: "🛡️", time: 15, color: "#4FC3FF" },
  double: { name: "Score ×2", icon: "✨", time: 12, color: "#FFC21A" },
  sky: { name: "Sky Bubble", icon: "☁️", time: 6.5, color: "#B58CFF" },
};
export const MORPHS: Record<MorphId, { name: string; icon: string; time: number; text: string; at: number }> = {
  ball: { name: "Ball Momo", icon: "⚽", time: 6, text: "Roll through crates, fences and karts!", at: 85 },
  split: { name: "Split Momo", icon: "👯", time: 6, text: "Three Momos — one in every lane!", at: 125 },
  giant: { name: "Giant Momo", icon: "🦖", time: 6, text: "Huge! Smash everything!", at: 165 },
  stretch: { name: "Stretchy Momo", icon: "🦒", time: 6, text: "Tall and bendy: grab the high coins!", at: 205 },
};
export const morphsAt = (n: number) => (Object.keys(MORPHS) as MorphId[]).filter((m) => n >= MORPHS[m].at);

/** where each track piece first shows up (P = portals) */
const INTRO: Record<string, number> = { B: 1, J: 2, S: 3, C: 4, G: 6, T: 21, _: 41, K: 45, I: 61, "<": 81, M: 85, H: 101, P: 105, "=": 121, L: 141, Z: 145, "^": 161, "{": 181 };
/** pieces that belong to a world (for remixes) */
const SIGNATURE: Record<WorldId, string> = { pier: "C", candy: "T", jungle: "_K", snow: "IK", toy: "<M", spooky: "HP", canyon: "=M", neon: "LZ", lava: "^M", sky: "{_", space: "M_", castle: "TKH=" };
export const INTRO_TEXT: Record<string, string> = {
  B: "Swipe left or right to dodge!", J: "Swipe UP to jump the fences!", S: "Swipe DOWN to squish under bars!",
  C: "Go-karts drive at you — dodge or jump them!", G: "Grumpies! Jump on them for a BONK!", T: "Jelly trams! Run up a ramp onto the roof!",
  _: "Gaps! Swipe UP to jump across!", K: "Rolling boulders — jump them or dodge!", I: "Ice! Lane changes are slow and slippery.",
  "<": "Conveyor belts push you sideways!", M: "Morph Gates change Momo — try one!", H: "Ghost blocks blink in and out — time it!",
  P: "Portals! Left = Coin Lane, right = Star Lane.", "=": "Rails! Jump on and grind along them!", L: "Slow cars ahead — change lanes to pass!",
  Z: "Zoom pads give a super-speed burst!", "^": "Lava geysers erupt on a beat — wait for it!", "{": "Wind gusts push you a lane!",
};
/** rising inside a world, dipping at the start of the next one; slow growth over all worlds */
const WITHIN = [0, 0.08, 0.15, 0.2, 0.28, 0.24, 0.34, 0.4, 0.46, 0.38, 0.3, 0.42, 0.48, 0.55, 0.6, 0.56, 0.66, 0.72, 0.8, 0.7];
export function difficulty(n: number): number {
  const s = (n - 1) % STAGES_PER_WORLD;
  if (n > HAND_STAGES) return 0.85 + 0.25 * WITHIN[s] + 0.12 * Math.log2(1 + (n - HAND_STAGES) / 60);
  const w = Math.floor((n - 1) / STAGES_PER_WORLD);
  return Math.max(0, 0.08 + 0.07 * w + 0.25 * WITHIN[s]);
}

// ------------------------------------------------------------------ seeded random
export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(a: readonly T[], seed: number): T[] {
  const r = rng(seed), b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}


// ------------------------------------------------------------------ the run schedule
const BLEND_ADJ: Record<WorldId, string[]> = {
  pier: ["Seaside", "Sunset", "Harbor"], candy: ["Sugar", "Sprinkle", "Lollipop"], jungle: ["Wild", "Leafy", "Vine"], snow: ["Frosty", "Snowy", "Icy"],
  toy: ["Wind-up", "Toybox", "Clockwork"], spooky: ["Moonlit", "Misty", "Lantern"], canyon: ["Dusty", "Desert", "Cactus"], neon: ["Neon", "Glowing", "Laser"],
  lava: ["Fiery", "Ember", "Molten"], sky: ["Breezy", "Cloudy", "Floating"], space: ["Starry", "Cosmic", "Comet"], castle: ["Royal", "Knightly", "Banner"],
};
const BLEND_NOUN: Record<WorldId, string[]> = {
  pier: ["Boardwalk", "Pier", "Promenade"], candy: ["Candyland", "Sweet Street", "Cake Road"], jungle: ["Ruins", "Temple Road", "Jungle"], snow: ["Village", "Slopes", "Snowfield"],
  toy: ["Factory", "Toyland", "Workshop"], spooky: ["Fair", "Hollow", "Fun House"], canyon: ["Canyon", "Mine", "Mesa"], neon: ["City", "Avenue", "Skyline"],
  lava: ["Works", "Furnace", "Crater"], sky: ["Islands", "Skyway", "Cloud Road"], space: ["Port", "Orbit", "Moonbase"], castle: ["Castle", "Keep", "Kingdom"],
};
const ALL_PAIRS: [number, number][] = [];
for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (a !== b) ALL_PAIRS.push([a, b]);
const pairCache = new Map<number, [number, number][]>();
/** remix worlds: every ordered pair of worlds once per cycle (132 of them), shuffled, never the same track world twice in a row */
function pairOf(c: number): [number, number] {
  const cyc = Math.floor(c / ALL_PAIRS.length);
  let list = pairCache.get(cyc);
  if (!list) {
    const l = shuffled(ALL_PAIRS, 9001 + cyc * 7919);
    for (let i = 1; i < l.length; i++) if (l[i][0] === l[i - 1][0]) { const j = l.findIndex((p, k) => k > i && p[0] !== l[i - 1][0]); if (j > 0) [l[i], l[j]] = [l[j], l[i]]; }
    pairCache.set(cyc, l); list = l;
  }
  return list[c % list.length];
}
export const placeOf = (a: number, b: number, c = 0) => {
  if (a === b) return WORLDS[a].name;
  const h = Math.imul(c + 1, 2654435761) >>> 0;
  return `${BLEND_ADJ[WORLDS[b].id][h % 3]} ${BLEND_NOUN[WORLDS[a].id][(h >>> 4) % 3]}`;
};
export function allowFor(n: number) { return Object.entries(INTRO).filter(([, at]) => n >= at).map(([k]) => k).join(""); }
/** the piece that arrives at this stage (its stage shows it more, and the HUD gives a hint) */
export const newPiece = (n: number) => (n > HAND_STAGES ? undefined : Object.entries(INTRO).find(([, at]) => at === n)?.[0]);
const TODS: TimeOfDay[] = ["day", "sunset", "night", "morning", "aurora", "day", "sunset"];
const TWISTS: Twist[] = ["speed", "night", "lowgrav", "fog", "coinrain"];
export const TWIST_INFO: Record<Twist, { icon: string; text: string }> = {
  speed: { icon: "⚡", text: "Speed run!" }, night: { icon: "🌙", text: "Night run" }, lowgrav: { icon: "🪶", text: "Low gravity" },
  fog: { icon: "🌫️", text: "Foggy" }, coinrain: { icon: "🪙", text: "Coin rain!" },
};
/** each world's own sky */
export const WORLD_TOD: Record<WorldId, TimeOfDay> = { pier: "sunset", candy: "day", jungle: "day", snow: "morning", toy: "day", spooky: "night", canyon: "sunset", neon: "night", lava: "night", sky: "day", space: "night", castle: "sunset" };
const CHASE_AT = new Set([9, 10, 19, 20]);

const secCache = new Map<number, Section>();
/** what stage n of the run looks like */
export function sectionOf(n: number): Section {
  const hit = secCache.get(n);
  if (hit) return hit;
  const s = ((n - 1) % STAGES_PER_WORLD) + 1, d = difficulty(n);
  let sec: Section;
  if (n > HAND_STAGES) {
    const c = Math.floor((n - HAND_STAGES - 1) / STAGES_PER_WORLD), [a, b] = pairOf(c), A = WORLDS[a], B = WORLDS[b];
    const r = rng(c * 7919 + 17);
    const tod = TODS[Math.floor(r() * TODS.length)];
    let twist: Twist | undefined = r() < 0.4 ? TWISTS[Math.floor(r() * TWISTS.length)] : undefined;
    if (twist === "lowgrav" && (A.id === "space" || B.id === "space")) twist = "speed";
    if (twist === "night" && tod === "night") twist = "fog";
    const lowg = A.id === "space" || twist === "lowgrav";
    sec = {
      n, s, w: a, world: A.id, scene: B.id, remix: true, place: placeOf(a, b, c), emoji: `${A.emoji}${B.emoji}`, d,
      tod: twist === "night" ? "night" : tod, weather: B.weather[Math.floor(r() * B.weather.length)], twist, grav: lowg ? 0.62 : 1, jump: lowg ? 0.8 : 1,
      tune: B.tune, music: s <= 10 ? A.id : B.id, allow: `BJSCG${SIGNATURE[A.id]}${SIGNATURE[B.id]}P`, chase: CHASE_AT.has(s), villain: (s <= 10 ? A : B).villain,
    };
  } else {
    const w = Math.floor((n - 1) / STAGES_PER_WORLD), W = WORLDS[w];
    sec = {
      n, s, w, world: W.id, scene: W.id, remix: false, place: W.name, emoji: W.emoji, d, tod: WORLD_TOD[W.id], weather: W.weather[0],
      grav: W.id === "space" ? 0.62 : 1, jump: W.id === "space" ? 0.8 : 1, tune: W.tune, music: W.id, allow: allowFor(n), chase: CHASE_AT.has(s), villain: W.villain,
    };
  }
  secCache.set(n, sec);
  return sec;
}
/** speed in waves: up through each half of a world toward the limit, back to normal in the middle and at each new world */
export function speedOf(n: number, frac: number): number {
  const w = Math.min(12, Math.floor((n - 1) / STAGES_PER_WORLD)), s = ((n - 1) % STAGES_PER_WORLD) + frac;
  const vN = Math.min(15.5, 11 + 0.42 * w), vC = Math.min(SPEED_CAP, vN + 3);
  const wave = s < 10 ? s / 10 : s < 11 ? 1 - (s - 10) * 0.7 : 0.3 + 0.7 * (s - 11) / 9;
  return vN + (vC - vN) * Math.max(0, Math.min(1, wave));
}
export function dailyKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
/** the Daily Dash: today's run starts in a different world (the same for everyone) */
export function dailyRun(key: string): RunSpec {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { seed: h, start: 1 + STAGES_PER_WORLD * (1 + (h % 7)), daily: key };
}

// ------------------------------------------------------------------ the track
const KIND: Record<string, ObKind> = { J: "fence", S: "bar", B: "block", C: "cart", L: "cart", G: "grumpy", K: "roller", H: "ghost", Z: "zoom", "^": "geyser", _: "gap" };
const LEN: Partial<Record<ObKind, number>> = { fence: 0.5, bar: 0.6, block: 2.0, cart: 2.6, grumpy: 0.8, roller: 1.4, ghost: 2.0, zoom: 1.8, geyser: 1.6 };
/** long pieces: consecutive cells in a lane make one piece */
const RUNS: Record<string, ObKind> = { T: "tram", I: "ice", "<": "belt", ">": "belt", "=": "rail" };
const MIRROR: Record<string, string> = { "<": ">", ">": "<", "{": "}", "}": "{" };
const VARIANTS = CHUNKS.flatMap((c) => {
  const m = c.rows.map((r) => r.split("").reverse().map((ch) => MIRROR[ch] ?? ch).join(""));
  return m.join("/") === c.rows.join("/") ? [{ c, rows: c.rows }] : [{ c, rows: c.rows }, { c, rows: m }];
});
const ALLOW_OF: Record<string, string> = { R: "T", ">": "<", "}": "{" };
const PIECE = /[BJSCGTR_KI<>MH=LZ^{}]/;
const allowed = (ch: string, allow: string) => !PIECE.test(ch) || allow.includes(ALLOW_OF[ch] ?? ch);

export interface Chase { id: number; z0: number; z1: number; n: number; villain: string; world: WorldId }

export class Track {
  obs: Ob[] = []; items: Item[] = [];
  lineCount = 0; lineLen = new Map<number, number>();
  /** chunk ids used this run (for the freshness memory) */
  used: string[] = [];
  /** where each new world starts (the first entry is the run's start) */
  worlds: { z: number; n: number }[] = [];
  portals: { id: number; z: number; end: number }[] = [];
  chases: Chase[] = [];
  readonly spec: RunSpec;
  private r: Rng; private z = 24; private id = 1; private recent: string[] = []; private far: Set<string>;
  private br?: number; private nextPower: number; private nextFriend: number; private nextBoost: number; private nextPortal = 0;
  private done = new Set<string>();

  constructor(spec: RunSpec) {
    this.spec = spec; this.r = rng(spec.seed);
    this.far = new Set(spec.recent ?? []);
    this.nextPower = 140 + this.r() * 60; this.nextFriend = 500 + this.r() * 200; this.nextBoost = 700 + this.r() * 250;
    this.worlds.push({ z: 0, n: spec.start });
    this.fill(380); this.makeLines(0); this.sort();
  }
  stageAt(z: number) { return this.spec.start + Math.floor(Math.max(0, z) / STAGE_M); }
  section(z: number) { return sectionOf(this.stageAt(z)); }
  speedAt(z: number) {
    const n = this.stageAt(z), sec = sectionOf(n);
    return speedOf(n, (Math.max(0, z) % STAGE_M) / STAGE_M) * (this.spec.help ? 0.93 : 1) * (sec.twist === "speed" ? 1.08 : 1);
  }
  dAt(z: number) { return this.section(z).d * (this.spec.help ? 0.78 : 1); }
  /** keep the track built ahead of Momo, and forget what is far behind */
  extend(momoZ: number) {
    if (this.z < momoZ + 300) {
      const from = this.items.length;
      this.fill(momoZ + 380);
      this.makeLines(from);
      this.sort();
    }
    const cut = momoZ - 90;
    let i = 0; while (i < this.obs.length && this.obs[i].z < cut) i++;
    if (i > 60) this.obs.splice(0, i);
    let j = 0; while (j < this.items.length && this.items[j].z < cut) j++;
    if (j > 120) this.items.splice(0, j);
  }

  private fill(until: number) {
    while (this.z < until) {
      const n = this.stageAt(this.z), sec = sectionOf(n);
      // a new world: a clear runway (the renderer swaps the world behind a white flash)
      const nextW = n + (STAGES_PER_WORLD - sec.s) + 1, zb = (nextW - this.spec.start) * STAGE_M;
      if (this.z > zb - 46) {
        if (this.worlds[this.worlds.length - 1].n !== nextW) this.worlds.push({ z: zb, n: nextW });
        this.z = zb + 42;
        continue;
      }
      if (sec.allow.includes("P") && !sec.chase && this.z < zb - 260) {
        if (this.nextPortal === 0) this.nextPortal = this.z + 120 + this.r() * 200;
        else if (this.z > this.nextPortal) { this.portal(); continue; }
      }
      const d = this.dAt(this.z);
      const warm = this.z < 60 || sec.s === 1;
      const tierMax = Math.max(1, Math.min(5, 1 + Math.floor(d * 6 + 0.6) - (warm ? 1 : 0)));
      const target = Math.min(tierMax, 1 + d * 5 + (sec.s > 15 ? 0.4 : 0));
      const breather = sec.s === 11 && (this.z % STAGE_M) < 30;
      this.chunkAt(sec, tierMax, target, this.z < 40 || breather, breather);
    }
  }
  private chunkAt(sec: Section, tierMax: number, target: number, easy: boolean, breather = false) {
    const d = this.dAt(this.z);
    const stretch = (1.3 - 0.36 * Math.min(1, d)) * (this.spec.help ? 1.1 : 1) * (sec.grav < 1 ? 1.1 : 1);
    const rowLen = ROW * stretch;
    const ch = this.pick(sec, tierMax, target, easy);
    const end = this.place(sec, ch.c, ch.rows, this.z, rowLen);
    const speed = this.speedAt(this.z);
    const gap = Math.max(rowLen * 1.15, speed * (0.55 - 0.12 * Math.min(1, d))) + (breather ? 8 : 0) + (this.spec.help ? 2 : 0);
    if (this.br == null) this.specials(sec, end, gap);
    this.z = end + gap;
  }

  private pick(sec: Section, tierMax: number, target: number, easy: boolean) {
    const fresh = newPiece(sec.n), allow = sec.allow, morphOk = this.morphs(sec).length > 0;
    const bias = (c: Chunk) => {
      const s = c.rows.join("");
      let w = 1;
      if (fresh && (s.includes(fresh) || (fresh === "<" && s.includes(">")) || (fresh === "{" && s.includes("}")))) w *= 2.6;
      for (const p of SIGNATURE[sec.world]) if (s.includes(p)) { w *= 1.5; break; }
      if (s.includes("M") && !morphOk) w = 0;
      return w;
    };
    const ok = VARIANTS.filter(({ c }) => {
      const all = c.rows.join("");
      if (![...all].every((ch) => allowed(ch, allow))) return false;
      if (easy) return c.tier === 1 && !/[M_^{}HZ=]/.test(all);
      return c.tier <= tierMax;
    });
    const pool = ok.length ? ok : VARIANTS.filter(({ c }) => isCoinOnly(c));
    let sum = 0;
    const ws = pool.map((v) => {
      const dt = v.c.tier - target;
      const w = Math.exp(-(dt * dt) / 1.4) * (this.recent.includes(v.c.id) ? 0.12 : 1) * (this.far.has(v.c.id) ? 0.45 : 1) * bias(v.c) * (isCoinOnly(v.c) && !easy ? 0.3 : 1);
      sum += w; return w;
    });
    let x = this.r() * sum, k = 0;
    while (k < pool.length - 1 && (x -= ws[k]) > 0) k++;
    const v = pool[k];
    this.recent.push(v.c.id); if (this.recent.length > 6) this.recent.shift();
    this.used.push(v.c.id);
    return v;
  }
  private morphs(sec: Section): MorphId[] {
    if (!sec.allow.includes("M")) return [];
    return sec.remix ? (Object.keys(MORPHS) as MorphId[]) : morphsAt(sec.n);
  }

  /** put one chunk on the track at z; returns where it ends */
  private place(sec: Section, c: Chunk, rows: string[], z0: number, rowLen: number) {
    const n = rows.length, r = this.r, br = this.br, morphs = this.morphs(sec);
    const cell = (row: number, lane: number) => (row >= 0 && row < n ? rows[row][lane + 1] : ".");
    const ob = (o: Omit<Ob, "id" | "br">) => { this.obs.push({ ...o, id: this.id++, br }); };
    for (let lane = -1; lane <= 1; lane++) {
      let laneHasObs = false;
      for (let i = 0; i < n; i++) if (/[BJSCGTR_KHL^=]/.test(cell(i, lane))) laneHasObs = true;
      for (let i = 0; i < n; i++) {
        const ch = cell(i, lane), rz = z0 + i * rowLen;
        const run = RUNS[ch];
        if (run) {
          if (cell(i - 1, lane) === ch) continue;
          let k = i; while (cell(k, lane) === ch) k++;
          const len = (k - i) * rowLen - (run === "tram" || run === "rail" ? 0.5 : 0);
          ob({ kind: run, lane, z: rz, len, k: 0, rows: k - i, dir: ch === "<" ? -1 : ch === ">" ? 1 : undefined });
        } else if (ch === "R") {
          ob({ kind: "ramp", lane, z: rz, len: rowLen, k: 0 });
        } else if (ch === "{" || ch === "}") {
          ob({ kind: "gust", lane, z: rz, len: rowLen * 0.6, k: 0, dir: ch === "{" ? -1 : 1 });
        } else if (ch === "M") {
          if (morphs.length) this.items.push({ id: this.id++, kind: "morph", lane, z: rz + rowLen / 2, y: 1.1, morph: morphs[Math.floor(r() * morphs.length)], br });
        } else if (KIND[ch]) {
          const kind = KIND[ch];
          const len = kind === "gap" ? rowLen * 0.72 : LEN[kind] ?? 1;
          const speed = this.speedAt(rz), dd = this.dAt(rz);
          const k = ch === "C" ? (2.6 + 4.2 * dd) / speed : ch === "K" ? (2.0 + 3.0 * dd) / speed : ch === "L" ? -(0.3 + 0.2 * Math.min(1, dd)) : 0;
          ob({ kind, lane, z: rz + (rowLen - len) / 2, len, k, ph: kind === "ghost" || kind === "geyser" ? Math.floor(r() * 8) * 0.3 : undefined });
          if ((kind === "fence" || kind === "gap") && (cell(i - 1, lane) === "o" || cell(i + 1, lane) === "o")) {
            for (const [dz, y] of [[-1.3, 1.5], [0, 2.1], [1.3, 1.5]] as const) this.coin(lane, rz + rowLen / 2 + dz, y);
          }
        } else if (ch === "o") {
          this.coin(lane, rz + rowLen * 0.25, 0.75 + this.roofAt(lane, rz + rowLen * 0.25));
          this.coin(lane, rz + rowLen * 0.75, 0.75 + this.roofAt(lane, rz + rowLen * 0.75));
        }
      }
      const rain = sec.twist === "coinrain" ? 0.4 : 0;
      if (!laneHasObs && !rows.some((row) => row[lane + 1] === "o") && r() < 0.35 + rain) {
        for (let i = 1; i < n; i++) { this.coin(lane, z0 + i * rowLen, 0.75); this.coin(lane, z0 + (i + 0.5) * rowLen, 0.75); }
      }
    }
    return z0 + n * rowLen;
  }
  private roofAt(lane: number, z: number) {
    for (let i = this.obs.length - 1; i >= 0 && i > this.obs.length - 30; i--) {
      const o = this.obs[i];
      if (o.lane !== lane || z < o.z || z > o.z + o.len) continue;
      if (o.kind === "tram") return TRAM_H;
      if (o.kind === "rail") return RAIL_H;
      if (o.kind === "ramp") return TRAM_H * (z - o.z) / o.len;
    }
    return 0;
  }
  private coin(lane: number, z: number, y: number) { this.items.push({ id: this.id++, kind: "coin", lane, z, y, br: this.br }); }
  private put(kind: Item["kind"], z: number, extra: Partial<Item> = {}) {
    const lane = Math.floor(this.r() * 3) - 1;
    this.items.push({ id: this.id++, kind, lane, z, y: kind === "pad" ? 0.05 : 1.1, br: this.br, ...extra });
  }
  /** a portal: the left gate leads to the Coin Lane, the right one to the Star Lane (harder, with star pieces) */
  private portal() {
    const pid = this.portals.length + 1, z0 = this.z, sec = this.section(z0);
    this.obs.push({ id: this.id++, kind: "block", lane: 0, z: z0 - 1, len: 2.4, k: 0 });
    this.items.push({ id: this.id++, kind: "portal", lane: -1, z: z0, y: 0, port: pid, side: 0 });
    this.items.push({ id: this.id++, kind: "portal", lane: 1, z: z0, y: 0, port: pid, side: 1 });
    const start = z0 + 4 + this.speedAt(z0) * 0.8, zoneLen = 110 + this.r() * 30;
    let end = start;
    for (const side of [0, 1]) {
      this.br = pid * 2 + side; this.z = start;
      const d = this.dAt(start), tierMax = Math.min(5, 1 + Math.floor(d * 6 + 0.6) + side);
      let stars = 0;
      while (this.z < start + zoneLen) {
        if (side === 0) this.chunkAt(sec, Math.min(2, tierMax), 1, false);
        else this.chunkAt(sec, tierMax, Math.min(tierMax, 2 + d * 5), false);
        if (side === 1 && stars < 3) { this.put("star", this.z - 2, { y: 1.1 }); stars++; }
        if (side === 0) for (let k = 0; k < 4; k++) this.coin(Math.floor(this.r() * 3) - 1, this.z - 4 + k, 0.75);
      }
      end = Math.max(end, this.z);
    }
    this.br = undefined;
    this.portals.push({ id: pid, z: z0, end });
    this.z = end + 6;
    this.nextPortal = this.z + 900 + this.r() * 500;
  }
  /** goodies in the gap after a chunk, on a schedule */
  private specials(sec: Section, end: number, gap: number) {
    const z = end + gap / 2, key = (k: string) => `${k}-${sec.n}`;
    const friends = friendsAt(sec.remix ? 999 : sec.n);
    if (sec.chase) {
      // chase: the villain runs ahead through stages 9–10 (and 19–20); hit 3 boost pads to catch them
      const first = sec.s === 9 || sec.s === 19;
      const z0 = (sec.n - (first ? 0 : 1) - this.spec.start) * STAGE_M;
      let c = this.chases[this.chases.length - 1];
      if (!c || c.z0 !== z0) { c = { id: this.chases.length + 1, z0, z1: z0 + 2 * STAGE_M, n: sec.n, villain: sec.villain, world: sec.world }; this.chases.push(c); }
      const cz = c;
      const have = this.items.filter((i) => i.kind === "pad" && i.z >= cz.z0 && i.z <= cz.z1).length;
      if (have < 3 && z > c.z0 + 20 && z < c.z1 - 10) { this.put("pad", z); return; }
    }
    const letter = ({ 3: "M", 8: "O", 13: "M", 17: "O" } as Record<number, string>)[sec.s];
    if (letter && !this.done.has(key("L"))) { this.done.add(key("L")); this.put("letter", z, { letter }); return; }
    if (sec.s === 14 && !this.done.has(key("cage"))) { this.done.add(key("cage")); this.put("cage", z, { friend: friends[Math.floor(this.r() * friends.length)] }); return; }
    if (end > this.nextBoost) { const x = this.r() < 0.2 ? 5 : 3; this.put("boost", z, { boost: x }); this.nextBoost = end + 2400 + x * 300 + this.r() * 900; return; }
    if (end > this.nextPower) { this.put("power", z, { power: this.powerPick() }); this.nextPower = end + 270 + this.r() * 130; return; }
    if (end > this.nextFriend) { this.put("friend", z, { friend: friends[Math.floor(this.r() * friends.length)] }); this.nextFriend = end + (this.spec.help ? 1100 : 2000) + this.r() * 1000; }
  }
  private sort() { this.obs.sort((a, b) => a.z - b.z); this.items.sort((a, b) => a.z - b.z); }
  private powerPick(): PowerId {
    const x = this.r();
    return x < 0.38 ? "magnet" : x < 0.52 ? "shield" : x < 0.78 ? "double" : "sky";
  }
  /** coin melodies: 8+ coins in a row in one lane make a line that plays a phrase of the song */
  private makeLines(from: number) {
    const coins = this.items.slice(from).filter((i) => i.kind === "coin" && i.line == null).sort((a, b) => (a.br ?? -1) - (b.br ?? -1) || a.lane - b.lane || a.z - b.z);
    let run: Item[] = [];
    const flush = () => {
      if (run.length >= 8) {
        const id = ++this.lineCount;
        run.forEach((c, i) => { c.line = id; c.idx = i; });
        this.lineLen.set(id, run.length);
      }
      run = [];
    };
    for (const c of coins) {
      const last = run[run.length - 1];
      if (last && (last.lane !== c.lane || last.br !== c.br || c.z - last.z > 3.4)) flush();
      run.push(c);
    }
    flush();
  }
}
