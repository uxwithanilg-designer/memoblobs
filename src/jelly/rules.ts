// Momo Jelly Jam rules. One deterministic move function (drop a jelly somewhere it can reach) is shared by the game,
// the solver and the stage builder. A move runs in this order:
//   drop → floor effects under the jelly (turn / flip pads, teleports, ice & springs, bumpers, belts, traps, paint,
//   rinse, wash, bubbles, shrink / stretch / split / press / copy, keys, coins, stars, switches, snares, targets) →
//   worn tiles and touch counters → squish (same colour → rectangle; rainbow, mixing, blobs, glue) → blocks that fit an
//   open gate leave (frame gates, floor drains, boxes; locks, orders, queues, cycles) → things that move on their own
//   (gravity, drift, wind, magnets, Kranky's jelly, spinners, babies, stage events) → timers → win or lose.
import {
  CELL, CLEAR, CRATE, DX, DY, GOLD, mixOf, RAINBOW, STONE, takes, TILE,
  type Cond, type Dir, type Gate, type JamEvent, type Level, type Move, type Piece, type PieceFlags, type State,
} from "./types";

// ---------------------------------------------------------------- shapes
export const cellCount = (p: Piece) => p.c.length >> 1;
export function bounds(c: number[]) {
  let w = 0, h = 0;
  for (let i = 0; i < c.length; i += 2) { if (c[i] + 1 > w) w = c[i] + 1; if (c[i + 1] + 1 > h) h = c[i + 1] + 1; }
  return { w, h };
}
/** normalise absolute cells → { c, x, y } with min dx = min dy = 0 (cells sorted for stable keys) */
export function normalise(abs: number[]) {
  let mx = Infinity, my = Infinity;
  for (let i = 0; i < abs.length; i += 2) { if (abs[i] < mx) mx = abs[i]; if (abs[i + 1] < my) my = abs[i + 1]; }
  const pts: [number, number][] = [];
  for (let i = 0; i < abs.length; i += 2) pts.push([abs[i] - mx, abs[i + 1] - my]);
  pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { c: pts.flat(), x: mx, y: my };
}
export const isRect = (c: number[]) => { const b = bounds(c); return b.w * b.h === c.length >> 1; };
export const shapeKey = (c: number[]) => c.join(",");
export const rotCW = (c: number[]) => { const a: number[] = []; for (let i = 0; i < c.length; i += 2) a.push(c[i + 1], -c[i]); return normalise(a).c; };
export const mirrorX = (c: number[]) => { const a: number[] = []; for (let i = 0; i < c.length; i += 2) a.push(-c[i], c[i + 1]); return normalise(a).c; };

// ---------------------------------------------------------------- level facts (cached per level)
interface Info {
  pads: Map<number, number>;
  tele: Map<number, number>;
  targets: number;
  plates: boolean;
  /** anything beyond plain floor, pads, belts and arrows? */
  tiles: boolean;
  /** does time matter for the future (state key needs the move count)? */
  timed: boolean;
  dyn: boolean;
  hitPieces: boolean;
  /** squish needs glue / some tiles forbid it */
  glueCheck: boolean;
}
const infos = new WeakMap<Level, Info>();
/** a level was changed in place: drop its cached facts */
export const forget = (L: Level) => { infos.delete(L); };
export function info(L: Level): Info {
  let f = infos.get(L);
  if (f) return f;
  const tele = new Map<number, number>();
  if (L.tval) {
    const byGroup = new Map<number, number[]>();
    L.tiles.forEach((t, i) => { if (t === TILE.tele) { const g = L.tval![i]; byGroup.set(g, [...(byGroup.get(g) ?? []), i]); } });
    for (const cells of byGroup.values()) if (cells.length === 2) { tele.set(cells[0], cells[1]); tele.set(cells[1], cells[0]); }
  }
  const R = L.rules ?? {};
  const tiles = L.tiles.some((t) => t > TILE.arrow);
  const pieceTimed = L.pieces.some((p) => p.f && (p.f.timer !== undefined || p.f.lazy || p.f.frozen !== undefined));
  f = {
    pads: new Map(L.pads.map((p, i) => [p.cell, i])),
    tele,
    targets: L.tiles.filter((t) => t === TILE.target).length,
    plates: L.tiles.some((t) => t === TILE.plate),
    tiles,
    timed: !!(R.limit || R.combo || R.loop || R.events?.length || R.setTime || R.slowSet || pieceTimed || L.gates.some((g) => g.blink || g.cycle || g.slide)
      || L.doors?.some((d) => condTimed(d.solid)) || L.tiles.some((t) => t === TILE.snare)),
    dyn: !!(R.gravity !== undefined || R.drift !== undefined || R.kranky || R.events?.length || L.tiles.some((t) => t === TILE.wind || t === TILE.magnet)
      || L.pieces.some((p) => p.f && (p.f.magnet || p.f.spinner || p.f.baby || p.f.shy || p.f.kranky))),
    hitPieces: L.pieces.some((p) => p.f?.lock?.t === "hit"),
    glueCheck: !!R.glue || L.tiles.some((t) => t === TILE.nosquish),
  };
  infos.set(L, f);
  return f;
}
function condTimed(c: Cond): boolean { return c.t === "mv" || c.t === "par" || (c.t === "not" && condTimed(c.a)); }

// ---------------------------------------------------------------- state
export function newState(L: Level): State {
  return {
    pieces: L.pieces.map((p) => ({ ...p, c: p.c.slice() })),
    pads: L.pads.map((p) => p.uses),
    gates: L.gates.map((g) => g.count),
    moves: 0, out: 0,
    nextId: L.pieces.reduce((m, p) => Math.max(m, p.id), 0) + 1,
    sw: 0, keys: 0, outC: new Array(16).fill(0), sq: 0, got: [], cov: [], wear: [], hits: new Array(32).fill(0),
    coins: 0, stars: 0, dragged: [], turns: 0, lastOut: 0, falls: 0, dir: -1,
  };
}
export function cloneState(s: State): State {
  return {
    ...s, pieces: s.pieces.slice(), pads: s.pads.slice(), gates: s.gates.slice(), outC: s.outC.slice(), got: s.got.slice(), cov: s.cov.slice(),
    wear: s.wear.slice(), hits: s.hits.slice(), dragged: s.dragged.slice(), ...(s.gat ? { gat: s.gat.slice() } : {}),
  };
}
/** does this jelly count for clearing the tray? */
export const counts = (L: Level, p: Piece) => p.color !== CRATE && !p.f?.keeper && !p.f?.kranky && (!L.rules?.some || !!p.f?.must);
/** every jelly that has to leave is out (and nothing went wrong) */
export function isClear(L: Level, s: State) { return !s.lost && !s.pieces.some((p) => counts(L, p)); }
/** kept for older callers: the tray is empty */
export const won = (s: State) => s.pieces.length === 0;

// ---------------------------------------------------------------- conditions
export function cond(L: Level, s: State, c: Cond): boolean {
  switch (c.t) {
    case "sw": return ((s.sw >> c.g) & 1) === 1;
    case "plate": {
      if (!L.tval) return false;
      for (const p of s.pieces) for (let i = 0; i < p.c.length; i += 2) { const ci = (p.y + p.c[i + 1]) * L.W + p.x + p.c[i]; if (L.tiles[ci] === TILE.plate && L.tval[ci] === c.g) return true; }
      return false;
    }
    case "key": return c.c < 0 ? s.keys !== 0 : ((s.keys >> c.c) & 1) === 1 || ((s.keys >> 15) & 1) === 1;
    case "out": return c.c === undefined ? s.out >= c.n : s.outC[c.c] >= c.n;
    case "mv": return s.moves >= c.n;
    case "sq": return s.sq >= c.n;
    case "par": return s.moves % c.m === c.r;
    case "cov": return s.cov.length >= info(L).targets;
    case "hit": return (s.hits[c.i] ?? 0) >= c.n;
    case "coins": return s.coins >= c.n;
    case "rest": return !s.pieces.some((p) => counts(L, p) && p.color !== c.c);
    case "not": return !cond(L, s, c.a);
  }
}
export const doorSolid = (L: Level, s: State, i: number) => cond(L, s, L.doors![i].solid);

