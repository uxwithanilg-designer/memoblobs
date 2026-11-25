// Peak Rover progress on this device: the stage you're on and the last checkpoint you reached (so leaving and coming
// back starts you right there), coins, lives, the rides you own and their upgrades, and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { NO_UPGRADES, upgradeCost, vehicleOf, MAX_LEVEL, type Levels, type UpgradeId, type VehicleId } from "./vehicles";

interface RoverSave {
  stage: number;
  checkpoint: number;
  coins: number;
  lives: number;
  vehicle: VehicleId;
  owned: VehicleId[];
  levels: Partial<Record<VehicleId, Levels>>;
  cleared: number;
  flips: number;
  bestRun: number;
  seenHelp: boolean;
}
interface RoverStore extends RoverSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  reach: (stage: number, cp: number) => void;
  clear: (stage: number, flips: number) => void;
  select: (v: VehicleId) => void;
  buy: (v: VehicleId) => boolean;
  upgrade: (v: VehicleId, u: UpgradeId) => boolean;
  sawHelp: () => void;
}
const FRESH: RoverSave = { stage: 1, checkpoint: 0, coins: 0, lives: 3, vehicle: "buggy", owned: ["buggy"], levels: {}, cleared: 0, flips: 0, bestRun: 0, seenHelp: false };

export const useRover = create<RoverStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(5, n)) }),
      reach: (stage, cp) => set((s) => (stage === s.stage ? { checkpoint: Math.max(s.checkpoint, cp) } : s)),
      clear: (stage, flips) => set((s) => ({ stage: Math.max(s.stage, stage + 1), checkpoint: 0, cleared: s.cleared + (stage >= s.stage ? 1 : 0), flips: s.flips + flips, bestRun: Math.max(s.bestRun, stage) })),
      select: (v) => { if (get().owned.includes(v)) set({ vehicle: v }); },
      buy: (v) => {
        const s = get(), price = vehicleOf(v).price;
        if (s.owned.includes(v) || s.coins < price) return false;
        set({ coins: s.coins - price, owned: [...s.owned, v], vehicle: v });
        return true;
      },
      upgrade: (v, u) => {
        const s = get(), lv = { ...NO_UPGRADES, ...(s.levels[v] ?? {}) };
        if (lv[u] >= MAX_LEVEL) return false;
        const cost = upgradeCost(vehicleOf(v), lv[u]);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [v]: { ...lv, [u]: lv[u] + 1 } } });
        return true;
      },
      sawHelp: () => set({ seenHelp: true }),
    }),
    { name: "momoblobs-peakrover", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<RoverSave>) }) as RoverStore },
  ),
);
export const levelsOf = (s: { levels: Partial<Record<VehicleId, Levels>> }, v: VehicleId): Levels => ({ ...NO_UPGRADES, ...(s.levels[v] ?? {}) });
export function useRoverHydrated() {
  return useSyncExternalStore((cb) => useRover.persist.onFinishHydration(cb), () => useRover.persist.hasHydrated(), () => false);
}
