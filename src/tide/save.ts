// Blocktide progress on this device: best score, last score, games and lines, the deepest zone reached, total score,
// Undo / Swap charges, and the run in progress (so closing the tab loses nothing).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Board } from "./board";
import type { Piece } from "./shapes";

export interface Run {
  board: Board;
  tray: (Piece | null)[];
  score: number;
  combo: number;
  moves: number;
  lines: number;
  seed: string;
  deals: number;
  revived: boolean;
}

interface TideSave {
  best: number;
  last: number;
  games: number;
  lines: number;
  deepest: number;
  totalScore: number;
  undo: number;
  swap: number;
  run: Run | null;
  seenHelp: boolean;
}
interface TideStore extends TideSave {
  saveRun: (r: Run | null) => void;
  endGame: (score: number, lines: number) => { newBest: boolean };
  reached: (zone: number) => void;
  usePower: (k: "undo" | "swap") => boolean;
  addPower: (k: "undo" | "swap", n?: number) => void;
  sawHelp: () => void;
}

export const MAX_POWER = 9;
const FRESH: TideSave = { best: 0, last: 0, games: 0, lines: 0, deepest: 0, totalScore: 0, undo: 3, swap: 2, run: null, seenHelp: false };

export const useTide = create<TideStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      saveRun: (r) => set({ run: r }),
      endGame: (score, lines) => {
        const s = get();
        set({ best: Math.max(s.best, score), last: score, totalScore: s.totalScore + score, games: s.games + 1, lines: s.lines + lines, run: null });
        return { newBest: score > s.best };
      },
      reached: (zone) => set((s) => (zone > s.deepest ? { deepest: zone } : s)),
      usePower: (k) => { const s = get(); if (s[k] <= 0) return false; set({ [k]: s[k] - 1 } as Partial<TideSave>); return true; },
      addPower: (k, n = 1) => set((s) => ({ [k]: Math.min(MAX_POWER, s[k] + n) }) as Partial<TideSave>),
      sawHelp: () => set({ seenHelp: true }),
    }),
    {
      name: "momoblobs-blocktide", version: 2, storage: createJSONStorage(() => localStorage),
      // v1 had modes: keep the Endless best and the powers, drop the rest
      migrate: (old, v) => {
        const o = (old ?? {}) as Record<string, unknown>;
        if (v < 2) {
          const best = (o.best as Record<string, number> | undefined)?.endless ?? 0;
          return { ...FRESH, best, undo: (o.undo as number) ?? FRESH.undo, swap: (o.swap as number) ?? FRESH.swap, seenHelp: !!o.seenHelp, totalScore: (o.totalScore as number) ?? 0 } as TideStore;
        }
        return { ...FRESH, ...(o as Partial<TideSave>) } as TideStore;
      },
    },
  ),
);

export function useTideHydrated() {
  return useSyncExternalStore((cb) => useTide.persist.onFinishHydration(cb), () => useTide.persist.hasHydrated(), () => false);
}
