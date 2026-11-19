// Rollo Rush core types. Everything on a stage lives in *track space*: s = metres along the track, u = metres to the
// right of the centre line, h = metres above the track surface. The runner, every object, the fairness bot and the
// camera all use these, so the physics is simple and exactly the same on every device.
//
// Objects are described by a visual kind plus generic behaviour flags (hurts, blocks, blinks, bobs, rolls toward you,
// drops from above, a floor/air zone effect, a pickup, a launch, a gate condition…). Hundreds of ideas are combinations
// of these, so the fairness bot and the renderer handle them all the same way.

export type FloorKind =
  | "grass" | "path" | "boards" | "stone" | "falls" | "flowers" | "sand" | "snow" | "ice" | "candy" | "neon" | "metal"
  | "glass" | "crystal" | "cloud" | "rock" | "rainbow" | "water" | "leaves";
export type FenceKind = "wood" | "stone" | "metal" | "neon" | "none";
export type SegTag = "plain" | "loop" | "falls" | "bridge" | "hill" | "bank" | "boss" | "tube" | "wall" | "spiral" | "beam";

/** one piece of track: turns, climbs, banks and widens over its length */
export interface Seg {
  len: number;
  /** total turn over the segment (radians, + = left) */
  yaw: number;
  /** total pitch change (radians, + = nose up) — a loop is 2π */
  pitch: number;
  /** extra roll that accumulates over the segment (corkscrews, wall and ceiling runs) */
  twist?: number;
  /** sideways drift of the centre line over the segment (metres, + = right) — loops step aside */
  shift?: number;
  width: number;
  floor: FloorKind;
  fence: FenceKind;
  /** no floor at all (a pit) */
  gap?: boolean;
  tag: SegTag;
  /** speed is held at least at this (loops, waterfall runs, wall runs); jumping is off */
  hold?: number;
}

export type ObjKind =
  // pickups
  | "pearl" | "bigPearl" | "medal" | "item" | "power" | "magnet"
  // hazards (behaviour comes from the flags)
  | "spike" | "bar" | "wall" | "crate" | "bomb" | "laser" | "fire" | "crusher" | "door" | "roller" | "faller" | "saw" | "mine"
  | "thorn" | "swing"
  // launchers and helpers
  | "spring" | "sideSpring" | "pad" | "trickRamp" | "cannon" | "pole" | "bumper" | "tele" | "hoop" | "balloon" | "bell" | "geyser"
  | "carry"
  // ground and structures
  | "platform" | "ramp" | "rail" | "zone" | "divider" | "gate" | "switch" | "plate" | "cage"
  // creatures
  | "rollbot" | "hopper" | "drone" | "clanker" | "friend" | "critter"
  // markers
  | "lamp" | "goal" | "pearlGate" | "cam" | "sign" | "lantern"
  // the story: where Mayamma flies in and casts (a marker over the stretch)
  | "witch";

export type ZoneKind =
  | "slow" | "fast" | "ice" | "mud" | "bounce" | "belt" | "wind" | "updraft" | "lowg" | "water" | "lava" | "zap" | "goo" | "web"
  | "pull" | "dark" | "light" | "rain" | "fog" | "crumble" | "headwind" | "hot" | "underwater" | "oil" | "shrink" | "ride";

export type ItemKind = "letter" | "shard" | "chest" | "fruit" | "time" | "mystery" | "clover" | "key" | "scrap" | "gold" | "egg" | "colour" | "life" | "coin";
export type PowerKind =
  | "shield" | "fire" | "water" | "thunder" | "shoes" | "giant" | "mini" | "ghost" | "double" | "cape" | "rocket" | "snowball"
  | "star" | "slowmo" | "storm" | "scale" | "autohop" | "time" | "buddy" | "board" | "skates" | "bouncy" | "wings" | "mega";
export type CamMode = "side" | "top" | "front" | "birds" | "slowmo" | "tilt" | "wide" | "eye" | "drone" | "photo" | "rear" | "lens";

/** what opens a gate (or brings a bridge out) */
export interface Need { k: "switch" | "key" | "bells" | "colour" | "speedMin" | "speedMax" | "pearls" | "lanterns" | "bonks"; v: number; g?: number }

