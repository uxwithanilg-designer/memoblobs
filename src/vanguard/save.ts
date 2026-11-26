// Voxel Vanguard progress on this device: the operation you're on and the sector and phase inside it (it's saved after
// every phase, so leave mid-operation and you come back to the same phase),
// coins, lives, the blasters you own and their levels, the one in hand, the suit upgrades, outfits, the view
// (behind the shoulder or first person) and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, OUTFITS, WEAPONS, suitCost, weaponOf, weaponUpgradeCost, type OutfitId, type SuitId, type WeaponId } from "./gear";

interface VanguardSave {
  /** the operation */
  stage: number;
  /** where in it: the sector and the phase to start from */
  sector: number; phase: number;
  coins: number;
  lives: number;
  owned: WeaponId[];
  levels: Partial<Record<WeaponId, number>>;
  /** the two blasters you carry (swap between them in a fight) */
  loadout: [WeaponId, WeaponId];
  suit: Record<SuitId, number>;
  outfits: OutfitId[];
  outfit: OutfitId;
  firstPerson: boolean;
  cleared: number;
  kills: number;
  bosses: number;
  seenHelp: boolean;
}
interface VanguardStore extends VanguardSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  /** the operation is won: on to `next` */
  clear: (next: number, kills: number) => void;
  /** a phase is won: come back here */
  checkpoint: (stage: number, sector: number, phase: number, kills: number) => void;
  buyWeapon: (w: WeaponId) => boolean;
  upgradeWeapon: (w: WeaponId) => boolean;
  equip: (slot: 0 | 1, w: WeaponId) => void;
  upgradeSuit: (s: SuitId) => boolean;
  buyOutfit: (o: OutfitId) => boolean;
  wear: (o: OutfitId) => void;
  setView: (firstPerson: boolean) => void;
  sawHelp: () => void;
}
export const START_LIVES = 3, MAX_LIVES = 5, SUIT_MAX = 6;
const FRESH: VanguardSave = {
  stage: 1, sector: 0, phase: 0, coins: 0, lives: START_LIVES, owned: ["zapper"], levels: {}, loadout: ["zapper", "zapper"],
  suit: { armor: 0, jet: 0, boots: 0 }, outfits: ["ranger"], outfit: "ranger", firstPerson: false, cleared: 0, kills: 0, bosses: 0, seenHelp: false,
};

export const useVanguard = create<VanguardStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(MAX_LIVES, n)) }),
      clear: (next, kills) => set((s) => (next > s.stage ? { stage: next, sector: 0, phase: 0, cleared: s.cleared + 1, kills: s.kills + kills, bosses: s.bosses + 1 } : { kills: s.kills + kills })),
      checkpoint: (stage, sector, phase, kills) => set((s) => (stage === s.stage ? { sector, phase, kills: s.kills + kills } : { kills: s.kills + kills })),
      buyWeapon: (w) => {
        const s = get(), price = weaponOf(w).price;
        if (s.owned.includes(w) || s.coins < price) return false;
        // a new blaster goes straight into the second slot (or the first while both slots hold the same one)
        const loadout: [WeaponId, WeaponId] = s.loadout[0] === s.loadout[1] ? [s.loadout[0], w] : [s.loadout[1], w];
        set({ coins: s.coins - price, owned: [...s.owned, w], loadout });
        return true;
      },
      upgradeWeapon: (w) => {
        const s = get(), lv = s.levels[w] ?? 0;
        if (!s.owned.includes(w) || lv >= MAX_LEVEL) return false;
        const cost = weaponUpgradeCost(weaponOf(w), lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [w]: lv + 1 } });
        return true;
      },
      equip: (slot, w) => { const s = get(); if (!s.owned.includes(w)) return; const l: [WeaponId, WeaponId] = [...s.loadout]; l[slot] = w; set({ loadout: l }); },
      upgradeSuit: (id) => {
        const s = get(), lv = s.suit[id];
        if (lv >= SUIT_MAX) return false;
        const cost = suitCost(lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, suit: { ...s.suit, [id]: lv + 1 } });
        return true;
      },
      buyOutfit: (o) => {
        const s = get(), price = OUTFITS.find((x) => x.id === o)?.price ?? 0;
        if (s.outfits.includes(o) || s.coins < price) return false;
        set({ coins: s.coins - price, outfits: [...s.outfits, o], outfit: o });
        return true;
      },
      wear: (o) => { if (get().outfits.includes(o)) set({ outfit: o }); },
      setView: (firstPerson) => set({ firstPerson }),
      sawHelp: () => set({ seenHelp: true }),
    }),
    { name: "momoblobs-voxelvanguard", version: 2, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<VanguardSave>), sector: 0, phase: 0 }) as VanguardStore },
  ),
);
export const levelOf = (s: { levels: Partial<Record<WeaponId, number>> }, w: WeaponId) => s.levels[w] ?? 0;
export const ALL_WEAPONS = WEAPONS.map((w) => w.id);
export function useVanguardHydrated() {
  return useSyncExternalStore((cb) => useVanguard.persist.onFinishHydration(cb), () => useVanguard.persist.hasHydrated(), () => false);
}
