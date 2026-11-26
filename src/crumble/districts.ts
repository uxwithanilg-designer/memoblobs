// Crumble Crew's twelve districts, 100 heists each (1200 in all). Every district has its own block palette (painted
// into a pixel atlas in art/atlas.ts), its own kinds of building to break into, a big painted backdrop around the
// lot (a red-brick town with a water tower and church, desert mesas, a frozen harbour with cranes, a neon strip, jungle
// temples, a volcano over the lava works, a pirate cove with a lighthouse, floating cloud isles, a blossom market with
// pagodas, the moon colony under the Earth, the crystal mines, and Baron Bolt's tower city), its own security robots,
// music, ambience, times of day and weather, and its own street names for the sites of a heist.

export type DistrictId = "maple" | "dune" | "frost" | "neon" | "jungle" | "lava" | "pirate" | "cloud" | "blossom" | "moon" | "crystal" | "tower";
export type TimeOfDay = "morning" | "day" | "golden" | "dusk" | "night";
export type Weather = "clear" | "rain" | "snow" | "dust" | "embers" | "leaves" | "fireflies" | "spores" | "stars" | "petals";
export type Backdrop = "town" | "desert" | "harbor" | "skyline" | "temples" | "volcano" | "coast" | "islands" | "pagodas" | "craters" | "crystals" | "megatower";
export type BuildingKind = "bank" | "jeweler" | "museum" | "casino" | "mansion" | "warehouse" | "temple" | "observatory" | "lab" | "vaulthall";
export type BotKind = "guard" | "hound" | "drone" | "turret" | "shield" | "heavy";
export type Ambient = "birdA" | "birdB" | "gust" | "traffic" | "gull" | "chime" | "hum" | "drip" | "lava" | "surf" | "parrot" | "cricket" | "machine" | "beeps";
export type Ground = "grass" | "sand" | "snow" | "street" | "jungle" | "ash" | "beach" | "cloud" | "moon" | "chrome";

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  sky: [string, string, string];
  fog: string;
  sun: string;
  ambient: string;
  ground: Ground;
  /** the lot (grass, path, earth) and the buildings' blocks */
  palette: { top: string; side: string; road: string; wall: string; wall2: string; trim: string; roof: string; floor: string; glass: string; accent: string; leaf: string };
  backdrop: Backdrop;
  buildings: BuildingKind[];
  bots: [BotKind, number][];
  gravity: number;
  times: TimeOfDay[];
  weathers: Weather[];
  ambience: Ambient[];
  accent: string;
  band: { style: string; bpm: number; root: number };
  /** the streets the sites of a heist are on */
  places: string[];
}

export const HEISTS_PER_DISTRICT = 100;

