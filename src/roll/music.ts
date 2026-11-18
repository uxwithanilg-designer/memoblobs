// Adaptive, beat-synced background music for Momo Sky Roll — composed live with Web Audio (no audio files).
// Every zone's *style* (M01–M20, docs/SKY_ROLL_PLAN.md §4 M) picks the band: its groove, bass, harmony and lead voice.
// The zone's intensity adds layers (0 keys/pad → 1 light drums → 2 bass + full drums → 3 lead + extras), its mood
// softens or brightens the mix, risers + crashes mark every zone change, fever() adds a sparkle layer, and the music
// can restart from any beat (checkpoints, pause). All melodies are original: one seeded, chord-aware motif per song.
import { audio } from "@/lib/audio";
import { Rng } from "./rng";
import type { SongPlan, SongZone } from "./types";

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const mod = (a: number, n: number) => ((a % n) + n) % n;

// ---------------------------------------------------------------- the bands
type Kick = "soft" | "punch" | "deep" | "chip" | "808";
type Snr = "snare" | "clap" | "rim" | "chip" | "march" | "lofi" | "gated";
type Perc = "tabla" | "dholak" | "conga";
type BassK = "pluck" | "funk" | "sub" | "saw" | "808" | "reese" | "wobble" | "walk" | "warm" | "tuba" | "chip" | "synth" | "log" | "ostinato";
type KeysK =
  | "marimba" | "uke" | "bell" | "epiano" | "pad" | "stab" | "pluck" | "organ" | "sitar" | "kalimba" | "pan" | "brass"
  | "strings" | "choir" | "chip" | "box" | "cowbell" | "drone";
type LeadK = "whistle" | "flute" | "square" | "bell" | "saw" | "chip" | "sitar" | "brass" | "pan" | "box" | "vox" | "sax" | "kalimba" | "strings" | "cowbell";
type FillK = "snare" | "tom" | "tabla" | "timp" | "glitch" | "march" | "chip" | "dholak" | "box";
type Lane = "kick" | "snare" | "clap" | "rim" | "snap" | "hat" | "ohat" | "shaker" | "tamb" | "ride" | "perc" | "timp" | "tick" | "cym";
/**
 * One pattern per intensity [I0, I1, I2, I3] (missing levels repeat the last one); each string is 16 or 32 sixteenths.
 * Drums: `.` rest · `o` ghost · `x` hit · `X` accent · `r` / `3` / `R` roll of 2 / 3 / 4 inside the 16th · `f` flam ·
 *   other letters pick a sound (tabla d/n/i/g/k, dholak l/h/k, conga l/h/m, timpani l/h).
 * Bass: `1`–`8` scale steps above the chord root (`0` = the fifth below, `b` = approach note into the next chord) · `-` hold.
 * Keys: `x`/`X` chord · `a` bouncing arpeggio · `u` rising arpeggio · `m` arpeggio where the song's seeded mask is set.
 */
type Lv = readonly string[];

interface Style {
  name: string;
  kick: Kick; snare: Snr; perc?: Perc;
  drums: Partial<Record<Lane, Lv>>;
  bass: BassK; bassPat: Lv;
  keys: KeysK; keysPat: Lv;
  keys2?: KeysK; keys2Pat?: Lv;
  /** warm pad level per intensity (0 = none) */
  pad: readonly number[];
  lead: LeadK;
  /** 8 = the motif in 8ths (default), 4 = broad quarter notes */
  leadRate?: 4 | 8;
  leadOct?: number;
  /** I3 sparkle arpeggio voice; arpRate 1 = 16ths (default), 2 = 8ths */
  arp?: KeysK; arpRate?: 1 | 2;
  /** fever sparkle voice (default: arp, else bell) */
  fArp?: KeysK;
  /** chord per bar, as major-scale degrees of the song key (5 = the relative minor) */
  prog: readonly number[];
  sev?: boolean;
  /** swing: delay of the off-beat 8ths / the odd 16ths, in beats */
  sw8?: number; sw16?: number;
  /** sidechain pump depth on the kicks (I2+) */
  pump?: number;
  fill: FillK;
  /** snare roll through the last bar of a build */
  buildRoll?: boolean;
  /** 808 slides between far-apart notes */
  glide?: boolean;
  /** lo-fi vinyl dust + wonky keys */
  vinyl?: boolean;
  rev?: number; dly?: number; drumLvl?: number; bright?: number; hatRate?: number;
}

