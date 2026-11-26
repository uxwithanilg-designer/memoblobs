// The heists. Not "level 1, level 2": each of the 1200 designed heists has its own codename ("The Velvet Anvil Job")
// and is a long job across several sites — separate lots, each on a street of the district, the time of day moving on
// from site to site — and every site is a run of goals: break in (the alarm trips), grab the loot quota, crack the
// vault, hold off the security robots, bring the building down, and get back to the van. The last site of a heist
// ends with the Vault Warden, Baron Bolt's big security mech. A heist runs about half an hour at the start and grows to
// about an hour; the security grows with it (more robots, tougher kinds, more at once). Progress is kept after every
// goal. After 1200 the jobs never end: remix heists blend two districts' looks, streets, buildings, robots and music,
// add twists (low gravity, a drone swarm, a gold rush, a night job, a lockdown) and swing the difficulty in long waves.
import { DESIGNED_HEISTS, DISTRICTS, HEISTS_PER_DISTRICT, districtOf, type BotKind, type BuildingKind, type District, type DistrictId, type TimeOfDay, type Weather } from "./districts";
import { clamp, makeRng, pick, type Rng } from "./util";

export type Goal = "breach" | "loot" | "vault" | "hold" | "wreck" | "boss" | "escape";
export type Twist = "lowgrav" | "swarm" | "gold" | "night" | "lockdown" | null;

export interface GoalPlan {
  kind: Goal;
  title: string; hint: string;
  /** loot: the share of the site's loot to take; wreck: the share of the building to bring down */
  share: number;
  /** hold and escape: seconds */
  secs: number;
}
export interface SitePlan {
  index: number; name: string; building: BuildingKind; size: number; seed: number;
  time: TimeOfDay; weather: Weather; twist: Twist;
  goals: GoalPlan[];
  /** security: the robots that come, by weight; the most at once; seconds between them; the share of gold elites */
  bots: [BotKind, number][]; cap: number; every: number; elite: number;
  d: number;
}
export interface HeistPlan {
  n: number;
  district: DistrictId; blend: DistrictId | null; blendAmt: number;
  local: number; remix: number;
  codename: string; minutes: number;
  sites: SitePlan[];
  difficulty: number;
  finale: boolean;
}

