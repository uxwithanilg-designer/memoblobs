// The robot marble driver. It reads the stage's hints (where to steer, where to slow, where to jump, which moving
// platform to follow) a human reaction time ahead, dodges moving hazards it sees coming, and rolls the racing line in
// between. The same driver runs the rival marbles (with a skill, a favourite line and a little wobble) and the
// fairness robot that has to finish every stage cleanly before anybody plays it.
import { G, JUMP_V, type Sim } from "./sim";
import type { Input, Intent, Marble, Obj } from "./types";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const HAZ = new Set(["bumper", "block", "hammer", "sweeper", "laser", "spikes", "mine"]);

export class Driver {
  /** 0..1: how fast it dares to go and how well it holds its line */
  skill: number;
  /** seconds it looks ahead (a human sees ~0.45 s ahead at speed) */
  react: number;
  /** its favourite line across the road (−1 … 1 of the free width) */
  lane: number;
  /** robots for the fairness check never wobble */
  wobble: number;
  private noiseT = 0; private noise = 0;
  private rnd: () => number;
  constructor(skill: number, react: number, lane: number, wobble: number, seed: number) {
    this.skill = skill; this.react = react; this.lane = lane; this.wobble = wobble;
    let x = (seed * 2654435761) >>> 0 || 1;
    this.rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
  }

  /** the index of the first hint that starts after s */
  private first(intents: Intent[], s: number) { let lo = 0, hi = intents.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (intents[mid].s <= s) lo = mid + 1; else hi = mid; } return lo; }
  /** the hint covering distance s (the last one that starts at or before it) */
  private hint(intents: Intent[], s: number): Intent | null {
    let lo = 0, hi = intents.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (intents[mid].s <= s) lo = mid + 1; else hi = mid; }
    for (let i = lo - 1; i >= 0 && i >= lo - 6; i--) { const it = intents[i]; if (s <= it.until && it.u !== undefined) return it; }
    return null;
  }

  input(sim: Sim, m: Marble, dt: number): Input {
    const st = sim.st, tr = sim.tr;
    const v = Math.max(4, m.vs);
    const look = m.s + v * this.react + 2.5;
    const hw = tr.widthAt(look) / 2;
    const free = Math.max(0, hw - m.r - 0.35);
    // ---- where to be
    let target = clamp(this.lane * free * 0.6, -free, free);
    // pace: a beginner rival rolls at ~85 % of top speed, the best at ~97 %
    let speed = st.vmax * (0.78 + 0.2 * this.skill);
    const cur = this.hint(st.intents, m.s);
    const it = cur?.now ? cur : this.hint(st.intents, look) ?? cur;
    if (it) {
      if (it.u !== undefined) target = it.u;
      if (it.slow !== undefined) speed = Math.min(speed, st.vmax * it.slow);
    }
    // ride a moving platform: aim at where it is now (the hints just before here)
    const at = this.first(st.intents, look);
    for (let i = Math.max(0, at - 8); i < at; i++) {
      const x = st.intents[i];
      if (look > x.until || x.follow === undefined) continue;
      const o = sim.obj(x.follow);
      if (o) target = sim.ou(o);
    }
    // ---- dodge moving hazards that will be in the way when we get there
    sim.near(m.s, v * this.react + 30, 0, (o: Obj) => {
      if (!HAZ.has(o.k)) return;
      if (o.k === "laser" && o.look === "prism" && m.paint === (o.p ?? 0)) return;
      // where it will be when we get there (boulders roll along the road, blocks slide, doors lift)
      let os = sim.os(o), tta = (os - m.s) / v;
      if (o.mov?.ax === "s") { tta = (sim.os(o, sim.t + Math.max(0, tta)) - m.s) / v; os = sim.os(o, sim.t + Math.max(0, tta)); }
      if (os < m.s - 1.5 || tta > this.react + 0.8) return;
      // a still mine only matters in the very next row (the hints already thread the gaps further on)
      if (o.k === "mine" && !o.mov && tta > 0.42) return;
      if (o.blink && !sim.on(o, sim.t + tta) && !sim.on(o)) return;
      if (o.mov?.ax === "h" && sim.oh(o, sim.t + tta) > m.r * 2 + 0.2) return;
      const ou = sim.ou(o, sim.t + tta);
      const halfW = o.k === "bumper" ? (o.w ?? 0.8) : o.k === "sweeper" ? (o.p ?? 4) : o.k === "mine" ? (o.w ?? 0.5) : (o.w ?? 0.6);
      if (Math.abs(target - ou) < halfW + m.r + 0.45) {
        const left = ou - halfW - m.r - 0.6, right = ou + halfW + m.r + 0.6;
        const goL = left > -free ? Math.abs(left - m.u) : Infinity, goR = right < free ? Math.abs(right - m.u) : Infinity;
        if (goL < Infinity || goR < Infinity) target = goL <= goR ? left : right;
        else speed = Math.min(speed, st.vmax * 0.35);
      }
    });
    // ---- a little human wobble (rivals only)
    if (this.wobble > 0) {
      this.noiseT -= dt;
      if (this.noiseT <= 0) { this.noiseT = 0.4 + this.rnd() * 1.2; this.noise = (this.rnd() - 0.5) * 2 * this.wobble * (1 - this.skill); }
      target += this.noise;
    }
    target = clamp(target, -hw + m.r + 0.15, hw - m.r - 0.15);
    // ---- steer and roll
    const err = target - m.u;
    const steer = clamp(err * 1.3 - m.vu * 0.42, -1, 1);
    let push = m.vs < speed ? 1 : 0;
    let brake = m.vs > speed + 1.5 ? clamp((m.vs - speed) * 0.25, 0, 1) : 0;
    if (m.stun > 0) { push = 0.5; brake = 0; }
    // ---- jumps: take off at the hinted spot
    let jump = false;
    const at2 = this.first(st.intents, m.s + 1.5);
    for (let i = Math.max(0, at2 - 8); i < at2; i++) { const x = st.intents[i]; if (x.jump && m.s >= x.s - 0.9 && m.s <= x.s + 0.6 && !m.air) jump = true; }
    // ---- boost when full and the road ahead is calm
    const boost = m.meter >= 1 && !it?.slow;
    void G; void JUMP_V;
    return { steer, push, brake, jump, boost, power: !!m.held && this.rnd() < 0.02, trick: 0 };
  }
}
