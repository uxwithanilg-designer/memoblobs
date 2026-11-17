// Who Said It? — Gloop's little theatre. Cast members pop up from their velvet seats one at a time and
// make their silly voice; tap them back in the same order. Unlimited levels: longer shows, bigger casts,
// quicker pops, SEAT SHUFFLE (actors hop to new seats) and, on hard, EARS ONLY rounds behind the curtain.
import type { Sound } from "@/lib/audio";
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, spriteUrl, type CastId, type GameMeta, type Mood } from "../engine";
import { FONT, blob, clayFill, clayPanel, clayText, lighten, rr, shadow, star, sunburst, type G } from "../paint";

type Voice = "happy" | "wow" | "laugh";
type Phase = "intro" | "roll" | "show" | "shuffle" | "input" | "oops" | "done";
const CAST: CastId[] = ["pip", "hoot", "noodle", "zib", "tiki", "bolt", "bonbon", "momo", "kranky", "turbo"];
/** voices we know are on disk and very different from each other — used for EARS ONLY rounds */
const EARS_CAST: CastId[] = ["pip", "hoot", "noodle", "zib", "tiki", "bolt", "bonbon", "momo", "kranky", "turbo"];
const NAME: Record<string, string> = { pip: "PIP", hoot: "HOOT", noodle: "NOODLE", zib: "ZIB", tiki: "TIKI", bolt: "BOLT", bonbon: "BONBON", momo: "MOMO", kranky: "KRANKY", turbo: "TURBO" };
const WORDS: Record<string, string[]> = {
  pip: ["Peep!", "Pip pip!"], hoot: ["Hoo-hoo!", "Hoot!"], noodle: ["Sssss!", "Hiss!"], zib: ["Zib zib!", "Bleep!"],
  tiki: ["Tiki!", "Ooga!"], bolt: ["Beep!", "Boop!"], bonbon: ["Hee hee!", "Yum!"], momo: ["Momo!", "Yay!"],
  kranky: ["Hmph!", "Grr!"], turbo: ["Vroom!", "Zoom!"],
};
const VOICES = CAST.flatMap((id) => (["happy", "wow", "laugh", "sad"] as const).map((m) => `v:${id}_${m}` as Sound));
const SPRITES = [...new Set(CAST.flatMap((id) => (["happy", "wow", "sad"] as Mood[]).map((m) => spriteUrl(id, m))))];

interface Seat { x: number; y: number; w: number; h: number; row: number }
interface Actor {
  id: CastId; voice: Voice; word: string; seat: number; from: number; mv: number;
  popAt: number; popDur: number; enter: number; sad: number; mark: number; markN: number; glow: number; ph: number;
}

