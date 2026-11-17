// Number Ninja — Noodle's dojo Schulte table. A grid of shuffled numbers on paper-lantern tiles:
// tap 1, 2, 3… in order as fast as you can (the next one is shown on the scroll). Wrong taps cost a little time.
// Unlimited levels: grids grow 3×3 → 7×7, par times tighten, and twists rotate in — wiggling tiles, colour
// distractors, COUNT DOWN rounds, letters A–Z, red/blue alternating sequences and smoke-bomb shuffles.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, spriteUrl, type GameMeta, type Tone } from "../engine";
import { blob, clayFill, clayText, darken, lighten, rgba, rr, shadow, star, type G } from "../paint";

type Seq = "up" | "down" | "letters" | "alt";
type Mod = "wiggle" | "colors" | "shuffle";
interface Tile { label: string; col: "" | "red" | "blue"; ord: number; slot: number; x: number; y: number; done: number; wig: number; slash: number; rot: number; ph: number; paper: string; ink: string; pop: number; smoke: number }

const PAPERS = ["#FFF4E2", "#FFD9E6", "#D6F5E6", "#D8ECFF", "#FFF0A8", "#E9DCFF", "#FFE0C7"];
const INKS = ["#23305A", "#C2273A", "#1E7A4C", "#6A3FB5", "#D9661E", "#1F6FB8"];
const RED = "#E23B4A", BLUE = "#2F6FE0";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UNLOCK: Record<Seq | Mod, { easy: number; medium: number; hard: number }> = {
  up: { easy: 1, medium: 1, hard: 1 },
  colors: { easy: 3, medium: 2, hard: 2 },
  wiggle: { easy: 5, medium: 3, hard: 2 },
  down: { easy: 6, medium: 4, hard: 3 },
  letters: { easy: 7, medium: 5, hard: 4 },
  alt: { easy: 9, medium: 7, hard: 5 },
  shuffle: { easy: 11, medium: 9, hard: 6 },
};
const TWIST: Record<Seq | Mod, { title: string; sub: string; tone: Tone; line: string }> = {
  up: { title: "", sub: "", tone: "gold", line: "" },
  colors: { title: "RAINBOW DOJO!", sub: "Colours are tricks — read the number", tone: "pink", line: "Ooh, pretty… and sneaky!" },
  wiggle: { title: "WIGGLE TILES!", sub: "The tiles won't keep still", tone: "mint", line: "Wobbly lanterns!" },
  down: { title: "COUNT DOWN!", sub: "Start from the biggest number", tone: "red", line: "Backwards, ninja style!" },
  letters: { title: "LETTER NINJA!", sub: "Tap A, B, C… in order", tone: "gold", line: "A-B-C-Ninja!" },
  alt: { title: "RED & BLUE!", sub: "Red 1, blue 1, red 2, blue 2…", tone: "pink", line: "Switch colours every tap!" },
  shuffle: { title: "SMOKE BOMB!", sub: "The tiles jump around!", tone: "red", line: "Poof! Where'd they go?" },
};

