// Kiko's Jungle Quest — shared types: the run spec, the stage card (made by levels.ts), the track entities, sim events
// and the run result. One continuous run, Subway style: every run starts at Kiko's Treehouse in Banana Grove.
export type RegionId =
  | "grove" | "river" | "bamboo" | "falls" | "mushroom" | "marsh" | "canopy" | "night"
  | "blossom" | "caves" | "autumn" | "plains" | "mangrove" | "snow" | "volcano";
export type FruitId = "mango" | "pineapple" | "berries" | "melon" | "kiwi" | "dragon";
export type PowerId = "magnet" | "helmet" | "double" | "glide";
/** each region's guardian animal gives Kiko a ride */
export type RideId = "turtle" | "panda" | "frog" | "boat" | "squirrel" | "elephant" | "pelican" | "sled" | "dino";
/** a stage's big moment */
export type SetPiece =
  | "none" | "vines" | "highroad" | "bounce" | "stream" | "lily" | "bridge" | "raft" | "peels" | "coconuts" | "rollers" | "logs"
  | "zipline" | "slide" | "collapse" | "stones" | "ride" | "chaser" | "geysers" | "webs" | "mud" | "gusts" | "ice" | "kite" | "pits";
export type ObKind =
  | "log" | "thorn" | "shroom" | "low" | "rock" | "roller" | "coco" | "peel" | "gap" | "bounce"
  | "ramp" | "branch" | "snake" | "hive"
  | "lily" | "bridge" | "croc" | "flog"
  | "web" | "mud" | "geyser" | "gust" | "ice";
export type TrickKind = "jumpOver" | "closeCall" | "slide" | "vine" | "bounce" | "highroad" | "crocHop" | "peelHop" | "wheee" | "smash" | "salad" | "zip" | "dodge";
export type TimeOfDay = "morning" | "day" | "sunset" | "night" | "cave";
export type Weather = "none" | "leaves" | "rain" | "fireflies" | "butterflies" | "mist" | "snow" | "wind" | "petals" | "ash" | "dust" | "storm" | "fruitrain";
/** the Wild Forest: a season for each blended region and an odd twist now and then */
export type Season = "spring" | "monsoon" | "autumn" | "winter";
export type Twist = "night" | "fog" | "turbo" | "fruitRain" | "goldRush";

/** something on the track: hazards to avoid, things to run on (branches, lily pads, bridges, ramps), bouncy mushrooms */
export interface Ob {
  id: number; kind: ObKind; lane: number;
  /** near edge and length along the track, metres */
  z: number; len: number;
  /** base height (0 = forest floor, BR_H = the branch road) */
  y: number;
  /** rolling coconuts and crocs come toward Kiko: near edge is z + k·(z − kikoZ) */
  k: number;
  /** skin variant for the renderer (1 = in the river) */
  v?: number;
  /** gusts push this way (−1 left, +1 right) */
  dir?: number;
  /** geysers: timing offset (seconds) */
  ph?: number;
  /** thrown by a boss (the renderer shows it flying in) */
  thrown?: boolean;
  hit?: boolean; smashed?: boolean; passed?: boolean; over?: boolean; used?: boolean;
}
/** a stretch where the ground is gone in every lane: a chasm (vines, mushrooms, bridges), a river (lily pads, bridges, a
 *  raft) or lava (stepping stones); slides are rides down water, mud or snow; a chaser rolls along behind Kiko */