// All grooves below are generic genre conventions; harmony is plain diatonic progressions; melodies come from the seed.
const STYLES: Record<string, Style> = {
  // bouncy marimba pop: soft kick, claps, shaker, plucky bass, ukulele off-beats, whistled hook
  M01: {
    name: "Clay Pop", kick: "soft", snare: "clap",
    drums: {
      kick: ["", "x.......x.......", "x.....x.x.......", "x.....x.x.....x."],
      snare: ["", "....x.......x..."],
      shaker: ["", "o.x.o.x.o.x.o.x.", "o.x.o.x.o.x.o.x.", "o.xoo.xoo.xoo.xx"],
      tamb: ["", "", "..x...x...x...x."],
    },
    bass: "pluck", bassPat: ["", "", "1.......1...5...", "1.....8.1...5.8."],
    keys: "marimba", keysPat: ["a...a...a...a...", "a.a.a.a.a.a.a.a."],
    keys2: "uke", keys2Pat: ["", "", "", "..x...x...x...x."],
    pad: [0, 0, 0.3], lead: "whistle", prog: [0, 4, 5, 3], fill: "snare",
  },
  // festival EDM: four-on-the-floor, 3-3-2 supersaw plucks, rolling off-beat bass, big pump, supersaw lead
  M02: {
    name: "EDM Drop", kick: "punch", snare: "clap",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x..."],
      snare: ["", "....x.......x..."],
      hat: ["", "..x...x...x...x.", "o.x.o.x.o.x.o.x.", "oo.ooo.ooo.ooo.o"],
      ohat: ["", "", "", "..x...x...x...x."],
    },
    bass: "saw", bassPat: ["", "", "..1...1...1...1.", "..1..11...1..18."],
    keys: "pluck", keysPat: ["x.......x.......", "x..x..x...x..x.."],
    pad: [0.5, 0.35, 0.25, 0.2], lead: "saw", arp: "pluck", prog: [5, 3, 0, 4],
    pump: 0.5, fill: "snare", buildRoll: true, bright: 1.1,
  },
  // dusty lo-fi: lazy half-time swing, soft snare, warm bass, wonky e-piano 7ths, vinyl dust, mellow flute
  M03: {
    name: "Lo-fi", kick: "soft", snare: "lofi", sw8: 0.1, vinyl: true,
    drums: {
      kick: ["", "x.........x.....", "x.......o.x.....", "x.....o...x...o."],
      snare: ["", "........x.......", "........x.......", "........x.....o."],
      hat: ["", "o.x.o.x.o.x.o.x.", "o.x.o.x.o.x.o.xo", "o.x.o.xoo.x.o.xo"],
    },
    bass: "warm", bassPat: ["", "", "1.........5.....", "1......5..1...3."],
    keys: "epiano", keysPat: ["x...............", "x.....x.........", "x.....x...x....."],
    pad: [0.25, 0.2, 0.25], lead: "flute", prog: [3, 2, 1, 0], sev: true,
    fill: "tom", rev: 1.3, bright: 0.75, drumLvl: 0.85, hatRate: 0.9,
  },
  // drift phonk: 808 kick + sliding 808 bass, Memphis hat rattles, pitched cowbell riff, dark pad
  M04: {
    name: "Phonk", kick: "808", snare: "clap", glide: true,
    drums: {
      kick: ["", "x.........x.....", "x.....x...x.....", "x.....x.x.x...x."],
      snare: ["", "....x.......x..."],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x3x.", "x.xrx.x.x.x.x3xr"],
    },
    bass: "808", bassPat: ["", "", "1-------..1--8--", "1-----1-..1-8-5-"],
    keys: "cowbell", keysPat: ["a.......a.......", "a..a..a.a..a..a.", "a..a..a.a..a..a.", "a.......a......."],
    pad: [0.4, 0.3, 0.25, 0.2], lead: "cowbell", prog: [5, 5, 3, 4], pump: 0.3, fill: "snare", bright: 0.9,
  },
  // hyperpop: bouncy kick, glitchy hat rolls, buzzy saw bass, bright plucks, pitched-up vocal-ish lead, chip arps
  M05: {
    name: "Hyperpop", kick: "punch", snare: "clap",
    drums: {
      kick: ["", "x.......x.......", "x..x....x.x.....", "x..x..x.x.x...x."],
      snare: ["", "....x.......x...", "....x.......x...", "....x.......x.xx"],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.xrx.x.x.xrx.x.", "x.xrx.x.x3xrx.R."],
    },
    bass: "saw", bassPat: ["", "", "1.1...1.1...5.8.", "1.18..1.1.8.5.8."],
    keys: "pluck", keysPat: ["x.......x.......", "x..x..x...x..x.."],
    pad: [0.4, 0.3, 0.25, 0.2], lead: "vox", leadOct: 12, arp: "chip", fArp: "chip", prog: [3, 4, 0, 5],
    pump: 0.35, fill: "glitch", buildRoll: true, bright: 1.25, hatRate: 1.8,
  },
  // K-pop-style dance: snaps → snare + clap, busy hats, funky octave bass, synth stabs, brass hits, bright lead
  M06: {
    name: "K-pop-style Dance", kick: "punch", snare: "snare",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x...", "x...x...x...x.x."],
      snare: ["", "", "....x.......x..."],
      clap: ["", "", "....x.......x...", "....x.......x..x"],
      snap: ["", "....x.......x...", ""],
      hat: ["", "..x...x...x...x.", "x.x.x.xxx.x.x.xx", "xxx.xxx.xxx.xxxr"],
    },
    bass: "funk", bassPat: ["", "", "1..1..8.1..1..5.", "1.81..8.1.81..58"],
    keys: "stab", keysPat: ["x...............", "..x..x....x..x.."],
    keys2: "brass", keys2Pat: ["", "", "", "x.........x....."],
    pad: [0.4, 0.2, 0.25], lead: "square", arp: "pluck", prog: [3, 4, 2, 5], sev: true,
    pump: 0.35, fill: "tom", buildRoll: true, bright: 1.1,
  },
  // Bollywood-style dance: dholak chal groove, jingles, string swells, sitar riffs, sitar lead with slides
  M07: {
    name: "Bollywood-style Dance", kick: "deep", snare: "clap", perc: "dholak",
    drums: {
      perc: ["", "l..k..l.l..k..h.", "l..k.hl.l..k.hh.", "l.hk.hl.l.hk.hhk"],
      kick: ["", "", "x.......x..x....", "x...x...x...x..."],
      snare: ["", "....x.......x..."],
      tamb: ["", "", "..x...x...x...x.", "x.x.x.x.x.x.x.x."],
    },
    bass: "pluck", bassPat: ["", "", "1..1..5.1..1..5.", "1..1..5.1..8..5."],
    keys: "strings", keysPat: ["x..............."],
    keys2: "sitar", keys2Pat: ["", "a.....a.a.......", "a..a..a.a..a..a.", ""],
    pad: [0], lead: "sitar", fArp: "bell", prog: [5, 4, 3, 4], pump: 0.2, fill: "dholak", bright: 1.1,
  },
  // tabla fusion: tabla bols over a tanpura-style drone, gentle electronic kick, sitar figures, bansuri-ish flute
  M08: {
    name: "Tabla Fusion", kick: "soft", snare: "rim", perc: "tabla",
    drums: {
      perc: ["", "d..i..d.n.g.n...", "d.kn.kd.i.dkn.g.", "dkkn.kdkn.dkngkR"],
      kick: ["", "", "x.......x.......", "x.....x.x......."],
      shaker: ["", "", "o.x.o.x.o.x.o.x."],
    },
    bass: "sub", bassPat: ["", "", "1---------------", "1-------5-------"],
    keys: "drone", keysPat: ["x...x...x...x..."],
    keys2: "sitar", keys2Pat: ["", "a.......a.......", "a..a..a.a......."],
    pad: [0.2, 0.2, 0.25], lead: "flute", arp: "kalimba", arpRate: 2, prog: [0, 3, 0, 4], fill: "tabla", rev: 1.2,
  },
  // chiptune: noise drums, triangle octave bass, fast pulse arpeggios, square lead with vibrato
  M09: {
    name: "Chiptune", kick: "chip", snare: "chip",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x...", "x...x..xx...x..."],
      snare: ["", "....x.......x...", "....x.......x...", "....x.......x.xx"],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x.", "xxxxxxxxxxxxxxxx"],
    },
    bass: "chip", bassPat: ["", "", "1.1.8.1.1.1.8.1.", "1.8.1.8.1.8.5.8."],
    keys: "chip", keysPat: ["a...a...a...a...", "a.a.a.a.a.a.a.a.", "uuuuuuuuuuuuuuuu"],
    pad: [0], lead: "chip", fArp: "chip", prog: [0, 5, 3, 4], fill: "chip", rev: 0.5, dly: 1.2, hatRate: 3,
  },
  // synthwave: gated snare, driving 8th-note filter bass, lush pads, 16th pluck arps, wide saw lead
  M10: {
    name: "Synthwave", kick: "punch", snare: "gated",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x..."],
      snare: ["", "....x.......x..."],
      hat: ["", "..x...x...x...x.", "x.x.x.x.x.x.x.x.", "x.xxx.xxx.xxx.xx"],
    },
    bass: "synth", bassPat: ["", "", "1.1.1.1.1.1.1.1.", "1.1.1.1.1.1.8.5."],
    keys: "pluck", keysPat: ["", "", "a.a.a.a.a.a.a.a.", "uuuuuuuuuuuuuuuu"],
    pad: [0.55, 0.45, 0.35, 0.3], lead: "saw", prog: [5, 0, 3, 4], pump: 0.25, fill: "tom", rev: 1.3,
  },
  // liquid drum & bass: half-time feel with double-time hats and a two-step break every other bar, reese bass
  M11: {
    name: "Drum & Bass", kick: "punch", snare: "snare",
    drums: {
      kick: ["", "x.........x.....", "x.........x.....", "x.........x.....x.........x.x..."],
      snare: ["", "........x.......", "..o.....x..o..o.", "..o.....x..o..o.....x..o.o..x..o"],
      hat: ["", "x.x.x.x.x.x.x.x.", "xxx.xxx.xxx.xxxr", "xoxxxoxxxoxxxoxr"],
    },
    bass: "reese", bassPat: ["", "", "1-------1-----8-", "1-------5---8-5-"],
    keys: "epiano", keysPat: ["x...............", "x.....x........."],
    pad: [0.4, 0.35, 0.3], lead: "bell", arp: "pluck", prog: [5, 2, 3, 4], sev: true,
    pump: 0.2, fill: "snare", buildRoll: true, hatRate: 1.6,
  },
  // trap: half-time clap, 1/16–1/64 hat rolls, sliding 808s, bell plucks, airy flute hook
  M12: {
    name: "Trap", kick: "808", snare: "clap", glide: true,
    drums: {
      kick: ["", "x.........x.....", "x......x..x.....", "x......x..x...x."],
      snare: ["", "........x.......", "........x.......", "........x......o"],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.x.x.xrx.x.x3x.", "x.xrx.x.x3x.x.x.x.x.x.xrx.x.rrRR"],
      ohat: ["", "", "", "..............x."],
    },
    bass: "808", bassPat: ["", "", "1---------1-----", "1------1--8---5-"],
    keys: "bell", keysPat: ["m...m...m...m...", "mmmmmmmmmmmmmmmm"],
    pad: [0.35, 0.3, 0.25], lead: "flute", fArp: "bell", prog: [5, 3, 5, 4], fill: "snare", bright: 0.95,
  },
  // epic orchestra: timpani + taiko hits, galloping low strings, string ensemble, choir, heroic brass, glockenspiel
  M13: {
    name: "Epic Orchestra", kick: "deep", snare: "march",
    drums: {
      timp: ["", "l.......l.......", "l.....l.l...h...", "X..l..l.l.l.h.hR"],
      snare: ["", "", "", "....x.......x..."],
      cym: ["", "", "", "x..............................."],
    },
    bass: "ostinato", bassPat: ["", "", "1.1.1.1.1.1.1.1.", "1.111.111.111.11"],
    keys: "strings", keysPat: ["x..............."],
    keys2: "choir", keys2Pat: ["", "", "x...............", "x..............."],
    pad: [0], lead: "brass", leadRate: 4, arp: "bell", arpRate: 2, prog: [5, 3, 0, 4], fill: "timp", rev: 1.4,
  },
  // jazz swing: ride "ding ding-a", hi-hat on 2 & 4, walking bass, Charleston piano comping, sax-ish lead
  M14: {
    name: "Jazz Swing", kick: "soft", snare: "lofi", sw8: 0.16,
    drums: {
      ride: ["", "x...x.x.x...x.x."],
      hat: ["", "....x.......x..."],
      kick: ["", "", "o.......o.......", "o.......o.....o."],
      snare: ["", "", "......o.......o.", "..o...o...o...o."],
    },
    bass: "walk", bassPat: ["", "", "1...3...5...b...", "1...5...8...b..."],
    keys: "epiano", keysPat: ["x...............", "x.....x.........", "x.....x.....x...", "x.....x...x...x."],
    pad: [0], lead: "sax", fArp: "bell", prog: [1, 4, 0, 5], sev: true, fill: "snare", rev: 1.2, bright: 0.9, hatRate: 1.1,
  },
  // reggaeton: dembow (boom-ch-boom-chick), tresillo 808, latin plucks, steel-pan hook
  M15: {
    name: "Reggaeton", kick: "punch", snare: "snare",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x..."],
      snare: ["", "...x..x....x..x."],
      clap: ["", "", "", "...x..x....x..x."],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x.", "x.xxx.x.x.xxx.x."],
    },
    bass: "808", bassPat: ["", "", "1..1..1.1..1..1.", "1..1..5.1..1..8."],
    keys: "pluck", keysPat: ["x.......x.......", "a..a..a.a..a..a."],
    pad: [0.35, 0.25, 0.2], lead: "pan", arp: "marimba", arpRate: 2, fArp: "pan", prog: [5, 3, 0, 4],
    pump: 0.25, fill: "snare", bright: 1.05,
  },
  // afrobeats: clave rim, shaker 16ths with a lilt, congas, log-drum bass, guitar-ish picking, kalimba hook
  M16: {
    name: "Afrobeats", kick: "soft", snare: "rim", perc: "conga", sw16: 0.04,
    drums: {
      kick: ["", "x.......x.......", "x..x....x..x....", "x..x..x.x..x...."],
      rim: ["", "x..x..x...x.x..."],
      snap: ["", "", "....x.......x..."],
      shaker: ["", "xoxoxoxoxoxoxoxo", "xoxxxoxxxoxxxoxx"],
      perc: ["", "", "..h.l.hh..h.l.h.", "m.h.l.hhm.h.lhh."],
    },
    bass: "log", bassPat: ["", "", "1..1..5...1...8.", "1..1..5.1..8..5."],
    keys: "uke", keysPat: ["a.......a.......", "a..a..a...a.a...", "a.aa.aa.a.aa.a.a"],
    pad: [0.3, 0.25, 0.25, 0.2], lead: "kalimba", arp: "pan", arpRate: 2, prog: [1, 4, 0, 3], sev: true, fill: "tom", bright: 1.05,
  },
  // marching band: bass drum on the beat, snare rudiments (flams, rolls), cymbal clashes, tuba oom-pah, piccolo, glockenspiel
  M17: {
    name: "Marching Band", kick: "deep", snare: "march",
    drums: {
      kick: ["", "x.......x.......", "x...x...x...x..."],
      snare: ["", "....f.......f...", "x.ox.ox.f.oxx.ox", "f.oxR.oxf.ox3.xR"],
      cym: ["", "", "x...............................", "x..............."],
    },
    bass: "tuba", bassPat: ["", "", "1.......5.......", "1...5...1...5..."],
    keys: "brass", keysPat: ["x...............", "....x.......x...", "..x...x...x...x."],
    pad: [0], lead: "flute", leadOct: 12, arp: "bell", arpRate: 2, prog: [0, 3, 4, 0], fill: "march", rev: 0.9,
  },
  // music box lullaby: clock tick, tiny tines, soft pad and warm bass, music-box melody with echoes
  M18: {
    name: "Music Box", kick: "soft", snare: "rim",
    drums: {
      tick: ["", "X...x...x...x..."],
      kick: ["", "", "o.......o......."],
      shaker: ["", "", "..o...o...o...o."],
    },
    bass: "warm", bassPat: ["", "", "1-------5-------"],
    keys: "box", keysPat: ["a...a...a...a...", "a.a.a.a.a.a.a.a."],
    pad: [0.25, 0.3, 0.35], lead: "box", arp: "bell", arpRate: 2, fArp: "box", prog: [0, 5, 1, 4],
    fill: "box", rev: 1.6, dly: 1.3, drumLvl: 0.7, bright: 0.85,
  },
  // dubstep (kid-sized): half-time kick/snare, tempo-synced wobble bass, bell motif, filtered square lead
  M19: {
    name: "Dubstep", kick: "punch", snare: "snare",
    drums: {
      kick: ["", "x.........x.....", "x.........x...x.", "x......x..x...x."],
      snare: ["", "........x.......", "........x.......", "........x.....o."],
      clap: ["", "", "", "........x......."],
      hat: ["", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.xrx.x.", "x.x.x3x.x.xrx.xR"],
    },
    bass: "wobble", bassPat: ["", "", "1-------1---5-8-", "1-------5---8-5-"],
    keys: "bell", keysPat: ["m...m...m...m...", "m.m.m.m.m.m.m.m."],
    pad: [0.45, 0.35, 0.25, 0.2], lead: "square", fArp: "chip", prog: [5, 5, 3, 4], pump: 0.2, fill: "glitch", bright: 0.9,
  },
  // house: four-on-the-floor, off-beat open hats and bass, organ chord stabs, vocal-chop lead, heavy pump
  M20: {
    name: "House", kick: "punch", snare: "clap",
    drums: {
      kick: ["", "x...x...x...x..."],
      snare: ["", "....x.......x..."],
      hat: ["", "..x...x...x...x.", "oo.ooo.ooo.ooo.o"],
      ohat: ["", "", "..x...x...x...x."],
      shaker: ["", "", "", "xoxoxoxoxoxoxoxo"],
    },
    bass: "funk", bassPat: ["", "", "..1...1...1...1.", "..1...1.1.1...8."],
    keys: "organ", keysPat: ["x...............", "...x..x.....x...", "x..x..x...x..x.."],
    pad: [0.3, 0.2], lead: "vox", arp: "pluck", prog: [5, 1, 4, 0], sev: true, pump: 0.45, fill: "snare", buildRoll: true,
  },
};
/** World 1's mood ids, for plans made before zones carried a style */
const FALLBACK: Record<string, string> = { meadow: "M01", sunflower: "M20", mushroom: "M18", sunset: "M03", night: "M10", kranky: "M04" };
/** tense moods swap a major progression for a minor one */
const TENSE = [5, 4, 3, 4];

