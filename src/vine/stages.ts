// Stages: the schedule (which world, which concepts, how fast, how tight) and the generator that lays a stage's
// hazards, gaps, bugs, pickups and zones along a seeded vine. Fairness is built in: every side-forcing hazard leaves
// the other side clear, and two decisions that ask for different sides are at least one reaction window apart (in
// metres at the stage's speed). The bot sweep (scripts/vine_sweep.mjs) then proves it with human-like reaction times.
import { buildPath, markPath, mulberry, pick, planarSpan, range, type Rng } from "./path";
import { CAMPAIGN, CONCEPTS, GUARDIANS, WORLDS, stageIn, worldOf } from "./worlds";
import type { Bug, Fork, Gap, Haz, HazKind, Pick, PickKind, Side, Stage, StageDef, Zone } from "./types";

export const DAILY_BASE = 100000;
export const WILD_FROM = CAMPAIGN + 1;
/** days since 2026-01-01 (UTC) */
export const dayNumber = (t = Date.now()) => Math.floor((t - Date.UTC(2026, 0, 1)) / 86400000);
export const weekNumber = (t = Date.now()) => Math.floor(dayNumber(t) / 7);

/** global modifiers (one stage-wide effect each); the rest are patterns laid along the vine */
const GLOBAL = new Set(["chase", "grow", "wither", "rival", "mirror", "egg", "night", "monsoon", "fog", "hairpin", "spiral", "bamboo"]);
const EXCLUSIVE = ["chase", "grow", "wither"];
/** concepts a stage can mix (everything but the special stage kinds) */
export const MIXABLE = [...new Set(WORLDS.flatMap((w) => w.adds))];
/** weekly twists for Wild Canopy and Daily Vine */
export const SEASONS: { key: string; name: string }[] = [
  { key: "monsoon", name: "Monsoon Week" }, { key: "night", name: "Firefly Week" }, { key: "bamboo", name: "Bamboo Week" },
  { key: "wind", name: "Windy Week" }, { key: "fog", name: "Misty Week" }, { key: "feast", name: "Feast Week" },
  { key: "rhythm", name: "Rhythm Week" }, { key: "pods", name: "Seed Week" },
];
export const seasonOf = (week = weekNumber()) => SEASONS[((week % SEASONS.length) + SEASONS.length) % SEASONS.length];

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const speedOf = (d: number) => 3.2 + 4.0 * d;
export const windowOf = (d: number) => 1.1 - 0.68 * Math.min(1.05, d);

/** the campaign's stage n (1..600) */
export function campaignDef(n: number): StageDef {
  const w = worldOf(n), k = stageIn(n), wi = w.n - 1;
  const r = mulberry(n * 7919 + 13);
  const t = (n - 1) / (CAMPAIGN - 1);
  let d = clamp(Math.pow(t, 0.92) + (-0.06 + 0.1 * ((k - 1) / 18)), 0, 1);
  // what earlier worlds taught
  const pool = [...new Set(WORLDS.slice(0, wi + 1).flatMap((x) => x.adds))];
  const older = pool.filter((c) => !w.adds.includes(c));
  let kind: StageDef["kind"] = "normal";
  let concepts: string[];
  if (k === 5 || k === 15) { kind = "gold"; d *= 0.62; concepts = ["gold", ...(n > 20 ? [pick(r, w.adds)] : [])]; }
  else if (k === 10) { kind = "long"; d = clamp(d + 0.03, 0, 1); concepts = [...w.adds, ...pickN(r, older, 2)]; }
  else if (k === 20) { kind = "crown"; d = clamp(d + 0.05, 0, 1); concepts = ["crown", ...(w.n > 1 ? pickN(r, older, 1) : [])]; }
  else if (k <= 3) concepts = k === 1 ? [w.adds[0]] : [w.adds[0], ...(n > 3 ? ["classic"] : [])];
  else if (k === 4) concepts = [...w.adds];
  else concepts = [pick(r, w.adds), ...pickN(r, older, k >= 7 && r() < 0.35 + d * 0.5 ? 2 : 1)];
  if (n <= 2) concepts = ["classic"];
  concepts = tidy(concepts, r);
  const lenK = kind === "long" ? 2 : kind === "gold" ? 0.7 : kind === "crown" ? 1.15 : 1;
  return {
    n, world: wi, k, kind, concepts, d, speed: speedOf(d), win: windowOf(d), length: Math.round((150 + 270 * d) * lenK), seed: n * 104729 + 7,
    guardian: kind === "crown" ? w.guardian : undefined,
    name: kind === "crown" ? GUARDIANS[w.guardian].name : CONCEPTS[concepts[0]]?.name ?? "Vine",
  };
}
function pickN(r: Rng, a: string[], k: number) { const b = [...a]; const out: string[] = []; while (out.length < k && b.length) out.push(b.splice(Math.floor(r() * b.length), 1)[0]); return out; }
/** at most one of chase / grow / wither; no gaps with a growing vine */
function tidy(c: string[], r: Rng) {
  let out = [...new Set(c)];
  const ex = out.filter((x) => EXCLUSIVE.includes(x));
  if (ex.length > 1) { const keep = pick(r, ex); out = out.filter((x) => !EXCLUSIVE.includes(x) || x === keep); }
  if (out.includes("grow")) out = out.filter((x) => !["gaps", "lotus", "twin", "flower", "swing"].includes(x));
  return out;
}

