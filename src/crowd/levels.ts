// Blob Brigade worlds, stages and the seeded stage generator. Every stage is generated from its number (same layout
// every time you play it); Endless Waves generates a fresh wave from the wave number and a run seed.
import type { BossKind, GateOp, Gate, Goal, GrumpKind, GrumpSpec, JarSpec, Lane, MathMode, Mechanics, PowerUp, Segment, StageSpec, StageType, ThemeId, TileSpec } from "./types";

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
const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();

// ------------------------------------------------------------------ worlds
export type MusicStyle = "march" | "polka" | "sleigh" | "toybox" | "steel" | "spooky" | "jungle" | "brass" | "synth" | "epic";
export interface WorldDef {
  id: ThemeId; name: string; emoji: string; blurb: string; accent: string; accent2: string;
  music: MusicStyle; boss: BossKind; bossName: string; unlockStars: number; newIdea: string;
}
export const WORLDS: WorldDef[] = [
  {
    id: "garden", name: "Garden Path", emoji: "🌱", accent: "#3FBF62", accent2: "#FFD23F", music: "march", boss: "mega", bossName: "Mega Grump", unlockStars: 0,
    blurb: "Kranky's Grumpies are marching through Momo's garden. Grow your brigade on the +1 tiles and bubble them back to happy!",
    newIdea: "+1 tiles, jars and gates",
  },
  {
    id: "candy", name: "Candy Kitchen", emoji: "🧁", accent: "#FF6FB1", accent2: "#7CE0FF", music: "polka", boss: "jelly", bossName: "Jelly King", unlockStars: 12,
    blurb: "Bonbon's kitchen is full of Grumpies in saucepan helmets. Pick the best math gate — ×2 or +10?",
    newIdea: "Math gates and Helmet Grumps",
  },
  {
    id: "snow", name: "Snowy Peaks", emoji: "❄️", accent: "#3FA8F0", accent2: "#FFFFFF", music: "sleigh", boss: "yeti", bossName: "Snow Grump Giant", unlockStars: 30,
    blurb: "Pip's mountain is frozen solid. The ice is slippery — your brigade slides, so move early!",
    newIdea: "Slippery ice and Speedy packs",
  },
  {
    id: "toy", name: "Toy Room", emoji: "🧸", accent: "#FF8A3D", accent2: "#3D8BFF", music: "toybox", boss: "robo", bossName: "Robo Grump", unlockStars: 50,
    blurb: "Bolt's toy room has come alive. Sliding toy blocks swallow your bubbles and Bouncers hop at you!",
    newIdea: "Sliding toy blocks and Bouncers",
  },
  {
    id: "beach", name: "Beach Day", emoji: "🏖️", accent: "#FFB81C", accent2: "#2EC4B6", music: "steel", boss: "boat", bossName: "Captain Kranky's Boat", unlockStars: 72,
    blurb: "Surf's up! Big waves shove your brigade sideways. Pop the Balloon Grumpies for free blobs.",
    newIdea: "Surf waves and Balloon Grumpies",
  },
  {
    id: "spooky", name: "Spooky Night", emoji: "🎃", accent: "#8F6BFF", accent2: "#FF8A3D", music: "spooky", boss: "ghost", bossName: "Grumpy Ghost", unlockStars: 95,
    blurb: "It's dark out here! Splitter Grumpies pop into two little ones. Follow the lanterns.",
    newIdea: "Darkness and Splitters",
  },
  {
    id: "jungle", name: "Jungle Ruins", emoji: "🗿", accent: "#2FAE4A", accent2: "#D9A84E", music: "jungle", boss: "golem", bossName: "Stone Golem", unlockStars: 120,
    blurb: "Old ruins, rolling boulders and Grumpies with wooden shields. Big blobs smash the shields!",
    newIdea: "Rolling boulders and Shield Grumpies",
  },
  {
    id: "lava", name: "Lava Land", emoji: "🌋", accent: "#FF5A1F", accent2: "#FFD23F", music: "brass", boss: "magma", bossName: "Magma Grump", unlockStars: 145,
    blurb: "Lava vents glow before they erupt — step away in time. Goo Cannons everywhere!",
    newIdea: "Lava vents and Goo Cannons",
  },
  {
    id: "space", name: "Space Station", emoji: "🚀", accent: "#4F8BFF", accent2: "#B26BFF", music: "synth", boss: "ufo", bossName: "UFO Mothership", unlockStars: 170,
    blurb: "Zib's space station is under attack. Watch the sky — meteors fall where you stand!",
    newIdea: "Meteor showers",
  },
  {
    id: "castle", name: "Kranky's Castle", emoji: "🏰", accent: "#E8504F", accent2: "#FFD23F", music: "epic", boss: "mech", bossName: "King Kranky Mech", unlockStars: 200,
    blurb: "The final castle. Ice, boulders, lava and meteors all at once — and King Kranky in his giant mech.",
    newIdea: "Everything at once!",
  },
];

export const TYPE_INFO: Record<StageType, { label: string; icon: string; blurb: string }> = {
  learn: { label: "Learn", icon: "🌱", blurb: "Walk onto the +1 tiles to grow your brigade, then stand in front of the Grumpies." },
  classic: { label: "Grumpy March", icon: "🫧", blurb: "A full Grumpy march. Grow, then defend!" },
  gates: { label: "Gate Dash", icon: "🚪", blurb: "Gates first, Grumpies later. Walk through the gate that makes your brigade bigger." },
  pinata: { label: "Piñata Party", icon: "🪅", blurb: "No Grumpies! Bubble the piñatas open before they float past." },
  miniboss: { label: "Villain Hunt", icon: "💪", blurb: "A big villain marches behind the crowd. Chew through the Grumpies and keep your bubbles on him!" },
  rescue: { label: "Rescue Run", icon: "🫙", blurb: "Blobs are stuck in bubble cages inside the march. Pop the cages to free them — they join you!" },
  split: { label: "Two Paths", icon: "🔀", blurb: "A wall splits the march in two. Jump between the paths in time." },
  hold: { label: "Hold the Line", icon: "⏱️", blurb: "Grumpies keep coming for a long time. Hold the line!" },
  big: { label: "Big March", icon: "🌊", blurb: "The biggest march in this world. Grow big first!" },
  boss: { label: "World Boss", icon: "👑", blurb: "The world boss! Bubble his HP down before he reaches you — and dodge his attacks." },
};

