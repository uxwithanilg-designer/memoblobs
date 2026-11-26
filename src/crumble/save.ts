// Crumble Crew progress on this device: the heist you're on and the site and goal inside it (saved after every goal,
// so leave mid-heist and you come back to the same goal), coins, lives, the tools you own, their levels and the
// explosives you carry, the suit, the hoodie, the view, and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LEVEL, OUTFITS, SUIT_MAX, TOOLS, suitCost, toolOf, upgradeCost, type SuitId, type ToolId } from "./gear";

interface CrumbleSave {
  heist: number; site: number; goal: number;
  coins: number; lives: number;
  owned: ToolId[]; levels: Partial<Record<ToolId, number>>; ammo: Partial<Record<ToolId, number>>;
  suit: Record<SuitId, number>;
  outfits: string[]; outfit: string;
  firstPerson: boolean;
  heists: number; loot: number; blocks: number; bots: number;
  seenHelp: boolean;
}
interface CrumbleStore extends CrumbleSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  setAmmo: (a: Partial<Record<ToolId, number>>) => void;
  /** a goal is won: come back here */
  checkpoint: (heist: number, site: number, goal: number, totals: { loot: number; blocks: number; bots: number }) => void;
  /** the heist is won: on to `next` */
  done: (next: number, totals: { loot: number; blocks: number; bots: number }) => void;
  buyTool: (t: ToolId) => boolean;
  upgradeTool: (t: ToolId) => boolean;
  buyAmmo: (t: ToolId) => boolean;
  upgradeSuit: (s: SuitId) => boolean;
  buyOutfit: (o: string) => boolean;
  wear: (o: string) => void;
  setView: (first: boolean) => void;
  sawHelp: () => void;
}
export const START_LIVES = 3, MAX_LIVES = 5;
const FRESH: CrumbleSave = {
  heist: 1, site: 0, goal: 0, coins: 0, lives: START_LIVES,
  owned: ["hammer", "blaster", "dynamite"], levels: {}, ammo: { dynamite: 3 },
  suit: { armor: 0, boots: 0, bag: 0, tank: 0 }, outfits: ["classic"], outfit: "classic", firstPerson: true,
  heists: 0, loot: 0, blocks: 0, bots: 0, seenHelp: false,
};
const add = (s: CrumbleSave, t: { loot: number; blocks: number; bots: number }) => ({ loot: s.loot + t.loot, blocks: s.blocks + t.blocks, bots: s.bots + t.bots });

export const useCrumble = create<CrumbleStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(MAX_LIVES, n)) }),
      setAmmo: (a) => set({ ammo: { ...get().ammo, ...a } }),
      checkpoint: (heist, site, goal, t) => set((s) => (heist === s.heist ? { site, goal, ...add(s, t) } : add(s, t))),
      done: (next, t) => set((s) => (next > s.heist ? { heist: next, site: 0, goal: 0, heists: s.heists + 1, ...add(s, t) } : add(s, t))),
      buyTool: (id) => {
        const s = get(), t = toolOf(id);
        if (s.owned.includes(id) || s.coins < t.price) return false;
        set({ coins: s.coins - t.price, owned: [...s.owned, id], ammo: t.ammo ? { ...s.ammo, [id]: t.ammo } : s.ammo });
        return true;
      },
      upgradeTool: (id) => {
        const s = get(), lv = s.levels[id] ?? 0;
        if (!s.owned.includes(id) || lv >= MAX_LEVEL) return false;
        const cost = upgradeCost(toolOf(id), lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, levels: { ...s.levels, [id]: lv + 1 } });
        return true;
      },
      buyAmmo: (id) => {
        const s = get(), t = toolOf(id);
        if (!s.owned.includes(id) || !t.pack || s.coins < t.packPrice) return false;
        set({ coins: s.coins - t.packPrice, ammo: { ...s.ammo, [id]: Math.min(t.ammo * 4, (s.ammo[id] ?? 0) + t.pack) } });
        return true;
      },
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
    { name: "momoblobs-crumblecrew", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<CrumbleSave>) }) as CrumbleStore },
  ),
);
export const ALL_TOOLS = TOOLS.map((t) => t.id);
export function useCrumbleHydrated() {
  return useSyncExternalStore((cb) => useCrumble.persist.onFinishHydration(cb), () => useCrumble.persist.hasHydrated(), () => false);
}
