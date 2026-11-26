// Crumble Crew's sound: the effects (sfx_crumble_*.mp3, synthesised by scripts/gen_crumble_audio.py) — smashing wood,
// glass, brick, stone and metal, rubble and collapses, the drill, the blaster, robots, explosions, loot, the alarm, the
// van and the fanfares — placed left or right by where they happen, and each district's ambience around you.
import { audio, type Sound } from "@/lib/audio";
import type { Ambient } from "./districts";

export const CRUMBLE_SFX = [
  "smash_wood", "smash_glass", "smash_brick", "smash_stone", "smash_metal", "clank", "swing", "crumble", "collapse", "drill", "drill_metal", "spray",
  "blaster", "robot_shot", "turret_shot", "throw", "bounce", "fuse", "boom", "boom_big", "rocket",
  "cash", "gold", "gem", "coin", "heart", "oil", "power", "ammo",
  "alarm", "bell", "robot_hit", "robot_down", "hound", "drone", "warden", "hurt", "vault", "crack",
  "step", "jump", "land", "van_horn", "van_engine", "van_door", "radio",
  "goal", "site_clear", "heist_clear", "start", "fail", "warp", "tap", "open", "buy", "upgrade", "equip",
] as const;
export type CrumbleSfx = (typeof CRUMBLE_SFX)[number];
const AMBIENT: Ambient[] = ["birdA", "birdB", "gust", "traffic", "gull", "chime", "hum", "drip", "lava", "surf", "parrot", "cricket", "machine", "beeps"];
export const sfxName = (k: string): Sound => `a:crumble_${k}` as Sound;
export const CRUMBLE_SOUNDS: Sound[] = [...CRUMBLE_SFX, ...AMBIENT].map(sfxName);
export const UI_SOUNDS: Sound[] = (["tap", "open", "buy", "upgrade", "equip", "start", "coin"] as const).map(sfxName);

const GAIN: Partial<Record<CrumbleSfx, number>> = { coin: 0.4, cash: 0.55, step: 0.22, swing: 0.4, robot_hit: 0.45, boom: 0.85, boom_big: 1, collapse: 0.9, alarm: 0.45, heist_clear: 0.95, site_clear: 0.85, tap: 0.4, drill: 0.45, drill_metal: 0.45 };

export function sfx(k: CrumbleSfx, o: { pan?: number; rate?: number; gain?: number; delay?: number } = {}) {
  const big = k === "heist_clear" || k === "site_clear" || k === "warden" || k === "boom_big" || k === "collapse";
  audio.play(sfxName(k), { gain: (GAIN[k] ?? 0.65) * (o.gain ?? 1), pan: o.pan ?? 0, rate: o.rate, delay: o.delay, reverb: k === "boom" || big ? 0.3 : 0.1, duck: k === "heist_clear" || k === "site_clear" });
}

export class CrumbleAudio {
  private amb: Ambient[] = [];
  private nextAmbient = 3; private last = 0;
  private drillT = 0; private drillOn = false; private drillMetal = false;
  private alarmT = 0; private alarmOn = false;
  setAmbience(a: Ambient[]) { this.amb = a; }
  drill(on: boolean, metal = false) { this.drillOn = on; this.drillMetal = metal; }
  alarm(on: boolean) { if (on && !this.alarmOn) this.alarmT = 0; this.alarmOn = on; }
  update(dt: number, playing: boolean) {
    if (this.drillOn && playing) { this.drillT -= dt; if (this.drillT <= 0) { this.drillT = 0.42; sfx(this.drillMetal ? "drill_metal" : "drill", { rate: 0.96 + Math.random() * 0.08 }); } } else this.drillT = 0;
    if (this.alarmOn && playing) { this.alarmT -= dt; if (this.alarmT <= 0) { this.alarmT = 6 + Math.random() * 3; sfx("alarm", { gain: 0.5 }); } }
    this.last += dt;
    if (this.amb.length && this.last > this.nextAmbient) {
      this.last = 0; this.nextAmbient = 4 + Math.random() * 6;
      const k = this.amb[Math.floor(Math.random() * this.amb.length)];
      audio.play(sfxName(k), { gain: 0.14 + Math.random() * 0.16, pan: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6), rate: 0.94 + Math.random() * 0.12, reverb: 0.35, duck: false });
    }
  }
  silence() { this.drillOn = false; this.alarmOn = false; }
}
