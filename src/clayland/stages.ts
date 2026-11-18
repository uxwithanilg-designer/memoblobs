// Builds every stage of Puddo's Clayland: Rain Raid from its number: 400 designed stages (20 zones × 20) and then the
// Endless Storm. A stage is a CONCEPT (layout + goal + set piece — docs/PUDDO_RAIN_RAID_PLAN.md §5) built in the zone's
// district look with the zone's Dust Army: runs, ambush gates, rooftops, a collapsing bridge, tower climbs, shaft dives,
// mine carts, raft rivers, rescues, pump raids, holding the well, key hunts, coin vaults, arenas, the general's machine
// and the boss. Every gap and ledge is checked against Puddo's real jump (physics.ts). Seeded: stage 57 is always the same.
import { BEAST, BOSS } from "./bestiary";
import { DAILY_BASE, DESIGNED, FEATURE_TEXT, ISLANDS, ISLAND_BY_ID, SCHEDULE, STAGES_PER_ISLAND, islandOf, stageInIsland, stageName } from "./islands";
import { GRAV, maxRise, reach } from "./physics";
import { weaponsFor } from "./weapons";
import {
  T, type Concept, type EnemyKind, type Feature, type FriendId, type Gadget, type GadgetKind, type GateSpec, type GoalKind,
  type Island, type IslandId, type Item, type PlatKind, type PlatSpec, type Pot, type PotItem, type Stage, type StageType,
  type Target, type TimeOfDay, type WaveFoe,
} from "./types";

/** the play height of a horizontal stage (vertical stages are much taller) */
export const GRID_H = 24;
const CAP = 1600;

export function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** which zone frees which friend (friends can turn up in pots from then on) */
export const FRIEND_FROM: Record<FriendId, number> = { turbo: 2, pip: 4, hoot: 5, bolt: 7, gloop: 8, noodle: 13, zib: 14 };
export const FRIEND_NAME: Record<FriendId, string> = { turbo: "Turbo", pip: "Pip", hoot: "Prof. Hoot", bolt: "Bolt", gloop: "Gloop", noodle: "Noodle", zib: "Zib" };
export const FRIEND_POWER: Record<FriendId, string> = {
  turbo: "Rocket shell — super fast, smashes small enemies", pip: "Belly slide — fast on ice and in water", hoot: "Hold jump to glide",
  bolt: "Spring boots — jump again in the air", gloop: "Stick to walls — jump from wall to wall", noodle: "Catches Puddo over a pit as a bridge",
  zib: "Hold jump in the air to hover",
};

/** the Daily Storm: stage numbers from DAILY_BASE + day (UTC days since 1970), the same for everyone that day */
export { DAILY_BASE };
export const today = () => Math.floor(Date.now() / 86400000);
export const dailyNumber = (day = today()) => DAILY_BASE + day;
export const isDaily = (n: number) => n >= DAILY_BASE;

const POOL: Concept[] = ["frontline", "ambush", "rooftops", "collapse", "tower", "dive", "minecart", "raft", "rescue", "bombsquad", "holdwell", "keyhunt"];

/** the 20-stage schedule of a zone: hand-made for zones 1–4, drafted (no repeats within 4) for the rest */
export function zoneSchedule(isl: Island): Concept[] {
  const made = SCHEDULE[isl.id];
  if (made) return made;
  const r = rng(isl.n * 4099 + 11), out: Concept[] = [];
  for (let s = 1; s <= 20; s++) {
    if (s === 10) { out.push("machine"); continue; }
    if (s === 20) { out.push("boss"); continue; }
    if (s === 5) { out.push("vault"); continue; }
    if (s === 15) { out.push("arena"); continue; }
    if (s === 1) { out.push("frontline"); continue; }
    let c: Concept; let k = 0;
    do { c = POOL[Math.floor(r() * POOL.length)]; k++; } while (k < 40 && out.slice(-4).includes(c));
    // rides need water or rails: no raft in fire, sand, sky or space zones
    if (c === "raft" && ["volcano", "dunes", "clouds", "moon", "castle", "factory", "neon"].includes(isl.id)) c = "minecart";
    out.push(c);
  }
  return out;
}
export const conceptOf = (n: number): Concept => (n > DESIGNED ? endlessPlan(n).concept : zoneSchedule(islandOf(n))[stageInIsland(n) - 1]);

/** the Endless Storm (401+) and the Daily Storm: a look, an army and a concept that rotate on their own cycles */
function endlessPlan(n: number) {
  const r = n >= DAILY_BASE ? (n - DAILY_BASE) * 3 + 11 : n - DESIGNED;
  const look = ISLANDS[(r * 7) % ISLANDS.length];
  let army = ISLANDS[(r * 13 + 5) % ISLANDS.length]; if (army.id === look.id) army = ISLANDS[(r * 13 + 6) % ISLANDS.length];
  const list: Concept[] = [...POOL, "arena", "vault"];
  const concept: Concept = r % 10 === 0 && n < DAILY_BASE ? "boss" : list[(r * 5) % list.length];
  return { r, look, army, concept, district: (r * 3) % 4 };
}

/** 0 (gentle) … 1 (the hardest designed stage); each zone climbs, and a vault or the stage after a fight dips */
export function difficulty(n: number): number {
  if (n >= DAILY_BASE) return 0.45 + 0.15 * ((((n - DAILY_BASE) * 37) % 7) / 6);
  if (n > DESIGNED) { const r = n - DESIGNED; return clamp(0.92 + Math.min(0.25, r * 0.0008) + 0.04 * Math.sin(r * 0.9), 0.85, 1.2); }
  const z = islandOf(n).n, s = stageInIsland(n), c = conceptOf(n);
  let d = 0.04 + 0.92 * Math.pow(((z - 1) + (s - 1) / 19) / 20, 1.05);
  if (c === "vault") d -= 0.08; else if (s === 11) d -= 0.04; else if (c === "arena" || c === "boss") d += 0.03;
  if (n <= 3) d *= 0.5;
  return clamp(d, 0, 1);
}
/** enemy toughness by zone (docs §8) */
export const hpMulFor = (n: number) => { if (n > DESIGNED) return n >= DAILY_BASE ? 1.4 : 1.8 + Math.min(0.6, (n - DESIGNED) * 0.002); const z = islandOf(n).n; return z <= 2 ? 1 : z <= 8 ? 1.2 : z <= 12 ? 1.35 : z <= 16 ? 1.5 : 1.8; };

const TODS: TimeOfDay[] = ["day", "sunset", "day", "night", "day"];
const VERTICAL = new Set<Concept>(["tower", "dive", "elevator", "flood", "chimney"]);
/** concepts that lay out their own start (no default starting ground) */
const OWN_START = new Set<Concept>(["minecart", "raft", "arena", "holdwell", "glider", "train", "iceslide"]);

interface P { gapMax: number; pit: number; foes: number; elite: number; sections: number; secLen: number }
type Role = "grunt" | "fast" | "gunner" | "heavy" | "air" | "static";
const ROLE: Partial<Record<EnemyKind, Role>> = {
  dustie: "grunt", dustRunner: "fast", dustHopper: "fast", pebbleGunner: "gunner", mortar: "gunner", shieldDustie: "heavy", brickBrute: "heavy",
  dustDrone: "air", bombGull: "air", diveHawk: "air", wallTurret: "static", ceilTurret: "static", dustHive: "static", mineLayer: "grunt",
  laserSniper: "gunner", copterDustie: "air", kiteRider: "air", towerShield: "heavy", gumBouncer: "fast", candyCannon: "gunner", dustCart: "fast",
  windupSwarm: "fast", toyTank: "heavy", sporeThrower: "gunner", rootGrabber: "grunt", witchMoth: "air", iceShooter: "gunner", hoverSled: "fast",
  snowBrute: "heavy", sandBlower: "static", sandShark: "fast", dropPod: "static", kilnKnight: "heavy", lanternGhost: "air", spiderDustie: "grunt",
  laserTurret: "static", forgeBot: "grunt", crusherBot: "heavy",
};
const roleOfWild = (k: EnemyKind): Role => { const b = BEAST[k].b; return b === "fly" ? "air" : b === "hop" || b === "chase" ? "fast" : b === "shoot" ? "gunner" : b === "spiky" ? "heavy" : "grunt"; };

