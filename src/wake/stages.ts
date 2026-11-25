// Every stage of Wake Racers, worked out from its number alone (the same for every player). Stages 1–600 walk through
// the twelve worlds fifty at a time: each world starts gentle and climbs, mixes eight kinds of event (races, knockouts,
// checkpoint rushes, coin rushes, traffic runs, survival runs, docking and a champion's duel at the end) and lays down
// its own set pieces. After 600 the remix stages never end: two worlds blended into one (land from one, sky, water,
// weather and props from both), any event, a twist on most stages and a fresh seed every time, so nothing feels
// repeated.
import { clamp, makeRng, pick, range, weighted, type Rng } from "./util";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf, type Feature, type WorldId } from "./worlds";

export type Mode = "race" | "knockout" | "rush" | "coins" | "traffic" | "survival" | "dock" | "duel";
export type Twist = "" | "fog" | "turbo" | "storm" | "lowfuel" | "night" | "giant";

export interface StagePlan {
  n: number;
  /** stage number inside its world (1–50), or the remix round */
  local: number;
  world: WorldId;
  /** remix partner world (sky, water, props and weather mix in) */
  blend: WorldId | null;
  mood: number;
  seed: number;
  /** 0 (gentle) .. 1 (hard) */
  d: number;
  mode: Mode;
  /** finishing place you need (race, knockout, duel), or coins to collect (coin rush) */
  need: number;
  rivals: number;
  /** rival pace (top speed relative to the starter boat's) and skill */
  pace: number; skill: number;
  length: number;
  features: Feature[];
  twist: Twist;
  remix: boolean;
  boss: boolean;
  name: string;
}

export const MODE_INFO: Record<Mode, { name: string; short: string; color: string }> = {
  race: { name: "Race", short: "Beat the pack", color: "#36E3FF" },
  knockout: { name: "Knockout", short: "Last boat at each gate is out", color: "#FF5A5F" },
  rush: { name: "Checkpoint Rush", short: "Reach every gate before time runs out", color: "#FFC233" },
  coins: { name: "Coin Rush", short: "Grab the coins and finish", color: "#FFD23F" },
  traffic: { name: "Traffic Run", short: "Weave through the harbour traffic", color: "#3EE08F" },
  survival: { name: "Survival", short: "Make it to the end in one piece", color: "#FF7A3D" },
  dock: { name: "Dock It", short: "Race in and stop in the glowing berth", color: "#B98CFF" },
  duel: { name: "Champion Duel", short: "One on one with the world champion", color: "#FF3DCB" },
};

const TWIST_INFO: Record<Exclude<Twist, "">, string> = {
  fog: "Thick fog", turbo: "Turbo rivals", storm: "Rough water", lowfuel: "Half a tank", night: "Night run", giant: "Big waves",
};
export const twistName = (t: Twist) => (t ? TWIST_INFO[t] : "");

const WORDS: Record<WorldId, string[]> = {
  lagoon: ["Palm", "Coral", "Reef", "Shell", "Atoll", "Sandbar", "Conch", "Turtle", "Mango", "Tide"],
  canyon: ["Redrock", "Mesa", "Butte", "Gulch", "Arch", "Dust", "Canyon", "Rapids", "Cliff", "Ember"],
  harbor: ["Neon", "Pier", "Dock", "Crane", "Beacon", "Port", "Wharf", "Signal", "Midnight", "Harbour"],
  fjord: ["Frost", "Glacier", "Aurora", "Iceberg", "Polar", "Snowcap", "Fjord", "Ice", "Northern", "Blizzard"],
  jungle: ["Emerald", "Vine", "Temple", "Jade", "Canopy", "Orchid", "Monkey", "Delta", "Mist", "Ruins"],
  canals: ["Lantern", "Bridge", "Gondola", "Plaza", "Bell", "Canal", "Arcade", "Rooftop", "Cobble", "Market"],
  blossom: ["Blossom", "Petal", "Lantern", "Koi", "Pagoda", "Spring", "Lotus", "Bamboo", "Sakura", "Moon"],
  volcano: ["Magma", "Cinder", "Lava", "Ash", "Inferno", "Obsidian", "Ember", "Crater", "Scorch", "Flame"],
  storm: ["Thunder", "Gale", "Squall", "Lightning", "Breaker", "Tempest", "Surge", "Cyclone", "Riptide", "Storm"],
  caverns: ["Crystal", "Geode", "Echo", "Glow", "Amethyst", "Cavern", "Prism", "Gem", "Shimmer", "Deep"],
  dunes: ["Oasis", "Dune", "Mirage", "Sun", "Sandstone", "Golden", "Scarab", "Sirocco", "Caravan", "Desert"],
  cyber: ["Hyper", "Pixel", "Laser", "Grid", "Volt", "Chrome", "Pulse", "Neon", "Quantum", "Holo"],
};
const NOUNS: Record<Mode, string[]> = {
  race: ["Sprint", "Dash", "Cup", "Grand Prix", "Rally", "Run", "Classic", "Derby"],
  knockout: ["Knockout", "Elimination", "Last Boat Out", "Showdown"],
  rush: ["Rush", "Countdown", "Time Attack", "Gatecrash"],
  coins: ["Gold Rush", "Treasure Run", "Coin Chase", "Jackpot"],
  traffic: ["Traffic Run", "Rush Hour", "Ferry Weave", "Busy Water"],
  survival: ["Survival", "Gauntlet", "Danger Run", "Hazard Run"],
  dock: ["Docking", "Park It", "Berth Dash", "Mooring"],
  duel: ["Duel", "Showdown", "Title Race"],
};

