// Voxel Vanguard's music, composed live (no music files to download) by the site's adaptive band engine
// (src/roll/music.ts). Each world has its own band (afrobeats on the farm, tabla fusion in the canyon, drum and bass on
// the ice, synthwave in the neon metro, jungle grooves, dubstep in the foundry, reggaeton in the lagoon, K-pop-style
// dance on the sky docks, an EDM drop on the moon, an orchestra in the citadel); every sector gets its own seeded
// melody and key; boss fights play hotter; remix stages trade verses between two worlds' bands. A power-up adds a
// sparkle layer, and a calmer theme plays in the menus.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import { worldOf } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["build", 2], ["chorus", 3], ["verse", 2], ["drop", 3], ["chorus", 3], ["verse", 2], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan, boss: boolean): SongPlan {
  const a = worldOf(p.world).band, b = p.blend ? worldOf(p.blend).band : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "foundry" ? "kranky" : "meadow";
  const boost = boss ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({ beat0: i * 32, beats: 32, mood, section, intensity: Math.min(3, intensity + boost), style: b && i % 2 === 1 ? b.style : a.style }));
  return { bpm: a.bpm + (boss ? 6 : 0) + (p.sector % 2) * 4, root: a.root + ((p.n * 5 + p.sector * 3) % 7) - 3, seed: p.seed + (boss ? 99 : 0), zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 108, root: 57, seed: 73517, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "night", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M13" })),
};

export class VanguardMusic {
  private band: RollMusic | null = null;
  private key = "";
  title() { this.play("title", TITLE); }
  /** each sector of an operation gets its own song (the world's band, a new tune and key); the boss phase a hotter one */
  stage(p: StagePlan, boss = false) { this.play(`s${p.n}-${p.sector}-${boss ? 1 : 0}`, songFor(p, boss)); }
  private play(key: string, plan: SongPlan) {
    if (key === this.key && this.band?.playing) return;
    this.band?.dispose();
    this.key = key;
    this.band = new RollMusic(plan);
    this.band.loop = true;
    this.band.start(0, 0.15);
  }
  fever(on: boolean) { this.band?.fever(on); }
  stop() { this.band?.stop(0.4); this.key = ""; }
  pause() { this.band?.stop(0.2); }
  resume() { if (this.band && !this.band.playing) this.band.start(0, 0.1); }
  dispose() { this.band?.dispose(); this.band = null; this.key = ""; }
}
