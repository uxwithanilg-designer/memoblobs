// The operations. Voxel Vanguard isn't "stage 1, stage 2": each of the 1200 designed operations has its own codename
// and is one long fight across several sectors (separate arenas, each named after a place in the world, the time of day
// moving on from sector to sector), and every sector is a run of mission phases — clear the robots out, survive the
// onslaught, defend the world's core, destroy the robot beacons that call in reinforcements, capture relay rings, beat
// a squad of gold elites — and the operation ends with a boss. An operation lasts about half an hour at the start and
// grows past an hour; it throws about ten times the robots of a classic wave stage at you, tougher, with more of them
// alive at once the further you go. Progress is kept after every phase, so you come back to where you left off.
// After 1200 the war goes on forever: remix operations blend two worlds' looks, places, robots and music, add twists
// (low gravity, a drone swarm, a rocket rain, a coin rush, a night raid, a horde) and swing the difficulty in long
// waves, so no stretch ever feels repeated.
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf, type BossKind, type RobotKind, type TimeOfDay, type Weather, type World, type WorldId } from "./worlds";
import { ROBOTS } from "./gear";
import { clamp, makeRng, pick, type Rng } from "./util";

export type Layout = "plaza" | "hills" | "fort" | "canyon" | "islands" | "ring" | "maze" | "terraces";
export type Twist = "lowgrav" | "swarm" | "rockets" | "coins" | "night" | "horde" | null;
export type Objective = "assault" | "survive" | "defend" | "sabotage" | "capture" | "elite" | "boss";

export interface Phase {
  kind: Objective;
  title: string; hint: string;
  /** the robots this phase sends, by weight */
  mix: [RobotKind, number][];
  /** assault and elite: robots to destroy */
  count: number;
  /** survive and defend: seconds to hold out; capture: seconds to take each ring */
  secs: number;
  towers: number; zones: number;
  /** the share of gold elites, the most robots alive at once, seconds between robots coming in */
  elite: number; cap: number; every: number;
  boss: BossKind | null;
  /** this phase's difficulty (0–1) */
  d: number;
}
export interface Sector { index: number; name: string; layout: Layout; size: number; seed: number; time: TimeOfDay; weather: Weather; twist: Twist; phases: Phase[] }

export interface StagePlan {
  /** the operation's number (1–1200, then remixes) */
  n: number;
  world: WorldId; blend: WorldId | null; blendAmt: number;
  local: number; remix: number;
  codename: string;
  /** about how long it takes, in minutes */
  minutes: number;
  sectors: Sector[];
  /** the sector this plan describes (its arena, sky and weather below) */
  sector: number;
  seed: number; layout: Layout; size: number; time: TimeOfDay; weather: Weather;
  difficulty: number;
  /** the boss waiting at the end */
  boss: BossKind;
  finale: boolean;
  twist: Twist;
  allies: number;
  title: string; subtitle: string;
}

const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", day: "Midday", golden: "Golden hour", dusk: "Dusk", night: "Night" };
const WEATHER_LABEL: Partial<Record<Weather, string>> = { rain: "Rain", snow: "Snowfall", dust: "Dust storm", embers: "Embers", leaves: "Falling leaves", fireflies: "Fireflies", spores: "Spores", stars: "Starlight", petals: "Petals" };
export const TWIST_LABEL: Record<Exclude<Twist, null>, string> = { lowgrav: "Low gravity", swarm: "Drone swarm", rockets: "Rocket rain", coins: "Coin rush", night: "Night raid", horde: "Horde" };
const LAYOUTS: Record<WorldId, Layout[]> = {
  meadow: ["hills", "plaza", "fort", "terraces"], canyon: ["canyon", "ring", "fort", "terraces"], frost: ["hills", "fort", "ring", "maze"],
  metro: ["plaza", "maze", "ring", "fort"], jungle: ["terraces", "islands", "hills", "maze"], foundry: ["maze", "ring", "fort", "canyon"],
  lagoon: ["islands", "hills", "plaza", "ring"], sky: ["islands", "ring", "terraces", "plaza"], sakura: ["terraces", "hills", "plaza", "fort"],
  lunar: ["ring", "hills", "canyon", "plaza"], crystal: ["canyon", "maze", "ring", "hills"], citadel: ["fort", "maze", "ring", "plaza"],
};
const TOUGH: Record<RobotKind, number> = { scout: 0, roller: 0.1, trooper: 0.12, drone: 0.2, spider: 0.32, sniper: 0.28, brute: 0.4 };

