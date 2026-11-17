// Color Clash — Prof. Hoot's Stroop class. The word says one colour, the paint is another.
// INK = tap the paint colour, WORD = tap the colour the word spells. 10 prompts per level.
import { ArcadeGame, Bag, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, lighten, rr, shadow, type G } from "../paint";

interface Col { id: string; name: string; hex: string }
const COLORS: Col[] = [
  { id: "red", name: "RED", hex: "#E8504F" },
  { id: "blue", name: "BLUE", hex: "#3B82F6" },
  { id: "yellow", name: "YELLOW", hex: "#FFC93C" },
  { id: "green", name: "GREEN", hex: "#2FA866" },
  { id: "purple", name: "PURPLE", hex: "#9B5DE5" },
  { id: "orange", name: "ORANGE", hex: "#FF8A3D" },
];
type Rule = "ink" | "word";
interface Btn { col: Col; x: number; y: number; w: number; h: number; press: number; shake: number }

export default class ColorClash extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "color-clash", title: "Color Clash", host: "hoot", style: "rounds",
    music: { calm: "a:clash_calm", action: "a:clash_action" },
    sounds: ["a:chalk", "a:bell", "a:page", "a:snore", "a:tickHi", "a:kazoo", "a:chime", "a:honk", "a:slideDown"],
    voicePitch: 0.95,
    transition: "curtain",
  };
  private palette: Col[] = [];
  private btns: Btn[] = [];
  private rule: Rule = "ink";
  private word: Col = COLORS[0];
  private ink: Col = COLORS[1];
  private prompt = 0; private total = 10; private mistakes = 0; private maxMistakes = 3;
  private per = 4; private left = 4; private waiting = false;
  private flipP = 0; private shuffleBtns = false; private wobble = 0; private upside = false;
  private wordPop = 0; private signFlip = 0; private sleepy = 0;
  private recent = new Bag<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  private board = { x: 0, y: 0, w: 0, h: 0 };

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W;
    const portrait = W < this.H;
    const n = this.palette.length || 3;
    const cols = n <= 3 ? n : portrait ? 3 : n;
    const rows = Math.ceil(n / cols);
    const bw = Math.min(150, (Math.min(W, 640) - 24 - (cols - 1) * 12) / cols), bh = clamp(bw * 0.78, 64, 104);
    const gridW = cols * bw + (cols - 1) * 12;
    const bottom = A.y + A.h - 8;
    const top = bottom - rows * bh - (rows - 1) * 12;
    this.btns.forEach((b, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const inRow = Math.min(cols, n - r * cols);
      const rowW = inRow * bw + (inRow - 1) * 12;
      b.x = (W - rowW) / 2 + c * (bw + 12); b.y = top + r * (bh + 12); b.w = bw; b.h = bh;
    });
    void gridW;
    const bh2 = clamp(top - A.y - 24, 160, 420);
    this.board = { x: Math.max(12, (W - Math.min(W - 24, 640)) / 2), y: A.y + 8, w: Math.min(W - 24, 640), h: bh2 };
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = byDiff(d, { easy: L >= 5 ? 4 : 3, medium: L >= 6 ? 5 : 4, hard: L >= 4 ? 6 : 5 });
    this.palette = COLORS.slice(0, n);
    this.btns = this.palette.map((col) => ({ col, x: 0, y: 0, w: 0, h: 0, press: 0, shake: 0 }));
    this.per = ramp(L, byDiff(d, { easy: 4, medium: 3.2, hard: 2.6 }), byDiff(d, { easy: -0.12, medium: -0.1, hard: -0.09 }), byDiff(d, { easy: 2.2, medium: 1.8, hard: 1.3 }));
    this.flipP = d === "easy" ? (L <= 2 ? 0 : Math.min(0.35, 0.15 + L * 0.02)) : d === "medium" ? Math.min(0.5, 0.25 + L * 0.02) : Math.min(0.6, 0.38 + L * 0.02);
    this.shuffleBtns = d === "hard" ? L >= 3 : d === "medium" ? L >= 9 : false;
    this.wobble = d === "hard" ? (L >= 5 ? 1 : 0) : d === "medium" ? (L >= 10 ? 0.6 : 0) : 0;
    this.upside = d === "hard" && L >= 8;
    this.maxMistakes = byDiff(d, { easy: 3, medium: 3, hard: 2 });
    this.prompt = 0; this.mistakes = 0;
    this.rule = "ink";
    this.layout();
    this.hint(d === "easy" && L <= 2 ? "Tap the PAINT colour 🎨" : "INK = paint colour · WORD = what it says");
    this.react("happy", this.rng.pick(["Class is in session! Hoo!", "Eyes on the board!", "Don't read it — SEE it!", "Ready, young owlet?"]));
    this.sfx("a:bell", { gain: 0.45 });
    this.music(L > 3 ? "action" : "calm");
    this.after(0.6, () => this.nextPrompt());
  }

  private nextPrompt() {
    if (this.ending) return;
    if (this.prompt >= this.total) { this.levelClear({ perfect: this.mistakes === 0 }); return; }
    this.prompt++;
    const r = this.rng;
    const prevRule = this.rule;
    if (this.prompt > 1 && r.chance(this.flipP)) this.rule = this.rule === "ink" ? "word" : "ink";
    if (this.diff === "easy" && this.level <= 2) this.rule = "ink";
    // pick word/ink combos from a no-repeat bag (congruent ~15% to keep you honest)
    let w: Col, k: Col;
    do {
      const code = this.recent.next(r);
      w = this.palette[code % this.palette.length];
      k = r.chance(0.15) ? w : this.palette[(code * 7 + this.prompt) % this.palette.length];
    } while (w === this.word && k === this.ink);
    this.word = w; this.ink = k;
    if (this.shuffleBtns) { r.shuffle(this.btns); this.layout(); this.sfx("a:page", { gain: 0.3 }); }
    this.left = this.per; this.waiting = true; this.wordPop = 0;
    this.tween(this, { wordPop: 1 } as never, 0.35, ease.back);
    if (this.rule !== prevRule) { this.signFlip = 1; this.tween(this, { signFlip: 0 } as never, 0.5, ease.out); this.sfx("a:page", { gain: 0.6 }); this.sfx("a:slideDown", { gain: 0.35 }); this.react("wow", this.rule === "ink" ? "Now the INK!" : "Now the WORD!"); }
    this.sfx("a:chalk", { gain: 0.35 });
    this.setHud({ hint: `${this.prompt}/${this.total} · Tap the ${this.rule === "ink" ? "INK 🎨" : "WORD 📖"}` });
  }

  private answer(b: Btn) {
    if (!this.waiting) return;
    this.waiting = false;
    const right = this.rule === "ink" ? this.ink : this.word;
    b.press = 1; this.tween(b, { press: 0 }, 0.25);
    if (b.col.id === right.id) {
      this.good(b.x + b.w / 2, b.y - 10, 50, this.left / this.per);
      this.sfx("a:chime", { x: b.x + b.w / 2, gain: 0.45, rate: 1 + this.combo * 0.02 });
      this.sleepy = 0;
      this.after(0.35, () => this.nextPrompt());
    } else this.miss(b, right);
  }

  private miss(b: Btn | null, right: Col) {
    this.mistakes++;
    if (b) { b.shake = 1; this.tween(b, { shake: 0 }, 0.5); }
    const rb = this.btns.find((x) => x.col.id === right.id);
    if (rb) { rb.press = -1; this.tween(rb, { press: 0 }, 0.9); }
    this.sleepy = 1;
    this.sfx("a:snore", { gain: 0.45, delay: 0.25 });
    this.bad(b ? b.x + b.w / 2 : this.W / 2, b ? b.y : this.board.y + this.board.h / 2, { line: this.rule === "ink" ? `The INK was ${right.name}!` : `The WORD said ${right.name}!` });
    if (this.mistakes >= this.maxMistakes) { this.after(0.6, () => this.levelFail(`${this.maxMistakes} mistakes — new lesson!`)); return; }
    this.after(0.9, () => this.nextPrompt());
  }

  protected onDown(x: number, y: number) {
    for (const b of this.btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.answer(b); return; }
  }
  onKey(k: string) {
    const i = parseInt(k, 10);
    if (i >= 1 && i <= this.btns.length) this.answer(this.btns[i - 1]);
  }

  protected update(dt: number) {
    if (!this.waiting || this.ending) return;
    this.left -= dt;
    const f = this.left / this.per;
    this.timerBar(f, f < 0.3 ? "#FF6F91" : "#FFD25A");
    if (f < 0.35 && Math.floor(this.left * 4) !== Math.floor((this.left + dt) * 4)) this.sfx("a:tickHi", { gain: 0.25 });
    if (this.left <= 0) { this.waiting = false; this.sfx("a:honk", { gain: 0.5 }); this.miss(null, this.rule === "ink" ? this.ink : this.word); }
  }

  // ------------------------------------------------------------ drawing
  private drawRoom(g: G) {
    const W = this.W, H = this.H;
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#F7E3C4"); wall.addColorStop(1, "#E9C99C");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.25)";
    for (let x = 0; x < W; x += 46) g.fillRect(x, 0, 18, H);
    // floor / desk
    const fy = this.btns[0]?.y ? this.btns[0].y - 24 : H * 0.7;
    const desk = g.createLinearGradient(0, fy, 0, H);
    desk.addColorStop(0, "#B9784A"); desk.addColorStop(1, "#8A5428");
    g.fillStyle = desk; rr(g, -10, fy, W + 20, H - fy + 10, 26); g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, fy + 6, W, 6);
  }

  private drawBoard(g: G, live: boolean) {
    const b = this.board;
    shadow(g, b.x + b.w / 2, b.y + b.h + 6, b.w * 0.5, 14, 0.25);
    clayPanel(g, b.x - 10, b.y - 10, b.w + 20, b.h + 24, 24, "#A0673C", { lip: 8 });
    rr(g, b.x, b.y, b.w, b.h, 16);
    const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h);
    gr.addColorStop(0, "#2F5D46"); gr.addColorStop(1, "#24483A");
    g.fillStyle = gr; g.fill();
    g.save(); rr(g, b.x, b.y, b.w, b.h, 16); g.clip();
    g.globalAlpha = 0.08; g.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(b.x + ((i * 97) % b.w), b.y + ((i * 53) % b.h), 60, 14, 0.3, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
    // Hoot peeks from the board's corner
    const hh = clamp(b.h * 0.5, 80, 150);
    const mood = live ? this.hud.host.mood : "happy";
    const tilt = this.sleepy > 0 ? 0.35 : Math.sin(this.t * 1.5) * 0.04;
    this.sprite(g, this.host(mood), b.x + b.w - hh * 0.38, b.y + b.h + 10, hh, { rot: tilt });
    if (this.sleepy > 0) clayText(g, "Zzz", b.x + b.w - hh * 0.15, b.y + b.h - hh * 0.95 - Math.sin(this.t * 3) * 6, 20, { fill: "#E8F7FF" });
    if (!live) { clayText(g, "COLOR", b.x + b.w * 0.42, b.y + b.h * 0.36, Math.min(56, b.w * 0.13), { fill: "#3B82F6" }); clayText(g, "CLASH", b.x + b.w * 0.42, b.y + b.h * 0.66, Math.min(56, b.w * 0.13), { fill: "#E8504F" }); return; }
    // rule sign
    const sw = Math.min(190, b.w * 0.42), sh = 44, sx = b.x + 16, sy = b.y + 14;
    g.save(); g.translate(sx + sw / 2, sy + sh / 2); g.scale(1, 1 - this.signFlip * 0.9); g.translate(-(sx + sw / 2), -(sy + sh / 2));
    clayPanel(g, sx, sy, sw, sh + 6, 14, this.rule === "ink" ? "#FF8A3D" : "#2EC4B6", { lip: 6 });
    clayText(g, this.rule === "ink" ? "🎨 INK" : "📖 WORD", sx + sw / 2, sy + sh / 2, 24, { fill: "#FFF4E2" });
    g.restore();
    // the word
    if (this.waiting || this.ending || this.prompt > 0) {
      const size = Math.min(110, b.w * 0.2) * (0.6 + 0.4 * this.wordPop);
      const rot = this.wobble ? Math.sin(this.t * 3) * 0.12 * this.wobble : 0;
      g.save(); g.translate(b.x + b.w * 0.44, b.y + b.h * 0.6);
      if (this.upside && this.prompt % 3 === 0) g.rotate(Math.PI);
      // pure ink colour: cream halo for contrast on the chalkboard, navy outline, no gloss
      g.save(); g.rotate(rot); g.font = `${size}px "Lilita One", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = size * 0.3; g.strokeStyle = "#FFF4E2"; g.strokeText(this.word.name, 0, 0);
      g.lineWidth = size * 0.14; g.strokeStyle = "#23305A"; g.strokeText(this.word.name, 0, 0);
      g.fillStyle = this.ink.hex; g.fillText(this.word.name, 0, 0);
      g.restore();
      g.restore();
    }
  }

  private drawButtons(g: G) {
    this.btns.forEach((b, i) => {
      const sx = Math.sin(b.shake * 30) * b.shake * 8;
      const pressed = Math.max(0, b.press);
      g.save(); g.translate(sx, 0);
      clayPanel(g, b.x, b.y, b.w, b.h, 22, "#FFF4E2", { lip: 8, pressed });
      // paint pot blob
      const cx = b.x + b.w / 2, cy = b.y + (b.h - 8) / 2 + pressed * 6;
      blob(g, cx, cy + 2, b.w * 0.3, b.h * 0.28, b.col.hex, { gloss: 0.55, wobble: 0.04, t: this.t + i });
      g.beginPath(); g.ellipse(cx - b.w * 0.08, cy - b.h * 0.06, b.w * 0.06, b.h * 0.04, -0.4, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.7)"; g.fill();
      if (b.press < 0) { g.strokeStyle = "#7CF2C9"; g.lineWidth = 5; rr(g, b.x - 4, b.y - 4, b.w + 8, b.h + 4, 26); g.stroke(); }
      if (this.settings.showNumbers) clayText(g, String(i + 1), b.x + 16, b.y + 16, 15, { fill: darken(b.col.hex, 0.1), stroke: "#FFF4E2" });
      g.restore();
    });
  }

  protected drawBackground(g: G) {
    if (!this.btns.length) { this.palette = COLORS.slice(0, 3); this.btns = this.palette.map((col) => ({ col, x: 0, y: 0, w: 0, h: 0, press: 0, shake: 0 })); }
    this.layout();
    this.drawRoom(g); this.drawBoard(g, false); this.drawButtons(g);
  }
  protected draw(g: G) { this.drawRoom(g); this.drawBoard(g, true); this.drawButtons(g); void lighten; void clayFill; }
}
