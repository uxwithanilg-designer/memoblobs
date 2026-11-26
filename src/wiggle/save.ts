// Wiggle Way progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { worm: number[]; eaten: number; moves: number; hints: number; undos: number }

export type Booster = "hint" | "undo";
export interface Current { stage: number; game: Game; revived: boolean }
interface WiggleSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  apples: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface WiggleStore extends WiggleSave {
  win: (stage: number, stars: number, apples: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: WiggleSave = { stage: 1, stars: {}, totalStars: 0, apples: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 10 } };

export const useWiggle = create<WiggleStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, apples) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), apples: s.apples + (prev ? 0 : apples), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useWiggle.getState(); if (s0.boosters[b] <= 0) return false; useWiggle.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-wiggleway", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<WiggleSave>) }) as WiggleStore },
  ),
);
export function useWiggleHydrated() {
  return useSyncExternalStore((cb) => useWiggle.persist.onFinishHydration(cb), () => useWiggle.persist.hasHydrated(), () => false);
}
