// Momo Jelly Jam stage builder + director. A stage recipe (stage number, concepts, difficulty) becomes a board: tray
// size and walls from the board concepts, gates (frame, floor drains, boxes) and their target blocks (plain, stone,
// gold, mixed-colour…), each block cut into jelly parts of the shapes learned so far, and floor tiles. The stage is then
// built backwards from its solution (blocks leave in a chosen order; going back in time each block reappears at its
// gate, splits into its parts and the parts slide away — turned / flipped / painted parts via their pad or paint, heavy,
// ghost, bubble, rail and arrow jellies by their own rules), scrambled so jellies block each other, and replayed with
// the real rules. Then the concept passes (mech.ts) add the rest of the 400 ideas — doors, keys, locks, orders, timers,
// hazards, looks — keeping the proven route, or re-solving when a concept moves things on its own. Among a few
// candidates the one closest to the stage's target difficulty wins. The director plays the 20 worlds in order (a new
// concept every 3 stages, a rhythm of meet / use / mix / breather / twist / brain burner / star / boss) and then the
// endless Fusion Jam forever.
import { hash32, Rng } from "../roll/rng";
import { CONCEPT } from "./data/concepts";
import { JOURNEY_STAGES, STAGES_PER_WORLD, TAUGHT_WORLDS, worldOf, WORLDS } from "./data/worlds";
import { applyConcepts, CLASS, compatibleAtoms, shuffle, teachDeadline, verify } from "./mech";
import { bounds, mirrorX, newState, normalise, rotCW, squishCompatible } from "./rules";
import { solve } from "./solver";
import {
  CELL, CRATE, DX, DY, GOLD, MINT, NAVY, PLAIN_COLOURS, RAINBOW, STONE, takes, TILE,
  type Dir, type Gate, type Level, type Move, type Pad, type Piece, type PieceFlags, type StageKind, type StageRules,
} from "./types";

// ---------------------------------------------------------------- shapes
const SHAPES: Record<string, number[]> = {
  mono: [0, 0],
  bar2: [0, 0, 1, 0], bar3: [0, 0, 1, 0, 2, 0], bar4: [0, 0, 1, 0, 2, 0, 3, 0], bar5: [0, 0, 1, 0, 2, 0, 3, 0, 4, 0], bar6: [0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0],
  sq2: [0, 0, 1, 0, 0, 1, 1, 1],
  L3: [0, 0, 1, 0, 0, 1], L4: [0, 0, 1, 0, 2, 0, 0, 1], T4: [0, 0, 1, 0, 2, 0, 1, 1], S4: [0, 0, 1, 0, 1, 1, 2, 1],
  L5: [0, 0, 1, 0, 2, 0, 0, 1, 0, 2], W5: [0, 0, 1, 0, 1, 1, 2, 1, 2, 2], L6: [0, 0, 1, 0, 2, 0, 3, 0, 0, 1, 1, 1],
  plus5: [1, 0, 0, 1, 1, 1, 2, 1, 1, 2], U5: [0, 0, 1, 0, 2, 0, 0, 1, 2, 1], hook5: [0, 0, 1, 0, 1, 1, 1, 2, 1, 3], T5: [0, 2, 1, 2, 2, 2, 1, 1, 1, 0],
  comb8: [0, 0, 1, 0, 0, 1, 0, 2, 1, 2, 0, 3, 0, 4, 1, 4], ring7: [0, 0, 1, 0, 2, 0, 0, 1, 0, 2, 1, 2, 2, 2],
};
const rot = rotCW, flip = mirrorX;
function canon(c: number[]) {
  let best = "", cur = normalise(c).c;
  for (let f = 0; f < 2; f++) { for (let r = 0; r < 4; r++) { const k = cur.join(","); if (!best || k < best) best = k; cur = rot(cur); } cur = flip(cur); }
  return best;
}
const TYPE_OF = new Map(Object.entries(SHAPES).map(([k, c]) => [canon(c), k]));
/** a shape's family: a named shape, any other pentomino ("penta") or any 6–8 cell shape ("giant") */
const typeOf = (c: number[]) => TYPE_OF.get(canon(c)) ?? ((c.length >> 1) === 5 ? "penta" : (c.length >> 1) >= 6 && (c.length >> 1) <= 8 ? "giant" : undefined);
/** which concept unlocks which shapes */
const SHAPE_CONCEPT: Record<string, string[]> = {
  P01: ["bar3", "bar4"], P10: ["bar2"], P02: ["sq2"], P03: ["L3", "L4"], P04: ["L3", "L4"], P05: ["T4"], P06: ["S4"], P11: ["mono"], P12: ["bar5", "bar6"], P09: ["L5", "L6"], P13: ["W5"],
  P07: ["plus5"], P08: ["U5"], P16: ["hook5"], P17: ["T5"], P15: ["comb8"], P14: ["ring7"], P18: ["penta"], P19: ["giant"],
};

// ---------------------------------------------------------------- recipes
export interface Recipe {
  n: number; seed: number; world: number; stage: number; kind: StageKind; d: number; name: string;
  /** concepts this stage is about (all must show up) */
  focus: string[];
  /** every concept learned so far (may show up) */
  known: string[];
  /** a couple of learned ideas added for variety when they fit (never required) */
  extra?: string[];
  meet?: string;
  fusion?: { name: string; key: string; atoms: string[] };
  /** a simpler retry of a stage that would not build */
  easier?: boolean;
  /** which mode asked for it */
  mode?: string;
}
export interface FusionMemory { recent: string[]; seen: string[] }

const KIND_AT: Record<number, StageKind> = { 1: "meet", 2: "use", 3: "mix", 4: "meet", 5: "use", 6: "breather", 7: "meet", 8: "twist", 9: "burner", 0: "star" };
const KIND_D: Record<StageKind, number> = { meet: -0.12, use: 0, mix: 0.05, breather: -0.2, twist: 0.12, burner: 0.22, star: 0.1, boss: 0.25, fusion: 0 };
const CORE = ["B01", "F01", "G01", "P10", "P01"];
/** difficulty by stage number: a quick climb through the first worlds (1 → 0.06, 60 → 0.36, 120 → 0.53, 300 → 0.94), then a
 *  steady late climb so every world is a little harder than the one before (600 → 1.26, 900 → 1.43, 1200 → 1.6), and the
 *  Fusion Jam keeps edging up to 1.72 by stage 1,800 */
export const difficultyAt = (n: number) =>
  0.05 + 1.1 * (1 - Math.exp(-n / 180)) + 0.45 * Math.min(1, Math.max(0, (n - 300) / 900)) + 0.12 * Math.min(1, Math.max(0, (n - 1200) / 600));
/** the most a stage asks for (late bosses) */
const D_MAX = 1.85;

/** concepts a world teaches up to (and including) stage s */
function learned(world: number, stage: number) {
  const out: string[] = [];
  for (let w = 1; w < world; w++) out.push(...(worldOf(w).teach ?? []));
  const t = worldOf(world).teach ?? [];
  const meets = Math.floor((stage - 1) / 10) * 3 + [0, 1, 1, 1, 2, 2, 2, 3, 3, 3][(stage - 1) % 10];
  out.push(t[0], ...t.slice(1, 1 + meets));
  if (stage >= STAGES_PER_WORLD) out.push(t[19]);
  return [...new Set(out)].filter(Boolean);
}
/** concepts that build a stage (helpers and world cards only teach) */
const buildable = (c: string) => !!CONCEPT[c] && c[0] !== "W" && c[0] !== "H" && CLASS[c] !== "meta";

export function recipeFor(n: number, salt: number, mem: FusionMemory = { recent: [], seen: [] }): Recipe {
  const seed = hash32(n, salt, 0x7e11);
  const rng = new Rng(seed);
  if (n <= JOURNEY_STAGES) {
    const world = Math.ceil(n / STAGES_PER_WORLD), stage = ((n - 1) % STAGES_PER_WORLD) + 1;
    const W = worldOf(world), t = W.teach!;
    const kind: StageKind = stage === STAGES_PER_WORLD ? "boss" : KIND_AT[stage % 10];
    const known = learned(world, stage).filter((c) => CONCEPT[c] && c[0] !== "W" && c[0] !== "K" && c[0] !== "H");
    const mech = t.slice(1, 19);
    const lastMeet = Math.floor((stage - 1) / 10) * 3 + [0, 0, 0, 1, 1, 1, 2, 2, 2, 2][(stage - 1) % 10];
    let focus: string[] = [];
    let meet: string | undefined;
    const fresh = mech[Math.min(17, lastMeet)];
    const older = known.filter((c) => !CORE.includes(c) && c !== fresh && buildable(c));
    // this world's ideas come up more often than older worlds'
    const mine = new Set(mech);
    const pickOld = (k: number, avoid: string[] = []) => {
      const a = older.filter((c) => !avoid.includes(c));
      const r: string[] = [];
      for (let guard = 0; r.length < k && a.length && guard < 40; guard++) {
        const own = a.filter((c) => mine.has(c));
        const from = own.length && rng.chance(0.6) ? own : a;
        const c = from[rng.int(0, from.length - 1)];
        a.splice(a.indexOf(c), 1);
        if (compatibleAtoms([...avoid, ...r, c])) r.push(c);
      }
      return r;
    };
    const f0 = buildable(fresh) ? [fresh] : [];
    switch (kind) {
      case "meet": meet = fresh; focus = f0; break;
      case "use": focus = [...f0, ...pickOld(1, f0)]; break;
      case "mix": focus = pickOld(2, f0).concat(f0); break;
      case "breather": focus = pickOld(1); break;
      case "twist": focus = [...f0, ...pickOld(2, f0)]; break;
      case "burner": focus = pickOld(3); break;
      case "star": focus = pickOld(2); break;
      case "boss": focus = [t[19], ...pickOld(2, [t[19]])]; break;
      default: break;
    }
    focus = [...new Set(focus)].filter((c) => CONCEPT[c]);
    const d = Math.max(0.02, Math.min(D_MAX, difficultyAt(n) + KIND_D[kind] * (n < 10 ? 0.4 : 1)));
    // variety: an extra learned idea now and then (never on meet stages, so the new idea stands alone)
    const extra = kind === "meet" || kind === "breather" ? [] : pickOld(kind === "burner" || kind === "boss" ? 2 : rng.chance(0.35 + d * 0.3) ? 1 : 0, focus).filter((c) => CLASS[c] === "insert" || CLASS[c] === "view");
    const name = kind === "boss" ? `Kranky: ${CONCEPT[t[19]]?.name ?? "Boss"}` : meet ? `New: ${CONCEPT[meet]?.name}` : `${W.name} ${stage}`;
    return { n, seed, world, stage, kind, d, name, focus, known: [...new Set([...CORE, ...known])], meet, extra };
  }
  // ---- the endless Fusion Jam: mix 2–4 concepts learned so far, freshest first
  const pool = learned(TAUGHT_WORLDS, STAGES_PER_WORLD).filter((c) => buildable(c) && !CORE.includes(c));
  const depth = n - JOURNEY_STAGES;
  const k = depth < 60 ? 2 : depth < 240 ? rng.int(2, 3) : rng.int(2, 4);
  const recent = new Set(mem.recent);
  let best: string[] = [], bestScore = -Infinity;
  for (let tries = 0; tries < 30; tries++) {
    const a = pool.slice(), atoms: string[] = [];
    while (atoms.length < k && a.length) atoms.push(a.splice(rng.int(0, a.length - 1), 1)[0]);
    if (!compatibleAtoms(atoms)) continue;
    const key = atoms.slice().sort().join("+");
    const score = -atoms.filter((x) => recent.has(x)).length * 2 - (mem.seen.includes(key) ? 3 : 0) + rng.next();
    if (score > bestScore) { bestScore = score; best = atoms; }
  }
  const saw = Math.sin(depth * 1.7) * 0.12;
  // three or four ideas at once are hard enough on a slightly smaller tray
  const d = Math.min(D_MAX, difficultyAt(n) + saw - 0.08 * Math.max(0, best.length - 2));
  const fname = fusionName(best, rng);
  const key = best.slice().sort().join("+");
  const world = 1 + ((Math.floor(depth / 10) + TAUGHT_WORLDS) % WORLDS.length);
  return { n, seed, world, stage: 0, kind: "fusion", d, name: fname, focus: best, known: [...CORE, ...pool], fusion: { name: fname, key, atoms: best } };
}

