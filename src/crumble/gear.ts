// Crumble Crew's gear: seven tools (each with five upgrade levels), the suit (armour, boots, the loot bag's magnet and
// the drill's oil tank), hoodie colours, and the security robots' numbers.
import type { BotKind } from "./districts";
import type { ToolId } from "./art/rigs";
export type { ToolId };

export interface ToolSpec {
  id: ToolId; name: string; tagline: string; price: number; color: string;
  /** what it breaks (block hardness), how wide (metres), how hard it hits robots */
  power: number; radius: number; damage: number;
  /** uses a second; carried count (0 = unlimited) and how many come in a pack */
  rate: number; ammo: number; pack: number; packPrice: number;
}
export const TOOLS: ToolSpec[] = [
  { id: "hammer", name: "Crumble Mallet", tagline: "Smashes wood, glass, plaster and brick. Hits robots hard.", price: 0, color: "#FF8A3A", power: 2, radius: 0.8, damage: 38, rate: 2.4, ammo: 0, pack: 0, packPrice: 0 },
  { id: "blaster", name: "Zap Blaster", tagline: "Fast bolts for robots; cracks glass and wood.", price: 0, color: "#2AB8B0", power: 1, radius: 0.35, damage: 14, rate: 6, ammo: 0, pack: 0, packPrice: 0 },
  { id: "drill", name: "Power Drill", tagline: "Bores through steel. Burns oil.", price: 1500, color: "#FFD23F", power: 4, radius: 0.6, damage: 70, rate: 8, ammo: 0, pack: 0, packPrice: 0 },
  { id: "grenade", name: "Boom Ball", tagline: "Bounces, then blows a hole in walls and robots.", price: 800, color: "#3E9A5A", power: 3, radius: 1.7, damage: 110, rate: 1.4, ammo: 6, pack: 6, packPrice: 260 },
  { id: "dynamite", name: "Dynamite", tagline: "A long fuse and a huge blast. Cracks vault steel.", price: 0, color: "#D8302A", power: 5, radius: 2.4, damage: 220, rate: 0.8, ammo: 3, pack: 3, packPrice: 520 },
  { id: "rocket", name: "Rocket Tube", tagline: "Point, fire, boom — walls and robots alike.", price: 5000, color: "#5A7A4A", power: 4, radius: 1.9, damage: 160, rate: 1.1, ammo: 4, pack: 4, packPrice: 640 },
  { id: "paint", name: "Paint Sprayer", tagline: "Leave your colours on Baron Bolt's walls.", price: 300, color: "#FF4A6A", power: 0, radius: 0.5, damage: 0, rate: 10, ammo: 0, pack: 0, packPrice: 0 },
];
export const toolOf = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
export const MAX_LEVEL = 5;
export function tuned(t: ToolSpec, lv: number): ToolSpec {
  return {
    ...t,
    damage: t.damage * (1 + lv * 0.28),
    radius: t.radius * (1 + lv * (t.id === "hammer" ? 0.1 : 0.09)),
    power: t.id === "hammer" && lv >= 3 ? 3 : t.id === "drill" && lv >= 5 ? 5 : t.id === "rocket" && lv >= 4 ? 5 : t.power,
    rate: t.rate * (1 + lv * (t.id === "blaster" || t.id === "hammer" ? 0.08 : 0.04)),
  };
}
export const upgradeCost = (t: ToolSpec, lv: number) => Math.round((Math.max(300, t.price) * 0.6 + 200) * Math.pow(lv + 1, 1.55) / 10) * 10;

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
