// Crownfold puzzle factory. From a seed:
//   1. a random crown layout that obeys the kind's rules (search() with shuffled columns, no courts yet),
//   2. courts grown outward from the crowns (Twin Crowns first joins its crowns in pairs), plus the kind's stones,
//      towers or arrows read from that layout,
//   3. a hill-climb that moves border squares between courts, keeping a move only when the number of answers doesn't
//      grow, until exactly one answer is left — and for Easy (tier 1) and Medium (tier 2) until a person can finish it
//      by reasoning alone. If the climb runs dry, a clue that rules out the other answer is added (a stone, a tower,
//      an arrow, or as a last resort a fixed crown).
// Budgets are solver steps, never clock time, so a seed always gives the same puzzle (the Daily Court).
import { around, kindOf, ray, type KindId, type Level, type Puzzle } from "./kinds";
import { logic, search, type Shape } from "./solver";
import { rngFrom, type Rng } from "../sudoku/rng";

export interface GenRequest { kind: KindId; level: Level; seed: string }

const nb4 = (n: number, i: number) => {
  const r = Math.floor(i / n), c = i % n, o: number[] = [];
  if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1);
  return o;
};

/** courts grown from the crowns; null if Twin Crowns couldn't pair them up */
function growCourts(n: number, k: number, crowns: number[], rng: Rng): number[] | null {
  const N = n * n, reg = new Array<number>(N).fill(-1);
  if (k === 1) crowns.forEach((c, g) => { reg[c] = g; });
  else {
    const left = rng.shuffle(crowns.slice());
    let g = 0;
    while (left.length) {
      const a = left.shift()!;
      // BFS to the nearest other crown through free squares
      const prev = new Map<number, number>([[a, -1]]);
      const q = [a];
      let hit = -1;
      while (q.length && hit < 0) {
        const x = q.shift()!;
        for (const y of rng.shuffle(nb4(n, x))) {
          if (prev.has(y) || reg[y] >= 0) continue;
          prev.set(y, x);
          if (left.includes(y)) { hit = y; break; }
          if (!crowns.includes(y)) q.push(y);
        }
      }
      if (hit < 0) return null;
      left.splice(left.indexOf(hit), 1);
      for (let x = hit; x >= 0; x = prev.get(x)!) reg[x] = g;
      g++;
    }
  }
  const front = new Set<number>();
  for (let i = 0; i < N; i++) if (reg[i] >= 0) for (const j of nb4(n, i)) if (reg[j] < 0) front.add(j);
  while (front.size) {
    const arr = [...front], x = arr[rng.int(arr.length)];
    front.delete(x);
    const owners = nb4(n, x).filter((j) => reg[j] >= 0);
    reg[x] = reg[rng.pick(owners)];
    for (const j of nb4(n, x)) if (reg[j] < 0) front.add(j);
  }
  return reg;
}

function connected(n: number, reg: number[], g: number, skip: number): boolean {
  const cells: number[] = [];
  for (let i = 0; i < reg.length; i++) if (reg[i] === g && i !== skip) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) { const x = q.pop()!; for (const y of nb4(n, x)) if (y !== skip && reg[y] === g && !seen.has(y)) { seen.add(y); q.push(y); } }
  return seen.size === cells.length;
}