// ---------------------------------------------------------------- the grid
/** occupancy: −1 wall, −2 pit, −3 bridge (cross, don't stop), 0 empty, k + 1 = s.pieces[k] */
export function occupancy(L: Level, s: State, out?: Int16Array) {
  const o = out && out.length === L.W * L.H ? out : new Int16Array(L.W * L.H);
  for (let i = 0; i < o.length; i++) { const w = L.walls[i]; o[i] = w === CELL.wall ? -1 : w === CELL.pit ? -2 : w === CELL.bridge ? -3 : 0; }
  for (let i = 0; i < s.wear.length; i += 2) if (s.wear[i + 1] >= wearMax(L, s.wear[i])) o[s.wear[i]] = L.tiles[s.wear[i]] === TILE.counter ? -1 : -2;
  if (L.doors) L.doors.forEach((d, di) => { if (doorSolid(L, s, di)) for (const ci of d.cells) o[ci] = d.look === "bridge" ? -2 : -1; });
  s.pieces.forEach((p, k) => { for (let i = 0; i < p.c.length; i += 2) o[(p.y + p.c[i + 1]) * L.W + p.x + p.c[i]] = k + 1; });
  return o;
}
function wearMax(L: Level, ci: number) { const t = L.tiles[ci]; return t === TILE.crumble ? 1 : t === TILE.glass ? 2 : Math.max(1, L.tval?.[ci] ?? 3); }

/** can cells c pass through origin (x, y)? (self = the piece's own mark, ignored; ghosts pass walls, bubbles and ghosts pass pits) */
export function fits(L: Level, o: Int16Array, c: number[], x: number, y: number, self: number, f?: PieceFlags) {
  for (let i = 0; i < c.length; i += 2) {
    const cx = x + c[i], cy = y + c[i + 1];
    if (cx < 0 || cy < 0 || cx >= L.W || cy >= L.H) return false;
    const v = o[cy * L.W + cx];
    if (v === 0 || v === self || v === -3) continue;
    if (v === -1 && f?.ghost) continue;
    if (v === -2 && (f?.bubble || f?.ghost)) continue;
    return false;
  }
  return true;
}
/** may a jelly come to rest here? (not on a bridge, not inside a wall, no colour clash) */
export function restable(L: Level, s: State, o: Int16Array, p: Piece, x: number, y: number, self: number) {
  const R = L.rules;
  for (let i = 0; i < p.c.length; i += 2) {
    const ci = (y + p.c[i + 1]) * L.W + x + p.c[i], v = o[ci];
    if (v === -3 || v === -1) return false;
    if (v === -2 && !p.f?.bubble) return false;
  }
  if (L.rails && railInside(L, p.c, x, y)) return false;
  if (R && (R.clash || R.noTouch) && p.color !== CRATE) {
    for (let i = 0; i < p.c.length; i += 2) {
      const cx = x + p.c[i], cy = y + p.c[i + 1];
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
        const v = o[ny * L.W + nx];
        if (v <= 0 || v === self) continue;
        const q = s.pieces[v - 1];
        if (q.color === p.color || q.color === CRATE || q.color === RAINBOW || p.color === RAINBOW) continue;
        if (R.noTouch) return false;
        for (let k = 0; k < R.clash!.length; k += 2) if ((R.clash![k] === p.color && R.clash![k + 1] === q.color) || (R.clash![k + 1] === p.color && R.clash![k] === q.color)) return false;
      }
    }
  }
  return true;
}
function railInside(L: Level, c: number[], x: number, y: number) {
  const set = new Set<number>();
  for (let i = 0; i < c.length; i += 2) set.add((y + c[i + 1]) * L.W + x + c[i]);
  for (const ci of set) { const r = L.rails![ci]; if (!r) continue; const cx = ci % L.W; if ((r & 2) && cx + 1 < L.W && set.has(ci + 1)) return true; if ((r & 1) && set.has(ci + L.W)) return true; }
  return false;
}

/** can this jelly be dragged right now? */
export function movable(L: Level, s: State, p: Piece) {
  const f = p.f;
  if (!f) return true;
  if (f.kranky) return false;
  if (f.frozen !== undefined && s.moves < f.frozen) return false;
  if (f.lazy && s.moves % 2 === 1) return false;
  if (f.lock && !cond(L, s, f.lock)) return false;
  if (L.rules?.oneDrag && s.dragged.includes(p.id)) return false;
  return true;
}

/**
 * Every origin a jelly can be dragged to and rest at, packed y * W + x, BFS order (its own spot first). It slides
 * through free cells obeying one-way arrows, rails, colour / size filters and mud (a jelly entering mud stops there);
 * heavy jellies go one cell, rail jellies along one axis, arrow jellies one way; wrap stages let it leave one edge and
 * come back on the other.
 */
export function reach(L: Level, s: State, k: number, o?: Int16Array): number[] {
  const occ = o ?? occupancy(L, s);
  const p = s.pieces[k], W = L.W, H = L.H, f = p.f;
  const start = p.y * W + p.x;
  if (!movable(L, s, p)) return [start];
  const b = bounds(p.c), minSide = Math.min(b.w, b.h);
  const fancy = info(L).tiles;
  const seen = new Uint8Array(W * H);
  const out: number[] = [];
  const q = [start], depth = [0];
  seen[start] = 1;
  const wrap = L.rules?.wrap ?? 0;
  for (let qi = 0; qi < q.length; qi++) {
    const pos = q[qi], x = pos % W, y = (pos / W) | 0;
    if (qi === 0 || restable(L, s, occ, p, x, y, k + 1)) out.push(pos);
    if (f?.heavy && depth[qi] >= 1) continue;
    // a jelly that has entered mud stops there
    if (qi > 0 && fancy && onTile(L, p.c, x, y, TILE.mud)) continue;
    for (let d = 0; d < 4; d++) {
      if (f?.axis !== undefined && (d % 2 === 1) !== (f.axis === 0)) continue;
      if (f?.arrow !== undefined && d !== f.arrow) continue;
      let nx = x + DX[d], ny = y + DY[d];
      if (wrap) {
        if ((wrap & 1) && (nx < 0 || nx + b.w > W)) nx = nx < 0 ? W - b.w : 0;
        if ((wrap & 2) && (ny < 0 || ny + b.h > H)) ny = ny < 0 ? H - b.h : 0;
      }
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (seen[np]) continue;
      if (!fits(L, occ, p.c, nx, ny, k + 1, f)) continue;
      if (L.rails && railBlocks(L, p.c, x, y, d)) continue;
      let ok = true;
      for (let i = 0; i < p.c.length && ok; i += 2) {
        const ci = (ny + p.c[i + 1]) * W + nx + p.c[i];
        const t = L.tiles[ci];
        if (t === TILE.arrow && L.tdir[ci] !== d) ok = false;
        else if (t === TILE.filterC && L.tval && L.tval[ci] !== p.color) ok = false;
        else if (t === TILE.filterS && L.tval && minSide > L.tval[ci]) ok = false;
      }
      if (!ok) continue;
      seen[np] = 1;
      q.push(np); depth.push(depth[qi] + 1);
    }
  }
  return out;
}
function railBlocks(L: Level, c: number[], x: number, y: number, d: number) {
  const bit = 1 << d;
  for (let i = 0; i < c.length; i += 2) { const ci = (y + c[i + 1]) * L.W + x + c[i]; if ((L.rails![ci] ?? 0) & bit) return true; }
  return false;
}
function onTile(L: Level, c: number[], x: number, y: number, t: number) {
  for (let i = 0; i < c.length; i += 2) if (L.tiles[(y + c[i + 1]) * L.W + x + c[i]] === t) return true;
  return false;
}
function tileUnder(L: Level, p: Piece, t: number): number {
  for (let i = 0; i < p.c.length; i += 2) { const ci = (p.y + p.c[i + 1]) * L.W + p.x + p.c[i]; if (L.tiles[ci] === t) return ci; }
  return -1;
}
export function cellsOf(L: Level, p: Piece) { const a: number[] = []; for (let i = 0; i < p.c.length; i += 2) a.push((p.y + p.c[i + 1]) * L.W + p.x + p.c[i]); return a; }

