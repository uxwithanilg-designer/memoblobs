// Slide Splash progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { pos: number; painted: number[]; moves: number; used: number; helped: boolean; shield: boolean; burst: number[] }

export type Booster = "hint" | "undo" | "shield";
export interface Current { stage: number; game: Game; revived: boolean }
interface SplashSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  tiles: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface SplashStore extends SplashSave {
  win: (stage: number, stars: number, tiles: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: SplashSave = { stage: 1, stars: {}, totalStars: 0, tiles: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 5, shield: 2 } };

export const useSplash = create<SplashStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, tiles) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), tiles: s.tiles + (prev ? 0 : tiles), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useSplash.getState(); if (s0.boosters[b] <= 0) return false; useSplash.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-slidesplash", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<SplashSave>) }) as SplashStore },
  ),
);
export function useSplashHydrated() {
  return useSyncExternalStore((cb) => useSplash.persist.onFinishHydration(cb), () => useSplash.persist.hasHydrated(), () => false);
}
