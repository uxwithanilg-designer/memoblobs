// The Blocktide dealer: picks the next three pieces. It is fair but not soft:
//   • difficulty (0 → 1) shifts the mix from small pieces to big ones as your score climbs;
//   • every tray it deals can be placed in full, in some order — it searches orders and spots before dealing — so a
//     game only ends through the player's own choices — until overdrive (difficulty above 0.8, past ~20 000
//     points), where a growing share of trays skips the check so even great runs end some day;
//   • when the board gets crowded it leans toward pieces that can finish a line, so a jam can always be broken;
//   • now and then a piece carries a pearl: wash it away in a cleared line for a bonus;
//   • the same seed deals the same pieces (a saved run picks up exactly where it was).
import { allPlaceable, canClearWith, fillRatio, fitsAnywhere, type Board } from "./board";
import { COLORS, SHAPES, type Piece, type Shape } from "./shapes";
import type { Rng } from "../sudoku/rng";

let keySeq = 1;

function weightOf(s: Shape, diff: number, fill: number): number {
  const crowd = Math.max(0, fill - 0.45) * 2; // 0 … 1.1
  const w = [
    1.0 + crowd * 1.4,
    1.15 + diff * 0.25,
    0.22 + diff * 0.55 - crowd * 0.15,
    0.05 + diff * 0.2 - crowd * 0.1,
  ][s.tier];
  // each tier's weight is shared by its shapes
  const count = SHAPES.filter((x) => x.tier === s.tier).length;
  return Math.max(0.01, w) / count * (s.tier === 0 && s.size === 1 ? 0.5 : 1);
}

function pickShape(rng: Rng, diff: number, fill: number, avoid: Set<string>): Shape {
  const pool = SHAPES.filter((s) => !avoid.has(s.id));
  const ws = pool.map((s) => weightOf(s, diff, fill));
  let t = rng.next() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { t -= ws[i]; if (t <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export interface DealOpts { difficulty: number }

export function deal(b: Board, rng: Rng, o: DealOpts): Piece[] {
  const fill = fillRatio(b);
  const strict = rng.next() >= Math.min(0.35, Math.max(0, (o.difficulty - 0.8) * 0.45));
  const diff = Math.min(1, o.difficulty);
  let best: { ids: Shape[]; score: number } | null = null;
  for (let attempt = 0; attempt < 28; attempt++) {
    const ids: Shape[] = [];
    const seen = new Set<string>();
    for (let k = 0; k < 3; k++) {
      let s = pickShape(rng, diff, fill, seen);
      for (let t = 0; t < 8 && !fitsAnywhere(b, s); t++) s = pickShape(rng, Math.max(0, diff - 0.4), fill + 0.2, seen);
      ids.push(s);
      // a twin in the same tray is fine now and then, three of a kind never
      if (rng.next() < 0.75) seen.add(s.id);
    }
    if (!ids.every((s) => fitsAnywhere(b, s))) continue;
    let score = rng.next() * 2;
    const solvable = allPlaceable(b, ids.map((s) => s.id));
    if (!solvable) { if (strict) continue; score -= 6; }
    if (fill > 0.4) score += ids.filter((s) => canClearWith(b, s)).length * (fill > 0.6 ? 3 : 1.5);
    score += new Set(ids.map((s) => s.tier)).size * 0.4;
    if (!best || score > best.score) best = { ids, score };
    if (attempt >= 5 && best) break;
  }
  if (!best) {
    // nothing passes: hand the smallest pieces that fit (this is how a lost board ends)
    const small = SHAPES.filter((s) => s.tier === 0 && fitsAnywhere(b, s));
    const ids = [0, 1, 2].map(() => (small.length ? rng.pick(small) : SHAPES[0]));
    best = { ids, score: 0 };
  }
  const colors = rng.shuffle(Array.from({ length: COLORS }, (_, i) => i + 1));
  return best.ids.map((s, k) => ({ shape: s.id, color: colors[k], key: keySeq++, pearl: s.size >= 2 && rng.next() < 0.2 ? rng.int(s.size) : undefined }));
}

/** difficulty from score: gentle for the first few thousand, full mix at ~25 000, overdrive up to 1.6 at ~100 000 */
export const endlessDifficulty = (score: number) => (score < 25000 ? Math.pow(score / 25000, 0.7) : Math.min(1.6, 1 + (score - 25000) / 125000));
