"use client";
// Browser-saved state: player settings + profile (coins, levels, stats, trophies, cup skins).
// Everything lives in localStorage — no account, nothing leaves the device.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Difficulty = "easy" | "medium" | "hard";
export type Quality = "auto" | "low" | "medium" | "high";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  voice: boolean;
  voiceName: string;
  charVoices: boolean;
  quality: Quality;
  renderScale: number;
  fpsCap: 0 | 30 | 60;
  showFps: boolean;
  stopMotion: boolean;
  shadows: boolean;
  autoContinue: boolean;
  autoDelay: number;
  speedAssist: boolean;
  cameraShake: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  showNumbers: boolean;
  bigButtons: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.9,
  music: 0.6,
  sfx: 0.9,
  muted: false,
  voice: true,
  voiceName: "",
  charVoices: true,
  quality: "auto",
  renderScale: 1,
  fpsCap: 60,
  showFps: false,
  stopMotion: true,
  shadows: true,
  autoContinue: true,
  autoDelay: 1.5,
  speedAssist: false,
  cameraShake: true,
  haptics: true,
  reducedMotion: false,
  showNumbers: true,
  bigButtons: false,
};

interface SettingsStore extends Settings {
  set: (p: Partial<Settings>) => void;
  reset: () => void;
}

const storage = createJSONStorage(() => localStorage);

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({ ...DEFAULT_SETTINGS, set: (p) => set(p), reset: () => set(DEFAULT_SETTINGS) }),
    {
      name: "momoblobs:settings", version: 2, storage, skipHydration: true,
      migrate: (old) => ({ ...DEFAULT_SETTINGS, ...(old as Partial<Settings>) }),
    },
  ),
);

// ---------------------------------------------------------------- profile
export interface GameStats {
  rounds: number;
  correct: number;
  wrong: number;
  coinsEarned: number;
  level: Record<Difficulty, number>;
  maxLevel: Record<Difficulty, number>;
  bestStreak: Record<Difficulty, number>;
  twistsWon: Record<string, number>;
  seconds: number;
  lastPlayed: number;
  lastDifficulty: Difficulty;
}

export const emptyStats = (): GameStats => ({
  rounds: 0, correct: 0, wrong: 0, coinsEarned: 0,
  level: { easy: 1, medium: 1, hard: 1 },
  maxLevel: { easy: 1, medium: 1, hard: 1 },
  bestStreak: { easy: 0, medium: 0, hard: 0 },
  twistsWon: {}, seconds: 0, lastPlayed: 0, lastDifficulty: "easy",
});

export interface ArcadeStats {
  level: Record<Difficulty, number>;
  maxLevel: Record<Difficulty, number>;
  best: Record<Difficulty, number>;
  clears: number;
  runs: number;
  coins: number;
  seconds: number;
  lastDifficulty: Difficulty;
  lastPlayed: number;
}
export const emptyArcade = (): ArcadeStats => ({
  level: { easy: 1, medium: 1, hard: 1 }, maxLevel: { easy: 1, medium: 1, hard: 1 }, best: { easy: 0, medium: 0, hard: 0 },
  clears: 0, runs: 0, coins: 0, seconds: 0, lastDifficulty: "easy", lastPlayed: 0,
});

export interface RoundRecord {
  game: string;
  difficulty: Difficulty;
  correct: boolean;
  level: number;
  streak: number;
  twist: string;
  coins: number;
}

interface ProfileState {
  nickname: string;
  avatar: string;
  coins: number;
  totalCoins: number;
  games: Record<string, GameStats>;
  arcade: Record<string, ArcadeStats>;
  owned: string[];
  equippedCup: string;
  trophies: Record<string, number>;
  lastGift: string | null;
  playDays: string[];
  createdAt: number;
}

