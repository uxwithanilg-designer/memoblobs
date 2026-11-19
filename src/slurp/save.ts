// Slurp Lab save (on this device): the stage you're on, stars and best moves per stage, the Endless Lab (next stage,
// the fingerprints already played), the Daily Brain Jar streak, Exam Rush best, hints, the Lab Wardrobe, the sticker
// album, settings and whether you've seen the tutorial. Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { CAMPAIGN } from "./campaign";
import { ENDLESS_FROM } from "./endless";

export interface SlurpSettings { quality: "auto" | "low" | "medium" | "high"; vibrate: boolean; symbols: boolean }
export interface StageBest { stars: number; moves: number }
export interface DailyState { day: number; cleared: boolean; streak: number; best: number }
export interface SlurpLookSave { skin: string; hat: string }
export interface SlurpSave {
  unlocked: number;
  next: number;
  best: Record<number, StageBest>;
  /** Endless Lab: the next stage, and recipe fingerprints already played (the last 300) */
  endless: number; seen: string[];
  daily: DailyState;
  rushBest: number;
  /** free hints left (3 per lab; more cost coins) */
  hints: number;
  tutorialSeen: boolean;
  settings: SlurpSettings;
  look: SlurpLookSave; owned: string[];
  /** Gloopy stickers found (key → how many slurped) */
  album: Record<string, number>;
  plays: number;
}
export interface SlurpStore extends SlurpSave {
  /** record a clear → coins earned and whether it beat the old best */
  finish: (n: number, stars: number, moves: number) => { coins: number; firstClear: boolean; better: boolean };
  finishEndless: (n: number, stars: number, fp: string) => number;
  finishDaily: (day: number, stars: number) => { coins: number; streak: number; first: boolean };
  finishRush: (cleared: number) => number;
  setNext: (n: number) => void;
  useHint: () => boolean;
  buyHints: (price: number, count: number) => boolean;
  seeTutorial: () => void;
  setSettings: (p: Partial<SlurpSettings>) => void;
  buy: (id: string, price: number) => boolean;
  setLook: (p: Partial<SlurpLookSave>) => void;
  stick: (keys: string[]) => void;
  reset: () => void;
}
const FRESH: SlurpSave = {
  unlocked: 1, next: 1, best: {}, endless: ENDLESS_FROM, seen: [], daily: { day: -1, cleared: false, streak: 0, best: 0 }, rushBest: 0,
  hints: 3, tutorialSeen: false, settings: { quality: "auto", vibrate: true, symbols: true }, look: { skin: "glass", hat: "none" }, owned: ["glass", "none"], album: {}, plays: 0,
};

export const useSlurp = create<SlurpStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      finish: (n, stars, moves) => {
        const g = get(), old = g.best[n];
        const firstClear = !old;
        const better = !old || stars > old.stars || (stars === old.stars && moves < old.moves);
        const coins = firstClear ? 20 + stars * 10 : better && old && stars > old.stars ? (stars - old.stars) * 10 : 0;
        const best = better ? { ...g.best, [n]: { stars: Math.max(stars, old?.stars ?? 0), moves: old ? Math.min(old.moves, moves) : moves } } : g.best;
        const newLab = firstClear && n % 20 === 0;
        set({ best, unlocked: Math.max(g.unlocked, Math.min(CAMPAIGN, n + 1)), next: Math.min(CAMPAIGN, Math.max(g.next, n + 1)), plays: g.plays + 1, hints: newLab ? g.hints + 3 : g.hints });
        if (coins) useProfile.getState().earnCoins(coins);
        return { coins, firstClear, better };
      },
      finishEndless: (n, stars, fp) => {
        const g = get();
        const coins = 25 + stars * 10;
        set({ endless: Math.max(g.endless, n + 1), seen: [...g.seen.filter((x) => x !== fp), fp].slice(-300), plays: g.plays + 1 });
        useProfile.getState().earnCoins(coins);
        return coins;
      },
      finishDaily: (day, stars) => {
        const g = get(), d = g.daily;
        if (d.day === day && d.cleared) return { coins: 0, streak: d.streak, first: false };
        const streak = d.day === day - 1 && d.cleared ? d.streak + 1 : 1;
        const coins = 60 + Math.min(10, streak) * 10 + stars * 10;
        set({ daily: { day, cleared: true, streak, best: Math.max(d.best, streak) }, plays: g.plays + 1 });
        useProfile.getState().earnCoins(coins);
        return { coins, streak, first: true };
      },
      finishRush: (cleared) => {
        const g = get(); const coins = cleared * 40 + (cleared >= 5 ? 100 : 0);
        set({ rushBest: Math.max(g.rushBest, cleared) });
        if (coins) useProfile.getState().earnCoins(coins);
        return coins;
      },
      setNext: (n) => set({ next: n }),
      useHint: () => { const g = get(); if (g.hints <= 0) return false; set({ hints: g.hints - 1 }); return true; },
      buyHints: (price, count) => { if (!useProfile.getState().spendCoins(price)) return false; set({ hints: get().hints + count }); return true; },
      seeTutorial: () => set({ tutorialSeen: true }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      buy: (id, price) => { const g = get(); if (g.owned.includes(id)) return true; if (!useProfile.getState().spendCoins(price)) return false; set({ owned: [...g.owned, id] }); return true; },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      stick: (keys) => { const a = { ...get().album }; for (const k of keys) a[k] = (a[k] ?? 0) + 1; set({ album: a }); },
      reset: () => set({ ...FRESH }),
    }),
    {
      name: "momoblobs-slurp", version: 2, storage: createJSONStorage(() => localStorage),
      // v1 → v2: keep progress, add the Phase 3 fields
      migrate: (old) => ({ ...FRESH, ...(old as Partial<SlurpSave>) }) as SlurpStore,
    },
  ),
);

export function useSlurpHydrated() {
  return useSyncExternalStore(
    (cb) => useSlurp.persist.onFinishHydration(cb),
    () => useSlurp.persist.hasHydrated(),
    () => false,
  );
}
export function autoQuality(): "low" | "medium" | "high" {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
  if (cores <= 4) return "low";
  return touch ? "medium" : "high";
}
export const totalStars = (best: Record<number, StageBest>) => Object.values(best).reduce((a, b) => a + b.stars, 0);

/** the Lab Wardrobe */
export const SKINS = [
  { id: "glass", name: "Lab glass", price: 0 }, { id: "crystal", name: "Crystal", price: 300 },
  { id: "candy", name: "Candy stripe", price: 450 }, { id: "gold", name: "Gold", price: 600 },
];
export const HATS = [
  { id: "none", name: "No hat", price: 0 }, { id: "party", name: "Party hat", price: 150 }, { id: "flower", name: "Flower", price: 200 },
  { id: "chef", name: "Chef hat", price: 250 }, { id: "wizard", name: "Wizard hat", price: 350 }, { id: "crown", name: "Crown", price: 500 },
];
/** the sticker album: every kind of Gloopy */
export const STICKERS = [
  ...["Strawberry", "Lemon", "Aqua", "Lime", "Grape", "Tangerine", "Cobalt", "Bubblegum"].map((n, i) => ({ key: `c${i}`, name: n })),
  { key: "rainbow", name: "Rainbow" }, { key: "double", name: "Double" }, { key: "bubble", name: "Bubbled" }, { key: "frost", name: "Frosted" },
  { key: "bomb", name: "Bomb" }, { key: "fuse", name: "Fuse" },
];
