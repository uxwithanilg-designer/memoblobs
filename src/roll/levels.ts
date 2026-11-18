// Level generator for Momo Sky Roll. A level = zones of segments laid on the music's beat grid; a compiler turns the
// concept ids of any Journey level (data/journey.ts) or Fusion recipe into zones; a dynamic-programming "par line"
// proves every level can be cleared (rerolling the seed until it can), lays the beads along a good line and hides the
// Golden Sprouts on risky spots.
import { CONCEPT } from "./data/concepts";
import { JOURNEY } from "./data/journey";
import { hazardHits, hazardReach } from "./hazards";
import { Rng, hash32 } from "./rng";
import { MOODS, worldOf } from "./themes";
import {
  TK, type CamMode, type Force, type Hazard, type HazardKind, type Jump, type Level, type LevelKind, type Pickup, type Row,
  type SectionKind, type Tile, type TileKind, type Tip, type Zone, type ZoneRules,
} from "./types";

export const TPB = 3.5;
export const LANES = 7;
const CLAMP_C = 3;

// ---------------------------------------------------------------- segment DSL
export interface Seg {
  k: string;
  b: number;
  w?: number; dx?: number; amp?: number; cyc?: number; step?: number; every?: number; w0?: number; w1?: number;
  n?: number; hard?: number; dens?: number; tile?: TileKind; pat?: string; skin?: string; arch?: HazardKind;
  mode?: "swing" | "saw" | "hop" | "static"; arms?: number; force?: Force["kind"]; ax?: number; period?: number; to?: number; ow?: number;
}
const S = (k: string, b: number, o: Partial<Seg> = {}): Seg => ({ k, b, ...o });

export interface ZoneRecipe {
  mood: string; section: SectionKind; intensity: number; segs: Seg[];
  style?: string; cam?: CamMode; rules?: ZoneRules; boss?: string; concept?: string; speed?: number;
}
export interface LevelRecipe {
  id: number; kind: LevelKind; world: number; name: string; blurb: string; bpm: number; root: number;
  concepts: string[]; news: string[]; zones: ZoneRecipe[]; oneLife?: boolean; extras: string[];
  fusion?: Level["fusion"];
  /** a piece of the endless run: no start / finish platforms, extra coins, lives, boosters and grumpies */
  run?: boolean;
  /** no grumpies (last-resort rebuild) */
  calm?: boolean;
}

// ---------------------------------------------------------------- builder state
interface B0 {
  rng: Rng; tpb: number; boost: number; d: number;
  c: number; w: number; h: number;
  rows: Row[]; beat: number[]; zone: number;
  hazards: Hazard[]; jumps: Jump[]; forces: Force[]; walls: { s0: number; s1: number }[];
  air: Set<number>;
  risky: { s: number; x: number }[];
  minSafe: Map<number, number>;
  color: number[];
  segRow: { s: number; concept: string }[];
  speed: number;
}

const range = (a: number, z: number) => { const o: number[] = []; for (let i = a; i <= z; i++) o.push(i); return o; };
const smooth = (t: number) => t * t * (3 - 2 * t);
const clampC = (c: number) => Math.max(-CLAMP_C, Math.min(CLAMP_C, c));
function lanes(c: number, w: number) {
  const a = Math.round(c - (w - 1) / 2);
  return range(a, a + w - 1);
}

function push(b: B0, xs: number[], k: TileKind = TK.grass, rpb = b.tpb * b.speed): number {
  const s = b.rows.length;
  const beat = s === 0 ? 0 : b.beat[s - 1] + 1 / b.rows[s - 1].rpb;
  const prev = s > 0 ? b.rows[s - 1] : null;
  if (prev && prev.tiles.length && xs.length && !b.air.has(s - 1) && Math.abs(prev.h - b.h) < 0.01) {
    const pa = prev.tiles[0].x, pb = prev.tiles[prev.tiles.length - 1].x;
    const a = Math.min(...xs), z = Math.max(...xs);
    if (z < pa) xs = [...xs, ...range(z + 1, pa)];
    else if (a > pb) xs = [...range(pb, a - 1), ...xs];
  }
  xs = [...new Set(xs)].sort((p, q) => p - q);
  b.rows.push({ tiles: xs.map((x) => ({ x, k })), zone: b.zone, rpb, h: b.h });
  b.beat.push(beat);
  b.color.push(b.color.length ? b.color[b.color.length - 1] : -1);
  return s;
}
function airRow(b: B0) {
  const s = b.rows.length;
  b.air.add(s);
  b.rows.push({ tiles: [], zone: b.zone, rpb: b.tpb * b.speed, h: b.h });
  b.beat.push(b.beat[s - 1] + 1 / b.rows[s - 1].rpb);
  b.color.push(b.color[s - 1] ?? -1);
}
function gap(b: B0, rowsTotal: number, rise = 0, mega = false) {
  const g = Math.max(2, rowsTotal - 1);
  const s0 = push(b, lanes(b.c, Math.max(3, b.w)), mega ? TK.mega : TK.pad);
  for (let i = 0; i < g; i++) airRow(b);
  b.jumps.push({ s0, s1: s0 + g + 1, h: (mega ? 2.2 : 0.95) + 0.14 * g + Math.max(0, rise) * 0.6 });
  b.h += rise;
}

/** a winding single safe lane inside lanes `ls` (changes lane at most every 2 rows) */
function walk(b: B0, ls: number[], n: number) {
  let x = ls[Math.floor(ls.length / 2)];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 1 && i % 2 === 0 && b.rng.chance(0.5)) { const d = b.rng.sign(); if (ls.includes(x + d)) x += d; }
    out.push(x);
  }
  return out;
}

function addHaz(b: B0, h: Omit<Hazard, "id">, minSafe = 1) {
  const id = b.hazards.length;
  b.hazards.push({ ...h, id });
  b.minSafe.set(id, minSafe);
}

