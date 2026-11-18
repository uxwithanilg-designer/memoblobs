// Puddo's Clayland: Rain Raid — shared types. The world is a 2D tile grid (x right, y up, 1 unit = 1 tile) rendered as a
// 2.5D clay diorama. Everything in the sim runs at a fixed 120 Hz step. A stage is built from a concept (layout + goal +
// set piece) — see docs/PUDDO_RAIN_RAID_PLAN.md.

export type IslandId =
  | "shore" | "grove" | "caves" | "lagoon" | "cliffs" | "candy" | "toybox" | "mire" | "peaks" | "dunes"
  | "lantern" | "factory" | "temple" | "clouds" | "neon" | "volcano" | "crystal" | "pirate" | "moon" | "castle";

export type FriendId = "turbo" | "pip" | "hoot" | "bolt" | "gloop" | "noodle" | "zib";

/** the Rain Blaster's ammo: Drizzle always, the rest are pickups (lost on a hit) */
export type Weapon = "drizzle" | "sprinkler" | "downpour" | "hailstone" | "thunder" | "rainbow" | "geyser";

/** stage pieces and rules a zone can use (v1 pieces live on inside the concepts' rooms) */
export type Feature =
  | "lift" | "vlift" | "crumble" | "bonfire" | "drip" | "water" | "current" | "wind" | "cloud" | "caramel" | "marsh"
  | "spring" | "conveyor" | "switch" | "poison" | "fog" | "ice" | "icicle" | "snowball" | "heat" | "quicksand"
  | "sandjet" | "dark" | "spider" | "crusher" | "laser" | "swing" | "arrow" | "stone" | "climb" | "raincloud" | "beat"
  | "lava" | "geyser" | "rockfall" | "beam" | "rocking" | "cannon" | "lowg" | "meteor" | "coconut" | "breakable"
  | "squeeze" | "spikes" | "walls";

export type EnemyKind =
  // the wild creatures of the islands (now "dusted": grey-cracked, a little tougher)
  | "pincher" | "snail" | "gull" | "coconutCrab" | "bee" | "bat" | "mole" | "jelly" | "puffer" | "fish" | "hawk"
  | "gumdrop" | "gummy" | "windup" | "toySoldier" | "shroom" | "frog" | "penguin" | "yeti" | "scorpion" | "cactus"
  | "moth" | "spiderBot" | "sentry" | "drone" | "stoneHead" | "snake" | "thunderDuck" | "neonBot" | "magma"
  | "crystalBat" | "pirateGull" | "parrot" | "rover" | "alien" | "urchin"
  // Kranky's Dust Army
  | "dustie" | "dustRunner" | "dustHopper" | "pebbleGunner" | "mortar" | "shieldDustie" | "brickBrute"
  | "dustDrone" | "bombGull" | "diveHawk" | "wallTurret" | "ceilTurret" | "dustHive" | "mineLayer"
  // Phase B (zones 5–12)
  | "laserSniper" | "copterDustie" | "kiteRider" | "towerShield" | "gumBouncer" | "candyCannon" | "dustCart" | "windupSwarm"
  | "toyTank" | "sporeThrower" | "rootGrabber" | "witchMoth" | "iceShooter" | "hoverSled" | "snowBrute" | "sandBlower"
  | "sandShark" | "dropPod" | "kilnKnight" | "lanternGhost" | "spiderDustie" | "laserTurret" | "forgeBot" | "crusherBot";

export type BossKind =
  | "clack" | "bonk" | "mole" | "puffer" | "gull" | "gummy" | "jack" | "spore" | "walrus" | "scorpion"
  | "moth" | "mecha" | "guardian" | "nimbus" | "dj" | "magma" | "clam" | "admiral" | "robo" | "kranky"
  // the generals' war machines (stage 10 of every zone)
  | "crawler" | "copter" | "worm" | "sub" | "gyro" | "crusher" | "express" | "borer" | "plow" | "rig" | "blimp" | "forge";

