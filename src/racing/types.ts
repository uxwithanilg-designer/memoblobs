// Shared contracts for the MOMOBLOBS racing engine (all six racing games use these).
import type * as THREE from "three";

export type AiLevel = "easy" | "normal" | "hard" | "pro";
/** drift / battle / rally are the Drift Kings events (drift scoring, tandem battle vs a drifter, rally stage with co-driver calls) */
export type ModeId = "race" | "coinrush" | "timetrial" | "elimination" | "duel" | "drift" | "battle" | "rally"
  /** Highway Heat: heat = single-drive score run through traffic with rising police heat; escape = outrun the cops
   *  to the flag; takedown = you're the interceptor, ram the suspects until they're busted */
  | "heat" | "escape" | "takedown"
  /** Moto Rush GP: single-drive wheelie challenge on the clock */
  | "wheelie";
export type Weather = "clear" | "rain" | "snow" | "sand" | "fireflies" | "ash" | "leaves" | "petals";
export type GfxQuality = "low" | "medium" | "high";
export type CameraView = "chase" | "far" | "hood" | "bumper";
export type ControlScheme = "buttons" | "tilt" | "wheel";

// ---------------------------------------------------------------- vehicles
/** speed/accel/handling/nitro on a 1..10 scale; mass 0.7 (kart) .. 2.6 (big truck) */
export interface CarStats { speed: number; accel: number; handling: number; nitro: number; mass: number; /** drift cars: how far and how easily it slides (1..10) */ drift?: number }
export interface Upgrades { speed: number; accel: number; handling: number; nitro: number } // 0..5 each

export interface EngineVoice {
  /** idle and redline in RPM; gears 4..7; tone picks the synth recipe */
  idle: number; redline: number; gears: number;
  tone: "small" | "v6" | "v8" | "v12" | "electric" | "diesel" | "kart" | "rotary"
    /** motorcycles: screaming inline-4, lumpy V-twin, thumping single, buzzy two-stroke scooter */
    | "inline4" | "twin" | "single" | "scooter";
}

export interface CarSpec {
  id: string;
  name: string;
  /** class label shown in the garage ("Hatchback", "Supercar", "Monster Truck"…) */
  cls: string;
  tier: 1 | 2 | 3 | 4 | 5;
  stats: CarStats;
  /** paint options, first is the default */
  colors: string[];
  /** career stars needed; 0 = free from the start */
  unlockStars: number;
  desc: string;
  engine: EngineVoice;
  /** builder-specific shape parameters (owned by src/racing/cars/build.ts) */
  model: Record<string, unknown>;
}

