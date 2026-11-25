// The garage: Peak Rover's rides and their upgrades. Every ride is a chassis on two sprung wheels (src/rover/physics.ts);
// what makes them feel different is mass, wheel size, suspension, grip, drive and fuel. Units: metres, kilograms,
// seconds, newtons. Chassis-local coordinates: x forward, y up, origin at the centre of mass.
import type { EngineVoice } from "@/racing/types";

export type VehicleId = "buggy" | "scrambler" | "monster" | "comet";
export type UpgradeId = "engine" | "suspension" | "tires" | "tank";
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "engine", label: "Engine", hint: "More power and top speed" },
  { id: "suspension", label: "Suspension", hint: "Softer landings, better balance" },
  { id: "tires", label: "Tires", hint: "More grip on steep hills" },
  { id: "tank", label: "Fuel tank", hint: "Drive further on one can" },
];
export const MAX_LEVEL = 8;

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  tagline: string;
  price: number;
  /** body paint */
  colors: { body: string; trim: string; accent: string; rim: string; tire: string };
  chassis: { mass: number; w: number; h: number; inertia: number };
  /** wheel anchors (where the suspension meets the chassis), rear first */
  anchors: [[number, number], [number, number]];
  wheel: { r: number; mass: number; rest: number; travel: number; k: number; c: number };
  /** the outline used for body-on-ground hits, chassis-local */
  hull: [number, number][];
  /** the driver's head: crash when it touches the ground */
  head: { x: number; y: number; r: number };
  /** where Zuzu sits (hip) */
  seat: [number, number];
  drive: "rear" | "all";
  torque: number;
  maxSpin: number;
  brake: number;
  grip: number;
  /** extra spin the gas / brake give in the air (rad/s²) */
  airControl: number;
  /** how hard the motor's reaction lifts the nose (1 = real physics): the buggy is the twitchiest */
  wheelie: number;
  fuel: number;
  fuelUse: number;
  voice: EngineVoice;
}