const ADJ = [
  "Velvet", "Golden", "Silent", "Crimson", "Midnight", "Lucky", "Rusty", "Diamond", "Copper", "Emerald", "Sapphire", "Thunder", "Paper", "Sticky",
  "Sneaky", "Rolling", "Broken", "Crooked", "Clever", "Shiny", "Dusty", "Frozen", "Neon", "Jade", "Ruby", "Iron", "Silver", "Amber", "Cobalt",
  "Hidden", "Lazy", "Merry", "Sly", "Swift", "Royal", "Secret", "Wild", "Giant", "Tiny", "Crystal", "Marble", "Velcro", "Jolly", "Grand", "Cosmic",
  "Magic", "Mighty", "Polished", "Rocky", "Sunny", "Stormy", "Fuzzy", "Brass", "Gilded", "Plaid", "Pixel", "Blocky", "Cubic", "Daring", "Quiet",
];
const NOUN = [
  "Anvil", "Vault", "Raccoon", "Falcon", "Teacup", "Pretzel", "Crown", "Lantern", "Whistle", "Biscuit", "Compass", "Kettle", "Piano", "Pinwheel",
  "Rooster", "Saxophone", "Teapot", "Trumpet", "Umbrella", "Walrus", "Yo-Yo", "Zeppelin", "Badger", "Cactus", "Doorknob", "Egg", "Fiddle",
  "Gumball", "Hammer", "Igloo", "Jigsaw", "Kazoo", "Lobster", "Moose", "Nugget", "Otter", "Pickle", "Quill", "Rocket", "Sardine", "Tuba",
  "Unicorn", "Violin", "Waffle", "Xylophone", "Yak", "Zebra", "Bagel", "Coconut", "Domino", "Envelope", "Flamingo", "Gadget", "Hedgehog",
  "Iguana", "Jackpot", "Kite", "Llama", "Muffin", "Noodle",
];
export function codenameOf(n: number) {
  const i = ((n - 1) * 1601) % (ADJ.length * NOUN.length);
  return `The ${ADJ[i % ADJ.length]} ${NOUN[Math.floor(i / ADJ.length)]} Job`;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const TOUGH: Record<BotKind, number> = { guard: 0, hound: 0.08, drone: 0.15, turret: 0.1, shield: 0.35, heavy: 0.45 };
function botsFor(list: [BotKind, number][], d: number, twist: Twist): [BotKind, number][] {
  const ok = list.filter(([k]) => TOUGH[k] <= d + 0.1);
  const out: [BotKind, number][] = (ok.length ? ok : list.slice(0, 1)).map(([k, w]) => [k, w * (twist === "swarm" && k === "drone" ? 4 : 1)]);
  if (twist === "swarm" && !out.some(([k]) => k === "drone")) out.push(["drone", 4]);
  return out;
}

function goalsFor(r: Rng, d: number, E: number, last: boolean, first: boolean): GoalPlan[] {
  const g: GoalPlan[] = [];
  g.push({ kind: "breach", title: first ? "Break in" : pick(r, ["Smash your way in", "Find a way in", "Break in"]), hint: "Smash a wall, a window or the door — the alarm trips", share: 0, secs: 0 });
  const quota = clamp(0.5 + d * 0.25, 0.5, 0.75);
  g.push({ kind: "loot", title: "Grab the loot", hint: `Take ${Math.round(quota * 100)}% of the loot — cash, gold, gems and art`, share: quota, secs: 0 });
  if (r() < 0.75 || last) g.push({ kind: "vault", title: "Crack the vault", hint: "Dynamite, rockets or a top drill break vault steel", share: 0, secs: 0 });
  if (r() < 0.8) g.push({ kind: "hold", title: pick(r, ["Hold them off", "Lockdown! Survive", "Fight off security"]), hint: `Survive the security for ${fmt(Math.round(E * 0.9 / 5) * 5)}`, share: 0, secs: Math.round(E * 0.9 / 5) * 5 });
  if (r() < 0.55) { const s = clamp(0.35 + d * 0.25, 0.35, 0.6); g.push({ kind: "wreck", title: "Bring it down", hint: `Wreck ${Math.round(s * 100)}% of the building`, share: s, secs: 0 }); }
  if (last) g.push({ kind: "boss", title: "The Vault Warden", hint: "Baron Bolt's security mech — take it down", share: 0, secs: 0 });
  g.push({ kind: "escape", title: "Get to the van!", hint: "Run back to Pip and the van", share: 0, secs: Math.round(70 - d * 20) });
  return g;
}

function makeSites(r: Rng, d0: District, partner: District | null, bots: [BotKind, number][], dd: number, minutes: number, nSites: number, twists: (i: number) => Twist, times: TimeOfDay[], weathers: Weather[], seed: number): SitePlan[] {
  const out: SitePlan[] = [];
  const places = [...d0.places, ...(partner ? partner.places : [])];
  const kinds = [...d0.buildings, ...(partner ? partner.buildings : [])];
  const t0 = Math.floor(r() * times.length);
  let placeI = Math.floor(r() * places.length), lastKind: BuildingKind | null = null;
  // about four goals a site; each site's share of the time
  const E = (minutes * 60) / (nSites * 4.4);
  for (let i = 0; i < nSites; i++) {
    const twist = twists(i);
    const d = clamp(dd + (i / Math.max(1, nSites - 1)) * 0.1, 0.05, 1);
    let building = pick(r, kinds);
    if (building === lastKind) building = kinds[(kinds.indexOf(building) + 1) % kinds.length];
    lastKind = building;
    let time = times[(t0 + i) % times.length];
    if (twist === "night") time = "night";
    let weather: Weather = pick(r, weathers);
    if (weather === "fireflies" && time !== "night" && time !== "dusk") weather = "clear";
    placeI = (placeI + 1 + Math.floor(r() * 3)) % places.length;
    out.push({
      index: i, name: places[placeI], building, size: clamp(d * 0.9 + r() * 0.2 + (i === nSites - 1 ? 0.1 : 0), 0, 1), seed: seed + i * 7717, time, weather, twist,
      goals: goalsFor(r, d, E, i === nSites - 1, i === 0),
      bots: botsFor(bots, d, twist), cap: Math.round((6 + d * 10) * (twist === "lockdown" ? 1.3 : 1)), every: clamp((3 - d * 1.8) / (twist === "lockdown" ? 1.4 : 1), 0.8, 3), elite: clamp(d * 0.14, 0.02, 0.16), d,
    });
  }
  return out;
}

export function heistPlan(n: number): HeistPlan {
  n = Math.max(1, Math.floor(n));
  if (n > DESIGNED_HEISTS) return remixPlan(n);
  const di = Math.floor((n - 1) / HEISTS_PER_DISTRICT), d = DISTRICTS[di];
  const local = ((n - 1) % HEISTS_PER_DISTRICT) + 1;
  const r = makeRng(n * 7919 + 331);
  const t = (n - 1) / (DESIGNED_HEISTS - 1), within = (local - 1) / (HEISTS_PER_DISTRICT - 1);
  const finale = local === HEISTS_PER_DISTRICT;
  const difficulty = clamp(0.16 + 0.66 * t + 0.08 * within + (finale ? 0.04 : 0) + (r() - 0.5) * 0.04, 0.12, 0.97);
  const minutes = Math.round(28 + 30 * t + r() * 3 + (finale ? 4 : 0));
  const nSites = clamp(2 + Math.floor(t * 3.4) + (finale ? 1 : 0), 2, 6);
  return { n, district: d.id, blend: null, blendAmt: 0, local, remix: 0, codename: codenameOf(n), minutes, sites: makeSites(r, d, null, d.bots, difficulty, minutes, nSites, () => null, d.times, d.weathers, n * 104729 + 7), difficulty, finale };
}

const TWISTS: Exclude<Twist, null>[] = ["lowgrav", "swarm", "gold", "night", "lockdown"];
function remixPlan(n: number): HeistPlan {
  const k = n - DESIGNED_HEISTS;
  const season = Math.floor((k - 1) / DISTRICTS.length);
  const order = DISTRICTS.map((_, i) => i);
  const sr = makeRng(season * 2654435761 + 23);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const di = order[(k - 1) % DISTRICTS.length], d = DISTRICTS[di];
  const r = makeRng(n * 15485863 + 77);
  let partner = DISTRICTS[Math.floor(r() * DISTRICTS.length)];
  if (partner.id === d.id) partner = DISTRICTS[(di + 5) % DISTRICTS.length];
  const wave = Math.sin(k * 0.55) * 0.5 + Math.sin(k * 0.13) * 0.5;
  const difficulty = clamp(0.84 + 0.12 * wave + (r() - 0.5) * 0.04, 0.7, 1);
  const minutes = Math.round(58 + 6 * wave + r() * 4);
  const nSites = 4 + Math.floor(r() * 3);
  const bots: [BotKind, number][] = [...d.bots, ...partner.bots.map(([kk, ww]) => [kk, ww * 0.6] as [BotKind, number])];
  const twistAt = (i: number): Twist => { const v = makeRng(n * 31 + i * 7907)(); return v < 0.45 ? null : TWISTS[Math.floor(v * 1000) % TWISTS.length]; };
  return {
    n, district: d.id, blend: partner.id, blendAmt: 0.25 + r() * 0.2, local: k, remix: k, codename: codenameOf(n), minutes,
    sites: makeSites(r, d, partner, bots, difficulty, minutes, nSites, twistAt, [...new Set([...d.times, ...partner.times])], [...new Set([...d.weathers, ...partner.weathers])], n * 104729 + 991),
    difficulty, finale: false,
  };
}

export const goalsIn = (p: HeistPlan) => p.sites.reduce((a, s) => a + s.goals.length, 0);
export function whereOf(p: HeistPlan) {
  return p.remix ? `Remix ${p.remix} · ${districtOf(p.district).name.split(" ")[0]} × ${districtOf(p.blend!).name.split(" ")[0]}` : `District ${Math.floor((p.n - 1) / HEISTS_PER_DISTRICT) + 1} · ${districtOf(p.district).name}`;
}
