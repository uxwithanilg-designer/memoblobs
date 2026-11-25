// Peak Rover's music, composed live (no music files to download): the site's adaptive band engine (src/roll/music.ts)
// plays each world in its own style — Clay Pop in Meadow Bloom, swing in Sunset Canyon, orchestra over Pine Lake, tabla
// in the dunes, a music box in Frost Peaks, synthwave in Midnight Metro, afrobeats in the jungle, drum & bass on the
// volcano, reggaeton on the coast, lo-fi in Amber Valley, chiptune in the caverns, house on the moon — and every stage
// gets its own seeded melody and key, building from a light intro to full choruses. Remix stages trade verses between
// their two worlds' bands. Turbo adds a sparkle layer.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import type { WorldId } from "./worlds";

const BAND: Record<WorldId, { style: string; bpm: number; root: number }> = {
  meadow: { style: "M01", bpm: 112, root: 60 },
  canyon: { style: "M14", bpm: 118, root: 57 },
  pines: { style: "M13", bpm: 100, root: 62 },
  dunes: { style: "M08", bpm: 104, root: 59 },
  frost: { style: "M18", bpm: 96, root: 64 },
  metro: { style: "M10", bpm: 108, root: 57 },
  jungle: { style: "M16", bpm: 106, root: 62 },
  volcano: { style: "M11", bpm: 170, root: 52 },
  coast: { style: "M15", bpm: 96, root: 65 },
  autumn: { style: "M03", bpm: 84, root: 60 },
  caverns: { style: "M09", bpm: 138, root: 57 },
  crater: { style: "M20", bpm: 122, root: 55 },
};
const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan): SongPlan {
  const a = BAND[p.world], b = p.blend ? BAND[p.blend] : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "volcano" ? "kranky" : "meadow";
  const boost = p.summit || p.finale ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + boost),
    style: b && i % 2 === 1 ? b.style : a.style,
  }));
  return { bpm: a.bpm, root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 92, root: 60, seed: 77123, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "meadow", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M01" })),
};

export class RoverMusic {
  private band: RollMusic | null = null;
  private key = "";
  /** the menu theme */
  title() { this.play("title", TITLE); }
  /** a stage's song (the same stage always gets the same song) */
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
