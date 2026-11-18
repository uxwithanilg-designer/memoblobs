// Puddo's Clayland: Rain Raid save (on this device): how far you've got, the medals of every stage (cleared, Rain Drops,
// no-hit), the Rain Bells rung, Endless Storm progress, the Blaster Shop levels, the stories already seen and settings.
// Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { DESIGNED, STAGES_PER_ISLAND } from "./islands";
import { DAILY_BASE } from "./stages";
import type { FriendId, SimResult } from "./types";
import { NO_UPGRADES, UPGRADES, type UpgradeId, type Upgrades } from "./weapons";

/** who you play as and what they wear (bought with the site's coins) */
export type CharId = "puddo" | "momo" | "pip" | "gloop" | "zib";
export interface ClayLook { char: CharId; hat: string; trail: string }
export interface DailyState { key: number; cleared: boolean; noHit: boolean; streak: number; best: number; lastClear: number }
/** Bonbon's Snack Stop: bought after a boss, used by the next stage */
export interface Snack { friend?: FriendId; heart?: boolean; bombs?: boolean }

export interface ClaySettings { quality: "auto" | "low" | "medium" | "high"; vibrate: boolean; easyRun: boolean; bigButtons: boolean }
export interface Medal { c: boolean; d: number; nh: boolean; t: number }
export interface ClaySave {
  /** the highest stage you may play (1 = only the first) */
  unlocked: number;
  /** the stage Continue starts */
  next: number;
  medals: Record<number, Medal>;
  /** Remix Isles: the next remix stage number (301+) */
  remix: number;
  storiesSeen: number[];
  /** the how-to-play pages and the first-stage coach */
  tutorialSeen: boolean; coachDone: boolean;
  endingSeen: boolean;
  settings: ClaySettings;
  coinsEarned: number; plays: number; drops: number;
  look: ClayLook; owned: string[]; daily: DailyState; snack: Snack;
  /** the Blaster Shop's levels */
  upgrades: Upgrades;
}
export interface ClayStore extends ClaySave {
  finish: (r: SimResult) => { firstClear: boolean; newDrops: number; newNoHit: boolean };
  setNext: (n: number) => void;
  seeStory: (island: number) => void;
  seeTutorial: () => void;
  finishCoach: () => void;
  seeEnding: () => void;
  setSettings: (p: Partial<ClaySettings>) => void;
  /** buy a character / hat / trail with site coins (false = not enough coins) */
  buy: (id: string, price: number) => boolean;
  setLook: (p: Partial<ClayLook>) => void;
  setSnack: (s: Snack) => void;
  /** the snack for the stage that's starting (and it's used up) */
  takeSnack: () => Snack;
  /** the Daily Island result: coins for the first clear of the day, a no-hit bonus, the streak */
  finishDaily: (day: number, cleared: boolean, noHit: boolean) => { reward: number; streak: number; first: boolean };
  /** buy the next level of a Blaster Shop upgrade (false = maxed or not enough coins) */
  upgrade: (id: UpgradeId) => boolean;
  reset: () => void;
}

const initial = (): ClaySave => ({
  unlocked: 1, next: 1, medals: {}, remix: DESIGNED + 1, storiesSeen: [], tutorialSeen: false, coachDone: false, endingSeen: false, settings: { quality: "auto", vibrate: true, easyRun: false, bigButtons: false },
  coinsEarned: 0, plays: 0, drops: 0, look: { char: "puddo", hat: "none", trail: "none" }, owned: [],
  daily: { key: 0, cleared: false, noHit: false, streak: 0, best: 0, lastClear: 0 }, snack: {}, upgrades: { ...NO_UPGRADES },
});

