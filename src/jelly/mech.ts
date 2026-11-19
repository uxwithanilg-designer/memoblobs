// Momo Jelly Jam concept passes. After a stage is built backwards (and its route proven), each of the stage's ideas
// is added on top:
//   insert  — keeps the proven route: doors, switches, keys and locks, hazards on cells the route never rests on, gate
//             variants (numbered, cycling, deep, weight, fake…), timers fitted to when things really happen. The
//             route is replayed with the real rules after every change; a change that breaks it is undone and tried
//             elsewhere.
//   post    — like insert, but after the route is final (limits, exit orders, countdowns, kings, keepers…).
//   resolve — ideas that move things on their own (gravity, wind, magnets, Kranky's jelly, wrap, echo…): added, then
//             the solver proves the stage again and its route becomes the solution.
//   view    — looks and input twists that never change what is legal (fog, neon, mirror input, the tray turning…).
//   layout  — built straight into the board by gen.ts (walls, shapes, special blocks, pads, belts, paint).
//   meta    — taught by a card only (helpers, core rules, colour symbols).
import { CONCEPT } from "./data/concepts";
import type { Rng } from "../roll/rng";
import { apply, bounds, cellsOf, forget, isClear, newState } from "./rules";
import { legal, solve } from "./solver";
import { CELL, CRATE, DX, DY, GOLD, PLAIN_COLOURS, STONE, TILE, type Cond, type Dir, type Door, type DoorLook, type Gate, type Level, type Move, type Piece, type State } from "./types";
import type { Recipe } from "./gen";

export type MechClass = "layout" | "insert" | "post" | "resolve" | "view" | "meta";

const list = (s: string) => s.split(/\s+/).filter(Boolean);
const META = list(`C01 C07 R01 R03 R29 F09 H01 H02 H03 H04 H05 H06 H07 H08 H09 H10 H11 H12 H13 H14 H15 W01 W02 W03 W04 W05 W06 W07 W08 W09 W10 W11 W12 W13 W14 W15 W16 W17 W18 W19 W20 B01 F01 G01`);
const LAYOUT = list(`B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B13 B14 B15 B16 B17 B18 B19 B20 B21 B22 B26 B27 B28 S17
  P01 P02 P03 P04 P05 P06 P07 P08 P09 P10 P11 P12 P13 P14 P15 P16 P17 P18 P19 P20 P21 P22 P23 P24 P25 P26 P27 P28 P29 P30
  F02 F12 F13 F14 C08 M18 G02 G03 G04 G05 G07 G10 G12 G16 G20 G25 G26 G30 T01 T02 T03 T06 T07 T11 T24 M03 M27 M04 M05 M06 M22 M23
  J01 J02 J03 J04 J12 J25 J26 J27 J28 O15 O21 O24 O34 C02 C03 C04 C05 C06 C17 C18 C19 C25 J19 K14 K16 R15 R16 R17 R18`);
const POST = list(`R02 R04 R05 R06 R07 R11 R12 R19 R22 R23 C16 C20 C23 O31 O35 K15 J08 J29 J31 K11 F04 F08 F16 F20 S22 F26 R10 R27 R09 K08`);
const RESOLVE = list(`S01 S02 S07 S08 S10 S13 S25 S09 S14 S04 S18 S21 S23 J30 J11 B30 O07 J33 J06 T29 S11 M09 M10 M01 M30 F17 J20 F18 T28 J09 J35 K18 K12 K09 M14 M13
  J24 J15 F29 F28 S03 M26 R25 G34 M17 G28 F30 T25 T13 T14 T15 F10 F11 M20 J23 J32 F22 C14 C09 F23 F24 M19 J22 F27 G13 G14 M28 R13 R14`);
const VIEW = list(`T34 T35 O17 B29 K13 R20 R21 C11 C12 C21 C22 C24 C10 F03 R30 K10 S05 S06 S20 J10 S19 J13`);
export const CLASS: Record<string, MechClass> = {};
for (const c of Object.keys(CONCEPT)) CLASS[c] = "insert";
for (const [cls, ids] of [["meta", META], ["layout", LAYOUT], ["post", POST], ["resolve", RESOLVE], ["view", VIEW]] as const) for (const c of ids) CLASS[c] = cls;

/** ideas that can't share a stage */
const GROUPS: string[][] = [
  list("B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B13 B14 B16 B17 B18 B19 B20 B21 B22 B27 B28 B29 S17 B24 B25"),
  RESOLVE,
  list("C21 C22 C11 C24"),
  list("R04 R05 C16 O31 O35 K15 C23 G35 G18 G19 R06 R07 R13 R14 R15 R16 R17 R18 J29"),
  list("R02 R19 R09 K08 S22"),
  list("C04 C05 C25 C06 F12 C08 M18 G10"),
  list("B15 B16 K16 P29 P12 P14"),
  list("F02 F12 C08 M18 R15 R16 R17 R18 F05 F06 F07"),
  list("R30 K10 S05 S06"),
  list("T34 O17 B29 K13 R20 T35 J13"),
];
export function compatibleAtoms(atoms: string[]) {
  if (!atoms.length) return false;
  for (const g of GROUPS) if (atoms.filter((a) => g.includes(a)).length > 1) return false;
  return true;
}

export function shuffle<T>(a: T[], rng: Rng) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rng.int(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** replay a route with the real rules: every drop legal, and the tray cleared at the end → the route (no-op drops removed) */
export function verify(L: Level, route: Move[]): Move[] | null {
  let s = newState(L);
  const out: Move[] = [];
  for (const m of route) {
    const p = s.pieces.find((q) => q.id === m.id);
    if (p && p.x === m.x && p.y === m.y) continue;
    if (!legal(L, s, m)) return null;
    const r = apply(L, s, m);
    if (!r || r.s.lost) return null;
    s = r.s;
    out.push(m);
    if (isClear(L, s)) break;
  }
  return isClear(L, s) ? out : null;
}

// ---------------------------------------------------------------- what the route does
interface Trace {
  T: number;
  /** piece id on each cell after t moves (0 = none), t = 0 … T; exiting blocks count for the move they leave on */
  occ: Int32Array[];
  /** the moved jelly after move t (index t − 1): id, colour, cells, size, direction */
  mv: { id: number; color: number; cells: number[]; size: number; dir: number; land: number[] }[];
  exits: { t: number; gate: number; color: number; id: number; parts: number; cells: number; depth: number; dir: number }[];
  squish: { t: number; cells: number[]; color: number }[];
  /** first / every move of each starting jelly id */
  first: Map<number, number>; moves: Map<number, number[]>;
  /** starting jelly id → the move its block leaves on */
  fate: Map<number, number>;
  turns: number;
}
function traceOf(L: Level): Trace | null {
  let s = newState(L);
  const N = L.W * L.H;
  const grid = (st: typeof s) => { const o = new Int32Array(N); for (const p of st.pieces) for (const ci of cellsOf(L, p)) o[ci] = p.id; return o; };
  const tr: Trace = { T: L.solution.length, occ: [grid(s)], mv: [], exits: [], squish: [], first: new Map(), moves: new Map(), fate: new Map(), turns: 0 };
  const alias = new Map<number, number>(L.pieces.map((p) => [p.id, p.id]));
  for (let t = 1; t <= L.solution.length; t++) {
    const m = L.solution[t - 1];
    const before = s.pieces.find((p) => p.id === m.id);
    const r = apply(L, s, m);
    if (!r || !before) return null;
    s = r.s;
    const o = grid(s);
    for (const e of r.ev) {
      if (e.t === "merge") {
        for (const [k, v] of alias) if (e.ids.includes(v)) alias.set(k, e.piece.id);
        tr.squish.push({ t, cells: cellsOf(L, e.piece), color: e.piece.color });
      } else if (e.t === "exit") {
        for (const ci of cellsOf(L, e.piece)) o[ci] = e.piece.id;
        for (const [k, v] of alias) if (v === e.id) tr.fate.set(k, t);
        const b = bounds(e.piece.c), g = L.gates[e.gate];
        tr.exits.push({ t, gate: e.gate, color: e.piece.color, id: e.id, parts: e.piece.parts, cells: e.piece.c.length >> 1, depth: g.side === 1 || g.side === 3 ? b.w : b.h, dir: s.dir });
      } else if (e.t === "turn") tr.turns++;
    }
    tr.occ.push(o);
    const moved = s.pieces.find((p) => p.id === m.id) ?? r.ev.filter((e) => e.t === "merge").map((e) => (e as { piece: Piece }).piece).pop();
    const cells = moved ? cellsOf(L, moved) : [];
    tr.mv.push({ id: m.id, color: before.color, cells, size: before.c.length >> 1, dir: s.dir, land: cellsOf(L, { ...before, x: m.x, y: m.y }) });
    if (!tr.first.has(m.id)) tr.first.set(m.id, t);
    tr.moves.set(m.id, [...(tr.moves.get(m.id) ?? []), t]);
  }
  return tr;
}
/** times (0…T) a cell is occupied */
const usedTimes = (tr: Trace, ci: number) => { const a: number[] = []; for (let t = 0; t <= tr.T; t++) if (tr.occ[t][ci]) a.push(t); return a; };
const isFloor = (L: Level, ci: number) => L.walls[ci] === CELL.floor && L.tiles[ci] === TILE.floor && !L.doors?.some((d) => d.cells.includes(ci));
const neighbours = (L: Level, ci: number) => { const x = ci % L.W, y = (ci / L.W) | 0, out: number[] = []; for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (nx >= 0 && ny >= 0 && nx < L.W && ny < L.H) out.push(ny * L.W + nx); } return out; };

