// The boats of Wake Racers, from the little runabout you start with to the neon hover racer. Each has its own feel
// (top speed, pick-up, turning, grip on the water, nitro, fuel tank, jump) and its own engine voice, and every one can
// be tuned three ways (engine, handling, nitro) five steps each. The rivals drive the same boats, with clay pilots of
// their own. Pure data: the 3D models are built in render/boat-model.ts.
import type { EngineVoice } from "@/racing/types";

export type BoatId = "minnow" | "zip" | "cat" | "dart" | "hover" | "tug" | "offshore" | "bolt" | "foil" | "comet";
export type Upgrade = "engine" | "handling" | "nitro";
export const UPGRADES: Upgrade[] = ["engine", "handling", "nitro"];
export const MAX_LEVEL = 5;

export interface BoatSpec {
  id: BoatId;
  name: string;
  cls: string;
  blurb: string;
  price: number;
  /** top speed (m/s), pick-up (m/s²), turn rate (rad/s), lateral grip (1/s), extra top speed on nitro (m/s) */
  top: number; accel: number; turn: number; grip: number; boost: number;
  /** fuel tank (seconds at full throttle), jump (m/s up), mass (bumps) */
  tank: number; jump: number; mass: number;
  /** hull length and radius for collisions */
  len: number; rad: number;
  livery: { hull: string; deck: string; stripe: string; trim: string };
  voice: EngineVoice;
}

export const BOATS: BoatSpec[] = [
  { id: "minnow", name: "Minnow", cls: "Runabout", blurb: "A friendly all-rounder. Easy to steer, quick to love.", price: 0,
    top: 30, accel: 9, turn: 1.9, grip: 3.4, boost: 10, tank: 46, jump: 7.4, mass: 1, len: 4.6, rad: 1.25,
    livery: { hull: "#FFFFFF", deck: "#FF5A5F", stripe: "#1F7AE0", trim: "#FFC233" }, voice: { idle: 900, redline: 6400, gears: 4, tone: "small" } },
  { id: "zip", name: "Zippy", cls: "Jet Ski", blurb: "Tiny and twitchy. Leaps off the line and turns on a coin.", price: 1500,
    top: 29.5, accel: 12, turn: 2.5, grip: 3.8, boost: 10.5, tank: 40, jump: 7.8, mass: 0.7, len: 3.2, rad: 1,
    livery: { hull: "#FFD23F", deck: "#1A1A2E", stripe: "#FF4F7A", trim: "#36E3FF" }, voice: { idle: 1400, redline: 9500, gears: 4, tone: "scooter" } },
  { id: "cat", name: "Twin Tide", cls: "Catamaran", blurb: "Two hulls, rock steady. Grips the water like a rail.", price: 3200,
    top: 32, accel: 9.5, turn: 2.1, grip: 4.6, boost: 10.5, tank: 50, jump: 7, mass: 1.2, len: 5.2, rad: 1.5,
    livery: { hull: "#36E3FF", deck: "#FFFFFF", stripe: "#0B4F8A", trim: "#FF8A3D" }, voice: { idle: 800, redline: 6800, gears: 5, tone: "v6" } },
  { id: "dart", name: "Dart", cls: "Hydroplane", blurb: "Skims on its tips. Blistering top speed, wide turns.", price: 5200,
    top: 36, accel: 9.2, turn: 1.7, grip: 2.7, boost: 11, tank: 44, jump: 7.2, mass: 0.9, len: 5.6, rad: 1.3,
    livery: { hull: "#FF3B5C", deck: "#FFFFFF", stripe: "#FFC233", trim: "#1A1A2E" }, voice: { idle: 1100, redline: 9000, gears: 5, tone: "v12" } },
  { id: "hover", name: "Puffer", cls: "Hovercraft", blurb: "Floats on air. Slides like soap and jumps sky high.", price: 7500,
    top: 33, accel: 10.5, turn: 2.3, grip: 1.9, boost: 11, tank: 46, jump: 9, mass: 0.9, len: 4.8, rad: 1.45,
    livery: { hull: "#9B7BFF", deck: "#FFE066", stripe: "#FFFFFF", trim: "#3A2A6A" }, voice: { idle: 1200, redline: 7600, gears: 4, tone: "kart" } },
  { id: "tug", name: "Chug", cls: "Tugboat", blurb: "Heavy and stubborn. Bumps rivals aside, shrugs off knocks.", price: 9000,
    top: 31, accel: 8.4, turn: 1.85, grip: 4.2, boost: 10, tank: 60, jump: 6.6, mass: 2.2, len: 5, rad: 1.6,
    livery: { hull: "#2E6E4A", deck: "#F4E3C1", stripe: "#E03A3A", trim: "#FFC233" }, voice: { idle: 600, redline: 4200, gears: 4, tone: "diesel" } },
  { id: "offshore", name: "Thunder", cls: "Offshore", blurb: "A long-nosed sea racer that loves big straights.", price: 12500,
    top: 38, accel: 10, turn: 1.8, grip: 3.1, boost: 11.5, tank: 52, jump: 7.2, mass: 1.3, len: 6.4, rad: 1.4,
    livery: { hull: "#1A1A2E", deck: "#FF7A1A", stripe: "#FFFFFF", trim: "#FF7A1A" }, voice: { idle: 800, redline: 6500, gears: 5, tone: "v8" } },
  { id: "bolt", name: "Bolt", cls: "Twin V", blurb: "Twin engines, twin grins. Hard to beat out of a turn.", price: 16000,
    top: 39, accel: 11.2, turn: 2, grip: 3.3, boost: 12, tank: 50, jump: 7.4, mass: 1.2, len: 5.8, rad: 1.4,
    livery: { hull: "#FFFFFF", deck: "#1FB85A", stripe: "#0B3D2A", trim: "#C8FF4A" }, voice: { idle: 950, redline: 7800, gears: 6, tone: "rotary" } },
  { id: "foil", name: "Glider", cls: "Hydrofoil", blurb: "Rises on wings at speed and flies over the chop.", price: 21000,
    top: 41, accel: 10.6, turn: 2.2, grip: 3.5, boost: 12.5, tank: 48, jump: 8.6, mass: 1, len: 5.4, rad: 1.35,
    livery: { hull: "#F4F7FB", deck: "#2E9BFF", stripe: "#FF3DCB", trim: "#2E9BFF" }, voice: { idle: 1000, redline: 8600, gears: 6, tone: "inline4" } },
  { id: "comet", name: "Comet", cls: "Hover Racer", blurb: "The future of water racing. Glows, hums and flies.", price: 30000,
    top: 43, accel: 12, turn: 2.4, grip: 3.7, boost: 14, tank: 50, jump: 8.4, mass: 1, len: 5.4, rad: 1.4,
    livery: { hull: "#12122A", deck: "#36E3FF", stripe: "#FF3DCB", trim: "#36E3FF" }, voice: { idle: 1500, redline: 10000, gears: 6, tone: "electric" } },
];
export const BOAT_BY_ID = Object.fromEntries(BOATS.map((b) => [b.id, b])) as Record<BoatId, BoatSpec>;
export const boatOf = (id: BoatId) => BOAT_BY_ID[id] ?? BOATS[0];

