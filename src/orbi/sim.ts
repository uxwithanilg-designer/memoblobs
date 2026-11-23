// Orbi GP marble physics, in track space. Every marble rolls with momentum: pushing rolls it on (up to the stage's top
// speed), steering pushes it sideways, the road's slope speeds it up or slows it down, banks and tilting platforms pull
// it downhill, corners throw it outwards and crests make it light. Off the edge of the road (no curb, no platform) it
// falls; far enough down and it is put back at the last checkpoint. Hammers, sweepers, bumpers and blocks knock it about,
// pads launch it, zones change its grip, gravity or speed, and the player's marble picks things up and uses powers.
import { Track } from "./track";
import type { Ev, Input, Marble, Obj, PowerKind, Stage } from "./types";

export const G = 26;
export const R0 = 0.55;
export const JUMP_V = 9.5;
const ACCEL = 24, STEER = 36, GRIP = 6.5, ROLL = 0.5, BRAKE = 32;
/** the top speed anything reaches: 350 km/h */
export const VTOP = 350 / 3.6;
const FALL_H = -9;
const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const POWER_TIME: Record<PowerKind, number> = { turbo: 3, magnet: 9, shield: 30, jump: 0, giant: 6, feather: 8, bridge: 7, star: 5 };

const SURF = new Set(["plat", "tile", "seesaw", "log", "tilt", "disc"]);
const HAZ = new Set(["bumper", "block", "hammer", "sweeper", "laser", "spikes"]);
const PICK = new Set(["coin", "gem", "orb", "capsule", "star", "heart", "letter", "chest", "gold"]);
/** a chaser starts this far behind its mark and rolls on to the end of its run */
export const CHASE_BACK = 34;

export function newMarble(id: number, name: string, skin: number, s: number, u: number): Marble {
  return {
    id, name, skin, s, u, h: 0, vs: 0, vu: 0, vh: 0, air: false, on: -1, roll: 0, r: R0, stun: 0, ghost: 0,
    check: -1, falls: 0, fallT: 0, finished: false, finishT: 0, meter: 0, boostT: 0, held: null, active: {},
    coins: 0, gems: 0, stars: 0, airT: 0, style: 0, place: 1,
    hearts: 0, letters: 0, rings: 0, tricks: 0, combo: 0, used: 0, paint: 0, out: false, caught: false, cores: 0, near: 0, hyper: 0,
  };
}

interface Ground { h: number; on: number; lean: number; crown: number; push: number }

export class Sim {
  readonly st: Stage; readonly tr: Track;
  marbles: Marble[] = [];
  t = 0;
  /** objects sorted by s, and per-object live state */
  private objs: Obj[];
  /** tiles: time of the first touch; seesaws: [angle, angular speed]; pickups taken */
  private touched = new Map<number, number>();
  private seesaw = new Map<number, [number, number]>();
  taken = new Set<number>();
  /** the robot check: no randomness, no pickups */
  bot = false;
  private order = 0;

  private index = new Map<number, Obj>();
  /** switches: when each gate was last opened; chasers: when they set off; near misses and catches already counted */
  private gates = new Map<number, number>();
  private chase = new Map<number, number>();
  private once = new Set<string>();
  /** elimination: checkpoints already judged */
  private judged = 0;
  private chasers: Obj[];
  private saws: Obj[];
  constructor(st: Stage, tr: Track) {
    this.st = st; this.tr = tr;
    this.objs = st.objs.slice().sort((a, b) => a.s - b.s);
    for (const o of this.objs) this.index.set(o.id, o);
    this.chasers = this.objs.filter((o) => o.k === "chaser");
    this.saws = this.objs.filter((o) => o.k === "seesaw");
    this.wide = this.objs.filter((o) => o.k === "zone" && (o.ds ?? 0) > 40);
  }
  /** zones too long for the near search (weather, camera twists) */
  readonly wide: Obj[];
  /** the weather or camera twist at s (for the look) */
  zoneAt(s: number, z: "weather" | "view") { for (const o of this.wide) if (o.zone === z && Math.abs(s - o.s) <= (o.ds ?? 0)) return o; return null; }