export const VEHICLES: VehicleSpec[] = [
  {
    id: "buggy", name: "Pebble Buggy", tagline: "A trusty little dune buggy. Balanced on every hill.", price: 0,
    colors: { body: "#FF6B3D", trim: "#2B2D42", accent: "#FFD23F", rim: "#E8EEF6", tire: "#23252F" },
    chassis: { mass: 230, w: 2.5, h: 0.75, inertia: 0.72 },
    anchors: [[-0.92, -0.18], [0.95, -0.18]],
    wheel: { r: 0.46, mass: 24, rest: 0.42, travel: 0.3, k: 29000, c: 1150 },
    hull: [[-1.3, -0.15], [-1.25, 0.35], [-0.4, 0.42], [0.6, 0.35], [1.32, 0.1], [1.25, -0.25], [-1.2, -0.3]],
    head: { x: -0.12, y: 1.32, r: 0.3 },
    seat: [-0.15, 0.38],
    drive: "rear", torque: 900, maxSpin: 46, brake: 1300, grip: 1.15, airControl: 8.5, wheelie: 1.3, fuel: 100, fuelUse: 3.0,
    voice: { idle: 900, redline: 6800, gears: 4, tone: "small" },
  },
  {
    id: "scrambler", name: "Zip Scrambler", tagline: "A light dirt bike: quick, flippy and thrifty with fuel.", price: 4500,
    colors: { body: "#2EC4B6", trim: "#1B1F3B", accent: "#FF3366", rim: "#F1F5F9", tire: "#1E2029" },
    chassis: { mass: 120, w: 1.7, h: 0.5, inertia: 1.0 },
    anchors: [[-0.72, -0.05], [0.78, -0.05]],
    wheel: { r: 0.44, mass: 14, rest: 0.4, travel: 0.32, k: 15000, c: 820 },
    hull: [[-0.9, 0.05], [-0.6, 0.3], [0.5, 0.32], [0.95, 0.15], [0.6, -0.15], [-0.7, -0.15]],
    head: { x: 0.02, y: 1.28, r: 0.28 },
    seat: [-0.1, 0.42],
    drive: "rear", torque: 500, maxSpin: 48, brake: 700, grip: 1.1, airControl: 7.8, wheelie: 0.85, fuel: 85, fuelUse: 2.0,
    voice: { idle: 1300, redline: 10500, gears: 5, tone: "single" },
  },
  {
    id: "monster", name: "Bumble Monster", tagline: "Huge tyres and a soft ride. Rolls over anything.", price: 11000,
    colors: { body: "#FFC53D", trim: "#2A1E5C", accent: "#7B5CFF", rim: "#C9CEDA", tire: "#1C1D25" },
    chassis: { mass: 320, w: 2.7, h: 0.8, inertia: 0.85 },
    anchors: [[-1.0, -0.3], [1.0, -0.3]],
    wheel: { r: 0.72, mass: 42, rest: 0.55, travel: 0.42, k: 30000, c: 1800 },
    hull: [[-1.4, -0.2], [-1.35, 0.4], [-0.5, 0.5], [0.7, 0.45], [1.42, 0.15], [1.35, -0.3], [-1.3, -0.35]],
    head: { x: -0.1, y: 1.38, r: 0.3 },
    seat: [-0.15, 0.45],
    drive: "all", torque: 2400, maxSpin: 30, brake: 2200, grip: 1.2, airControl: 5.4, wheelie: 1.0, fuel: 120, fuelUse: 3.8,
    voice: { idle: 750, redline: 6000, gears: 4, tone: "v8" },
  },
  {
    id: "comet", name: "Comet Rover", tagline: "Electric explorer with balloon wheels and twin thrusters.", price: 24000,
    colors: { body: "#E9ECF5", trim: "#3A3F58", accent: "#2E9BFF", rim: "#8FD3FF", tire: "#2B2F3A" },
    chassis: { mass: 260, w: 2.6, h: 0.7, inertia: 0.75 },
    anchors: [[-0.95, -0.22], [0.98, -0.22]],
    wheel: { r: 0.55, mass: 26, rest: 0.48, travel: 0.36, k: 26000, c: 1300 },
    hull: [[-1.32, -0.15], [-1.3, 0.3], [-0.5, 0.45], [0.7, 0.38], [1.35, 0.08], [1.28, -0.28], [-1.25, -0.32]],
    head: { x: -0.08, y: 1.34, r: 0.3 },
    seat: [-0.12, 0.4],
    drive: "all", torque: 1250, maxSpin: 44, brake: 1600, grip: 1.32, airControl: 9.5, wheelie: 0.95, fuel: 140, fuelUse: 2.8,
    voice: { idle: 0, redline: 9000, gears: 1, tone: "electric" },
  },
];
export const vehicleOf = (id: VehicleId) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];

/** coins for the next level of an upgrade (cheap at first, pricier with the ride's price) */
export function upgradeCost(v: VehicleSpec, level: number) {
  const base = 250 + v.price * 0.06;
  return Math.round((base * Math.pow(1.62, level)) / 10) * 10;
}

export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { engine: 0, suspension: 0, tires: 0, tank: 0 };

/** a ride with its upgrades applied: the numbers physics and the fuel gauge use */
export function tuned(v: VehicleSpec, l: Levels): VehicleSpec {
  const e = l.engine / MAX_LEVEL, s = l.suspension / MAX_LEVEL, t = l.tires / MAX_LEVEL, f = l.tank / MAX_LEVEL;
  return {
    ...v,
    torque: v.torque * (1 + 0.55 * e),
    maxSpin: v.maxSpin * (1 + 0.32 * e),
    wheel: { ...v.wheel, c: v.wheel.c * (1 + 0.35 * s), k: v.wheel.k * (1 + 0.12 * s), travel: v.wheel.travel * (1 + 0.25 * s) },
    grip: v.grip * (1 + 0.38 * t),
    airControl: v.airControl * (1 + 0.25 * s),
    fuel: v.fuel * (1 + 0.6 * f),
  };
}
