// Odd Blob Out — Zib's space lounge. A bunch of clay blobs all follow a rule… except one. Tap the odd blob!
// ~8 quick prompts per level with a shrinking timer. Unlimited levels: more blobs, subtler differences
// (eyes, hats, patterns, size), noise in the other features, PAIR RULES and WOBBLE MODE on the hardest levels.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, eye, mouth, rr, shadow, star, type G } from "../paint";

type Attr = "color" | "shape" | "eyes" | "hat" | "pattern" | "size";
const ATTRS: Attr[] = ["color", "shape", "eyes", "hat", "pattern", "size"];
const COUNT: Record<Attr, number> = { color: 7, shape: 4, eyes: 3, hat: 4, pattern: 3, size: 2 };
const WORD: Record<Attr, string> = { color: "colour", shape: "shape", eyes: "eyes", hat: "hat", pattern: "pattern", size: "size" };
const COLORS = ["#E8504F", "#FF8A3D", "#FFD25A", "#74C94E", "#4A90E8", "#9B5DE5", "#FF8FB1"];
type Vals = Record<Attr, number>;
interface Blob { v: Vals; odd: boolean; cell: number; jx: number; jy: number; ph: number; pop: number; beam: number; wig: number; bad: number; out: number }
type Phase = "in" | "play" | "out" | "done";

