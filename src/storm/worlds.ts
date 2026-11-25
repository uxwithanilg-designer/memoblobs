// Blockstorm's 20 worlds, 50 stages each (1,000 designed stages; after that the remixes never end). A world is a
// palette for the block textures, a sky and light for each time of day, a far skyline (the backdrop ring of blocky
// mountains, towers, mushrooms, ships…), weather, the props and buildings its islands are made of, its ambience and its
// band. The monsters wear the world's tint.

export type WorldId =
  | "meadow" | "dunes" | "neon" | "frost" | "shroom" | "forge" | "candy" | "reef" | "haunt" | "sky"
  | "crystal" | "jungle" | "autumn" | "grid" | "cove" | "clock" | "blossom" | "moon" | "toxic" | "glitch";
export type TimeOfDay = "day" | "golden" | "dusk" | "night";
export type TopKind = "grass" | "sand" | "snow" | "metal" | "candy" | "neon" | "rock" | "cloud";
export type Liquid = "water" | "lava" | "goo" | "void";
export type Weather = "none" | "leaves" | "snow" | "rain" | "ash" | "bubbles" | "petals" | "fireflies" | "sparks" | "dust" | "glitch";
export type Skyline =
  | "hills" | "mesas" | "towers" | "peaks" | "shrooms" | "volcano" | "candy" | "coral" | "spires" | "islands"
  | "crystals" | "temples" | "forest" | "circuits" | "sea" | "factory" | "pagodas" | "craters" | "wastes" | "glitch";
export type Ambient = "birds" | "wind" | "city" | "owl" | "crickets" | "lava" | "bubbles" | "gulls" | "gears" | "chimes" | "frogs" | "goo" | "beeps" | "glitch" | "drums" | "crows";
export type Prop =
  | "oak" | "pine" | "palm" | "cactus" | "shroom" | "spire" | "deadTree" | "cherry" | "autumn" | "coral" | "lolly"
  | "boulder" | "lampPost" | "pumpkin" | "grave" | "pipes" | "neonSign" | "iceSpike" | "pillar" | "jungleTree" | "crate";
export type Building =
  | "house" | "tower" | "skyscraper" | "pyramid" | "temple" | "ship" | "pagoda" | "factory" | "fort" | "igloo" | "dome"
  | "ruin" | "hut" | "candyHouse" | "crypt" | "lab";

export interface Palette {
  top: string; soil: string; stone: string; stone2: string; bark: string; ring: string; plank: string; leaves: string;
  leaves2: string; brick: string; mortar: string; window: string; metal: string; accent: string; accent2: string;
  roof: string; path: string; gloom: string; core: string; crystal: string; lamp: string; ice: string; rock: string;
}
export interface SkyLook { top: string; mid: string; bot: string; fog: string; sun: string; light: string; ground: string; exposure: number }
export interface World {
  id: WorldId; name: string; tagline: string; accent: string; seed: number;
  pal: Palette; topKind: TopKind; liquid: Liquid; liquidColor: string;
  sky: SkyLook; times: TimeOfDay[];
  skyline: Skyline; skyCol: [string, string];
  weather: Weather[]; props: Prop[]; buildings: Building[];
  ambient: Ambient[]; music: { style: string; bpm: number; root: number };
  gravity: number; tint: string;
}

const base: Palette = {
  top: "#5FBF4A", soil: "#8A5A35", stone: "#8C8F98", stone2: "#9A9AA4", bark: "#6B4A2E", ring: "#C9A26B", plank: "#B98A55",
  leaves: "#3E9E3A", leaves2: "#7CCB55", brick: "#B5523B", mortar: "#D8CBB8", window: "#8FD3FF", metal: "#9AA3B5",
  accent: "#FF5C7A", accent2: "#FFD23F", roof: "#C2453A", path: "#B9A98E", gloom: "#3A1F4D", core: "#E040FB",
  crystal: "#7CF5FF", lamp: "#FFE08A", ice: "#BFE9FF", rock: "#7D7A80",
};
const W = (w: Omit<World, "pal" | "gravity" | "seed"> & { pal?: Partial<Palette>; gravity?: number }, i: number): World =>
  ({ ...w, pal: { ...base, ...w.pal }, gravity: w.gravity ?? 26, seed: 9001 + i * 7919 });