// ---------------------------------------------------------------- codenames: 60 × 60, every operation its own
const ADJ = [
  "Iron", "Silent", "Crimson", "Thunder", "Golden", "Rusty", "Frozen", "Neon", "Emerald", "Molten", "Coral", "Sky", "Velvet", "Lunar", "Violet",
  "Chrome", "Shadow", "Blazing", "Steel", "Wild", "Hidden", "Burning", "Cobalt", "Scarlet", "Brave", "Last", "First", "Broken", "Rising", "Falling",
  "Midnight", "Morning", "Storm", "Copper", "Silver", "Jade", "Amber", "Onyx", "Ivory", "Titan", "Swift", "Rapid", "Echo", "Nova", "Polar",
  "Desert", "Hollow", "Bright", "Savage", "Quiet", "Lucky", "Bold", "Rogue", "Phantom", "Solar", "Primal", "Arctic", "Feral", "Mighty", "Atomic",
];
const NOUN = [
  "Fern", "Hammer", "Dawn", "Comet", "Falcon", "Anvil", "Lantern", "Viper", "Glacier", "Harbor", "Meteor", "Thistle", "Beacon", "Canyon", "Orchid",
  "Rampart", "Tempest", "Wolf", "Cinder", "Lotus", "Bastion", "Ember", "Raven", "Summit", "Trident", "Sparrow", "Mantis", "Bulwark", "Cyclone", "Badger",
  "Pinnacle", "Avalanche", "Hornet", "Lynx", "Mirage", "Quarry", "Rocket", "Saber", "Tundra", "Vortex", "Willow", "Zephyr", "Breaker", "Citadel", "Drift",
  "Fortress", "Gauntlet", "Horizon", "Javelin", "Kestrel", "Monsoon", "Nebula", "Outpost", "Phoenix", "Quasar", "Ridge", "Specter", "Thunderbolt", "Uplink", "Warden",
];
export function codenameOf(n: number) {
  const i = ((n - 1) * 1543) % (ADJ.length * NOUN.length);
  return `Operation ${ADJ[i % ADJ.length]} ${NOUN[Math.floor(i / ADJ.length)]}`;
}

// ---------------------------------------------------------------- phases
const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
function mixFor(list: [RobotKind, number][], d: number, twist: Twist): [RobotKind, number][] {
  const ok = list.filter(([k]) => TOUGH[k] <= d + 0.1);
  const out: [RobotKind, number][] = (ok.length ? ok : list.slice(0, 1)).map(([k, w]) => [k, w * (twist === "swarm" && k === "drone" ? 4 : 1)]);
  if (twist === "swarm" && !out.some(([k]) => k === "drone")) out.push(["drone", 4]);
  return out;
}
const POOL: [Objective, number][] = [["survive", 2], ["defend", 2], ["sabotage", 2], ["capture", 2], ["assault", 1.5], ["elite", 1]];

function makePhase(kind: Objective, r: Rng, w: World, list: [RobotKind, number][], d: number, E: number, twist: Twist, boss: BossKind | null, first: boolean): Phase {
  const horde = twist === "horde" ? 1.4 : 1;
  const ph: Phase = {
    kind, title: "", hint: "", mix: mixFor(list, d, twist), count: 0, secs: 0, towers: 0, zones: 0,
    elite: clamp(d * 0.14, 0.02, 0.16), cap: Math.round((8 + d * 9) * (twist === "horde" ? 1.25 : 1)), every: clamp((2.3 - d * 1.4) / horde, 0.7, 2.3), boss, d,
  };
  switch (kind) {
    case "assault":
      ph.count = Math.round((E / (3.1 + d * 2.2)) * horde);
      ph.title = first ? "Clear the landing zone" : pick(r, ["Push them back", "Sweep the sector", "Break their line", "Take the high ground"]);
      ph.hint = `Destroy ${ph.count} robots`;
      break;
    case "survive":
      ph.secs = Math.round(E / 5) * 5; ph.every *= 0.8; ph.cap += 2;
      ph.title = pick(r, ["Hold out!", "Survive the onslaught", "Stand your ground", "Weather the storm"]);
      ph.hint = `Survive for ${fmt(ph.secs)}`;
      break;
    case "defend":
      ph.secs = Math.round((E * 0.95) / 5) * 5;
      ph.title = `Defend the ${w.core.toLowerCase()}`;
      ph.hint = `Keep robots off it for ${fmt(ph.secs)}`;
      break;
    case "sabotage":
      ph.towers = 3 + Math.floor(d * 3.2 + r() * 0.8); ph.every *= 1.5;
      ph.title = "Destroy the robot beacons";
      ph.hint = `${ph.towers} beacons are calling in robots`;
      break;
    case "capture":
      ph.zones = 2 + (d > 0.45 ? 1 : 0) + (d > 0.8 ? 1 : 0);
      ph.secs = Math.round((E * 0.55) / ph.zones);
      ph.title = pick(r, ["Capture the relays", "Take the signal rings", "Seize the drop zones"]);
      ph.hint = `Stand in each ring for ${ph.secs}s`;
      break;
    case "elite":
      ph.count = Math.round(E / (7.5 + d * 4)); ph.elite = 1; ph.cap = Math.max(5, Math.round(ph.cap * 0.6)); ph.every *= 1.6;
      ph.title = "Elite squad";
      ph.hint = `${ph.count} gold elites`;
      break;
    case "boss":
      ph.cap = Math.max(4, Math.round(ph.cap * 0.55)); ph.every *= 2;
      ph.title = ROBOTS[boss!].name;
      ph.hint = "The boss is here — take it down";
      break;
  }
  return ph;
}