interface ProfileStore extends ProfileState {
  recordRound: (r: RoundRecord) => string[];
  addPlayTime: (game: string, seconds: number) => void;
  setDifficulty: (game: string, d: Difficulty) => void;
  arcadeClear: (slug: string, d: Difficulty, level: number, score: number, coins: number, run?: boolean) => string[];
  arcadeTouch: (slug: string, d: Difficulty, seconds?: number) => void;
  claimGift: () => number;
  /** add coins earned in any game (racing etc.) */
  earnCoins: (amount: number) => void;
  /** spend coins; false if not enough */
  spendCoins: (amount: number) => boolean;
  buy: (id: string, price: number) => boolean;
  equipCup: (id: string) => void;
  setNickname: (n: string) => void;
  setAvatar: (a: string) => void;
  resetProgress: () => void;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const initialProfile = (): ProfileState => ({
  nickname: "Player",
  avatar: "momo",
  coins: 0,
  totalCoins: 0,
  games: {},
  arcade: {},
  owned: ["classic"],
  equippedCup: "classic",
  trophies: {},
  lastGift: null,
  playDays: [],
  createdAt: Date.now(),
});

// ---------------------------------------------------------------- trophies
export interface Trophy { id: string; title: string; desc: string; icon: string; test: (p: ProfileState) => boolean }

const ms = (p: ProfileState) => p.games["momo-shuffle"] ?? emptyStats();
export function dayStreak(days: string[]) {
  if (!days.length) return 0;
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!set.has(k)) break;
    n++; d.setDate(d.getDate() - 1);
  }
  return n;
}

export const TROPHIES: Trophy[] = [
  { id: "first-find", title: "First Find", desc: "Find Momo for the first time.", icon: "🎯", test: (p) => ms(p).correct >= 1 },
  { id: "sharp-eyes", title: "Sharp Eyes", desc: "Find Momo 5 times in a row.", icon: "👀", test: (p) => Math.max(...Object.values(ms(p).bestStreak)) >= 5 },
  { id: "eagle-eyes", title: "Eagle Eyes", desc: "Find Momo 10 times in a row.", icon: "🦅", test: (p) => Math.max(...Object.values(ms(p).bestStreak)) >= 10 },
  { id: "easy-10", title: "Warm-Up Champ", desc: "Reach level 10 on Easy.", icon: "🟢", test: (p) => ms(p).maxLevel.easy >= 10 },
  { id: "medium-10", title: "Shuffle Pro", desc: "Reach level 10 on Medium.", icon: "🟡", test: (p) => ms(p).maxLevel.medium >= 10 },
  { id: "hard-10", title: "Six-Cup Legend", desc: "Reach level 10 on Hard.", icon: "🔴", test: (p) => ms(p).maxLevel.hard >= 10 },
  { id: "not-fooled", title: "Not Fooled", desc: "Win a Fake-Out round.", icon: "🃏", test: (p) => (ms(p).twistsWon.fakeout ?? 0) >= 1 },
  { id: "night-owl", title: "Night Owl", desc: "Win a Lights-Off round.", icon: "🌙", test: (p) => (ms(p).twistsWon.blackout ?? 0) >= 1 },
  { id: "dizzy", title: "Not Dizzy", desc: "Win a Triple-Spin round.", icon: "🌀", test: (p) => (ms(p).twistsWon.spin ?? 0) >= 1 },
  { id: "coins-500", title: "Coin Collector", desc: "Earn 500 coins in total.", icon: "🪙", test: (p) => p.totalCoins >= 500 },
  { id: "coins-2500", title: "Treasure Blob", desc: "Earn 2,500 coins in total.", icon: "💰", test: (p) => p.totalCoins >= 2500 },
  { id: "days-3", title: "Daily Player", desc: "Play 3 days in a row.", icon: "📅", test: (p) => dayStreak(p.playDays) >= 3 },
  { id: "explorer", title: "Explorer", desc: "Clear a level in 3 different arcade games.", icon: "🧭", test: (p) => Object.values(p.arcade ?? {}).filter((a) => a.clears > 0).length >= 3 },
  { id: "score-5000", title: "High Scorer", desc: "Score 5,000 points in one arcade game.", icon: "🏅", test: (p) => Object.values(p.arcade ?? {}).some((a) => Math.max(...Object.values(a.best)) >= 5000) },
  { id: "level-20", title: "Level 20 Hero", desc: "Reach level 20 in any arcade game.", icon: "🚀", test: (p) => Object.values(p.arcade ?? {}).some((a) => Math.max(...Object.values(a.maxLevel)) >= 20) },
];

