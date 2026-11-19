// The 20 Momo Jelly Jam worlds (docs/MOMO_JELLY_JAM_PLAN.md §11 W): each has its own 3D look (tray, table, props),
// its own music (styles cycle stage by stage so every stage sounds different), and the 20 concepts it teaches, in order.
// All 20 worlds teach: 400 concepts over 1,200 journey stages, then the endless Fusion Jam mixes them forever.

export type PropKind = "kitchen" | "candy" | "toys" | "icecream" | "bubbles" | "garden" | "clocks" | "robots" | "pirate" | "space"
  | "haunted" | "volcano" | "music" | "art" | "snow" | "desert" | "neon" | "reef" | "sky" | "fortress";

export interface World {
  id: number;
  name: string;
  emoji: string;
  /** tray frame, tray floor, tray floor alt (checker), inner walls, table top, backdrop top, backdrop bottom */
  look: { frame: string; floor: string; floor2: string; wall: string; table: string; sky: string; ground: string; night?: boolean };
  props: PropKind;
  /** music styles (Sky Roll engine ids) cycled stage by stage, the mood word, base tempo */
  music: { styles: string[]; mood: string; bpm: number };
  /** the 20 concepts this world teaches: its own W concept, 18 mechanics in teaching order, its Kranky boss */
  teach?: string[];
}

const W = (id: number, name: string, emoji: string, look: World["look"], props: PropKind, music: World["music"], teach?: string[]): World =>
  ({ id, name, emoji, look, props, music, teach });

