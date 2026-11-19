// Momo Jelly Jam session: owns the 3D board, finger/mouse drag (a jelly follows your finger through free cells and
// drops where you let go), undo / restart / hint, helpers, stage timers and lost states, the stage soundtrack (a new mix
// every stage on the MOMOBLOBS music engine), sounds panned by where things happen, haptics, and the worker that builds
// the next stage (or a mode's stage) ahead of time.
import { audio, type Sound } from "@/lib/audio";
import { hash32 } from "../roll/rng";
import { RollMusic } from "../roll/music";
import type { SectionKind, SongPlan, SongZone } from "../roll/types";
import { worldOf } from "./data/worlds";
import { buildMode, buildStage, recipeFor, type FusionMemory, type ModeSpec } from "./gen";
import { JellyRenderer, type JamStyle, type Quality } from "./render3d";
import { JamSfx, type TileSound } from "./sfx";
import { apply, counts, newState, reach, stateKey } from "./rules";
import { CELL, CRATE, PLAIN_COLOURS, type JamEvent, type Level, type Move, type StageKind, type State } from "./types";
import type { JamAsk, JamReply } from "./worker";

export interface JamHud {
  n: number; world: number; worldName: string; emoji: string; name: string; kind: StageKind; fusion?: string;
  moves: number; par: number; canUndo: boolean; hinted: boolean; hinting: boolean; meet?: string;
  mode?: string;
  /** what this stage asks of you (move limit, timer, exit order…) and what you hold */
  lost?: string; timeLeft?: number; limit?: number; order?: number[]; out: number; keys: number; coins: number; bonus: number; lives?: number; falls: number;
  noUndo: boolean; undoCost?: number; armed?: string;
}
export type JamOut =
  | { t: "win"; level: Level; moves: number; hinted: boolean; bonus: number }
  | { t: "moved"; moves: Move[]; hinted: boolean }
  | { t: "lost"; why: string }
  /** a helper changed the stage itself (save it with the moves) */
  | { t: "level"; level: Level; moves: Move[] };
export interface JamOptions {
  quality: Quality; haptics: boolean; reduced: boolean;
  salt: number; memory: () => FusionMemory;
  style?: JamStyle;
  onHud?: (h: JamHud) => void;
  onOut?: (e: JamOut) => void;
  /** pay coins (undo-cost stages) — false when there aren't enough */
  spend?: (n: number) => boolean;
}
/** the helpers a player can use (earned with stars) */
export type HelperId = "H03" | "H04" | "H05" | "H06" | "H07" | "H08" | "H09" | "H10" | "H11" | "H12" | "H13" | "H14" | "H15";

/** which voice of the sound set each slide / shape change uses */
const SLIDE_SOUND: Record<Extract<JamEvent, { t: "slide" }>["why"], TileSound> = {
  ice: "ice", spring: "spring", bumper: "bumper", fall: "fall", drift: "wind", wind: "wind", tele: "tele", rewind: "rewind", bounce: "spring",
  magnet: "magnet", tilt: "wind", echo: "turn", kranky: "kranky", wrap: "wrap",
};
const SHAPE_SOUND: Record<Extract<JamEvent, { t: "shape" }>["why"], TileSound> = {
  paint: "paint", rinse: "rinse", shrink: "shrink", stretch: "grow", split: "split", bubble: "bubble", pop: "bubble", wash: "rinse", charge: "spawn",
  dirty: "mud", grow: "grow", spin: "spin", stone: "stone", eat: "eat", press: "bumper", copy: "spawn", swap: "tele", thaw: "thaw", chameleon: "paint",
};

const SECTIONS: [SectionKind, number][] = [["intro", 1], ["verse", 1], ["build", 2], ["chorus", 2], ["verse", 1], ["break", 1], ["chorus", 2], ["build", 2]];

