// A running Momo Sky Roll level: the simulation, renderer, music and spatial sound glued to one clock.
// The music's audio clock drives the beat (a smoothed local clock follows it), so obstacles always hit on the music.
// Input = relative drag anywhere (touch, mouse, pen) or ← → / A D; a quick tap (or ↑ / W) = jump when an ability allows.
import { audio } from "@/lib/audio";
import { CLAW_WARN, clawSlamNear } from "./hazards";
import { appendChunk } from "./levels";
import { RollMusic } from "./music";
import { RollRenderer, type Quality } from "./render";
import { RollSfx } from "./sfx";
import { Sim } from "./sim";
import { moodOf } from "./themes";
import { TK, type Level, type SimEvent } from "./types";

export type Phase = "ready" | "play" | "dying" | "respawn" | "countin" | "done" | "over";

export interface Hud {
  pct: number; beads: number; sprouts: number; deaths: number; zone: number; cp: number; phase: Phase; count: number;
  fever: boolean; abilities: string[]; extras: number; shield: boolean; streak: number;
  /** endless run */
  lives: number; meters: number; speed: number; boost: number; world: number; reviving: boolean;
}
export interface RunResult {
  level: number; kind: Level["kind"]; name: string; beads: number; beadsTotal: number; sprouts: number; sproutMask: number;
  deaths: number; seconds: number; extras: string[]; gold: number; concepts: string[]; fusion?: Level["fusion"];
  /** Endless: distance in rows; Journey: 1 */
  distance: number; completed: boolean; ghost?: string;
  /** endless run: the furthest world reached */
  world?: number;
}

/** endless run: booster multiplier, and the cap for rush × booster */
export const BOOST_K = 1.5;
export const RUN_MAX_SPEED = 2.2;
/** the normal pace: every mode (except Kid Mode) plays the song and rolls 15 % faster than its written tempo */
export const PACE = 1.15;

export interface SessionOptions {
  quality: Quality;
  kid: boolean;
  sensitivity: number;
  haptics: boolean;
  shake: boolean;
  reduced: boolean;
  renderScale: number;
  ch?: string;
  /** a previous best run to race (base64 of one signed byte per row, x × 16) */
  ghost?: string;
  /** title screen: the autopilot rolls through the level */
  attract?: boolean;
  /** start rolling by itself after a short count-in (continuous play) */
  autoStart?: boolean;
  /** the endless run: hands out the next piece of track when the ball gets close to the end */
  run?: { next: () => Level | null };
  onEvent?: (e: SimEvent) => void;
  onHud?: (h: Hud) => void;
  onFinish?: (r: RunResult) => void;
  onFps?: (fps: number) => void;
}

const enc = (a: Int8Array) => { let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i] & 0xff); return btoa(s); };
const dec = (s: string) => { try { const b = atob(s); const a = new Int8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = (b.charCodeAt(i) << 24) >> 24; return a; } catch { return null; } };

export class RollSession {
  readonly L: Level;
  readonly sim: Sim;
  readonly r: RollRenderer;
  private music: RollMusic | null;
  private sfx: RollSfx | null;
  private host: HTMLElement;
  private o: SessionOptions;
  private raf = 0;
  private last = 0;
  private beat = 0;
  private bps: number;
  phase: Phase = "ready";
  private phaseT = 0;
  private paused = false;
  private destroyed = false;
  private ro: ResizeObserver;
  private drag: { id: number; x0: number; tx0: number; t0: number; moved: number } | null = null;
  private keys = { l: false, r: false };
  private boostT = 0;
  private hudT = 0;
  private fps = { t: 0, n: 0, low: 0, high: 0 };
  private playSeconds = 0;
  private clawState = new Map<number, number>();
  private laughT = 6;
  private countIn = 0;
  private musicWanted: boolean;
  private got: string[] = [];
  private rec: Int8Array;
  private mirrorCss = false;
  /** endless run: time scale from speed rushes × booster */
  speed = 1;
  private rush = 1;
  boostLeft = 0;
  private lastTempo = 1;
  private appending = false;
  private startWorld = 1;

