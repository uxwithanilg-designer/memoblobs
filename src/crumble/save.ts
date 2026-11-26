// Crumble Crew progress on this device: the heist you're on and the site and goal inside it (saved after every goal,
// so leave mid-heist and you come back to the same goal), coins, lives, the tools and guns you own, their levels, the
// four guns you carry, your bombs and the kind ready to throw, the suit, the hoodie, the view, and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { GUN_SLOTS, MAX_LEVEL, OUTFITS, SUIT_MAX, bombOf, isGun, suitCost, toolOf, upgradeCost, type BombId, type SuitId, type ToolId } from "./gear";

interface CrumbleSave {
  heist: number; site: number; goal: number;
  coins: number; lives: number;
  owned: ToolId[]; levels: Partial<Record<ToolId, number>>;
  /** the guns you carry (up to four, in the gun bar) */
  loadout: ToolId[];
  bombs: Partial<Record<BombId, number>>; bomb: BombId;
  suit: Record<SuitId, number>;
  outfits: string[]; outfit: string;
  firstPerson: boolean;
  heists: number; loot: number; blocks: number; bots: number;
  seenHelp: boolean; tutorial: boolean;
}
interface CrumbleStore extends CrumbleSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  setBombs: (b: Partial<Record<BombId, number>>, current: BombId) => void;
  /** a goal is won: come back here */
  checkpoint: (heist: number, site: number, goal: number, totals: { loot: number; blocks: number; bots: number }) => void;
  /** the heist is won: on to `next` */
  done: (next: number, totals: { loot: number; blocks: number; bots: number }) => void;
  buyTool: (t: ToolId) => boolean;
  upgradeTool: (t: ToolId) => boolean;
  equip: (slot: number, t: ToolId) => void;
  buyBombs: (b: BombId) => boolean;
  upgradeSuit: (s: SuitId) => boolean;
  buyOutfit: (o: string) => boolean;
  wear: (o: string) => void;
  setView: (first: boolean) => void;
  sawHelp: () => void;
  sawTutorial: () => void;
}
export const START_LIVES = 3, MAX_LIVES = 5;
const FRESH: CrumbleSave = {
  heist: 1, site: 0, goal: 0, coins: 0, lives: START_LIVES,
  owned: ["hammer", "blaster"], levels: {}, loadout: ["blaster"], bombs: { dynamite: 3, ball: 3, sticky: 1 }, bomb: "dynamite",
  suit: { armor: 0, boots: 0, bag: 0, tank: 0 }, outfits: ["classic"], outfit: "classic", firstPerson: true,
  heists: 0, loot: 0, blocks: 0, bots: 0, seenHelp: false, tutorial: false,
};
const add = (s: CrumbleSave, t: { loot: number; blocks: number; bots: number }) => ({ loot: s.loot + t.loot, blocks: s.blocks + t.blocks, bots: s.bots + t.bots });

export const useCrumble = create<CrumbleStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(MAX_LIVES, n)) }),
      setBombs: (b, current) => set({ bombs: { ...b }, bomb: current }),
      checkpoint: (heist, site, goal, t) => set((s) => (heist === s.heist ? { site, goal, ...add(s, t) } : add(s, t))),
      done: (next, t) => set((s) => (next > s.heist ? { heist: next, site: 0, goal: 0, heists: s.heists + 1, ...add(s, t) } : add(s, t))),
      buyTool: (id) => {
        const s = get(), t = toolOf(id);
        if (s.owned.includes(id) || s.coins < t.price || t.mission) return false;
        // a new gun goes into a free slot of the gun bar (or takes the first one's place when all four are full)
        const loadout = !isGun(id) ? s.loadout : s.loadout.length < GUN_SLOTS ? [...s.loadout, id] : [...s.loadout.slice(1), id];
        set({ coins: s.coins - t.price, owned: [...s.owned, id], loadout });
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
      equip: (slot, id) => {
        const s = get();
        if (!s.owned.includes(id) || !isGun(id)) return;
        const l = s.loadout.filter((x) => x !== id);
        l.splice(Math.min(slot, l.length), 0, id);
        set({ loadout: l.slice(0, GUN_SLOTS) });
      },
      buyBombs: (id) => {
        const s = get(), b = bombOf(id), have = s.bombs[id] ?? 0;
        if (!b.pack || s.coins < b.price || have >= b.max) return false;
        set({ coins: s.coins - b.price, bombs: { ...s.bombs, [id]: Math.min(b.max, have + b.pack) } });
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
      sawTutorial: () => set({ tutorial: true }),
    }),
    {
      name: "momoblobs-crumblecrew", version: 2, storage: createJSONStorage(() => localStorage),
      migrate: (old) => {
        // version 1 had boom balls and dynamite as tools with ammo: they're bombs now
        const o = old as Partial<CrumbleSave> & { ammo?: Partial<Record<string, number>>; owned?: string[] };
        const owned = (o.owned ?? FRESH.owned).filter((t: string) => t !== "grenade" && t !== "dynamite") as ToolId[];
        const bombs = { ...FRESH.bombs, ball: (o.ammo?.grenade ?? 0) + 3, dynamite: Math.max(3, o.ammo?.dynamite ?? 0) };
        const loadout = owned.filter((t) => isGun(t)).slice(0, GUN_SLOTS);
        return { ...FRESH, ...o, owned, loadout: loadout.length ? loadout : ["blaster"], bombs, bomb: "dynamite", tutorial: false } as unknown as CrumbleStore;
      },
    },
  ),
);
export function useCrumbleHydrated() {
  return useSyncExternalStore((cb) => useCrumble.persist.onFinishHydration(cb), () => useCrumble.persist.hasHydrated(), () => false);
}
