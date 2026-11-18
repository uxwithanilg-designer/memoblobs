// Kiko's Jungle Quest — the 15 regions of the forest, 20 named places each (300 in all). Every place has a set piece
// (its big moment) and may change the time of day and the weather. Each region brings one new idea, its own hazards,
// a guardian animal to ride, a music style and a boss who guards one of the 15 Golden Seeds.
import type { FruitId, RegionId, RideId, SetPiece, TimeOfDay, Weather } from "./types";

export type Place = [name: string, piece: SetPiece, tod?: TimeOfDay, weather?: Weather];
export interface RegionDef {
  id: RegionId; name: string; emoji: string; accent: string; accent2: string; villain: string; boss: string; blurb: string; newIdea: string;
  tod: TimeOfDay; weather: Weather; fruits: FruitId[]; pool: SetPiece[]; tune: number[]; places: Place[];
  /** the forest-floor hazards this region adds (chunk letters) */
  haz: string;
  ride?: RideId;
  /** Wild Forest names: adjectives this region lends, nouns it lends */
  adj: string[]; noun: string[];
}

const F_ALL: FruitId[] = ["mango", "pineapple", "berries", "melon", "kiwi", "dragon"];
const rot = (k: number): FruitId[] => [...F_ALL.slice(k), ...F_ALL.slice(0, k)];

