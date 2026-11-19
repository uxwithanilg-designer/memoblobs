// The Momo Jelly Jam ASMR sound set, synthesised live with Web Audio (no files): a wet squelch when you grab a jelly,
// soft slide ticks while you drag, a plop where it lands, a juicy bloop when blocks squish (tuned to the stage's key,
// bigger blocks sound lower), a cork pop + a chime out of every gate that climbs the scale as the tray empties, a
// voice for every tile and machine, and a quiet ambience bed for each world (simmering pots, birds, bubbles, waves,
// wind, clock ticks, space hum…). Everything runs through the shared SFX bus, so the game's volume sliders apply.
import { audio } from "@/lib/audio";
import type { PropKind } from "./data/worlds";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** major pentatonic steps: chimes always sit nicely on the music */
const PENT = [0, 2, 4, 7, 9];
const pent = (root: number, step: number) => root + PENT[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5);

export type TileSound =
  | "ice" | "mud" | "belt" | "tele" | "spring" | "bumper" | "wind" | "magnet" | "fall" | "crumble" | "glass" | "switch" | "doorOpen"
  | "doorClose" | "key" | "coin" | "star" | "paint" | "rinse" | "split" | "shrink" | "grow" | "stone" | "eat" | "spin" | "spawn"
  | "turn" | "flip" | "bubble" | "thaw" | "rewind" | "wrap" | "kranky";

interface Amb { kind: PropKind; bed: GainNode | null; nodes: AudioScheduledSourceNode[]; next: number; t: number }

