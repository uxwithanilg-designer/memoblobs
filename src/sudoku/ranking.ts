// World ranking: the shape the game uses for leaderboards. Until MOMOBLOBS sign-in arrives every list comes from this
// device's own solves; when accounts and the scores API exist, `submitScore` and `fetchBoard` talk to it and nothing
// in the UI has to change. Scores stay verifiable later: each solve keeps its puzzle seed.
import type { BoardId, Level } from "./boards";
import type { ChallengeId } from "./challenges";
import { useClay, type Solve } from "./save";

export type RankScope = "today" | "week" | "all";
export interface RankRow { rank: number; name: string; country?: string; score: number; seconds: number; you?: boolean }

/** true once the online ranking is switched on (sign-in + scores API) */
export const ONLINE_RANKING = false;

export interface ScoreSubmission { kind: ChallengeId | "board"; board: BoardId; level: Level; seed: string; period?: string; score: number; seconds: number; mistakes: number; hints: number }

/** sends a finished solve to the world ranking (no-op on this device-only build) */
export async function submitScore(s: ScoreSubmission): Promise<void> {
  if (!ONLINE_RANKING) return;
  void s; // the sign-in build posts it to the scores API here
}

/** this device's best solves for a scope, as ranking rows */
export function localBoard(scope: RankScope, name: string, now = Date.now()): RankRow[] {
  const recent: Solve[] = useClay.getState().recent;
  const since = scope === "today" ? now - 86400000 : scope === "week" ? now - 7 * 86400000 : 0;
  return recent
    .filter((r) => r.at >= since)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, name, score: r.score, seconds: r.seconds, you: true }));
}
