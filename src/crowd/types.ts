// Blob Brigade shared types. The simulation (sim.ts) is pure TypeScript — no three.js, no DOM — so the same code
// runs in the game, in the par-bot balance sweep (scripts/brigade_sweep.mjs) and in headless QA.

export type GrumpKind = "grump" | "helmet" | "speedy" | "jelly" | "chunky" | "spitter" | "bouncer" | "splitter" | "shield" | "balloon";
/** the villains who close every stage */
export type BossKind = "mega" | "jelly" | "kranky" | "cloud" | "balloon" | "spiky" | "chef"
  | "yeti" | "robo" | "boat" | "ghost" | "golem" | "magma" | "ufo" | "mech";
export type BlockKind = "jar" | "cage" | "pinata";
export type MathMode = "off" | "easy" | "plus";
export type StageType = "learn" | "classic" | "gates" | "pinata" | "miniboss" | "rescue" | "split" | "hold" | "big" | "boss";
export type LaneKind = "recruit" | "field" | "bonus";
export type ThemeId = "garden" | "candy" | "snow" | "toy" | "beach" | "spooky" | "jungle" | "lava" | "space" | "castle";
export type LeaderId = "momo" | "pip" | "gloop" | "bolt" | "bonbon" | "hoot" | "turbo" | "zib" | "noodle" | "tiki" | "kranky";
export type PowerUp = "beam" | "freeze" | "magnet" | "bomb" | "wall" | "double" | "triple" | "rapid" | "mega";

/** each world adds one board mechanic (Kranky's Castle mixes them) */
export interface Mechanics {
  /** the brigade slides on ice */
  ice?: boolean;
  /** toy blocks sliding across the field that swallow bubbles */
  blockers?: number;
  /** a surf wave sweeps the line every N seconds and shoves the brigade */
  waves?: number;
  /** spooky darkness (render only) */
  dark?: boolean;
  /** a boulder rolls down a column every N seconds */
  boulders?: number;
  /** lava vents on the line that warn, then erupt */
  vents?: number;
  /** a meteor falls near the brigade every N seconds */
  meteors?: number;
}

export interface Lane { kind: LaneKind; x0: number; x1: number }

export interface GrumpSpec { x: number; z: number; kind: GrumpKind; /** tougher Grumpies in late Endless waves */ hp?: number; /** carries a power: pop it and the brigade gets it */ pw?: PowerUp }
export interface TileSpec { lane: number; z: number; /** negative = a thorn tile that takes blobs away */ v: number; coin?: boolean; /** a power-up tile */ pw?: PowerUp }
export interface JarSpec { lane: number; z: number; hp: number; tiles: number[]; coins: number }
export interface CageSpec { x: number; z: number; hp: number; n: number }
export interface PinataSpec { x: number; z: number; hp: number; coins: number }
export type GateOp = "+" | "-" | "x" | "/";
export interface Gate { op: GateOp; k: number }
export interface GateRowSpec { z: number; gates: Gate[] }
export interface BossSpec { kind: BossKind; hp: number; z: number; mini?: boolean; /** blobs one of its attacks takes */ dmg?: number }

/** one chunk of a stage: a campaign stage is one segment, Endless Waves feeds a new one every wave */
export interface Segment {
  horde: GrumpSpec[];
  tiles: TileSpec[];
  jars: JarSpec[];
  cages: CageSpec[];
  pinatas: PinataSpec[];
  gates: GateRowSpec[];
  boss: BossSpec | null;
  /** horde walking speed (m/s) */
  speed: number;
  /** blobs a Spitter's goo ball takes */
  spit?: number;
}

export type GoalKind = "jars" | "keep" | "count" | "cages" | "fast" | "pinatas";
export interface Goal { kind: GoalKind; value: number; text: string }

export interface StageSpec {
  id: string;
  /** campaign stage number (1-based), 0 for Endless */
  n: number;
  theme: ThemeId;
  type: StageType;
  lanes: Lane[];
  segment: Segment;
  goal: Goal;
  endless?: boolean;
  /** brigade size at the start */
  start: number;
  /** conveyor + released tile speed (m/s) */
  tileSpeed: number;
  /** gate row speed (m/s) */
  gateSpeed: number;
  seed: number;
  math: MathMode;
  /** world index (0 = Garden Path) */
  world: number;
  mech: Mechanics;
  /** Boss Rush: one villain after another */
  rush?: boolean;
  /** Remix Loop palette: 1 gold, 2 rainbow, 3 galaxy */
  tier?: number;
  /** today's Daily Challenge twist */
  mods?: string[];
  /** set = adaptive difficulty on: a brigade bigger than a good player would have right now (Sim.ex) hits softer and takes bigger bites */
  expect?: number;
}

export type BombKind = "goo" | "zap" | "cake" | "snow" | "lava" | "rock" | "cannon";

export type SimEvent =
  | { t: "pop"; x: number; z: number; kind: GrumpKind; big: boolean }
  | { t: "hit"; x: number; z: number; n: number }
  | { t: "recruit"; x: number; z: number; n: number; coin?: boolean }
  | { t: "gate"; good: boolean; label: string; x: number; before: number; after: number }
  | { t: "blockHit"; id: number; kind: BlockKind }
  | { t: "blockBreak"; id: number; kind: BlockKind; x: number; z: number; n: number; coins: number }
  | { t: "blockLost"; id: number; kind: BlockKind }
  | { t: "bossIn"; kind: BossKind; mini: boolean }
  | { t: "bossHit" }
  | { t: "bossRage"; kind: BossKind }
  | { t: "bossDown"; kind: BossKind; x: number; z: number }
  | { t: "bossSmash"; n: number }
  | { t: "bossShield"; on: boolean }
  | { t: "bossCharge" }
  | { t: "bossDrop"; n: number }
  | { t: "throw"; kind: BombKind; x: number; z: number }
  | { t: "land"; kind: BombKind; x: number; z: number; hit: boolean; n: number }
  | { t: "power"; kind: PowerUp; x: number; z: number }
  | { t: "leaderPower"; id: LeaderId }
  | { t: "cakeBomb"; x: number; z: number }
  | { t: "boulder"; x: number }
  | { t: "boulderHit"; x: number; hit: boolean; n: number }
  | { t: "vent"; x: number; state: "warn" | "erupt" | "off" }
  | { t: "burn"; n: number }
  | { t: "surf"; dir: number; stage: "warn" | "hit" }
  | { t: "chill" }
  | { t: "bossFade"; on: boolean }
  | { t: "bossArmor" }
  | { t: "bossCore"; open: boolean }
  | { t: "bossPhase"; phase: number }
  | { t: "bossBeam"; on: boolean }
  | { t: "merge"; tier: number }
  | { t: "wave"; k: number }
  | { t: "waveClear"; k: number }
  | { t: "toast"; text: string; tone: "good" | "bad" | "gold" | "info"; big?: boolean }
  | { t: "end"; won: boolean };

export interface SimResult {
  won: boolean;
  stars: number;
  count: number;
  peak: number;
  pops: number;
  coins: number;
  time: number;
  goalMet: boolean;
  jars: number; jarsTotal: number;
  cages: number; cagesTotal: number;
  pinatas: number; pinatasTotal: number;
  wave?: number;
  score?: number;
}
