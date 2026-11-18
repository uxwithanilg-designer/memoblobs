// Momo Dash! shared types: the stage spec (made by levels.ts), the track entities, sim events and the result.
export type WorldId = "pier" | "candy" | "jungle" | "snow" | "toy" | "spooky" | "canyon" | "neon" | "lava" | "sky" | "space" | "castle";
export type FriendId = "zib" | "pip" | "bolt" | "gloop" | "bonbon" | "hoot" | "turbo" | "noodle" | "tiki" | "kranky";
export type StageType = "dash" | "coins" | "melody" | "tricks" | "letters" | "rescue" | "nostumble" | "chase" | "boss";
export type PowerId = "magnet" | "shield" | "double" | "sky";
export type MorphId = "ball" | "split" | "stretch" | "giant";
export type ObKind =
  | "fence" | "bar" | "block" | "cart" | "tram" | "ramp" | "grumpy"
  | "gap" | "roller" | "ice" | "belt" | "ghost" | "rail" | "geyser" | "gust" | "zoom";
export type TrickKind = "jumpOver" | "closeCall" | "squish" | "cartHop" | "bonk" | "rooftop" | "railGrind" | "smash";
export type TimeOfDay = "day" | "morning" | "sunset" | "night" | "aurora";
export type Weather = "none" | "snow" | "rain" | "fireflies" | "leaves" | "embers" | "stars" | "bubbles" | "sprinkles";
export type Twist = "speed" | "night" | "lowgrav" | "fog" | "coinrain";

/** something on the track that Momo must avoid (or run over: ramps, roofs, rails) — or a zone that does something */
export interface Ob {
  id: number; kind: ObKind; lane: number;
  /** near edge (for karts: where Momo meets it) and length along the track, metres */
  z: number; len: number;
  /** karts drive toward Momo (k > 0) or away, slower than Momo (k < 0): near edge is z + k·(z − momoZ) */
  k: number;
  /** a tram made of n rows (for the renderer) */
  rows?: number;
  /** belts and gusts push this way (−1 left, +1 right) */
  dir?: number;
  /** ghost blocks and geysers: timing offset (seconds) */
  ph?: number;
  /** portal branch this belongs to (portal id · 2 + side) */
  br?: number;
  hit?: boolean; smashed?: boolean; passed?: boolean; over?: boolean; honked?: boolean; used?: boolean;
}
export type ItemKind = "coin" | "power" | "friend" | "letter" | "cage" | "pad" | "morph" | "portal" | "star" | "boost";
export interface Item {
  id: number; kind: ItemKind; lane: number; z: number; y: number;
  /** coin melody: the coin line and its place in the line */
  line?: number; idx?: number;
  power?: PowerId; friend?: FriendId; letter?: string; morph?: MorphId;
  /** boosters: ×3 or the golden ×5 */
  boost?: number;
  /** portals: which portal, which side (0 = Coin Lane on the left, 1 = Star Lane on the right) */
  port?: number; side?: number;
  br?: number;
  got?: boolean; t?: number;
}
/** one run: Subway-style — every run starts at the beginning and the stages keep coming until Momo is caught */
export interface RunSpec {
  seed: number;
  /** the stage the run starts at (1 for a normal run; the Daily Dash starts somewhere in the Remix Loop) */
  start: number;
  daily?: string; demo?: boolean;
  /** quiet helper: a kinder run after a few short ones in a row */
  help?: boolean;
  /** chunk ids seen lately (freshness memory across runs) */
  recent?: string[];
}
/** what one stage of the run looks like (stages are STAGE_M metres; 20 make a world) */
export interface Section {
  n: number; s: number; w: number; world: WorldId; scene: WorldId; remix: boolean; place: string; emoji: string;
  d: number; tod: TimeOfDay; weather: Weather; twist?: Twist; grav: number; jump: number; tune: number[]; music: string;
  allow: string; chase: boolean; villain: string;
}

export type SimEvent =
  | { t: "lane"; dir: number }
  | { t: "jump"; big?: boolean }
  | { t: "land"; v: number }
  | { t: "squish" } | { t: "slam" }
  | { t: "coin"; id: number; line?: number; idx?: number; pull?: boolean }
  | { t: "melody"; line: number; n: number }
  | { t: "power"; id: PowerId } | { t: "powerEnd"; id: PowerId }
  | { t: "friendJoin"; id: FriendId } | { t: "friendSave"; id: FriendId }
  | { t: "fever"; on: boolean }
  | { t: "trick"; kind: TrickKind; pts: number; combo: number }
  | { t: "stumble"; side: number } | { t: "crash"; by: ObKind | "caught" | "fall" } | { t: "shieldPop" }
  | { t: "letter"; ch: string; n: number }
  | { t: "free"; id: FriendId; n: number }
  | { t: "pad"; n: number } | { t: "caught" }
  | { t: "honk"; lane: number } | { t: "roof" }
  | { t: "morph"; id: MorphId; on: boolean } | { t: "miniPop"; lane: number }
  | { t: "portal"; side: number } | { t: "zoneEnd" } | { t: "star"; n: number }
  | { t: "gust"; dir: number } | { t: "zoom" } | { t: "belt"; dir: number }
  | { t: "board"; on: boolean }
  | { t: "cake" } | { t: "snip" } | { t: "smash"; kind: ObKind }
  | { t: "world"; n: number }
  | { t: "boost"; x: number; on: boolean }
  | { t: "chase"; on: boolean } | { t: "momo" }
  | { t: "end"; won: boolean };

export interface RunStats {
  coins: number; tricks: number; melodies: number; friends: number; stumbles: number; crashes: number; bestCombo: number; jumps: number;
  jumpOvers: number; bonks: number; powers: number; roofs: number; morphs: number; portals: number; starPieces: number; freed: number; smashes: number;
}
export interface SimResult extends RunStats {
  score: number; distance: number; time: number; caught: number; boosts: number; worlds: number; bestWorld: number;
}