/** Wild Canopy stage n (≥ 601) — `variant` re-rolls a stage whose fingerprint was seen already */
export function wildDef(n: number, variant = 0, week = weekNumber()): StageDef {
  const r = mulberry(n * 92821 + variant * 7919 + 31);
  const k = n - WILD_FROM, wave = Math.floor(k / 10), inWave = k % 10;
  const d = clamp(0.9 + wave * 0.012, 0, 1.08) * (inWave === 0 ? 0.82 : 1);
  const world = Math.floor(r() * WORLDS.length);
  const crown = inWave === 9;
  const season = seasonOf(week).key;
  const patterns = MIXABLE.filter((c) => !GLOBAL.has(c));
  const globals = MIXABLE.filter((c) => GLOBAL.has(c));
  let concepts = crown ? ["crown", pick(r, patterns)] : [...pickN(r, patterns, 2 + (r() < 0.4 ? 1 : 0)), ...(r() < 0.6 ? [pick(r, globals)] : [])];
  if (!concepts.includes(season)) concepts.push(season);
  concepts = tidy(concepts, r);
  const g = crown ? pick(r, Object.keys(GUARDIANS)) : undefined;
  return {
    n, world, k: 0, kind: "wild", concepts, d, speed: speedOf(d), win: windowOf(d), length: Math.round((150 + 270 * Math.min(1, d)) * (crown ? 1.15 : 1)),
    seed: n * 15485863 + variant * 31 + 3, guardian: g, twist: season, name: crown && g ? GUARDIANS[g].name : CONCEPTS[concepts[0]]?.name ?? "Wild Vine",
  };
}
export const wildPrint = (d: StageDef) => `${d.world}|${[...d.concepts].sort().join("+")}|${d.guardian ?? ""}`;

/** the Daily Vine for a day: same for everyone */
export function dailyDef(day: number): StageDef {
  const r = mulberry(day * 2654435761 + 99);
  const patterns = MIXABLE.filter((c) => !GLOBAL.has(c));
  const concepts = tidy([...pickN(r, patterns, 3), seasonOf(Math.floor(day / 7)).key], r);
  const d = 0.58;
  return { n: DAILY_BASE + day, world: day % WORLDS.length, k: 0, kind: "daily", concepts, d, speed: speedOf(d), win: windowOf(d), length: 260, seed: day * 7331 + 5, name: "Daily Vine" };
}

export function stageDef(n: number, variant = 0): StageDef {
  if (n >= DAILY_BASE) return dailyDef(n - DAILY_BASE);
  if (n >= WILD_FROM) return wildDef(n, variant);
  return campaignDef(Math.max(1, n));
}

// ------------------------------------------------------------------------------------------------- the generator
interface Ctx {
  r: Rng; d: number; v: number; win: number;
  /** metres between two decisions that ask for different sides */
  gap: number;
  s: number; end: number;
  st: Stage;
  /** side-lethal spans already placed per side: [a, b] */
  lethal: Record<string, [number, number][]>;
  /** the last forced side and where */
  force: { s: number; side: Side };
  /** spans where nothing else may go (gaps, landings, forks) */
  keep: [number, number][];
  id: number;
  world: number;
  globals: Set<string>;
  /** the player's side is unknown here (after a fork or a leap): the next decision needs a full window */
  free: boolean;
}