function seg(b: B0, sg: Seg) {
  const { rng } = b;
  const n = Math.max(1, Math.round(sg.b * b.tpb * b.speed));
  const w = sg.w ?? b.w;
  switch (sg.k) {
    case "road": case "rest": {
      const ww = sg.k === "rest" ? Math.max(5, b.w) : w;
      b.w = ww;
      for (let i = 0; i < n; i++) push(b, lanes(b.c, ww));
      return;
    }
    case "curve": case "snake": {
      const c0 = b.c;
      const target = clampC(c0 + (sg.dx ?? 0));
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 1;
        const c = sg.k === "curve" ? c0 + (target - c0) * smooth(t) : clampC(c0 + (sg.amp ?? 1.5) * Math.sin(2 * Math.PI * (sg.cyc ?? 1) * t));
        push(b, lanes(c, w));
      }
      b.c = Math.round(sg.k === "curve" ? target : clampC(c0 + (sg.amp ?? 1.5) * Math.sin(2 * Math.PI * (sg.cyc ?? 1))));
      b.w = w;
      return;
    }
    case "zig": {
      const leg = Math.max(2, Math.round((sg.every ?? 2) * b.tpb));
      let dir = b.c > 0 ? -1 : b.c < 0 ? 1 : rng.sign();
      let c = b.c;
      for (let i = 0; i < n; i++) {
        if (i > 0 && i % leg === 0) {
          let nc = c + dir * (sg.step ?? 2);
          if (Math.abs(nc) > CLAMP_C) { dir = -dir; nc = c + dir * (sg.step ?? 2); }
          c = nc; dir = -dir;
        }
        push(b, lanes(c, w));
      }
      b.c = c; b.w = w;
      return;
    }
    case "stairs": {
      let c = Math.round(b.c);
      const c0 = c;
      for (let i = 0; i < n; i++) {
        if (i > 0 && i % 3 === 0) { let d = rng.sign(); if (Math.abs(c + d - c0) > 2 || Math.abs(c + d) > CLAMP_C) d = -d; c += d; }
        push(b, [c]);
      }
      b.c = c; b.w = 1;
      return;
    }
    case "gap": gap(b, n); return;
    case "mega": gap(b, Math.max(n, 9), 0, true); return;
    case "up": {
      b.w = Math.max(3, w);
      for (let k = 0; k < Math.max(1, Math.floor(n / 9)); k++) { gap(b, 5, 1.1); for (let i = 0; i < 4; i++) push(b, lanes(b.c, b.w)); }
      return;
    }
    case "down": {
      b.w = Math.max(3, w);
      for (let i = 0; i < n; i++) { if (i > 0 && i % 6 === 0) b.h -= 0.65; push(b, lanes(b.c, b.w)); }
      return;
    }
    case "wave": {
      const h0 = b.h, amp = sg.amp ?? 0.8;
      for (let i = 0; i < n; i++) { b.h = h0 + amp * Math.sin((2 * Math.PI * i) / Math.max(12, n)) ; push(b, lanes(b.c, w)); }
      b.h = h0 + amp * Math.sin((2 * Math.PI * n) / Math.max(12, n));
      b.w = w;
      return;
    }
    case "hops": {
      const hops = Math.max(1, Math.floor(n / 9));
      b.w = 3;
      for (let k = 0; k < hops; k++) {
        gap(b, 5);
        let d = rng.pick([-2, -1, 1, 2]);
        if (Math.abs(b.c + d) > CLAMP_C) d = -d;
        b.c = clampC(b.c + d);
        for (let i = 0; i < 3; i++) push(b, lanes(b.c, 3));
      }
      return;
    }
    case "fork": case "fork3": {
      const c = Math.round(b.c);
      const flip = rng.chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const sep = Math.round(4 * Math.sin(Math.PI * Math.min(1, i / Math.max(1, n - 1))));
        const h1 = Math.floor(sep / 2), h2 = Math.ceil(sep / 2);
        let xs: number[];
        if (sg.k === "fork3") xs = sep < 2 ? lanes(c, 3) : [c - 1 - h1, c, c + 1 + h2];
        else xs = [...[c - 1 - h1, c - h1].map((x) => c + (x - c) * flip), c + (1 + h2) * flip];
        const s = push(b, xs);
        if (sep >= 3) b.risky.push({ s, x: sg.k === "fork3" ? c + (1 + h2) * flip : c + (1 + h2) * flip });
      }
      b.c = c; b.w = 3;
      return;
    }
    case "funnel": {
      const w0 = sg.w0 ?? b.w, w1 = sg.w1 ?? 3;
      for (let i = 0; i < n; i++) push(b, lanes(b.c, Math.round(w0 + (w1 - w0) * (n > 1 ? i / (n - 1) : 1))));
      b.w = w1;
      return;
    }
    case "boost": {
      const m = Math.max(1, Math.round(sg.b * b.boost));
      const ww = Math.max(3, b.w);
      for (let i = 0; i < m; i++) push(b, lanes(b.c, ww), i < 2 ? TK.boost : TK.grass, b.boost);
      b.w = ww;
      return;
    }
    case "holes": {
      const ls = lanes(b.c, w);
      const line = walk(b, ls, n);
      for (let i = 0; i < n; i++) {
        const keep = new Set<number>([line[i], line[Math.max(0, i - 1)]]);
        let xs: number[];
        const s = b.rows.length;
        switch (sg.pat) {
          case "checker": xs = ls.filter((x) => keep.has(x) || (Math.floor(s / 2) + x) % 2 !== 0); break;
          case "comb": xs = i % 9 < 2 ? ls : ls.filter((x) => keep.has(x) || (x - ls[0]) % 2 === 0); break;
          case "ladder": xs = ls.filter((x) => keep.has(x) || x === ls[0] || x === ls[ls.length - 1] || i % 2 === 0); break;
          default: xs = ls.filter((x) => keep.has(x) || !rng.chance(sg.dens ?? 0.4));
        }
        if (i < 2) xs = ls;
        const s2 = push(b, xs);
        if (sg.pat === "maze" && i >= 3 && i % 4 === 0) {
          for (const x of ls) if (!keep.has(x) && x !== line[Math.min(n - 1, i + 1)] && rng.chance(0.7)) addHaz(b, { kind: "slider", s: s2, x, size: 0, period: 4, phase: 0, dir: 1, skin: sg.skin ?? "hedge", w: 1, mode: "static" }, 1);
        }
      }
      b.w = w;
      return;
    }
    case "islands": {
      const ls = lanes(b.c, w);
      const amp = sg.amp ?? 1.1, period = sg.period ?? 4;
      for (let i = 0; i < n; i++) {
        const s = push(b, ls);
        if (i < 2 || i > n - 2) continue;
        for (const t of b.rows[s].tiles) t.mv = { ax: 0, amp, period, phase: s * 0.035 };
      }
      b.w = w;
      return;
    }
    case "elevators": {
      for (let i = 0; i < n; i++) {
        const s = push(b, lanes(b.c, w));
        for (const t of b.rows[s].tiles) t.mv = { ax: 1, amp: 0.22, period: 2, phase: (t.x * 0.17 + s * 0.11) % 1 };
      }
      b.w = w;
      return;
    }
    case "tiles": {
      const ls = lanes(b.c, w);
      const k = sg.tile ?? TK.ice;
      const trigger = k === TK.mirror || k === TK.gravity || k === TK.shrink || k === TK.grow || k === TK.updraft;
      for (let i = 0; i < n; i++) {
        let kind: TileKind = TK.grass;
        if (trigger) kind = i === 2 ? k : TK.grass;
        else if (sg.pat === "stripes") kind = Math.floor(i / 2) % 2 === 0 ? k : TK.grass;
        else if (sg.pat === "random") kind = TK.grass;
        else kind = i >= 1 ? k : TK.grass;
        const s = push(b, ls, kind);
        if (sg.pat === "random" && i >= 1) for (const t of b.rows[s].tiles) if (rng.chance(sg.dens ?? 0.5)) t.k = k;
        if (k === TK.piano) b.rows[s].tiles.forEach((t, j) => { t.note = (j + i) % 8; });
        if (k === TK.push && i >= 1) { const dir = Math.floor(i / 6) % 2 ? 1 : -1; for (const t of b.rows[s].tiles) t.dir = dir; }
        if (k === TK.magnet && i >= 1) for (const t of b.rows[s].tiles) if (t.x !== Math.round(b.c)) t.k = TK.grass;
      }
      if (k === TK.magnet) b.forces.push({ s0: b.rows.length - n, s1: b.rows.length, ax: 2.5, to: Math.round(b.c), kind: "magnet" });
      b.w = w;
      return;
    }
    case "blink": {
      const ls = lanes(b.c, w);
      const line = walk(b, ls, n);
      for (let i = 0; i < n; i++) {
        const s = push(b, ls, i < 2 ? TK.grass : TK.blink);
        if (i < 2) continue;
        for (const t of b.rows[s].tiles) {
          t.par = t.x === line[i] || t.x === line[i - 1] ? ((b.beat[s] - 0.5) % 2 + 2) % 2 : rng.range(0, 2);
        }
      }
      b.w = w;
      return;
    }
    case "colors": {
      const ls = lanes(b.c, w);
      const c = rng.int(0, 2);
      const s0 = push(b, ls, TK.paint);
      b.rows[s0].tiles.forEach((t) => { t.c = c; });
      b.color[s0] = c;
      const line = walk(b, ls, n);
      for (let i = 0; i < n; i++) {
        const s = push(b, ls, TK.color);
        b.color[s] = c;
        for (const t of b.rows[s].tiles) t.c = t.x === line[i] || t.x === line[Math.max(0, i - 1)] ? c : rng.chance(0.45) ? c : (c + rng.int(1, 2)) % 3;
      }
      b.w = w;
      return;
    }
    case "teleport": {
      for (let i = 0; i < 3; i++) push(b, lanes(b.c, w));
      let to = rng.pick([-3, -2, 2, 3]);
      if (Math.abs(b.c + to) > CLAMP_C) to = -to;
      const s = push(b, lanes(b.c, w), TK.teleport);
      b.rows[s].tiles.forEach((t) => { t.to = to; });
      b.c = clampC(b.c + to);
      for (let i = 0; i < n - 4; i++) push(b, lanes(b.c, w));
      b.w = w;
      return;
    }
    case "plates": {
      for (let i = 0; i < 3; i++) push(b, lanes(b.c, w));
      const s = push(b, lanes(b.c, w), TK.plate);
      b.rows[s].tiles.forEach((t) => { t.g = s; });
      for (let i = 0; i < 3; i++) push(b, lanes(b.c, w));
      for (let i = 0; i < 6; i++) { const r = push(b, lanes(b.c, Math.min(3, w)), TK.bridge); b.rows[r].tiles.forEach((t) => { t.g = s; }); }
      for (let i = 0; i < Math.max(2, n - 13); i++) push(b, lanes(b.c, w));
      b.w = w;
      return;
    }
    case "force": {
      const s0 = b.rows.length;
      for (let i = 0; i < n; i++) push(b, lanes(b.c, w));
      b.forces.push({ s0: s0 + 2, s1: b.rows.length - 1, ax: sg.ax ?? 2.4, period: sg.period, phase: rng.next(), kind: sg.force ?? "wind" });
      b.w = w;
      return;
    }
    case "halfpipe": {
      const s0 = b.rows.length;
      for (let i = 0; i < n; i++) push(b, lanes(b.c, w));
      b.walls.push({ s0, s1: b.rows.length });
      b.w = w;
      return;
    }
    case "haz": {
      const first = b.rows.length;
      for (let i = 0; i < n; i++) push(b, lanes(b.c, w));
      const count = sg.n ?? 2;
      const lead = Math.min(5, Math.floor(n / 4));
      const span = n - lead - 2;
      const hard = sg.hard ?? 0;
      const ls = lanes(b.c, w);
      for (let k = 0; k < count; k++) {
        const s = first + lead + Math.round(((k + 0.5) / count) * span);
        const base = { s, x: Math.round(b.c), phase: 0, dir: 1, skin: sg.skin ?? "block" };
        switch (sg.arch) {
          case "mallet": addHaz(b, { ...base, kind: "mallet", size: (w - 1) / 2 + 0.7, period: hard ? 2 : 4, phase: (sg.mode === "hop" && k % 2) ? 0.5 : 0 }, hard ? 1 : 2); break;
          case "daisy": addHaz(b, { ...base, kind: "daisy", x: w >= 5 ? Math.round(b.c) + rng.int(-1, 1) : Math.round(b.c), size: hard ? 2.25 : 2.0, period: hard ? 3 : 4, dir: rng.sign(), arms: sg.arms ?? 4 }, 1); break;
          case "claw": {
            const x = Math.round(b.c) + (k % 2 === 0 ? -1 : 1) * rng.int(0, 1);
            addHaz(b, { ...base, kind: "claw", x, size: w >= 5 ? 1 : 0.5, period: 1, slam: b.beat[s] - (hard ? 0 : 0.05) });
            break;
          }
          case "slider": {
            const mode = sg.mode ?? "swing";
            const ow = sg.ow ?? 1;
            const x = mode === "static" ? rng.pick(ls) : Math.round(b.c);
            addHaz(b, { ...base, kind: "slider", x, size: mode === "static" ? 0 : Math.max(0.5, (w - ow) / 2), period: sg.period ?? (mode === "saw" ? 3 : hard ? 2 : 4), dir: rng.sign(), w: ow, mode }, mode === "static" ? 1 : 2 - hard);
            break;
          }
          case "roller": addHaz(b, { ...base, kind: "roller", x: rng.pick(ls), size: 0.45, period: 1, slam: b.beat[s], speed: 1.6 + hard * 0.8 }); break;
          case "popper": addHaz(b, { ...base, kind: "popper", x: rng.pick(ls), size: 0, period: 2, duty: 0.45 + hard * 0.1, w: 1 }, 1); break;
          case "laser": addHaz(b, { ...base, kind: "laser", x: (ls[0] + ls[ls.length - 1]) / 2, size: (ls[ls.length - 1] - ls[0]) / 2 + 0.6, period: hard ? 2 : 4, duty: 0.5 + hard * 0.1 }, 1); break;
        }
      }
      b.w = w;
      return;
    }
    case "crumble": {
      const ls = lanes(b.c, w);
      let safe = Math.round(b.c);
      for (let i = 0; i < n; i++) {
        const before = safe;
        if (i > 1 && i % 2 === 0 && rng.chance(0.55)) { const d = rng.sign(); if (ls.includes(safe + d)) safe += d; }
        const s = push(b, ls);
        if (i < 2 || i >= n - 1) continue;
        for (const t of b.rows[s].tiles) {
          if (t.x === safe || t.x === before) continue;
          if (rng.chance(sg.dens ?? 0.5)) { t.k = TK.crumble; t.drop = b.beat[s] - rng.range(0.6, 1.5); }
        }
      }
      b.w = w;
      return;
    }
  }
}

