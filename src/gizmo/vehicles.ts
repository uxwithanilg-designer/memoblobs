// Gizmo Drive's rides. Like the genre's classics, every stage hands you a ride, and each one drives differently: a
// balanced jeep, a long steady pickup, a bouncy monster truck, a tall and tippy double-decker bus, a tractor with a
// huge back wheel (it loves to wheelie), a light flippy buggy, a fast hot rod and a floaty moon bug. Every ride is a
// chassis on two sprung wheels (src/gizmo/physics.ts). Coins buy paint jobs, which go on whatever you drive.
// Units: metres, kilograms, seconds, newtons. Chassis-local: x forward, y up, origin at the centre of mass.
import type { EngineVoice } from "@/racing/types";

export type VehicleId = "jeep" | "pickup" | "monster" | "bus" | "tractor" | "buggy" | "rod" | "moonbug";

export interface WheelSpec { r: number; mass: number; rest: number; travel: number; k: number; c: number }
export interface VehicleSpec {
  id: VehicleId;
  name: string;
  blurb: string;
  chassis: { mass: number; w: number; h: number; inertia: number };
  /** where each strut meets the chassis, rear first */
  anchors: [[number, number], [number, number]];
  wheels: [WheelSpec, WheelSpec];
  /** body circles for bumps and scrapes: [x, y, r] */
  hull: [number, number, number][];
  /** the driver's head (or the roof): touching anything is a crash */
  head: { x: number; y: number; r: number };
  drive: "rear" | "front" | "all";
  torque: number;
  /** top wheel spin (rad/s) of the rear wheel */
  maxSpin: number;
  brake: number;
  grip: number;
  airControl: number;
  /** how hard the motor's reaction lifts the nose */
  wheelie: number;
  /** fuel: full-throttle seconds in a tank */
  tank: number;
  voice: EngineVoice;
  /** the stock paint */
  paint: { body: string; trim: string; accent: string };
}

const W = (r: number, mass: number, rest: number, travel: number, k: number, c: number): WheelSpec => ({ r, mass, rest, travel, k, c });

