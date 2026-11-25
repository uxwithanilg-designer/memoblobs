// The stage plan. Stages 1–600 walk through the twelve worlds, 50 stages each: every stage gets its own seed, length,
// difficulty, time of day and weather (a world's stages cycle through mornings, golden hours, dusks and nights).
// Every 10th stage is a longer "summit" stage, every 50th the world's finale. After stage 600 the game never ends:
// remix stages blend two worlds (look, props and terrain), mix times and weather, add twists (low gravity, a turbo
// rush, coin showers) and swing the difficulty, so no stretch feels like a repeat.
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, type TimeOfDay, type Weather, type WorldId } from "./worlds";
import { clamp, makeRng, pick } from "./util";

export type Twist = "lowgrav" | "turbo" | "coins" | "night" | "storm" | null;

export interface StagePlan {
  n: number;
  /** the world it's in, and (remix stages) the world blended into it */
  world: WorldId; blend: WorldId | null; blendAmt: number;
  /** 1..50 inside the world (remix: the remix number) */
  local: number;
  remix: number;
  time: TimeOfDay;
  weather: Weather;
  seed: number;
  length: number;
  difficulty: number;
  summit: boolean;
  finale: boolean;
  twist: Twist;
  title: string;
  subtitle: string;
}

const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", day: "Midday", golden: "Golden hour", dusk: "Dusk", night: "Night" };
const WEATHER_LABEL: Partial<Record<Weather, string>> = { rain: "Rain", snow: "Snowfall", fog: "Mist", sand: "Sandstorm", leaves: "Falling leaves", petals: "Petal breeze", embers: "Embers", fireflies: "Fireflies", spores: "Glow spores", meteors: "Meteor shower", breeze: "Breezy" };
const TWIST_LABEL: Record<Exclude<Twist, null>, string> = { lowgrav: "Low gravity", turbo: "Turbo rush", coins: "Coin shower", night: "Night drive", storm: "Storm" };

export function worldIndexOf(n: number) { return Math.floor((n - 1) / STAGES_PER_WORLD) % WORLDS.length; }

export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_STAGES) return remixPlan(n);
  const wi = worldIndexOf(n), w = WORLDS[wi];
  const local = ((n - 1) % STAGES_PER_WORLD) + 1;
  const r = makeRng(n * 7919 + 17);
  const summit = local % 10 === 0, finale = local === STAGES_PER_WORLD;
  // difficulty: ramps through the world and a little from world to world, with a breather after each summit
  const within = (local - 1) / (STAGES_PER_WORLD - 1);
  const breather = local % 10 === 1 && local > 1 ? -0.08 : 0;
  // stage 1 already asks for control (hills, kickers, a gap or two); the end of a world is the hardest driving there is
  const difficulty = clamp(0.4 + 0.52 * within + 0.02 * wi + (summit ? 0.06 : 0) + breather + (r() - 0.5) * 0.06, 0.38, 0.97);
  const length = Math.round((520 + 22 * local + 45 * wi + (summit ? 380 : 0) + (finale ? 400 : 0) + r() * 120) / 10) * 10;
  // times walk through the world's list so neighbours differ; weather follows the time
  const time = w.times[(local * 3 + Math.floor(r() * 2)) % w.times.length];
  let weather: Weather = pick(r, w.weathers);
  if (weather === "fireflies" && time !== "night" && time !== "dusk") weather = "clear";
  if (w.id === "frost" && time === "night" && r() < 0.5) weather = "clear"; // clear nights show the aurora
  const parts = [TIME_LABEL[time], WEATHER_LABEL[weather]].filter(Boolean);
  return {
    n, world: w.id, blend: null, blendAmt: 0, local, remix: 0, time, weather, seed: n * 104729 + 31, length, difficulty, summit, finale, twist: null,
    title: finale ? `${w.name} finale` : summit ? `${w.name} summit` : w.name,
    subtitle: w.enclosed ? (WEATHER_LABEL[weather] ?? w.blurb) : parts.join(" · "),
  };
}

/** after stage 600: endless remixes */
function remixPlan(n: number): StagePlan {
  const k = n - DESIGNED_STAGES; // 1, 2, 3…
  const season = Math.floor((k - 1) / WORLDS.length);
  // each "season" of twelve visits every world once, in a fresh order
  const order = WORLDS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 7);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const w = WORLDS[order[(k - 1) % WORLDS.length]];
  const r = makeRng(n * 15485863 + 101);
  let partner = WORLDS[Math.floor(r() * WORLDS.length)];
  if (partner.id === w.id) partner = WORLDS[(WORLDS.indexOf(w) + 5) % WORLDS.length];
  // enclosed worlds (cave, space) only blend with each other's colours lightly
  const blendAmt = w.enclosed || partner.enclosed ? 0.18 : 0.25 + r() * 0.2;
  const times: TimeOfDay[] = w.enclosed ? ["night"] : [...new Set([...w.times, ...partner.times])];
  let time = pick(r, times);
  const weathers = [...new Set([...w.weathers, ...partner.weathers])].filter((x) => !(x === "fireflies" && time !== "night" && time !== "dusk"));
  let weather = pick(r, weathers);
  // twists every few stages, never two in a row
  const twistRoll = r();
  let twist: Twist = k % 3 === 0 ? (twistRoll < 0.25 ? "lowgrav" : twistRoll < 0.5 ? "turbo" : twistRoll < 0.72 ? "coins" : twistRoll < 0.88 ? "night" : "storm") : null;
  if (twist === "night") { if (w.enclosed) twist = "coins"; else time = "night"; }
  if (twist === "storm") weather = w.id === "frost" ? "snow" : w.id === "dunes" || w.id === "canyon" ? "sand" : w.enclosed ? "spores" : "rain";
  // difficulty swings in waves (hard stretches, then easier ones) around a high level
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  const difficulty = clamp(0.7 + 0.2 * wave + (r() - 0.5) * 0.08, 0.5, 0.97);
  const summit = k % 10 === 0;
  const length = Math.round((900 + r() * 700 + (summit ? 500 : 0)) / 10) * 10;
  const parts = [w.enclosed ? null : TIME_LABEL[time], WEATHER_LABEL[weather], twist ? TWIST_LABEL[twist] : null].filter(Boolean);
  return {
    n, world: w.id, blend: partner.id, blendAmt, local: k, remix: k, time, weather, seed: n * 104729 + 977, length, difficulty, summit, finale: false, twist,
    title: `Remix ${k} · ${w.name.split(" ")[0]} × ${partner.name.split(" ")[0]}`,
    subtitle: parts.join(" · ") || w.blurb,
  };
}