const LEAP_MIN = 1.0;
/** how far a leap carries Tondu (from the leap mark to after the far side) */
export const leapWindow = (v: number) => Math.max(LEAP_MIN, v * 0.42);
export const leapLength = (g: Gap, v: number) => g.s1 - g.s0 + leapWindow(v) + 0.6;

function overlaps(list: [number, number][], a: number, b: number) { return list.some(([x, y]) => b > x && a < y); }
function blocked(c: Ctx, a: number, b: number) { return overlaps(c.keep, a, b) || a < 6 || b > c.end; }

/** a side-lethal hazard (or a one-shot on a side): keeps the other side clear and decisions a window apart */
function sideHaz(c: Ctx, kind: HazKind, s: number, len: number, side: Side, extra: Partial<Haz> = {}, br?: Side, maxS = Infinity): number | null {
  const need = c.force.side !== -side || c.free ? c.gap + c.v * 0.18 : 0.6;
  if (s - c.force.s < need) s = c.force.s + need;
  if (s > maxS) return null;
  const a = s - len / 2, b = s + len / 2, m = c.v * 0.25 + 0.4;
  if (blocked(c, a - 0.5, b + 0.5)) return null;
  const other = c.lethal[String(-side) + (br ?? "")] ?? [];
  if (overlaps(other, a - m, b + m)) return null;
  c.st.haz.push({ id: c.id++, kind, s, len, side, ...(br ? { br } : {}), ...extra });
  (c.lethal[String(side) + (br ?? "")] ??= []).push([a, b]);
  c.force = { s: b, side: (-side) as Side }; c.free = false;
  return s;
}
/** a both-sides timed hazard (periodic): needs room before and after */
function bothHaz(c: Ctx, kind: HazKind, s: number, len: number, extra: Partial<Haz>): number | null {
  if (s - c.force.s < c.gap * 0.8) s = c.force.s + c.gap * 0.8;
  const a = s - len / 2 - 0.3, b = s + len / 2 + 0.3;
  if (blocked(c, a, b) || overlaps(c.lethal["1"] ?? [], a - 1, b + 1) || overlaps(c.lethal["-1"] ?? [], a - 1, b + 1)) return null;
  c.st.haz.push({ id: c.id++, kind, s, len, side: 0, ...extra });
  c.keep.push([a - c.v * 0.3, b + c.gap * 0.6]);
  c.force = { s: b + c.gap * 0.3, side: c.force.side };
  return s;
}
/** room after a timed gate so the next one can be waited out too (clinging covers ~30% speed) */
function waitRoom(c: Ctx, period: number, on: number) { return Math.max(c.gap, c.v * period * on * 0.9 + 1.5); }
function bug(c: Ctx, s: number, side: 0 | 1 | -1, kind = c.world, br?: Side) { if (s > 5 && s < c.end + 4) c.st.bugs.push({ s, side, kind, ...(br ? { br } : {}) }); }
function bugLine(c: Ctx, s: number, n: number, side: Side, gold = false, br?: Side) { for (let i = 0; i < n; i++) bug(c, s + i * 0.75, side, gold ? -1 : c.world, br); }
const sideR = (c: Ctx): Side => (c.r() < 0.5 ? 1 : -1);
/** the next side to make the player flip to (alternates more often as it gets harder) */
const nextSide = (c: Ctx): Side => (c.r() < 0.5 + 0.3 * c.d ? (-c.force.side as Side) : c.force.side);