export default class OddBlobOut extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "odd-blob-out", title: "Odd Blob Out", host: "zib", style: "rounds",
    music: { calm: "a:oddblob_calm", action: "a:oddblob_action" },
    sounds: ["a:teleport", "a:ufo", "a:twinkle", "a:buzz", "a:tickHi", "a:squeak", "a:wobble", "boing", "pop"],
    voicePitch: 1.4, transition: "iris",
  };
  private blobs: Blob[] = [];
  private cells: { x: number; y: number }[] = [];
  private R = 40; private cellW = 80; private cellH = 80;
  private n = 4; private prompts = 8; private pi = 0;
  private phase: Phase = "in";
  private tTot = 10; private tLeft = 10; private lastTick = 0;
  private rule: { a: Attr; b?: Attr } = { a: "color" };
  private pool: Attr[] = ["color"];
  private attrBag = new Bag<Attr>(["color"]);
  private noiseN = 0; private pairP = 0; private wob = 0;
  private mistakes = 0; private allowed = 3; private rights = 0;
  private results: (boolean | null)[] = [];
  private recent = new Recent(40);
  private arena = { x: 0, y: 0, w: 100, h: 100 };
  private zib = { x: 0, y: 0, h: 110, bop: 0 };
  private prog = { x: 0, y: 0, w: 150, h: 54 };
  private stars = Array.from({ length: 60 }, (_, i) => ({ x: (i * 0.6180339) % 1, y: (i * 0.4142135) % 1, p: i * 1.37, s: 1 + (i % 3) }));

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H * 1.05;
    if (portrait) {
      const zh = clamp(A.h * 0.17, 84, 130);
      this.zib = { ...this.zib, x: zh * 0.62 + 8, y: A.y + A.h - 8, h: zh };
      this.arena = { x: 10, y: A.y + 4, w: W - 20, h: A.h - zh - 18 };
      const pw = Math.min(200, W - (this.zib.x + zh * 0.6) - 18);
      this.prog = { w: pw, h: 56, x: W - pw - 12, y: A.y + A.h - 70 };
    } else {
      const side = clamp(W * 0.16, 150, 240);
      this.arena = { x: side, y: A.y + 4, w: W - side * 2, h: A.h - 10 };
      const zh = clamp(A.h * 0.34, 110, 200);
      this.zib = { ...this.zib, x: side / 2, y: A.y + A.h - 14, h: Math.min(zh, side * 1.1) };
      const pw = Math.min(side - 20, 200);
      this.prog = { w: pw, h: 78, x: W - side / 2 - pw / 2, y: A.y + A.h - 100 };
    }
    this.layoutGrid();
  }

  private layoutGrid() {
    const n = this.blobs.length || this.n, a = this.arena, pad = 14;
    const w = a.w - pad * 2, h = a.h - pad * 2;
    let best = -1, cols = 2;
    for (let c = 2; c <= 6; c++) {
      const r = Math.ceil(n / c), s = Math.min(w / c, (h / r) * 1.05) - (c * r - n) * 2;
      if (s > best) { best = s; cols = c; }
    }
    const rows = Math.ceil(n / cols);
    this.cellW = w / cols; this.cellH = h / rows;
    this.R = clamp(Math.min(this.cellW * 0.36, this.cellH / 2.65), 18, 72);
    this.cells = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols;
      this.cells.push({ x: a.x + a.w / 2 + (c - (inRow - 1) / 2) * this.cellW, y: a.y + pad + (r + 0.5) * this.cellH + this.R * 0.28 });
    }
  }

  /** current centre of a blob (cell + jitter + wobble-mode drift + tractor beam) */
  private pos(b: Blob) {
    const c = this.cells[b.cell] ?? { x: 0, y: 0 };
    let x = c.x + b.jx * this.cellW * 0.12, y = c.y + b.jy * this.cellH * 0.08;
    if (this.wob > 0 && b.beam === 0) {
      x += Math.sin(this.t * (1.1 + this.wob * 0.5) + b.ph) * this.cellW * 0.16 * this.wob;
      y += Math.cos(this.t * (0.9 + this.wob * 0.4) + b.ph * 1.7) * this.cellH * 0.1 * this.wob;
    }
    if (b.beam > 0) y -= ease.in(b.beam) * (y - this.arena.y + this.R * 3);
    return { x, y };
  }

  // ------------------------------------------------------------ levels
  private poolFor(L: number): Attr[] {
    return byDiff(this.diff, {
      easy: L <= 2 ? ["color"] : L <= 5 ? ["color", "size", "shape"] : L <= 8 ? ["color", "size", "shape", "hat"] : ["color", "size", "shape", "hat", "eyes"],
      medium: L <= 2 ? ["color", "shape", "hat"] : L <= 4 ? ["color", "shape", "hat", "eyes"] : ATTRS,
      hard: ATTRS,
    }) as Attr[];
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.n = byDiff(d, { easy: Math.min(9, 4 + Math.floor((L - 1) / 2)), medium: Math.min(12, 6 + Math.floor((L - 1) / 2)), hard: Math.min(12, 6 + Math.floor((L - 1) * 0.6)) });
    this.prompts = d === "easy" && L <= 2 ? 6 : 8;
    this.pool = this.poolFor(L);
    this.attrBag = new Bag<Attr>(this.pool);
    this.noiseN = byDiff(d, { easy: L >= 6 ? 1 : 0, medium: L >= 10 ? 3 : L >= 4 ? 2 : 1, hard: L >= 10 ? 4 : L >= 5 ? 3 : 2 });
    this.pairP = byDiff(d, { easy: 0, medium: L >= 12 ? 0.3 : 0, hard: L >= 8 ? 0.55 : L >= 3 ? 0.35 : 0 });
    this.wob = byDiff(d, { easy: 0, medium: L >= 10 && L % 2 === 0 ? 0.6 : 0, hard: L >= 4 && (L >= 8 || L % 2 === 0) ? Math.min(1.4, 0.6 + (L - 4) * 0.06) : 0 });
    this.tTot = byDiff(d, { easy: ramp(L, 12, -0.4, 6), medium: ramp(L, 10, -0.4, 5), hard: ramp(L, 9, -0.35, 4) });
    this.allowed = byDiff(d, { easy: 3, medium: 2, hard: 2 });
    this.reveal = null;
    this.pi = 0; this.mistakes = 0; this.rights = 0; this.results = new Array(this.prompts).fill(null);
    this.blobs = [];
    this.layout();
    // twist / new-feature announcements
    const prev = L > 1 ? this.poolFor(L - 1) : [];
    const added = this.pool.filter((a) => !prev.includes(a));
    let wait = 1.4;
    const say = (t: string, s: string, tone: "pink" | "mint" | "gold" | "red", line: string) => { this.after(0.5, () => { this.banner(t, s, tone); this.react("wow", line); }); wait = 2.3; };
    if (this.attempt === 0 && L > 1 && added.length) say(`NEW: ${added.map((a) => WORD[a].toUpperCase()).join(" & ")}!`, `Look at their ${added.map((a) => WORD[a]).join(" and ")} too`, "mint", "Zib zib! New clue!");
    else if (this.attempt === 0 && this.pairP > 0 && (L === byDiff(d, { easy: 99, medium: 12, hard: 3 }) || L % 5 === 0)) say("PAIR RULES!", "Some blobs follow a two-part rule", "pink", "Tricky blobs ahead!");
    else if (this.attempt === 0 && this.wob > 0 && (L === byDiff(d, { easy: 99, medium: 10, hard: 4 }) || L % 4 === 0)) { say("WOBBLE MODE!", "The blobs won't sit still!", "gold", "Wiggle wiggle!"); this.sfx("a:wobble", { gain: 0.5, delay: 0.5 }); }
    else this.react("happy", this.rng.pick(["Find the odd one!", "Zib zib! Who's different?", "One blob is weird…", "Spot the odd blob!"]));
    this.music(this.wob > 0 || this.pairP > 0 ? "action" : "calm");
    this.hint("Find the blob that's different! 👽");
    this.phase = "in";
    this.after(wait, () => this.newPrompt());
  }

  private newPrompt() {
    if (this.pi >= this.prompts) { this.finish(); return; }
    const pair = this.pairP > 0 && this.rng.chance(this.pairP);
    let blobs: Vals[] = [], oddI = 0, rule: { a: Attr; b?: Attr } = { a: "color" };
    for (let tries = 0; tries < 25; tries++) {
      const r = pair ? this.makePair() : this.makeSingle();
      blobs = r.vals; oddI = r.odd; rule = r.rule;
      const sig = `${rule.a}${rule.b ?? ""}|` + blobs.map((v) => ATTRS.map((a) => v[a]).join("")).sort().join(",");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    this.rule = rule; this.reveal = null;
    const order = this.rng.shuffle([...blobs.keys()]);
    this.blobs = order.map((vi, cell) => ({ v: blobs[vi], odd: vi === oddI, cell, jx: this.rng.range(-1, 1), jy: this.rng.range(-1, 1), ph: this.rng.range(0, 6.28), pop: 0, beam: 0, wig: 0, bad: 0, out: 0 }));
    this.layoutGrid();
    this.phase = "in";
    this.blobs.forEach((b, i) => this.tween(b, { pop: 1 }, 0.42, ease.back, i * 0.035));
    this.sfx("boing", { gain: 0.35, rate: 1.1 + this.rng.next() * 0.3 });
    this.sfx("pop", { gain: 0.3, delay: 0.12 });
    this.after(0.3 + this.blobs.length * 0.035, () => {
      this.phase = "play";
      this.tLeft = this.tTot * (1 - this.pi * 0.03) + this.n * 0.15; this.tTotP = this.tLeft; this.lastTick = 99;
      const L = this.level;
      if (pair) this.hint("Two-part rule! Who breaks it? 🤔");
      else if (this.diff === "easy" && L <= 4) this.hint(`Which blob has a different ${WORD[rule.a].toUpperCase()}? 👆`);
      else this.hint(`Tap the odd blob out! 👽 (${this.pi + 1}/${this.prompts})`);
    });
  }
  private tTotP = 10;

  private randVals(): Vals {
    return { color: this.rng.int(0, 6), shape: this.rng.int(0, 3), eyes: this.rng.int(0, 2), hat: this.rng.int(0, 3), pattern: this.rng.int(0, 2), size: 0 };
  }

  /** values for a "noise" feature: every value used appears at least twice, so it never makes a second odd one */
  private noiseVals(a: Attr, n: number) {
    const k = Math.min(COUNT[a], Math.max(2, Math.min(3, Math.floor(n / 2))));
    const vals = this.rng.shuffle([...Array(COUNT[a]).keys()]).slice(0, k);
    const out: number[] = [];
    for (const v of vals) out.push(v, v);
    while (out.length < n) out.push(this.rng.pick(vals));
    return this.rng.shuffle(out.slice(0, n));
  }

  private noiseAttrs(exclude: Attr[]) {
    const cand = this.rng.shuffle(ATTRS.filter((a) => !exclude.includes(a) && a !== "size"));
    return cand.slice(0, this.noiseN);
  }

  private makeSingle() {
    const n = this.n, a = this.attrBag.next(this.rng), base = this.randVals();
    const vals: Vals[] = Array.from({ length: n }, () => ({ ...base }));
    for (const na of this.noiseAttrs([a])) this.noiseVals(na, n).forEach((v, i) => (vals[i][na] = v));
    let other = base[a];
    if (a === "size") { const big = this.rng.chance(0.5) ? 0 : 1; for (const v of vals) v.size = big; other = 1 - big; }
    else {
      const far = (x: number, y: number) => Math.min(Math.abs(x - y), 7 - Math.abs(x - y));
      const opts = [...Array(COUNT[a]).keys()].filter((v) => v !== base[a] && (a !== "color" || this.diff !== "easy" || far(v, base[a]) >= 2));
      other = this.rng.pick(opts);
    }
    const odd = this.rng.int(0, n - 1);
    vals[odd][a] = other;
    return { vals, odd, rule: { a } as { a: Attr; b?: Attr } };
  }

  private makePair() {
    const n = this.n;
    const A = this.rng.pick(["color", "shape", "hat"] as Attr[]);
    const B = this.rng.pick((["eyes", "hat", "pattern", "color"] as Attr[]).filter((x) => x !== A));
    const G = n >= 9 && COUNT[A] >= 3 && COUNT[B] >= 3 ? 3 : 2;
    const av = this.rng.shuffle([...Array(COUNT[A]).keys()]).slice(0, G), bv = this.rng.shuffle([...Array(COUNT[B]).keys()]).slice(0, G);
    const sizes = new Array(G).fill(2); sizes[0] = 3;
    while (sizes.reduce((s, x) => s + x, 0) < n) sizes[this.rng.int(0, G - 1)]++;
    const base = this.randVals(), vals: Vals[] = [];
    sizes.forEach((cnt, gi) => { for (let k = 0; k < cnt; k++) vals.push({ ...base, [A]: av[gi], [B]: bv[gi] }); });
    for (const na of this.noiseAttrs([A, B])) this.noiseVals(na, n).forEach((v, i) => (vals[i][na] = v));
    vals[0][B] = bv[1]; // the rule-breaker: group-0 feature with a group-1 partner
    return { vals, odd: 0, rule: { a: A, b: B } as { a: Attr; b?: Attr } };
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = Number(key) - 1;
    if (this.phase === "play" && k >= 0 && k < 9 && k < this.blobs.length) this.tap(this.blobs[k]);
  }

  protected onDown(x: number, y: number) {
    if (this.phase !== "play") return;
    let best: Blob | null = null, bd = Infinity;
    for (const b of this.blobs) {
      const p = this.pos(b), d = Math.hypot(x - p.x, y - (p.y - this.R * 0.1));
      if (d < Math.max(30, this.R * 1.25) && d < bd) { best = b; bd = d; }
    }
    if (best) this.tap(best);
  }

  private reason() {
    const r = this.rule;
    if (r.b) return `Wrong ${WORD[r.b]} for its ${WORD[r.a]}!`;
    return r.a === "size" ? "Different size!" : r.a === "eyes" ? "Different number of eyes!" : `Different ${WORD[r.a]}!`;
  }

  private tap(b: Blob) {
    this.phase = "out"; this.timerBar(null);
    const p = this.pos(b), odd = this.blobs.find((x) => x.odd)!;
    if (b.odd) {
      this.rights++; this.results[this.pi] = true;
      this.good(p.x, p.y - this.R, 80, clamp(this.tLeft / this.tTotP, 0, 1));
      this.sfx("a:teleport", { x: p.x, gain: 0.55 });
      this.tween(b, { beam: 1 }, 0.8, ease.inOut, 0.1);
      this.zib.bop = 1;
      this.hint(`${this.reason()} ✨`);
      if (this.rights % 3 === 0) this.react("happy", this.rng.pick(["Zib zib! Weird-o found!", "Odd one spotted!", "Beam it up!", "You've got alien eyes!"]), false);
      this.after(0.95, () => this.clearOut());
    } else {
      this.mistakes++; this.results[this.pi] = false;
      b.wig = 1; b.bad = 1;
      this.sfx("a:squeak", { x: p.x, gain: 0.5 });
      this.bad(p.x, p.y, { line: this.rng.pick(["That one fits in!", "Nope, it belongs!", "Zib? No no!", "Look again!"]) });
      odd.wig = 0.0001; this.after(0.45, () => { this.reveal = odd; this.sfx("a:twinkle", { x: this.pos(odd).x, gain: 0.5 }); this.hint(`This one! ${this.reason()} 👀`); });
      this.after(1.9, () => this.clearOut());
    }
  }
  private reveal: Blob | null = null;

  private timeout() {
    this.phase = "out"; this.timerBar(null);
    this.mistakes++; this.results[this.pi] = false;
    const odd = this.blobs.find((x) => x.odd)!;
    this.combo = 0; this.setHud({ combo: 0, mult: 1 });
    this.sfx("a:buzz", { gain: 0.55 });
    this.react("sad", "Too slow! Zzzib…");
    this.reveal = odd; this.hint(`This one! ${this.reason()} 👀`);
    this.after(1.9, () => this.clearOut());
  }

  private clearOut() {
    this.reveal = null;
    for (const b of this.blobs) if (!b.beam) this.tween(b, { out: 1 }, 0.28, ease.in);
    this.pi++;
    if (this.mistakes > this.allowed) { this.phase = "done"; this.hint(null); this.after(0.3, () => this.levelFail("Too many mix-ups!")); return; }
    this.after(0.35, () => this.newPrompt());
  }

  private finish() {
    this.phase = "done"; this.hint(null); this.blobs = [];
    this.sfx("a:ufo", { gain: 0.5 });
    this.levelClear({ perfect: this.mistakes === 0, bonus: this.wob > 0 ? 40 : 0, title: this.mistakes === 0 ? "OUT OF THIS WORLD!" : undefined });
    this.react("happy", this.rng.pick(["Zib zib hooray!", "You're a blob expert!", "Totally cosmic!", "Odd-tastic!"]), false);
  }

  protected update(dt: number) {
    this.zib.bop = Math.max(0, this.zib.bop - dt * 2.5);
    for (const b of this.blobs) { b.wig = Math.max(0, b.wig - dt * 1.8); b.bad = Math.max(0, b.bad - dt * 0.7); }
    if (this.phase === "play") {
      this.tLeft -= dt;
      const u = this.tLeft / this.tTotP;
      this.timerBar(u, u > 0.5 ? "#7CF2C9" : u > 0.25 ? "#FFD25A" : "#FF6F91");
      const sec = Math.ceil(this.tLeft);
      if (sec <= 3 && sec !== this.lastTick && this.tLeft > 0) { this.lastTick = sec; this.sfx("a:tickHi", { gain: 0.35 }); }
      if (this.tLeft <= 0) this.timeout();
    }
  }

  // ------------------------------------------------------------ drawing
  private bodyPath(g: G, sh: number, x: number, cy: number, rx: number, ry: number, r: number) {
    g.beginPath();
    if (sh === 3) g.roundRect(x - rx, cy - ry, rx * 2, ry * 2, r * 0.42);
    else g.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
  }

  private drawBlob(g: G, b: Blob, R: number) {
    const v = b.v, p = this.pos(b);
    const k = v.size ? 0.66 : 1, r = R * k, col = COLORS[v.color];
    const sq = Math.sin(this.t * 3.2 + b.ph) * 0.035 + (this.wob ? Math.sin(this.t * 6 + b.ph) * 0.05 * this.wob : 0);
    const dims = [[r, r * 0.94], [r * 0.74, r * 1.1], [r * 1.16, r * 0.72], [r * 0.9, r * 0.86]][v.shape];
    const rx = dims[0] * (1 - sq * 0.6), ry = dims[1] * (1 + sq);
    const ground = p.y + R * 0.95;
    const sc = ease.out(clamp(b.pop, 0, 1.3)) * (1 - b.out) * (b.beam ? 1 - b.beam * 0.6 : 1);
    if (sc <= 0.01) return;
    const shx = Math.sin(this.t * 40) * 6 * b.wig;
    g.save();
    g.translate(p.x + shx, ground); g.scale(sc, sc); g.rotate(b.beam ? b.beam * 6 : this.wob ? Math.sin(this.t * 2.5 + b.ph) * 0.08 * this.wob : 0); g.translate(-p.x, -ground);
    const x = p.x, cy = ground - ry;
    if (!b.beam) shadow(g, x, ground + 2, rx * 0.95, Math.max(4, ry * 0.16), 0.35);
    for (const s of [-1, 1]) blob(g, x + s * rx * 0.42, ground - r * 0.05, r * 0.2, r * 0.11, darken(col, 0.22), { gloss: 0.2 });
    this.bodyPath(g, v.shape, x, cy, rx, ry, r);
    clayFill(g, col, x, cy, Math.max(rx, ry), { gloss: 0.42 });
    if (v.pattern) {
      g.save(); this.bodyPath(g, v.shape, x, cy, rx, ry, r); g.clip();
      if (v.pattern === 1) {
        g.fillStyle = "rgba(255,255,255,0.42)";
        for (const [dx, dy, s] of [[-0.55, 0.35, 0.16], [0.5, 0.45, 0.13], [0.62, -0.2, 0.1], [-0.1, 0.72, 0.12], [-0.7, -0.15, 0.1], [0.15, 0.3, 0.09]]) { g.beginPath(); g.arc(x + dx * rx, cy + dy * ry, s * r * 1.3, 0, Math.PI * 2); g.fill(); }
      } else {
        g.fillStyle = darken(col, 0.22) + "88";
        for (const dy of [0.12, 0.45, 0.78]) g.fillRect(x - rx, cy + dy * ry - r * 0.08, rx * 2, r * 0.15);
      }
      g.restore();
    }
    // face
    const ey = cy - ry * 0.18, n = v.eyes + 1, er = r * (n === 1 ? 0.3 : n === 2 ? 0.22 : 0.18);
    const spread = Math.min(rx * 0.42, r * 0.42);
    const look: [number, number] = this.phase === "play" ? [Math.sin(this.t * 0.9 + b.ph) * 0.6, 0.2] : [0, 0];
    const blink = Math.sin(this.t * 0.8 + b.ph * 3) > 0.97 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const ox = n === 1 ? 0 : n === 2 ? (i ? 1 : -1) * spread * 0.78 : (i - 1) * spread;
      const oy = n === 3 && i === 1 ? -er * 0.7 : 0;
      eye(g, x + ox, ey + oy, er, { look, blink, pupil: 0.55 });
    }
    mouth(g, x, cy + ry * 0.36, r * 0.36, b.bad > 0.05 ? "oh" : b.beam ? "grin" : "smile");
    g.fillStyle = "rgba(255,111,145,0.45)";
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * Math.min(rx * 0.62, r * 0.6), cy + ry * 0.22, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); g.fill(); }
    this.drawHat(g, v.hat, x, cy - ry * (v.shape === 3 ? 0.98 : 0.94), r);
    g.restore();
  }

  private drawHat(g: G, hat: number, x: number, y: number, r: number) {
    if (hat === 1) { // cap
      blob(g, x + r * 0.38, y + r * 0.06, r * 0.34, r * 0.09, "#E8504F", { gloss: 0.3 });
      g.beginPath(); g.ellipse(x, y + r * 0.1, r * 0.46, r * 0.36, 0, Math.PI, Math.PI * 2); g.closePath(); clayFill(g, "#2B3A67", x, y - r * 0.1, r * 0.46);
      star(g, x - r * 0.04, y - r * 0.05, r * 0.11, "#FFD25A");
      blob(g, x, y - r * 0.26, r * 0.07, r * 0.05, "#E8504F");
    } else if (hat === 2) { // bow
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x, y - r * 0.02); g.lineTo(x + s * r * 0.42, y - r * 0.24); g.quadraticCurveTo(x + s * r * 0.5, y, x + s * r * 0.42, y + r * 0.18); g.closePath();
        clayFill(g, "#FF4F8B", x + s * r * 0.25, y - r * 0.03, r * 0.3, { outline: Math.max(1.5, r * 0.04) });
        g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(x + s * r * 0.28, y - r * 0.06, r * 0.04, 0, Math.PI * 2); g.fill();
      }
      blob(g, x, y - r * 0.02, r * 0.1, r * 0.1, "#D93A72", { gloss: 0.5 });
    } else if (hat === 3) { // antenna
      g.strokeStyle = "#3A3550"; g.lineWidth = Math.max(2, r * 0.07); g.lineCap = "round";
      g.beginPath(); g.moveTo(x, y + r * 0.06); g.quadraticCurveTo(x + r * 0.2, y - r * 0.3, x + r * 0.08, y - r * 0.52); g.stroke();
      const gl = g.createRadialGradient(x + r * 0.08, y - r * 0.56, 0, x + r * 0.08, y - r * 0.56, r * 0.3);
      gl.addColorStop(0, "rgba(124,242,201,0.6)"); gl.addColorStop(1, "rgba(124,242,201,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(x + r * 0.08, y - r * 0.56, r * 0.3, 0, Math.PI * 2); g.fill();
      blob(g, x + r * 0.08, y - r * 0.56, r * 0.12, r * 0.12, "#7CF2C9", { gloss: 0.7 });
    }
  }

  private drawSpace(g: G) {
    const W = this.W, H = this.H;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1B1240"); gr.addColorStop(0.6, "#2A1656"); gr.addColorStop(1, "#120A2A");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (const s of this.stars) { g.fillStyle = `rgba(255,255,255,${0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 1.6 + s.p))})`; g.fillRect(s.x * W, s.y * H, s.s, s.s); }
    // planets
    const px = W * 0.86, py = H * 0.2, pr = Math.min(W, H) * 0.07;
    blob(g, px, py, pr, pr, "#FF8A3D", { gloss: 0.4 });
    g.strokeStyle = "rgba(255,210,90,0.7)"; g.lineWidth = pr * 0.14; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.42, -0.3, 0.15 * Math.PI, 1.05 * Math.PI, true); g.stroke();
    blob(g, W * 0.1, H * 0.62, pr * 0.55, pr * 0.55, "#7CC8FF", { gloss: 0.4 });
    blob(g, W * 0.1 - pr * 0.15, H * 0.62 - pr * 0.1, pr * 0.15, pr * 0.12, "#5AA9E0");
    // shooting star
    const st = (this.t * 0.25) % 1;
    if (st < 0.25) { const u = st / 0.25, sx = W * (0.2 + u * 0.7), sy = H * (0.08 + u * 0.2); g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 50, sy - 14); g.stroke(); }
  }

  private drawArena(g: G) {
    const a = this.arena;
    g.save(); g.shadowColor = "#B47CFF"; g.shadowBlur = 26;
    rr(g, a.x, a.y, a.w, a.h, 30); g.fillStyle = "#2E1B5E"; g.fill();
    g.restore();
    rr(g, a.x, a.y, a.w, a.h, 30);
    const fl = g.createLinearGradient(0, a.y, 0, a.y + a.h); fl.addColorStop(0, "#3D2678"); fl.addColorStop(1, "#24134D");
    g.fillStyle = fl; g.fill();
    g.save(); rr(g, a.x, a.y, a.w, a.h, 30); g.clip();
    // lounge carpet dots + soft lamp glows
    g.fillStyle = "rgba(180,124,255,0.10)";
    for (let y = a.y + 16; y < a.y + a.h; y += 26) for (let x = a.x + 14 + ((y / 26) % 2) * 13; x < a.x + a.w; x += 26) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    for (const [fx, col] of [[0.15, "rgba(124,242,201,0.16)"], [0.85, "rgba(255,111,145,0.16)"]] as const) {
      const lx = a.x + a.w * fx, lg = g.createRadialGradient(lx, a.y, 0, lx, a.y, a.h * 0.7); lg.addColorStop(0, col); lg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = lg; g.fillRect(a.x, a.y, a.w, a.h);
    }
    // glowing pads under each blob
    if (this.hud.status === "playing") for (const b of this.blobs) {
      const c = this.cells[b.cell]; if (!c) continue;
      g.fillStyle = "rgba(124,242,255,0.10)"; g.beginPath(); g.ellipse(c.x, c.y + this.R * 1.0, this.R * 1.1, this.R * 0.28, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    rr(g, a.x, a.y, a.w, a.h, 30); g.strokeStyle = "#B47CFF"; g.lineWidth = 3; g.stroke();
    rr(g, a.x + 5, a.y + 5, a.w - 10, a.h - 10, 26); g.strokeStyle = "rgba(124,242,255,0.25)"; g.lineWidth = 2; g.stroke();
  }

  private drawBeams(g: G) {
    for (const b of this.blobs) {
      if (b.beam <= 0) continue;
      const p = this.pos(b), a = this.arena, k = Math.sin(Math.min(1, b.beam * 1.4) * Math.PI);
      g.save(); g.globalAlpha = 0.6 * Math.max(0.2, k);
      const bg = g.createLinearGradient(p.x - this.R, 0, p.x + this.R, 0);
      bg.addColorStop(0, "rgba(124,242,201,0)"); bg.addColorStop(0.5, "rgba(124,242,201,0.8)"); bg.addColorStop(1, "rgba(124,242,201,0)");
      g.fillStyle = bg; g.beginPath(); g.moveTo(p.x - this.R * 0.5, a.y); g.lineTo(p.x + this.R * 0.5, a.y); g.lineTo(p.x + this.R * 1.4, p.y + this.R * 1.2); g.lineTo(p.x - this.R * 1.4, p.y + this.R * 1.2); g.closePath(); g.fill();
      g.restore();
    }
  }

  private drawReveal(g: G) {
    const b = this.reveal;
    if (!b) return;
    const p = this.pos(b), pulse = 1 + Math.sin(this.t * 10) * 0.08, R = this.R * (b.v.size ? 0.75 : 1.05);
    g.save();
    g.strokeStyle = "#FFD25A"; g.lineWidth = 5; g.setLineDash([10, 7]); g.lineDashOffset = -this.t * 40;
    g.beginPath(); g.ellipse(p.x, p.y + this.R * 0.25, R * 1.35 * pulse, R * 1.3 * pulse, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    const ay = p.y - R * 1.6 - Math.abs(Math.sin(this.t * 8)) * 10, as = Math.max(11, this.R * 0.28);
    g.beginPath(); g.moveTo(p.x - as, ay - as); g.lineTo(p.x + as, ay - as); g.lineTo(p.x, ay + as * 0.4); g.closePath();
    clayFill(g, "#FFD25A", p.x, ay - as * 0.4, as, { gloss: 0.5 }); g.strokeStyle = "#23305A"; g.lineWidth = 3; g.stroke();
    g.restore();
  }

  private drawZib(g: G) {
    const z = this.zib, mood = this.hud.status === "playing" ? this.hud.host.mood : "happy";
    const hover = Math.sin(this.t * 2.2) * 5;
    // hover saucer
    const sy = z.y + hover, sw = z.h * 0.75;
    const gl = g.createRadialGradient(z.x, sy + 10, 0, z.x, sy + 10, sw);
    gl.addColorStop(0, "rgba(124,242,201,0.35)"); gl.addColorStop(1, "rgba(124,242,201,0)");
    g.fillStyle = gl; g.beginPath(); g.ellipse(z.x, sy + 14, sw, sw * 0.3, 0, 0, Math.PI * 2); g.fill();
    this.sprite(g, this.host(mood), z.x, sy - z.h * 0.08, z.h, { sy: 1 + z.bop * 0.1 + Math.sin(this.t * 2.6) * 0.015, sx: 1 - z.bop * 0.05, rot: Math.sin(this.t * 1.3) * 0.04 });
    blob(g, z.x, sy - 2, sw * 0.72, z.h * 0.11, "#B8C4D6", { gloss: 0.6 });
    blob(g, z.x, sy + 4, sw * 0.5, z.h * 0.06, "#8A95AD", { gloss: 0.2 });
    for (let i = 0; i < 5; i++) { const on = Math.sin(this.t * 6 + i) > 0; blob(g, z.x + (i - 2) * sw * 0.26, sy - 1, 3.5, 3.5, on ? "#FFD25A" : "#7CF2C9", { gloss: 0.6 }); }
  }

  private drawProgress(g: G) {
    if (this.hud.status !== "playing") return;
    const P = this.prog, n = this.prompts;
    clayPanel(g, P.x, P.y, P.w, P.h, 18, "#2B2F5E", { lip: 5 });
    const done = Math.min(this.pi, n);
    clayText(g, `${Math.min(done + 1, n)}/${n}`, P.x + P.w / 2, P.y + (P.h - 5) * 0.32, Math.min(20, P.h * 0.32), { fill: "#FFFFFF", stroke: "#141834", gloss: false });
    const sp = Math.min(20, (P.w - 20) / n), r = Math.min(7, sp * 0.42), x0 = P.x + P.w / 2 - ((n - 1) * sp) / 2, y = P.y + (P.h - 5) * 0.7;
    for (let i = 0; i < n; i++) {
      const res = this.results[i];
      if (res === true) star(g, x0 + i * sp, y, r * 1.3, "#FFD25A");
      else { g.fillStyle = res === false ? "#FF6F91" : i === this.pi ? "rgba(124,242,255,0.7)" : "rgba(255,255,255,0.2)"; g.beginPath(); g.arc(x0 + i * sp, y, r * 0.75, 0, Math.PI * 2); g.fill(); }
    }
  }

  private scene(g: G) {
    this.drawSpace(g);
    this.drawArena(g);
    this.drawBeams(g);
    const sorted = [...this.blobs].sort((a, b) => (this.cells[a.cell]?.y ?? 0) - (this.cells[b.cell]?.y ?? 0));
    for (const b of sorted) this.drawBlob(g, b, this.R);
    this.drawReveal(g);
    this.drawZib(g);
    this.drawProgress(g);
  }

  protected drawBackground(g: G) {
    if (!this.blobs.length) {
      const demo: Vals[] = [0, 1, 2, 3, 4, 5].map((i) => ({ color: [4, 4, 4, 0, 4, 4][i], shape: i % 3, eyes: (i + 1) % 3, hat: i % 4, pattern: i % 3, size: 0 }));
      this.blobs = demo.map((v, i) => ({ v, odd: i === 3, cell: i, jx: 0, jy: 0, ph: i * 1.3, pop: 1, beam: 0, wig: 0, bad: 0, out: 0 }));
      this.layout();
    }
    this.layout();
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}
