// Obby Bike Blaster's levels. Level n always builds the same way (seeded): a named course (a codename like "Cloudline
// Dash") of many sections in a row, each one obstacle pattern ending on a checkpoint pad, grouped into sectors of six.
// Patterns, from the first levels on: straight bridges, gap jumps, zigzags, steps, ramp jumps; then kill-block slaloms,
// sliding and lifting platforms, spinning bars, swinging hammers, falling tiles, ice, conveyor belts, jelly bounces,
// boost-pad leaps, pillar hops, laser gates, a bridge you open by shooting its target, crate walls you blast through,
// flying gremlins, tunnels and switchback climbs. Difficulty climbs through each world: longer courses, narrower paths,
// longer gaps, faster obstacles. After level 1,200 the remixes mix two worlds and every pattern, never the same mix
// twice in a row.
import { DESIGNED_LEVELS, LEVELS_PER_WORLD, WORLDS, type TimeOfDay, type Weather, type WorldId } from "./worlds";
import { chance, clamp, hash, irange, makeRng, pick, range, type Rng } from "./util";

export type Mat = "platA" | "platB" | "edge" | "wall" | "kill" | "ice" | "jelly" | "belt" | "boost" | "wood" | "metal" | "stone" | "crate" | "target" | "cp" | "finish" | "move" | "glass" | "start";
export type Kind = "solid" | "kill" | "bounce" | "ice" | "belt" | "boost" | "fall" | "cp" | "finish" | "ramp" | "crate" | "target" | "laser" | "spinner" | "hammer" | "bridge";
export type Pattern =
  | "bridge" | "gaps" | "zigzag" | "steps" | "rampJump" | "slalom" | "sliders" | "lifts" | "spinner" | "hammers" | "falling"
  | "ice" | "belts" | "bounce" | "boostGap" | "pillars" | "lasers" | "targetBridge" | "crates" | "gremlins" | "tunnel" | "switchback";
export type PickupKind = "coin" | "gem" | "oil" | "heart" | "power";

export interface Piece {
  id: number; kind: Kind; mat: Mat; section: number;
  /** rest box */
  x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  /** live offset of moving pieces */
  dx: number; dy: number; dz: number;
  /** ramps rise from y0 to y1 along +z (1) or −z (−1); the box's top follows the slope */
  ramp?: 1 | -1;
  move?: { ax: 0 | 1 | 2; amp: number; period: number; phase: number };
  /** spinning bars (about y) and swinging hammers (about z): pivot, arm length, speed */
  spin?: { cx: number; cy: number; cz: number; len: number; speed: number; phase: number; swing: boolean };
  belt?: { vx: number; vz: number };
  /** targets open the bridge pieces in their group */
  group?: number;
  on: boolean; t: number; hp: number;
}
export interface Checkpoint { x: number; y: number; z: number; section: number }
export interface Pickup { kind: PickupKind; x: number; y: number; z: number; section: number }
export interface Gremlin { x: number; y: number; z: number; amp: number; speed: number; phase: number; section: number }
export interface Course {
  pieces: Piece[]; checkpoints: Checkpoint[]; pickups: Pickup[]; gremlins: Gremlin[];
  start: { x: number; y: number; z: number }; finish: { x: number; y: number; z: number };
  length: number; minY: number; maxY: number; sections: number; patterns: Pattern[];
}

export type Mod = "night" | "fog" | "lowgrav" | "gold" | "storm" | "turbo" | "mirror";
export interface LevelPlan {
  n: number; local: number; worldIndex: number; world: WorldId; blend: WorldId | null; remix: boolean; seed: number;
  codename: string; subtitle: string; time: TimeOfDay; weather: Weather; difficulty: number;
  sections: number; pool: Pattern[]; mods: Mod[]; finale: boolean;
}

