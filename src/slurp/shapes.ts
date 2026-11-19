// Slurp Lab: the 21 Slurper shapes (polyominoes of 1–5 cells) and their rotations.
export interface Shape { name: string; cells: [number, number][]; size: number }

const raw: Record<string, string[]> = {
  // 1–3
  dot: ["#"],
  bar2: ["##"],
  bar3: ["###"],
  corner: ["#.", "##"],
  // 4
  bar4: ["####"],
  square: ["##", "##"],
  ell: ["#.", "#.", "##"],
  tee: ["###", ".#."],
  zig: ["##.", ".##"],
  // 5
  bar5: ["#####"],
  cross: [".#.", "###", ".#."],
  ell5: ["#.", "#.", "#.", "##"],
  tee5: ["###", ".#.", ".#."],
  u: ["#.#", "###"],
  vee: ["#..", "#..", "###"],
  zig5: ["##.", ".#.", ".##"],
  stair: ["#..", "##.", ".##"],
  pea: ["##", "##", "#."],
  ess5: [".##", "##.", ".#."],
  hook: ["##..", ".###"],
  yeh: [".#..", "####"],
};

const norm = (cells: [number, number][]): [number, number][] => {
  const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my] as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};
const key = (cells: [number, number][]) => cells.map((c) => c.join(",")).join(";");

export const SHAPES: Record<string, Shape> = {};
for (const [name, rows] of Object.entries(raw)) {
  const cells: [number, number][] = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") cells.push([x, y]); }));
  SHAPES[name] = { name, cells: norm(cells), size: cells.length };
}

/** every distinct rotation (and mirror, when `mirror`) of a shape */
export function rotations(name: string, mirror = false): [number, number][][] {
  const out: [number, number][][] = [], seen = new Set<string>();
  let c = SHAPES[name].cells;
  for (const m of mirror ? [false, true] : [false]) {
    let cur = m ? c.map(([x, y]) => [-x, y] as [number, number]) : c;
    for (let r = 0; r < 4; r++) {
      const n = norm(cur), k = key(n);
      if (!seen.has(k)) { seen.add(k); out.push(n); }
      cur = cur.map(([x, y]) => [-y, x] as [number, number]);
    }
  }
  void c; c = [];
  return out;
}

/** shape pools by stage (small shapes early, big ones from Lab 4) */
export const POOL_SMALL = ["dot", "bar2", "bar3", "corner"];
export const POOL_MID = ["dot", "bar2", "bar3", "corner", "bar4", "square", "ell", "tee", "zig"];
export const POOL_BIG = ["bar3", "corner", "bar4", "square", "ell", "tee", "zig", "bar5", "cross", "ell5", "tee5", "u", "vee", "zig5", "stair", "pea", "ess5", "hook", "yeh"];
