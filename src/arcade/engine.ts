// MOMOBLOBS Arcade Engine — base class every arcade game extends.
// 2D canvas, game-time timers & tweens, particles, score/combo/hearts, seeded unlimited levels
// with no-repeat bags, level transitions, character reactions (sprite + voice + optional voice-over).
import { audio, type MusicName, type Sound } from "@/lib/audio";
import type { Difficulty, Settings } from "@/lib/store";
import { clayText, rgba, star, type G } from "./paint";

// ---------------------------------------------------------------- cast sprites
export type CastId = "momo" | "kranky" | "tiki" | "pip" | "gloop" | "hoot" | "noodle" | "zib" | "bolt" | "bonbon" | "turbo";
export type Mood = "happy" | "wow" | "sad";
const LEGACY: Record<string, Record<Mood, string>> = {
  momo: { happy: "/brand/momo-cheer.webp", wow: "/brand/momo-surprised.webp", sad: "/brand/momo-scared.webp" },
  kranky: { happy: "/brand/kranky.webp", wow: "/brand/kranky.webp", sad: "/brand/kranky-laugh.webp" },
  tiki: { happy: "/brand/tiki-sign.webp", wow: "/brand/tiki.webp", sad: "/brand/tiki.webp" },
};
export const spriteUrl = (id: CastId, mood: Mood) => LEGACY[id]?.[mood] ?? `/brand/chars/${id}-${mood}.webp`;

