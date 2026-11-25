// Peak Rover's sound: one music track per world (and a calm theme for the menus), the effects (sfx_rover_*.mp3,
// scripts/gen_rover_audio.py), a live engine (the racing studio's engine synth, tuned per ride) and the world's
// ambience — birds, gulls, owls, frogs, a distant city, cave drips, radio beeps — placed left and right around the
// player (each one panned to a random side and distance), so the world sounds wide.
import { audio, type Sound } from "@/lib/audio";
import { RaceAudio } from "@/racing/audio";
import type { EngineVoice } from "@/racing/types";
import type { Ambient } from "./worlds";

export const ROVER_SFX = [
  "coin", "coinBig", "gem", "fuel", "heart", "power", "turbo", "shield", "shieldPop", "magnet", "feather",
  "land", "landHard", "bump", "crash", "checkpoint", "finish", "go", "beep", "flip", "bigAir", "lowFuel", "sputter",
  "lifeLost", "gameOver", "worldClear", "tap", "open", "upgrade", "buy", "whoosh",
] as const;
export type RoverSfx = (typeof ROVER_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], hawk: ["hawk"], loon: ["loon"], wind: ["gust"], owl: ["owl"], city: ["horn", "siren"],
  frogs: ["frog"], rumble: ["rumble"], gulls: ["gull"], crows: ["crow"], drips: ["drip"], beeps: ["radio"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];

export const sfxName = (k: string): Sound => `a:rover_${k}` as Sound;
export const ROVER_SOUNDS: Sound[] = [...ROVER_SFX, ...ALL_AMBIENT].map(sfxName);

const GAIN: Partial<Record<RoverSfx, number>> = { coin: 0.42, coinBig: 0.55, gem: 0.7, fuel: 0.7, heart: 0.75, power: 0.7, land: 0.55, landHard: 0.75, bump: 0.45, crash: 0.85, finish: 0.9, go: 0.8, beep: 0.5, tap: 0.4, open: 0.5, lowFuel: 0.55, whoosh: 0.5 };

export function sfx(k: RoverSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "crash" || k === "finish" || k === "worldClear" ? 0.3 : 0.14, duck: k === "finish" || k === "worldClear" || k === "gameOver" });
}

/** the engine and the world around the player */
export class RoverAudio {
  private race: RaceAudio | null = null;
  private nextAmbient = 3;
  private amb: string[] = [];
  private last = 0;
  constructor(private voice: EngineVoice) {}
  start(ambience: Ambient[]) {
    this.amb = ambience.flatMap((a) => AMBIENT_SFX[a]);
    if (this.race) return;
    this.race = new RaceAudio(this.voice);
    this.race.engineLevel = 0.85;
    this.race.start();
  }
  setAmbience(ambience: Ambient[]) { this.amb = ambience.flatMap((a) => AMBIENT_SFX[a]); }
  /** rpm 0..1, throttle 0..1, speed 0..1 */
  update(dt: number, rpm: number, throttle: number, speed: number, air: boolean, turbo: boolean, offroad: boolean) {
    this.race?.update({ rpm, throttle, gear: 1, speed01: speed, boosting: false, slip: 0, drifting: false, offroad: offroad && !air, air });
    void turbo;
    // ambience: a call now and then, somewhere to the left or right
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmbient) {
      this.last = 0; this.nextAmbient = 4 + Math.random() * 7;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      audio.play(sfxName(k), { gain: 0.16 + Math.random() * 0.18, pan: side * (0.35 + Math.random() * 0.6), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
    }
  }
  silence() { this.race?.silence(); }
  dispose() { this.race?.dispose(); this.race = null; }
}
