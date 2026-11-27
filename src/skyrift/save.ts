// Skyrift Gems progress on this device: the next stage, stars per stage, totals and booster charges (a level is never
// saved mid-way: leaving starts it again).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { stage: number }

export type Booster = "hammer" | "shuffle" | "hint";
export interface Current { stage: number; game: Game; revived: boolean }
interface SkySave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  duels: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface SkyStore extends SkySave {
  win: (stage: number, stars: number, duels: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: SkySave = { stage: 1, stars: {}, totalStars: 0, duels: 0, current: null, seenHelp: false, tips: [], boosters: { hammer: 3, shuffle: 2, hint: 3 } };

export const useSky = create<SkyStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, duels) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), duels: s.duels + (prev ? 0 : duels), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useSky.getState(); if (s0.boosters[b] <= 0) return false; useSky.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-skyrift", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<SkySave>) }) as SkyStore },
  ),
);
export function useSkyHydrated() {
  return useSyncExternalStore((cb) => useSky.persist.onFinishHydration(cb), () => useSky.persist.hasHydrated(), () => false);
}