const LANES: readonly Lane[] = ["kick", "snare", "clap", "rim", "snap", "hat", "ohat", "shaker", "tamb", "ride", "perc", "timp", "tick", "cym"];
const SKIP_IN_FILL = new Set<Lane>(["snare", "clap", "perc", "timp"]);
/** kick: start Hz, end Hz, level, decay s, click level */
const KICKS: Record<Kick, readonly [number, number, number, number, number]> = {
  soft: [130, 48, 0.85, 0.3, 0], punch: [165, 48, 1, 0.3, 0.25], deep: [118, 44, 0.95, 0.42, 0.1], chip: [240, 45, 0.7, 0.16, 0], "808": [150, 46, 1, 0.42, 0.18],
};
/** longest a bass note rings (in 16ths) when the pattern gives no hold */
const BASSLEN: Record<BassK, number> = { pluck: 3, funk: 1, sub: 16, saw: 1, "808": 8, reese: 4, wobble: 8, walk: 4, warm: 8, tuba: 3, chip: 2, synth: 1, log: 2, ostinato: 1 };
/** register of each keys voice above the chord voicing (semitones) */
const KEYOCT: Record<KeysK, number> = {
  marimba: 12, uke: 12, bell: 12, epiano: 12, pad: 0, stab: 0, pluck: 12, organ: 0, sitar: 0, kalimba: 12, pan: 12, brass: 0,
  strings: 0, choir: 0, chip: 12, box: 12, cowbell: 12, drone: 0,
};
/** register of each lead voice above the key root (semitones) */
const LEADOCT: Record<LeadK, number> = {
  whistle: 24, flute: 12, square: 24, bell: 24, saw: 12, chip: 24, sitar: 12, brass: 12, pan: 12, box: 24, vox: 12, sax: 12,
  kalimba: 12, strings: 12, cowbell: 12,
};
const LEADPEAK: Partial<Record<LeadK, number>> = { whistle: 0.2, flute: 0.2, square: 0.11, saw: 0.065, chip: 0.07, vox: 0.3, sax: 0.14, strings: 0.06 };
const SOFT_KEYS = new Set<KeysK>(["marimba", "bell", "kalimba", "box", "pan", "uke", "epiano", "chip"]);
/** arpeggio walk over [chord tones…, root + 8ve] */
const ARPSEQ = [0, 1, 2, 1, 3, 2, 1, 2];
/** the last half-bar of every 4-bar phrase walks the lead home to the chord root */
const CAD8: readonly (number | null)[] = [2, 1, 0, null];
const CAD4: readonly (number | null)[] = [1, 0];
/** wobble LFO speeds (cycles per beat), one per beat position */
const WOB = [2, 1, 3, 4, 1.5, 2];

const lv = (p: Lv | undefined, I: number) => (p && p.length ? p[Math.min(I, p.length - 1)] : "");
const at = (p: string, step: number) => (p ? p[mod(step, p.length)] : ".");

interface MoodMod { soft: boolean; tense: boolean; bright: number; vel: number; rev: number; drums: number }
/** moods only colour the band: night-ish moods are softer and roomier, sunny ones brighter, boss/chase ones minor */
function moodMod(id: string): MoodMod {
  const s = (id || "").toLowerCase();
  const soft = /night|dream|moon|mist|fog|sleep|lull|cave|ghost|haunt|star|snow|rain|twilight|dusk|calm|cozy|cloud/.test(s);
  const bright = /sun|candy|rainbow|fest|party|carnival|circus|holi|summit|morning|meadow|toy|neon|sparkle|beach|pop/.test(s);
  const tense = /kranky|boss|chase|storm|volcano|lava|forge|danger|angry|evil|dark/.test(s);
  return {
    soft, tense,
    bright: soft ? 0.72 : bright ? 1.15 : 1,
    vel: soft ? 0.82 : 1,
    rev: soft ? 1.7 : bright ? 0.9 : 1,
    drums: soft ? 0.78 : tense ? 1.05 : 1,
  };
}

interface Chord {
  deg: number;
  tones: number[];
  /** the chord folded into one octave around the key root (smooth voice leading) */
  voiced: number[];
  /** voiced + the root an octave up */
  arp: number[];
  /** chord root folded around the key root (bass register is this − 24) */
  bassRoot: number;
  /** next bar's folded root */
  next: number;
  note: (d: number) => number;
}

export class RollMusic {
  private ctx: AudioContext | null;
  private out: GainNode | null = null;
  private drums!: GainNode; private inst!: GainNode; private pump!: GainNode; private dly!: GainNode; private rev!: GainNode;
  private sendA!: GainNode; private sendB!: GainNode;
  private pan: Record<string, AudioNode> = {};
  /** long-lived shared filters (each drum hit is then just a source + a gain) */
  private bus: Record<string, AudioNode> = {};
  private noise: AudioBuffer | null = null;
  private waves!: { pulse: PeriodicWave; organ: PeriodicWave; uke: PeriodicWave };
  private plan: SongPlan;
  private spb: number;
  private baseScale = 1;
  private delayNode: DelayNode | null = null;
  private t0 = 0;
  private step = 0;
  private timer = 0;
  private running = false;
  private motif: (number | null)[] = [];
  private arpMask = 0;
  private finalBeat = Infinity;
  private feverOn = false;
  private zone: SongZone | null = null;
  private moods = new Map<string, MoodMod>();
  private chCache: { bar: number; st: Style; tense: boolean; ch: Chord } | null = null;
  /** per-zone colour: filter brightness, velocity, hat noise rate, lo-fi wonk, big kicks */
  private br = 1; private vel = 1; private hatRate = 1.4; private wonk = false; private bigKick = false;
  private last808 = { m: 0, t: -1 };
  /** looping (title screen) */
  loop = false;

  constructor(plan: SongPlan, bpmScale = 1) {
    this.plan = plan;
    this.spb = 60 / (plan.bpm * bpmScale);
    this.baseScale = bpmScale;
    this.ctx = audio.ensure();
    const rng = new Rng(plan.seed ^ 0x77aa);
    // a 2-bar motif in scale steps above the chord root (null = rest); strong beats lean on chord tones
    for (let i = 0; i < 16; i++) {
      const strong = i % 4 === 0, mid = i % 2 === 0;
      const p = strong ? 0.9 : mid ? 0.55 : 0.28;
      if (!rng.chance(p)) { this.motif.push(null); continue; }
      this.motif.push(strong ? rng.pick([0, 2, 4, 7]) : rng.pick([1, 2, 3, 4, 5, 6]));
    }
    this.motif[0] = 4; this.motif[15] = null;
    this.arpMask = rng.int(0, 0xffff) | 0x1111;
    if (!this.ctx) return;
    this.build();
  }