/** what an enemy does */
export type Behavior =
  | "walk" | "hop" | "fly" | "swim" | "shoot" | "spiky" | "chase" | "drop"
  | "runner" | "gunner" | "lob" | "shield" | "brute" | "drone" | "bomber" | "dive" | "turret" | "hive" | "mine"
  | "sniper" | "copter" | "tank" | "ambusher" | "sled" | "blower" | "burrower" | "pod" | "flamer" | "slammer";

/** the stage concepts (Phase A: 14, Phase B: 16 more), plus the two fights */
export type Concept =
  | "frontline" | "ambush" | "rooftops" | "collapse" | "tower" | "dive" | "minecart" | "raft" | "rescue" | "bombsquad"
  | "holdwell" | "keyhunt" | "vault" | "arena" | "machine" | "boss"
  | "train" | "glider" | "tank" | "mech" | "elevator" | "flood" | "chimney" | "searchlight" | "lantern" | "duststorm"
  | "switchyard" | "iceslide" | "escort" | "hunt" | "escape" | "gauntlet";

/** what finishes the stage */
export type GoalKind = "gong" | "pumps" | "rescue" | "keys" | "defend" | "waves" | "vault" | "boss" | "escort" | "hunt";

export type TimeOfDay = "day" | "sunset" | "night" | "storm";

export interface Island {
  id: IslandId;
  n: number;
  name: string;
  /** one line: what's new here */
  idea: string;
  /** 20 stage names */
  stages: string[];
  /** the four districts (the look changes every 5 stages) */
  districts: [string, string, string, string];
  features: Feature[];
  enemies: EnemyKind[];
  /** the Dust Army types this zone brings in (taught in its first stages) */
  army: EnemyKind[];
  friend?: FriendId;
  boss: { kind: BossKind; name: string };
  /** the general's machine at stage 10 */
  machine: { kind: BossKind; name: string };
  music: string;
  /** ground/brick/block/accent colours, sky top/bottom, fog */
  pal: { ground: string; top: string; brick: string; block: string; accent: string; sky: [string, string]; fog: string; far: string; mid: string };
  /** background prop family, per district */
  props: string[];
  weather: "sun" | "rain" | "snow" | "fog" | "wind" | "night" | "storm" | "ash" | "stars" | "sparkle" | "dust";
  night?: boolean;
  /** the comic card shown when the zone opens */
  story: string;
}

/** tile codes in the stage grid */
export const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, BLOCK: 3, ONEWAY: 4, BREAK: 5, SPIKES: 6, LAVA: 7, WATER: 8, ICE: 9, CARAMEL: 10,
  BOUNCE: 11, BELT_R: 12, BELT_L: 13, SW_A: 14, SW_B: 15, SAND: 16, CRUMBLE: 17, CLOUD: 18, BEAT_A: 19, BEAT_B: 20,
  POISON: 21, VINE: 22, WALL: 23,
  /** an ambush gate: a dust wall that's solid only while its arena fight is on */
  GATE: 24,
  /** the exit door: solid until the stage's keys / pumps / cages are done */
  DOOR: 25,
  /** mine-cart rails: stand on them from above */
  RAIL: 26,
} as const;
export type Tile = (typeof T)[keyof typeof T];

export type ItemKind = "coin" | "fruit" | "drop" | "heart" | "juice" | "star" | "key" | "bombs" | "weapon";
export interface Item { kind: ItemKind; x: number; y: number; fruit?: number; w?: Weapon; taken?: boolean; id: number }

export type PotItem =
  | { k: "friend"; f: FriendId } | { k: "juice" } | { k: "heart" } | { k: "star" } | { k: "coins" }
  | { k: "weapon"; w: Weapon } | { k: "bombs"; n: number };
/** clay pots and Rain crates: shoot, stomp or walk into them */
export interface Pot { x: number; y: number; item: PotItem; hidden: boolean; crate?: boolean; open?: boolean; id: number }

/** moving platforms */
export type PlatKind = "lift" | "vlift" | "fall" | "swing" | "rock" | "taxi" | "elevator";
export interface PlatSpec { kind: PlatKind; x: number; y: number; w: number; range: number; speed: number; phase: number; id: number }