// ---------------------------------------------------------------- squish
function absCells(p: Piece) { const a: number[] = []; for (let i = 0; i < p.c.length; i += 2) a.push(p.x + p.c[i], p.y + p.c[i + 1]); return a; }
function touching(a: Piece, b: Piece) {
  const set = new Set<number>();
  for (let i = 0; i < a.c.length; i += 2) set.add((a.x + a.c[i]) * 4096 + a.y + a.c[i + 1]);
  for (let i = 0; i < b.c.length; i += 2) {
    const x = b.x + b.c[i], y = b.y + b.c[i + 1];
    for (let d = 0; d < 4; d++) if (set.has((x + DX[d]) * 4096 + y + DY[d])) return true;
  }
  return false;
}
/** can this jelly squish at all? */
const squishy = (p: Piece) => p.color !== STONE && p.color !== CLEAR && p.color !== CRATE && p.color !== GOLD && !p.f?.bubble && !p.f?.sealed && !p.f?.kranky;
/** the colour a set of jellies squishes into, or −1 (same colour; rainbow joins anyone; with mixing two primaries) */
function unionColour(L: Level, cols: number[]): number {
  const real = [...new Set(cols.filter((c) => c !== RAINBOW))];
  if (!real.length) return RAINBOW;
  if (real.length === 1) return real[0];
  if (real.length === 2 && L.rules?.mix) { const m = mixOf(real[0], real[1]); if (m !== undefined) return m; }
  return -1;
}
const compatible = (L: Level, a: number, b: number) => a === b || a === RAINBOW || b === RAINBOW || (!!L.rules?.mix && mixOf(a, b) !== undefined);
/** could jellies of these two colours squish together? */
export const squishCompatible = (L: Level, a: number, b: number) => a < CRATE && b < CRATE && a !== STONE && b !== STONE && a !== CLEAR && b !== CLEAR && a !== GOLD && b !== GOLD && compatible(L, a, b);
const mergeFlags = (ps: Piece[], L: Level, s: State): PieceFlags | undefined => {
  const f: PieceFlags = {};
  for (const p of ps) {
    const g = p.f; if (!g) continue;
    if (g.king) f.king = true; if (g.keeper) f.keeper = true; if (g.must) f.must = true;
    if (g.dirty) f.dirty = true; if (g.battery) f.battery = true; if (g.num) f.num = g.num;
    if (g.once && L.rules?.once) f.sealed = true;
    if (g.timer !== undefined) f.timer = Math.min(f.timer ?? Infinity, g.timer);
    if (g.hungry) f.hungry = true;
  }
  if (L.rules?.slowSet) f.frozen = s.moves + 1;
  if (L.rules?.setTime) f.setBy = s.moves + L.rules.setTime;
  return Object.keys(f).length ? f : undefined;
};
/** squish the piece at index k with the largest set of touching compatible jellies whose union is a solid rectangle */
function squishAt(L: Level, s: State, k: number, ev: JamEvent[]): number {
  const R = L.rules, glueCheck = info(L).glueCheck;
  for (let guard = 0; guard < 6; guard++) {
    const P = s.pieces[k];
    if (!P || !squishy(P)) return k;
    // a hungry jelly eats the drops it touches
    if (P.f?.hungry) {
      const food = s.pieces.map((q, j) => j).filter((j) => j !== k && s.pieces[j].c.length === 2 && s.pieces[j].color !== CRATE && touching(P, s.pieces[j]));
      if (food.length) {
        const all = absCells(P); for (const j of food) all.push(...absCells(s.pieces[j]));
        const n = normalise(all);
        const ate: Piece = { ...P, c: n.c, x: n.x, y: n.y, parts: P.parts + food.length };
        const ids = food.map((j) => s.pieces[j].id);
        s.pieces = s.pieces.filter((_, j) => !food.includes(j));
        k = s.pieces.indexOf(P); s.pieces[k] = ate;
        for (const id of ids) ev.push({ t: "remove", id, why: "eat" });
        ev.push({ t: "shape", id: ate.id, piece: ate, why: "eat" });
        continue;
      }
    }
    // the touching compatible group (transitive), at most 6 others
    const comp: number[] = [];
    const inComp = new Set<number>([k]);
    const stack = [k];
    while (stack.length && comp.length < 6) {
      const a = s.pieces[stack.pop()!];
      s.pieces.forEach((b, j) => { if (!inComp.has(j) && squishy(b) && compatible(L, a.color, b.color) && comp.length < 6 && touching(a, b)) { inComp.add(j); comp.push(j); stack.push(j); } });
    }
    if (!comp.length) return k;
    let best = 0, bestCells = 0, bestCol = -1;
    for (let mask = 1; mask < 1 << comp.length; mask++) {
      const members = [P, ...comp.filter((_, j) => mask & (1 << j)).map((j) => s.pieces[j])];
      const col = unionColour(L, members.map((m) => m.color));
      if (col < 0) continue;
      const all: number[] = [];
      for (const m of members) all.push(...absCells(m));
      const n = normalise(all);
      if (!R?.blob && !isRect(n.c)) continue;
      if (R?.blob && !connectedCells(all)) continue;
      if (glueCheck) {
        let glue = false, no = false;
        for (let i = 0; i < all.length; i += 2) { const t = L.tiles[all[i + 1] * L.W + all[i]]; if (t === TILE.glue || t === TILE.press) glue = true; if (t === TILE.nosquish) no = true; }
        if (no || (R?.glue && !glue)) continue;
      }
      const cells = all.length >> 1;
      if (cells > bestCells) { best = mask; bestCells = cells; bestCol = col; }
    }
    if (!best) return k;
    const memberIdx = [k, ...comp.filter((_, j) => best & (1 << j))];
    const members = memberIdx.map((j) => s.pieces[j]);
    const all: number[] = [];
    let parts = 0, id = Infinity;
    for (const m of members) { all.push(...absCells(m)); parts += m.parts; id = Math.min(id, m.id); }
    const n = normalise(all);
    let merged: Piece = { id, color: bestCol, c: n.c, x: n.x, y: n.y, parts };
    const f = mergeFlags(members, L, s); if (f) merged.f = f;
    ev.push({ t: "merge", ids: members.map((m) => m.id), piece: merged });
    s.sq++;
    // the block takes the place of its first member; the others leave the list
    const keepAt = Math.min(...memberIdx);
    const next: Piece[] = [];
    s.pieces.forEach((p, j) => { if (j === keepAt) next.push(merged); else if (!memberIdx.includes(j)) next.push(p); });
    s.pieces = next;
    k = next.indexOf(merged);
    // F23: a fresh block turns a quarter
    if (R?.spin && isRect(merged.c) && merged.c.length > 2) {
      const b = bounds(merged.c);
      if (b.w !== b.h) {
        const rc = rotCW(merged.c), nb = bounds(rc);
        const nx = merged.x + Math.floor((b.w - nb.w) / 2), ny = merged.y + Math.floor((b.h - nb.h) / 2);
        const o = occupancy(L, s);
        if (fits(L, o, rc, nx, ny, k + 1)) { merged = { ...merged, c: rc, x: nx, y: ny }; s.pieces[k] = merged; ev.push({ t: "shape", id: merged.id, piece: merged, why: "spin" }); }
      }
    }
  }
  return k;
}
function connectedCells(abs: number[]) {
  const set = new Set<number>(); for (let i = 0; i < abs.length; i += 2) set.add(abs[i] * 4096 + abs[i + 1]);
  const first = abs[0] * 4096 + abs[1], seen = new Set([first]), q = [first];
  while (q.length) { const v = q.pop()!; const x = Math.floor(v / 4096), y = v % 4096; for (let d = 0; d < 4; d++) { const n = (x + DX[d]) * 4096 + y + DY[d]; if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
  return seen.size === set.size;
}

// ---------------------------------------------------------------- gates
/** where a frame gate sits right now (sliding gates move, Kranky shuffles) */
export const gateAt = (g: Gate, s: State, i: number) => s.gat?.[i] ?? (g.slide ? g.slide[(s.moves + (g.phase ?? 0)) % g.slide.length] : g.at);
/** how wide a gate is right now (narrowing gates lose a cell per use) */
export const gateW = (g: Gate, s: State, i: number) => g.narrow ? Math.max(1, g.w - ((g.count >= 99 ? 99 : g.count) - s.gates[i])) : g.w;
/** is gate i open right now (count, blink, locks, numbers, build-first)? */
export function gateOpen(L: Level, s: State, i: number) {
  const g = L.gates[i];
  if (s.gates[i] <= 0 || g.kind === "fake") return false;
  if (g.blink && (s.moves + (g.phase ?? 0)) % 2 !== 0) return false;
  if (g.need && !cond(L, s, g.need)) return false;
  if (g.order !== undefined) for (let j = 0; j < L.gates.length; j++) { const h = L.gates[j]; if (h.order !== undefined && h.order < g.order && s.gates[j] >= h.count) return false; }
  if (L.rules?.buildFirst && s.sq < L.rules.buildFirst) return false;
  return true;
}
/** would jelly p at (x, y) leave by some gate right now? → gate index or −1 (boxes are checked separately) */
export function gateAtPos(L: Level, s: State, p: Piece, x: number, y: number, dir = s.dir): number {
  const f = p.f;
  if (p.color === CRATE || p.color === CLEAR || f?.dirty || f?.battery || f?.kranky) return -1;
  const b = bounds(p.c), n = p.c.length >> 1, rect = b.w * b.h === n;
  const R = L.rules;
  if (R?.order && s.out < R.order.length && R.order[s.out] !== p.color) return -1;
  if (R?.ids && s.out < R.ids.length && R.ids[s.out] !== p.id) return -1;
  if (f?.king && s.pieces.some((q) => q !== p && counts(L, q))) return -1;
  if (f?.num !== undefined && p.parts !== f.num) return -1;
  for (let i = 0; i < L.gates.length; i++) {
    const g = L.gates[i];
    if (g.kind === "box") continue;
    if (!takes(g, p.color, s.moves) && !(f?.alt !== undefined && takes(g, f.alt, s.moves))) continue;
    if (g.queue) { const used = (g.count >= 99 ? 99 : g.count) - s.gates[i]; if (used < g.queue.length && g.queue[used] !== p.color) continue; }
    if (!gateOpen(L, s, i)) continue;
    if (g.parts !== undefined && p.parts !== g.parts) continue;
    if (g.dirIn !== undefined && dir !== g.dirIn) continue;
    if (!rect && g.area === undefined) continue;
    if (g.area !== undefined && n !== g.area) continue;
    const at = gateAt(g, s, i), w = gateW(g, s, i);
    if (g.side === 4) {
      const gx = at % L.W, gy = (at / L.W) | 0;
      if (x === gx && y === gy && b.w === w && b.h === (g.h ?? 1)) return i;
      continue;
    }
    const along = g.side === 0 || g.side === 2 ? b.w : b.h, depth = g.side === 0 || g.side === 2 ? b.h : b.w;
    if (along !== w) continue;
    if (g.h !== undefined && depth !== g.h) continue;
    switch (g.side) {
      case 0: if (y + b.h === L.H && x === at) return i; break;
      case 2: if (y === 0 && x === at) return i; break;
      case 1: if (x + b.w === L.W && y === at) return i; break;
      case 3: if (x === 0 && y === at) return i; break;
    }
  }
  return -1;
}
export const gateFor = (L: Level, s: State, p: Piece) => gateAtPos(L, s, p, p.x, p.y);

/** a box (Pack It / Picture / Copy Me / Sort): fully covered by jellies that sit wholly inside → their indices */
function boxFull(L: Level, s: State, gi: number): number[] | null {
  const g = L.gates[gi];
  if (!gateOpen(L, s, gi)) return null;
  const gx = g.at % L.W, gy = (g.at / L.W) | 0, h = g.h ?? 1;
  const inside = (cx: number, cy: number) => cx >= gx && cy >= gy && cx < gx + g.w && cy < gy + h;
  const who: number[] = [];
  let covered = 0;
  for (let k = 0; k < s.pieces.length; k++) {
    const p = s.pieces[k];
    let any = false, all = true;
    for (let i = 0; i < p.c.length; i += 2) { const cx = p.x + p.c[i], cy = p.y + p.c[i + 1]; if (inside(cx, cy)) any = true; else all = false; }
    if (!any) continue;
    if (!all || p.color === CRATE) return null;
    for (let i = 0; i < p.c.length; i += 2) {
      const cx = p.x + p.c[i], cy = p.y + p.c[i + 1];
      const want = g.cmap?.[(cy - gy) * g.w + cx - gx];
      if (want !== undefined && want >= 0 && want !== p.color && p.color !== RAINBOW) return null;
    }
    who.push(k); covered += p.c.length >> 1;
  }
  return covered === g.w * h && who.length ? who : null;
}

// ---------------------------------------------------------------- moving things
const dirOf = (dx: number, dy: number): number => (dx === 0 && dy === 0 ? -1 : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2);
/** slide piece k in direction d until something stops it; returns the steps taken */
function slideK(L: Level, s: State, k: number, d: number, ev: JamEvent[], why: Extract<JamEvent, { t: "slide" }>["why"], max = 99): number {
  if (d < 0) return 0;
  const o = occupancy(L, s);
  let steps = 0;
  for (; steps < max; steps++) {
    const p = s.pieces[k];
    const nx = p.x + DX[d], ny = p.y + DY[d];
    if (!fits(L, o, p.c, nx, ny, k + 1, p.f) || (L.rails && railBlocks(L, p.c, p.x, p.y, d))) break;
    if (!restable(L, s, o, p, nx, ny, k + 1) && !fits(L, o, p.c, nx + DX[d], ny + DY[d], k + 1, p.f)) break;
    for (let i = 0; i < p.c.length; i += 2) o[(p.y + p.c[i + 1]) * L.W + p.x + p.c[i]] = 0;
    s.pieces[k] = { ...p, x: nx, y: ny };
    for (let i = 0; i < p.c.length; i += 2) o[(ny + p.c[i + 1]) * L.W + nx + p.c[i]] = k + 1;
  }
  if (steps) { const p = s.pieces[k]; ev.push({ t: "slide", id: p.id, x: p.x, y: p.y, why }); }
  return steps;
}
/** put piece k at (x, y) if it fits there (teleports, rewinds, swaps) */
function placeK(L: Level, s: State, k: number, x: number, y: number, ev: JamEvent[], why: Extract<JamEvent, { t: "slide" }>["why"], c?: number[]) {
  const p = s.pieces[k], cc = c ?? p.c;
  const o = occupancy(L, s);
  if (!fits(L, o, cc, x, y, k + 1, p.f) || !restable(L, s, o, { ...p, c: cc }, x, y, k + 1)) return false;
  s.pieces[k] = { ...p, c: cc, x, y };
  ev.push({ t: "slide", id: p.id, x, y, why });
  return true;
}
const setF = (p: Piece, patch: Partial<PieceFlags>, drop: (keyof PieceFlags)[] = []): Piece => {
  const f: PieceFlags = { ...(p.f ?? {}), ...patch };
  for (const k of drop) delete f[k];
  return Object.keys(f).length ? { ...p, f } : { ...p, f: undefined };
};
function wear(s: State, ci: number) {
  for (let i = 0; i < s.wear.length; i += 2) if (s.wear[i] === ci) { s.wear[i + 1]++; return s.wear[i + 1]; }
  s.wear.push(ci, 1); return 1;
}
const wornOut = (L: Level, s: State, ci: number) => { for (let i = 0; i < s.wear.length; i += 2) if (s.wear[i] === ci) return s.wear[i + 1] >= wearMax(L, ci); return false; };

/** everything the floor does to the jelly at index k after it lands (may chain: a belt carries it onto ice…) */
function floorEffects(L: Level, s: State, k: number, from: { x: number; y: number }, ev: JamEvent[]) {
  const F = info(L), R = L.rules;
  const before = new Set(cellsOf(L, { ...s.pieces[k], x: from.x, y: from.y }));
  let teleported = false;
  for (let loop = 0; loop < 5; loop++) {
    let p = s.pieces[k];
    if (!p) return;
    const sx = p.x, sy = p.y;
    // turn / flip pad under the jelly
    {
      let pi = -1;
      for (let i = 0; i < p.c.length && pi < 0; i += 2) { const j = F.pads.get((p.y + p.c[i + 1]) * L.W + p.x + p.c[i]); if (j !== undefined && s.pads[j] > 0) pi = j; }
      if (pi >= 0 && !(R?.oneTurn && s.turns >= 1)) {
        const pad = L.pads[pi], px = pad.cell % L.W, py = (pad.cell / L.W) | 0;
        const abs: number[] = [];
        for (let i = 0; i < p.c.length; i += 2) {
          const rx = p.x + p.c[i] - px, ry = p.y + p.c[i + 1] - py;
          if (pad.flip) abs.push(px - rx, py + ry); else if (pad.ccw) abs.push(px - ry, py + rx); else abs.push(px + ry, py - rx);
        }
        const n = normalise(abs);
        const o = occupancy(L, s);
        if (n.c.join() !== p.c.join() || n.x !== p.x || n.y !== p.y) {
          if (fits(L, o, n.c, n.x, n.y, k + 1, p.f)) {
            s.pieces[k] = p = { ...p, c: n.c, x: n.x, y: n.y };
            s.pads[pi]--; s.turns++;
            ev.push({ t: "turn", id: p.id, pad: pi, ccw: pad.ccw, piece: p, ...(pad.flip ? { flip: true } : {}) });
          }
        }
      }
    }
    if (!F.tiles && !R?.slide && !p.f?.bouncy && !L.tiles.some((t) => t === TILE.belt)) break;
    // teleport (once per move)
    if (!teleported && F.tele.size) {
      for (let i = 0; i < p.c.length; i += 2) {
        const ci = (p.y + p.c[i + 1]) * L.W + p.x + p.c[i], to = F.tele.get(ci);
        if (to === undefined) continue;
        const dx = (to % L.W) - (ci % L.W), dy = ((to / L.W) | 0) - ((ci / L.W) | 0);
        teleported = true;
        if (placeK(L, s, k, p.x + dx, p.y + dy, ev, "tele")) p = s.pieces[k];
        break;
      }
    }
    // ice, springs, bouncy jellies, slippery trays: keep going
    if (s.dir >= 0 && (R?.slide || p.f?.bouncy || tileUnder(L, p, TILE.ice) >= 0 || tileUnder(L, p, TILE.spring) >= 0)) {
      slideK(L, s, k, s.dir, ev, tileUnder(L, p, TILE.spring) >= 0 ? "spring" : "ice"); p = s.pieces[k];
    }
    // bumper: one cell back
    if (s.dir >= 0 && tileUnder(L, p, TILE.bumper) >= 0) { slideK(L, s, k, (s.dir + 2) % 4, ev, "bumper", 1); p = s.pieces[k]; }
    // a jelly dropped on a belt rides it off the end (or until something blocks it)
    {
      let rode = false;
      for (let step = 0; step < L.W + L.H; step++) {
        const q = s.pieces[k];
        let d = -1;
        for (let i = 0; i < q.c.length && d < 0; i += 2) { const ci = (q.y + q.c[i + 1]) * L.W + q.x + q.c[i]; if (L.tiles[ci] === TILE.belt) d = L.tdir[ci]; }
        if (d < 0) break;
        const o = occupancy(L, s);
        const nx = q.x + DX[d], ny = q.y + DY[d];
        if (!fits(L, o, q.c, nx, ny, k + 1, q.f) || !restable(L, s, o, q, nx, ny, k + 1)) break;
        s.pieces[k] = { ...q, x: nx, y: ny }; rode = true;
        ev.push({ t: "belt", id: q.id, x: nx, y: ny });
      }
      if (rode) p = s.pieces[k];
    }
    if (F.tiles) {
      const home = L.pieces.find((q) => q.id === p.id && q.c.join() === p.c.join());
      // traps and rewinds send it home; bouncers send it back where it came from
      if (tileUnder(L, p, TILE.trap) >= 0) {
        s.falls++;
        if (home && placeK(L, s, k, home.x, home.y, ev, "rewind")) p = s.pieces[k];
        if (R?.lives && s.falls >= R.lives) { s.lost = "falls"; ev.push({ t: "lost", why: "falls" }); }
      } else if (tileUnder(L, p, TILE.rewind) >= 0 && home && (home.x !== p.x || home.y !== p.y)) {
        if (placeK(L, s, k, home.x, home.y, ev, "rewind")) p = s.pieces[k];
      } else if (tileUnder(L, p, TILE.bouncer) >= 0 && (from.x !== p.x || from.y !== p.y)) {
        if (placeK(L, s, k, from.x, from.y, ev, "bounce")) p = s.pieces[k];
      }
      // things that change the jelly
      const val = (t: number) => { const ci = tileUnder(L, p, t); return ci < 0 ? null : { ci, v: L.tval?.[ci] ?? 0 }; };
      const shape = (np: Piece, why: Extract<JamEvent, { t: "shape" }>["why"]) => { s.pieces[k] = p = np; ev.push({ t: "shape", id: np.id, piece: np, why }); };
      let t = val(TILE.paint);
      if (t && !wornOut(L, s, t.ci)) {
        const colour = t.v & 15, uses = t.v >> 4;
        if (p.color !== colour && p.color !== STONE && p.color !== CRATE) { shape({ ...p, color: colour }, "paint"); if (uses) wear(s, t.ci); }
      }
      if (val(TILE.rinse) && p.color !== CLEAR && p.color !== STONE && p.color !== CRATE) shape({ ...p, color: CLEAR }, "rinse");
      if (val(TILE.wash) && p.f?.dirty) shape(setF(p, {}, ["dirty"]), "wash");
      if (val(TILE.splash) && !p.f?.dirty && p.color !== CRATE) shape(setF(p, { dirty: true }), "dirty");
      if (val(TILE.charger) && p.f?.battery) shape(setF(p, {}, ["battery"]), "charge");
      if (val(TILE.bubble) && !p.f?.bubble) shape(setF(p, { bubble: true }), "bubble");
      if (val(TILE.thorns) && p.f?.bubble) shape(setF(p, {}, ["bubble"]), "pop");
      t = val(TILE.snare);
      if (t) s.pieces[k] = p = setF(p, { frozen: s.moves + Math.max(1, t.v || 2) });
      if (val(TILE.shrink) && p.c.length > 2) {
        const b = bounds(p.c), cut = b.h >= 2 ? p.c.filter((_, i, a) => i % 2 === 0 ? a[i + 1] !== b.h - 1 : a[i] !== b.h - 1) : p.c.filter((_, i, a) => i % 2 === 0 ? a[i] !== b.w - 1 : a[i - 1] !== b.w - 1);
        const n = normalise(cut.map((v, i) => v + (i % 2 ? p.y : p.x)));
        shape({ ...p, c: n.c, x: n.x, y: n.y }, "shrink");
      }
      if (val(TILE.stretch)) {
        const b = bounds(p.c), grow: number[] = [];
        for (let i = 0; i < p.c.length; i += 2) if (p.c[i + 1] === b.h - 1) grow.push(p.c[i], b.h);
        const nc = normalise([...p.c, ...grow]).c, o = occupancy(L, s);
        if (fits(L, o, nc, p.x, p.y, k + 1, p.f)) shape({ ...p, c: nc }, "stretch");
      }
      if (val(TILE.press) && !isRect(p.c)) {
        const n = p.c.length >> 1; let bw = 0;
        for (let w = Math.floor(Math.sqrt(n)); w >= 1; w--) if (n % w === 0) { bw = n / w; break; }
        if (bw) { const bh = n / bw, nc: number[] = []; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) nc.push(x, y); const o = occupancy(L, s); if (fits(L, o, nc, p.x, p.y, k + 1, p.f)) shape({ ...p, c: nc }, "press"); }
      }
      if (val(TILE.split) && isRect(p.c) && p.c.length >= 4) {
        const b = bounds(p.c), alongX = b.w >= b.h, half = Math.floor((alongX ? b.w : b.h) / 2);
        const a: number[] = [], c2: number[] = [];
        for (let i = 0; i < p.c.length; i += 2) ((alongX ? p.c[i] : p.c[i + 1]) < half ? a : c2).push(p.c[i], p.c[i + 1]);
        const na = normalise(a.map((v, i) => v + (i % 2 ? p.y : p.x))), nb = normalise(c2.map((v, i) => v + (i % 2 ? p.y : p.x)));
        const pa: Piece = { ...p, c: na.c, x: na.x, y: na.y, parts: Math.max(1, p.parts >> 1) };
        const pb: Piece = { ...p, id: s.nextId++, c: nb.c, x: nb.x, y: nb.y, parts: Math.max(1, p.parts - pa.parts) };
        s.pieces[k] = p = pa; s.pieces.push(pb);
        ev.push({ t: "shape", id: pa.id, piece: pa, why: "split" }, { t: "spawn", piece: pb });
      }
      t = val(TILE.copy);
      if (t && !wornOut(L, s, t.ci)) {
        const b = bounds(p.c), o = occupancy(L, s);
        for (const [dx, dy] of [[b.w, 0], [-b.w, 0], [0, b.h], [0, -b.h]]) {
          const tmp: Piece = { ...p, id: s.nextId, x: p.x + dx, y: p.y + dy };
          if (fits(L, o, p.c, tmp.x, tmp.y, 0) && restable(L, s, o, tmp, tmp.x, tmp.y, 0)) { s.nextId++; s.pieces.push(tmp); wear(s, t.ci); ev.push({ t: "spawn", piece: tmp }); break; }
        }
      }
      t = val(TILE.swap);
      if (t) {
        const other = L.tiles.findIndex((tt, ci) => tt === TILE.swap && ci !== t!.ci && L.tval?.[ci] === t!.v);
        if (other >= 0) {
          const o = occupancy(L, s), j = o[other] - 1;
          if (j >= 0 && j !== k) {
            const dx = (other % L.W) - (t.ci % L.W), dy = ((other / L.W) | 0) - ((t.ci / L.W) | 0), q = s.pieces[j];
            const pa = { ...p, x: p.x + dx, y: p.y + dy }, qa = { ...q, x: q.x - dx, y: q.y - dy };
            s.pieces[k] = pa; s.pieces[j] = qa;
            const o2 = occupancy(L, s);
            const okA = fits(L, o2, pa.c, pa.x, pa.y, k + 1, pa.f), okB = fits(L, o2, qa.c, qa.x, qa.y, j + 1, qa.f);
            if (okA && okB) { p = pa; ev.push({ t: "slide", id: pa.id, x: pa.x, y: pa.y, why: "tele" }, { t: "slide", id: qa.id, x: qa.x, y: qa.y, why: "tele" }); }
            else { s.pieces[k] = p; s.pieces[j] = q; }
          }
        }
      }
      // pick-ups, switches, targets
      for (const ci of cellsOf(L, p)) {
        const tt = L.tiles[ci];
        if ((tt === TILE.star || tt === TILE.coin || tt === TILE.key) && !s.got.includes(ci)) {
          s.got.push(ci);
          if (tt === TILE.star) s.stars++; else if (tt === TILE.coin) s.coins++; else { const kc = L.tval?.[ci] ?? -1; s.keys |= 1 << (kc < 0 ? 15 : kc); }
          ev.push({ t: "get", cell: ci, what: tt === TILE.star ? "star" : tt === TILE.coin ? "coin" : "key" });
        }
        if (tt === TILE.switch && !before.has(ci)) { const g = L.tval?.[ci] ?? 0; s.sw ^= 1 << g; ev.push({ t: "switch", cell: ci, on: ((s.sw >> g) & 1) === 1 }); }
        if (tt === TILE.target && !s.cov.includes(ci)) s.cov.push(ci);
        if (tt === TILE.tilt && !before.has(ci)) tilt(L, s, L.tdir[ci], ev);
      }
      p = s.pieces[k];
    }
    if (p.x === sx && p.y === sy) break;
  }
  // chameleon: lands touching jellies of one colour only → takes that colour
  const p = s.pieces[k];
  if (p?.f?.chameleon) {
    const o = occupancy(L, s), cols = new Set<number>();
    for (const ci of cellsOf(L, p)) {
      const x = ci % L.W, y = (ci / L.W) | 0;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue; const v = o[ny * L.W + nx]; if (v > 0 && v !== k + 1 && s.pieces[v - 1].color < 8) cols.add(s.pieces[v - 1].color); }
    }
    if (cols.size === 1) { const got = [...cols][0]; if (got !== p.color) { s.pieces[k] = { ...p, color: got }; ev.push({ t: "shape", id: p.id, piece: s.pieces[k], why: "chameleon" }); } }
  }
}
/** S03: tip the tray — everything slides one way until it stops */
function tilt(L: Level, s: State, d: number, ev: JamEvent[]) {
  const order = s.pieces.map((p, k) => k).sort((a, b) => { const pa = s.pieces[a], pb = s.pieces[b]; return (pb.x * DX[d] + pb.y * DY[d]) - (pa.x * DX[d] + pa.y * DY[d]); });
  for (const k of order) if (movable(L, s, s.pieces[k]) || s.pieces[k].color === CRATE) slideK(L, s, k, d, ev, "tilt");
}

