// The nine Quiltfold puzzles: cut the board into rectangular patches, each holding exactly one number that tells its
// size in cells. Each kind adds a twist. Shared by the generator, the solver and the UI.

export type KindId = "classic" | "shapes" | "squares" | "ribbons" | "holes" | "mystery" | "notwins" | "fences" | "giant";
export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface KindInfo {
  id: KindId;
  name: string;
  tag: "Classic" | "Twist";
  blurb: string;
  rule: string;
  size: Record<Level, [number, number]>;
  /** largest patch per level */
  maxArea: Record<Level, number>;
  base: Record<Level, number>;
  par: Record<Level, number>;
  c1: string;
  c2: string;
  music: string;
}

export const KINDS: KindInfo[] = [
  {
    id: "classic", name: "Classic Quilt", tag: "Classic",
    blurb: "Cut the board into rectangles — each holds one number, its size.", rule: "Split the board into rectangles. Each rectangle covers exactly one number, and that number is how many cells it has.",
    size: { easy: [5, 5], medium: [7, 7], hard: [9, 9] }, maxArea: { easy: 6, medium: 9, hard: 12 },
    base: { easy: 200, medium: 400, hard: 700 }, par: { easy: 40, medium: 90, hard: 180 }, c1: "#FF8A5B", c2: "#E8456B", music: "cozy",
  },
  {
    id: "shapes", name: "Shape Hints", tag: "Classic",
    blurb: "Some numbers say square, tall or wide.", rule: "Classic rules; a patch marked ■ is a square, ▮ is taller than wide, ▬ is wider than tall.",
    size: { easy: [6, 6], medium: [7, 7], hard: [8, 8] }, maxArea: { easy: 8, medium: 10, hard: 12 },
    base: { easy: 240, medium: 440, hard: 740 }, par: { easy: 50, medium: 100, hard: 190 }, c1: "#5B8CFF", c2: "#7B4DFF", music: "craft",
  },
  {
    id: "squares", name: "Squares Only", tag: "Twist",
    blurb: "Every patch is a perfect square.", rule: "Classic rules, and every patch must be a square: 1, 4, 9 or 16 cells.",
    size: { easy: [6, 6], medium: [8, 8], hard: [10, 10] }, maxArea: { easy: 9, medium: 16, hard: 16 },
    base: { easy: 240, medium: 460, hard: 760 }, par: { easy: 45, medium: 95, hard: 180 }, c1: "#2FC6A0", c2: "#0F8F8A", music: "checker",
  },
  {
    id: "ribbons", name: "Ribbons", tag: "Twist",
    blurb: "Every patch is a thin strip, one cell wide.", rule: "Classic rules, and every patch is a straight ribbon one cell wide — across or down.",
    size: { easy: [5, 5], medium: [7, 7], hard: [8, 8] }, maxArea: { easy: 5, medium: 7, hard: 8 },
    base: { easy: 220, medium: 420, hard: 720 }, par: { easy: 45, medium: 95, hard: 180 }, c1: "#FF5FA2", c2: "#C2307A", music: "ribbon",
  },
  {
    id: "holes", name: "Holey Quilt", tag: "Twist",
    blurb: "A quilt with holes — patches go around the gaps.", rule: "Classic rules on a board with gaps; no patch may cover a gap.",
    size: { easy: [6, 6], medium: [7, 7], hard: [9, 9] }, maxArea: { easy: 6, medium: 8, hard: 10 },
    base: { easy: 240, medium: 440, hard: 740 }, par: { easy: 50, medium: 100, hard: 190 }, c1: "#F2B33D", c2: "#D9731F", music: "window",
  },
  {
    id: "mystery", name: "Mystery Marks", tag: "Twist",
    blurb: "Some patches only show a ?, not their size.", rule: "Classic rules; a ? patch can be any size, but still holds exactly one mark.",
    size: { easy: [6, 6], medium: [7, 7], hard: [9, 9] }, maxArea: { easy: 6, medium: 9, hard: 12 },
    base: { easy: 260, medium: 480, hard: 800 }, par: { easy: 55, medium: 110, hard: 210 }, c1: "#8B5CF6", c2: "#4C1D95", music: "mystery",
  },
  {
    id: "notwins", name: "No Twins", tag: "Twist",
    blurb: "Two patches of the same size may never touch side by side.", rule: "Classic rules, and patches of equal size never share an edge.",
    size: { easy: [5, 5], medium: [7, 7], hard: [8, 8] }, maxArea: { easy: 6, medium: 8, hard: 10 },
    base: { easy: 260, medium: 480, hard: 800 }, par: { easy: 55, medium: 110, hard: 210 }, c1: "#FF6B4A", c2: "#B8361F", music: "dance",
  },
  {
    id: "fences", name: "Fences", tag: "Twist",
    blurb: "Stitched fences split the board — no patch crosses one.", rule: "Classic rules, and no patch may cross a fence line.",
    size: { easy: [6, 6], medium: [7, 7], hard: [9, 9] }, maxArea: { easy: 8, medium: 10, hard: 12 },
    base: { easy: 240, medium: 440, hard: 760 }, par: { easy: 50, medium: 100, hard: 190 }, c1: "#7CB342", c2: "#3E7A1E", music: "farm",
  },
  {
    id: "giant", name: "Giant Quilt", tag: "Classic",
    blurb: "Big boards and big patches — a long, calm stitch-up.", rule: "Classic rules on a 10×10 up to 14×14 board.",
    size: { easy: [10, 10], medium: [12, 12], hard: [14, 14] }, maxArea: { easy: 12, medium: 16, hard: 20 },
    base: { easy: 700, medium: 1100, hard: 1700 }, par: { easy: 180, medium: 300, hard: 520 }, c1: "#3FB6E8", c2: "#1E6FB8", music: "grand",
  },
];
export const kindOf = (id: KindId) => KINDS.find((k) => k.id === id)!;

