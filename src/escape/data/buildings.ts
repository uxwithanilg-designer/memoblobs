// The 24 buildings Kranky has locked down (docs/MOMO_ESCAPE_PLAN.md §5). Each has risograph inks, a soundtrack (built on
// the MOMOBLOBS procedural music styles), the concepts it introduces and its finale floor.

export interface Inks {
  /** paper */ paper: string;
  /** walls (main ink) */ wall: string;
  /** misregistered shadow / halftone ink */ shade: string;
  /** hazards (hot fluoro ink) */ hot: string;
  /** pickups, accents */ cool: string;
  /** text on paper */ text: string;
}

export interface Building {
  id: number;
  name: string;
  emoji: string;
  blurb: string;
  inks: Inks;
  night?: boolean;
  /** escape soundtrack id (M01…) → engine style + mood colour */
  music: string; style: string; mood: string; bpm: number;
  /** concepts this building introduces, in order */
  news: string[];
  /** finale floor concept (B.. boss or A.. set piece) */
  finale: string;
  /** big poster word printed behind the rooms */
  poster: string;
}

const B = (id: number, name: string, emoji: string, blurb: string, inks: [string, string, string, string, string, string], music: string, style: string, mood: string, bpm: number, news: string[], finale: string, poster: string, night = false): Building => ({
  id, name, emoji, blurb, inks: { paper: inks[0], wall: inks[1], shade: inks[2], hot: inks[3], cool: inks[4], text: inks[5] }, music, style, mood, bpm, news, finale, poster, night,
});

