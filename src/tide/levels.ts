// Blocktide is one endless puzzle: no levels, no modes, one run until the tray no longer fits. As the score climbs the
// run dives deeper — eight depth zones (Sunny Lagoon down to Moon Tide), each with its own light and music — and
// after the last one the dive starts over, every pass a little harder (the dealer reads the score). Also here: the
// scoring, the praise words, and a scattered demo board for the art and the dev hook.
import { emptyBoard, N, type Board } from "./board";
import { COLORS, SHAPES } from "./shapes";
import { rngFrom } from "../sudoku/rng";

export interface Realm { id: string; name: string; c1: string; c2: string; deep: string; music: string }
export const REALMS: Realm[] = [
  { id: "lagoon", name: "Sunny Lagoon", c1: "#2ED3C6", c2: "#FFD166", deep: "#0a5f7a", music: "lagoon" },
  { id: "reef", name: "Coral Reef", c1: "#FF7A6B", c2: "#FFC0A8", deep: "#0b4f7c", music: "reef" },
  { id: "kelp", name: "Kelp Forest", c1: "#7EDC4A", c2: "#2ED3A0", deep: "#0b4a4a", music: "kelp" },
  { id: "wreck", name: "Sunken Ship", c1: "#E8B04B", c2: "#9C6B3A", deep: "#132e4a", music: "wreck" },
  { id: "caves", name: "Glow Caves", c1: "#9370FF", c2: "#22D3EE", deep: "#14123d", music: "caves" },
  { id: "ice", name: "Ice Shelf", c1: "#A6D6FF", c2: "#E8F6FF", deep: "#123a63", music: "ice" },
  { id: "vent", name: "Fire Vents", c1: "#FF6B3D", c2: "#FFB938", deep: "#2a1230", music: "vent" },
  { id: "moon", name: "Moon Tide", c1: "#C6B8FF", c2: "#FF8FCB", deep: "#0f1438", music: "moon" },
];

/** score where each zone starts on the first dive; later dives repeat the zones every LOOP points */
const STARTS = [0, 1500, 4000, 8000, 13000, 20000, 28000, 38000];
const LOOP = 50000;
/** which zone a score is in: index into REALMS, plus how many full dives are behind you */
export function depthOf(score: number): { zone: number; dive: number; from: number; next: number } {
  const dive = Math.floor(score / LOOP), s = score - dive * LOOP;
  let zone = 0;
  for (let i = 0; i < STARTS.length; i++) if (s >= STARTS[i]) zone = i;
  const next = zone + 1 < STARTS.length ? dive * LOOP + STARTS[zone + 1] : (dive + 1) * LOOP;
  return { zone, dive, from: dive * LOOP + STARTS[zone], next };
}

// ------------------------------------------------------------------ scoring

const LINE = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600];
export interface MoveScore { place: number; lines: number; pearls: number; allClear: number; total: number; combo: number }
/** combo = how many clearing moves in a row so far (1 = this is the first) */
export function scoreMove(cells: number, lines: number, pearls: number, allClear: boolean, combo: number): MoveScore {
  const mult = lines ? 1 + (combo - 1) * 0.5 : 1;
  const ls = Math.round(LINE[Math.min(lines, LINE.length - 1)] * mult);
  const ps = pearls * 100, ac = allClear ? 500 : 0;
  return { place: cells, lines: ls, pearls: ps, allClear: ac, total: cells + ls + ps + ac, combo };
}

export const PRAISE = ["", "Nice!", "Great!", "Splash!", "Amazing!", "Tidal!", "Tsunami!", "Legendary!"];

/** a scattered, half-filled board with a few pearls (art and dev only) */
export function demoBoard(seed: string, fill = 0.4): Board {
  const rng = rngFrom(`blocktide:demo:${seed}`);
  const b = emptyBoard();
  let filled = 0, guard = 0;
  const pool = SHAPES.filter((s) => s.tier <= 2);
  while (filled < 64 * fill && guard++ < 400) {
    const s = rng.pick(pool), color = 1 + rng.int(COLORS);
    const r = rng.int(N - s.h + 1), c = rng.int(N - s.w + 1);
    const cells = s.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
    if (cells.some((i) => b.color[i])) continue;
    cells.forEach((i) => { b.color[i] = color; });
    let full = false;
    for (let i = 0; i < N && !full; i++) {
      let rr = 0, cc = 0;
      for (let j = 0; j < N; j++) { if (b.color[i * N + j]) rr++; if (b.color[j * N + i]) cc++; }
      full = rr >= N - 1 || cc >= N - 1;
    }
    if (full) { cells.forEach((i) => { b.color[i] = 0; }); continue; }
    filled += cells.length;
    if (rng.next() < 0.25) b.pearl[rng.pick(cells)] = 1;
  }
  return b;
}
