// Kiko's Jungle Quest missions: three at a time. Finish all three and the score multiplier goes up by one (×1 → ×30) and
// a new set arrives, a little bigger each level. Some count over many runs, some must be done in one run.
import type { SimResult } from "./types";

export interface Mission { kind: string; goal: number; have: number }
interface Def { text: (n: number) => string; base: number; one?: boolean; at?: number; get: (r: SimResult) => number }
export const MISSION_DEFS: Record<string, Def> = {
  bananas1: { text: (n) => `Collect ${n} bananas in one run`, base: 150, one: true, get: (r) => r.bananas },
  dist1: { text: (n) => `Run ${n.toLocaleString("en-US")} m in one run`, base: 1000, one: true, get: (r) => r.distance },
  score1: { text: (n) => `Score ${n.toLocaleString("en-US")} in one run`, base: 8000, one: true, get: (r) => r.score },
  places1: { text: (n) => `Visit ${n} places in one run`, base: 5, one: true, get: (r) => r.places },
  tricks1: { text: (n) => `Do ${n} tricks in one run`, base: 12, one: true, get: (r) => r.tricks },
  combo1: { text: (n) => `Get a ×${n} trick combo`, base: 3, one: true, get: (r) => r.bestCombo },
  fruits: { text: (n) => `Eat ${n} fruits`, base: 15, get: (r) => r.fruits },
  salads: { text: (n) => `Make ${n} Fruit Salads`, base: 2, at: 1, get: (r) => r.salads },
  vines: { text: (n) => `Swing on ${n} vines`, base: 4, get: (r) => r.vines },
  golden: { text: (n) => `Find ${n} Golden Bananas`, base: 4, get: (r) => r.golden },
  branches: { text: (n) => `Run on the branch road ${n} times`, base: 4, get: (r) => r.branches },
  bounces: { text: (n) => `Bounce on ${n} mushrooms`, base: 6, get: (r) => r.bounces },
  rushes: { text: (n) => `Do ${n} Smoothie Rushes`, base: 2, get: (r) => r.rushes },
  powers: { text: (n) => `Grab ${n} power-ups`, base: 6, get: (r) => r.powers },
  boosts: { text: (n) => `Ride ${n} pepper rockets`, base: 2, at: 2, get: (r) => r.boosts },
  rafts: { text: (n) => `Ride ${n} rafts`, base: 2, at: 3, get: (r) => r.rafts },
  crocHops: { text: (n) => `Hop on ${n} crocodiles`, base: 3, at: 4, get: (r) => r.crocHops },
  seeds: { text: (n) => `Win ${n} Golden Seed${n > 1 ? "s" : ""}`, base: 1, at: 3, get: (r) => r.seeds },
  distTotal: { text: (n) => `Run ${n.toLocaleString("en-US")} m in total`, base: 4000, get: (r) => r.distance },
  rides: { text: (n) => `Ride ${n} animal friends`, base: 2, at: 2, get: (r) => r.rides },
  ziplines: { text: (n) => `Zip down ${n} ziplines`, base: 2, at: 3, get: (r) => r.ziplines },
  bosses: { text: (n) => `Beat ${n} boss${n > 1 ? "es" : ""}`, base: 1, at: 4, get: (r) => r.bosses },
};
const nice = (v: number) => (v >= 1000 ? Math.round(v / 100) * 100 : v >= 100 ? Math.round(v / 10) * 10 : Math.max(1, Math.round(v)));
export const missionText = (m: Mission) => MISSION_DEFS[m.kind]?.text(m.goal) ?? m.kind;

/** a new set of three for this multiplier level */
export function newMissions(level: number, seed = Date.now()): Mission[] {
  let s = seed % 2147483647 || 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const kinds = Object.keys(MISSION_DEFS).filter((k) => (MISSION_DEFS[k].at ?? 0) <= level);
  const out: Mission[] = [];
  while (out.length < 3 && kinds.length) {
    const k = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0];
    const d = MISSION_DEFS[k], grow = d.one ? 1 + 0.22 * (level - 1) : 1 + 0.35 * (level - 1);
    out.push({ kind: k, goal: nice(d.base * grow), have: 0 });
  }
  return out;
}
/** add a run; returns the missions finished by it */
export function applyRun(ms: Mission[], r: SimResult): Mission[] {
  const done: Mission[] = [];
  for (const m of ms) {
    const d = MISSION_DEFS[m.kind];
    if (!d || m.have >= m.goal) continue;
    const v = d.get(r);
    m.have = d.one ? Math.max(m.have, v) : m.have + v;
    if (m.have >= m.goal) { m.have = m.goal; done.push(m); }
  }
  return done;
}
