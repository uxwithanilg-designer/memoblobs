// Cube Clash's stages: 1,000 designed ones (20 themes × 50) and then endless remixes. Every ten stages follow a rhythm
// of modes — Sky Clash (knock the rivals off their islands), Obby Run (a parkour course), Crystal Clash (break the
// other teams' crystals and guard yours), Zombie Night (hold out against waves) — and the tenth is a Titan fight.
// Stage n always plans the same way (seeded): theme, time of day, weather, mode, how many rivals, teams or waves, how
// long the course is, and how hard it is. Difficulty starts gentle and climbs through each theme. After stage 1,000
// remixes mix two themes and twists, never the same mix twice in a row.
import { DESIGNED_STAGES, STAGES_PER_THEME, THEMES, type ThemeId, type TimeOfDay, type Weather } from "./worlds";
import { chance, clamp, hash, makeRng, pick } from "./util";

export type Mode = "sky" | "crystal" | "zombie" | "obby" | "titan";
export type Mod = "night" | "fog" | "lowgrav" | "giants" | "swarm" | "gold" | "storm";
export interface StagePlan {
  n: number; local: number; themeIndex: number; theme: ThemeId; blend: ThemeId | null; remix: boolean; seed: number;
  title: string; subtitle: string; time: TimeOfDay; weather: Weather; mode: Mode; difficulty: number;
  rivals: number; teams: number; teamSize: number; waves: number; course: number;
  titan: string; mods: Mod[]; finale: boolean;
}

