// Obby Bike Blaster's 20 worlds, 60 levels each (1,200 designed levels; after that the remixes never end). A world is
// the palette its pixel textures are painted from (the classic two-tone checker platforms, walls, glowing kill blocks,
// ice, jelly bounce pads, conveyor belts, boost strips…), a sky for each time of day, what lies below the course (sea,
// lava, clouds or the void), a far skyline and a giant landmark (the backdrop you see most), weather, ambience and a
// band for the music.

export type WorldId =
  | "sky" | "candy" | "canyon" | "jungle" | "frost" | "docks" | "neon" | "lava" | "toys" | "shroom"
  | "haunt" | "grid" | "blossom" | "clock" | "crystal" | "station" | "moon" | "thunder" | "rainbow" | "glitch";
export type TimeOfDay = "day" | "golden" | "dusk" | "night";
export type Below = "sea" | "lava" | "clouds" | "void" | "goo";
export type Weather = "none" | "leaves" | "snow" | "rain" | "ash" | "bubbles" | "petals" | "fireflies" | "sparks" | "dust" | "glitch" | "confetti";
export type Skyline = "hills" | "mesas" | "towers" | "peaks" | "shrooms" | "volcano" | "candy" | "temples" | "forest" | "circuits" | "sea" | "factory" | "pagodas" | "craters" | "crystals" | "islands" | "toys" | "storm" | "rainbow" | "glitch";
export type Landmark = "castle" | "lolly" | "arch" | "idol" | "iceTower" | "lighthouse" | "tower" | "volcano" | "robot" | "mushroom" | "manor" | "pyramid" | "pagoda" | "clock" | "geode" | "planet" | "dome" | "spire" | "rainbow" | "core";
export type Ambient = "birds" | "wind" | "city" | "owl" | "crickets" | "lava" | "bubbles" | "gulls" | "gears" | "chimes" | "frogs" | "beeps" | "glitch" | "thunder" | "crows" | "space";

export interface Palette {
  platA: string; platB: string; edge: string; wall: string; kill: string; accent: string; accent2: string;
  wood: string; metal: string; stone: string; top: string; glow: string; ice: string; jelly: string;
}
export interface SkyLook { top: string; mid: string; bot: string; fog: string; sun: string; light: string; ground: string; exposure: number }
export interface World {
  id: WorldId; name: string; tagline: string; accent: string; seed: number;
  pal: Palette; sky: SkyLook; times: TimeOfDay[]; below: Below; belowColor: string;
  skyline: Skyline; skyCol: [string, string]; landmark: Landmark;
  weather: Weather[]; ambient: Ambient[]; music: { style: string; bpm: number; root: number }; gravity: number;
}

const base: Palette = {
  platA: "#5FCB4A", platB: "#2E3A2E", edge: "#F5F7FF", wall: "#E8433A", kill: "#FF2E4E", accent: "#FFD23F", accent2: "#3EC5FF",
  wood: "#B98A55", metal: "#9AA3B5", stone: "#8C8F98", top: "#5FBF4A", glow: "#FFE08A", ice: "#BFEAFF", jelly: "#FF6FD8",
};
const W = (w: Omit<World, "pal" | "gravity" | "seed"> & { pal?: Partial<Palette>; gravity?: number }, i: number): World =>
  ({ ...w, pal: { ...base, ...w.pal }, gravity: w.gravity ?? 24, seed: 7001 + i * 6151 });

