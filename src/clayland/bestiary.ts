// Every enemy and boss: how it moves, how tough it is, what it shoots and how it looks. The wild island creatures are
// "dusted" (one more hit to melt); the Dust Army is Kranky's baked-clay troops (Rain Raid, docs/PUDDO_RAIN_RAID_PLAN.md §4).
import type { Behavior, BossKind, EnemyKind } from "./types";

export type Shape = "blob" | "crab" | "shell" | "bird" | "fish" | "box" | "spiky" | "snake" | "bug" | "cone" | "jelly" | "furry" | "army";
export type FoeShot = "ball" | "coconut" | "note" | "laser" | "spike" | "snow" | "fire" | "dust" | "shell" | "bombDrop" | "mine" | "cannon" | "spore" | "orb" | "ice" | "flame";
export interface Beast {
  b: Behavior; speed: number; hp: number; stomp: boolean; w: number; h: number;
  shape: Shape; body: string; belly: string; extra?: string;
  /** what it shoots and how often (s); burst = shots per volley */
  shot?: FoeShot; every?: number; burst?: number;
  /** hoppers: jump speed */
  hopV?: number;
  /** coins it drops when it melts */
  coins: number;
  /** a wild creature (gets +1 hp: it's "dusted") */
  wild?: boolean;
  /** hangs from the ceiling (turrets) */
  ceiling?: boolean;
  /** spawners: what comes out */
  spawn?: EnemyKind[];
}

const W = (b: Omit<Beast, "coins" | "wild"> & { coins?: number }): Beast => ({ coins: 1, wild: true, ...b });

