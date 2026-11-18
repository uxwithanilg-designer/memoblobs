// The 20 zones of Clayland (20 stages each = 400 designed stages; Rain Raid, docs/PUDDO_RAIN_RAID_PLAN.md). Each zone
// has four districts (the look changes every 5 stages), its own palette, music, wild creatures, the Dust Army types it
// brings in, a general's war machine at stage 10 and a boss who guards a Rain Bell at stage 20.
import type { BossKind, Concept, EnemyKind, Feature, Island, IslandId } from "./types";

type BaseIsland = Omit<Island, "stages" | "districts" | "army" | "machine" | "props"> & { stages: string[]; props: string };

const names = (s: string) => s.split(",").map((x) => x.trim());

const BASE: BaseIsland[] = [
  {
    id: "shore", n: 1, name: "Sprout Shore", idea: "Hold FIRE (X) to blast the Dust Army — they melt into coins",
    stages: names("Sprout Beach, Sandcastle Steps, Tide Pool Path, Coconut Cove, Shell Hill, Driftwood Docks, Seagull Rocks, Palm Hop, Clay Pot Bay, Wave Break, Crabwalk Coast, Lighthouse Lane, Sunny Sandbar, Pinch Point, Captain Clack's Cove"),
    features: ["breakable", "spikes", "squeeze"], enemies: ["pincher", "snail", "gull"],
    boss: { kind: "clack", name: "Captain Clack" }, music: "shore",
    pal: { ground: "#E8B35A", top: "#7ED957", brick: "#F2C46D", block: "#FF8A5B", accent: "#FF5F7E", sky: ["#5EC8FF", "#D8F4FF"], fog: "#CFEFFF", far: "#7FC6E8", mid: "#4FB36B" },
    props: "beach", weather: "sun",
    story: "The Dust Army is marching up Sprout Shore — grey, cracked clay soldiers baked by Kranky's Dust Engine. Under the beach Puddo found the Rain Blaster. Soak them back into mud!",
  },
  {
    id: "grove", n: 2, name: "Fruitpop Grove", idea: "Shield Dusties · Bomb Gulls · tall trees to climb · river rafts",
    stages: names("Orchard Gate, Apple Ladder, Berry Bramble, Plum Path, Turbo's Garage, Melon Meadow, Cherry Hills, Peach Pond, Grape Vine Bridge, Rolling Coconut Road, Juice Falls, Fig Tree Fort, Lemon Lane, Harvest Ridge, Big Bonk's Orchard"),
    features: ["coconut", "breakable", "spikes", "lift"], enemies: ["coconutCrab", "bee", "snail", "pincher"], friend: "turbo",
    boss: { kind: "bonk", name: "Big Bonk" }, music: "grove",
    pal: { ground: "#B9783F", top: "#5BCB4A", brick: "#D9925A", block: "#FFB43D", accent: "#FF4D6D", sky: ["#6FD3FF", "#F2FFE0"], fog: "#E6FFE0", far: "#8FD49A", mid: "#3FA34D" },
    props: "orchard", weather: "sun",
    story: "Sergeant Grit's troops are pumping Fruitpop Grove dry. Smash the juice pumps, climb the big trees — and watch out for shields and Bomb Gulls.",
  },
  {
    id: "caves", n: 3, name: "Pebble Caves", idea: "Turrets · Dust Hives (bomb them!) · mine carts · deep shafts",
    stages: names("Cave Mouth, Torch Tunnel, Drip Drop Hall, Stone Lift Shaft, Glowworm Gallery, Bonfire Bend, Bat Belfry, Crumbly Floor, Pebble Slide, Boulder Run, Echo Steps, Underground Spring, Brick Maze, Deep Lift Ride, Mole Major's Den"),
    features: ["lift", "vlift", "crumble", "bonfire", "drip", "breakable", "spikes"], enemies: ["bat", "mole", "snail", "pincher"],
    boss: { kind: "mole", name: "Mole Major" }, music: "caves",
    pal: { ground: "#E0A94F", top: "#F2C46D", brick: "#2F56C9", block: "#FF7A93", accent: "#FFB347", sky: ["#1B2A6B", "#2E4BB0"], fog: "#24357F", far: "#22327A", mid: "#2B3F96" },
    props: "cave", weather: "dust",
    story: "Grit's crew dug the caves full of turrets and Dust Hives. Ride the mine carts, dive down the shafts and find the crystal keys.",
  },
  {
    id: "lagoon", n: 4, name: "Bubble Lagoon", idea: "Dive Hawks · Mortars · Brick Brutes · Grit's Bubble Sub",
    stages: names("Lagoon Shallows, Bubble Reef, Kelp Curtain, Clam Garden, Pip's Pier, Current Cove, Jelly Drift, Sunken Boat, Coral Arches, Tide Rush, Turtle Rock, Whirlpool Way, Seahorse Stables, Pearl Grotto, Puffer Pete's Reef"),
    features: ["water", "current", "lift", "spikes", "breakable"], enemies: ["jelly", "puffer", "fish", "pincher"], friend: "pip",
    boss: { kind: "puffer", name: "Puffer Pete" }, music: "lagoon",
    pal: { ground: "#F0D08A", top: "#FF9EC4", brick: "#5FD3C4", block: "#FFC94D", accent: "#FF6FAE", sky: ["#3FD0FF", "#C9FBFF"], fog: "#B8F2FF", far: "#6FDCE8", mid: "#2FB8B0" },
    props: "reef", weather: "sun",
    story: "Grit is hiding the stolen rain in a submarine under Bubble Lagoon. Dive into the wreck, hold the kelp well — and catch him!",
  },
  {
    id: "cliffs", n: 5, name: "Windy Kite Cliffs", idea: "Wind gusts · cloud ledges · glide with Hoot",
    stages: names("Breezy Ledge, Kite Hill, Gust Gap, Pinwheel Path, Hoot's Lookout, Feather Falls, Cliffside Stairs, Updraft Canyon, Windmill Rise, Tailwind Dash, Cloud Shelf, Sky Rope Bridge, Storm Gust, Eagle Rocks, Gale Gull's Nest"),
    features: ["wind", "cloud", "lift", "spikes", "spring"], enemies: ["hawk", "gull", "pincher", "snail"], friend: "hoot",
    boss: { kind: "gull", name: "Gale Gull" }, music: "cliffs",
    pal: { ground: "#A9A0C8", top: "#8EE06B", brick: "#C9B8E8", block: "#FFD23F", accent: "#5FB8FF", sky: ["#7FB8FF", "#FFF0D6"], fog: "#FFEEDD", far: "#B9C8F0", mid: "#7FB06B" },
    props: "cliffs", weather: "wind",
    story: "Act 2 — Dust Rising. Major Rasp's army holds the high cliffs. Ride the updrafts with Prof. Hoot, take the lifts — and step out of the snipers' red lines.",
  },
  {
    id: "candy", n: 6, name: "Sugarcrumb Hills", idea: "Sticky caramel · marshmallow bounce · melting steps",
    stages: names("Candy Gate, Gumdrop Garden, Caramel Creek, Marshmallow Bounce, Sprinkle Slopes, Lollipop Lane, Cookie Crumble Cliffs, Jelly Jiggle, Choco River, Sugar Rush, Taffy Twist, Cupcake Castle, Licorice Ladders, Frosting Falls, Gummy Grump's Bakery"),
    features: ["caramel", "crumble", "spring", "spikes", "lift"], enemies: ["gumdrop", "gummy", "bee", "snail"],
    boss: { kind: "gummy", name: "Gummy Grump" }, music: "candy",
    pal: { ground: "#C98A5A", top: "#FF8FC7", brick: "#FFB3D9", block: "#7FE0D0", accent: "#9F7BFF", sky: ["#FFB8E6", "#FFF3C9"], fog: "#FFE3F2", far: "#FFC9E8", mid: "#FF8FB8" },
    props: "candy", weather: "sun",
    story: "The candy hills are melting into hot caramel. Rasp's presses stamp out Dust candy. Flip the switches, drive a gumball tank — and climb before the caramel does.",
  },
  {
    id: "toybox", n: 7, name: "Toybox Town", idea: "Springs · conveyor belts · ON/OFF blocks · Bolt's boots",
    stages: names("Toy Shelf, Block Tower, Wind-Up Walk, Spring Street, Bolt's Workshop, Switch Block Square, Ribbon Belts, Marble Run, Puzzle Box, Domino Drop, Teddy Trampolines, Rocket Ride, Train Track Tricks, Clockwork Climb, Jack-in-the-Crab's Box"),
    features: ["spring", "conveyor", "switch", "lift", "spikes"], enemies: ["windup", "toySoldier", "pincher", "gull"], friend: "bolt",
    boss: { kind: "jack", name: "Jack-in-the-Crab" }, music: "toybox",
    pal: { ground: "#5B8CFF", top: "#FFD23F", brick: "#FF5F5F", block: "#4FD18B", accent: "#FFFFFF", sky: ["#FFE7B8", "#FFF8EC"], fog: "#FFF2DD", far: "#FFD9A8", mid: "#8FB8FF" },
    props: "toys", weather: "sun",
    story: "Rasp turned Toybox Town into a toy army. Ride the toy train, suit up in a clay mech, and escort the rain cart through the playroom.",
  },
  {
    id: "mire", n: 8, name: "Mushroom Mire", idea: "Bouncy caps · poison puddles · Gloop's wall climb",
    stages: names("Mire Entrance, Bouncecap Bridge, Fog Hollow, Poison Puddle Path, Gloop's Swamp, Spore Cloud Steps, Toadstool Towers, Sticky Root Walls, Glowshroom Grotto, Rising Mud Chase, Lily Log Leap, Fungus Fair, Moss Ladders, Mire Maze, Spore Lord's Ring"),
    features: ["spring", "poison", "fog", "walls", "crumble", "lift"], enemies: ["shroom", "frog", "bee", "snail"], friend: "gloop",
    boss: { kind: "spore", name: "Spore Lord" }, music: "mire",
    pal: { ground: "#5E4B7A", top: "#7FD36A", brick: "#8A6BB8", block: "#FF5FA2", accent: "#B6FF5C", sky: ["#4B5D8F", "#B8D0A8"], fog: "#9FB8A0", far: "#5F7A70", mid: "#3F6B4F" },
    props: "mushroom", weather: "fog",
    story: "Fog, spores and creeping roots. Light the lanterns, slip past the witch-lights — and don't let the roots grab you.",
  },
  {
    id: "peaks", n: 9, name: "Frostbite Peaks", idea: "Slippery ice · falling icicles · rolling snowballs",
    stages: names("Frosty Gate, Slippy Slopes, Icicle Alley, Snowball Hill, Pip's Ice Rink, Frozen Falls, Igloo Hop, Blizzard Bridge, Glacier Crack, Avalanche Alley, Snow Cloud Steps, Crystal Ice Cave, Hot Cocoa Hut, Summit Climb, Walrus Wally's Peak"),
    features: ["ice", "icicle", "snowball", "lift", "spikes", "crumble"], enemies: ["penguin", "yeti", "gull", "snail"], friend: "pip",
    boss: { kind: "walrus", name: "Walrus Wally" }, music: "peaks",
    pal: { ground: "#9FC8E8", top: "#FFFFFF", brick: "#BFE3FF", block: "#5FB8FF", accent: "#FF5F7E", sky: ["#8FC8FF", "#F2FAFF"], fog: "#E8F6FF", far: "#C8E2F5", mid: "#9FC4DE" },
    props: "snow", weather: "snow",
    story: "Act 3 — The Great Drought. Colonel Clinker froze the peaks to stop the rain. Slide the ice, outrun the avalanche, wall-jump up the frozen chimneys.",
  },
  {
    id: "dunes", n: 10, name: "Dusty Dunes", idea: "Sandstorms · quicksand · sand jets · tanks in the dunes",
    stages: names("Dune Gate, Cactus Corner, Shady Palm Stop, Mirage Mile, Oasis Hop, Quicksand Pit, Sand Geyser Gulch, Tumbleweed Trail, Pyramid Steps, Sandstorm Chase, Sunbaked Canyon, Scarab Run, Camel Bridge, Heatwave Highway, Sandy Scorpion's Tomb"),
    features: ["heat", "quicksand", "sandjet", "spikes", "lift", "crumble"], enemies: ["scorpion", "cactus", "snake", "hawk"],
    boss: { kind: "scorpion", name: "Sandy Scorpion" }, music: "dunes",
    pal: { ground: "#E8A64F", top: "#F7D07A", brick: "#D98A3F", block: "#3FC1B0", accent: "#FF5F3F", sky: ["#FFB65C", "#FFF0C2"], fog: "#FFE2B0", far: "#F2C27A", mid: "#E0A050" },
    props: "desert", weather: "dust",
    story: "This is the desert Kranky wants everywhere. Sandstorms hide the Dust Army and sand sharks lurk under the dunes. Get the water cart to the oasis!",
  },
  {
    id: "lantern", n: 11, name: "Lantern Woods", idea: "Darkness — lanterns light the way · ambushes in the night",
    stages: names("Lantern Gate, Firefly Path, Moonlit Glade, Owl Hollow, Paper Lantern Bridge, Spider Drop, Shadow Steps, Glowing Pond, Midnight Market, Moth Swarm Chase, Hollow Tree Climb, Star Lantern Hill, Whisper Woods, Dawn Run, Moth Mama's Lamp"),
    features: ["dark", "spider", "lift", "spikes", "crumble", "breakable"], enemies: ["moth", "bat", "frog", "snail"],
    boss: { kind: "moth", name: "Moth Mama" }, music: "lantern", night: true,
    pal: { ground: "#3E3566", top: "#5FD38B", brick: "#5A4B8F", block: "#FFC94D", accent: "#FFE08A", sky: ["#0E1238", "#2B2F6B"], fog: "#1B1F4F", far: "#1F2458", mid: "#262E62" },
    props: "night", weather: "night",
    story: "Clinker stole the moon's light. In the dark woods the lanterns are everything — and armored Kiln Knights hunt in the shadows.",
  },
  {
    id: "factory", n: 12, name: "Gearworks Factory", idea: "Crushers · laser fences · belts",
    stages: names("Factory Gate, Conveyor Corridor, Crusher Hall, Piston Pass, Bolt's Boiler Room, Laser Lattice, Steam Pipes, Assembly Line, Magnet Bay, Press Line Chase, Cog Climb, Oil Slick Slide, Spark Tunnel, Furnace Floor, Mecha Pinch's Plant"),
    features: ["crusher", "laser", "conveyor", "switch", "lift", "spikes"], enemies: ["sentry", "drone", "windup", "pincher"], friend: "bolt",
    boss: { kind: "mecha", name: "Mecha Pinch" }, music: "factory",
    pal: { ground: "#5F6B7A", top: "#FFC21A", brick: "#7A8494", block: "#FF7A1F", accent: "#3DE0FF", sky: ["#2B3448", "#6B7A90"], fog: "#4A5568", far: "#3A4458", mid: "#4F5A6E" },
    props: "factory", weather: "dust",
    story: "The heart of the Dust factories. Lava rises, belts roll, presses slam. Shut it all down — and wreck Clinker's Forge Mech!",
  },
  {
    id: "temple", n: 13, name: "Vine Temple Ruins", idea: "Swinging platforms · arrow walls · rolling stones · Noodle bridge",
    stages: names("Temple Steps, Rope Swing Hall, Arrow Wall Way, Moss Pillars, Noodle's Gap, Idol Room, Crumbling Bridge, Snake Statue Steps, Hidden Chamber, Rolling Stone Run, Spike Floor Dance, Golden Doors, Trap Corridor, Sunbeam Shrine, Stone Guardian's Hall"),
    features: ["swing", "arrow", "stone", "crumble", "spikes", "breakable"], enemies: ["snake", "stoneHead", "bat", "frog"], friend: "noodle",
    boss: { kind: "guardian", name: "Stone Guardian" }, music: "temple",
    pal: { ground: "#8A7A5A", top: "#6BC24F", brick: "#B8A27A", block: "#4FB3A8", accent: "#FFD23F", sky: ["#8FD0A8", "#F2F0C8"], fog: "#D8E8C0", far: "#8FB890", mid: "#5F9A60" },
    props: "temple", weather: "sun",
    story: "Old traps still work in the temple. Noodle is SO long he can be a bridge — find his pot!",
  },
  {
    id: "clouds", n: 14, name: "Cloud Castle Gardens", idea: "Puffy clouds · beanstalk climbs · rain clouds · Zib's UFO",
    stages: names("Cloud Gate, Puffy Path, Beanstalk Climb, Raincloud Ride, Zib's Landing, Rainbow Bridge, Sky Fountain, Cloud Hedge Maze, Sunbeam Stairs, Thunder Chase, Balloon Garden, Floating Isles, Feather Fields, Castle Ramparts, Nimbus Knight's Tower"),
    features: ["cloud", "climb", "raincloud", "lift", "vlift", "spring"], enemies: ["thunderDuck", "hawk", "gull", "bee"], friend: "zib",
    boss: { kind: "nimbus", name: "Nimbus Knight" }, music: "clouds",
    pal: { ground: "#E8E2FF", top: "#9FF0A8", brick: "#FFFFFF", block: "#FFB8E6", accent: "#7FD8FF", sky: ["#6FB8FF", "#FFFFFF"], fog: "#F2F8FF", far: "#DDEBFF", mid: "#C8DDFF" },
    props: "clouds", weather: "sun",
    story: "Above the clouds, Nimbus Knight guards a bell in his tower. Zib crash-landed his UFO here — help him fly again.",
  },
  {
    id: "neon", n: 15, name: "Neon Night City", idea: "Rooftops · platforms that blink to the beat",
    stages: names("Neon Gate, Rooftop Run, Billboard Bounce, Beat Blocks, Taxi Tops, Subway Steam, Crane Climb, Laser Show, Fire Escape, Midnight Express, Arcade Alley, Bass Drop Bridge, Glow Sign Steps, Skyline Sprint, DJ Lobster's Club"),
    features: ["beat", "lift", "spring", "laser", "spikes", "conveyor"], enemies: ["neonBot", "drone", "pincher", "gull"],
    boss: { kind: "dj", name: "DJ Lobster" }, music: "neon", night: true,
    pal: { ground: "#2B2550", top: "#FF3DC8", brick: "#3B2F7A", block: "#3DE0FF", accent: "#FFE03D", sky: ["#120A2E", "#3A1A6B"], fog: "#2A1550", far: "#2A1F5F", mid: "#3A2A7A" },
    props: "city", weather: "night",
    story: "DJ Lobster plays the city's bell as a drum! The blocks here blink to his beat — jump on the drum hits.",
  },
  {
    id: "volcano", n: 16, name: "Volcano Vents", idea: "Lava · geysers · falling rocks · magma Dusties",
    stages: names("Ember Gate, Ash Trail, Lava Stepping Stones, Geyser Jumps, Hot Splat Hollow, Magma Lifts, Obsidian Steps, Smoke Stacks, Fire Flower Field, Eruption Run, Rock Rain, Lava Fall Bridge, Crater Rim, Cinder Climb, Magma Crab's Crater"),
    features: ["lava", "geyser", "rockfall", "lift", "bonfire", "crumble"], enemies: ["magma", "bat", "scorpion", "pincher"],
    boss: { kind: "magma", name: "Magma Crab" }, music: "volcano",
    pal: { ground: "#4A2E2E", top: "#FF7A3D", brick: "#6B3A2E", block: "#FFC23D", accent: "#FF3D1F", sky: ["#5A1A1A", "#FF8A3D"], fog: "#7A2E1F", far: "#5A2420", mid: "#6B2E22" },
    props: "volcano", weather: "ash",
    story: "The volcano heats Kranky's lamp. It's hot — Puddo dries fast — but the Hot Splat melts through anything.",
  },
  {
    id: "crystal", n: 17, name: "Crystal Mines", idea: "Light beams · crystal switches · lifts in the dark",
    stages: names("Mine Gate, Gem Lift, Mirror Hall, Light Beam Bridge, Shimmer Shaft, Prism Puzzle, Crystal Bats, Quartz Quake, Ruby Ropeway, Collapse Chase, Sapphire Springs, Diamond Drop, Echo Crystals, Deep Vein, Crystal Clam Queen's Throne"),
    features: ["laser", "switch", "lift", "vlift", "crumble", "spikes"], enemies: ["crystalBat", "mole", "spiderBot", "snail"],
    boss: { kind: "clam", name: "Crystal Clam Queen" }, music: "crystal",
    pal: { ground: "#3A2F5F", top: "#9F7BFF", brick: "#4F3F8A", block: "#5FF0E8", accent: "#FF7AE0", sky: ["#140F2E", "#3A2A6B"], fog: "#2A1F50", far: "#2A2058", mid: "#3A2A70" },
    props: "crystal", weather: "sparkle",
    story: "Deep in the mines the bells' echoes bounce off the crystals. Splat the crystal switches to bend the light beams.",
  },
  {
    id: "pirate", n: 18, name: "Pirate Storm Sea", idea: "Rocking decks · cannons · storm rain",
    stages: names("Harbor Gate, Plank Walk, Rocking Deck, Cannon Cove, Crow's Nest Climb, Rope Rigging, Barrel Bounce, Anchor Drop, Treasure Island, Tidal Wave Chase, Shark Fin Shallows, Lightning Mast, Stormy Waves, Whirlpool Wreck, Admiral Snap's Flagship"),
    features: ["rocking", "cannon", "water", "lift", "spring", "spikes"], enemies: ["pirateGull", "parrot", "pincher", "fish"],
    boss: { kind: "admiral", name: "Admiral Snap" }, music: "pirate",
    pal: { ground: "#8A5A3A", top: "#C8925A", brick: "#6B4A32", block: "#FFD23F", accent: "#FF3D4E", sky: ["#3A4A6B", "#9FB0C8"], fog: "#7A8AA0", far: "#4A5A78", mid: "#3A4A68" },
    props: "pirate", weather: "storm",
    story: "Kranky's fleet carries the last bells to his castle. Board the ships! The storm rain keeps Puddo nice and squishy.",
  },
  {
    id: "moon", n: 19, name: "Moon Base Isle", idea: "Low gravity · meteor showers",
    stages: names("Launch Pad, Low-G Leaps, Crater Hop, Moon Rover Road, Zib's Hangar, Star Dust Steps, Antenna Array, Orbit Ring, Space Garden, Meteor Shower Chase, Comet Tail, Airlock Run, UFO Parking Lot, Black Sky Bridge, Robo Lobster's Station"),
    features: ["lowg", "meteor", "lift", "vlift", "laser", "spikes"], enemies: ["rover", "alien", "drone", "crystalBat"], friend: "zib",
    boss: { kind: "robo", name: "Robo Lobster" }, music: "moon", night: true,
    pal: { ground: "#8A8FA8", top: "#C8CCE0", brick: "#6B7090", block: "#7FFFB0", accent: "#FF5FE0", sky: ["#05061A", "#1F1A4F"], fog: "#151538", far: "#1A1A45", mid: "#25255A" },
    props: "moon", weather: "stars",
    story: "Kranky hid a bell on the moon! Zib flies Puddo up. Jumps go sky-high — but watch out for meteors.",
  },
  {
    id: "castle", n: 20, name: "Kranky's Dry Castle", idea: "Everything at once · the Dust Engine",
    stages: names("Castle Moat, Dry Drawbridge, Sun Lamp Hall, Pinch Patrol, Sand Clock Tower, Trap Kitchen, Cracked Courtyard, Crab Cannon Wall, Hall of Mirrors, Dry-O-Matic Chase, Throne Stairs, Rain Bell Vault, Last Lift, Rooftop Rumble, The Last Rain Bell"),
    features: ["lava", "crusher", "laser", "arrow", "cannon", "heat", "lift", "crumble", "spikes", "switch"], enemies: ["pincher", "sentry", "magma", "stoneHead", "drone"],
    boss: { kind: "kranky", name: "Kranky" }, music: "castle",
    pal: { ground: "#C8A060", top: "#E8C878", brick: "#A8783F", block: "#FF5F3F", accent: "#FFD23F", sky: ["#FF9A3D", "#FFE08A"], fog: "#FFD8A0", far: "#E8A860", mid: "#C88A4F" },
    props: "castle", weather: "dust",
    story: "The Dry-O-Matic glows on Kranky's roof. All your friends are here to help — ring the Last Rain Bell!",
  },
];