/** an object on the track. Moving ones move with the runner's distance to them (fair and repeatable) */
export interface Obj {
  id: number;
  k: ObjKind;
  s: number; u: number; h: number;
  /** half sizes along s and u, and the height of the box */
  ds?: number; w?: number; tall?: number;
  /** lateral sweep: u(t) = u + amp·sin(freq·(sObj − sRunner) + ph) */
  amp?: number; ph?: number; freq?: number;
  /** spring power / pad strength / pearl gate count / side-spring push / teleport distance … */
  p?: number;
  /** set when taken / broken / opened during play */
  gone?: boolean;
  // ---- behaviour flags
  /** hurts on contact (unless curled, rushing, shielded…) */
  harm?: boolean;
  /** a ball (or Turbo, or a Burst) smashes it */
  ballOk?: boolean;
  /** can be bonked from above */
  stomp?: boolean;
  /** active only part of the time: [period m, on fraction, phase 0..1] — by the runner's distance to it */
  blink?: [number, number, number];
  /** bobs up and down: [amp m, freq per m, phase] */
  bob?: [number, number, number];
  /** rolls toward the runner at this fraction of his speed once he is within 70 m */
  roll?: number;
  /** drops from the sky as the runner closes from this distance to it */
  drop?: number;
  /** rises out of the ground as the runner closes from this distance to it */
  rise?: number;
  /** a dropping / rising thing is down (or up) this far before the runner reaches it (magic lands early) */
  land?: number;
  zone?: ZoneKind;
  item?: ItemKind;
  power?: PowerKind;
  /** launches you: [up speed, forward boost, sideways] */
  launch?: [number, number, number];
  need?: Need;
  /** model variant (usually the concept id) */
  look?: string;
  /** a Star Hop target */
  target?: boolean;
  /** switch / bell / colour group */
  group?: number;
  /** lateral push (gusts, bumpers, belts) */
  push?: number;
  /** a camera mode for this stretch */
  cam?: CamMode;
  /** carries you: rise to this height and float until s + carry */
  carry?: number;
  /** a friend / critter that runs at this speed factor */
  pace?: number;
}

/** what the stage expects the player to do somewhere (read by the fairness bot) */
export interface Intent {
  s: number; act: "steer" | "jump" | "curl" | "double" | "burst" | "tap" | "pound" | "brake" | "wiggle"; u?: number; until?: number;
  /** where the thing to dodge or reach is (the bot only reacts once it is within reaction distance of it) */
  at?: number;
}

export type StageKind = "opener" | "learn" | "mix" | "breather" | "speed" | "twist" | "burner" | "star" | "boss" | "remix";

export type BossWeak = "ball" | "spring" | "hop" | "burst";
export interface BossSpec { kind: string; hits: number; weak: BossWeak; attacks: string[]; look: string; name: string }

/** stage rules (challenge stages) */
export interface StageRules {
  /** seconds to reach the goal */
  time?: number;
  /** one hit sends you back to the last lantern */
  noHit?: boolean;
  /** collect R-O-L-L-O */
  letters?: boolean;
  /** keep Momo safe on your back (a hit = back to the lantern) */
  escort?: boolean;
  /** never drop below this speed */
  minSpeed?: number;
  /** stay in the light (dark stages) */
  light?: boolean;
  /** reach a combo this big */
  combo?: number;
  /** find all three Moon Medals */
  medals?: boolean;
  /** don't bonk any Clanker */
  noBonk?: boolean;
  /** bonk this many Clankers */
  bonkAll?: number;
  /** survive this many seconds (the goal opens after) */
  survive?: number;
  /** pearls fade away after a while */
  fade?: boolean;
  /** every landing must be gentle */
  softLand?: boolean;
  /** light this many lanterns */
  lanterns?: number;
  /** catch the thief */
  thief?: boolean;
  /** beat the ghost / the rival to the goal */
  race?: "ghost" | "rival" | "train";
  /** a countdown on the last stretch */
  sprint?: number;
  /** carry the egg (no hits, no hard landings) */
  egg?: boolean;
  /** splits to beat at each lantern */
  splits?: boolean;
}

export interface StageView {
  /** mirrored world (left ↔ right) */
  mirror?: boolean;
  /** darkness, lit by Rollo's lamp and the lanterns */
  dark?: boolean;
  /** lightning flashes light the way */
  flash?: boolean;
  dream?: boolean;
  underwater?: boolean;
  fog?: boolean;
  rain?: boolean;
  snow?: boolean;
  /** the sky turns from day to night across the stage */
  dayToNight?: boolean;
  /** music off */
  silent?: boolean;
  /** music speeds up as you go */
  tempoUp?: boolean;
  /** big echo */
  echo?: boolean;
  /** lights flash with the beat */
  lightShow?: boolean;
  /** the camera runs in front, looking back */
  front?: boolean;
}

