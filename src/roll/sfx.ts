// Spatial sound for Momo Sky Roll, synthesised live. The Web Audio listener sits on the camera, so hazards whoosh
// past your left/right ear (HRTF 3D panning on headphones), beads chime in the song's key and climb a scale as
// you chain them, and each mood surrounds you with its own ambience (birds, bees, drips, crickets, wind).
import { audio, type Sound } from "@/lib/audio";
import type * as THREE from "three";
import { malletHead, daisyAngle } from "./hazards";
import type { Ambience } from "./themes";
import type { Hazard } from "./types";

const PENT = [0, 2, 4, 7, 9];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Voice { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode; p: PannerNode; h: Hazard | null }

export class RollSfx {
  private ctx: AudioContext | null;
  private out: GainNode | null = null;
  private rev: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private roll: { g: GainNode; lp: BiquadFilterNode; o: OscillatorNode; og: GainNode; src: AudioBufferSourceNode } | null = null;
  private wind: { g: GainNode; bp: BiquadFilterNode; src: AudioBufferSourceNode } | null = null;
  private voices: Voice[] = [];
  private hrtf: boolean;
  private ambT = 0;
  private beadCombo = 0;
  private beadT = 0;
  private root: number;
  private disposed = false;
  private head = { x: 0, y: 0 };

  constructor(root: number, quality: "low" | "medium" | "high") {
    this.root = root;
    this.hrtf = quality !== "low";
    this.ctx = audio.ensure();
    const c = this.ctx;
    const dest = audio.sfxOut;
    if (!c || !dest) return;
    this.out = c.createGain(); this.out.gain.value = 1; this.out.connect(dest);
    this.rev = c.createGain(); this.rev.gain.value = 0.3; this.out.connect(this.rev);
    const ro = audio.reverbOut; if (ro) this.rev.connect(ro);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
    // rolling rumble: brownish noise through a speed-tracking low-pass + a soft sub tone
    {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; lp.Q.value = 0.8;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(lp); lp.connect(g); g.connect(this.out);
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = 52;
      const og = c.createGain(); og.gain.value = 0; o.connect(og); og.connect(this.out);
      src.start(); o.start();
      this.roll = { g, lp, o, og, src };
    }
    // air rushing past (boosts, jumps)
    {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 1.3;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(this.out);
      src.start();
      this.wind = { g, bp, src };
    }
    // 4 moving whoosh voices for the nearest hazards
    for (let i = 0; i < 4; i++) {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = 1.1 + i * 0.07;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 1.4;
      const g = c.createGain(); g.gain.value = 0;
      const p = this.panner();
      src.connect(bp); bp.connect(g); g.connect(p); p.connect(this.out);
      src.start();
      this.voices.push({ src, bp, g, p, h: null });
    }
  }