type Pattern = (c: Ctx) => void;
const P: Record<string, Pattern> = {
  classic(c) {
    const n = 3 + Math.floor(c.r() * (3 + 4 * c.d));
    for (let i = 0; i < n && c.s < c.end; i++) {
      const side = (-nextSide(c)) as Side; // the lethal side
      const s = sideHaz(c, "thorn", c.s + range(c.r, 0.3, 1.2) * c.gap * (1 - 0.35 * c.d), range(c.r, 0.5, 0.85 + 0.25 * c.d), side);
      if (s !== null) { c.s = s; if (c.r() < 0.6) bugLine(c, s + 0.9, 1 + Math.floor(c.r() * 3), (-side) as Side); }
      else c.s += c.gap * 0.5;
    }
  },
  storm(c) {
    const n = 6 + Math.floor(c.r() * 6);
    for (let i = 0; i < n && c.s < c.end; i++) {
      const side = (c.r() < 0.7 ? c.force.side : -c.force.side) as Side;
      const s = sideHaz(c, "thorn", c.s + c.gap * range(c.r, 0.05, 0.35), range(c.r, 0.6, 1.1), side);
      if (s !== null) c.s = s; else c.s += c.gap * 0.4;
    }
  },
  feast(c) {
    let side = c.force.side;
    for (let i = 0; i < 3 && c.s < c.end; i++) {
      const n = 5 + Math.floor(c.r() * 6);
      bugLine(c, c.s + 0.8, n, side, c.r() < 0.25);
      c.s += 0.8 + n * 0.75;
      const s = sideHaz(c, "thorn", c.s + 0.6, 0.6, side);
      if (s !== null) { c.s = s; side = (-side) as Side; }
    }
  },
  gold(c) {
    for (let i = 0; i < 4 && c.s < c.end; i++) {
      bugLine(c, c.s + 0.5, 6 + Math.floor(c.r() * 5), c.force.side, true);
      c.s += 6;
      const s = sideHaz(c, "thorn", c.s + c.gap * 1.5, 0.6, c.force.side);
      if (s !== null) c.s = s;
    }
  },
  rhythm(c) {
    const beat = 60 / 112, every = Math.max(1, Math.ceil((c.win + 0.18) / beat));
    const step = c.v * beat * every;
    let side = c.force.side;
    for (let i = 0; i < 6 + c.d * 6 && c.s < c.end; i++) {
      const s = sideHaz(c, "thorn", c.s + step, 0.6, side);
      if (s === null) break;
      c.s = s; side = (-side) as Side;
    }
  },
  cling(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 3) && c.s < c.end; i++) {
      const period = range(c.r, 2.6, 1.9 - 0.2 * c.d), on = range(c.r, 0.38, 0.5);
      const s = bothHaz(c, "bud", c.s + c.gap, 0.8, { period, phase: c.r() * period, on, warn: 0.3 });
      if (s === null) { c.s += c.gap; continue; }
      c.s = s + waitRoom(c, period, on); bug(c, s + 1.2, c.force.side);
    }
  },
  bees(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 3) && c.s < c.end; i++) {
      const period = range(c.r, 2.4, 1.7 - 0.2 * c.d), on = range(c.r, 0.3, 0.42);
      const s = bothHaz(c, "bees", c.s + c.gap, 0.7, { period, phase: c.r() * period, on, warn: 0.4 });
      if (s === null) { c.s += c.gap; continue; }
      c.s = s + waitRoom(c, period, on);
    }
  },
  caterpillar(c) {
    const period = range(c.r, 3.2, 2.5), s = bothHaz(c, "crawler", c.s + c.gap, 1.2, { period, phase: c.r() * period, on: 0.45, warn: 0.5 });
    c.s = (s ?? c.s) + waitRoom(c, period, 0.45);
  },
  ants(c) {
    const side = sideR(c), L = range(c.r, 2.4, 3.6), period = range(c.r, 2.6, 2.1), at = c.s + c.gap * 1.2;
    if (blocked(c, at - 1, at + L + 1)) { c.s += c.gap; return; }
    c.st.haz.push({ id: c.id++, kind: "ants", s: at + L / 2, len: L, side, period, phase: c.r() * period, on: 0.5, warn: 0.4 });
    (c.lethal[String(side)] ??= []).push([at, at + L]);
    c.force = { s: at + L, side: (-side) as Side };
    c.s = at + L + 0.5;
  },
  spider(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 2) && c.s < c.end; i++) {
      const period = range(c.r, 2.2, 1.7);
      const s = bothHaz(c, "spider", c.s + c.gap, 0.8, { period, phase: c.r() * period, on: 0.4, warn: 0.45 });
      c.s = (s ?? c.s + c.gap) + waitRoom(c, period, 0.4);
    }
  },
  burrs(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 3) && c.s < c.end; i++) {
      const side = (-nextSide(c)) as Side, vb = -(1.4 + 2 * c.d), trig = (c.v + -vb) * (c.win + 1.0);
      const at = c.s + trig;
      if (blocked(c, c.s, at + 1)) { c.s += c.gap; continue; }
      if (overlaps(c.lethal[String(-side)] ?? [], c.s - 0.5, at + 0.8)) { c.s += c.gap; continue; }
      c.st.haz.push({ id: c.id++, kind: "burr", s: at, len: 0.7, side, v: vb, trig, warn: 0.6 });
      (c.lethal[String(side)] ??= []).push([c.s, at + 0.5]);
      c.force = { s: at, side: (-side) as Side };
      c.s = at - trig * 0.4 + c.gap;
    }
  },
  snail(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 2) && c.s < c.end; i++) {
      const side = (-nextSide(c)) as Side, vs = range(c.r, 0.4, 0.8), trig = c.v * (c.win + 1.6), at = c.s + c.gap;
      const reach = at + vs * (trig / Math.max(0.5, c.v - vs)) + 1.2;
      if (blocked(c, at - 0.5, reach + 1) || overlaps(c.lethal[String(-side)] ?? [], at - 1, reach + 1)) { c.s += c.gap; continue; }
      c.st.haz.push({ id: c.id++, kind: "snail", s: at, len: 0.8, side, v: vs, trig });
      (c.lethal[String(side)] ??= []).push([at - 0.5, reach]);
      c.force = { s: reach, side: (-side) as Side };
      c.s = reach;
    }
  },
  fruit(c) { drops(c, "fruit"); },
  nuts(c) { drops(c, "nut"); },
  lightning(c) { drops(c, "lightning", 0.75, 0.5, 1.3); },
  pods(c) { drops(c, "pod", 0.45, 30, 0.7); },
  wind(c) {
    for (let i = 0; i < 2 + Math.floor(c.d * 3) && c.s < c.end; i++) {
      const period = range(c.r, 3.0, 2.0 - 0.3 * c.d), at = c.s + c.gap * 1.2;
      if (blocked(c, at - 1, at + 1) || overlaps(c.lethal["1"] ?? [], at - 1.5, at + 1.5) || overlaps(c.lethal["-1"] ?? [], at - 1.5, at + 1.5)) { c.s += c.gap; continue; }
      c.st.haz.push({ id: c.id++, kind: "swing", s: at, len: 0.7, side: sideR(c), period, phase: c.r() * period, alt: true, warn: 0.3 });
      c.keep.push([at - 0.8, at + 0.8]);
      c.force = { s: at + c.gap * 0.4, side: c.force.side };
      c.s = at + 0.8;
    }
  },
  web(c) { slowZones(c, "web", 0.55); },
  sapdew(c) {
    slowZones(c, "sap", 0.55);
    const side = sideR(c), at = c.s + 1;
    if (!blocked(c, at, at + 6)) { c.st.zones.push({ s0: at, s1: at + 6, kind: "dew", side, f: 1.35 }); bugLine(c, at + 0.5, 6, side); c.s = at + 6; }
  },
  sunbask(c) {
    for (let i = 0; i < 2 && c.s < c.end; i++) {
      const side = sideR(c), L = range(c.r, 6, 10), at = c.s + 1;
      if (blocked(c, at, at + L)) { c.s += 3; continue; }
      c.st.zones.push({ s0: at, s1: at + L, kind: "sun", side });
      c.s = at + L;
      P.classic(c);
      c.st.zones.push({ s0: c.s, s1: c.s + 8, kind: "shade", side: 0, f: 0.85 });
      c.s += 2;
    }
  },
  waterfall(c) { longSides(c, "water", "waterfall"); },
  camo(c) { longSides(c, "shadow", null); },
  hole(c) {
    const L = range(c.r, 18, 26), at = c.s + 1;
    if (blocked(c, at, at + L)) return;
    c.st.zones.push({ s0: at, s1: at + L, kind: "hole", side: 0 });
    P.classic(c);
  },
  gaps(c) { leaps(c, 1 + Math.floor(c.r() * (1 + 2 * c.d)), "leap"); },
  lotus(c) { leaps(c, 3 + Math.floor(c.r() * 2), "leap", true); },
  twin(c) { leaps(c, 3 + Math.floor(c.r() * 2), "leap", true); },
  flower(c) { leaps(c, 2 + Math.floor(c.r() * 2), "flower"); },
  swing(c) { leaps(c, 1 + Math.floor(c.r() * 2), "swing"); },
  fork(c) {
    const L = range(c.r, 16, 22), at = c.s + c.gap * 1.6;
    if (blocked(c, at - 2, at + L + 2) || !planarSpan(c.st.path, at - 2, at + L + 2) || !gentle(c, at, at + L)) { c.s += 4; return; }
    c.st.forks.push({ s0: at, s1: at + L });
    markPath(c.st.path, at, at + L, 2);
    const save = { s: c.s, force: c.force };
    for (const br of [1, -1] as Side[]) {
      c.force = { s: at + 2, side: br };
      let s = at + 2.5 + c.gap * 0.6;
      const rich = br === (c.r() < 0.5 ? 1 : -1);
      while (s < at + L - 2.5) {
        const side = (c.r() < 0.5 ? 1 : -1) as Side;
        const got = sideHaz(c, "thorn", s, 0.6, side, {}, br);
        if (got === null) { s += 1; continue; }
        if (rich) bugLine(c, got + 0.8, 2, (-side) as Side, c.r() < 0.4, br);
        s = got + c.gap * (rich ? 0.9 : 1.4);
      }
      if (!rich) bug(c, at + L / 2, 0, c.world, br);
    }
    c.keep.push([at - c.gap, at + L + 1]);
    c.s = at + L + 1; c.force = { s: at + L, side: save.force.side }; c.free = true;
  },
  crown(c) {
    const g = GUARDIANS[c.st.def.guardian ?? "kaaki1"];
    const phases = 3, per = (c.end - c.s) / phases;
    for (let ph = 0; ph < phases; ph++) {
      const stop = c.s + per;
      const dens = 1 - ph * 0.12;
      while (c.s < stop - 2) {
        const before = c.s;
        switch (g.behaviour) {
          case "dive": drops(c, "dive", 0.8 * dens, 0.45, 1.6, 1); break;
          case "throw": drops(c, c.r() < 0.5 ? "fruit" : "nut", 0.75 * dens, 1.2, 0.8, 2); break;
          case "slide": crawlers(c); break;
          case "drop": P.spider(c); break;
          case "swarm": P.bees(c); if (ph > 0) P.classic(c); break;
          case "shadow": longSides(c, "shadow", null); break;
          case "mimic": P.wind(c); break;
          case "race": P.classic(c); break;
          case "tongue": tongues(c); break;
          case "quake": P.wind(c); drops(c, "fruit", 0.8, 1.2, 0.8, 1); break;
        }
        if (c.s <= before) c.s += 2;
        c.s += c.gap * 0.6;
      }
      bugLine(c, c.s, 4, c.force.side, true);
      c.s += 4;
    }
  },
};

