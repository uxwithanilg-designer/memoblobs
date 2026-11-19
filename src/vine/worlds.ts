// The 30 green worlds of Tondu's Vine Climb (20 stages each), the 30 bugs Tondu snaps, the guardians of each world's
// stage 20 and the stage concepts. Everything is greenery-first: each world is mostly greens with one accent colour.

export type Weather = "day" | "golden" | "dusk" | "night" | "rain" | "mist" | "storm";
export type Prop =
  | "tree" | "fern" | "bamboo" | "banana" | "mango" | "palm" | "teabush" | "lotus" | "rose" | "mushroom" | "sunflower"
  | "ruin" | "waterfall" | "roots" | "gourd" | "orchid" | "mangrove" | "pine" | "pepper" | "blossom" | "temple" | "glow"
  | "bramble" | "cloud" | "island" | "giant" | "hedge";

export interface World {
  n: number; name: string; music: string;
  /** concepts this world introduces (the rest of the world mixes them with earlier ones) */
  adds: string[];
  tip: string;
  bug: number;
  guardian: string;
  weather: Weather;
  /** sky top / horizon, fog, sun colour */
  sky: [string, string]; fog: string; sun: string;
  /** vine body, its stripes, its leaves */
  vine: [string, string, string];
  /** foliage greens (near, mid, far) and the trunk */
  leaf: [string, string, string]; trunk: string;
  /** the world's accent (flowers, fruit, glow) */
  accent: string;
  props: Prop[];
}

const W = (n: number, name: string, music: string, adds: string[], tip: string, guardian: string, weather: Weather,
  sky: [string, string], fog: string, sun: string, vine: [string, string, string], leaf: [string, string, string],
  trunk: string, accent: string, props: Prop[]): World => ({ n, name, music, adds, tip, bug: n - 1, guardian, weather, sky, fog, sun, vine, leaf, trunk, accent, props });

