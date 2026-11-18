"use client";
// Momo Sky Roll progress, saved on this device: Journey levels (1 → ∞), the Concept Dex (discovered concepts and
// fusions), fusion memory (so Infinite Fusion never repeats), Daily streak, Endless best, characters, ghost runs.
// Every field is validated on load; a broken or blocked localStorage falls back to memory; hydration always finishes.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import type { FusionMemory } from "./fusion";
import type { RunResult } from "./session";

export interface LevelSave { best: number; done: boolean; stars: number; sprouts: number; beads: number; plays: number }
export interface DexFusion { key: string; name: string; n: number; atoms: string[] }
export interface RecordOutcome { stars: number; newBest: boolean; firstClear: boolean; unlocked: number | null; coins: number; newSprouts: number; newConcepts: string[]; newFusion: DexFusion | null; bank: number }

export const CHARACTERS: { id: string; name: string; price: number; perk: string; color: string }[] = [
  { id: "momo", name: "Momo", price: 0, perk: "Balanced roller", color: "#ff8a3d" },
  { id: "kranky", name: "Kranky", price: 150, perk: "Quicker sideways", color: "#e8504f" },
  { id: "tiki", name: "Tiki", price: 300, perk: "Longer glides on pads", color: "#2ec4b6" },
  { id: "pip", name: "Pip", price: 450, perk: "Slides faster on ice", color: "#3a4a6a" },
  { id: "gloop", name: "Gloop", price: 600, perk: "Sticky grip on ice", color: "#9be34a" },
  { id: "hoot", name: "Prof. Hoot", price: 800, perk: "Slow-mo lasts longer", color: "#9a6b45" },
  { id: "bonbon", name: "Bonbon", price: 1000, perk: "Smashes cake walls", color: "#ff6f91" },
  { id: "zib", name: "Zib", price: 1300, perk: "Hovers over small gaps", color: "#8e5be8" },
  { id: "turbo", name: "Turbo", price: 1600, perk: "Rocket rolls", color: "#ff6b3d" },
  { id: "bolt", name: "Bolt", price: 2000, perk: "Bead magnet", color: "#1e9c91" },
  { id: "noodle", name: "Noodle", price: 2500, perk: "Stretches over one gap per zone", color: "#d49452" },
];

interface RollState {
  levels: Record<string, LevelSave>;
  last: number;
  tutorial: boolean;
  sensitivity: number;
  dex: string[];
  fusions: DexFusion[];
  seen: string[];
  recent: string[];
  daily: { key: string; done: boolean; streak: number; stars: number };
  endlessBest: number;
  rushBest: number;
  /** the endless run: best distance (m), furthest world reached, runs played */
  runBest: number;
  runWorld: number;
  runs: number;
  ch: string;
  owned: string[];
  bank: number;
  ghosts: Record<string, string>;
  record: (r: RunResult) => RecordOutcome;
  reach: (level: number, pct: number) => void;
  setLast: (n: number) => void;
  setSensitivity: (v: number) => void;
  setTutorial: (v: boolean) => void;
  buy: (id: string) => boolean;
  choose: (id: string) => void;
  /** coins earned in other MOMOBLOBS games (Momo Escape) go into the same roller wallet */
  addBank: (n: number) => void;
  memory: () => FusionMemory;
  reset: () => void;
}

const EMPTY: LevelSave = { best: 0, done: false, stars: 0, sprouts: 0, beads: 0, plays: 0 };
const mem = new Map<string, string>();
const memory: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
const storage = createJSONStorage(() => {
  try { const k = "__skyroll"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch { return memory; }
});

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-max) : []);
function cleanLevels(v: unknown): Record<string, LevelSave> {
  const out: Record<string, LevelSave> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id < 1 || id > 1e6 || !raw || typeof raw !== "object") continue;
    const r = raw as Partial<LevelSave>;
    out[k] = { best: num(r.best, 0, 1, 0), done: r.done === true, stars: Math.round(num(r.stars, 0, 3, 0)), sprouts: Math.round(num(r.sprouts, 0, 7, 0)), beads: Math.round(num(r.beads, 0, 999, 0)), plays: Math.round(num(r.plays, 0, 1e6, 0)) };
  }
  return out;
}
const cleanFusions = (v: unknown): DexFusion[] => Array.isArray(v)
  ? v.filter((f): f is DexFusion => !!f && typeof f === "object" && typeof (f as DexFusion).key === "string" && typeof (f as DexFusion).name === "string" && Array.isArray((f as DexFusion).atoms))
    .map((f) => ({ key: f.key, name: f.name, n: Math.round(num(f.n, 0, 1e6, 0)), atoms: strs(f.atoms, 6) })).slice(-2000)
  : [];

