"use client";
// Orbi GP progress on this device: the furthest stage unlocked, each stage's best (rating 0–3, time, place), the
// coins and stars earned, the remix memory (so the Remix Grand Prix never repeats a mix soon) and the settings; the
// marbles you own and the one you race, the ideas you've met (the Dex), the Daily Cup and its streak, your Endless
// best, Time Trial ghosts and Royale wins. Coins also go into the shared MOMOBLOBS wallet.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import type { RemixMemory } from "./gen";
import type { Controls, RaceResult } from "./session";

export interface Best { r: number; t: number; p: number }
export interface FinishOut { coins: number; unlocked: boolean; newBest: boolean }
/** a Time Trial best: the time and the ghost (s, u every 0.1 s, rounded to cm) */
export interface Trial { t: number; g: number[] }
export interface Daily { day: string; race: number; pts: number; streak: number; last: string; best: number }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
interface OrbiState {
  /** the furthest stage you may play (the next new one) */
  stage: number;
  salt: number;
  best: Record<string, Best>;
  coins: number; stars: number; races: number;
  recent: string[]; seen: string[];
  controls: Controls; tutorial: boolean;
  skin: number; owned: number[]; met: string[];
  daily: Daily; endless: number; trials: Record<string, Trial>; royale: { wins: number; played: number };
  finish: (res: RaceResult) => FinishOut;
  /** a mode's coins (Endless, Daily, Trial, Royale): into the wallet */
  earn: (coins: number) => void;
  buySkin: (i: number, price: number) => boolean;
  setSkin: (i: number) => void;
  dailyRace: (points: number) => Daily;
  setEndless: (m: number) => boolean;
  setTrial: (n: number, t: number, g: number[]) => boolean;
  royaleDone: (won: boolean) => void;
  setControls: (c: Controls) => void;
  seeTutorial: () => void;
  memory: () => RemixMemory;
}

const mem = new Map<string, string>();
const memory: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
const storage = createJSONStorage(() => { try { const k = "__orbi"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch { return memory; } });
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-max) : []);