export const WORLDS: World[] = [
  W(1, "Backyard Garden", "garden", ["classic", "feast"], "Tap to flip round the vine. Thorns only grow on one side!", "kaaki1", "day",
    ["#7EC8F0", "#E6F7D2"], "#CDEBC0", "#FFF4D6", ["#3E9B2F", "#2C7A22", "#66C24A"], ["#4FAF3A", "#3A8F2C", "#8CCB78"], "#7A5A3A", "#FF8A3D", ["tree", "hedge", "fern"]),
  W(2, "Mango Orchard", "orchard", ["fruit", "hairpin"], "Fruit falls where its shadow is. Flip away from the shadow.", "monkey", "golden",
    ["#8FD0F2", "#F6F2C8"], "#E3EFC4", "#FFE7B0", ["#43A034", "#2E7C24", "#6CC650"], ["#3F9E36", "#2F8A2A", "#93C77A"], "#6E4E30", "#FFB21E", ["mango", "tree", "fern"]),
  W(3, "Bamboo Grove", "bamboo", ["cling", "bamboo", "ants"], "Hold to cling and slow down — wait for the thistle buds to close.", "beetle", "day",
    ["#9AD8E8", "#E8F6DA"], "#D6EED0", "#F8FFE8", ["#5DA83A", "#3F8A28", "#86CF5E"], ["#7DBE4E", "#5FA63E", "#B4DB94"], "#9DB65A", "#F4E04D", ["bamboo", "fern"]),
  W(4, "Banana Grove", "banana", ["gaps"], "When the rings glow, press LEAP to jump the broken vine.", "bat", "golden",
    ["#86CDEB", "#F2F5CF"], "#DCEFC6", "#FFEFC0", ["#46A332", "#2F7F24", "#72C654"], ["#4FB040", "#3B9433", "#A6D68A"], "#8A7A3A", "#FFE14A", ["banana", "palm", "fern"]),
  W(5, "Tea Hills", "tea", ["fork", "rhythm", "chase"], "Forks! The side you're on picks the branch.", "crows2", "mist",
    ["#A7D8E8", "#EAF5E2"], "#DDEFE0", "#FFF8E8", ["#3F9A3A", "#2A7A2C", "#6CC05C"], ["#3E9A48", "#2E8240", "#9CCB9A"], "#6A5A40", "#FFFFFF", ["teabush", "tree", "hedge"]),
  W(6, "Lotus Pond", "lotus", ["lotus", "bees"], "Leap from stem to stem — mind the dragonflies.", "kingfisher", "day",
    ["#7FD0EE", "#EAF8E4"], "#CFEFE0", "#FFF6E0", ["#3FA046", "#2A7E36", "#6FCB6A"], ["#4CB25A", "#38944A", "#9AD8A4"], "#5E6A3A", "#FF7EB6", ["lotus", "fern", "tree"]),
  W(7, "Coconut Coast", "coast", ["wind", "nuts"], "The wind swings the thorns from side to side. Flip in time.", "crab", "golden",
    ["#6CC8F2", "#F4F2D8"], "#D8F0E4", "#FFE9C0", ["#4AA238", "#317E26", "#7ACB58"], ["#47A84A", "#36903E", "#A2D49A"], "#8C6A40", "#FF9F45", ["palm", "banana", "fern"]),
  W(8, "Rose & Jasmine Garden", "rose", ["bees", "classic"], "Bees cross in waves — cling, then go.", "wasp", "day",
    ["#8ED2F0", "#F4F2E2"], "#E2EFDA", "#FFF2E4", ["#3E9A34", "#2A7626", "#69C24E"], ["#3E9A3C", "#2E8030", "#8FC488"], "#6A4A34", "#FF4F7A", ["rose", "hedge", "tree"]),
  W(9, "Fern Gully", "fern", ["burrs", "web", "spider"], "Burrs roll down the vine. Be on the other side when they pass.", "spider", "mist",
    ["#9BD3DA", "#E4F2DE"], "#D2E8D2", "#F4FFF0", ["#3C9636", "#277428", "#62BE52"], ["#3B9A44", "#2B7F36", "#86C48A"], "#5A4A32", "#B8F06A", ["fern", "tree", "roots"]),
  W(10, "Rainforest Canopy", "canopy", ["spiral", "hole"], "The vine winds round giant trunks. Keep your eyes on the thorns.", "snake", "day",
    ["#7FC7E0", "#E2F4D6"], "#C8E6C4", "#FFF4DA", ["#3A9632", "#24702A", "#5FBE4C"], ["#2F8E3A", "#227430", "#7EBE7E"], "#5C442C", "#FF6A3D", ["giant", "tree", "fern", "roots"]),
  W(11, "Mushroom Glade", "mushroom", ["flower", "pods"], "Be on the flower's side to bounce over a gap.", "frog", "golden",
    ["#A5D2E6", "#F2EFD8"], "#E0EAD2", "#FFE6C4", ["#45A03A", "#2E7C2A", "#72C65A"], ["#4AA44C", "#36883C", "#A0D094"], "#7A5A3C", "#FF5A5A", ["mushroom", "fern", "tree"]),
  W(12, "Monsoon Woods", "monsoon", ["monsoon", "lightning"], "Rain makes flips slower. Lightning hits where it flashes.", "stormcrow", "rain",
    ["#8FB4C8", "#D8E6DC"], "#C2D6CC", "#E8F4FF", ["#3A8E38", "#256E2C", "#5CB650"], ["#33893E", "#287234", "#7AAE84"], "#4E4030", "#7FD6FF", ["tree", "fern", "roots"]),
  W(13, "Sunflower Fields", "sunflower", ["sunbask"], "Climb through sunshine to fill the Sun meter — then RUSH!", "sparrows", "golden",
    ["#7CC9F4", "#FBF6CC"], "#ECF2C8", "#FFE9A8", ["#4CA638", "#348228", "#7CCB56"], ["#58B040", "#409432", "#B2D888"], "#7A6A30", "#FFC93C", ["sunflower", "hedge", "tree"]),
  W(14, "Mossy Ruins", "ruins", ["wither", "rival"], "The vine withers behind you — don't cling for long. Race Zeeza!", "zeeza", "mist",
    ["#9CCAD6", "#E6EFDE"], "#D4E2D2", "#F6F8E8", ["#3E9038", "#286E2A", "#66B85A"], ["#4A9A4A", "#367E3A", "#94BE92"], "#6E6A5A", "#C8F07A", ["ruin", "fern", "tree"]),
  W(15, "Firefly Night Garden", "firefly", ["night"], "Night time: fireflies light up the thorns near you.", "owl", "night",
    ["#1E3A5E", "#3E6E6A"], "#2E5250", "#BFD8FF", ["#3E9C4A", "#2A7A38", "#6CCB6A"], ["#2E7A4A", "#24603C", "#4E8E6A"], "#3A3428", "#FFE36A", ["tree", "fern", "hedge"]),
  W(16, "Waterfall Cliffs", "waterfall", ["waterfall"], "The waterfall side pushes you off — stay on the dry side.", "heron", "mist",
    ["#86CBE6", "#E4F4EA"], "#D0ECE4", "#F2FFF8", ["#3C9A42", "#287A32", "#66C462"], ["#3E9E52", "#2E8242", "#8CC8A0"], "#6A6A5A", "#9FE8FF", ["waterfall", "fern", "tree"]),
  W(17, "Banyan Village", "banyan", ["swing", "twin"], "Press LEAP at a swinging root — you grab it when it glows green.", "langur", "golden",
    ["#8CCCEA", "#F4EED2"], "#E2EACC", "#FFE4B8", ["#479E36", "#2F7A26", "#74C656"], ["#459E40", "#348434", "#9CCA88"], "#6E5236", "#FF8C42", ["roots", "giant", "tree"]),
  W(18, "Gourd Trellis", "gourd", ["snail", "caterpillar"], "Snails are slow — pass them on the other side.", "squirrel", "day",
    ["#86D0F0", "#F0F6D4"], "#DCF0CC", "#FFF2D4", ["#4AA43A", "#33802A", "#78CC58"], ["#52AA44", "#3C8E36", "#A6D690"], "#8A6A3E", "#FFD23F", ["gourd", "hedge", "tree"]),
  W(19, "Orchid Valley", "orchid", ["camo"], "Kaaki's shadow! Hide on the leafy side when it sweeps by.", "shrike", "mist",
    ["#A2CCE6", "#F2EAF2"], "#E2E4EA", "#FFF0F6", ["#3E9A3E", "#2A782E", "#6AC462"], ["#3C9A4C", "#2C7E3E", "#92C49E"], "#5A4A3A", "#D16BFF", ["orchid", "fern", "tree"]),
  W(20, "Mangrove Maze", "mangrove", ["grow"], "The vine is still growing! Cling so you don't climb past its tip.", "mudcrab", "day",
    ["#7FC2E0", "#E2F2E6"], "#CDE6DE", "#FFF4E0", ["#3E9038", "#286C2A", "#64B456"], ["#3A8E46", "#2A743A", "#86B88E"], "#4E4632", "#5FD3B5", ["mangrove", "roots", "fern"]),
  W(21, "Pine Highlands", "pine", ["fog"], "Mist hides the vine — the leaf arrows show the way.", "eagle", "mist",
    ["#A4C8DE", "#E6EEEA"], "#D6E2E2", "#F4F8FF", ["#3A8C3E", "#25682E", "#5EB25C"], ["#2E7E44", "#226638", "#6E9E7E"], "#5A4634", "#E8F4FF", ["pine", "fern", "hedge"]),
  W(22, "Spice Garden", "spice", ["sapdew", "pods"], "Sap is sticky, dew is fast. Seed pods sprout thorns!", "mynah", "golden",
    ["#8ACBE8", "#F6EED0"], "#E6EACA", "#FFE0A8", ["#46A034", "#307C26", "#74C450"], ["#4EA43E", "#3A8A32", "#A4CE84"], "#7A4E2E", "#E2452B", ["pepper", "tree", "fern"]),
  W(23, "Blossom Hills", "blossom", ["mirror"], "Pippi copies your flips on his vine — keep both of you safe.", "crows2b", "day",
    ["#94D2F2", "#FBEFF2"], "#EEE6EA", "#FFF2F4", ["#45A23A", "#2E7E2C", "#72C860"], ["#4CAA48", "#38903C", "#A6D49C"], "#6A4A40", "#FF9EC4", ["blossom", "hedge", "tree"]),
  W(24, "Jade Temple Garden", "temple", ["rhythm", "egg"], "Thorns move to the temple bells. Carry the egg safely home!", "templemonkey", "golden",
    ["#86C8E0", "#F0F0D8"], "#DCE8D2", "#FFEBC4", ["#3E9A3C", "#287830", "#6AC460"], ["#3A9850", "#2C7E42", "#8CC4A0"], "#6A5A44", "#3FE0A0", ["temple", "tree", "fern"]),
  W(25, "Glowing Jungle", "glow", ["night", "pods"], "The jungle glows — read the bright thorns fast.", "mothqueen", "night",
    ["#14324A", "#24604E"], "#1E4A44", "#B8FFE6", ["#36B054", "#228A40", "#7CFF8C"], ["#1E7A50", "#18603E", "#2E9A6A"], "#30302A", "#7CFFB4", ["glow", "fern", "tree"]),
  W(26, "Thorn Thicket", "thicket", ["storm"], "Thorns everywhere. Trust your rhythm.", "hornbill", "dusk",
    ["#8AB8D6", "#F2E4CC"], "#DCD8C4", "#FFD8A8", ["#3E8E36", "#286A28", "#64B252"], ["#3A8A3C", "#2A7030", "#88AE80"], "#5E4430", "#FF7A3A", ["bramble", "tree", "fern"]),
  W(27, "Storm Canopy", "storm", ["lightning", "wind"], "Storm! Lightning, wind and rain all at once.", "kite", "storm",
    ["#5E7A90", "#B8CCC8"], "#9EB4B2", "#E6F0FF", ["#3A8C3A", "#246A2A", "#5CB252"], ["#2E7E3E", "#226634", "#6A9A78"], "#4A3E30", "#9FD8FF", ["giant", "tree", "roots"]),
  W(28, "Cloud Forest", "cloud", ["gaps", "sapdew"], "Above the clouds the leaps get long. Dew makes you fly.", "flock", "day",
    ["#7FC6F6", "#F6FAFF"], "#EEF6FA", "#FFFFFF", ["#46A43E", "#2E802E", "#76CA66"], ["#4AAA52", "#36903E", "#A8D8A8"], "#6E5A44", "#B8E0FF", ["cloud", "island", "tree"]),
  W(29, "Sky Garden", "sky", ["swing", "twin"], "Floating islands joined by vines — everything you know, mixed.", "ravenrex", "golden",
    ["#6EBEF4", "#FFF4DA"], "#F0F0E0", "#FFE6B4", ["#4AA640", "#328230", "#7CCE66"], ["#52AE50", "#3C9440", "#ACD8A0"], "#7A5E40", "#FFB84A", ["island", "cloud", "tree"]),
  W(30, "The Great Banyan", "crown", ["storm", "camo"], "The tallest climb of all. Bring the last Sun Seed home!", "kaaki", "golden",
    ["#7CC4EE", "#FFF0CC"], "#EEE8C8", "#FFE2A0", ["#46A23A", "#2E7E2C", "#76CA5C"], ["#3E9E44", "#2E8438", "#9ACB8C"], "#6A4A30", "#FFD54A", ["giant", "roots", "tree"]),
];

