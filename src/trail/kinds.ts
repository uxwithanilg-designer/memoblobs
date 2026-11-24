// The nine Trailfold puzzles: one stroke through every open cell, passing the numbered stops in order. Each kind adds
// its own twist to that rule. Shared by the generator, the solver and the UI.

export type KindId = "classic" | "walls" | "islands" | "diagonal" | "arrows" | "bends" | "wrap" | "twin" | "mega";
export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface KindInfo {
  id: KindId;
  name: string;
  tag: "Classic" | "Twist";
  blurb: string;
  rule: string;
  /** grid size per level [rows, cols] */
  size: Record<Level, [number, number]>;
  /** numbered stops to aim for per level, as a share of the cells (the generator adds more until the answer is unique) */
  stops: Record<Level, number>;
  base: Record<Level, number>;
  par: Record<Level, number>;
  c1: string;
  c2: string;
  music: string;
}

export const KINDS: KindInfo[] = [
  {
    id: "classic", name: "Classic Trail", tag: "Classic",
    blurb: "Draw one line through every cell, hitting 1, 2, 3… in order.", rule: "Start at 1, pass every number in order, end on the last one — and fill every cell exactly once.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.34, medium: 0.2, hard: 0.08 },
    base: { easy: 200, medium: 380, hard: 650 }, par: { easy: 45, medium: 80, hard: 140 }, c1: "#FF7A45", c2: "#FF3D7F", music: "glide",
  },
  {
    id: "walls", name: "Wall Maze", tag: "Classic",
    blurb: "Walls block the way between some cells — find the route around them.", rule: "Classic rules, and the line can never cross a wall.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.22, medium: 0.12, hard: 0.05 },
    base: { easy: 240, medium: 420, hard: 720 }, par: { easy: 50, medium: 90, hard: 160 }, c1: "#4F7BFF", c2: "#7A4DFF", music: "maze",
  },
  {
    id: "islands", name: "Island Hop", tag: "Twist",
    blurb: "Odd-shaped islands with holes — every shape is new.", rule: "Classic rules on a board with gaps; the line only uses the tiles that exist.",
    size: { easy: [6, 6], medium: [7, 7], hard: [8, 8] }, stops: { easy: 0.26, medium: 0.14, hard: 0.06 },
    base: { easy: 260, medium: 460, hard: 760 }, par: { easy: 55, medium: 95, hard: 170 }, c1: "#19C3A6", c2: "#1E7FD8", music: "island",
  },
  {
    id: "diagonal", name: "Eight Ways", tag: "Twist",
    blurb: "Move diagonally too — but never cross your own line.", rule: "The line may step to any of the eight neighbours; two diagonal steps may not cross.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.36, medium: 0.24, hard: 0.14 },
    base: { easy: 260, medium: 460, hard: 780 }, par: { easy: 55, medium: 100, hard: 180 }, c1: "#B44DFF", c2: "#5B3BFF", music: "prism",
  },
  {
    id: "arrows", name: "Arrow Lanes", tag: "Twist",
    blurb: "Arrow tiles tell you which way to leave.", rule: "Classic rules; when the line enters an arrow tile it must leave in the arrow's direction.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.2, medium: 0.1, hard: 0.04 },
    base: { easy: 240, medium: 440, hard: 740 }, par: { easy: 50, medium: 90, hard: 160 }, c1: "#FFB21F", c2: "#FF6A1F", music: "arrow",
  },
  {
    id: "bends", name: "Bends & Straights", tag: "Twist",
    blurb: "Rings mean go straight through, diamonds mean turn.", rule: "Classic rules; the line goes straight through every ring and turns on every diamond.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.2, medium: 0.1, hard: 0.04 },
    base: { easy: 260, medium: 460, hard: 780 }, par: { easy: 55, medium: 95, hard: 175 }, c1: "#FF4F6E", c2: "#C2187A", music: "bends",
  },
  {
    id: "wrap", name: "Wrap Around", tag: "Twist",
    blurb: "Leave one edge and come back on the other side.", rule: "Classic rules; the line can exit an edge and reappear on the opposite edge.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.3, medium: 0.18, hard: 0.1 },
    base: { easy: 260, medium: 480, hard: 800 }, par: { easy: 55, medium: 100, hard: 180 }, c1: "#2FD3FF", c2: "#2F6BFF", music: "orbit",
  },
  {
    id: "twin", name: "Twin Trails", tag: "Twist",
    blurb: "Two lines, two colours — together they fill the board.", rule: "Draw the pink line through the pink numbers and the blue line through the blue ones; between them every cell is used once.",
    size: { easy: [5, 5], medium: [6, 6], hard: [7, 7] }, stops: { easy: 0.3, medium: 0.18, hard: 0.1 },
    base: { easy: 280, medium: 500, hard: 820 }, par: { easy: 60, medium: 105, hard: 190 }, c1: "#FF5CB3", c2: "#3D8BFF", music: "twin",
  },
  {
    id: "mega", name: "Mega Trail", tag: "Classic",
    blurb: "Big boards with walls — a long, satisfying route.", rule: "Classic rules with walls on a 9×9 up to 11×11 board.",
    size: { easy: [8, 8], medium: [9, 9], hard: [11, 11] }, stops: { easy: 0.14, medium: 0.08, hard: 0.035 },
    base: { easy: 600, medium: 950, hard: 1500 }, par: { easy: 150, medium: 260, hard: 480 }, c1: "#7CE05A", c2: "#16A34A", music: "summit",
  },
];
export const kindOf = (id: KindId) => KINDS.find((k) => k.id === id)!;

