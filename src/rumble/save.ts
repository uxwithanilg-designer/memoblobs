// Rumble Rally progress on this device: the race you're on (leave mid-race and you come back to the same race, on the
// grid), coins, lives, the trucks you own and their upgrades, and a few totals (races cleared, wins, podiums, stars).
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, NO_UPGRADES, truckOf, upgradeCost, type Levels, type TruckId, type UpgradeId } from "./trucks";

interface RumbleSave {
  stage: number;
  coins: number;
  lives: number;
  truck: TruckId;
  owned: TruckId[];
  levels: Partial<Record<TruckId, Levels>>;
  cleared: number;
  wins: number;
  podiums: number;
  stars: number;
  seenHelp: boolean;
}
interface RumbleStore extends RumbleSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  clear: (stage: number, place: number, stars: number) => void;
  select: (v: TruckId) => void;
  buy: (v: TruckId) => boolean;
  upgrade: (v: TruckId, u: UpgradeId) => boolean;
  sawHelp: () => void;
}
export const START_LIVES = 3, MAX_LIVES = 5;
const FRESH: RumbleSave = { stage: 1, coins: 0, lives: START_LIVES, truck: "brawler", owned: ["brawler"], levels: {}, cleared: 0, wins: 0, podiums: 0, stars: 0, seenHelp: false };

export const useRumble = create<RumbleStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(MAX_LIVES, n)) }),
      clear: (stage, place, stars) => set((s) => ({
        stage: Math.max(s.stage, stage + 1),
        cleared: s.cleared + (stage >= s.stage ? 1 : 0), wins: s.wins + (place === 1 ? 1 : 0), podiums: s.podiums + (place <= 3 ? 1 : 0), stars: s.stars + stars,
      })),
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
    { name: "momoblobs-rumblerally", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<RumbleSave>) }) as RumbleStore },
  ),
);
export const levelsOf = (s: { levels: Partial<Record<TruckId, Levels>> }, v: TruckId): Levels => ({ ...NO_UPGRADES, ...(s.levels[v] ?? {}) });
export function useRumbleHydrated() {
  return useSyncExternalStore((cb) => useRumble.persist.onFinishHydration(cb), () => useRumble.persist.hasHydrated(), () => false);
}
