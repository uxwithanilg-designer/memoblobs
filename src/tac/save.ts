// Neon Tac Duel progress on this device: the next stage, stars per stage, totals, booster charges and the stage in
// progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { cells: number[]; order: [number[], number[]]; used: number; hints: number; undos: number; over: "" | "win" | "lose" | "draw"; line?: number[] }

export type Booster = "hint" | "undo";
export interface Current { stage: number; game: Game; revived: boolean }
interface TacSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  wins: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface TacStore extends TacSave {
  win: (stage: number, stars: number, wins: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: TacSave = { stage: 1, stars: {}, totalStars: 0, wins: 0, current: null, seenHelp: false, tips: [], boosters: { hint: 3, undo: 5 } };

export const useTac = create<TacStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, wins) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), wins: s.wins + (prev ? 0 : wins), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useTac.getState(); if (s0.boosters[b] <= 0) return false; useTac.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-neontac", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<TacSave>) }) as TacStore },
  ),
);
export function useTacHydrated() {
  return useSyncExternalStore((cb) => useTac.persist.onFinishHydration(cb), () => useTac.persist.hasHydrated(), () => false);
}
