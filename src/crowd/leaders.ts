// Blob Brigade meta: the 11 leaders (a passive + a POWER), the upgrade shop and the power-up tiles.
import type { LeaderId, PowerUp } from "./types";

export interface LeaderDef {
  id: LeaderId; name: string; img: string; color: string;
  passive: string; powerName: string; power: string;
  /** total stars needed (0 = free) */
  unlock: number;
  /** seconds for the POWER button to fill */
  charge: number;
}

export const LEADERS: LeaderDef[] = [
  { id: "momo", name: "Momo", img: "/brand/momo-cheer.webp", color: "#FF8A3D", unlock: 0, charge: 14, passive: "Balanced: bubbles hit 10% harder", powerName: "Cheer Wave", power: "Pushes every close Grumpy far back" },
  { id: "pip", name: "Pip", img: "/brand/chars/pip-happy.webp", color: "#3D8BFF", unlock: 0, charge: 15, passive: "Snowball bubbles slow Grumpies down", powerName: "Big Freeze", power: "Freezes every Grumpy and the villain for 3 s" },
  { id: "gloop", name: "Gloop", img: "/brand/chars/gloop-happy.webp", color: "#5FB52A", unlock: 0, charge: 16, passive: "Starts with +3 and grows a free blob every 4 s", powerName: "Split!", power: "Your brigade grows by a third" },
  { id: "bolt", name: "Bolt", img: "/brand/chars/bolt-happy.webp", color: "#2EC4B6", unlock: 15, charge: 14, passive: "Fires 25% faster", powerName: "Overdrive", power: "Fires 2.5× faster for 5 s" },
  { id: "bonbon", name: "Bonbon", img: "/brand/chars/bonbon-happy.webp", color: "#FF6F91", unlock: 30, charge: 15, passive: "A cake bomb lands on the march every 5 s", powerName: "Cake Rain", power: "Six cake bombs on the biggest crowds" },
  { id: "hoot", name: "Prof. Hoot", img: "/brand/chars/hoot-happy.webp", color: "#9A6B45", unlock: 45, charge: 16, passive: "Villain attacks fall 30% slower", powerName: "Slow-mo", power: "Grumpies and villains move at 40% for 4 s" },
  { id: "turbo", name: "Turbo", img: "/brand/chars/turbo-happy.webp", color: "#FFB000", unlock: 60, charge: 15, passive: "Moves twice as fast", powerName: "Rocket Shield", power: "Nothing can take your blobs for 3 s" },
  { id: "zib", name: "Zib", img: "/brand/chars/zib-happy.webp", color: "#8E5BE8", unlock: 80, charge: 16, passive: "Grabs tiles from further away", powerName: "UFO Beam", power: "A laser beam blasts straight ahead for 3 s" },
  { id: "noodle", name: "Noodle", img: "/brand/chars/noodle-happy.webp", color: "#D49452", unlock: 100, charge: 15, passive: "Wide formation: covers more columns", powerName: "Tail Sweep", power: "Pops every Grumpy close to you" },
  { id: "tiki", name: "Tiki", img: "/brand/tiki.webp", color: "#1E9C91", unlock: 125, charge: 14, passive: "Good gates count 50% more", powerName: "Pep Rally", power: "Your brigade grows by a fifth" },
  { id: "kranky", name: "Kranky", img: "/brand/kranky.webp", color: "#E8504F", unlock: 150, charge: 15, passive: "Collects double coins", powerName: "Claw Snap", power: "Snips 12% off the villain's HP" },
];
export const leaderOf = (id: LeaderId) => LEADERS.find((l) => l.id === id) ?? LEADERS[0];

export type UpgradeId = "start" | "fire" | "power" | "charge" | "coins";
export interface UpgradeDef { id: UpgradeId; name: string; icon: string; max: number; per: string; value: (lvl: number) => string }
export const UPGRADES: UpgradeDef[] = [
  { id: "start", name: "Starting Brigade", icon: "🫧", max: 10, per: "+2 blobs at the start", value: (l) => `+${l * 2} blobs` },
  { id: "fire", name: "Fire Rate", icon: "⚡", max: 10, per: "+4% faster bubbles", value: (l) => `+${l * 4}%` },
  { id: "power", name: "Bubble Power", icon: "💥", max: 10, per: "+6% bubble damage", value: (l) => `+${l * 6}%` },
  { id: "charge", name: "Power Charge", icon: "🔋", max: 10, per: "POWER fills 6% faster", value: (l) => `+${l * 6}%` },
  { id: "coins", name: "Coin Bonus", icon: "🪙", max: 10, per: "+8% coins", value: (l) => `+${l * 8}%` },
];
export const upgradeCost = (lvl: number) => Math.round((50 * 1.35 ** lvl) / 5) * 5;