export const DISTRICTS: District[] = [
  {
    id: "maple", name: "Maple Town", blurb: "Red-brick banks, picket fences and a sleepy main street.",
    sky: ["#3E8EE8", "#8CC8F8", "#E2F4FF"], fog: "#C6E4FF", sun: "#FFF4D0", ambient: "#9AB8E8", ground: "grass",
    palette: { top: "#5CC043", side: "#8A5A36", road: "#5A5E6E", wall: "#B8503A", wall2: "#F2EAD8", trim: "#E8E0D0", roof: "#3A4A6A", floor: "#B8865A", glass: "#9AD8F8", accent: "#FFD23F", leaf: "#3E9A3A" },
    backdrop: "town", buildings: ["bank", "jeweler", "mansion"], bots: [["guard", 4], ["hound", 2], ["drone", 1.5], ["turret", 1]], gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "clear", "leaves", "rain"], ambience: ["birdA", "birdB", "gust"],
    accent: "#FFB23A", band: { style: "M14", bpm: 120, root: 60 },
    places: ["Maple Street", "Oak Avenue", "Main Square", "Mill Lane", "Church Road", "Bakery Corner", "Elm Court", "Station Road", "Pond Lane", "Clock Tower Plaza", "Cherry Row", "Harvest Way"],
  },
  {
    id: "dune", name: "Dune City", blurb: "Sandstone vaults and saloon banks under the desert sun.",
    sky: ["#3A78D0", "#F0B070", "#FFE0A8"], fog: "#F4C890", sun: "#FFE8B0", ambient: "#D8A878", ground: "sand",
    palette: { top: "#E8B060", side: "#C0703C", road: "#B88A5A", wall: "#E0B080", wall2: "#C88A50", trim: "#7A3A20", roof: "#9A4A2A", floor: "#A86A3A", glass: "#A8D8E8", accent: "#3AA8C8", leaf: "#6A9A3A" },
    backdrop: "desert", buildings: ["bank", "museum", "warehouse"], bots: [["guard", 3], ["hound", 2.5], ["drone", 1.5], ["turret", 1.5], ["heavy", 0.6]], gravity: 22,
    times: ["day", "golden", "golden", "dusk"], weathers: ["clear", "dust", "clear"], ambience: ["gust"],
    accent: "#FF9A3C", band: { style: "M08", bpm: 112, root: 57 },
    places: ["Cactus Street", "Gold Rush Road", "Mesa View", "Rattler Row", "Sunset Trail", "Dry Creek", "Copper Square", "Dust Lane", "Canyon Gate", "Oasis Avenue", "Bone Gulch", "Eagle Pass"],
  },
  {
    id: "frost", name: "Frost Harbor", blurb: "Snowy docks, ice-cold vaults and the northern lights.",
    sky: ["#5A8AD8", "#A8CCF0", "#EEF6FF"], fog: "#DDEBFA", sun: "#FFFFFF", ambient: "#B8CCE8", ground: "snow",
    palette: { top: "#F4FAFF", side: "#8AA8C8", road: "#6A7A8A", wall: "#8A9AB0", wall2: "#E8EEF4", trim: "#3A6AA8", roof: "#C84A3A", floor: "#8A6A4A", glass: "#B8E8FF", accent: "#7CD8FF", leaf: "#2E6A4A" },
    backdrop: "harbor", buildings: ["warehouse", "bank", "observatory"], bots: [["guard", 3], ["drone", 2.5], ["shield", 1.2], ["turret", 1.5], ["hound", 1]], gravity: 22,
    times: ["morning", "day", "night", "night"], weathers: ["snow", "snow", "clear"], ambience: ["gust", "gull"],
    accent: "#7CD8FF", band: { style: "M11", bpm: 160, root: 62 },
    places: ["Pier 7", "Icebreaker Quay", "Harbor Road", "Lighthouse Lane", "Frozen Wharf", "Pine Street", "Aurora Avenue", "Crane Yard", "Snowcap Square", "Glacier Row", "Fishmarket", "North Dock"],
  },
  {
    id: "neon", name: "Neon Strip", blurb: "Casinos and jewelers that never sleep.",
    sky: ["#0C1030", "#2A2460", "#7A3A8A"], fog: "#3A2A5A", sun: "#E0D8FF", ambient: "#6A5AAA", ground: "street",
    palette: { top: "#5A6080", side: "#3E4260", road: "#3A3E52", wall: "#4A4A6A", wall2: "#2A2A40", trim: "#FF4FD8", roof: "#22223A", floor: "#3A2A4A", glass: "#7AE8FF", accent: "#5BF0FF", leaf: "#3E8A5A" },
    backdrop: "skyline", buildings: ["casino", "jeweler", "lab"], bots: [["guard", 3], ["drone", 3], ["shield", 1.5], ["turret", 2], ["heavy", 1]], gravity: 22,
    times: ["night", "night", "dusk"], weathers: ["rain", "clear", "rain"], ambience: ["traffic", "hum"],
    accent: "#FF4FD8", band: { style: "M10", bpm: 112, root: 59 },
    places: ["Lucky Lane", "Jackpot Avenue", "Neon Row", "Arcade Street", "Skybridge", "High Roller Plaza", "Midnight Mile", "Dice Court", "Glow Street", "Rooftop 9", "Velvet Alley", "Chrome Boulevard"],
  },
  {
    id: "jungle", name: "Jungle Ruins", blurb: "Treasure temples swallowed by vines and waterfalls.",
    sky: ["#4FA0E8", "#9AD6D8", "#E0F8E0"], fog: "#B8E8C8", sun: "#FFF6D0", ambient: "#8AC8A0", ground: "jungle",
    palette: { top: "#3AA84A", side: "#6A4A30", road: "#8A9A7A", wall: "#8A9A7A", wall2: "#6A7A5A", trim: "#C8A040", roof: "#4A6A3A", floor: "#7A6A4A", glass: "#A8F0D8", accent: "#FFD23F", leaf: "#2A8A3A" },
    backdrop: "temples", buildings: ["temple", "museum", "mansion"], bots: [["guard", 3], ["hound", 3], ["drone", 2], ["turret", 1], ["shield", 1]], gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "rain", "fireflies", "leaves"], ambience: ["parrot", "drip", "birdB"],
    accent: "#3EE08F", band: { style: "M16", bpm: 108, root: 58 },
    places: ["Vine Steps", "Idol Court", "Serpent Path", "Waterfall Ledge", "Jade Pool", "Moss Gate", "Parrot Grove", "Lost Altar", "Fern Gully", "Tiger Rock", "Sunken Stair", "Canopy Walk"],
  },
  {
    id: "lava", name: "Lava Works", blurb: "Baron Bolt's foundries and vaults on a smoking volcano.",
    sky: ["#3A2030", "#9A4A3A", "#F0904A"], fog: "#7A3A30", sun: "#FFC890", ambient: "#9A5A4A", ground: "ash",
    palette: { top: "#5A4A48", side: "#3A2E2C", road: "#2A2020", wall: "#6A5A5A", wall2: "#4A3A3A", trim: "#FF6A2A", roof: "#2A2226", floor: "#4A3A34", glass: "#FFB070", accent: "#FFB03A", leaf: "#4A5A3A" },
    backdrop: "volcano", buildings: ["lab", "warehouse", "vaulthall"], bots: [["guard", 3], ["heavy", 2], ["hound", 2], ["turret", 2], ["shield", 1.5]], gravity: 22,
    times: ["dusk", "night", "day"], weathers: ["embers", "embers", "clear"], ambience: ["machine", "lava"],
    accent: "#FF6A2A", band: { style: "M19", bpm: 140, root: 52 },
    places: ["Slag Street", "Smelter 3", "Crane Yard", "Furnace Row", "Ash Lane", "Forge Hall", "Pipe Alley", "Molten Bridge", "Cinder Deck", "Ingot Bay", "Vent Ridge", "Ember Court"],
  },
  {
    id: "pirate", name: "Pirate Cove", blurb: "Treasure houses on a palm-fringed bay.",
    sky: ["#3A9AF0", "#8AD8F8", "#F0FCFF"], fog: "#BCE8F8", sun: "#FFFBE0", ambient: "#9AD0E8", ground: "beach",
    palette: { top: "#F0D890", side: "#D8B070", road: "#B89A6A", wall: "#A8703E", wall2: "#E8E0D0", trim: "#2A6AA8", roof: "#C84A3A", floor: "#8A5A36", glass: "#A8E8F8", accent: "#FFD23F", leaf: "#3EA84A" },
    backdrop: "coast", buildings: ["warehouse", "mansion", "museum"], bots: [["guard", 3], ["hound", 2], ["drone", 2.5], ["turret", 1.5], ["heavy", 0.8]], gravity: 22,
    times: ["day", "golden", "golden", "dusk"], weathers: ["clear", "clear", "rain"], ambience: ["surf", "gull"],
    accent: "#2AC8D8", band: { style: "M15", bpm: 98, root: 64 },
    places: ["Skull Bay", "Palm Cove", "Shipwreck Wharf", "Parrot Pier", "Doubloon Street", "Cannon Point", "Tide Pools", "Anchor Lane", "Treasure Row", "Lagoon Isle", "Shell Beach", "Rum Barrel Quay"],
  },
  {
    id: "cloud", name: "Cloud Isles", blurb: "Floating mansions and observatories above the clouds.",
    sky: ["#4A9AF8", "#9AD0FF", "#F4FAFF"], fog: "#D8ECFF", sun: "#FFFBE8", ambient: "#B0D0F8", ground: "cloud",
    palette: { top: "#7CD86A", side: "#A88A68", road: "#D8D0C0", wall: "#E8E0F0", wall2: "#B8C8E8", trim: "#3A6AD8", roof: "#5A7AD8", floor: "#C8A878", glass: "#C8F0FF", accent: "#FFD23F", leaf: "#5CC060" },
    backdrop: "islands", buildings: ["observatory", "mansion", "bank"], bots: [["drone", 4], ["guard", 2], ["turret", 2], ["shield", 1], ["hound", 1]], gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["clear", "petals", "clear"], ambience: ["gust", "chime"],
    accent: "#7CE7FF", band: { style: "M06", bpm: 122, root: 61 },
    places: ["Cloud Dock", "Balloon Field", "Wind Spire", "Rainbow Span", "Kite Terrace", "Drift Isle", "Feather Rock", "Cirrus Port", "Sky Garden", "High Mooring", "Gust Ridge", "Halo Square"],
  },
  {
    id: "blossom", name: "Blossom Market", blurb: "Jade jewelers and temple vaults under cherry blossom.",
    sky: ["#6A9AE8", "#F4C4D8", "#FFF0F4"], fog: "#F4DAE6", sun: "#FFF0E0", ambient: "#E8B8D0", ground: "grass",
    palette: { top: "#86C85A", side: "#7A5238", road: "#C8B898", wall: "#F2E8D8", wall2: "#C83A3A", trim: "#2A1A22", roof: "#3A2A3A", floor: "#B88A5A", glass: "#F8E0EC", accent: "#E8B030", leaf: "#F4A0C8" },
    backdrop: "pagodas", buildings: ["temple", "jeweler", "mansion"], bots: [["guard", 3], ["hound", 2], ["drone", 2], ["shield", 1.5], ["turret", 1.5]], gravity: 22,
    times: ["morning", "day", "golden", "dusk"], weathers: ["petals", "petals", "clear", "rain"], ambience: ["birdA", "chime"],
    accent: "#FF8AC8", band: { style: "M20", bpm: 122, root: 63 },
    places: ["Petal Lane", "Koi Pond", "Lantern Road", "Pagoda Hill", "Bamboo Grove", "Moon Bridge", "Tea House Row", "Maple Steps", "Jade Market", "Blossom Gate", "Stone Garden", "Silk Street"],
  },
  {
    id: "moon", name: "Moon Colony", blurb: "Space labs and gold vaults under the Earth.",
    sky: ["#05060F", "#101530", "#2A2A4A"], fog: "#1A1C30", sun: "#F4F0FF", ambient: "#6A6A9A", ground: "moon",
    palette: { top: "#B8B8C4", side: "#8A8A98", road: "#6A6A78", wall: "#D8DCE8", wall2: "#8A90A0", trim: "#4AA8FF", roof: "#5A5E6E", floor: "#7A7E8E", glass: "#9AF0FF", accent: "#FFD23F", leaf: "#6AC88A" },
    backdrop: "craters", buildings: ["lab", "observatory", "vaulthall"], bots: [["drone", 3], ["guard", 2.5], ["shield", 2], ["turret", 2], ["heavy", 1.2]], gravity: 9,
    times: ["night"], weathers: ["stars"], ambience: ["beeps", "hum"],
    accent: "#9AF0FF", band: { style: "M02", bpm: 126, root: 55 },
    places: ["Tranquil Base", "Crater Rim", "Dome 4", "Regolith Flats", "Earthrise Ridge", "Helium Mine", "Rover Bay", "Launch Pad", "Dust Sea", "Antenna Hill", "Lava Tube", "Dark Side"],
  },
  {
    id: "crystal", name: "Crystal Mines", blurb: "Gem vaults deep in a violet crystal waste.",
    sky: ["#1A1040", "#5A3A9A", "#C88AE8"], fog: "#5A3A8A", sun: "#F0D8FF", ambient: "#8A6AC8", ground: "moon",
    palette: { top: "#8A7AA8", side: "#5A4A78", road: "#4A3E68", wall: "#A898C8", wall2: "#6A5A8A", trim: "#5BF0FF", roof: "#3A2E58", floor: "#5A4A6A", glass: "#E0B0FF", accent: "#E07CFF", leaf: "#B87CE8" },
    backdrop: "crystals", buildings: ["vaulthall", "lab", "museum"], bots: [["drone", 3], ["heavy", 2], ["shield", 2], ["guard", 2], ["turret", 2], ["hound", 1.5]], gravity: 22,
    times: ["dusk", "night", "golden"], weathers: ["spores", "clear", "stars"], ambience: ["hum", "chime", "drip"],
    accent: "#E07CFF", band: { style: "M05", bpm: 132, root: 56 },
    places: ["Amethyst Field", "Shard Canyon", "Glow Caverns", "Prism Lake", "Geode Hollow", "Quartz Spires", "Echo Rift", "Violet Ridge", "Crystal Arch", "Lumen Flats", "Spark Gulch", "Opal Basin"],
  },
  {
    id: "tower", name: "Bolt Tower City", blurb: "Baron Bolt's own vaults — the final heists.",
    sky: ["#1A0A1A", "#4A1A2A", "#9A3A3A"], fog: "#3A1A22", sun: "#FFD0C0", ambient: "#7A4A5A", ground: "chrome",
    palette: { top: "#9AA0B0", side: "#5A606E", road: "#3A3E4A", wall: "#7A808E", wall2: "#4A4E5A", trim: "#FF2A3A", roof: "#2A2E3A", floor: "#5A5E6E", glass: "#FF8A9A", accent: "#FFD23F", leaf: "#5A7A5A" },
    backdrop: "megatower", buildings: ["casino", "vaulthall", "bank"], bots: [["guard", 3], ["heavy", 2.5], ["shield", 2], ["drone", 2], ["turret", 2.5], ["hound", 2]], gravity: 22,
    times: ["night", "dusk"], weathers: ["embers", "clear", "rain"], ambience: ["machine", "hum"],
    accent: "#FF4A5A", band: { style: "M13", bpm: 128, root: 53 },
    places: ["Bolt Plaza", "Gatehouse", "Drone Hangar", "Reactor Ring", "Gold Hall", "Assembly Line", "Command Deck", "Red Spire", "Iron Court", "Signal Tower", "Vault Gate", "Baron's Keep"],
  },
];
export const DESIGNED_HEISTS = DISTRICTS.length * HEISTS_PER_DISTRICT;
export const districtOf = (id: DistrictId) => DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0];
