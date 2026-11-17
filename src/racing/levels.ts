// Career: every world (theme) has 4 events. The next event opens when the previous one earns a star;
// the next world opens when the previous world's final event (the boss duel) is cleared.
// Difficulty follows the world's place in the career (0 = first world … 1 = last), however many worlds exist:
// early worlds are kind (easy AI, few rivals, 2 laps, lots of time), later ones are hard (pro AI, full grid,
// 3 laps, dense hazards, tight clocks). Coin Rush / Time Trial star targets are computed in the race from the
// real track and item layout (see RaceSession.targets) using `difficulty`, so they are always achievable.
import type { AiLevel, ModeId, RaceConfig, ThemeSpec } from "./types";
import { activeGame } from "./games";

export interface CareerLevel {
  id: string;
  index: number; // global 0..
  world: number;
  event: number; // 0..3
  themeId: string;
  mode: ModeId;
  title: string;
  laps: number;
  opponents: number;
  ai: AiLevel;
  variant: number;
  reverse: boolean;
  timeLimit?: number;
  coinTarget?: [number, number, number];
  rivalTier: number;
  /** 0..1 — AI talent/upgrades, hazard density, star targets */
  difficulty: number;
}

export const MODE_INFO: Record<ModeId, { label: string; icon: string; blurb: string }> = {
  race: { label: "Race", icon: "🏁", blurb: "Finish on the podium — 1st place earns 3 stars. Drift, draft and nitro past your rivals!" },
  coinrush: { label: "Coin Rush", icon: "💰", blurb: "Single Drive: grab coins, nitro, shields and magnets — dodge fire barrels, spikes and rocks (3 lives). Gates add time!" },
  timetrial: { label: "Time Trial", icon: "⏱️", blurb: "Just you, the clock and your best-lap ghost. Beat the target times." },
  elimination: { label: "Elimination", icon: "💥", blurb: "When the timer hits zero, last place is knocked out. Be the last car standing!" },
  duel: { label: "Boss Duel", icon: "👑", blurb: "One-on-one against the world boss in a faster car. Win by 2s+ for 3 stars." },
  drift: { label: "Drift Attack", icon: "🌀", blurb: "Single Drive: slide through the bends for points. Hold a slide for ×2…×5, link slides into chains — a wall hit breaks the chain!" },
  battle: { label: "Drift Battle", icon: "⚔️", blurb: "Tandem battle: chase the rival and out-drift them. Slide close behind for a ×1.5 TANDEM bonus." },
  heat: { label: "Heat Run", icon: "🚨", blurb: "Single Drive: weave through highway traffic for points. Near misses build a combo — but the longer you run, the more cops come after you!" },
  escape: { label: "Escape", icon: "🚔", blurb: "The cops are on your tail. Reach the finish line before they box you in — don't get BUSTED or WRECKED!" },
  takedown: { label: "Takedown", icon: "🚓", blurb: "You're the interceptor! Chase the speeding suspects through traffic and ram them until they're BUSTED." },
  wheelie: { label: "Wheelie Challenge", icon: "🏍️", blurb: "Single Drive: hold WHEELIE on the straights — the longer the wheelie, the bigger the multiplier (×4). Grab coins, dodge hazards, gates add time!" },
  rally: { label: "Rally Stage", icon: "🚩", blurb: "Against the clock on dirt, sand or snow. Your co-driver calls every bend: LEFT 3, HAIRPIN RIGHT…" },
};

const aiFor = (u: number): AiLevel => (u < 0.12 ? "easy" : u < 0.36 ? "normal" : u < 0.68 ? "hard" : "pro");

/** which events a racing game's career uses: Nitro Rush (circuit racing) or Drift Kings (drift & rally) */
export type CareerStyle = "race" | "drift" | "highway" | "moto";
const LOOSE = new Set(["dirt", "sand", "snow", "ice", "regolith"]);

