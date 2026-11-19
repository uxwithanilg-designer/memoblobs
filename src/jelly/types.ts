// Momo Jelly Jam — shared shapes. The board is a W × H grid of cells (x right, y up). Gates sit on the frame around
// it (or in the floor). A jelly is a polyomino (cells relative to its origin) of one colour; dragging moves it cell by
// cell through free cells. Same-colour jellies that together make a solid rectangle squish into one block; a block
// whose side exactly matches a gate of its colour slides out. Rules, solver, builder and renderer all share these.
//
// Phase 2–3 add the rest of the 400 concepts as data: special floor tiles (tiles + tval), cell walls / pits / bridges,
// edge rails, doors that open and close on conditions, gate variants, jelly flags and per-stage rules.

/** 0 up (+y) · 1 right (+x) · 2 down (−y) · 3 left (−x) */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [1, 0, -1, 0] as const;

/** floor tiles (one per cell; tval holds the tile's number: colour, group, uses…) */
export const TILE = {
  floor: 0, pad: 1, padBack: 2, belt: 3, arrow: 4,
  flip: 5, ice: 6, mud: 7, tele: 8, paint: 9, rinse: 10, shrink: 11, stretch: 12, split: 13, bumper: 14, spring: 15,
  bubble: 16, thorns: 17, star: 18, coin: 19, key: 20, crumble: 21, glass: 22, counter: 23, switch: 24, plate: 25,
  filterC: 26, filterS: 27, snare: 28, wind: 29, target: 30, wash: 31, splash: 32, charger: 33, glue: 34, nosquish: 35,
  trap: 36, rewind: 37, bouncer: 38, copy: 39, tilt: 40, swap: 41, magnet: 42, lamp: 43, press: 44,
} as const;
export type TileKind = (typeof TILE)[keyof typeof TILE];

/** cell kinds in Level.walls */
export const CELL = { floor: 0, wall: 1, pit: 2, bridge: 3 } as const;

/** jelly colours: candy-gloss tones + a symbol each (colour-blind play). 8+ are special jellies. */
export const COLORS = [
  { name: "Red", hex: "#EE2233", deep: "#B0141F", sym: "★" },
  { name: "Blue", hex: "#2F7BFF", deep: "#1C4FC8", sym: "●" },
  { name: "Yellow", hex: "#FFC21A", deep: "#D99400", sym: "▲" },
  { name: "Green", hex: "#2FCB52", deep: "#16943A", sym: "■" },
  { name: "Pink", hex: "#FF4FB4", deep: "#C82A86", sym: "♥" },
  { name: "Purple", hex: "#8E5BFF", deep: "#5E33CC", sym: "✚" },
  { name: "Orange", hex: "#FF8A2B", deep: "#D2600E", sym: "◆" },
  { name: "Cyan", hex: "#23C8E8", deep: "#0E8FAD", sym: "✿" },
  { name: "Stone", hex: "#9AA0AE", deep: "#646A78", sym: "⬢" },
  { name: "Clear", hex: "#E8F4FF", deep: "#A9BCD0", sym: "○" },
  { name: "Gold", hex: "#FFD54A", deep: "#C8961A", sym: "$" },
  { name: "Navy", hex: "#1F3A93", deep: "#12235C", sym: "◉" },
  { name: "Mint", hex: "#8FF0B0", deep: "#4CC27A", sym: "□" },
  { name: "Rainbow", hex: "#FFFFFF", deep: "#B58CFF", sym: "✦" },
  { name: "Crate", hex: "#C98B4E", deep: "#8E5A2B", sym: "▦" },
] as const;
export const STONE = 8, CLEAR = 9, GOLD = 10, NAVY = 11, MINT = 12, RAINBOW = 13, CRATE = 14;
/** colours a stage can deal as ordinary jelly (the special ones are placed on purpose) */
export const PLAIN_COLOURS = [0, 1, 2, 3, 4, 5, 6, 7];
/** colour mixing (F12 / C08 / M18): two primaries squish into a third */
export const MIX: Record<string, number> = { "0,1": 5, "0,2": 6, "1,2": 3 };
export const mixOf = (a: number, b: number) => MIX[a < b ? `${a},${b}` : `${b},${a}`];

