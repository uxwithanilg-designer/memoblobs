// Blockstorm's gear: the blaster and suit upgrades you buy with coins, and the timed power-ups you find in ? boxes.
export type UpgradeId = "power" | "rate" | "tank" | "armor" | "magnet";
export const MAX_LEVEL = 8;
export const UPGRADES: { id: UpgradeId; label: string; hint: string }[] = [
  { id: "power", label: "Blaster power", hint: "Hits harder — and breaks blocks faster" },
  { id: "rate", label: "Fire rate", hint: "Shoots faster" },
  { id: "tank", label: "Oil tank", hint: "More shots before you need oil" },
  { id: "armor", label: "Armour", hint: "More health" },
  { id: "magnet", label: "Coin magnet", hint: "Pulls coins and pickups from further away" },
];
export type Levels = Record<UpgradeId, number>;
export const NO_UPGRADES: Levels = { power: 0, rate: 0, tank: 0, armor: 0, magnet: 0 };
export const upgradeCost = (level: number) => Math.round((140 * Math.pow(1.62, level)) / 10) * 10;

export interface Stats { dmg: number; rate: number; oil: number; hp: number; magnet: number; blockDmg: number }
export function statsFor(l: Levels): Stats {
  return {
    dmg: 12 * (1 + 0.15 * l.power),
    rate: 5.5 * (1 + 0.07 * l.rate),
    oil: 100 + 30 * l.tank,
    hp: 100 + 20 * l.armor,
    magnet: 1.5 + 0.45 * l.magnet,
    blockDmg: 1 + Math.floor(l.power / 3),
  };
}

export type PowerId = "rapid" | "triple" | "rocket" | "shield" | "magnet" | "ally";
export const POWERS: Record<PowerId, { name: string; secs: number; color: string; line: string }> = {
  rapid: { name: "Rapid fire", secs: 9, color: "#FFD23F", line: "Shoot twice as fast — no oil used" },
  triple: { name: "Triple shot", secs: 10, color: "#FF7AB6", line: "Three bolts at once" },
  rocket: { name: "Rocket blaster", secs: 8, color: "#FF6A2B", line: "Explosive shots that blow blocks apart" },
  shield: { name: "Shield", secs: 10, color: "#7CF5FF", line: "Nothing can hurt you" },
  magnet: { name: "Mega magnet", secs: 12, color: "#3EE08F", line: "Pulls every coin to you" },
  ally: { name: "Call a friend", secs: 40, color: "#B98AFF", line: "A friend jumps in to fight beside you" },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];
