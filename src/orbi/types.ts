// Orbi GP shared types: the track (segments), the things on it, a stage, the marbles and their events.
// Everything lives in track space: s = metres along the road, u = metres across (right +), h = metres up off the road.

export type Floor = "road" | "gap";
export interface Seg {
  len: number;
  /** radians turned / climbed / rolled over the segment; `shift` = sideways metres (to step aside) */
  yaw: number; pitch: number; twist?: number; shift?: number;
  width: number;
  /** low curbs that keep you on (left / right) */
  railL: boolean; railR: boolean;
  floor: Floor;
  /** cross-section: > 0 a rounded crown (a beam or a log: you roll off the sides), < 0 a dish (pulls you to the middle) */
  crown?: number;
  /** the road's look on this stretch ("plank", "rope", "glass", "ice", "candy"…) */
  look?: string;
  /** a glass tube round the road (pipes, tunnels, hyper loops) */
  tube?: boolean;
}

export type PowerKind = "turbo" | "magnet" | "shield" | "jump" | "giant" | "feather" | "bridge" | "star";
export type ZoneKind =
  | "ice" | "sticky" | "sand" | "lowg" | "heavyg" | "wind" | "vent" | "conveyor" | "lava" | "speed"
  // magnet: you stick to the road (loops, wall rides, upside-down runs) while you keep rolling; pull: a black hole in the
  // middle drags you in; slow: a speed trap; limit: a speed limit (over it, you are slowed); paint: rolls your marble a colour
  | "magnet" | "pull" | "slow" | "limit" | "paint" | "rumble"
  // the look of a stretch: weather (rain, fog, sandstorm, smoke, snow, petals, code, fireworks, dark) and camera twists
  | "weather" | "view";
export type ObjKind =
  // pickups
  | "coin" | "gem" | "orb" | "capsule" | "star" | "heart" | "letter" | "chest" | "gold"
  // launchers and helpers
  | "pad" | "boost" | "tramp" | "ring" | "portal" | "switch" | "rocket"
  // surfaces over gaps (platforms, tiles that fall, seesaws, rolling logs, tilting plates)
  | "plat" | "tile" | "seesaw" | "log" | "tilt" | "disc"
  // hazards
  | "bumper" | "block" | "hammer" | "sweeper" | "laser" | "spikes" | "chaser" | "core" | "mine"
  // zones (painted stretches with an effect)
  | "zone"
  // race furniture
  | "check" | "finish" | "deco";

/** u / h / s: slide to and fro; spin: turn (amp > 0: swing back and forth by amp radians); swing: a pendulum (u and a dip) */
export interface Motion { ax: "u" | "h" | "s" | "spin" | "swing"; amp: number; period: number; phase: number }
export interface Obj {
  id: number; k: ObjKind;
  s: number; u: number;
  /** height off the road (surfaces: their top) */
  h?: number;
  /** half-length along the road / half-width across (surfaces, zones, blocks) or radius (bumpers, pickups) */
  ds?: number; w?: number;
  /** how tall (hazards: you fly over taller-than-this only with a jump) */
  tall?: number;
  mov?: Motion;
  /** strength: pad launch, boost, zone push, hammer knock, sweeper length… */
  p?: number;
  zone?: ZoneKind;
  power?: PowerKind;
  /** falling tiles: seconds after the first touch before they drop */
  fall?: number;
  /** blink: [period, phase, duty] — on for the first `duty` (default half) of the period (lasers, spikes, beat tiles) */
  blink?: [number, number, number?];
  /** switch bridges: this surface is there only while switch `gate` is on (switches: the gate they open) */
  gate?: number;
  look?: string;
}

/** a hint for the robot marbles: steer to u between s and until (and slow to `slow` × top speed, jump at s) */
export interface Intent { s: number; until: number; u?: number; slow?: number; jump?: boolean; /** ride this moving platform (object id) */ follow?: number; /** hold this line until past it (rows of mines): no looking ahead to the next hint */ now?: boolean }