export default class WhoSaidIt extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "who-said-it", title: "Who Said It?", host: "gloop", style: "rounds",
    music: { calm: "a:voices_calm", action: "a:voices_action" },
    sounds: [...VOICES, "a:curtain", "a:applause", "a:cheer", "a:kazoo", "a:bonk", "a:tink", "a:click", "a:squeak", "a:ooh", "hop", "pop"],
    sprites: SPRITES, voicePitch: 1.1, transition: "curtain",
  };
  private actors: Actor[] = [];
  private seats: Seat[] = [];
  private rows: number[] = [2, 2];
  private seq: number[] = [];
  private idx = 0; private shown = 0;
  private phase: Phase = "intro";
  private stepT = 1.2;
  private ears = false; private shuffles = 0; private shuffled = false;
  private replayLeft = 0; private replayUsed = false; private mistakes = 0;
  private lastTap = 0;
  private drape = { c: 0 };
  private dim = { v: 0 };
  private wave = 0; private cheer = 0;
  private castBag = new Bag<CastId>(CAST);
  private earsBag = new Bag<CastId>(EARS_CAST);
  private recent = new Recent(24);
  private stageR = { x: 0, y: 0, w: 100, h: 100 };
  private pit = { y: 0, h: 0 };
  private gl = { x: 0, y: 0, h: 120, bop: 0 };
  private sign = { x: 0, y: 0, w: 160, h: 52 };
  private rBtn = { x: 0, y: 0, w: 96, h: 56, press: 0 };
  private bg?: HTMLCanvasElement; private bgKey = "";

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H * 1.05;
    const gim = this.img(this.host("happy")), gasp = gim && gim.naturalWidth ? gim.naturalWidth / gim.naturalHeight : 1.7;
    if (portrait) {
      const pitH = clamp(A.h * 0.19, 96, 150);
      this.stageR = { x: 8, y: A.y + 2, w: W - 16, h: A.h - pitH };
      this.pit = { y: A.y + A.h - pitH, h: pitH };
      const gh = Math.min(clamp(pitH * 0.95, 84, 130), (W * 0.42) / gasp);
      this.gl = { ...this.gl, x: gh * gasp * 0.4, y: A.y + A.h + 4, h: gh };
      this.rBtn = { ...this.rBtn, w: 96, h: 58, x: W - 106, y: this.pit.y + (pitH - 58) / 2 + 6 };
      const l = this.gl.x + gh * gasp * 0.47, r = this.diff === "easy" ? this.rBtn.x - 8 : W - 12;
      const sw = Math.min(250, r - l);
      this.sign = { w: sw, h: 56, x: (l + r) / 2 - sw / 2, y: this.pit.y + (pitH - 56) / 2 + 6 };
    } else {
      const side = clamp(W * 0.17, 140, 260), pitH = clamp(A.h * 0.13, 66, 92);
      this.stageR = { x: side, y: A.y + 2, w: W - side * 2, h: A.h - pitH };
      this.pit = { y: A.y + A.h - pitH, h: pitH };
      const gh = Math.min(clamp(A.h * 0.42, 110, 240), (side * 1.15) / gasp);
      this.gl = { ...this.gl, x: side / 2, y: A.y + A.h + 2, h: gh };
      this.rBtn = { ...this.rBtn, w: 112, h: 62, x: W - side / 2 - 56, y: A.y + A.h - 86 };
      const sw = Math.min(320, this.stageR.w * 0.5);
      this.sign = { w: sw, h: 56, x: W / 2 - sw / 2, y: this.pit.y + (pitH - 56) / 2 + 4 };
    }
    this.layoutSeats();
  }

  private layoutSeats() {
    const n = this.actors.length || 4, S = this.stageR, portrait = this.W < this.H * 1.05;
    this.rows = portrait ? (n <= 2 ? [n] : n === 3 ? [1, 2] : n === 4 ? [2, 2] : n === 5 ? [1, 2, 2] : [2, 2, 2])
      : (n <= 4 ? [n] : n === 5 ? [2, 3] : [3, 3]);
    const ix = S.x + S.w * 0.1, iw = S.w * 0.8;
    const top = S.y + S.h * 0.15, bot = S.y + S.h * 0.9;
    const R = this.rows.length, rowH = (bot - top) / R, sw = iw / Math.max(...this.rows);
    const hFront = Math.min(sw * 0.95, rowH * (R > 1 ? 0.88 : 0.7), 240);
    const scales = R === 3 ? [0.82, 0.91, 1] : R === 2 ? [0.88, 1] : [1];
    this.seats = [];
    this.rows.forEach((cnt, r) => {
      const sc = scales[r], base = bot - (R - 1 - r) * rowH;
      for (let i = 0; i < cnt; i++) this.seats.push({ x: ix + iw / 2 + (i - (cnt - 1) / 2) * sw, y: base, w: sw * sc, h: hFront * sc, row: r });
    });
  }

  private inner() { const S = this.stageR; return { x: S.x + 12, y: S.y + 10, w: S.w - 24, h: S.h - 16 }; }

  // ------------------------------------------------------------ levels
  private castSize(L: number) {
    return byDiff(this.diff, { easy: L <= 2 ? 3 : L <= 6 ? 4 : L <= 11 ? 5 : 6, medium: L <= 3 ? 4 : L <= 8 ? 5 : 6, hard: L <= 2 ? 4 : L <= 5 ? 5 : 6 });
  }
  private seqLen(L: number) {
    return byDiff(this.diff, { easy: Math.min(8, 2 + Math.floor((L - 1) / 2)), medium: Math.min(9, 3 + Math.floor((L - 1) / 2)), hard: Math.min(11, 4 + Math.floor((L - 1) * 0.6)) });
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const canHear = this.settings.charVoices && !this.settings.muted;
    this.ears = canHear && byDiff(d, { easy: false, medium: L >= 15 && L % 5 === 0, hard: L >= 4 && L % 3 === 1 });
    const n = this.ears ? Math.min(5, this.castSize(L)) : this.castSize(L);
    const len = this.ears ? clamp(this.seqLen(L) - 2, 3, 7) : this.seqLen(L);
    this.shuffles = this.ears ? 0 : byDiff(d, {
      easy: L >= 5 && (L % 3 === 2 || (L >= 12 && L % 2 === 0)) ? 1 : 0,
      medium: L >= 3 && L % 2 === 1 ? (L >= 12 && L % 4 === 1 ? 2 : 1) : 0,
      hard: L >= 2 && L % 3 !== 1 ? (L >= 9 && L % 3 === 0 ? 2 : 1) : 0,
    });
    this.stepT = byDiff(d, { easy: ramp(L, 1.3, -0.03, 0.85), medium: ramp(L, 1.15, -0.03, 0.72), hard: ramp(L, 1.05, -0.03, 0.62) });
    if (this.ears) this.stepT = Math.max(1.2, this.stepT + 0.25);
    const loaded = (id: CastId) => (this.img(spriteUrl(id, "happy"))?.naturalWidth ?? 0) > 0;
    const pool = (this.ears ? EARS_CAST : CAST).filter(loaded);
    const bag = this.ears ? this.earsBag : this.castBag;
    let ids: CastId[] = [], seq: number[] = [];
    for (let tries = 0; tries < 25; tries++) {
      ids = [];
      for (let guard = 0; ids.length < Math.min(n, pool.length) && guard < 80; guard++) {
        const id = bag.next(this.rng);
        if (pool.includes(id) && !ids.includes(id)) ids.push(id);
      }
      seq = this.makeSeq(len, ids.length, L);
      const sig = [...ids].sort().join(",") + "|" + seq.map((k) => ids[k]).join(",");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    this.actors = ids.map((id, i) => ({
      id, voice: this.rng.pick(["happy", "wow", "laugh"] as Voice[]), word: this.rng.pick(WORDS[id]), seat: i, from: i, mv: 0,
      popAt: -9, popDur: 1, enter: 0, sad: 0, mark: 0, markN: 0, glow: 0, ph: this.rng.range(0, 6),
    }));
    this.seq = seq; this.idx = 0; this.shown = 0; this.mistakes = 0; this.shuffled = false;
    this.replayLeft = d === "easy" ? 1 : 0; this.replayUsed = false;
    this.drape.c = 0; this.dim.v = 0; this.wave = 0; this.cheer = 0;
    this.layout();
    this.phase = "intro";
    // the cast hops into their seats
    this.actors.forEach((a, i) => {
      this.tween(a, { enter: 1 }, 0.6, ease.back, 0.2 + i * 0.13);
      this.sfx("hop", { x: this.seats[i].x, gain: 0.4, rate: 0.85 + i * 0.08, delay: 0.45 + i * 0.13 });
    });
    let wait = 1.7 + this.actors.length * 0.13;
    const grew = L > 1 && this.castSize(L) > this.castSize(L - 1) && this.attempt === 0 && !this.ears;
    if (this.ears) {
      this.after(0.5, () => { this.banner("EARS ONLY!", "The curtain hides them — listen!", "pink"); this.react("wow", "Shh! Use your ears!"); });
      wait += 0.9;
    } else if (grew) {
      this.after(0.5, () => { this.banner("NEW ACTOR!", "A bigger cast on stage", "mint"); this.react("wow", "More friends on stage!"); });
      wait += 0.6;
    } else this.react("happy", this.rng.pick(["Quiet please! Showtime!", "Lights… camera… LISTEN!", "Who will speak first?", "Ears on, everyone!", "The show begins!"]));
    this.music(len >= 7 || this.ears || this.shuffles > 1 ? "action" : "calm");
    this.hint(this.ears ? "Ears only! Learn their voices 👂" : this.shuffles ? "Remember WHO speaks — not where! 🎭" : "Watch & listen to the show! 🎭");
    this.after(wait, () => (this.ears ? this.rollCall() : this.playShow()));
  }

  /** a fresh show order: never the same actor twice in a row; early levels use everyone once */
  private makeSeq(len: number, n: number, L: number) {
    const seq: number[] = [];
    const distinct = len <= n && L <= 4;
    while (seq.length < len) {
      const k = this.rng.int(0, n - 1);
      if (seq.length && seq[seq.length - 1] === k) continue;
      if (distinct && seq.includes(k)) continue;
      seq.push(k);
    }
    return seq;
  }

  private rollCall() {
    this.phase = "roll";
    this.hint("Roll call! Learn each voice 👂");
    const st = 1.0;
    const order = this.actors.map((_, i) => i).sort((a, b) => this.actors[a].seat - this.actors[b].seat);
    order.forEach((k, i) => this.after(i * st, () => this.pop(k, st * 0.9)));
    this.after(order.length * st + 0.35, () => {
      this.sfx("a:curtain", { gain: 0.75 });
      this.tween(this.drape, { c: 1 }, 0.85, ease.inOut);
      this.hint("Listen… who is talking? 👂");
      this.after(1.35, () => this.playShow());
    });
  }

  private playShow() {
    this.phase = "show"; this.idx = 0; this.shown = 0;
    for (const a of this.actors) { a.mark = 0; a.glow = 0; }
    if (!this.ears) { this.hint(`Watch & listen! 👀👂 · ${this.seq.length} voices`); this.tween(this.dim, { v: 1 }, 0.4); }
    this.sfx("a:tink", { gain: 0.4 });
    const st = this.stepT;
    this.seq.forEach((k, i) => this.after(0.5 + i * st, () => { this.pop(k, st * 0.88); this.shown = i + 1; }));
    this.after(0.5 + this.seq.length * st + 0.15, () => this.afterShow());
  }

  private pop(k: number, dur: number, voice = true) {
    const a = this.actors[k];
    if (!a) return;
    a.popAt = this.t; a.popDur = dur;
    const p = this.pos(a);
    if (voice) this.sfx(`v:${a.id}_${a.voice}` as Sound, { x: p.x, gain: 0.9, duck: false });
    this.sfx("pop", { x: p.x, gain: 0.25, rate: 1.2 });
    this.gl.bop = 1; this.wave = 1;
    if (this.drape.c < 0.5) this.burst(p.x, p.y - p.h * 0.95, { n: 7, colors: ["#FFD25A", "#FF8FB1", "#FFFFFF"], kind: "star", speed: 140, gravity: 220, size: 5, life: 0.6 });
  }

  private afterShow() {
    this.tween(this.dim, { v: 0 }, 0.4);
    if (this.ears) {
      this.sfx("a:curtain", { gain: 0.75 });
      this.tween(this.drape, { c: 0 }, 0.85, ease.inOut);
      this.after(0.95, () => this.toInput());
    } else if (this.shuffles > 0 && !this.shuffled) {
      this.shuffled = true;
      this.doShuffle(this.shuffles, () => this.toInput());
    } else this.toInput();
  }

  private doShuffle(times: number, done: () => void) {
    this.phase = "shuffle";
    this.banner(times > 1 ? "DOUBLE SHUFFLE!" : "SEAT SHUFFLE!", "Everyone change seats!", "red");
    this.hint("Who's who now? 👀");
    this.react("wow", this.rng.pick(["Musical chairs!", "Hop hop hop!", "Swap seats!"]), false);
    this.sfx("a:kazoo", { gain: 0.55 });
    this.sfx("a:ooh", { gain: 0.45, delay: 0.2 });
    const n = this.actors.length;
    const once = (delay: number) => this.after(delay, () => {
      let perm = this.rng.shuffle([...Array(n).keys()]);
      for (let k = 0; k < 20 && perm.some((v, i) => v === i); k++) perm = this.rng.shuffle([...Array(n).keys()]);
      this.actors.forEach((a, i) => {
        a.from = a.seat; a.seat = perm[a.seat]; a.mv = 0.0001;
        this.tween(a, { mv: 1 }, 0.85, ease.linear, i * 0.06).then(() => { a.mv = 0; });
        this.sfx("hop", { x: this.seats[a.seat].x, delay: i * 0.06, rate: 0.85 + this.rng.next() * 0.5, gain: 0.45 });
      });
      this.sfx("a:squeak", { gain: 0.35, delay: 0.5 });
    });
    once(0.6);
    if (times > 1) once(1.7);
    this.after(0.6 + times * 1.1 + 0.25, done);
  }

  private toInput() {
    this.phase = "input"; this.idx = 0; this.lastTap = this.t;
    for (const a of this.actors) a.mark = 0;
    this.hint(`Your turn! Tap them in the same order 👆`);
    this.sfx("a:tink", { gain: 0.45, rate: 1.2 });
    if (this.level === 1 && this.attempt === 0) this.say("Who said it first?");
  }

  // ------------------------------------------------------------ input
  private canReplay() { return this.diff === "easy" && this.replayLeft > 0 && this.phase === "input"; }

  private useReplay() {
    this.replayLeft--; this.replayUsed = true;
    this.rBtn.press = 1; this.tween(this.rBtn, { press: 0 }, 0.3);
    this.sfx("a:click", { gain: 0.6 });
    this.react("happy", "Encore! Watch again!", false);
    this.after(0.3, () => this.playShow());
  }

  onKey(key: string) {
    if (key === "r" || key === "R") { if (this.canReplay()) this.useReplay(); return; }
    const k = Number(key) - 1;
    if (this.phase !== "input" || !(k >= 0 && k < this.actors.length)) return;
    const i = this.actors.findIndex((a) => a.seat === k);
    if (i >= 0) this.tap(i);
  }

  protected onDown(x: number, y: number) {
    const b = this.rBtn;
    if (this.canReplay() && x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) { this.useReplay(); return; }
    if (this.phase !== "input") return;
    let best = -1, bd = Infinity;
    this.actors.forEach((a, i) => {
      const p = this.pos(a);
      if (x >= p.x - p.w * 0.5 && x <= p.x + p.w * 0.5 && y >= p.y - p.h * 1.15 && y <= p.y + 10) {
        const dd = Math.abs(x - p.x) + Math.abs(y - (p.y - p.h * 0.5));
        if (dd < bd) { bd = dd; best = i; }
      }
    });
    if (best >= 0) this.tap(best);
  }

  private tap(k: number) {
    const a = this.actors[k], p = this.pos(a);
    if (k === this.seq[this.idx]) {
      this.idx++;
      this.pop(k, 0.7);
      a.mark = 0.0001; a.markN = this.idx; this.tween(a, { mark: 1 }, 0.35, ease.back);
      const speed = clamp(1 - (this.t - this.lastTap) / 3, 0, 1) * 0.6;
      this.lastTap = this.t;
      this.good(p.x, p.y - p.h * 0.95, 50, speed);
      if (this.idx >= this.seq.length) this.win();
      return;
    }
    this.mistakes++; this.phase = "oops";
    a.sad = 1;
    this.sfx("a:bonk", { x: p.x, gain: 0.6 });
    this.sfx(`v:${a.id}_sad` as Sound, { x: p.x, gain: 0.75, delay: 0.2, duck: false });
    this.bad(p.x, p.y - p.h * 0.6, { line: this.rng.pick(["Wrong actor!", "That's not who said it!", "Blub?! Nope!", "Oopsie, wrong seat!"]) });
    const right = this.actors[this.seq[this.idx]];
    this.after(0.6, () => { right.glow = 1; this.tween(right, { glow: 0 }, 0.8, ease.in, 1.5); });
    if (this.replayLeft > 0) {
      this.replayLeft--; this.replayUsed = true;
      this.after(1.8, () => { this.banner("WATCH AGAIN!", "One more look", "gold"); this.after(1.0, () => this.playShow()); });
    } else this.after(1.6, () => { this.levelFail(this.ears ? "Listen closely!" : "Wrong actor!"); });
  }

  private win() {
    this.phase = "done"; this.hint(null);
    this.after(0.45, () => {
      this.sfx("a:applause", { gain: 0.75 }); this.sfx("a:cheer", { gain: 0.5, delay: 0.15 });
      this.cheer = 1;
      this.actors.forEach((a, i) => this.after(i * 0.09, () => { a.popAt = this.t; a.popDur = 1.2; }));
      const S = this.stageR;
      for (let i = 0; i < 4; i++) this.burst(S.x + S.w * (0.2 + i * 0.2), S.y + S.h * 0.5, { n: 10, colors: ["#FF6F91", "#FFD25A", "#FFFFFF", "#E8504F"], kind: "conf", speed: 280, gravity: 520, size: 8, life: 1.2 });
      this.levelClear({ perfect: this.mistakes === 0 && !this.replayUsed, bonus: (this.ears ? 80 : 0) + this.shuffles * 30, title: this.mistakes === 0 ? "BRAVO!" : undefined });
      this.react("happy", this.rng.pick(["Bravo! Bravo!", "Encore!", "What a show!", "Standing ovation!", "Take a bow!"]), false);
    });
  }

  protected update(dt: number) {
    for (const a of this.actors) a.sad = Math.max(0, a.sad - dt * 0.8);
    this.gl.bop = Math.max(0, this.gl.bop - dt * 3);
    this.wave = Math.max(0, this.wave - dt * 1.4);
    this.cheer = Math.max(0, this.cheer - dt * 0.45);
  }

  // ------------------------------------------------------------ geometry
  private pos(a: Actor) {
    const s = this.seats[a.seat] ?? this.seats[0];
    if (a.mv > 0 && a.mv < 1) {
      const f = this.seats[a.from] ?? s, u = ease.inOut(a.mv);
      return { x: lerp(f.x, s.x, u), y: lerp(f.y, s.y, u) - Math.sin(Math.PI * u) * s.h * 0.75, h: lerp(f.h, s.h, u), w: lerp(f.w, s.w, u), hop: true };
    }
    return { x: s.x, y: s.y, h: s.h, w: s.w, hop: false };
  }

  /** sprite height that keeps wide characters (Noodle, Turbo, Kranky…) inside their seat */
  private fitH(id: CastId, h: number, maxW: number) {
    const im = this.img(spriteUrl(id, "happy"));
    const asp = im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1;
    return Math.min(h, maxW / asp);
  }

  private rise(a: Actor) {
    const u = (this.t - a.popAt) / a.popDur;
    if (u < 0 || u > 1) return 0;
    return u < 0.22 ? ease.back(u / 0.22) : u > 0.7 ? 1 - ease.inOut((u - 0.7) / 0.3) : 1;
  }

  // ------------------------------------------------------------ drawing
  private paintHall() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H, S = this.stageR, I = this.inner();
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#3C1752"); wall.addColorStop(1, "#1A0A2C");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,210,90,0.06)";
    for (let y = 18, r = 0; y < H; y += 34, r++) for (let x = (r % 2) * 22; x < W; x += 44) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.fill(); }
    // golden proscenium
    shadow(g, S.x + S.w / 2, S.y + S.h + 6, S.w * 0.52, 16, 0.45);
    rr(g, S.x - 4, S.y - 2, S.w + 8, S.h + 8, 30);
    clayFill(g, "#E8B53A", S.x + S.w / 2, S.y + S.h * 0.4, Math.max(S.w, S.h) * 0.62, { gloss: 0.25 });
    rr(g, S.x + 3, S.y + 3, S.w - 6, S.h - 2, 26); g.strokeStyle = "rgba(255,244,200,0.55)"; g.lineWidth = 2; g.stroke();
    // inner stage
    g.save();
    rr(g, I.x, I.y, I.w, I.h, 22); g.clip();
    const back = g.createLinearGradient(0, I.y, 0, I.y + I.h); back.addColorStop(0, "#5B2D8E"); back.addColorStop(0.6, "#3A1A6A"); back.addColorStop(1, "#2A1250");
    g.fillStyle = back; g.fillRect(I.x, I.y, I.w, I.h);
    const fy = I.y + I.h * 0.5;
    // painted backdrop: moon, stars, clouds, hills
    const mx = I.x + I.w * 0.76, my = I.y + I.h * 0.24, mr = Math.min(I.w, I.h) * 0.075;
    const glow = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3); glow.addColorStop(0, "rgba(255,241,184,0.35)"); glow.addColorStop(1, "rgba(255,241,184,0)");
    g.fillStyle = glow; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
    blob(g, mx, my, mr, mr, "#FFF1B8", { gloss: 0.5 });
    blob(g, mx + mr * 0.35, my - mr * 0.15, mr * 0.18, mr * 0.18, "#F2DD8E");
    for (let i = 0; i < 14; i++) star(g, I.x + ((i * 137.5) % I.w), I.y + I.h * 0.12 + ((i * 71.3) % (I.h * 0.3)), 3 + (i % 3) * 1.5, "#FFE38A", i);
    for (let i = 0; i < 4; i++) blob(g, I.x + I.w * (0.12 + i * 0.26), I.y + I.h * (0.2 + (i % 2) * 0.08), I.w * 0.07, I.h * 0.025, "#7B4FC0", { gloss: 0.2 });
    for (let i = 0; i < 5; i++) blob(g, I.x + I.w * (i * 0.25), fy + 4, I.w * 0.18, I.h * 0.09, i % 2 ? "#3E2275" : "#4A2A86", { gloss: 0.12 });
    // wooden floor with plank lines towards a vanishing point
    const floor = g.createLinearGradient(0, fy, 0, I.y + I.h); floor.addColorStop(0, "#A86A35"); floor.addColorStop(1, "#D9995A");
    g.fillStyle = floor; g.fillRect(I.x, fy, I.w, I.h);
    g.strokeStyle = "rgba(90,45,15,0.25)"; g.lineWidth = 2;
    const vx = I.x + I.w / 2;
    for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(vx + i * I.w * 0.06, fy); g.lineTo(vx + i * I.w * 0.16, I.y + I.h); g.stroke(); }
    for (let k = 1; k < 5; k++) { const y = fy + Math.pow(k / 5, 1.6) * (I.h - (fy - I.y)); g.beginPath(); g.moveTo(I.x, y); g.lineTo(I.x + I.w, y); g.stroke(); }
    g.fillStyle = "rgba(255,240,200,0.12)"; g.fillRect(I.x, fy, I.w, 3);
    // apron lip
    g.fillStyle = "#7A4520"; g.fillRect(I.x, I.y + I.h - 12, I.w, 12);
    g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(I.x, I.y + I.h - 12, I.w, 2);
    // side drapes, gathered with a golden rope
    const cw = I.w * 0.085;
    for (const s of [-1, 1]) {
      const ox = s < 0 ? I.x : I.x + I.w;
      g.beginPath(); g.moveTo(ox, I.y); g.lineTo(ox - s * cw * 1.3, I.y);
      g.quadraticCurveTo(ox - s * cw * 0.9, I.y + I.h * 0.4, ox - s * cw * 0.45, I.y + I.h * 0.56);
      g.quadraticCurveTo(ox - s * cw * 1.0, I.y + I.h * 0.75, ox - s * cw * 1.2, I.y + I.h); g.lineTo(ox, I.y + I.h); g.closePath();
      const dg = g.createLinearGradient(ox, 0, ox - s * cw * 1.3, 0); dg.addColorStop(0, "#8E1C2A"); dg.addColorStop(0.5, "#D23B4A"); dg.addColorStop(1, "#A32533");
      g.fillStyle = dg; g.fill();
      g.strokeStyle = "rgba(60,0,10,0.25)"; g.lineWidth = 3;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(ox - s * cw * 0.3 * k, I.y); g.quadraticCurveTo(ox - s * cw * 0.25 * k, I.y + I.h * 0.45, ox - s * cw * 0.12 * k, I.y + I.h * 0.56); g.stroke(); }
      blob(g, ox - s * cw * 0.5, I.y + I.h * 0.56, cw * 0.32, cw * 0.18, "#F2C14E", { gloss: 0.6 });
    }
    // valance
    const vh = I.h * 0.08, n = Math.max(6, Math.round(I.w / 60)), sw = I.w / n;
    g.beginPath(); g.moveTo(I.x, I.y);
    g.lineTo(I.x + I.w, I.y); g.lineTo(I.x + I.w, I.y + vh);
    for (let i = n - 1; i >= 0; i--) g.quadraticCurveTo(I.x + (i + 0.5) * sw, I.y + vh + sw * 0.35, I.x + i * sw, I.y + vh);
    g.closePath();
    const vg = g.createLinearGradient(0, I.y, 0, I.y + vh + 12); vg.addColorStop(0, "#9E2030"); vg.addColorStop(1, "#D9404F");
    g.fillStyle = vg; g.fill();
    g.strokeStyle = "#F2C14E"; g.lineWidth = 3; g.stroke();
    star(g, I.x + I.w / 2, I.y + vh * 0.55, Math.min(14, vh * 0.45), "#FFD25A");
    g.restore();
    // show posters on the side walls (landscape)
    if (S.x > 110) {
      const pw = Math.min(S.x * 0.66, 150), ph = pw * 1.32;
      [["TONIGHT!", "#E8504F"], ["ENCORE!", "#9B5DE5"]].forEach(([txt, col], i) => {
        const cx = i ? S.x + S.w + S.x / 2 : S.x / 2, y = S.y + S.h * 0.1;
        g.save(); g.translate(cx, y + ph / 2); g.rotate(i ? 0.05 : -0.05);
        shadow(g, 0, ph / 2 + 6, pw * 0.45, 8, 0.35);
        clayPanel(g, -pw / 2, -ph / 2, pw, ph, 12, "#FFF1D6", { lip: 6 });
        rr(g, -pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 22, 8); g.fillStyle = col; g.fill();
        g.save(); g.beginPath(); g.rect(-pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 22); g.clip(); sunburst(g, 0, -ph * 0.1, pw, col, lighten(col, 0.18), 18, this.level * 0.1); g.restore();
        star(g, 0, -ph * 0.1, pw * 0.22, "#FFD25A", 0.1);
        clayText(g, txt, 0, ph * 0.28, Math.min(24, pw * 0.17), { fill: "#FFF4E2" });
        blob(g, 0, -ph / 2 + 4, 6, 6, "#B8C4D6", { gloss: 0.6 });
        g.restore();
      });
    }
    this.bg = c;
  }

  private drawSeatBack(g: G, s: Seat, key: number) {
    const cw = s.w * 0.84, x = s.x, y = s.y, h = s.h;
    shadow(g, x, y + 3, cw * 0.55, 8, 0.35);
    rr(g, x - cw * 0.42, y - h * 0.82, cw * 0.84, h * 0.7, cw * 0.24);
    clayFill(g, "#C7303F", x, y - h * 0.5, cw * 0.6, { gloss: 0.22 });
    rr(g, x - cw * 0.36, y - h * 0.76, cw * 0.72, h * 0.58, cw * 0.2); g.strokeStyle = "rgba(242,193,78,0.85)"; g.lineWidth = Math.max(2, cw * 0.025); g.stroke();
    for (const dx of [-0.18, 0, 0.18]) { g.fillStyle = "rgba(90,10,25,0.4)"; g.beginPath(); g.arc(x + dx * cw, y - h * 0.62, Math.max(1.5, cw * 0.022), 0, Math.PI * 2); g.fill(); }
    if (this.W > 700 && this.hud.status === "playing") {
      const bx = x - cw * 0.36, by = y - h * 0.76;
      blob(g, bx, by, 11, 11, "#FFF4E2", { gloss: 0.4 });
      g.fillStyle = "#23305A"; g.font = `14px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(key + 1), bx, by + 1);
    }
  }

  private drawSeatFront(g: G, s: Seat, label: string) {
    const cw = s.w * 0.9, x = s.x, y = s.y, h = s.h;
    g.fillStyle = "#9A6B1F";
    for (const dx of [-0.3, 0.3]) { rr(g, x + dx * cw - 3, y - h * 0.1, 6, h * 0.1 + 2, 2); g.fill(); }
    rr(g, x - cw * 0.4, y - h * 0.28, cw * 0.8, h * 0.2, h * 0.07);
    clayFill(g, "#E04656", x, y - h * 0.18, cw * 0.45, { gloss: 0.3 });
    for (const sd of [-1, 1]) {
      const ax = x + sd * cw * 0.43;
      rr(g, ax - cw * 0.075, y - h * 0.42, cw * 0.15, h * 0.34, cw * 0.06);
      clayFill(g, "#A8232F", ax, y - h * 0.25, cw * 0.18, { gloss: 0.25 });
      blob(g, ax, y - h * 0.42, cw * 0.08, cw * 0.055, "#F2C14E", { gloss: 0.6 });
    }
    const fs = clamp(h * 0.1, 9, 15);
    g.font = `${fs}px ${FONT}`;
    const tw = g.measureText(label).width + 10;
    rr(g, x - tw / 2, y - h * 0.18 - fs * 0.62, tw, fs * 1.24, fs * 0.4);
    clayFill(g, "#F2C14E", x, y - h * 0.18, tw * 0.6, { gloss: 0.35, rim: false });
    g.fillStyle = "#6B3A08"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, x, y - h * 0.18 + 1);
  }

  private drawActor(g: G, a: Actor) {
    const p = this.pos(a), r = this.rise(a), up = r * p.h * 0.34;
    const drop = (1 - a.enter) * (p.y - this.stageR.y + p.h * 1.2);
    const u = (this.t - a.popAt) / a.popDur, live = u >= 0 && u <= 1;
    const sq = live ? Math.sin(Math.min(1, u * 3) * Math.PI * 2) * 0.09 * (1 - u) : 0;
    const mood: Mood = a.sad > 0.05 ? "sad" : r > 0.1 && a.voice === "wow" ? "wow" : "happy";
    const jx = a.sad > 0.05 ? Math.sin(this.t * 32) * 6 * a.sad : 0;
    const x = p.x + jx, y = p.y - p.h * 0.1 - up - drop, h = this.fitH(a.id, p.h * 0.95, p.w * 1.25);
    if (a.glow > 0.02) {
      const gg = g.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, h * 0.75);
      gg.addColorStop(0, `rgba(255,225,110,${0.75 * a.glow})`); gg.addColorStop(1, "rgba(255,225,110,0)");
      g.fillStyle = gg; g.beginPath(); g.arc(x, y - h * 0.5, h * 0.75, 0, Math.PI * 2); g.fill();
    }
    const idle = Math.sin(this.t * 2.2 + a.ph) * 0.018;
    this.sprite(g, spriteUrl(a.id, mood), x, y, h, { sy: 1 + sq + idle, sx: 1 - sq * 0.6, rot: p.hop ? Math.sin(a.mv * Math.PI * 2) * 0.25 : 0 });
  }

  private drawSpeech(g: G, a: Actor) {
    const r = this.rise(a);
    if (r < 0.45 || this.drape.c > 0.3) return;
    const p = this.pos(a), top = p.y - p.h * 0.1 - r * p.h * 0.34 - this.fitH(a.id, p.h * 0.95, p.w * 1.25);
    const fs = clamp(p.h * 0.13, 13, 22);
    g.save(); g.globalAlpha = clamp((r - 0.45) * 3, 0, 1);
    g.font = `${fs}px ${FONT}`;
    const tw = g.measureText(a.word).width + fs * 1.1, bh = fs * 1.6;
    const bx = clamp(p.x + p.w * 0.12, this.stageR.x + 14 + tw / 2, this.stageR.x + this.stageR.w - 14 - tw / 2), by = Math.max(this.stageR.y + 14 + bh / 2, top - bh * 0.2);
    g.fillStyle = "#FFFFFF";
    rr(g, bx - tw / 2, by - bh / 2, tw, bh, bh / 2); g.fill();
    g.beginPath(); g.moveTo(bx - tw * 0.2, by + bh * 0.4); g.lineTo(bx - tw * 0.32, by + bh * 0.85); g.lineTo(bx - tw * 0.02, by + bh * 0.42); g.fill();
    g.fillStyle = "#23305A"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(a.word, bx, by + 1);
    // sound waves
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3; g.lineCap = "round";
    const cy = top + p.h * 0.4, ph = (this.t * 3) % 1;
    for (let k = 0; k < 3; k++) {
      const rad = p.h * (0.18 + k * 0.1 + ph * 0.1);
      g.globalAlpha = clamp((r - 0.45) * 3, 0, 1) * (1 - k * 0.28);
      for (const s of [-1, 1]) { g.beginPath(); g.arc(p.x + s * p.w * 0.22, cy, rad, s < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, s < 0 ? Math.PI * 1.2 : Math.PI * 0.2); g.stroke(); }
    }
    g.restore();
  }

  private drawMark(g: G, a: Actor) {
    if (a.glow > 0.02) {
      // "it was THIS one!" — pulsing ring and a bouncing arrow
      const p = this.pos(a), k = a.glow, pulse = 1 + Math.sin(this.t * 10) * 0.06;
      g.save(); g.globalAlpha = Math.min(1, k * 1.5);
      g.strokeStyle = "#FFE38A"; g.lineWidth = 5; g.setLineDash([10, 7]); g.lineDashOffset = -this.t * 40;
      g.beginPath(); g.ellipse(p.x, p.y - p.h * 0.5, p.w * 0.5 * pulse, p.h * 0.6 * pulse, 0, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      const ay = p.y - p.h * 1.18 - Math.abs(Math.sin(this.t * 8)) * 12, as = Math.max(12, p.h * 0.14);
      g.beginPath(); g.moveTo(p.x - as, ay - as); g.lineTo(p.x + as, ay - as); g.lineTo(p.x, ay + as * 0.4); g.closePath();
      clayFill(g, "#FFD25A", p.x, ay - as * 0.4, as, { gloss: 0.5 });
      g.strokeStyle = "#23305A"; g.lineWidth = 3; g.stroke();
      g.restore();
    }
    if (a.mark <= 0.01) return;
    const p = this.pos(a), r = Math.max(10, p.h * 0.12) * a.mark;
    const x = p.x + p.w * 0.36, y = p.y - p.h * 0.78;
    blob(g, x, y, r, r, "#2FA866", { gloss: 0.5 });
    g.fillStyle = "#FFFFFF"; g.font = `${r * 1.2}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(a.markN), x, y + 1);
  }

  private drawDrape(g: G) {
    const c = this.drape.c;
    if (c <= 0.01) return;
    const I = this.inner(), top = I.y + I.h * 0.07, bot = I.y + I.h - 12, half = I.w / 2, w = half * c;
    for (const s of [0, 1]) {
      const x0 = s ? I.x + I.w - w : I.x;
      g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + w, top);
      g.lineTo(x0 + w, bot);
      for (let x = x0 + w; x >= x0; x -= 24) g.quadraticCurveTo(x - 12, bot + 10, x - 24, bot);
      g.lineTo(x0, top); g.closePath();
      const dg = g.createLinearGradient(x0, 0, x0 + Math.max(1, w), 0);
      dg.addColorStop(0, "#A32533"); dg.addColorStop(0.5, "#E04656"); dg.addColorStop(1, "#A32533");
      g.fillStyle = dg; g.fill();
      g.save(); g.clip();
      g.strokeStyle = "rgba(70,0,15,0.22)"; g.lineWidth = 6;
      for (let x = x0 + 14; x < x0 + w; x += 30) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + 3, bot + 10); g.stroke(); }
      g.restore();
    }
    if (c > 0.9) {
      const cx = I.x + I.w / 2, cy = I.y + I.h * 0.45, R = Math.min(I.w, I.h) * 0.13;
      g.save(); g.globalAlpha = (c - 0.9) * 10;
      g.strokeStyle = "#FFE38A"; g.lineWidth = 5; g.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const rad = R * (1.25 + k * 0.35 + this.wave * 0.25);
        g.globalAlpha = ((c - 0.9) * 10) * (0.25 + this.wave * 0.75) * (1 - k * 0.25);
        for (const s of [-1, 1]) { g.beginPath(); g.arc(cx, cy, rad, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25); g.stroke(); }
      }
      g.globalAlpha = (c - 0.9) * 10;
      const sc = 1 + this.wave * 0.12;
      blob(g, cx, cy, R * sc, R * sc, "#F2C14E", { gloss: 0.45 });
      this.drawEar(g, cx, cy, R * 0.62 * sc);
      clayText(g, "EARS ONLY", cx, cy + R * 1.55, clamp(R * 0.42, 16, 30), { fill: "#FFF4E2" });
      g.restore();
    }
  }

  private drawEar(g: G, x: number, y: number, s: number) {
    g.save(); g.translate(x, y);
    g.beginPath();
    g.moveTo(-s * 0.55, -s * 0.2);
    g.bezierCurveTo(-s * 0.6, -s * 1.05, s * 0.75, -s * 1.1, s * 0.6, -s * 0.05);
    g.bezierCurveTo(s * 0.5, s * 0.5, s * 0.05, s * 0.45, s * 0.05, s * 0.85);
    g.bezierCurveTo(s * 0.05, s * 1.15, -s * 0.5, s * 1.05, -s * 0.45, s * 0.7);
    g.closePath();
    clayFill(g, "#FFB98A", 0, 0, s, { gloss: 0.4 });
    g.strokeStyle = "#C9734A"; g.lineWidth = s * 0.14; g.lineCap = "round";
    g.beginPath(); g.moveTo(-s * 0.2, -s * 0.1); g.bezierCurveTo(-s * 0.25, -s * 0.65, s * 0.4, -s * 0.65, s * 0.3, -s * 0.1); g.bezierCurveTo(s * 0.22, s * 0.2, -s * 0.05, s * 0.15, -s * 0.05, s * 0.4); g.stroke();
    g.restore();
  }

  private drawSign(g: G) {
    const s = this.sign, live = this.hud.status === "playing";
    clayPanel(g, s.x, s.y, s.w, s.h, 16, "#23305A", { lip: 5 });
    const nb = Math.max(4, Math.floor(s.w / 22));
    for (let i = 0; i < nb; i++) {
      const on = Math.sin(this.t * 5 + i * 1.1) > 0 || this.phase === "done";
      for (const yy of [s.y + 5, s.y + s.h - 10]) { g.fillStyle = on ? "#FFE38A" : "rgba(255,227,138,0.25)"; g.beginPath(); g.arc(s.x + 12 + (i * (s.w - 24)) / (nb - 1), yy, 2.6, 0, Math.PI * 2); g.fill(); }
    }
    const ph = live ? this.phase : "intro";
    const label = ph === "intro" ? "SHOWTIME!" : ph === "roll" ? "ROLL CALL" : ph === "show" ? (this.ears ? "LISTEN!" : "WATCH!") : ph === "shuffle" ? "SHUFFLE!" : ph === "done" ? "BRAVO!" : ph === "oops" ? "OOPS!" : "YOUR TURN";
    const dots = live && (ph === "show" || ph === "input" || ph === "oops") ? this.seq.length : 0;
    const fs = clamp(s.w * 0.12, 15, 22);
    clayText(g, label, s.x + s.w / 2, s.y + (dots ? s.h * 0.36 : s.h * 0.45), fs, { fill: ph === "input" ? "#7CF2C9" : ph === "oops" ? "#FF8FB1" : "#FFD25A", stroke: "#0F1636", gloss: false });
    if (dots) {
      const filled = ph === "show" ? this.shown : this.idx;
      const r = clamp((s.w - 30) / (dots * 2.7), 3, 6), sp = r * 2.7, x0 = s.x + s.w / 2 - ((dots - 1) * sp) / 2;
      for (let i = 0; i < dots; i++) { g.fillStyle = i < filled ? (ph === "show" ? "#FFD25A" : "#7CF2C9") : "rgba(255,255,255,0.22)"; g.beginPath(); g.arc(x0 + i * sp, s.y + s.h * 0.68, r, 0, Math.PI * 2); g.fill(); }
    }
  }

  private drawReplay(g: G) {
    if (this.diff !== "easy" || this.hud.status !== "playing" || this.replayLeft <= 0) return;
    const b = this.rBtn, on = this.canReplay();
    g.save(); g.globalAlpha = on ? 1 : 0.4;
    const pr = b.press, wob = on ? Math.sin(this.t * 4) * 0.03 : 0;
    g.translate(b.x + b.w / 2, b.y + b.h / 2); g.rotate(wob); g.translate(-b.w / 2, -b.h / 2);
    clayPanel(g, 0, 0, b.w, b.h, 18, "#2FA866", { lip: 6, pressed: pr });
    const cx = b.h * 0.42, cy = (b.h - 6) / 2 + pr * 4, r = b.h * 0.2;
    g.strokeStyle = "#FFFFFF"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.arc(cx, cy, r, -Math.PI * 0.15, Math.PI * 1.45); g.stroke();
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(cx + r * 1.0, cy - r * 0.75); g.lineTo(cx + r * 1.45, cy + r * 0.15); g.lineTo(cx + r * 0.45, cy + r * 0.05); g.fill();
    clayText(g, "AGAIN", b.w * 0.62, cy + 1, clamp(b.w * 0.17, 14, 20), { fill: "#FFFFFF", stroke: "#1B6B40", gloss: false });
    g.restore();
  }

  private drawPit(g: G) {
    const W = this.W, H = this.H;
    // audience heads
    const n = Math.ceil(W / 42) + 1;
    for (let i = 0; i < n; i++) {
      const x = i * 42 + (i % 2) * 6, b = this.cheer * Math.abs(Math.sin(this.t * 11 + i * 1.7)) * 12;
      const y = H - 6 - b;
      blob(g, x, y, 21, 24, i % 2 ? "#2A1240" : "#341A4E", { gloss: 0.12 });
      g.fillStyle = "rgba(255,255,255,0.75)";
      for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 6, y - 8, 2.4, 0, Math.PI * 2); g.fill(); }
    }
    // Gloop, the director, in the prompter's shell
    const p = this.gl, mood = this.hud.status === "playing" ? this.hud.host.mood : "happy";
    const conduct = this.phase === "show" && this.hud.status === "playing" ? Math.sin(this.t * 7) * 0.07 : Math.sin(this.t * 1.5) * 0.025;
    this.sprite(g, this.host(mood), p.x, p.y - p.h * 0.08, p.h, { rot: conduct, sy: 1 + p.bop * 0.07 + Math.sin(this.t * 2.6) * 0.015, sx: 1 - p.bop * 0.04 });
    const sw = p.h * 1.25, sy = p.y - 2;
    g.beginPath(); g.ellipse(p.x, sy, sw / 2, p.h * 0.24, 0, Math.PI, 0); g.closePath();
    clayFill(g, "#E8B53A", p.x, sy - p.h * 0.12, sw * 0.5, { gloss: 0.35 });
    g.save(); g.beginPath(); g.ellipse(p.x, sy, sw / 2, p.h * 0.24, 0, Math.PI, 0); g.clip();
    g.strokeStyle = "rgba(122,74,16,0.35)"; g.lineWidth = 3;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(p.x, sy + 4); g.lineTo(p.x + k * sw * 0.16, sy - p.h * 0.3); g.stroke(); }
    g.restore();
    this.drawSign(g);
    this.drawReplay(g);
  }

  private drawScene(g: G) {
    const key = `${this.W}x${this.H}x${this.dpr}:${this.stageR.x},${this.stageR.y},${this.stageR.w},${this.stageR.h}`;
    if (!this.bg || key !== this.bgKey) { this.paintHall(); this.bgKey = key; }
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    const I = this.inner();
    g.save(); rr(g, I.x, I.y, I.w, I.h, 22); g.clip();
    // sweeping searchlights
    for (const k of [0, 1]) {
      const a = Math.sin(this.t * 0.6 + k * 2.4) * 0.5, ox = I.x + I.w * (k ? 0.85 : 0.15), oy = I.y;
      g.save(); g.translate(ox, oy); g.rotate(a);
      const lg = g.createLinearGradient(0, 0, 0, I.h); lg.addColorStop(0, "rgba(255,240,180,0.14)"); lg.addColorStop(1, "rgba(255,240,180,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(I.w * 0.12, I.h); g.lineTo(-I.w * 0.12, I.h); g.fill();
      g.restore();
    }
    // bleacher steps for the back rows
    for (let r = 0; r < this.rows.length - 1; r++) {
      const y = this.seats.find((s) => s.row === r)?.y ?? 0, ny = this.seats.find((s) => s.row === r + 1)?.y ?? y + 40;
      const inset = I.w * (0.07 - r * 0.012), x0 = I.x + inset, w = I.w - inset * 2;
      rr(g, x0, y - 6, w, ny - y, 10); clayFill(g, r % 2 ? "#9A5F2E" : "#8A5428", I.x + I.w / 2, y + (ny - y) / 2, I.w * 0.5, { gloss: 0.12 });
      g.fillStyle = "rgba(255,230,180,0.22)"; g.fillRect(x0 + 8, y - 5, w - 16, 3);
      g.fillStyle = "rgba(40,15,5,0.18)"; g.fillRect(x0, y + 10, w, 3);
    }
    const seatedIn = (r: number) => this.actors.filter((a) => !(a.mv > 0 && a.mv < 1) && this.seats[a.seat]?.row === r);
    const rowsN = this.rows.length;
    for (let r = 0; r < rowsN; r++) {
      this.seats.forEach((s, i) => { if (s.row === r) this.drawSeatBack(g, s, i); });
      for (const a of seatedIn(r)) this.drawActor(g, a);
      this.seats.forEach((s, i) => {
        if (s.row !== r) return;
        const who = this.actors.find((a) => a.seat === i && !(a.mv > 0 && a.mv < 1));
        this.drawSeatFront(g, s, who ? NAME[who.id] : "");
      });
      for (const a of seatedIn(r)) this.drawMark(g, a);
    }
    for (const a of this.actors) if (a.mv > 0 && a.mv < 1) this.drawActor(g, a);
    // lights down + spotlight on whoever is talking
    if (this.dim.v > 0.01) {
      g.fillStyle = `rgba(12,4,32,${0.5 * this.dim.v})`; g.fillRect(I.x, I.y, I.w, I.h);
      for (const a of this.actors) {
        const r = this.rise(a);
        if (r <= 0.01) continue;
        const p = this.pos(a), s = this.seats[a.seat];
        g.save(); g.globalAlpha = Math.min(1, r) * this.dim.v;
        const cg = g.createLinearGradient(0, I.y, 0, p.y);
        cg.addColorStop(0, "rgba(255,240,170,0.05)"); cg.addColorStop(1, "rgba(255,240,170,0.35)");
        g.fillStyle = cg; g.beginPath(); g.moveTo(p.x - 14, I.y); g.lineTo(p.x + 14, I.y); g.lineTo(p.x + p.w * 0.55, p.y + 4); g.lineTo(p.x - p.w * 0.55, p.y + 4); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,240,170,0.35)"; g.beginPath(); g.ellipse(p.x, p.y + 2, p.w * 0.55, p.h * 0.08, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        if (s) { this.drawSeatBack(g, s, a.seat); this.drawActor(g, a); this.drawSeatFront(g, s, NAME[a.id]); }
      }
    }
    for (const a of this.actors) this.drawSpeech(g, a);
    this.drawDrape(g);
    g.restore();
    // footlights
    const fy = I.y + I.h - 6, nl = Math.max(6, Math.round(I.w / 46));
    for (let i = 0; i < nl; i++) {
      const x = I.x + ((i + 0.5) * I.w) / nl, on = 0.6 + 0.4 * Math.sin(this.t * 3 + i);
      const fg = g.createRadialGradient(x, fy, 0, x, fy, 18); fg.addColorStop(0, `rgba(255,230,140,${0.55 * on})`); fg.addColorStop(1, "rgba(255,230,140,0)");
      g.fillStyle = fg; g.fillRect(x - 18, fy - 18, 36, 36);
      blob(g, x, fy, 5, 3.5, "#FFF1B8", { gloss: 0.6 });
    }
    this.drawPit(g);
  }

  protected drawBackground(g: G) {
    if (!this.actors.length) {
      this.actors = (["pip", "hoot", "zib", "bonbon"] as CastId[]).map((id, i) => ({ id, voice: "happy" as Voice, word: WORDS[id][0], seat: i, from: i, mv: 0, popAt: -9, popDur: 1, enter: 1, sad: 0, mark: 0, markN: 0, glow: 0, ph: i * 1.3 }));
    }
    this.layout();
    const k = Math.floor(this.t / 1.4) % this.actors.length, a = this.actors[k];
    if (this.t - a.popAt > 1.4) { a.popAt = this.t - (this.t % 1.4); a.popDur = 1.2; }
    this.drawScene(g);
  }

  protected draw(g: G) { this.drawScene(g); }
}