/** touches: big jellies knock crate stacks / glass, key jellies open locks, a nudge wakes a sleeper */
function touches(L: Level, s: State, k: number) {
  const p = s.pieces[k]; if (!p) return;
  const mine = new Set(cellsOf(L, p)), ring = new Set<number>();
  for (const ci of mine) { const x = ci % L.W, y = (ci / L.W) | 0; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx >= 0 && ny >= 0 && nx < L.W && ny < L.H && !mine.has(ny * L.W + nx)) ring.add(ny * L.W + nx); } }
  const n = p.c.length >> 1;
  L.doors?.forEach((d) => { if (d.hit && n >= d.hit.size && (d.hit.color === undefined || d.hit.color === p.color) && d.cells.some((ci) => ring.has(ci))) s.hits[d.hit.i]++; });
  if (info(L).hitPieces) for (const q of s.pieces) {
    if (q === p || q.f?.lock?.t !== "hit") continue;
    if (cellsOf(L, q).some((ci) => ring.has(ci))) s.hits[q.f.lock.i]++;
  }
}

/** blocks that fit an open gate leave (and boxes that are full empty out) */
function exits(L: Level, s: State, ev: JamEvent[]) {
  for (let j = 0; j < s.pieces.length; j++) {
    const p = s.pieces[j];
    const g = gateFor(L, s, p);
    if (g < 0) continue;
    leave(L, s, j, g, ev); j--;
  }
  L.gates.forEach((g, gi) => {
    if (g.kind !== "box") return;
    const who = boxFull(L, s, gi);
    if (!who) return;
    for (const j of who.sort((a, b) => b - a)) { const p = s.pieces[j]; s.pieces.splice(j, 1); ev.push({ t: "exit", id: p.id, gate: gi, piece: p }); s.outC[p.color]++; }
    s.gates[gi]--; s.out++; s.lastOut = s.moves;
  });
}
function leave(L: Level, s: State, j: number, gi: number, ev: JamEvent[]) {
  const p = s.pieces[j], g = L.gates[gi];
  const uses = (g.count >= 99 ? 99 : g.count) - s.gates[gi];
  s.gates[gi]--; s.out++; s.outC[p.color]++; s.lastOut = s.moves;
  s.pieces.splice(j, 1);
  ev.push({ t: "exit", id: p.id, gate: gi, piece: p });
  if (p.f?.keeper) { s.lost = "keeper"; ev.push({ t: "lost", why: "keeper" }); }
  if (g.star && s.moves <= Math.max(1, L.par)) s.stars++;
  const sp = g.spawn?.[uses];
  if (sp) {
    const o = occupancy(L, s);
    if (fits(L, o, sp.c, sp.x, sp.y, 0)) { const np = { ...sp, id: s.nextId++ }; s.pieces.push(np); ev.push({ t: "spawn", piece: np }); }
  }
}

