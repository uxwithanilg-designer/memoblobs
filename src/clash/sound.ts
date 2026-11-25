// Cube Clash's sound: the effects (sfx_clash_*.mp3 from scripts/gen_clash_audio.py) — cube-blaster zaps, hits and
// knockback thumps, blocks popping into place and breaking by material, jetpack puffs, falls into the void,
// eliminations, crystals cracking and shattering, mobs, the Titan, jump pads, checkpoints, targets and bridges,
// pickups and powers — each placed around the camera (panned to its side, quieter far away). Each theme adds its
// ambience from random sides.
import { audio, type Sound } from "@/lib/audio";
import type { Ambient } from "./worlds";

export const CLASH_SFX = [
  "shoot", "boom", "hit", "hitBlock", "knock", "place", "breakSoft", "breakWood", "breakStone", "breakGlass", "breakCube", "crumble",
  "collapse", "jet", "jetEmpty", "jump", "land", "fall", "elim", "out", "respawn", "crystalHit", "crystalBreak", "crystalWarn",
  "zGrowl", "zHop", "zWisp", "zDie", "orb", "titanRoar", "titanSlam", "pad", "checkpoint", "finish", "target", "bridge", "coin",
  "gem", "oil", "heart", "health", "power", "cubes", "shield", "shieldPop", "go", "clear", "worldClear", "stageStart", "wave",
  "beep", "tap", "open", "buy", "upgrade", "whoosh",
] as const;
export type ClashSfx = (typeof CLASH_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], wind: ["wind"], gulls: ["gull"], owl: ["owl"], crickets: ["crickets"], lava: ["lava"], chimes: ["chimes"],
  frogs: ["frog"], beeps: ["beeps"], bells: ["bells"], crows: ["crow"], bubbles: ["bubbles"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
export const sfxName = (k: string): Sound => `a:clash_${k}` as Sound;
export const CLASH_SOUNDS: Sound[] = [...CLASH_SFX, ...ALL_AMBIENT].map(sfxName);
export const FIRST_SOUNDS: Sound[] = (["shoot", "hit", "hitBlock", "place", "breakSoft", "breakCube", "coin", "go", "stageStart", "tap", "open", "jump", "land", "knock", "jet"] as ClashSfx[]).map(sfxName);

const GAIN: Partial<Record<ClashSfx, number>> = {
  shoot: 0.3, hit: 0.5, hitBlock: 0.32, place: 0.42, coin: 0.4, jump: 0.3, land: 0.35, jet: 0.28, knock: 0.6, boom: 0.9, collapse: 0.85,
  crumble: 0.5, tap: 0.4, open: 0.45, clear: 0.9, worldClear: 0.95, stageStart: 0.7, elim: 0.75, zGrowl: 0.45,
};
export const ear = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function sfx(k: ClashSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  audio.play(sfxName(k), {
    gain: (GAIN[k] ?? 0.62) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay,
    reverb: k === "boom" || k === "collapse" || k === "titanRoar" || k === "clear" || k === "crystalBreak" ? 0.32 : 0.14,
    duck: k === "clear" || k === "worldClear" || k === "titanRoar" || k === "out",
  });
}
export function sfxAt(k: ClashSfx, x: number, y: number, z: number, o: { rate?: number; gain?: number; far?: number } = {}) {
  const dx = x - ear.x, dy = y - ear.y, dz = z - ear.z;
  const d = Math.hypot(dx, dy, dz), far = o.far ?? 34;
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
    const k = this.list[Math.floor(Math.random() * this.list.length)];
    const side = Math.random() < 0.5 ? -1 : 1;
    audio.play(sfxName(k), { gain: 0.16 + Math.random() * 0.16, pan: side * (0.3 + Math.random() * 0.65), rate: 0.92 + Math.random() * 0.16, reverb: 0.35, duck: false });
  }
}
