// Voxel Vanguard's twelve worlds, 100 operations each (1200 in all). Every world has its own pixel block set (painted
// in art/atlas.ts), its own arena layouts and props, a big painted backdrop around the arena (rolling farm hills and
// windmills, canyon mesas, frozen peaks under an aurora, a neon skyline, jungle temples and waterfalls, a volcano over
// a robot foundry, a lagoon with a lighthouse, floating sky docks, cherry-blossom hills with pagodas, the moon with the
// Earth overhead, a waste of giant glowing crystals, and the robot citadel), its own robots, music, ambience, times of
// day and weather, and its own place names for the sectors you fight through.

export type WorldId = "meadow" | "canyon" | "frost" | "metro" | "jungle" | "foundry" | "lagoon" | "sky" | "sakura" | "lunar" | "crystal" | "citadel";
export type TimeOfDay = "morning" | "day" | "golden" | "dusk" | "night";
export type Weather = "clear" | "rain" | "snow" | "dust" | "embers" | "leaves" | "fireflies" | "spores" | "stars" | "petals";
/** what the ground is made of (art/atlas.ts paints a tile set for each) */
export type Ground = "grass" | "sand" | "snow" | "street" | "jungle" | "ash" | "beach" | "cloud" | "moon" | "chrome";
/** what stands around the arena, far off */
export type Backdrop = "hills" | "mesas" | "peaks" | "skyline" | "temples" | "volcano" | "ocean" | "islands" | "pagodas" | "craters" | "crystals" | "fortress";
export type PropKind =
  | "tree" | "pine" | "palm" | "bush" | "rock" | "crate" | "barrel" | "fence" | "hay" | "windmill" | "cactus" | "ruin"
  | "icespike" | "lamp" | "car" | "sign" | "vine" | "idol" | "pipe" | "tank" | "lifebuoy" | "hut" | "balloon" | "antenna"
  | "dome" | "crystal" | "pylon" | "statue" | "mushroom";
export type RobotKind = "scout" | "trooper" | "roller" | "drone" | "brute" | "sniper" | "spider";
export type BossKind = "titan" | "carrier" | "overlord";
export type Ambient = "birds" | "wind" | "crickets" | "owls" | "traffic" | "parrots" | "drips" | "machines" | "lava" | "waves" | "gulls" | "chimes" | "beeps" | "hum";

export interface World {
  id: WorldId;
  name: string;
  blurb: string;
  sky: [string, string, string];
  fog: string;
  sun: string;
  ambient: string;
  ground: Ground;
  /** the block palette: grass/top, earth/side, deep, wall, trim, glow */
  palette: { top: string; side: string; deep: string; wall: string; trim: string; glow: string; water: string };
  backdrop: Backdrop;
  props: [PropKind, number][];
  robots: [RobotKind, number][];
  boss: BossKind;
  gravity: number;
  times: TimeOfDay[];
  weathers: Weather[];
  ambience: Ambient[];
  accent: string;
  /** the music band (src/vanguard/music.ts) */
  band: { style: string; bpm: number; root: number };
  /** what the objective you defend is called here, and the places the sectors are named after */
  core: string;
  places: string[];
  water?: boolean; lava?: boolean;
}

export const STAGES_PER_WORLD = 100;

