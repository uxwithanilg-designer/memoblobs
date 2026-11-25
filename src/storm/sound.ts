// Blockstorm's sound: the effects (sfx_storm_*.mp3 from scripts/gen_storm_audio.py) — blaster shots, rockets and
// booms, blocks breaking by material (soil, wood, stone, metal, glass, gloom), towers collapsing, monsters' growls and
// hops and flaps, pickups, powers, friends, the boss — placed around the camera: each sound is panned to where it
// happens and fades with distance, so the fight sounds all around you. Each world adds its ambience (birds, wind, a
// city, owls, crickets, bubbling lava, gulls, gears, chimes, frogs, goo, beeps, glitches, drums, crows) from random
// sides.
import { audio, type Sound } from "@/lib/audio";
import type { Ambient } from "./worlds";

export const STORM_SFX = [
  "shoot", "shootDry", "rocket", "boom", "hit", "hitBlock", "breakSoft", "breakWood", "breakStone", "breakMetal", "breakGlass",
  "breakGloom", "collapse", "crumble", "coreBreak", "enemyDie", "enemyDieBig", "growl", "growlBig", "hop", "flap", "spit",
  "splat", "fuse", "swing", "slam", "hurt", "die", "jump", "land", "coin", "gem", "oil", "heart", "health", "power",
  "shield", "shieldPop", "ally", "arrow", "sword", "punch", "bossRoar", "warn", "go", "clear", "worldClear", "stageStart",
  "lowOil", "freed", "beaconHit", "rift", "tap", "open", "buy", "upgrade", "whoosh",
] as const;
export type StormSfx = (typeof STORM_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], wind: ["wind"], city: ["city"], owl: ["owl"], crickets: ["crickets"], lava: ["lava"], bubbles: ["bubbles"],
  gulls: ["gull"], gears: ["gears"], chimes: ["chimes"], frogs: ["frog"], goo: ["goo"], beeps: ["beeps"], glitch: ["glitch"], drums: ["drums"], crows: ["crow"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
export const sfxName = (k: string): Sound => `a:storm_${k}` as Sound;
export const STORM_SOUNDS: Sound[] = [...STORM_SFX, ...ALL_AMBIENT].map(sfxName);
/** the sounds the first seconds of play need */
export const FIRST_SOUNDS: Sound[] = (["shoot", "hit", "hitBlock", "breakSoft", "breakStone", "breakWood", "enemyDie", "coin", "go", "stageStart", "tap", "open", "jump", "land", "growl", "hop"] as StormSfx[]).map(sfxName);

const GAIN: Partial<Record<StormSfx, number>> = {
  shoot: 0.32, shootDry: 0.3, hit: 0.5, hitBlock: 0.35, coin: 0.4, gem: 0.6, jump: 0.3, land: 0.35, hop: 0.35, flap: 0.3, growl: 0.45,
  boom: 0.95, collapse: 0.85, crumble: 0.5, enemyDie: 0.55, tap: 0.4, open: 0.45, clear: 0.9, worldClear: 0.95, stageStart: 0.7,
};

/** listener: where the camera is and which way its right side points (set every frame) */
export const ear = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function sfx(k: StormSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), {
    gain: (GAIN[k] ?? 0.62) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay,
    reverb: k === "boom" || k === "collapse" || k === "bossRoar" || k === "clear" ? 0.32 : 0.14,
    duck: k === "clear" || k === "worldClear" || k === "bossRoar",
  });
}
/** a sound somewhere in the world: panned to its side of the camera, quieter far away */
export function sfxAt(k: StormSfx, x: number, y: number, z: number, o: { rate?: number; gain?: number; far?: number } = {}) {
  const dx = x - ear.x, dy = y - ear.y, dz = z - ear.z;
  const d = Math.hypot(dx, dy, dz);
  const far = o.far ?? 34;
  if (d > far * 1.6) return;
  const fall = 1 / (1 + (d / (far * 0.35)) ** 2);
  const side = d > 0.5 ? (dx * ear.rx + dz * ear.rz) / d : 0;
  sfx(k, { pan: Math.max(-0.95, Math.min(0.95, side * 0.9)), rate: o.rate, gain: (o.gain ?? 1) * fall });
}

/** the world around you: a call now and then from a random side */
export class Ambience {
  private next = 2; private t = 0; private list: string[] = [];
  set(a: Ambient[]) { this.list = a.flatMap((x) => AMBIENT_SFX[x]); this.next = 2 + Math.random() * 3; this.t = 0; }
  update(dt: number) {
    if (!this.list.length) return;
    this.t += dt;
    if (this.t < this.next) return;
    this.t = 0; this.next = 5 + Math.random() * 8;
    const k = this.list[Math.floor(Math.random() * this.list.length)];
    const side = Math.random() < 0.5 ? -1 : 1;
    audio.play(sfxName(k), { gain: 0.16 + Math.random() * 0.16, pan: side * (0.3 + Math.random() * 0.65), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
  }
}