// ---------------------------------------------------------------- the par-line solver
const NL = LANES * 2 + 1;
const li = (x: number) => x + LANES;
const frac = (v: number) => v - Math.floor(v);

export function beatAt(bRow: Float64Array, s: number) {
  if (s <= 0) return bRow[0] + s * (bRow[1] - bRow[0]);
  const n = bRow.length - 1;
  if (s >= n) return bRow[n] + (s - n) * (bRow[n] - bRow[n - 1]);
  const i = Math.floor(s), f = s - i;
  return bRow[i] + (bRow[i + 1] - bRow[i]) * f;
}

/** height of a jump arc (absolute, includes the floors it flies between) */
export function jumpY(j: Jump, s: number, rows: Row[]) {
  const u = Math.max(0, Math.min(1, (s - j.s0) / (j.s1 - j.s0)));
  const h0 = rows[j.s0]?.h ?? 0, h1 = rows[Math.min(rows.length - 1, j.s1)]?.h ?? h0;
  return h0 + (h1 - h0) * u + j.h * 4 * u * (1 - u);
}

/** where a (possibly moving) tile is at `beat` */
export function tileOffset(t: Tile, beat: number) {
  if (!t.mv) return 0;
  return t.mv.amp * Math.sin(2 * Math.PI * (beat / t.mv.period + t.mv.phase));
}
/** is the tile solid at `beat` for a ball of colour `color`? (bridges need their plate; the solver treats them as solid) */
export function tileSolid(t: Tile, beat: number, color: number) {
  if (t.k === TK.crumble) return beat < (t.drop ?? 0);
  if (t.k === TK.blink) return frac((beat - (t.par ?? 0)) / 2) < 0.5;
  if (t.k === TK.color) return t.c === color;
  return true;
}

interface Solve { line: Float32Array; valid: Uint8Array }

function solve(L: Omit<Level, "line" | "pickups">, near: Hazard[][], color: number[]): Solve | null {
  const nRows = L.rows.length;
  const air = new Uint8Array(nRows);
  const jumpOf: (Jump | null)[] = new Array(nRows).fill(null);
  for (const j of L.jumps) for (let s = j.s0 + 1; s < j.s1 && s < nRows; s++) { air[s] = 1; jumpOf[s] = j; }
  const teleTo = new Int8Array(nRows);
  for (let s = 0; s < nRows; s++) { const t = L.rows[s].tiles[0]; if (t && t.k === TK.teleport) teleTo[s] = t.to ?? 0; }

  const okMemo = new Int8Array(nRows * NL).fill(-1);
  const hazOk = (s: number, x: number, by: (ss: number) => number) => {
    for (const h of near[s]) for (let d = -0.5; d <= 0.5; d += 0.25) {
      const ss = s + d;
      if (hazardHits(h, beatAt(L.bRow, ss), x, ss, by(ss), 0)) return false;
    }
    return true;
  };
  const floorAt = (s: number) => L.rows[Math.max(0, Math.min(nRows - 1, s))].h;
  const ok = (s: number, x: number): boolean => {
    if (x < -LANES || x > LANES) return false;
    const k = s * NL + li(x);
    if (okMemo[k] >= 0) return okMemo[k] === 1;
    let res = true;
    if (air[s]) {
      const j = jumpOf[s]!;
      res = hazOk(s, x, (ss) => jumpY(j, ss, L.rows) - floorAt(Math.round(ss)));
    } else {
      const beat = L.bRow[s];
      let found = false;
      for (const t of L.rows[s].tiles) {
        if (Math.abs(x - (t.x + tileOffset(t, beat))) > (t.mv?.ax === 0 ? 0.55 : 0.36)) continue;
        if (!tileSolid(t, beat - 0.25, color[s]) || !tileSolid(t, beat + 0.25, color[s])) continue;
        found = true; break;
      }
      res = found && hazOk(s, x, () => 0);
    }
    okMemo[k] = res ? 1 : 0;
    return res;
  };
  const solidAt = (s: number, x: number) => air[s] === 1 || L.rows[s].tiles.some((t) => Math.abs(x - (t.x + tileOffset(t, L.bRow[s]))) <= 0.6 && tileSolid(t, L.bRow[s], color[s]));
  const step = (s: number, a: number, b: number) => {
    const tele = teleTo[s];
    const from = a + tele;
    const maxStep = air[s] || air[s + 1] ? 2 : 1;
    if (Math.abs(from - b) > maxStep) return false;
    if (!tele && from !== b && !air[s] && !air[s + 1] && !solidAt(s, b) && !solidAt(s + 1, a)) return false;
    if (from !== b) {
      // the ball may lag behind the ideal slide: every point between the two lanes must be safe for the whole move
      for (let f = 0.15; f <= 1.2001; f += 0.1) {
        const ss = s + f;
        const j = jumpOf[s] ?? jumpOf[s + 1];
        const ym = j ? jumpY(j, ss, L.rows) - floorAt(Math.round(ss)) : 0;
        for (const xm of [from, (from + b) / 2, b]) {
          for (const h of near[s]) if (hazardHits(h, beatAt(L.bRow, ss), xm, ss, ym, 0)) return false;
          for (const h of near[Math.min(nRows - 1, s + 1)]) if (hazardHits(h, beatAt(L.bRow, ss), xm, ss, ym, 0)) return false;
        }
      }
    }
    return true;
  };
  const center = (s: number) => {
    const r = L.rows[s];
    if (!r.tiles.length) return 0;
    return (r.tiles[0].x + r.tiles[r.tiles.length - 1].x) / 2;
  };

  const INF = 1e9;
  const cost = new Float64Array(nRows * NL).fill(INF);
  const from = new Int8Array(nRows * NL).fill(-99);
  const fwd = new Uint8Array(nRows * NL);
  const start = 1;
  for (let x = -LANES; x <= LANES; x++) if (ok(start, x)) { cost[start * NL + li(x)] = Math.abs(x) * 0.4; fwd[start * NL + li(x)] = 1; }
  for (let s = start; s < nRows - 1; s++) {
    for (let a = -LANES; a <= LANES; a++) {
      const ca = cost[s * NL + li(a)];
      if (ca >= INF) continue;
      const base = a + teleTo[s];
      for (let b = base - 2; b <= base + 2; b++) {
        if (b < -LANES || b > LANES || !ok(s + 1, b) || !step(s, a, b)) continue;
        fwd[(s + 1) * NL + li(b)] = 1;
        let risk = 0;
        if (!ok(s + 1, b - 1)) risk += 0.35;
        if (!ok(s + 1, b + 1)) risk += 0.35;
        const c = ca + Math.abs(base - b) * 1.15 + Math.abs(b - center(s + 1)) * 0.06 + risk;
        const k = (s + 1) * NL + li(b);
        if (c < cost[k]) { cost[k] = c; from[k] = a; }
      }
    }
  }
  const end = L.finish;
  let best = INF, bx = 0;
  for (let x = -LANES; x <= LANES; x++) { const c = cost[end * NL + li(x)]; if (c < best) { best = c; bx = x; } }
  if (best >= INF) return null;
  const bwd = new Uint8Array(nRows * NL);
  for (let x = -LANES; x <= LANES; x++) if (cost[end * NL + li(x)] < INF) bwd[end * NL + li(x)] = 1;
  for (let s = end - 1; s >= start; s--) {
    for (let a = -LANES; a <= LANES; a++) {
      if (!fwd[s * NL + li(a)]) continue;
      const base = a + teleTo[s];
      for (let b = base - 2; b <= base + 2; b++) {
        if (b < -LANES || b > LANES || !bwd[(s + 1) * NL + li(b)]) continue;
        if (ok(s + 1, b) && step(s, a, b)) { bwd[s * NL + li(a)] = 1; break; }
      }
    }
  }
  const valid = new Uint8Array(nRows * NL);
  for (let i = 0; i < valid.length; i++) valid[i] = fwd[i] & bwd[i];
  const line = new Float32Array(nRows);
  let x = bx;
  for (let s = end; s >= start; s--) {
    line[s] = x;
    const p = from[s * NL + li(x)];
    if (s > start) x = p === -99 ? x : p;
  }
  line[0] = line[start];
  for (let s = end + 1; s < nRows; s++) line[s] = line[end];
  return { line, valid };
}

