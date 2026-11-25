// The stage plan. Stages 1–600 walk through the twelve worlds, 50 stages each. A stage is a long obstacle course (18 to 48 gizmos):
// a ride (picked from the world's garage), a sky mood, a difficulty, and a list of contraptions. Each world brings in
// its own contraptions one at a time over its first stages ("New gizmo!"), then mixes them with the classics (hills,
// bumps, kickers, drops, steps); every 10th stage is a longer "big course" and the 50th the world's finale. After
// stage 600 the game never ends: remix stages pair two worlds — one world's look with a layer of the other's scenery
// and sky life, every gizmo in the game (loops more often), the rides of both — with twists (low gravity, turbo
// starts, coin showers, night drives) and a high difficulty that swings in waves, so no stretch feels like a repeat. Everything comes from the stage number, so every player gets the same stage.
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, type ModuleKind, type WorldDef, type WorldId } from "./worlds";
import type { VehicleId } from "./vehicles";
import { clamp, makeRng, weighted, type Rng } from "./util";

export type Twist = "lowgrav" | "turbo" | "coins" | "night" | null;

export interface StagePlan {
  n: number;
  world: WorldId;
  /** remix stages: the second world whose gizmos and rides join in */
  blend: WorldId | null;
  /** 1..50 inside the world (remix: the remix number) */
  local: number;
  remix: number;
  mood: number;
  seed: number;
  difficulty: number;
  modules: ModuleKind[];
  vehicle: VehicleId;
  summit: boolean;
  finale: boolean;
  twist: Twist;
  /** a contraption this stage brings in for the first time */
  fresh: ModuleKind | null;
  title: string;
  subtitle: string;
}

/** the classics every world mixes in */
const BASIC: ModuleKind[] = ["hills", "bumps", "kicker", "drop", "steps"];
const ALL_MODULES: ModuleKind[] = [
  "hills", "bumps", "kicker", "steps", "drop", "tower", "seesaw", "collapse", "lift", "slider", "conveyor", "spring", "gate", "drawbridge",
  "wrecker", "pistons", "balls", "loop", "tunnel", "halfpipe", "crates", "fans", "tilt", "gear", "ice", "hops", "trapdoor", "rollers",
];
/** contraptions some rides can't take on (too slow, too tall or too heavy) */
const NOT_FOR: Partial<Record<ModuleKind, VehicleId[]>> = {
  loop: ["bus", "tractor", "pickup", "monster"],
  tower: ["bus"],
  halfpipe: ["bus"],
  balls: ["bus"],
  spring: ["bus"],
  fans: ["bus"],
  gear: ["bus", "buggy"],
  rollers: ["bus"],
};
export const GIZMO_NAME: Record<ModuleKind, string> = {
  hills: "Rolling hills", bumps: "Bumps", kicker: "Jump ramp", steps: "Steps", drop: "Big drop", tower: "Steep tower",
  seesaw: "Seesaw", collapse: "Crumbling bridge", lift: "Lift", slider: "Moving platform", conveyor: "Conveyor belt",
  spring: "Launch pad", gate: "Button gate", drawbridge: "Drawbridge", wrecker: "Wrecking ball", pistons: "Crushers",
  balls: "Roller balls", loop: "Loop", tunnel: "Low tunnel", halfpipe: "Half-pipe", crates: "Crate wall", fans: "Fans",
  tilt: "Wobbly bridge", gear: "Giant gears", ice: "Ice slide",
  hops: "Jump chain", trapdoor: "Trapdoor bridge", rollers: "Spinning rollers",
};
const TWIST_LABEL: Record<Exclude<Twist, null>, string> = { lowgrav: "Low gravity", turbo: "Turbo start", coins: "Coin shower", night: "Night drive" };

export function worldIndexOf(n: number) { return Math.floor((n - 1) / STAGES_PER_WORLD) % WORLDS.length; }

/** the world's own contraptions, in the order they're introduced */
const signature = (w: WorldDef) => w.pool.map(([k]) => k).filter((k) => !BASIC.includes(k));

function pickModules(r: Rng, pool: [ModuleKind, number][], count: number, vehicle: VehicleId, must: ModuleKind | null): ModuleKind[] {
  const ok = pool.filter(([k]) => !(NOT_FOR[k] ?? []).includes(vehicle));
  const out: ModuleKind[] = [];
  if (must && !(NOT_FOR[must] ?? []).includes(vehicle)) out.push(must);
  // long courses: a gizmo may come back, but never twice in a row and never the same pair twice running
  const maxPer = Math.max(2, Math.ceil(count / Math.max(1, ok.length)) + 1);
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    const k = weighted(r, ok);
    const n = out.length;
    if (n && out[n - 1] === k) continue;
    if (n >= 3 && out[n - 2] === k && out[n - 3] === out[n - 1]) continue;
    if (out.filter((x) => x === k).length >= maxPer) continue;
    out.push(k);
  }
  // a fresh gizmo shows up early (second), then again later in the course
  if (must && out[0] === must && out.length > 2) { out.shift(); out.splice(1, 0, must); }
  if (must && out.length >= 8 && out.filter((x) => x === must).length < 2) out.splice(Math.floor(out.length * 0.6), 0, must);
  return out;
}

