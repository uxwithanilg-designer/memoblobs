// Nitro Rush worlds. Each theme = sky, light, fog, ground, road surface, barriers, scenery props, backdrop,
// water, overhead structures, lamps, weather and music. Later worlds are twistier and hillier (harder).
import type { ThemeSpec } from "../types";

export type RoadKind = "asphalt" | "wet" | "dirt" | "snow" | "neon" | "brick" | "sand" | "ice" | "rainbow" | "cobble" | "grid" | "basalt" | "metal" | "regolith" | "candy" | "stone" | "glass";
export type BarrierKind = "rail" | "concrete" | "tires" | "neon" | "fence" | "rocks" | "ice" | "candy" | "hedge" | "wood" | "stone" | "glass" | "snowbank" | "iron" | "bamboo" | "hay";
export type BackdropKind = "hills" | "forest" | "pines" | "jungle" | "mountains" | "alps" | "fjord" | "kilimanjaro" | "fuji" | "volcano" | "temples" | "mesas" | "dunes" | "pyramids" | "city" | "town" | "islands" | "ice" | "candy" | "craters" | "clouds" | "mushrooms" | "grid" | "coral" | "cliffs";
export type OverheadKind = "gantry" | "torii" | "neon" | "candy" | "rainbow" | "ice" | "stone" | "lanterns" | "bunting" | "vines" | "bridge" | "girder" | "ranch" | "iron";
export type TunnelKind = "rock" | "concrete" | "ice" | "glass" | "gallery" | "neon";
export type LampKind = "street" | "lantern" | "torch" | "flood" | "neon";
export type GroundDetail = "grass" | "moss" | "sand" | "dust" | "snow" | "rock" | "dirt" | "grid" | "candy" | "none";

export interface PropSpec { kind: string; density: number; tint?: string[] }
/** one ring of distant silhouettes; `height` in metres (at ~2 km) */
export interface BackdropLayer { kind: BackdropKind; color: string; height: number; snow?: boolean; glow?: string }

export interface ThemeLook {
  /** sky gradient top / horizon / bottom */
  sky: [string, string, string];
  sun: { color: string; dir: [number, number, number]; intensity: number; glow: number };
  /** fog near/far (m), colour = horizon */
  fog: [number, number];
  /** hemisphere light sky / ground colour and intensity */
  hemi: [string, string, number];
  ground: {
    colors: string[]; hills: number; mountain: string; snowCaps?: boolean;
    detail?: GroundDetail; verge?: string; rock?: string; ridged?: boolean; dunes?: boolean;
    /** patchwork field colours (farms, lavender) */
    fields?: string[];
  };
  road: { kind: RoadKind; color: string; line: string; edge: string; centre?: "dash" | "solid" | "double" | "none" };
  curb: [string, string];
  /** where kerbs are painted: on corners (default), all the way round, or nowhere */
  curbs?: "corners" | "full" | "none";
  shoulder: string;
  barrier: { kind: BarrierKind; color: string };
  props: PropSpec[];
  stars?: boolean;
  clouds?: number;
  cloudColor?: string;
  milkyWay?: boolean;
  moon?: boolean;
  planet?: { color: string; color2: string; size: number; dir: [number, number, number]; ring?: boolean };
  aurora?: [string, string];
  backdrop?: BackdropLayer[];
  water?: { color: string; deep: string; mode: "coast" | "lake"; shore?: string; frozen?: boolean };
  overhead?: { kind: OverheadKind; every: number; color?: string; color2?: string };
  tunnels?: { kind: TunnelKind; count: number; length: number; color?: string };
  lamps?: { kind: LampKind; color: string; every: number };
  grass?: { colors: string[]; density: number; flowers?: string[]; height?: number; glow?: boolean };
  /** extra ambient particles independent of weather */
  ambient?: "bubbles" | "embers" | "sparkles" | "dust" | "fireflies";
  /** weather particle colours (leaves / petals) */
  particles?: string[];
  /** road floats above a sea of clouds */
  floating?: boolean;
  underwater?: boolean;
  /** colour of god rays falling through canopy / water */
  shafts?: string;
  /** overrides when the player forces night on a day world, or day on a night world */
  night?: Partial<ThemeLook>;
  day?: Partial<ThemeLook>;
}

const look = (l: ThemeLook) => l as unknown as Record<string, unknown>;
const GREENS = ["#4E9A2E", "#5DAA36", "#3F8A2A", "#6FB83F", "#4C8F38"];

