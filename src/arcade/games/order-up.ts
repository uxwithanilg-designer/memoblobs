// Order Up! — remember each customer's cake, then build it layer by layer in Bonbon's cake shop.
// Unlimited levels: taller cakes, shorter looks, toppings, and double orders on the hardest levels.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, spriteUrl, type CastId, type GameMeta, type Mood } from "../engine";
import { blob, clayFill, clayText, darken, lighten, rr, shadow, star, type G } from "../paint";

type Flavor = "choc" | "straw" | "vanilla" | "mint" | "blue" | "lemon";
type Top = "cherry" | "candle" | "sprinkles" | "berry" | "star";
const FLAVORS: Flavor[] = ["choc", "straw", "vanilla", "mint", "blue", "lemon"];
const TOPS: Top[] = ["cherry", "candle", "sprinkles", "berry", "star"];
const FL: Record<Flavor, { c: string; name: string }> = {
  choc: { c: "#7B4A2E", name: "Choco" }, straw: { c: "#FF8FB1", name: "Straw" }, vanilla: { c: "#FFF1C9", name: "Vanilla" },
  mint: { c: "#8FE3C0", name: "Mint" }, blue: { c: "#6F7FE8", name: "Blue" }, lemon: { c: "#FFE15A", name: "Lemon" },
};
const TOP_NAME: Record<Top, string> = { cherry: "Cherry", candle: "Candle", sprinkles: "Sprinkle", berry: "Berry", star: "Star" };
const CUSTOMERS: CastId[] = ["momo", "pip", "gloop", "hoot", "noodle", "zib", "tiki", "kranky", "bolt"];
const VOICED = new Set(["pip", "gloop", "hoot", "noodle", "zib", "tiki", "bolt"]);
const SPRITES = CUSTOMERS.flatMap((id) => [spriteUrl(id, "happy"), spriteUrl(id, "wow")]);

interface Cake { layers: Flavor[]; tops: Top[] }
interface Btn { kind: "f" | "t"; id: Flavor | Top; x: number; y: number; r: number; press: number; wig: number }
interface Piece { kind: "f" | "t"; id: Flavor | Top; x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number }
type Phase = "enter" | "show" | "build" | "serve" | "oops" | "done";