const WORD: Record<string, string> = {
  B02: "Split", B03: "Twin-Room", B04: "Corridor", B05: "Post", B07: "Hourglass", B11: "Pocket", B12: "Window", B16: "Tiny", B09: "Donut", B18: "Pit", B21: "Spiral", B22: "Maze",
  P01: "Bar", P02: "Cube", P03: "Corner", P05: "Tee", P06: "Zigzag", P09: "Big-Corner", P11: "Drop", P12: "Long", P13: "Stair", P07: "Plus", P08: "Cup", P14: "Ring",
  P21: "Trio", P22: "Quad", P23: "Filler", P24: "Loner", G02: "Wide", G03: "Slot", G04: "Double", G07: "Count", G08: "Blink", G06: "Locked", G23: "Fake", G30: "Drain",
  T01: "Spin", T02: "Backspin", T03: "Flip", T04: "Ice", T05: "Mud", T06: "Belt", T07: "Arrow", T08: "Portal", T09: "Switch", T11: "Paint", T21: "Key", T22: "Crumble",
  C02: "Tri-Colour", C03: "Rainbow", C22: "Neon", K14: "Maze", K16: "Giant", S01: "Gravity", S04: "Wrap", J12: "Ghost", J03: "Bubble", J04: "Heavy", J35: "Kranky", M05: "Crate",
};
const TAIL = ["Jam", "Mix", "Squish", "Rush", "Twist", "Wobble", "Pop", "Swirl", "Splash", "Fizz"];
function fusionName(atoms: string[], rng: Rng) {
  const words = atoms.map((a) => WORD[a] ?? CONCEPT[a]?.name.split(" ")[0] ?? a);
  return `${words.slice(0, 2).join(" ")} ${TAIL[rng.int(0, TAIL.length - 1)]}`;
}

// ---------------------------------------------------------------- the builder
interface Block {
  color: number; gate: number; w: number; dep: number; parts: number;
  /** box parts get these colours (all different) · mixed blocks use two primaries */
  partCols?: number[];
}
interface Layout {
  W: number; H: number; walls: number[]; tiles: number[]; tdir: number[]; tval: number[]; rails: number[] | null;
  pads: Pad[]; gates: Gate[]; blocks: Block[]; dock: Uint8Array; rules: StageRules; crates: number; crateFlags?: PieceFlags;
}

export const BUILD_STATS = { built: 0, fallback: 0, solves: 0, ms: 0, noLayout: 0, backNull: 0, verifyFail: 0, mechFail: 0, parMs: 0 };

/** build a stage; `start` is when the first try began, so the simpler retries share one time limit (≈9 s worst case) */
export function buildStage(r: Recipe, start = Date.now()): Level {
  const t0 = Date.now();
  // (each retry still gets a moment of its own)
  const hard = r.easier ? Math.max(start + (r.focus.length ? 7000 : 9500), t0 + (r.focus.length ? 1800 : 1500)) : Infinity;
  const has = (c: string) => r.focus.includes(c);
  const knows = (c: string) => r.known.includes(c);
  let best: Level | null = null, bestErr = Infinity;
  // stages whose ideas move things on their own are proven by the solver, so they stay a little smaller (bosses less so)
  const resolves = r.focus.some((c) => CLASS[c] === "resolve");
  // a stage that introduces a tile or machine meets it on a smaller tray (the solver can then prove a route that uses it)
  const intro = r.kind === "meet" && !!r.meet && (CLASS[r.meet] === "insert" || CLASS[r.meet] === "resolve");
  const d0 = intro ? Math.min(r.d, 0.7) : r.d;
  const rr: Recipe = resolves ? { ...r, d: Math.min(d0, 0.3 + d0 * 0.18 + (r.kind === "boss" ? 0.12 : 0)) } : d0 !== r.d ? { ...r, d: d0 } : r;
  // how much the board should ask of the player (for the stage it really is: smaller intro and self-moving trays aim lower)
  const target = 0.12 + 0.95 * Math.min(1.8, rr.d);
  const budget = resolves ? 2600 : 2400;
  // teaching a new idea gets about 3.5 s of this build in all (then the idea keeps its plain placement)
  teachDeadline(t0 + 3500);
  for (let attempt = 0; attempt < (resolves ? 9 : 12); attempt++) {
    // never keep the player waiting: past the budget (three without any board yet), take the simpler version
    if (Date.now() - t0 > budget * (best ? 1 : resolves ? 2 : 3) || Date.now() > hard) break;
    const rng = new Rng(hash32(r.seed, attempt, 0x51));
    const lay = layout(rr, rng, has, knows);
    if (!lay) { BUILD_STATS.noLayout++; continue; }
    for (let place = 0; place < 3; place++) {
      if ((best && Date.now() - t0 > budget) || Date.now() - t0 > budget * (resolves ? 2 : 3) || Date.now() > hard) break;
      const sc = backbuild(rr, lay, rng, has, knows);
      if (!sc) { BUILD_STATS.backNull++; continue; }
      const L: Level = {
        n: r.n, seed: r.seed, W: lay.W, H: lay.H, walls: lay.walls.slice(), tiles: lay.tiles.slice(), tdir: lay.tdir.slice(),
        ...(lay.tval.some((v) => v) ? { tval: lay.tval.slice() } : {}), ...(lay.rails ? { rails: lay.rails.slice() } : {}),
        pads: sc.pads, gates: lay.gates.map((g) => ({ ...g })), pieces: sc.pieces,
        ...(Object.keys(lay.rules).length ? { rules: { ...lay.rules } } : {}),
        concepts: [], meet: r.meet, kind: r.kind, world: r.world, stage: r.stage, name: r.name,
        fusion: r.fusion, par: 0, solution: [], difficulty: r.d, look: hash32(r.seed, 7) % 1000, ...(r.mode ? { mode: r.mode } : {}),
      };
      const clean = verify(L, sc.solution);
      if (!clean) { BUILD_STATS.verifyFail++; continue; }
      L.solution = clean; L.par = clean.length;
      if (!applyConcepts(L, rr, rng, CORE)) { BUILD_STATS.mechFail++; continue; }
      const n = L.pieces.length, cols = new Set(L.pieces.map((p) => p.color)).size;
      const extra = Math.max(0, L.par - n);
      const score = extra * 0.17 + n * 0.045 + cols * 0.04 + L.pads.length * 0.05 + (L.walls.some((v) => v) ? 0.05 : 0) + (L.doors?.length ?? 0) * 0.04 + (L.rules ? 0.05 : 0);
      const err = Math.abs(score - target) + (score < target - 0.25 ? 0.3 : 0);
      if (err < bestErr) { bestErr = err; best = L; }
      if (err < 0.12) break;
    }
    if (best && bestErr < 0.12) break;
    if (Date.now() - t0 > budget && best) break;
  }
  BUILD_STATS.ms += Date.now() - t0;
  if (best) {
    // a quick look for a shorter route on the chosen board (a fairer par) — not needed when the solver just proved it
    if (!resolves) {
      const ts = Date.now();
      BUILD_STATS.solves++;
      const q = solve(best, newState(best), { cap: 600, weight: 1.2, seed: r.seed, ms: 800 });
      BUILD_STATS.parMs += Date.now() - ts;
      if (q.ok && q.moves.length < best.solution.length && !best.rules?.limit) { best.solution = q.moves; best.par = q.moves.length; }
    }
    BUILD_STATS.built++;
    return best;
  }
  // a simpler take on the same stage (keep the newest idea), then a plain stage, before the spare board
  if (!r.easier) return buildStage({ ...r, d: r.d * 0.8, focus: r.focus.slice(0, 1), extra: [], easier: true, seed: hash32(r.seed, 99) }, start);
  if (r.focus.length) return buildStage({ ...r, d: Math.min(r.d, 1) * 0.7, focus: [], extra: [], easier: true, seed: hash32(r.seed, 98) }, start);
  BUILD_STATS.fallback++;
  return fallback(r);
}