export const VEHICLES: VehicleSpec[] = [
  {
    id: "jeep", name: "Bumble Jeep", blurb: "Rivet's trusty jeep: balanced, bouncy and brave.",
    chassis: { mass: 220, w: 2.5, h: 0.8, inertia: 1.0 },
    anchors: [[-0.86, -0.2], [0.9, -0.2]],
    wheels: [W(0.44, 20, 0.36, 0.28, 23000, 1092), W(0.44, 20, 0.36, 0.28, 23000, 1092)],
    hull: [[-1.05, 0.0, 0.3], [-0.4, 0.12, 0.32], [0.35, 0.1, 0.32], [1.0, -0.02, 0.3], [-0.95, 0.38, 0.18]],
    head: { x: -0.12, y: 1.18, r: 0.3 },
    drive: "rear", torque: 760, maxSpin: 30, brake: 1250, grip: 1.15, airControl: 7.1, wheelie: 0.87, tank: 46,
    voice: { idle: 950, redline: 6600, gears: 4, tone: "small" },
    paint: { body: "#FFB72B", trim: "#2B2342", accent: "#FF5A5F" },
  },
  {
    id: "pickup", name: "Hauler Pickup", blurb: "Long and steady. Hard to tip, slow to turn in the air.",
    chassis: { mass: 300, w: 3.3, h: 0.8, inertia: 1.06 },
    anchors: [[-1.15, -0.25], [1.15, -0.25]],
    wheels: [W(0.46, 24, 0.36, 0.26, 29000, 1438), W(0.46, 24, 0.36, 0.26, 29000, 1438)],
    hull: [[-1.4, 0.05, 0.3], [-0.7, 0.1, 0.32], [0.0, 0.12, 0.34], [0.75, 0.15, 0.32], [1.4, 0.0, 0.3]],
    head: { x: 0.28, y: 1.12, r: 0.3 },
    drive: "rear", torque: 1080, maxSpin: 28, brake: 1600, grip: 1.2, airControl: 5.7, wheelie: 0.76, tank: 52,
    voice: { idle: 800, redline: 6000, gears: 4, tone: "v6" },
    paint: { body: "#3FA7F5", trim: "#22314F", accent: "#FFE066" },
  },
  {
    id: "monster", name: "Big Bouncer", blurb: "Giant tyres, soft springs, four-wheel drive. Bounces on everything.",
    chassis: { mass: 320, w: 2.8, h: 0.9, inertia: 1.06 },
    anchors: [[-1.02, -0.36], [1.02, -0.36]],
    wheels: [W(0.72, 38, 0.5, 0.4, 27000, 1667), W(0.72, 38, 0.5, 0.4, 27000, 1667)],
    hull: [[-1.15, 0.05, 0.32], [-0.4, 0.15, 0.36], [0.4, 0.15, 0.36], [1.15, 0.05, 0.32]],
    head: { x: -0.08, y: 1.25, r: 0.3 },
    drive: "all", torque: 1950, maxSpin: 18.5, brake: 2300, grip: 1.22, airControl: 5.2, wheelie: 0.68, tank: 44,
    voice: { idle: 720, redline: 5800, gears: 4, tone: "v8" },
    paint: { body: "#8B5CF6", trim: "#1F1838", accent: "#3DF5A7" },
  },
  {
    id: "bus", name: "Double Decker", blurb: "Tall and heavy. Take the bumps slowly or over it goes.",
    chassis: { mass: 430, w: 4.1, h: 1.9, inertia: 0.94 },
    anchors: [[-1.4, -0.92], [1.45, -0.92]],
    wheels: [W(0.48, 28, 0.3, 0.22, 42000, 2070), W(0.48, 28, 0.3, 0.22, 42000, 2070)],
    hull: [[-1.7, -0.5, 0.42], [-0.6, -0.5, 0.42], [0.55, -0.5, 0.42], [1.7, -0.5, 0.42], [-1.75, 0.35, 0.4], [1.75, 0.35, 0.4]],
    head: { x: 0.0, y: 0.95, r: 0.42 },
    drive: "rear", torque: 1650, maxSpin: 23, brake: 2400, grip: 1.25, airControl: 3.7, wheelie: 0.53, tank: 56,
    voice: { idle: 650, redline: 4200, gears: 5, tone: "diesel" },
    paint: { body: "#F0484E", trim: "#2C1F33", accent: "#FFF3D6" },
  },
  {
    id: "tractor", name: "Tug Tractor", blurb: "A huge back wheel and lots of pull. Loves a wheelie — maybe too much.",
    chassis: { mass: 290, w: 2.5, h: 1.0, inertia: 1.0 },
    anchors: [[-0.72, -0.12], [1.02, -0.32]],
    wheels: [W(0.68, 34, 0.34, 0.22, 26000, 1438), W(0.36, 14, 0.34, 0.22, 20000, 977)],
    hull: [[-0.9, 0.1, 0.32], [-0.1, 0.05, 0.34], [0.75, -0.05, 0.3], [1.2, -0.1, 0.24]],
    head: { x: -0.32, y: 1.32, r: 0.3 },
    drive: "rear", torque: 1500, maxSpin: 15.5, brake: 1800, grip: 1.35, airControl: 5.0, wheelie: 0.76, tank: 50,
    voice: { idle: 600, redline: 3400, gears: 4, tone: "diesel" },
    paint: { body: "#34C77B", trim: "#1E2A24", accent: "#FFD23F" },
  },
  {
    id: "buggy", name: "Zoomer Buggy", blurb: "Light, quick and very flippy. Feather the gas!",
    chassis: { mass: 150, w: 2.2, h: 0.6, inertia: 1.06 },
    anchors: [[-0.8, -0.12], [0.82, -0.12]],
    wheels: [W(0.42, 14, 0.36, 0.3, 15500, 736), W(0.4, 13, 0.36, 0.3, 15000, 713)],
    hull: [[-0.95, 0.05, 0.26], [-0.25, 0.1, 0.28], [0.45, 0.06, 0.26], [0.95, -0.02, 0.24]],
    head: { x: -0.1, y: 1.08, r: 0.28 },
    drive: "rear", torque: 540, maxSpin: 36, brake: 820, grip: 1.12, airControl: 8.1, wheelie: 0.91, tank: 40,
    voice: { idle: 1200, redline: 8800, gears: 5, tone: "kart" },
    paint: { body: "#FF6FB5", trim: "#2A1838", accent: "#7CF5FF" },
  },
  {
    id: "rod", name: "Hot Rod", blurb: "Low, long and fast, with a big back wheel. Mind your speed.",
    chassis: { mass: 250, w: 3.1, h: 0.65, inertia: 1.0 },
    anchors: [[-1.08, -0.14], [1.18, -0.2]],
    wheels: [W(0.5, 22, 0.32, 0.24, 24000, 1150), W(0.38, 15, 0.32, 0.24, 21000, 1035)],
    hull: [[-1.3, 0.05, 0.28], [-0.55, 0.1, 0.3], [0.25, 0.05, 0.28], [1.05, -0.02, 0.26], [1.45, -0.08, 0.2]],
    head: { x: -0.35, y: 1.0, r: 0.28 },
    drive: "rear", torque: 1080, maxSpin: 30, brake: 1500, grip: 1.12, airControl: 6.1, wheelie: 0.8, tank: 44,
    voice: { idle: 850, redline: 6800, gears: 5, tone: "v8" },
    paint: { body: "#E63946", trim: "#1D1B2E", accent: "#FFB703" },
  },
  {
    id: "moonbug", name: "Moon Bug", blurb: "Balloon wheels and electric drive. Floaty in low gravity.",
    chassis: { mass: 200, w: 2.6, h: 0.75, inertia: 1.0 },
    anchors: [[-0.95, -0.22], [0.98, -0.22]],
    wheels: [W(0.52, 20, 0.42, 0.32, 17000, 977), W(0.52, 20, 0.42, 0.32, 17000, 977)],
    hull: [[-1.1, 0.05, 0.3], [-0.35, 0.15, 0.32], [0.4, 0.12, 0.32], [1.1, 0.0, 0.28]],
    head: { x: -0.05, y: 1.22, r: 0.3 },
    drive: "all", torque: 820, maxSpin: 25, brake: 1300, grip: 1.25, airControl: 7.4, wheelie: 0.72, tank: 50,
    voice: { idle: 0, redline: 9000, gears: 1, tone: "electric" },
    paint: { body: "#E8ECF5", trim: "#2F3550", accent: "#38BDF8" },
  },
];
export const vehicleOf = (id: VehicleId) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
/** top road speed (m/s) */
export const topSpeed = (v: VehicleSpec) => v.maxSpin * v.wheels[0].r;