export default class OrderUp extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "order-up", title: "Order Up!", host: "bonbon", style: "rounds",
    music: { calm: "a:cafe_calm", action: "a:cafe_action" },
    sounds: ["a:plop", "a:register", "a:topple", "a:nomnom", "a:bell", "a:tink", "a:giggle", "gibberK", "v:pip_happy", "v:gloop_happy", "v:hoot_happy", "v:noodle_happy", "v:zib_happy", "v:tiki_happy", "v:bolt_happy"],
    sprites: SPRITES, voicePitch: 1.25, transition: "curtain",
  };
  private cakes: Cake[] = [];
  private ci = 0;
  private built: { layers: { f: Flavor; drop: number }[]; tops: { t: Top; drop: number }[] } = { layers: [], tops: [] };
  private phase: Phase = "enter";
  private showLeft = 0; private showTotal = 1; private showT = 3;
  private mistakes = 0;
  private nf = 4; private nt = 0;
  private btns: Btn[] = [];
  private pieces: Piece[] = [];
  private serving: { cake: Cake; u: number } | null = null;
  private cust = { id: "momo" as CastId, in: 1, mood: "happy" as Mood, hop: 0 };
  private custBag = new Bag<CastId>(CUSTOMERS);
  private recent = new Recent(20);
  private bon = { chew: 0 };
  // layout
  private col = { x: 0, w: 0 };
  private win = { x: 0, y: 0, w: 0, h: 0 };
  private bub = { x: 0, y: 0, w: 0, h: 0 };
  private zoneTop = 0; private counterY = 0; private plateX = 0; private cakeW = 140;
  private bonX = 0; private bonH = 120;

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area;
    const cw = Math.min(this.W, 760), cx = (this.W - cw) / 2;
    this.col = { x: cx, w: cw };
    const topH = A.h * 0.34;
    this.zoneTop = A.y + topH;
    this.counterY = A.y + A.h * (this.nt ? 0.69 : 0.74);
    this.win = { x: cx + cw * 0.6, y: A.y + 8, w: cw * 0.4 - 10, h: topH - 14 };
    this.bub = { x: cx + 10, y: A.y + 8, w: cw * 0.6 - 24, h: topH - 14 };
    this.plateX = cx + cw * 0.62;
    this.cakeW = Math.min(170, cw * 0.38);
    this.bonX = cx + cw * 0.19;
    this.bonH = clamp((this.counterY - this.zoneTop) * 0.92, 90, 230);
    // buttons on the counter front
    const rows = this.nt ? 2 : 1;
    const top = this.counterY + 22, bot = A.y + A.h - 4, rowH = (bot - top) / rows;
    const maxN = Math.max(this.nf, this.nt || 0);
    const r = Math.max(18, Math.min(38, (cw - 20) / maxN / 2 - 7, rowH / 2 - 12));
    const make = (kind: "f" | "t", ids: (Flavor | Top)[], row: number) => ids.map((id, i) => {
      const sp = Math.min((cw - 20) / ids.length, r * 2 + 30);
      const old = this.btns.find((b) => b.kind === kind && b.id === id);
      return { kind, id, x: this.W / 2 + (i - (ids.length - 1) / 2) * sp, y: top + rowH * row + rowH / 2 - 8, r, press: old?.press ?? 0, wig: old?.wig ?? 0 };
    });
    this.btns = [...make("f", FLAVORS.slice(0, this.nf), 0), ...(this.nt ? make("t", TOPS.slice(0, this.nt), 1) : [])];
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.nf = byDiff(d, { easy: 4, medium: 5, hard: 6 });
    const tops = byDiff(d, { easy: L >= 5 ? 1 : 0, medium: L >= 10 ? 2 : L >= 3 ? 1 : 0, hard: L >= 7 ? 2 : L >= 3 ? 1 : 0 });
    this.nt = tops ? byDiff(d, { easy: 3, medium: 4, hard: 5 }) : 0;
    const two = byDiff(d, { easy: false, medium: L >= 14, hard: L >= 8 });
    let layers = byDiff(d, { easy: Math.min(5, 2 + Math.floor((L - 1) / 2)), medium: Math.min(6, 3 + Math.floor((L - 1) / 2)), hard: Math.min(8, 4 + Math.floor((L - 1) / 2)) });
    if (two) layers = Math.max(3, Math.ceil(layers * 0.6));
    this.btns = [];
    this.layout();
    const make = (): Cake => {
      const ls: Flavor[] = [];
      while (ls.length < layers) {
        const f = this.rng.pick(FLAVORS.slice(0, this.nf));
        if (ls.length >= 2 && ls[ls.length - 1] === f && ls[ls.length - 2] === f) continue;
        ls.push(f);
      }
      const ts = this.rng.shuffle(TOPS.slice(0, this.nt)).slice(0, tops);
      return { layers: ls, tops: ts };
    };
    let cakes: Cake[] = [];
    for (let tries = 0; tries < 25; tries++) {
      cakes = Array.from({ length: two ? 2 : 1 }, make);
      if (!this.recent.has(this.sig(cakes))) break;
    }
    this.recent.add(this.sig(cakes));
    this.cakes = cakes; this.ci = 0; this.mistakes = 0;
    this.built = { layers: [], tops: [] }; this.pieces = []; this.serving = null;
    const items = cakes.reduce((n, c) => n + c.layers.length + c.tops.length, 0);
    this.showT = byDiff(d, { easy: ramp(L, 4, -0.15, 2), medium: ramp(L, 3.5, -0.15, 1.6), hard: ramp(L, 3, -0.12, 1.2) }) + items * 0.3;
    this.cust = { id: this.custBag.next(this.rng), in: 0, mood: "happy", hop: 0 };
    this.phase = "enter";
    this.music(items >= 8 ? "action" : "calm");
    this.sfx("a:bell", { gain: 0.5, delay: 0.2 });
    this.tween(this.cust, { in: 1 }, 0.7, ease.back, 0.15);
    if (two) this.after(0.4, () => this.banner("DOUBLE ORDER!", "Remember both cakes", "pink"));
    if (tops && (L === 3 || L === 5) && this.attempt === 0) this.after(0.4, () => this.banner("TOPPINGS!", "Put them on last", "mint"));
    this.react("happy", this.rng.pick(["Welcome to my shop!", "What would you like?", "Ooh, a new order!", "Cake time!"]));
    this.after(1.0, () => this.showOrder(this.showT));
  }

  private sig(cs: Cake[]) { return cs.map((c) => c.layers.join(",") + "|" + c.tops.join(",")).join("/"); }

  private showOrder(t: number) {
    this.phase = "show"; this.showLeft = t; this.showTotal = t;
    this.cust.hop = 1;
    if (VOICED.has(this.cust.id)) this.sfx(`v:${this.cust.id}_happy`, { gain: 0.6, duck: false });
    else if (this.cust.id === "kranky") this.sfx("gibberK", { gain: 0.6 }); else this.sfx("a:giggle", { gain: 0.5 });
    this.hint(this.cakes.length - this.ci > 1 ? "Remember BOTH cakes! 🎂🎂" : "Remember the cake! Bottom to top 🎂");
  }

  private startBuild() {
    this.phase = "build"; this.timerBar(null);
    this.sfx("a:tink", { gain: 0.4 });
    this.hint(this.built.layers.length ? "Keep building! 🍰" : "Build it! Bottom layer first 👇");
  }

  onKey(key: string) {
    const k = "123456".indexOf(key), t = "qwert".indexOf(key.toLowerCase());
    const b = k >= 0 ? this.btns.filter((x) => x.kind === "f")[k] : t >= 0 ? this.btns.filter((x) => x.kind === "t")[t] : undefined;
    if (b) this.press(b);
  }

  protected onDown(x: number, y: number) {
    const b = this.btns.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r + 8);
    if (b) this.press(b);
  }

  private cakeTopY() {
    const lh = this.layerH(this.cakes[this.ci]?.layers.length ?? 4);
    return this.counterY - 6 - this.built.layers.length * lh;
  }

  private layerH(n: number) { return Math.min(34, (this.counterY - this.zoneTop - 34) / (n + 1.2)); }

  private press(b: Btn) {
    if (this.phase !== "build") return;
    b.press = 1; this.tween(b, { press: 0 }, 0.25);
    const cake = this.cakes[this.ci], B = this.built, y = this.cakeTopY();
    if (b.kind === "f") {
      const f = b.id as Flavor;
      if (B.layers.length < cake.layers.length && cake.layers[B.layers.length] === f) {
        const l = { f, drop: 1 }; B.layers.push(l); this.tween(l, { drop: 0 }, 0.32, ease.out);
        this.sfx("a:plop", { x: this.plateX, gain: 0.7, rate: 0.9 + B.layers.length * 0.05, delay: 0.2 });
        this.good(this.plateX, y - 20, 40);
        this.checkDone();
      } else {
        B.layers.push({ f, drop: 0 });
        this.wrong(this.plateX, y);
      }
    } else {
      const t = b.id as Top;
      if (B.layers.length < cake.layers.length) { b.wig = 1; this.sfx("a:tink", { gain: 0.4 }); this.hint("Layers first, toppings last! 🍰"); return; }
      if (cake.tops.includes(t) && !B.tops.some((x) => x.t === t)) {
        const o = { t, drop: 1 }; B.tops.push(o); this.tween(o, { drop: 0 }, 0.3, ease.out);
        this.sfx("a:tink", { x: this.plateX, gain: 0.6, delay: 0.15 });
        this.good(this.plateX, y - 30, 40);
        this.checkDone();
      } else {
        B.tops.push({ t, drop: 0 });
        this.wrong(this.plateX, y);
      }
    }
  }

  private checkDone() {
    const c = this.cakes[this.ci], B = this.built;
    if (B.layers.length === c.layers.length && B.tops.length === c.tops.length) this.after(0.4, () => this.serve());
    else if (B.layers.length === c.layers.length && c.tops.length && !B.tops.length) this.hint("Now the toppings! 🍒");
  }

  private serve() {
    this.phase = "serve"; this.hint(null);
    this.serving = { cake: { layers: this.built.layers.map((l) => l.f), tops: this.built.tops.map((t) => t.t) }, u: 0 };
    this.built = { layers: [], tops: [] };
    this.tween(this.serving, { u: 1 }, 0.6, ease.inOut);
    this.sfx("a:register", { gain: 0.7, delay: 0.35 });
    this.after(0.6, () => {
      this.serving = null; this.cust.mood = "wow"; this.cust.hop = 1;
      if (VOICED.has(this.cust.id)) this.sfx(`v:${this.cust.id}_happy`, { gain: 0.6, rate: 1.1, duck: false });
      this.burst(this.win.x + this.win.w / 2, this.win.y + this.win.h * 0.4, { n: 18, colors: ["#FF6F91", "#FFD25A", "#FFFFFF"], kind: "star", speed: 260 });
      this.ci++;
      if (this.ci < this.cakes.length) {
        this.after(0.5, () => { this.cust.mood = "happy"; this.startBuild(); this.hint("Now the 2nd cake! 🎂"); });
      } else {
        this.phase = "done";
        this.react("happy", this.rng.pick(["Order up!", "Yummy work!", "Best baker ever!", "Ka-ching!"]));
        this.levelClear({ perfect: this.mistakes === 0, title: this.mistakes === 0 ? "PERFECT CAKE!" : "ORDER UP!" });
      }
    });
  }

  private wrong(x: number, y: number) {
    this.phase = "oops"; this.mistakes++;
    const lh = this.layerH(this.cakes[this.ci].layers.length);
    this.built.layers.forEach((l, i) => this.pieces.push({ kind: "f", id: l.f, x: this.plateX, y: this.counterY - 6 - i * lh, vx: (Math.random() - 0.5) * 380, vy: -120 - Math.random() * 260, rot: 0, vr: (Math.random() - 0.5) * 7, w: this.cakeW * (1 - i * 0.03), h: lh }));
    this.built.tops.forEach((t) => this.pieces.push({ kind: "t", id: t.t, x: this.plateX, y: y - 10, vx: (Math.random() - 0.5) * 300, vy: -300, rot: 0, vr: (Math.random() - 0.5) * 9, w: lh, h: lh }));
    this.built = { layers: [], tops: [] };
    this.sfx("a:topple", { x, gain: 0.8 });
    this.bad(x, y, { line: this.rng.pick(["Oh no, my cake!", "Wobble… CRASH!", "That's not the order!", "Oopsie!"]) });
    this.cust.mood = "wow";
    this.after(0.9, () => { this.sfx("a:nomnom", { gain: 0.7 }); this.bon.chew = 1; this.react("happy", "Mmm… I'll eat that one!", false); });
    const allowed = byDiff(this.diff, { easy: 2, medium: 1, hard: 0 });
    if (this.mistakes > allowed) this.after(1.6, () => this.levelFail("Wrong cake!"));
    else this.after(1.8, () => { this.cust.mood = "happy"; this.banner("PEEK AGAIN!", allowed - this.mistakes === 0 ? "Last chance!" : "Look carefully", "gold"); this.showOrder(Math.max(1.2, this.showT * 0.6)); });
  }

  protected update(dt: number) {
    if (this.phase === "show") {
      this.showLeft -= dt;
      this.timerBar(this.showLeft / this.showTotal, "#FF6F91");
      if (this.showLeft <= 0) this.startBuild();
    }
    for (const p of this.pieces) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    this.pieces = this.pieces.filter((p) => p.y < this.H + 120);
    for (const b of this.btns) b.wig = Math.max(0, b.wig - dt * 2.5);
    this.bon.chew = Math.max(0, this.bon.chew - dt * 0.8);
    this.cust.hop = Math.max(0, this.cust.hop - dt * 2);
  }

  // ------------------------------------------------------------ drawing
  private drawLayer(g: G, f: Flavor, cx: number, y: number, w: number, h: number) {
    const c = FL[f].c, x = cx - w / 2, r = Math.min(h * 0.4, 12);
    rr(g, x, y - h, w, h, r); clayFill(g, c, cx - w * 0.25, y - h * 0.8, w * 0.7, { gloss: 0.3 });
    rr(g, x, y - h, w, h, r); g.strokeStyle = darken(c, 0.35); g.lineWidth = 2; g.stroke();
    const fr = f === "vanilla" ? "#FFFFFF" : lighten(c, 0.45);
    rr(g, x + 2, y - h + 1, w - 4, Math.max(4, h * 0.3), Math.max(2, h * 0.15)); g.fillStyle = fr; g.fill();
    for (let k = 0; k < 4; k++) blob(g, x + w * (0.14 + k * 0.24), y - h + h * 0.36, Math.max(2, w * 0.035), Math.max(3, h * 0.2), fr);
  }

  private drawTop(g: G, t: Top, x: number, y: number, s: number) {
    g.save(); g.translate(x, y);
    switch (t) {
      case "cherry":
        g.strokeStyle = "#4F8F33"; g.lineWidth = Math.max(2, s * 0.09); g.beginPath(); g.moveTo(0, -s * 0.5); g.quadraticCurveTo(s * 0.1, -s * 1.1, s * 0.35, -s * 1.15); g.stroke();
        blob(g, 0, -s * 0.38, s * 0.38, s * 0.38, "#E8504F", { gloss: 0.6 }); break;
      case "candle": {
        rr(g, -s * 0.12, -s * 1.0, s * 0.24, s * 1.0, s * 0.06); g.fillStyle = "#7CC8FF"; g.fill();
        g.fillStyle = "#FFFFFF"; for (let i = 0; i < 3; i++) g.fillRect(-s * 0.12, -s * (0.25 + i * 0.3), s * 0.24, s * 0.08);
        const fl = 1 + Math.sin(this.t * 18) * 0.12;
        blob(g, 0, -s * 1.2, s * 0.14 * fl, s * 0.24 * fl, "#FFB000", { gloss: 0.7 }); blob(g, 0, -s * 1.16, s * 0.06, s * 0.11, "#FFF4B0"); break;
      }
      case "sprinkles": {
        const cols = ["#FF6F91", "#7CC8FF", "#FFD25A", "#74C94E", "#9B5DE5"];
        for (let i = 0; i < 9; i++) { g.save(); g.translate((i - 4) * s * 0.2, -s * 0.12 - (i % 3) * s * 0.1); g.rotate(i * 1.3); g.fillStyle = cols[i % 5]; rr(g, -s * 0.12, -s * 0.04, s * 0.24, s * 0.08, s * 0.04); g.fill(); g.restore(); }
        break;
      }
      case "berry":
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-s * 0.55, -s * 0.35, -s * 0.4, -s * 0.85, 0, -s * 0.7); g.bezierCurveTo(s * 0.4, -s * 0.85, s * 0.55, -s * 0.35, 0, 0);
        clayFill(g, "#E8504F", 0, -s * 0.4, s * 0.5);
        for (const a of [-0.6, 0, 0.6]) blob(g, Math.sin(a) * s * 0.18, -s * 0.78, s * 0.07, s * 0.16, "#4FAF6A", { rot: a });
        for (let i = 0; i < 5; i++) blob(g, Math.cos(i * 2.1) * s * 0.18, -s * 0.4 + Math.sin(i * 1.3) * s * 0.15, s * 0.025, s * 0.04, "#FFE38A");
        break;
      case "star": star(g, 0, -s * 0.5, s * 0.5, "#FFD25A", this.t * 0.8); break;
    }
    g.restore();
  }

  /** whole cake standing on y (plate level) */
  private drawCake(g: G, cake: { layers: { f: Flavor; drop: number }[]; tops: { t: Top; drop: number }[] }, cx: number, y: number, w: number, lh: number, plate = true) {
    if (plate) { shadow(g, cx, y + 4, w * 0.62, 8, 0.25); g.fillStyle = "#EAF6FF"; g.beginPath(); g.ellipse(cx, y, w * 0.62, Math.max(5, lh * 0.32), 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#B8C4D6"; g.lineWidth = 2; g.stroke(); }
    let top = y - 2;
    cake.layers.forEach((l, i) => {
      const lw = w * (1 - i * 0.035), dy = -l.drop * 160;
      g.save(); g.globalAlpha *= 1 - l.drop * 0.5;
      this.drawLayer(g, l.f, cx, top + dy, lw, lh);
      g.restore();
      top -= lh;
    });
    const n = cake.tops.length, tw = w * (1 - cake.layers.length * 0.035);
    cake.tops.forEach((t, j) => {
      const tx = cx + (n > 1 ? (j - (n - 1) / 2) * tw * 0.42 : 0);
      g.save(); g.globalAlpha *= 1 - t.drop * 0.5;
      this.drawTop(g, t.t, tx, top + 2 - t.drop * 120, Math.max(14, lh * 1.05));
      g.restore();
    });
  }

  private plain(c: Cake) { return { layers: c.layers.map((f) => ({ f, drop: 0 })), tops: c.tops.map((t) => ({ t, drop: 0 })) }; }

  private drawShop(g: G) {
    const W = this.W, H = this.H;
    for (let x = 0, i = 0; x < W; x += 26, i++) { g.fillStyle = i % 2 ? "#FFD3E3" : "#FFE4EE"; g.fillRect(x, 0, 26, H); }
    // hanging lamps
    for (const fx of [0.38, 0.86]) {
      const lx = this.col.x + this.col.w * fx, ly = this.zoneTop + 6;
      g.strokeStyle = "rgba(90,52,32,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, this.win.y + this.win.h); g.lineTo(lx, ly); g.stroke();
      blob(g, lx, ly + 8, 16, 11, "#FFD25A", { gloss: 0.5 });
      g.fillStyle = "rgba(255,240,180,0.18)"; g.beginPath(); g.arc(lx, ly + 14, 40, 0, Math.PI * 2); g.fill();
    }
    // pickup window with awning
    const w = this.win;
    rr(g, w.x - 6, w.y + 10, w.w + 12, w.h - 4, 18); g.fillStyle = "#C98A4B"; g.fill();
    rr(g, w.x + 4, w.y + 20, w.w - 8, w.h - 26, 12);
    const sky = g.createLinearGradient(0, w.y, 0, w.y + w.h); sky.addColorStop(0, "#9FDBFF"); sky.addColorStop(1, "#E3F6FF");
    g.fillStyle = sky; g.fill();
    blob(g, w.x + w.w * 0.3, w.y + w.h * 0.35, w.w * 0.14, w.h * 0.06, "#FFFFFF");
    const n = 6, sw = (w.w + 16) / n;
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(w.x - 8 + i * sw, w.y); g.lineTo(w.x - 8 + (i + 1) * sw, w.y); g.lineTo(w.x - 8 + (i + 1) * sw, w.y + 18);
      g.arc(w.x - 8 + (i + 0.5) * sw, w.y + 18, sw / 2, 0, Math.PI); g.closePath();
      g.fillStyle = i % 2 ? "#FFFFFF" : "#FF6F91"; g.fill();
    }
  }

  private drawCustomer(g: G) {
    const w = this.win, c = this.cust;
    const x = lerp(w.x + w.w + 80, w.x + w.w / 2, c.in);
    g.save(); rr(g, w.x + 4, w.y + 20, w.w - 8, w.h - 26, 12); g.clip();
    this.sprite(g, spriteUrl(c.id, c.mood), x, w.y + w.h + 4 - Math.sin(c.hop * Math.PI) * 10, w.h * 0.78, { sy: 1 + Math.sin(this.t * 3) * 0.015 });
    g.restore();
    rr(g, w.x - 8, w.y + w.h - 10, w.w + 16, 14, 7); g.fillStyle = "#E3A563"; g.fill();
  }

  private drawBubble(g: G) {
    const b = this.bub;
    shadow(g, b.x + b.w / 2, b.y + b.h + 2, b.w * 0.4, 6, 0.15);
    g.fillStyle = "#FFFFFF";
    rr(g, b.x, b.y, b.w, b.h, 22); g.fill();
    g.beginPath(); g.moveTo(b.x + b.w - 4, b.y + b.h * 0.55); g.lineTo(b.x + b.w + 16, b.y + b.h * 0.68); g.lineTo(b.x + b.w - 4, b.y + b.h * 0.75); g.fill();
    rr(g, b.x, b.y, b.w, b.h, 22); g.strokeStyle = "#FFB3CC"; g.lineWidth = 3; g.stroke();
    const showing = this.phase === "show" || this.hud.status !== "playing";
    const list = this.cakes.slice(this.ci);
    if (showing && list.length) {
      const n = list.length, maxL = Math.max(...list.map((c) => c.layers.length));
      const lh = Math.min(22, (b.h - 46) / (maxL + 1.3)), w = Math.min(110, (b.w - 30) / n - 10);
      list.forEach((c, i) => this.drawCake(g, this.plain(c), b.x + (b.w * (i + 0.5)) / n, b.y + b.h - 16, w, lh));
      if (this.phase === "show") {
        const u = clamp(this.showLeft / this.showTotal, 0, 1), rx = b.x + b.w - 22, ry = b.y + 22;
        g.strokeStyle = "rgba(35,48,90,0.15)"; g.lineWidth = 5; g.beginPath(); g.arc(rx, ry, 11, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = "#FF6F91"; g.beginPath(); g.arc(rx, ry, 11, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); g.stroke();
      }
    } else if (this.phase !== "done") {
      clayText(g, "?", b.x + b.w / 2, b.y + b.h * 0.48, Math.min(70, b.h * 0.45), { fill: "#FF8FB1" });
      clayText(g, this.cakes.length > 1 ? `Cake ${Math.min(this.ci + 1, this.cakes.length)} of ${this.cakes.length}` : "From memory!", b.x + b.w / 2, b.y + b.h * 0.82, 15, { fill: "#FFFFFF", gloss: false });
    } else clayText(g, "Thank you! ♥", b.x + b.w / 2, b.y + b.h / 2, Math.min(28, b.w * 0.12), { fill: "#FF6F91" });
  }

  private drawCounter(g: G) {
    const y = this.counterY, W = this.W, H = this.H;
    rr(g, -10, y, W + 20, H - y + 20, 0); g.fillStyle = "#B9784A"; g.fill();
    for (let x = 0, i = 0; x < W; x += 40, i++) { g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)"; g.fillRect(x, y + 16, 40, H - y); }
    rr(g, -10, y - 4, W + 20, 20, 10); g.fillStyle = "#FFF4E2"; g.fill();
    g.fillStyle = "rgba(201,138,75,0.35)"; g.fillRect(0, y + 12, W, 4);
  }

  private drawBtn(g: G, b: Btn) {
    const disabled = b.kind === "t" && this.cakes[this.ci] && this.built.layers.length < (this.cakes[this.ci]?.layers.length ?? 0);
    g.save(); g.translate(b.x + Math.sin(b.wig * 30) * b.wig * 5, b.y); g.scale(1 - b.press * 0.08, 1 - b.press * 0.08);
    if (disabled && this.phase === "build") g.globalAlpha = 0.6;
    shadow(g, 0, b.r + 3, b.r * 0.85, 6, 0.3);
    blob(g, 0, 0, b.r, b.r, b.kind === "f" ? "#FFFFFF" : "#FFF4E2", { gloss: 0.4 });
    if (b.kind === "f") {
      g.save(); g.beginPath(); g.arc(0, 0, b.r * 0.78, 0, Math.PI * 2); g.clip();
      this.drawLayer(g, b.id as Flavor, 0, b.r * 0.42, b.r * 1.7, b.r * 0.85);
      g.restore();
    } else this.drawTop(g, b.id as Top, 0, b.r * 0.42, b.r * 0.9);
    g.restore();
    clayText(g, b.kind === "f" ? FL[b.id as Flavor].name : TOP_NAME[b.id as Top], b.x, b.y + b.r + 13, Math.max(11, Math.min(14, b.r * 0.4)), { fill: "#FFFFFF", gloss: false });
  }

  private drawBonbon(g: G) {
    const ch = this.bon.chew, mood = this.hud.host.mood;
    this.sprite(g, this.host(mood), this.bonX, this.counterY + this.bonH * 0.12, this.bonH, { sy: 1 + Math.sin(ch * Math.PI * 8) * 0.04 * ch + Math.sin(this.t * 2.6) * 0.012, sx: 1 - Math.sin(ch * Math.PI * 8) * 0.03 * ch });
  }

  private scene(g: G) {
    this.drawShop(g);
    this.drawCustomer(g);
    this.drawBubble(g);
    this.drawBonbon(g);
    this.drawCounter(g);
    const lh = this.layerH(this.cakes[this.ci]?.layers.length ?? this.cakes[0]?.layers.length ?? 4);
    if (this.hud.status === "playing") this.drawCake(g, this.built, this.plateX, this.counterY - 4, this.cakeW, lh);
    if (this.serving) {
      const u = this.serving.u, w = this.win;
      g.save(); g.translate(lerp(this.plateX, w.x + w.w / 2, u), lerp(this.counterY - 4, w.y + w.h - 6, u) - Math.sin(u * Math.PI) * 40); g.scale(1 - u * 0.45, 1 - u * 0.45);
      this.drawCake(g, this.plain(this.serving.cake), 0, 0, this.cakeW, lh);
      g.restore();
    }
    for (const p of this.pieces) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.kind === "f") this.drawLayer(g, p.id as Flavor, 0, p.h / 2, p.w, p.h); else this.drawTop(g, p.id as Top, 0, 0, p.w);
      g.restore();
    }
    for (const b of this.btns) this.drawBtn(g, b);
  }

  protected drawBackground(g: G) {
    if (!this.cakes.length) { this.cakes = [{ layers: ["choc", "straw", "vanilla"], tops: ["cherry"] }]; this.nt = 3; this.btns = []; }
    this.layout();
    this.scene(g);
    this.drawCake(g, this.plain(this.cakes[0]), this.plateX, this.counterY - 4, this.cakeW, this.layerH(4));
  }

  protected draw(g: G) { this.scene(g); }
}
