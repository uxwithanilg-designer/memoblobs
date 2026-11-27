// Obby Bike Blaster progress on this device: the level you're on and the last checkpoint you reached in it (leave and
// come back, and you start right there), coins, lives, bikes, upgrades, rider outfits, totals and play settings.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BIKES, MAX_LEVEL, NO_UPGRADES, upgradeCost, type BikeId, type Levels, type UpgradeId } from "./gear";
import { RIDERS } from "./models";

interface PedalSave {
  level: number; checkpoint: number; coins: number; lives: number;
  bike: BikeId; bikes: BikeId[]; levels: Levels; rider: string; riders: string[];
  cleared: number; best: number; falls: number; seenHelp: boolean; autoPedal: boolean;
}
interface PedalStore extends PedalSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  reach: (level: number, cp: number) => void;
  finish: (level: number, falls: number) => void;
  buyBike: (id: BikeId) => boolean;
  ride: (id: BikeId) => void;
  upgrade: (u: UpgradeId) => boolean;
  buyRider: (id: string) => boolean;
  wear: (id: string) => void;
  sawHelp: () => void;
  setAutoPedal: (on: boolean) => void;
}
const FRESH: PedalSave = {
  level: 1, checkpoint: -1, coins: 0, lives: 5, bike: "bmx", bikes: ["bmx"], levels: { ...NO_UPGRADES }, rider: "pip", riders: ["pip"],
  cleared: 0, best: 0, falls: 0, seenHelp: false, autoPedal: true,
};

export const usePedal = create<PedalStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(9, Math.floor(n))) }),
      reach: (level, cp) => set((s) => (level === s.level ? { checkpoint: Math.max(s.checkpoint, cp) } : s)),
      finish: (level, falls) => set((s) => ({ level: Math.max(s.level, level + 1), checkpoint: -1, cleared: s.cleared + (level >= s.level ? 1 : 0), best: Math.max(s.best, level), falls: s.falls + falls })),
      buyBike: (id) => {
        const s = get(), b = BIKES.find((x) => x.id === id);
        if (!b || s.bikes.includes(id) || s.coins < b.price) return false;
        set({ coins: s.coins - b.price, bikes: [...s.bikes, id], bike: id });
        return true;
      },
      ride: (id) => { if (get().bikes.includes(id)) set({ bike: id }); },
      upgrade: (u) => {
        const s = get(), lv = s.levels[u];
        if (lv >= MAX_LEVEL) return false;
        const cost = upgradeCost(lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [u]: lv + 1 } });
        return true;
      },
      buyRider: (id) => {
        const s = get(), r = RIDERS.find((x) => x.id === id);
        if (!r || s.riders.includes(id) || s.coins < r.price) return false;
        set({ coins: s.coins - r.price, riders: [...s.riders, id], rider: id });
        return true;
      },
      wear: (id) => { if (get().riders.includes(id)) set({ rider: id }); },
      sawHelp: () => set({ seenHelp: true }),
      setAutoPedal: (on) => set({ autoPedal: on }),
    }),
    { name: "momoblobs-obbybike", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<PedalSave>) }) as PedalStore },
  ),
);
export function usePedalHydrated() {
  return useSyncExternalStore((cb) => usePedal.persist.onFinishHydration(cb), () => usePedal.persist.hasHydrated(), () => false);
}
