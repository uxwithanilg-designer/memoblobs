// Racing audio for Nitro Rush (shared by every racing game) — a small real-time studio on the site's SFX bus:
//  • player engine: one firing-order PeriodicWave per EngineVoice.tone (per-cylinder timing / level irregularity
//    gives the V8 burble, rotary "brap", V12 scream, diesel clatter…) through load-dependent drive, an exhaust body
//    resonance and a muffler low-pass, plus an intake howl band, pulse-modulated combustion rasp, turbo spool whistle
//    + blow-off, rev-limiter bounce, gear-shift dips with a clunk, lift-off / overrun crackle and idle wobble.
//    Electric cars get a motor + inverter whine instead.
//  • rivals ("surround"): up to 3 lean engine voices, panned by bearing, doppler from the radial closing speed,
//    distance attenuation, air absorption and front/back muffling; stable voice-to-car assignment.
//  • tyre squeal (synthesised stick-slip loop) following slip, road roar + wind with speed, nitro flame roar,
//    off-road / kerb gravel + rumble; one-shot racing SFX (sfx_race_*.mp3) and racing music (music_race_*.mp3).
// Phones: ~55 nodes, one shared noise source, AudioParam updates skipped when a value barely moves, and no
// per-frame allocations. Everything goes through audio.sfxOut, so master / SFX volume and mute apply.
import { audio, type Sound } from "@/lib/audio";
import type { EngineVoice } from "./types";

export type RaceSfx =
  | "coin" | "nitroPickup" | "shield" | "magnet" | "hit" | "scrape" | "crash" | "land" | "jump" | "boostStart" | "perfect"
  | "lap" | "finalLap" | "finish" | "win" | "lose" | "countdown" | "go" | "takedown" | "spin" | "fire" | "checkpoint"
  | "eliminated" | "shift" | "horn" | "whoosh"
  // racing pack additions
  | "screech" | "screechLong" | "blowoff" | "backfire" | "crackle" | "crunch" | "nitro" | "shockwave" | "beep" | "beepGo"
  | "crowd" | "airhorn" | "nearMiss" | "explosion"
  // Highway Heat
  | "siren" | "yelp" | "radio"
  // Moto Rush GP
  | "rev";

/** s = sample, gain/rate = defaults (multiplied by the caller's), rv = reverb send */
const SFX: Record<RaceSfx, { s: Sound; gain?: number; rate?: number; rv?: number }> = {
  coin: { s: "a:race_coin", gain: 0.42, rv: 0.12 }, nitroPickup: { s: "a:race_pickup", gain: 0.7 }, shield: { s: "a:race_shield", gain: 0.62 },
  magnet: { s: "a:race_magnet", gain: 0.68 }, hit: { s: "a:race_crunch", gain: 0.64, rv: 0.2 }, scrape: { s: "a:race_scrape", gain: 0.62, rv: 0.1 },
  crash: { s: "a:race_crash", gain: 0.78, rv: 0.3 }, land: { s: "a:race_land", gain: 0.67, rv: 0.12 }, jump: { s: "a:race_jump", gain: 0.52 },
  boostStart: { s: "a:race_nitro", gain: 0.8, rv: 0.2 }, perfect: { s: "a:race_perfect", gain: 0.6, rv: 0.3 }, lap: { s: "a:race_lap", gain: 0.65, rv: 0.3 },
  finalLap: { s: "a:race_finalLap", gain: 0.88, rv: 0.3 }, finish: { s: "a:race_finish", gain: 0.9, rv: 0.2 }, win: { s: "a:race_win", gain: 0.8, rv: 0.35 },
  lose: { s: "a:race_lose", gain: 0.95, rv: 0.35 }, countdown: { s: "a:race_beep", gain: 0.43, rv: 0.15 }, go: { s: "a:race_go", gain: 1, rv: 0.25 },
  takedown: { s: "a:race_takedown", gain: 1, rv: 0.3 }, spin: { s: "a:race_screechLong", gain: 0.78, rv: 0.12 }, fire: { s: "a:race_fire", gain: 0.78, rv: 0.2 },
  checkpoint: { s: "a:race_checkpoint", gain: 0.48, rv: 0.3 }, eliminated: { s: "a:race_eliminated", gain: 0.45, rv: 0.25 },
  shift: { s: "a:race_shift", gain: 0.75, rv: 0 }, horn: { s: "a:race_horn", gain: 0.53, rv: 0.15 }, whoosh: { s: "a:race_nearMiss", gain: 0.9, rv: 0.1 },
  screech: { s: "a:race_screech", gain: 0.56, rv: 0.1 }, screechLong: { s: "a:race_screechLong", gain: 0.78, rv: 0.12 },
  blowoff: { s: "a:race_blowoff", gain: 0.5, rv: 0.05 }, backfire: { s: "a:race_backfire", gain: 0.72, rv: 0.12 }, crackle: { s: "a:race_crackle", gain: 0.62, rv: 0.1 },
  crunch: { s: "a:race_crunch", gain: 0.64, rv: 0.2 }, nitro: { s: "a:race_nitro", gain: 0.8, rv: 0.2 }, shockwave: { s: "a:race_shockwave", gain: 1, rv: 0.3 },
  beep: { s: "a:race_beep", gain: 0.43, rv: 0.15 }, beepGo: { s: "a:race_beepGo", gain: 0.45, rv: 0.2 }, crowd: { s: "a:race_crowd", gain: 0.88, rv: 0.2 },
  airhorn: { s: "a:race_airhorn", gain: 0.6, rv: 0.25 }, nearMiss: { s: "a:race_nearMiss", gain: 0.9, rv: 0.1 }, explosion: { s: "a:race_explosion", gain: 0.8, rv: 0.3 },
  rev: { s: "a:race_rev", gain: 0.7, rv: 0.1 },
  siren: { s: "a:race_siren", gain: 0.7, rv: 0.2 }, yelp: { s: "a:race_yelp", gain: 0.6, rv: 0.1 }, radio: { s: "a:race_radio", gain: 0.55, rv: 0 },
};
export const RACE_SOUNDS: Sound[] = [...new Set(Object.values(SFX).map((x) => x.s))];

