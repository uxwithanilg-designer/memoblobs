// Kiko's Jungle Quest save. Subway style: there is no stage progress — every run starts at Kiko's Treehouse. What stays
// on the device: best score and distance, the furthest region, missions and the score multiplier, the wardrobe (fur,
// hats, ribbons, trails, guest runners), power-up upgrades, Golden Seeds won (the story), the Daily Jungle Hunt streak,
// chunks and Wild Forest blends seen lately (so the next runs and days feel fresh) and settings. Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { applyRun, newMissions, type Mission } from "./missions";
import type { KikoLook } from "./render";
import type { PowerId, SimResult } from "./types";
import { FINALE, dailyGoal, sectionOf, wildDay } from "./levels";

export interface KikoSettings { quality: "auto" | "low" | "medium" | "high"; vibrate: boolean }
export interface KikoSave {
  best: { score: number; distance: number; region: number; places: number };
  settings: KikoSettings;
  tutorialDone: boolean; storySeen: boolean;
  missions: Mission[]; level: number;
  look: KikoLook; owned: string[];
  up: Record<PowerId, number>;
  daily: { doneKey: string; streak: number; bestStreak: number };
  recent: string[]; shortRuns: number;
  runs: number; distance: number; bananas: number; golden: number; seeds: number;
  /** the sticker album: places reached (stage numbers) and animals, critters and bosses met ("ride:x", "boss:x", "beat:x", "croc"…) */
  stickers: number[]; met: string[];
  /** Wild Forest blends met on each day (the freshness memory: earlier days' blends stay rare) */
  wild: { key: string; day: number }[];
  /** runs that reached the Great Fruit Tree */
  finales: number;
}
export interface KikoStore extends KikoSave {
  setSettings: (p: Partial<KikoSettings>) => void;
  setTutorialDone: (v: boolean) => void;
  setStorySeen: (v: boolean) => void;
  finishRun: (r: SimResult, used: string[], daily?: string) => { done: Mission[]; levelUp: boolean; newBest: boolean; streak: number; newStickers: number; finale: boolean };
  buy: (item: string, price: number) => boolean;
  setLook: (p: Partial<KikoLook>) => void;
  upgrade: (p: PowerId, price: number) => boolean;
  reset: () => void;
}

const initial = (): KikoSave => ({
  best: { score: 0, distance: 0, region: 1, places: 0 }, settings: { quality: "auto", vibrate: true }, tutorialDone: false, storySeen: false,
  missions: newMissions(1, 24680), level: 1, look: { fur: "kiko", hat: "none", trail: "none", ribbon: "none", runner: "kiko" }, owned: [],
  up: { magnet: 0, helmet: 0, double: 0, glide: 0 }, daily: { doneKey: "", streak: 0, bestStreak: 0 }, recent: [], shortRuns: 0,
  runs: 0, distance: 0, bananas: 0, golden: 0, seeds: 0, stickers: [], met: [], wild: [], finales: 0,
});

export const useKiko = create<KikoStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: (v) => { if (get().tutorialDone !== v) set({ tutorialDone: v }); },
      setStorySeen: (v) => { if (get().storySeen !== v) set({ storySeen: v }); },
      finishRun: (r, used, daily) => {
        const st = get();
        const missions = st.missions.map((m) => ({ ...m }));
        const done = applyRun(missions, r);
        let level = st.level, ms = missions, levelUp = false;
        if (missions.every((m) => m.have >= m.goal)) { level = Math.min(30, level + 1); ms = newMissions(level); levelUp = true; }
        const newBest = r.score > st.best.score;
        let daily2 = st.daily, streak = 0;
        const goal = daily ? dailyGoal(daily) : null;
        if (daily && goal && (r.fruitBy[goal.fruit] ?? 0) >= goal.count && st.daily.doneKey !== daily) {
          const [y, m, dd] = daily.split("-").map(Number), prev = new Date(y, m - 1, dd - 1);
          const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
          streak = st.daily.doneKey === prevKey ? st.daily.streak + 1 : 1;
          daily2 = { doneKey: daily, streak, bestStreak: Math.max(st.daily.bestStreak, streak) };
        }
        const have = new Set(st.stickers), metS = new Set(st.met);
        const before = have.size + metS.size;
        for (let n = r.firstPlace; n <= Math.min(r.lastPlace, 300); n++) have.add(n);
        for (const m of r.met) metS.add(m);
        const finale = r.lastPlace >= FINALE && r.firstPlace <= FINALE;
        if (finale) metS.add("finale");
        // the Wild Forest blends met today (kept a week)
        const today = wildDay();
        const wild = st.wild.filter((w) => w.day >= today - 6);
        for (let n = Math.max(r.firstPlace, FINALE + 1); n <= r.lastPlace; n++) {
          const key = sectionOf(n).blend;
          if (key && !wild.some((w) => w.key === key && w.day === today)) wild.push({ key, day: today });
        }
        const newStickers = have.size + metS.size - before;
        set({
          stickers: [...have].sort((a, b) => a - b), met: [...metS], wild: wild.slice(-120), finales: st.finales + (finale ? 1 : 0),
          missions: ms, level, daily: daily2,
          best: { score: Math.max(st.best.score, r.score), distance: Math.max(st.best.distance, r.distance), region: Math.max(st.best.region, r.bestRegion), places: Math.max(st.best.places, r.places) },
          recent: [...used.slice(-60), ...st.recent].slice(0, 80),
          shortRuns: r.distance < 500 ? st.shortRuns + 1 : 0,
          runs: st.runs + 1, distance: st.distance + r.distance, bananas: st.bananas + r.bananas, golden: st.golden + r.golden, seeds: st.seeds + r.seeds,
        });
        return { done, levelUp, newBest, streak, newStickers, finale };
      },
      buy: (item, price) => {
        if (get().owned.includes(item)) return true;
        if (!useProfile.getState().spendCoins(price)) return false;
        set({ owned: [...get().owned, item] });
        return true;
      },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      upgrade: (p, price) => {
        const lv = get().up[p] ?? 0;
        if (lv >= 5 || !useProfile.getState().spendCoins(price)) return false;
        set({ up: { ...get().up, [p]: lv + 1 } });
        return true;
      },
      reset: () => set(initial()),
    }),
    {
      name: "momoblobs:kiko-jungle", version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true,
      migrate: () => initial(),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<KikoSave>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, best: { ...current.best, ...p.best }, look: { ...current.look, ...p.look }, up: { ...current.up, ...p.up }, daily: { ...current.daily, ...p.daily } };
      },
    },
  ),
);

export function useKikoHydrated() {
  return useSyncExternalStore(
    (cb) => {
      const p = useKiko.persist;
      if (!p.hasHydrated()) void p.rehydrate();
      return p.onFinishHydration(cb);
    },
    () => useKiko.persist.hasHydrated(),
    () => false,
  );
}

/** "auto" graphics: small CPUs get the lighter look (no bloom) */
export function autoQuality(): "low" | "medium" | "high" {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
  if (cores <= 4) return "low";
  return touch ? "medium" : "high";
}