/** what the car builder returns — a ready-to-add model, +Z is forward, origin on the ground at the car centre */
export interface CarModel {
  group: THREE.Group;
  /** wheels in order FL, FR, RL, RR: `steer` turns about Y (front wheels), `spin` rolls about its X axle */
  wheels: { steer: THREE.Object3D; spin: THREE.Object3D }[];
  wheelRadius: number;
  /** camera mounts in car-local space: just above the bonnet, and on the front bumper */
  cams: { hood: THREE.Vector3; bumper: THREE.Vector3 };
  dims: { length: number; width: number; height: number };
  /** exhaust tips in car-local space (for nitro flames / smoke) */
  exhausts: THREE.Vector3[];
  setBrake(on: boolean): void;
  setNitro(on: boolean, t: number): void;
  setLights(on: boolean): void;
  /** bikes: pitch the chassis up about the rear tyre (wheelie, rad) and hang the rider off into the corner (−1..1) */
  pose?(wheelie: number, hang: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------- worlds
export type PickupKind = "coin" | "nitro" | "shield" | "magnet" | "ramp";
export type HazardKind = "fire" | "oil" | "cones" | "rock" | "spikes" | "puddle";
export type ItemKind = PickupKind | HazardKind;

export interface ThemeSpec {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** career world order (0 = first world) */
  order: number;
  night: boolean;
  weather: Weather;
  /** racing music key → /audio/racing/music_<key>_{calm,action}.mp3 */
  music: string;
  /** width 12..18 m, curviness 0..1, hills 0..1, size 0.7..1.3 (track length scale) */
  track: { width: number; curviness: number; hills: number; size: number };
  hazards: HazardKind[];
  accent: string;
  /** visual parameters owned by src/racing/world/ (sky, fog, light, ground, road, barrier, props…) */
  look: Record<string, unknown>;
}

export interface TrackItem {
  id: number; kind: ItemKind; s: number; d: number; taken: boolean; respawnAt: number;
  /** height above the road (coins on a jump arc) */
  h?: number;
}

// ---------------------------------------------------------------- race setup / results
export interface RaceConfig {
  mode: ModeId;
  themeId: string;
  /** track variant 0..2 (different layout seeds) */
  variant: number;
  reverse: boolean;
  laps: number;
  opponents: number;
  ai: AiLevel;
  carId: string;
  paint: number;
  upgrades: Upgrades;
  weather: Weather | "auto";
  night: boolean | "auto";
  pickups: boolean;
  hazards: boolean;
  /** coin rush: seconds on the clock at start (checkpoints add more) */
  timeLimit?: number;
  /** coin rush: coins needed for 1/2/3 stars */
  coinTarget?: [number, number, number];
  /** time trial: total race time (ms) for 3/2/1 stars */
  timeTargets?: [number, number, number];
  /** duel: rival car id */
  rivalCar?: string;
  /** career level id, if this race is a career event */
  levelId?: string;
  /** racing game slug (picks the physics style, car/world lists and rival pool); default nitro-rush */
  game?: string;
  /** Highway Heat: police car model for the cops (and for you in Takedown) */
  copCar?: string;
  /** drift attack: points for 1/2/3 stars (computed from the track when omitted) */
  driftTarget?: [number, number, number];
  /** 0 (kind) .. 1 (brutal): AI talent & upgrades, hazard density, coin-rush gate bonus, star targets.
   *  Omitted → derived from `ai`. Coin Rush / Time Trial star targets are computed from the real track. */
  difficulty?: number;
}

export interface RacerView {
  id: number; name: string; avatar: string; carId: string; color: string;
  isPlayer: boolean; pos: number; lap: number; progress: number; finished: boolean; time: number; out: boolean; gap: number;
}

export interface RaceResult {
  mode: ModeId;
  completed: boolean;
  pos: number;
  racers: number;
  time: number;
  bestLap: number;
  coins: number;
  stars: 0 | 1 | 2 | 3;
  /** coins added to the wallet */
  reward: number;
  takedowns: number;
  driftScore: number;
  topSpeed: number;
  standings: RacerView[];
  /** optional extras (gameplay) */
  nearMisses?: number;
  perfectNitros?: number;
  /** coin rush: coins for 1/2/3 stars · time trial: total ms for 3/2/1 stars */
  targets?: number[];
  /** coin rush: checkpoint gates driven through */
  checkpoints?: number;
  /** duel: seconds you won (+) or lost (−) by */
  margin?: number;
  /** drift modes: banked drift points, best single chain, rival's points (battle) */
  driftPoints?: number;
  bestChain?: number;
  rivalPoints?: number;
  rivalName?: string;
  /** Highway Heat: run score, why it ended, damage taken, suspects busted / total, cops taken down */
  score?: number;
  busted?: boolean;
  damage?: number;
  suspects?: [number, number];
  copTakedowns?: number;
}

/** sent to React ~12 times per second */
export interface HudFrame {
  phase: "loading" | "intro" | "countdown" | "racing" | "finished";
  countdown: number;
  speed: number; // km/h
  gear: number;
  rpm: number; // 0..1
  nitro: number; // 0..1
  boosting: boolean;
  lap: number;
  laps: number;
  pos: number;
  racers: number;
  time: number; // ms since GO
  lapTime: number;
  bestLap: number;
  coins: number;
  lives: number | null;
  timeLeft: number | null; // seconds (coin rush / elimination)
  drift: number; // current drift chain score
  shield: number; // seconds left
  magnet: number;
  wrongWay: boolean;
  standings: RacerView[];
  // ---- optional extras (gameplay) — safe to ignore
  /** nitro bar is full: double-tap NITRO for a PERFECT NITRO shockwave */
  nitroFull?: boolean;
  /** PERFECT NITRO shockwave active */
  perfectNitro?: boolean;
  /** slipstream 0..1 */
  draft?: number;
  /** drift mini-turbo tier being charged 0..3 (1 blue, 2 orange, 3 purple) */
  driftLevel?: number;
  /** coin rush: coins for 1/2/3 stars · time trial: total ms for 3/2/1 stars */
  targets?: number[];
  /** time trial: seconds vs your best-lap ghost at this point of the lap (− = ahead), null = no ghost yet */
  ghostDelta?: number | null;
  /** coin rush: metres to the next checkpoint gate and the seconds it adds */
  nextGate?: number | null;
  gateBonus?: number;
  /** elimination: the player is in the knock-out zone (last) */
  danger?: boolean;
  /** duel: boss name and gap in seconds (+ = you lead) */
  boss?: { name: string; gap: number } | null;
  /** >0 while invulnerable after a respawn / lost life */
  ghost?: number;
  nearMisses?: number;
  /** drift modes: live chain (not yet banked), its multiplier 1..5, banked total, tandem bonus active */
  driftChain?: number;
  driftMult?: number;
  driftPoints?: number;
  tandem?: boolean;
  /** drift battle: the rival's banked points */
  rival?: { name: string; points: number } | null;
  /** bikes: how far the front wheel is up (0..1) */
  wheelie?: number;
  /** Highway Heat: score, near-miss combo, heat level 1..5, busted meter 0..1, damage 0..100, suspects' health */
  score?: number;
  combo?: number;
  heat?: number;
  bust?: number;
  damage?: number;
  suspects?: { name: string; hp: number; out: boolean }[];
  /** rally: the co-driver's next pace note (dir −1 left / 1 right, grade "1".."6" or "HAIRPIN", metres to it) */
  call?: { dir: number; grade: string; dist: number; caution: boolean } | null;
}

export type RaceEvent =
  | { type: "toast"; text: string; tone?: "gold" | "blue" | "red" | "green" | "pink"; big?: boolean }
  | { type: "lap"; lap: number; time: number; best: boolean }
  | { type: "finish"; result: RaceResult };

export interface InputState { steer: number; gas: number; brake: number; nitro: boolean; drift: boolean }