/** theme music keys that have `a:race_<key>_calm` / `a:race_<key>_action` loops */
export const RACE_MUSIC_KEYS = ["rock", "synthwave", "edm", "dnb", "trap", "chiptune", "funk", "orchestral", "eurobeat", "phonk", "chase", "bigbeat", "metal", "hardstyle"] as const;
/** menu / garage loop, and a hype version (results, showroom) */
export const RACE_MENU_MUSIC = "a:race_menu_calm";
export const RACE_MENU_MUSIC_HYPE = "a:race_menu_action";
export const raceMusic = (key: string, intense: boolean): `a:${string}` => `a:race_${key}_${intense ? "action" : "calm"}`;

// ------------------------------------------------------------------ engine recipes
type Tone = EngineVoice["tone"];
interface Recipe {
  cyl: number; cyc: number; rpmMul: number; // firing pulses per cycle, cycles per crank rev (0.5 = 4-stroke), rev scale
  harm: number; tilt: number; jitter: number; ampVar: number; bank: number; // wave: harmonics, roll-off, irregularity
  drive: number; lp: [number, number, number]; body: [number, number, number]; // shaper drive, muffler LP (base, +rpm, +load), body EQ (Hz, Q, dB)
  intake: number; intakeMul: number; rasp: number; raspF: number; // intake howl, combustion rasp
  turbo: number; crackle: number; limiter: number; wobble: number; gain: number; seed: number;
}
const RECIPES: Record<Tone, Recipe> = {
  small: { cyl: 4, cyc: 0.5, rpmMul: 1, harm: 112, tilt: 0.7, jitter: 0.012, ampVar: 0.07, bank: 0, drive: 2.6, lp: [700, 3600, 1500], body: [290, 1.2, 5], intake: 0.32, intakeMul: 3, rasp: 0.2, raspF: 2600, turbo: 1, crackle: 0.45, limiter: 17, wobble: 0.012, gain: 1, seed: 11 },
  v6: { cyl: 6, cyc: 0.5, rpmMul: 1, harm: 128, tilt: 0.72, jitter: 0.014, ampVar: 0.06, bank: 0.16, drive: 2.5, lp: [650, 3800, 1700], body: [220, 1.1, 6], intake: 0.32, intakeMul: 2.5, rasp: 0.15, raspF: 2200, turbo: 0.55, crackle: 0.6, limiter: 16, wobble: 0.01, gain: 1, seed: 23 },
  v8: { cyl: 8, cyc: 0.5, rpmMul: 1, harm: 128, tilt: 0.72, jitter: 0.03, ampVar: 0.14, bank: 0.28, drive: 3.1, lp: [480, 2900, 1500], body: [130, 1, 6], intake: 0.26, intakeMul: 2, rasp: 0.16, raspF: 1700, turbo: 0, crackle: 1, limiter: 14, wobble: 0.02, gain: 1.08, seed: 37 },
  v12: { cyl: 12, cyc: 0.5, rpmMul: 1, harm: 160, tilt: 0.68, jitter: 0.004, ampVar: 0.02, bank: 0.04, drive: 2.1, lp: [900, 5200, 2200], body: [380, 1.2, 5], intake: 0.45, intakeMul: 2, rasp: 0.12, raspF: 3500, turbo: 0, crackle: 0.45, limiter: 20, wobble: 0.006, gain: 0.95, seed: 41 },
  electric: { cyl: 1, cyc: 1, rpmMul: 1, harm: 12, tilt: 1, jitter: 0, ampVar: 0, bank: 0, drive: 1, lp: [2400, 5000, 1500], body: [700, 1, 3], intake: 0, intakeMul: 1, rasp: 0, raspF: 3000, turbo: 0, crackle: 0, limiter: 0, wobble: 0, gain: 0.8, seed: 5 },
  diesel: { cyl: 6, cyc: 0.5, rpmMul: 1, harm: 96, tilt: 0.78, jitter: 0.02, ampVar: 0.22, bank: 0, drive: 2.7, lp: [380, 1800, 900], body: [150, 1, 7], intake: 0.22, intakeMul: 3, rasp: 0.36, raspF: 3200, turbo: 1.3, crackle: 0, limiter: 10, wobble: 0.02, gain: 1.05, seed: 53 },
  kart: { cyl: 1, cyc: 1, rpmMul: 1.7, harm: 64, tilt: 0.6, jitter: 0.02, ampVar: 0.1, bank: 0, drive: 3.4, lp: [900, 4500, 2000], body: [600, 1.4, 4], intake: 0.3, intakeMul: 4, rasp: 0.3, raspF: 3000, turbo: 0, crackle: 0.3, limiter: 22, wobble: 0.03, gain: 1.5, seed: 61 },
  inline4: { cyl: 4, cyc: 0.5, rpmMul: 1, harm: 150, tilt: 0.6, jitter: 0.006, ampVar: 0.04, bank: 0, drive: 2.8, lp: [1000, 6200, 2600], body: [420, 1.3, 5], intake: 0.42, intakeMul: 3, rasp: 0.28, raspF: 3800, turbo: 0, crackle: 0.6, limiter: 22, wobble: 0.008, gain: 1.05, seed: 81 },
  twin: { cyl: 2, cyc: 0.5, rpmMul: 1, harm: 110, tilt: 0.7, jitter: 0.12, ampVar: 0.18, bank: 0.3, drive: 3.2, lp: [520, 3000, 1500], body: [180, 1.1, 6], intake: 0.3, intakeMul: 2, rasp: 0.22, raspF: 2000, turbo: 0, crackle: 0.9, limiter: 15, wobble: 0.03, gain: 1.2, seed: 91 },
  single: { cyl: 1, cyc: 0.5, rpmMul: 1, harm: 90, tilt: 0.68, jitter: 0.02, ampVar: 0.1, bank: 0, drive: 3.4, lp: [700, 4000, 1800], body: [320, 1.3, 5], intake: 0.35, intakeMul: 3, rasp: 0.3, raspF: 3000, turbo: 0, crackle: 0.7, limiter: 20, wobble: 0.03, gain: 1.35, seed: 97 },
  scooter: { cyl: 1, cyc: 1, rpmMul: 1.5, harm: 70, tilt: 0.55, jitter: 0.02, ampVar: 0.08, bank: 0, drive: 3.6, lp: [1000, 5200, 2200], body: [700, 1.4, 4], intake: 0.3, intakeMul: 4, rasp: 0.38, raspF: 3400, turbo: 0, crackle: 0.2, limiter: 24, wobble: 0.03, gain: 1.4, seed: 101 },
  rotary: { cyl: 2, cyc: 1, rpmMul: 1, harm: 96, tilt: 0.64, jitter: 0.004, ampVar: 0.05, bank: 0, drive: 2.8, lp: [800, 4800, 2000], body: [350, 1.2, 5], intake: 0.35, intakeMul: 3, rasp: 0.26, raspF: 2800, turbo: 0.4, crackle: 1.25, limiter: 18, wobble: 0.02, gain: 1.35, seed: 71 },
};

