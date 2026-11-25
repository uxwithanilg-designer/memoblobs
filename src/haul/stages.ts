// The stage plan. Stages 1–600 walk through the twelve worlds, 50 deliveries each: every stage gets its own seed,
// road length, difficulty, load size, the share of the load that must arrive, time of day and weather. Every 10th stage
// is a "big haul" (longer, a bigger load), every 50th the world's finale. After stage 600 the game never ends: remix
// stages blend two worlds (look, props, road and a mixed load), mix times and weather, add twists (low gravity, a nitro
// rush, coin showers, night runs, storms, heavy loads) and swing the difficulty in waves, so no stretch feels repeated.
import { CARGO, capacity, type CargoKind } from "./cargo";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, type TimeOfDay, type Weather, type WorldId } from "./worlds";
import { clamp, makeRng, pick } from "./util";

export type Twist = "lowgrav" | "nitro" | "coins" | "night" | "storm" | "heavy" | null;

export interface StagePlan {
  n: number;
  world: WorldId; blend: WorldId | null; blendAmt: number;
  local: number;
  remix: number;
  time: TimeOfDay;
  weather: Weather;
  seed: number;
  length: number;
  difficulty: number;
  big: boolean;
  finale: boolean;
  twist: Twist;
  /** the load: kinds (two on remixes), how many, and how many must arrive */
  cargo: CargoKind[];
  count: number;
  need: number;
  from: string; to: string;
  title: string;
  subtitle: string;
}

const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", day: "Midday", golden: "Golden hour", dusk: "Dusk", night: "Night" };
const WEATHER_LABEL: Partial<Record<Weather, string>> = { rain: "Rain", snow: "Snowfall", fog: "Mist", dust: "Dust wind", leaves: "Falling leaves", petals: "Petal breeze", embers: "Embers", fireflies: "Fireflies", spores: "Glow spores", pollen: "Pollen", breeze: "Breezy", stars: "Starlight" };
const TWIST_LABEL: Record<Exclude<Twist, null>, string> = { lowgrav: "Low gravity", nitro: "Nitro rush", coins: "Coin shower", night: "Night run", storm: "Storm", heavy: "Heavy load" };

/** the bed length every load is planned for (the starter truck's; bigger beds only make it roomier) */
export const PLAN_BED = 1.72;

export function worldIndexOf(n: number) { return Math.floor((n - 1) / STAGES_PER_WORLD) % WORLDS.length; }

function loadFor(kinds: CargoKind[], difficulty: number, big: boolean, r: () => number) {
  const cap = Math.min(...kinds.map((k) => capacity(k, PLAN_BED)), 8);
  // four pieces from the first stage (two rows: the top row rides above the side boards), logs three
  const lo = Math.min(cap, kinds[0] === "log" ? 3 : 4);
  const count = clamp(Math.round(lo + (cap - lo) * (difficulty - 0.3) * 1.5 + (big ? 1 : 0) + (r() - 0.5) * 0.8), lo, cap);
  // the share that must arrive: two thirds at first, four fifths on the hardest roads
  // (round loads — melons, eggs, orbs — roll, so a little less of them has to arrive)
  const balls = kinds.some((k) => CARGO[k].shape === "ball");
  const share = balls ? clamp(0.5 + 0.12 * (difficulty - 0.35) / 0.6, 0.5, 0.62) : clamp(0.62 + 0.12 * (difficulty - 0.35) / 0.6, 0.62, 0.74);
  // …but never the whole load: one piece may always be spared
  const need = clamp(Math.round(count * share), 1, Math.max(1, count - 1));
  return { count, need };
}

export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_STAGES) return remixPlan(n);
  const wi = worldIndexOf(n), w = WORLDS[wi];
  const local = ((n - 1) % STAGES_PER_WORLD) + 1;
  const r = makeRng(n * 7919 + 23);
  const big = local % 10 === 0, finale = local === STAGES_PER_WORLD;
  const within = (local - 1) / (STAGES_PER_WORLD - 1);
  const breather = local % 10 === 1 && local > 1 ? -0.07 : 0;
  // stage 1 already asks for care (bumps, a crest, a log or two); the end of a world is the roughest road there is
  const difficulty = clamp(0.36 + 0.5 * within + 0.025 * wi + (big ? 0.05 : 0) + breather + (r() - 0.5) * 0.06, 0.34, 0.9);
  // long roads: about 1.2 km on stage 1, over 3 km for a world's finale (checkpoints every ~330 m)
  const length = Math.min(3600, Math.round((3 * (380 + 9 * local + 22 * wi + (big ? 220 : 0) + (finale ? 260 : 0) + r() * 90)) / 10) * 10);
  const time = w.times[(local * 3 + Math.floor(r() * 2)) % w.times.length];
  let weather: Weather = pick(r, w.weathers);
  if (weather === "fireflies" && time !== "night" && time !== "dusk") weather = "clear";
  const { count, need } = loadFor([w.cargo], difficulty, big, r);
  const from = pick(r, w.from);
  const parts = [w.space ? null : TIME_LABEL[time], WEATHER_LABEL[weather]].filter(Boolean);
  return {
    n, world: w.id, blend: null, blendAmt: 0, local, remix: 0, time, weather, seed: n * 104729 + 41, length, difficulty, big, finale, twist: null,
    cargo: [w.cargo], count, need, from, to: w.depot,
    title: finale ? `${w.name} finale` : big ? `Big haul · ${w.name}` : w.name,
    subtitle: parts.join(" · ") || w.blurb,
  };
}

