// Treatrio progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export interface Current { stage: number; game: Game; history: Game[]; left: number; score: number; revived: boolean }
interface TreatSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  totalScore: number;
  best: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
}
interface TreatStore extends TreatSave {
  win: (stage: number, stars: number, score: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
}
const FRESH: TreatSave = { stage: 1, stars: {}, totalStars: 0, totalScore: 0, best: 0, current: null, seenHelp: false, tips: [] };

export const useTreat = create<TreatStore>()(
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
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-treatrio", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<TreatSave>) }) as TreatStore },
  ),
);
export function useTreatHydrated() {
  return useSyncExternalStore((cb) => useTreat.persist.onFinishHydration(cb), () => useTreat.persist.hasHydrated(), () => false);
}
