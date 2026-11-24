// Moonvial progress on this device: the next stage, stars per stage, total stars and score, Undo charges, and the
// stage in progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Game } from "./play";

export interface Current { stage: number; game: Game; history: Game[] }

interface VialSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  totalScore: number;
  current: Current | null;
  seenHelp: boolean;
  /** twists already explained (tall, lock, boss, hidden) */
  tips: string[];
}
interface VialStore extends VialSave {
  win: (stage: number, stars: number, score: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
}

const FRESH: VialSave = { stage: 1, stars: {}, totalStars: 0, totalScore: 0, current: null, seenHelp: false, tips: [] };

export const useVial = create<VialStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, score) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        // keep the star map small: only the last 400 stages
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), totalScore: s.totalScore + score, current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-moonvial", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<VialSave>) }) as VialStore },
  ),
);

export function useVialHydrated() {
  return useSyncExternalStore((cb) => useVial.persist.onFinishHydration(cb), () => useVial.persist.hasHydrated(), () => false);
}
