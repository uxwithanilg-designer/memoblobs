// The stage plan. Stages 1–600 walk through the twelve worlds, 50 races each: every race gets its own seed, course
// length, difficulty, three rivals (from a roster of twelve drivers, each with a favourite truck and colours), the
// finishing place it takes to move on (the podium for most of a world, the top two later and in grand prix races, a
// win at each world's final against that world's champion), a time of day and weather. After stage 600 the game never
// ends: remix races blend two worlds' looks, roads and rivals, mix times and weather, add twists (low gravity, a nitro
// rush, a rocket frenzy, coin showers, night runs, storms) and swing the difficulty in waves, so no stretch feels
// repeated.
import type { TruckId, TruckSpec } from "./trucks";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, type TimeOfDay, type Weather, type WorldId } from "./worlds";
import { clamp, makeRng, pick, type Rng } from "./util";

export type Twist = "lowgrav" | "nitro" | "rockets" | "coins" | "night" | "storm" | null;

export interface Rival {
  name: string;
  truck: TruckId;
  colors: TruckSpec["colors"];
  /** 0..1 */
  skill: number;
  /** the driver's look: fur / skin colour and a hat */
  face: string; hat: string;
}

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
  rivals: Rival[];
  /** finish in this place or better to move on */
  pass: number;
  cup: string;
  title: string;
  subtitle: string;
}

const C = (body: string, trim: string, accent: string, rim: string, glow: string): TruckSpec["colors"] => ({ body, trim, accent, rim, tire: "#1E1F26", glow });
/** the roster: every rival's name, truck, paint and look */
export const ROSTER: Omit<Rival, "skill">[] = [
  { name: "Rex Rumble", truck: "rhino", colors: C("#D8302A", "#1A1418", "#F2F2F2", "#C9CED8", "#FF7A6A"), face: "#8A5A3E", hat: "#1A1418" },
  { name: "Kiki Bolt", truck: "hornet", colors: C("#22C8E8", "#102030", "#FFE04A", "#F2F6FA", "#9AF6FF"), face: "#F2C9A0", hat: "#FFE04A" },
  { name: "Gus Grit", truck: "brawler", colors: C("#7A8A3A", "#22261A", "#E8C25A", "#C8C2A0", "#E8FF7A"), face: "#B08A60", hat: "#5A3A22" },
  { name: "Nova Vex", truck: "viper", colors: C("#B04AFF", "#1A1030", "#FF6AD8", "#E8C8FF", "#FF9AF0"), face: "#C8A0E8", hat: "#FF6AD8" },
  { name: "Babs Boulder", truck: "rhino", colors: C("#FF7AB0", "#3A1028", "#FFF0F6", "#FFD8EA", "#FFB8D8"), face: "#E8B8A0", hat: "#FFFFFF" },
  { name: "Tito Tank", truck: "titan", colors: C("#7A8090", "#1E2026", "#FFB23A", "#D8DCE6", "#FFD27A"), face: "#9A7A60", hat: "#3A3E4A" },
  { name: "Zara Zoom", truck: "viper", colors: C("#16B89A", "#082820", "#F8F8F8", "#BFF8EC", "#7AFFE0"), face: "#6A4632", hat: "#F8F8F8" },
  { name: "Moe Mudflap", truck: "brawler", colors: C("#8A5A36", "#2A1A10", "#FF8A3A", "#D8C0A0", "#FFB27A"), face: "#D8A878", hat: "#FF8A3A" },
  { name: "Lulu Lightning", truck: "hornet", colors: C("#F4F6FA", "#1A2A6A", "#3A7AFF", "#3A7AFF", "#9AC0FF"), face: "#F2D0B0", hat: "#3A7AFF" },
  { name: "Chomp", truck: "rhino", colors: C("#3EAE3A", "#102A10", "#FFE04A", "#E8F8D0", "#B8FF7A"), face: "#5EAE4A", hat: "#102A10" },
  { name: "Ivy Inferno", truck: "viper", colors: C("#FF4A1A", "#2A0A06", "#FFD23F", "#FFE0A0", "#FFB23A"), face: "#E8B090", hat: "#FFD23F" },
  { name: "Captain Crank", truck: "titan", colors: C("#22306A", "#0A1030", "#F2C14E", "#F2C14E", "#FFE08A"), face: "#C89A78", hat: "#F2C14E" },
];

const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", day: "Midday", golden: "Golden hour", dusk: "Dusk", night: "Night" };
const WEATHER_LABEL: Partial<Record<Weather, string>> = { rain: "Rain", snow: "Snowfall", fog: "Mist", dust: "Dust storm", leaves: "Falling leaves", petals: "Petal breeze", embers: "Embers", fireflies: "Fireflies", spores: "Glow spores", pollen: "Sugar dust", breeze: "Breezy", stars: "Starlight" };
const TWIST_LABEL: Record<Exclude<Twist, null>, string> = { lowgrav: "Low gravity", nitro: "Nitro rush", rockets: "Rocket frenzy", coins: "Coin shower", night: "Night race", storm: "Storm" };

export function worldIndexOf(n: number) { return Math.floor((n - 1) / STAGES_PER_WORLD) % WORLDS.length; }