/** last resort: a small open tray, two colours, dominoes */
function fallback(r: Recipe): Level {
  const W = 5, H = 6, rng = new Rng(hash32(r.seed, 0xfa11));
  const [c0, c1] = shuffle(PLAIN_COLOURS.filter((c) => c !== 4), rng);
  const flip = rng.chance(0.5), mx = (x: number, w: number) => (flip ? W - x - w : x);
  const a0 = rng.int(0, 3), a1 = rng.int(0, 3);
  const gates: Gate[] = [{ side: 0, at: mx(a0, 2), w: 2, color: c0, count: 99 }, { side: 2, at: mx(a1, 2), w: 2, color: c1, count: 99 }];
  const pieces: Piece[] = [
    { id: 1, color: c0, c: [0, 0, 1, 0], x: mx(0, 2), y: 1, parts: 1 }, { id: 2, color: c0, c: [0, 0, 1, 0], x: mx(3, 2), y: 2, parts: 1 },
    { id: 3, color: c1, c: [0, 0, 0, 1], x: mx(0, 1), y: 3, parts: 1 }, { id: 4, color: c1, c: [0, 0, 0, 1], x: mx(4, 1), y: 3, parts: 1 },
  ];
  const L: Level = {
    n: r.n, seed: r.seed, W, H, walls: new Array(W * H).fill(0), tiles: new Array(W * H).fill(0), tdir: new Array(W * H).fill(0), pads: [], gates, pieces,
    concepts: CORE.slice(), kind: r.kind, world: r.world, stage: r.stage, name: r.name, par: 0, solution: [], difficulty: r.d, look: r.seed % 1000, ...(r.mode ? { mode: r.mode } : {}),
  };
  const res = solve(L, newState(L), { cap: 4000 });
  L.solution = res.moves; L.par = res.moves.length || 4;
  return L;
}

const anyOf = (has: (c: string) => boolean, ...cs: string[]) => cs.some(has);

