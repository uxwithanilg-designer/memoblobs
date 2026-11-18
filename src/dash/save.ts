// Momo Dash! save. Subway style: there is no stage progress — every run starts at the beginning. What stays on the
// device: best score and distance, missions and the score multiplier, the shop (characters, hats, trails, boards,
// power-up upgrades), Jelly Boards, the Daily Dash streak, chunks seen lately (so the next runs feel fresh), settings.
// Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { applyRun, newMissions, type Mission } from "./missions";
import type { DashLook } from "./render";
import type { PowerId, SimResult } from "./types";

export interface DashSettings { quality: "auto" | "low" | "medium" | "high"; vibrate: boolean }
export interface DashSave {
  best: { score: number; distance: number; world: number };
  settings: DashSettings;
  tutorialDone: boolean;
  missions: Mission[]; level: number;
  look: DashLook; owned: string[]; boards: number;
  up: Record<PowerId, number>;
  daily: { doneKey: string; streak: number; bestStreak: number };
  /** chunk ids from recent runs (freshness memory) */
  recent: string[];
  /** short runs in a row (the quiet helper eases the next run after a few) */
  shortRuns: number;
  runs: number; coinsEarned: number; distance: number; tricks: number;
}
export interface DashStore extends DashSave {
  setSettings: (p: Partial<DashSettings>) => void;
  setTutorialDone: (v: boolean) => void;
  /** after a run: records, missions (returns the ones finished and whether the level went up), freshness */
  finishRun: (r: SimResult, used: string[], daily?: string) => { done: Mission[]; levelUp: boolean; newBest: boolean; streak: number };
  spendBoard: () => void;
  buy: (item: string, price: number) => boolean;
  setLook: (p: Partial<DashLook>) => void;
  upgrade: (p: PowerId, price: number) => boolean;
  buyBoards: (n: number, price: number) => boolean;
  reset: () => void;
}

const initial = (): DashSave => ({
  best: { score: 0, distance: 0, world: 1 }, settings: { quality: "auto", vibrate: true }, tutorialDone: false,
  missions: newMissions(1, 12345), level: 1, look: { char: "momo", hat: "none", trail: "none", board: "jelly" }, owned: [], boards: 3,
  up: { magnet: 0, shield: 0, double: 0, sky: 0 }, daily: { doneKey: "", streak: 0, bestStreak: 0 }, recent: [], shortRuns: 0,
  runs: 0, coinsEarned: 0, distance: 0, tricks: 0,
});

export const useDash = create<DashStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: (v) => { if (get().tutorialDone !== v) set({ tutorialDone: v }); },
      finishRun: (r, used, daily) => {
        const st = get();
        const missions = st.missions.map((m) => ({ ...m }));
        const done = applyRun(missions, r);
        let level = st.level, ms = missions, levelUp = false;
        if (missions.every((m) => m.have >= m.goal)) { level = Math.min(30, level + 1); ms = newMissions(level); levelUp = true; }
        const newBest = r.score > st.best.score;
        let daily2 = st.daily, streak = 0;
        if (daily && r.distance >= 1000 && st.daily.doneKey !== daily) {
          const [y, m, dd] = daily.split("-").map(Number), prev = new Date(y, m - 1, dd - 1);
          const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
          streak = st.daily.doneKey === prevKey ? st.daily.streak + 1 : 1;
          daily2 = { doneKey: daily, streak, bestStreak: Math.max(st.daily.bestStreak, streak) };
        }
        set({
          missions: ms, level, daily: daily2,
          best: { score: Math.max(st.best.score, r.score), distance: Math.max(st.best.distance, r.distance), world: Math.max(st.best.world, r.bestWorld) },
          recent: [...used.slice(-60), ...st.recent].slice(0, 80),
          shortRuns: r.distance < 450 ? st.shortRuns + 1 : 0,
          runs: st.runs + 1, distance: st.distance + r.distance, tricks: st.tricks + r.tricks,
        });
        return { done, levelUp, newBest, streak };
      },
      spendBoard: () => set({ boards: Math.max(0, get().boards - 1) }),
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
      buyBoards: (n, price) => {
        if (!useProfile.getState().spendCoins(price)) return false;
        set({ boards: get().boards + n });
        return true;
      },
      reset: () => set(initial()),
    }),
    {
      name: "momoblobs:momo-dash", version: 2, storage: createJSONStorage(() => localStorage), skipHydration: true,
      migrate: () => initial(),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DashSave>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, best: { ...current.best, ...p.best }, look: { ...current.look, ...p.look }, up: { ...current.up, ...p.up }, daily: { ...current.daily, ...p.daily } };
      },
    },
  ),
);

export function useDashHydrated() {
  return useSyncExternalStore(
    (cb) => {
      const p = useDash.persist;
      if (!p.hasHydrated()) void p.rehydrate();
      return p.onFinishHydration(cb);
    },
    () => useDash.persist.hasHydrated(),
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