const TWISTS: Exclude<Twist, null>[] = ["lowgrav", "nitro", "coins", "night", "storm", "heavy"];
const TWIST_W = [0.2, 0.2, 0.18, 0.14, 0.14, 0.14];
function twistOf(k: number): Twist {
  if (k < 1 || k % 3 === 1) return null;
  let v = makeRng(k * 7907 + 3)();
  for (let i = 0; i < TWISTS.length; i++) { v -= TWIST_W[i]; if (v <= 0) return TWISTS[i]; }
  return "heavy";
}

/** after stage 600: endless remixes */
function remixPlan(n: number): StagePlan {
  const k = n - DESIGNED_STAGES;
  const season = Math.floor((k - 1) / WORLDS.length);
  // each "season" of twelve visits every world once, in a fresh order
  const order = WORLDS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 11);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const w = WORLDS[order[(k - 1) % WORLDS.length]];
  const r = makeRng(n * 15485863 + 211);
  let partner = WORLDS[Math.floor(r() * WORLDS.length)];
  if (partner.id === w.id) partner = WORLDS[(WORLDS.indexOf(w) + 5) % WORLDS.length];
  const blendAmt = w.space || partner.space ? 0.18 : 0.25 + r() * 0.2;
  const times: TimeOfDay[] = w.space ? ["night"] : [...new Set([...w.times, ...partner.times])];
  let time = pick(r, times);
  const weathers = [...new Set([...w.weathers, ...partner.weathers])].filter((x) => !(x === "fireflies" && time !== "night" && time !== "dusk") && !(x === "stars" && !w.space));
  let weather: Weather = pick(r, weathers.length ? weathers : (["clear"] as Weather[]));
  r();
  // two remixes in three carry a twist, never the same one twice in a row
  let twist = twistOf(k);
  if (twist && twist === twistOf(k - 1)) twist = TWISTS[(TWISTS.indexOf(twist) + 1) % TWISTS.length];
  if (twist === "night") { if (w.space) twist = "coins"; else time = "night"; }
  if (twist === "storm") weather = w.id === "frost" ? "snow" : w.id === "redrock" || w.id === "ember" ? "dust" : w.space ? "stars" : "rain";
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  // remixes stay tough: waves of hard stretches around the level of the last worlds
  const difficulty = clamp(0.74 + 0.14 * wave + (r() - 0.5) * 0.08, 0.58, 0.9);
  const big = k % 10 === 0;
  const length = Math.round((3 * (560 + r() * 380 + (big ? 260 : 0))) / 10) * 10;
  // a mixed load: the world's own and its partner's (logs travel alone: they fill the bed)
  // (balls and boxes don't stack on each other: a mixed load is two kinds of the same shape)
  // (and the moon keeps its own load: anything light floats out of the bed in low gravity)
  const mixable = w.cargo !== "log" && partner.cargo !== "log" && !w.space && !partner.space && CARGO[w.cargo].shape === CARGO[partner.cargo].shape;
  const cargo: CargoKind[] = mixable && r() < 0.6 ? [w.cargo, partner.cargo] : [w.cargo];
  const lf = loadFor(cargo, difficulty, big || twist === "heavy", r);
  const parts = [w.space ? null : TIME_LABEL[time], WEATHER_LABEL[weather], twist ? TWIST_LABEL[twist] : null].filter(Boolean);
  return {
    n, world: w.id, blend: partner.id, blendAmt, local: k, remix: k, time, weather, seed: n * 104729 + 983, length, difficulty, big, finale: false, twist,
    cargo, count: lf.count, need: lf.need, from: pick(r, partner.from), to: w.depot,
    title: `Remix ${k} · ${w.name.split(" ")[0]} × ${partner.name.split(" ")[0]}`,
    subtitle: parts.join(" · ") || w.blurb,
  };
}