const PATTERN: StageType[] = ["learn", "classic", "gates", "pinata", "miniboss", "rescue", "split", "hold", "big", "boss"];
const NAMES: Record<ThemeId, string[]> = {
  garden: ["First Steps", "Clover Lane", "Gate Garden", "Piñata Party", "Big Grump Ahead", "Rescue Run", "Two Paths", "Hold the Line", "The Big March", "Mega Grump"],
  candy: ["Sugar Sums", "Sprinkle Street", "Times-Table Gates", "Cake Piñatas", "Helmet Head", "Jelly Jail", "Split Sundae", "Hold the Frosting", "Grumpy Parade", "Jelly King"],
  snow: ["Frosty Start", "Slippery Slope", "Icicle Gates", "Snowball Party", "Yeti Tracks", "Igloo Rescue", "Twin Glaciers", "Blizzard Hold", "Avalanche March", "Snow Grump Giant"],
  toy: ["Toy Box", "Building Blocks", "Abacus Gates", "Teddy Piñatas", "Wind-up Trouble", "Doll House Rescue", "Train Tracks", "Hold the Fort", "Marble Madness", "Robo Grump"],
  beach: ["Sandy Steps", "Surf's Up", "Seashell Gates", "Coconut Party", "Pirates Ahoy", "Bucket Rescue", "Two Tides", "Hold the Pier", "Beach Stampede", "Captain Kranky"],
  spooky: ["Lantern Walk", "Pumpkin Patch", "Haunted Gates", "Candy Corn Party", "Boo!", "Crypt Rescue", "Fork in the Fog", "Midnight Hold", "Monster Parade", "Grumpy Ghost"],
  jungle: ["Vine Steps", "Temple Path", "Totem Gates", "Mango Party", "Stone Stirs", "Ruin Rescue", "Twin Temples", "Hold the Bridge", "Stampede", "Stone Golem"],
  lava: ["Warm Welcome", "Ember Road", "Fire Gates", "Volcano Party", "Hot Head", "Basalt Rescue", "Lava Forks", "Hold the Heat", "Eruption", "Magma Grump"],
  space: ["Liftoff", "Moon Walk", "Star Gates", "Comet Party", "Close Encounter", "Space Rescue", "Twin Orbits", "Hold the Station", "Meteor March", "UFO Mothership"],
  castle: ["Drawbridge", "Courtyard", "Throne Gates", "Royal Party", "Kranky's Guard", "Dungeon Rescue", "Two Towers", "Hold the Gate", "The Last March", "King Kranky Mech"],
};

export interface StageDef { id: string; n: number; world: number; s: number; type: StageType; name: string; theme: ThemeId }
export const STAGES: StageDef[] = WORLDS.flatMap((w, wi) => PATTERN.map((type, si) => ({
  id: `${w.id}-${si + 1}`, n: wi * 10 + si + 1, world: wi, s: si + 1, type, name: NAMES[w.id][si], theme: w.id,
})));
export const stageById = (id: string) => STAGES.find((s) => s.id === id);

/** a stage is open when the one before it has a star (and its world's star gate is met) */
export function stageOpen(def: StageDef, stars: Record<string, number>): boolean {
  if (def.n === 1) return true;
  const prev = STAGES[def.n - 2];
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  return (stars[prev.id] ?? 0) > 0 && total >= WORLDS[def.world].unlockStars;
}
export const endlessOpen = (stars: Record<string, number>) => (stars["garden-3"] ?? 0) > 0;

// ------------------------------------------------------------------ board geometry
export const HALF = 6.4;
function lanesStd(mirror: boolean): Lane[] {
  const L: Lane[] = [{ kind: "recruit", x0: -6.4, x1: -4.25 }, { kind: "field", x0: -3.85, x1: 3.85 }, { kind: "bonus", x0: 4.25, x1: 6.4 }];
  return mirror ? L.map((l) => ({ ...l, x0: -l.x1, x1: -l.x0 })).reverse() : L;
}
function lanesSplit(mirror: boolean): Lane[] {
  const L: Lane[] = [{ kind: "recruit", x0: -6.4, x1: -4.25 }, { kind: "field", x0: -3.85, x1: -0.2 }, { kind: "field", x0: 0.2, x1: 3.85 }, { kind: "bonus", x0: 4.25, x1: 6.4 }];
  return mirror ? L.map((l) => ({ ...l, x0: -l.x1, x1: -l.x0 })).reverse() : L;
}
const laneOf = (lanes: Lane[], k: Lane["kind"]) => lanes.findIndex((l) => l.kind === k);

export const GRUMP_HP: Record<GrumpKind, number> = { grump: 1, helmet: 3, speedy: 1, jelly: 2, chunky: 6, spitter: 2, bouncer: 2, splitter: 2, shield: 2, balloon: 1 };
export const GRUMP_SPEED: Record<GrumpKind, number> = { grump: 1, helmet: 0.9, speedy: 2.1, jelly: 1.35, chunky: 0.75, spitter: 0.9, bouncer: 1, splitter: 1, shield: 0.85, balloon: 0.8 };
const SPACING = 0.44;
/** the most Grumpies one stage's march can hold (later stages keep this many, each a bit tougher) */
export const CROWD_MAX = 3000;
/** Grumpy HP with two decimals: dense marches use fractions so a big bubble pops a whole row */
const hpR = (v: number) => Math.max(0.2, Math.round(v * 100) / 100);

type Shape = "block" | "wedge" | "waves" | "stripes" | "checker";
interface CarpetOpt {
  helmet: number; shape: Shape; speedyPacks?: number; /** goo throwers in the back rows */ spitters?: number; /** 6-hit Grumpies */ chunky?: number;
  /** each world's own Grumpies, as a share of the carpet */
  extra?: [GrumpKind, number][];
}

/** a marching carpet of Grumpies in one field lane, front row at z0, until `hp` hit points are placed */
function carpet(r: Rng, field: Lane, z0: number, hp: number, o: CarpetOpt): GrumpSpec[] {
  const out: GrumpSpec[] = [];
  const w = field.x1 - field.x0, cols = Math.max(2, Math.floor(w / SPACING)), step = w / cols;
  let placed = 0, row = 0;
  const helmetBand = o.helmet > 0 ? Math.floor(cols * Math.min(0.9, o.helmet * 1.6)) : 0;
  const bandStart = Math.floor(r() * Math.max(1, cols - helmetBand + 1));
  while (placed < hp && row < 400) {
    const z = z0 - row * SPACING;
    for (let c = 0; c < cols && placed < hp; c++) {
      let on = true;
      if (o.shape === "wedge") on = Math.abs(c - (cols - 1) / 2) <= 1 + row * 0.9;
      else if (o.shape === "waves") on = row >= Math.round(1.5 + 1.5 * Math.sin(c * 0.9));
      else if (o.shape === "stripes") on = row % 7 < 5;
      else if (o.shape === "checker") on = (Math.floor(row / 3) + Math.floor(c / 3)) % 2 === 0 || row > 12;
      if (!on) continue;
      const helm = helmetBand > 0 && row >= 2 && c >= bandStart && c < bandStart + helmetBand && r() < 0.85;
      const kind: GrumpKind = helm ? "helmet" : "grump";
      out.push({ x: field.x0 + step * (c + 0.5) + (r() - 0.5) * 0.1, z: z + (r() - 0.5) * 0.12, kind });
      placed += GRUMP_HP[kind];
    }
    row++;
  }
  // spitters hide in the back rows, chunky Grumpies anywhere behind the front
  const inner = out.map((g, i) => (g.kind === "grump" && g.z < z0 - 3 * SPACING ? i : -1)).filter((i) => i >= 0);
  const take = (k: number, kind: GrumpKind) => {
    for (let j = 0; j < k && inner.length; j++) {
      const at = kind === "spitter" ? inner.length - 1 - Math.floor(r() * Math.min(inner.length, cols * 3)) : Math.floor(r() * inner.length);
      out[inner[at]] = { ...out[inner[at]], kind };
      inner.splice(at, 1);
    }
  };
  take(o.spitters ?? 0, "spitter");
  for (const [kind, share] of o.extra ?? []) take(Math.round(inner.length * share), kind);
  take(o.chunky ?? 0, "chunky");
  // speedy packs start inside the carpet and sprint out ahead of it
  for (let p = 0; p < (o.speedyPacks ?? 0); p++) {
    const cx = between(r, field.x0 + 0.6, field.x1 - 0.6), zp = z0 - 5 - p * 4;
    for (let i = 0; i < 4; i++) out.push({ x: Math.max(field.x0 + 0.3, Math.min(field.x1 - 0.3, cx + (i % 2 - 0.5) * 0.6)), z: zp - Math.floor(i / 2) * 0.6, kind: "speedy" });
  }
  return out;
}