interface Ctx { rng: Rng; d: number; tr: Trace; r: Recipe }
type Handler = (L: Level, x: Ctx) => boolean;

// ---------------------------------------------------------------- small builders
const tv = (L: Level) => (L.tval ??= new Array(L.W * L.H).fill(0));
const setTile = (L: Level, ci: number, t: number, v = 0, d = 0) => { L.tiles[ci] = t; if (v) tv(L)[ci] = v; if (d) L.tdir[ci] = d; };
const nextHit = (L: Level) => {
  let m = -1;
  L.doors?.forEach((d) => { if (d.hit) m = Math.max(m, d.hit.i); });
  for (const p of L.pieces) if (p.f?.lock?.t === "hit") m = Math.max(m, p.f.lock.i);
  return m + 1;
};
const nextGroup = (L: Level) => { let g = -1; L.tiles.forEach((t, i) => { if (t === TILE.switch || t === TILE.plate || t === TILE.swap || t === TILE.tele) g = Math.max(g, tv(L)[i]); }); return g + 1; };
const addDoor = (L: Level, cells: number[], look: DoorLook, solid: Cond, hit?: Door["hit"]) => { (L.doors ??= []).push({ cells, look, solid, ...(hit ? { hit } : {}) }); return L.doors.length - 1; };
const not = (a: Cond): Cond => ({ t: "not", a });
const rules = (L: Level) => (L.rules ??= {});
const view = (L: Level) => (rules(L).view ??= {});
const pick = <T,>(a: T[], rng: Rng): T | undefined => (a.length ? a[rng.int(0, a.length - 1)] : undefined);
const setFlag = (L: Level, id: number, f: Piece["f"]) => { const p = L.pieces.find((q) => q.id === id); if (!p) return false; p.f = { ...(p.f ?? {}), ...f }; return true; };

/** how teaching went (for the QA sweeps) */
export const TEACH_STATS = { asked: 0, tries: 0, kept: 0, repaired: 0, solved: 0, ok: 0, fail: 0 };
/** while a stage teaches a new idea, the "spare" cells become the cells the proven route lands on, so play meets the idea */
let TEACH = false;
/** teaching shares one time limit per stage build (set by the builder) */
let TEACH_UNTIL = Infinity;
export function teachDeadline(t: number) { TEACH_UNTIL = t; }
/** set when a handler asked for spare cells (its idea was put where the route never goes) */
let ASKED_SPARE = false;
const landCells = (L: Level, tr: Trace) => { const out = new Set<number>(); for (const m of tr.mv) for (const ci of m.land) if (isFloor(L, ci)) out.add(ci); return [...out]; };
/** floor cells never used by the route (good for hazards and decoys) */
const neverUsed = (L: Level, tr: Trace) => {
  ASKED_SPARE = true;
  if (TEACH) return landCells(L, tr);
  const out: number[] = []; for (let ci = 0; ci < L.W * L.H; ci++) if (isFloor(L, ci) && !usedTimes(tr, ci).length) out.push(ci); return out;
};
/** what a player can see change: where every jelly is and what it looks like, blocks out, switches, keys, pickups, wear */
const bits = (a: number[]) => a.map((v, i) => (v ? `${i}:${v}` : "")).filter(Boolean).join(",");
const seen = (s: State) => s.pieces.map((p) => `${p.id}:${p.x},${p.y},${p.color},${p.c.join(".")}`).sort().join("|")
  + `#${s.out}#${s.sw}#${s.keys}#${s.got.join(",")}#${s.cov.join(",")}#${s.wear.join(",")}#${bits(s.hits)}#${s.coins}#${s.stars}#${s.falls}#${(s.gat ?? []).join(",")}`;
/** does playing this route on T (with the idea) go differently from playing it on base (without it)? */
function shows(T: Level, base: Level, route: Move[]): boolean {
  const ids = new Set(base.pieces.map((p) => p.id));
  const added = T.pieces.filter((p) => !ids.has(p.id)).map((p) => p.id);
  if (added.length) {
    // an added jelly (baby, Kranky's) shows when it moves, changes, merges or leaves along the route
    const key = (s: State) => added.map((id) => { const p = s.pieces.find((q) => q.id === id); return p ? `${p.x},${p.y},${p.color},${p.c.join(".")}` : "-"; }).join("|");
    let a = newState(T);
    const k0 = key(a);
    for (const m of route) { const r = apply(T, a, m); if (!r) return false; a = r.s; if (key(a) !== k0) return true; }
    return false;
  }
  let a = newState(T), b = newState(base);
  for (const m of route) {
    const ra = apply(T, a, m);
    if (!ra) return true;
    if (!legal(base, b, m)) return true; // only legal thanks to the idea (wrap, slippery floor…)
    const rb = apply(base, b, m);
    if (!rb) return true;
    a = ra.s; b = rb.s;
    if (seen(a) !== seen(b)) return true;
  }
  return false;
}
/** replace a level's contents in place */
function replaceLevel(L: Level, T: Level) {
  for (const k of Object.keys(L) as (keyof Level)[]) if (!(k in T)) delete L[k];
  Object.assign(L, T); forget(L);
}
/** floor cells first used at move ≥ t (and free before) */
const firstUsedAfter = (L: Level, tr: Trace, t: number) => { const out: number[] = []; for (let ci = 0; ci < L.W * L.H; ci++) { if (!isFloor(L, ci)) continue; const u = usedTimes(tr, ci); if (u.length && u[0] > t) out.push(ci); } return out; };
/** floor cells last used at move < t (free from t on) */
const lastUsedBefore = (L: Level, tr: Trace, t: number) => { const out: number[] = []; for (let ci = 0; ci < L.W * L.H; ci++) { if (!isFloor(L, ci)) continue; const u = usedTimes(tr, ci); if (u.length && u[u.length - 1] < t) out.push(ci); } return out; };
/** the cell a moved jelly newly covers on move t (switches, keys, coins…) */
const freshCell = (L: Level, tr: Trace, t: number) => { const m = tr.mv[t - 1]; if (!m) return -1; const c = m.cells.filter((ci) => isFloor(L, ci) && tr.occ[t - 1][ci] === 0); return c.length ? c[0] : -1; };

// ---------------------------------------------------------------- handlers
/** a door on cells first needed after move t, open from then on (opened by `cond`) */
function doorAfter(L: Level, x: Ctx, look: DoorLook, open: (t: number) => Cond, minT = 2): boolean {
  const ts = shuffle([...Array(Math.max(0, x.tr.T - minT)).keys()].map((k) => k + minT), x.rng);
  for (const t of ts.slice(0, 6)) {
    const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng);
    if (!cells.length) continue;
    const c0 = cells[0], group = [c0, ...neighbours(L, c0).filter((n) => cells.includes(n))].slice(0, 1 + x.rng.int(0, 1));
    addDoor(L, group, look, not(open(t)));
    return true;
  }
  return false;
}
/** a door on cells not needed any more after move t, closing then */
function doorClose(L: Level, x: Ctx, look: DoorLook, n = 1): boolean {
  for (let tries = 0; tries < 6; tries++) {
    const t = x.rng.int(1, Math.max(1, x.tr.T - 1));
    const cells = shuffle(lastUsedBefore(L, x.tr, t), x.rng).slice(0, n);
    if (!cells.length) continue;
    addDoor(L, cells, look, { t: "mv", n: t });
    return true;
  }
  return false;
}
/** a periodic door (blink walls, zap fences, crushers) on a cell the route uses now and then */
function doorBlink(L: Level, x: Ctx, look: DoorLook, m: number): boolean {
  const cells = shuffle([...Array(L.W * L.H).keys()].filter((ci) => isFloor(L, ci) && usedTimes(x.tr, ci).length > 0), x.rng);
  const ci = cells[0] ?? pick(neverUsed(L, x.tr), x.rng);
  if (ci === undefined) return false;
  addDoor(L, [ci], look, { t: "par", m, r: x.rng.int(0, m - 1) });
  return true;
}
/** a switch the route steps on at move t, and a door / gate that needs it after */
function withSwitch(L: Level, x: Ctx, hidden = false): { g: number; t: number } | null {
  for (let tries = 0; tries < 8; tries++) {
    const t = x.rng.int(1, Math.max(1, x.tr.T - 2));
    let ci = freshCell(L, x.tr, t);
    if (hidden) { const m = x.tr.mv[t - 1]; ci = m?.cells.find((c) => isFloor(L, c) && x.tr.occ[0][c] !== 0 && x.tr.occ[t - 1][c] === 0) ?? -1; }
    if (ci < 0) continue;
    // nobody else lands on it afterwards (that would flip it back)
    let again = false;
    for (let u = t + 1; u <= x.tr.T; u++) if (x.tr.occ[u][ci] && !x.tr.occ[u - 1][ci]) again = true;
    if (again) continue;
    const g = nextGroup(L);
    setTile(L, ci, TILE.switch, g || 0);
    if (!g) tv(L)[ci] = 0;
    return { g, t };
  }
  return null;
}
function gateFirstUse(tr: Trace, gi: number) { return tr.exits.find((e) => e.gate === gi)?.t ?? Infinity; }