export const THEMES: ThemeSpec[] = [
  // ------------------------------------------------------------------ 0
  {
    id: "sunny-circuit", name: "Sunny Circuit", emoji: "☀️", blurb: "Green hills, blue skies and a classic grand prix track.", order: 0,
    night: false, weather: "clear", music: "rock", accent: "#3B82F6",
    track: { width: 16, curviness: 0.3, hills: 0.3, size: 0.9 }, hazards: ["cones", "oil"],
    look: look({
      sky: ["#2C74DB", "#B7DCF7", "#DCEBF5"], sun: { color: "#FFF3D6", dir: [0.45, 0.75, 0.35], intensity: 2.7, glow: 0.7 }, fog: [300, 1800],
      hemi: ["#CFE6FF", "#5C7F3C", 1.0],
      ground: { colors: ["#5DA03A", "#6AAE42", "#4F9132", "#78B84C"], hills: 0.55, mountain: "#5F7E57", detail: "grass", verge: "#62A83E", rock: "#7D7A70" },
      road: { kind: "asphalt", color: "#3B3E45", line: "#F4F1E6", edge: "#F4F1E6" }, curb: ["#E0403F", "#F4F1E6"], curbs: "corners", shoulder: "#A89F88",
      barrier: { kind: "rail", color: "#C9CED6" },
      props: [{ kind: "tree", density: 1, tint: GREENS }, { kind: "pine", density: 0.4 }, { kind: "grandstand", density: 0.35 }, { kind: "billboard", density: 0.5 }, { kind: "tyres", density: 0.6 }, { kind: "chevron", density: 0.8 }, { kind: "bush", density: 0.6 }, { kind: "flags", density: 0.5 }, { kind: "floodlight", density: 0.25 }, { kind: "grove", density: 0.6 }],
      backdrop: [{ kind: "mountains", color: "#7F9BB5", height: 380, snow: true }, { kind: "hills", color: "#6F9A5E", height: 140 }],
      clouds: 0.5, overhead: { kind: "gantry", every: 650 },
      grass: { colors: ["#5DA03A", "#6FB84A", "#7FC456"], density: 1, flowers: ["#FFFFFF", "#FFD84A", "#E84A8A"] },
    }),
  },
  // ------------------------------------------------------------------ 1
  {
    id: "neon-city", name: "Neon City", emoji: "🌃", blurb: "Glowing skyscrapers and wet streets at midnight.", order: 1,
    night: true, weather: "clear", music: "synthwave", accent: "#FF4FD8",
    track: { width: 15.5, curviness: 0.4, hills: 0.12, size: 0.88 }, hazards: ["cones", "puddle"],
    look: look({
      sky: ["#070316", "#2A0F4A", "#120726"], sun: { color: "#B48CFF", dir: [-0.3, 0.6, -0.4], intensity: 0.6, glow: 0.25 }, fog: [150, 1100],
      hemi: ["#4B3A90", "#120A24", 0.8],
      ground: { colors: ["#17142A", "#1C1833", "#141026"], hills: 0.08, mountain: "#100C20", detail: "rock", verge: "#1E1A30" },
      road: { kind: "wet", color: "#1E1F27", line: "#4FF0FF", edge: "#FF4FD8" }, curb: ["#FF4FD8", "#2B1A44"], curbs: "full", shoulder: "#2A2438",
      barrier: { kind: "neon", color: "#4FF0FF" },
      props: [{ kind: "tower", density: 1.4 }, { kind: "glasstower", density: 0.7 }, { kind: "neonsign", density: 0.8 }, { kind: "billboard", density: 0.6 }, { kind: "palm", density: 0.3, tint: ["#2E6E5A", "#3A7A66"] }, { kind: "ferriswheel", density: 0.4 }],
      backdrop: [{ kind: "city", color: "#24163E", height: 300, glow: "#FF4FD8" }, { kind: "city", color: "#1A1030", height: 170, glow: "#4FF0FF" }],
      stars: true, moon: true, overhead: { kind: "neon", every: 260, color: "#FF4FD8", color2: "#4FF0FF" },
      lamps: { kind: "street", color: "#BFE8FF", every: 34 },
      day: { sky: ["#3E6EB8", "#C9D6E6", "#DCE3EC"], fog: [260, 1600], hemi: ["#D6E2F2", "#3A3A48", 1.0], sun: { color: "#FFF4E0", dir: [-0.3, 0.7, -0.4], intensity: 2.4, glow: 0.5 }, clouds: 0.4 },
    }),
  },
  // ------------------------------------------------------------------ 2
  {
    id: "tropical-beach", name: "Tropical Beach", emoji: "🏝️", blurb: "Palm trees, turquoise sea and sandy hairpins.", order: 2,
    night: false, weather: "clear", music: "edm", accent: "#14C8C8",
    track: { width: 15.5, curviness: 0.38, hills: 0.25, size: 0.95 }, hazards: ["puddle", "cones"],
    look: look({
      sky: ["#1E88E5", "#A8E6F5", "#E6F6FA"], sun: { color: "#FFF6DE", dir: [0.3, 0.8, -0.5], intensity: 2.8, glow: 0.8 }, fog: [320, 1900],
      hemi: ["#D2F2FF", "#B9A779", 1.05],
      ground: { colors: ["#5DAA45", "#6BBA4E", "#4E9A3A", "#7CB850"], hills: 0.4, mountain: "#4E8A48", detail: "grass", verge: "#D8C690", rock: "#8A7F6A" },
      road: { kind: "asphalt", color: "#45474D", line: "#FFFFFF", edge: "#FFD84A" }, curb: ["#18B6C9", "#F4F1E6"], shoulder: "#E2CF9C",
      barrier: { kind: "bamboo", color: "#C7A46A" },
      water: { color: "#18B8C8", deep: "#0B5E8A", mode: "coast", shore: "#EBD9A6" },
      props: [{ kind: "palm", density: 1.6 }, { kind: "beachhut", density: 0.4 }, { kind: "umbrella", density: 0.6 }, { kind: "bush", density: 0.6, tint: ["#3E8E3A", "#4FA04A"] }, { kind: "boat", density: 0.5 }, { kind: "rock", density: 0.3 }, { kind: "lifeguard", density: 0.2 }],
      backdrop: [{ kind: "mountains", color: "#5E8F86", height: 300 }, { kind: "islands", color: "#3F7F5A", height: 120 }],
      clouds: 0.45, overhead: { kind: "bunting", every: 480 },
      grass: { colors: ["#7DBF4E", "#93C95A"], density: 0.6, flowers: ["#FF5DA2", "#FFB547", "#FFFFFF"] },
    }),
  },
  // ------------------------------------------------------------------ 3
  {
    id: "desert-canyon", name: "Desert Canyon", emoji: "🏜️", blurb: "Red mesas, stone arches and a blazing desert highway.", order: 3,
    night: false, weather: "clear", music: "funk", accent: "#F28C28",
    track: { width: 15.5, curviness: 0.42, hills: 0.45, size: 1.0 }, hazards: ["rock", "oil", "cones"],
    look: look({
      sky: ["#3F86D6", "#F2D3A6", "#F7E2C2"], sun: { color: "#FFE9C4", dir: [0.6, 0.7, 0.2], intensity: 3.0, glow: 0.9 }, fog: [280, 1700],
      hemi: ["#FFE2B8", "#9C5A32", 1.0],
      ground: { colors: ["#C9824A", "#D69458", "#B8723F", "#DDA067"], hills: 0.6, mountain: "#A8583A", rock: "#9A4E32", detail: "sand", verge: "#CF9A64" },
      road: { kind: "asphalt", color: "#4A4441", line: "#F2C230", edge: "#F4EEE2", centre: "double" }, curb: ["#C8402E", "#F4EEE2"], shoulder: "#C99A6B",
      barrier: { kind: "rail", color: "#BFC3C8" },
      props: [{ kind: "mesa", density: 0.5 }, { kind: "rockarch", density: 0.25 }, { kind: "hoodoo", density: 0.6 }, { kind: "cactus", density: 1 }, { kind: "rock", density: 1, tint: ["#A0583A", "#B86A44", "#8A4A30"] }, { kind: "tumbleweed", density: 0.6 }, { kind: "chevron", density: 0.6 }],
      backdrop: [{ kind: "mesas", color: "#C98A62", height: 240 }, { kind: "mesas", color: "#A95A3A", height: 160 }],
      clouds: 0.2, ambient: "dust",
      grass: { colors: ["#B49A5E", "#C9A86A"], density: 0.5 },
    }),
  },
  // ------------------------------------------------------------------ 4
  {
    id: "farmland", name: "Farmland", emoji: "🚜", blurb: "Golden fields, red barns and spinning windmills.", order: 4,
    night: false, weather: "clear", music: "chiptune", accent: "#7CC242",
    track: { width: 15, curviness: 0.42, hills: 0.4, size: 0.95 }, hazards: ["cones", "oil", "puddle"],
    look: look({
      sky: ["#3A88E0", "#CBE6F7", "#E3F0F7"], sun: { color: "#FFF0CC", dir: [0.5, 0.7, -0.3], intensity: 2.7, glow: 0.6 }, fog: [300, 1800],
      hemi: ["#D6EBFF", "#6B7E3A", 1.05],
      ground: { colors: ["#7BB84A", "#8CC456", "#6AA63E"], fields: ["#D9B44A", "#C9A23C", "#7DB04A", "#A7C95A", "#8A6A3E", "#E4C65A"], hills: 0.45, mountain: "#6E8F5A", detail: "grass", verge: "#7DBA4C" },
      road: { kind: "asphalt", color: "#4A4C50", line: "#FFFFFF", edge: "#FFFFFF" }, curb: ["#E8504F", "#F4F1E6"], shoulder: "#8F9A5A",
      barrier: { kind: "wood", color: "#EDE6D6" },
      props: [{ kind: "barn", density: 0.3 }, { kind: "silo", density: 0.25 }, { kind: "windmill", density: 0.15 }, { kind: "turbine", density: 0.3 }, { kind: "haybale", density: 0.8 }, { kind: "tree", density: 0.9, tint: GREENS }, { kind: "bush", density: 0.7 }, { kind: "wheat", density: 1 }, { kind: "sunflower", density: 0.6 }, { kind: "cow", density: 0.3 }, { kind: "balloon", density: 0.25 }, { kind: "grove", density: 0.5 }],
      backdrop: [{ kind: "hills", color: "#9DB9A6", height: 200 }, { kind: "forest", color: "#86A86A", height: 110 }],
      clouds: 0.6, overhead: { kind: "bunting", every: 600 },
      grass: { colors: ["#7BB84A", "#8CC456"], density: 0.9, flowers: ["#FFFFFF", "#FFE14A", "#C26BFF"] },
    }),
  },
  // ------------------------------------------------------------------ 5
  {
    id: "cherry-blossom", name: "Cherry Blossom", emoji: "🌸", blurb: "Pink sakura petals drift over calm lakes and lanterns.", order: 5,
    night: false, weather: "petals", music: "orchestral", accent: "#FF8AC2",
    track: { width: 15, curviness: 0.45, hills: 0.35, size: 0.95 }, hazards: ["puddle", "cones"],
    look: look({
      sky: ["#6FA8E8", "#F6D9E6", "#FBEAF1"], sun: { color: "#FFF1E8", dir: [0.4, 0.6, 0.5], intensity: 2.5, glow: 0.7 }, fog: [240, 1600],
      hemi: ["#FFE6F2", "#6F8A5A", 1.05],
      ground: { colors: ["#79B05A", "#86BC63", "#6CA352"], hills: 0.5, mountain: "#7A8FA0", detail: "grass", verge: "#8AC066" },
      road: { kind: "asphalt", color: "#45464C", line: "#FFFFFF", edge: "#FFFFFF" }, curb: ["#FF8AC2", "#FFFFFF"], shoulder: "#B7A98E",
      barrier: { kind: "wood", color: "#B5402F" },
      water: { color: "#6FB8C8", deep: "#2E6E8A", mode: "lake", shore: "#B7A98E" },
      props: [{ kind: "sakura", density: 1.6 }, { kind: "stonelantern", density: 0.5 }, { kind: "pagoda", density: 0.15 }, { kind: "shrine", density: 0.2 }, { kind: "bush", density: 0.5, tint: ["#5E9A4A", "#FF9AC8"] }, { kind: "pine", density: 0.3 }, { kind: "grove", density: 0.7, tint: ["#FFB7D5", "#FF9AC8", "#FFC8E0", "#6FA85A"] }],
      backdrop: [{ kind: "fuji", color: "#8D9BB8", height: 420 }, { kind: "hills", color: "#9DB39A", height: 140 }],
      overhead: { kind: "lanterns", every: 280, color: "#FF6B5A" }, clouds: 0.4, particles: ["#FFB7D5", "#FFD1E6", "#FFFFFF"],
      grass: { colors: ["#79B05A", "#8AC066"], density: 0.8, flowers: ["#FFB7D5", "#FFFFFF", "#FFD1E6"] },
    }),
  },
  // ------------------------------------------------------------------ 6
  {
    id: "harbour-docks", name: "Harbour Docks", emoji: "⚓", blurb: "Cranes, containers and ships in the late-afternoon sun.", order: 6,
    night: false, weather: "clear", music: "rock", accent: "#2B6CB0",
    track: { width: 15, curviness: 0.48, hills: 0.1, size: 0.95 }, hazards: ["oil", "cones", "puddle"],
    look: look({
      sky: ["#3D6FA8", "#F2C9A0", "#E9D2BC"], sun: { color: "#FFD9A8", dir: [-0.7, 0.35, 0.3], intensity: 2.4, glow: 1.0 }, fog: [240, 1600],
      hemi: ["#FFE0C2", "#5A5A60", 0.95],
      ground: { colors: ["#7A7C80", "#6E7074", "#5E7A4A", "#86888C"], hills: 0.12, mountain: "#6A7A6A", detail: "rock", verge: "#6F7275" },
      road: { kind: "asphalt", color: "#38393E", line: "#F2D06B", edge: "#FFFFFF" }, curb: ["#F2C230", "#2A2A2E"], curbs: "full", shoulder: "#6E6F73",
      barrier: { kind: "concrete", color: "#C9C6BE" },
      water: { color: "#2F6F8F", deep: "#163E5A", mode: "coast", shore: "#7A7C80" },
      props: [{ kind: "containers", density: 2.4 }, { kind: "crane", density: 0.9 }, { kind: "warehouse", density: 1.2 }, { kind: "lighthouse", density: 0.15 }, { kind: "ship", density: 0.8 }, { kind: "boat", density: 0.8 }, { kind: "buoy", density: 0.6 }, { kind: "tower", density: 0.25 }, { kind: "barrel", density: 0.6 }, { kind: "billboard", density: 0.3 }],
      backdrop: [{ kind: "hills", color: "#7F8E9E", height: 150 }, { kind: "city", color: "#5E6E86", height: 150 }],
      lamps: { kind: "street", color: "#FFD9A0", every: 42 }, overhead: { kind: "bridge", every: 900 }, clouds: 0.5,
    }),
  },
  // ------------------------------------------------------------------ 7
  {
    id: "autumn-forest", name: "Autumn Forest", emoji: "🍂", blurb: "Orange and red woods with leaves swirling across the road.", order: 7,
    night: false, weather: "leaves", music: "funk", accent: "#E07A2E",
    track: { width: 14.5, curviness: 0.5, hills: 0.5, size: 1.0 }, hazards: ["rock", "puddle", "oil"],
    look: look({
      sky: ["#4F86C6", "#F1D7B0", "#F4E6D0"], sun: { color: "#FFE2B0", dir: [0.5, 0.55, -0.4], intensity: 2.6, glow: 0.8 }, fog: [220, 1500],
      hemi: ["#FFE8C8", "#7A5A2E", 1.0],
      ground: { colors: ["#9C8A3E", "#B08A3A", "#8A7A36", "#A06A2E"], hills: 0.6, mountain: "#7E6A52", detail: "grass", verge: "#8F9440" },
      road: { kind: "asphalt", color: "#3F4045", line: "#FFFFFF", edge: "#F2D06B" }, curb: ["#D9572B", "#F4F1E6"], shoulder: "#8A6A44",
      barrier: { kind: "rail", color: "#B9BEC6" },
      props: [{ kind: "tree", density: 1.5, tint: ["#E0702A", "#D9452B", "#F2B134", "#C8582A", "#A33A22", "#E89A2E"] }, { kind: "pine", density: 0.5 }, { kind: "birch", density: 0.5 }, { kind: "cabin", density: 0.2 }, { kind: "pumpkin", density: 0.25 }, { kind: "rock", density: 0.5 }, { kind: "chevron", density: 0.6 }, { kind: "grove", density: 1.8, tint: ["#E0702A", "#D9452B", "#F2B134", "#C8582A", "#A33A22", "#7A8A3A"] }, { kind: "pinegrove", density: 0.6 }],
      backdrop: [{ kind: "mountains", color: "#8C7E86", height: 320 }, { kind: "forest", color: "#A8653A", height: 120 }],
      clouds: 0.4, particles: ["#E0702A", "#D9452B", "#F2B134", "#A33A22"],
      grass: { colors: ["#A08A3A", "#8F7A30"], density: 0.7, flowers: ["#E0702A", "#F2B134", "#C8582A"] },
    }),
  },
  // ------------------------------------------------------------------ 8
  {
    id: "candy-land", name: "Candy Land", emoji: "🍭", blurb: "Lollipop trees, gumdrop hills and a sprinkle-covered road.", order: 8,
    night: false, weather: "clear", music: "chiptune", accent: "#FF5FA2",
    track: { width: 15, curviness: 0.5, hills: 0.4, size: 0.95 }, hazards: ["oil", "cones", "puddle"],
    look: look({
      sky: ["#8FB8FF", "#FFD6EC", "#FFE9F4"], sun: { color: "#FFF4F0", dir: [0.3, 0.7, 0.5], intensity: 2.5, glow: 0.7 }, fog: [260, 1600],
      hemi: ["#FFE0F4", "#E89AC4", 1.15],
      ground: { colors: ["#8FE3B0", "#A6EBC0", "#FFB7D9", "#B8F0D0"], hills: 0.5, mountain: "#F7A8CF", snowCaps: true, detail: "candy", verge: "#A6EBC0" },
      road: { kind: "candy", color: "#F7C6DE", line: "#FFFFFF", edge: "#FF5FA2" }, curb: ["#FF3B7A", "#FFFFFF"], curbs: "full", shoulder: "#F6D8B0",
      barrier: { kind: "candy", color: "#FF3B7A" },
      props: [{ kind: "lollipop", density: 1 }, { kind: "candycane", density: 0.8 }, { kind: "gumdrop", density: 1.2 }, { kind: "cupcake", density: 0.4 }, { kind: "icecream", density: 0.4 }, { kind: "donut", density: 0.3 }, { kind: "candytree", density: 0.9 }],
      backdrop: [{ kind: "candy", color: "#C9A6F2", height: 280 }, { kind: "candy", color: "#F59AC8", height: 190 }],
      clouds: 0.6, cloudColor: "#FFE6F4", overhead: { kind: "candy", every: 320 },
      grass: { colors: ["#7FE0A6"], density: 0.6, flowers: ["#FF5FA2", "#FFE14A", "#7FD7FF", "#B78BFF"] },
    }),
  },
  // ------------------------------------------------------------------ 9
  {
    id: "rainy-metro", name: "Rainy Metro", emoji: "🌧️", blurb: "Storm-soaked downtown streets, flyovers and city lights.", order: 9,
    night: true, weather: "rain", music: "dnb", accent: "#3FA9F5",
    track: { width: 15, curviness: 0.5, hills: 0.15, size: 0.95 }, hazards: ["puddle", "oil", "cones"],
    look: look({
      sky: ["#0B1220", "#2C3646", "#151C28"], sun: { color: "#9FB4D0", dir: [-0.4, 0.6, 0.3], intensity: 0.5, glow: 0.1 }, fog: [110, 800],
      hemi: ["#4A5A78", "#151820", 0.75],
      ground: { colors: ["#2A2D33", "#30333A", "#25282D"], hills: 0.1, mountain: "#1E2228", detail: "rock", verge: "#2E3036" },
      road: { kind: "wet", color: "#25272C", line: "#F2F2F2", edge: "#F2D06B" }, curb: ["#E8504F", "#E8E8E8"], shoulder: "#3A3C40",
      barrier: { kind: "concrete", color: "#9EA2A8" },
      props: [{ kind: "tower", density: 1.4 }, { kind: "glasstower", density: 0.6 }, { kind: "billboard", density: 0.6 }, { kind: "trafficlight", density: 0.5 }, { kind: "neonsign", density: 0.4 }],
      backdrop: [{ kind: "city", color: "#263040", height: 300, glow: "#3FA9F5" }, { kind: "city", color: "#1C2433", height: 180 }],
      lamps: { kind: "street", color: "#FFD08A", every: 30 }, overhead: { kind: "bridge", every: 560 }, tunnels: { kind: "concrete", count: 1, length: 90 }, clouds: 1,
    }),
  },
  // ------------------------------------------------------------------ 10
  {
    id: "snowy-alps", name: "Snowy Alps", emoji: "🏔️", blurb: "Snowy pines, wooden chalets and giant alpine peaks.", order: 10,
    night: false, weather: "snow", music: "orchestral", accent: "#7DD3FC",
    track: { width: 14.5, curviness: 0.5, hills: 0.7, size: 1.0 }, hazards: ["rock", "puddle", "cones"],
    look: look({
      sky: ["#3D7FD0", "#D6E8F7", "#EEF4FA"], sun: { color: "#FFF8EC", dir: [0.4, 0.6, -0.5], intensity: 2.6, glow: 0.6 }, fog: [220, 1600],
      hemi: ["#E2F0FF", "#9AA8B8", 1.1],
      ground: { colors: ["#F2F6FB", "#E6EEF6", "#FFFFFF", "#DCE6F0"], hills: 0.8, mountain: "#8C98A8", rock: "#6E7682", snowCaps: true, ridged: true, detail: "snow", verge: "#EEF3F9" },
      road: { kind: "snow", color: "#B9C3CF", line: "#FFFFFF", edge: "#E8504F", centre: "none" }, curb: ["#E8504F", "#FFFFFF"], shoulder: "#E8EEF5",
      barrier: { kind: "snowbank", color: "#DDE6F0" },
      props: [{ kind: "snowpine", density: 1.7 }, { kind: "chalet", density: 0.3 }, { kind: "skilift", density: 0.12 }, { kind: "rock", density: 0.6, tint: ["#7A828E", "#8A929E"] }, { kind: "snowman", density: 0.2 }, { kind: "chevron", density: 0.7 }, { kind: "pinegrove", density: 1.5 }],
      backdrop: [{ kind: "alps", color: "#A3B2C8", height: 560 }, { kind: "alps", color: "#7D8CA3", height: 380 }],
      clouds: 0.35, tunnels: { kind: "gallery", count: 1, length: 80 },
    }),
  },
  // ------------------------------------------------------------------ 11
  {
    id: "jungle-ruins", name: "Jungle Ruins", emoji: "🗿", blurb: "Misty rainforest, vines and forgotten stone temples.", order: 11,
    night: false, weather: "clear", music: "dnb", accent: "#2FA866",
    track: { width: 14.5, curviness: 0.55, hills: 0.5, size: 1.0 }, hazards: ["rock", "puddle", "oil"],
    look: look({
      sky: ["#4C8FC0", "#CFE8D8", "#E2F0E6"], sun: { color: "#FFF6D8", dir: [0.3, 0.8, 0.3], intensity: 2.4, glow: 0.6 }, fog: [130, 1050],
      hemi: ["#DAF5E0", "#2F5A2A", 1.0],
      ground: { colors: ["#3F7F2E", "#4B8E36", "#356F28", "#5A9A3C"], hills: 0.6, mountain: "#3E6E48", detail: "moss", verge: "#4A8A34" },
      road: { kind: "cobble", color: "#8A8270", line: "none", edge: "none", centre: "none" }, curb: ["#7A6E58", "#9A8E74"], shoulder: "#6E5A3E",
      barrier: { kind: "stone", color: "#8A8270" },
      props: [{ kind: "jungletree", density: 1.4 }, { kind: "fern", density: 1.4 }, { kind: "palm", density: 0.5 }, { kind: "ruinpillar", density: 0.6 }, { kind: "steppyramid", density: 0.1 }, { kind: "stonehead", density: 0.25 }, { kind: "bamboo", density: 0.5 }, { kind: "rock", density: 0.4, tint: ["#5A6A4A", "#6A7A5A"] }, { kind: "grove", density: 1.4, tint: ["#2F7A2A", "#3A8A32", "#2A6A24", "#4A8A3A"] }],
      backdrop: [{ kind: "mountains", color: "#5E8A78", height: 380 }, { kind: "jungle", color: "#2F5E3A", height: 180 }],
      overhead: { kind: "vines", every: 240 }, shafts: "#FFF6C8", clouds: 0.5,
      grass: { colors: ["#4F9A38", "#5FAE42"], density: 1, flowers: ["#FF4F6D", "#FFB547", "#C26BFF"], height: 1.3 },
    }),
  },
  // ------------------------------------------------------------------ 12
  {
    id: "wild-west", name: "Wild West", emoji: "🤠", blurb: "Dusty trails, saloons, water towers and tumbleweeds.", order: 12,
    night: false, weather: "clear", music: "funk", accent: "#C46A2C",
    track: { width: 15, curviness: 0.52, hills: 0.4, size: 1.0 }, hazards: ["rock", "oil", "fire"],
    look: look({
      sky: ["#4F8FD6", "#F3D9B0", "#F6E6CC"], sun: { color: "#FFE6BE", dir: [-0.5, 0.65, 0.3], intensity: 2.9, glow: 0.9 }, fog: [240, 1600],
      hemi: ["#FFE6C0", "#8E5A36", 1.0],
      ground: { colors: ["#C99A62", "#D4A872", "#B88A55"], hills: 0.45, mountain: "#A0603E", rock: "#8E5034", detail: "sand", verge: "#B89A62" },
      road: { kind: "dirt", color: "#A4764A", line: "none", edge: "none", centre: "none" }, curb: ["#8A5A36", "#A4764A"], curbs: "none", shoulder: "#B48A5A",
      barrier: { kind: "wood", color: "#7A5233" },
      props: [{ kind: "saloon", density: 0.4 }, { kind: "watertower", density: 0.25 }, { kind: "windpump", density: 0.3 }, { kind: "cactus", density: 1 }, { kind: "rock", density: 0.6, tint: ["#A86A44", "#B87A50"] }, { kind: "tumbleweed", density: 0.7 }, { kind: "mesa", density: 0.35 }, { kind: "barrel", density: 0.4 }],
      backdrop: [{ kind: "mesas", color: "#C98A62", height: 200 }, { kind: "mesas", color: "#A95A3A", height: 150 }],
      overhead: { kind: "ranch", every: 520 }, clouds: 0.25, ambient: "dust",
      grass: { colors: ["#B49A5E", "#A88E54"], density: 0.5 },
    }),
  },
  // ------------------------------------------------------------------ 13
  {
    id: "sunset-coast", name: "Sunset Coast", emoji: "🌅", blurb: "A cliff-top coastal highway in the golden hour.", order: 13,
    night: false, weather: "clear", music: "synthwave", accent: "#FF7A45",
    track: { width: 15, curviness: 0.52, hills: 0.5, size: 1.05 }, hazards: ["cones", "oil", "puddle"],
    look: look({
      sky: ["#2E3A78", "#FF9E6B", "#FFC08A"], sun: { color: "#FFB070", dir: [-0.75, 0.12, 0.25], intensity: 2.4, glow: 1.4 }, fog: [220, 1600],
      hemi: ["#FFB48A", "#5A3E52", 0.9],
      ground: { colors: ["#8A9A4E", "#7E8E46", "#A0A055"], hills: 0.6, mountain: "#6E5A6E", rock: "#8E6A5A", detail: "grass", verge: "#8E9A50" },
      road: { kind: "asphalt", color: "#3A3A42", line: "#F2C230", edge: "#FFFFFF", centre: "double" }, curb: ["#FF7A45", "#FFFFFF"], shoulder: "#9A8A6A",
      barrier: { kind: "rail", color: "#C9CED6" },
      water: { color: "#3A6A9A", deep: "#1E3460", mode: "coast", shore: "#E2C79A" },
      props: [{ kind: "palm", density: 1.2 }, { kind: "beachhouse", density: 0.3 }, { kind: "lighthouse", density: 0.12 }, { kind: "rock", density: 0.5 }, { kind: "cypress", density: 0.5 }, { kind: "boat", density: 0.4 }, { kind: "chevron", density: 0.6 }, { kind: "ferriswheel", density: 0.4 }, { kind: "grove", density: 0.4, tint: ["#5E7A3A", "#6A8A44"] }],
      backdrop: [{ kind: "mountains", color: "#7A5A7E", height: 280 }, { kind: "cliffs", color: "#5A4560", height: 160 }],
      clouds: 0.5, cloudColor: "#FFB89A", lamps: { kind: "street", color: "#FFC27A", every: 55 },
      grass: { colors: ["#8A9A4E", "#A0A055"], density: 0.6, flowers: ["#FFD84A", "#FF8A5A"] },
    }),
  },
  // ------------------------------------------------------------------ 14
  {
    id: "egyptian-dunes", name: "Pharaoh Dunes", emoji: "🐫", blurb: "Pyramids, obelisks and sweeping golden sand dunes.", order: 14,
    night: false, weather: "sand", music: "orchestral", accent: "#E3B04B",
    track: { width: 15, curviness: 0.52, hills: 0.5, size: 1.05 }, hazards: ["rock", "spikes", "fire"],
    look: look({
      sky: ["#4C8CD8", "#F3DDB0", "#F7E8CC"], sun: { color: "#FFF0D0", dir: [0.4, 0.8, -0.2], intensity: 3.1, glow: 0.9 }, fog: [200, 1400],
      hemi: ["#FFF0D0", "#B8935A", 1.05],
      ground: { colors: ["#E2C084", "#D9B677", "#EACB92"], hills: 0.7, mountain: "#D2A86A", detail: "sand", verge: "#D9B677", dunes: true },
      road: { kind: "stone", color: "#C9B48A", line: "none", edge: "none", centre: "none" }, curb: ["#2F6FB0", "#F2E6C8"], shoulder: "#D9BE86",
      barrier: { kind: "stone", color: "#C8AE7E" },
      props: [{ kind: "pyramid", density: 0.12 }, { kind: "obelisk", density: 0.4 }, { kind: "sphinx", density: 0.06 }, { kind: "palm", density: 0.5 }, { kind: "column", density: 0.5 }, { kind: "rock", density: 0.3, tint: ["#C9A06A", "#B89060"] }, { kind: "camel", density: 0.2 }],
      backdrop: [{ kind: "pyramids", color: "#D9B07A", height: 220 }, { kind: "dunes", color: "#E2BE84", height: 120 }],
      overhead: { kind: "stone", every: 600 }, clouds: 0.1, ambient: "dust",
    }),
  },
  // ------------------------------------------------------------------ 15
  {
    id: "mushroom-forest", name: "Mushroom Forest", emoji: "🍄", blurb: "Giant glowing mushrooms and fireflies in a magic night wood.", order: 15,
    night: true, weather: "fireflies", music: "edm", accent: "#B266FF",
    track: { width: 14.5, curviness: 0.55, hills: 0.45, size: 1.0 }, hazards: ["puddle", "rock", "oil"],
    look: look({
      sky: ["#0A0820", "#2A1E4E", "#120E2A"], sun: { color: "#9F8CFF", dir: [0.3, 0.6, 0.4], intensity: 0.6, glow: 0.2 }, fog: [100, 820],
      hemi: ["#5A4AA0", "#1A1630", 0.85],
      ground: { colors: ["#2E4A3A", "#355640", "#294234"], hills: 0.5, mountain: "#22304A", detail: "moss", verge: "#3A5A44" },
      road: { kind: "cobble", color: "#4A4458", line: "none", edge: "none", centre: "none" }, curb: ["#B266FF", "#3A2A5A"], shoulder: "#3A3448",
      barrier: { kind: "hedge", color: "#2E5A40" },
      props: [{ kind: "giantmushroom", density: 1 }, { kind: "mushrooms", density: 1.4 }, { kind: "fern", density: 1, tint: ["#2E6A4A", "#3A7A56"] }, { kind: "crystal", density: 0.3, tint: ["#7AF0D0", "#B266FF"] }, { kind: "deadtree", density: 0.3 }, { kind: "pinegrove", density: 0.9, tint: ["#1E3A2E", "#2A4A3A", "#24403A"] }],
      backdrop: [{ kind: "forest", color: "#22203E", height: 150 }, { kind: "mushrooms", color: "#1C1838", height: 220, glow: "#7AF0D0" }],
      stars: true, moon: true, overhead: { kind: "lanterns", every: 300, color: "#7AF0D0" },
      grass: { colors: ["#3E6A4A"], density: 0.9, flowers: ["#7AF0D0", "#FF7AD9", "#FFE47A"], glow: true },
      ambient: "fireflies",
    }),
  },
  // ------------------------------------------------------------------ 16
  {
    id: "lavender-fields", name: "Lavender Fields", emoji: "💜", blurb: "Rolling purple rows, cypress trees and stone farmhouses.", order: 16,
    night: false, weather: "clear", music: "chiptune", accent: "#9B7BEA",
    track: { width: 14.5, curviness: 0.52, hills: 0.45, size: 1.0 }, hazards: ["puddle", "cones", "oil"],
    look: look({
      sky: ["#4A84D0", "#F2D8C8", "#F6E8E0"], sun: { color: "#FFE8C8", dir: [0.6, 0.5, 0.3], intensity: 2.6, glow: 0.9 }, fog: [260, 1600],
      hemi: ["#FFF0E0", "#6A5A7A", 1.0],
      ground: { colors: ["#8DA556", "#9AAE5E", "#7E9A4E"], fields: ["#8E6FD0", "#9B7BEA", "#7E62C2", "#C9B04A", "#8DA556"], hills: 0.45, mountain: "#8E8CA8", detail: "grass", verge: "#93AA58" },
      road: { kind: "asphalt", color: "#4A4A50", line: "#FFFFFF", edge: "#FFFFFF" }, curb: ["#9B7BEA", "#FFFFFF"], shoulder: "#B8A88A",
      barrier: { kind: "stone", color: "#C8B89A" },
      props: [{ kind: "lavender", density: 1.6 }, { kind: "cypress", density: 0.7 }, { kind: "olive", density: 0.6 }, { kind: "farmhouse", density: 0.25 }, { kind: "sunflower", density: 0.3 }, { kind: "haybale", density: 0.2 }, { kind: "balloon", density: 0.2 }, { kind: "grove", density: 0.35, tint: ["#8A9A6A", "#7A8A5E"] }],
      backdrop: [{ kind: "mountains", color: "#A8A4C8", height: 300 }, { kind: "hills", color: "#8E8AB8", height: 170 }],
      clouds: 0.3,
      grass: { colors: ["#8DA556", "#9AAE5E"], density: 0.8, flowers: ["#9B7BEA", "#B89AF2", "#FFFFFF"] },
    }),
  },
  // ------------------------------------------------------------------ 17
  {
    id: "safari-savanna", name: "Safari Savanna", emoji: "🦒", blurb: "Acacia trees, giraffes and red dirt under a huge sky.", order: 17,
    night: false, weather: "clear", music: "rock", accent: "#E0A030",
    track: { width: 15, curviness: 0.55, hills: 0.4, size: 1.1 }, hazards: ["rock", "oil", "puddle"],
    look: look({
      sky: ["#4A88D0", "#F6D8A0", "#FAE8C4"], sun: { color: "#FFD9A0", dir: [-0.6, 0.4, 0.4], intensity: 2.8, glow: 1.0 }, fog: [280, 1800],
      hemi: ["#FFE8C0", "#8A6A3A", 1.0],
      ground: { colors: ["#C9A85A", "#D4B262", "#B8964E", "#A89048"], hills: 0.35, mountain: "#9A7A5A", detail: "grass", verge: "#BFA05A" },
      road: { kind: "dirt", color: "#B5653A", line: "none", edge: "none", centre: "none" }, curb: ["#9A5030", "#B5653A"], curbs: "none", shoulder: "#C08050",
      barrier: { kind: "rocks", color: "#A08060" },
      props: [{ kind: "acacia", density: 1 }, { kind: "baobab", density: 0.2 }, { kind: "termite", density: 0.5 }, { kind: "rock", density: 0.5, tint: ["#A8906A", "#9A8060"] }, { kind: "giraffe", density: 0.25 }, { kind: "elephant", density: 0.15 }, { kind: "bush", density: 0.6, tint: ["#7A8A3A", "#8A9A4A"] }],
      backdrop: [{ kind: "kilimanjaro", color: "#8A7A8A", height: 420 }, { kind: "hills", color: "#B8965E", height: 90 }],
      clouds: 0.3,
      grass: { colors: ["#D4B262", "#C9A85A", "#E0C070"], density: 1.2, height: 1.2 },
    }),
  },
  // ------------------------------------------------------------------ 18
  {
    id: "haunted-town", name: "Haunted Town", emoji: "🎃", blurb: "Foggy graveyards, crooked houses and grinning pumpkins.", order: 18,
    night: true, weather: "clear", music: "trap", accent: "#FF8A1F",
    track: { width: 14.5, curviness: 0.55, hills: 0.35, size: 1.0 }, hazards: ["fire", "oil", "spikes"],
    look: look({
      sky: ["#0A0A18", "#3A2E4A", "#1A1424"], sun: { color: "#C8D4FF", dir: [-0.4, 0.5, -0.5], intensity: 0.6, glow: 0.2 }, fog: [70, 620],
      hemi: ["#4A4A6A", "#1A1620", 0.7],
      ground: { colors: ["#2E3326", "#353A2C", "#2A2E24"], hills: 0.4, mountain: "#1E2028", detail: "moss", verge: "#3A3E2E" },
      road: { kind: "cobble", color: "#4A4850", line: "none", edge: "none", centre: "none" }, curb: ["#FF8A1F", "#2A2430"], shoulder: "#3A3632",
      barrier: { kind: "iron", color: "#1A1A20" },
      props: [{ kind: "deadtree", density: 1.4 }, { kind: "gravestone", density: 1.4 }, { kind: "pumpkin", density: 0.8 }, { kind: "hauntedhouse", density: 0.3 }, { kind: "crypt", density: 0.15 }],
      backdrop: [{ kind: "hills", color: "#2A2438", height: 120 }, { kind: "town", color: "#1A1626", height: 160 }],
      moon: true, stars: true, lamps: { kind: "lantern", color: "#FFB45A", every: 40 }, overhead: { kind: "iron", every: 520 },
      grass: { colors: ["#4A4E36", "#3A3E2A"], density: 0.6 },
    }),
  },
  // ------------------------------------------------------------------ 19
  {
    id: "shrine-mountains", name: "Shrine Mountains", emoji: "⛩️", blurb: "Red torii gates, bamboo groves and pagodas at dusk.", order: 19,
    night: false, weather: "leaves", music: "trap", accent: "#E5483A",
    track: { width: 14.5, curviness: 0.6, hills: 0.6, size: 1.0 }, hazards: ["rock", "puddle", "oil"],
    look: look({
      sky: ["#4A5A98", "#F7B98A", "#F9D2B0"], sun: { color: "#FFC48A", dir: [0.7, 0.22, -0.3], intensity: 2.3, glow: 1.2 }, fog: [170, 1250],
      hemi: ["#FFD4B0", "#4A5040", 0.95],
      ground: { colors: ["#5A7A42", "#668A4A", "#4E6E3A"], hills: 0.75, mountain: "#4E5E6A", rock: "#6A6A6E", ridged: true, detail: "moss", verge: "#5E7E44" },
      road: { kind: "stone", color: "#8A8478", line: "none", edge: "none", centre: "none" }, curb: ["#E5483A", "#F2EDE0"], shoulder: "#8A8070",
      barrier: { kind: "bamboo", color: "#B8A860" },
      props: [{ kind: "tree", density: 1.1, tint: ["#C8302A", "#E5483A", "#B82A22", "#E0702A"] }, { kind: "bamboo", density: 1 }, { kind: "pagoda", density: 0.2 }, { kind: "stonelantern", density: 0.7 }, { kind: "shrine", density: 0.2 }, { kind: "pine", density: 0.5 }, { kind: "rock", density: 0.4 }, { kind: "grove", density: 0.9, tint: ["#C8302A", "#E5483A", "#4E7A3A", "#5E8A44"] }, { kind: "pinegrove", density: 0.6 }],
      backdrop: [{ kind: "mountains", color: "#7A7E9E", height: 440 }, { kind: "temples", color: "#3E4660", height: 260 }],
      overhead: { kind: "torii", every: 220, color: "#E5483A" }, lamps: { kind: "lantern", color: "#FFB070", every: 45 },
      clouds: 0.4, cloudColor: "#FFC8A8", particles: ["#E5483A", "#C8302A", "#F2B134"],
      grass: { colors: ["#5A7A42", "#6A8A4A"], density: 0.7, flowers: ["#E5483A", "#FFFFFF"] },
    }),
  },
  // ------------------------------------------------------------------ 20
  {
    id: "volcano", name: "Volcano Rush", emoji: "🌋", blurb: "Black rock, rivers of lava and falling ash.", order: 20,
    night: true, weather: "ash", music: "dnb", accent: "#FF4D1F",
    track: { width: 14, curviness: 0.6, hills: 0.6, size: 1.05 }, hazards: ["fire", "rock", "spikes"],
    look: look({
      sky: ["#120A0A", "#5A2418", "#2A1210"], sun: { color: "#FF8A50", dir: [0.4, 0.35, 0.6], intensity: 1.2, glow: 0.6 }, fog: [120, 950],
      hemi: ["#8A4A3A", "#2A1410", 0.85],
      ground: { colors: ["#2A2422", "#332B28", "#221C1A", "#3A2E2A"], hills: 0.75, mountain: "#1E1A1A", rock: "#2A2220", ridged: true, detail: "rock", verge: "#2E2624" },
      road: { kind: "basalt", color: "#2A2A2E", line: "#FF8A30", edge: "#FF5A1F" }, curb: ["#FF4D1F", "#2A2422"], shoulder: "#3A302C",
      barrier: { kind: "rocks", color: "#3A3230" },
      props: [{ kind: "lavarock", density: 1.2 }, { kind: "lavapool", density: 0.7 }, { kind: "basalt", density: 0.6 }, { kind: "deadtree", density: 0.5 }, { kind: "smoker", density: 0.3 }],
      backdrop: [{ kind: "mountains", color: "#2A1E1E", height: 280 }, { kind: "volcano", color: "#1A1414", height: 560, glow: "#FF5A1F" }],
      clouds: 0.7, cloudColor: "#5A3A34", ambient: "embers", tunnels: { kind: "rock", count: 1, length: 70 },
    }),
  },
  // ------------------------------------------------------------------ 21
  {
    id: "viking-fjords", name: "Viking Fjords", emoji: "⛵", blurb: "Steep fjord cliffs, longships and wooden halls.", order: 21,
    night: false, weather: "clear", music: "rock", accent: "#4A7FB0",
    track: { width: 14, curviness: 0.6, hills: 0.7, size: 1.05 }, hazards: ["rock", "puddle", "oil"],
    look: look({
      sky: ["#5A7088", "#C8D2DA", "#DDE3E8"], sun: { color: "#F2F0E8", dir: [0.3, 0.55, -0.6], intensity: 1.9, glow: 0.4 }, fog: [190, 1350],
      hemi: ["#D8E2EA", "#4A5A48", 1.0],
      ground: { colors: ["#4E7A44", "#5A864C", "#46703E"], hills: 0.85, mountain: "#5A6470", rock: "#5E646C", snowCaps: true, ridged: true, detail: "moss", verge: "#557F48" },
      road: { kind: "asphalt", color: "#3E4046", line: "#FFFFFF", edge: "#F2D06B" }, curb: ["#C8402E", "#FFFFFF"], shoulder: "#6A6A62",
      barrier: { kind: "rail", color: "#C0C6CE" },
      water: { color: "#2E5A6A", deep: "#14303E", mode: "coast", shore: "#5A5E58" },
      props: [{ kind: "pine", density: 1.4 }, { kind: "longhouse", density: 0.25 }, { kind: "stavechurch", density: 0.08 }, { kind: "runestone", density: 0.4 }, { kind: "longship", density: 0.5 }, { kind: "rock", density: 0.6, tint: ["#6A7078", "#5A6068"] }, { kind: "cabin", density: 0.3, tint: ["#A8322A", "#B83A2E"] }, { kind: "pinegrove", density: 1.5 }],
      backdrop: [{ kind: "fjord", color: "#6A7888", height: 420, snow: true }, { kind: "fjord", color: "#4A5868", height: 520, snow: true }],
      clouds: 0.85, tunnels: { kind: "rock", count: 2, length: 80 },
      grass: { colors: ["#4E7A44", "#5E8A50"], density: 0.7, flowers: ["#FFFFFF", "#C9B8FF"] },
    }),
  },
  // ------------------------------------------------------------------ 22
  {
    id: "ice-glacier", name: "Glacier Caves", emoji: "🧊", blurb: "Blue ice tunnels, icebergs and a frozen lake.", order: 22,
    night: false, weather: "snow", music: "edm", accent: "#5FD3F5",
    track: { width: 14, curviness: 0.6, hills: 0.6, size: 1.05 }, hazards: ["puddle", "rock", "spikes"],
    look: look({
      sky: ["#2E7ACC", "#CDEBF8", "#E8F6FC"], sun: { color: "#F2FAFF", dir: [0.5, 0.45, 0.5], intensity: 2.6, glow: 0.7 }, fog: [200, 1450],
      hemi: ["#E0F4FF", "#7AB0D0", 1.15],
      ground: { colors: ["#E8F4FC", "#D6ECF8", "#F4FAFF", "#C6E2F2"], hills: 0.7, mountain: "#8CC0E0", rock: "#6AA0C8", snowCaps: true, ridged: true, detail: "snow", verge: "#E2F0FA" },
      road: { kind: "ice", color: "#BFE4F5", line: "#FFFFFF", edge: "#5FD3F5", centre: "none" }, curb: ["#5FD3F5", "#FFFFFF"], curbs: "full", shoulder: "#DDEEF8",
      barrier: { kind: "ice", color: "#9ADCF5" },
      water: { color: "#8ACCE6", deep: "#3E8AB0", mode: "lake", frozen: true },
      props: [{ kind: "icecrystal", density: 1 }, { kind: "iceberg", density: 0.8 }, { kind: "icespike", density: 0.8 }, { kind: "snowpine", density: 0.4 }, { kind: "igloo", density: 0.2 }, { kind: "pinegrove", density: 0.4 }],
      backdrop: [{ kind: "alps", color: "#B6D8EE", height: 480 }, { kind: "ice", color: "#8CC6E6", height: 300 }],
      tunnels: { kind: "ice", count: 2, length: 70 }, overhead: { kind: "ice", every: 420 }, clouds: 0.3, ambient: "sparkles",
    }),
  },
  // ------------------------------------------------------------------ 23
  {
    id: "moon-base", name: "Moon Base", emoji: "🌙", blurb: "Craters, rockets and the Earth hanging in a black sky.", order: 23,
    night: true, weather: "clear", music: "trap", accent: "#A0A8C0",
    track: { width: 15, curviness: 0.6, hills: 0.4, size: 1.05 }, hazards: ["rock", "spikes", "cones"],
    look: look({
      sky: ["#000002", "#0A0C14", "#050508"], sun: { color: "#FFFFFF", dir: [0.6, 0.35, -0.4], intensity: 3.0, glow: 0.3 }, fog: [500, 2800],
      hemi: ["#2A2E3A", "#5A5A60", 0.5],
      ground: { colors: ["#8A8A8E", "#9A9A9E", "#7A7A7E", "#A4A4A8"], hills: 0.55, mountain: "#6A6A70", detail: "dust", verge: "#8A8A8E" },
      road: { kind: "metal", color: "#5A5E66", line: "#F2C230", edge: "#4FC3FF" }, curb: ["#F2C230", "#2A2A2E"], curbs: "full", shoulder: "#7A7A7E",
      barrier: { kind: "neon", color: "#4FC3FF" },
      props: [{ kind: "moondome", density: 0.4 }, { kind: "rocket", density: 0.1 }, { kind: "dish", density: 0.3 }, { kind: "solarpanel", density: 0.5 }, { kind: "rover", density: 0.2 }, { kind: "crater", density: 0.9 }, { kind: "rock", density: 0.8, tint: ["#8A8A8E", "#6A6A70"] }, { kind: "antenna", density: 0.4 }],
      backdrop: [{ kind: "craters", color: "#4A4A50", height: 220 }, { kind: "craters", color: "#6A6A70", height: 150 }],
      stars: true, milkyWay: true, planet: { color: "#3A7AD8", color2: "#F2F2F2", size: 0.13, dir: [-0.5, 0.35, -0.6] },
      lamps: { kind: "flood", color: "#DDEEFF", every: 70 }, overhead: { kind: "girder", every: 420 },
    }),
  },
  // ------------------------------------------------------------------ 24
  {
    id: "cyber-grid", name: "Cyber Grid", emoji: "💠", blurb: "A glowing digital world racing into a neon sunset.", order: 24,
    night: true, weather: "clear", music: "synthwave", accent: "#00E5FF",
    track: { width: 15, curviness: 0.65, hills: 0.35, size: 1.0 }, hazards: ["spikes", "oil", "cones"],
    look: look({
      sky: ["#02010A", "#1A0636", "#0A0318"], sun: { color: "#FF3FD8", dir: [0, 0.07, -1], intensity: 1.0, glow: 1.2 }, fog: [160, 1250],
      hemi: ["#3A1A6A", "#0A0418", 0.8],
      ground: { colors: ["#0A0816", "#0E0B1E"], hills: 0.35, mountain: "#140A2A", detail: "grid", verge: "#0E0B1E" },
      road: { kind: "grid", color: "#0A0A14", line: "#00E5FF", edge: "#FF3FD8" }, curb: ["#00E5FF", "#0A0A14"], curbs: "full", shoulder: "#120E22",
      barrier: { kind: "neon", color: "#FF3FD8" },
      props: [{ kind: "datatower", density: 0.8 }, { kind: "wirepyramid", density: 0.4 }, { kind: "cube", density: 0.6 }, { kind: "neonsign", density: 0.4 }],
      backdrop: [{ kind: "grid", color: "#FF3FD8", height: 280 }, { kind: "grid", color: "#00E5FF", height: 160 }],
      stars: true, overhead: { kind: "neon", every: 200, color: "#00E5FF", color2: "#FF3FD8" }, tunnels: { kind: "neon", count: 1, length: 80 },
    }),
  },
  // ------------------------------------------------------------------ 25
  {
    id: "arctic-aurora", name: "Arctic Aurora", emoji: "🌌", blurb: "Snowy forests under dancing northern lights.", order: 25,
    night: true, weather: "snow", music: "orchestral", accent: "#4FF0B0",
    track: { width: 14, curviness: 0.62, hills: 0.55, size: 1.05 }, hazards: ["puddle", "rock", "cones"],
    look: look({
      sky: ["#020814", "#0E2A3A", "#061420"], sun: { color: "#BFD8FF", dir: [-0.3, 0.45, 0.6], intensity: 0.75, glow: 0.2 }, fog: [150, 1150],
      hemi: ["#3A5A7A", "#1A2A38", 0.85],
      ground: { colors: ["#DCE6F2", "#E6EEF8", "#CFDCEA"], hills: 0.6, mountain: "#5A6A80", snowCaps: true, detail: "snow", verge: "#DCE6F2" },
      road: { kind: "snow", color: "#9AA6B4", line: "#FFFFFF", edge: "#E8504F", centre: "none" }, curb: ["#E8504F", "#FFFFFF"], shoulder: "#C8D4E2",
      barrier: { kind: "snowbank", color: "#D6E0EC" },
      water: { color: "#9AB8D0", deep: "#4A6A8A", mode: "lake", frozen: true },
      props: [{ kind: "snowpine", density: 1.7 }, { kind: "cabin", density: 0.3, tint: ["#8A4A2E", "#6A3A24"] }, { kind: "igloo", density: 0.3 }, { kind: "rock", density: 0.4, tint: ["#7A8696", "#8A96A6"] }, { kind: "reindeer", density: 0.15 }, { kind: "pinegrove", density: 1.4, tint: ["#1E4A32", "#24503A", "#2A5A40"] }],
      backdrop: [{ kind: "mountains", color: "#2A3A50", height: 340, snow: true }, { kind: "pines", color: "#1A2838", height: 120 }],
      aurora: ["#4FF0B0", "#9B6BFF"], stars: true, milkyWay: true, moon: true, lamps: { kind: "lantern", color: "#FFB45A", every: 55 },
    }),
  },
  // ------------------------------------------------------------------ 26
  {
    id: "mars-red-planet", name: "Mars Red Planet", emoji: "🔴", blurb: "Rust-red canyons, habitats and dust storms on Mars.", order: 26,
    night: false, weather: "sand", music: "dnb", accent: "#E2552B",
    track: { width: 14.5, curviness: 0.65, hills: 0.6, size: 1.1 }, hazards: ["rock", "spikes", "fire"],
    look: look({
      sky: ["#9A5E40", "#E8B08A", "#D89A74"], sun: { color: "#F2F0FF", dir: [0.5, 0.5, 0.4], intensity: 2.4, glow: 0.9 }, fog: [200, 1400],
      hemi: ["#F2B48A", "#8A3A22", 1.0],
      ground: { colors: ["#B5532E", "#C2603A", "#A84A28", "#CC6E44"], hills: 0.7, mountain: "#8A3A22", rock: "#6E2E1A", ridged: true, detail: "dust", verge: "#B85A34" },
      road: { kind: "regolith", color: "#7A3A26", line: "#F2E6D0", edge: "#4FC3FF" }, curb: ["#F2E6D0", "#5A2A1A"], shoulder: "#9A4A2A",
      barrier: { kind: "rocks", color: "#8A3A22" },
      props: [{ kind: "rock", density: 1.2, tint: ["#9A4428", "#B05030", "#7A3420"] }, { kind: "mesa", density: 0.4, tint: ["#A04A2A", "#B85A34"] }, { kind: "hoodoo", density: 0.6, tint: ["#A04A2A", "#B85A34"] }, { kind: "moondome", density: 0.3 }, { kind: "rover", density: 0.25 }, { kind: "rocket", density: 0.08 }, { kind: "dish", density: 0.2 }, { kind: "solarpanel", density: 0.3 }],
      backdrop: [{ kind: "mountains", color: "#B8704E", height: 440 }, { kind: "mesas", color: "#9A4A2E", height: 240 }],
      planet: { color: "#8A7A6A", color2: "#6A5A4A", size: 0.035, dir: [-0.4, 0.5, -0.6] },
      clouds: 0.15, cloudColor: "#F2C8A8", ambient: "dust",
    }),
  },
  // ------------------------------------------------------------------ 27
  {
    id: "coral-dome", name: "Coral Reef Dome", emoji: "🐠", blurb: "Glass tubes through an undersea city of coral and kelp.", order: 27,
    night: false, weather: "clear", music: "edm", accent: "#00C2C7",
    track: { width: 14.5, curviness: 0.65, hills: 0.5, size: 1.05 }, hazards: ["puddle", "rock", "spikes"],
    look: look({
      sky: ["#2AA6D0", "#0E6E94", "#06344A"], sun: { color: "#BFF6FF", dir: [0.2, 0.9, 0.2], intensity: 2.0, glow: 0.5 }, fog: [60, 560],
      hemi: ["#8AE8F2", "#1A4A5A", 1.1],
      ground: { colors: ["#D8C69A", "#E2D2A8", "#CBB88A"], hills: 0.5, mountain: "#3A7A8A", rock: "#4A6A70", detail: "sand", verge: "#D2C08F" },
      road: { kind: "glass", color: "#1E3A4A", line: "#7AF0FF", edge: "#FFD25A" }, curb: ["#FFD25A", "#1E3A4A"], curbs: "full", shoulder: "#C9B88A",
      barrier: { kind: "glass", color: "#7AF0FF" },
      props: [{ kind: "coral", density: 1.4 }, { kind: "kelp", density: 1.2 }, { kind: "seadome", density: 0.3 }, { kind: "anemone", density: 0.8 }, { kind: "fish", density: 0.5 }, { kind: "shipwreck", density: 0.06 }, { kind: "rock", density: 0.6, tint: ["#5A7A80", "#6A8A8A"] }],
      backdrop: [{ kind: "coral", color: "#2A7A8A", height: 200 }, { kind: "coral", color: "#1A5A6A", height: 140 }],
      underwater: true, shafts: "#BFF6FF", ambient: "bubbles", tunnels: { kind: "glass", count: 3, length: 80 },
      grass: { colors: ["#3AA07A", "#2E8A6A"], density: 0.6, flowers: ["#FF7A9A", "#FFB547", "#B78BFF"] },
    }),
  },
  // ------------------------------------------------------------------ 28
  {
    id: "rainbow-sky-road", name: "Rainbow Sky Road", emoji: "🌈", blurb: "The final challenge: a rainbow road high above the clouds.", order: 28,
    night: false, weather: "clear", music: "edm", accent: "#FF4FD8",
    track: { width: 14, curviness: 0.7, hills: 0.85, size: 1.1 }, hazards: ["oil", "spikes", "cones"],
    look: look({
      sky: ["#3E6EE8", "#FFD8F0", "#FFFFFF"], sun: { color: "#FFF8F0", dir: [0.4, 0.6, 0.4], intensity: 2.6, glow: 0.9 }, fog: [320, 2400],
      hemi: ["#FFFFFF", "#FFC8F0", 1.25],
      ground: { colors: ["#FFFFFF", "#F4F0FF", "#FFE8F6"], hills: 0.3, mountain: "#F2E8FF", detail: "none" },
      road: { kind: "rainbow", color: "#FFFFFF", line: "#FFFFFF", edge: "#FFFFFF" }, curb: ["#FFFFFF", "#FF4FD8"], curbs: "full", shoulder: "#F4F0FF",
      barrier: { kind: "neon", color: "#FF9BE8" },
      props: [{ kind: "cloudpuff", density: 1.4 }, { kind: "balloon", density: 0.6 }, { kind: "floatisland", density: 0.4 }, { kind: "starpickup", density: 0.5 }, { kind: "castle", density: 0.05 }],
      backdrop: [{ kind: "clouds", color: "#FFE0F4", height: 180 }, { kind: "clouds", color: "#FFFFFF", height: 120 }],
      floating: true, overhead: { kind: "rainbow", every: 260 }, clouds: 0.7,
    }),
  },
];

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
