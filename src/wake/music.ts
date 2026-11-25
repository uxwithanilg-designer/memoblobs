// Wake Racers' music, composed live (no music files to download) by the site's band engine (src/roll/music.ts): each
// world has its own style — marimba pop in the lagoon, drum & bass through the canyon, synthwave in the night harbour,
// an orchestra in the fjord, afrobeats in the jungle, swing on the canals, K-pop dance at the blossom lake, phonk on
// the lava isles, dubstep in the storm, an EDM drop in the crystal caves, tabla fusion in the dunes and house in
// Hyper Bay — and every stage gets its own seeded melody and key, building from an intro to full choruses (boss
// races and finales start hotter). Remix stages trade verses between two worlds' bands. Nitro adds a sparkle layer.
import { RollMusic } from "@/roll/music";
import type { SectionKind, SongPlan, SongZone } from "@/roll/types";
import type { StagePlan } from "./stages";
import { worldOf } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["verse", 2], ["chorus", 3]];

function songFor(p: StagePlan): SongPlan {
  const w = worldOf(p.world), b = p.blend ? worldOf(p.blend) : null;
  const night = w.moods[p.mood % w.moods.length].night;
  const mood = night > 0.6 ? "night" : night > 0.15 ? "sunset" : "meadow";
  const hot = p.boss || p.d > 0.85 ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + hot),
    style: b && i % 2 === 1 ? b.music.style : w.music.style,
  }));
  return { bpm: w.music.bpm, root: w.music.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 118, root: 60, seed: 81723, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "sunset", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M05" })),
};

export class WakeMusic {
  private band: RollMusic | null = null;
  private key = "";
  title() { this.play("title", TITLE); }
  stage(p: StagePlan) { this.play(`s${p.n}`, songFor(p)); }
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
