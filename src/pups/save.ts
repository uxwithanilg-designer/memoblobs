// Noodle Pups progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export type Booster = "hint" | "treat";
export interface Current { stage: number; game: Game; revived: boolean }
interface PupsSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  dogs: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface PupsStore extends PupsSave {
  win: (stage: number, stars: number, dogs: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: PupsSave = { stage: 1, stars: {}, totalStars: 0, dogs: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 5, treat: 2 } };

export const usePups = create<PupsStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, dogs) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), dogs: s.dogs + (prev ? 0 : dogs), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = usePups.getState(); if (s0.boosters[b] <= 0) return false; usePups.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-noodlepups", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<PupsSave>) }) as PupsStore },
  ),
);
export function usePupsHydrated() {
  return useSyncExternalStore((cb) => usePups.persist.onFinishHydration(cb), () => usePups.persist.hasHydrated(), () => false);
}
