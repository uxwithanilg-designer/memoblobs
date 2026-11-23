// The nine Sudoku Ninefold boards: their shape (cells, rows / columns / boxes / diagonals as "units"), the extra rule each one
// adds, how many givens each level keeps and how scores are counted. Shared by the generator, the solver and the UI.

export type BoardId = "mini4" | "classic6" | "classic9" | "giant16" | "giant25" | "killer" | "xsudoku" | "thermo" | "samurai";
export type Level = "easy" | "medium" | "hard" | "expert";
export const LEVELS: Level[] = ["easy", "medium", "hard", "expert"];
export const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

export interface Cage { cells: number[]; sum: number }

/** everything the game needs to show and check one puzzle */
export interface Puzzle {
  board: BoardId;
  level: Level;
  seed: string;
  /** values are 1..n */
  n: number;
  rows: number;
  cols: number;
  /** 0 = given empty, else the given value; -1 = no cell here (Samurai's gaps) */
  givens: number[];
  solution: number[];
  cages?: Cage[];
  /** each thermometer: cell indexes from the bulb (smallest) to the tip */
  thermos?: number[][];
}

export interface BoardInfo {
  id: BoardId;
  name: string;
  short: string;
  tag: "Classic" | "New rule";
  blurb: string;
  rule: string;
  n: number;
  /** box height × width (classic shapes) */
  box: [number, number];
  levels: Level[];
  /** share of cells left as givens per level (box boards); extra givens per level for rule boards */
  givens: Partial<Record<Level, number>>;
  /** base score for a clean solve per level */
  base: Partial<Record<Level, number>>;
  /** par time in seconds per level (the time bonus counts down from it) */
  par: Partial<Record<Level, number>>;
  /** colour pair for cards and the board's glow */
  c1: string;
  c2: string;
  /** music key (music_sudoku_<key>) */
  music: string;
}

