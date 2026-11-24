// The nine Crownfold puzzles: place crowns on a board split into coloured courts so every row, every column and
// every court holds exactly one crown (two in Twin Crowns), and no two crowns touch — not even corner to corner.
// Each kind adds a twist. Shared by the generator, the solvers and the UI.

export type KindId = "classic" | "twin" | "diagonal" | "knight" | "rubble" | "towers" | "wrap" | "compass" | "grand";
export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];
export const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface KindInfo {
  id: KindId;
  name: string;
  tag: "Classic" | "Twist";
  blurb: string;
  rule: string;
  size: Record<Level, number>;
  /** crowns per row / column / court */
  k: 1 | 2;
  base: Record<Level, number>;
  par: Record<Level, number>;
  c1: string;
  c2: string;
  music: string;
}

const B = (e: number, m: number, h: number) => ({ easy: e, medium: m, hard: h });
export const KINDS: KindInfo[] = [
  {
    id: "classic", name: "Classic Court", tag: "Classic", k: 1,
    blurb: "One crown in every row, column and court — and crowns never touch.", rule: "Place one crown in each row, each column and each coloured court. Crowns may not touch, not even diagonally.",
    size: B(6, 8, 10), base: B(200, 400, 750), par: B(45, 100, 220), c1: "#E0475B", c2: "#F5B83D", music: "court",
  },
  {
    id: "twin", name: "Twin Crowns", tag: "Twist", k: 2,
    blurb: "Two crowns in every row, column and court.", rule: "Place two crowns in each row, each column and each court. Crowns may not touch, not even diagonally.",
    size: B(8, 9, 10), base: B(320, 560, 900), par: B(90, 170, 300), c1: "#8B5CF6", c2: "#F472B6", music: "waltz",
  },
  {
    id: "diagonal", name: "Diagonal Watch", tag: "Twist", k: 1,
    blurb: "No two crowns may share any diagonal line.", rule: "One crown per row, column and court, crowns never touch — and no two crowns on the same diagonal line, however far apart.",
    size: B(6, 8, 9), base: B(220, 420, 760), par: B(45, 100, 210), c1: "#2563EB", c2: "#38BDF8", music: "bishop",
  },
  {
    id: "knight", name: "Knight's Rule", tag: "Twist", k: 1,
    blurb: "No two crowns a knight's jump apart.", rule: "One crown per row, column and court, crowns never touch — and no two crowns a chess knight's jump apart.",
    size: B(7, 8, 9), base: B(240, 440, 780), par: B(55, 110, 220), c1: "#059669", c2: "#A3E635", music: "gallop",
  },
  {
    id: "rubble", name: "Rubble", tag: "Twist", k: 1,
    blurb: "Fallen stones block some squares.", rule: "One crown per row, column and court, crowns never touch, and no crown can stand on a stone.",
    size: B(7, 8, 10), base: B(220, 420, 760), par: B(50, 100, 210), c1: "#A16207", c2: "#FACC15", music: "ruins",
  },
  {
    id: "towers", name: "Watchtowers", tag: "Twist", k: 1,
    blurb: "Each tower counts the crowns in the 8 squares around it.", rule: "One crown per row, column and court, crowns never touch. A tower's number is how many crowns stand in the 8 squares around it.",
    size: B(7, 8, 9), base: B(240, 440, 780), par: B(55, 110, 220), c1: "#0D9488", c2: "#5EEAD4", music: "watch",
  },
  {
    id: "wrap", name: "Wrap Around", tag: "Twist", k: 1,
    blurb: "The board loops — crowns can touch across the edges.", rule: "One crown per row, column and court. Crowns never touch, and the edges wrap: the last row touches the first, the last column touches the first.",
    size: B(6, 8, 9), base: B(220, 420, 760), par: B(50, 100, 210), c1: "#DB2777", c2: "#A78BFA", music: "orbit",
  },
  {
    id: "compass", name: "Compass", tag: "Twist", k: 1,
    blurb: "Arrows point toward at least one crown.", rule: "One crown per row, column and court, crowns never touch. Each arrow points at least one crown somewhere straight ahead of it.",
    size: B(7, 8, 9), base: B(240, 440, 780), par: B(55, 110, 220), c1: "#EA580C", c2: "#FDE047", music: "voyage",
  },
  {
    id: "grand", name: "Grand Court", tag: "Classic", k: 1,
    blurb: "Big boards for a long royal session.", rule: "Classic rules on a 10×10 up to a 12×12 board: one crown per row, column and court, never touching.",
    size: B(10, 11, 12), base: B(600, 950, 1500), par: B(150, 280, 500), c1: "#B45309", c2: "#E0475B", music: "anthem",
  },
];
export const kindOf = (id: KindId) => KINDS.find((k) => k.id === id)!;

/** arrow directions: 0 up, 1 right, 2 down, 3 left */
export const DIRS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export interface Puzzle {
  kind: KindId;
  level: Level;
  seed: string;
  n: number;
  k: 1 | 2;
  /** court id per cell (0 … n-1) */
  regions: number[];
  /** Rubble: stone cells */
  rocks: number[];
  /** Watchtowers: cell → count */
  towers: Record<number, number>;
  /** Compass: cell → direction */
  arrows: Record<number, number>;
  /** crowns placed from the start (only when a board needs them) */
  givens: number[];
  /** the crown cells, sorted */
  solution: number[];
}

/** cells that may not hold a crown together with cell i (besides row / column / court counts) */
export function conflictTable(kind: KindId, n: number): number[][] {
  const out: number[][] = [];
  const wrap = kind === "wrap";
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, s = new Set<number>();
    const add = (rr: number, cc: number) => {
      if (wrap) { rr = (rr + n) % n; cc = (cc + n) % n; } else if (rr < 0 || cc < 0 || rr >= n || cc >= n) return;
      const j = rr * n + cc;
      if (j !== i) s.add(j);
    };
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc);
    if (kind === "knight") for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(r + dr, c + dc);
    if (kind === "diagonal") for (let d = 1; d < n; d++) for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(r + dr * d, c + dc * d);
    out.push([...s]);
  }
  return out;
}

/** cells in the 8 squares around a cell (Watchtowers) */
export function around(n: number, i: number): number[] {
  const r = Math.floor(i / n), c = i % n, o: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) o.push(rr * n + cc);
  }
  return o;
}

/** cells straight ahead of an arrow */
export function ray(n: number, i: number, d: number): number[] {
  const o: number[] = [];
  let r = Math.floor(i / n) + DIRS[d][0], c = (i % n) + DIRS[d][1];
  while (r >= 0 && c >= 0 && r < n && c < n) { o.push(r * n + c); r += DIRS[d][0]; c += DIRS[d][1]; }
  return o;
}

/** cells that can never hold a crown (stones, towers, arrows) */
export function closedCells(p: Pick<Puzzle, "rocks" | "towers" | "arrows">): Set<number> {
  return new Set([...p.rocks, ...Object.keys(p.towers).map(Number), ...Object.keys(p.arrows).map(Number)]);
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