export type StageKind = "opener" | "learn" | "mix" | "breather" | "burner" | "boss" | "remix";
export interface StageRules {
  /** collect this many coins / all three stars / fly through every ring */
  coins?: number; stars?: boolean; rings?: boolean;
  /** the last marble at every checkpoint is out (elimination) */
  elim?: boolean;
  /** a chaser rolls behind you: don't get caught */
  escape?: boolean;
  /** lead at every checkpoint */
  lead?: boolean;
  /** use this many powers / no capsules at all / land this many tricks */
  powers?: number; nopower?: boolean; tricks?: number;
  /** start rolling (a flying start) */
  rolling?: boolean;
  /** hit Kranky's machine's cores (a boss): how many */
  cores?: number;
  /** finish in the top 3 to pass (otherwise: finish anywhere) */
  podium?: boolean;
  /** first place only */
  win?: boolean;
  /** beat this time (s) */
  time?: number;
  /** no falls allowed */
  noFall?: boolean;
}
export interface Stage {
  n: number; seed: number; world: number; stage: number; kind: StageKind; d: number;
  name: string;
  /** the idea this stage teaches (journey), or the ideas it mixes (remix) */
  meet?: string; mix?: string[];
  concepts: string[];
  segs: Seg[];
  objs: Obj[];
  intents: Intent[];
  /** checkpoint distances and the finish line */
  checks: number[]; finish: number;
  /** marbles on the grid besides you, and how good they are (0..1) */
  rivals: number; skill: number;
  /** top rolling speed (m/s) */
  vmax: number;
  /** the powers a capsule can give on this stage */
  powers: PowerKind[];
  rules: StageRules;
  look: { world: number; blend?: number; seed: number };
  /** gold time (s): the robot's time, a little faster */
  gold: number;
  y0?: number;
  /** the beat (s) the music plays at: beat pieces are timed to it */
  beat?: number;
  /** Kranky's machine on a boss stage (its look: 0–24, one per world) */
  boss?: number;
  /** the final cup (stage 500), a duel, a champion rival… */
  special?: "final" | "duel" | "champion" | "leader" | "rush" | "ghost" | "royale";
}

export interface Marble {
  id: number; name: string; skin: number;
  s: number; u: number; h: number; vs: number; vu: number; vh: number;
  air: boolean;
  /** the surface object underfoot (-1: the road) */
  on: number;
  /** rolling angle (for the look) and the last move direction */
  roll: number;
  /** the radius right now (giant power) */
  r: number;
  /** stunned after a big knock (no grip for a moment), blinking after a respawn */
  stun: number; ghost: number;
  /** last checkpoint index, falls, finish state */
  check: number; falls: number; fallT: number; finished: boolean; finishT: number;
  /** the boost meter (0..1), boost time left, the power held and the powers running */
  meter: number; boostT: number; held: PowerKind | null; active: Partial<Record<PowerKind, number>>;
  coins: number; gems: number; stars: number;
  /** time in the air, style points */
  airT: number; style: number;
  /** race position (1 = first), live */
  place: number;
  /** hearts held (each saves a fall), O-R-B-I letters (bits), rings flown through, tricks landed, the trick chain,
   *  powers used, the paint colour, out (eliminated), caught by the chaser, cores hit, near misses */
  hearts: number; letters: number; rings: number; tricks: number; combo: number; used: number; paint: number;
  out: boolean; caught: boolean; cores: number; near: number;
  /** hyper boost time left (a rocket booster: up to 350 km/h) */
  hyper: number;
}

export type Ev =
  | { t: "coin"; m: number; o: Obj } | { t: "gem"; m: number; o: Obj } | { t: "orb"; m: number; o: Obj } | { t: "star"; m: number; o: Obj }
  | { t: "capsule"; m: number; o: Obj; p: PowerKind } | { t: "power"; m: number; p: PowerKind }
  | { t: "pad"; m: number; o: Obj } | { t: "boost"; m: number } | { t: "tramp"; m: number; o: Obj }
  | { t: "jump"; m: number } | { t: "land"; m: number; vh: number }
  | { t: "bump"; m: number; o: Obj | null; k: number } | { t: "rail"; m: number; k: number }
  | { t: "fall"; m: number } | { t: "respawn"; m: number } | { t: "saved"; m: number }
  | { t: "check"; m: number; i: number } | { t: "finish"; m: number; place: number }
  | { t: "trick"; m: number; n: number } | { t: "tile"; m: number; o: Obj }
  | { t: "ring"; m: number; o: Obj } | { t: "portal"; m: number; o: Obj } | { t: "switch"; m: number; o: Obj }
  | { t: "heart"; m: number; o: Obj } | { t: "letter"; m: number; o: Obj; n: number } | { t: "chest"; m: number; o: Obj } | { t: "goldcoin"; m: number; o: Obj }
  | { t: "near"; m: number; o: Obj } | { t: "caught"; m: number } | { t: "core"; m: number; o: Obj; n: number } | { t: "out"; m: number }
  | { t: "paint"; m: number; c: number } | { t: "limit"; m: number }
  | { t: "rocket"; m: number; o: Obj } | { t: "zap"; m: number; o: Obj };

export interface Input { steer: number; push: number; brake: number; jump: boolean; boost: boolean; power: boolean; trick: number }
