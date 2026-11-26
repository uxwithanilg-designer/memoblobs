// Rope Loop progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { spools: number[][]; hid: boolean[][]; used: number; helped: boolean; extra: boolean; bonus?: number }

export type Booster = "hint" | "undo" | "spool";
export interface Current { stage: number; game: Game; revived: boolean }
interface RopeSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  sorted: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface RopeStore extends RopeSave {
  win: (stage: number, stars: number, sorted: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: RopeSave = { stage: 1, stars: {}, totalStars: 0, sorted: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 5, spool: 2 } };

export const useRope = create<RopeStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, sorted) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), sorted: s.sorted + (prev ? 0 : sorted), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useRope.getState(); if (s0.boosters[b] <= 0) return false; useRope.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-ropeloop", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<RopeSave>) }) as RopeStore },
  ),
);
export function useRopeHydrated() {
  return useSyncExternalStore((cb) => useRope.persist.onFinishHydration(cb), () => useRope.persist.hasHydrated(), () => false);
}
