// Rumble Rally's music, composed live (no music files to download) by the site's adaptive band engine
// (src/roll/music.ts). Each world has its own band: tabla fusion in the dune temples, dubstep under the volcano, drum
// and bass on the ice, synthwave in the neon harbour, afrobeats in the jungle, phonk in the scrapyard, reggaeton on
// the boardwalk, swing in the gold mine, an orchestra in the thunder peaks, hyperpop in candy canyon, an EDM drop on
// the red planet and K-pop-style dance on the sky isles. Every race gets its own seeded melody and key, from a short
// intro on the grid to full choruses; grand prix races and finals play hotter; remix races trade verses between their
// two worlds' bands. Nitro adds a sparkle layer, and a calmer garage theme plays on the menus.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import type { StagePlan } from "./stages";
import type { WorldId } from "./worlds";

const BAND: Record<WorldId, { style: string; bpm: number; root: number }> = {
  dunes: { style: "M08", bpm: 118, root: 57 },
  cinder: { style: "M19", bpm: 140, root: 52 },
  polar: { style: "M11", bpm: 164, root: 62 },
  harbor: { style: "M10", bpm: 112, root: 59 },
  canopy: { style: "M16", bpm: 108, root: 60 },
  scrap: { style: "M04", bpm: 130, root: 55 },
  boardwalk: { style: "M15", bpm: 96, root: 64 },
  goldmine: { style: "M14", bpm: 132, root: 58 },
  thunder: { style: "M13", bpm: 120, root: 53 },
  candy: { style: "M05", bpm: 150, root: 65 },
  mars: { style: "M02", bpm: 128, root: 54 },
  cloud: { style: "M06", bpm: 122, root: 61 },
};
const SECTIONS: [SectionKind, number][] = [["intro", 1], ["build", 2], ["chorus", 3], ["verse", 2], ["chorus", 3], ["drop", 3], ["verse", 2], ["drop", 3], ["break", 1]];

function songFor(p: StagePlan): SongPlan {
  const a = BAND[p.world], b = p.blend ? BAND[p.blend] : null;
  const mood = p.time === "night" ? "night" : p.time === "golden" || p.time === "dusk" ? "sunset" : p.world === "cinder" ? "kranky" : "meadow";
  const boost = p.big || p.finale ? 1 : 0;
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({
    beat0: i * 32, beats: 32, mood, section,
    intensity: Math.min(3, intensity + boost),
    style: b && i % 2 === 1 ? b.style : a.style,
  }));
  return { bpm: a.bpm + (p.finale ? 6 : 0), root: a.root + ((p.n * 5) % 7) - 3, seed: p.seed, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 112, root: 57, seed: 52361, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "night", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M10" })),
};

export class RumbleMusic {
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
