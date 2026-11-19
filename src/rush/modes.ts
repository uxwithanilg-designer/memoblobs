// Rollo Rush modes beside the journey (docs/ROLLO_RUSH_PLAN.md §10): Endless Moon Run, Daily Sprint, Time Trial, Boss
// Rush and Trick Park. Every mode stage comes out of the same builder and fairness bot as the journey; a mode only picks
// the recipe — which ideas, how hard, which world's look — and, for the park, takes the hazards away afterwards.
import { hash32, Rng } from "../roll/rng";
import { BUILT_WORLDS, STAGES_PER_WORLD } from "./data/worlds";
import { difficultyAt, knownAt, MIXABLE, recipeFor, type Recipe } from "./gen";
import type { ObjKind, Stage, StageKind } from "./types";

export type ModeId = "endless" | "daily" | "trial" | "boss" | "park";
/** one run of a mode: its seed, how far the journey has got (which ideas it may use), the stage for a Time Trial and
 * how many bosses a Boss Rush has */
export interface ModeRun { id: ModeId; seed: number; upto: number; n?: number; bosses?: number }
export interface ModeInfo { id: ModeId; name: string; emoji: string; blurb: string; unlockAt: number; grad: [string, string] }

export const MODES: ModeInfo[] = [
  { id: "endless", name: "Endless Moon Run", emoji: "🌙", blurb: "One run that never ends along the moonlit coast. It keeps getting faster — how far can you go?", unlockAt: 6, grad: ["#3F63C8", "#0A1550"] },
  { id: "daily", name: "Daily Sprint", emoji: "📅", blurb: "A brand-new stage every day, the same one for everybody. Run it each day to grow your streak!", unlockAt: 6, grad: ["#FF9E6B", "#D0505A"] },
  { id: "trial", name: "Time Trial", emoji: "⏱️", blurb: "Race your own ghost on any stage you have cleared. Beat the S-rank time!", unlockAt: 3, grad: ["#5CF2C9", "#1E7C8A"] },
  { id: "boss", name: "Boss Rush", emoji: "😈", blurb: "Every Kranky boss you have beaten, back to back, against the clock.", unlockAt: 21, grad: ["#FF5A7A", "#6A1030"] },
  { id: "park", name: "Trick Park", emoji: "🛹", blurb: "90 seconds of springs, ramps and loops with nothing to hit. Flick for tricks and score big!", unlockAt: 10, grad: ["#B88CFF", "#4A2A9A"] },
];
export const MODE: Record<ModeId, ModeInfo> = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeInfo>;
/** seconds in a Trick Park run */
export const PARK_TIME = 90;
const TAUGHT = BUILT_WORLDS * STAGES_PER_WORLD;
/** days since 1970 (local calendar day): the Daily Sprint's number */
export const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
/** bosses met so far on the journey (the boss is the 20th stage of each world) */
export const bossesBeaten = (stage: number) => Math.min(BUILT_WORLDS, Math.floor((stage - 1) / STAGES_PER_WORLD));
/** modes that are one stage long (the rest carry on, stage after stage) */
export const SINGLE: Record<ModeId, boolean> = { endless: false, daily: true, trial: true, boss: false, park: false };
/** modes where a knock-out ends the run */
export const ONE_RUN: Record<ModeId, boolean> = { endless: true, daily: false, trial: false, boss: true, park: false };

const PARK_IDEAS = ["A01", "L07", "X01", "A02", "L06", "S03", "S01", "S02", "C03", "L03", "L29", "P01"];
const NAMES = ["Glow", "Tide", "Comet", "Lantern", "Silver", "Starfall", "Moonbeam", "Night", "Pearl", "Breeze"];

