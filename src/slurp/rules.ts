// Slurp Lab: the game rules, pure functions shared by the game, the solver, the generator and the bot.
// `move()` takes one step for a Slurper (and its linked / mirrored partner) and then everything that follows from it:
// pushing crates, breaking glass, slurping, popping bubbles, bombs, falling bridges, paint, switches, portals, turn
// pads, sliding on ice, riding belts, hungry Slurpers, sealing, waking and unlocking. Steps that change nothing but
// the Slurper's place are "pure": the solver and the generator walk those freely.
import { BF, DIRS, RAINBOW, T, isArrow, isBelt, isGate, isPaint, type FxEvent, type SlurperState, type Stage, type State } from "./types";

export const DIR_CH = "URDL";

// ------------------------------------------------------------------ per-stage lookups (cached)
const CACHE = new WeakMap<Stage, { fence: Set<number>; portal: Map<number, number> }>();
function look(st: Stage) {
  let c = CACHE.get(st);
  if (!c) { c = { fence: new Set(st.fences ?? []), portal: new Map() }; for (const [a, b] of st.portals ?? []) { c.portal.set(a, b); c.portal.set(b, a); } CACHE.set(st, c); }
  return c;
}

export function initState(st: Stage): State {
  const N = st.w * st.h;
  const blobs = Int8Array.from(st.blobs);
  const cnt = new Int8Array(N), bub = new Uint8Array(N), crates = new Uint8Array(N);
  st.blobs.forEach((b, c) => { if (b >= 0) { const f = st.bflags?.[c] ?? 0; cnt[c] = f & BF.DOUBLE ? 2 : 1; if (f & BF.BUBBLE) bub[c] = 1; } });
  for (const c of st.crates ?? []) crates[c] = 1;
  const s: State = {
    blobs, cnt, bub, tiles: Uint8Array.from(st.tiles), crates, sw: 0, moves: 0,
    sl: st.slurpers.map((d) => ({ x: d.x, y: d.y, need: d.need, alive: d.need > 0, color: d.color, cells: d.cells.map((c) => [c[0], c[1]] as [number, number]), awake: d.lock === undefined && !d.sleep })),
  };
  wakeChecks(st, s, []);
  return s;
}
export function cloneState(s: State): State {
  return { blobs: s.blobs.slice(), cnt: s.cnt.slice(), bub: s.bub.slice(), tiles: s.tiles.slice(), crates: s.crates.slice(), sw: s.sw, moves: s.moves, sl: s.sl.map((q) => ({ ...q, cells: q.cells })) };
}

/** cell → index of the live Slurper covering it (-1 = none) */
export function occupancy(st: Stage, s: State): Int16Array {
  const occ = new Int16Array(st.w * st.h).fill(-1);
  s.sl.forEach((q, i) => { if (q.alive) for (const [dx, dy] of q.cells) occ[(q.y + dy) * st.w + q.x + dx] = i; });
  return occ;
}
export function blobsLeft(s: State) { let n = 0; for (const b of s.blobs) if (b >= 0) n++; return n; }
export const won = (s: State) => blobsLeft(s) === 0;

/** is a tile something a Slurper can stand on right now? (gates and arrows are checked by the caller) */
function standable(s: State, t: number): boolean {
  if (t === T.WALL || t === T.VOID || t === T.GLASS) return false;
  if (t === T.SWA) return s.sw === 1;
  if (t === T.SWB) return s.sw === 0;
  return true;
}
/** tiles a pure step may enter (nothing happens there) */
function plainTile(s: State, t: number, color: number, d: number): boolean {
  if (t === T.FLOOR) return true;
  if (isGate(t)) return t - T.GATE === color;
  if (isArrow(t)) return t - T.ARROW === d;
  if (t === T.SWA) return s.sw === 1;
  if (t === T.SWB) return s.sw === 0;
  return false;
}
/** the group a move of Slurper i drags along: [index, direction] */
export function group(st: Stage, s: State, i: number, d: number): [number, number][] {
  const out: [number, number][] = [[i, d]];
  const def = st.slurpers[i];
  if (def.link !== undefined && s.sl[def.link]?.alive) out.push([def.link, d]);
  if (def.mirror !== undefined && s.sl[def.mirror]?.alive) out.push([def.mirror, (d + 2) % 4]);
  return out;
}
const fenceCrossed = (st: Stage, W: number, q: SlurperState, d: number, fence: Set<number>) => {
  if (!fence.size) return false;
  for (const [cx, cy] of q.cells) if (fence.has(((q.y + cy) * W + q.x + cx) * 4 + d)) return true;
  return false;
};

