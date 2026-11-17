// Count Fast — Momo's theatre. A troupe of Momos bounces onto the stage… then the curtain drops!
// How many were there? Pick the number (or type it on the keypad on Hard). After every answer the curtain
// opens and the Momos count off one by one. Unlimited levels: 2 → 25 Momos and shorter shows, then Momos in
// hats (still count!), Gloop decoys (don't count!), Momos walking both ways and Momos that pop in late.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { FONT, NAVY, blob, clayFill, clayPanel, clayText, darken, rr, shadow, star, type G } from "../paint";

const POSES = ["/brand/momo-cheer.webp", "/brand/momo-surprised.webp", "/brand/momo-sly.webp", "/brand/momo-wave.webp"];
const GLOOP = "/brand/chars/gloop-happy.webp";
type Hat = "party" | "top" | "crown" | "bow";
const HATS: Hat[] = ["party", "top", "crown", "bow"];
type Twist = "hats" | "decoys" | "walk" | "late";
interface Mo {
  gloop: boolean; pose: number; hat: Hat | null;
  x: number; y: number; s: number; tx: number; ty: number; sx: number;
  vx: number; ph: number; sp: number; at: number; in: number; late: boolean; on: boolean; num: number; mark: number; pop: number;
}
interface Key { label: string; v: number; x: number; y: number; w: number; h: number; press: number; state: "idle" | "right" | "wrong" }
type Phase = "intro" | "show" | "closing" | "answer" | "count" | "done";

