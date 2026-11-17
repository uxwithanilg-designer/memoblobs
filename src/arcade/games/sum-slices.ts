// Sum Slices — Bonbon's café. Bonbon holds up a number; tap cake slices on the big plate whose numbers add up
// to EXACTLY that number. Selected slices lift and glow and the running total shows in the middle of the plate.
// Go over and the slices flop back (bwomp). ~5 targets per level. Unlimited levels: bigger targets (5 → 99),
// more slices, "use exactly N slices" rounds, blue-icing MINUS slices and a spinning lazy-Susan plate.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta, type Tone } from "../engine";
import { blob, clayFill, clayPanel, clayText, rgba, rr, shadow, star, type G } from "../paint";

interface Slice { v: number; minus: boolean; sel: boolean; lift: number; c: string; deco: number; eat: number; drop: number; wob: number; flash: number }
type Phase = "intro" | "pick" | "flop" | "eat" | "done";
type Rule = "free" | "count";

const FLAVORS = ["#FF9CC2", "#FFF1C9", "#8B5A3C", "#9FE3C4", "#FFE15A", "#C9A0FF", "#FFB27A"];
const MINUS = "#6FB7FF";
const UNLOCK = {
  count: { easy: 6, medium: 4, hard: 2 },
  minus: { easy: 8, medium: 5, hard: 3 },
  spin: { easy: 10, medium: 7, hard: 5 },
};