  private build() {
    const c = this.ctx!;
    const dest = audio.musicOut;
    if (!dest) return;
    this.out = c.createGain(); this.out.gain.value = 0.0001;
    this.out.connect(dest);
    this.drums = c.createGain(); this.drums.gain.value = 0.95; this.drums.connect(this.out);
    this.pump = c.createGain(); this.pump.connect(this.out);
    this.inst = c.createGain(); this.inst.gain.value = 0.62; this.inst.connect(this.pump);
    // a tempo-synced echo for bells / leads
    const delay = c.createDelay(2); delay.delayTime.value = this.spb * 0.75; this.delayNode = delay;
    const fb = c.createGain(); fb.gain.value = 0.32;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    this.dly = c.createGain(); this.dly.gain.value = 0.38;
    this.dly.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.inst);
    this.sendA = c.createGain(); this.sendA.gain.value = 0.7; this.sendA.connect(this.dly);
    this.sendB = c.createGain(); this.sendB.gain.value = 0.45; this.sendB.connect(this.dly);
    this.rev = c.createGain(); this.rev.gain.value = 0.28;
    const ro = audio.reverbOut;
    this.out.connect(this.rev); if (ro) this.rev.connect(ro);
    const mk = (name: string, p: number, bus: AudioNode) => {
      const n = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      if ("pan" in n) n.pan.value = p;
      n.connect(bus);
      this.pan[name] = n;
    };
    mk("kick", 0, this.drums); mk("snare", 0.04, this.drums); mk("clap", -0.08, this.drums); mk("hat", 0.28, this.drums);
    mk("shaker", -0.32, this.drums); mk("tamb", 0.45, this.drums); mk("ride", 0.36, this.drums); mk("perc", -0.22, this.drums); mk("fx", 0, this.drums);
    mk("bass", 0, this.inst); mk("keys", -0.18, this.inst); mk("keys2", 0.22, this.inst); mk("padL", -0.55, this.inst); mk("padR", 0.55, this.inst);
    mk("lead", 0.12, this.inst); mk("arpL", -0.45, this.inst); mk("arpR", 0.45, this.inst);
    const fl = (name: string, type: BiquadFilterType, freq: number, q: number, to: string) => {
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      f.connect(this.pan[to]); this.bus[name] = f;
    };
    fl("hat", "highpass", 7600, 0.8, "hat"); fl("shaker", "bandpass", 6200, 1.3, "shaker"); fl("tamb", "bandpass", 9200, 2.5, "tamb");
    fl("snare", "bandpass", 1900, 0.7, "snare"); fl("clap", "bandpass", 1350, 0.9, "clap"); fl("snap", "bandpass", 2900, 1.6, "clap");
    fl("ride", "bandpass", 6800, 0.9, "ride"); fl("click", "highpass", 2500, 0.7, "kick"); fl("slap", "bandpass", 3200, 1.2, "perc");
    fl("crash", "highpass", 4800, 0.5, "fx"); fl("dust", "highpass", 3000, 0.5, "fx");
    // 808 / log-drum bus: gentle saturation so phone speakers still hear the sub, then a lowpass
    const sh = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
    sh.curve = curve;
    const l8 = c.createBiquadFilter(); l8.type = "lowpass"; l8.frequency.value = 2400;
    sh.connect(l8); l8.connect(this.pan.bass); this.bus.b808 = sh;
    // single-cycle waves: 25% pulse (chiptune), drawbar organ, ukulele-ish pluck
    const pulse = (d: number) => {
      const re = [0], im = [0];
      for (let k = 1; k < 32; k++) { re.push((2 / (k * Math.PI)) * Math.sin(k * Math.PI * d)); im.push(0); }
      return c.createPeriodicWave(re, im);
    };
    this.waves = {
      pulse: pulse(0.25),
      organ: c.createPeriodicWave([0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0.6, 0.35, 0.25, 0, 0.12, 0, 0.09]),
      uke: c.createPeriodicWave([0, 0, 0, 0, 0, 0, 0], [0, 1, 0.38, 0.22, 0.12, 0.07, 0.04]),
    };
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() { return !!this.out; }
  get playing() { return this.running; }
  /** current song position in beats (audio clock) */
  beatNow() { return this.ctx ? (this.ctx.currentTime - this.t0) / this.spb : 0; }
  get audioRunning() { return !!this.ctx && this.ctx.state === "running"; }

