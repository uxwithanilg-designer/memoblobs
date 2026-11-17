// Pip's Pantry — flip the fridge doors to find food pairs (Pip forgot where he put his snacks).
// Unlimited levels: more pairs, shorter peeks, and Kranky sneaks in to swap closed doors.
import { ArcadeGame, Bag, byDiff, clamp, ease, lerp, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, eye, rr, shadow, star, type G } from "../paint";

type Food = "fish" | "icecream" | "donut" | "cheese" | "banana" | "sushi" | "cookie" | "pizza" | "carrot" | "cupcake" | "egg" | "cherry" | "melon" | "popsicle" | "candy" | "burger" | "berry" | "pretzel";
const FOODS: Food[] = ["fish", "icecream", "donut", "cheese", "banana", "sushi", "cookie", "pizza", "carrot", "cupcake", "egg", "cherry", "melon", "popsicle", "candy", "burger", "berry", "pretzel"];
interface Card { food: Food; x: number; y: number; w: number; h: number; open: number; want: number; matched: boolean; eat: number; slot: number; mx: number; my: number; moving: number; wig: number }

export default class PipsPantry extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "pips-pantry", title: "Pip's Pantry", host: "pip", style: "rounds",
    music: { calm: "a:pantry_calm", action: "a:pantry_action" },
    sounds: ["a:doorOpen", "a:doorClose", "a:nomnom", "a:gulp", "a:chime", "a:scramble", "a:honk", "snicker"],
    sprites: ["/brand/kranky.webp"], voicePitch: 1.6,
  };
  private cards: Card[] = [];
  private slots: { x: number; y: number }[] = [];
  private cw = 60; private ch = 70;
  private first = -1; private second = -1; private lockFlip = false;
  private moves = 0; private pairs = 3; private found = 0;
  private swapEvery = 0; private claw = { on: 0, ax: 0, ay: 0, bx: 0, by: 0 };
  private bag = new Bag<Food>(FOODS);
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private pip = { x: 0, y: 0, h: 90, chew: 0 };

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, n = this.cards.length || 8;
    const portrait = this.W < this.H;
    const pipH = clamp(A.h * (portrait ? 0.16 : 0.32), 70, 150);
    this.pip = { ...this.pip, x: portrait ? this.W / 2 : this.W - pipH * 0.7, y: A.y + A.h + 2, h: pipH };
    const bw = portrait ? this.W - 20 : Math.min(this.W - pipH * 1.6 - 30, 900);
    const bh = portrait ? A.h - pipH * 0.85 - 8 : A.h - 10;
    this.box = { x: portrait ? 10 : 14, y: A.y + 2, w: bw, h: bh };
    const inner = { w: bw - 24, h: bh - 24 };
    const gap = 8;
    // pick the column count that gives the biggest doors (and fewest empty slots)
    let cols = 2, rows = Math.ceil(n / 2), bestS = -1;
    for (let c = 2; c <= 8; c++) {
      const r = Math.ceil(n / c);
      const cw = Math.min(130, (inner.w - gap * (c - 1)) / c), ch = (inner.h - gap * (r - 1)) / r;
      const sz = Math.min(cw, ch / 1.25) - (c * r - n) * 2;
      if (sz > bestS) { bestS = sz; cols = c; rows = r; }
    }
    this.cw = Math.min(130, (inner.w - gap * (cols - 1)) / cols);
    this.ch = Math.min(this.cw * 1.25, (inner.h - gap * (rows - 1)) / rows);
    const gw = cols * this.cw + (cols - 1) * gap, gh = rows * this.ch + (rows - 1) * gap;
    const ox = this.box.x + (bw - gw) / 2, oy = this.box.y + (bh - gh) / 2;
    this.slots = Array.from({ length: n }, (_, i) => ({ x: ox + (i % cols) * (this.cw + gap), y: oy + Math.floor(i / cols) * (this.ch + gap) }));
    for (const c of this.cards) if (!c.moving) { c.x = this.slots[c.slot].x; c.y = this.slots[c.slot].y; c.w = this.cw; c.h = this.ch; }
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.pairs = Math.min(byDiff(d, { easy: 10, medium: 14, hard: 18 }), byDiff(d, { easy: 3, medium: 4, hard: 6 }) + Math.floor((L - 1) / 2));
    const foods: Food[] = [];
    while (foods.length < this.pairs) { const f = this.bag.next(this.rng); if (!foods.includes(f)) foods.push(f); }
    const deck = this.rng.shuffle([...foods, ...foods]);
    this.cards = deck.map((food, i) => ({ food, x: 0, y: 0, w: 0, h: 0, open: 0, want: 0, matched: false, eat: 0, slot: i, mx: 0, my: 0, moving: 0, wig: 0 }));
    this.layout();
    this.first = -1; this.second = -1; this.moves = 0; this.found = 0; this.lockFlip = false;
    this.swapEvery = d === "hard" && L >= 3 ? 3 : d === "medium" && L >= 5 ? 4 : 0;
    const peek = byDiff(d, { easy: 1.2 + this.pairs * 0.15, medium: L <= 3 ? 1.0 + this.pairs * 0.1 : 0, hard: 0 });
    this.hint(peek > 0 ? "Peek! Remember where the food is 👀" : "Find the matching food pairs! 🍕");
    this.react("sad", this.rng.pick(["Where did I put my snacks?", "I forgot everything!", "Help me find my food!", "My tummy is rumbling…"]));
    this.music("calm");
    if (peek > 0) {
      this.lockFlip = true;
      this.after(0.4, () => { for (const c of this.cards) c.want = 1; this.sfx("a:doorOpen", { gain: 0.4 }); });
      this.after(0.4 + peek, () => { for (const c of this.cards) c.want = 0; this.sfx("a:doorClose", { gain: 0.45 }); this.lockFlip = false; this.hint(`Find ${this.pairs} pairs · par ${this.par()} moves`); });
    } else this.after(0.3, () => this.hint(`Find ${this.pairs} pairs · par ${this.par()} moves`));
  }

  private par() { return this.pairs + Math.ceil(this.pairs * 0.6); }

  protected onDown(x: number, y: number) {
    if (this.lockFlip) return;
    const i = this.cards.findIndex((c) => !c.matched && !c.moving && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || i === this.first) return;
    const c = this.cards[i];
    c.want = 1;
    this.sfx("a:doorOpen", { x: c.x, gain: 0.55, rate: 0.95 + Math.random() * 0.1 });
    if (this.first < 0) { this.first = i; return; }
    this.second = i; this.moves++; this.lockFlip = true;
    this.hint(`Moves ${this.moves} · par ${this.par()} · pairs ${this.found}/${this.pairs}`);
    const a = this.cards[this.first], b = c;
    if (a.food === b.food) {
      this.after(0.35, () => {
        a.matched = b.matched = true; a.eat = b.eat = 0.0001;
        this.found++;
        this.hint(`Moves ${this.moves} · par ${this.par()} · pairs ${this.found}/${this.pairs}`);
        this.good((a.x + b.x) / 2 + this.cw / 2, Math.min(a.y, b.y), 100);
        this.sfx("a:chime", { gain: 0.5 }); this.sfx("a:nomnom", { delay: 0.5, gain: 0.7 }); this.sfx("a:gulp", { delay: 1.05, gain: 0.6 });
        this.after(0.55, () => { this.pip.chew = 1; this.react("happy", this.rng.pick(["Yum!", "Nom nom!", "My favourite!", "Found it!"]), false); });
        this.first = -1; this.second = -1; this.lockFlip = false;
        if (this.found >= this.pairs) {
          this.hint(null);
          this.after(1.0, () => this.levelClear({ perfect: this.moves <= this.par(), title: this.moves <= this.par() ? "PERFECT!" : "ALL FOUND!" }));
        } else {
          if (this.pairs - this.found <= 3) this.music("action");
          if (this.swapEvery && this.found % this.swapEvery === 0) this.after(0.6, () => this.kranky());
        }
      });
    } else {
      this.combo = 0; this.setHud({ combo: 0, mult: 1 });
      this.after(0.85, () => {
        a.want = 0; b.want = 0; a.wig = 1; b.wig = 1;
        this.sfx("a:doorClose", { gain: 0.5 });
        if (this.moves % 3 === 0) this.react("wow", this.rng.pick(["Not a match!", "Hmm, nope!", "Try again!"]));
        this.first = -1; this.second = -1; this.lockFlip = false;
      });
    }
  }

  /** Kranky sneaks in and swaps two closed doors */
  private kranky() {
    const closed = this.cards.map((c, i) => i).filter((i) => !this.cards[i].matched && this.cards[i].want === 0);
    if (closed.length < 3) return;
    const [ia, ib] = this.rng.shuffle([...closed]).slice(0, 2);
    const A = this.cards[ia], B = this.cards[ib];
    this.lockFlip = true;
    this.banner("KRANKY SWAP!", "Watch the doors!", "red");
    this.sfx("snicker", { gain: 0.6 }); this.sfx("a:scramble", { gain: 0.5, delay: 0.4 });
    this.claw = { on: 0.0001, ax: A.x + this.cw / 2, ay: A.y, bx: B.x + this.cw / 2, by: B.y };
    this.tween(this.claw, { on: 1 }, 0.4);
    const sa = A.slot; A.slot = B.slot; B.slot = sa;
    for (const c of [A, B]) { c.mx = c.x; c.my = c.y; c.moving = 0.0001; }
    this.after(0.45, () => {
      this.tween(A, { moving: 1 }, 0.7, ease.inOut); this.tween(B, { moving: 1 }, 0.7, ease.inOut);
    });
    this.after(1.25, () => {
      for (const c of [A, B]) { c.moving = 0; c.x = this.slots[c.slot].x; c.y = this.slots[c.slot].y; }
      this.tween(this.claw, { on: 0 }, 0.3);
      this.lockFlip = false;
    });
  }

  protected update(dt: number) {
    for (const c of this.cards) {
      c.open += (c.want - c.open) * Math.min(1, dt * 12);
      c.wig = Math.max(0, c.wig - dt * 2.5);
      if (c.eat > 0) c.eat = Math.min(1, c.eat + dt * 1.6);
      if (c.moving > 0) {
        const t = this.slots[c.slot], u = c.moving;
        c.x = lerp(c.mx, t.x, u); c.y = lerp(c.my, t.y, u) - Math.sin(Math.PI * u) * this.ch * 0.6;
      }
    }
    this.pip.chew = Math.max(0, this.pip.chew - dt * 1.5);
  }

  // ------------------------------------------------------------ drawing
  private drawKitchen(g: G) {
    const W = this.W, H = this.H;
    g.fillStyle = "#DDF3FF"; g.fillRect(0, 0, W, H);
    const t = 34;
    for (let y = 0; y < H; y += t) for (let x = (y / t) % 2 ? 0 : t; x < W; x += t * 2) { g.fillStyle = "#C8E9FA"; g.fillRect(x, y, t, t); }
    const b = this.box;
    shadow(g, b.x + b.w / 2, b.y + b.h + 4, b.w * 0.48, 12, 0.3);
    clayPanel(g, b.x, b.y, b.w, b.h + 8, 26, "#C98A4B", { lip: 8 });
    rr(g, b.x + 10, b.y + 10, b.w - 20, b.h - 20, 18); g.fillStyle = "#8A5428"; g.fill();
    // counter
    const cy = this.pip.y - this.pip.h * 0.25;
    if (this.W < this.H) { rr(g, -10, cy, W + 20, H - cy + 10, 18); g.fillStyle = "#FF8FB1"; g.fill(); g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(0, cy + 4, W, 5); }
  }

  private drawCard(g: G, c: Card) {
    const k = c.open, eat = c.eat;
    if (c.matched && eat >= 1) return;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    g.save();
    if (c.matched && eat > 0) {
      const u = ease.in(eat);
      g.translate(lerp(cx, this.pip.x, u), lerp(cy, this.pip.y - this.pip.h * 0.6, u)); g.scale(1 - u * 0.6, 1 - u * 0.6); g.rotate(u * 6);
      this.drawFood(g, c.food, 0, 0, Math.min(c.w, c.h) * 0.36);
      g.restore(); return;
    }
    g.translate(cx + Math.sin(c.wig * 25) * c.wig * 4, cy);
    const flip = Math.cos(k * Math.PI);
    g.scale(Math.max(0.02, Math.abs(flip)), 1);
    if (flip >= 0) {
      // closed door
      clayPanel(g, -c.w / 2, -c.h / 2, c.w, c.h, 12, "#FFF4E2", { lip: 5 });
      rr(g, c.w / 2 - 12, -c.h * 0.22, 6, c.h * 0.4, 3); g.fillStyle = "#B8C4D6"; g.fill();
      g.fillStyle = "rgba(35,48,90,0.12)"; star(g, -c.w * 0.08, -c.h * 0.05, Math.min(c.w, c.h) * 0.14, "#FFD25A", 0.2);
    } else {
      rr(g, -c.w / 2, -c.h / 2, c.w, c.h - 4, 12); g.fillStyle = "#EAF6FF"; g.fill();
      g.strokeStyle = "#B8C4D6"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "rgba(124,200,255,0.25)"; g.fillRect(-c.w / 2 + 4, c.h * 0.05, c.w - 8, 3);
      this.drawFood(g, c.food, 0, 0, Math.min(c.w, c.h) * 0.34);
    }
    g.restore();
  }

  private drawFood(g: G, f: Food, x: number, y: number, s: number) {
    g.save(); g.translate(x, y);
    switch (f) {
      case "fish": blob(g, 0, 0, s, s * 0.55, "#7CC8FF"); g.beginPath(); g.moveTo(-s * 0.9, 0); g.lineTo(-s * 1.35, -s * 0.5); g.lineTo(-s * 1.35, s * 0.5); g.closePath(); clayFill(g, "#5AA9E0", -s, 0, s * 0.5); eye(g, s * 0.45, -s * 0.12, s * 0.2, {}); break;
      case "icecream": g.beginPath(); g.moveTo(-s * 0.5, -s * 0.1); g.lineTo(s * 0.5, -s * 0.1); g.lineTo(0, s * 1.1); g.closePath(); clayFill(g, "#E3A563", 0, s * 0.3, s * 0.7); blob(g, 0, -s * 0.35, s * 0.62, s * 0.5, "#FF8FB1", { gloss: 0.5 }); blob(g, 0, -s * 0.95, s * 0.16, s * 0.16, "#E8504F"); break;
      case "donut": blob(g, 0, 0, s, s * 0.85, "#E3A563"); blob(g, 0, -s * 0.05, s * 0.88, s * 0.7, "#FF8FB1", { gloss: 0.5 }); blob(g, 0, 0, s * 0.28, s * 0.22, "#EAF6FF"); break;
      case "cheese": g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(s, s * 0.6); g.lineTo(s * 0.6, -s * 0.7); g.closePath(); clayFill(g, "#FFD25A", 0, 0, s); for (const [hx, hy, r] of [[0.1, 0.2, 0.15], [0.5, 0.0, 0.1], [-0.4, 0.35, 0.1]]) { g.fillStyle = "#E8B53A"; g.beginPath(); g.arc(hx * s, hy * s, r * s, 0, Math.PI * 2); g.fill(); } break;
      case "banana": g.strokeStyle = "#FFD25A"; g.lineCap = "round"; g.lineWidth = s * 0.5; g.beginPath(); g.arc(0, -s * 0.6, s, 0.35 * Math.PI, 0.85 * Math.PI); g.stroke(); g.strokeStyle = "#E8B53A"; g.lineWidth = s * 0.12; g.beginPath(); g.arc(0, -s * 0.6, s * 1.15, 0.38 * Math.PI, 0.82 * Math.PI); g.stroke(); break;
      case "sushi": blob(g, 0, s * 0.15, s * 0.9, s * 0.5, "#FFFDF4", { gloss: 0.3 }); blob(g, 0, -s * 0.2, s * 0.85, s * 0.3, "#FF8A5C", { gloss: 0.6 }); g.fillStyle = "#23402E"; g.fillRect(-s * 0.15, -s * 0.45, s * 0.3, s * 1.05); break;
      case "cookie": blob(g, 0, 0, s, s, "#D9A066"); for (let i = 0; i < 6; i++) blob(g, Math.cos(i * 1.1) * s * 0.5, Math.sin(i * 1.7) * s * 0.5, s * 0.13, s * 0.13, "#5A3420"); break;
      case "pizza": g.beginPath(); g.moveTo(-s * 0.8, -s * 0.7); g.lineTo(s * 0.8, -s * 0.7); g.lineTo(0, s * 1.0); g.closePath(); clayFill(g, "#FFC93C", 0, 0, s); g.fillStyle = "#D9A066"; g.fillRect(-s * 0.85, -s * 0.85, s * 1.7, s * 0.22); for (const [px, py] of [[-0.25, -0.3], [0.25, -0.2], [0, 0.25]]) blob(g, px * s, py * s, s * 0.17, s * 0.17, "#E8504F"); break;
      case "carrot": g.beginPath(); g.moveTo(-s * 0.35, -s * 0.6); g.lineTo(s * 0.35, -s * 0.6); g.lineTo(0, s * 1.0); g.closePath(); clayFill(g, "#FF8A3D", 0, 0, s * 0.8); for (const a of [-0.4, 0, 0.4]) blob(g, Math.sin(a) * s * 0.3, -s * 0.85, s * 0.12, s * 0.32, "#4FAF6A", { rot: a }); break;
      case "cupcake": g.beginPath(); g.moveTo(-s * 0.65, 0); g.lineTo(s * 0.65, 0); g.lineTo(s * 0.45, s * 0.9); g.lineTo(-s * 0.45, s * 0.9); g.closePath(); clayFill(g, "#7CC8FF", 0, s * 0.45, s * 0.7); blob(g, 0, -s * 0.25, s * 0.75, s * 0.42, "#FFF4E2", { gloss: 0.5 }); blob(g, 0, -s * 0.65, s * 0.4, s * 0.3, "#FFF4E2"); blob(g, 0, -s * 0.95, s * 0.14, s * 0.14, "#E8504F"); break;
      case "egg": blob(g, 0, 0, s, s * 0.75, "#FFFDF4", { gloss: 0.4, wobble: 0.08, t: 1 }); blob(g, s * 0.05, -s * 0.05, s * 0.38, s * 0.36, "#FFB000", { gloss: 0.6 }); break;
      case "cherry": g.strokeStyle = "#4F8F33"; g.lineWidth = s * 0.1; g.beginPath(); g.moveTo(-s * 0.35, s * 0.1); g.quadraticCurveTo(0, -s * 0.9, s * 0.2, -s * 0.9); g.moveTo(s * 0.4, s * 0.15); g.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.2, -s * 0.9); g.stroke(); blob(g, -s * 0.38, s * 0.35, s * 0.38, s * 0.38, "#E8504F", { gloss: 0.6 }); blob(g, s * 0.42, s * 0.4, s * 0.38, s * 0.38, "#D63A3A", { gloss: 0.6 }); break;
      case "melon": g.beginPath(); g.arc(0, -s * 0.2, s, 0, Math.PI); g.closePath(); clayFill(g, "#2FA866", 0, 0, s); g.beginPath(); g.arc(0, -s * 0.2, s * 0.82, 0, Math.PI); g.closePath(); clayFill(g, "#FF6F7F", 0, 0, s * 0.8); for (let i = 0; i < 5; i++) blob(g, (i - 2) * s * 0.3, s * 0.12 + (i % 2) * s * 0.15, s * 0.05, s * 0.08, "#2B1A1A"); break;
      case "popsicle": g.fillStyle = "#D9A066"; g.fillRect(-s * 0.1, s * 0.4, s * 0.2, s * 0.7); rr(g, -s * 0.5, -s * 0.9, s, s * 1.4, s * 0.45); clayFill(g, "#9B5DE5", 0, -s * 0.2, s * 0.7); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-s * 0.5, -s * 0.2, s, s * 0.2); break;
      case "candy": for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.45, 0); g.lineTo(sd * s * 1.05, -s * 0.4); g.lineTo(sd * s * 1.05, s * 0.4); g.closePath(); clayFill(g, "#FF8FB1", sd * s * 0.8, 0, s * 0.4); } blob(g, 0, 0, s * 0.55, s * 0.5, "#FF6F91", { gloss: 0.6 }); g.strokeStyle = "#FFF4E2"; g.lineWidth = s * 0.1; g.beginPath(); g.arc(0, 0, s * 0.3, 0.5, 2.6); g.stroke(); break;
      case "burger": blob(g, 0, s * 0.45, s * 0.85, s * 0.25, "#E3A563"); blob(g, 0, s * 0.18, s * 0.92, s * 0.18, "#6B3B1F"); blob(g, 0, 0, s * 0.95, s * 0.1, "#74C94E"); blob(g, 0, -s * 0.12, s * 0.9, s * 0.08, "#FFC93C"); blob(g, 0, -s * 0.42, s * 0.85, s * 0.42, "#E3A563", { gloss: 0.5 }); for (let i = 0; i < 4; i++) blob(g, (i - 1.5) * s * 0.3, -s * 0.6, s * 0.04, s * 0.03, "#FFF4E2"); break;
      case "berry": g.beginPath(); g.moveTo(0, s * 0.95); g.bezierCurveTo(-s * 1.1, s * 0.1, -s * 0.8, -s * 0.8, 0, -s * 0.55); g.bezierCurveTo(s * 0.8, -s * 0.8, s * 1.1, s * 0.1, 0, s * 0.95); clayFill(g, "#E8504F", 0, 0, s); for (let i = 0; i < 7; i++) blob(g, Math.cos(i * 2.1) * s * 0.4, Math.sin(i * 1.3) * s * 0.35 + s * 0.05, s * 0.05, s * 0.07, "#FFE38A"); for (const a of [-0.6, 0, 0.6]) blob(g, Math.sin(a) * s * 0.3, -s * 0.65, s * 0.12, s * 0.28, "#4FAF6A", { rot: a }); break;
      case "pretzel": g.strokeStyle = "#B9784A"; g.lineWidth = s * 0.26; g.lineCap = "round"; g.beginPath(); g.arc(-s * 0.32, -s * 0.05, s * 0.45, 0.3, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(s * 0.32, -s * 0.05, s * 0.45, Math.PI * 1.1, Math.PI * 2.7); g.stroke(); for (let i = 0; i < 5; i++) blob(g, (i - 2) * s * 0.3, -s * 0.35 + (i % 2) * s * 0.4, s * 0.05, s * 0.04, "#FFFFFF"); break;
    }
    g.restore();
  }

  private drawPip(g: G, mood: "happy" | "wow" | "sad") {
    const p = this.pip, ch = this.pip.chew;
    this.sprite(g, this.host(mood), p.x, p.y, p.h, { sy: 1 + Math.sin(ch * Math.PI * 4) * 0.05 + Math.sin(this.t * 3) * 0.015, sx: 1 - Math.sin(ch * Math.PI * 4) * 0.03 });
  }

  private drawClaw(g: G) {
    const c = this.claw;
    if (c.on <= 0.01) return;
    const im = this.img("/brand/kranky.webp");
    if (!im) return;
    const h = Math.min(160, this.H * 0.2) * c.on;
    this.sprite(g, "/brand/kranky.webp", this.W / 2, this.box.y + h * 0.9, h, { alpha: c.on });
  }

  protected drawBackground(g: G) {
    if (!this.cards.length) this.cards = FOODS.slice(0, 4).flatMap((f, i) => [f, f].map((food, j) => ({ food, x: 0, y: 0, w: 0, h: 0, open: (i + j) % 3 === 0 ? 1 : 0, want: 0, matched: false, eat: 0, slot: i * 2 + j, mx: 0, my: 0, moving: 0, wig: 0 })));
    this.layout();
    this.drawKitchen(g);
    for (const c of this.cards) this.drawCard(g, c);
    this.drawPip(g, "happy");
  }

  protected draw(g: G) {
    this.drawKitchen(g);
    for (const c of this.cards) if (!(c.matched && c.eat > 0) && !c.moving) this.drawCard(g, c);
    this.drawClaw(g);
    for (const c of this.cards) if (c.moving) { shadow(g, c.x + c.w / 2, this.slots[c.slot].y + c.h, c.w * 0.4, 8, 0.25); this.drawCard(g, c); }
    this.drawPip(g, this.hud.host.mood);
    for (const c of this.cards) if (c.matched && c.eat > 0 && c.eat < 1) this.drawCard(g, c);
  }
}