// ------------------------------------------------------------------ Rain Raid: districts, names, army, machines
const N = (x: string) => x.split(",").map((t) => t.trim());
/** zones 1–4 are fully named (Phase A); later zones get names from their districts and the stage's concept */
const NAMED: Partial<Record<IslandId, string[]>> = {
  shore: N("Sprout Beach, Sandbar Skirmish, Tide Pool Rescue, Driftwood Dash, Shell Vault, Palm Village Rooftops, Pump Hut Raid, Rope Bridge Collapse, Coconut Alley Ambush, Grit's Dust Crawler, Harbor Front, Fisher's Well, Crate Stack Roofs, Net Shed Rescue, Pier Arena, Seawall Collapse, Lamp Oil Pumps, Breakwater Ambush, Lighthouse Climb, Captain Clack's Cove"),
  grove: N("Orchard Gate, Apple Tree Climb, Berry Bramble Ambush, Juice River Raft, Golden Apple Vault, Juice Pump Sabotage, Press Room Keys, Pulp Bridge Collapse, Last Juice Well, Grit's Saw Copter, Treetop Tower, Canopy Rooftops, Nest Rescue, Rapids Through the Roots, Treehouse Arena, Fruit Market Run, Stall Street Ambush, Cider Pump Smash, Market Vault Keys, Big Bonk's Orchard"),
  caves: N("Crystal Tunnel Run, Echo Shaft Dive, Geode Ambush, Locked Crystal Vaults, Gem Pocket Vault, Mine Cart Mayhem, Drill Pump Raid, Runaway Rails, Ore Lift Climb, Grit's Drill Worm, Underground Lake Raft, Sinkhole Dive, Miner Sprout Rescue, Cave Well Stand, Stalagmite Arena, Glow Maze Keys, Glowworm Express, Glow Bridge Collapse, Mushroom Hollow Ambush, Mole Major's Burrow"),
  lagoon: N("Reef Run, Lagoon Raft Rush, Coral Ambush, Shipwreck Dive, Pearl Vault, Deckhand Rescue, Mainmast Climb, Bilge Pump Blast, Storm Tide Raft, Grit's Bubble Sub, Kelp Maze Keys, Kelp Well Stand, Coral Cart Escort, Kelp Arena, Trench Dive, Bubble Works Raid, Bubble Rail Line, Pipe Hall Ambush, Last Lagoon Run, Puffer Pete's Pool"),
  cliffs: N("Cliff Path Push, Updraft Glide, Gusty Ledge Ambush, Cliff Lift Siege, Kite Coin Vault, Kite Field Collapse, Kite Runner Rescue, String Bridge Glide, Sniper Hunt, Rasp's Gyro Copter, Windmill Lift, Mill Storm Escape, Sail Pump Raid, Windmill Tower, Gale Arena, Nest Keys, Eagle Draft Glide, Peak Gauntlet, Summit Well Stand, Gale Gull's Peak"),
  candy: N("Gumdrop Push, Candy Switchworks, Licorice Ambush, Gumball Tank, Sugar Vault, Taffy Pullers, Syrup Pump Raid, Candy Cart Escort, Caramel Rising, Rasp's Candy Crusher, Sprinkle Rescue, Frosting Rooftops, Fudge Tank, Sour Hunt, Cake Arena, Cake Tower Climb, Molten Sugar Rise, Bonbon Keys, Sugar Rush Gauntlet, Gummy Grump's Bakery"),
  toybox: N("Playroom Push, Train Set Express, Block Fort Ambush, Toy Cart Escort, Piggy Bank Vault, Loop Line Express, Block City Rooftops, Robot Suit Stomp, Battery Pump Raid, Rasp's Toy Express, Gear Switch Workshop, Wind-Up Rescue, Midnight Express, Mech Workshop, Toy Box Arena, Tin Soldier Hunt, Jack-in-the-Box Escape, Puzzle Keys, Bedtime Gauntlet, Jack-in-the-Crab's Box"),
  mire: N("Spore Marsh Push, Lantern Bog, Toadstool Ambush, Witch-Light Sweep, Moss Vault, Marsh Raft, Glow Grove Rescue, Firefly Path, Root Cave Dive, Rasp's Root Borer, Shroom Hunt, Witch Hut Searchlights, Cauldron Escort, Black Bog Lanterns, Fairy Ring Arena, Hollow Keys, Spore Cloud Escape, Pump Hut Raid, Mire Gauntlet, Spore Lord's Grove"),
  peaks: N("Snowfield Push, Snowboard Slide, Ice Fort Ambush, Avalanche Escape, Frost Vault, Ice Cave Chimney, Slalom Slide, Snow Plow Tank, Igloo Rescue, Clinker's Snow Plow, Black Ice Slide, Summit Lift, Yeti Hunt, Glacier Escape, Frozen Arena, Summit Fort Lights, Fort Pump Raid, Blizzard Glide, Peak Gauntlet, Walrus Wally's Summit"),
  dunes: N("Desert Road Push, Sandstorm Crossing, Mirage Ambush, Dune Tank, Desert Vault, Oasis Water Cart, Dust Devil Storm, Oasis Raft, Scorpion Hunt, Clinker's Worm Rig, Ruin Searchlights, Tomb Keys, Great Dust Storm, Desert Express, Ruins Arena, Dust Factory Raid, Valve Works, Sand Flood Escape, Dune Gauntlet, Sandy Scorpion's Pit"),
  lantern: N("Night Forest Lanterns, Owl Watch Lights, Hollow Ambush, Ghost Hunt, Firefly Vault, Bog Lanterns, Lantern Cart Escort, Firefly Raft, Mill Chimney, Clinker's Lantern Blimp, Moonless Path, Miller Rescue, Mech of the Mill, Knight Hunt, Moonlight Arena, Moth Tower Climb, Haunted Escape, Mill Lift, Witching Gauntlet, Moth Mama's Tower"),
  factory: N("Assembly Line Push, Switch Assembly, Gear Hall Ambush, Furnace Rise, Overtime Vault, Forge Mech Walk, Boiler Pump Raid, Ore Cart Rails, Valve Maze, Clinker's Forge Mech, Molten Rise, Conveyor Express, Coal Cart Escort, Smokestack Chimney, Furnace Arena, Foreman Hunt, Freight Lift, Meltdown Escape, Factory Gauntlet, Mecha Pinch's Foundry"),
};
/** the 20-stage schedule of the first four zones (stage 10 = the general's machine, 20 = the boss) */
export const SCHEDULE: Partial<Record<IslandId, Concept[]>> = {
  shore: ["frontline", "ambush", "rescue", "frontline", "vault", "rooftops", "bombsquad", "collapse", "ambush", "machine", "frontline", "holdwell", "rooftops", "rescue", "arena", "collapse", "bombsquad", "ambush", "tower", "boss"],
  grove: ["frontline", "tower", "ambush", "raft", "vault", "bombsquad", "keyhunt", "collapse", "holdwell", "machine", "tower", "rooftops", "rescue", "raft", "arena", "frontline", "ambush", "bombsquad", "keyhunt", "boss"],
  caves: ["frontline", "dive", "ambush", "keyhunt", "vault", "minecart", "bombsquad", "minecart", "tower", "machine", "raft", "dive", "rescue", "holdwell", "arena", "keyhunt", "minecart", "collapse", "ambush", "boss"],
  lagoon: ["frontline", "raft", "ambush", "dive", "vault", "rescue", "tower", "bombsquad", "raft", "machine", "keyhunt", "holdwell", "escort", "arena", "dive", "bombsquad", "minecart", "ambush", "frontline", "boss"],
  cliffs: ["frontline", "glider", "ambush", "elevator", "vault", "collapse", "rescue", "glider", "hunt", "machine", "elevator", "escape", "bombsquad", "tower", "arena", "keyhunt", "glider", "gauntlet", "holdwell", "boss"],
  candy: ["frontline", "switchyard", "ambush", "tank", "vault", "switchyard", "bombsquad", "escort", "flood", "machine", "rescue", "rooftops", "tank", "hunt", "arena", "tower", "flood", "keyhunt", "gauntlet", "boss"],
  toybox: ["frontline", "train", "ambush", "escort", "vault", "train", "rooftops", "mech", "bombsquad", "machine", "switchyard", "rescue", "train", "mech", "arena", "hunt", "escape", "keyhunt", "gauntlet", "boss"],
  mire: ["frontline", "lantern", "ambush", "searchlight", "vault", "raft", "rescue", "lantern", "dive", "machine", "hunt", "searchlight", "escort", "lantern", "arena", "keyhunt", "escape", "bombsquad", "gauntlet", "boss"],
  peaks: ["frontline", "iceslide", "ambush", "escape", "vault", "chimney", "iceslide", "tank", "rescue", "machine", "iceslide", "elevator", "hunt", "escape", "arena", "searchlight", "bombsquad", "glider", "gauntlet", "boss"],
  dunes: ["frontline", "duststorm", "ambush", "tank", "vault", "escort", "duststorm", "raft", "hunt", "machine", "searchlight", "keyhunt", "duststorm", "train", "arena", "bombsquad", "switchyard", "escape", "gauntlet", "boss"],
  lantern: ["lantern", "searchlight", "ambush", "hunt", "vault", "lantern", "escort", "raft", "chimney", "machine", "lantern", "rescue", "mech", "hunt", "arena", "tower", "escape", "elevator", "gauntlet", "boss"],
  factory: ["frontline", "switchyard", "ambush", "flood", "vault", "mech", "bombsquad", "minecart", "switchyard", "machine", "flood", "train", "escort", "chimney", "arena", "hunt", "elevator", "escape", "gauntlet", "boss"],
};
const DISTRICTS: Record<IslandId, [string, string, string, string]> = {
  shore: ["Beach", "Palm Village", "Harbor", "Lighthouse"], grove: ["Orchard", "Juice Mill", "Treetops", "Fruit Market"],
  caves: ["Crystal Tunnels", "Mine Rails", "Underground Lake", "Glow Caverns"], lagoon: ["Reef", "Sunken Ship", "Kelp Forest", "Bubble Works"],
  cliffs: ["Cliff Path", "Kite Fields", "Windmills", "Eagle Peak"], candy: ["Gumdrop Fields", "Candy Factory", "Caramel Swamp", "Cake Tower"],
  toybox: ["Playroom", "Train Set", "Block City", "Robot Workshop"], mire: ["Spore Marsh", "Glow Grove", "Root Caves", "Witch Hut"],
  peaks: ["Snowfield", "Ice Caves", "Ski Slope", "Summit Fort"], dunes: ["Desert Road", "Oasis", "Sand Ruins", "Dust Factory"],
  lantern: ["Night Forest", "Firefly Bog", "Haunted Mill", "Moth Tower"], factory: ["Assembly", "Furnace", "Conveyor Halls", "Smokestacks"],
  temple: ["Jungle Gate", "Trap Halls", "Idol Room", "Sky Shrine"], clouds: ["Cloud Docks", "Rainbow Bridge", "Sky Gardens", "Storm Keep"],
  neon: ["Streets", "Rooftops", "Subway", "Club Tower"], volcano: ["Ash Fields", "Lava Falls", "Magma Core", "Fire Fort"],
  crystal: ["Gem Halls", "Mirror Lake", "Laser Vault", "Prism Peak"], pirate: ["Docks", "Ship Deck", "Storm Waves", "Skull Cove"],
  moon: ["Landing Pad", "Low-G Craters", "Lab", "Rocket Silo"], castle: ["Outer Walls", "Engine Halls", "Throne Tower", "Engine Core"],
};
/** scenery per district */
const PROPS: Record<IslandId, [string, string, string, string]> = {
  shore: ["beach", "orchard", "pirate", "cliffs"], grove: ["orchard", "factory", "orchard", "toys"], caves: ["crystal", "cave", "reef", "mushroom"],
  lagoon: ["reef", "pirate", "mushroom", "factory"], cliffs: ["cliffs", "cliffs", "orchard", "snow"], candy: ["candy", "factory", "candy", "toys"],
  toybox: ["toys", "toys", "city", "factory"], mire: ["mushroom", "night", "cave", "mushroom"], peaks: ["snow", "crystal", "snow", "castle"],
  dunes: ["desert", "beach", "temple", "factory"], lantern: ["night", "mushroom", "night", "night"], factory: ["factory", "volcano", "factory", "city"],
  temple: ["temple", "temple", "crystal", "clouds"], clouds: ["clouds", "candy", "clouds", "castle"], neon: ["city", "city", "factory", "city"],
  volcano: ["volcano", "volcano", "cave", "castle"], crystal: ["crystal", "reef", "factory", "crystal"], pirate: ["pirate", "pirate", "reef", "cave"],
  moon: ["moon", "moon", "factory", "moon"], castle: ["castle", "factory", "castle", "volcano"],
};
/** the Dust Army types each zone brings in (zones 5+ use all of them until Phases B–C add more) */
const ARMY: Partial<Record<IslandId, EnemyKind[]>> = {
  shore: ["dustie", "dustRunner", "pebbleGunner"], grove: ["shieldDustie", "bombGull", "dustHopper"],
  caves: ["wallTurret", "ceilTurret", "dustHive", "mineLayer"], lagoon: ["diveHawk", "mortar", "brickBrute", "dustDrone"],
  cliffs: ["laserSniper", "copterDustie", "kiteRider"],
  candy: ["towerShield", "gumBouncer", "candyCannon"],
  toybox: ["dustCart", "windupSwarm", "toyTank"],
  mire: ["sporeThrower", "rootGrabber", "witchMoth"],
  peaks: ["iceShooter", "hoverSled", "snowBrute"],
  dunes: ["sandBlower", "sandShark", "dropPod"],
  lantern: ["kilnKnight", "lanternGhost", "spiderDustie"],
  factory: ["laserTurret", "forgeBot", "crusherBot"],
};
/** stage 10: the act's general in a war machine */
const MACHINES: Record<IslandId, { kind: BossKind; name: string }> = {
  shore: { kind: "crawler", name: "Grit's Dust Crawler" }, grove: { kind: "copter", name: "Grit's Saw Copter" }, caves: { kind: "worm", name: "Grit's Drill Worm" }, lagoon: { kind: "sub", name: "Grit's Bubble Sub" },
  cliffs: { kind: "gyro", name: "Rasp's Gyro Copter" }, candy: { kind: "crusher", name: "Rasp's Candy Crusher" }, toybox: { kind: "express", name: "Rasp's Toy Express" }, mire: { kind: "borer", name: "Rasp's Root Borer" },
  peaks: { kind: "plow", name: "Clinker's Snow Plow" }, dunes: { kind: "rig", name: "Clinker's Worm Rig" }, lantern: { kind: "blimp", name: "Clinker's Lantern Blimp" }, factory: { kind: "forge", name: "Clinker's Forge Mech" },
  temple: { kind: "copter", name: "Static's Stone Drone" }, clouds: { kind: "copter", name: "Static's Thunder Barge" }, neon: { kind: "copter", name: "Static's Hover Cruiser" }, volcano: { kind: "crawler", name: "Static's Magma Tank" },
  crystal: { kind: "worm", name: "Kranky's Crystal Driller" }, pirate: { kind: "sub", name: "Kranky's Dust Galleon" }, moon: { kind: "crawler", name: "Kranky's Moon Walker" }, castle: { kind: "crawler", name: "Kranky's Engine Guard" },
};
const ALL_ARMY: EnemyKind[] = [
  "dustie", "dustRunner", "pebbleGunner", "shieldDustie", "bombGull", "dustHopper", "wallTurret", "ceilTurret", "dustHive", "mineLayer", "diveHawk", "mortar", "brickBrute", "dustDrone",
  "laserSniper", "copterDustie", "kiteRider", "towerShield", "gumBouncer", "candyCannon", "dustCart", "windupSwarm", "toyTank", "sporeThrower", "rootGrabber", "witchMoth",
  "iceShooter", "hoverSled", "snowBrute", "sandBlower", "sandShark", "dropPod", "kilnKnight", "lanternGhost", "spiderDustie", "laserTurret", "forgeBot", "crusherBot",
];
/** a stage's name from its district and concept (zones without hand-written names) */
const CONCEPT_WORDS: Record<Concept, string[]> = {
  frontline: ["Run", "Push", "Road", "March", "Dash"], ambush: ["Ambush", "Trap", "Crossfire"], rooftops: ["Rooftops", "High Roofs"], collapse: ["Collapse", "Falling Bridge"],
  tower: ["Climb", "Tower"], dive: ["Dive", "Drop"], minecart: ["Rails", "Cart Rush"], raft: ["Rapids", "Raft Run"], rescue: ["Rescue", "Sprout Rescue"],
  bombsquad: ["Pump Raid", "Pump Smash"], holdwell: ["Well Stand", "Hold the Well"], keyhunt: ["Keys", "Key Hunt"], vault: ["Vault", "Coin Vault"], arena: ["Arena", "Last Stand"],
  machine: [""], boss: [""],
  train: ["Express", "Train Top"], glider: ["Glide", "Sky Ride"], tank: ["Tank Run", "Tank Push"], mech: ["Mech Stomp", "Mech Walk"], elevator: ["Lift", "Elevator"],
  flood: ["Rise", "Flood"], chimney: ["Chimney", "Shaft Climb"], searchlight: ["Lights", "Searchlights"], lantern: ["Lanterns", "Night Path"], duststorm: ["Dust Storm", "Haze"],
  switchyard: ["Switchworks", "Works"], iceslide: ["Slide", "Slope"], escort: ["Escort", "Cart Run"], hunt: ["Hunt", "Elite Hunt"], escape: ["Escape", "Getaway"], gauntlet: ["Gauntlet", "Last Mile"],
};
export function stageName(isl: Island, s: number, concept: Concept): string {
  const named = NAMED[isl.id];
  if (named) return named[s - 1];
  if (concept === "machine") return isl.machine.name;
  if (concept === "boss") return isl.stages[19];
  const words = CONCEPT_WORDS[concept];
  return `${isl.districts[Math.floor((s - 1) / 5)]} ${words[(s + isl.n) % words.length]}`;
}

