// Momo Boing! worlds, stage list and the stage generator.
// Stages come one by one (no stage select). Every stage is built from its number (same stage on every replay). A chapter
// is 10 stages in one world; each stage type asks for something different, and difficulty `d(n)` climbs through the
// chapter, rests on stage 4, peaks at the boss and starts the next chapter a little lower than that peak.
import type {
  CardId, DropKind, EnemySpec, FriendId, Goal, ItemSpec, LiftSpec, PlatKind, PlatSpec, StageSpec, StageType, TimeOfDay, Twist, VillainKind, VineSpec, Weather, WindSpec, WorldId,
} from "./types";

// ------------------------------------------------------------------ physics (shared with the sim and the bot)
/** the column is x ∈ [−HALF, HALF]; walking off one side brings Momo in on the other */
export const HALF = 3.6;
export const GRAVITY = 30;
/** take-off speed of a normal bounce (apex = V² / 2G ≈ 3.4 units) */
export const JUMP_V = 14.2;
export const PERFECT_MUL = 1.22;
export const SPRING_MUL = 1.7;
export const GUM_MUL = 1.45;
export const TRAMP_MUL = 1.42;
export const CANNON_MUL = 2.05;
export const apexOf = (v: number, g = GRAVITY) => (v * v) / (2 * g);

export const wrapX = (x: number) => { const w = HALF * 2; let v = (x + HALF) % w; if (v < 0) v += w; return v - HALF; };
/** shortest signed distance a → b around the wrapped column */
export const dxWrap = (a: number, b: number) => wrapX(b - a);

// ------------------------------------------------------------------ worlds
export type Voice = "marimba" | "musicbox" | "bells" | "toypiano" | "steel" | "celesta" | "kalimba" | "xylo" | "synth" | "horn";
export interface WorldDef {
  id: WorldId; name: string; emoji: string; accent: string; accent2: string; newIdea: string; blurb: string;
  drop: DropKind; villain: VillainKind; villainName: string;
  /** the bounce song: each landing plays the next note (MIDI) */
  tune: number[]; voice: Voice;
}
const T = (s: string) => s.trim().split(/\s+/).map((x) => {
  const m = /^([a-g])(#?)(\d)$/.exec(x)!;
  return 12 * (Number(m[3]) + 1) + ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 } as Record<string, number>)[m[1]] + (m[2] ? 1 : 0);
});
export const WORLDS: WorldDef[] = [
  {
    id: "garden", name: "Garden Sky", emoji: "🌼", accent: "#3FAE4A", accent2: "#FFD23F", drop: "acorn", villain: "balloon", villainName: "Balloon Baron",
    newIdea: "Leaf springs and buzzy Grumpy bees", blurb: "Mushroom springs send Momo flying. Land on a bee from above to pop it!",
    tune: T("e5 g5 a5 g5 e5 d5 c5 d5 e5 g5 c6 a5 g5 e5 d5 e5  g5 a5 c6 d6 c6 a5 g5 a5 g5 e5 d5 c5 d5 e5 d5 c5"), voice: "marimba",
  },
  {
    id: "candy", name: "Candy Clouds", emoji: "🍭", accent: "#FF5FA2", accent2: "#8F6BFF", drop: "candy", villain: "chef", villainName: "Chef Grumble",
    newIdea: "Bubblegum launches and cotton-candy clouds", blurb: "Bubblegum holds Momo, then flings him high. Cotton-candy clouds puff away after one bounce.",
    tune: T("c6 a5 f5 a5 c6 d6 c6 a5 g5 a5 a#5 a5 g5 f5 g5 a5  f5 g5 a5 c6 d6 f6 d6 c6 a5 g5 f5 g5 a5 g5 f5 c5"), voice: "musicbox",
  },
  {
    id: "snow", name: "Snow Peaks", emoji: "❄️", accent: "#3D8BFF", accent2: "#7CE0FF", drop: "snowball", villain: "cloud", villainName: "Storm Grump",
    newIdea: "Slippery ice and windy gusts", blurb: "Ice keeps Momo sliding after he lands, and the wind pushes him sideways. Snowballs fall where the ! shows.",
    tune: T("d5 f#5 a5 d6 a5 f#5 e5 f#5 a5 b5 a5 f#5 e5 d5 e5 f#5  a5 b5 d6 e6 d6 b5 a5 f#5 a5 b5 a5 f#5 e5 f#5 e5 d5"), voice: "bells",
  },
  {
    id: "toy", name: "Toy Tower", emoji: "🧸", accent: "#FF8A3D", accent2: "#3D8BFF", drop: "toyball", villain: "robo", villainName: "Robo Grump",
    newIdea: "Trampolines and toy cannons", blurb: "Trampolines bounce Momo extra high. Hop into a toy cannon and BOOM — straight up!",
    tune: T("g5 b5 d6 b5 g5 a5 b5 d6 e6 d6 b5 a5 g5 a5 b5 g5  d6 e6 f#6 g6 f#6 e6 d6 b5 c6 d6 b5 a5 g5 a5 f#5 g5"), voice: "toypiano",
  },
  {
    id: "beach", name: "Beach Breeze", emoji: "🏖️", accent: "#1E9C91", accent2: "#FFD23F", drop: "coconut", villain: "boat", villainName: "Captain Kranky's Boat",
    newIdea: "Rolling beach balls and water spouts", blurb: "Beach balls roll back and forth. Jump into a water spout and it carries Momo up!",
    tune: T("a5 c#6 e6 c#6 a5 b5 c#6 e6 f#6 e6 c#6 b5 a5 b5 c#6 a5  e6 f#6 a6 f#6 e6 c#6 b5 c#6 e6 c#6 b5 a5 b5 c#6 b5 a5"), voice: "steel",
  },
  {
    id: "spooky", name: "Spooky Night", emoji: "🎃", accent: "#8E5BE8", accent2: "#FF8A3D", drop: "pumpkin", villain: "ghost", villainName: "Grumpy Ghost",
    newIdea: "Ghost platforms that fade in and out", blurb: "Ghost platforms are only solid while they glow. Watch them flicker and time your landing!",
    tune: T("d5 f5 a5 f5 d5 e5 f5 a5 a#5 a5 f5 e5 d5 e5 f5 d5  a5 a#5 d6 a#5 a5 f5 e5 f5 a5 f5 e5 c#5 d5 e5 c#5 d5"), voice: "celesta",
  },
  {
    id: "jungle", name: "Jungle Canopy", emoji: "🌴", accent: "#2E9E4A", accent2: "#FFB000", drop: "fruit", villain: "golem", villainName: "Jungle Golem",
    newIdea: "Vines to climb", blurb: "Touch a vine and Momo climbs it all the way up. Tap to let go early!",
    tune: T("e5 g5 a5 b5 a5 g5 e5 d5 e5 g5 b5 d6 b5 a5 g5 a5  b5 d6 e6 d6 b5 a5 g5 a5 b5 a5 g5 e5 d5 e5 d5 e5"), voice: "kalimba",
  },
  {
    id: "lava", name: "Lava Sky", emoji: "🌋", accent: "#E8504F", accent2: "#FFB347", drop: "rock", villain: "magma", villainName: "Magma Grump",
    newIdea: "Lava vents and geysers — and bubbles from below", blurb: "Land on a glowing vent while it erupts for a huge jump. Lava bubbles shoot up from below: watch the bottom!",
    tune: T("c5 d#5 g5 d#5 c5 d5 d#5 g5 g#5 g5 d#5 d5 c5 d5 d#5 c5  g5 g#5 c6 g#5 g5 d#5 d5 d#5 g5 d#5 d5 b4 c5 d5 b4 c5"), voice: "xylo",
  },
  {
    id: "space", name: "Space", emoji: "🪐", accent: "#4B3DBF", accent2: "#7CE0FF", drop: "meteor", villain: "ufo", villainName: "UFO Mothership",
    newIdea: "Low gravity and little planets", blurb: "Everything floats in space! Bounce from planet to planet and dodge the meteors.",
    tune: T("a5 c6 e6 c6 a5 b5 c6 e6 g6 e6 c6 b5 a5 b5 c6 a5  e6 g6 a6 g6 e6 c6 b5 c6 e6 c6 b5 g5 a5 b5 g5 a5"), voice: "synth",
  },
  {
    id: "castle", name: "Cloud Castle", emoji: "🏰", accent: "#C9A227", accent2: "#8F6BFF", drop: "cannonball", villain: "mech", villainName: "King Kranky Mech",
    newIdea: "Drawbridges and castle cannons", blurb: "Drawbridges swing open and shut — land while they're down. Cannons blast Momo up the towers!",
    tune: T("d#5 g5 a#5 g5 d#5 f5 g5 a#5 c6 a#5 g5 f5 d#5 f5 g5 d#5  a#5 c6 d#6 c6 a#5 g5 f5 g5 a#5 g5 f5 d#5 f5 g5 f5 d#5"), voice: "horn",
  },
];