/**
 * Recruit tiles in bursts down a conveyor lane. Front-loaded: ~45% of the `supply` arrives in the first burst so the
 * brigade can grow before the march arrives, the rest trickles in over `span` metres. Bigger supplies use bigger tiles
 * (+2, +3, +5) so a stage never needs more than ~45 tiles.
 */
function conveyor(r: Rng, lane: number, supply: number, z0: number, span: number, fives: boolean, thorn = 0, powers: PowerUp[] = []): TileSpec[] {
  const out: TileSpec[] = [];
  const unit = supply <= 45 ? 1 : supply <= 100 ? 2 : supply <= 170 ? 3 : supply <= 300 ? 5 : 10;
  let z = z0, left = supply, burst = 0;
  const first = Math.round(supply * 0.45);
  const rest = Math.max(1, Math.ceil((supply - first) / (unit * 8)));
  const gap = Math.max(3, (span - (supply / unit) * 1.15) / Math.max(1, rest));
  while (left > 0) {
    const want = burst === 0 ? first : Math.min(left, unit * (6 + Math.floor(r() * 5)));
    let got = 0;
    while (got < want && left > 0) {
      const big = fives && left >= unit * 5 && r() < 0.12;
      const v = Math.min(left, big ? unit * 5 : unit);
      out.push({ lane, z, v });
      left -= v; got += v; z -= 1.15;
    }
    if (burst % 2 === 1) { out.push({ lane, z, v: 3, coin: true }); z -= 1.15; }
    // thorn tiles hide between the bursts: step off the conveyor in time
    // power-up tiles sit at the end of the second and fourth bursts
    if ((burst === 1 || burst === 3) && powers.length) { const pw = powers.shift()!; out.push({ lane, z, v: 1, pw }); z -= 1.15; }
    if (thorn < 0 && burst >= 1) { z -= 1.15; out.push({ lane, z, v: thorn }); z -= 1.15; if (burst % 2 === 0) { out.push({ lane, z, v: thorn }); z -= 1.15; } }
    z -= gap * between(r, 0.7, 1.3);
    burst++;
  }
  return out;
}

function jar(lane: number, z: number, hp: number, tiles: number[], coins: number): JarSpec { return { lane, z, hp: Math.round(hp), tiles, coins }; }

// ------------------------------------------------------------------ math gates
const opLabel = (g: Gate) => `${g.op === "+" ? "+" : g.op === "-" ? "−" : g.op === "x" ? "×" : "÷"}${g.k}`;
export const gateLabel = opLabel;
export function applyGate(n: number, g: Gate): number {
  const v = g.op === "+" ? n + g.k : g.op === "-" ? n - g.k : g.op === "x" ? n * g.k : Math.floor(n / g.k);
  return Math.max(1, Math.round(v));
}
export const gateGood = (g: Gate) => g.op === "+" || g.op === "x";

/** a pair of gates for a brigade of about `c` blobs: one is clearly better, the maths stays kid-sized */
function gatePair(r: Rng, c: number, ops: GateOp[]): Gate[] {
  const small = Math.max(2, Math.round(c * between(r, 0.25, 0.45)));
  const big = Math.max(small + 3, Math.round(c * between(r, 0.6, 0.9)));
  const round5 = (v: number) => (v > 12 ? Math.round(v / 5) * 5 : v);
  const kinds: Gate[][] = [[{ op: "+", k: round5(small) }, { op: "+", k: round5(big) }]];
  if (ops.includes("-")) kinds.push([{ op: "-", k: round5(Math.max(2, Math.round(c * 0.3))) }, { op: "+", k: round5(small) }]);
  if (ops.includes("x")) kinds.push([{ op: "x", k: c > 12 ? 2 : pick(r, [2, 3]) }, { op: "+", k: round5(Math.max(small, Math.round(c * 0.8))) }], [{ op: "x", k: 2 }, { op: "-", k: round5(Math.max(2, Math.round(c * 0.2))) }]);
  if (ops.includes("/")) kinds.push([{ op: "/", k: 2 }, { op: "+", k: round5(Math.max(2, Math.round(c * 0.2))) }]);
  const pair = ops.length === 1 && ops[0] === "x" ? [{ op: "x" as GateOp, k: pick(r, [2, 3]) }, { op: "+" as GateOp, k: round5(small) }] : pick(r, kinds);
  return r() < 0.5 ? pair : [pair[1], pair[0]];
}
export function opsFor(theme: ThemeId, math: MathMode): GateOp[] {
  if (theme === "garden" || math === "off") return ["+"];
  return math === "easy" ? ["+", "-"] : ["+", "-", "x", "/"];
}

// ------------------------------------------------------------------ stage builder
const emptySeg = (speed: number): Segment => ({ horde: [], tiles: [], jars: [], cages: [], pinatas: [], gates: [], boss: null, speed });

/** total Grumpy hit points for campaign stage n (a big carpet from the first stage: 150 → ~1,300 at stage 20 → ~4,500) */
export const hordeHp = (n: number) => (n <= 20 ? 150 + 60 * (n - 1) : 1290 + 40 * (n - 20));

