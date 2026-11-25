// Peak Rover's twelve worlds: each has its own sky, three painted ridge layers, ground, props, weather, music, terrain
// character and physics (the crater has low gravity). The time of day and the weather change from stage to stage, and
// the colours are graded to match (src/rover/art/grade.ts).

export type WorldId =
  | "meadow" | "canyon" | "pines" | "dunes" | "frost" | "metro"
  | "jungle" | "volcano" | "coast" | "autumn" | "caverns" | "crater";
export type TimeOfDay = "morning" | "day" | "golden" | "dusk" | "night";
export type Weather =
  | "clear" | "breeze" | "rain" | "snow" | "fog" | "sand" | "leaves" | "petals" | "embers" | "fireflies" | "spores" | "meteors";
export type RidgeStyle =
  | "peaks" | "rounded" | "mesas" | "dunes" | "city" | "canopy" | "volcano" | "sea" | "forest" | "crystals" | "craters" | "pines";
export type Ground = "grass" | "redsand" | "moss" | "sand" | "snow" | "asphalt" | "jungle" | "ash" | "beach" | "leaf" | "crystal" | "dust";
export type PropKind =
  | "tree" | "bush" | "flowers" | "fence" | "windmill" | "hay" | "sign"
  | "cactus" | "saguaro" | "arch" | "tumbleweed" | "balloon"
  | "pine" | "log" | "cabin" | "mushroom" | "rock"
  | "palm" | "pillar" | "oasis"
  | "snowpine" | "snowman" | "igloo" | "icecrystal"
  | "lamp" | "cone" | "barrier" | "billboard" | "crane"
  | "fern" | "bigleaf" | "totem" | "bloom"
  | "deadtree" | "lavarock" | "geyser" | "obsidian"
  | "lighthouse" | "umbrella" | "shell" | "crab"
  | "maple" | "pumpkin" | "scarecrow" | "barn"
  | "crystal" | "stalagmite" | "glowshroom" | "lantern" | "minecart"
  | "moonrock" | "antenna" | "dish" | "planetflag";
export type Ambient = "birds" | "hawk" | "loon" | "wind" | "owl" | "city" | "frogs" | "rumble" | "gulls" | "crows" | "drips" | "beeps";

export interface TerrainStyle {
  /** big hills, small bumps (multipliers) */
  amp: number; bump: number;
  /** how often each feature shows up */
  ramps: number; gaps: number; bridges: number; steps: number; whoops: number; steep: number; valleys: number; rocks: number;
  /** a gentle overall climb (+) or descent (−) per metre */
  trend: number;
}

export interface World {
  id: WorldId;
  name: string;
  blurb: string;
  /** day colours: sky top / middle / horizon, sun, haze; ridges far / mid / near; ground */
  sky: [string, string, string];
  sun: string;
  haze: string;
  ridges: [{ style: RidgeStyle; color: string; h: number }, { style: RidgeStyle; color: string; h: number }, { style: RidgeStyle; color: string; h: number }];
  ground: Ground;
  surface: string; surfaceHi: string; soil: [string, string]; strata: string;
  /** UI accent and a glow colour (crystals, neon, lava) */
  accent: string; glow: string;
  props: [PropKind, number][];
  landmarks: PropKind[];
  times: TimeOfDay[];
  weathers: Weather[];
  terrain: TerrainStyle;
  gravity: number; grip: number;
  ambience: Ambient[];
  /** no sky: a cave ceiling / outer space */
  enclosed?: "cave" | "space";
}

const T = (o: Partial<TerrainStyle>): TerrainStyle => ({ amp: 1, bump: 1, ramps: 1, gaps: 0.5, bridges: 0.6, steps: 0.5, whoops: 0.6, steep: 0.8, valleys: 0.6, rocks: 0.5, trend: 0.02, ...o });

