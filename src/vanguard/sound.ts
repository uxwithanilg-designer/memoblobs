// Voxel Vanguard's sound: the effects (sfx_vanguard_*.mp3, synthesised by scripts/gen_vanguard_audio.py) — a voice
// for each blaster, robot shots, cannon thumps, a sniper's beam, mortar whistles, explosions and a boss going down,
// hits, hurts and the shield, the jetpack's roar, footsteps and landings, pickups, waves, stage clear and the warp —
// placed left or right by where they happen, and each world's ambience (birdsong, wind, crickets, owls, traffic,
// parrots, drips, machines, bubbling lava, surf, gulls, chimes, radio beeps, a hum) around you at random distances.
import { audio, type Sound } from "@/lib/audio";
import type { Ambient } from "./worlds";

export const VANGUARD_SFX = [
  "fire_zapper", "fire_pulse", "fire_scatter", "fire_rail", "fire_boom", "fire_arc", "enemyShot", "cannon", "beam", "mortar",
  "boom", "bossDown", "bossRoar", "hit", "hurt", "shieldHit", "jet", "jump", "land", "step", "reload", "reloaded", "swap",
  "coin", "gem", "heart", "oil", "power", "lowFuel", "teleport", "wave", "waveClear", "stageClear", "warp", "start",
  "lifeLost", "downed", "revive", "tap", "open", "buy", "upgrade", "equip",
] as const;
export type VanguardSfx = (typeof VANGUARD_SFX)[number];
export const AMBIENT_SFX: Record<Ambient, string[]> = {
  birds: ["birdA", "birdB"], wind: ["gust"], crickets: ["cricket"], owls: ["owl"], traffic: ["horn"], parrots: ["parrot"], drips: ["drip"],
  machines: ["machine"], lava: ["lava"], waves: ["wave2"], gulls: ["gull"], chimes: ["chime"], beeps: ["radio"], hum: ["hum"],
};
const ALL_AMBIENT = [...new Set(Object.values(AMBIENT_SFX).flat())];
export const sfxName = (k: string): Sound => `a:vanguard_${k}` as Sound;
export const VANGUARD_SOUNDS: Sound[] = [...VANGUARD_SFX, ...ALL_AMBIENT].map(sfxName);
export const UI_SOUNDS: Sound[] = (["tap", "open", "buy", "upgrade", "equip", "start", "coin"] as const).map(sfxName);

const GAIN: Partial<Record<VanguardSfx, number>> = { coin: 0.4, gem: 0.6, step: 0.25, hit: 0.4, jet: 0.45, boom: 0.8, bossDown: 1, bossRoar: 0.9, stageClear: 0.9, warp: 0.7, tap: 0.4 };

export function sfx(k: VanguardSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  const big = k === "stageClear" || k === "bossDown" || k === "bossRoar" || k === "lifeLost";
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "boom" || big ? 0.3 : 0.1, duck: big });
}

export class VanguardAudio {
  private amb: string[] = [];
  private nextAmbient = 3; private last = 0;
  private jetT = 0; private jetOn = false;
  private bossOn = false;
  start(ambience: Ambient[]) { this.setAmbience(ambience); }
  setAmbience(ambience: Ambient[]) { this.amb = ambience.flatMap((a) => AMBIENT_SFX[a]); }
  /** the jetpack's roar: short overlapping bursts while it burns */
  jet(on: boolean) { this.jetOn = on; }
  boss(on: boolean) { this.bossOn = on; }
  get bossFight() { return this.bossOn; }
  update(dt: number, playing: boolean) {
    if (this.jetOn && playing) { this.jetT -= dt; if (this.jetT <= 0) { this.jetT = 0.22; sfx("jet", { rate: 0.95 + Math.random() * 0.1 }); } } else this.jetT = 0;
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmbient) {
      this.last = 0; this.nextAmbient = 4 + Math.random() * 6;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      audio.play(sfxName(k), { gain: 0.15 + Math.random() * 0.18, pan: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6), rate: 0.94 + Math.random() * 0.12, reverb: 0.35, duck: false });
    }
  }
  silence() { this.jetOn = false; }
  dispose() { this.jetOn = false; }
}