export const BUILDINGS: Building[] = [
  B(1, "Toy Factory", "🧸", "Kranky's wind-up factory. Learn to run the walls and leap across.", ["#fff4e6", "#2b1d4e", "#ff5fa2", "#ff3d6e", "#2fb8ff", "#2b1d4e"], "M01", "M01", "toy-playroom", 118,
    ["S01", "S02", "S03", "S04", "S05", "S17", "H01", "H06", "H24", "O01", "O16", "O26", "O28", "A08", "X01", "X02", "X03"], "B01", "TOYS"),
  B(2, "Candy Lab", "🍬", "Sticky honey walls, slippery sugar ice and blinking lasers.", ["#fff1f4", "#3a1f3d", "#ff9e3d", "#ff2f7a", "#14c2b5", "#3a1f3d"], "M02", "M05", "candy-frosting", 124,
    ["S06", "S07", "S08", "S15", "H02", "H07", "H08", "O09", "O06", "A12"], "A09", "SWEET"),
  B(3, "Ice Vault", "🧊", "A frozen bank: conveyor belts, sweeping lasers and the first locked hatch.", ["#eef8ff", "#1f2f5c", "#7aa8ff", "#ff4f8b", "#8f5bff", "#1f2f5c"], "M03", "M03", "ice-floe", 112,
    ["S09", "S14", "H03", "H11", "O02", "O03", "O07", "A10"], "B02", "VAULT"),
  B(4, "Neon Arcade", "🕹️", "Night paper and neon ink: spinning lasers, drones and rhythm rooms.", ["#16112b", "#f4f0ff", "#ff3dd6", "#ffe03d", "#3dfff0", "#f4f0ff"], "M04", "M10", "neon-synth", 122,
    ["S21", "H04", "H05", "H31", "A06", "A14", "A18", "O18"], "B03", "PLAY", true),
  B(5, "Night Museum", "🏛️", "Searchlights, switches and secret walls. Lights out!", ["#f6f0e1", "#1c2340", "#d4a83a", "#ff4d4d", "#2f6bff", "#1c2340"], "M05", "M14", "music-jazz", 108,
    ["H28", "H25", "A01", "A19", "O04", "O20", "O23"], "A20", "ART"),
  B(6, "Space Station", "🚀", "Low gravity, teleport pads and saws orbiting the reactor.", ["#0f1730", "#e8f6ff", "#7b5cff", "#ff5d8f", "#4dffb8", "#e8f6ff"], "M06", "M20", "space-dock", 120,
    ["S12", "S13", "S23", "H16", "O10", "O12"], "B04", "ORBIT", true),
  B(7, "Robot Works", "🤖", "Crushers, pistons and patrol bots on the assembly line.", ["#f2f2f2", "#262b33", "#9aa6b8", "#ff3b30", "#ffb000", "#262b33"], "M07", "M11", "robot-line", 132,
    ["S16", "H09", "H10", "H17", "H34", "O05", "O27"], "B05", "BOLTS"),
  B(8, "Haunted Mansion", "👻", "Glitch blocks, fog and fading walls. Ghost mode helps!", ["#1a1424", "#e9f7e4", "#7d5ba6", "#ff4f6d", "#7dff9a", "#e9f7e4"], "M08", "M18", "haunted-hall", 100,
    ["S18", "H14", "H43", "A02", "A15", "O13"], "B06", "BOO", true),
  B(9, "Jungle Temple", "🗿", "Swinging pendulums, spinning maces and rolling barrels.", ["#f3f7e4", "#2d3a1b", "#8fbf3a", "#ff5a3d", "#2fb8a0", "#2d3a1b"], "M09", "M16", "jungle-temple", 116,
    ["S10", "H15", "H22", "H23", "H33"], "A09", "TEMPLE"),
  B(10, "Underwater Base", "🫧", "Slow bubbly rooms, bubble traps and the rising tide.", ["#e6fbff", "#0e3a4f", "#3dd1ff", "#ff6b5d", "#ffd23d", "#0e3a4f"], "M10", "M19", "reef-deep", 110,
    ["S22", "H36", "H42", "O11", "O19"], "B07", "DEEP"),
  B(11, "Volcano Forge", "🌋", "Flame jets, steam, sparking floors and rising lava.", ["#fff0e6", "#2a1a17", "#ff8a3d", "#ff2b2b", "#ffd23d", "#2a1a17"], "M11", "M04", "volcano-forge", 136,
    ["A07", "A20", "H18", "H19", "H20", "H37"], "B08", "HOT"),
  B(12, "Cloud Palace", "☁️", "Launch pads, lightning and huge upside-down halls.", ["#f4f8ff", "#3b3f8f", "#ffd27a", "#ff4f8b", "#4fb8ff", "#3b3f8f"], "M12", "M13", "cloud-castle", 104,
    ["S24", "S25", "A04", "A16", "H30"], "A22", "SKY"),
  B(13, "Pyramid Tomb", "🏺", "Meteor drops, snapping traps and diamonds in risky corners.", ["#fbf1dc", "#3d2b1a", "#e0a84a", "#ff4d3d", "#20b2aa", "#3d2b1a"], "M13", "M12", "desert-tomb", 126,
    ["S20", "H29", "H41", "A13"], "B09", "TOMB"),
  B(14, "Clock Tower", "🕰️", "Giant clock hands, fan blades and bumpers that turn you round.", ["#fbf3e8", "#3a1e1e", "#c98a3a", "#e8304f", "#3a7bff", "#3a1e1e"], "M14", "M17", "robot-night", 112,
    ["S11", "H35", "H40", "A17"], "B10", "TICK"),
  B(15, "Pirate Ship", "🏴‍☠️", "Twin cannons, ink blasts, a mirror deck and buddies to rescue.", ["#eef4fb", "#132a4a", "#5c86c4", "#ff3d3d", "#ffc53d", "#132a4a"], "M15", "M15", "bubble-lagoon", 118,
    ["H13", "H38", "A03", "A11", "O14", "X04"], "A09", "AHOY"),
  B(16, "Circus Big Top", "🎪", "Paint bombs, bobbing grumpies and score plates.", ["#fff6e6", "#3a1430", "#ffcf3d", "#ff2f4f", "#2fc4ff", "#3a1430"], "M16", "M14", "circus-bigtop", 128,
    ["H26", "H39", "O17", "O21"], "B11", "CIRCUS"),
  B(17, "Library of Echoes", "📚", "Mirror lasers, tesla arcs and silent reading rooms.", ["#fbf6ec", "#3a1d24", "#b85c6e", "#ff3d5a", "#3a8f7b", "#3a1d24"], "M17", "M18", "library-reading", 96,
    ["H21", "O15", "A24", "O29"], "A22", "SHHH"),
  B(18, "Server Core", "💾", "Fast turrets, hack terminals and twin mirrored rooms.", ["#0d1a14", "#d8ffe8", "#2bd46b", "#ff3d6e", "#3dd8ff", "#d8ffe8"], "M18", "M09", "pixel-arcade", 140,
    ["H12", "A21", "O24", "O25"], "B12", "DATA", true),
  B(19, "Film Studio", "🎬", "Swinging lamp rigs, tilted cameras and treasure sets.", ["#fff3f6", "#2a1a3a", "#ffb84d", "#ff2f6f", "#3d8bff", "#2a1a3a"], "M19", "M07", "festival-rangoli", 130,
    ["H45", "A05", "A23", "O22"], "B13", "ACTION"),
  B(20, "Cricket Stadium", "🏏", "Ball machines, one-way hatches and super-over sprints.", ["#f1fbea", "#173a1f", "#4fc46a", "#ff3d3d", "#2f7bff", "#173a1f"], "M20", "M08", "holi-garden", 134,
    ["S19", "H44"], "A22", "SIXER"),
  B(21, "Mega Mall", "🛍️", "Mines, heart capsules and Kranky's self-destruct button.", ["#fff0f7", "#33204a", "#ff8ad8", "#ff2f5f", "#3dd8b0", "#33204a"], "M21", "M06", "rainy-neon", 126,
    ["H27", "O08", "O30"], "B14", "SALE"),
  B(22, "Dino Park", "🦖", "Drone pairs, dino chases and jungle gauntlets.", ["#f6f8e6", "#2f2a12", "#c2b23a", "#ff5a2b", "#3ab8d4", "#2f2a12"], "M22", "M02", "jungle-canopy", 128,
    ["H32"], "A09", "RAWR"),
  B(23, "Star Observatory", "🔭", "Dark domes, spinning lasers and the telescope laser maze.", ["#121633", "#eef0ff", "#5a6bff", "#ff4fb0", "#ffd84d", "#eef0ff"], "M23", "M10", "moon-crater", 116,
    ["A25"], "A22", "STARS", true),
  B(24, "Kranky HQ", "😈", "Everything Kranky has. Escape his HQ — then the buildings start mixing forever.", ["#141014", "#fff1e6", "#ff8a3d", "#ff2f4f", "#b0ff3d", "#fff1e6"], "M24", "M04", "kranky", 138,
    [], "B15", "KRANKY", true),
];

export const buildingOf = (id: number) => BUILDINGS[(((id - 1) % BUILDINGS.length) + BUILDINGS.length) % BUILDINGS.length];
export const JOURNEY_FLOORS = BUILDINGS.length * 10;

/** concepts met on every floor of every building (the feel) */
export const ALWAYS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12"];
