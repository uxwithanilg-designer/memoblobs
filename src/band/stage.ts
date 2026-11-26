// Band Bend stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 worlds × 50 stages (sky studio, mint lab, peach park, ocean deck, lilac loft, sunny court, coral cove, jade
//     garden, night gallery, candy shop, frost hall, ember forge), each with its own colours and music.
//   • Hard from stage 3: pegboards grow from 3 × 3 to 5 × 6, bands from 1 to 5, bends per band from 1 to 4. From stage
//     20 some bands start with decoy bends in the wrong places that must be moved or let go first. Nails sit so that the
//     bands cross, and no two bands share a line, so you have to work out which band draws which part.
//   • Every target is drawn by real bands (solvable by construction). The move limit is the drags that build and fix
//     the bands, plus one or two.
//   • After 600 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { bandEdges, hookAt, matches, moveHook, pointsOf, shapeOf, validBand, xy, type Band, type Board } from "./engine";

/** do segments p–q and r–s cross properly (not just touch at a pin)? */
function crosses(g: { cols: number }, p: number, q: number, r: number, s: number) {
  if (p === r || p === s || q === r || q === s) return false;
  const [ax, ay] = xy(g, p), [bx, by] = xy(g, q), [cx, cy] = xy(g, r), [dx, dy] = xy(g, s);
  const o = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => Math.sign((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1));
  return o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0;
}

export interface World { id: string; name: string; bg: [string, string]; board: string; pin: string; music: string }
export const WORLDS: World[] = [
  { id: "sky", name: "Sky Studio", bg: ["#5ec8ff", "#2a7ae8"], board: "#f4f6fa", pin: "#8a94a8", music: "sky" },
  { id: "mint", name: "Mint Lab", bg: ["#6ee8c0", "#1fae8a"], board: "#f2f8f4", pin: "#86a49a", music: "mint" },
  { id: "peach", name: "Peach Park", bg: ["#ffc09a", "#f0784a"], board: "#fbf4ee", pin: "#a8948a", music: "peach" },
  { id: "ocean", name: "Ocean Deck", bg: ["#4ad0e8", "#1a6ab0"], board: "#f0f6fa", pin: "#7a96a8", music: "ocean" },
  { id: "lilac", name: "Lilac Loft", bg: ["#c8a8ff", "#7a4ae0"], board: "#f6f2fc", pin: "#9a8ab8", music: "lilac" },
  { id: "sunny", name: "Sunny Court", bg: ["#ffe06a", "#f0a82a"], board: "#fcf8ec", pin: "#a8a08a", music: "sunny" },
  { id: "coral", name: "Coral Cove", bg: ["#ff9aa8", "#e04a6a"], board: "#fcf2f4", pin: "#a8909a", music: "coral" },
  { id: "jade", name: "Jade Garden", bg: ["#9ae07a", "#3a9a4a"], board: "#f4f8f0", pin: "#8aa48a", music: "jade" },
  { id: "night", name: "Night Gallery", bg: ["#3a3a7a", "#16163a"], board: "#e8e8f4", pin: "#7a7aa0", music: "night" },
  { id: "candy", name: "Candy Shop", bg: ["#ffb0e0", "#e05ab0"], board: "#fcf2f8", pin: "#a890a0", music: "candy" },
  { id: "frost", name: "Frost Hall", bg: ["#bfe8ff", "#6ab0e8"], board: "#f4f8fc", pin: "#8aa0b8", music: "frost" },
  { id: "ember", name: "Ember Forge", bg: ["#ff9a5a", "#b03a1a"], board: "#fbf2ec", pin: "#a8907a", music: "ember" },
];
export const BAND_COLS = ["#2a6ae8", "#e8323a", "#1fb86a", "#f8a818", "#9a4ae0", "#ff5ab0", "#1ac8c8"];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

