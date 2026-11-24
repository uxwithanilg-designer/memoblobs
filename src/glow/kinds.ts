// The nine Glowfold puzzles: fill every cell with an Ember or a Frost orb so each row and column holds the same
// number of each, and no three of a kind sit in a line. Signs between cells say "same" (=) or "different" (×).
// Each kind adds a twist. Shared by the generator, the solver and the UI.

export type KindId = "classic" | "balance" | "signs" | "boxes" | "diagonals" | "wrap" | "trio" | "nosquares" | "grand";
export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** 1 = Ember, 2 = Frost, 3 = Bloom (Trio only); 0 = empty */
export const ORBS = ["", "Ember", "Frost", "Bloom"];

export interface KindInfo {
  id: KindId;
  name: string;
  tag: "Classic" | "Twist";
  blurb: string;
  rule: string;
  size: Record<Level, number>;
  /** symbols in play (2, or 3 for Trio) */
  k: 2 | 3;
  /** share of neighbour pairs that get a = / × sign */
  signs: Record<Level, number>;
  /** share of cells kept as givens at most (the dig stops here even if it could go further) */
  keep: Record<Level, number>;
  base: Record<Level, number>;
  par: Record<Level, number>;
  c1: string;
  c2: string;
  music: string;
}

export const KINDS: KindInfo[] = [
  {
    id: "classic", name: "Classic Glow", tag: "Classic", k: 2,
    blurb: "Balance Ember and Frost in every line — and follow the = and × signs.", rule: "Each row and column has as many Embers as Frosts, never three of a kind in a line; = means the two cells match, × means they differ.",
    size: { easy: 6, medium: 6, hard: 8 }, signs: { easy: 0.14, medium: 0.1, hard: 0.08 }, keep: { easy: 0.4, medium: 0.28, hard: 0 },
    base: { easy: 200, medium: 380, hard: 680 }, par: { easy: 45, medium: 90, hard: 180 }, c1: "#FF8A3D", c2: "#2FD6FF", music: "neon",
  },
  {
    id: "balance", name: "Pure Balance", tag: "Classic", k: 2,
    blurb: "No signs — and no two rows (or columns) may be the same.", rule: "Balance and no three in a line, with no signs; also no two rows and no two columns may be identical.",
    size: { easy: 6, medium: 8, hard: 10 }, signs: { easy: 0, medium: 0, hard: 0 }, keep: { easy: 0.42, medium: 0.32, hard: 0 },
    base: { easy: 220, medium: 440, hard: 800 }, par: { easy: 50, medium: 110, hard: 240 }, c1: "#FF5C8A", c2: "#5C7CFF", music: "pulse",
  },
  {
    id: "signs", name: "Sign Language", tag: "Twist", k: 2,
    blurb: "Almost no orbs to start — the signs tell the whole story.", rule: "Classic rules, but the board starts nearly empty: read the = and × signs to unlock it.",
    size: { easy: 6, medium: 6, hard: 8 }, signs: { easy: 0.42, medium: 0.34, hard: 0.28 }, keep: { easy: 0.12, medium: 0.05, hard: 0 },
    base: { easy: 240, medium: 440, hard: 760 }, par: { easy: 55, medium: 100, hard: 200 }, c1: "#B46BFF", c2: "#3DE3C2", music: "circuit",
  },
  {
    id: "boxes", name: "Glow Boxes", tag: "Twist", k: 2,
    blurb: "Every boxed area is balanced too.", rule: "Classic rules, and every outlined box also holds as many Embers as Frosts.",
    size: { easy: 6, medium: 6, hard: 8 }, signs: { easy: 0.06, medium: 0.03, hard: 0 }, keep: { easy: 0.36, medium: 0.26, hard: 0 },
    base: { easy: 240, medium: 440, hard: 760 }, par: { easy: 50, medium: 100, hard: 200 }, c1: "#FFC23D", c2: "#FF5C5C", music: "grid",
  },
  {
    id: "diagonals", name: "Diagonal Rule", tag: "Twist", k: 2,
    blurb: "No three of a kind on a diagonal either.", rule: "Classic rules, and no three of the same orb in a row on any diagonal.",
    size: { easy: 6, medium: 6, hard: 8 }, signs: { easy: 0.08, medium: 0.05, hard: 0.03 }, keep: { easy: 0.36, medium: 0.26, hard: 0 },
    base: { easy: 240, medium: 460, hard: 780 }, par: { easy: 50, medium: 105, hard: 210 }, c1: "#3DFF9A", c2: "#2F8CFF", music: "laser",
  },
  {
    id: "wrap", name: "Wrap Around", tag: "Twist", k: 2,
    blurb: "Lines loop round the edges — three in a row can wrap.", rule: "Classic rules, and lines continue across the edges: the last cell sits next to the first.",
    size: { easy: 6, medium: 8, hard: 8 }, signs: { easy: 0.08, medium: 0.05, hard: 0.03 }, keep: { easy: 0.36, medium: 0.28, hard: 0 },
    base: { easy: 240, medium: 460, hard: 780 }, par: { easy: 50, medium: 110, hard: 210 }, c1: "#2FD6FF", c2: "#7B5CFF", music: "orbit",
  },
  {
    id: "trio", name: "Trio", tag: "Twist", k: 3,
    blurb: "Ember, Frost and Bloom — three orbs to balance.", rule: "Each row and column holds the same number of Ember, Frost and Bloom, never three of a kind in a line; × means different, = means the same.",
    size: { easy: 6, medium: 6, hard: 9 }, signs: { easy: 0.12, medium: 0.08, hard: 0.05 }, keep: { easy: 0.42, medium: 0.32, hard: 0 },
    base: { easy: 260, medium: 480, hard: 820 }, par: { easy: 60, medium: 120, hard: 240 }, c1: "#3DFF9A", c2: "#FF8A3D", music: "prism",
  },
  {
    id: "nosquares", name: "No Squares", tag: "Twist", k: 2,
    blurb: "No 2×2 block may be all one orb.", rule: "Classic rules, and no 2×2 block of four cells may be all Ember or all Frost.",
    size: { easy: 6, medium: 8, hard: 8 }, signs: { easy: 0.06, medium: 0.03, hard: 0 }, keep: { easy: 0.36, medium: 0.28, hard: 0 },
    base: { easy: 240, medium: 460, hard: 780 }, par: { easy: 50, medium: 110, hard: 210 }, c1: "#FF5CF0", c2: "#FFC23D", music: "arcade",
  },
  {
    id: "grand", name: "Grand Glow", tag: "Classic", k: 2,
    blurb: "Big boards for a long, glowing session.", rule: "Classic rules on a 8×8 up to 12×12 board.",
    size: { easy: 8, medium: 10, hard: 12 }, signs: { easy: 0.08, medium: 0.05, hard: 0.03 }, keep: { easy: 0.34, medium: 0.26, hard: 0 },
    base: { easy: 600, medium: 950, hard: 1500 }, par: { easy: 150, medium: 280, hard: 500 }, c1: "#FFD23D", c2: "#2FD6FF", music: "skyline",
  },
];
export const kindOf = (id: KindId) => KINDS.find((k) => k.id === id)!;