export const useOrbi = create<OrbiState>()(
  persist(
    (set, get) => ({
      stage: 1, salt: 0, best: {}, coins: 0, stars: 0, races: 0, recent: [], seen: [], controls: "stick", tutorial: false,
      skin: 0, owned: [0], met: [], daily: { day: "", race: 0, pts: 0, streak: 0, last: "", best: 0 }, endless: 0, trials: {}, royale: { wins: 0, played: 0 },
      earn: (c) => { if (c <= 0) return; set({ coins: get().coins + c }); try { useProfile.getState().earnCoins(c); } catch { /* wallet unavailable */ } },
      buySkin: (i, price) => { const st = get(); if (st.owned.includes(i)) return true; if (st.coins < price) return false; set({ coins: st.coins - price, owned: [...st.owned, i], skin: i }); return true; },
      setSkin: (i) => { if (get().owned.includes(i)) set({ skin: i }); },
      dailyRace: (pts) => {
        const st = get(), d = today(), cur = st.daily.day === d ? st.daily : { ...st.daily, day: d, race: 0, pts: 0 };
        const next: Daily = { ...cur, race: cur.race + 1, pts: cur.pts + pts };
        if (next.race >= 3 && cur.race < 3) { next.streak = st.daily.last === yesterday() || st.daily.last === d ? (st.daily.last === d ? st.daily.streak : st.daily.streak + 1) : 1; next.last = d; next.best = Math.max(st.daily.best, next.pts); }
        set({ daily: next }); return next;
      },
      setEndless: (m) => { if (m <= get().endless) return false; set({ endless: Math.round(m) }); return true; },
      setTrial: (n, t, g) => {
        const st = get(), k = String(n), old = st.trials[k];
        if (old && old.t <= t) return false;
        const trials = { ...st.trials, [k]: { t: Math.round(t * 100) / 100, g } };
        const keys = Object.keys(trials); if (keys.length > 30) delete trials[keys[0]];
        set({ trials }); return true;
      },
      royaleDone: (won) => { const r = get().royale; set({ royale: { wins: r.wins + (won ? 1 : 0), played: r.played + 1 } }); },
      finish: (res) => {
        const st = get(), k = String(res.n), old = st.best[k];
        const better = !old || res.rating > old.r || (res.rating === old.r && res.time < old.t);
        const best = { ...st.best };
        if (res.pass) best[k] = { r: Math.max(old?.r ?? 0, res.rating), t: Math.min(old?.t ?? Infinity, Math.round(res.time * 10) / 10), p: Math.min(old?.p ?? 99, res.place) };
        const keys = Object.keys(best); if (keys.length > 2500) for (const x of keys.slice(0, keys.length - 2500)) delete best[x];
        const unlocked = res.pass && res.n >= st.stage;
        const coins = res.coins + res.rating * 10 + (res.pass ? 10 : 3);
        let recent = st.recent, seen = st.seen;
        if (res.pass && res.remix) { recent = [...res.remix, ...recent].slice(0, 8); seen = [...seen, res.remix.slice().sort().join("+")].slice(-3000); }
        const starsGained = Math.max(0, res.rating - (old?.r ?? 0));
        const met = res.meet && !st.met.includes(res.meet) ? [...st.met, res.meet] : st.met;
        set({ best, stage: unlocked ? res.n + 1 : st.stage, coins: st.coins + coins, stars: st.stars + (res.pass ? starsGained : 0), races: st.races + 1, recent, seen, met });
        try { useProfile.getState().earnCoins(coins); } catch { /* wallet unavailable */ }
        return { coins, unlocked, newBest: res.pass && better };
      },
      setControls: (controls) => set({ controls }),
      seeTutorial: () => set({ tutorial: true }),
      memory: () => { const st = get(); return { recent: st.recent, seen: st.seen.slice(-400) }; },
    }),
    {
      name: "momoblobs:orbigp", version: 2, storage, skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === "object" ? persisted : {}) as Partial<OrbiState>;
        const best: Record<string, Best> = {};
        if (p.best && typeof p.best === "object") for (const [k, v] of Object.entries(p.best)) {
          const b = v as Best;
          if (/^\d+$/.test(k) && b && typeof b === "object") best[k] = { r: Math.round(num(b.r, 0, 3, 0)), t: num(b.t, 0, 1e5, 0), p: Math.round(num(b.p, 1, 99, 99)) };
        }
        return {
          ...current,
          stage: Math.round(num(p.stage, 1, 1e7, 1)), salt: Math.round(num(p.salt, 0, 2 ** 31, 0)), best,
          coins: Math.round(num(p.coins, 0, 1e9, 0)), stars: Math.round(num(p.stars, 0, 1e7, 0)), races: Math.round(num(p.races, 0, 1e9, 0)),
          recent: strs(p.recent, 8), seen: strs(p.seen, 3000),
          controls: p.controls === "tilt" || p.controls === "buttons" || p.controls === "drag" ? p.controls : "stick", tutorial: p.tutorial === true,
          owned: Array.isArray(p.owned) ? [0, ...p.owned.filter((x): x is number => Number.isInteger(x) && x > 0 && x < 500)].filter((x, i, a) => a.indexOf(x) === i) : [0],
          skin: Number.isInteger(p.skin) && Array.isArray(p.owned) && p.owned.includes(p.skin as number) ? (p.skin as number) : 0,
          met: strs(p.met, 600).filter((x) => /^[A-Z]\d\d$/.test(x)),
          daily: p.daily && typeof p.daily === "object" ? { day: String(p.daily.day ?? ""), race: Math.round(num(p.daily.race, 0, 3, 0)), pts: Math.round(num(p.daily.pts, 0, 99, 0)), streak: Math.round(num(p.daily.streak, 0, 1e5, 0)), last: String(p.daily.last ?? ""), best: Math.round(num(p.daily.best, 0, 99, 0)) } : current.daily,
          endless: Math.round(num(p.endless, 0, 1e8, 0)),
          trials: p.trials && typeof p.trials === "object" ? Object.fromEntries(Object.entries(p.trials).filter(([k, v]) => /^\d+$/.test(k) && v && typeof (v as Trial).t === "number" && Array.isArray((v as Trial).g)).slice(-30)) as Record<string, Trial> : {},
          royale: p.royale && typeof p.royale === "object" ? { wins: Math.round(num(p.royale.wins, 0, 1e6, 0)), played: Math.round(num(p.royale.played, 0, 1e6, 0)) } : { wins: 0, played: 0 },
        };
      },
      // version 2 brings the joystick: everybody starts on it once (the controls button still cycles the others)
      migrate: (old, v) => ({ ...(old as OrbiState), ...(v < 2 ? { controls: "stick" as Controls } : {}) }),
    },
  ),
);

let hydrated = false, started = false;
const subs = new Set<() => void>();
function hydrate() {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(() => useOrbi.persist?.rehydrate())
    .catch(() => { /* bad save: defaults */ })
    .finally(() => {
      if (!useOrbi.getState().salt) useOrbi.setState({ salt: ((Math.random() * 2 ** 30) | 0) + 1 });
      hydrated = true; subs.forEach((f) => f());
    });
}
export function useOrbiHydrated() {
  return useSyncExternalStore((cb) => { subs.add(cb); hydrate(); return () => { subs.delete(cb); }; }, () => hydrated, () => false);
}
