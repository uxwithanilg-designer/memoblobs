// Rumble Rally's twelve worlds. Each has its own painted backdrop (src/rumble/art/backdrop.ts), ground, roadside
// props, animals, weather, music, ambience and road character — dunes and temple steps, ruins under a smoking volcano,
// ice shelves at a polar station, a neon container port at night, jungle waterfalls, a scrapyard arena, a beach
// boardwalk, a gold mine's trestles, storm peaks with lightning, candy hills, the red planet and sky islands. The time
// of day and the weather change from stage to stage and the colours are graded to match (src/rumble/art/grade.ts).

export type WorldId =
  | "dunes" | "cinder" | "polar" | "harbor" | "canopy" | "scrap"
  | "boardwalk" | "goldmine" | "thunder" | "candy" | "mars" | "cloud";
export type TimeOfDay = "morning" | "day" | "golden" | "dusk" | "night";
export type Weather =
  | "clear" | "breeze" | "rain" | "snow" | "fog" | "dust" | "leaves" | "petals" | "embers" | "fireflies" | "spores" | "pollen" | "stars";
export type Ground = "sand" | "ash" | "snow" | "asphalt" | "grass" | "gravel" | "candy" | "moon";
export type PropKind =
  | "palm" | "obelisk" | "urn" | "tent" | "pyramid" | "statue"
  | "column" | "ruinarch" | "amphora" | "spire" | "rubble" | "temple"
  | "iceblock" | "flagpole" | "mast" | "crate" | "iceberg" | "station"
  | "lamp" | "container" | "bollard" | "neon" | "crane" | "lighthouse"
  | "fern" | "bigleaf" | "idol" | "vinepost" | "jungletemple"
  | "tires" | "wreck" | "drum" | "cone" | "crusher" | "magnet"
  | "umbrella" | "surfboard" | "bench" | "lifeguard" | "ferris"
  | "minecart" | "lantern" | "timber" | "headframe"
  | "pine" | "rock" | "deadtree" | "rod" | "weather"
  | "lollipop" | "cane" | "gumdrop" | "cupcake" | "candyhouse"
  | "redrock" | "crystal" | "antenna" | "dish" | "dome" | "rocket"
  | "bush" | "tree" | "windvane" | "keep" | "windmill";
export type AnimalKind = "bird" | "rabbit" | "critter" | "penguin" | "crab" | "monkey" | "camel" | "goat";
export type Ambient = "wind" | "gulls" | "crows" | "birds" | "parrots" | "waves" | "machines" | "horns" | "drips" | "thunder" | "chimes" | "beeps" | "lava" | "bells";

export interface RoadStyle {
  amp: number; bump: number;
  ramps: number; gaps: number; bridges: number; steps: number; whoops: number; steep: number; valleys: number; rocks: number;
  logs: number; mud: number; fords: number; ice: number; wind: number; crests: number;
  trend: number;
}

export interface World {
  id: WorldId;
  name: string;
  blurb: string;
  /** the rival crew you race here and the trophy */
  cup: string;
  sky: [string, string, string];
  sun: string;
  haze: string;
  layers: [string, string, string];
  ground: Ground;
  surface: string; surfaceHi: string; soil: [string, string]; strata: string;
  accent: string; glow: string;
  props: [PropKind, number][];
  landmarks: PropKind[];
  animals: AnimalKind[];
  times: TimeOfDay[];
  weathers: Weather[];
  road: RoadStyle;
  gravity: number; grip: number;
  ambience: Ambient[];
  space?: boolean;
}

const R = (o: Partial<RoadStyle>): RoadStyle => ({
  amp: 1, bump: 1, ramps: 1.0, gaps: 0.5, bridges: 0.4, steps: 0.4, whoops: 0.8, steep: 0.7, valleys: 0.6, rocks: 0.5,
  logs: 0.3, mud: 0.2, fords: 0.15, ice: 0, wind: 0, crests: 0.9, trend: 0.012, ...o,
});

export const STAGES_PER_WORLD = 50;