export const ISLANDS: Island[] = BASE.map((b, i) => {
  const army = ARMY[b.id] ?? ALL_ARMY;
  const lair = b.stages[b.stages.length - 1];
  return {
    ...b, stages: NAMED[b.id] ?? [...Array.from({ length: 19 }, () => ""), lair], districts: DISTRICTS[b.id], army: i < 12 ? army : ALL_ARMY,
    machine: MACHINES[b.id], props: PROPS[b.id],
  };
});

export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map((i) => [i.id, i])) as Record<IslandId, Island>;
export const STAGES_PER_ISLAND = 20;
export const DESIGNED = ISLANDS.length * STAGES_PER_ISLAND; // 400

/** global stage number (1..400) → zone and in-zone index */
export const islandOf = (n: number) => ISLANDS[Math.min(ISLANDS.length - 1, Math.floor((Math.max(1, n) - 1) / STAGES_PER_ISLAND))];
export const stageInIsland = (n: number) => ((Math.max(1, n) - 1) % STAGES_PER_ISLAND) + 1;
/** the Daily Island's stage numbers start here (see stages.ts dailyNumber) */
export const DAILY_BASE = 100000;
export const stageLabel = (n: number) => (n >= DAILY_BASE ? "Daily" : n > DESIGNED ? `E-${n - DESIGNED}` : `${islandOf(n).n}-${stageInIsland(n)}`);