/** start = the bands as you get them; board.goal = each band's own target hooks (for the hint) */
export interface StageDef { stage: number; board: Board; start: Band[]; seed: string; boss: boolean; showcase: boolean; par: number; moves: number; path: Move[] }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const big = boss || showcase ? 1 : 0;
  const cols = tutorial ? 3 : Math.min(5, 3 + Math.floor(nd / 60) + big);
  const rows = tutorial ? 3 : Math.min(6, 4 + Math.floor(nd / 90) + big);
  const bands = tutorial ? 1 : Math.min(5, 2 + Math.floor(nd / 70) + big);
  const hooks = tutorial ? [1, 2][n - 1] : Math.min(4, 2 + Math.floor(nd / 120));
  const decoys = tutorial || nd < 20 ? 0 : Math.min(4, 1 + Math.floor(nd / 120));
  // line crossings in the target: none early (clean drawings), a couple later (harder to read who draws what)
  const cross = tutorial || nd < 30 ? 0 : nd < 150 ? 1 : 2;
  return { n, nd, pass, boss, showcase, tutorial, cols, rows, bands, hooks, decoys, cross };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `band:${stage}`;
  const rng = rngFrom(seed);
  const pins = p.cols * p.rows;
  for (let attempt = 0; attempt < 400; attempt++) {
    const g = { cols: p.cols, rows: p.rows };
    const nails = new Set<number>(), used = new Set<string>(), bands: Band[] = [];
    const segs: (readonly [number, number])[] = [];
    let crossed = 0;
    let ok = true;
    for (let i = 0; i < p.bands && ok; i++) {
      let made: Band | null = null;
      for (let t = 0; t < 120 && !made; t++) {
        // a short walk over the pegboard: nail, bends, nail — each step at most two pins across, so the shape reads
        const a = rng.int(pins);
        if (nails.has(a)) continue;
        const k = Math.max(1, p.hooks - (rng.next() < 0.3 ? 1 : 0));
        const walk = [a];
        for (let h = 0; h <= k; h++) {
          const [x, y] = xy(g, walk[walk.length - 1]);
          for (let tries = 0; tries < 12; tries++) {
            const nx = x + rng.int(5) - 2, ny = y + rng.int(5) - 2;
            if (nx < 0 || ny < 0 || nx >= p.cols || ny >= p.rows || (nx === x && ny === y)) continue;
            walk.push(ny * p.cols + nx); break;
          }
        }
        if (walk.length !== k + 2) continue;
        const b = walk[walk.length - 1];
        if (nails.has(b)) continue;
        const band: Band = { a, b, hooks: walk.slice(1, -1), color: i % 7 };
        if (!validBand(g, band)) continue;
        const es = bandEdges(g, band);
        if (es.some((e) => used.has(e))) continue;
        // the straight start line must not lie on the shape already, and the drawing stays neat: few line crossings
        const mine = pointsOf(band).slice(0, -1).map((q, j) => [q, pointsOf(band)[j + 1]] as const);
        let cross = 0;
        for (const [u, v] of mine) for (const [s, w] of segs) if (crosses(g, u, v, s, w)) cross++;
        for (let j = 0; j < mine.length; j++) for (let l = j + 2; l < mine.length; l++) if (crosses(g, mine[j][0], mine[j][1], mine[l][0], mine[l][1])) cross++;
        if (crossed + cross > p.cross) continue;
        crossed += cross;
        made = band;
        for (const e of es) used.add(e);
        segs.push(...mine);
      }
      if (!made) { ok = false; break; }
      nails.add(made.a); nails.add(made.b); bands.push(made);
    }
    if (!ok) continue;
    const target = [...shapeOf(g, bands)];
    const board: Board = { cols: p.cols, rows: p.rows, bands, target, goal: bands.map((b) => b.hooks.slice()) };
    // the start: every band straight, some with decoy bends in the wrong places
    const start: Band[] = bands.map((b) => ({ ...b, hooks: [] }));
    let decoyMoves = 0;
    for (let d = 0; d < p.decoys; d++) {
      const i = rng.int(start.length), band = start[i];
      for (let t = 0; t < 20; t++) {
        const q = rng.int(pins);
        if (band.hooks.length || bands[i].hooks.includes(q)) break;
        const cand = { ...band, hooks: [q] };
        if (!validBand(g, cand)) continue;
        start[i] = cand; decoyMoves++; break;
      }
    }
    if (matches(board, start)) continue;
    // the plan: the fewest drags that turn each start band into its target band (also the hint)
    const path: Move[] = [];
    let planned = true;
    for (let i = 0; i < bands.length && planned; i++) {
      const steps = planBand(g, start[i], bands[i].hooks);
      if (!steps) planned = false; else for (const s of steps) path.push({ ...s, band: i });
    }
    if (!planned || !decoyMoves && p.decoys) continue;
    const par = path.length;
    const slack = p.tutorial ? 3 : p.nd < 40 ? 2 : 1;
    return { stage, board, start, seed, boss: p.boss, showcase: p.showcase, par, moves: par + slack, path };
  }
  return { ...buildStage(Math.max(1, stage - 1)), stage };
}