export const WORLDS: World[] = [
  {
    id: "meadow", name: "Meadow Bloom", blurb: "Rolling spring hills, windmills and wildflowers.",
    sky: ["#4FA3F7", "#8CCBFF", "#DDF3FF"], sun: "#FFF4C2", haze: "#CFE8FF",
    ridges: [{ style: "peaks", color: "#86AEDC", h: 0.62 }, { style: "rounded", color: "#6CC27E", h: 0.42 }, { style: "forest", color: "#42A862", h: 0.28 }],
    ground: "grass", surface: "#67CF62", surfaceHi: "#B9F28A", soil: ["#8C5B3B", "#563523"], strata: "#A8764E",
    accent: "#7CD957", glow: "#FFE98A",
    props: [["tree", 3], ["bush", 3], ["flowers", 4], ["fence", 2], ["hay", 1], ["sign", 0.4], ["rock", 1]],
    landmarks: ["windmill", "balloon"],
    times: ["morning", "day", "day", "golden", "dusk", "night"],
    weathers: ["clear", "clear", "breeze", "petals", "rain"],
    terrain: T({ amp: 0.85, bump: 0.8, gaps: 0.3, steep: 0.6 }),
    gravity: 10, grip: 1, ambience: ["birds", "wind"],
  },
  {
    id: "canyon", name: "Sunset Canyon", blurb: "Red rock mesas, cactus flats and stone arches.",
    sky: ["#3E8EDB", "#8FC3EC", "#FFE3B8"], sun: "#FFE7A8", haze: "#F7CFA6",
    ridges: [{ style: "mesas", color: "#D9917A", h: 0.55 }, { style: "mesas", color: "#C4643F", h: 0.4 }, { style: "rounded", color: "#A84A2E", h: 0.24 }],
    ground: "redsand", surface: "#E28C52", surfaceHi: "#F9BC82", soil: ["#B3522F", "#6E2A18"], strata: "#D27245",
    accent: "#FF8A4C", glow: "#FFD27A",
    props: [["cactus", 3], ["saguaro", 2], ["tumbleweed", 1.5], ["rock", 2], ["sign", 0.5]],
    landmarks: ["arch", "balloon"],
    times: ["day", "golden", "golden", "dusk", "night", "morning"],
    weathers: ["clear", "clear", "sand", "breeze"],
    terrain: T({ amp: 1.05, ramps: 1.4, gaps: 0.8, bridges: 0.9, steps: 0.8, trend: 0.03 }),
    gravity: 10, grip: 0.95, ambience: ["hawk", "wind"],
  },
  {
    id: "pines", name: "Pine Lake", blurb: "Alpine forests, a glassy lake and snowy summits.",
    sky: ["#3C7BD8", "#7DB4F0", "#D9ECFF"], sun: "#FFF6D8", haze: "#C9DEF5",
    ridges: [{ style: "peaks", color: "#8FA3D6", h: 0.72 }, { style: "pines", color: "#2F6E5A", h: 0.42 }, { style: "pines", color: "#235646", h: 0.3 }],
    ground: "moss", surface: "#5DB362", surfaceHi: "#A2DC7E", soil: ["#6B4A35", "#3D2A1F"], strata: "#7E5B42",
    accent: "#4FC3A1", glow: "#FFF0A8",
    props: [["pine", 5], ["log", 1.2], ["mushroom", 1.5], ["rock", 2], ["fence", 0.6]],
    landmarks: ["cabin"],
    times: ["morning", "day", "golden", "dusk", "night"],
    weathers: ["clear", "fog", "rain", "breeze"],
    terrain: T({ amp: 1.15, steep: 1.2, bridges: 1.2, valleys: 0.8, trend: 0.04 }),
    gravity: 10, grip: 1, ambience: ["loon", "birds"],
  },
  {
    id: "dunes", name: "Saffron Dunes", blurb: "Golden dunes, palm oases and old sandstone ruins.",
    sky: ["#2F86E0", "#7FBDF2", "#FFF0C9"], sun: "#FFF8D6", haze: "#FBE3B0",
    ridges: [{ style: "dunes", color: "#E9BC7A", h: 0.42 }, { style: "dunes", color: "#E2A458", h: 0.32 }, { style: "dunes", color: "#D18C3F", h: 0.22 }],
    ground: "sand", surface: "#F4C46B", surfaceHi: "#FFE6A6", soil: ["#D9A04D", "#9C6526"], strata: "#EAB862",
    accent: "#FFC247", glow: "#FFF2B0",
    props: [["palm", 2], ["cactus", 1.5], ["pillar", 1.2], ["rock", 1.5], ["tumbleweed", 0.8]],
    landmarks: ["oasis"],
    times: ["day", "day", "golden", "dusk", "night"],
    weathers: ["clear", "sand", "clear", "breeze"],
    terrain: T({ amp: 1, bump: 0.6, ramps: 1.2, whoops: 1.4, steps: 0.3, gaps: 0.6, trend: 0.01 }),
    gravity: 10, grip: 0.86, ambience: ["wind"],
  },
  {
    id: "frost", name: "Frost Peaks", blurb: "Snowfields, ice crystals and the northern lights.",
    sky: ["#3A6FD0", "#8AB8F2", "#E7F4FF"], sun: "#FFFFFF", haze: "#DDEBFF",
    ridges: [{ style: "peaks", color: "#AFC6EC", h: 0.75 }, { style: "peaks", color: "#D2E3F8", h: 0.5 }, { style: "pines", color: "#5F84B8", h: 0.3 }],
    ground: "snow", surface: "#F3F9FF", surfaceHi: "#FFFFFF", soil: ["#90A8CA", "#4C5E80"], strata: "#BACDE6",
    accent: "#7FD1FF", glow: "#9CFFD9",
    props: [["snowpine", 4], ["icecrystal", 1.5], ["snowman", 0.8], ["rock", 1.5]],
    landmarks: ["igloo"],
    times: ["morning", "day", "golden", "dusk", "night", "night"],
    weathers: ["snow", "clear", "snow", "fog"],
    terrain: T({ amp: 1.1, steep: 1.1, ramps: 1.2, gaps: 0.7, trend: 0.03 }),
    gravity: 10, grip: 0.82, ambience: ["wind"],
  },
  {
    id: "metro", name: "Midnight Metro", blurb: "City outskirts, neon billboards and a glittering skyline.",
    sky: ["#1E2A78", "#5B3E9E", "#F08BA8"], sun: "#FFD1E8", haze: "#7B5AA8",
    ridges: [{ style: "city", color: "#34307A", h: 0.7 }, { style: "city", color: "#262257", h: 0.5 }, { style: "rounded", color: "#1B1A44", h: 0.22 }],
    ground: "asphalt", surface: "#40445E", surfaceHi: "#7A80A6", soil: ["#2D3046", "#15162A"], strata: "#4A4E72",
    accent: "#FF4FB8", glow: "#4FF0FF",
    props: [["lamp", 2.5], ["cone", 2], ["barrier", 1.5], ["sign", 0.6], ["rock", 0.5]],
    landmarks: ["billboard", "crane"],
    times: ["dusk", "night", "night", "golden", "night"],
    weathers: ["clear", "rain", "clear", "fog"],
    terrain: T({ amp: 0.9, ramps: 1.8, gaps: 1, bridges: 1.4, steps: 1.1, whoops: 0.4, trend: 0.02 }),
    gravity: 10, grip: 1.05, ambience: ["city"],
  },
  {
    id: "jungle", name: "Jungle Falls", blurb: "Giant leaves, misty waterfalls and glowing fireflies.",
    sky: ["#3FA2D8", "#8FD3E8", "#E4FFF4"], sun: "#FFFBE0", haze: "#C8F0E4",
    ridges: [{ style: "canopy", color: "#5E9E8C", h: 0.62 }, { style: "canopy", color: "#2E8B57", h: 0.45 }, { style: "forest", color: "#1E6E45", h: 0.3 }],
    ground: "jungle", surface: "#3FB55A", surfaceHi: "#92E47C", soil: ["#5C4030", "#33231A"], strata: "#71503A",
    accent: "#3EE08F", glow: "#E7FF7A",
    props: [["fern", 3], ["bigleaf", 2.5], ["bloom", 2], ["palm", 1], ["rock", 1], ["mushroom", 0.8]],
    landmarks: ["totem"],
    times: ["morning", "day", "golden", "dusk", "night"],
    weathers: ["clear", "rain", "fog", "fireflies"],
    terrain: T({ amp: 1.1, bump: 1.2, bridges: 1.6, valleys: 1.1, steps: 0.7, trend: 0.02 }),
    gravity: 10, grip: 0.95, ambience: ["birds", "frogs"],
  },
  {
    id: "volcano", name: "Volcano Ridge", blurb: "Black basalt, lava rivers and showers of embers.",
    sky: ["#3A1F3D", "#A8423A", "#FF9A5A"], sun: "#FFD08A", haze: "#C85A44",
    ridges: [{ style: "volcano", color: "#5A2E3A", h: 0.8 }, { style: "peaks", color: "#3D2230", h: 0.45 }, { style: "rounded", color: "#2A1822", h: 0.26 }],
    ground: "ash", surface: "#4C3C41", surfaceHi: "#8F6C66", soil: ["#3A2C30", "#1E1518"], strata: "#FF6A2B",
    accent: "#FF5A2B", glow: "#FF8A2B",
    props: [["deadtree", 2], ["lavarock", 3], ["geyser", 1], ["obsidian", 2]],
    landmarks: ["geyser"],
    times: ["day", "dusk", "night", "golden"],
    weathers: ["embers", "embers", "clear", "fog"],
    terrain: T({ amp: 1.25, steep: 1.4, ramps: 1.3, gaps: 1.2, steps: 1.1, rocks: 1, trend: 0.05 }),
    gravity: 10, grip: 1, ambience: ["rumble"],
  },
  {
    id: "coast", name: "Coral Coast", blurb: "Sea cliffs, lighthouses and a sparkling ocean.",
    sky: ["#2E95E6", "#7CCBF5", "#E8FBFF"], sun: "#FFFBE8", haze: "#D3F2FF",
    ridges: [{ style: "sea", color: "#69BCD8", h: 0.3 }, { style: "rounded", color: "#53B07C", h: 0.3 }, { style: "rounded", color: "#C9A46A", h: 0.2 }],
    ground: "beach", surface: "#F2DDA4", surfaceHi: "#FFF2CC", soil: ["#D4A56A", "#A8743E"], strata: "#E6BE7E",
    accent: "#2FD4C9", glow: "#FFF6B0",
    props: [["palm", 3], ["umbrella", 1.2], ["shell", 1.5], ["crab", 1], ["rock", 2]],
    landmarks: ["lighthouse"],
    times: ["morning", "day", "golden", "dusk", "night"],
    weathers: ["clear", "breeze", "clear", "rain"],
    terrain: T({ amp: 0.95, whoops: 1.2, bridges: 1.2, gaps: 0.7, trend: 0.01 }),
    gravity: 10, grip: 0.92, ambience: ["gulls", "wind"],
  },
  {
    id: "autumn", name: "Amber Valley", blurb: "Maple forests, pumpkin farms and falling leaves.",
    sky: ["#4A8ED8", "#9CC3EA", "#FFE9C9"], sun: "#FFF1CE", haze: "#F2D9C2",
    ridges: [{ style: "rounded", color: "#B596B8", h: 0.55 }, { style: "forest", color: "#D9772E", h: 0.42 }, { style: "forest", color: "#B5532A", h: 0.28 }],
    ground: "leaf", surface: "#D3A44A", surfaceHi: "#F6CF72", soil: ["#7A4A2E", "#45281A"], strata: "#925C3A",
    accent: "#FF9F2E", glow: "#FFD27A",
    props: [["maple", 4], ["pumpkin", 2], ["hay", 1.2], ["fence", 1.5], ["mushroom", 1]],
    landmarks: ["barn", "scarecrow"],
    times: ["morning", "day", "golden", "golden", "dusk", "night"],
    weathers: ["leaves", "leaves", "clear", "rain", "fog"],
    terrain: T({ amp: 1.05, steps: 0.9, steep: 1, valleys: 0.9, trend: 0.03 }),
    gravity: 10, grip: 0.97, ambience: ["crows", "wind"],
  },
  {
    id: "caverns", name: "Crystal Caverns", blurb: "Deep caves lit by glowing crystals and mushrooms.",
    sky: ["#120B2E", "#25134A", "#3B1F66"], sun: "#C9A8FF", haze: "#3B2470",
    ridges: [{ style: "crystals", color: "#2A1A55", h: 0.6 }, { style: "crystals", color: "#1E1240", h: 0.45 }, { style: "rounded", color: "#160D30", h: 0.25 }],
    ground: "crystal", surface: "#5B4A8A", surfaceHi: "#AA96EA", soil: ["#3A2C66", "#1A1236"], strata: "#7A5CD6",
    accent: "#B57CFF", glow: "#7CF5FF",
    props: [["crystal", 3], ["stalagmite", 2.5], ["glowshroom", 2.5], ["lantern", 1], ["rock", 1]],
    landmarks: ["minecart"],
    times: ["night"],
    weathers: ["spores", "clear", "spores"],
    terrain: T({ amp: 1.15, steps: 1.2, ramps: 1.2, gaps: 1, bridges: 1.4, steep: 1.2, trend: -0.01 }),
    gravity: 10, grip: 1, ambience: ["drips"], enclosed: "cave",
  },
  {
    id: "crater", name: "Starfall Crater", blurb: "Low gravity, giant leaps and a sky full of stars.",
    sky: ["#03040D", "#0B1030", "#1C2457"], sun: "#FFFFFF", haze: "#2A3160",
    ridges: [{ style: "craters", color: "#3B3F5A", h: 0.45 }, { style: "craters", color: "#2C2F45", h: 0.32 }, { style: "craters", color: "#222436", h: 0.2 }],
    ground: "dust", surface: "#A9ABBA", surfaceHi: "#E6E8F2", soil: ["#7C7F92", "#3E4052"], strata: "#9598AB",
    accent: "#8FB8FF", glow: "#8FB8FF",
    props: [["moonrock", 4], ["dish", 0.8], ["planetflag", 0.6], ["rock", 1]],
    landmarks: ["antenna"],
    times: ["night"],
    weathers: ["clear", "meteors"],
    terrain: T({ amp: 1.2, ramps: 1.6, gaps: 1.4, whoops: 0.8, steep: 0.9, trend: 0.01 }),
    gravity: 4.4, grip: 1, ambience: ["beeps"], enclosed: "space",
  },
];
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
export const STAGES_PER_WORLD = 50;
export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD; // 600
