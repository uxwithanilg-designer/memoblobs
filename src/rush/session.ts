// The Rollo Rush run: one-thumb touch controls (drag anywhere to steer, swipe up to hop, swipe down to curl, flick
// sideways in the air for a trick, tap to Burst) plus the keyboard; the fixed-step physics; the fly-in when a run starts;
// checkpoints; the music (a new mix every stretch, a sparkle layer at Turbo) and the sound set; haptics. The run never
// stops: while you play, a worker builds the next stage, its track is joined onto the end of this one, and the moment
// Rollo crosses the join he is simply running on it — same speed, same pearls, nothing on screen to say so.
import { audio } from "@/lib/audio";
import { hash32 } from "../roll/rng";
import { RollMusic } from "../roll/music";
import type { SectionKind, SongPlan, SongZone } from "../roll/types";
import { worldOf } from "./data/worlds";
import type { RemixMemory } from "./gen";
import { RushRenderer, type Quality } from "./render3d";
import { RushSfx, type Ground } from "./sfx";
import { Sim, type Ev, type Input } from "./sim";
import { knownAt, makeStage } from "./stages";
import { Track } from "./track";
import type { Stage } from "./types";
import type { RushAsk, RushReply } from "./worker";
import { MAGIC_NAME } from "./magicdata";
import { ONE_RUN, PARK_TIME, SINGLE, type ModeId, type ModeRun } from "./modes";
import { CUES, INTRO_LEN, ROLLO_S, storyAt, type Cue, type StoryFrame } from "./story/intro";
import { ENTRANCES, EXITS, LAUGHS, LINES, SHOUTS, taunt } from "./story/lines";

export interface RushHud {
  world: number; worldName: string; emoji: string;
  /** pearls in hand (the run's running count), and this stretch's own count for a pearl gate */
  pearls: number; got: number; target?: number;
  scales: number; boost: number; turbo: boolean; rush: boolean; streak: number;
  /** metres run, all time */
  dist: number;
  boss: { hp: number; max: number; tired: boolean; kind: string; name: string; weak: string } | null;
  intro: boolean; moves: Stage["moves"];
  /** saved lives and the gold coins picked up this run */
  lives: number; coins: number;
  /** what this stretch asks of you (a clock, letters, a race, a chaser, no bumps…) */
  chips: string[];
  /** powers running now, with seconds left */
  powers: { k: string; t: number }[];
  /** a mode run: its id, the big number (distance, clock, score) and a small line under it */
  mode: { id: ModeId; main: string; sub?: string } | null;
}
/** how a mode run went */
export interface ModeResult {
  id: ModeId; finished: boolean;
  /** metres (Moon Run), seconds (Daily Sprint, Time Trial, Boss Rush) or points (Trick Park) */
  score: number; time: number; metres: number; pearls: number; coins: number; stages: number;
  rank?: Rank; n?: number; bosses?: number;
  /** the run, 10 samples a second (s x10, u x100, h x100), for a Time Trial ghost */
  ghost?: number[];
}
export type Rank = "S" | "A" | "B" | "C";
export interface StageResult { n: number; rank: Rank; time: number; pearls: number; total: number; medals: number; hits: number; metres: number; coins: number; concepts: string[]; remix?: { name: string; key: string; atoms: string[] } }
export type RushOut =
  | { t: "check"; i: number; pearls: number }
  | { t: "done"; st: Stage; res: StageResult }
  /** the run carried on onto this stage (save it, so a resume starts here) */
  | { t: "next"; st: Stage }
  | { t: "fell" }
  | { t: "hint"; move: string }
  /** a stage rule was broken (back to the last lantern) */
  | { t: "fail"; why: string }
  /** the story: the cinematic starts / ends; a voiced line (for the subtitles); the title card */
  | { t: "story"; on: boolean } | { t: "line"; who: string; text: string; dur: number } | { t: "title" }
  /** Mayamma arrives / leaves; one of her magics (for the toast and the spellbook) */
  | { t: "witch"; on: boolean } | { t: "magic"; id: string; name: string }
  /** a saved life was used; a heart was picked up */
  | { t: "life" } | { t: "heart" }
  | { t: "power"; p: string }
  /** a mode run ended */
  | { t: "modeEnd"; res: ModeResult };
/** what the journey save listens to (a mode run never touches it) */
const JOURNEY_ONLY = new Set<RushOut["t"]>(["check", "done", "next", "life", "heart"]);

export interface RushOptions {
  quality: Quality; haptics: boolean; reduced: boolean; salt: number;
  memory: () => RemixMemory;
  /** metres run before the stage being loaded (all time) */
  odo?: () => number;
  /** saved lives (from the save) */
  lives?: () => number;
  onHud?: (h: RushHud) => void;
  onOut?: (e: RushOut) => void;
}

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["break", 1], ["chorus", 3], ["build", 2]];

export function rankOf(st: Stage, time: number, pearls: number, total: number, hits: number): Rank {
  const par = st.goal / st.run;
  const pk = total ? pearls / total : 1;
  if (hits === 0 && pk >= 0.8 && time <= par * 1.1) return "S";
  if (hits <= 1 && pk >= 0.6) return "A";
  if (pk >= 0.35 && hits <= 3) return "B";
  return "C";
}