function layout(r: Recipe, rng: Rng, has: (c: string) => boolean, knows: (c: string) => boolean): Layout | null {
  const d = r.d;
  const star = r.kind === "star" || r.kind === "boss";
  const tiny = has("B16");
  const big = anyOf(has, "B15", "P29", "C05", "B21");
  const rules: StageRules = {};
  // colours first: the tray is sized to hold the jelly with room to move
  const maxCol = knows("C05") ? 6 : knows("C04") ? 5 : knows("C03") ? 4 : knows("C02") ? 3 : 2;
  let ncol = 2 + (d > 0.28 && maxCol >= 3 ? 1 : 0) + (d > 0.62 && maxCol >= 4 ? 1 : 0) + (d > 0.98 && maxCol >= 5 && rng.chance(d > 1.35 ? 0.6 : 0.35) ? 1 : 0)
    + (d > 1.55 && maxCol >= 6 && rng.chance(0.25) ? 1 : 0);
  if (has("C02")) ncol = Math.max(ncol, 3);
  if (has("C03")) ncol = Math.max(ncol, 4);
  if (has("C04")) ncol = Math.max(ncol, 5);
  if (has("C05")) ncol = Math.max(ncol, 6);
  if (tiny) ncol = Math.min(ncol, 2);
  if (r.kind === "breather") ncol = Math.max(2, ncol - 1);
  if (has("R22") || has("C20")) ncol = Math.min(ncol, 2);
  const oneCol = has("C25");
  const later = r.world >= 3 || r.kind === "fusion";
  // late worlds may use the big 9 × 12 tray (still fits a phone)
  const maxW = big || ncol >= 5 ? 9 : later ? (d > 1.35 ? 9 : 8) : 7, maxH = big || ncol >= 5 ? 12 : later ? (d > 1.3 ? 11 : 10) : 9;
  const cellsPerColour = (2 + Math.min(1.6, d * 1.5)) * (2.4 + d * 1.1) * (has("K16") || has("P29") ? 1.3 : 1);
  const area = ((oneCol ? 2.5 : ncol) * cellsPerColour) / (0.34 + Math.min(1.1, d) * 0.06) + (star ? 8 : 0);
  let W = tiny ? rng.int(4, 5) : Math.max(5, Math.min(maxW, Math.round(Math.sqrt(area * 0.78)) + (rng.chance(0.3) ? 1 : 0)));
  let H = tiny ? rng.int(5, 6) : Math.max(W + 1, Math.min(maxH, Math.ceil(area / W) + (rng.chance(0.35) ? 1 : 0)));
  if (has("B15")) { W = Math.max(W, 9); H = Math.max(H, 11); }
  W = Math.min(maxW, W); H = Math.min(maxH, H);
  ncol = Math.min(ncol, W >= 8 ? 6 : W >= 6 ? 4 : 3);
  const walls = new Array(W * H).fill(0), tiles = new Array(W * H).fill(0), tdir = new Array(W * H).fill(0), tval = new Array(W * H).fill(0);
  let rails: number[] | null = null;
  const dock = new Uint8Array(W * H);
  // colours: red and pink never share a tray (too alike at a glance); shades (C06) deliberately pair a colour and its shade
  let colours = shuffle(PLAIN_COLOURS, rng).filter((c, i, a) => !(c === 4 && a.slice(0, i).includes(0)) && !(c === 0 && a.slice(0, i).includes(4)));
  const mixing = anyOf(has, "F12", "C08", "M18");
  let mixPair: [number, number, number] | null = null;
  if (mixing) {
    const opts: [number, number, number][] = [[0, 1, 5], [0, 2, 6], [1, 2, 3]];
    mixPair = opts[rng.int(0, 2)];
    rules.mix = true;
    // the mixed block's primaries stay out of the other blocks (so a stray squish can't steal them)
    colours = [mixPair[2], ...colours.filter((c) => c !== mixPair![0] && c !== mixPair![1] && c !== mixPair![2])];
  }
  colours = colours.slice(0, ncol);
  if (has("C06")) { const shade = rng.chance(0.5) ? [1, NAVY] : [3, MINT]; colours = [...shade, ...colours.filter((c) => c !== shade[0])].slice(0, Math.max(2, ncol)); }
  if (oneCol) colours = [colours[0]];
  const maxParts = knows("P22") ? 4 : knows("P21") ? 3 : 2;
  const gates: Gate[] = [], blocks: Block[] = [];
  const sideLen = (s: Dir) => (s === 0 || s === 2 ? W : H);
  const used: [Dir, number, number][] = [];
  const free = (side: Dir, at: number, w: number) => !used.some(([s, a, ww]) => s === side && at < a + ww + 1 && a < at + w + 1);
  const placeGate = (color: number, w: number, count = 99, at0?: [Dir, number]) => {
    for (let t = 0; t < 30; t++) {
      const side = at0 ? at0[0] : (rng.int(0, 3) as Dir);
      const len = sideLen(side);
      if (w > len - 1) { if (at0) return -1; continue; }
      const at = at0 ? at0[1] : rng.int(0, len - w);
      if (at < 0 || at + w > len || !free(side, at, w)) { if (at0) return -1; continue; }
      used.push([side, at, w]);
      gates.push({ side, at, w, color, count });
      return gates.length - 1;
    }
    return -1;
  };
  const gateW = () => {
    if (has("G03") && rng.chance(0.5)) return 1;
    if (has("G02") && rng.chance(0.6)) return rng.int(3, Math.min(4, W - 2));
    const opts = [2, 2, 2, 3];
    if (knows("G03")) opts.push(1);
    if (knows("G02") && W >= 6) opts.push(3, 4);
    return Math.min(W - 2, opts[rng.int(0, opts.length - 1)]);
  };
  const partsFor = () => Math.min(maxParts, 2 + (d > 0.22 && rng.chance(0.55) ? 1 : 0) + (d > 0.55 && rng.chance(0.5) ? 1 : 0) + (d > 1.3 && rng.chance(0.4) ? 1 : 0));
  /** depth of a block so its parts have room: ~2.5 cells per part early, ~3.2 later */
  const depFor = (w: number, parts: number) => {
    if (w === 1) return Math.max(2, Math.min(4, parts + rng.int(0, 1)));
    const avg = 2.4 + Math.min(1.1, d) * 1.1;
    return Math.max(w <= 2 ? 2 : 1, Math.min(3, Math.round((parts * avg) / w)));
  };
  const mixed = (has("G10") || has("G35") || has("G19")) && ncol >= 2;
  const nBlocks = oneCol ? 3 : ncol;
  const widths = oneCol ? shuffle([1, 2, 3], rng) : [];
  for (let i = 0; i < nBlocks; i++) {
    const color = oneCol ? colours[0] : colours[i];
    if (mixed && i === 1) {
      const g0 = gates[0];
      g0.also = color;
      const parts = partsFor();
      blocks.push({ color, gate: 0, w: g0.w, dep: depFor(g0.w, parts), parts });
      continue;
    }
    const counted = has("G07") && i === 0;
    const tooBig = has("F14") && i === 0;
    const narrow = has("G26") && i === 0;
    let w = oneCol ? Math.min(W - 2, widths[i]) : counted || tooBig ? Math.max(2, gateW()) : narrow ? Math.max(2, Math.min(3, gateW())) : gateW();
    if (has("F13") && i === 0) w = rng.chance(0.5) ? 2 : Math.min(4, W - 2);
    // a Count Gate takes exactly two; ordinary gates take any number
    const g = placeGate(color, w, counted || narrow ? 2 : 99);
    if (g < 0) return null;
    if (narrow) gates[g].narrow = true;
    const nb = counted || tooBig || narrow ? 2 : 1;
    for (let k = 0; k < nb; k++) {
      const parts = partsFor();
      const bw = narrow ? w - k : w;
      blocks.push({ color, gate: g, w: bw, dep: depFor(bw, parts), parts });
    }
  }
  if (mixPair) { const b = blocks[0]; b.partCols = [mixPair[0], mixPair[1]]; b.parts = 2; }
  if (anyOf(has, "G04", "P30")) {
    // one colour gets a second gate of another size
    const b0 = blocks[0];
    const w2 = b0.w === 2 ? 3 : 2;
    const g2 = placeGate(b0.color, Math.min(w2, W - 2));
    if (g2 >= 0) blocks.push({ color: b0.color, gate: g2, w: gates[g2].w, dep: depFor(gates[g2].w, 2), parts: 2 });
  }
  if (has("G20")) {
    // a corner gate: two gates of one colour meeting at a corner
    const b0 = blocks[blocks.length - 1], cw = Math.min(2, b0.w);
    const corner = rng.int(0, 3);
    const spots: [Dir, number][] = [[[0, 0], [3, H - cw]], [[0, W - cw], [1, H - cw]], [[2, W - cw], [1, 0]], [[2, 0], [3, 0]]][corner] as [Dir, number][];
    const ga = placeGate(b0.color, cw, 99, spots[0]), gb = ga >= 0 ? placeGate(b0.color, cw, 99, spots[1]) : -1;
    if (ga >= 0) blocks.push({ color: b0.color, gate: ga, w: cw, dep: 1 + (cw === 1 ? 1 : 0), parts: 1 });
    if (gb >= 0) blocks.push({ color: b0.color, gate: gb, w: cw, dep: 1 + (cw === 1 ? 1 : 0), parts: 1 });
  }
  if (has("P25")) {
    // a spare part: a little extra jelly with its own little slot
    const c = blocks[rng.int(0, blocks.length - 1)].color;
    const g = placeGate(c, 1);
    if (g >= 0) blocks.push({ color: c, gate: g, w: 1, dep: rng.int(1, 2), parts: 1 });
  }
  if (anyOf(has, "J02", "G12")) {
    const g = placeGate(STONE, rng.int(1, 2));
    if (g < 0) return null;
    blocks.push({ color: STONE, gate: g, w: gates[g].w, dep: rng.int(1, 2), parts: 1 });
  }
  if (anyOf(has, "J27", "J28")) {
    // a gold jelly leaves by any gate it fits — aim it at one of the gates
    const gi = gates.findIndex((g) => g.w <= 2 && g.color !== STONE);
    if (gi >= 0) blocks.push({ color: GOLD, gate: gi, w: gates[gi].w, dep: 1, parts: 1 });
    if (gi >= 0 && has("J28")) gates[gi].star = true;
  }
  if (has("P29")) { const b = blocks[0]; b.w = Math.min(4, Math.max(3, b.w)); gates[b.gate].w = b.w; b.dep = rng.int(3, 4); b.parts = Math.min(6, Math.max(5, maxParts + 2)); }
  if (has("P24")) { const b = blocks[blocks.length - 1]; b.parts = 1; b.dep = Math.max(1, b.dep); }
  for (const b of blocks) if (b.w === 1) b.parts = 1;
  if (has("K16")) { const b = blocks[0]; b.dep = Math.min(3, Math.max(b.dep, Math.ceil(9 / b.w))); b.parts = Math.min(6, Math.max(5, b.w * b.dep >> 1)); }
  if (has("P14")) { const b = blocks[0]; if (b.w >= 3) { b.w = 3; gates[b.gate].w = 3; b.dep = 3; b.parts = 2; } }
  // floor gates (G05 / G30 / B26), sorting zones (R18) and boxes (R15 / R16 / R17)
  const floorGate = (b: Block) => {
    const g = gates[b.gate];
    const fw = b.w, fh = b.dep;
    for (let t = 0; t < 30; t++) {
      const x = rng.int(1, W - fw - 1), y = rng.int(1, H - fh - 1);
      if (x < 1 || y < 1) continue;
      let ok = true;
      for (let j = 0; j < fh && ok; j++) for (let i = 0; i < fw && ok; i++) if (dock[(y + j) * W + x + i]) ok = false;
      if (!ok) continue;
      const k = used.findIndex(([s, a, ww]) => s === g.side && a === g.at && ww === g.w);
      if (k >= 0 && !gates.some((h, hi) => hi !== b.gate && h.side === g.side && h.at === g.at)) used.splice(k, 1);
      g.side = 4; g.at = y * W + x; g.w = fw; g.h = fh;
      return true;
    }
    return false;
  };
  if (anyOf(has, "G05", "G30", "B26") && blocks.length) {
    const b = blocks.find((bb) => gates.filter((g) => g === gates[bb.gate]).length === 1 && blocks.filter((x) => x.gate === bb.gate).length === 1);
    if (!b || !floorGate(b)) return null;
  }
  if (has("R18")) for (const b of blocks) if (blocks.filter((x) => x.gate === b.gate).length === 1 && gates[b.gate].side !== 4 && !floorGate(b)) return null;
  if (anyOf(has, "R15", "R16", "R17")) {
    const bw = rng.int(2, 3), bh = rng.int(2, 3), parts = Math.min(4, Math.max(2, Math.round((bw * bh) / 2.5)));
    const cols = shuffle(colours.length >= parts ? colours : PLAIN_COLOURS.filter((c) => c !== 4), rng).slice(0, parts);
    gates.push({ side: 0, at: 0, w: bw, h: bh, color: -1, count: 1, kind: "box" });
    const b: Block = { color: cols[0], gate: gates.length - 1, w: bw, dep: bh, parts, partCols: cols };
    blocks.push(b);
    if (!floorGate(b)) return null;
    gates[b.gate].kind = "box";
  }
  // too much jelly for this tray? (keep room to move)
  const total = blocks.reduce((s, b) => s + b.w * b.dep, 0);
  if (total > W * H * 0.44) return null;
  // docks: the cells a block sits in when it leaves (kept free of walls and tiles)
  for (const b of blocks) {
    const g = gates[b.gate];
    if (g.side !== 4 && b.dep > (g.side === 0 || g.side === 2 ? H : W) - 2) return null;
    forDock(g, b, W, H, (x, y) => { dock[y * W + x] = 1; });
  }
  // board concepts: walls, pits, bridges, rails
  const wallOK = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !dock[y * W + x];
  const setWall = (x: number, y: number, kind: number = CELL.wall) => { if (wallOK(x, y)) walls[y * W + x] = kind; };
  const BOARDS = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B11", "B12", "B17", "B18", "B19", "B20", "B21", "B22", "B27", "B28", "B29", "S17"];
  const boards = BOARDS.filter((b) => has(b));
  if (!boards.length && r.kind !== "meet" && rng.chance(0.25 + Math.min(1, d) * 0.4)) {
    const k = BOARDS.filter((b) => knows(b) && b !== "B28" && b !== "B29");
    if (k.length) boards.push(k[rng.int(0, k.length - 1)]);
  }
  for (const b of boards) {
    switch (b) {
      case "B02": { const vert = rng.chance(0.5); if (vert) { const x = rng.int(2, W - 3); const len = H - 2; const y0 = rng.chance(0.5) ? 0 : H - len; for (let y = y0; y < y0 + len; y++) setWall(x, y); } else { const y = rng.int(2, H - 3); const len = W - 2; const x0 = rng.chance(0.5) ? 0 : W - len; for (let x = x0; x < x0 + len; x++) setWall(x, y); } break; }
      case "B05": { const n = rng.int(2, 3 + Math.round(Math.min(1, d) * 2)); for (let k = 0, t = 0; k < n && t < 40; t++) { const x = rng.int(1, W - 2), y = rng.int(1, H - 2); if (walls[y * W + x] || dock[y * W + x]) continue; let near = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (walls[(y + j) * W + x + i]) near = true; if (near) continue; setWall(x, y); k++; } break; }
      case "B11": { const right = rng.chance(0.5), xw = right ? W - 2 : 1, xp = right ? W - 1 : 0, y0 = rng.int(1, Math.max(1, H - 4)); setWall(xw, y0); setWall(xw, y0 + 1); setWall(xp, y0 - 1); break; }
      case "B03": case "B29": { const y = rng.int(2, H - 3); const gap = rng.int(0, W - 2); for (let x = 0; x < W; x++) if (x !== gap && x !== gap + 1) setWall(x, y); break; }
      case "B04": { const x = rng.int(1, W - 3); const y0 = rng.int(1, Math.max(1, H - 5)); const len = Math.min(H - 2 - y0, 3 + (d > 0.6 ? 1 : 0)); for (let y = y0; y < y0 + len; y++) { setWall(x, y); setWall(x + 2, y); } break; }
      case "B12": { const y = rng.int(2, H - 3); const gap = rng.int(1, W - 2); for (let x = 0; x < W; x++) if (x !== gap) setWall(x, y); break; }
      case "B07": { const y = Math.floor(H / 2); for (const x of [0, W - 1]) { setWall(x, y); setWall(x, y - 1); } if (W >= 6) { setWall(1, y); setWall(W - 2, y); } break; }
      case "B06": {
        // notches beside the gates
        for (const g of gates) {
          if (g.side === 4) continue;
          const len = g.side === 0 || g.side === 2 ? W : H, a = rng.chance(0.5) ? g.at - 1 : g.at + g.w;
          if (a < 0 || a >= len) continue;
          const [x, y] = g.side === 0 ? [a, H - 1] : g.side === 2 ? [a, 0] : g.side === 1 ? [W - 1, a] : [0, a];
          setWall(x, y);
        }
        break;
      }
      case "B08": { const cw = Math.max(1, Math.floor(W / 4)), ch = Math.max(1, Math.floor(H / 4)); for (const [x0, y0] of [[0, 0], [W - cw, 0], [0, H - ch], [W - cw, H - ch]]) for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) setWall(x0 + i, y0 + j); break; }
      case "B09": { const cx = Math.floor(W / 2) - 1, cy = Math.floor(H / 2) - 1; for (let j = 0; j < (H >= 9 ? 3 : 2); j++) for (let i = 0; i < 2; i++) setWall(cx + i, cy + j); break; }
      case "B10": { const right = rng.chance(0.5), top = rng.chance(0.5); for (let s = 0; s < 3; s++) for (let k = 0; k < 3 - s; k++) setWall(right ? W - 1 - s : s, top ? H - 1 - k : k); break; }
      case "B20": { for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) if (rng.chance(0.75)) { setWall(x, y); if (rng.chance(0.5)) setWall(x === 0 ? 1 : W - 2, y); } break; }
      case "B27": { const cw = Math.floor(W / 2) - (W > 6 ? 0 : 1), ch = Math.floor(H / 2) - 1, right = rng.chance(0.5), top = rng.chance(0.5); for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) setWall(right ? W - 1 - i : i, top ? H - 1 - j : j); break; }
      case "B17": { const x = Math.floor(W / 2); const y0 = rng.int(1, H - 3); for (let y = 0; y < H; y++) if (y !== y0 && y !== y0 + 1) setWall(x, y); break; }
      case "B28": {
        // islands: a solid wall line, joined only by a teleport pair
        const x = Math.floor(W / 2); for (let y = 0; y < H; y++) setWall(x, y);
        const a = freeAt(x - 1, rng, H, (y) => !walls[y * W + x - 1] && !dock[y * W + x - 1]), b2 = freeAt(x + 1, rng, H, (y) => !walls[y * W + x + 1] && !dock[y * W + x + 1]);
        if (a < 0 || b2 < 0) return null;
        const ia = a * W + x - 1, ib = b2 * W + x + 1;
        tiles[ia] = TILE.tele; tiles[ib] = TILE.tele; tval[ia] = tval[ib] = 1;
        break;
      }
      case "B18": { const n = rng.int(2, 4); for (let k = 0, t = 0; k < n && t < 40; t++) { const x = rng.int(1, W - 2), y = rng.int(1, H - 2); if (walls[y * W + x] || dock[y * W + x]) continue; setWall(x, y, CELL.pit); if (rng.chance(0.5)) setWall(x + 1, y, CELL.pit); k++; } break; }
      case "B19": { const y = rng.int(2, H - 3); const gap = rng.int(1, W - 2); for (let x = 0; x < W; x++) if (x !== gap) setWall(x, y, CELL.pit); break; }
      case "S17": { const y = rng.int(2, H - 3); const br = rng.int(0, W - 2); for (let x = 0; x < W; x++) setWall(x, y, x === br || x === br + 1 ? CELL.bridge : CELL.pit); break; }
      case "B21": {
        // a spiral: two nested hooks of wall
        const x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2;
        for (let x = x0; x <= x1 - 1; x++) setWall(x, y1);
        for (let y = y0 + 1; y <= y1; y++) setWall(x0, y);
        for (let x = x0 + 2; x <= x1; x++) setWall(x, y0 + 1);
        break;
      }
      case "B22": { const n = rng.int(3, 5); for (let k = 0; k < n; k++) { const horiz = rng.chance(0.5), len = rng.int(2, 3), x0 = rng.int(1, W - 2 - (horiz ? len : 0)), y0 = rng.int(1, H - 2 - (horiz ? 0 : len)); for (let j = 0; j < len; j++) setWall(x0 + (horiz ? j : 0), y0 + (horiz ? 0 : j)); } break; }
    }
  }
  // edge rails (B13 / B14)
  if (anyOf(has, "B13", "B14")) {
    rails = new Array(W * H).fill(0);
    const n = has("B14") ? Math.round((W * H) / 6) : rng.int(3, 5);
    for (let k = 0; k < n; k++) {
      const x = rng.int(0, W - 2), y = rng.int(0, H - 2), vert = rng.chance(0.5), len = has("B14") ? rng.int(1, 3) : rng.int(2, 3);
      for (let j = 0; j < len; j++) {
        const cx = vert ? x : x + j, cy = vert ? y + j : y;
        if (cx >= W - 1 || cy >= H) continue;
        if (vert) { if (cy >= H) continue; rails[cy * W + cx] |= 2; rails[cy * W + cx + 1] |= 8; }
        else { if (cy + 1 >= H || cx >= W) continue; rails[cy * W + cx] |= 1; rails[(cy + 1) * W + cx] |= 4; }
      }
    }
    // no rail through a dock
    for (let i = 0; i < W * H; i++) if (dock[i]) { const x = i % W, y = (i / W) | 0; rails[i] = 0; if (x > 0) rails[i - 1] &= ~2; if (x < W - 1) rails[i + 1] &= ~8; if (y > 0) rails[i - W] &= ~1; if (y < H - 1) rails[i + W] &= ~4; }
  }
  // the free cells must stay one connected space (pits and bridges count as open for this check)
  if (!connected(W, H, walls.map((v) => (v === CELL.wall ? 1 : 0))) && !has("B28")) return null;
  // floor tiles
  const freeCell = () => { for (let t = 0; t < 40; t++) { const x = rng.int(0, W - 1), y = rng.int(0, H - 1), i = y * W + x; if (!walls[i] && !dock[i] && !tiles[i]) return i; } return -1; };
  const pads: Pad[] = [];
  const turnIdeas = ["T01", "T02", "T03", "T24", "M03", "M27", "P04", "R11", "H05"];
  const wantPads = turnIdeas.some(has) || (r.kind !== "meet" && (knows("T01") || knows("T02")) && rng.chance(0.2 + Math.min(1, d) * 0.3));
  if (wantPads) {
    const n = 1 + (d > 0.7 && rng.chance(0.5) ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const i = freeCell(); if (i < 0) break;
      const flipPad = (has("T03") || has("P04")) && k === 0;
      const ccw = !flipPad && (has("T02") ? k === 0 || rng.chance(0.5) : knows("T02") && rng.chance(0.3));
      tiles[i] = flipPad ? TILE.flip : ccw ? TILE.padBack : TILE.pad;
      pads.push({ cell: i, uses: 0, ccw, ...(flipPad ? { flip: true } : {}) });
    }
  }
  if (anyOf(has, "T06", "K14", "M06", "M23") || (knows("T06") && r.kind !== "meet" && rng.chance(0.18 + Math.min(1, d) * 0.2))) {
    const strips = has("K14") ? 3 : 1;
    for (let k = 0; k < strips; k++) {
      for (let t = 0; t < 20; t++) {
        const horiz = rng.chance(0.5), len = rng.int(2, horiz ? Math.min(4, W - 2) : Math.min(4, H - 2));
        const dir: Dir = horiz ? (rng.chance(0.5) ? 1 : 3) : (rng.chance(0.5) ? 0 : 2);
        const x0 = rng.int(0, W - (horiz ? len : 1)), y0 = rng.int(0, H - (horiz ? 1 : len));
        let ok = true;
        for (let j = 0; j < len; j++) { const x = x0 + (horiz ? j : 0), y = y0 + (horiz ? 0 : j), i = y * W + x; if (walls[i] || dock[i] || tiles[i]) ok = false; }
        if (!ok) continue;
        for (let j = 0; j < len; j++) { const i = (y0 + (horiz ? 0 : j)) * W + x0 + (horiz ? j : 0); tiles[i] = TILE.belt; tdir[i] = dir; }
        break;
      }
    }
  }
  if (has("T07") || (knows("T07") && r.kind !== "meet" && rng.chance(0.15 + Math.min(1, d) * 0.2))) {
    for (let t = 0; t < 20; t++) {
      const horiz = rng.chance(0.5), len = rng.int(2, 3);
      const dir: Dir = horiz ? (rng.chance(0.5) ? 1 : 3) : (rng.chance(0.5) ? 0 : 2);
      const x0 = rng.int(0, W - (horiz ? len : 1)), y0 = rng.int(0, H - (horiz ? 1 : len));
      let ok = true;
      for (let j = 0; j < len; j++) { const i = (y0 + (horiz ? 0 : j)) * W + x0 + (horiz ? j : 0); if (walls[i] || dock[i] || tiles[i]) ok = false; }
      if (!ok) continue;
      for (let j = 0; j < len; j++) { const i = (y0 + (horiz ? 0 : j)) * W + x0 + (horiz ? j : 0); tiles[i] = TILE.arrow; tdir[i] = dir; }
      break;
    }
  }
  // paint pots (T11 & friends): one per painted colour
  if (anyOf(has, "T11", "C17", "C18", "J19", "C19", "M22")) {
    const plain = blocks.filter((b) => b.color < 8 && !b.partCols);
    if (!plain.length) return null;
    const b = plain[rng.int(0, plain.length - 1)];
    const i = freeCell(); if (i < 0) return null;
    tiles[i] = TILE.paint; tval[i] = b.color + (has("C18") ? 16 * 2 : 0);
  }
  if (anyOf(has, "F02")) rules.blob = true;
  // crates (M05 / M04 / O15 / O24): boxes you can drag that never leave
  const crates = anyOf(has, "M05", "M04", "O15", "O24") ? rng.int(1, 2 + (d > 0.7 ? 1 : 0)) : 0;
  const crateFlags: PieceFlags | undefined = has("M04") ? { axis: rng.chance(0.5) ? 0 : 1 } : anyOf(has, "O15", "O24") ? { bouncy: true } : undefined;
  return { W, H, walls, tiles, tdir, tval, rails, pads, gates, blocks, dock, rules, crates, crateFlags };
}
function freeAt(x: number, rng: Rng, H: number, ok: (y: number) => boolean) {
  for (let t = 0; t < 20; t++) { const y = rng.int(0, H - 1); if (ok(y)) return y; }
  return -1;
}

