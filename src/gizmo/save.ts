// Gizmo Drive progress on this device: the stage you're on and the last checkpoint you reached (so leaving and coming
// back starts you right there), coins, lives, the paint jobs you own and wear, the rides you've driven, stars per
// stage band and a few totals.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { paintOf, type PaintId, type VehicleId } from "./vehicles";

interface GizmoSave {
  stage: number;
  checkpoint: number;
  coins: number;
  lives: number;
  paint: PaintId;
  paints: PaintId[];
  /** rides met so far (the garage shows them) */
  rides: VehicleId[];
  cleared: number;
  flips: number;
  /** 1–3 stars for each cleared stage (index = stage − 1, 0 = not yet) */
  stars: number[];
  seenHelp: boolean;
}
interface GizmoStore extends GizmoSave {
  setCoins: (n: number) => void;
  setLives: (n: number) => void;
  reach: (stage: number, cp: number) => void;
  clear: (stage: number, flips: number, stars: number) => void;
  meet: (v: VehicleId) => void;
  wear: (p: PaintId) => void;
  buy: (p: PaintId) => boolean;
  sawHelp: () => void;
}
const FRESH: GizmoSave = { stage: 1, checkpoint: 0, coins: 0, lives: 3, paint: "stock", paints: ["stock"], rides: [], cleared: 0, flips: 0, stars: [], seenHelp: false };

export const useGizmo = create<GizmoStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setLives: (n) => set({ lives: Math.max(0, Math.min(5, n)) }),
      reach: (stage, cp) => set((s) => (stage === s.stage ? { checkpoint: Math.max(s.checkpoint, cp) } : s)),
      clear: (stage, flips, stars) => set((s) => {
        const st = s.stars.slice();
        if (stage <= 2000) { while (st.length < stage) st.push(0); st[stage - 1] = Math.max(st[stage - 1] ?? 0, stars); }
        return { stage: Math.max(s.stage, stage + 1), checkpoint: 0, cleared: s.cleared + (stage >= s.stage ? 1 : 0), flips: s.flips + flips, stars: st };
      }),
      meet: (v) => { if (!get().rides.includes(v)) set((s) => ({ rides: [...s.rides, v] })); },
      wear: (p) => { if (get().paints.includes(p)) set({ paint: p }); },
      buy: (p) => {
        const s = get(), price = paintOf(p).price;
        if (s.paints.includes(p) || s.coins < price) return false;
        set({ coins: s.coins - price, paints: [...s.paints, p], paint: p });
        return true;
      },
      sawHelp: () => set({ seenHelp: true }),
    }),
    { name: "momoblobs-gizmodrive", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<GizmoSave>) }) as GizmoStore },
  ),
);
export function useGizmoHydrated() {
  return useSyncExternalStore((cb) => useGizmo.persist.onFinishHydration(cb), () => useGizmo.persist.hasHydrated(), () => false);
}
