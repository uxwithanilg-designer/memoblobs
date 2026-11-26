// Bead Rush progress on this device: the next stage, stars per stage, totals and helper charges (a run is never
// saved mid-way: leaving restarts the stage).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Game { stage: number }

export type Booster = "revive" | "shield";
export interface Current { stage: number; game: Game; revived: boolean }
interface BeadSave {
  stage: number;
  stars: Record<number, number>;
  totalStars: number;
  beads: number;
  current: Current | null;
  seenHelp: boolean;
  tips: string[];
  boosters: Record<Booster, number>;
}
interface BeadStore extends BeadSave {
  win: (stage: number, stars: number, beads: number) => void;
  saveCurrent: (c: Current | null) => void;
  sawHelp: () => void;
  sawTip: (t: string) => void;
  useBooster: (b: Booster) => boolean;
  giveBooster: (b: Booster, n: number) => void;
}
const FRESH: BeadSave = { stage: 1, stars: {}, totalStars: 0, beads: 0, current: null, seenHelp: false, tips: [], boosters: { revive: 3, shield: 2 } };

export const useBead = create<BeadStore>()(
  persist(
    (set) => ({
      ...FRESH,
      win: (stage, stars, beads) => set((s) => {
        const prev = s.stars[stage] ?? 0;
        const st = { ...s.stars, [stage]: Math.max(prev, stars) };
        const keys = Object.keys(st).map(Number);
        if (keys.length > 400) keys.sort((a, b) => a - b).slice(0, keys.length - 400).forEach((k) => delete st[k]);
        return { stage: Math.max(s.stage, stage + 1), stars: st, totalStars: s.totalStars + Math.max(0, stars - prev), beads: s.beads + (prev ? 0 : beads), current: null };
      }),
      saveCurrent: (c) => set({ current: c }),
      sawHelp: () => set({ seenHelp: true }),
      useBooster: (b) => { const s0 = useBead.getState(); if (s0.boosters[b] <= 0) return false; useBead.setState({ boosters: { ...s0.boosters, [b]: s0.boosters[b] - 1 } }); return true; },
      giveBooster: (b, n) => set((s) => ({ boosters: { ...s.boosters, [b]: Math.min(9, s.boosters[b] + n) } })),
      sawTip: (t) => set((s) => (s.tips.includes(t) ? s : { tips: [...s.tips, t] })),
    }),
    { name: "momoblobs-beadrush", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<BeadSave>) }) as BeadStore },
  ),
);
export function useBeadHydrated() {
  return useSyncExternalStore((cb) => useBead.persist.onFinishHydration(cb), () => useBead.persist.hasHydrated(), () => false);
}