export interface Stage {
  n: number; seed: number; world: number; stage: number; kind: StageKind; d: number;
  name: string;
  /** the concept this stage introduces (journey) */
  meet?: string;
  /** every concept the stage shows (for the Dex and the remix memory) */
  concepts: string[];
  remix?: { name: string; key: string; atoms: string[]; blend: number };
  segs: Seg[];
  objs: Obj[];
  intents: Intent[];
  /** checkpoint distances (lamps) and the goal distance */
  checks: number[];
  goal: number;
  /** speeds for this stage (m/s) */
  run: number; turbo: number;
  /** pearls needed at the goal (Pearl Target stages) */
  target?: number;
  boss?: BossSpec;
  rules?: StageRules;
  view?: StageView;
  /** something chasing you: it gains when you slow down */
  chase?: { kind: string; gap: number; speed: number; from: number; to: number };
  /** a rival / ghost / train running alongside */
  rival?: { kind: string; lead: number; speed: number };
  /** gravity multiplier for the whole stage (space) */
  gravity?: number;
  /** unlocked moves on this stage (what the HUD hints and the controls allow) */
  moves: Moves;
  look: { world: number; blend?: number; seed: number };
  /** the height the stage starts at (it carries on from the stage before) */
  y0?: number;
  /** a stage of one of the modes (Moon Run, Daily Sprint, Time Trial, Boss Rush, Trick Park) and its place in that run */
  mode?: string; alt?: number;
}
export interface Moves {
  curl: boolean; double: boolean; burst: boolean; trick: boolean;
  pound?: boolean; slide?: boolean; hop?: boolean; dash?: boolean; flick?: boolean; brake?: boolean; whip?: boolean; guard?: boolean;
  rush?: boolean; drift?: boolean; skip?: boolean; leap?: boolean;
}

/** the runner's state */
export interface Runner {
  s: number; u: number; h: number;
  v: number; vu: number; vh: number;
  air: boolean; ball: boolean; slide: number;
  /** lateral target from the finger */
  ut: number;
  /** 0..1 boost meter, seconds of turbo left, seconds of Moon Rush left */
  boost: number; turbo: number; rush: number;
  /** seconds of hit-stun (no control, Jog speed) and of mercy blink */
  stun: number; blink: number;
  scales: number; pearls: number; streak: number;
  jumps: number;
  /** seconds of pearl magnet left */
  magnet: number;
  /** the last checkpoint passed (index into stage.checks, −1 = start) */
  check: number;
  fell: boolean; done: boolean;
  /** a one-run mode is over (knocked out or fell) */
  out?: boolean;
  time: number; hits: number; medals: number;
  trick: number;
  // ---- the bigger set of moves and states
  /** the rail being ground (object id, 0 = none) */
  rail: number;
  /** the zone under / around us (for sound and the HUD) */
  zone: ZoneKind | "";
  /** seconds left of each power */
  powers: Partial<Record<PowerKind, number>>;
  /** a Star Hop in progress */
  homing: { id: number; t: number; s0: number; u0: number; h0: number } | null;
  /** seconds of air dash, slow-mo, carry */
  dash: number; slowmo: number;
  carry: { until: number; h: number } | null;
  pound: boolean;
  /** when the ball started (scale guard) */
  ballAt: number;
  /** style points and the current combo */
  style: number; combo: number;
  keys: number; letters: number; shards: number; bells: number; switches: number; colour: number; lanterns: number; bonks: number;
  /** web wiggles left */
  wiggle: number;
  /** seconds left on a timed stage */
  timeLeft: number;
  /** gold coins and hearts picked up on this stage */
  coins: number; hearts: number;
  /** chaser distance behind (m), rival position (track s) */
  chase: number; rival: number;
  /** water sinking timer, drift charge, overheat */
  sink: number; drift: number; heat: number;
  /** a rule broke (the HUD says why) */
  failed: string;
}

export type SimEvent =
  | { t: "pearl"; o: Obj; streak: number } | { t: "bigPearl"; o: Obj } | { t: "medal"; o: Obj }
  | { t: "jump"; double: boolean } | { t: "land"; vh: number } | { t: "curl"; on: boolean }
  | { t: "pad"; o: Obj } | { t: "spring"; o: Obj } | { t: "side"; o: Obj }
  | { t: "hit"; o: Obj | null; why: string } | { t: "smash"; o: Obj } | { t: "bonk"; o: Obj }
  | { t: "fall" } | { t: "out" } | { t: "check"; i: number } | { t: "goal" } | { t: "turbo" } | { t: "rush"; on: boolean }
  | { t: "magnet"; o: Obj } | { t: "trick"; n: number } | { t: "gate"; ok: boolean; o: Obj } | { t: "burst" }
  | { t: "item"; o: Obj } | { t: "power"; o: Obj; p: PowerKind } | { t: "rail"; on: boolean } | { t: "hop"; o: Obj }
  | { t: "dash" } | { t: "pound" } | { t: "guard" } | { t: "tele"; o: Obj } | { t: "launch"; o: Obj } | { t: "switch"; o: Obj }
  | { t: "open"; o: Obj } | { t: "fail"; why: string } | { t: "carry"; on: boolean } | { t: "caught" } | { t: "zone"; z: ZoneKind | "" }
  | { t: "boom" } | { t: "hoop"; o: Obj } | { t: "wiggle"; left: number }
  /** a saved life was used (instead of going back to the lantern) */
  | { t: "life" };