function checkTrophies(p: ProfileState) {
  const fresh: string[] = [];
  for (const t of TROPHIES) if (!p.trophies[t.id] && t.test(p)) fresh.push(t.id);
  return fresh;
}

export const useProfile = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...initialProfile(),
      recordRound: (r) => {
        const p = get();
        const st = { ...emptyStats(), ...(p.games[r.game] ?? {}) };
        st.level = { ...st.level }; st.maxLevel = { ...st.maxLevel }; st.bestStreak = { ...st.bestStreak }; st.twistsWon = { ...st.twistsWon };
        st.rounds++;
        if (r.correct) {
          st.correct++;
          st.coinsEarned += r.coins;
          st.level[r.difficulty] = r.level + 1;
          st.maxLevel[r.difficulty] = Math.max(st.maxLevel[r.difficulty], r.level + 1);
          st.bestStreak[r.difficulty] = Math.max(st.bestStreak[r.difficulty], r.streak);
          if (r.twist !== "warmup") st.twistsWon[r.twist] = (st.twistsWon[r.twist] ?? 0) + 1;
        } else st.wrong++;
        st.lastPlayed = Date.now();
        st.lastDifficulty = r.difficulty;
        const day = today();
        const playDays = p.playDays.includes(day) ? p.playDays : [...p.playDays, day].slice(-30);
        const next: ProfileState = { ...p, coins: p.coins + r.coins, totalCoins: p.totalCoins + r.coins, games: { ...p.games, [r.game]: st }, playDays };
        const fresh = checkTrophies(next);
        if (fresh.length) next.trophies = { ...p.trophies, ...Object.fromEntries(fresh.map((id) => [id, Date.now()])) };
        set(next);
        return fresh;
      },
      addPlayTime: (game, seconds) => {
        const p = get();
        const st = { ...emptyStats(), ...(p.games[game] ?? {}) };
        st.seconds += seconds;
        set({ games: { ...p.games, [game]: st } });
      },
      setDifficulty: (game, d) => {
        const p = get();
        const st = { ...emptyStats(), ...(p.games[game] ?? {}) };
        st.lastDifficulty = d;
        set({ games: { ...p.games, [game]: st } });
      },
      arcadeClear: (slug, d, level, score, coins, run = false) => {
        const p = get();
        const a = { ...emptyArcade(), ...(p.arcade?.[slug] ?? {}) };
        a.level = { ...a.level }; a.maxLevel = { ...a.maxLevel }; a.best = { ...a.best };
        if (run) { a.runs++; a.level[d] = 1; } else { a.clears++; a.level[d] = level + 1; }
        a.maxLevel[d] = Math.max(a.maxLevel[d], run ? level : level + 1);
        a.best[d] = Math.max(a.best[d], score);
        a.coins += coins; a.lastDifficulty = d; a.lastPlayed = Date.now();
        const day = today();
        const playDays = p.playDays.includes(day) ? p.playDays : [...p.playDays, day].slice(-30);
        const next: ProfileState = { ...p, coins: p.coins + coins, totalCoins: p.totalCoins + coins, arcade: { ...(p.arcade ?? {}), [slug]: a }, playDays };
        const fresh = checkTrophies(next);
        if (fresh.length) next.trophies = { ...p.trophies, ...Object.fromEntries(fresh.map((id) => [id, Date.now()])) };
        set(next);
        return fresh;
      },
      arcadeTouch: (slug, d, seconds = 0) => {
        const p = get();
        const a = { ...emptyArcade(), ...(p.arcade?.[slug] ?? {}) };
        a.lastDifficulty = d; a.seconds += seconds; a.lastPlayed = Date.now();
        set({ arcade: { ...(p.arcade ?? {}), [slug]: a } });
      },
      claimGift: () => {
        const p = get();
        if (p.lastGift === today()) return 0;
        const amount = 50 + Math.min(6, dayStreak(p.playDays)) * 10;
        set({ coins: p.coins + amount, totalCoins: p.totalCoins + amount, lastGift: today() });
        return amount;
      },
      earnCoins: (amount) => { const p = get(); const a = Math.max(0, Math.round(amount)); set({ coins: p.coins + a, totalCoins: p.totalCoins + a, playDays: p.playDays.includes(today()) ? p.playDays : [...p.playDays, today()].slice(-60) }); },
      spendCoins: (amount) => { const p = get(); if (p.coins < amount) return false; set({ coins: p.coins - amount }); return true; },
      buy: (id, price) => {
        const p = get();
        if (p.owned.includes(id) || p.coins < price) return false;
        set({ coins: p.coins - price, owned: [...p.owned, id], equippedCup: id });
        return true;
      },
      equipCup: (id) => { if (get().owned.includes(id)) set({ equippedCup: id }); },
      setNickname: (n) => set({ nickname: n.trim().slice(0, 16) || "Player" }),
      setAvatar: (a) => set({ avatar: a }),
      resetProgress: () => set(initialProfile()),
    }),
    {
      name: "momoblobs:profile", version: 2, storage, skipHydration: true,
      migrate: (old) => ({ ...initialProfile(), ...(old as Partial<ProfileState>) }),
    },
  ),
);

