// Tondu's climb, as pure TypeScript (the game, the bot sweep and the title screen all run this). Tondu moves along
// the vine by distance s at the stage's speed, on side +1 or -1; a flip swings him round the vine (the side changes
// halfway), cling slows him down (a grip meter), a leap carries him over a gap at a glowing mark. A hit costs his
// tail (it regrows after enough bugs); a hit without a tail, or a gap without a leap, is a fall.
import { leapLength, leapWindow } from "./stages";
import type { Gap, PickKind, Side, SimEvent, Stage, Zone } from "./types";

export interface SimOpts {
  /** how close a bug must be to snap it (m) */
  snapReach?: number;
  /** bugs it takes to grow the tail back */
  regrowBugs?: number;
  /** Sun Rush seconds */
  rushTime?: number;
  /** seconds of cling from a full grip */
  gripTime?: number;
  /** start with a Moss Shield */
  shield?: boolean;
  /** start at this s (a moss checkpoint) */
  startS?: number;
  /** start without a tail (a restart after losing it keeps it lost) */
  tail?: boolean;
}

export type Action = "flip" | "leap" | "clingOn" | "clingOff";
const BODY = 0.3, FLIP = 0.16;

export class Sim {
  st: Stage; o: Required<Omit<SimOpts, "startS" | "tail">>;
  t = 0; s = 0; s0 = 0; side: Side = 1;
  flip: { k: number; from: Side; to: Side; dur: number } | null = null;
  held = false; clinging = false; grip = 1;
  leap: { from: number; to: number; k: number; dur: number; gap: number; bounce: boolean } | null = null;
  tail = true; shield = false; inv = 0; rush = 0; sun = 0; magnet = 0; glide = 0;
  alive = true; done = false; why: "hit" | "gap" | "wither" | "chase" | "" = "";
  bugs = 0; gold = 0; combo = 0; best = 0; regrow = 0; egg = true; hits = 0;
  branch: 0 | Side = 0; private forkI = 0;
  chaseS = -1e9; tip = 1e9; witherS = -1e9; rivalS = 0; rivalWon: boolean | null = null; midDone = false;
  /** the current speed (m/s) */
  v = 0;
  arm: Float32Array; eaten: Uint8Array; picked: Uint8Array; smashed: Uint8Array;
  private hi = 0; private bi = 0; private gi = 0;
  ev: SimEvent[] = [];
  /** a LEAP pressed at a swinging root while it was red: grab it the moment it turns green (still inside the mark) */
  pendingLeap = -1;

  constructor(st: Stage, o: SimOpts = {}) {
    this.st = st;
    this.o = { snapReach: o.snapReach ?? 0.55, regrowBugs: o.regrowBugs ?? 15, rushTime: o.rushTime ?? 4, gripTime: o.gripTime ?? 3.2, shield: o.shield ?? false };
    this.arm = new Float32Array(st.haz.length).fill(-1);
    this.eaten = new Uint8Array(st.bugs.length); this.picked = new Uint8Array(st.picks.length); this.smashed = new Uint8Array(st.haz.length);
    this.s = this.s0 = o.startS ?? 0;
    this.shield = this.o.shield;
    if (o.tail === false) this.tail = false;
    if (st.chase) this.chaseS = this.s - st.chase.lag;
    if (st.grow) this.tip = this.s + st.grow.lead;
    if (st.wither) this.witherS = this.s - st.wither.lag;
    this.rivalS = this.s;
    // skip what's behind a checkpoint start
    while (this.bi < st.bugs.length && st.bugs[this.bi].s < this.s) { this.eaten[this.bi] = 1; this.bi++; }
    if (this.s > 0) { st.picks.forEach((p, i) => { if (p.s < this.s) this.picked[i] = 1; }); this.midDone = true; }
    this.v = st.def.speed;
  }

  clone(): Sim {
    const c = Object.create(Sim.prototype) as Sim;
    Object.assign(c, this);
    c.flip = this.flip && { ...this.flip }; c.leap = this.leap && { ...this.leap };
    c.arm = this.arm.slice(); c.eaten = this.eaten.slice(); c.picked = this.picked.slice(); c.smashed = this.smashed.slice();
    c.ev = [];
    return c;
  }

