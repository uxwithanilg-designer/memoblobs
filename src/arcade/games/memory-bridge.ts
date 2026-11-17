// Memory Bridge — stones light up (with musical notes) in order; hop Tiki across in the same order.
// Wrong stone = SPLASH. Unlimited levels: longer paths, bigger rivers, faster flashes, Backwards & decoy twists.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { blob, clayFill, darken, eye, lighten, rr, shadow, star, type G } from "../paint";

type Twist = "none" | "back" | "decoy" | "fog";
interface Stone { x: number; y: number; r: number; lit: number; red: number; good: number; sink: number; ph: number }

export default class MemoryBridge extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "memory-bridge", title: "Memory Bridge", host: "tiki", style: "rounds",
    music: { calm: "a:bridge_calm", action: "a:bridge_action" },
    sounds: ["a:stone", "a:splash", "a:sink", "a:croak", "a:tweet", "a:bubbles", "a:applause", "hop", "boing"],
    sprites: ["/brand/tiki.webp"], voicePitch: 1.6,
  };
  private stones: Stone[] = [];
  private path: number[] = [];
  private order: number[] = [];
  private idx = 0;
  private phase: "show" | "hop" | "done" = "show";
  private twist: Twist = "none";
  private twists = new Bag<Twist>(["back", "decoy", "fog"]);
  private recent = new Recent(16);
  private decoys: number[] = [];
  private flashDur = 0.7;
  private river = { x: 0, y: 0, w: 0, h: 0 };
  private bankTop = 0; private bankBot = 0;
  private tiki = { x: 0, y: 0, h: 60, fromX: 0, fromY: 0, toX: 0, toY: 0, t0: -1, dur: 0.32, swim: 0, onStone: -1 };
  private frogs: { x: number; y: number; croak: number }[] = [];
  private mistakes = 0;

  protected onResize() { this.layout(); }

  private grid() {
    const L = this.level, d = this.diff;
    const len = byDiff(d, { easy: 3, medium: 4, hard: 5 }) + Math.floor((L - 1) / 2);
    const cols = clamp(3 + Math.floor((L - 1) / 6), 3, this.W > this.H ? 6 : 5);
    const rows = clamp(Math.ceil((len + 4) / cols), 3, this.W > this.H ? 5 : 6);
    return { len: Math.min(len, cols * rows - 2), cols, rows };
  }

  private layout() {
    const A = this.area;
    this.bankTop = A.y + A.h * 0.13;
    this.bankBot = A.y + A.h * 0.84;
    this.river = { x: 0, y: this.bankTop, w: this.W, h: this.bankBot - this.bankTop };
    const { cols, rows } = this.grid();
    const pad = 16;
    const cw = (this.W - pad * 2) / cols, ch = (this.river.h - pad) / rows;
    const r = clamp(Math.min(cw, ch) * 0.34, 18, 46);
    if (this.stones.length === cols * rows) {
      this.stones.forEach((s, i) => { const c = i % cols, rI = Math.floor(i / cols); s.x = pad + (c + 0.5) * cw + Math.sin(i * 3.1) * cw * 0.1; s.y = this.river.y + pad / 2 + (rI + 0.5) * ch + Math.cos(i * 2.3) * ch * 0.08; s.r = r; });
    }
    this.tiki.h = clamp(r * 2.2, 50, 96);
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const { len, cols, rows } = this.grid();
    this.stones = Array.from({ length: cols * rows }, (_, i) => ({ x: 0, y: 0, r: 30, lit: 0, red: 0, good: 0, sink: 0, ph: i * 1.7 }));
    this.layout();
    // a fresh path that wasn't used recently
    let path: number[] = [];
    for (let tries = 0; tries < 20; tries++) {
      path = this.rng.shuffle([...this.stones.keys()]).slice(0, len);
      if (!this.recent.has(path.join(","))) break;
    }
    this.recent.add(path.join(","));
    this.path = path;
    this.flashDur = ramp(L, byDiff(d, { easy: 0.75, medium: 0.62, hard: 0.52 }), -0.02, byDiff(d, { easy: 0.42, medium: 0.34, hard: 0.27 }));
    const from = byDiff(d, { easy: 8, medium: 4, hard: 3 });
    this.twist = L >= from && this.rng.chance(d === "easy" ? 0.35 : 0.55) ? this.twists.next(this.rng) : "none";
    if (d === "easy" && this.twist === "fog") this.twist = "back";
    this.order = this.twist === "back" ? [...path].reverse() : [...path];
    const free = [...this.stones.keys()].filter((i) => !path.includes(i));
    this.decoys = this.twist === "decoy" ? this.rng.shuffle(free).slice(0, d === "hard" ? 2 : 1) : [];
    // frogs sit in the gaps between stones
    this.frogs = [];
    for (let tries = 0; tries < 60 && this.frogs.length < 2; tries++) {
      const x = this.rng.range(30, this.W - 30), y = this.rng.range(this.river.y + 24, this.river.y + this.river.h - 24);
      if (this.stones.every((st) => Math.hypot(st.x - x, st.y - y) > st.r * 2.1) && this.frogs.every((f) => Math.hypot(f.x - x, f.y - y) > 80)) this.frogs.push({ x, y, croak: 0 });
    }
    this.idx = 0; this.mistakes = 0;
    this.tiki = { ...this.tiki, x: this.W / 2, y: this.bankBot + (this.area.y + this.area.h - this.bankBot) * 0.75, t0: -1, swim: 0, onStone: -1 };
    this.phase = "show";
    this.hint(this.twist === "back" ? "BACKWARDS! Hop the path in reverse 🔄" : this.twist === "decoy" ? "Ignore the RED stones! 🚫" : this.twist === "fog" ? "Fog is coming — remember well! 🌫️" : "Watch the stones light up! 👀");
    if (this.twist !== "none") this.banner(this.twist === "back" ? "BACKWARDS!" : this.twist === "decoy" ? "DECOYS!" : "FOGGY!", undefined, "pink");
    this.react("happy", this.rng.pick(["Watch my path!", "Help me cross!", "Tweet tweet, look!", "Remember the stones!"]));
    this.music("calm");
    this.after(1.7, () => this.playPath());
  }

  private playPath() {
    let t = 0;
    const gap = this.flashDur * 0.35;
    const decoyAt = this.decoys.map(() => this.rng.int(1, Math.max(1, this.path.length - 1)));
    this.path.forEach((si, k) => {
      this.after(t, () => {
        const s = this.stones[si]; s.lit = 1;
        this.tone(this.note(k + 2), this.flashDur * 0.9, s.x, 0.5);
        this.sfx("a:stone", { x: s.x, gain: 0.25 });
      });
      decoyAt.forEach((at, j) => { if (at === k) this.after(t + this.flashDur * 0.5, () => { const s = this.stones[this.decoys[j]]; s.red = 1; this.sfx("a:croak", { x: s.x, gain: 0.35 }); }); });
      t += this.flashDur + gap;
    });
    this.after(t + 0.2, () => {
      this.phase = "hop";
      this.hint(this.twist === "back" ? "Tap the stones in REVERSE order 👆" : "Tap the stones in the same order 👆");
      this.react("wow", "Your turn!");
      this.music("action");
    });
  }

  protected onDown(x: number, y: number) {
    if (this.phase !== "hop" || this.tiki.t0 >= 0 && this.t - this.tiki.t0 < this.tiki.dur * 0.6) return;
    let hit = -1, bd = Infinity;
    this.stones.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d < Math.max(s.r * 1.4, 30) && d < bd && s.sink === 0) { hit = i; bd = d; } });
    if (hit < 0) return;
    const s = this.stones[hit];
    this.hopTo(s.x, s.y - s.r * 0.3);
    if (hit === this.order[this.idx]) {
      this.idx++;
      s.good = 1; s.lit = 1;
      this.tone(this.note(this.path.indexOf(hit) + 2), 0.3, s.x, 0.55);
      this.after(0.25, () => this.good(s.x, s.y - s.r - 10, 40 + this.level * 2, 0));
      if (this.idx >= this.order.length) {
        this.phase = "done"; this.hint(null);
        this.after(0.45, () => { this.hopTo(this.W / 2, this.area.y + (this.bankTop - this.area.y) * 0.62); this.sfx("a:tweet", { gain: 0.6 }); });
        this.after(0.9, () => { this.sfx("a:applause", { gain: 0.35 }); this.levelClear({ perfect: this.mistakes === 0 }); });
      }
    } else {
      this.phase = "done"; this.mistakes++;
      this.after(0.3, () => {
        s.sink = 0.0001; this.tiki.swim = 0.0001;
        this.sfx("a:sink", { x: s.x, gain: 0.5 }); this.sfx("a:splash", { x: s.x, gain: 0.8, delay: 0.15 });
        this.burst(s.x, s.y, { n: 26, colors: ["#BFE9FF", "#FFFFFF", "#7CC8FF"], kind: "drop", speed: 320 });
        this.bad(s.x, s.y - s.r, { line: this.rng.pick(["SPLASH!", "Glub glub…", "I'm all wet!", "Wrong stone!"]) });
        // show the right path again, gently
        this.order.forEach((si, k) => this.after(0.6 + k * 0.18, () => { this.stones[si].good = 0.8; }));
      });
      this.after(1.6, () => this.levelFail(this.twist === "back" ? "Backwards is tricky — try again!" : "Splash! Try a new path!"));
    }
  }

  private hopTo(x: number, y: number) {
    const tk = this.tiki;
    tk.fromX = tk.x; tk.fromY = tk.y; tk.toX = x; tk.toY = y; tk.t0 = this.t;
    this.sfx("hop", { x, gain: 0.45 });
  }

  protected update(dt: number) {
    for (const s of this.stones) {
      s.lit = Math.max(0, s.lit - dt / Math.max(0.2, this.flashDur * 0.9));
      s.red = Math.max(0, s.red - dt * 2);
      if (this.phase !== "done") s.good = Math.max(0, s.good - dt * 1.4);
      if (s.sink > 0) s.sink = Math.min(1, s.sink + dt * 1.6);
    }
    for (const f of this.frogs) { f.croak = Math.max(0, f.croak - dt * 3); if (Math.random() < dt * 0.08) { f.croak = 1; this.sfx("a:croak", { x: f.x, gain: 0.18 }); } }
    const tk = this.tiki;
    if (tk.t0 >= 0) {
      const u = clamp((this.t - tk.t0) / tk.dur, 0, 1);
      tk.x = lerp(tk.fromX, tk.toX, ease.inOut(u)); tk.y = lerp(tk.fromY, tk.toY, ease.inOut(u)) - Math.sin(Math.PI * u) * 46;
      if (u >= 1) tk.t0 = -1;
    }
    if (tk.swim > 0) tk.swim = Math.min(1, tk.swim + dt * 0.8);
  }

  // ------------------------------------------------------------ drawing
  private drawWorld(g: G) {
    const W = this.W, H = this.H, A = this.area;
    const sky = g.createLinearGradient(0, 0, 0, this.bankTop);
    sky.addColorStop(0, "#7FD3A8"); sky.addColorStop(1, "#5DBB86");
    g.fillStyle = sky; g.fillRect(0, 0, W, this.bankTop + 10);
    // far bank: palms + goal nest
    for (let i = 0; i < 7; i++) blob(g, (i * 113) % W, this.bankTop - 6, 40 + (i % 3) * 14, 22, ["#3E9B5A", "#4FAF6A", "#2F8A4E"][i % 3], { gloss: 0.3 });
    const nx = W / 2, ny = A.y + (this.bankTop - A.y) * 0.62;
    blob(g, nx, ny + 8, 42, 16, "#B9784A", { gloss: 0.2 });
    for (let i = 0; i < 3; i++) blob(g, nx - 16 + i * 16, ny, 9, 11, ["#FFE38A", "#BFE9FF", "#FFC2D6"][i], { gloss: 0.6 });
    star(g, nx + 34, ny - 18, 10, "#FFD25A", this.t);
    // river
    const R = this.river;
    const wg = g.createLinearGradient(0, R.y, 0, R.y + R.h);
    wg.addColorStop(0, "#3BA6D9"); wg.addColorStop(1, "#1E6FA8");
    g.fillStyle = wg; g.fillRect(0, R.y, W, R.h);
    g.globalAlpha = 0.18; g.strokeStyle = "#fff"; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const y = R.y + ((i + 0.5) / 12) * R.h;
      const off = (this.t * 40 + i * 57) % (W + 80) - 40;
      g.beginPath(); g.moveTo(off, y); g.quadraticCurveTo(off + 20, y - 4, off + 46, y); g.stroke();
    }
    g.globalAlpha = 1;
    // fog twist
    // near bank
    const bg = g.createLinearGradient(0, this.bankBot, 0, H);
    bg.addColorStop(0, "#6CC48E"); bg.addColorStop(1, "#3E9B5A");
    g.fillStyle = bg; g.beginPath(); g.moveTo(0, this.bankBot + 6);
    for (let x = 0; x <= W; x += 24) g.lineTo(x, this.bankBot + Math.sin(x * 0.05) * 5);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    for (let i = 0; i < 8; i++) { const x = (i * 71 + 20) % W, y = this.bankBot + 22 + (i % 3) * 14; blob(g, x, y, 6, 6, ["#FFD25A", "#FF6F91", "#FFFFFF"][i % 3], { gloss: 0.5 }); }
    // frogs on lily pads
    for (const f of this.frogs) {
      blob(g, f.x, f.y, 26, 11, "#4FAF6A", { gloss: 0.3 });
      blob(g, f.x, f.y - 8 - f.croak * 4, 13, 10 + f.croak * 3, "#74C94E", { gloss: 0.4 });
      if (f.croak > 0) blob(g, f.x, f.y - 2, 8 * f.croak, 7 * f.croak, "#C6F27A");
      eye(g, f.x - 6, f.y - 17, 4.5, {}); eye(g, f.x + 6, f.y - 17, 4.5, {});
    }
  }

  private drawStones(g: G) {
    const fog = this.twist === "fog" && this.phase !== "show";
    this.stones.forEach((s, i) => {
      const sinkK = ease.in(s.sink);
      const bobY = Math.sin(this.t * 1.6 + s.ph) * 1.5;
      g.save(); g.globalAlpha = 1 - sinkK;
      // ripple ring
      g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 2; g.beginPath(); g.ellipse(s.x, s.y + s.r * 0.35, s.r * 1.2, s.r * 0.45, 0, 0, Math.PI * 2); g.stroke();
      const base = s.red > 0 ? lerpC("#8C8A99", "#E8504F", s.red) : s.good > 0 ? lerpC("#8C8A99", "#7CF2C9", s.good) : s.lit > 0 ? lerpC("#8C8A99", "#FFD25A", s.lit) : "#8C8A99";
      if (s.lit > 0 || s.good > 0 || s.red > 0) {
        const k = Math.max(s.lit, s.good, s.red);
        const gl = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2);
        gl.addColorStop(0, `rgba(255,236,150,${0.6 * k})`); gl.addColorStop(1, "rgba(255,236,150,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(s.x, s.y, s.r * 2, 0, Math.PI * 2); g.fill();
      }
      blob(g, s.x, s.y + bobY + sinkK * 18, s.r, s.r * 0.72, base, { gloss: 0.45 });
      blob(g, s.x - s.r * 0.35, s.y - s.r * 0.3 + bobY, s.r * 0.32, s.r * 0.16, "#6FAF5B", { gloss: 0.2 });
      g.restore();
      if (fog && s.sink === 0) { g.fillStyle = "rgba(240,248,255,0.55)"; g.beginPath(); g.ellipse(s.x, s.y, s.r * 1.25, s.r * 0.9, 0, 0, Math.PI * 2); g.fill(); }
      void i;
    });
  }

  private drawTiki(g: G) {
    const tk = this.tiki;
    if (tk.swim > 0) {
      // half-sunk Tiki: only the part above the water line is drawn
      const water = tk.y + 6 + Math.sin(this.t * 4) * 2;
      g.save(); g.beginPath(); g.rect(0, 0, this.W, water); g.clip();
      this.sprite(g, "/brand/tiki.webp", tk.x, water + tk.h * 0.45, tk.h * 0.9, { rot: Math.sin(this.t * 6) * 0.12 });
      g.restore();
      for (let k = 0; k < 2; k++) { g.strokeStyle = `rgba(255,255,255,${0.75 - k * 0.3})`; g.lineWidth = 3; g.beginPath(); g.ellipse(tk.x, water, tk.h * (0.45 + k * 0.18 + ((this.t * 0.6) % 0.2)), 6 + k * 2, 0, 0, Math.PI * 2); g.stroke(); }
      blob(g, tk.x + 6, water - tk.h * 0.48, 9, 5, "#FF8A3D", { rot: 0.3 }); // a fish landed on Tiki's head
      return;
    }
    shadow(g, tk.x, tk.y + 2, tk.h * 0.35, tk.h * 0.1, 0.3);
    const air = tk.t0 >= 0;
    this.sprite(g, "/brand/tiki.webp", tk.x, tk.y, tk.h, { sy: air ? 1.08 : 1 + Math.sin(this.t * 5) * 0.02, sx: air ? 0.94 : 1 });
  }

  protected drawBackground(g: G) {
    if (!this.stones.length) { const { cols, rows } = this.grid(); this.stones = Array.from({ length: cols * rows }, (_, i) => ({ x: 0, y: 0, r: 30, lit: 0, red: 0, good: 0, sink: 0, ph: i * 1.7 })); }
    this.layout();
    this.drawWorld(g);
    this.stones.forEach((s, i) => { s.lit = (Math.sin(this.t * 2 - i) + 1) / 2 > 0.92 ? 1 : 0; });
    this.drawStones(g);
  }

  protected draw(g: G) { this.drawWorld(g); this.drawStones(g); this.drawTiki(g); void clayFill; void darken; void lighten; void rr; }
}

function lerpC(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * t)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