// ------------------------------------------------------------------ stages
export const STAGE_TYPES: StageType[] = ["warmup", "notes", "friends", "comet", "chase", "puzzle", "time", "long", "storm", "boss"];
export const TYPE_INFO: Record<StageType, { label: string; icon: string; blurb: string }> = {
  warmup: { label: "Warm-up Climb", icon: "🌱", blurb: "Meet this world's new platforms. Tap as Momo lands for a PERFECT BOING!" },
  notes: { label: "Note Collector", icon: "🎵", blurb: "Music notes float off the path. Grab them to make the song sparkle." },
  friends: { label: "Friend Rescue", icon: "🫧", blurb: "Three friends are stuck in bubbles. Pop every bubble to stack them on Momo's head!" },
  comet: { label: "Comet Run", icon: "☄️", blurb: "A breather: the timing ring is extra wide. Chain Perfect Boings into Comets!" },
  chase: { label: "Goo Chase", icon: "🟣", blurb: "The Grumpy Goo is fast today. Keep climbing and don't look down!" },
  puzzle: { label: "Platform Puzzle", icon: "🧩", blurb: "A climb made only of this world's special platforms. Grab the coins on the way." },
  time: { label: "Time Attack", icon: "⏱️", blurb: "Race to the top before the clock runs out." },
  long: { label: "Long Climb", icon: "🧗", blurb: "The tallest climb of the chapter. Land on the Safe Clouds to stop the goo and pick a power card." },
  storm: { label: "Storm", icon: "⛈️", blurb: "Grumpies everywhere! Bounce on their heads to pop them." },
  boss: { label: "Boss Climb", icon: "👑", blurb: "A villain throws things from the top. Reach the golden cloud to bonk it!" },
};
/** the hand-shaped stages; after them the sky goes on forever (blended worlds, new names, new music) */
export const HAND_STAGES = 100;
/** stages never run out */
export const AVAILABLE = 99999;
export const CHAPTER_SIZE = 10;

