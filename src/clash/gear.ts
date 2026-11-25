// Cube Clash's gear: upgrades bought with coins in the Armory, and the timed power-ups found in ? boxes.
export type UpgradeId = "power" | "rate" | "jet" | "armor" | "cubes" | "magnet";
export const MAX_LEVEL = 8;
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "power", label: "Blaster power", hint: "Hits harder, knocks rivals further and breaks blocks faster" },
  { id: "rate", label: "Fire rate", hint: "Shoots faster" },
  { id: "jet", label: "Jetpack tank", hint: "More oil for the jetpack — longer hovers to save a fall" },
  { id: "armor", label: "Armour", hint: "More health" },
  { id: "cubes", label: "Cube pouch", hint: "Start every stage with more building cubes" },
  { id: "magnet", label: "Coin magnet", hint: "Pulls coins and pickups from further away" },
];
export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { power: 0, rate: 0, jet: 0, armor: 0, cubes: 0, magnet: 0 };
export const upgradeCost = (level: number) => Math.round((120 * Math.pow(1.6, level)) / 10) * 10;

export interface Stats { dmg: number; rate: number; knock: number; oil: number; hp: number; cubes: number; magnet: number; blockDmg: number }
export function statsFor(l: Levels): Stats {
  return {
    dmg: 14 * (1 + 0.14 * l.power), rate: 5 * (1 + 0.07 * l.rate), knock: 6 * (1 + 0.06 * l.power),
    oil: 100 + 30 * l.jet, hp: 100 + 20 * l.armor, cubes: 32 + 8 * l.cubes, magnet: 1.5 + 0.45 * l.magnet,
    blockDmg: 1 + Math.floor(l.power / 3),
  };
}

export type PowerId = "rapid" | "rocket" | "shield" | "magnet" | "speed" | "builder";
export const POWERS: Record<PowerId, { name: string; secs: number; color: string; line: string }> = {
  rapid: { name: "Rapid fire", secs: 9, color: "#FFD23F", line: "Shoot twice as fast" },
  rocket: { name: "Boom blaster", secs: 8, color: "#FF6A2B", line: "Explosive shots with huge knockback" },
  shield: { name: "Bubble shield", secs: 10, color: "#7CF5FF", line: "Nothing can hurt or push you" },
  magnet: { name: "Mega magnet", secs: 12, color: "#3EE08F", line: "Pulls every coin to you" },
  speed: { name: "Speed boots", secs: 10, color: "#FF8AC0", line: "Run and jump further" },
  builder: { name: "Endless cubes", secs: 15, color: "#B98AFF", line: "Build without using cubes" },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];