  start(fromBeat: number, lead = 0.06) {
    if (!this.ctx || !this.out) return;
    this.stopTimer();
    const c = this.ctx;
    const now = c.currentTime;
    this.t0 = now + lead - fromBeat * this.spb;
    this.step = Math.ceil(fromBeat * 4 - 1e-6);
    this.finalBeat = Infinity;
    this.zone = null;
    this.last808 = { m: 0, t: -1 };
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.linearRampToValueAtTime(0.85, now + lead + 0.02);
    this.pump.gain.cancelScheduledValues(now);
    this.pump.gain.setValueAtTime(1, now);
    this.running = true;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** change the tempo on the fly (speed rushes, boosters) without losing the song position */
  setTempo(k: number) {
    if (!this.ctx) return;
    const spb = 60 / (this.plan.bpm * this.baseScale * Math.max(0.5, Math.min(2.5, k)));
    if (Math.abs(spb - this.spb) < 1e-5) return;
    const now = this.ctx.currentTime;
    const b = (now - this.t0) / this.spb;
    this.spb = spb;
    this.t0 = now - b * spb;
    this.delayNode?.delayTime.setTargetAtTime(Math.min(1.9, spb * 0.75), now, 0.05);
  }
  get tempo() { return 60 / this.spb; }

  stop(fade = 0.25) {
    this.stopTimer();
    this.running = false;
    if (!this.ctx || !this.out) return;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), now);
    this.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.03, fade));
  }

  /** the level is complete: a big final chord on the next downbeat, then a calm outro that fades away */
  finish(beat: number) {
    this.finalBeat = Math.ceil(beat + 0.5);
  }

  /** fever mode: a sparkle layer (bright arpeggio, open hats, the lead an octave up) on top of the current style */
  fever(on: boolean) {
    if (this.feverOn === on) return;
    this.feverOn = on;
    const c = this.ctx;
    if (!on || !c || !this.out || !this.running) return;
    const beat = this.beatNow();
    if (beat >= this.finalBeat) return;
    const sec = this.secAt(beat);
    const ch = this.chordAt(this.styleOf(sec), this.moodOf(sec.mood).tense, Math.floor(beat / 4));
    const t = c.currentTime + 0.03;
    ch.arp.forEach((m, i) => this.bell(t + i * 0.045, m + 24, 0.22, false, this.pan[i % 2 ? "arpR" : "arpL"]));
  }

  private stopTimer() { if (this.timer) { window.clearInterval(this.timer); this.timer = 0; } }

  dispose() {
    this.stop(0.15);
    const o = this.out;
    window.setTimeout(() => { try { o?.disconnect(); } catch { /* ignore */ } }, 400);
  }

  // ---------------------------------------------------------------- scheduling
  private secAt(beat: number): SongZone {
    const zs = this.plan.zones;
    let b = beat;
    if (this.loop) { const total = zs[zs.length - 1].beat0 + zs[zs.length - 1].beats; b = ((beat % total) + total) % total; }
    for (let i = zs.length - 1; i >= 0; i--) if (b >= zs[i].beat0) return zs[i];
    return zs[0];
  }
  private nextSecStart(beat: number) {
    const zs = this.plan.zones;
    for (const z of zs) if (z.beat0 > beat + 1e-6) return z.beat0;
    return Infinity;
  }
  private styleOf(z: SongZone): Style {
    return STYLES[z.style] ?? STYLES[FALLBACK[z.mood] ?? "M01"] ?? STYLES.M01;
  }
  private moodOf(id: string): MoodMod {
    let m = this.moods.get(id);
    if (!m) { m = moodMod(id); this.moods.set(id, m); }
    return m;
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.running) return;
    const horizon = c.currentTime + 0.14;
    let guard = 0;
    while (this.t0 + (this.step / 4) * this.spb < horizon && guard++ < 64) {
      const t = this.t0 + (this.step / 4) * this.spb;
      if (t >= c.currentTime - 0.02) this.play(this.step, t);
      this.step++;
    }
  }

  private chordAt(st: Style, tense: boolean, bar: number): Chord {
    const cc = this.chCache;
    if (cc && cc.bar === bar && cc.st === st && cc.tense === tense) return cc.ch;
    const prog = tense && st.prog[0] !== 5 ? TENSE : st.prog;
    const root = this.plan.root;
    const note = (d: number) => root + MAJOR[mod(d, 7)] + 12 * Math.floor(d / 7);
    const deg = prog[mod(bar, prog.length)];
    const tones = [note(deg), note(deg + 2), note(deg + 4)];
    if (st.sev) tones.push(note(deg + 6));
    const voiced = tones.map((n) => root - 2 + mod(n - root + 2, 12)).sort((a, b) => a - b);
    const low = (n: number) => root - 5 + mod(n - root + 5, 12);
    const ch: Chord = {
      deg, tones, voiced, arp: [...voiced, voiced[0] + 12], note,
      bassRoot: low(tones[0]), next: low(note(prog[mod(bar + 1, prog.length)])),
    };
    this.chCache = { bar, st, tense, ch };
    return ch;
  }

  private enterZone(z: SongZone, st: Style, md: MoodMod, t: number) {
    this.zone = z;
    this.br = (st.bright ?? 1) * md.bright;
    this.vel = md.vel;
    this.hatRate = st.hatRate ?? 1.4;
    this.wonk = !!st.vinyl;
    const T = Math.max(t - 0.02, this.ctx!.currentTime);
    this.drums.gain.setTargetAtTime(0.95 * (st.drumLvl ?? 1) * md.drums, T, 0.06);
    this.rev.gain.setTargetAtTime(Math.min(0.6, 0.28 * (st.rev ?? 1) * md.rev), T, 0.25);
    this.dly.gain.setTargetAtTime(0.38 * (st.dly ?? 1), T, 0.1);
  }

  private play(step: number, t: number) {
    const beat = step / 4;
    if (beat >= this.finalBeat) { this.outro(step, t, beat); return; }
    const s16 = mod(step, 16);
    const bar = Math.floor(beat / 4);
    const sec = this.secAt(beat);
    const st = this.styleOf(sec);
    const md = this.moodOf(sec.mood);
    if (sec !== this.zone) this.enterZone(sec, st, md, t);
    const I = Math.max(0, Math.min(3, Math.round(sec.intensity)));
    const ch = this.chordAt(st, md.tense, bar);
    const phraseBar = mod(bar, 4);
    const nextStart = this.nextSecStart(beat);
    const toNext = nextStart - beat;
    const sd = this.spb / 4;
    const sw = (s16 % 4 === 2 ? st.sw8 ?? 0 : 0) + (s16 % 2 === 1 ? st.sw16 ?? 0 : 0);
    const tt = t + sw * this.spb;

    // --- zone change: riser in the last 2 beats, crash + boom on the first step of the new zone
    if (Number.isFinite(nextStart) && step === Math.ceil((nextStart - 2) * 4 - 1e-6)) this.riser(t, Math.max(0.2, toNext) * this.spb, sec.silence ? 0.5 : 1);
    if (step === Math.ceil(sec.beat0 * 4 - 1e-6) && beat > 0.5 && !sec.silence) { this.crash(t, 0.9); if (I >= 2) this.boom(t); }

    // --- silence zones: only a soft tick + a quiet pad so the player can still feel the beat
    if (sec.silence) {
      if (s16 % 4 === 0) this.tick(t, s16 === 0 ? 0.55 : 0.32, s16 === 0);
      if (s16 === 0) this.pad(t, ch.voiced, this.spb * 4, 0.22);
      return;
    }

    // --- drums
    const fill = I >= 2 && phraseBar === 3 && s16 >= 12 && toNext > 2;
    if (fill) this.fill(st, s16 - 12, tt, ch);
    if (st.buildRoll && sec.section === "build" && I >= 1 && toNext <= 4 && (s16 >= 8 || s16 % 2 === 0)) {
      this.snare(tt, 0.2 + 0.5 * (1 - toNext / 4), st.snare === "rim" ? "snare" : st.snare, true);
    }
    let kicked = false;
    if (I >= 1) {
      this.bigKick = I >= 3;
      for (const lane of LANES) {
        const p = st.drums[lane];
        if (!p) continue;
        const c = at(lv(p, I), step);
        if (c === "." || (fill && SKIP_IN_FILL.has(lane))) continue;
        this.lane(lane, c, st, tt, ch);
        if (lane === "kick" && (c === "x" || c === "X")) kicked = true;
      }
    }
    // sidechain pump: the band ducks under every kick
    if (kicked && st.pump && I >= 2) {
      const g = this.pump.gain, d = st.pump * (I >= 3 ? 1 : 0.6);
      g.setValueAtTime(1 - d, tt); g.linearRampToValueAtTime(1, tt + this.spb * 0.5);
    }
    if (st.vinyl && Math.random() < 0.3) this.dust(t + Math.random() * sd);

    // --- bass
    const bp = lv(st.bassPat, I), bc = at(bp, step);
    if (bc !== "." && bc !== "-") this.bass(tt, this.bassNote(bc, ch), this.noteLen(bp, step, BASSLEN[st.bass]) * sd * 0.92, st.bass, !!st.glide, step);

    // --- harmony
    this.keysLane(st.keys, lv(st.keysPat, I), step, tt, ch, "keys");
    if (st.keys2) this.keysLane(st.keys2, lv(st.keys2Pat, I), step, tt, ch, "keys2");
    const pl = st.pad[Math.min(I, st.pad.length - 1)] ?? 0;
    if (s16 === 0 && pl > 0) this.pad(t, ch.voiced, this.spb * 4, pl * (md.soft ? 1.25 : 1));

    // --- lead: the seeded motif, chord-aware, in the big sections (and an octave up during fever)
    const leadOn = I >= 3 || (I >= 2 && sec.section === "build" && phraseBar >= 2);
    if (leadOn || this.feverOn) {
      const every = st.leadRate === 4 ? 4 : 2;
      if (s16 % every === 0) {
        const slot = every === 4 ? phraseBar * 4 + s16 / 4 : mod(bar, 2) * 8 + s16 / 2;
        let m = this.motif[slot % 16];
        let nx = this.motif[(slot + 1) % 16];
        if (phraseBar === 3 && s16 >= 8) {
          const cad = every === 4 ? CAD4 : CAD8, j = (s16 - 8) / every;
          m = cad[j] ?? null; nx = cad[j + 1] ?? null;
        }
        if (m !== null) {
          const oct = LEADOCT[st.lead] + (st.leadOct ?? 0);
          const lo = this.plan.root + oct - 3;
          let n = ch.note(ch.deg + m) + oct;
          while (n > lo + 19) n -= 12;
          while (n < lo) n += 12;
          const len = this.spb * (every / 4) * (nx === null ? 1.8 : 0.9);
          if (leadOn) this.lead(tt, n, len, st.lead, 1);
          if (this.feverOn) this.lead(tt, n + 12 <= this.plan.root + 40 ? n + 12 : n - 12, len, st.lead, leadOn ? 0.4 : 0.55);
        }
      }
    }

    // --- extras: sparkle arpeggio in the full sections
    if (st.arp && I >= 3 && s16 % (st.arpRate ?? 1) === 0) {
      const k = st.arpRate === 2 ? s16 >> 1 : s16;
      this.keyNote(st.arp, t, ch.arp[k % ch.arp.length] + KEYOCT[st.arp] + 12, 0.3 * this.vel, k % 2 ? "arpR" : "arpL", sd);
    }
    // --- fever: a falling sparkle arpeggio (between the regular arp notes) + open hats
    if (this.feverOn) {
      const fk = st.fArp ?? st.arp ?? "bell";
      const both = !!st.arp && I >= 3;
      if (!both || s16 % 2 === 1) {
        const tones = ch.arp;
        this.keyNote(fk, t, tones[tones.length - 1 - (s16 % tones.length)] + KEYOCT[fk] + 12, 0.26 * this.vel, s16 % 2 ? "arpL" : "arpR", sd);
      }
      if (I >= 1 && s16 % 4 === 2) this.hat(tt, 0.5 * this.vel, true);
    }
  }

  /** steps until the next note: holds (`-`) count fully, rests count up to `dflt` */
  private noteLen(p: string, step: number, dflt: number) {
    let k = 1;
    while (k < p.length && at(p, step + k) === "-") k++;
    if (k > 1) return k;
    while (k < dflt && at(p, step + k) === ".") k++;
    return k;
  }
  /** how many notes the pattern has already played in this bar */
  private hitIdx(p: string, step: number) {
    let n = 0;
    for (let s = step - mod(step, 16); s < step; s++) { const c = at(p, s); if (c !== "." && c !== "-") n++; }
    return n;
  }
  private bassNote(c: string, ch: Chord) {
    if (c === "b") return ch.next - 25;
    let d = c === "0" ? -3 : c.charCodeAt(0) - 49;
    if (!(d >= -3 && d <= 7)) d = 0;
    return ch.bassRoot - 24 + ch.note(ch.deg + d) - ch.tones[0];
  }

  private keysLane(kind: KeysK, p: string, step: number, t: number, ch: Chord, pan: string) {
    if (!p) return;
    const c = at(p, step);
    if (c === "." || c === "-") return;
    const s16 = mod(step, 16), sd = this.spb / 4;
    if (c === "x" || c === "X") {
      this.chordHit(kind, t, ch.voiced, this.noteLen(p, step, 16) * sd, (c === "X" ? 1 : 0.8) * this.vel, pan, s16 >> 2);
      return;
    }
    if (c === "m" && !((this.arpMask >> s16) & 1)) return;
    const tones = ch.arp;
    const idx = c === "m" ? s16 >> 1 : this.hitIdx(p, step);
    const i = c === "u" ? idx % tones.length : ARPSEQ[idx % 8] % tones.length;
    this.keyNote(kind, t, tones[i] + KEYOCT[kind], (s16 % 4 === 0 ? 0.75 : 0.62) * this.vel, pan, this.noteLen(p, step, 4) * sd);
  }

  private outro(step: number, t: number, beat: number) {
    const k = beat - this.finalBeat;
    const st = this.styleOf(this.secAt(this.finalBeat - 1));
    const root = this.plan.root;
    const s16 = mod(step, 16);
    if (k < 0.01) {
      const tones = [root, root + 4, root + 7, root + 12];
      this.crash(t, 1); this.boom(t); this.kick(t, 1, "punch", false);
      this.pad(t, tones, this.spb * 6, 0.8);
      this.chordHit(st.keys === "pad" || st.keys === "drone" ? "uke" : st.keys, t, tones.slice(0, 3), this.spb * 4, 0.9, "keys", 0);
      [24, 28, 31, 36].forEach((d, i) => this.bell(t + this.spb * 0.25 * i, root + d, i === 0 || i === 3 ? 0.5 : 0.45, true, this.pan.keys));
      return;
    }
    if (k > 32) { this.stop(1.2); return; }
    // calm, happy outro on the last style's softest keys
    if (k >= 4 && s16 % 4 === 0) {
      const fade = Math.max(0.2, 1 - k / 32);
      const deg = [0, 4, 5, 3][mod(Math.floor(beat / 4), 4)];
      const note = (d: number) => root + MAJOR[mod(d, 7)] + 12 * Math.floor(d / 7);
      const tones = [note(deg), note(deg + 2), note(deg + 4)];
      const soft = SOFT_KEYS.has(st.keys) ? st.keys : "marimba";
      this.keyNote(soft, t, tones[(s16 / 4) % 3] + KEYOCT[soft], 0.45 * fade, "keys");
      if (s16 === 0) this.pad(t, tones, this.spb * 4, 0.3 * fade);
    }
  }

  // ---------------------------------------------------------------- drums
  private lane(lane: Lane, c: string, st: Style, t: number, ch: Chord) {
    const V = this.vel, sd = this.spb / 4;
    switch (c) {
      case "o": this.hit(lane, c, st, t, 0.4 * V, ch, true); return;
      case "x": this.hit(lane, c, st, t, 0.75 * V, ch, false); return;
      case "X": this.hit(lane, c, st, t, V, ch, false); return;
      case "f": this.hit(lane, "o", st, Math.max(0, t - 0.028), 0.3 * V, ch, true); this.hit(lane, "x", st, t, 0.8 * V, ch, false); return;
      case "r": case "3": case "R": {
        const n = c === "r" ? 2 : c === "3" ? 3 : 4;
        for (let i = 0; i < n; i++) this.hit(lane, "x", st, t + (i * sd) / n, (0.38 + (0.3 * i) / n) * V, ch, i > 0);
        return;
      }
      default: this.hit(lane, c, st, t, 0.8 * V, ch, false);
    }
  }
  private hit(lane: Lane, c: string, st: Style, t: number, v: number, ch: Chord, lite: boolean) {
    switch (lane) {
      case "kick": this.kick(t, v, st.kick, this.bigKick); break;
      case "snare": this.snare(t, v, st.snare, lite); break;
      case "clap": this.snare(t, v, "clap", lite); break;
      case "rim": this.snare(t, v, "rim"); break;
      case "snap": this.snap(t, v); break;
      case "hat": this.hat(t, v, false); break;
      case "ohat": this.hat(t, v, true); break;
      case "shaker": this.shaker(t, v); break;
      case "tamb": this.tamb(t, v); break;
      case "ride": this.ride(t, v); break;
      case "perc": this.perc(st.perc ?? "conga", c, t, v); break;
      case "timp": this.timp(c, t, v, ch); break;
      case "tick": this.tick(t, v, c === "X"); break;
      case "cym": this.crash(t, v * 0.4); break;
    }
  }
  /** the last beat of every 4-bar phrase */
  private fill(st: Style, k: number, t: number, ch: Chord) {
    const v = 0.35 + k * 0.14, sd = this.spb / 4, fx = this.pan.fx;
    switch (st.fill) {
      case "tom": {
        const f = [220, 185, 150, 122][k];
        this.skin(t, f, f * 0.72, 0.3, 0.5 + k * 0.06, 0.1, fx);
        if (k >= 2) this.skin(t + sd / 2, f * 0.9, f * 0.65, 0.25, 0.42, 0.1, fx);
        return;
      }
      case "tabla": this.perc("tabla", k === 3 ? "d" : "n", t, v); this.perc("tabla", "k", t + sd / 2, v * 0.7); return;
      case "dholak": this.perc("dholak", k % 2 ? "h" : "l", t, v); this.perc("dholak", "h", t + sd / 2, v * 0.6); return;
      case "timp": for (let i = 0; i < 3; i++) this.timp("l", t + (i * sd) / 3, 0.25 + k * 0.12 + i * 0.03, ch); return;
      case "march": for (let i = 0; i < 4; i++) this.snare(t + (i * sd) / 4, 0.22 + k * 0.1 + i * 0.03, "march", true); return;
      case "glitch":
        for (let i = 0; i < 2; i++) this.snare(t + (i * sd) / 2, v * (0.7 + i * 0.2), "clap", true);
        this.chip(t, ch.voiced[0] + 12 + k * 5, 0.45, fx, sd * 0.8);
        return;
      case "chip": this.snare(t, v, "chip"); this.chip(t, ch.voiced[0] + 12 + [0, 4, 7, 12][k], 0.6, fx, sd * 0.85); return;
      case "box": this.box(t, ch.arp[k % ch.arp.length] + 24, 0.35, this.pan.keys, false); return;
      default: {
        const kind: Snr = st.snare === "rim" || st.snare === "chip" ? "snare" : st.snare;
        this.snare(t, v, kind, k > 0);
        if (k === 3) this.snare(t + sd / 2, v, kind, true);
      }
    }
  }

  // ---------------------------------------------------------------- primitives
  private env(g: GainNode, t: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  private o(type: OscillatorType | PeriodicWave, f: number, t: number, dur: number, dest: AudioNode) {
    const o = this.ctx!.createOscillator();
    if (typeof type === "string") o.type = type as OscillatorType; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  private n(t: number, dur: number, dest: AudioNode, rate = 1) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise; s.playbackRate.value = rate; s.loop = dur > 0.4;
    s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return s;
  }
  private g(dest: AudioNode) { const g = this.ctx!.createGain(); g.connect(dest); return g; }
  private f(type: BiquadFilterType, freq: number, q: number, dest: AudioNode) { const f = this.ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(dest); return f; }
  /** delayed vibrato (cents) on one or more oscillators */
  private vibrato(t: number, len: number, cents: number, ...oscs: (OscillatorNode | null)[]) {
    if (len < 0.2) return;
    const c = this.ctx!;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.6;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(cents, t + Math.min(0.28, len * 0.6));
    lfo.connect(lg);
    for (const o of oscs) if (o) lg.connect(o.detune);
    lfo.start(t); lfo.stop(t + len + 0.15);
  }

  // ---------------------------------------------------------------- drum voices
  private kick(t: number, v: number, kind: Kick, big: boolean) {
    const [f0, f1, pk, dec, click] = KICKS[kind];
    const g = this.g(this.pan.kick);
    const o = this.o(kind === "chip" ? "triangle" : "sine", f0, t, dec * 1.4 + 0.1, g);
    o.frequency.exponentialRampToValueAtTime(big ? f1 * 0.88 : f1, t + (kind === "chip" ? 0.05 : 0.12));
    this.env(g, t, v * pk, 0.004, big ? dec * 1.4 : dec);
    if (click) { const cg = this.g(this.bus.click); this.n(t, 0.03, cg); this.env(cg, t, v * click, 0.001, 0.02); }
  }
  private snare(t: number, v: number, kind: Snr, lite = false) {
    switch (kind) {
      case "rim": {
        const g = this.g(this.pan.snare); this.o("triangle", 820, t, 0.06, g); this.o("sine", 1650, t, 0.04, g);
        this.env(g, t, v * 0.4, 0.001, 0.045);
        return;
      }
      case "clap": {
        const g = this.g(this.bus.clap); this.n(t, 0.25, g);
        g.gain.setValueAtTime(0.0001, t);
        if (!lite) for (const d of [0, 0.011, 0.023]) { g.gain.setValueAtTime(v * 0.75, t + d); g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.009); }
        g.gain.setValueAtTime(v * 0.6, t + (lite ? 0.001 : 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + (lite ? 0.12 : 0.2));
        return;
      }
      case "chip": {
        const g = this.g(this.pan.snare); this.n(t, 0.12, g, 0.55); this.env(g, t, v * 0.32, 0.001, 0.09);
        return;
      }
    }
    // snare / march / lofi / gated: noise through the shared snare band + a short pitched body
    const nz = this.g(this.bus.snare);
    if (kind === "gated") {
      this.n(t, 0.3, nz);
      nz.gain.setValueAtTime(0.0001, t); nz.gain.exponentialRampToValueAtTime(v * 0.62, t + 0.003);
      nz.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.05); nz.gain.linearRampToValueAtTime(v * 0.24, t + 0.2); nz.gain.linearRampToValueAtTime(0.0001, t + 0.23);
    } else {
      this.n(t, 0.2, nz, kind === "lofi" ? 0.7 : kind === "march" ? 1.3 : 1);
      this.env(nz, t, v * (kind === "lofi" ? 0.42 : 0.62), 0.002, kind === "march" ? 0.09 : kind === "lofi" ? 0.12 : 0.16);
    }
    if (lite) return;
    const f0 = kind === "march" ? 300 : kind === "lofi" ? 170 : 190;
    const g2 = this.g(this.pan.snare); const o = this.o("triangle", f0, t, 0.12, g2);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + 0.08); this.env(g2, t, v * 0.4, 0.002, 0.09);
  }
  private hat(t: number, v: number, open: boolean) {
    const g = this.g(this.bus.hat); this.n(t, open ? 0.3 : 0.06, g, this.hatRate);
    this.env(g, t, v * 0.3, 0.001, open ? 0.24 : this.hatRate > 2 ? 0.028 : 0.045);
  }
  private shaker(t: number, v: number) {
    const g = this.g(this.bus.shaker); this.n(t, 0.1, g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.26, t + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
  }
  private tamb(t: number, v: number) {
    const g = this.g(this.bus.tamb); this.n(t, 0.18, g, 1.2); this.env(g, t, v * 0.32, 0.002, 0.14);
  }
  private snap(t: number, v: number) {
    const g = this.g(this.bus.snap); this.n(t, 0.06, g, 1.5); this.env(g, t, v * 0.55, 0.001, 0.045);
  }
  private ride(t: number, v: number) {
    const g = this.g(this.bus.ride); this.n(t, 0.45, g, 1.1); this.env(g, t, v * 0.13, 0.001, 0.36);
    const p = this.g(this.pan.ride); this.o("triangle", 2637, t, 0.3, p); this.env(p, t, v * 0.035, 0.001, 0.25);
  }
  private tick(t: number, v: number, hi: boolean) {
    const g = this.g(this.pan.fx); this.o("sine", hi ? 2093 : 1568, t, 0.05, g); this.env(g, t, v * 0.18, 0.001, 0.035);
  }
  /** vinyl crackle */
  private dust(t: number) {
    const g = this.g(this.bus.dust); this.n(t, 0.012, g); this.env(g, t, 0.015 + Math.random() * 0.04, 0.0005, 0.005);
  }
  /** a pitched drum skin (tabla, dholak, conga, toms, timpani): a sine that bends, an optional overtone and a slap */
  private skin(t: number, f0: number, f1: number, dec: number, v: number, slap: number, dest: AudioNode, ring = 0) {
    const g = this.g(dest);
    const o = this.o("sine", f0, t, dec + 0.05, g);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(0.2, dec * 0.6));
    this.env(g, t, v, 0.002, dec);
    if (ring) { const rg = this.g(dest); this.o("sine", f1 * ring, t, dec * 0.5, rg); this.env(rg, t, v * 0.3, 0.002, dec * 0.45); }
    if (slap) { const s = this.g(this.bus.slap); this.n(t, 0.04, s, 1.3); this.env(s, t, v * slap, 0.001, 0.025); }
  }
  private perc(kind: Perc, c: string, t: number, v: number) {
    const dest = this.pan.perc;
    if (kind === "tabla") {
      // dayan tuned to the song's key; bayan "ge" glides up under the wrist
      const k = c === "x" || c === "X" ? "n" : c === "o" ? "i" : c;
      const sa = mtof(this.plan.root);
      if (k === "g" || k === "d") this.skin(t, 74, 100, 0.5, v * 0.7, 0, dest);
      if (k === "n" || k === "d") this.skin(t, sa, sa * 0.995, 0.45, v * 0.3, 0.3, dest, 2);
      else if (k === "i") this.skin(t, sa, sa, 0.2, v * 0.2, 0.15, dest, 2);
      else if (k === "k") this.skin(t, 150, 110, 0.04, v * 0.22, 0.7, dest);
      return;
    }
    const k = c === "x" || c === "X" ? "l" : c === "o" ? "h" : c;
    if (kind === "dholak") {
      if (k === "l") this.skin(t, 125, 78, 0.26, v * 0.8, 0.2, dest);
      else if (k === "h") this.skin(t, 430, 390, 0.13, v * 0.4, 0.4, dest);
      else this.skin(t, 300, 220, 0.05, v * 0.28, 0.8, dest);
      return;
    }
    if (k === "l") this.skin(t, 196, 176, 0.26, v * 0.55, 0.12, dest);
    else if (k === "h") this.skin(t, 294, 270, 0.18, v * 0.5, 0.18, dest);
    else this.skin(t, 340, 300, 0.05, v * 0.28, 0.7, dest);
  }
  /** timpani on the chord root (`h` = its fifth); accents add a taiko-style thump */
  private timp(c: string, t: number, v: number, ch: Chord) {
    const f = mtof(ch.bassRoot - 12 + (c === "h" ? 7 : 0));
    this.skin(t, f * 1.03, f, 1.1, v * 0.62, 0.08, this.pan.fx, 1.5);
    if (c === "X") this.skin(t, 72, 44, 0.55, v * 0.5, 0, this.pan.fx);
  }
  private crash(t: number, v: number) {
    const g = this.g(this.bus.crash); this.n(t, 1.8, g, 0.9); this.env(g, t, v * 0.26, 0.003, 1.6);
  }
  private boom(t: number) {
    const g = this.g(this.pan.fx); const o = this.o("sine", 90, t, 1.2, g); o.frequency.exponentialRampToValueAtTime(32, t + 0.9); this.env(g, t, 0.7, 0.005, 1.0);
  }
  private riser(t: number, dur: number, vol: number) {
    const g = this.g(this.pan.fx); const bp = this.f("bandpass", 500, 2.2, g); this.n(t, dur + 0.05, bp);
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    const g2 = this.g(this.pan.fx); const o = this.o("sawtooth", 180, t, dur, this.f("lowpass", 1800, 0.5, g2));
    o.frequency.exponentialRampToValueAtTime(720, t + dur);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.05 * vol, t + dur * 0.9); g2.gain.linearRampToValueAtTime(0.0001, t + dur);
  }

  // ---------------------------------------------------------------- bass voices
  private bass(t: number, midi: number, len: number, kind: BassK, glide: boolean, step: number) {
    const f = mtof(midi), br = this.br, dest = this.pan.bass;
    switch (kind) {
      case "sub": {
        const g = this.g(dest); this.o("sine", f, t, len, g); const g2 = this.g(dest); this.o("triangle", f * 2, t, len, g2);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.02); g.gain.setValueAtTime(0.5, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        this.env(g2, t, 0.06, 0.01, len * 0.5);
        return;
      }
      case "808": {
        // a long sine through the saturation bus; jumps of a 4th or more slide from the previous note
        const p = this.last808;
        const slide = glide && p.t >= 0 && t > p.t && t - p.t < this.spb * 2.6 && Math.abs(p.m - midi) >= 5;
        this.last808 = { m: midi, t };
        const g = this.g(this.bus.b808);
        const o = this.o("sine", slide ? mtof(p.m) : f, t, len + 0.06, g);
        if (slide) o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.22, t + Math.max(0.05, len * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
        return;
      }
      case "reese": {
        // two detuned saws beating against each other under a slowly moving filter, plus a clean sub
        const g = this.g(dest); const lp = this.f("lowpass", 400 * br, 2.2, g);
        lp.frequency.setValueAtTime(380 * br, t); lp.frequency.linearRampToValueAtTime(1150 * br, t + len * 0.5); lp.frequency.linearRampToValueAtTime(480 * br, t + len);
        const a = this.o("sawtooth", f, t, len, lp), b = this.o("sawtooth", f, t, len, lp); a.detune.value = -16; b.detune.value = 16;
        this.o("sine", f, t, len, g);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.03); g.gain.setValueAtTime(0.18, t + len * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + len);
        return;
      }
      case "wobble": {
        // a resonant lowpass swept by a tempo-synced LFO (rate changes with the beat)
        const c = this.ctx!;
        const g = this.g(dest); const lp = this.f("lowpass", 720 * br, 6, g);
        const lfo = c.createOscillator(); lfo.type = "triangle"; lfo.frequency.value = WOB[mod(step >> 2, WOB.length)] / this.spb;
        const lg = c.createGain(); lg.gain.value = 600 * br; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(t + len + 0.1);
        this.o("sawtooth", f, t, len, lp); this.o("square", f * 1.003, t, len, lp);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.015); g.gain.setValueAtTime(0.2, t + len * 0.9); g.gain.linearRampToValueAtTime(0.0001, t + len);
        return;
      }
      case "walk": case "warm": {
        const g = this.g(dest); const lp = this.f("lowpass", (kind === "walk" ? 900 : 620) * br, 1, g);
        this.o("triangle", f, t, len + 0.1, lp); this.o("sine", f, t, len + 0.1, g);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.16, t + Math.max(0.02, len * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08);
        return;
      }
      case "tuba": {
        const g = this.g(dest); const lp = this.f("lowpass", 300, 1.4, g);
        lp.frequency.setValueAtTime(280, t); lp.frequency.exponentialRampToValueAtTime(1000 * br, t + 0.05); lp.frequency.exponentialRampToValueAtTime(420, t + Math.max(0.08, len));
        const o = this.o("sawtooth", f, t, len, lp); o.detune.setValueAtTime(-35, t); o.detune.linearRampToValueAtTime(0, t + 0.05);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.025);
        g.gain.setValueAtTime(0.4, t + Math.max(0.03, len * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.04);
        return;
      }
      case "chip": {
        const g = this.g(dest); this.o("triangle", f * 2, t, len, g);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.004); g.gain.setValueAtTime(0.5, t + len * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + len);
        return;
      }
      case "log": {
        // log-drum "bwomp": a sine that drops into pitch, saturated
        const g = this.g(this.bus.b808); const o = this.o("sine", f * 2.4, t, len + 0.1, g);
        o.frequency.exponentialRampToValueAtTime(f * 2, t + 0.045);
        this.env(g, t, 0.4, 0.003, Math.min(len, 0.42));
        return;
      }
      case "ostinato": {
        // staccato low strings an octave up (cello register)
        const g = this.g(dest); const lp = this.f("lowpass", 1500 * br, 0.8, g);
        const a = this.o("sawtooth", f * 2, t, 0.22, lp), b = this.o("sawtooth", f * 2, t, 0.22, lp); a.detune.value = -9; b.detune.value = 9;
        this.env(g, t, 0.2, 0.012, 0.15);
        return;
      }
      case "synth": {
        const g = this.g(dest); const lp = this.f("lowpass", 1200 * br, 5, g);
        lp.frequency.setValueAtTime(1500 * br, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.13);
        this.o("sawtooth", f, t, len + 0.05, lp);
        this.env(g, t, 0.36, 0.004, Math.max(0.09, len));
        return;
      }
    }
    // pluck / funk / saw
    const g = this.g(dest);
    const lp = this.f("lowpass", kind === "funk" ? 2200 : kind === "saw" ? 900 : 1000, kind === "funk" ? 6 : 2, g);
    lp.frequency.setValueAtTime((kind === "funk" ? 2400 : 1100) * br, t); lp.frequency.exponentialRampToValueAtTime(kind === "funk" ? 380 : 300, t + 0.16);
    this.o(kind === "pluck" ? "triangle" : kind === "funk" ? "square" : "sawtooth", f, t, len + 0.1, lp);
    if (kind === "pluck") { const x = this.g(dest); this.o("square", f, t, len, this.f("lowpass", 700, 1, x)); this.env(x, t, 0.08, 0.004, len); }
    this.env(g, t, kind === "saw" ? 0.36 : kind === "funk" ? 0.34 : 0.5, 0.005, len + 0.08);
  }

  // ---------------------------------------------------------------- keys / harmony voices
  /** one note of a keys voice (arpeggios, sparkles) */
  private keyNote(kind: KeysK, t: number, midi: number, v: number, pan: string, len = 0.3) {
    const dest = this.pan[pan] ?? this.pan.keys;
    switch (kind) {
      case "marimba": this.marimba(t, midi, v * 0.8, dest); break;
      case "kalimba": this.kalimba(t, midi, v * 0.7, dest); break;
      case "box": this.box(t, midi, v * 0.75, dest, false); break;
      case "pan": this.steelPan(t, midi, v * 0.7, dest, false); break;
      case "sitar": this.sitar(t, midi, v * 0.7, dest, len, false); break;
      case "chip": this.chip(t, midi, v * 0.7, dest, Math.max(0.05, Math.min(len, this.spb * 0.5))); break;
      case "cowbell": this.cowbell(t, midi, v * 0.8, dest); break;
      case "pluck": this.pluck(t, [midi], v * 0.7, dest); break;
      case "uke": this.strum(t, [midi], v * 0.7, dest); break;
      case "epiano": this.epiano(t, [midi], v * 0.6, dest); break;
      case "organ": this.organ(t, [midi], v * 0.8, dest, len); break;
      case "brass": this.brass(t, [midi], v * 0.8, dest, len); break;
      case "stab": this.stab(t, [midi], v * 0.8, dest); break;
      default: this.bell(t, midi, v * 0.45, pan === "keys" || pan === "keys2", dest);
    }
  }
  /** a whole chord on a keys voice */
  private chordHit(kind: KeysK, t: number, notes: number[], len: number, v: number, pan: string, beatIdx: number) {
    const dest = this.pan[pan] ?? this.pan.keys;
    const up = (k: number) => notes.map((n) => n + k);
    switch (kind) {
      case "uke": this.strum(t, up(12), v * 0.6, dest); return;
      case "epiano": this.epiano(t, up(12), v * 0.6, dest); return;
      case "pad": this.pad(t, notes, len, v * 0.6); return;
      case "stab": this.stab(t, notes, v * 0.55, dest); return;
      case "pluck": this.pluck(t, notes, v * 0.6, dest); return;
      case "organ": this.organ(t, notes, v * 0.8, dest, len); return;
      case "brass": this.brass(t, notes, v * 0.75, dest, len); return;
      case "strings": this.strings(t, notes, len, v * 0.85); return;
      case "choir": this.choir(t, notes, len, v * 0.8, dest); return;
      // tanpura-style drone on the key's tonic: Pa, Sa', Sa', Sa
      case "drone": this.drone(t, this.plan.root - 12 + [7, 12, 12, 0][beatIdx % 4], v, dest); return;
      case "chip": {
        const sd = this.spb / 4;
        notes.slice(0, 3).forEach((n, i) => this.chip(t + (i * sd) / 3, n + 12, v * 0.7, dest, sd / 3));
        return;
      }
      default: notes.forEach((n, i) => this.keyNote(kind, t + i * 0.018, n + KEYOCT[kind], v * 0.75, pan, len));
    }
  }
  private marimba(t: number, midi: number, v: number, dest: AudioNode) {
    const f = mtof(midi);
    const g = this.g(dest); this.o("sine", f, t, 0.6, g); this.env(g, t, v * 0.42, 0.003, 0.5);
    const g2 = this.g(dest); this.o("sine", f * 4, t, 0.12, g2); this.env(g2, t, v * 0.1 * this.br, 0.002, 0.07);
  }
  private bell(t: number, midi: number, v: number, echo: boolean, dest: AudioNode) {
    const f = mtof(midi), c = this.ctx!;
    const g = this.g(dest); if (echo) g.connect(this.sendA);
    const car = this.o("sine", f, t, 1.4, g);
    const m = c.createOscillator(); m.frequency.value = f * 3.5;
    const mg = c.createGain(); mg.gain.setValueAtTime(f * 2.4 * this.br, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.9);
    m.connect(mg); mg.connect(car.frequency); m.start(t); m.stop(t + 1.45);
    this.env(g, t, v * 0.38, 0.002, 1.2);
  }
  private kalimba(t: number, midi: number, v: number, dest: AudioNode, echo = false) {
    const f = mtof(midi);
    const g = this.g(dest); if (echo) g.connect(this.sendB); this.o("sine", f, t, 0.9, g); this.env(g, t, v * 0.36, 0.002, 0.75);
    const g2 = this.g(dest); this.o("sine", f * 5.9, t, 0.08, g2); this.env(g2, t, v * 0.06 * this.br, 0.001, 0.05);
  }
  /** music-box tine: a pure tone with a short inharmonic "ting" */
  private box(t: number, midi: number, v: number, dest: AudioNode, echo: boolean) {
    const f = mtof(midi);
    const g = this.g(dest); if (echo) g.connect(this.sendA); this.o("sine", f, t, 1.3, g); this.env(g, t, v * 0.3, 0.001, 1.1);
    const g2 = this.g(dest); this.o("sine", f * 4.2, t, 0.2, g2); this.env(g2, t, v * 0.07 * this.br, 0.001, 0.15);
  }
  /** steel pan: 1:1 FM whose brightness falls away fast */
  private steelPan(t: number, midi: number, v: number, dest: AudioNode, echo: boolean) {
    const f = mtof(midi), c = this.ctx!;
    const g = this.g(dest); if (echo) g.connect(this.sendB);
    const car = this.o("sine", f, t, 1, g);
    const m = c.createOscillator(); m.frequency.value = f;
    const mg = c.createGain(); mg.gain.setValueAtTime(f * 2.2 * this.br, t); mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.18);
    m.connect(mg); mg.connect(car.frequency); m.start(t); m.stop(t + 1.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  }
  /** sitar-ish pluck: a saw through a moving resonant peak (the buzzy bridge), sliding into pitch on the lead */
  private sitar(t: number, midi: number, v: number, dest: AudioNode, len: number, slide: boolean) {
    const f = mtof(midi), c = this.ctx!, br = this.br;
    const g = this.g(dest); if (slide) g.connect(this.sendB);
    const lp = this.f("lowpass", 4800 * br, 0.7, g);
    const pk = c.createBiquadFilter(); pk.type = "peaking"; pk.Q.value = 4; pk.gain.value = 10; pk.connect(lp);
    pk.frequency.setValueAtTime(3400 * br, t); pk.frequency.exponentialRampToValueAtTime(1400 * br, t + 0.45);
    const L = Math.max(0.5, len + 0.5);
    const o = this.o("sawtooth", f * (slide ? 0.944 : 0.985), t, L, pk);
    o.frequency.exponentialRampToValueAtTime(f, t + (slide ? 0.07 : 0.02));
    if (slide) this.vibrato(t, len, 10, o);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(v * 0.04, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
  }
  /** chiptune 25% pulse */
  private chip(t: number, midi: number, v: number, dest: AudioNode, len: number) {
    const g = this.g(dest); this.o(this.waves.pulse, mtof(midi), t, len, g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.003);
    g.gain.linearRampToValueAtTime(v * 0.05, t + len * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + len);
  }
  /** pitched cowbell: two detuned squares through a bandpass */
  private cowbell(t: number, midi: number, v: number, dest: AudioNode) {
    const f = mtof(midi);
    const g = this.g(dest); const bp = this.f("bandpass", f * 1.7, 1.2, g);
    this.o("square", f, t, 0.32, bp); this.o("square", f * 1.48, t, 0.32, bp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.15, t + 0.002);
    g.gain.exponentialRampToValueAtTime(v * 0.05, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  }
  /** bright saw pluck with a falling filter (EDM / synthwave / house) */
  private pluck(t: number, notes: number[], v: number, dest: AudioNode) {
    const br = this.br, g = this.g(dest), lp = this.f("lowpass", 3000 * br, 1.6, g);
    lp.frequency.setValueAtTime(4200 * br, t); lp.frequency.exponentialRampToValueAtTime(450, t + 0.2);
    for (const m of notes) this.o("sawtooth", mtof(m), t, 0.32, lp);
    this.env(g, t, v * 0.12, 0.003, 0.26);
  }
  private strum(t: number, notes: number[], v: number, dest: AudioNode) {
    const lp = this.f("lowpass", 2600 * this.br, 1, dest);
    notes.slice(0, 4).forEach((m, i) => {
      const tt = t + i * 0.014;
      const g = this.g(lp); this.o(this.waves.uke, mtof(m), tt, 0.5, g); this.env(g, tt, v * 0.2, 0.003, 0.32);
    });
  }
  private epiano(t: number, notes: number[], v: number, dest: AudioNode) {
    const c = this.ctx!;
    for (const n of notes) {
      const f = mtof(n);
      const g = this.g(dest);
      const car = this.o("sine", f, t, 1.6, g);
      if (this.wonk) car.detune.value = (Math.random() - 0.5) * 16;
      const m = c.createOscillator(); m.frequency.value = f;
      const mg = c.createGain(); mg.gain.setValueAtTime(f * 1.1 * this.br, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.5);
      m.connect(mg); mg.connect(car.frequency); m.start(t); m.stop(t + 1.65);
      this.env(g, t, v * 0.17, 0.004, 1.4);
    }
  }
  /** drawbar-organ stab (one oscillator per note) */
  private organ(t: number, notes: number[], v: number, dest: AudioNode, len: number) {
    const L = Math.max(0.12, Math.min(len, 0.45));
    const g = this.g(dest);
    for (const n of notes) this.o(this.waves.organ, mtof(n), t, L, g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.085, t + 0.005);
    g.gain.exponentialRampToValueAtTime(v * 0.045, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
  }
  /** brass: saws with an opening filter and a little scoop into pitch */
  private brass(t: number, notes: number[], v: number, dest: AudioNode, len: number, echo = false) {
    const br = this.br, L = Math.max(0.14, Math.min(len, 0.9));
    const g = this.g(dest); if (echo) g.connect(this.sendB);
    const lp = this.f("lowpass", 500, 1.1, g);
    lp.frequency.setValueAtTime(450, t); lp.frequency.exponentialRampToValueAtTime(2700 * br, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1300 * br, t + L);
    let first: OscillatorNode | null = null;
    for (const n of notes) {
      const o = this.o("sawtooth", mtof(n), t, L + 0.06, lp);
      o.detune.setValueAtTime(-40, t); o.detune.linearRampToValueAtTime(0, t + 0.06);
      first ??= o;
    }
    if (notes.length === 1) this.vibrato(t, L, 12, first);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.075, t + 0.03);
    g.gain.setValueAtTime(v * 0.065, t + L * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + L + 0.05);
  }
  private stab(t: number, notes: number[], v: number, dest: AudioNode) {
    const g = this.g(dest); const lp = this.f("lowpass", 1900 * this.br, 1.2, g);
    for (const n of notes) { this.o("sawtooth", mtof(n) * 1.004, t, 0.2, lp); this.o("sawtooth", mtof(n) * 0.996, t, 0.2, lp); }
    this.env(g, t, v * 0.1, 0.003, 0.16);
  }
  private pad(t: number, notes: number[], len: number, v: number) {
    for (const side of ["padL", "padR"] as const) {
      const g = this.g(this.pan[side]); const lp = this.f("lowpass", 1150 * this.br, 0.4, g);
      notes.forEach((n, i) => { const o = this.o("sawtooth", mtof(n) * (side === "padL" ? 0.997 : 1.003), t, len + 0.6, lp); o.detune.value = i % 2 ? 6 : -6; });
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + Math.min(0.5, len * 0.25));
      g.gain.setValueAtTime(v * 0.05, t + len * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.5);
    }
  }
  /** string ensemble: detuned saws left/right, slow attack, shared vibrato */
  private strings(t: number, notes: number[], len: number, v: number) {
    const c = this.ctx!;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.2;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + 0.7);
    lfo.connect(lg); lfo.start(t); lfo.stop(t + len + 0.6);
    const atk = Math.min(0.4, len * 0.3);
    for (const side of ["padL", "padR"] as const) {
      const g = this.g(this.pan[side]); const lp = this.f("lowpass", 2300 * this.br, 0.6, g);
      notes.forEach((n, i) => {
        const o = this.o("sawtooth", mtof(n), t, len + 0.5, lp);
        o.detune.value = (side === "padL" ? -7 : 7) + (i % 2 ? 3 : -3); lg.connect(o.detune);
      });
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + atk);
      g.gain.setValueAtTime(v * 0.05, t + Math.max(atk, len * 0.85)); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.45);
    }
  }
  /** choir "aah": saws through two vowel formants */
  private choir(t: number, notes: number[], len: number, v: number, dest: AudioNode) {
    const c = this.ctx!;
    const g = this.g(dest);
    const mix = c.createGain(); mix.connect(this.f("bandpass", 780, 4, g)); mix.connect(this.f("bandpass", 1180, 5, g));
    notes.forEach((n, i) => { const o = this.o("sawtooth", mtof(n), t, len + 0.5, mix); o.detune.value = i % 2 ? 7 : -7; });
    const atk = Math.min(0.45, len * 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.16, t + atk);
    g.gain.setValueAtTime(v * 0.16, t + Math.max(atk, len * 0.85)); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.45);
  }
  /** one long tanpura-style pluck */
  private drone(t: number, midi: number, v: number, dest: AudioNode) {
    const g = this.g(dest); const lp = this.f("lowpass", 1700 * this.br, 0.8, g);
    const o = this.o("sawtooth", mtof(midi), t, 2.4, lp); o.detune.value = 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(v * 0.03, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
  }

  // ---------------------------------------------------------------- lead voices
  private lead(t: number, midi: number, len: number, kind: LeadK, vol: number) {
    const dest = this.pan.lead;
    const v = vol * this.vel;
    switch (kind) {
      case "bell": this.bell(t, midi, 0.5 * v, true, dest); return;
      case "box": this.box(t, midi, 0.85 * v, dest, true); return;
      case "kalimba": this.kalimba(t, midi, 0.9 * v, dest, true); return;
      case "pan": this.steelPan(t, midi, 0.9 * v, dest, true); return;
      case "cowbell": this.cowbell(t, midi, 1.1 * v, dest); return;
      case "sitar": this.sitar(t, midi, 1.1 * v, dest, len, true); return;
      case "brass": this.brass(t, [midi], 1.3 * v, dest, len, true); return;
    }
    // sustained synth leads: whistle, flute, square, saw, chip, vox, sax, strings
    const c = this.ctx!, br = this.br, f = mtof(midi);
    const g = this.g(dest); g.connect(this.sendB);
    let into: AudioNode = g;
    if (kind === "square") into = this.f("lowpass", 2600 * br, 1, g);
    else if (kind === "saw" || kind === "strings") into = this.f("lowpass", (kind === "saw" ? 2800 : 2200) * br, 0.8, g);
    else if (kind === "sax") into = this.f("bandpass", 1300 * br, 0.9, g);
    else if (kind === "vox") {
      // "ooh/aah" vocal-ish synth: two formant bands that follow the pitch a little
      const mix = c.createGain();
      mix.connect(this.f("bandpass", Math.max(800, f * 1.1), 4, g)); mix.connect(this.f("bandpass", Math.max(1250, f * 2.05), 5, g));
      into = mix;
    }
    const type: OscillatorType = kind === "whistle" ? "sine" : kind === "flute" ? "triangle" : kind === "square" || kind === "chip" ? "square" : "sawtooth";
    const scoop = kind === "vox" ? 0.89 : kind === "sax" ? 0.97 : kind === "chip" ? 1 : 0.985;
    const o = this.o(type, f * scoop, t, len + 0.1, into);
    if (scoop !== 1) o.frequency.exponentialRampToValueAtTime(f, t + (kind === "vox" ? 0.08 : 0.04));
    let o2: OscillatorNode | null = null;
    if (kind === "saw" || kind === "strings") {
      o2 = this.o("sawtooth", f * scoop, t, len + 0.1, into); o2.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      o.detune.value = -9; o2.detune.value = 9;
    }
    this.vibrato(t, len, kind === "chip" ? 22 : kind === "sax" || kind === "vox" ? 16 : 13, o, o2);
    const peak = (LEADPEAK[kind] ?? 0.1) * v;
    const atk = kind === "strings" ? 0.09 : kind === "sax" ? 0.03 : 0.025;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(atk + 0.01, len * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08);
    if (kind === "whistle") { const ng = this.g(dest); const bp = this.f("bandpass", f * 2, 4, ng); this.n(t, len, bp); this.env(ng, t, 0.02 * v, 0.02, len); }
  }
}
