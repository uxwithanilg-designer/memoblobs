// Shared shapes for Momo Escape. Space: a grid of square cells, COLS wide, rows growing upward (y up). Positions are in
// units (U per cell); a cell (cx, cy) has its centre at ((cx + .5)·U, (cy + .5)·U). Time is in ticks (60 per second of
// game time). Every hazard is a pure function of the room's local tick, so the solver, the autopilot and the game agree.

export const U = 10;
export const COLS = 13;
export const TPS = 60;
/** runner hit radius (units) */
export const R_RUN = 3.2;
/** dash speed (units / tick) — 4 ticks per cell */
export const LEAP_V = 2.5;
/** every hazard period divides this, so the solver can fold time */
export const T_FOLD = 120;

/** 0 up (+y) · 1 right (+x) · 2 down (−y) · 3 left (−x) */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [1, 0, -1, 0] as const;
export const opp = (d: Dir) => ((d + 2) % 4) as Dir;

/** special wall faces (the face of wall cell (cx, cy) whose outward normal is n) */
export type FaceKind = "ice" | "honey" | "speed" | "conveyor" | "bounce";
export interface Face { cx: number; cy: number; n: Dir; k: FaceKind; dir?: Dir }

export type HazardSkin = string;
interface HBase { id: number; skin: HazardSkin; concept: string; /** switched off once the room's switch is pressed */ off?: boolean }
export type Hazard =
  /** beam between a and b; blink / sweep (offset along s) / spin (around p, length len) */
  | (HBase & { k: "laser"; ax: number; ay: number; bx: number; by: number; mode: "static" | "blink" | "sweep" | "spin"; period: number; phase: number; duty: number; sx: number; sy: number; px: number; py: number; len: number; spin: number; w: number })
  /** spike strip on wall faces (always on, or popping on a cycle) */
  | (HBase & { k: "spikes"; faces: { cx: number; cy: number; n: Dir }[]; period: number; phase: number; duty: number })
  /** a box that slams from its home position by (ex, ey) and back */
  | (HBase & { k: "crusher"; x: number; y: number; w: number; h: number; ex: number; ey: number; period: number; phase: number })
  /** fires blocks from a wall face along its normal */
  | (HBase & { k: "turret"; cx: number; cy: number; n: Dir; period: number; phase: number; speed: number; size: number; range: number })
  /** a round thing: still, on a line (ping-pong), orbiting, or swinging */
  | (HBase & { k: "mover"; r: number; path: "static" | "line" | "orbit" | "pendulum"; x: number; y: number; ex: number; ey: number; rad: number; amp: number; period: number; phase: number; dir: number })
  /** an area that is dangerous for part of a cycle (after a visible warning) */
  | (HBase & { k: "pulse"; x: number; y: number; w: number; h: number; period: number; phase: number; duty: number; warn: number })
  /** the room floods from below */
  | (HBase & { k: "flood"; y0: number; delay: number; rate: number });

export type PickupKind = "coin" | "diamond" | "heart" | "booster" | "shield" | "slowmo" | "magnet" | "ghost" | "key" | "switch" | "buddy" | "plate" | "vend";
export interface Pickup { id: number; k: PickupKind; x: number; y: number }

export interface RoomRules {
  dark?: boolean; fog?: boolean; mirror?: boolean; flip?: boolean; tilt?: boolean; strobe?: boolean; memory?: boolean;
  alarm?: boolean; silent?: boolean; water?: boolean; lowg?: boolean; wind?: boolean; big?: boolean; kranky?: boolean;
}

export interface Room {
  /** floor number in this run (1-based) */
  n: number;
  /** global row of this room's floor row (set when the room joins the tower) */
  y0: number;
  h: number;
  /** COLS × h, 1 = wall (row 0 = floor with the entrance hole, row h−1 = ceiling with the exit hatch) */
  cells: Uint8Array;
  /** looks solid but Momo can pass (fake wall) */
  fake: Uint8Array;
  /** wall cells that only exist until the key is taken (keycard doors) */
  door: Uint8Array;
  inX: number;
  outX: number;
  /** the exit hatch stays shut until the key is collected */
  key: boolean;
  faces: Face[];
  bumpers: { cx: number; cy: number }[];
  pads: { ax: number; ay: number; bx: number; by: number }[];
  hazards: Hazard[];
  pickups: Pickup[];
  rules: RoomRules;
  /** game-speed multiplier for this floor (speed rush) */
  rush: number;
  building: number;
  /** floor inside its building 1…10 (0 for fusion floors) */
  floor: number;
  /** concept ids this floor uses (Dex) */
  concepts: string[];
  name: string;
  fusion?: { name: string; atoms: string[]; key: string };
  finale?: string;
  /** solver results: par time from the entrance hatch, and the autopilot's moves ((tick << 2) | direction) */
  par: number;
  bots: number[][];
  /** wall decorations (signs, screens, alarm lights, vents, crates…) */
  decor: { k: string; cx: number; cy: number; n: Dir }[];
  seed: number;
  difficulty: number;
  shape: string;
}

export type SimEvent =
  | { t: "leap"; x: number; y: number }
  | { t: "land"; x: number; y: number; g: Dir }
  | { t: "bump"; x: number; y: number; d: Dir }
  | { t: "pickup"; k: PickupKind; x: number; y: number; n: number }
  | { t: "hit"; x: number; y: number; skin: string; shield: boolean }
  | { t: "life"; lives: number; delta: number }
  | { t: "respawn" }
  | { t: "dead" }
  | { t: "room"; n: number; room: Room }
  | { t: "exit"; n: number; ticks: number; diamonds: number }
  | { t: "bounce" }
  | { t: "teleport" }
  | { t: "switch" }
  | { t: "key" }
  | { t: "power"; k: PickupKind; on: boolean }
  | { t: "nearmiss" };