function gentle(c: Ctx, a: number, b: number) {
  const p = c.st.path;
  for (let i = Math.ceil(a / p.ds); i < Math.floor(b / p.ds) - 4; i++) {
    const j = i + 4, dot = p.T[i * 3] * p.T[j * 3] + p.T[i * 3 + 1] * p.T[j * 3 + 1] + p.T[i * 3 + 2] * p.T[j * 3 + 2];
    if (dot < 0.8) return false; // turning faster than ~37° per metre
  }
  return true;
}
/** one-shot drops (fruit, nuts, lightning, pods, dives): armed early enough that they land before Tondu arrives */
function drops(c: Ctx, kind: HazKind, delay = 0.9, dur = 1.3, len = 0.9, n?: number) {
  const count = n ?? 2 + Math.floor(c.d * 3 + c.r() * 2);
  // it stays lethal until Tondu gets there (plus a margin), however fast the drop itself is
  dur = Math.max(dur, 0.35 + c.win * 0.6 + 0.6);
  for (let i = 0; i < count && c.s < c.end; i++) {
    const side = (-nextSide(c)) as Side;
    const trig = c.v * (delay + 0.35 + c.win * 0.6);
    const s = sideHaz(c, kind, c.s + c.gap * range(c.r, 0.9, 1.3), len, side, { trig, delay, dur, warn: delay });
    if (s !== null) c.s = s; else c.s += c.gap * 0.5;
  }
}
function crawlers(c: Ctx) {
  const side = (-nextSide(c)) as Side, vb = -(1.8 + 2.2 * c.d), trig = (c.v + -vb) * (c.win + 1.1), L = range(c.r, 1.6, 3.2);
  const at = c.s + trig;
  if (blocked(c, c.s, at + L) || overlaps(c.lethal[String(-side)] ?? [], c.s - 1, at + L)) { c.s += c.gap; return; }
  c.st.haz.push({ id: c.id++, kind: "crawler", s: at, len: L, side, v: vb, trig, warn: 0.6 });
  (c.lethal[String(side)] ??= []).push([c.s, at + L]);
  c.force = { s: at, side: (-side) as Side };
  c.s = at - trig * 0.4 + c.gap;
}
function tongues(c: Ctx) {
  const period = range(c.r, 2.2, 1.7);
  const s = bothHaz(c, "tongue", c.s + c.gap, 1.0, { period, phase: c.r() * period, on: 0.38, warn: 0.5 });
  c.s = (s ?? c.s + c.gap) + waitRoom(c, period, 0.38);
}
function slowZones(c: Ctx, kind: "web" | "sap", f: number) {
  for (let i = 0; i < 2 && c.s < c.end; i++) {
    const side = sideR(c), L = range(c.r, 2.5, 4), at = c.s + c.gap * 0.8;
    if (blocked(c, at, at + L)) { c.s += 2; continue; }
    c.st.zones.push({ s0: at, s1: at + L, kind, side, f });
    // a thorn on the other side somewhere along it: the web is the safe (slow) way
    sideHaz(c, "thorn", at + L / 2, 0.6, (-side) as Side);
    c.s = at + L;
  }
}
/** long side-lethal stretches (waterfall water, the shadow's sweep) that alternate */
function longSides(c: Ctx, kind: HazKind, zone: "waterfall" | null) {
  const n = 2 + Math.floor(c.d * 3), start = c.s;
  for (let i = 0; i < n && c.s < c.end; i++) {
    const side = (-nextSide(c)) as Side, L = range(c.r, 2.5, 4.5 - c.d);
    const s = sideHaz(c, kind, c.s + c.gap * 0.6 + L / 2, L, side, { warn: 0.6 });
    if (s === null) { c.s += c.gap; continue; }
    c.s = s + L / 2;
    bugLine(c, s - L / 2 + 0.4, Math.floor(L / 0.9), (-side) as Side);
  }
  if (zone) c.st.zones.push({ s0: start, s1: c.s + 2, kind: zone, side: 0 });
}
/** gaps to leap (or bounce, or swing across); `twin` = a chain of short vine pieces between them */
function leaps(c: Ctx, n: number, kind: Gap["kind"], twin = false) {
  const lw = leapWindow(c.v);
  for (let i = 0; i < n && c.s < c.end; i++) {
    const glen = kind === "flower" ? range(c.r, 2.2, 3.2) : range(c.r, 1.4, 2.2 + 0.6 * c.d);
    let s0 = Math.max(c.s + c.gap * (twin && i > 0 ? 0.4 : 1.2), c.force.s + c.gap * 0.9);
    const g: Gap = { s0, s1: s0 + glen, kind };
    if (kind === "swing") { g.period = range(c.r, 2.0, 1.5); g.phase = c.r() * g.period; g.win = range(c.r, 0.55, 0.45); }
    if (kind === "flower") g.side = sideR(c);
    const land = leapLength(g, c.v);
    const lo = s0 - lw * (kind === "swing" ? 1.5 : 1) - (kind === "swing" ? c.v * 0.8 : 1) - 0.5, hi = s0 + land + 1.2;
    if (blocked(c, lo, hi) || !planarSpan(c.st.path, lo, hi) || overlaps(c.lethal["1"] ?? [], lo, hi) || overlaps(c.lethal["-1"] ?? [], lo, hi)) { s0 += 2; c.s += 2; continue; }
    if (kind === "flower") {
      // the pad's side has to be chosen ahead: a thorn on it, a full window before the pad, makes you flip onto it in time
      const th = sideHaz(c, "thorn", s0 - c.gap * 2.2, 0.6, g.side!, {}, undefined, s0 - c.gap - c.v * 0.2 - 0.5);
      if (th === null) g.side = c.free ? g.side : c.force.side;
      c.force = { s: s0, side: g.side! };
    }
    c.st.gaps.push(g);
    markPath(c.st.path, g.s0, g.s1, 1);
    c.keep.push([g.s0 - lw * (kind === "swing" ? 1.5 : 1) - 0.6, g.s0 + leapLength(g, c.v) + 0.8]);
    bugLine(c, g.s1 + 0.3, 2, c.force.side, c.r() < 0.3);
    c.s = g.s0 + leapLength(g, c.v) + 0.8;
    c.force = { s: c.s, side: c.force.side }; c.free = true;
  }
}

