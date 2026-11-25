// Tumble Truck's twelve worlds. Each has its own load to deliver, its own painted backdrop (three layers drawn by
// src/haul/art/backdrop.ts), ground, roadside props, animals, weather, music, ambience and road character — mud in the
// bayou, fords in the orchard, ice in the snow, wind on the cliffs, low gravity on the moon. The time of day and the
// weather change from stage to stage, and the colours are graded to match (src/haul/art/grade.ts).
import type { CargoKind } from "./cargo";

export type WorldId =
  | "pinewood" | "orchard" | "bayou" | "honey" | "henhill" | "redrock"
  | "glowcap" | "timber" | "frost" | "blossom" | "ember" | "starfall";
export type TimeOfDay = "morning" | "day" | "golden" | "dusk" | "night";
export type Weather =
  | "clear" | "breeze" | "rain" | "snow" | "fog" | "dust" | "leaves" | "petals" | "embers" | "fireflies" | "spores" | "pollen" | "stars";
export type Ground = "forest" | "grass" | "mud" | "meadow" | "farm" | "sand" | "moss" | "dirt" | "snow" | "terrace" | "ash" | "moon";
export type PropKind =
  | "pine" | "fir" | "fern" | "stump" | "toadstool" | "rock" | "cabin" | "tower"
  | "appletree" | "bush" | "fence" | "hay" | "basket" | "farmhouse" | "windmill"
  | "cypress" | "reeds" | "shack" | "post"
  | "sunflower" | "lavender" | "hive" | "daisy" | "honeymill"
  | "coop" | "barn" | "silo" | "pumpkin" | "scarecrow"
  | "cactus" | "saguaro" | "tumbleweed" | "hoodoo" | "arch" | "watertower"
  | "glowshroom" | "bigshroom" | "shroomhouse"
  | "logpile" | "sawmill"
  | "snowpine" | "snowman" | "lamp" | "cottage" | "belltower"
  | "cherry" | "bamboo" | "stonelamp" | "pagoda"
  | "deadtree" | "lavarock" | "vent" | "forge"
  | "moonrock" | "antenna" | "dish" | "dome" | "crystal";
export type AnimalKind = "deer" | "bird" | "rabbit" | "sheep" | "chicken" | "frog" | "duck" | "fox" | "bee" | "crane" | "firefly" | "critter";
export type Ambient = "birds" | "owl" | "frogs" | "crickets" | "wind" | "stream" | "bees" | "hens" | "sheep" | "hawk" | "chimes" | "bells" | "saw" | "lava" | "beeps" | "crows" | "ducks";

export interface RoadStyle {
  /** hills and bumps (multipliers) */
  amp: number; bump: number;
  /** how often each feature shows up */
  ramps: number; gaps: number; bridges: number; steps: number; whoops: number; steep: number; valleys: number; rocks: number;
  logs: number; mud: number; fords: number; ice: number; wind: number; crests: number;
  /** a gentle overall climb (+) or descent (−) per metre */
  trend: number;
}

export interface World {
  id: WorldId;
  name: string;
  blurb: string;
  /** the load and where it goes */
  cargo: CargoKind;
  depot: string;
  from: string[];
  /** day colours: sky top / middle / horizon, sun, haze; backdrop far / mid / near */
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
  amp: 1, bump: 1, ramps: 0.5, gaps: 0.25, bridges: 0.5, steps: 0.5, whoops: 0.8, steep: 0.7, valleys: 0.6, rocks: 0.5,
  logs: 0.5, mud: 0.3, fords: 0.25, ice: 0, wind: 0.15, crests: 0.7, trend: 0.015, ...o,
});

export const STAGES_PER_WORLD = 50;

