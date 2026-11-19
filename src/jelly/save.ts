"use client";
// Momo Jelly Jam progress on this device: the stage you are on (with the exact board and every move, so closing and
// reopening carries on from the same spot), stars, the Concept Dex, fusion cards and the fusion memory (anti-repeat).
// Coins go to the shared MOMOBLOBS roller jar + site wallet.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { useProfile } from "@/lib/store";
import { useRoll } from "../roll/save";
import type { FusionMemory } from "./gen";
import type { Level, Move } from "./types";

export interface FusionCard { key: string; name: string; n: number; atoms: string[] }
/** the modes: Daily Jam (stars by date + streak), Kranky Weekly, Rush best, Zen count, Puzzle Packs, Jam Lab */
export interface ModeProgress { daily: Record<string, number>; streak: number; lastDaily: string; weekly: Record<string, number>; rushBest: number; zen: number; packs: Record<string, number>; lab: number }
/** the Jelly Shop: what you own and wear */
export interface ShopState { owned: string[]; finish: string; tray: string; confetti: string }
export const SHOP: { id: string; slot: "finish" | "tray" | "confetti"; name: string; price: number; icon: string }[] = [
  { id: "glossy", slot: "finish", name: "Classic Gloss", price: 0, icon: "✨" },
  { id: "pastel", slot: "finish", name: "Pastel Matte", price: 180, icon: "🍬" },
  { id: "glitter", slot: "finish", name: "Glitter Pop", price: 320, icon: "💫" },
  { id: "glass", slot: "finish", name: "Glass Candy", price: 420, icon: "🔮" },
  { id: "metal", slot: "finish", name: "Chrome Drops", price: 520, icon: "💎" },
  { id: "neon", slot: "finish", name: "Neon Glow", price: 650, icon: "🌈" },
  { id: "world", slot: "tray", name: "World Tray", price: 0, icon: "🧩" },
  { id: "wood", slot: "tray", name: "Toy Wood", price: 150, icon: "📦" },
  { id: "marble", slot: "tray", name: "White Marble", price: 280, icon: "🤍" },
  { id: "candy", slot: "tray", name: "Candy Stripe", price: 360, icon: "🍭" },
  { id: "galaxy", slot: "tray", name: "Galaxy", price: 560, icon: "🌌" },
  { id: "party", slot: "confetti", name: "Party Mix", price: 0, icon: "🎉" },
  { id: "gold", slot: "confetti", name: "Gold Rain", price: 240, icon: "💰" },
  { id: "pastels", slot: "confetti", name: "Pastel Puff", price: 200, icon: "🎀" },
  { id: "jelly", slot: "confetti", name: "Same Colour", price: 300, icon: "🍮" },
];
/** stars needed for each helper charge */
export const STARS_PER_HELPER = 12;
export interface WinResult { n: number; stars: number; coins: number; newConcepts: string[]; fusion?: FusionCard }

interface JamState {
  /** the stage being played */
  stage: number;
  /** this player's own level variety */
  salt: number;
  level: Level | null;
  moves: Move[];
  hinted: boolean;
  /** best stars per stage (recent stages only) */
  stars: Record<string, number>;
  totalStars: number;
  cleared: number;
  dex: string[];
  fusions: FusionCard[];
  recent: string[];
  seen: string[];
  tutorial: boolean;
  modes: ModeProgress;
  shop: ShopState;
  /** helper charges used, and extra ones from bosses */
  helperSpent: number; helperBonus: number;
  /** a re-rolled stage gets another salt */
  reroll: number;
  setLevel: (l: Level) => void;
  setMoves: (m: Move[], hinted?: boolean) => void;
  win: (l: Level, moves: number, hinted: boolean) => WinResult;
  setTutorial: (v: boolean) => void;
  memory: () => FusionMemory;
  /** a mode stage was cleared → coins */
  modeWin: (mode: string, key: string, idx: number, stars: number) => number;
  rushScore: (n: number) => boolean;
  /** spend coins from the jar (false if there aren't enough) */
  spend: (n: number) => boolean;
  buy: (id: string) => boolean;
  equip: (id: string) => void;
  helpers: () => number;
  useHelper: () => boolean;
  bumpReroll: () => void;
}

const mem = new Map<string, string>();
const memory: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
const storage = createJSONStorage(() => {
  try { const k = "__jam"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch { return memory; }
});
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-max) : []);

/** stars for a finished stage */
export function starsFor(moves: number, par: number, hinted: boolean) {
  const s = moves <= par ? 3 : moves <= Math.ceil(par * 1.3) + 1 ? 2 : 1;
  return hinted ? Math.min(2, s) : s;
}