  // ---------------------------------------------------------------- object motion
  /** a pendulum's angle (swing): the rope is 8 m long, amp is how far across it swings */
  swingA(o: Obj, t = this.t) { const m = o.mov!; return Math.asin(Math.min(0.95, m.amp / 8)) * Math.sin((t / m.period) * TAU + m.phase); }
  ou(o: Obj, t = this.t) {
    const m = o.mov; if (!m) return o.u;
    if (m.ax === "u") return o.u + m.amp * Math.sin((t / m.period) * TAU + m.phase);
    if (m.ax === "swing") return o.u + 8 * Math.sin(this.swingA(o, t));
    return o.u;
  }
  oh(o: Obj, t = this.t) {
    const m = o.mov; let h = o.h ?? 0;
    if (m && m.ax === "h") h += m.amp * (0.5 + 0.5 * Math.sin((t / m.period) * TAU + m.phase));
    else if (m && m.ax === "swing") h += 8 * (1 - Math.cos(this.swingA(o, t)));
    return h;
  }
  os(o: Obj, t = this.t) {
    if (o.k === "chaser") { const t0 = this.chase.get(o.id); return t0 === undefined ? o.s - CHASE_BACK : Math.min(o.s + (o.ds ?? 200), o.s - CHASE_BACK + (o.p ?? 14) * (t - t0)); }
    const m = o.mov; return m && m.ax === "s" ? o.s + m.amp * Math.sin((t / m.period) * TAU + m.phase) : o.s;
  }
  /** has this chaser set off (and is it still rolling)? */
  chasing(o: Obj) { const t0 = this.chase.get(o.id); return t0 !== undefined && this.os(o) < o.s + (o.ds ?? 200); }
  /** a switch bridge: is gate g open now? (it stays open 7 s after a marble rolls over its switch) */
  open(g: number) { const t0 = this.gates.get(g); return t0 !== undefined && this.t - t0 < 7; }
  /** a tilting plate's lean (radians): seesaws react to the marbles on them, tilt plates rock by themselves */
  lean(o: Obj) {
    if (o.k === "seesaw") return this.seesaw.get(o.id)?.[0] ?? 0;
    if (o.k === "tilt" && o.mov?.ax === "spin") return o.mov.amp * Math.sin((this.t / o.mov.period) * TAU + o.mov.phase);
    return 0;
  }
  /** the sweeper's arm angle */
  spin(o: Obj, t = this.t) { const m = o.mov; if (!m) return 0; return m.amp > 0 ? m.phase + m.amp * Math.sin((t / m.period) * TAU) : (t / m.period) * TAU + m.phase; }
  /** blinking hazards and beat tiles: on? */
  on(o: Obj, t = this.t) { if (!o.blink) return true; const [P, ph, duty] = o.blink; return (((t + ph) % P) + P) % P < P * (duty ?? 0.5); }
  /** tiles that have dropped (they grow back a few seconds later) */
  dropped(o: Obj) {
    const t0 = this.touched.get(o.id); if (t0 === undefined) return false;
    const k = this.t - t0 - (o.fall ?? 0.6);
    if (k > 3.5) { this.touched.delete(o.id); return false; }
    return k > 0;
  }
  /** how far a dropped tile has fallen (for the look) */
  dropOf(o: Obj) { const t0 = this.touched.get(o.id); if (t0 === undefined) return 0; const k = this.t - t0 - (o.fall ?? 0.6); return k > 0 ? 0.5 * G * k * k : 0; }
  shake(o: Obj) { const t0 = this.touched.get(o.id); return t0 === undefined ? 0 : Math.min(1, (this.t - t0) / (o.fall ?? 0.6)); }