/** a boat with its upgrades applied */
export interface Tuned extends BoatSpec { meterGain: number; levels: Record<Upgrade, number> }
export function tuned(id: BoatId, levels: Partial<Record<Upgrade, number>> = {}): Tuned {
  const b = boatOf(id);
  const e = levels.engine ?? 0, h = levels.handling ?? 0, n = levels.nitro ?? 0;
  return {
    ...b,
    top: b.top + e * 0.9, accel: b.accel + e * 0.45,
    turn: b.turn + h * 0.07, grip: b.grip + h * 0.22,
    boost: b.boost + n * 0.9, meterGain: 1 + n * 0.1,
    levels: { engine: e, handling: h, nitro: n },
  };
}
export const upgradeCost = (id: BoatId, level: number) => Math.round((260 + 180 * BOATS.findIndex((b) => b.id === id)) * (level + 1) * (1 + level * 0.35) / 10) * 10;

/** paint jobs (the hull and stripe colours), bought once and worn on any boat */
export interface Paint { id: string; name: string; hull: string; stripe: string; deck?: string; price: number }
export const PAINTS: Paint[] = [
  { id: "stock", name: "Factory", hull: "", stripe: "", price: 0 },
  { id: "sunset", name: "Sunset", hull: "#FF7A3D", stripe: "#FFE066", deck: "#7A2A6A", price: 400 },
  { id: "mint", name: "Mint", hull: "#7FF0C8", stripe: "#0B6E5A", deck: "#FFFFFF", price: 400 },
  { id: "royal", name: "Royal", hull: "#2A3A9A", stripe: "#FFC233", deck: "#F4E3C1", price: 600 },
  { id: "bubblegum", name: "Bubblegum", hull: "#FF8FC3", stripe: "#FFFFFF", deck: "#7A4AD8", price: 600 },
  { id: "carbon", name: "Carbon", hull: "#22242E", stripe: "#FF3B3B", deck: "#3A3C48", price: 900 },
  { id: "lime", name: "Lime Zest", hull: "#C8FF4A", stripe: "#1A1A2E", deck: "#2A2A3E", price: 900 },
  { id: "gold", name: "Gold Rush", hull: "#FFC233", stripe: "#8A5A00", deck: "#1A1A2E", price: 1500 },
  { id: "aurora", name: "Aurora", hull: "#36E3FF", stripe: "#B98CFF", deck: "#0A1A3A", price: 1500 },
];
export const paintOf = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
export function liveryOf(b: BoatSpec, paint: string) {
  const p = paintOf(paint);
  return p.id === "stock" ? b.livery : { hull: p.hull, deck: p.deck ?? b.livery.deck, stripe: p.stripe, trim: b.livery.trim };
}

/** the clay pilots: you, and the rivals you meet on the water */
export interface Pilot { name: string; skin: string; helmet: string }
export const PLAYER_PILOT: Pilot = { name: "You", skin: "#FFB37A", helmet: "#FFFFFF" };
export const RIVALS: Pilot[] = [
  { name: "Bubba", skin: "#8FD16A", helmet: "#FF5A5F" }, { name: "Kiki", skin: "#FF9EC4", helmet: "#FFFFFF" },
  { name: "Nori", skin: "#6AD6E0", helmet: "#1A1A2E" }, { name: "Zed", skin: "#B98CFF", helmet: "#FFC233" },
  { name: "Luma", skin: "#FFE066", helmet: "#2E9BFF" }, { name: "Taro", skin: "#FF9A5A", helmet: "#3A2A6A" },
  { name: "Fizz", skin: "#7FF0C8", helmet: "#FF3DCB" }, { name: "Mimi", skin: "#FFC8A8", helmet: "#3EE08F" },
  { name: "Rocco", skin: "#C8A07A", helmet: "#E03A3A" }, { name: "Juno", skin: "#A8C8FF", helmet: "#FF8A3D" },
  { name: "Pepper", skin: "#FF7A7A", helmet: "#FFFFFF" }, { name: "Ziggy", skin: "#D8F06A", helmet: "#7A4AD8" },
  { name: "Coco", skin: "#E0B08A", helmet: "#36E3FF" }, { name: "Nova", skin: "#F4B8FF", helmet: "#1A1A2E" },
];