function makeSectors(r: Rng, w: World, partner: World | null, list: [RobotKind, number][], d0: number, minutes: number, nSectors: number, boss: BossKind, twists: (i: number) => Twist, timesFrom: TimeOfDay[], weathers: Weather[], seed: number): Sector[] {
  const nPhases = Math.max(nSectors * 2, Math.round(minutes / 3.8));
  const E = (minutes * 60) / nPhases;
  const per = Array.from({ length: nSectors }, (_, i) => Math.floor(nPhases / nSectors) + (i >= nSectors - (nPhases % nSectors) ? 1 : 0));
  const layouts = [...new Set([...LAYOUTS[w.id], ...(partner ? LAYOUTS[partner.id] : [])])];
  const places = [...w.places, ...(partner ? partner.places : [])];
  const t0 = Math.floor(r() * timesFrom.length);
  const sectors: Sector[] = [];
  let done = 0, last: Objective = "assault", lastLayout: Layout | null = null, placeI = Math.floor(r() * places.length);
  for (let i = 0; i < nSectors; i++) {
    const twist = twists(i);
    let layout = pick(r, layouts);
    if (layout === lastLayout) layout = layouts[(layouts.indexOf(layout) + 1) % layouts.length];
    lastLayout = layout;
    let time = timesFrom[(t0 + i) % timesFrom.length];
    if (twist === "night") time = "night";
    let weather: Weather = pick(r, weathers);
    if (weather === "fireflies" && time !== "night" && time !== "dusk") weather = "clear";
    const phases: Phase[] = [];
    for (let k = 0; k < per[i]; k++) {
      const progress = (done + k) / nPhases;
      const d = clamp(d0 + progress * 0.14, 0.05, 1);
      const lastOne = i === nSectors - 1 && k === per[i] - 1;
      let kind: Objective;
      if (lastOne) kind = "boss";
      else if (k === 0) kind = "assault";
      else {
        const pool = POOL.filter(([o]) => o !== last && (o !== "elite" || d > 0.3));
        let tot = 0; for (const [, wt] of pool) tot += wt;
        let v = r() * tot; kind = pool[0][0];
        for (const [o, wt] of pool) { v -= wt; if (v <= 0) { kind = o; break; } }
      }
      last = kind;
      phases.push(makePhase(kind, r, w, list, d, E, twist, lastOne ? boss : null, k === 0));
    }
    done += per[i];
    placeI = (placeI + 1 + Math.floor(r() * 3)) % places.length;
    sectors.push({ index: i, name: places[placeI], layout, size: Math.round(16 + d0 * 7 + r() * 4 + (i === nSectors - 1 ? 3 : 0)), seed: seed + i * 7717, time, weather, twist, phases });
  }
  return sectors;
}

/** a plan seen from one of its sectors (the arena, sky and weather the game builds) */
export function sectorView(p: StagePlan, i: number): StagePlan {
  const s = p.sectors[clamp(i, 0, p.sectors.length - 1)];
  return { ...p, sector: s.index, seed: s.seed, layout: s.layout, size: s.size, time: s.time, weather: s.weather, twist: s.twist, subtitle: `${s.name} · ${TIME_LABEL[s.time]}${WEATHER_LABEL[s.weather] ? ` · ${WEATHER_LABEL[s.weather]}` : ""}` };
}

