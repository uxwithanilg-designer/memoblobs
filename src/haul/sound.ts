// Tumble Truck's sound: the effects (sfx_haul_*.mp3, synthesised by scripts/gen_haul_audio.py), a live diesel or
// electric engine (the racing studio's engine synth, tuned per truck) and each world's ambience — birdsong, owls,
// frogs, crickets, a stream, bees, hens, sheep, a hawk, wind chimes, village bells, a sawmill, bubbling lava, radio
// beeps — placed left and right around the player at random distances, so the world sounds wide. Animals that take
// fright call out from where they are.
import { audio, type Sound } from "@/lib/audio";
import { RaceAudio } from "@/racing/audio";
import type { EngineVoice } from "@/racing/types";
import type { Ambient, AnimalKind } from "./worlds";

export const HAUL_SFX = [
  "coin", "coinBig", "gem", "fuel", "heart", "power", "nitro", "net", "bubble", "magnet",
  "land", "landHard", "bump", "crash", "checkpoint", "deliver", "star", "go", "beep",
  "thud", "lost", "glass", "crack", "splash", "mud", "creak", "horn", "lowFuel", "sputter", "lifeLost", "fail", "worldClear",
  "tap", "open", "upgrade", "buy", "whoosh", "flap", "rustle",
] as const;
export type HaulSfx = (typeof HAUL_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], owl: ["owl"], frogs: ["frog"], crickets: ["cricket"], wind: ["gust"], stream: ["stream"], bees: ["bees"],
  hens: ["hen"], sheep: ["sheep"], hawk: ["hawk"], chimes: ["chime"], bells: ["bell"], saw: ["saw"], lava: ["lava"], beeps: ["radio"], crows: ["crow"], ducks: ["duck"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
/** what an animal says when the truck startles it */
export const ANIMAL_CALL: Record<AnimalKind, string> = {
  deer: "rustle", rabbit: "rustle", fox: "rustle", sheep: "sheep", chicken: "hen", frog: "frog", duck: "duck", bird: "flap", crane: "flap", bee: "bees", firefly: "chime", critter: "radio",
};

export const sfxName = (k: string): Sound => `a:haul_${k}` as Sound;
export const HAUL_SOUNDS: Sound[] = [...HAUL_SFX, ...ALL_AMBIENT].map(sfxName);
/** the menu's sounds (preloaded first) */
export const UI_SOUNDS: Sound[] = (["tap", "open", "upgrade", "buy", "go", "beep", "coin"] as const).map(sfxName);

const GAIN: Partial<Record<HaulSfx, number>> = {
  coin: 0.4, coinBig: 0.55, gem: 0.7, fuel: 0.7, heart: 0.75, power: 0.7, land: 0.5, landHard: 0.75, bump: 0.45, crash: 0.85,
  deliver: 0.9, go: 0.8, beep: 0.5, tap: 0.4, open: 0.5, lowFuel: 0.55, whoosh: 0.5, thud: 0.4, lost: 0.7, glass: 0.75, crack: 0.75, horn: 0.7, star: 0.7, creak: 0.35, mud: 0.5, splash: 0.7,
};

export function sfx(k: HaulSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  const big = k === "deliver" || k === "worldClear" || k === "fail";
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "crash" || big ? 0.3 : 0.12, duck: big });
}
/** a world sound placed at a pan */
export function ambient(name: string, pan: number, gain = 0.3) {
  audio.play(sfxName(name), { gain, pan, rate: 0.94 + Math.random() * 0.12, reverb: 0.35, duck: false });
}

/** the engine and the world around the player */
export class HaulAudio {
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
  update(dt: number, rpm: number, throttle: number, speed: number, air: boolean, offroad: boolean) {
    this.race?.update({ rpm, throttle, gear: 1, speed01: speed, boosting: false, slip: 0, drifting: false, offroad: offroad && !air, air });
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