  /** objects near s (binary search into the sorted list) */
  near(s: number, ahead: number, behind: number, f: (o: Obj) => void) {
    const a = this.objs; let lo = 0, hi = a.length;
    const s0 = s - behind - 45;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].s < s0) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < a.length && a[i].s <= s + ahead + 45; i++) f(a[i]);
  }

  // ---------------------------------------------------------------- the ground under a point
  ground(m: Marble, s: number, u: number): Ground | null {
    let best: Ground | null = null;
    const seg = this.tr.segAt(s), hw = this.tr.widthAt(s) / 2;
    const bridge = (m.active.bridge ?? 0) > 0;
    if ((seg.floor === "road" || bridge) && Math.abs(u) <= hw + m.r * 0.35) best = { h: 0, on: -1, lean: 0, crown: seg.crown ?? 0, push: 0 };
    this.near(s, 2, 2, (o) => {
      if (!SURF.has(o.k)) return;
      if (o.k === "tile" && this.dropped(o)) return;
      if (o.blink && !this.on(o)) return;
      if (o.gate !== undefined && !this.open(o.gate)) return;
      const ds = o.ds ?? 2, w = o.w ?? 2;
      if (o.k === "disc") { const R = w + m.r * 0.3; if ((s - o.s) ** 2 + (u - o.u) ** 2 > R * R) return; }
      if (Math.abs(s - this.os(o)) > ds) return;
      const cu = this.ou(o);
      if (Math.abs(u - cu) > w + m.r * 0.3) return;
      const ln = this.lean(o);
      const top = this.oh(o) - (u - cu) * Math.tan(ln);
      // only surfaces at or near the marble count (you can't snap up onto a high platform from far underneath)
      if (top > m.h + 1.0) return;
      if (!best || top > best.h) best = { h: top, on: o.id, lean: ln, crown: o.k === "log" ? 1.4 : 0, push: o.k === "log" ? (o.p ?? 0) : 0 };
    });
    return best;
  }

  // ---------------------------------------------------------------- one step
  step(dt: number, inputs: Input[]): Ev[] {
    let fast = false; for (const m of this.marbles) if (m.vs > 38) { fast = true; break; }
    if (!fast) return this.sub(dt, inputs);
    const ev = this.sub(dt / 2, inputs);
    for (const e of this.sub(dt / 2, inputs.map((i) => ({ ...i, jump: false, boost: false, power: false, trick: 0 })))) ev.push(e);
    return ev;
  }
  private sub(dt: number, inputs: Input[]): Ev[] {
    const ev: Ev[] = [];
    this.t += dt;
    this.seesaws(dt);
    for (let i = 0; i < this.marbles.length; i++) if (!this.marbles[i].out) this.move(this.marbles[i], inputs[i], dt, ev);
    this.bumps(ev);
    this.places();
    if (this.chasers.length) this.chasers.forEach((o) => this.chaser(o, ev));
    if (this.st.rules.elim) this.eliminate(ev);
    return ev;
  }

  /** a chaser (an avalanche, a boulder, a storm…) sets off when the first marble reaches its mark, and shoves along
   *  anybody it catches */
  private chaser(o: Obj, ev: Ev[]) {
    if (!this.chase.has(o.id)) { if (this.marbles.some((m) => m.s > o.s - 6)) this.chase.set(o.id, this.t); return; }
    if (!this.chasing(o)) return;
    const cs = this.os(o);
    for (const m of this.marbles) {
      if (m.fallT > 0 || m.finished || m.out || m.h > 5 || m.s > cs + 2.2 || m.s < cs - 8) continue;
      m.vs = Math.max(m.vs, (o.p ?? 14) + 5); m.stun = Math.max(m.stun, 0.35); m.s = cs + 2.3;
      const key = o.id + ":" + m.id;
      if (!this.once.has(key)) { this.once.add(key); m.caught = true; ev.push({ t: "caught", m: m.id }); }
    }
  }
  /** elimination: when the leader reaches each checkpoint, the last marble still racing is out */
  private eliminate(ev: Ev[]) {
    const lead = this.marbles.reduce((a, b) => (b.s > a.s ? b : a));
    while (this.judged < this.st.checks.length && lead.s >= this.st.checks[this.judged]) {
      this.judged++;
      const live = this.marbles.filter((m) => !m.out && !m.finished);
      if (live.length <= 2) continue;
      const last = live.reduce((a, b) => (b.s < a.s ? b : a));
      last.out = true; last.fallT = 0; ev.push({ t: "out", m: last.id });
    }
  }

  private seesaws(dt: number) {
    for (const o of this.saws) {
      const st = this.seesaw.get(o.id) ?? [0, 0];
      let torque = 0;
      for (const m of this.marbles) if (m.on === o.id && !m.air) torque += (m.u - this.ou(o)) * (m.active.giant ? 3 : 1);
      // a heavy plate: it tips toward the marble, and springs back level when nobody is on it
      st[1] += (torque * 0.9 - st[0] * 3.2 - st[1] * 2.2) * dt;
      st[0] = clamp(st[0] + st[1] * dt, -0.42, 0.42);
      this.seesaw.set(o.id, st);
    }
  }

  private move(m: Marble, inp: Input, dt: number, ev: Ev[]) {
    const st = this.st, tr = this.tr;
    if (m.finished && !this.bot) inp = { steer: -m.u * 0.2, push: 0.3, brake: m.vs > st.vmax * 0.5 ? 0.4 : 0, jump: false, boost: false, power: false, trick: 0 };
    // ---- falling out of the world: back to the last checkpoint after a moment
    if (m.fallT > 0) {
      m.fallT -= dt; m.vh -= G * dt; m.h += m.vh * dt; m.s += m.vs * dt * 0.6; m.u += m.vu * dt;
      if (m.fallT <= 0) this.respawn(m, ev);
      return;
    }
    for (const k of Object.keys(m.active) as PowerKind[]) { const v = (m.active[k] ?? 0) - dt; if (v <= 0) delete m.active[k]; else m.active[k] = v; }
    m.stun = Math.max(0, m.stun - dt); m.ghost = Math.max(0, m.ghost - dt); m.boostT = Math.max(0, m.boostT - dt); m.hyper = Math.max(0, m.hyper - dt);
    m.r = m.active.giant ? R0 * 1.9 : R0;
    // ---- zones underfoot
    let grip = 1, push = 1, roll = ROLL, gmul = m.active.feather ? 0.5 : 1, vmul = 1, wind = 0, lift = 0, belt = 0, lava = false, stick = -1, pull = 0;
    const player = m.id === 0 && !this.bot;
    const zone = (o: Obj) => {
      if (o.k !== "zone" || Math.abs(m.s - o.s) > (o.ds ?? 5) || Math.abs(m.u - this.ou(o)) > (o.w ?? 9)) return;
      switch (o.zone) {
        case "magnet": stick = o.p ?? 5; break;
        case "pull": { const du = m.u - o.u, w = o.w ?? 4; pull += -Math.sign(du) * (o.p ?? 10) * Math.max(0, 1 - Math.abs(du) / w); break; }
        case "slow": vmul *= 0.72; break;
        case "rumble": vmul *= 0.92; break;
        case "limit": if (m.vs > (o.p ?? 12)) { roll += 9; if (player && !this.once.has("lim" + o.id)) { this.once.add("lim" + o.id); ev.push({ t: "limit", m: m.id }); } } break;
        case "paint": if (m.paint !== (o.p ?? 0)) { m.paint = o.p ?? 0; if (player) ev.push({ t: "paint", m: m.id, c: m.paint }); } break;
        case "weather": if (o.look === "rain" || o.look === "snow") { grip *= 0.6; roll *= 0.7; } break;
        case "ice": grip *= 0.16; push *= 0.55; roll *= 0.3; break;
        case "sticky": roll += 7; vmul *= 0.55; break;
        case "sand": roll += 3.5; vmul *= 0.8; break;
        case "lowg": gmul *= 0.45; break;
        case "heavyg": gmul *= 1.6; break;
        case "wind": if (!m.active.giant) wind += (o.p ?? 6) * (o.mov ? Math.sin((this.t / o.mov.period) * TAU + o.mov.phase) : 1); break;
        case "vent": lift += o.p ?? 30; break;
        case "conveyor": belt += o.p ?? 6; break;
        case "speed": vmul *= 1.2; belt += 4; break;
        case "lava": lava = true; break;
      }
    };
    this.near(m.s, 1, 1, (o) => { if ((o.ds ?? 0) <= 40) zone(o); });
    for (const o of this.wide) zone(o);
    const boost = m.boostT > 0 || (m.active.turbo ?? 0) > 0 || (m.active.star ?? 0) > 0;
    // a rocket booster takes you up to 350 km/h; after it, you ease back down to cruising speed
    const vmax = m.hyper > 0 ? VTOP : Math.min(VTOP, st.vmax * vmul * (boost ? 1.5 : 1));
    // ---- use things
    if (inp.boost && m.meter >= 1 && !m.finished) { m.meter = 0; m.boostT = 2.6; ev.push({ t: "boost", m: m.id }); }
    if (inp.power && m.held && !m.finished) {
      const p = m.held; m.held = null; m.used++;
      if (p === "jump") { if (!m.air) { m.vh = JUMP_V * 1.75; m.air = true; } else m.vh = Math.max(m.vh, JUMP_V * 1.4); }
      else m.active[p] = POWER_TIME[p];
      ev.push({ t: "power", m: m.id, p });
    }
    const i = Math.max(0, Math.min(tr.n - 1, Math.floor(m.s)));
    // a magnet stretch holds you to the road (loops, wall rides, upside-down) as long as you keep rolling
    const held = stick >= 0 && m.vs > stick;
    const upY = held ? 1 : tr.upY[i];
    if (stick >= 0 && !held && !m.air && tr.upY[i] < 0.3) { m.air = true; m.vh = 0; m.airT = 0; }
    // ---- on the ground
    if (!m.air) {
      const g = this.ground(m, m.s, m.u);
      if (!g) { m.air = true; m.vh = Math.min(m.vh, 0); m.airT = 0; }
      else {
        m.on = g.on;
        const control = m.stun > 0 ? 0.15 : 1;
        // the push stays strong until close to top speed (it fades only over the last stretch)
        const vr = Math.max(0, m.vs) / vmax;
        let as = ACCEL * push * inp.push * control * (m.vs < vmax ? 1 - vr * vr * vr : 0) - inp.brake * BRAKE * Math.sign(m.vs);
        if (m.hyper > 0 && m.vs < VTOP) as += 70;
        // downhill rolls faster; uphill only slows you a little while you keep rolling (so climbs stay quick)
        const climb = tr.gAlong[i] < 0 && inp.push > 0.1 ? 0.33 : 1;
        as += tr.gAlong[i] * G * gmul * (held ? 0.35 : climb);
        as -= Math.sign(m.vs) * Math.min(Math.abs(m.vs) / dt, roll);      // rolling resistance
        as += belt;
        if (m.vs > vmax) as -= (m.vs - vmax) * 1.7;
        let au = STEER * push * inp.steer * control - GRIP * grip * m.vu;
        au += tr.gAcross[i] * G * gmul * (held ? 0.15 : 1);               // banked road
        au += pull;                                                       // a black hole drags you in
        au += -m.vs * m.vs * tr.bendSide[i];                             // corners throw you out
        au += Math.sin(g.lean) * G * gmul;                                // tilting plates pull you downhill
        au += g.crown * (m.u - (g.on >= 0 ? this.ou(this.byId(g.on)!) : 0)) * G * 0.9 * gmul; // beams and logs: off-centre rolls off
        au += g.push + wind;
        m.vs += as * dt; m.vu += au * dt;
        m.vs = Math.max(-6, m.vs);
        m.h = g.h; m.vh = 0;
        // a moving platform carries the marble with it (friction)
        if (g.on >= 0) {
          const o = this.byId(g.on)!, mv = o.mov;
          if (mv && (mv.ax === "u" || mv.ax === "swing")) m.u += this.ou(o, this.t + dt) - this.ou(o);
          // a spinning disc turns you round with it
          if (o.k === "disc") { const w = o.p ?? 1, dsv = m.s - o.s, du = m.u - o.u; m.s += -w * du * dt * 0.6; m.u += w * dsv * dt; }
        }
        // over a crest at speed the marble goes light and takes off
        // (above ~150 km/h the road's own grip keeps you down: crests only lift you so much)
        const vc = Math.min(m.vs, 42);
        if (!held && g.on < 0 && vc * vc * -tr.bendUp[i] > G * gmul * upY * 0.98 && m.vs > 8) { m.air = true; m.vh = 1.5; m.airT = 0; }
        if (inp.jump && m.stun <= 0) { m.air = true; m.vh = JUMP_V * (m.active.giant ? 0.85 : 1); m.airT = 0; ev.push({ t: "jump", m: m.id }); }
        if (lift > 0) { m.air = true; m.vh = Math.max(m.vh, 3); m.airT = 0; }
        if (lava && !m.ghost && !(m.active.star ?? 0)) { this.fall(m, ev); return; }
      }
    }
    // ---- in the air
    if (m.air) {
      m.airT += dt;
      const ctrl = 0.35;
      m.vu += (STEER * ctrl * inp.steer - m.vu * 0.4 + wind) * dt;
      m.vs += (ACCEL * 0.2 * inp.push * (m.vs < vmax ? 1 : 0) - (m.vs > vmax ? (m.vs - vmax) * 0.8 : 0)) * dt;
      m.vh += (lift - G * gmul * Math.max(0.2, upY)) * dt;
      if (lift > 0) m.vh = Math.min(m.vh, 9);
      if (inp.trick && m.airT > 0.2 && !m.finished) { m.combo++; m.style += 50 * m.combo; m.meter = Math.min(1, m.meter + 0.1 * m.combo); m.airT = -0.4; ev.push({ t: "trick", m: m.id, n: m.combo }); }
    }
    // ---- move
    if (m.vs > VTOP) m.vs = VTOP;
    m.s += m.vs * dt; m.u += m.vu * dt; if (m.air) m.h += m.vh * dt;
    m.roll += (m.vs * dt) / m.r;
    // ---- curbs
    const seg = tr.segAt(m.s), hw = tr.widthAt(m.s) / 2;
    if (m.h < 0.8 && m.h > -0.5) {
      if (seg.railR && m.u > hw - m.r && seg.floor === "road") { m.u = hw - m.r; if (m.vu > 0) { if (m.vu > 4) ev.push({ t: "rail", m: m.id, k: m.vu }); m.vu = -m.vu * 0.35; } }
      if (seg.railL && m.u < -hw + m.r && seg.floor === "road") { m.u = -hw + m.r; if (m.vu < 0) { if (m.vu < -4) ev.push({ t: "rail", m: m.id, k: -m.vu }); m.vu = -m.vu * 0.35; } }
    }
    // ---- landing
    if (m.air && m.vh <= 0) {
      const g = this.ground(m, m.s, m.u);
      if (g && m.h <= g.h + 0.05 && m.h > g.h - 1.2) {
        const vh = m.vh;
        m.h = g.h; m.air = false; m.on = g.on;
        const tramp = this.landOn(m, ev);
        if (!tramp) { m.vh = 0; if (vh < -6) ev.push({ t: "land", m: m.id, vh }); }
        if (m.airT > 0.6 && Math.abs(m.vu) < 3 && !m.finished) { m.style += Math.round(m.airT * 20); m.meter = Math.min(1, m.meter + Math.min(0.15, m.airT * 0.08)); }
        // tricks count once you land them
        if (m.combo > 0) { m.tricks += m.combo; m.combo = 0; }
      }
    }
    if (m.h < FALL_H) {
      // a shield catches you once: back on the road right here
      if ((m.active.shield ?? 0) > 0) { delete m.active.shield; this.putBack(m, m.s); ev.push({ t: "saved", m: m.id }); }
      else if (m.hearts > 0) { m.hearts--; m.combo = 0; this.putBack(m, m.s); ev.push({ t: "saved", m: m.id }); }
      else { m.combo = 0; this.fall(m, ev); return; }
    }
    // ---- touching things
    this.touch(m, ev);
    // ---- checkpoints and the finish
    while (m.check + 1 < st.checks.length && m.s >= st.checks[m.check + 1]) { m.check++; ev.push({ t: "check", m: m.id, i: m.check }); }
    if (!m.finished && m.s >= st.finish) { m.finished = true; m.finishT = this.t; m.place = ++this.order; ev.push({ t: "finish", m: m.id, place: m.place }); }
  }

  private byId(id: number) { return this.index.get(id); }
  /** an object by id */
  obj(id: number) { return this.index.get(id); }

  /** pads, trampolines and tiles act when you land on them */
  private landOn(m: Marble, ev: Ev[]) {
    let tramp = false;
    // tiles crumble under your marble (the rivals roll over them, or you would always find them gone)
    if (m.on >= 0 && (m.id === 0 || this.bot)) { const o = this.byId(m.on); if (o?.k === "tile" && !this.touched.has(o.id)) { this.touched.set(o.id, this.t); ev.push({ t: "tile", m: m.id, o }); } }
    this.near(m.s, 1, 1, (o) => {
      if (o.k !== "tramp" || Math.abs(m.s - o.s) > (o.ds ?? 1.5) || Math.abs(m.u - this.ou(o)) > (o.w ?? 1.5)) return;
      m.vh = o.p ?? 14; m.air = true; m.airT = 0; tramp = true; ev.push({ t: "tramp", m: m.id, o });
    });
    return tramp;
  }

  private touch(m: Marble, ev: Ev[]) {
    const player = m.id === 0 && !this.bot;
    const magnet = player && (m.active.magnet ?? 0) > 0;
    this.near(m.s, 3, 3, (o) => {
      const du = m.u - this.ou(o), dsv = m.s - this.os(o);
      // ---- pickups (yours only: rivals race, you collect)
      if (PICK.has(o.k)) {
        if (!player || this.taken.has(o.id)) return;
        const rad = magnet && o.k !== "star" ? 4.5 : (o.w ?? 0.8) + m.r;
        const dh = m.h - (o.h ?? 0.6);
        if (dsv * dsv + du * du > rad * rad || Math.abs(dh) > 1.8 + (magnet ? 2 : 0)) return;
        this.taken.add(o.id);
        if (o.k === "coin") { m.coins++; m.meter = Math.min(1, m.meter + 0.015); ev.push({ t: "coin", m: m.id, o }); }
        else if (o.k === "gem") { m.gems++; m.coins += 5; ev.push({ t: "gem", m: m.id, o }); }
        else if (o.k === "orb") { m.meter = Math.min(1, m.meter + 0.25); ev.push({ t: "orb", m: m.id, o }); }
        else if (o.k === "star") { m.stars++; ev.push({ t: "star", m: m.id, o }); }
        else if (o.k === "capsule") { const pool = this.st.powers; const p = pool[Math.floor(Math.random() * pool.length)] ?? "turbo"; if (!m.held) m.held = p; ev.push({ t: "capsule", m: m.id, o, p }); }
        else if (o.k === "heart") { m.hearts = Math.min(3, m.hearts + 1); ev.push({ t: "heart", m: m.id, o }); }
        else if (o.k === "letter") { m.letters |= 1 << (o.p ?? 0); if (m.letters === 15) m.coins += 40; ev.push({ t: "letter", m: m.id, o, n: o.p ?? 0 }); }
        else if (o.k === "chest") { m.coins += 30; m.gems++; ev.push({ t: "chest", m: m.id, o }); }
        else if (o.k === "gold") { m.coins += 25; ev.push({ t: "goldcoin", m: m.id, o }); }
        return;
      }
      // ---- rocket boosters: touch one and you blast up to 350 km/h (everybody)
      if (o.k === "rocket") {
        const R = (o.w ?? 0.9) + m.r, dh = m.h + m.r - (o.h ?? 0.9);
        if (dsv * dsv + du * du > R * R || Math.abs(dh) > 1.6) return;
        const key = "k" + o.id + ":" + m.id; if (this.once.has(key)) return; this.once.add(key);
        m.hyper = Math.max(m.hyper, o.p ?? 1.8); m.boostT = Math.max(m.boostT, (o.p ?? 1.8) + 0.6); m.vs = Math.max(m.vs, this.st.vmax * 1.25);
        ev.push({ t: "rocket", m: m.id, o });
        return;
      }
      // ---- don't-touch mines: a touch is a zap (back to the last checkpoint, like a fall)
      if (o.k === "mine") {
        if (m.ghost > 0 || (m.active.star ?? 0) > 0 || m.fallT > 0) return;
        const R = (o.w ?? 0.7) + m.r * 0.8, dh = m.h + m.r - (o.h ?? 0.7);
        if (dsv * dsv + du * du > R * R || Math.abs(dh) > (o.w ?? 0.7) + m.r) return;
        if ((m.active.shield ?? 0) > 0) { delete m.active.shield; m.ghost = 1; ev.push({ t: "saved", m: m.id }); return; }
        ev.push({ t: "zap", m: m.id, o });
        this.fall(m, ev); m.vh = 6;
        return;
      }
      // ---- rings in the air: fly through for a boost (everybody)
      if (o.k === "ring") {
        const R = o.w ?? 1.6, dh = m.h + m.r - (o.h ?? 4);
        if (Math.abs(dsv) > 0.9 || du * du + dh * dh > R * R) return;
        const key = "r" + o.id + ":" + m.id; if (this.once.has(key)) return; this.once.add(key);
        m.rings++; m.meter = Math.min(1, m.meter + 0.2); m.boostT = Math.max(m.boostT, 0.9); m.vs = Math.max(m.vs, this.st.vmax * 1.1);
        if (m.id === 0) ev.push({ t: "ring", m: m.id, o });
        return;
      }
      // ---- portals: in one, out the other (further down the road)
      if (o.k === "portal") {
        if (!(o.p && o.p > o.s) || Math.abs(dsv) > 0.8 || Math.abs(du) > (o.w ?? 1.6) || m.h > 3) return;
        m.s = o.p; m.ghost = Math.max(m.ghost, 0.5); ev.push({ t: "portal", m: m.id, o });
        return;
      }
      // ---- switches open the bridges ahead; cores are Kranky's weak spots
      if (o.k === "switch" || o.k === "core") {
        if ((m.air && m.h > 1) || Math.abs(dsv) > (o.ds ?? 1.2) || Math.abs(du) > (o.w ?? 1.2)) return;
        if (o.k === "switch") { const was = this.open(o.gate ?? 0); this.gates.set(o.gate ?? 0, this.t); if (!was) ev.push({ t: "switch", m: m.id, o }); }
        else if ((player || this.bot) && !this.taken.has(o.id)) { this.taken.add(o.id); m.cores++; ev.push({ t: "core", m: m.id, o, n: m.cores }); }
        return;
      }
      if (m.air && m.h > 1.2 && o.k !== "sweeper") { if (o.k === "pad" || o.k === "boost" || o.k === "tramp") return; }
      // ---- launchers
      if ((o.k === "pad" || o.k === "boost" || o.k === "tramp") && !m.air) {
        if (Math.abs(dsv) > (o.ds ?? 1.2) || Math.abs(du) > (o.w ?? 1.5)) return;
        if (o.k === "pad") { m.vh = o.p ?? 11; m.air = true; m.airT = 0; m.vs = Math.max(m.vs, this.st.vmax * 0.95); ev.push({ t: "pad", m: m.id, o }); }
        else if (o.k === "tramp") { m.vh = o.p ?? 13; m.air = true; m.airT = 0; ev.push({ t: "tramp", m: m.id, o }); }
        else { if (m.boostT < 0.8) ev.push({ t: "boost", m: m.id }); m.boostT = Math.max(m.boostT, 1.4); m.hyper = Math.max(m.hyper, 0.35); m.vs = Math.max(m.vs, this.st.vmax * 1.3); }
        return;
      }
      if (!HAZ.has(o.k) || m.ghost > 0 || (m.active.star ?? 0) > 0) return;
      if (!this.on(o)) return;
      if (o.k === "laser" && o.look === "prism" && m.paint === (o.p ?? 0)) return;
      const tall = o.tall ?? 1.5, bottom = o.mov?.ax === "h" ? this.oh(o) : 0;
      if (m.h > bottom + tall + 0.2 || m.h + m.r * 2 < bottom) return;
      // a near miss (yours): a whisker from a hazard fills the boost meter
      if (player && !m.air && o.k !== "sweeper") {
        const gapU = Math.abs(du) - (o.w ?? 0.7) - m.r;
        if (Math.abs(dsv) < 0.6 && gapU > 0 && gapU < 0.75 && !this.once.has("n" + o.id)) { this.once.add("n" + o.id); m.near++; m.meter = Math.min(1, m.meter + 0.08); ev.push({ t: "near", m: m.id, o }); }
      }
      if (o.k === "bumper") {
        const R = (o.w ?? 0.8) + m.r, d = Math.hypot(dsv, du);
        if (d >= R || d < 1e-4) return;
        const nx = dsv / d, nu = du / d;
        m.s = this.os(o) + nx * R; m.u = this.ou(o) + nu * R;
        const vn = m.vs * nx + m.vu * nu;
        if (vn < 0) { m.vs -= (1 + 1.1) * vn * nx; m.vu -= (1 + 1.1) * vn * nu; }
        m.vu += nu * (o.p ?? 6); m.vs += nx * (o.p ?? 6) * 0.5;
        ev.push({ t: "bump", m: m.id, o, k: Math.abs(vn) + 3 });
        return;
      }
      if (o.k === "sweeper") {
        // a rotating arm: a line segment from the hub; it shoves you along its turning direction
        const a = this.spin(o), L = o.p ?? 4, ca = Math.cos(a), sa = Math.sin(a);
        const t = clamp((dsv * ca + du * sa) / L, -1, 1);
        const qs = ca * L * t, qu = sa * L * t, ds2 = dsv - qs, du2 = du - qu, d = Math.hypot(ds2, du2), R = 0.35 + m.r;
        if (d >= R) return;
        const nx = ds2 / (d || 1), nu = du2 / (d || 1);
        m.s += nx * (R - d); m.u += nu * (R - d);
        const w = TAU / (o.mov?.period ?? 3), vt = w * L * t;
        m.vs += -sa * vt * 0.6 + nx * 2.5; m.vu += ca * vt * 0.6 + nu * 2.5;
        m.stun = 0.35;
        ev.push({ t: "bump", m: m.id, o, k: Math.abs(vt) + 3 });
        return;
      }
      // boxes: blocks, hammers, lasers, spikes
      const hx = (o.ds ?? 0.6) + m.r, hu = (o.w ?? 0.6) + m.r;
      if (Math.abs(dsv) >= hx || Math.abs(du) >= hu) return;
      if ((o.k === "laser" && o.look === "prism") || (o.k === "spikes" && o.look === "bolt")) {
        // the wrong colour: a slow, fizzing push through (never a wall)
        if (m.ghost <= 0) { m.vs *= 0.3; m.stun = 0.5; m.ghost = 0.8; ev.push({ t: "bump", m: m.id, o, k: 6 }); }
        return;
      }
      if (o.k === "laser" || o.k === "spikes") {
        // a zap: knocked back, a short stun (no harm done)
        m.vs = -Math.max(4, m.vs * 0.4); m.s = this.os(o) - hx - 0.05; m.stun = 0.5; m.ghost = 0.4;
        ev.push({ t: "bump", m: m.id, o, k: 8 });
        return;
      }
      const ps = hx - Math.abs(dsv), pu = hu - Math.abs(du);
      // the box's own sideways speed (hammers and sliding blocks shove you)
      const mv = o.mov && o.mov.ax === "u" ? o.mov.amp * (TAU / o.mov.period) * Math.cos((this.t / o.mov.period) * TAU + o.mov.phase) : 0;
      if (pu < ps) {
        m.u += Math.sign(du || 1) * pu;
        const k = (o.k === "hammer" ? (o.p ?? 12) : 4) * Math.sign(du || mv || 1);
        m.vu = clamp((Math.sign(mv) === Math.sign(du) ? mv * 1.3 : 0) + k, -12, 12);
        m.stun = o.k === "hammer" ? 0.45 : 0.2;
      } else {
        m.s += Math.sign(dsv || -1) * ps;
        if (m.vs > 0 && dsv < 0) m.vs = -m.vs * 0.3 - 1;
        m.vu += mv * 0.8;
      }
      ev.push({ t: "bump", m: m.id, o, k: Math.abs(m.vu) + 2 });
    });
  }

  /** marbles bump each other */
  private bumps(ev: Ev[]) {
    const ms = this.marbles;
    for (let a = 0; a < ms.length; a++) for (let b = a + 1; b < ms.length; b++) {
      const A = ms[a], B = ms[b];
      if (A.fallT > 0 || B.fallT > 0 || A.ghost > 0 || B.ghost > 0) continue;
      const ds = B.s - A.s, du = B.u - A.u, R = A.r + B.r;
      if (Math.abs(ds) > R || Math.abs(du) > R || Math.abs(B.h - A.h) > R) continue;
      const d = Math.hypot(ds, du); if (d >= R || d < 1e-4) continue;
      const nx = ds / d, nu = du / d, ma = A.r * A.r * A.r, mb = B.r * B.r * B.r;
      const push = (R - d) / (ma + mb);
      A.s -= nx * push * mb; A.u -= nu * push * mb; B.s += nx * push * ma; B.u += nu * push * ma;
      const vn = (B.vs - A.vs) * nx + (B.vu - A.vu) * nu;
      if (vn >= 0) continue;
      const j = (-(1 + 0.6) * vn) / (1 / ma + 1 / mb);
      A.vs -= (j / ma) * nx; A.vu -= (j / ma) * nu; B.vs += (j / mb) * nx; B.vu += (j / mb) * nu;
      if ((A.id === 0 || B.id === 0) && -vn > 2.5) ev.push({ t: "bump", m: A.id === 0 ? 0 : B.id, o: null, k: -vn });
    }
  }

  private places() {
    const order = this.marbles.slice().sort((a, b) => (a.out !== b.out ? (a.out ? 1 : -1) : a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.finishT - b.finishT : b.s - a.s));
    order.forEach((m, i) => { m.place = i + 1; });
  }

  fall(m: Marble, ev: Ev[]) {
    if (m.fallT > 0) return;
    m.falls++; m.fallT = this.bot ? 0.01 : 1.1; m.air = true;
    ev.push({ t: "fall", m: m.id });
  }
  private putBack(m: Marble, s: number) {
    // the nearest solid road at or before s (gaps are skipped back over)
    let at = s;
    for (let k = 0; k < 200 && at > 0; k++) { if (this.tr.segAt(at).floor === "road") break; at -= 2; }
    m.s = Math.max(1, at); m.u = 0; m.h = 0; m.vh = 0; m.vu = 0; m.vs = Math.max(4, this.st.vmax * 0.3);
    m.air = false; m.on = -1; m.ghost = 1.6; m.stun = 0;
  }
  respawn(m: Marble, ev: Ev[]) {
    const s = m.check >= 0 ? this.st.checks[m.check] + 2 : 3;
    this.putBack(m, s);
    // the tiles ahead are whole again
    if (m.id === 0) for (const [id] of this.touched) { const o = this.index.get(id); if (o && o.s > s - 5) this.touched.delete(id); }
    m.fallT = 0; m.boostT = 0; m.combo = 0;
    ev.push({ t: "respawn", m: m.id });
  }
}
