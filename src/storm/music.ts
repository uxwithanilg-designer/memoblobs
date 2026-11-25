// Blockstorm's music, composed live (no music files): the site's band engine (src/roll/music.ts) plays each world in
// its own style — clay pop on Grassy Isle, tabla in the dunes, synthwave in Neon City, a music box in Frostbite Peaks,
// lo-fi in the marsh, drum & bass in the forge, hyperpop in Candy Cliffs, reggaeton on the reef, swing in the hollow,
// orchestra in the sky, chiptune in the caverns, afrobeats in the jungle, EDM on the grid, marching band in the
// factory, K-pop-style dance in the garden, house on the moon, phonk in the wastes and dubstep in the Glitch Core.
// Every stage gets its own seeded melody and key; boss stages start at full power, and the boss fight adds a
// sparkle layer. Remixes trade verses between their two worlds' bands.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import { WORLDS } from "./worlds";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan): SongPlan {
  const a = WORLDS.find((w) => w.id === p.world)!.music, b = p.blend ? WORLDS.find((w) => w.id === p.blend)!.music : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "forge" || p.world === "glitch" ? "kranky" : "meadow";
  const boost = p.goal === "boss" ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + boost),
    style: b && i % 2 === 1 ? b.style : a.style,
  }));
  return { bpm: a.bpm + (p.goal === "boss" ? 6 : 0), root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 100, root: 57, seed: 4242, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "night", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M09" })),
};

export class StormMusic {
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
