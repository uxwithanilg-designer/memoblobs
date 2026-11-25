// Gizmo Drive's sound: the effects (sfx_gizmo_*.mp3, made by scripts/gen_gizmo_audio.py), a live engine for each ride
// (the racing studio's engine synth: a buzzy jeep, a V8 monster truck, a diesel bus and tractor, an electric moon bug…)
// and each world's ambience — toy chimes and a train whistle, bubbling candy, jackhammers and reversing trucks, wind and
// birds, synth zaps, cracking ice and howling wind, creaking metal and crows, owls and frogs, whale song, clock ticks
// and steam, ghosts and bats, radio beeps and airlocks — placed left and right around the player, at random sides and
// distances, so the world sounds wide.
import { audio, type Sound } from "@/lib/audio";
import { RaceAudio } from "@/racing/audio";
import type { EngineVoice } from "@/racing/types";
import type { Ambient } from "./worlds";

export const GIZMO_SFX = [
  "coin", "star", "fuel", "heart", "power", "turbo", "shield", "shieldPop", "magnet", "float", "grip",
  "land", "landHard", "bump", "crash", "splash", "checkpoint", "finish", "go", "beep", "flip", "bigAir", "lowFuel", "sputter",
  "lifeLost", "gameOver", "worldClear", "tap", "open", "buy", "whoosh",
  "button", "gate", "spring", "crate", "creak", "crumble", "clank", "loop", "swoosh", "stamp", "newGizmo",
] as const;
export type GizmoSfx = (typeof GIZMO_SFX)[number];
export const AMBIENT: Ambient[] = [
  "chime", "whistle", "cuckoo", "bubble", "pop", "jackhammer", "reverse", "clank", "gust", "bird", "zap", "blip",
  "crack", "howl", "creak", "crow", "owl", "frog", "whale", "tick", "steam", "bell", "ghost", "bat", "radio", "airlock",
];
const ambName = (a: Ambient) => `amb_${a}`;

export const sfxName = (k: string): Sound => `a:gizmo_${k}` as Sound;
/** every sound file of the game (menus first: they're preloaded at once) */
export const GIZMO_SOUNDS: Sound[] = [...GIZMO_SFX, ...AMBIENT.map(ambName)].map(sfxName);
export const MENU_SOUNDS: Sound[] = (["tap", "open", "buy", "go", "beep", "coin", "whoosh"] as const).map(sfxName);

const GAIN: Partial<Record<GizmoSfx, number>> = {
  coin: 0.4, star: 0.65, fuel: 0.7, heart: 0.75, power: 0.7, land: 0.5, landHard: 0.75, bump: 0.42, crash: 0.85, splash: 0.75,
  finish: 0.9, go: 0.8, beep: 0.5, tap: 0.4, open: 0.5, lowFuel: 0.55, whoosh: 0.5, button: 0.6, gate: 0.55, spring: 0.75,
  crate: 0.75, creak: 0.45, crumble: 0.55, clank: 0.5, loop: 0.6, swoosh: 0.5, stamp: 0.7, newGizmo: 0.7,
};
const BIG: Partial<Record<GizmoSfx, true>> = { crash: true, finish: true, worldClear: true, splash: true, stamp: true };

export function sfx(k: GizmoSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: BIG[k] ? 0.3 : 0.14, duck: k === "finish" || k === "worldClear" || k === "gameOver" });
}

/** the engine and the world around the player */
export class GizmoAudio {
  private race: RaceAudio | null = null;
  private nextAmbient = 2.5;
  private amb: string[] = [];
  private last = 0;
  constructor(private voice: EngineVoice) {}
  start(ambience: Ambient[]) {
    this.setAmbience(ambience);
    if (this.race) return;
    this.race = new RaceAudio(this.voice);
    this.race.engineLevel = 0.78;
    this.race.start();
  }
  setAmbience(ambience: Ambient[]) { this.amb = ambience.map(ambName); }
  /** rpm 0..1, throttle 0..1, speed 0..1 */
  update(dt: number, rpm: number, throttle: number, speed: number, air: boolean) {
    this.race?.update({ rpm, throttle, gear: 1, speed01: speed, boosting: false, slip: 0, drifting: false, offroad: false, air });
    // ambience: a call now and then, somewhere to the left or right
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmbient) {
      this.last = 0; this.nextAmbient = 3.5 + Math.random() * 6;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      audio.play(sfxName(k), { gain: 0.14 + Math.random() * 0.18, pan: side * (0.35 + Math.random() * 0.6), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
    }
  }
  silence() { this.race?.silence(); }
  dispose() { this.race?.dispose(); this.race = null; }
}
