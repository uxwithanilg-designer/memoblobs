// Rollo Rush sound, synthesised live and placed around the listener (the camera): wind that rushes louder with speed,
// the Curl Ball's rolling rumble, footsteps that change with the ground (grass, boards, water), a waterfall roar as you
// near one, and a world ambience (waves and crickets under the moon, birdsong and breeze at sunrise). Every event has
// its own voice; pearls chime in the music's key and climb the scale while the streak lasts. Runs through the shared
// SFX bus, so the game's volume sliders and mute apply.
import { audio } from "@/lib/audio";
import { cdn } from "@/lib/cdn";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [0, 2, 4, 7, 9];
const pent = (root: number, step: number) => root + PENT[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5);

export type Ground = "grass" | "boards" | "water" | "stone";

export class RushSfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private root = 57;
  private wind: { g: GainNode; f: BiquadFilterNode } | null = null;
  private roll: { g: GainNode; f: BiquadFilterNode; o: OscillatorNode; og: GainNode } | null = null;
  private falls: { g: GainNode } | null = null;
  private amb: { g: GainNode; nodes: AudioScheduledSourceNode[]; night: boolean; next: number } | null = null;
  private ambNight: boolean | null = null;
  private paused = false;
  private disposed = false;
  private stepT = 0;
  private srcs: AudioScheduledSourceNode[] = [];

  setKey(root: number) { this.root = root; }

  // ---------------------------------------------------------------- voiced lines (loaded when first needed)
  private vbuf = new Map<string, Promise<AudioBuffer | null>>();
  private speaking: AudioBufferSourceNode[] = [];
  loadVoice(id: string) {
    let p = this.vbuf.get(id);
    if (!p) {
      const c = audio.ensure();
      p = !c ? Promise.resolve(null) : fetch(cdn(`/games/rollo-rush/voice/${id}.wav`)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("voice")))).then((b) => c.decodeAudioData(b)).catch(() => null);
      this.vbuf.set(id, p);
    }
    return p;
  }
  preloadVoices(ids: string[]) { for (const id of ids) void this.loadVoice(id); }
  /** speak a line (the music dips under it); resolves false if it could not play */
  async voice(id: string, gain = 1, pan = 0) {
    const b = await this.loadVoice(id);
    const c = this.ready();
    if (!c || !b || this.paused) return false;
    const s = c.createBufferSource(); s.buffer = b;
    const g = c.createGain(); g.gain.value = gain * 1.25;
    s.connect(g).connect(this.pan(c, pan, this.out!));
    s.start(); this.speaking.push(s); s.onended = () => { this.speaking = this.speaking.filter((x) => x !== s); };
    audio.duckFor(b.duration, 0.38);
    return true;
  }
  stopVoices() { for (const s of this.speaking) { try { s.stop(); } catch { /* done */ } } this.speaking = []; }

  // ---------------------------------------------------------------- the witch and the cinematic
  /** a horror sting: a low brass cluster, a scrape and a crash */
  sting() { const c = this.ready(); if (!c) return; const t = c.currentTime; [0, 1, 6].forEach((k) => this.osc(c, "sawtooth", mtof(this.root - 24 + k), mtof(this.root - 26 + k), t, 1.6, this.env(c, t, 0.12, 0.01, 1.5, this.wet!), 1.6)); this.hiss(c, t, 1.4, "bandpass", 3000, 600, 1.5, this.env(c, t, 0.3, 0.005, 1.3, this.wet!)); this.osc(c, "sine", 70, 30, t, 1.2, this.env(c, t, 0.5, 0.005, 1.1, this.out!)); }
  thunder() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 2.4, "lowpass", 900, 120, 0.7, this.env(c, t, 0.5, 0.01, 2.3, this.wet!)); this.hiss(c, t + 0.05, 0.4, "highpass", 2500, 4000, 0.7, this.env(c, t + 0.05, 0.25, 0.002, 0.35, this.out!)); this.osc(c, "sine", 55, 32, t, 1.8, this.env(c, t, 0.4, 0.02, 1.7, this.out!)); }
  whoosh(p = 0, long = false) { const c = this.ready(); if (!c) return; const t = c.currentTime, d = long ? 1.4 : 0.6; const s = c.createStereoPanner(); s.pan.setValueAtTime(-p, t); s.pan.linearRampToValueAtTime(p, t + d); s.connect(this.out!); this.hiss(c, t, d, "bandpass", 300, 2600, 1.4, this.env(c, t, 0.35, d * 0.4, d * 0.6, s)); }
  /** her magic leaves her hands */
  cast(kind: string, p = 0) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.wet!); const hi = kind === "ice" || kind === "light" || kind === "star" ? 1.6 : kind === "stone" || kind === "shadow" ? 0.6 : 1; this.osc(c, "triangle", 900 * hi, 300 * hi, t, 0.45, this.env(c, t, 0.12, 0.01, 0.42, to)); this.hiss(c, t, 0.5, "bandpass", 1800 * hi, 500, 1.2, this.env(c, t, 0.22, 0.01, 0.45, to)); }
  /** it lands: fire whumps, ice shatters, liquid splats, lightning cracks */
  burstFx(kind: string, p = 0) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); if (kind === "lightning" || kind === "light") { this.hiss(c, t, 0.25, "highpass", 3000, 6000, 0.8, this.env(c, t, 0.3, 0.001, 0.22, to)); return; } if (kind === "ice" || kind === "star") { for (let i = 0; i < 4; i++) this.osc(c, "sine", 2400 + i * 700, 1800, t + i * 0.03, 0.15, this.env(c, t + i * 0.03, 0.08, 0.001, 0.14, to)); return; } if (kind === "poison" || kind === "water") { this.hiss(c, t, 0.35, "lowpass", 1400, 300, 2, this.env(c, t, 0.3, 0.005, 0.32, to)); return; } this.osc(c, "sine", 140, 45, t, 0.4, this.env(c, t, 0.4, 0.002, 0.38, to)); this.hiss(c, t, 0.4, "lowpass", 1800, 300, 0.9, this.env(c, t, 0.25, 0.002, 0.38, to)); }
  /** a ghostly wail on the wind */
  wail() { const c = this.ready(); if (!c) return; const t = c.currentTime; const o = this.osc(c, "sine", 520, 380, t, 2.4, this.env(c, t, 0.08, 0.6, 1.8, this.wet!), 2.4); const v = c.createOscillator(); v.frequency.value = 5; const vg = c.createGain(); vg.gain.value = 18; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 2.5); }

  private ready(): AudioContext | null {
    if (this.disposed) return null;
    if (!this.ctx) {
      const c = audio.ensure(), dest = audio.sfxOut;
      if (!c || !dest) return null;
      this.ctx = c;
      this.out = c.createGain(); this.out.gain.value = 0.95; this.out.connect(dest);
      this.wet = c.createGain(); this.wet.gain.value = 0.5; this.wet.connect(this.out);
      const ro = audio.reverbOut; if (ro) this.wet.connect(ro);
      const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); let b = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2; }
      this.loops();
      if (this.ambNight !== null) this.ambience(this.ambNight);
    }
    return this.ctx.state === "running" ? this.ctx : null;
  }
  private loops() {
    const c = this.ctx!, o = this.out!;
    const src = (rate = 1) => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = rate; s.start(); this.srcs.push(s); return s; };
    { const s = src(1.4), f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.7; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(o); this.wind = { g, f }; }
    { const s = src(0.6), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(o); const osc = c.createOscillator(); osc.type = "triangle"; osc.frequency.value = 50; const og = c.createGain(); og.gain.value = 0; osc.connect(og).connect(o); osc.start(); this.srcs.push(osc); this.roll = { g, f, o: osc, og }; }
    { const s = src(1), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1200; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.wet!); this.falls = { g }; }
  }
  // ---------------------------------------------------------------- tiny synth helpers
  private pan(c: AudioContext, p: number, to: AudioNode) { const s = c.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); s.connect(to); return s; }
  private env(c: AudioContext, t: number, peak: number, a: number, d: number, to: AudioNode) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(to); return g; }
  private osc(c: AudioContext, type: OscillatorType, f0: number, f1: number, t: number, dur: number, to: AudioNode, glide = dur) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide); o.connect(to); o.start(t); o.stop(t + dur + 0.05); return o; }
  private hiss(c: AudioContext, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, to: AudioNode) { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); s.connect(f).connect(to); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  private bell(c: AudioContext, t: number, m: number, peak: number, p: number, dur = 0.8) { const to = this.pan(c, p, this.wet!), f = mtof(m); this.osc(c, "sine", f, f, t, dur, this.env(c, t, peak, 0.004, dur, to)); this.osc(c, "sine", f * 2.76, f * 2.76, t, dur * 0.35, this.env(c, t, peak * 0.25, 0.002, dur * 0.35, to)); this.osc(c, "triangle", f * 2, f * 2, t, dur * 0.25, this.env(c, t, peak * 0.12, 0.002, dur * 0.25, to)); }

  // ---------------------------------------------------------------- continuous, per frame
  update(o: { speed: number; run: number; air: boolean; ball: boolean; ground: Ground; fallsNear: number; dt: number; phase: number; moving: boolean }) {
    if (!this.ready() || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, live = !this.paused && o.moving;
    const fast = Math.max(0, o.speed - o.run * 0.8);
    if (this.wind) { this.wind.g.gain.setTargetAtTime(live ? Math.min(0.32, 0.03 + fast * 0.016 + (o.air ? 0.08 : 0)) : 0, t, 0.08); this.wind.f.frequency.setTargetAtTime(500 + o.speed * 55, t, 0.1); }
    if (this.roll) { const on = live && o.ball && !o.air ? 1 : 0; this.roll.g.gain.setTargetAtTime(on * (0.12 + o.speed * 0.012), t, 0.05); this.roll.f.frequency.setTargetAtTime(200 + o.speed * 30, t, 0.1); this.roll.og.gain.setTargetAtTime(on * 0.07, t, 0.06); this.roll.o.frequency.setTargetAtTime(40 + o.speed * 2.5, t, 0.1); }
    if (this.falls) this.falls.g.gain.setTargetAtTime(live ? Math.min(0.5, o.fallsNear * 0.5) : 0, t, 0.2);
    // footsteps from the run cycle
    if (live && !o.air && !o.ball) {
      const k = Math.floor(o.phase);
      if (k !== this.stepT) { this.stepT = k; this.step(o.ground, k % 2 ? 0.25 : -0.25, o.speed); }
    }
    this.ambFrame(o.dt);
  }
  private step(g: Ground, p: number, v: number) {
    const c = this.ctx!, t = c.currentTime, to = this.pan(c, p, this.out!), k = Math.min(1, v / 20);
    if (g === "water") { this.hiss(c, t, 0.09, "bandpass", 1800, 900, 2, this.env(c, t, 0.14, 0.003, 0.08, to)); return; }
    if (g === "boards") { this.osc(c, "triangle", 210, 150, t, 0.06, this.env(c, t, 0.12, 0.002, 0.05, to)); this.hiss(c, t, 0.03, "bandpass", 1200, 800, 3, this.env(c, t, 0.05, 0.001, 0.03, to)); return; }
    this.osc(c, "sine", 120, 70, t, 0.06, this.env(c, t, 0.12 * (0.6 + k), 0.002, 0.05, to));
    this.hiss(c, t, 0.05, "highpass", 3000 + Math.random() * 1500, 2500, 0.8, this.env(c, t, 0.05 * (0.5 + k), 0.002, 0.045, to));
  }

  // ---------------------------------------------------------------- world ambience
  ambience(night: boolean) {
    this.ambNight = night;
    if (!this.ctx || !this.out || !this.noise) return;
    if (this.amb && this.amb.night === night) return;
    this.stopAmb();
    const c = this.ctx, g = c.createGain(); g.gain.value = 0.0001; g.connect(this.out);
    g.gain.setTargetAtTime(1, c.currentTime, 1);
    const nodes: AudioScheduledSourceNode[] = [];
    // waves on the shore (night coast) or a soft breeze (morning)
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.5;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = night ? 520 : 900;
    const wg = c.createGain(); wg.gain.value = night ? 0.06 : 0.025;
    const lfo = c.createOscillator(); lfo.frequency.value = night ? 0.13 : 0.07; const lg = c.createGain(); lg.gain.value = night ? 0.05 : 0.015;
    lfo.connect(lg).connect(wg.gain); s.connect(f).connect(wg).connect(g); s.start(); lfo.start(); nodes.push(s, lfo);
    this.amb = { g, nodes, night, next: 1 };
  }
  private stopAmb() { const a = this.amb; this.amb = null; if (!a || !this.ctx) return; a.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3); setTimeout(() => { for (const n of a.nodes) try { n.stop(); } catch { /* done */ } try { a.g.disconnect(); } catch { /* gone */ } }, 1500); }
  private ambFrame(dt: number) {
    const a = this.amb; if (!a || this.paused || !this.ctx) return;
    a.next -= dt; if (a.next > 0) return;
    const c = this.ctx, t = c.currentTime + 0.02, p = Math.random() * 1.6 - 0.8, to = this.pan(c, p, a.g);
    if (a.night) {
      // crickets: quick high chirps in pairs
      const f = 4200 + Math.random() * 900;
      for (let i = 0; i < 3; i++) this.osc(c, "sine", f, f, t + i * 0.05, 0.03, this.env(c, t + i * 0.05, 0.012, 0.003, 0.03, to));
      a.next = 0.6 + Math.random() * 1.6;
    } else {
      const base = 2600 + Math.random() * 1500, n = 2 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) { const tt = t + i * 0.11; this.osc(c, "sine", base, base * (1.2 + Math.random() * 0.3), tt, 0.08, this.env(c, tt, 0.025, 0.004, 0.07, to), 0.06); }
      a.next = 1.5 + Math.random() * 3.5;
    }
  }

  // ---------------------------------------------------------------- events
  pearl(streak: number, p: number) { const c = this.ready(); if (!c) return; this.bell(c, c.currentTime + 0.005, pent(this.root + 24, Math.min(14, streak % 15)), 0.15, p * 0.7, 0.6); }
  bigPearl(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime; [0, 4, 7, 12].forEach((k, i) => this.bell(c, t + i * 0.05, this.root + 24 + k, 0.14, p, 0.9)); }
  medal(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 6; i++) this.bell(c, t + i * 0.06, pent(this.root + 29, i * 2), 0.13, p + (i % 2 ? 0.3 : -0.3), 1); }
  jump(double: boolean) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.out!; this.osc(c, "sine", double ? 520 : 330, double ? 1100 : 760, t, 0.16, this.env(c, t, 0.18, 0.005, 0.15, to), 0.14); this.hiss(c, t, 0.12, "bandpass", 1200, 3000, 1.5, this.env(c, t, 0.06, 0.01, 0.1, to)); }
  land(vh: number, g: Ground) { const c = this.ready(); if (!c) return; const t = c.currentTime, k = Math.min(1, -vh / 20); if (g === "water") { this.hiss(c, t, 0.25, "bandpass", 1400, 500, 1.2, this.env(c, t, 0.22 * k + 0.05, 0.005, 0.22, this.out!)); return; } this.osc(c, "sine", 140, 55, t, 0.16, this.env(c, t, 0.3 * k + 0.08, 0.002, 0.15, this.out!), 0.12); this.hiss(c, t, 0.08, "lowpass", 1500, 400, 0.8, this.env(c, t, 0.1 * k, 0.002, 0.07, this.out!)); }
  curl(on: boolean) { const c = this.ready(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 4; i++) { const tt = t + i * 0.025 * (on ? 1 : 0.6); this.osc(c, "square", on ? 1800 - i * 200 : 1000 + i * 200, 900, tt, 0.012, this.env(c, tt, 0.04, 0.001, 0.012, this.out!)); } }
  pad(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); this.hiss(c, t, 0.45, "bandpass", 500, 4200, 2, this.env(c, t, 0.25, 0.02, 0.42, to)); this.osc(c, "sawtooth", 220, 880, t, 0.3, this.env(c, t, 0.05, 0.01, 0.28, to), 0.28); }
  spring(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); const o = this.osc(c, "sine", 160, 420, t, 0.45, this.env(c, t, 0.32, 0.004, 0.42, to), 0.2); const v = c.createOscillator(); v.frequency.value = 14; const vg = c.createGain(); vg.gain.setValueAtTime(70, t); vg.gain.exponentialRampToValueAtTime(2, t + 0.45); v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 0.5); }
  hit() { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.out!; this.osc(c, "square", 420, 120, t, 0.25, this.env(c, t, 0.12, 0.002, 0.24, to), 0.2); this.osc(c, "sine", 90, 40, t, 0.3, this.env(c, t, 0.4, 0.002, 0.28, to)); this.hiss(c, t, 0.2, "bandpass", 3000, 1200, 2, this.env(c, t, 0.15, 0.002, 0.18, to)); }
  smash(p: number, wood: boolean) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); if (wood) { for (let i = 0; i < 5; i++) { const tt = t + i * 0.025 + Math.random() * 0.02; this.hiss(c, tt, 0.06, "bandpass", 700 + Math.random() * 1500, 400, 1.6, this.env(c, tt, 0.28, 0.002, 0.05, to)); } } else this.bonk(p); }
  bonk(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); this.osc(c, "triangle", 1250, 1100, t, 0.25, this.env(c, t, 0.16, 0.002, 0.24, to)); this.osc(c, "triangle", 1880, 1700, t, 0.18, this.env(c, t, 0.1, 0.002, 0.16, to)); this.osc(c, "sine", 300, 900, t + 0.05, 0.25, this.env(c, t + 0.05, 0.12, 0.004, 0.22, to), 0.2); }
  fall() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "sine", 1100, 160, t, 0.7, this.env(c, t, 0.16, 0.01, 0.68, this.wet!), 0.65); }
  respawn() { const c = this.ready(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 4; i++) this.bell(c, t + i * 0.05, pent(this.root + 24, i * 2 + 2), 0.1, 0, 0.6); }
  check() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.bell(c, t, this.root + 31, 0.2, 0, 1.2); this.bell(c, t + 0.18, this.root + 24, 0.2, 0, 1.4); }
  goal() { const c = this.ready(); if (!c) return; const t = c.currentTime; [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => this.bell(c, t + i * 0.07, this.root + 19 + k, 0.17, i % 2 ? 0.4 : -0.4, 1.3)); this.bell(c, t + 0.6, this.root + 43, 0.2, 0, 2); }
  gate(ok: boolean) { const c = this.ready(); if (!c) return; const t = c.currentTime; if (ok) { this.bell(c, t, this.root + 28, 0.18, 0, 0.8); this.bell(c, t + 0.1, this.root + 35, 0.18, 0, 1); } else { this.osc(c, "sawtooth", 180, 140, t, 0.35, this.env(c, t, 0.1, 0.005, 0.33, this.out!)); } }
  turbo() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 0.6, "bandpass", 400, 3500, 1.4, this.env(c, t, 0.24, 0.05, 0.55, this.out!)); this.osc(c, "sawtooth", 110, 330, t, 0.5, this.env(c, t, 0.04, 0.05, 0.45, this.out!), 0.5); }
  trick(n: number) { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 0.25, "bandpass", 800, 2500, 2, this.env(c, t, 0.12, 0.02, 0.22, this.out!)); this.bell(c, t + 0.05, pent(this.root + 24, n * 2 + 3), 0.14, 0, 0.6); }
  magnet() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "sine", 220, 440, t, 0.5, this.env(c, t, 0.1, 0.05, 0.45, this.wet!), 0.5); }
  // ---- Phases 2–3: pickups, powers, rails, Star Hops, dashes, pounds, guards, teleports, launches, switches, gates…
  item(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime; [0, 7, 12].forEach((k, i) => this.bell(c, t + i * 0.06, this.root + 26 + k, 0.15, p, 0.8)); }
  power() { const c = this.ready(); if (!c) return; const t = c.currentTime; [0, 4, 7, 11, 14].forEach((k, i) => this.bell(c, t + i * 0.05, this.root + 24 + k, 0.13, i % 2 ? 0.5 : -0.5, 1)); this.hiss(c, t, 0.5, "bandpass", 600, 4000, 1.4, this.env(c, t, 0.12, 0.05, 0.4, this.out!)); }
  rail(on: boolean) { const c = this.ready(); if (!c) return; const t = c.currentTime; if (on) { this.osc(c, "square", 2400, 2200, t, 0.08, this.env(c, t, 0.05, 0.001, 0.07, this.out!)); this.hiss(c, t, 0.35, "highpass", 3000, 5000, 1, this.env(c, t, 0.08, 0.01, 0.3, this.out!)); } else this.osc(c, "triangle", 900, 600, t, 0.12, this.env(c, t, 0.06, 0.002, 0.1, this.out!)); }
  hop() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "sine", 600, 1600, t, 0.16, this.env(c, t, 0.14, 0.004, 0.15, this.out!)); this.bell(c, t + 0.08, this.root + 31, 0.12, 0, 0.5); }
  dash() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 0.3, "bandpass", 1500, 600, 1.5, this.env(c, t, 0.2, 0.005, 0.28, this.out!)); }
  pound() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "sine", 120, 40, t, 0.35, this.env(c, t, 0.45, 0.002, 0.33, this.out!)); this.hiss(c, t, 0.2, "lowpass", 900, 200, 1, this.env(c, t, 0.25, 0.002, 0.18, this.out!)); }
  guard() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "triangle", 1500, 2400, t, 0.2, this.env(c, t, 0.12, 0.002, 0.18, this.out!)); this.bell(c, t + 0.02, this.root + 36, 0.12, 0, 0.6); }
  tele() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "sine", 300, 1800, t, 0.4, this.env(c, t, 0.12, 0.01, 0.38, this.wet!), 0.4); this.osc(c, "sine", 1800, 300, t + 0.2, 0.3, this.env(c, t + 0.2, 0.08, 0.01, 0.28, this.wet!), 0.3); }
  launch(p: number) { const c = this.ready(); if (!c) return; const t = c.currentTime, to = this.pan(c, p, this.out!); this.osc(c, "sine", 90, 50, t, 0.25, this.env(c, t, 0.4, 0.002, 0.24, to)); this.hiss(c, t, 0.5, "bandpass", 300, 2600, 1.2, this.env(c, t, 0.3, 0.01, 0.45, to)); }
  switchOn() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "square", 800, 800, t, 0.05, this.env(c, t, 0.06, 0.001, 0.04, this.out!)); this.bell(c, t + 0.06, this.root + 31, 0.14, 0, 0.6); }
  open() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 0.6, "lowpass", 500, 2000, 0.8, this.env(c, t, 0.2, 0.05, 0.5, this.out!)); this.bell(c, t + 0.2, this.root + 28, 0.16, 0, 1); }
  fail() { const c = this.ready(); if (!c) return; const t = c.currentTime; [7, 4, 0].forEach((k, i) => this.osc(c, "triangle", 440 * Math.pow(2, (k - 12) / 12) * 2, 440 * Math.pow(2, (k - 12) / 12) * 2, t + i * 0.12, 0.12, this.env(c, t + i * 0.12, 0.12, 0.005, 0.11, this.out!))); }
  hoop() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.hiss(c, t, 0.3, "bandpass", 2000, 4000, 2, this.env(c, t, 0.1, 0.01, 0.28, this.out!)); this.bell(c, t, this.root + 33, 0.13, 0, 0.6); }
  wiggle() { const c = this.ready(); if (!c) return; const t = c.currentTime; this.osc(c, "triangle", 500, 700, t, 0.08, this.env(c, t, 0.08, 0.002, 0.07, this.out!)); }
  loop() { const c = this.ready(); if (!c) return; const t = c.currentTime; const s = c.createStereoPanner(); s.pan.setValueAtTime(-1, t); s.pan.linearRampToValueAtTime(1, t + 0.9); s.connect(this.out!); this.hiss(c, t, 1, "bandpass", 600, 2200, 1.2, this.env(c, t, 0.22, 0.2, 0.8, s)); }
  boss(what: string) {
    const c = this.ready(); if (!c) return; const t = c.currentTime, o = this.out!;
    if (what === "attack") { this.osc(c, "sawtooth", 90, 160, t, 0.35, this.env(c, t, 0.08, 0.02, 0.32, o)); this.hiss(c, t, 0.3, "bandpass", 300, 900, 3, this.env(c, t, 0.1, 0.02, 0.28, o)); }
    else if (what === "tired") { this.osc(c, "sawtooth", 300, 60, t, 0.9, this.env(c, t, 0.1, 0.02, 0.85, o), 0.85); }
    else if (what === "hit") { this.osc(c, "square", 300, 80, t, 0.4, this.env(c, t, 0.18, 0.002, 0.38, o)); this.bonk(0); this.hiss(c, t, 0.4, "lowpass", 2000, 300, 1, this.env(c, t, 0.3, 0.002, 0.38, o)); }
    else if (what === "down") { this.hiss(c, t, 1.4, "lowpass", 1800, 120, 0.8, this.env(c, t, 0.5, 0.005, 1.35, o)); this.osc(c, "sine", 80, 30, t, 1.2, this.env(c, t, 0.5, 0.005, 1.15, o)); setTimeout(() => this.goal(), 600); }
  }
  pause() { this.paused = true; this.amb?.g.gain.setTargetAtTime(0.0001, this.ctx?.currentTime ?? 0, 0.15); }
  resume() { this.paused = false; if (this.ctx) this.amb?.g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.3); }
  dispose() {
    this.disposed = true; this.stopAmb();
    const t = this.ctx?.currentTime ?? 0;
    this.wind?.g.gain.setTargetAtTime(0, t, 0.05); this.roll?.g.gain.setTargetAtTime(0, t, 0.05); this.roll?.og.gain.setTargetAtTime(0, t, 0.05); this.falls?.g.gain.setTargetAtTime(0, t, 0.05);
    const o = this.out, srcs = this.srcs; setTimeout(() => { for (const x of srcs) { try { x.stop(); } catch { /* done */ } } try { o?.disconnect(); } catch { /* gone */ } }, 400);
  }
}
