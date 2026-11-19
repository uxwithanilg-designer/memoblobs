// Tondu's Vine Climb — shared types. A stage is one stretch of vine (an arc-length sampled 3D path) with hazards,
// gaps, bugs, pickups and zones placed along it by distance `s` (metres) and side (+1 / -1 around the vine).

export type Side = 1 | -1;

export type HazKind =
  | "thorn" | "bud" | "burr" | "ants" | "bees" | "spider" | "lightning" | "fruit" | "pod" | "shadow" | "water"
  | "snail" | "tongue" | "crawler" | "swing" | "drip" | "dive" | "nut";

export interface Haz {
  id: number;
  kind: HazKind;
  /** centre along the vine (movers: where they start) */
  s: number;
  /** lethal length along the vine */
  len: number;
  /** 1 / -1, or 0 = both sides */
  side: 0 | 1 | -1;
  /** inside a fork: the branch it belongs to */
  br?: Side;
  /** periodic: lethal while ((t + phase) mod period) < on · period */
  period?: number; phase?: number; on?: number;
  /** "swing": the lethal side flips every half period (side = the first half's side) */
  alt?: boolean;
  /** one-shot: armed when the player is `trig` m before s; lethal from `delay` to `delay + dur` s after that */
  trig?: number; delay?: number; dur?: number;
  /** movers (armed at `trig`): m/s along the vine (negative = coming down toward the player) */
  v?: number;
  /** seconds of visible warning before it turns lethal (for the renderer) */
  warn?: number;
  /** drawn on Pippi's mirror vine (the sim treats it as the opposite side on Tondu's vine) */
  mirror?: boolean;
}

export type GapKind = "leap" | "flower" | "swing";
export interface Gap {
  s0: number; s1: number; kind: GapKind;
  /** flower: the pad's side (be on it at s0) */
  side?: Side;
  /** swing: the rope's period, phase and the share of it you may let go in */
  period?: number; phase?: number; win?: number;
}

export interface Bug { s: number; side: 0 | 1 | -1; /** species 0..29, or -1 = golden beetle (a coin) */ kind: number; br?: Side }
export type PickKind = "sun" | "glide" | "magnet" | "shield";
export interface Pick { s: number; side: Side; kind: PickKind; br?: Side }

export type ZoneKind = "web" | "sap" | "dew" | "shade" | "sun" | "fog" | "hole" | "waterfall" | "rain" | "slick" | "egg";
export interface Zone { s0: number; s1: number; kind: ZoneKind; side: 0 | 1 | -1; /** speed factor while inside on that side */ f?: number }

export interface Fork { s0: number; s1: number }
/** a giant trunk the vine spirals round (for the renderer and the camera) */
export interface Trunk { x: number; z: number; y0: number; y1: number; r: number; s0: number; s1: number }

export interface Path {
  len: number; ds: number; n: number;
  /** xyz per sample */
  P: Float32Array; T: Float32Array; N: Float32Array;
  /** per sample: 1 = gap (no vine), 2 = fork */
  F: Uint8Array;
  trunks: Trunk[];
}

export type StageKind = "normal" | "gold" | "long" | "crown" | "daily" | "wild";

export interface StageDef {
  n: number;
  /** world 0..29 (the look; for Wild / Daily stages, the borrowed world) */
  world: number;
  /** stage within the world 1..20 (0 for Wild / Daily) */
  k: number;
  kind: StageKind;
  concepts: string[];
  /** 0..1 difficulty */
  d: number;
  speed: number;
  /** reaction window (s) between decisions */
  win: number;
  length: number;
  seed: number;
  twist?: string;
  guardian?: string;
  name: string;
}

export interface Stage {
  def: StageDef;
  path: Path;
  haz: Haz[];
  gaps: Gap[];
  bugs: Bug[];
  picks: Pick[];
  zones: Zone[];
  forks: Fork[];
  /** Kaaki chases from below: starts `lag` m behind, at `v` m/s, after `after` s */
  chase?: { lag: number; v: number; after: number };
  /** the vine grows ahead: tip starts `lead` m ahead and grows at `v` */
  grow?: { lead: number; v: number };
  /** the vine withers behind: starts `lag` m behind at `v`, after `after` s */
  wither?: { lag: number; v: number; after: number };
  /** Zeeza on a parallel vine at `v` m/s */
  rival?: { v: number };
  /** halfway moss checkpoint (Long Vine and Crown stages) */
  mid?: number;
}

export type SimEvent =
  | { t: "flip"; side: Side }
  | { t: "snap"; i: number; gold: boolean; combo: number }
  | { t: "miss"; i: number }
  | { t: "tail" } | { t: "regrow" } | { t: "shield" }
  | { t: "smash"; i: number }
  | { t: "fall"; why: "hit" | "gap" | "wither" | "chase" }
  | { t: "leap"; gap: number } | { t: "land" } | { t: "hop" }
  | { t: "pick"; i: number; kind: PickKind }
  | { t: "rush" } | { t: "rushEnd" }
  | { t: "arm"; i: number }
  | { t: "gate" } | { t: "mid" }
  | { t: "chase" } | { t: "grow" }
  | { t: "fork"; br: Side }
  | { t: "rival"; won: boolean }
  | { t: "cling"; on: boolean };
