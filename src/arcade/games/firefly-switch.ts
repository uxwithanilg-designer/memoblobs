// Firefly Switch — "Lights Out" in a night meadow. Tapping a glass jar wakes (or puts to sleep) its
// firefly AND its neighbours. Light every jar! Unlimited levels: 3×3 → 7×7, more scramble taps,
// X-pattern neighbours, wrap-around edges, mossy rocks and a race against the sunrise.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, Rng, type GameMeta, type Tone } from "../engine";
import { blob, clayPanel, clayText, eye, mix, mouth, rgba, rr, shadow, star, type G } from "../paint";

interface Jar { glow: number; delay: number; bounce: number; flash: number; wig: number; ph: number }
interface Fly { x: number; y: number; vx: number; vy: number; life: number; ph: number }
type Phase = "intro" | "play" | "win" | "out";

export default class FireflySwitch extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "firefly-switch", title: "Firefly Switch", host: "noodle", style: "rounds",
    music: { calm: "a:firefly_calm", action: "a:firefly_action" },
    sounds: ["a:twinkle", "a:chime", "a:bonk", "a:snore", "a:tink", "a:blip", "a:buzz", "a:croak", "a:tweet", "sparkle", "v:noodle_laugh"],
    voicePitch: 1.2, transition: "blink",
  };
  private n = 3;
  private lit: boolean[] = [];
  private blocked: boolean[] = [];
  private need: boolean[] = [];   // remaining solution = scramble ⊕ player presses
  private jars: Jar[] = [];
  private pattern: "plus" | "x" = "plus";
  private wrap = false; private timed = false;
  private par = 0; private taps = 0; private hints = 0; private lastHint = -1; private wrongs = 0;
  private phase: Phase = "intro";
  private budget = 0; private startT = 0; private lastBar = -1; private dawn = 0;
  private rays: { a: number; b: number; life: number }[] = [];
  private flies: Fly[] = [];
  private amb = Array.from({ length: 18 }, (_, i) => ({ x: (i * 0.618034) % 1, y: 0.15 + ((i * 0.38197) % 1) * 0.8, ph: i * 1.7, sp: 0.6 + (i % 4) * 0.2 }));
  private stars = Array.from({ length: 50 }, (_, i) => ({ x: (i * 0.7548776) % 1, y: ((i * 0.5698403) % 1) * 0.55, ph: i * 2.3 }));
  private board = { x: 0, y: 0, s: 300, cs: 100 };
  private noodle = { x: 0, y: 0, w: 300, h: 90, stretch: 0, bop: 0 };
  private btn = { x: 0, y: 0, w: 70, h: 58, press: 0 };
  private stats = { x: 0, y: 0 };
  private badge = { x: 0, y: 0, s: 40 };
  private cur = { r: 0, c: 0, on: false };
  private recent = new Recent(24);
  private twistBag = new Bag<string>(["x", "wrap", "rocks"]);
  private prevN = 0;
  private sky?: HTMLCanvasElement;

  protected onResize() { this.layout(); this.sky = undefined; }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 1.05;
    if (portrait) {
      const row = 62;
      const side0 = Math.min(this.W - 20, A.h - 64 - row - 14, 640);
      const nh = clamp((A.h - side0 - row - 14) * 0.62, 64, 112);
      const side = Math.min(this.W - 20, A.h - nh - row - 14, 640);
      const top = A.y + 4 + Math.max(0, (A.h - nh - row - 14 - side) * 0.45);
      this.board = { x: (this.W - side) / 2, y: top, s: side, cs: side / this.n };
      const ry = top + side + 8;
      this.btn = { ...this.btn, w: 74, h: 56, x: this.W - 14 - 74, y: ry };
      this.badge = { x: this.W - 14 - 74 - 12 - 50, y: ry + 3, s: 50 };
      this.stats = { x: 16, y: ry + 28 };
      this.noodle = { ...this.noodle, x: this.W / 2, y: A.y + A.h + 2, w: this.W - 16, h: nh };
    } else {
      const nh = clamp(A.h * 0.17, 80, 130);
      const side = Math.min(A.h - nh - 6, this.W * 0.5, 680);
      this.board = { x: (this.W - side) / 2, y: A.y + 4, s: side, cs: side / this.n };
      const rx = this.board.x + side, cx = rx + (this.W - rx) / 2;
      this.btn = { ...this.btn, w: 96, h: 66, x: cx - 48, y: this.board.y + side * 0.5 };
      this.badge = { x: cx - 32, y: this.board.y + side * 0.5 - 92, s: 64 };
      this.stats = { x: this.board.x / 2, y: this.board.y + 40 };
      this.noodle = { ...this.noodle, x: this.W / 2, y: A.y + A.h + 2, w: Math.min(this.W * 0.9, side * 1.9), h: nh };
    }
  }

  // ------------------------------------------------------------ logic
  private affected(i: number) {
    const n = this.n, r = Math.floor(i / n), c = i % n;
    const offs = this.pattern === "x" ? [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]] : [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    const out: number[] = [];
    for (const [dr, dc] of offs) {
      let r2 = r + dr, c2 = c + dc;
      if (this.wrap) { r2 = (r2 + n) % n; c2 = (c2 + n) % n; } else if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
      const j = r2 * n + c2;
      if (this.blocked[j] || out.includes(j)) continue;
      out.push(j);
    }
    return out;
  }
  private solved() { return this.lit.every((v, i) => v || this.blocked[i]); }
  private cellC(i: number) { const B = this.board, n = this.n; return { x: B.x + ((i % n) + 0.5) * B.cs, y: B.y + (Math.floor(i / n) + 0.5) * B.cs }; }

  private sizeAt(L: number) {
    const st = byDiff(this.diff, { easy: [1, 4, 9, 15, 22], medium: [1, 3, 7, 12, 18], hard: [0, 1, 4, 8, 13] });
    let k = 0;
    for (let i = 0; i < st.length; i++) if (L >= st[i] && st[i] > 0) k = i;
    return { n: 3 + k, j: L - st[k] + 1 };
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const { n, j } = this.sizeAt(L);
    this.n = n;
    const extra = byDiff(d, { easy: 0, medium: 1, hard: 2 });
    const k = Math.min(n * n - 2, (n - 2) * 2 + 2 + extra, n - 2 + extra + Math.floor((j - 1) * 0.7));
    this.pattern = byDiff(d, { easy: L >= 12 && L % 4 === 0, medium: L >= 8 && L % 3 === 2, hard: L >= 5 && L % 3 === 2 }) ? "x" : "plus";
    this.wrap = byDiff(d, { easy: L >= 18 && L % 5 === 3, medium: L >= 12 && L % 4 === 0, hard: L >= 8 && L % 4 === 0 });
    let rocksOn = byDiff(d, { easy: L >= 7 && L % 3 === 1, medium: L >= 5 && L % 3 === 0, hard: L >= 3 && L % 2 === 1 });
    // past the biggest meadow every level gets at least one twist (no-repeat bag)
    if (L >= byDiff(d, { easy: 22, medium: 18, hard: 13 }) && this.pattern === "plus" && !this.wrap && !rocksOn) {
      const tw = this.twistBag.next(this.rng);
      if (tw === "x") this.pattern = "x"; else if (tw === "wrap") this.wrap = true; else rocksOn = true;
    }
    const nRocks = rocksOn ? Math.min(Math.floor(n * n * 0.18), 1 + Math.floor(L / 8)) : 0;
    this.timed = byDiff(d, { easy: false, medium: L >= 16 && L % 6 === 5, hard: L >= 10 && L % 5 === 4 });
    // scramble: random presses applied to the all-lit meadow (always solvable)
    let sig = "";
    for (let tries = 0; tries < 30; tries++) {
      const cells = Array.from({ length: n * n }, (_, i) => i);
      this.blocked = new Array<boolean>(n * n).fill(false);
      for (const b of this.rng.shuffle([...cells]).slice(0, nRocks)) this.blocked[b] = true;
      this.lit = cells.map((i) => !this.blocked[i]);
      this.need = new Array<boolean>(n * n).fill(false);
      const S = this.rng.shuffle(cells.filter((i) => !this.blocked[i])).slice(0, k);
      for (const s of S) { this.need[s] = true; for (const a of this.affected(s)) this.lit[a] = !this.lit[a]; }
      sig = `${n}:${this.pattern}:${this.wrap}:${this.blocked.map(Number).join("")}:${this.lit.map(Number).join("")}`;
      if (!this.solved() && !this.recent.has(sig)) break;
    }
    this.recent.add(sig);
    this.par = this.need.filter(Boolean).length;
    this.taps = 0; this.hints = 0; this.wrongs = 0; this.lastHint = -1;
    this.jars = this.lit.map((v, i) => ({ glow: 1, delay: 0.25 + ((i * 7) % 11) * 0.06, bounce: 0, flash: 0, wig: 0, ph: i * 1.3 }));
    // start fully lit, then the scramble switches some jars off (the "Lights Out" moment)
    this.rays = []; this.flies = []; this.dawn = 0;
    this.noodle.stretch = 0;
    this.layout(); this.sky = undefined;
    this.phase = "intro"; this.lastBar = -1; this.timerBar(null);
    this.cur.r = Math.min(this.cur.r, n - 1); this.cur.c = Math.min(this.cur.c, n - 1);
    this.budget = this.timed ? Math.round(this.par * byDiff(d, { easy: 8, medium: 6, hard: 5 }) + n * 3 + 10) : 0;
    this.music(this.timed || n >= 6 || this.wrap ? "action" : "calm");
    const tw: [string, string, Tone][] = [];
    if (this.prevN && n > this.prevN) tw.push(["BIGGER MEADOW!", `${n}×${n} jars`, "mint"]);
    if (this.pattern === "x") tw.push(["X-PATTERN!", "Jars flip their corner friends", "pink"]);
    if (this.wrap) tw.push(["WRAP-AROUND!", "Edges connect to the other side", "navy"]);
    if (nRocks) tw.push(["MOSSY ROCKS!", "Rocks have no jars to flip", "gold"]);
    if (this.timed) tw.push(["BEFORE DAWN!", `Light them all in ${this.budget}s`, "red"]);
    this.prevN = n;
    tw.forEach((t, i) => this.after(0.4 + i * 1.6, () => this.banner(t[0], t[1], t[2])));
    this.react("happy", this.rng.pick(["Night night, fireflies… wait, wake up!", "Who switched off my fireflies?", "Let's light up the meadow!", "Twinkle twinkle, little jar!"]));
    this.hint(L === 1 ? "Tap a dark jar — it flips its neighbours too! ✨" : `Light every jar! · par ${this.par} taps`);
    this.after(0.5, () => this.sfx("a:snore", { gain: 0.35 }));
    this.after(0.9, () => { this.phase = "play"; this.startT = this.t; });
  }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    const b = this.btn;
    if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) { this.useHint(); return; }
    if (this.phase !== "play") return;
    const B = this.board, c = Math.floor((x - B.x) / B.cs), r = Math.floor((y - B.y) / B.cs);
    if (r < 0 || c < 0 || r >= this.n || c >= this.n) return;
    this.cur = { r, c, on: false };
    this.press(r * this.n + c);
  }

  onKey(key: string) {
    const k = key.toLowerCase(), n = this.n;
    if (k === "h") { this.useHint(); return; }
    if (this.phase !== "play") return;
    const mv: Record<string, [number, number]> = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
    if (mv[k]) {
      if (!this.cur.on) { this.cur.on = true; return; }
      this.cur.r = clamp(this.cur.r + mv[k][0], 0, n - 1); this.cur.c = clamp(this.cur.c + mv[k][1], 0, n - 1);
      return;
    }
    if (k === "enter" || k === "x") { this.cur.on = true; this.press(this.cur.r * n + this.cur.c); }
  }

  private press(i: number) {
    const c = this.cellC(i);
    if (this.blocked[i]) {
      this.jars[i].wig = 1;
      this.sfx("a:bonk", { x: c.x, gain: 0.6 });
      this.bad(c.x, c.y, { line: this.rng.pick(["That's a rock, silly!", "Bonk! No jar there!", "Rocks don't glow!"]) });
      return;
    }
    this.taps++;
    const aff = this.affected(i);
    const wasNeeded = this.need[i];
    this.need[i] = !this.need[i];
    let on = 0;
    aff.forEach((j, k) => {
      this.lit[j] = !this.lit[j];
      if (this.lit[j]) on++;
      const J = this.jars[j];
      J.delay = k * 0.05; J.bounce = 1; J.flash = 0;
      if (j !== i) this.rays.push({ a: i, b: j, life: 1 });
    });
    const up = on * 2 >= aff.length;
    aff.forEach((j, k) => { const p = this.cellC(j); this.after(k * 0.05, () => this.tone(this.note((up ? 5 : 2) + (this.lit[j] ? k : -k)), 0.3, p.x, 0.35)); });
    this.sfx("a:twinkle", { x: c.x, gain: 0.5, rate: up ? 1.1 : 0.85 });
    this.noodle.bop = 0.6;
    if (this.solved()) { this.win(); return; }
    if (wasNeeded) this.good(c.x, c.y - this.board.cs * 0.3, 25);
    else {
      this.wrongs++;
      this.combo = 0; this.setHud({ combo: 0, mult: 1 });
      if (this.wrongs === 3 || (this.wrongs > 3 && this.wrongs % 6 === 0)) this.react("wow", this.rng.pick(["Hmm… try the lantern hint!", "Tricky! Look at the dark ones.", "Sniff sniff… a hint might help!"]));
    }
    this.hint(`Taps ${this.taps} · par ${this.par} · ${this.lit.filter((v, j) => !v && !this.blocked[j]).length} dark jars`);
  }

  private useHint() {
    if (this.phase !== "play") return;
    const opts = this.need.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (!opts.length) return;
    const i = opts.find((x) => x !== this.lastHint) ?? opts[0];
    this.lastHint = i; this.hints++;
    this.jars[i].flash = 3;
    this.btn.press = 1; this.tween(this.btn, { press: 0 }, 0.3);
    const cost = byDiff(this.diff, { easy: 15, medium: 30, hard: 50 });
    if (this.score > 0) { const c = Math.min(cost, this.score); this.addRaw(-c); this.float(`-${c}`, this.btn.x + this.btn.w / 2, this.btn.y - 8, "#FF8FB1", 24); }
    this.sfx("a:chime", { gain: 0.5 });
    this.react("happy", this.rng.pick(["Psst! Tap the sparkly one!", "Sniff… that jar!", "My nose says THAT one!"]), false);
  }

  private win() {
    this.phase = "win"; this.timerBar(null); this.hint(null);
    const perfect = this.taps <= this.par && this.hints === 0;
    const bonus = Math.max(0, (this.par * 2 - this.taps) * 6) + (this.timed ? Math.round(clamp(1 - (this.t - this.startT) / this.budget, 0, 1) * 120) : 0) + (this.pattern === "x" ? 40 : 0) + (this.wrap ? 40 : 0);
    [0, 2, 4, 5, 7, 9].forEach((k, i) => this.after(0.1 + i * 0.09, () => this.tone(this.note(k + 3), 0.4, undefined, 0.35)));
    this.sfx("sparkle", { gain: 0.6, delay: 0.3 });
    this.after(0.5, () => {
      // the fireflies fly out of their jars to dance
      for (let i = 0; i < this.lit.length; i++) {
        if (this.blocked[i]) continue;
        const c = this.cellC(i);
        this.flies.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 90, life: 2.4 + Math.random(), ph: Math.random() * 6 });
        this.jars[i].bounce = 1;
      }
      this.tween(this.noodle, { stretch: 1 }, 0.6, ease.elastic);
      this.sfx("v:noodle_laugh", { gain: 0.7 });
      this.react("happy", this.rng.pick(["The meadow is glowing!", "Sooo sparkly! Woof!", "Fireflies, dance!", "Best night ever!"]));
    });
    this.after(1.0, () => this.levelClear({ perfect, bonus, title: perfect ? "PERFECT GLOW!" : this.rng.pick(["ALL AGLOW!", "LIGHTS ON!", "TWINKLE-TASTIC!"]) }));
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    for (let i = 0; i < this.jars.length; i++) {
      const J = this.jars[i];
      if (J.delay > 0) J.delay -= dt;
      else J.glow += ((this.lit[i] ? 1 : 0) - J.glow) * Math.min(1, dt * 9);
      J.bounce = Math.max(0, J.bounce - dt * 2.4);
      J.flash = Math.max(0, J.flash - dt);
      J.wig = Math.max(0, J.wig - dt * 2.5);
    }
    for (const r of this.rays) r.life -= dt * 2.5;
    this.rays = this.rays.filter((r) => r.life > 0);
    for (const f of this.flies) { f.life -= dt; f.x += (f.vx + Math.sin(this.t * 3 + f.ph) * 40) * dt; f.y += f.vy * dt; }
    this.flies = this.flies.filter((f) => f.life > 0);
    this.noodle.bop = Math.max(0, this.noodle.bop - dt * 2);
    if (this.phase === "play" && this.timed) {
      const u = clamp((this.t - this.startT) / this.budget, 0, 1);
      this.dawn = u;
      const v = Math.round((1 - u) * 60) / 60;
      if (v !== this.lastBar) { this.lastBar = v; this.timerBar(v, v > 0.3 ? "#FFE38A" : "#FF8A3D"); if (Math.abs(v - 0.25) < 0.01) this.react("wow", "The sun is coming up!"); }
      if (u >= 1) {
        this.phase = "out"; this.timerBar(null);
        this.sfx("a:tweet", { gain: 0.6 }); this.sfx("a:croak", { gain: 0.4, delay: 0.3 });
        this.levelFail("The sun came up! 🌅");
      }
    }
  }

  // ------------------------------------------------------------ drawing
  private drawSky(g: G) {
    const W = this.W, H = this.H;
    if (!this.sky || this.sky.width !== Math.round(W) || this.sky.height !== Math.round(H)) {
      const c = document.createElement("canvas"); c.width = Math.round(W); c.height = Math.round(H);
      const x = c.getContext("2d")!;
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0A0E2E"); gr.addColorStop(0.5, "#1B1A52"); gr.addColorStop(1, "#2C2A6E");
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      // hills
      const hy = H * 0.62;
      for (const [k, col] of [[0, "#1A3550"], [1, "#16304A"], [2, "#12283E"]] as [number, string][]) {
        x.beginPath(); x.moveTo(0, H);
        for (let i = 0; i <= 8; i++) x.lineTo((i / 8) * W, hy + k * H * 0.08 + Math.sin(i * 1.7 + k * 2) * H * 0.03);
        x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill();
      }
      // grass tufts and little flowers in the foreground
      for (let i = 0; i < 40; i++) {
        const gx = ((i * 0.618034) % 1) * W, gy = H - 4 - ((i * 0.31) % 1) * H * 0.12;
        x.strokeStyle = i % 2 ? "#2F6B4A" : "#25573D"; x.lineWidth = 3; x.lineCap = "round";
        for (const a of [-0.35, 0, 0.35]) { x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + a * 14, gy - 12, gx + a * 22, gy - 22 - (i % 3) * 5); x.stroke(); }
        if (i % 5 === 0) blob(x, gx + 4, gy - 26, 4, 4, ["#FF8FB1", "#FFE38A", "#B7A2E8"][i % 3], { gloss: 0.5 });
      }
      this.sky = c;
    }
    g.drawImage(this.sky, 0, 0, W, H);
    if (this.dawn > 0) {
      const dg = g.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, rgba("#FF9F6B", 0)); dg.addColorStop(1, rgba("#FFB36B", 0.55 * this.dawn));
      g.fillStyle = dg; g.fillRect(0, 0, W, H);
    }
    for (const s of this.stars) { g.fillStyle = `rgba(255,255,240,${(0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 1.6 + s.ph))) * (1 - this.dawn * 0.8)})`; g.beginPath(); g.arc(s.x * W, s.y * H, 1.4, 0, Math.PI * 2); g.fill(); }
    // sleepy moon (landscape only — portrait has no free sky)
    if (W > H * 1.05) {
      const mx = W * 0.9, my = this.area.y + 70 - this.dawn * 40, mr = Math.min(W, H) * 0.06;
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 3); mg.addColorStop(0, "rgba(255,244,200,0.35)"); mg.addColorStop(1, "rgba(255,244,200,0)");
      g.fillStyle = mg; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      blob(g, mx, my, mr, mr, "#FFF1C9", { gloss: 0.4 });
      g.strokeStyle = "#7A5A3A"; g.lineWidth = Math.max(1.5, mr * 0.08); g.lineCap = "round";
      for (const s of [-1, 1]) { g.beginPath(); g.arc(mx + s * mr * 0.32, my - mr * 0.05, mr * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      mouth(g, mx, my + mr * 0.35, mr * 0.3, "smile");
    }
    // ambient fireflies
    for (const f of this.amb) {
      const x = (f.x * W + Math.sin(this.t * 0.5 * f.sp + f.ph) * 40 + W) % W, y = f.y * H + Math.cos(this.t * 0.7 * f.sp + f.ph) * 26;
      this.fireflyGlow(g, x, y, 0.5 + 0.5 * Math.sin(this.t * 3 + f.ph), 1);
    }
  }

  private fireflyGlow(g: G, x: number, y: number, a: number, s: number) {
    const r = 12 * s;
    const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(255,240,140,${0.75 * a})`); gg.addColorStop(1, "rgba(255,240,140,0)");
    g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.fillStyle = `rgba(255,255,220,${0.6 + 0.4 * a})`; g.beginPath(); g.arc(x, y, 2 * s, 0, Math.PI * 2); g.fill();
  }

  private drawBoard(g: G) {
    const B = this.board, n = this.n;
    // soft moss mat under the jars
    shadow(g, B.x + B.s / 2, B.y + B.s + 6, B.s * 0.5, 14, 0.4);
    rr(g, B.x - 6, B.y - 6, B.s + 12, B.s + 12, 26); g.fillStyle = "rgba(30,60,60,0.55)"; g.fill();
    rr(g, B.x - 6, B.y - 6, B.s + 12, B.s + 12, 26); g.strokeStyle = this.wrap ? `rgba(124,242,255,${0.5 + 0.3 * Math.sin(this.t * 4)})` : "rgba(140,220,170,0.25)"; g.lineWidth = this.wrap ? 4 : 2;
    if (this.wrap) { g.setLineDash([10, 8]); g.lineDashOffset = -this.t * 30; }
    g.stroke(); g.setLineDash([]);
    // rays from the last press
    for (const r of this.rays) {
      const a = this.cellC(r.a), b = this.cellC(r.b);
      g.strokeStyle = `rgba(255,240,150,${r.life * 0.6})`; g.lineWidth = 6 * r.life; g.lineCap = "round";
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    for (let i = 0; i < n * n; i++) {
      const c = this.cellC(i);
      if (this.blocked[i]) this.drawRock(g, c.x, c.y, B.cs, this.jars[i]?.wig ?? 0, i);
      else if (this.jars[i]) this.drawJar(g, c.x, c.y, B.cs, this.jars[i]);
    }
    if (this.cur.on && this.phase === "play") {
      const x = B.x + this.cur.c * B.cs, y = B.y + this.cur.r * B.cs;
      rr(g, x + 3, y + 3, B.cs - 6, B.cs - 6, B.cs * 0.2); g.strokeStyle = "#FFD25A"; g.lineWidth = 3; g.setLineDash([7, 5]); g.lineDashOffset = -this.t * 20; g.stroke(); g.setLineDash([]);
    }
  }

  private drawRock(g: G, x: number, y: number, cs: number, wig: number, i: number) {
    const s = cs * 0.34;
    shadow(g, x, y + s * 0.7, s * 1.1, s * 0.25, 0.35);
    blob(g, x + Math.sin(wig * 30) * wig * 4, y + s * 0.2, s * 1.05, s * 0.75, "#6E7A8E", { gloss: 0.3, wobble: 0.05, t: i });
    blob(g, x - s * 0.2, y - s * 0.25, s * 0.6, s * 0.25, "#5FB36A", { gloss: 0.3 });
    blob(g, x + s * 0.5, y - s * 0.05, s * 0.18, s * 0.22, "#FF8FB1", { gloss: 0.5 });
  }

  private drawJar(g: G, x: number, y: number, cs: number, J: Jar) {
    const w = cs * 0.58, h = cs * 0.76, gl = clamp(J.glow, 0, 1);
    const b = Math.sin(J.bounce * Math.PI * 2.5) * J.bounce;
    g.save(); g.translate(x + Math.sin(J.wig * 30) * J.wig * 4, y + h / 2); g.scale(1 + b * 0.12, 1 - b * 0.12); g.translate(0, -h / 2);
    // glow halo
    if (gl > 0.02) {
      const hr = cs * 0.75;
      const hg = g.createRadialGradient(0, 0, 0, 0, 0, hr); hg.addColorStop(0, `rgba(255,226,110,${0.5 * gl})`); hg.addColorStop(1, "rgba(255,226,110,0)");
      g.fillStyle = hg; g.fillRect(-hr, -hr, hr * 2, hr * 2);
    }
    if (J.flash > 0) {
      const p = 0.5 + 0.5 * Math.sin(this.t * 12);
      g.strokeStyle = `rgba(124,242,201,${0.5 + 0.5 * p})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, cs * (0.44 + p * 0.05), 0, Math.PI * 2); g.stroke();
      star(g, cs * 0.32, -cs * 0.32, cs * 0.09, "#7CF2C9", this.t * 3);
    }
    shadow(g, 0, h / 2, w * 0.55, 5, 0.4);
    const top = -h / 2, bodyY = top + h * 0.2;
    // glass body
    const bodyPath = () => { rr(g, -w / 2, bodyY, w, h * 0.8, w * 0.32); };
    bodyPath();
    const fg = g.createLinearGradient(0, bodyY, 0, bodyY + h * 0.8);
    fg.addColorStop(0, mix("#3A4A8A", "#FFF4B0", gl)); fg.addColorStop(1, mix("#26305E", "#FFC93C", gl));
    g.globalAlpha = 0.55 + gl * 0.35; g.fillStyle = fg; g.fill(); g.globalAlpha = 1;
    // the firefly inside
    const fy = bodyY + h * 0.46 + Math.sin(this.t * 3 + J.ph) * h * 0.05 * (0.3 + gl);
    const fs = w * 0.26;
    if (gl > 0.3) { // wings flutter
      const fl = Math.sin(this.t * 30 + J.ph) * 0.3 * gl;
      g.fillStyle = "rgba(230,245,255,0.75)";
      for (const s of [-1, 1]) { g.save(); g.translate(s * fs * 0.4, fy - fs * 0.55); g.rotate(s * (0.5 + fl)); g.beginPath(); g.ellipse(0, -fs * 0.25, fs * 0.3, fs * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    }
    blob(g, 0, fy + fs * 0.55, fs * 0.55, fs * 0.5, mix("#5A6A70", "#FFF27A", gl), { gloss: 0.6 }); // glowing tail
    blob(g, 0, fy - fs * 0.1, fs * 0.62, fs * 0.58, mix("#4A4E7A", "#6B4FA0", gl * 0.5), { gloss: 0.4 });
    if (gl > 0.5) { eye(g, -fs * 0.24, fy - fs * 0.2, fs * 0.22, { look: [0, -0.2] }); eye(g, fs * 0.24, fy - fs * 0.2, fs * 0.22, { look: [0, -0.2] }); mouth(g, 0, fy + fs * 0.12, fs * 0.3, "smile"); }
    else {
      g.strokeStyle = "#1B1420"; g.lineWidth = Math.max(1.2, fs * 0.1); g.lineCap = "round";
      for (const s of [-1, 1]) { g.beginPath(); g.arc(s * fs * 0.24, fy - fs * 0.24, fs * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      if (this.phase !== "win") { const zz = (this.t * 0.6 + J.ph) % 1; g.globalAlpha = 1 - zz; g.font = `${Math.max(9, cs * 0.14)}px "Lilita One", system-ui`; g.fillStyle = "#B7C4FF"; g.textAlign = "center"; g.fillText("z", fs * 0.6 + zz * 6, fy - fs * 0.6 - zz * 12); g.globalAlpha = 1; }
    }
    // glass outline + shine
    bodyPath(); g.strokeStyle = gl > 0.5 ? "rgba(255,250,220,0.95)" : "rgba(190,205,255,0.7)"; g.lineWidth = Math.max(2, cs * 0.035); g.stroke();
    rr(g, -w * 0.36, bodyY + h * 0.1, w * 0.12, h * 0.45, w * 0.06); g.fillStyle = "rgba(255,255,255,0.4)"; g.fill();
    // neck + lid
    rr(g, -w * 0.36, top + h * 0.08, w * 0.72, h * 0.15, 4); g.fillStyle = gl > 0.5 ? "rgba(255,240,190,0.7)" : "rgba(150,165,220,0.45)"; g.fill();
    rr(g, -w * 0.44, top, w * 0.88, h * 0.12, 5); g.fillStyle = "#B9784A"; g.fill();
    rr(g, -w * 0.4, top + 1, w * 0.8, h * 0.04, 3); g.fillStyle = "rgba(255,255,255,0.3)"; g.fill();
    g.restore();
  }

  private drawNoodle(g: G) {
    const N = this.noodle, mood = this.hud.status === "playing" ? this.hud.host.mood : "happy";
    const im = this.img(this.host(mood));
    if (!im || !im.naturalWidth) return;
    const breathe = Math.sin(this.t * 2) * 0.012;
    const h = N.h * (1 + N.bop * 0.06 + breathe), k = h / im.naturalHeight;
    const lw = im.naturalWidth * 0.42, mw = im.naturalWidth * 0.06, rw = im.naturalWidth * 0.52;
    const total = N.w * (0.86 + 0.14 * clamp(N.stretch, 0, 1.2));
    const midW = Math.max(mw * k, total - (lw + rw) * k);
    const x0 = N.x - ((lw + rw) * k + midW) / 2, y0 = N.y - h;
    shadow(g, N.x, N.y - 3, total * 0.5, 8, 0.35);
    g.drawImage(im, 0, 0, lw, im.naturalHeight, x0, y0, lw * k, h);
    g.drawImage(im, lw, 0, mw, im.naturalHeight, x0 + lw * k - 0.5, y0, midW + 1, h);
    g.drawImage(im, lw + mw, 0, rw, im.naturalHeight, x0 + lw * k + midW, y0, rw * k, h);
  }

  private drawUi(g: G) {
    if (this.hud.status !== "playing") return;
    // pattern badge: which jars flip
    const bd = this.badge, s = bd.s;
    rr(g, bd.x, bd.y, s, s, 12); g.fillStyle = "rgba(10,14,46,0.6)"; g.fill();
    rr(g, bd.x, bd.y, s, s, 12); g.strokeStyle = "rgba(255,240,150,0.4)"; g.lineWidth = 2; g.stroke();
    const cell = s / 3.6;
    const on = this.pattern === "x" ? [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]] : [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
      const lit = on.some(([a, b]) => a === r && b === c);
      g.beginPath(); g.arc(bd.x + s / 2 + c * cell, bd.y + s / 2 + r * cell, cell * 0.36, 0, Math.PI * 2);
      g.fillStyle = lit ? (r === 0 && c === 0 ? "#FFFFFF" : "#FFE38A") : "rgba(255,255,255,0.15)"; g.fill();
    }
    if (this.wrap) clayText(g, "↻", bd.x + s - 6, bd.y + 6, 16, { fill: "#7CF2FF", gloss: false });
    // hint lantern button
    const b = this.btn;
    g.save(); g.globalAlpha = this.phase === "play" ? 1 : 0.5;
    clayPanel(g, b.x, b.y, b.w, b.h, 16, "#FFB000", { lip: 6, pressed: b.press });
    const ly = b.y + b.h * 0.36 + b.press * 4, lr = b.h * 0.16;
    const lg = g.createRadialGradient(b.x + b.w * 0.27, ly, 0, b.x + b.w * 0.27, ly, lr * 2.2); lg.addColorStop(0, "rgba(255,255,200,0.9)"); lg.addColorStop(1, "rgba(255,255,200,0)");
    g.fillStyle = lg; g.fillRect(b.x, b.y, b.w * 0.6, b.h);
    blob(g, b.x + b.w * 0.27, ly, lr, lr * 1.15, "#FFF4B0", { gloss: 0.6 });
    rr(g, b.x + b.w * 0.27 - lr * 0.7, ly - lr * 1.5, lr * 1.4, lr * 0.4, 2); g.fillStyle = "#7B4A2E"; g.fill();
    clayText(g, "HINT", b.x + b.w * 0.64, ly, Math.min(18, b.h * 0.3), { fill: "#FFFFFF" });
    g.font = `bold ${Math.round(Math.min(12, b.h * 0.2))}px "Fredoka", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(60,30,10,0.8)";
    g.fillText(`-${byDiff(this.diff, { easy: 15, medium: 30, hard: 50 })} pts`, b.x + b.w / 2, b.y + b.h * 0.72 + b.press * 4);
    g.restore();
    // taps / par
    const st = this.stats, portrait = this.W < this.H * 1.05;
    clayText(g, `TAPS ${this.taps}`, st.x, st.y - 10, portrait ? 20 : 26, { fill: "#FFFFFF", align: portrait ? "left" : "center" });
    clayText(g, `PAR ${this.par}`, st.x, st.y + 14, portrait ? 16 : 20, { fill: this.taps <= this.par ? "#7CF2C9" : "#FF8FB1", align: portrait ? "left" : "center" });
  }

  private drawFlies(g: G) {
    for (const f of this.flies) this.fireflyGlow(g, f.x, f.y, Math.min(1, f.life) * (0.6 + 0.4 * Math.sin(this.t * 10 + f.ph)), 1.3);
  }

  protected drawBackground(g: G) {
    if (!this.jars.length) {
      this.n = 4; this.pattern = "plus"; this.wrap = false;
      const r = new Rng(31);
      this.blocked = new Array<boolean>(16).fill(false);
      this.lit = Array.from({ length: 16 }, () => r.chance(0.6));
      this.jars = this.lit.map((v, i) => ({ glow: v ? 1 : 0, delay: 0, bounce: 0, flash: 0, wig: 0, ph: i * 1.3 }));
      this.layout();
    }
    this.drawSky(g);
    this.drawBoard(g);
    this.drawNoodle(g);
  }

  protected draw(g: G) {
    this.drawSky(g);
    this.drawBoard(g);
    this.drawUi(g);
    this.drawNoodle(g);
    this.drawFlies(g);
  }
}
