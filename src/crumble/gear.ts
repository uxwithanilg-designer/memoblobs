// Crumble Crew's gear: the tools (the Crumble Mallet, the Power Drill, the Paint Sprayer), eight guns to buy (the Zap
// Blaster, a pulse SMG, a scatter gun whose pellets crack brick, the Rocket Tube, a laser cutter that slices through
// steel, a plasma lobber, a vortex minigun and a swarm launcher of homing rockets) carried four at a time, three
// mission guns from gun crates (the Omega Minigun, the Wrecking Cannon that cracks vault steel, the Storm Arc), eight
// kinds of bomb (boom ball, dynamite, sticky, cluster, EMP, fire, gravity and the mega TNT), the gun power that grows
// heist by heist, the suit (armour, boots, the loot bag's magnet and the drill's oil tank), hoodie colours, and the
// security robots' numbers.
import type { BotKind } from "./districts";
import type { ToolId } from "./art/rigs";
export type { ToolId };

export interface ToolSpec {
  id: ToolId; name: string; tagline: string; price: number; color: string;
  /** what it breaks (block hardness), how wide (metres), how hard it hits robots */
  power: number; radius: number; damage: number;
  /** uses (shots) a second */
  rate: number;
  /** guns: the magazine, reload seconds, pellets a shot, spread, bolt speed, and how it fires */
  gun?: { mag: number; reload: number; pellets: number; spread: number; speed: number; mode: "bolt" | "rocket" | "beam" | "orb" | "homing" | "arc"; splash: number };
  /** a mission gun: from a gun crate, no reload, gone when its ammo runs out */
  mission?: boolean;
}
export const TOOLS: ToolSpec[] = [
  { id: "hammer", name: "Crumble Mallet", tagline: "Smashes wood, glass, plaster and brick. Hits robots hard.", price: 0, color: "#FF8A3A", power: 2, radius: 0.8, damage: 38, rate: 2.4 },
  { id: "drill", name: "Power Drill", tagline: "Bores through steel. Burns oil.", price: 1500, color: "#FFD23F", power: 4, radius: 0.6, damage: 70, rate: 8 },
  { id: "paint", name: "Paint Sprayer", tagline: "Leave your colours on Baron Bolt's walls.", price: 300, color: "#FF4A6A", power: 0, radius: 0.5, damage: 0, rate: 10 },
];
export const GUNS: ToolSpec[] = [
  { id: "blaster", name: "Zap Blaster", tagline: "Quick bolts for robots; cracks glass and wood. Never runs dry.", price: 0, color: "#2AB8B0", power: 1, radius: 0.35, damage: 16, rate: 6, gun: { mag: 24, reload: 1, pellets: 1, spread: 0.02, speed: 70, mode: "bolt", splash: 0 } },
  { id: "smg", name: "Pulse SMG", tagline: "A hail of bolts — robots melt, glass shatters.", price: 1200, color: "#7CFF6A", power: 1, radius: 0.3, damage: 11, rate: 12, gun: { mag: 42, reload: 1.3, pellets: 1, spread: 0.04, speed: 80, mode: "bolt", splash: 0 } },
  { id: "scatter", name: "Scatter Gun", tagline: "Seven heavy pellets that crack brick up close.", price: 2600, color: "#FFB23A", power: 2, radius: 0.42, damage: 10, rate: 1.6, gun: { mag: 6, reload: 1.6, pellets: 7, spread: 0.11, speed: 60, mode: "bolt", splash: 0 } },
  { id: "rocket", name: "Rocket Tube", tagline: "Point, fire, boom — walls and robots alike.", price: 5000, color: "#5A7A4A", power: 4, radius: 1.9, damage: 160, rate: 1.1, gun: { mag: 4, reload: 2, pellets: 1, spread: 0.01, speed: 32, mode: "rocket", splash: 1.9 } },
  { id: "laser", name: "Laser Cutter", tagline: "A red beam that slices through steel and burns robots.", price: 9000, color: "#FF3A6A", power: 4, radius: 0.45, damage: 9, rate: 20, gun: { mag: 100, reload: 2.2, pellets: 1, spread: 0, speed: 0, mode: "beam", splash: 0 } },
  { id: "plasma", name: "Plasma Lobber", tagline: "Lobbed green orbs that blast a crater.", price: 14000, color: "#5CF08A", power: 3, radius: 2.3, damage: 130, rate: 1.2, gun: { mag: 6, reload: 2, pellets: 1, spread: 0.01, speed: 22, mode: "orb", splash: 2.3 } },
  { id: "minigun", name: "Vortex Minigun", tagline: "Spins up a storm of bolts that chews through hordes.", price: 20000, color: "#FFD23F", power: 1, radius: 0.3, damage: 10, rate: 18, gun: { mag: 150, reload: 2.6, pellets: 1, spread: 0.05, speed: 85, mode: "bolt", splash: 0 } },
  { id: "swarm", name: "Swarm Launcher", tagline: "Four homing rockets a shot — they find the robots.", price: 28000, color: "#FF8A2A", power: 3, radius: 1.3, damage: 44, rate: 1, gun: { mag: 6, reload: 2.4, pellets: 4, spread: 0.2, speed: 24, mode: "homing", splash: 1.3 } },
];
export const MISSION_GUNS: ToolSpec[] = [
  { id: "omega", name: "Omega Minigun", tagline: "A gold minigun whose rounds crack brick.", price: 0, color: "#FFD23F", power: 2, radius: 0.45, damage: 22, rate: 24, mission: true, gun: { mag: 360, reload: 0, pellets: 1, spread: 0.04, speed: 95, mode: "bolt", splash: 0 } },
  { id: "wrecker", name: "Wrecking Cannon", tagline: "Each shot blasts a crater — even vault steel gives.", price: 0, color: "#FF6A2A", power: 5, radius: 3.2, damage: 320, rate: 1.3, mission: true, gun: { mag: 14, reload: 0, pellets: 1, spread: 0.01, speed: 40, mode: "rocket", splash: 3.2 } },
  { id: "storm", name: "Storm Arc", tagline: "Lightning that jumps from robot to robot.", price: 0, color: "#B48CFF", power: 0, radius: 0, damage: 70, rate: 6, mission: true, gun: { mag: 120, reload: 0, pellets: 1, spread: 0, speed: 0, mode: "arc", splash: 0 } },
];
/** guns you carry (the gun bar holds four, plus a mission gun) */
export const GUN_SLOTS = 4;
export const toolOf = (id: ToolId) => TOOLS.find((t) => t.id === id) ?? GUNS.find((t) => t.id === id) ?? MISSION_GUNS.find((t) => t.id === id) ?? TOOLS[0];
export const isGun = (id: ToolId) => GUNS.some((t) => t.id === id) || MISSION_GUNS.some((t) => t.id === id);
export const MAX_LEVEL = 5;
export function tuned(t: ToolSpec, lv: number): ToolSpec {
  return {
    ...t,
    damage: t.damage * (1 + lv * 0.28),
    radius: t.radius * (1 + lv * (t.id === "hammer" ? 0.1 : 0.06)),
    power: t.id === "hammer" && lv >= 3 ? 3 : t.id === "drill" && lv >= 5 ? 5 : t.id === "rocket" && lv >= 4 ? 5 : t.power,
    rate: t.rate * (1 + lv * (t.id === "hammer" ? 0.08 : 0.04)),
    gun: t.gun ? { ...t.gun, mag: Math.round(t.gun.mag * (1 + lv * 0.08)), reload: t.gun.reload * (1 - lv * 0.06) } : undefined,
  };
}
export const upgradeCost = (t: ToolSpec, lv: number) => Math.round((Math.max(300, t.price) * 0.6 + 200) * Math.pow(lv + 1, 1.55) / 10) * 10;