export interface Puzzle {
  kind: KindId;
  level: Level;
  seed: string;
  n: number;
  k: 2 | 3;
  /** given orb per cell (0 empty) */
  givens: number[];
  /** signs between cells: "a-b" → "=" or "x" (a < b, orthogonal neighbours) */
  signs: Record<string, "=" | "x">;
  /** Glow Boxes: box id per cell */
  boxes?: number[];
  solution: number[];
}

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Glow Boxes: 6×6 → 2×3 boxes, 8×8 → 2×4 boxes */
export function boxesFor(n: number): number[] {
  const bh = 2, bw = n / 2;
  return Array.from({ length: n * n }, (_, i) => Math.floor(Math.floor(i / n) / bh) * (n / bw) + Math.floor((i % n) / bw));
}

export interface ScoreParts { base: number; time: number; clean: number; hints: number; total: number }
export function scoreOf(kind: KindId, level: Level, seconds: number, hints: number, mult = 1): ScoreParts {
  const k = kindOf(kind);
  const base = Math.round(k.base[level] * mult), par = k.par[level];
  const time = Math.round(base * 0.7 * Math.max(0, Math.min(1, (2 * par - seconds) / (2 * par))));
  const clean = hints === 0 ? Math.round(base * 0.2) : 0;
  const sub = base + time + clean, cut = Math.round(sub * Math.min(0.6, hints * 0.12));
  return { base, time, clean, hints: -cut, total: Math.max(Math.round(base * 0.2), sub - cut) };
}