/** things that move on their own after your move */
function dynamics(L: Level, s: State, mover: number, ev: JamEvent[]): number[] {
  const R = L.rules ?? {}, moved: number[] = [];
  const track = (k: number, before: Piece) => { const p = s.pieces[k]; if (p && (p.x !== before.x || p.y !== before.y || p.c !== before.c)) moved.push(p.id); };
  if (R.gravity !== undefined) {
    const d = R.gravity;
    const order = s.pieces.map((_, k) => k).sort((a, b) => { const pa = s.pieces[a], pb = s.pieces[b]; return (pb.x * DX[d] + pb.y * DY[d]) - (pa.x * DX[d] + pa.y * DY[d]); });
    for (const k of order) { const b = s.pieces[k]; if (b.f?.bubble && d === 2) continue; slideK(L, s, k, d, ev, "fall"); track(k, b); }
  }
  if (R.drift !== undefined) for (let k = 0; k < s.pieces.length; k++) { const b = s.pieces[k]; slideK(L, s, k, R.drift, ev, "drift", 1); track(k, b); }
  if (L.tiles.some((t) => t === TILE.wind)) {
    for (let k = 0; k < s.pieces.length; k++) {
      const b = s.pieces[k], ci = tileUnder(L, b, TILE.wind);
      if (ci < 0) continue;
      slideK(L, s, k, L.tdir[ci], ev, "wind", 1); track(k, b);
    }
  }
  if (L.tiles.some((t) => t === TILE.magnet)) {
    for (let k = 0; k < s.pieces.length; k++) {
      const b = s.pieces[k];
      for (const ci of cellsOf(L, b)) {
        const x = ci % L.W, y = (ci / L.W) | 0;
        let dd = -1;
        for (let d = 0; d < 4 && dd < 0; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx >= 0 && ny >= 0 && nx < L.W && ny < L.H && L.tiles[ny * L.W + nx] === TILE.magnet) dd = d; }
        if (dd >= 0 && tileUnder(L, b, TILE.magnet) < 0) { slideK(L, s, k, dd, ev, "magnet", 1); track(k, b); break; }
      }
    }
  }
  // magnet jellies pull their colour (and push other magnets) along clear lines
  for (let m = 0; m < s.pieces.length; m++) {
    const M = s.pieces[m];
    if (!M.f?.magnet) continue;
    for (let k = 0; k < s.pieces.length; k++) {
      if (k === m) continue;
      const P = s.pieces[k];
      if (P.color !== M.color && !P.f?.magnet) continue;
      const pb = bounds(P.c), mb = bounds(M.c);
      const rowShare = P.y < M.y + mb.h && M.y < P.y + pb.h, colShare = P.x < M.x + mb.w && M.x < P.x + pb.w;
      let d = -1;
      if (rowShare) d = P.x > M.x ? 3 : 1; else if (colShare) d = P.y > M.y ? 2 : 0;
      if (d < 0) continue;
      if (P.color !== M.color) d = (d + 2) % 4;
      const b = s.pieces[k]; slideK(L, s, k, d, ev, "magnet"); track(k, b);
    }
  }
  // Kranky's jelly steps towards your last jelly; shy jellies step away from it
  const mv = s.pieces.find((p) => p.id === mover);
  if (mv) for (let k = 0; k < s.pieces.length; k++) {
    const P = s.pieces[k];
    if (!P.f?.kranky && !P.f?.shy) continue;
    const dx = mv.x - P.x, dy = mv.y - P.y;
    if (P.f.shy && Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
    const sgn = P.f.kranky ? 1 : -1;
    const prefs = Math.abs(dx) >= Math.abs(dy) ? [dirOf(sgn * dx, 0), dirOf(0, sgn * dy)] : [dirOf(0, sgn * dy), dirOf(sgn * dx, 0)];
    const b = s.pieces[k];
    for (const d of prefs) if (d >= 0 && slideK(L, s, k, d, ev, P.f.kranky ? "kranky" : "drift", 1)) break;
    track(k, b);
  }
  // spinners turn, babies grow
  for (let k = 0; k < s.pieces.length; k++) {
    const P = s.pieces[k];
    if (P.f?.spinner && P.c.length > 2) {
      const rc = rotCW(P.c), o = occupancy(L, s);
      if (fits(L, o, rc, P.x, P.y, k + 1, P.f)) { s.pieces[k] = { ...P, c: rc }; ev.push({ t: "shape", id: P.id, piece: s.pieces[k], why: "spin" }); moved.push(P.id); }
    }
    if (P.f?.baby && P.c.length < 8) {
      const grow: [number, number][] = [[1, 0], [0, 1], [1, 1]];
      const o = occupancy(L, s);
      for (const [gx, gy] of grow) {
        if (P.c.some((_, i, a) => i % 2 === 0 && a[i] === gx && a[i + 1] === gy)) continue;
        const nc = normalise([...P.c, gx, gy]).c;
        if (fits(L, o, nc, P.x, P.y, k + 1, P.f)) { s.pieces[k] = { ...P, c: nc, ...(nc.length >= 8 ? { f: { ...P.f, baby: undefined } } : {}) }; ev.push({ t: "shape", id: P.id, piece: s.pieces[k], why: "grow" }); moved.push(P.id); }
        break;
      }
    }
  }
  // Kranky's stage events
  for (const e of R.events ?? []) {
    if (e.at !== s.moves) continue;
    if (e.t === "swap") {
      const a = s.pieces.findIndex((p) => p.id === e.a), b = s.pieces.findIndex((p) => p.id === e.b);
      if (a >= 0 && b >= 0) { const ca = s.pieces[a].color; s.pieces[a] = { ...s.pieces[a], color: s.pieces[b].color }; s.pieces[b] = { ...s.pieces[b], color: ca }; ev.push({ t: "shape", id: s.pieces[a].id, piece: s.pieces[a], why: "swap" }, { t: "shape", id: s.pieces[b].id, piece: s.pieces[b], why: "swap" }); moved.push(e.a, e.b); }
    } else if (e.t === "paint") {
      for (const id of e.ids) { const j = s.pieces.findIndex((p) => p.id === id); if (j >= 0) { s.pieces[j] = { ...s.pieces[j], color: e.color }; ev.push({ t: "shape", id, piece: s.pieces[j], why: "paint" }); moved.push(id); } }
    } else if (e.t === "freeze") {
      const j = s.pieces.findIndex((p) => p.id === e.id); if (j >= 0) s.pieces[j] = setF(s.pieces[j], { frozen: e.until });
    } else if (e.t === "gates") {
      s.gat = L.gates.map((g, i) => gateAt(g, s, i));
      for (const [gi, at] of e.moves) s.gat[gi] = at;
    } else if (e.t === "drop") {
      const o = occupancy(L, s);
      if (fits(L, o, e.piece.c, e.piece.x, e.piece.y, 0)) { const np = { ...e.piece, id: s.nextId++ }; s.pieces.push(np); ev.push({ t: "spawn", piece: np }); moved.push(np.id); }
    }
  }
  return moved;
}