const H: Record<string, Handler> = {};
// doors that open or close with time
H.B23 = (L, x) => doorBlink(L, x, "blink", 2);
H.O26 = (L, x) => doorBlink(L, x, "zap", 2);
H.M02 = (L, x) => doorBlink(L, x, "crusher", 3);
H.S12 = (L, x) => doorBlink(L, x, "wall", 5) && (doorBlink(L, x, "wall", 5) || true);
H.M12 = (L, x) => {
  const ci = pick(neverUsed(L, x.tr).filter((c) => neighbours(L, c).filter((n) => isFloor(L, n)).length >= 3), x.rng);
  if (ci === undefined) return false;
  neighbours(L, ci).filter((n) => isFloor(L, n)).forEach((n, k) => addDoor(L, [n], "arm", { t: "par", m: 4, r: k % 4 }));
  return true;
};
H.B24 = (L, x) => {
  const side = x.rng.int(0, 3), cells: number[] = [];
  for (let k = 0; k < (side % 2 ? L.H : L.W); k++) cells.push(side === 0 ? (L.H - 1) * L.W + k : side === 2 ? k : side === 1 ? k * L.W + L.W - 1 : k * L.W);
  const ok = cells.filter((ci) => isFloor(L, ci));
  const last = Math.max(0, ...ok.map((ci) => { const u = usedTimes(x.tr, ci); return u.length ? u[u.length - 1] : 0; }));
  if (last >= x.tr.T - 1) return false;
  addDoor(L, ok, "wall", { t: "mv", n: last + 1 });
  return true;
};
H.O22 = (L, x) => doorClose(L, x, "popcorn", 2);
H.O12 = (L, x) => doorClose(L, x, "vine", 3);
H.O18 = (L, x) => doorClose(L, x, "grumpy", 1);
H.K02 = (L, x) => doorClose(L, x, "wall", 2);
H.B25 = (L, x) => { const t = x.tr.exits[0]?.t; if (!t) return false; const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng).slice(0, 3); if (!cells.length) return false; addDoor(L, cells, "wall", not({ t: "out", n: 1 })); return true; };
H.M25 = (L, x) => doorAfter(L, x, "fuse", (t) => ({ t: "mv", n: t }));
H.T39 = (L, x) => { const ok = doorAfter(L, x, "stone", (t) => ({ t: "mv", n: t })); if (ok) { const d = L.doors![L.doors!.length - 1]; const near = neighbours(L, d.cells[0]).find((n) => isFloor(L, n) && !usedTimes(x.tr, n).length); if (near !== undefined) setTile(L, near, TILE.lamp); } return ok; };
H.O05 = (L, x) => doorAfter(L, x, "stone", (t) => ({ t: "mv", n: t }));
H.J17 = H.M25;
H.O03 = (L, x) => { const e = x.tr.exits[x.rng.int(0, Math.max(0, Math.min(1, x.tr.exits.length - 2)))]; if (!e) return false; const cells = shuffle(firstUsedAfter(L, x.tr, e.t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "wall", not({ t: "out", n: x.tr.exits.indexOf(e) + 1 })); return true; };
H.O20 = (L, x) => { const t = x.tr.exits[0]?.t; if (!t) return false; const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "tape", not({ t: "out", n: 1 })); return true; };
H.O23 = (L, x) => { const t = x.tr.exits[0]?.t; if (!t) return false; const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng).slice(0, 1); if (!cells.length) return false; addDoor(L, cells, "balloon", not({ t: "out", n: 1 })); return true; };
H.O10 = (L, x) => {
  const e = x.tr.exits[0]; if (!e) return false;
  const cells = shuffle(firstUsedAfter(L, x.tr, e.t), x.rng).slice(0, 1); if (!cells.length) return false;
  addDoor(L, cells, "grumpy", not({ t: "out", n: 1, c: e.color })); return true;
};
H.K09 = (L, x) => H.O10(L, x) && (H.O10(L, x) || true);
// switches, plates and locks
H.T09 = (L, x) => { const sw = withSwitch(L, x); if (!sw) return false; const cells = shuffle(firstUsedAfter(L, x.tr, sw.t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "laser", not({ t: "sw", g: sw.g })); return true; };
H.O16 = H.T09;
H.O28 = (L, x) => { const sw = withSwitch(L, x, true); if (!sw) return false; const cells = shuffle(firstUsedAfter(L, x.tr, sw.t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "laser", not({ t: "sw", g: sw.g })); return true; };
H.O14 = (L, x) => {
  const sw = withSwitch(L, x); if (!sw) return false;
  const red = shuffle(lastUsedBefore(L, x.tr, sw.t), x.rng).slice(0, 2), blue = shuffle(firstUsedAfter(L, x.tr, sw.t), x.rng).slice(0, 2);
  if (!red.length || !blue.length) return false;
  addDoor(L, red, "red", { t: "sw", g: sw.g }); addDoor(L, blue, "blue", not({ t: "sw", g: sw.g })); return true;
};
H.M15 = (L, x) => H.O14(L, x);
H.M16 = (L, x) => { const sw = withSwitch(L, x); if (!sw) return false; const cells = shuffle(firstUsedAfter(L, x.tr, sw.t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "bridge", not({ t: "sw", g: sw.g })); return true; };
H.G17 = (L, x) => {
  const sw = withSwitch(L, x); if (!sw) return false;
  const gi = L.gates.findIndex((g, i) => g.kind !== "box" && gateFirstUse(x.tr, i) > sw.t);
  if (gi < 0) return false;
  L.gates[gi].need = { t: "sw", g: sw.g }; return true;
};
H.O13 = H.G17; H.M11 = H.G17;
H.T10 = (L, x) => {
  // a plate held down by a jelly for a while; a door that is only needed meanwhile
  for (const [id, ts] of shuffle([...x.tr.moves], x.rng)) {
    for (let k = 0; k < ts.length; k++) {
      const t1 = ts[k], t2 = (ts[k + 1] ?? x.tr.T + 1) - 1;
      if (t2 - t1 < 2) continue;
      const ci = freshCell(L, x.tr, t1);
      if (ci < 0 || x.tr.occ[t1][ci] !== id) continue;
      const door = shuffle([...Array(L.W * L.H).keys()].filter((c) => { if (!isFloor(L, c) || c === ci) return false; const u = usedTimes(x.tr, c); return u.length > 0 && u[0] > t1 && u[u.length - 1] <= t2; }), x.rng).slice(0, 1);
      if (!door.length) continue;
      const g = nextGroup(L);
      setTile(L, ci, TILE.plate, g); if (!g) tv(L)[ci] = 0;
      addDoor(L, door, "laser", not({ t: "plate", g }));
      return true;
    }
  }
  return false;
};
H.M24 = H.T10;
H.F19 = (L, x) => { const t = x.tr.squish[0]?.t; if (!t) return false; const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng).slice(0, 2); if (!cells.length) return false; addDoor(L, cells, "laser", not({ t: "sq", n: 1 })); return true; };
H.T36 = (L, x) => {
  const last = x.tr.exits[x.tr.exits.length - 1]; if (!last) return false;
  let n = 0;
  for (const t of shuffle([...Array(last.t - 1).keys()].map((k) => k + 1), x.rng)) { const ci = freshCell(L, x.tr, t); if (ci < 0 || L.tiles[ci] !== TILE.floor) continue; setTile(L, ci, TILE.target); if (++n >= 2 + x.rng.int(0, 1)) break; }
  if (!n) return false;
  L.gates[last.gate].need = { t: "cov" };
  return true;
};
const keyAt = (L: Level, x: Ctx, before: number, colour: number) => {
  for (const t of shuffle([...Array(Math.max(0, before - 1)).keys()].map((k) => k + 1), x.rng)) { const ci = freshCell(L, x.tr, t); if (ci < 0 || L.tiles[ci] !== TILE.floor) continue; setTile(L, ci, TILE.key, colour < 0 ? 0 : colour); if (colour < 0) tv(L)[ci] = -1; return true; }
  return false;
};
H.G06 = (L, x) => {
  const gi = L.gates.findIndex((g, i) => g.kind !== "box" && !g.need && gateFirstUse(x.tr, i) > 2);
  if (gi < 0) return false;
  if (!keyAt(L, x, gateFirstUse(x.tr, gi), -1)) return false;
  L.gates[gi].need = { t: "key", c: -1 }; return true;
};
H.T21 = H.G06;
H.O02 = (L, x) => {
  const cand = shuffle(L.pieces.filter((p) => (x.tr.first.get(p.id) ?? 0) > 2 && p.color < 8 && !p.f?.lock), x.rng)[0];
  if (!cand) return false;
  if (!keyAt(L, x, x.tr.first.get(cand.id)!, cand.color)) return false;
  return setFlag(L, cand.id, { lock: { t: "key", c: cand.color } });
};
H.O27 = (L, x) => H.O02(L, x) && H.G06(L, x);
H.O11 = (L, x) => {
  const cand = shuffle(L.pieces.filter((p) => (x.tr.first.get(p.id) ?? 0) > 2 && !p.f?.lock), x.rng)[0];
  if (!cand) return false;
  const f = x.tr.first.get(cand.id)!;
  for (let tries = 0; tries < 6; tries++) {
    const t = x.rng.int(1, f - 1), ci = freshCell(L, x.tr, t);
    if (ci < 0 || L.tiles[ci] !== TILE.floor) continue;
    const g = nextGroup(L); setTile(L, ci, TILE.switch, g); if (!g) tv(L)[ci] = 0;
    return setFlag(L, cand.id, { lock: { t: "sw", g } });
  }
  return false;
};
H.K05 = H.O11;
/** a sleeper / ice block: woken by a jelly landing next to it before its first move */
H.O01 = (L, x) => {
  for (const p of shuffle(L.pieces.filter((q) => (x.tr.first.get(q.id) ?? 0) > 1 && !q.f?.lock), x.rng)) {
    const f = x.tr.first.get(p.id)!, mine = cellsOf(L, p);
    for (let t = 1; t < f; t++) {
      const m = x.tr.mv[t - 1];
      if (m.cells.some((ci) => mine.some((c) => neighbours(L, c).includes(ci)))) return setFlag(L, p.id, { lock: { t: "hit", i: nextHit(L), n: 1 } });
    }
  }
  return false;
};
H.J34 = H.O01; H.M29 = H.O01;
const hitDoor = (L: Level, x: Ctx, size: number, n: number, look: DoorLook, colourOnly: boolean) => {
  for (const t of shuffle([...Array(x.tr.T).keys()].map((k) => k + 1), x.rng)) {
    const m = x.tr.mv[t - 1];
    if (m.size < size) continue;
    const ring = new Set(m.cells.flatMap((ci) => neighbours(L, ci)));
    const cells = firstUsedAfter(L, x.tr, t).filter((ci) => ring.has(ci));
    if (!cells.length) continue;
    const i = nextHit(L);
    addDoor(L, cells.slice(0, 1), look, not({ t: "hit", i, n }), { i, size, ...(colourOnly ? { color: m.color } : {}) });
    return true;
  }
  return false;
};
H.J21 = (L, x) => hitDoor(L, x, 1, 1, "laser", true);
H.O04 = (L, x) => hitDoor(L, x, 3, 1, "crate", false);
H.O06 = (L, x) => hitDoor(L, x, 1, 2, "glass", false) || hitDoor(L, x, 1, 1, "glass", false);
H.O33 = (L, x) => hitDoor(L, x, 2, 1, "domino", false);
H.R24 = (L, x) => {
  const half = Math.ceil(x.tr.exits.length / 2); if (x.tr.exits.length < 2) return false;
  const late = new Set(x.tr.exits.slice(half).map((e) => e.gate)), early = new Set(x.tr.exits.slice(0, half).map((e) => e.gate));
  const gates = [...late].filter((g) => !early.has(g));
  if (!gates.length) return false;
  for (const gi of gates) L.gates[gi].need = { t: "out", n: half };
  return true;
};
H.K19 = H.R24;
H.G31 = (L, x) => {
  const last = x.tr.exits[x.tr.exits.length - 1]; if (!last) return false;
  const g = L.gates[last.gate];
  if (x.tr.exits.some((e) => e.gate === last.gate && x.tr.exits.some((o) => o.color !== e.color && o.t > e.t))) return false;
  g.need = { t: "rest", c: last.color }; return true;
};
H.K17 = (L, x) => H.G31(L, x);
H.G29 = (L, x) => {
  const e0 = x.tr.exits[0]; if (!e0) return false;
  const gi = L.gates.findIndex((g, i) => g.kind !== "box" && gateFirstUse(x.tr, i) > e0.t && g.color !== e0.color);
  if (gi < 0) return false;
  L.gates[gi].need = { t: "out", n: 1, c: e0.color }; return true;
};
const coinsBefore = (L: Level, x: Ctx, before: number, n: number) => {
  let k = 0;
  for (const t of shuffle([...Array(Math.max(0, before - 1)).keys()].map((q) => q + 1), x.rng)) { const ci = freshCell(L, x.tr, t); if (ci < 0 || L.tiles[ci] !== TILE.floor) continue; setTile(L, ci, TILE.coin); if (++k >= n) break; }
  return k;
};
H.G22 = (L, x) => {
  const gi = L.gates.findIndex((g, i) => g.kind !== "box" && !g.need && gateFirstUse(x.tr, i) > 2);
  if (gi < 0) return false;
  const k = coinsBefore(L, x, gateFirstUse(x.tr, gi), 2);
  if (!k) return false;
  L.gates[gi].need = { t: "coins", n: k }; return true;
};
H.T33 = (L, x) => {
  const t = x.rng.int(2, Math.max(2, x.tr.T - 1));
  const k = coinsBefore(L, x, t, 1); if (!k) return false;
  const cells = shuffle(firstUsedAfter(L, x.tr, t), x.rng).slice(0, 1); if (!cells.length) return false;
  addDoor(L, cells, "tape", not({ t: "coins", n: 1 })); return true;
};
H.T20 = (L, x) => { const c = shuffle(neverUsed(L, x.tr), x.rng).slice(0, 2 + x.rng.int(0, 2)); c.forEach((ci) => setTile(L, ci, TILE.coin)); return c.length > 0; };
H.R26 = H.T20;
H.T19 = (L, x) => { let n = 0; for (const t of shuffle([...Array(x.tr.T).keys()].map((k) => k + 1), x.rng)) { const ci = freshCell(L, x.tr, t); if (ci < 0 || L.tiles[ci] !== TILE.floor) continue; setTile(L, ci, TILE.star); if (++n >= 3) break; } return n > 0; };
H.R08 = H.T19;
H.G32 = (L, x) => { const e = pick(x.tr.exits, x.rng); if (!e) return false; L.gates[e.gate].star = true; return true; };
// gate variants
H.G09 = (L, x) => { const gi = L.gates.findIndex((g, i) => g.kind !== "box" && x.tr.exits.filter((e) => e.gate === i).length === 1); if (gi < 0) return false; L.gates[gi].count = 1; return true; };
H.G11 = (L, x) => { const gi = pick(L.gates.map((g, i) => i).filter((i) => L.gates[i].kind === undefined && L.gates[i].color < 8), x.rng); if (gi === undefined) return false; L.gates[gi].kind = "rainbow"; return true; };
const sameAll = <T,>(a: T[]) => a.every((v) => v === a[0]);
H.G27 = (L, x) => { for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) { const ex = x.tr.exits.filter((e) => e.gate === gi); if (!ex.length || L.gates[gi].side === 4 || !sameAll(ex.map((e) => e.depth))) continue; L.gates[gi].h = ex[0].depth; return true; } return false; };
H.F15 = H.G27;
H.G33 = (L, x) => { for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) { const ex = x.tr.exits.filter((e) => e.gate === gi); if (!ex.length || !sameAll(ex.map((e) => e.parts))) continue; L.gates[gi].parts = ex[0].parts; return true; } return false; };
H.J14 = H.G33;
H.F25 = (L, x) => { for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) { const ex = x.tr.exits.filter((e) => e.gate === gi); if (!ex.length || !sameAll(ex.map((e) => e.cells))) continue; L.gates[gi].area = ex[0].cells; return true; } return false; };
H.G18 = (L, x) => {
  const firsts = L.gates.map((_, i) => ({ i, t: gateFirstUse(x.tr, i) })).filter((g) => Number.isFinite(g.t) && L.gates[g.i].kind !== "box").sort((a, b) => a.t - b.t);
  if (firsts.length < 2) return false;
  firsts.forEach((g, k) => { L.gates[g.i].order = k + 1; });
  return true;
};
H.G35 = (L, x) => {
  for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) { const ex = x.tr.exits.filter((e) => e.gate === gi); if (ex.length < 2 && L.gates[gi].also === undefined) continue; if (!ex.length) continue; L.gates[gi].queue = ex.map((e) => e.color); return true; }
  return false;
};
H.G19 = H.G35;
const parityGate = (L: Level, x: Ctx, set: (g: Gate, phase: number) => void) => {
  for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) {
    const ex = x.tr.exits.filter((e) => e.gate === gi);
    if (!ex.length || L.gates[gi].kind === "box" || !sameAll(ex.map((e) => e.t % 2))) continue;
    set(L.gates[gi], ex[0].t % 2);
    return true;
  }
  return false;
};
H.G08 = (L, x) => parityGate(L, x, (g, ph) => { g.blink = true; g.phase = ph; });
H.G15 = (L, x) => parityGate(L, x, (g, ph) => { const other = PLAIN_COLOURS.filter((c) => c !== g.color && c !== 4)[x.rng.int(0, 5)]; g.cycle = [g.color, other]; g.phase = ph; });
H.G21 = (L, x) => { for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) { const ex = x.tr.exits.filter((e) => e.gate === gi); if (!ex.length || ex[0].dir < 0 || !sameAll(ex.map((e) => e.dir)) || L.gates[gi].side === 4) continue; L.gates[gi].dirIn = ex[0].dir as Dir; return true; } return false; };
/** a free spot on the frame for a gate of width w */
function frameSpot(L: Level, w: number, rng: Rng): [Dir, number] | null {
  for (let t = 0; t < 30; t++) {
    const side = rng.int(0, 3) as Dir, len = side % 2 ? L.H : L.W;
    if (w > len - 1) continue;
    const at = rng.int(0, len - w);
    if (L.gates.some((g) => g.side === side && at < g.at + g.w + 1 && g.at < at + w + 1)) continue;
    return [side, at];
  }
  return null;
}
H.G23 = (L, x) => {
  const real = pick(L.gates.filter((g) => g.side !== 4 && g.kind === undefined), x.rng); if (!real) return false;
  const spot = frameSpot(L, real.w, x.rng); if (!spot) return false;
  L.gates.push({ side: spot[0], at: spot[1], w: real.w, color: real.color, count: 99, kind: "fake" });
  return true;
};
H.K06 = (L, x) => H.G23(L, x) && (H.G23(L, x) || true);
H.K07 = (L, x) => {
  for (const gi of shuffle(L.gates.map((_, i) => i), x.rng)) {
    const g = L.gates[gi], t = gateFirstUse(x.tr, gi);
    if (g.side === 4 || g.kind || !Number.isFinite(t) || t < 3) continue;
    const len = g.side % 2 ? L.H : L.W;
    const alts = [...Array(len - g.w + 1).keys()].filter((a) => a !== g.at && !L.gates.some((h, hi) => hi !== gi && h.side === g.side && a < h.at + h.w + 1 && h.at < a + g.w + 1));
    const at = pick(alts, x.rng); if (at === undefined) continue;
    const n = x.rng.int(1, t - 1);
    (rules(L).events ??= []).push({ at: n, t: "gates", moves: [[gi, g.at]] });
    g.at = at;
    return true;
  }
  return false;
};
// hazards and helpers on the floor
const onNever = (t: number, n = 2, val = 0) => (L: Level, x: Ctx) => { const c = shuffle(neverUsed(L, x.tr), x.rng).slice(0, n); c.forEach((ci) => setTile(L, ci, t, val)); return c.length > 0; };
H.T04 = onNever(TILE.ice, 3); H.J18 = onNever(TILE.ice, 2);
H.T05 = onNever(TILE.mud, 3);
H.T16 = onNever(TILE.bumper, 2); H.S15 = onNever(TILE.bumper, 3);
H.T17 = onNever(TILE.spring, 2);
H.T40 = onNever(TILE.rewind, 2);
H.O30 = onNever(TILE.bouncer, 2);
H.T12 = onNever(TILE.rinse, 2);
H.O19 = onNever(TILE.splash, 2);
H.T18 = onNever(TILE.bubble, 2);
H.R28 = (L, x) => { const ok = onNever(TILE.trap, 3)(L, x); if (ok) rules(L).lives = 3; return ok; };
H.T08 = (L, x) => {
  const c = shuffle(neverUsed(L, x.tr), x.rng);
  const a = c[0], b = c.find((ci) => Math.abs((ci % L.W) - (a % L.W)) + Math.abs(((ci / L.W) | 0) - ((a / L.W) | 0)) >= 3);
  if (a === undefined || b === undefined) return false;
  const g = nextGroup(L) || 1;
  setTile(L, a, TILE.tele, g); setTile(L, b, TILE.tele, g); return true;
};
H.M21 = H.T08; H.M07 = H.T08; H.M08 = H.T08; H.S16 = H.T08; H.T30 = H.T08; H.G24 = H.T08;
H.T22 = (L, x) => { const c = shuffle([...Array(L.W * L.H).keys()].filter((ci) => isFloor(L, ci) && usedTimes(x.tr, ci).length > 0), x.rng).slice(0, 3); c.forEach((ci) => setTile(L, ci, TILE.crumble)); return c.length > 0; };
H.T23 = (L, x) => { const c = shuffle([...Array(L.W * L.H).keys()].filter((ci) => isFloor(L, ci) && usedTimes(x.tr, ci).length > 0), x.rng).slice(0, 3); c.forEach((ci) => setTile(L, ci, TILE.glass)); return c.length > 0; };
H.O29 = H.T22;
H.T26 = (L, x) => { const ci = pick([...Array(L.W * L.H).keys()].filter((c) => isFloor(L, c)), x.rng); if (ci === undefined) return false; setTile(L, ci, TILE.counter, 2 + x.rng.int(0, 2)); return true; };
const snare = (v: number) => (L: Level, x: Ctx) => {
  for (const [id, ts] of shuffle([...x.tr.moves], x.rng)) for (let k = 0; k < ts.length; k++) {
    const t = ts[k], next = ts[k + 1] ?? Infinity;
    if (next - t <= v) continue;
    const ci = freshCell(L, x.tr, t);
    if (ci < 0 || x.tr.occ[t][ci] !== id || L.tiles[ci] !== TILE.floor) continue;
    setTile(L, ci, TILE.snare, v); return true;
  }
  return false;
};
H.T27 = snare(2); H.O09 = snare(1); H.O25 = snare(1); H.O32 = snare(1); H.S24 = snare(2);
/** wash / charge / pop: the jelly starts dirty (flat battery, in a bubble) and gets clean on its last landing */
const cleanUp = (flag: "dirty" | "battery" | "bubble", tile: number) => (L: Level, x: Ctx) => {
  for (const p of shuffle(L.pieces.filter((q) => x.tr.moves.has(q.id) && !q.f && q.color < 8), x.rng)) {
    const ts = x.tr.moves.get(p.id)!, t = ts[ts.length - 1];
    const cells = x.tr.mv[t - 1].cells.filter((ci) => L.tiles[ci] === TILE.floor && L.walls[ci] === CELL.floor);
    const ci = pick(cells, x.rng); if (ci === undefined) continue;
    setTile(L, ci, tile);
    return setFlag(L, p.id, { [flag]: true });
  }
  return false;
};
H.T37 = cleanUp("dirty", TILE.wash); H.T38 = cleanUp("battery", TILE.charger);
H.O08 = cleanUp("bubble", TILE.thorns); H.F21 = cleanUp("bubble", TILE.thorns);
H.T31 = (L, x) => {
  for (let tries = 0; tries < 6; tries++) {
    const t = x.rng.int(1, x.tr.T), m = x.tr.mv[t - 1];
    const ci = pick(m.cells.filter((c) => L.tiles[c] === TILE.floor && x.tr.occ[t - 1][c] === 0), x.rng);
    if (ci === undefined || m.color >= 8) continue;
    setTile(L, ci, TILE.filterC, m.color); if (!m.color) tv(L)[ci] = 0;
    return true;
  }
  return false;
};
H.T32 = (L, x) => { const c = shuffle(neverUsed(L, x.tr), x.rng).slice(0, 2); c.forEach((ci) => setTile(L, ci, TILE.filterS, 1)); return c.length > 0; };
H.F05 = (L, x) => {
  if (!x.tr.squish.length) return false;
  for (const s of x.tr.squish) { const ci = s.cells.find((c) => L.tiles[c] === TILE.floor); if (ci === undefined) return false; setTile(L, ci, TILE.glue); }
  rules(L).glue = true; return true;
};
H.F06 = H.F05;
H.F07 = (L, x) => { const inSq = new Set(x.tr.squish.flatMap((s) => s.cells)); const c = shuffle(neverUsed(L, x.tr).filter((ci) => !inSq.has(ci)), x.rng).slice(0, 3); c.forEach((ci) => setTile(L, ci, TILE.nosquish)); return c.length > 0; };
H.T35 = (L, x) => { const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false; setTile(L, ci, TILE.lamp); fogOver(L, x, 0.5); return true; };
// jellies
H.J16 = (L, x) => { for (const [id, ts] of shuffle([...x.tr.moves], x.rng)) if (ts.every((t) => (t - 1) % 2 === 0) && L.pieces.some((p) => p.id === id)) return setFlag(L, id, { lazy: true }); return false; };
H.J05 = (L, x) => { const p = pick(L.pieces.filter((q) => x.tr.moves.has(q.id) && !q.f), x.rng); return !!p && setFlag(L, p.id, { bouncy: true }); };
H.J07 = (L, x) => {
  // a jelly whose every landing touches only its own colour (or nothing), and whose last landing meets its partners:
  // it starts another colour and picks its own up when it lands next to them
  const colourOf = new Map(L.pieces.map((p) => [p.id, p.color]));
  for (const p of shuffle(L.pieces.filter((q) => q.color < 8 && !q.f && x.tr.moves.has(q.id)), x.rng)) {
    const ts = x.tr.moves.get(p.id)!;
    let ok = true, meets = false;
    for (const t of ts) {
      const m = x.tr.mv[t - 1], mine = new Set(m.land), cols = new Set<number>();
      for (const ci of m.land) for (const n of neighbours(L, ci)) { if (mine.has(n)) continue; const id = x.tr.occ[t - 1][n]; const c = id && id !== p.id ? colourOf.get(id) : undefined; if (c !== undefined && c < 8) cols.add(c); }
      if (cols.size > 1 || (cols.size === 1 && !cols.has(p.color))) { ok = false; break; }
      if (t === ts[ts.length - 1]) meets = cols.has(p.color);
    }
    if (!ok || !meets) continue;
    const other = PLAIN_COLOURS.filter((c) => c !== p.color && c !== 4 && c !== 0 && L.pieces.some((q) => q.color === c));
    const c = pick(other, x.rng); if (c === undefined) continue;
    p.color = c; p.f = { chameleon: true };
    return true;
  }
  return false;
};
H.C15 = (L, x) => { for (const p of shuffle(L.pieces.filter((q) => q.color < 8 && !q.f), x.rng)) { const g = pick(L.gates.filter((h) => h.color !== p.color && h.color < 8 && h.kind === undefined), x.rng); if (!g) continue; return setFlag(L, p.id, { alt: g.color }); } return false; };
H.C13 = (L, x) => kranksSwap(L, x);
H.K01 = H.C13;
function kranksSwap(L: Level, x: Ctx) {
  const ps = shuffle(L.pieces.filter((p) => p.color < 8 && (x.tr.first.get(p.id) ?? 0) > 2), x.rng);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (a.color === b.color) continue;
    const n = Math.min(x.tr.first.get(a.id)!, x.tr.first.get(b.id)!) - 1;
    if (n < 1) continue;
    const ca = a.color; a.color = b.color; b.color = ca;
    (rules(L).events ??= []).push({ at: n, t: "swap", a: a.id, b: b.id });
    return true;
  }
  return false;
}
H.K03 = (L, x) => {
  const groups = new Map<number, Piece[]>();
  for (const p of L.pieces) if (p.color < 8 && (x.tr.first.get(p.id) ?? 0) > 2) groups.set(p.color, [...(groups.get(p.color) ?? []), p]);
  for (const [c, ps] of shuffle([...groups], x.rng)) {
    const n = Math.min(...ps.map((p) => x.tr.first.get(p.id)!)) - 1;
    const wrong = PLAIN_COLOURS.find((k) => k !== c && k !== 4 && !L.pieces.some((p) => p.color === k));
    if (wrong === undefined || n < 1) continue;
    for (const p of ps) p.color = wrong;
    (rules(L).events ??= []).push({ at: n, t: "paint", ids: ps.map((p) => p.id), color: c });
    return true;
  }
  return false;
};
H.K04 = (L, x) => {
  for (const [id, ts] of shuffle([...x.tr.moves], x.rng)) for (let k = 0; k + 1 < ts.length; k++) {
    if (ts[k + 1] - ts[k] < 4) continue;
    (rules(L).events ??= []).push({ at: ts[k] + 1, t: "freeze", id, until: ts[k] + 3 });
    return true;
  }
  return false;
};
H.K20 = (L, x) => [H.G23, H.T09, H.K04, H.O10].filter((h) => h(L, x)).length >= 2;
// post: limits, orders, timers, kings and keepers
H.R02 = (L, x) => { rules(L).limit = L.par + (x.d < 0.6 ? 3 : 2); return true; };
H.R19 = (L) => { rules(L).limit = L.par; return true; };
H.R09 = (L) => { rules(L).time = 25 + L.par * 7; return true; };
H.K08 = H.R09;
H.R10 = (L) => { rules(L).noUndo = true; return true; };
H.R27 = (L) => { rules(L).undoCost = 5; return true; };
H.R04 = (L, x) => { if (x.tr.exits.length < 2) return false; rules(L).ids = x.tr.exits.map((e) => e.id); return true; };
H.R05 = (L, x) => { if (new Set(x.tr.exits.map((e) => e.color)).size < 2) return false; rules(L).order = x.tr.exits.map((e) => e.color); return true; };
H.C16 = H.R05; H.O31 = H.R05; H.O35 = H.R05; H.K15 = H.R05; H.C23 = H.R05;
H.R11 = (L, x) => { if (x.tr.turns > 1 || !L.pads.length) return false; rules(L).oneTurn = true; return true; };
H.R12 = (L) => { rules(L).oneDrag = true; return true; };
H.R22 = (L, x) => {
  rules(L).noTouch = true;
  if (verify(L, L.solution)) return true;
  // too strict for this board: two colours that never meet on the route may not touch (a softer no-touch)
  delete rules(L).noTouch;
  return H.C20(L, x);
};
H.C20 = (L, x) => {
  const cols = [...new Set(L.pieces.map((p) => p.color).filter((c) => c < 8))];
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
    rules(L).clash = [cols[i], cols[j]];
    if (verify(L, L.solution)) return true;
  }
  delete rules(L).clash; void x; return false;
};
H.R23 = (L, x) => { if (x.tr.exits.length < 2) return false; let gap = 1; for (let k = 1; k < x.tr.exits.length; k++) gap = Math.max(gap, x.tr.exits[k].t - x.tr.exits[k - 1].t); rules(L).combo = gap; return true; };
H.F26 = H.R23;
H.S22 = (L, x) => { let gap = x.tr.exits[0]?.t ?? x.tr.T; for (let k = 1; k < x.tr.exits.length; k++) gap = Math.max(gap, x.tr.exits[k].t - x.tr.exits[k - 1].t); rules(L).loop = gap + 1; return true; };
H.J08 = (L, x) => { const p = pick(L.pieces.filter((q) => x.tr.fate.has(q.id)), x.rng); if (!p) return false; return setFlag(L, p.id, { timer: x.tr.fate.get(p.id)! + (x.d < 0.7 ? 2 : 1) }); };
H.J31 = H.J08;
H.K11 = (L, x) => H.J08(L, x) && (H.J08(L, x) || true);
H.J29 = (L, x) => {
  const last = x.tr.exits[x.tr.exits.length - 1]; if (!last || x.tr.exits.length < 2) return false;
  const p = pick(L.pieces.filter((q) => x.tr.fate.get(q.id) === last.t), x.rng);
  return !!p && setFlag(L, p.id, { king: true });
};
H.R07 = (L, x) => {
  const ci = pick(neverUsed(L, x.tr).filter((c) => neighbours(L, c).every((n) => !usedTimes(x.tr, n).length)), x.rng);
  if (ci === undefined) return false;
  const c = pick([...new Set(L.pieces.map((p) => p.color).filter((k) => k < 8))], x.rng)!;
  L.pieces.push({ id: 800, color: c, c: [0, 0], x: ci % L.W, y: (ci / L.W) | 0, parts: 1, f: { keeper: true } });
  rules(L).keep = true;
  return true;
};
H.R06 = (L, x) => {
  if (x.tr.exits.length < 2) return false;
  const k = Math.max(1, Math.ceil(x.tr.exits.length / 2));
  const tEnd = x.tr.exits[k - 1].t;
  for (const p of L.pieces) if ((x.tr.fate.get(p.id) ?? Infinity) <= tEnd) p.f = { ...(p.f ?? {}), must: true };
  rules(L).some = true;
  L.solution = L.solution.slice(0, tEnd);
  return true;
};
H.F04 = (L) => { rules(L).once = true; for (const p of L.pieces) if (p.color < 8) p.f = { ...(p.f ?? {}), once: true }; return true; };
H.F16 = H.F04;
H.F08 = (L) => { rules(L).slowSet = true; return true; };
H.F20 = (L, x) => {
  let worst = 1;
  for (const e of x.tr.exits) { const born = x.tr.squish.filter((s) => s.t <= e.t && s.color === e.color).pop()?.t ?? e.t; worst = Math.max(worst, e.t - born + 1); }
  rules(L).setTime = worst + (x.d < 0.7 ? 1 : 0); return true;
};
// resolve: things that move on their own (the solver proves the stage again)
const R: Record<string, Handler> = {};
R.S01 = (L) => { rules(L).gravity = 2; return true; };
R.S02 = (L, x) => { rules(L).gravity = x.rng.int(0, 3) as Dir; return true; };
R.S07 = (L) => { rules(L).gravity = 0; return true; };
R.S08 = R.S07;
R.S10 = (L, x) => { rules(L).drift = x.rng.int(0, 3) as Dir; return true; };
R.S25 = R.S10;
R.S09 = (L) => { rules(L).slide = true; return true; };
R.S14 = R.S09;
R.S04 = (L) => { rules(L).wrap = 1; return true; };
R.S18 = (L) => { rules(L).wrap = 3; return true; };
R.S21 = (L) => { rules(L).echo = true; return true; };
R.S23 = (L) => { rules(L).crowd = true; return true; };
const flagSome = (f: Piece["f"], n = 1) => (L: Level, x: Ctx) => { const ps = shuffle(L.pieces.filter((p) => p.color < 8 && !p.f), x.rng).slice(0, n); ps.forEach((p) => { p.f = { ...f }; }); return ps.length > 0; };
R.J30 = flagSome({ leader: true });
R.J11 = (L, x) => {
  const ps = shuffle(L.pieces.filter((p) => p.color < 8 && !p.f), x.rng);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (ps[i].color === ps[j].color) { ps[j].f = { twin: ps[i].id }; return true; }
  if (ps.length >= 2) { ps[1].f = { twin: ps[0].id }; return true; }
  return false;
};
R.O07 = R.J11; R.J06 = R.J11;
R.B30 = (L, x) => { const ok = R.J11(L, x); const t = L.pieces.find((p) => p.f?.twin !== undefined); if (t?.f?.twin !== undefined) t.f.twin = -t.f.twin; return ok; };
R.J33 = flagSome({ copycat: true });
R.J24 = flagSome({ spinner: true });
R.J20 = flagSome({ magnet: true });
R.F17 = R.J20; R.F18 = flagSome({ magnet: true }, 2);
R.J09 = flagSome({ shy: true });
const kranky = (L: Level, x: Ctx) => { const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false; L.pieces.push({ id: 850, color: CRATE, c: [0, 0], x: ci % L.W, y: (ci / L.W) | 0, parts: 1, f: { kranky: true } }); return true; };
R.J35 = kranky; R.K18 = kranky; R.K12 = kranky; R.M14 = kranky; R.M13 = kranky; R.S13 = kranky;
R.K09 = (L, x) => H.O10(L, x);
R.J15 = (L, x) => { const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false; const c = pick(L.pieces.map((p) => p.color).filter((k) => k < 8), x.rng)!; L.pieces.push({ id: 860, color: c, c: [0, 0], x: ci % L.W, y: (ci / L.W) | 0, parts: 1, f: { baby: true } }); return true; };
R.F29 = (L, x) => onNever(TILE.stretch, 1)(L, x);
R.F28 = (L, x) => onNever(TILE.shrink, 1)(L, x);
const tileR = (t: number, n = 1, dir = false) => (L: Level, x: Ctx) => { const c = shuffle(neverUsed(L, x.tr), x.rng).slice(0, n); c.forEach((ci) => setTile(L, ci, t, 0, dir ? x.rng.int(0, 3) : 0)); return c.length > 0; };
R.T29 = (L, x) => { const c = shuffle(neverUsed(L, x.tr), x.rng); const a = c[0]; if (a === undefined) return false; const d = x.rng.int(0, 3); let ci = a; for (let k = 0; k < 3 && ci >= 0; k++) { setTile(L, ci, TILE.wind, 0, d); const nx = (ci % L.W) + DX[d], ny = ((ci / L.W) | 0) + DY[d]; ci = nx >= 0 && ny >= 0 && nx < L.W && ny < L.H && isFloor(L, ny * L.W + nx) ? ny * L.W + nx : -1; } return true; };
R.S11 = R.T29; R.M09 = R.T29; R.M10 = R.T29; R.M01 = R.T29; R.M30 = tileR(TILE.wind, 1, true);
R.T28 = tileR(TILE.magnet, 1);
R.S03 = tileR(TILE.tilt, 1, true); R.M26 = R.S03;
R.T25 = (L, x) => { const c = shuffle(neverUsed(L, x.tr), x.rng).slice(0, 2); if (c.length < 2) return false; const g = nextGroup(L) || 1; c.forEach((ci) => setTile(L, ci, TILE.swap, g)); return true; };
R.T13 = tileR(TILE.shrink); R.T14 = tileR(TILE.stretch); R.J32 = R.T14;
R.T15 = tileR(TILE.split); R.F10 = R.T15; R.F11 = R.T15; R.M20 = R.T15; R.J23 = R.T15; R.F22 = R.T15; R.C14 = R.T15; R.C09 = R.T15;
R.F30 = (L, x) => { const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false; setTile(L, ci, TILE.copy, 1); return true; };
R.F23 = (L) => { rules(L).spin = true; return true; };
R.F24 = (L, x) => { rules(L).blob = true; return tileR(TILE.press)(L, x); };
R.M19 = R.F24;
R.J22 = flagSome({ hungry: true }); R.F27 = R.J22;
R.R13 = (L, x) => { rules(L).buildFirst = Math.max(1, x.tr.squish.length); return true; };
R.R14 = R.R13;
R.R25 = (L, x) => {
  const g = pick(L.gates.filter((h) => h.side !== 4 && h.kind === undefined), x.rng); if (!g) return false;
  const side = g.side as Dir, c = side % 2 ? [...Array(g.w).keys()].flatMap((k) => [0, k]) : [...Array(g.w).keys()].flatMap((k) => [k, 0]);
  const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false;
  (rules(L).events ??= []).push({ at: 5, t: "drop", piece: { id: 0, color: GOLD, c, x: ci % L.W, y: (ci / L.W) | 0, parts: 1 } });
  return true;
};
const spawner = (L: Level, x: Ctx) => {
  const gi = L.gates.findIndex((g) => g.side !== 4 && g.kind === undefined); if (gi < 0) return false;
  const g = L.gates[gi], c = g.side % 2 ? [...Array(g.w).keys()].flatMap((k) => [0, k]) : [...Array(g.w).keys()].flatMap((k) => [k, 0]);
  const ci = pick(neverUsed(L, x.tr), x.rng); if (ci === undefined) return false;
  g.spawn = [{ id: 0, color: GOLD, c, x: ci % L.W, y: (ci / L.W) | 0, parts: 1 }];
  return true;
};
R.G34 = spawner; R.M17 = spawner; R.G28 = spawner;
R.G13 = (L, x) => { const g = pick(L.gates.filter((h) => h.side !== 4 && h.kind === undefined && !h.need), x.rng); if (!g) return false; const len = g.side % 2 ? L.H : L.W; const a = Math.max(0, g.at - 1), b = Math.min(len - g.w, g.at + 1); g.slide = [...new Set([g.at, b, g.at, a])]; return true; };
R.G14 = R.G13; R.M28 = R.G13;

