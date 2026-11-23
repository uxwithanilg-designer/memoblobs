// The fairness robot: one marble, the real physics, a human reaction time and no luck. A stage passes only if the
// robot rolls it start to finish without a single fall (and in a sensible time).
import { Driver } from "./ai";
import { newMarble, Sim } from "./sim";
import { Track } from "./track";
import type { Stage } from "./types";

const PICKUPS = new Set(["coin", "gem", "orb", "capsule", "star", "heart", "letter", "chest", "gold"]);
export function botRun(st0: Stage, tr = new Track(st0.segs), from = 0) {
  // the robot never picks anything up: it drives a copy of the stage without the pickups (much quicker)
  const st: Stage = { ...st0, objs: st0.objs.filter((o) => !PICKUPS.has(o.k)) };
  const sim = new Sim(st, tr);
  sim.bot = true;
  const m = newMarble(0, "bot", 0, from + 2, 0);
  if (from > 0) { m.vs = st.vmax * 0.6; m.check = st.checks.findIndex((c) => c >= from) - 1; }
  sim.marbles = [m];
  const drv = new Driver(0.9, 0.45, 0, 0, 1);
  const dt = 1 / 60, limit = (st.finish - from) / (st.vmax * 0.3) + 30, checkT: Record<number, number> = {};
  while (sim.t < limit) {
    const ev = sim.step(dt, [drv.input(sim, m, dt)]);
    for (const e of ev) {
      if (e.t === "fall") return { ok: false, at: m.s, time: sim.t, why: "fell", checkT };
      if (e.t === "check") checkT[e.i] = sim.t;
    }
    if (m.finished) return { ok: true, at: m.s, time: m.finishT, why: "", checkT };
  }
  return { ok: false, at: m.s, time: sim.t, why: "too slow", checkT };
}