export interface BugKind { name: string; body: string; wing: string; glow?: boolean; shape: "cricket" | "beetle" | "moth" | "fly" | "bee" | "dragonfly" | "stick" | "caterpillar" | "ladybird"; fact: string }
export const BUGS: BugKind[] = [
  { name: "Cricket", body: "#6A8A2A", wing: "#8FB040", shape: "cricket", fact: "Crickets sing by rubbing their wings together." },
  { name: "Fruit fly", body: "#C88A3A", wing: "#E8F4FF", shape: "fly", fact: "Fruit flies find ripe mangoes by smell." },
  { name: "Grasshopper", body: "#7CC23A", wing: "#A8D86A", shape: "cricket", fact: "A grasshopper can jump 20 times its length." },
  { name: "Leafhopper", body: "#48C878", wing: "#9AF0B8", shape: "cricket", fact: "Leafhoppers hop sideways along leaves." },
  { name: "Tea moth", body: "#C8B48A", wing: "#E8DCC0", shape: "moth", fact: "Tea moths rest flat on tea leaves by day." },
  { name: "Dragonfly", body: "#2A9ACF", wing: "#D8F2FF", shape: "dragonfly", fact: "Dragonflies can fly backwards." },
  { name: "Palm weevil", body: "#A8402A", wing: "#7A2A1A", shape: "beetle", fact: "Weevils have a long snout called a rostrum." },
  { name: "Honeybee", body: "#F2B32A", wing: "#F0F8FF", shape: "bee", fact: "A honeybee visits about 50 flowers per trip." },
  { name: "Ladybird", body: "#E8322A", wing: "#1A1A1A", shape: "ladybird", fact: "Ladybirds eat tiny aphids on leaves." },
  { name: "Stick insect", body: "#7A8A3A", wing: "#9AAA5A", shape: "stick", fact: "Stick insects look just like twigs." },
  { name: "Glow beetle", body: "#4AA0FF", wing: "#2A60C0", glow: true, shape: "beetle", fact: "Some beetles glow to find each other." },
  { name: "Rain beetle", body: "#3A6A8A", wing: "#2A4A6A", shape: "beetle", fact: "Rain beetles come out after the first monsoon rain." },
  { name: "Bumblebee", body: "#F2C02A", wing: "#F4FAFF", shape: "bee", fact: "Bumblebees buzz flowers to shake out pollen." },
  { name: "Rove beetle", body: "#3A2A2A", wing: "#6A4A3A", shape: "beetle", fact: "Rove beetles run fast with their tails raised." },
  { name: "Firefly", body: "#5A4A2A", wing: "#FFE36A", glow: true, shape: "beetle", fact: "Fireflies flash light to talk to each other." },
  { name: "Water strider", body: "#4A5A6A", wing: "#8AA0B0", shape: "stick", fact: "Water striders walk on the water's skin." },
  { name: "Cicada", body: "#4A7A3A", wing: "#C8F0E0", shape: "fly", fact: "Cicadas are among the loudest insects." },
  { name: "Caterpillar", body: "#7ACB3A", wing: "#FFD23F", shape: "caterpillar", fact: "Caterpillars eat and grow before they become butterflies." },
  { name: "Orchid mantis", body: "#F6C8E8", wing: "#FFE8F6", shape: "stick", fact: "Orchid mantises look like flower petals." },
  { name: "Mangrove cricket", body: "#5A6A4A", wing: "#8A9A6A", shape: "cricket", fact: "Mangrove crickets live in the roots by the sea." },
  { name: "Pine beetle", body: "#5A3A2A", wing: "#7A5A3A", shape: "beetle", fact: "Pine beetles live under pine bark." },
  { name: "Pepper weevil", body: "#2A2A2A", wing: "#5A4A3A", shape: "beetle", fact: "Pepper weevils love pepper buds." },
  { name: "Silk moth", body: "#F2EEE2", wing: "#FFFFF4", shape: "moth", fact: "Silk moth caterpillars spin silk cocoons." },
  { name: "Jewel beetle", body: "#2AC88A", wing: "#E8C02A", shape: "beetle", fact: "Jewel beetles shine like metal." },
  { name: "Glow-worm", body: "#B8FF6A", wing: "#E8FFB8", glow: true, shape: "caterpillar", fact: "Glow-worms glow green in the dark." },
  { name: "Treehopper", body: "#8A6A3A", wing: "#C8A06A", shape: "cricket", fact: "Treehoppers look like little thorns." },
  { name: "Rhino beetle", body: "#4A2A1A", wing: "#6A3A2A", shape: "beetle", fact: "Rhino beetles can lift 100 times their weight." },
  { name: "Luna moth", body: "#C8F0A8", wing: "#B8F09A", shape: "moth", fact: "Luna moths have long trailing wing tails." },
  { name: "Atlas moth", body: "#C86A3A", wing: "#E89A5A", shape: "moth", fact: "Atlas moths are among the biggest moths." },
  { name: "Golden scarab", body: "#FFC83A", wing: "#FFE48A", glow: true, shape: "beetle", fact: "Golden scarabs gleam like little suns." },
];

