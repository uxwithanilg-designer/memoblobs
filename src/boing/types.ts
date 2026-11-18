// Momo Boing! shared types. World units: the play column is x ∈ [−HALF, HALF] (it wraps left↔right), y goes up.

export type WorldId = "garden" | "candy" | "snow" | "toy" | "beach" | "spooky" | "jungle" | "lava" | "space" | "castle";
export type FriendId = "pip" | "zib" | "bolt" | "gloop" | "bonbon" | "hoot" | "turbo" | "noodle" | "tiki" | "kranky";
export type PlatKind = "solid" | "move" | "crumble" | "spring" | "cloud" | "gum" | "ice" | "safe" | "finish"
  // Phase 2 worlds
  | "tramp" | "cannon" | "ball" | "ghost" | "vent" | "planet" | "bridge";
export type EnemyKind = "bee" | "sitter";
export type DropKind = "acorn" | "candy" | "snowball" | "toyball" | "coconut" | "pumpkin" | "fruit" | "rock" | "meteor" | "cannonball";
export type StageType = "warmup" | "notes" | "friends" | "comet" | "chase" | "puzzle" | "time" | "long" | "storm" | "boss";
export type VillainKind = "balloon" | "chef" | "cloud" | "robo" | "boat" | "ghost" | "golem" | "magma" | "ufo" | "mech";
export type CardId = "double" | "spring" | "magnet" | "wide" | "shield" | "lucky" | "slowgoo" | "cloud";
/** stage 101+: the sky changes with the time of day and the weather */
export type TimeOfDay = "day" | "morning" | "sunset" | "night" | "aurora";
export type Weather = "none" | "snow" | "sprinkles" | "fireflies" | "leaves" | "embers" | "stars" | "bubbles";
export type Twist = "windy" | "tiny" | "fastgoo" | "floaty" | "night";

export interface PlatSpec {
  x: number; y: number; w: number; kind: PlatKind;
  /** moving platforms: swing amplitude (units) and speed (rad/s); ghost/bridge/vent platforms: cycle phase */
  amp?: number; spd?: number; ph?: number;
}
/** a jungle vine Momo can grab and climb */
export interface VineSpec { x: number; y0: number; y1: number }
/** a water spout (always on) or a lava geyser (on and off) that lifts Momo */
export interface LiftSpec { x: number; y0: number; y1: number; kind: "spout" | "geyser"; ph: number }
export interface EnemySpec { kind: EnemyKind; x: number; y: number; /** bees fly between x0 and x1 */ x0?: number; x1?: number; spd?: number }
export interface ItemSpec { kind: "coin" | "note" | "friend"; x: number; y: number; friend?: FriendId }
export interface WindSpec { y0: number; y1: number; force: number }

export type GoalKind = "perfects" | "notes" | "friends" | "comets" | "stack" | "coins" | "time" | "stomps";
export interface Goal { kind: GoalKind; value: number; text: string }

export interface StageSpec {
  id: string; n: number; world: number; theme: WorldId; type: StageType; name: string;
  /** 0 … ~1.4: every knob reads this */
  d: number;
  top: number;
  plats: PlatSpec[];
  enemies: EnemySpec[];
  items: ItemSpec[];
  winds: WindSpec[];
  vines: VineSpec[];
  lifts: LiftSpec[];
  /** gravity and take-off multipliers (Space floats) */
  grav: number; jump: number;
  /** lava bubbles rise from below instead of things falling */
  rising?: boolean;
  /** Endless Climb: no stage goal, difficulty rises with height */
  endless?: boolean;
  /** the music bed's world, the bounce voice and the bounce tune for this stage */
  music: WorldId; voice: string; tune: number[];
  /** stage 101+: the second world blended in, the sky's mood, and an optional twist */
  mix?: WorldId; tod: TimeOfDay; weather: Weather; twist?: Twist;
  /** what the stage card calls this place ("Frosty Clouds") */
  place: string; emoji: string;
  /** Daily Sky */
  daily?: string;
  goo: { start: number; speed: number; lag: number };
  /** falling hazards: one every `every` seconds (0 = none) */
  drops: { kind: DropKind; every: number };
  villain?: { kind: VillainKind; every: number };
  /** Perfect Boing timing window (seconds before landing) */
  window: number;
  goal: Goal;
  seed: number;
  /** title-screen demo: no goo, no end */
  demo?: boolean;
}

export type SimEvent =
  | { t: "land"; x: number; y: number; perfect: boolean; kind: PlatKind; chain: number }
  | { t: "perfect"; chain: number; x: number; y: number }
  | { t: "comet"; on: boolean }
  | { t: "coin"; x: number; y: number }
  | { t: "note"; x: number; y: number }
  | { t: "friendJoin"; id: FriendId; x: number; y: number }
  | { t: "friendSave"; id: FriendId; x: number; y: number }
  | { t: "hit"; x: number; y: number; by: "enemy" | "drop" | "goo" | "fall" }
  | { t: "stomp"; x: number; y: number }
  | { t: "crumble"; x: number; y: number }
  | { t: "spring"; x: number; y: number }
  | { t: "gum"; x: number; y: number }
  | { t: "warn"; x: number; up?: boolean }
  | { t: "throw"; x: number; y: number }
  | { t: "safe"; y: number }
  | { t: "cards"; ids: CardId[] }
  | { t: "card"; id: CardId }
  | { t: "cannon"; x: number; y: number }
  | { t: "vine"; x: number; y: number }
  | { t: "lift"; x: number; y: number }
  | { t: "cake" }
  | { t: "snip"; x: number; y: number }
  | { t: "double"; x: number; y: number }
  | { t: "end"; won: boolean };

export interface SimResult {
  won: boolean; stars: number; goalMet: boolean; height: number; top: number; time: number;
  coins: number; notes: number; perfects: number; bestChain: number; comets: number; friends: number;
  stack: number; bumps: number; stomps: number; score: number;
}
