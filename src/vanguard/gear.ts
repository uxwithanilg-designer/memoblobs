// Voxel Vanguard's armory and the robots. Six blasters (a starter zapper, an automatic pulse rifle, a scatter blaster,
// a piercing rail lance, a rocket tube and a chain-lightning arc caster), each with five upgrade levels; three suit
// upgrades (armour, jetpack tank, boots); six outfits for Ace; and the robot army: seven kinds of robot and three
// bosses, with their health, speed, reach and weapons. Pure data.

import type { BossKind, RobotKind } from "./worlds";

export type WeaponId = "zapper" | "pulse" | "scatter" | "rail" | "boom" | "arc";
export interface WeaponSpec {
  id: WeaponId; name: string; tagline: string; price: number;
  /** damage per hit, shots per second, spread (radians), pellets per shot */
  damage: number; rate: number; spread: number; pellets: number;
  /** projectile speed (m/s), magazine, reload (s), splash radius (m), hits through robots */
  speed: number; mag: number; reload: number; splash: number; pierce: boolean;
  /** hold to fire */
  auto: boolean;
  color: string; glow: string;
  recoil: number;
  range: number;
}
export const WEAPONS: WeaponSpec[] = [
  { id: "zapper", name: "Zapper", tagline: "Ace's trusty blaster: quick, steady, never jams.", price: 0, damage: 14, rate: 5, spread: 0.02, pellets: 1, speed: 70, mag: 18, reload: 1.1, splash: 0, pierce: false, auto: true, color: "#5BE0FF", glow: "#B8F6FF", recoil: 0.15, range: 60 },
  { id: "pulse", name: "Pulse Rifle", tagline: "Fast bursts of hot plasma — melts troopers.", price: 1800, damage: 11, rate: 10, spread: 0.035, pellets: 1, speed: 85, mag: 36, reload: 1.4, splash: 0, pierce: false, auto: true, color: "#7CFF6A", glow: "#D8FFC8", recoil: 0.12, range: 60 },
  { id: "scatter", name: "Scatter Blaster", tagline: "Seven pellets at once. Up close, nothing stands.", price: 3800, damage: 9, rate: 1.8, spread: 0.13, pellets: 7, speed: 65, mag: 6, reload: 1.6, splash: 0, pierce: false, auto: true, color: "#FFB23A", glow: "#FFE2A0", recoil: 0.5, range: 30 },
  { id: "rail", name: "Rail Lance", tagline: "One charged bolt that pierces a whole line of robots.", price: 6500, damage: 70, rate: 1.1, spread: 0.002, pellets: 1, speed: 220, mag: 5, reload: 1.8, splash: 0, pierce: true, auto: true, color: "#FF5AF0", glow: "#FFC8FA", recoil: 0.6, range: 120 },
  { id: "boom", name: "Boom Tube", tagline: "Rockets that blow up whole squads. Mind the splash!", price: 9500, damage: 55, rate: 1.3, spread: 0.01, pellets: 1, speed: 38, mag: 4, reload: 2.0, splash: 3.4, pierce: false, auto: true, color: "#FF6A3A", glow: "#FFC890", recoil: 0.7, range: 70 },
  { id: "arc", name: "Arc Caster", tagline: "Lightning that jumps from robot to robot.", price: 14000, damage: 20, rate: 6, spread: 0.01, pellets: 1, speed: 120, mag: 30, reload: 1.5, splash: 0, pierce: false, auto: true, color: "#B48CFF", glow: "#E8DCFF", recoil: 0.1, range: 40 },
];
export const weaponOf = (id: WeaponId) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
export const MAX_LEVEL = 5;
/** a weapon at an upgrade level: more damage, a bigger magazine, a quicker reload */
export function tunedWeapon(w: WeaponSpec, level: number): WeaponSpec {
  const k = level / MAX_LEVEL;
  return { ...w, damage: w.damage * (1 + 0.6 * k), mag: Math.round(w.mag * (1 + 0.4 * k)), reload: w.reload * (1 - 0.3 * k) };
}
export const weaponUpgradeCost = (w: WeaponSpec, level: number) => Math.round(((300 + w.price * 0.12) * Math.pow(1.7, level)) / 10) * 10;

export type SuitId = "armor" | "jet" | "boots";
export const SUIT: { id: SuitId; label: string; hint: string }[] = [
  { id: "armor", label: "Armour", hint: "More health" },
  { id: "jet", label: "Jetpack", hint: "A bigger oil tank: fly longer" },
  { id: "boots", label: "Boots", hint: "Run faster" },
];
export const suitCost = (level: number) => Math.round((400 * Math.pow(1.75, level)) / 10) * 10;
export const maxHealth = (armor: number) => 100 + armor * 25;
export const jetTank = (jet: number) => 3.2 + jet * 0.7;
export const runSpeed = (boots: number) => 7 * (1 + boots * 0.06);