export const REGIONS: RegionDef[] = [
  {
    id: "grove", name: "Banana Grove", emoji: "🍌", accent: "#FFC23D", accent2: "#2FB86B", villain: "the Grumpy Gatekeeper", boss: "gatekeeper",
    blurb: "Kiko's home: banana trees, giant roots, vines to swing on and the branch road up high.", newIdea: "vines, the branch road and bouncy mushrooms",
    tod: "morning", weather: "butterflies", fruits: rot(0), haz: "",
    pool: ["vines", "highroad", "bounce", "peels", "coconuts", "rollers", "logs", "bridge", "stream"],
    tune: [72, 74, 76, 79, 81, 79, 76, 74, 72, 76, 79, 84, 81, 79, 76, 79, 77, 76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 72, 74, 76, 72, 72],
    adj: ["Banana", "Sunny", "Leafy", "Peely", "Coconut"], noun: ["Grove", "Lane", "Clearing", "Woods", "Trail"],
    places: [
      ["Kiko's Treehouse", "none", "morning", "butterflies"], ["Banana Lane", "none", "morning", "leaves"], ["Peel Path", "peels"], ["Coconut Corner", "coconuts"],
      ["Sunny Clearing", "highroad", "day", "butterflies"], ["Swinging Vines", "vines"], ["Fruit Market Trail", "highroad", "day"], ["Parrot Perch", "highroad", "day", "leaves"],
      ["Hollow Log Run", "logs"], ["Bumpy Root Road", "bounce"], ["Monkey Bridge", "bridge", "day"], ["Pineapple Patch", "rollers", "day"],
      ["Lazy Pond", "stream", "day", "rain"], ["Old Fig Tree", "vines", "day", "leaves"], ["Tickle Grass", "bounce", "day"], ["Seed Hill", "rollers", "day"],
      ["Hammock Hill", "highroad", "sunset", "butterflies"], ["Drum Rock", "vines", "sunset"], ["Banana Falls", "bridge", "sunset", "mist"], ["Bramble Gate", "vines", "sunset", "leaves"],
    ],
  },
  {
    id: "river", name: "Mango River", emoji: "🥭", accent: "#FF8A3D", accent2: "#2FB5C8", villain: "the Croc King", boss: "crocking", ride: "turtle",
    blurb: "A sunny river of mango trees, lily pads, rope bridges and log rafts — mind the crocodiles!", newIdea: "lily pads, rope bridges and raft rides",
    tod: "day", weather: "none", fruits: rot(3), haz: "",
    pool: ["lily", "raft", "bridge", "vines", "highroad", "stream", "bounce", "ride"],
    tune: [77, 81, 84, 81, 77, 79, 81, 77, 76, 79, 82, 79, 76, 77, 79, 76, 77, 81, 84, 86, 84, 81, 79, 81, 82, 81, 79, 77, 76, 77, 79, 77],
    adj: ["Mango", "Misty", "Splashy", "Reedy", "Lily"], noun: ["River", "Bend", "Rapids", "Shallows", "Delta"],
    places: [
      ["Mango Bend", "stream", "day", "butterflies"], ["Lily Pad Leap", "lily"], ["Log Raft Rapids", "raft"], ["Croc Crossing", "raft"],
      ["Otter Slide", "bounce"], ["Reed Maze", "bridge", "day", "leaves"], ["Turtle Isle", "ride"], ["Splash Steps", "lily", "day", "mist"],
      ["Fishing Rocks", "raft"], ["Mango Delta", "highroad"], ["Bubble Shallows", "lily", "morning"], ["Kingfisher Dive", "vines"],
      ["Rope Ferry", "bridge"], ["Whirlpool Way", "raft", "day", "mist"], ["Hippo Hollow", "lily", "day", "rain"], ["Sandbar Dash", "rollers"],
      ["Driftwood Dam", "bounce", "sunset"], ["Sunset Rapids", "raft", "sunset"], ["Moonlit River", "lily", "night", "fireflies"], ["Croc King's Cove", "raft", "night", "fireflies"],
    ],
  },
  {
    id: "bamboo", name: "Bamboo Valley", emoji: "🎋", accent: "#9CE05A", accent2: "#2F8F6E", villain: "the Bamboo Bandit", boss: "bandit", ride: "panda",
    blurb: "Whistling bamboo, lantern paths and tea terraces — springy bamboo shoots fling you up high!", newIdea: "bamboo catapults, bamboo bridges and Rolo the red panda",
    tod: "morning", weather: "mist", fruits: rot(4), haz: "",
    pool: ["bounce", "bridge", "vines", "highroad", "ride", "logs", "rollers", "stream", "raft"],
    tune: [74, 76, 78, 81, 83, 81, 78, 76, 74, 78, 81, 86, 83, 81, 78, 81, 79, 78, 76, 74, 76, 78, 81, 78, 76, 74, 71, 74, 76, 78, 74, 74],
    adj: ["Bamboo", "Jade", "Lantern", "Whistling", "Misty"], noun: ["Valley", "Terraces", "Stalks", "Gate", "Garden"],
    places: [
      ["Bamboo Gate", "none", "morning", "mist"], ["Whistling Stalks", "logs"], ["Panda Picnic", "ride", "day"], ["Springy Shoots", "bounce"],
      ["Bamboo Bridges", "bridge"], ["Lantern Path", "vines", "sunset"], ["Tea Terraces", "highroad", "day"], ["Bonsai Garden", "rollers", "day"],
      ["Koi Ponds", "stream", "day"], ["Rolling Stalks", "rollers"], ["Windchime Woods", "bounce", "day", "leaves"], ["Red Panda Ridge", "ride", "day"],
      ["Bamboo Rafts", "raft"], ["Paper Crane Pass", "vines", "day", "leaves"], ["Misty Steps", "bridge", "morning", "mist"], ["Gong Temple", "logs", "sunset"],
      ["Slingshot Grove", "bounce", "sunset"], ["Moon Gate", "highroad", "night", "fireflies"], ["Jade Stream", "raft", "night", "fireflies"], ["Bandit's Bamboo Fort", "bounce", "night", "fireflies"],
    ],
  },
  {
    id: "falls", name: "Waterfall Cliffs", emoji: "🌈", accent: "#5FB8FF", accent2: "#2FB5A8", villain: "the Waterfall Warden", boss: "warden",
    blurb: "Roaring waterfalls and rainbows in the spray — zip over gorges and slide down the falls!", newIdea: "ziplines and waterfall slides",
    tod: "day", weather: "mist", fruits: rot(1), haz: "",
    pool: ["zipline", "slide", "bridge", "vines", "lily", "collapse", "bounce", "raft"],
    tune: [69, 73, 76, 81, 80, 76, 73, 76, 74, 78, 81, 78, 76, 73, 71, 73, 69, 73, 76, 78, 81, 83, 85, 81, 83, 80, 76, 80, 81, 76, 73, 69],
    adj: ["Rainbow", "Roaring", "Spray", "Cliffside", "Echo"], noun: ["Falls", "Gorge", "Cliffs", "Ledge", "Pool"],
    places: [
      ["Spray Ledge", "none", "day", "mist"], ["Rainbow Mist", "lily", "day", "mist"], ["Cliff Dive", "bounce"], ["Waterfall Slide", "slide"],
      ["Echo Gorge", "vines"], ["Zipline Canyon", "zipline", "day", "none"], ["Pebble Beach", "rollers", "day", "none"], ["Hidden Grotto", "stream", "cave", "none"],
      ["Twin Falls", "slide"], ["Rope Ladder Rise", "highroad"], ["Swallow Nests", "vines", "day", "none"], ["Rock Arch", "logs"],
      ["Plunge Pool", "lily"], ["Mossy Steps", "collapse"], ["Thunder Falls", "slide", "day", "storm"], ["Eagle Point", "zipline", "day", "none"],
      ["Rapids Run", "raft"], ["Cave Behind the Falls", "stream", "cave", "none"], ["Sky Spring", "zipline", "sunset", "none"], ["Warden's Waterfall", "slide", "sunset", "mist"],
    ],
  },
  {
    id: "mushroom", name: "Mushroom Hollow", emoji: "🍄", accent: "#FF5F7E", accent2: "#9B5BE0", villain: "the Puffcap Baron", boss: "puffcap",
    blurb: "Giant toadstools, glowing caves and spore clouds — bounce from cap to cap!", newIdea: "bouncy mushroom chains and glowing caves",
    tod: "sunset", weather: "fireflies", fruits: rot(2), haz: "",
    pool: ["bounce", "vines", "highroad", "stream", "rollers", "coconuts", "bridge", "slide"],
    tune: [67, 70, 74, 70, 67, 69, 70, 74, 75, 74, 70, 69, 67, 69, 70, 67, 74, 75, 79, 75, 74, 70, 69, 70, 74, 70, 69, 66, 67, 69, 66, 67],
    adj: ["Spotty", "Puffy", "Glowcap", "Mossy", "Toadstool"], noun: ["Hollow", "Ring", "Mounds", "Tunnels", "Dell"],
    places: [
      ["Toadstool Trail", "none"], ["Bounce Garden", "bounce"], ["Puffball Path", "rollers"], ["Glowcap Cave", "stream", "cave", "fireflies"],
      ["Spore Storm", "coconuts", "sunset", "mist"], ["Fairy Ring", "bounce"], ["Giant Morel Maze", "logs"], ["Shelf Fungus Stairs", "highroad"],
      ["Truffle Tunnels", "vines", "cave", "fireflies"], ["Inkcap Inlet", "lily"], ["Mossy Mounds", "bounce", "day", "none"], ["Snail Highway", "highroad", "day", "none"],
      ["Dewdrop Dell", "stream", "morning", "mist"], ["Moonmushroom Meadow", "bounce", "night", "fireflies"], ["Bouncy Bridge", "bridge"], ["Rotten Log Run", "logs"],
      ["Gnome Village", "rollers", "day", "none"], ["Slime Slide", "slide"], ["Mycelium Mines", "vines", "cave", "fireflies"], ["Puffcap's Palace", "bounce", "night", "fireflies"],
    ],
  },
  {
    id: "marsh", name: "Monsoon Marsh", emoji: "🌧️", accent: "#4FA8E0", accent2: "#3E7A5A", villain: "the Storm Grump", boss: "storm", ride: "frog",
    blurb: "The rainy season: slippery paths, mud, rising water and puddles that crackle with lightning!", newIdea: "rain, mud and lightning puddles — and the Frog Taxi",
    tod: "day", weather: "rain", fruits: rot(5), haz: "MG",
    pool: ["mud", "geysers", "lily", "raft", "ride", "bridge", "slide", "stream"],
    tune: [76, 79, 83, 79, 76, 74, 71, 74, 76, 79, 81, 83, 81, 79, 76, 79, 72, 76, 79, 76, 74, 78, 81, 78, 79, 76, 74, 71, 72, 74, 71, 76],
    adj: ["Rainy", "Muddy", "Stormy", "Puddly", "Soggy"], noun: ["Marsh", "Bog", "Flats", "Trail", "Village"],
    places: [
      ["First Drops", "none"], ["Puddle Jumps", "mud"], ["Thunder Trail", "geysers", "day", "storm"], ["Mudslide Mile", "slide"],
      ["Frog Chorus", "ride"], ["Rising Water", "lily"], ["Lightning Woods", "geysers", "day", "storm"], ["Rainbow Break", "highroad", "day", "none"],
      ["Umbrella Leaf Path", "vines"], ["Flooded Village", "raft"], ["Storm Drain", "slide"], ["Quicksand Flats", "mud"],
      ["Croaky Bog", "ride"], ["Downpour Dash", "rollers"], ["Swamp Boat", "raft"], ["Hailstone Hill", "coconuts", "day", "storm"],
      ["Wind and Rain", "bridge", "day", "storm"], ["Gutter Run", "slide"], ["Thundercloud Peak", "geysers", "night", "storm"], ["Storm Grump's Tower", "vines", "night", "storm"],
    ],
  },
  {
    id: "canopy", name: "Canopy Heights", emoji: "🌳", accent: "#9CFF6B", accent2: "#2F8F3E", villain: "King Woodpecker", boss: "woodpecker",
    blurb: "Life on top of the trees: treetop roads, wobbly rope bridges and a strong wind!", newIdea: "treetop roads, collapsing bridges, gusts and kites",
    tod: "day", weather: "wind", fruits: rot(1), haz: "{}",
    pool: ["highroad", "collapse", "vines", "zipline", "gusts", "kite", "bridge", "bounce"],
    tune: [72, 76, 79, 83, 84, 83, 79, 76, 78, 81, 84, 81, 79, 76, 74, 76, 72, 74, 76, 78, 79, 81, 83, 84, 83, 79, 76, 74, 72, 74, 76, 72],
    adj: ["Treetop", "Windy", "Leafy", "Swinging", "Sky"], noun: ["Heights", "Canopy", "Branches", "Nests", "Crown"],
    places: [
      ["Branch Road", "highroad"], ["Treehouse Town", "highroad"], ["Rope Bridge Run", "collapse"], ["Toucan Glide", "kite"],
      ["Leaf Elevator", "bounce"], ["Nest Hop", "highroad"], ["Monkey Bar Maze", "vines"], ["Hanging Gardens", "highroad", "day", "butterflies"],
      ["Sap Slide", "slide"], ["Woodpecker Woods", "logs"], ["Wasp Watch", "gusts"], ["Swing Circus", "vines"],
      ["Sky Hammocks", "bounce"], ["Canopy Market", "highroad"], ["Fig Vine Falls", "zipline"], ["Owl Lookout", "collapse", "sunset"],
      ["Emergent Tops", "kite"], ["Cloud Branch", "highroad", "day", "mist"], ["Sunrise Crown", "zipline", "morning"], ["Woodpecker's Perch", "collapse", "sunset"],
    ],
  },
  {
    id: "night", name: "Firefly Night Woods", emoji: "🌙", accent: "#B58CFF", accent2: "#2A2160", villain: "the Night Grump", boss: "nightgrump",
    blurb: "A sleepy forest at night: fireflies light the way, owls hoot and spiders spin sticky webs.", newIdea: "night paths and sticky spider webs",
    tod: "night", weather: "fireflies", fruits: rot(4), haz: "W",
    pool: ["webs", "vines", "highroad", "bridge", "stream", "rollers", "zipline", "bounce", "collapse"],
    tune: [77, 80, 84, 80, 77, 79, 80, 84, 85, 84, 80, 79, 77, 79, 80, 77, 84, 85, 89, 85, 84, 80, 79, 80, 84, 80, 79, 76, 77, 79, 76, 77],
    adj: ["Moonlit", "Firefly", "Starry", "Sleepy", "Twinkly"], noun: ["Woods", "Hollow", "Lane", "Pond", "Glade"],
    places: [
      ["Lantern Lane", "none"], ["Firefly Fields", "stream"], ["Owl Hoot Hollow", "vines"], ["Moonbeam Path", "highroad"],
      ["Glowworm Grotto", "stream", "cave"], ["Spider Silk Trail", "webs"], ["Star Pond", "lily"], ["Night Market", "rollers"],
      ["Whispering Pines", "logs", "night", "mist"], ["Shadow Bridge", "collapse"], ["Bat Cave Run", "webs", "cave"], ["Wisp Way", "bounce"],
      ["Midnight Swing", "vines"], ["Dreamy Dell", "stream", "night", "mist"], ["Moth Lamp Lane", "webs"], ["Sleepy Bear Den", "logs"],
      ["Twinkle Tunnel", "zipline"], ["Comet Clearing", "highroad"], ["Dawn Gate", "bridge", "morning", "mist"], ["Night Grump's Lair", "webs"],
    ],
  },
  {
    id: "blossom", name: "Blossom Hills", emoji: "🌸", accent: "#FF8FC7", accent2: "#7CD35A", villain: "the Queen Bee", boss: "queenbee",
    blurb: "Spring on the hills: blossom trees, kites on the breeze, honey everywhere — and very busy bees.", newIdea: "kites on the wind, bee chases and petal rapids",
    tod: "day", weather: "petals", fruits: rot(2), haz: "{}",
    pool: ["kite", "chaser", "raft", "gusts", "highroad", "bounce", "vines", "rollers"],
    tune: [79, 83, 86, 83, 79, 81, 83, 86, 88, 86, 83, 81, 79, 81, 83, 79, 86, 88, 91, 88, 86, 83, 81, 83, 84, 83, 81, 79, 78, 79, 81, 79],
    adj: ["Blossom", "Honey", "Petal", "Tulip", "Breezy"], noun: ["Hills", "Meadow", "Garden", "Terraces", "Fair"],
    places: [
      ["Petal Path", "none"], ["Kite Hill", "kite"], ["Bee Meadow", "chaser"], ["Honey Hollow", "logs"],
      ["Blossom Bridge", "bridge"], ["Spring Breeze", "gusts"], ["Tulip Terraces", "highroad"], ["Butterfly Dance", "stream", "day", "butterflies"],
      ["Picnic Peak", "rollers"], ["Daisy Chain Run", "vines"], ["Pollen Puffs", "bounce"], ["Hive Chase", "chaser"],
      ["Windmill Way", "gusts", "day", "wind"], ["Rainbow Garden", "lily", "day", "butterflies"], ["Blossom Rain", "kite"], ["Ladybug Lane", "rollers"],
      ["Bloom Maze", "highroad"], ["Petal Rapids", "raft"], ["Hilltop Fair", "bounce", "sunset"], ["Queen Bee's Garden", "chaser", "sunset"],
    ],
  },
  {
    id: "caves", name: "Crystal Caves", emoji: "💎", accent: "#3DE0FF", accent2: "#7A3FCB", villain: "the Crystal Golem", boss: "golem", ride: "boat",
    blurb: "Deep under the roots: glowing crystals, underground rivers and stalactites that drop from the ceiling!", newIdea: "underground boats and falling stalactites",
    tod: "cave", weather: "fireflies", fruits: rot(5), haz: "C",
    pool: ["raft", "ride", "coconuts", "bridge", "vines", "stream", "collapse", "zipline", "chaser"],
    tune: [71, 74, 78, 74, 71, 73, 74, 78, 79, 78, 74, 73, 71, 73, 74, 71, 78, 79, 83, 79, 78, 74, 73, 74, 78, 74, 73, 70, 71, 73, 70, 71],
    adj: ["Crystal", "Glowing", "Echoing", "Amethyst", "Shimmering"], noun: ["Caves", "Hall", "Tunnels", "Grotto", "Vault"],
    places: [
      ["Root Gate", "none", "cave"], ["Glow Crystal Hall", "rollers"], ["Stalactite Drip", "coconuts"], ["Underground River", "raft"],
      ["Bat Swarm Run", "chaser"], ["Echo Chamber", "vines"], ["Geode Garden", "bounce"], ["Mole Tunnels", "logs"],
      ["Amethyst Falls", "slide"], ["Lantern Boat", "ride"], ["Crystal Bridge", "collapse"], ["Rumble Rocks", "rollers"],
      ["Deep Roots", "highroad"], ["Shimmer Lake", "lily"], ["Cave Pearls", "stream"], ["Mushroom Lamps", "bounce"],
      ["Gem Galleries", "coconuts"], ["Prism Pass", "zipline"], ["Sunbeam Shaft", "vines", "day", "none"], ["Golem's Vault", "raft"],
    ],
  },
  {
    id: "autumn", name: "Autumn Maple Woods", emoji: "🍁", accent: "#FF8A3D", accent2: "#C2452A", villain: "the Scarecrow King", boss: "scarecrow", ride: "squirrel",
    blurb: "Orange and red maples, pumpkins and haystacks — careful, leaf piles hide holes!", newIdea: "leaf piles that hide holes, rolling acorns and the Squirrel Sled",
    tod: "day", weather: "leaves", fruits: rot(3), haz: "{}_",
    pool: ["rollers", "ride", "gusts", "slide", "highroad", "vines", "bridge", "logs", "pits"],
    tune: [69, 72, 76, 72, 69, 71, 72, 76, 77, 76, 72, 71, 69, 71, 72, 69, 76, 77, 81, 77, 76, 72, 71, 72, 74, 72, 71, 68, 69, 71, 68, 69],
    adj: ["Maple", "Golden", "Harvest", "Pumpkin", "Crunchy"], noun: ["Woods", "Orchard", "Field", "Mill", "Brook"],
    places: [
      ["Maple Lane", "none"], ["Leaf Pile Leaps", "pits"], ["Acorn Roll", "rollers"], ["Squirrel Stash", "ride"],
      ["Pumpkin Patch", "logs"], ["Harvest Fair", "highroad"], ["Orange Canopy", "vines"], ["Windy Gusts", "gusts", "day", "wind"],
      ["Chestnut Hill", "rollers"], ["Apple Orchard", "stream"], ["Cider Mill", "raft"], ["Hayride Trail", "ride"],
      ["Golden Brook", "lily", "sunset"], ["Scarecrow Field", "pits"], ["Mushroom Fair", "bounce"], ["Falling Leaves", "slide"],
      ["Owl Barn", "highroad", "night", "fireflies"], ["Foggy Morning", "bridge", "morning", "mist"], ["Corn Maze", "pits", "sunset"], ["Scarecrow King's Field", "gusts", "sunset", "wind"],
    ],
  },
  {
    id: "plains", name: "Elephant Plains", emoji: "🐘", accent: "#FFC23D", accent2: "#C98A55", villain: "the Rhino Grump", boss: "rhino", ride: "elephant",
    blurb: "Wide golden grass, acacia trees and watering holes — ride Ellie the elephant through the stampede!", newIdea: "elephant rides, stampedes and dust storms",
    tod: "day", weather: "dust", fruits: rot(0), haz: "{}",
    pool: ["ride", "chaser", "gusts", "rollers", "highroad", "stream", "bridge", "logs"],
    tune: [77, 79, 81, 84, 86, 84, 81, 79, 77, 81, 84, 89, 86, 84, 81, 84, 82, 81, 79, 77, 79, 81, 84, 81, 79, 77, 74, 77, 79, 81, 77, 77],
    adj: ["Savanna", "Dusty", "Golden", "Acacia", "Sunbaked"], noun: ["Plains", "Watering Hole", "Hills", "Trail", "Rock"],
    places: [
      ["Savanna Edge", "none"], ["Acacia Run", "highroad"], ["Watering Hole", "stream"], ["Elephant Parade", "ride"],
      ["Zebra Crossing", "logs"], ["Dust Storm", "gusts"], ["Termite Towers", "rollers"], ["Baobab Giant", "highroad"],
      ["Meerkat Lookout", "bounce"], ["Giraffe Bridge", "bridge"], ["Lion Rock", "rollers"], ["Stampede!", "chaser"],
      ["Hot Winds", "gusts", "day", "wind"], ["Rhino Rumble", "chaser"], ["Sunset Plains", "ride", "sunset"], ["Flamingo Lake", "lily", "sunset", "none"],
      ["Kopje Hills", "bounce"], ["Hippo Pools", "raft"], ["Migration Trail", "ride"], ["Rhino Grump's Fort", "rollers", "sunset"],
    ],
  },
  {
    id: "mangrove", name: "Misty Mangroves", emoji: "🌫️", accent: "#5FD3A8", accent2: "#2A5A4A", villain: "the Swamp Witch Grump", boss: "witch", ride: "pelican",
    blurb: "Foggy water forests on tangled stilt roots — row through the tides and hop the sinking logs.", newIdea: "fog, root mazes, tides and the Pelican Lift",
    tod: "morning", weather: "mist", fruits: rot(4), haz: "M",
    pool: ["raft", "mud", "ride", "lily", "bridge", "collapse", "vines", "stream", "geysers"],
    tune: [74, 77, 81, 77, 74, 76, 77, 81, 82, 81, 77, 76, 74, 76, 77, 74, 81, 82, 86, 82, 81, 77, 76, 77, 81, 77, 76, 73, 74, 76, 73, 74],
    adj: ["Misty", "Tangled", "Foggy", "Muddy", "Tidal"], noun: ["Mangroves", "Roots", "Swamp", "Tides", "Pier"],
    places: [
      ["Root Maze", "logs"], ["Fog Bank", "mud"], ["Boat Dock", "raft"], ["Firefly Swamp", "lily", "night", "fireflies"],
      ["Crab Claw Coast", "rollers"], ["Tidal Flats", "mud"], ["Heron Hunt", "vines"], ["Sinking Logs", "collapse"],
      ["Mudskipper Run", "mud"], ["Lantern Boats", "raft", "night", "fireflies"], ["Croc Crowns", "lily"], ["Swamp Gas", "geysers"],
      ["Moss Curtains", "vines"], ["Turtle Bridges", "bridge"], ["Mist Mirrors", "stream"], ["Tide Turn", "raft"],
      ["Pelican Pier", "ride", "day", "none"], ["Sunken Ruins", "highroad"], ["Moon Tide", "lily", "night", "fireflies"], ["Swamp Witch's Hut", "mud", "night", "mist"],
    ],
  },
  {
    id: "snow", name: "Snowpine Peaks", emoji: "❄️", accent: "#9FE6FF", accent2: "#3D8BFF", villain: "the Yeti Grump", boss: "yeti", ride: "sled",
    blurb: "Snowy pines high in the mountains: ice slides, snowballs, icicles — and avalanches!", newIdea: "slippery ice, ice slides, snowballs and avalanches",
    tod: "morning", weather: "snow", fruits: rot(1), haz: "I",
    pool: ["ice", "slide", "ride", "chaser", "rollers", "bridge", "zipline", "vines", "coconuts"],
    tune: [74, 78, 81, 86, 85, 81, 78, 81, 79, 83, 86, 83, 81, 78, 76, 78, 74, 78, 81, 83, 86, 88, 90, 86, 88, 85, 81, 85, 86, 81, 78, 74],
    adj: ["Frosty", "Snowy", "Icy", "Sparkly", "Chilly"], noun: ["Peaks", "Pines", "Slopes", "Lake", "Pass"],
    places: [
      ["Frosty Pines", "none"], ["Ice Slide", "slide"], ["Snowball Roll", "rollers"], ["Igloo Village", "ice"],
      ["Icicle Alley", "coconuts"], ["Avalanche Run", "chaser"], ["Frozen Lake", "ice"], ["Chairlift Swing", "zipline", "day", "none"],
      ["Yeti Footprints", "logs"], ["Hot Spring Hop", "lily", "day", "mist"], ["Snow Owl Ridge", "highroad"], ["Northern Lights", "ice", "night", "none"],
      ["Snowdrift Dash", "ride"], ["Sled Hill", "slide"], ["Crystal Icefall", "bridge"], ["Penguin Parade", "rollers", "day", "none"],
      ["Blizzard Pass", "gusts", "day", "snow"], ["Glacier Cave", "stream", "cave", "none"], ["Summit Hut", "zipline", "sunset"], ["Yeti Grump's Peak", "chaser", "sunset"],
    ],
  },
  {
    id: "volcano", name: "Volcano Jungle", emoji: "🌋", accent: "#FF5A1F", accent2: "#5A2A2A", villain: "Baron Bramble", boss: "baron", ride: "dino",
    blurb: "The smoky jungle around Baron Bramble's thorn castle: geysers, lava stones and ash in the air.", newIdea: "geysers, lava stepping stones, ash rain and the Dragonfruit Dino",
    tod: "sunset", weather: "ash", fruits: rot(5), haz: "G",
    pool: ["geysers", "stones", "ride", "bridge", "zipline", "chaser", "rollers", "vines", "collapse"],
    tune: [72, 75, 79, 75, 72, 74, 75, 79, 80, 79, 75, 74, 72, 74, 75, 72, 79, 80, 84, 80, 79, 75, 74, 75, 79, 75, 74, 71, 72, 74, 71, 72],
    adj: ["Smoky", "Fiery", "Ember", "Thorny", "Molten"], noun: ["Volcano", "Crater", "Lava Field", "Castle Road", "Vents"],
    places: [
      ["Ash Trail", "none"], ["Hot Springs", "lily", "sunset", "mist"], ["Geyser Jumps", "geysers"], ["Lava Stones", "stones"],
      ["Obsidian Bridge", "bridge"], ["Steam Vents", "geysers", "sunset", "mist"], ["Fire Flower Field", "rollers"], ["Magma River", "stones"],
      ["Smoky Canopy", "highroad"], ["Ember Rain", "coconuts"], ["Basalt Steps", "bounce"], ["Crater Rim", "collapse"],
      ["Lava Tube", "zipline", "cave", "ash"], ["Dragonfruit Grove", "ride"], ["Thorn Walls", "logs"], ["Bramble Maze", "pits"],
      ["Smoke Signals", "chaser"], ["Burning Sky", "stones", "night", "ash"], ["Thorn Castle Gate", "geysers", "night", "ash"], ["Bramble's Last Stand", "vines", "sunset", "petals"],
    ],
  },
];
export const regionIndex = (id: RegionId) => Math.max(0, REGIONS.findIndex((r) => r.id === id));

