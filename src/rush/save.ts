"use client";
// Rollo Rush progress on this device: the stage you are on (the built stage itself and the last checkpoint, so closing
// and reopening carries on from the same lamp), pearls, ranks, Moon Medals, the ideas you have met (Concept Dex), the
// remixes you discovered and the remix memory (anti-repeat), and which move hints you have seen. Pearls turn into
// coins for the shared MOMOBLOBS coin jar and site wallet.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { useRoll } from "../roll/save";
import type { RemixMemory } from "./gen";
import { DEFAULT_WEAR, FREE, ITEM, type Slot } from "./locker";
import { dayNumber } from "./modes";
import type { ModeResult, Rank, StageResult } from "./session";
import type { Stage } from "./types";

export interface RemixCard { key: string; name: string; n: number; atoms: string[] }
export interface WinOut { coins: number; newConcepts: string[]; best: boolean }
export interface ModeOut { coins: number; newBest: boolean; best: number; streak?: number }
export interface Ghost { t: number; p: number[] }

interface RushState {
  stage: number; salt: number;
  level: Stage | null; check: number; checkPearls: number;
  pearls: number; cleared: number; medals: number;
  /** metres run, all time (the run is one long road) */
  dist: number;
  ranks: Record<string, Rank>; medalsAt: Record<string, number>;
  dex: string[]; remixes: RemixCard[]; recent: string[]; seen: string[]; hints: string[];
  /** saved lives (start with 3, up to 9), the opening cinematic seen, Mayamma's magics seen (her spellbook) */
  lives: number; seenIntro: boolean; spells: string[];
  addLife: () => void; useLife: () => void; seeIntro: () => void; seeSpell: (id: string) => void;
  /** modes: best scores (endless metres, park points, boss bosses / seconds), the Daily Sprint streak, Time Trial ghosts */
  best: Record<string, number>; daily: { last: number; streak: number; day: number; best: number }; trials: Record<string, Ghost>;
  modeEnd: (res: ModeResult) => ModeOut;
  /** Rollo's Locker: what is owned and worn */
  owned: string[]; wear: Record<Slot, string>;
  buy: (id: string) => boolean; wearItem: (id: string) => void;
  setLevel: (st: Stage) => void;
  setCheck: (i: number, pearls: number) => void;
  win: (res: StageResult) => WinOut;
  seeHint: (h: string) => void;
  memory: () => RemixMemory;
}