export const useJam = create<JamState>()(
  persist(
    (set, get) => ({
      stage: 1, salt: 0, level: null, moves: [], hinted: false, stars: {}, totalStars: 0, cleared: 0, dex: [], fusions: [], recent: [], seen: [], tutorial: false,
      modes: { daily: {}, streak: 0, lastDaily: "", weekly: {}, rushBest: 0, zen: 0, packs: {}, lab: 0 },
      shop: { owned: ["glossy", "world", "party"], finish: "glossy", tray: "world", confetti: "party" },
      helperSpent: 0, helperBonus: 0, reroll: 0,
      setLevel: (l) => set({ level: l, moves: [], hinted: false }),
      setMoves: (m, hinted) => set({ moves: m, ...(hinted !== undefined ? { hinted } : {}) }),
      win: (l, moves, hinted) => {
        const st = get();
        const stars = starsFor(moves, l.par, hinted);
        const prev = st.stars[String(l.n)] ?? 0;
        const dex = new Set(st.dex);
        const newConcepts = l.concepts.filter((c) => !dex.has(c));
        newConcepts.forEach((c) => dex.add(c));
        let fusion: FusionCard | undefined;
        const fusions = st.fusions.slice();
        let recent = st.recent, seen = st.seen;
        if (l.fusion) {
          recent = [...l.fusion.atoms, ...st.recent].slice(0, 12);
          seen = [...st.seen, l.fusion.key].slice(-3000);
          if (!fusions.some((f) => f.key === l.fusion!.key)) { fusion = { ...l.fusion, n: 401 + fusions.length }; fusions.push(fusion); }
        }
        const starMap = { ...st.stars, [String(l.n)]: Math.max(prev, stars) };
        const keys = Object.keys(starMap);
        if (keys.length > 2500) for (const k of keys.sort((a, b) => +a - +b).slice(0, keys.length - 2500)) delete starMap[k];
        const coins = 4 + stars * 4 + (l.kind === "boss" ? 20 : l.kind === "burner" || l.kind === "star" ? 8 : 0);
        set({
          stage: Math.max(st.stage, l.n + 1), level: null, moves: [], hinted: false, stars: starMap, totalStars: st.totalStars + Math.max(0, stars - prev),
          cleared: st.cleared + 1, dex: [...dex], fusions: fusions.slice(-2000), recent, seen, reroll: 0,
          helperBonus: st.helperBonus + (l.kind === "boss" ? 2 : 0),
        });
        try { useRoll.getState().addBank(coins); useProfile.getState().earnCoins(Math.round(coins / 2)); } catch { /* wallets unavailable */ }
        return { n: l.n, stars, coins, newConcepts, fusion };
      },
      setTutorial: (v) => set({ tutorial: v }),
      modeWin: (mode, key, idx, stars) => {
        const st = get(), m = { ...st.modes };
        let coins = 4 + stars * 2;
        if (mode === "daily") {
          const first = m.daily[key] === undefined;
          m.daily = { ...m.daily, [key]: Math.max(m.daily[key] ?? 0, stars) };
          if (first) { const y = new Date(Date.parse(key) - 864e5).toISOString().slice(0, 10); m.streak = m.lastDaily === y ? m.streak + 1 : 1; m.lastDaily = key; coins = 30 + Math.min(10, m.streak) * 5; }
        } else if (mode === "weekly") { const first = m.weekly[key] === undefined; m.weekly = { ...m.weekly, [key]: Math.max(m.weekly[key] ?? 0, stars) }; coins = first ? 80 : 10; }
        else if (mode === "zen") { m.zen++; coins = 3; }
        else if (mode === "pack") { m.packs = { ...m.packs, [key]: Math.max(m.packs[key] ?? 0, idx + 1) }; }
        else if (mode === "lab") { m.lab++; coins = 3; }
        else if (mode === "rush") coins = 2;
        set({ modes: m });
        try { useRoll.getState().addBank(coins); useProfile.getState().earnCoins(Math.round(coins / 2)); } catch { /* wallets unavailable */ }
        return coins;
      },
      rushScore: (n) => { const st = get(); if (n <= st.modes.rushBest) return false; set({ modes: { ...st.modes, rushBest: n } }); return true; },
      spend: (n) => { try { const r = useRoll.getState(); if (r.bank < n) return false; useRoll.setState({ bank: r.bank - n }); return true; } catch { return false; } },
      buy: (id) => {
        const st = get(), item = SHOP.find((i) => i.id === id);
        if (!item || st.shop.owned.includes(id)) return false;
        if (!get().spend(item.price)) return false;
        set({ shop: { ...st.shop, owned: [...st.shop.owned, id], [item.slot]: id } });
        return true;
      },
      equip: (id) => { const st = get(), item = SHOP.find((i) => i.id === id); if (!item || !st.shop.owned.includes(id)) return; set({ shop: { ...st.shop, [item.slot]: id } }); },
      helpers: () => { const st = get(); return Math.max(0, Math.floor(st.totalStars / STARS_PER_HELPER) + st.helperBonus + 3 - st.helperSpent); },
      useHelper: () => { if (get().helpers() <= 0) return false; set({ helperSpent: get().helperSpent + 1 }); return true; },
      bumpReroll: () => set({ reroll: get().reroll + 1, level: null, moves: [], hinted: false }),
      memory: () => { const st = get(); return { recent: st.recent, seen: st.seen.slice(-400) }; },
    }),
    {
      name: "momoblobs:jellyjam", version: 1, storage, skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === "object" ? persisted : {}) as Partial<JamState>;
        const lvl = p.level && typeof p.level === "object" && Array.isArray((p.level as Level).pieces) && typeof (p.level as Level).W === "number" ? (p.level as Level) : null;
        const stars: Record<string, number> = {};
        if (p.stars && typeof p.stars === "object") for (const [k, v] of Object.entries(p.stars)) if (/^\d+$/.test(k)) stars[k] = Math.round(num(v, 0, 3, 0));
        return {
          ...current,
          stage: Math.round(num(p.stage, 1, 1e7, 1)),
          salt: Math.round(num(p.salt, 0, 2 ** 31, 0)) || ((Math.random() * 2 ** 30) | 0) + 1,
          level: lvl,
          moves: Array.isArray(p.moves) ? p.moves.filter((m): m is Move => !!m && typeof m === "object" && typeof (m as Move).id === "number").slice(0, 400) : [],
          hinted: p.hinted === true,
          stars, totalStars: Math.round(num(p.totalStars, 0, 1e8, 0)), cleared: Math.round(num(p.cleared, 0, 1e7, 0)),
          dex: strs(p.dex, 800),
          fusions: Array.isArray(p.fusions) ? p.fusions.filter((f): f is FusionCard => !!f && typeof f === "object" && typeof (f as FusionCard).key === "string").slice(-2000) : [],
          recent: strs(p.recent, 12), seen: strs(p.seen, 3000), tutorial: p.tutorial === true,
          modes: readModes(p.modes, current.modes),
          shop: readShop(p.shop, current.shop),
          helperSpent: Math.round(num(p.helperSpent, 0, 1e6, 0)), helperBonus: Math.round(num(p.helperBonus, 0, 1e6, 0)), reroll: Math.round(num(p.reroll, 0, 1e4, 0)),
        };
      },
      migrate: (old) => old as JamState,
    },
  ),
);

