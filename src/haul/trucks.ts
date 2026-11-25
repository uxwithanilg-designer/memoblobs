// The yard: Tumble Truck's monster trucks and their upgrades. Every truck is a chassis on two big sprung wheels with an
// open bed behind the cab (src/haul/physics.ts); they differ in weight, wheel size, suspension, grip, power, fuel and
// the height of the bed's side boards (taller boards hold a load better). Units: metres, kilograms, seconds, newtons.
// Chassis-local coordinates: x forward, y up, origin at the centre of mass.
import type { EngineVoice } from "@/racing/types";

export type TruckId = "mudbug" | "timberjaw" | "thunderhoof" | "glowtail";
export type UpgradeId = "engine" | "suspension" | "tires" | "tank" | "padding";
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "engine", label: "Engine", hint: "More pulling power on climbs" },
  { id: "suspension", label: "Suspension", hint: "Softer ride: the load bounces less" },
  { id: "tires", label: "Tires", hint: "More grip in mud, snow and on steep hills" },
  { id: "tank", label: "Fuel tank", hint: "Drive further on one can" },
  { id: "padding", label: "Cargo padding", hint: "Fragile loads survive harder knocks" },
];
export const MAX_LEVEL = 8;

/** a convex outline in chassis-local metres, counter-clockwise */
export type Poly = [number, number][];

export interface TruckSpec {
  id: TruckId;
  name: string;
  tagline: string;
  price: number;
  colors: { body: string; trim: string; accent: string; rim: string; tire: string; bed: string };
  chassis: { mass: number; w: number; h: number; inertia: number };
  /** wheel anchors (where the suspension meets the chassis), rear first */
  anchors: [[number, number], [number, number]];
  wheel: { r: number; mass: number; rest: number; travel: number; k: number; c: number };
  /** the open bed: from the tailgate's inner face (x0) to the cab (x1), floor height y, side board height */
  bed: { x0: number; x1: number; y: number; wall: number };
  /** cab: back wall at bed.x1, roof height, windscreen foot; hood: front end and top */
  cab: { x1: number; roof: number }; hood: { x1: number; top: number };
  /** the outline used for body-on-ground hits */
  hull: [number, number][];
  /** the roof: the truck has crashed when it touches the ground */
  roof: { x: number; y: number; r: number };
  /** where Bodo sits (hip) */
  seat: [number, number];
  drive: "rear" | "all";
  torque: number;
  maxSpin: number;
  brake: number;
  grip: number;
  airControl: number;
  wheelie: number;
  fuel: number;
  fuelUse: number;
  voice: EngineVoice;
}

const truck = (o: Omit<TruckSpec, "hull" | "roof">): TruckSpec => {
  const b = o.bed, front = o.hood.x1;
  return {
    ...o,
    hull: [[b.x0 - 0.12, -0.32], [b.x0 - 0.12, b.y + b.wall], [b.x1 + 0.05, o.cab.roof], [o.cab.x1 - 0.2, o.cab.roof], [front, o.hood.top], [front + 0.05, -0.18], [0, -0.42]],
    roof: { x: (b.x1 + o.cab.x1) / 2 - 0.05, y: o.cab.roof - 0.22, r: 0.3 },
  };
};