// ---------------------------------------------------------------- concept → segments (the compiler)
interface Ctx { d: number; w: number; hard: number; world: number; rng: Rng }
const HAZ: Record<string, Partial<Seg>> = {
  H01: { arch: "mallet", skin: "mallet" }, H02: { arch: "daisy", skin: "windmill", arms: 4 }, H03: { arch: "mallet", skin: "mallet", mode: "hop" },
  H04: { arch: "slider", skin: "block", mode: "swing", ow: 1 }, H05: { arch: "claw", skin: "crusher" }, H06: { arch: "popper", skin: "pillar" },
  H07: { arch: "slider", skin: "crystal", mode: "swing", ow: 1 }, H08: { arch: "roller", skin: "barrel" }, H09: { arch: "slider", skin: "pins", mode: "static", ow: 1 },
  H10: { arch: "slider", skin: "laserpost", mode: "saw", ow: 1 }, H11: { arch: "laser", skin: "laser" }, H12: { arch: "claw", skin: "rock" },
  H13: { arch: "slider", skin: "cannonball", mode: "saw", ow: 1, period: 2 }, H14: { arch: "popper", skin: "ball" }, H15: { arch: "mallet", skin: "axe" },
  H16: { arch: "slider", skin: "saw", mode: "saw", ow: 1 }, H17: { arch: "daisy", skin: "top", arms: 2 }, H18: { arch: "laser", skin: "doors" },
  H19: { arch: "daisy", skin: "door", arms: 2 }, H20: { arch: "daisy", skin: "broom", arms: 1 }, H22: { arch: "popper", skin: "jet" },
  H23: { arch: "popper", skin: "geyser" }, H24: { arch: "roller", skin: "snowball" }, H26: { arch: "claw", skin: "lightning" }, H27: { arch: "claw", skin: "firework" },
  H31: { arch: "claw", skin: "claw" }, H32: { arch: "slider", skin: "gloop", mode: "hop", ow: 1 }, H34: { arch: "claw", skin: "stomper" },
  H35: { arch: "slider", skin: "turbo", mode: "saw", ow: 1, period: 2 }, H36: { arch: "slider", skin: "penguin", mode: "saw", ow: 1 }, H37: { arch: "claw", skin: "book" },
  H38: { arch: "slider", skin: "cake", mode: "static", ow: 2 }, H39: { arch: "slider", skin: "noodle", mode: "swing", ow: 2 }, H40: { arch: "mallet", skin: "sign" },
};
const TILE: Record<string, [TileKind, string?]> = {
  T04: [TK.mud], T05: [TK.ice], T06: [TK.sticky], T07: [TK.bouncy], T09: [TK.glass, "stripes"], T11: [TK.ghost], T14: [TK.mirror], T16: [TK.gravity],
  T17: [TK.shrink], T18: [TK.grow], T19: [TK.magnet], T20: [TK.push], T22: [TK.seesaw, "random"], T23: [TK.piano], T25: [TK.updraft], R03: [TK.gold, "random"],
};
const CAMS: Record<string, CamMode> = { C01: "chase", C02: "top", C03: "side", C04: "reverse", C05: "dutch", C06: "wide", C07: "low", C08: "quarter", C09: "upside", C10: "mirror", C11: "wide", C12: "flyby", F17: "spin" };
const BOSS_IDS: Record<string, string> = { B01: "kranky-giant", B02: "gloop-king", B03: "mothership", B04: "mega-robot", B05: "volcano", B06: "wave", B07: "avalanche", B08: "tower", B09: "train", B10: "dragon-kite", B11: "storm-machine", B12: "mirror-momo", B13: "clock", B14: "pinball", B15: "piano" };
const ABIL = new Set(["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13", "A14", "A15"]);

/** segments for one concept */
function conceptSegs(id: string, x: Ctx): Seg[] {
  const { d, w, hard, rng } = x;
  const narrow = Math.max(2, w - 1);
  const h = HAZ[id];
  if (h) return [S("road", 2, { w }), S("haz", 16 + Math.round(d * 6), { w: h.arch === "daisy" ? Math.max(5, w) : w, n: 3 + Math.round(d * 3), hard, ...h })];
  const t = TILE[id];
  if (t) return [S("road", 2, { w }), S("tiles", 14, { w, tile: t[0], pat: t[1] ?? "all", dens: 0.5 })];
  switch (id) {
    case "F01": return [S("road", 8, { w: Math.max(5, w) }), S("snake", 12, { w, amp: 1.5, cyc: 1 })];
    case "F02": return [S("funnel", 4, { w0: w, w1: 1 }), S("curve", 14, { w: 1, dx: rng.sign() * 2 }), S("road", 2, { w: 3 })];
    case "F03": return [S("zig", 16, { w: Math.max(1, narrow - (hard ? 1 : 0)), step: 2, every: hard ? 1 : 2 })];
    case "F04": return [S("snake", 16, { w: narrow, amp: 2, cyc: 1.5 })];
    case "F05": return [S("hops", 18)];
    case "F06": return [S("holes", 14, { w: Math.max(5, w), pat: "checker" })];
    case "F07": return [S("holes", 14, { w: Math.max(5, w), pat: "comb" })];
    case "F08": return [S("fork", 14), S("road", 2, { w: 3 })];
    case "F09": return [S("fork3", 14), S("road", 2, { w: 3 })];
    case "F10": return [S("funnel", 10, { w0: 7, w1: hard ? 1 : 2 }), S("road", 4, { w: hard ? 1 : 2 })];
    case "F11": return [S("funnel", 10, { w0: 1, w1: 7 }), S("road", 4, { w: 7 })];
    case "F12": return [S("down", 14, { w })];
    case "F13": return [S("up", 14, { w })];
    case "F14": case "T02": case "F25": return [S("road", 3, { w }), S("mega", 3), S("road", 6, { w: Math.max(5, w) })];
    case "F15": return [S("wave", 16, { w, amp: 0.9 })];
    case "F16": return [S("force", 14, { w, force: "tilt", ax: 2 + d, period: 8 })];
    case "F17": return [S("snake", 16, { w, amp: 2, cyc: 1 })];
    case "F18": case "T24": case "A10": return [S("halfpipe", 14, { w }), S("snake", 6, { w })];
    case "F19": return [S("islands", 16, { w: narrow, amp: 1.1 + d * 0.6 })];
    case "F20": return [S("elevators", 14, { w })];
    case "F21": return [S("islands", 16, { w: Math.max(3, narrow), amp: 1.6, period: 6 })];
    case "F22": return [S("force", 14, { w, force: "conveyor", ax: 2.2 + d, period: 6 })];
    case "F23": return [S("holes", 16, { w: Math.max(5, w), pat: "maze", skin: "hedge" })];
    case "F24": return [S("holes", 14, { w: Math.max(5, w), pat: "ladder" })];
    case "T01": return [S("road", 4, { w }), S("gap", hard ? 3 : 2), S("road", 4, { w }), S("gap", 2), S("road", 4, { w })];
    case "T03": return [S("boost", 4), S("snake", 8, { w, amp: 1.5, cyc: 1 }), S("boost", 4)];
    case "T08": case "R15": return [S("crumble", 16, { w: Math.max(3, w), dens: 0.45 + d * 0.35 })];
    case "T10": return [S("blink", 14, { w })];
    case "T12": case "T13": case "R02": return [S("colors", 14, { w: Math.max(3, w) })];
    case "T15": return [S("teleport", 12, { w })];
    case "T21": return [S("plates", 14, { w })];
    case "H21": return [S("force", 14, { w, force: "wind", ax: 2.4 + d * 1.5, period: 6 })];
    case "H33": return [S("force", 14, { w, force: "beam", ax: 2.6 + d, period: 4 })];
    case "H25": case "H28": case "R12": case "R13": return [S("crumble", 12, { w, dens: 0.35 + d * 0.3 }), S("snake", 6, { w })];
    case "R07": case "R08": case "R20": return [S("boost", 4), S("snake", 12, { w, amp: 1.5, cyc: 1 })];
    case "R10": case "R22": return [S("haz", 16, { w, arch: "laser", skin: "doors", n: 4, hard })];
    case "R14": case "X10": return [S("snake", 14, { w: Math.max(5, w), amp: 2, cyc: 1 })];
    case "R16": case "R11": return [S("holes", 14, { w: Math.max(5, w), pat: "random", dens: 0.45 })];
    case "R01": return [S("holes", 14, { w, pat: "random", dens: 0.3 })];
    case "R19": return [S("tiles", 8, { w, tile: TK.gravity }), S("tiles", 8, { w, tile: TK.gravity })];
    case "REMIX": return [];
  }
  if (ABIL.has(id)) return [S("road", 2, { w }), S("snake", 12, { w, amp: 1.5, cyc: 1 }), S("gap", 2), S("road", 3, { w })];
  if (CAMS[id] || id[0] === "R" || id[0] === "X" || id[0] === "W" || id[0] === "M" || id[0] === "C") return [S("snake", 14, { w, amp: 1.2, cyc: 1 })];
  return [S("road", 8, { w })];
}

