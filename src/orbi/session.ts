// One Orbi GP race: the grid, the drone reveal, the countdown, the race and the finish. Touch: hold anywhere to roll,
// slide left / right to steer (the anchor follows your thumb), swipe up to jump, pull back to brake, double-tap to boost.
// Tilt steering and the keyboard work too. Rival marbles are driven by the robot driver; the next stage is built in a
// worker while you race. The music is composed for every stage (the Sky Roll engine, in the world's style), the
// marble's rolling sound follows its speed, and knocks and passes are panned to where they happen.
import { audio, type Sound } from "@/lib/audio";
import { hash32 } from "../roll/rng";
import { RollMusic } from "../roll/music";
import type { SectionKind, SongPlan, SongZone } from "../roll/types";
import { Driver } from "./ai";
import { worldOf } from "./data/worlds";
import type { CourseOpts, RemixMemory } from "./gen";
import { OrbiRenderer, type Quality } from "./render3d";
import { newMarble, Sim } from "./sim";
import { makeStage } from "./stages";
import { SKINS } from "./three/tex";
import { Track } from "./track";
import type { Ev, Input, PowerKind, Stage } from "./types";
import type { OrbiAsk, OrbiReply } from "./worker";

export type Phase = "menu" | "intro" | "count" | "race" | "done";
/** the race format: the Grand Prix journey, an Endless Sky Run (courses back to back, 3 lives), a Daily Cup race, a Time
 *  Trial against your ghost, a Knockout Royale round, or a Boss Rush race */
export interface ModeSpec { kind: "gp" | "endless" | "daily" | "trial" | "royale" | "bossrush"; rivals?: number; ghost?: number[]; lives?: number; dist?: number; leg?: number }
/** stick: an on-screen joystick (forward rolls, left / right steers, back brakes; tap the right side to jump) */
export type Controls = "stick" | "drag" | "tilt" | "buttons";
export interface OrbiHud {
  phase: Phase; count: number;
  place: number; total: number; time: number; progress: number;
  dots: { p: number; me: boolean; c: string }[];
  meter: number; boosting: boolean; held: PowerKind | null; active: { k: PowerKind; t: number }[];
  coins: number; gems: number; stars: number; falls: number; speed: number;
  n: number; name: string; world: number; worldName: string; emoji: string; gold: number; air: boolean;
  /** the stage's goal and how it's going ("" when it's just a race), hearts held, O-R-B-I letters (bits), the screen effect */
  goal: string; goalOk: boolean; hearts: number; letters: number; view: string;
  mode: ModeSpec["kind"]; lives: number; dist: number;
  /** a chaser close behind you ("Avalanche 14 m behind!") */
  warn: string;
}
export interface RaceResult {
  n: number; place: number; total: number; time: number; gold: number; coins: number; gems: number; stars: number; falls: number; pass: boolean; rating: number; why: string; remix?: string[]; meet?: string;
  /** the mode, your path (s dm, u cm, h cm every 0.1 s) for a ghost, the Endless distance (m) */
  mode: ModeSpec["kind"]; path?: number[]; dist?: number;
}
export type OrbiOut = { t: "toast"; text: string; tone?: string } | { t: "finish"; res: RaceResult } | { t: "phase"; phase: Phase } | { t: "next"; dist: number; coins: number; lives: number };
export interface OrbiOptions {
  quality: Quality; haptics: boolean; salt: number;
  /** the marble skin you race with */
  skin?: () => number;
  memory: () => RemixMemory;
  controls: () => Controls;
  onHud?: (h: OrbiHud) => void;
  onOut?: (e: OrbiOut) => void;
}

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 2], ["build", 2], ["chorus", 3], ["verse", 2], ["break", 1], ["chorus", 3], ["build", 3]];
const NAMES = SKINS.map((s) => s.name);
const ORD = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