export const TRUCKS: TruckSpec[] = [
  truck({
    id: "mudbug", name: "Mudbug", tagline: "Bodo's first truck: sturdy, honest and easy to handle.", price: 0,
    colors: { body: "#FF5A36", trim: "#22243A", accent: "#FFC93D", rim: "#E9EDF5", tire: "#24252E", bed: "#C98A4E" },
    chassis: { mass: 560, w: 3.6, h: 1.0, inertia: 0.85 },
    anchors: [[-1.3, -0.42], [1.3, -0.42]],
    wheel: { r: 0.8, mass: 48, rest: 0.55, travel: 0.42, k: 38000, c: 2100 },
    bed: { x0: -1.75, x1: -0.02, y: 0.02, wall: 0.4 },
    cab: { x1: 0.98, roof: 1.06 }, hood: { x1: 1.86, top: 0.5 },
    seat: [0.42, 0.35],
    drive: "all", torque: 3300, maxSpin: 30, brake: 3600, grip: 1.15, airControl: 4.6, wheelie: 0.6, fuel: 100, fuelUse: 2.5,
    voice: { idle: 680, redline: 4800, gears: 4, tone: "diesel" },
  }),
  truck({
    id: "timberjaw", name: "Timberjaw", tagline: "A forest hauler with tall side boards that keep a load in.", price: 5500,
    colors: { body: "#2FA55C", trim: "#1B2A22", accent: "#F2E1B6", rim: "#D6C7A1", tire: "#22241F", bed: "#A9733F" },
    chassis: { mass: 620, w: 3.7, h: 1.05, inertia: 0.85 },
    anchors: [[-1.32, -0.44], [1.32, -0.44]],
    wheel: { r: 0.84, mass: 52, rest: 0.56, travel: 0.44, k: 41000, c: 2400 },
    bed: { x0: -1.78, x1: -0.02, y: 0.03, wall: 0.56 },
    cab: { x1: 0.98, roof: 1.1 }, hood: { x1: 1.88, top: 0.52 },
    seat: [0.42, 0.37],
    drive: "all", torque: 4100, maxSpin: 30, brake: 4200, grip: 1.2, airControl: 4.6, wheelie: 0.58, fuel: 120, fuelUse: 2.7,
    voice: { idle: 620, redline: 4600, gears: 5, tone: "v8" },
  }),
  truck({
    id: "thunderhoof", name: "Thunderhoof", tagline: "Giant tyres and a pillow-soft ride for fragile loads.", price: 13000,
    colors: { body: "#7B4DFF", trim: "#1E1640", accent: "#FF7AD9", rim: "#C9CEDA", tire: "#1C1D25", bed: "#8E6A4A" },
    chassis: { mass: 680, w: 3.8, h: 1.1, inertia: 0.85 },
    anchors: [[-1.36, -0.46], [1.36, -0.46]],
    wheel: { r: 0.94, mass: 58, rest: 0.62, travel: 0.54, k: 40000, c: 3300 },
    bed: { x0: -1.8, x1: -0.02, y: 0.03, wall: 0.46 },
    cab: { x1: 1.0, roof: 1.12 }, hood: { x1: 1.92, top: 0.54 },
    seat: [0.44, 0.38],
    drive: "all", torque: 5200, maxSpin: 27, brake: 4800, grip: 1.25, airControl: 4.4, wheelie: 0.56, fuel: 130, fuelUse: 3.0,
    voice: { idle: 560, redline: 4400, gears: 4, tone: "v8" },
  }),
  truck({
    id: "glowtail", name: "Glowtail", tagline: "Electric, light and grippy, with a padded bed and a long-range battery.", price: 28000,
    colors: { body: "#E8F1F6", trim: "#23324A", accent: "#22D3C5", rim: "#8FF3E9", tire: "#232A33", bed: "#3A4A63" },
    chassis: { mass: 540, w: 3.7, h: 1.0, inertia: 0.85 },
    anchors: [[-1.32, -0.42], [1.32, -0.42]],
    wheel: { r: 0.86, mass: 46, rest: 0.58, travel: 0.48, k: 39000, c: 2800 },
    bed: { x0: -1.8, x1: -0.02, y: 0.02, wall: 0.5 },
    cab: { x1: 1.0, roof: 1.06 }, hood: { x1: 1.9, top: 0.5 },
    seat: [0.44, 0.35],
    drive: "all", torque: 4200, maxSpin: 32, brake: 4400, grip: 1.38, airControl: 6.2, wheelie: 0.55, fuel: 150, fuelUse: 2.4,
    voice: { idle: 0, redline: 9000, gears: 1, tone: "electric" },
  }),
];
export const truckOf = (id: TruckId) => TRUCKS.find((v) => v.id === id) ?? TRUCKS[0];
export const bedLength = (s: TruckSpec) => s.bed.x1 - s.bed.x0;

/** coins for the next level of an upgrade */
export function upgradeCost(v: TruckSpec, level: number) {
  const base = 240 + v.price * 0.05;
  return Math.round((base * Math.pow(1.6, level)) / 10) * 10;
}

export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { engine: 0, suspension: 0, tires: 0, tank: 0, padding: 0 };

/** a truck with its upgrades applied; `padding` comes back as a multiplier on fragile cargo's break speed */
export function tuned(v: TruckSpec, l: Levels): TruckSpec & { padding: number } {
  const e = l.engine / MAX_LEVEL, s = l.suspension / MAX_LEVEL, t = l.tires / MAX_LEVEL, f = l.tank / MAX_LEVEL, p = (l.padding ?? 0) / MAX_LEVEL;
  return {
    ...v,
    torque: v.torque * (1 + 0.45 * e),
    maxSpin: v.maxSpin * (1 + 0.18 * e),
    wheel: { ...v.wheel, c: v.wheel.c * (1 + 0.3 * s), k: v.wheel.k * (1 - 0.1 * s), travel: v.wheel.travel * (1 + 0.22 * s) },
    grip: v.grip * (1 + 0.32 * t),
    fuel: v.fuel * (1 + 0.6 * f),
    padding: (v.id === "glowtail" ? 1.12 : v.id === "thunderhoof" ? 1.06 : 1) * (1 + 0.38 * p),
  };
}