/** the board mechanic of each world (Kranky's Castle mixes them stage by stage) */
export function mechanicsOf(world: number, s: number): Mechanics {
  const light = s === 1;
  switch (WORLDS[world]?.id) {
    case "snow": return { ice: true };
    case "toy": return { blockers: s < 3 ? 0 : s < 7 ? 1 : 2 };
    case "beach": return { waves: light ? 12 : 9 };
    case "spooky": return { dark: true };
    case "jungle": return { boulders: light ? 11 : 8 };
    case "lava": return { vents: 2 };
    case "space": return { meteors: light ? 8 : 6 };
    case "castle": {
      const mixes: Mechanics[] = [{ blockers: 1 }, { boulders: 8 }, { vents: 3 }, { meteors: 7 }, { ice: true, boulders: 9 }, { waves: 9, vents: 2 }, { blockers: 1, meteors: 8 }, { dark: true, boulders: 8 }, { vents: 3, meteors: 7 }, { boulders: 8, vents: 2, meteors: 8 }];
      return mixes[s - 1] ?? {};
    }
    default: return {};
  }
}
/** each world's own Grumpies */
function worldGrumps(world: number, s: number): [GrumpKind, number][] {
  const k = Math.min(1, 0.6 + s * 0.05);
  switch (WORLDS[world]?.id) {
    case "toy": return [["bouncer", 0.1 * k]];
    case "beach": return [["balloon", 0.08], ["bouncer", 0.05 * k]];
    case "spooky": return [["splitter", 0.16 * k]];
    case "jungle": return [["shield", 0.09 * k], ["splitter", 0.04]];
    case "lava": return [["splitter", 0.06], ["bouncer", 0.06]];
    case "space": return [["bouncer", 0.1 * k], ["balloon", 0.05], ["shield", 0.05]];
    case "castle": return [["bouncer", 0.06], ["splitter", 0.06], ["shield", 0.06], ["balloon", 0.03]];
    default: return [];
  }
}
/** villains that dodge or block part of the damage get less HP so every fight takes about as long */
const BOSS_TOUGH: Record<BossKind, number> = { mega: 1, jelly: 1, kranky: 0.9, cloud: 1, balloon: 1, spiky: 1, chef: 1, yeti: 0.95, robo: 0.6, boat: 0.95, ghost: 0.7, golem: 0.5, magma: 0.85, ufo: 0.9, mech: 0.8 };
/** how hard the march pushes (0.3 + per-stage and per-world steps) */
export let PRESSURE_BASE = 0.9;
/** per-stage HP trim (index = world * 10 + stage - 1), measured by scripts/brigade_tune.mjs; 1 = as generated */
export const STAGE_TUNE: number[] = [
  4.14, 1.48, 3.20, 1.00, 0.95, 1.50, 0.86, 1.60, 1.01, 1.16,
  3.21, 0.88, 2.50, 1.00, 0.90, 1.16, 1.15, 1.52, 1.53, 0.80,
  2.85, 1.98, 6.00, 1.00, 1.03, 1.30, 0.83, 1.06, 1.47, 0.73,
  1.59, 1.04, 1.63, 1.00, 0.31, 1.07, 1.15, 1.48, 2.01, 1.01,
  4.03, 1.76, 3.92, 1.00, 0.78, 0.79, 2.42, 2.10, 4.41, 2.42,
  1.16, 1.98, 1.86, 1.00, 0.91, 1.52, 1.24, 1.75, 3.33, 1.52,
  1.86, 2.73, 3.50, 1.00, 1.34, 2.48, 1.49, 1.08, 3.57, 1.34,
  1.61, 1.91, 1.05, 1.00, 1.09, 1.74, 0.60, 1.25, 0.72, 1.39,
  3.46, 1.50, 1.91, 1.00, 2.37, 1.24, 1.35, 1.43, 1.89, 2.74,
  5.61, 2.70, 1.89, 1.00, 2.50, 1.94, 1.21, 2.24, 1.07, 1.70,
];
export const setPressure = (v: number) => { PRESSURE_BASE = v; };
const POWER_POOL: PowerUp[] = ["beam", "freeze", "magnet", "bomb", "wall", "double"];
/** bubble powers join from World 3 (Snow): three bubbles per shot, faster bubbles, bigger bubbles */
const BUBBLE_POWERS: PowerUp[] = ["triple", "rapid", "mega"];
/** what drops onto the conveyor mid-fight: mostly bubble powers, sometimes a classic */
const FIGHT_POWERS: PowerUp[] = [...BUBBLE_POWERS, ...BUBBLE_POWERS, "freeze", "bomb", "wall", "beam"];

/** the villain waiting at the end of every stage */
export const STAGE_VILLAIN: Record<ThemeId, BossKind[]> = {
  garden: ["spiky", "balloon", "kranky", "kranky", "mega", "cloud", "spiky", "balloon", "kranky", "mega"],
  candy: ["chef", "cloud", "balloon", "chef", "jelly", "kranky", "spiky", "cloud", "chef", "jelly"],
  snow: ["spiky", "cloud", "balloon", "kranky", "yeti", "chef", "spiky", "cloud", "kranky", "yeti"],
  toy: ["balloon", "spiky", "chef", "kranky", "robo", "cloud", "mega", "balloon", "jelly", "robo"],
  beach: ["kranky", "cloud", "spiky", "chef", "boat", "balloon", "jelly", "kranky", "mega", "boat"],
  spooky: ["cloud", "jelly", "spiky", "balloon", "ghost", "kranky", "chef", "mega", "cloud", "ghost"],
  jungle: ["spiky", "balloon", "mega", "chef", "golem", "kranky", "cloud", "jelly", "spiky", "golem"],
  lava: ["chef", "spiky", "cloud", "balloon", "magma", "mega", "kranky", "jelly", "yeti", "magma"],
  space: ["cloud", "balloon", "robo", "kranky", "ufo", "spiky", "chef", "ghost", "golem", "ufo"],
  castle: ["kranky", "mega", "yeti", "boat", "mech", "ghost", "magma", "ufo", "golem", "mech"],
};
export const villainOf = (def: StageDef): BossKind => STAGE_VILLAIN[def.theme][def.s - 1];

const backOf = (h: GrumpSpec[], fallback: number) => h.reduce((m, g) => Math.min(m, g.z), fallback);