export class JamSession {
  readonly r: JellyRenderer;
  L!: Level;
  s!: State;
  private o: JamOptions;
  private host: HTMLElement;
  private hist: State[] = [];
  private moves: Move[] = [];
  private hinted = false;
  private hinting = false;
  private won = false;
  private worker: Worker | null = null;
  private askId = 0;
  private builds = new Map<number, { resolve: (l: Level) => void; n: number }>();
  private ready = new Map<number, Level>();
  private building = new Set<number>();
  private hintAsk = 0;
  private hintThen: ((m: Move | null) => void) | null = null;
  private drag: { id: number; k: number; gx: number; gy: number; sx: number; sy: number; cx: number; cy: number; reach: Set<number>; pointer: number; mirror: boolean } | null = null;
  private music: RollMusic | null = null;
  /** the synthesised ASMR sound set + world ambience */
  private fx = new JamSfx();
  private feverOn = false;
  private hurry = false;
  private outBefore = 0;
  private musicN = -1;
  private musicOn = false;
  private raf = 0;
  private last = 0;
  paused = false;
  private destroyed = false;
  private ro: ResizeObserver;
  private timeLeft = 0;
  private freezeUntil = 0;
  private hudClock = 0;
  /** a helper waiting for a tap (hammer, paint brush, beam) */
  private armed: { id: HelperId; pick?: number } | null = null;

