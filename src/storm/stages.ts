// Blockstorm's stages: 1,000 designed ones (20 worlds × 50) and then endless remixes. Stage n always plans the same way
// (seeded): its world, time of day and weather, its goal (clear the monsters, topple the gloom totems, wreck the gloom
// fortress, defend the beacon, free caged friends, or a boss), which monsters come and how many at once, and how hard it
// is. Difficulty starts gentle and climbs through each world, with a breather now and then. After stage 1,000 the
// remixes mix two worlds, goals and twists (night, fog, giants, swarms, gold rush, storms, low gravity), never the same
// mix twice in a row.
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, type TimeOfDay, type Weather, type WorldId } from "./worlds";
import { chance, clamp, hash, makeRng, pick } from "./util";

export type Goal = "clear" | "totems" | "wreck" | "hold" | "rescue" | "boss";
export type Mod = "night" | "fog" | "giants" | "swarm" | "gold" | "storm" | "lowgrav";
export type EnemyKind = "cubeling" | "grumbler" | "batbit" | "spitter" | "fusebug" | "brute";

export interface StagePlan {
  n: number; local: number; worldIndex: number; world: WorldId; blend: WorldId | null; remix: boolean; seed: number;
  title: string; subtitle: string; time: TimeOfDay; weather: Weather;
  goal: Goal; goalCount: number; difficulty: number;
  enemies: { kind: EnemyKind; w: number }[]; maxAlive: number;
  bossName: string; size: number; mods: Mod[]; finale: boolean;
}

const NAMES: Record<WorldId, [string[], string[]]> = {
  meadow: [["Clover", "Oakfield", "Sunny", "Brook", "Daisy", "Hilltop", "Breezy", "Mossy", "Willow", "Honey"], ["Hill", "Fort", "Meadow", "Crossing", "Glen", "Ridge", "Farm", "Hollow", "Green", "Keep"]],
  dunes: [["Scorch", "Amber", "Dust", "Mirage", "Sunstone", "Cobra", "Golden", "Dry", "Sphinx", "Ember"], ["Dunes", "Oasis", "Ruins", "Pass", "Mesa", "Tomb", "Wells", "Gate", "Basin", "Spire"]],
  neon: [["Volt", "Laser", "Chrome", "Pixel", "Midnight", "Neon", "Turbo", "Glow", "Synth", "Arc"], ["Avenue", "Rooftops", "Plaza", "Tower", "Block", "Alley", "Heights", "Strip", "Hub", "Terrace"]],
  frost: [["Frost", "Icicle", "Snowcap", "Glacier", "Polar", "Blizzard", "Crystal", "Winter", "Chill", "Aurora"], ["Peak", "Fort", "Pass", "Ridge", "Bay", "Hold", "Slope", "Camp", "Summit", "Gorge"]],
  shroom: [["Toadstool", "Spore", "Puffcap", "Bog", "Glimmer", "Moss", "Mire", "Fungi", "Murk", "Velvet"], ["Marsh", "Grove", "Pond", "Hollow", "Bog", "Ring", "Thicket", "Patch", "Fen", "Glade"]],
  forge: [["Magma", "Cinder", "Obsidian", "Ash", "Inferno", "Basalt", "Scorch", "Molten", "Ember", "Blaze"], ["Forge", "Keep", "Bridge", "Furnace", "Crater", "Citadel", "Pit", "Works", "Bastion", "Rift"]],
  candy: [["Sugar", "Gumdrop", "Lolly", "Taffy", "Fudge", "Sprinkle", "Bonbon", "Cocoa", "Marzi", "Toffee"], ["Cliffs", "Castle", "Lane", "Hills", "Tower", "Fair", "Bay", "Peaks", "Square", "Palace"]],
  reef: [["Coral", "Pearl", "Kelp", "Tide", "Shell", "Lagoon", "Abyss", "Starfish", "Ripple", "Azure"], ["Reef", "Ruins", "Grotto", "Shelf", "Trench", "Garden", "Wreck", "Shallows", "Arch", "Deep"]],
  haunt: [["Grim", "Hollow", "Raven", "Moonlit", "Ghoul", "Shadow", "Wisp", "Crypt", "Gloom", "Pumpkin"], ["Hollow", "Yard", "Manor", "Woods", "Crypt", "Lane", "Chapel", "Bog", "Hill", "Gate"]],
  sky: [["Cloud", "Zephyr", "Halo", "Skyward", "Marble", "Gale", "Aether", "Sun", "Feather", "Comet"], ["Ruins", "Temple", "Isle", "Steps", "Spire", "Garden", "Bridge", "Court", "Throne", "Arch"]],
  crystal: [["Amethyst", "Prism", "Glint", "Echo", "Shard", "Lumen", "Quartz", "Gleam", "Opal", "Geode"], ["Caverns", "Hall", "Depths", "Vault", "Chasm", "Grotto", "Mine", "Nexus", "Well", "Maze"]],
  jungle: [["Vine", "Jaguar", "Emerald", "Monkey", "Idol", "Canopy", "Parrot", "Wild", "Lotus", "Thunder"], ["Temple", "Falls", "Ruins", "Jungle", "Steps", "Shrine", "River", "Altar", "Pyramid", "Grove"]],
  autumn: [["Amber", "Maple", "Harvest", "Acorn", "Rusty", "Cider", "Copper", "Hazel", "Russet", "Barley"], ["Woods", "Barn", "Mill", "Orchard", "Lane", "Field", "Hollow", "Farm", "Bridge", "Glen"]],
  grid: [["Vector", "Binary", "Pulse", "Byte", "Circuit", "Laser", "Matrix", "Quantum", "Neon", "Cipher"], ["Grid", "Core", "Node", "Array", "Sector", "Server", "Loop", "Stack", "Port", "Relay"]],
  cove: [["Skull", "Parrot", "Treasure", "Driftwood", "Cutlass", "Coral", "Barnacle", "Sandy", "Lantern", "Galleon"], ["Cove", "Docks", "Beach", "Bay", "Wreck", "Lagoon", "Reef", "Hideout", "Point", "Harbor"]],
  clock: [["Cog", "Brass", "Gear", "Piston", "Steam", "Spring", "Rivet", "Copper", "Boiler", "Tick"], ["Works", "Factory", "Tower", "Mill", "Yard", "Hall", "Line", "Vault", "Foundry", "Depot"]],
  blossom: [["Petal", "Sakura", "Lotus", "Jade", "Lantern", "Willow", "Koi", "Bamboo", "Plum", "Silk"], ["Garden", "Pagoda", "Bridge", "Temple", "Pond", "Grove", "Court", "Terrace", "Gate", "Path"]],
  moon: [["Lunar", "Crater", "Orbit", "Apollo", "Silver", "Comet", "Nova", "Star", "Tranquil", "Echo"], ["Base", "Dome", "Ridge", "Station", "Basin", "Outpost", "Sea", "Rim", "Labs", "Pad"]],
  toxic: [["Rust", "Sludge", "Fume", "Acid", "Smog", "Scrap", "Blight", "Venom", "Murk", "Slag"], ["Wastes", "Dump", "Refinery", "Pits", "Yard", "Plant", "Sump", "Flats", "Mire", "Works"]],
  glitch: [["Null", "Error", "Void", "Static", "Corrupt", "Phantom", "Fractal", "Rogue", "Shatter", "Zero"], ["Core", "Rift", "Sector", "Loop", "Gate", "Heart", "Spiral", "Engine", "Throne", "Abyss"]],
};
const BOSSES: Record<WorldId, string> = {
  meadow: "Mossback Golem", dunes: "Sandstone Colossus", neon: "Neon Sentinel", frost: "Frost Giant", shroom: "Toadstool Titan",
  forge: "Magma Golem", candy: "Gumdrop Goliath", reef: "Coral Colossus", haunt: "Pumpkin King", sky: "Marble Guardian",
  crystal: "Prism Golem", jungle: "Idol Titan", autumn: "Harvest Hulk", grid: "Firewall Titan", cove: "Barnacle Brute",
  clock: "Clockwork Colossus", blossom: "Lantern Warden", moon: "Crater Crusher", toxic: "Sludge Lord", glitch: "Gloom Heart",
};

