import {
  Box, Brain, CarFront, Calculator, Clock, Compass, Crosshair, Flame, Gamepad2, House, Layers, Puzzle, Settings,
  Sparkles, Bookmark, Trophy, UserRound, Users, Zap, Footprints, type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/game-index";

export interface NavItem { href: string; label: string; icon: LucideIcon; color: string }

/** the side menu: main lists, then the categories, then the player's own pages */
export const NAV_MAIN: NavItem[] = [
  { href: "/", label: "Home", icon: House, color: "#FFD25A" },
  { href: "/recent", label: "Recently played", icon: Clock, color: "#B9AEDB" },
  { href: "/new", label: "New games", icon: Sparkles, color: "#7FF0E6" },
  { href: "/top", label: "Top picks", icon: Flame, color: "#FF8A3D" },
  { href: "/c/3d", label: "3D games", icon: Box, color: "#9FB8FF" },
  { href: "/saved", label: "Saved", icon: Bookmark, color: "#FF6F91" },
];

export const CATEGORY_ICON: Record<Category, { icon: LucideIcon; color: string }> = {
  runner: { icon: Footprints, color: "#FF9AC3" },
  adventure: { icon: Compass, color: "#74C94E" },
  racing: { icon: CarFront, color: "#5BB5FF" },
  puzzle: { icon: Puzzle, color: "#9FB8FF" },
  brain: { icon: Brain, color: "#D2A8FF" },
  memory: { icon: Layers, color: "#2EC4B6" },
  focus: { icon: Crosshair, color: "#FF6F91" },
  reflex: { icon: Zap, color: "#FFB37F" },
  numbers: { icon: Calculator, color: "#FFE27F" },
};

export const NAV_ME: NavItem[] = [
  { href: "/games", label: "All games", icon: Gamepad2, color: "#FFD25A" },
  { href: "/characters", label: "Characters", icon: Users, color: "#FF8A3D" },
  { href: "/rewards", label: "Rewards", icon: Trophy, color: "#FFB000" },
  { href: "/profile", label: "My profile", icon: UserRound, color: "#9B5DE5" },
  { href: "/settings", label: "Settings", icon: Settings, color: "#B9AEDB" },
];

export const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/parents", label: "Info for parents" },
  { href: "/help", label: "Help & FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

/** every page, for search */
export const ALL_PAGES = [
  { href: "/", label: "Home", emoji: "🏠", desc: "Top picks, new games and every category" },
  { href: "/games", label: "All games", emoji: "🎮", desc: "Browse every MOMOBLOBS game" },
  { href: "/new", label: "New games", emoji: "✨", desc: "The latest games" },
  { href: "/top", label: "Top picks", emoji: "🔥", desc: "Our best games" },
  { href: "/c/3d", label: "3D games", emoji: "🧊", desc: "Big 3D runners, racers and adventures" },
  { href: "/recent", label: "Recently played", emoji: "🕒", desc: "Jump back into your games" },
  { href: "/saved", label: "Saved games", emoji: "🔖", desc: "Games you saved" },
  { href: "/characters", label: "Characters", emoji: "🟠", desc: "Meet Momo, Kranky, Tiki and friends" },
  { href: "/rewards", label: "Rewards & shop", emoji: "🏆", desc: "Coins, trophies and the daily gift" },
  { href: "/profile", label: "My profile", emoji: "😊", desc: "Name, avatar and stats" },
  { href: "/settings", label: "Settings", emoji: "⚙️", desc: "Sound, graphics and gameplay" },
  { href: "/parents", label: "Info for parents", emoji: "🛡️", desc: "Safety and privacy" },
  { href: "/help", label: "Help & FAQ", emoji: "💬", desc: "Answers to common questions" },
  { href: "/about", label: "About MOMOBLOBS", emoji: "✨", desc: "Our story and channels" },
  { href: "/privacy", label: "Privacy", emoji: "🔒", desc: "What is saved and where" },
  { href: "/terms", label: "Terms", emoji: "📄", desc: "The simple rules" },
];