export interface Zone {
  id: number; kind: "chasm" | "water" | "lava" | "chaser"; z0: number; z1: number;
  raft?: boolean; slide?: "water" | "mud" | "snow"; chaser?: string;
}
/** a vine hanging over a chasm or river (or a zipline handle): tap (or jump into it) to swing across */
export interface Vine { id: number; lane: number; z: number; len: number; toY: number; zip?: boolean; used?: boolean }
export type ItemKind = "banana" | "fruit" | "gold" | "heart" | "rotten" | "power" | "boost" | "pad" | "ride";
export interface Item {
  id: number; kind: ItemKind; lane: number; z: number; y: number;
  /** banana melody: the banana line and its place in the line */
  line?: number; idx?: number;
  fruit?: FruitId; power?: PowerId; ride?: RideId;
  /** pepper rockets: ×3 or the golden ×5 */
  boost?: number;
  got?: boolean; t?: number;
}
/** one run */
export interface RunSpec {
  seed: number;
  /** the stage the run starts at (1 = Kiko's Treehouse; the Daily Jungle Hunt starts elsewhere) */
  start: number;
  daily?: string; demo?: boolean;
  /** quiet helper: a kinder run after a few short ones in a row */
  help?: boolean;
  /** chunk ids seen lately (freshness memory across runs) */
  recent?: string[];
}
/** one stage (a named place) of the run */
export interface Section {
  n: number; s: number; r: number; region: RegionId; scene: RegionId; remix: boolean; place: string; emoji: string;
  d: number; tod: TimeOfDay; weather: Weather; piece: SetPiece; fruit: FruitId; music: string; tune: number[];
  allow: string; chase: boolean; villain: string; boss: string; ride?: RideId;
  /** the Wild Forest: the season, this place's twist and the two regions blended ("a-b", for the freshness memory) */
  season?: Season; twist?: Twist; blend?: string;
  /** place 301: the Great Fruit Tree finale */
  finale?: boolean;
}

export type SimEvent =
  | { t: "lane"; dir: number }
  | { t: "jump" } | { t: "bounce" }
  | { t: "land"; v: number }
  | { t: "slide" } | { t: "slam" }
  | { t: "banana"; id: number; line?: number; idx?: number; pull?: boolean }
  | { t: "melody"; line: number; n: number }
  | { t: "fruit"; id: FruitId; meter: number } | { t: "salad" } | { t: "gold"; n: number }
  | { t: "heart"; hearts: number; max: number; bonus?: boolean } | { t: "maxUp"; max: number }
  | { t: "rotten" }
  | { t: "power"; id: PowerId } | { t: "powerEnd"; id: PowerId } | { t: "helmetPop" }
  | { t: "boost"; x: number; on: boolean; rush?: boolean } | { t: "rushReady" }
  | { t: "ride"; id: RideId; on: boolean }
  | { t: "trick"; kind: TrickKind; pts: number; combo: number }
  | { t: "stumble"; side: number; lost: number }
  | { t: "hurt"; by: ObKind | "fall" | "water" | "croc" | "lava"; hearts: number } | { t: "respawn" }
  | { t: "flag" }
  | { t: "grab"; id: number; zip?: boolean } | { t: "release" }
  | { t: "branch"; on: boolean } | { t: "raft"; on: boolean; slide?: string }
  | { t: "slip" } | { t: "splash"; x: number; z: number; lava?: boolean }
  | { t: "stuck" } | { t: "mud" } | { t: "gust"; dir: number }
  | { t: "coco"; id: number }
  | { t: "pad"; n: number } | { t: "caught" } | { t: "chase"; on: boolean; boss?: string } | { t: "escaped" } | { t: "throw"; lane: number }
  | { t: "chaser"; on: boolean; what?: string }
  | { t: "smash"; kind: ObKind }
  | { t: "place"; n: number } | { t: "region"; n: number }
  | { t: "end" };

export interface RunStats {
  /** fruits eaten by kind (the Daily Jungle Hunt goal counts one kind) */
  fruitBy: Partial<Record<FruitId, number>>;
  bananas: number; fruits: number; golden: number; salads: number; tricks: number; melodies: number; bestCombo: number;
  jumps: number; slides: number; vines: number; bounces: number; branches: number; rafts: number; crocHops: number;
  powers: number; boosts: number; rushes: number; stumbles: number; hurts: number; hearts: number; seeds: number; smashes: number;
  rides: number; ziplines: number; bosses: number;
}
export interface SimResult extends RunStats {
  score: number; distance: number; time: number; regions: number; bestRegion: number; places: number;
  /** stickers: the places reached this run and the animals and bosses met */
  firstPlace: number; lastPlace: number; met: string[];
}
