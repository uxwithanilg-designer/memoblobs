// Tondu's Vine Climb save (on this device): the stage you're on (the climb picks up exactly there), the best stage,
// the Wild Canopy (its next stage and the fingerprints already climbed), the Bug Book, Sun Seeds, upgrades, the
// Wardrobe, the Daily Vine streak, missions, settings and the first-time tips. Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { CAMPAIGN } from "./worlds";
import { WILD_FROM, wildDef, wildPrint } from "./stages";
import { autoQuality as sharedAutoQuality } from "@/lib/perf";

export type Upgrade = "regrow" | "rush" | "snap" | "grip" | "shield";
export const UPGRADES: { id: Upgrade; name: string; text: string; max: number }[] = [
  { id: "regrow", name: "Quick Tail", text: "The tail grows back after fewer bugs", max: 5 },
  { id: "rush", name: "Sun Rush+", text: "Sun Rush lasts longer", max: 5 },
  { id: "snap", name: "Long Snap", text: "Snap bugs from further away", max: 5 },
  { id: "grip", name: "Strong Grip", text: "Cling for longer", max: 5 },
  { id: "shield", name: "Moss Start", text: "Start every climb with a Moss Shield", max: 1 },
];
export const UPGRADE_PRICE = [120, 280, 520, 900, 1500];
export const HATS = [
  { id: "none", name: "No hat", price: 0 }, { id: "party", name: "Party hat", price: 150 }, { id: "flower", name: "Flower", price: 200 },
  { id: "chef", name: "Chef hat", price: 250 }, { id: "wizard", name: "Wizard hat", price: 350 }, { id: "crown", name: "Crown", price: 600 },
];

export interface Mission { id: string; text: string; goal: number; got: number; coins: number }
const MISSION_POOL: Omit<Mission, "got">[] = [
  { id: "bugs", text: "Snap {n} bugs", goal: 120, coins: 60 }, { id: "gold", text: "Snap {n} golden beetles", goal: 25, coins: 60 },
  { id: "flips", text: "Flip {n} times", goal: 200, coins: 50 }, { id: "gates", text: "Pass {n} flower gates", goal: 6, coins: 80 },
  { id: "combo", text: "Reach a {n}-bug combo", goal: 25, coins: 90 }, { id: "rush", text: "Sun Rush {n} times", goal: 4, coins: 70 },
  { id: "crown", text: "Beat a guardian", goal: 1, coins: 120 }, { id: "rival", text: "Beat Zeeza in a race", goal: 1, coins: 100 },
  { id: "leaps", text: "Leap {n} gaps", goal: 20, coins: 70 }, { id: "smash", text: "Smash {n} thorns in Sun Rush", goal: 10, coins: 80 },
];

export interface VineSettings { quality: "auto" | "low" | "medium" | "high"; vibrate: boolean }
export interface VineSave {
  stage: number; best: number; wild: number; seen: string[];
  /** Bug Book: species index (as string) or "gold" → how many snapped */
  book: Record<string, number>;
  seeds: number;
  up: Record<Upgrade, number>;
  look: { skin: string; hat: string }; owned: string[];
  daily: { day: number; cleared: boolean; streak: number; best: number };
  missions: Mission[]; missionsDone: number;
  settings: VineSettings;
  tips: { flip: boolean; cling: boolean; leap: boolean };
  stats: { bugs: number; falls: number; gates: number; time: number };
  plays: number;
}
export interface VineStore extends VineSave {
  /** a flower gate passed: save the next stage, count bugs, pay coins; returns coins */
  gate: (n: number, next: number, r: { bugs: number; gold: number; best: number; crown: boolean; rivalWon: boolean | null; kinds: Record<string, number> }) => number;
  fell: () => void;
  wildSeen: (fp: string) => void;
  finishDaily: (day: number) => { coins: number; streak: number; first: boolean };
  buyUp: (id: Upgrade) => boolean;
  buy: (id: string, price: number) => boolean;
  setLook: (p: Partial<VineSave["look"]>) => void;
  setSettings: (p: Partial<VineSettings>) => void;
  tip: (k: keyof VineSave["tips"]) => void;
  progress: (id: string, add: number, set?: boolean) => void;
  setStage: (n: number) => void;
  reset: () => void;
}
const freshMissions = (seed: number): Mission[] => {
  const out: Mission[] = []; let i = seed;
  while (out.length < 3) { const m = MISSION_POOL[(i * 7 + 3) % MISSION_POOL.length]; i++; if (!out.some((x) => x.id === m.id)) out.push({ ...m, text: m.text.replace("{n}", String(m.goal)), got: 0 }); }
  return out;
};
const FRESH: VineSave = {
  stage: 1, best: 1, wild: WILD_FROM, seen: [], book: {}, seeds: 0,
  up: { regrow: 0, rush: 0, snap: 0, grip: 0, shield: 0 },
  look: { skin: "classic", hat: "none" }, owned: ["classic", "none"],
  daily: { day: -1, cleared: false, streak: 0, best: 0 },
  missions: freshMissions(1), missionsDone: 0,
  settings: { quality: "auto", vibrate: true },
  tips: { flip: false, cling: false, leap: false },
  stats: { bugs: 0, falls: 0, gates: 0, time: 0 }, plays: 0,
};