const RHYTHM: Mode[] = ["sky", "obby", "crystal", "zombie", "sky", "crystal", "obby", "zombie", "sky", "titan"];
const NAMES: Record<ThemeId, [string[], string[]]> = {
  meadow: [["Clover", "Sunny", "Breezy", "Daisy", "Willow", "Honey", "Puffy", "Mossy"], ["Isles", "Hop", "Rise", "Meadow", "Crossing", "Bluff", "Green", "Drift"]],
  sakura: [["Petal", "Lantern", "Lotus", "Koi", "Jade", "Plum", "Silk", "Bamboo"], ["Heights", "Bridge", "Garden", "Shrine", "Terrace", "Gate", "Steps", "Path"]],
  mesa: [["Red", "Dusty", "Sunset", "Canyon", "Coyote", "Ember", "Copper", "Sage"], ["Mesa", "Butte", "Spire", "Pass", "Ridge", "Ranch", "Gulch", "Rock"]],
  frost: [["Frost", "Glacier", "Snowcap", "Polar", "Blizzard", "Icicle", "Winter", "Chill"], ["Peaks", "Ridge", "Falls", "Camp", "Summit", "Shelf", "Hollow", "Drift"]],
  shroom: [["Toadstool", "Spore", "Puffcap", "Glimmer", "Velvet", "Fairy", "Moss", "Murk"], ["Grove", "Ring", "Patch", "Glade", "Hollow", "Thicket", "Garden", "Bog"]],
  magma: [["Magma", "Cinder", "Obsidian", "Ash", "Basalt", "Molten", "Ember", "Blaze"], ["Rocks", "Forge", "Keep", "Crag", "Pit", "Bastion", "Rift", "Isle"]],
  candy: [["Sugar", "Gumdrop", "Lolly", "Taffy", "Sprinkle", "Bonbon", "Cocoa", "Toffee"], ["Clouds", "Castle", "Hills", "Isles", "Fair", "Tower", "Square", "Lane"]],
  bay: [["Skull", "Parrot", "Treasure", "Driftwood", "Cutlass", "Barnacle", "Sandy", "Galleon"], ["Bay", "Docks", "Cove", "Reef", "Hideout", "Point", "Harbor", "Wreck"]],
  jungle: [["Vine", "Jaguar", "Emerald", "Monkey", "Idol", "Canopy", "Parrot", "Wild"], ["Ruins", "Falls", "Temple", "Steps", "Shrine", "Altar", "Grove", "River"]],
  crystal: [["Amethyst", "Prism", "Glint", "Echo", "Shard", "Lumen", "Quartz", "Opal"], ["Caverns", "Vault", "Hall", "Chasm", "Nexus", "Grotto", "Well", "Maze"]],
  neon: [["Volt", "Laser", "Chrome", "Pixel", "Turbo", "Synth", "Arc", "Glow"], ["Arcade", "Rooftops", "Plaza", "Strip", "Block", "Heights", "Hub", "Alley"]],
  harvest: [["Amber", "Maple", "Harvest", "Acorn", "Cider", "Barley", "Hazel", "Russet"], ["Farm", "Barn", "Mill", "Orchard", "Field", "Fair", "Hill", "Yard"]],
  haunt: [["Grim", "Raven", "Moonlit", "Ghoul", "Shadow", "Wisp", "Crypt", "Pumpkin"], ["Isles", "Yard", "Manor", "Woods", "Chapel", "Gate", "Hill", "Hollow"]],
  temple: [["Cloud", "Zephyr", "Halo", "Marble", "Gale", "Aether", "Sun", "Feather"], ["Temple", "Steps", "Court", "Throne", "Arch", "Spire", "Garden", "Sanctum"]],
  clock: [["Cog", "Brass", "Gear", "Piston", "Steam", "Spring", "Rivet", "Tick"], ["Isles", "Works", "Tower", "Yard", "Hall", "Line", "Vault", "Depot"]],
  moon: [["Lunar", "Crater", "Orbit", "Silver", "Comet", "Nova", "Star", "Tranquil"], ["Station", "Dome", "Ridge", "Basin", "Outpost", "Rim", "Labs", "Pad"]],
  lagoon: [["Coral", "Pearl", "Shell", "Tide", "Lagoon", "Starfish", "Ripple", "Azure"], ["Lagoon", "Reef", "Shallows", "Atoll", "Cay", "Grotto", "Arch", "Bay"]],
  volcano: [["Scorch", "Fire", "Ember", "Sulfur", "Black", "Smoke", "Lava", "Ruby"], ["Rim", "Crater", "Vent", "Ridge", "Flow", "Peak", "Basin", "Gorge"]],
  toy: [["Brick", "Tin", "Teddy", "Marble", "Kite", "Crayon", "Spinner", "Yo-yo"], ["Town", "Square", "Block", "Park", "Lane", "Tower", "Corner", "Yard"]],
  aurora: [["Aurora", "Polar", "Starlit", "Glow", "Frost", "Comet", "Night", "Silent"], ["Realm", "Isles", "Peaks", "Sky", "Shore", "Haven", "Drift", "Crown"]],
};
const TITANS: Record<ThemeId, string> = {
  meadow: "Moss Titan", sakura: "Lantern Titan", mesa: "Canyon Colossus", frost: "Frost Titan", shroom: "Spore Giant", magma: "Magma Titan",
  candy: "Gumball Giant", bay: "Kraken Captain", jungle: "Idol Titan", crystal: "Prism Colossus", neon: "Neon Titan", harvest: "Scarecrow King",
  haunt: "Pumpkin Titan", temple: "Marble Colossus", clock: "Clockwork Titan", moon: "Crater Titan", lagoon: "Coral Titan", volcano: "Ember Colossus",
  toy: "Jack-in-the-Titan", aurora: "Aurora Titan",
};
export const MOD_LABEL: Record<Mod, string> = { night: "Night match", fog: "Thick fog", lowgrav: "Low gravity", giants: "Giant mobs", swarm: "Swarm", gold: "Gold rush ×2", storm: "Storm" };
export const MODE_LABEL: Record<Mode, string> = { sky: "Sky Clash", crystal: "Crystal Clash", zombie: "Zombie Night", obby: "Obby Run", titan: "Titan Fight" };

function line(p: Pick<StagePlan, "mode" | "rivals" | "teams" | "waves" | "titan">) {
  switch (p.mode) {
    case "sky": return `Knock out ${p.rivals} rivals`;
    case "crystal": return `Break ${p.teams - 1} enemy ${p.teams - 1 === 1 ? "crystal" : "crystals"} · guard yours`;
    case "zombie": return `Survive ${p.waves} waves`;
    case "obby": return "Reach the finish flag";
    case "titan": return `Beat the ${p.titan}`;
  }
}