export interface BuildOpts {
  /** a different random layout (Remix Loop, Daily) */
  seed?: number;
  /** extra toughness for Grumpies and villains (Remix Loop) */
  tough?: number;
  /** Remix palette tier */
  tier?: number;
  /** Daily Challenge twists */
  mods?: DailyMod[];
  /** overrides the STAGE_TUNE trim (balance tools) */
  tune?: number;
  /** ignore the world's difficulty step (Daily: the same challenge in every world) */
  flat?: boolean;
}
export function buildStage(def: StageDef, math: MathMode, o: BuildOpts = {}): StageSpec {
  const n = def.n, seed = o.seed ?? n * 7919 + 13, r = rng(seed), theme = def.theme, world = def.world;
  const mods = o.mods ?? [], tough = o.tough ?? 1;
  const mirror = r() < 0.5;
  const lanes = def.type === "split" ? lanesSplit(mirror) : lanesStd(mirror);
  const fields = lanes.map((l, i) => (l.kind === "field" ? i : -1)).filter((i) => i >= 0);
  const rec = laneOf(lanes, "recruit"), bonus = laneOf(lanes, "bonus");
  // fast from the first stage, faster every stage
  const speed = n === 1 ? 1.3 : n === 2 ? 1.5 : Math.min(2.8, 1.6 + 0.04 * (n - 1));
  // later worlds expect the upgrades a player has bought by then (~1 level per world): Grumpies and villains grow to match
  const upF0 = world >= 2 && !o.flat ? (1 + 0.04 * world) * (1 + 0.06 * world) : 1;
  // a world's first stage teaches its new idea, so it stays gentler
  const upF = def.s === 1 ? 1 + (upF0 - 1) * 0.5 : upF0;
  // bigger marches from stage 5 on (the blob budget below still follows the base size, so the march outnumbers you)
  const H0 = hordeHp(n), H = H0 * (n <= 20 ? 1 + 0.5 * Math.min(1, Math.max(0, n - 2) / 6) : 1.15);
  // the blob budget for the whole stage (conveyor + jar + cages): a smaller share of the march every stage
  // (a world's first stage teaches its new idea, so it keeps the full blob budget and a softer villain)
  const learnS = def.type === "learn";
  const B = H0 * Math.max(0.12, 0.26 - 0.006 * (n - 1)) * (n >= 3 && !learnS ? 0.9 : 1);
  const seg = emptySeg(speed);
  // attack damage follows the blobs a stage hands out, not the stage number
  seg.spit = Math.max(2, Math.round(B * 0.035));
  const helmet = world >= 1 ? Math.min(0.34, 0.15 + 0.025 * (def.s - 1)) : n >= 4 ? 0.06 + 0.015 * (n - 4) : 0;
  const mix: CarpetOpt = {
    helmet, shape: pick(r, n < 2 ? ["block"] : ["block", "wedge", "waves", "stripes", "checker"]),
    speedyPacks: n >= 3 ? Math.min(5, 1 + Math.floor((n - 3) / 3)) : 0,
    spitters: n >= 3 ? Math.min(7, 1 + Math.floor((n - 3) / 2.5)) : 0,
    chunky: n >= 5 ? Math.min(10, 2 + Math.floor((n - 5) / 2)) : 0,
    extra: worldGrumps(world, def.s),
  };
  if (theme === "snow") mix.speedyPacks = (mix.speedyPacks ?? 0) + 2;
  if (theme === "lava") mix.spitters = Math.min(10, Math.round((mix.spitters ?? 0) * 1.5));
  // one or two power-up tiles from stage 3 on
  const powers: PowerUp[] = n >= 3 ? Array.from({ length: mods.includes("power") ? 4 : def.s >= 6 ? 2 : 1 }, () => pick(r, POWER_POOL)) : [];
  // World 3+ powers come from their own dice, so every stage keeps the layout it was balanced with
  const rp = rng(seed + 977);
  if (world >= 2 && powers.length) { powers[0] = pick(rp, BUBBLE_POWERS); if (powers.length < 2) powers.push(pick(rp, POWER_POOL)); }
  const front = -17 - Math.min(3, n * 0.15);
  const thorn = n >= 4 ? -Math.max(2, Math.round(B * 0.04)) : 0;
  const ops: GateOp[] = mods.includes("times") ? ["x"] : opsFor(theme, math);
  const gatesOn = world >= 1;
  let goal: Goal = { kind: "keep", value: 0.6, text: "Finish with 60% of your biggest brigade" };
  const tv = (v: number) => (v >= 20 ? Math.round(v / 5) * 5 : Math.max(2, Math.round(v)));
  const addJar = (share: number, z = -15) => {
    if (bonus < 0) return;
    const each = tv((B * share) / 2);
    seg.jars.push(jar(bonus, z, 12 + B * 0.45, [each, each], 10));
  };
  const conv = (share: number, span: number) => conveyor(r, rec, Math.max(8, Math.round(B * share)), -8, span, n > 4, thorn, [...powers]);
  const field0 = lanes[fields[0]];
  // every stage ends with a villain behind the march; stage 5 and 10 bring the big ones
  const vk = villainOf(def);
  const big = def.s === 5 || def.s === 10;
  // villain HP comes from the blobs the stage actually hands out, so it always takes a few seconds of focus
  // busy stages (a huge march, two marches, cages to save) get a lighter villain
  const busy = def.type === "big" ? 0.65 : def.type === "split" ? 0.75 : def.type === "rescue" ? 0.8 : def.type === "pinata" ? 0.6 : 1;
  const villain = (z: number, supply: number, k = (def.s === 10 ? 4.4 : def.s === 5 ? 3.4 : 2.6 + 0.05 * def.s) * busy) =>
    ({ kind: vk, hp: Math.round(supply * k * BOSS_TOUGH[vk] * upF * (n >= 3 && !learnS ? 1.3 : 1)), z, mini: !big, dmg: Math.round(Math.max(2, Math.min(supply * 0.065, 4 + n * 0.4)) * (big ? 1.3 : 1)) });

  switch (def.type) {
    case "learn": {
      seg.horde = carpet(r, field0, front - 3, H * 0.6, { ...mix, shape: "block", spitters: 0 });
      seg.tiles = conv(gatesOn ? 0.7 : 1.1, 55);
      // the first math gates come early, while the brigade is still small
      if (gatesOn) seg.gates.push({ z: -14, gates: gatePair(r, 5, ops) }, { z: -32, gates: gatePair(r, 14, ops) });
      const want = Math.max(10, Math.round((B * 0.75) / 5) * 5);
      goal = { kind: "count", value: want, text: `Grow to ${want} blobs` };
      break;
    }
    case "classic": {
      seg.horde = carpet(r, field0, front, H, mix);
      seg.tiles = conv(gatesOn ? 0.55 : 0.7, 65);
      addJar(0.3);
      if (gatesOn) seg.gates.push({ z: -30, gates: gatePair(r, B * 0.25, ops) });
      goal = { kind: "jars", value: 1, text: "Break the bonus jar" };
      break;
    }
    case "gates": {
      seg.horde = carpet(r, field0, front - 12, H, mix);
      seg.tiles = conv(0.3, 45);
      let c = 4;
      for (let i = 0; i < 4; i++) {
        const gates = gatePair(r, c, ops);
        seg.gates.push({ z: -14 - i * 15, gates });
        c = Math.max(...gates.map((g) => applyGate(c, g))) + Math.round(B * 0.06);
      }
      const target = Math.max(10, Math.round((c * 0.6) / 5) * 5);
      goal = { kind: "count", value: target, text: `Grow to ${target} blobs` };
      break;
    }
    case "pinata": {
      // piñatas, plus a small march guarding them
      for (let i = 0; i < 10; i++) {
        seg.pinatas.push({ x: field0.x0 + 1 + ((i * 0.37 + r() * 0.3) % 1) * (field0.x1 - field0.x0 - 2), z: -18 - i * 3.6, hp: Math.round(8 + n * 1.6 + i * 1.8), coins: 6 });
      }
      // a breather: a thin guard march, no thorn tiles, plenty of blobs
      seg.horde = carpet(r, field0, -22, H * 0.06, { ...mix, shape: "stripes", chunky: 0, spitters: 0, speedyPacks: 0 });
      seg.tiles = conveyor(r, rec, Math.round(Math.max(22 + n * 2.2, B * 0.6)), -8, 40, false, 0, [...powers]);
      seg.speed = Math.max(1.6, speed);
      goal = { kind: "pinatas", value: 10, text: "Pop all 10 piñatas" };
      break;
    }
    case "miniboss": {
      seg.horde = carpet(r, field0, front, H * 0.7, mix);
      seg.tiles = conv(0.8, 65);
      addJar(0.3);
      goal = { kind: "keep", value: 0.5, text: "Finish with half of your biggest brigade" };
      break;
    }
    case "rescue": {
      seg.horde = carpet(r, field0, front, H * 0.85, { ...mix, shape: "stripes" });
      seg.tiles = conv(0.55, 55);
      for (let i = 0; i < 3; i++) seg.cages.push({ x: between(r, field0.x0 + 0.9, field0.x1 - 0.9), z: front - 1.5 - i * 4.5, hp: Math.round(6 + n * 1.1), n: tv(B * 0.12) });
      goal = { kind: "cages", value: 3, text: "Free all 3 cages" };
      break;
    }
    case "split": {
      const hA = H * 0.32;
      seg.horde = [...carpet(r, field0, front, hA, mix), ...carpet(r, lanes[fields[1]], front - 14, hA, { ...mix, shape: "block", speedyPacks: 0 })];
      seg.tiles = conv(0.75, 65);
      addJar(0.3);
      goal = { kind: "keep", value: 0.5, text: "Finish with half of your biggest brigade" };
      break;
    }
    case "hold": {
      // wave after wave: a block of Grumpies every few metres for ~35 s, so the board is never empty
      const len = 35 * speed, waves = 8, per = (H * 1.1) / waves;
      for (let k = 0; k < waves; k++) {
        const z0 = front + 2 - (k * len) / waves;
        seg.horde.push(...carpet(r, field0, z0, per, { ...mix, shape: pick(r, ["block", "wedge", "waves", "checker"] as const), speedyPacks: k % 3 === 2 ? 1 : 0, spitters: k % 2 ? 1 : 0, chunky: k >= 4 ? 1 : 0 }));
      }
      seg.tiles = conv(0.8, 80);
      addJar(0.3);
      goal = { kind: "keep", value: 0.5, text: "Finish with half of your biggest brigade" };
      break;
    }
    case "big": {
      // the biggest march starts further away: grow big first
      seg.horde = carpet(r, field0, front - 8, H * 1.1, { ...mix, speedyPacks: (mix.speedyPacks ?? 0) + 1 });
      seg.tiles = conv(gatesOn ? 0.85 : 1.05, 75);
      addJar(0.35);
      if (gatesOn) seg.gates.push({ z: -28, gates: gatePair(r, B * 0.3, ops) });
      goal = { kind: "jars", value: 1, text: "Break the bonus jar" };
      break;
    }
    case "boss": {
      seg.horde = carpet(r, field0, front, H * 0.6, { ...mix, shape: "wedge" });
      seg.tiles = conv(gatesOn ? 0.8 : 0.95, 75);
      addJar(0.3);
      if (gatesOn) seg.gates.push({ z: -34, gates: gatePair(r, B * 0.3, ops) });
      break;
    }
  }
  const back = def.type === "pinata" ? Math.min(...seg.pinatas.map((p) => p.z)) : backOf(seg.horde, front);
  // the crowd grows every stage (a red carpet like the ads); past CROWD_MAX the extra HP goes into the Grumpies instead
  const thin = seg.horde.length > CROWD_MAX ? CROWD_MAX / seg.horde.length : 1;
  if (thin < 1) seg.horde = seg.horde.filter((_, i) => ((i * 0.6180339) % 1) < thin);
  if (thin < 1 || upF !== 1 || tough !== 1) seg.horde = seg.horde.map((g) => ({ ...g, hp: hpR((GRUMP_HP[g.kind] * upF * tough) / thin) }));
  for (const c of seg.cages) c.hp = Math.round(c.hp * upF * tough);
  for (const p of seg.pinatas) p.hp = Math.round(p.hp * upF * tough);
  if (mods.includes("speedy")) seg.speed *= 1.25;
  if (mods.includes("tiny")) seg.tiles = seg.tiles.filter((t, i) => t.v <= 0 || t.pw || t.coin || i % 7 !== 3);
  const supply = seg.tiles.reduce((a, t) => a + (t.coin || t.v < 0 ? 0 : t.v), 0) + seg.jars.reduce((a, j) => a + j.tiles.reduce((x, y) => x + y, 0), 0)
    + seg.cages.reduce((a, c) => a + c.n, 0) + (def.type === "gates" ? Math.max(0, goal.value) : 0);
  // pressure: every Grumpy gets enough HP that the march reaches you about as fast as your bubbles can pop it,
  // so even a big brigade has to fight for every stage (learn stages and piñata parties stay gentle)
  if (seg.horde.length && def.type !== "pinata" && def.type !== "learn") {
    const cols = Math.max(2, Math.floor((field0.x1 - field0.x0) / SPACING)) * fields.length;
    const arrive = (cols * seg.speed) / SPACING;
    const total = seg.horde.reduce((a, g) => a + (g.hp ?? GRUMP_HP[g.kind]), 0);
    // the boss, the biggest march and the two-march stage already push hard on their own
    const typeK = def.type === "boss" ? 0.45 : def.type === "big" ? 0.6 : def.type === "split" ? 0.65 : def.type === "hold" || def.type === "rescue" || def.type === "miniboss" ? 0.8 : def.s === 2 ? 0.8 : 1;
    const p = Math.min(1.8, (PRESSURE_BASE + 0.04 * def.s + 0.005 * world) * typeK);
    const m = ((p * 1.08 * supply * upF) / arrive) / (total / seg.horde.length);
    // the front rows stay soft (your brigade is still small when they arrive); the rows behind get tougher and tougher
    if (m > 1) {
      const zf = Math.max(...seg.horde.map((g) => g.z)), zb = Math.min(...seg.horde.map((g) => g.z)), depth = Math.max(1, zf - zb);
      seg.horde = seg.horde.map((g) => ({ ...g, hp: hpR((g.hp ?? GRUMP_HP[g.kind]) * (1 + (m - 1) * 2 * ((zf - g.z) / depth))) }));
    }
  }
  seg.boss = villain(back - (big ? 10 : 9), Math.max(15, supply));
  seg.boss.hp = Math.round(seg.boss.hp * tough);
  // from World 3 on, power tiles keep coming down the conveyor all through the fight (about every 9 s)
  if (world >= 2 && def.type !== "pinata" && rec >= 0) {
    const until = Math.abs(seg.boss.z) / seg.speed + 6, every = mods.includes("power") ? 8 : 13;
    for (let t = 11, k = 0; t < until && k < 3; t += every, k++) {
      let z = -6 * t;
      while (seg.tiles.some((x) => x.lane === rec && Math.abs(x.z - z) < 1.2)) z -= 1.2;
      seg.tiles.push({ lane: rec, z, v: 1, pw: pick(rp, FIGHT_POWERS) });
    }
  }
  // ...and a few Grumpies in the march carry a power: pop the one with the badge and the brigade gets it
  if (world >= 2 && def.type !== "pinata" && seg.horde.length > 40) {
    const order = seg.horde.map((g, i) => i).filter((i) => seg.horde[i].kind === "grump").sort((a, b) => seg.horde[b].z - seg.horde[a].z);
    const count = Math.min(4, Math.max(2, Math.round(seg.horde.length / 500)));
    for (let k = 0; k < count && order.length; k++) {
      const at = order[Math.floor(((k + 0.4 + rp() * 0.3) / count) * 0.9 * order.length)];
      seg.horde[at] = { ...seg.horde[at], pw: pick(rp, FIGHT_POWERS) };
    }
  }
  // the per-stage trim measured by scripts/brigade_tune.mjs (every stage a real fight, none a wall)
  const tn = o.tune ?? (def.id.startsWith("daily") ? 1 : STAGE_TUNE[world * 10 + def.s - 1] ?? 1);
  if (tn !== 1) {
    seg.horde = seg.horde.map((g) => ({ ...g, hp: hpR((g.hp ?? GRUMP_HP[g.kind]) * tn) }));
    seg.boss.hp = Math.max(10, Math.round(seg.boss.hp * tn));
  }
  if (def.type === "boss") {
    const t = Math.round((Math.abs(seg.boss.z) / (speed * 0.7)) * 1.15 / 5) * 5;
    goal = { kind: "fast", value: t, text: `Beat ${VILLAINS[vk].name} in ${t} seconds` };
  }
  // piñata parties keep the world's hazards but not the toy blocks (they would eat the piñata bubbles)
  const mech = mechanicsOf(world, def.s);
  if (def.type === "pinata") mech.blockers = 0;
  const expect = def.type === "pinata" || def.type === "learn" ? undefined : Math.max(12, Math.round(supply * 0.45));
  return { id: def.id, n, theme, type: def.type, lanes, segment: seg, goal, start: 1, tileSpeed: 6, gateSpeed: 4.5, seed, math, world, mech, tier: o.tier, mods, expect };
}