export const WORLDS: World[] = [
  {
    id: "sky", name: "Sky Park", tagline: "Checker paths high above the clouds", accent: "#7CE05A",
    sky: { top: "#3D8BF0", mid: "#8CC8FF", bot: "#E4F4FF", fog: "#CFE8FF", sun: "#FFF4D6", light: "#FFF1D9", ground: "#7A9A6A", exposure: 1.05 },
    times: ["day", "day", "golden"], below: "clouds", belowColor: "#F4FAFF", skyline: "islands", skyCol: ["#9FD38A", "#C8E8B8"], landmark: "castle",
    weather: ["none", "leaves"], ambient: ["birds", "wind"], music: { style: "M01", bpm: 120, root: 60 },
  },
  {
    id: "candy", name: "Candy Clouds", tagline: "Sprinkle tracks and jelly bounces", accent: "#FF8AD8",
    pal: { platA: "#FF9ECF", platB: "#FFFFFF", edge: "#FF5C8A", wall: "#7FE3FF", accent: "#FFE45C", accent2: "#9BFF7A", top: "#FFC9E6", wood: "#E8A46E", jelly: "#9B5DE5" },
    sky: { top: "#7FC8FF", mid: "#C9E6FF", bot: "#FFE1F2", fog: "#FFDDF0", sun: "#FFFFFF", light: "#FFF2FA", ground: "#D98AB8", exposure: 1.05 },
    times: ["day", "golden"], below: "clouds", belowColor: "#FFE6F4", skyline: "candy", skyCol: ["#FFB1D8", "#FFD9EC"], landmark: "lolly",
    weather: ["confetti", "none"], ambient: ["chimes", "birds"], music: { style: "M05", bpm: 128, root: 65 },
  },
  {
    id: "canyon", name: "Canyon Rush", tagline: "Sandstone bridges over a red canyon", accent: "#FFB347",
    pal: { platA: "#E9C886", platB: "#B5713E", edge: "#FFF1D0", wall: "#C98E52", stone: "#C9A46A", top: "#E9CC86", wood: "#A97845" },
    sky: { top: "#2F86E0", mid: "#8FC6F0", bot: "#FFE7B8", fog: "#F5D9A6", sun: "#FFF0C8", light: "#FFE9C2", ground: "#B08A55", exposure: 1.08 },
    times: ["day", "golden", "golden"], below: "void", belowColor: "#7A3E24", skyline: "mesas", skyCol: ["#D9965A", "#EDBB82"], landmark: "arch",
    weather: ["none", "dust"], ambient: ["wind", "crows"], music: { style: "M08", bpm: 108, root: 59 },
  },
  {
    id: "jungle", name: "Jungle Ruins", tagline: "Mossy temple steps and vine jumps", accent: "#3EE08F",
    pal: { platA: "#4FB848", platB: "#5E4A2E", edge: "#B8E86A", wall: "#7E8A5E", stone: "#6E8A62", top: "#3FA845", accent: "#FFB627" },
    sky: { top: "#2E7EC8", mid: "#7EC0D8", bot: "#E0F0C8", fog: "#B8DCB0", sun: "#FFF6D0", light: "#F0F8D8", ground: "#3E5E2E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], below: "sea", belowColor: "#2E9E8E", skyline: "temples", skyCol: ["#4E8E4E", "#7EB070"], landmark: "idol",
    weather: ["leaves", "rain", "none"], ambient: ["birds", "frogs"], music: { style: "M16", bpm: 108, root: 62 },
  },
  {
    id: "frost", name: "Frost Rails", tagline: "Slippery ice runs between snowy peaks", accent: "#9FE7FF",
    pal: { platA: "#F2F8FF", platB: "#7FB8E8", edge: "#FFFFFF", wall: "#5E8CC8", kill: "#FF3D6E", stone: "#A9B6C6", top: "#F4F9FF", ice: "#BCEBFF", wood: "#8C6A4E" },
    sky: { top: "#5B8FD6", mid: "#A9CBF0", bot: "#EAF4FF", fog: "#DCEBFA", sun: "#FFFFFF", light: "#EAF3FF", ground: "#8AA0B8", exposure: 1.0 },
    times: ["day", "golden", "night"], below: "sea", belowColor: "#7FC8E8", skyline: "peaks", skyCol: ["#B8CCE4", "#E4EEF9"], landmark: "iceTower",
    weather: ["snow", "snow", "none"], ambient: ["wind", "owl"], music: { style: "M18", bpm: 100, root: 64 },
  },
  {
    id: "docks", name: "Pirate Docks", tagline: "Plank piers, crates and cannon smoke", accent: "#FFD23F",
    pal: { platA: "#C08A50", platB: "#7A5230", edge: "#F2DC9E", wall: "#8E4E2E", wood: "#9E6E40", accent: "#E8402E", top: "#F2DC9E" },
    sky: { top: "#1E8EF0", mid: "#7FD0FF", bot: "#E8FAFF", fog: "#C0EAFF", sun: "#FFFBE8", light: "#FFF6E0", ground: "#8EB0B8", exposure: 1.08 },
    times: ["day", "golden", "dusk"], below: "sea", belowColor: "#1EB0D8", skyline: "sea", skyCol: ["#5EA8C8", "#8EC8E0"], landmark: "lighthouse",
    weather: ["none"], ambient: ["gulls", "wind"], music: { style: "M15", bpm: 100, root: 65 },
  },
  {
    id: "neon", name: "Neon Night", tagline: "Glowing rooftop lines in a midnight city", accent: "#FF4FD8",
    pal: { platA: "#2E3352", platB: "#1A1D33", edge: "#FF4FD8", wall: "#5CF0FF", kill: "#FF2E6E", metal: "#6E7894", accent: "#FF4FD8", accent2: "#5CF0FF", glow: "#FF8FE6", top: "#3A3F55" },
    sky: { top: "#0B0A24", mid: "#2B1856", bot: "#7B2F8E", fog: "#2A1A4A", sun: "#FF9BE8", light: "#C9B6FF", ground: "#2A1E3E", exposure: 1.15 },
    times: ["night", "night", "dusk"], below: "void", belowColor: "#120E26", skyline: "towers", skyCol: ["#1C1838", "#2E2558"], landmark: "tower",
    weather: ["none", "rain"], ambient: ["city", "beeps"], music: { style: "M10", bpm: 112, root: 57 },
  },
  {
    id: "lava", name: "Lava Towers", tagline: "Basalt hops over a river of fire", accent: "#FF6A2B",
    pal: { platA: "#4A4046", platB: "#2B2326", edge: "#FF7A3A", wall: "#5E3A32", kill: "#FF5A1F", stone: "#4A4046", top: "#3B3236", glow: "#FF9A3A", metal: "#6B6470" },
    sky: { top: "#1A0C0C", mid: "#5A1E14", bot: "#E0582A", fog: "#7A2E1C", sun: "#FFB070", light: "#FFC69A", ground: "#3A1E16", exposure: 1.12 },
    times: ["dusk", "night"], below: "lava", belowColor: "#FF5A1F", skyline: "volcano", skyCol: ["#2A1414", "#4A221A"], landmark: "volcano",
    weather: ["ash", "sparks"], ambient: ["lava", "thunder"], music: { style: "M11", bpm: 170, root: 52 },
  },
  {
    id: "toys", name: "Toy Room", tagline: "Giant toy blocks on a playroom floor", accent: "#FF5A5A",
    pal: { platA: "#FF5A5A", platB: "#3E8CF0", edge: "#FFFFFF", wall: "#FFD23F", accent: "#3EE08F", accent2: "#B06CFF", wood: "#E8B070", top: "#FFD23F" },
    sky: { top: "#BFD8FF", mid: "#E8F0FF", bot: "#FFF6E8", fog: "#F4EEE4", sun: "#FFFFFF", light: "#FFF8F0", ground: "#C8A078", exposure: 1.05 },
    times: ["day", "golden"], below: "void", belowColor: "#B8835A", skyline: "toys", skyCol: ["#E8C8A0", "#F5E2C8"], landmark: "robot",
    weather: ["none", "confetti"], ambient: ["chimes", "beeps"], music: { style: "M09", bpm: 132, root: 60 },
  },
  {
    id: "shroom", name: "Mushroom Hills", tagline: "Bouncy caps and glowing spores", accent: "#FF7AB6",
    pal: { platA: "#C8374F", platB: "#F2E6D0", edge: "#FFFFFF", wall: "#8E5CC8", jelly: "#FF7AB6", top: "#6FA845", accent: "#8FE0FF" },
    sky: { top: "#2E3E78", mid: "#6C6AB8", bot: "#E3A6C8", fog: "#B49BC9", sun: "#FFE2F0", light: "#F5DDF0", ground: "#4F5E3E", exposure: 1.05 },
    times: ["dusk", "night", "golden"], below: "goo", belowColor: "#4E8C5A", skyline: "shrooms", skyCol: ["#6B4E8E", "#9B7BB8"], landmark: "mushroom",
    weather: ["fireflies", "none"], ambient: ["frogs", "crickets"], music: { style: "M03", bpm: 92, root: 62 },
  },
  {
    id: "haunt", name: "Haunted Rails", tagline: "Creaky bridges under a full moon", accent: "#FF9A3A",
    pal: { platA: "#4E4458", platB: "#2A2433", edge: "#FF8A2A", wall: "#3A2E2E", kill: "#B6FF5C", stone: "#5A5868", wood: "#5A4436", top: "#3E4A3A", accent: "#FF8A2A", glow: "#FF9A3A" },
    sky: { top: "#090A1E", mid: "#1E1E48", bot: "#4E3E6E", fog: "#2A2A48", sun: "#E8E8FF", light: "#B8C0FF", ground: "#1E1E2A", exposure: 1.2 },
    times: ["night", "night", "dusk"], below: "goo", belowColor: "#3A5E3A", skyline: "forest", skyCol: ["#141428", "#22223E"], landmark: "manor",
    weather: ["fireflies", "none"], ambient: ["owl", "crows"], music: { style: "M14", bpm: 116, root: 57 },
  },
  {
    id: "grid", name: "Cyber Grid", tagline: "A circuit of light in a black sky", accent: "#3DF5FF",
    pal: { platA: "#141C2E", platB: "#0E1422", edge: "#3DF5FF", wall: "#FF3DF0", kill: "#FF3D6E", metal: "#2E3E5E", accent: "#3DF5FF", accent2: "#FF3DF0", glow: "#3DF5FF", top: "#141C2E" },
    sky: { top: "#02030A", mid: "#0A1430", bot: "#1E3E7E", fog: "#0A1430", sun: "#7FF5FF", light: "#A8D8FF", ground: "#0A0E1A", exposure: 1.2 },
    times: ["night"], below: "void", belowColor: "#050812", skyline: "circuits", skyCol: ["#0A1228", "#12224A"], landmark: "spire",
    weather: ["sparks", "none"], ambient: ["beeps", "glitch"], music: { style: "M02", bpm: 128, root: 57 },
  },
  {
    id: "blossom", name: "Blossom Temple", tagline: "Red bridges under falling petals", accent: "#FF9AC3",
    pal: { platA: "#E8E0D0", platB: "#C8463A", edge: "#FFE27A", wall: "#B8343A", accent: "#E8343A", top: "#7ED86A", wood: "#C8463A" },
    sky: { top: "#6EA8F0", mid: "#C8DCFF", bot: "#FFE6F0", fog: "#F5DDEA", sun: "#FFF6FA", light: "#FFF2F6", ground: "#8EA87E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], below: "sea", belowColor: "#5EC0D8", skyline: "pagodas", skyCol: ["#C89AB8", "#E8C8D8"], landmark: "pagoda",
    weather: ["petals", "petals", "none"], ambient: ["birds", "chimes"], music: { style: "M06", bpm: 118, root: 64 },
  },
  {
    id: "clock", name: "Clockwork Works", tagline: "Gears, pistons and brass belts", accent: "#E8B04A",
    pal: { platA: "#B08A4E", platB: "#4E463E", edge: "#FFD27A", wall: "#8E4E3A", metal: "#B08A4E", accent: "#E8B04A", top: "#6E6458", glow: "#FFC86A" },
    sky: { top: "#4E4A5E", mid: "#8E8098", bot: "#D8B890", fog: "#A89480", sun: "#FFE0B0", light: "#FFE6C8", ground: "#5A4E40", exposure: 1.05 },
    times: ["golden", "dusk"], below: "void", belowColor: "#3A3028", skyline: "factory", skyCol: ["#5E5048", "#7E6E60"], landmark: "clock",
    weather: ["sparks", "none"], ambient: ["gears", "beeps"], music: { style: "M17", bpm: 114, root: 55 },
  },
  {
    id: "crystal", name: "Crystal Mine", tagline: "Glowing gems deep underground", accent: "#B98AFF",
    pal: { platA: "#4E4470", platB: "#2E2648", edge: "#B98AFF", wall: "#7CF5FF", stone: "#4E4470", accent: "#7CF5FF", accent2: "#FF7AE6", glow: "#B98AFF", top: "#4A3E6E" },
    sky: { top: "#0A0618", mid: "#241848", bot: "#4E2E7E", fog: "#241A42", sun: "#C9A8FF", light: "#B8A0FF", ground: "#1A1230", exposure: 1.2 },
    times: ["night"], below: "void", belowColor: "#120A22", skyline: "crystals", skyCol: ["#1E1638", "#2E2252"], landmark: "geode",
    weather: ["fireflies", "sparks"], ambient: ["chimes", "bubbles"], music: { style: "M09", bpm: 140, root: 57 },
  },
  {
    id: "station", name: "Space Station", tagline: "Metal catwalks past a ringed planet", accent: "#7FD0FF",
    pal: { platA: "#D8DCE8", platB: "#5E6A80", edge: "#FF8A3D", wall: "#7FD0FF", metal: "#D8DCE8", accent: "#FF8A3D", accent2: "#7FD0FF", top: "#B8BCC8", glow: "#BFF0FF" },
    sky: { top: "#000006", mid: "#050818", bot: "#1A2040", fog: "#0E1226", sun: "#FFFFFF", light: "#F0F4FF", ground: "#2E3040", exposure: 1.1 },
    times: ["night"], below: "void", belowColor: "#000000", skyline: "islands", skyCol: ["#3E4458", "#5E6478"], landmark: "planet",
    weather: ["none", "dust"], ambient: ["space", "beeps"], music: { style: "M20", bpm: 124, root: 55 }, gravity: 21,
  },
  {
    id: "moon", name: "Moon Craters", tagline: "Floaty jumps on the low-gravity moon", accent: "#B8C8FF",
    pal: { platA: "#B8B8C0", platB: "#6E6E7A", edge: "#7FD0FF", wall: "#8A8A94", stone: "#9E9EA8", top: "#B8B8C0", accent: "#FF8A3D" },
    sky: { top: "#000006", mid: "#050818", bot: "#1A2040", fog: "#0E1226", sun: "#FFFFFF", light: "#F0F4FF", ground: "#2E3040", exposure: 1.1 },
    times: ["night"], below: "void", belowColor: "#000000", skyline: "craters", skyCol: ["#4E4E5E", "#6E6E7E"], landmark: "dome",
    weather: ["none", "dust"], ambient: ["space", "wind"], music: { style: "M20", bpm: 122, root: 53 }, gravity: 19,
  },
  {
    id: "thunder", name: "Thunder Peaks", tagline: "Lightning, wind and storm clouds", accent: "#FFE45C",
    pal: { platA: "#5E6A7E", platB: "#2E3442", edge: "#FFE45C", wall: "#3E4A5E", kill: "#7CF5FF", stone: "#5E6A7E", accent: "#FFE45C", top: "#4E5A4E", glow: "#BFF0FF" },
    sky: { top: "#1A1E2E", mid: "#3E4658", bot: "#7E8698", fog: "#4E5668", sun: "#E8EEFF", light: "#C8D0E8", ground: "#2E3440", exposure: 1.1 },
    times: ["dusk", "night"], below: "clouds", belowColor: "#5E6678", skyline: "storm", skyCol: ["#2E3444", "#4A5264"], landmark: "spire",
    weather: ["rain", "rain"], ambient: ["thunder", "wind"], music: { style: "M19", bpm: 140, root: 52 },
  },
  {
    id: "rainbow", name: "Rainbow Road", tagline: "A ribbon of colour across the stars", accent: "#FF6FD8",
    pal: { platA: "#FF6F6F", platB: "#6FB8FF", edge: "#FFFFFF", wall: "#B06CFF", kill: "#1E1E2E", accent: "#FFE45C", accent2: "#3EE08F", glow: "#FFFFFF", top: "#FF9ECF" },
    sky: { top: "#05020C", mid: "#1E0A3E", bot: "#4E1E7E", fog: "#2A1250", sun: "#FFF6FF", light: "#F0E0FF", ground: "#1A0A2E", exposure: 1.2 },
    times: ["night"], below: "void", belowColor: "#000000", skyline: "rainbow", skyCol: ["#2A1250", "#3E1E6E"], landmark: "rainbow",
    weather: ["sparks", "confetti"], ambient: ["chimes", "space"], music: { style: "M05", bpm: 136, root: 62 },
  },
  {
    id: "glitch", name: "Glitch Core", tagline: "The broken heart of the obby — everything flickers", accent: "#FF3DF0",
    pal: { platA: "#3E2E52", platB: "#1E1428", edge: "#FF3DF0", wall: "#3DF5FF", kill: "#FF3DF0", metal: "#4E4466", accent: "#FF3DF0", accent2: "#3DF5FF", glow: "#FF3DF0", top: "#2E1E3E" },
    sky: { top: "#05020C", mid: "#1E0A2E", bot: "#5E0E5E", fog: "#2A0E3A", sun: "#FF9AF5", light: "#E0B0FF", ground: "#120818", exposure: 1.2 },
    times: ["night"], below: "void", belowColor: "#000000", skyline: "glitch", skyCol: ["#1E0A2E", "#3A0E4A"], landmark: "core",
    weather: ["glitch", "sparks"], ambient: ["glitch", "beeps"], music: { style: "M19", bpm: 144, root: 52 },
  },
].map((w, i) => W(w as Parameters<typeof W>[0], i));

export const LEVELS_PER_WORLD = 60;
export const DESIGNED_LEVELS = WORLDS.length * LEVELS_PER_WORLD; // 1200
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id)!;
