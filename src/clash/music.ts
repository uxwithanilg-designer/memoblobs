// Cube Clash's music, composed live (no music files) by the site's band engine (src/roll/music.ts): each theme plays
// in its own style (clay pop on the Meadow Isles, K-pop-style dance in Sakura Heights, swing on the mesa, a music box
// in Frost Peaks, lo-fi in the grove, drum & bass in Magma Rocks, hyperpop in Candy Clouds, reggaeton in Pirate Bay,
// afrobeats in the jungle, chiptune in the caverns, synthwave in the arcade, marching band on the farm, orchestra in
// the temple, house on the moon, EDM on the volcano…). Every stage gets its own seeded melody and key; Titan fights
// start at full power, and the last fight of a match adds a sparkle layer.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import { THEMES } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];
function songFor(p: StagePlan): SongPlan {
  const a = THEMES[p.themeIndex].music, b = p.blend ? THEMES.find((t) => t.id === p.blend)!.music : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.theme === "magma" || p.theme === "volcano" ? "kranky" : "meadow";
  const boost = p.mode === "titan" ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({ beat0: i * 32, beats: 32, mood, section, intensity: Math.min(3, intensity + boost), style: b && i % 2 === 1 ? b.style : a.style }));
  return { bpm: a.bpm + (p.mode === "obby" ? -6 : p.mode === "titan" ? 6 : 0), root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 112, root: 60, seed: 9090, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "meadow", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M05" })),
};
export class ClashMusic {
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
  pause() { this.band?.stop(0.2); }
  resume() { if (this.band && !this.band.playing) this.band.start(0, 0.1); }
  dispose() { this.band?.dispose(); this.band = null; this.key = ""; }
}
