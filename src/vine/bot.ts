// A climbing bot with a human's reaction time: it looks ahead by simulating a copy of the climb, picks the first plan
// that survives (do nothing, flip, cling, flip + cling, leap…), and its presses land `delay` seconds later. The sweep
// uses it to prove every stage can be cleared (and stays tough); the title screen uses it to climb by itself.
import type { Action, Sim } from "./sim";
import { leapWindow } from "./stages";
import type { Rng } from "./path";

export interface Skill { delay: number; jitter: number }
export const SKILLS: Record<string, Skill> = { good: { delay: 0.18, jitter: 0.04 }, avg: { delay: 0.25, jitter: 0.06 }, slow: { delay: 0.4, jitter: 0.08 } };

interface Plan { name: string; acts: { dt: number; a: Action }[] }
const GDT = 1 / 60;

export class Bot {
  private queue: { at: number; a: Action }[] = [];
  private stayQueue: { at: number; a: Action }[] = [];
  private nextThink = 0;
  private skill: Skill; private r: Rng; private horizon: number;
  constructor(skill: Skill, r: Rng, horizon = 1.9) { this.skill = skill; this.r = r; this.horizon = horizon; }

  /** call before each sim.step: presses whatever is due, then thinks */
  tick(sim: Sim) {
    while (this.queue.length && this.queue[0].at <= sim.t) sim.press(this.queue.shift()!.a);
    if (sim.t < this.nextThink || !sim.alive || sim.done) return;
    this.nextThink = sim.t + 0.07;
    // presses already on their way (a human can't take them back) stay; later ones can be replaced by a new plan
    const committed = this.queue.filter((q) => q.at <= sim.t + this.skill.delay * 0.6);
    const keepAll = this.queue;
    this.queue = committed; this.stayQueue = keepAll;
    const plans = this.plans(sim);
    let best: Plan | null = null, bestScore = -1;
    const j = this.skill.jitter;
    for (const p of plans) {
      // robust: the plan must work whether the press lands a little early or a little late
      const score = Math.min(this.score(sim, p, -j), this.score(sim, p, 0), this.score(sim, p, j));
      if (score >= 1e6) { best = p; break; }
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best && best.name === "stay") { this.queue = keepAll; return; }
    if (best) {
      const lag = this.skill.delay + (this.r() - 0.5) * 2 * this.skill.jitter;
      for (const a of best.acts) this.queue.push({ at: sim.t + Math.max(0.03, lag) + a.dt, a: a.a });
      this.queue.sort((a, b) => a.at - b.at);
    }
  }

  private plans(sim: Sim): Plan[] {
    const hold = sim.held;
    // "stay" = keep doing what's already planned
    // while clinging, try letting go first (grip is precious); otherwise keep the current plan.
    // Then flips (cheap), then clinging (it "survives" a short look-ahead just by being slow, so it comes last).
    const ps: Plan[] = hold ? [{ name: "none", acts: [{ dt: 0, a: "clingOff" }] }, { name: "stay", acts: [] }] : [{ name: "stay", acts: [] }, { name: "none", acts: [] }];
    const off: Plan["acts"] = hold ? [{ dt: 0.05, a: "clingOff" }] : [];
    ps.push({ name: "flip", acts: [{ dt: 0, a: "flip" }, ...off] });
    ps.push({ name: "flipLate", acts: [{ dt: 0.2, a: "flip" }, ...off] });
    ps.push({ name: "flipflip", acts: [{ dt: 0, a: "flip" }, { dt: 0.45, a: "flip" }, ...off] });
    // clinging only helps with timed things (buds, bees, drops, rolling burrs, roots, a growing vine)
    const v0 = sim.st.def.speed, near = (x: number) => x > sim.s - 1 && x < sim.s + v0 * 2.6 + 3;
    const needCling = !!sim.st.grow || sim.st.haz.some((h) => (h.period !== undefined || h.trig !== undefined || h.v !== undefined) && near(h.s)) || sim.st.gaps.some((g) => g.kind === "swing" && near(g.s0));
    if (!needCling) return this.leapPlans(sim, ps, hold);
    if (hold) for (const l of [0.3, 0.6]) ps.push({ name: "regrip" + l, acts: [{ dt: 0, a: "clingOff" }, { dt: l, a: "clingOn" }] });
    else for (const l of [0.3, 0.6, 0.9]) ps.push({ name: "clingLate" + l, acts: [{ dt: l, a: "clingOn" }] });
    for (const c of [0.35, 0.7, 1.1, 1.6]) ps.push({ name: "cling" + c, acts: [{ dt: 0, a: "clingOn" }, { dt: c, a: "clingOff" }] });
    ps.push({ name: "clingHold", acts: [{ dt: 0, a: "clingOn" }] });
    ps.push({ name: "flipHold", acts: [{ dt: 0, a: "flip" }, { dt: 0, a: "clingOn" }] });
    for (const c of [0.4, 0.8]) ps.push({ name: "flipcling" + c, acts: [{ dt: 0, a: "flip" }, { dt: 0, a: "clingOn" }, { dt: c, a: "clingOff" }] });
    return this.leapPlans(sim, ps, hold);
  }