export class RushSession {
  readonly r: RushRenderer;
  st: Stage | null = null;
  tr: Track | null = null;
  sim: Sim | null = null;
  private o: RushOptions;
  private host: HTMLElement;
  private ro: ResizeObserver;
  private raf = 0; private last = 0;
  paused = false;
  private destroyed = false;
  private sfx = new RushSfx();
  private music: RollMusic | null = null;
  private musicOn = false;
  private feverOn = false;
  private intro = 0;
  /** where the next stage joins on (this stage's goal), the next stage once built, and the one joined on */
  private joinS = 0;
  private pending: Stage | null = null;
  private next: { st: Stage; tr: Track; sim: Sim } | null = null;
  /** seconds spent past the goal waiting for the next stage (it is nearly always ready long before) */
  private waitT = 0;
  /** metres run before this stage */
  private odo = 0;
  private hudT = 0;
  private total = 0;
  private input: Input = { ut: 0, jump: false, curl: false, burst: false, trick: false };
  private keys = new Set<string>();
  private touch: { id: number; x0: number; y0: number; x: number; y: number; t0: number; ut0: number; swiped: boolean } | null = null;
  /** a second finger held down: brake */
  private brakeId = -1;
  private worker: Worker | null = null;
  private ask = 0;
  private waiting = new Map<number, (st: Stage) => void>();
  private stepPhase = 0;
  // ---- the story
  /** time into the cinematic (−1 = not playing), where it plays, the next cue */
  private storyT = -1; private storyBase = 0; private cueAt = 0;
  /** seconds of voice still playing; things to do a little later */
  private talking = 0; private later: { t: number; f: () => void }[] = [];
  private witchHere = false; private castN = 0; private coinsRun = 0;
  private lastMagic = ""; private lastMagicAt = 0;
  private told = new Set<string>();
  /** the title screen: the camera circles Rollo, nothing runs */
  private title = false;
  // ---- a mode run
  mode: ModeRun | null = null;
  private modeK = 0; private modeT = 0; private modeScore = 0; private modeOdo = 0; private modeOver = false; private modeCoins = 0;
  private rec: number[] = []; private recT = 0;
  /** the ghost to race (Time Trial): best time and its samples */
  private ghost: { t: number; p: number[] } | null = null;