export default class CountFast extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "count-fast", title: "Count Fast", host: "momo", style: "rounds",
    music: { calm: "a:count_calm", action: "a:count_action" },
    sounds: ["a:curtain", "a:click", "a:cheer", "a:tink", "a:twinkle", "a:gong", "a:tickHi", "pop", "hop", "a:squelch", "a:applause", "v:momo_laugh", "v:gloop_laugh"],
    sprites: ["/brand/momo-sly.webp", "/brand/momo-wave.webp", GLOOP], voicePitch: 1.5, transition: "curtain",
  };
  private mos: Mo[] = [];
  private keys: Key[] = [];
  private keypad = false;
  private typed = "";
  private n = 3; private nGloop = 0;
  private tw = { hats: false, decoys: false, walk: false, late: false };
  private phase: Phase = "intro";
  private prompt = 0; private prompts = 6;
  private hearts = 3; private heartsMax = 3; private misses = 0;
  private showEnd = 0; private pt = 0; private ansT0 = 0; private ansLimit = 10;
  private curtain = { v: 0 };
  private hostA = { bop: 0, cheer: 0 };
  private seenEver = new Set<Twist>();
  private seenKeypad = false;
  private hatBag = new Bag<Hat>(HATS);
  private recent = new Recent(30);
  private stage = { x: 0, y: 0, w: 300, h: 300 };
  private inner = { x: 0, y: 0, w: 300, h: 300 };
  private floor = { top: 0, bot: 0 };
  private q = { x: 0, y: 0, w: 300, h: 54 };
  private pad = { x: 0, y: 0, w: 300, h: 200 };
  private hostR = { x: 0, y: 0, h: 80 };
  private cache = new Map<string, HTMLCanvasElement>();
  private bg?: HTMLCanvasElement;
  private pid = 0;
  private demo = false;

  protected onResize() { this.layout(); this.bg = undefined; }

  // ------------------------------------------------------------ layout
  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H * 1.05;
    if (portrait) {
      const sh = clamp(A.h * (this.keypad ? 0.47 : 0.5), 200, 520);
      this.stage = { x: 8, y: A.y + 2, w: W - 16, h: sh };
      this.q = { x: 8, y: this.stage.y + sh + 8, w: W - 16, h: clamp(A.h * 0.085, 46, 60) };
      this.pad = { x: 14, y: this.q.y + this.q.h + 8, w: W - 28, h: A.y + A.h - (this.q.y + this.q.h + 8) - 2 };
      this.hostR = { x: this.q.x + this.q.h * 0.85, y: this.q.y + this.q.h + 4, h: this.q.h * 1.55 };
    } else {
      const sw = Math.min(W * 0.6, (A.h - 4) * 1.6);
      const pw = Math.min(W - sw - 40, 460);
      const x0 = (W - sw - pw - 20) / 2;
      this.stage = { x: x0, y: A.y + 2, w: sw, h: A.h - 6 };
      const px = x0 + sw + 20;
      this.q = { x: px, y: A.y + 6, w: pw, h: clamp(A.h * 0.12, 56, 74) };
      this.pad = { x: px, y: this.q.y + this.q.h + 14, w: pw, h: Math.min(A.y + A.h - (this.q.y + this.q.h + 14) - 6, this.keypad ? 400 : 300) };
      this.hostR = { x: px + this.q.h * 0.75, y: this.q.y + this.q.h + 2, h: this.q.h * 1.45 };
    }
    const b = clamp(this.stage.w * 0.025, 8, 16);
    this.inner = { x: this.stage.x + b, y: this.stage.y + b * 1.6, w: this.stage.w - b * 2, h: this.stage.h - b * 2.4 };
    this.floor = { top: this.inner.y + this.inner.h * 0.32, bot: this.inner.y + this.inner.h - 8 };
    this.layoutKeys();
  }

  private layoutKeys() {
    const P = this.pad;
    if (!this.keypad) {
      const opts = this.keys;
      const gap = 12, bw = (P.w - gap) / 2, bh = Math.min(this.W < this.H ? 96 : 124, (P.h - gap) / 2);
      const oy = P.y + (P.h - (bh * 2 + gap)) / 2;
      opts.forEach((k, i) => { k.x = P.x + (i % 2) * (bw + gap); k.y = oy + Math.floor(i / 2) * (bh + gap); k.w = bw; k.h = bh; });
    } else {
      const gap = 8, dispH = 0, rows = 4;
      const kh = Math.min(56, (P.h - dispH - gap * (rows - 1)) / rows), kw = Math.min(130, (P.w - gap * 2) / 3);
      const ox = P.x + (P.w - (kw * 3 + gap * 2)) / 2, oy = P.y + dispH + (P.h - dispH - (kh * rows + gap * (rows - 1))) / 2;
      this.keys.forEach((k, i) => { k.x = ox + (i % 3) * (kw + gap); k.y = oy + Math.floor(i / 3) * (kh + gap); k.w = kw; k.h = kh; });
    }
  }

  // ------------------------------------------------------------ sprites (pre-scaled for crisp, fast drawing)
  private sprC(url: string) {
    const c = this.cache.get(url);
    if (c) return c;
    const im = this.img(url);
    if (!im || !im.naturalWidth) return null;
    const h = 200, w = Math.round((h * im.naturalWidth) / im.naturalHeight);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d")!; g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, w, h);
    this.cache.set(url, cv);
    return cv;
  }

  // ------------------------------------------------------------ levels
  private lv(e: number, m: number, h: number) { return this.level >= byDiff(this.diff, { easy: e, medium: m, hard: h }); }

  protected setupLevel() {
    const d = this.diff;
    this.prompt = 0; this.prompts = 6; this.misses = 0;
    this.heartsMax = byDiff(d, { easy: 3, medium: 3, hard: 2 }); this.hearts = this.heartsMax;
    this.mos = []; this.keys = [];
    this.curtain.v = 1;
    this.music(this.level >= byDiff(d, { easy: 7, medium: 5, hard: 3 }) ? "action" : "calm");
    this.react("happy", this.rng.pick(["Count my friends!", "Here we come!", "How many of us? Count fast!", "Showtime!"]));
    this.after(0.4, () => this.newPrompt());
  }

  private newPrompt() {
    const L = this.level, d = this.diff;
    const M = byDiff(d, { easy: ramp(L, 4, 1, 12), medium: ramp(L, 6, 1.2, 18), hard: ramp(L, 8, 1.5, 25) });
    let n = 3;
    for (let tries = 0; tries < 10; tries++) { n = this.rng.int(Math.max(2, Math.round(M * 0.55)), Math.max(2, Math.round(M))); if (!this.recent.has(`${d}${n}${this.prompt % 2}`) || tries > 6) break; }
    this.recent.add(`${d}${n}${this.prompt % 2}`);
    const hats = this.lv(5, 3, 2) && this.rng.chance(0.5);
    const decoys = this.lv(8, 5, 3) && this.rng.chance(0.45);
    const walk = this.lv(11, 7, 5) && this.rng.chance(0.4);
    const late = n >= 4 && this.lv(14, 9, 6) && this.rng.chance(0.4);
    this.tw = { hats, decoys, walk, late };
    this.keypad = d === "hard" && L >= 5;
    this.n = n; this.nGloop = decoys ? this.rng.int(1, Math.min(4, 1 + Math.floor(n / 4))) : 0;
    this.layout();
    // place everyone on the stage floor without overlapping
    const total = n + this.nGloop, I = this.inner, F = this.floor;
    const area = I.w * (F.bot - F.top);
    const s = clamp(Math.sqrt(area / total) * (total > 12 ? 0.7 : 0.78), 28, Math.min(96, I.h * 0.42));
    const spots: { x: number; y: number }[] = [];
    const w = s * 1.25;
    for (let i = 0; i < total; i++) {
      let best = { x: I.x + I.w / 2, y: F.bot, d: -1 };
      for (let k = 0; k < 60; k++) {
        const x = this.rng.range(I.x + w * 0.5 + 4, I.x + I.w - w * 0.5 - 4), y = this.rng.range(F.top + s * 0.1, F.bot);
        const dd = spots.reduce((m, p) => Math.min(m, Math.hypot((p.x - x) / (w * 0.95), (p.y - y) / (s * 0.72))), 9);
        if (dd > best.d) best = { x, y, d: dd };
        if (dd > 1.25) break;
      }
      spots.push(best);
    }
    const lateIdx = new Set<number>();
    if (late) { const k = this.rng.int(1, Math.min(3, n - 2)); this.rng.shuffle([...Array(n).keys()]).slice(0, k).forEach((i) => lateIdx.add(i)); }
    const order = this.rng.shuffle([...Array(total).keys()]);
    const stagger = Math.min(0.13, 1.1 / total);
    const show = byDiff(d, { easy: ramp(L, 4.5, -0.15, 2.4) + n * 0.12, medium: ramp(L, 3.8, -0.15, 2.0) + n * 0.1, hard: ramp(L, 3.2, -0.12, 1.6) + n * 0.08 });
    const enterEnd = 0.3 + total * stagger + 0.6;
    this.mos = spots.map((p, i) => {
      const gloop = i >= n;
      const depth = lerp(0.84, 1.08, (p.y - F.top) / Math.max(1, F.bot - F.top));
      const fromLeft = walk ? i % 2 === 0 : this.rng.chance(0.5);
      const isLate = lateIdx.has(i);
      return {
        gloop, pose: this.rng.int(0, POSES.length - 1), hat: !gloop && hats && this.rng.chance(0.45) ? this.hatBag.next(this.rng) : null,
        x: p.x, y: p.y, s: s * depth, tx: p.x, ty: p.y, sx: fromLeft ? I.x - w : I.x + I.w + w,
        vx: walk ? (fromLeft ? 1 : -1) * this.rng.range(30, 60) * (s / 50) : 0, ph: this.rng.range(0, 6), sp: this.rng.range(7, 10),
        at: isLate ? enterEnd + show * this.rng.range(0.35, 0.7) : 0.3 + order.indexOf(i) * stagger, in: 0, late: isLate, on: false, num: 0, mark: 0, pop: 0,
      };
    });
    if (this.mos.length && !this.mos.some((m) => m.hat) && hats) this.mos[0].hat = this.hatBag.next(this.rng);
    // answer choices
    if (this.keypad) {
      this.keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((label, i) => ({ label, v: i, x: 0, y: 0, w: 0, h: 0, press: 0, state: "idle" as const }));
    } else {
      const opts = new Set<number>([n]);
      if (this.nGloop) opts.add(n + this.nGloop);
      const near = [-1, 1, -2, 2, 3, -3].map((k) => n + k).filter((v) => v >= 1).map((v) => ({ v, k: Math.abs(v - n) + this.rng.range(0, 1.3) })).sort((a, b) => a.k - b.k);
      for (const o of near) { if (opts.size >= 4) break; opts.add(o.v); }
      this.keys = [...opts].sort((a, b) => a - b).map((v) => ({ label: String(v), v, x: 0, y: 0, w: 0, h: 0, press: 0, state: "idle" as const }));
    }
    this.typed = "";
    this.layout();
    this.phase = "intro"; this.pid++; this.pt = 0;
    this.showEnd = enterEnd + show + (late ? 0.3 : 0);
    const id = this.pid;
    // twist banners the first time each one shows up
    const all: [Twist, boolean, string, string][] = [["hats", hats, "PARTY HATS!", "Momos in hats still count!"], ["decoys", decoys, "GLOOP DECOYS!", "Don't count the green Gloops!"], ["walk", walk, "ON THE MOVE!", "Momos walk both ways — keep counting!"], ["late", late, "LATECOMERS!", "Some Momos pop in late. Watch!"]];
    const fresh = all.find(([k, on]) => on && !this.seenEver.has(k));
    let delay = 0.5;
    if (fresh) { this.seenEver.add(fresh[0]); this.banner(fresh[2], fresh[3], fresh[0] === "decoys" ? "pink" : "mint"); this.sfx("a:twinkle", { gain: 0.5 }); delay = 1.7; }
    if (this.keypad && !this.seenKeypad && !fresh) { this.seenKeypad = true; this.banner("KEYPAD!", "Type the exact number", "gold"); delay = 1.7; }
    this.hint(decoys ? "Count the MOMOS — not the Gloops! 👀" : "Count the Momos! 👀");
    this.after(delay, () => {
      if (id !== this.pid) return;
      this.tween(this.curtain, { v: 0 }, 0.5, ease.inOut);
      this.sfx("a:curtain", { gain: 0.5 });
      this.after(0.45, () => { if (id === this.pid) { this.phase = "show"; this.pt = 0; } });
    });
  }

  private closeCurtain() {
    this.phase = "closing";
    this.tween(this.curtain, { v: 1 }, 0.45, ease.inOut);
    this.sfx("a:curtain", { gain: 0.55 });
    const id = this.pid;
    this.after(0.5, () => {
      if (id !== this.pid) return;
      this.phase = "answer"; this.ansT0 = this.t;
      this.ansLimit = byDiff(this.diff, { easy: 14, medium: 11, hard: 10 }) + (this.keypad ? 4 : 0);
      this.hint(this.keypad ? "Type how many Momos, then ✓" : this.nGloop ? "How many MOMOS? (not Gloops!) 🤔" : "How many Momos? 🤔");
      this.react("wow", this.rng.pick(["How many were we?", "Did you count us all?", "Quick! How many?", "Hee hee! How many?"]), false);
      this.sfx("a:tink", { gain: 0.4 });
    });
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    if (this.keypad) {
      if (/^[0-9]$/.test(key)) this.press(this.keys.find((k) => k.label === key)!);
      else if (key === "Backspace") this.press(this.keys[9]);
      else if (key === "Enter") this.press(this.keys[11]);
      return;
    }
    const k = Number(key) - 1;
    if (k >= 0 && k < this.keys.length) this.press(this.keys[k]);
  }

  protected onDown(x: number, y: number) {
    const k = this.keys.find((k) => x >= k.x - 3 && x <= k.x + k.w + 3 && y >= k.y - 3 && y <= k.y + k.h + 3);
    if (k) this.press(k);
  }

  private press(k: Key | undefined) {
    if (!k) return;
    if (this.phase !== "answer") { if (this.phase === "show") this.sfx("a:click", { gain: 0.2 }); return; }
    k.press = 1; this.tween(k, { press: 0 }, 0.22);
    if (this.keypad) {
      if (k.label === "⌫") { this.typed = this.typed.slice(0, -1); this.sfx("a:click", { gain: 0.4, rate: 0.8 }); return; }
      if (k.label === "✓") { if (!this.typed) { this.sfx("a:tink", { gain: 0.3 }); return; } this.answer(Number(this.typed), k); return; }
      if (this.typed.length < 2) this.typed = (this.typed === "0" ? "" : this.typed) + k.label;
      this.sfx("a:click", { gain: 0.45, rate: 1 + Number(k.label) * 0.03 });
      return;
    }
    this.answer(k.v, k);
  }

  private answer(v: number, k: Key) {
    this.phase = "count"; this.timerBar(null);
    const ok = v === this.n;
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    if (ok) {
      k.state = "right";
      const speed = clamp(1 - (this.t - this.ansT0) / (this.ansLimit * 0.6), 0, 1);
      this.good(cx, cy - k.h * 0.4, 55 + this.n * 5 + (this.nGloop ? 20 : 0), speed);
      this.hostA.cheer = 1;
      this.sfx("a:cheer", { gain: 0.45, delay: 0.1 });
    } else {
      k.state = "wrong";
      if (!this.keypad) { const r = this.keys.find((x) => x.v === this.n); if (r) r.state = "right"; }
      this.misses++; this.hearts--;
      this.bad(cx, cy, { line: this.rng.pick([`Oops! We were ${this.n}!`, "Let's count together!", "Hmm, not quite!", "Count again with me!"]) });
    }
    this.countOff(ok);
  }

  /** curtain opens and every Momo counts off one by one */
  private countOff(ok: boolean) {
    const id = this.pid;
    this.tween(this.curtain, { v: 0 }, 0.45, ease.inOut);
    this.sfx("a:curtain", { gain: 0.45 });
    for (const m of this.mos) { m.on = true; m.in = 1; m.pop = 1; m.vx = 0; }
    const list = this.mos.filter((m) => !m.gloop).sort((a, b) => a.x - b.x);
    const step = clamp(1.6 / list.length, 0.07, 0.24);
    list.forEach((m, i) => this.after(0.55 + i * step, () => {
      if (id !== this.pid) return;
      m.num = i + 1; m.mark = 1;
      this.tone(this.note(i + 3), 0.18, m.x, 0.4);
    }));
    const gl = this.mos.filter((m) => m.gloop);
    gl.forEach((m, i) => this.after(0.55 + list.length * step + 0.1 + i * 0.12, () => { if (id === this.pid) { m.mark = -1; this.sfx("a:squelch", { gain: 0.3, x: m.x }); } }));
    const end = 0.55 + list.length * step + (gl.length ? 0.3 + gl.length * 0.12 : 0) + 0.15;
    this.after(end, () => {
      if (id !== this.pid) return;
      this.float(`${this.n}!`, this.inner.x + this.inner.w / 2, this.inner.y + this.inner.h * 0.25, ok ? "#7CF2C9" : "#FFD25A", 46);
      this.sfx(ok ? "a:applause" : "a:tink", { gain: ok ? 0.35 : 0.4 });
      if (ok && this.combo >= 3) this.sfx("v:momo_laugh", { gain: 0.5, delay: 0.15, duck: false });
      if (gl.length) this.sfx("v:gloop_laugh", { gain: 0.45, delay: 0.2, duck: false });
    });
    this.after(end + (ok ? 1.0 : 1.5), () => { if (id === this.pid) this.next(); });
  }

  private timeUp() {
    this.phase = "count"; this.timerBar(null);
    this.misses++; this.hearts--;
    if (!this.keypad) { const r = this.keys.find((x) => x.v === this.n); if (r) r.state = "right"; }
    this.sfx("a:gong", { gain: 0.45 });
    this.bad(this.pad.x + this.pad.w / 2, this.pad.y + 20, { line: this.rng.pick(["Time's up! Let's count!", "Too slow! Count with me!"]) });
    this.countOff(false);
  }

  private next() {
    if (this.hearts <= 0) { this.phase = "done"; this.levelFail("Count every Momo!"); return; }
    this.prompt++;
    if (this.prompt >= this.prompts) {
      this.phase = "done";
      this.levelClear({ perfect: this.misses === 0, title: this.misses === 0 ? "PERFECT COUNT!" : undefined });
      return;
    }
    if (this.prompt === this.prompts - 2) this.music("action");
    // everybody runs off, curtain closes, next show
    this.phase = "intro"; this.pid++;
    for (const m of this.mos) { m.num = 0; m.mark = 0; }
    const out = this.mos.map((m) => ({ m, dir: m.x < this.inner.x + this.inner.w / 2 ? -1 : 1 }));
    const I = this.inner;
    for (const { m, dir } of out) { m.sx = dir < 0 ? I.x - m.s * 1.5 : I.x + I.w + m.s * 1.5; m.in = 1; this.tween(m, { in: 0 }, 0.45, ease.in, Math.random() * 0.15); }
    this.tween(this.curtain, { v: 1 }, 0.4, ease.inOut, 0.35);
    this.sfx("a:curtain", { gain: 0.35, delay: 0.3 });
    this.after(0.85, () => this.newPrompt());
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    this.hostA.bop = Math.max(0, this.hostA.bop - dt * 3);
    this.hostA.cheer = Math.max(0, this.hostA.cheer - dt * 0.6);
    const I = this.inner;
    if (this.phase === "show") {
      this.pt += dt;
      for (const m of this.mos) {
        if (!m.on && this.pt >= m.at) {
          m.on = true;
          if (m.late) { m.in = 1; m.pop = 0; this.tween(m, { pop: 1 }, 0.35, ease.back); this.sfx("pop", { gain: 0.5, x: m.x }); this.burst(m.x, m.y - m.s * 0.4, { n: 8, colors: ["#FFFFFF", "#FFD25A"], kind: "star", speed: 140, size: 5 }); }
          else { m.pop = 1; this.tween(m, { in: 1 }, 0.6, ease.out); if (Math.random() < 0.6) this.sfx(m.gloop ? "a:squelch" : "hop", { gain: 0.22, x: m.sx, rate: 0.9 + Math.random() * 0.3 }); }
        }
      }
      if (this.pt >= this.showEnd) this.closeCurtain();
    }
    // walkers stroll both ways and turn at the wings
    if (this.phase === "show" || this.phase === "closing") for (const m of this.mos) {
      if (!m.vx || m.in < 1) continue;
      m.tx += m.vx * dt;
      const half = m.s * 0.62;
      if (m.tx < I.x + half) { m.tx = I.x + half; m.vx = Math.abs(m.vx); }
      if (m.tx > I.x + I.w - half) { m.tx = I.x + I.w - half; m.vx = -Math.abs(m.vx); }
    }
    for (const m of this.mos) {
      m.x = m.in >= 1 ? m.tx : lerp(m.sx, m.tx, m.in);
      if (m.mark > 0) m.mark = Math.max(0.0001, m.mark - dt * 2.5);
    }
    if (this.phase === "answer") {
      const u = 1 - (this.t - this.ansT0) / this.ansLimit;
      this.timerBar(u, u < 0.3 ? "#FF6F91" : "#FFD25A");
      if (u < 0.3 && Math.floor((this.t - this.ansT0) * 2) !== Math.floor((this.t - this.ansT0 - dt) * 2)) this.sfx("a:tickHi", { gain: 0.25 });
      if (u <= 0) this.timeUp();
    }
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#FFCF70"); bg.addColorStop(1, "#FF9F5A");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) star(g, (i * 157.3) % W, (i * 91.7) % H, 4 + (i % 3) * 2, "rgba(255,255,255,0.35)", i);
    const S = this.stage, I = this.inner, F = this.floor;
    // proscenium frame
    shadow(g, S.x + S.w / 2, S.y + S.h + 4, S.w * 0.5, 12, 0.35);
    rr(g, S.x, S.y, S.w, S.h, 22); clayFill(g, "#C9302C", S.x + S.w / 2, S.y + S.h / 2, Math.max(S.w, S.h) * 0.6, { gloss: 0.2 });
    rr(g, S.x + 4, S.y + 4, S.w - 8, S.h - 8, 18); g.strokeStyle = "#FFD25A"; g.lineWidth = 3; g.stroke();
    // backdrop + floor
    g.save(); rr(g, I.x, I.y, I.w, I.h, 12); g.clip();
    const back = g.createLinearGradient(0, I.y, 0, F.top); back.addColorStop(0, "#2B1648"); back.addColorStop(1, "#5A2A7A");
    g.fillStyle = back; g.fillRect(I.x, I.y, I.w, F.top - I.y + 2);
    const spot = g.createRadialGradient(I.x + I.w / 2, F.top, 0, I.x + I.w / 2, F.top, I.w * 0.6);
    spot.addColorStop(0, "rgba(255,240,200,0.35)"); spot.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = spot; g.fillRect(I.x, I.y, I.w, I.h);
    const fl = g.createLinearGradient(0, F.top, 0, I.y + I.h); fl.addColorStop(0, "#B9784A"); fl.addColorStop(1, "#E3A563");
    g.fillStyle = fl; g.fillRect(I.x, F.top, I.w, I.y + I.h - F.top);
    g.strokeStyle = "rgba(90,52,32,0.25)"; g.lineWidth = 2;
    for (let k = 1; k < 7; k++) { const y = F.top + ((I.y + I.h - F.top) * k * k) / 49; g.beginPath(); g.moveTo(I.x, y); g.lineTo(I.x + I.w, y); g.stroke(); }
    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(I.x + I.w / 2 + k * I.w * 0.06, F.top); g.lineTo(I.x + I.w / 2 + k * I.w * 0.14, I.y + I.h); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(I.x, F.top - 2, I.w, 3);
    // stage lights along the back
    for (let k = 0; k < 9; k++) { const x = I.x + I.w * (0.08 + k * 0.105); g.fillStyle = "rgba(255,227,138,0.18)"; g.beginPath(); g.moveTo(x - 6, I.y); g.lineTo(x + 6, I.y); g.lineTo(x + 30, F.top); g.lineTo(x - 30, F.top); g.closePath(); g.fill(); }
    g.restore();
    this.bg = c;
  }

  private drawHat(g: G, h: Hat, x: number, y: number, s: number) {
    g.save(); g.translate(x, y);
    switch (h) {
      case "party": {
        g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(0, -s * 1.3); g.lineTo(s * 0.5, 0); g.closePath(); clayFill(g, "#9B5DE5", 0, -s * 0.5, s * 0.8, { gloss: 0.4 });
        g.save(); g.clip(); g.strokeStyle = "#FFD25A"; g.lineWidth = s * 0.14; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-s, -s * (0.25 + k * 0.38)); g.lineTo(s, -s * (0.45 + k * 0.38)); g.stroke(); } g.restore();
        blob(g, 0, -s * 1.32, s * 0.2, s * 0.2, "#FF6F91", { gloss: 0.5 }); break;
      }
      case "top":
        rr(g, -s * 0.7, -s * 0.16, s * 1.4, s * 0.24, s * 0.1); clayFill(g, "#2A2340", 0, 0, s * 0.7, { gloss: 0.3 });
        rr(g, -s * 0.45, -s * 1.0, s * 0.9, s * 0.92, s * 0.1); clayFill(g, "#2A2340", 0, -s * 0.5, s * 0.6, { gloss: 0.35 });
        g.fillStyle = "#E8504F"; g.fillRect(-s * 0.45, -s * 0.35, s * 0.9, s * 0.16); break;
      case "crown":
        g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(-s * 0.6, -s * 0.6); g.lineTo(-s * 0.3, -s * 0.3); g.lineTo(0, -s * 0.8); g.lineTo(s * 0.3, -s * 0.3); g.lineTo(s * 0.6, -s * 0.6); g.lineTo(s * 0.6, 0); g.closePath();
        clayFill(g, "#FFC93C", 0, -s * 0.3, s * 0.6, { gloss: 0.5 });
        blob(g, 0, -s * 0.18, s * 0.1, s * 0.1, "#3B82F6", { gloss: 0.6 }); break;
      case "bow":
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, -s * 0.2); g.lineTo(sd * s * 0.62, -s * 0.55); g.lineTo(sd * s * 0.62, s * 0.1); g.closePath(); clayFill(g, "#FF6F91", sd * s * 0.35, -s * 0.2, s * 0.45, { gloss: 0.4 }); }
        blob(g, 0, -s * 0.2, s * 0.17, s * 0.17, "#FF3D7F", { gloss: 0.5 }); break;
    }
    g.restore();
  }

  private drawMo(g: G, m: Mo) {
    if (!m.on) return;
    const url = m.gloop ? GLOOP : POSES[m.pose];
    const cv = this.sprC(url);
    if (!cv) return;
    const moving = m.in < 1 || m.vx !== 0;
    const hopH = Math.abs(Math.sin(this.t * (moving ? m.sp * 1.3 : m.sp * 0.55) + m.ph)) * m.s * (moving ? 0.16 : 0.07);
    const mark = m.mark > 0 ? Math.sin(Math.min(1, 1 - m.mark) * Math.PI) * m.s * 0.35 : 0;
    const y = m.y - hopH - mark;
    const h = (m.gloop ? m.s * 0.78 : m.s) * (m.late ? m.pop : 1);
    if (h < 1) return;
    const w = (h * cv.width) / cv.height;
    const squash = Math.sin(this.t * m.sp * 1.3 + m.ph);
    shadow(g, m.x, m.y + 2, w * 0.36, Math.max(3, h * 0.07), 0.3);
    g.save(); g.translate(m.x, y);
    if (moving && m.vx) g.rotate(Math.sin(this.t * m.sp + m.ph) * 0.08);
    g.scale((m.vx < 0 ? -1 : 1) * (1 + squash * 0.03), 1 - squash * 0.03);
    g.drawImage(cv, -w / 2, -h, w, h);
    g.restore();
    if (m.hat) this.drawHat(g, m.hat, m.x, y - h * 0.8, h * 0.3);
    if (m.mark === -1) { g.save(); g.translate(m.x, y - h * 0.5); g.strokeStyle = "#E8504F"; g.lineWidth = Math.max(4, h * 0.09); g.lineCap = "round"; const r = h * 0.3; g.beginPath(); g.moveTo(-r, -r); g.lineTo(r, r); g.moveTo(r, -r); g.lineTo(-r, r); g.stroke(); g.restore(); }
    if (m.num > 0) {
      const bs = clamp(h * 0.24, 11, 20), bx = m.x, by = y - h - bs * 0.6 - (m.hat ? h * 0.2 : 0);
      blob(g, bx, by, bs, bs, "#FFD25A", { gloss: 0.45 });
      g.font = `${bs * 1.1}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(String(m.num), bx, by + 1);
    }
  }

  private drawCurtain(g: G) {
    const I = this.inner, v = this.curtain.v;
    g.save(); rr(g, I.x, I.y, I.w, I.h, 12); g.clip();
    if (v > 0.001) {
      const hw = (I.w / 2) * ease.inOut(clamp(v, 0, 1)) + 2;
      for (const sd of [0, 1]) {
        const x0 = sd ? I.x + I.w - hw : I.x;
        const gr = g.createLinearGradient(x0, 0, x0 + hw, 0);
        gr.addColorStop(0, "#A81F2E"); gr.addColorStop(0.5, "#E8504F"); gr.addColorStop(1, "#A81F2E");
        g.fillStyle = gr; g.fillRect(x0, I.y, hw, I.h);
        g.strokeStyle = "rgba(0,0,0,0.14)"; g.lineWidth = 6;
        for (let x = x0 + 18; x < x0 + hw - 6; x += 30) { g.beginPath(); g.moveTo(x, I.y); g.quadraticCurveTo(x + 5, I.y + I.h * 0.5, x - 2, I.y + I.h); g.stroke(); }
        g.fillStyle = "rgba(255,255,255,0.08)";
        for (let x = x0 + 8; x < x0 + hw - 6; x += 30) g.fillRect(x, I.y, 6, I.h);
      }
      if (v > 0.95) {
        const fs = Math.min(64, I.h * 0.24);
        clayText(g, "?", I.x + I.w / 2, I.y + I.h * 0.45 + Math.sin(this.t * 3) * 4, fs * 1.4, { fill: "#FFD25A" });
      }
    }
    g.restore();
    // valance (scalloped top) always on
    const n = Math.max(6, Math.round(I.w / 48)), sw = I.w / n, vh = Math.min(26, I.h * 0.08);
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(I.x + i * sw, I.y - 2); g.lineTo(I.x + (i + 1) * sw, I.y - 2); g.lineTo(I.x + (i + 1) * sw, I.y + vh * 0.5);
      g.arc(I.x + (i + 0.5) * sw, I.y + vh * 0.5, sw / 2, 0, Math.PI); g.closePath();
      clayFill(g, i % 2 ? "#C9302C" : "#E8504F", I.x + (i + 0.5) * sw, I.y + vh * 0.4, sw * 0.6, { gloss: 0.25, rim: false });
    }
    for (let i = 0; i <= n; i++) blob(g, I.x + i * sw, I.y + vh * 0.5, 4, 4, "#FFD25A", { gloss: 0.6 });
  }

  private drawQ(g: G, live: boolean) {
    const Q = this.q;
    clayPanel(g, Q.x, Q.y, Q.w, Q.h, Q.h / 2, "#23305A", { lip: 6 });
    const tx = Q.x + Q.h * 1.7, ty = Q.y + (Q.h - 6) / 2;
    const showing = live && (this.phase === "show" || this.phase === "intro");
    const typing = live && this.keypad && (this.phase === "answer" || this.phase === "count");
    const txt = showing ? "Count the Momos!" : typing ? "How many?" : "How many Momos?";
    const fs = Math.min(Q.h * 0.42, (Q.w - Q.h * 1.7 - 74) / (typing ? 8.5 : 8.4), 26);
    clayText(g, txt, tx, ty, fs, { fill: "#FFD25A", align: "left" });
    if (typing) {
      g.font = `${fs}px ${FONT}`;
      const dx = tx + g.measureText(txt).width + 12, dh = Q.h - 18, dw = Math.min(84, Q.x + Q.w - 70 - dx);
      rr(g, dx, Q.y + 6, dw, dh, 10); g.fillStyle = "#FFF8EA"; g.fill();
      g.font = `${dh * 0.8}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY;
      g.fillText(this.typed || (Math.sin(this.t * 6) > 0 ? "_" : ""), dx + dw / 2, Q.y + 6 + dh / 2 + 1);
    }
    // hearts + progress on the right
    const hm = live ? this.heartsMax : 3, hv = live ? this.hearts : 3, r = Math.min(7, Q.h * 0.12);
    for (let i = 0; i < hm; i++) {
      const x = Q.x + Q.w - Q.h * 0.4 - i * r * 2.6, y = Q.y + Q.h * 0.3;
      g.beginPath(); g.moveTo(x, y + r * 0.85); g.bezierCurveTo(x - r * 1.35, y - r * 0.05, x - r * 0.65, y - r * 1.15, x, y - r * 0.42); g.bezierCurveTo(x + r * 0.65, y - r * 1.15, x + r * 1.35, y - r * 0.05, x, y + r * 0.85);
      clayFill(g, i < hv ? "#FF5C7A" : "#4A5580", x, y, r, { gloss: 0.4 });
    }
    const pn = live ? this.prompts : 6;
    for (let i = 0; i < pn; i++) { g.fillStyle = live && i < this.prompt ? "#FFD25A" : live && i === this.prompt ? "#FFFFFF" : "rgba(255,255,255,0.3)"; g.beginPath(); g.arc(Q.x + Q.w - Q.h * 0.4 - i * 9, Q.y + Q.h * 0.62, 3, 0, Math.PI * 2); g.fill(); }
    // host Momo presenting
    const H = this.hostR, mood = live ? this.hud.host.mood : "happy", ch = this.hostA.cheer;
    this.sprite(g, this.host(mood), H.x, H.y - Math.abs(Math.sin(this.t * 10)) * ch * 10, H.h, { sy: 1 + this.hostA.bop * 0.06 + Math.sin(this.t * 2.6) * 0.02, rot: Math.sin(this.t * 1.5) * 0.04 });
  }

  private drawKeys(g: G, live: boolean) {
    const active = live && this.phase === "answer";
    for (const k of this.keys) {
      const isAct = k.label === "✓" || k.label === "⌫";
      const col = k.state === "right" ? "#2FA866" : k.state === "wrong" ? "#E8504F" : this.keypad ? (k.label === "✓" ? "#2FA866" : k.label === "⌫" ? "#FF8A3D" : "#FFF4E2") : ["#FF8A3D", "#2EC4B6", "#9B5DE5", "#FF6F91"][this.keys.indexOf(k) % 4];
      g.save(); if (!active && k.state === "idle") g.globalAlpha = live ? 0.5 : 0.85;
      clayPanel(g, k.x, k.y, k.w, k.h, Math.min(22, k.h * 0.35), col, { lip: 7, pressed: k.press });
      const light = this.keypad && !isAct && k.state === "idle";
      const fs = Math.min(k.h * 0.55, this.keypad ? 32 : 46);
      clayText(g, k.label, k.x + k.w / 2, k.y + (k.h - 7) / 2 + k.press * 5, fs, { fill: light ? NAVY : "#FFFFFF", stroke: light ? "#FFFFFF" : darken(col, 0.45) });
      g.restore();
    }
  }

  private scene(g: G, live: boolean) {
    if (!this.bg || this.bg.width !== Math.round(this.W * this.dpr)) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    const I = this.inner;
    g.save(); rr(g, I.x, I.y, I.w, I.h, 12); g.clip();
    const list = [...this.mos].sort((a, b) => a.y - b.y);
    for (const m of list) this.drawMo(g, m);
    g.restore();
    this.drawCurtain(g);
    this.drawQ(g, live);
    this.drawKeys(g, live);
  }

  protected draw(g: G) { this.scene(g, true); }

  protected drawBackground(g: G) {
    if (!this.demo) {
      this.demo = true;
      this.keypad = false;
      this.layout();
      const I = this.inner, F = this.floor;
      this.mos = Array.from({ length: 6 }, (_, i) => ({
        gloop: i === 4, pose: i % POSES.length, hat: i === 2 ? "party" as Hat : i === 5 ? "crown" as Hat : null,
        x: 0, y: lerp(F.top + 30, F.bot, (i % 3) / 2), s: Math.min(80, I.h * 0.3), tx: I.x + I.w * (0.14 + i * 0.145), ty: 0, sx: 0, vx: 0, ph: i, sp: 8, at: 0, in: 1, late: false, on: true, num: 0, mark: 0, pop: 1,
      }));
      this.mos.forEach((m) => { m.x = m.tx; m.ty = m.y; });
      this.keys = [3, 4, 5, 6].map((v) => ({ label: String(v), v, x: 0, y: 0, w: 0, h: 0, press: 0, state: "idle" as const }));
      this.curtain.v = 0;
    }
    this.layout();
    for (const m of this.mos) if (m.in >= 1) m.x = m.tx;
    this.scene(g, false);
  }
}
