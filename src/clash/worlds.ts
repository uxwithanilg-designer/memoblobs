// Cube Clash's 20 map themes, 50 stages each (1,000 designed stages; after that the remixes never end). A theme is a
// palette for the block textures, a sky for each time of day, what lies far below the islands (a sea of clouds, an
// ocean, a lava lake or the starry void), the backdrop (more floating islands with waterfalls, mountain peaks, mesas,
// crystal spires, neon towers, airships and balloons…), weather, the props its maps are built from, ambience and band.

export type ThemeId =
  | "meadow" | "sakura" | "mesa" | "frost" | "shroom" | "magma" | "candy" | "bay" | "jungle" | "crystal"
  | "neon" | "harvest" | "haunt" | "temple" | "clock" | "moon" | "lagoon" | "volcano" | "toy" | "aurora";
export type TimeOfDay = "day" | "golden" | "dusk" | "night";
export type Below = "clouds" | "sea" | "lava" | "void";
export type Far = "isles" | "peaks" | "mesas" | "spires" | "towers" | "shrooms" | "volcanoes" | "candy" | "temples" | "planets";
export type Weather = "none" | "petals" | "snow" | "leaves" | "fireflies" | "ash" | "rain" | "sparks" | "bubbles" | "aurora" | "confetti";
export type Ambient = "birds" | "wind" | "gulls" | "owl" | "crickets" | "lava" | "chimes" | "frogs" | "beeps" | "bells" | "crows" | "bubbles";
export type Prop = "oak" | "pine" | "palm" | "cactus" | "blossom" | "shroom" | "spire" | "deadTree" | "lamp" | "boulder" | "crate" | "flowers" | "candy" | "coral" | "pumpkin";

export interface Palette { top: string; soil: string; stone: string; sand: string; bark: string; ring: string; plank: string; leaves: string; brick: string; mortar: string; glass: string; metal: string; accent: string; roof: string; lamp: string; ice: string }
export interface Sky { top: string; mid: string; bot: string; fog: string; sun: string; light: string; ground: string; exposure: number }
export interface Theme {
  id: ThemeId; name: string; tagline: string; accent: string; seed: number;
  pal: Palette; sky: Sky; times: TimeOfDay[]; below: Below; belowColor: string; far: Far; farCol: [string, string];
  weather: Weather[]; props: Prop[]; topBlock: "grass" | "sand" | "snow" | "stone";
  ambient: Ambient[]; music: { style: string; bpm: number; root: number }; gravity: number; mobTint: string;
}

const base: Palette = {
  top: "#62C553", soil: "#9A6A44", stone: "#9AA0AE", sand: "#F0D79A", bark: "#7A5236", ring: "#D8B27A", plank: "#C99A62", leaves: "#46B04A",
  brick: "#C9604A", mortar: "#E8DCC8", glass: "#9ED8FF", metal: "#A8B2C4", accent: "#FF7AB6", roof: "#D2493E", lamp: "#FFE08A", ice: "#C6ECFF",
};
const T = (t: Omit<Theme, "pal" | "seed" | "gravity"> & { pal?: Partial<Palette>; gravity?: number }, i: number): Theme =>
  ({ ...t, pal: { ...base, ...t.pal }, gravity: t.gravity ?? 25, seed: 4111 + i * 6151 });