export default class NumberNinja extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "number-ninja", title: "Number Ninja", host: "noodle", style: "rounds",
    music: { calm: "a:ninja_calm", action: "a:ninja_action" },
    sounds: ["a:gong", "a:bonk", "a:poof", "a:tink", "a:twinkle", "a:clunk", "whooshShort", "swoosh"],
    voicePitch: 1.1, transition: "blink",
  };
  private tiles: Tile[] = [];
  private n = 3;
  private seq: Seq = "up";
  private mods = new Set<Mod>();
  private idx = 0;
  private phase: "intro" | "play" | "done" = "intro";
  private startT = 0; private penalty = 0; private lastHit = 0;
  private par = 10; private mistakes = 0; private allowed = 6;
  private shuffleEvery = 0;
  private stars: { x0: number; y0: number; x1: number; y1: number; t0: number }[] = [];
  private seqBag = new Bag<string>(["up", "down", "letters", "alt", "up"]);
  private modBag = new Bag<string>(["wiggle", "colors", "shuffle", "none", "wiggle", "colors"]);
  private recent = new Recent(16);
  private seen = new Set<string>();
  private grid = { x: 0, y: 0, s: 300 };
  private scroll = { x: 0, y: 0, w: 220, h: 64 };
  private dog = { x: 0, y: 0, h: 100, hop: 0, sad: 0 };
  private penFx = { v: 0 };
  private bg?: HTMLCanvasElement;
  private sizeKey = ""; private topSeen = 0; private gridKey = "";

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private layout() {
    if (this.W < 80 || this.H < 80) return; // not sized yet
    const key = `${this.W}x${this.H}`;
    if (key !== this.sizeKey) { this.sizeKey = key; this.topSeen = 0; this.bg = undefined; }
    this.topSeen = Math.max(this.topSeen, this.insetTop);
    const W = this.W, A0 = this.area, A = { y: this.topSeen, h: Math.max(100, A0.y + A0.h - this.topSeen) };
    const portrait = W < this.H * 0.95;
    if (portrait) {
      const dh = clamp(A.h * 0.14, 70, 120);
      this.scroll = { w: Math.min(W - 24, 320), h: 70, x: (W - Math.min(W - 24, 320)) / 2, y: A.y + 4 };
      const top = this.scroll.y + this.scroll.h + 10, bot = A.y + A.h - dh - 4;
      const s = Math.max(120, Math.min(W - 20, bot - top, 640));
      this.grid = { x: (W - s) / 2, y: top + (bot - top - s) / 2, s };
      this.dog = { ...this.dog, x: W / 2, y: A.y + A.h + 2, h: dh };
    } else {
      const colW = clamp(W * 0.3, 240, 380);
      const s = Math.max(120, Math.min(A.h - 16, W - colW - 40, 700));
      this.grid = { x: colW + (W - colW - s) / 2, y: A.y + (A.h - s) / 2, s };
      this.scroll = { w: colW - 30, h: clamp(A.h * 0.2, 100, 140), x: 18, y: A.y + A.h * 0.1 };
      const dh = clamp(A.h * 0.28, 90, 190);
      this.dog = { ...this.dog, x: colW / 2 + 6, y: A.y + A.h - 4, h: dh };
    }
    for (const t of this.tiles) this.place(t);
    const gk = `${Math.round(this.grid.x)},${Math.round(this.grid.y)},${Math.round(this.grid.s)}`;
    if (gk !== this.gridKey) { this.gridKey = gk; this.bg = undefined; }
  }

  private cell() { const gap = Math.max(4, this.grid.s * 0.018); return { gap, cs: (this.grid.s - gap * (this.n + 1)) / this.n }; }
  private place(t: Tile) {
    const { gap, cs } = this.cell(), r = Math.floor(t.slot / this.n), c = t.slot % this.n;
    t.x = this.grid.x + gap + c * (cs + gap) + cs / 2; t.y = this.grid.y + gap + r * (cs + gap) + cs / 2;
  }

  // ------------------------------------------------------------ levels
  private has(f: Seq | Mod) { return this.level >= byDiff(this.diff, UNLOCK[f]); }

  private gridSize() {
    const L = this.level;
    return byDiff(this.diff, {
      easy: L <= 3 ? 3 : L <= 7 ? 4 : L <= 12 ? 5 : L <= 20 ? 6 : 7,
      medium: L <= 2 ? 3 : L <= 5 ? 4 : L <= 9 ? 5 : L <= 14 ? 6 : 7,
      hard: L <= 2 ? 4 : L <= 5 ? 5 : L <= 9 ? 6 : 7,
    });
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.n = this.gridSize();
    // pick this level's sequence + modifier (fresh each level thanks to the bags)
    this.seq = "up"; this.mods = new Set();
    const firstOf = (["colors", "wiggle", "down", "letters", "alt", "shuffle"] as (Seq | Mod)[]).find((f) => L === byDiff(d, UNLOCK[f]));
    if (firstOf) {
      if (firstOf === "colors" || firstOf === "wiggle" || firstOf === "shuffle") this.mods.add(firstOf); else this.seq = firstOf;
    } else if (L > 2) {
      for (let i = 0; i < 8; i++) { const s = this.seqBag.next(this.rng) as Seq; if (this.has(s)) { this.seq = s; break; } }
      for (let i = 0; i < 8; i++) { const m = this.modBag.next(this.rng); if (m === "none") break; if (this.has(m as Mod)) { this.mods.add(m as Mod); break; } }
      // late levels stack two modifiers
      if (L >= byDiff(d, { easy: 16, medium: 12, hard: 9 }) && this.rng.chance(0.5)) { const m = this.rng.pick(["wiggle", "colors", "shuffle"] as Mod[]); if (this.has(m)) this.mods.add(m); }
    }
    if (this.seq === "letters" && this.n > 5) this.n = 5;
    if (this.seq === "alt" && this.n > 6) this.n = 6;
    if (this.mods.has("colors") && this.seq === "alt") this.mods.delete("colors");
    const N = this.n * this.n;
    // labels in tapping order
    const order: { label: string; col: "" | "red" | "blue" }[] = [];
    if (this.seq === "up") for (let i = 1; i <= N; i++) order.push({ label: String(i), col: "" });
    else if (this.seq === "down") for (let i = N; i >= 1; i--) order.push({ label: String(i), col: "" });
    else if (this.seq === "letters") for (let i = 0; i < N; i++) order.push({ label: LETTERS[i], col: "" });
    else for (let i = 0; i < N; i++) order.push({ label: String(Math.floor(i / 2) + 1), col: i % 2 ? "blue" : "red" });
    // a fresh layout every time
    let slots: number[] = [];
    for (let k = 0; k < 20; k++) { slots = this.rng.shuffle([...Array(N).keys()]); if (!this.recent.has(slots.join(","))) break; }
    this.recent.add(slots.join(","));
    const colored = this.mods.has("colors");
    this.tiles = order.map((o, i) => {
      const t: Tile = {
        label: o.label, col: o.col, ord: i, slot: slots[i], x: 0, y: 0, done: 0, wig: 0, slash: 0,
        rot: this.mods.has("wiggle") ? this.rng.range(-0.45, 0.45) : 0, ph: this.rng.range(0, 10),
        paper: colored ? this.rng.pick(PAPERS) : PAPERS[0], ink: colored ? this.rng.pick(INKS) : "#23305A", pop: 0, smoke: 0,
      };
      this.place(t);
      return t;
    });
    // staggered "lanterns light up" entrance
    this.tiles.forEach((t) => this.tween(t, { pop: 1 }, 0.35, ease.back, 0.15 + ((t.slot % this.n) + Math.floor(t.slot / this.n)) * 0.05));
    this.idx = 0; this.penalty = 0; this.mistakes = 0; this.stars = []; this.doneT = 0;
    this.allowed = byDiff(d, { easy: 6, medium: 5, hard: 4 }) + Math.floor(this.n / 2);
    this.shuffleEvery = this.mods.has("shuffle") ? Math.max(3, Math.round(N / 5)) : 0;
    const base = [0, 0, 0, 7, 15, 27, 42, 62][this.n];
    const mult = (this.seq === "letters" ? 1.25 : this.seq === "alt" ? 1.35 : this.seq === "down" ? 1.1 : 1) * (this.mods.has("wiggle") ? 1.1 : 1) * (this.mods.has("shuffle") ? 1.2 : 1) * (this.mods.has("colors") ? 1.05 : 1);
    const tighten = Math.max(0.78, 1 - Math.max(0, L - byDiff(d, { easy: 1, medium: 1, hard: 1 })) * 0.012);
    this.par = Math.round(base * mult * byDiff(d, { easy: 1.35, medium: 1.1, hard: 0.9 }) * tighten);
    this.phase = "intro";
    this.layout();
    this.music(this.n >= 5 || this.mods.size > 0 || this.seq !== "up" ? "action" : "calm");
    const twistKey: Seq | Mod | undefined = this.seq !== "up" ? this.seq : [...this.mods][0];
    if (twistKey) {
      const tw = TWIST[twistKey], first = !this.seen.has(twistKey);
      this.seen.add(twistKey);
      this.after(0.45, () => { this.banner(tw.title, first ? tw.sub : undefined, tw.tone); this.react("wow", tw.line); this.sfx("a:twinkle", { gain: 0.5 }); });
    } else this.react("happy", this.rng.pick(["Hi-yah! Find the numbers!", "Ninja eyes ready!", "Swift and silent!", "Let's train!"]));
    this.hint(this.seq === "down" ? `Count DOWN: ${N}, ${N - 1}, ${N - 2}… ⬇️` : this.seq === "letters" ? "Tap A, B, C… in order! 🔤" : this.seq === "alt" ? "Red 1, blue 1, red 2, blue 2… 🔴🔵" : "Tap 1, 2, 3… in order, fast! ⚡");
    this.after(twistKey ? 1.9 : 1.2, () => {
      this.phase = "play"; this.startT = this.t; this.lastHit = this.t;
      this.sfx("a:gong", { gain: 0.55 });
      for (const t of this.tiles) { t.pop = 0.75; this.tween(t, { pop: 1 }, 0.3, ease.back); }
      this.dog.hop = 1;
    });
  }

  // ------------------------------------------------------------ play
  private elapsed() { return (this.phase === "play" ? this.t - this.startT : this.doneT) + this.penalty; }
  private doneT = 0;

  protected onDown(x: number, y: number) {
    if (this.phase !== "play") return;
    const { cs } = this.cell();
    const t = this.tiles.find((q) => !q.done && Math.abs(q.x - x) <= cs / 2 + 2 && Math.abs(q.y - y) <= cs / 2 + 2);
    if (!t) return;
    if (t.ord === this.idx) this.hit(t);
    else this.miss(t);
  }

  private hit(t: Tile) {
    const N = this.tiles.length, exp = this.par / N;
    const speed = clamp(1 - (this.t - this.lastHit) / (exp * 1.5), 0, 1);
    this.lastHit = this.t;
    t.done = 0.001; this.tween(t, { done: 1 }, 0.35, ease.out);
    t.slash = 1; this.tween(t, { slash: 0 }, 0.35, ease.out);
    this.stars.push({ x0: this.dog.x + this.dog.h * 0.9, y0: this.dog.y - this.dog.h * 0.8, x1: t.x, y1: t.y, t0: this.t });
    this.good(t.x, t.y - 10, 10, speed);
    this.tone(this.note(4 + (this.idx % 10)), 0.22, t.x, 0.35);
    this.sfx("whooshShort", { x: t.x, gain: 0.3, rate: 1.2 });
    this.dog.hop = 1;
    this.idx++;
    if (this.idx >= N) { this.finish(); return; }
    if (this.shuffleEvery && this.idx % this.shuffleEvery === 0 && N - this.idx > 2) this.after(0.25, () => this.smoke());
  }

  private miss(t: Tile) {
    this.mistakes++;
    const pen = byDiff(this.diff, { easy: 1, medium: 1.5, hard: 2 });
    this.penalty += pen;
    this.penFx.v = 1; this.tween(this.penFx, { v: 0 }, 0.8);
    t.wig = 1; this.tween(t, { wig: 0 }, 0.45);
    this.sfx("a:bonk", { x: t.x, gain: 0.55 });
    this.float(`+${pen}s`, t.x, t.y - 20, "#FF6F91", 24);
    this.dog.sad = 1;
    const next = this.tiles[this.idx];
    this.bad(t.x, t.y, { line: this.rng.pick([`Find ${this.say2(next)}!`, "Not that one!", "Ninja oopsie!", "Hmm, look again!"]) });
    if (this.mistakes > this.allowed) {
      this.phase = "done"; this.doneT = this.t - this.startT;
      this.levelFail("Too many wrong taps!");
    }
  }

  private say2(t?: Tile) { return t ? `${t.col ? (t.col === "red" ? "red " : "blue ") : ""}${t.label}` : ""; }

  private smoke() {
    if (this.phase !== "play") return;
    const left = this.tiles.filter((t) => !t.done);
    const slots = this.rng.shuffle(left.map((t) => t.slot));
    left.forEach((t, i) => { t.slot = slots[i]; this.place(t); t.smoke = 1; this.tween(t, { smoke: 0 }, 0.5, ease.out); this.burst(t.x, t.y, { n: 3, colors: ["#FFFFFF", "#D8D2E6"], kind: "bubble", speed: 60, gravity: -20, size: 10, life: 0.6 }); });
    this.sfx("a:poof", { gain: 0.6 });
    this.react("wow", this.rng.pick(["Poof!", "Smoke bomb!", "Ninja shuffle!"]), false);
  }

  private finish() {
    this.phase = "done"; this.doneT = this.t - this.startT; this.hint(null);
    const time = this.elapsed(), N = this.tiles.length;
    const under = clamp((this.par - time) / this.par, 0, 1);
    const bonus = Math.round(under * (60 + N * 6) * byDiff(this.diff, { easy: 1, medium: 1.5, hard: 2 }));
    this.sfx("a:gong", { gain: 0.8, delay: 0.1 });
    this.float(`${time.toFixed(1)}s`, this.grid.x + this.grid.s / 2, this.grid.y + this.grid.s / 2, time <= this.par ? "#7CF2C9" : "#FFD25A", 46);
    this.burst(this.grid.x + this.grid.s / 2, this.grid.y + this.grid.s / 2, { n: 30, colors: ["#FFB3CC", "#FFFFFF", "#FFD25A"], kind: "star", speed: 380 });
    this.react("happy", time <= this.par ? this.rng.pick(["Lightning ninja!", "Under par! Hi-yah!", "Fastest paws in the dojo!"]) : this.rng.pick(["Done! Ninja training complete!", "Well done, grasshopper!", "Hi-yah! All found!"]));
    this.after(0.5, () => this.levelClear({ perfect: this.mistakes === 0, bonus, title: time <= this.par ? "UNDER PAR!" : undefined }));
  }

  // ------------------------------------------------------------ simulation
  protected update(dt: number) {
    this.dog.hop = Math.max(0, this.dog.hop - dt * 3);
    this.dog.sad = Math.max(0, this.dog.sad - dt * 1.2);
    this.stars = this.stars.filter((s) => this.t - s.t0 < 0.25);
    if (this.phase === "play") {
      const left = 1 - this.elapsed() / this.par;
      this.timerBar(Math.max(0, left), left > 0.3 ? "#FFD25A" : "#FF6F91");
    } else if (this.phase !== "done") this.timerBar(1, "#FFD25A");
    if (Math.random() < dt * 1.2) this.particles.push({ x: Math.random() * this.W, y: this.area.y - 10, vx: 20 + Math.random() * 30, vy: 30 + Math.random() * 30, life: 6, max: 6, size: 5 + Math.random() * 3, color: Math.random() < 0.5 ? "#FFB3CC" : "#FFD1E0", kind: "conf", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, g: 8 });
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const W = this.W, H = this.H, c = document.createElement("canvas");
    c.width = Math.round(W * this.dpr); c.height = Math.round(H * this.dpr);
    const g = c.getContext("2d")!; g.scale(this.dpr, this.dpr);
    // shoji wall
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#F7E7C6"); wall.addColorStop(1, "#EBD3A6");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    const pw = clamp(W / 4, 110, 200), floorY = H * 0.82;
    g.strokeStyle = "rgba(120,72,36,0.28)"; g.lineWidth = 2;
    for (let x = 0; x < W; x += pw / 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, floorY); g.stroke(); }
    for (let y = 0; y < floorY; y += pw / 2.4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = "#6B3E22";
    for (let x = 0; x < W + pw; x += pw) g.fillRect(x - 5, 0, 10, floorY);
    // big red sun circle
    const sx = W * 0.78, sy = H * 0.22, sr = clamp(Math.min(W, H) * 0.16, 50, 130);
    g.fillStyle = "rgba(226,59,74,0.18)"; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // cherry-blossom branch
    g.strokeStyle = "#5A3424"; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(-10, H * 0.12); g.quadraticCurveTo(W * 0.18, H * 0.1, W * 0.32, H * 0.17); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(W * 0.15, H * 0.115); g.quadraticCurveTo(W * 0.2, H * 0.17, W * 0.24, H * 0.21); g.stroke();
    for (let i = 0; i < 12; i++) {
      const bx = (i / 11) * W * 0.32 + Math.sin(i * 2.1) * 10, by = H * 0.12 + Math.sin(i * 1.3) * 14 + (i / 11) * H * 0.05;
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; blob(g, bx + Math.cos(a) * 5, by + Math.sin(a) * 5, 4.5, 4.5, i % 3 ? "#FFC2D6" : "#FFE0EA", { gloss: 0.3 }); }
      blob(g, bx, by, 2, 2, "#E8507A");
    }
    // wooden floor
    g.fillStyle = "#B97A45"; g.fillRect(0, floorY, W, H - floorY);
    g.strokeStyle = "rgba(90,52,32,0.35)"; g.lineWidth = 2;
    for (let y = floorY + 18; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = "#6B3E22"; g.fillRect(0, floorY - 8, W, 10);
    // tatami mat under the grid
    const G2 = this.grid, m = 16;
    shadow(g, G2.x + G2.s / 2, G2.y + G2.s + 8, G2.s * 0.55, 18, 0.3);
    rr(g, G2.x - m, G2.y - m, G2.s + m * 2, G2.s + m * 2, 22); g.fillStyle = "#3A6B3E"; g.fill();
    rr(g, G2.x - m + 6, G2.y - m + 6, G2.s + m * 2 - 12, G2.s + m * 2 - 12, 18); g.fillStyle = "#C9D98C"; g.fill();
    g.strokeStyle = "rgba(90,110,40,0.25)"; g.lineWidth = 1.5;
    for (let y = G2.y - m + 10; y < G2.y + G2.s + m - 8; y += 6) { g.beginPath(); g.moveTo(G2.x - m + 8, y); g.lineTo(G2.x + G2.s + m - 8, y); g.stroke(); }
    this.bg = c;
  }

  private drawLanterns(g: G) {
    const W = this.W, y0 = this.area.y - 4;
    for (const fx of [0.07, 0.93]) {
      const x = W * fx + Math.sin(this.t * 1.3 + fx * 9) * 3, y = y0 + 26;
      g.strokeStyle = "#3B2416"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y0 - 30); g.lineTo(x, y - 22); g.stroke();
      const gl = g.createRadialGradient(x, y, 4, x, y, 60); gl.addColorStop(0, "rgba(255,170,90,0.4)"); gl.addColorStop(1, "rgba(255,170,90,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, 60, 0, Math.PI * 2); g.fill();
      blob(g, x, y, 20, 24, "#E23B4A", { gloss: 0.45 });
      g.strokeStyle = "rgba(120,20,30,0.45)"; g.lineWidth = 1.5;
      for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(x, y, 20 * Math.cos(k), 24, 0, 0, Math.PI * 2); g.stroke(); }
      rr(g, x - 9, y - 27, 18, 6, 2); g.fillStyle = "#2A1A10"; g.fill(); rr(g, x - 9, y + 21, 18, 6, 2); g.fill();
    }
  }

  private drawTile(g: G, t: Tile, cs: number) {
    const pop = t.pop;
    if (pop <= 0.01) return;
    const wob = this.mods.has("wiggle") ? Math.sin(this.t * 2.2 + t.ph) * 0.14 : 0;
    const shake = t.wig ? Math.sin(t.wig * 30) * 6 * t.wig : 0;
    const done = t.done;
    g.save(); g.translate(t.x + shake, t.y); g.rotate(t.rot + wob);
    const sc = pop * (1 - done * 0.12) * (1 - t.smoke * 0.5) * (this.mods.has("wiggle") ? 1 + Math.sin(this.t * 3 + t.ph) * 0.03 : 1);
    g.scale(sc, sc);
    g.globalAlpha = 1 - done * 0.62;
    const s = cs, r = s * 0.2;
    shadow(g, 0, s * 0.48, s * 0.42, s * 0.08, 0.25);
    // lantern caps
    rr(g, -s * 0.28, -s * 0.54, s * 0.56, s * 0.1, s * 0.04); g.fillStyle = "#3B2416"; g.fill();
    rr(g, -s * 0.28, s * 0.44, s * 0.56, s * 0.1, s * 0.04); g.fill();
    // paper body
    rr(g, -s / 2, -s * 0.47, s, s * 0.94, r);
    clayFill(g, t.wig > 0.05 ? "#FFB3B3" : t.paper, 0, 0, s * 0.6, { gloss: 0.35 });
    g.save(); rr(g, -s / 2, -s * 0.47, s, s * 0.94, r); g.clip();
    g.strokeStyle = rgba(darken(t.paper, 0.3), 0.22); g.lineWidth = Math.max(1, s * 0.025);
    for (const k of [-0.25, 0.25]) { g.beginPath(); g.moveTo(-s / 2, s * k); g.lineTo(s / 2, s * k); g.stroke(); }
    g.restore();
    rr(g, -s / 2, -s * 0.47, s, s * 0.94, r); g.strokeStyle = "#8B5A3C"; g.lineWidth = Math.max(2, s * 0.045); g.stroke();
    // label (hidden until the gong so nobody can pre-scan)
    if (this.phase === "intro" && this.hud.status === "playing") { star(g, 0, 0, s * 0.16, "#E6D3B0", 0.3); g.restore(); return; }
    const ink = t.col === "red" ? RED : t.col === "blue" ? BLUE : t.ink;
    const fs = s * (t.label.length >= 2 ? 0.44 : 0.52);
    clayText(g, t.label, 0, s * 0.02, fs, { fill: ink === "#23305A" ? "#23305A" : ink, stroke: "#FFFFFF", gloss: false });
    if (t.col) { g.fillStyle = ink; g.beginPath(); g.arc(s * 0.3, -s * 0.3, s * 0.07, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    // hanko stamp on found tiles
    if (done > 0) {
      g.save(); g.globalAlpha = Math.min(1, done * 1.5) * 0.9; g.rotate(-0.25);
      g.strokeStyle = "#E23B4A"; g.lineWidth = Math.max(2, s * 0.05);
      g.beginPath(); g.arc(s * 0.22, s * 0.2, s * 0.17 * (2 - done), 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(s * 0.13, s * 0.2); g.lineTo(s * 0.2, s * 0.27); g.lineTo(s * 0.32, s * 0.12); g.stroke();
      g.restore();
    }
    // ninja slash streak
    if (t.slash > 0.02) {
      g.save(); g.globalAlpha = t.slash; g.strokeStyle = "#FFFFFF"; g.lineCap = "round"; g.lineWidth = s * 0.08 * t.slash;
      const u = 1 - t.slash;
      g.beginPath(); g.moveTo(-s * 0.6 + u * s * 0.3, -s * 0.5 + u * s * 0.2); g.lineTo(s * 0.6 * (0.3 + u), s * 0.5 * (0.3 + u)); g.stroke();
      g.restore();
    }
    g.restore();
  }

  private drawNoodle(g: G) {
    const d = this.dog, mood = this.hud.status === "lobby" ? "happy" : d.sad > 0.3 ? "sad" : this.hud.host.mood;
    const url = spriteUrl("noodle", mood), im = this.img(url);
    const hop = Math.sin(Math.min(1, d.hop) * Math.PI) * d.h * 0.12;
    shadow(g, d.x, d.y - 4, d.h * 1.1, d.h * 0.08, 0.3);
    if (!im?.naturalWidth) { blob(g, d.x, d.y - d.h * 0.4, d.h * 1.1, d.h * 0.35, "#E0A868"); return; }
    const h = d.h, w = (h * im.naturalWidth) / im.naturalHeight, y = d.y - hop;
    const sy = 1 + Math.sin(this.t * 2.4) * 0.012 - Math.sin(Math.min(1, d.hop) * Math.PI) * 0.04;
    g.save(); g.translate(d.x, y); g.scale(1, sy);
    g.drawImage(im, -w / 2, -h, w, h);
    // ninja headband (hachimaki) on Noodle's forehead + fluttering tails
    const hx0 = -w / 2 + w * 0.775, hx1 = -w / 2 + w * 0.955, hyy = -h + h * 0.16;
    const flap = Math.sin(this.t * 9) * h * 0.04;
    g.lineCap = "round";
    for (const k of [0, 1]) {
      g.strokeStyle = k ? "#FF4F5E" : "#B81E2C"; g.lineWidth = h * (k ? 0.075 : 0.1);
      g.beginPath(); g.moveTo(hx0 - h * 0.02, hyy + h * 0.06); g.quadraticCurveTo((hx0 + hx1) / 2, hyy - h * 0.05, hx1 + h * 0.01, hyy + h * 0.04); g.stroke();
    }
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc((hx0 + hx1) / 2, hyy + h * 0.003, h * 0.03, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#E23B4A"; g.beginPath(); g.arc((hx0 + hx1) / 2, hyy + h * 0.003, h * 0.018, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#D92B3B"; g.lineWidth = h * 0.05;
    g.beginPath(); g.moveTo(hx0 - h * 0.02, hyy + h * 0.06); g.quadraticCurveTo(hx0 - h * 0.18, hyy + flap, hx0 - h * 0.34, hyy + h * 0.08 - flap); g.stroke();
    g.beginPath(); g.moveTo(hx0 - h * 0.02, hyy + h * 0.06); g.quadraticCurveTo(hx0 - h * 0.15, hyy + h * 0.14 - flap, hx0 - h * 0.3, hyy + h * 0.2 + flap); g.stroke();
    blob(g, hx0 - h * 0.02, hyy + h * 0.06, h * 0.035, h * 0.03, "#B81E2C");
    g.restore();
  }

  private drawScroll(g: G) {
    const S = this.scroll, live = this.hud.status === "playing" || this.hud.status === "over";
    const next = this.tiles[this.idx];
    // paper scroll with wooden rollers
    shadow(g, S.x + S.w / 2, S.y + S.h + 4, S.w * 0.45, 8, 0.25);
    rr(g, S.x + 8, S.y + 4, S.w - 16, S.h - 8, 8); clayFill(g, "#FFF8E8", S.x + S.w / 2, S.y + S.h / 2, S.w * 0.5, { gloss: 0.25, rim: false });
    for (const xx of [S.x, S.x + S.w - 12]) { rr(g, xx, S.y, 12, S.h, 6); clayFill(g, "#8B5A3C", xx + 6, S.y + S.h / 2, S.h * 0.5, { gloss: 0.3 }); }
    const time = live && this.tiles.length ? this.elapsed() : 0;
    const label = live && next ? (this.phase === "intro" ? "?" : next.label) : live ? "✓" : "1";
    const ink = next?.col === "red" ? RED : next?.col === "blue" ? BLUE : "#23305A";
    const pen = this.penFx.v, h = S.h, cy = S.y + h / 2;
    const lx = S.x + S.w * 0.2, mx = S.x + S.w * 0.47, rx = S.x + S.w * 0.75;
    clayText(g, "NEXT", lx, S.y + h * 0.26, h * 0.19, { fill: "#C2273A", stroke: "#FFF8E8", gloss: false });
    clayText(g, label, lx, S.y + h * 0.62, h * (label.length > 1 ? 0.44 : 0.5), { fill: ink === "#23305A" ? "#FFD25A" : ink });
    if (live && this.tiles.length) clayText(g, `${this.idx}/${this.tiles.length}`, mx, cy, h * 0.2, { fill: "#8B5A3C", stroke: "#FFF8E8", gloss: false });
    clayText(g, `${time.toFixed(1)}s`, rx, S.y + h * 0.4, h * 0.3 * (1 + pen * 0.15), { fill: pen > 0.1 ? "#FF6F91" : "#23305A", stroke: "#FFF8E8", gloss: false });
    clayText(g, `par ${this.par}s`, rx, S.y + h * 0.74, h * 0.17, { fill: "#8B5A3C", stroke: "#FFF8E8", gloss: false });
  }

  private drawStars(g: G) {
    for (const s of this.stars) {
      const u = clamp((this.t - s.t0) / 0.18, 0, 1);
      const x = lerp(s.x0, s.x1, ease.out(u)), y = lerp(s.y0, s.y1, ease.out(u)) - Math.sin(u * Math.PI) * 30;
      g.save(); g.translate(x, y); g.rotate(this.t * 30);
      g.fillStyle = "#5B6478";
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr2 = i % 2 ? 4 : 11; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      g.closePath(); g.fill();
      g.fillStyle = lighten("#5B6478", 0.6); g.beginPath(); g.arc(0, 0, 2.5, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  private stuckHelp(g: G, cs: number) {
    // gentle help for younger players: if stuck for a while, the next tile softly glows
    if (this.phase !== "play" || this.diff === "hard") return;
    const wait = this.diff === "easy" ? 5 : 8;
    const k = clamp((this.t - this.lastHit - wait) / 1.5, 0, 1);
    const t = this.tiles[this.idx];
    if (!t || k <= 0) return;
    g.save(); g.globalAlpha = k * (0.5 + 0.3 * Math.sin(this.t * 6));
    g.strokeStyle = "#FFD25A"; g.lineWidth = 5; rr(g, t.x - cs * 0.56, t.y - cs * 0.53, cs * 1.12, cs * 1.06, cs * 0.24); g.stroke();
    g.restore();
    if (k > 0.5) star(g, t.x + cs * 0.42, t.y - cs * 0.42, 8, "#FFD25A", this.t * 3);
  }

  private scene(g: G) {
    if (!this.bg) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawLanterns(g);
    const { cs } = this.cell();
    for (const t of this.tiles) if (t.done) this.drawTile(g, t, cs);
    for (const t of this.tiles) if (!t.done) this.drawTile(g, t, cs);
    this.stuckHelp(g, cs);
    this.drawScroll(g);
    this.drawNoodle(g);
    this.drawStars(g);
  }

  protected drawBackground(g: G) {
    if (!this.tiles.length) {
      this.n = 4;
      const sl = [5, 12, 0, 9, 14, 2, 7, 11, 3, 15, 8, 1, 10, 6, 13, 4];
      this.tiles = sl.map((slot, i) => ({ label: String(i + 1), col: "" as const, ord: i, slot, x: 0, y: 0, done: i < 3 ? 1 : 0, wig: 0, slash: 0, rot: 0, ph: i, paper: PAPERS[0], ink: "#23305A", pop: 1, smoke: 0 }));
      this.idx = 3;
      this.layout();
    }
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}