function forDock(g: Gate, b: { w: number; dep: number }, W: number, H: number, f: (x: number, y: number) => void) {
  if (g.side === 4) { const gx = g.at % W, gy = (g.at / W) | 0; for (let j = 0; j < (g.h ?? 1); j++) for (let i = 0; i < g.w; i++) f(gx + i, gy + j); return; }
  for (let a = 0; a < b.w; a++) for (let k = 0; k < b.dep; k++) {
    switch (g.side) {
      case 0: f(g.at + a, H - 1 - k); break;
      case 2: f(g.at + a, k); break;
      case 1: f(W - 1 - k, g.at + a); break;
      case 3: f(k, g.at + a); break;
    }
  }
}
function connected(W: number, H: number, walls: number[]) {
  const start = walls.findIndex((v) => !v);
  if (start < 0) return false;
  const seen = new Uint8Array(W * H); const q = [start]; seen[start] = 1; let n = 1;
  for (let i = 0; i < q.length; i++) {
    const x = q[i] % W, y = (q[i] / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (seen[j] || walls[j]) continue; seen[j] = 1; q.push(j); n++;
    }
  }
  return n === walls.filter((v) => !v).length;
}

/** cut a w × h rectangle into `parts` jellies of allowed shapes */
function partition(w: number, h: number, parts: number, allowed: Set<string>, rng: Rng, gateW: number, sideways: boolean, ring: boolean): number[][] | null {
  if (parts <= 1) return [[...Array(w * h)].flatMap((_, i) => [i % w, (i / w) | 0])];
  // P14: a 3 × 3 block is a C-shaped ring and its two-cell plug
  if (ring && w === 3 && h === 3) {
    let rc = SHAPES.ring7, plug = [1, 1, 2, 1];
    for (let k = rng.int(0, 3); k > 0; k--) { rc = rotCells(rc, 3); plug = rotCells(plug, 3); }
    return [rc, plug];
  }
  for (let t = 0; t < 140; t++) {
    const owner = new Int8Array(w * h).fill(-1);
    const sizes = new Array(parts).fill(0);
    const cells = shuffle([...Array(w * h).keys()], rng);
    for (let k = 0; k < parts; k++) { owner[cells[k]] = k; sizes[k] = 1; }
    let left = w * h - parts, guard = 0;
    while (left > 0 && guard++ < 400) {
      // grow the smallest region that can grow
      const order = [...Array(parts).keys()].sort((a, b) => sizes[a] - sizes[b] || rng.next() - 0.5);
      let grew = false;
      for (const k of order) {
        const opts: number[] = [];
        for (let i = 0; i < w * h; i++) if (owner[i] === k) {
          const x = i % w, y = (i / w) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && owner[ny * w + nx] < 0) opts.push(ny * w + nx); }
        }
        if (!opts.length) continue;
        owner[opts[rng.int(0, opts.length - 1)]] = k; sizes[k]++; left--; grew = true; break;
      }
      if (!grew) break;
    }
    if (left > 0) continue;
    const out: number[][] = [];
    let ok = true;
    for (let k = 0; k < parts && ok; k++) {
      const c: number[] = [];
      for (let i = 0; i < w * h; i++) if (owner[i] === k) c.push(i % w, (i / w) | 0);
      const type = typeOf(c);
      if (!type || !allowed.has(type)) ok = false;
      // a part that is already a gate-sized rectangle would skip the squish
      const b = bounds(normalise(c).c);
      if (gateW > 1 && b.w * b.h === c.length >> 1 && ((sideways ? b.h : b.w) === gateW || (allowed.has("__turn") && (sideways ? b.w : b.h) === gateW))) ok = false;
      out.push(c);
    }
    if (ok) return out;
  }
  return null;
}
/** rotate absolute cells inside an n × n box */
function rotCells(c: number[], n: number) { const a: number[] = []; for (let i = 0; i < c.length; i += 2) a.push(c[i + 1], n - 1 - c[i]); return a; }