/**
 * A condition (doors, locked gates, locked jellies). Evaluated against the current state.
 * sw: a switch group is on · plate: a jelly sits on a plate of the group · key: a key of that colour (−1 any) was
 * picked up · out: n blocks (of a colour) are out · mv: n moves made · sq: n squishes made · par: moves % m === r ·
 * cov: every target tile was covered · hit: door/jelly hit counter ≥ n · coins: n level coins · rest: only colour c
 * (or nothing) is left · not: the opposite.
 */
export type Cond =
  | { t: "sw"; g: number }
  | { t: "plate"; g: number }
  | { t: "key"; c: number }
  | { t: "out"; n: number; c?: number }
  | { t: "mv"; n: number }
  | { t: "sq"; n: number }
  | { t: "par"; m: number; r: number }
  | { t: "cov" }
  | { t: "hit"; i: number; n: number }
  | { t: "coins"; n: number }
  | { t: "rest"; c: number }
  | { t: "not"; a: Cond };

/** a door: cells that are solid while `solid` holds (or, for a bridge, a pit while it holds) */
export type DoorLook = "wall" | "laser" | "red" | "blue" | "grumpy" | "vine" | "popcorn" | "stone" | "crate" | "tape" | "balloon" | "bridge" | "blink" | "crusher" | "glass" | "domino" | "fuse" | "zap" | "arm" | "shield" | "cage";
export interface Door { cells: number[]; look: DoorLook; solid: Cond; /** hit counter index (O04 / O06 / O33 / J21): a jelly (this big, of this colour) landing next to it counts */ hit?: { i: number; size: number; color?: number } }

/** a gate on the frame (side 0–3) or in the floor (side 4: a w × h hole whose corner cell is `at`) */
export interface Gate {
  side: Dir | 4; at: number; w: number; color: number; count: number; blink?: boolean;
  /** a Mix Gate also takes this colour */ also?: number;
  /** floor gates: depth; frame gates: the block's exact depth (Deep Gate / Exact Size) */ h?: number;
  kind?: "rainbow" | "fake" | "box";
  /** locked until this holds (Locked / Hidden / Guarded / Last / Coin Gate, Two Boards, Build First) */ need?: Cond;
  /** takes only blocks of exactly this many parts (Weight Gate / Number jelly) */ parts?: number;
  /** numbered gates: gate k opens after every gate below k was used */ order?: number;
  /** a queue of colours it takes, in order (Queue Gate) */ queue?: number[];
  /** colour cycle by move (Colour Cycle) */ cycle?: number[];
  /** blink / cycle phase */ phase?: number;
  /** gets one cell narrower after every use (Narrowing Gate) */ narrow?: boolean;
  /** the block must arrive moving this way (Arrow Gate) */ dirIn?: Dir;
  /** a star gate: bonus when used within par */ star?: boolean;
  /** positions it slides through, one per move (Sliding / Hopping / Wheel Gate) */ slide?: number[];
  /** box cells' colours (Picture / Copy Me), −1 any */ cmap?: number[];
  /** any shape with exactly this many cells may leave (Area Gate, with blob squish) */ area?: number;
  /** a jelly that drops in after each block leaves (Spawner / Gumball) */ spawn?: Piece[];
}
/** does this gate take jellies of this colour (at this move)? */
export function takes(g: Gate, color: number, moves = 0) {
  if (g.kind === "fake" || g.kind === "box") return false;
  if (color === CRATE || color === CLEAR) return false;
  if (color === GOLD || color === RAINBOW) return g.color !== STONE;
  const gc = g.cycle ? g.cycle[(moves + (g.phase ?? 0)) % g.cycle.length] : g.color;
  if (gc === RAINBOW || g.kind === "rainbow") return color !== STONE;
  return gc === color || g.also === color;
}

/** what makes a jelly special (all optional; never mutated in place — a changed jelly gets a new object) */
export interface PieceFlags {
  heavy?: boolean; ghost?: boolean; bubble?: boolean; bouncy?: boolean;
  /** rail jelly: moves only along x (0) or y (1) */ axis?: 0 | 1;
  /** arrow jelly: moves only this way */ arrow?: Dir;
  lazy?: boolean; king?: boolean; keeper?: boolean; must?: boolean;
  dirty?: boolean; battery?: boolean; mystery?: boolean; contrary?: boolean;
  once?: boolean; sealed?: boolean; hungry?: boolean; magnet?: boolean; spinner?: boolean; baby?: boolean;
  chameleon?: boolean; shy?: boolean; kranky?: boolean; copycat?: boolean; sticky?: boolean; leader?: boolean;
  /** must be out before this move number (Countdown / Bomb / Fragile) */ timer?: number;
  /** a fresh block must leave before this move or it turns to stone (Setting Jelly) */ setBy?: number;
  /** can't move until this holds (Ice Block, Chain, Cage, Sleepy) */ lock?: Cond;
  /** stuck until this move (Snare / Goo / Honey / Freeze) */ frozen?: number;
  /** stripes: also leaves by gates of this colour */ alt?: number;
  /** twin: moves with this jelly id */ twin?: number;
  /** a block needs exactly this many parts to leave (Number jelly) */ num?: number;
}