export const WORLDS: World[] = [
  {
    id: "meadow", name: "Grassy Isle", tagline: "Sunny hills, oak woods and the first monster towers", accent: "#7CE05A",
    topKind: "grass", liquid: "water", liquidColor: "#3FA7E8",
    sky: { top: "#3F8EF0", mid: "#8CC8FF", bot: "#DDF2FF", fog: "#BFE3FF", sun: "#FFF4D6", light: "#FFF1D9", ground: "#5E7A4A", exposure: 1.05 },
    times: ["day", "day", "golden"], skyline: "hills", skyCol: ["#6FAE6A", "#9CCB8A"],
    weather: ["none", "leaves"], props: ["oak", "oak", "boulder", "crate", "lampPost"], buildings: ["house", "tower", "fort", "hut"],
    ambient: ["birds", "wind"], music: { style: "M01", bpm: 116, root: 60 }, tint: "#7B4FA8",
  },
  {
    id: "dunes", name: "Sunbaked Dunes", tagline: "Sandstone ruins, cacti and buried treasure", accent: "#FFB347",
    pal: { top: "#E9CC86", soil: "#D8B26C", stone: "#C9A46A", stone2: "#D9B77A", brick: "#C98E52", mortar: "#EBD3A0", plank: "#A97845", roof: "#B5713E", path: "#D2B07A", leaves: "#5E9E3A", rock: "#B98A55" },
    topKind: "sand", liquid: "water", liquidColor: "#4CC3D9",
    sky: { top: "#2F86E0", mid: "#8FC6F0", bot: "#FFE7B8", fog: "#F5D9A6", sun: "#FFF0C8", light: "#FFE9C2", ground: "#B08A55", exposure: 1.08 },
    times: ["day", "golden", "golden"], skyline: "mesas", skyCol: ["#D9965A", "#EDBB82"],
    weather: ["none", "dust"], props: ["cactus", "cactus", "boulder", "palm", "crate"], buildings: ["pyramid", "ruin", "temple", "hut"],
    ambient: ["wind", "drums"], music: { style: "M08", bpm: 104, root: 59 }, tint: "#A0522D",
  },
  {
    id: "neon", name: "Neon City", tagline: "Rooftop fights between glowing towers", accent: "#FF4FD8",
    pal: { top: "#3A3F55", soil: "#2B2E3E", stone: "#4B5068", stone2: "#5A6078", brick: "#5B4E7A", mortar: "#2A2440", metal: "#6E7894", window: "#5CF0FF", accent: "#FF4FD8", accent2: "#5CF0FF", roof: "#2E3348", path: "#55607A", lamp: "#FF8FE6" },
    topKind: "neon", liquid: "void", liquidColor: "#120E26",
    sky: { top: "#0B0A24", mid: "#2B1856", bot: "#7B2F8E", fog: "#2A1A4A", sun: "#FF9BE8", light: "#C9B6FF", ground: "#2A1E3E", exposure: 1.15 },
    times: ["night", "night", "dusk"], skyline: "towers", skyCol: ["#1C1838", "#2E2558"],
    weather: ["none", "rain"], props: ["lampPost", "neonSign", "pipes", "crate"], buildings: ["skyscraper", "skyscraper", "lab", "factory"],
    ambient: ["city", "beeps"], music: { style: "M10", bpm: 110, root: 57 }, tint: "#2EC4B6",
  },
  {
    id: "frost", name: "Frostbite Peaks", tagline: "Snowy forts, ice spikes and blizzards", accent: "#9FE7FF",
    pal: { top: "#F4F9FF", soil: "#8A97A8", stone: "#A9B6C6", stone2: "#C3CFDD", leaves: "#2E6B4F", leaves2: "#3F7D5E", brick: "#7E8FA6", mortar: "#E6EEF7", roof: "#3E6FA8", plank: "#8C6A4E", path: "#D7E3EF", ice: "#BCEBFF" },
    topKind: "snow", liquid: "water", liquidColor: "#7FC8E8",
    sky: { top: "#5B8FD6", mid: "#A9CBF0", bot: "#EAF4FF", fog: "#DCEBFA", sun: "#FFFFFF", light: "#EAF3FF", ground: "#8AA0B8", exposure: 1.0 },
    times: ["day", "golden", "night"], skyline: "peaks", skyCol: ["#B8CCE4", "#E4EEF9"],
    weather: ["snow", "snow", "none"], props: ["pine", "pine", "iceSpike", "boulder"], buildings: ["igloo", "fort", "tower", "hut"],
    ambient: ["wind", "owl"], music: { style: "M18", bpm: 96, root: 64 }, tint: "#3D6CB9",
  },
  {
    id: "shroom", name: "Mushroom Marsh", tagline: "Giant caps, fireflies and boggy pools", accent: "#FF7AB6",
    pal: { top: "#6FA845", soil: "#5E4A3A", leaves: "#C8374F", leaves2: "#F2E6D0", bark: "#E8DCC4", ring: "#F7EFDF", accent: "#FF7AB6", accent2: "#8FE0FF", roof: "#B8344A" },
    topKind: "grass", liquid: "goo", liquidColor: "#4E8C5A",
    sky: { top: "#2E3E78", mid: "#6C6AB8", bot: "#E3A6C8", fog: "#B49BC9", sun: "#FFE2F0", light: "#F5DDF0", ground: "#4F5E3E", exposure: 1.05 },
    times: ["dusk", "night", "golden"], skyline: "shrooms", skyCol: ["#6B4E8E", "#9B7BB8"],
    weather: ["fireflies", "none"], props: ["shroom", "shroom", "boulder", "deadTree"], buildings: ["hut", "house", "ruin"],
    ambient: ["frogs", "crickets"], music: { style: "M03", bpm: 88, root: 62 }, tint: "#5E8C31",
  },
  {
    id: "forge", name: "Lava Forge", tagline: "Basalt fortresses over rivers of lava", accent: "#FF6A2B",
    pal: { top: "#3B3236", soil: "#2B2326", stone: "#4A4046", stone2: "#5B4E52", brick: "#5E3A32", mortar: "#FF7A3A", metal: "#6B6470", rock: "#3E3438", lamp: "#FF9A3A", accent: "#FF6A2B", accent2: "#FFD23F", roof: "#3E2C2C" },
    topKind: "rock", liquid: "lava", liquidColor: "#FF5A1F",
    sky: { top: "#1A0C0C", mid: "#5A1E14", bot: "#E0582A", fog: "#7A2E1C", sun: "#FFB070", light: "#FFC69A", ground: "#3A1E16", exposure: 1.12 },
    times: ["dusk", "night"], skyline: "volcano", skyCol: ["#2A1414", "#4A221A"],
    weather: ["ash", "sparks"], props: ["boulder", "pillar", "pipes", "lampPost"], buildings: ["fort", "factory", "tower", "crypt"],
    ambient: ["lava", "drums"], music: { style: "M11", bpm: 168, root: 52 }, tint: "#B22222",
  },
  {
    id: "candy", name: "Candy Cliffs", tagline: "Lollipops, frosting and sprinkle towers", accent: "#FF8AD8",
    pal: { top: "#FFC9E6", soil: "#B86E4E", stone: "#F7E1F0", stone2: "#FFD6EA", brick: "#FF8FB8", mortar: "#FFFFFF", plank: "#E8A46E", bark: "#FFFFFF", ring: "#FF5C8A", leaves: "#FF7AB6", leaves2: "#9BE7FF", accent: "#7FE3FF", accent2: "#FFE45C", roof: "#FF5C8A", path: "#FFF0F7", rock: "#E2A3C5" },
    topKind: "candy", liquid: "water", liquidColor: "#FF9ECF",
    sky: { top: "#7FC8FF", mid: "#C9E6FF", bot: "#FFE1F2", fog: "#FFDDF0", sun: "#FFFFFF", light: "#FFF2FA", ground: "#D98AB8", exposure: 1.05 },
    times: ["day", "golden"], skyline: "candy", skyCol: ["#FFB1D8", "#FFD9EC"],
    weather: ["none", "petals"], props: ["lolly", "lolly", "boulder", "crate"], buildings: ["candyHouse", "tower", "fort"],
    ambient: ["chimes", "birds"], music: { style: "M05", bpm: 128, root: 65 }, tint: "#6A4C93",
  },
  {
    id: "reef", name: "Coral Reef", tagline: "Sunken ruins under a shimmering sea", accent: "#3FE0D0",
    pal: { top: "#E7D7A8", soil: "#C9B486", stone: "#6FA3A8", stone2: "#7FB8B0", leaves: "#FF6F91", leaves2: "#FFB347", accent: "#FF6F91", accent2: "#7CF5FF", brick: "#5E8C9A", mortar: "#A8D8D8", roof: "#2E7E8E", rock: "#5E8A8E" },
    topKind: "sand", liquid: "water", liquidColor: "#1E8FBF",
    sky: { top: "#0B3C6E", mid: "#1F79A8", bot: "#5ED0D8", fog: "#2A86A8", sun: "#CFFFF6", light: "#BFF7FF", ground: "#2E5E6E", exposure: 1.0 },
    times: ["day", "dusk"], skyline: "coral", skyCol: ["#1E6A8E", "#2E8EA8"],
    weather: ["bubbles"], props: ["coral", "coral", "boulder", "pillar"], buildings: ["ruin", "temple", "ship"],
    ambient: ["bubbles", "chimes"], music: { style: "M15", bpm: 94, root: 62 }, tint: "#1B998B", gravity: 20,
  },
  {
    id: "haunt", name: "Haunted Hollow", tagline: "Pumpkins, crypts and a full moon", accent: "#FF9A3A",
    pal: { top: "#3E4A3A", soil: "#3A2E2A", stone: "#5A5868", stone2: "#6A6878", bark: "#3A2E2E", leaves: "#4A2E5A", leaves2: "#2E2238", brick: "#4E4458", mortar: "#2A2433", accent: "#FF8A2A", accent2: "#B6FF5C", roof: "#2E2A3A", lamp: "#FF9A3A", window: "#FFB347" },
    topKind: "grass", liquid: "goo", liquidColor: "#3A5E3A",
    sky: { top: "#090A1E", mid: "#1E1E48", bot: "#4E3E6E", fog: "#2A2A48", sun: "#E8E8FF", light: "#B8C0FF", ground: "#1E1E2A", exposure: 1.2 },
    times: ["night", "night", "dusk"], skyline: "forest", skyCol: ["#141428", "#22223E"],
    weather: ["fireflies", "none"], props: ["deadTree", "deadTree", "pumpkin", "grave", "lampPost"], buildings: ["crypt", "house", "tower"],
    ambient: ["owl", "crows"], music: { style: "M14", bpm: 116, root: 57 }, tint: "#5A6E3A",
  },
  {
    id: "sky", name: "Sky Ruins", tagline: "Marble temples floating above the clouds", accent: "#FFE27A",
    pal: { top: "#9FE08A", soil: "#C9BFA8", stone: "#E8E4DA", stone2: "#F2EEE6", brick: "#D8D0C0", mortar: "#BFB6A4", roof: "#4E8CD8", accent: "#FFD23F", accent2: "#7FC4FF", path: "#F0E8D8", rock: "#CFC8BA" },
    topKind: "grass", liquid: "void", liquidColor: "#FFFFFF",
    sky: { top: "#3E7EE8", mid: "#9CC8FF", bot: "#FFFFFF", fog: "#E8F2FF", sun: "#FFF8E0", light: "#FFF8EC", ground: "#AFC8E8", exposure: 1.05 },
    times: ["day", "golden"], skyline: "islands", skyCol: ["#C8DCF5", "#E8F0FF"],
    weather: ["none"], props: ["pillar", "oak", "boulder"], buildings: ["temple", "ruin", "tower"],
    ambient: ["wind", "chimes"], music: { style: "M13", bpm: 100, root: 62 }, tint: "#6A5ACD",
  },
  {
    id: "crystal", name: "Crystal Caverns", tagline: "Glowing gems in a purple gloom", accent: "#B98AFF",
    pal: { top: "#4A3E6E", soil: "#2E2648", stone: "#4E4470", stone2: "#5E5482", rock: "#3E3460", crystal: "#B98AFF", lamp: "#7CF5FF", accent: "#7CF5FF", accent2: "#FF7AE6", brick: "#3E3460", mortar: "#6E5EA0" },
    topKind: "rock", liquid: "water", liquidColor: "#4E5ED8",
    sky: { top: "#0A0618", mid: "#241848", bot: "#4E2E7E", fog: "#241A42", sun: "#C9A8FF", light: "#B8A0FF", ground: "#1A1230", exposure: 1.2 },
    times: ["night"], skyline: "crystals", skyCol: ["#1E1638", "#2E2252"],
    weather: ["fireflies", "sparks"], props: ["spire", "spire", "boulder", "lampPost"], buildings: ["ruin", "temple", "crypt"],
    ambient: ["chimes", "bubbles"], music: { style: "M09", bpm: 140, root: 57 }, tint: "#C04E8E",
  },
  {
    id: "jungle", name: "Jungle Temple", tagline: "Vines, mossy pyramids and hidden idols", accent: "#3EE08F",
    pal: { top: "#3FA845", soil: "#5A3E2A", stone: "#6E8A62", stone2: "#7E9A6E", leaves: "#2E8E3A", leaves2: "#5EC84A", brick: "#7E8A5E", mortar: "#4E5E3A", accent: "#FFB627", accent2: "#3EE08F", roof: "#6E5A3A" },
    topKind: "grass", liquid: "water", liquidColor: "#2E9E8E",
    sky: { top: "#2E7EC8", mid: "#7EC0D8", bot: "#E0F0C8", fog: "#B8DCB0", sun: "#FFF6D0", light: "#F0F8D8", ground: "#3E5E2E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], skyline: "temples", skyCol: ["#4E8E4E", "#7EB070"],
    weather: ["leaves", "rain", "none"], props: ["jungleTree", "jungleTree", "boulder", "pillar"], buildings: ["pyramid", "temple", "ruin", "hut"],
    ambient: ["birds", "frogs"], music: { style: "M16", bpm: 106, root: 62 }, tint: "#8E5A2E",
  },
  {
    id: "autumn", name: "Amber Woods", tagline: "Falling leaves and harvest barns", accent: "#FF8A3D",
    pal: { top: "#C8A045", soil: "#7A4E30", leaves: "#E8702A", leaves2: "#FFB627", accent: "#C8452A", accent2: "#FFD23F", roof: "#9E3A2A", plank: "#B07840" },
    topKind: "grass", liquid: "water", liquidColor: "#4E8EB8",
    sky: { top: "#4E7EC8", mid: "#B8C8E0", bot: "#FFD8A8", fog: "#F0D0A8", sun: "#FFE0B0", light: "#FFE6C4", ground: "#7A5A3A", exposure: 1.05 },
    times: ["golden", "day", "dusk"], skyline: "forest", skyCol: ["#B8703A", "#D8A060"],
    weather: ["leaves", "leaves", "none"], props: ["autumn", "autumn", "pumpkin", "boulder", "crate"], buildings: ["house", "hut", "tower", "fort"],
    ambient: ["birds", "crows"], music: { style: "M03", bpm: 84, root: 60 }, tint: "#5E3A8E",
  },
  {
    id: "grid", name: "Cyber Grid", tagline: "A glowing circuit world of light", accent: "#3DF5FF",
    pal: { top: "#141C2E", soil: "#0E1422", stone: "#1E2A44", stone2: "#24324E", metal: "#2E3E5E", brick: "#1E2A44", mortar: "#3DF5FF", window: "#3DF5FF", accent: "#3DF5FF", accent2: "#FF3DF0", lamp: "#3DF5FF", roof: "#18223A", path: "#24324E", crystal: "#3DF5FF" },
    topKind: "neon", liquid: "void", liquidColor: "#050812",
    sky: { top: "#02030A", mid: "#0A1430", bot: "#1E3E7E", fog: "#0A1430", sun: "#7FF5FF", light: "#A8D8FF", ground: "#0A0E1A", exposure: 1.2 },
    times: ["night"], skyline: "circuits", skyCol: ["#0A1228", "#12224A"],
    weather: ["sparks", "none"], props: ["neonSign", "lampPost", "pipes"], buildings: ["lab", "skyscraper", "dome"],
    ambient: ["beeps", "glitch"], music: { style: "M02", bpm: 128, root: 57 }, tint: "#FF3D8E",
  },
  {
    id: "cove", name: "Pirate Cove", tagline: "Palm beaches, docks and a wrecked galleon", accent: "#FFD23F",
    pal: { top: "#F2DC9E", soil: "#D8BC80", plank: "#9E6E40", bark: "#7A5A3A", leaves: "#3EA84A", leaves2: "#7ED85A", brick: "#B07A50", accent: "#E8402E", accent2: "#FFFFFF", roof: "#8E4E2E", rock: "#9A8E80" },
    topKind: "sand", liquid: "water", liquidColor: "#1EB0D8",
    sky: { top: "#1E8EF0", mid: "#7FD0FF", bot: "#E8FAFF", fog: "#C0EAFF", sun: "#FFFBE8", light: "#FFF6E0", ground: "#8EB0B8", exposure: 1.08 },
    times: ["day", "golden", "dusk"], skyline: "sea", skyCol: ["#5EA8C8", "#8EC8E0"],
    weather: ["none"], props: ["palm", "palm", "crate", "boulder"], buildings: ["ship", "hut", "fort", "tower"],
    ambient: ["gulls", "wind"], music: { style: "M15", bpm: 98, root: 65 }, tint: "#4E6E3A",
  },
  {
    id: "clock", name: "Clockwork Factory", tagline: "Pipes, gears and steam", accent: "#E8B04A",
    pal: { top: "#6E6458", soil: "#4E463E", stone: "#7E7468", stone2: "#8E8478", metal: "#B08A4E", brick: "#8E4E3A", mortar: "#3E3630", accent: "#E8B04A", accent2: "#5E8EA8", roof: "#4E4E58", path: "#8E8478", lamp: "#FFC86A", window: "#FFD27A" },
    topKind: "metal", liquid: "goo", liquidColor: "#4A4A3A",
    sky: { top: "#4E4A5E", mid: "#8E8098", bot: "#D8B890", fog: "#A89480", sun: "#FFE0B0", light: "#FFE6C8", ground: "#5A4E40", exposure: 1.05 },
    times: ["golden", "dusk"], skyline: "factory", skyCol: ["#5E5048", "#7E6E60"],
    weather: ["sparks", "none"], props: ["pipes", "pipes", "crate", "lampPost"], buildings: ["factory", "tower", "lab"],
    ambient: ["gears", "beeps"], music: { style: "M17", bpm: 112, root: 55 }, tint: "#5E6E8E",
  },
  {
    id: "blossom", name: "Blossom Garden", tagline: "Pagodas under falling petals", accent: "#FF9AC3",
    pal: { top: "#7ED86A", soil: "#6E4E3A", leaves: "#FFB1D0", leaves2: "#FF8AB8", bark: "#4E3A3A", roof: "#B8343A", brick: "#E8E0D0", mortar: "#8E7E6E", accent: "#E8343A", accent2: "#FFE27A", path: "#D8D0C0", plank: "#C8463A" },
    topKind: "grass", liquid: "water", liquidColor: "#5EC0D8",
    sky: { top: "#6EA8F0", mid: "#C8DCFF", bot: "#FFE6F0", fog: "#F5DDEA", sun: "#FFF6FA", light: "#FFF2F6", ground: "#8EA87E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], skyline: "pagodas", skyCol: ["#C89AB8", "#E8C8D8"],
    weather: ["petals", "petals", "none"], props: ["cherry", "cherry", "lampPost", "boulder"], buildings: ["pagoda", "house", "tower"],
    ambient: ["birds", "chimes"], music: { style: "M06", bpm: 118, root: 64 }, tint: "#3A4E8E",
  },
  {
    id: "moon", name: "Moon Base", tagline: "Low-gravity fights around the domes", accent: "#B8C8FF",
    pal: { top: "#B8B8C0", soil: "#8E8E98", stone: "#9E9EA8", stone2: "#AEAEB8", rock: "#8A8A94", metal: "#D8DCE8", window: "#7FD0FF", accent: "#FF8A3D", accent2: "#7FD0FF", roof: "#E8ECF5", path: "#C8C8D0", lamp: "#BFF0FF" },
    topKind: "rock", liquid: "void", liquidColor: "#000000",
    sky: { top: "#000006", mid: "#050818", bot: "#1A2040", fog: "#0E1226", sun: "#FFFFFF", light: "#F0F4FF", ground: "#2E3040", exposure: 1.1 },
    times: ["night"], skyline: "craters", skyCol: ["#4E4E5E", "#6E6E7E"],
    weather: ["none", "dust"], props: ["boulder", "boulder", "lampPost", "crate"], buildings: ["dome", "lab", "tower"],
    ambient: ["beeps", "wind"], music: { style: "M20", bpm: 122, root: 55 }, tint: "#4EA84E", gravity: 12,
  },
  {
    id: "toxic", name: "Toxic Wastes", tagline: "Rusty ruins round bubbling green goo", accent: "#9CFF3D",
    pal: { top: "#6E7A4E", soil: "#4E4A3A", stone: "#6E6E5E", stone2: "#7E7E6A", metal: "#8E6E4E", brick: "#6E5A4E", mortar: "#3E3A30", leaves: "#5E6E2E", accent: "#9CFF3D", accent2: "#FFD23F", roof: "#5E4A3A", lamp: "#C8FF6A" },
    topKind: "rock", liquid: "goo", liquidColor: "#7CFF3A",
    sky: { top: "#2E3A1E", mid: "#6E7A3E", bot: "#C8C878", fog: "#8E9A5E", sun: "#F0FFB0", light: "#E8F0C0", ground: "#3E4A2A", exposure: 1.05 },
    times: ["dusk", "day"], skyline: "wastes", skyCol: ["#4E5A2E", "#6E7A44"],
    weather: ["ash", "dust"], props: ["deadTree", "pipes", "boulder", "crate"], buildings: ["factory", "ruin", "lab"],
    ambient: ["goo", "wind"], music: { style: "M04", bpm: 132, root: 53 }, tint: "#8E2E6E",
  },
  {
    id: "glitch", name: "Glitch Core", tagline: "The heart of the gloom — everything is breaking", accent: "#FF3DF0",
    pal: { top: "#2E1E3E", soil: "#1E1428", stone: "#3E2E52", stone2: "#4E3A66", brick: "#3A2650", mortar: "#FF3DF0", metal: "#4E4466", accent: "#FF3DF0", accent2: "#3DF5FF", gloom: "#24123A", core: "#FF3DF0", crystal: "#3DF5FF", lamp: "#FF3DF0", roof: "#2A1A3A", rock: "#2E2040" },
    topKind: "neon", liquid: "void", liquidColor: "#000000",
    sky: { top: "#05020C", mid: "#1E0A2E", bot: "#5E0E5E", fog: "#2A0E3A", sun: "#FF9AF5", light: "#E0B0FF", ground: "#120818", exposure: 1.2 },
    times: ["night"], skyline: "glitch", skyCol: ["#1E0A2E", "#3A0E4A"],
    weather: ["glitch", "sparks"], props: ["spire", "pillar", "neonSign"], buildings: ["crypt", "lab", "tower", "fort"],
    ambient: ["glitch", "beeps"], music: { style: "M19", bpm: 140, root: 52 }, tint: "#00C8C8",
  },
].map((w, i) => W(w as Parameters<typeof W>[0], i));

export const STAGES_PER_WORLD = 50;
export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD; // 1000
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id)!;
export const worldIndexOfStage = (n: number) => Math.floor((Math.min(n, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