const isRectCells = (abs: number[]) => { const n = normalise(abs); const b = bounds(n.c); return b.w * b.h === n.c.length >> 1; };
/** cells next to a set of cells (a one-cell ring) */
function ringOf(cells: Set<number>, W: number, H: number) {
  const out = new Set<number>();
  for (const ci of cells) { const x = ci % W, y = (ci / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !cells.has(ny * W + nx)) out.add(ny * W + nx); } }
  return out;
}

/** the shapes this stage may use */
function shapesFor(r: Recipe, has: (c: string) => boolean, knows: (c: string) => boolean, turns: boolean) {
  const allowed = new Set<string>();
  for (const [c, shapes] of Object.entries(SHAPE_CONCEPT)) if (knows(c)) shapes.forEach((x) => allowed.add(x));
  if (!allowed.size) allowed.add("bar2");
  if (knows("P23") || has("K16") || has("P29")) allowed.add("mono");
  if (has("P29") || has("K16")) allowed.add("giant");
  if (turns) allowed.add("__turn");
  return allowed;
}

/**
 * Build a stage backwards from its solution. Blocks leave in a chosen order; going back in time, each block reappears
 * at its gate, splits into its parts, and the parts slide out one by one (a turned part leaves through a turn pad and
 * turns back; a painted part through the paint pot and takes its old colour). Whatever sits in a gate's way is moved
 * aside first. Then a short scramble pushes some jellies into other blocks' gate spots, so the player has to clear them
 * first. The recorded drops, reversed, are the solution.
 */
