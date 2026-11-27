// Obby Bike Blaster's gear: five bikes (each with its own feel and frame colour), the upgrades you buy with coins,
// and the timed power-ups inside ? boxes.
import type { BikeStats } from "./physics";

export type BikeId = "bmx" | "racer" | "hopper" | "trail" | "comet";
export const BIKES: { id: BikeId; name: string; price: number; frame: string; line: string; base: BikeStats }[] = [
  { id: "bmx", name: "Pixel BMX", price: 0, frame: "#3EC5FF", line: "Nimble and easy to handle", base: { speed: 10.5, accel: 7, jump: 7.6, grip: 1, turn: 2.3 } },
  { id: "racer", name: "Street Racer", price: 1800, frame: "#FF5A5A", line: "Top speed for the long leaps", base: { speed: 12.2, accel: 7.4, jump: 7.4, grip: 0.95, turn: 2.1 } },
  { id: "hopper", name: "Hopper", price: 3200, frame: "#9BFF7A", line: "Springy: jumps higher than any other", base: { speed: 10.6, accel: 7.2, jump: 8.6, grip: 1, turn: 2.4 } },
  { id: "trail", name: "Trail Grip", price: 5200, frame: "#FFB627", line: "Fat tyres: holds on ice and belts", base: { speed: 10.8, accel: 8, jump: 7.6, grip: 1.6, turn: 2.6 } },
  { id: "comet", name: "Comet", price: 9000, frame: "#B06CFF", line: "The best of everything", base: { speed: 12.6, accel: 8.4, jump: 8.4, grip: 1.4, turn: 2.6 } },
];
export const bikeOf = (id: BikeId) => BIKES.find((b) => b.id === id) ?? BIKES[0];

export type UpgradeId = "gears" | "legs" | "springs" | "tyres" | "tank" | "blaster";
export const MAX_LEVEL = 8;
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "gears", label: "Gears", hint: "Higher top speed" },
  { id: "legs", label: "Legs", hint: "Pick up speed faster" },
  { id: "springs", label: "Springs", hint: "Jump higher and further" },
  { id: "tyres", label: "Tyres", hint: "More grip and sharper turns" },
  { id: "tank", label: "Oil tank", hint: "Ride longer before the chain dries" },
  { id: "blaster", label: "Blaster", hint: "Shoots faster" },
];
export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { gears: 0, legs: 0, springs: 0, tyres: 0, tank: 0, blaster: 0 };
export const upgradeCost = (level: number) => Math.round((120 * Math.pow(1.6, level)) / 10) * 10;
export function statsFor(bike: BikeId, l: Levels): BikeStats & { oil: number; fireRate: number } {
  const b = bikeOf(bike).base;
  return {
    speed: b.speed * (1 + 0.035 * l.gears), accel: b.accel * (1 + 0.06 * l.legs), jump: b.jump * (1 + 0.02 * l.springs),
    grip: b.grip * (1 + 0.08 * l.tyres), turn: b.turn * (1 + 0.03 * l.tyres), oil: 100 + 25 * l.tank, fireRate: 4 * (1 + 0.1 * l.blaster),
  };
}

export type PowerId = "turbo" | "shield" | "magnet" | "wings" | "slowmo" | "rapid";
export const POWERS: Record<PowerId, { name: string; secs: number; color: string }> = {
  turbo: { name: "Turbo", secs: 7, color: "#FFD23F" },
  shield: { name: "Bubble shield", secs: 20, color: "#7CF5FF" },
  magnet: { name: "Coin magnet", secs: 14, color: "#3EE08F" },
  wings: { name: "Wings: double jump", secs: 16, color: "#FFFFFF" },
  slowmo: { name: "Slow-mo traps", secs: 10, color: "#B98AFF" },
  rapid: { name: "Rapid blaster", secs: 12, color: "#FF6A2B" },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];