// views: looks and input twists
const V: Record<string, (L: Level, x: Ctx) => void> = {};
function fogOver(L: Level, x: Ctx, share: number) {
  const vertical = x.rng.chance(0.5), cut = vertical ? Math.floor(L.W * share) : Math.floor(L.H * share);
  const cells: number[] = [];
  for (let ci = 0; ci < L.W * L.H; ci++) { const cx = ci % L.W, cy = (ci / L.W) | 0; if ((vertical ? cx : cy) >= (vertical ? L.W : L.H) - cut && L.walls[ci] !== CELL.wall) cells.push(ci); }
  view(L).fog = cells;
}
V.T34 = (L, x) => fogOver(L, x, 0.4); V.O17 = V.T34; V.B29 = (L, x) => fogOver(L, x, 0.5); V.K13 = (L, x) => fogOver(L, x, 0.6); V.J13 = (L, x) => { fogOver(L, x, 0.5); const p = pick(L.pieces.filter((q) => q.color < 8), x.rng); if (p) p.f = { ...(p.f ?? {}) }; };
V.T35 = (L, x) => fogOver(L, x, 0.5);
V.R20 = (L) => { view(L).peek = 5; }; V.R21 = (L) => { view(L).remember = 5; };
V.C11 = (L) => { view(L).mode = "night"; }; V.C21 = (L) => { view(L).mode = "bw"; }; V.C22 = (L) => { view(L).mode = "neon"; }; V.C24 = (L) => { view(L).mode = "tones"; };
V.C12 = (L, x) => { for (const p of shuffle(L.pieces.filter((q) => q.color < 8), x.rng).slice(0, 2)) p.f = { ...(p.f ?? {}), mystery: true }; };
V.C10 = (L) => { view(L).gold = true; }; V.F03 = (L) => { view(L).counters = true; };
V.R30 = (L) => { view(L).twistAt = Math.max(2, Math.floor(L.par / 2)); }; V.K10 = V.R30;
V.S05 = (L) => { view(L).flipEvery = 4; }; V.S06 = (L) => { view(L).spinEvery = 5; };
V.S20 = (L) => { view(L).delay = true; };
V.J10 = (L, x) => { const p = pick(L.pieces.filter((q) => q.color < 8 && !q.f?.kranky), x.rng); if (p) p.f = { ...(p.f ?? {}), contrary: true }; };
V.S19 = (L) => { rules(L).mirror = true; };