/** three rivals for a race: the champion of the world at a finale, otherwise a rotating mix of the roster */
function pickRivals(r: Rng, d: number, wi: number, finale: boolean): Rival[] {
  const out: Rival[] = [];
  const used = new Set<number>();
  if (finale) { out.push({ ...ROSTER[wi % ROSTER.length], skill: clamp(d + 0.08, 0, 1) }); used.add(wi % ROSTER.length); }
  while (out.length < 3) {
    const i = Math.floor(r() * ROSTER.length);
    if (used.has(i)) continue;
    used.add(i);
    // a spread of strength: one quick rival, one steady, one slower
    const spread = [0.06, 0, -0.08][out.length];
    out.push({ ...ROSTER[i], skill: clamp(d + spread + (r() - 0.5) * 0.06, 0, 1) });
  }
  return out;
}

export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_STAGES) return remixPlan(n);
  const wi = worldIndexOf(n), w = WORLDS[wi];
  const local = ((n - 1) % STAGES_PER_WORLD) + 1;
  const r = makeRng(n * 7919 + 61);
  const big = local % 10 === 0, finale = local === STAGES_PER_WORLD;
  const within = (local - 1) / (STAGES_PER_WORLD - 1);
  const breather = local % 10 === 1 && local > 1 ? -0.06 : 0;
  // the very first races ease you in: gentler tracks and slower rivals while you learn the pedals, nitro and rockets
  const rookie = wi === 0 && local < 10 ? (10 - local) * 0.022 : 0;
  const difficulty = clamp(0.32 + 0.52 * within + 0.025 * wi + (big ? 0.05 : 0) + breather - rookie + (r() - 0.5) * 0.05, 0.12, 0.92);
  // races: about a kilometre at first, two and a half for a world's finale
  const length = Math.round((900 + 20 * local + 30 * wi + (big ? 400 : 0) + (finale ? 500 : 0) + r() * 200) / 10) * 10;
  const time = w.times[(local * 3 + Math.floor(r() * 2)) % w.times.length];
  let weather: Weather = pick(r, w.weathers);
  if (weather === "fireflies" && time !== "night" && time !== "dusk") weather = "clear";
  const rivals = pickRivals(r, difficulty, wi, finale);
  // the podium for most of a world, the top two over its last stretch and in its grand prix races, a win in the final
  const pass = finale ? 1 : difficulty < 0.64 && !big ? 3 : 2;
  const parts = [TIME_LABEL[time], WEATHER_LABEL[weather]].filter(Boolean);
  return {
    n, world: w.id, blend: null, blendAmt: 0, local, remix: 0, time, weather, seed: n * 104729 + 53, length, difficulty, big, finale, twist: null,
    rivals, pass, cup: w.cup,
    title: finale ? `${w.cup} final` : big ? `${w.name} grand prix` : w.name,
    subtitle: parts.join(" · ") || w.blurb,
  };
}

const TWISTS: Exclude<Twist, null>[] = ["lowgrav", "nitro", "rockets", "coins", "night", "storm"];
function twistOf(k: number): Twist {
  if (k < 1 || k % 3 === 1) return null;
  return TWISTS[Math.floor(makeRng(k * 7907 + 5)() * TWISTS.length)];
}

/** after stage 600: endless remixes */
function remixPlan(n: number): StagePlan {
  const k = n - DESIGNED_STAGES;
  const season = Math.floor((k - 1) / WORLDS.length);
  const order = WORLDS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 13);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const wi = order[(k - 1) % WORLDS.length], w = WORLDS[wi];
  const r = makeRng(n * 15485863 + 307);
  let partner = WORLDS[Math.floor(r() * WORLDS.length)];
  if (partner.id === w.id) partner = WORLDS[(wi + 5) % WORLDS.length];
  const blendAmt = 0.25 + r() * 0.2;
  const times: TimeOfDay[] = [...new Set([...w.times, ...partner.times])];
  let time = pick(r, times);
  const weathers = [...new Set([...w.weathers, ...partner.weathers])].filter((x) => !(x === "fireflies" && time !== "night" && time !== "dusk"));
  let weather: Weather = pick(r, weathers.length ? weathers : (["clear"] as Weather[]));
  let twist = twistOf(k);
  if (twist && twist === twistOf(k - 1)) twist = TWISTS[(TWISTS.indexOf(twist) + 1) % TWISTS.length];
  if (twist === "night") time = "night";
  if (twist === "storm") weather = w.id === "polar" ? "snow" : w.id === "dunes" || w.id === "mars" ? "dust" : "rain";
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  const difficulty = clamp(0.72 + 0.14 * wave + (r() - 0.5) * 0.06, 0.55, 0.9);
  const big = k % 10 === 0;
  const length = Math.round((1300 + r() * 900 + (big ? 400 : 0)) / 10) * 10;
  const rivals = pickRivals(r, difficulty, wi, big);
  const parts = [TIME_LABEL[time], WEATHER_LABEL[weather], twist ? TWIST_LABEL[twist] : null].filter(Boolean);
  return {
    n, world: w.id, blend: partner.id, blendAmt, local: k, remix: k, time, weather, seed: n * 104729 + 991, length, difficulty, big, finale: false, twist,
    rivals, pass: big ? 1 : 2, cup: `${w.cup} remix`,
    title: `Remix ${k} · ${w.name.split(" ")[0]} × ${partner.name.split(" ")[0]}`,
    subtitle: parts.join(" · ") || w.blurb,
  };
}