/** a pure step: valid and nothing changes but the Slurper's place (from (x, y)) */
export function pureStep(st: Stage, s: State, occ: Int16Array, i: number, d: number, x: number, y: number): boolean {
  const q = s.sl[i], def = st.slurpers[i], W = st.w;
  if (!q.alive || !q.awake || def.link !== undefined && s.sl[def.link]?.alive || def.mirror !== undefined && s.sl[def.mirror]?.alive) return false;
  const [dx, dy] = DIRS[d], nx = x + dx, ny = y + dy;
  const { fence } = look(st);
  for (const [cx, cy] of q.cells) {
    const ox = x + cx, oy = y + cy;
    if (fence.size && fence.has((oy * W + ox) * 4 + d)) return false;
    if (s.tiles[oy * W + ox] === T.CRUMBLE) return false; // leaving a bridge makes it fall
    const tx = nx + cx, ty = ny + cy;
    if (tx < 0 || ty < 0 || tx >= W || ty >= st.h) return false;
    const c = ty * W + tx, t = s.tiles[c];
    if (t === T.BELT || isBelt(t) || t === T.ICE) return false;
    if (q.cells.some(([a, b]) => a + x === tx && b + y === ty)) continue;
    if (!plainTile(s, t, q.color, d)) return false;
    if (s.blobs[c] >= 0 || s.crates[c]) return false;
    const o = occ[c]; if (o >= 0 && o !== i) return false;
  }
  if (def.hungry) {
    // a hungry Slurper would drink what's next to it
    for (const [cx, cy] of q.cells) for (const [ex, ey] of DIRS) { const tx = nx + cx + ex, ty = ny + cy + ey; if (tx < 0 || ty < 0 || tx >= W || ty >= st.h) continue; const c = ty * W + tx; if (s.blobs[c] === q.color && !s.bub[c]) return false; }
  }
  return true;
}

export interface MoveOut {
  /** each step taken (for animation): the Slurper, its new anchor, how it got there */
  steps: { i: number; x: number; y: number; kind: "step" | "slide" | "belt" | "portal" }[];
  eats: { i: number; cells: number[]; color: number; need: number }[];
  seals: { i: number; x: number; y: number; color: number }[];
  /** cells newly covered by each Slurper (the generator plants on first visits) */
  covered: { i: number; cells: number[]; color: number }[];
  fx: FxEvent[];
  /** it entered goo: the drag ends */
  stop: boolean;
  /** something besides positions changed */
  changed: boolean;
}