class Gen {
  W: number; H: number; t: Uint8Array;
  x = 0; h = 4;
  items: Item[] = []; pots: Pot[] = []; plats: PlatSpec[] = []; gadgets: Gadget[] = []; enemies: Stage["enemies"] = [];
  checkpoints: { x: number; y: number }[] = []; gates: GateSpec[] = []; targets: Target[] = [];
  id = 1; drops = 0; lastFruit = 0; ceiling = false; liquid: "pit" | "lava" | "water" | "poison" = "pit";
  rnd: () => number; d: number; p: P; isl: Island; feats: Feature[]; n: number; zone: number;
  /** the enemies this stage may use, by role */
  roles: Record<Role, EnemyKind[]> = { grunt: [], fast: [], gunner: [], heavy: [], air: [], static: [] };
  swim: EnemyKind[] = [];
  constructor(W: number, H: number, rnd: () => number, d: number, p: P, isl: Island, feats: Feature[], army: EnemyKind[], wild: EnemyKind[], n: number, zone: number) {
    this.W = W; this.H = H; this.t = new Uint8Array(W * H);
    this.rnd = rnd; this.d = d; this.p = p; this.isl = isl; this.feats = feats; this.n = n; this.zone = zone;
    for (const k of army) { const r = ROLE[k]; if (r && k !== "dustHive" && k !== "ceilTurret") this.roles[r].push(k); }
    for (const k of wild) { if (BEAST[k].b === "swim") { this.swim.push(k); continue; } if (BEAST[k].b === "drop") continue; this.roles[roleOfWild(k)].push(k); }
    this.armyHas = new Set(army);
  }
  armyHas: Set<EnemyKind>;
  ri(a: number, b: number) { return a + Math.floor(this.rnd() * (b - a + 1)); }
  pick<X>(a: X[]): X { return a[Math.floor(this.rnd() * a.length)]; }
  has(f: Feature) { return this.feats.includes(f); }
  set(x: number, y: number, v: number) { if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.t[y * this.W + x] = v; }
  get(x: number, y: number) { return x >= 0 && x < this.W && y >= 0 && y < this.H ? this.t[y * this.W + x] : 0; }
  col(x: number, top: number, kind: number = T.GROUND) { for (let y = 0; y < top; y++) this.set(x, y, kind); if (this.ceiling) for (let y = this.H - 2; y < this.H; y++) this.set(x, y, T.BRICK); }
  ground(len: number, kind: number = T.GROUND) { for (let i = 0; i < len; i++) this.col(this.x + i, this.h, kind); }
  surface(x0: number, len: number, kind: number) { for (let i = 0; i < len; i++) this.set(x0 + i, this.h - 1, kind); }
  item(kind: Item["kind"], x: number, y: number, extra: Partial<Item> = {}) { this.items.push({ kind, x, y, id: this.id++, fruit: kind === "fruit" ? this.ri(0, 5) : undefined, ...extra }); }
  coins(x0: number, n: number, y: number, arc = 0) { for (let i = 0; i < n; i++) this.item("coin", x0 + i + 0.5, y + (arc ? Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc : 0)); }
  gadget(kind: GadgetKind, x: number, y: number, o: Partial<Gadget> = {}) { this.gadgets.push({ kind, x, y, id: this.id++, ...o }); }
  plat(kind: PlatKind, x: number, y: number, w: number, range: number, speed: number) { this.plats.push({ kind, x, y, w, range, speed, phase: this.rnd() * Math.PI * 2, id: this.id++ }); }
  foe(kind: EnemyKind, x: number, y: number, range = 3, elite?: boolean) { this.enemies.push({ kind, x, y, range, id: this.id++, elite: elite ?? (this.rnd() < this.p.elite && BEAST[kind].b !== "hive") }); }
  pot(x: number, y: number, item: PotItem, crate = false) { this.pots.push({ x, y, item, hidden: false, crate, id: this.id++ }); }
  fruit(x: number, y: number, every = 30) { if (x - this.lastFruit >= every) { this.item("fruit", x, y); this.lastFruit = x; } }
  drop(x: number, y: number) { if (this.drops < 3) { this.item("drop", x, y); this.drops++; } }
  maxGap(dh: number) { const g = this.has("lowg") ? GRAV * 0.45 : GRAV; return Math.max(1, Math.floor(reach(dh, g) * 0.8)); }
  pitFill(x0: number, w: number) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      if (this.liquid === "lava") { this.set(x, 0, T.LAVA); this.set(x, 1, T.LAVA); }
      else if (this.liquid === "poison") { this.set(x, 0, T.GROUND); this.set(x, 1, T.POISON); }
      else if (this.liquid === "water") { this.set(x, 0, T.GROUND); for (let y = 1; y < this.h - 1; y++) this.set(x, y, T.WATER); }
      if (this.ceiling) for (let y = this.H - 2; y < this.H; y++) this.set(x, y, T.BRICK);
    }
  }

  // ------------------------------------------------------------------ the army
  kind(role: Role): EnemyKind {
    const list = this.roles[role];
    if (list.length) return this.pick(list);
    return this.roles.grunt.length ? this.pick(this.roles.grunt) : "dustie";
  }
  role(): Role {
    const r = this.rnd(), hasHeavy = this.roles.heavy.length > 0, hasAir = this.roles.air.length > 0;
    if (r < 0.34) return "grunt";
    if (r < 0.52) return this.roles.fast.length ? "fast" : "grunt";
    if (r < 0.7) return this.roles.gunner.length ? "gunner" : "grunt";
    if (r < 0.82) return hasHeavy ? "heavy" : "grunt";
    return hasAir ? "air" : "grunt";
  }
  /** one enemy of a role at x (flyers float above the ground) */
  enemy(role: Role, x: number, range = 3) {
    const k = this.kind(role), b = BEAST[k];
    const fly = b.b === "fly" || b.b === "drone" || b.b === "bomber" || b.b === "dive" || b.b === "copter";
    const y = fly ? this.h + this.ri(3, 5) + (b.b === "bomber" || b.b === "dive" ? 2 : 0) : b.b === "sled" ? this.h + 0.7 : b.b === "drop" ? this.h + 3 : this.h;
    this.foe(k, x, y, fly ? Math.max(3, range) : range);
    // wind-up soldiers come in threes
    if (k === "windupSwarm") { this.foe(k, x - 0.8, y, range); this.foe(k, x + 0.8, y, range); }
  }
  /** a crate: a weapon pickup or bombs */
  crate(x: number, y: number, kind?: "weapon" | "bombs") {
    const ws = weaponsFor(this.zone);
    const k = kind ?? (this.rnd() < 0.55 ? "weapon" : "bombs");
    this.pot(x, y, k === "weapon" ? { k: "weapon", w: this.pick(ws) } : { k: "bombs", n: 2 }, true);
  }
  potItem(): PotItem {
    const r = this.rnd(), z = this.zone;
    const friends = (Object.keys(FRIEND_FROM) as FriendId[]).filter((f) => FRIEND_FROM[f] < z);
    if (r < 0.3) return { k: "coins" };
    if (r < 0.48) return { k: "heart" };
    if (r < 0.58) return { k: "star" };
    if (r < 0.75 && friends.length) return { k: "friend", f: this.pick(friends) };
    return { k: "juice" };
  }

  // ------------------------------------------------------------------ combat pieces
  /** a run with a squad of the Dust Army on it */
  squad(len = this.ri(13, 19), k?: number) {
    this.ground(len);
    const n = k ?? clamp(Math.round(this.p.foes * (0.7 + this.rnd() * 0.6)), 1, 7);
    for (let i = 0; i < n; i++) this.enemy(this.role(), this.x + 3 + (i + 0.5) * ((len - 4) / n), Math.min(3, (len - 4) / n / 2 + 0.5));
    if (this.rnd() < 0.6) this.coins(this.x + 2, 4, this.h + 1.4, 0.8);
    this.x += len;
  }
  /** a sandbag barricade: shields and gunners behind it — hop on top and shoot down, or bomb it */
  barricade() {
    const len = 14; this.ground(len);
    const bx = this.x + 6;
    for (let i = 0; i < 2; i++) for (let y = this.h; y < this.h + 2; y++) this.set(bx + i, y, T.BLOCK);
    this.foe(this.roles.heavy.length && this.rnd() < 0.6 ? this.kind("heavy") : this.kind("gunner"), bx + 4, this.h, 1.5);
    this.foe(this.kind("gunner"), bx + 6.5, this.h, 1);
    if (this.rnd() < 0.5) this.enemy("grunt", bx - 3, 2);
    this.coins(bx, 2, this.h + 2.8);
    this.x += len;
  }
  /** a watchtower: a lookout on top of a brick tower (aim up — the blaster bends toward it) */
  watchtower() {
    const len = 13; this.ground(len);
    const tx = this.x + 7, th = clamp(this.ri(4, 6), 3, this.H - this.h - 5);
    for (let y = this.h; y < this.h + th; y++) { this.set(tx, y, T.BRICK); this.set(tx + 1, y, T.BRICK); }
    this.foe(this.kind("gunner"), tx + 1, this.h + th, 0.3);
    // a vine up the side, for the brave (a Rain Drop or coins at the top)
    for (let y = this.h; y < this.h + th; y++) this.set(tx - 1, y, T.VINE);
    if (this.drops < 3 && this.rnd() < 0.35) this.drop(tx + 0.5, this.h + th + 2.2); else this.coins(tx, 2, this.h + th + 2);
    this.enemy("grunt", this.x + 11, 1.5);
    this.x += len;
  }
  /** a turret nest on a ledge over the path */
  turretNest() {
    const len = 15; this.ground(len);
    const lx = this.x + 5, ly = Math.min(this.H - 4, this.h + 4);
    for (let i = 0; i < 6; i++) this.set(lx + i, ly - 1, T.BRICK);
    const turret: EnemyKind = this.armyHas.has("laserTurret") && this.rnd() < 0.5 ? "laserTurret" : this.armyHas.has("wallTurret") ? "wallTurret" : this.kind("gunner");
    this.foe(turret, lx + 1.5, ly, 0.2); if (this.d > 0.25) this.foe(turret, lx + 4.5, ly, 0.2);
    // the ceiling turret hangs under the ledge
    if (this.armyHas.has("ceilTurret")) this.foe("ceilTurret", lx + 3, ly - 1 - 0.9, 0.2);
    this.coins(lx, 5, ly + 1.2);
    this.x += len;
  }
  /** a Dust Hive baking Dusties, with guards: bomb it */
  hiveYard() {
    const len = 16; this.ground(len);
    this.foe("dustHive", this.x + 10, this.h, 0, false);
    this.enemy("grunt", this.x + 6, 2); this.enemy("gunner", this.x + 13, 1);
    this.crate(this.x + 3, this.h, "bombs");
    this.x += len;
  }
  /** bomb gulls and drones over an open stretch */
  skyRaid() {
    const len = this.ri(16, 22); this.ground(len);
    const n = clamp(1 + Math.round(this.d * 2.5), 1, 3);
    for (let i = 0; i < n; i++) this.enemy("air", this.x + 4 + i * ((len - 6) / n), 4);
    this.enemy("grunt", this.x + len - 3, 2);
    this.coins(this.x + 2, len - 4, this.h + 1.3);
    this.x += len;
  }
  /** mines on the path (and the layer that left them) */
  mineField() {
    const len = 16; this.ground(len);
    if (this.armyHas.has("mineLayer")) this.foe("mineLayer", this.x + 11, this.h, 4);
    else this.enemy("grunt", this.x + 11, 3);
    for (let i = 0; i < clamp(1 + Math.round(this.d * 3), 1, 3); i++) this.gadget("mine", this.x + 4 + i * 3.5, this.h);
    this.x += len;
  }
  /** crates stacked on blocks: shoot them open from below */
  crateStack() {
    const len = 12; this.ground(len);
    const bx = this.x + 4;
    for (let i = 0; i < 4; i++) this.set(bx + i, this.h, T.BLOCK);
    for (let i = 1; i < 3; i++) this.set(bx + i, this.h + 1, T.BLOCK);
    this.crate(bx + 1.5, this.h + 2); this.crate(bx + 2.5, this.h + 2, "bombs");
    this.enemy(this.role(), this.x + 10, 1.5);
    this.x += len;
  }
  setPiece() {
    const r = this.rnd(), z = this.zone;
    if (r < 0.2) return this.barricade();
    if (r < 0.36) return this.watchtower();
    if (r < 0.52 && (this.armyHas.has("wallTurret") || this.d > 0.2)) return this.turretNest();
    if (r < 0.64 && this.armyHas.has("dustHive")) return this.hiveYard();
    if (r < 0.78 && this.roles.air.length) return this.skyRaid();
    if (r < 0.88 && (this.armyHas.has("mineLayer") || z >= 3)) return this.mineField();
    if (r < 0.94 && this.armyHas.has("dropPod")) { const len = 16; this.ground(len); this.pod(this.x + 9); this.enemy("gunner", this.x + 13, 1); this.x += len; return; }
    return this.crateStack();
  }
  /** an ambush arena: walls slam shut, waves pour in */
  gateRoom(waves: WaveFoe[][], len = 28) {
    this.ground(3); this.x += 3;
    const x0 = this.x, x1 = this.x + len - 1, top = Math.min(this.H - 1, this.h + 9);
    this.ground(len);
    for (let y = this.h; y < top; y++) { this.set(x0, y, T.GATE); this.set(x1, y, T.GATE); }
    // two side ledges to fight from
    for (const lx of [x0 + 5, x1 - 9]) for (let i = 0; i < 5; i++) this.set(lx + i, this.h + 3, T.ONEWAY);
    this.crate(x0 + 3, this.h, this.rnd() < 0.5 ? "weapon" : "bombs");
    this.gates.push({ id: this.id++, x0, x1, floor: this.h, top, waves });
    this.x += len;
  }
  /** waves for an arena / ambush, growing with the difficulty */
  waves(count: number, size: number): WaveFoe[][] {
    const out: WaveFoe[][] = [];
    for (let w = 0; w < count; w++) {
      const n = Math.round(size + w * (0.6 + this.d));
      const wave: WaveFoe[] = [];
      const roles: Role[] = ["grunt", "fast", "gunner", "heavy", "air"];
      let left = n;
      while (left > 0) {
        const r = w === 0 ? (this.rnd() < 0.6 ? "grunt" : "fast") : roles[Math.floor(this.rnd() * roles.length)];
        const k = this.kind(r), c = Math.min(left, BEAST[k].b === "brute" ? 1 : this.ri(1, 3));
        wave.push({ kind: k, n: c, elite: w === count - 1 && this.d > 0.2 && this.rnd() < 0.5 && c === 1 });
        left -= c;
      }
      out.push(wave);
    }
    return out;
  }

  // ------------------------------------------------------------------ platforming pieces (v1, now with the army on them)
  run(len = this.ri(6, 10)) {
    this.ground(len);
    if (this.rnd() < 0.6) this.coins(this.x + 1, Math.min(len - 2, this.ri(3, 5)), this.h + 1.4, this.rnd() < 0.5 ? 1.2 : 0);
    this.fruit(this.x + len - 2, this.h + 0.6);
    this.x += len;
  }
  steps() {
    const up = this.h < 8 ? this.rnd() < 0.6 : false, n = this.ri(2, 4), rise = this.d > 0.4 && this.rnd() < 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) { const w = this.ri(2, 3); this.ground(w); this.x += w; this.h = clamp(this.h + (up ? rise : -rise), 2, 11); }
    this.ground(3); this.coins(this.x, 3, this.h + 1.2); this.x += 3;
  }
  hill() {
    this.ground(2); this.x += 2;
    const up = this.ri(2, 3); this.h = clamp(this.h + up, 2, 12);
    const w = this.ri(6, 9); this.ground(w); this.coins(this.x + 1, w - 2, this.h + 1.3, 1);
    this.enemy(this.rnd() < 0.5 ? "gunner" : "grunt", this.x + w / 2, w / 2 - 1);
    this.x += w; this.h = clamp(this.h - up, 2, 12);
  }
  gap(forcePit?: boolean) {
    const dh = clamp(this.pick([-2, -1, 0, 0, 1]), 2 - this.h, 10 - this.h);
    const pit = forcePit ?? this.rnd() < this.p.pit;
    const w = clamp(this.ri(2, Math.max(2, Math.round(this.p.gapMax))), 2, this.maxGap(dh));
    this.ground(2); this.x += 2;
    if (pit) { this.pitFill(this.x, w); if (this.rnd() < 0.5) this.coins(this.x, w, this.h + 2, 1.4); }
    else { for (let i = 0; i < w; i++) this.col(this.x + i, Math.max(1, this.h - 2)); }
    this.x += w; this.h += dh;
    this.ground(3); this.x += 3;
  }
  float() {
    this.ground(2); this.x += 2;
    const k = this.ri(2, 3 + Math.round(this.d * 2));
    let px = this.x, py = this.h;
    const solid = this.rnd() < 0.5 ? T.BLOCK : T.ONEWAY;
    for (let i = 0; i < k; i++) {
      const dy = clamp(this.pick([-1, 0, 1, 1]), 1 - py + 1, 11 - py);
      const gap = clamp(this.ri(2, Math.max(2, Math.round(this.p.gapMax - 1))), 1, this.maxGap(dy));
      const w = this.ri(2, 4);
      this.pitFill(px, gap); px += gap; py += dy;
      for (let j = 0; j < w; j++) this.set(px + j, py - 1, solid);
      this.pitFill(px, w);
      if (this.rnd() < 0.5) this.coins(px, w, py + 1);
      if (i === k - 1 && this.rnd() < 0.3 && this.drops < 3) this.drop(px + w / 2, py + 3.3);
      px += w;
    }
    const last = clamp(this.ri(2, 3), 1, this.maxGap(this.h - py));
    this.pitFill(px, last); px += last;
    this.x = px; this.ground(3); this.x += 3;
  }
  blocks() {
    const len = this.ri(10, 13); this.ground(len);
    const bx = this.x + this.ri(3, 4), bw = this.ri(3, 5), by = this.h + 3;
    for (let i = 0; i < bw; i++) this.set(bx + i, by, i === 1 ? T.BREAK : T.BRICK);
    this.coins(bx, bw, by + 1.6);
    if (this.rnd() < 0.5) this.crate(bx + bw - 0.5, by + 1); else if (this.rnd() < 0.4) this.pot(bx + bw - 0.5, by + 1, this.potItem());
    this.enemy(this.role(), this.x + len - 3, 2);
    this.x += len;
  }
  spikes() {
    const len = this.ri(8, 11); this.ground(len);
    const sw = clamp(this.ri(1, 1 + Math.round(this.d * 3)), 1, this.maxGap(0) - 1);
    const sx = this.x + this.ri(3, 4);
    for (let i = 0; i < sw; i++) this.set(sx + i, this.h, T.SPIKES);
    this.coins(sx, sw, this.h + 2.6);
    this.x += len;
  }
  breakRoom(secret = false) {
    const len = 10; this.ground(len);
    const px = this.x + 4;
    for (let i = 0; i < 3; i++) { this.set(px + i, this.h - 1, T.BREAK); this.set(px + i, this.h - 2, T.EMPTY); this.set(px + i, this.h - 3, T.EMPTY); }
    if (secret && this.h >= 4) this.drop(px + 1.5, this.h - 2.4); else this.coins(px, 3, this.h - 2.4);
    this.x += len;
  }
  squeeze() {
    const len = this.ri(6, 8); this.ground(4); this.x += 4;
    this.ground(len);
    for (let i = 0; i < len; i++) for (let y = this.h + 1; y <= Math.min(this.H - 1, this.h + 3); y++) this.set(this.x + i, y, T.BLOCK);
    this.coins(this.x + 1, len - 2, this.h + 0.45);
    this.x += len; this.ground(3); this.x += 3;
  }
  bounceUp(secret = false) {
    const len = 9; this.ground(len);
    const bx = this.x + 3; this.set(bx, this.h - 1, T.BOUNCE);
    const ly = Math.min(this.H - 4, this.h + 6);
    for (let i = 0; i < 4; i++) this.set(bx - 1 + i, ly - 1, T.ONEWAY);
    if (secret) this.drop(bx + 1, ly + 0.6); else this.coins(bx - 1, 4, ly + 0.6);
    this.x += len;
  }
  /** spawn helper for pods: they wait high above */
  pod(x: number) { this.foe("dropPod", x, this.h + 13, 0, false); }
  rest() { const len = this.ri(6, 8); this.ground(len); this.item("fruit", this.x + 2.5, this.h + 0.6); this.lastFruit = this.x + 2.5; this.coins(this.x + 4, 3, this.h + 1.3, 0.8); this.x += len; }
  liftGap(vertical = false) {
    this.ground(2); this.x += 2;
    if (vertical) {
      const rise = clamp(this.ri(4, 6), 0, 12 - this.h);
      if (rise < 3) return this.gap();
      const w = 3; this.pitFill(this.x, w);
      this.plat("vlift", this.x + 1.5, this.h + rise / 2 - 0.5, 2.4, rise / 2 + 0.3, lerp(1.2, 2.2, this.d));
      this.x += w; this.h += rise; this.ground(4); this.coins(this.x + 1, 2, this.h + 1.2); this.x += 4;
      return;
    }
    const w = this.ri(7, 10 + Math.round(this.d * 4)); this.pitFill(this.x, w);
    const kind: PlatKind = this.has("rocking") ? "rock" : this.isl.id === "neon" && this.rnd() < 0.5 ? "taxi" : "lift";
    if (kind === "rock") { const nr = w > 9 ? 3 : 2; for (let i = 0; i < nr; i++) this.plat("rock", this.x + 1.6 + i * (w - 3.2) / (nr - 1), this.h - 0.3, 2.6, 1.2, lerp(1.1, 1.8, this.d)); }
    else this.plat(kind, this.x + w / 2, this.h, 3, Math.max(0.6, (w - 3) / 2 - 0.3), lerp(2.2, 3.4, this.d));
    this.coins(this.x + 2, w - 4, this.h + 1.6);
    this.x += w; this.ground(3); this.x += 3;
  }
  crumbleBridge() {
    this.ground(2); this.x += 2;
    const w = clamp(this.ri(5, 9), 4, 10); this.pitFill(this.x, w);
    for (let i = 0; i < w; i++) this.set(this.x + i, this.h - 1, T.CRUMBLE);
    this.coins(this.x, w, this.h + 1);
    this.x += w; this.ground(3); this.x += 3;
  }
  fires() { const len = this.ri(11, 15); this.ground(len); const k = clamp(1 + Math.round(this.d * 2.5 * this.rnd()), 1, 3); for (let i = 0; i < k; i++) this.gadget("bonfire", this.x + 3 + i * Math.floor((len - 4) / k), this.h); this.x += len; }
  drips() {
    const len = this.ri(10, 14); this.ground(len); const was = this.ceiling; this.ceiling = true;
    const cy = Math.min(this.H - 3, this.h + 8);
    for (let i = 0; i < len; i++) for (let y = cy; y < this.H; y++) this.set(this.x + i, y, T.BRICK);
    const k = this.ri(2, 3);
    for (let i = 0; i < k; i++) this.gadget("drip", this.x + 2.5 + i * (len - 4) / k, cy, { period: lerp(2.6, 1.4, this.d), phase: this.rnd() * 2 });
    if (this.armyHas.has("ceilTurret")) this.foe("ceilTurret", this.x + len / 2, cy - 0.9, 0.2);
    this.coins(this.x + 1, len - 2, this.h + 1.2);
    this.ceiling = was; this.x += len;
  }
  pool(sea = false) {
    this.ground(2); this.x += 2;
    const w = sea ? this.ri(16, 22) : this.ri(8, 12), depth = sea ? 6 : 4;
    const bottom = Math.max(1, this.h - depth);
    for (let i = 0; i < w; i++) { this.col(this.x + i, bottom); for (let y = bottom; y < this.h; y++) this.set(this.x + i, y, T.WATER); }
    const k = sea ? this.ri(2, 3) : this.ri(1, 2);
    for (let i = 0; i < k && this.swim.length; i++) this.foe(this.pick(this.swim), this.x + 3 + i * (w - 6) / k, bottom + this.ri(1, depth - 2), 2);
    this.coins(this.x + 2, w - 4, bottom + 1.2, 1.2);
    if (this.has("current")) this.gadget("current", this.x, bottom, { w, h: this.h - bottom, power: (this.rnd() < 0.7 ? 1 : -1) * lerp(1.5, 3, this.d) });
    if (this.drops < 3 && this.rnd() < 0.3) this.drop(this.x + w - 2, bottom + 0.6);
    this.x += w; this.ground(3); this.x += 3;
  }
  windGap() {
    // a tailwind carries Puddo over a wide gap; a headwind (weaker) only ever guards a short one
    const len = this.ri(10, 14), help = this.rnd() < 0.65, power = lerp(2.5, 5, this.d) * (help ? 1 : 0.6);
    this.gadget("wind", this.x, this.h, { w: len, h: 8, power: (help ? 1 : -1) * power });
    this.ground(3); this.x += 3;
    const most = Math.max(2, Math.floor(reach(0, GRAV, 7.4 + (help ? power : -power)) * 0.78));
    const w = help ? clamp(this.ri(2, 5), 2, most) : 2;
    this.pitFill(this.x, w); this.coins(this.x, w, this.h + 2.2, 1);
    this.x += w; const rest = Math.max(3, len - 3 - w); this.ground(rest); this.x += rest;
  }
  cloudSteps() {
    this.ground(2); this.x += 2;
    const k = this.ri(3, 4); let px = this.x, py = this.h;
    for (let i = 0; i < k; i++) {
      const dy = clamp(this.pick([0, 1, -1, 1]), 2 - py, 11 - py), g = clamp(this.ri(2, 3), 1, this.maxGap(dy));
      this.pitFill(px, g); px += g; py += dy;
      const w = this.ri(2, 3); for (let j = 0; j < w; j++) this.set(px + j, py - 1, T.CLOUD);
      this.pitFill(px, w); this.coins(px, w, py + 1); px += w;
    }
    const g = clamp(2, 1, this.maxGap(this.h - py)); this.pitFill(px, g); px += g;
    this.x = px; this.ground(3); this.x += 3;
  }
  caramel() { const len = this.ri(10, 14); this.ground(len); this.surface(this.x + 2, len - 4, T.CARAMEL); this.enemy("grunt", this.x + len - 3, 2); this.coins(this.x + 2, len - 4, this.h + 1.1); this.x += len; }
  springUp() {
    const len = 5; this.ground(len); this.set(this.x + 2, this.h - 1, T.BOUNCE); this.x += len;
    const rise = clamp(this.ri(4, 5), 0, 12 - this.h);
    if (rise < 4) { this.ground(3); this.x += 3; return; }
    this.h += rise; this.ground(5); this.coins(this.x, 4, this.h + 1.2); this.x += 5;
  }
  belts() {
    const len = this.ri(12, 16); this.ground(len);
    this.surface(this.x + 1, len - 2, this.rnd() < 0.5 ? T.BELT_R : T.BELT_L);
    if (this.rnd() < 0.6) { const gx = this.x + Math.floor(len / 2); for (let i = 0; i < 2; i++) for (let y = 0; y < this.h; y++) this.set(gx + i, y, T.EMPTY); this.pitFill(gx, 2); }
    this.enemy("gunner", this.x + len - 2, 1);
    this.x += len;
  }
  switchGate() {
    const len = 6; this.ground(len); this.gadget("switch", this.x + 3, this.h); this.x += len;
    for (let y = this.h; y < Math.min(this.H - 1, this.h + 7); y++) this.set(this.x, y, T.SW_A);
    this.ground(2); this.x += 2;
    const w = clamp(this.ri(4, 7), 3, 8); this.pitFill(this.x, w);
    for (let i = 0; i < w; i++) this.set(this.x + i, this.h - 1, T.SW_B);
    this.coins(this.x, w, this.h + 1);
    this.x += w; this.ground(3); this.x += 3;
  }
  poisonPit() {
    this.ground(2); this.x += 2;
    const w = clamp(this.ri(3, Math.round(this.p.gapMax)), 2, this.maxGap(0));
    for (let i = 0; i < w; i++) { this.col(this.x + i, Math.max(1, this.h - 2)); this.set(this.x + i, Math.max(1, this.h - 2) - 1, T.POISON); }
    this.x += w; this.ground(3); this.x += 3;
  }
  iceRun() { const len = this.ri(12, 18); this.ground(len); this.surface(this.x, len, T.ICE); this.enemy("fast", this.x + len - 4, 3); this.coins(this.x + 2, len - 4, this.h + 1.2); this.x += len; if (this.rnd() < 0.5) this.gap(); }
  icicles() {
    const len = this.ri(10, 13); this.ground(len);
    const by = Math.min(this.H - 3, this.h + 5);
    for (let i = 0; i < len; i++) this.set(this.x + i, by, T.BRICK);
    const k = this.ri(2, 3);
    for (let i = 0; i < k; i++) this.gadget("icicle", this.x + 2.5 + i * (len - 4) / k, by - 0.1);
    this.x += len;
  }
  rollers(kind: "snowball" | "coconut" | "stone") {
    const len = this.ri(14, 18); this.ground(len);
    this.gadget("roller", this.x + len - 1, this.h, { period: lerp(4.2, 2.4, this.d), power: kind === "stone" ? 1.6 : kind === "snowball" ? 1.1 : 0.8, dir: -1, w: kind === "stone" ? 3 : kind === "snowball" ? 2 : 1 });
    this.coins(this.x + 2, 5, this.h + 1.4);
    this.x += len;
  }
  quicksand() { const len = this.ri(9, 13); this.ground(len); this.surface(this.x + 2, len - 4, T.SAND); this.set(this.x + 2, this.h - 2, T.GROUND); this.x += len; }
  sandjets() {
    this.ground(2); this.x += 2;
    const rise = clamp(5, 0, 12 - this.h);
    const w = 3; this.pitFill(this.x, w); for (let i = 0; i < w; i++) this.col(this.x + i, Math.max(1, this.h - 2));
    this.gadget("sandjet", this.x + 1.5, Math.max(1, this.h - 2), { period: lerp(2.6, 1.8, this.d), phase: 0, w: 2 });
    this.x += w; if (rise >= 3) this.h += rise;
    this.ground(4); this.x += 4;
  }
  lanterns() { this.gadget("lantern", this.x + 1, this.h); this.run(this.ri(7, 10)); }
  spiders() { const len = this.ri(11, 14); this.ground(len); const k = this.ri(1, 2 + Math.round(this.d)); for (let i = 0; i < k; i++) this.gadget("spider", this.x + 3 + i * (len - 5) / k, this.h + 6, { period: lerp(3, 1.8, this.d), phase: this.rnd() * 3, h: 5 }); this.x += len; }
  crushers() {
    const len = this.ri(12, 16); this.ground(len);
    for (let i = 0; i < len; i++) for (let y = Math.min(this.H - 1, this.h + 5); y < this.H; y++) this.set(this.x + i, y, T.BRICK);
    const k = this.ri(2, 3);
    for (let i = 0; i < k; i++) this.gadget("crusher", this.x + 2.5 + i * (len - 4) / k, this.h + 5, { w: 2, h: 5, period: lerp(3.2, 2.0, this.d), phase: i * 0.9 });
    this.x += len;
  }
  lasers() { const len = this.ri(11, 15); this.ground(len); const k = this.ri(1, 3); for (let i = 0; i < k; i++) this.gadget("laser", this.x + 3 + i * (len - 5) / k, this.h, { h: 7, period: lerp(3, 2, this.d), phase: i * 0.7 }); this.x += len; }
  swings() { this.ground(2); this.x += 2; const w = this.ri(7, 9), R = 3.2; this.pitFill(this.x, w); this.plat("swing", this.x + w / 2, this.h + R - 0.2, 2.6, R, lerp(1.3, 1.8, this.d)); this.coins(this.x + 2, w - 4, this.h + 2, 1); this.x += w; this.ground(3); this.x += 3; }
  arrows() {
    const len = this.ri(12, 15); this.ground(len);
    for (let y = this.h; y < this.h + 4; y++) this.set(this.x + len, y, T.BRICK);
    this.gadget("arrow", this.x + len - 0.2, this.h + (this.rnd() < 0.5 ? 0.45 : 1.6), { period: lerp(2.8, 1.6, this.d), dir: -1, phase: this.rnd() * 2 });
    this.x += len; this.h = clamp(this.h + 4, 2, 12);
    this.set(this.x - 2, this.h - 5, T.BOUNCE);
    this.ground(4); this.x += 4;
  }
  vineClimb() {
    const len = 4; this.ground(len);
    const rise = clamp(7, 0, 13 - this.h);
    if (rise < 4) { this.x += len; return; }
    const vx = this.x + 3;
    for (let y = this.h; y < this.h + rise + 1; y++) this.set(vx, y, T.VINE);
    this.x += len; this.h += rise; this.ground(5); this.x += 5;
  }
  beatBlocks() {
    this.ground(2); this.x += 2; let px = this.x;
    const k = this.ri(3, 5);
    for (let i = 0; i < k; i++) { const g = clamp(2, 1, this.maxGap(0)); this.pitFill(px, g); px += g; for (let j = 0; j < 2; j++) this.set(px + j, this.h - 1, i % 2 ? T.BEAT_B : T.BEAT_A); this.pitFill(px, 2); this.coins(px, 2, this.h + 1); px += 2; }
    this.pitFill(px, 2); px += 2; this.x = px; this.ground(3); this.x += 3;
  }
  lavaStones() {
    this.ground(2); this.x += 2;
    const k = this.ri(2, 4); let px = this.x; const was = this.liquid; this.liquid = "lava";
    for (let i = 0; i < k; i++) { const g = clamp(this.ri(2, 3), 1, this.maxGap(0)); this.pitFill(px, g); px += g; const w = this.ri(1, 2); for (let j = 0; j < w; j++) this.col(px + j, this.h); px += w; }
    const g = clamp(this.ri(2, 3), 1, this.maxGap(0)); this.pitFill(px, g); px += g;
    this.liquid = was; this.x = px; this.ground(3); this.x += 3;
  }
  geysers() { const len = this.ri(12, 16); this.ground(len); const k = this.ri(1, 3); for (let i = 0; i < k; i++) this.gadget("geyser", this.x + 3 + i * (len - 5) / k, this.h, { h: 6, period: lerp(3.4, 2.2, this.d), phase: i * 1.1 }); this.x += len; }
  rockRain() { const len = this.ri(12, 16); this.ground(len); this.gadget(this.has("meteor") ? "meteor" : "rockfall", this.x + 2, this.h, { w: len - 4, period: lerp(2.6, 1.3, this.d) }); this.x += len; }
  cannons() { const len = this.ri(13, 16); this.ground(len); for (let y = this.h; y < this.h + 2; y++) this.set(this.x + len - 1, y, T.BLOCK); this.gadget("cannon", this.x + len - 1, this.h + 2.4, { dir: -1, period: lerp(3, 1.8, this.d), phase: this.rnd() }); this.x += len; }

  featurePiece(f: Feature) {
    switch (f) {
      case "lift": return this.liftGap(); case "vlift": return this.liftGap(true); case "crumble": return this.crumbleBridge();
      case "bonfire": return this.fires(); case "drip": return this.drips(); case "water": return this.pool(this.isl.id === "lagoon"); case "current": return this.pool(true);
      case "wind": return this.windGap(); case "cloud": return this.cloudSteps(); case "caramel": return this.caramel(); case "spring": return this.springUp();
      case "conveyor": return this.belts(); case "switch": return this.switchGate(); case "poison": return this.poisonPit(); case "ice": return this.iceRun();
      case "icicle": return this.icicles(); case "snowball": return this.rollers("snowball"); case "coconut": return this.rollers("coconut"); case "stone": return this.rollers("stone");
      case "quicksand": return this.quicksand(); case "sandjet": return this.sandjets(); case "dark": return this.lanterns();
      case "spider": return this.spiders(); case "crusher": return this.crushers(); case "laser": return this.lasers(); case "swing": return this.swings();
      case "arrow": return this.arrows(); case "climb": return this.vineClimb(); case "beat": return this.beatBlocks();
      case "lava": return this.lavaStones(); case "geyser": return this.geysers(); case "rockfall": case "meteor": return this.rockRain(); case "rocking": return this.liftGap();
      case "cannon": return this.cannons(); case "lowg": return this.gap(true); case "breakable": return this.breakRoom(); case "squeeze": return this.squeeze();
      case "spikes": return this.spikes();
      default: return this.run();
    }
  }
  basicPiece() {
    const r = this.rnd();
    if (r < 0.18) return this.gap();
    if (r < 0.32) return this.float();
    if (r < 0.44) return this.blocks();
    if (r < 0.56) return this.steps();
    if (r < 0.68) return this.hill();
    if (r < 0.76 && this.zone > 1) return this.spikes();
    if (r < 0.84) { const len = 6; this.ground(len); this.pot(this.x + 3, this.h, this.potItem()); this.x += len; return; }
    return this.run();
  }
  /** running ground for a chase: hops and steps you can take at full speed (no fiddly floating planks or lifts) */
  chasePiece() { const r = this.rnd(); if (r < 0.35) return this.gap(); if (r < 0.6) return this.steps(); if (r < 0.85) return this.hill(); return this.run(); }
  /** a platforming piece: the zone's own ideas or a basic one */
  terrain() { if (this.feats.length && this.rnd() < 0.45) this.featurePiece(this.pick(this.feats)); else this.basicPiece(); }
  /** a hidden Rain Drop; `chase` keeps out the floating-plank version (no time to line up small hops with a wave behind) */
  secretPiece(i: number, chase = false) { const k = (i + this.ri(0, 2)) % 3; if (k === 0 || (chase && !(k === 1 && this.h >= 4))) this.bounceUp(true); else if (k === 1 && this.h >= 4) this.breakRoom(true); else { this.float(); if (this.drops < i + 1) this.bounceUp(true); } }
  checkpoint() { this.ground(6); this.gadget("checkpoint", this.x + 2.5, this.h); this.checkpoints.push({ x: this.x + 2.5, y: this.h }); this.crate(this.x + 4.5, this.h, "bombs"); this.x += 6; }
  /** the exit door (open when the goal is done), then the gong */
  door() { this.ground(3); this.x += 3; for (let y = this.h; y < this.H; y++) this.set(this.x, y, T.DOOR); this.ground(1); this.x += 1; }
  gongEnd() {
    this.ground(14);
    this.coins(this.x + 1, 5, this.h + 1.3, 1);
    this.gadget("gong", this.x + 9, this.h, { h: 6 });
    const goal = { x: this.x + 9, y: this.h };
    this.x += 14;
    return goal;
  }
}