export type OutfitId = "ranger" | "cobalt" | "crimson" | "ghost" | "gold" | "neon";
export interface Outfit { id: OutfitId; name: string; price: number; suit: string; trim: string; visor: string; pack: string }
export const OUTFITS: Outfit[] = [
  { id: "ranger", name: "Ranger", price: 0, suit: "#3E8A4A", trim: "#FF8A2A", visor: "#5BE0FF", pack: "#5A5E6E" },
  { id: "cobalt", name: "Cobalt", price: 2500, suit: "#2A5AD8", trim: "#F2F2F2", visor: "#FFD23F", pack: "#3A3E52" },
  { id: "crimson", name: "Crimson", price: 4000, suit: "#C8303A", trim: "#2A2A30", visor: "#FFB23A", pack: "#4A2A2A" },
  { id: "ghost", name: "Ghost", price: 6000, suit: "#E8ECF4", trim: "#3A3E52", visor: "#7CFF8A", pack: "#8A90A0" },
  { id: "gold", name: "Gold Star", price: 9000, suit: "#E8B030", trim: "#5A1E1E", visor: "#FF4F7A", pack: "#7A5A20" },
  { id: "neon", name: "Neon", price: 12000, suit: "#20202A", trim: "#FF4FD8", visor: "#5BF0FF", pack: "#14141C" },
];
export const outfitOf = (id: OutfitId) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];

// ---------------------------------------------------------------- the robots
export type FoeKind = RobotKind | BossKind | "tower";
export interface RobotSpec {
  kind: FoeKind;
  name: string;
  hp: number;
  speed: number;
  /** how far it shoots, and how hard */
  range: number; damage: number;
  /** shots per second, shots per burst, projectile speed */
  rate: number; burst: number; shot: number;
  /** size (1 = a trooper) */
  scale: number;
  flying: boolean;
  /** explodes on contact (rollers) */
  kamikaze: boolean;
  /** lobbed shells with a splash (spiders), a charged beam (snipers) */
  mortar: boolean; beam: boolean;
  coins: number;
  boss: boolean;
  /** stands still and calls in robots (the beacons you destroy) */
  spawner: boolean;
}
const R = (o: Partial<RobotSpec> & Pick<RobotSpec, "kind" | "name" | "hp">): RobotSpec => ({
  speed: 3.4, range: 22, damage: 7, rate: 1, burst: 3, shot: 32, scale: 1, flying: false, kamikaze: false, mortar: false, beam: false, coins: 5, boss: false, spawner: false, ...o,
});
export const ROBOTS: Record<FoeKind, RobotSpec> = {
  scout: R({ kind: "scout", name: "Scout", hp: 38, speed: 4.6, range: 18, damage: 5, rate: 0.9, burst: 2, scale: 0.8, coins: 4 }),
  trooper: R({ kind: "trooper", name: "Trooper", hp: 70, speed: 3.4, range: 24, damage: 7, rate: 1, burst: 3, coins: 6 }),
  roller: R({ kind: "roller", name: "Roller", hp: 34, speed: 7.2, range: 1.6, damage: 24, rate: 0, burst: 0, scale: 0.75, kamikaze: true, coins: 5 }),
  drone: R({ kind: "drone", name: "Drone", hp: 42, speed: 5, range: 22, damage: 5, rate: 1.4, burst: 2, scale: 0.8, flying: true, coins: 6 }),
  brute: R({ kind: "brute", name: "Brute", hp: 260, speed: 2.2, range: 20, damage: 13, rate: 0.55, burst: 1, shot: 26, scale: 1.5, coins: 18 }),
  sniper: R({ kind: "sniper", name: "Sniper", hp: 58, speed: 2.6, range: 42, damage: 22, rate: 0.28, burst: 1, shot: 140, beam: true, coins: 10 }),
  spider: R({ kind: "spider", name: "Spider", hp: 110, speed: 3, range: 28, damage: 14, rate: 0.4, burst: 1, shot: 18, scale: 1.1, mortar: true, coins: 12 }),
  titan: R({ kind: "titan", name: "Titan Walker", hp: 2600, speed: 1.6, range: 40, damage: 16, rate: 0.9, burst: 4, shot: 30, scale: 3.4, coins: 220, boss: true }),
  carrier: R({ kind: "carrier", name: "Hive Carrier", hp: 2200, speed: 2.4, range: 40, damage: 10, rate: 1.5, burst: 5, shot: 34, scale: 3.2, flying: true, coins: 220, boss: true }),
  tower: R({ kind: "tower", name: "Robot Beacon", hp: 1100, speed: 0, range: 30, damage: 8, rate: 0.7, burst: 3, shot: 30, scale: 2, coins: 60, spawner: true }),
  overlord: R({ kind: "overlord", name: "Overlord", hp: 3600, speed: 1.8, range: 45, damage: 18, rate: 1.1, burst: 4, shot: 34, scale: 3.8, coins: 320, boss: true }),
};
