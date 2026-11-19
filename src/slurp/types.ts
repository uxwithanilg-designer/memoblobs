// Slurp Lab: shared types. The board is a grid (x → right, y → down, row 0 at the top). Every cell has a tile, may
// hold one Gloopy (a coloured jelly blob, or a rainbow one) and may be covered by one Slurper (a glowing glass
// polyomino with a colour and a "need": how many Gloopies it still drinks) or one crate.

/** tile codes */
export const T = {
  FLOOR: 0, WALL: 1, VOID: 2,
  /** a colour gate: GATE + colour */
  GATE: 10,
  ICE: 20, GOO: 21,
  /** one-way: ARROW + direction (0 up, 1 right, 2 down, 3 left) */
  ARROW: 22,
  PORTAL: 26, TURN: 27,
  /** conveyor: BELT + direction */
  BELT: 30,
  /** cracked glass: only a big Slurper (4+ cells) or a bomb breaks it */
  GLASS: 34,
  /** switch walls: A is solid until the switch is pressed, B after */
  SWA: 35, SWB: 36, SWITCH: 37,
  /** a paint pad: PAINT + colour */
  PAINT: 40,
  /** a glass bridge: it falls away once a Slurper has left it */
  CRUMBLE: 48,
} as const;
export const isGate = (t: number) => t >= T.GATE && t < T.GATE + 8;
export const isArrow = (t: number) => t >= T.ARROW && t < T.ARROW + 4;
export const isBelt = (t: number) => t >= T.BELT && t < T.BELT + 4;
export const isPaint = (t: number) => t >= T.PAINT && t < T.PAINT + 8;
/** a rainbow Gloopy: any Slurper may drink it */
export const RAINBOW = 8;
/** Gloopy flags */
export const BF = { BUBBLE: 1, DOUBLE: 2, FROST: 4, FUSE: 8, BOMB: 16 } as const;

/** up, right, down, left */
export const DIRS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export interface SlurperFlags {
  /** locked until every Gloopy of this colour is gone */
  lock?: number;
  /** moves together with this Slurper (same direction) */
  link?: number;
  /** moves together with this Slurper (opposite direction) */
  mirror?: number;
  /** asleep until a Gloopy next to it is slurped */
  sleep?: boolean;
  /** after each step it also drinks its colour from the cells around it */
  hungry?: boolean;
}

/** a Slurper as a stage defines it */
export interface SlurperDef extends SlurperFlags {
  /** its cells relative to (x, y) — already rotated */
  cells: [number, number][];
  /** the shape's name in shapes.ts (for the look) */
  shape: string;
  color: number;
  need: number;
  x: number; y: number;
}

/** one drag in a solution: Slurper i takes these steps ("U", "R", "D", "L") */
export interface Drag { i: number; dirs: string }

export interface StageMetrics {
  /** fewest drags the solver found (or the planted solution if shorter) */
  par: number;
  /** drags of the planted solution */
  planted: number;
  /** steps in the planted solution */
  events: number;
  /** longest "X must clear before Y" chain */
  depth: number;
  /** share of greedy random playouts that got stuck (0..1) */
  trap: number;
  /** same-colour Slurper pairs (choosing who eats what) */
  twins: number;
  /** the stage's difficulty score */
  score: number;
}

export interface Stage {
  n: number;
  /** lab (world) and the stage in it 1..20 (0 for daily / endless) */
  lab: number; s: number;
  name: string;
  w: number; h: number;
  /** w*h tile codes */
  tiles: number[];
  /** w*h Gloopy colours (-1 = none, 8 = rainbow) */
  blobs: number[];
  /** w*h Gloopy flags (BF) */
  bflags: number[];
  /** cell → the drag by which a fuse Gloopy must be slurped */
  fuse: Record<number, number>;
  /** blocked edges: cell*4 + direction (both sides are listed) */
  fences: number[];
  /** portal pairs (cells) */
  portals: [number, number][];
  /** cells with a crate */
  crates: number[];
  slurpers: SlurperDef[];
  colors: number;
  /** the planted solution (for hints on an untouched board and for the bot) */
  solution: Drag[];
  m: StageMetrics;
  /** a short line from Prof. Hoot on the stage card */
  tip?: string;
  /** "big" (stage 10), "exam" (stage 20), "breather" (5 and 15) */
  kind?: "big" | "exam" | "breather";
  /** the mechanics used (for the card, the album, the look) */
  mech?: string[];
}

/** the live board */
export interface SlurperState { x: number; y: number; need: number; alive: boolean; color: number; cells: [number, number][]; awake: boolean }
export interface State {
  blobs: Int8Array; cnt: Int8Array; bub: Uint8Array;
  /** the tiles as they are now (glass breaks, bridges fall) */
  tiles: Uint8Array;
  crates: Uint8Array;
  /** the switch walls' state (0 = A solid, 1 = B solid) */
  sw: number;
  sl: SlurperState[];
  moves: number;
}

export type FxEvent =
  | { t: "pop"; cell: number } | { t: "break"; cell: number } | { t: "crumble"; cell: number }
  | { t: "switch"; on: number } | { t: "paint"; i: number; color: number } | { t: "turn"; i: number }
  | { t: "crate"; from: number; to: number } | { t: "portal"; i: number; from: number; to: number }
  | { t: "unlock"; i: number } | { t: "wake"; i: number } | { t: "bomb"; cell: number };

export type SlurpEvent =
  | { t: "pick"; i: number }
  | { t: "step"; i: number; x: number; y: number; kind?: "slide" | "belt" | "portal" }
  | { t: "blocked"; i: number }
  | { t: "slurp"; i: number; cells: number[]; color: number; need: number }
  | { t: "seal"; i: number; x: number; y: number; color: number }
  | { t: "fx"; e: FxEvent }
  | { t: "drop"; i: number; moved: boolean }
  | { t: "win" }
  | { t: "stuck" }
  | { t: "burnt" }
  | { t: "undo" }
  | { t: "restart" };

/** what the HUD shows */
export interface Hud {
  /** Gloopies left per colour (only colours on this stage; 8 = rainbow) */
  left: { color: number; n: number }[];
  moves: number; par: number;
  stuck: boolean; won: boolean;
  canUndo: boolean;
  /** the nearest fuse: drags left before it burns */
  fuse?: number;
}

/** the 8 candy colours and their colour-blind symbols (index 8 = rainbow) */
export const COLORS: { name: string; hex: string; glow: string; symbol: string }[] = [
  { name: "Strawberry", hex: "#FF3B5C", glow: "#FF8FA3", symbol: "heart" },
  { name: "Lemon", hex: "#FFC300", glow: "#FFE066", symbol: "star" },
  { name: "Aqua", hex: "#16B8F3", glow: "#7FDBFF", symbol: "drop" },
  { name: "Lime", hex: "#4CD137", glow: "#A3F58F", symbol: "leaf" },
  { name: "Grape", hex: "#8C4DF0", glow: "#C3A3FF", symbol: "moon" },
  { name: "Tangerine", hex: "#FF7A1A", glow: "#FFB27A", symbol: "triangle" },
  { name: "Cobalt", hex: "#2F4DFF", glow: "#8C9CFF", symbol: "square" },
  { name: "Bubblegum", hex: "#FF4FC1", glow: "#FFA6E3", symbol: "circle" },
  { name: "Rainbow", hex: "#FFFFFF", glow: "#FFFFFF", symbol: "star" },
];
