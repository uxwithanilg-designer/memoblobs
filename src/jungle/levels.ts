// Kiko's Jungle Quest — one continuous run, Subway style: every run starts at Kiko's Treehouse in Banana Grove and the
// places keep coming one after another (no stage numbers, no stage select) until Kiko runs out of hearts. A place
// (stage) is STAGE_M metres with its own name, look and set piece (vine swings, the branch road, bouncy mushrooms,
// lily pads, rope bridges, raft rides…); 20 places make a region, a region gate (white flash) leads into the next one,
// and after the hand-made regions the Wild Forest mixes them forever. The speed climbs in waves (like Momo Dash), the
// difficulty rises with every place, and banana-flag checkpoints catch Kiko when a heart is lost.
import { BRIDGE, GROUND, LILY, RIVER, isBananaOnly, type Chunk } from "./chunks";
import { REGIONS } from "./regions";
import type { FruitId, Item, Ob, ObKind, PowerId, RunSpec, Season, Section, SetPiece, TimeOfDay, Twist, Vine, Weather, Zone } from "./types";

export const LW = 2.2;
export const ROW = 3.2;
/** the branch road's height */
export const BR_H = 2.7;
export const RAMP_LEN = 7;
export const STAGES_PER_REGION = 20;
/** one place of the run, in metres */
export const STAGE_M = 320;
export const SPEED_CAP = 18.5;

export { BOSSES, REGIONS, RIDES, RIDE_T, regionIndex, type RegionDef } from "./regions";
/** the hand-made stages; after them the Wild Forest mixes the regions forever */
export const HAND = STAGES_PER_REGION * REGIONS.length;
/** place 301: Kiko plants the 15 Golden Seeds and the Great Fruit Tree blooms; the Wild Forest starts right after it */
export const FINALE = HAND + 1;

export const FRUITS: Record<FruitId, { name: string; icon: string; color: string }> = {
  mango: { name: "Mango", icon: "🥭", color: "#FFA62B" }, pineapple: { name: "Pineapple", icon: "🍍", color: "#FFD23F" },
  berries: { name: "Berries", icon: "🍇", color: "#6B5BFF" }, melon: { name: "Watermelon", icon: "🍉", color: "#FF5F7E" },
  kiwi: { name: "Kiwi", icon: "🥝", color: "#7CC44A" }, dragon: { name: "Dragon Fruit", icon: "🐉", color: "#FF4FA8" },
};
export const FRUIT_IDS = Object.keys(FRUITS) as FruitId[];
export const POWERS: Record<PowerId, { name: string; icon: string; time: number; color: string }> = {
  magnet: { name: "Banana Magnet", icon: "🧲", time: 10, color: "#FF4D6D" },
  helmet: { name: "Coconut Helmet", icon: "🥥", time: 20, color: "#B9874A" },
  double: { name: "Banana ×2", icon: "✨", time: 12, color: "#FFC21A" },
  glide: { name: "Pico Glide", icon: "🦜", time: 6.5, color: "#3DC8FF" },
};
/** the smoothie meter: this many fruits fill it */
export const METER = 8;
/** pepper rockets and the Smoothie Rush: star power, ×3 for 6 s (the golden pepper ×5 for 9 s, the Rush ×3 for 7.5 s) */
export const boostTime = (x: number, rush = false) => (rush ? 7.5 : x >= 5 ? 9 : 6);
/** how many hearts Kiko can carry: grows as the run goes on */
export const heartMax = (n: number) => (n >= 250 ? 8 : n >= 175 ? 7 : n >= 100 ? 6 : n >= 50 ? 5 : n >= 25 ? 4 : 3);
export const HEART_STEPS = [25, 50, 100, 175, 250];

/** where each forest-floor piece first shows up */
const INTRO: Record<string, number> = { B: 1, J: 1, S: 2, P: 3, C: 4, T: 5, X: 7, _: 9, U: 10, K: 12 };
export const INTRO_TEXT: Record<string, string> = {
  B: "Swipe left or right to dodge!", J: "Swipe UP to jump the logs!", S: "Swipe DOWN to slide under branches!",
  P: "Banana peels! Jump them — or WHEEE!", C: "Things fall from above! Watch for the shadow", T: "Thorny bushes — jump them!",
  X: "Poison mushrooms — don't touch!", _: "Pits! Swipe UP to jump across", U: "Bouncy mushrooms go BOING!", K: "Rolling things! Jump or dodge",
  M: "Mud slows you down — jump over it!", G: "Puddles crackle and spurt — wait for it!", "{": "Wind gusts push you a lane!",
  W: "Spider webs are sticky — slide under them!", I: "Ice! Lane changes are slow and slippery",
};
export const PIECE_TEXT: Partial<Record<SetPiece, string>> = {
  vines: "TAP to grab the vine!", highroad: "Run up the roots to the branch road!", bounce: "Hit a mushroom to fly over!",
  stream: "Hop across the lily pads!", lily: "Hop across the lily pads!", bridge: "Stay on the rope bridge!", raft: "All aboard the raft!",
  peels: "Banana peels everywhere!", coconuts: "Watch out above — look for shadows!", rollers: "Rolling things — jump or dodge!", logs: "Slide under, jump over!",
  zipline: "TAP to grab the zipline handle!", slide: "Wheee — slide down and dodge the rocks!", collapse: "The bridge is falling apart — keep running!",
  stones: "Hop the stones — don't touch the lava!", ride: "Run into the animal to ride it!", chaser: "Something's behind you — RUN!",
  geysers: "Wait for the spurt, then go!", webs: "Slide under the sticky webs!", mud: "Jump over the mud!", gusts: "Hold on — the wind pushes you!",
  ice: "Slippery ice — change lanes early!", kite: "Grab a kite and fly!", pits: "Leaf piles hide holes — jump them!",
};
/** rising inside a region, dipping in the middle; slow growth over all regions */
const WITHIN = [0, 0.08, 0.15, 0.2, 0.28, 0.24, 0.34, 0.4, 0.46, 0.38, 0.3, 0.42, 0.48, 0.55, 0.6, 0.56, 0.66, 0.72, 0.8, 0.7];
export function difficulty(n: number): number {
  const s = (n - 1) % STAGES_PER_REGION;
  if (n > HAND) return 0.45 + 0.25 * WITHIN[s] + 0.12 * Math.log2(1 + (n - HAND) / 40);
  const r = Math.floor((n - 1) / STAGES_PER_REGION);
  return Math.max(0, 0.06 + 0.07 * r + 0.25 * WITHIN[s]);
}