export class JamSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private root = 60;
  private amb: Amb | null = null;
  private ambKind: PropKind | null = null;
  private ambNight = false;
  private paused = false;
  private disposed = false;
  private lastTick = 0;

  /** the Web Audio graph is made on first use (after a tap, so phones allow sound) */
  private ready(): AudioContext | null {
    if (!this.build()) return null;
    if (this.ambKind && !this.amb) this.startAmbience(this.ambKind, this.ambNight);
    return this.ctx!.state === "running" ? this.ctx : null;
  }
  private build(): boolean {
    if (this.disposed) return false;
    if (this.ctx && this.out) return true;
    const c = audio.ensure();
    const dest = audio.sfxOut;
    if (!c || !dest) return false;
    this.ctx = c;
    this.out = c.createGain(); this.out.gain.value = 0.9; this.out.connect(dest);
    this.wet = c.createGain(); this.wet.gain.value = 0.55; this.wet.connect(this.out);
    const ro = audio.reverbOut; if (ro) this.wet.connect(ro);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  /** the stage's key (MIDI root of the music) — chimes and bloops are tuned to it */
  setKey(root: number) { this.root = root; }

  // ---------------------------------------------------------------- building blocks
  private pan(c: AudioContext, p: number, to: AudioNode) {
    if (!c.createStereoPanner) return to;
    const s = c.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); s.connect(to); return s;
  }
  private env(c: AudioContext, t: number, peak: number, a: number, d: number, to: AudioNode) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(to);
    return g;
  }
  private osc(c: AudioContext, type: OscillatorType, f0: number, f1: number, t: number, dur: number, to: AudioNode, glide = dur) {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide);
    o.connect(to); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  private hiss(c: AudioContext, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, to: AudioNode, rate = 1) {
    if (!this.noise) return null;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    s.connect(f).connect(to);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return s;
  }
  /** a soft bell: two inharmonic partials, long tail into the room */
  private bell(c: AudioContext, t: number, midi: number, peak: number, p: number, dur = 0.9) {
    const to = this.pan(c, p, this.wet!);
    const f = mtof(midi);
    this.osc(c, "sine", f, f, t, dur, this.env(c, t, peak, 0.004, dur, to));
    this.osc(c, "sine", f * 2.76, f * 2.76, t, dur * 0.4, this.env(c, t, peak * 0.28, 0.002, dur * 0.4, to));
    this.osc(c, "triangle", f * 2, f * 2, t, dur * 0.25, this.env(c, t, peak * 0.12, 0.002, dur * 0.25, to));
  }

  // ---------------------------------------------------------------- the jelly itself
  /** grab: a wet squelch, lower for big jellies */
  grab(size: number, p: number) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.005, k = Math.max(0.55, 1.15 - size * 0.06);
    const to = this.pan(c, p, this.out!);
    this.hiss(c, t, 0.14, "bandpass", 1300 * k, 380 * k, 5, this.env(c, t, 0.5, 0.008, 0.13, to));
    this.hiss(c, t + 0.02, 0.1, "bandpass", 2400 * k, 900 * k, 7, this.env(c, t + 0.02, 0.25, 0.006, 0.09, to));
    this.osc(c, "sine", 210 * k, 120 * k, t, 0.12, this.env(c, t, 0.32, 0.006, 0.11, to));
  }
  /** one cell of drag: a tiny soft tick (rate-limited) */
  slide(p: number) {
    const c = this.ready(); if (!c) return;
    const now = c.currentTime;
    if (now - this.lastTick < 0.035) return;
    this.lastTick = now;
    const to = this.pan(c, p, this.out!);
    this.hiss(c, now, 0.05, "bandpass", 2600 + Math.random() * 900, 1500, 9, this.env(c, now, 0.16, 0.003, 0.045, to));
  }
  /** landing: a soft plop */
  drop(size: number, p: number) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.005, k = Math.max(0.6, 1.2 - size * 0.05);
    const to = this.pan(c, p, this.out!);
    this.osc(c, "sine", 420 * k, 150 * k, t, 0.16, this.env(c, t, 0.45, 0.004, 0.15, to), 0.07);
    this.hiss(c, t, 0.05, "lowpass", 1800, 600, 1, this.env(c, t, 0.12, 0.002, 0.04, to));
  }
  /** squish: a juicy bloop tuned to the key (bigger block → lower note) + a wet smear */
  squish(size: number, p: number) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.01;
    const step = Math.max(0, 9 - Math.min(9, size));
    const f = mtof(pent(this.root + 12, step));
    const to = this.pan(c, p, this.out!);
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(f * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.16);
    o.connect(this.env(c, t, 0.5, 0.01, 0.3, to)); o.start(t); o.stop(t + 0.4);
    this.osc(c, "triangle", f * 2, f * 2, t + 0.04, 0.18, this.env(c, t + 0.04, 0.12, 0.004, 0.17, this.pan(c, p, this.wet!)));
    this.hiss(c, t, 0.22, "bandpass", 900, 260, 4, this.env(c, t, 0.35, 0.01, 0.2, to));
    this.hiss(c, t + 0.05, 0.12, "bandpass", 3200, 1400, 8, this.env(c, t + 0.05, 0.12, 0.004, 0.1, to));
  }
  /** a block leaves: cork pop + a chime that climbs the scale with every exit (i = blocks out so far) */
  exit(i: number, p: number, floor = false) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.005;
    const to = this.pan(c, p, this.out!);
    if (floor) this.osc(c, "sine", 500, 90, t, 0.35, this.env(c, t, 0.4, 0.005, 0.32, to), 0.3);
    else {
      this.osc(c, "sine", 700, 1500, t, 0.05, this.env(c, t, 0.4, 0.002, 0.05, to), 0.03);
      this.hiss(c, t, 0.06, "highpass", 2500, 4000, 0.8, this.env(c, t, 0.25, 0.001, 0.05, to));
    }
    this.bell(c, t + 0.06, pent(this.root + 24, i), 0.2, p * 0.8, 1.1);
  }
  /** the tray is clear: a sparkling run up the scale */
  win() {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.02;
    for (let i = 0; i < 6; i++) this.bell(c, t + i * 0.07, pent(this.root + 24, i * 2), 0.17, (i % 2 ? 0.4 : -0.4), 1.2);
    this.bell(c, t + 0.5, this.root + 36, 0.2, 0, 1.6);
  }
  /** lost: a sad wah-wah slide */
  lost() {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.01;
    const to = this.out!;
    for (let i = 0; i < 2; i++) {
      const f = mtof(this.root + 7 - i * 2);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6;
      lp.frequency.setValueAtTime(400, t + i * 0.32); lp.frequency.linearRampToValueAtTime(1600, t + i * 0.32 + 0.12); lp.frequency.linearRampToValueAtTime(350, t + i * 0.32 + 0.3);
      lp.connect(this.env(c, t + i * 0.32, 0.22, 0.02, i ? 0.6 : 0.3, to));
      this.osc(c, "sawtooth", f, f * (i ? 0.85 : 0.97), t + i * 0.32, i ? 0.62 : 0.32, lp);
    }
  }
  /** a jelly can't move: a soft "nuh-uh" double bump */
  nope(p: number) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.005, to = this.pan(c, p, this.out!);
    this.osc(c, "sine", 180, 150, t, 0.07, this.env(c, t, 0.35, 0.004, 0.06, to));
    this.osc(c, "sine", 170, 130, t + 0.1, 0.09, this.env(c, t + 0.1, 0.3, 0.004, 0.08, to));
  }

  // ---------------------------------------------------------------- tiles and machines
  tile(kind: TileSound, p: number) {
    const c = this.ready(); if (!c) return;
    const t = c.currentTime + 0.005;
    const to = this.pan(c, p, this.out!), wet = this.pan(c, p, this.wet!);
    const r = this.root;
    switch (kind) {
      case "ice":
        this.hiss(c, t, 0.35, "bandpass", 6500, 3000, 6, this.env(c, t, 0.22, 0.02, 0.32, wet));
        this.osc(c, "sine", 2400, 1900, t, 0.25, this.env(c, t, 0.06, 0.004, 0.24, wet));
        break;
      case "mud": {
        const g = this.env(c, t, 0.45, 0.01, 0.3, to);
        const trem = c.createGain(); trem.gain.value = 0.6; trem.connect(g);
        const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 0.4;
        lfo.connect(lg).connect(trem.gain); lfo.start(t); lfo.stop(t + 0.35);
        this.hiss(c, t, 0.3, "bandpass", 420, 180, 4, trem);
        this.osc(c, "sine", 110, 70, t, 0.25, this.env(c, t, 0.2, 0.01, 0.22, to));
        break;
      }
      case "belt": {
        const g = this.env(c, t, 0.12, 0.03, 0.3, to);
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(g);
        this.osc(c, "square", 70, 82, t, 0.33, lp);
        this.hiss(c, t, 0.3, "bandpass", 1800, 2200, 3, this.env(c, t, 0.06, 0.02, 0.28, to));
        break;
      }
      case "tele": {
        const o = this.osc(c, "sine", mtof(r + 19), mtof(r + 43), t, 0.45, this.env(c, t, 0.18, 0.02, 0.43, wet), 0.4);
        const v = c.createOscillator(); v.frequency.value = 14; const vg = c.createGain(); vg.gain.value = 30;
        v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 0.5);
        this.hiss(c, t, 0.4, "highpass", 4000, 8000, 1, this.env(c, t, 0.06, 0.05, 0.35, wet));
        break;
      }
      case "spring": {
        const o = this.osc(c, "sine", 150, 330, t, 0.42, this.env(c, t, 0.35, 0.004, 0.4, to), 0.18);
        const v = c.createOscillator(); v.frequency.value = 13; const vg = c.createGain();
        vg.gain.setValueAtTime(60, t); vg.gain.exponentialRampToValueAtTime(2, t + 0.4);
        v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 0.45);
        break;
      }
      case "bumper":
        this.osc(c, "sine", 160, 55, t, 0.14, this.env(c, t, 0.55, 0.002, 0.13, to), 0.1);
        this.hiss(c, t, 0.03, "bandpass", 3000, 2000, 2, this.env(c, t, 0.2, 0.001, 0.03, to));
        break;
      case "wind":
        this.hiss(c, t, 0.5, "bandpass", 500, 1400, 2.5, this.env(c, t, 0.22, 0.12, 0.38, wet));
        break;
      case "magnet": {
        const g = this.env(c, t, 0.12, 0.02, 0.3, to);
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.25); lp.Q.value = 8; lp.connect(g);
        this.osc(c, "sawtooth", 98, 104, t, 0.32, lp);
        break;
      }
      case "fall":
        this.osc(c, "sine", 1100, 160, t, 0.6, this.env(c, t, 0.18, 0.01, 0.58, wet), 0.55);
        break;
      case "crumble":
        for (let i = 0; i < 5; i++) { const tt = t + i * 0.035 + Math.random() * 0.02; this.hiss(c, tt, 0.05, "bandpass", 900 + Math.random() * 1500, 500, 1.5, this.env(c, tt, 0.3, 0.002, 0.045, to)); }
        break;
      case "glass":
        this.osc(c, "sine", 3100, 3100, t, 0.3, this.env(c, t, 0.12, 0.002, 0.28, wet));
        this.osc(c, "sine", 4350, 4350, t, 0.18, this.env(c, t, 0.07, 0.002, 0.16, wet));
        break;
      case "switch":
        this.osc(c, "square", 1900, 1600, t, 0.012, this.env(c, t, 0.12, 0.001, 0.012, to));
        this.osc(c, "square", 1300, 1100, t + 0.05, 0.012, this.env(c, t + 0.05, 0.1, 0.001, 0.012, to));
        break;
      case "doorOpen": case "doorClose": {
        const up = kind === "doorOpen";
        const g = this.env(c, t, 0.1, 0.02, 0.32, wet);
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 10;
        lp.frequency.setValueAtTime(up ? 3000 : 400, t); lp.frequency.exponentialRampToValueAtTime(up ? 300 : 3000, t + 0.3); lp.connect(g);
        this.osc(c, "sawtooth", up ? 330 : 220, up ? 220 : 330, t, 0.34, lp);
        break;
      }
      case "key": this.bell(c, t, pent(r + 24, 4), 0.2, p); this.bell(c, t + 0.09, pent(r + 24, 7), 0.18, p); break;
      case "coin": this.bell(c, t, pent(r + 29, 3), 0.16, p, 0.5); this.bell(c, t + 0.06, pent(r + 29, 5), 0.16, p, 0.6); break;
      case "star": for (let i = 0; i < 3; i++) this.bell(c, t + i * 0.06, pent(r + 31, i * 2), 0.14, p, 0.8); break;
      case "paint": case "rinse": case "bubble":
        for (let i = 0; i < (kind === "bubble" ? 3 : 4); i++) {
          const tt = t + i * 0.045 + Math.random() * 0.02, f = 500 + Math.random() * 900;
          this.osc(c, "sine", f, f * 1.9, tt, 0.06, this.env(c, tt, 0.16, 0.003, 0.055, to), 0.05);
        }
        break;
      case "split":
        this.hiss(c, t, 0.12, "highpass", 3000, 6000, 1, this.env(c, t, 0.25, 0.002, 0.1, to));
        this.osc(c, "sine", 600, 300, t, 0.12, this.env(c, t, 0.25, 0.003, 0.11, to));
        this.osc(c, "sine", 650, 340, t + 0.04, 0.12, this.env(c, t + 0.04, 0.2, 0.003, 0.11, to));
        break;
      case "shrink": this.osc(c, "sine", 500, 1300, t, 0.22, this.env(c, t, 0.25, 0.005, 0.2, to), 0.2); break;
      case "grow": this.osc(c, "sine", 900, 260, t, 0.28, this.env(c, t, 0.28, 0.005, 0.26, to), 0.26); break;
      case "stone":
        this.osc(c, "sine", 140, 60, t, 0.25, this.env(c, t, 0.45, 0.002, 0.24, to), 0.2);
        this.hiss(c, t, 0.15, "lowpass", 900, 200, 1, this.env(c, t, 0.3, 0.002, 0.14, to));
        break;
      case "eat":
        for (let i = 0; i < 3; i++) this.osc(c, "triangle", 260 - i * 30, 180 - i * 20, t + i * 0.09, 0.06, this.env(c, t + i * 0.09, 0.22, 0.003, 0.06, to));
        break;
      case "spin": case "turn": case "flip": {
        const f0 = kind === "flip" ? 900 : 600;
        this.hiss(c, t, 0.28, "bandpass", f0, f0 * 3, 3, this.env(c, t, 0.24, 0.04, 0.24, to));
        this.osc(c, "sine", mtof(r + 12), mtof(r + 19), t, 0.22, this.env(c, t, 0.08, 0.02, 0.2, wet), 0.2);
        break;
      }
      case "spawn": this.osc(c, "sine", 300, 900, t, 0.14, this.env(c, t, 0.3, 0.004, 0.13, to), 0.1); this.bell(c, t + 0.08, pent(r + 24, 2), 0.1, p, 0.5); break;
      case "thaw": this.hiss(c, t, 0.3, "bandpass", 5000, 2000, 4, this.env(c, t, 0.15, 0.01, 0.28, wet)); this.tile("bubble", p); break;
      case "rewind": this.osc(c, "sawtooth", 900, 200, t, 0.3, this.env(c, t, 0.06, 0.01, 0.28, to), 0.3); break;
      case "wrap": this.osc(c, "sine", mtof(r + 31), mtof(r + 19), t, 0.25, this.env(c, t, 0.15, 0.01, 0.23, wet), 0.25); break;
      case "kranky": this.osc(c, "square", 150, 120, t, 0.2, this.env(c, t, 0.08, 0.005, 0.18, to)); this.osc(c, "square", 120, 95, t + 0.14, 0.24, this.env(c, t + 0.14, 0.08, 0.005, 0.22, to)); break;
    }
  }

  // ---------------------------------------------------------------- world ambience
  /** a quiet looped bed + little seeded events (birds, bubbles, ticks…) for this world's room */
  ambience(kind: PropKind, night = false) {
    if (this.ambKind === kind && this.ambNight === night && this.amb) return;
    this.ambKind = kind; this.ambNight = night;
    this.stopAmbience();
    if (this.build()) this.startAmbience(kind, night);
  }
  private startAmbience(kind: PropKind, night: boolean) {
    const c = this.ctx; if (!c || !this.out || !this.noise || this.disposed) return;
    const bed = c.createGain(); bed.gain.value = 0.0001; bed.connect(this.out);
    bed.gain.setTargetAtTime(this.paused ? 0.0001 : 1, c.currentTime, 0.8);
    const nodes: AudioScheduledSourceNode[] = [];
    const loopNoise = (type: BiquadFilterType, f: number, q: number, gain: number, lfoHz = 0, lfoDepth = 0) => {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.5 + Math.random() * 0.2;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      s.connect(fl).connect(g).connect(bed); s.start(); nodes.push(s);
      if (lfoHz) {
        const l = c.createOscillator(); l.frequency.value = lfoHz; const lg = c.createGain(); lg.gain.value = gain * lfoDepth;
        l.connect(lg).connect(g.gain); l.start(); nodes.push(l);
      }
    };
    const hum = (f: number, gain: number) => {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = gain; o.connect(g).connect(bed); o.start(); nodes.push(o);
    };
    switch (kind) {
      case "kitchen": loopNoise("bandpass", 2200, 0.8, 0.012); break;
      case "bubbles": case "reef": loopNoise("lowpass", 500, 0.7, 0.03, 0.12, 0.5); break;
      case "pirate": loopNoise("lowpass", 700, 0.6, 0.05, 0.11, 0.9); break;
      case "garden": loopNoise("highpass", 5000, 0.5, 0.004); break;
      case "haunted": case "snow": case "desert": case "sky": case "fortress": loopNoise("bandpass", kind === "sky" ? 1500 : 650, 1.6, 0.025, 0.07, 0.8); break;
      case "volcano": loopNoise("lowpass", 160, 0.8, 0.07, 0.2, 0.5); break;
      case "space": case "neon": case "robots": hum(55, 0.012); hum(82.5, 0.006); loopNoise("lowpass", 300, 0.6, 0.01); break;
      default: loopNoise("lowpass", 400, 0.6, 0.008); break;
    }
    if (night) loopNoise("highpass", 6000, 0.7, 0.003);
    this.amb = { kind, bed, nodes, next: 1 + Math.random() * 2, t: 0 };
  }
  private stopAmbience() {
    const a = this.amb; this.amb = null;
    if (!a || !this.ctx) return;
    const now = this.ctx.currentTime;
    a.bed?.gain.setTargetAtTime(0.0001, now, 0.3);
    setTimeout(() => { for (const n of a.nodes) { try { n.stop(); } catch { /* stopped */ } } try { a.bed?.disconnect(); } catch { /* gone */ } }, 1500);
  }
  /** call every frame: little ambience events */
  frame(dt: number) {
    const a = this.amb;
    if (!a || this.paused || !this.ctx || this.ctx.state !== "running") return;
    a.t += dt;
    if (a.t < a.next) return;
    a.t = 0;
    const c = this.ctx, bed = a.bed!, t = c.currentTime + 0.02;
    const p = Math.random() * 1.6 - 0.8;
    const to = this.pan(c, p, bed);
    const r = this.root;
    switch (a.kind) {
      case "kitchen": case "volcano": { // simmer bubbles
        const n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) { const tt = t + i * (0.06 + Math.random() * 0.1), f = a.kind === "volcano" ? 80 + Math.random() * 60 : 300 + Math.random() * 400; this.osc(c, "sine", f, f * 1.8, tt, 0.05, this.env(c, tt, 0.05, 0.003, 0.05, to), 0.04); }
        a.next = 1.5 + Math.random() * 3; break;
      }
      case "bubbles": case "reef": {
        const n = 1 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) { const tt = t + i * 0.09, f = 600 + Math.random() * 1200; this.osc(c, "sine", f, f * 2.2, tt, 0.07, this.env(c, tt, 0.045, 0.003, 0.06, to), 0.06); }
        a.next = 1 + Math.random() * 2.5; break;
      }
      case "garden": case "sky": { // a little bird
        const n = 2 + ((Math.random() * 4) | 0), base = 2600 + Math.random() * 1600;
        for (let i = 0; i < n; i++) { const tt = t + i * 0.11; this.osc(c, "sine", base, base * (1.2 + Math.random() * 0.3), tt, 0.07, this.env(c, tt, 0.03, 0.005, 0.06, to), 0.05); }
        a.next = 3 + Math.random() * 6; break;
      }
      case "clocks": { // tick … tock
        for (let i = 0; i < 4; i++) { const tt = t + i * 0.5; this.osc(c, "square", i % 2 ? 1500 : 2000, 1200, tt, 0.01, this.env(c, tt, 0.02, 0.001, 0.01, to)); }
        a.next = 2; break;
      }
      case "toys": case "music": case "candy": case "icecream": case "art": { // a far music-box note in the key
        this.bell(c, t, pent(r + 24, (Math.random() * 8) | 0), 0.025, p, 1.4);
        a.next = 4 + Math.random() * 6; break;
      }
      case "robots": case "space": case "neon": { // blips
        const n = 1 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) { const tt = t + i * 0.08; this.osc(c, "square", 1200 + Math.random() * 1400, 900, tt, 0.03, this.env(c, tt, 0.012, 0.002, 0.03, to)); }
        a.next = 3 + Math.random() * 5; break;
      }
      case "pirate": case "haunted": case "fortress": { // a creak
        const g = this.env(c, t, 0.025, 0.05, 0.5, to);
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 12; bp.connect(g);
        this.osc(c, "sawtooth", 70, 95, t, 0.55, bp);
        a.next = 6 + Math.random() * 8; break;
      }
      case "snow": case "desert": { // wind chime
        for (let i = 0; i < 3; i++) this.bell(c, t + i * (0.1 + Math.random() * 0.1), pent(r + 31, (Math.random() * 6) | 0), 0.018, p, 1.2);
        a.next = 5 + Math.random() * 6; break;
      }
      default: a.next = 10;
    }
  }

  pause() {
    this.paused = true;
    if (this.amb?.bed && this.ctx) this.amb.bed.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
  }
  resume() {
    this.paused = false;
    if (this.amb?.bed && this.ctx) this.amb.bed.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
  }
  dispose() {
    this.stopAmbience();
    this.disposed = true;
    const o = this.out, w = this.wet;
    setTimeout(() => { try { o?.disconnect(); w?.disconnect(); } catch { /* gone */ } }, 1600);
  }
}