/** check one member's step: the cells it newly covers and what's in them → null if blocked */
function checkStep(st: Stage, s: State, occ: Int16Array, i: number, d: number, members: Set<number>, claimed: Set<number>, allowPush: boolean) {
  const q = s.sl[i], W = st.w, H = st.h, { fence } = look(st);
  if (!q.alive || !q.awake) return null;
  if (fenceCrossed(st, W, q, d, fence)) return null;
  const [dx, dy] = DIRS[d], nx = q.x + dx, ny = q.y + dy;
  const fresh: number[] = [], eat: number[] = [], pushes: [number, number][] = [], breaks: number[] = [];
  let cost = 0;
  for (const [cx, cy] of q.cells) {
    const tx = nx + cx, ty = ny + cy;
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
    const c = ty * W + tx;
    if (claimed.has(c)) return null;
    if (q.cells.some(([a, b]) => a + q.x === tx && b + q.y === ty)) continue;
    const t = s.tiles[c];
    if (t === T.GLASS) { if (q.cells.length < 4) return null; breaks.push(c); }
    else if (!standable(s, t)) return null;
    if (isGate(t) && t - T.GATE !== q.color) return null;
    if (isArrow(t) && t - T.ARROW !== d) return null;
    const o = occ[c];
    if (o >= 0 && o !== i && !members.has(o)) return null;
    if (s.crates[c]) {
      if (!allowPush) return null;
      const px = tx + dx, py = ty + dy;
      if (px < 0 || py < 0 || px >= W || py >= H) return null;
      const p = py * W + px, pt = s.tiles[p];
      if (!(pt === T.FLOOR || pt === T.ICE || pt === T.GOO) || s.blobs[p] >= 0 || s.crates[p] || occ[p] >= 0 || fence.has(c * 4 + d)) return null;
      if (q.cells.some(([a, b]) => a + nx === px && b + ny === py)) return null;
      pushes.push([c, p]);
    }
    const b = s.blobs[c];
    if (b >= 0) {
      if (s.bub[c] || (b !== q.color && b !== RAINBOW)) return null;
      eat.push(c); cost += s.cnt[c];
    }
    fresh.push(c);
  }
  if (cost > q.need) return null;
  return { nx, ny, fresh, eat, pushes, breaks };
}

/** take a step for Slurper i in direction d (with its partners); mutates s; null = blocked (s unchanged) */
export function move(st: Stage, s: State, i: number, d: number, walk = false): MoveOut | null {
  const g = group(st, s, i, d);
  const occ = occupancy(st, s);
  const members = new Set(g.map(([k]) => k));
  const claimed = new Set<number>();
  const plans: { k: number; d: number; p: NonNullable<ReturnType<typeof checkStep>> }[] = [];
  for (const [k, dk] of g) {
    const p = checkStep(st, s, occ, k, dk, members, claimed, g.length === 1);
    if (!p) return null;
    // the members' new footprints must not overlap
    const q = s.sl[k];
    for (const [cx, cy] of q.cells) claimed.add((p.ny + cy) * st.w + p.nx + cx);
    plans.push({ k, d: dk, p });
  }
  const out: MoveOut = { steps: [], eats: [], seals: [], covered: [], fx: [], stop: false, changed: false };
  for (const pl of plans) applyPlanned(st, s, pl.k, pl.d, pl.p, out, "step");
  // one Slurper alone: portals, turn pads, ice and belts may carry it on
  if (g.length === 1 && s.sl[i].alive) followUp(st, s, i, d, out);
  // hungry Slurpers drink what's around them; then sleepers wake and locks open
  for (const [k] of g) if (st.slurpers[k].hungry && s.sl[k].alive) hungry(st, s, k, out);
  if (!walk) wakeChecks(st, s, out.eats.flatMap((e) => e.cells), out);
  return out;
}

function applyPlanned(st: Stage, s: State, k: number, d: number, p: NonNullable<ReturnType<typeof checkStep>>, out: MoveOut, kind: MoveOut["steps"][number]["kind"]) {
  const q = s.sl[k], W = st.w;
  const old = q.cells.map(([cx, cy]) => (q.y + cy) * W + q.x + cx);
  for (const [from, to] of p.pushes) { s.crates[from] = 0; s.crates[to] = 1; out.fx.push({ t: "crate", from, to }); out.changed = true; }
  for (const c of p.breaks) { s.tiles[c] = T.FLOOR; out.fx.push({ t: "break", cell: c }); out.changed = true; }
  q.x = p.nx; q.y = p.ny;
  out.steps.push({ i: k, x: q.x, y: q.y, kind });
  out.covered.push({ i: k, cells: p.fresh, color: q.color });
  if (p.eat.length) eatCells(st, s, k, p.eat, out);
  // a bridge it left falls away
  const now = new Set(q.alive ? q.cells.map(([cx, cy]) => (q.y + cy) * W + q.x + cx) : []);
  for (const c of old) if (!now.has(c) && s.tiles[c] === T.CRUMBLE) { s.tiles[c] = T.VOID; out.fx.push({ t: "crumble", cell: c }); out.changed = true; }
  if (!q.alive) return;
  for (const c of p.fresh) {
    const t = s.tiles[c];
    if (t === T.GOO) out.stop = true;
    if (isPaint(t) && q.color !== t - T.PAINT) { q.color = t - T.PAINT; out.fx.push({ t: "paint", i: k, color: q.color }); out.changed = true; }
    if (t === T.SWITCH) toggleSwitch(st, s, out);
  }
  void d;
}