export const WORLDS: World[] = [
  {
    id: "meadow", name: "Meadow Outpost", blurb: "Farm hills, windmills and the first robot landing.",
    sky: ["#3E8EE8", "#8CC8F8", "#E2F4FF"], fog: "#BFE2FF", sun: "#FFF4D0", ambient: "#9AB8E8",
    ground: "grass", palette: { top: "#5CC043", side: "#8A5A36", deep: "#6B4428", wall: "#9A9A9A", trim: "#C8873E", glow: "#FFE36B", water: "#3A9AE8" },
    backdrop: "hills", props: [["tree", 4], ["bush", 3], ["fence", 2], ["hay", 2], ["crate", 1.5], ["rock", 1.5], ["windmill", 0.5]],
    robots: [["scout", 4], ["trooper", 3], ["roller", 1.5], ["drone", 1]], boss: "titan", gravity: 22,
    times: ["morning", "day", "day", "golden"], weathers: ["clear", "clear", "petals", "rain"], ambience: ["birds", "wind"],
    accent: "#5CC043", band: { style: "M16", bpm: 118, root: 60 },
    core: "Uplink", places: ["Windmill Hill", "Old Barn", "Sunflower Field", "Mill Creek", "Hay Bale Yard", "Orchard Row", "Stone Bridge", "Clover Meadow", "Fox Hollow", "Pumpkin Patch", "Silo Ridge", "Farmhouse Lane"],
  },
  {
    id: "canyon", name: "Sandstone Canyon", blurb: "Red mesas, cactus flats and buried ruins.",
    sky: ["#3A78D0", "#F0B070", "#FFE0A8"], fog: "#F4C890", sun: "#FFE8B0", ambient: "#D8A878",
    ground: "sand", palette: { top: "#E8B060", side: "#C0703C", deep: "#9A5030", wall: "#D89A5A", trim: "#7A3A20", glow: "#FFB347", water: "#3AA8C8" },
    backdrop: "mesas", props: [["cactus", 4], ["rock", 3], ["ruin", 2], ["crate", 1.5], ["barrel", 1.5]],
    robots: [["scout", 3], ["trooper", 3], ["roller", 2], ["sniper", 1.5], ["drone", 1]], boss: "titan", gravity: 22,
    times: ["day", "golden", "golden", "dusk"], weathers: ["clear", "dust", "clear"], ambience: ["wind"],
    accent: "#FF9A3C", band: { style: "M08", bpm: 112, root: 57 },
    core: "Water pump", places: ["Red Mesa", "Dry Gulch", "Arch Pass", "Rattler Flats", "Buried Temple", "Dust Bowl", "Coyote Bluff", "Copper Mine", "Sunset Ridge", "Cactus Run", "Bone Valley", "Eagle Rock"],
  },
  {
    id: "frost", name: "Frostbite Ridge", blurb: "Snowfields, ice spires and a frozen radar post.",
    sky: ["#5A8AD8", "#A8CCF0", "#EEF6FF"], fog: "#DDEBFA", sun: "#FFFFFF", ambient: "#B8CCE8",
    ground: "snow", palette: { top: "#F4FAFF", side: "#8AA8C8", deep: "#5A7698", wall: "#B8D0E8", trim: "#3A6AA8", glow: "#8CF0FF", water: "#7CC8F0" },
    backdrop: "peaks", props: [["pine", 4], ["icespike", 2.5], ["rock", 2], ["crate", 1.5], ["antenna", 0.8]],
    robots: [["trooper", 3], ["drone", 2.5], ["sniper", 1.5], ["brute", 1], ["roller", 1]], boss: "carrier", gravity: 22,
    times: ["morning", "day", "night", "night"], weathers: ["snow", "snow", "clear"], ambience: ["wind", "owls"],
    accent: "#7CD8FF", band: { style: "M11", bpm: 160, root: 62 },
    core: "Radar dish", places: ["Icefall", "Glacier Gate", "Pine Hollow", "Frozen Lake", "Avalanche Pass", "Snowcap Post", "Aurora Ridge", "Yeti Cave", "White Shelf", "Blizzard Point", "Crystal Brook", "North Watch"],
  },
  {
    id: "metro", name: "Neon Metro", blurb: "Rooftop plazas under a skyline of neon.",
    sky: ["#0C1030", "#2A2460", "#7A3A8A"], fog: "#3A2A5A", sun: "#E0D8FF", ambient: "#5A4A9A",
    ground: "street", palette: { top: "#626884", side: "#424664", deep: "#2C3048", wall: "#525878", trim: "#FF4FD8", glow: "#5BF0FF", water: "#2A3A7A" },
    backdrop: "skyline", props: [["lamp", 3], ["car", 2], ["sign", 2], ["crate", 1.5], ["barrel", 1.5], ["pipe", 1]],
    robots: [["trooper", 3], ["drone", 3], ["sniper", 2], ["roller", 1.5], ["brute", 1]], boss: "carrier", gravity: 22,
    times: ["night", "night", "dusk"], weathers: ["rain", "clear", "rain"], ambience: ["traffic", "hum"],
    accent: "#FF4FD8", band: { style: "M10", bpm: 112, root: 59 },
    core: "Power grid", places: ["Neon Plaza", "Rooftop 9", "Subway Yard", "Arcade Street", "Skybridge", "Market Square", "Tower Block", "Night Market", "Signal Alley", "Harbor Lights", "Chrome Avenue", "Hotel Roof"],
  },
  {
    id: "jungle", name: "Emerald Jungle", blurb: "Temple steps, vines and roaring waterfalls.",
    sky: ["#4FA0E8", "#9AD6D8", "#E0F8E0"], fog: "#B8E8C8", sun: "#FFF6D0", ambient: "#8AC8A0",
    ground: "jungle", palette: { top: "#3AA84A", side: "#6A4A30", deep: "#4A3220", wall: "#8A9A7A", trim: "#4A6A3A", glow: "#7CFF8A", water: "#3AB8B0" },
    backdrop: "temples", props: [["palm", 3], ["bush", 3], ["vine", 2], ["idol", 1.5], ["rock", 2], ["mushroom", 1]],
    robots: [["scout", 3], ["spider", 2.5], ["drone", 2], ["trooper", 2], ["brute", 1]], boss: "titan", gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "rain", "fireflies", "leaves"], ambience: ["parrots", "drips"],
    accent: "#3EE08F", band: { style: "M16", bpm: 108, root: 58 }, water: true,
    core: "Shrine", places: ["Vine Steps", "Waterfall Ledge", "Idol Court", "Parrot Grove", "Moss Ruins", "Serpent Path", "Lost Altar", "Fern Gully", "Tiger Rock", "Sunken Gate", "Canopy Walk", "Jade Pool"],
  },
  {
    id: "foundry", name: "Magma Foundry", blurb: "The robots' forge on a smoking volcano.",
    sky: ["#3A2030", "#9A4A3A", "#F0904A"], fog: "#7A3A30", sun: "#FFC890", ambient: "#9A5A4A",
    ground: "ash", palette: { top: "#5A4A48", side: "#3A2E2C", deep: "#2A2020", wall: "#6A5A5A", trim: "#FF6A2A", glow: "#FFB03A", water: "#FF5A1A" },
    backdrop: "volcano", props: [["pipe", 3], ["tank", 2], ["barrel", 2], ["crate", 1.5], ["rock", 2], ["pylon", 1]],
    robots: [["trooper", 3], ["brute", 2], ["spider", 2], ["roller", 2], ["sniper", 1]], boss: "titan", gravity: 22,
    times: ["dusk", "night", "day"], weathers: ["embers", "embers", "clear"], ambience: ["machines", "lava"],
    accent: "#FF6A2A", band: { style: "M19", bpm: 140, root: 52 }, lava: true,
    core: "Coolant tank", places: ["Slag Pit", "Smelter 3", "Crane Yard", "Lava Sluice", "Ash Field", "Forge Hall", "Pipe Maze", "Molten Bridge", "Cinder Deck", "Furnace Row", "Ingot Bay", "Vent Ridge"],
  },
  {
    id: "lagoon", name: "Coral Lagoon", blurb: "Beach islands, palms and a lighthouse in the surf.",
    sky: ["#3A9AF0", "#8AD8F8", "#F0FCFF"], fog: "#BCE8F8", sun: "#FFFBE0", ambient: "#9AD0E8",
    ground: "beach", palette: { top: "#F0D890", side: "#D8B070", deep: "#B08A50", wall: "#E8E0D0", trim: "#FF6A8A", glow: "#FFE08A", water: "#2AC8D8" },
    backdrop: "ocean", props: [["palm", 4], ["hut", 1.5], ["lifebuoy", 1], ["rock", 2], ["crate", 1.5], ["barrel", 1]],
    robots: [["scout", 3], ["roller", 2.5], ["drone", 2.5], ["trooper", 2], ["sniper", 1]], boss: "carrier", gravity: 22,
    times: ["day", "golden", "golden", "dusk"], weathers: ["clear", "clear", "rain"], ambience: ["waves", "gulls"],
    accent: "#2AC8D8", band: { style: "M15", bpm: 98, root: 64 }, water: true,
    core: "Lighthouse lamp", places: ["Coral Reef", "Palm Cove", "Shipwreck Bay", "Turtle Beach", "Pier End", "Sandbar", "Lagoon Isle", "Shell Point", "Tide Pools", "Surf Hut", "Driftwood Dunes", "Pearl Rock"],
  },
  {
    id: "sky", name: "Sky Docks", blurb: "Floating islands, airship moorings and long drops.",
    sky: ["#4A9AF8", "#9AD0FF", "#F4FAFF"], fog: "#D8ECFF", sun: "#FFFBE8", ambient: "#B0D0F8",
    ground: "cloud", palette: { top: "#7CD86A", side: "#A88A68", deep: "#8A6A50", wall: "#D8D0C0", trim: "#3A6AD8", glow: "#FFE08A", water: "#FFFFFF" },
    backdrop: "islands", props: [["tree", 3], ["balloon", 1.5], ["crate", 2], ["windmill", 1], ["bush", 2], ["fence", 1.5]],
    robots: [["drone", 4], ["trooper", 2], ["sniper", 2], ["scout", 2], ["brute", 1]], boss: "carrier", gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "petals", "clear"], ambience: ["wind", "chimes"],
    accent: "#7CE7FF", band: { style: "M06", bpm: 122, root: 61 },
    core: "Airship anchor", places: ["Cloud Dock", "Balloon Field", "Wind Spire", "Hanging Gardens", "Skyway Pier", "Drift Isle", "Gust Ridge", "Rainbow Span", "Kite Terrace", "High Mooring", "Feather Rock", "Cirrus Port"],
  },
  {
    id: "sakura", name: "Blossom Valley", blurb: "Cherry-blossom hills, pagodas and misty mountains.",
    sky: ["#6A9AE8", "#F4C4D8", "#FFF0F4"], fog: "#F4DAE6", sun: "#FFF0E0", ambient: "#E8B8D0",
    ground: "grass", palette: { top: "#86C85A", side: "#7A5238", deep: "#5A3A28", wall: "#E8DCC8", trim: "#C83A3A", glow: "#FF8AC8", water: "#5AB8E8" },
    backdrop: "pagodas", props: [["tree", 4], ["bush", 2], ["statue", 1], ["fence", 1.5], ["rock", 2], ["crate", 1]],
    robots: [["scout", 3], ["trooper", 3], ["drone", 2], ["sniper", 2], ["spider", 1.5], ["brute", 1]], boss: "titan", gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["petals", "petals", "clear", "rain"], ambience: ["birds", "chimes"],
    accent: "#FF8AC8", band: { style: "M20", bpm: 122, root: 63 },
    core: "Temple bell", places: ["Petal Garden", "Koi Pond", "Lantern Road", "Pagoda Hill", "Bamboo Grove", "Moon Bridge", "Tea House", "Maple Steps", "Mist Shrine", "Blossom Gate", "Stone Garden", "Cherry Walk"],
  },
  {
    id: "lunar", name: "Lunar Base", blurb: "Craters, habitat domes and the Earth overhead.",
    sky: ["#05060F", "#101530", "#2A2A4A"], fog: "#1A1C30", sun: "#F4F0FF", ambient: "#5A5A8A",
    ground: "moon", palette: { top: "#B8B8C4", side: "#8A8A98", deep: "#5A5A68", wall: "#D8DCE8", trim: "#4AA8FF", glow: "#9AF0FF", water: "#5A5A7A" },
    backdrop: "craters", props: [["dome", 1.5], ["crystal", 2.5], ["antenna", 1.5], ["rock", 3], ["crate", 1.5], ["pylon", 1]],
    robots: [["drone", 3], ["spider", 2.5], ["trooper", 2], ["sniper", 2], ["brute", 1.5]], boss: "overlord", gravity: 9,
    times: ["night"], weathers: ["stars"], ambience: ["beeps", "hum"],
    accent: "#9AF0FF", band: { style: "M02", bpm: 126, root: 55 },
    core: "Oxygen dome", places: ["Tranquil Base", "Crater Rim", "Dark Side", "Dome 4", "Regolith Flats", "Earthrise Ridge", "Helium Mine", "Rover Bay", "Launch Pad", "Dust Sea", "Antenna Hill", "Lava Tube"],
  },
  {
    id: "crystal", name: "Crystal Wastes", blurb: "A violet waste of giant glowing crystals.",
    sky: ["#1A1040", "#5A3A9A", "#C88AE8"], fog: "#5A3A8A", sun: "#F0D8FF", ambient: "#8A6AC8",
    ground: "moon", palette: { top: "#8A7AA8", side: "#5A4A78", deep: "#3A2E58", wall: "#A898C8", trim: "#5BF0FF", glow: "#E07CFF", water: "#7A5AE8" },
    backdrop: "crystals", props: [["crystal", 4], ["rock", 3], ["pylon", 1.5], ["mushroom", 1.5], ["crate", 1]],
    robots: [["drone", 3], ["spider", 2.5], ["sniper", 2], ["brute", 2], ["trooper", 2], ["roller", 1.5]], boss: "overlord", gravity: 22,
    times: ["dusk", "night", "golden"], weathers: ["spores", "clear", "stars"], ambience: ["hum", "chimes"],
    accent: "#E07CFF", band: { style: "M05", bpm: 132, root: 56 },
    core: "Prism core", places: ["Amethyst Field", "Shard Canyon", "Glow Caverns", "Prism Lake", "Geode Hollow", "Quartz Spires", "Echo Rift", "Violet Ridge", "Crystal Arch", "Lumen Flats", "Spark Gulch", "Opal Basin"],
  },
  {
    id: "citadel", name: "Chrome Citadel", blurb: "The robot army's fortress — the final fight.",
    sky: ["#1A0A1A", "#4A1A2A", "#9A3A3A"], fog: "#3A1A22", sun: "#FFD0C0", ambient: "#6A3A4A",
    ground: "chrome", palette: { top: "#9AA0B0", side: "#5A606E", deep: "#3A3E4A", wall: "#7A808E", trim: "#FF2A3A", glow: "#FF4A5A", water: "#FF2A3A" },
    backdrop: "fortress", props: [["pylon", 3], ["pipe", 2], ["tank", 2], ["statue", 1], ["barrel", 1.5], ["crate", 1]],
    robots: [["trooper", 3], ["brute", 2.5], ["sniper", 2], ["drone", 2], ["spider", 2], ["roller", 1.5]], boss: "overlord", gravity: 22,
    times: ["night", "dusk"], weathers: ["embers", "clear"], ambience: ["machines", "hum"],
    accent: "#FF4A5A", band: { style: "M13", bpm: 128, root: 53 },
    core: "Rebel beacon", places: ["Outer Wall", "Gatehouse", "Drone Hangar", "Reactor Ring", "Throne Hall", "Assembly Line", "Command Deck", "Red Spire", "Iron Court", "Signal Tower", "Vault Gate", "Overlord Keep"],
  },
];
export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD;
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