export const useClay = create<ClayStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      finish: (r) => {
        const st = get(), old = st.medals[r.n];
        if (r.n >= DAILY_BASE) {
          // the Daily Island keeps no medals or progress of its own (finishDaily pays out)
          set({ plays: st.plays + 1, coinsEarned: st.coinsEarned + (r.cleared ? r.coins : 0) });
          if (r.cleared && r.coins > 0) useProfile.getState().earnCoins(r.coins);
          return { firstClear: false, newDrops: 0, newNoHit: false };
        }
        const m: Medal = { c: (old?.c ?? false) || r.cleared, d: Math.max(old?.d ?? 0, r.cleared ? r.drops : 0), nh: (old?.nh ?? false) || (r.cleared && r.noHit), t: r.cleared ? Math.min(old?.t || 1e9, Math.round(r.time)) : old?.t ?? 0 };
        const firstClear = r.cleared && !old?.c;
        const newDrops = Math.max(0, m.d - (old?.d ?? 0));
        const newNoHit = m.nh && !old?.nh;
        let unlocked = st.unlocked, next = st.next, remix = st.remix;
        if (r.cleared) {
          if (r.n <= DESIGNED) { unlocked = Math.max(unlocked, Math.min(DESIGNED + 1, r.n + 1)); next = r.n + 1; }
          else { remix = Math.max(remix, r.n + 1); next = r.n + 1; }
        }
        if (r.cleared && r.coins > 0) useProfile.getState().earnCoins(r.coins);
        set({ medals: { ...st.medals, [r.n]: m }, unlocked, next, remix, coinsEarned: st.coinsEarned + (r.cleared ? r.coins : 0), plays: st.plays + 1, drops: st.drops + newDrops });
        return { firstClear, newDrops, newNoHit };
      },
      setNext: (n) => set({ next: n }),
      seeTutorial: () => set({ tutorialSeen: true }),
      finishCoach: () => set({ coachDone: true }),
      seeStory: (i) => { if (!get().storiesSeen.includes(i)) set({ storiesSeen: [...get().storiesSeen, i] }); },
      seeEnding: () => set({ endingSeen: true }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      buy: (id, price) => {
        if (get().owned.includes(id)) return true;
        if (!useProfile.getState().spendCoins(price)) return false;
        set({ owned: [...get().owned, id] });
        return true;
      },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      setSnack: (s) => set({ snack: s }),
      takeSnack: () => { const s = get().snack; if (s.friend || s.heart || s.bombs) set({ snack: {} }); return s; },
      upgrade: (id) => {
        const u = get().upgrades, def = UPGRADES.find((d) => d.id === id)!, lvl = u[id] ?? 0;
        if (lvl >= def.prices.length) return false;
        if (!useProfile.getState().spendCoins(def.prices[lvl])) return false;
        set({ upgrades: { ...u, [id]: lvl + 1 } });
        return true;
      },
      finishDaily: (day, cleared, noHit) => {
        const d = get().daily;
        const today = d.key === day ? d : { ...d, key: day, cleared: false, noHit: false };
        if (!cleared) { set({ daily: today }); return { reward: 0, streak: today.streak, first: false }; }
        const first = !today.cleared, firstNoHit = noHit && !today.noHit;
        const streak = first ? (today.lastClear === day - 1 ? today.streak + 1 : 1) : today.streak;
        const reward = (first ? 50 + Math.min(10, streak) * 10 : 0) + (firstNoHit ? 100 : 0);
        if (reward) useProfile.getState().earnCoins(reward);
        set({ daily: { key: day, cleared: true, noHit: today.noHit || noHit, streak, best: Math.max(today.best, streak), lastClear: day } });
        return { reward, streak, first };
      },
      reset: () => set(initial()),
    }),
    {
      name: "momoblobs-clayland", storage: createJSONStorage(() => localStorage), version: 4,
      // Rain Raid (v4) is a new campaign: v1–v3 progress starts over; the wardrobe, the daily streak and settings stay
      migrate: (old, version) => {
        const prev = old as Partial<ClaySave>;
        const o = { ...initial(), ...prev };
        if (version < 4) Object.assign(o, { unlocked: 1, next: 1, medals: {}, remix: DESIGNED + 1, storiesSeen: [], endingSeen: false, plays: 0, drops: 0, snack: {}, upgrades: { ...NO_UPGRADES } });
        if (o.look.char === "momo" && !o.owned.includes("char:momo")) o.look = { ...o.look, char: "puddo" };
        o.upgrades = { ...NO_UPGRADES, ...(o.upgrades ?? {}) };
        return o;
      },
    },
  ),
);

export function useClayHydrated() {
  return useSyncExternalStore(
    (cb) => { const p = useClay.persist; return p.onFinishHydration(cb); },
    () => useClay.persist.hasHydrated(),
    () => false,
  );
}

/** hearts come from the Blaster Shop (3 → 6) */
export const heartsFor = (u: Upgrades) => 3 + (u.hearts ?? 0);
/** Rain Bells rung = boss stages cleared */
export const bellsRung = (medals: Record<number, Medal>) => Object.entries(medals).filter(([n, m]) => m.c && Number(n) <= DESIGNED && Number(n) % STAGES_PER_ISLAND === 0).length;

/** "auto" graphics: small CPUs get the lighter look */
export function autoQuality(): "low" | "medium" | "high" {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
  if (cores <= 4) return "low";
  return touch ? "medium" : "high";
}