/** zone-level effects of a concept */
function conceptZone(id: string, z: ZoneRecipe) {
  if (CAMS[id]) z.cam = CAMS[id];
  const r = (z.rules ??= {});
  switch (id) {
    case "H29": case "R05": r.lightsOut = true; break;
    case "H30": r.fog = true; break;
    case "R16": r.memory = true; break;
    case "R06": r.mirror = true; break;
    case "R17": r.tiny = true; break;
    case "R18": r.giant = true; break;
    case "R03": r.gold = true; break;
    case "R25": r.silence = true; break;
    case "R01": r.beatSteps = true; break;
    case "R11": r.ghostLine = true; break;
    case "R04": r.noEdges = true; break;
    case "R14": case "X10": r.beadRain = true; break;
    case "H25": r.chase = "boulder"; break;
    case "H28": r.chase = "flood"; break;
    case "R12": r.chase = "kranky"; break;
    case "R13": r.chase = "crumble"; break;
    case "R07": z.speed = 1.25; break;
  }
  if (id.startsWith("M")) z.style = id;
  if (BOSS_IDS[id]) z.boss = BOSS_IDS[id];
}

function bossSegs(boss: string, x: Ctx): Seg[] {
  const { w, hard } = x;
  const W = Math.max(5, w);
  const A: Record<string, Seg[]> = {
    "kranky-giant": [S("haz", 18, { w: W, arch: "claw", skin: "claw", n: 6, hard }), S("haz", 14, { w: W, arch: "roller", skin: "bowling", n: 4, hard })],
    "gloop-king": [S("haz", 18, { w: W, arch: "slider", skin: "gloop", mode: "hop", n: 5, hard }), S("haz", 14, { w: W, arch: "popper", skin: "jelly", n: 5, hard })],
    mothership: [S("force", 12, { w: W, force: "beam", ax: 3, period: 4 }), S("haz", 16, { w: W, arch: "claw", skin: "meteor", n: 5, hard })],
    "mega-robot": [S("haz", 16, { w: W, arch: "claw", skin: "stomper", n: 5, hard }), S("haz", 14, { w: W, arch: "laser", skin: "laser", n: 4, hard })],
    volcano: [S("haz", 16, { w: W, arch: "claw", skin: "meteor", n: 6, hard }), S("crumble", 12, { w: W, dens: 0.6 })],
    wave: [S("haz", 16, { w: W, arch: "roller", skin: "orb", n: 5, hard }), S("force", 12, { w: W, force: "water", ax: 3, period: 4 })],
    avalanche: [S("haz", 18, { w: W, arch: "roller", skin: "snowball", n: 7, hard }), S("crumble", 10, { w: W, dens: 0.5 })],
    tower: [S("haz", 16, { w: W, arch: "claw", skin: "crate", n: 6, hard }), S("crumble", 12, { w: W, dens: 0.55 })],
    train: [S("haz", 16, { w: W, arch: "slider", skin: "cart", mode: "saw", n: 5, hard }), S("haz", 12, { w: W, arch: "roller", skin: "wheel", n: 4, hard })],
    "dragon-kite": [S("force", 12, { w: W, force: "wind", ax: 3, period: 4 }), S("haz", 16, { w: W, arch: "popper", skin: "flame", n: 6, hard })],
    "storm-machine": [S("haz", 18, { w: W, arch: "claw", skin: "lightning", n: 7, hard }), S("force", 12, { w: W, force: "wind", ax: 3.2, period: 4 })],
    "mirror-momo": [S("haz", 16, { w: W, arch: "slider", skin: "ghost", mode: "swing", n: 5, hard }), S("tiles", 10, { w: W, tile: TK.mirror })],
    clock: [S("haz", 16, { w: W, arch: "daisy", skin: "gear", arms: 3, n: 3, hard }), S("haz", 14, { w: W, arch: "mallet", skin: "metronome", n: 4, hard })],
    pinball: [S("haz", 16, { w: W, arch: "daisy", skin: "propeller", arms: 2, n: 3, hard }), S("haz", 14, { w: W, arch: "popper", skin: "ball", n: 6, hard })],
    piano: [S("tiles", 10, { w: W, tile: TK.piano }), S("haz", 18, { w: W, arch: "popper", skin: "pillar", n: 7, hard })],
  };
  return A[boss] ?? A["kranky-giant"];
}

const FILLERS = (x: Ctx): Seg[][] => [
  [S("snake", 10, { w: x.w, amp: 1.5, cyc: 1 })],
  [S("curve", 8, { w: x.w, dx: x.rng.sign() * 2 }), S("road", 2, { w: x.w })],
  [S("road", 4, { w: x.w }), S("gap", 2), S("road", 4, { w: x.w })],
  [S("zig", 10, { w: Math.max(2, x.w - 1), step: 2, every: 2 })],
  [S("funnel", 6, { w0: x.w, w1: Math.max(1, x.w - 2) }), S("funnel", 6, { w0: Math.max(1, x.w - 2), w1: x.w })],
  [S("boost", 4), S("road", 4, { w: x.w })],
  [S("crumble", 8, { w: Math.max(3, x.w), dens: 0.3 + x.d * 0.3 })],
];

const NAMES_SECTIONS: SectionKind[] = ["intro", "verse", "build", "chorus", "drop", "finale"];

/** difficulty 0..1 for journey level n (1..200) */
export const journeyDifficulty = (n: number) => Math.min(1, 0.42 + (n - 1) * 0.003);
export const journeyBpm = (n: number) => Math.min(134, Math.round(104 + (n - 1) * 0.14 + ((n - 1) % 10) * 0.6));