// ------------------------------------------------------------------ names
const NAMES: Record<WorldId, [string[], string[]]> = {
  sky: [["Cloudline", "Skyhook", "Breezy", "Bluebird", "Updraft", "Kite", "Sunbeam", "Halo", "Feather", "Zephyr"], ["Dash", "Run", "Loop", "Glide", "Sprint", "Climb", "Hop", "Ride", "Rally", "Trail"]],
  candy: [["Gumdrop", "Sprinkle", "Lolly", "Fudge", "Taffy", "Bonbon", "Toffee", "Jelly", "Cocoa", "Marzi"], ["Swirl", "Dash", "Twist", "Bounce", "Rush", "Ride", "Loop", "Spin", "Trail", "Run"]],
  canyon: [["Red Rock", "Mesa", "Dust Devil", "Coyote", "Sunstone", "Rattler", "Gulch", "Sandstorm", "Butte", "Ember"], ["Rush", "Leap", "Pass", "Run", "Drop", "Climb", "Trail", "Ride", "Dash", "Gap"]],
  jungle: [["Vine", "Jaguar", "Emerald", "Idol", "Canopy", "Parrot", "Monkey", "Lotus", "Thunder", "Temple"], ["Run", "Climb", "Leap", "Trail", "Steps", "Rush", "Swing", "Dash", "Ride", "Way"]],
  frost: [["Icicle", "Blizzard", "Polar", "Glacier", "Snowcap", "Frostbite", "Aurora", "Avalanche", "Chill", "Crystal"], ["Slide", "Rail", "Run", "Drift", "Dash", "Glide", "Pass", "Ride", "Rush", "Trail"]],
  docks: [["Cutlass", "Barnacle", "Anchor", "Galleon", "Parrot", "Plank", "Treasure", "Skull", "Harbor", "Lantern"], ["Run", "Dash", "Pier", "Hop", "Rush", "Ride", "Leap", "Walk", "Trail", "Sprint"]],
  neon: [["Volt", "Laser", "Chrome", "Pixel", "Synth", "Midnight", "Turbo", "Arc", "Glow", "Neon"], ["Rush", "Line", "Run", "Dash", "Drift", "Ride", "Rooftops", "Sprint", "Loop", "Circuit"]],
  lava: [["Magma", "Cinder", "Obsidian", "Inferno", "Basalt", "Scorch", "Molten", "Blaze", "Ember", "Ash"], ["Hop", "Run", "Leap", "Rush", "Dash", "Climb", "Crossing", "Escape", "Ride", "Gauntlet"]],
  toys: [["Building Block", "Tin Robot", "Teddy", "Yo-Yo", "Rubber Duck", "Marble", "Puzzle", "Spinning Top", "Toy Train", "Crayon"], ["Run", "Rally", "Dash", "Ride", "Race", "Hop", "Track", "Loop", "Trail", "Sprint"]],
  shroom: [["Toadstool", "Spore", "Puffcap", "Glimmer", "Mossy", "Bog", "Fungi", "Velvet", "Murk", "Firefly"], ["Bounce", "Hop", "Run", "Trail", "Ride", "Dash", "Drift", "Leap", "Way", "Path"]],
  haunt: [["Ghost", "Raven", "Pumpkin", "Moonlit", "Grim", "Wisp", "Crypt", "Shadow", "Bat", "Lantern"], ["Rails", "Run", "Ride", "Dash", "Bridge", "Escape", "Trail", "Hollow", "Rush", "Path"]],
  grid: [["Vector", "Binary", "Pulse", "Byte", "Circuit", "Quantum", "Cipher", "Matrix", "Pixel", "Laser"], ["Run", "Grid", "Line", "Loop", "Dash", "Stream", "Ride", "Rush", "Link", "Trace"]],
  blossom: [["Sakura", "Lotus", "Jade", "Lantern", "Koi", "Bamboo", "Petal", "Willow", "Plum", "Silk"], ["Path", "Bridge", "Run", "Ride", "Dash", "Steps", "Trail", "Way", "Glide", "Climb"]],
  clock: [["Cog", "Brass", "Piston", "Spring", "Rivet", "Boiler", "Gear", "Tick", "Steam", "Copper"], ["Run", "Works", "Line", "Dash", "Ride", "Rush", "Track", "Loop", "Climb", "Belt"]],
  crystal: [["Amethyst", "Prism", "Geode", "Shard", "Quartz", "Opal", "Gleam", "Lumen", "Echo", "Glint"], ["Run", "Dash", "Ride", "Rush", "Path", "Leap", "Trail", "Climb", "Glide", "Way"]],
  station: [["Orbit", "Comet", "Nova", "Airlock", "Booster", "Satellite", "Ion", "Zero-G", "Docking", "Pulsar"], ["Run", "Dash", "Walk", "Ride", "Rush", "Line", "Loop", "Sprint", "Track", "Hop"]],
  moon: [["Crater", "Lunar", "Apollo", "Silver", "Tranquil", "Moondust", "Eclipse", "Star", "Echo", "Orbit"], ["Hop", "Leap", "Bounce", "Run", "Glide", "Ride", "Dash", "Float", "Trail", "Rush"]],
  thunder: [["Thunder", "Storm", "Bolt", "Tempest", "Gale", "Cyclone", "Static", "Squall", "Volt", "Rumble"], ["Peak", "Run", "Ride", "Dash", "Climb", "Rush", "Pass", "Crossing", "Ridge", "Gauntlet"]],
  rainbow: [["Rainbow", "Starlight", "Prism", "Aurora", "Comet", "Stardust", "Spectrum", "Nebula", "Galaxy", "Wonder"], ["Road", "Run", "Ribbon", "Ride", "Dash", "Loop", "Glide", "Rush", "Way", "Trail"]],
  glitch: [["Null", "Error", "Static", "Corrupt", "Fractal", "Rogue", "Zero", "Phantom", "Shatter", "Overflow"], ["Run", "Loop", "Core", "Dash", "Crash", "Ride", "Rush", "Rift", "Gate", "Trace"]],
};