/** one drag: add a hook on segment `seg` at `pin`, or move hook `i` to `pin` (pin -1 lets it go) */
export type Move = { band: number; kind: "add"; seg: number; pin: number } | { band: number; kind: "move"; i: number; pin: number };
type Step = { kind: "add"; seg: number; pin: number } | { kind: "move"; i: number; pin: number };

/** insert the missing goal hooks one by one in some order that keeps every bend real */
function insertAll(g: { cols: number }, band: Band, goal: number[]): Step[] | null {
  if (band.hooks.length === goal.length) return band.hooks.every((h, i) => h === goal[i]) ? [] : null;
  // which goal hooks are still missing (band.hooks is a subsequence of goal)
  for (let j = 0; j < goal.length; j++) {
    const q = goal[j];
    if (band.hooks.includes(q)) continue;
    const seg = goal.slice(0, j).filter((h) => band.hooks.includes(h)).length;
    const nb = hookAt(g, band, seg, q);
    if (!nb) continue;
    const rest = insertAll(g, nb, goal);
    if (rest) return [{ kind: "add", seg, pin: q }, ...rest];
  }
  return null;
}
export function planBand(g: { cols: number }, band: Band, goal: number[]): Step[] | null {
  const sub = band.hooks.every((h) => goal.includes(h)) && band.hooks.map((h) => goal.indexOf(h)).every((x, i, a) => !i || x > a[i - 1]);
  if (sub) { const r = insertAll(g, band, goal); if (r) return r; }
  // a decoy bend: move it onto a goal pin, else let it go
  let best: Step[] | null = null;
  for (let i = 0; i < band.hooks.length; i++) {
    for (const q of goal) {
      const nb = moveHook(g, band, i, q);
      if (!nb) continue;
      const r = planBand(g, nb, goal);
      if (r && (!best || r.length + 1 < best.length)) best = [{ kind: "move", i, pin: q }, ...r];
    }
    if (!best) {
      const nb = moveHook(g, band, i, -1)!;
      const r = planBand(g, nb, goal);
      if (r) best = [{ kind: "move", i, pin: -1 }, ...r];
    }
    if (best) return best;
  }
  return best;
}

/** the next drag of the stage's own plan when the bands are still on it, else null */
export function plannedMove(d: StageDef, bands: Band[]): Move | null {
  const key = (bs: Band[]) => bs.map((b) => b.hooks.join(",")).join("|");
  const want = key(bands);
  const bs = d.start.map((b) => ({ ...b, hooks: b.hooks.slice() }));
  for (let k = 0; k <= d.path.length; k++) {
    if (key(bs) === want) return d.path[k] ?? null;
    if (k < d.path.length) { const m = d.path[k]; bs[m.band] = applyMove(d.board, bs[m.band], m)!; }
  }
  return null;
}
export function applyMove(g: { cols: number }, band: Band, m: Move | Step): Band | null {
  return m.kind === "add" ? hookAt(g, band, m.seg, m.pin) : moveHook(g, band, m.i, m.pin);
}