function goalLine(g: Goal, c: number, boss: string) {
  switch (g) {
    case "clear": return `Defeat ${c} monsters`;
    case "totems": return `Topple ${c} gloom totems`;
    case "wreck": return "Wreck the gloom fortress";
    case "hold": return `Defend the beacon for ${c}s`;
    case "rescue": return `Free ${c} caged ${c === 1 ? "friend" : "friends"}`;
    case "boss": return `Boss: ${boss}`;
  }
}

function enemyMix(n: number, d: number, mods: Mod[]): { kind: EnemyKind; w: number }[] {
  const e: { kind: EnemyKind; w: number }[] = [{ kind: "cubeling", w: 3 - d * 1.5 }, { kind: "grumbler", w: 3 }];
  if (n >= 5) e.push({ kind: "batbit", w: 1 + d });
  if (n >= 9) e.push({ kind: "spitter", w: 0.8 + d * 1.2 });
  if (n >= 16) e.push({ kind: "fusebug", w: 0.6 + d });
  if (n >= 26) e.push({ kind: "brute", w: 0.3 + d * 0.8 });
  if (mods.includes("swarm")) for (const x of e) if (x.kind === "cubeling" || x.kind === "batbit") x.w *= 2.5;
  return e;
}

function goalFor(local: number, r: () => number, d: number): Goal {
  if (local % 10 === 0) return "boss";
  if (local === 1) return "clear";
  if (local === 2) return "totems";
  if (local === 3) return "wreck";
  const pool: Goal[] = ["clear", "clear", "totems", "totems", "wreck"];
  if (local >= 4) pool.push("rescue");
  if (local >= 6) pool.push("hold");
  if (d > 0.5) pool.push("wreck", "hold");
  return pool[Math.floor(r() * pool.length)];
}