// patterns unlock as you go (global level number); bosses of pace — the finale levels use everything
const UNLOCK: [Pattern, number][] = [
  ["bridge", 1], ["gaps", 1], ["zigzag", 1], ["steps", 2], ["rampJump", 2], ["slalom", 3], ["pillars", 4], ["sliders", 5],
  ["targetBridge", 6], ["bounce", 7], ["crates", 8], ["boostGap", 9], ["lifts", 11], ["spinner", 13], ["falling", 15], ["belts", 18],
  ["gremlins", 20], ["hammers", 24], ["ice", 28], ["lasers", 32], ["tunnel", 36], ["switchback", 40],
];

export function levelPlan(n: number): LevelPlan {
  n = Math.max(1, Math.floor(n));
  if (n <= DESIGNED_LEVELS) {
    const wi = Math.floor((n - 1) / LEVELS_PER_WORLD), local = ((n - 1) % LEVELS_PER_WORLD) + 1;
    const r = makeRng(n * 977 + 11);
    const breather = local % 6 === 0 ? -0.08 : 0;
    const d = clamp(0.08 + 0.6 * ((local - 1) / (LEVELS_PER_WORLD - 1)) + 0.017 * wi + breather + (r() - 0.5) * 0.05, 0.05, 0.96);
    const pool = UNLOCK.filter(([, at]) => n >= at).map(([p]) => p);
    const mods: Mod[] = [];
    if (wi >= 2 && local > 4 && chance(r, 0.14)) mods.push(pick(r, ["fog", "gold", "storm", "turbo", "night"] as Mod[]));
    if (WORLDS[wi].id === "moon") mods.push("lowgrav");
    return build(n, WORLDS[wi].id, null, local, wi, d, pool, mods, false);
  }
  // endless remixes: the world steps by 7 (of 20) and shifts every 20, so two in a row never share a world
  const k = n - DESIGNED_LEVELS, NW = WORLDS.length;
  const a = (k * 7 + Math.floor(k / NW) * 3) % NW;
  const b = (a + 1 + Math.floor(hash(n, 2) * (NW - 1))) % NW;
  const r = makeRng(n * 31337 + 1);
  const d = clamp(0.72 + 0.2 * (0.5 + 0.5 * Math.sin(k * 0.37)) + (r() - 0.5) * 0.06, 0.6, 0.98);
  const mods: Mod[] = [];
  const all: Mod[] = ["night", "fog", "gold", "storm", "turbo", "mirror"];
  if (r() < 0.7) mods.push(all[Math.floor(r() * all.length)]);
  if (WORLDS[a].id === "moon") mods.push("lowgrav");
  return build(n, WORLDS[a].id, WORLDS[b].id, ((k - 1) % LEVELS_PER_WORLD) + 1, a, d, UNLOCK.map(([p]) => p), mods, true);
}
function build(n: number, world: WorldId, blend: WorldId | null, local: number, wi: number, d: number, pool: Pattern[], mods: Mod[], remix: boolean): LevelPlan {
  const r = makeRng(n * 2654435761 + 77);
  const w = WORLDS.find((x) => x.id === world)!;
  const names = NAMES[blend && chance(r, 0.5) ? blend : world];
  const codename = `${pick(r, names[0])} ${pick(r, names[1])}`;
  let time: TimeOfDay = pick(r, w.times);
  if (mods.includes("night")) time = "night";
  let weather: Weather = pick(r, w.weather);
  if (mods.includes("storm")) weather = w.id === "frost" ? "snow" : w.id === "lava" ? "ash" : "rain";
  const finale = local === LEVELS_PER_WORLD && !remix;
  // long courses: 18 sections at the very start, past 60 late in a world; finales are the longest
  const sections = Math.round(18 + d * 46 + (finale ? 10 : 0));
  const subtitle = `${sections} checkpoints · ${Math.ceil(sections / 6)} sectors`;
  return { n, local, worldIndex: wi, world, blend, remix, seed: (n * 7919 + 13) >>> 0, codename, subtitle, time, weather, difficulty: d, sections, pool, mods, finale };
}
export const MOD_LABEL: Record<Mod, string> = { night: "Night ride", fog: "Thick fog", lowgrav: "Low gravity", gold: "Gold rush ×2", storm: "Storm", turbo: "Turbo pads", mirror: "Mirror course" };
/** a short tip shown the first time you reach each tricky part */
export const PATTERN_TIP: Partial<Record<Pattern, string>> = {
  pillars: "Pillars: hop near the edge — pull back in the air to land short",
  sliders: "Ferry: let it stop beside you, ride on, roll off at the far side",
  lifts: "Lift: ride on when it's level, wait for the top",
  spinner: "Spinner: jump the bar as it sweeps at you",
  hammers: "Hammers: brake, wait for the swing, then go",
  ice: "Ice! Ease off and steer early",
  belts: "Belts push you sideways — lean against them",
  lasers: "Laser gates: ride the green wave at full speed",
  targetBridge: "Shoot the target to build the bridge",
  crates: "Blast the crate wall to get through",
  gremlins: "Gremlins! Blast them before they bump you",
  falling: "Falling tiles: don't stop!",
  bounce: "Jelly: ride on, it throws you up",
  boostGap: "Boost pad: hit it, then jump the big gap",
  rampJump: "Ramp: jump right at the top",
  switchback: "Switchbacks: brake for the turns",
  slalom: "Weave through the gaps — or hop the low blocks",
  tunnel: "Tunnel: dodge or hop the red strips",
};
export const PATTERN_LABEL: Record<Pattern, string> = {
  bridge: "Long bridge", gaps: "Gap jumps", zigzag: "Zigzag", steps: "Step climb", rampJump: "Ramp jump", slalom: "Kill-block slalom", sliders: "Sliding platforms",
  lifts: "Lifts", spinner: "Spinner", hammers: "Hammers", falling: "Falling tiles", ice: "Ice slide", belts: "Conveyor belts", bounce: "Jelly bounce",
  boostGap: "Boost leap", pillars: "Pillar hops", lasers: "Laser gates", targetBridge: "Shoot the target", crates: "Crate wall", gremlins: "Gremlin swarm",
  tunnel: "Tunnel", switchback: "Switchback climb",
};

