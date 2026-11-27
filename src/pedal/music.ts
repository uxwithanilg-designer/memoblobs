// Obby Bike Blaster's music, composed live (no music files): the site's band engine (src/roll/music.ts) plays each
// world in its own style — clay pop in Sky Park, hyperpop in Candy Clouds, tabla in Canyon Rush, afrobeats in the
// jungle, a music box on the ice, reggaeton at the docks, synthwave at night in the city, drum & bass over the lava,
// chiptune in the toy room, lo-fi among the mushrooms, swing in the haunted hollow, EDM on the grid, K-pop-style dance
// at the temple, a marching band in the works, house in space, dubstep in the storm and the glitch. Every level gets
// its own seeded melody and key; the finale levels start at full power, and Turbo adds a sparkle layer.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { LevelPlan } from "./course";
import { WORLDS } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];
function songFor(p: LevelPlan): SongPlan {
  const a = WORLDS.find((w) => w.id === p.world)!.music, b = p.blend ? WORLDS.find((w) => w.id === p.blend)!.music : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "lava" || p.world === "glitch" ? "kranky" : "meadow";
  const boost = p.finale ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({ beat0: i * 32, beats: 32, mood, section, intensity: Math.min(3, intensity + boost), style: b && i % 2 === 1 ? b.style : a.style }));
  return { bpm: a.bpm, root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = { bpm: 118, root: 60, seed: 5151, beats: 128, zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "meadow", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M01" })) };

export class PedalMusic {
  private band: RollMusic | null = null;
  private key = "";
  title() { this.play("title", TITLE); }
  level(p: LevelPlan) { this.play(`l${p.n}`, songFor(p)); }
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