/** build stage `def`: the vine, then the concepts in segments, then globals, pickups and a mid checkpoint */
export function buildStage(def: StageDef): Stage {
  const r = mulberry(def.seed);
  const has = (k: string) => def.concepts.includes(k);
  const path = buildPath({
    length: def.length, rng: r,
    straights: has("bamboo") ? 6 : 2.2, turns: 2.4, hairpins: has("hairpin") ? 3 : 0.5 + def.d, zigzag: 1 + def.d,
    spirals: has("spiral") ? 3 : 0,
  });
  const st: Stage = { def, path, haz: [], gaps: [], bugs: [], picks: [], zones: [], forks: [] };
  const c: Ctx = {
    r, d: def.d, v: def.speed, win: def.win, gap: def.speed * def.win, s: 9, end: path.len - 7, st,
    lethal: {}, force: { s: 0, side: 1 }, keep: [], id: 0, world: def.world, globals: new Set(def.concepts.filter((x) => GLOBAL.has(x))), free: false,
  };
  if (def.kind === "crown") { c.s = 14; P.crown(c); }
  else {
    const pats = def.concepts.filter((x) => !GLOBAL.has(x) && P[x]);
    if (!pats.length) pats.push("classic");
    let last = "";
    while (c.s < c.end - 4) {
      let k = pick(r, pats);
      if (k === last && pats.length > 1 && r() < 0.6) k = pick(r, pats);
      last = k;
      const before = c.s;
      P[k](c);
      if (c.s <= before) c.s = before + 3;
      // a breath between patterns, with a few bugs
      if (c.s < c.end - 6) { bugLine(c, c.s + 0.8, 2 + Math.floor(r() * 3), c.force.side); c.s += c.gap * (1.1 - 0.4 * c.d) + 2; }
    }
  }
  // globals
  // Kaaki is slower on stages that make you wait (buds, bees, spiders, roots, webs…): waiting must stay possible
  const slowing = ["cling", "bees", "spider", "caterpillar", "swing", "web", "sapdew", "crown"].some(has) || st.haz.some((h) => h.period !== undefined);
  if (has("chase")) st.chase = { lag: slowing ? 16 : 12, v: def.speed * (slowing ? 0.74 : 0.9), after: 2.5 };
  if (has("grow")) st.grow = { lead: 9, v: def.speed * 0.84 };
  if (has("wither")) st.wither = { lag: 7, v: def.speed * 0.78, after: 2 };
  if (has("rival") || def.guardian === "zeeza") st.rival = { v: def.speed * (0.93 + 0.05 * def.d) };
  if (has("monsoon")) st.zones.push({ s0: 0, s1: path.len, kind: "rain", side: 0 });
  if (has("fog")) st.zones.push({ s0: 0, s1: path.len, kind: "fog", side: 0 });
  if (has("bamboo")) st.zones.push({ s0: 0, s1: path.len, kind: "slick", side: 0, f: 1.12 });
  if (has("egg")) st.zones.push({ s0: 0, s1: path.len, kind: "egg", side: 0 });
  // mirror: every other thorn grows on Pippi's vine instead, on the other side (Pippi mirrors Tondu), so the danger stays the same
  if (has("mirror")) st.haz.forEach((h, i) => { if (h.kind === "thorn" && !h.br && i % 2 === 0) { h.mirror = true; h.side = (-h.side) as Side; } });
  // pickups: every 55–85 m, on the side the player will be on there
  const kinds: PickKind[] = ["sun", "magnet", "shield", ...(st.gaps.length ? ["glide" as PickKind] : [])];
  for (let s = 40 + r() * 20; s < path.len - 20; s += 55 + r() * 30) {
    const side = safeSideAt(st, s);
    if (side && !overlaps(c.keep, s - 1, s + 1)) st.picks.push({ s, side, kind: pick(r, kinds) });
  }
  if (def.kind === "long" || def.kind === "crown") {
    for (let s = path.len / 2, k = 0; k < 40; k++, s += 1) {
      if (!st.haz.some((h) => Math.abs(h.s - s) < 5 + h.len) && !st.gaps.some((g) => s > g.s0 - 5 && s < g.s1 + 6)) { st.mid = s; break; }
    }
  }
  st.haz.sort((a, b) => a.s - b.s); st.bugs.sort((a, b) => a.s - b.s); st.picks.sort((a, b) => a.s - b.s); st.gaps.sort((a, b) => a.s0 - b.s0);
  st.haz.forEach((h, i) => { h.id = i; });
  return st;
}
/** a side with no static thorn within 2 m of s (null if neither) */
function safeSideAt(st: Stage, s: number): Side | null {
  for (const side of [1, -1] as Side[]) if (!st.haz.some((h) => (h.side === side || h.side === 0) && Math.abs(h.s - s) < h.len / 2 + 2)) return side;
  return null;
}

export type { Bug, Fork, Gap, Haz, Pick, Zone };
