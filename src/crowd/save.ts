// Blob Brigade save: stars per stage, best brigade per stage, Endless best, settings. Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LeaderId, MathMode } from "./types";
import { DEFAULT_LOOK, NO_UPGRADES, UPGRADES, upgradeCost, type Look, type UpgradeId, type Upgrades } from "./leaders";
import { useProfile } from "@/lib/store";
import { autoQuality as sharedAutoQuality } from "@/lib/perf";

export interface BrigadeSettings {
  math: MathMode;
  /** drag sensitivity 0.6 … 1.6 */
  sensitivity: number;
  quality: "auto" | "low" | "medium" | "high";
  vibrate: boolean;
}
export interface BrigadeSave {
  stars: Record<string, number>;
  best: Record<string, number>;
  endless: { wave: number; score: number };
  settings: BrigadeSettings;
  tutorialDone: boolean;
  plays: number; wins: number; pops: number; coinsEarned: number;
  leader: LeaderId;
  upgrades: Upgrades;
  /** highest Remix Loop stage cleared (100 = none yet) */
  remixBest: number;
  daily: { doneKey: string; streak: number; bestStreak: number; stars: Record<string, number> };
  rush: { bestTime: number; bestBosses: number; cleared: boolean };
  look: Look;
}
export interface BrigadeStore extends BrigadeSave {
  totalStars: () => number;
  setStars: (id: string, n: number) => void;
  setBest: (id: string, n: number) => boolean;
  setEndless: (wave: number, score: number) => boolean;
  setSettings: (p: Partial<BrigadeSettings>) => void;
  setTutorialDone: (v: boolean) => void;
  record: (won: boolean, pops: number, coins: number) => void;
  reset: () => void;
  setLeader: (id: LeaderId) => void;
  /** pays with site coins; false when maxed or too poor */
  buyUpgrade: (id: UpgradeId) => boolean;
  clearRemix: (n: number) => boolean;
  /** returns the streak after today's clear, or 0 when today was already done */
  dailyDone: (key: string, stars: number) => number;
  setRush: (time: number, bosses: number, cleared: boolean) => boolean;
  setLook: (p: Partial<Look>) => void;
}

const initial = (): BrigadeSave => ({
  stars: {}, best: {}, endless: { wave: 0, score: 0 },
  settings: { math: "plus", sensitivity: 1, quality: "auto", vibrate: true },
  tutorialDone: false, plays: 0, wins: 0, pops: 0, coinsEarned: 0,
  leader: "momo", upgrades: { ...NO_UPGRADES },
  remixBest: 100, daily: { doneKey: "", streak: 0, bestStreak: 0, stars: {} }, rush: { bestTime: 0, bestBosses: 0, cleared: false }, look: { ...DEFAULT_LOOK },
});
/** "2026-11-17" → "2026-11-16" */
const dayBefore = (key: string) => { const [y, m, d] = key.split("-").map(Number); const t = new Date(y, m - 1, d - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

export const useBrigade = create<BrigadeStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      totalStars: () => Object.values(get().stars).reduce((a, b) => a + b, 0),
      setStars: (id, n) => { if (n > (get().stars[id] ?? 0)) set({ stars: { ...get().stars, [id]: n } }); },
      setBest: (id, n) => { if (n > (get().best[id] ?? 0)) { set({ best: { ...get().best, [id]: n } }); return true; } return false; },
      setEndless: (wave, score) => {
        const e = get().endless;
        if (score > e.score || wave > e.wave) { set({ endless: { wave: Math.max(wave, e.wave), score: Math.max(score, e.score) } }); return score > e.score; }
        return false;
      },
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      setTutorialDone: (v) => { if (get().tutorialDone !== v) set({ tutorialDone: v }); },
      record: (won, pops, coins) => set({ plays: get().plays + 1, wins: get().wins + (won ? 1 : 0), pops: get().pops + pops, coinsEarned: get().coinsEarned + coins }),
      reset: () => set(initial()),
      setLeader: (id) => set({ leader: id }),
      clearRemix: (n) => { if (n > get().remixBest) { set({ remixBest: n }); return true; } return false; },
      dailyDone: (key, stars) => {
        const d = get().daily;
        const best = { ...d.stars, [key]: Math.max(stars, d.stars[key] ?? 0) };
        if (d.doneKey === key) { set({ daily: { ...d, stars: best } }); return 0; }
        const streak = d.doneKey === dayBefore(key) ? d.streak + 1 : 1;
        set({ daily: { doneKey: key, streak, bestStreak: Math.max(d.bestStreak, streak), stars: best } });
        return streak;
      },
      setRush: (time, bosses, cleared) => {
        const r = get().rush;
        const better = cleared && (!r.cleared || time < r.bestTime);
        set({ rush: { bestTime: better ? time : r.bestTime, bestBosses: Math.max(r.bestBosses, bosses), cleared: r.cleared || cleared } });
        return better;
      },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      buyUpgrade: (id) => {
        const lvl = get().upgrades[id] ?? 0, def = UPGRADES.find((u) => u.id === id);
        if (!def || lvl >= def.max) return false;
        if (!useProfile.getState().spendCoins(upgradeCost(lvl))) return false;
        set({ upgrades: { ...get().upgrades, [id]: lvl + 1 } });
        return true;
      },
    }),
    {
      name: "momoblobs:blob-brigade", version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BrigadeSave>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, endless: { ...current.endless, ...p.endless }, upgrades: { ...current.upgrades, ...p.upgrades },
          daily: { ...current.daily, ...p.daily }, rush: { ...current.rush, ...p.rush }, look: { ...current.look, ...p.look } };
      },
    },
  ),
);

export function useBrigadeHydrated() {
  return useSyncExternalStore(
    (cb) => {
      const p = useBrigade.persist;
      if (!p.hasHydrated()) void p.rehydrate();
      return p.onFinishHydration(cb);
    },
    () => useBrigade.persist.hasHydrated(),
    () => false,
  );
}

/** pick a graphics level for "auto": phones and small CPUs get the lighter look */
export function autoQuality(): "low" | "medium" | "high" { return sharedAutoQuality(); }