// ------------------------------------------------------------------ shared, cached per AudioContext
const caches = new WeakMap<BaseAudioContext, { waves: Map<Tone, PeriodicWave>; noise?: AudioBuffer; squeal?: AudioBuffer; gravel?: AudioBuffer }>();
const cache = (ctx: BaseAudioContext) => { let c = caches.get(ctx); if (!c) { c = { waves: new Map() }; caches.set(ctx, c); } return c; };

/** one engine cycle as a harmonic series: every cylinder adds a pulse at its (slightly irregular) firing phase */
function engineWave(ctx: BaseAudioContext, tone: Tone): PeriodicWave {
  const c = cache(ctx), hit = c.waves.get(tone);
  if (hit) return hit;
  const R = RECIPES[tone], N = R.harm, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  if (tone === "electric") {
    // motor whine: fundamental + low-order partials + a slot-harmonic
    const amp = [0, 1, 0.42, 0.22, 0.12, 0.05, 0.18, 0.04, 0.06, 0, 0, 0, 0.08];
    for (let h = 1; h <= N; h++) im[h] = amp[h] ?? 0;
  } else {
    let seed = R.seed;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ph = new Float64Array(R.cyl), am = new Float64Array(R.cyl);
    for (let k = 0; k < R.cyl; k++) {
      ph[k] = k / R.cyl + (rnd() - 0.5) * R.jitter;
      am[k] = 1 + (rnd() - 0.5) * 2 * R.ampVar + (k % 2 ? -R.bank : R.bank) * 0.5;
    }
    for (let h = 1; h <= N; h++) {
      let cr = 0, ci = 0;
      for (let k = 0; k < R.cyl; k++) { const a = -2 * Math.PI * h * ph[k]; cr += am[k] * Math.cos(a); ci += am[k] * Math.sin(a); }
      const s = 1 / Math.pow(h, R.tilt) * (h < 3 ? 0.6 : 1); // keep the sub-cycle rumble under the firing order
      re[h] = cr * s; im[h] = ci * s;
    }
  }
  const w = ctx.createPeriodicWave(re, im);
  c.waves.set(tone, w);
  return w;
}

let CURVE: Float32Array<ArrayBuffer> | null = null;
function shaper(ctx: BaseAudioContext, over: OverSampleType) {
  if (!CURVE) {
    const n = 2048, k = 3; CURVE = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; CURVE[i] = Math.tanh(x * k) / Math.tanh(k); }
  }
  const ws = ctx.createWaveShaper(); ws.curve = CURVE; ws.oversample = over; return ws;
}

/** periodic smooth random curve: `pts` control points around the loop, cosine-interpolated (seamless) */
function loopCurve(pts: number, n: number, rnd: () => number) {
  const g = new Float32Array(pts); for (let i = 0; i < pts; i++) g[i] = rnd() * 2 - 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * pts, a = Math.floor(x), f = x - a, w = (1 - Math.cos(Math.PI * f)) / 2;
    out[i] = g[a % pts] * (1 - w) + g[(a + 1) % pts] * w;
  }
  return out;
}

