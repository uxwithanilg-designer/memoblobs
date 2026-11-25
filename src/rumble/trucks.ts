// The garage: Rumble Rally's monster trucks and their upgrades. Every truck is a chassis on two big sprung wheels
// (src/rumble/physics.ts) with a ram up front, a nitro tank and a rocket pod. They differ in weight, wheel size,
// suspension, grip, power, nitro, rockets, armour and how hard their ram hits. Units: metres, kilograms, seconds,
// newtons. Chassis-local coordinates: x forward, y up, origin at the centre of mass.
import type { EngineVoice } from "@/racing/types";

export type TruckId = "brawler" | "hornet" | "rhino" | "viper" | "titan";
export type UpgradeId = "engine" | "nitro" | "rockets" | "absorbers" | "armor";
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "engine", label: "Engine", hint: "More power and top speed" },
  { id: "nitro", label: "Nitro", hint: "A bigger, stronger boost" },
  { id: "rockets", label: "Rockets", hint: "More rockets, faster reload" },
  { id: "absorbers", label: "Absorbers", hint: "Softer landings, steadier in the air" },
  { id: "armor", label: "Armour", hint: "Shrug off rockets and rams" },
];
export const MAX_LEVEL = 8;

export interface TruckSpec {
  id: TruckId;
  name: string;
  tagline: string;
  price: number;
  colors: { body: string; trim: string; accent: string; rim: string; tire: string; glow: string };
  /** the paint job's style */
  style: "stripes" | "flames" | "bolt" | "tiger" | "crown";
  chassis: { mass: number; w: number; h: number; inertia: number };
  anchors: [[number, number], [number, number]];
  wheel: { r: number; mass: number; rest: number; travel: number; k: number; c: number };
  /** the body box (collisions between trucks, and the drawing): rear x0 … front x1, bottom y0 … top y1 */
  body: { x0: number; x1: number; y0: number; y1: number };
  /** the cab: from x0 to x1, roof height */
  cab: { x0: number; x1: number; roof: number };
  hull: [number, number][];
  roof: { x: number; y: number; r: number };
  drive: "rear" | "all";
  torque: number;
  maxSpin: number;
  brake: number;
  grip: number;
  airControl: number;
  wheelie: number;
  fuel: number;
  fuelUse: number;
  /** nitro tank (seconds) and its push */
  nitro: number; nitroPush: number;
  /** rocket pod size and reload time (s) */
  rockets: number; reload: number;
  /** 0..1: how much of a hit it shrugs off */
  armor: number;
  /** how hard its ram pushes */
  ram: number;
  voice: EngineVoice;
}

const truck = (o: Omit<TruckSpec, "hull" | "roof">): TruckSpec => {
  const b = o.body, c = o.cab;
  return {
    ...o,
    hull: [[b.x0 - 0.05, b.y0 - 0.1], [b.x0 - 0.05, b.y1], [c.x0, c.roof], [c.x1 - 0.2, c.roof], [b.x1, b.y1 - 0.05], [b.x1 + 0.12, b.y0], [0, b.y0 - 0.25]],
    roof: { x: (c.x0 + c.x1) / 2, y: c.roof - 0.22, r: 0.3 },
  };
};