/** compile concept ids into a playable recipe */
export function compile(o: {
  id: number; kind: LevelKind; world: number; name: string; concepts: string[]; d: number; bpm: number; seed: number;
  moods?: string[]; styles?: string[]; zones?: number; blurb?: string; fusion?: Level["fusion"]; news?: string[];
}): LevelRecipe {
  const rng = new Rng(o.seed ^ 0x2468);
  const W = worldOf(o.world);
  const moods = o.moods ?? W.moods;
  const d = o.d;
  const w = d < 0.4 ? 5 : d < 0.7 ? 4 : 3;
  const hard = d >= 0.55 ? 1 : 0;
  const x: Ctx = { d, w, hard, world: o.world, rng };
  const ids = o.concepts.filter((c) => c !== "REMIX");
  const bossIds = ids.filter((c) => BOSS_IDS[c]);
  const core = ids.filter((c) => !BOSS_IDS[c]);
  const nZones = o.zones ?? (bossIds.length ? 6 : 5);
  const zones: ZoneRecipe[] = [];
  const remix = o.concepts.includes("REMIX");
  const pool = remix ? JOURNEY.slice(0, 19).map((wd) => wd.levels[0][1][0]) : core;
  for (let zi = 0; zi < nZones; zi++) {
    const section = zi === 0 ? "intro" : zi === nZones - 1 ? "finale" : NAMES_SECTIONS[1 + (zi % 4)];
    const z: ZoneRecipe = {
      mood: moods[zi % moods.length], section, intensity: zi === 0 ? 1 : zi === 1 ? 2 : 3, segs: [],
      style: o.styles ? o.styles[zi % o.styles.length] : W.style, cam: "chase", rules: {},
    };
    const isBoss = bossIds.length > 0 && zi >= nZones - 2;
    if (isBoss) {
      const b = BOSS_IDS[bossIds[0]];
      z.boss = b; z.concept = bossIds[0];
      z.segs.push(S("road", 4, { w: Math.max(5, w) }), ...bossSegs(b, x));
      if (zi === nZones - 1) z.segs.push(S("rest", 4));
    } else {
      // zone 0 teaches the headline concept gently; later zones mix concepts + fillers
      const head = pool.length ? pool[zi % pool.length] : "F01";
      const second = pool.length > 1 ? pool[(zi + 1) % pool.length] : null;
      const easy: Ctx = zi === 0 ? { ...x, d: Math.max(0, d - 0.25), hard: 0, w: Math.min(7, w + 1) } : x;
      z.concept = head;
      z.segs.push(S("road", zi === 0 ? 6 : 2, { w: easy.w }));
      z.segs.push(...conceptSegs(head, easy));
      conceptZone(head, z);
      const fill = FILLERS(x);
      z.segs.push(...fill[rng.int(0, fill.length - 1)]);
      if (second && zi >= 2) { z.segs.push(...conceptSegs(second, x)); conceptZone(second, z); }
      if (zi >= 1) z.segs.push(...fill[rng.int(0, fill.length - 1)]);
      if (zi === nZones - 1) z.segs.push(...conceptSegs(head, { ...x, d: Math.min(1, d + 0.1), hard: 1 }));
    }
    zones.push(z);
  }
  // level-wide concepts
  const extras = ids.filter((c) => c[0] === "X" || ABIL.has(c) || c === "R21" || c === "R23");
  return {
    id: o.id, kind: o.kind, world: o.world, name: o.name, blurb: o.blurb ?? "", bpm: o.bpm, root: [57, 60, 62, 65, 67][o.seed % 5],
    concepts: o.concepts, news: o.news ?? [], zones, extras, oneLife: ids.includes("R21"), fusion: o.fusion,
  };
}

// ---------------------------------------------------------------- build a recipe into a level
function attempt(rec: LevelRecipe, seed: number): Level | null {
  const rng = new Rng(seed);
  const b: B0 = {
    rng, tpb: TPB, boost: TPB * 1.5, d: 0, c: 0, w: 5, h: 0, rows: [], beat: [], zone: 0,
    hazards: [], jumps: [], forces: [], walls: [], air: new Set(), risky: [], minSafe: new Map(), color: [], segRow: [], speed: 1,
  };
  const zones: Zone[] = [];
  const checkpoints: number[] = [1];
  for (let i = 0; i < 5; i++) push(b, lanes(0, 5), i < 3 && !rec.run ? TK.start : TK.grass);

  rec.zones.forEach((zr, zi) => {
    b.zone = zi;
    b.speed = zr.speed ?? 1;
    const from = b.rows.length;
    if (zi > 0) {
      b.w = Math.max(3, b.w);
      push(b, lanes(b.c, Math.max(5, b.w)), rec.oneLife ? TK.grass : TK.check);
      if (!rec.oneLife) checkpoints.push(from);
    }
    for (const sg of zr.segs) { b.segRow.push({ s: b.rows.length, concept: sg.k }); seg(b, sg); }
    b.speed = 1;
    seg(b, S("rest", 2));
    const beat0 = b.beat[from];
    const nextBeat = b.beat[b.rows.length - 1] + 1 / b.rows[b.rows.length - 1].rpb;
    const beats = nextBeat - beat0;
    const padBeats = Math.ceil(beats / 4 - 1e-6) * 4 - beats;
    const padRows = Math.round(padBeats * TPB);
    for (let i = 0; i < padRows; i++) push(b, lanes(b.c, Math.max(5, b.w)));
    const end = b.beat[b.rows.length - 1] + 1 / b.rows[b.rows.length - 1].rpb;
    const m = MOODS[zr.mood] ? zr.mood : "meadow";
    zones.push({
      from, to: b.rows.length, mood: m, name: `${MOODS[m].emoji} ${MOODS[m].name}`, section: zr.section, intensity: zr.intensity, beat0, beats: end - beat0,
      style: zr.style ?? worldOf(rec.world).style, cam: zr.cam ?? "chase", rules: zr.rules ?? {}, boss: zr.boss, concept: zr.concept,
    });
  });

  b.zone = rec.zones.length - 1;
  const finish = push(b, lanes(0, rec.run ? 5 : 7), rec.run ? TK.check : TK.finish);
  for (let i = 0; i < (rec.run ? 6 : 24); i++) push(b, lanes(0, rec.run ? 5 : 7));
  // untouchable Grumpies: spiky balls sitting on the lanes — touching one costs a life
  if (rec.run && !rec.calm) placeGrumpies(b, rec, rng);
  zones[zones.length - 1].to = b.rows.length;

  const nRows = b.rows.length;
  const bRow = new Float64Array(nRows + 1);
  for (let s = 0; s < nRows; s++) bRow[s] = b.beat[s];
  bRow[nRows] = b.beat[nRows - 1] + 1 / b.rows[nRows - 1].rpb;

  // a tile's floor height follows its row; mark bridge / crumble timing etc. already set
  const near: Hazard[][] = Array.from({ length: nRows }, () => []);
  for (const h of b.hazards) {
    const r = Math.ceil(hazardReach(h)) + 1;
    for (let s = Math.max(0, h.s - r); s <= Math.min(nRows - 1, h.s + r); s++) near[s].push(h);
  }
  // choose phases of the cyclic hazards so enough straight lanes stay open
  for (const h of b.hazards) {
    if (h.kind === "claw" || h.kind === "roller" || h.mode === "static") continue;
    const need = b.minSafe.get(h.id) ?? 1;
    const ls = b.rows[h.s].tiles.map((t) => t.x);
    let bestPhase = 0, bestScore = -99;
    for (let tries = 0; tries < 24; tries++) {
      h.phase = rng.next();
      let safe = 0;
      for (const x of ls) {
        let hit = false;
        const reach = hazardReach(h) + 0.6;
        for (let s = h.s - reach; s <= h.s + reach && !hit; s += 0.1) hit = hazardHits(h, beatAt(bRow, s), x, s, 0, 0);
        if (!hit) safe++;
      }
      const score = safe >= need ? 10 - Math.abs(safe - need - (h.kind === "mallet" ? 1 : 0)) : -1;
      if (score > bestScore) { bestScore = score; bestPhase = h.phase; }
      if (safe >= need && safe <= need + 1) break;
    }
    h.phase = bestPhase;
  }

  // tips for concepts that are new in this level
  const tips: Tip[] = [];
  rec.news.forEach((id, i) => {
    const c = CONCEPT[id];
    if (!c) return;
    const z = zones.find((zz) => zz.concept === id) ?? zones[0];
    tips.push({ s: Math.max(3, z.from + (z.from === 0 ? 4 : 2) + i * 2), id, title: c.name, text: HINT[id] ?? (c.desc ? c.desc[0].toUpperCase() + c.desc.slice(1) + "!" : `Something new: ${c.name}!`) });
  });
  tips.sort((p, q) => p.s - q.s);

  const usedConcepts = new Set<string>(rec.concepts.filter((c) => c !== "REMIX"));
  zones.forEach((z) => { if (z.concept) usedConcepts.add(z.concept); });
  usedConcepts.add(`W${String(rec.world).padStart(2, "0")}`);
  zones.forEach((z) => usedConcepts.add(z.style));

  const base = {
    id: rec.id, kind: rec.kind, world: rec.world, name: rec.name, seed, bpm: rec.bpm, rows: b.rows, finish, zones, checkpoints,
    hazards: b.hazards, jumps: b.jumps, forces: b.forces, walls: b.walls, bRow, tips, chase: zones.some((z) => !!z.rules.chase || !!z.boss),
    news: rec.news, concepts: [...usedConcepts], fusion: rec.fusion, oneLife: rec.oneLife,
    song: {
      bpm: rec.bpm, root: rec.root, seed,
      zones: zones.map((z) => ({ beat0: z.beat0, beats: z.beats, mood: z.mood, section: z.section, intensity: z.intensity, style: z.style, silence: z.rules.silence })),
      beats: bRow[finish] + 24,
    },
  };
  const sol = solve(base, near, b.color);
  if (!sol) return null;
  const pickups = placePickups(base, sol, b.risky, rng, rec.extras, !!rec.run);
  return { ...base, line: sol.line, pickups };
}