function noiseBuffer(ctx: BaseAudioContext) {
  const c = cache(ctx); if (c.noise) return c.noise;
  const n = Math.floor(ctx.sampleRate * 2.5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { // pink-ish (Kellet's economy filter)
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  const x = Math.floor(ctx.sampleRate * 0.02); // crossfade the seam
  for (let i = 0; i < x; i++) { const u = i / x; d[i] = d[i] * u + d[n - x + i] * (1 - u); }
  c.noise = b; return b;
}

/** tyre squeal loop: a stick-slip tone whose pitch and level wander chaotically; exactly periodic */
function squealBuffer(ctx: BaseAudioContext) {
  const c = cache(ctx); if (c.squeal) return c.squeal;
  const sr = ctx.sampleRate, n = Math.floor(sr * 2), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const fm = loopCurve(18, n, rnd), fm2 = loopCurve(90, n, rnd), am = loopCurve(28, n, rnd);
  let total = 0; for (let i = 0; i < n; i++) total += 1000 * (1 + 0.035 * fm[i] + 0.012 * fm2[i]) / sr;
  const k = Math.round(total) / total; let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += (1000 * (1 + 0.035 * fm[i] + 0.012 * fm2[i]) / sr) * k;
    const p = 2 * Math.PI * ph;
    d[i] = (Math.sin(p) + 0.55 * Math.sin(2 * p + 0.3) + 0.25 * Math.sin(3 * p + 1.1) + 0.1 * Math.sin(5 * p)) * (0.72 + 0.28 * am[i]) * 0.42;
  }
  c.squeal = b; return b;
}

/** gravel loop: dense random stone impacts (short decaying clicks) */
function gravelBuffer(ctx: BaseAudioContext) {
  const c = cache(ctx); if (c.gravel) return c.gravel;
  const sr = ctx.sampleRate, n = Math.floor(sr * 1.5), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  const hits = Math.floor(1.5 * 650);
  for (let h = 0; h < hits; h++) {
    const o = Math.floor(Math.random() * n), a = (Math.random() * 2 - 1) * (0.2 + Math.random() * 0.8), len = Math.floor(sr * (0.0015 + Math.random() * 0.004));
    for (let i = 0; i < len; i++) d[(o + i) % n] += a * Math.exp(-i / (len * 0.3)) * (Math.random() * 2 - 1);
  }
  let prev = 0; for (let i = 0; i < n; i++) { const x = d[i]; d[i] = (x - prev * 0.6) * 0.5; prev = x; } // tilt to the highs
  c.gravel = b; return b;
}

/** an AudioParam that only gets a new target when the value really moves (phones: fewer automation events) */
class Ctl {
  private last = NaN;
  constructor(readonly p: AudioParam) {}
  to(v: number, t: number, tc: number) {
    const l = this.last;
    if (Math.abs(v - l) < Math.abs(l) * 0.004 + 1e-4) return;
    this.last = v; this.p.setTargetAtTime(v, t, tc);
  }
  now(v: number, t: number) { this.last = v; this.p.cancelScheduledValues(t); this.p.setTargetAtTime(v, t, 0.01); }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** audio rpm: physics drops to ~idle after every upshift; real boxes drop to ~60% — remap gears 2+ */
const audioRpm = (rpm01: number, gear: number) => (gear <= 1 ? rpm01 : 0.5 + 0.5 * rpm01);

// ------------------------------------------------------------------ player engine
class PlayerEngine {
  readonly out: GainNode; readonly pan: StereoPannerNode;
  private dip: GainNode;
  private osc: OscillatorNode; private oscT: OscillatorNode; private lfo: OscillatorNode;
  private fE: Ctl; private fT: Ctl; private pre: Ctl; private lpF: Ctl; private lpQ: Ctl; private inF: Ctl; private inG: Ctl;
  private raspG: Ctl; private tG: Ctl; private tH: Ctl; private limD: Ctl; private limP: Ctl; private outG: Ctl;
  private crk: GainNode;
  private R: Recipe; private electric: boolean;
  private lastGear = 1; private thr = 0; private prevThr = 0; private spool = 0; private wob = 0; private popT = 0; private shiftT = -9; private lastPopRoll = 0;
  level = 1;

  constructor(ctx: BaseAudioContext, dest: AudioNode, noise: AudioNode, private voice: EngineVoice, private quiet = false) {
    const R = (this.R = RECIPES[voice.tone] ?? RECIPES.v6); this.electric = voice.tone === "electric";
    const g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const bq = (type: BiquadFilterType, f: number, q: number, gain = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
    this.pan = ctx.createStereoPanner(); this.pan.connect(dest);
    this.out = g(0); this.dip = g(1); this.out.connect(this.dip).connect(this.pan);
    // exhaust: wave -> drive -> shaper -> muffler LP -> body resonance
    this.osc = ctx.createOscillator(); this.osc.setPeriodicWave(engineWave(ctx, voice.tone)); this.osc.frequency.value = 30;
    const pre = g(0.4), shp = shaper(ctx, "2x"), lp = bq("lowpass", 1200, 0.9), body = bq("peaking", R.body[0], R.body[1], R.body[2]), exG = g(this.electric ? 0.55 : 0.75);
    this.osc.connect(pre).connect(shp).connect(lp).connect(body).connect(exG).connect(this.out);
    // intake howl: a resonant band riding a multiple of the firing frequency
    const inBP = bq("bandpass", 600, 2.5), inG = g(0);
    this.osc.connect(inBP).connect(inG).connect(this.out);
    // combustion rasp: noise amplitude-modulated by the firing pulses
    const raspBP = bq("bandpass", R.raspF, 0.8), rasp = g(0), raspMod = g(0);
    noise.connect(raspBP).connect(rasp).connect(this.out);
    this.osc.connect(raspMod).connect(rasp.gain);
    // turbo whistle + spool hiss (electric: inverter whine)
    this.oscT = ctx.createOscillator(); this.oscT.type = this.electric ? "triangle" : "sine"; this.oscT.frequency.value = 2000;
    const tG = g(0), tHP = bq("highpass", 3200, 0.7), tH = g(0);
    this.oscT.connect(tG).connect(this.out); noise.connect(tHP).connect(tH).connect(this.out);
    // rev limiter: a square LFO dipping the level and the pitch
    this.lfo = ctx.createOscillator(); this.lfo.type = "square"; this.lfo.frequency.value = R.limiter || 15;
    const limD = g(0), limP = g(0);
    this.lfo.connect(limD).connect(this.out.gain); this.lfo.connect(limP).connect(this.osc.detune);
    // crackle / pops: noise bursts scheduled on a gain (bypasses the muffler so they stay crisp)
    const crkBP = bq("bandpass", 1500, 0.6); this.crk = g(0);
    noise.connect(crkBP).connect(this.crk).connect(this.pan);
    this.fE = new Ctl(this.osc.frequency); this.fT = new Ctl(this.oscT.frequency); this.pre = new Ctl(pre.gain);
    this.lpF = new Ctl(lp.frequency); this.lpQ = new Ctl(lp.Q); this.inF = new Ctl(inBP.frequency); this.inG = new Ctl(inG.gain);
    this.raspG = new Ctl(raspMod.gain); this.tG = new Ctl(tG.gain); this.tH = new Ctl(tH.gain);
    this.limD = new Ctl(limD.gain); this.limP = new Ctl(limP.gain); this.outG = new Ctl(this.out.gain);
    this.osc.start(); this.oscT.start(); this.lfo.start();
  }

  update(t: number, dt: number, rpm01: number, throttle: number, gear: number, speed01: number, boosting: boolean, air: boolean) {
    const R = this.R, v = this.voice, lvl = this.level;
    this.thr += (throttle - this.thr) * Math.min(1, dt * 12);
    const load = this.thr;
    let r = this.electric ? 0.1 + 0.9 * speed01 : audioRpm(rpm01, gear);
    if (air && throttle > 0.3) r = Math.min(1, r + 0.15); // wheels off the ground: free-revving
    // idle wobble: a slow random walk, strongest near idle
    this.wob += ((Math.random() * 2 - 1) - this.wob) * Math.min(1, dt * 5);
    const idle = clamp01(1 - r * 3);
    if (this.electric) {
      const f = 70 + 1250 * r * (1 + 0.08 * load);
      this.fE.to(f, t, 0.05); this.fT.to(f * 3.2, t, 0.05);
      this.tG.to((0.03 + 0.07 * load) * clamp01(speed01 * 4) * lvl, t, 0.08);
      this.pre.to(0.25 + 0.2 * load, t, 0.05); this.lpF.to(R.lp[0] + R.lp[1] * r, t, 0.05); this.lpQ.to(1.5, t, 0.2);
      this.outG.to(lvl * R.gain * (0.25 + 0.45 * load + 0.3 * r) * (boosting ? 1.25 : 1), t, 0.06);
      this.prevThr = throttle; this.lastGear = gear;
      return;
    }
    const rpm = (v.idle + (v.redline - v.idle) * r) * R.rpmMul * (1 + R.wobble * this.wob * (0.25 + idle));
    const fc = (rpm / 60) * R.cyc, ff = fc * R.cyl;
    this.fE.to(fc, t, t - this.shiftT < 0.14 ? 0.05 : 0.022);
    // rev limiter: bouncing off the fuel cut
    const cut = r > 0.975 && throttle > 0.6 ? 0.36 : 0;
    this.limD.to(cut * lvl, t, 0.01); this.limP.to(cut ? -70 : 0, t, 0.01);
    // load: on throttle the exhaust barks (more drive, brighter); off throttle it goes dark and quiet
    this.pre.to((0.3 + 0.55 * load + 0.2 * r) * (R.drive / 3) * (boosting ? 1.25 : 1), t, 0.04);
    this.lpF.to(Math.min(14000, R.lp[0] + R.lp[1] * r + R.lp[2] * load + (boosting ? 1500 : 0)), t, 0.04);
    this.lpQ.to(0.8 + 1.2 * load, t, 0.1);
    this.inF.to(Math.min(9000, ff * R.intakeMul), t, 0.03);
    this.inG.to(R.intake * (0.12 + 0.88 * load) * (0.3 + 0.7 * r), t, 0.05);
    this.raspG.to(R.rasp * (0.35 + 0.65 * load) * (0.5 + 0.9 * idle + 0.5 * r), t, 0.05);
    this.outG.to(lvl * (R.gain * (0.5 + 0.27 * load + 0.23 * r) * (boosting ? 1.2 : 1) - cut), t, 0.04);
    // turbo: spools with load and rpm (lag), blows off when you lift
    if (R.turbo > 0) {
      const want = boosting ? 1 : clamp01((throttle * (r - 0.28)) / 0.5);
      this.spool += (want - this.spool) * Math.min(1, dt / (want > this.spool ? 0.75 : 0.3));
      if (this.prevThr > 0.5 && throttle < 0.2 && this.spool > 0.45) {
        if (!this.quiet) audio.play("a:race_blowoff", { gain: 0.5 * this.spool * Math.min(1, R.turbo) * lvl, rate: 0.9 + Math.random() * 0.2, duck: false, reverb: 0.05 });
        this.spool *= 0.25;
      }
      const s = this.spool;
      this.fT.to(1700 + 4300 * s + 500 * r, t, 0.08);
      this.tG.to(R.turbo * s * s * 0.045 * lvl, t, 0.06);
      this.tH.to(R.turbo * Math.pow(s, 1.5) * 0.07 * lvl, t, 0.06);
    }
    // gear changes: upshift = throttle cut dip + clunk (+ pops); downshift = blip + pops
    if (gear !== this.lastGear) {
      if (gear > this.lastGear && throttle > 0.3) {
        this.shiftT = t;
        const dg = this.dip.gain; dg.cancelScheduledValues(t); dg.setTargetAtTime(0.38, t, 0.012); dg.setTargetAtTime(1, t + 0.085, 0.045);
        if (!this.quiet) audio.play("a:race_shift", { gain: 0.32 * lvl, rate: 0.9 + Math.random() * 0.2, duck: false, reverb: 0 });
        if (R.crackle > 0 && Math.random() < 0.35 + 0.4 * R.crackle) this.pops(t, 1 + Math.floor(Math.random() * 2), 0.04, 0);
        if (R.turbo > 0 && this.spool > 0.6 && Math.random() < 0.5) {
          if (!this.quiet) audio.play("a:race_blowoff", { gain: 0.3 * this.spool * Math.min(1, R.turbo) * lvl, rate: 1.15, duck: false, reverb: 0.05 }); this.spool *= 0.6;
        }
      } else if (gear < this.lastGear) {
        const dg = this.dip.gain; dg.cancelScheduledValues(t); dg.setTargetAtTime(1.3, t, 0.015); dg.setTargetAtTime(1, t + 0.09, 0.06);
        if (R.crackle > 0) this.pops(t, 1 + Math.floor(Math.random() * 3 * R.crackle), 0.07, 0.25);
      }
      this.lastGear = gear;
    }
    // lift-off: a burst of crackle; overrun at high revs keeps popping now and then
    if (R.crackle > 0) {
      if (this.prevThr > 0.6 && throttle < 0.25 && r > 0.5) this.pops(t, 2 + Math.floor(Math.random() * 4 * R.crackle * r), 0.1, 0.35 * R.crackle);
      else if (throttle < 0.1 && r > 0.45 && t - this.lastPopRoll > 0.1) {
        this.lastPopRoll = t;
        if (Math.random() < 0.18 * R.crackle * r) this.pops(t, 1 + Math.floor(Math.random() * 2), 0.06, 0.08);
      }
    }
    this.prevThr = throttle;
  }

  /** schedule `n` exhaust pops on the crackle gain (and maybe one big backfire sample) */
  private pops(t: number, n: number, spread: number, bigChance: number) {
    if (this.popT > t + 1.2) return;
    const g = this.crk.gain; let at = Math.max(t + 0.02, this.popT + 0.03);
    for (let i = 0; i < n; i++) {
      at += 0.025 + Math.random() * spread;
      const a = (0.35 + Math.random() * 0.65) * 0.55 * this.R.crackle * this.level;
      g.setValueAtTime(0, at); g.linearRampToValueAtTime(a, at + 0.0015); g.setTargetAtTime(0, at + 0.0015, 0.006 + Math.random() * 0.012);
    }
    this.popT = at;
    if (bigChance > 0 && !this.quiet && Math.random() < bigChance) {
      audio.play("a:race_backfire", { gain: 0.5 * this.level, rate: 0.85 + Math.random() * 0.3, delay: 0.03 + Math.random() * 0.15, duck: false, reverb: 0.12 });
    }
  }

  silence(t: number) { this.outG.now(0, t); this.tG.now(0, t); this.tH.now(0, t); this.limD.now(0, t); }
  stop() { for (const o of [this.osc, this.oscT, this.lfo]) { try { o.stop(); } catch { /* already stopped */ } } this.pan.disconnect(); }
}

// ------------------------------------------------------------------ rival engines (lean)
interface RivalIn { rpm: number; throttle: number; gear: number; dist: number; side: number; closing: number; voice?: EngineVoice }
class RivalEngine {
  private osc: OscillatorNode; private out: GainNode; private pan: StereoPannerNode;
  private f: Ctl; private g: Ctl; private p: Ctl; private lpF: Ctl;
  private tone: Tone | "" = ""; voice: EngineVoice | null = null;
  lastDist = 0; lastSide = 0; active = false;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.osc = ctx.createOscillator(); this.osc.frequency.value = 40;
    const pre = ctx.createGain(); pre.gain.value = 0.55;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2000; lp.Q.value = 0.9;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.osc.connect(pre).connect(shaper(ctx, "none")).connect(lp).connect(this.out).connect(this.pan).connect(dest);
    this.f = new Ctl(this.osc.frequency); this.g = new Ctl(this.out.gain); this.p = new Ctl(this.pan.pan); this.lpF = new Ctl(lp.frequency);
    this.setVoice({ idle: 900, redline: 7000, gears: 6, tone: "v6" });
    this.osc.start();
  }
  setVoice(v: EngineVoice) {
    if (v.tone !== this.tone) { this.osc.setPeriodicWave(engineWave(this.ctx, v.tone)); this.tone = v.tone; }
    this.voice = v;
  }
  update(t: number, o: RivalIn, level: number) {
    if (o.voice && o.voice !== this.voice) this.setVoice(o.voice);
    const v = this.voice!, R = RECIPES[v.tone] ?? RECIPES.v6;
    const lat = o.side * 6, D = Math.sqrt(o.dist * o.dist + lat * lat + 1);
    // doppler from the radial component of the closing speed (exaggerated a little: c = 240 m/s)
    const radial = o.closing * (Math.abs(o.dist) / D);
    const dop = Math.max(0.75, Math.min(1.35, 240 / (240 - Math.max(-120, Math.min(120, radial)))));
    const r = v.tone === "electric" ? 0.1 + 0.9 * o.rpm : audioRpm(o.rpm, o.gear);
    const f = v.tone === "electric" ? 70 + 1250 * r : ((v.idle + (v.redline - v.idle) * r) * R.rpmMul / 60) * R.cyc;
    this.f.to(f * dop, t, 0.04);
    // distance law + fade at the 70 m edge; air absorption and front/back muffling on the low-pass
    const att = (1 / (1 + Math.pow(D / 11, 1.35))) * clamp01((70 - D) / 14);
    const behind = o.dist < 0 ? 0.6 : 1;
    this.lpF.to((600 + 9000 / (1 + D / 14)) * behind * (0.6 + 0.4 * o.throttle) * (v.tone === "electric" ? 1.6 : 1), t, 0.06);
    this.g.to(level * R.gain * att * (0.45 + 0.4 * o.throttle + 0.15 * r), t, 0.05);
    this.p.to(Math.max(-0.95, Math.min(0.95, (lat / D) * 1.1)), t, 0.04);
    this.lastDist = o.dist; this.lastSide = o.side; this.active = true;
  }
  fade(t: number) { if (this.active) { this.g.now(0, t); this.active = false; } }
  stop() { try { this.osc.stop(); } catch { /* already stopped */ } this.pan.disconnect(); }
}

// ------------------------------------------------------------------ dyno: scripted drive (garage rev preview, offline QA)
/** idle → blip → launch → upshifts through 4 gears → limiter → lift-off crackle → idle */
function dynoAt(t: number) {
  if (t < 1) return { rpm: 0.04, thr: 0, gear: 1, sp: 0 };
  if (t < 1.9) { const u = t - 1; return u < 0.4 ? { rpm: 0.04 + u * 1.6, thr: 1, gear: 1, sp: 0 } : { rpm: Math.max(0.04, 0.68 - (u - 0.4) * 1.4), thr: 0, gear: 1, sp: 0 }; }
  if (t < 2.4) return { rpm: 0.04 + Math.min(1, (t - 1.9) * 4) * 0.61, thr: 1, gear: 1, sp: 0.02 };
  if (t < 6.8) { const u = (t - 2.4) / 1.1, g = Math.min(4, Math.floor(u) + 1), f = u - Math.floor(u); return { rpm: 0.18 + 0.78 * f, thr: 1, gear: g, sp: (g - 1 + f) / 4.5 }; }
  if (t < 7.6) return { rpm: 1, thr: 1, gear: 4, sp: 0.9 };
  if (t < 8.8) return { rpm: 0.9 - (t - 7.6) * 0.35, thr: 0, gear: 4, sp: 0.88 };
  return { rpm: 0.04, thr: 0, gear: 1, sp: 0.1 };
}
const DYNO_SECONDS = 9.6;

/** play the dyno rev on the site's SFX bus (garage "rev the engine" button); returns a stop function */
export function revEngine(voice: EngineVoice): () => void {
  const ctx = audio.ensure(), out = audio.sfxOut;
  if (!ctx || !out) return () => {};
  const bus = ctx.createGain(); bus.gain.value = 0.8; bus.connect(out);
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx); nz.loop = true; nz.start();
  const eng = new PlayerEngine(ctx, bus, nz, voice);
  const t0 = ctx.currentTime; let last = t0, done = false;
  const stop = () => {
    if (done) return; done = true; window.clearInterval(id);
    eng.silence(ctx.currentTime);
    window.setTimeout(() => { eng.stop(); try { nz.stop(); } catch { /* stopped */ } bus.disconnect(); }, 400);
  };
  const id = window.setInterval(() => {
    const t = ctx.currentTime, e = t - t0; if (e > DYNO_SECONDS) { stop(); return; }
    const k = dynoAt(e); eng.update(t, Math.min(0.1, t - last), k.rpm, k.thr, k.gear, k.sp, false, false); last = t;
  }, 16);
  return stop;
}

/** QA: render the dyno drive offline for a tone; resolves to mono samples (sampleRate Hz) */
export async function renderDyno(voice: EngineVoice, sampleRate = 48000): Promise<Float32Array> {
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.floor(DYNO_SECONDS * sampleRate), sampleRate);
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx); nz.loop = true; nz.start();
  const eng = new PlayerEngine(ctx, ctx.destination, nz, voice, true);
  const step = (128 * 6) / sampleRate;
  for (let k = 1; k * step < DYNO_SECONDS - step; k++) {
    const t = k * step;
    void ctx.suspend(t).then(() => { const d = dynoAt(t); eng.update(t, step, d.rpm, d.thr, d.gear, d.sp, false, false); void ctx.resume(); });
  }
  const buf = await ctx.startRendering();
  const a = buf.getChannelData(0), b = buf.getChannelData(1), m = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5;
  return m;
}

