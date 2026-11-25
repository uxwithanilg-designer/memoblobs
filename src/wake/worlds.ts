// The twelve worlds of Wake Racers. Each one is a whole place, not a recolour: its own land (beaches and islands,
// canyon walls, harbour quays, fjord mountains, jungle banks, canal houses, blossom hills, lava fields, storm cliffs,
// a crystal cave, desert dunes, a neon bay), its own sky moods (three each, cycled through the stages), water colours,
// props near the water and landmarks on the horizon, weather, hazards, set pieces, a band style and its ambience.
// Stages 1–600 walk through them fifty at a time; remix stages after that mix two worlds at once.

export type WorldId =
  | "lagoon" | "canyon" | "harbor" | "fjord" | "jungle" | "canals"
  | "blossom" | "volcano" | "storm" | "caverns" | "dunes" | "cyber";

/** how the land rises from the water's edge */
export type Profile = "beach" | "cliffs" | "quay" | "mountains" | "banks" | "canal" | "hills" | "lava" | "coast" | "cave" | "dunes" | "neon";

export type PropKind =
  | "palm" | "hut" | "parasol" | "lighthouse" | "boulder" | "bush" | "reeds" | "lily" | "pine" | "snowpine" | "iceberg"
  | "roundtree" | "jungletree" | "fern" | "pillar" | "ruin" | "temple" | "house" | "lamp" | "pagoda" | "blossomtree"
  | "gate" | "stonelantern" | "lavarock" | "vent" | "cactus" | "mesa" | "arch" | "tower" | "neontower" | "crane"
  | "containers" | "billboard" | "holo" | "crystal" | "mushroom" | "stalagmite" | "turbine" | "wreck" | "seastack"
  | "tent" | "obelisk" | "moored" | "flagpole" | "bridgeLights";

/** landmarks on the horizon (big shapes the fog turns to haze) */
export type FarKind = "peaks" | "snowpeaks" | "mesas" | "volcano" | "skyline" | "neonskyline" | "jungle" | "isles" | "pagodahill" | "dunes" | "cliffs" | "cavewall";

export type Weather = "none" | "rain" | "snow" | "petals" | "ash" | "fireflies" | "leaves" | "sparks" | "dust" | "spores" | "mist";

export type Ambient =
  | "gull" | "surf" | "parrot" | "whale" | "hawk" | "wind" | "horn" | "bell" | "ice" | "frog" | "chime"
  | "lava" | "thunder" | "drip" | "synth" | "monkey" | "crowd";

export type Hazard = "rock" | "log" | "mine" | "barrel" | "iceberg" | "crystal" | "lavarock" | "drone" | "crate" | "debris" | "buoy";

/** a set piece the course builder can lay down (besides plain bends) */
export type Feature =
  | "ramp" | "jumps" | "rapids" | "waterfall" | "island" | "bridge" | "arch" | "whirlpool" | "gates" | "boost"
  | "slalom" | "narrows" | "bay" | "logjam" | "minefield" | "rocks" | "ferry" | "pillars" | "tunnel";

export interface Mood {
  name: string;
  /** sky: zenith, horizon and the colour under the horizon (fog / far sea) */
  top: string; horizon: string; low: string;
  sun: string; sunEl: number; sunAz: number; sunSize: number;
  /** cloud cover 0..1 and colours (lit and shaded) */
  clouds: number; cloud: string; cloudShade: string;
  stars: number; aurora: number; night: number;
  fog: string; fogNear: number; fogFar: number;
  /** sun and sky light */
  light: number; hemiSky: string; hemiGround: string; hemi: number;
  water: { deep: string; shallow: string; foam: string; sky: string };
  exposure: number;
}

export interface PropRule {
  k: PropKind;
  /** distance band from the water's edge (m; negative = in the water) */
  e: [number, number];
  /** average spacing along the course on each side (m) */
  every: number;
  scale: [number, number];
  /** only on one side (−1 left, 1 right) */
  side?: -1 | 1;
  /** placed in tight groups */
  cluster?: number;
}

export interface World {
  id: WorldId;
  name: string;
  tagline: string;
  /** UI accent colours */
  accent: string; accent2: string;
  moods: Mood[];
  profile: Profile;
  /** land colours by role */
  land: { bed: string; shore: string; low: string; mid: string; high: string; top: string; strata?: string[]; glow?: string };
  /** land height (m above the water) and roughness */
  height: number; rough: number;
  /** channel width range (m) */
  width: [number, number];
  waves: number;
  props: PropRule[];
  far: FarKind[];
  weather: Weather;
  hazards: [Hazard, number][];
  features: [Feature, number][];
  music: { style: string; bpm: number; root: number };
  ambience: Ambient[];
  /** the champion you race at the end of the world */
  boss: { name: string; boat: string };
}

const m = (o: Partial<Mood> & Pick<Mood, "name" | "top" | "horizon" | "sun" | "water">): Mood => ({
  low: o.horizon, sunEl: 40, sunAz: 20, sunSize: 1, clouds: 0.3, cloud: "#ffffff", cloudShade: "#c9d6e8",
  stars: 0, aurora: 0, night: 0, fog: o.horizon, fogNear: 140, fogFar: 900, light: 2.2, hemiSky: "#dfefff",
  hemiGround: "#6a5a48", hemi: 1.1, exposure: 1, ...o,
});