const HINT: Record<string, string> = {
  F01: "Drag left or right anywhere on the screen to steer Momo.", F02: "Narrow bridge! Keep Momo right in the middle.", F03: "Sharp corners — steer early into each turn!",
  F04: "Follow the curve with small, smooth moves.", F05: "Pink pads fling you — steer in the air to land on the next island.", F06: "Holes everywhere! Hop from tile to tile.",
  F08: "The path splits. The narrow side hides a Golden Sprout!", F10: "The road gets thin — get to the middle early.", F12: "Steps down! Momo drops to the next level.",
  F13: "Pads launch you up to higher platforms.", F15: "The floor rolls like a wave — hold your line.", F16: "The board tilts — lean against the slide!",
  F19: "The islands drift sideways — ride with them.", F22: "Conveyor floor pushes you — steer against it.", F23: "A hedge maze! Look for the open lane.",
  T01: "Roll onto a pink pad to fly over a gap!", T03: "Zoom! Arrows make Momo roll super fast.", T05: "Ice! Momo slides — steer gently.",
  T06: "Sticky jelly slows your steering.", T07: "Bouncy jelly — boing boing!", T08: "Shaky tiles fall away! Stay on the solid ones.",
  T10: "Blinking tiles appear on the beat — roll on the bright ones.", T12: "Only tiles in YOUR colour are solid!", T14: "Mirror tile! Left and right are swapped for a while.",
  T15: "Teleport pads zap you to a new lane!", T16: "Gravity flip — the world turns upside down!", T17: "Tiny Momo!", T18: "Giant Momo!",
  T20: "Arrows push you sideways.", T21: "Roll over the plate to build the bridge!", T23: "Piano keys play a song as you roll!",
  H01: "Mallets swing to the music. Roll past on the other side!", H02: "Spinners turn to the beat — slip between the arms.", H05: "Crushers slam down — watch the red marks!",
  H06: "Pillars pop up on the beat!", H08: "Barrels roll at you — change lanes!", H11: "Lasers switch on and off with the music.",
  H21: "Wind pushes Momo — steer against it!", H29: "Lights out! Tiles glow only on the beat.", H30: "Foggy! Look closely.", H31: "Red marks = a claw slams down on the beat. Dodge it!",
  R12: "Kranky is chasing you — keep rolling!", R16: "Remember the path — it hides as you get close!", R21: "One life — no checkpoints!",
};

function placePickups(L: Omit<Level, "line" | "pickups">, sol: Solve, risky: { s: number; x: number }[], rng: Rng, extras: string[], run = false): Pickup[] {
  const out: Pickup[] = [];
  const n = L.rows.length;
  const jumpAt = (s: number) => L.jumps.find((j) => s > j.s0 && s < j.s1);
  const yAt = (s: number) => { const j = jumpAt(s); return 0.42 + (j ? jumpY(j, s, L.rows) - L.rows[Math.round(s)].h : 0); };
  const busy = (s: number) => L.hazards.some((h) => Math.abs(h.s - s) < 2.5);
  const first = 10, last = L.finish - 8;
  const runs = 6;
  for (let r = 0; r < runs; r++) {
    let s0 = Math.round(first + ((r + 0.35) / runs) * (last - first));
    const pad = L.jumps.find((j) => j.s0 >= s0 - 14 && j.s0 <= s0 + 14 && j.s1 < last);
    if (pad) s0 = pad.s0 - 1;
    let placed = 0;
    for (let s = s0; s < last && placed < 4; s += 3) {
      if (busy(s)) continue;
      out.push({ id: 0, kind: "bead", s, x: sol.line[s], y: yAt(s) });
      placed++;
    }
  }
  // the endless run: long coin trails all along the par line, a booster and a heart per piece
  if (run) {
    for (let s = first; s < last; s += 13 + rng.int(0, 6)) {
      const n = 4 + rng.int(0, 4);
      for (let k = 0; k < n; k++) { const ss = s + k * 2; if (ss < last && !busy(ss) && !out.some((p) => p.s === ss)) out.push({ id: 0, kind: "bead", s: ss, x: sol.line[ss], y: yAt(ss) }); }
    }
    const sb = Math.round(first + (last - first) * (0.3 + rng.next() * 0.2));
    for (let s = sb; s < last; s++) if (!busy(s) && !jumpAt(s)) { out.push({ id: 0, kind: "booster", s, x: sol.line[s], y: yAt(s) + 0.1 }); break; }
    // the heart sits a little off the safe line: a small risk for a big reward
    const sh0 = Math.round(first + (last - first) * (0.55 + rng.next() * 0.25));
    let heart: Pickup | null = null;
    for (let s = sh0; s < last && !heart; s++) {
      if (busy(s) || jumpAt(s)) continue;
      for (const dx of [1, -1, 2, -2]) { const x = sol.line[s] + dx; if (x >= -LANES && x <= LANES && sol.valid[s * NL + li(x)]) { heart = { id: 0, kind: "life", s, x, y: yAt(s) + 0.1 }; break; } }
    }
    if (heart) out.push(heart);
  }
  // bead rain zones: extra beads
  for (const z of L.zones) if (z.rules.beadRain) for (let s = z.from + 4; s < z.to - 4; s += 3) if (!busy(s) && out.length < 60) out.push({ id: 0, kind: "bead", s, x: sol.line[s], y: yAt(s) });
  const thirds = [0, 1, 2].map((k) => [Math.max(12, Math.floor((k / 3) * L.finish)), Math.floor(((k + 1) / 3) * L.finish) - 5]);
  for (const [a, z] of thirds) {
    let best: { s: number; x: number; score: number } | null = null;
    for (let s = a; s < z; s++) {
      for (let x = -LANES; x <= LANES; x++) {
        if (!sol.valid[s * NL + li(x)]) continue;
        const off = Math.abs(x - sol.line[s]);
        if (off < 1.5 || off > (jumpAt(s) ? 2 : 2.5)) continue;
        let score = 2 + rng.next() * 0.5;
        if (risky.some((p) => p.s === s && p.x === x)) score += 4;
        if (jumpAt(s)) score += 1.5;
        for (let dd = -2; dd <= 2; dd++) for (const dx of [-1, 1]) if (!sol.valid[Math.max(0, Math.min(n - 1, s + dd)) * NL + li(Math.max(-LANES, Math.min(LANES, x + dx)))]) score += 0.25;
        if (busy(s)) score += 0.5;
        if (!best || score > best.score) best = { s, x, score };
      }
    }
    const pick = best ?? { s: Math.round((a + z) / 2), x: sol.line[Math.round((a + z) / 2)] };
    out.push({ id: 0, kind: "sprout", s: pick.s, x: pick.x, y: yAt(pick.s) + 0.08 });
  }
  // extras along the par line
  const spot = (frac: number) => {
    for (let k = 0; k < 40; k++) {
      const s = Math.round(L.finish * frac) + k;
      if (s > 8 && s < L.finish - 4 && !busy(s) && !out.some((p) => Math.abs(p.s - s) < 2)) return s;
    }
    return Math.round(L.finish * frac);
  };
  for (const e of extras) {
    if (e === "X03") "MOMO".split("").forEach((ch, i) => { const s = spot(0.15 + i * 0.2); out.push({ id: 0, kind: "letter", s, x: sol.line[s], y: yAt(s), ab: ch }); });
    else if (e === "X05") { const s = spot(0.62); const x = sol.line[s] + (sol.valid[s * NL + li(sol.line[s] + 1)] ? 1 : sol.valid[s * NL + li(sol.line[s] - 1)] ? -1 : 0); out.push({ id: 0, kind: "key", s, x, y: yAt(s) }); }
    else if (e === "X06") { const s = spot(0.5); out.push({ id: 0, kind: "statue", s, x: sol.line[s], y: yAt(s) }); }
    else if (e === "X07") for (let i = 0; i < 5; i++) { const s = spot(0.1 + i * 0.17); out.push({ id: 0, kind: "note", s, x: sol.line[s], y: yAt(s) + 0.3 }); }
    else if (e === "X08" || e === "R23") for (let i = 0; i < 5; i++) { const s = spot(0.12 + i * 0.17); out.push({ id: 0, kind: "baby", s, x: sol.line[s], y: yAt(s) }); }
    else if (e === "X09") { const s = spot(0.4); out.push({ id: 0, kind: "box", s, x: sol.line[s], y: yAt(s) }); }
    else if (ABIL.has(e)) { const s = spot(0.08); out.push({ id: 0, kind: "power", s, x: sol.line[s], y: yAt(s), ab: e }); const s2 = spot(0.55); out.push({ id: 0, kind: "power", s: s2, x: sol.line[s2], y: yAt(s2), ab: e }); }
  }
  out.sort((p, q) => p.s - q.s);
  out.forEach((p, i) => { p.id = i; });
  return out;
}

