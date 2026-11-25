// Rumble Rally's sound: the effects (sfx_rumble_*.mp3, synthesised by scripts/gen_rumble_audio.py), a live engine
// for the player's truck (the racing studio's engine synth, tuned per truck), rivals' engines and horns panned to
// where they are on screen, and each world's ambience — desert wind, crows over the ruins, bubbling lava, radio
// beeps at the station, ship horns and gulls in the harbour, waves, parrots, drips in the mine, machines in the
// scrapyard, thunder, chimes and bells — placed left and right around the player at random distances, so the world
// sounds wide. Rockets, blasts and rams are panned by where they happen.
import { audio, type Sound } from "@/lib/audio";
import { RaceAudio } from "@/racing/audio";
import type { EngineVoice } from "@/racing/types";
import type { Ambient, AnimalKind } from "./worlds";

export const RUMBLE_SFX = [
  "coin", "coinBig", "gem", "fuel", "heart", "power", "nitro", "shield", "magnet", "rocketPick",
  "launch", "blast", "hit", "ram", "shieldHit", "land", "landHard", "crash", "checkpoint", "overtake", "passed",
  "light", "go", "finish", "win", "podium", "lose", "lifeLost", "lowFuel", "sputter", "horn", "crowd", "cheer",
  "tap", "open", "upgrade", "buy", "whoosh", "splash", "mud", "flap", "rustle", "worldClear",
] as const;
export type RumbleSfx = (typeof RUMBLE_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  wind: ["gust"], gulls: ["gull"], crows: ["crow"], birds: ["birdA", "birdB"], parrots: ["parrot"], waves: ["wave"], machines: ["machine"],
  horns: ["shiphorn"], drips: ["drip"], thunder: ["thunder"], chimes: ["chime"], beeps: ["radio"], lava: ["lava"], bells: ["bell"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
/** what an animal says when a truck startles it */
export const ANIMAL_CALL: Record<AnimalKind, string> = {
  bird: "flap", rabbit: "rustle", critter: "radio", penguin: "flap", crab: "rustle", monkey: "parrot", camel: "rustle", goat: "rustle",
};

export const sfxName = (k: string): Sound => `a:rumble_${k}` as Sound;
export const RUMBLE_SOUNDS: Sound[] = [...RUMBLE_SFX, ...ALL_AMBIENT].map(sfxName);
/** the menu's sounds (preloaded first) */
export const UI_SOUNDS: Sound[] = (["tap", "open", "upgrade", "buy", "go", "light", "coin"] as const).map(sfxName);

const GAIN: Partial<Record<RumbleSfx, number>> = {
  coin: 0.4, coinBig: 0.55, gem: 0.7, fuel: 0.7, heart: 0.75, power: 0.7, land: 0.5, landHard: 0.75, crash: 0.85, launch: 0.6, blast: 0.85, hit: 0.8, ram: 0.7,
  finish: 0.85, win: 0.9, podium: 0.85, go: 0.8, light: 0.55, tap: 0.4, open: 0.5, lowFuel: 0.55, whoosh: 0.5, horn: 0.6, crowd: 0.45, cheer: 0.7, overtake: 0.55, passed: 0.45,
};

export function sfx(k: RumbleSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  const big = k === "win" || k === "podium" || k === "worldClear" || k === "lose";
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "blast" || k === "crash" || big ? 0.3 : 0.12, duck: big });
}
/** a world sound placed at a pan */
export function ambient(name: string, pan: number, gain = 0.3) {
  audio.play(sfxName(name), { gain, pan, rate: 0.94 + Math.random() * 0.12, reverb: 0.35, duck: false });
}

/** the engine and the world around the player */
export class RumbleAudio {
  private race: RaceAudio | null = null;
  private nextAmbient = 3;
  private amb: string[] = [];
  private last = 0;
  constructor(private voice: EngineVoice) {}
  start(ambience: Ambient[]) {
    this.amb = ambience.flatMap((a) => AMBIENT_SFX[a]);
    if (this.race) return;
    this.race = new RaceAudio(this.voice);
    this.race.engineLevel = 0.8;
    this.race.start();
  }
  setAmbience(ambience: Ambient[]) { this.amb = ambience.flatMap((a) => AMBIENT_SFX[a]); }
  /** rpm 0..1, throttle 0..1, speed 0..1 */
  update(dt: number, rpm: number, throttle: number, speed: number, air: boolean, offroad: boolean, boosting: boolean) {
    this.race?.update({ rpm, throttle, gear: 1, speed01: speed, boosting, slip: 0, drifting: false, offroad: offroad && !air, air });
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmbient) {
      this.last = 0; this.nextAmbient = 4 + Math.random() * 6;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      ambient(k, side * (0.35 + Math.random() * 0.6), 0.15 + Math.random() * 0.18);
    }
  }
  silence() { this.race?.silence(); }
  dispose() { this.race?.dispose(); this.race = null; }
}
