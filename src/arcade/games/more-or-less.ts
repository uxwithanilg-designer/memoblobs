// More or Less — Turbo's candy shop. Two (later three) glass jars of clay jelly beans: tap the jar with MORE,
// quick! Turbo the rocket snail crawls along the timer track — if he reaches the flag, time's up.
// Unlimited levels: closer ratios (2:1 → 10:9), less time, then LESS rounds, three jars, BIG beans
// (the fuller-looking jar isn't always right), shaken-up beans, odd jar shapes and wobbly jars.
import { ArcadeGame, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { FONT, NAVY, blob, clayFill, clayPanel, clayText, darken, rgba, rr, shadow, star, type G } from "../paint";

const BEAN_C = ["#E8504F", "#FF8A3D", "#FFD25A", "#5DBB46", "#FF6F91", "#9B5DE5", "#3B82F6", "#FFF4E2"];
const LIDS = ["#FF6F91", "#2EC4B6", "#9B5DE5", "#FF8A3D", "#3B82F6"];
type Shape = "classic" | "round" | "tall";
interface Bean { x: number; y: number; r: number; rot: number; c: number; ph: number }
interface Jar {
  n: number; beans: Bean[]; shape: Shape; lid: string; big: boolean;
  x: number; y: number; w: number; h: number;
  in: number; out: number; press: number; wig: number; badge: number; state: "idle" | "right" | "wrong" | "answer"; ph: number;
}
type Phase = "enter" | "answer" | "result" | "done";
type Twist = "less" | "three" | "big" | "wobble" | "scatter";

export default class MoreOrLess extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "more-or-less", title: "More or Less", host: "turbo", style: "rounds",
    music: { calm: "a:jars_calm", action: "a:jars_action" },
    sounds: ["a:rocket", "a:tink", "a:crunch", "a:squeak", "a:wobble", "a:gong", "a:tickHi", "a:twinkle", "a:honk", "a:scramble", "a:slideUp", "a:slideDown", "boing", "pop", "v:turbo_laugh"],
    voicePitch: 1.4, transition: "iris",
  };
  private jars: Jar[] = [];
  private old: Jar[] = [];
  private more = true;
  private answer = 0;
  private tw = { less: false, three: false, big: false, wobble: false, scatter: false };
  private phase: Phase = "enter";
  private prompt = 0; private prompts = 10;
  private hearts = 3; private heartsMax = 3; private misses = 0;
  private limit = 6; private el = 0;
  private tb = { p: 0, boost: 0, spin: 0, max: 0 };
  private signFlip = { v: 1 };
  private seenEver = new Set<Twist>();
  private recent = new Recent(40);
  private track = { x: 0, y: 0, w: 300, h: 60 };
  private sign = { x: 0, y: 0, w: 300, h: 54 };
  private foot = { x: 0, y: 0, w: 300, h: 28 };
  private zone = { x: 0, y: 0, w: 300, h: 300 };
  private beanImg: HTMLCanvasElement[] = [];
  private bg?: HTMLCanvasElement;
  private pid = 0;

  protected onResize() { this.layout(); this.bg = undefined; }

  // ------------------------------------------------------------ layout
  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H;
    const colW = Math.min(W - 16, 980), x0 = (W - colW) / 2;
    const trackH = portrait ? clamp(A.h * 0.1, 54, 72) : clamp(A.h * 0.12, 60, 86);
    this.track = { x: x0, y: A.y + 2, w: colW, h: trackH };
    const sh = portrait ? clamp(A.h * 0.085, 46, 60) : clamp(A.h * 0.1, 52, 68);
    const sw = Math.min(colW, 420);
    this.sign = { x: W / 2 - sw / 2, y: this.track.y + trackH + 8, w: sw, h: sh };
    this.foot = { x: x0, y: A.y + A.h - 26, w: colW, h: 26 };
    this.zone = { x: x0, y: this.sign.y + sh + 12, w: colW, h: this.foot.y - (this.sign.y + sh + 12) - 8 };
    this.layoutJars(this.jars);
  }

  private layoutJars(js: Jar[]) {
    const n = js.length || 2, Z = this.zone, gap = n === 3 ? 10 : 22;
    const w = Math.min((Z.w - gap * (n - 1)) / n, Z.h * (n === 2 ? 0.7 : 0.56), 300);
    const h = Math.min(Z.h, w * (n === 3 ? 2.3 : 1.85));
    js.forEach((j, k) => { j.w = w; j.h = h; j.x = this.W / 2 + (k - (n - 1) / 2) * (w + gap) - w / 2; j.y = Z.y + Z.h - h; });
  }

  /** jar body geometry relative to the jar's bottom-centre */
  private geo(j: Jar) {
    const lidH = j.h * 0.075, neckH = j.h * 0.06;
    const k = { classic: [0.86, 1.0], round: [0.98, 0.78], tall: [0.66, 1.0] }[j.shape];
    const bw = j.w * k[0], bh = (j.h - lidH - neckH) * k[1];
    const nw = bw * (j.shape === "tall" ? 0.86 : 0.7);
    const wall = Math.max(4, bw * 0.045);
    return { bw, bh, nw, neckH, lidH, wall, iw: bw - wall * 2, ih: bh - wall * 2.4, r: Math.min(bw * 0.24, 40) };
  }

  // ------------------------------------------------------------ beans
  private makeBeanImgs() {
    this.beanImg = BEAN_C.map((c) => {
      const cv = document.createElement("canvas");
      cv.width = 72; cv.height = 50;
      const g = cv.getContext("2d")!;
      g.translate(36, 25);
      g.beginPath();
      // a jelly-bean kidney shape
      g.moveTo(-30, 2); g.bezierCurveTo(-32, -22, -6, -22, 0, -12); g.bezierCurveTo(6, -22, 32, -22, 30, 2); g.bezierCurveTo(28, 24, -28, 24, -30, 2); g.closePath();
      clayFill(g, c, 0, 0, 30, { gloss: 0.5 });
      g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(-12, -8, 9, 3.5, -0.3, 0, Math.PI * 2); g.fill();
      return cv;
    });
  }

  private fillJar(j: Jar, rFrac: number, scatter: boolean) {
    const G = this.geo(j), aspect = G.ih / G.iw;
    let r = rFrac;
    const beans: Bean[] = [];
    if (!scatter) {
      for (let it = 0; it < 40; it++) {
        const per = Math.max(1, Math.floor(1 / (2.1 * r))), rows = Math.ceil(j.n / per);
        if (rows * 1.6 * r + r <= aspect * 0.94) break;
        r *= 0.94;
      }
      const per = Math.max(1, Math.floor(1 / (2.1 * r))), sp = 1 / per;
      let left = j.n;
      for (let row = 0; left > 0; row++) {
        const k = Math.min(per, left);
        const cols = this.rng.shuffle([...Array(per).keys()]).slice(0, k);
        for (const c of cols) {
          const off = row % 2 ? sp * 0.25 : -sp * 0.25;
          beans.push({ x: clamp((c + 0.5) * sp + off + this.rng.range(-0.15, 0.15) * sp, r, 1 - r), y: (r * 0.95 + row * 1.6 * r + this.rng.range(-0.2, 0.2) * r) / aspect, r, rot: this.rng.range(-0.7, 0.7) + (this.rng.chance(0.5) ? Math.PI : 0), c: this.rng.int(0, BEAN_C.length - 1), ph: this.rng.range(0, 6) });
        }
        left -= k;
      }
    } else {
      for (let it = 0; it < 30 && j.n * 4.4 * r * r > aspect * 0.8; it++) r *= 0.94;
      for (let i = 0; i < j.n; i++) {
        let best = { x: 0.5, y: 0.5, d: -1 };
        for (let tr = 0; tr < 30; tr++) {
          const x = this.rng.range(r * 1.1, 1 - r * 1.1), y = this.rng.range(r * 1.1, aspect * 0.97 - r * 1.1);
          const d = beans.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.y * aspect - y)), 9);
          if (d > best.d) best = { x, y, d };
          if (d > r * 2.2) break;
        }
        beans.push({ x: best.x, y: best.y / aspect, r, rot: this.rng.range(0, Math.PI * 2), c: this.rng.int(0, BEAN_C.length - 1), ph: this.rng.range(0, 6) });
      }
    }
    j.beans = beans;
  }

  // ------------------------------------------------------------ levels
  private lv(e: number, m: number, h: number) { return this.level >= byDiff(this.diff, { easy: e, medium: m, hard: h }); }

  protected setupLevel() {
    const d = this.diff;
    if (!this.beanImg.length) this.makeBeanImgs();
    this.prompt = 0; this.prompts = 10; this.misses = 0;
    this.heartsMax = byDiff(d, { easy: 3, medium: 3, hard: 2 }); this.hearts = this.heartsMax;
    this.old = []; this.jars = [];
    this.tb.p = 0; this.tb.max = 0;
    this.music(this.level >= byDiff(d, { easy: 6, medium: 4, hard: 2 }) ? "action" : "calm");
    this.react("happy", this.rng.pick(["Ready, set… CANDY!", "Which jar has more? Quick!", "I'm the fastest snail! Kinda.", "Jelly bean time!"]));
    this.after(0.5, () => this.newPrompt());
  }

  private newPrompt() {
    const L = this.level, d = this.diff;
    const less = this.lv(4, 3, 2) && this.rng.chance(0.35);
    const three = this.lv(7, 5, 3) && this.rng.chance(0.35);
    const big = this.lv(10, 7, 5) && this.rng.chance(0.35);
    const wobble = this.lv(13, 9, 7) && this.rng.chance(0.3);
    const scatter = this.lv(8, 6, 4) && this.rng.chance(0.4);
    const shapes = this.lv(6, 4, 2);
    this.tw = { less, three, big, wobble, scatter };
    const ratio = byDiff(d, { easy: ramp(L, 2.0, -0.07, 1.3), medium: ramp(L, 1.8, -0.06, 1.2), hard: ramp(L, 1.6, -0.05, 1.11) }) * this.rng.range(1, 1.1);
    const hi = byDiff(d, { easy: ramp(L, 8, 1.5, 30), medium: ramp(L, 12, 2, 40), hard: ramp(L, 15, 2.5, 50) });
    const n = three ? 3 : 2;
    let counts: number[] = [];
    for (let tries = 0; tries < 20; tries++) {
      // sorted descending; the "close pair" is the answer + its nearest rival
      const top = this.rng.int(Math.max(4, Math.ceil(hi * 0.55)), Math.max(5, Math.round(hi)));
      let c: number[];
      if (!less) {
        const second = clamp(Math.round(top / ratio), 1, top - 1);
        c = [top, second];
        if (n === 3) c.push(clamp(Math.round(second / this.rng.range(1.3, 1.8)), 1, second - 1));
      } else {
        const low = Math.max(2, Math.round(top / (ratio * (n === 3 ? 1.6 : 1))));
        const second = Math.max(low + 1, Math.round(low * ratio));
        c = [low, second];
        if (n === 3) c.push(Math.min(60, Math.max(second + 1, Math.round(second * this.rng.range(1.3, 1.7)))));
      }
      if (new Set(c).size !== c.length || c.some((v) => v < 1)) continue;
      counts = this.rng.shuffle(c);
      const sig = counts.join(",") + (less ? "L" : "M");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    if (!counts.length) counts = this.rng.shuffle([8, 4]);
    const target = less ? Math.min(...counts) : Math.max(...counts);
    this.answer = counts.indexOf(target);
    this.more = !less;
    const lid0 = this.rng.int(0, LIDS.length - 1), shape0 = this.rng.pick(["classic", "round", "tall"] as Shape[]);
    this.old = this.jars;
    for (const j of this.old) this.tween(j, { out: 1 }, 0.35, ease.in);
    this.jars = counts.map((c, k) => ({
      n: c, beans: [], shape: shapes ? this.rng.pick(["classic", "round", "tall"] as Shape[]) : n === 3 ? "tall" : shape0, lid: LIDS[(lid0 + k) % LIDS.length], big: false,
      x: 0, y: 0, w: 0, h: 0, in: 0, out: 0, press: 0, wig: 0, badge: 0, state: "idle" as const, ph: this.rng.range(0, 6),
    }));
    this.layout();
    // bean size: same for every jar so the biggest pile fits; BIG twist = one jar gets chunky beans
    let trap = -1;
    if (big) {
      const rivals = this.jars.map((_, k) => k).filter((k) => k !== this.answer);
      trap = this.rng.chance(0.75) ? (less ? this.answer : this.rng.pick(rivals)) : (less ? this.rng.pick(rivals) : this.answer);
      this.jars[trap].big = true;
    }
    const base = Math.min(0.2, ...this.jars.map((j) => { const G = this.geo(j); return Math.sqrt((0.86 * (G.ih / G.iw)) / (3.4 * j.n * (j.big ? 2.1 : 1))); }));
    this.jars.forEach((j) => this.fillJar(j, base * (j.big ? 1.45 : 1), scatter));
    this.limit = byDiff(d, { easy: ramp(L, 6.5, -0.25, 3.2), medium: ramp(L, 5.5, -0.25, 2.6), hard: ramp(L, 4.5, -0.2, 2.1) }) + (three ? 1 : 0) + (scatter ? 0.5 : 0);
    this.phase = "enter"; this.pid++; this.el = 0;
    const id = this.pid;
    this.jars.forEach((j, k) => { this.tween(j, { in: 1 }, 0.45, ease.back, 0.12 + k * 0.08); this.sfx("a:tink", { gain: 0.35, delay: 0.4 + k * 0.08, rate: 1 + k * 0.1, x: j.x + j.w / 2 }); });
    // the MORE / LESS sign flips when the rule changes
    const flip = this.prompt === 0 || this.signWasMore !== this.more || this.signWasThree !== three;
    this.signWasMore = this.more; this.signWasThree = three;
    if (flip) { this.signFlip.v = 0; this.tween(this.signFlip, { v: 1 }, 0.4, ease.back); this.sfx(less ? "a:slideDown" : "a:slideUp", { gain: 0.35 }); }
    // twist announcements (first time in a session) + a hint every time
    const all: [Twist, boolean, string, string][] = [
      ["less", less, "LESS!", "Now tap the jar with FEWER beans"], ["three", three, "THREE JARS!", "Find the most (or least) of three"],
      ["big", big, "BIG BEANS!", "Big beans fill a jar fast — count, don't guess!"], ["scatter", scatter, "SHAKE UP!", "The beans are all jumbled up"],
      ["wobble", wobble, "WOBBLE JARS!", "The jars won't keep still!"]];
    const fresh = all.find(([k, on]) => on && !this.seenEver.has(k));
    let wait = 0.55;
    if (fresh) { this.seenEver.add(fresh[0]); this.banner(fresh[2], fresh[3], fresh[0] === "less" ? "pink" : "mint"); this.sfx("a:twinkle", { gain: 0.5 }); this.react("wow", this.rng.pick(["Whoa, a twist!", "Ooh, tricky beans!", "Hold on to your shell!"])); wait = 1.7; }
    this.hint(less ? (three ? "Tap the jar with the LEAST beans 👇" : "Tap the jar with LESS beans 👇") : three ? "Tap the jar with the MOST beans 👆" : "Tap the jar with MORE beans 👆");
    this.tb.max = 0;
    this.after(wait, () => { if (id === this.pid) { this.phase = "answer"; this.el = 0; } });
  }
  private signWasMore = true; private signWasThree = false;

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = key === "ArrowLeft" ? 0 : key === "ArrowRight" ? this.jars.length - 1 : key === "ArrowDown" || key === "ArrowUp" ? (this.jars.length === 3 ? 1 : -1) : Number(key) - 1;
    if (k >= 0 && k < this.jars.length) this.choose(k);
  }

  protected onDown(x: number, y: number) {
    const k = this.jars.findIndex((j) => x >= j.x - 4 && x <= j.x + j.w + 4 && y >= j.y - 10 && y <= j.y + j.h + 10);
    if (k >= 0) this.choose(k);
  }

  private choose(k: number) {
    const j = this.jars[k];
    if (this.phase !== "answer") { if (this.phase === "enter" && j) { j.wig = 1; this.sfx("a:tink", { gain: 0.25 }); } return; }
    this.phase = "result";
    j.press = 1; this.tween(j, { press: 0 }, 0.35, ease.out);
    const cx = j.x + j.w / 2, cy = j.y + j.h * 0.45;
    for (const o of this.jars) this.tween(o, { badge: 1 }, 0.35, ease.back, 0.15);
    if (k === this.answer) {
      j.state = "right";
      const speed = clamp(1 - this.el / this.limit, 0, 1);
      this.good(cx, cy - j.h * 0.3, 50 + (this.tw.three ? 15 : 0) + (this.tw.big ? 15 : 0), speed);
      this.burst(cx, j.y + j.h * 0.2, { n: 16, colors: BEAN_C, kind: "dot", speed: 300, size: 6 });
      this.sfx("a:crunch", { gain: 0.35, delay: 0.1 });
      this.tb.boost = 1; this.sfx("a:rocket", { gain: 0.45, delay: 0.15 });
      this.tween(this.tb, { p: 0 }, 0.7, ease.inOut, 0.2);
      if (speed > 0.7 && this.combo % 4 !== 0 && this.rng.chance(0.35)) this.react("wow", this.rng.pick(["Zoom zoom!", "Faster than a rocket!", "WHOA, speedy!", "Rocket brain!"]), false);
      this.after(0.95, () => this.next());
    } else {
      j.state = "wrong"; j.wig = 1;
      this.jars[this.answer].state = "answer";
      this.misses++; this.hearts--;
      this.tb.spin = 1; this.sfx("a:squeak", { gain: 0.5 });
      this.bad(cx, cy, { line: this.rng.pick(this.more ? ["Oops! The other jar had more!", "Count again, buddy!", "My shell is spinning!", "Not that one!"] : ["Oops! That one had more!", "LESS means fewer!", "Not that one!", "Uh-oh, beans!"]) });
      this.tween(this.tb, { p: 0 }, 0.9, ease.inOut, 0.6);
      this.after(1.6, () => this.next());
    }
  }

  private timeUp() {
    this.phase = "result";
    this.misses++; this.hearts--;
    this.jars[this.answer].state = "answer";
    for (const o of this.jars) this.tween(o, { badge: 1 }, 0.35, ease.back, 0.1);
    this.sfx("a:gong", { gain: 0.45 }); this.sfx("a:honk", { gain: 0.4, delay: 0.25 }); this.sfx("v:turbo_laugh", { gain: 0.6, delay: 0.4, duck: false });
    this.bad(this.W / 2, this.zone.y + 30, { line: this.rng.pick(["I WON?! I never win!", "Too slow… even for a snail!", "Beat ya! Hee hee!", "Finish line! …Oops."]) });
    this.tween(this.tb, { p: 0 }, 0.9, ease.inOut, 0.8);
    this.after(1.8, () => this.next());
  }

  private next() {
    if (this.hearts <= 0) { this.phase = "done"; this.levelFail(this.more ? "Look for the jar with MORE!" : "Look for the jar with LESS!"); return; }
    this.prompt++;
    if (this.prompt >= this.prompts) {
      this.phase = "done";
      for (const j of this.jars) this.tween(j, { out: 1 }, 0.35, ease.in);
      this.levelClear({ perfect: this.misses === 0, title: this.misses === 0 ? "SWEET!" : undefined });
      return;
    }
    if (this.prompt === 6) this.music("action");
    this.newPrompt();
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    this.tb.boost = Math.max(0, this.tb.boost - dt * 1.1);
    this.tb.spin = Math.max(0, this.tb.spin - dt * 0.9);
    for (const j of this.jars) j.wig = Math.max(0, j.wig - dt * 2);
    if (this.phase === "answer") {
      this.el += dt;
      this.tb.p = clamp(this.el / this.limit, 0, 1);
      this.tb.max = Math.max(this.tb.max, this.tb.p);
      const left = this.limit - this.el;
      if (left < 1.5 && Math.floor(left * 2) !== Math.floor((left + dt) * 2)) this.sfx("a:tickHi", { gain: 0.3 });
      if (this.el >= this.limit) this.timeUp();
    }
    if (this.tb.boost > 0.3 && Math.random() < dt * 30) {
      const T = this.turboPos();
      this.particles.push({ x: T.x - T.w * 0.45, y: T.y - T.h * 0.45, vx: -60 - Math.random() * 80, vy: (Math.random() - 0.5) * 40, life: 0.6, max: 0.6, size: 4 + Math.random() * 5, color: Math.random() < 0.5 ? "#FFD25A" : "#FF8A3D", kind: "dot", rot: 0, vr: 0, g: -30 });
    }
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H;
    // candy-shop wallpaper: pastel stripes with polka dots
    for (let x = 0, i = 0; x < W; x += 30, i++) { g.fillStyle = i % 2 ? "#FFE1EC" : "#FFF0F5"; g.fillRect(x, 0, 30, H); }
    for (let i = 0; i < 60; i++) { g.fillStyle = ["rgba(155,93,229,0.12)", "rgba(46,196,182,0.12)", "rgba(255,138,61,0.12)"][i % 3]; g.beginPath(); g.arc((i * 131.7) % W, (i * 77.3) % H, 5 + (i % 3) * 2, 0, Math.PI * 2); g.fill(); }
    // shelf / counter the jars stand on
    const sy = this.zone.y + this.zone.h;
    shadow(g, W / 2, sy + 6, Math.min(W * 0.48, 520), 14, 0.25);
    rr(g, -10, sy - 2, W + 20, H - sy + 12, 0); g.fillStyle = "#C98A4B"; g.fill();
    rr(g, -10, sy - 6, W + 20, 16, 8); clayFill(g, "#FFF4E2", W / 2, sy, W * 0.5, { gloss: 0.2, rim: false });
    for (let x = 0, i = 0; x < W; x += 36, i++) { g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"; g.fillRect(x, sy + 12, 36, H); }
    this.bg = c;
  }

  private turboPos() {
    const T = this.track, h = T.h * 0.95, w = h * 1.77;
    const x0 = T.x + w * 0.5 + 6, x1 = T.x + T.w - 34 - w * 0.4;
    return { x: lerp(x0, x1, this.tb.p), y: T.y + T.h * 0.92, w, h, x0, x1 };
  }

  private drawTrack(g: G, live: boolean) {
    const T = this.track, P = this.turboPos();
    shadow(g, T.x + T.w / 2, T.y + T.h * 0.95, T.w * 0.48, 8, 0.2);
    rr(g, T.x, T.y + T.h * 0.42, T.w, T.h * 0.56, T.h * 0.28); clayFill(g, "#5B5F7E", T.x + T.w / 2, T.y + T.h * 0.7, T.w * 0.5, { gloss: 0.15, rim: false });
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 3; g.setLineDash([12, 10]);
    g.beginPath(); g.moveTo(T.x + 14, T.y + T.h * 0.7); g.lineTo(T.x + T.w - 14, T.y + T.h * 0.7); g.stroke(); g.setLineDash([]);
    // slime trail
    const tx = lerp(P.x0, P.x1, live ? this.tb.max : 0.45) - P.w * 0.35;
    if (tx > P.x0 - P.w * 0.35) { g.strokeStyle = "rgba(168,236,120,0.75)"; g.lineWidth = T.h * 0.12; g.lineCap = "round"; g.beginPath(); g.moveTo(P.x0 - P.w * 0.3, T.y + T.h * 0.86); g.lineTo(tx, T.y + T.h * 0.86); g.stroke(); g.lineCap = "butt"; }
    // start (checker strip) and finish flag
    const fx = T.x + T.w - 26;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? "#FFFFFF" : NAVY; g.fillRect(fx - 6 + c * 6, T.y + T.h * 0.44 + r * (T.h * 0.13), 6, T.h * 0.13); }
    g.fillStyle = "#8A97AA"; g.fillRect(fx + 12, T.y - 2, 3, T.h * 0.95);
    const wave = Math.sin(this.t * 6) * 3;
    g.save(); g.beginPath(); g.moveTo(fx + 15, T.y); g.quadraticCurveTo(fx + 27, T.y - 2 + wave, fx + 38, T.y + 2); g.lineTo(fx + 38, T.y + T.h * 0.36); g.quadraticCurveTo(fx + 27, T.y + T.h * 0.32 + wave, fx + 15, T.y + T.h * 0.36); g.closePath(); g.clip();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = (r + c) % 2 ? "#FFFFFF" : "#1B1420"; g.fillRect(fx + 15 + c * 6, T.y - 4 + r * (T.h * 0.1), 6, T.h * 0.1); }
    g.restore();
    // Turbo
    const late = live && this.phase === "answer" && this.tb.p > 0.72;
    const mood = live ? (late ? "wow" : this.hud.host.mood) : "happy";
    const spin = this.tb.spin, boost = this.tb.boost;
    const bob = Math.sin(this.t * (boost > 0.2 ? 30 : 6)) * (boost > 0.2 ? 2 : 1.2);
    shadow(g, P.x, P.y, P.w * 0.4, 5, 0.3);
    g.save(); g.translate(P.x, P.y - P.h * 0.4); g.rotate(spin > 0 ? Math.sin(spin * Math.PI * 4) * 0.5 : late ? Math.sin(this.t * 22) * 0.04 : 0); g.translate(-P.x, -(P.y - P.h * 0.4));
    if (boost > 0.05) { // rocket flame
      const fl = 1 + Math.sin(this.t * 40) * 0.2;
      blob(g, P.x - P.w * 0.55, P.y - P.h * 0.5, P.w * 0.22 * boost * fl, P.h * 0.12 * boost, "#FFB000", { gloss: 0.6 });
      blob(g, P.x - P.w * 0.5, P.y - P.h * 0.5, P.w * 0.12 * boost * fl, P.h * 0.07 * boost, "#FFF4B0");
    }
    this.sprite(g, this.host(mood), P.x, P.y + bob * 0.3, P.h, { sx: 1 + boost * 0.08, sy: 1 - boost * 0.05 + Math.sin(this.t * 3) * 0.015 });
    g.restore();
    if (spin > 0.2) for (let i = 0; i < 3; i++) star(g, P.x + Math.cos(this.t * 8 + i * 2.1) * P.w * 0.3, P.y - P.h * 1.0 + Math.sin(this.t * 8 + i * 2.1) * 6, 6, "#FFD25A", this.t * 4);
  }

  private drawSign(g: G, live: boolean) {
    const S = this.sign, more = live ? this.more : true, three = live && this.tw.three;
    const k = live ? this.signFlip.v : 1;
    g.save(); g.translate(S.x + S.w / 2, S.y + S.h / 2); g.scale(1, Math.max(0.05, k)); g.translate(-(S.x + S.w / 2), -(S.y + S.h / 2));
    shadow(g, S.x + S.w / 2, S.y + S.h + 2, S.w * 0.42, 7, 0.25);
    clayPanel(g, S.x, S.y, S.w, S.h, S.h / 2, more ? "#2FA866" : "#FF6F91", { lip: 6 });
    const cy = S.y + (S.h - 6) / 2;
    // arrow icon
    const ax = S.x + S.h * 0.55, ar = (S.h - 6) * 0.32;
    g.save(); g.translate(ax, cy); if (!more) g.scale(1, -1);
    g.beginPath(); g.moveTo(0, -ar); g.lineTo(ar, 0); g.lineTo(ar * 0.4, 0); g.lineTo(ar * 0.4, ar); g.lineTo(-ar * 0.4, ar); g.lineTo(-ar * 0.4, 0); g.lineTo(-ar, 0); g.closePath();
    g.fillStyle = "#FFFFFF"; g.fill(); g.restore();
    const word = more ? (three ? "MOST" : "MORE") : three ? "LEAST" : "LESS";
    g.font = `${Math.min(15, S.h * 0.28)}px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,0.9)";
    const lead = three ? "Which jar has the" : "Which jar has";
    g.fillText(lead, S.x + S.h * 1.05, cy);
    const lw = g.measureText(lead).width;
    const ws = Math.min(S.h * 0.56, 34);
    const wx = Math.min(S.x + S.h * 1.05 + lw + 10, S.x + S.w - ws * 2.9);
    clayText(g, word + "?", wx, cy, ws, { fill: "#FFFFFF", stroke: more ? "#17663C" : "#B23A5C", align: "left" });
    g.restore();
  }

  private drawJar(g: G, j: Jar, k: number, live: boolean) {
    const G0 = this.geo(j), cx = j.x + j.w / 2, by = j.y + j.h;
    const slideIn = (1 - ease.out(clamp(j.in, 0, 1))) * (this.W * 0.7), slideOut = ease.in(j.out) * -this.W * 0.8;
    const wob = live && this.tw.wobble && this.jars.includes(j) ? Math.sin(this.t * 2.6 + j.ph) * 0.09 + Math.sin(this.t * 4.1 + j.ph) * 0.03 : 0;
    const wig = Math.sin(j.wig * 30) * j.wig * 0.06;
    const pr = j.press;
    g.save();
    g.translate(cx + slideIn + slideOut + (live && this.tw.wobble ? Math.sin(this.t * 1.7 + j.ph) * 6 : 0), by);
    shadow(g, 0, 2, G0.bw * 0.55, 8, 0.3);
    g.rotate(wob + wig); g.scale(1 + pr * 0.06, 1 - pr * 0.08);
    const { bw, bh, nw, neckH, lidH, wall, r } = G0;
    // glow for the right answer
    if (j.state === "right" || j.state === "answer") { g.fillStyle = `rgba(255,220,90,${0.35 + Math.sin(this.t * 8) * 0.12})`; rr(g, -bw / 2 - 10, -bh - neckH - lidH - 10, bw + 20, bh + neckH + lidH + 18, r + 10); g.fill(); }
    // glass back
    rr(g, -bw / 2, -bh, bw, bh, r); g.fillStyle = "rgba(214,238,255,0.35)"; g.fill();
    // beans
    g.save(); rr(g, -bw / 2 + 2, -bh + 2, bw - 4, bh - 4, r); g.clip();
    const ix = -bw / 2 + wall, iw = bw - wall * 2, ih = bh - wall * 2.4;
    const jig = live && this.tw.wobble ? 1 : 0;
    for (const b of j.beans) {
      const rad = b.r * iw;
      const x = ix + b.x * iw + Math.sin(this.t * 7 + b.ph) * rad * 0.12 * jig, y = -wall - b.y * ih + Math.cos(this.t * 6 + b.ph) * rad * 0.1 * jig;
      const img = this.beanImg[b.c];
      if (!img) continue;
      g.save(); g.translate(x, y); g.rotate(b.rot);
      g.drawImage(img, -rad * 1.2, -rad * 0.84, rad * 2.4, rad * 1.68);
      g.restore();
    }
    g.restore();
    // glass front: outline + gloss streaks
    rr(g, -bw / 2, -bh, bw, bh, r); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 3.5; g.stroke();
    rr(g, -bw / 2, -bh, bw, bh, r); g.strokeStyle = "rgba(90,130,170,0.35)"; g.lineWidth = 1.5; g.stroke();
    const gl = g.createLinearGradient(-bw / 2, 0, -bw / 2 + bw * 0.25, 0); gl.addColorStop(0, "rgba(255,255,255,0.55)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    rr(g, -bw / 2 + wall * 0.8, -bh + r * 0.6, bw * 0.16, bh - r * 1.2, bw * 0.08); g.fillStyle = gl; g.fill();
    rr(g, bw / 2 - wall * 0.8 - bw * 0.06, -bh + r * 0.8, bw * 0.05, bh * 0.35, bw * 0.03); g.fillStyle = "rgba(255,255,255,0.4)"; g.fill();
    // neck, rim and clay lid
    rr(g, -nw / 2, -bh - neckH + 2, nw, neckH + 2, 5); g.fillStyle = "rgba(214,238,255,0.5)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2.5; g.stroke();
    rr(g, -nw / 2 - 5, -bh - neckH - lidH + 3, nw + 10, lidH, Math.min(10, lidH / 2)); clayFill(g, j.lid, 0, -bh - neckH - lidH / 2, nw * 0.6, { gloss: 0.45, rim: false });
    g.strokeStyle = rgba(darken(j.lid, 0.3), 0.5); g.lineWidth = 2;
    for (let i = 1; i < 6; i++) { const lx = -nw / 2 - 5 + ((nw + 10) * i) / 6; g.beginPath(); g.moveTo(lx, -bh - neckH - lidH + 6); g.lineTo(lx, -bh - neckH); g.stroke(); }
    if (j.big && live && this.phase !== "enter") { g.font = `${Math.min(14, bw * 0.12)}px ${FONT}`; g.textAlign = "center"; g.fillStyle = "rgba(35,48,90,0.55)"; g.fillText("BIG BEANS", 0, -bh - neckH - lidH - 6); }
    g.restore();
    // count badge after answering
    if (j.badge > 0.01 && j.out < 0.5) {
      const bs = clamp(j.w * 0.2, 20, 34) * j.badge, bx = cx + slideOut, byy = j.y + j.h * 0.42;
      const col = j.state === "right" || j.state === "answer" ? "#FFD25A" : j.state === "wrong" ? "#FF6F91" : "#FFFFFF";
      shadow(g, bx, byy + bs, bs, bs * 0.25, 0.3);
      blob(g, bx, byy, bs, bs, col, { gloss: 0.45 });
      g.strokeStyle = "#FFFFFF"; g.lineWidth = 3; g.beginPath(); g.arc(bx, byy, bs, 0, Math.PI * 2); g.stroke();
      g.font = `${bs * 0.95}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(String(j.n), bx, byy + 1);
    }
    if (live && this.W > 700 && j.badge < 0.01 && j.out < 0.01) { g.font = `14px ${FONT}`; g.textAlign = "center"; g.fillStyle = "rgba(35,48,90,0.45)"; g.fillText(this.jars.length === 2 ? ["← / 1", "→ / 2"][k] : String(k + 1), cx, by + 16); }
  }

  private drawFoot(g: G, live: boolean) {
    const F = this.foot, n = live ? this.prompts : 10;
    const sp = Math.min(18, (F.w * 0.5) / n), x0 = F.x + 14;
    for (let i = 0; i < n; i++) {
      const done = live && i < this.prompt, cur = live && i === this.prompt;
      blob(g, x0 + i * sp, F.y + F.h / 2, cur ? 6 : 5, cur ? 6 : 5, done ? BEAN_C[i % BEAN_C.length] : cur ? "#FFFFFF" : "#E7B98C", { gloss: 0.4 });
    }
    const hm = live ? this.heartsMax : 3, hv = live ? this.hearts : 3;
    for (let i = 0; i < hm; i++) {
      const x = F.x + F.w - 16 - i * 22, y = F.y + F.h / 2, r = 8;
      g.beginPath(); g.moveTo(x, y + r * 0.85); g.bezierCurveTo(x - r * 1.35, y - r * 0.05, x - r * 0.65, y - r * 1.15, x, y - r * 0.42); g.bezierCurveTo(x + r * 0.65, y - r * 1.15, x + r * 1.35, y - r * 0.05, x, y + r * 0.85);
      clayFill(g, i < hv ? "#FF5C7A" : "#E7B98C", x, y, r, { gloss: 0.4 });
    }
  }

  private scene(g: G, live: boolean) {
    if (!this.bg || this.bg.width !== Math.round(this.W * this.dpr)) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawTrack(g, live);
    this.drawSign(g, live);
    for (const j of this.old) if (j.out < 1) this.drawJar(g, j, 0, live);
    this.jars.forEach((j, k) => this.drawJar(g, j, k, live));
    this.drawFoot(g, live);
    if (live && this.phase === "answer" && this.tw.three === false && this.prompt === 0 && this.level === 1 && this.el < 2.5) {
      // tiny tutorial pointer on the very first prompt
      const j = this.jars[this.answer];
      if (j) { const px = j.x + j.w / 2, py = j.y - 6 + Math.sin(this.t * 8) * 6; g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(px, py + 14); g.lineTo(px - 10, py); g.lineTo(px + 10, py); g.closePath(); g.fill(); }
    }
  }

  protected draw(g: G) { this.scene(g, true); }

  protected drawBackground(g: G) {
    if (!this.beanImg.length) this.makeBeanImgs();
    if (!this.jars.length) {
      this.jars = [14, 8].map((n, k) => ({ n, beans: [], shape: "classic" as Shape, lid: LIDS[k], big: false, x: 0, y: 0, w: 0, h: 0, in: 1, out: 0, press: 0, wig: 0, badge: 0, state: "idle" as const, ph: k }));
      this.layout();
      const base = Math.sqrt((0.86 * (this.geo(this.jars[0]).ih / this.geo(this.jars[0]).iw)) / (3.4 * 14));
      this.jars.forEach((j) => this.fillJar(j, Math.min(0.2, base), false));
      this.tb.p = 0.45;
    }
    this.layout();
    this.scene(g, false);
  }
}