/** a rectangle: top-left row/col and its height/width */
export interface Rect { r: number; c: number; h: number; w: number }
export const area = (x: Rect) => x.h * x.w;
export const cellsOf = (x: Rect, cols: number) => { const o: number[] = []; for (let i = 0; i < x.h; i++) for (let j = 0; j < x.w; j++) o.push((x.r + i) * cols + x.c + j); return o; };
export const sameRect = (a: Rect, b: Rect) => a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

/** shape hints: 1 = square, 2 = tall, 3 = wide */
export type Shape = 0 | 1 | 2 | 3;
export const shapeOf = (x: Rect): Shape => (x.h === x.w ? 1 : x.h > x.w ? 2 : 3);

export interface Puzzle {
  kind: KindId;
  level: Level;
  seed: string;
  rows: number;
  cols: number;
  open: boolean[];
  /** the clue on a cell: its area, -1 for a mystery mark, 0 none */
  clue: number[];
  /** shape hint per clue cell (Shape Hints) */
  shape?: Shape[];
  /** fences between cells, "a-b" with a < b */
  fences: string[];
  /** the answer: one rectangle per clue, in clue-cell order */
  solution: Rect[];
}

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export interface ScoreParts { base: number; time: number; clean: number; hints: number; total: number }
export function scoreOf(kind: KindId, level: Level, seconds: number, hints: number, mult = 1): ScoreParts {
  const k = kindOf(kind);
  const base = Math.round(k.base[level] * mult), par = k.par[level];
  const time = Math.round(base * 0.7 * Math.max(0, Math.min(1, (2 * par - seconds) / (2 * par))));
  const clean = hints === 0 ? Math.round(base * 0.2) : 0;
  const sub = base + time + clean, cut = Math.round(sub * Math.min(0.6, hints * 0.12));
  return { base, time, clean, hints: -cut, total: Math.max(Math.round(base * 0.2), sub - cut) };
}