// ------------------------------------------------------------------ the concepts
interface Ctx { g: Gen; s: number; d: number; isl: Island; concept: Concept; need: number }
type Built = { goal: { x: number; y: number }; start?: { x: number; y: number }; extra?: Partial<Stage> };

/** a section of fighting and platforming, ending in a checkpoint */
function section(c: Ctx, k: number, setPieces = 1) {
  const g = c.g;
  const order: ("squad" | "terrain" | "set")[] = [];
  for (let i = 0; i < k; i++) order.push(i % 2 === 0 ? "squad" : "terrain");
  for (let i = 0; i < setPieces; i++) order.splice(1 + Math.floor(g.rnd() * order.length), 0, "set");
  for (const o of order) { if (o === "squad") g.squad(); else if (o === "terrain") g.terrain(); else g.setPiece(); }
}
function frontline(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    section(c, 4 + Math.round(c.d * 2), 1 + (c.d > 0.35 ? 1 : 0));
    if (sec === 1 || sec === n - 2) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  g.rest();
  return { goal: g.gongEnd() };
}
function ambush(c: Ctx): Built {
  const g = c.g, n = Math.max(3, g.p.sections - 1);
  for (let sec = 0; sec < n; sec++) {
    section(c, 3, 1);
    g.gateRoom(g.waves(2 + (c.d > 0.3 ? 1 : 0), 3 + Math.round(c.d * 3)));
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd() };
}
function rooftops(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  g.squad(12, 2);
  for (let sec = 0; sec < n; sec++) {
    const roofs = 5 + Math.round(c.d * 3);
    for (let r = 0; r < roofs; r++) {
      // a building: brick from the street to its roof; the pit between buildings is the street far below
      const dh = clamp(g.pick([-2, -1, 0, 1, 2, 2]), 4 - g.h, 13 - g.h);
      const gap = clamp(g.ri(2, 4), 2, g.maxGap(dh));
      g.pitFill(g.x, gap); g.x += gap; g.h += dh;
      const w = g.ri(7, 13);
      g.ground(w, T.BRICK);
      for (let i = 0; i < w; i++) g.set(g.x + i, g.h - 1, T.BLOCK);
      const k = clamp(Math.round(g.p.foes * 0.6 + g.rnd()), 1, 4);
      for (let i = 0; i < k; i++) g.enemy(i === 0 && g.rnd() < 0.4 ? "air" : g.role(), g.x + 2 + (i + 0.5) * ((w - 3) / k), 1.5);
      // a chimney turret or a crate on some roofs
      if (g.rnd() < 0.25 && w > 8) { g.set(g.x + w - 3, g.h, T.BRICK); g.foe(g.armyHas.has("wallTurret") ? "wallTurret" : g.kind("gunner"), g.x + w - 2.5, g.h + 1, 0.2); }
      else if (g.rnd() < 0.2) g.crate(g.x + 1.5, g.h);
      if (g.rnd() < 0.5) g.coins(g.x + 1, Math.min(4, w - 2), g.h + 1.4, 0.8);
      if (r === 2 && g.drops < 3) { const ly = Math.min(g.H - 3, g.h + 5); for (let i = 0; i < 3; i++) g.set(g.x + 2 + i, ly, T.ONEWAY); g.set(g.x + 1, g.h - 1, T.BOUNCE); g.drop(g.x + 3.5, ly + 1.6); }
      g.x += w;
    }
    if (sec < n - 1) { g.h = clamp(g.h, 4, 12); g.checkpoint(); }
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd() };
}
function collapse(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  g.run(10);
  for (let sec = 0; sec < n; sec++) {
    const spans = 3 + Math.round(c.d * 2);
    for (let k = 0; k < spans; k++) {
      // a plank bridge over the drop, a solid pier, a few on the planks
      const w = g.ri(14, 22);
      g.pitFill(g.x, w);
      for (let i = 0; i < w; i++) g.set(g.x + i, g.h - 1, T.ONEWAY);
      // gaps in the bridge to hop
      if (c.d > 0.15) { const gx = g.x + g.ri(5, w - 7), gw = clamp(g.ri(2, 3), 2, g.maxGap(0)); for (let i = 0; i < gw; i++) g.set(gx + i, g.h - 1, T.EMPTY); }
      const fk = clamp(Math.round(g.p.foes * 0.5 + g.rnd()), 1, 3);
      for (let i = 0; i < fk; i++) { const fx = g.x + 4 + i * ((w - 6) / fk); if (g.get(Math.floor(fx), g.h - 1) === T.ONEWAY) g.enemy(g.rnd() < 0.5 ? "fast" : "grunt", fx, 1.5); }
      if (g.roles.air.length && g.rnd() < 0.5) g.enemy("air", g.x + w / 2, 4);
      g.coins(g.x + 2, 5, g.h + 1.6, 1);
      g.x += w;
      const pier = g.ri(4, 6); g.ground(pier); if (g.rnd() < 0.3) g.crate(g.x + 2, g.h); g.x += pier;
    }
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) { g.ground(6); g.drop(g.x + 3, g.h + 3); g.set(g.x + 2, g.h - 1, T.BOUNCE); g.x += 6; }
  return { goal: g.gongEnd(), extra: { rules: { chase: { speed: lerp(4.2, 5.6, c.d), delay: 3.5, kind: "collapse" } } } };
}
function rescue(c: Ctx): Built {
  const g = c.g, n = g.p.sections, need = c.need;
  let placed = 0;
  for (let sec = 0; sec < n; sec++) {
    section(c, 3, 1);
    // cages in the section: on the ground under guard, up on a ledge, behind cracked blocks
    const here = Math.ceil((need - placed) / (n - sec));
    for (let i = 0; i < here; i++) {
      const style = (placed + sec) % 3, len = 12; g.ground(len);
      if (style === 0) { g.targets.push({ kind: "cage", x: g.x + 7, y: g.h, hp: 5, id: g.id++ }); g.enemy("grunt", g.x + 4, 1.5); g.enemy("gunner", g.x + 10, 1); }
      else if (style === 1) { const ly = g.h + 3; for (let k = 0; k < 4; k++) g.set(g.x + 5 + k, ly - 1, T.ONEWAY); g.targets.push({ kind: "cage", x: g.x + 7, y: ly, hp: 5, id: g.id++ }); g.enemy("air", g.x + 9, 3); }
      else { for (let y = g.h; y < g.h + 2; y++) g.set(g.x + 4, y, T.BREAK); g.targets.push({ kind: "cage", x: g.x + 7, y: g.h, hp: 5, id: g.id++ }); g.enemy(g.role(), g.x + 9.5, 1); }
      g.x += len; placed++;
    }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  g.door();
  return { goal: g.gongEnd() };
}
function bombsquad(c: Ctx): Built {
  const g = c.g, n = c.need;
  for (let k = 0; k < n; k++) {
    section(c, 2 + (k % 2), 1);
    // the pump yard: the pump, a bomb crate, guards (and a hive later on)
    const len = 20; g.ground(len);
    g.targets.push({ kind: "pump", x: g.x + 12, y: g.h, hp: Math.round(18 * (1 + c.d)), id: g.id++ });
    g.crate(g.x + 3, g.h, "bombs");
    g.enemy("gunner", g.x + 16, 1); g.enemy("grunt", g.x + 8, 2);
    if (g.armyHas.has("dustHive") && k % 2 === 1) g.foe("dustHive", g.x + 18, g.h, 0, false);
    else if (g.roles.heavy.length) g.enemy("heavy", g.x + 15, 1.5);
    g.x += len;
    if (k === 1) g.secretPiece(g.drops);
    if (k < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  g.door();
  return { goal: g.gongEnd() };
}
function keyhunt(c: Ctx): Built {
  const g = c.g;
  for (let k = 0; k < 3; k++) {
    section(c, 2, 1);
    // a key vault: a stepped ziggurat with guards on the steps and the crystal key on top
    g.ground(4); g.x += 4;
    const base = g.h, steps = 4 + (c.d > 0.4 ? 1 : 0);
    for (let i = 1; i <= steps; i++) { g.h = base + i * 2; g.ground(3); if (i % 2 === 0) g.enemy(g.rnd() < 0.5 ? "gunner" : "grunt", g.x + 1.5, 0.5); g.x += 3; }
    g.ground(6);
    g.item("key", g.x + 3, g.h + 0.9);
    if (g.armyHas.has("wallTurret")) g.foe("wallTurret", g.x + 5, g.h, 0.2); else g.enemy("gunner", g.x + 5, 0.5);
    g.x += 6;
    for (let i = steps - 1; i >= 0; i--) { g.h = base + i * 2; g.ground(3); g.x += 3; }
    g.h = base; g.ground(6); g.enemy(g.role(), g.x + 3, 2); g.coins(g.x + 1, 4, g.h + 1.3); g.x += 6;
    if (k === 1) g.secretPiece(g.drops);
    if (k < 2) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  g.door();
  return { goal: g.gongEnd() };
}
function vault(c: Ctx): Built {
  const g = c.g;
  for (let k = 0; k < 9; k++) {
    const pc = k % 4;
    if (pc === 0) g.float(); else if (pc === 1) g.blocks(); else if (pc === 2) g.bounceUp(k === 2 || k === 6); else { g.ground(14); g.enemy("grunt", g.x + 7, 3); g.coins(g.x + 1, 12, g.h + 1.3, 1.2); g.x += 14; }
    g.coins(g.x - 6, 5, g.h + 2.6, 1.5);
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd(), extra: { vault: 60 } };
}
function arena(c: Ctx): Built {
  const g = c.g;
  g.h = 4; g.x = 0;
  const W = 40;
  for (let x = 0; x < W; x++) g.col(x, g.h);
  for (let y = g.h; y < g.H; y++) { for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK); }
  for (const [lx, ly] of [[5, 7], [W - 12, 7], [16, 11]] as const) for (let i = 0; i < 7; i++) g.set(lx + i, ly, T.ONEWAY);
  g.crate(4, g.h); g.crate(W - 5, g.h, "bombs"); g.crate(19.5, 12);
  const waves = g.waves(c.need, 3 + Math.round(c.d * 3));
  g.gates.push({ id: g.id++, x0: 1, x1: W - 2, floor: g.h, top: g.H - 1, waves });
  g.drop(19.5, 15.5); g.drop(8, 10); g.drop(W - 9, 10);
  g.x = W;
  return { goal: { x: W / 2, y: g.h }, start: { x: 5, y: g.h } };
}
function holdwell(c: Ctx): Built {
  const g = c.g;
  g.h = 4; g.x = 0;
  const W = 72, mid = W / 2;
  for (let x = 0; x < W; x++) g.col(x, g.h);
  for (let y = g.h; y < g.H; y++) { for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK); }
  for (const [lx, ly] of [[mid - 16, 8], [mid + 8, 8], [mid - 4, 12], [6, 11], [W - 13, 11]] as const) for (let i = 0; i < 8; i++) g.set(lx + i, ly, T.ONEWAY);
  g.crate(mid - 12, 9); g.crate(mid + 12, 9, "bombs"); g.crate(mid, 13);
  g.drop(9, 12.6); g.drop(W - 10, 12.6); g.drop(mid, 16);
  g.x = W;
  const kinds: EnemyKind[] = [...g.roles.grunt, ...g.roles.fast, ...g.roles.heavy].filter((k) => BEAST[k].b !== "turret");
  const zt = clamp(c.isl.n, 1, 20);
  return {
    goal: { x: mid, y: g.h }, start: { x: mid - 3, y: g.h },
    extra: { defend: { x: mid, y: g.h, hp: 16, time: Math.round(55 + Math.min(zt, 8) * 6 + c.d * 20), every: lerp(2.6, 1.3, c.d), kinds: kinds.length ? kinds : ["dustie"], fly: g.roles.air, spawnL: 3, spawnR: W - 4 } },
  };
}
/** stage 10 and 20: an approach, then the arena (the sub fights in a pool) */
function fight(c: Ctx, kind: "machine" | "boss"): Built {
  const g = c.g;
  section(c, 3, 1);
  while (g.drops < 3) g.secretPiece(g.drops);
  g.checkpoint();
  const bossKind = kind === "machine" ? c.isl.machine.kind : c.isl.boss.kind;
  const water = bossKind === "sub" || bossKind === "puffer";
  g.ground(4); g.x += 4;
  const x0 = g.x, aw = 34;
  let floor = g.h, surf: number | undefined;
  if (water) {
    // a pool across the arena, ledges to stand on above it
    const bottom = 1; surf = g.h;
    for (let i = 0; i < aw; i++) { g.col(g.x + i, bottom); for (let y = bottom; y < surf; y++) g.set(g.x + i, y, T.WATER); }
    for (let i = 0; i < 3; i++) g.col(g.x + i, surf + 1);
    for (let i = aw - 3; i < aw; i++) g.col(g.x + i, surf + 1);
    for (const lx of [6, 14, 22]) for (let i = 0; i < 5; i++) g.set(g.x + lx + i, surf, T.ONEWAY);
    for (const lx of [10, 18]) for (let i = 0; i < 4; i++) g.set(g.x + lx + i, surf + 4, T.ONEWAY);
    floor = bossKind === "sub" ? bottom : surf + 1;
  } else {
    g.ground(aw);
    for (const lx of [5, aw - 9]) for (let i = 0; i < 4; i++) g.set(g.x + lx + i, g.h + 3, T.ONEWAY);
    if (bossKind === "copter" || bossKind === "gull" || bossKind === "moth") for (let i = 0; i < 6; i++) g.set(g.x + 14 + i, g.h + 6, T.ONEWAY);
  }
  g.crate(x0 + 2, water ? (surf ?? g.h) + 1 : g.h, "bombs"); g.crate(x0 + aw - 3, water ? (surf ?? g.h) + 1 : g.h);
  g.x += aw;
  for (let y = 0; y < g.H; y++) g.set(g.x, y, T.WALL);
  g.ground(1); g.x += 1;
  return { goal: { x: x0 + aw / 2, y: floor }, extra: { boss: { kind: bossKind, x0, x1: x0 + aw, floor, hp: 0, water: water ? surf : undefined } } };
}

// -------------------------------------------------------------- vertical concepts
function tower(c: Ctx): Built {
  const g = c.g, W = g.W, H = g.H;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK);
  for (let x = 2; x < W - 2; x++) for (let y = 0; y < 3; y++) g.set(x, y, T.GROUND);
  g.h = 3;
  let cx = 8, dirx = 1, y = 3, lastCp = 3;
  const top = H - 10;
  let floorN = 0;
  while (y + 3 < top) {
    y += 3; floorN++;
    if (floorN % 6 === 0) {
      // a wide floor: a room with a squad and holes to jump up through
      const holeA = g.ri(4, W - 8);
      for (let x = 2; x < W - 2; x++) if (x < holeA || x > holeA + 2) g.set(x, y - 1, T.ONEWAY);
      const k = clamp(Math.round(g.p.foes), 2, 5);
      for (let i = 0; i < k; i++) { const kd = g.kind(g.role()); const b = BEAST[kd]; const fly = b.b === "fly" || b.b === "drone" || b.b === "bomber" || b.b === "dive"; g.foe(kd, 4 + i * ((W - 8) / k), fly ? y + 3 : y, 2.5); }
      g.coins(5, 5, y + 1.3);
      if (y - lastCp >= 15) { g.gadget("checkpoint", 4.5, y); g.checkpoints.push({ x: 4.5, y }); g.crate(7, y, "bombs"); lastCp = y; }
      continue;
    }
    // the staircase drifts side to side; each ledge overlaps the last so a jump straight up lands
    const w = g.ri(5, 8);
    cx += dirx * g.ri(3, 5);
    if (cx + w / 2 > W - 3) { cx = W - 3 - w / 2; dirx = -1; } else if (cx - w / 2 < 2) { cx = 2 + w / 2; dirx = 1; }
    const lx = Math.round(cx - w / 2);
    for (let i = 0; i < w; i++) g.set(lx + i, y - 1, T.ONEWAY);
    if (g.rnd() < 0.45) g.coins(lx + 1, Math.min(3, w - 2), y + 1.2);
    // windows: turrets on the walls, a gunner on the ledge, drones in the shaft
    const r = g.rnd();
    if (r < 0.3) { const side = cx < W / 2 ? W - 3 : 2; for (let i = 0; i < 2; i++) g.set(side === 2 ? 2 + i : W - 4 + i, y - 1, T.BRICK); g.foe(g.armyHas.has("wallTurret") ? "wallTurret" : g.kind("gunner"), side === 2 ? 3 : W - 3, y, 0.2); }
    else if (r < 0.55) g.foe(g.kind(g.rnd() < 0.5 ? "gunner" : "grunt"), lx + w / 2, y, Math.max(0.5, w / 2 - 1));
    else if (r < 0.7 && g.roles.air.length) g.foe(g.kind("air"), W / 2, y + 2, 5);
    if (g.rnd() < 0.08) g.crate(lx + 1, y);
    if (g.drops < 3 && floorN % 9 === 4) { const sx = cx < W / 2 ? W - 5 : 3; for (let i = 0; i < 2; i++) g.set(sx + i, y + 1, T.ONEWAY); g.drop(sx + 1, y + 3); }
  }
  // the top: a roof with the gong
  y += 3;
  for (let x = 2; x < W - 2; x++) g.set(x, y - 1, T.ONEWAY);
  g.gadget("gong", W / 2 + 4, y, { h: 6 });
  g.coins(W / 2 - 4, 6, y + 1.5, 1);
  while (g.drops < 3) g.drop(5 + g.drops * 4, y + 2);
  g.x = W;
  return { goal: { x: W / 2 + 4, y }, start: { x: 5, y: 3 } };
}
function dive(c: Ctx): Built {
  const g = c.g, W = g.W, H = g.H;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK);
  for (let x = 2; x < W - 2; x++) for (let y = 0; y < 2; y++) g.set(x, y, T.GROUND);
  // floors every 7 tiles from the top down: a hole or a cracked patch to get through (↓ + FIRE shoots down; stomp works too)
  const step = 7;
  let y = H - 8, k = 0, holeX = 6;
  const startY = y;
  for (let x = 2; x < 9; x++) g.set(x, y - 1, T.BRICK);
  let lastCp = y;
  while (y - step > 4) {
    const fy = y - step; k++;
    holeX = holeX < W / 2 ? g.ri(W / 2 + 2, W - 7) : g.ri(3, W / 2 - 5);
    const cracked = g.rnd() < 0.45;
    for (let x = 2; x < W - 2; x++) {
      const inHole = x >= holeX && x < holeX + 3;
      g.set(x, fy - 1, inHole ? (cracked ? T.BREAK : T.EMPTY) : T.BRICK);
    }
    // spikes on part of the floor, never under the last hole
    if (c.d > 0.25 && g.rnd() < 0.4) { const sx = holeX < W / 2 ? W - 8 : 4; for (let i = 0; i < 3; i++) if (g.get(sx + i, fy - 1) === T.BRICK) g.set(sx + i, fy, T.SPIKES); }
    // who's waiting on this floor (and hanging under the one above)
    const n = clamp(Math.round(g.p.foes * 0.7 + g.rnd()), 1, 4);
    for (let i = 0; i < n; i++) { const fx = 4 + g.rnd() * (W - 8); if (Math.abs(fx - holeX - 1.5) > 2.5) g.foe(g.kind(g.rnd() < 0.5 ? "grunt" : "gunner"), fx, fy, 2); }
    if (g.armyHas.has("ceilTurret") && g.rnd() < 0.5) g.foe("ceilTurret", holeX < W / 2 ? W - 6 : 5, y - 1 - 0.9, 0.2);
    if (g.roles.air.length && g.rnd() < 0.4) g.foe(g.kind("air"), W / 2, fy + 3, 4);
    g.coins(holeX, 3, y - 2.5);
    if (g.rnd() < 0.15) g.crate(holeX < W / 2 ? W - 5 : 4, fy);
    if (lastCp - fy >= 20) { const cx = holeX < W / 2 ? W - 6 : 5; g.gadget("checkpoint", cx, fy); g.checkpoints.push({ x: cx, y: fy }); lastCp = fy; }
    if (g.drops < 3 && k % 5 === 2) { const sx = holeX < W / 2 ? W - 5 : 3; g.drop(sx + 0.5, fy + 2.5); }
    y = fy;
  }
  // the bottom: the gong
  g.gadget("gong", W / 2, 2, { h: 6 });
  g.coins(W / 2 - 3, 6, 3.5, 1);
  while (g.drops < 3) g.drop(4 + g.drops * 3, 3.5);
  g.x = W;
  return { goal: { x: W / 2, y: 2 }, start: { x: 4, y: startY } };
}