  private zoneAt(kind: Zone["kind"]): Zone | undefined {
    for (const z of this.st.zones) if (z.kind === kind && this.s >= z.s0 && this.s <= z.s1 && (z.side === 0 || z.side === this.side)) return z;
    return undefined;
  }
  /** the gap Tondu may leap now (inside its leap mark), or -1 */
  leapable(): number {
    const lw = leapWindow(this.st.def.speed);
    for (let i = this.gi; i < this.st.gaps.length; i++) {
      const g = this.st.gaps[i], w = g.kind === "swing" ? lw * 1.5 : lw;
      if (g.s0 - w - 0.05 > this.s) break;
      if (this.s >= g.s0 - w - 0.05 && this.s <= g.s0 + 0.05 && g.kind !== "flower") {
        if (g.kind === "swing" && !this.ropeGreen(g)) continue;
        return i;
      }
    }
    return -1;
  }
  ropeGreen(g: Gap, t = this.t) { const p = g.period ?? 1.6; return (((t + (g.phase ?? 0)) % p) + p) % p < (g.win ?? 0.45) * p; }

  press(a: Action) {
    if (!this.alive || this.done) return;
    if (a === "clingOn") { this.held = true; return; }
    if (a === "clingOff") { this.held = false; return; }
    if (this.leap) return;
    if (a === "flip") {
      const dur = FLIP * (this.zoneAt("rain") ? 1.5 : 1);
      if (this.flip) this.flip = { k: 1 - this.flip.k, from: this.flip.to, to: this.flip.from, dur };
      else this.flip = { k: 0, from: this.side, to: (-this.side) as Side, dur };
      this.ev.push({ t: "flip", side: this.flip.to });
      return;
    }
    const gi = this.leapable();
    if (gi < 0) {
      // a red root inside its mark: hold on and grab it when it turns green
      const lw = leapWindow(this.st.def.speed);
      const sw = this.st.gaps.findIndex((g) => g.kind === "swing" && this.s >= g.s0 - lw * 1.5 - 0.05 && this.s <= g.s0 + 0.05);
      if (sw >= 0) { this.pendingLeap = sw; return; }
      this.ev.push({ t: "hop" }); return;
    }
    this.startLeap(gi, false);
  }
  private startLeap(gi: number, bounce: boolean) {
    const g = this.st.gaps[gi], v = this.st.def.speed;
    const D = bounce ? g.s1 - this.s + 0.8 : leapLength(g, v);
    this.leap = { from: this.s, to: this.s + D, k: 0, dur: D / Math.max(3.6, v), gap: gi, bounce };
    this.flip = null;
    this.ev.push({ t: "leap", gap: gi });
  }

  private hit(why: "hit" | "chase") {
    if (this.rush > 0) return false;
    if (this.inv > 0) return false;
    this.hits++;
    this.egg = false;
    if (this.shield) { this.shield = false; this.inv = 1.0; this.ev.push({ t: "shield" }); return true; }
    if (this.tail) { this.tail = false; this.regrow = 0; this.inv = 1.4; this.combo = 0; this.ev.push({ t: "tail" }); return true; }
    this.fall(why);
    return true;
  }
  private fall(why: Sim["why"]) {
    if (!this.alive) return;
    this.alive = false; this.why = why;
    this.ev.push({ t: "fall", why: why || "hit" });
  }