function readModes(v: unknown, d: ModeProgress): ModeProgress {
  if (!v || typeof v !== "object") return d;
  const p = v as Partial<ModeProgress>;
  const rec = (x: unknown) => { const o: Record<string, number> = {}; if (x && typeof x === "object") for (const [k, n] of Object.entries(x)) if (typeof n === "number" && k.length < 24) o[k] = n; return o; };
  return { daily: rec(p.daily), streak: Math.round(num(p.streak, 0, 1e5, 0)), lastDaily: typeof p.lastDaily === "string" ? p.lastDaily.slice(0, 10) : "", weekly: rec(p.weekly), rushBest: Math.round(num(p.rushBest, 0, 1e5, 0)), zen: Math.round(num(p.zen, 0, 1e7, 0)), packs: rec(p.packs), lab: Math.round(num(p.lab, 0, 1e7, 0)) };
}
function readShop(v: unknown, d: ShopState): ShopState {
  if (!v || typeof v !== "object") return d;
  const p = v as Partial<ShopState>;
  const owned = [...new Set([...d.owned, ...strs(p.owned, 40).filter((id) => SHOP.some((i) => i.id === id))])];
  const pickOwned = (id: unknown, def: string) => (typeof id === "string" && owned.includes(id) ? id : def);
  return { owned, finish: pickOwned(p.finish, d.finish), tray: pickOwned(p.tray, d.tray), confetti: pickOwned(p.confetti, d.confetti) };
}

let hydrated = false, started = false;
const subs = new Set<() => void>();
function hydrate() {
  if (started) return;
  started = true;
  Promise.resolve()
    .then(() => Promise.all([useJam.persist?.rehydrate(), useRoll.persist?.rehydrate()]))
    .catch(() => { /* bad save: defaults */ })
    .finally(() => {
      // a brand-new player gets their own level salt
      if (!useJam.getState().salt) useJam.setState({ salt: ((Math.random() * 2 ** 30) | 0) + 1 });
      hydrated = true; subs.forEach((f) => f());
    });
}
export function useJamHydrated() {
  return useSyncExternalStore((cb) => { subs.add(cb); hydrate(); return () => { subs.delete(cb); }; }, () => hydrated, () => false);
}