function countFor(g: Goal, d: number, mods: Mod[]) {
  switch (g) {
    case "clear": return Math.round((8 + d * 22) * (mods.includes("giants") ? 0.6 : mods.includes("swarm") ? 1.4 : 1));
    case "totems": return 2 + Math.floor(d * 3.2);
    case "wreck": return 70;
    case "hold": return Math.round(35 + d * 40);
    case "rescue": return 1 + Math.floor(d * 2.6);
    case "boss": return 1;
  }
}

function build(n: number, world: WorldId, blend: WorldId | null, local: number, worldIndex: number, difficulty: number, goal: Goal, mods: Mod[], remix: boolean): StagePlan {
  const r = makeRng(n * 2654435761 + 77);
  const w = WORLDS.find((x) => x.id === world)!;
  const names = NAMES[blend && chance(r, 0.5) ? blend : world];
  const title = `${pick(r, names[0])} ${pick(r, names[1])}`;
  let time: TimeOfDay = pick(r, w.times);
  if (mods.includes("night")) time = "night";
  let weather: Weather = pick(r, w.weather);
  if (mods.includes("storm")) weather = w.id === "frost" ? "snow" : w.id === "forge" || w.id === "toxic" ? "ash" : "rain";
  const finale = local === STAGES_PER_WORLD && !remix;
  const bossName = BOSSES[blend && local % 20 === 0 ? blend : world];
  const goalCount = countFor(goal, difficulty, mods);
  const subtitle = goalLine(goal, goalCount, finale ? `${bossName} (finale)` : bossName);
  const enemies = enemyMix(remix ? 999 : n, difficulty, mods);
  const maxAlive = Math.round(4 + difficulty * 9 + (mods.includes("swarm") ? 4 : 0) - (mods.includes("giants") ? 3 : 0));
  const size = goal === "boss" ? 46 : Math.round(36 + difficulty * 10 + r() * 4);
  return { n, local, worldIndex, world, blend, remix, seed: (n * 7919 + 13) >>> 0, title, subtitle, time, weather, goal, goalCount, difficulty, enemies, maxAlive, bossName, size, mods, finale };
}

const cache = new Map<number, StagePlan>();
export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  const hit = cache.get(n);
  if (hit) return hit;
  let p: StagePlan;
  if (n <= DESIGNED_STAGES) {
    const wi = Math.floor((n - 1) / STAGES_PER_WORLD), local = ((n - 1) % STAGES_PER_WORLD) + 1;
    const r = makeRng(n * 977 + 5);
    // gentle start, climbing through each world; every 7th stage is a breather; bosses a touch harder
    const breather = local % 7 === 0 ? -0.1 : 0;
    const d = clamp(0.1 + 0.62 * ((local - 1) / (STAGES_PER_WORLD - 1)) + 0.016 * wi + (local % 10 === 0 ? 0.05 : 0) + breather + (r() - 0.5) * 0.05, 0.08, 0.96);
    const goal = goalFor(local, r, d);
    const mods: Mod[] = [];
    if (wi >= 2 && local > 5 && goal !== "boss" && chance(r, 0.16)) mods.push(pick(r, ["fog", "giants", "swarm", "gold", "storm"] as Mod[]));
    if (WORLDS[wi].id === "moon") mods.push("lowgrav");
    p = build(n, WORLDS[wi].id, null, local, wi, d, goal, mods, false);
  } else {
    // endless remixes: two worlds, a goal and up to two twists, never the same mix as the stage before
    const k = n - DESIGNED_STAGES;
    const r = makeRng(n * 31337 + 1);
    const wave = 0.5 + 0.5 * Math.sin(k * 0.37);
    const d = clamp(0.74 + 0.2 * wave + (r() - 0.5) * 0.06, 0.6, 0.98);
    // the world steps by 7 (of 20) each stage and shifts every 20, so two stages in a row never share a world; the goal
    // steps by 3 (of 5), so they never share a goal either
    const NW = WORLDS.length;
    const a = (k * 7 + Math.floor(k / NW) * 3) % NW;
    const b = (a + 1 + Math.floor(hash(n, 2) * (NW - 1))) % NW;
    const GOALS: Goal[] = ["clear", "totems", "wreck", "hold", "rescue"];
    const goal: Goal = k % 10 === 0 ? "boss" : GOALS[(k * 3 + Math.floor(k / 7)) % GOALS.length];
    const mods: Mod[] = [];
    const all: Mod[] = ["night", "fog", "giants", "swarm", "gold", "storm"];
    if (r() < 0.7) mods.push(all[Math.floor(r() * all.length)]);
    if (r() < 0.25) { const m = all[Math.floor(r() * all.length)]; if (!mods.includes(m)) mods.push(m); }
    if (WORLDS[a].id === "moon") mods.push("lowgrav");
    p = build(n, WORLDS[a].id, WORLDS[b].id, ((k - 1) % STAGES_PER_WORLD) + 1, a, d, goal, mods, true);
  }
  if (cache.size > 64) cache.clear();
  cache.set(n, p);
  return p;
}
export const MOD_LABEL: Record<Mod, string> = { night: "Night raid", fog: "Thick fog", giants: "Giant monsters", swarm: "Swarm", gold: "Gold rush ×2", storm: "Storm", lowgrav: "Low gravity" };