const mem = new Map<string, string>();
const memory: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
const storage = createJSONStorage(() => { try { const k = "__rush"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch { return memory; } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-max) : []);
const RANK_ORDER: Rank[] = ["C", "B", "A", "S"];
const numMap = (v: unknown) => { const o: Record<string, number> = {}; if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (typeof x === "number" && Number.isFinite(x)) o[k] = x; return o; };
const dailyOf = (v: unknown) => { const d = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; return { last: Math.round(num(d.last, 0, 1e7, 0)), streak: Math.round(num(d.streak, 0, 1e5, 0)), day: Math.round(num(d.day, 0, 1e7, 0)), best: num(d.best, 0, 1e5, 0) }; };
const trialsOf = (v: unknown) => {
  const o: Record<string, Ghost> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { const g = x as Ghost; if (/^\d+$/.test(k) && g && typeof g.t === "number" && Array.isArray(g.p) && g.p.every((n) => typeof n === "number")) o[k] = { t: g.t, p: g.p.slice(0, 18000) }; }
  return o;
};
const wearOf = (v: unknown, owned: string[]) => {
  const w = { ...DEFAULT_WEAR };
  if (v && typeof v === "object") for (const [k, id] of Object.entries(v)) if (k in w && typeof id === "string" && ITEM[id]?.slot === k && owned.includes(id)) w[k as Slot] = id;
  return w;
};

export const useRush = create<RushState>()(
  persist(
    (set, get) => ({
      stage: 1, salt: 0, level: null, check: -1, checkPearls: 0, pearls: 0, cleared: 0, medals: 0, dist: 0,
      lives: 3, seenIntro: false, spells: [],
      addLife: () => set({ lives: Math.min(9, get().lives + 1) }),
      useLife: () => set({ lives: Math.max(0, get().lives - 1) }),
      seeIntro: () => set({ seenIntro: true }),
      seeSpell: (id) => { if (!get().spells.includes(id)) set({ spells: [...get().spells, id].slice(-400) }); },
      best: {}, daily: { last: 0, streak: 0, day: 0, best: 0 }, trials: {},
      modeEnd: (res) => {
        const st = get(), best = { ...st.best };
        let newBest = false, coins = 0, streak: number | undefined, b = 0;
        const more = (k: string, v: number) => { if (v > (best[k] ?? 0)) { best[k] = v; newBest = true; } return best[k]; };
        const less = (k: string, v: number) => { if (!best[k] || v < best[k]) { best[k] = v; newBest = true; } return best[k]; };
        if (res.id === "endless") { b = more("endless", Math.round(res.metres)); coins = Math.round(res.metres / 40) + res.coins; }
        else if (res.id === "park") { b = more("park", res.score); coins = Math.round(res.score / 120) + res.coins; }
        else if (res.id === "boss") { const n = res.bosses ?? 0; more("bossN", n); b = n && res.finished ? less(`boss${n}`, Math.round(res.time * 10) / 10) : best[`boss${n}`] ?? 0; coins = n * 25 + res.coins; }
        else if (res.id === "daily" && res.finished) {
          const day = dayNumber(), d = st.daily;
          streak = d.last === day ? d.streak : d.last === day - 1 ? d.streak + 1 : 1;
          const dayBest = d.day === day && d.best ? Math.min(d.best, res.time) : res.time;
          newBest = !(d.day === day && d.best) || res.time < d.best; b = dayBest;
          coins = (d.last === day ? 5 : 30 + Math.min(10, streak) * 5) + ({ S: 20, A: 12, B: 6, C: 2 } as const)[res.rank ?? "C"] + res.coins;
          set({ daily: { last: day, streak, day, best: Math.round(dayBest * 10) / 10 } });
        } else if (res.id === "trial" && res.finished && res.n) {
          const k = String(res.n), old = st.trials[k];
          if (!old || res.time < old.t) {
            newBest = true;
            const trials = { ...st.trials, [k]: { t: Math.round(res.time * 10) / 10, p: (res.ghost ?? []).slice(0, 3 * 10 * 600) } };
            const keys = Object.keys(trials); if (keys.length > 16) for (const x of keys.slice(0, keys.length - 16)) if (x !== k) delete trials[x];
            set({ trials });
          }
          b = Math.min(old?.t ?? Infinity, res.time); coins = 10 + (newBest ? 15 : 0) + ({ S: 15, A: 8, B: 4, C: 0 } as const)[res.rank ?? "C"] + res.coins;
        }
        set({ best });
        if (coins > 0) try { useProfile.getState().earnCoins(coins); } catch { /* wallet unavailable */ }
        return { coins, newBest, best: b, streak };
      },
      owned: [...FREE], wear: { ...DEFAULT_WEAR },
      buy: (id) => {
        const it = ITEM[id], st = get(); if (!it) return false;
        if (st.owned.includes(id)) { get().wearItem(id); return true; }
        let ok = false; try { ok = useProfile.getState().spendCoins(it.price); } catch { ok = false; }
        if (!ok) return false;
        set({ owned: [...st.owned, id], wear: { ...st.wear, [it.slot]: id } });
        return true;
      },
      wearItem: (id) => { const it = ITEM[id], st = get(); if (it && st.owned.includes(id)) set({ wear: { ...st.wear, [it.slot]: id } }); },
      ranks: {}, medalsAt: {}, dex: [], remixes: [], recent: [], seen: [], hints: [],
      setLevel: (st) => set({ level: st, check: -1, checkPearls: 0 }),
      setCheck: (i, pearls) => set({ check: i, checkPearls: pearls }),
      win: (res) => {
        const st = get();
        const prev = st.ranks[res.n];
        const best = !prev || RANK_ORDER.indexOf(res.rank) > RANK_ORDER.indexOf(prev);
        const ranks: Record<string, Rank> = { ...st.ranks, [res.n]: best ? res.rank : prev };
        const keys = Object.keys(ranks); if (keys.length > 600) for (const k of keys.slice(0, keys.length - 600)) delete ranks[k];
        const oldMedals = st.medalsAt[res.n] ?? 0, gotMedals = Math.max(oldMedals, res.medals);
        const medalsAt = { ...st.medalsAt, [res.n]: gotMedals };
        const newConcepts = res.concepts.filter((c) => !st.dex.includes(c));
        const coins = Math.round(res.pearls / 4) + ({ S: 30, A: 18, B: 10, C: 5 } as const)[res.rank] + (gotMedals - oldMedals) * 10 + (res.coins ?? 0);
        let remixes = st.remixes, recent = st.recent, seen = st.seen;
        if (res.remix) {
          if (!remixes.some((c) => c.key === res.remix!.key)) remixes = [...remixes, { key: res.remix.key, name: res.remix.name, n: res.n, atoms: res.remix.atoms }].slice(-2000);
          recent = [...res.remix.atoms, ...recent].slice(0, 8); seen = [...seen, res.remix.key].slice(-3000);
        }
        set({
          stage: res.n + 1, level: null, check: -1, checkPearls: 0, pearls: st.pearls + res.pearls, cleared: st.cleared + 1, dist: st.dist + Math.max(0, res.metres || 0),
          medals: st.medals + (gotMedals - oldMedals), ranks, medalsAt, dex: [...st.dex, ...newConcepts], remixes, recent, seen,
        });
        try { useRoll.getState().addBank(coins); useProfile.getState().earnCoins(Math.round(coins / 2)); } catch { /* wallets unavailable */ }
        return { coins, newConcepts, best };
      },
      seeHint: (h) => { if (!get().hints.includes(h)) set({ hints: [...get().hints, h] }); },
      memory: () => { const st = get(); return { recent: st.recent, seen: st.seen.slice(-400) }; },
    }),
    {
      name: "momoblobs:rollorush", version: 1, storage, skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === "object" ? persisted : {}) as Partial<RushState>;
        const lvl = p.level && typeof p.level === "object" && Array.isArray((p.level as Stage).segs) && Array.isArray((p.level as Stage).objs) ? (p.level as Stage) : null;
        const ranks: Record<string, Rank> = {};
        if (p.ranks && typeof p.ranks === "object") for (const [k, v] of Object.entries(p.ranks)) if (/^\d+$/.test(k) && RANK_ORDER.includes(v as Rank)) ranks[k] = v as Rank;
        const medalsAt: Record<string, number> = {};
        if (p.medalsAt && typeof p.medalsAt === "object") for (const [k, v] of Object.entries(p.medalsAt)) if (/^\d+$/.test(k)) medalsAt[k] = Math.round(num(v, 0, 3, 0));
        return {
          ...current,
          stage: Math.round(num(p.stage, 1, 1e7, 1)),
          salt: Math.round(num(p.salt, 0, 2 ** 31, 0)),
          level: lvl, check: Math.round(num(p.check, -1, 64, -1)), checkPearls: Math.round(num(p.checkPearls, 0, 1e6, 0)),
          pearls: Math.round(num(p.pearls, 0, 1e9, 0)), cleared: Math.round(num(p.cleared, 0, 1e7, 0)), medals: Math.round(num(p.medals, 0, 1e7, 0)),
          dist: Math.round(num(p.dist, 0, 1e10, 0)),
          ranks, medalsAt, dex: strs(p.dex, 1200),
          remixes: Array.isArray(p.remixes) ? p.remixes.filter((c): c is RemixCard => !!c && typeof c === "object" && typeof (c as RemixCard).key === "string").slice(-2000) : [],
          recent: strs(p.recent, 8), seen: strs(p.seen, 3000), hints: strs(p.hints, 40),
          lives: Math.round(num(p.lives, 0, 9, 3)), seenIntro: p.seenIntro === true, spells: strs(p.spells, 400),
          best: numMap(p.best), daily: dailyOf(p.daily), trials: trialsOf(p.trials),
          owned: [...new Set([...FREE, ...strs(p.owned, 200).filter((id) => ITEM[id])])],
          wear: wearOf(p.wear, [...FREE, ...strs(p.owned, 200)]),
        };
      },
      migrate: (old) => old as RushState,
    },
  ),
);

let hydrated = false, started = false;
const subs = new Set<() => void>();
function hydrate() {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(() => Promise.all([useRush.persist?.rehydrate(), useRoll.persist?.rehydrate()]))
    .catch(() => { /* bad save: defaults */ })
    .finally(() => {
      if (!useRush.getState().salt) useRush.setState({ salt: ((Math.random() * 2 ** 30) | 0) + 1 });
      hydrated = true; subs.forEach((f) => f());
    });
}
export function useRushHydrated() {
  return useSyncExternalStore((cb) => { subs.add(cb); hydrate(); return () => { subs.delete(cb); }; }, () => hydrated, () => false);
}