export function buildCareer(themes: ThemeSpec[], style: CareerStyle = "race"): CareerLevel[] {
  if (style === "drift") return buildDriftCareer(themes);
  if (style === "highway") return buildHighwayCareer(themes);
  if (style === "moto") return buildMotoCareer(themes);
  const ordered = [...themes].sort((a, b) => a.order - b.order);
  const N = ordered.length;
  const out: CareerLevel[] = [];
  ordered.forEach((t, w) => {
    const u = N > 1 ? w / (N - 1) : 0;
    const ai = aiFor(u);
    const opp = Math.min(7, 3 + Math.round(u * 4.4));
    const laps = u < 0.3 ? 2 : 3;
    const diff = (k: number) => Math.min(1, +(0.04 + u * 0.88 + k).toFixed(3));
    const third: ModeId = w % 2 === 0 ? "elimination" : "timetrial";
    const events: Omit<CareerLevel, "id" | "index" | "world" | "event" | "themeId">[] = [
      { mode: "race", title: `${t.name} Grand Prix`, laps, opponents: opp, ai, variant: 0, reverse: false, rivalTier: 1, difficulty: diff(0) },
      { mode: "coinrush", title: `${t.name} Coin Rush`, laps: 99, opponents: 0, ai, variant: 1, reverse: false, timeLimit: Math.round(50 - u * 12), rivalTier: 1, difficulty: diff(0.03) },
      third === "elimination"
        ? { mode: "elimination", title: `${t.name} Knockout`, laps: 99, opponents: Math.max(4, Math.min(7, opp + 1)), ai, variant: 2, reverse: false, rivalTier: 1, difficulty: diff(0.04) }
        : { mode: "timetrial", title: `${t.name} Time Attack`, laps: u < 0.6 ? 2 : 3, opponents: 0, ai, variant: 2, reverse: true, rivalTier: 1, difficulty: diff(0.05) },
      { mode: "duel", title: `${t.name} Boss Duel`, laps: u < 0.5 ? 2 : 3, opponents: 1, ai, variant: 0, reverse: true, rivalTier: Math.min(5, 2 + Math.floor(u * 3.6)), difficulty: diff(0.06) },
    ];
    events.forEach((e, i) => out.push({ ...e, id: `${t.id}-${i + 1}`, index: out.length, world: w, event: i, themeId: t.id }));
  });
  return out;
}

/** Moto Rush GP: Qualifying → Wheelie Challenge → Grand Prix → Title Duel against the circuit's champion */
function buildMotoCareer(themes: ThemeSpec[]): CareerLevel[] {
  const ordered = [...themes].sort((a, b) => a.order - b.order);
  const N = ordered.length;
  const out: CareerLevel[] = [];
  ordered.forEach((t, w) => {
    const u = N > 1 ? w / (N - 1) : 0;
    const ai = aiFor(u);
    const opp = Math.min(7, 3 + Math.round(u * 4.4));
    const diff = (k: number) => Math.min(1, +(0.04 + u * 0.88 + k).toFixed(3));
    const events: Omit<CareerLevel, "id" | "index" | "world" | "event" | "themeId">[] = [
      { mode: "timetrial", title: `${t.name} Qualifying`, laps: 1, opponents: 0, ai, variant: 0, reverse: false, rivalTier: 1, difficulty: diff(0) },
      { mode: "wheelie", title: `${t.name} Wheelie Challenge`, laps: 99, opponents: 0, ai, variant: 1, reverse: false, timeLimit: Math.round(50 - u * 10), rivalTier: 1, difficulty: diff(0.03) },
      { mode: "race", title: `${t.name} Grand Prix`, laps: u < 0.3 ? 2 : 3, opponents: opp, ai, variant: 0, reverse: false, rivalTier: 1, difficulty: diff(0.04) },
      { mode: "duel", title: `${t.name} Title Duel`, laps: u < 0.5 ? 2 : 3, opponents: 1, ai, variant: 2, reverse: true, rivalTier: Math.min(5, 2 + Math.floor(u * 3.6)), difficulty: diff(0.06) },
    ];
    events.forEach((e, i) => out.push({ ...e, id: `${t.id}-${i + 1}`, index: out.length, world: w, event: i, themeId: t.id }));
  });
  return out;
}