export const BOARDS: BoardInfo[] = [
  {
    id: "mini4", name: "Mini 4×4", short: "Mini", tag: "Classic", n: 4, box: [2, 2],
    blurb: "A pocket grid with four numbers — the perfect warm-up.", rule: "Fill every row, column and 2×2 box with 1–4.",
    levels: ["easy", "medium"], givens: { easy: 0.5, medium: 0.34 }, base: { easy: 120, medium: 200 }, par: { easy: 45, medium: 70 },
    c1: "#3DDC97", c2: "#0F8A6C", music: "pebble",
  },
  {
    id: "classic6", name: "Classic 6×6", short: "6×6", tag: "Classic", n: 6, box: [2, 3],
    blurb: "Six numbers and 2×3 boxes — quick, clever and great on a phone.", rule: "Fill every row, column and 2×3 box with 1–6.",
    levels: ["easy", "medium", "hard"], givens: { easy: 0.56, medium: 0.44, hard: 0.36 }, base: { easy: 250, medium: 380, hard: 520 }, par: { easy: 120, medium: 200, hard: 300 },
    c1: "#FFC24B", c2: "#E07B1F", music: "garden",
  },
  {
    id: "classic9", name: "Classic 9×9", short: "9×9", tag: "Classic", n: 9, box: [3, 3],
    blurb: "The original — rows, columns and 3×3 boxes, from gentle to fiendish.", rule: "Fill every row, column and 3×3 box with 1–9.",
    levels: ["easy", "medium", "hard", "expert"], givens: { easy: 0.47, medium: 0.4, hard: 0.33, expert: 0.28 }, base: { easy: 500, medium: 800, hard: 1200, expert: 1700 }, par: { easy: 360, medium: 600, hard: 900, expert: 1300 },
    c1: "#4FA3FF", c2: "#3557E0", music: "studio",
  },
  {
    id: "giant16", name: "Giant 16×16", short: "16×16", tag: "Classic", n: 16, box: [4, 4],
    blurb: "Sixteen symbols, 4×4 boxes — a long, satisfying solve.", rule: "Fill every row, column and 4×4 box with 1–9 and A–G.",
    levels: ["easy", "medium", "hard"], givens: { easy: 0.55, medium: 0.48, hard: 0.42 }, base: { easy: 1800, medium: 2600, hard: 3600 }, par: { easy: 1200, medium: 1800, hard: 2600 },
    c1: "#A77BFF", c2: "#6B3FD6", music: "cosmos",
  },
  {
    id: "giant25", name: "Giant 25×25", short: "25×25", tag: "Classic", n: 25, box: [5, 5],
    blurb: "625 cells. The grandmaster grid for a long, calm session.", rule: "Fill every row, column and 5×5 box with 1–9 and A–P.",
    levels: ["easy", "hard"], givens: { easy: 0.6, hard: 0.52 }, base: { easy: 4000, hard: 6000 }, par: { easy: 2700, hard: 4200 },
    c1: "#FF8A3D", c2: "#C2410C", music: "summit",
  },
  {
    id: "killer", name: "Killer Sudoku", short: "Killer", tag: "New rule", n: 9, box: [3, 3],
    blurb: "Dashed cages show a sum — few or no givens, pure deduction.", rule: "Classic rules, plus the numbers in each cage add up to its total, with no repeats in a cage.",
    levels: ["easy", "medium", "hard"], givens: { easy: 16, medium: 8, hard: 0 }, base: { easy: 900, medium: 1300, hard: 1900 }, par: { easy: 600, medium: 900, hard: 1300 },
    c1: "#FF5C7A", c2: "#B3123E", music: "noir",
  },
  {
    id: "xsudoku", name: "Sudoku X", short: "X", tag: "New rule", n: 9, box: [3, 3],
    blurb: "Both long diagonals must hold 1–9 too.", rule: "Classic rules, plus each of the two main diagonals holds 1–9 once.",
    levels: ["easy", "medium", "hard"], givens: { easy: 0.42, medium: 0.35, hard: 0.29 }, base: { easy: 650, medium: 1000, hard: 1450 }, par: { easy: 420, medium: 700, hard: 1000 },
    c1: "#2ED3E6", c2: "#0E7C9C", music: "neon",
  },
  {
    id: "thermo", name: "Thermo Sudoku", short: "Thermo", tag: "New rule", n: 9, box: [3, 3],
    blurb: "Clay thermometers: numbers climb from the bulb to the tip.", rule: "Classic rules, plus digits on a thermometer strictly increase from the bulb.",
    levels: ["easy", "medium", "hard"], givens: { easy: 8, medium: 4, hard: 0 }, base: { easy: 800, medium: 1200, hard: 1750 }, par: { easy: 540, medium: 840, hard: 1200 },
    c1: "#FF7B54", c2: "#E0301E", music: "ember",
  },
  {
    id: "samurai", name: "Samurai Sudoku", short: "Samurai", tag: "New rule", n: 9, box: [3, 3],
    blurb: "Five 9×9 grids overlap in a cross. Solve all five at once.", rule: "Each of the five 9×9 grids follows classic rules; the shared corner boxes belong to two grids.",
    levels: ["easy", "medium", "hard"], givens: { easy: 0.46, medium: 0.4, hard: 0.35 }, base: { easy: 2600, medium: 3600, hard: 4800 }, par: { easy: 1800, medium: 2600, hard: 3600 },
    c1: "#F2C94C", c2: "#8E5B12", music: "dojo",
  },
];
export const boardOf = (id: BoardId) => BOARDS.find((b) => b.id === id)!;

/** the symbol shown for a value: 1–9 then A, B, C … (16×16 and 25×25) */
export const sym = (v: number) => (v <= 0 ? "" : v <= 9 ? String(v) : String.fromCharCode(55 + v));
/** keyboard symbol → value */
export function valueOfKey(key: string, n: number): number {
  if (/^[1-9]$/.test(key)) { const v = Number(key); return v <= n ? v : 0; }
  if (n > 9 && /^[a-z]$/i.test(key)) { const v = key.toUpperCase().charCodeAt(0) - 55; return v >= 10 && v <= n ? v : 0; }
  return 0;
}

// ------------------------------------------------------------------ geometry

export interface Geometry {
  rows: number;
  cols: number;
  n: number;
  /** cell exists (Samurai has gaps) */
  active: boolean[];
  /** units that must hold every value 1..n exactly once */
  units: number[][];
  /** box index per cell (for thick borders); -1 for gaps */
  boxOf: number[];
  /** for every cell, the other cells it can't repeat a value with */
  peers: number[][];
  diag?: [number[], number[]];
}