export const useVine = create<VineStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      gate: (n, next, r) => {
        const g = get();
        const book = { ...g.book };
        for (const [k, v] of Object.entries(r.kinds)) book[k] = (book[k] ?? 0) + v;
        const coins = r.gold * 2 + Math.floor(r.bugs / 8) + 5 + (r.crown ? 60 : 0) + (r.rivalWon ? 30 : 0);
        const best = Math.max(g.best, next <= CAMPAIGN ? next : g.best);
        set({
          stage: next, best: next > CAMPAIGN ? Math.max(best, CAMPAIGN) : best, book,
          wild: n >= WILD_FROM ? Math.max(g.wild, n + 1) : g.wild,
          seeds: g.seeds + (r.crown ? 1 : 0),
          stats: { ...g.stats, bugs: g.stats.bugs + r.bugs, gates: g.stats.gates + 1 },
          plays: g.plays + 1,
        });
        const st = get();
        st.progress("bugs", r.bugs); st.progress("gold", r.gold); st.progress("gates", 1); st.progress("combo", r.best, true);
        if (r.crown) st.progress("crown", 1); if (r.rivalWon) st.progress("rival", 1);
        useProfile.getState().earnCoins(coins);
        return coins;
      },
      fell: () => set({ stats: { ...get().stats, falls: get().stats.falls + 1 } }),
      wildSeen: (fp) => set({ seen: [...get().seen.filter((x) => x !== fp), fp].slice(-400) }),
      finishDaily: (day) => {
        const d = get().daily;
        if (d.day === day && d.cleared) return { coins: 0, streak: d.streak, first: false };
        const streak = d.day === day - 1 && d.cleared ? d.streak + 1 : 1;
        const coins = 80 + Math.min(10, streak) * 15;
        set({ daily: { day, cleared: true, streak, best: Math.max(d.best, streak) } });
        useProfile.getState().earnCoins(coins);
        return { coins, streak, first: true };
      },
      buyUp: (id) => {
        const g = get(), lv = g.up[id], def = UPGRADES.find((u) => u.id === id)!;
        if (lv >= def.max) return false;
        if (!useProfile.getState().spendCoins(UPGRADE_PRICE[lv])) return false;
        set({ up: { ...g.up, [id]: lv + 1 } });
        return true;
      },
      buy: (id, price) => { const g = get(); if (g.owned.includes(id)) return true; if (!useProfile.getState().spendCoins(price)) return false; set({ owned: [...g.owned, id] }); return true; },
      setLook: (p) => set({ look: { ...get().look, ...p } }),
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      tip: (k) => set({ tips: { ...get().tips, [k]: true } }),
      progress: (id, add, setTo) => {
        const g = get();
        let done = 0, coins = 0;
        const ms = g.missions.map((m) => {
          if (m.id !== id || m.got >= m.goal) return m;
          const got = setTo ? Math.max(m.got, add) : m.got + add;
          if (got >= m.goal) { done++; coins += m.coins; }
          return { ...m, got: Math.min(m.goal, got) };
        });
        if (!done) { if (ms.some((m, i) => m !== g.missions[i])) set({ missions: ms }); return; }
        // finished missions are replaced by new ones
        const total = g.missionsDone + done;
        const keep = ms.filter((m) => m.got < m.goal);
        const fresh = freshMissions(total * 3 + 2).filter((m) => !keep.some((k) => k.id === m.id));
        set({ missions: [...keep, ...fresh].slice(0, 3), missionsDone: total });
        useProfile.getState().earnCoins(coins);
      },
      setStage: (n) => set({ stage: n }),
      reset: () => set({ ...FRESH }),
    }),
    { name: "momoblobs-vine", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function useVineHydrated() {
  return useSyncExternalStore((cb) => useVine.persist.onFinishHydration(cb), () => useVine.persist.hasHydrated(), () => false);
}
export function autoQuality(): "low" | "medium" | "high" { return sharedAutoQuality(); }
/** the stage after n: the campaign, then the Wild Canopy */
export function nextStage(n: number): number {
  if (n < CAMPAIGN) return n + 1;
  if (n === CAMPAIGN) return Math.max(WILD_FROM, useVine.getState().wild);
  return n + 1;
}
/** a Wild Canopy variant whose fingerprint wasn't climbed yet */
export function wildVariant(n: number): number {
  if (n < WILD_FROM || n >= 100000) return 0;
  const seen = useVine.getState().seen;
  for (let v = 0; v < 8; v++) if (!seen.includes(wildPrint(wildDef(n, v)))) return v;
  return 0;
}
/** the sim options from upgrades */
export function simOpts(up: Record<Upgrade, number>) {
  return { regrowBugs: Math.max(5, 15 - up.regrow * 2), rushTime: 4 + up.rush * 0.6, snapReach: 0.55 + up.snap * 0.08, gripTime: 3.2 + up.grip * 0.5, shield: up.shield > 0 };
}