/** timers and limits: things that can lose the stage */
function timers(L: Level, s: State, ev: JamEvent[]) {
  const R = L.rules;
  if (s.lost) return;
  const lose = (why: string) => { s.lost = why; ev.push({ t: "lost", why }); };
  for (const p of s.pieces) {
    if (p.f?.timer !== undefined && s.moves >= p.f.timer) return lose("countdown");
    if (p.f?.setBy !== undefined && s.moves >= p.f.setBy) return lose("set");
  }
  if (!R) return;
  const left = s.pieces.some((p) => counts(L, p));
  if (R.limit && s.moves >= R.limit && left) return lose("moves");
  if (R.combo && s.out > 0 && left && s.moves - s.lastOut > R.combo) return lose("combo");
  if (R.keep && !s.pieces.some((p) => p.f?.keeper)) return lose("keeper");
  // S22: the tray loops back (jellies that never squished go home)
  if (R.loop && left && s.moves - s.lastOut >= R.loop && (s.moves - s.lastOut) % R.loop === 0) {
    for (let k = 0; k < s.pieces.length; k++) {
      const p = s.pieces[k], home = L.pieces.find((q) => q.id === p.id && q.c.join() === p.c.join());
      if (home && (home.x !== p.x || home.y !== p.y)) placeK(L, s, k, home.x, home.y, ev, "rewind");
    }
  }
}