function backbuild(r: Recipe, lay: Layout, rng: Rng, has: (c: string) => boolean, knows: (c: string) => boolean) {
  const { W, H, walls, tiles, tdir, tval, gates, blocks, rails } = lay;
  const turns = lay.pads.length > 0;
  const allowed = shapesFor(r, has, knows, turns);
  const focusShapes = r.focus.flatMap((c) => SHAPE_CONCEPT[c] ?? []);
  interface Part { id: number; color: number; c: number[]; tx: number; ty: number; block: number; xf: "" | "turn" | "paint"; f?: PieceFlags; from?: number }
  const parts: Part[] = [];
  let id = 1;
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi], g = gates[b.gate];
    const sideways = g.side === 1 || g.side === 3;
    const bw = g.side === 4 ? b.w : sideways ? b.dep : b.w, bh = g.side === 4 ? b.dep : sideways ? b.w : b.dep;
    let cut: number[][] | null = null;
    for (let t = 0; t < 5 && !cut; t++) {
      const p = partition(bw, bh, Math.max(b.parts > 1 ? 2 : 1, b.parts - (t >= 3 ? 1 : 0)), allowed, rng, g.side === 4 ? 0 : b.w, sideways, has("P14") && bi === 0);
      if (p && focusShapes.length && t < 2 && !p.some((c) => focusShapes.includes(typeOf(c) ?? ""))) continue;
      cut = p;
    }
    if (!cut) return null;
    const ox = g.side === 4 ? g.at % W : g.side === 1 ? W - bw : g.side === 3 ? 0 : g.at;
    const oy = g.side === 4 ? (g.at / W) | 0 : g.side === 0 ? H - bh : g.side === 2 ? 0 : g.at;
    cut.forEach((c0, j) => {
      const n0 = normalise(c0);
      const color = b.partCols ? b.partCols[j % b.partCols.length] : b.color;
      parts.push({ id: id++, color, c: n0.c, tx: ox + n0.x, ty: oy + n0.y, block: bi, xf: "" });
    });
  }
  // twin pieces (P28): a two-part block of mirror images
  // special parts: rainbow (J01), heavy (J04 / O21), ghost (J12), bubble (J03), rail (J26), arrow (J25)
  const plainParts = () => shuffle(parts.filter((p) => p.color < 8 && !p.f && p.xf === ""), rng);
  const flagOne = (f: PieceFlags) => { const p = plainParts()[0]; if (!p) return false; p.f = { ...(p.f ?? {}), ...f }; return true; };
  if (has("J01")) { const p = shuffle(parts.filter((q) => q.color < 8 && blocks[q.block].parts >= 2 && !blocks[q.block].partCols), rng)[0]; if (!p) return null; p.color = RAINBOW; }
  if (anyOf(has, "J04", "O21") && !flagOne({ heavy: true })) return null;
  if (has("J12") && !flagOne({ ghost: true })) return null;
  if (has("J03") && !flagOne({ bubble: true })) return null;
  if (has("J26") && !flagOne({ axis: rng.chance(0.5) ? 0 : 1 })) return null;
  if (has("J25") && !flagOne({ arrow: rng.int(0, 3) as Dir })) return null;
  // parts that start turned (they must visit a turn pad)
  let turned = 0;
  if (turns) {
    const xform = (c: number[]) => (lay.pads[0].flip ? flip(c) : lay.pads[0].ccw ? rot(c) : rot(rot(rot(c))));
    for (const p of shuffle(parts, rng)) {
      if (p.f?.heavy || p.f?.axis !== undefined || p.f?.arrow !== undefined) continue;
      if (turned >= (has("R11") ? 1 : 1 + Math.round(Math.min(1, r.d) * 2)) || !rng.chance(0.4 + Math.min(1, r.d) * 0.3)) continue;
      if (xform(p.c).join(",") !== p.c.join(",")) { p.xf = "turn"; turned++; }
    }
    // a stage about turn / flip pads always has a jelly that really needs one
    if (!turned && ["T01", "T02", "T03", "P04", "T24", "M03", "M27"].some(has)) {
      const p = shuffle(parts, rng).find((q) => !q.f && xform(q.c).join(",") !== q.c.join(","));
      if (!p) return null;
      p.xf = "turn"; turned = 1;
    }
  }
  // painted parts: they start another colour and pick theirs up at the paint pot
  const paintCells = tiles.map((t, i) => (t === TILE.paint ? i : -1)).filter((i) => i >= 0);
  let painted = 0;
  for (const ci of paintCells) {
    const col = tval[ci] & 15;
    const p = shuffle(parts.filter((q) => q.color === col && q.xf === "" && !q.f), rng)[0];
    if (!p) return null;
    const others = [...new Set(parts.map((q) => q.color))].filter((c) => c !== col && c < 8);
    const from = others.length ? others[rng.int(0, others.length - 1)] : PLAIN_COLOURS.find((c) => c !== col && c !== 4 && c !== 0)!;
    p.xf = "paint"; p.from = from; painted++;
  }
  const padCell = new Set(lay.pads.map((p) => p.cell));
  const cur = new Map<number, Piece>();
  const fwd: Move[] = [];
  const cellsAt = (c: number[], x: number, y: number) => { const a: number[] = []; for (let i = 0; i < c.length; i += 2) a.push((y + c[i + 1]) * W + x + c[i]); return a; };
  const grid = () => { const o = new Int16Array(W * H); for (let i = 0; i < o.length; i++) { const w = walls[i]; o[i] = w === CELL.wall ? -1 : w === CELL.pit ? -2 : w === CELL.bridge ? -3 : 0; } for (const p of cur.values()) for (const ci of cellsAt(p.c, p.x, p.y)) o[ci] = p.id; return o; };
  /** origins a shape could have come from (going back in time), BFS order */
  const reachOf = (c: number[], x0: number, y0: number, self: number, o: Int16Array, f?: PieceFlags, color = -1) => {
    const b = bounds(c), minSide = Math.min(b.w, b.h);
    const pass = (v: number) => v === 0 || v === self || v === -3 || (v === -1 && !!f?.ghost) || (v === -2 && !!(f?.bubble || f?.ghost));
    const ok = (x: number, y: number) => {
      for (let i = 0; i < c.length; i += 2) { const cx = x + c[i], cy = y + c[i + 1]; if (cx < 0 || cy < 0 || cx >= W || cy >= H || !pass(o[cy * W + cx])) return false; }
      return true;
    };
    /** the forward step into (x, y) going d is allowed by arrows and filters */
    const entryOK = (x: number, y: number, d: number) => {
      for (let i = 0; i < c.length; i += 2) {
        const ci = (y + c[i + 1]) * W + x + c[i], t = tiles[ci];
        if (t === TILE.arrow && tdir[ci] !== d) return false;
        if (t === TILE.filterC && tval[ci] !== color) return false;
        if (t === TILE.filterS && minSide > tval[ci]) return false;
      }
      return true;
    };
    const railOK = (x: number, y: number, d: number) => { if (!rails) return true; for (let i = 0; i < c.length; i += 2) if (rails[(y + c[i + 1]) * W + x + c[i]] & (1 << d)) return false; return true; };
    const onMud = (x: number, y: number) => { for (let i = 0; i < c.length; i += 2) if (tiles[(y + c[i + 1]) * W + x + c[i]] === TILE.mud) return true; return false; };
    const out: number[] = [y0 * W + x0], depth = [0];
    const seen = new Set(out);
    for (let qi = 0; qi < out.length; qi++) {
      if (f?.heavy && depth[qi] >= 1) continue;
      const x = out[qi] % W, y = (out[qi] / W) | 0;
      if (qi > 0 && onMud(x, y)) continue;
      for (let d = 0; d < 4; d++) {
        if (f?.axis !== undefined && (d % 2 === 1) !== (f.axis === 0)) continue;
        if (f?.arrow !== undefined && d !== f.arrow) continue;
        const nx = x - DX[d], ny = y - DY[d], k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || !ok(nx, ny) || !entryOK(x, y, d) || !railOK(nx, ny, d)) continue;
        seen.add(k); out.push(k); depth.push(depth[qi] + 1);
      }
    }
    return out;
  };
  const special = (ci: number) => tiles[ci] !== TILE.floor;
  /** a resting spot: on plain floor, never squishing by accident, not a gate-ready rectangle */
  const restOK = (pc: Piece, x: number, y: number, o: Int16Array, avoid: Set<number>) => {
    const here = cellsAt(pc.c, x, y);
    for (const ci of here) {
      if (avoid.has(ci) || special(ci) || padCell.has(ci)) return false;
      const v = o[ci];
      if (v === -3 || (v === -1) || (v === -2 && !pc.f?.bubble)) return false;
    }
    if (rails) { const set = new Set(here); for (const ci of here) { const rr = rails[ci]; if ((rr & 2) && set.has(ci + 1) && (ci % W) + 1 < W) return false; if ((rr & 1) && set.has(ci + W)) return false; } }
    const touch = new Set<number>();
    for (const ci of here) {
      const cx = ci % W, cy = (ci / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const v = o[ny * W + nx];
        const q = v > 0 ? cur.get(v) : undefined;
        if (q && v !== pc.id && (squishCompatible({ rules: lay.rules } as Level, q.color, pc.color))) touch.add(v);
      }
    }
    if (touch.size) {
      if (lay.rules.blob) return false;
      const mine = here.flatMap((ci) => [ci % W, (ci / W) | 0]);
      const unionRect = (ids: number[]) => { const all = mine.slice(); for (const id2 of ids) { const q = cur.get(id2)!; for (const ci of cellsAt(q.c, q.x, q.y)) all.push(ci % W, (ci / W) | 0); } return isRectCells(all); };
      const ids = [...touch];
      if (unionRect(ids) || ids.some((t) => unionRect([t]))) return false;
      if (ids.length >= 2) for (let a = 0; a < ids.length; a++) for (let b2 = a + 1; b2 < ids.length; b2++) if (unionRect([ids[a], ids[b2]])) return false;
    }
    const b = bounds(pc.c);
    if (b.w * b.h === pc.c.length >> 1) {
      for (const g of gates) {
        if (g.kind === "box" || !takes(g, pc.color)) continue;
        const fit = g.side === 4 ? x === g.at % W && y === ((g.at / W) | 0) && b.w === g.w && b.h === (g.h ?? 1)
          : (g.side === 0 && y + b.h === H && x === g.at && b.w === g.w) || (g.side === 2 && y === 0 && x === g.at && b.w === g.w) || (g.side === 1 && x + b.w === W && y === g.at && b.h === g.w) || (g.side === 3 && x === 0 && y === g.at && b.h === g.w);
        if (fit) return false;
      }
    }
    return true;
  };
  const pickFar = (opts: number[]) => opts[Math.max(0, opts.length - 1 - rng.int(0, Math.max(0, Math.floor(opts.length / 3))))];
  const dockOf = (bi: number) => new Set(parts.filter((p) => p.block === bi).flatMap((p) => cellsAt(p.c, p.tx, p.ty)));
  // exit order: narrowing gates send their wide block first
  let order = shuffle([...blocks.keys()], rng);
  order = order.sort((a, b) => {
    const ga = blocks[a].gate, gb = blocks[b].gate;
    if (ga !== gb || !gates[ga].narrow) return 0;
    return blocks[b].w - blocks[a].w;
  });
  // crates sit somewhere at the end (and get shoved around on the way back)
  for (let c = 0; c < lay.crates; c++) {
    const o = grid(), allDocks = new Set(blocks.flatMap((_, bi) => [...dockOf(bi)]));
    const shape = rng.chance(0.6) ? [0, 0] : [0, 0, 1, 0];
    let placed = false;
    for (let t = 0; t < 40 && !placed; t++) {
      const sb = bounds(shape), x = rng.int(0, W - sb.w), y = rng.int(0, H - sb.h);
      const crate: Piece = { id: 900 + c, color: CRATE, c: shape, x, y, parts: 1, ...(lay.crateFlags ? { f: { ...lay.crateFlags } } : {}) };
      if (cellsAt(shape, x, y).some((ci) => o[ci] !== 0)) continue;
      if (!restOK(crate, x, y, o, allDocks)) continue;
      cur.set(crate.id, crate); placed = true;
    }
  }
  for (let oi = order.length - 1; oi >= 0; oi--) {
    const bi = order[oi];
    const mine = parts.filter((p) => p.block === bi);
    const own = dockOf(bi);
    // this gate spot and every gate spot still to come stay free of parked jellies
    const dock = new Set(own);
    for (let oj = 0; oj < oi; oj++) for (const ci of dockOf(order[oj])) dock.add(ci);
    const roomy = new Set(dock);
    for (const ci of ringOf(dock, W, H)) roomy.add(ci);
    // 1 · clear the gate spot (forward: those jellies move in after this block has gone)
    for (const X of [...cur.values()]) {
      if (!cellsAt(X.c, X.x, X.y).some((ci) => own.has(ci))) continue;
      const o = grid();
      let R = reachOf(X.c, X.x, X.y, X.id, o, X.f, X.color).filter((pos) => restOK(X, pos % W, (pos / W) | 0, o, roomy));
      if (!R.length) R = reachOf(X.c, X.x, X.y, X.id, o, X.f, X.color).filter((pos) => restOK(X, pos % W, (pos / W) | 0, o, dock));
      if (!R.length) return null;
      const to = pickFar(R);
      fwd.push({ id: X.id, x: X.x, y: X.y });
      X.x = to % W; X.y = (to / W) | 0;
    }
    // 2 · the block's parts at its gate
    for (const p of mine) cur.set(p.id, { id: p.id, color: p.color, c: p.c, x: p.tx, y: p.ty, parts: 1, ...(p.f ? { f: { ...p.f } } : {}) });
    // 3 · out one by one (forward: in one by one; the last one squishes the block out of the gate)
    const left = shuffle(mine, rng);
    const bg = gates[blocks[bi].gate];
    /** would these parts (all in the gate spot) already squish into a block that fits the gate? */
    const fitsEarly = (rest: Part[]) => {
      if (bg.kind === "box") return false;
      for (let mask = 1; mask < 1 << rest.length; mask++) {
        const all: number[] = [];
        rest.forEach((q, j) => { if (mask & (1 << j)) for (let i = 0; i < q.c.length; i += 2) all.push(q.tx + q.c[i], q.ty + q.c[i + 1]); });
        const n = normalise(all), b = bounds(n.c);
        if (b.w * b.h !== n.c.length >> 1) continue;
        const fit = bg.side === 4 ? n.x === bg.at % W && n.y === ((bg.at / W) | 0) && b.w === bg.w && b.h === (bg.h ?? 1)
          : bg.side === 0 ? n.y + b.h === H && n.x === bg.at && b.w === bg.w : bg.side === 2 ? n.y === 0 && n.x === bg.at && b.w === bg.w
            : bg.side === 1 ? n.x + b.w === W && n.y === bg.at && b.h === bg.w : n.x === 0 && n.y === bg.at && b.h === bg.w;
        if (fit) return true;
      }
      return false;
    };
    while (left.length) {
      let moved = false;
      for (let li = 0; li < left.length && !moved; li++) {
        const p = left[li], P = cur.get(p.id)!;
        if (left.length > 1 && fitsEarly(left.filter((q) => q !== p))) continue;
        const o = grid();
        const R = reachOf(P.c, P.x, P.y, P.id, o, P.f, P.color);
        if (p.xf === "") {
          let dests = R.filter((pos) => restOK(P, pos % W, (pos / W) | 0, o, roomy));
          if (!dests.length) dests = R.filter((pos) => restOK(P, pos % W, (pos / W) | 0, o, dock));
          if (!dests.length) continue;
          // prefer spots after which every other part still has a way out
          const others = left.filter((q) => q !== p && q.xf === "");
          const keepsFree = (pos: number) => {
            const ox0 = P.x, oy0 = P.y;
            P.x = pos % W; P.y = (pos / W) | 0;
            const o2 = grid();
            const ok = others.every((q) => { const Q = cur.get(q.id)!; return reachOf(Q.c, Q.x, Q.y, Q.id, o2, Q.f, Q.color).some((pp) => restOK(Q, pp % W, (pp / W) | 0, o2, dock)); });
            P.x = ox0; P.y = oy0;
            return ok;
          };
          const far = dests.slice(Math.floor(dests.length / 2)).reverse();
          const to = (others.length ? far.find(keepsFree) ?? dests.slice().reverse().find(keepsFree) : undefined) ?? pickFar(dests);
          fwd.push({ id: P.id, x: P.x, y: P.y });
          P.x = to % W; P.y = (to / W) | 0;
          left.splice(li, 1); moved = true;
          continue;
        }
        if (p.xf === "paint") {
          // to the paint pot in its finished colour, take the old colour, then away
          for (const pos of shuffle(R, rng)) {
            const x = pos % W, y = (pos / W) | 0;
            const here = cellsAt(P.c, x, y);
            if (here.some((ci) => own.has(ci)) || !here.some((ci) => tiles[ci] === TILE.paint && (tval[ci] & 15) === P.color)) continue;
            if (here.some((ci) => special(ci) && tiles[ci] !== TILE.paint) || here.some((ci) => o[ci] !== 0 && o[ci] !== P.id)) continue;
            const before: Piece = { ...P, color: p.from!, x, y };
            const R2 = reachOf(P.c, x, y, P.id, o, P.f, before.color).filter((q) => q !== pos && restOK(before, q % W, (q / W) | 0, o, dock));
            if (!R2.length) continue;
            const to = pickFar(R2);
            fwd.push({ id: P.id, x: P.x, y: P.y }); // forward: from the pot into the gate spot
            fwd.push({ id: P.id, x, y }); // forward: onto the pot (it takes the colour)
            P.color = p.from!; P.x = to % W; P.y = (to / W) | 0;
            left.splice(li, 1); moved = true;
            break;
          }
          continue;
        }
        // a turned part: to a pad in its finished shape, turn back, then away
        for (const pad of lay.pads) {
          if (moved) break;
          const px = pad.cell % W, py = (pad.cell / W) | 0;
          for (const pos of shuffle(R, rng)) {
            const x = pos % W, y = (pos / W) | 0;
            const here = cellsAt(P.c, x, y);
            if (!here.includes(pad.cell) || here.some((ci) => own.has(ci))) continue;
            // the shape that a forward turn brings to exactly (x, y, P.c)
            const abs: number[] = [];
            for (let i = 0; i < P.c.length; i += 2) {
              const rx = x + P.c[i] - px, ry = y + P.c[i + 1] - py;
              if (pad.flip) abs.push(px - rx, py + ry); else if (pad.ccw) abs.push(px + ry, py - rx); else abs.push(px - ry, py + rx);
            }
            const n = normalise(abs);
            let fit = true;
            for (let i = 0; i < n.c.length && fit; i += 2) {
              const cx = n.x + n.c[i], cy = n.y + n.c[i + 1];
              if (cx < 0 || cy < 0 || cx >= W || cy >= H) { fit = false; break; }
              const v = o[cy * W + cx];
              if (v !== 0 && v !== P.id) fit = false;
            }
            if (!fit || (n.c.join() === P.c.join() && n.x === x && n.y === y)) continue;
            const turnedPiece: Piece = { ...P, c: n.c, x: n.x, y: n.y };
            const R2 = reachOf(n.c, n.x, n.y, P.id, o, P.f, P.color).filter((q) => q !== n.y * W + n.x && restOK(turnedPiece, q % W, (q / W) | 0, o, dock));
            if (!R2.length) continue;
            const to = pickFar(R2);
            fwd.push({ id: P.id, x: P.x, y: P.y }); // forward: from the pad into the gate spot
            fwd.push({ id: P.id, x: n.x, y: n.y }); // forward: onto the pad (it turns)
            P.c = n.c; P.x = to % W; P.y = (to / W) | 0;
            left.splice(li, 1); moved = true;
            break;
          }
        }
      }
      if (!moved) return null;
    }
  }
  // 4 · scramble: some jellies start inside other blocks' gate spots (the player must clear them first)
  const knots = anyOf(has, "O34", "P26", "P27") ? 2 : 0;
  const tangles = Math.max(0, Math.round(Math.min(1.2, r.d) * 3 + Math.max(0, Math.min(1.8, r.d) - 1.2) * 2.5 + knots + (r.kind === "burner" || r.kind === "boss" ? 1 : 0) + (r.kind === "breather" || r.kind === "meet" ? -1 : 0)));
  const docks = [...blocks.keys()].map(dockOf);
  for (let t = 0; t < tangles; t++) {
    let done = false;
    for (const X of shuffle([...cur.values()], rng)) {
      if (done) break;
      const o = grid();
      const ownBlock = parts.find((p) => p.id === X.id)?.block ?? -1;
      const R = reachOf(X.c, X.x, X.y, X.id, o, X.f, X.color).filter((pos) => {
        const x = pos % W, y = (pos / W) | 0;
        if (!restOK(X, x, y, o, new Set())) return false;
        const cs = cellsAt(X.c, x, y);
        return docks.some((dk, bi) => bi !== ownBlock && cs.some((ci) => dk.has(ci)));
      });
      if (!R.length) continue;
      const to = R[rng.int(0, R.length - 1)];
      fwd.push({ id: X.id, x: X.x, y: X.y });
      X.x = to % W; X.y = (to / W) | 0;
      done = true;
    }
  }
  const pieces = [...cur.values()].sort((a, b) => a.id - b.id).map((p) => ({ ...p, c: p.c.slice() }));
  const pads = lay.pads.map((p) => ({ ...p, uses: Math.max(1, turned + (r.d < 0.5 ? 1 : 0) + (has("T24") || has("M03") || has("M27") ? 2 : 0)) }));
  void painted;
  return { pieces, pads, solution: fwd.reverse() };
}