// -------------------------------------------------------------- rides
function minecart(c: Ctx): Built {
  const g = c.g;
  g.h = 5; g.ground(10); g.x = 10;
  let ry = 6;
  const rail = (x0: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const x = x0 + i;
      g.set(x, ry - 1, T.RAIL);
      if ((x % 5) === 0) for (let y = 0; y < ry - 1; y++) g.set(x, y, T.BRICK);
    }
  };
  const total = Math.round(lerp(360, 520, c.d));
  let cps = 0;
  const start = g.x;
  rail(g.x - 10, 10);
  while (g.x - start < total) {
    const len = g.ri(12, 22);
    rail(g.x, len);
    const r = g.rnd();
    // what's on this stretch: a low beam to duck, guards up on a ledge, a runner on the rails, a coin arc
    if (r < 0.22 && c.d > 0.08) { const bx = g.x + g.ri(6, len - 4); g.set(bx, ry + 1, T.BRICK); for (let y = ry + 2; y < g.H; y++) g.set(bx, y, T.BRICK); g.coins(bx - 1, 3, ry + 0.5); }
    else if (r < 0.5) { const lx = g.x + g.ri(3, Math.max(3, len - 7)), ly = Math.min(g.H - 3, ry + 5); for (let i = 0; i < 5; i++) g.set(lx + i, ly - 1, T.BRICK); g.foe(g.armyHas.has("wallTurret") && g.rnd() < 0.5 ? "wallTurret" : g.kind("gunner"), lx + 2.5, ly, 0.5); }
    else if (r < 0.66) g.foe(g.kind("fast"), g.x + len - 2, ry, 2);
    else if (r < 0.82 && g.roles.air.length) g.foe(g.kind("air"), g.x + len / 2, ry + 5, 4);
    else g.coins(g.x + 2, len - 4, ry + 1.6, 1.2);
    g.x += len;
    // the next rail: a gap to jump, maybe up or down
    const dh = clamp(g.pick([-2, -1, 0, 0, 1, 2]), 4 - ry, 12 - ry);
    const gap = clamp(g.ri(2, 3 + Math.round(c.d * 2)), 2, g.maxGap(dh));
    g.coins(g.x, gap, ry + 2.2, 1);
    g.x += gap; ry += dh;
    if ((g.x - start) / total > (cps + 1) / 4 && cps < 3) { rail(g.x, 8); g.gadget("checkpoint", g.x + 3, ry); g.checkpoints.push({ x: g.x + 3, y: ry }); g.x += 8; cps++; }
    if (g.drops < 3 && g.rnd() < 0.12) g.drop(g.x - gap / 2, ry + 4.2);
  }
  rail(g.x, 6); g.x += 6;
  // off the cart at the station
  g.h = ry; g.ground(16);
  g.gadget("gong", g.x + 9, g.h, { h: 6 });
  const goal = { x: g.x + 9, y: g.h };
  while (g.drops < 3) g.drop(g.x + 3 + g.drops * 2, g.h + 3);
  g.x += 16;
  return { goal, start: { x: 3, y: 6 }, extra: { ride: { kind: "cart", speed: lerp(7.2, 8.6, c.d) } } };
}
function raft(c: Ctx): Built {
  const g = c.g;
  const surf = 5;
  const water = (x0: number, len: number) => { for (let i = 0; i < len; i++) { g.set(x0 + i, 0, T.GROUND); for (let y = 1; y < surf; y++) g.set(x0 + i, y, T.WATER); } };
  const total = Math.round(lerp(380, 540, c.d));
  water(0, total + 40);
  g.x = 10;
  let cps = 0;
  while (g.x < total) {
    const len = g.ri(10, 18);
    const r = g.rnd();
    // logs to jump, a low branch to duck, rocks with guards, flyers, jumping fish
    if (r < 0.3) { const lx = g.x + g.ri(4, len - 3); g.set(lx, surf, T.BLOCK); if (c.d > 0.3 && g.rnd() < 0.4) g.set(lx + 1, surf, T.BLOCK); g.coins(lx - 1, 3, surf + 2.6, 0.8); }
    else if (r < 0.45 && c.d > 0.1) { const bx = g.x + g.ri(4, len - 3); for (let y = surf + 1; y < g.H; y++) g.set(bx, y, T.BRICK); g.coins(bx - 1, 3, surf + 0.5); }
    else if (r < 0.72) { const rx = g.x + g.ri(3, Math.max(3, len - 6)), ry = surf + g.ri(4, 6); for (let i = 0; i < 4; i++) g.set(rx + i, ry - 1, T.BRICK); g.foe(g.rnd() < 0.5 && g.armyHas.has("mortar") ? "mortar" : g.kind("gunner"), rx + 2, ry, 0.5); }
    else if (r < 0.86 && g.roles.air.length) g.foe(g.kind("air"), g.x + len / 2, surf + 5, 4);
    else if (g.swim.length) g.foe(g.pick(g.swim), g.x + len / 2, 2, 3);
    else g.coins(g.x + 2, len - 4, surf + 1.6, 1);
    g.x += len;
    if (g.x / total > (cps + 1) / 4 && cps < 3) { g.gadget("checkpoint", g.x + 2, surf); g.checkpoints.push({ x: g.x + 2, y: surf }); g.x += 6; cps++; }
    if (g.drops < 3 && g.rnd() < 0.1) g.drop(g.x - 4, surf + 4);
  }
  // the landing
  g.h = surf + 1;
  g.ground(18);
  g.gadget("gong", g.x + 10, g.h, { h: 6 });
  const goal = { x: g.x + 10, y: g.h };
  while (g.drops < 3) g.drop(g.x + 3 + g.drops * 2, g.h + 3);
  g.x += 18;
  return { goal, start: { x: 4, y: surf }, extra: { ride: { kind: "raft", speed: lerp(6.4, 7.8, c.d) } } };
}