/** Highway Heat: Heat Run → Highway Race → Escape → Takedown (you chase the world's boss suspect) */
function buildHighwayCareer(themes: ThemeSpec[]): CareerLevel[] {
  const ordered = [...themes].sort((a, b) => a.order - b.order);
  const N = ordered.length;
  const out: CareerLevel[] = [];
  ordered.forEach((t, w) => {
    const u = N > 1 ? w / (N - 1) : 0;
    const ai = aiFor(u);
    const opp = Math.min(7, 3 + Math.round(u * 4.4));
    const diff = (k: number) => Math.min(1, +(0.04 + u * 0.88 + k).toFixed(3));
    const events: Omit<CareerLevel, "id" | "index" | "world" | "event" | "themeId">[] = [
      { mode: "heat", title: `${t.name} Heat Run`, laps: 99, opponents: 0, ai, variant: 0, reverse: false, timeLimit: Math.round(55 - u * 12), rivalTier: 1, difficulty: diff(0) },
      { mode: "race", title: `${t.name} Highway Race`, laps: u < 0.3 ? 1 : 2, opponents: opp, ai, variant: 1, reverse: false, rivalTier: 1, difficulty: diff(0.03) },
      { mode: "escape", title: `${t.name} Escape`, laps: 1, opponents: 0, ai, variant: 2, reverse: false, rivalTier: 1, difficulty: diff(0.04) },
      { mode: "takedown", title: `${t.name} Takedown`, laps: 99, opponents: u < 0.4 ? 1 : 2, ai, variant: 0, reverse: true, timeLimit: Math.round(95 - u * 15), rivalTier: Math.min(5, 2 + Math.floor(u * 3.6)), difficulty: diff(0.06) },
    ];
    events.forEach((e, i) => out.push({ ...e, id: `${t.id}-${i + 1}`, index: out.length, world: w, event: i, themeId: t.id }));
  });
  return out;
}

/** Drift Kings: Drift Attack → Race (Rally Stage on loose-surface venues) → Coin Rush → Drift Battle vs the venue boss */
function buildDriftCareer(themes: ThemeSpec[]): CareerLevel[] {
  const ordered = [...themes].sort((a, b) => a.order - b.order);
  const N = ordered.length;
  const out: CareerLevel[] = [];
  ordered.forEach((t, w) => {
    const u = N > 1 ? w / (N - 1) : 0;
    const ai = aiFor(u);
    const opp = Math.min(7, 3 + Math.round(u * 4.4));
    const diff = (k: number) => Math.min(1, +(0.04 + u * 0.88 + k).toFixed(3));
    const road = ((t.look as { road?: { kind?: string } }).road?.kind) ?? "asphalt";
    const rally = LOOSE.has(road);
    const events: Omit<CareerLevel, "id" | "index" | "world" | "event" | "themeId">[] = [
      { mode: "drift", title: `${t.name} Drift Attack`, laps: u < 0.4 ? 1 : 2, opponents: 0, ai, variant: 0, reverse: false, rivalTier: 1, difficulty: diff(0) },
      rally
        ? { mode: "rally", title: `${t.name} Rally Stage`, laps: u < 0.5 ? 1 : 2, opponents: 0, ai, variant: 1, reverse: false, rivalTier: 1, difficulty: diff(0.03) }
        : { mode: "race", title: `${t.name} Grand Prix`, laps: u < 0.3 ? 2 : 3, opponents: opp, ai, variant: 1, reverse: false, rivalTier: 1, difficulty: diff(0.03) },
      { mode: "coinrush", title: `${t.name} Coin Rush`, laps: 99, opponents: 0, ai, variant: 2, reverse: true, timeLimit: Math.round(50 - u * 12), rivalTier: 1, difficulty: diff(0.04) },
      { mode: "battle", title: `${t.name} Drift Battle`, laps: u < 0.5 ? 1 : 2, opponents: 1, ai, variant: 0, reverse: true, rivalTier: Math.min(5, 2 + Math.floor(u * 3.6)), difficulty: diff(0.06) },
    ];
    events.forEach((e, i) => out.push({ ...e, id: `${t.id}-${i + 1}`, index: out.length, world: w, event: i, themeId: t.id }));
  });
  return out;
}

export function isUnlocked(levels: CareerLevel[], stars: Record<string, number>, i: number) {
  if (i === 0) return true;
  return (stars[levels[i - 1].id] ?? 0) > 0;
}

export function levelConfig(l: CareerLevel, base: Pick<RaceConfig, "carId" | "paint" | "upgrades">, rivalCar: string, game?: string): RaceConfig {
  return {
    game,
    mode: l.mode, themeId: l.themeId, variant: l.variant, reverse: l.reverse, laps: l.laps, opponents: l.opponents, ai: l.ai,
    weather: "auto", night: "auto", pickups: true, hazards: true, timeLimit: l.timeLimit, coinTarget: l.coinTarget,
    rivalCar, levelId: l.id, difficulty: l.difficulty, ...base,
  };
}

/** Mode blurb in the active game's words (bikes lean, they don't drift). */
export function modeBlurb(mode: ModeId): string {
  const b = MODE_INFO[mode].blurb;
  return activeGame().style === "bike" ? b.replace("Drift, draft", "Lean, draft").replace("drift", "lean") : b;
}
