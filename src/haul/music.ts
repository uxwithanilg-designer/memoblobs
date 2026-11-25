// Tumble Truck's music, composed live (no music files to download) by the site's adaptive band engine
// (src/roll/music.ts). Each world has its own band — afrobeats in the pine woods, clay pop in the orchard, swing in the
// bayou, lo-fi over the honey meadows, an oompah march on the farm, tabla in the canyon, synthwave under the glowing
// mushrooms, an orchestra on the logging ridge, a music box in the snowy village, K-pop-style dance among the cherry
// trees, dubstep on the volcano and an EDM drop on the moon — and every stage gets its own seeded melody and key,
// building from a light intro to full choruses. Remix stages trade verses between their two worlds' bands. Nitro adds
// a sparkle layer, and a separate calm theme plays on the menus.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import type { WorldId } from "./worlds";

const BAND: Record<WorldId, { style: string; bpm: number; root: number }> = {
  pinewood: { style: "M16", bpm: 104, root: 60 },
  orchard: { style: "M01", bpm: 114, root: 62 },
  bayou: { style: "M14", bpm: 112, root: 58 },
  honey: { style: "M03", bpm: 86, root: 64 },
  henhill: { style: "M17", bpm: 118, root: 60 },
  redrock: { style: "M08", bpm: 100, root: 57 },
  glowcap: { style: "M10", bpm: 104, root: 59 },
  timber: { style: "M13", bpm: 98, root: 62 },
  frost: { style: "M18", bpm: 94, root: 65 },
  blossom: { style: "M06", bpm: 116, root: 61 },
  ember: { style: "M19", bpm: 140, root: 52 },
  starfall: { style: "M02", bpm: 124, root: 55 },
};
const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan): SongPlan {
  const a = BAND[p.world], b = p.blend ? BAND[p.blend] : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "ember" ? "kranky" : "meadow";
  const boost = p.big || p.finale ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + boost),
    style: b && i % 2 === 1 ? b.style : a.style,
  }));
  return { bpm: a.bpm, root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 100, root: 62, seed: 40417, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "meadow", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M16" })),
};

export class HaulMusic {
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