  step(dt: number) {
    if (!this.alive || this.done) return;
    const st = this.st, def = st.def;
    this.t += dt;
    // timers
    if (this.inv > 0) this.inv -= dt;
    if (this.rush > 0) { this.rush -= dt; if (this.rush <= 0) this.ev.push({ t: "rushEnd" }); }
    if (this.magnet > 0) this.magnet -= dt;
    // cling + grip
    const was = this.clinging;
    this.clinging = this.held && this.grip > 0.02 && !this.leap;
    if (this.clinging) this.grip = Math.max(0, this.grip - dt / this.o.gripTime); else this.grip = Math.min(1, this.grip + dt / 1.1);
    if (was !== this.clinging) this.ev.push({ t: "cling", on: this.clinging });
    // speed
    let f = 1;
    if (this.leap) f = 1;
    else {
      if (this.clinging) f *= 0.3;
      for (const z of st.zones) if (z.f && this.s >= z.s0 && this.s <= z.s1 && (z.side === 0 || z.side === this.side)) f *= z.f;
      if (this.rush > 0) f *= 1.3;
    }
    this.v = def.speed * f;
    // flip
    if (this.flip) {
      this.flip.k += dt / this.flip.dur;
      this.side = this.flip.k < 0.5 ? this.flip.from : this.flip.to;
      if (this.flip.k >= 1) { this.side = this.flip.to; this.flip = null; }
    }
    // move
    if (this.leap) {
      const L = this.leap;
      L.k += dt / L.dur;
      this.s = L.from + (L.to - L.from) * Math.min(1, L.k);
      if (L.k >= 1) { this.leap = null; this.ev.push({ t: "land" }); }
    } else this.s += this.v * dt;

    // a buffered grab of a swinging root
    if (this.pendingLeap >= 0 && !this.leap) {
      const g = st.gaps[this.pendingLeap];
      if (this.s > g.s0 + 0.05) this.pendingLeap = -1;
      else if (this.ropeGreen(g)) { const gi = this.pendingLeap; this.pendingLeap = -1; this.startLeap(gi, false); }
    }
    // gaps
    while (this.gi < st.gaps.length && st.gaps[this.gi].s1 < this.s - 0.5) this.gi++;
    if (!this.leap) {
      for (let i = this.gi; i < st.gaps.length; i++) {
        const g = st.gaps[i];
        if (g.s0 > this.s) break;
        if (this.s >= g.s0 && this.s < g.s1) {
          if (g.kind === "flower" && this.side === g.side) { this.startLeap(i, true); break; }
          if (this.glide > 0) { this.glide--; this.startLeap(i, true); break; }
          this.fall("gap"); return;
        }
      }
    }
    // forks
    const fk = st.forks[this.forkI];
    if (fk) {
      if (this.branch === 0 && this.s >= fk.s0) { this.branch = this.side; this.ev.push({ t: "fork", br: this.side }); }
      if (this.s > fk.s1) { this.branch = 0; this.forkI++; }
    }
    // hazards
    while (this.hi < st.haz.length && st.haz[this.hi].s + st.haz[this.hi].len / 2 + 12 < this.s && st.haz[this.hi].v === undefined) this.hi++;
    for (let i = this.hi; i < st.haz.length; i++) {
      const h = st.haz[i];
      if (h.s - (h.trig ?? 0) - 50 > this.s) break;
      if (h.trig !== undefined && this.arm[i] < 0 && this.s >= h.s - h.trig) { this.arm[i] = this.t; this.ev.push({ t: "arm", i }); }
      let pos = h.s;
      if (h.v !== undefined && this.arm[i] >= 0) pos = h.s + h.v * (this.t - this.arm[i]);
      if (Math.abs(pos - this.s) > h.len / 2 + BODY) continue;
      if (this.leap || this.smashed[i]) continue;
      if (h.br && h.br !== this.branch) continue;
      if (!this.lethal(h, i)) continue;
      if (this.rush > 0) { this.smashed[i] = 1; this.ev.push({ t: "smash", i }); continue; }
      this.hit("hit");
      if (!this.alive) return;
    }
    // chase / grow / wither / rival
    if (st.chase && this.t > st.chase.after) {
      this.chaseS += st.chase.v * dt;
      if (this.chaseS >= this.s - 0.8) { this.ev.push({ t: "chase" }); this.chaseS = this.s - 10; this.hit("chase"); if (!this.alive) { this.why = "chase"; return; } }
    }
    if (st.grow) {
      this.tip = Math.min(st.path.len + 5, this.tip + st.grow.v * dt);
      if (this.s >= this.tip - 0.5 && this.tip < st.path.len) { this.ev.push({ t: "grow" }); this.s = this.tip - 2.5; this.hit("hit"); if (!this.alive) return; }
    }
    if (st.wither && this.t > st.wither.after) {
      this.witherS += st.wither.v * dt;
      if (this.witherS >= this.s - 0.3 && !this.leap) { this.fall("wither"); return; }
    }
    if (st.rival) this.rivalS += st.rival.v * dt;
    // bugs
    const reach = this.o.snapReach;
    while (this.bi < st.bugs.length && st.bugs[this.bi].s < this.s + reach) {
      const b = st.bugs[this.bi];
      if (this.eaten[this.bi]) { this.bi++; continue; }
      if (b.br && this.branch !== 0 && b.br !== this.branch) { this.eaten[this.bi] = 2; this.bi++; continue; }
      const sideOk = b.side === 0 || b.side === this.side || this.magnet > 0;
      if (sideOk && !this.leap && Math.abs(b.s - this.s) <= reach) {
        this.eaten[this.bi] = 1;
        this.bugs++; if (b.kind < 0) this.gold++;
        this.combo++; this.best = Math.max(this.best, this.combo);
        if (!this.tail && ++this.regrow >= this.o.regrowBugs) { this.tail = true; this.ev.push({ t: "regrow" }); }
        this.ev.push({ t: "snap", i: this.bi, gold: b.kind < 0, combo: this.combo });
        this.bi++; continue;
      }
      if (b.s < this.s - reach) { this.eaten[this.bi] = 3; if (this.combo) this.ev.push({ t: "miss", i: this.bi }); this.combo = 0; this.bi++; continue; }
      break;
    }
    // pickups
    st.picks.forEach((p, i) => {
      if (this.picked[i] || Math.abs(p.s - this.s) > 0.6 || (p.br && p.br !== this.branch)) return;
      if (p.side !== this.side && this.magnet <= 0) return;
      this.picked[i] = 1;
      this.give(p.kind);
      this.ev.push({ t: "pick", i, kind: p.kind });
    });
    // sun
    if (this.zoneAt("sun")) { this.sun += dt * 0.55; if (this.sun >= 1) { this.sun = 0; this.give("sun"); } }
    // checkpoint and gate
    if (st.mid && !this.midDone && this.s >= st.mid) { this.midDone = true; this.ev.push({ t: "mid" }); }
    if (this.s >= st.path.len - 0.5) {
      this.done = true;
      if (st.rival) { this.rivalWon = this.rivalS < st.path.len; this.ev.push({ t: "rival", won: this.rivalWon }); }
      this.ev.push({ t: "gate" });
    }
  }
  give(k: PickKind) {
    if (k === "sun") { this.rush = this.o.rushTime; this.ev.push({ t: "rush" }); }
    else if (k === "glide") this.glide++;
    else if (k === "magnet") this.magnet = 6;
    else this.shield = true;
  }
  /** is hazard i lethal now for Tondu's side? */
  lethal(h: Stage["haz"][number], i: number, t = this.t, side: Side = this.side): boolean {
    let hs = h.side as number;
    if (h.alt && h.period) { const ph = (((t + (h.phase ?? 0)) % h.period) + h.period) % h.period / h.period; hs = ph < 0.5 ? h.side : -h.side; }
    if (h.mirror) hs = -hs;
    if (hs !== 0 && hs !== side) return false;
    if (h.period && !h.alt) { const ph = (((t + (h.phase ?? 0)) % h.period) + h.period) % h.period; if (ph >= (h.on ?? 0.5) * h.period) return false; }
    if (h.delay !== undefined) { const a = this.arm[i]; if (a < 0) return false; const k = t - a; if (k < h.delay || k > h.delay + (h.dur ?? 1)) return false; }
    return true;
  }
  /** the side angle for drawing: 0 = side +1, π = side -1, in between while flipping */
  angle(): number {
    if (this.flip) { const a0 = this.flip.from === 1 ? 0 : Math.PI, a1 = this.flip.to === 1 ? 0 : Math.PI; const k = Math.min(1, this.flip.k); return a0 + (a1 - a0) * (k * k * (3 - 2 * k)); }
    return this.side === 1 ? 0 : Math.PI;
  }
}
