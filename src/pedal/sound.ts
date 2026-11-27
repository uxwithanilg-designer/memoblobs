// Obby Bike Blaster's sound: the effects (sfx_pedal_*.mp3 from scripts/gen_pedal_audio.py) — the freewheel ticking
// and tyre roll, hops and landings, the bike bell, jelly boings, boost whooshes, coins and pickups, powers, the
// checkpoint chime and the finish fanfare, crashes and falls, the blaster, targets, crates and gremlins, traps (laser
// zaps, hammer and spinner whooshes, bridge creaks) — placed around the camera (panned to their side, quieter far
// away). Each world adds its ambience from random sides.
import { audio, type Sound } from "@/lib/audio";
import type { Ambient } from "./worlds";

export const PEDAL_SFX = [
  "tick", "roll", "jump", "land", "landHard", "bell", "bounce", "boost", "coin", "gem", "oil", "heart", "power", "shield", "shieldPop",
  "wings", "checkpoint", "sector", "finish", "worldClear", "levelStart", "go", "crash", "fall", "respawn", "wall", "squeak", "lowOil",
  "lifeLost", "outOfLives", "shoot", "targetHit", "bridge", "crate", "gremlin", "gremlinPop", "laser", "whoosh", "tap", "open", "buy", "upgrade",
] as const;
export type PedalSfx = (typeof PEDAL_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], wind: ["wind"], city: ["city"], owl: ["owl"], crickets: ["crickets"], lava: ["lava"], bubbles: ["bubbles"], gulls: ["gull"],
  gears: ["gears"], chimes: ["chimes"], frogs: ["frog"], beeps: ["beeps"], glitch: ["glitch"], thunder: ["thunder"], crows: ["crow"], space: ["space"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
export const sfxName = (k: string): Sound => `a:pedal_${k}` as Sound;
export const PEDAL_SOUNDS: Sound[] = [...PEDAL_SFX, ...ALL_AMBIENT].map(sfxName);
export const FIRST_SOUNDS: Sound[] = (["tick", "roll", "jump", "land", "coin", "checkpoint", "go", "levelStart", "tap", "open", "crash", "fall", "respawn", "shoot", "bell"] as PedalSfx[]).map(sfxName);

const GAIN: Partial<Record<PedalSfx, number>> = { tick: 0.22, roll: 0.25, coin: 0.4, jump: 0.35, land: 0.4, shoot: 0.3, tap: 0.4, open: 0.45, finish: 0.9, worldClear: 0.95, levelStart: 0.7, crash: 0.8, whoosh: 0.5, squeak: 0.35 };
export const ear = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function sfx(k: PedalSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.62) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "finish" || k === "crash" || k === "worldClear" ? 0.3 : 0.12, duck: k === "finish" || k === "worldClear" });
}
export function sfxAt(k: PedalSfx, x: number, y: number, z: number, o: { rate?: number; gain?: number; far?: number } = {}) {
  const dx = x - ear.x, dy = y - ear.y, dz = z - ear.z, d = Math.hypot(dx, dy, dz), far = o.far ?? 30;
  if (d > far * 1.6) return;
  const fall = 1 / (1 + (d / (far * 0.35)) ** 2);
  const side = d > 0.5 ? (dx * ear.rx + dz * ear.rz) / d : 0;
  sfx(k, { pan: Math.max(-0.95, Math.min(0.95, side * 0.9)), rate: o.rate, gain: (o.gain ?? 1) * fall });
}
export class Ambience {
  private next = 2; private t = 0; private list: string[] = [];
  set(a: Ambient[]) { this.list = a.flatMap((x) => AMBIENT_SFX[x]); this.next = 2 + Math.random() * 3; this.t = 0; }
  update(dt: number) {
    if (!this.list.length) return;
    this.t += dt;
    if (this.t < this.next) return;
    this.t = 0; this.next = 5 + Math.random() * 8;
    const k = this.list[Math.floor(Math.random() * this.list.length)], side = Math.random() < 0.5 ? -1 : 1;
    audio.play(sfxName(k), { gain: 0.16 + Math.random() * 0.16, pan: side * (0.3 + Math.random() * 0.65), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
  }
}