export const CUP_SKINS = [
  { id: "classic", name: "Classic Grape", color: "#8E6CE0", price: 0 },
  { id: "mint", name: "Minty Fresh", color: "#2EC4B6", price: 150 },
  { id: "bubblegum", name: "Bubblegum", color: "#FF6F91", price: 300 },
  { id: "sunny", name: "Sunny Side", color: "#FFC93C", price: 500 },
  { id: "tomato", name: "Tomato Pop", color: "#E8504F", price: 800 },
  { id: "lime", name: "Lime Splash", color: "#74C94E", price: 1100 },
  { id: "midnight", name: "Midnight", color: "#3A2A63", price: 1600 },
  { id: "orange", name: "Momo Orange", color: "#FF8A3D", price: 2200 },
] as const;

export const AVATARS = [
  { id: "momo", label: "Momo", src: "/brand/momo-cheer.webp" },
  { id: "momo-sly", label: "Sneaky Momo", src: "/brand/momo-sly.webp" },
  { id: "momo-wow", label: "Wow Momo", src: "/brand/momo-surprised.webp" },
  { id: "kranky", label: "Kranky", src: "/brand/kranky.webp" },
  { id: "tiki", label: "Tiki", src: "/brand/tiki.webp" },
  { id: "cup", label: "Cup", src: "/brand/cup.webp" },
];

/** Rehydrate the persisted stores once on the client; returns true after hydration. */
let hydrated = false;
let started = false;
const hydrationListeners = new Set<() => void>();
function startHydration() {
  if (started) return;
  started = true;
  Promise.all([useSettings.persist.rehydrate(), useProfile.persist.rehydrate()]).finally(() => {
    hydrated = true;
    hydrationListeners.forEach((l) => l());
  });
}
const subscribeHydration = (cb: () => void) => {
  hydrationListeners.add(cb);
  startHydration();
  return () => { hydrationListeners.delete(cb); };
};
export function useHydrated() {
  return useSyncExternalStore(subscribeHydration, () => hydrated, () => false);
}