/** concepts with a pass of their own (for checks) */
export const HANDLED = new Set([...Object.keys(H), ...Object.keys(R), ...Object.keys(V)]);

/** run the stage's ideas on a built stage; false when a must-have idea won't fit (the builder tries another board) */
export function applyConcepts(L: Level, r: Recipe, rng: Rng, core: string[]): boolean {
  const want = [...new Set(r.focus)], extra = (r.extra ?? []).filter((c) => !want.includes(c));
  const done = new Set<string>();
  /** the idea this stage introduces (and a boss's own idea): its proven route must really meet it */
  const teaches = (c: string) => c === r.meet || (r.kind === "boss" && c === r.focus[0]);
  /** put the ideas on cells the route lands on, then prove the stage again; a few tries, about 1.5 s at most */
  /** play the old route on T until the idea first changes play, then let the solver finish from there (the idea stays in) */
  const repair = (T: Level, base: Level, seed: number, ms: number): Move[] | null => {
    let a = newState(T), b = newState(base);
    const pre: Move[] = [];
    for (const m of base.solution) {
      if (!legal(T, a, m)) return null;
      const ra = apply(T, a, m), rb = apply(base, b, m);
      if (!ra || !rb || ra.s.lost) return null;
      pre.push(m); a = ra.s; b = rb.s;
      if (seen(a) !== seen(b)) {
        if (isClear(T, a)) return pre;
        const sol = solve(T, a, { cap: 2000, weight: 1.6, seed, ms });
        return sol.ok ? verify(T, [...pre, ...sol.moves]) : null;
      }
    }
    return null;
  };
  const teach = (base: Level, hs: Handler[]): { T: Level; route: Move[] } | null => {
    if (Date.now() > TEACH_UNTIL) return null;
    const until = Math.min(Date.now() + 2200, TEACH_UNTIL);
    TEACH_STATS.asked++;
    for (let k = 0; k < 4 && Date.now() < until; k++) {
      TEACH_STATS.tries++;
      const tr = traceOf(base);
      if (!tr) return null;
      const T = cloneLevel(base);
      let ok = true;
      TEACH = true;
      try { for (const h of hs) if (!h(T, { rng, d: r.d, tr, r })) { ok = false; break; } } finally { TEACH = false; }
      if (!ok) continue;
      forget(T);
      let route = verify(T, T.solution);
      if (route && shows(T, base, route)) { TEACH_STATS.kept++; TEACH_STATS.ok++; return { T, route }; }
      route = repair(T, base, (L.seed ^ 0x7ead) + k, Math.max(300, until - Date.now()));
      if (route && shows(T, base, route)) { TEACH_STATS.repaired++; TEACH_STATS.ok++; return { T, route }; }
      if (Date.now() > until) break;
      const sol = solve(T, newState(T), { cap: 2000, weight: 1.6, seed: (L.seed ^ 0x7eac) + k, ms: Math.max(300, until - Date.now()) });
      route = sol.ok && sol.moves.length >= 2 ? verify(T, sol.moves) : null;
      if (route) TEACH_STATS.solved++;
      if (route && shows(T, base, route)) { TEACH_STATS.ok++; return { T, route }; }
    }
    TEACH_STATS.fail++;
    return null;
  };
  const tryInsert = (c: string, h: Handler, tries = 8): boolean => {
    const must = teaches(c);
    let spare: { T: Level; route: Move[] } | null = null;
    for (let t = 0; t < tries; t++) {
      const tr = traceOf(L);
      if (!tr) return false;
      const T = cloneLevel(L);
      ASKED_SPARE = false;
      if (!h(T, { rng, d: r.d, tr, r })) continue;
      const spareBased = ASKED_SPARE;
      const route = verify(T, T.solution);
      if (!route) continue;
      // a new idea put where the route never goes doesn't teach anything: look for a version the route meets
      if (must && spareBased && !shows(T, L, route)) { spare ??= { T, route }; if (t >= 1) break; continue; }
      replaceLevel(L, T); L.solution = route; L.par = route.length;
      return true;
    }
    const got = must ? teach(L, [h]) : null;
    const use = got ?? spare;
    if (!use) return false;
    replaceLevel(L, use.T); L.solution = use.route; L.par = use.route.length;
    return true;
  };
  // 1 · inserts (the route stays)
  for (const c of [...want, ...extra]) {
    if (CLASS[c] !== "insert") continue;
    const h = H[c];
    if (!h) { if (want.includes(c)) done.add(c); continue; }
    if (tryInsert(c, h)) done.add(c);
    else if (want.includes(c)) return false;
  }
  // 2 · resolves (the solver proves the stage again)
  const res = want.filter((c) => CLASS[c] === "resolve");
  if (res.length) {
    const tr = traceOf(L);
    if (!tr) return false;
    const base = cloneLevel(L);
    const hs: Handler[] = [];
    ASKED_SPARE = false;
    for (const c of res) { const h = R[c] ?? H[c]; if (!h || !h(L, { rng, d: r.d, tr, r })) return false; hs.push(h); done.add(c); }
    forget(L);
    // often the proven route still works (a tile it never lands on); otherwise the solver proves it again
    const kept = verify(L, L.solution);
    if (kept) { L.solution = kept; L.par = kept.length; }
    else {
      const sol = solve(L, newState(L), { cap: 1300, weight: 1.6, seed: L.seed ^ 0x77, ms: 1500 });
      if (!sol.ok || sol.moves.length < 2) return false;
      L.solution = sol.moves; L.par = sol.moves.length;
    }
    // a stage that introduces the idea must really use it
    if (res.some(teaches) && ASKED_SPARE && !shows(L, base, L.solution)) {
      const got = teach(base, hs);
      if (got) { replaceLevel(L, got.T); L.solution = got.route; L.par = got.route.length; }
    }
  }
  // 3 · post (fitted to the final route)
  for (const c of [...want, ...extra]) {
    if (CLASS[c] !== "post") continue;
    const h = H[c];
    if (!h) continue;
    if (tryInsert(c, h, 3)) done.add(c);
    else if (want.includes(c)) return false;
  }
  // 4 · looks
  const tr = traceOf(L);
  for (const c of [...want, ...extra]) {
    if (CLASS[c] !== "view" || !V[c] || !tr) continue;
    V[c](L, { rng, d: r.d, tr, r }); done.add(c);
  }
  forget(L);
  for (const c of want) if (CLASS[c] === "layout" || CLASS[c] === "meta") done.add(c);
  if (r.meet) done.add(r.meet);
  L.concepts = detect(L, [...done], core);
  return true;
}
function cloneLevel(L: Level): Level { return JSON.parse(JSON.stringify(L)) as Level; }