// -------------------------------------------------------------- Phase B concepts
/** a run made only of pieces a slow cart can follow (no pits, no walls) */
function flatSection(c: Ctx, k: number) {
  const g = c.g;
  for (let i = 0; i < k; i++) {
    const r = g.rnd();
    if (r < 0.45) g.squad();
    else if (r < 0.6 && g.roles.air.length) g.skyRaid();
    else if (r < 0.72 && (g.armyHas.has("wallTurret") || g.d > 0.2)) g.turretNest();
    else if (r < 0.82 && g.armyHas.has("dustHive")) g.hiveYard();
    else if (r < 0.9) g.mineField();
    else g.run(g.ri(8, 12));
  }
}
function train(c: Ctx): Built {
  const g = c.g;
  g.h = 6; g.ground(12); g.coins(4, 5, g.h + 1.4, 1); g.x = 12;
  const cars = 14 + Math.round(c.d * 10);
  for (let k = 0; k < cars; k++) {
    // the gap between cars, sometimes with a coupling plank
    const gap = g.ri(2, 3); if (g.rnd() < 0.4) g.set(g.x + Math.floor(gap / 2), g.h - 1, T.ONEWAY); g.x += gap;
    const len = g.ri(10, 16), x0 = g.x;
    for (let i = 0; i < len; i++) { for (let y = 2; y < g.h - 1; y++) g.set(x0 + i, y, T.BRICK); g.set(x0 + i, g.h - 1, T.BLOCK); }
    for (const wx of [x0 + 1, x0 + len - 2]) g.set(wx, 1, T.BLOCK);
    // tunnels: a low beam to duck, or a low roof you mustn't jump under
    if (k > 1 && g.rnd() < 0.3) { const bx = x0 + g.ri(4, len - 4); for (let y = g.h + 1; y < g.H; y++) g.set(bx, y, T.BRICK); g.coins(bx - 1, 3, g.h + 0.5); }
    else if (k > 2 && g.rnd() < 0.2) { for (let i = 2; i < len - 2; i++) for (let y = g.h + 2; y < g.H; y++) g.set(x0 + i, y, T.BRICK); }
    const n = clamp(Math.round(g.p.foes * 0.6 + g.rnd()), 1, 4);
    for (let i = 0; i < n; i++) { const r = i === 0 && g.rnd() < 0.35 ? "air" : g.role(); const kd = g.kind(r), b = BEAST[kd]; const fly = b.b === "fly" || b.b === "drone" || b.b === "bomber" || b.b === "dive" || b.b === "copter"; g.foe(kd, x0 + 2 + (i + 0.5) * ((len - 3) / n), fly ? g.h + g.ri(3, 5) : g.h, fly ? 4 : 1.5); }
    if (g.rnd() < 0.2) g.crate(x0 + 1.5, g.h);
    if (g.rnd() < 0.5) g.coins(x0 + 2, Math.min(5, len - 4), g.h + 1.4, 0.8);
    if (k % 5 === 4 && k < cars - 1) { g.gadget("checkpoint", x0 + 2.5, g.h); g.checkpoints.push({ x: x0 + 2.5, y: g.h }); }
    if (g.drops < 3 && k % 4 === 2) g.drop(x0 + len / 2, g.h + 3.2);
    g.x += len;
  }
  g.x += 2;
  g.ground(16);
  g.gadget("gong", g.x + 10, g.h, { h: 6 });
  const goal = { x: g.x + 10, y: g.h };
  while (g.drops < 3) g.drop(g.x + 3 + g.drops * 2, g.h + 3);
  g.x += 16;
  return { goal, start: { x: 3, y: g.h }, extra: { rules: { wind: -1.2, train: true } } };
}
function glider(c: Ctx): Built {
  const g = c.g;
  const total = Math.round(lerp(380, 520, c.d));
  g.x = 14;
  let cps = 0;
  while (g.x < total) {
    const r = g.rnd();
    if (r < 0.45) {
      // a floating rock island, maybe with a turret or a sniper on top
      const w = g.ri(3, 7), h = g.ri(2, 4), y0 = g.ri(2, g.H - 8);
      for (let i = 0; i < w; i++) for (let y = y0; y < y0 + h; y++) g.set(g.x + i, y, T.BLOCK);
      if (g.rnd() < 0.5) g.foe(g.armyHas.has("laserSniper") && g.rnd() < 0.5 ? "laserSniper" : g.armyHas.has("wallTurret") ? "wallTurret" : g.kind("gunner"), g.x + w / 2, y0 + h, 0.2);
      g.coins(g.x, w, y0 + h + 1.6, 0.8);
      g.x += w + g.ri(5, 9);
    } else if (r < 0.85 && g.roles.air.length) {
      const n = clamp(Math.round(1 + c.d * 2.5 + g.rnd()), 1, 4);
      for (let i = 0; i < n; i++) g.foe(g.kind("air"), g.x + i * 3, g.ri(5, g.H - 6), 3);
      g.x += g.ri(9, 13);
    } else { g.coins(g.x, 8, g.ri(6, g.H - 6), 2); g.x += 10; }
    if (g.x / total > (cps + 1) / 4 && cps < 3) { g.gadget("checkpoint", g.x, 10); g.checkpoints.push({ x: g.x, y: 10 }); cps++; g.x += 6; }
    if (g.drops < 3 && g.rnd() < 0.1) { g.drop(g.x - 3, g.ri(4, g.H - 5)); }
  }
  g.x += 8;
  g.gadget("gong", g.x, 2, { h: g.H - 4 });
  const goal = { x: g.x, y: 2 };
  while (g.drops < 3) g.drop(g.x - 6 - g.drops * 2, 8 + g.drops * 3);
  g.x += 10;
  return { goal, start: { x: 4, y: 10 }, extra: { ride: { kind: "glider", speed: lerp(6, 7.4, c.d) } } };
}
/** the tank and the mech: a heavy army, and walls of cracked blocks to blast through */
function vehicle(c: Ctx, kind: "tank" | "mech"): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    for (let k = 0; k < 4; k++) {
      const r = g.rnd();
      if (r < 0.4) g.squad(undefined, clamp(Math.round(g.p.foes * 1.2), 2, 7));
      else if (r < 0.6) { g.ground(10); for (let y = g.h; y < g.h + 4; y++) for (const dx of [5, 6]) g.set(g.x + dx, y, T.BREAK); g.enemy("gunner", g.x + 8.5, 1); g.x += 10; }
      else if (r < 0.75 && g.roles.heavy.length) { g.ground(14); g.enemy("heavy", g.x + 7, 3); g.enemy("heavy", g.x + 11, 2); g.x += 14; }
      else if (r < 0.88) g.setPiece();
      else g.terrain();
    }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd(), extra: { ride: { kind, speed: 0 } } };
}
function elevator(c: Ctx): Built {
  const g = c.g, W = g.W, H = g.H;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK);
  for (let x = 2; x < W - 2; x++) for (let y = 0; y < 3; y++) g.set(x, y, T.GROUND);
  const top = H - 10, range = top - 3;
  g.plats.push({ kind: "elevator", x: W / 2, y: 3, w: W - 4, range, speed: lerp(0.72, 0.9, c.d), phase: 0, id: g.id++ });
  // ledges on the shaft walls with the Dust Army, flyers in the shaft
  for (let y = 9, k = 0; y < top - 2; y += g.ri(5, 7), k++) {
    const left = k % 2 === 0, lx = left ? 2 : W - 4;
    for (let i = 0; i < 2; i++) g.set(lx + i, y - 1, T.BRICK);
    const kd: EnemyKind = g.armyHas.has("laserSniper") && g.rnd() < 0.3 ? "laserSniper" : g.armyHas.has("wallTurret") && g.rnd() < 0.5 ? "wallTurret" : g.kind("gunner");
    g.foe(kd, lx + 1, y, 0.2);
    const air = g.roles.air.filter((a) => BEAST[a].b !== "bomber" && BEAST[a].b !== "dive");
    if (air.length && g.rnd() < 0.5) g.foe(g.pick(air), W / 2 + (left ? 3 : -3), y + 3, 4);
    if (g.rnd() < 0.35) g.coins(W / 2 - 2, 4, y + 1.5);
    if (g.drops < 3 && k % 3 === 1) g.drop(left ? W - 3.5 : 3.5, y + 1);
  }
  g.gadget("gong", W / 2, top, { h: 5 });
  while (g.drops < 3) g.drop(W / 2 - 3 + g.drops * 3, top - 2);
  g.x = W;
  return { goal: { x: W / 2, y: top }, start: { x: W / 2 - 3, y: 3 } };
}
function chimney(c: Ctx): Built {
  const g = c.g, W = g.W, H = g.H;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) g.set(x, y, T.BRICK);
  for (let x = 2; x < W - 2; x++) for (let y = 0; y < 3; y++) g.set(x, y, T.GROUND);
  let lastCp = 3;
  for (let y = 12, k = 0; y < H - 10; y += g.ri(10, 13), k++) {
    // a rest ledge on alternating walls; turrets and drones guard the climb
    const left = k % 2 === 0, lx = left ? 2 : W - 4;
    for (let i = 0; i < 2; i++) g.set(lx + i, y - 1, T.BRICK);
    if (g.rnd() < 0.5) g.foe(g.armyHas.has("wallTurret") ? "wallTurret" : g.kind("gunner"), left ? W - 3 : 3, y - 4, 0.2);
    if (g.roles.air.length && g.rnd() < 0.45) g.foe(g.kind("air"), W / 2, y + 4, 2);
    g.coins(W / 2 - 1, 3, y - 5);
    if (y - lastCp >= 22) { g.gadget("checkpoint", lx + 1, y); g.checkpoints.push({ x: lx + 1, y }); lastCp = y; }
    if (g.drops < 3 && k % 2 === 1) g.drop(lx + 1, y + 1.6);
    // wall pegs to hold the turrets
    if (g.rnd() < 0.5) g.set(left ? W - 3 : 2, y - 5, T.BRICK);
  }
  const top = H - 8;
  for (let x = 2; x < W - 2; x++) g.set(x, top - 1, T.ONEWAY);
  g.gadget("gong", W / 2, top, { h: 5 });
  while (g.drops < 3) g.drop(W / 2, top + 1.5 + g.drops);
  g.x = W;
  return { goal: { x: W / 2, y: top }, start: { x: 3, y: 3 }, extra: { rules: { walljump: true } } };
}
function searchlight(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    for (let k = 0; k < 3; k++) {
      if (k === 1) {
        // a watch post: a brick pillar with the searchlight on top, sweeping the ground
        const len = 22; g.ground(len);
        const px = g.x + 11;
        g.gadget("searchlight", px + 1, g.h + 8, { w: 9, h: 8, period: lerp(5.5, 3.6, c.d), phase: g.rnd() * 3 });
        g.enemy("grunt", g.x + 4, 2); g.crate(g.x + 18, g.h, "bombs");
        g.x += len;
      } else if (g.rnd() < 0.5) g.squad(); else g.terrain();
    }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd() };
}
function lanternNight(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    for (let k = 0; k < 4; k++) { if (k % 2 === 0) g.lanterns(); if (g.rnd() < 0.5) g.squad(); else if (g.rnd() < 0.5) g.terrain(); else g.setPiece(); }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) { g.gadget("lantern", g.x + 1, g.h); g.checkpoint(); }
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd(), extra: { rules: { dark: true } } };
}
function duststorm(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    for (let k = 0; k < 4; k++) {
      if (g.rnd() < 0.3) g.windGap();
      else if (g.rnd() < 0.5) g.squad();
      else if (g.armyHas.has("sandBlower") && g.rnd() < 0.4) { g.ground(14); g.foe("sandBlower", g.x + 11, g.h, 0); g.enemy("grunt", g.x + 6, 2); g.x += 14; }
      else g.terrain();
    }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd(), extra: { rules: { dust: true, fog: true } } };
}
function switchyard(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    g.switchGate(); g.squad(); g.belts();
    if (g.rnd() < 0.5) g.crushers(); else g.lasers();
    if (g.rnd() < 0.5) g.turretNest(); else g.squad();
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd() };
}
function iceslide(c: Ctx): Built {
  const g = c.g;
  g.h = 15; g.x = 0; g.ground(10, T.GROUND); g.surface(0, 10, T.ICE); g.x = 10;
  let segs = 0;
  while (g.h > 4) {
    const len = g.ri(10, 16);
    g.ground(len); g.surface(g.x, len, T.ICE);
    if (g.rnd() < 0.55) g.enemy(g.rnd() < 0.5 ? "fast" : "grunt", g.x + len - 3, 2);
    if (g.armyHas.has("hoverSled") && g.rnd() < 0.3) g.foe("hoverSled", g.x + len / 2, g.h + 0.7, 6);
    g.coins(g.x + 2, len - 4, g.h + 1.4, 0.8);
    g.x += len;
    // down a step, or across a gap to a lower slope
    const drop = Math.min(g.h - 4, g.ri(1, 2));
    if (g.rnd() < 0.4) { const gw = clamp(g.ri(2, 4), 2, g.maxGap(-drop)); g.pitFill(g.x, gw); g.x += gw; }
    g.h -= drop;
    segs++;
    if (segs % 4 === 2) { g.gadget("checkpoint", g.x + 2, g.h); g.checkpoints.push({ x: g.x + 2, y: g.h }); g.ground(5); g.surface(g.x, 5, T.ICE); g.x += 5; }
    if (g.drops < 3 && segs % 3 === 1) { g.ground(8); g.surface(g.x, 8, T.ICE); const ly = g.h + 5; for (let i = 0; i < 3; i++) g.set(g.x + 3 + i, ly - 1, T.ONEWAY); g.set(g.x + 2, g.h - 1, T.BOUNCE); g.drop(g.x + 4.5, ly + 1.4); g.x += 8; }
  }
  // a long flat run-out with more Dusties
  for (let k = 0; k < 3; k++) g.squad();
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd(), start: { x: 3, y: 15 }, extra: { rules: { slide: true, wind: 1.2 } } };
}
function escort(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  for (let sec = 0; sec < n; sec++) {
    flatSection(c, 4);
    if (sec < n - 1) { g.ground(6); g.gadget("checkpoint", g.x + 2.5, g.h); g.checkpoints.push({ x: g.x + 2.5, y: g.h }); g.crate(g.x + 4.5, g.h, "bombs"); g.x += 6; }
  }
  g.ground(6); g.item("drop", g.x + 3, g.h + 3); g.drops++; g.x += 6;
  while (g.drops < 3) { g.ground(6); g.drop(g.x + 3, g.h + 3); g.x += 6; }
  const goal = g.gongEnd();
  return { goal, extra: { escort: { x: 7, y: 4, speed: lerp(1.5, 2.1, c.d), hp: 16 } } };
}
function hunt(c: Ctx): Built {
  const g = c.g, n = g.p.sections, need = c.need;
  let placed = 0;
  for (let sec = 0; sec < n; sec++) {
    section(c, 3, 1);
    const here = Math.ceil((need - placed) / (n - sec));
    for (let i = 0; i < here; i++) {
      // the elite waits somewhere awkward: up on a ledge, behind a barricade, among guards
      const style = (placed + sec) % 3, len = 14; g.ground(len);
      const kd = g.kind(g.rnd() < 0.5 ? "gunner" : "heavy");
      if (style === 0) { const ly = g.h + 4; for (let k = 0; k < 4; k++) g.set(g.x + 6 + k, ly - 1, T.BRICK); g.set(g.x + 4, g.h - 1, T.BOUNCE); g.foe(kd, g.x + 8, ly, 0.6); }
      else if (style === 1) { for (let y = g.h; y < g.h + 2; y++) for (const dx of [5, 6]) g.set(g.x + dx, y, T.BLOCK); g.foe(kd, g.x + 9, g.h, 1); g.enemy("grunt", g.x + 12, 1); }
      else { g.foe(kd, g.x + 8, g.h, 2); g.enemy("fast", g.x + 5, 1); g.enemy("gunner", g.x + 11, 1); }
      const e = g.enemies[style === 1 ? g.enemies.length - 2 : style === 2 ? g.enemies.length - 3 : g.enemies.length - 1];
      e.hunt = true; e.elite = true;
      g.x += len; placed++;
    }
    if (sec === 1) g.secretPiece(g.drops);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops);
  g.door();
  return { goal: g.gongEnd() };
}
const ESCAPE_KIND: Partial<Record<IslandId, "boulder" | "wave" | "lava" | "swarm" | "storm">> = {
  cliffs: "storm", candy: "wave", toybox: "boulder", mire: "swarm", peaks: "boulder", dunes: "storm", lantern: "swarm", factory: "lava", volcano: "lava", temple: "boulder",
};
function escape(c: Ctx): Built {
  const g = c.g, n = g.p.sections;
  g.run(12);
  for (let sec = 0; sec < n; sec++) {
    for (let k = 0; k < 5; k++) { if (k % 2 === 0) g.chasePiece(); else if (g.rnd() < 0.6) g.squad(g.ri(12, 16), clamp(Math.round(g.p.foes * 0.5), 1, 3)); else g.chasePiece(); }
    if (sec === 1) g.secretPiece(g.drops, true);
    if (sec < n - 1) g.checkpoint();
  }
  while (g.drops < 3) g.secretPiece(g.drops, true);
  return { goal: g.gongEnd(), extra: { rules: { chase: { speed: lerp(5.0, 6.3, c.d), delay: 3, kind: ESCAPE_KIND[c.isl.id] ?? "wave" } } } };
}
function gauntlet(c: Ctx): Built {
  const g = c.g;
  g.p.foes *= 1.35; g.p.elite *= 2;
  for (let sec = 0; sec < 2; sec++) section(c, 5, 2);
  while (g.drops < 3) g.secretPiece(g.drops);
  return { goal: g.gongEnd() };
}

