// Today's tasks: the same puzzles for every player on Earth. Daily ones change at midnight UTC, the Weekly Epic every
// Monday (UTC). The seed is the date, so every device builds exactly the same grid.
import type { BoardId, Level } from "./boards";

export type ChallengeId = "daily" | "mini" | "blitz" | "epic";

export interface Challenge {
  id: ChallengeId;
  name: string;
  kicker: string;
  blurb: string;
  board: BoardId;
  level: Level;
  /** score multiplier */
  mult: number;
  bonusCoins: number;
  /** Speed Blitz: seconds on the clock */
  clock?: number;
  weekly?: boolean;
  music: string;
  c1: string;
  c2: string;
}

export const CHALLENGES: Challenge[] = [
  { id: "daily", name: "Daily Classic", kicker: "Daily task", blurb: "Today's 9×9 — the same grid for every player in the world.", board: "classic9", level: "medium", mult: 1.5, bonusCoins: 40, music: "daily", c1: "#FFB23D", c2: "#FF6A3D" },
  { id: "mini", name: "Mini Express", kicker: "Warm-up", blurb: "A one-minute 4×4 to wake up your brain.", board: "mini4", level: "medium", mult: 1.5, bonusCoins: 12, music: "pebble", c1: "#3DDC97", c2: "#0F8A6C" },
  { id: "blitz", name: "Speed Blitz", kicker: "Race the clock", blurb: "A 6×6 against a 3-minute clock. Every second left is points.", board: "classic6", level: "medium", mult: 1.6, bonusCoins: 20, clock: 180, music: "blitz", c1: "#4FA3FF", c2: "#7B5CFF" },
  { id: "epic", name: "Weekly Epic", kicker: "All week", blurb: "One giant 16×16 for the whole week. Take your time.", board: "giant16", level: "medium", mult: 2, bonusCoins: 150, weekly: true, music: "epic", c1: "#B57BFF", c2: "#FF5CA8" },
];
export const challengeOf = (id: ChallengeId) => CHALLENGES.find((c) => c.id === id)!;

const pad = (n: number) => String(n).padStart(2, "0");
export const utcDay = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
/** ISO week (Monday start, UTC) as YYYY-Www */
export function utcWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(w)}`;
}
/** the period key a challenge belongs to right now */
export const periodOf = (c: Challenge, d = new Date()) => (c.weekly ? utcWeek(d) : utcDay(d));
export const seedOf = (c: Challenge, d = new Date()) => `${c.id}-${periodOf(c, d)}`;

/** milliseconds until the next daily (midnight UTC) or weekly (Monday midnight UTC) puzzle */
export function msUntilNext(weekly = false, now = new Date()) {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (weekly) { while (t.getUTCDay() !== 1) t.setUTCDate(t.getUTCDate() + 1); }
  return t.getTime() - now.getTime();
}
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(x)}` : `${pad(h)}:${pad(m)}:${pad(x)}`;
}
/** the day before (for streaks) */
export const prevDay = (day: string) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return utcDay(d); };
