// Slurp Lab Phase 3: the Endless Lab (stage 601 and on), the Daily Brain Jar and the weekly Lab Mutation. Every stage is
// made on the device by the same Plant-and-Prove generator (in a worker), from a recipe seeded by its number: a lab's
// look, 2–4 mechanics from all 30 labs, a tray shape, colours and twins. A fingerprint of the recipe is remembered so a
// stage never comes back; the difficulty keeps climbing slowly in waves of 10, up to a cap.
import { CAMPAIGN, LABS, MASKS, MIXABLE, mixMechs, type Lab } from "./campaign";
import { rng } from "./grader";
import { POOL_BIG, POOL_MID } from "./shapes";
import type { Recipe } from "./generator";

export const ENDLESS_FROM = CAMPAIGN + 1;
export const DAILY_BASE = 100000;
/** days since 2026-01-01 (UTC) */
export const dayNumber = (t = Date.now()) => Math.floor((t - Date.UTC(2026, 0, 1)) / 86400000);
export const weekNumber = (t = Date.now()) => Math.floor(dayNumber(t) / 7);
export const isDaily = (n: number) => n >= DAILY_BASE;

/** this week's Lab Mutation: one idea every Endless and Daily stage of the week gets */
export const MUTATIONS: { key: string; name: string; text: string }[] = [
  { key: "ice", name: "Ice Week", text: "Every tray has ice floors" },
  { key: "goo", name: "Goo Week", text: "Sticky goo everywhere" },
  { key: "arrow", name: "Wind Week", text: "One-way arrows on every tray" },
  { key: "fence", name: "Fence Week", text: "Glass fences split every tray" },
  { key: "crumble", name: "Bridge Week", text: "Glass bridges fall behind you" },
  { key: "bubble", name: "Soap Week", text: "Bubbled Gloopies on every tray" },
  { key: "rainbow", name: "Rainbow Week", text: "Rainbow Gloopies everywhere" },
  { key: "frost", name: "Frost Week", text: "Frosted Gloopies hide their colours" },
  { key: "portal", name: "Portal Week", text: "Portals on every tray" },
  { key: "crate", name: "Crate Week", text: "Crates to push on every tray" },
];
export const mutationOf = (week = weekNumber()) => MUTATIONS[((week % MUTATIONS.length) + MUTATIONS.length) % MUTATIONS.length];

/** the look of an Endless / Daily stage: one of the 30 labs */
export function labFor(n: number): Lab { return LABS[(isDaily(n) ? n * 7 : (n - ENDLESS_FROM) * 11 + 3) % LABS.length]; }

/** the recipe for Endless stage n (≥ 601) or a Daily stage (DAILY_BASE + day); `variant` skips a seen fingerprint */
export function endlessRecipe(n: number, variant = 0, week = weekNumber()): Recipe {
  const daily = isDaily(n);
  const r = rng(n * 92821 + variant * 7919 + 17);
  const k = daily ? 0 : n - ENDLESS_FROM;
  // waves of 10: each wave a little harder than the last, with an easier stage to open it; capped
  const wave = Math.floor(k / 10), inWave = k % 10;
  const level = daily ? 0.55 : Math.min(1, 0.72 + wave * 0.02) * (inWave === 0 ? 0.85 : 1);
  const pickFrom = <X>(a: X[]) => a[Math.floor(r() * a.length)];
  const keys = new Set<string>();
  const count = daily ? 2 : 2 + Math.floor(r() * 3);
  while (keys.size < count) keys.add(pickFrom(MIXABLE));
  keys.add(mutationOf(week).key);
  const colors = Math.min(8, Math.round(5 + level * 3 * r()));
  const slurpers = colors + Math.round(2 + level * 4 * r());
  return {
    n, lab: 0, s: 0, w: 8 + (r() < level ? 1 : 0), h: 10 + Math.round(level * 2 * r()),
    colors, slurpers, pool: r() < 0.5 ? POOL_MID : [...POOL_MID, ...POOL_BIG], mask: pickFrom(MASKS), walls: 1 + Math.floor(r() * 4),
    mech: mixMechs([...keys], level), needMax: 6 + Math.round(level * 2), fill: 0.75 + level * 0.1, perTrip: 3, fuseSlack: 2,
    tries: 2, pick: 0.8, budget: 1500,
  };
}
/** what makes two stages "the same": tray shape, mechanics, colours and Slurpers */
export function fingerprint(rc: Recipe): string { return `${rc.mask}|${Object.keys(rc.mech).sort().join("+")}|${rc.colors}|${rc.slurpers}|${rc.w}x${rc.h}`; }