// ---------------------------------------------------------------- bombs
export type BombId = "ball" | "dynamite" | "sticky" | "cluster" | "emp" | "fire" | "gravity" | "mega";
export interface BombSpec { id: BombId; name: string; tagline: string; color: string; damage: number; radius: number; power: number; fuse: number; pack: number; price: number; max: number }
export const BOMBS: BombSpec[] = [
  { id: "ball", name: "Boom Ball", tagline: "Bounces, then blows a hole in walls and robots.", color: "#3E9A5A", damage: 120, radius: 1.8, power: 3, fuse: 1.7, pack: 3, price: 260, max: 12 },
  { id: "dynamite", name: "Dynamite", tagline: "Sticks where it lands. A huge blast that cracks vault steel.", color: "#D8302A", damage: 230, radius: 2.5, power: 5, fuse: 3, pack: 2, price: 420, max: 9 },
  { id: "sticky", name: "Sticky Bomb", tagline: "Sticks to the first robot or wall it hits.", color: "#5AB8FF", damage: 170, radius: 1.8, power: 3, fuse: 1.4, pack: 3, price: 420, max: 9 },
  { id: "cluster", name: "Cluster Bomb", tagline: "Bursts into six bomblets — a whole wall comes down.", color: "#FF8A2A", damage: 100, radius: 1.6, power: 3, fuse: 1.5, pack: 3, price: 600, max: 9 },
  { id: "emp", name: "EMP Bomb", tagline: "Every robot near it stops dead for four seconds.", color: "#9AF0FF", damage: 40, radius: 9, power: 0, fuse: 1.2, pack: 3, price: 550, max: 9 },
  { id: "fire", name: "Fire Bomb", tagline: "A pool of fire that burns robots — and wood, crates and carpets.", color: "#FF4A2A", damage: 45, radius: 4, power: 1, fuse: 1.3, pack: 3, price: 550, max: 9 },
  { id: "gravity", name: "Gravity Bomb", tagline: "Pulls robots and loot in, then crushes the lot.", color: "#C87CFF", damage: 240, radius: 9, power: 4, fuse: 1.2, pack: 2, price: 800, max: 6 },
  { id: "mega", name: "Mega TNT", tagline: "Crates only. Takes a building's corner clean off.", color: "#FFD23F", damage: 700, radius: 4.8, power: 5, fuse: 2.2, pack: 0, price: 0, max: 3 },
];
export const bombOf = (id: BombId) => BOMBS.find((b) => b.id === id) ?? BOMBS[0];

