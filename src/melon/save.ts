// Melon Merge Fiesta progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export type Booster = "hammer" | "bomb" | "shake" | "undo";
export interface Current { stage: number; game: Game; revived: boolean }
interface MelonSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  totalScore: number;
  best: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: { hammer: number; bomb: number; shake: number; undo: number };
  muted?: boolean;
}
interface MelonStore extends MelonSave {
  win: (stage: number, stars: number, score: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: MelonSave = { stage: 1, stars: {}, totalStars: 0, totalScore: 0, best: 0, current: null, seenHelp: false, tips: [], boosters: { hammer: 3, bomb: 2, shake: 3, undo: 3 } };

export const useMelon = create<MelonStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, score) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), totalScore: s.totalScore + score, best: Math.max(s.best, score), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useMelon.getState(); if (s0.boosters[b] <= 0) return false; useMelon.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-melonmerge", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<MelonSave>) }) as MelonStore },
  ),
);
export function useMelonHydrated() {
  return useSyncExternalStore((cb) => useMelon.persist.onFinishHydration(cb), () => useMelon.persist.hasHydrated(), () => false);
}