// ------------------------------------------------------------------ Endless Waves
export function endlessSpec(seed: number, math: MathMode): StageSpec {
  const lanes = lanesStd(false);
  return {
    id: "endless", n: 0, theme: "garden", type: "classic", lanes, segment: endlessWave(1, seed, math, lanes, 3), endless: true,
    goal: { kind: "keep", value: 0, text: "Survive as many waves as you can" }, start: 3, tileSpeed: 6, gateSpeed: 4.5, seed, math, world: 0, mech: {},
  };
}

const ENDLESS_VILLAINS: BossKind[] = ["spiky", "balloon", "kranky", "cloud", "chef", "mega", "jelly", "yeti", "robo", "boat", "ghost", "golem", "magma", "ufo", "mech"];

/**
 * Wave k of an Endless run. The march is sized from the brigade you bring (`power`): its arrival rate grows a little
 * faster than your bubbles every wave, so a run always ends — the question is how many waves you last. A villain
 * closes every third wave.
 */
export function endlessWave(k: number, seed: number, math: MathMode, lanes: Lane[], power: number): Segment {
  const r = rng(seed * 31 + k * 977);
  const f = lanes[laneOf(lanes, "field")], rec = laneOf(lanes, "recruit"), bonus = laneOf(lanes, "bonus");
  const speed = Math.min(2.5, 1.5 + 0.06 * (k - 1));
  const seg = emptySeg(speed);
  seg.spit = 2 + Math.floor(k / 3);
  const boss = k % 3 === 0;
  const front = k === 1 ? -20 : -18;
  const P = Math.max(3, power);
  // hit points per plain Grumpy: the march's arrival rate is ~(0.8 + 0.08k) × your brigade
  const flux = P * (0.8 + 0.08 * k), cols = Math.floor((f.x1 - f.x0) / SPACING);
  const h = Math.max(1, Math.round((flux * SPACING) / (cols * speed)));
  const rows = boss ? 4 + Math.floor(k / 3) : 6 + Math.floor(k * 0.8);
  const helmet = k >= 2 ? Math.min(0.34, 0.1 + 0.02 * k) : 0;
  const total = Math.max(60, rows * cols * h * (1 + helmet * 2));
  seg.horde = carpet(r, f, front, total / h, {
    helmet, shape: pick(r, ["block", "wedge", "waves", "stripes", "checker"] as const),
    speedyPacks: k >= 2 ? Math.min(5, Math.floor(k / 2)) : 0, spitters: k >= 2 ? Math.min(7, k) : 0, chunky: k >= 3 ? Math.min(10, k) : 0,
  }).map((g) => (h > 1 ? { ...g, hp: GRUMP_HP[g.kind] * h } : g));
  seg.tiles = conveyor(r, rec, Math.round(8 + P * (k === 1 ? 3 : 0.3)), -6, 55, k > 2, k >= 3 ? -Math.max(2, Math.round(P * 0.05)) : 0);
  if (k % 2 === 0 || boss) seg.jars.push(jar(bonus, -14, Math.round(10 + P * 0.5), [Math.round(4 + P * 0.12), Math.round(4 + P * 0.12)], 10));
  if (k % 2 === 1) {
    const gops = math === "off" ? (["+"] as GateOp[]) : opsFor("candy", math).filter((o) => o !== "x" || k % 4 === 3);
    seg.gates.push({ z: -20, gates: gatePair(r, P, gops) });
  }
  if (boss) {
    const vk = ENDLESS_VILLAINS[(k / 3 - 1) % ENDLESS_VILLAINS.length];
    seg.boss = { kind: vk, hp: Math.round(P * (3 + 0.25 * k) * h), z: backOf(seg.horde, front) - 6, dmg: Math.max(3, Math.round(P * 0.06)) };
  }
  return seg;
}