export const starsFor = (beads: number, beadsTotal: number, sprouts: number) => 1 + (beads >= Math.ceil(beadsTotal * 0.75) ? 1 : 0) + (sprouts >= 3 ? 1 : 0);
export const unlocked = (levels: Record<string, LevelSave>, n: number) => n <= 1 || !!levels[String(n - 1)]?.done;
export const bitCount = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1));

const initial = () => ({
  levels: {} as Record<string, LevelSave>, last: 1, tutorial: false, sensitivity: 1, dex: [] as string[], fusions: [] as DexFusion[], seen: [] as string[], recent: [] as string[],
  daily: { key: "", done: false, streak: 0, stars: 0 }, endlessBest: 0, rushBest: 0, runBest: 0, runWorld: 1, runs: 0, ch: "momo", owned: ["momo"], bank: 0, ghosts: {} as Record<string, string>,
});

export const useRoll = create<RollState>()(
  persist(
    (set, get) => ({
      ...initial(),
      record: (r) => {
        const st = get();
        const stars = r.completed ? starsFor(r.beads, r.beadsTotal, r.sprouts) : 0;
        const dexSet = new Set(st.dex);
        const newConcepts = r.concepts.filter((c) => !dexSet.has(c));
        newConcepts.forEach((c) => dexSet.add(c));
        let newFusion: DexFusion | null = null;
        let fusions = st.fusions, seen = st.seen, recent = st.recent;
        if (r.fusion && r.completed) {
          seen = [...st.seen.filter((k) => k !== r.fusion!.key), r.fusion.key].slice(-3000);
          recent = [...r.fusion.atoms, ...st.recent].slice(0, 12);
          if (!st.fusions.some((f) => f.key === r.fusion!.key)) { newFusion = { key: r.fusion.key, name: r.fusion.name, n: 218 + st.fusions.length, atoms: r.fusion.atoms }; fusions = [...st.fusions, newFusion]; }
        }
        const earned = r.beads + r.sprouts * 10 + r.extras.length * 5;
        const bank = st.bank + earned;
        let coins = 0, firstClear = false, unlock: number | null = null, newSprouts = 0, newBest = false;
        const patch: Partial<RollState> = { dex: [...dexSet], fusions, seen, recent, bank };
        if (r.kind === "journey" || r.kind === "fusion") {
          const key = String(r.level);
          const prev = st.levels[key] ?? EMPTY;
          if (r.completed) {
            const mask = prev.sprouts | r.sproutMask;
            newSprouts = bitCount(mask) - bitCount(prev.sprouts);
            firstClear = !prev.done;
            newBest = stars > prev.stars;
            patch.levels = { ...st.levels, [key]: { best: 1, done: true, stars: Math.max(prev.stars, stars), sprouts: mask, beads: Math.max(prev.beads, r.beads), plays: prev.plays + 1 } };
            unlock = firstClear ? r.level + 1 : null;
            patch.last = r.level + 1;
            if (r.ghost && (newBest || !st.ghosts[key])) {
              const g = { ...st.ghosts, [key]: r.ghost };
              const keys = Object.keys(g);
              if (keys.length > 30) delete g[keys[0]];
              patch.ghosts = g;
            }
            coins = (firstClear ? 25 : 5) + Math.round(r.beads * (firstClear ? 1 : 0.5)) + newSprouts * 15 + (r.deaths === 0 ? 10 : 0);
          }
        } else if (r.kind === "daily" && r.completed) {
          const today = st.daily;
          const y = new Date(); y.setDate(y.getDate() - 1);
          const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
          const dk = new Date();
          const dKey = `${dk.getFullYear()}-${String(dk.getMonth() + 1).padStart(2, "0")}-${String(dk.getDate()).padStart(2, "0")}`;
          const streak = today.key === dKey ? today.streak : today.key === yKey ? today.streak + 1 : 1;
          patch.daily = { key: dKey, done: true, streak, stars: Math.max(today.key === dKey ? today.stars : 0, stars) };
          coins = today.key === dKey ? 5 : 40 + streak * 5;
        } else if (r.kind === "run") {
          newBest = r.distance > st.runBest;
          if (newBest) patch.runBest = r.distance;
          patch.runWorld = Math.max(st.runWorld, Math.min(20, r.world ?? 1));
          patch.runs = st.runs + 1;
          coins = r.beads + Math.round(r.distance / 25);
        } else if (r.kind === "endless") {
          newBest = r.distance > st.endlessBest;
          if (newBest) patch.endlessBest = r.distance;
          coins = Math.round(r.distance / 20) + r.beads;
        } else if (r.kind === "rush" && r.completed) {
          newBest = !st.rushBest || r.seconds < st.rushBest;
          if (newBest) patch.rushBest = Math.round(r.seconds);
          coins = 150;
        } else if (r.kind === "lab" && r.completed) coins = 10;
        set(patch);
        if (coins > 0) useProfile.getState().earnCoins(coins);
        return { stars, newBest, firstClear, unlocked: unlock, coins, newSprouts, newConcepts, newFusion, bank };
      },
      reach: (level, pct) => {
        const st = get();
        const key = String(level);
        const prev = st.levels[key] ?? EMPTY;
        if (pct <= prev.best) return;
        set({ levels: { ...st.levels, [key]: { ...prev, best: Math.min(1, pct), plays: prev.plays + 1 } } });
      },
      setLast: (n) => set({ last: Math.max(1, Math.round(n)) }),
      setSensitivity: (v) => set({ sensitivity: Math.max(0.5, Math.min(2, v)) }),
      setTutorial: (v) => set({ tutorial: v }),
      buy: (id) => {
        const st = get();
        const c = CHARACTERS.find((x) => x.id === id);
        if (!c || st.owned.includes(id) || st.bank < c.price) return false;
        set({ bank: st.bank - c.price, owned: [...st.owned, id], ch: id });
        return true;
      },
      choose: (id) => { if (get().owned.includes(id)) set({ ch: id }); },
      addBank: (n) => { if (n > 0) set({ bank: Math.min(1e8, get().bank + Math.round(n)) }); },
      memory: () => {
        const st = get();
        return { seen: new Set(st.seen), recent: st.recent, promoted: st.fusions.filter((_, i) => i % 3 === 0).map((f) => f.atoms) };
      },
      reset: () => set(initial()),
    }),
    {
      name: "momoblobs:skyroll", version: 2, storage, skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === "object" ? persisted : {}) as Partial<RollState>;
        const d = (p.daily && typeof p.daily === "object" ? p.daily : {}) as Partial<RollState["daily"]>;
        const owned = strs(p.owned, 20);
        return {
          ...current,
          levels: cleanLevels(p.levels),
          last: Math.round(num(p.last, 1, 1e6, 1)),
          tutorial: p.tutorial === true,
          sensitivity: num(p.sensitivity, 0.5, 2, 1),
          dex: strs(p.dex, 400),
          fusions: cleanFusions(p.fusions),
          seen: strs(p.seen, 3000),
          recent: strs(p.recent, 12),
          daily: { key: typeof d.key === "string" ? d.key : "", done: d.done === true, streak: Math.round(num(d.streak, 0, 9999, 0)), stars: Math.round(num(d.stars, 0, 3, 0)) },
          endlessBest: Math.round(num(p.endlessBest, 0, 1e7, 0)),
          rushBest: Math.round(num(p.rushBest, 0, 1e6, 0)),
          runBest: Math.round(num(p.runBest, 0, 1e8, 0)),
          runWorld: Math.round(num(p.runWorld, 1, 20, 1)),
          runs: Math.round(num(p.runs, 0, 1e7, 0)),
          owned: owned.includes("momo") ? owned : ["momo", ...owned],
          ch: typeof p.ch === "string" && owned.includes(p.ch) ? p.ch : "momo",
          bank: Math.round(num(p.bank, 0, 1e8, 0)),
          ghosts: p.ghosts && typeof p.ghosts === "object" ? Object.fromEntries(Object.entries(p.ghosts as Record<string, unknown>).filter(([, v]) => typeof v === "string" && (v as string).length < 8000).slice(-30)) as Record<string, string> : {},
        };
      },
      migrate: (old) => old as RollState,
    },
  ),
);

let hydrated = false, started = false;
const subs = new Set<() => void>();
function hydrate() {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(() => useRoll.persist?.rehydrate())
    .catch(() => { /* bad save: keep defaults */ })
    .finally(() => { hydrated = true; subs.forEach((f) => f()); });
}
export function useRollHydrated() {
  return useSyncExternalStore((cb) => { subs.add(cb); hydrate(); return () => { subs.delete(cb); }; }, () => hydrated, () => false);
}

export const totals = (levels: Record<string, LevelSave>) => {
  let stars = 0, sprouts = 0, beads = 0, done = 0;
  for (const l of Object.values(levels)) { stars += l.stars; sprouts += bitCount(l.sprouts); beads += l.beads; if (l.done) done++; }
  return { stars, sprouts, beads, done };
};