export const WORLDS: World[] = [
  {
    id: "pinewood", name: "Pinewood Hollow", blurb: "Misty pine woods, ferns and rope bridges.",
    cargo: "crate", depot: "Hollow Trading Post", from: ["the Ranger Hut", "Fern Hill", "Old Mossy Mill", "Owl Creek", "Pinecone Camp"],
    sky: ["#5DA9E9", "#9ED2F2", "#E6F6F0"], sun: "#FFF6D2", haze: "#CFE8E4",
    layers: ["#7FA6B8", "#3F7F6A", "#245A48"],
    ground: "forest", surface: "#5FAE4E", surfaceHi: "#A8E07A", soil: ["#7A5136", "#47301F"], strata: "#9A6C48",
    accent: "#6FD36A", glow: "#FFE9A0",
    props: [["pine", 4], ["fir", 2], ["fern", 3], ["stump", 1.2], ["toadstool", 1], ["rock", 1.2]],
    landmarks: ["cabin", "tower"], animals: ["deer", "bird", "rabbit"],
    times: ["morning", "day", "day", "golden", "dusk", "night"], weathers: ["clear", "clear", "fog", "breeze", "rain"],
    road: R({ amp: 0.8, bump: 0.8, logs: 1.0, bridges: 0.8, mud: 0.25, gaps: 0.1, ramps: 0.35 }),
    gravity: 10, grip: 1, ambience: ["birds", "owl", "stream"],
  },
  {
    id: "orchard", name: "Orchard Valley", blurb: "Fruit trees, farm ponds and patchwork hills.",
    cargo: "melon", depot: "Valley Fruit Market", from: ["Applecross Farm", "Pear Tree Lane", "Plum Pond", "Sunny Rows", "Cider Barn"],
    sky: ["#4C9BF0", "#8FCBFF", "#FFF0D6"], sun: "#FFF2C0", haze: "#E2EEDC",
    layers: ["#9BC07A", "#5FA24E", "#3E8A3A"],
    ground: "grass", surface: "#78C850", surfaceHi: "#C8F07A", soil: ["#8C5B3B", "#563523"], strata: "#A8764E",
    accent: "#FF8A3D", glow: "#FFE27A",
    props: [["appletree", 4], ["bush", 2.5], ["fence", 2], ["hay", 1.2], ["basket", 0.8], ["rock", 0.6]],
    landmarks: ["farmhouse", "windmill"], animals: ["sheep", "bird", "rabbit"],
    times: ["morning", "day", "day", "golden", "dusk"], weathers: ["clear", "clear", "breeze", "pollen", "rain"],
    road: R({ amp: 0.75, bump: 0.75, fords: 0.8, crests: 0.9, logs: 0.3, mud: 0.2 }),
    gravity: 10, grip: 1, ambience: ["birds", "sheep", "wind"],
  },
  {
    id: "bayou", name: "Mudwater Bayou", blurb: "Cypress swamps, deep mud and water crossings.",
    cargo: "barrel", depot: "Stilt Town Dock", from: ["Gator Point", "Mossy Landing", "Heron Bend", "Lantern Shack", "Reedy Pass"],
    sky: ["#6E9FB8", "#A9C9C2", "#E9E6C4"], sun: "#FFF0B8", haze: "#C9D8C0",
    layers: ["#8EA39A", "#4F6E5A", "#2F4A3A"],
    ground: "mud", surface: "#6E8F45", surfaceHi: "#A6C46A", soil: ["#5E4630", "#33261A"], strata: "#7A5E40",
    accent: "#B5D33A", glow: "#FFE27A",
    props: [["cypress", 4], ["reeds", 4], ["post", 1.4], ["stump", 1], ["rock", 0.6]],
    landmarks: ["shack"], animals: ["frog", "duck", "bird"],
    times: ["morning", "day", "golden", "dusk", "night"], weathers: ["fog", "fog", "clear", "rain", "fireflies"],
    road: R({ amp: 0.6, bump: 0.9, mud: 1.3, fords: 1.2, bridges: 0.7, logs: 0.6, ramps: 0.25, gaps: 0.1, steep: 0.4 }),
    gravity: 10, grip: 0.95, ambience: ["frogs", "crickets", "ducks"],
  },
  {
    id: "honey", name: "Honeybloom Meadows", blurb: "Sunflowers, lavender and humming hives.",
    cargo: "jar", depot: "Honeycomb Mill", from: ["Hive Row", "Lavender Lane", "Clover Hill", "Bumble Farm", "Sunflower Gate"],
    sky: ["#5AA8F5", "#A3D4FF", "#FFF3D1"], sun: "#FFF4C2", haze: "#F3E6D9",
    layers: ["#B7A6D9", "#8FBF5A", "#5E9E3E"],
    ground: "meadow", surface: "#8ACB4E", surfaceHi: "#D8F27A", soil: ["#8A5A36", "#4F3220"], strata: "#B07A4A",
    accent: "#FFB627", glow: "#FFD86B",
    props: [["sunflower", 3.5], ["lavender", 3], ["daisy", 3], ["hive", 1.2], ["bush", 1.2], ["fence", 0.8]],
    landmarks: ["honeymill", "windmill"], animals: ["bee", "rabbit", "bird"],
    times: ["morning", "day", "day", "golden", "dusk"], weathers: ["clear", "pollen", "breeze", "pollen", "clear"],
    road: R({ amp: 0.7, bump: 0.85, whoops: 1.1, wind: 0.5, gaps: 0.06, ramps: 0.3, rocks: 0.4 }),
    gravity: 10, grip: 1, ambience: ["bees", "birds", "wind"],
  },
  {
    id: "henhill", name: "Hen Hill Farm", blurb: "Red barns, haystacks and eggs that crack.",
    cargo: "egg", depot: "Hen Hill Bakery", from: ["the Big Coop", "Haystack Row", "Silo Corner", "Pumpkin Patch", "Duck Pond"],
    sky: ["#58A2EE", "#98CDF8", "#FFE9C9"], sun: "#FFF0BE", haze: "#EFE4CF",
    layers: ["#93B98C", "#C8B26A", "#7FAF4E"],
    ground: "farm", surface: "#8CC152", surfaceHi: "#D6EC84", soil: ["#8F5E3A", "#553722"], strata: "#B3804F",
    accent: "#FF5A4E", glow: "#FFE08A",
    props: [["fence", 3], ["hay", 2.5], ["pumpkin", 1.5], ["scarecrow", 0.8], ["coop", 1], ["bush", 1.5]],
    landmarks: ["barn", "silo"], animals: ["chicken", "sheep", "duck"],
    times: ["morning", "day", "golden", "dusk", "day"], weathers: ["clear", "clear", "breeze", "leaves", "rain"],
    road: R({ amp: 0.65, bump: 0.8, mud: 0.6, fords: 0.4, steps: 0.4, gaps: 0.05, ramps: 0.25 }),
    gravity: 10, grip: 1, ambience: ["hens", "birds", "sheep"],
  },
  {
    id: "redrock", name: "Redrock Canyon", blurb: "Mesas, arches, rope bridges and desert wind.",
    cargo: "vase", depot: "Canyon Pottery", from: ["Mesa Kiln", "Arch Rock", "Dusty Well", "Sunset Ranch", "Coyote Gap"],
    sky: ["#3E8EDB", "#8FC3EC", "#FFE0B0"], sun: "#FFE7A8", haze: "#F3CDA6",
    layers: ["#D79A7A", "#C0603C", "#8E3F24"],
    ground: "sand", surface: "#E0A15F", surfaceHi: "#FFD59A", soil: ["#B8613A", "#6E3520"], strata: "#D9875A",
    accent: "#FF7A45", glow: "#FFD27A",
    props: [["cactus", 3], ["saguaro", 2], ["rock", 2], ["tumbleweed", 1], ["hoodoo", 1.2]],
    landmarks: ["arch", "watertower"], animals: ["rabbit", "bird"],
    times: ["morning", "day", "golden", "golden", "dusk", "night"], weathers: ["clear", "dust", "clear", "breeze"],
    road: R({ amp: 0.9, bump: 0.85, bridges: 1.1, gaps: 0.4, wind: 0.7, steep: 0.7, rocks: 0.8, ramps: 0.4, logs: 0 }),
    gravity: 10, grip: 1, ambience: ["hawk", "wind"],
  },
  {
    id: "glowcap", name: "Glowcap Grove", blurb: "A night forest of giant glowing mushrooms.",
    cargo: "potion", depot: "Mossy Apothecary", from: ["Spore Hollow", "Moonpool", "Lantern Roots", "Toadstool Ring", "Blue Hollow"],
    sky: ["#1A1846", "#3A2C7A", "#7A54B0"], sun: "#E9E2FF", haze: "#5E4A9A",
    layers: ["#4A3A8C", "#2E2766", "#1C1A44"],
    ground: "moss", surface: "#4FAF8A", surfaceHi: "#9AF0C8", soil: ["#3E2E5C", "#221838"], strata: "#6A4E9A",
    accent: "#B46CFF", glow: "#7CF5E0",
    props: [["glowshroom", 4], ["bigshroom", 1.6], ["fern", 2.5], ["toadstool", 2], ["rock", 0.8]],
    landmarks: ["shroomhouse"], animals: ["firefly", "frog", "rabbit"],
    times: ["night", "night", "dusk", "night"], weathers: ["spores", "fireflies", "fog", "spores"],
    road: R({ amp: 0.85, bump: 1.0, steps: 0.7, rocks: 0.6, logs: 0.6, gaps: 0.12, ramps: 0.35, mud: 0.3 }),
    gravity: 10, grip: 1, ambience: ["crickets", "owl", "chimes"],
  },
  {
    id: "timber", name: "Timber Ridge", blurb: "Steep logging roads above the sawmill.",
    cargo: "log", depot: "Ridge Sawmill", from: ["Lumber Camp", "High Pines", "Beaver Dam", "Axe Hill", "Cold Spring"],
    sky: ["#4F8FD8", "#9CC8EC", "#EAF2F4"], sun: "#FFF6DA", haze: "#D7E5EC",
    layers: ["#9FB4C9", "#4E7A62", "#2E5442"],
    ground: "dirt", surface: "#6E9E48", surfaceHi: "#B5D879", soil: ["#7E5538", "#4A3121"], strata: "#A07250",
    accent: "#FFA94D", glow: "#FFE3A0",
    props: [["pine", 4], ["logpile", 1.4], ["stump", 2], ["fir", 2], ["rock", 1.2], ["fern", 1]],
    landmarks: ["sawmill", "tower"], animals: ["deer", "fox", "bird"],
    times: ["morning", "day", "golden", "dusk", "day"], weathers: ["clear", "breeze", "fog", "rain"],
    road: R({ amp: 1.15, bump: 0.9, steep: 1.3, logs: 1.0, bridges: 0.6, valleys: 0.8, gaps: 0.2, trend: 0.03 }),
    gravity: 10, grip: 1, ambience: ["birds", "saw", "stream"],
  },
  {
    id: "frost", name: "Frostbell Village", blurb: "Snowy lanes, icy bends and twinkling cottages.",
    cargo: "gift", depot: "Frostbell Square", from: ["Snowdrift Inn", "Icicle Lane", "Bell Hill", "Pine Lodge", "Starry Pond"],
    sky: ["#5E8FD0", "#A9C8EC", "#F0F6FF"], sun: "#FFFFFF", haze: "#DCE8F7",
    layers: ["#B9CBE6", "#7E9CC4", "#4F6E9A"],
    ground: "snow", surface: "#F4F9FF", surfaceHi: "#FFFFFF", soil: ["#8FA2BF", "#56688A"], strata: "#B7C6DE",
    accent: "#5BC8FF", glow: "#FFE7A0",
    props: [["snowpine", 4], ["snowman", 1], ["lamp", 1.5], ["rock", 0.6], ["fence", 0.8]],
    landmarks: ["cottage", "belltower"], animals: ["fox", "bird", "rabbit"],
    times: ["morning", "day", "golden", "dusk", "night", "night"], weathers: ["snow", "snow", "clear", "clear", "fog"],
    road: R({ amp: 0.85, bump: 0.8, ice: 1.2, mud: 0, fords: 0, steep: 0.6, gaps: 0.12, ramps: 0.35 }),
    gravity: 10, grip: 0.9, ambience: ["bells", "wind", "owl"],
  },
  {
    id: "blossom", name: "Blossom Terraces", blurb: "Cherry trees, tea terraces and paper lanterns.",
    cargo: "lantern", depot: "Lantern Teahouse", from: ["Tea Steps", "Koi Pond", "Bamboo Path", "Misty Gate", "Petal Bridge"],
    sky: ["#6FA6EA", "#C2D6F2", "#FFE6E9"], sun: "#FFF2E4", haze: "#F2DDE4",
    layers: ["#B8B6D6", "#8FB98A", "#5E9468"],
    ground: "terrace", surface: "#86C26A", surfaceHi: "#C8EC9A", soil: ["#8C6248", "#54392A"], strata: "#B58A68",
    accent: "#FF7BAC", glow: "#FFD2A0",
    props: [["cherry", 4], ["bamboo", 2.5], ["stonelamp", 1.2], ["bush", 1.5], ["rock", 1]],
    landmarks: ["pagoda"], animals: ["crane", "rabbit", "bird"],
    times: ["morning", "day", "golden", "dusk", "night"], weathers: ["petals", "petals", "clear", "fog", "breeze"],
    road: R({ amp: 0.85, bump: 0.8, steps: 1.2, bridges: 0.8, wind: 0.8, fords: 0.5, gaps: 0.08, ramps: 0.3 }),
    gravity: 10, grip: 1, ambience: ["chimes", "birds", "stream"],
  },
  {
    id: "ember", name: "Ember Peaks", blurb: "Black rock, lava rivers and smoking craters.",
    cargo: "crystal", depot: "Ember Forge", from: ["Ash Camp", "Cinder Cone", "Magma Falls", "Obsidian Gate", "Smoky Pass"],
    sky: ["#2A1E3A", "#7A3A3A", "#E87A4A"], sun: "#FFC48A", haze: "#9A4E44",
    layers: ["#6E3A44", "#3A2330", "#22161E"],
    ground: "ash", surface: "#4A3E44", surfaceHi: "#8A7072", soil: ["#2E2228", "#170F14"], strata: "#FF7A3A",
    accent: "#FF6A3A", glow: "#FFB03A",
    props: [["deadtree", 2.5], ["lavarock", 3], ["vent", 1.4], ["rock", 1.5]],
    landmarks: ["forge"], animals: ["bird"],
    times: ["dusk", "night", "golden", "night"], weathers: ["embers", "embers", "dust", "clear"],
    road: R({ amp: 1.1, bump: 1.0, gaps: 0.55, rocks: 1.0, steep: 1.0, bridges: 0.6, ramps: 0.45, logs: 0, mud: 0, fords: 0 }),
    gravity: 10, grip: 1, ambience: ["lava", "wind", "crows"],
  },
  {
    id: "starfall", name: "Starfall Moon", blurb: "Low-gravity craters under a sky of planets.",
    cargo: "orb", depot: "Moonbase Dome", from: ["Crater Camp", "Comet Ridge", "Dish Hill", "Silver Sea", "Rocket Yard"],
    sky: ["#05061A", "#101848", "#283A7A"], sun: "#F4F1FF", haze: "#3A4A8A",
    layers: ["#4A5288", "#2E3466", "#1C2044"],
    ground: "moon", surface: "#B8BCD0", surfaceHi: "#EEF0FA", soil: ["#6A6E88", "#3A3D52"], strata: "#8E92AE",
    accent: "#7CE7FF", glow: "#B9A6FF",
    props: [["moonrock", 3], ["crystal", 2], ["antenna", 1], ["dish", 1], ["rock", 1]],
    landmarks: ["dome"], animals: ["critter"],
    times: ["night"], weathers: ["stars", "stars", "clear"],
    road: R({ amp: 0.85, bump: 0.55, gaps: 0.4, ramps: 0.25, crests: 0.6, rocks: 0.7, logs: 0, mud: 0, fords: 0, wind: 0 }),
    gravity: 5.6, grip: 0.95, ambience: ["beeps"], space: true,
  },
];

export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD;
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