export interface StageDef { n: number; id: string; world: number; s: number; type: StageType; name: string; /** stage 101+: the second world blended in */ mix?: number; place: string; emoji: string }
const NAME_A: Record<WorldId, string[]> = {
  garden: ["Daisy", "Clover", "Buttercup", "Pollen", "Petal", "Sunny", "Meadow", "Bumble", "Dandelion", "Tulip"],
  candy: ["Sprinkle", "Gumdrop", "Lollipop", "Toffee", "Marshmallow", "Cupcake", "Fudge", "Jellybean", "Caramel", "Sherbet"],
  snow: ["Frosty", "Snowflake", "Icicle", "Blizzard", "Glacier", "Polar", "Sleigh", "Snowball", "Chilly", "Aurora"],
  toy: ["Teddy", "Building Block", "Yo-yo", "Wind-up", "Rocking Horse", "Jigsaw", "Kazoo", "Marble", "Spinning Top", "Jack-in-the-Box"],
  beach: ["Seashell", "Coconut", "Sandcastle", "Starfish", "Seagull", "Surfboard", "Coral", "Lagoon", "Flip-flop", "Tide"],
  spooky: ["Pumpkin", "Moonlit", "Cobweb", "Lantern", "Whisper", "Batwing", "Shadow", "Creaky", "Misty", "Owl"],
  jungle: ["Vine", "Banana", "Parrot", "Mango", "Fern", "Toucan", "Bamboo", "Monkey", "Orchid", "Canopy"],
  lava: ["Ember", "Magma", "Cinder", "Volcano", "Ash", "Sizzle", "Obsidian", "Fireball", "Scorch", "Blaze"],
  space: ["Comet", "Moonbeam", "Stardust", "Nebula", "Orbit", "Rocket", "Galaxy", "Meteor", "Saturn", "Twinkle"],
  castle: ["Royal", "Turret", "Banner", "Knight", "Drawbridge", "Crown", "Throne", "Dragon", "Golden", "Rampart"],
};
const NAME_B = ["Hop", "Steps", "Climb", "Heights", "Hill", "Ladder", "Way", "Rise", "Summit", "Peak"];
// ------------------------------------------------------------------ stage 101 → ∞: blended worlds
/** every pair of worlds (45); each cycle of 45 chapters plays them all in a new order, so a blend never repeats soon */
const PAIRS: [number, number][] = [];
for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) PAIRS.push([i, j]);
const BLEND_ADJ: Record<WorldId, string[]> = {
  garden: ["Blooming", "Petal", "Honey"], candy: ["Sugar", "Sprinkle", "Lollipop"], snow: ["Frosty", "Snowy", "Icy"], toy: ["Wind-up", "Clockwork", "Toybox"],
  beach: ["Sunny", "Breezy", "Seashell"], spooky: ["Moonlit", "Misty", "Lantern"], jungle: ["Wild", "Leafy", "Vine"], lava: ["Fiery", "Ember", "Smoky"],
  space: ["Starry", "Cosmic", "Comet"], castle: ["Royal", "Banner", "Knightly"],
};
const BLEND_NOUN: Record<WorldId, string[]> = {
  garden: ["Meadows", "Gardens", "Hills"], candy: ["Clouds", "Swirls", "Drops"], snow: ["Peaks", "Slopes", "Summit"], toy: ["Tower", "Stacks", "Workshop"],
  beach: ["Shores", "Lagoon", "Bay"], spooky: ["Hollow", "Woods", "Manor"], jungle: ["Canopy", "Treetops", "Falls"], lava: ["Cliffs", "Crater", "Ridge"],
  space: ["Orbit", "Skies", "Rings"], castle: ["Keep", "Spires", "Walls"],
};
function shuffled<T>(a: readonly T[], seed: number): T[] {
  const r = rng(seed), b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function blendOfRaw(c: number): [number, number] {
  const k = c - CHAPTER_SIZE, list = shuffled(PAIRS, 9001 + Math.floor(k / PAIRS.length) * 7919);
  const [a, b] = list[k % PAIRS.length];
  return rng(c * 131 + 7)() < 0.5 ? [b, a] : [a, b];
}
/** chapter ≥ 10: the main world (its look and platforms) and the one blended in */
export function blendOf(c: number): { a: number; b: number } {
  let [a, b] = blendOfRaw(c);
  // never the same main world two chapters running
  if (c > CHAPTER_SIZE && blendOfRaw(c - 1)[0] === a) [a, b] = [b, a];
  return { a, b };
}
/** the 10 stage types of a chapter: in order up to 100, reshuffled after (warm-up first, a breather early, the boss last) */
export function chapterTypes(c: number): StageType[] {
  if (c < CHAPTER_SIZE) return STAGE_TYPES;
  const mid = shuffled<StageType>(["notes", "friends", "chase", "puzzle", "time", "long", "storm"], c * 977 + 3);
  mid.splice(1 + Math.floor(rng(c * 31 + 1)() * 4), 0, "comet");
  return ["warmup", ...mid, "boss"];
}
/** the place name of a blend; the chapter picks one of three words each, so a pair that comes back has a new name */
export const placeOf = (a: number, b?: number, c = 0) => {
  if (b == null) return WORLDS[a].name;
  const h = Math.imul(c + 1, 2654435761) >>> 0;
  return `${BLEND_ADJ[WORLDS[b].id][h % 3]} ${BLEND_NOUN[WORLDS[a].id][(h >>> 4) % 3]}`;
};

export function stageDef(n: number): StageDef {
  const c = Math.floor((n - 1) / CHAPTER_SIZE), s = ((n - 1) % CHAPTER_SIZE) + 1;
  if (n > HAND_STAGES) {
    const { a, b } = blendOf(c), A = WORLDS[a], B = WORLDS[b], type = chapterTypes(c)[s - 1];
    const r = rng(n * 53 + 11), from = r() < 0.5 ? A : B;
    const words = NAME_A[from.id], name = type === "boss" ? `${(c % 2 ? B : A).villainName}'s Tower` : `${words[Math.floor(r() * words.length)]} ${NAME_B[Math.floor(r() * NAME_B.length)]}`;
    return { n, id: `s${n}`, world: a, mix: b, s, type, name, place: placeOf(a, b, c), emoji: `${A.emoji}${B.emoji}` };
  }
  const wi = Math.min(c, WORLDS.length - 1), w = WORLDS[wi];
  const A = NAME_A[w.id];
  // a fixed shuffle per chapter so names never repeat inside a chapter
  const ia = (s * 7 + c * 3) % A.length, ib = (s * 3 + c * 5) % NAME_B.length;
  const type = STAGE_TYPES[s - 1];
  return { n, id: `s${n}`, world: wi, s, type, name: type === "boss" ? `${w.villainName}'s Tower` : `${A[ia]} ${NAME_B[ib]}`, place: w.name, emoji: w.emoji };
}

/** difficulty 0 … ~1.2 by stage 100, then a slow endless climb */
export function difficulty(n: number): number {
  const c = Math.floor((n - 1) / CHAPTER_SIZE), s = ((n - 1) % CHAPTER_SIZE) + 1;
  const chap = n <= 100 ? 0.12 * c : 1.08 + 0.14 * Math.log2(1 + (n - 100) / 25);
  const within = [0, 0.02, 0.04, -0.03, 0.07, 0.05, 0.06, 0.08, 0.1, 0.12][s - 1];
  return Math.max(0, chap + within);
}

// ------------------------------------------------------------------ friends and power cards
/** each chapter brings one more friend: Pip in Garden … Kranky at the Castle */
export const FRIEND_ORDER: FriendId[] = ["pip", "zib", "bolt", "gloop", "bonbon", "hoot", "turbo", "noodle", "tiki", "kranky"];
export const friendsOpen = (world: number): FriendId[] => FRIEND_ORDER.slice(0, Math.min(FRIEND_ORDER.length, world + 1));
export const FRIENDS: Record<FriendId, { name: string; power: string; img: string; color: string }> = {
  pip: { name: "Pip", power: "slows nearby Grumpies", img: "/brand/chars/pip-happy.webp", color: "#2F3D8F" },
  zib: { name: "Zib", power: "pulls in coins and notes", img: "/brand/chars/zib-happy.webp", color: "#9B5BE0" },
  bolt: { name: "Bolt", power: "bounces higher", img: "/brand/chars/bolt-happy.webp", color: "#7FD8C4" },
  gloop: { name: "Gloop", power: "sticky feet: wider landings", img: "/brand/chars/gloop-happy.webp", color: "#8FD14F" },
  bonbon: { name: "Bonbon", power: "cake bomb clears the sky", img: "/brand/chars/bonbon-happy.webp", color: "#FF8FB8" },
  hoot: { name: "Prof. Hoot", power: "the goo rises slower", img: "/brand/chars/hoot-happy.webp", color: "#9A6B45" },
  turbo: { name: "Turbo", power: "faster steering", img: "/brand/chars/turbo-happy.webp", color: "#FFB000" },
  noodle: { name: "Noodle", power: "easier Perfect timing", img: "/brand/chars/noodle-happy.webp", color: "#D49452" },
  tiki: { name: "Tiki", power: "springier Perfect Boings", img: "/brand/tiki.webp", color: "#3FC1B0" },
  kranky: { name: "Kranky", power: "snips Grumpies that come close", img: "/brand/kranky.webp", color: "#E8504F" },
};
export const CARDS: Record<CardId, { name: string; icon: string; text: string; color: string }> = {
  double: { name: "Double Boing", icon: "🦘", text: "Tap in mid-air for one extra jump", color: "#FF8A3D" },
  spring: { name: "Spring Shoes", icon: "👟", text: "Every bounce goes higher", color: "#2FCB8B" },
  magnet: { name: "Coin Magnet", icon: "🧲", text: "Coins and notes fly to you", color: "#FF5F7E" },
  wide: { name: "Wide Feet", icon: "🦶", text: "Land on platform edges", color: "#3D8BFF" },
  shield: { name: "Bubble Shield", icon: "🫧", text: "One free save, like a friend", color: "#4FB8E8" },
  lucky: { name: "Lucky Comet", icon: "☄️", text: "One less Perfect for a Comet", color: "#E0A100" },
  slowgoo: { name: "Slow Goo", icon: "🐌", text: "The goo rises much slower", color: "#8F6BFF" },
  cloud: { name: "Cloud Maker", icon: "☁️", text: "A cloud catches you once if you fall", color: "#5FA8E8" },
};
export const CARD_IDS = Object.keys(CARDS) as CardId[];

// ------------------------------------------------------------------ the generator
type Rng = () => number;
function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seededRng = rng;
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const pick = <T,>(r: Rng, a: readonly T[]) => a[Math.floor(r() * a.length)];

type Seg = "zigzag" | "column" | "scatter" | "movers" | "crumbleRun" | "springJump" | "pairs" | "gumLaunch" | "iceSteps" | "windBand" | "cloudSteps"
  | "trampSteps" | "cannonShot" | "ballRoll" | "spoutRide" | "ghostSteps" | "vineClimb" | "ventSteps" | "geyserRide" | "planetHop" | "bridgeRun";
const WORLD_SEGS: Record<WorldId, Seg[]> = {
  garden: ["springJump", "movers"],
  candy: ["gumLaunch", "cloudSteps", "movers"],
  snow: ["iceSteps", "windBand", "movers"],
  toy: ["trampSteps", "cannonShot", "movers"],
  beach: ["ballRoll", "spoutRide", "cloudSteps"],
  spooky: ["ghostSteps", "ghostSteps", "crumbleRun"],
  jungle: ["vineClimb", "springJump", "movers"],
  lava: ["ventSteps", "geyserRide", "crumbleRun"],
  space: ["planetHop", "planetHop", "movers"],
  castle: ["bridgeRun", "cannonShot", "trampSteps"],
};

/** per-stage difficulty trim from scripts/boing_tune.mjs (1 = as generated): scales every knob's difficulty */
export const STAGE_EASE: number[] = [
  2.10, 1.42, 2.10, 2.10, 2.10, 1.71, 2.10, 2.10, 2.10, 2.10,
  2.10, 2.10, 1.92, 2.10, 1.93, 1.77, 1.00, 1.21, 0.25, 1.05,
  2.10, 1.56, 2.10, 2.10, 1.92, 1.58, 1.23, 0.77, 0.25, 1.04,
  2.10, 1.12, 1.42, 2.10, 1.33, 0.88, 0.81, 0.89, 0.67, 1.00,
  2.10, 1.27, 0.99, 2.10, 0.82, 0.25, 0.40, 0.65, 0.56, 0.72,
  2.10, 0.87, 0.75, 2.10, 0.94, 0.39, 0.42, 0.42, 0.43, 0.25,
  2.08, 0.30, 0.38, 2.10, 0.73, 0.64, 0.72, 0.25, 0.25, 0.38,
  2.10, 0.34, 0.92, 2.10, 0.88, 0.55, 0.25, 0.43, 0.39, 0.45,
  2.10, 0.36, 0.61, 2.10, 0.31, 0.34, 0.33, 0.44, 0.26, 0.41,
  0.99, 0.56, 0.75, 2.10, 0.86, 0.57, 0.42, 0.55, 0.25, 0.25,
];

/** stage 101+ and the Daily Sky: the trim of this stage type over the last hand-shaped chapters */
export function typeEase(type: StageType) {
  const s = STAGE_TYPES.indexOf(type) + 1;
  let sum = 0, n = 0;
  for (let c = 6; c < 10; c++) { const v = STAGE_EASE[c * CHAPTER_SIZE + s - 1]; if (v != null) { sum += v; n++; } }
  return n ? sum / n : 1;
}
/** stage 101+: a per-type trim on top of typeEase, fitted with scripts/boing_tune_late.mjs (the blends and twists make some types harder) */
const LATE_TRIM: Record<StageType, number> = {
  warmup: 0.85, notes: 0.75, friends: 0.62, comet: 0.85, chase: 0.5, puzzle: 0.55, time: 0.68, long: 0.7, storm: 0.68, boss: 0.65,
};
const TODS: TimeOfDay[] = ["day", "sunset", "night", "morning", "aurora", "day", "sunset"];
const TWISTS: Twist[] = ["windy", "tiny", "fastgoo", "floaty", "night"];
export const TWIST_INFO: Record<Twist, { icon: string; text: string }> = {
  windy: { icon: "🌬️", text: "Windy!" }, tiny: { icon: "🤏", text: "Tiny platforms" }, fastgoo: { icon: "🟣", text: "Fast goo" },
  floaty: { icon: "🪶", text: "Low gravity" }, night: { icon: "🌙", text: "Night climb" },
};
function weatherFor(a: WorldId, b: WorldId | undefined, tod: TimeOfDay, r: Rng): Weather {
  const opts: Weather[] = [];
  for (const w of [a, b]) {
    if (w === "snow") opts.push("snow");
    if (w === "candy") opts.push("sprinkles");
    if (w === "garden" || w === "jungle") opts.push("leaves");
    if (w === "lava") opts.push("embers");
    if (w === "space") opts.push("stars");
    if (w === "beach") opts.push("bubbles");
    if (w === "spooky") opts.push("fireflies");
  }
  if (tod === "night" || tod === "aurora") opts.push("fireflies", "stars");
  return opts.length ? opts[Math.floor(r() * opts.length)] : "none";
}

export interface BuildOpts { demo?: boolean; seed?: number; endless?: boolean; ease?: number; /** the quiet helper: after a few losses the stage gets a little kinder */ help?: boolean; /** Daily Sky: difficulty follows the player */ d?: number; daily?: string }

export function buildStage(def: StageDef, o: BuildOpts = {}): StageSpec {
  const seed = o.seed ?? def.n * 7919 + 101;
  const r = rng(seed);
  const W = WORLDS[def.world], theme = W.id, c = Math.floor((def.n - 1) / CHAPTER_SIZE);
  const MW = def.mix != null ? WORLDS[def.mix] : undefined, mix = MW?.id;
  const type = def.type;
  const endless = !!o.endless;
  // sky mood and twist come from their own dice, so they never change a stage's layout
  const rp = rng(seed + 977);
  const late = def.n > HAND_STAGES || !!o.daily;
  const tod: TimeOfDay = late ? TODS[Math.floor(rng(c * 211 + 5)() * TODS.length)] : "day";
  let twist: Twist | undefined = late && !endless && rp() < 0.18 + 0.12 * Math.min(1, (def.n - HAND_STAGES) / 150) ? TWISTS[Math.floor(rp() * TWISTS.length)] : undefined;
  if (twist === "floaty" && (theme === "space" || mix === "space")) twist = "windy";
  if (twist === "night" && tod === "night") twist = "tiny";
  let d = o.d ?? difficulty(def.n);
  if (type === "comet") d -= 0.04;
  const d0 = d;
  const ease = (endless ? 1 : o.ease ?? (late ? typeEase(type) * LATE_TRIM[type] : STAGE_EASE[def.n - 1] ?? 1)) * (o.help ? 0.75 : 1);
  // past stage 100 the climb keeps getting a little harder, slowly (difficulty() grows like a log)
  const grow = late ? Math.max(1, 1 + 0.5 * (d - 1.08)) : 1;
  const k = Math.min(1.3, Math.min(1, d) * ease * grow);
  // stage height: grows through the chapter and with every chapter (it levels off in the later worlds)
  let top = Math.round(66 + 5 * def.s + Math.min(c, 5) * 22 + Math.max(0, c - 5) * 8);
  if (type === "long") top = Math.round(top * 1.5);
  if (type === "comet") top = Math.round(top * 0.9);
  if (o.demo) top = 240;
  if (late) top = Math.min(top, 290);
  if (endless) top = 1500;
  const space = theme === "space";
  const floaty = space || mix === "space" || twist === "floaty";

  const plats: PlatSpec[] = [], enemies: EnemySpec[] = [], items: ItemSpec[] = [], winds: WindSpec[] = [], vines: VineSpec[] = [], lifts: LiftSpec[] = [];
  let y = 0, x = 0;
  // Endless Climb gets harder the higher you go
  const kAt = (yy: number) => (endless ? Math.min(1.25, d0 + yy / 700) : k);
  const kNow = () => Math.min(1, kAt(y));
  const width = () => Math.max(1.0, (1.95 - 0.6 * Math.min(1.1, kAt(y)) + between(r, -0.15, 0.15)) * (twist === "tiny" ? 0.82 : 1));
  const moveShare = () => 0.06 + 0.24 * kNow();
  const decoyCrumble = 0.15 + 0.35 * k;

  // the starting ledge: wide and safe
  plats.push({ x: 0, y: 0, w: 3.2, kind: "solid" });
  const main: PlatSpec[] = [];
  const add = (p: PlatSpec) => { plats.push(p); main.push(p); y = p.y; x = p.x; return p; };
  const stepGap = (m = 1) => between(r, 1.25 + 0.4 * kNow(), 1.85 + 0.6 * kNow()) * m;
  const nextX = (spread: number) => {
    let nx = x + between(r, -spread, spread);
    // never straight up for long: nudge away from the last spot
    if (Math.abs(dxWrap(x, nx)) < 0.6) nx += (r() < 0.5 ? -1 : 1) * 1.1;
    return Math.max(-HALF + 0.7, Math.min(HALF - 0.7, nx));
  };
  const coinArc = (a: PlatSpec, b: PlatSpec) => {
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 1), cx = a.x + dxWrap(a.x, b.x) * f, cy = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 1.4 + 0.6;
      items.push({ kind: "coin", x: Math.max(-HALF + 0.3, Math.min(HALF - 0.3, cx)), y: cy });
    }
  };
  const solidKind = (): PlatKind => (space ? "planet" : "solid");

  // ---- segment builders (each climbs ~8–16 units)
  const seg = (s: Seg, until: number) => {
    switch (s) {
      case "zigzag": {
        let side = x > 0 ? -1 : 1;
        while (y < until) { add({ x: Math.max(-HALF + 0.8, Math.min(HALF - 0.8, side * between(r, 1.2, 2.6))), y: y + stepGap(), w: width(), kind: solidKind() }); side = -side; }
        break;
      }
      case "column": while (y < until) add({ x: nextX(1.2), y: y + stepGap(0.9), w: width() + 0.2, kind: solidKind() }); break;
      case "scatter": while (y < until) add({ x: nextX(3.2), y: y + stepGap(), w: width(), kind: r() < moveShare() ? "move" : solidKind(), amp: between(r, 0.8, 1.4 + k), spd: between(r, 0.8, 1.4 + 1.2 * k), ph: r() * 6.28 }); break;
      case "movers": while (y < until) add({ x: between(r, -1, 1), y: y + stepGap(0.95), w: width(), kind: "move", amp: between(r, 1.2, 1.8 + 0.8 * kNow()), spd: between(r, 0.9, 1.5 + 1.2 * kNow()), ph: r() * 6.28 }); break;
      case "crumbleRun":
        // crumbly steps, each with a solid one close by in case a step goes
        while (y < until) {
          const p = add({ x: nextX(2.4), y: y + stepGap(0.9), w: width(), kind: "crumble" });
          if (r() < 0.9 - 0.3 * kNow()) plats.push({ x: wrapX(p.x + (r() < 0.5 ? -1 : 1) * between(r, 1.8, 2.6)), y: p.y - between(r, 0.6, 1.1), w: width() * 0.85, kind: solidKind() });
        }
        break;
      case "springJump": {
        add({ x: nextX(2), y: y + stepGap(), w: width(), kind: "spring" });
        // a big gap only a spring can clear, with a coin trail up the middle
        const gap = between(r, 5.5, 7.5);
        for (let i = 1; i <= 5; i++) items.push({ kind: "coin", x, y: y + (gap * i) / 6 + 0.5 });
        add({ x: nextX(1.6), y: y + gap, w: width() + 0.3, kind: solidKind() });
        while (y < until) add({ x: nextX(2.6), y: y + stepGap(), w: width(), kind: solidKind() });
        break;
      }
      case "pairs":
        while (y < until) {
          const yy = y + stepGap(1.05), a = between(r, -2.6, -0.9), b = between(r, 0.9, 2.6);
          const safeLeft = r() < 0.5;
          plats.push({ x: safeLeft ? b : a, y: yy, w: width() * 0.9, kind: r() < 0.5 + 0.3 * kNow() ? "crumble" : solidKind() });
          add({ x: safeLeft ? a : b, y: yy, w: width(), kind: solidKind() });
        }
        break;
      case "gumLaunch":
        while (y < until) {
          add({ x: nextX(2.2), y: y + stepGap(), w: width(), kind: "gum" });
          add({ x: nextX(2.2), y: y + between(r, 4.2, 5.6), w: width(), kind: r() < 0.4 ? "cloud" : "solid" });
        }
        break;
      case "cloudSteps":
        while (y < until) {
          const p = add({ x: nextX(2.8), y: y + stepGap(), w: width(), kind: r() < 0.6 ? "cloud" : "solid" });
          if (r() < 0.5) plats.push({ x: wrapX(p.x + between(r, 2, 3)), y: p.y + between(r, -0.4, 0.4), w: width() * 0.8, kind: "cloud" });
        }
        break;
      case "iceSteps": while (y < until) add({ x: nextX(2.8), y: y + stepGap(), w: width() + 0.15, kind: r() < 0.7 ? "ice" : "solid" }); break;
      case "windBand": {
        const y0 = y + 1;
        while (y < until) add({ x: nextX(2.4), y: y + stepGap(0.95), w: width() + 0.2, kind: r() < 0.4 ? "ice" : "solid" });
        winds.push({ y0, y1: y, force: (r() < 0.5 ? -1 : 1) * between(r, 1.6, 2.4 + 1.6 * kNow()) });
        break;
      }
      // ---- Phase 2 worlds
      case "trampSteps":
        while (y < until) {
          add({ x: nextX(2.4), y: y + stepGap(), w: width() * 0.9, kind: "tramp" });
          // a trampoline throws Momo high: the next step can be far up
          add({ x: nextX(2.4), y: y + between(r, 3.6, 5.2), w: width(), kind: r() < moveShare() ? "move" : "solid", amp: between(r, 0.8, 1.6), spd: between(r, 0.9, 1.6), ph: r() * 6.28 });
        }
        break;
      case "cannonShot": {
        add({ x: nextX(2), y: y + stepGap(), w: 1.3, kind: "cannon" });
        const gap = between(r, 9, 12);
        for (let i = 1; i <= 7; i++) items.push({ kind: "coin", x, y: y + (gap * i) / 8 + 0.8 });
        add({ x: nextX(1.4), y: y + gap, w: width() + 0.5, kind: "solid" });
        while (y < until) add({ x: nextX(2.6), y: y + stepGap(), w: width(), kind: "solid" });
        break;
      }
      case "ballRoll": while (y < until) add({ x: between(r, -1.2, 1.2), y: y + stepGap(), w: width() + 0.1, kind: r() < 0.65 ? "ball" : "solid", amp: between(r, 1.0, 1.8 + 0.6 * kNow()), spd: between(r, 0.7, 1.2 + 0.9 * kNow()), ph: r() * 6.28 }); break;
      case "spoutRide": {
        add({ x: nextX(2), y: y + stepGap(), w: width(), kind: "solid" });
        const len = between(r, 7, 10), sx = wrapX(x + (r() < 0.5 ? -1 : 1) * between(r, 1.3, 2.0));
        lifts.push({ x: sx, y0: y - 0.5, y1: y + len, kind: "spout", ph: 0 });
        for (let i = 1; i <= 5; i++) items.push({ kind: "coin", x: sx, y: y + (len * i) / 6 });
        add({ x: nextX(1.6), y: y + len + 0.6, w: width() + 0.3, kind: "solid" });
        while (y < until) add({ x: nextX(2.6), y: y + stepGap(), w: width(), kind: r() < 0.4 ? "ball" : "solid", amp: 1.2, spd: 0.9, ph: r() * 6.28 });
        break;
      }
      case "ghostSteps":
        // ghost platforms fade in and out; their twins glow while they are dark
        while (y < until) {
          const p = add({ x: nextX(2.6), y: y + stepGap(0.95), w: width() + 0.1, kind: r() < 0.7 ? "ghost" : "solid", ph: r() * 6.28 });
          if (p.kind === "ghost" && r() < 0.55) plats.push({ x: wrapX(p.x + (r() < 0.5 ? -1 : 1) * between(r, 2.2, 3)), y: p.y + between(r, -0.3, 0.3), w: width() * 0.9, kind: "ghost", ph: (p.ph ?? 0) + Math.PI });
        }
        break;
      case "vineClimb": {
        add({ x: nextX(2), y: y + stepGap(), w: width(), kind: "solid" });
        const len = between(r, 7, 11), vx = wrapX(x + (r() < 0.5 ? -1 : 1) * between(r, 1.2, 2.0));
        vines.push({ x: vx, y0: y + 1.2, y1: y + 1.2 + len });
        for (let i = 1; i <= 4; i++) items.push({ kind: "coin", x: wrapX(vx + (i % 2 ? 0.6 : -0.6)), y: y + 1.2 + (len * i) / 5 });
        add({ x: nextX(1.6), y: y + len + 1.6, w: width() + 0.3, kind: "solid" });
        while (y < until) add({ x: nextX(2.6), y: y + stepGap(), w: width(), kind: "solid" });
        break;
      }
      case "ventSteps":
        while (y < until) add({ x: nextX(2.6), y: y + stepGap(), w: width(), kind: r() < 0.45 ? "vent" : r() < 0.3 ? "crumble" : "solid", ph: r() * 6.28 });
        break;
      case "geyserRide": {
        add({ x: nextX(2), y: y + stepGap(), w: width(), kind: "solid" });
        const len = between(r, 7, 10), gx = wrapX(x + (r() < 0.5 ? -1 : 1) * between(r, 1.2, 2.0));
        lifts.push({ x: gx, y0: y - 0.5, y1: y + len, kind: "geyser", ph: r() * 3 });
        // steps beside the geyser in case it is resting
        for (let yy = y + 2.2; yy < y + len; yy += between(r, 2.0, 2.6)) plats.push({ x: wrapX(gx + (r() < 0.5 ? -1 : 1) * 2.4), y: yy, w: width() * 0.9, kind: "solid" });
        add({ x: nextX(1.6), y: y + len + 0.6, w: width() + 0.3, kind: "solid" });
        break;
      }
      case "planetHop": while (y < until) add({ x: nextX(2.8), y: y + stepGap(0.92), w: Math.max(1.35, width()), kind: "planet" }); break;
      case "bridgeRun":
        while (y < until) {
          const p = add({ x: nextX(2.6), y: y + stepGap(), w: width() + 0.2, kind: r() < 0.6 ? "bridge" : "solid", ph: r() * 6.28 });
          if (p.kind === "bridge") plats.push({ x: wrapX(p.x + (r() < 0.5 ? -1 : 1) * between(r, 2.3, 3)), y: p.y - between(r, 0.5, 1.0), w: width() * 0.85, kind: "solid" });
        }
        break;
    }
  };

  // which segments this world/type uses
  const base: Seg[] = ["zigzag", "scatter", "column", "pairs"];
  // a blended chapter mixes both worlds' platforms
  const worldSegs = mix ? [...new Set([...WORLD_SEGS[theme], ...WORLD_SEGS[mix]])] : WORLD_SEGS[theme];
  const hard: Seg[] = k > 0.15 ? ["crumbleRun"] : [];
  const pool: Seg[] = type === "puzzle" && !endless ? worldSegs
    : type === "warmup" && !endless ? ["column", "zigzag", worldSegs[0], "zigzag", worldSegs[0]]
    : type === "comet" && !endless ? ["column", "zigzag", "column"]
    : [...base, ...worldSegs, ...worldSegs, ...hard];
  // first segment is always easy so the goo has time to wake up
  seg("column", 8);
  let last: Seg = "column";
  // Safe Clouds stop the goo and offer a power card (Long Climbs everywhere; busy stages from World 4 on; Endless every 120 m)
  const safeAt = endless ? Array.from({ length: 12 }, (_, i) => 110 + i * 120)
    : type === "long" ? [top / 3, (2 * top) / 3]
    : c >= 3 && (type === "friends" || type === "chase" || type === "puzzle" || type === "storm" || type === "boss") ? [top * 0.5] : [];
  let si = 0;
  while (y < top - 4) {
    let s = pick(r, pool);
    if (s === last && pool.length > 1) s = pick(r, pool);
    last = s;
    const target = Math.min(top - 3, y + between(r, 8, 15));
    seg(s, target);
    if (si < safeAt.length && y >= safeAt[si]) { add({ x: 0, y: y + stepGap(), w: 3.4, kind: "safe" }); si++; }
  }
  // the finish: a wide golden cloud
  const fin = add({ x: 0, y: Math.round(Math.max(top, y + 2.2)), w: 5.4, kind: "finish" });
  top = fin.y;

  // ---- decoys between the path: some crumble, some hold a sitting Grumpy
  for (let i = 1; i < main.length - 1; i++) {
    const a = main[i];
    if (a.kind === "finish" || a.kind === "safe" || r() > 0.42) continue;
    const yy = a.y + between(r, 0.7, 1.3), xx = wrapX(a.x + (r() < 0.5 ? -1 : 1) * between(r, 2.2, 3.2));
    const kind: PlatKind = (theme === "candy" || mix === "candy") && r() < 0.3 ? "cloud" : (theme === "spooky" || mix === "spooky") && r() < 0.4 ? "ghost" : r() < decoyCrumble ? "crumble" : solidKind();
    plats.push({ x: xx, y: yy, w: width() * 0.85, kind, ph: r() * 6.28 });
  }

  // ---- coins along some jumps
  for (let i = 1; i < main.length - 1; i++) if (r() < (type === "comet" ? 0.5 : type === "puzzle" ? 0.45 : 0.22)) coinArc(main[i - 1], main[i]);

  // ---- enemies: bees cross the gaps, Grumpies sit on decoys
  for (let i = 3; i < main.length - 2; i++) {
    const a = main[i], b = main[i + 1], kk = Math.min(1, kAt(a.y));
    let enemyRate = (0.15 + 0.26 * kk) * (type === "storm" ? 2.0 : type === "warmup" || type === "comet" ? 0.45 : 1);
    if (def.n <= 2 && !endless) enemyRate = def.n === 1 ? 0 : 0.12;
    // never in a launch gap (springs, trampolines, cannons, vines, spouts): Momo cannot steer around them up there
    if (b.y - a.y < 1.5 || b.y - a.y > 3.4 || a.kind === "tramp" || a.kind === "vent" || r() > enemyRate * (b.y - a.y) / 2.2) continue;
    if (r() < 0.65) {
      const yy = (a.y + b.y) / 2 + 0.3, span = between(r, 2.4, 4.6), cx = between(r, -1.2, 1.2);
      enemies.push({ kind: "bee", x: cx, y: yy, x0: Math.max(-HALF + 0.4, cx - span / 2), x1: Math.min(HALF - 0.4, cx + span / 2), spd: between(r, 1.0, 1.6 + 1.4 * kk) });
    } else {
      const p: PlatSpec = { x: wrapX(a.x + (r() < 0.5 ? -1 : 1) * between(r, 2.3, 3.1)), y: (a.y + b.y) / 2, w: 1.5, kind: solidKind() };
      plats.push(p);
      enemies.push({ kind: "sitter", x: p.x, y: p.y });
    }
  }

  // ---- music notes off the path (Note Collector has plenty)
  const noteCount = type === "notes" && !endless ? 8 + 2 * Math.min(c, 6) : 0;
  for (let i = 0; i < noteCount; i++) {
    const a = main[Math.floor(((i + 0.6) / noteCount) * (main.length - 2)) + 1];
    items.push({ kind: "note", x: wrapX(a.x + (r() < 0.5 ? -1 : 1) * between(r, 1.6, 2.6)), y: a.y + between(r, 1.0, 2.2) });
  }

  // ---- friends in bubbles
  const open = late ? FRIEND_ORDER : friendsOpen(def.world);
  const fCount = (endless ? 9 : type === "friends" ? 3 : type === "chase" ? 2 : def.n === 1 ? 1 : r() < 0.5 ? 1 : 2) + (o.help ? 1 : 0);
  for (let i = 0; i < fCount; i++) {
    const at = type === "chase" && !endless ? 0.12 + i * 0.12 : (i + 0.6) / (fCount + 0.4);
    const a = main[Math.min(main.length - 2, Math.max(2, Math.floor(at * main.length)))];
    // the newest friend of the chapter shows up first
    const friend = i === 0 && !endless ? open[open.length - 1] : open[(i + def.n) % open.length];
    items.push({ kind: "friend", friend, x: wrapX(a.x + (r() < 0.5 ? -1 : 1) * between(r, 1.2, 2.0)), y: a.y + between(r, 1.3, 2.0) });
  }

  // ---- goo, drops, villain
  const gooMul = endless ? 0.9 : type === "chase" ? 1.32 : type === "comet" ? 0.6 : type === "time" ? 1.1 : type === "warmup" ? 0.8 : 1;
  const goo = { start: -9, speed: (0.75 + 0.62 * k) * gooMul * (floaty ? 0.8 : 1) * (twist === "fastgoo" ? 1.25 : 1), lag: type === "chase" && !endless ? 3.8 : 5.6 - 1.1 * k };
  const dropEvery = def.n <= 3 && !endless ? 0 : (theme === "snow" || theme === "space" ? 5.6 : 7.5) - 3 * k;
  const dropW = MW && rp() < 0.5 ? MW : W;
  const drops = { kind: dropW.drop, every: type === "storm" ? Math.max(2.4, dropEvery * 0.65) : (type === "warmup" || type === "comet") && !endless ? 0 : Math.max(3.2, dropEvery) };
  const villain = type === "boss" && !endless ? { kind: (MW && c % 2 ? MW : W).villain, every: Math.max(1.4, 2.6 - 1.2 * k) } : undefined;
  const window = (0.16 - 0.05 * k) * (type === "comet" ? 1.6 : 1);

  // ---- the stage goal (2nd star; the 3rd is the same goal with no bumps)
  const climbTime = Math.round((top / 2.05) * 1.18 * (space ? 1.25 : 1) / 5) * 5 + 5;
  const coinsPlaced = items.filter((i) => i.kind === "coin").length;
  const goal: Goal = endless ? { kind: "coins", value: 1e9, text: "Climb as high as you can" } : (() => {
    switch (type) {
      case "warmup": { const v = 3 + Math.min(c, 5); return { kind: "perfects", value: v, text: `Land ${v} Perfect Boings` }; }
      case "notes": { const v = noteCount - 2; return { kind: "notes", value: v, text: `Collect ${v} music notes` }; }
      case "friends": return { kind: "friends", value: 3, text: "Rescue all 3 friends" };
      case "comet": return { kind: "comets", value: 2, text: "Fire 2 Comets" };
      case "chase": return { kind: "stack", value: 1, text: "Finish with a friend on your head" };
      case "puzzle": { const v = Math.max(5, Math.floor(coinsPlaced * 0.7)); return { kind: "coins", value: v, text: `Collect ${v} coins` }; }
      case "long": { const v = 10 + 2 * Math.min(c, 5); return { kind: "perfects", value: v, text: `Land ${v} Perfect Boings` }; }
      case "storm": { const v = 3 + Math.min(c, 5); return { kind: "stomps", value: v, text: `Bounce on ${v} Grumpies` }; }
      default: return { kind: "time", value: climbTime, text: `Reach the top in ${climbTime} seconds` };
    }
  })();

  return {
    id: endless ? "endless" : def.id, n: def.n, world: def.world, theme, type, name: endless ? "Endless Climb" : def.name, d, top, plats, enemies, items, winds, vines, lifts,
    grav: floaty ? 0.6 : 1, jump: floaty ? 0.79 : 1, rising: dropW.id === "lava",
    goo, drops, villain, window, goal, seed, demo: o.demo, endless, ...songOf(def, W, MW), mix, tod: twist === "night" ? "night" : tod, weather: late ? weatherFor(theme, mix, tod, rp) : "none", twist,
    place: def.place, emoji: def.emoji, daily: o.daily,
  };
}