/** arrows: index into these directions */
export const DIRS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export interface Puzzle {
  kind: KindId;
  level: Level;
  seed: string;
  rows: number;
  cols: number;
  /** false = a gap (Island Hop) */
  open: boolean[];
  /** the stop number on a cell (1..), 0 = none; Twin Trails numbers the second line from 1 as well */
  stops: number[];
  /** Twin Trails: which line a stop belongs to (0 pink, 1 blue) */
  line?: number[];
  /** walls as "a-b" cell pairs (a < b) */
  walls: string[];
  /** Arrow Lanes: direction index into DIRS, -1 none */
  arrows?: number[];
  /** Bends & Straights: 1 = straight ring, 2 = turn diamond, 0 none */
  marks?: number[];
  /** the answer: the cells in order (Twin Trails: pink then blue, split at `split`) */
  solution: number[];
  split?: number;
}

export const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** neighbour cells of c (walls and gaps respected) */
export function neighbours(p: Pick<Puzzle, "kind" | "rows" | "cols" | "open">, c: number, walls?: Set<string>): number[] {
  const { rows: R, cols: C } = p;
  const r = Math.floor(c / C), k = c % C, out: number[] = [];
  const steps = p.kind === "diagonal" ? [[-1, 0], [0, 1], [1, 0], [0, -1], [-1, -1], [-1, 1], [1, 1], [1, -1]] : [[-1, 0], [0, 1], [1, 0], [0, -1]];
  for (const [dr, dc] of steps) {
    let rr = r + dr, cc = k + dc;
    if (p.kind === "wrap") { rr = (rr + R) % R; cc = (cc + C) % C; }
    if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
    const n = rr * C + cc;
    if (n === c || !p.open[n] || out.includes(n)) continue;
    if (walls && walls.has(edgeKey(c, n))) continue;
    out.push(n);
  }
  return out;
}

/** Eight Ways: does the diagonal step a→b cross the other diagonal of the same 2×2 square? (returns that other edge) */
export function crossingEdge(cols: number, a: number, b: number): string | null {
  const ra = Math.floor(a / cols), ca = a % cols, rb = Math.floor(b / cols), cb = b % cols;
  if (Math.abs(ra - rb) !== 1 || Math.abs(ca - cb) !== 1) return null;
  return edgeKey(ra * cols + cb, rb * cols + ca);
}

/** direction index from a to b on a plain or wrapping grid (-1 if not orthogonal) */
export function dirOf(rows: number, cols: number, a: number, b: number, wrap = false): number {
  let dr = Math.floor(b / cols) - Math.floor(a / cols), dc = (b % cols) - (a % cols);
  if (wrap) { if (dr > 1) dr -= rows; if (dr < -1) dr += rows; if (dc > 1) dc -= cols; if (dc < -1) dc += cols; }
  return DIRS.findIndex(([x, y]) => x === dr && y === dc);
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
