// Tondu's Vine Climb session: input (tap anywhere = flip, hold the CLING pad = cling, the LEAP pad = leap; keys:
// Space / ↑ / W / ← / → flip, Shift / ↓ / S cling, Enter / D leap), a fixed-step simulation, the continuous stage flow
// (the next stage is built while you climb, a flower gate hands you over to it without a stop), falls and retries
// from the last gate or moss checkpoint, slow-motion moments, and every sound, panned by where it happens.
import * as THREE from "three";
import { audio, type Sound } from "@/lib/audio";
import { VineRenderer, type Quality, type VineLook } from "./render";
import { Sim, type SimOpts } from "./sim";
import { Bot, SKILLS } from "./bot";
import { mulberry } from "./path";
import { buildStage, leapWindow, stageDef } from "./stages";
import { WORLDS } from "./worlds";
import type { SimEvent, Stage } from "./types";
import type { StageView } from "./view";

export const VINE_SFX = ["flip", "snap", "gold", "tail", "regrow", "shield", "smash", "leap", "land", "hop", "pick", "rush", "gate", "mid", "fall", "caw", "whistle", "thunder", "pop", "roll", "cling", "world", "miss", "buzz", "splash", "combo"].map((n) => `a:vine_${n}` as Sound);
const S = (n: string) => `a:vine_${n}` as Sound;

export interface VineHud {
  n: number; world: number; k: number; kind: Stage["def"]["kind"]; name: string; concepts: string[];
  progress: number; bugs: number; gold: number; combo: number; best: number;
  tail: boolean; shield: boolean; grip: number; clinging: boolean; sun: number; rush: number; magnet: number; glide: number;
  canLeap: boolean; clingOn: boolean; leapOn: boolean; egg: boolean;
  rival: number | null; chase: number | null; mid: boolean;
}
export interface StageResult { n: number; bugs: number; gold: number; best: number; hits: number; rivalWon: boolean | null; egg: boolean; time: number; crown: boolean; kinds: Record<string, number>; flips: number; leaps: number; rushes: number; smashes: number }
export interface SessionOpts {
  quality: Quality; look: VineLook;
  /** the stage to start on */
  n: number;
  /** "title": Tondu idles on the vine under an orbiting camera */
  mode: "climb" | "title";
  /** the stage after n (campaign → n+1; Wild Canopy picks a variant that wasn't seen) */
  next?: (n: number) => number;
  /** variant for Wild stages (fingerprint re-rolls) */
  variant?: (n: number) => number;
  sim?: Omit<SimOpts, "startS" | "tail">;
  vibrate?: boolean;
  onHud?: (h: VineHud) => void;
  onEvent?: (e: SimEvent) => void;
  onStage?: (r: StageResult, next: number) => void;
  onFall?: (n: number) => void;
  onWorld?: (world: number, n: number) => void;
}

export class VineSession {
  r: VineRenderer; o: SessionOpts;
  st: Stage; view: StageView; sim: Sim;
  private next: { n: number; st: Stage; view: StageView } | null = null;
  private raf = 0; private last = 0; private acc = 0;
  private paused = false; private waiting = false; private fallClock = -1;
  private timeScale = 1; private slowT = 0;
  private held = false; private keyHeld = new Set<string>();
  private midPassed = false; private startedAt = 0;
  private hudT = 0;
  private count = { flips: 0, leaps: 0, rushes: 0, smashes: 0 };
  /** dev / art: a bot plays (window.__vine.setAutopilot(true)) */
  private auto: Bot | null = null;
  private host: HTMLElement;