function mixRecipe(o: { n: number; alt: number; seed: number; world: number; kind: StageKind; d: number; name: string; pool: string[]; k: number; mode: string; calm?: boolean }): Recipe {
  const rng = new Rng(o.seed);
  const a = o.pool.slice(), atoms: string[] = [];
  while (atoms.length < o.k && a.length) atoms.push(a.splice(rng.int(0, a.length - 1), 1)[0]);
  return {
    n: o.n, alt: o.alt, seed: o.seed, world: o.world, stage: 0, kind: o.kind, d: o.d, name: o.name, known: knownAt(o.n), focus: atoms,
    remix: { name: o.name, key: atoms.slice().sort().join("+"), atoms, blend: 0 }, look: { world: o.world }, mode: o.mode, calm: o.calm,
  };
}

/** the recipe for stage k (1, 2, 3…) of a mode run */
export function modeRecipe(m: ModeRun, k: number): Recipe {
  const upto = Math.max(1, Math.min(TAUGHT, m.upto));
  switch (m.id) {
    case "trial": return { ...recipeFor(m.n ?? 1, m.seed), mode: "trial" };
    case "boss": return { ...recipeFor(Math.min(BUILT_WORLDS, k) * STAGES_PER_WORLD, m.seed), mode: "boss", alt: k };
    case "endless": {
      // the moonlit coast forever: two learned ideas a stage, a breather every sixth, harder all the time
      const n = Math.max(8, upto), kind: StageKind = k % 6 === 0 ? "breather" : k % 6 === 3 ? "burner" : "remix";
      const d = Math.min(1.75, 0.32 + k * 0.07) + (kind === "burner" ? 0.1 : kind === "breather" ? -0.12 : 0);
      const seed = hash32(m.seed, k, 0xe11d);
      return mixRecipe({ n, alt: n + k, seed, world: 1, kind, d: Math.max(0.2, d), name: `${NAMES[seed % NAMES.length]} Run · ${k}`, pool: knownAt(n).filter((c) => MIXABLE.has(c)), k: k < 4 ? 2 : 3, mode: "endless" });
    }
    case "daily": {
      // the day picks everything, so everybody runs the same stage — in any world's colours
      const day = m.seed, n = 40 + ((day * 37) % 160);
      const seed = hash32(day, 0xda11, 7);
      return mixRecipe({ n, alt: day, seed, world: 1 + ((day * 11) % BUILT_WORLDS), kind: "remix", d: difficultyAt(n) * 0.85 + 0.1 * Math.sin(day), name: "Daily Sprint", pool: knownAt(n).filter((c) => MIXABLE.has(c)), k: 2, mode: "daily" });
    }
    case "park": {
      const n = Math.max(40, upto), known = new Set(knownAt(n));
      const seed = hash32(m.seed, k, 0x9a4c);
      const world = 1 + ((m.seed + k) % Math.max(1, Math.min(BUILT_WORLDS, Math.ceil(upto / STAGES_PER_WORLD))));
      return mixRecipe({ n, alt: n + k, seed, world, kind: "breather", d: 0.25, name: "Trick Park", pool: PARK_IDEAS.filter((c) => known.has(c)), k: 3, mode: "park", calm: true });
    }
  }
}

const HAZARD = new Set<ObjKind>(["spike", "bar", "wall", "crate", "rollbot", "hopper", "drone", "bomb", "laser", "fire", "crusher", "roller", "faller", "saw", "mine", "thorn", "swing", "clanker", "door", "gate", "cage"]);
const HARM_ZONE = new Set(["water", "lava", "zap", "web", "pull", "crumble", "hot", "wind", "goo", "oil", "ice", "headwind", "shrink", "slow", "mud"]);
/** Trick Park: nothing to bump into, no rules, every trick move switched on */
export function parkify(st: Stage): Stage {
  st.objs = st.objs.filter((o) => !HAZARD.has(o.k) && o.k !== "witch" && !(o.k === "zone" && HARM_ZONE.has(o.zone ?? "")) && o.k !== "pearlGate");
  st.intents = st.intents.filter((i) => i.act === "steer" || i.act === "jump" || i.act === "double");
  st.rules = undefined; st.chase = undefined; st.rival = undefined; st.target = undefined;
  st.moves = { ...st.moves, trick: true, curl: true, double: true };
  return st;
}