// ------------------------------------------------------------------ paint jobs (bought with coins)
export type PaintId = "stock" | "mint" | "sunset" | "galaxy" | "candy" | "gold" | "neon" | "camo" | "ocean" | "lava" | "zebra" | "rainbow" | "checker";
export interface Paint { id: PaintId; name: string; price: number; body: string; trim: string; accent: string; pattern: "none" | "stripes" | "flames" | "dots" | "checker" | "stars" | "camo" | "rainbow" }
export const PAINTS: Paint[] = [
  { id: "stock", name: "Factory", price: 0, body: "", trim: "", accent: "", pattern: "none" },
  { id: "mint", name: "Mint Racer", price: 250, body: "#5EEAD4", trim: "#134E4A", accent: "#FFFFFF", pattern: "stripes" },
  { id: "sunset", name: "Sunset Flames", price: 500, body: "#FF7A3D", trim: "#3A1225", accent: "#FFD23F", pattern: "flames" },
  { id: "candy", name: "Candy Dots", price: 750, body: "#FF8FC7", trim: "#5B1E45", accent: "#FFFFFF", pattern: "dots" },
  { id: "camo", name: "Jungle Camo", price: 1000, body: "#6B8E4E", trim: "#2A3320", accent: "#C7B57A", pattern: "camo" },
  { id: "ocean", name: "Deep Ocean", price: 1400, body: "#1E6FD9", trim: "#0B2447", accent: "#7CF5FF", pattern: "stripes" },
  { id: "checker", name: "Checker Flag", price: 1800, body: "#F4F4F8", trim: "#16161D", accent: "#16161D", pattern: "checker" },
  { id: "galaxy", name: "Galaxy", price: 2500, body: "#3B2A8F", trim: "#120C33", accent: "#E0C3FC", pattern: "stars" },
  { id: "lava", name: "Lava Glow", price: 3200, body: "#2B1A1A", trim: "#120808", accent: "#FF5A1F", pattern: "flames" },
  { id: "neon", name: "Neon Night", price: 4000, body: "#1A1033", trim: "#0A0618", accent: "#39FF88", pattern: "stripes" },
  { id: "zebra", name: "Zebra", price: 5000, body: "#FFFFFF", trim: "#111111", accent: "#111111", pattern: "camo" },
  { id: "gold", name: "Solid Gold", price: 7500, body: "#F5C542", trim: "#7A4E0A", accent: "#FFF4C2", pattern: "none" },
  { id: "rainbow", name: "Rainbow Dash", price: 10000, body: "#FFFFFF", trim: "#2B2342", accent: "#FF5A5F", pattern: "rainbow" },
];
export const paintOf = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
/** the colours a ride wears with a paint job */
export function colorsOf(v: VehicleSpec, p: Paint) {
  return p.id === "stock" ? { ...v.paint, pattern: "none" as Paint["pattern"] } : { body: p.body, trim: p.trim, accent: p.accent, pattern: p.pattern };
}