/** used by the Jam Lab and modes: a recipe built from chosen concepts */
export function customRecipe(n: number, seed: number, focus: string[], d: number, world: number, name: string, mode: string, known?: string[]): Recipe {
  const pool = known ?? learned(TAUGHT_WORLDS, STAGES_PER_WORLD).filter((c) => buildable(c));
  return { n, seed, world, stage: 0, kind: "mix", d, name, focus: focus.filter((c) => CONCEPT[c]), known: [...new Set([...CORE, ...pool, ...focus])], mode };
}

// ---------------------------------------------------------------- modes (phase 4)
export type ModeKind = "daily" | "weekly" | "rush" | "zen" | "lab" | "pack";
export interface ModeSpec { mode: ModeKind; key: string; idx: number; focus?: string[]; d?: number }
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** the world that teaches a concept (for a mode stage's look) */
export const worldOfConcept = (c: string) => WORLDS.find((w) => w.teach?.includes(c))?.id ?? 1;
/** the concepts of one group, in the order the worlds teach them */
export const groupConcepts = (g: string) => WORLDS.flatMap((w) => w.teach ?? []).filter((c) => c[0] === g && buildable(c));
/** a stage for a mode: the player's own learned ideas (`known`), mixed the mode's way */
export function modeRecipe(sp: ModeSpec, known: string[]): Recipe {
  const seed = hash32(hashStr(`${sp.mode}:${sp.key}`), sp.idx, 0x3d);
  const rng = new Rng(seed);
  const pool0 = known.filter((c) => buildable(c) && !CORE.includes(c));
  const pool = pool0.length >= 4 ? pool0 : learned(2, STAGES_PER_WORLD).filter((c) => buildable(c) && !CORE.includes(c));
  const pickN = (k: number, from = pool, cls?: (c: string) => boolean) => {
    for (let t = 0; t < 30; t++) {
      const a = shuffle(from.filter((c) => !cls || cls(c)), rng).slice(0, k);
      if (!a.length || compatibleAtoms(a)) return a;
    }
    return [];
  };
  const quick = (c: string) => CLASS[c] !== "resolve";
  let focus: string[] = [], d = 0.6, name = "", world = 1 + rng.int(0, 19);
  const n = 100000 + (hashStr(sp.mode) % 1000) * 100 + sp.idx;
  switch (sp.mode) {
    case "daily": focus = pickN(rng.int(2, 3)); d = 0.75; name = `Daily Jam · ${sp.key}`; break;
    case "weekly": {
      const bosses = pool.filter((c) => c[0] === "K");
      const boss = bosses.length ? bosses[rng.int(0, bosses.length - 1)] : "K16";
      focus = [boss, ...pickN(1, pool, (c) => c[0] !== "K")]; d = 1.0; name = `Kranky Weekly · ${CONCEPT[boss]?.name ?? "Boss"}`; world = 20;
      break;
    }
    case "rush": focus = sp.idx % 2 ? pickN(1, pool, quick) : []; d = Math.min(0.75, 0.18 + sp.idx * 0.035); name = `Rush ${sp.idx + 1}`; break;
    case "zen": focus = pickN(rng.chance(0.6) ? 1 : 0, pool, (c) => quick(c) && CLASS[c] !== "post"); d = 0.3 + rng.next() * 0.15; name = `Zen ${sp.idx + 1}`; break;
    case "lab": focus = (sp.focus ?? []).filter((c) => CONCEPT[c]).slice(0, 3); d = sp.d ?? 0.6; name = "Jam Lab"; break;
    case "pack": {
      const g = groupConcepts(sp.key).filter((c) => pool0.includes(c) || CLASS[c] === "layout");
      const c = g.length ? g[sp.idx % g.length] : undefined;
      focus = c ? [c] : []; d = Math.min(1.1, 0.35 + sp.idx * 0.035); name = `${sp.key}-Pack ${sp.idx + 1}`;
      break;
    }
  }
  if (focus.length) world = worldOfConcept(focus[0]);
  return { n, seed, world, stage: 0, kind: sp.mode === "weekly" ? "boss" : "mix", d, name, focus, known: [...new Set([...CORE, ...pool, ...focus])], mode: sp.mode };
}
/** build a mode stage (zen stages drop every limit and timer) */
export function buildMode(sp: ModeSpec, known: string[]): Level {
  const L = buildStage(modeRecipe(sp, known));
  if (sp.mode === "zen" && L.rules) { delete L.rules.limit; delete L.rules.time; delete L.rules.combo; delete L.rules.noUndo; }
  if (sp.mode === "rush" && L.rules) delete L.rules.time;
  return L;
}
/** every concept learned by journey stage n (all 400 after the journey) */
export function knownAt(n: number): string[] {
  if (n > JOURNEY_STAGES) return learned(TAUGHT_WORLDS, STAGES_PER_WORLD);
  const world = Math.max(1, Math.ceil(n / STAGES_PER_WORLD)), stage = ((Math.max(1, n) - 1) % STAGES_PER_WORLD) + 1;
  return learned(world, stage);
}
/** is this concept something a stage can be built around? */
export const isBuildable = buildable;