const cache = new Map<BoardId, Geometry>();

function boxGrid(n: number, br: number, bc: number, r0 = 0, c0 = 0, cols = n) {
  const rows: number[][] = [], colsU: number[][] = [], boxes: number[][] = [];
  const at = (r: number, c: number) => (r0 + r) * cols + c0 + c;
  for (let r = 0; r < n; r++) rows.push(Array.from({ length: n }, (_, c) => at(r, c)));
  for (let c = 0; c < n; c++) colsU.push(Array.from({ length: n }, (_, r) => at(r, c)));
  for (let b = 0; b < n; b++) {
    const R = Math.floor(b / (n / bc)) * br, C = (b % (n / bc)) * bc, u: number[] = [];
    for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) u.push(at(R + r, C + c));
    boxes.push(u);
  }
  return { rows, colsU, boxes };
}

/** Samurai: five 9×9 grids on a 21×21 layout (corners + the centre one sharing the four corner boxes) */
export const SAMURAI_OFFSETS: [number, number][] = [[0, 0], [0, 12], [12, 0], [12, 12], [6, 6]];

export function geometry(id: BoardId): Geometry {
  const hit = cache.get(id);
  if (hit) return hit;
  const info = boardOf(id);
  let rows = info.n, cols = info.n;
  const units: number[][] = [];
  const boxSet = new Map<string, number[]>();
  let active: boolean[];
  let diag: Geometry["diag"];
  if (id === "samurai") {
    rows = cols = 21;
    active = new Array(rows * cols).fill(false);
    for (const [r0, c0] of SAMURAI_OFFSETS) {
      const g = boxGrid(9, 3, 3, r0, c0, cols);
      for (const u of [...g.rows, ...g.colsU]) units.push(u);
      for (const b of g.boxes) boxSet.set(String(b[0]), b);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) active[(r0 + r) * cols + c0 + c] = true;
    }
    for (const b of boxSet.values()) units.push(b);
  } else {
    active = new Array(rows * cols).fill(true);
    const g = boxGrid(info.n, info.box[0], info.box[1]);
    units.push(...g.rows, ...g.colsU, ...g.boxes);
    g.boxes.forEach((b) => boxSet.set(String(b[0]), b));
    if (id === "xsudoku") {
      const d1 = Array.from({ length: 9 }, (_, i) => i * 9 + i), d2 = Array.from({ length: 9 }, (_, i) => i * 9 + 8 - i);
      units.push(d1, d2);
      diag = [d1, d2];
    }
  }
  const boxOf = new Array(rows * cols).fill(-1);
  [...boxSet.values()].forEach((b, i) => b.forEach((c) => { boxOf[c] = i; }));
  const peerSets: Set<number>[] = Array.from({ length: rows * cols }, () => new Set<number>());
  for (const u of units) for (const a of u) for (const b of u) if (a !== b) peerSets[a].add(b);
  const geo: Geometry = { rows, cols, n: info.n, active, units, boxOf, peers: peerSets.map((s) => [...s]), diag };
  cache.set(id, geo);
  return geo;
}

// ------------------------------------------------------------------ scoring

export interface ScoreParts { base: number; time: number; clean: number; hints: number; total: number }

/** a solve's score: the level's base, a time bonus that runs down to 0 at 2× par, +25 % for no mistakes, −8 % per hint */
export function scoreOf(board: BoardId, level: Level, seconds: number, mistakes: number, hints: number, mult = 1): ScoreParts {
  const b = boardOf(board);
  const base = Math.round((b.base[level] ?? 500) * mult);
  const par = b.par[level] ?? 600;
  const time = Math.round(base * 0.6 * Math.max(0, Math.min(1, (2 * par - seconds) / (2 * par))));
  const clean = mistakes === 0 ? Math.round(base * 0.25) : 0;
  const sub = base + time + clean;
  const hintCut = Math.round(sub * Math.min(0.6, hints * 0.08));
  return { base, time, clean, hints: -hintCut, total: Math.max(Math.round(base * 0.2), sub - hintCut) };
}