/** what a feature is called on the "NEW" card when an island first uses it */
export const FEATURE_TEXT: Partial<Record<Feature, string>> = {
  lift: "Ride the stone lifts across the pits",
  crumble: "Crumbly floors fall a moment after you land",
  bonfire: "Don't touch the bonfires — jump over them",
  drip: "Watch the drips from the ceiling",
  water: "Swim! Tap jump to paddle up — Puddo can't dry out in water",
  current: "Currents push you along",
  wind: "Gusts push Puddo — lean into the wind",
  cloud: "Puffy clouds pop a moment after you land",
  caramel: "Caramel is sticky — slow running, small jumps",
  spring: "Bounce pads launch you high",
  conveyor: "Belts carry you — run with them or against them",
  switch: "Splat a switch to flip the ON/OFF blocks",
  poison: "Purple puddles hurt",
  ice: "Ice is slippery — brake early",
  icicle: "Icicles drop when you run under them",
  snowball: "Snowballs roll down at you — jump them",
  heat: "The sun dries Puddo twice as fast — rest in the shade",
  quicksand: "Quicksand pulls you down — keep jumping",
  sandjet: "Sand jets blast you upward",
  dark: "Touch the lanterns to light the woods",
  spider: "Spiders drop on their threads",
  crusher: "Crushers slam down — wait, then run",
  laser: "Laser fences blink on and off",
  swing: "Swinging platforms — time your jump",
  arrow: "Arrow walls fire across the path",
  stone: "A rolling stone is coming — run!",
  climb: "Climb the beanstalks — hold up or down",
  raincloud: "Rain clouds refill Puddo's squish",
  beat: "Blocks blink to the music's beat",
  lava: "Lava! Don't fall in",
  geyser: "Geysers blast up — ride them, don't touch them while they boil",
  rockfall: "Rocks fall from above — watch the shadows",
  rocking: "The ship's planks rock with the waves",
  cannon: "Cannons fire across the deck",
  lowg: "Low gravity — floaty jumps!",
  meteor: "Meteors fall where the red rings glow",
  coconut: "Coconuts roll down the hills",
  breakable: "Squish Stomp (↓ in the air) breaks cracked blocks",
  squeeze: "Hold ↓ to squeeze through low gaps",
  walls: "Gloop sticks to walls — jump from wall to wall",
};