// ---------------------------------------------------------------- the move
/** drop jelly mv.id at (mv.x, mv.y). Returns null when nothing moves (or the jelly can't move). */
export function apply(L: Level, s0: State, mv: Move): { s: State; ev: JamEvent[] } | null {
  if (s0.lost) return null;
  const k = s0.pieces.findIndex((p) => p.id === mv.id);
  if (k < 0) return null;
  const p0 = s0.pieces[k];
  if (p0.x === mv.x && p0.y === mv.y) return null;
  if (!movable(L, s0, p0)) return null;
  const s = cloneState(s0);
  const ev: JamEvent[] = [];
  const R = L.rules;
  s.moves++;
  const dx = mv.x - p0.x, dy = mv.y - p0.y;
  s.dir = dirOf(dx, dy);
  if (R?.oneDrag) s.dragged.push(p0.id);
  s.pieces[k] = { ...p0, x: mv.x, y: mv.y };
  ev.push({ t: "move", id: mv.id, x: mv.x, y: mv.y });
  // twins, crowds and copycats follow
  const followers: number[] = [];
  for (let j = 0; j < s.pieces.length; j++) {
    if (j === k) continue;
    const q = s.pieces[j];
    const twin = q.f?.twin !== undefined && Math.abs(q.f.twin) === p0.id;
    const crowd = (R?.crowd || p0.f?.leader) && q.color === p0.color && !q.f?.kranky;
    if (!twin && !crowd && !q.f?.copycat) continue;
    const mx = twin && q.f!.twin! < 0 ? -dx : dx;
    const o = occupancy(L, s);
    if (movable(L, s, q) && fits(L, o, q.c, q.x + mx, q.y + dy, j + 1, q.f) && restable(L, s, o, q, q.x + mx, q.y + dy, j + 1)) {
      s.pieces[j] = { ...q, x: q.x + mx, y: q.y + dy };
      ev.push({ t: "slide", id: q.id, x: q.x + mx, y: q.y + dy, why: "echo" });
      followers.push(q.id);
    }
  }
  floorEffects(L, s, k, { x: p0.x, y: p0.y }, ev);
  // S21: the move happens a second time
  if (R?.echo && s.pieces[k]) {
    const p = s.pieces[k], o = occupancy(L, s);
    if (fits(L, o, p.c, p.x + dx, p.y + dy, k + 1, p.f) && restable(L, s, o, p, p.x + dx, p.y + dy, k + 1)) {
      const from = { x: p.x, y: p.y };
      s.pieces[k] = { ...p, x: p.x + dx, y: p.y + dy };
      ev.push({ t: "slide", id: p.id, x: p.x + dx, y: p.y + dy, why: "echo" });
      floorEffects(L, s, k, from, ev);
    }
  }
  // worn tiles under where it was
  if (info(L).tiles && s.pieces[k]) {
    const now = new Set(cellsOf(L, s.pieces[k]));
    for (const ci of cellsOf(L, p0)) {
      const t = L.tiles[ci];
      if ((t === TILE.crumble || t === TILE.glass || t === TILE.counter) && !now.has(ci)) { const n = wear(s, ci); ev.push({ t: "wear", cell: ci, broken: n >= wearMax(L, ci) }); }
    }
  }
  if (s.pieces[k]) touches(L, s, k);
  const doorsBefore = L.doors?.map((_, i) => doorSolid(L, s0, i));
  // squish: the dropped jelly, then anything that moved with it
  const id = s.pieces[k]?.id;
  if (id !== undefined) squishAt(L, s, s.pieces.findIndex((q) => q.id === id), ev);
  for (const fid of followers) { const j = s.pieces.findIndex((q) => q.id === fid); if (j >= 0) squishAt(L, s, j, ev); }
  exits(L, s, ev);
  // things that move on their own (and what they set off)
  if (info(L).dyn) {
    for (let round = 0; round < 3; round++) {
      const moved = dynamics(L, s, mv.id, ev);
      if (!moved.length) break;
      for (const mid of moved) { const j = s.pieces.findIndex((q) => q.id === mid); if (j >= 0) squishAt(L, s, j, ev); }
      exits(L, s, ev);
      if (round === 0 && !(R?.gravity !== undefined || R?.drift !== undefined)) break;
    }
  }
  // doors that changed
  if (L.doors) L.doors.forEach((_, i) => { const now = doorSolid(L, s, i); if (doorsBefore && now !== doorsBefore[i]) ev.push({ t: "door", i, solid: now }); });
  // pieces now standing inside a door that closed (or a tile that broke) are pushed out of the way: the door waits
  timers(L, s, ev);
  if (isClear(L, s)) ev.push({ t: "win" });
  s.nextId = Math.max(s.nextId, ...s.pieces.map((q) => q.id + 1));
  return { s, ev };
}