/** hazards and gadgets placed in the stage */
export type GadgetKind =
  | "bonfire" | "drip" | "icicle" | "spider" | "crusher" | "laser" | "arrow" | "cannon" | "geyser" | "sandjet"
  | "spring" | "switch" | "lantern" | "roller" | "rockfall" | "meteor" | "raincloud" | "shade" | "wind" | "current"
  | "checkpoint" | "gong" | "bell" | "beam" | "mine" | "searchlight";
export interface Gadget { kind: GadgetKind; x: number; y: number; w?: number; h?: number; dir?: number; period?: number; phase?: number; power?: number; id: number }

export interface EnemySpec { kind: EnemyKind; x: number; y: number; range: number; id: number; elite?: boolean; hunt?: boolean }

/** an ambush arena: walls close at x0 and x1 when Puddo walks in; the waves come; the walls open when all are melted */
export interface WaveFoe { kind: EnemyKind; n: number; elite?: boolean }
export interface GateSpec { id: number; x0: number; x1: number; floor: number; top: number; waves: WaveFoe[][] }
/** Hold the Well: keep the Rain Well standing until the timer runs out */
export interface DefendSpec { x: number; y: number; hp: number; time: number; every: number; kinds: EnemyKind[]; fly: EnemyKind[]; spawnL: number; spawnR: number }
/** structures to destroy (Dust Pumps) or open (Sprout cages) */
export interface Target { kind: "pump" | "cage"; x: number; y: number; hp: number; id: number }
/** rides: auto-scrolling (cart, raft, glider) or driven (tank, mech) */
export interface RideSpec { kind: "cart" | "raft" | "glider" | "tank" | "mech"; speed: number }
/** Escort: the Rain Cart rolls to the gong while Puddo keeps the Dust Army off it */
export interface EscortSpec { x: number; y: number; speed: number; hp: number }

export type StageType = "teach" | "mix" | "friend" | "bonus" | "chase" | "gauntlet" | "boss" | "remix";

/** a built stage: everything the sim needs */
export interface Stage {
  key: string;
  /** 1-based global stage number (401+ = the Endless Storm) */
  n: number;
  island: IslandId;
  /** in-zone index 1..20 (endless: 0) */
  s: number;
  /** 0..3: which district of the zone (the look changes every 5 stages) */
  district: number;
  name: string;
  concept: Concept;
  goalKind: GoalKind;
  /** how many pumps / cages / keys / waves the goal needs */
  need: number;
  /** a one-line brief for the intro card */
  brief: string;
  type: StageType;
  /** 0 (gentle) … 1 (the hardest designed stage) — the Endless Storm goes past it */
  d: number;
  /** enemy toughness multiplier for this zone */
  hpMul: number;
  w: number; h: number;
  tiles: Uint8Array;
  items: Item[];
  pots: Pot[];
  plats: PlatSpec[];
  gadgets: Gadget[];
  enemies: EnemySpec[];
  gates: GateSpec[];
  targets: Target[];
  defend?: DefendSpec;
  ride?: RideSpec;
  escort?: EscortSpec;
  /** Coin Vault: the stage ends after this many seconds */
  vault?: number;
  start: { x: number; y: number };
  /** checkpoints in order (x, y of Tiki's sign) */
  checkpoints: { x: number; y: number }[];
  goal: { x: number; y: number };
  boss?: { kind: BossKind; x0: number; x1: number; floor: number; hp: number; water?: number };
  /** rules for the whole stage */
  rules: {
    lowg?: boolean; dark?: boolean; heat?: boolean; rain?: boolean; beat?: number; wind?: number; fog?: boolean;
    chase?: { speed: number; delay: number; kind: "beam" | "boulder" | "wave" | "lava" | "swarm" | "storm" | "collapse" };
    /** a rising flood of lava or dust (deadly) */
    rise?: { speed: number; delay: number; kind: "lava" | "dust"; from: number };
    /** Puddo can wall-jump (chimneys) */
    walljump?: boolean;
    /** a dust storm: thick haze and gusts */
    dust?: boolean;
    /** on top of a moving train: the scenery rushes past */
    train?: boolean;
    /** downhill ice: Puddo slides faster */
    slide?: boolean;
  };
  tod: TimeOfDay;
  /** a friend handed out at the start */
  startFriend?: FriendId;
  /** an endless stage blends two zones: the look of `island`, the army of `mix` */
  mix?: IslandId;
  twist?: string;
  music: string;
  /** "NEW" hint shown on the intro card */
  hint?: string;
}