export type Upgrades = Record<UpgradeId, number>;
export const NO_UPGRADES: Upgrades = { start: 0, fire: 0, power: 0, charge: 0, coins: 0 };
export interface Loadout { leader: LeaderId; up: Upgrades }
export const DEFAULT_LOADOUT: Loadout = { leader: "momo", up: { ...NO_UPGRADES } };

export const POWERUPS: Record<PowerUp, { name: string; icon: string; color: string }> = {
  beam: { name: "RAINBOW BEAM!", icon: "🌈", color: "#B26BFF" },
  freeze: { name: "FREEZE!", icon: "❄️", color: "#7CE0FF" },
  magnet: { name: "MAGNET!", icon: "🧲", color: "#FF5F7E" },
  bomb: { name: "BUBBLE BOMB!", icon: "💣", color: "#2B1D52" },
  wall: { name: "PILLOW WALL!", icon: "🛡️", color: "#FFD23F" },
  double: { name: "DOUBLE UP!", icon: "✖️", color: "#2FCB8B" },
  // bubble powers (from World 3): more bubbles, faster bubbles, bigger bubbles
  triple: { name: "TRIPLE SHOT!", icon: "🔱", color: "#2E8BFF" },
  rapid: { name: "RAPID FIRE!", icon: "⚡", color: "#FF9F1C" },
  mega: { name: "MEGA BUBBLES!", icon: "💥", color: "#FF4FA3" },
};

// ------------------------------------------------------------------ wardrobe: hats and bubble colours
export type HatId = "none" | "party" | "flower" | "cowboy" | "pirate" | "wizard" | "santa" | "propeller" | "viking" | "chef" | "crown";
export type BubbleId = "blue" | "pink" | "green" | "gold" | "rainbow";
export interface Progress { stars: number; starsBy: Record<string, number>; remixBest: number; bestStreak: number; rushCleared: boolean }
export interface CosmeticDef<T extends string> { id: T; name: string; icon: string; how: string; open: (p: Progress) => boolean }

export const HATS: CosmeticDef<HatId>[] = [
  { id: "none", name: "No hat", icon: "🚫", how: "", open: () => true },
  { id: "party", name: "Party Hat", icon: "🎉", how: "", open: () => true },
  { id: "flower", name: "Flower Crown", icon: "🌼", how: "Earn 30 stars", open: (p) => p.stars >= 30 },
  { id: "cowboy", name: "Cowboy Hat", icon: "🤠", how: "Earn 100 stars", open: (p) => p.stars >= 100 },
  { id: "pirate", name: "Pirate Hat", icon: "🏴‍☠️", how: "Beat Captain Kranky's Boat", open: (p) => (p.starsBy["beach-10"] ?? 0) > 0 },
  { id: "wizard", name: "Wizard Hat", icon: "🧙", how: "Beat the Grumpy Ghost", open: (p) => (p.starsBy["spooky-10"] ?? 0) > 0 },
  { id: "santa", name: "Santa Hat", icon: "🎅", how: "Play the Daily Challenge 3 days in a row", open: (p) => p.bestStreak >= 3 },
  { id: "propeller", name: "Propeller Cap", icon: "🌀", how: "Daily Challenge streak of 7", open: (p) => p.bestStreak >= 7 },
  { id: "viking", name: "Viking Helmet", icon: "⚔️", how: "Finish the first Remix loop (stage 110)", open: (p) => p.remixBest >= 110 },
  { id: "chef", name: "Chef Hat", icon: "👨‍🍳", how: "Reach Remix stage 130", open: (p) => p.remixBest >= 130 },
  { id: "crown", name: "Royal Crown", icon: "👑", how: "Beat all 15 villains in Boss Rush", open: (p) => p.rushCleared },
];
export const BUBBLES: CosmeticDef<BubbleId>[] = [
  { id: "blue", name: "Sky Bubbles", icon: "🔵", how: "", open: () => true },
  { id: "pink", name: "Bubblegum", icon: "🩷", how: "Earn 60 stars", open: (p) => p.stars >= 60 },
  { id: "green", name: "Slime Bubbles", icon: "🟢", how: "Daily Challenge streak of 5", open: (p) => p.bestStreak >= 5 },
  { id: "gold", name: "Gold Bubbles", icon: "🟡", how: "Reach Remix stage 120", open: (p) => p.remixBest >= 120 },
  { id: "rainbow", name: "Rainbow Bubbles", icon: "🌈", how: "All 300 stars or Remix stage 150", open: (p) => p.stars >= 300 || p.remixBest >= 150 },
];
export interface Look { hat: HatId; bubble: BubbleId }
export const DEFAULT_LOOK: Look = { hat: "party", bubble: "blue" };