export const THEMES: Theme[] = [
  { id: "meadow", name: "Meadow Isles", tagline: "Green islands over a sea of clouds", accent: "#62E05A",
    sky: { top: "#3E8DF2", mid: "#8FCBFF", bot: "#E6F6FF", fog: "#CFE9FF", sun: "#FFF4D6", light: "#FFF3DE", ground: "#6A8A5A", exposure: 1.05 },
    times: ["day", "day", "golden"], below: "clouds", belowColor: "#F4F9FF", far: "isles", farCol: ["#7CC46C", "#A9D99A"],
    weather: ["none", "petals"], props: ["oak", "oak", "flowers", "boulder", "crate"], topBlock: "grass", ambient: ["birds", "wind"], music: { style: "M01", bpm: 118, root: 62 }, mobTint: "#6FAE4A" },
  { id: "sakura", name: "Sakura Heights", tagline: "Blossom islands and lantern bridges", accent: "#FF8AC0",
    pal: { leaves: "#FFB0D0", top: "#7ED86A", roof: "#C2353E", accent: "#E8343A", plank: "#C8463A", lamp: "#FFC27A" },
    sky: { top: "#6EA8F0", mid: "#C8DCFF", bot: "#FFE6F0", fog: "#F5DDEA", sun: "#FFF6FA", light: "#FFF2F6", ground: "#8EA87E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], below: "clouds", belowColor: "#FFE9F3", far: "temples", farCol: ["#D7A0C0", "#F0C8DC"],
    weather: ["petals", "petals", "none"], props: ["blossom", "blossom", "lamp", "flowers"], topBlock: "grass", ambient: ["chimes", "birds"], music: { style: "M06", bpm: 116, root: 64 }, mobTint: "#7A4E9E" },
  { id: "mesa", name: "Sunset Mesa", tagline: "Red rock towers and cactus gardens", accent: "#FFA14A",
    pal: { top: "#E8B070", soil: "#C86E44", stone: "#D08A5A", sand: "#F2C98A", leaves: "#5EA84A", brick: "#B8643A", roof: "#9A4A2A" },
    sky: { top: "#3A7EDC", mid: "#9CC6EE", bot: "#FFD8A8", fog: "#F2C9A0", sun: "#FFF0C8", light: "#FFE6C0", ground: "#A86A44", exposure: 1.08 },
    times: ["day", "golden", "golden"], below: "void", belowColor: "#E8A070", far: "mesas", farCol: ["#D07A4A", "#EAA878"],
    weather: ["none"], props: ["cactus", "cactus", "boulder", "crate"], topBlock: "sand", ambient: ["wind", "crows"], music: { style: "M14", bpm: 112, root: 57 }, mobTint: "#A0522D" },
  { id: "frost", name: "Frost Peaks", tagline: "Snowy islands and frozen falls", accent: "#9FE7FF",
    pal: { leaves: "#2E7A58", brick: "#8AA0BA", roof: "#3E70B0", ice: "#BCEBFF" },
    sky: { top: "#5B8FD6", mid: "#A9CBF0", bot: "#EEF6FF", fog: "#DFEDFB", sun: "#FFFFFF", light: "#EAF3FF", ground: "#8AA0B8", exposure: 1.0 },
    times: ["day", "golden", "night"], below: "clouds", belowColor: "#EEF6FF", far: "peaks", farCol: ["#C2D4EA", "#EEF4FC"],
    weather: ["snow", "snow", "none"], props: ["pine", "pine", "boulder"], topBlock: "snow", ambient: ["wind", "owl"], music: { style: "M18", bpm: 98, root: 64 }, mobTint: "#3D6CB9" },
  { id: "shroom", name: "Mushroom Grove", tagline: "Giant caps and glowing spores", accent: "#FF7AB6",
    pal: { top: "#74B04A", leaves: "#D2384E", bark: "#EFE4CC", ring: "#F7EFDF", accent: "#FF7AB6" },
    sky: { top: "#33427E", mid: "#7270BE", bot: "#E8AACC", fog: "#B8A0CC", sun: "#FFE2F0", light: "#F5DDF0", ground: "#4F5E3E", exposure: 1.08 },
    times: ["dusk", "night", "golden"], below: "void", belowColor: "#4A3A6A", far: "shrooms", farCol: ["#7B5EA0", "#A88BC8"],
    weather: ["fireflies", "none"], props: ["shroom", "shroom", "flowers", "boulder"], topBlock: "grass", ambient: ["frogs", "crickets"], music: { style: "M03", bpm: 90, root: 62 }, mobTint: "#5E8C31" },
  { id: "magma", name: "Magma Rocks", tagline: "Basalt islands over a lava lake", accent: "#FF6A2B",
    pal: { top: "#4A3A3A", soil: "#3A2A2A", stone: "#5A4A4E", brick: "#6E3A30", mortar: "#FF7A3A", metal: "#7A7480", lamp: "#FF9A3A", accent: "#FF6A2B", roof: "#4A2E2E" },
    sky: { top: "#1E0E0E", mid: "#5E2216", bot: "#E85E2A", fog: "#7A2E1C", sun: "#FFB070", light: "#FFC69A", ground: "#3A1E16", exposure: 1.12 },
    times: ["dusk", "night"], below: "lava", belowColor: "#FF5A1F", far: "volcanoes", farCol: ["#3A1A14", "#5A281A"],
    weather: ["ash", "sparks"], props: ["boulder", "deadTree", "lamp"], topBlock: "stone", ambient: ["lava", "wind"], music: { style: "M11", bpm: 170, root: 52 }, mobTint: "#B22222" },
  { id: "candy", name: "Candy Clouds", tagline: "Sugar islands and lollipop forests", accent: "#FF8AD8",
    pal: { top: "#FFC9E6", soil: "#C47E5E", stone: "#F7E1F0", leaves: "#FF7AB6", bark: "#FFFFFF", ring: "#FF5C8A", brick: "#FF8FB8", mortar: "#FFFFFF", accent: "#7FE3FF", roof: "#FF5C8A", plank: "#E8A46E" },
    sky: { top: "#7FC8FF", mid: "#C9E6FF", bot: "#FFE1F2", fog: "#FFDDF0", sun: "#FFFFFF", light: "#FFF2FA", ground: "#D98AB8", exposure: 1.05 },
    times: ["day", "golden"], below: "clouds", belowColor: "#FFE6F4", far: "candy", farCol: ["#FFB1D8", "#FFD9EC"],
    weather: ["confetti", "none"], props: ["candy", "candy", "flowers"], topBlock: "grass", ambient: ["chimes", "birds"], music: { style: "M05", bpm: 128, root: 65 }, mobTint: "#6A4C93" },
  { id: "bay", name: "Pirate Bay", tagline: "Palm islands, docks and a wide blue sea", accent: "#FFD23F",
    pal: { top: "#F2DC9E", soil: "#D8BC80", plank: "#9E6E40", bark: "#7A5A3A", leaves: "#3EA84A", brick: "#B07A50", accent: "#E8402E", roof: "#8E4E2E" },
    sky: { top: "#1E8EF0", mid: "#7FD0FF", bot: "#E8FAFF", fog: "#C0EAFF", sun: "#FFFBE8", light: "#FFF6E0", ground: "#8EB0B8", exposure: 1.08 },
    times: ["day", "golden", "dusk"], below: "sea", belowColor: "#1EA8D8", far: "isles", farCol: ["#4E9A5A", "#8EC8A0"],
    weather: ["none"], props: ["palm", "palm", "crate", "boulder"], topBlock: "sand", ambient: ["gulls", "wind"], music: { style: "M15", bpm: 98, root: 65 }, mobTint: "#4E6E3A" },
  { id: "jungle", name: "Jungle Ruins", tagline: "Mossy temples and hanging vines", accent: "#3EE08F",
    pal: { top: "#3FA845", soil: "#5A3E2A", stone: "#7A9070", leaves: "#2E8E3A", brick: "#7E8A5E", mortar: "#4E5E3A", accent: "#FFB627", roof: "#6E5A3A" },
    sky: { top: "#2E7EC8", mid: "#7EC0D8", bot: "#E0F0C8", fog: "#B8DCB0", sun: "#FFF6D0", light: "#F0F8D8", ground: "#3E5E2E", exposure: 1.05 },
    times: ["day", "golden", "dusk"], below: "sea", belowColor: "#2E9E8E", far: "temples", farCol: ["#4E8E4E", "#7EB070"],
    weather: ["leaves", "rain", "none"], props: ["oak", "palm", "boulder", "flowers"], topBlock: "grass", ambient: ["birds", "frogs"], music: { style: "M16", bpm: 106, root: 62 }, mobTint: "#8E5A2E" },
  { id: "crystal", name: "Crystal Caverns", tagline: "Glowing gems in a purple dusk", accent: "#B98AFF",
    pal: { top: "#5A4E8E", soil: "#2E2648", stone: "#5E5482", brick: "#3E3460", mortar: "#7E6EC0", accent: "#7CF5FF", lamp: "#7CF5FF", glass: "#C9A8FF" },
    sky: { top: "#0A0618", mid: "#2A1A52", bot: "#5E3A8E", fog: "#2A1E4A", sun: "#C9A8FF", light: "#B8A0FF", ground: "#1A1230", exposure: 1.2 },
    times: ["night"], below: "void", belowColor: "#1A1030", far: "spires", farCol: ["#3A2A6A", "#5A4A9A"],
    weather: ["fireflies"], props: ["spire", "spire", "boulder", "lamp"], topBlock: "stone", ambient: ["chimes", "bubbles"], music: { style: "M09", bpm: 140, root: 57 }, mobTint: "#C04E8E" },
  { id: "neon", name: "Neon Arcade", tagline: "Glowing rooftops under the stars", accent: "#FF4FD8",
    pal: { top: "#3A3F5A", soil: "#2B2E40", stone: "#4B5068", brick: "#5B4E7A", mortar: "#FF4FD8", metal: "#6E7894", glass: "#5CF0FF", accent: "#FF4FD8", roof: "#2E3348", lamp: "#FF8FE6" },
    sky: { top: "#0B0A24", mid: "#2B1856", bot: "#7B2F8E", fog: "#2A1A4A", sun: "#FF9BE8", light: "#C9B6FF", ground: "#2A1E3E", exposure: 1.15 },
    times: ["night", "night", "dusk"], below: "void", belowColor: "#120E26", far: "towers", farCol: ["#1C1838", "#2E2558"],
    weather: ["rain", "none"], props: ["lamp", "crate", "boulder"], topBlock: "stone", ambient: ["beeps", "wind"], music: { style: "M10", bpm: 112, root: 57 }, mobTint: "#2EC4B6" },
  { id: "harvest", name: "Harvest Farm", tagline: "Golden fields, barns and windmills", accent: "#FF9A3D",
    pal: { top: "#C8B045", soil: "#7A4E30", leaves: "#E8702A", accent: "#C8452A", roof: "#9E3A2A", plank: "#B07840" },
    sky: { top: "#4E7EC8", mid: "#B8C8E0", bot: "#FFD8A8", fog: "#F0D0A8", sun: "#FFE0B0", light: "#FFE6C4", ground: "#7A5A3A", exposure: 1.05 },
    times: ["golden", "day", "dusk"], below: "clouds", belowColor: "#FFE8C8", far: "isles", farCol: ["#C8903A", "#E0B868"],
    weather: ["leaves", "none"], props: ["oak", "pumpkin", "crate", "flowers"], topBlock: "grass", ambient: ["birds", "crows"], music: { style: "M17", bpm: 112, root: 60 }, mobTint: "#5E3A8E" },
  { id: "haunt", name: "Haunted Isles", tagline: "Pumpkins, crooked trees and a full moon", accent: "#FF9A3A",
    pal: { top: "#3E4A3A", soil: "#3A2E2A", stone: "#5A5868", bark: "#3A2E2E", leaves: "#4A2E5A", brick: "#4E4458", mortar: "#2A2433", accent: "#FF8A2A", roof: "#2E2A3A", lamp: "#FF9A3A", glass: "#FFB347" },
    sky: { top: "#090A1E", mid: "#1E1E48", bot: "#4E3E6E", fog: "#2A2A48", sun: "#E8E8FF", light: "#B8C0FF", ground: "#1E1E2A", exposure: 1.2 },
    times: ["night", "night", "dusk"], below: "void", belowColor: "#14142A", far: "spires", farCol: ["#141428", "#22223E"],
    weather: ["fireflies", "none"], props: ["deadTree", "pumpkin", "lamp"], topBlock: "grass", ambient: ["owl", "crows"], music: { style: "M14", bpm: 116, root: 57 }, mobTint: "#5A6E3A" },
  { id: "temple", name: "Sky Temple", tagline: "Marble steps above the clouds", accent: "#FFE27A",
    pal: { top: "#9FE08A", stone: "#E8E4DA", brick: "#D8D0C0", mortar: "#BFB6A4", roof: "#4E8CD8", accent: "#FFD23F" },
    sky: { top: "#3E7EE8", mid: "#9CC8FF", bot: "#FFFFFF", fog: "#E8F2FF", sun: "#FFF8E0", light: "#FFF8EC", ground: "#AFC8E8", exposure: 1.05 },
    times: ["day", "golden"], below: "clouds", belowColor: "#FFFFFF", far: "temples", farCol: ["#D8E4F5", "#F0F4FF"],
    weather: ["none"], props: ["oak", "boulder", "flowers"], topBlock: "grass", ambient: ["wind", "chimes"], music: { style: "M13", bpm: 100, root: 62 }, mobTint: "#6A5ACD" },
  { id: "clock", name: "Clockwork Isles", tagline: "Brass, pipes and turning gears", accent: "#E8B04A",
    pal: { top: "#7E7468", soil: "#4E463E", stone: "#8E8478", metal: "#C09A5E", brick: "#8E4E3A", mortar: "#3E3630", accent: "#E8B04A", roof: "#4E4E58", lamp: "#FFC86A" },
    sky: { top: "#4E4A5E", mid: "#8E8098", bot: "#D8B890", fog: "#A89480", sun: "#FFE0B0", light: "#FFE6C8", ground: "#5A4E40", exposure: 1.05 },
    times: ["golden", "dusk"], below: "clouds", belowColor: "#D8C0A0", far: "towers", farCol: ["#5E5048", "#7E6E60"],
    weather: ["sparks", "none"], props: ["lamp", "crate", "boulder"], topBlock: "stone", ambient: ["bells", "beeps"], music: { style: "M17", bpm: 114, root: 55 }, mobTint: "#5E6E8E" },
  { id: "moon", name: "Moon Station", tagline: "Low-gravity domes among the stars", accent: "#B8C8FF",
    pal: { top: "#C0C0C8", soil: "#8E8E98", stone: "#A6A6B0", metal: "#D8DCE8", glass: "#7FD0FF", accent: "#FF8A3D", roof: "#E8ECF5", lamp: "#BFF0FF" },
    sky: { top: "#000006", mid: "#050818", bot: "#1A2040", fog: "#0E1226", sun: "#FFFFFF", light: "#F0F4FF", ground: "#2E3040", exposure: 1.1 },
    times: ["night"], below: "void", belowColor: "#000000", far: "planets", farCol: ["#4E4E5E", "#6E6E7E"],
    weather: ["none"], props: ["boulder", "lamp", "crate"], topBlock: "stone", ambient: ["beeps", "wind"], music: { style: "M20", bpm: 122, root: 55 }, gravity: 12, mobTint: "#4EA84E" },
  { id: "lagoon", name: "Coral Lagoon", tagline: "Shell islands in a turquoise sea", accent: "#3FE0D0",
    pal: { top: "#E7D7A8", soil: "#C9B486", stone: "#7FB8B0", leaves: "#FF6F91", brick: "#5E8C9A", mortar: "#A8D8D8", accent: "#FF6F91", roof: "#2E7E8E" },
    sky: { top: "#1E7EC8", mid: "#6EC8E8", bot: "#E0FFF8", fog: "#B8EEF0", sun: "#FFFFF0", light: "#E8FFFA", ground: "#5E9E9E", exposure: 1.05 },
    times: ["day", "golden"], below: "sea", belowColor: "#22C6C8", far: "isles", farCol: ["#5EA8A0", "#8ED0C8"],
    weather: ["bubbles", "none"], props: ["palm", "coral", "coral", "boulder"], topBlock: "sand", ambient: ["gulls", "bubbles"], music: { style: "M15", bpm: 94, root: 62 }, mobTint: "#1B998B" },
  { id: "volcano", name: "Volcano Rim", tagline: "Black sand and rivers of fire", accent: "#FF7A2A",
    pal: { top: "#3A3236", soil: "#2B2326", stone: "#4A4046", brick: "#5E3A32", mortar: "#FF7A3A", lamp: "#FF9A3A", accent: "#FFD23F" },
    sky: { top: "#2A1418", mid: "#7A2E22", bot: "#FF9A5A", fog: "#8A3E2C", sun: "#FFC890", light: "#FFD0A8", ground: "#3A1E16", exposure: 1.1 },
    times: ["dusk", "golden"], below: "lava", belowColor: "#FF6A2A", far: "volcanoes", farCol: ["#4A2018", "#6A3020"],
    weather: ["ash", "sparks"], props: ["boulder", "deadTree"], topBlock: "stone", ambient: ["lava", "wind"], music: { style: "M02", bpm: 128, root: 52 }, mobTint: "#B22222" },
  { id: "toy", name: "Toy Town", tagline: "Building-block houses in bright colours", accent: "#FFD23F",
    pal: { top: "#5ED06A", brick: "#3D8BFF", mortar: "#FFFFFF", roof: "#FF4D5E", plank: "#FFC83D", accent: "#38D96B", metal: "#E8ECF5" },
    sky: { top: "#4E9EF8", mid: "#9ED4FF", bot: "#F0FAFF", fog: "#D8EEFF", sun: "#FFFFFF", light: "#FFF8EC", ground: "#7AB070", exposure: 1.08 },
    times: ["day", "day", "golden"], below: "clouds", belowColor: "#F0F8FF", far: "towers", farCol: ["#9EC8F0", "#C8E0F8"],
    weather: ["confetti", "none"], props: ["oak", "flowers", "crate", "lamp"], topBlock: "grass", ambient: ["birds", "chimes"], music: { style: "M05", bpm: 132, root: 60 }, mobTint: "#8E2E6E" },
  { id: "aurora", name: "Aurora Realm", tagline: "Night islands under dancing lights", accent: "#7CFFC8",
    pal: { top: "#E8F4FF", leaves: "#2E6B5A", brick: "#5A6E8A", roof: "#2E4E7A", accent: "#7CFFC8", lamp: "#9FFFE0" },
    sky: { top: "#04081A", mid: "#0E2A4A", bot: "#2E6E7A", fog: "#14304A", sun: "#E8FFF8", light: "#BFE8FF", ground: "#1A2A3A", exposure: 1.2 },
    times: ["night"], below: "clouds", belowColor: "#3A5E7A", far: "peaks", farCol: ["#1E3A5A", "#2E5070"],
    weather: ["aurora", "snow"], props: ["pine", "pine", "lamp", "boulder"], topBlock: "snow", ambient: ["wind", "owl"], music: { style: "M19", bpm: 140, root: 52 }, mobTint: "#00C8C8" },
].map((t, i) => T(t as Parameters<typeof T>[0], i));

export const STAGES_PER_THEME = 50;
export const DESIGNED_STAGES = THEMES.length * STAGES_PER_THEME; // 1000
export const themeOf = (id: ThemeId) => THEMES.find((t) => t.id === id)!;