/** a jelly: cells are [dx0, dy0, dx1, dy1, …] relative to (x, y), normalised so min dx = min dy = 0 */
export interface Piece { id: number; color: number; c: number[]; x: number; y: number; parts: number; f?: PieceFlags }

/** a turn pad on a cell: turns a jelly dropped on it 90° (cw or ccw), or mirrors it (flip), while uses last */
export interface Pad { cell: number; uses: number; ccw: boolean; flip?: boolean }

/** one move: drop jelly `id` with its origin at (x, y) */
export interface Move { id: number; x: number; y: number }

export type StageKind = "meet" | "use" | "mix" | "breather" | "twist" | "burner" | "star" | "boss" | "fusion";

/** whole-stage rules (all optional) */
export interface StageRules {
  /** F02 blob squish: same colours merge on any touch, only rectangles leave */ blob?: boolean;
  /** F12 / C08 colour mixing */ mix?: boolean;
  /** F05 / F06 squish only over glue tiles */ glue?: boolean;
  /** R02 / R19 move limit */ limit?: number;
  /** R09 / K08 seconds */ time?: number;
  noUndo?: boolean; undoCost?: number;
  /** R05 / C16 / O35 colours must leave in this order (repeats the last colour freely) */ order?: number[];
  /** R04 numbered jellies (block ids) leave in this order */ ids?: number[];
  /** R06 only `must` jellies need to leave · R07 keepers must stay */ some?: boolean; keep?: boolean;
  /** R11 one turn-pad use in the stage · R12 every jelly moved once */ oneTurn?: boolean; oneDrag?: boolean;
  /** R13 / R14 gates stay shut until this many squishes */ buildFirst?: number;
  /** R23 blocks leave within this many moves of each other */ combo?: number;
  /** C20 pairs of colours that may not touch (flat a,b,a,b…) · R22 no colours may touch */ clash?: number[]; noTouch?: boolean;
  /** R28 falls allowed (trap tiles) */ lives?: number;
  /** S22 the tray resets after this many moves without a block leaving */ loop?: number;
  /** S01 / S02 / S07 / S08 everything falls this way after each move */ gravity?: Dir;
  /** S10 / S13 everything drifts one cell this way after each move */ drift?: Dir;
  /** S09 / S14 every dropped jelly slides on */ slide?: boolean;
  /** S04 / S18 wrap: bit 1 = x, bit 2 = y */ wrap?: number;
  /** S21 every move happens twice · S23 a jelly's colour-mates copy its move */ echo?: boolean; crowd?: boolean;
  /** F23 a fresh block turns 90° */ spin?: boolean;
  /** F08 a fresh block can't move on the next move */ slowSet?: boolean;
  /** F04 jellies marked once squish only once */ once?: boolean;
  /** F20 a fresh block must leave within this many moves or it sets to stone */ setTime?: number;
  /** K bosses and stage events */ events?: StageEvent[];
  /** S19 drag left, it goes right (every jelly) */ mirror?: boolean;
  /** J35 / K18 / K12 Kranky's jelly moves after you */ kranky?: boolean;
  /** S24 a jelly resting this many moves sticks */ settle?: number;
  /** pure looks / input twists: they never change what is legal */
  view?: StageView;
}
export interface StageView {
  /** C22 neon, C21 black & white, C11 night glow, C24 tones, C12 mystery */
  mode?: "neon" | "bw" | "night" | "tones";
  /** T34 / O17 / B29 / K13: fogged cells (revealed when a jelly rests next to them) */ fog?: number[];
  /** R20 peek: fog everything after this many seconds · R21 hide gate colours after this many seconds */ peek?: number; remember?: number;
  /** R30 / K10 the tray turns half way round after this move · S05 / S06 every N moves */ twistAt?: number; flipEvery?: number; spinEvery?: number;
  /** S20 moves take a beat */ delay?: boolean;
  /** F03 part counters on blocks */ counters?: boolean;
  /** C10 gold rush: 4+ part blocks shine */ gold?: boolean;
}
/** something that happens on its own at a move (Kranky's tricks) */
export type StageEvent =
  | { at: number; t: "swap"; a: number; b: number }
  | { at: number; t: "paint"; ids: number[]; color: number }
  | { at: number; t: "freeze"; id: number; until: number }
  | { at: number; t: "gates"; moves: [number, number][] }
  | { at: number; t: "drop"; piece: Piece };