  constructor(host: HTMLElement, L: Level, o: SessionOptions) {
    this.host = host; this.L = L; this.o = o;
    const bpmScale = o.kid ? 0.85 : PACE;
    this.bps = (L.bpm * bpmScale) / 60;
    this.sim = new Sim(L, { bot: !!o.attract, kid: o.kid, ch: o.ch, run: !!o.run });
    this.startWorld = L.world;
    this.beat = this.sim.readyBeat;
    this.r = new RollRenderer(host, L, o.quality, o.ch ?? "momo", !!o.run);
    this.r.shakeOn = o.shake; this.r.reduced = o.reduced;
    if (o.ghost) { const g = dec(o.ghost); if (g) this.r.setGhost(g); }
    this.rec = new Int8Array(L.rows.length);
    this.musicWanted = !o.attract;
    this.music = new RollMusic(L.song, bpmScale);
    this.sfx = o.attract ? null : new RollSfx(L.song.root, o.quality);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const cv = this.r.renderer.domElement;
    if (!o.attract) {
      cv.addEventListener("pointerdown", this.onDown);
      window.addEventListener("pointermove", this.onMove, { passive: true });
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onCancel);
      window.addEventListener("keydown", this.onKey);
      window.addEventListener("keyup", this.onKey);
      cv.addEventListener("contextmenu", this.noMenu);
    }
    if (o.attract) { this.sim.start(); this.phase = "play"; }
    else if (o.autoStart) { this.phase = "countin"; this.phaseT = 0; this.countIn = 3; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __roll?: unknown }).__roll = { session: this, sim: this.sim, level: L };
  }

  private noMenu = (e: Event) => e.preventDefault();
  private resize() { const b = this.host.getBoundingClientRect(); this.r.resize(b.width, b.height); }

  // ---------------------------------------------------------------- control
  begin() {
    if (this.destroyed || this.phase !== "ready") return;
    audio.ensure(); void audio.resume();
    this.sim.start();
    this.beat = this.sim.readyBeat;
    if (this.musicWanted) this.music?.start(this.beat);
    this.phase = "play"; this.phaseT = 0;
  }
  playTitleMusic() {
    if (!this.o.attract || this.destroyed) return;
    audio.ensure(); void audio.resume();
    this.musicWanted = true;
    if (!this.music?.playing) this.music?.start(this.beat);
  }
  pause() { if (this.paused || this.destroyed) return; this.paused = true; this.music?.stop(0.12); this.sfx?.hush(); }
  resume() {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    this.last = performance.now();
    if (this.phase === "play") { this.phase = "countin"; this.phaseT = 0; this.countIn = 3; this.sfx?.tick(1); }
  }
  restart() {
    this.music?.stop(0.1); this.sfx?.hush();
    this.sim.reset();
    this.beat = this.sim.readyBeat;
    this.playSeconds = 0; this.got = [];
    this.clawState.clear();
    this.phase = "ready";
  }

  // ---------------------------------------------------------------- input
  private inputSign() { return (this.r.viewFlip ? -1 : 1) * (this.sim.mirrored ? -1 : 1); }
  private onDown = (e: PointerEvent) => {
    if (this.paused) return;
    if (this.phase === "ready") this.begin();
    if (this.drag) { if (this.sim.press()) this.sfx?.jump(); return; } // second finger = jump
    this.drag = { id: e.pointerId, x0: e.clientX, tx0: this.sim.tx, t0: performance.now(), moved: 0 };
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };
  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || this.paused) return;
    d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x0));
    const k = ((this.o.sensitivity || 1) * 1.15) / this.r.pxPerLane(this.sim.s);
    this.sim.tx = Math.max(-7.5, Math.min(7.5, d.tx0 + (e.clientX - d.x0) * k * this.inputSign()));
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (performance.now() - d.t0 < 230 && d.moved < 12 && this.phase === "play") { if (this.sim.press()) this.sfx?.jump(); }
    this.drag = null;
  };
  private onCancel = (e: PointerEvent) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input,textarea,select,button")) return;
    const on = e.type === "keydown";
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { this.keys.l = on; e.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { this.keys.r = on; e.preventDefault(); }
    else if (on && (k === "ArrowUp" || k === "w" || k === "W" || k === "Enter")) {
      e.preventDefault();
      if (this.phase === "ready" && !this.paused) this.begin();
      else if (this.phase === "play" && !e.repeat && this.sim.press()) this.sfx?.jump();
    }
  };
  private buzz(p: number | number[]) {
    if (!this.o.haptics || this.o.attract) return;
    try { navigator.vibrate?.(p); } catch { /* not supported */ }
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.tickFps(dt);
    if (this.paused) { this.r.update(this.sim, this.beat, 0); return; }
    this.phaseT += dt;
    if (this.phase === "play" || this.phase === "done") {
      if (this.o.run) this.runTick(dt);
      this.beat += dt * this.bps * this.speed;
      if (this.music?.playing && this.music.audioRunning) {
        const err = this.music.beatNow() - this.beat;
        if (Math.abs(err) > 0.35) this.beat += err; else this.beat += err * Math.min(1, dt * 6);
      }
      if (this.phase === "play") this.playSeconds += dt;
      const kdir = ((this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0)) * this.inputSign();
      if (kdir) this.sim.tx = Math.max(-7.5, Math.min(7.5, this.sim.tx + kdir * 8.5 * dt * this.speed));
      const prevBeat = this.sim.beat;
      // the sim runs on the music clock: a 2× rush is the same track played twice as fast (always fair, just quicker),
      // and a beat re-sync after a hitch gives steering the same time as the distance it covers
      this.sim.update(this.beat, Math.min(1.5, Math.max(0, (this.beat - prevBeat) / this.bps)));
      this.worldSounds(prevBeat, this.beat);
      const r = Math.round(this.sim.s);
      if (r >= 0 && r < this.rec.length) this.rec[r] = Math.max(-127, Math.min(127, Math.round(this.sim.x * 16)));
    } else if (this.phase === "dying") {
      if (this.phaseT > 0.6) {
        if (this.L.oneLife || this.o.run) { this.phase = "over"; this.finishRun(false); }
        else { this.sim.respawn(); this.beat = this.sim.readyBeat; this.phase = "respawn"; this.phaseT = 0; }
      }
    } else if (this.phase === "respawn") {
      if (this.phaseT > 0.85) { this.sim.start(); this.music?.start(this.beat); this.phase = "play"; this.phaseT = 0; }
    } else if (this.phase === "countin") {
      const left = 3 - Math.floor(this.phaseT / 0.42);
      if (left !== this.countIn && left > 0) { this.countIn = left; this.sfx?.tick(left === 1 ? 0 : 1); }
      if (this.phaseT > 1.26) {
        this.countIn = 0;
        if (this.sim.mode === "ready") { audio.ensure(); void audio.resume(); this.sim.start(); }
        this.music?.start(this.beat); this.phase = "play"; this.phaseT = 0;
      }
    }
    for (const e of this.sim.drain()) this.handle(e);
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt * 1.2);
    // mirror-world zones flip the picture itself
    const mirror = this.L.zones[this.sim.zone]?.cam === "mirror";
    if (mirror !== this.mirrorCss) { this.mirrorCss = mirror; this.r.renderer.domElement.style.transform = mirror ? "scaleX(-1)" : ""; }

    this.r.update(this.sim, this.beat, dt);
    const row = this.L.rows[Math.max(0, Math.min(this.L.rows.length - 1, Math.round(this.sim.s)))];
    this.sfx?.update({
      camera: this.r.camera, rolling: this.sim.mode === "roll" || this.sim.mode === "done", speed: this.bps * row.rpb,
      air: this.sim.mode === "jump" || this.sim.mode === "revive", boost: Math.max(this.boostT, this.boostLeft > 0 ? 0.6 : 0, (this.speed - 1) * 0.6), ballX: this.sim.x, s: this.sim.s, beat: this.beat, hazards: this.L.hazards,
      ambience: moodOf(this.L.zones[this.sim.zone].mood).ambience, dt, paused: this.phase !== "play" && this.phase !== "done",
    });
    this.hudT -= dt;
    if (this.hudT <= 0 && this.o.onHud) {
      this.hudT = 0.1;
      this.o.onHud({
        pct: this.sim.progress, beads: this.sim.beads, sprouts: this.sim.sprouts, deaths: this.sim.deaths, zone: this.sim.zone, cp: this.sim.cp,
        phase: this.phase, count: this.countIn, fever: this.sim.fever, abilities: [...this.sim.ab.keys()], extras: this.sim.extras, shield: this.sim.shield, streak: this.sim.streak,
        lives: this.sim.lives, meters: Math.round(this.sim.s), speed: Math.round(this.speed * 10) / 10, boost: this.boostLeft, world: moodOf(this.L.zones[this.sim.zone].mood).world, reviving: this.sim.mode === "revive",
      });
    }
    if (this.o.attract && this.sim.finished && this.phaseT > 1) this.loopAttract();
  };

  // ---------------------------------------------------------------- endless run
  /** speed rushes: every few zones the music and the roll speed up (1.5× / 2×), then calm back to 1× */
  private rushFor(zi: number) {
    if (this.o.kid) return zi % 5 === 4 ? 1.25 : 1;
    if (zi < 2) return 1.08;
    // rushes stay where they were (PACE already speeds everything up)
    if (zi % 9 === 8) return 2 / PACE;
    if (zi % 4 === 3) return 1.5 / PACE;
    return 1.08 + Math.min(0.17, zi * 0.007);
  }
  private runTick(dt: number) {
    const L = this.L, s = this.sim;
    // keep the track growing well ahead of Momo
    if (!this.appending && s.s > L.finish - 220) {
      this.appending = true;
      const next = this.o.run!.next();
      if (next) {
        appendChunk(L, next);
        s.extend();
        this.r.extend();
      }
      this.appending = false;
    }
    // speed: ramp into a rush at the start of its zone, ease back out 4 beats before it ends
    const zi = s.zone, z = L.zones[zi];
    let want = this.rushFor(zi);
    // zones that already race (speed-up chorus, boost strips) don't get a rush on top
    if (z && want > 1.3 && L.rows[Math.min(L.rows.length - 1, z.from + 2)].rpb > 3.9) want = 1.25;
    if (want > 1.3 && z && this.beat > z.beat0 + z.beats - 4) want = 1.08;
    this.rush += (want - this.rush) * Math.min(1, dt * 1.6);
    if (this.boostLeft > 0) { this.boostLeft = Math.max(0, this.boostLeft - dt); if (this.boostLeft === 0) { s.boosting = false; this.o.onEvent?.({ t: "ability", ab: "BOOST", on: false }); } }
    this.speed = Math.min(RUN_MAX_SPEED, this.rush * (this.boostLeft > 0 ? BOOST_K : 1));
    if (Math.abs(this.speed - this.lastTempo) > 0.03) { this.lastTempo = this.speed; this.music?.setTempo(this.speed); }
    this.r.speedFx = Math.max(0, this.speed - 1);
  }
  /** spend coins to keep going after the last life */
  revive(cost = 0) {
    if (!this.o.run || this.phase !== "over" || this.sim.beads < cost) return false;
    this.sim.beads -= cost;
    this.sim.revive();
    this.phase = "play"; this.phaseT = 0;
    this.music?.start(this.beat);
    return true;
  }

  private loopAttract() {
    this.sim.reset();
    this.beat = this.sim.readyBeat; this.sim.start(); this.sim.drain(); this.phase = "play"; this.phaseT = 0;
    if (this.musicWanted) this.music?.start(this.beat);
  }

  private tickFps(dt: number) {
    const f = this.fps;
    f.t += dt; f.n++;
    if (f.t >= 1) {
      const fps = f.n / f.t;
      this.o.onFps?.(fps);
      f.t = 0; f.n = 0;
      if (fps < 46 && !this.paused) { f.low++; f.high = 0; } else if (fps > 57) { f.high++; f.low = 0; } else { f.low = 0; f.high = 0; }
      const base = this.o.renderScale || 1;
      if (f.low >= 2 && this.r.scale > base * 0.6) { this.r.setScale(Math.max(base * 0.6, this.r.scale - 0.1)); f.low = 0; }
      if (f.high >= 4 && this.r.scale < base) { this.r.setScale(Math.min(base, this.r.scale + 0.05)); f.high = 0; }
    }
  }

  private worldSounds(b0: number, b1: number) {
    if (b1 <= b0) return;
    const L = this.L;
    const s0 = Math.max(0, Math.floor(this.sim.s) - 1), s1 = Math.min(L.rows.length - 1, Math.floor(this.sim.s) + 14);
    let n = 0;
    for (let r = s0; r <= s1 && n < 2; r++) {
      for (const t of L.rows[r].tiles) {
        if (t.k !== TK.crumble || t.drop === undefined) continue;
        if (t.drop > b0 && t.drop <= b1) { this.sfx?.crumble(t.x, r); this.r.burst("crumble", t.x, L.rows[r].h, r); n++; break; }
      }
    }
    for (const h of L.hazards) {
      if (h.kind !== "claw" || h.s < this.sim.s - 3 || h.s > this.sim.s + 20) continue;
      const slam = clawSlamNear(h, b1);
      const st = this.clawState.get(h.id) ?? -1e9;
      if (st < slam - 0.5 && b1 >= slam - CLAW_WARN && b0 < slam - CLAW_WARN + 0.001 + (b1 - b0)) this.sfx?.clawWarn(h.x, h.s);
      if (st < slam && b1 >= slam && b0 < slam) {
        this.clawState.set(h.id, slam);
        this.sfx?.clawSlam(h.x, h.s);
        this.r.burst("slam", h.x, L.rows[h.s].h, h.s);
        if (Math.abs(h.s - this.sim.s) < 6) this.buzz(25);
      }
    }
    if (L.chase && !this.o.attract) {
      this.laughT -= (b1 - b0) / this.bps;
      if (this.laughT <= 0) { this.laughT = 9 + Math.random() * 8; if (L.zones[this.sim.zone].rules.chase === "kranky" || L.zones[this.sim.zone].boss) this.sfx?.kranky(); }
    }
  }

  private handle(e: SimEvent) {
    const s = this.sim;
    const fy = s.floorAt(s.s);
    switch (e.t) {
      case "start": this.sfx?.start(); break;
      case "land": this.r.land(e.v); this.r.burst("land", s.x, fy, s.s); this.sfx?.land(e.v); this.buzz(12); break;
      case "pad": this.r.launch(); this.r.burst("pad", s.x, fy, s.s); this.sfx?.pad(); this.buzz(e.mega ? [18, 30, 18] : 18); break;
      case "jump": this.r.launch(); this.r.burst("pad", s.x, s.y, s.s); break;
      case "boost": this.boostT = 1; this.r.burst("boost", s.x, fy, s.s); this.sfx?.boost(); this.buzz([8, 30, 8]); break;
      case "bead": {
        const m = moodOf(this.L.zones[s.zone].mood);
        this.r.burst("bead", e.x, fy + e.y, e.s, m.beads[e.id % m.beads.length]); this.sfx?.bead(e.x, fy + e.y, e.s); this.buzz(6);
        break;
      }
      case "sprout": this.r.burst("sprout", e.x, fy + e.y, e.s); this.sfx?.sprout(e.x, fy + e.y, e.s); this.buzz([12, 40, 12, 40, 30]); break;
      case "pickup":
        this.got.push(e.kind === "power" ? e.ab ?? "power" : e.kind);
        this.r.burst(e.kind === "booster" ? "boost" : e.kind, e.x, fy + e.y, e.s);
        this.sfx?.pickup(e.kind === "booster" ? "power" : e.kind, e.x, fy + e.y, e.s);
        if (e.kind === "booster") { this.boostLeft = 30; s.boosting = true; this.sfx?.boost(); this.buzz([20, 40, 20, 40, 20]); }
        else this.buzz([10, 30, 10]);
        break;
      case "ability": this.sfx?.ability(e.on); break;
      case "tile": this.r.burst(e.k === TK.teleport ? "teleport" : "tile", e.x, fy, e.s, e.k === TK.gold ? 0xffc533 : undefined); this.r.touch(e.x, e.s); this.sfx?.tile(e.k, e.x, e.s, e.note); if (e.k === TK.teleport) this.buzz(15); break;
      case "fever": this.music?.fever(e.on); this.sfx?.fever(e.on); if (e.on) { this.r.burst("fever", s.x, fy, s.s); this.buzz([10, 20, 10, 20, 10]); } break;
      case "hit":
        if (e.shield) { this.r.burst("shield", s.x, s.y, s.s); this.sfx?.shield(); this.buzz(20); }
        else { this.r.burst("hit", e.x, s.y, e.s); this.sfx?.hit(); this.buzz([50, 30, 70]); }
        break;
      case "fall": this.sfx?.fall(); this.buzz(30); break;
      case "dead": this.phase = "dying"; this.phaseT = 0; this.music?.stop(0.5); this.sfx?.hush(); break;
      case "life": if (e.delta > 0) { this.r.burst("power", s.x, fy + 0.4, s.s); this.sfx?.pickup("baby", s.x, fy, s.s); this.buzz([10, 30, 10]); } else { this.buzz([60, 40, 60]); } break;
      case "revive": if (e.on) this.r.burst("respawn", s.x, fy, s.s); break;
      case "respawn": this.r.burst("respawn", s.x, fy, s.s); this.sfx?.respawn(); break;
      case "checkpoint": if (!this.o.run) { this.r.burst("checkpoint", 0, fy, e.s); this.sfx?.checkpoint(); this.buzz([15, 40, 15]); } break;
      case "zone": this.sfx?.zone(); break;
      case "finish":
        this.phase = "done"; this.phaseT = 0;
        this.music?.finish(this.beat);
        this.sfx?.finish();
        this.r.burst("finish", 0, this.L.rows[this.L.finish].h, this.L.finish);
        this.buzz([20, 60, 20, 60, 40]);
        if (!this.o.attract) window.setTimeout(() => { if (!this.destroyed) this.finishRun(true); }, 2200);
        break;
    }
    this.o.onEvent?.(e);
  }

  private finishRun(completed: boolean) { this.o.onFinish?.(this.result(completed)); }

  result(completed = true): RunResult {
    let mask = 0, k = 0;
    for (const p of this.L.pickups) if (p.kind === "sprout") { if (this.sim.got[p.id]) mask |= 1 << k; k++; }
    return {
      level: this.L.id, kind: this.L.kind, name: this.L.name, beads: this.sim.beads, beadsTotal: this.L.pickups.filter((p) => p.kind === "bead").length,
      sprouts: this.sim.sprouts, sproutMask: mask, deaths: this.sim.deaths, seconds: this.playSeconds, extras: this.got, gold: this.sim.gold,
      concepts: this.L.concepts, fusion: this.L.fusion, distance: Math.round(this.sim.s), completed,
      ghost: completed && this.L.kind === "journey" ? enc(this.rec) : undefined,
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const cv = this.r.renderer.domElement;
    cv.removeEventListener("pointerdown", this.onDown);
    cv.removeEventListener("contextmenu", this.noMenu);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onCancel);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.music?.dispose();
    this.sfx?.dispose();
    this.r.dispose();
    const w = window as unknown as { __roll?: { session?: unknown } };
    if (w.__roll?.session === this) delete w.__roll;
  }
}