const BUILD: Record<Concept, (c: Ctx) => Built> = {
  frontline, ambush, rooftops, collapse, rescue, bombsquad, keyhunt, vault, arena, holdwell, tower, dive, minecart, raft,
  machine: (c) => fight(c, "machine"), boss: (c) => fight(c, "boss"),
  train, glider, tank: (c) => vehicle(c, "tank"), mech: (c) => vehicle(c, "mech"), elevator, chimney, searchlight, lantern: lanternNight, duststorm,
  switchyard, iceslide, escort, hunt, escape, gauntlet,
  flood: (c) => { const b = tower(c); const lava = ["candy", "factory", "volcano"].includes(c.isl.id); return { ...b, extra: { rules: { rise: { speed: lerp(0.5, 0.72, c.d), delay: 7, kind: lava ? "lava" : "dust", from: -1 } } } }; },
};
const GOAL: Record<Concept, GoalKind> = {
  frontline: "gong", ambush: "gong", rooftops: "gong", collapse: "gong", tower: "gong", dive: "gong", minecart: "gong", raft: "gong",
  rescue: "rescue", bombsquad: "pumps", keyhunt: "keys", holdwell: "defend", vault: "vault", arena: "waves", machine: "boss", boss: "boss",
  train: "gong", glider: "gong", tank: "gong", mech: "gong", elevator: "gong", flood: "gong", chimney: "gong", searchlight: "gong", lantern: "gong",
  duststorm: "gong", switchyard: "gong", iceslide: "gong", escort: "escort", hunt: "hunt", escape: "gong", gauntlet: "gong",
};
export const CONCEPT_NAME: Record<Concept, string> = {
  frontline: "Frontline", ambush: "Ambush Alley", rooftops: "Rooftops", collapse: "Collapse Bridge", tower: "Tower Climb", dive: "Deep Dive",
  minecart: "Mine Cart", raft: "Raft River", rescue: "Rescue", bombsquad: "Bomb Squad", holdwell: "Hold the Well", keyhunt: "Key Hunt",
  vault: "Coin Vault", arena: "Arena", machine: "War Machine", boss: "Boss",
  train: "Train Top", glider: "Glider Sky", tank: "Mud Tank", mech: "Clay Mech", elevator: "Elevator Siege", flood: "Rising Flood", chimney: "Chimney",
  searchlight: "Searchlights", lantern: "Night Lanterns", duststorm: "Dust Storm", switchyard: "Switch Yard", iceslide: "Ice Slide", escort: "Escort",
  hunt: "Hunt", escape: "Escape", gauntlet: "Gauntlet",
};
export const CONCEPT_ICON: Record<Concept, string> = {
  frontline: "⚔️", ambush: "🚧", rooftops: "🏠", collapse: "🌉", tower: "🗼", dive: "⬇️", minecart: "🛤️", raft: "🛶", rescue: "🌱", bombsquad: "💣",
  holdwell: "⛲", keyhunt: "🔑", vault: "🪙", arena: "🏟️", machine: "⚙️", boss: "👑",
  train: "🚂", glider: "🦉", tank: "🚜", mech: "🤖", elevator: "⬆️", flood: "🌋", chimney: "🧗", searchlight: "🔦", lantern: "🏮", duststorm: "🌪️",
  switchyard: "🔀", iceslide: "🏂", escort: "🛒", hunt: "🎯", escape: "🏃", gauntlet: "⚡",
};
function brief(c: Concept, need: number, st: Partial<Stage>, isl: Island): string {
  switch (c) {
    case "frontline": return "Push through the Dust Army to the Splash Gong";
    case "ambush": return "Gates slam shut — melt every wave to open them";
    case "rooftops": return "Jump roof to roof — the street is a long way down";
    case "collapse": return "The bridge falls apart behind you — don't stop!";
    case "tower": return "Climb to the top — turrets in every window";
    case "dive": return "Dive down the shaft — ↓ + FIRE shoots down, bombs crack floors";
    case "minecart": return "Ride the rails — jump the gaps, duck the beams (↓)";
    case "raft": return "Ride the river — jump the logs, duck the branches";
    case "rescue": return `Free all ${need} Sprouts from their cages, then reach the exit`;
    case "bombsquad": return `Destroy ${need} Dust Pumps — Storm Bombs crack them fast`;
    case "holdwell": { const t = st.defend?.time ?? 60; return `Hold the Rain Well for ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} — don't let them reach it`; }
    case "keyhunt": return "Find 3 crystal keys to open the exit";
    case "vault": return "Coin Vault! Grab all you can in 60 seconds";
    case "arena": return `Survive ${need} waves in the arena`;
    case "machine": return `${isl.machine.name} blocks the way — take it apart!`;
    case "boss": return `${isl.boss.name} guards the Rain Bell!`;
    case "train": return "Fight along the roofs of a moving train — duck the tunnels!";
    case "glider": return "Hoot carries you: ▲ / ▼ to fly — blast everything in the sky";
    case "tank": return "Drive the Mud Tank — its cannon blasts through walls";
    case "mech": return "Stomp in the Clay Mech — walk right through small Dusties";
    case "elevator": return "Ride the lift to the top and ring the gong — hold it against the Dust Army";
    case "flood": return `Climb! The ${st.rules?.rise?.kind === "lava" ? "lava" : "dust"} is rising`;
    case "chimney": return "Wall-jump up the chimney: jump at a wall, then jump again";
    case "searchlight": return "Stay out of the searchlights — or the alarm calls Dusties";
    case "lantern": return "It's dark — light the lanterns as you go";
    case "duststorm": return "A dust storm: thick haze and gusts — watch for shapes in the dust";
    case "switchyard": return "Shoot the switches, ride the belts, time the presses";
    case "iceslide": return "Slide down the icy slopes — fast and slippery!";
    case "escort": return "Escort the Rain Cart to the gong — keep the Dusties off it";
    case "hunt": return `Hunt down ${need} gold elites, then reach the exit`;
    case "escape": return "RUN — something big is coming!";
    case "gauntlet": return "No checkpoints. Make it through.";
  }
}

