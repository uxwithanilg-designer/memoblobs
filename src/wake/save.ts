// Wake Racers progress on this device: the stage you're on (leave and come back, you start right there), coins, the
// boats you own and their tuning, the boat and paint you race with, paints owned, stars per stage and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BOATS, MAX_LEVEL, PAINTS, upgradeCost, type BoatId, type Upgrade } from "./boats";
import type { Snapshot } from "./race";

interface WakeSave {
  stage: number;
  coins: number;
  boat: BoatId;
  boats: BoatId[];
  tune: Partial<Record<BoatId, Partial<Record<Upgrade, number>>>>;
  paint: string;
  paints: string[];
  /** 1–3 stars per cleared stage (index = stage − 1) */
  stars: number[];
  wins: number;
  races: number;
  seenHelp: boolean;
  quality: "auto" | "low" | "medium" | "high";
  camera: "chase" | "far";
  /** a race left mid-way: the stage and the last checkpoint reached */
  resume: { stage: number; cp: number; of: number; snap: Snapshot } | null;
}
interface WakeStore extends WakeSave {
  addCoins: (n: number) => void;
  clear: (stage: number, stars: number) => void;
  played: () => void;
  goTo: (stage: number) => void;
  buyBoat: (id: BoatId) => boolean;
  useBoat: (id: BoatId) => void;
  upgrade: (id: BoatId, u: Upgrade) => boolean;
  buyPaint: (id: string) => boolean;
  usePaint: (id: string) => void;
  sawHelp: () => void;
  setQuality: (q: WakeSave["quality"]) => void;
  setCamera: (c: WakeSave["camera"]) => void;
  setResume: (r: WakeSave["resume"]) => void;
}
const FRESH: WakeSave = { stage: 1, coins: 0, boat: "minnow", boats: ["minnow"], tune: {}, paint: "stock", paints: ["stock"], stars: [], wins: 0, races: 0, seenHelp: false, quality: "auto", camera: "chase", resume: null };

export const useWake = create<WakeStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      addCoins: (n) => set((s) => ({ coins: Math.max(0, Math.floor(s.coins + n)) })),
      clear: (stage, stars) => set((s) => {
        const st = s.stars.slice();
        if (stage <= 5000) { while (st.length < stage) st.push(0); st[stage - 1] = Math.max(st[stage - 1] ?? 0, stars); }
        return { stage: Math.max(s.stage, stage + 1), stars: st, wins: s.wins + 1 };
      }),
      played: () => set((s) => ({ races: s.races + 1 })),
      goTo: (stage) => set((s) => (stage <= s.stage ? { stage: s.stage } : s)),
      buyBoat: (id) => {
        const s = get(), b = BOATS.find((x) => x.id === id);
        if (!b || s.boats.includes(id) || s.coins < b.price) return false;
        set({ coins: s.coins - b.price, boats: [...s.boats, id], boat: id });
        return true;
      },
      useBoat: (id) => { if (get().boats.includes(id)) set({ boat: id }); },
      upgrade: (id, u) => {
        const s = get(), lv = s.tune[id]?.[u] ?? 0;
        if (!s.boats.includes(id) || lv >= MAX_LEVEL) return false;
        const cost = upgradeCost(id, lv);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, tune: { ...s.tune, [id]: { ...(s.tune[id] ?? {}), [u]: lv + 1 } } });
        return true;
      },
      buyPaint: (id) => {
        const s = get(), p = PAINTS.find((x) => x.id === id);
        if (!p || s.paints.includes(id) || s.coins < p.price) return false;
        set({ coins: s.coins - p.price, paints: [...s.paints, id], paint: id });
        return true;
      },
      usePaint: (id) => { if (get().paints.includes(id)) set({ paint: id }); },
      sawHelp: () => set({ seenHelp: true }),
      setQuality: (quality) => set({ quality }),
      setCamera: (camera) => set({ camera }),
      setResume: (resume) => set({ resume }),
    }),
    { name: "momoblobs-wakeracers", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<WakeSave>) }) as WakeStore },
  ),
);

/** true once the saved progress has been read back from the device */
export function useWakeHydrated() {
  return useSyncExternalStore(
    (cb) => useWake.persist.onFinishHydration(cb),
    () => useWake.persist.hasHydrated(),
    () => false,
  );
}
