// Bubble Relics progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export interface Current { stage: number; game: Game; revived: boolean }
interface RelicSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  totalScore: number;
  best: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: { swap: number; rainbow: number; bomb: number };
  muted?: boolean;
}
interface RelicStore extends RelicSave {
  win: (stage: number, stars: number, score: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: "rainbow" | "bomb") => boolean;
  giveBooster: (b: "rainbow" | "bomb", n: number) => void;
}
const FRESH: RelicSave = { stage: 1, stars: {}, totalStars: 0, totalScore: 0, best: 0, current: null, seenHelp: false, tips: [], boosters: { swap: 0, rainbow: 2, bomb: 2 } };

export const useRelic = create<RelicStore>()(
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
      useBooster: (b) => { const s0 = useRelic.getState(); if (s0.boosters[b] <= 0) return false; useRelic.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-bubblerelics", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<RelicSave>) }) as RelicStore },
  ),
);
export function useRelicHydrated() {
  return useSyncExternalStore((cb) => useRelic.persist.onFinishHydration(cb), () => useRelic.persist.hasHydrated(), () => false);
}