export const WORLDS: World[] = [
  {
    id: "lagoon", name: "Coral Lagoon", tagline: "Turquoise shallows, palm islands and a lighthouse",
    accent: "#19D3C5", accent2: "#FFB547",
    moods: [
      m({ name: "Midday", top: "#1E7BEA", horizon: "#BDF0FF", low: "#9FE6F2", sun: "#FFF6DC", sunEl: 58, sunAz: 30, clouds: 0.32,
        water: { deep: "#0A6E9C", shallow: "#38E3D1", foam: "#FFFFFF", sky: "#9DDCFF" }, fogFar: 1100, hemiSky: "#d8f4ff", hemiGround: "#e9d7a8" }),
      m({ name: "Golden hour", top: "#3554C9", horizon: "#FFC68A", low: "#F0B489", sun: "#FFB35C", sunEl: 9, sunAz: -10, sunSize: 1.5, clouds: 0.42,
        cloud: "#FFE0B8", cloudShade: "#C9839A", water: { deep: "#145E8E", shallow: "#3FC4BA", foam: "#FFF1DC", sky: "#FFC9A0" }, light: 2, hemiSky: "#ffd9b0", hemiGround: "#8a6a50", exposure: 1.05 }),
      m({ name: "Pink dusk", top: "#26215F", horizon: "#FF8FA3", low: "#C9708E", sun: "#FF7A7A", sunEl: 3, sunAz: 15, sunSize: 1.8, clouds: 0.5,
        cloud: "#FFB3C1", cloudShade: "#6A4A8A", stars: 0.25, night: 0.3, water: { deep: "#1A3E70", shallow: "#3A93A8", foam: "#FFE3EA", sky: "#FF9EB4" },
        light: 1.4, hemiSky: "#ffb3c8", hemiGround: "#4a3a5a", hemi: 0.9 }),
    ],
    profile: "beach",
    land: { bed: "#E8D5A0", shore: "#F6E7BE", low: "#7BD36B", mid: "#4FB35A", high: "#C8B38A", top: "#9C8A6A" },
    height: 9, rough: 0.6, width: [30, 46], waves: 0.5,
    props: [
      { k: "palm", e: [2, 18], every: 14, scale: [0.85, 1.35], cluster: 3 },
      { k: "hut", e: [2, 6], every: 120, scale: [0.9, 1.1] },
      { k: "parasol", e: [1, 6], every: 60, scale: [0.9, 1.1], cluster: 2 },
      { k: "bush", e: [4, 30], every: 18, scale: [0.7, 1.4] },
      { k: "boulder", e: [-2, 3], every: 50, scale: [0.6, 1.4] },
      { k: "lighthouse", e: [6, 14], every: 900, scale: [1, 1.1], side: 1 },
      { k: "moored", e: [3, 10], every: 220, scale: [0.9, 1.1] },
      { k: "flagpole", e: [1, 4], every: 300, scale: [1, 1] },
    ],
    far: ["isles", "volcano"], weather: "none",
    hazards: [["rock", 3], ["buoy", 2], ["barrel", 1], ["log", 1]],
    features: [["ramp", 3], ["jumps", 2], ["island", 3], ["boost", 2], ["slalom", 2], ["bay", 2], ["arch", 1], ["rocks", 2], ["ferry", 1]],
    music: { style: "M01", bpm: 112, root: 62 }, ambience: ["gull", "surf", "parrot", "whale"],
    boss: { name: "Captain Coral", boat: "dart" },
  },
  {
    id: "canyon", name: "Redrock Canyon", tagline: "Striped cliffs, stone arches and roaring falls",
    accent: "#FF7A3D", accent2: "#FFD15C",
    moods: [
      m({ name: "High sun", top: "#2F6FD0", horizon: "#F8DDB8", low: "#E9C49A", sun: "#FFF1D0", sunEl: 62, sunAz: 40, clouds: 0.18,
        water: { deep: "#16606A", shallow: "#47A89A", foam: "#F7F2E8", sky: "#AFCFEA" }, fog: "#F1D3AE", fogNear: 160, fogFar: 1000, hemiSky: "#f7e3c4", hemiGround: "#9a4a2a" }),
      m({ name: "Sunset", top: "#47307E", horizon: "#FF9147", low: "#D9774A", sun: "#FF8A3D", sunEl: 7, sunAz: 0, sunSize: 1.6, clouds: 0.35,
        cloud: "#FFC48A", cloudShade: "#8E4A6A", water: { deep: "#1E4C5E", shallow: "#4E8E8A", foam: "#FFE6CC", sky: "#FFB27A" }, light: 1.9, hemiSky: "#ffbf8a", hemiGround: "#5a2a2a", exposure: 1.05 }),
      m({ name: "Starry night", top: "#0B1236", horizon: "#3A3A78", low: "#2A2550", sun: "#E8ECFF", sunEl: 35, sunAz: -40, sunSize: 0.7, clouds: 0.1,
        cloud: "#5A5E8A", cloudShade: "#1A1A3A", stars: 1, night: 1, water: { deep: "#0B1E33", shallow: "#1F4A60", foam: "#C9D6FF", sky: "#3A4A88" },
        fog: "#232552", fogFar: 800, light: 0.9, hemiSky: "#6a74c8", hemiGround: "#2a1a2a", hemi: 0.8 }),
    ],
    profile: "cliffs",
    land: { bed: "#7A5A3A", shore: "#C98B5A", low: "#D9774A", mid: "#C1502A", high: "#E8A060", top: "#B57A4A", strata: ["#C1440E", "#E07A3F", "#F2A65A", "#9C3A1A", "#E8B07A", "#B5582A"] },
    height: 34, rough: 0.7, width: [26, 40], waves: 0.35,
    props: [
      { k: "cactus", e: [3, 30], every: 26, scale: [0.8, 1.4], cluster: 2 },
      { k: "boulder", e: [-2, 6], every: 22, scale: [0.8, 2.2], cluster: 2 },
      { k: "bush", e: [1, 12], every: 24, scale: [0.6, 1.1] },
      { k: "mesa", e: [60, 110], every: 160, scale: [0.8, 1.4] },
      { k: "arch", e: [20, 50], every: 500, scale: [0.9, 1.3] },
      { k: "flagpole", e: [1, 3], every: 380, scale: [1, 1] },
    ],
    far: ["mesas", "cliffs"], weather: "dust",
    hazards: [["rock", 4], ["log", 2], ["barrel", 1]],
    features: [["waterfall", 3], ["rapids", 3], ["arch", 3], ["ramp", 2], ["narrows", 2], ["rocks", 3], ["bridge", 1], ["jumps", 1]],
    music: { style: "M11", bpm: 170, root: 57 }, ambience: ["hawk", "wind"],
    boss: { name: "Rusty Mesa", boat: "bolt" },
  },
  {
    id: "harbor", name: "Neon Harbor", tagline: "A night port of towers, cranes and light",
    accent: "#FF4FA3", accent2: "#36E3FF",
    moods: [
      m({ name: "City night", top: "#070B26", horizon: "#3B1E63", low: "#22124A", sun: "#B8C8FF", sunEl: 30, sunAz: -30, sunSize: 0.6, clouds: 0.25,
        cloud: "#3A2A6A", cloudShade: "#120A2A", stars: 0.5, night: 1, water: { deep: "#04122A", shallow: "#0C3460", foam: "#B8E4FF", sky: "#5A2E8A" },
        fog: "#25174A", fogNear: 120, fogFar: 850, light: 0.8, hemiSky: "#7a5ac8", hemiGround: "#1a1030", hemi: 0.9, exposure: 1.1 }),
      m({ name: "Rain night", top: "#0A1020", horizon: "#2A3550", low: "#1A2235", sun: "#9AB0D8", sunEl: 40, sunAz: 10, sunSize: 0.5, clouds: 0.85,
        cloud: "#2A3450", cloudShade: "#0A0E1A", night: 1, water: { deep: "#061424", shallow: "#123A55", foam: "#CFE8FF", sky: "#34507A" },
        fog: "#1E2840", fogNear: 90, fogFar: 650, light: 0.7, hemiSky: "#5a7ab8", hemiGround: "#101828", hemi: 0.85, exposure: 1.12 }),
      m({ name: "Dawn", top: "#2A3D8A", horizon: "#FF9E7A", low: "#C77A8A", sun: "#FFB08A", sunEl: 6, sunAz: 20, sunSize: 1.4, clouds: 0.45,
        cloud: "#FFC3A8", cloudShade: "#6A5A9A", night: 0.25, water: { deep: "#14305A", shallow: "#3A6E8E", foam: "#FFE8DC", sky: "#FFA88A" },
        light: 1.6, hemiSky: "#ffb8a0", hemiGround: "#3a3050", exposure: 1.05 }),
    ],
    profile: "quay",
    land: { bed: "#2A2E3A", shore: "#4A4E62", low: "#3A3F55", mid: "#30344A", high: "#4A4F68", top: "#5A607A" },
    height: 3, rough: 0.1, width: [34, 50], waves: 0.3,
    props: [
      { k: "tower", e: [14, 60], every: 34, scale: [0.8, 1.6], cluster: 2 },
      { k: "neontower", e: [20, 70], every: 70, scale: [0.9, 1.5] },
      { k: "crane", e: [3, 10], every: 150, scale: [0.9, 1.2] },
      { k: "containers", e: [4, 14], every: 60, scale: [0.9, 1.2], cluster: 2 },
      { k: "lamp", e: [1.2, 2], every: 22, scale: [1, 1] },
      { k: "billboard", e: [8, 20], every: 120, scale: [0.9, 1.3] },
      { k: "moored", e: [-2.6, -1.4], every: 90, scale: [0.9, 1.3] },
    ],
    far: ["neonskyline", "skyline"], weather: "none",
    hazards: [["crate", 3], ["buoy", 3], ["barrel", 2], ["mine", 1]],
    features: [["bridge", 4], ["ferry", 3], ["boost", 3], ["gates", 2], ["ramp", 2], ["pillars", 2], ["slalom", 1], ["tunnel", 1]],
    music: { style: "M10", bpm: 108, root: 57 }, ambience: ["horn", "gull", "bell"],
    boss: { name: "Neon Nix", boat: "comet" },
  },
  {
    id: "fjord", name: "Frostbite Fjord", tagline: "Glacier water, icebergs and northern lights",
    accent: "#7FD8FF", accent2: "#B98CFF",
    moods: [
      m({ name: "Crisp day", top: "#3D73C9", horizon: "#DCEBFF", low: "#B8D2EC", sun: "#FFFFFF", sunEl: 24, sunAz: 30, clouds: 0.3,
        water: { deep: "#0B3558", shallow: "#3A8DB3", foam: "#FFFFFF", sky: "#BFD8F2" }, fog: "#D2E4F8", fogFar: 1100, hemiSky: "#e0efff", hemiGround: "#5a6a80" }),
      m({ name: "Aurora", top: "#040A22", horizon: "#123A5A", low: "#0A1E36", sun: "#CFE6FF", sunEl: 30, sunAz: -20, sunSize: 0.6, clouds: 0.1,
        cloud: "#2A4A6A", cloudShade: "#0A1424", stars: 1, aurora: 1, night: 1, water: { deep: "#04142A", shallow: "#0F3A55", foam: "#BFF5E5", sky: "#2A8A7A" },
        fog: "#0E2A44", fogNear: 120, fogFar: 850, light: 0.9, hemiSky: "#4ac8a8", hemiGround: "#0a1424", hemi: 0.9, exposure: 1.1 }),
      m({ name: "Snow haze", top: "#8DA6C8", horizon: "#E8EEF6", low: "#D4DEEA", sun: "#FFF8F0", sunEl: 18, sunAz: 0, sunSize: 1.2, clouds: 0.75,
        cloud: "#F4F7FB", cloudShade: "#A8B6C8", water: { deep: "#1A3E5A", shallow: "#4C8AA8", foam: "#FFFFFF", sky: "#D8E2EE" },
        fog: "#E2E9F2", fogNear: 70, fogFar: 600, light: 1.6, hemiSky: "#f0f4fa", hemiGround: "#7a8a9a" }),
    ],
    profile: "mountains",
    land: { bed: "#3A4A5A", shore: "#6A7484", low: "#4C5E5A", mid: "#5B6577", high: "#8A94A6", top: "#F4F8FF" },
    height: 60, rough: 0.8, width: [30, 48], waves: 0.45,
    props: [
      { k: "snowpine", e: [3, 40], every: 9, scale: [0.8, 1.6], cluster: 4 },
      { k: "iceberg", e: [4, 30], every: 70, scale: [0.6, 1.5] },
      { k: "boulder", e: [-1, 8], every: 30, scale: [0.8, 1.8] },
      { k: "hut", e: [2, 8], every: 400, scale: [0.9, 1.1] },
      { k: "flagpole", e: [1, 3], every: 420, scale: [1, 1] },
    ],
    far: ["snowpeaks", "peaks"], weather: "snow",
    hazards: [["iceberg", 4], ["rock", 2], ["log", 1], ["buoy", 1]],
    features: [["waterfall", 2], ["island", 2], ["narrows", 2], ["ramp", 2], ["arch", 2], ["rocks", 2], ["slalom", 2], ["jumps", 1]],
    music: { style: "M13", bpm: 100, root: 62 }, ambience: ["ice", "wind", "whale"],
    boss: { name: "Frost Fenna", boat: "foil" },
  },
  {
    id: "jungle", name: "Emerald Delta", tagline: "Jade rivers, temple ruins and hanging vines",
    accent: "#3EE08F", accent2: "#FFD23F",
    moods: [
      m({ name: "Misty morning", top: "#5AA0D2", horizon: "#DFF1D6", low: "#B8D9B0", sun: "#FFF4D8", sunEl: 28, sunAz: 25, clouds: 0.4,
        water: { deep: "#21503A", shallow: "#4E9A62", foam: "#EAF7E0", sky: "#BFE0C8" }, fog: "#CFE6C6", fogNear: 60, fogFar: 650, hemiSky: "#e0f4d8", hemiGround: "#3a4a20" }),
      m({ name: "Golden canopy", top: "#3C6FC0", horizon: "#FFD98A", low: "#C9B070", sun: "#FFC060", sunEl: 12, sunAz: -15, sunSize: 1.4, clouds: 0.35,
        cloud: "#FFE6B0", cloudShade: "#9A7A6A", water: { deep: "#2A4A2E", shallow: "#5E8E4E", foam: "#FFF1C8", sky: "#E8C88A" }, fog: "#E3CF8E", fogNear: 90, fogFar: 750, hemiSky: "#ffe0a0", hemiGround: "#3a3010" }),
      m({ name: "Firefly night", top: "#06142A", horizon: "#1F4A3A", low: "#123024", sun: "#D8F0FF", sunEl: 40, sunAz: 0, sunSize: 0.6, clouds: 0.2,
        cloud: "#2A4A3A", cloudShade: "#0A1A14", stars: 0.8, night: 1, water: { deep: "#06201A", shallow: "#164A3A", foam: "#C8FFE0", sky: "#2A6A5A" },
        fog: "#102E26", fogNear: 60, fogFar: 600, light: 0.8, hemiSky: "#3a8a6a", hemiGround: "#08140e", hemi: 0.9, exposure: 1.1 }),
    ],
    profile: "banks",
    land: { bed: "#4A3A22", shore: "#6B4E2E", low: "#3E8E41", mid: "#2A6E34", high: "#1F5E2E", top: "#4E8A3A" },
    height: 16, rough: 0.8, width: [26, 40], waves: 0.3,
    props: [
      { k: "jungletree", e: [2, 34], every: 8, scale: [0.8, 1.5], cluster: 3 },
      { k: "fern", e: [0.5, 10], every: 7, scale: [0.7, 1.3], cluster: 3 },
      { k: "reeds", e: [-2, 1], every: 12, scale: [0.8, 1.2], cluster: 3 },
      { k: "lily", e: [-6, 1], every: 10, scale: [0.6, 1.4], cluster: 4 },
      { k: "pillar", e: [1, 10], every: 90, scale: [0.9, 1.3], cluster: 2 },
      { k: "ruin", e: [4, 18], every: 200, scale: [0.9, 1.2] },
      { k: "temple", e: [26, 60], every: 600, scale: [1, 1.3] },
    ],
    far: ["jungle", "peaks"], weather: "fireflies",
    hazards: [["log", 4], ["rock", 2], ["barrel", 1]],
    features: [["waterfall", 2], ["rapids", 2], ["logjam", 3], ["arch", 2], ["island", 2], ["ramp", 2], ["narrows", 2], ["tunnel", 1]],
    music: { style: "M16", bpm: 104, root: 60 }, ambience: ["parrot", "frog", "monkey"],
    boss: { name: "Mango Mo", boat: "hover" },
  },
  {
    id: "canals", name: "Lantern Canals", tagline: "Pastel houses, arched bridges and lantern light",
    accent: "#FFB86B", accent2: "#8FD3FF",
    moods: [
      m({ name: "Dusk", top: "#2B3A78", horizon: "#FFB08A", low: "#C98A8A", sun: "#FFA070", sunEl: 6, sunAz: 10, sunSize: 1.5, clouds: 0.4,
        cloud: "#FFC8A8", cloudShade: "#6A5A8A", night: 0.35, water: { deep: "#1C4558", shallow: "#3E7C86", foam: "#FFF0E0", sky: "#FFB89A" }, light: 1.6, hemiSky: "#ffc0a0", hemiGround: "#4a3a3a" }),
      m({ name: "Lantern night", top: "#0C1230", horizon: "#3A2E5E", low: "#24203E", sun: "#E0E6FF", sunEl: 35, sunAz: -20, sunSize: 0.6, clouds: 0.2,
        cloud: "#3A3460", cloudShade: "#141030", stars: 0.7, night: 1, water: { deep: "#0A1A2E", shallow: "#1E3E58", foam: "#FFE2B8", sky: "#5A4A7A" },
        fog: "#2A2448", fogNear: 80, fogFar: 650, light: 0.8, hemiSky: "#7a6ab8", hemiGround: "#1a1420", hemi: 0.9, exposure: 1.1 }),
      m({ name: "Morning", top: "#4E8CE0", horizon: "#FFF0D8", low: "#E6D8C0", sun: "#FFF6E0", sunEl: 30, sunAz: 35, clouds: 0.3,
        water: { deep: "#1E5A6A", shallow: "#4E9AA0", foam: "#FFFFFF", sky: "#CFE6F4" }, hemiSky: "#fff0e0", hemiGround: "#7a6a5a" }),
    ],
    profile: "canal",
    land: { bed: "#5A5048", shore: "#C9B79A", low: "#D8C3A5", mid: "#BFA888", high: "#A89070", top: "#8A7A6A" },
    height: 3, rough: 0.1, width: [20, 30], waves: 0.2,
    props: [
      { k: "house", e: [1.5, 3], every: 9, scale: [0.85, 1.25] },
      { k: "house", e: [10, 16], every: 12, scale: [0.9, 1.4] },
      { k: "lamp", e: [0.8, 1.2], every: 18, scale: [1, 1] },
      { k: "moored", e: [-2.4, -1.2], every: 45, scale: [0.7, 1] },
      { k: "roundtree", e: [5, 9], every: 40, scale: [0.6, 1] },
      { k: "tower", e: [24, 50], every: 260, scale: [0.6, 0.9] },
    ],
    far: ["skyline"], weather: "none",
    hazards: [["buoy", 3], ["barrel", 2], ["crate", 2]],
    features: [["bridge", 5], ["narrows", 3], ["gates", 2], ["boost", 2], ["ramp", 2], ["tunnel", 2], ["slalom", 2]],
    music: { style: "M14", bpm: 120, root: 58 }, ambience: ["bell", "gull", "chime"],
    boss: { name: "Duchess Dot", boat: "offshore" },
  },
  {
    id: "blossom", name: "Blossom Lake", tagline: "Pink petals, red gates and still mountain water",
    accent: "#FF8FC3", accent2: "#FFE066",
    moods: [
      m({ name: "Spring day", top: "#6FA8FF", horizon: "#FFE6F0", low: "#F2D2E0", sun: "#FFF8F0", sunEl: 40, sunAz: 30, clouds: 0.35,
        cloud: "#FFFFFF", cloudShade: "#E0C8DA", water: { deep: "#2A6488", shallow: "#7CC6C0", foam: "#FFFFFF", sky: "#F0D8EA" }, fog: "#F6E2EC", hemiSky: "#fff0f6", hemiGround: "#6a7a4a" }),
      m({ name: "Pink sunset", top: "#5A3C8E", horizon: "#FF9EB0", low: "#D98AA0", sun: "#FF8A9A", sunEl: 6, sunAz: -5, sunSize: 1.6, clouds: 0.4,
        cloud: "#FFC2D0", cloudShade: "#7A5A9A", night: 0.2, water: { deep: "#2E4A7A", shallow: "#6E9AB0", foam: "#FFE6EE", sky: "#FFB0C4" }, light: 1.7, hemiSky: "#ffc0d0", hemiGround: "#4a3a4a" }),
      m({ name: "Lantern festival", top: "#0E1236", horizon: "#4A2A5E", low: "#2A1E40", sun: "#F0E8FF", sunEl: 35, sunAz: 0, sunSize: 0.6, clouds: 0.15,
        cloud: "#3A2E5A", cloudShade: "#140E2A", stars: 0.8, night: 1, water: { deep: "#0C1636", shallow: "#24385E", foam: "#FFD8E8", sky: "#6A4A8A" },
        fog: "#2E2450", fogNear: 90, fogFar: 700, light: 0.8, hemiSky: "#8a6ac8", hemiGround: "#1a1428", hemi: 0.9, exposure: 1.1 }),
    ],
    profile: "hills",
    land: { bed: "#5A6A5A", shore: "#B8B08A", low: "#8BCB6B", mid: "#6AAE5A", high: "#7A8A6A", top: "#F4F4FA" },
    height: 22, rough: 0.6, width: [28, 42], waves: 0.2,
    props: [
      { k: "blossomtree", e: [2, 26], every: 11, scale: [0.8, 1.4], cluster: 3 },
      { k: "gate", e: [-1, 2], every: 180, scale: [1, 1.2] },
      { k: "pagoda", e: [16, 40], every: 260, scale: [0.9, 1.3] },
      { k: "stonelantern", e: [0.5, 3], every: 40, scale: [0.9, 1.1] },
      { k: "bush", e: [2, 14], every: 20, scale: [0.6, 1.1] },
      { k: "lily", e: [-6, -1], every: 16, scale: [0.6, 1.2], cluster: 3 },
      { k: "pine", e: [20, 50], every: 24, scale: [0.9, 1.4], cluster: 3 },
    ],
    far: ["pagodahill", "snowpeaks"], weather: "petals",
    hazards: [["rock", 3], ["log", 2], ["buoy", 2]],
    features: [["bridge", 3], ["island", 3], ["arch", 2], ["ramp", 2], ["slalom", 2], ["boost", 2], ["gates", 1], ["jumps", 1]],
    music: { style: "M06", bpm: 118, root: 64 }, ambience: ["chime", "frog", "bell"],
    boss: { name: "Sakura Suki", boat: "cat" },
  },
  {
    id: "volcano", name: "Magma Isles", tagline: "Black rock, lava falls and a sky full of ash",
    accent: "#FF5A1F", accent2: "#FFC233",
    moods: [
      m({ name: "Eruption", top: "#1E0A10", horizon: "#FF6A2B", low: "#8A2A1A", sun: "#FF7A3A", sunEl: 10, sunAz: 0, sunSize: 1.8, clouds: 0.7,
        cloud: "#5A2A22", cloudShade: "#1A0A0A", night: 0.6, water: { deep: "#14222A", shallow: "#3A4448", foam: "#FFC8A0", sky: "#C8502A" },
        fog: "#4A2420", fogNear: 80, fogFar: 700, light: 1.4, hemiSky: "#ff8a5a", hemiGround: "#2a0a0a", exposure: 1.08 }),
      m({ name: "Smoky day", top: "#5A6A7A", horizon: "#C8A890", low: "#8A7466", sun: "#FFD8A8", sunEl: 30, sunAz: 30, clouds: 0.6,
        cloud: "#9A8A80", cloudShade: "#4A3A36", water: { deep: "#1E3038", shallow: "#4A5E60", foam: "#E8DCD0", sky: "#A89888" },
        fog: "#A08878", fogNear: 70, fogFar: 650, light: 1.6, hemiSky: "#d8c0a8", hemiGround: "#3a2a2a" }),
      m({ name: "Lava night", top: "#080306", horizon: "#5A1A12", low: "#2A0A08", sun: "#FFB08A", sunEl: 20, sunAz: -30, sunSize: 0.6, clouds: 0.5,
        cloud: "#3A1410", cloudShade: "#0A0404", stars: 0.4, night: 1, water: { deep: "#0A1014", shallow: "#2A1E1A", foam: "#FF9A6A", sky: "#8A2A1A" },
        fog: "#2A0E0A", fogNear: 70, fogFar: 620, light: 0.7, hemiSky: "#c84a2a", hemiGround: "#100404", hemi: 0.9, exposure: 1.12 }),
    ],
    profile: "lava",
    land: { bed: "#1A1616", shore: "#3A3030", low: "#2B2626", mid: "#3D3535", high: "#4A3E3A", top: "#5A4A44", glow: "#FF5A1F" },
    height: 26, rough: 0.9, width: [28, 42], waves: 0.4,
    props: [
      { k: "lavarock", e: [-1, 12], every: 16, scale: [0.8, 2], cluster: 2 },
      { k: "vent", e: [6, 30], every: 70, scale: [0.8, 1.4] },
      { k: "boulder", e: [0, 20], every: 18, scale: [0.8, 2.2], cluster: 2 },
      { k: "obelisk", e: [4, 14], every: 260, scale: [0.9, 1.3] },
      { k: "seastack", e: [8, 40], every: 160, scale: [0.8, 1.4] },
    ],
    far: ["volcano", "cliffs"], weather: "ash",
    hazards: [["lavarock", 4], ["rock", 2], ["mine", 2], ["barrel", 1]],
    features: [["waterfall", 2], ["ramp", 3], ["jumps", 2], ["minefield", 2], ["rocks", 3], ["narrows", 2], ["arch", 1], ["whirlpool", 1]],
    music: { style: "M04", bpm: 132, root: 55 }, ambience: ["lava", "thunder"],
    boss: { name: "Cinder King", boat: "tug" },
  },
  {
    id: "storm", name: "Thunder Coast", tagline: "Lightning, sea stacks and wild green waves",
    accent: "#8FB8FF", accent2: "#FFE24A",
    moods: [
      m({ name: "Thunderstorm", top: "#1E2430", horizon: "#6A7686", low: "#4A5462", sun: "#E8EEF8", sunEl: 35, sunAz: 20, sunSize: 0.6, clouds: 0.95,
        cloud: "#5A6472", cloudShade: "#1A1E26", night: 0.4, water: { deep: "#132A38", shallow: "#2E5464", foam: "#F0F6FA", sky: "#6A7888" },
        fog: "#5A6676", fogNear: 60, fogFar: 600, light: 1.2, hemiSky: "#a8b8c8", hemiGround: "#2a3028" }),
      m({ name: "Sunbeams", top: "#3A5A8A", horizon: "#D8D2B8", low: "#A8A898", sun: "#FFF0C8", sunEl: 22, sunAz: -20, sunSize: 1.2, clouds: 0.7,
        cloud: "#E8E4D8", cloudShade: "#5A6070", water: { deep: "#163A48", shallow: "#3E7280", foam: "#FFFFFF", sky: "#B8C0C0" },
        fog: "#C0C2B4", fogNear: 90, fogFar: 800, light: 1.9, hemiSky: "#e0e0d0", hemiGround: "#3a4030" }),
      m({ name: "Night storm", top: "#05080E", horizon: "#24303E", low: "#141C26", sun: "#C8D8F0", sunEl: 30, sunAz: 0, sunSize: 0.5, clouds: 0.95,
        cloud: "#28323E", cloudShade: "#080A0E", night: 1, water: { deep: "#06121A", shallow: "#18323E", foam: "#D8E8F0", sky: "#3A4A5A" },
        fog: "#1A2430", fogNear: 50, fogFar: 520, light: 0.6, hemiSky: "#5a6a8a", hemiGround: "#0a0e10", hemi: 0.85, exposure: 1.15 }),
    ],
    profile: "coast",
    land: { bed: "#2A3238", shore: "#5A5E5A", low: "#5E7A4E", mid: "#4D5257", high: "#6A6E70", top: "#7A8A6A" },
    height: 30, rough: 0.85, width: [32, 50], waves: 1,
    props: [
      { k: "seastack", e: [10, 60], every: 70, scale: [0.8, 1.6] },
      { k: "lighthouse", e: [3, 10], every: 450, scale: [1, 1.2] },
      { k: "turbine", e: [10, 40], every: 90, scale: [0.9, 1.2], side: -1 },
      { k: "wreck", e: [6, 30], every: 380, scale: [0.9, 1.2] },
      { k: "boulder", e: [-3, 6], every: 20, scale: [0.8, 2], cluster: 2 },
      { k: "bush", e: [4, 24], every: 22, scale: [0.6, 1] },
    ],
    far: ["cliffs", "isles"], weather: "rain",
    hazards: [["debris", 3], ["rock", 3], ["mine", 2], ["barrel", 1]],
    features: [["rapids", 3], ["ramp", 3], ["jumps", 2], ["rocks", 2], ["minefield", 2], ["whirlpool", 2], ["bay", 2], ["ferry", 1]],
    music: { style: "M19", bpm: 140, root: 57 }, ambience: ["thunder", "wind", "gull", "horn"],
    boss: { name: "Gale Gunnar", boat: "offshore" },
  },
  {
    id: "caverns", name: "Crystal Caverns", tagline: "An underground river of glowing crystals",
    accent: "#B07CFF", accent2: "#36E3FF",
    moods: [
      m({ name: "Amethyst", top: "#04040C", horizon: "#1E1240", low: "#100A24", sun: "#C8B8FF", sunEl: 60, sunAz: 0, sunSize: 0.4, clouds: 0,
        night: 1, water: { deep: "#08122E", shallow: "#18B8D0", foam: "#B8FFF6", sky: "#4A2A8A" },
        fog: "#140C2C", fogNear: 50, fogFar: 520, light: 0.6, hemiSky: "#7a5ad8", hemiGround: "#100a20", hemi: 1, exposure: 1.15 }),
      m({ name: "Glow green", top: "#020A08", horizon: "#0E3A30", low: "#082018", sun: "#B8FFE0", sunEl: 60, sunAz: 0, sunSize: 0.4, clouds: 0,
        night: 1, water: { deep: "#04201A", shallow: "#22D6A0", foam: "#C8FFE8", sky: "#1A6A50" },
        fog: "#0A2A22", fogNear: 50, fogFar: 520, light: 0.6, hemiSky: "#4ac89a", hemiGround: "#06140e", hemi: 1, exposure: 1.15 }),
      m({ name: "Ember", top: "#0A0404", horizon: "#3A1A10", low: "#200C08", sun: "#FFC8A0", sunEl: 60, sunAz: 0, sunSize: 0.4, clouds: 0,
        night: 1, water: { deep: "#140A08", shallow: "#B86A2A", foam: "#FFD8A8", sky: "#6A2A14" },
        fog: "#2A120A", fogNear: 50, fogFar: 520, light: 0.6, hemiSky: "#c8784a", hemiGround: "#140806", hemi: 1, exposure: 1.15 }),
    ],
    profile: "cave",
    land: { bed: "#1A1428", shore: "#2A2440", low: "#2A2540", mid: "#342C50", high: "#3E3460", top: "#4A3E70", glow: "#8C5BFF" },
    height: 30, rough: 0.9, width: [24, 36], waves: 0.25,
    props: [
      { k: "crystal", e: [-1, 16], every: 12, scale: [0.6, 2], cluster: 3 },
      { k: "mushroom", e: [0.5, 10], every: 14, scale: [0.6, 1.5], cluster: 3 },
      { k: "stalagmite", e: [0, 26], every: 10, scale: [0.7, 1.8], cluster: 2 },
      { k: "lamp", e: [1, 2], every: 60, scale: [1, 1] },
    ],
    far: ["cavewall"], weather: "spores",
    hazards: [["crystal", 4], ["rock", 3], ["mine", 1]],
    features: [["tunnel", 3], ["narrows", 3], ["waterfall", 2], ["rapids", 2], ["ramp", 2], ["whirlpool", 2], ["rocks", 2], ["pillars", 2]],
    music: { style: "M02", bpm: 124, root: 62 }, ambience: ["drip", "chime", "wind"],
    boss: { name: "Gemma Glint", boat: "comet" },
  },
  {
    id: "dunes", name: "Golden Dunes", tagline: "A desert oasis of sandstone and palms",
    accent: "#FFC233", accent2: "#3EC6C1",
    moods: [
      m({ name: "Blazing noon", top: "#2E6EC8", horizon: "#FFE6B0", low: "#F2CC90", sun: "#FFF8E0", sunEl: 70, sunAz: 20, clouds: 0.08,
        water: { deep: "#0E6C84", shallow: "#36C4BE", foam: "#FFFFFF", sky: "#A8D4F0" }, fog: "#F6DFAE", fogNear: 180, fogFar: 1100, light: 2.4, hemiSky: "#fff0d0", hemiGround: "#b08050", exposure: 0.96 }),
      m({ name: "Desert sunset", top: "#3A2A78", horizon: "#FF9A4A", low: "#D8784A", sun: "#FF7A2A", sunEl: 5, sunAz: 5, sunSize: 1.8, clouds: 0.25,
        cloud: "#FFB070", cloudShade: "#7A3A5A", water: { deep: "#1A4A6A", shallow: "#4A9A9A", foam: "#FFE0C0", sky: "#FFA060" }, light: 1.8, hemiSky: "#ffb070", hemiGround: "#5a3020", exposure: 1.05 }),
      m({ name: "Moonlit sand", top: "#0A1030", horizon: "#3A3A6A", low: "#2A2848", sun: "#E8EEFF", sunEl: 40, sunAz: -25, sunSize: 0.8, clouds: 0.05,
        stars: 1, night: 1, water: { deep: "#0A1A36", shallow: "#1E4A6A", foam: "#D8E4FF", sky: "#3A4A8A" },
        fog: "#26284E", fogNear: 120, fogFar: 800, light: 0.9, hemiSky: "#7a84c8", hemiGround: "#2a2030", hemi: 0.85 }),
    ],
    profile: "dunes",
    land: { bed: "#C8A060", shore: "#F2D49A", low: "#F0C27B", mid: "#E0A458", high: "#C97B4A", top: "#F4D9A0" },
    height: 18, rough: 0.5, width: [30, 46], waves: 0.3,
    props: [
      { k: "palm", e: [1, 10], every: 16, scale: [0.9, 1.4], cluster: 3 },
      { k: "tent", e: [4, 12], every: 160, scale: [0.9, 1.2], cluster: 2 },
      { k: "obelisk", e: [6, 20], every: 220, scale: [0.9, 1.4] },
      { k: "arch", e: [14, 40], every: 360, scale: [0.8, 1.2] },
      { k: "cactus", e: [8, 30], every: 40, scale: [0.8, 1.2] },
      { k: "reeds", e: [-1.5, 1], every: 14, scale: [0.8, 1.2], cluster: 3 },
      { k: "mesa", e: [70, 120], every: 220, scale: [0.7, 1.1] },
    ],
    far: ["dunes", "mesas"], weather: "dust",
    hazards: [["rock", 3], ["barrel", 2], ["log", 1], ["buoy", 2]],
    features: [["ramp", 3], ["jumps", 3], ["island", 2], ["boost", 2], ["bay", 2], ["arch", 2], ["whirlpool", 1], ["slalom", 2]],
    music: { style: "M08", bpm: 112, root: 57 }, ambience: ["wind", "hawk", "chime"],
    boss: { name: "Sultan Sol", boat: "bolt" },
  },
  {
    id: "cyber", name: "Hyper Bay", tagline: "Glass towers, holograms and a neon racing grid",
    accent: "#36E3FF", accent2: "#FF3DCB",
    moods: [
      m({ name: "Neon night", top: "#05021A", horizon: "#3A0A6A", low: "#1A0634", sun: "#E0C8FF", sunEl: 25, sunAz: 0, sunSize: 0.7, clouds: 0.2,
        cloud: "#2A0E4A", cloudShade: "#0A0418", stars: 0.6, night: 1, water: { deep: "#030820", shallow: "#0A2A6A", foam: "#9AF6FF", sky: "#7A2AC8" },
        fog: "#1E0A3E", fogNear: 110, fogFar: 850, light: 0.8, hemiSky: "#8a4ae8", hemiGround: "#0a0418", hemi: 0.95, exposure: 1.12 }),
      m({ name: "Synth sunset", top: "#1A0A4A", horizon: "#FF5A9A", low: "#8A2A7A", sun: "#FFB84A", sunEl: 6, sunAz: 0, sunSize: 2.2, clouds: 0.15,
        cloud: "#FF7AB0", cloudShade: "#3A0A5A", night: 0.6, water: { deep: "#0A0A3A", shallow: "#3A2A8A", foam: "#FFC8F0", sky: "#FF6AA8" },
        fog: "#4A1A5E", fogNear: 120, fogFar: 900, light: 1.2, hemiSky: "#ff7ac8", hemiGround: "#1a0a2a", exposure: 1.08 }),
      m({ name: "Teal dawn", top: "#0A2A4A", horizon: "#4AF0D8", low: "#1A6A7A", sun: "#C8FFF4", sunEl: 8, sunAz: 15, sunSize: 1.4, clouds: 0.2,
        cloud: "#7AE8E0", cloudShade: "#0A3A4A", night: 0.4, water: { deep: "#041A2E", shallow: "#0A5A6A", foam: "#C8FFF8", sky: "#4AD8D0" },
        fog: "#1A4A5A", fogNear: 120, fogFar: 900, light: 1.3, hemiSky: "#7ae8e0", hemiGround: "#0a1a2a" }),
    ],
    profile: "neon",
    land: { bed: "#0A0A1A", shore: "#1A1C34", low: "#12142A", mid: "#1A1C3A", high: "#22244A", top: "#2A2C5A", glow: "#36E3FF" },
    height: 3, rough: 0.1, width: [36, 52], waves: 0.25,
    props: [
      { k: "neontower", e: [12, 60], every: 26, scale: [0.9, 1.8], cluster: 2 },
      { k: "holo", e: [3, 14], every: 70, scale: [0.9, 1.3] },
      { k: "billboard", e: [6, 18], every: 80, scale: [1, 1.4] },
      { k: "lamp", e: [1, 1.6], every: 16, scale: [1, 1] },
      { k: "bridgeLights", e: [-0.5, 0], every: 30, scale: [1, 1] },
      { k: "tower", e: [40, 90], every: 40, scale: [1, 2] },
    ],
    far: ["neonskyline"], weather: "sparks",
    hazards: [["drone", 3], ["buoy", 2], ["mine", 2], ["crate", 1]],
    features: [["boost", 4], ["gates", 3], ["ramp", 3], ["jumps", 2], ["pillars", 2], ["tunnel", 2], ["slalom", 2], ["bridge", 1]],
    music: { style: "M20", bpm: 124, root: 58 }, ambience: ["synth", "horn", "chime", "crowd"],
    boss: { name: "Vex Volt", boat: "comet" },
  },
];

export const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w])) as Record<WorldId, World>;
export const worldOf = (id: WorldId) => WORLD_BY_ID[id];
export const STAGES_PER_WORLD = 50;
export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD; // 600