/** build stage n (1..400 designed, 401+ the Endless Storm) */
export function buildStage(n: number): Stage {
  const endless = n > DESIGNED;
  const rnd = rng(n * 9973 + 17);
  let isl: Island, armyIsl: Island, concept: Concept, s: number, district: number, mix: IslandId | undefined;
  if (endless) {
    const e = endlessPlan(n);
    isl = e.look; armyIsl = e.army; concept = e.concept; s = 0; district = e.district; mix = e.army.id;
  } else {
    isl = islandOf(n); armyIsl = isl; s = stageInIsland(n); district = Math.floor((s - 1) / 5);
    concept = zoneSchedule(isl)[s - 1];
  }
  const zone = endless ? 20 : isl.n;
  const d = difficulty(n);
  const hpMul = hpMulFor(n);
  // the army: every Dust Army type met so far; a zone's new types come in over its first stages
  const army: EnemyKind[] = [];
  for (const z of ISLANDS) {
    if (endless || z.n < armyIsl.n) army.push(...z.army);
    else if (z.n === armyIsl.n) army.push(...z.army.filter((_, i) => s >= i + 1));
  }
  const uniqArmy = [...new Set(army.length ? army : (["dustie"] as EnemyKind[]))];
  const wild = isl.n === 1 && s <= 2 ? (["pincher", "snail"] as EnemyKind[]) : [...armyIsl.enemies];
  const p: P = {
    gapMax: clamp(1.8 + 3.4 * d, 2, 5.6),
    pit: n <= 4 ? 0.05 : clamp(0.14 + 0.5 * d, 0, 0.66),
    foes: lerp(2.2, 5, Math.min(1.2, d)),
    elite: n <= 6 ? 0 : clamp(0.03 + 0.09 * d, 0, 0.14),
    sections: d < 0.2 ? 4 : d < 0.55 ? 5 : 6,
    secLen: 0,
  };
  const feats = (endless ? [...isl.features, ...armyIsl.features] : [...isl.features]).filter((f) => f !== "walls" && f !== "fog" && f !== "heat" && f !== "raincloud" && f !== "dark");
  const vertical = VERTICAL.has(concept);
  const W = concept === "elevator" ? 18 : concept === "chimney" ? 10 : vertical ? 32 : concept === "arena" ? 40 : concept === "holdwell" ? 72 : CAP;
  const H = concept === "elevator" ? Math.round(lerp(64, 84, Math.min(1, d))) : concept === "chimney" ? Math.round(lerp(60, 90, Math.min(1, d))) : vertical ? Math.round(lerp(96, 150, Math.min(1, d))) : GRID_H;
  const g = new Gen(W, H, rnd, d, p, isl, feats, uniqArmy, wild, n, zone);
  g.ceiling = ["caves", "crystal", "factory"].includes(isl.id) && !vertical && concept !== "minecart" && concept !== "raft" && concept !== "arena" && concept !== "holdwell";
  g.liquid = feats.includes("lava") ? "lava" : (isl.id === "lagoon" || isl.id === "pirate") ? "water" : feats.includes("poison") ? "poison" : "pit";
  if (!vertical && !OWN_START.has(concept)) { g.h = 4; g.ground(8); g.x = 8; }
  if (n <= 2 && !vertical) { g.crate(6, 4, "weapon"); }
  const need = concept === "rescue" ? 3 + Math.min(2, Math.floor(d * 4)) : concept === "bombsquad" ? 3 + Math.min(2, Math.floor(d * 3)) : concept === "keyhunt" ? 3 : concept === "arena" ? 4 + Math.min(3, Math.round(d * 4)) : concept === "hunt" ? 3 + Math.min(2, Math.floor(d * 3)) : 0;
  const built = BUILD[concept]({ g, s, d, isl, concept, need });

  // crop the grid to what was built
  const w = vertical ? W : Math.min(W, g.x + 2);
  if (!vertical && concept !== "arena" && concept !== "holdwell" && concept !== "glider") for (let x = g.x; x < w; x++) g.col(x, g.h);
  const tiles = new Uint8Array(w * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = g.t[y * W + x];

  const tod: TimeOfDay = isl.id === "lantern" || isl.night || concept === "lantern" ? "night" : isl.weather === "storm" || concept === "duststorm" ? "storm" : TODS[((Math.max(1, s) - 1) % 5 + district) % 5];
  const rules: Stage["rules"] = { ...(built.extra?.rules ?? {}) };
  if (feats.includes("lowg")) rules.lowg = true;
  if (isl.id === "lantern" || tod === "night") rules.dark = isl.id === "lantern";
  if (isl.id === "pirate" || tod === "storm") rules.rain = true;
  if (feats.includes("beat")) rules.beat = 120;
  if (isl.id === "mire") rules.fog = true;
  const type: StageType = concept === "boss" || concept === "machine" ? "boss" : concept === "vault" ? "bonus" : concept === "collapse" ? "chase" : endless ? "remix" : "mix";
  const name = endless ? `${isl.districts[district]} ${CONCEPT_NAME[concept]}` : stageName(isl, s, concept);
  const music = concept === "boss" || concept === "machine" ? "boss" : ["minecart", "raft", "collapse", "train", "glider", "escape", "iceslide"].includes(concept) ? "chase" : concept === "vault" ? "bonus" : isl.music;
  const goalKind = GOAL[concept];
  const stage: Stage = {
    key: `c${n}`, n, island: isl.id, s, district, name, concept, goalKind, need, brief: "", type, d, hpMul, w, h: H, tiles,
    items: g.items, pots: g.pots, plats: g.plats, gadgets: g.gadgets, enemies: g.enemies, gates: g.gates, targets: g.targets,
    start: built.start ?? { x: 3, y: 4 }, checkpoints: g.checkpoints, goal: built.goal, rules, tod, mix, music,
    ...(built.extra ?? {}),
  };
  stage.rules = rules;
  if (stage.boss) {
    const base = ({
      crawler: 90, copter: 100, worm: 110, sub: 120, gyro: 105, crusher: 110, express: 115, borer: 120, plow: 125, rig: 135, blimp: 140, forge: 155,
      // the act 2-3 bosses come back stronger, but the climb from zone to zone stays gentle
      gull: 130, gummy: 140, jack: 140, spore: 145, walrus: 150, scorpion: 150, moth: 155, mecha: 165,
    } as Record<string, number>)[stage.boss.kind];
    stage.boss.hp = Math.round((base ?? bossHp(stage.boss.kind)) * hpMul * (endless ? 1.2 : 1) * (1 + Math.max(0, zone - 1) * 0.04));
  }
  stage.brief = brief(concept, need, stage, isl);
  if (!endless && s === 1) stage.hint = isl.idea;
  else if (!endless && s <= 3 && isl.army[s - 1]) stage.hint = `NEW: ${ARMY_TEXT[isl.army[s - 1]] ?? isl.army[s - 1]}`;
  else if (feats.length && !endless && s === 4 && FEATURE_TEXT[feats[0]]) stage.hint = FEATURE_TEXT[feats[0]];
  if (n >= DAILY_BASE) stage.hint = "Daily Storm · finish with no hits for a bonus!";
  return stage;
}
const bossHp = (k: string) => BOSS[k as keyof typeof BOSS]?.hp ?? 150;

/** what the "NEW" card says about each Dust Army type */
export const ARMY_TEXT: Partial<Record<EnemyKind, string>> = {
  dustie: "Dusties — baked clay soldiers. Hold FIRE to soak them!",
  dustRunner: "Dust Runners charge the moment they see you",
  pebbleGunner: "Pebble Gunners fire 3-shot bursts — jump between them",
  shieldDustie: "Shield Dusties block shots from the front — crouch-shoot (↓), jump over, or bomb",
  bombGull: "Bomb Gulls drop dust bombs — keep moving",
  dustHopper: "Dust Hoppers bound at you",
  wallTurret: "Turrets aim at you — watch for the flash, then dodge",
  ceilTurret: "Ceiling turrets fire down — stay out from under them",
  dustHive: "Dust Hives bake new Dusties — bomb them first",
  mineLayer: "Mine Layers leave mines — shoot them before you step close",
  diveHawk: "Dive Hawks swoop when you pass under",
  mortar: "Mortars lob shells over cover",
  brickBrute: "Brick Brutes are tough — bombs and Hailstone help",
  dustDrone: "Dust Drones swoop at you",
  laserSniper: "Laser Snipers show a red line first — step out of it!",
  copterDustie: "Copter Dusties hover over you and fire down",
  kiteRider: "Kite Riders drop darts from above",
  towerShield: "Tower Shields are a wall — bomb them or get behind",
  gumBouncer: "Gum Bouncers bounce high — shoot them in the air",
  candyCannon: "Candy Cannons lob sugar bombs",
  dustCart: "Dust Carts roll at you — jump or blast them",
  windupSwarm: "Wind-up soldiers come in crowds",
  toyTank: "Toy Tanks fire straight cannonballs — jump them",
  sporeThrower: "Spore Throwers leave clouds that hang in the air",
  rootGrabber: "Roots hide in the ground — they grab when you get close",
  witchMoth: "Witch Moths throw slow homing orbs",
  iceShooter: "Ice Shooters fire ice shards in pairs",
  hoverSled: "Hover Sleds zoom back and forth",
  snowBrute: "Snow Brutes charge — bombs help",
  sandBlower: "Sand Blowers push you back — fight the wind",
  sandShark: "Sand Sharks swim under the sand and leap out",
  dropPod: "Drop Pods fall from the sky full of Dusties",
  kilnKnight: "Kiln Knights wear baked armor — very tough",
  lanternGhost: "Lantern Ghosts float in the dark and throw orbs",
  spiderDustie: "Spider Dusties drop on threads",
  laserTurret: "Laser Turrets fire bursts of bolts",
  forgeBot: "Forge Bots breathe fire — keep your distance",
  crusherBot: "Crusher Bots slam the ground — jump the shockwaves",
};

/** quick self-check used by the sweep script */
export function stageSummary(st: Stage) {
  const rise = maxRise();
  return { n: st.n, name: st.name, zone: ISLAND_BY_ID[st.island].name, concept: st.concept, d: +st.d.toFixed(2), w: st.w, h: st.h, enemies: st.enemies.length, gates: st.gates.length, targets: st.targets.length, drops: st.items.filter((i) => i.kind === "drop").length, rise: +rise.toFixed(2) };
}

export const islandIds = (): IslandId[] => ISLANDS.map((i) => i.id);
export { STAGES_PER_ISLAND };
