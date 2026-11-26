// Crumble Crew's music, composed live (no music files) by the site's adaptive band engine (src/roll/music.ts). Each
// district has its own band (jazz swing in Maple Town, a tabla groove in Dune City, drum and bass on the frozen
// harbour, synthwave on the neon strip, jungle grooves, dubstep in the lava works, reggaeton in the pirate cove, a
// K-pop-style bounce on the cloud isles, house in the blossom market, an EDM drop on the moon, hyperpop in the crystal
// mines, an orchestra in Bolt Tower City); every site gets its own seeded tune and key; once the alarm trips the band
// plays hotter, and hotter still for the Vault Warden and the escape. A calmer theme plays in the menus.
import { RollMusic } from "@/roll/music";
import type { SongPlan, SongZone, SectionKind } from "@/roll/types";
import { districtOf, type DistrictId, type TimeOfDay } from "./districts";

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["build", 2], ["chorus", 3], ["verse", 2], ["drop", 3], ["chorus", 3], ["verse", 2], ["drop", 3], ["break", 1]];
export interface Tune { district: DistrictId; blend: DistrictId | null; time: TimeOfDay; seed: number; heat: 0 | 1 | 2 }

function songFor(t: Tune): SongPlan {
  const a = districtOf(t.district).band, b = t.blend ? districtOf(t.blend).band : null;
  const mood = t.time === "night" ? "night" : t.time === "golden" || t.time === "dusk" ? "sunset" : t.district === "lava" ? "kranky" : "meadow";
  const zones: SongZone[] = SECTIONS.map(([section, intensity], i) => ({ beat0: i * 32, beats: 32, mood, section, intensity: Math.min(3, Math.max(0, intensity - (t.heat === 0 ? 1 : 0) + (t.heat === 2 ? 1 : 0))), style: b && i % 2 === 1 ? b.style : a.style }));
  return { bpm: a.bpm + t.heat * 5, root: a.root + ((t.seed * 5) % 7) - 3, seed: t.seed + t.heat * 101, zones, beats: zones.length * 32 };
}
const TITLE: SongPlan = {
  bpm: 104, root: 58, seed: 31337, beats: 128,
  zones: [0, 1, 2, 3].map((i) => ({ beat0: i * 32, beats: 32, mood: "sunset", section: i % 2 ? "chorus" : "verse", intensity: i % 2 ? 2 : 1, style: "M14" })),
};

export class CrumbleMusic {
  private band: RollMusic | null = null;
  private key = "";
  title() { this.play("title", TITLE); }
  site(t: Tune) { this.play(`${t.district}-${t.seed}-${t.heat}`, songFor(t)); }
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
