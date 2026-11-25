// Tumble Truck progress on this device: the stage you're on, the last checkpoint you reached and how much of the load
// was still aboard there (so leaving and coming back starts you right there, with that load), coins, lives, the trucks
// you own and their upgrades, and a few totals (deliveries, stars, pieces delivered).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, NO_UPGRADES, truckOf, upgradeCost, type Levels, type TruckId, type UpgradeId } from "./trucks";

interface HaulSave {
  stage: number;
  checkpoint: number;
  /** pieces aboard at the checkpoint (0 = the full load) */
  carry: number;
  coins: number;
  lives: number;
  truck: TruckId;
  owned: TruckId[];
  levels: Partial<Record<TruckId, Levels>>;
  cleared: number;
  stars: number;
  delivered: number;
  seenHelp: boolean;
}
interface HaulStore extends HaulSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  reach: (stage: number, cp: number, carry: number) => void;
  clear: (stage: number, stars: number, delivered: number) => void;
  restartStage: () => void;
  select: (v: TruckId) => void;
  buy: (v: TruckId) => boolean;
  upgrade: (v: TruckId, u: UpgradeId) => boolean;
  sawHelp: () => void;
}
const FRESH: HaulSave = { stage: 1, checkpoint: 0, carry: 0, coins: 0, lives: 3, truck: "mudbug", owned: ["mudbug"], levels: {}, cleared: 0, stars: 0, delivered: 0, seenHelp: false };

export const useHaul = create<HaulStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(5, n)) }),
      reach: (stage, cp, carry) => set((s) => (stage === s.stage && cp > s.checkpoint ? { checkpoint: cp, carry } : s)),
      clear: (stage, stars, delivered) => set((s) => ({
        stage: Math.max(s.stage, stage + 1), checkpoint: 0, carry: 0,
        cleared: s.cleared + (stage >= s.stage ? 1 : 0), stars: s.stars + stars, delivered: s.delivered + delivered,
      })),
      restartStage: () => set({ checkpoint: 0, carry: 0 }),
      select: (v) => { if (get().owned.includes(v)) set({ truck: v }); },
      buy: (v) => {
        const s = get(), price = truckOf(v).price;
        if (s.owned.includes(v) || s.coins < price) return false;
        set({ coins: s.coins - price, owned: [...s.owned, v], truck: v });
        return true;
      },
      upgrade: (v, u) => {
        const s = get(), lv = { ...NO_UPGRADES, ...(s.levels[v] ?? {}) };
        if (lv[u] >= MAX_LEVEL) return false;
        const cost = upgradeCost(truckOf(v), lv[u]);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [v]: { ...lv, [u]: lv[u] + 1 } } });
        return true;
      },
      sawHelp: () => set({ seenHelp: true }),
    }),
    { name: "momoblobs-tumbletruck", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<HaulSave>) }) as HaulStore },
  ),
);
export const levelsOf = (s: { levels: Partial<Record<TruckId, Levels>> }, v: TruckId): Levels => ({ ...NO_UPGRADES, ...(s.levels[v] ?? {}) });
export function useHaulHydrated() {
  return useSyncExternalStore((cb) => useHaul.persist.onFinishHydration(cb), () => useHaul.persist.hasHydrated(), () => false);
}