// ------------------------------------------------------------------ RaceAudio
export class RaceAudio {
  private ctx: AudioContext | null;
  private bus: GainNode | null = null;
  private engine: PlayerEngine | null = null;
  private rivals: RivalEngine[] = [];
  private srcs: AudioScheduledSourceNode[] = [];
  private skid: Ctl | null = null; private skidRate: Ctl | null = null; private skidHiss: Ctl | null = null;
  private wind: Ctl | null = null; private windF: Ctl | null = null; private road: Ctl | null = null; private roadF: Ctl | null = null;
  private nitroG: Ctl | null = null; private gravel: Ctl | null = null; private gravelRate: Ctl | null = null; private rumble: Ctl | null = null;
  private boosting = false; private lastBoostSfx = -9; private lastT = 0; private skidAmt = 0; private lastChirp = -9; private gust = 0;
  private used = new Uint8Array(8);
  private analyser: AnalyserNode | null = null; private abuf: Float32Array<ArrayBuffer> | null = null;
  musicKey = "rock";
  /** overall level of the racing soundscape (engine + loops); 0..1.5 */
  engineLevel = 1;

  constructor(private voice: EngineVoice) {
    this.ctx = audio.ensure();
  }

  start() {
    const ctx = this.ctx, out = audio.sfxOut;
    if (!ctx || !out || this.bus) return;
    // ~2-4 dB above the music bus while racing, so the music still drives
    this.bus = ctx.createGain(); this.bus.gain.value = 0.5; this.bus.connect(out);
    // one shared noise source feeds every noise-based layer
    const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx); nz.loop = true; nz.start(); this.srcs.push(nz);
    this.engine = new PlayerEngine(ctx, this.bus, nz, this.voice);
    for (let i = 0; i < 3; i++) this.rivals.push(new RivalEngine(ctx, this.bus));
    const g = () => { const n = ctx.createGain(); n.gain.value = 0; n.connect(this.bus!); return n; };
    const bq = (type: BiquadFilterType, f: number, q: number) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    // tyre squeal loop + rubber hiss
    const sq = ctx.createBufferSource(); sq.buffer = squealBuffer(ctx); sq.loop = true; sq.loopEnd = sq.buffer.duration;
    const sqG = g(); sq.connect(sqG); sq.start(); this.srcs.push(sq);
    this.skid = new Ctl(sqG.gain); this.skidRate = new Ctl(sq.playbackRate);
    const hissBP = bq("bandpass", 2600, 0.9), hissG = g(); nz.connect(hissBP).connect(hissG); this.skidHiss = new Ctl(hissG.gain);
    // wind (with speed) and road roar
    const wBP = bq("bandpass", 700, 0.55), wG = g(); nz.connect(wBP).connect(wG); this.wind = new Ctl(wG.gain); this.windF = new Ctl(wBP.frequency);
    const rLP = bq("lowpass", 300, 0.7), rG = g(); nz.connect(rLP).connect(rG); this.road = new Ctl(rG.gain); this.roadF = new Ctl(rLP.frequency);
    // nitro flame roar
    const nBP = bq("bandpass", 950, 0.45), nG = g(); nz.connect(nBP).connect(nG); this.nitroG = new Ctl(nG.gain);
    // off-road gravel + rumble (also kerbs)
    const gv = ctx.createBufferSource(); gv.buffer = gravelBuffer(ctx); gv.loop = true;
    const gvG = g(); gv.connect(gvG); gv.start(); this.srcs.push(gv);
    this.gravel = new Ctl(gvG.gain); this.gravelRate = new Ctl(gv.playbackRate);
    const ruLP = bq("lowpass", 130, 1.6), ruG = g(); nz.connect(ruLP).connect(ruG); this.rumble = new Ctl(ruG.gain);
    this.lastT = ctx.currentTime;
    this.engine.update(this.lastT, 0, 0.04, 0, 1, 0, false, false); // idling on the grid until the first update
  }

  /** per-frame update for the player car (rpm 0..1, throttle 0..1, speed01 0..1, slip 0..1) */
  update(s: { rpm: number; throttle: number; gear: number; speed01: number; boosting: boolean; slip: number; drifting: boolean; offroad: boolean; air: boolean }) {
    const ctx = this.ctx;
    if (!ctx || !this.engine) return;
    const t = ctx.currentTime, dt = Math.max(0, Math.min(0.1, t - this.lastT)); this.lastT = t;
    const lv = this.engineLevel, sp = clamp01(s.speed01);
    this.engine.level = lv;
    this.engine.update(t, dt, clamp01(s.rpm), clamp01(s.throttle), s.gear, sp, s.boosting, s.air);
    // tyres: squeal follows slip (no squeal in the air or when crawling); a chirp when a slide starts
    const slip = s.air ? 0 : clamp01((s.slip - 0.06) * 1.25 + (s.drifting ? 0.35 : 0)) * clamp01(sp * 6);
    this.skid!.to(slip * 0.5 * lv, t, slip > this.skidAmt ? 0.03 : 0.08);
    this.skidRate!.to(0.82 + 0.26 * slip + 0.14 * sp + (Math.random() - 0.5) * 0.02, t, 0.05);
    this.skidHiss!.to(slip * 0.16 * lv, t, 0.05);
    if (slip > 0.5 && this.skidAmt < 0.2 && t - this.lastChirp > 0.9) { this.lastChirp = t; this.sfx("screech", { gain: 0.45 * lv, rate: 0.95 + Math.random() * 0.1 }); }
    this.skidAmt = slip;
    // speed: road roar + wind with gusts
    this.gust += ((Math.random() * 2 - 1) - this.gust) * Math.min(1, dt * 1.5);
    this.wind!.to(sp * sp * 0.42 * (1 + 0.25 * this.gust) * lv, t, 0.12); this.windF!.to(450 + sp * 2200, t, 0.2);
    this.road!.to(Math.pow(sp, 1.2) * 0.26 * (s.air ? 0.1 : s.offroad ? 0.5 : 1) * lv, t, 0.1); this.roadF!.to(160 + sp * 650, t, 0.2);
    // nitro: flickering flame roar on top of the engine (which also gets louder / brighter)
    this.nitroG!.to(s.boosting ? 0.3 * (0.8 + Math.random() * 0.4) * lv : 0, t, s.boosting ? 0.03 : 0.12);
    // off-road / kerb
    const off = s.offroad && !s.air ? clamp01(sp * 2.5) : 0;
    this.gravel!.to(off * 0.42 * lv, t, 0.06); this.gravelRate!.to(0.6 + sp * 0.8, t, 0.1);
    this.rumble!.to(off * 0.6 * (0.6 + Math.random() * 0.8) * lv, t, 0.04);
    if (s.boosting && !this.boosting && t - this.lastBoostSfx > 0.5) this.sfx("boostStart");
    this.boosting = s.boosting;
  }

  /** nearest rivals: dist (m, + = ahead), side (lateral offset / 6 m, - left .. + right), closing speed (m/s, + = approaching) */
  rivalsUpdate(list: RivalIn[]) {
    const ctx = this.ctx;
    if (!ctx || !this.rivals.length) return;
    const t = ctx.currentTime, used = this.used, n = Math.min(list.length, 3);
    used.fill(0);
    // stable assignment: each car (nearest first) keeps the voice that was closest to where it was last frame
    for (let i = 0; i < n; i++) {
      const o = list[i]; let best = -1, bc = 1e9;
      for (let k = 0; k < this.rivals.length; k++) {
        if (used[k]) continue;
        const r = this.rivals[k];
        const c = r.active ? Math.abs(o.dist - r.lastDist) + 4 * Math.abs(o.side - r.lastSide) + (o.voice && o.voice !== r.voice ? 20 : 0) : 40;
        if (c < bc) { bc = c; best = k; }
      }
      if (best < 0) continue;
      used[best] = 1; this.rivals[best].update(t, o, 0.55 * this.engineLevel);
    }
    for (let k = 0; k < this.rivals.length; k++) if (!used[k]) this.rivals[k].fade(t);
  }

  sfx(name: RaceSfx, o: { gain?: number; pan?: number; rate?: number } = {}) {
    const d = SFX[name];
    if (!d) return;
    if ((name === "boostStart" || name === "nitro") && this.ctx) this.lastBoostSfx = this.ctx.currentTime;
    audio.play(d.s, { gain: (d.gain ?? 0.7) * (o.gain ?? 1), pan: o.pan, rate: (d.rate ?? 1) * (o.rate ?? 1), duck: false, reverb: d.rv ?? 0.2 });
  }
  /** countdown: 3-2-1 beeps, then the long high GO beep (race.ts layers sfx("go") — the big stinger — on top) */
  beep(final: boolean) { this.sfx(final ? "beepGo" : "beep"); }

  music(intense: boolean) { void audio.playMusic(raceMusic(this.musicKey, intense)); }
  stopMusic() { audio.stopMusic(0.6); }

  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine?.silence(t);
    for (const c of [this.skid, this.skidHiss, this.wind, this.road, this.nitroG, this.gravel, this.rumble]) c?.now(0, t);
    for (const r of this.rivals) r.fade(t);
  }

  /** QA: offline dyno render of this car's engine (or another tone) as 16-bit PCM, base64 */
  async dyno(tone?: Tone) {
    const x = await renderDyno(tone ? { ...this.voice, tone } : this.voice);
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
    const u8 = new Uint8Array(pcm.buffer); let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /** QA / debug: RMS and peak (dBFS) of the racing soundscape bus right now */
  levels() {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return null;
    if (!this.analyser) { this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048; this.abuf = new Float32Array(2048); this.bus.connect(this.analyser); }
    const b = this.abuf!; this.analyser.getFloatTimeDomainData(b);
    let s = 0, p = 0; for (let i = 0; i < b.length; i++) { s += b[i] * b[i]; p = Math.max(p, Math.abs(b[i])); }
    const db = (x: number) => Math.round(20 * Math.log10(x + 1e-9) * 10) / 10;
    return { rms: db(Math.sqrt(s / b.length)), peak: db(p), state: ctx.state };
  }

  dispose() {
    this.engine?.stop(); this.rivals.forEach((r) => r.stop());
    for (const s of this.srcs) { try { s.stop(); } catch { /* already stopped */ } }
    this.analyser?.disconnect(); this.bus?.disconnect();
    this.engine = null; this.rivals = []; this.srcs = []; this.bus = null; this.analyser = null;
  }
}