// ---------------------------------------------------------------- endless run helpers
function placeGrumpies(b: B0, rec: LevelRecipe, rng: Rng) {
  const d = Math.min(1, 0.3 + rec.id * 0.004);
  const every = Math.max(5, Math.round(13 - d * 7));
  const hazRows = new Set<number>();
  for (const h of b.hazards) for (let s = h.s - 3; s <= h.s + 3; s++) hazRows.add(s);
  for (const j of b.jumps) for (let s = j.s0 - 2; s <= j.s1 + 1; s++) hazRows.add(s);
  for (let s = 14; s < b.rows.length - 10; s += every + rng.int(0, 4)) {
    const row = b.rows[s];
    const solidRow = (r: Row | undefined) => !!r && r.tiles.length >= 3 && r.tiles[r.tiles.length - 1].x - r.tiles[0].x + 1 === r.tiles.length && r.tiles.every((t) => t.k === TK.grass && !t.mv);
    if (hazRows.has(s) || b.air.has(s) || ![-2, -1, 0, 1, 2].every((d) => solidRow(b.rows[s + d]) && !b.air.has(s + d))) continue;
    const n = row.tiles.length >= 5 && rng.chance(0.4 + d * 0.3) ? 2 : 1;
    const xs = [...row.tiles.map((t) => t.x)];
    for (let k = 0; k < n && xs.length > 2; k++) {
      const x = xs.splice(rng.int(0, xs.length - 1), 1)[0];
      addHaz(b, { kind: "slider", s, x, size: 0, period: 4, phase: 0, dir: 1, skin: "grumpy", w: 0.8, mode: "static" }, 1);
    }
  }
}

const shiftPhase = (ph: number, base: number, period: number) => (((ph - base / period) % 1) + 1) % 1;

/** glue the next piece of the endless run onto the end of the track (mutates L) */
export function appendChunk(L: Level, C: Level) {
  const base = L.rows.length;
  const baseBeat = L.bRow[L.rows.length];
  const hOff = L.rows[L.rows.length - 1].h - C.rows[0].h;
  const zOff = L.zones.length;
  for (const r of C.rows) {
    L.rows.push({
      ...r, zone: r.zone + zOff, h: r.h + hOff,
      tiles: r.tiles.map((t) => ({
        ...t,
        drop: t.drop !== undefined ? t.drop + baseBeat : undefined,
        par: t.par !== undefined ? t.par + baseBeat : undefined,
        mv: t.mv ? { ...t.mv, phase: shiftPhase(t.mv.phase, baseBeat, t.mv.period) } : undefined,
        g: t.g !== undefined ? t.g + base : undefined,
      })),
    });
  }
  const bRow = new Float64Array(L.rows.length + 1);
  bRow.set(L.bRow.subarray(0, base));
  for (let i = 0; i <= C.rows.length; i++) bRow[base + i] = C.bRow[i] + baseBeat;
  L.bRow = bRow;
  const line = new Float32Array(L.rows.length);
  line.set(L.line.subarray(0, base));
  line.set(C.line, base);
  L.line = line;
  const hz0 = L.hazards.length;
  C.hazards.forEach((h, i) => L.hazards.push({
    ...h, id: hz0 + i, s: h.s + base,
    slam: h.slam !== undefined ? h.slam + baseBeat : undefined,
    phase: h.kind === "claw" ? (((h.phase + baseBeat / Math.max(1, h.period)) % 1) + 1) % 1 : shiftPhase(h.phase, baseBeat, h.period),
  }));
  for (const j of C.jumps) L.jumps.push({ ...j, s0: j.s0 + base, s1: j.s1 + base });
  for (const f of C.forces) L.forces.push({ ...f, s0: f.s0 + base, s1: f.s1 + base, phase: f.period ? shiftPhase(f.phase ?? 0, baseBeat, f.period) : f.phase });
  for (const w of C.walls) L.walls.push({ s0: w.s0 + base, s1: w.s1 + base });
  const p0 = L.pickups.length;
  C.pickups.forEach((p, i) => L.pickups.push({ ...p, id: p0 + i, s: p.s + base }));
  for (const z of C.zones) L.zones.push({ ...z, from: z.from + base, to: z.to + base, beat0: z.beat0 + baseBeat });
  for (const s of C.checkpoints) L.checkpoints.push(s + base);
  L.checkpoints.push(C.finish + base);
  for (const t of C.tips) L.tips.push({ ...t, s: t.s + base });
  for (const z of C.song.zones) L.song.zones.push({ ...z, beat0: z.beat0 + baseBeat });
  L.song.beats = L.bRow[L.rows.length] + 24;
  L.finish = C.finish + base;
  L.concepts = [...new Set([...L.concepts, ...C.concepts])];
  L.chase = L.chase || C.chase;
  return { base, baseBeat };
}

/** deep copy (the run mutates its level; the cached chunk must stay pristine) */
export function cloneLevel(L: Level): Level {
  return {
    ...L,
    rows: L.rows.map((r) => ({ ...r, tiles: r.tiles.map((t) => ({ ...t, mv: t.mv ? { ...t.mv } : undefined })) })),
    zones: L.zones.map((z) => ({ ...z, rules: { ...z.rules } })), checkpoints: [...L.checkpoints], hazards: L.hazards.map((h) => ({ ...h })),
    pickups: L.pickups.map((p) => ({ ...p })), jumps: L.jumps.map((j) => ({ ...j })), forces: L.forces.map((f) => ({ ...f })), walls: L.walls.map((w) => ({ ...w })),
    bRow: new Float64Array(L.bRow), line: new Float32Array(L.line), tips: L.tips.map((t) => ({ ...t })), concepts: [...L.concepts],
    song: { ...L.song, zones: L.song.zones.map((z) => ({ ...z })) },
  };
}

/** one piece of the endless run built from any recipe (Journey content, then fusion) */
export function runChunk(rec: LevelRecipe, key: string): Level {
  return buildRecipe({ ...rec, run: true, news: [], zones: rec.zones.slice(0, Math.max(3, rec.zones.length - 1)) }, "run:" + key);
}

// ---------------------------------------------------------------- journey levels
export const JOURNEY_LEN = JOURNEY.length * 10;
export const levelMeta = (n: number) => {
  const wi = Math.max(0, Math.min(JOURNEY.length - 1, Math.floor((n - 1) / 10)));
  const [name, ids] = JOURNEY[wi].levels[(n - 1) % 10];
  return { n, world: wi + 1, name, ids };
};

/** concepts introduced for the first time at journey level n */
const FIRST = (() => {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (let n = 1; n <= JOURNEY_LEN; n++) {
    const fresh = levelMeta(n).ids.filter((c) => c !== "REMIX" && !seen.has(c) && CONCEPT[c] && !"WMX".includes(c[0]));
    fresh.forEach((c) => seen.add(c));
    out[n] = fresh.slice(0, 3);
  }
  return out;
})();

export function journeyRecipe(n: number, salt = 0): LevelRecipe {
  const m = levelMeta(n);
  const W = worldOf(m.world);
  return compile({
    id: n, kind: "journey", world: m.world, name: m.name, concepts: m.ids, d: journeyDifficulty(n), bpm: journeyBpm(n),
    seed: hash32(0x5ce, n, salt), news: FIRST[n] ?? [], blurb: W.blurb,
    zones: n <= 3 ? 4 : n % 10 === 0 ? 6 : 5,
  });
}

export function titleRecipe(): LevelRecipe {
  return compile({ id: 0, kind: "title", world: 1, name: "Title", concepts: ["F04", "T01", "H02", "F03", "H01"], d: 0.25, bpm: 108, seed: 77, zones: 5, moods: ["meadow", "sunflower", "mushroom", "sunset", "night"] });
}

const cache = new Map<string, Level>();
/** Build any recipe; deterministic; rerolls the seed until a par line exists. */
export function buildRecipe(rec: LevelRecipe, key: string): Level {
  const hit = cache.get(key);
  if (hit) return hit;
  let lvl: Level | null = null;
  for (let k = 0; k < 24 && !lvl; k++) lvl = attempt(rec, hash32(0x5ce, rec.id, k, key.length));
  if (!lvl) {
    // last resort: the same zones without hazards (never leave a player stuck)
    const safe: LevelRecipe = { ...rec, calm: true, zones: rec.zones.map((z) => ({ ...z, segs: z.segs.filter((s) => s.k !== "haz") })) };
    lvl = attempt(safe, hash32(0x5ce, rec.id, 99));
  }
  if (!lvl) throw new Error(`Sky Roll: ${key} has no solution`);
  if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  cache.set(key, lvl);
  return lvl;
}

/** Journey level n (1..200); 0 = title attract level */
export function buildLevel(n: number, salt = 0): Level {
  return n === 0 ? buildRecipe(titleRecipe(), "title") : buildRecipe(journeyRecipe(n, salt), `j:${n}:${salt}`);
}

export function zoneAt(L: Level, s: number) {
  const Z = L.zones;
  let lo = 0, hi = Z.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s >= Z[m].from) lo = m; else hi = m - 1; }
  return lo;
}
