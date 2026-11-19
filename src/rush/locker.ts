// Rollo's Locker: cosmetic only, bought with coins from the shared MOMOBLOBS coin jar (docs/ROLLO_RUSH_PLAN.md §10).
// Five slots — armour, scarf, sneakers (and gloves), trail and Curl Ball — each with a free classic and colours to buy.
import type { RolloLook } from "./three/rollo";

export type Slot = "armour" | "scarf" | "shoes" | "trail" | "ball";
export interface LockerItem { id: string; slot: Slot; name: string; price: number; swatch: string; look?: Partial<RolloLook>; color?: string }
export const SLOTS: { id: Slot; name: string; emoji: string }[] = [
  { id: "armour", name: "Armour", emoji: "🛡️" },
  { id: "scarf", name: "Scarf", emoji: "🧣" },
  { id: "shoes", name: "Sneakers", emoji: "👟" },
  { id: "trail", name: "Trail", emoji: "✨" },
  { id: "ball", name: "Curl Ball", emoji: "🔵" },
];
export const ITEMS: LockerItem[] = [
  // armour
  { id: "ar-gold", slot: "armour", name: "Classic Gold", price: 0, swatch: "#E8B04A", look: {} },
  { id: "ar-rose", slot: "armour", name: "Rose Gold", price: 120, swatch: "#F2A0A8", look: { gold: "#F2A0A8", goldDk: "#C0607A" } },
  { id: "ar-silver", slot: "armour", name: "Moon Silver", price: 150, swatch: "#D8E0EC", look: { gold: "#D8E0EC", goldDk: "#8A98B0" } },
  { id: "ar-jade", slot: "armour", name: "Jade", price: 150, swatch: "#6FD8A0", look: { gold: "#6FD8A0", goldDk: "#2E8A62" } },
  { id: "ar-ruby", slot: "armour", name: "Ruby", price: 180, swatch: "#E85A6A", look: { gold: "#E85A6A", goldDk: "#9A2436" } },
  { id: "ar-night", slot: "armour", name: "Midnight", price: 220, swatch: "#5A6AD8", look: { gold: "#5A6AD8", goldDk: "#2A3488" } },
  { id: "ar-sunset", slot: "armour", name: "Sunset", price: 200, swatch: "#FFA858", look: { gold: "#FFA858", goldDk: "#C85A26" } },
  { id: "ar-frost", slot: "armour", name: "Frost", price: 260, swatch: "#A8E8FF", look: { gold: "#A8E8FF", goldDk: "#4A9AC8" } },
  // scarf
  { id: "sc-coral", slot: "scarf", name: "Coral", price: 0, swatch: "#FF6B6B", look: {} },
  { id: "sc-sky", slot: "scarf", name: "Sky", price: 60, swatch: "#6FC2FF", look: { coral: "#6FC2FF" } },
  { id: "sc-sunny", slot: "scarf", name: "Sunny", price: 60, swatch: "#FFD15A", look: { coral: "#FFD15A" } },
  { id: "sc-lime", slot: "scarf", name: "Lime", price: 80, swatch: "#A8F060", look: { coral: "#A8F060" } },
  { id: "sc-violet", slot: "scarf", name: "Violet", price: 80, swatch: "#B88CFF", look: { coral: "#B88CFF" } },
  { id: "sc-snow", slot: "scarf", name: "Snow", price: 100, swatch: "#F4F6FF", look: { coral: "#F4F6FF" } },
  { id: "sc-ink", slot: "scarf", name: "Ink", price: 100, swatch: "#2E2E48", look: { coral: "#2E2E48" } },
  // sneakers and gloves
  { id: "sh-mint", slot: "shoes", name: "Mint", price: 0, swatch: "#3FE8C0", look: {} },
  { id: "sh-blue", slot: "shoes", name: "Ocean", price: 80, swatch: "#4A9CFF", look: { mint: "#4A9CFF", mintDk: "#2A5EC0" } },
  { id: "sh-pink", slot: "shoes", name: "Bubblegum", price: 80, swatch: "#FF7AC8", look: { mint: "#FF7AC8", mintDk: "#C04A8A" } },
  { id: "sh-flame", slot: "shoes", name: "Flame", price: 100, swatch: "#FF7A3A", look: { mint: "#FF7A3A", mintDk: "#C04A1A" } },
  { id: "sh-grape", slot: "shoes", name: "Grape", price: 100, swatch: "#9A6AFF", look: { mint: "#9A6AFF", mintDk: "#5A3AC0" } },
  { id: "sh-lemon", slot: "shoes", name: "Lemon", price: 120, swatch: "#F2E04A", look: { mint: "#F2E04A", mintDk: "#B0A020" } },
  // trails
  { id: "tr-mint", slot: "trail", name: "Mint Glow", price: 0, swatch: "#3FE8C0", color: "#3FE8C0" },
  { id: "tr-gold", slot: "trail", name: "Gold Dust", price: 90, swatch: "#FFD06A", color: "#FFD06A" },
  { id: "tr-pink", slot: "trail", name: "Pink Comet", price: 90, swatch: "#FF7AC8", color: "#FF7AC8" },
  { id: "tr-sky", slot: "trail", name: "Sky Streak", price: 90, swatch: "#6FC2FF", color: "#6FC2FF" },
  { id: "tr-fire", slot: "trail", name: "Fire Trail", price: 140, swatch: "#FF6A2A", color: "#FF6A2A" },
  { id: "tr-violet", slot: "trail", name: "Magic Violet", price: 140, swatch: "#B88CFF", color: "#B88CFF" },
  { id: "tr-moon", slot: "trail", name: "Moonbeam", price: 180, swatch: "#F4F0FF", color: "#F4F0FF" },
  // Curl Ball
  { id: "bl-mint", slot: "ball", name: "Mint", price: 0, swatch: "#2FD6B0", color: "#2FD6B0" },
  { id: "bl-gold", slot: "ball", name: "Sun Ball", price: 110, swatch: "#FFC24A", color: "#FFC24A" },
  { id: "bl-pink", slot: "ball", name: "Candy Ball", price: 110, swatch: "#FF6FB8", color: "#FF6FB8" },
  { id: "bl-blue", slot: "ball", name: "Wave Ball", price: 110, swatch: "#4AA8FF", color: "#4AA8FF" },
  { id: "bl-fire", slot: "ball", name: "Fire Ball", price: 160, swatch: "#FF5A2A", color: "#FF5A2A" },
  { id: "bl-star", slot: "ball", name: "Star Ball", price: 200, swatch: "#E8E0FF", color: "#E8E0FF" },
];
export const ITEM: Record<string, LockerItem> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const FREE = ITEMS.filter((i) => i.price === 0).map((i) => i.id);
export const DEFAULT_WEAR: Record<Slot, string> = { armour: "ar-gold", scarf: "sc-coral", shoes: "sh-mint", trail: "tr-mint", ball: "bl-mint" };

/** what Rollo wears: his look, his trail colour and his Curl Ball colour */
export function outfit(wear: Partial<Record<Slot, string>>) {
  const w = { ...DEFAULT_WEAR, ...wear };
  const look: Partial<RolloLook> = { ...ITEM[w.armour]?.look, ...ITEM[w.scarf]?.look, ...ITEM[w.shoes]?.look };
  const trail = ITEM[w.trail]?.color ?? "#3FE8C0", ball = ITEM[w.ball]?.color ?? "#2FD6B0";
  return { look: { ...look, ball }, trail, ball };
}
