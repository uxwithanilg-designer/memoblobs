// Momo Dash! missions: three at a time. Finish all three and the score multiplier goes up by one (×1 → ×30) and a new
// set arrives, a little bigger each level. Some count over many runs, some must be done in one run.
import type { SimResult } from "./types";

export interface Mission { kind: string; goal: number; have: number }
interface Def { text: (n: number) => string; base: number; one?: boolean; at?: number; get: (r: SimResult) => number }
export const MISSION_DEFS: Record<string, Def> = {
  coins1: { text: (n) => `Collect ${n} coins in one run`, base: 120, one: true, get: (r) => r.coins },
  dist1: { text: (n) => `Run ${n} m in one run`, base: 800, one: true, get: (r) => r.distance },
  score1: { text: (n) => `Score ${n.toLocaleString("en-US")} in one run`, base: 6000, one: true, get: (r) => r.score },
  tricks1: { text: (n) => `Do ${n} tricks in one run`, base: 10, one: true, get: (r) => r.tricks },
  combo1: { text: (n) => `Get a ×${n} trick combo`, base: 3, one: true, get: (r) => r.bestCombo },
  jumpOvers: { text: (n) => `Jump over ${n} karts`, base: 12, get: (r) => r.jumpOvers },
  bonks: { text: (n) => `Bonk ${n} Grumpies`, base: 6, get: (r) => r.bonks },
  melodies: { text: (n) => `Finish ${n} coin melodies`, base: 6, get: (r) => r.melodies },
  powers: { text: (n) => `Grab ${n} power-ups`, base: 8, get: (r) => r.powers },
  friends: { text: (n) => `Get ${n} friends in your conga`, base: 4, get: (r) => r.friends },
  roofs: { text: (n) => `Run on ${n} roofs or rails`, base: 5, at: 1, get: (r) => r.roofs },
  caught: { text: (n) => `Catch ${n} villains`, base: 2, at: 2, get: (r) => r.caught },
  boosts: { text: (n) => `Ride ${n} boosters`, base: 2, at: 2, get: (r) => r.boosts },
  morphs: { text: (n) => `Morph ${n} times`, base: 3, at: 4, get: (r) => r.morphs },
  portals: { text: (n) => `Go through ${n} portals`, base: 2, at: 5, get: (r) => r.portals },
  worlds: { text: (n) => `Reach ${n} new worlds`, base: 2, at: 2, get: (r) => r.worlds },
  distTotal: { text: (n) => `Run ${n.toLocaleString("en-US")} m in total`, base: 3000, get: (r) => r.distance },
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
