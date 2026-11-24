// Quiltfold progress on this device: per-kind stats, the Daily Quilt and its streak, total score, recent solves and
// the puzzle in progress.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { KindId, Level, Puzzle, Rect } from "./kinds";

export interface KindStat { played: number; solved: number; best: Partial<Record<Level, number>>; bestScore: number }
export interface Solve { kind: KindId; level: Level; daily: boolean; score: number; seconds: number; hints: number; at: number }
export interface InProgress { daily?: string; puzzle: Puzzle; patches: Rect[]; seconds: number; hints: number }

interface QuiltSave {
  stats: Partial<Record<KindId, KindStat>>;
  daily: Record<string, Solve>;
  streak: number;
  streakDay: string;
  bestStreak: number;
  totalScore: number;
  recent: Solve[];
  current: InProgress | null;
  lastLevel: Partial<Record<KindId, Level>>;
  seenRules: KindId[];
}
interface QuiltStore extends QuiltSave {
  start: (k: KindId) => void;
  finish: (s: Solve, day?: string) => { newBest: boolean; streak: number };
  saveCurrent: (g: InProgress | null) => void;
  setLevel: (k: KindId, l: Level) => void;
  sawRules: (k: KindId) => void;
}

const FRESH: QuiltSave = { stats: {}, daily: {}, streak: 0, streakDay: "", bestStreak: 0, totalScore: 0, recent: [], current: null, lastLevel: {}, seenRules: [] };
const stat = (s: QuiltSave, k: KindId): KindStat => s.stats[k] ?? { played: 0, solved: 0, best: {}, bestScore: 0 };
const prevDay = (day: string) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export const useQuilt = create<QuiltStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      start: (k) => set((s) => ({ stats: { ...s.stats, [k]: { ...stat(s, k), played: stat(s, k).played + 1 } } })),
      finish: (solve, day) => {
        const s = get(), st = stat(s, solve.kind);
        const prev = st.best[solve.level], newBest = prev === undefined || solve.seconds < prev;
        const next: KindStat = { ...st, solved: st.solved + 1, best: { ...st.best, [solve.level]: newBest ? solve.seconds : prev }, bestScore: Math.max(st.bestScore, solve.score) };
        let { streak, streakDay, bestStreak } = s;
        const daily = { ...s.daily };
        if (day) {
          if (!daily[day] || daily[day].score < solve.score) daily[day] = solve;
          if (streakDay !== day) { streak = streakDay === prevDay(day) ? streak + 1 : 1; streakDay = day; bestStreak = Math.max(bestStreak, streak); }
          const keys = Object.keys(daily);
          if (keys.length > 120) keys.sort().slice(0, keys.length - 120).forEach((k) => delete daily[k]);
        }
        set({ stats: { ...s.stats, [solve.kind]: next }, daily, streak, streakDay, bestStreak, totalScore: s.totalScore + solve.score, recent: [solve, ...s.recent].slice(0, 60) });
        return { newBest, streak };
      },
      saveCurrent: (g) => set({ current: g }),
      setLevel: (k, l) => set((s) => ({ lastLevel: { ...s.lastLevel, [k]: l } })),
      sawRules: (k) => set((s) => (s.seenRules.includes(k) ? s : { seenRules: [...s.seenRules, k] })),
    }),
    { name: "momoblobs-quiltfold", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<QuiltSave>) }) as QuiltStore },
  ),
);

export function useQuiltHydrated() {
  return useSyncExternalStore((cb) => useQuilt.persist.onFinishHydration(cb), () => useQuilt.persist.hasHydrated(), () => false);
}
export const liveStreak = (s: { streak: number; streakDay: string }, today: string) => (s.streakDay === today || s.streakDay === prevDay(today) ? s.streak : 0);