export class OrbiSession {
  readonly r: OrbiRenderer;
  st: Stage | null = null; tr: Track | null = null; sim: Sim | null = null;
  phase: Phase = "menu";
  private drivers: Driver[] = [];
  private o: OrbiOptions;
  private host: HTMLElement;
  private ro: ResizeObserver;
  private raf = 0; private last = 0; private acc = 0;
  paused = false; private destroyed = false;
  private phaseT = 0; private count = 3;
  private input: Input = { steer: 0, push: 0, brake: 0, jump: false, boost: false, power: false, trick: 0 };
  private keys = new Set<string>();
  private touch: { id: number; ax: number; ay: number; t0: number; x: number; y: number; jumped: boolean } | null = null;
  private lastTap = 0;
  private tilt = 0;
  private worker: Worker | null = null; private ask = 0; private waiting = new Map<number, (st: Stage) => void>();
  private music: RollMusic | null = null; private musicOn = false;
  private roll: { src: AudioBufferSourceNode; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private hudT = 0; private finished = false;
  private lastPlace = 99;
  /** led at every checkpoint so far (the "lead every lap" goal), the last surface underfoot (piano keys sing) */
  private ledAll = true; private lastOn = -1;
  /** the race format, Endless lives, your recorded path (for a ghost) */
  mode: ModeSpec = { kind: "gp" };
  private lives = 3; private path: number[] = []; private stepN = 0; private rings = 0;

  constructor(host: HTMLElement, o: OrbiOptions) {
    this.host = host; this.o = o;
    this.r = new OrbiRenderer(host, o.quality);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    const cv = this.r.cv;
    cv.addEventListener("pointerdown", this.onDown); cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp); cv.addEventListener("pointercancel", this.onUp);
    cv.addEventListener("contextmenu", this.noMenu);
    window.addEventListener("keydown", this.onKey); window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("deviceorientation", this.onTilt);
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
      this.worker.onmessage = (e: MessageEvent<OrbiReply>) => { const f = this.waiting.get(e.data.id); this.waiting.delete(e.data.id); if (f) f(e.data.st); };
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; };
    } catch { this.worker = null; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  private resize() { const b = this.host.getBoundingClientRect(); this.r.resize(b.width, b.height); }

  /** a stage, built in the worker (or here when there is no worker) */
  stage(n: number, opts?: CourseOpts, salt = this.o.salt, fresh = false): Promise<Stage> {
    const mem = fresh ? { recent: [], seen: [] } : this.o.memory();
    // a long stage takes a moment to build and check: keep the last few (a retry starts at once)
    const key = `${n}|${salt}|${JSON.stringify(opts ?? {})}|${n > 500 && !fresh ? JSON.stringify(mem) : ""}`;
    const hit = this.cache.get(key); if (hit) return hit;
    const p = this.worker
      ? new Promise<Stage>((res) => { const id = ++this.ask; this.waiting.set(id, res); this.worker!.postMessage({ id, n, salt, mem, opts } satisfies OrbiAsk); })
      : Promise.resolve(makeStage(n, salt, mem, opts));
    this.cache.set(key, p);
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value!);
    return p;
  }
  private cache = new Map<string, Promise<Stage>>();
  /** build stage n ahead of time (while you race the one before) */
  prefetch(n: number) { void this.stage(n); }
  /** the race format for the next load */
  setMode(m: ModeSpec) { this.mode = m; this.lives = m.lives ?? 3; }

  /** put the grid on a stage (the menu shows Orbi on it) */
  load(st: Stage) {
    this.st = st; this.tr = new Track(st.segs);
    const sim = new Sim(st, this.tr); this.sim = sim;
    // the rivals fill the grid from the front, three abreast; Orbi starts one row behind them all, in the middle
    const per = 3, hw = Math.min(4, this.tr.widthAt(20) / 2 - 1.2);
    sim.marbles = [];
    const rivals = this.mode.rivals ?? st.rivals;
    for (let j = 0; j < rivals; j++) {
      const id = j + 1, row = Math.floor(j / per), col = j % per;
      sim.marbles.push(newMarble(id, NAMES[id % NAMES.length], id % SKINS.length || 1, 30 - row * 3.4, (col - 1) * hw * 0.8));
    }
    const rows = Math.ceil(rivals / per);
    sim.marbles.unshift(newMarble(0, "Orbi", this.o.skin?.() ?? 0, 30 - rows * 3.4, 0));
    // special rivals: a runaway leader starts far ahead, the champion and the ghost race in gold and glass
    const r1 = sim.marbles[1];
    if (r1 && st.special === "leader") { r1.s = 90; r1.name = "Runaway"; }
    if (r1 && st.special === "champion") { r1.name = "Champ"; r1.skin = SKINS.findIndex((k) => k.name === "Goldie"); }
    if (r1 && st.special === "ghost") { r1.name = "Ghost"; r1.skin = 0; }
    if (r1 && st.special === "final") { r1.name = "Kranky"; r1.skin = SKINS.findIndex((k) => k.name === "Magma"); }
    const top = st.special === "leader" || st.special === "champion" || st.special === "ghost" || st.special === "final" || st.special === "duel";
    this.drivers = sim.marbles.map((m, i) => i === 0 ? new Driver(0.9, 0.45, 0, 0, 1) : new Driver(i === 1 && top ? Math.min(1, st.skill + 0.15) : Math.max(0.15, Math.min(0.98, st.skill + ((i % 5) - 2) * 0.05)), 0.38 + (i % 3) * 0.07, ((i * 0.37) % 1) * 2 - 1, i === 1 && top ? 0.4 : 1.4, hash32(st.seed, i)));
    this.ledAll = true; this.lastOn = -1; this.path = []; this.stepN = 0; this.rings = st.objs.filter((o) => o.k === "ring").length;
    this.r.setStage(st, this.tr, sim);
    this.r.setGhost(this.mode.kind === "trial" && this.mode.ghost?.length ? this.mode.ghost : null);
    this.phase = "menu"; this.phaseT = 0; this.finished = false; this.acc = 0;
    this.r.play("showroom");
    this.startMusic(true);
    this.pushHud();
  }

  /** go: the drone reveal, then the countdown */
  start() {
    if (!this.sim) return;
    this.wakeAudio();
    this.setPhase("intro");
    this.r.play("intro");
    audio.play("a:whooshIn", { gain: 0.5 });
  }
  /** Endless: straight on into the next course (a flying start, no reveal) */
  go() {
    if (!this.sim) return;
    this.setPhase("race"); this.r.play("chase");
    for (const m of this.sim.marbles) m.vs = this.st!.vmax * 0.7;
    this.startMusic(false);
  }
  /** skip the reveal (tap) */
  skipIntro() { if (this.phase === "intro") this.toCount(); }
  private toCount() { this.setPhase("count"); this.count = 3; this.phaseT = 0; this.r.play("chase"); audio.play("a:race_beep", { gain: 0.6 }); this.emit({ t: "toast", text: "3", tone: "big" }); }
  private setPhase(p: Phase) { this.phase = p; this.phaseT = 0; this.o.onOut?.({ t: "phase", phase: p }); }

  // ---------------------------------------------------------------- music and sound
  private startMusic(calm: boolean) {
    const st = this.st!; const W = worldOf(st.look.world);
    const style = W.music.styles[(st.n + st.look.seed) % W.music.styles.length];
    const mood = calm ? `${W.music.mood} calm` : st.kind === "boss" ? "kranky boss" : st.kind === "burner" ? `${W.music.mood} danger` : W.music.mood;
    const zones: SongZone[] = []; let b = 0;
    for (let i = 0; i < SECTIONS.length; i++) { const [section, intensity] = SECTIONS[(i + st.n) % SECTIONS.length]; zones.push({ beat0: b, beats: 16, mood, section, intensity: calm ? Math.min(1, intensity) : Math.min(3, intensity + (st.kind === "boss" || st.kind === "burner" ? 1 : 0)), style }); b += 16; }
    const plan: SongPlan = { bpm: W.music.bpm + ((st.n * 5) % 9) - 4 - (calm ? 14 : 0), root: 45 + (st.n % 9), seed: hash32(st.world, st.n, 0x0b1), zones, beats: b };
    const old = this.music; old?.stop(0.6); if (old) setTimeout(() => old.dispose(), 800);
    try { this.music = new RollMusic(plan, 1); this.music.loop = true; } catch { this.music = null; }
    this.musicOn = false;
    const ctx = audio.ensure();
    if (this.music && ctx && ctx.state === "running" && !this.paused) { this.music.start(0); this.musicOn = true; }
  }
  private wakeAudio() {
    audio.ensure(); void audio.resume();
    if (this.music && !this.musicOn && !this.paused) { this.music.start(0); this.musicOn = true; }
    if (!this.roll) this.makeRoll();
  }
  /** the marble's rolling: filtered noise whose pitch and loudness follow the speed */
  private makeRoll() {
    const ctx = audio.ensure(), out = audio.sfxOut;
    if (!ctx || !out) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    let x = 0; for (let i = 0; i < d.length; i++) { x = x * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = x * 6; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 400; filt.Q.value = 0.9;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(out); src.start();
    this.roll = { src, filt, gain };
  }
  private snd(name: Sound, gain = 0.6, pan = 0, rate = 1) { audio.play(name, { gain, pan: Math.max(-0.9, Math.min(0.9, pan)), rate }); }
  private buzz(p: number | number[]) { if (!this.o.haptics || !(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) return; try { navigator.vibrate?.(p); } catch { /* unsupported */ } }

  // ---------------------------------------------------------------- input
  private onDown = (e: PointerEvent) => {
    e.preventDefault(); this.wakeAudio();
    if (this.phase === "intro") { this.skipIntro(); return; }
    // joystick play: the stick has the left side; a tap anywhere else jumps (a tap in the air: a trick)
    if (this.o.controls() === "stick") { this.input.jump = true; if (this.sim?.marbles[0].air) this.input.trick = 1; return; }
    const now = performance.now();
    if (this.touch) { this.input.boost = true; return; } // a second finger: boost
    if (now - this.lastTap < 280) this.input.boost = true; // a double tap: boost
    this.lastTap = now;
    this.touch = { id: e.pointerId, ax: e.clientX, ay: e.clientY, t0: now, x: e.clientX, y: e.clientY, jumped: false };
    try { this.r.cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  private onMove = (e: PointerEvent) => {
    const t = this.touch; if (!t || t.id !== e.pointerId) return;
    t.x = e.clientX; t.y = e.clientY;
    const w = this.host.getBoundingClientRect().width, span = Math.max(60, w * 0.16);
    let dx = t.x - t.ax;
    if (Math.abs(dx) > span) { t.ax = t.x - Math.sign(dx) * span; dx = Math.sign(dx) * span; }
    if (this.o.controls() === "drag") this.input.steer = dx / span;
    const dy = t.y - t.ay;
    if (!t.jumped && dy < -48 && performance.now() - t.t0 < 420) { t.jumped = true; this.input.jump = true; if (this.sim?.marbles[0].air) this.input.trick = 1; }
    if (dy < -60) t.ay = t.y + 60;
    this.input.brake = dy > 70 ? Math.min(1, (dy - 70) / 60) : 0;
  };
  private onUp = (e: PointerEvent) => {
    const t = this.touch; if (!t || t.id !== e.pointerId) return;
    this.touch = null; this.input.brake = 0;
    if (this.o.controls() === "drag") this.input.steer = 0;
  };
  private noMenu = (e: Event) => e.preventDefault();
  private onKey = (e: KeyboardEvent) => {
    // the game's keys never scroll the page (unless you are typing somewhere)
    const el = e.target as HTMLElement | null, typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    if (!typing && GAME_KEYS.has(e.key) && !(e.key === " " && el?.tagName === "BUTTON")) e.preventDefault();
    if (e.repeat) return;
    const k = e.key.toLowerCase(); this.keys.add(k); this.wakeAudio();
    if (k === " ") { this.input.jump = true; e.preventDefault(); }
    if (k === "shift" || k === "b") this.input.boost = true;
    if (k === "e" || k === "enter") this.input.power = true;
    if (k === "q" && this.sim?.marbles[0].air) this.input.trick = 1;
    if (this.phase === "intro") this.skipIntro();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onTilt = (e: DeviceOrientationEvent) => {
    const angle = (screen.orientation?.angle ?? 0) as number, land = Math.abs(angle) === 90 || angle === 270;
    const raw = land ? (e.beta ?? 0) * (angle === 90 ? 1 : -1) : (e.gamma ?? 0);
    this.tilt = Math.max(-1, Math.min(1, raw / 22));
  };
  /** on-screen buttons (the "buttons" control scheme) */
  press(k: "left" | "right" | "roll" | "brake" | "jump" | "boost" | "power", on: boolean) {
    if (on) this.wakeAudio();
    if (k === "left") this.keys[on ? "add" : "delete"]("arrowleft");
    else if (k === "right") this.keys[on ? "add" : "delete"]("arrowright");
    else if (k === "roll") this.keys[on ? "add" : "delete"]("arrowup");
    else if (k === "brake") this.keys[on ? "add" : "delete"]("arrowdown");
    else if (on && k === "jump") { this.input.jump = true; if (this.sim?.marbles[0].air) this.input.trick = 1; }
    else if (on && k === "boost") this.input.boost = true;
    else if (on && k === "power") this.input.power = true;
  }
  /** the joystick: x −1 (left) … 1 (right), y −1 (forward) … 1 (back) */
  stick(x: number, y: number) { this.stickV.x = x; this.stickV.y = y; if (x || y) this.wakeAudio(); }
  private stickV = { x: 0, y: 0 };
  usePower() { this.input.power = true; }
  useBoost() { this.input.boost = true; }

  private playerInput(): Input {
    const k = this.keys, ctl = this.o.controls();
    const kl = k.has("arrowleft") || k.has("a"), kr = k.has("arrowright") || k.has("d");
    const kUp = k.has("arrowup") || k.has("w"), kDn = k.has("arrowdown") || k.has("s");
    let steer = this.input.steer;
    // the joystick: a little dead zone in the middle; full push from about two-thirds forward; pull back to brake
    const sx = this.stickV.x, sy = this.stickV.y, dz = (v: number) => (Math.abs(v) < 0.1 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.1) / 0.75));
    if (kl || kr) steer = (kr ? 1 : 0) - (kl ? 1 : 0);
    else if (ctl === "tilt") steer = this.tilt;
    else if (ctl === "stick") steer = dz(sx);
    // a mirrored or upside-down screen flips left and right (so what you see is what you steer)
    if (this.r.view === "mirror" || this.r.view === "flip") steer = -steer;
    let push = kUp || (this.touch && ctl !== "buttons" && ctl !== "stick") ? 1 : 0;
    let brake = kDn ? 1 : this.input.brake;
    if (ctl === "stick" && !kUp && !kDn) { push = Math.max(0, Math.min(1, -sy * 1.5 - 0.05)); brake = Math.max(0, Math.min(1, (sy - 0.25) * 1.6)); }
    if (kDn) push = 0;
    const out: Input = { steer, push, brake, jump: this.input.jump, boost: this.input.boost, power: this.input.power, trick: this.input.trick };
    this.input.jump = false; this.input.boost = false; this.input.power = false; this.input.trick = 0;
    return out;
  }

  // ---------------------------------------------------------------- the loop
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.tick(dt);
  };
  /** one frame (dev tools call it directly when the page is hidden) */
  tick(dt: number) {
    const sim = this.sim; if (!sim || !this.st) return;
    if (this.paused) { this.r.frame(0); return; }
    this.phaseT += dt;
    if (this.phase === "intro" && this.phaseT > 3.2) this.toCount();
    if (this.phase === "count") {
      const c = 3 - Math.floor(this.phaseT);
      if (c !== this.count && c > 0) { this.count = c; audio.play("a:race_beep", { gain: 0.6 }); this.emit({ t: "toast", text: String(c), tone: "big" }); }
      if (this.phaseT >= 3) {
        this.setPhase("race"); audio.play("a:race_beepGo", { gain: 0.7 }); this.emit({ t: "toast", text: "GO!", tone: "go" }); this.startMusic(false); this.buzz(40);
        if (this.mode.kind === "gp") this.prefetch(this.st.n + 1);
        if (this.st.rules.rolling) for (const m of sim.marbles) m.vs = this.st.vmax * 0.65;
        const g = this.goalText(); if (g) window.setTimeout(() => this.emit({ t: "toast", text: g, tone: "blue" }), 900);
      }
    }
    if (this.phase === "race" || this.phase === "done") {
      // slow motion through big jumps on a slow-mo stretch
      this.acc += dt * (this.r.view === "slowmo" && sim.marbles[0].air ? 0.45 : 1);
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 4) {
        this.acc -= 1 / 60; steps++;
        const me = sim.marbles[0];
        const inputs = sim.marbles.map((m, i) => {
          if (i === 0) return this.phase === "done" ? this.drivers[0].input(sim, m, 1 / 60) : this.playerInput();
          const inp = this.drivers[i].input(sim, m, 1 / 60);
          // keep the pack in reach: far ahead of you they ease off, far behind they try harder
          const gap = m.s - me.s;
          if (!m.finished && gap > 110 && this.st?.special !== "leader") inp.push *= 0.6;
          // rival rush: rivals fire boosts too
          if (this.st?.special === "rush" && m.boostT <= 0 && Math.random() < 0.002) m.boostT = 1.2;
          return inp;
        });
        const ev = sim.step(1 / 60, inputs);
        this.react(ev);
        // your path, for a Time Trial ghost
        if (this.phase === "race" && this.stepN++ % 6 === 0 && this.path.length < 9000) this.path.push(Math.round(me.s * 10), Math.round(me.u * 100), Math.round(me.h * 100));
        // piano keys sing as you roll over them
        if (me.on !== this.lastOn) { this.lastOn = me.on; const o = me.on >= 0 ? sim.obj(me.on) : null; if (o && (o.look === "key" || o.look === "keyB")) { const scale = [0, 2, 4, 5, 7, 9, 11, 12]; const n = scale[(o.p ?? 0) % 8] + 12 * Math.floor(((o.p ?? 0) % 16) / 8); this.snd("a:twinkle", 0.35, 0, Math.pow(2, n / 12) * 0.7); } }
        // knocked out (elimination): the race is over for you
        if (me.out && this.phase === "race") { this.finish(); break; }
      }
    }
    // rolling sound
    if (this.roll) {
      const me = sim.marbles[0], ctx = audio.ensure();
      const on = this.phase === "race" && !me.air && me.fallT <= 0 ? Math.min(1, Math.abs(me.vs) / (this.st.vmax * 1.1)) : 0;
      if (ctx) { this.roll.gain.gain.setTargetAtTime(on * 0.32, ctx.currentTime, 0.05); this.roll.filt.frequency.setTargetAtTime(220 + Math.abs(me.vs) * 55, ctx.currentTime, 0.08); }
    }
    if (this.music) this.music.fever(sim.marbles[0].boostT > 0);
    this.r.frame(dt);
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.pushHud(); }
  }

  private react(ev: Ev[]) {
    const sim = this.sim!, me = sim.marbles[0];
    for (const e of ev) {
      const m = sim.marbles.find((x) => x.id === e.m); if (!m) continue;
      const mine = m.id === 0;
      const pan = (m.u - me.u) / 6, far = Math.max(0.15, 1 - Math.abs(m.s - me.s) / 40);
      const at = () => this.r.wp(m.s, m.u, m.h + m.r);
      switch (e.t) {
        case "coin": this.snd("a:race_coin", 0.35, 0, 0.95 + (m.coins % 8) * 0.04); this.r.burst(at(), "#FFD23A", 5, 3, 2); break;
        case "gem": this.snd("a:twinkle", 0.5); this.r.burst(at(), "#5CF2FF", 12); this.emit({ t: "toast", text: "+5 💎" }); break;
        case "orb": this.snd("a:race_shield", 0.45, 0, 1.3); this.r.burst(at(), "#7CF2FF", 14); break;
        case "star": this.snd("a:levelup", 0.6); this.r.burst(at(), "#FFE14D", 24, 8, 6); this.emit({ t: "toast", text: `⭐ Star ${m.stars}/3!`, tone: "gold" }); this.buzz([15, 30, 15]); break;
        case "capsule": this.snd("a:race_pickup", 0.6); this.emit({ t: "toast", text: "Power!", tone: "pink" }); break;
        case "power": if (mine) { this.snd(e.p === "turbo" ? "a:race_nitro" : e.p === "magnet" ? "a:race_magnet" : e.p === "shield" ? "a:race_shield" : "a:race_perfect", 0.7); this.emit({ t: "toast", text: POWER_LABEL[e.p], tone: "pink" }); this.buzz(20); } break;
        case "pad": this.snd("a:race_jump", 0.55 * far, pan); if (mine) this.r.burst(at(), "#5CF2FF", 16, 6, 3); break;
        case "tramp": this.snd("boing", 0.55 * far, pan); break;
        case "boost": if (mine) { this.snd("a:race_nitro", 0.6); this.buzz(18); } break;
        case "jump": if (mine) this.snd("a:race_jump", 0.4, 0, 1.15); break;
        case "land": if (mine || far > 0.6) this.snd("a:race_land", Math.min(0.7, -e.vh / 22) * far, pan); if (mine) this.buzz(12); break;
        case "bump": if (mine || far > 0.5) { this.snd("a:bonk", Math.min(0.8, 0.25 + e.k / 20) * far, pan, 0.9 + Math.random() * 0.25); if (mine) { this.r.burst(at(), "#FFFFFF", 10, 5, 3); this.buzz(25); } } break;
        case "rail": if (mine) this.snd("a:race_land", 0.25, Math.sign(m.u) * 0.6, 1.4); break;
        case "trick": if (mine) { this.snd("a:sparks", 0.5, 0, 1 + e.n * 0.08); this.emit({ t: "toast", text: e.n > 1 ? `COMBO ×${e.n}!` : "TRICK! +boost", tone: "pink" }); } break;
        case "ring": this.snd("a:race_perfect", 0.5, 0, 1.1 + (m.rings % 3) * 0.12); this.r.burst(at(), "#FFE14D", 14, 6, 3); this.emit({ t: "toast", text: "Ring! +boost", tone: "gold" }); this.buzz(12); break;
        case "portal": if (mine || far > 0.5) this.snd("a:teleport", 0.6 * far, pan); if (mine) { this.r.burst(at(), "#5CF2FF", 30, 8, 4); this.emit({ t: "toast", text: "Portal!", tone: "blue" }); } break;
        case "switch": this.snd("a:race_checkpoint", 0.5 * far, pan, 1.3); if (mine) this.emit({ t: "toast", text: "Bridge up!", tone: "green" }); break;
        case "heart": this.snd("a:race_pickup", 0.6, 0, 1.2); this.r.burst(at(), "#FF5A7A", 16); this.emit({ t: "toast", text: "❤️ Heart: saves a fall", tone: "pink" }); break;
        case "letter": this.snd("a:twinkle", 0.6, 0, 1 + e.n * 0.12); this.r.burst(at(), "#FFD23A", 16); this.emit({ t: "toast", text: m.letters === 15 ? "O-R-B-I! +40 🪙" : ["O", "R", "B", "I"][e.n] + "!", tone: "gold" }); break;
        case "chest": this.snd("a:levelup", 0.6); this.r.burst(at(), "#FFD23A", 30, 8, 6); this.emit({ t: "toast", text: "Treasure! +30 🪙", tone: "gold" }); this.buzz([15, 30]); break;
        case "goldcoin": this.snd("a:race_coin", 0.7, 0, 0.7); this.r.burst(at(), "#FFD23A", 24, 6, 5); this.emit({ t: "toast", text: "Gold coin! +25", tone: "gold" }); break;
        case "near": this.snd("a:whooshOut", 0.3, pan, 1.4); this.emit({ t: "toast", text: "Near miss!", tone: "blue" }); break;
        case "caught": if (mine) { this.snd("a:bonk", 0.7, 0, 0.7); this.emit({ t: "toast", text: "Caught! Roll faster!", tone: "red" }); this.buzz([40, 30, 40]); } break;
        case "core": this.snd("a:race_crash", 0.7); this.r.burst(at(), "#FF2E5A", 40, 10, 8); this.emit({ t: "toast", text: e.n >= 3 ? "Kranky's machine is down! 💥" : `Core hit! ${e.n}/3`, tone: "gold" }); this.buzz([30, 30, 60]); break;
        case "out": if (mine) this.emit({ t: "toast", text: "Knocked out!", tone: "red" }); else if (far > 0.2) { this.snd("a:poof", 0.4); this.emit({ t: "toast", text: `${m.name} is out!`, tone: "blue" }); } break;
        case "paint": if (mine) { this.snd("pop", 0.4, 0, 1.2); this.emit({ t: "toast", text: e.c === 1 ? "Pink!" : "Blue!", tone: e.c === 1 ? "pink" : "blue" }); } break;
        case "limit": this.snd("a:race_beep", 0.5); this.emit({ t: "toast", text: "Too fast! Slow down", tone: "red" }); break;
        case "rocket": if (mine) { this.snd("a:race_nitro", 0.8, 0, 0.85); this.snd("a:rocket", 0.6); this.r.burst(at(), "#FFB43A", 30, 10, 4); this.emit({ t: "toast", text: "🚀 ROCKET BOOST!", tone: "gold" }); this.buzz([20, 20, 40]); } else if (far > 0.4) this.snd("a:rocket", 0.35 * far, pan); break;
        case "zap": if (mine) { this.snd("a:race_crash", 0.7); this.snd("a:buzz", 0.6); this.r.burst(at(), "#FF2E3A", 40, 10, 6); this.emit({ t: "toast", text: "⚡ ZAPPED! Don't touch the red orbs", tone: "red" }); this.buzz([60, 40, 60]); } break;
        case "fall": if (mine && !ev.some((x) => x.t === "zap" && x.m === 0)) {
          this.snd("whooshLong", 0.6); this.buzz([40, 40, 60]);
          if (this.mode.kind === "endless") { this.lives--; this.emit({ t: "toast", text: this.lives > 0 ? `${"❤️".repeat(this.lives)} left` : "Out of lives!", tone: "red" }); if (this.lives <= 0) window.setTimeout(() => this.finish(true), 900); }
          else this.emit({ t: "toast", text: "Whoops!", tone: "red" });
        } break;
        case "respawn": if (mine) this.snd("a:teleport", 0.45); break;
        case "saved": if (mine) { this.snd("a:race_shield", 0.7); this.emit({ t: "toast", text: "Shield saved you!", tone: "blue" }); } break;
        case "check": if (mine) { this.snd("a:race_checkpoint", 0.55); if (m.place !== 1) this.ledAll = false; this.emit({ t: "toast", text: this.st?.rules.lead ? (m.place === 1 ? "Leading! ✓" : "Not leading ✗") : "Checkpoint!", tone: "green" }); } break;
        case "tile": if (mine) this.snd("a:poof", 0.3, 0, 0.8); break;
        case "finish": if (mine) this.finish(); else if (far > 0.3) this.snd("a:race_crowd", 0.2 * far); break;
      }
    }
    // overtakes
    if (this.phase === "race" && me.place < this.lastPlace && this.lastPlace !== 99) { this.snd("a:whooshOut", 0.25, 0, 1.2); if (me.place <= 3) this.emit({ t: "toast", text: ORD(me.place), tone: "gold" }); }
    this.lastPlace = me.place;
  }

  private finish(over = false) {
    if (this.finished) return;
    const sim0 = this.sim!, st0 = this.st!;
    // Endless: a finish line is just the way into the next course
    if (this.mode.kind === "endless" && !over) {
      this.finished = true; this.setPhase("done");
      this.snd("a:race_checkpoint", 0.6, 0, 1.2);
      this.o.onOut?.({ t: "next", dist: (this.mode.dist ?? 0) + st0.finish, coins: sim0.marbles[0].coins, lives: this.lives });
      return;
    }
    this.finished = true;
    const sim = this.sim!, st = this.st!, me = sim.marbles[0];
    const total = sim.marbles.length, place = me.place, time = me.finishT;
    const R = st.rules;
    let pass = true, why = "";
    if (me.out) { pass = false; why = "Knocked out — stay ahead of the last marble"; }
    else if (R.win && place > 1) { pass = false; why = "Win the race to pass"; }
    else if (R.podium && place > 3) { pass = false; why = "Finish in the top 3 to pass"; }
    if (R.noFall && me.falls > 0) { pass = false; why = "No falls allowed on this one"; }
    if (R.time && time > R.time) { pass = false; why = "Beat the clock to pass"; }
    const miss = this.goalMiss();
    if (pass && miss) { pass = false; why = miss; }
    // ⭐ a win · ⭐⭐ a win with no falls · ⭐⭐⭐ and under the gold time (or all 3 hidden stars)
    const rating = !pass ? 0 : 1 + (me.falls === 0 ? 1 : 0) + (me.falls === 0 && (time <= st.gold + 0.05 || me.stars >= 3) ? 1 : 0);
    const res: RaceResult = {
      n: st.n, place, total, time, gold: st.gold, coins: me.coins, gems: me.gems, stars: me.stars, falls: me.falls, pass, rating, why, remix: st.mix, meet: st.meet,
      mode: this.mode.kind, path: this.mode.kind === "trial" ? this.path : undefined, dist: this.mode.kind === "endless" ? Math.round((this.mode.dist ?? 0) + Math.min(me.s, st.finish)) : undefined,
    };
    this.setPhase("done");
    this.r.play("finish");
    this.r.confetti(this.r.wp(me.s, me.u, me.h + 1));
    this.snd("a:race_finish", 0.7);
    setTimeout(() => this.snd(pass ? "a:race_win" : "a:race_lose", 0.7), 500);
    if (pass) setTimeout(() => this.snd("a:cheer", 0.5), 900);
    this.music?.stop(1.2);
    this.buzz(pass ? [30, 50, 30, 50, 80] : 80);
    this.o.onOut?.({ t: "finish", res });
  }

  private emit(e: OrbiOut) { this.o.onOut?.(e); }

  /** a chaser rolling up behind you */
  private chaseWarn() {
    const sim = this.sim!, me = sim.marbles[0];
    for (const o of this.st!.objs) {
      if (o.k !== "chaser" || !sim.chasing(o)) continue;
      const d = me.s - sim.os(o);
      if (d > 0 && d < 50) return `${CHASER_NAME[o.look ?? ""] ?? "Boulder"} ${Math.round(d)} m behind!`;
    }
    return "";
  }
  /** the stage's extra goal, said at the start */
  private goalText() {
    const R = this.st!.rules;
    if (R.cores) return "Hit Kranky's 3 glowing cores!";
    if (R.coins) return `Collect ${R.coins} coins!`;
    if (R.stars) return "Find all 3 hidden stars!";
    if (R.rings) return "Fly through every ring!";
    if (R.escape) return "Don't get caught!";
    if (R.lead) return "Lead at every checkpoint!";
    if (R.elim) return "Last marble at each checkpoint is out!";
    if (R.powers) return `Use ${R.powers} powers!`;
    if (R.tricks) return `Land ${R.tricks} tricks (swipe up in the air)!`;
    if (R.nopower) return "No powers on this one!";
    if (R.noFall) return "Don't fall!";
    return "";
  }
  /** what's still missing for the goal ("" when it's met) */
  private goalMiss() {
    const R = this.st!.rules, me = this.sim!.marbles[0];
    const rings = this.rings;
    if (R.cores && me.cores < R.cores) return `Hit all ${R.cores} of Kranky's cores (${me.cores}/${R.cores})`;
    if (R.coins && me.coins < R.coins) return `Collect ${R.coins} coins (${me.coins}/${R.coins})`;
    if (R.stars && me.stars < 3) return `Find all 3 stars (${me.stars}/3)`;
    if (R.rings && me.rings < rings) return `Fly through every ring (${me.rings}/${rings})`;
    if (R.escape && me.caught) return "The chaser caught you";
    if (R.lead && !this.ledAll) return "Lead at every checkpoint";
    if (R.powers && me.used < R.powers) return `Use ${R.powers} powers (${me.used}/${R.powers})`;
    if (R.tricks && me.tricks < R.tricks) return `Land ${R.tricks} tricks (${me.tricks}/${R.tricks})`;
    return "";
  }
  private goalNow(): [string, boolean] {
    const R = this.st!.rules, me = this.sim!.marbles[0];
    const rings = this.rings;
    if (R.cores) return [`💥 Cores ${me.cores}/${R.cores}`, me.cores >= R.cores];
    if (R.coins) return [`🪙 ${me.coins}/${R.coins}`, me.coins >= R.coins];
    if (R.stars) return [`⭐ ${me.stars}/3`, me.stars >= 3];
    if (R.rings) return [`💍 ${me.rings}/${rings}`, me.rings >= rings];
    if (R.escape) return [me.caught ? "😱 Caught!" : "🏃 Escape!", !me.caught];
    if (R.lead) return [this.ledAll ? "👑 Leading" : "👑 Lost the lead", this.ledAll];
    if (R.powers) return [`⚡ Powers ${me.used}/${R.powers}`, me.used >= R.powers];
    if (R.tricks) return [`🤸 Tricks ${me.tricks}/${R.tricks}`, me.tricks >= R.tricks];
    if (R.elim) return [`🥊 ${this.sim!.marbles.filter((m) => !m.out).length} left`, !me.out];
    return ["", true];
  }

  private pushHud() {
    const st = this.st, sim = this.sim; if (!st || !sim) return;
    const me = sim.marbles[0], W = worldOf(st.look.world);
    this.o.onHud?.({
      phase: this.phase, count: this.count,
      place: me.place, total: sim.marbles.length, time: this.phase === "race" || this.phase === "done" ? (me.finished ? me.finishT : sim.t) : 0,
      progress: Math.max(0, Math.min(1, me.s / st.finish)),
      dots: sim.marbles.map((m) => ({ p: Math.max(0, Math.min(1, m.s / st.finish)), me: m.id === 0, c: SKINS[m.skin % SKINS.length].color })),
      meter: me.meter, boosting: me.boostT > 0, held: me.held, active: (Object.entries(me.active) as [PowerKind, number][]).map(([k, t]) => ({ k, t })),
      coins: me.coins, gems: me.gems, stars: me.stars, falls: me.falls, speed: Math.round(Math.abs(me.vs) * 3.6),
      n: st.n, name: st.name, world: W.id, worldName: W.name, emoji: W.emoji, gold: st.gold, air: me.air,
      ...((): { goal: string; goalOk: boolean } => { const [goal, goalOk] = this.goalNow(); return { goal, goalOk }; })(),
      hearts: me.hearts, letters: me.letters, view: this.r.view,
      mode: this.mode.kind, lives: this.lives, dist: Math.round((this.mode.dist ?? 0) + Math.max(0, me.s)),
      warn: this.chaseWarn(),
    });
  }

  pause() { if (this.paused) return; this.paused = true; this.music?.stop(0.25); this.musicOn = false; this.roll?.gain.gain.setValueAtTime(0, audio.ensure()?.currentTime ?? 0); }
  resume() { if (!this.paused) return; this.paused = false; this.last = performance.now(); if (this.music && this.phase !== "done") { this.music.start(this.music.beatNow()); this.musicOn = true; } }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf); this.ro.disconnect();
    const cv = this.r.cv;
    cv.removeEventListener("pointerdown", this.onDown); cv.removeEventListener("pointermove", this.onMove);
    cv.removeEventListener("pointerup", this.onUp); cv.removeEventListener("pointercancel", this.onUp); cv.removeEventListener("contextmenu", this.noMenu);
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKeyUp); window.removeEventListener("deviceorientation", this.onTilt);
    this.worker?.terminate();
    const m = this.music; m?.stop(0.2); setTimeout(() => m?.dispose(), 400);
    if (this.roll) { try { this.roll.src.stop(); } catch { /* already */ } this.roll.gain.disconnect(); }
    this.r.dispose();
  }
}
const CHASER_NAME: Record<string, string> = { boulder: "🪨 Boulder", rocks: "🪨 Rockfall", candy: "🍬 Candy avalanche", dominoes: "🁢 Dominoes", worm: "🪱 Sandworm", train: "🚂 Ghost train", tornado: "🌪️ Tornado", storm: "🌪️ Storm", comet: "☄️ Comet", meteor: "☄️ Meteor", chaser: "😈 Kranky's ball" };
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown"]);
export const POWER_LABEL: Record<PowerKind, string> = { turbo: "🚀 Turbo!", magnet: "🧲 Magnet!", shield: "🫧 Shield!", jump: "⏫ Super Jump!", giant: "🟣 Giant Marble!", feather: "🪶 Feather!", bridge: "🌈 Rainbow Bridge!", star: "⭐ Star Power!" };

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __orbi?: { last?: OrbiSession } }).__orbi ??= {};
export function registerDev(s: OrbiSession) {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __orbi: { last?: OrbiSession } }).__orbi.last = s;
}