function build(n: number, ti: number, blendI: number | null, local: number, d: number, mode: Mode, mods: Mod[], remix: boolean): StagePlan {
  const r = makeRng(n * 2246822519 + 3);
  const t = THEMES[ti], b = blendI !== null ? THEMES[blendI] : null;
  const names = NAMES[b && chance(r, 0.5) ? b.id : t.id];
  let time: TimeOfDay = pick(r, t.times);
  if (mods.includes("night")) time = "night";
  let weather: Weather = pick(r, t.weather);
  if (mods.includes("storm")) weather = t.id === "frost" || t.id === "aurora" ? "snow" : t.id === "magma" || t.id === "volcano" ? "ash" : "rain";
  const rivals = Math.round(2 + d * 5 + (mods.includes("swarm") ? 2 : 0));
  const teams = d < 0.3 ? 2 : d < 0.65 ? 3 : 4;
  const teamSize = d < 0.25 ? 1 : d < 0.6 ? 2 : 3;
  const waves = Math.round(3 + d * 5);
  const course = Math.round(14 + d * 26);
  const finale = local === STAGES_PER_THEME && !remix;
  const titan = (finale ? "Grand " : "") + TITANS[b && local % 20 === 0 ? b.id : t.id];
  const title = `${pick(r, names[0])} ${pick(r, names[1])}`;
  const p = { n, local, themeIndex: ti, theme: t.id, blend: b?.id ?? null, remix, seed: (n * 7919 + 17) >>> 0, title, subtitle: "", time, weather, mode, difficulty: d, rivals, teams, teamSize, waves, course, titan, mods, finale };
  p.subtitle = `${MODE_LABEL[mode]} · ${line(p)}`;
  return p;
}

const cache = new Map<number, StagePlan>();
export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  const hit = cache.get(n);
  if (hit) return hit;
  let p: StagePlan;
  if (n <= DESIGNED_STAGES) {
    const ti = Math.floor((n - 1) / STAGES_PER_THEME), local = ((n - 1) % STAGES_PER_THEME) + 1;
    const r = makeRng(n * 131 + 9);
    const breather = local % 7 === 0 ? -0.1 : 0;
    const d = clamp(0.08 + 0.64 * ((local - 1) / (STAGES_PER_THEME - 1)) + 0.015 * ti + breather + (r() - 0.5) * 0.05, 0.06, 0.96);
    const mode = RHYTHM[(local - 1) % RHYTHM.length];
    const mods: Mod[] = [];
    if (ti >= 2 && local > 5 && mode !== "titan" && chance(r, 0.15)) mods.push(pick(r, ["fog", "giants", "swarm", "gold", "storm", "night"] as Mod[]));
    if (THEMES[ti].id === "moon") mods.push("lowgrav");
    p = build(n, ti, null, local, d, mode, mods, false);
  } else {
    // the theme steps by 7 (of 20) and shifts every 20 stages, so two stages in a row never share a theme
    const k = n - DESIGNED_STAGES, NT = THEMES.length;
    const r = makeRng(n * 977 + 1);
    const a = (k * 7 + Math.floor(k / NT) * 3) % NT;
    const b = (a + 1 + Math.floor(hash(n, 5) * (NT - 1))) % NT;
    const d = clamp(0.74 + 0.2 * (0.5 + 0.5 * Math.sin(k * 0.37)) + (r() - 0.5) * 0.06, 0.6, 0.98);
    const mode = RHYTHM[(k - 1) % RHYTHM.length];
    const mods: Mod[] = [];
    const all: Mod[] = ["night", "fog", "giants", "swarm", "gold", "storm"];
    if (r() < 0.7) mods.push(all[Math.floor(r() * all.length)]);
    if (r() < 0.25) { const m = all[Math.floor(r() * all.length)]; if (!mods.includes(m)) mods.push(m); }
    if (THEMES[a].id === "moon") mods.push("lowgrav");
    p = build(n, a, b, ((k - 1) % STAGES_PER_THEME) + 1, d, mode, mods, true);
  }
  if (cache.size > 64) cache.clear();
  cache.set(n, p);
  return p;
}

/** names over the rivals' heads */
export const BOT_NAMES = [
  "PixelPanda", "CubeKid", "BlockBoss", "NoobSlayer", "Bricky", "VoxelVic", "SkyHopper", "Crafty", "MegaMoe", "TinyTank", "BuildaBear", "ZipZap",
  "LavaLuke", "FrostyFin", "MossyMo", "Jellybean", "RocketRae", "CaptainCube", "Snowpea", "Dynamo", "Bouncer", "Sprocket", "Glitchy", "Nova",
  "Ziggy", "Biscuit", "Pebbles", "Turbo", "Wasabi", "Marshmallow", "Kiwi", "Domino", "Waffles", "Pogo", "Comet", "Rumble", "Sparky", "Nugget",
];