  constructor(host: HTMLElement, o: JamOptions) {
    this.host = host; this.o = o;
    this.r = new JellyRenderer(host, o.quality);
    if (o.style) this.r.setStyle(o.style);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const cv = this.r.cv;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointercancel", this.onCancel);
    cv.addEventListener("contextmenu", this.noMenu);
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url));
      this.worker.onmessage = (ev: MessageEvent<JamReply>) => this.onReply(ev.data);
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; };
    } catch { this.worker = null; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() { const b = this.host.getBoundingClientRect(); this.r.resize(b.width, b.height); }
  /** room the HUD takes at the top and the buttons at the bottom (CSS px) */
  setInsets(top: number, bottom: number) { this.r.setInsets(top, bottom); }
  setStyle(st: JamStyle) { this.r.setStyle(st); if (this.L) this.r.setLevel(this.L, this.s); }

  // ---------------------------------------------------------------- stages
  /** start (or resume) a stage, replaying any saved moves */
  load(L: Level, moves: Move[] = [], hinted = false) {
    this.L = L;
    this.s = newState(L);
    this.hist = []; this.moves = [];
    for (const m of moves) { const r = apply(L, this.s, m); if (!r) continue; this.hist.push(this.s); this.s = r.s; this.moves.push(m); }
    this.hinted = hinted; this.hinting = false; this.won = false; this.drag = null; this.armed = null;
    this.timeLeft = L.rules?.time ?? 0; this.freezeUntil = 0;
    this.r.setLevel(L, this.s);
    this.startMusic();
    if (!L.mode) this.prefetch(L.n + 1);
    this.pushHud();
  }
  /** build stage n ahead of time in the worker */
  prefetch(n: number) {
    if (this.ready.has(n) || this.building.has(n)) return;
    this.building.add(n);
    if (!this.worker) return;
    const id = ++this.askId;
    this.builds.set(id, { n, resolve: (l) => { this.ready.set(n, l); this.building.delete(n); } });
    this.worker.postMessage({ kind: "build", id, n, salt: this.o.salt, mem: this.o.memory() } satisfies JamAsk);
  }
  /** stage n: from the worker if it is ready (or soon), else built right here (a re-rolled stage uses another salt) */
  stage(n: number, reroll = 0): Promise<Level> {
    const salt = this.o.salt + reroll * 7919;
    const have = reroll ? undefined : this.ready.get(n);
    if (have) { this.ready.delete(n); return Promise.resolve(have); }
    if (this.worker) {
      return new Promise((resolve) => {
        const id = ++this.askId;
        this.builds.set(id, { n, resolve });
        this.worker!.postMessage({ kind: "build", id, n, salt, mem: this.o.memory() } satisfies JamAsk);
      });
    }
    return Promise.resolve(buildStage(recipeFor(n, salt, this.o.memory())));
  }
  /** a mode's stage (Daily Jam, Rush, Zen, Kranky Weekly, Jam Lab, Puzzle Packs) */
  modeStage(spec: ModeSpec, known: string[]): Promise<Level> {
    if (this.worker) {
      return new Promise((resolve) => {
        const id = ++this.askId;
        this.builds.set(id, { n: -1, resolve });
        this.worker!.postMessage({ kind: "mode", id, spec, known } satisfies JamAsk);
      });
    }
    return Promise.resolve(buildMode(spec, known));
  }
  private onReply(rep: JamReply) {
    if (this.destroyed) return;
    if (rep.kind === "build") {
      const b = this.builds.get(rep.id);
      if (!b) return;
      this.builds.delete(rep.id);
      b.resolve(rep.level);
    } else if (rep.id === this.hintAsk) {
      this.hinting = false;
      const then = this.hintThen; this.hintThen = null;
      if (then) then(rep.move); else this.showHint(rep.move);
      this.pushHud();
    }
  }

  // ---------------------------------------------------------------- music: a new mix every stage
  private startMusic() {
    const L = this.L;
    const W = worldOf(L.world);
    this.fx.ambience(W.props, !!W.look.night);
    this.feverOn = false; this.hurry = false;
    this.music?.fever(false); this.music?.setTempo(1);
    if (this.musicN === L.n && !L.mode) return;
    this.musicN = L.n;
    const style = W.music.styles[(L.n + (L.look % 3)) % W.music.styles.length];
    const mood = L.kind === "boss" ? "kranky boss" : L.kind === "burner" ? `${W.music.mood} danger` : L.kind === "breather" || L.mode === "zen" ? `${W.music.mood} calm` : W.music.mood;
    const zones: SongZone[] = [];
    let b = 0;
    const lift = L.kind === "boss" || L.kind === "burner" || L.mode === "rush" ? 1 : 0;
    for (let i = 0; i < SECTIONS.length; i++) {
      const [section, intensity] = SECTIONS[(i + L.n) % SECTIONS.length];
      zones.push({ beat0: b, beats: 16, mood, section, intensity: Math.min(3, intensity + lift), style });
      b += 16;
    }
    // the melody is the chapter's theme (10 stages of one world share it), so a world sounds like itself; fusion and modes get their own
    const theme = L.stage > 0 && !L.mode ? hash32(L.world, Math.floor((L.stage - 1) / 10), 0x1e11) : hash32(L.n, L.seed, 0x1e11);
    const plan: SongPlan = { bpm: W.music.bpm + ((L.n * 7) % 9) - 4 + (L.mode === "rush" ? 12 : L.mode === "zen" ? -10 : 0), root: 46 + (L.n % 9), seed: theme, zones, beats: b };
    this.fx.setKey(plan.root);
    const old = this.music;
    old?.stop(0.5);
    if (old) setTimeout(() => old.dispose(), 700);
    try { this.music = new RollMusic(plan, 1); this.music.loop = true; } catch { this.music = null; }
    this.musicOn = false;
    const ctx = audio.ensure();
    if (this.music && ctx && ctx.state === "running" && !this.paused) { this.music.start(0); this.musicOn = true; }
  }

  // ---------------------------------------------------------------- input: drag a jelly
  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    audio.ensure(); void audio.resume();
    if (this.music && !this.musicOn && !this.paused) { this.music.start(0); this.musicOn = true; }
    if (this.paused || this.won || !this.L || this.s.lost || this.r.busy || this.drag) return;
    const p = this.local(e);
    const at = this.r.pick(p.x, p.y);
    if (!at) return;
    const cx = Math.floor(at.x), cy = Math.floor(at.y);
    if (this.armed) { this.armedTap(cx, cy); return; }
    const k = this.s.pieces.findIndex((q) => { for (let i = 0; i < q.c.length; i += 2) if (q.x + q.c[i] === cx && q.y + q.c[i + 1] === cy) return true; return false; });
    if (k < 0) { this.r.lookAt(at.x, at.y); return; }
    const piece = this.s.pieces[k];
    const R = reach(this.L, this.s, k);
    if (R.length <= 1) { this.r.release(piece.id); this.fx.nope(this.pan(at.x)); this.buzz(4); return; }
    const mirror = !!(this.L.rules?.mirror || piece.f?.contrary);
    this.drag = { id: piece.id, k, gx: at.x - piece.x, gy: at.y - piece.y, sx: piece.x, sy: piece.y, cx: piece.x, cy: piece.y, reach: new Set(R), pointer: e.pointerId, mirror };
    try { this.r.cv.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    this.r.drag(piece.id, piece.x, piece.y);
    this.r.lookAt(at.x, at.y);
    this.r.hint(null, this.s);
    this.fx.grab(piece.c.length >> 1, this.pan(at.x));
    this.buzz(6);
  };
  private onMove = (e: PointerEvent) => {
    const p = this.local(e);
    const at = this.r.pick(p.x, p.y);
    if (!at) return;
    this.r.lookAt(at.x, at.y);
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    // the free origin closest to where the finger wants it (the jelly never jumps through anything); contrary jellies go the other way
    let tx = at.x - d.gx, ty = at.y - d.gy;
    if (d.mirror) { tx = d.sx - (tx - d.sx); ty = d.sy - (ty - d.sy); }
    let best = d.cy * this.L.W + d.cx, bd = Math.hypot(tx - d.cx, ty - d.cy);
    for (const pos of d.reach) {
      const x = pos % this.L.W, y = (pos / this.L.W) | 0;
      const dd = Math.hypot(tx - x, ty - y);
      if (dd < bd - 0.05) { bd = dd; best = pos; }
    }
    const nx = best % this.L.W, ny = (best / this.L.W) | 0;
    if (nx !== d.cx || ny !== d.cy) {
      d.cx = nx; d.cy = ny;
      this.r.drag(d.id, nx, ny);
      this.fx.slide(this.pan(nx));
    }
  };
  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    this.drag = null;
    this.r.lookAway();
    if (d.cx === d.sx && d.cy === d.sy) { this.r.release(d.id); return; }
    this.commit({ id: d.id, x: d.cx, y: d.cy });
  };
  private onCancel = () => { if (this.drag) { this.r.drag(this.drag.id, this.drag.sx, this.drag.sy); this.r.release(this.drag.id); this.drag = null; } };
  private noMenu = (e: Event) => e.preventDefault();
  private local(e: PointerEvent) { const b = this.r.cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
  private pan(x: number) { return Math.max(-0.85, Math.min(0.85, ((x - this.L.W / 2) / (this.L.W / 2)) * 0.8)); }

  /** play a move */
  private commit(m: Move) {
    const res = apply(this.L, this.s, m);
    if (!res) return;
    this.outBefore = this.s.out;
    this.hist.push(this.s);
    this.s = res.s;
    this.moves.push(m);
    let outs = 0;
    const dur = this.r.play(res.ev, this.s, (ev) => this.sound(ev, ++outs));
    this.o.onOut?.({ t: "moved", moves: this.moves.slice(), hinted: this.hinted });
    this.pushHud();
    this.adapt();
    if (res.ev.some((x) => x.t === "win")) {
      this.won = true;
      setTimeout(() => { if (!this.destroyed) this.o.onOut?.({ t: "win", level: this.L, moves: this.moves.length, hinted: this.hinted, bonus: this.s.stars + this.s.coins }); }, (dur + 0.35) * 1000);
    } else if (this.s.lost) {
      const why = this.s.lost;
      setTimeout(() => { if (!this.destroyed) this.o.onOut?.({ t: "lost", why }); }, (dur + 0.2) * 1000);
    }
  }
  /** adaptive music: a sparkle layer once the tray is nearly clear, a faster beat when the clock runs low */
  private adapt() {
    const m = this.music; if (!m) return;
    const total = this.L.pieces.filter((p) => counts(this.L, p)).length, left = this.s.pieces.filter((p) => counts(this.L, p)).length;
    const near = this.s.out > 0 && left <= Math.max(1, Math.round(total * 0.3)) && !this.s.lost;
    if (near !== this.feverOn) { this.feverOn = near; m.fever(near); }
    const hurry = !!this.L.rules?.time && this.timeLeft > 0 && this.timeLeft <= 10 && !this.won && !this.s.lost;
    if (hurry !== this.hurry) { this.hurry = hurry; m.setTempo(hurry ? 1.15 : 1); }
  }
  private sizeOf(id: number) { const p = this.s.pieces.find((q) => q.id === id) ?? this.L.pieces.find((q) => q.id === id); return p ? p.c.length >> 1 : 3; }
  private sound(e: JamEvent, n: number) {
    const L = this.L;
    switch (e.t) {
      case "move": this.fx.drop(this.sizeOf(e.id), this.pan(e.x)); this.buzz(5); break;
      case "turn": this.fx.tile(e.flip ? "flip" : "turn", this.pan(e.piece.x)); this.sfx("a:wobble", 0.18, this.pan(e.piece.x), 1); break;
      case "belt": this.fx.tile("belt", this.pan(e.x)); break;
      case "slide": this.fx.tile(SLIDE_SOUND[e.why], this.pan(e.x)); if (e.why === "bumper" || e.why === "spring") this.buzz(10); break;
      case "shape": this.fx.tile(SHAPE_SOUND[e.why], this.pan(e.piece.x)); break;
      case "spawn": this.fx.tile("spawn", this.pan(e.piece.x)); break;
      case "remove": this.fx.tile(e.why === "fall" ? "fall" : e.why === "crack" ? "crumble" : e.why === "eat" ? "eat" : "split", 0); break;
      case "get": this.fx.tile(e.what, this.pan(e.cell % L.W)); this.buzz(8); break;
      case "switch": this.fx.tile("switch", this.pan(e.cell % L.W)); this.buzz(6); break;
      case "door": this.fx.tile(e.solid ? "doorClose" : "doorOpen", 0); break;
      case "wear": this.fx.tile(e.broken ? "crumble" : "glass", this.pan(e.cell % L.W)); break;
      case "merge": this.fx.squish(e.piece.c.length >> 1, this.pan(e.piece.x)); this.buzz([8, 20, 12]); break;
      case "exit": {
        const g = L.gates[e.gate];
        const gx = g.side === 1 ? 1 : g.side === 3 ? -1 : g.side === 4 ? ((g.at % L.W) + g.w / 2 - L.W / 2) / (L.W / 2) : (g.at + g.w / 2 - L.W / 2) / (L.W / 2);
        this.fx.exit(this.outBefore + n - 1, gx * 0.8, g.side === 4);
        this.sfx("a:whooshOut", 0.2, gx * 0.8, g.side === 4 ? 0.8 : 1);
        this.buzz([12, 30, 16]);
        break;
      }
      case "lost": this.fx.lost(); this.buzz([40, 30, 40]); break;
      case "win": this.fx.win(); this.sfx("confetti", 0.35, 0, 1); this.buzz([20, 40, 20, 40, 30]); break;
    }
  }

  // ---------------------------------------------------------------- buttons
  get canUndo() { return this.hist.length > 0 && !this.won && !this.L?.rules?.noUndo; }
  undo(n = 1) {
    if (this.won || !this.hist.length || this.r.busy || this.L.rules?.noUndo) return;
    const cost = this.L.rules?.undoCost;
    if (cost && !(this.o.spend?.(cost) ?? true)) { this.sfx("hmm", 0.35, 0, 1); return; }
    for (let i = 0; i < n && this.hist.length; i++) { this.s = this.hist.pop()!; this.moves.pop(); }
    this.r.sync(this.s);
    this.fx.tile("rewind", 0);
    this.adapt();
    this.o.onOut?.({ t: "moved", moves: this.moves.slice(), hinted: this.hinted });
    this.pushHud();
  }
  restart() {
    if (this.won || !this.moves.length) return;
    this.s = newState(this.L);
    this.hist = []; this.moves = [];
    this.timeLeft = this.L.rules?.time ?? 0;
    this.r.sync(this.s);
    this.sfx("a:scramble", 0.3, 0, 1);
    this.adapt();
    this.o.onOut?.({ t: "moved", moves: [], hinted: this.hinted });
    this.pushHud();
  }
  /** the next move of the built route if we're still on it, else from the solver */
  private nextMove(then: (m: Move | null) => void) {
    let s = newState(this.L), on = true;
    for (let i = 0; i < this.moves.length && on; i++) {
      const sol = this.L.solution[i];
      const m = this.moves[i];
      if (!sol || sol.id !== m.id || sol.x !== m.x || sol.y !== m.y) on = false;
      else { const r = apply(this.L, s, m); if (r) s = r.s; }
    }
    if (on && this.L.solution[this.moves.length] && stateKey(this.L, s) === stateKey(this.L, this.s)) { then(this.L.solution[this.moves.length]); return; }
    if (!this.worker) { then(null); return; }
    this.hinting = true;
    this.hintAsk = ++this.askId;
    this.hintThen = then;
    this.worker.postMessage({ kind: "hint", id: this.hintAsk, level: this.L, state: this.s } satisfies JamAsk);
    this.pushHud();
  }
  hint() {
    if (this.won || this.hinting || this.r.busy || this.s.lost) return;
    this.hinted = true;
    this.o.onOut?.({ t: "moved", moves: this.moves.slice(), hinted: true });
    this.nextMove((m) => this.showHint(m));
  }
  private showHint(m: Move | null) {
    this.r.hint(m, this.s);
    this.sfx(m ? "a:twinkle" : "hmm", 0.35, 0, 1);
    this.pushHud();
  }

  // ---------------------------------------------------------------- helpers (earned with stars)
  /** use a helper; tap helpers arm and wait for a tap on the board. Returns false if it can't be used here. */
  helper(id: HelperId): boolean {
    if (this.won || this.r.busy) return false;
    const L = this.L, R = L.rules ?? {};
    switch (id) {
      case "H14": if (!this.hist.length) return false; this.undoFree(5); return true;
      case "H11": case "H03":
        if (this.s.lost) return false;
        this.hinted = true;
        this.nextMove((m) => { if (m) this.commit(m); else this.showHint(null); });
        return true;
      case "H05": if (!L.pads.length) return false; this.edit((l) => { l.pads.forEach((p) => p.uses++); }, (s) => { s.pads = s.pads.map((u) => u + 1); }); return true;
      case "H06": if (!R.limit) return false; this.edit((l) => { l.rules!.limit = (l.rules!.limit ?? 0) + 5; }); return true;
      case "H07": if (!R.view?.fog?.length && !R.view?.peek) return false; this.edit((l) => { if (l.rules?.view) { l.rules.view.fog = []; delete l.rules.view.peek; } }); return true;
      case "H09": if (!R.time) return false; this.freezeUntil = performance.now() + 10000; this.pushHud(); return true;
      case "H15": return false;
      default: this.armed = { id }; this.pushHud(); this.sfx("a:twinkle", 0.3, 0, 1.4); return true;
    }
  }
  disarm() { this.armed = null; this.pushHud(); }
  private undoFree(n: number) {
    for (let i = 0; i < n && this.hist.length; i++) { this.s = this.hist.pop()!; this.moves.pop(); }
    this.r.sync(this.s); this.sfx("rewind", 0.4, 0, 1.1);
    this.o.onOut?.({ t: "moved", moves: this.moves.slice(), hinted: this.hinted });
    this.pushHud();
  }
  /** a tap while a helper is armed */
  private armedTap(cx: number, cy: number) {
    const a = this.armed!, L = this.L, ci = cy * L.W + cx;
    const piece = this.s.pieces.find((q) => { for (let i = 0; i < q.c.length; i += 2) if (q.x + q.c[i] === cx && q.y + q.c[i + 1] === cy) return true; return false; });
    const home = piece && L.pieces.find((q) => q.id === piece.id && q.x === piece.x && q.y === piece.y && q.c.join() === piece.c.join());
    const done = () => { this.armed = null; this.pushHud(); };
    switch (a.id) {
      case "H12": case "H04": case "H13": {
        // break a wall, a door cell, a crate — or fill a pit
        if (piece?.color === CRATE && !piece.f?.kranky) { this.edit((l) => { l.pieces = l.pieces.filter((q) => q.id !== piece.id); }, (s) => { s.pieces = s.pieces.filter((q) => q.id !== piece.id); }); done(); return; }
        const door = L.doors?.findIndex((d) => d.cells.includes(ci)) ?? -1;
        if (door >= 0) { this.edit((l) => { l.doors![door].cells = l.doors![door].cells.filter((c) => c !== ci); }); done(); return; }
        if (L.walls[ci] !== CELL.floor) { this.edit((l) => { l.walls[ci] = CELL.floor; }); done(); return; }
        this.sfx("hmm", 0.3, 0, 1); return;
      }
      case "H08": {
        // paint brush: a jelly that hasn't moved yet takes the next colour on the tray
        if (!piece || !home || piece.color >= 8) { this.sfx("hmm", 0.3, 0, 1); return; }
        const cols = [...new Set(L.pieces.map((p) => p.color).filter((c) => c < 8))].filter((c) => PLAIN_COLOURS.includes(c));
        const next = cols[(cols.indexOf(piece.color) + 1) % cols.length];
        this.edit((l) => { const p = l.pieces.find((q) => q.id === piece.id); if (p) p.color = next; }, (s) => { s.pieces = s.pieces.map((q) => (q.id === piece.id ? { ...q, color: next } : q)); });
        done(); return;
      }
      case "H10": {
        // Zib's beam: pick a jelly that hasn't moved yet, then a free spot
        if (a.pick === undefined) { if (!piece || !home) { this.sfx("hmm", 0.3, 0, 1); return; } a.pick = piece.id; this.r.release(piece.id); this.sfx("a:tickHi", 0.3, 0, 1.3); this.pushHud(); return; }
        const p = this.s.pieces.find((q) => q.id === a.pick);
        if (!p) { done(); return; }
        const occ = new Set<number>();
        for (const q of this.s.pieces) if (q.id !== p.id) for (let i = 0; i < q.c.length; i += 2) occ.add((q.y + q.c[i + 1]) * L.W + q.x + q.c[i]);
        let ok = true;
        for (let i = 0; i < p.c.length; i += 2) { const x = cx + p.c[i], y = cy + p.c[i + 1]; if (x < 0 || y < 0 || x >= L.W || y >= L.H || occ.has(y * L.W + x) || L.walls[y * L.W + x] !== CELL.floor) ok = false; }
        if (!ok) { this.sfx("hmm", 0.3, 0, 1); return; }
        this.edit((l) => { const q = l.pieces.find((z) => z.id === p.id); if (q) { q.x = cx; q.y = cy; } }, (s) => { s.pieces = s.pieces.map((q) => (q.id === p.id ? { ...q, x: cx, y: cy } : q)); });
        done(); return;
      }
    }
    done();
  }
  /** a helper changes the stage: the level (saved with the moves) and the live state */
  private edit(level: (l: Level) => void, state?: (s: State) => void) {
    const l2 = JSON.parse(JSON.stringify(this.L)) as Level;
    l2.rules ??= {};
    level(l2);
    if (l2.rules && !Object.keys(l2.rules).length) delete l2.rules;
    this.L = l2;
    const s2 = { ...this.s, pieces: this.s.pieces.slice(), pads: this.s.pads.slice() };
    state?.(s2);
    this.s = s2;
    this.hist = this.hist.map((h) => { const c = { ...h, pieces: h.pieces.slice(), pads: h.pads.slice() }; state?.(c); return c; });
    this.r.setLevel(l2, this.s);
    this.sfx("a:levelup", 0.3, 0, 1.6);
    this.o.onOut?.({ t: "level", level: l2, moves: this.moves.slice() });
    this.pushHud();
  }

  pause() { if (this.paused) return; this.paused = true; this.music?.stop(0.25); this.musicOn = false; this.fx.pause(); }
  resume() {
    if (!this.paused) return;
    this.paused = false; this.last = performance.now();
    this.fx.resume();
    if (this.music) { this.music.start(this.music.beatNow()); this.musicOn = true; }
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.r.frame(this.paused ? 0 : dt);
    if (!this.paused) this.fx.frame(dt);
    // the stage clock (R09 / K08)
    if (this.L?.rules?.time && !this.paused && !this.won && !this.s.lost && now > this.freezeUntil && this.moves.length + (this.timeLeft < (this.L.rules.time ?? 0) ? 1 : 0) > 0) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      this.hudClock += dt;
      if (this.hudClock > 0.25) { this.hudClock = 0; this.pushHud(); this.adapt(); }
      if (this.timeLeft <= 0) {
        this.s = { ...this.s, lost: "time" };
        this.r.shakeIt(); this.fx.lost();
        this.pushHud();
        this.o.onOut?.({ t: "lost", why: "time" });
      }
    }
  };

  private pushHud() {
    const L = this.L; if (!L) return;
    const W = worldOf(L.world), R = L.rules;
    this.o.onHud?.({
      n: L.n, world: L.world, worldName: W.name, emoji: W.emoji, name: L.name, kind: L.kind, fusion: L.fusion?.name,
      moves: this.moves.length, par: L.par, canUndo: this.canUndo, hinted: this.hinted, hinting: this.hinting, meet: L.meet,
      mode: L.mode, lost: this.s.lost, timeLeft: R?.time ? Math.ceil(this.timeLeft) : undefined, limit: R?.limit, order: R?.order,
      out: this.s.out, keys: this.s.keys, coins: this.s.coins, bonus: this.s.stars, lives: R?.lives, falls: this.s.falls,
      noUndo: !!R?.noUndo, undoCost: R?.undoCost, armed: this.armed ? `${this.armed.id}${this.armed.pick !== undefined ? "+" : ""}` : undefined,
    });
  }
  private sfx(name: Sound, gain: number, pan = 0, rate = 1) { try { audio.play(name, { gain, pan, rate, duck: false }); } catch { /* audio not ready */ } }
  private buzz(p: number | number[]) {
    if (!this.o.haptics || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try { navigator.vibrate?.(p); } catch { /* unsupported */ }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const cv = this.r.cv;
    cv.removeEventListener("pointerdown", this.onDown);
    cv.removeEventListener("pointermove", this.onMove);
    cv.removeEventListener("pointerup", this.onUp);
    cv.removeEventListener("pointercancel", this.onCancel);
    cv.removeEventListener("contextmenu", this.noMenu);
    this.worker?.terminate();
    const m = this.music;
    m?.stop(0.2);
    setTimeout(() => m?.dispose(), 400);
    this.fx.dispose();
    this.r.dispose();
  }
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __jam?: { last?: JamSession } }).__jam ??= {};
}
export function registerDev(s: JamSession) {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __jam: { last?: JamSession } }).__jam.last = s;
}
