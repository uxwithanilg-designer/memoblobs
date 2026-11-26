// Band Bend progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { hooks: number[][]; used: number; helped: boolean; bonus?: number }

export type Booster = "hint" | "undo" | "peek";
export interface Current { stage: number; game: Game; revived: boolean }
interface BandSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  shapes: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface BandStore extends BandSave {
  win: (stage: number, stars: number, shapes: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: BandSave = { stage: 1, stars: {}, totalStars: 0, shapes: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 5, peek: 3 } };

export const useBand = create<BandStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, shapes) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), shapes: s.shapes + (prev ? 0 : shapes), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useBand.getState(); if (s0.boosters[b] <= 0) return false; useBand.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-bandbend", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<BandSave>) }) as BandStore },
  ),
);
export function useBandHydrated() {
  return useSyncExternalStore((cb) => useBand.persist.onFinishHydration(cb), () => useBand.persist.hasHydrated(), () => false);
}
