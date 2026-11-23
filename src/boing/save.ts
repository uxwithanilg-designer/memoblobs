// Momo Boing! save: the stage you are on (stages come one by one, no stage select), stars and best score per stage,
// the Endless Climb record, settings, tutorial. Coins use the site-wide wallet. Leaving a climb half-way simply means the
// stage starts from the bottom next time.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { autoQuality as sharedAutoQuality } from "@/lib/perf";

export interface BoingSettings {
  /** drag sensitivity 0.6 … 1.6 */
  sensitivity: number;
  quality: "auto" | "low" | "medium" | "high";
  vibrate: boolean;
}
export interface BoingSave {
  stars: Record<string, number>;
  best: Record<string, number>;
  settings: BoingSettings;
  tutorialDone: boolean;
  /** the next stage to play */
  current: number;
  endless: { best: number };
  /** losses per stage (the quiet helper kicks in after a few) */
  fails: Record<string, number>;
  daily: { doneKey: string; streak: number; bestStreak: number };
  /** your best try at the stage you are on (x, y every 0.1 s) */
  ghost: { id: string; score: number; pts: number[] } | null;
  look: { hat: string; trail: string };
  owned: string[];
  plays: number; wins: number; perfects: number; coinsEarned: number; bestChain: number;
}
export interface BoingStore extends BoingSave {
  totalStars: () => number;
  setStars: (id: string, n: number) => void;
  setBest: (id: string, score: number) => boolean;
  setSettings: (p: Partial<BoingSettings>) => void;
  setTutorialDone: (v: boolean) => void;
  /** after a win: move on to the next stage */
  advance: (n: number, max: number) => void;
  setEndless: (height: number) => boolean;
  noteResult: (id: string, won: boolean) => void;
  /** returns the streak after today's climb, or 0 when today was already done */
  dailyDone: (key: string) => number;
  setGhost: (id: string, score: number, pts: number[]) => void;
  /** pays with site coins; false when too poor */
  buy: (item: string, price: number) => boolean;
  setLook: (p: Partial<BoingSave["look"]>) => void;
  record: (won: boolean, perfects: number, chain: number, coins: number) => void;
  reset: () => void;
}

const initial = (): BoingSave => ({
  stars: {}, best: {}, settings: { sensitivity: 1, quality: "auto", vibrate: true },
  tutorialDone: false, current: 1, endless: { best: 0 }, fails: {}, daily: { doneKey: "", streak: 0, bestStreak: 0 }, ghost: null, look: { hat: "none", trail: "none" }, owned: [], plays: 0, wins: 0, perfects: 0, coinsEarned: 0, bestChain: 0,
});

export const useBoing = create<BoingStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      totalStars: () => Object.values(get().stars).reduce((a, b) => a + b, 0),
      setStars: (id, n) => { if (n > (get().stars[id] ?? 0)) set({ stars: { ...get().stars, [id]: n } }); },
      setBest: (id, score) => { if (score > (get().best[id] ?? 0)) { set({ best: { ...get().best, [id]: score } }); return true; } return false; },
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: (v) => { if (get().tutorialDone !== v) set({ tutorialDone: v }); },
      advance: (n, max) => { if (n + 1 > get().current) set({ current: Math.min(max, n + 1) }); },
      setEndless: (h) => { if (h > get().endless.best) { set({ endless: { best: h } }); return true; } return false; },
      noteResult: (id, won) => {
        const f = { ...get().fails };
        if (won) delete f[id]; else f[id] = (f[id] ?? 0) + 1;
        set({ fails: f });
      },
      dailyDone: (key) => {
        const d = get().daily;
        if (d.doneKey === key) return 0;
        const [y, m, dd] = key.split("-").map(Number), prev = new Date(y, m - 1, dd - 1);
        const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
        const streak = d.doneKey === prevKey ? d.streak + 1 : 1;
        set({ daily: { doneKey: key, streak, bestStreak: Math.max(d.bestStreak, streak) } });
        return streak;
      },
      setGhost: (id, score, pts) => { const g = get().ghost; if (!g || g.id !== id || score > g.score) set({ ghost: { id, score, pts } }); },
      buy: (item, price) => {
        if (get().owned.includes(item)) return true;
        if (!useProfile.getState().spendCoins(price)) return false;
        set({ owned: [...get().owned, item] });
        return true;
      },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      record: (won, perfects, chain, coins) => set({
        plays: get().plays + 1, wins: get().wins + (won ? 1 : 0), perfects: get().perfects + perfects,
        bestChain: Math.max(get().bestChain, chain), coinsEarned: get().coinsEarned + coins,
      }),
      reset: () => set(initial()),
    }),
    {
      name: "momoblobs:momo-boing", version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BoingSave>;
        if (p.current == null && p.stars) p.current = 1 + Math.max(0, ...Object.entries(p.stars).filter(([, v]) => v > 0).map(([k]) => Number(k.slice(1)) || 0));
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, endless: { ...current.endless, ...p.endless }, daily: { ...current.daily, ...p.daily }, look: { ...current.look, ...p.look } };
      },
    },
  ),
);

export function useBoingHydrated() {
  return useSyncExternalStore(
    (cb) => {
      const p = useBoing.persist;
      if (!p.hasHydrated()) void p.rehydrate();
      return p.onFinishHydration(cb);
    },
    () => useBoing.persist.hasHydrated(),
    () => false,
  );
}

/** "auto" graphics: phones and small CPUs get the lighter look */
export function autoQuality(): "low" | "medium" | "high" { return sharedAutoQuality(); }
