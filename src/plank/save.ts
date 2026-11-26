// Plank Panic progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { State } from "./engine";
export interface Game { state: State; moves: number; used: number; helped: boolean; time?: number }

export type Booster = "hint" | "undo" | "pliers";
export interface Current { stage: number; game: Game; revived: boolean }
interface PlankSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  planks: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface PlankStore extends PlankSave {
  win: (stage: number, stars: number, planks: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: PlankSave = { stage: 1, stars: {}, totalStars: 0, planks: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 5, pliers: 2 } };

export const usePlank = create<PlankStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, planks) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), planks: s.planks + (prev ? 0 : planks), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = usePlank.getState(); if (s0.boosters[b] <= 0) return false; usePlank.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-plankpanic", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<PlankSave>) }) as PlankStore },
  ),
);
export function usePlankHydrated() {
  return useSyncExternalStore((cb) => usePlank.persist.onFinishHydration(cb), () => usePlank.persist.hasHydrated(), () => false);
}
