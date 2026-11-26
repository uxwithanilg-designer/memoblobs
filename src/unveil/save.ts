// Arrow Unveil progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export type Booster = "hint" | "eraser";
export interface Current { stage: number; game: Game; revived: boolean }
interface UnveilSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  pictures: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface UnveilStore extends UnveilSave {
  win: (stage: number, stars: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: UnveilSave = { stage: 1, stars: {}, totalStars: 0, pictures: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 5, eraser: 2 } };

export const useUnveil = create<UnveilStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), pictures: s.pictures + (prev ? 0 : 1), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useUnveil.getState(); if (s0.boosters[b] <= 0) return false; useUnveil.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-arrowunveil", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<UnveilSave>) }) as UnveilStore },
  ),
);
export function useUnveilHydrated() {
  return useSyncExternalStore((cb) => useUnveil.persist.onFinishHydration(cb), () => useUnveil.persist.hasHydrated(), () => false);
}