  constructor(host: HTMLElement, o: SessionOpts) {
    this.host = host; this.o = o;
    this.r = new VineRenderer(host, o.quality, o.look);
    this.r.title = o.mode === "title";
    this.st = buildStage(stageDef(o.n, o.variant?.(o.n) ?? 0));
    this.view = this.r.addView(this.st, new THREE.Vector3());
    this.sim = this.makeSim(0);
    this.r.setWorld(WORLDS[this.st.def.world]);
    if (o.mode === "title") { const i = Math.round(30 / this.st.path.ds); this.r.resetLizard(this.view, 30, this.st.path.N[i * 3 + 1] >= 0 ? 0.3 : Math.PI - 0.3); }
    else this.r.resetLizard(this.view, 0, 0);
    this.stageStarted(true);
    const ro = new ResizeObserver(() => this.r.resize(host.clientWidth, host.clientHeight)); ro.observe(host); this.ro = ro;
    this.r.resize(host.clientWidth, host.clientHeight);
    // the title: Tondu sits in the upper middle, clear of the buttons below
    if (o.mode === "title") this.r.setInsets(host.clientHeight * 0.08, host.clientHeight * 0.4);
    if (o.mode === "climb") {
      host.addEventListener("pointerdown", this.onDown);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
      window.addEventListener("keydown", this.onKey, true);
      window.addEventListener("keyup", this.onKeyUp, true);
    }
    if (typeof window !== "undefined") (window as unknown as Record<string, unknown>)[o.mode === "title" ? "__vineTitle" : "__vine"] = this;
    this.last = performance.now();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.tick(now); };
    this.raf = requestAnimationFrame(loop);
  }
  private ro: ResizeObserver;

  private makeSim(startS: number): Sim { return new Sim(this.st, { ...(this.o.sim ?? {}), startS }); }
  private stageStarted(first: boolean) {
    const d = this.st.def;
    this.midPassed = false; this.startedAt = performance.now();
    this.r.setGuardian(d.guardian ?? null);
    this.r.setRival(!!this.st.rival);
    if (d.guardian && !first) this.r.cinematic("guardian", 2.2);
    if (this.o.mode === "climb") this.prepareNext();
  }
  /** build the next stage now (it's placed where this one ends) so the gate hands over without a stop */
  private prepareNext() {
    if (this.next || !this.o.next) return;
    const n = this.o.next(this.st.def.n);
    const st = buildStage(stageDef(n, this.o.variant?.(n) ?? 0));
    const view = this.r.addView(st, this.view.end.clone());
    this.next = { n, st, view };
  }

  // ------------------------------------------------------------------ input
  /** the cling pad / key */
  setCling(on: boolean) { if (!this.clingAllowed()) on = false; this.held = on; this.sim.press(on ? "clingOn" : "clingOff"); }
  leap() { if (!this.paused && !this.waiting) this.sim.press("leap"); }
  flip() { if (!this.paused && !this.waiting) this.sim.press("flip"); }
  clingAllowed() { const d = this.st.def; return d.kind === "wild" || d.kind === "daily" || d.world >= 2 || d.n > 40; }
  leapAllowed() { return this.st.gaps.length > 0; }
  private onDown = (ev: PointerEvent) => {
    if (this.paused) return;
    const el = ev.target as HTMLElement;
    if (el.closest?.("[data-pad]")) return; // the pads handle themselves
    if (this.waiting) return;
    this.flip();
  };
  private onUp = () => {};
  private onKey = (ev: KeyboardEvent) => {
    if (this.paused) return;
    const k = ev.key.toLowerCase();
    const flipK = [" ", "arrowup", "w", "arrowleft", "arrowright", "a"].includes(k);
    const clingK = ["shift", "arrowdown", "s"].includes(k);
    const leapK = ["enter", "d", "e"].includes(k);
    if (!flipK && !clingK && !leapK) return;
    // Space would also pause the game in the player shell: it's ours while climbing
    ev.preventDefault(); ev.stopPropagation();
    if (ev.repeat) return;
    if (this.waiting) { if (flipK || leapK) this.retry(); return; }
    if (flipK) this.flip();
    if (clingK) { this.keyHeld.add(k); this.setCling(true); }
    if (leapK) this.leap();
  };
  private onKeyUp = (ev: KeyboardEvent) => {
    const k = ev.key.toLowerCase();
    if (this.keyHeld.delete(k) && this.keyHeld.size === 0) this.setCling(false);
  };

  pause(p: boolean) { this.paused = p; if (p) { this.setCling(false); this.keyHeld.clear(); } this.last = performance.now(); }

  /** after a fall: climb again from the last gate (or the moss checkpoint) */
  retry() {
    if (!this.waiting) return;
    this.waiting = false; this.fallClock = -1;
    const startS = this.midPassed && this.st.mid ? this.st.mid : 0;
    this.sim = this.makeSim(startS);
    this.view.unsmash();
    this.r.clearFx();
    this.r.resetLizard(this.view, startS, 0);
    this.held = false; this.keyHeld.clear();
    if (this.auto) this.auto = new Bot(SKILLS.good, mulberry(11));
    this.startedAt = performance.now();
    void audio.play("a:whooshIn", { gain: 0.4, duck: false });
  }

  // ------------------------------------------------------------------ loop
  private tick(now: number) {
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) dt = 0;
    if (this.o.mode === "title") {
      this.r.titlePose(this.view, 30, dt);
      this.r.frame(dt, null, this.view);
      return;
    }
    // slow motion after a tail drop
    if (this.slowT > 0) { this.slowT -= dt; this.timeScale = 0.35; } else this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 6);
    const sdt = dt * this.timeScale;
    if (!this.waiting) {
      this.acc += sdt;
      const step = 1 / 120;
      while (this.acc >= step) {
        this.acc -= step;
        if (this.auto) this.auto.tick(this.sim);
        this.sim.step(step);
        if (this.sim.ev.length) { const evs = this.sim.ev.splice(0); for (const e of evs) this.handle(e); }
        if (this.sim.done) { this.handOver(); break; }
        if (!this.sim.alive) break;
      }
    }
    if (!this.sim.alive && this.fallClock >= 0) {
      this.fallClock += dt;
      if (this.fallClock > 1.25 && !this.waiting) { this.waiting = true; this.o.onFall?.(this.st.def.n); }
    }
    this.r.frame(dt, this.sim, this.view);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.06; this.o.onHud?.(this.hud()); }
  }

  /** the gate: the next stage's sim starts right where this one ends — no stop */
  private handOver() {
    const old = this.sim, done = this.st;
    const kinds: Record<string, number> = {};
    done.bugs.forEach((b, i) => { if (old.eaten[i] === 1) { const key = b.kind < 0 ? "gold" : String(b.kind); kinds[key] = (kinds[key] ?? 0) + 1; } });
    const res: StageResult = { n: done.def.n, bugs: old.bugs, gold: old.gold, best: old.best, hits: old.hits, rivalWon: old.rivalWon, egg: done.zones.some((z) => z.kind === "egg") && old.egg, time: (performance.now() - this.startedAt) / 1000, crown: !!done.def.guardian, kinds, ...this.count };
    this.count = { flips: 0, leaps: 0, rushes: 0, smashes: 0 };
    // a one-off stage (Daily Vine): stop at the gate
    if (!this.o.next) { this.waiting = true; this.o.onStage?.(res, -1); return; }
    if (!this.next) this.prepareNext();
    const nx = this.next!;
    this.next = null;
    const prevView = this.view;
    const worldChange = nx.st.def.world !== done.def.world;
    this.st = nx.st; this.view = nx.view;
    // carry the tail, shield and powers over the gate
    const sim = new Sim(this.st, { ...(this.o.sim ?? {}), tail: old.tail, shield: old.shield });
    sim.side = old.side; sim.rush = old.rush; sim.magnet = old.magnet; sim.glide = old.glide; sim.grip = old.grip; sim.held = this.held;
    sim.combo = old.combo; sim.regrow = old.regrow;
    this.sim = sim;
    if (this.auto) this.auto = new Bot(SKILLS.good, mulberry(this.st.def.n));
    this.r.setWorld(WORLDS[this.st.def.world]);
    // drop stages far below
    for (const v of [...this.r.views]) if (v !== prevView && v !== this.view && v.yMax < this.view.off.y - 40) this.r.dropView(v);
    this.stageStarted(false);
    if (worldChange) { this.r.cinematic("world", 3.2); this.o.onWorld?.(this.st.def.world, this.st.def.n); void audio.play(S("world"), { gain: 0.8 }); }
    this.o.onStage?.(res, this.st.def.n);
    // after a while the old stage goes too
    setTimeout(() => { if (this.r.views.includes(prevView) && prevView !== this.view) this.r.dropView(prevView); }, 9000);
  }

  private pan() { return Math.max(-0.7, Math.min(0.7, this.sim.side * 0.45)); }
  private buzz(ms: number) { if (this.o.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* blocked */ } } }
  private handle(e: SimEvent) {
    this.r.onEvent(e, this.sim, this.view);
    this.o.onEvent?.(e);
    const pan = this.pan();
    switch (e.t) {
      case "flip": this.count.flips++; audio.play(S("flip"), { gain: 0.45, pan: e.side * 0.5, rate: 0.95 + Math.random() * 0.1, duck: false }); break;
      case "snap": audio.play(S(e.gold ? "gold" : "snap"), { gain: e.gold ? 0.55 : 0.4, pan, rate: Math.min(1.8, 1 + Math.min(e.combo, 30) * 0.02), duck: false }); if (e.combo > 0 && e.combo % 10 === 0) audio.play(S("combo"), { gain: 0.6 }); break;
      case "miss": audio.play(S("miss"), { gain: 0.25, duck: false }); break;
      case "tail": audio.play(S("tail"), { gain: 0.8, pan, reverb: 0.3 }); this.slowT = 0.35; this.buzz(60); break;
      case "regrow": audio.play(S("regrow"), { gain: 0.6 }); break;
      case "shield": audio.play(S("shield"), { gain: 0.7, pan }); this.buzz(30); break;
      case "smash": this.count.smashes++; audio.play(S("smash"), { gain: 0.55, pan, rate: 0.9 + Math.random() * 0.2 }); break;
      case "leap": this.count.leaps++; audio.play(S("leap"), { gain: 0.6, pan }); break;
      case "land": audio.play(S("land"), { gain: 0.5, pan }); break;
      case "hop": audio.play(S("hop"), { gain: 0.3, duck: false }); break;
      case "pick": audio.play(S("pick"), { gain: 0.7 }); break;
      case "rush": this.count.rushes++; audio.play(S("rush"), { gain: 0.8, reverb: 0.2 }); this.buzz(25); break;
      case "gate": audio.play(S("gate"), { gain: 0.7, reverb: 0.25 }); break;
      case "mid": audio.play(S("mid"), { gain: 0.6 }); this.midPassed = true; break;
      case "fall": audio.play(S("fall"), { gain: 0.8, reverb: 0.3 }); this.fallClock = 0; this.buzz(120); break;
      case "chase": audio.play(S("caw"), { gain: 0.7, pan: -0.3, reverb: 0.3 }); break;
      case "cling": if (e.on) audio.play(S("cling"), { gain: 0.25, duck: false }); break;
      case "arm": {
        const h = this.st.haz[e.i], p = h.side === 0 ? 0 : h.side * 0.55;
        if (h.kind === "fruit" || h.kind === "nut") audio.play(S("whistle"), { gain: 0.45, pan: p });
        else if (h.kind === "lightning") audio.play(S("thunder"), { gain: 0.7, pan: p, reverb: 0.5 });
        else if (h.kind === "dive") audio.play(S("caw"), { gain: 0.6, pan: p, reverb: 0.3 });
        else if (h.kind === "pod") audio.play(S("pop"), { gain: 0.45, pan: p });
        else if (h.kind === "burr" || h.kind === "crawler") audio.play(S("roll"), { gain: 0.45, pan: p });
        break;
      }
    }
  }

  hud(): VineHud {
    const s = this.sim, d = this.st.def;
    return {
      n: d.n, world: d.world, k: d.k, kind: d.kind, name: d.name, concepts: d.concepts,
      progress: Math.min(1, s.s / this.st.path.len), bugs: s.bugs, gold: s.gold, combo: s.combo, best: s.best,
      tail: s.tail, shield: s.shield, grip: s.grip, clinging: s.clinging, sun: s.sun, rush: s.rush, magnet: s.magnet, glide: s.glide,
      canLeap: s.leapable() >= 0, clingOn: this.clingAllowed(), leapOn: this.leapAllowed(), egg: this.st.zones.some((z) => z.kind === "egg") && s.egg,
      rival: this.st.rival ? Math.min(1, s.rivalS / this.st.path.len) : null, chase: this.st.chase ? Math.max(0, s.s - s.chaseS) : null, mid: this.midPassed,
    };
  }
  /** the next leap mark ahead (for the LEAP pad glow) */
  leapNear(): number { const g = this.st.gaps.find((x) => x.s0 > this.sim.s - 0.2); if (!g) return 99; return Math.max(0, g.s0 - leapWindow(this.st.def.speed) - this.sim.s); }

  setLook(l: { skin: string; hat: string }) { this.r.setLook(l); this.r.resetLizard(this.view, this.o.mode === "title" ? 30 : this.sim.s, 0); }
  setInsets(top: number, bottom: number) { this.r.setInsets(top, bottom); }
  setAutopilot(on: boolean) { this.auto = on ? new Bot(SKILLS.good, mulberry(7)) : null; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.host.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp); window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKey, true); window.removeEventListener("keyup", this.onKeyUp, true);
    const w = window as unknown as Record<string, unknown>;
    if (w.__vine === this) delete w.__vine;
    if (w.__vineTitle === this) delete w.__vineTitle;
    this.r.dispose();
  }
}