/** features unlock as stages get harder (so the first stages teach one thing at a time) */
const FEATURE_FROM: Partial<Record<Feature, number>> = {
  jumps: 0.18, rapids: 0.15, waterfall: 0.22, gates: 0.3, whirlpool: 0.35, minefield: 0.3, logjam: 0.15, ferry: 0.2,
  narrows: 0.12, pillars: 0.25, tunnel: 0.1, island: 0.08,
};

export const worldIndexOf = (n: number) => Math.floor((Math.min(n, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);

function pickMode(r: Rng, local: number, wi: number, n: number): Mode {
  if (local === STAGES_PER_WORLD) return "duel";
  if (local === 25) return "knockout";
  if (local % 10 === 0) return (["dock", "survival", "rush", "traffic"] as const)[(local / 10 + wi) % 4];
  if (n <= 3) return "race";
  if (n <= 8) return weighted(r, [["race", 6], ["coins", 2], ["rush", 2]] as const);
  return weighted(r, [["race", 46], ["knockout", 9], ["rush", 11], ["coins", 10], ["traffic", 9], ["survival", 8], ["dock", 7]] as const);
}

function needFor(mode: Mode, d: number) {
  if (mode === "race") return d < 0.3 ? 3 : d < 0.65 ? 2 : 1;
  if (mode === "knockout") return d < 0.7 ? 2 : 1;
  if (mode === "duel") return 1;
  return 0;
}

function pickFeatures(r: Rng, weights: [Feature, number][], d: number, count: number, mode: Mode): Feature[] {
  const pool = weights.filter(([f]) => d >= (FEATURE_FROM[f] ?? 0));
  // the event shapes the set pieces: traffic runs get ferries, survival runs hazards, rushes boost pads
  if (mode === "traffic") pool.push(["ferry", 6], ["pillars", 2]);
  if (mode === "survival") pool.push(["minefield", 3], ["rocks", 3], ["logjam", 2]);
  if (mode === "rush") pool.push(["boost", 3], ["jumps", 1]);
  if (mode === "coins") pool.push(["ramp", 2], ["bay", 2], ["island", 1]);
  const out: Feature[] = [];
  for (let i = 0; i < count; i++) {
    let f: Feature = weighted(r, pool), guard = 0;
    // never the same set piece twice in a row, and at most one waterfall per two pieces
    while ((f === out[out.length - 1] || (f === "waterfall" && out.slice(-2).includes("waterfall"))) && guard++ < 12) f = weighted(r, pool);
    out.push(f);
  }
  return out;
}

function nameFor(r: Rng, world: WorldId, mode: Mode, boss: boolean, blend: WorldId | null) {
  const a = pick(r, WORDS[world]);
  if (boss) return `${worldOf(world).boss.name}'s ${pick(r, NOUNS.duel)}`;
  if (blend) return `${a} ${pick(r, WORDS[blend])} ${pick(r, NOUNS[mode])}`;
  return `${a} ${pick(r, NOUNS[mode])}`;
}

/** the plan of stage n (1-based); any n works, past 600 it's the endless remix */
export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  const seed = (n * 2654435761 + 7919) >>> 0;
  const r = makeRng(seed);
  if (n <= DESIGNED_STAGES) {
    const wi = worldIndexOf(n), local = n - wi * STAGES_PER_WORLD, w = WORLDS[wi];
    const boss = local === STAGES_PER_WORLD;
    // tougher with every stage: one steady climb from stage 1 to 600 (no breathers), a little extra for each champion
    const tg = (n - 1) / (DESIGNED_STAGES - 1);
    const d = clamp(0.1 + 0.86 * Math.pow(tg, 0.92) + (boss ? 0.04 : 0), 0.08, 1);
    const mode = pickMode(r, local, wi, n);
    // long courses: about 9 km at the start, up to 29 km at the end
    const length = Math.round(clamp(9500 + 15000 * d + range(r, 0, 3000) + (boss ? 3000 : 0), 9000, 29000) / 10) * 10;
    const count = Math.max(3, Math.round(length / 210));
    // the first two stages open with a gentle sequence that teaches one thing at a time, then the usual mix
    const intro: Feature[] = n === 1 ? ["boost", "ramp", "island"] : n === 2 ? ["slalom", "ramp", "boost", "rocks"] : [];
    const features = [...intro, ...pickFeatures(r, w.features, d, count - intro.length, mode)];
    const rivals = mode === "race" || mode === "knockout" ? 5 : mode === "duel" ? 1 : mode === "coins" ? 3 : 0;
    // rival pace: well behind your starter boat at first, about level with it (and pushing hard) by the end
    const pace = clamp(0.8 + 0.2 * d + (boss ? 0.04 : 0), 0.78, 1.04);
    const twist: StagePlan["twist"] = local > 10 && (local % 9 === 4 || (d > 0.6 && local % 5 === 2)) ? pick(r, ["fog", "turbo", "storm", "lowfuel", "night", "giant"] as const) : "";
    return {
      n, local, world: w.id, blend: null, mood: (local + Math.floor(local / 5)) % w.moods.length, seed, d, mode, need: needFor(mode, d),
      rivals, pace, skill: clamp(0.4 + 0.58 * d, 0.35, 0.97), length, features, twist, remix: false, boss,
      name: nameFor(r, w.id, mode, boss, null),
    };
  }
  // ---- the endless remix
  const k = n - DESIGNED_STAGES;
  const wi = (k * 7 + Math.floor(k / 12) * 5) % WORLDS.length;
  let bi = (wi + 1 + Math.floor(r() * (WORLDS.length - 1))) % WORLDS.length;
  if (bi === wi) bi = (wi + 3) % WORLDS.length;
  const w = WORLDS[wi], b = WORLDS[bi];
  const wave = Math.sin(k * 0.37) * 0.5 + 0.5;
  const boss = k % 25 === 0;
  const d = clamp(0.86 + 0.0003 * k + 0.08 * wave + (boss ? 0.04 : 0), 0.86, 1);
  const mode: Mode = boss ? "duel" : weighted(r, [["race", 40], ["knockout", 12], ["rush", 11], ["coins", 9], ["traffic", 10], ["survival", 10], ["dock", 8]] as const);
  const length = Math.round(clamp(19000 + 13000 * r() + (boss ? 3000 : 0), 19000, 34000) / 10) * 10;
  // set pieces from both worlds
  const mixW = new Map<Feature, number>();
  for (const [f, x] of [...w.features, ...b.features]) mixW.set(f, (mixW.get(f) ?? 0) + x);
  const features = pickFeatures(r, [...mixW.entries()], d, Math.round(length / 200), mode);
  const rivals = mode === "race" || mode === "knockout" ? 5 : mode === "duel" ? 1 : mode === "coins" ? 3 : 0;
  const twist: StagePlan["twist"] = r() < 0.7 ? pick(r, ["fog", "turbo", "storm", "lowfuel", "night", "giant"] as const) : "";
  return {
    n, local: k, world: w.id, blend: b.id, mood: Math.floor(r() * 3), seed, d, mode, need: needFor(mode, d),
    rivals, pace: clamp(0.95 + 0.08 * d + (boss ? 0.03 : 0), 0.95, 1.06), skill: 0.95, length, features, twist, remix: true, boss,
    name: boss ? `Remix Champion ${Math.floor(k / 25)}` : nameFor(r, w.id, mode, false, b.id),
  };
}
