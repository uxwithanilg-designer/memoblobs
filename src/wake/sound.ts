// Wake Racers' sound: the effects (sfx_wake_*.mp3, made by scripts/gen_wake_audio.py), your boat's engine (the racing
// studio's engine synth with each boat's own voice: a buzzy outboard, a screaming jet ski, a V8 offshore racer, a diesel
// tug, a humming hover racer…), the hull's roar on the water and the hiss of spray (made live from noise), the rivals'
// engines around you with doppler and left/right placement, and each world's ambience (gulls and surf, hawks and wind,
// ship horns and harbour bells, cracking ice, jungle birds and frogs, wind chimes, lava bubbling, thunder, cave drips,
// synth hums, crowds) placed at random sides and distances so the world sounds wide.
import { audio, type Sound } from "@/lib/audio";
import { RaceAudio } from "@/racing/audio";
import type { EngineVoice } from "@/racing/types";
import type { Ambient } from "./worlds";

export const WAKE_SFX = [
  "coin", "heart", "fuel", "box", "power", "turbo", "shield", "shieldPop", "magnet", "wave", "ghost", "hop", "freeze",
  "splash", "splashBig", "land", "jump", "hit", "bump", "wall", "mine", "smash", "pad", "nitro", "checkpoint", "timeAdd",
  "knockout", "finish", "lose", "go", "beep", "overtake", "nearMiss", "lowFuel", "horn", "tap", "open", "buy", "whoosh",
  "wreck", "docked", "cheer", "star", "unlock",
] as const;
export type WakeSfx = (typeof WAKE_SFX)[number];
export const AMBIENT: Ambient[] = ["gull", "surf", "parrot", "whale", "hawk", "wind", "horn", "bell", "ice", "frog", "chime", "lava", "thunder", "drip", "synth", "monkey", "crowd"];
const ambName = (a: Ambient) => `amb_${a}`;

export const sfxName = (k: string): Sound => `a:wake_${k}` as Sound;
export const WAKE_SOUNDS: Sound[] = [...WAKE_SFX, ...AMBIENT.map(ambName)].map(sfxName);
export const MENU_SOUNDS: Sound[] = (["tap", "open", "buy", "go", "beep", "coin", "whoosh", "unlock", "star"] as const).map(sfxName);

const GAIN: Partial<Record<WakeSfx, number>> = {
  coin: 0.38, heart: 0.75, fuel: 0.7, box: 0.65, power: 0.75, splash: 0.7, splashBig: 0.9, land: 0.6, jump: 0.55, hit: 0.85, bump: 0.45,
  wall: 0.5, mine: 0.95, smash: 0.55, pad: 0.6, nitro: 0.6, checkpoint: 0.7, finish: 0.9, go: 0.8, beep: 0.55, tap: 0.4, open: 0.5,
  whoosh: 0.5, nearMiss: 0.5, lowFuel: 0.6, horn: 0.55, overtake: 0.55, cheer: 0.6,
};
const BIG: Partial<Record<WakeSfx, true>> = { mine: true, finish: true, splashBig: true, hit: true, wreck: true, cheer: true };

export function sfx(k: WakeSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: BIG[k] ? 0.32 : 0.14, duck: k === "finish" || k === "lose" || k === "wreck" });
}

