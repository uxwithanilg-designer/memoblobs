// The Rain Blaster's ammo, Storm Bombs and the Blaster Shop (Rain Raid, docs/PUDDO_RAIN_RAID_PLAN.md §3).
import type { Weapon } from "./types";

export interface WeaponDef {
  name: string; short: string; color: string;
  /** shots a second */
  rate: number; dmg: number; speed: number; range: number;
  /** angles (radians) of the pellets in one shot */
  angles: number[];
  /** how many enemies a pellet passes through */
  pierce: number;
  /** extra enemies each hit jumps to */
  chain: number;
  home: boolean;
  /** pellet size */
  r: number;
}

export const WEAPONS: Record<Weapon, WeaponDef> = {
  drizzle: { name: "Drizzle", short: "DRIZZLE", color: "#7FD8FF", rate: 6, dmg: 1, speed: 19, range: 14, angles: [0], pierce: 0, chain: 0, home: false, r: 0.17 },
  sprinkler: { name: "Sprinkler", short: "SPRINKLER", color: "#5FE0C8", rate: 5, dmg: 1, speed: 18, range: 12, angles: [-0.24, 0, 0.24], pierce: 0, chain: 0, home: false, r: 0.16 },
  downpour: { name: "Downpour", short: "DOWNPOUR", color: "#3DA8FF", rate: 12, dmg: 1, speed: 21, range: 14, angles: [0], pierce: 0, chain: 0, home: false, r: 0.15 },
  hailstone: { name: "Hailstone", short: "HAILSTONE", color: "#E8F6FF", rate: 5, dmg: 2, speed: 22, range: 16, angles: [0], pierce: 3, chain: 0, home: false, r: 0.2 },
  thunder: { name: "Thunder", short: "THUNDER", color: "#FFE14A", rate: 6, dmg: 1, speed: 20, range: 13, angles: [0], pierce: 0, chain: 3, home: false, r: 0.17 },
  rainbow: { name: "Rainbow", short: "RAINBOW", color: "#FF8FE0", rate: 6, dmg: 1, speed: 15, range: 15, angles: [0], pierce: 0, chain: 0, home: true, r: 0.17 },
  geyser: { name: "Geyser", short: "GEYSER", color: "#9FE6FF", rate: 2.6, dmg: 2, speed: 17, range: 5.5, angles: [-0.3, -0.1, 0.1, 0.3], pierce: 1, chain: 0, home: false, r: 0.26 },
};

/** which pickups can turn up by zone (the rest arrive as you go) */
export const WEAPONS_BY_ZONE: Weapon[][] = [
  ["sprinkler", "downpour"],
  ["sprinkler", "downpour", "hailstone"],
  ["sprinkler", "downpour", "hailstone", "thunder"],
  ["sprinkler", "downpour", "hailstone", "thunder", "rainbow", "geyser"],
];
export const weaponsFor = (zone: number): Weapon[] => WEAPONS_BY_ZONE[Math.min(WEAPONS_BY_ZONE.length - 1, Math.max(0, zone - 1))];

/** Storm Bombs: a thundercloud in a clay pot */
export const BOMB = { r: 2.8, dmg: 7, bossDmg: 9, speed: 7.5, up: 8.5, grav: 24, fuse: 1.5 };
export const START_BOMBS = 3;

/** coins needed to combo-multiply: ×1 … ×5 */
export const comboMult = (n: number) => Math.min(5, 1 + Math.floor(n / 4));

// ------------------------------------------------------------------ the Blaster Shop (permanent, paid with site coins)
export type UpgradeId = "rate" | "dmg" | "bombs" | "hearts" | "magnet";
export interface UpgradeDef { id: UpgradeId; name: string; icon: string; what: string; prices: number[] }
export const UPGRADES: UpgradeDef[] = [
  { id: "rate", name: "Fire rate", icon: "💦", what: "+8% shots a second per level", prices: [300, 700, 1400, 2600, 4500] },
  { id: "dmg", name: "Pellet power", icon: "💧", what: "+12% damage per level", prices: [400, 900, 1800, 3200, 5000] },
  { id: "bombs", name: "Bomb bag", icon: "💣", what: "Carry one more Storm Bomb (5 → 9)", prices: [350, 900, 1800, 3500] },
  { id: "hearts", name: "Big heart", icon: "❤️", what: "One more heart (3 → 6)", prices: [600, 1600, 3600] },
  { id: "magnet", name: "Coin magnet", icon: "🧲", what: "Pull dropped coins from further away", prices: [250, 800, 2000] },
];
export interface Upgrades { rate: number; dmg: number; bombs: number; hearts: number; magnet: number }
export const NO_UPGRADES: Upgrades = { rate: 0, dmg: 0, bombs: 0, hearts: 0, magnet: 0 };
export const upgradeEffects = (u: Upgrades) => ({
  fireMul: 1 + u.rate * 0.08, dmgMul: 1 + u.dmg * 0.12, maxBombs: 5 + u.bombs, hearts: 3 + u.hearts, magnet: 2.6 + u.magnet * 1.6,
});
