// Cube Clash progress on this device: the stage you're on (leave and come back, and it starts right there), coins,
// lives, upgrades, outfits, a few totals, and the play settings (auto-fire, look speed).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, NO_UPGRADES, upgradeCost, type Levels, type UpgradeId } from "./gear";
import { OUTFITS } from "./rigs";

interface ClashSave {
  stage: number; coins: number; lives: number;
  levels: Levels; outfit: string; outfits: string[];
  kos: number; wins: number; best: number;
  seenHelp: boolean; autoFire: boolean; sens: number;
}
interface ClashStore extends ClashSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  clear: (stage: number, kos: number) => void;
  upgrade: (u: UpgradeId) => boolean;
  buyOutfit: (id: string) => boolean;
  wear: (id: string) => void;
  sawHelp: () => void;
  setAutoFire: (on: boolean) => void;
  setSens: (v: number) => void;
}
const FRESH: ClashSave = {
  stage: 1, coins: 0, lives: 3, levels: { ...NO_UPGRADES }, outfit: "rookie", outfits: ["rookie"],
  kos: 0, wins: 0, best: 0, seenHelp: false, autoFire: true, sens: 1,
};

export const useClash = create<ClashStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(9, Math.floor(n))) }),
      clear: (stage, kos) => set((s) => ({ stage: Math.max(s.stage, stage + 1), wins: s.wins + (stage >= s.stage ? 1 : 0), best: Math.max(s.best, stage), kos: s.kos + kos })),
      upgrade: (u) => {
        const s = get(), lv = s.levels[u] ?? 0;
        if (lv >= MAX_LEVEL) return false;
        const cost = upgradeCost(lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...NO_UPGRADES, ...s.levels, [u]: lv + 1 } });
        return true;
      },
      buyOutfit: (id) => {
        const s = get(), o = OUTFITS.find((x) => x.id === id);
        if (!o || s.outfits.includes(id) || s.coins < o.price) return false;
        set({ coins: s.coins - o.price, outfits: [...s.outfits, id], outfit: id });
        return true;
      },
      wear: (id) => { if (get().outfits.includes(id)) set({ outfit: id }); },
      sawHelp: () => set({ seenHelp: true }),
      setAutoFire: (on) => set({ autoFire: on }),
      setSens: (v) => set({ sens: Math.max(0.4, Math.min(2.2, v)) }),
    }),
    { name: "momoblobs-cubeclash", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<ClashSave>) }) as ClashStore },
  ),
);
export function useClashHydrated() {
  return useSyncExternalStore((cb) => useClash.persist.onFinishHydration(cb), () => useClash.persist.hasHydrated(), () => false);
}