// ------------------------------------------------------------------ villains
export const VILLAINS: Record<BossKind, { name: string; emoji: string; taunt: string; how: string; voice: string; pitch: number }> = {
  mega: { name: "Mega Grump", emoji: "💪", taunt: "ME BIG. YOU SMALL!", how: "Calls his friends, then throws goo", voice: "v:gloop_wow", pitch: 0.62 },
  jelly: { name: "Jelly King", emoji: "👑", taunt: "Wobble before your king!", how: "Throws jelly, splits into little jellies", voice: "v:gloop_laugh", pitch: 0.78 },
  kranky: { name: "Kranky Krab", emoji: "🦀", taunt: "Snip snap! Your blobs are MINE!", how: "Throws two goo balls, blocks with his claw", voice: "v:kranky_laugh", pitch: 1 },
  cloud: { name: "Storm Grump", emoji: "⛈️", taunt: "Here comes the THUNDER!", how: "Lightning strikes — keep moving!", voice: "v:gloop_wow", pitch: 0.7 },
  balloon: { name: "Balloon Baron", emoji: "🎈", taunt: "Grumpies… JUMP!", how: "Drops Grumpies from the sky", voice: "v:kranky_wow", pitch: 0.8 },
  spiky: { name: "Sir Spikes", emoji: "🦔", taunt: "Roll out!", how: "Rolls forward fast — stop him early", voice: "v:gloop_laugh", pitch: 0.9 },
  chef: { name: "Chef Grumble", emoji: "👨‍🍳", taunt: "Cake to the FACE!", how: "Throws big cakes, cooks up jellies", voice: "v:bonbon_laugh", pitch: 0.72 },
  yeti: { name: "Snow Grump Giant", emoji: "☃️", taunt: "BRRR! Snowball fight!", how: "Big snowballs that slow you down", voice: "v:pip_wow", pitch: 0.55 },
  robo: { name: "Robo Grump", emoji: "🤖", taunt: "BEEP BOOP. YOU LOSE.", how: "Armour until half HP, then lasers", voice: "v:bolt_laugh", pitch: 0.7 },
  boat: { name: "Captain Kranky's Boat", emoji: "🏴‍☠️", taunt: "Fire the cannons!", how: "Cannonballs in threes, then a crab crew", voice: "v:kranky_laugh", pitch: 0.85 },
  ghost: { name: "Grumpy Ghost", emoji: "👻", taunt: "Boo! You can't hit me!", how: "Fades away — wait, then hit him", voice: "v:noodle_laugh", pitch: 1.25 },
  golem: { name: "Stone Golem", emoji: "🪨", taunt: "ROCK… AND ROLL!", how: "Weak only when his core glows; rolls boulders", voice: "v:gloop_wow", pitch: 0.5 },
  magma: { name: "Magma Grump", emoji: "🔥", taunt: "Hot hot HOT!", how: "Lava blobs leave burning puddles", voice: "v:turbo_wow", pitch: 0.65 },
  ufo: { name: "UFO Mothership", emoji: "🛸", taunt: "We come in GRUMPINESS!", how: "Tractor beam pulls you in, lasers from the sky", voice: "v:zib_laugh", pitch: 0.7 },
  mech: { name: "King Kranky Mech", emoji: "🦾", taunt: "Behold my ROBO-CLAWS!", how: "Three phases: claws, lasers, then meteors", voice: "v:kranky_laugh", pitch: 0.72 },
};

