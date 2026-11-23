// Sudoku Ninefold progress, saved on this device: per-board stats, today's tasks, the daily streak, recent solves (the
// "your best" table), the game in progress (so leaving and coming back resumes it) and settings.
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BoardId, Level, Puzzle } from "./boards";
import type { ChallengeId } from "./challenges";
import { prevDay } from "./challenges";

export interface BoardStat { played: number; solved: number; best: Partial<Record<Level, number>>; bestScore: number }
export interface Solve { board: BoardId; level: Level; kind: ChallengeId | "board"; period?: string; score: number; seconds: number; mistakes: number; hints: number; at: number }
export interface InProgress {
  kind: ChallengeId | "board";
  period?: string;
  puzzle: Puzzle;
  values: number[];
  notes: number[];
  seconds: number;
  mistakes: number;
  hints: number;
  /** "keep going" was used after the lives ran out */
  continued: boolean;
  /** this puzzle's mid-game bonus life was already given */
  lifeDrop?: boolean;
}
export interface ClaySettings { highlight: boolean; showMistakes: boolean; autoNotes: boolean; timer: boolean }

interface ClaySave {
  stats: Partial<Record<BoardId, BoardStat>>;
  /** "daily:2026-11-23" → solve */
  tasks: Record<string, Solve>;
  streak: number;
  streakDay: string;
  bestStreak: number;
  totalScore: number;
  recent: Solve[];
  current: InProgress | null;
  lastLevel: Partial<Record<BoardId, Level>>;
  settings: ClaySettings;
  seenRules: BoardId[];
  /** the lives wallet: a wrong number costs one; earned back from big puzzles */
  lives: number;
  /** big-puzzle wins (16×16, 25×25, Samurai); every second one adds a life */
  bigWins: number;
}

interface ClayStore extends ClaySave {
  start: (board: BoardId) => void;
  finish: (s: Solve) => { newBest: boolean; streak: number; lifeEarned: boolean; bigWins: number };
  loseLife: () => number;
  addLives: (n: number) => number;
  saveCurrent: (g: InProgress | null) => void;
  setLevel: (b: BoardId, l: Level) => void;
  setSettings: (p: Partial<ClaySettings>) => void;
  sawRules: (b: BoardId) => void;
}

export const START_LIVES = 5;
export const MAX_LIVES = 30;
/** the big boards: winning two of them adds a life */
export const BIG_BOARDS: BoardId[] = ["giant16", "giant25", "samurai"];

const FRESH: ClaySave = {
  stats: {}, tasks: {}, streak: 0, streakDay: "", bestStreak: 0, totalScore: 0, recent: [], current: null, lastLevel: {},
  settings: { highlight: true, showMistakes: true, autoNotes: false, timer: true }, seenRules: [], lives: START_LIVES, bigWins: 0,
};

const stat = (s: ClaySave, b: BoardId): BoardStat => s.stats[b] ?? { played: 0, solved: 0, best: {}, bestScore: 0 };

export const useClay = create<ClayStore>()(
  persist(
    (set, get) => ({
      ...FRESH,
      start: (board) => set((s) => ({ stats: { ...s.stats, [board]: { ...stat(s, board), played: stat(s, board).played + 1 } } })),
      finish: (solve) => {
        const s = get();
        const st = stat(s, solve.board);
        const prevBest = st.best[solve.level];
        const newBest = prevBest === undefined || solve.seconds < prevBest;
        const next: BoardStat = { ...st, solved: st.solved + 1, best: { ...st.best, [solve.level]: newBest ? solve.seconds : prevBest }, bestScore: Math.max(st.bestScore, solve.score) };
        const tasks = { ...s.tasks };
        let { streak, streakDay, bestStreak } = s;
        if (solve.kind !== "board" && solve.period) {
          const key = `${solve.kind}:${solve.period}`;
          if (!tasks[key] || tasks[key].score < solve.score) tasks[key] = solve;
          if (solve.kind === "daily" && streakDay !== solve.period) {
            streak = streakDay === prevDay(solve.period) ? streak + 1 : 1;
            streakDay = solve.period;
            bestStreak = Math.max(bestStreak, streak);
          }
        }
        // keep the task list small: the last ~60 days
        const keys = Object.keys(tasks);
        if (keys.length > 240) keys.sort((a, b) => tasks[a].at - tasks[b].at).slice(0, keys.length - 240).forEach((k) => delete tasks[k]);
        const big = BIG_BOARDS.includes(solve.board);
        const bigWins = s.bigWins + (big ? 1 : 0);
        const lifeEarned = big && bigWins % 2 === 0;
        const lives = Math.min(MAX_LIVES, s.lives + (lifeEarned ? 1 : 0));
        set({ stats: { ...s.stats, [solve.board]: next }, tasks, streak, streakDay, bestStreak, totalScore: s.totalScore + solve.score, recent: [solve, ...s.recent].slice(0, 60), bigWins, lives });
        return { newBest, streak, lifeEarned, bigWins };
      },
      loseLife: () => { const lives = Math.max(0, get().lives - 1); set({ lives }); return lives; },
      addLives: (n) => { const lives = Math.min(MAX_LIVES, get().lives + n); set({ lives }); return lives; },
      saveCurrent: (g) => set({ current: g }),
      setLevel: (b, l) => set((s) => ({ lastLevel: { ...s.lastLevel, [b]: l } })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      sawRules: (b) => set((s) => (s.seenRules.includes(b) ? s : { seenRules: [...s.seenRules, b] })),
    }),
    { name: "momoblobs-sudoku", version: 1, storage: createJSONStorage(() => localStorage), migrate: (old) => ({ ...FRESH, ...(old as Partial<ClaySave>) }) as ClayStore },
  ),
);

export function useClayHydrated() {
  return useSyncExternalStore((cb) => useClay.persist.onFinishHydration(cb), () => useClay.persist.hasHydrated(), () => false);
}

/** the daily streak as it stands today (broken if yesterday's Daily was missed) */
export function liveStreak(s: { streak: number; streakDay: string }, today: string) {
  return s.streakDay === today || s.streakDay === prevDay(today) ? s.streak : 0;
}