// ---------------------------------------------------------------- randomness
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}
export function hash(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const ch of parts.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Draw-without-replacement bag: every item appears once per cycle and never twice in a row. */
export class Bag<T> {
  private pool: T[] = [];
  private last: T | undefined;
  constructor(private items: readonly T[]) {}
  next(rng: Rng): T {
    if (!this.pool.length) {
      this.pool = rng.shuffle([...this.items]);
      if (this.pool.length > 1 && this.pool[this.pool.length - 1] === this.last) [this.pool[0], this.pool[this.pool.length - 1]] = [this.pool[this.pool.length - 1], this.pool[0]];
    }
    this.last = this.pool.pop()!;
    return this.last;
  }
}

/** Remembers recent layout signatures so a fresh level never repeats a recent one. */
export class Recent {
  private list: string[] = [];
  constructor(private size = 12) {}
  has(sig: string) { return this.list.includes(sig); }
  add(sig: string) { this.list.push(sig); if (this.list.length > this.size) this.list.shift(); }
}

// ---------------------------------------------------------------- easing + ramps
export const ease = {
  linear: (u: number) => u,
  out: (u: number) => 1 - Math.pow(1 - u, 3),
  in: (u: number) => u * u * u,
  inOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  back: (u: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  elastic: (u: number) => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** gentle per-level ramp: start + (level-1)*step, capped */
export const ramp = (level: number, start: number, step: number, cap: number) => (step >= 0 ? Math.min(cap, start + (level - 1) * step) : Math.max(cap, start + (level - 1) * step));
export const byDiff = <T>(d: Difficulty, v: { easy: T; medium: T; hard: T }) => v[d];

// ---------------------------------------------------------------- HUD contract (rendered by ArcadeHost)
export type Tone = "gold" | "mint" | "pink" | "navy" | "red";
export interface HudState {
  status: "loading" | "lobby" | "playing" | "over";
  difficulty: Difficulty;
  level: number;
  score: number;
  combo: number;
  mult: number;
  best: number;
  lives: number | null;
  timer: number | null;
  timerColor: string;
  hint: string | null;
  banner: { id: number; title: string; sub?: string; tone: Tone } | null;
  host: { id: number; mood: Mood; line: string | null };
  result: { score: number; level: number; best: number; newBest: boolean; coins: number } | null;
}

export interface GameMeta {
  slug: string;
  title: string;
  host: CastId;
  style: "rounds" | "run";
  music: { calm: MusicName; action: MusicName };
  sounds: Sound[];
  sprites?: string[];
  voicePitch?: number;
  transition?: "iris" | "blink" | "curtain";
}

export interface EngineEvents {
  onHud: (s: HudState) => void;
  onProgress?: (p: number) => void;
  onClear: (info: { difficulty: Difficulty; level: number; score: number; coins: number }) => void;
  onRunOver: (info: { difficulty: Difficulty; level: number; score: number; coins: number }) => void;
  onFps?: (fps: number) => void;
}

interface Timer { at: number; fn: () => void; level: boolean }
interface Tween { o: Record<string, number>; from: Record<string, number>; to: Record<string, number>; t0: number; dur: number; ease: (u: number) => number; done?: () => void }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "dot" | "star" | "conf" | "bubble" | "drop" | "ring"; rot: number; vr: number; g: number }
interface Floater { text: string; x: number; y: number; life: number; color: string; size: number }

const DIFF_MULT: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };
const CHEERS = ["GREAT!", "SUPER!", "AWESOME!", "NICE ONE!", "WOW!", "YES!"];

export abstract class ArcadeGame {
  abstract readonly meta: GameMeta;
  readonly canvas: HTMLCanvasElement;
  readonly g: G;
  W = 1; H = 1; dpr = 1;
  /** space taken by the HUD at the top / the home bar at the bottom (CSS px) */
  insetTop = 110; insetBottom = 16;
  setInsets(top: number, bottom: number) {
    if (Math.abs(top - this.insetTop) < 1 && Math.abs(bottom - this.insetBottom) < 1) return;
    this.insetTop = top; this.insetBottom = bottom; this.onResize();
  }
  /** playable rectangle below the HUD */
  get area() { return { x: 0, y: this.insetTop, w: this.W, h: Math.max(100, this.H - this.insetTop - this.insetBottom) }; }
  settings: Settings;
  protected ev: EngineEvents;
  /** game time (seconds, paused-aware) */
  t = 0;
  diff: Difficulty = "easy";
  level = 1;
  score = 0;
  combo = 0;
  best = 0;
  lives = 3;
  attempt = 0;
  rng = new Rng(1);
  hud: HudState;
  protected salt = Math.floor(Math.random() * 1e9);
  protected ending = false;
  protected locked = false;
  particles: Particle[] = [];
  private floaters: Floater[] = [];
  private timers: Timer[] = [];
  private tweens: Tween[] = [];
  private shakeT = 0; private shakeA = 0;
  private flashA = 0; private flashC = "#ffffff";
  private trans: { kind: string; t0: number; dur: number; mid: () => void; called: boolean; label: number } | null = null;
  private images = new Map<string, HTMLImageElement>();
  private raf = 0; private last = 0; private running = false; private paused = false; private destroyed = false;
  private ro?: ResizeObserver;
  private hostId = 0; private bannerId = 0;
  private fpsN = 0; private fpsT = 0;

  constructor(canvas: HTMLCanvasElement, settings: Settings, ev: EngineEvents) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d", { alpha: false })!;
    this.settings = settings;
    this.ev = ev;
    this.hud = {
      status: "loading", difficulty: "easy", level: 1, score: 0, combo: 0, mult: 1, best: 0, lives: null, timer: null,
      timerColor: "#FFD25A", hint: null, banner: null, host: { id: 0, mood: "happy", line: null }, result: null,
    };
  }

  // ------------------------------------------------------------ to implement
  /** build a brand-new level from this.rng / this.level / this.diff */
  protected abstract setupLevel(): void;
  protected abstract update(dt: number): void;
  protected abstract draw(g: G): void;
  /** scene behind the lobby (defaults to the game draw with no level) */
  protected drawBackground(g: G) { g.fillStyle = "#2a2030"; g.fillRect(0, 0, this.W, this.H); }
  protected onDown(_x: number, _y: number) {}
  protected onMove(_x: number, _y: number) {}
  protected onUp(_x: number, _y: number) {}
  onKey(_key: string) {}
  protected onResize() {}
  /** extra assets to wait for */
  protected async preload(): Promise<void> {}

  // ------------------------------------------------------------ lifecycle
  async init() {
    const urls = new Set<string>([...(this.meta.sprites ?? [])]);
    for (const m of ["happy", "wow", "sad"] as Mood[]) urls.add(spriteUrl(this.meta.host, m));
    let n = 0;
    const total = urls.size + 2;
    const step = () => this.ev.onProgress?.(++n / total);
    await Promise.all([...urls].map((u) => this.loadImage(u).then(step)));
    await audio.preload(
      [...this.meta.sounds, "a:ding", "a:bwomp", "a:levelup", "a:perfect", "a:fail", "a:whooshIn", "a:whooshOut", "a:coin", "pop",
        `v:${this.meta.host}_happy`, `v:${this.meta.host}_wow`, `v:${this.meta.host}_sad`] as Sound[],
      [this.meta.music.calm, this.meta.music.action],
    ).then(step);
    await this.preload();
    if (document.fonts) await document.fonts.load(`40px "Lilita One"`).catch(() => {});
    step();
    if (this.destroyed) return;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement ?? this.canvas);
    this.bindInput();
    this.setHud({ status: "lobby" });
    void audio.playMusic(this.meta.music.calm);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  start(diff: Difficulty, level: number, best: number) {
    this.diff = diff; this.level = Math.max(1, level); this.best = best;
    this.score = 0; this.combo = 0; this.attempt = 0;
    this.lives = this.meta.style === "run" ? 3 : 0;
    this.salt = Math.floor(Math.random() * 1e9);
    this.particles = []; this.floaters = [];
    this.setHud({
      status: "playing", difficulty: diff, level: this.level, score: 0, combo: 0, mult: 1, best,
      lives: this.meta.style === "run" ? 3 : null, result: null, banner: null, timer: null, hint: null,
    });
    audio.ensure(); void audio.resume();
    this.nextLabel = this.level;
    this.transition(this.meta.transition ?? "iris", () => this.beginLevel(), 0.7);
  }

  toLobby() {
    this.timers = []; this.trans = null; this.ending = false;
    this.setHud({ status: "lobby", banner: null, timer: null, hint: null, result: null });
    void audio.playMusic(this.meta.music.calm);
  }

  pause() { if (this.paused) return; this.paused = true; void audio.suspend(); }
  resume() { if (!this.paused) return; this.paused = false; this.last = performance.now(); void audio.resume(); }
  updateSettings(s: Settings) { this.settings = s; this.resize(); }

  destroy() {
    this.destroyed = true; this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.unbind?.();
    audio.stopMusic(0.2);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  // ------------------------------------------------------------ level flow
  protected beginLevel() {
    this.ending = false; this.locked = false;
    this.timers = this.timers.filter((t) => !t.level);
    this.rng = new Rng(hash(this.meta.slug, this.diff, this.level, this.attempt, this.salt));
    this.setHud({ level: this.level, timer: null, hint: null });
    this.banner(`LEVEL ${this.level}`, this.attempt ? "Try again!" : undefined, "gold");
    if (this.attempt === 0 && (this.level === 1 || this.level % 5 === 0)) audio.say(`Level ${this.level}!`, { pitch: this.meta.voicePitch ?? 1.3 });
    this.sfx("a:whooshIn", { gain: 0.5 });
    this.setupLevel();
  }

  /** level finished successfully → bonus, coins, next level */
  protected levelClear({ perfect = false, bonus = 0, title }: { perfect?: boolean; bonus?: number; title?: string } = {}) {
    if (this.ending) return;
    this.ending = true; this.locked = true;
    const clear = Math.round((40 + this.level * 12) * DIFF_MULT[this.diff]);
    const extra = (perfect ? Math.round((80 + this.level * 8) * DIFF_MULT[this.diff]) : 0) + bonus;
    this.addRaw(clear + extra);
    const coins = Math.min(80, Math.round((3 + this.level * 1.2) * DIFF_MULT[this.diff]));
    this.ev.onClear({ difficulty: this.diff, level: this.level, score: this.score, coins });
    this.banner(title ?? (perfect ? "PERFECT!" : this.rng.pick(CHEERS)), `+${clear + extra} · 🪙 ${coins}`, perfect ? "mint" : "gold");
    this.sfx(perfect ? "a:perfect" : "a:levelup", { gain: 0.8, reverb: 0.3 });
    this.react("happy", null, true);
    if (perfect) { this.confetti(); audio.say("Perfect!", { pitch: this.meta.voicePitch ?? 1.3 }); }
    this.vibrate([20, 40, 30]);
    this.after(1.5, () => { this.nextLabel = this.level + 1; this.transition(this.meta.transition ?? "iris", () => { this.level++; this.attempt = 0; this.beginLevel(); }); }, false);
  }

  /** level failed (rounds style) → same level again with a fresh layout */
  protected levelFail(reason = "Try again!") {
    if (this.ending) return;
    this.ending = true; this.locked = true;
    this.combo = 0; this.setHud({ combo: 0, mult: 1 });
    this.banner("OOPS!", reason, "pink");
    this.sfx("a:fail", { gain: 0.7 });
    this.react("sad", null, true);
    this.vibrate([60]);
    this.after(1.8, () => { this.nextLabel = this.level; this.transition(this.meta.transition ?? "iris", () => { this.attempt++; this.beginLevel(); }); }, false);
  }

  /** run style: raise difficulty without stopping play */
  protected levelUp() {
    this.level++;
    const coins = Math.min(40, Math.round((2 + this.level) * DIFF_MULT[this.diff]));
    this.ev.onClear({ difficulty: this.diff, level: this.level - 1, score: this.score, coins });
    this.setHud({ level: this.level });
    this.banner(`LEVEL ${this.level}`, "Faster!", "gold");
    this.sfx("a:levelup", { gain: 0.6 });
    this.react("wow", "Faster!");
  }

  protected runOver() {
    if (this.hud.status === "over") return;
    this.locked = true;
    const newBest = this.score > this.best;
    if (newBest) this.best = this.score;
    const coins = Math.min(200, Math.round(this.score / 40));
    this.ev.onRunOver({ difficulty: this.diff, level: this.level, score: this.score, coins });
    this.setHud({ status: "over", timer: null, result: { score: this.score, level: this.level, best: this.best, newBest, coins }, best: this.best });
    this.sfx("a:fail", { gain: 0.7 });
    this.react("sad", newBest ? "New best!" : "Again?", true);
    void audio.playMusic(this.meta.music.calm);
  }

  // ------------------------------------------------------------ scoring
  get mult() { return 1 + Math.min(4, Math.floor(this.combo / 2)); }

  /** a correct action: combo up, points × combo (+ speed bonus 0..1), juicy feedback */
  protected good(x: number, y: number, base = 100, speed = 0) {
    this.combo++;
    const pts = Math.round(base * (1 + clamp(speed, 0, 1)) * this.mult);
    this.score += pts;
    if (this.score > this.best) this.best = this.score;
    this.float(`+${pts}`, x, y, this.mult > 1 ? "#7CF2C9" : "#FFD25A");
    if (this.mult > 1 && this.combo % 2 === 0) this.float(`×${this.mult}`, x + 40, y - 30, "#FF8A3D", 26);
    this.sfx("a:ding", { x, gain: 0.55, rate: 1 + Math.min(this.combo, 12) * 0.04 });
    this.burst(x, y, { n: 14, colors: ["#FFD25A", "#FF8A3D", "#7CF2C9", "#FFFFFF"], kind: "star", speed: 260 });
    this.setHud({ score: this.score, combo: this.combo, mult: this.mult, best: Math.max(this.best, this.hud.best) });
    if (this.combo > 0 && this.combo % 4 === 0) this.react("happy", this.rng.pick(["Yes!!", "On fire!", "Too good!", "Combo!"]));
    this.vibrate([12]);
    return pts;
  }

  /** a wrong action: combo reset, shake, funny sound; run style loses a heart */
  protected bad(x: number, y: number, { loseLife = this.meta.style === "run", line }: { loseLife?: boolean; line?: string } = {}) {
    this.combo = 0;
    this.shake(10, 0.35);
    this.flash("#ff3b5c", 0.18);
    this.sfx("a:bwomp", { x, gain: 0.7 });
    this.burst(x, y, { n: 10, colors: ["#FF6F91", "#E8504F"], kind: "dot", speed: 180 });
    this.react("sad", line ?? null);
    this.vibrate([50]);
    if (loseLife && this.meta.style === "run") {
      this.lives--;
      this.setHud({ lives: this.lives, combo: 0, mult: 1 });
      if (this.lives <= 0) this.after(0.6, () => this.runOver(), false);
    } else this.setHud({ combo: 0, mult: 1 });
  }

  protected addRaw(pts: number) { this.score += pts; if (this.score > this.best) this.best = this.score; this.setHud({ score: this.score, best: this.best }); }

  // ------------------------------------------------------------ feedback helpers
  protected setHud(p: Partial<HudState>) { this.hud = { ...this.hud, ...p }; this.ev.onHud(this.hud); }
  protected banner(title: string, sub?: string, tone: Tone = "gold") { this.setHud({ banner: { id: ++this.bannerId, title, sub, tone } }); }
  protected hint(text: string | null) { this.setHud({ hint: text }); }
  protected timerBar(v: number | null, color = "#FFD25A") { if (v !== this.hud.timer || color !== this.hud.timerColor) this.setHud({ timer: v == null ? null : clamp(v, 0, 1), timerColor: color }); }

  /** host character reacts: pose + speech bubble + funny voice */
  protected react(mood: Mood, line: string | null, voice = true) {
    this.setHud({ host: { id: ++this.hostId, mood, line } });
    if (voice) this.sfx(`v:${this.meta.host}_${mood}` as Sound, { gain: 0.75, duck: false });
  }
  protected say(text: string) { audio.say(text, { pitch: this.meta.voicePitch ?? 1.3 }); }

  protected sfx(name: Sound, o: { x?: number; gain?: number; rate?: number; delay?: number; duck?: boolean; reverb?: number } = {}) {
    const pan = o.x != null ? clamp((o.x / this.W) * 2 - 1, -1, 1) * 0.8 : 0;
    audio.play(name, { gain: o.gain, rate: o.rate, delay: o.delay, duck: o.duck, pan, reverb: o.reverb });
  }
  protected music(which: "calm" | "action") { void audio.playMusic(this.meta.music[which]); }
  /** musical tone panned to x (pentatonic note index helpers below) */
  protected tone(freq: number, dur = 0.35, x?: number, gain = 0.55) {
    audio.tone(freq, dur, { gain, pan: x != null ? clamp((x / this.W) * 2 - 1, -1, 1) * 0.7 : 0 });
  }
  /** C-major pentatonic, so any sequence sounds musical */
  protected note(i: number) { const P = [0, 2, 4, 7, 9]; const oct = Math.floor(i / 5); return 261.63 * Math.pow(2, (P[((i % 5) + 5) % 5] + 12 * oct) / 12); }

  protected vibrate(p: number[]) { if (this.settings.haptics && typeof navigator.vibrate === "function") navigator.vibrate(p); }
  protected shake(a: number, d: number) { if (this.settings.reducedMotion || !this.settings.cameraShake) return; this.shakeA = a; this.shakeT = d; }
  protected flash(c: string, a: number) { this.flashC = c; this.flashA = a; }
  protected float(text: string, x: number, y: number, color = "#FFD25A", size = 30) { this.floaters.push({ text, x, y, life: 1, color, size }); }

  protected burst(x: number, y: number, { n = 12, colors = ["#FFD25A"], kind = "dot" as Particle["kind"], speed = 200, gravity = 500, size = 7, life = 0.9 } = {}) {
    const k = this.settings.reducedMotion ? 0.4 : 1;
    for (let i = 0; i < Math.round(n * k); i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: life * (0.7 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, g: gravity });
    }
  }
  protected confetti() {
    const cols = ["#FFD25A", "#FF6F91", "#2EC4B6", "#9B5DE5", "#FF8A3D", "#74C94E", "#FFFFFF"];
    for (let i = 0; i < (this.settings.reducedMotion ? 30 : 90); i++)
      this.particles.push({ x: Math.random() * this.W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160, life: 3, max: 3, size: 6 + Math.random() * 6, color: cols[i % cols.length], kind: "conf", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, g: 60 });
  }

  // ------------------------------------------------------------ time helpers
  /** run fn after `sec` of game time. level=true timers are cancelled when a new level starts */
  protected after(sec: number, fn: () => void, level = true) { this.timers.push({ at: this.t + sec, fn, level }); }
  protected tween<T extends object>(o: T, to: Partial<Record<keyof T, number>>, dur: number, e: (u: number) => number = ease.out, delay = 0) {
    return new Promise<void>((done) => {
      const from: Record<string, number> = {};
      const rec = o as unknown as Record<string, number>;
      for (const k in to) from[k] = rec[k];
      this.tweens.push({ o: rec, from, to: to as Record<string, number>, t0: this.t + delay, dur, ease: e, done });
    });
  }
  /** close → run mid() → open */
  private nextLabel = 1;
  protected transition(kind: string, mid: () => void, dur = 0.9, label = true) {
    this.trans = { kind, t0: this.t, dur, mid, called: false, label: label ? this.nextLabel : 0 };
    this.sfx("a:whooshOut", { gain: 0.45 });
  }
  get inTransition() { return !!this.trans; }

  // ------------------------------------------------------------ images
  loadImage(url: string) {
    if (this.images.has(url)) return Promise.resolve(this.images.get(url)!);
    return new Promise<HTMLImageElement>((res) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => res(im); im.onerror = () => res(im);
      im.src = url;
      this.images.set(url, im);
    });
  }
  img(url: string) { return this.images.get(url); }
  /** draw an image anchored bottom-centre at (x, y) with height h */
  protected sprite(g: G, url: string, x: number, y: number, h: number, { flip = false, rot = 0, sx = 1, sy = 1, alpha = 1 } = {}) {
    const im = this.images.get(url);
    if (!im || !im.naturalWidth) return;
    const w = (h * im.naturalWidth) / im.naturalHeight;
    g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(rot); g.scale((flip ? -1 : 1) * sx, sy);
    g.drawImage(im, -w / 2, -h, w, h);
    g.restore();
  }
  protected host(mood: Mood) { return spriteUrl(this.meta.host, mood); }

  // ------------------------------------------------------------ engine internals
  private resize() {
    const el = this.canvas.parentElement ?? this.canvas;
    const W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.settings.quality === "low" ? 1.25 : 2) * this.settings.renderScale;
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`; this.canvas.style.height = `${H}px`;
    this.onResize();
  }

  private unbind?: () => void;
  private bindInput() {
    const c = this.canvas;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const ok = () => !this.paused && this.hud.status === "playing" && !this.trans && !this.locked;
    const down = (e: PointerEvent) => { if (!ok()) return; const [x, y] = pos(e); this.onDown(x, y); };
    const move = (e: PointerEvent) => { if (!ok()) return; const [x, y] = pos(e); this.onMove(x, y); };
    const up = (e: PointerEvent) => { if (!ok()) return; const [x, y] = pos(e); this.onUp(x, y); };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    this.unbind = () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); };
  }
  /** keyboard input forwarded by the host; ignored while locked */
  key(k: string) { if (!this.paused && this.hud.status === "playing" && !this.trans && !this.locked) this.onKey(k); }

  private loop = (now: number) => {
    if (!this.running || this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const cap = this.settings.fpsCap;
    const el = now - this.last;
    if (cap && el < 1000 / cap - 2) return;
    this.last = now;
    this.fpsN++; this.fpsT += el;
    if (this.fpsT > 1000) { this.ev.onFps?.((this.fpsN * 1000) / this.fpsT); this.fpsN = 0; this.fpsT = 0; }
    if (this.paused) return;
    const dt = Math.min(0.05, el / 1000);
    this.step(dt);
    this.render();
  };

  private step(dt: number) {
    this.t += dt;
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= this.t);
      if (due.length) { this.timers = this.timers.filter((x) => x.at > this.t); for (const d of due) d.fn(); }
    }
    // tweens
    for (const tw of this.tweens) {
      if (this.t < tw.t0) continue;
      const u = clamp((this.t - tw.t0) / tw.dur, 0, 1), e = tw.ease(u);
      for (const k in tw.to) tw.o[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (u >= 1) { tw.done?.(); tw.dur = -1; }
    }
    this.tweens = this.tweens.filter((t) => t.dur >= 0);
    // particles / floaters
    for (const p of this.particles) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; if (p.kind === "conf") p.vx *= 0.99; }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < this.H + 60);
    for (const f of this.floaters) { f.life -= dt * 0.9; f.y -= 60 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.5);
    // transition midpoint
    if (this.trans && !this.trans.called && this.t - this.trans.t0 >= this.trans.dur / 2) { this.trans.called = true; this.trans.mid(); this.sfx("a:whooshIn", { gain: 0.35 }); }
    if (this.trans && this.t - this.trans.t0 >= this.trans.dur) this.trans = null;
    if (this.hud.status === "playing" || this.hud.status === "over") this.update(dt);
  }

  private render() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.save();
    if (this.shakeT > 0) { const a = this.shakeA * (this.shakeT / 0.35); g.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    if (this.hud.status === "lobby" || this.hud.status === "loading") this.drawBackground(g);
    else this.draw(g);
    this.drawParticles(g);
    for (const f of this.floaters) {
      g.save(); g.globalAlpha = Math.min(1, f.life * 1.6);
      clayText(g, f.text, f.x, f.y, f.size * (1 + (1 - f.life) * 0.15), { fill: f.color });
      g.restore();
    }
    g.restore();
    if (this.flashA > 0) { g.fillStyle = rgba(this.flashC, this.flashA); g.fillRect(0, 0, this.W, this.H); }
    if (this.trans) this.drawTransition(g);
  }

  private drawParticles(g: G) {
    for (const p of this.particles) {
      const a = Math.min(1, p.life / (p.max * 0.4));
      g.save(); g.globalAlpha = a; g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.kind === "star") star(g, 0, 0, p.size, p.color);
      else if (p.kind === "conf") { g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      else if (p.kind === "bubble") { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.stroke(); g.fillStyle = "rgba(255,255,255,0.25)"; g.fill(); }
      else if (p.kind === "ring") { g.strokeStyle = p.color; g.lineWidth = 3 * a; g.beginPath(); g.arc(0, 0, p.size * (1 + (1 - a) * 3), 0, Math.PI * 2); g.stroke(); }
      else if (p.kind === "drop") { g.fillStyle = p.color; g.beginPath(); g.ellipse(0, 0, p.size * 0.7, p.size, 0, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }

  private drawTransition(g: G) {
    const tr = this.trans!;
    const u = clamp((this.t - tr.t0) / tr.dur, 0, 1);
    const k = u < 0.5 ? ease.in(u * 2) : 1 - ease.out((u - 0.5) * 2); // 0 → 1 → 0 coverage
    const W = this.W, H = this.H;
    g.save();
    if (tr.kind === "blink") {
      const h = (H / 2) * k;
      g.fillStyle = "#3a2312";
      g.beginPath(); g.ellipse(W / 2, h - H * 0.6, W * 0.9, H * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(W / 2, H - h + H * 0.6, W * 0.9, H * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#D49452";
      g.fillRect(0, 0, W, Math.max(0, h - H * 0.05)); g.fillRect(0, H - Math.max(0, h - H * 0.05), W, H);
    } else if (tr.kind === "curtain") {
      const w = (W / 2) * k;
      for (const s of [0, 1]) {
        const x0 = s ? W - w : 0;
        const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
        gr.addColorStop(0, "#B8333A"); gr.addColorStop(0.5, "#E8504F"); gr.addColorStop(1, "#B8333A");
        g.fillStyle = gr; g.fillRect(x0, 0, w, H);
        g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 6;
        for (let x = x0 + 20; x < x0 + w; x += 38) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, H); g.stroke(); }
      }
    } else {
      const R = Math.hypot(W, H) * 0.6 * (1 - k);
      g.fillStyle = "#160c33";
      g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, Math.max(0, R), 0, Math.PI * 2, true); g.fill("evenodd");
    }
    if (k > 0.85 && tr.label) {
      const im = this.images.get(this.host("happy"));
      if (im?.naturalWidth) this.sprite(g, this.host("happy"), W / 2, H / 2 + 60, Math.min(160, H * 0.25), { sy: 1 + Math.sin(this.t * 14) * 0.04 });
      clayText(g, `LEVEL ${tr.label}`, W / 2, H / 2 + 100, Math.min(56, W * 0.11));
    }
    g.restore();
  }
}