// ================================================================== Phase 3: Remix Loop, Daily Challenge, Boss Rush
// ------------------------------------------------------------------ Remix Loop (stage 101 → forever)
export const REMIX_START = 101;
/** which pass through the ten worlds a remix stage belongs to (1, 2, 3 …) */
export const remixLoop = (n: number) => Math.floor((n - REMIX_START) / 10) + 1;
/** palette tier: 1 gold, 2 rainbow, 3 galaxy (then round again) */
export const remixTier = (n: number) => ((remixLoop(n) - 1) % 3) + 1;
export const TIER_NAMES = ["", "Gold", "Rainbow", "Galaxy"];
export function remixDef(n: number): StageDef {
  const k = n - REMIX_START, world = k % 10, loop = remixLoop(n);
  let ti = (k % 10 + loop * 3) % 10;
  if (PATTERN[ti] === "learn") ti = 1;
  const w = WORLDS[world];
  return { id: `remix-${n}`, n: world * 10 + ti + 1, world, s: ti + 1, type: PATTERN[ti], name: `${w.name} Remix`, theme: w.id };
}
export function remixSpec(n: number, math: MathMode): StageSpec {
  const def = remixDef(n);
  return buildStage(def, math, { seed: n * 104729 + 7, tough: Math.min(1.9, 1 + 0.06 * (remixLoop(n) - 1)), tier: remixTier(n) });
}

// ------------------------------------------------------------------ Daily Challenge (the same stage for everyone today)
export type DailyMod = "giant" | "speedy" | "tiny" | "times" | "coins" | "power";
export const DAILY_MODS: Record<DailyMod, { name: string; icon: string; desc: string }> = {
  giant: { name: "Giant Bubbles", icon: "🫧", desc: "Huge bubbles that hit harder" },
  speedy: { name: "Speedy March", icon: "💨", desc: "The Grumpies walk 25% faster" },
  tiny: { name: "Tiny Brigade", icon: "🐣", desc: "Fewer blobs, but they shoot faster" },
  times: { name: "Times Tables", icon: "✖️", desc: "Only ×2 and ×3 gates" },
  coins: { name: "Coin Shower", icon: "🪙", desc: "Double coins today" },
  power: { name: "Power Party", icon: "⚡", desc: "Four power-up tiles" },
};
const MOD_LIST = Object.keys(DAILY_MODS) as DailyMod[];
const DAILY_TYPES: StageType[] = ["classic", "gates", "rescue", "split", "hold", "big", "miniboss"];
export const dailyKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hashKey = (key: string) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dailyInfo(key: string) {
  const h = hashKey(key), world = h % 10, type = DAILY_TYPES[(h >>> 4) % DAILY_TYPES.length], mod = MOD_LIST[(h >>> 9) % MOD_LIST.length];
  return { seed: h, world, type, mod };
}
export function dailySpec(key: string, math: MathMode): StageSpec {
  const info = dailyInfo(key), w = WORLDS[info.world], ti = PATTERN.indexOf(info.type);
  // the same moderate difficulty in every world: stage 14's numbers with the world's look and twist
  const def: StageDef = { id: `daily-${key}`, n: 14, world: info.world, s: ti + 1, type: info.type, name: "Daily Challenge", theme: w.id };
  return buildStage(def, math, { seed: info.seed, mods: [info.mod], flat: true });
}

// ------------------------------------------------------------------ Boss Rush (all fifteen villains in a row)
export const RUSH: BossKind[] = ["spiky", "balloon", "kranky", "chef", "cloud", "mega", "jelly", "yeti", "robo", "boat", "ghost", "golem", "magma", "ufo", "mech"];
export function rushSpec(math: MathMode): StageSpec {
  const lanes = lanesStd(false);
  return {
    id: "rush", n: 0, theme: "castle", type: "boss", lanes, segment: rushWave(1, 7, lanes, 5), rush: true,
    goal: { kind: "keep", value: 0, text: "Beat all 15 villains" }, start: 5, tileSpeed: 6, gateSpeed: 4.5, seed: 7, math, world: 9, mech: {},
  };
}
/** villain k of the rush, with a short recruit run before it; sized from the brigade you bring */
export function rushWave(k: number, seed: number, lanes: Lane[], power: number): Segment {
  const r = rng(seed * 131 + k * 7);
  const f = lanes[laneOf(lanes, "field")], rec = laneOf(lanes, "recruit"), bonus = laneOf(lanes, "bonus");
  const seg = emptySeg(Math.min(2.2, 1.5 + 0.05 * k));
  const supply = Math.round(20 + 12 * k + power * 0.15);
  seg.spit = Math.max(2, Math.round(power * 0.03));
  seg.horde = carpet(r, f, -18, 40 + 14 * k, { helmet: k > 4 ? 0.2 : 0, shape: "block", spitters: Math.min(5, Math.floor(k / 3)) });
  seg.tiles = conveyor(r, rec, supply, -6, 40, k > 3, 0, k % 3 === 0 ? [pick(r, k >= 6 ? [...POWER_POOL, ...BUBBLE_POWERS] : POWER_POOL)] : []);
  if (k % 3 === 2) seg.jars.push(jar(bonus, -14, 10 + power * 0.4, [Math.round(4 + supply * 0.15), Math.round(4 + supply * 0.15)], 10));
  const vk = RUSH[k - 1];
  // `power` is the brigade's real firepower (blobs × upgrades), so every villain takes a few seconds of focus
  seg.boss = { kind: vk, hp: Math.round((power + supply) * (5 + 0.32 * k) * BOSS_TOUGH[vk]), z: -32, dmg: Math.max(2, Math.round((power + supply) * 0.06)), mini: k < 6 };
  return seg;
}