export const WORLDS: World[] = [
  {
    id: "dunes", name: "Dune Temples", blurb: "Golden dunes, sun temples and stone giants.", cup: "Sunstone Cup",
    sky: ["#3E8EDB", "#8FC8F0", "#FFE7B8"], sun: "#FFF0C0", haze: "#F6D9A8",
    layers: ["#E3B06E", "#D59A55", "#B9783C"],
    ground: "sand", surface: "#E8B566", surfaceHi: "#FFE0A0", soil: ["#C98A48", "#8A5428"], strata: "#E3A866",
    accent: "#FFB627", glow: "#FFE08A",
    props: [["palm", 3], ["obelisk", 1.2], ["urn", 1.5], ["tent", 1], ["rock", 1.2]],
    landmarks: ["pyramid", "statue"], animals: ["camel", "bird"],
    times: ["morning", "day", "golden", "golden", "dusk", "night"], weathers: ["clear", "dust", "clear", "breeze"],
    road: R({ amp: 1.0, ramps: 1.2, gaps: 0.5, crests: 1.1, rocks: 0.6 }),
    gravity: 10, grip: 1, ambience: ["wind", "birds"],
  },
  {
    id: "cinder", name: "Cinder Ruins", blurb: "Old city ruins under a smoking volcano.", cup: "Ember Crown",
    sky: ["#4A3A5A", "#B0606A", "#F2A070"], sun: "#FFD2A0", haze: "#C88A7A",
    layers: ["#7A5A64", "#9A6A5A", "#6A4A44"],
    ground: "ash", surface: "#8A7470", surfaceHi: "#C8A898", soil: ["#5A4440", "#2E2224"], strata: "#FF8A3A",
    accent: "#FF6A3A", glow: "#FFB03A",
    props: [["column", 3], ["amphora", 1.5], ["rubble", 2], ["spire", 1.5], ["rock", 1]],
    landmarks: ["temple", "ruinarch"], animals: ["bird", "goat"],
    times: ["golden", "dusk", "day", "dusk", "night"], weathers: ["embers", "dust", "clear", "embers"],
    road: R({ amp: 1.1, steps: 0.9, rocks: 0.9, gaps: 0.7, ramps: 1.1 }),
    gravity: 10, grip: 1, ambience: ["lava", "crows", "wind"],
  },
  {
    id: "polar", name: "Polar Outpost", blurb: "Ice shelves, a research station and penguins.", cup: "Frostbite Trophy",
    sky: ["#5E8FD0", "#A9CCF0", "#EEF6FF"], sun: "#FFFFFF", haze: "#DCE8F7",
    layers: ["#C4D8F0", "#9AB8DE", "#6E92C0"],
    ground: "snow", surface: "#F2F8FF", surfaceHi: "#FFFFFF", soil: ["#9AB0CC", "#5E7698"], strata: "#C2D4EA",
    accent: "#5BC8FF", glow: "#BFF0FF",
    props: [["iceblock", 3], ["flagpole", 1], ["mast", 1], ["crate", 1.2], ["rock", 0.6]],
    landmarks: ["station", "iceberg"], animals: ["penguin", "bird"],
    times: ["morning", "day", "golden", "night", "night"], weathers: ["snow", "clear", "snow", "fog"],
    road: R({ amp: 0.9, ice: 1.1, ramps: 1.0, gaps: 0.4, bridges: 0.5 }),
    gravity: 10, grip: 0.92, ambience: ["wind", "beeps"],
  },
  {
    id: "harbor", name: "Neon Harbor", blurb: "Container stacks, cranes and neon at night.", cup: "Neon Night Cup",
    sky: ["#0E1236", "#2A2266", "#7A3A8A"], sun: "#F4E8FF", haze: "#5A3A7A",
    layers: ["#3A2E6A", "#2A2452", "#1E1A3A"],
    ground: "asphalt", surface: "#4A4E62", surfaceHi: "#8A90AA", soil: ["#2E3042", "#181A26"], strata: "#5BC8FF",
    accent: "#FF4FD8", glow: "#5BF0FF",
    props: [["lamp", 2], ["container", 2.5], ["bollard", 1.5], ["neon", 1.2], ["drum", 1]],
    landmarks: ["crane", "lighthouse"], animals: ["bird"],
    times: ["night", "night", "dusk", "night"], weathers: ["rain", "clear", "fog", "rain"],
    road: R({ amp: 0.8, ramps: 1.3, gaps: 0.6, crests: 1.0, steps: 0.6 }),
    gravity: 10, grip: 1, ambience: ["horns", "gulls", "waves"],
  },
  {
    id: "canopy", name: "Canopy Falls", blurb: "Jungle waterfalls, vines and stone idols.", cup: "Emerald Cup",
    sky: ["#4FA0E8", "#9AD6E8", "#E8F8E0"], sun: "#FFF6D0", haze: "#BCE8D2",
    layers: ["#6AAE8E", "#3E8A5A", "#24663E"],
    ground: "grass", surface: "#4FBE5A", surfaceHi: "#A8F07A", soil: ["#6E4A32", "#3E2A1C"], strata: "#8E6A48",
    accent: "#3EE08F", glow: "#FFE98A",
    props: [["fern", 3], ["bigleaf", 2.5], ["idol", 1], ["vinepost", 1.2], ["palm", 1.5]],
    landmarks: ["jungletemple"], animals: ["monkey", "bird"],
    times: ["morning", "day", "golden", "dusk", "day"], weathers: ["clear", "rain", "fog", "fireflies"],
    road: R({ amp: 1.0, bridges: 1.0, mud: 0.7, fords: 0.6, logs: 0.8, ramps: 1.0 }),
    gravity: 10, grip: 1, ambience: ["parrots", "birds", "drips"],
  },
  {
    id: "scrap", name: "Scrapyard Arena", blurb: "Junk heaps, crushers and a giant magnet crane.", cup: "Iron Jaw Cup",
    sky: ["#6A8AB0", "#B0BCC8", "#F0E0C8"], sun: "#FFEFC8", haze: "#D8C8B0",
    layers: ["#9A8E86", "#7A6E6A", "#56504E"],
    ground: "gravel", surface: "#8E7A62", surfaceHi: "#C8B08A", soil: ["#5E4E40", "#332A22"], strata: "#8A7A6A",
    accent: "#FF8A2A", glow: "#FFD27A",
    props: [["tires", 2.5], ["wreck", 2], ["drum", 2], ["cone", 1.2], ["rubble", 1]],
    landmarks: ["crusher", "magnet"], animals: ["bird"],
    times: ["day", "golden", "dusk", "day", "night"], weathers: ["dust", "clear", "rain"],
    road: R({ amp: 0.9, ramps: 1.4, gaps: 0.7, rocks: 0.8, steps: 0.7, crests: 1.1 }),
    gravity: 10, grip: 1, ambience: ["machines", "crows"],
  },
  {
    id: "boardwalk", name: "Sunset Boardwalk", blurb: "Beach dunes, a pier and a big wheel.", cup: "Seaside Cup",
    sky: ["#4C86D8", "#F0A07A", "#FFD898"], sun: "#FFE8B0", haze: "#F4CDB0",
    layers: ["#6EA8D8", "#E8C890", "#D8B070"],
    ground: "sand", surface: "#F0D090", surfaceHi: "#FFF0C0", soil: ["#D0A060", "#8A6030"], strata: "#E8C080",
    accent: "#FF6A8A", glow: "#FFE08A",
    props: [["palm", 3], ["umbrella", 2], ["surfboard", 1.5], ["bench", 1], ["drum", 0.5]],
    landmarks: ["ferris", "lifeguard"], animals: ["crab", "bird"],
    times: ["golden", "golden", "dusk", "day", "night"], weathers: ["clear", "breeze", "clear"],
    road: R({ amp: 0.8, ramps: 1.2, fords: 0.5, crests: 1.2, gaps: 0.4 }),
    gravity: 10, grip: 1, ambience: ["waves", "gulls", "chimes"],
  },
  {
    id: "goldmine", name: "Gold Rush Mine", blurb: "Timber trestles, ore carts and lantern light.", cup: "Nugget Cup",
    sky: ["#3E6AB0", "#C89A6A", "#F8D8A0"], sun: "#FFE0A0", haze: "#D8B890",
    layers: ["#B08A68", "#8A6448", "#5E422E"],
    ground: "gravel", surface: "#B08058", surfaceHi: "#E0B888", soil: ["#7A5236", "#46301E"], strata: "#E8C040",
    accent: "#FFC93D", glow: "#FFD27A",
    props: [["minecart", 1.5], ["lantern", 2], ["timber", 2], ["rock", 2], ["drum", 0.8]],
    landmarks: ["headframe"], animals: ["bird"],
    times: ["golden", "dusk", "day", "night"], weathers: ["dust", "clear", "clear"],
    road: R({ amp: 1.1, bridges: 1.1, steep: 1.0, gaps: 0.6, steps: 0.8, ramps: 1.0 }),
    gravity: 10, grip: 1, ambience: ["drips", "machines", "bells"],
  },
  {
    id: "thunder", name: "Thunder Peaks", blurb: "Storm clouds, lightning and high passes.", cup: "Storm Cup",
    sky: ["#2A3450", "#566480", "#9AA6BC"], sun: "#E8F0FF", haze: "#8A96AE",
    layers: ["#6A7890", "#4A566E", "#303A4E"],
    ground: "grass", surface: "#5E8A5A", surfaceHi: "#9AC08A", soil: ["#5A4A40", "#2E2620"], strata: "#7A6A5A",
    accent: "#9AD0FF", glow: "#E8F4FF",
    props: [["pine", 3], ["rock", 2], ["deadtree", 1.5], ["rod", 1]],
    landmarks: ["weather"], animals: ["goat", "bird"],
    times: ["dusk", "day", "night", "dusk"], weathers: ["rain", "rain", "fog", "clear"],
    road: R({ amp: 1.25, steep: 1.2, valleys: 0.9, gaps: 0.6, wind: 0.8, ramps: 1.0, trend: 0.025 }),
    gravity: 10, grip: 0.97, ambience: ["thunder", "wind"],
  },
  {
    id: "candy", name: "Candy Canyon", blurb: "Gumdrop hills, lollipop trees and cupcake houses.", cup: "Sugar Rush Cup",
    sky: ["#7AB8F8", "#F8C8E8", "#FFF0F8"], sun: "#FFF8E0", haze: "#F8D8EC",
    layers: ["#E8A8D8", "#B8E0A0", "#F0B0C8"],
    ground: "candy", surface: "#FF9ACB", surfaceHi: "#FFD6EA", soil: ["#A8603E", "#6A3820"], strata: "#FFE0F0",
    accent: "#FF6AB8", glow: "#FFF0A0",
    props: [["lollipop", 3], ["cane", 2], ["gumdrop", 2.5], ["cupcake", 1.2]],
    landmarks: ["candyhouse"], animals: ["rabbit", "bird"],
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "petals", "pollen", "clear"],
    road: R({ amp: 0.9, whoops: 1.2, ramps: 1.3, crests: 1.2, gaps: 0.5 }),
    gravity: 10, grip: 1, ambience: ["chimes", "birds"],
  },
  {
    id: "mars", name: "Red Planet", blurb: "Rust-red dunes, domes and launch towers.", cup: "Red Dust Cup",
    sky: ["#3A1E2E", "#A8524A", "#E8A070"], sun: "#FFE8C8", haze: "#C8786A",
    layers: ["#B06A58", "#8E4A3E", "#62322C"],
    ground: "moon", surface: "#C8705A", surfaceHi: "#F0A888", soil: ["#8A4436", "#4E2420"], strata: "#D88A6A",
    accent: "#FF7A4A", glow: "#9AF0FF",
    props: [["redrock", 3], ["crystal", 1.5], ["antenna", 1], ["dish", 1]],
    landmarks: ["dome", "rocket"], animals: ["critter"],
    times: ["day", "dusk", "golden", "night"], weathers: ["dust", "clear", "stars"],
    road: R({ amp: 1.0, gaps: 0.5, ramps: 1.0, crests: 1.0, rocks: 0.8, logs: 0, mud: 0, fords: 0 }),
    gravity: 7.4, grip: 0.95, ambience: ["beeps", "wind"], space: true,
  },
  {
    id: "cloud", name: "Cloud Isles", blurb: "Floating islands, airships and sky bridges.", cup: "Sky Crown",
    sky: ["#4A9AF8", "#9AD0FF", "#F0F8FF"], sun: "#FFFBE8", haze: "#D8ECFF",
    layers: ["#B8D8F8", "#8ACB8A", "#5EAE6A"],
    ground: "grass", surface: "#6CD06A", surfaceHi: "#C0F890", soil: ["#8A6A50", "#56402E"], strata: "#A88A68",
    accent: "#7CE7FF", glow: "#FFF0B0",
    props: [["bush", 3], ["tree", 3], ["windvane", 1], ["lamp", 0.8]],
    landmarks: ["keep", "windmill"], animals: ["bird", "rabbit"],
    times: ["morning", "day", "golden", "dusk", "night"], weathers: ["clear", "breeze", "petals", "clear"],
    road: R({ amp: 1.0, bridges: 1.2, gaps: 0.8, ramps: 1.2, wind: 0.6 }),
    gravity: 10, grip: 1, ambience: ["wind", "chimes", "birds"],
  },
];

export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD;
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