// ------------------------------------------------------------------ seeded random
export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashN = (n: number, k = 0) => { let h = Math.imul(n * 374761393 + k * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------ the run schedule
const TODS: TimeOfDay[] = ["morning", "day", "day", "sunset", "night"];
const CHASE_AT = new Set([19, 20]);
/** the forest-floor pieces of place n: the basics by place, plus this region's own hazards and the two before it */
export function allowFor(n: number) {
  const r = Math.floor((n - 1) / STAGES_PER_REGION);
  const extra = [r, r - 1, r - 2].map((k) => REGIONS[k]?.haz ?? "").join("");
  return Object.entries(INTRO).filter(([, at]) => n >= at).map(([k]) => k).join("") + extra;
}
/** the forest-floor piece that arrives at this place (the HUD gives a hint) */
export const newPiece = (n: number) => (n > HAND ? undefined : Object.entries(INTRO).find(([, at]) => at === n)?.[0]);
const PIECE_CHAR: Partial<Record<SetPiece, string>> = { peels: "P", coconuts: "C", rollers: "K", logs: "S", bounce: "U", geysers: "G", webs: "W", mud: "M", gusts: "{", ice: "I", pits: "_" };

const secCache = new Map<number, Section>();

// ------------------------------------------------------------------ the Wild Forest grows new places every day
const SEASONS: Record<Season, { weather: Weather[]; adj: string[] }> = {
  spring: { weather: ["petals", "butterflies", "none", "leaves"], adj: ["Blooming", "Springtime", "Sunny", "Budding"] },
  monsoon: { weather: ["rain", "storm", "mist", "rain"], adj: ["Rainy", "Stormy", "Misty", "Soggy"] },
  autumn: { weather: ["leaves", "wind", "none", "leaves"], adj: ["Golden", "Windy", "Rusty", "Crunchy"] },
  winter: { weather: ["snow", "mist", "snow", "none"], adj: ["Frozen", "Frosty", "Snowy", "Chilly"] },
};
const SEASON_IDS = Object.keys(SEASONS) as Season[];
const TWISTS: Twist[] = ["night", "fog", "turbo", "fruitRain", "goldRush"];
export const TWIST_TEXT: Record<Twist, string> = {
  night: "🌙 Night run!", fog: "🌫️ Foggy place — look ahead!", turbo: "⚡ Turbo place — everything is faster!",
  fruitRain: "🍓 Fruit rain!", goldRush: "⭐ Gold rush — 3 Golden Bananas here!",
};
/** today's Wild Forest (seed = day number) and the blends seen on earlier days, kept rare (the freshness memory) */
const WILD = { seed: 0, avoid: new Set<string>() };
const blendCache = new Map<number, { a: number; b: number; season: Season }>();
const hw = (n: number, k: number) => hashN(n, k + WILD.seed * 31);
/** the day number the Wild Forest grows from (one new forest per local day) */
export const wildDay = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
export function setWildForest(seed: number, avoid: string[] = []) {
  const key = [...avoid].sort().join(",");
  if (seed === WILD.seed && key === [...WILD.avoid].sort().join(",")) return;
  WILD.seed = seed; WILD.avoid = new Set(avoid); blendCache.clear();
  for (const n of [...secCache.keys()]) if (n > HAND) secCache.delete(n);
}
/** the c-th Wild Forest region: the look of one region, the hazards of another, a season — never the blend just before it,
 * and blends seen on the last few days only when nothing fresh is left */
function wildBlend(c: number) {
  const hit = blendCache.get(c);
  if (hit) return hit;
  const nr = REGIONS.length, prevA = c > 0 ? wildBlend(c - 1).a : -1;
  let pick = { a: 0, b: 1 };
  for (let t = 0; t < 12; t++) {
    const a = Math.floor(hw(c, 101 + t * 7) * nr);
    let b = Math.floor(hw(c, 103 + t * 7) * (nr - 1)); if (b >= a) b++;
    pick = { a, b };
    if (a !== prevA && !WILD.avoid.has(`${REGIONS[a].id}-${REGIONS[b].id}`)) break;
  }
  const out = { ...pick, season: SEASON_IDS[Math.floor(hw(c, 21) * SEASON_IDS.length)] };
  blendCache.set(c, out);
  return out;
}
/** what place n of the run looks like */
export function sectionOf(n: number): Section {
  const hit = secCache.get(n);
  if (hit) return hit;
  const s = ((n - 1) % STAGES_PER_REGION) + 1, d = difficulty(n);
  let sec: Section;
  if (n === FINALE) {
    // the finale: back home under the Great Fruit Tree — no hazards, a fruit rain, the seeds go in the ground
    const R = REGIONS[0];
    sec = {
      n, s, r: 0, region: R.id, scene: R.id, remix: false, place: "The Great Fruit Tree", emoji: "🌳", d: 0.05, tod: "day", weather: "fruitrain", piece: "none",
      fruit: "mango", music: R.id, tune: R.tune, allow: "", chase: false, villain: R.villain, boss: R.boss, finale: true,
    };
  } else if (n > HAND) {
    // the Wild Forest: every day the tree grows new places — two regions blended (the look of one, the hazards of both),
    // a season, any time and weather, and now and then a twist
    const c = Math.floor((n - HAND - 1) / STAGES_PER_REGION);
    const { a, b, season } = wildBlend(c), A = REGIONS[a], B = REGIONS[b], SE = SEASONS[season];
    const pool = [...new Set([...A.pool, ...B.pool])];
    let piece = pool[Math.floor(hw(n, 5) * pool.length)];
    if (s === 1) piece = "none";
    else {
      // a set piece never repeats within three places
      const near = [n - 1, n - 2].filter((k) => k > FINALE).map((k) => sectionOf(k).piece);
      for (let t = 0; t < pool.length && near.includes(piece); t++) piece = pool[(pool.indexOf(piece) + 1) % pool.length];
    }
    const chase = CHASE_AT.has(s);
    const twist: Twist | undefined = s > 2 && !chase && hw(n, 31) < 0.3 ? TWISTS[Math.floor(hw(n, 33) * TWISTS.length)] : undefined;
    let tod: TimeOfDay = A.id === "caves" ? "cave" : s >= 19 ? "night" : TODS[Math.floor(hw(n, 7) * TODS.length)];
    let weather: Weather = A.id === "snow" ? "snow" : A.id === "volcano" ? "ash" : tod === "night" || tod === "cave" ? "fireflies" : SE.weather[Math.floor(hw(n, 9) * SE.weather.length)];
    if (twist === "night" && tod !== "cave") { tod = "night"; weather = "fireflies"; }
    if (twist === "fog") { tod = tod === "night" || tod === "cave" ? tod : "morning"; weather = "mist"; }
    if (twist === "fruitRain") weather = "fruitrain";
    // a name made of the season or the second region's words and a place of the first — never one met in the last few places
    const near = new Set([1, 2, 3, 4, 5].map((k) => n - k).filter((k) => k > FINALE && Math.floor((k - HAND - 1) / STAGES_PER_REGION) === c).map((k) => sectionOf(k).place));
    let name = "";
    for (let t = 0; t < 8 && (!name || near.has(name)); t++) {
      const adj = hw(n, 11 + t * 3) < 0.45 ? SE.adj[Math.floor(hw(n, 12 + t * 3) * SE.adj.length)] : B.adj[Math.floor(hw(n, 13 + t * 3) * B.adj.length)];
      name = `${adj} ${A.noun[Math.floor(hw(n, 14 + t * 3) * A.noun.length)]}`;
    }
    sec = {
      n, s, r: a, region: A.id, scene: A.id, remix: true, place: name, emoji: `${A.emoji}${B.emoji}`, d, tod, weather, piece,
      fruit: FRUIT_IDS[Math.floor(hw(n, 17) * FRUIT_IDS.length)], music: s <= 10 ? A.id : B.id, tune: s <= 10 ? A.tune : B.tune,
      allow: "BJSPCTX_UK" + A.haz + B.haz + (PIECE_CHAR[piece] ?? ""), chase, villain: (s <= 10 ? A : B).villain, boss: (s <= 10 ? A : B).boss,
      ride: A.ride ?? B.ride, season, twist, blend: `${A.id}-${B.id}`,
    };
  } else {
    const r = Math.floor((n - 1) / STAGES_PER_REGION), R = REGIONS[r], [place, piece, tod, weather] = R.places[s - 1];
    const ch = PIECE_CHAR[piece] ?? "";
    sec = {
      n, s, r, region: R.id, scene: R.id, remix: false, place, emoji: R.emoji, d, tod: tod ?? R.tod, weather: weather ?? R.weather, piece,
      fruit: R.fruits[(s - 1) % R.fruits.length], music: R.id, tune: R.tune, allow: allowFor(n) + ch, chase: CHASE_AT.has(s), villain: R.villain, boss: R.boss,
      ride: R.ride,
    };
  }
  secCache.set(n, sec);
  return sec;
}
/** speed in waves: up through each half of a region toward the limit, back to normal in the middle and at each new region */
export function speedOf(n: number, frac: number): number {
  const r = Math.min(14, Math.floor((n - 1) / STAGES_PER_REGION)), s = ((n - 1) % STAGES_PER_REGION) + frac;
  const vN = Math.min(15.5, 11.5 + 0.45 * r), vC = Math.min(SPEED_CAP, vN + 3);
  const wave = s < 10 ? s / 10 : s < 11 ? 1 - (s - 10) * 0.7 : 0.3 + 0.7 * (s - 11) / 9;
  const v = vN + (vC - vN) * Math.max(0, Math.min(1, wave));
  return n > HAND && sectionOf(n).twist === "turbo" ? v * 1.12 : n === FINALE ? Math.min(v, 13) : v;
}
export function dailyKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
/** the Daily Jungle Hunt: today's run starts in a different region (the same for everyone) */
export function dailyRun(key: string): RunSpec {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { seed: h, start: 1 + STAGES_PER_REGION * (h % REGIONS.length) + (h % 3), daily: key };
}
/** the Daily Jungle Hunt's goal: eat this many of the fruit the day's first place grows */
export function dailyGoal(key: string): { fruit: FruitId; count: number } {
  return { fruit: sectionOf(dailyRun(key).start).fruit, count: DAILY_FRUITS };
}
export const DAILY_FRUITS = 8;

// ------------------------------------------------------------------ the track
const KIND: Record<string, ObKind> = {
  J: "log", T: "thorn", X: "shroom", S: "low", B: "rock", K: "roller", C: "coco", P: "peel", _: "gap", U: "bounce", r: "rock", L: "flog", g: "croc",
  W: "web", G: "geyser", "{": "gust", "}": "gust",
};
/** long pieces: consecutive cells in a lane make one piece */
const RUNS: Record<string, ObKind> = { M: "mud", I: "ice" };
const LEN: Partial<Record<ObKind, number>> = { log: 0.7, thorn: 0.9, shroom: 0.8, low: 0.6, rock: 2.0, roller: 1.3, coco: 0.7, peel: 0.8, bounce: 1.6, flog: 0.9, croc: 2.4, web: 0.5, geyser: 1.6 };
const MIRROR: Record<string, string> = { "{": "}", "}": "{" };
const variants = (list: Chunk[]) => list.flatMap((c) => {
  const m = c.rows.map((r) => r.split("").reverse().map((ch) => MIRROR[ch] ?? ch).join(""));
  return m.join("/") === c.rows.join("/") ? [{ c, rows: c.rows }] : [{ c, rows: c.rows }, { c, rows: m }];
});
const V_GROUND = variants(GROUND), V_RIVER = variants(RIVER), V_LILY = variants(LILY), V_BRIDGE = variants(BRIDGE);
const PIECE = /[BJSTXKCP_UWMGI{}]/;
/** about how long each set piece is (it is skipped when it would run into a region gate) */
const EST: Partial<Record<SetPiece, number>> = { vines: 70, bounce: 80, stream: 45, lily: 110, bridge: 75, raft: 100, highroad: 50, zipline: 70, slide: 100, collapse: 80, stones: 110, ride: 40, kite: 90 };
const ALLOW_OF: Record<string, string> = { "}": "{" };
const allowed = (ch: string, allow: string) => !PIECE.test(ch) || allow.includes(ALLOW_OF[ch] ?? ch);

export interface Chase { id: number; z0: number; z1: number; n: number; villain: string; boss: string; region: string }
/** something rolling or flying along behind Kiko (a boulder, an avalanche, bees, a stampede…) */
export interface Chaser { z0: number; z1: number; what: string }
const CHASER_OF: Record<string, string> = { blossom: "bees", caves: "bats", plains: "stampede", snow: "avalanche", volcano: "boulder" };
/** regions where the ground is wet (bridges cross water there, a ravine elsewhere) and what slides are made of */
const WET = new Set(["river", "marsh", "mangrove", "falls", "bamboo"]);
const SLIDE_OF: Record<string, "water" | "mud" | "snow"> = { snow: "snow", marsh: "mud", mushroom: "mud", canopy: "mud", autumn: "mud", mangrove: "mud" };
interface Reserve { lane: number; z0: number; z1: number; clear: boolean }

export class Track {
  obs: Ob[] = []; items: Item[] = []; zones: Zone[] = []; vines: Vine[] = [];
  /** banana-flag checkpoints (track metres, sorted) */
  flags: number[] = [];
  lineCount = 0; lineLen = new Map<number, number>();
  /** chunk ids used this run (for the freshness memory) */
  used: string[] = [];
  /** where each new region starts (the first entry is the run's start) */
  regions: { z: number; n: number }[] = [];
  chases: Chase[] = [];
  chasers: Chaser[] = [];
  readonly spec: RunSpec;
  private r: Rng; private z = 26; private id = 1; private recent: string[] = []; private far: Set<string>;
  private nextPower: number; private nextBoost: number; private nextHeart: number; private nextFlag = 150; private nextRotten = 400; private nextRide = 500;
  private done = new Set<string>();
  private plan: { z: number; piece: SetPiece; done?: boolean }[] = [];
  private reserve: Reserve[] = [];
  private bias: { ch: string; until: number } | null = null;
  private gold = new Map<number, number>();
  private huntFruit: FruitId | null = null;

  constructor(spec: RunSpec) {
    this.spec = spec; this.r = rng(spec.seed);
    this.huntFruit = spec.daily ? sectionOf(spec.start).fruit : null;
    this.far = new Set(spec.recent ?? []);
    this.nextPower = 160 + this.r() * 80; this.nextBoost = 700 + this.r() * 250; this.nextHeart = (spec.help ? 900 : 1300) + this.r() * 400;
    this.regions.push({ z: 0, n: spec.start });
    this.flags.push(2);
    this.fill(420); this.makeLines(0); this.sort();
  }
  stageAt(z: number) { return this.spec.start + Math.floor(Math.max(0, z) / STAGE_M); }
  stageZ(n: number) { return (n - this.spec.start) * STAGE_M; }
  section(z: number) { return sectionOf(this.stageAt(z)); }
  speedAt(z: number) {
    const n = this.stageAt(z);
    return speedOf(n, (Math.max(0, z) % STAGE_M) / STAGE_M) * (this.spec.help ? 0.93 : 1);
  }
  dAt(z: number) { return this.section(z).d * (this.spec.help ? 0.78 : 1); }
  /** the zone (chasm or river) at z, if any */
  zoneAt(z: number): Zone | null {
    for (const zn of this.zones) { if (zn.z0 > z) break; if (z < zn.z1) return zn; }
    return null;
  }
  /** keep the track built ahead of Kiko, and forget what is far behind (checkpoints are never more than ~200 m back) */
  extend(kikoZ: number) {
    if (this.z < kikoZ + 320) {
      const from = this.items.length;
      this.fill(kikoZ + 420);
      this.makeLines(from);
      this.sort();
    }
    const cut = kikoZ - 260;
    let i = 0; while (i < this.obs.length && this.obs[i].z + this.obs[i].len < cut) i++;
    if (i > 80) this.obs.splice(0, i);
    let j = 0; while (j < this.items.length && this.items[j].z < cut) j++;
    if (j > 160) this.items.splice(0, j);
    while (this.zones.length > 8 && this.zones[0].z1 < cut) this.zones.shift();
    while (this.vines.length > 12 && this.vines[0].z < cut) this.vines.shift();
    while (this.chasers.length > 4 && this.chasers[0].z1 < cut) this.chasers.shift();
    while (this.flags.length > 12 && this.flags[1] < cut) this.flags.shift();
    this.reserve = this.reserve.filter((rv) => rv.z1 > kikoZ - 20);
  }

  // ---------------------------------------------------------------- building
  private fill(until: number) {
    while (this.z < until) {
      const n = this.stageAt(this.z), sec = sectionOf(n);
      // a new region: a clear runway through the region gate (the renderer swaps the forest behind a white flash)
      const nextR = n + (STAGES_PER_REGION - sec.s) + 1, zb = this.stageZ(nextR);
      if (this.z > zb - 44) {
        if (this.regions[this.regions.length - 1].n !== nextR) this.regions.push({ z: zb, n: nextR });
        this.z = zb + 40;
        this.flag(zb + 30);
        continue;
      }
      if (!this.done.has(`st-${n}`)) { this.done.add(`st-${n}`); this.planStage(sec); }
      const next = this.plan.find((p) => !p.done);
      if (next && this.z >= next.z) {
        next.done = true;
        const room = zb - 60 - this.z;
        if (room >= (EST[next.piece] ?? 0)) {
          if (next.piece !== "highroad") this.flag(this.z + 2);
          this.z += 16;
          this.setPiece(next.piece, sec, zb - 50);
          continue;
        }
      }
      const d = this.dAt(this.z);
      const warm = this.z < 70 || sec.s === 1;
      const tierMax = Math.max(1, Math.min(5, 1 + Math.floor(d * 6 + 0.6) - (warm ? 1 : 0)));
      const target = Math.min(tierMax, 1 + d * 5 + (sec.s > 15 ? 0.4 : 0));
      const breather = sec.s === 11 && (this.z - this.stageZ(n)) < 40;
      this.chunkAt(sec, tierMax, target, this.z < 50 || breather, breather);
    }
  }
  /** each place gets its main set piece at about a third of the way in; later places add a second one */
  private planStage(sec: Section) {
    const z0 = this.stageZ(sec.n);
    if (sec.n !== this.spec.start && sec.s !== 1) this.flag(z0 + 4);
    this.plan = this.plan.filter((p) => !p.done);
    if (sec.piece !== "none") this.plan.push({ z: z0 + STAGE_M * 0.28, piece: sec.piece });
    const R = REGIONS[sec.r];
    if (sec.d >= 0.28 && sec.s !== 1 && !sec.chase) {
      const pool = R.pool.filter((p) => p !== sec.piece && (sec.remix || this.pieceOk(p, sec.n)));
      if (pool.length) this.plan.push({ z: z0 + STAGE_M * 0.68, piece: pool[Math.floor(this.r() * pool.length)] });
    }
  }
  /** a set piece only after the place that introduces it (so a kid meets each one first in its own place) */
  private pieceOk(p: SetPiece, n: number) {
    const s0 = Math.floor((n - 1) / STAGES_PER_REGION) * STAGES_PER_REGION;
    for (let k = 1; k <= STAGES_PER_REGION; k++) {
      if (sectionOf(s0 + k).piece === p) return s0 + k < n;
    }
    return n > STAGES_PER_REGION;
  }
  private flag(z: number) {
    if (this.flags.length && Math.abs(this.flags[this.flags.length - 1] - z) < 30) return;
    for (const zn of this.zones) if (z > zn.z0 - 6 && z < zn.z1 + 2) return;
    this.flags.push(z); this.flags.sort((a, b) => a - b);
    this.nextFlag = z + 150;
  }
  private chunkAt(sec: Section, tierMax: number, target: number, easy: boolean, breather = false) {
    const d = this.dAt(this.z);
    const stretch = (1.3 - 0.36 * Math.min(1, d)) * (this.spec.help ? 1.1 : 1);
    const rowLen = ROW * stretch;
    const ch = this.pick(V_GROUND, sec, tierMax, target, easy);
    const end = this.place(sec, ch.rows, this.z, rowLen);
    const speed = this.speedAt(this.z);
    const gap = Math.max(rowLen * 1.15, speed * (0.55 - 0.12 * Math.min(1, d))) + (breather ? 8 : 0) + (this.spec.help ? 2 : 0);
    // a few bananas in the gap after the chunk (later places have busier chunks, so there are more of these)
    if (this.r() < 0.35 + 0.4 * Math.min(1, d)) {
      const l = Math.floor(this.r() * 3) - 1;
      if (!this.blocked(l, end, end + gap, "o")) for (let q = 1; q < 5 && q * 1.6 < gap - 1; q++) this.banana(l, end + q * 1.6, 0.8);
    }
    this.specials(sec, end, gap);
    this.z = end + gap;
  }
  private pick(list: { c: Chunk; rows: string[] }[], sec: Section, tierMax: number, target: number, easy: boolean) {
    const fresh = newPiece(sec.n), allow = sec.allow, bias = this.bias && this.z < this.bias.until ? this.bias.ch : "";
    const ok = list.filter(({ c }) => {
      const all = c.rows.join("");
      if (![...all].every((ch) => allowed(ch, allow))) return false;
      if (easy) return c.tier === 1;
      return c.tier <= tierMax;
    });
    const pool = ok.length ? ok : list.filter(({ c }) => c.tier === 1 && [...c.rows.join("")].every((ch) => allowed(ch, allow)));
    const use = pool.length ? pool : list.slice(0, 1);
    let sum = 0;
    const ws = use.map((v) => {
      const s = v.c.rows.join(""), dt = v.c.tier - target;
      let w = Math.exp(-(dt * dt) / 1.4) * (this.recent.includes(v.c.id) ? 0.12 : 1) * (this.far.has(v.c.id) ? 0.45 : 1) * (isBananaOnly(v.c) && !easy ? 0.3 : 1);
      if (fresh && s.includes(fresh)) w *= 2.6;
      if (bias && s.includes(bias)) w *= 6;
      sum += w; return w;
    });
    let x = this.r() * sum, k = 0;
    while (k < use.length - 1 && (x -= ws[k]) > 0) k++;
    const v = use[k];
    this.recent.push(v.c.id); if (this.recent.length > 6) this.recent.shift();
    this.used.push(v.c.id);
    return v;
  }
  private blocked(lane: number, z0: number, z1: number, ch: string) {
    for (const rv of this.reserve) {
      if (rv.lane !== lane || z1 < rv.z0 || z0 > rv.z1) continue;
      if (rv.clear) return true;
      if (ch === "S" || ch === "U") return true;
    }
    return false;
  }
  private ob(o: Omit<Ob, "id">) { const x = { ...o, id: this.id++ }; this.obs.push(x); return x; }

  /** put one chunk of forest floor (or river, for raft rides) on the track at z; returns where it ends */
  private place(sec: Section, rows: string[], z0: number, rowLen: number, wet?: "water" | "mud" | "snow") {
    const river = !!wet;
    const n = rows.length, r = this.r, y0 = river ? 0.25 : 0;
    const cell = (row: number, lane: number) => (row >= 0 && row < n ? rows[row][lane + 1] : ".");
    for (let lane = -1; lane <= 1; lane++) {
      let laneHasObs = false;
      for (let i = 0; i < n; i++) if (/[BJSTXKCP_UrLgWMGI]/.test(cell(i, lane))) laneHasObs = true;
      for (let i = 0; i < n; i++) {
        const ch = cell(i, lane), rz = z0 + i * rowLen;
        const run = RUNS[ch];
        if (run) {
          if (cell(i - 1, lane) === ch) continue;
          let k = i; while (cell(k, lane) === ch) k++;
          if (!river && this.blocked(lane, rz - 1, z0 + k * rowLen + 1, "J")) continue;
          this.ob({ kind: run, lane, z: rz + 0.2, len: (k - i) * rowLen - 0.4, y: 0, k: 0 });
          continue;
        }
        if (ch === "{" || ch === "}") { this.ob({ kind: "gust", lane, z: rz, len: rowLen * 0.6, y: 0, k: 0, dir: ch === "{" ? -1 : 1 }); continue; }
        if (ch === "o") {
          const fruitP = sec.finale ? 0.45 : sec.twist === "fruitRain" ? 0.32 : this.huntFruit ? 0.1 : 0.06;
          for (const f of [0.25, 0.75]) {
            if (r() < fruitP) this.fruit(sec, lane, rz + rowLen * f, y0 + 0.9);
            else this.banana(lane, rz + rowLen * f, y0 + 0.8);
          }
        } else if (ch === "F") this.fruit(sec, lane, rz + rowLen / 2, y0 + 0.9);
        else if (KIND[ch]) {
          const kind: ObKind = ch === "g" && wet !== "water" ? "roller" : KIND[ch];
          const len = kind === "gap" ? rowLen * 0.72 : LEN[kind] ?? 1;
          const oz = rz + (rowLen - len) / 2;
          if (!river && this.blocked(lane, oz - 1, oz + len + 1, ch)) continue;
          const speed = this.speedAt(rz), dd = this.dAt(rz);
          const k = kind === "roller" ? (2.0 + 3.0 * dd) / speed : kind === "croc" ? (1.2 + 2.0 * dd) / speed : 0;
          const v = river && (kind === "rock" || kind === "low") ? 1 : kind === "rock" ? (r() < 0.6 ? 0 : 2) : kind === "low" ? (sec.n > 6 && r() < 0.35 ? 2 : 0) : Math.floor(r() * 3);
          this.ob({ kind, lane, z: oz, len, y: 0, k, v, ph: kind === "geyser" ? Math.floor(r() * 8) * 0.3 : undefined });
          if ((kind === "log" || kind === "gap" || kind === "thorn" || kind === "flog") && (cell(i - 1, lane) === "o" || cell(i + 1, lane) === "o")) {
            for (const [dz, y] of [[-1.3, 1.6], [0, 2.2], [1.3, 1.6]] as const) this.banana(lane, rz + rowLen / 2 + dz, y0 + y);
          }
          if (kind === "bounce") this.arc(lane, oz + 0.8, 7, this.speedAt(oz));
        }
      }
      if (!laneHasObs && !rows.some((row) => row[lane + 1] === "o") && r() < 0.35 + 0.3 * Math.min(1, this.dAt(z0)) && !this.blocked(lane, z0, z0 + n * rowLen, "o")) {
        for (let i = 1; i < n; i++) { this.banana(lane, z0 + i * rowLen, y0 + 0.8); this.banana(lane, z0 + (i + 0.5) * rowLen, y0 + 0.8); }
      }
    }
    return z0 + n * rowLen;
  }
  private banana(lane: number, z: number, y: number) { this.items.push({ id: this.id++, kind: "banana", lane, z, y }); }
  private fruit(sec: Section, lane: number, z: number, y: number) {
    const R = REGIONS[sec.r];
    // on the Daily Jungle Hunt, today's fruit turns up much more often
    const f = this.huntFruit && this.r() < 0.6 ? this.huntFruit : this.r() < 0.45 ? sec.fruit : R.fruits[Math.floor(this.r() * R.fruits.length)];
    this.items.push({ id: this.id++, kind: "fruit", lane, z, y, fruit: f });
  }
  private put(kind: Item["kind"], lane: number, z: number, y: number, extra: Partial<Item> = {}) {
    this.items.push({ id: this.id++, kind, lane, z, y, ...extra });
  }
  /** bananas along a jump arc (bounces, vine swings), from the take-off point */
  private arc(lane: number, z0: number, n: number, speed: number, v0 = 15, y0 = 0.35) {
    for (let i = 1; i <= n; i++) {
      const t = i * 0.13;
      const y = y0 + v0 * t - 14 * t * t;
      if (y < 0.5) break;
      this.banana(lane, z0 + speed * t, y + 0.6);
    }
  }

  // ---------------------------------------------------------------- set pieces
  private setPiece(p: SetPiece, sec: Section, limit: number) {
    const d = this.dAt(this.z), speed = this.speedAt(this.z);
    switch (p) {
      case "vines": return this.vinesPiece(sec, d, speed);
      case "highroad": return this.highroad(sec, d, limit);
      case "bounce": return this.bouncePiece(sec, d, speed);
      case "stream": return this.waterPiece(sec, V_LILY, d, 1, "water", true);
      case "lily": return this.waterPiece(sec, V_LILY, d, d < 0.2 ? 2 : 3, "water", true);
      case "bridge": return this.waterPiece(sec, V_BRIDGE, d, d < 0.25 ? 1 : 2, WET.has(sec.scene) ? "water" : "chasm", false);
      case "collapse": return this.waterPiece(sec, V_BRIDGE, d, 2, WET.has(sec.scene) ? "water" : "chasm", false, 9);
      case "stones": return this.waterPiece(sec, V_LILY, d, d < 0.5 ? 2 : 3, "lava", true, 2);
      case "raft": return this.raftPiece(sec, d, limit);
      case "slide": return this.raftPiece(sec, d, limit, SLIDE_OF[sec.scene] ?? "water");
      case "zipline": return this.ziplinePiece(sec, d, speed);
      case "kite": return this.kitePiece(sec, speed);
      case "ride": {
        const ride = sec.ride ?? "turtle";
        for (let l = -1; l <= 1; l++) this.put("ride", l, this.z + 6, 0.2, { ride });
        this.z += 12;
        return;
      }
      case "chaser": {
        this.chasers.push({ z0: this.z - 6, z1: this.z + 150 + d * 60, what: CHASER_OF[sec.scene] ?? "boulder" });
        return;
      }
      default: {
        const ch = PIECE_CHAR[p];
        if (ch) this.bias = { ch, until: this.z + 150 };
      }
    }
  }
  /** a chasm with vines: tap (or jump into one) to swing across; later ones chain, each vine in a different lane */
  private vinesPiece(sec: Section, d: number, speed: number) {
    const count = d < 0.2 ? 1 : d < 0.45 ? 2 : 3;
    const L = Math.max(12, Math.min(18, speed * 1.0));
    const z0 = this.z + 4;
    this.zones.push({ id: this.id++, kind: "chasm", z0, z1: z0 + count * L });
    let lane = Math.floor(this.r() * 3) - 1;
    for (let i = 0; i < count; i++) {
      const vz = z0 - 1.5 + i * L, last = i === count - 1;
      const lanes = i === 0 && d < 0.15 ? [-1, 0, 1] : i === 0 && d < 0.3 ? [lane, lane === 0 ? 1 : 0] : [lane];
      for (const l of lanes) {
        this.vines.push({ id: this.id++, lane: l, z: vz, len: last ? L + 4.5 : L - 0.6, toY: 0 });
        // bananas along the swing
        for (let k = 1; k < 8; k++) { const f = k / 8; this.banana(l, vz + f * (last ? L + 4 : L), 1.4 + Math.sin(Math.PI * f) * 2.2); }
      }
      if (!this.gold.get(sec.n) && (last || this.r() < 0.4)) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", lane, vz + L * 0.5, 4.0); }
      const nl = lane + (this.r() < 0.5 ? -1 : 1);
      lane = nl < -1 ? 1 : nl > 1 ? -1 : nl;
    }
    this.z = z0 + count * L + 8;
  }
  /** the branch road: a root ramp (or a bouncy mushroom) takes Kiko up; snakes and bee hives up there, but more bananas */
  private highroad(sec: Section, d: number, limit: number) {
    const lane = Math.floor(this.r() * 3) - 1;
    const z0 = this.z + 6;
    const viaBounce = d > 0.25 && this.r() < 0.4;
    this.reserve.push({ lane, z0: z0 - 16, z1: z0 + RAMP_LEN + 1, clear: true });
    let zb: number;
    if (viaBounce) { this.ob({ kind: "bounce", lane, z: z0, len: 1.6, y: 0, k: 0 }); zb = z0 + 3; }
    else { this.ob({ kind: "ramp", lane, z: z0, len: RAMP_LEN, y: 0, k: 0 }); zb = z0 + RAMP_LEN; }
    const nextPlan = this.plan.find((p) => !p.done)?.z ?? Infinity;
    const H = Math.max(40, Math.min(60 + d * 90, Math.min(limit, nextPlan) - zb - 20));
    const ze = zb + H;
    // the branch: one lane, or a switch to the next lane halfway (5 m overlap), or a gap in the branch to jump
    const segs: [number, number, number][] = [];
    const sw = d > 0.2 && this.r() < 0.5, gapIn = !sw && d > 0.35 && this.r() < 0.5;
    const zm = zb + H * (0.4 + this.r() * 0.2);
    const lane2 = sw ? (lane === 0 ? (this.r() < 0.5 ? -1 : 1) : 0) : lane;
    if (sw) { segs.push([lane, zb, zm + 5]); segs.push([lane2, zm, ze]); }
    else if (gapIn) { segs.push([lane, zb, zm]); segs.push([lane, zm + 3.4, ze]); }
    else segs.push([lane, zb, ze]);
    for (const [l, a, b] of segs) {
      for (let s = a; s < b - 0.01; s += 18) this.ob({ kind: "branch", lane: l, z: s, len: Math.min(18, b - s), y: 0, k: 0 });
      this.reserve.push({ lane: l, z0: a, z1: b, clear: false });
    }
    this.reserve.push({ lane: lane2, z0: ze - 2, z1: ze + 12, clear: true });
    // hazards and goodies up top
    const gapEvery = Math.max(12, 22 - d * 12);
    let haz = 0;
    for (let z = zb + 12; z < ze - 8; z += gapEvery * (0.85 + this.r() * 0.3)) {
      const l = sw && z > zm + 2 ? lane2 : lane;
      if (gapIn && z > zm - 4 && z < zm + 7) continue;
      if (sw && z > zm - 3 && z < zm + 8) continue;
      const kind: ObKind = this.r() < 0.55 ? "snake" : "hive";
      this.ob({ kind, lane: l, z, len: kind === "snake" ? 0.9 : 0.6, y: BR_H, k: 0 });
      haz++;
      if (kind === "snake") for (const [dz, y] of [[-1.3, 1.6], [0, 2.2], [1.3, 1.6]] as const) this.banana(l, z + dz, BR_H + y);
    }
    for (let z = zb + 2; z < ze - 1; z += 1.6) {
      const l = sw && z > zm + 2.5 ? lane2 : lane;
      if (gapIn && z > zm - 1 && z < zm + 4) continue;
      let clear = true;
      for (let i = this.obs.length - 1; i >= 0 && i > this.obs.length - haz - 12; i--) { const o = this.obs[i]; if (o.y === BR_H && o.lane === l && Math.abs(o.z - z) < 2.4) clear = false; }
      if (!clear) continue;
      if (this.r() < 0.05) this.fruit(sec, l, z, BR_H + 0.9); else this.banana(l, z, BR_H + 0.8);
    }
    if (!this.gold.get(sec.n)) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", lane2, ze - 4, BR_H + 1.0); }
    if (this.r() < 0.2) this.put("heart", lane, zb + H * 0.3, BR_H + 1.0);
    this.z = z0 + (viaBounce ? 4 : RAMP_LEN + 2);
  }
  /** bouncy mushrooms at the edge of a chasm: BOING over it (1–3 in a row) */
  private bouncePiece(sec: Section, d: number, speed: number) {
    const count = d < 0.2 ? 1 : d < 0.45 ? 2 : 3;
    let z = this.z + 4;
    for (let i = 0; i < count; i++) {
      const L = Math.max(9, Math.min(15, speed * 0.78));
      const lanes = d < 0.25 ? [-1, 0, 1] : [-1, 0, 1].filter(() => this.r() < 0.67);
      if (!lanes.length) lanes.push(0);
      for (let l = -1; l <= 1; l++) {
        if (lanes.includes(l)) { this.ob({ kind: "bounce", lane: l, z, len: 1.6, y: 0, k: 0 }); this.arc(l, z + 0.8, 8, speed); }
        else this.ob({ kind: "gap", lane: l, z: z - 0.2, len: 2.0, y: 0, k: 0 });
      }
      this.zones.push({ id: this.id++, kind: "chasm", z0: z + 1.8, z1: z + 1.8 + L });
      if (!this.gold.get(sec.n) && (i === count - 1 || this.r() < 0.4)) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", lanes[0], z + 0.8 + speed * 0.54, 5.0); }
      z += 1.8 + L + 7;
    }
    this.z = z + 2;
  }
  /** ziplines over a long gorge: tap to grab the handle and zip across (later only one lane has a zipline) */
  private ziplinePiece(sec: Section, d: number, speed: number) {
    const L = Math.max(26, Math.min(44, speed * 2.4));
    const z0 = this.z + 4;
    this.zones.push({ id: this.id++, kind: "chasm", z0, z1: z0 + L });
    const lane = Math.floor(this.r() * 3) - 1;
    const lanes = d < 0.3 ? [-1, 0, 1] : d < 0.6 ? [lane, lane === 0 ? 1 : 0] : [lane];
    for (const l of lanes) {
      this.vines.push({ id: this.id++, lane: l, z: z0 - 1.5, len: L + 4.5, toY: 0, zip: true });
      for (let k = 1; k < 13; k++) { const f = k / 13; this.banana(l, z0 - 1.5 + f * (L + 4), 2.4 - 2.0 * f - 0.5 * Math.sin(Math.PI * f) + 0.9); }
    }
    if (!this.gold.get(sec.n)) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", lanes[0], z0 + L * 0.5, 2.2); }
    this.z = z0 + L + 8;
  }
  /** kites on the wind: grab one (in every lane) and fly over a long ravine */
  private kitePiece(sec: Section, speed: number) {
    const z0 = this.z + 4;
    for (let l = -1; l <= 1; l++) this.put("power", l, z0, 1.1, { power: "glide", boost: 1 });
    const L = Math.max(44, Math.min(70, speed * 3.6));
    this.zones.push({ id: this.id++, kind: "chasm", z0: z0 + 12, z1: z0 + 12 + L });
    this.z = z0 + 12 + L + 10;
    void sec;
  }
  /** a river (or a ravine, or lava) crossed on lily pads, stones or a rope bridge (v = 9: it falls apart behind you) */
  private waterPiece(sec: Section, list: { c: Chunk; rows: string[] }[], d: number, count: number, kind: "chasm" | "water" | "lava", lily: boolean, padV?: number) {
    const z0 = this.z + 2;
    const rowLen = ROW * (1.25 - 0.25 * Math.min(1, d));
    let z = z0;
    const tierMax = Math.max(1, Math.min(5, 1 + Math.floor(d * 6 + 0.4)));
    const entry = lily ? "lll" : "===";
    const all: string[] = [entry, entry];
    for (let i = 0; i < count; i++) {
      const t0 = sec.n <= STAGES_PER_REGION && i === 0 ? 1 : i === 0 ? Math.min(2, tierMax) : tierMax;
      const ch = this.pick(list, sec, t0, Math.min(t0, 1 + d * 5), false);
      all.push(...ch.rows);
      if (i < count - 1) all.push(entry, entry);
    }
    all.push(entry, entry);
    const n = all.length;
    for (let lane = -1; lane <= 1; lane++) {
      let i = 0;
      while (i < n) {
        const c = all[i][lane + 1];
        if (c !== "l" && c !== "=") { i++; continue; }
        let k = i; while (k < n && all[k][lane + 1] === c) k++;
        const a = z + i * rowLen + (i === 0 ? -0.6 : 0.15), b = z + k * rowLen - (k === n ? -0.6 : 0.15);
        this.ob({ kind: c === "l" ? "lily" : "bridge", lane, z: a, len: b - a, y: 0, k: 0, v: padV ?? Math.floor(this.r() * 2) });
        for (let q = i; q < k; q++) if (this.r() < 0.55) { this.banana(lane, z + (q + 0.3) * rowLen, 0.9); this.banana(lane, z + (q + 0.75) * rowLen, 0.9); }
        // bananas over the water gap that follows (a jump)
        if (k < n && k + 2 <= n) for (const [dz, y] of [[0.2, 1.7], [0.6, 2.2], [1.0, 1.7]] as const) this.banana(lane, z + (k + dz) * rowLen, y);
        i = k;
      }
    }
    this.zones.push({ id: this.id++, kind, z0: z, z1: z + n * rowLen });
    if (!this.gold.get(sec.n) && this.r() < 0.6) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", Math.floor(this.r() * 3) - 1, z + n * rowLen * 0.6, 2.2); }
    z += n * rowLen;
    this.z = z + 8;
  }
  /** a log raft ride down the river: steer between rocks, jump floating logs and crocs, slide under branches */
  private raftPiece(sec: Section, d: number, limit: number, slide?: "water" | "mud" | "snow") {
    const z0 = this.z + 4;
    const len = Math.min((slide ? 120 : 110) + d * 90 + this.r() * 30, limit - z0 - 12);
    let z = z0 + 10;
    const rowLen = ROW * (1.3 - 0.36 * Math.min(1, d));
    const tierMax = Math.max(1, Math.min(slide ? 3 : 5, 1 + Math.floor(d * 6 + 0.6) - (slide ? 1 : 0)));
    while (z < z0 + len - 14) {
      const ch = this.pick(V_RIVER, sec, tierMax, Math.min(tierMax, 1 + d * 5), false);
      z = this.place(sec, ch.rows, z, rowLen, slide ?? "water");
      const speed = this.speedAt(z);
      z += Math.max(rowLen * 1.15, speed * (0.55 - 0.12 * Math.min(1, d)));
      if (this.r() < 0.25) this.fruit(sec, Math.floor(this.r() * 3) - 1, z - 3, 1.1);
    }
    const z1 = Math.max(z + 6, z0 + len);
    this.zones.push({ id: this.id++, kind: "water", z0, z1, raft: true, slide });
    if (!this.gold.get(sec.n)) { this.gold.set(sec.n, (this.gold.get(sec.n) ?? 0) + 1); this.put("gold", Math.floor(this.r() * 3) - 1, z1 - 10, 1.4); }
    this.z = z1 + 8;
  }

  /** goodies in the gap after a chunk, on a schedule */
  private specials(sec: Section, end: number, gap: number) {
    const z = end + gap / 2, lane = Math.floor(this.r() * 3) - 1;
    const free = (l: number) => !this.blocked(l, z - 1, z + 1, "o");
    if (sec.chase) {
      // the chase: a Grumpy runs ahead with a Golden Seed through the last two places of a region; hit 3 banana pads to catch him
      const first = sec.s === 19;
      const z0 = this.stageZ(sec.n - (first ? 0 : 1));
      let c = this.chases[this.chases.length - 1];
      if (!c || c.z0 !== z0) { c = { id: this.chases.length + 1, z0, z1: z0 + 2 * STAGE_M, n: sec.n, villain: sec.villain, boss: sec.boss, region: sec.region }; this.chases.push(c); }
      const cz = c;
      const have = this.items.filter((i) => i.kind === "pad" && i.z >= cz.z0 && i.z <= cz.z1).length;
      const nearZone = this.zones.some((zn) => z > zn.z0 - 12 && z < zn.z1 + 26);
      if (have < 4 && z > c.z0 + 30 && z < c.z1 - 20 && free(lane) && !nearZone && z > (this.items.filter((i) => i.kind === "pad").pop()?.z ?? 0) + 100) { this.put("pad", lane, z, 0.05); return; }
    }
    if (end > this.nextFlag) { this.flag(z); return; }
    // one Golden Banana per place (three in a gold-rush place, and in the finale)
    const golds = this.gold.get(sec.n) ?? 0, many = sec.twist === "goldRush" || sec.finale;
    if (golds < (many ? 3 : 1) && end - this.stageZ(sec.n) > STAGE_M * (many ? [0.2, 0.45, 0.7][golds] : 0.62) && free(lane)) { this.gold.set(sec.n, golds + 1); this.put("gold", lane, z, 1.0); return; }
    if (end > this.nextBoost && free(lane)) { const x = this.r() < 0.2 ? 5 : 3; this.put("boost", lane, z, 1.1, { boost: x }); this.nextBoost = end + 2400 + x * 300 + this.r() * 900; return; }
    if (sec.ride && end > this.nextRide && free(lane)) { this.put("ride", lane, z, 0.2, { ride: sec.ride }); this.nextRide = end + 1500 + this.r() * 900; return; }
    if (end > this.nextHeart && free(lane)) { this.put("heart", lane, z, 1.0); this.nextHeart = end + (this.spec.help ? 1300 : 1800) + this.r() * 800; return; }
    if (end > this.nextPower && free(lane)) { this.put("power", lane, z, 1.1, { power: this.powerPick() }); this.nextPower = end + 280 + this.r() * 140; return; }
    if (end > this.nextRotten && sec.d > 0.12 && free(lane)) { this.put("rotten", lane, z, 0.9); this.nextRotten = end + 300 + this.r() * 400; }
  }
  private sort() { this.obs.sort((a, b) => a.z - b.z); this.items.sort((a, b) => a.z - b.z); this.zones.sort((a, b) => a.z0 - b.z0); this.vines.sort((a, b) => a.z - b.z); }
  private powerPick(): PowerId {
    const x = this.r();
    return x < 0.36 ? "magnet" : x < 0.54 ? "helmet" : x < 0.78 ? "double" : "glide";
  }
  /** banana melodies: 8+ bananas in a row in one lane make a line that plays a phrase of the region's song */
  private makeLines(from: number) {
    const bs = this.items.slice(from).filter((i) => i.kind === "banana" && i.line == null).sort((a, b) => a.lane - b.lane || a.z - b.z);
    let run: Item[] = [];
    const flush = () => {
      if (run.length >= 8) {
        const id = ++this.lineCount;
        run.forEach((c, i) => { c.line = id; c.idx = i; });
        this.lineLen.set(id, run.length);
      }
      run = [];
    };
    for (const c of bs) {
      const last = run[run.length - 1];
      if (last && (last.lane !== c.lane || c.z - last.z > 3.4 || Math.abs(c.y - last.y) > 1.2)) flush();
      run.push(c);
    }
    flush();
  }
}