/** the concepts a finished stage really shows (for the Dex and the stage card) */
function detect(L: Level, done: string[], core: string[]): string[] {
  const out = new Set<string>([...core, ...done]);
  const sizes = new Set(L.pieces.map((p) => p.c.length >> 1));
  if (sizes.has(1)) out.add("P11");
  if (L.pads.some((p) => p.flip)) out.add("T03"); else if (L.pads.some((p) => p.ccw)) out.add("T02"); else if (L.pads.length) out.add("T01");
  if (L.tiles.some((t) => t === TILE.belt)) out.add("T06");
  if (L.tiles.some((t) => t === TILE.arrow)) out.add("T07");
  if (L.gates.some((g) => g.w >= 3 && g.side !== 4)) out.add("G02");
  if (L.gates.some((g) => g.w === 1)) out.add("G03");
  if (L.gates.some((g) => g.count > 1 && g.count < 99)) out.add("G07");
  if (L.gates.some((g) => g.also !== undefined)) out.add("G10");
  if (L.gates.some((g) => g.side === 4 && g.kind !== "box")) out.add("G30");
  const ncol = new Set(L.pieces.map((p) => p.color).filter((c) => c < 8)).size;
  if (ncol >= 3) out.add("C02");
  if (ncol >= 4) out.add("C03");
  if (ncol >= 5) out.add("C04");
  if (L.pieces.some((p) => p.color === STONE)) out.add("J02");
  if (L.pieces.some((p) => p.color === CRATE && !p.f?.kranky)) out.add("M05");
  if (L.walls.some((w) => w === CELL.pit)) out.add("B18");
  return [...out].filter((c) => CONCEPT[c]);
}
