// Gizmo Drive's twelve worlds, 50 stages each. Every world is its own place — its own painted backdrop layers, sky
// moods (each stage picks one), ground and contraption materials, what's down the pits, weather, ambience, music
// style, rides and favourite contraptions:
//   Toybox Town · Candy Works · Hard Hat Heights · Sky Isles · Neon Grid · Glacier Lab · Scrapyard Sunset ·
//   Glowshroom Woods · Coral Deep · Clockwork Kingdom · Haunted Carnival · Orbit Station
import type { VehicleId } from "./vehicles";

export type WorldId = "toybox" | "candy" | "hardhat" | "skyisles" | "neon" | "glacier" | "scrapyard" | "shroom" | "coral" | "clockwork" | "haunted" | "orbit";
export type ModuleKind =
  | "hills" | "bumps" | "kicker" | "steps" | "drop" | "tower" | "seesaw" | "collapse" | "lift" | "slider" | "conveyor"
  | "spring" | "gate" | "drawbridge" | "wrecker" | "pistons" | "balls" | "loop" | "tunnel" | "halfpipe" | "crates"
  | "fans" | "tilt" | "gear" | "ice" | "hops" | "trapdoor" | "rollers";
export type Ambient =
  | "chime" | "whistle" | "cuckoo" | "bubble" | "pop" | "jackhammer" | "reverse" | "clank" | "gust" | "bird" | "zap" | "blip"
  | "crack" | "howl" | "creak" | "crow" | "owl" | "frog" | "whale" | "tick" | "steam" | "bell" | "ghost" | "bat" | "radio" | "airlock";
export type Weather = "confetti" | "sprinkles" | "dust" | "wisps" | "neon" | "snow" | "sparks" | "spores" | "bubbles" | "steam" | "fog" | "stardust";
export type Liquid = "water" | "choc" | "void" | "cloud" | "grid" | "icewater" | "oil" | "goo" | "trench" | "steam" | "slime" | "space";

export interface Mood {
  name: string;
  sky: [string, string, string];
  /** sun / moon colour and its place (0..1 across, 0..1 down the sky) */
  sun: string; sunX: number; sunY: number;
  /** far layers fade into this */
  haze: string;
  /** a colour wash over everything, and how much */
  tint: string; tintAmt: number;
  /** 0 day … 1 night (lights, glows, stars) */
  night: number;
}

export interface WorldDef {
  id: WorldId;
  name: string;
  blurb: string;
  accent: string;
  moods: Mood[];
  /** backdrop layer colours, far → near */
  layers: [string, string, string, string];
  /** the ground blocks: top cap, body gradient, outline */
  ground: { cap: string; cap2: string; body: [string, string]; edge: string; detail: string };
  /** contraption materials */
  metal: { main: string; dark: string; light: string; hazard: [string, string]; glow: string };
  liquid: Liquid;
  gravity: number;
  weather: Weather;
  ambience: Ambient[];
  music: { style: string; bpm: number; root: number };
  vehicles: [VehicleId, number][];
  /** contraptions and shapes this world loves (weights) */
  pool: [ModuleKind, number][];
}

const M = (name: string, sky: [string, string, string], sun: string, sunX: number, sunY: number, haze: string, tint: string, tintAmt: number, night: number): Mood =>
  ({ name, sky, sun, sunX, sunY, haze, tint, tintAmt, night });

