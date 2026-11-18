"use client";
// Momo Escape progress on this device: best floor, buildings reached (start picker), Concept Dex + fusion cards, fusion
// memory (anti-repeat), Daily Heist, Speed Series medals. Coins go to the shared MOMOBLOBS roller wallet + site wallet.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { useRoll } from "../roll/save";
import type { FusionMemory } from "./gen";
import type { EscapeResult } from "./session";

export interface FusionCard { key: string; name: string; n: number; atoms: string[] }
export interface Outcome { coins: number; newBest: boolean; newConcepts: string[]; newFusions: FusionCard[]; medal: number; dailyBest: boolean }

interface EscapeState {
  best: number;
  reached: number;
  runs: number;
  dex: string[];
  fusions: FusionCard[];
  recent: string[];
  seen: string[];
  daily: { key: string; best: number; diamonds: number; streak: number };
  series: { next: number; medals: Record<string, number> };
  tutorial: boolean;
  record: (r: EscapeResult, par?: number) => Outcome;
  setTutorial: (v: boolean) => void;
  memory: () => FusionMemory;
}

const mem = new Map<string, string>();
const memory: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
const storage = createJSONStorage(() => {
  try { const k = "__escape"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch { return memory; }
});
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-max) : []);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dailyKeyNow = () => dayKey(new Date());

const initial = () => ({
  best: 0, reached: 1, runs: 0, dex: [] as string[], fusions: [] as FusionCard[], recent: [] as string[], seen: [] as string[],
  daily: { key: "", best: 0, diamonds: 0, streak: 0 }, series: { next: 1, medals: {} as Record<string, number> }, tutorial: false,
});

export const useEscape = create<EscapeState>()(
  persist(
    (set, get) => ({
      ...initial(),
      record: (r, par) => {
        const st = get();
        const dex = new Set(st.dex);
        const newConcepts = r.concepts.filter((c) => !dex.has(c));
        newConcepts.forEach((c) => dex.add(c));
        const have = new Set(st.fusions.map((f) => f.key));
        const newFusions: FusionCard[] = [];
        for (const f of r.fusions) if (!have.has(f.key)) { have.add(f.key); newFusions.push({ ...f, n: 213 + st.fusions.length + newFusions.length }); }
        const recent = [...r.fusions.flatMap((f) => f.atoms), ...st.recent].slice(0, 14);
        const seen = [...st.seen, ...r.fusions.map((f) => f.key)].slice(-3000);
        const patch: Partial<EscapeState> = { dex: [...dex], fusions: [...st.fusions, ...newFusions], recent, seen, runs: st.runs + 1 };
        let coins = r.coins + r.diamonds * 5 + r.buddies * 10, newBest = false, medal = 0, dailyBest = false;
        if (r.mode === "run") {
          newBest = r.floor > st.best;
          if (newBest) patch.best = r.floor;
          patch.reached = Math.max(st.reached, Math.min(24, r.building));
          coins += r.floorsDone * 2;
        } else if (r.mode === "daily" && r.completed) {
          const key = r.daily ?? dailyKeyNow();
          const y = new Date(); y.setDate(y.getDate() - 1);
          const same = st.daily.key === key;
          dailyBest = !same || r.seconds < st.daily.best;
          patch.daily = { key, best: same ? Math.min(st.daily.best, r.seconds) : r.seconds, diamonds: Math.max(same ? st.daily.diamonds : 0, r.diamonds), streak: same ? st.daily.streak : st.daily.key === dayKey(y) ? st.daily.streak + 1 : 1 };
          coins += same ? 5 : 40;
        } else if (r.mode === "series" && r.completed && r.series) {
          const p = par ?? r.seconds;
          medal = r.seconds <= p * 1.25 ? 3 : r.seconds <= p * 1.7 ? 2 : 1;
          const prev = st.series.medals[String(r.series)] ?? 0;
          patch.series = { next: Math.max(st.series.next, r.series + 1), medals: { ...st.series.medals, [String(r.series)]: Math.max(prev, medal) } };
          coins += medal * 10;
        }
        set(patch);
        if (coins > 0) { useRoll.getState().addBank(coins); useProfile.getState().earnCoins(Math.round(coins / 2)); }
        return { coins, newBest, newConcepts, newFusions, medal, dailyBest };
      },
      setTutorial: (v) => set({ tutorial: v }),
      memory: () => { const st = get(); return { recent: st.recent, seen: st.seen.slice(-400) }; },
    }),
    {
      name: "momoblobs:escape", version: 1, storage, skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === "object" ? persisted : {}) as Partial<EscapeState>;
        const d = (p.daily && typeof p.daily === "object" ? p.daily : {}) as Partial<EscapeState["daily"]>;
        const s = (p.series && typeof p.series === "object" ? p.series : {}) as Partial<EscapeState["series"]>;
        const medals: Record<string, number> = {};
        if (s.medals && typeof s.medals === "object") for (const [k, v] of Object.entries(s.medals)) if (/^\d+$/.test(k)) medals[k] = Math.round(num(v, 0, 3, 0));
        return {
          ...current,
          best: Math.round(num(p.best, 0, 1e7, 0)),
          reached: Math.round(num(p.reached, 1, 24, 1)),
          runs: Math.round(num(p.runs, 0, 1e7, 0)),
          dex: strs(p.dex, 400),
          fusions: Array.isArray(p.fusions) ? p.fusions.filter((f): f is FusionCard => !!f && typeof f === "object" && typeof (f as FusionCard).key === "string" && typeof (f as FusionCard).name === "string").map((f) => ({ key: f.key, name: f.name, n: Math.round(num(f.n, 0, 1e7, 0)), atoms: strs(f.atoms, 6) })).slice(-2000) : [],
          recent: strs(p.recent, 14),
          seen: strs(p.seen, 3000),
          daily: { key: typeof d.key === "string" ? d.key : "", best: num(d.best, 0, 1e6, 0), diamonds: Math.round(num(d.diamonds, 0, 99, 0)), streak: Math.round(num(d.streak, 0, 9999, 0)) },
          series: { next: Math.round(num(s.next, 1, 1e6, 1)), medals },
          tutorial: p.tutorial === true,
        };
      },
      migrate: (old) => old as EscapeState,
    },
  ),
);

let hydrated = false, started = false;
const subs = new Set<() => void>();
function hydrate() {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(() => Promise.all([useEscape.persist?.rehydrate(), useRoll.persist?.rehydrate()]))
    .catch(() => { /* bad save: defaults */ })
    .finally(() => { hydrated = true; subs.forEach((f) => f()); });
}
export function useEscapeHydrated() {
  return useSyncExternalStore((cb) => { subs.add(cb); hydrate(); return () => { subs.delete(cb); }; }, () => hydrated, () => false);
}
