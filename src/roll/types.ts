// Shared data shapes for Momo Sky Roll. Track space: `s` = rows forward (one tile = 1), `x` = lanes (0 = centre),
// `y` = height above the tile tops. The renderer maps s → world −z.

/** a mood id from data/worlds.ts (World 1 keeps its short ids: "meadow", "sunflower", …) */
export type MoodId = string;
/** music style id "M01" … "M20" (docs/SKY_ROLL_PLAN.md §4 M) */
export type StyleId = string;

/** tile kinds — every special floor concept is one of these */
export const TK = {
  grass: 0, boost: 1, pad: 2, crumble: 3, check: 4, finish: 5, start: 6,
  mega: 7, mud: 8, ice: 9, sticky: 10, bouncy: 11, glass: 12, blink: 13, ghost: 14,
  color: 15, paint: 16, mirror: 17, teleport: 18, gravity: 19, shrink: 20, grow: 21,
  magnet: 22, push: 23, plate: 24, bridge: 25, piano: 26, gold: 27, updraft: 28, seesaw: 29,
} as const;
export type TileKind = (typeof TK)[keyof typeof TK];

/** moving tile: ax 0 = slides sideways (islands), 1 = rises/sinks (elevators) */
export interface Motion { ax: 0 | 1; amp: number; period: number; phase: number }

export interface Tile {
  x: number;
  k: TileKind;
  /** crumble: the beat the tile drops · blink: unused */
  drop?: number;
  /** colour index (colour + paint tiles) 0..2 */
  c?: number;
  /** push arrows: −1 / +1 */
  dir?: number;
  /** teleport: lanes to jump */
  to?: number;
  mv?: Motion;
  /** pressure plate ↔ bridge group */
  g?: number;
  /** piano key note (scale step) */
  note?: number;
  /** blink: which beat parity the tile is solid on */
  par?: number;
}

export interface Row {
  tiles: Tile[];
  zone: number;
  /** rows travelled per beat while the ball is on this row (boosts raise it) */
  rpb: number;
  /** floor height of the row (stairs, waves) */
  h: number;
}

/**
 * Hazard archetypes. Every hazard concept (H01–H40) is one archetype + a visual skin + parameters:
 *  mallet  = pendulum swinging across the lanes      daisy  = flat spinner with 1–4 arms
 *  claw    = drops from the sky onto lanes           slider = block moving across lanes (swing / saw / hop / static)
 *  roller  = rolls down a lane towards Momo          popper = pops up out of the floor on a cycle
 *  laser   = beam / doors across lanes, on/off on the beat
 */
export type HazardKind = "mallet" | "daisy" | "claw" | "slider" | "roller" | "popper" | "laser";

export interface Hazard {
  id: number;
  kind: HazardKind;
  /** row of the hazard's centre (roller: the row where it meets Momo) */
  s: number;
  /** lane of the pivot / centre */
  x: number;
  /** mallet: half-swing (lanes) · daisy: arm length · claw: half-width · slider: travel half-range · laser: half-width */
  size: number;
  /** beats per full cycle */
  period: number;
  /** cycle phase offset in [0, 1) */
  phase: number;
  /** daisy: spin direction · slider/roller: direction */
  dir: number;
  /** claw: the beat it hits the ground (one-shot) — when unset the claw slams every `period` beats */
  slam?: number;
  /** visual skin (art/skins.ts) */
  skin: string;
  /** daisy arms 1–4 */
  arms?: number;
  /** obstacle width in lanes (slider / popper / laser) */
  w?: number;
  /** slider motion */
  mode?: "swing" | "saw" | "hop" | "static";
  /** roller: rows per beat it rolls towards Momo */
  speed?: number;
  /** popper / laser: fraction of the cycle it is dangerous */
  duty?: number;
}

export type PickupKind = "bead" | "sprout" | "power" | "letter" | "key" | "note" | "baby" | "box" | "statue" | "life" | "booster";

export interface Pickup {
  id: number;
  kind: PickupKind;
  s: number;
  x: number;
  y: number;
  /** power: ability id (A01 …) · letter: the letter */
  ab?: string;
}

export interface Jump {
  /** the pad row */
  s0: number;
  /** the landing row */
  s1: number;
  /** arc height */
  h: number;
}