function eatCells(st: Stage, s: State, k: number, cells: number[], out: MoveOut) {
  const q = s.sl[k], W = st.w;
  let cost = 0;
  for (const c of cells) {
    cost += s.cnt[c];
    if ((st.bflags?.[c] ?? 0) & BF.BOMB) {
      const x = c % W, y = (c - x) / W;
      out.fx.push({ t: "bomb", cell: c });
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= st.h) continue; const n = yy * W + xx; if (s.tiles[n] === T.GLASS) { s.tiles[n] = T.FLOOR; out.fx.push({ t: "break", cell: n }); } }
    }
    s.blobs[c] = -1; s.cnt[c] = 0;
  }
  // bubbles next to a slurped Gloopy pop
  for (const c of cells) { const x = c % W, y = (c - x) / W; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= st.h) continue; const n = ny * W + nx; if (s.bub[n]) { s.bub[n] = 0; out.fx.push({ t: "pop", cell: n }); } } }
  q.need -= cost;
  out.eats.push({ i: k, cells, color: q.color, need: q.need });
  out.changed = true;
  if (q.need <= 0) {
    q.alive = false;
    out.seals.push({ i: k, x: q.x, y: q.y, color: q.color });
    // it leaves the board: a bridge under it falls
    for (const [cx, cy] of q.cells) { const c = (q.y + cy) * W + q.x + cx; if (s.tiles[c] === T.CRUMBLE) { s.tiles[c] = T.VOID; out.fx.push({ t: "crumble", cell: c }); } }
  }
}

function toggleSwitch(st: Stage, s: State, out: MoveOut) {
  const next = s.sw ? 0 : 1, solid = next === 0 ? T.SWA : T.SWB;
  const occ = occupancy(st, s);
  for (let c = 0; c < s.tiles.length; c++) if (s.tiles[c] === solid && (occ[c] >= 0 || s.crates[c] || s.blobs[c] >= 0)) return;
  s.sw = next; out.fx.push({ t: "switch", on: next }); out.changed = true;
}

/** portals, turn pads, then ice and belts (a lone Slurper) */
function followUp(st: Stage, s: State, i: number, d: number, out: MoveOut) {
  const W = st.w, q = s.sl[i], { portal } = look(st);
  const last = () => out.covered[out.covered.length - 1]?.cells ?? [];
  // a portal it just stepped onto sends it to the twin portal
  const pc = last().find((c) => s.tiles[c] === T.PORTAL);
  if (pc !== undefined && portal.has(pc)) {
    const to = portal.get(pc)!, off = (to % W - pc % W), offy = (Math.floor(to / W) - Math.floor(pc / W));
    const nx = q.x + off, ny = q.y + offy;
    if (fits(st, s, i, nx, ny, q.cells)) {
      const occ = occupancy(st, s);
      const fresh: number[] = [], eat: number[] = [];
      for (const [cx, cy] of q.cells) { const c = (ny + cy) * W + nx + cx; if (!q.cells.some(([a, b]) => a + q.x === nx + cx && b + q.y === ny + cy)) fresh.push(c); if (s.blobs[c] >= 0) eat.push(c); }
      void occ;
      const from = q.y * W + q.x;
      applyPlanned(st, s, i, d, { nx, ny, fresh, eat, pushes: [], breaks: [] }, out, "portal");
      out.fx.push({ t: "portal", i, from, to: ny * W + nx }); out.changed = true;
      if (!q.alive) return;
    }
  }
  // a turn pad turns it a quarter turn (clockwise) about the pad, when there's room
  const tc = last().find((c) => s.tiles[c] === T.TURN);
  if (tc !== undefined && q.alive) {
    const px = tc % W, py = (tc - px) / W;
    const abs = q.cells.map(([cx, cy]) => [q.x + cx, q.y + cy]);
    const rot = abs.map(([x, y]) => [px - (y - py), py + (x - px)]);
    const mx = Math.min(...rot.map((c) => c[0])), my = Math.min(...rot.map((c) => c[1]));
    const cells = rot.map(([x, y]) => [x - mx, y - my] as [number, number]);
    if (fits(st, s, i, mx, my, cells, true)) { q.x = mx; q.y = my; q.cells = cells; out.fx.push({ t: "turn", i }); out.changed = true; out.steps.push({ i, x: mx, y: my, kind: "step" }); }
  }
  // ice keeps it going; belts carry it
  for (let guard = 0; guard < 48 && q.alive; guard++) {
    const foot = q.cells.map(([cx, cy]) => (q.y + cy) * W + q.x + cx);
    let dir = -1, kind: "slide" | "belt" = "slide";
    if (foot.some((c) => s.tiles[c] === T.ICE)) dir = d;
    else { const b = foot.find((c) => isBelt(s.tiles[c])); if (b !== undefined) { dir = s.tiles[b] - T.BELT; kind = "belt"; } }
    if (dir < 0) break;
    const occ = occupancy(st, s);
    const p = checkStep(st, s, occ, i, dir, new Set([i]), new Set(), true);
    if (!p) break;
    applyPlanned(st, s, i, dir, p, out, kind);
    if (kind === "slide") d = dir;
  }
}