/** the bounce song: up to stage 100 each world plays its own; after that the bed alternates between the two worlds,
 *  the bounce voice is the other world's instrument and the tune is re-arranged (still in the bed's key) */
function songOf(def: StageDef, W: WorldDef, MW?: WorldDef): { music: WorldId; voice: string; tune: number[] } {
  if (!MW) return { music: W.id, voice: W.voice, tune: W.tune };
  const bed = def.s % 2 ? W : MW, other = bed === W ? MW : W, t = bed.tune, h = t.length / 2;
  const v = def.n % 4;
  const tune = v === 0 ? t : v === 1 ? [...t.slice(h), ...t.slice(0, h)] : v === 2 ? t.map((m, i) => (i >= h ? m + 12 : m)) : [...t.slice(h).map((m) => m - 12), ...t.slice(0, h)];
  return { music: bed.id, voice: other.voice, tune };
}

/** the Daily Sky: one blended stage per day, the same for everyone, as hard as the stage you are on */
export function dailyKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function dailySpec(key: string, current: number): StageSpec {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = rng(h), c = CHAPTER_SIZE + (h % 450);
  const { a, b } = blendOf(c), type = (["notes", "friends", "chase", "puzzle", "time", "storm", "long"] as StageType[])[Math.floor(r() * 7)];
  const s = STAGE_TYPES.indexOf(type) + 1;
  const def: StageDef = { n: c * CHAPTER_SIZE + s, id: `daily-${key}`, world: a, mix: b, s, type, name: "Daily Sky", place: placeOf(a, b, c), emoji: `${WORLDS[a].emoji}${WORLDS[b].emoji}` };
  return buildStage(def, { seed: h, d: difficulty(Math.max(6, Math.min(140, current))), daily: key });
}

/** Endless Climb: one very tall tower in the newest world you have reached; it gets harder with height */
export function endlessSpec(world: number, seed = Math.floor(Math.random() * 1e6)): StageSpec {
  const w = Math.max(0, Math.min(WORLDS.length - 1, world));
  return buildStage({ ...stageDef(w * CHAPTER_SIZE + 2), world: w }, { endless: true, seed });
}