  private panner() {
    const c = this.ctx!;
    const p = c.createPanner();
    p.panningModel = this.hrtf ? "HRTF" : "equalpower";
    p.distanceModel = "inverse"; p.refDistance = 2.2; p.rolloffFactor = 1.1; p.maxDistance = 80;
    return p;
  }
  private setPos(p: PannerNode, x: number, y: number, z: number) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }

  /** one-shot routed to a 3D position (or straight to the bus) */
  private dest(pos?: { x: number; y: number; z: number }): AudioNode {
    if (!pos || !this.ctx) return this.out!;
    const p = this.panner();
    this.setPos(p, pos.x, pos.y, pos.z);
    p.connect(this.out!);
    return p;
  }
  private g(dest: AudioNode) { const g = this.ctx!.createGain(); g.connect(dest); return g; }
  private env(g: GainNode, t: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  private o(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode) {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  private n(t: number, dur: number, dest: AudioNode, rate = 1) {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate; s.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05); return s;
  }
  private f(type: BiquadFilterType, freq: number, q: number, dest: AudioNode) { const f = this.ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(dest); return f; }
  private get ok() { return !!this.ctx && !!this.out && !this.disposed && !audio.isMuted; }
  private get now() { return this.ctx!.currentTime; }

  // ---------------------------------------------------------------- per frame
  update(o: {
    camera: THREE.PerspectiveCamera; rolling: boolean; speed: number; air: boolean; boost: number;
    ballX: number; s: number; beat: number; hazards: Hazard[]; ambience: Ambience; dt: number; paused: boolean;
  }) {
    if (!this.ctx || !this.out || this.disposed) return;
    const c = this.ctx, t = c.currentTime;
    // listener = camera
    const cam = o.camera;
    const l = c.listener;
    const fwd = { x: 0, y: 0, z: -1 };
    const e = cam.matrixWorld.elements;
    fwd.x = -e[8]; fwd.y = -e[9]; fwd.z = -e[10];
    if (l.positionX) {
      l.positionX.value = cam.position.x; l.positionY.value = cam.position.y; l.positionZ.value = cam.position.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(cam.position.x, cam.position.y, cam.position.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }

    const live = !o.paused;
    if (this.roll) {
      const on = live && o.rolling ? 1 : 0;
      this.roll.g.gain.setTargetAtTime(on * (0.1 + o.speed * 0.025), t, 0.05);
      this.roll.lp.frequency.setTargetAtTime(220 + o.speed * 70, t, 0.1);
      this.roll.og.gain.setTargetAtTime(on * 0.05, t, 0.08);
      this.roll.o.frequency.setTargetAtTime(44 + o.speed * 3.5, t, 0.1);
    }
    if (this.wind) {
      const w = live ? Math.min(0.32, (o.air ? 0.12 : 0) + o.boost * 0.22 + Math.max(0, o.speed - 4) * 0.012) : 0;
      this.wind.g.gain.setTargetAtTime(w, t, 0.12);
      this.wind.bp.frequency.setTargetAtTime(900 + o.speed * 160 + o.boost * 1200, t, 0.15);
    }
    // nearest moving hazards get a whoosh voice that follows them in 3D
    const near = o.hazards.filter((h) => h.kind !== "claw" && h.s > o.s - 3 && h.s < o.s + 16).slice(0, this.voices.length);
    this.voices.forEach((v, i) => {
      const h = near[i] ?? null;
      v.h = h;
      if (!h || !live) { v.g.gain.setTargetAtTime(0, t, 0.08); return; }
      let x = h.x, y = 0.4, speed = 0;
      if (h.kind === "mallet") {
        malletHead(h, o.beat, this.head);
        const p = { x: this.head.x, y: this.head.y };
        malletHead(h, o.beat + 0.03, this.head);
        speed = Math.hypot(this.head.x - p.x, this.head.y - p.y) / (0.03 * 60 / 120);
        x = p.x; y = p.y;
      } else {
        const a = daisyAngle(h, o.beat);
        x = h.x + Math.cos(a) * h.size * 0.7; speed = (2 * Math.PI * h.size) / Math.max(0.5, h.period * 0.5);
      }
      this.setPos(v.p, x, y, -h.s);
      const dist = Math.abs(h.s - o.s);
      v.g.gain.setTargetAtTime(Math.min(0.5, speed * 0.04) * (dist < 12 ? 1 : 0.4), t, 0.05);
      v.bp.frequency.setTargetAtTime(300 + speed * 90, t, 0.05);
    });
    // ambience around you
    if (live) {
      this.ambT -= o.dt;
      if (this.ambT <= 0) { this.ambience(o.ambience, cam.position, o.s); }
    }
    if (this.beadT > 0) { this.beadT -= o.dt; if (this.beadT <= 0) this.beadCombo = 0; }
  }

  private ambience(kind: Ambience, cam: THREE.Vector3, s: number) {
    if (!this.ok) { this.ambT = 1; return; }
    const R = Math.random;
    const t = this.now;
    const pos = { x: cam.x + (R() - 0.5) * 18, y: 1 + R() * 5, z: -s + (R() - 0.3) * -16 };
    const d = this.dest(pos);
    switch (kind) {
      case "birds": {
        this.ambT = 0.7 + R() * 1.8;
        const base = 2400 + R() * 1600, n = 2 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
          const tt = t + i * (0.09 + R() * 0.05);
          const g = this.g(d); const o = this.o("sine", base, tt, 0.12, g);
          o.frequency.exponentialRampToValueAtTime(base * (1.25 + R() * 0.4), tt + 0.06);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, tt + 0.1);
          this.env(g, tt, 0.05, 0.01, 0.09);
        }
        break;
      }
      case "bees": {
        this.ambT = 1.6 + R() * 2;
        const g = this.g(d); const lp = this.f("lowpass", 900, 2, g);
        const o = this.o("sawtooth", 170 + R() * 60, t, 1.4, lp);
        const lfo = this.ctx!.createOscillator(); lfo.frequency.value = 9 + R() * 6; const lg = this.ctx!.createGain(); lg.gain.value = 12;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.45);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
        break;
      }
      case "drips": {
        this.ambT = 0.5 + R() * 1.4;
        const g = this.g(d); const o = this.o("sine", 1100 + R() * 600, t, 0.12, g);
        o.frequency.exponentialRampToValueAtTime(380, t + 0.09);
        this.env(g, t, 0.06, 0.003, 0.1);
        break;
      }
      case "breeze": {
        this.ambT = 2.2 + R() * 2;
        const g = this.g(d); const bp = this.f("bandpass", 500, 0.7, g); this.n(t, 2.4, bp, 0.6);
        bp.frequency.setValueAtTime(350, t); bp.frequency.linearRampToValueAtTime(900, t + 1.2); bp.frequency.linearRampToValueAtTime(400, t + 2.3);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1); g.gain.linearRampToValueAtTime(0.0001, t + 2.3);
        break;
      }
      case "crickets": {
        this.ambT = 0.35 + R() * 0.8;
        const g = this.g(d); const o = this.o("sine", 4300 + R() * 600, t, 0.35, g);
        void o;
        g.gain.setValueAtTime(0.0001, t);
        for (let i = 0; i < 6; i++) { g.gain.setValueAtTime(0.03, t + i * 0.045); g.gain.setValueAtTime(0.0001, t + i * 0.045 + 0.022); }
        break;
      }
      case "storm": {
        this.ambT = 2.5 + R() * 3;
        const g = this.g(d); const lp = this.f("lowpass", 180, 0.8, g); this.n(t, 2.6, lp, 0.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        break;
      }
      case "waves": case "wind": {
        this.ambT = 2.4 + R() * 1.8;
        const g = this.g(d); const bp = this.f(kind === "waves" ? "lowpass" : "bandpass", kind === "waves" ? 700 : 600, 0.6, g); this.n(t, 2.8, bp, kind === "waves" ? 0.7 : 0.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(kind === "waves" ? 0.09 : 0.06, t + 1.1); g.gain.linearRampToValueAtTime(0.0001, t + 2.7);
        break;
      }
      case "hum": {
        this.ambT = 1.6 + R() * 2;
        const g = this.g(d); const o = this.o("sawtooth", 60 + R() * 40, t, 1.5, this.f("lowpass", 320, 3, g));
        o.frequency.linearRampToValueAtTime(70 + R() * 50, t + 1.4);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
        break;
      }
      case "crowd": {
        this.ambT = 2 + R() * 2;
        const g = this.g(d); const bp = this.f("bandpass", 1100, 0.5, g); this.n(t, 1.8, bp, 0.9);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
        break;
      }
      case "chimes": {
        this.ambT = 0.9 + R() * 1.6;
        const f0 = mtof(this.root + 24 + PENT[Math.floor(R() * 5)]);
        const g = this.g(d); this.o("sine", f0, t, 1.4, g); this.env(g, t, 0.05, 0.004, 1.3);
        const g2 = this.g(d); this.o("sine", f0 * 2.76, t, 0.6, g2); this.env(g2, t, 0.015, 0.003, 0.5);
        break;
      }
      case "bubbles": {
        this.ambT = 0.4 + R() * 0.9;
        const g = this.g(d); const o = this.o("sine", 300 + R() * 300, t, 0.12, g); o.frequency.exponentialRampToValueAtTime(900 + R() * 600, t + 0.08);
        this.env(g, t, 0.05, 0.004, 0.09);
        break;
      }
      case "crackle": {
        this.ambT = 0.25 + R() * 0.6;
        const g = this.g(d); const hp = this.f("highpass", 2500, 0.7, g); this.n(t, 0.05, hp, 1.4); this.env(g, t, 0.06 * R() + 0.02, 0.001, 0.03);
        break;
      }
      case "owls": {
        this.ambT = 2.5 + R() * 3;
        for (const [dt2, f0] of [[0, 420], [0.45, 380]] as const) { const g = this.g(d); const o = this.o("sine", f0, t + dt2, 0.35, g); o.frequency.linearRampToValueAtTime(f0 * 0.88, t + dt2 + 0.3); this.env(g, t + dt2, 0.05, 0.05, 0.3); }
        break;
      }
      case "none": this.ambT = 3; break;
    }
  }

  // ---------------------------------------------------------------- moments
  private lib(name: Sound, gain = 0.7, rate = 1, pan = 0) { if (!audio.isMuted) audio.play(name, { gain, rate, pan, duck: false, reverb: 0.15 }); }

  start() {
    if (!this.ok) return;
    const t = this.now;
    [0, 4, 7, 12].forEach((k, i) => { const g = this.g(this.out!); this.o("triangle", mtof(this.root + 12 + k), t + i * 0.06, 0.3, g); this.env(g, t + i * 0.06, 0.12, 0.005, 0.25); });
    this.lib("a:whooshIn", 0.5);
  }
  land(v: number) {
    if (!this.ok) return;
    const t = this.now;
    const g = this.g(this.out!); const o = this.o("sine", 120, t, 0.25, g); o.frequency.exponentialRampToValueAtTime(48, t + 0.16); this.env(g, t, 0.35 * v + 0.1, 0.003, 0.2);
    const g2 = this.g(this.out!); const lp = this.f("lowpass", 900, 0.7, g2); this.n(t, 0.15, lp); this.env(g2, t, 0.18 * v, 0.002, 0.12);
    this.lib("squish", 0.25 * v, 1.2);
  }
  pad() {
    if (!this.ok) return;
    const t = this.now;
    const g = this.g(this.out!); const o = this.o("sine", 220, t, 0.45, g);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.22);
    const lfo = this.ctx!.createOscillator(); lfo.frequency.value = 22; const lg = this.ctx!.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.4);
    this.env(g, t, 0.28, 0.005, 0.38);
    const g2 = this.g(this.out!); const bp = this.f("bandpass", 600, 1, g2); this.n(t, 0.6, bp); bp.frequency.exponentialRampToValueAtTime(3800, t + 0.45); this.env(g2, t, 0.16, 0.02, 0.5);
    this.lib("boing", 0.35, 1.15);
  }
  boost() {
    if (!this.ok) return;
    const t = this.now;
    const g = this.g(this.out!); const lp = this.f("lowpass", 1400, 3, g); const o = this.o("sawtooth", 110, t, 0.7, lp);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.5); lp.frequency.exponentialRampToValueAtTime(5200, t + 0.5);
    this.env(g, t, 0.16, 0.02, 0.6);
    this.lib("a:zap", 0.35, 1.2);
    this.lib("whooshLong", 0.45, 1.1);
  }
  bead(x: number, y: number, s: number) {
    if (!this.ok) return;
    this.beadCombo = Math.min(14, this.beadCombo + 1); this.beadT = 1.6;
    const k = this.beadCombo - 1;
    const midi = this.root + 24 + PENT[k % 5] + 12 * Math.floor(k / 5);
    const t = this.now, f = mtof(midi);
    const d = this.dest({ x, y, z: -s });
    const g = this.g(d); const car = this.o("sine", f, t, 0.7, g);
    const mod = this.ctx!.createOscillator(); mod.frequency.value = f * 3; const mg = this.ctx!.createGain(); mg.gain.setValueAtTime(f * 1.8, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.4);
    mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + 0.72);
    this.env(g, t, 0.22, 0.002, 0.6);
    const g2 = this.g(d); this.o("sine", f * 2, t + 0.04, 0.2, g2); this.env(g2, t + 0.04, 0.06, 0.002, 0.16);
  }
  sprout(x: number, y: number, s: number) {
    if (!this.ok) return;
    const t = this.now;
    const d = this.dest({ x, y, z: -s });
    [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => {
      const tt = t + i * 0.055, f = mtof(this.root + 24 + k);
      const g = this.g(d); this.o("triangle", f, tt, 0.5, g); this.env(g, tt, 0.14, 0.004, 0.45);
      const g2 = this.g(d); this.o("sine", f * 2.01, tt, 0.3, g2); this.env(g2, tt, 0.05, 0.003, 0.25);
    });
    this.lib("sparkle", 0.6); this.lib("v:momo_wow", 0.65);
  }
  crumble(x: number, s: number) {
    if (!this.ok) return;
    const t = this.now;
    const d = this.dest({ x, y: 0, z: -s });
    const g = this.g(d); const bp = this.f("bandpass", 1300, 0.9, g); this.n(t, 0.35, bp, 0.8);
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 5; i++) { g.gain.setValueAtTime(0.12 - i * 0.02, t + i * 0.035); g.gain.exponentialRampToValueAtTime(0.004, t + i * 0.035 + 0.03); }
    const g2 = this.g(d); const lp = this.f("lowpass", 260, 0.8, g2); this.n(t + 0.05, 0.6, lp, 0.6); this.env(g2, t + 0.05, 0.12, 0.02, 0.5);
  }
  hit() {
    if (!this.ok) return;
    this.lib("a:bonk", 0.9); this.lib("a:splat", 0.6, 1.1); this.lib("v:momo_sad", 0.7);
    const t = this.now;
    const g = this.g(this.out!); const o = this.o("square", 320, t, 0.35, this.f("lowpass", 1400, 1, g)); o.frequency.exponentialRampToValueAtTime(90, t + 0.3); this.env(g, t, 0.14, 0.004, 0.3);
  }
  fall() {
    if (!this.ok) return;
    const t = this.now;
    const g = this.g(this.out!); const o = this.o("sine", 1300, t, 0.9, g); o.frequency.exponentialRampToValueAtTime(160, t + 0.85); this.env(g, t, 0.14, 0.02, 0.85);
    this.lib("a:slideDown", 0.45);
  }
  respawn() {
    if (!this.ok) return;
    this.lib("a:poof", 0.5, 1.2); this.lib("pop", 0.6, 1.1);
  }
  checkpoint() {
    if (!this.ok) return;
    const t = this.now;
    [0, 7, 12, 16].forEach((k, i) => { const tt = t + i * 0.07; const g = this.g(this.out!); this.o("triangle", mtof(this.root + 12 + k), tt, 0.45, g); this.env(g, tt, 0.15, 0.004, 0.4); });
    this.lib("confetti", 0.55); this.lib("a:twinkle", 0.45);
  }
  zone() { if (this.ok) this.lib("a:whooshOut", 0.4, 0.9); }
  tick(i: number) {
    if (!this.ok) return;
    const t = this.now;
    const g = this.g(this.out!); this.o("triangle", i === 0 ? 1320 : 880, t, 0.15, g); this.env(g, t, 0.18, 0.003, i === 0 ? 0.3 : 0.12);
  }
  clawWarn(x: number, s: number) {
    if (!this.ok) return;
    const t = this.now; const d = this.dest({ x, y: 4, z: -s });
    const g = this.g(d); const o = this.o("square", 660, t, 0.3, this.f("lowpass", 2000, 1, g)); o.frequency.setValueAtTime(880, t + 0.12); this.env(g, t, 0.06, 0.005, 0.25);
  }
  clawSlam(x: number, s: number) {
    if (!this.ok) return;
    const t = this.now; const d = this.dest({ x, y: 0, z: -s });
    const g = this.g(d); const o = this.o("sine", 140, t, 0.5, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); this.env(g, t, 0.5, 0.003, 0.4);
    const g2 = this.g(d); const lp = this.f("lowpass", 1500, 0.8, g2); this.n(t, 0.4, lp); this.env(g2, t, 0.22, 0.002, 0.3);
    this.lib("clack", 0.5, 0.8);
  }
  kranky() { if (this.ok) this.lib("v:kranky_laugh", 0.75); }
  finish() {
    if (!this.ok) return;
    this.lib("tada", 0.8); this.lib("a:cheer", 0.6); this.lib("a:applause", 0.45); this.lib("v:momo_happy", 0.7);
  }
  ui() { this.lib("pop", 0.45, 1.2); }

  /** special tiles */
  tile(k: number, x: number, s: number, note?: number) {
    if (!this.ok) return;
    const t = this.now, d = this.dest({ x, y: 0, z: -s });
    switch (k) {
      case 26: { // piano key: a note of the song scale
        const f = mtof(this.root + 12 + [0, 2, 4, 5, 7, 9, 11, 12][(note ?? 0) % 8]);
        const g = this.g(d); this.o("triangle", f, t, 0.6, g); this.env(g, t, 0.2, 0.004, 0.55);
        const g2 = this.g(d); this.o("sine", f * 2, t, 0.4, g2); this.env(g2, t, 0.06, 0.003, 0.35);
        break;
      }
      case 18: this.lib("a:teleport", 0.6); break;
      case 12: this.lib("a:tink", 0.5, 0.9); break;
      case 17: this.lib("a:wobble", 0.5); break;
      case 19: this.lib("a:slideUp", 0.5); this.lib("whooshLong", 0.3, 0.8); break;
      case 20: this.lib("a:squeak", 0.6, 1.4); break;
      case 21: this.lib("a:bwomp", 0.6, 0.8); break;
      case 24: this.lib("a:click", 0.7); this.lib("a:doorOpen", 0.4); break;
      case 16: this.lib("a:splat", 0.5, 1.2); break;
      case 27: this.lib("a:coin", 0.45, 1.2); break;
      case 28: this.lib("a:bubbles", 0.5); break;
      default: break;
    }
  }
  pickup(kind: string, x: number, y: number, s: number) {
    if (!this.ok) return;
    const t = this.now, d = this.dest({ x, y, z: -s });
    switch (kind) {
      case "power": this.lib("a:levelup", 0.55, 1.2); break;
      case "letter": [0, 7, 12].forEach((k2, i) => { const g = this.g(d); this.o("square", mtof(this.root + 24 + k2), t + i * 0.05, 0.12, this.f("lowpass", 3000, 1, g)); this.env(g, t + i * 0.05, 0.08, 0.003, 0.1); }); break;
      case "key": this.lib("a:bell", 0.6); break;
      case "note": this.lib("a:chime", 0.6); break;
      case "baby": this.lib("a:giggle", 0.6); break;
      case "box": this.lib("a:register", 0.6); this.lib("confetti", 0.4); break;
      case "statue": this.lib("a:shutter", 0.7); this.lib("a:ooh", 0.5); break;
    }
  }
  ability(on: boolean) { if (this.ok) this.lib(on ? "a:sparks" : "a:poof", on ? 0.5 : 0.35, on ? 1.1 : 1.3); }
  jump() { if (this.ok) this.lib("hop", 0.6, 1.1); }
  shield() { if (this.ok) { this.lib("pop", 0.7, 0.8); this.lib("a:zap", 0.4, 1.4); } }
  fever(on: boolean) {
    if (!this.ok) return;
    if (!on) { this.lib("a:whooshOut", 0.35); return; }
    const t = this.now;
    [0, 4, 7, 12, 16, 19, 24, 28].forEach((k2, i) => { const g = this.g(this.out!); this.o("triangle", mtof(this.root + 12 + k2), t + i * 0.04, 0.3, g); this.env(g, t + i * 0.04, 0.1, 0.003, 0.25); });
    this.lib("a:perfect", 0.5);
  }

  /** fade every loop (pause / death) */
  hush() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.roll?.g.gain.setTargetAtTime(0, t, 0.03); this.roll?.og.gain.setTargetAtTime(0, t, 0.03);
    this.wind?.g.gain.setTargetAtTime(0, t, 0.05);
    for (const v of this.voices) v.g.gain.setTargetAtTime(0, t, 0.05);
  }

  dispose() {
    if (this.disposed) return;
    this.hush();
    this.disposed = true;
    const stop = () => {
      try { this.roll?.src.stop(); this.roll?.o.stop(); this.wind?.src.stop(); for (const v of this.voices) v.src.stop(); } catch { /* already stopped */ }
      try { this.out?.disconnect(); } catch { /* ignore */ }
    };
    window.setTimeout(stop, 200);
  }
}