/** would Slurper i fit at (x, y) with these cells (empty cells, or its own colour when `eat`)? */
function fits(st: Stage, s: State, i: number, x: number, y: number, cells: [number, number][], noEat = false): boolean {
  const W = st.w, q = s.sl[i], occ = occupancy(st, s);
  let cost = 0;
  for (const [cx, cy] of cells) {
    const tx = x + cx, ty = y + cy;
    if (tx < 0 || ty < 0 || tx >= W || ty >= st.h) return false;
    const c = ty * W + tx, t = s.tiles[c];
    if (!standable(s, t) || isArrow(t) || (isGate(t) && t - T.GATE !== q.color)) return false;
    if (s.crates[c] || (occ[c] >= 0 && occ[c] !== i)) return false;
    const b = s.blobs[c];
    if (b >= 0) { if (noEat || s.bub[c] || (b !== q.color && b !== RAINBOW)) return false; cost += s.cnt[c]; }
  }
  return cost <= q.need;
}

function hungry(st: Stage, s: State, k: number, out: MoveOut) {
  const q = s.sl[k], W = st.w;
  const near: number[] = [];
  for (const [cx, cy] of q.cells) for (const [dx, dy] of DIRS) {
    const tx = q.x + cx + dx, ty = q.y + cy + dy;
    if (tx < 0 || ty < 0 || tx >= W || ty >= st.h) continue;
    const c = ty * W + tx;
    if (s.blobs[c] === q.color && !s.bub[c] && !near.includes(c)) near.push(c);
  }
  const take: number[] = []; let left = q.need;
  for (const c of near) if (s.cnt[c] <= left) { take.push(c); left -= s.cnt[c]; }
  if (take.length) eatCells(st, s, k, take, out);
}

/** sleepers wake when a Gloopy next to them is slurped; locks open when their colour is gone */
function wakeChecks(st: Stage, s: State, eaten: number[], out?: MoveOut) {
  const W = st.w;
  s.sl.forEach((q, k) => {
    if (q.awake || !q.alive) return;
    const def = st.slurpers[k];
    if (def.lock !== undefined) {
      let any = false; for (const b of s.blobs) if (b === def.lock) { any = true; break; }
      if (!any) { q.awake = true; out?.fx.push({ t: "unlock", i: k }); }
    } else if (def.sleep && eaten.length) {
      const near = eaten.some((c) => { const x = c % W, y = (c - x) / W; return q.cells.some(([cx, cy]) => Math.abs(q.x + cx - x) + Math.abs(q.y + cy - y) === 1); });
      if (near) { q.awake = true; out?.fx.push({ t: "wake", i: k }); }
    }
  });
}