  private leapPlans(sim: Sim, ps: Plan[], hold: boolean): Plan[] {
    // leaps: aim inside the next gap's mark (several times, for swinging roots); near a gap these go first
    const g = sim.st.gaps.find((x) => x.s0 > sim.s - 0.1);
    if (g) {
      const lw = leapWindow(sim.st.def.speed) * (g.kind === "swing" ? 1.5 : 1), v = Math.max(0.5, sim.v);
      const to = (g.s0 - lw * 0.5 - sim.s) / v - this.skill.delay;
      const lp: Plan[] = [];
      if (to < 2.2) {
        for (const off of [0, -0.12, 0.12, -0.25, 0.25, 0.4]) lp.push({ name: "leap" + off, acts: [{ dt: Math.max(0, to + off * (lw / v)), a: "leap" }] });
        if (g.kind === "swing") {
          // press inside the mark and hold on: the grab waits for green
          const enter = Math.max(0, (g.s0 - lw * 0.85 - sim.s) / v - this.skill.delay);
          for (const hold of [0.6, 1.0, 1.5]) lp.push({ name: "grab" + hold, acts: [{ dt: enter, a: "clingOn" }, { dt: enter + 0.05, a: "leap" }, { dt: enter + hold, a: "clingOff" }] });
        }
      }
      if (g.kind === "flower") lp.push({ name: "flipFlower", acts: [{ dt: 0, a: "flip" }] });
      ps.splice(hold ? 2 : 2, 0, ...lp);
    }
    return ps;
  }

  /** survive the horizon → 1e6; else how long it lasted */
  private score(sim: Sim, p: Plan, off: number): number {
    const g = sim.clone();
    const base = p.name === "stay" ? this.stayQueue : this.queue;
    const q = [...base.map((x) => ({ at: x.at, a: x.a })), ...p.acts.map((a) => ({ at: sim.t + Math.max(0.03, this.skill.delay + off) + a.dt, a: a.a }))].sort((a, b) => a.at - b.at);
    const end = sim.t + this.horizon + this.skill.delay;
    let k = 0;
    while (g.t < end && g.alive && !g.done) {
      while (k < q.length && q[k].at <= g.t) g.press(q[k++].a);
      g.step(GDT);
      if (g.ev.some((e) => e.t === "tail" || e.t === "shield" || e.t === "fall")) return g.t - sim.t;
      g.ev.length = 0;
    }
    // holding at the end of the horizon is fine; dying is not
    return g.alive ? 1e6 : g.t - sim.t;
  }
}

/** run a whole stage with a bot: did it clear, how many hits */
export function botRun(sim: Sim, bot: Bot, maxT = 600) {
  const dt = 1 / 60;
  while (sim.alive && !sim.done && sim.t < maxT) { bot.tick(sim); sim.step(dt); sim.ev.length = 0; }
  return { clear: sim.done, hits: sim.hits, t: sim.t, why: sim.why, bugs: sim.bugs, s: sim.s, len: sim.st.path.len };
}