/** everything needed to play (and replay) one stage */
export interface Level {
  n: number;
  seed: number;
  W: number;
  H: number;
  /** W × H, CELL kinds: 0 floor, 1 wall, 2 pit, 3 bridge */
  walls: number[];
  /** W × H tile kinds (TILE) */
  tiles: number[];
  /** W × H direction for belts, arrows, wind, tilt */
  tdir: number[];
  /** W × H tile numbers (colour / group / uses), when any tile needs one */
  tval?: number[];
  /** W × H edge rails, bit d = blocked toward direction d */
  rails?: number[];
  doors?: Door[];
  pads: Pad[];
  gates: Gate[];
  pieces: Piece[];
  rules?: StageRules;
  /** concept ids featured in this stage (for the Dex and the stage card) */
  concepts: string[];
  /** the concept this stage introduces (meet stages) */
  meet?: string;
  kind: StageKind;
  world: number;
  /** stage inside its world 1…60 (0 for endless and modes) */
  stage: number;
  name: string;
  fusion?: { name: string; key: string; atoms: string[] };
  par: number;
  solution: Move[];
  difficulty: number;
  /** look variety: tray / table / props variant seeds */
  look: number;
  /** which mode built it (journey when absent) */
  mode?: string;
}

/** what changes while playing */
export interface State {
  pieces: Piece[];
  /** turn-pad uses left */
  pads: number[];
  /** blocks each gate still takes */
  gates: number[];
  moves: number;
  out: number;
  nextId: number;
  /** switch groups that are on (bits) */ sw: number;
  /** keys held (bit per colour, bit 15 = any) */ keys: number;
  /** blocks out per colour */ outC: number[];
  /** squishes so far */ sq: number;
  /** collectibles taken and target tiles covered (cell indices) */ got: number[]; cov: number[];
  /** worn tiles: [cell, count, …] (crumble / glass / counter); broken cells are pits now */ wear: number[];
  /** door / jelly hit counters */ hits: number[];
  /** level coins (T20) and bonus stars (T19, star jelly) */ coins: number; stars: number;
  /** jellies already dragged (R12) */ dragged: number[];
  /** turn-pad uses spent (R11) */ turns: number;
  /** move of the last block out (R23, S22) */ lastOut: number;
  /** falls (R28) */ falls: number;
  /** why the stage is lost (move limit, countdown…) */ lost?: string;
  /** last move's direction (ice, springs, arrow gates) */ dir: number;
  /** the gate slots moved by Kranky (K07), gate index → at */ gat?: number[];
}

/** what happened in a move, for animation and sound */
export type JamEvent =
  | { t: "move"; id: number; x: number; y: number }
  | { t: "turn"; id: number; pad: number; ccw: boolean; piece: Piece; flip?: boolean }
  | { t: "merge"; ids: number[]; piece: Piece }
  | { t: "belt"; id: number; x: number; y: number }
  | { t: "slide"; id: number; x: number; y: number; why: "ice" | "spring" | "bumper" | "fall" | "drift" | "wind" | "tele" | "rewind" | "bounce" | "magnet" | "tilt" | "echo" | "kranky" | "wrap" }
  | { t: "shape"; id: number; piece: Piece; why: "paint" | "rinse" | "shrink" | "stretch" | "split" | "bubble" | "pop" | "wash" | "charge" | "dirty" | "grow" | "spin" | "stone" | "eat" | "press" | "copy" | "swap" | "thaw" | "chameleon" }
  | { t: "spawn"; piece: Piece }
  | { t: "remove"; id: number; why: "split" | "eat" | "fall" | "crack" }
  | { t: "get"; cell: number; what: "star" | "coin" | "key" }
  | { t: "switch"; cell: number; on: boolean }
  | { t: "door"; i: number; solid: boolean }
  | { t: "wear"; cell: number; broken: boolean }
  | { t: "exit"; id: number; gate: number; piece: Piece }
  | { t: "lost"; why: string }
  | { t: "win" };