export const WORLDS: WorldDef[] = [
  {
    id: "toybox", name: "Toybox Town", blurb: "Block towers, crayon forests and a toy train", accent: "#FFB72B",
    moods: [
      M("Sunny morning", ["#6CC8FF", "#B4E6FF", "#FFF4DC"], "#FFF2B0", 0.78, 0.2, "#CDEBFF", "#FFE7B0", 0.06, 0),
      M("Bedtime glow", ["#5B6CD9", "#C69BE8", "#FFD2B8"], "#FFE2A8", 0.22, 0.55, "#E4C7F0", "#FFB4C8", 0.1, 0.25),
      M("Nightlight", ["#1D2459", "#3B3F8F", "#7E6BC4"], "#FFF6D0", 0.7, 0.22, "#5A5AA8", "#7C7CFF", 0.12, 0.8),
    ],
    layers: ["#B8D7F5", "#8CC2F0", "#79C77E", "#4FAE5E"],
    ground: { cap: "#69D17A", cap2: "#4CB862", body: ["#F2B45A", "#C9802E"], edge: "#5E3A16", detail: "#FFD58A" },
    metal: { main: "#4F8DF5", dark: "#2A4DA8", light: "#A9CCFF", hazard: ["#FFD23F", "#FF5A5F"], glow: "#FFE066" },
    liquid: "water", gravity: 10, weather: "confetti", ambience: ["chime", "whistle", "cuckoo"],
    music: { style: "M01", bpm: 112, root: 60 },
    vehicles: [["jeep", 4], ["buggy", 2], ["pickup", 1]],
    pool: [["hills", 3], ["bumps", 2], ["kicker", 3], ["steps", 2], ["seesaw", 2], ["crates", 2], ["drop", 2], ["gate", 1], ["spring", 1], ["hops", 2]],
  },
  {
    id: "candy", name: "Candy Works", blurb: "Lollipop groves, gumdrop hills and chocolate rivers", accent: "#FF6FB5",
    moods: [
      M("Strawberry noon", ["#FF8CC6", "#FFC2E0", "#FFF0DA"], "#FFF6E0", 0.7, 0.22, "#FFD6EA", "#FFB3D9", 0.06, 0),
      M("Caramel sunset", ["#B65FCF", "#FF9A8B", "#FFD39A"], "#FFE3A0", 0.3, 0.5, "#FFC4B0", "#FF9A6B", 0.1, 0.2),
      M("Midnight sugar", ["#2A1446", "#5B2A7A", "#C2549E"], "#FFE6F6", 0.75, 0.2, "#7A3E8E", "#B05CFF", 0.12, 0.75),
    ],
    layers: ["#F7B8DA", "#F28DC2", "#FF9FCB", "#E86AA8"],
    ground: { cap: "#FFF4FA", cap2: "#FFB8DC", body: ["#8A4B2D", "#5B2C17"], edge: "#3A1A0C", detail: "#C77B4E" },
    metal: { main: "#FF6FB5", dark: "#B83C7E", light: "#FFD1EA", hazard: ["#FFFFFF", "#FF4F8B"], glow: "#FFF07A" },
    liquid: "choc", gravity: 10, weather: "sprinkles", ambience: ["bubble", "pop", "whistle"],
    music: { style: "M05", bpm: 124, root: 62 },
    vehicles: [["jeep", 2], ["buggy", 2], ["monster", 2]],
    pool: [["conveyor", 3], ["collapse", 2], ["bumps", 2], ["spring", 3], ["hills", 2], ["balls", 2], ["pistons", 1], ["kicker", 1], ["rollers", 2]],
  },
  {
    id: "hardhat", name: "Hard Hat Heights", blurb: "Cranes, girders and lifts over a city at golden hour", accent: "#FFC233",
    moods: [
      M("Golden hour", ["#FF9C5B", "#FFCF8A", "#FFF0C4"], "#FFF0B0", 0.18, 0.62, "#FFD9A8", "#FFB060", 0.1, 0.1),
      M("Hazy noon", ["#5BB1EB", "#A8D8F2", "#F2EAD6"], "#FFFBE6", 0.65, 0.18, "#CFE0E8", "#FFE2A0", 0.05, 0),
      M("Night shift", ["#0F1A3A", "#273C6E", "#5C5A8A"], "#FFF4D8", 0.8, 0.2, "#3E4C78", "#4F7BFF", 0.1, 0.85),
    ],
    layers: ["#E9B98A", "#C98E64", "#7A6A64", "#4F4A52"],
    ground: { cap: "#5C5F6B", cap2: "#FFC233", body: ["#B9B4AA", "#8A857C"], edge: "#3A3833", detail: "#D6D0C4" },
    metal: { main: "#FFC233", dark: "#B07A0E", light: "#FFE38A", hazard: ["#FFC233", "#2A2A2A"], glow: "#FF5A3D" },
    liquid: "void", gravity: 10, weather: "dust", ambience: ["jackhammer", "reverse", "clank"],
    music: { style: "M06", bpm: 116, root: 57 },
    vehicles: [["pickup", 3], ["tractor", 2], ["monster", 1], ["bus", 1]],
    pool: [["lift", 3], ["slider", 2], ["wrecker", 3], ["steps", 2], ["drawbridge", 2], ["crates", 2], ["tower", 1], ["gate", 1], ["trapdoor", 2]],
  },
  {
    id: "skyisles", name: "Sky Isles", blurb: "Floating islands, waterfalls and drifting balloons", accent: "#38BDF8",
    moods: [
      M("Bright skies", ["#2E9BEF", "#86CCF7", "#E6F6FF"], "#FFFBE0", 0.75, 0.18, "#CBE9FB", "#FFFFFF", 0, 0),
      M("Pink dawn", ["#7A8CE8", "#F4A6C8", "#FFE4C4"], "#FFF0C8", 0.2, 0.55, "#F3D1E0", "#FFB0C0", 0.08, 0.1),
      M("Starlit isles", ["#0B1640", "#24387A", "#5C6FB8"], "#F4F6FF", 0.68, 0.2, "#3A4C8A", "#7C9CFF", 0.1, 0.85),
    ],
    layers: ["#BFE3F8", "#9AD1F2", "#7CCB8A", "#55B06B"],
    ground: { cap: "#7EDB7A", cap2: "#4FBF62", body: ["#A88C77", "#6E5848"], edge: "#3E3128", detail: "#C9B29E" },
    metal: { main: "#F5F1E6", dark: "#B8A88A", light: "#FFFFFF", hazard: ["#38BDF8", "#FFFFFF"], glow: "#FFE066" },
    liquid: "cloud", gravity: 9.5, weather: "wisps", ambience: ["gust", "bird", "bell"],
    music: { style: "M13", bpm: 100, root: 62 },
    vehicles: [["buggy", 2], ["jeep", 2], ["rod", 1]],
    pool: [["kicker", 3], ["slider", 2], ["collapse", 3], ["fans", 2], ["spring", 2], ["drop", 2], ["tilt", 1], ["hills", 1], ["hops", 3]],
  },
  {
    id: "neon", name: "Neon Grid", blurb: "A synthwave city of light, loops and laser-lit ramps", accent: "#FF3DCB",
    moods: [
      M("Neon dusk", ["#1A0B3D", "#5A1A7A", "#FF5FA2"], "#FFD36B", 0.5, 0.62, "#7A2A8A", "#FF4FD8", 0.08, 0.7),
      M("Cyber night", ["#060A24", "#132A5E", "#2BB6D9"], "#C9F7FF", 0.3, 0.3, "#1E3E70", "#38E8FF", 0.1, 0.9),
      M("Ultraviolet", ["#12052A", "#3B0F6B", "#8F3BFF"], "#FFB8F2", 0.72, 0.55, "#4C1E80", "#B05CFF", 0.12, 0.85),
    ],
    layers: ["#3A1B66", "#2A1452", "#1C0E3A", "#120827"],
    ground: { cap: "#2BF6FF", cap2: "#FF3DCB", body: ["#2A1850", "#140B2E"], edge: "#05030F", detail: "#5A3A9A" },
    metal: { main: "#2A1F4F", dark: "#120B26", light: "#6E5BC4", hazard: ["#2BF6FF", "#FF3DCB"], glow: "#2BF6FF" },
    liquid: "grid", gravity: 10, weather: "neon", ambience: ["zap", "blip", "radio"],
    music: { style: "M10", bpm: 108, root: 57 },
    vehicles: [["rod", 3], ["buggy", 2], ["jeep", 1]],
    pool: [["loop", 3], ["kicker", 2], ["pistons", 2], ["gate", 2], ["conveyor", 2], ["bumps", 1], ["spring", 1], ["halfpipe", 1], ["hops", 2], ["trapdoor", 2]],
  },
  {
    id: "glacier", name: "Glacier Lab", blurb: "Ice slopes, crystal caves and a lab under the aurora", accent: "#7CE3FF",
    moods: [
      M("Frosty morning", ["#5AB6F0", "#B8E4FA", "#F2FBFF"], "#FFFFFF", 0.72, 0.22, "#DCF1FC", "#C8F0FF", 0.06, 0),
      M("Aurora night", ["#06142E", "#103A5C", "#2A7A8A"], "#E8FFF8", 0.25, 0.2, "#1E4A66", "#3DF5C2", 0.1, 0.9),
      M("Blue hour", ["#2B3F8C", "#6C8ED0", "#C9D8F2"], "#F4F8FF", 0.6, 0.45, "#9CB4E0", "#9CC8FF", 0.08, 0.4),
    ],
    layers: ["#CFE8F7", "#A8D4EE", "#E6F5FC", "#BFE2F3"],
    ground: { cap: "#FFFFFF", cap2: "#DDF3FF", body: ["#8FD3F2", "#4FA3D1"], edge: "#1E5A80", detail: "#C8EEFF" },
    metal: { main: "#E4EEF6", dark: "#7E96AE", light: "#FFFFFF", hazard: ["#FF5A5F", "#FFFFFF"], glow: "#7CE3FF" },
    liquid: "icewater", gravity: 10, weather: "snow", ambience: ["crack", "howl", "whale"],
    music: { style: "M18", bpm: 96, root: 64 },
    vehicles: [["monster", 2], ["pickup", 2], ["jeep", 1]],
    pool: [["ice", 3], ["halfpipe", 2], ["tilt", 2], ["collapse", 2], ["lift", 1], ["tunnel", 2], ["hills", 1], ["kicker", 1], ["rollers", 1]],
  },
  {
    id: "scrapyard", name: "Scrapyard Sunset", blurb: "Junk mountains, magnet cranes and rolling barrels", accent: "#FF7A3D",
    moods: [
      M("Rusty sunset", ["#E8553D", "#FFA061", "#FFE0A0"], "#FFE6A0", 0.3, 0.6, "#F2B98A", "#FF8A50", 0.12, 0.15),
      M("Smoggy noon", ["#8CB0C9", "#C9CFC2", "#EDE2C8"], "#FFF6D8", 0.7, 0.2, "#D2CDBC", "#D8B87A", 0.08, 0),
      M("Oil-lamp night", ["#1A1420", "#3E2A33", "#7A4A3A"], "#FFD9A0", 0.75, 0.25, "#4A3638", "#FF9A40", 0.1, 0.8),
    ],
    layers: ["#C98A6A", "#9A6450", "#6E4A3E", "#4A332C"],
    ground: { cap: "#7A5A44", cap2: "#5A4232", body: ["#8E6B58", "#5E4436"], edge: "#2A1C16", detail: "#B08A70" },
    metal: { main: "#C26A3A", dark: "#6E3518", light: "#E8A878", hazard: ["#FFC233", "#2A2A2A"], glow: "#FF9A3D" },
    liquid: "oil", gravity: 10, weather: "sparks", ambience: ["creak", "crow", "clank"],
    music: { style: "M04", bpm: 132, root: 55 },
    vehicles: [["tractor", 2], ["monster", 2], ["pickup", 1]],
    pool: [["balls", 3], ["wrecker", 2], ["crates", 2], ["seesaw", 2], ["drawbridge", 1], ["tower", 2], ["bumps", 1], ["steps", 1], ["rollers", 2]],
  },
  {
    id: "shroom", name: "Glowshroom Woods", blurb: "A glowing forest of giant mushrooms and fireflies", accent: "#3DF5A7",
    moods: [
      M("Glow night", ["#0A1530", "#1C2E5E", "#3A2A70"], "#E6F0FF", 0.7, 0.18, "#2A3A6E", "#3DF5A7", 0.08, 0.9),
      M("Twilight", ["#3A2A7A", "#8A5AB8", "#F0A0C0"], "#FFE0D0", 0.25, 0.55, "#9A78C0", "#C890FF", 0.1, 0.5),
      M("Misty dawn", ["#6E8CC8", "#B8C8E8", "#F0E8F2"], "#FFF4E0", 0.75, 0.3, "#C8D2EC", "#B0E8D0", 0.08, 0.15),
    ],
    layers: ["#2A3A70", "#24305E", "#1C2650", "#141C3E"],
    ground: { cap: "#3DD68C", cap2: "#28A86A", body: ["#3A2E52", "#211934"], edge: "#0C0814", detail: "#5A4A7A" },
    metal: { main: "#8A6BD1", dark: "#4A3480", light: "#C8B4FF", hazard: ["#3DF5A7", "#2A1F4F"], glow: "#3DF5A7" },
    liquid: "goo", gravity: 10, weather: "spores", ambience: ["owl", "frog", "chime"],
    music: { style: "M03", bpm: 86, root: 60 },
    vehicles: [["jeep", 2], ["buggy", 1], ["monster", 1], ["tractor", 1]],
    pool: [["spring", 3], ["hills", 2], ["tunnel", 2], ["tilt", 2], ["collapse", 2], ["bumps", 1], ["seesaw", 1], ["kicker", 1], ["hops", 2]],
  },
  {
    id: "coral", name: "Coral Deep", blurb: "Driving the sea floor between coral towers and bubble vents", accent: "#2EE6D6",
    moods: [
      M("Sunlit shallows", ["#0C5C8C", "#1890B8", "#5ED6E6"], "#E6FFFF", 0.6, 0.0, "#2A9AC0", "#2EE6D6", 0.08, 0.2),
      M("Twilight reef", ["#0A2A5C", "#164E8C", "#3A8AC8"], "#C8F0FF", 0.3, 0.0, "#1E5A90", "#5A8CFF", 0.1, 0.5),
      M("Abyss glow", ["#030A1E", "#0A1E40", "#143A66"], "#9AF0FF", 0.7, 0.0, "#0E2A50", "#3DF5E0", 0.1, 0.9),
    ],
    layers: ["#1E6E9A", "#18608A", "#145478", "#0E4262"],
    ground: { cap: "#FF8A7A", cap2: "#FFB46B", body: ["#E8D2A0", "#B89E6E"], edge: "#5A4628", detail: "#F6E6C0" },
    metal: { main: "#F2C14E", dark: "#9A6A1A", light: "#FFE6A0", hazard: ["#2EE6D6", "#0E4262"], glow: "#7CF5FF" },
    liquid: "trench", gravity: 7.5, weather: "bubbles", ambience: ["bubble", "whale", "chime"],
    music: { style: "M15", bpm: 96, root: 65 },
    vehicles: [["moonbug", 2], ["jeep", 1], ["monster", 1]],
    pool: [["fans", 3], ["slider", 2], ["halfpipe", 2], ["balls", 2], ["drop", 1], ["hills", 2], ["kicker", 1], ["seesaw", 1], ["rollers", 1]],
  },
  {
    id: "clockwork", name: "Clockwork Kingdom", blurb: "Brass gears, pistons and clock towers puffing steam", accent: "#E8A33D",
    moods: [
      M("Brass sunset", ["#6E3A22", "#C77A3A", "#F4C87E"], "#FFE6B0", 0.5, 0.55, "#D69A60", "#FFB060", 0.12, 0.25),
      M("Copper noon", ["#7FA6C0", "#C8C2A8", "#F0DFB8"], "#FFF6DC", 0.7, 0.2, "#D8CBAA", "#E8C080", 0.08, 0),
      M("Gaslight night", ["#120E1E", "#2E2238", "#5A3E3E"], "#FFE8C0", 0.3, 0.22, "#3E3040", "#FFB050", 0.1, 0.85),
    ],
    layers: ["#B88A5E", "#946A48", "#6E4E36", "#4E3626"],
    ground: { cap: "#D99A4E", cap2: "#A86A2E", body: ["#7A5A3E", "#4E3826"], edge: "#22160C", detail: "#A88058" },
    metal: { main: "#D9A24A", dark: "#7A5218", light: "#FFE0A0", hazard: ["#E8A33D", "#3A2410"], glow: "#FFB050" },
    liquid: "steam", gravity: 10, weather: "steam", ambience: ["tick", "steam", "bell"],
    music: { style: "M14", bpm: 120, root: 58 },
    vehicles: [["tractor", 1], ["rod", 1], ["bus", 2], ["pickup", 1]],
    pool: [["gear", 3], ["pistons", 3], ["gate", 2], ["lift", 2], ["conveyor", 2], ["wrecker", 2], ["drawbridge", 1], ["steps", 1], ["trapdoor", 2], ["rollers", 2]],
  },
  {
    id: "haunted", name: "Haunted Carnival", blurb: "A spooky fair: coaster loops, ghost lights and a big moon", accent: "#B06BFF",
    moods: [
      M("Full moon", ["#120A2A", "#3B1D5E", "#7A3B8F"], "#FFF6D8", 0.72, 0.2, "#4A2A6E", "#9A5CFF", 0.1, 0.9),
      M("Witching dusk", ["#2A1238", "#7A2A5A", "#E87A4A"], "#FFD8A0", 0.3, 0.6, "#8A4060", "#FF7A50", 0.1, 0.55),
      M("Green fog", ["#08140F", "#163A2A", "#3A6A48"], "#E8FFD8", 0.25, 0.22, "#24503A", "#6BFF9A", 0.1, 0.9),
    ],
    layers: ["#3A2456", "#2E1C46", "#241538", "#180E28"],
    ground: { cap: "#5E3A7A", cap2: "#3E2456", body: ["#3A2A3E", "#1E1424"], edge: "#0A060C", detail: "#5A4660" },
    metal: { main: "#C0392B", dark: "#6E1A12", light: "#FF8A7A", hazard: ["#FFE7A0", "#C0392B"], glow: "#FFB547" },
    liquid: "slime", gravity: 10, weather: "fog", ambience: ["ghost", "bat", "crow"],
    music: { style: "M17", bpm: 104, root: 55 },
    vehicles: [["bus", 1], ["rod", 2], ["monster", 1], ["jeep", 1]],
    pool: [["loop", 2], ["seesaw", 2], ["collapse", 2], ["wrecker", 2], ["spring", 2], ["tunnel", 1], ["halfpipe", 1], ["drawbridge", 1], ["trapdoor", 3]],
  },
  {
    id: "orbit", name: "Orbit Station", blurb: "Low gravity among solar panels, airlocks and asteroids", accent: "#5EA2FF",
    moods: [
      M("Earthrise", ["#03050E", "#0B1434", "#1E2D6E"], "#FFFFFF", 0.75, 0.25, "#18245A", "#5EA2FF", 0.08, 1),
      M("Nebula drift", ["#0A0418", "#2A0E46", "#6A2A7A"], "#FFE6FF", 0.3, 0.3, "#3A1A5A", "#FF6BD8", 0.1, 1),
      M("Solar flare", ["#120604", "#3A1608", "#8A3A12"], "#FFE0A0", 0.2, 0.4, "#5A2A12", "#FF9A3D", 0.1, 0.9),
    ],
    layers: ["#1A2250", "#141A40", "#10142E", "#0A0D20"],
    ground: { cap: "#C8D2E6", cap2: "#FFC233", body: ["#5A6480", "#343C54"], edge: "#10131E", detail: "#8A94B0" },
    metal: { main: "#D6DEEC", dark: "#6A7490", light: "#FFFFFF", hazard: ["#FFC233", "#22283A"], glow: "#5EA2FF" },
    liquid: "space", gravity: 4.4, weather: "stardust", ambience: ["radio", "airlock", "zap"],
    music: { style: "M02", bpm: 126, root: 57 },
    vehicles: [["moonbug", 3], ["buggy", 1], ["jeep", 1]],
    pool: [["kicker", 3], ["fans", 2], ["slider", 2], ["lift", 2], ["loop", 1], ["gear", 1], ["pistons", 1], ["drop", 1], ["hops", 2]],
  },
];

export const STAGES_PER_WORLD = 50;
export const DESIGNED_STAGES = WORLDS.length * STAGES_PER_WORLD;
export const worldOf = (id: WorldId) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