  constructor(host: HTMLElement, o: RushOptions) {
    this.host = host;
    // a mode run never writes the journey save (its checkpoints, results, lives)
    this.o = { ...o, onOut: (e) => { if (this.mode && JOURNEY_ONLY.has(e.t)) return; o.onOut?.(e); } };
    this.r = new RushRenderer(host, o.quality);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    const cv = this.r.cv;
    cv.addEventListener("pointerdown", this.onDown); cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp); cv.addEventListener("pointercancel", this.onUp);
    cv.addEventListener("contextmenu", this.noMenu);
    window.addEventListener("keydown", this.onKey); window.addEventListener("keyup", this.onKeyUp);
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
      this.worker.onmessage = (e: MessageEvent<RushReply>) => { const f = this.waiting.get(e.data.id); this.waiting.delete(e.data.id); if (f) f(e.data.st); };
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; };
    } catch { this.worker = null; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.r.onWitch = (w) => this.witchEvent(w);
    this.r.onMagic = (what, id, pan) => this.magicEvent(what, id, pan);
  }
  private resize() { const b = this.host.getBoundingClientRect(); this.r.resize(b.width, b.height); }
  get portrait() { const b = this.host.getBoundingClientRect(); return b.height >= b.width; }

  // ---------------------------------------------------------------- stages
  /** a stage, built by the worker (or here, if there is no worker); `y0`: the height it starts at */
  stage(n: number, y0?: number, mode?: ModeRun): Promise<Stage> {
    if (this.worker) return new Promise((res) => { const id = ++this.ask; this.waiting.set(id, res); this.worker!.postMessage({ id, n, salt: this.o.salt, mem: this.o.memory(), y0, mode } satisfies RushAsk); });
    return Promise.resolve(makeStage(n, this.o.salt, this.o.memory(), y0, mode));
  }
  /** this mode run stops at the end of the stage underfoot */
  private modeEndsHere() { const m = this.mode; return !!m && (SINGLE[m.id] || (m.id === "boss" && this.modeK >= (m.bosses ?? 1))); }
  private goalOf(st: Stage) { return st.objs.find((o) => o.k === "goal")?.s ?? st.goal; }
  /** start building the stage after this one, at the height of this one's goal */
  private askNext() {
    const st = this.st!, tr = this.tr!;
    const y0 = tr.frame(this.goalOf(st), new Float32Array(12))[1];
    this.pending = null;
    if (this.mode && this.modeEndsHere()) return;
    const m = this.mode;
    void this.stage(m ? this.modeK + 1 : st.n + 1, Math.round(y0 * 10) / 10, m ?? undefined).then((nx) => { if (this.st === st) { this.pending = nx; this.attach(); } });
  }
  /** join the next stage's track onto this one's goal (once the goal is where it will stay: after a boss, it moves) */
  private attach() {
    const st = this.st, tr = this.tr, sim = this.sim, nx = this.pending;
    if (!st || !tr || !sim || !nx || this.next) return;
    if (sim.boss && sim.boss.phase !== "down" && !sim.r.done) return;
    this.joinS = this.goalOf(st);
    const fr = tr.frame(this.joinS, new Float32Array(12));
    const ntr = new Track(nx.segs, undefined, { p: [fr[0], fr[1], fr[2]], f: [fr[3], fr[4], fr[5]], u: [fr[6], fr[7], fr[8]] });
    const nsim = new Sim(nx, ntr, knownAt(nx.n));
    nsim.lives = sim.lives; nsim.oneRun = sim.oneRun;
    this.next = { st: nx, tr: ntr, sim: nsim };
    this.r.setNext(nx, ntr, nsim, this.joinS);
  }
  /** Rollo crossed the join: carry him (speed, pearls, scales, powers…) onto the next stage */
  private crossOver() {
    const old = this.sim!, o = old.r, nx = this.next!;
    this.finish();
    const n = nx.sim.r;
    n.s = Math.max(0, o.s - this.joinS);
    n.u = o.u; n.h = o.h; n.v = o.v; n.vu = o.vu; n.vh = o.vh; n.air = o.air; n.ball = o.ball; n.slide = o.slide; n.ut = o.ut;
    n.boost = o.boost; n.turbo = o.turbo; n.rush = o.rush; n.stun = o.stun; n.blink = o.blink; n.scales = o.scales; n.streak = o.streak;
    n.jumps = o.jumps; n.magnet = o.magnet; n.trick = o.trick; n.powers = { ...o.powers }; n.dash = o.dash; n.slowmo = o.slowmo; n.pound = o.pound;
    n.style = o.style; n.combo = o.combo; n.drift = o.drift; n.heat = o.heat;
    nx.sim.carry(o.pearls);
    nx.sim.lives = old.lives; nx.sim.oneRun = old.oneRun;
    if (this.mode) { this.modeK++; this.modeOdo += this.joinS; this.modeCoins += this.coinsRun; this.coinsRun = 0; }
    // a new world: Mayamma taunts from afar
    if (nx.st.stage === 1 && nx.st.world !== this.st!.world) this.soon(1.2, () => this.say(taunt(nx.st.world)));
    this.odo += this.joinS;
    this.st = nx.st; this.tr = nx.tr; this.sim = nx.sim; this.next = null; this.pending = null; this.waitT = 0;
    this.joinS = this.goalOf(nx.st);
    this.total = nx.st.objs.filter((x) => x.k === "pearl").length + nx.st.objs.filter((x) => x.k === "bigPearl").length * 10;
    this.r.advance();
    this.startMusic(true);
    this.sfx.ambience(worldOf(nx.st.look.world).sky === "night");
    this.o.onOut?.({ t: "next", st: nx.st });
    this.askNext();
    this.hintMoves();
  }
  setTitle(on: boolean) {
    this.title = on;
    if (on) this.r.playShot("goal"); else { this.intro = 2.4; this.r.playShot("intro"); }
  }
  /** start (or resume at a checkpoint) a stage */
  load(st: Stage, check = -1, pearls = 0) {
    this.st = st;
    this.tr = new Track(st.segs, [0, st.y0 ?? 24, 0]);
    this.sim = new Sim(st, this.tr, knownAt(st.n));
    this.sim.lives = this.mode ? 0 : this.o.lives?.() ?? 0;
    this.sim.oneRun = !!this.mode && ONE_RUN[this.mode.id];
    this.next = null; this.pending = null; this.waitT = 0;
    this.joinS = this.goalOf(st);
    this.odo = this.o.odo?.() ?? 0;
    this.total = st.objs.filter((o) => o.k === "pearl").length + st.objs.filter((o) => o.k === "bigPearl").length * 10;
    if (check >= 0 && st.checks[check] !== undefined) {
      const r = this.sim.r;
      r.check = check; r.s = st.checks[check]; r.pearls = pearls;
      for (const o of st.objs) if (o.s <= r.s && (o.k === "lamp" || o.k === "pearl" || o.k === "bigPearl")) o.gone = true;
    }
    this.r.setStage(st, this.tr, this.sim);
    if (this.title) this.r.playShot("goal");
    this.intro = 2.4; this.feverOn = false;
    this.input = { ut: 0, jump: false, curl: false, burst: false, trick: false };
    this.startMusic();
    this.sfx.ambience(worldOf(st.look.world).sky === "night");
    this.askNext();
    this.pushHud();
  }

  // ---------------------------------------------------------------- music: a new mix every stage
  /** `blend`: the run carries on, so the old mix fades slowly under the new one */
  private startMusic(blend = false) {
    const st = this.st!; const W = worldOf(st.look.world);
    const style = W.music.styles[(st.n + st.look.seed) % W.music.styles.length];
    const mood = st.kind === "boss" ? "kranky boss" : st.kind === "burner" ? `${W.music.mood} danger` : st.kind === "breather" ? `${W.music.mood} calm` : W.music.mood;
    const zones: SongZone[] = []; let b = 0;
    for (let i = 0; i < SECTIONS.length; i++) { const [section, intensity] = SECTIONS[(i + st.n) % SECTIONS.length]; zones.push({ beat0: b, beats: 16, mood, section, intensity: Math.min(3, intensity + (st.kind === "boss" || st.kind === "burner" ? 1 : 0)), style }); b += 16; }
    const theme = st.stage > 0 ? hash32(st.world, Math.floor((st.stage - 1) / 5), 0x9a11) : hash32(st.n, st.seed, 0x9a11);
    const root = 45 + (st.n % 9);
    const plan: SongPlan = { bpm: W.music.bpm + ((st.n * 5) % 9) - 4 + (st.kind === "boss" ? 8 : 0) + (st.view?.tempoUp ? 14 : 0), root, seed: theme, zones, beats: b };
    this.sfx.setKey(root);
    const old = this.music; old?.stop(blend ? 1.6 : 0.6); if (old) setTimeout(() => old.dispose(), blend ? 1900 : 800);
    try { this.music = st.view?.silent ? null : new RollMusic(plan, 1); if (this.music) this.music.loop = true; } catch { this.music = null; }
    this.musicOn = false;
    const ctx = audio.ensure();
    if (this.music && ctx && ctx.state === "running" && !this.paused) { this.music.start(0); this.musicOn = true; }
  }
  private wakeAudio() {
    audio.ensure(); void audio.resume();
    if (this.music && !this.musicOn && !this.paused) { this.music.start(0); this.musicOn = true; }
  }

  // ---------------------------------------------------------------- input
  private steerScale() { const b = this.r.cv.getBoundingClientRect(); const w = this.tr?.widthAt(this.sim?.r.s ?? 0) ?? 8; return w / Math.max(160, b.width * 0.62); }
  private onDown = (e: PointerEvent) => {
    e.preventDefault(); this.wakeAudio();
    if (this.touch) { if (this.st?.moves.brake && this.brakeId < 0) { this.brakeId = e.pointerId; this.input.brake = true; } return; }
    this.touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), ut0: this.input.ut, swiped: false };
    try { this.r.cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  private onMove = (e: PointerEvent) => {
    const t = this.touch; if (!t || t.id !== e.pointerId) return;
    t.x = e.clientX; t.y = e.clientY;
    const dx = t.x - t.x0, dy = t.y - t.y0, dtm = performance.now() - t.t0;
    // a quick vertical swipe: hop (up) or curl (down)
    if (!t.swiped && Math.abs(dy) > 34 && Math.abs(dy) > Math.abs(dx) * 1.2 && dtm < 360) {
      t.swiped = true;
      if (dy < 0) this.input.jump = true; else this.input.curl = true;
      // keep steering from where the finger is now
      t.x0 = t.x; t.ut0 = this.input.ut;
      return;
    }
    // a quick sideways flick: a trick in the air, a side step on the ground (once learned)
    const mir = this.st?.view?.mirror ? -1 : 1;
    if (this.sim?.r.air && !t.swiped && Math.abs(dx) > 50 && dtm < 220 && this.st?.moves.trick) { t.swiped = true; this.input.trick = true; return; }
    if (this.sim && !this.sim.r.air && !t.swiped && Math.abs(dx) > 70 && dtm < 170 && this.st?.moves.flick) {
      t.swiped = true; const d = Math.sign(dx) * mir; this.input.flick = d; this.input.ut = this.sim.r.u + d * 2.6; t.x0 = t.x; t.ut0 = this.input.ut; return;
    }
    this.input.ut = t.ut0 + dx * this.steerScale() * mir;
  };
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.brakeId) { this.brakeId = -1; this.input.brake = false; return; }
    const t = this.touch; if (!t || t.id !== e.pointerId) return;
    const moved = Math.hypot(t.x - t.x0, t.y - t.y0), dtm = performance.now() - t.t0;
    if (!t.swiped && moved < 12 && dtm < 260) this.input.burst = true;
    this.touch = null;
  };
  private noMenu = (e: Event) => e.preventDefault();
  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d"].includes(k)) this.keys.add(k);
    if (["arrowup", "w", " "].includes(k)) { this.input.jump = true; e.preventDefault(); this.wakeAudio(); }
    if (["arrowdown", "s"].includes(k)) { this.input.curl = true; e.preventDefault(); }
    if (["enter", "e"].includes(k)) this.input.burst = true;
    if (["q"].includes(k) && this.sim?.r.air) this.input.trick = true;
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.tick(dt);
  };
  /** one frame (also called by dev tools when the page is hidden) */
  tick(dt: number) {
    if (!this.sim || !this.st) return;
    let ev: Ev[] = [];
    const live = !this.paused;
    if (live) {
      // keyboard steering
      const kl = this.keys.has("arrowleft") || this.keys.has("a"), kr = this.keys.has("arrowright") || this.keys.has("d");
      if (kl || kr) this.input.ut += (kr ? 1 : -1) * (this.st?.view?.mirror ? -1 : 1) * 11 * dt;
      const sim = this.sim;
      const lim = (this.tr?.widthAt(sim.r.s) ?? 8) / 2 - 0.45;
      this.input.ut = Math.max(-lim, Math.min(lim, this.input.ut));
      // things to do a little later (a line after a laugh…)
      this.talking = Math.max(0, this.talking - dt);
      for (const l of this.later) l.t -= dt;
      const due = this.later.filter((l) => l.t <= 0); this.later = this.later.filter((l) => l.t > 0); for (const l of due) l.f();
      if (this.storyT >= 0) {
        this.storyTick(dt);
      } else if (this.title) {
        this.input.jump = this.input.curl = this.input.burst = this.input.trick = false;
      } else if (this.intro > 0) {
        this.intro -= dt;
        this.input.jump = this.input.curl = this.input.burst = this.input.trick = false;
        if (this.intro <= 0) this.hintMoves();
      } else if (!sim.r.done) {
        if (this.mode && !this.modeOver) this.modeTick(dt);
        ev = sim.step(dt, this.input);
        this.input.jump = this.input.curl = this.input.burst = this.input.trick = false; this.input.flick = 0;
        this.react(ev);
        if (this.pending && !this.next) this.attach();
        // safety net: well past the join without the finish firing (it should never happen) — carry on anyway rather
        // than run off the end of the road
        if (!sim.r.done && this.next && sim.r.s > this.joinS + 30 && !(sim.boss && sim.boss.phase !== "down")) sim.r.done = true;
        if (sim.r.done) this.waitT = 0;
      }
      if (sim.r.done && !this.title && this.storyT < 0 && this.mode && (this.modeOver || sim.r.out || this.modeEndsHere())) { if (!this.modeOver) this.endModeRun(!sim.r.out); }
      else if (sim.r.done && !this.title && this.storyT < 0) {
        if (this.next) this.crossOver();
        else {
          // the next stage is not joined on yet (rare): keep running, and build it here if the worker is slow
          sim.r.s += sim.r.v * dt; this.waitT += dt;
          if (this.waitT > 1.2 && !this.pending) { const st0 = this.st!, m = this.mode; this.pending = makeStage(m ? this.modeK + 1 : st0.n + 1, this.o.salt, this.o.memory(), st0.y0, m ?? undefined); }
          if (this.pending) this.attach();
        }
      }
    }
    const sim = this.sim, st = this.st;
    this.r.frame({ sim, events: ev, dt, paused: !live, portrait: this.portrait });
    // continuous sound
    const seg = this.tr!.segAt(sim.r.s);
    const ground: Ground = seg.floor === "falls" ? "water" : seg.floor === "boards" ? "boards" : seg.floor === "stone" ? "stone" : "grass";
    let fallsNear = 0;
    for (let k = -40; k <= 80; k += 20) if (this.tr!.segAt(Math.max(0, sim.r.s + k)).tag === "falls") fallsNear = Math.max(fallsNear, 1 - Math.abs(k) / 90);
    this.stepPhase += live && !this.title && this.intro <= 0 ? dt * (2.2 + sim.r.v * 0.17) : 0;
    this.sfx.update({ speed: sim.r.v, run: st.run, air: sim.r.air, ball: sim.r.ball, ground, fallsNear, dt, phase: this.stepPhase, moving: live && !this.title && this.intro <= 0 });
    // music sparkle at Turbo
    const fever = sim.r.turbo > 0 || sim.r.rush > 0;
    if (fever !== this.feverOn && this.music) { this.feverOn = fever; this.music.fever(fever); }
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private react(ev: Ev[]) {
    const sim = this.sim!, r = sim.r, st = this.st!;
    const pan = (u: number) => Math.max(-0.9, Math.min(0.9, u / 5));
    for (const e of ev) {
      switch (e.t) {
        case "pearl": this.sfx.pearl(e.streak, pan(e.o.u)); if (e.streak % 25 === 0) this.buzz(10); this.points(5); break;
        case "bigPearl": this.sfx.bigPearl(pan(e.o.u)); this.buzz(14); break;
        case "medal": this.sfx.medal(pan(e.o.u)); this.buzz([10, 30, 10]); break;
        case "jump": this.sfx.jump(e.double); break;
        case "land": this.sfx.land(e.vh, st.segs.length ? (this.tr!.segAt(r.s).floor === "falls" ? "water" : "grass") : "grass"); if (e.vh < -12) this.buzz(12); break;
        case "curl": this.sfx.curl(e.on); break;
        case "pad": this.sfx.pad(pan(e.o.u)); this.buzz(12); break;
        case "spring": case "side": this.sfx.spring(pan(e.o.u)); this.buzz(14); this.points(30); break;
        case "hit": this.sfx.hit(); this.buzz([40, 30, 60]); break;
        case "smash": this.sfx.smash(pan(e.o.u), e.o.k === "crate"); this.buzz(16); break;
        case "bonk": this.sfx.bonk(pan(e.o.u)); this.buzz(16); break;
        case "fall": this.sfx.fall(); setTimeout(() => this.sfx.respawn(), 500); this.r.playShot("respawn"); this.o.onOut?.({ t: "fell" }); this.buzz([60, 40, 60]); break;
        case "check": this.sfx.check(); this.o.onOut?.({ t: "check", i: e.i, pearls: r.pearls - sim.pearlBase }); this.buzz([15, 40, 15]); break;
        case "goal": break; // no finish line: the run just carries on
        case "gate": this.sfx.gate(e.ok); break;
        case "turbo": case "burst": this.sfx.turbo(); break;
        case "trick": this.sfx.trick(e.n); this.points(100 * e.n); break;
        case "magnet": this.sfx.magnet(); break;
        case "item":
          this.sfx.item(pan(e.o.u)); this.buzz(12);
          if (e.o.item === "coin") this.coinsRun++;
          if (e.o.item === "life") this.o.onOut?.({ t: "heart" });
          break;
        case "life": this.sfx.guard(); this.sfx.respawn(); this.buzz([20, 40, 20]); this.o.onOut?.({ t: "life" }); break;
        case "power": this.sfx.power(); this.buzz([10, 30, 10]); this.o.onOut?.({ t: "power", p: e.p }); break;
        case "rail": this.sfx.rail(e.on); if (e.on) { this.buzz(8); this.points(40); } break;
        case "hop": this.sfx.hop(); break;
        case "dash": this.sfx.dash(); break;
        case "pound": this.sfx.pound(); this.buzz(20); break;
        case "guard": this.sfx.guard(); this.buzz(10); break;
        case "tele": this.sfx.tele(); break;
        case "launch": this.sfx.launch(pan(e.o.u)); this.buzz(14); this.points(30); break;
        case "switch": this.sfx.switchOn(); this.buzz(10); break;
        case "open": this.sfx.open(); break;
        case "fail": this.sfx.fail(); this.buzz([40, 30, 40]); this.o.onOut?.({ t: "fail", why: e.why }); break;
        case "carry": if (e.on) this.sfx.magnet(); break;
        case "caught": this.sfx.hit(); break;
        case "hoop": this.sfx.hoop(); this.points(80); break;
        case "wiggle": this.sfx.wiggle(); break;
        case "rush": if (e.on) this.sfx.turbo(); break;
        case "boss": this.sfx.boss(e.what); if (e.what === "hit" || e.what === "down") this.buzz([30, 40, 60]); if (e.what === "down") this.attach(); break;
        default: break;
      }
    }
    // loops get a whoosh round your ears
    const seg = this.tr!.segAt(r.s);
    if (seg.tag === "loop" && this.tr!.segAt(r.s - r.v / 60).tag !== "loop") { this.sfx.loop(); this.points(150); }
  }
  /** first time a move is needed on a stage, tell the UI to show its hint */
  private hintMoves() {
    const st = this.st!, k = new Set(knownAt(st.n));
    const tell = (m: string, on: boolean | undefined) => { if (on && !this.told.has(m)) { this.told.add(m); this.o.onOut?.({ t: "hint", move: m }); } };
    const mv = st.moves;
    tell("steer", true); tell("hop", k.has("M03")); tell("curl", mv.curl); tell("double", mv.double); tell("burst", mv.burst); tell("trick", mv.trick);
    tell("pound", mv.pound); tell("slide", mv.slide); tell("drift", mv.drift); tell("star", mv.hop); tell("dash", mv.dash); tell("flick", mv.flick);
    tell("brake", mv.brake); tell("whip", mv.whip); tell("guard", mv.guard); tell("rush", mv.rush); tell("skip", mv.skip);
  }
  private finish() {
    const st = this.st!, r = this.sim!.r;
    const got = Math.max(0, r.pearls - this.sim!.pearlBase);
    const res: StageResult = { n: st.n, rank: rankOf(st, r.time, got, this.total, r.hits), time: r.time, pearls: got, total: this.total, medals: r.medals, hits: r.hits, metres: Math.round(this.joinS), coins: r.coins, concepts: st.concepts, remix: st.remix ? { name: st.remix.name, key: st.remix.key, atoms: st.remix.atoms } : undefined };
    this.o.onOut?.({ t: "done", st, res });
  }

  // ---------------------------------------------------------------- modes
  /** start a mode run (the journey waits where it is); a Time Trial can bring a ghost to race */
  async startMode(m: ModeRun, ghost?: { t: number; p: number[] } | null) {
    this.skipStory();
    this.mode = m; this.modeK = 1; this.modeT = 0; this.modeScore = 0; this.modeOdo = 0; this.modeOver = false; this.modeCoins = 0;
    this.rec = []; this.recT = 0; this.ghost = ghost ?? null; this.coinsRun = 0;
    const st = await this.stage(1, undefined, m);
    if (this.mode !== m) return;
    this.load(st);
    this.r.setGhost(this.ghost ? this.ghost.p : null);
    this.setTitle(false);
  }
  /** leave the mode (the app loads the journey stage again) */
  endMode() { this.mode = null; this.modeOver = false; this.ghost = null; this.r.setGhost(null); }
  get inMode() { return !!this.mode; }
  private points(p: number) { if (this.mode?.id === "park" && !this.modeOver) this.modeScore += Math.round(p * (1 + Math.min(10, this.sim?.r.combo ?? 0) * 0.1)); }
  private modeTick(dt: number) {
    const m = this.mode!, r = this.sim!.r;
    this.modeT += dt;
    // the ghost's samples: ten a second of stage time
    if (m.id === "trial" || m.id === "daily") { this.recT -= dt; if (this.recT <= 0) { this.recT += 0.1; this.rec.push(Math.round(r.s * 10), Math.round(r.u * 100), Math.round(r.h * 100)); } }
    if (m.id === "park" && this.modeT >= PARK_TIME) this.endModeRun(true);
  }
  private modeHud(): RushHud["mode"] {
    const m = this.mode, sim = this.sim; if (!m || !sim) return null;
    const r = sim.r, clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
    switch (m.id) {
      case "endless": { const d = this.modeOdo + Math.min(r.s, this.joinS); return { id: m.id, main: d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(2)} km`, sub: `Stage ${this.modeK}` }; }
      case "park": return { id: m.id, main: `${this.modeScore.toLocaleString()}`, sub: `⏱ ${Math.max(0, Math.ceil(PARK_TIME - this.modeT))} s${r.combo > 1 ? ` · ×${(1 + Math.min(10, r.combo) * 0.1).toFixed(1)}` : ""}` };
      case "boss": return { id: m.id, main: clock(this.modeT), sub: `Boss ${this.modeK} of ${m.bosses ?? 1}` };
      default: {
        let sub: string | undefined = undefined;
        if (this.ghost) { const i = Math.min(this.ghost.p.length / 3 - 1, Math.floor(r.time * 10)); if (i >= 0) { const gs = this.ghost.p[i * 3] / 10, d = r.s - gs; sub = `👻 ${d >= 0 ? "+" : ""}${d.toFixed(0)} m`; } }
        return { id: m.id, main: clock(r.time), sub };
      }
    }
  }
  private endModeRun(finished: boolean) {
    const m = this.mode!, sim = this.sim!, r = sim.r, st = this.st!;
    this.modeOver = true;
    const metres = Math.round(this.modeOdo + Math.min(r.s, this.joinS));
    const coins = this.modeCoins + this.coinsRun;
    const pearls = Math.max(0, r.pearls);
    let res: ModeResult;
    if (m.id === "endless") res = { id: m.id, finished, score: metres, time: this.modeT, metres, pearls, coins, stages: this.modeK };
    else if (m.id === "park") res = { id: m.id, finished, score: this.modeScore, time: this.modeT, metres, pearls, coins, stages: this.modeK };
    else if (m.id === "boss") { const bosses = finished ? this.modeK : this.modeK - 1; res = { id: m.id, finished, score: this.modeT, time: this.modeT, metres, pearls, coins, stages: this.modeK, bosses }; }
    else res = { id: m.id, finished, score: r.time, time: r.time, metres, pearls, coins, stages: 1, n: st.n, rank: rankOf(st, r.time, Math.max(0, r.pearls - sim.pearlBase), this.total, r.hits), ghost: this.rec.slice() };
    r.done = true;
    this.r.playShot("goal");
    if (finished) this.sfx.medal(0); else this.sfx.fail();
    this.o.onOut?.({ t: "modeEnd", res });
  }

  // ---------------------------------------------------------------- the story
  /** play the opening cinematic where Rollo stands now (the track's things are hidden while it plays) */
  playStory() {
    if (!this.sim || !this.st) return;
    this.title = false; this.intro = 0;
    this.storyT = 0; this.cueAt = 0;
    this.storyBase = Math.max(0, this.sim.r.s - ROLLO_S);
    const ids = CUES.filter((c): c is Extract<Cue, { voice: string }> => "voice" in c).map((c) => c.voice);
    this.sfx.preloadVoices(ids);
    this.r.storyMode(true);
    this.o.onOut?.({ t: "story", on: true });
  }
  get inStory() { return this.storyT >= 0; }
  skipStory() { if (this.storyT < 0) return; this.sfx.stopVoices(); this.endStory(); }
  private storyTick(dt: number) {
    this.storyT += dt;
    while (this.cueAt < CUES.length && CUES[this.cueAt].t <= this.storyT) this.cue(CUES[this.cueAt++]);
    const F = storyAt(Math.min(this.storyT, INTRO_LEN)), B = this.storyBase;
    const sh = (v: [number, number, number]): [number, number, number] => [v[0] + B, v[1], v[2]];
    const S: StoryFrame = {
      ...F, cam: { ...F.cam, pos: sh(F.cam.pos), look: sh(F.cam.look) }, rollo: { ...F.rollo, s: F.rollo.s + B },
      chintu: F.chintu ? { ...F.chintu, s: F.chintu.s + B } : null, witch: F.witch ? { ...F.witch, s: F.witch.s + B } : null, ball: F.ball ? sh(F.ball) : null,
    };
    this.r.story = S;
    if (this.sim) { this.sim.r.s = S.rollo.s; this.sim.r.u = 0; this.sim.r.h = 0; }
    if (this.storyT >= INTRO_LEN) this.endStory();
  }
  private endStory() {
    const F = storyAt(Math.min(this.storyT, INTRO_LEN));
    this.storyT = -1; this.later = [];
    this.r.storyMode(false);
    if (this.sim && this.st) { const r = this.sim.r; r.s = this.storyBase + Math.max(ROLLO_S, F.rollo.s); r.u = 0; r.h = 0; r.v = Math.max(r.v, this.st.run * 0.8); r.blink = 1; }
    this.intro = 0;
    this.startMusic(true);
    this.o.onOut?.({ t: "story", on: false });
    this.hintMoves();
  }
  private cue(c: Cue) {
    if ("voice" in c) this.say(c.voice);
    else if ("sfx" in c) {
      if (c.sfx === "sting") this.sfx.sting(); else if (c.sfx === "thunder") this.sfx.thunder(); else if (c.sfx === "wail") this.sfx.wail();
      else if (c.sfx === "whoosh") this.sfx.whoosh(0.6); else this.sfx.whoosh(-0.5, true);
    } else if ("music" in c) {
      if (c.music === "stage") this.startMusic(true);
      else if (c.music === "fade") { this.music?.stop(1.6); this.musicOn = false; }
      else this.playTheme(c.music);
    } else this.o.onOut?.({ t: "title" });
  }
  /** a voiced line, with its subtitle */
  private say(id: string) {
    const L = LINES[id]; if (!L) return;
    void this.sfx.voice(id);
    this.talking = L.dur;
    if (L.who === "Mayamma") this.r.witchTalk(L.dur);
    this.o.onOut?.({ t: "line", who: L.who, text: L.laugh ? "Ha ha ha ha!" : L.text, dur: L.dur });
  }
  private soon(t: number, f: () => void) { this.later.push({ t, f }); }
  private pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }
  /** the cinematic's lullaby, or Mayamma's theme (choir, strings and timpani in a minor key) */
  private playTheme(kind: "lullaby" | "witch") {
    const style = kind === "witch" ? "M13" : "M18", mood = kind === "witch" ? "evil haunt dark" : "moon calm dream";
    const zones: SongZone[] = []; let b = 0;
    const plan0: [SectionKind, number][] = kind === "witch" ? [["build", 2], ["chorus", 3], ["chorus", 3], ["build", 2]] : [["intro", 0], ["verse", 1], ["verse", 1], ["intro", 0]];
    for (const [section, intensity] of plan0) { zones.push({ beat0: b, beats: 16, mood, section, intensity, style }); b += 16; }
    const plan: SongPlan = { bpm: kind === "witch" ? 100 : 76, root: kind === "witch" ? 41 : 50, seed: kind === "witch" ? 0x5ea7 : 0x1a11, zones, beats: b };
    const old = this.music; old?.stop(0.8); if (old) setTimeout(() => old.dispose(), 1000);
    try { this.music = new RollMusic(plan, 1); this.music.loop = true; } catch { this.music = null; }
    this.musicOn = false;
    const ctx = audio.ensure();
    if (this.music && ctx && ctx.state === "running" && !this.paused) { this.music.start(0); this.musicOn = true; }
  }
  /** Mayamma swoops in (a crack of thunder, her laugh, her music) or flies off (a taunt, her laugh, the stage music) */
  private witchEvent(w: "enter" | "exit") {
    if (this.storyT >= 0) return;
    if (w === "enter") {
      this.witchHere = true; this.castN = 0;
      this.sfx.thunder(); this.sfx.sting(); this.buzz([30, 40, 30]);
      const l = this.pick(LAUGHS); this.say(l);
      this.soon(Math.min(3.2, LINES[l].dur * 0.7), () => this.say(this.pick(ENTRANCES)));
      this.playTheme("witch");
      this.o.onOut?.({ t: "witch", on: true });
    } else {
      this.witchHere = false;
      const x = this.pick(EXITS); this.say(x);
      this.soon(LINES[x].dur * 0.8, () => this.say(this.pick(LAUGHS)));
      this.startMusic(true);
      this.o.onOut?.({ t: "witch", on: false });
    }
  }
  private magicEvent(what: "cast" | "land", id: string, pan: number) {
    const el = id.split(":")[0];
    if (what === "land") { this.sfx.burstFx(el, pan); return; }
    // one magic, many pieces: one cast, one name
    const now = performance.now();
    if (id === this.lastMagic && now - this.lastMagicAt < 1500) return;
    this.lastMagic = id; this.lastMagicAt = now;
    this.sfx.cast(el, pan);
    this.castN++;
    if (this.castN % 3 === 1 && this.talking <= 0.2) this.say(this.pick(SHOUTS));
    this.o.onOut?.({ t: "magic", id, name: MAGIC_NAME[id] ?? "Magic" });
  }

  private pushHud() {
    const st = this.st, sim = this.sim; if (!st || !sim) return;
    const r = sim.r, W = worldOf(st.world), b = sim.boss;
    this.o.onHud?.({
      world: st.world, worldName: W.name, emoji: W.emoji,
      pearls: r.pearls, got: Math.max(0, r.pearls - sim.pearlBase), target: st.target,
      scales: r.scales, boost: r.boost, turbo: r.turbo > 0, rush: r.rush > 0, streak: r.streak,
      dist: Math.round(this.odo + Math.min(r.s, this.joinS)),
      boss: b && b.phase !== "down" ? { hp: b.hp, max: st.boss?.hits ?? 3, tired: b.phase === "tired", kind: b.kind, name: st.boss?.name ?? "Kranky", weak: st.boss?.weak ?? "ball" } : null,
      intro: this.intro > 0 && !this.title, moves: st.moves,
      lives: sim.lives, coins: this.coinsRun,
      chips: chipsOf(st, r), powers: Object.entries(r.powers).map(([k, t]) => ({ k, t: t ?? 0 })).filter((x) => x.t > 0.2),
      mode: this.modeHud(),
    });
  }
  private buzz(p: number | number[]) {
    if (!this.o.haptics || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try { navigator.vibrate?.(p); } catch { /* unsupported */ }
  }

  pause() { if (this.paused) return; this.paused = true; this.music?.stop(0.25); this.musicOn = false; this.sfx.pause(); }
  resume() { if (!this.paused) return; this.paused = false; this.last = performance.now(); this.sfx.resume(); if (this.music) { this.music.start(this.music.beatNow()); this.musicOn = true; } }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf); this.ro.disconnect();
    const cv = this.r.cv;
    cv.removeEventListener("pointerdown", this.onDown); cv.removeEventListener("pointermove", this.onMove);
    cv.removeEventListener("pointerup", this.onUp); cv.removeEventListener("pointercancel", this.onUp); cv.removeEventListener("contextmenu", this.noMenu);
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKeyUp);
    this.worker?.terminate();
    const m = this.music; m?.stop(0.2); setTimeout(() => m?.dispose(), 400);
    this.sfx.dispose(); this.r.dispose();
  }
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __rush?: { last?: RushSession } }).__rush ??= {};
/** the little HUD chips for what a stretch asks of you */
function chipsOf(st: Stage, r: Sim["r"]): string[] {
  const R = st.rules, out: string[] = [];
  if (R?.time || (R?.sprint && r.timeLeft > 0)) out.push(`⏱ ${Math.max(0, Math.ceil(r.timeLeft))}`);
  if (R?.letters) out.push(`R-O-L-L-O ${r.letters}/5`);
  if (R?.race && st.rival) { const d = Math.round(r.s - r.rival); out.push(`🏁 ${d >= 0 ? "+" : ""}${d} m`); }
  if (st.chase && r.s > st.chase.from && r.s < st.chase.to) out.push(`😱 ${Math.max(0, Math.round(r.chase))} m`);
  if (R?.noHit) out.push("🚫 no bumps");
  if (R?.escort) out.push("🐣 keep Momo safe");
  if (R?.egg) out.push("🥚 gently!");
  if (R?.softLand) out.push("🪶 soft landings");
  if (R?.medals) out.push(`🌙 ${r.medals}/3`);
  if (R?.lanterns) out.push(`🏮 ${r.lanterns}/${R.lanterns}`);
  if (R?.bonkAll) out.push(`💥 ${r.bonks}/${R.bonkAll}`);
  if (R?.combo) out.push(`✨ ${Math.round(r.style)}/${R.combo}`);
  if (R?.noBonk) out.push("🕊️ no bonks");
  if (R?.minSpeed) out.push("⚡ keep it fast");
  if (R?.thief) out.push("🦹 catch the thief");
  if (R?.light) out.push("💡 stay in the light");
  return out;
}
export function registerDev(s: RushSession) {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __rush: { last?: RushSession } }).__rush.last = s;
}