export const WORLDS: World[] = [
  W(1, "Jelly Kitchen", "🍮", { frame: "#3FC9B4", floor: "#DCE3F2", floor2: "#CDD6EA", wall: "#36B7A3", table: "#E9C9A0", sky: "#FFE9D2", ground: "#E7B98A" }, "kitchen",
    { styles: ["M01", "M03", "M18", "M14"], mood: "cozy kitchen", bpm: 96 },
    ["W01", "B01", "P10", "P03", "P01", "F01", "G01", "P02", "C02", "B02", "B05", "P11", "G02", "G03", "T01", "P21", "B11", "P05", "G04", "K16"]),
  W(2, "Candy Factory", "🍬", { frame: "#FF6FAE", floor: "#FFE6F2", floor2: "#FFD5EA", wall: "#E8549A", table: "#BFE7FF", sky: "#FFE1F0", ground: "#C9B6FF" }, "candy",
    { styles: ["M09", "M01", "M20", "M16"], mood: "candy pop", bpm: 104 },
    ["W02", "T06", "P06", "B03", "B04", "C03", "P12", "G07", "T07", "P22", "P23", "T02", "B12", "P09", "G10", "B16", "P13", "B07", "P24", "K14"]),
  W(3, "Toy Workshop", "🧸", { frame: "#FFB23F", floor: "#FFF3DC", floor2: "#FBE6C4", wall: "#E8962A", table: "#B88456", sky: "#FFE7C2", ground: "#C98F5B" }, "toys", { styles: ["M18", "M01", "M17"], mood: "toy party", bpm: 100 },
    ["W03", "H01", "C01", "P07", "M05", "R01", "B06", "P08", "O04", "P16", "B08", "M04", "C07", "P17", "G09", "B10", "P28", "O05", "P25", "K02"]),
  W(4, "Ice-Cream Parlour", "🍨", { frame: "#7FD3FF", floor: "#F2FAFF", floor2: "#E2F2FF", wall: "#5FB8F0", table: "#FFD9E8", sky: "#EAF7FF", ground: "#FFC6DA" }, "icecream", { styles: ["M03", "M14", "M18"], mood: "snow sparkle", bpm: 92 },
    ["W04", "H02", "T04", "O01", "P04", "T03", "B09", "J34", "R03", "G27", "F15", "T16", "J05", "P15", "B20", "F13", "J18", "T17", "S09", "K04"]),
  W(5, "Bubble Bath", "🛁", { frame: "#5ED8E8", floor: "#E9FBFF", floor2: "#D6F4FB", wall: "#3CBFD2", table: "#FFFFFF", sky: "#DFF8FF", ground: "#A9E6F2" }, "bubbles", { styles: ["M03", "M16", "M01"], mood: "calm dream", bpm: 94 },
    ["W05", "B18", "J03", "T18", "O08", "F21", "T12", "T37", "O19", "G11", "J01", "F05", "F07", "C15", "T22", "T23", "H03", "F06", "S08", "K03"]),
  W(6, "Greenhouse", "🌱", { frame: "#6CCB5F", floor: "#EFFAE6", floor2: "#E0F2D3", wall: "#4FB044", table: "#9C7650", sky: "#E7F8DC", ground: "#86B86A" }, "garden", { styles: ["M16", "M08", "M14"], mood: "meadow morning", bpm: 98 },
    ["W06", "F09", "T19", "R08", "T13", "T14", "O12", "P14", "F27", "J22", "B25", "T15", "F10", "J32", "O23", "F29", "J15", "T30", "H04", "K05"]),
  W(7, "Clock Shop", "🕰️", { frame: "#C9A06B", floor: "#FBF3E6", floor2: "#F0E4CE", wall: "#A87F4E", table: "#6E4B32", sky: "#F5E8D2", ground: "#8F6A48" }, "clocks", { styles: ["M14", "M18", "M13"], mood: "twilight", bpm: 100 },
    ["W07", "R02", "B23", "G08", "J08", "M02", "J16", "R19", "F20", "G15", "M12", "F08", "J31", "G16", "R09", "S20", "T24", "S22", "H06", "K08"]),
  W(8, "Robot Lab", "🤖", { frame: "#8C9BB5", floor: "#EEF2F8", floor2: "#DEE5EF", wall: "#6E7E9A", table: "#3B4458", sky: "#DDE5F2", ground: "#59647C" }, "robots", { styles: ["M10", "M09", "M20"], mood: "neon", bpm: 108 },
    ["W08", "T09", "T10", "O16", "J26", "J25", "O14", "G17", "T38", "M24", "F19", "O28", "M16", "M07", "M11", "M26", "J30", "M30", "H10", "K12"]),
  W(9, "Pirate Galley", "🏴‍☠️", { frame: "#B5763F", floor: "#F6EBD9", floor2: "#EBDCC2", wall: "#8E5A2E", table: "#5A8FB8", sky: "#D6ECF7", ground: "#3E7DA8" }, "pirate", { styles: ["M17", "M13", "M15"], mood: "beach", bpm: 102 },
    ["W09", "T21", "G06", "O02", "T20", "R26", "O27", "R04", "G18", "O20", "R05", "O35", "G32", "O07", "M23", "S11", "G35", "S03", "H11", "K15"]),
  W(10, "Space Pantry", "🚀", { frame: "#6B5BD6", floor: "#E8E6FB", floor2: "#D9D5F5", wall: "#5546BC", table: "#1E1A44", sky: "#14123A", ground: "#2E2766", night: true }, "space", { styles: ["M10", "M03", "M19"], mood: "star night", bpm: 98 },
    ["W10", "T08", "B17", "S04", "B28", "S01", "G24", "S02", "R24", "S15", "S10", "M13", "S18", "G25", "S05", "S06", "S13", "S14", "S25", "K19"]),
  W(11, "Haunted Pantry", "👻", { frame: "#7E6BAE", floor: "#E9E3F5", floor2: "#DBD2EE", wall: "#5E4E8E", table: "#2B2340", sky: "#1D1630", ground: "#3A2E55", night: true }, "haunted", { styles: ["M03", "M18", "M12"], mood: "ghost night", bpm: 90 },
    ["W11", "J12", "G23", "T34", "T35", "O10", "B21", "C12", "J13", "G29", "O17", "B29", "O29", "T40", "R20", "O30", "C11", "R21", "H07", "K06"]),
  W(12, "Volcano Bakery", "🌋", { frame: "#FF7A3D", floor: "#FFEBDD", floor2: "#FFDCC6", wall: "#D9572A", table: "#4A2A22", sky: "#FFD2B8", ground: "#8A3A24" }, "volcano", { styles: ["M13", "M04", "M02"], mood: "volcano", bpm: 110 },
    ["W12", "M25", "T39", "O06", "T27", "O09", "T26", "O22", "F04", "O25", "O33", "F11", "M20", "O32", "J17", "M01", "R28", "F28", "H12", "K11"]),
  W(13, "Music Box", "🎵", { frame: "#E07BD8", floor: "#FBEAF8", floor2: "#F4D9F1", wall: "#C05BB8", table: "#F7E1C8", sky: "#FCE3F6", ground: "#D9A8E8" }, "music", { styles: ["M18", "M14", "M06"], mood: "dream", bpm: 100 },
    ["W13", "J10", "S19", "R30", "G19", "J24", "M03", "G13", "R23", "R14", "F23", "J11", "G14", "M27", "J33", "G28", "S23", "M28", "B30", "K10"]),
  W(14, "Art Studio", "🎨", { frame: "#FF9F43", floor: "#FFFFFF", floor2: "#F3F3F3", wall: "#E58322", table: "#E7D9C4", sky: "#FFF6E8", ground: "#E8C9A2" }, "art", { styles: ["M01", "M05", "M16"], mood: "rainbow", bpm: 104 },
    ["W14", "C04", "T11", "C18", "C06", "F12", "C08", "M18", "C10", "C24", "J19", "C13", "C05", "J07", "C17", "F22", "C14", "C19", "H08", "K01"]),
  W(15, "Snow Lodge", "⛄", { frame: "#9CC8F0", floor: "#F7FBFF", floor2: "#E8F2FC", wall: "#7FAEDB", table: "#A97B57", sky: "#EAF4FF", ground: "#D7E6F5" }, "snow", { styles: ["M18", "M03", "M13"], mood: "snow calm", bpm: 92 },
    ["W15", "B13", "J04", "O21", "B27", "P18", "F14", "B14", "B15", "P29", "O15", "P19", "B22", "C25", "P20", "P30", "M29", "B24", "O24", "K09"]),
  W(16, "Desert Market", "🐫", { frame: "#E3B55B", floor: "#FFF5E0", floor2: "#F8E8C6", wall: "#C7953B", table: "#C9894F", sky: "#FFE7BF", ground: "#E0A85F" }, "desert", { styles: ["M08", "M07", "M16"], mood: "sun fest", bpm: 104 },
    ["W16", "T05", "F03", "G33", "J14", "T31", "M06", "T32", "G22", "T33", "J27", "G26", "J29", "G31", "R06", "R12", "T25", "G21", "R07", "K17"]),
  W(17, "Neon Arcade", "🕹️", { frame: "#FF3DD4", floor: "#2A1F4A", floor2: "#241A40", wall: "#C42BB0", table: "#0E0A1E", sky: "#120C26", ground: "#24164A", night: true }, "neon", { styles: ["M10", "M05", "M09"], mood: "neon party", bpm: 112 },
    ["W17", "C22", "O26", "F02", "F25", "F24", "M19", "J20", "F17", "F18", "T28", "M10", "F16", "M15", "M14", "J28", "C21", "R10", "F26", "K18"]),
  W(18, "Jelly Reef", "🐠", { frame: "#2EC4B6", floor: "#E2FAF6", floor2: "#CFF2EC", wall: "#1E9C91", table: "#1D6E9E", sky: "#BDEBF7", ground: "#167C9E" }, "reef", { styles: ["M03", "M16", "M15"], mood: "calm beach", bpm: 96 },
    ["W18", "G30", "G05", "B26", "J02", "G12", "R18", "R16", "M21", "S16", "P26", "P27", "O34", "R22", "C20", "R15", "R17", "J09", "G20", "K07"]),
  W(19, "Sky Bakery", "☁️", { frame: "#FFC1D9", floor: "#FFFFFF", floor2: "#F4F7FF", wall: "#F59EC0", table: "#BFE3FF", sky: "#D8EEFF", ground: "#FFFFFF" }, "sky", { styles: ["M18", "M01", "M14"], mood: "cloud morning", bpm: 98 },
    ["W19", "B19", "S17", "M08", "O03", "O11", "O13", "T29", "M09", "S07", "O18", "J06", "M17", "G34", "F30", "J23", "R13", "R25", "R29", "K13"]),
  W(20, "Kranky's Jelly Fortress", "😈", { frame: "#E8504F", floor: "#F5E6E6", floor2: "#EBD5D5", wall: "#B53332", table: "#2A1E24", sky: "#3A1E28", ground: "#4A2430", night: true }, "fortress", { styles: ["M13", "M04", "M19"], mood: "kranky boss", bpm: 112 },
    ["W20", "H05", "H09", "T36", "J21", "R11", "C16", "M22", "O31", "C23", "S24", "R27", "C09", "S12", "H13", "S21", "H14", "J35", "H15", "K20"]),
];

export const worldOf = (id: number) => WORLDS[Math.max(0, Math.min(WORLDS.length - 1, id - 1))];
export const STAGES_PER_WORLD = 60;
/** worlds whose teaching order is built — the journey continues with the Fusion Jam after them */
export const TAUGHT_WORLDS = WORLDS.filter((w) => w.teach).length;
export const JOURNEY_STAGES = TAUGHT_WORLDS * STAGES_PER_WORLD;
