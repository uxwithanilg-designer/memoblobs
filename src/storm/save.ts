// Blockstorm progress on this device: the stage you're on (leave and come back, and it starts right there), coins,
// lives, upgrades, hero skins, a few totals, and the play settings (auto-fire, look speed).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, NO_UPGRADES, upgradeCost, type Levels, type UpgradeId } from "./gear";
import { HERO_SKINS } from "./rigs";

interface StormSave {
  stage: number; coins: number; lives: number;
  levels: Levels; skin: string; skins: string[];
  kills: number; blocks: number; bosses: number; cleared: number; best: number;
  seenHelp: boolean; autoFire: boolean; sens: number;
}
interface StormStore extends StormSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  clear: (stage: number, kills: number, blocks: number, boss: boolean) => void;
  upgrade: (u: UpgradeId) => boolean;
  buySkin: (id: string) => boolean;
  wear: (id: string) => void;
  sawHelp: () => void;
  setAutoFire: (on: boolean) => void;
  setSens: (v: number) => void;
}
const FRESH: StormSave = {
  stage: 1, coins: 0, lives: 3, levels: { ...NO_UPGRADES }, skin: "rook", skins: ["rook"],
  kills: 0, blocks: 0, bosses: 0, cleared: 0, best: 0, seenHelp: false, autoFire: true, sens: 1,
};

export const useStorm = create<StormStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(9, Math.floor(n))) }),
      clear: (stage, kills, blocks, boss) => set((s) => ({
        stage: Math.max(s.stage, stage + 1), cleared: s.cleared + (stage >= s.stage ? 1 : 0), best: Math.max(s.best, stage),
        kills: s.kills + kills, blocks: s.blocks + blocks, bosses: s.bosses + (boss ? 1 : 0),
      })),
      upgrade: (u) => {
        const s = get(), lv = s.levels[u];
        if (lv >= MAX_LEVEL) return false;
        const cost = upgradeCost(lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [u]: lv + 1 } });
        return true;
      },
      buySkin: (id) => {
        const s = get(), sk = HERO_SKINS.find((x) => x.id === id);
        if (!sk || s.skins.includes(id) || s.coins < sk.price) return false;
        set({ coins: s.coins - sk.price, skins: [...s.skins, id], skin: id });
        return true;
      },
      wear: (id) => { if (get().skins.includes(id)) set({ skin: id }); },
      sawHelp: () => set({ seenHelp: true }),
      setAutoFire: (on) => set({ autoFire: on }),
      setSens: (v) => set({ sens: Math.max(0.4, Math.min(2.2, v)) }),
    }),
    { name: "momoblobs-blockstorm", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<StormSave>) }) as StormStore },
  ),
);
export function useStormHydrated() {
  return useSyncExternalStore((cb) => useStorm.persist.onFinishHydration(cb), () => useStorm.persist.hasHydrated(), () => false);
}