/** your engine, the water under the hull, the rivals around you and the world's ambience */
export class WakeAudio {
  private race: RaceAudio | null = null;
  private amb: string[] = [];
  private nextAmb = 2.5; private last = 0;
  private hullG: GainNode | null = null; private hissG: GainNode | null = null; private hissF: BiquadFilterNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private bus: GainNode | null = null;
  constructor(private voice: EngineVoice) {}
  start(ambience: Ambient[]) {
    this.amb = ambience.map(ambName);
    if (this.race) return;
    this.race = new RaceAudio(this.voice);
    this.race.engineLevel = 0.85;
    this.race.start();
    // the hull's roar and the spray's hiss, from one looping noise buffer
    const ctx = audio.ensure(), out = audio.sfxOut;
    if (!ctx || !out) return;
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.2; }
    this.src = ctx.createBufferSource(); this.src.buffer = buf; this.src.loop = true;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9; this.bus.connect(out);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    this.hullG = ctx.createGain(); this.hullG.gain.value = 0;
    this.hissF = ctx.createBiquadFilter(); this.hissF.type = "bandpass"; this.hissF.frequency.value = 2600; this.hissF.Q.value = 0.7;
    this.hissG = ctx.createGain(); this.hissG.gain.value = 0;
    this.src.connect(lp).connect(this.hullG).connect(this.bus);
    this.src.connect(this.hissF).connect(this.hissG).connect(this.bus);
    this.src.start();
  }
  setVoice(v: EngineVoice) { if (v === this.voice) return; this.voice = v; this.race?.dispose(); this.race = null; }
  /** speed01 0..1(+), throttle 0..1 */
  update(dt: number, speed01: number, throttle: number, boosting: boolean, air: boolean, slide: number) {
    const rpm = Math.min(1, 0.12 + speed01 * 0.75 + throttle * 0.15);
    this.race?.update({ rpm, throttle, gear: 1 + Math.min(4, Math.floor(speed01 * 5)), speed01: Math.min(1, speed01), boosting: false, slip: 0, drifting: false, offroad: false, air });
    const ctx = audio.ctx;
    if (ctx && this.hullG && this.hissG && this.hissF) {
      const t = ctx.currentTime, on = air ? 0.1 : 1;
      this.hullG.gain.setTargetAtTime(Math.min(1, speed01) * 0.34 * on, t, 0.08);
      this.hissG.gain.setTargetAtTime((Math.min(1, speed01) * 0.2 + slide * 0.25 + (boosting ? 0.12 : 0)) * on, t, 0.06);
      this.hissF.frequency.setTargetAtTime(1800 + speed01 * 2400, t, 0.1);
    }
    // ambience: a call now and then, somewhere to the left or right
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmb) {
      this.last = 0; this.nextAmb = 3 + Math.random() * 6;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      audio.play(sfxName(k), { gain: 0.12 + Math.random() * 0.16, pan: side * (0.35 + Math.random() * 0.6), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
    }
  }
  /** nearest rivals: distance along the course (+ ahead), lateral offset (m), closing speed (m/s) */
  private rl = [0, 1, 2].map(() => ({ rpm: 0, throttle: 0, gear: 3, dist: 0, side: 0, closing: 0, voice: undefined as EngineVoice | undefined }));
  rivals(list: { rpm: number; throttle: number; dist: number; side: number; closing: number; voice: EngineVoice }[], count = list.length) {
    const out = this.rl;
    out.length = 0;
    for (let i = 0; i < count && i < 3; i++) {
      const r = list[i], o = this.pool[i];
      o.rpm = r.rpm; o.throttle = r.throttle; o.dist = r.dist; o.side = r.side / 6; o.closing = r.closing; o.voice = r.voice;
      out.push(o);
    }
    this.race?.rivalsUpdate(out);
  }
  private pool = [0, 1, 2].map(() => ({ rpm: 0, throttle: 0, gear: 3, dist: 0, side: 0, closing: 0, voice: undefined as EngineVoice | undefined }));
  thunder() { audio.play(sfxName("amb_thunder"), { gain: 0.5 + Math.random() * 0.3, pan: (Math.random() - 0.5) * 1.2, rate: 0.85 + Math.random() * 0.2, reverb: 0.5, duck: false }); }
  silence() {
    this.race?.silence();
    const ctx = audio.ctx;
    if (ctx && this.hullG && this.hissG) { this.hullG.gain.setTargetAtTime(0, ctx.currentTime, 0.05); this.hissG.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
  }
  dispose() {
    this.race?.dispose(); this.race = null;
    try { this.src?.stop(); } catch { /* stopped */ }
    this.bus?.disconnect(); this.src = null; this.bus = null; this.hullG = null; this.hissG = null;
  }
}