// ------------------------------------------------------------------ searching helpers
/** where Slurper i can go with pure steps (BFS over its anchor) → parent map (anchor → previous anchor * 4 + dir) */
export function region(st: Stage, s: State, occ: Int16Array, i: number): Map<number, number> {
  const q = s.sl[i], W = st.w, start = q.y * W + q.x;
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let h = 0; h < queue.length; h++) {
    const p = queue[h], x = p % W, y = (p - x) / W;
    for (let d = 0; d < 4; d++) {
      if (!pureStep(st, s, occ, i, d, x, y)) continue;
      const np = (y + DIRS[d][1]) * W + x + DIRS[d][0];
      if (prev.has(np)) continue;
      prev.set(np, p * 4 + d);
      queue.push(np);
    }
  }
  return prev;
}
/** the directions from the Slurper's anchor to `to` inside its region */
export function pathTo(prev: Map<number, number>, to: number): number[] {
  const dirs: number[] = [];
  let p = to;
  for (let v = prev.get(p); v !== undefined && v >= 0; v = prev.get(p)) { dirs.push(v % 4); p = Math.floor(v / 4); }
  return dirs.reverse();
}

export interface Option { i: number; from: number; d: number; s: State; out: MoveOut; dirs: string }
/** every "event" Slurper i can make: walk (pure) to `from`, then a step that changes something (eats, pushes, …) */
export function options(st: Stage, s: State, i: number, prev?: Map<number, number>, eatsOnly = false): Option[] {
  const q = s.sl[i];
  if (!q.alive) return [];
  const occ = occupancy(st, s);
  const reg = prev ?? region(st, s, occ, i), W = st.w, outs: Option[] = [];
  for (const p of reg.keys()) {
    const x = p % W, y = (p - x) / W;
    for (let d = 0; d < 4; d++) {
      if (pureStep(st, s, occ, i, d, x, y)) continue;
      const s2 = cloneState(s);
      s2.sl[i] = { ...s2.sl[i], x, y };
      const o = move(st, s2, i, d);
      if (!o) continue;
      if (eatsOnly && !o.eats.length) continue;
      outs.push({ i, from: p, d, s: s2, out: o, dirs: pathTo(reg, p).map((v) => DIR_CH[v]).join("") + DIR_CH[d] });
    }
  }
  return outs;
}

/** the board is stuck: no Slurper can slurp anything, push, switch or open something within a few moves */
export function isStuck(st: Stage, s: State): boolean {
  if (won(s)) return false;
  for (let i = 0; i < s.sl.length; i++) {
    if (!s.sl[i].alive || !s.sl[i].awake) continue;
    // follow this Slurper's moves a few events deep (onto a bridge, through a portal, …) looking for progress
    let layer = [s];
    const seen = new Set<string>();
    for (let depth = 0; depth < 3 && layer.length; depth++) {
      const next: State[] = [];
      for (const cur of layer) for (const o of options(st, cur, i)) {
        if (o.out.eats.length || o.out.fx.some((f) => f.t === "crate" || f.t === "switch" || f.t === "break" || f.t === "unlock" || f.t === "wake" || f.t === "paint")) return false;
        const q = o.s.sl[i], k = `${q.x},${q.y},${q.color},${q.cells.length}`;
        if (!seen.has(k) && q.alive) { seen.add(k); next.push(o.s); }
      }
      layer = next.slice(0, 40);
    }
  }
  return true;
}
/** a fuse Gloopy that wasn't slurped in time */
export function burnt(st: Stage, s: State): boolean {
  for (const [c, n] of Object.entries(st.fuse ?? {})) if (s.blobs[Number(c)] >= 0 && s.moves >= n) return true;
  return false;
}

/** play a whole drag (a direction string) for Slurper i; false if a step is blocked */
export function playDrag(st: Stage, s: State, i: number, dirs: string): boolean {
  for (const ch of dirs) {
    if (!s.sl[i].alive) break;
    const o = move(st, s, i, DIR_CH.indexOf(ch));
    if (!o) return false;
  }
  s.moves++;
  return true;
}
