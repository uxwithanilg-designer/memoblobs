// Gizmo Drive's music, composed live (no music files to download): the site's adaptive band engine (src/roll/music.ts)
// plays each world in its own style — marimba pop in Toybox Town, hyperpop in the Candy Works, dance pop on the
// building site, orchestra over the Sky Isles, synthwave on the Neon Grid, a music box in the Glacier Lab, phonk in
// the scrapyard, lo-fi in the glowing woods, reggaeton in the deep, swing in the Clockwork Kingdom, a spooky marching
// band at the carnival and festival EDM in orbit — and every stage gets its own seeded melody and key, building from a
// light intro to full choruses (big courses and finales start hotter). Remix stages trade verses between the two
// worlds' bands. Turbo adds a sparkle layer.
import { RollMusic } from "@/roll/music";
import type { SectionKind, SongPlan, SongZone } from "@/roll/types";
import type { StagePlan } from "./stages";
import { worldOf } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan): SongPlan {
  const w = worldOf(p.world), b = p.blend ? worldOf(p.blend) : null;
  const night = w.moods[p.mood % w.moods.length].night;
  const mood = night > 0.6 ? "night" : night > 0.15 ? "sunset" : "meadow";
  const boost = p.summit || p.finale ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + boost),
    style: b && i % 2 === 1 ? b.music.style : w.music.style,
  }));
  return { bpm: w.music.bpm, root: w.music.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 104, root: 62, seed: 40417, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "meadow", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M06" })),
};

export class GizmoMusic {
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