export function generatePuzzle(req: GenRequest): Puzzle {
  const { kind, level, seed } = req;
  const info = kindOf(kind);
  const n = info.size[level], k = info.k, N = n * n;
  const tier = level === "easy" ? 1 : level === "medium" ? 2 : 0;
  const big = n >= 10;
  const cap = 6, sBudget = big ? 60000 : 25000;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = rngFrom(`crownfold:${kind}:${level}:${seed}:${attempt}`);
    const blank: Shape = { kind, n, k, regions: null, rocks: [], towers: {}, arrows: {}, givens: [] };
    const lay = search(blank, 1, big ? 200000 : 60000, rng);
    if (!lay.count) continue;
    const sol = lay.sols[0], isCrown = new Set(sol);
    const reg = growCourts(n, k, sol, rng);
    if (!reg) continue;
    const shape: Shape & { regions: number[] } = { kind, n, k, regions: reg, rocks: [], towers: {}, arrows: {}, givens: [] };
    const free = () => Array.from({ length: N }, (_, i) => i).filter((i) => !isCrown.has(i) && !shape.rocks.includes(i) && !(i in shape.towers) && !(i in shape.arrows));
    const addTower = (i: number) => { shape.towers[i] = around(n, i).filter((j) => isCrown.has(j)).length; };
    const addArrow = (i: number, rng2: Rng) => {
      const ds = rng2.shuffle([0, 1, 2, 3]).filter((d) => ray(n, i, d).some((j) => isCrown.has(j)));
      if (ds.length) shape.arrows[i] = ds[0];
    };
    // the kind's own clues
    if (kind === "rubble") shape.rocks = rng.shuffle(free()).slice(0, Math.round(N * (level === "hard" ? 0.1 : 0.14)));
    if (kind === "towers") for (const i of rng.shuffle(free()).slice(0, Math.max(3, Math.round(n * (level === "hard" ? 0.45 : 0.6))))) addTower(i);
    if (kind === "compass") for (const i of rng.shuffle(free()).slice(0, Math.max(3, Math.round(n * (level === "hard" ? 0.45 : 0.6))))) addArrow(i, rng);

    let steps = 0;
    const maxSteps = big ? 2_500_000 : 1_500_000;
    const count = () => { const r = search(shape, cap, sBudget); steps += r.steps; return { c: r.aborted ? cap + 1 : r.count, alt: r.sols.find((x) => x.join() !== sol.join()) }; };
    const openLeft = () => (tier ? logic(shape, tier as 1 | 2).open : 0);
    // many answers: fewer is better, then fewer squares the reasoning leaves open (a smooth slope to climb)
    const score = () => {
      const r = count();
      if (r.c !== 1) return { v: 10000 + r.c * 1000 + logic(shape, 2).open, alt: r.alt };
      return { v: openLeft(), alt: undefined };
    };

    let cur = score();
    const movable = () => Array.from({ length: N }, (_, i) => i).filter((i) => !isCrown.has(i));
    let tries = 0;
    const climbMax = big ? 1200 : 1500;
    while (cur.v > 0 && steps < maxSteps) {
      tries++;
      if (tries > climbMax) {
        // add a clue that rules out the other answer (or finishes the reasoning)
        const alt = cur.alt;
        let done = false;
        if (alt) {
          const altOnly = alt.filter((i) => !isCrown.has(i));
          if (kind === "rubble" && altOnly.length) { shape.rocks.push(rng.pick(altOnly)); done = true; }
          else if (kind === "towers") {
            const altSet = new Set(alt);
            const c = rng.shuffle(free()).find((i) => !altSet.has(i) && around(n, i).filter((j) => isCrown.has(j)).length !== around(n, i).filter((j) => altSet.has(j)).length);
            if (c !== undefined) { addTower(c); done = true; }
          } else if (kind === "compass") {
            const altSet = new Set(alt);
            for (const i of rng.shuffle(free())) {
              if (altSet.has(i)) continue;
              const d = [0, 1, 2, 3].find((d) => { const ry = ray(n, i, d); return ry.some((j) => isCrown.has(j)) && !ry.some((j) => altSet.has(j)); });
              if (d !== undefined) { shape.arrows[i] = d; done = true; break; }
            }
          }
          if (!done) { const miss = sol.filter((i) => !alt.includes(i) && !shape.givens.includes(i)); if (miss.length) { shape.givens.push(rng.pick(miss)); done = true; } }
        }
        if (!done) {
          // unique but reasoning stalls: fix one crown the reasoning hasn't reached yet
          const st = tier ? logic(shape, tier as 1 | 2).state : null;
          const miss = sol.filter((i) => !shape.givens.includes(i) && (!st || st[i] === 0));
          if (!miss.length) break;
          shape.givens.push(rng.pick(miss));
        }
        cur = score(); tries = climbMax - 120; continue;
      }
      // aim most moves at the other answer's crowns: moving one into another court usually breaks that answer
      const altOnly = cur.alt ? cur.alt.filter((i) => !isCrown.has(i)) : [];
      const mv = movable(), x = altOnly.length && rng.next() < 0.6 ? rng.pick(altOnly) : mv[rng.int(mv.length)];
      const others = nb4(n, x).map((j) => reg[j]).filter((g) => g !== reg[x]);
      if (!others.length) continue;
      const from = reg[x], to = rng.pick(others);
      if (!connected(n, reg, from, x)) continue;
      reg[x] = to;
      const nx = score();
      if (nx.v <= cur.v) cur = nx; else reg[x] = from;
    }
    if (cur.v > 0) continue;
    // Hard: make sure it's not a tier-1 walk in the park when a few more moves can avoid it
    if (tier === 0 && !big) {
      for (let t = 0; t < 120 && logic(shape, 1).solved; t++) {
        const mv = movable(), x = mv[rng.int(mv.length)];
        const others = nb4(n, x).map((j) => reg[j]).filter((g) => g !== reg[x]);
        if (!others.length) continue;
        const from = reg[x];
        if (!connected(n, reg, from, x)) continue;
        reg[x] = rng.pick(others);
        if (count().c !== 1) reg[x] = from;
      }
    }
    // courts numbered in reading order so colours spread nicely
    const map = new Map<number, number>();
    const regions = reg.map((g) => { if (!map.has(g)) map.set(g, map.size); return map.get(g)!; });
    return { kind, level, seed, n, k, regions, rocks: shape.rocks.sort((a, b) => a - b), towers: shape.towers, arrows: shape.arrows, givens: shape.givens.sort((a, b) => a - b), solution: sol };
  }
  throw new Error("crown generator gave up");
}

export function verifyPuzzle(p: Puzzle): boolean {
  const r = search({ ...p }, 2, 5_000_000);
  return r.count === 1 && !r.aborted && r.sols[0].join() === p.solution.join();
}