/** a sideways push over a stretch of rows (wind, conveyors, magnets, tilting boards, tractor beams, water jets) */
export interface Force {
  s0: number;
  s1: number;
  /** lanes/s² sideways; with `period` it swings ±ax on the beat */
  ax: number;
  period?: number;
  phase?: number;
  /** magnets pull towards this lane instead */
  to?: number;
  kind: "wind" | "conveyor" | "magnet" | "tilt" | "beam" | "water";
}

export type CamMode = "chase" | "top" | "side" | "reverse" | "dutch" | "wide" | "low" | "quarter" | "upside" | "mirror" | "flyby" | "spin";

export interface ZoneRules {
  lightsOut?: boolean;
  fog?: boolean;
  memory?: boolean;
  mirror?: boolean;
  tiny?: boolean;
  giant?: boolean;
  gold?: boolean;
  silence?: boolean;
  beatSteps?: boolean;
  ghostLine?: boolean;
  chase?: string;
  noEdges?: boolean;
  beadRain?: boolean;
}

export type SectionKind = "intro" | "verse" | "build" | "chorus" | "drop" | "break" | "finale";

export interface Zone {
  from: number;
  to: number;
  mood: MoodId;
  name: string;
  section: SectionKind;
  /** 0 calm … 3 full */
  intensity: number;
  beat0: number;
  beats: number;
  style: StyleId;
  cam: CamMode;
  rules: ZoneRules;
  /** boss set piece (B01 …) */
  boss?: string;
  /** the concept this zone is about (shown in the Dex) */
  concept?: string;
}

export interface Tip { s: number; id: string; title: string; text: string }

export interface SongZone { beat0: number; beats: number; mood: MoodId; section: SectionKind; intensity: number; style: StyleId; silence?: boolean }
export interface SongPlan {
  bpm: number;
  /** MIDI note of the key's root */
  root: number;
  seed: number;
  zones: SongZone[];
  /** total beats including the outro */
  beats: number;
}

export type LevelKind = "journey" | "fusion" | "daily" | "endless" | "lab" | "rush" | "title" | "run";

export interface Level {
  id: number;
  kind: LevelKind;
  world: number;
  name: string;
  seed: number;
  bpm: number;
  rows: Row[];
  /** the finish row */
  finish: number;
  zones: Zone[];
  /** rows the ball restarts from (zone starts); index 0 = the level start */
  checkpoints: number[];
  hazards: Hazard[];
  pickups: Pickup[];
  jumps: Jump[];
  forces: Force[];
  /** half-pipe stretches: soft walls keep the ball on the path */
  walls: { s0: number; s1: number }[];
  /** beat at which the ball centre reaches row s (length rows + 1) */
  bRow: Float64Array;
  /** the par line (lane per row) the autopilot follows and beads are laid on */
  line: Float32Array;
  tips: Tip[];
  chase: boolean;
  song: SongPlan;
  /** concepts this level introduces (ids from docs/SKY_ROLL_PLAN.md) */
  news: string[];
  /** every concept used in the level (for the Concept Dex) */
  concepts: string[];
  /** fusion levels: the generated name, e.g. "Frosty Laser Waltz" */
  fusion?: { name: string; atoms: string[]; key: string };
  /** no checkpoints (One Life, Endless) */
  oneLife?: boolean;
}

export type SimEvent =
  | { t: "start" }
  | { t: "land"; v: number }
  | { t: "pad"; s: number; mega: boolean }
  | { t: "boost"; s: number }
  | { t: "bead"; id: number; x: number; s: number; y: number; n: number; fever: boolean }
  | { t: "sprout"; id: number; x: number; s: number; y: number; n: number }
  | { t: "pickup"; id: number; kind: Exclude<PickupKind, "bead" | "sprout">; ab?: string; x: number; s: number; y: number }
  | { t: "ability"; ab: string; on: boolean }
  | { t: "tile"; k: TileKind; x: number; s: number; note?: number }
  | { t: "crumble"; x: number; s: number }
  | { t: "hit"; kind: HazardKind; x: number; s: number; shield: boolean; skin?: string }
  | { t: "life"; lives: number; delta: number }
  | { t: "revive"; on: boolean }
  | { t: "fall" }
  | { t: "dead" }
  | { t: "respawn"; cp: number }
  | { t: "checkpoint"; cp: number; s: number }
  | { t: "zone"; zone: number }
  | { t: "tip"; tip: Tip }
  | { t: "fever"; on: boolean }
  | { t: "jump" }
  | { t: "finish" };