export const BEAST: Record<EnemyKind, Beast> = {
  // ---- wild creatures (v1), dusted
  pincher: W({ b: "walk", speed: 1.6, hp: 1, stomp: true, w: 0.9, h: 0.75, shape: "crab", body: "#E8504F", belly: "#FFD9C9", extra: "#1B1530" }),
  snail: W({ b: "walk", speed: 0.9, hp: 1, stomp: true, w: 0.95, h: 0.8, shape: "shell", body: "#9FD86A", belly: "#FF9F5A" }),
  gull: W({ b: "fly", speed: 2.2, hp: 1, stomp: true, w: 0.9, h: 0.6, shape: "bird", body: "#FFFFFF", belly: "#FFC23D" }),
  coconutCrab: W({ b: "shoot", speed: 1.0, hp: 2, stomp: true, w: 1.0, h: 0.85, shape: "crab", body: "#8A5A3A", belly: "#E8C89A", shot: "coconut", every: 2.6, coins: 2 }),
  bee: W({ b: "fly", speed: 2.6, hp: 1, stomp: true, w: 0.7, h: 0.6, shape: "bug", body: "#FFD23F", belly: "#2B2B2B" }),
  bat: W({ b: "fly", speed: 2.8, hp: 1, stomp: true, w: 0.8, h: 0.55, shape: "bird", body: "#6B4FB8", belly: "#B89FFF" }),
  mole: W({ b: "hop", speed: 1.2, hp: 2, stomp: true, w: 0.95, h: 0.9, shape: "furry", body: "#7A5A4A", belly: "#FFB8A0", hopV: 9, coins: 2 }),
  jelly: W({ b: "swim", speed: 0.8, hp: 1, stomp: false, w: 0.8, h: 0.8, shape: "jelly", body: "#FF8FE0", belly: "#FFD6F4" }),
  puffer: W({ b: "swim", speed: 1.2, hp: 1, stomp: false, w: 0.9, h: 0.9, shape: "spiky", body: "#FFC23D", belly: "#FFF2C9" }),
  fish: W({ b: "swim", speed: 2.4, hp: 1, stomp: true, w: 0.9, h: 0.55, shape: "fish", body: "#3DA8FF", belly: "#CFF1FF" }),
  hawk: W({ b: "fly", speed: 3.2, hp: 1, stomp: true, w: 1.0, h: 0.6, shape: "bird", body: "#9A6B45", belly: "#F2D8B8" }),
  gumdrop: W({ b: "hop", speed: 1.4, hp: 1, stomp: true, w: 0.8, h: 0.8, shape: "cone", body: "#FF5FA2", belly: "#FFFFFF", hopV: 11 }),
  gummy: W({ b: "walk", speed: 1.4, hp: 2, stomp: true, w: 0.9, h: 1.0, shape: "blob", body: "#5FE08F", belly: "#C8FFD8", coins: 2 }),
  windup: W({ b: "walk", speed: 2.2, hp: 1, stomp: true, w: 0.85, h: 0.75, shape: "furry", body: "#C8C8D8", belly: "#FFB8C8", extra: "#FFC21A" }),
  toySoldier: W({ b: "shoot", speed: 1.0, hp: 2, stomp: true, w: 0.7, h: 1.2, shape: "box", body: "#FF3D4E", belly: "#2B3F96", shot: "ball", every: 2.4, coins: 2 }),
  shroom: W({ b: "walk", speed: 1.1, hp: 1, stomp: true, w: 0.9, h: 0.9, shape: "cone", body: "#B84FE8", belly: "#FFF2DC" }),
  frog: W({ b: "hop", speed: 1.6, hp: 1, stomp: true, w: 0.85, h: 0.7, shape: "blob", body: "#5FCB52", belly: "#E8FFC8", hopV: 12 }),
  penguin: W({ b: "walk", speed: 2.4, hp: 1, stomp: true, w: 0.8, h: 0.95, shape: "blob", body: "#2F3D8F", belly: "#FFFFFF" }),
  yeti: W({ b: "shoot", speed: 1.0, hp: 3, stomp: true, w: 1.1, h: 1.3, shape: "furry", body: "#F2F6FF", belly: "#9FC8E8", shot: "snow", every: 2.8, coins: 3 }),
  scorpion: W({ b: "walk", speed: 2.0, hp: 2, stomp: true, w: 1.0, h: 0.7, shape: "crab", body: "#D98A3F", belly: "#FFE0A0", coins: 2 }),
  cactus: W({ b: "spiky", speed: 0.6, hp: 2, stomp: false, w: 0.8, h: 1.2, shape: "spiky", body: "#4FB84F", belly: "#FF8FC7", coins: 2 }),
  moth: W({ b: "fly", speed: 2.4, hp: 1, stomp: true, w: 0.9, h: 0.6, shape: "bug", body: "#C8B8FF", belly: "#FFE08A" }),
  spiderBot: W({ b: "drop", speed: 1.6, hp: 1, stomp: true, w: 0.8, h: 0.7, shape: "bug", body: "#3A3A5A", belly: "#FF3D6E" }),
  sentry: W({ b: "shoot", speed: 0.8, hp: 2, stomp: true, w: 0.9, h: 1.0, shape: "box", body: "#9FB0C8", belly: "#3DE0FF", shot: "laser", every: 2.2, coins: 2 }),
  drone: W({ b: "fly", speed: 2.8, hp: 1, stomp: true, w: 0.9, h: 0.5, shape: "box", body: "#FFC21A", belly: "#2B2B2B" }),
  stoneHead: W({ b: "spiky", speed: 0.5, hp: 3, stomp: false, w: 1.0, h: 1.1, shape: "box", body: "#9A8A6A", belly: "#6BC24F", coins: 3 }),
  snake: W({ b: "walk", speed: 1.8, hp: 1, stomp: true, w: 1.1, h: 0.55, shape: "snake", body: "#5FB84F", belly: "#FFE08A" }),
  thunderDuck: W({ b: "fly", speed: 2.6, hp: 2, stomp: true, w: 1.0, h: 0.8, shape: "bird", body: "#FFD23F", belly: "#FFFFFF", shot: "ball", every: 3, coins: 2 }),
  neonBot: W({ b: "walk", speed: 2.4, hp: 1, stomp: true, w: 0.8, h: 0.9, shape: "box", body: "#FF3DC8", belly: "#3DE0FF" }),
  magma: W({ b: "chase", speed: 1.8, hp: 2, stomp: false, w: 0.9, h: 0.8, shape: "blob", body: "#FF5A1F", belly: "#FFC23D", coins: 2 }),
  crystalBat: W({ b: "fly", speed: 3.0, hp: 1, stomp: true, w: 0.8, h: 0.55, shape: "bird", body: "#7FF0FF", belly: "#FF7AE0" }),
  pirateGull: W({ b: "fly", speed: 2.6, hp: 1, stomp: true, w: 0.95, h: 0.6, shape: "bird", body: "#E8E8F0", belly: "#FF3D4E", shot: "ball", every: 3.2 }),
  parrot: W({ b: "hop", speed: 1.6, hp: 1, stomp: true, w: 0.8, h: 0.9, shape: "bird", body: "#3DCB6A", belly: "#FFD23F", hopV: 10 }),
  rover: W({ b: "walk", speed: 2.0, hp: 2, stomp: true, w: 1.1, h: 0.8, shape: "box", body: "#C8CCE0", belly: "#FF5F5F", coins: 2 }),
  alien: W({ b: "hop", speed: 1.4, hp: 1, stomp: true, w: 0.8, h: 0.9, shape: "blob", body: "#7FFFB0", belly: "#E8FFF2", hopV: 8 }),
  urchin: W({ b: "spiky", speed: 0.4, hp: 1, stomp: false, w: 0.8, h: 0.8, shape: "spiky", body: "#3A2A6B", belly: "#FF7AE0" }),

  // ---- Kranky's Dust Army (grey baked clay, orange dust-glow eyes)
  /** the grunt: patrols, turns to face Puddo and fires a dust ball */
  dustie: { b: "gunner", speed: 0.9, hp: 2, stomp: true, w: 0.8, h: 1.05, shape: "army", body: "#9A8F86", belly: "#C9BFB4", extra: "#FF8A2A", shot: "dust", every: 2.2, burst: 1, coins: 1 },
  /** charges the moment it sees Puddo */
  dustRunner: { b: "runner", speed: 4.4, hp: 1, stomp: true, w: 0.75, h: 0.9, shape: "army", body: "#A89A8A", belly: "#D8CCBE", extra: "#FFB23A", coins: 1 },
  /** hops toward Puddo in big bounds */
  dustHopper: { b: "hop", speed: 2.2, hp: 2, stomp: true, w: 0.8, h: 0.85, shape: "army", body: "#8F8A80", belly: "#C8C2B8", extra: "#FF8A2A", hopV: 13, coins: 1 },
  /** stands its ground and fires 3-shot bursts */
  pebbleGunner: { b: "gunner", speed: 0, hp: 3, stomp: true, w: 0.9, h: 1.1, shape: "army", body: "#857C74", belly: "#B8AEA4", extra: "#FF6A2A", shot: "dust", every: 2.6, burst: 3, coins: 2 },
  /** lobs shells over cover */
  mortar: { b: "lob", speed: 0, hp: 3, stomp: true, w: 1.0, h: 0.95, shape: "army", body: "#7E766E", belly: "#B0A69C", extra: "#FF5A1F", shot: "shell", every: 2.8, coins: 2 },
  /** a shield in front: shoot it from behind, from low (↓), or bomb it */
  shieldDustie: { b: "shield", speed: 1.0, hp: 3, stomp: true, w: 0.95, h: 1.15, shape: "army", body: "#948A80", belly: "#C4BAB0", extra: "#5A6E8A", shot: "dust", every: 3.0, burst: 1, coins: 3 },
  /** a big heavy: slow, then a short charge */
  brickBrute: { b: "brute", speed: 0.7, hp: 10, stomp: false, w: 1.4, h: 1.7, shape: "army", body: "#7A6E64", belly: "#A89C90", extra: "#FF4A1A", coins: 8 },
  /** a little flying scout that swoops */
  dustDrone: { b: "drone", speed: 2.6, hp: 1, stomp: true, w: 0.8, h: 0.55, shape: "army", body: "#A09890", belly: "#D0C8C0", extra: "#FFB23A", coins: 1 },
  /** drops dust bombs from above */
  bombGull: { b: "bomber", speed: 2.4, hp: 2, stomp: true, w: 1.0, h: 0.65, shape: "army", body: "#B8B0A8", belly: "#E0D8D0", extra: "#FF8A2A", shot: "bombDrop", every: 1.7, coins: 2 },
  /** hovers high, then dives at Puddo */
  diveHawk: { b: "dive", speed: 3.0, hp: 2, stomp: true, w: 1.0, h: 0.6, shape: "army", body: "#8A8076", belly: "#C0B6AC", extra: "#FF6A2A", coins: 2 },
  /** a cannon on the ground or a wall that aims at Puddo */
  wallTurret: { b: "turret", speed: 0, hp: 4, stomp: false, w: 0.9, h: 0.9, shape: "army", body: "#6E6862", belly: "#9A928A", extra: "#FF5A1F", shot: "dust", every: 1.8, burst: 1, coins: 3 },
  /** the same, hanging from the ceiling */
  ceilTurret: { b: "turret", speed: 0, hp: 4, stomp: false, w: 0.9, h: 0.9, shape: "army", body: "#6E6862", belly: "#9A928A", extra: "#FF5A1F", shot: "dust", every: 1.9, burst: 1, coins: 3, ceiling: true },
  /** bakes new Dusties until it's destroyed (bombs crack it fast) */
  dustHive: { b: "hive", speed: 0, hp: 12, stomp: false, w: 1.6, h: 1.9, shape: "army", body: "#7A7068", belly: "#A89E94", extra: "#FF7A2A", every: 3.6, coins: 10, spawn: ["dustie", "dustRunner", "dustDrone"] },
  /** walks and drops dust mines */
  mineLayer: { b: "mine", speed: 1.1, hp: 3, stomp: true, w: 0.95, h: 0.95, shape: "army", body: "#8C847A", belly: "#BEB4AA", extra: "#FF4A3A", shot: "mine", every: 3.2, coins: 2 },

  // ---- Phase B: Rasp's and Clinker's troops (zones 5–12)
  /** shows a red aiming line, then fires a fast laser */
  laserSniper: { b: "sniper", speed: 0, hp: 3, stomp: true, w: 0.85, h: 1.15, shape: "army", body: "#8E8A84", belly: "#C2BCB4", extra: "#FF3A3A", shot: "laser", every: 3.2, coins: 3 },
  /** a Dustie in a little rotor pack: hovers over you and fires down */
  copterDustie: { b: "copter", speed: 2.6, hp: 2, stomp: true, w: 1.0, h: 0.85, shape: "army", body: "#9A928A", belly: "#CFC6BC", extra: "#FFB23A", shot: "dust", every: 2.2, burst: 2, coins: 2 },
  /** rides a dust kite and drops darts */
  kiteRider: { b: "bomber", speed: 2.9, hp: 2, stomp: true, w: 1.3, h: 0.9, shape: "army", body: "#A69C90", belly: "#D8CEC2", extra: "#FF8A2A", shot: "spike", every: 1.5, coins: 2 },
  /** a wall of a shield: bomb it, or get behind it */
  towerShield: { b: "shield", speed: 0.6, hp: 6, stomp: false, w: 1.25, h: 1.6, shape: "army", body: "#7E766E", belly: "#B2A89C", extra: "#5A6E8A", shot: "dust", every: 3.4, burst: 1, coins: 5 },
  /** a gumball Dustie that bounces high */
  gumBouncer: { b: "hop", speed: 2.6, hp: 3, stomp: true, w: 0.9, h: 0.9, shape: "army", body: "#E86AA8", belly: "#FFC8E4", extra: "#FF8A2A", hopV: 15, coins: 2 },
  /** a candy mortar that lobs sugar bombs */
  candyCannon: { b: "lob", speed: 0, hp: 4, stomp: false, w: 1.0, h: 1.0, shape: "army", body: "#C86A9A", belly: "#FFD2EA", extra: "#FF5A1F", shot: "shell", every: 2.4, coins: 3 },
  /** a mine cart full of dust, rolling at you */
  dustCart: { b: "runner", speed: 6.2, hp: 4, stomp: true, w: 1.3, h: 1.0, shape: "army", body: "#8A6A4A", belly: "#B89A7A", extra: "#FF8A2A", coins: 3 },
  /** tiny wind-up soldiers that come in a crowd */
  windupSwarm: { b: "runner", speed: 3.8, hp: 1, stomp: true, w: 0.6, h: 0.6, shape: "army", body: "#B8B0C8", belly: "#E0D8F0", extra: "#FFC21A", coins: 1 },
  /** a toy tank: slow, tough, fires straight cannonballs */
  toyTank: { b: "tank", speed: 0.9, hp: 8, stomp: false, w: 1.6, h: 1.1, shape: "army", body: "#6E8A5A", belly: "#A8C08E", extra: "#FF5A1F", shot: "cannon", every: 2.6, coins: 6 },
  /** lobs clouds of spores that hang in the air */
  sporeThrower: { b: "lob", speed: 0, hp: 3, stomp: true, w: 0.95, h: 1.05, shape: "army", body: "#8A7A9A", belly: "#C2B4D2", extra: "#9BE04A", shot: "spore", every: 2.6, coins: 2 },
  /** hides in the ground and grabs when you come close */
  rootGrabber: { b: "ambusher", speed: 0, hp: 3, stomp: false, w: 1.1, h: 1.4, shape: "army", body: "#6A5A40", belly: "#9A8A6A", extra: "#9BE04A", coins: 2 },
  /** a dusty moth that throws slow homing orbs */
  witchMoth: { b: "fly", speed: 2.2, hp: 2, stomp: true, w: 1.1, h: 0.7, shape: "army", body: "#8F86A6", belly: "#C8BEE0", extra: "#C86AFF", shot: "orb", every: 2.8, coins: 2 },
  /** fires ice shards in pairs */
  iceShooter: { b: "gunner", speed: 0.8, hp: 3, stomp: true, w: 0.9, h: 1.1, shape: "army", body: "#9AA6B4", belly: "#D4DEE8", extra: "#7FD8FF", shot: "ice", every: 2.2, burst: 2, coins: 2 },
  /** a hover sled that zooms back and forth low over the ground */
  hoverSled: { b: "sled", speed: 6.4, hp: 2, stomp: true, w: 1.3, h: 0.8, shape: "army", body: "#8A96A6", belly: "#C2CEDC", extra: "#3DE0FF", coins: 2 },
  /** a big snow Dustie: slow, then a charge */
  snowBrute: { b: "brute", speed: 0.7, hp: 10, stomp: false, w: 1.45, h: 1.75, shape: "army", body: "#B4BCC8", belly: "#E8EEF6", extra: "#3DA8FF", coins: 8 },
  /** blows a gust of sand that pushes you back */
  sandBlower: { b: "blower", speed: 0, hp: 4, stomp: true, w: 1.1, h: 1.1, shape: "army", body: "#B49A6A", belly: "#E0C898", extra: "#FF8A2A", coins: 3 },
  /** swims under the sand and leaps out at you */
  sandShark: { b: "burrower", speed: 3.4, hp: 3, stomp: true, w: 1.35, h: 0.85, shape: "army", body: "#9A8A6A", belly: "#D2C29C", extra: "#FF5A1F", coins: 3 },
  /** drops from the sky and opens: two Dusties jump out */
  dropPod: { b: "pod", speed: 0, hp: 5, stomp: false, w: 1.2, h: 1.4, shape: "army", body: "#6E6862", belly: "#9A928A", extra: "#FF5A1F", coins: 4, spawn: ["dustie", "dustRunner"] },
  /** a knight in kiln-baked armor: very tough */
  kilnKnight: { b: "brute", speed: 1.0, hp: 14, stomp: false, w: 1.2, h: 1.85, shape: "army", body: "#7A5A4A", belly: "#A88A6A", extra: "#FF4A1A", coins: 10 },
  /** a glowing ghost lantern that floats and throws orbs */
  lanternGhost: { b: "fly", speed: 2.0, hp: 2, stomp: true, w: 0.9, h: 1.0, shape: "army", body: "#A8A0C0", belly: "#E8E0FF", extra: "#FFD23F", shot: "orb", every: 3.0, coins: 2 },
  /** drops on a dust thread from above */
  spiderDustie: { b: "drop", speed: 1.6, hp: 2, stomp: true, w: 0.9, h: 0.75, shape: "army", body: "#5A5450", belly: "#8A847E", extra: "#FF3A3A", coins: 2 },
  /** fires bursts of laser bolts */
  laserTurret: { b: "turret", speed: 0, hp: 5, stomp: false, w: 1.0, h: 1.0, shape: "army", body: "#5E6670", belly: "#8E98A4", extra: "#FF3A5E", shot: "laser", every: 2.4, burst: 3, coins: 4 },
  /** a forge bot with a flamethrower: keep your distance */
  forgeBot: { b: "flamer", speed: 1.1, hp: 5, stomp: true, w: 1.15, h: 1.35, shape: "army", body: "#6A6058", belly: "#9A8E82", extra: "#FF5A1F", coins: 4 },
  /** jumps high and slams: shockwaves along the ground */
  crusherBot: { b: "slammer", speed: 1.3, hp: 6, stomp: false, w: 1.35, h: 1.45, shape: "army", body: "#6E7680", belly: "#9EA6B0", extra: "#FFC21A", coins: 5 },
};

