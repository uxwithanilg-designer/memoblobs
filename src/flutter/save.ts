// Flutter Pairs progress on this device: the next stage, stars per stage, totals and booster charges (a level is never
// saved mid-way: leaving starts it again).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { stage: number }

export type Booster = "move" | "swap" | "hint";
export interface Current { stage: number; game: Game; revived: boolean }
interface FlutterSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  pairs: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface FlutterStore extends FlutterSave {
  win: (stage: number, stars: number, pairs: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: FlutterSave = { stage: 1, stars: {}, totalStars: 0, pairs: 0, current: null, seenHelp: false, tips: [], boosters: { move: 3, swap: 3, hint: 3 } };

export const useFlutter = create<FlutterStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, pairs) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), pairs: s.pairs + (prev ? 0 : pairs), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useFlutter.getState(); if (s0.boosters[b] <= 0) return false; useFlutter.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-flutterpairs", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<FlutterSave>) }) as FlutterStore },
  ),
);
export function useFlutterHydrated() {
  return useSyncExternalStore((cb) => useFlutter.persist.onFinishHydration(cb), () => useFlutter.persist.hasHydrated(), () => false);
}