export default class SumSlices extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "sum-slices", title: "Sum Slices", host: "bonbon", style: "rounds",
    music: { calm: "a:slices_calm", action: "a:slices_action" },
    sounds: ["a:nomnom", "a:plop", "a:page", "a:tink", "a:chime", "a:twinkle", "a:squelch", "a:creak", "a:register"],
    voicePitch: 1.25, transition: "curtain",
  };
  private slices: Slice[] = [];
  private order: number[] = [];
  private target = 10; private shown = 10;
  private rule: Rule = "free"; private k = 3;
  private minusOn = false; private spinOn = false;
  private spinV = 0; private rot = -Math.PI / 2;
  private phase: Phase = "intro";
  private ti = 0; private nTargets = 5;
  private mistakes = 0; private allowed = 2;
  private startT = 0;
  private focus = -1;
  private recent = new Recent(8);
  private ruleBag = new Bag<string>(["free", "count", "free", "count"]);
  private twistBag = new Bag<string>(["minus", "spin", "minus", "plain", "spin"]);
  private seen = new Set<string>();
  private sign = { flip: 0 };
  private bon = { chew: 0, hop: 0 };
  private hubPulse = { v: 0 };
  // layout
  private plate = { x: 0, y: 0, R: 150 };
  private board = { x: 0, y: 0, w: 160, h: 110 };
  private host2 = { x: 0, y: 0, h: 150 };
  private strip = { x: 0, y: 0, w: 300, h: 40 };
  private bg?: HTMLCanvasElement;
  private topSeen = 0; private sizeKey = "";
  private bulbs = Array.from({ length: 16 }, (_, i) => ({ c: ["#FFD25A", "#FF6F91", "#7CF2C9", "#7CC8FF", "#FF8A3D"][i % 5], p: i * 0.7 }));

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private layout() {
    if (this.W < 80 || this.H < 80) return; // not sized yet
    const key = `${this.W}x${this.H}`;
    if (key !== this.sizeKey) { this.sizeKey = key; this.topSeen = 0; }
    // the HUD grows/shrinks as hints come and go: lay out for its tallest size so the plate never jumps
    this.topSeen = Math.max(this.topSeen, this.insetTop);
    const A0 = this.area, A = { x: A0.x, y: this.topSeen, w: A0.w, h: Math.max(100, A0.y + A0.h - this.topSeen) }, W = this.W, portrait = W < this.H * 0.95;
    if (portrait) {
      const topH = clamp(A.h * 0.27, 150, 230);
      const bh = topH * 0.95;
      this.host2 = { x: Math.max(bh * 0.54, W * 0.22), y: A.y + topH, h: bh };
      const bx = this.host2.x + bh * 0.42, bw = Math.min(W - bx - 12, 230);
      this.board = { x: bx, y: A.y + 6, w: bw, h: Math.min(topH * 0.72, 150) };
      this.strip = { x: 12, y: A.y + topH + 6, w: W - 24, h: 42 };
      const top = this.strip.y + this.strip.h + 8, bot = A.y + A.h - 6;
      const R = Math.max(60, Math.min((W - 20) / 2 / 1.1, (bot - top) / 2 / 1.1));
      this.plate = { x: W / 2, y: top + (bot - top) / 2, R };
    } else {
      const colW = clamp(W * 0.36, 260, 420);
      this.board = { x: 16 + colW * 0.12, y: A.y + 10, w: colW * 0.76 - 20, h: clamp(A.h * 0.27, 110, 180) };
      this.strip = { x: 16, y: A.y + A.h - 52, w: colW - 20, h: 44 };
      const top = this.board.y + this.board.h + 8, bh = clamp(this.strip.y - 6 - top, 110, 300);
      this.host2 = { x: 16 + colW * 0.32, y: this.strip.y - 4, h: bh };
      const R = Math.max(60, Math.min((A.h - 20) / 2 / 1.1, (W - colW - 30) / 2 / 1.1));
      this.plate = { x: colW + (W - colW) / 2, y: A.y + A.h / 2, R };
    }
    this.bg = undefined; // tablecloth follows the plate
  }

  // ------------------------------------------------------------ level setup
  private has(f: keyof typeof UNLOCK) { return this.level >= byDiff(this.diff, UNLOCK[f]); }
  private tRange() {
    const L = this.level;
    const hi = Math.round(byDiff(this.diff, { easy: ramp(L, 10, 3, 99), medium: ramp(L, 18, 3.5, 99), hard: ramp(L, 25, 4, 99) }));
    return { lo: Math.max(4, Math.round(hi * 0.35)), hi };
  }
  private mRange(): [number, number] {
    const L = this.level;
    return byDiff(this.diff, {
      easy: (L < 3 ? [2, 2] : L < 9 ? [2, 3] : [2, 4]) as [number, number],
      medium: (L < 5 ? [2, 3] : L < 12 ? [2, 4] : [3, 4]) as [number, number],
      hard: (L < 4 ? [2, 3] : L < 8 ? [2, 4] : [3, 5]) as [number, number],
    });
  }
  private vRange() {
    const { hi } = this.tRange(), [, mx] = this.mRange();
    const vmax = clamp(Math.round(hi / (mx - 0.6)), 5, 40);
    return { vmin: Math.max(1, Math.round(vmax * 0.15)), vmax };
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = byDiff(d, { easy: Math.min(10, 6 + Math.floor((L - 1) / 3)), medium: Math.min(12, 8 + Math.floor((L - 1) / 3)), hard: Math.min(12, 8 + Math.floor((L - 1) / 2)) });
    // which twists are on this level
    let twist = "plain";
    if (this.has("minus") || this.has("spin")) {
      for (let i = 0; i < 6; i++) { twist = this.twistBag.next(this.rng); if ((twist !== "minus" || this.has("minus")) && (twist !== "spin" || this.has("spin"))) break; twist = "plain"; }
    }
    this.minusOn = twist === "minus" || (this.has("spin") && this.has("minus") && L >= byDiff(d, { easy: 16, medium: 12, hard: 9 }) && this.rng.chance(0.5));
    this.spinOn = twist === "spin";
    this.rule = this.has("count") && this.ruleBag.next(this.rng) === "count" ? "count" : "free";
    if (this.has("count") && L === byDiff(d, UNLOCK.count)) this.rule = "count";
    if (this.has("minus") && L === byDiff(d, UNLOCK.minus)) { this.minusOn = true; this.spinOn = false; }
    if (this.has("spin") && L === byDiff(d, UNLOCK.spin)) { this.spinOn = true; }
    const [mn, mx] = this.mRange();
    this.k = this.rule === "count" ? clamp(byDiff(d, { easy: this.rng.int(2, 3), medium: 3, hard: this.rng.int(3, 4) }), mn, Math.max(mn, mx)) : 0;
    this.spinV = this.spinOn ? byDiff(d, { easy: 0.16, medium: 0.22, hard: 0.3 }) * (this.rng.chance(0.5) ? 1 : -1) : 0;
    this.rot = -Math.PI / 2 - Math.PI / n;
    this.nTargets = d === "easy" && L <= 2 ? 4 : 5;
    this.allowed = byDiff(d, { easy: 3, medium: 2, hard: L < 6 ? 2 : 1 });
    this.mistakes = 0; this.ti = 0; this.order = []; this.focus = -1;
    this.slices = Array.from({ length: n }, () => this.newSlice());
    this.layout();
    this.phase = "intro";
    this.music(this.tRange().hi >= 40 || this.spinOn ? "action" : "calm");
    // announce twists
    const notes: [string, string, Tone, string][] = [];
    if (this.rule === "count") notes.push([`EXACTLY ${this.k}!`, `Use exactly ${this.k} slices each time`, "pink", `Only ${this.k} slices!`]);
    if (this.minusOn) notes.push(["MINUS SLICES!", "Blue icing takes away", "mint", "Blue slices subtract!"]);
    if (this.spinOn) notes.push(["LAZY SUSAN!", "The plate is spinning!", "gold", "Wheee, spinny plate!"]);
    if (notes.length) {
      const [t, s, tone, line] = notes[notes.length - 1];
      const first = !this.seen.has(t.split("!")[0].replace(/\d/g, ""));
      this.seen.add(t.split("!")[0].replace(/\d/g, ""));
      this.after(0.5, () => { this.banner(t, first ? s : undefined, tone); this.react("wow", line); this.sfx("a:twinkle", { gain: 0.5 }); });
    } else this.react("happy", this.rng.pick(["Cake maths time!", "Let's count cake!", "Fresh slices!", "Ready, chef?"]));
    this.after(notes.length ? 1.9 : 0.9, () => this.nextTarget(true));
  }

  private newSlice(): Slice {
    const { vmin, vmax } = this.vRange();
    const minus = this.minusOn && this.rng.chance(0.28) && this.slices.filter((s) => s.minus && !s.eat).length < 3;
    const v = minus ? this.rng.int(1, Math.max(2, Math.round(vmax * 0.4))) : this.rng.int(vmin, vmax);
    return { v, minus, sel: false, lift: 0, c: minus ? MINUS : this.rng.pick(FLAVORS), deco: this.rng.int(0, 3), eat: 0, drop: 0, wob: 0, flash: 0 };
  }

  /** choose a target that the plate can make (enumerates every subset — at most 12 slices) */
  private pickTarget(): number | null {
    const vals = this.slices.map((s) => (s.minus ? -s.v : s.v)), n = vals.length;
    const { lo, hi } = this.tRange(), [mn, mx] = this.mRange();
    const singles = new Set(vals);
    const pool: { T: number; m: number; minus: boolean }[] = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      let sum = 0, m = 0, plus = 0, neg = false;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += vals[i]; m++; if (vals[i] > 0) plus++; else neg = true; }
      if (this.rule === "count" ? m !== this.k : m < mn || m > mx) continue;
      if (plus === 0 || sum < lo || sum > hi || sum > 99) continue;
      if (this.rule === "free" && singles.has(sum)) continue;
      pool.push({ T: sum, m, minus: neg });
    }
    if (!pool.length) return null;
    const wantMinus = this.minusOn && this.rng.chance(0.6) && pool.some((p) => p.minus);
    let best: number | null = null;
    for (let tries = 0; tries < 30; tries++) {
      const c = this.rng.pick(pool);
      if (wantMinus && !c.minus) continue;
      if (!this.recent.has(String(c.T)) || tries > 24) { best = c.T; break; }
    }
    return best ?? this.rng.pick(pool).T;
  }

  private nextTarget(first = false) {
    let T = this.pickTarget();
    for (let i = 0; T === null && i < 8; i++) { this.slices = this.slices.map(() => this.newSlice()); T = this.pickTarget(); }
    this.target = T ?? 10;
    this.recent.add(String(this.target));
    this.order = []; this.phase = "pick"; this.startT = this.t;
    this.sign.flip = 0; this.tween(this.sign, { flip: 1 }, 0.5, ease.inOut);
    this.after(0.25, () => { this.shown = this.target; });
    this.sfx("a:page", { gain: 0.6 });
    this.bon.hop = 1;
    const k = this.rule === "count" ? ` with exactly ${this.k} slices` : "";
    this.hint(first && this.level === 1 && this.attempt === 0 ? `Tap slices that add up to ${this.target}!` : `Make ${this.target}${k}! 🍰`);
    if (first && this.level === 1 && this.attempt === 0) this.after(6, () => { if (this.phase === "pick" && this.ti === 0) this.hint("Tap a slice again to put it back 👆"); });
  }

  // ------------------------------------------------------------ input
  private total() { return this.order.reduce((s, i) => s + (this.slices[i].minus ? -this.slices[i].v : this.slices[i].v), 0); }

  private sliceAt(x: number, y: number) {
    const P = this.plate, dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy);
    if (d < P.R * 0.21) return -2;
    if (d > P.R * 1.12) return -1;
    const n = this.slices.length, step = (Math.PI * 2) / n;
    let a = Math.atan2(dy, dx) - this.rot;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(a / step) % n;
  }

  protected onDown(x: number, y: number) {
    if (this.phase !== "pick") return;
    const i = this.sliceAt(x, y);
    if (i === -2) { this.clearSel(); return; }
    if (i >= 0) this.toggle(i);
  }

  onKey(key: string) {
    if (this.phase !== "pick") return;
    const n = this.slices.length;
    if (key === "ArrowRight" || key === "ArrowDown") { this.focus = (this.focus + 1 + n) % n; this.sfx("a:tink", { gain: 0.25, rate: 1.4 }); }
    else if (key === "ArrowLeft" || key === "ArrowUp") { this.focus = (this.focus - 1 + n) % n; this.sfx("a:tink", { gain: 0.25, rate: 1.4 }); }
    else if ((key === "Enter" || key === "x" || key === "X") && this.focus >= 0) this.toggle(this.focus);
    else if (key === "Backspace" || key === "c" || key === "C") this.clearSel();
  }

  private clearSel() {
    if (!this.order.length) return;
    for (const i of this.order) { const s = this.slices[i]; s.sel = false; this.tween(s, { lift: 0 }, 0.25, ease.out); }
    this.order = [];
    this.sfx("a:tink", { gain: 0.4, rate: 0.8 });
  }

  private toggle(i: number) {
    const s = this.slices[i];
    if (s.eat > 0) return;
    const P = this.plate, mid = this.rot + ((i + 0.5) * Math.PI * 2) / this.slices.length;
    const sx = P.x + Math.cos(mid) * P.R * 0.6;
    if (s.sel) {
      s.sel = false; this.order = this.order.filter((j) => j !== i);
      this.tween(s, { lift: 0 }, 0.22, ease.out);
      this.sfx("a:tink", { x: sx, gain: 0.4, rate: 0.85 });
      return;
    }
    s.sel = true; this.order.push(i);
    this.tween(s, { lift: 1 }, 0.3, ease.back);
    this.tone(this.note(this.order.length + 4), 0.25, sx, 0.45);
    this.hubPulse.v = 1; this.tween(this.hubPulse, { v: 0 }, 0.3);
    const T = this.target, tot = this.total(), cnt = this.order.length;
    const minusLeft = this.slices.reduce((a, z, j) => a + (z.minus && !z.sel && !z.eat && !this.order.includes(j) ? z.v : 0), 0);
    if (tot === T && (this.rule === "free" || cnt === this.k)) this.success();
    else if (this.rule === "count" && cnt >= this.k) this.flop(tot > T ? "Too much cake!" : tot < T ? `That's only ${tot}!` : "Wrong slices!");
    else if (tot > T && (!this.minusOn || tot - minusLeft > T)) this.flop("Too much cake!");
  }

  private success() {
    this.phase = "eat";
    const n = this.order.length, P = this.plate;
    const speed = clamp(1 - (this.t - this.startT) / (4 + n * 2.5), 0, 1);
    this.good(P.x, P.y - P.R * 0.25, 30 + n * 10, speed);
    if (speed > 0.6) this.float("SPEEDY!", P.x, P.y + P.R * 0.2, "#7CF2C9", 24);
    this.sfx("a:chime", { gain: 0.6 });
    this.burst(P.x, P.y, { n: 18, colors: ["#7CF2C9", "#FFD25A", "#FFFFFF"], kind: "star", speed: 300 });
    const eaten = [...this.order];
    for (const i of eaten) { const s = this.slices[i]; s.flash = 1; this.tween(s, { eat: 1 }, 0.75, ease.inOut, 0.35); }
    this.after(0.95, () => { this.sfx("a:nomnom", { gain: 0.8 }); this.bon.chew = 1; this.react("happy", this.rng.pick(["Nom nom nom!", "Exactly right! Yum!", "Perfect maths, perfect cake!", "My tummy says yes!", "Mmm, numbers taste good!"]), false); });
    this.after(1.25, () => {
      // refill the empty spots with fresh slices that drop in
      for (const i of eaten) { const ns = this.newSlice(); ns.drop = 1; this.slices[i] = ns; this.tween(ns, { drop: 0 }, 0.45, ease.back, (i % 4) * 0.05); }
      this.sfx("a:plop", { gain: 0.5 });
      this.order = [];
      this.ti++;
      if (this.ti >= this.nTargets) {
        this.phase = "done"; this.hint(null);
        this.levelClear({ perfect: this.mistakes === 0, bonus: this.spinOn || this.minusOn ? 40 : 0 });
      } else this.after(0.35, () => this.nextTarget());
    });
  }

  private flop(line: string) {
    this.phase = "flop"; this.mistakes++;
    const P = this.plate;
    this.sfx("a:squelch", { gain: 0.6, delay: 0.1 });
    this.bad(P.x, P.y, { line });
    for (const i of this.order) { const s = this.slices[i]; s.wob = 1; this.tween(s, { lift: 0 }, 0.55, ease.elastic, 0.2); this.tween(s, { wob: 0 }, 0.8, ease.out); }
    const order = [...this.order];
    this.after(0.75, () => {
      for (const i of order) this.slices[i].sel = false;
      this.order = [];
      if (this.mistakes > this.allowed) { this.phase = "done"; this.levelFail("Too many flops!"); return; }
      this.phase = "pick";
      const left = this.allowed - this.mistakes;
      this.hint(left === 0 ? `Careful — last try! Make ${this.target} 🍰` : `Try again! Make ${this.target}${this.rule === "count" ? ` with ${this.k} slices` : ""}`);
    });
  }

  // ------------------------------------------------------------ simulation
  protected update(dt: number) {
    this.rot += this.spinV * dt;
    this.bon.chew = Math.max(0, this.bon.chew - dt * 0.9);
    this.bon.hop = Math.max(0, this.bon.hop - dt * 2.5);
    for (const s of this.slices) s.flash = Math.max(0, s.flash - dt * 1.5);
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const W = this.W, H = this.H, c = document.createElement("canvas");
    c.width = Math.round(W * this.dpr); c.height = Math.round(H * this.dpr);
    const g = c.getContext("2d")!; g.scale(this.dpr, this.dpr);
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#3A2650"); wall.addColorStop(1, "#24183A");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    // wallpaper diamonds
    g.fillStyle = "rgba(255,255,255,0.04)";
    for (let y = 0, r = 0; y < H; y += 40, r++) for (let x = (r % 2) * 20; x < W; x += 40) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.fill(); }
    // checkered tablecloth under the plate
    const P = this.plate, ty = P.y - P.R * 1.25, round = W > H * 0.95, TR = P.R * 1.32;
    if (round) { shadow(g, P.x, P.y + TR * 0.08, TR * 1.05, TR * 0.98, 0.45); }
    g.save(); g.beginPath(); if (round) g.arc(P.x, P.y, TR, 0, Math.PI * 2); else g.rect(0, ty, W, H - ty); g.clip();
    g.fillStyle = "#FFF4E8"; g.fillRect(0, ty, W, H - ty);
    const sq = clamp(P.R * 0.22, 24, 44);
    g.fillStyle = "rgba(232,80,79,0.85)";
    for (let y = ty, r = 0; y < H; y += sq, r++) for (let x = (r % 2) * sq; x < W; x += sq * 2) g.fillRect(x, y, sq, sq);
    g.fillStyle = "rgba(232,80,79,0.35)";
    for (let y = ty, r = 0; y < H; y += sq, r++) for (let x = ((r + 1) % 2) * sq; x < W; x += sq * 2) { g.fillRect(x, y + sq * 0.35, sq, sq * 0.3); g.fillRect(x + sq * 0.35, y, sq * 0.3, sq); }
    g.restore();
    if (round) {
      // scalloped round tablecloth edge
      const nS = Math.round((TR * Math.PI * 2) / 30);
      for (let k = 0; k < nS; k++) { const a = (k / nS) * Math.PI * 2; g.beginPath(); g.arc(P.x + Math.cos(a) * TR, P.y + Math.sin(a) * TR, 13, 0, Math.PI * 2); g.fillStyle = k % 2 ? "#FFF4E8" : "#E8504F"; g.fill(); }
    } else {
      g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(0, ty, W, 6);
      for (let x = 0; x < W + 30; x += 30) { g.beginPath(); g.arc(x + 15, ty, 15, 0, Math.PI); g.fillStyle = "#FFF4E8"; g.fill(); }
    }
    // framed cake pictures on the wall (only where there is room)
    const frames = W < H * 0.95 ? [] : [[P.x - P.R * 1.75, P.y - P.R * 0.55], [P.x + P.R * 1.75, P.y - P.R * 0.55], [P.x + P.R * 1.75, P.y + P.R * 0.45]];
    for (const [fx, fy] of frames) {
      if (fx + 40 > W || fx - 40 < W * 0.36) continue;
      rr(g, fx - 34, fy - 26, 68, 52, 8); g.fillStyle = "#D49452"; g.fill();
      rr(g, fx - 27, fy - 19, 54, 38, 5); g.fillStyle = "#FFE7F0"; g.fill();
      blob(g, fx, fy + 6, 16, 10, "#FF9CC2"); blob(g, fx, fy - 2, 12, 7, "#FFF6EA"); blob(g, fx, fy - 10, 4, 4, "#E8504F");
    }
    this.bg = c;
  }

  private drawLights(g: G) {
    const W = this.W, y0 = this.area.y - 6;
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 + Math.sin((x / W) * Math.PI * 3) * 10);
    g.stroke();
    this.bulbs.forEach((b, i) => {
      const x = ((i + 0.5) / this.bulbs.length) * W, y = y0 + Math.sin((x / W) * Math.PI * 3) * 10 + 8;
      const on = 0.6 + 0.4 * Math.sin(this.t * 2 + b.p);
      g.fillStyle = rgba(b.c, 0.25 * on); g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
      blob(g, x, y, 4.5, 6, b.c, { gloss: 0.6 });
    });
  }

  private wedge(g: G, i: number, n: number, R: number, r0: number) {
    const step = (Math.PI * 2) / n, gap = Math.min(0.05, step * 0.08);
    const a0 = this.rot + i * step + gap, a1 = this.rot + (i + 1) * step - gap;
    g.beginPath(); g.arc(0, 0, R, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath();
    return { a0, a1, mid: (a0 + a1) / 2 };
  }

  private drawSlice(g: G, i: number, s: Slice) {
    const P = this.plate, n = this.slices.length, R = P.R * 0.94, r0 = P.R * 0.22;
    const step = (Math.PI * 2) / n, mid = this.rot + (i + 0.5) * step;
    const cxm = Math.cos(mid) * R * 0.6, cym = Math.sin(mid) * R * 0.6;
    g.save(); g.translate(P.x, P.y);
    const lift = s.lift, wob = s.wob ? Math.sin(s.wob * 18) * 0.06 * s.wob : 0;
    let alpha = 1;
    if (s.eat > 0) {
      const u = s.eat, mx = this.host2.x - P.x, my = this.host2.y - this.host2.h * 0.55 - P.y;
      const px = lerp(cxm, mx, u), py = lerp(cym, my, u) - Math.sin(u * Math.PI) * P.R * 0.5, sc = 1 - u * 0.75;
      g.translate(px, py); g.rotate(u * 3); g.scale(sc, sc); g.translate(-cxm, -cym);
      alpha = 1 - clamp((u - 0.8) / 0.2, 0, 1);
    } else {
      const off = lift * P.R * 0.08;
      g.translate(Math.cos(mid) * off, Math.sin(mid) * off - lift * 6 - s.drop * P.R * 0.6);
      g.translate(cxm, cym); g.rotate(wob); g.scale(1 + lift * 0.05, 1 + lift * 0.05); g.translate(-cxm, -cym);
      alpha = 1 - s.drop * 0.8;
    }
    g.globalAlpha = alpha;
    // shadow under lifted slices
    if (lift > 0.05 && s.eat === 0) { g.save(); g.globalAlpha = 0.25 * lift; g.translate(0, 10 * lift); this.wedge(g, i, n, R, r0); g.fillStyle = "#1B1420"; g.fill(); g.restore(); }
    if (s.sel || s.flash > 0) { g.save(); g.shadowColor = s.flash > 0 ? "#7CF2C9" : "#FFD25A"; g.shadowBlur = 22; this.wedge(g, i, n, R, r0); g.fillStyle = s.flash > 0 ? "#7CF2C9" : "#FFD25A"; g.fill(); g.restore(); }
    // sponge body + frosting
    this.wedge(g, i, n, R, r0); clayFill(g, "#F2C27A", cxm, cym, R * 0.5, { gloss: 0.2 });
    this.wedge(g, i, n, R * 0.88, r0 + 2); clayFill(g, s.c, cxm, cym, R * 0.5, { gloss: 0.4 });
    // frosting drips along the crust
    const { a0, a1 } = this.wedge(g, i, n, R * 0.88, r0 + 2);
    for (let k = 1; k < 4; k++) {
      const a = lerp(a0, a1, k / 4), rr2 = R * (0.86 + (k % 2) * 0.04);
      blob(g, Math.cos(a) * rr2, Math.sin(a) * rr2, R * 0.035, R * 0.035, s.c, { gloss: 0.3 });
    }
    // decoration near the crust
    const dx = Math.cos(mid) * R * 0.8, dy = Math.sin(mid) * R * 0.8, ds = Math.max(4, R * 0.045 * Math.min(1, 8 / n * 1.2));
    if (s.minus) { for (let k = 0; k < 3; k++) star(g, dx + Math.cos(mid + 1.6) * (k - 1) * ds * 2, dy + Math.sin(mid + 1.6) * (k - 1) * ds * 2, ds, "#FFFFFF", k); }
    else if (s.deco === 0) blob(g, dx, dy, ds * 1.3, ds * 1.3, "#E8283A", { gloss: 0.7 });
    else if (s.deco === 1) { blob(g, dx, dy, ds * 1.4, ds * 1.1, "#FFFFFF", { gloss: 0.4 }); blob(g, dx, dy - ds * 0.6, ds * 0.8, ds * 0.7, "#FFFFFF"); }
    else if (s.deco === 2) { const cols = ["#7CC8FF", "#FFD25A", "#74C94E", "#FF6F91"]; for (let k = 0; k < 6; k++) { g.save(); g.translate(dx + Math.cos(k * 2.2) * ds * 1.4, dy + Math.sin(k * 1.7) * ds * 1.2); g.rotate(k); g.fillStyle = cols[k % 4]; g.fillRect(-ds * 0.6, -ds * 0.2, ds * 1.2, ds * 0.4); g.restore(); } }
    else blob(g, dx, dy, ds * 1.2, ds * 1.5, "#FF4F6A", { gloss: 0.5, rot: mid });
    // number
    const fs = clamp(R * (n <= 6 ? 0.2 : n <= 8 ? 0.17 : n <= 10 ? 0.15 : 0.13), 18, 56);
    const label = (s.minus ? "−" : "") + s.v;
    const nx = Math.cos(mid) * R * 0.56, ny = Math.sin(mid) * R * 0.56;
    clayText(g, label, nx, ny, label.length > 2 ? fs * 0.86 : fs, { fill: s.minus ? "#FFFFFF" : s.sel ? "#FFD25A" : "#FFFFFF", stroke: s.minus ? "#1E4F8F" : "#23305A" });
    // keyboard focus ring
    if (this.focus === i && this.phase === "pick") { this.wedge(g, i, n, R + 3, r0 - 2); g.strokeStyle = "#7CF2FF"; g.lineWidth = 4; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]); }
    g.restore();
  }

  private drawPlate(g: G) {
    const P = this.plate, R = P.R;
    shadow(g, P.x, P.y + R * 0.1, R * 1.15, R * 1.0, 0.35);
    g.beginPath(); g.arc(P.x, P.y, R * 1.08, 0, Math.PI * 2); clayFill(g, "#FFFFFF", P.x, P.y, R * 1.08, { gloss: 0.4 });
    g.beginPath(); g.arc(P.x, P.y, R * 0.99, 0, Math.PI * 2); g.fillStyle = "#EEF3FA"; g.fill();
    g.strokeStyle = "rgba(124,200,255,0.5)"; g.lineWidth = 3; g.beginPath(); g.arc(P.x, P.y, R * 1.035, 0, Math.PI * 2); g.stroke();
    if (this.spinOn) { // lazy-Susan arrows
      g.save(); g.translate(P.x, P.y); g.rotate(this.rot * 0.999);
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.fillStyle = "rgba(124,200,255,0.65)"; g.beginPath(); g.moveTo(R * 1.035, -6); g.lineTo(R * 1.035 + 7 * Math.sign(this.spinV || 1), 0); g.lineTo(R * 1.035, 6); g.closePath(); g.fill(); }
      g.restore();
    }
    this.slices.forEach((s, i) => { if (!s.sel && s.eat === 0) this.drawSlice(g, i, s); });
    this.slices.forEach((s, i) => { if (s.sel && s.eat === 0) this.drawSlice(g, i, s); });
    // hub with the running total (tap it to put everything back)
    const tot = this.total(), T = this.target, hr = R * 0.22 * (1 + this.hubPulse.v * 0.12);
    const col = !this.order.length ? "#FFFFFF" : tot === T ? "#7CF2C9" : tot > T ? "#FF8FA3" : "#FFE7A8";
    g.beginPath(); g.arc(P.x, P.y, hr, 0, Math.PI * 2); clayFill(g, col, P.x, P.y, hr, { gloss: 0.5 });
    g.strokeStyle = "rgba(35,48,90,0.2)"; g.lineWidth = 2; g.stroke();
    if (this.order.length) clayText(g, String(tot), P.x, P.y + 1, clamp(hr * 0.95, 16, 44), { fill: "#FFFFFF", stroke: "#23305A" });
    else blob(g, P.x, P.y, hr * 0.35, hr * 0.35, "#E8283A", { gloss: 0.7 });
  }

  private drawBoard(g: G) {
    const B = this.board, u = this.sign.flip, sy = Math.abs(Math.cos(u * Math.PI));
    const live = this.hud.status === "playing" || this.hud.status === "over";
    // stick down to Bonbon's paw
    const hx = this.host2.x + this.host2.h * 0.3, hy = this.host2.y - this.host2.h * 0.5;
    const bob = Math.sin(this.t * 2.2) * 3 - Math.sin(this.bon.hop * Math.PI) * 8;
    g.strokeStyle = "#B97A45"; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(B.x + B.w * 0.25, B.y + B.h + bob - 4); g.stroke();
    g.save(); g.translate(B.x + B.w / 2, B.y + B.h / 2 + bob); g.scale(1, Math.max(0.04, sy)); g.rotate(Math.sin(this.t * 1.7) * 0.02);
    clayPanel(g, -B.w / 2, -B.h / 2, B.w, B.h, 18, "#FFF4E2", { lip: 7 });
    rr(g, -B.w / 2 + 6, -B.h / 2 + 5, B.w - 12, B.h - 18, 13); g.strokeStyle = "#FF9CC2"; g.lineWidth = 3; g.setLineDash([7, 5]); g.stroke(); g.setLineDash([]);
    clayText(g, "MAKE", 0, -B.h * 0.3, clamp(B.h * 0.15, 13, 22), { fill: "#FF6F91", stroke: "#FFFFFF", gloss: false });
    const big = clamp(B.h * 0.48, 34, 84);
    clayText(g, live || this.shown ? String(this.shown) : "10", 0, B.h * 0.06, big, { fill: "#FFD25A" });
    if (this.rule === "count" && live) {
      const yy = B.h * 0.36;
      clayText(g, `with ${this.k} slices`, 0, yy, clamp(B.h * 0.12, 11, 18), { fill: "#23305A", stroke: "#FFF4E2", gloss: false });
    }
    g.restore();
  }

  private drawStrip(g: G) {
    const S = this.strip;
    rr(g, S.x, S.y, S.w, S.h, S.h / 2); g.fillStyle = "rgba(20,12,36,0.55)"; g.fill();
    const parts: { t: string; c: string }[] = [];
    this.order.forEach((i, k) => {
      const s = this.slices[i];
      if (k > 0 || s.minus) parts.push({ t: s.minus ? "−" : "+", c: "#FFFFFF" });
      parts.push({ t: String(s.v), c: s.minus ? "#9FD1FF" : "#FFE7A8" });
    });
    const tot = this.total(), T = this.target;
    const fs = clamp(S.h * 0.55, 16, 26);
    if (!parts.length) {
      clayText(g, this.rule === "count" ? `Pick ${this.k} slices → ${T}` : `Pick slices → ${T}`, S.x + S.w / 2, S.y + S.h / 2 + 1, fs * 0.8, { fill: "rgba(255,255,255,0.75)", stroke: "rgba(20,12,36,0.6)", gloss: false });
      return;
    }
    parts.push({ t: "=", c: "#FFFFFF" }, { t: String(tot), c: tot === T ? "#7CF2C9" : tot > T ? "#FF8FA3" : "#FFFFFF" });
    g.font = `${fs}px "Lilita One", system-ui, sans-serif`;
    const gap = fs * 0.32;
    let w = parts.reduce((a, p) => a + g.measureText(p.t).width + gap, -gap);
    const scale = Math.min(1, (S.w - 24) / w);
    w *= scale;
    let x = S.x + S.w / 2 - w / 2;
    for (const p of parts) {
      const pw = g.measureText(p.t).width * scale;
      clayText(g, p.t, x + pw / 2, S.y + S.h / 2 + 1, fs * scale, { fill: p.c, gloss: false });
      x += pw + gap * scale;
    }
  }

  private drawBonbon(g: G) {
    const b = this.host2, mood = this.hud.status === "lobby" ? "happy" : this.hud.host.mood, ch = this.bon.chew;
    shadow(g, b.x, b.y - 4, b.h * 0.35, b.h * 0.06, 0.3);
    this.sprite(g, this.host(mood), b.x, b.y, b.h, { sy: 1 + Math.sin(ch * Math.PI * 8) * 0.05 * ch + Math.sin(this.t * 2.6) * 0.012 - Math.sin(this.bon.hop * Math.PI) * 0.03, sx: 1 - Math.sin(ch * Math.PI * 8) * 0.03 * ch });
  }

  private drawProgress(g: G) {
    // little cake icons: how many targets are done this level
    const n = this.nTargets, P = this.plate, y = P.y + P.R * 1.12 + 14;
    if (y > this.H - this.insetBottom - 6) return;
    for (let i = 0; i < n; i++) {
      const x = P.x + (i - (n - 1) / 2) * 26;
      g.globalAlpha = i < this.ti ? 1 : 0.35;
      blob(g, x, y, 9, 7, i < this.ti ? "#FF9CC2" : "#FFFFFF", { gloss: 0.4 });
      if (i < this.ti) blob(g, x, y - 7, 3, 3, "#E8283A");
      g.globalAlpha = 1;
    }
  }

  private scene(g: G) {
    if (!this.bg) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawLights(g);
    this.drawPlate(g);
    this.drawProgress(g);
    this.drawBonbon(g);
    this.drawBoard(g);
    this.drawStrip(g);
    // slices flying to Bonbon's mouth go on top
    this.slices.forEach((s, i) => { if (s.eat > 0) this.drawSlice(g, i, s); });
  }

  protected drawBackground(g: G) {
    if (!this.slices.length) {
      const demo = [3, 5, 2, 7, 4, 1, 6, 8];
      this.slices = demo.map((v, i) => ({ v, minus: false, sel: i === 1 || i === 3, lift: i === 1 || i === 3 ? 1 : 0, c: FLAVORS[i % FLAVORS.length], deco: i % 4, eat: 0, drop: 0, wob: 0, flash: 0 }));
      this.order = [1, 3]; this.target = 12; this.shown = 12; this.sign.flip = 1;
      this.rot = -Math.PI / 2 - Math.PI / 8;
      this.layout();
    }
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}