/** gun power: every hit of yours (mallet, drill, guns, bombs) on a robot hits harder heist by heist — ×1.6 at the first, ×4 by 1200 */
export function gunPower(heist: number) {
  const t = Math.min(1, (heist - 1) / 1199);
  return Math.round((1.6 * (1 + 1.5 * t) + Math.max(0, heist - 1200) * 0.002) * 100) / 100;
}

export type SuitId = "armor" | "boots" | "bag" | "tank";
export const SUIT: { id: SuitId; label: string; hint: string }[] = [
  { id: "armor", label: "Armour", hint: "More health" },
  { id: "boots", label: "Sneakers", hint: "Run faster, jump higher" },
  { id: "bag", label: "Loot Magnet", hint: "Pull loot in from further" },
  { id: "tank", label: "Oil Tank", hint: "Drill for longer" },
];
export const SUIT_MAX = 6;
export const suitCost = (lv: number) => Math.round(300 * Math.pow(lv + 1, 1.6) / 10) * 10;
export const maxHealth = (armor: number) => 100 + armor * 25;
export const runSpeed = (boots: number) => 5.2 + boots * 0.28;
export const magnetR = (bag: number) => 2.2 + bag * 0.6;
export const oilMax = (tank: number) => 30 + tank * 8;

export interface Outfit { id: string; name: string; hoodie: string; price: number }
export const OUTFITS: Outfit[] = [
  { id: "classic", name: "Classic", hoodie: "#FF8A3A", price: 0 },
  { id: "teal", name: "Teal", hoodie: "#2AB8B0", price: 600 },
  { id: "grape", name: "Grape", hoodie: "#8A4AD8", price: 900 },
  { id: "cherry", name: "Cherry", hoodie: "#D8302A", price: 1200 },
  { id: "night", name: "Night", hoodie: "#2A2D3A", price: 2000 },
  { id: "gold", name: "Gold Rush", hoodie: "#E8B030", price: 6000 },
];
export const outfitOf = (id: string) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];

export interface BotSpec { kind: BotKind | "warden"; name: string; hp: number; speed: number; range: number; damage: number; rate: number; burst: number; flying: boolean; melee: boolean; coins: number }
export const BOTS: Record<BotKind | "warden", BotSpec> = {
  guard: { kind: "guard", name: "Guard Bot", hp: 80, speed: 3.2, range: 22, damage: 7, rate: 0.9, burst: 3, flying: false, melee: false, coins: 8 },
  hound: { kind: "hound", name: "Hound Bot", hp: 60, speed: 6.6, range: 1.6, damage: 12, rate: 1.4, burst: 1, flying: false, melee: true, coins: 8 },
  drone: { kind: "drone", name: "Drone", hp: 45, speed: 4.6, range: 22, damage: 5, rate: 1.3, burst: 2, flying: true, melee: false, coins: 8 },
  turret: { kind: "turret", name: "Turret", hp: 140, speed: 0, range: 26, damage: 6, rate: 1.6, burst: 4, flying: false, melee: false, coins: 14 },
  shield: { kind: "shield", name: "Riot Bot", hp: 220, speed: 2.4, range: 16, damage: 9, rate: 0.7, burst: 2, flying: false, melee: false, coins: 18 },
  heavy: { kind: "heavy", name: "Heavy Bot", hp: 300, speed: 2, range: 28, damage: 22, rate: 0.35, burst: 1, flying: false, melee: false, coins: 26 },
  warden: { kind: "warden", name: "Vault Warden", hp: 3200, speed: 1.6, range: 34, damage: 16, rate: 1, burst: 4, flying: false, melee: false, coins: 400 },
};