export function stagePlan(n: number): StagePlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_STAGES) return remixPlan(n);
  const wi = worldIndexOf(n), w = WORLDS[wi];
  const local = ((n - 1) % STAGES_PER_WORLD) + 1;
  const r = makeRng(n * 7919 + 211);
  const summit = local % 10 === 0, finale = local === STAGES_PER_WORLD;
  const within = (local - 1) / (STAGES_PER_WORLD - 1);
  const breather = local % 10 === 1 && local > 1 ? -0.07 : 0;
  const difficulty = clamp(0.47 + 0.5 * within + 0.03 * wi + (summit ? 0.05 : 0) + breather + (r() - 0.5) * 0.06, 0.42, 1);
  // the world's gizmos arrive one by one (every second stage), then they all mix
  const sig = signature(w);
  // (the first world starts with three lessons in the basics)
  const k0 = Math.max(0, local - 1 - (wi === 0 ? 3 : 0));
  const known = wi === 0 && local <= 3 ? 0 : Math.min(sig.length, 1 + Math.floor(k0 / 2));
  const fresh = known > 0 && k0 % 2 === 0 && known <= sig.length ? sig[known - 1] : null;
  const allowed = new Set<ModuleKind>([...BASIC, ...sig.slice(0, known)]);
  // the very first stages of the game teach the basics
  let vehicle = weighted(r, w.vehicles);
  if (n <= 3) vehicle = "jeep";
  const pool: [ModuleKind, number][] = [
    ...w.pool.filter(([k]) => allowed.has(k)),
    ...BASIC.filter((k) => !w.pool.some(([q]) => q === k)).map((k) => [k, 0.55] as [ModuleKind, number]),
  ];
  // long courses: 18 gizmos at the start of a world, up to 48 on its finale
  const count = clamp(6 * (3 + Math.floor(local / 12) + (summit ? 1 : 0) + (finale ? 1 : 0)), 18, 48);
  let modules = pickModules(r, pool, count, vehicle, fresh);
  if (n === 1) modules = ["hills", "kicker", "bumps", "steps", "hills", "drop", "kicker", "bumps", "kicker", "steps", "hills", "kicker", "drop", "bumps", "steps", "kicker", "hills", "drop"];
  else if (n === 2) modules = ["bumps", "drop", "kicker", "hills", "steps", "kicker", "drop", "bumps", "hills", "kicker", "steps", "drop", "kicker", "bumps", "hills", "steps", "kicker", "drop", "bumps", "kicker"];
  else if (n === 3) modules = ["hills", "steps", "kicker", "drop", "bumps", "kicker", "hills", "drop", "steps", "kicker", "bumps", "drop", "hills", "kicker", "steps", "bumps", "drop", "kicker", "hills", "steps", "kicker", "bumps", "drop", "kicker"];
  const mood = n <= 3 ? 0 : (local * 2 + Math.floor(r() * 3)) % w.moods.length;
  return {
    n, world: w.id, blend: null, local, remix: 0, mood, seed: n * 104729 + 31, difficulty, modules, vehicle, summit, finale, twist: null,
    fresh: n === 1 ? null : fresh,
    title: finale ? `${w.name} finale` : summit ? `${w.name} · big course` : w.name,
    subtitle: w.moods[mood].name,
  };
}

/** after stage 600: endless remixes */
function remixPlan(n: number): StagePlan {
  const k = n - DESIGNED_STAGES;
  const season = Math.floor((k - 1) / WORLDS.length);
  // each "season" of twelve visits every world once, in a fresh order
  const order = WORLDS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 7);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const w = WORLDS[order[(k - 1) % WORLDS.length]];
  const r = makeRng(n * 15485863 + 101);
  let partner = WORLDS[Math.floor(r() * WORLDS.length)];
  if (partner.id === w.id) partner = WORLDS[(WORLDS.indexOf(w) + 5) % WORLDS.length];
  // every gizmo in the game can turn up; the two worlds' favourites (and loops) more often
  const merged = new Map<ModuleKind, number>();
  for (const m of ALL_MODULES) merged.set(m, 0.35);
  for (const [m, wt] of [...w.pool, ...partner.pool]) merged.set(m, (merged.get(m) ?? 0) + wt);
  merged.set("loop", (merged.get("loop") ?? 0) + 1.2);
  // the ride: one of the two worlds' (and now and then any ride at all)
  const vehicles = [...w.vehicles, ...partner.vehicles.map(([v, wt]) => [v, wt * 0.7] as [VehicleId, number])];
  const ANY: VehicleId[] = ["jeep", "pickup", "monster", "bus", "tractor", "buggy", "rod", "moonbug"];
  const vehicle = r() < 0.12 ? ANY[Math.floor(r() * ANY.length)] : weighted(r, vehicles);
  const twistRoll = r();
  let twist: Twist = k % 2 === 0 ? (twistRoll < 0.3 ? "lowgrav" : twistRoll < 0.55 ? "turbo" : twistRoll < 0.8 ? "coins" : "night") : null;
  // (worlds that are already floaty don't get lighter still)
  if (twist === "lowgrav" && w.gravity < 9) twist = "turbo";
  // difficulty swings in waves around a high level
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  const difficulty = clamp(0.88 + 0.1 * wave + (r() - 0.5) * 0.06, 0.76, 1);
  const summit = k % 10 === 0;
  const count = clamp(6 * (4 + Math.floor(r() * 4) + (summit ? 1 : 0)), 24, 48);
  const modules = pickModules(r, [...merged.entries()], count, vehicle, null);
  let mood = Math.floor(r() * w.moods.length);
  if (twist === "night") mood = w.moods.reduce((best, m, i) => (m.night > w.moods[best].night ? i : best), 0);
  const parts = [w.moods[mood].name, twist ? TWIST_LABEL[twist] : null].filter(Boolean);
  return {
    n, world: w.id, blend: partner.id, local: k, remix: k, mood, seed: n * 104729 + 977, difficulty, modules, vehicle, summit, finale: false, twist,
    fresh: null,
    title: `Remix ${k} · ${w.name.split(" ")[0]} × ${partner.name.split(" ")[0]}`,
    subtitle: parts.join(" · "),
  };
}