// ------------------------------------------------------------------ building a course
export function buildCourse(p: LevelPlan): Course {
  const r = makeRng(p.seed);
  const d = p.difficulty;
  const pieces: Piece[] = [], checkpoints: Checkpoint[] = [], pickups: Pickup[] = [], gremlins: Gremlin[] = [];
  const mirror = p.mods.includes("mirror") ? -1 : 1;
  let id = 0, group = 0, section = 0;
  // the cursor: the middle of the path where the last piece ended, at its top
  let cx = 0, cy = 20, cz = 0;
  const add = (kind: Kind, mat: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}): Piece => {
    if (mirror < 0) { const a = -x1, b = -x0; x0 = a; x1 = b; }
    const pc: Piece = { id: id++, kind, mat, section, x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), dx: 0, dy: 0, dz: 0, on: true, t: 0, hp: 2, ...extra };
    if (mirror < 0 && pc.spin) pc.spin.cx = -pc.spin.cx;
    if (mirror < 0 && pc.belt) pc.belt.vx = -pc.belt.vx;
    if (mirror < 0 && pc.move && pc.move.ax === 0) pc.move.amp = -pc.move.amp;
    pieces.push(pc);
    return pc;
  };
  const coin = (x: number, y: number, z: number, kind: PickupKind = "coin") => pickups.push({ kind, x: x * mirror, y, z, section });
  const coinLine = (x: number, y: number, z0: number, z1: number, step = 1.6) => { for (let z = z0; z <= z1; z += step) coin(x, y + 1, z); };
  // a deck: the solid platform you ride on (checker top), with a thin trim strip on its sides
  const deck = (x: number, y: number, z0: number, z1: number, w: number, mat: Mat = "platA", kind: Kind = "solid", extra: Partial<Piece> = {}) =>
    add(kind, mat, x - w / 2, y - 1, z0, x + w / 2, y, z1, extra);
  const W = d < 0.25 ? 4 : d < 0.55 ? 3 : 2;
  const gapMax = 2 + d * 2.6;

  // the start pad
  deck(0, cy, -6, 6, 6, "start");
  const start = { x: 0, y: cy, z: -2 };
  cz = 6;

  const cp = () => {
    // a checkpoint pad with a flag, then a short runway so you come back up to speed before the next obstacle
    deck(cx, cy, cz, cz + 5, Math.max(W + 1, 4), "cp", "cp");
    checkpoints.push({ x: cx * mirror, y: cy, z: cz + 1.2, section });
    deck(cx, cy, cz + 5, cz + 10, Math.max(W, 3), "platA");
    cz += 10;
  };

  const patterns: Pattern[] = [];
  let last: Pattern | null = null;
  for (let s = 0; s < p.sections; s++) {
    section = s;
    // pick a pattern: never the same twice in a row, newer unlocks a bit more often
    let pat: Pattern = pick(r, p.pool);
    for (let k = 0; k < 4 && pat === last; k++) pat = pick(r, p.pool);
    if (p.pool.length > 5 && chance(r, 0.25)) pat = p.pool[p.pool.length - 1 - Math.floor(r() * Math.min(4, p.pool.length))];
    // every course opens with an easy bridge to warm up on
    if (s === 0) pat = "bridge";
    last = pat; patterns.push(pat);
    // sideways moves lean back toward the middle, so the course stays in a corridor the backdrop frames
    const toward = () => (cx > 5 ? -1 : cx < -5 ? 1 : r() < 0.5 ? -1 : 1);
    switch (pat) {
      case "bridge": {
        const L = irange(r, 10, 16 + Math.round(d * 6));
        const w = s === 0 ? 4 : Math.max(1, W - (chance(r, d * 0.6) ? 1 : 0));
        deck(cx, cy, cz, cz + L, w, chance(r, 0.5) ? "platA" : "platB");
        if (chance(r, 0.5)) { add("solid", "wall", cx - w / 2 - 1, cy - 1, cz + 2, cx - w / 2, cy + 1, cz + L - 2); }
        coinLine(cx, cy, cz + 2, cz + L - 2);
        cz += L;
        break;
      }
      case "gaps": {
        const n = irange(r, 2, 3 + Math.round(d * 2));
        for (let i = 0; i < n; i++) {
          const gap = range(r, 1.6, gapMax);
          cz += Math.round(gap);
          // long enough to land on after a full-speed hop (about 6.5 m)
          const L = irange(r, 5, 7);
          // level or a step down: a step up right after a gap leaves no room to land
          const dy = chance(r, 0.3) ? -1 : 0;
          cy += dy;
          deck(cx, cy, cz, cz + L, W, i % 2 ? "platB" : "platA");
          coin(cx, cy + 1.6, cz - gap / 2);
          cz += L;
        }
        break;
      }
      case "zigzag": {
        // staggered beams: each new beam starts beside the end of the last one (they overlap for a few metres), so
        // you change lanes left and right without stopping
        const n = irange(r, 3, 5);
        const w = Math.max(2, W - 1);
        for (let i = 0; i < n; i++) {
          const L = irange(r, 7, 10);
          deck(cx, cy, cz, cz + L, w + (i === 0 ? 1 : 0), i % 2 ? "platA" : "platB");
          coinLine(cx, cy, cz + 1, cz + L - 3, 2);
          const overlap = d > 0.6 ? 3 : 4;
          if (i < n - 1) { cx += toward() * w; cz += L - overlap; }
          else cz += L;
        }
        break;
      }
      case "steps": {
        const n = irange(r, 3, 5), up = chance(r, 0.7) ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const L = irange(r, 3, 4);
          cy += up;
          deck(cx, cy, cz, cz + L, W, i % 2 ? "platA" : "platB");
          coin(cx, cy, cz + L / 2);
          cz += L + (d > 0.4 && chance(r, 0.4) ? 1 : 0);
        }
        break;
      }
      case "rampJump": {
        deck(cx, cy, cz, cz + 4, W);
        cz += 4;
        const rise = irange(r, 1, 2);
        add("ramp", "boost", cx - W / 2, cy - 1, cz, cx + W / 2, cy + rise, cz + 5, { ramp: 1 });
        cy += rise; cz += 5;
        // a jump at the top clears ~8.5 m off a 1 m ramp and ~10 m off a 2 m one on the starter bike
        const gap = Math.round(range(r, 4.5, 5 + d * 1.5 + rise * 1.2));
        for (let k = 1; k < 5; k++) coin(cx, cy + 1.5 + Math.sin((k / 5) * Math.PI) * 2, cz + (gap * k) / 5);
        cz += gap;
        cy += irange(r, -2, 0);
        deck(cx, cy, cz, cz + 10, W + 1, "platA");
        cz += 10;
        break;
      }
      case "slalom": {
        const L = irange(r, 18, 26), w = W + 3;
        deck(cx, cy, cz, cz + L, w);
        // rows of kill blocks with an opening to weave through (or hop over); closer together and narrower later
        const gapZ = Math.max(6, 8 - Math.round(d * 3)), holeW = d > 0.6 ? 2 : 3;
        let hole = irange(r, 0, w - holeW);
        const maxShift = d < 0.4 ? 2 : 3;
        for (let z = cz + 3; z < cz + L - 2; z += gapZ) {
          hole = clamp(hole + irange(r, -maxShift, maxShift), 0, w - holeW);
          for (let x = 0; x < w; x++) if (x < hole || x >= hole + holeW) add("kill", "kill", cx - w / 2 + x, cy, z, cx - w / 2 + x + 1, cy + 0.3, z + 1);
          coin(cx - w / 2 + hole + holeW / 2, cy, z + 0.5);
        }
        cz += L;
        break;
      }
      case "pillars": {
        const n = irange(r, 4, 7);
        for (let i = 0; i < n; i++) {
          // early on the gaps are small enough to ride across; later they're spaced for a full-speed hop: jump a
          // metre before the edge and you come down in the middle of the next pillar (a drop carries you further)
          // each pillar steps sideways a little from the last (they always overlap by 2 m or more)
          const sz = d > 0.6 ? 3 : 4, drop = chance(r, 0.25) ? 1 : 0;
          if (i > 0) cx += irange(r, 0, sz - 2) * toward();
          cz += d < 0.3 ? 1 : Math.round((5.6 - sz / 2 + drop * 0.8 + range(r, -0.5, 0.4)) * 2) / 2;
          cy -= drop;
          add("solid", i % 2 ? "stone" : "platB", cx - sz / 2, cy - 6, cz, cx + sz / 2, cy, cz + sz);
          coin(cx, cy, cz + sz / 2);
          cz += sz;
        }
        cz += 1;
        deck(cx, cy, cz - 1, cz + 3, W);
        cz += 3;
        break;
      }
      case "sliders": {
        // ferries: the sliding platforms (all in step) rest beside this deck, glide across and rest beside the
        // next one — board while they wait, ride to the front, and roll off when they stop on the far side
        const fw = Math.max(W, 3);
        deck(cx, cy, cz, cz + 3, fw); cz += 3;
        const n = irange(r, 1, 2 + Math.round(d));
        const amp = range(r, 1.8, 2.8), period = 7 - d * 2.5, side = toward();
        const phase = r() * Math.PI * 2;
        // flush with the decks at both ends (as lifts are): when a ferry rests beside you there's no hole to drop in
        for (let i = 0; i < n; i++) {
          const L = 4;
          add("solid", "move", cx + side * amp - 1.5, cy - 0.6, cz, cx + side * amp + 1.5, cy, cz + L, { move: { ax: 0, amp: amp * side, period, phase } });
          coin(cx + side * amp, cy + 0.6, cz + L / 2);
          cz += L;
        }
        cx += side * amp * 2;
        deck(cx, cy, cz, cz + 4, fw); cz += 4;
        break;
      }
      case "lifts": {
        deck(cx, cy, cz, cz + 3, W); cz += 3;
        const n = irange(r, 1, 2);
        for (let i = 0; i < n; i++) {
          // no gap either side: the lift is level with you, below you (drop on) or above you (a wall), never a hole
          const rise = irange(r, 3, 5);
          // the lift rides between this level and the ledge above
          add("solid", "move", cx - 1.5, cy - 0.6 + rise / 2, cz, cx + 1.5, cy + rise / 2, cz + 4, { move: { ax: 1, amp: rise / 2, period: 6.5 - d * 2, phase: r() * 6 } });
          cy += rise; cz += 4;
          deck(cx, cy, cz, cz + 4, W, "platB");
          coin(cx, cy, cz + 2);
          cz += 4;
        }
        break;
      }
      case "spinner": {
        // a 7 m bar sweeping a deck 7 wide and 9 deep: a metre of calm at each end, and no safe lane round it
        const S = 10, B = 7;
        deck(cx, cy, cz, cz + S, B, "platB");
        add("spinner", "kill", cx - B / 2, cy, cz + S / 2 - 0.25, cx + B / 2, cy + 0.6, cz + S / 2 + 0.25, { spin: { cx, cy: cy + 0.3, cz: cz + S / 2, len: B, speed: (1.1 + d * 1.4) * (chance(r, 0.5) ? 1 : -1), phase: r() * 6, swing: false } });
        coin(cx + 3, cy, cz + 2); coin(cx - 3, cy, cz + S - 2);
        cz += S;
        break;
      }
      case "hammers": {
        const L = irange(r, 14, 20);
        deck(cx, cy, cz, cz + L, W + 1);
        // the frame the hammers hang from (6 m or more apart, so you can stop between two)
        const n = L >= 18 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const hz = cz + 3 + (i * (L - 6)) / Math.max(1, n - 1);
          add("solid", "metal", cx - W / 2 - 2, cy, hz - 0.5, cx - W / 2 - 1, cy + 6, hz + 0.5);
          add("solid", "metal", cx + W / 2 + 1, cy, hz - 0.5, cx + W / 2 + 2, cy + 6, hz + 0.5);
          add("solid", "metal", cx - W / 2 - 2, cy + 6, hz - 0.5, cx + W / 2 + 2, cy + 7, hz + 0.5);
          add("hammer", "kill", cx - 0.8, cy + 0.2, hz - 0.8, cx + 0.8, cy + 1.8, hz + 0.8, { spin: { cx, cy: cy + 6, cz: hz, len: 5, speed: 1.6 + d * 1.6, phase: i * 1.7 + r(), swing: true } });
        }
        coinLine(cx, cy, cz + 1, cz + L - 1, 2.5);
        cz += L;
        break;
      }
      case "falling": {
        const n = irange(r, 5, 8);
        for (let i = 0; i < n; i++) {
          deck(cx, cy, cz, cz + 2, W, i % 2 ? "glass" : "wood", "fall");
          if (i % 2 === 0) coin(cx, cy, cz + 1);
          cz += 2 + (d > 0.5 && i % 3 === 2 ? 1 : 0);
        }
        deck(cx, cy, cz, cz + 3, W); cz += 3;
        break;
      }
      case "ice": {
        const L = irange(r, 16, 24), w = W + 4;
        deck(cx, cy, cz, cz + L, w, "ice", "ice");
        // kill posts to steer around
        // one post per row, rows 6 m or more apart (you slide!), so there's always a lane either side
        const rows = Math.min(2 + Math.round(d * 3), Math.floor((L - 10) / 6) + 1);
        for (let k = 0; k < rows; k++) { const px = cx + irange(r, -1, 0), pz = cz + 4 + k * 6 + irange(r, 0, 1); add("kill", "kill", px, cy, pz, px + 1, cy + 1, pz + 1); }
        coinLine(cx, cy, cz + 2, cz + L - 2, 3);
        cz += L;
        // a grippy run-out as wide as the ice, narrowing to the checkpoint, so a slide doesn't carry you off
        deck(cx, cy, cz, cz + 5, w, "platA"); cz += 5;
        break;
      }
      case "belts": {
        const n = irange(r, 2, 3);
        for (let i = 0; i < n; i++) {
          const L = irange(r, 5, 7), side = chance(r, 0.5) ? 1 : -1, push = (2 + d * 2) * side;
          deck(cx, cy, cz, cz + L, Math.max(5, W + 2), "belt", "belt", { belt: { vx: push, vz: 0 } });
          coin(cx - side, cy, cz + L / 2);
          cz += L;
        }
        break;
      }
      case "bounce": {
        deck(cx, cy, cz, cz + 3, W); cz += 3;
        const n = irange(r, 1, 3);
        for (let i = 0; i < n; i++) {
          deck(cx, cy, cz, cz + 3, 3, "jelly", "bounce");
          for (let k = 1; k < 4; k++) coin(cx, cy + 2 + k, cz + 2 + k * 1.2);
          // the jelly throws you up and forward onto a higher platform a few metres on
          cz += 3 + irange(r, 3, 5);
          cy += irange(r, 1, 2);
          deck(cx, cy, cz, cz + 5, W, "platB");
          cz += 5;
        }
        break;
      }
      case "boostGap": {
        deck(cx, cy, cz, cz + 4, W); cz += 4;
        deck(cx, cy, cz, cz + 3, W, "boost", "boost"); cz += 3;
        deck(cx, cy, cz, cz + 3, W); cz += 3;
        // boosted to ~16 m/s a hop near the edge carries ~10 m
        const gap = Math.round(range(r, 7, 8 + d * 1.4));
        for (let k = 1; k < 6; k++) coin(cx, cy + 1 + Math.sin((k / 6) * Math.PI) * 1.4, cz + (gap * k) / 6);
        cz += gap;
        deck(cx, cy, cz, cz + 6, W + 1, "platB"); cz += 6;
        break;
      }
      case "lasers": {
        const L = irange(r, 14, 18);
        deck(cx, cy, cz, cz + L, W);
        add("solid", "wall", cx - W / 2 - 1, cy, cz, cx - W / 2, cy + 4, cz + L);
        add("solid", "wall", cx + W / 2, cy, cz, cx + W / 2 + 1, cy + 4, cz + L);
        const n = irange(r, 2, 4), period = 2.6 - d * 0.8, phase0 = r() * 6;
        for (let i = 0; i < n; i++) {
          const lz = cz + 3 + (i * (L - 6)) / Math.max(1, n - 1);
          // a green wave: at about 9 m/s each gate is off just as you get there
          add("laser", "kill", cx - W / 2, cy, lz, cx + W / 2, cy + 3, lz + 0.3, { move: { ax: 1, amp: 0, period, phase: phase0 - ((lz - cz - 3) / 9) * ((Math.PI * 2) / period) } });
        }
        coinLine(cx, cy, cz + 1, cz + L - 1, 2.5);
        cz += L;
        break;
      }
      case "targetBridge": {
        deck(cx, cy, cz, cz + 6, W + 2); cz += 6;
        group++;
        const gap = irange(r, 8, 11);
        // the target sits on a post beyond the gap, a little to one side
        const side = chance(r, 0.5) ? 1 : -1;
        add("solid", "stone", cx + side * 3.5 - 0.5, cy - 1, cz + gap + 1, cx + side * 3.5 + 0.5, cy + 2, cz + gap + 2);
        add("target", "target", cx + side * 3.5 - 0.7, cy + 2, cz + gap + 1, cx + side * 3.5 + 0.7, cy + 3.4, cz + gap + 2, { group, hp: 1 });
        for (let z = 0; z < gap; z += 1) add("bridge", "wood", cx - 1, cy - 0.5, cz + z, cx + 1, cy, cz + z + 1, { group, on: false, t: z * 0.06 });
        coinLine(cx, cy, cz + 1, cz + gap - 1, 2);
        cz += gap;
        deck(cx, cy, cz, cz + 5, W + 1); cz += 5;
        break;
      }
      case "crates": {
        deck(cx, cy, cz, cz + 12, W + 2);
        const wz = cz + 6, w = W + 2;
        for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) add("crate", "crate", cx - w / 2 + x, cy + y, wz, cx - w / 2 + x + 1, cy + y + 1, wz + 1, { hp: 2 });
        coin(cx, cy, cz + 9); coin(cx, cy, cz + 10);
        cz += 12;
        break;
      }
      case "gremlins": {
        const L = irange(r, 18, 24);
        deck(cx, cy, cz, cz + L, W);
        const n = 2 + Math.round(d * 3);
        for (let i = 0; i < n; i++) gremlins.push({ x: cx * mirror, y: cy + range(r, 1.2, 2.4), z: cz + 4 + (i * (L - 6)) / Math.max(1, n - 1), amp: range(r, 3, 6), speed: 1 + d + r() * 0.6, phase: r() * 6, section });
        coinLine(cx, cy, cz + 2, cz + L - 2, 2.2);
        cz += L;
        break;
      }
      case "tunnel": {
        const L = irange(r, 14, 20), w = Math.max(4, W + 2);
        deck(cx, cy, cz, cz + L, w, "platB");
        add("solid", "wall", cx - w / 2 - 1, cy, cz, cx - w / 2, cy + 4, cz + L);
        add("solid", "wall", cx + w / 2, cy, cz, cx + w / 2 + 1, cy + 4, cz + L);
        add("solid", "stone", cx - w / 2 - 1, cy + 4, cz, cx + w / 2 + 1, cy + 5, cz + L);
        for (let z = cz + 3; z < cz + L - 2; z += irange(r, 6, 7)) { const side = chance(r, 0.5) ? -1 : 1; add("kill", "kill", cx + (side < 0 ? -w / 2 : 0), cy, z, cx + (side < 0 ? 0 : w / 2), cy + 0.4, z + 1); coin(cx - side, cy, z + 0.5); }
        cz += L;
        break;
      }
      case "switchback": {
        // up a set of ramps that turn left and right
        const n = irange(r, 2, 3);
        const rw = Math.max(3, W);
        for (let i = 0; i < n; i++) {
          add("ramp", "platA", cx - rw / 2, cy - 1, cz, cx + rw / 2, cy + 2, cz + 6, { ramp: 1 });
          cy += 2; cz += 6;
          const side = i === 0 ? toward() : -Math.sign(cx || 1), len = 6 + rw, depth = len + 2;
          deck(cx + (side * len) / 2, cy, cz, cz + depth, len + rw, "platB");
          coin(cx + side * len * 0.5, cy, cz + depth / 2);
          cx += side * len; cz += depth;
        }
        deck(cx, cy, cz, cz + 3, rw); cz += 3;
        break;
      }
    }
    // the next checkpoint (the last section ends on the finish instead)
    if (s < p.sections - 1) cp();
    // pickups along the way
    if (s % 4 === 3) coin(cx, cy, cz - 2.5, "oil");
    if (s % 9 === 6) coin(cx + 1, cy, cz - 1.5, "heart");
    if (s % 5 === 2) coin(cx - 1, cy, cz - 3, "power");
    if (s % 11 === 8) coin(cx, cy + 1.5, cz - 4, "gem");
  }
  // the finish
  deck(cx, cy, cz, cz + 8, 7, "finish", "finish");
  const finish = { x: cx * mirror, y: cy, z: cz + 4 };
  let minY = 1e9, maxY = -1e9;
  for (const pc of pieces) { minY = Math.min(minY, pc.y0); maxY = Math.max(maxY, pc.y1); }
  return { pieces, checkpoints, pickups, gremlins, start, finish, length: cz + 8, minY, maxY, sections: p.sections, patterns };
}

/** a moving platform's offset at time t: it glides across and rests a while at each end (a clipped sine) */
export function moveAt(m: { amp: number; period: number; phase: number }, t: number) {
  return clamp(1.4 * Math.sin((t / m.period) * Math.PI * 2 + m.phase), -1, 1) * m.amp;
}
/** how far through the course a z is (0..1) */
export const progressAt = (c: Course, z: number) => clamp(z / c.length, 0, 1);
export function sectorOf(section: number) { return Math.floor(section / 6); }
void range; void hash;
export type { Rng };