export interface Guardian { id: string; name: string; model: "bird" | "monkey" | "snake" | "beetle" | "crab" | "spider" | "wasp" | "bat" | "frog" | "lizard" | "moth"; behaviour: "dive" | "throw" | "slide" | "drop" | "swarm" | "shadow" | "mimic" | "race" | "tongue" | "quake"; colors: [string, string, string]; size: number }
export const GUARDIANS: Record<string, Guardian> = {
  kaaki1: { id: "kaaki1", name: "Kaaki the Crow", model: "bird", behaviour: "dive", colors: ["#2A2A34", "#4A4A5A", "#3A3A3A"], size: 1 },
  monkey: { id: "monkey", name: "Mango Monkey", model: "monkey", behaviour: "throw", colors: ["#8A5A34", "#E8C8A0", "#FFB21E"], size: 1 },
  beetle: { id: "beetle", name: "Bamboo Beetle", model: "beetle", behaviour: "slide", colors: ["#3A5A2A", "#8AB04A", "#2A2A2A"], size: 1.2 },
  bat: { id: "bat", name: "Fruit Bat", model: "bat", behaviour: "dive", colors: ["#4A3A34", "#8A5A4A", "#2A2020"], size: 1 },
  crows2: { id: "crows2", name: "Kaaki's Cousins", model: "bird", behaviour: "dive", colors: ["#2A2A34", "#5A5A6A", "#3A3A3A"], size: 0.9 },
  kingfisher: { id: "kingfisher", name: "Kingfisher", model: "bird", behaviour: "dive", colors: ["#1E7ED6", "#FF8A3A", "#FFFFFF"], size: 0.9 },
  crab: { id: "crab", name: "Coconut Crab", model: "crab", behaviour: "throw", colors: ["#C8502A", "#FF8A4A", "#3A2A2A"], size: 1.1 },
  wasp: { id: "wasp", name: "Queen Wasp", model: "wasp", behaviour: "swarm", colors: ["#F2B32A", "#2A2A2A", "#F0F8FF"], size: 1 },
  spider: { id: "spider", name: "Spider Matriarch", model: "spider", behaviour: "drop", colors: ["#4A3A5A", "#8A6AAA", "#FFD23F"], size: 1.1 },
  snake: { id: "snake", name: "Rat Snake", model: "snake", behaviour: "slide", colors: ["#8A7A3A", "#C8B86A", "#2A2A20"], size: 1 },
  frog: { id: "frog", name: "Bullfrog", model: "frog", behaviour: "tongue", colors: ["#5A9A3A", "#C8E07A", "#FF6A8A"], size: 1.1 },
  stormcrow: { id: "stormcrow", name: "Storm Crow", model: "bird", behaviour: "dive", colors: ["#2A2E3E", "#5A6A8A", "#9FD8FF"], size: 1.1 },
  sparrows: { id: "sparrows", name: "Sparrow Gang", model: "bird", behaviour: "swarm", colors: ["#8A6A4A", "#E8D8C0", "#3A2A20"], size: 0.7 },
  zeeza: { id: "zeeza", name: "Zeeza", model: "lizard", behaviour: "race", colors: ["#3AC86A", "#A8F07A", "#FF5A8A"], size: 1 },
  owl: { id: "owl", name: "Night Owl", model: "bird", behaviour: "shadow", colors: ["#8A6A4A", "#D8C0A0", "#FFD23F"], size: 1.2 },
  heron: { id: "heron", name: "Grey Heron", model: "bird", behaviour: "dive", colors: ["#9AA4B0", "#E8ECF0", "#FFD23F"], size: 1.3 },
  langur: { id: "langur", name: "Langur Troop", model: "monkey", behaviour: "quake", colors: ["#B8B0A0", "#2A2A2A", "#E8E0D0"], size: 1.1 },
  squirrel: { id: "squirrel", name: "Squirrel Sentry", model: "monkey", behaviour: "throw", colors: ["#8A6A4A", "#E8D8B8", "#3A2A20"], size: 0.8 },
  shrike: { id: "shrike", name: "Shrike", model: "bird", behaviour: "shadow", colors: ["#B8A08A", "#2A2A2A", "#E8E0D0"], size: 0.9 },
  mudcrab: { id: "mudcrab", name: "Mud Crab King", model: "crab", behaviour: "throw", colors: ["#5A5A3A", "#9A9A6A", "#2A2A20"], size: 1.3 },
  eagle: { id: "eagle", name: "Hill Eagle", model: "bird", behaviour: "dive", colors: ["#6A4A2A", "#E8E0D0", "#FFC83A"], size: 1.5 },
  mynah: { id: "mynah", name: "Mimic Mynah", model: "bird", behaviour: "mimic", colors: ["#3A2A2A", "#FFD23F", "#FFFFFF"], size: 0.9 },
  crows2b: { id: "crows2b", name: "Twin Crows", model: "bird", behaviour: "mimic", colors: ["#2A2A34", "#5A5A6A", "#FF9EC4"], size: 1 },
  templemonkey: { id: "templemonkey", name: "Temple Monkey", model: "monkey", behaviour: "quake", colors: ["#A0784A", "#F0D8B0", "#3FE0A0"], size: 1.1 },
  mothqueen: { id: "mothqueen", name: "Moth Queen", model: "moth", behaviour: "swarm", colors: ["#7CFFB4", "#2A6A5A", "#FFE36A"], size: 1.4 },
  hornbill: { id: "hornbill", name: "Great Hornbill", model: "bird", behaviour: "dive", colors: ["#2A2A2A", "#FFFFFF", "#FFC83A"], size: 1.5 },
  kite: { id: "kite", name: "Thunder Kite", model: "bird", behaviour: "dive", colors: ["#6A4A3A", "#C8A080", "#9FD8FF"], size: 1.4 },
  flock: { id: "flock", name: "Kaaki's Flock", model: "bird", behaviour: "swarm", colors: ["#2A2A34", "#4A4A5A", "#B8E0FF"], size: 0.8 },
  ravenrex: { id: "ravenrex", name: "Raven Rex", model: "bird", behaviour: "mimic", colors: ["#1A1A24", "#3A3A4A", "#FFB84A"], size: 1.6 },
  kaaki: { id: "kaaki", name: "Kaaki the Crow", model: "bird", behaviour: "dive", colors: ["#2A2A34", "#4A4A5A", "#FFD54A"], size: 1.4 },
};