/** a stable key for search: jellies by colour/shape/place/flags + pads + gates + everything else that can change */
export function stateKey(L: Level, s: State) {
  const parts = s.pieces.map((p) => `${p.color}:${p.x},${p.y}:${shapeKey(p.c)}${p.f ? ":" + flagKey(p.f, s.moves) : ""}`).sort();
  const F = info(L);
  const blink = L.gates.some((g) => g.blink) ? s.moves % 2 : 0;
  const extra = F.tiles || L.doors || L.rules ? `#${s.sw},${s.keys},${s.got.length ? s.got.slice().sort((a, b) => a - b).join(".") : ""},${s.cov.length},${s.wear.join(".")},${s.hits.join(".")},${s.coins},${s.turns},${s.dragged.length ? s.dragged.slice().sort().join(".") : ""},${s.out}` : "";
  const time = F.timed ? `#t${s.moves}` : "";
  return `${parts.join("|")}#${s.pads.join(",")}#${s.gates.join(",")}#${blink}${extra}${time}${s.lost ? "#lost" : ""}`;
}
function flagKey(f: PieceFlags, moves: number) {
  let k = "";
  if (f.bubble) k += "b"; if (f.dirty) k += "d"; if (f.battery) k += "y"; if (f.sealed) k += "s";
  if (f.frozen !== undefined && f.frozen > moves) k += `f${f.frozen - moves}`;
  if (f.baby) k += "B"; if (f.must) k += "m"; if (f.keeper) k += "K"; if (f.king) k += "k";
  return k;
}

/** replay moves from the start (resume a saved stage) */
export function replay(L: Level, moves: Move[]): State {
  let s = newState(L);
  for (const m of moves) { const r = apply(L, s, m); if (r) s = r.s; }
  return s;
}

/** the direction of a drop (for ice, springs and arrow gates) */
export const moveDir = (p: Piece, m: Move) => dirOf(m.x - p.x, m.y - p.y) as Dir | -1;