export const RIDES: Record<RideId, { name: string; icon: string; text: string }> = {
  turtle: { name: "Shelly the Turtle", icon: "🐢", text: "Shelly swims, smashes and carries you over the water!" },
  panda: { name: "Rolo the Red Panda", icon: "🐼", text: "Rolo is super fast at changing lanes!" },
  frog: { name: "Frog Taxi", icon: "🐸", text: "Hop hop hop — the Frog Taxi jumps everything!" },
  boat: { name: "Glowworm Boat", icon: "🛶", text: "Glide through the caves on a glowing boat!" },
  squirrel: { name: "Squirrel Sled", icon: "🐿️", text: "Zoom on the acorn sled — leaf piles can't stop you!" },
  elephant: { name: "Ellie the Elephant", icon: "🐘", text: "Ellie stomps through anything in the way!" },
  pelican: { name: "Pelican Lift", icon: "🐦", text: "The pelican flies you over the swamp!" },
  sled: { name: "Snow Sled", icon: "🛷", text: "Whoosh down the snow, smashing snowmen!" },
  dino: { name: "Dragonfruit Dino", icon: "🦕", text: "A dino! Stomp through the lava fields!" },
};
/** a ride lasts this long (seconds) */
export const RIDE_T = 10;

export const BOSSES: Record<string, { name: string; icon: string; line: string }> = {
  gatekeeper: { name: "Grumpy Gatekeeper", icon: "🗝️", line: "Nobody passes my gate!" },
  crocking: { name: "Croc King", icon: "🐊", line: "My crown! Where's my crown?!" },
  bandit: { name: "Bamboo Bandit", icon: "🎭", line: "Mine! All the seeds are mine!" },
  warden: { name: "Waterfall Warden", icon: "💧", line: "No splashing in my waterfall!" },
  puffcap: { name: "Puffcap Baron", icon: "🍄", line: "Achoo! Spores everywhere!" },
  storm: { name: "Storm Grump", icon: "⛈️", line: "Ah… ah… ACHOO-thunder!" },
  woodpecker: { name: "King Woodpecker", icon: "🐦", line: "Tok tok tok! My treetops!" },
  nightgrump: { name: "Night Grump", icon: "🦇", line: "Turn off those fireflies!" },
  queenbee: { name: "Queen Bee", icon: "🐝", line: "Bzzz! That honey is MINE!" },
  golem: { name: "Crystal Golem", icon: "💎", line: "ROCKS. FALL. NOW." },
  scarecrow: { name: "Scarecrow King", icon: "🎃", line: "Even the crows laugh at me…" },
  rhino: { name: "Rhino Grump", icon: "🦏", line: "Charge first, think later!" },
  witch: { name: "Swamp Witch Grump", icon: "🧙", line: "Hee hee! A little fog for you!" },
  yeti: { name: "Yeti Grump", icon: "❄️", line: "Brrr… go away, it's MY snow!" },
  baron: { name: "Baron Bramble", icon: "🌵", line: "The seeds are mine! Ow — my own thorns!" },
};