export type SimEvent =
  | { t: "jump" } | { t: "land"; hard: boolean } | { t: "coin"; x: number; y: number } | { t: "fruit"; x: number; y: number }
  | { t: "drop"; x: number; y: number; n: number } | { t: "heart" } | { t: "juice" } | { t: "hurt"; why: string } | { t: "crack" }
  | { t: "shoot"; w: Weapon; x: number; y: number } | { t: "bomb" } | { t: "boom"; x: number; y: number; r: number }
  | { t: "hit"; x: number; y: number } | { t: "shield"; x: number; y: number }
  | { t: "melt"; x: number; y: number; enemy: EnemyKind; elite: boolean } | { t: "kick" } | { t: "stomp"; x: number; y: number }
  | { t: "break"; x: number; y: number } | { t: "pot"; x: number; y: number; item: PotItem }
  | { t: "friend"; f: FriendId } | { t: "friendLost"; f: FriendId } | { t: "checkpoint"; n: number } | { t: "gong"; height: number; coins: number }
  | { t: "bounce" } | { t: "spring" } | { t: "swim" } | { t: "splash" } | { t: "switch"; on: boolean } | { t: "star" }
  | { t: "fire" } | { t: "laser" } | { t: "crusher" } | { t: "arrow" } | { t: "cannon" } | { t: "geyser" }
  | { t: "rock" } | { t: "ice" } | { t: "bossHit"; hp: number } | { t: "bossRoar" } | { t: "bossDown" }
  | { t: "bell" } | { t: "clear" } | { t: "respawn" } | { t: "secretFound" } | { t: "stretch" } | { t: "hover" } | { t: "glide" }
  | { t: "pickup"; w: Weapon } | { t: "lostWeapon" } | { t: "bombs"; n: number } | { t: "combo"; n: number; mult: number }
  | { t: "super" } | { t: "stormFull" } | { t: "foeShot"; x: number; y: number } | { t: "spawn"; x: number; y: number }
  | { t: "gateClose" } | { t: "gateOpen" } | { t: "wave"; n: number; of: number } | { t: "pumpDown"; x: number; y: number }
  | { t: "cageOpen"; x: number; y: number } | { t: "key"; n: number } | { t: "doorOpen" } | { t: "wellHit"; hp: number }
  | { t: "lifeLost"; lives: number } | { t: "failed" } | { t: "goalDone" } | { t: "loot"; x: number; y: number }
  | { t: "alarm"; x: number; y: number } | { t: "cartHit"; hp: number } | { t: "huntDown"; n: number } | { t: "aim"; x: number; y: number; tx: number; ty: number };

export interface SimResult {
  n: number; key: string; island: IslandId; s: number; name: string; concept: Concept;
  cleared: boolean; coins: number; drops: number; noHit: boolean; time: number; hits: number;
  melted: number; bestCombo: number; livesLeft: number;
}

export interface Hud {
  hearts: number; maxHearts: number; lives: number; coins: number; drops: number; friend?: FriendId;
  weapon: Weapon; bombs: number; maxBombs: number; storm: number; superOn: boolean; combo: number; mult: number;
  star: number; bossHp?: number; bossMax?: number; bossName?: string; progress: number;
  checkpoint: number; time: number; dark: boolean;
  /** the goal tracker: "Pumps 2/4", "Well 80%", "Wave 3/6", "0:42" */
  goal?: { label: string; have: number; need: number; time?: number };
}