/** boss patterns: v1 (charge / jump / fly / burrow / shoot / kranky) and the Rain Raid fights (bossai.ts) */
export type BossPattern = "charge" | "jump" | "fly" | "burrow" | "shoot" | "kranky" | "crawler" | "copter" | "worm" | "sub" | "clack" | "bonk" | "mole" | "puffer"
  | "gyro" | "crusher" | "express" | "borer" | "plow" | "rig" | "blimp" | "forge"
  | "gull2" | "gummy2" | "jack2" | "spore2" | "walrus2" | "scorpion2" | "moth2" | "mecha2";
export interface BossDef { pattern: BossPattern; hp: number; speed: number; w: number; h: number; shape: Shape; body: string; belly: string; shot?: FoeShot }

/** hp is for the Rain Blaster (Drizzle melts ~6 hp a second); zones scale it further */
export const BOSS: Record<BossKind, BossDef> = {
  clack: { pattern: "clack", hp: 110, speed: 3.4, w: 2.4, h: 1.9, shape: "crab", body: "#FF7A5F", belly: "#FFE0C9", shot: "dust" },
  bonk: { pattern: "bonk", hp: 125, speed: 2.2, w: 2.4, h: 2.1, shape: "crab", body: "#8A5A3A", belly: "#E8C89A", shot: "coconut" },
  mole: { pattern: "mole", hp: 135, speed: 3.2, w: 2.2, h: 2.1, shape: "furry", body: "#7A5A4A", belly: "#FFB8A0", shot: "dust" },
  puffer: { pattern: "puffer", hp: 145, speed: 2.6, w: 2.4, h: 2.4, shape: "spiky", body: "#FFC23D", belly: "#FFF2C9", shot: "spike" },
  gull: { pattern: "gull2", hp: 150, speed: 3.4, w: 2.6, h: 1.6, shape: "bird", body: "#FFFFFF", belly: "#FFC23D", shot: "ball" },
  gummy: { pattern: "gummy2", hp: 160, speed: 2.6, w: 2.4, h: 2.4, shape: "blob", body: "#5FE08F", belly: "#C8FFD8", shot: "dust" },
  jack: { pattern: "jack2", hp: 160, speed: 2.4, w: 2.2, h: 2.6, shape: "box", body: "#FF5F5F", belly: "#FFD23F", shot: "ball" },
  spore: { pattern: "spore2", hp: 170, speed: 2.4, w: 2.6, h: 2.6, shape: "cone", body: "#B84FE8", belly: "#FFF2DC", shot: "spike" },
  walrus: { pattern: "walrus2", hp: 180, speed: 4.0, w: 2.8, h: 2.2, shape: "blob", body: "#9A7A6A", belly: "#E8D8C8", shot: "snow" },
  scorpion: { pattern: "scorpion2", hp: 180, speed: 3.6, w: 2.6, h: 1.8, shape: "crab", body: "#D98A3F", belly: "#FFE0A0", shot: "spike" },
  moth: { pattern: "moth2", hp: 190, speed: 3.2, w: 2.8, h: 1.8, shape: "bug", body: "#C8B8FF", belly: "#FFE08A", shot: "ball" },
  mecha: { pattern: "mecha2", hp: 200, speed: 4.4, w: 2.6, h: 2.4, shape: "box", body: "#9FB0C8", belly: "#FF7A1F", shot: "laser" },
  guardian: { pattern: "jump", hp: 220, speed: 2.4, w: 2.6, h: 2.8, shape: "box", body: "#9A8A6A", belly: "#6BC24F", shot: "ball" },
  nimbus: { pattern: "fly", hp: 230, speed: 3.4, w: 2.6, h: 2.2, shape: "blob", body: "#E8F2FF", belly: "#7FD8FF", shot: "laser" },
  dj: { pattern: "shoot", hp: 230, speed: 2.8, w: 2.4, h: 2.4, shape: "crab", body: "#FF3DC8", belly: "#3DE0FF", shot: "note" },
  magma: { pattern: "jump", hp: 240, speed: 3.0, w: 2.6, h: 2.2, shape: "crab", body: "#FF5A1F", belly: "#FFC23D", shot: "fire" },
  clam: { pattern: "burrow", hp: 240, speed: 3.4, w: 2.6, h: 2.0, shape: "shell", body: "#9F7BFF", belly: "#5FF0E8", shot: "laser" },
  admiral: { pattern: "shoot", hp: 250, speed: 3.0, w: 2.6, h: 2.4, shape: "crab", body: "#3A5ACB", belly: "#FFD23F", shot: "ball" },
  robo: { pattern: "charge", hp: 260, speed: 4.6, w: 2.8, h: 2.4, shape: "box", body: "#C8CCE0", belly: "#FF5FE0", shot: "laser" },
  kranky: { pattern: "kranky", hp: 320, speed: 3.6, w: 2.8, h: 2.4, shape: "crab", body: "#E8504F", belly: "#FFD9C9", shot: "fire" },
  // the generals' war machines
  crawler: { pattern: "crawler", hp: 130, speed: 2.2, w: 4.4, h: 2.7, shape: "box", body: "#8A8178", belly: "#C8BEB2", shot: "shell" },
  copter: { pattern: "copter", hp: 140, speed: 3.0, w: 3.8, h: 2.0, shape: "box", body: "#8F877E", belly: "#D0C6BA", shot: "bombDrop" },
  worm: { pattern: "worm", hp: 160, speed: 4.0, w: 2.6, h: 3.0, shape: "box", body: "#7E756C", belly: "#B8AEA2", shot: "dust" },
  sub: { pattern: "sub", hp: 170, speed: 2.6, w: 4.2, h: 2.3, shape: "box", body: "#6E7E8E", belly: "#C8D4DE", shot: "dust" },
  // Major Rasp's machines (Act 2) and Colonel Clinker's (Act 3)
  gyro: { pattern: "gyro", hp: 110, speed: 3.2, w: 3.8, h: 2.0, shape: "box", body: "#7A8A6A", belly: "#C0D0A8", shot: "laser" },
  crusher: { pattern: "crusher", hp: 120, speed: 1.8, w: 3.6, h: 3.2, shape: "box", body: "#C86A9A", belly: "#FFD2EA", shot: "shell" },
  express: { pattern: "express", hp: 120, speed: 11, w: 4.8, h: 2.0, shape: "box", body: "#D84A4A", belly: "#FFC21A", shot: "shell" },
  borer: { pattern: "borer", hp: 130, speed: 4.2, w: 2.6, h: 3.0, shape: "box", body: "#6A5A40", belly: "#9BE04A", shot: "spore" },
  plow: { pattern: "plow", hp: 140, speed: 2.4, w: 4.6, h: 2.8, shape: "box", body: "#8A96A6", belly: "#E8EEF6", shot: "shell" },
  rig: { pattern: "rig", hp: 150, speed: 4.6, w: 2.8, h: 3.2, shape: "box", body: "#B49A6A", belly: "#E0C898", shot: "dust" },
  blimp: { pattern: "blimp", hp: 150, speed: 2.0, w: 6.0, h: 2.6, shape: "box", body: "#5A5070", belly: "#FFD23F", shot: "bombDrop" },
  forge: { pattern: "forge", hp: 170, speed: 1.9, w: 3.2, h: 3.6, shape: "box", body: "#5E6670", belly: "#FF7A1F", shot: "flame" },
};
