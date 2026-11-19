// The ghost runner: plays a stage with human limits before anyone sees it. It only reacts to a hazard once it is within
// the stage's reaction distance, steers no faster than Rollo can, and times jumps the way a player would. A stage is
// accepted only if the bot reaches the goal without a single hit.
import { air, JUMP_V, reactAt, setValidator } from "./gen";
import { Sim, type Input } from "./sim";
import { Track } from "./track";
import type { Intent, Stage } from "./types";

export interface BotResult { ok: boolean; at: number; why: string; time: number }

export function botRun(st: Stage, know: string[], tr = new Track(st.segs)): BotResult {
  const sim = new Sim(st, tr, know, true);
  const r = sim.r;
  r.v = st.run; // the run carries straight in from the stage before
  const L = st.run * reactAt(st.d);
  const its = st.intents;
  let ut = 0, why = "";
  let doubleArmed = false;
  const done = new Set<Intent>();
  const dt = 1 / 60;
  const limit = (st.goal / Math.max(6, st.run * 0.5)) + 30;
  while (!r.done && r.time < limit) {
    const inp: Input = { ut, jump: false, curl: false, burst: false, trick: false };
    for (const it of its) {
      if (done.has(it)) continue;
      if (it.s - r.s > L + 40) break;
      if (it.act === "steer") {
        const start = Math.max(it.s, (it.at ?? (it.until ?? it.s) - 1) - L);
        if (r.s >= start && r.s <= (it.until ?? it.s)) { ut = it.u ?? 0; }
        if (r.s > (it.until ?? it.s)) done.add(it);
        continue;
      }
      const gap = tr.segAt(it.s + 1.5).gap;
      const dist = it.s - r.s;
      if (it.act === "jump" || it.act === "double") {
        const lead = gap ? 1.1 : it.act === "double" ? r.v * 0.62 : Math.max(1.5, r.v * air(JUMP_V) * 0.42);
        if (dist <= lead && !r.air) { inp.jump = true; done.add(it); doubleArmed = it.act === "double"; }
        continue;
      }
      if (it.act === "curl") {
        if (r.s >= it.s && r.s <= (it.until ?? it.s)) { if (!r.ball || r.slide < 0.25) inp.curl = true; }
        if (r.s > (it.until ?? it.s)) done.add(it);
        continue;
      }
      if (it.act === "burst" && r.s >= it.s) { inp.burst = true; done.add(it); }
      // a tap (Star Hop, tail whip, air dash), a ground pound in the air, easing off between two points
      if (it.act === "tap" && r.s >= it.s) { inp.burst = true; done.add(it); }
      if (it.act === "pound" && r.s >= it.s) { if (r.air) { inp.curl = true; done.add(it); } }
      if (it.act === "brake") { if (r.s >= it.s && r.s <= (it.until ?? it.s)) inp.brake = true; if (r.s > (it.until ?? it.s)) done.add(it); }
    }
    if (doubleArmed && r.air && r.vh <= 0.5 && r.jumps === 1) { inp.jump = true; doubleArmed = false; }
    // caught in a web: wiggle free
    if (r.wiggle > 0) inp.jump = true;
    sim.step(dt, inp);
    if (r.fell) { why = r.hits ? "hit" : "fell"; break; }
  }
  return { ok: r.done && !r.fell && r.hits === 0, at: r.s, why: why || (r.done ? "" : "timeout"), time: r.time };
}

/** the builder asks the bot before accepting a stage (boss arenas are checked without the boss) */
export function installValidator(knowOf: (st: Stage) => string[]) {
  setValidator((st) => botRun(st, knowOf(st)));
}