/** stage concepts: what the card says and what Pippi tips */
export const CONCEPTS: Record<string, { name: string; tip: string }> = {
  classic: { name: "Thorn Climb", tip: "Flip away from the thorns." },
  feast: { name: "Bug Feast", tip: "Snap every bug in a row for a combo!" },
  hairpin: { name: "Hairpin Hills", tip: "The vine turns back on itself — read it early." },
  rhythm: { name: "Thorn Rhythm", tip: "Flip on the beat." },
  gold: { name: "Gold Rush", tip: "Golden beetles everywhere — snap them all!" },
  fork: { name: "Fork Choice", tip: "Your side at the fork picks the branch." },
  cling: { name: "Thistle Buds", tip: "Hold to cling; pass when the buds close." },
  bamboo: { name: "Bamboo Express", tip: "Fast and straight — quick flips!" },
  gaps: { name: "Leap Gaps", tip: "Press LEAP when the rings glow." },
  long: { name: "Long Vine", tip: "A long one — the moss halfway is a checkpoint." },
  burrs: { name: "Rolling Burrs", tip: "Let the burrs roll past on the other side." },
  ants: { name: "Ant Highway", tip: "Ants march on one side — wait or flip." },
  fruit: { name: "Fruit Fall", tip: "Flip away from the falling fruit's shadow." },
  nuts: { name: "Coconut Drop", tip: "Coconuts drop where the shadow grows." },
  bees: { name: "Bee Crossing", tip: "Cling while the bees fly across." },
  chase: { name: "Crow Chase", tip: "Kaaki is behind you — don't slow down!" },
  rival: { name: "Rival Race", tip: "Beat Zeeza to the flower gate." },
  spider: { name: "Spider Drop", tip: "Spiders drop on a beat — time it." },
  web: { name: "Web Maze", tip: "Webs slow you down." },
  lotus: { name: "Lotus Hop", tip: "Press LEAP at each glowing stem." },
  flower: { name: "Flower Bounce", tip: "Be on the flower's side to bounce." },
  wind: { name: "Wind Sway", tip: "Thorns swing with the wind — watch them turn." },
  monsoon: { name: "Monsoon Slip", tip: "Rain slows your flips — flip early." },
  lightning: { name: "Lightning Canopy", tip: "Lightning strikes where it flashes." },
  night: { name: "Firefly Night", tip: "Fireflies light up the thorns." },
  spiral: { name: "Spiral Trunk", tip: "Round and round the giant trunk!" },
  hole: { name: "Tree Hole", tip: "Through the hollow tree!" },
  waterfall: { name: "Waterfall Wall", tip: "Stay on the dry side." },
  grow: { name: "Growing Vine", tip: "Don't outclimb the growing tip — cling!" },
  wither: { name: "Withering Vine", tip: "The vine falls away behind you — keep moving." },
  camo: { name: "Camouflage", tip: "Hide on the leafy side from the shadow." },
  sunbask: { name: "Sun Basking", tip: "Sunny side fills the Sun meter." },
  pods: { name: "Seed Pods", tip: "Pods burst into thorns — flip away." },
  caterpillar: { name: "Caterpillar Crossing", tip: "Wait for the caterpillar to cross." },
  twin: { name: "Twin Vines", tip: "Press LEAP to jump between the vines." },
  mirror: { name: "Mirror Pippi", tip: "Pippi copies your flips — keep him safe too." },
  egg: { name: "Egg Escort", tip: "Don't get hit — you're carrying an egg!" },
  fog: { name: "Fog Turns", tip: "Watch the leaf arrows in the mist." },
  snail: { name: "Snail Lane", tip: "Pass the slow snails on the other side." },
  sapdew: { name: "Sap & Dew", tip: "Sap slows, dew speeds you up." },
  storm: { name: "Thorn Storm", tip: "Dense thorns — keep your rhythm." },
  swing: { name: "Rope Swing", tip: "Press LEAP — you grab the root when it glows green. Cling to wait." },
  crown: { name: "Crown Climb", tip: "Reach the crown past the guardian!" },
};

export const WORLD_COUNT = WORLDS.length;
export const CAMPAIGN = WORLD_COUNT * 20;
export const worldOf = (n: number) => WORLDS[Math.min(WORLD_COUNT - 1, Math.max(0, Math.floor((n - 1) / 20)))];
export const stageIn = (n: number) => ((n - 1) % 20) + 1;