export const TRUCKS: TruckSpec[] = [
  truck({
    id: "brawler", name: "Brawler", tagline: "Ziggy's first truck: tough, balanced, with a steel ram.", price: 0,
    colors: { body: "#FF6A2C", trim: "#1E2030", accent: "#FFD23F", rim: "#E8EDF5", tire: "#202128", glow: "#FFB23A" },
    style: "stripes",
    chassis: { mass: 540, w: 3.5, h: 1.0, inertia: 0.85 },
    anchors: [[-1.28, -0.42], [1.28, -0.42]],
    wheel: { r: 0.8, mass: 46, rest: 0.55, travel: 0.44, k: 37000, c: 2500 },
    body: { x0: -1.8, x1: 1.85, y0: -0.25, y1: 0.45 }, cab: { x0: -0.55, x1: 0.75, roof: 1.08 },
    drive: "all", torque: 3500, maxSpin: 30, brake: 3800, grip: 1.15, airControl: 5.2, wheelie: 0.6, fuel: 100, fuelUse: 2.0,
    nitro: 3.2, nitroPush: 9, rockets: 3, reload: 9, armor: 0.1, ram: 1,
    voice: { idle: 700, redline: 5200, gears: 4, tone: "v8" },
  }),
  truck({
    id: "hornet", name: "Hornet", tagline: "Light and quick, with a double rocket pod.", price: 6000,
    colors: { body: "#FFD23F", trim: "#1A1A22", accent: "#1A1A22", rim: "#2A2A33", tire: "#1C1C22", glow: "#FFE27A" },
    style: "bolt",
    chassis: { mass: 470, w: 3.4, h: 0.95, inertia: 0.85 },
    anchors: [[-1.25, -0.4], [1.25, -0.4]],
    wheel: { r: 0.8, mass: 42, rest: 0.55, travel: 0.44, k: 34000, c: 2400 },
    body: { x0: -1.75, x1: 1.8, y0: -0.24, y1: 0.42 }, cab: { x0: -0.5, x1: 0.72, roof: 1.04 },
    drive: "all", torque: 3600, maxSpin: 33, brake: 3700, grip: 1.2, airControl: 6.2, wheelie: 0.58, fuel: 105, fuelUse: 1.9,
    nitro: 3.6, nitroPush: 10, rockets: 5, reload: 7, armor: 0.12, ram: 0.95,
    voice: { idle: 900, redline: 7200, gears: 5, tone: "inline4" },
  }),
  truck({
    id: "rhino", name: "Rhino", tagline: "A heavy brute with a horned ram and thick armour.", price: 14000,
    colors: { body: "#5E7A5A", trim: "#1E241E", accent: "#C9D2B8", rim: "#B8BEB0", tire: "#1C1E1A", glow: "#B8FF7A" },
    style: "tiger",
    chassis: { mass: 720, w: 3.7, h: 1.1, inertia: 0.85 },
    anchors: [[-1.36, -0.46], [1.36, -0.46]],
    wheel: { r: 0.92, mass: 56, rest: 0.6, travel: 0.5, k: 42000, c: 3300 },
    body: { x0: -1.9, x1: 2.0, y0: -0.28, y1: 0.5 }, cab: { x0: -0.55, x1: 0.8, roof: 1.16 },
    drive: "all", torque: 5600, maxSpin: 28, brake: 5000, grip: 1.25, airControl: 4.8, wheelie: 0.55, fuel: 130, fuelUse: 2.3,
    nitro: 3.4, nitroPush: 9.5, rockets: 4, reload: 8, armor: 0.45, ram: 1.6,
    voice: { idle: 560, redline: 4600, gears: 4, tone: "diesel" },
  }),
  truck({
    id: "viper", name: "Viper", tagline: "Built for nitro: long boosts and a sharp nose.", price: 26000,
    colors: { body: "#7A3CFF", trim: "#140E2A", accent: "#3EF0C8", rim: "#3EF0C8", tire: "#15121E", glow: "#3EF0C8" },
    style: "flames",
    chassis: { mass: 520, w: 3.6, h: 0.95, inertia: 0.85 },
    anchors: [[-1.3, -0.42], [1.3, -0.42]],
    wheel: { r: 0.84, mass: 44, rest: 0.56, travel: 0.46, k: 38000, c: 2700 },
    body: { x0: -1.8, x1: 1.95, y0: -0.24, y1: 0.42 }, cab: { x0: -0.5, x1: 0.78, roof: 1.02 },
    drive: "all", torque: 4400, maxSpin: 34, brake: 4300, grip: 1.3, airControl: 6.4, wheelie: 0.55, fuel: 120, fuelUse: 1.9,
    nitro: 5.2, nitroPush: 12, rockets: 4, reload: 7.5, armor: 0.25, ram: 1.15,
    voice: { idle: 800, redline: 7800, gears: 6, tone: "v12" },
  }),
  truck({
    id: "titan", name: "Titan", tagline: "The champion's gold truck: power, armour and a triple pod.", price: 48000,
    colors: { body: "#F2C14E", trim: "#5A1E1E", accent: "#D8302A", rim: "#FFF0C0", tire: "#1E1A18", glow: "#FFE08A" },
    style: "crown",
    chassis: { mass: 640, w: 3.8, h: 1.05, inertia: 0.85 },
    anchors: [[-1.36, -0.45], [1.36, -0.45]],
    wheel: { r: 0.9, mass: 52, rest: 0.58, travel: 0.5, k: 41000, c: 3100 },
    body: { x0: -1.9, x1: 2.0, y0: -0.26, y1: 0.48 }, cab: { x0: -0.55, x1: 0.8, roof: 1.12 },
    drive: "all", torque: 5800, maxSpin: 34, brake: 5200, grip: 1.35, airControl: 6.2, wheelie: 0.52, fuel: 140, fuelUse: 2.0,
    nitro: 5, nitroPush: 12, rockets: 6, reload: 6, armor: 0.5, ram: 1.5,
    voice: { idle: 650, redline: 6800, gears: 6, tone: "v12" },
  }),
];
export const truckOf = (id: TruckId) => TRUCKS.find((v) => v.id === id) ?? TRUCKS[0];

export function upgradeCost(v: TruckSpec, level: number) {
  const base = 400 + v.price * 0.05;
  return Math.round((base * Math.pow(1.6, level)) / 10) * 10;
}

export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { engine: 0, nitro: 0, rockets: 0, absorbers: 0, armor: 0 };

export function tuned(v: TruckSpec, l: Levels): TruckSpec {
  const e = l.engine / MAX_LEVEL, n = l.nitro / MAX_LEVEL, r = l.rockets / MAX_LEVEL, s = l.absorbers / MAX_LEVEL, a = l.armor / MAX_LEVEL;
  return {
    ...v,
    torque: v.torque * (1 + 0.4 * e),
    maxSpin: v.maxSpin * (1 + 0.16 * e),
    nitro: v.nitro * (1 + 0.6 * n), nitroPush: v.nitroPush * (1 + 0.3 * n),
    rockets: v.rockets + Math.round(3 * r), reload: v.reload * (1 - 0.4 * r),
    wheel: { ...v.wheel, c: v.wheel.c * (1 + 0.3 * s), travel: v.wheel.travel * (1 + 0.2 * s) },
    airControl: v.airControl * (1 + 0.25 * s),
    armor: Math.min(0.85, v.armor + 0.35 * a),
  };
}

/** a rival's truck: one of the five builds (its looks, weight, armour and ram), painted in the rival's colours, with
 * its power and top speed set by the rival's skill against a stock Brawler: easy rivals drive like a stock starter
 * truck, the best like one with most of its engine upgrades */
export function rivalSpec(base: TruckId, colors: TruckSpec["colors"], skill: number): TruckSpec {
  const v = truckOf(base), b = TRUCKS[0];
  const torque = b.torque * (b.chassis.mass > 0 ? v.chassis.mass / b.chassis.mass : 1) * (0.86 + 0.44 * skill);
  const top = b.maxSpin * b.wheel.r * (0.92 + 0.2 * skill);
  return { ...v, colors, torque, maxSpin: top / v.wheel.r, fuel: 9999, fuelUse: 0 };
}