export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_STAGES) return remixPlan(n);
  const wi = Math.floor((n - 1) / STAGES_PER_WORLD), w = WORLDS[wi];
  const local = ((n - 1) % STAGES_PER_WORLD) + 1;
  const r = makeRng(n * 7919 + 101);
  const t = (n - 1) / (DESIGNED_STAGES - 1), within = (local - 1) / (STAGES_PER_WORLD - 1);
  const finale = local === STAGES_PER_WORLD;
  // tough from the first operation, tougher every world and every operation
  const difficulty = clamp(0.18 + 0.66 * t + 0.08 * within + (finale ? 0.04 : 0) + (r() - 0.5) * 0.04, 0.15, 0.97);
  const minutes = Math.round(30 + 30 * t + r() * 2 + (finale ? 4 : 0));
  const nSectors = clamp(3 + Math.floor(t * 3.2) + (finale ? 1 : 0), 3, 7);
  const boss: BossKind = finale ? w.boss : (["titan", "carrier", "overlord"] as BossKind[])[(n + wi) % 3];
  const seed = n * 104729 + 7;
  const sectors = makeSectors(r, w, null, w.robots, difficulty, minutes, nSectors, boss, () => null, w.times, w.weathers, seed);
  const s0 = sectors[0];
  const plan: StagePlan = {
    n, world: w.id, blend: null, blendAmt: 0, local, remix: 0, codename: codenameOf(n), minutes, sectors, sector: 0,
    seed: s0.seed, layout: s0.layout, size: s0.size, time: s0.time, weather: s0.weather, difficulty, boss, finale, twist: null, allies: 2,
    title: codenameOf(n), subtitle: "",
  };
  return sectorView(plan, 0);
}

const TWISTS: Exclude<Twist, null>[] = ["lowgrav", "swarm", "rockets", "coins", "night", "horde"];

/** after operation 1200: endless remixes */
function remixPlan(n: number): StagePlan {
  const k = n - DESIGNED_STAGES;
  const season = Math.floor((k - 1) / WORLDS.length);
  const order = WORLDS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 17);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const wi = order[(k - 1) % WORLDS.length], w = WORLDS[wi];
  const r = makeRng(n * 15485863 + 311);
  let partner = WORLDS[Math.floor(r() * WORLDS.length)];
  if (partner.id === w.id) partner = WORLDS[(wi + 5) % WORLDS.length];
  const blendAmt = 0.25 + r() * 0.2;
  const times: TimeOfDay[] = [...new Set([...w.times, ...partner.times])];
  const weathers: Weather[] = [...new Set([...w.weathers, ...partner.weathers])];
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  const difficulty = clamp(0.84 + 0.12 * wave + (r() - 0.5) * 0.04, 0.7, 1);
  const minutes = Math.round(60 + 8 + 8 * wave + r() * 4);
  const nSectors = 5 + Math.floor(r() * 3);
  const list: [RobotKind, number][] = [...w.robots, ...partner.robots.map(([kk, ww]) => [kk, ww * 0.6] as [RobotKind, number])];
  const twistAt = (i: number): Twist => { const v = makeRng(n * 31 + i * 7907)(); return v < 0.45 ? null : TWISTS[Math.floor(v * 1000) % TWISTS.length]; };
  const boss = pick(r, ["titan", "carrier", "overlord"] as BossKind[]);
  const seed = n * 104729 + 991;
  const sectors = makeSectors(r, w, partner, list, difficulty, minutes, nSectors, boss, twistAt, times, weathers, seed);
  const s0 = sectors[0];
  const plan: StagePlan = {
    n, world: w.id, blend: partner.id, blendAmt, local: k, remix: k, codename: codenameOf(n), minutes, sectors, sector: 0,
    seed: s0.seed, layout: s0.layout, size: s0.size, time: s0.time, weather: s0.weather, difficulty, boss, finale: false, twist: s0.twist, allies: 2,
    title: codenameOf(n), subtitle: "",
  };
  return sectorView(plan, 0);
}

/** "World 3 · Frostbite Ridge" or "Remix 12 · Frostbite × Coral" */
export function whereOf(p: StagePlan) {
  return p.remix ? `Remix ${p.remix} · ${worldOf(p.world).name.split(" ")[0]} × ${worldOf(p.blend!).name.split(" ")[0]}` : `World ${Math.floor((p.n - 1) / STAGES_PER_WORLD) + 1} · ${worldOf(p.world).name}`;
}
export const phasesIn = (p: StagePlan) => p.sectors.reduce((a, s) => a + s.phases.length, 0);
/** how many robots an operation sends, about (towers' and bosses' reinforcements on top) */
export function robotsIn(p: StagePlan) {
  let n = 0;
  for (const s of p.sectors) for (const ph of s.phases) n += ph.count || Math.round((ph.secs * (ph.zones || 1)) / ph.every) || Math.round(200 / ph.every);
  return n;
}
