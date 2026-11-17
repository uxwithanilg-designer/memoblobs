// Balance Buddies — Prof. Hoot's playground. See-saws show who is heavier (heavy side tilts down, equal = level).
// Use the comparisons (and a little transitive thinking) to find the HEAVIEST — or later the LIGHTEST — buddy.
// Each prompt shows a minimal set of see-saws that decides the answer. Unlimited levels: more buddies, longer
// chains, then LIGHTEST rounds, EQUAL see-saws, MEMORY see-saws (covered after a look) and 2-vs-1 see-saws.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, ramp, spriteUrl, type CastId, type GameMeta } from "../engine";
import { FONT, NAVY, blob, clayFill, clayPanel, clayText, darken, lighten, rr, shadow, star, type G } from "../paint";

const CAST: CastId[] = ["momo", "pip", "gloop", "zib", "bolt", "bonbon", "tiki", "kranky"];
const NAME: Record<string, string> = { momo: "Momo", pip: "Pip", gloop: "Gloop", zib: "Zib", bolt: "Bolt", bonbon: "Bonbon", tiki: "Tiki", kranky: "Kranky" };
const budUrl = (id: CastId, mood: "happy" | "wow") => (id === "tiki" ? "/brand/tiki.webp" : spriteUrl(id, mood));
const SPRITES = [...new Set(CAST.flatMap((id) => [budUrl(id, "happy"), budUrl(id, "wow")]))];
const SAW_COLS = ["#FF8A3D", "#2EC4B6", "#9B5DE5", "#FF6F91", "#3B82F6", "#5DBB46"];

interface Saw {
  a: number[]; b: number[]; rel: -1 | 0 | 1; // rel 1 = side a is heavier
  x: number; y: number; s: number; col: string;
  drop: number; tilt: number; land: number; cover: number; shown: boolean;
}
interface Btn { i: number; x: number; y: number; r: number; press: number; wig: number; hop: number; state: "idle" | "right" | "wrong" | "answer" }
type Phase = "intro" | "show" | "answer" | "result" | "done";
type Twist = "light" | "equal" | "memory" | "pair";

export default class BalanceBuddies extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "balance-buddies", title: "Balance Buddies", host: "hoot", style: "rounds",
    music: { calm: "a:balance_calm", action: "a:balance_action" },
    sounds: ["a:creak", "a:squeak", "a:clunk", "a:wobble", "a:cheer", "a:tink", "a:page", "a:curtain", "a:tickHi", "a:twinkle", "a:poof", "thud", "boing", "a:gong",
      ...CAST.flatMap((id) => [`v:${id}_happy`, `v:${id}_wow`] as const)],
    sprites: SPRITES, voicePitch: 1.0, transition: "iris",
  };
  private buds: CastId[] = [];
  private saws: Saw[] = [];
  private btns: Btn[] = [];
  private answer = 0;
  private heavy = true;
  private memory = false;
  private phase: Phase = "intro";
  private prompt = 0; private prompts = 6;
  private hearts = 3; private heartsMax = 3; private misses = 0;
  private limit = 12; private left = 12; private t0 = 0;
  private seen = new Set<Twist>();
  private recent = new Recent(30);
  private castBag = new Bag<CastId>(CAST);
  private hoot = { x: 0, y: 0, h: 80, bop: 0 };
  private sign = { x: 0, y: 0, w: 200, h: 60, pop: 0 };
  private grid = { x: 0, y: 0, w: 300, h: 300 };
  private line = { x: 0, y: 0, w: 300, h: 90 };
  private bg?: HTMLCanvasElement;
  private demo = false;
  private pid = 0;

  protected onResize() { this.layout(); this.bg = undefined; }

  // ------------------------------------------------------------ layout
  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H;
    const colW = Math.min(W - 16, 1100), x0 = (W - colW) / 2;
    const lineH = portrait ? clamp(A.h * 0.15, 78, 108) : clamp(A.h * 0.19, 90, 132);
    this.line = { x: x0, y: A.y + A.h - lineH, w: colW, h: lineH };
    const topH = portrait ? clamp(A.h * 0.12, 62, 84) : clamp(A.h * 0.14, 70, 96);
    const hw = topH * 1.05;
    const sw = Math.min(colW - hw - 8, 560);
    const gx = (W - (hw + 8 + sw)) / 2;
    Object.assign(this.hoot, { x: gx + hw / 2, y: A.y + topH + 4, h: topH * 1.15 });
    Object.assign(this.sign, { x: gx + hw + 8, y: A.y + 4, w: sw, h: topH - 6 });
    this.grid = { x: x0, y: A.y + topH + 12, w: colW, h: this.line.y - (A.y + topH + 12) - 8 };
    this.layoutSaws();
    this.layoutBtns();
  }

  private layoutSaws() {
    const m = this.saws.length || 2, R = this.grid;
    let best = { cols: 1, s: 0 };
    for (let cols = 1; cols <= Math.min(3, m); cols++) {
      const rows = Math.ceil(m / cols), cw = R.w / cols, ch = R.h / rows;
      const s = Math.min(cw * 0.9, ch * 1.42, 330);
      if (s > best.s + 4) best = { cols, s };
    }
    const cols = best.cols, rows = Math.ceil(m / cols), ch = R.h / rows, cw = Math.min(R.w / cols, best.s * 1.25);
    this.saws.forEach((w, k) => {
      const r = Math.floor(k / cols), inRow = Math.min(cols, m - r * cols), c = k % cols;
      w.x = R.x + R.w / 2 + (c - (inRow - 1) / 2) * cw;
      w.y = R.y + ch * (r + 1) - ch * 0.12;
      w.s = best.s;
    });
  }

  private layoutBtns() {
    const n = this.btns.length || 4, L = this.line;
    const r = Math.max(23, Math.min(46, L.h * 0.38, (L.w - 10) / n / 2 - 5));
    const sp = Math.min((L.w - 10) / n, r * 2 + 26);
    this.btns.forEach((b, k) => { b.x = this.W / 2 + (k - (n - 1) / 2) * sp; b.y = L.y + L.h * 0.42; b.r = r; });
  }

  // ------------------------------------------------------------ levels
  private lv(e: number, m: number, h: number) { return this.level >= byDiff(this.diff, { easy: e, medium: m, hard: h }); }

  protected setupLevel() {
    const d = this.diff;
    this.prompt = 0; this.prompts = 6; this.misses = 0;
    this.heartsMax = byDiff(d, { easy: 3, medium: 3, hard: 2 }); this.hearts = this.heartsMax;
    this.seen.clear();
    this.saws = []; this.btns = [];
    this.music(this.level >= byDiff(d, { easy: 8, medium: 5, hard: 3 }) ? "action" : "calm");
    this.react("happy", this.rng.pick(["Hoo! Who's the heaviest?", "Weigh-in time!", "Watch the see-saws!", "Think it through, hoo!"]));
    this.after(0.5, () => this.newPrompt());
  }

  private newPrompt() {
    const L = this.level, d = this.diff;
    const n = byDiff(d, { easy: Math.min(5, 3 + Math.floor((L - 1) / 3)), medium: Math.min(6, 4 + Math.floor((L - 1) / 3)), hard: Math.min(7, 4 + Math.floor((L - 1) / 2)) });
    const pChain = byDiff(d, { easy: ramp(L, 0.3, 0.06, 0.75), medium: ramp(L, 0.45, 0.05, 0.85), hard: ramp(L, 0.6, 0.04, 0.9) });
    const light = this.lv(4, 3, 2) && this.rng.chance(0.4);
    const equal = n >= 4 && this.lv(7, 5, 3) && this.rng.chance(0.45);
    const memory = this.lv(12, 8, 6) && this.rng.chance(0.45);
    const pair = !light && n >= 4 && this.lv(20, 14, 9) && this.rng.chance(0.5);
    let order: number[] = [], edges: { c: number; p: number; eq: boolean }[] = [], buds: CastId[] = [];
    for (let tries = 0; tries < 20; tries++) {
      buds = [];
      while (buds.length < n) { const id = this.castBag.next(this.rng); if (!buds.includes(id)) buds.push(id); }
      order = this.rng.shuffle([...Array(n).keys()]);
      edges = [];
      for (let i = 1; i < n; i++) {
        const v = order[i];
        if (equal && i >= 2 && !edges.some((e) => e.eq) && this.rng.chance(i === n - 1 ? 1 : 0.4)) { edges.push({ c: v, p: order[this.rng.int(1, i - 1)], eq: true }); continue; }
        const p = i === 2 && this.rng.chance(pChain) ? order[1] : this.rng.chance(pChain) ? order[i - 1] : this.rng.pick(order.slice(0, i));
        edges.push({ c: v, p, eq: false });
      }
      const sig = buds.join(",") + "|" + order[0] + "|" + edges.map((e) => `${e.c}${e.eq ? "=" : "<"}${e.p}`).join(",") + (light ? "L" : "H");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    // build the see-saws (lighter/heavier sides), optionally merging two siblings into a 2-vs-1 see-saw
    const saws: Saw[] = [];
    const used = new Set<number>();
    if (pair) {
      const byP = new Map<number, number[]>();
      edges.forEach((e, k) => { if (!e.eq && !edges.some((o) => o.eq && (o.p === e.c || o.c === e.c))) byP.set(e.p, [...(byP.get(e.p) ?? []), k]); });
      const grp = [...byP.values()].find((ks) => ks.length >= 2);
      if (grp) {
        const [k1, k2] = grp;
        used.add(k1); used.add(k2);
        saws.push(this.mkSaw([edges[k1].c, edges[k2].c], [edges[k1].p], -1));
      }
    }
    edges.forEach((e, k) => {
      if (used.has(k)) return;
      if (e.eq) saws.push(this.mkSaw([e.c], [e.p], 0));
      else saws.push(this.mkSaw([e.c], [e.p], light ? 1 : -1)); // child lighter (heaviest q) / child heavier (lightest q)
    });
    for (const w of saws) if (this.rng.chance(0.5)) { const t = w.a; w.a = w.b; w.b = t; w.rel = (-w.rel) as -1 | 0 | 1; }
    this.rng.shuffle(saws).forEach((w, k) => (w.col = SAW_COLS[k % SAW_COLS.length]));
    this.buds = buds; this.saws = saws; this.answer = order[0]; this.heavy = !light; this.memory = memory;
    this.btns = this.rng.shuffle([...Array(n).keys()]).map((i) => ({ i, x: 0, y: 0, r: 30, press: 0, wig: 0, hop: 0, state: "idle" as const }));
    this.limit = byDiff(d, { easy: ramp(L, 16, -0.4, 9), medium: ramp(L, 13, -0.4, 7), hard: ramp(L, 11, -0.35, 6) }) + saws.length * 1.1;
    this.layout();
    this.phase = "intro"; this.pid++;
    this.sign.pop = 0; this.tween(this.sign, { pop: 1 }, 0.45, ease.back);
    this.sfx("a:page", { gain: 0.4 });
    // twist banners (first time in a level)
    const tw: [Twist, boolean, string, string][] = [["light", light, "LIGHTEST!", "Now find the lightest buddy"], ["equal", saws.some((w) => w.rel === 0), "EQUAL!", "A level see-saw means the same weight"], ["memory", memory, "MEMORY!", "Each see-saw hides after a look"], ["pair", saws.some((w) => w.a.length + w.b.length > 2), "2 vs 1!", "Two friends together are still lighter!"]];
    const fresh = tw.find(([k, on]) => on && !this.seen.has(k));
    for (const [k, on] of tw) if (on) this.seen.add(k);
    let t = 0.35;
    if (fresh) { this.banner(fresh[2], fresh[3], fresh[0] === "light" ? "mint" : "pink"); this.react("wow", this.rng.pick(["Hoo! Something new!", "Ooh, tricky!", "Pay attention, hoo!"])); t = 1.6; }
    this.hint(this.memory ? "Remember each see-saw! 👀" : this.heavy ? "Heavy side goes DOWN ⬇️" : "Light side goes UP ⬆️");
    // reveal see-saws one at a time
    const step = byDiff(d, { easy: 1.0, medium: 0.85, hard: 0.7 }) + (memory ? 1.0 : 0);
    const id = this.pid;
    this.phase = "show";
    saws.forEach((w, k) => {
      this.after(t + k * step, () => {
        if (id !== this.pid) return;
        w.shown = true;
        this.tween(w, { drop: 0 }, 0.35, ease.in);
        this.sfx("boing", { gain: 0.35, x: w.x, rate: 1 + k * 0.05 });
        this.after(0.36, () => { w.land = 1; this.sfx("a:clunk", { gain: 0.4, x: w.x }); });
        this.after(0.45, () => {
          this.tween(w, { tilt: w.rel === 1 ? -1 : w.rel === -1 ? 1 : 0 }, 0.8, ease.elastic);
          if (w.rel === 0) this.sfx("a:wobble", { gain: 0.45, x: w.x }); else { this.sfx("a:creak", { gain: 0.45, x: w.x }); this.sfx("thud", { gain: 0.45, x: w.x, delay: 0.18 }); }
          this.hoot.bop = 1;
        });
        if (memory) this.after(step - 0.15, () => { if (id !== this.pid) return; this.tween(w, { cover: 1 }, 0.35, ease.out); this.sfx("a:curtain", { gain: 0.3, x: w.x }); });
      });
    });
    this.after(t + saws.length * step + (memory ? 0.3 : 0.5), () => { if (id === this.pid) this.startAnswer(); });
  }

  private mkSaw(a: number[], b: number[], rel: -1 | 0 | 1): Saw {
    return { a, b, rel, x: 0, y: 0, s: 100, col: SAW_COLS[0], drop: 1, tilt: 0, land: 0, cover: 0, shown: false };
  }

  private startAnswer() {
    this.phase = "answer"; this.t0 = this.t; this.left = this.limit;
    this.hint(this.heavy ? "Tap the HEAVIEST buddy! 🏋️" : "Tap the LIGHTEST buddy! 🎈");
    this.sfx("a:tink", { gain: 0.4 });
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = Number(key) - 1;
    if (k >= 0 && k < this.btns.length) this.choose(this.btns[k]);
  }

  protected onDown(x: number, y: number) {
    const b = this.btns.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r + 10);
    if (b) this.choose(b);
  }

  private choose(b: Btn) {
    if (this.phase !== "answer") { if (this.phase === "show") { b.wig = 1; this.sfx("a:tink", { gain: 0.3 }); } return; }
    b.press = 1; this.tween(b, { press: 0 }, 0.25);
    this.phase = "result"; this.timerBar(null);
    const id = this.buds[b.i];
    const ok = b.i === this.answer;
    for (const w of this.saws) if (w.cover > 0) this.tween(w, { cover: 0 }, 0.4, ease.out, 0.2);
    if (ok) {
      b.state = "right"; b.hop = 1;
      const speed = clamp(1 - (this.t - this.t0) / this.limit, 0, 1);
      this.good(b.x, b.y - b.r - 10, 50 + 10 * this.buds.length + (this.memory ? 30 : 0), speed);
      this.sfx(`v:${id}_happy`, { gain: 0.6, delay: 0.15, duck: false });
      this.sfx("a:cheer", { gain: 0.45, delay: 0.1 });
      this.burst(b.x, b.y - b.r, { n: 18, colors: ["#FFD25A", "#FFFFFF", "#FF8A3D"], kind: "star", speed: 260 });
      if (this.combo % 4 !== 0) this.react("happy", this.rng.pick(this.heavy ? [`${NAME[id]} is the heaviest!`, "Hoo-ray! Heavy-weight!", "Correct, hoo!", "Big brain!"] : [`${NAME[id]} is light as a feather!`, "Hoo-ray! Featherweight!", "Correct, hoo!", "Smart thinking!"]));
    } else {
      b.state = "wrong"; b.wig = 1;
      this.misses++; this.hearts--;
      const r = this.btns.find((x) => x.i === this.answer);
      if (r) { r.state = "answer"; r.hop = 1; }
      this.sfx(`v:${id}_wow`, { gain: 0.55, delay: 0.1, duck: false });
      this.bad(b.x, b.y, { line: this.rng.pick(this.heavy ? [`Hoo… ${NAME[this.buds[this.answer]]} is heavier!`, "Not quite! Who never goes UP?", "Hoo-hoo, look again!"] : [`Hoo… ${NAME[this.buds[this.answer]]} is lighter!`, "Not quite! Who never goes DOWN?", "Hoo-hoo, look again!"]) });
    }
    this.after(ok ? 1.3 : 2.0, () => this.next());
  }

  private next() {
    if (this.hearts <= 0) { this.phase = "done"; this.levelFail(this.heavy ? "Find the heaviest buddy!" : "Find the lightest buddy!"); return; }
    this.prompt++;
    if (this.prompt >= this.prompts) {
      this.phase = "done";
      this.levelClear({ perfect: this.misses === 0, title: this.misses === 0 ? "PERFECT BALANCE!" : undefined });
      return;
    }
    if (this.prompt === this.prompts - 2) this.music("action");
    // see-saws hop away, new ones drop in
    this.phase = "intro"; this.pid++;
    this.saws.forEach((w, k) => this.tween(w, { drop: -1 }, 0.35, ease.in, k * 0.04));
    this.sfx("a:whooshOut", { gain: 0.35 });
    this.after(0.5, () => this.newPrompt());
  }

  private timeUp() {
    this.phase = "result"; this.timerBar(null);
    this.misses++; this.hearts--;
    for (const w of this.saws) if (w.cover > 0) this.tween(w, { cover: 0 }, 0.4, ease.out);
    const r = this.btns.find((x) => x.i === this.answer);
    if (r) { r.state = "answer"; r.hop = 1; }
    this.sfx("a:gong", { gain: 0.45 });
    this.bad(this.W / 2, this.line.y, { line: this.rng.pick(["Hoo! Time's up!", "Too slow, hoo!", "Tick-tock, hoo!"]) });
    this.after(2.0, () => this.next());
  }

  protected update(dt: number) {
    this.hoot.bop = Math.max(0, this.hoot.bop - dt * 3);
    for (const b of this.btns) { b.wig = Math.max(0, b.wig - dt * 2.5); if (b.hop > 0) b.hop = Math.max(0, b.hop - dt * 0.9); }
    for (const w of this.saws) w.land = Math.max(0, w.land - dt * 3);
    if (this.phase === "answer") {
      this.left -= dt;
      const u = this.left / this.limit;
      this.timerBar(u, u < 0.3 ? "#FF6F91" : "#FFD25A");
      if (u < 0.3 && Math.floor(this.left) !== Math.floor(this.left + dt)) this.sfx("a:tickHi", { gain: 0.3 });
      if (this.left <= 0) this.timeUp();
    }
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H, A = this.area;
    const horizon = A.y + (this.sign.h + 10) * 0.9;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#7CC8FF"); sky.addColorStop(1, "#D6F0FF");
    g.fillStyle = sky; g.fillRect(0, 0, W, horizon + 40);
    for (let i = 0; i < 7; i++) blob(g, ((i * 211) % (W + 120)) - 60, A.y * 0.4 + (i % 3) * 26 + 20, 46 + (i % 3) * 16, 18 + (i % 2) * 6, "#FFFFFF", { gloss: 0.4 });
    // rolling hills
    const hills: [string, number, number][] = [["#9BDB6A", 0.0, 34], ["#7CCB52", 0.6, 22]];
    for (const [col, ph, amp] of hills) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, horizon + 8 + Math.sin(x * 0.012 + ph * 5) * amp * 0.5 + (ph ? 26 : 0));
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    const grass = g.createLinearGradient(0, horizon + 40, 0, H);
    grass.addColorStop(0, "#6CC04A"); grass.addColorStop(1, "#4FA63A");
    g.fillStyle = grass; g.fillRect(0, horizon + 44, W, H);
    // little flowers and tufts
    for (let i = 0; i < 46; i++) {
      const x = (i * 97.7) % W, y = horizon + 60 + ((i * 53.3) % Math.max(10, H - horizon - 70));
      if (i % 3 === 0) { for (let k = 0; k < 5; k++) { g.fillStyle = ["#FFFFFF", "#FFD25A", "#FF8FB1"][i % 3]; g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 3, 0, Math.PI * 2); g.fill(); } g.fillStyle = "#FFB000"; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); }
      else { g.strokeStyle = "rgba(40,110,30,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y + 4); g.lineTo(x - 2, y - 3); g.moveTo(x, y + 4); g.lineTo(x + 1, y - 5); g.moveTo(x + 4, y + 4); g.lineTo(x + 5, y - 2); g.stroke(); }
    }
    // bench strip for the line-up
    const L = this.line;
    shadow(g, W / 2, L.y + L.h * 0.86, L.w * 0.5, 12, 0.3);
    rr(g, L.x + 4, L.y + L.h * 0.68, L.w - 8, L.h * 0.22, 12); clayFill(g, "#C98A4B", W / 2, L.y + L.h * 0.78, L.w * 0.5, { gloss: 0.2 });
    g.fillStyle = "rgba(90,52,32,0.25)"; g.fillRect(L.x + 14, L.y + L.h * 0.78, L.w - 28, 3);
    this.bg = c;
  }

  private fitH(url: string, maxW: number, maxH: number) {
    const im = this.img(url);
    if (!im || !im.naturalWidth) return maxH;
    return Math.min(maxH, (maxW * im.naturalHeight) / im.naturalWidth);
  }

  private drawSaw(g: G, w: Saw, k: number) {
    const s = w.s, px = w.x, by = w.y;
    const lift = w.drop > 0 ? w.drop * 140 : w.drop < 0 ? -w.drop * (by + 60) : 0;
    const alpha = w.drop > 0 ? 1 - w.drop * 0.6 : 1;
    const fh = s * 0.17, pivotY = by - fh, Lp = s * 0.88, th = Math.max(6, s * 0.045);
    g.save();
    if (w.drop < 0) g.translate(0, -lift);
    blob(g, px, by + 2, s * 0.5, s * 0.07, "#8ED46A", { gloss: 0.15 });
    shadow(g, px, by + 2, s * 0.42, 7, 0.3);
    // fulcrum
    g.beginPath(); g.moveTo(px - s * 0.12, by); g.quadraticCurveTo(px, by + 4, px + s * 0.12, by); g.lineTo(px + s * 0.025, pivotY); g.lineTo(px - s * 0.025, pivotY); g.closePath();
    clayFill(g, w.col, px, by - fh * 0.5, fh, { gloss: 0.35 });
    const wob = w.rel === 0 && w.shown ? Math.sin(this.t * 2.2 + k) * 0.03 : 0;
    const ang = clamp(w.tilt, -1.3, 1.3) * 0.3 + wob;
    // plank
    g.save(); g.translate(px, pivotY); g.rotate(ang);
    rr(g, -Lp / 2, -th / 2, Lp, th, th / 2); clayFill(g, "#E3A563", 0, 0, Lp * 0.5, { gloss: 0.25, rim: false });
    g.strokeStyle = "rgba(122,74,36,0.5)"; g.lineWidth = 1.5;
    for (const fx of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(Lp * fx - 4, -th * 0.2); g.lineTo(Lp * fx + 8, -th * 0.2); g.stroke(); }
    for (const sd of [-1, 1]) { rr(g, sd * Lp * 0.36 - th * 0.35, -th * 2.3, th * 0.7, th * 2, th * 0.3); g.fillStyle = darken(w.col, 0.15); g.fill(); blob(g, sd * Lp * 0.36, -th * 2.4, th * 0.75, th * 0.5, w.col, { gloss: 0.4 }); }
    g.restore();
    blob(g, px, pivotY, s * 0.035, s * 0.035, "#FFD25A", { gloss: 0.6 });
    // buddies (upright), sitting on each end
    g.save(); g.globalAlpha *= alpha;
    if (w.shown && w.cover < 0.6) for (const [side, list] of [[-1, w.a], [1, w.b]] as const) {
      const two = list.length > 1;
      list.forEach((bi, j) => {
        const d = two ? Lp * (j === 0 ? 0.25 : 0.45) : Lp * 0.43;
        const ex = px + Math.cos(ang) * d * side, ey = pivotY + Math.sin(ang) * d * side - th * 0.5;
        const id = this.buds[bi]; if (!id) return;
        const down = (side === -1 && w.rel === 1) || (side === 1 && w.rel === -1);
        const up = w.rel !== 0 && !down && Math.abs(w.tilt) > 0.5;
        const url = budUrl(id, up ? "wow" : "happy");
        const bh = this.fitH(url, s * (two ? 0.27 : 0.36), s * (two ? 0.3 : 0.38));
        const sq = w.land * 0.18;
        this.sprite(g, url, ex, ey - (w.drop > 0 ? lift : 0), bh, { sy: 1 - sq + Math.sin(this.t * 3 + bi) * 0.01, sx: 1 + sq * 0.6, rot: up ? Math.sin(this.t * 9 + bi) * 0.05 : 0 });
      });
    }
    g.restore();
    if (w.rel === 0 && w.shown && Math.abs(w.tilt) < 0.2 && w.drop <= 0.01) {
      const ry = by - fh * 0.42;
      blob(g, px, ry, s * 0.055, s * 0.055, "#FFFFFF", { gloss: 0.3 });
      g.fillStyle = NAVY; g.fillRect(px - s * 0.03, ry - s * 0.02, s * 0.06, s * 0.012); g.fillRect(px - s * 0.03, ry + s * 0.008, s * 0.06, s * 0.012);
    }
    // memory cover
    if (w.cover > 0.01) {
      const cw = s * 1.02, chh = s * 0.72, cy = by - chh + 6;
      const yy = lerp(cy - chh * 0.8, cy, ease.out(w.cover));
      g.save(); g.globalAlpha *= Math.min(1, w.cover * 1.5);
      g.beginPath(); g.moveTo(px - cw / 2, yy + chh); g.quadraticCurveTo(px - cw / 2 - 6, yy, px - cw * 0.3, yy + 4);
      g.quadraticCurveTo(px, yy - 14, px + cw * 0.3, yy + 4); g.quadraticCurveTo(px + cw / 2 + 6, yy, px + cw / 2, yy + chh);
      for (let i = 0; i <= 6; i++) g.lineTo(px + cw / 2 - (cw * i) / 6, yy + chh + (i % 2 ? 8 : 0));
      g.closePath();
      clayFill(g, "#B79CFF", px, yy + chh / 2, cw * 0.55, { gloss: 0.3 });
      clayText(g, "?", px, yy + chh * 0.5, Math.min(48, s * 0.22), { fill: "#FFFFFF", stroke: "#6A4FC0" });
      g.restore();
    }
    g.restore();
  }

  private drawSign(g: G, live: boolean) {
    const S = this.sign, p = live ? S.pop : 1;
    const heavy = live ? this.heavy : true;
    g.save(); g.translate(S.x + S.w / 2, S.y + S.h / 2); g.scale(p, p); g.translate(-(S.x + S.w / 2), -(S.y + S.h / 2));
    shadow(g, S.x + S.w / 2, S.y + S.h + 2, S.w * 0.45, 8, 0.3);
    clayPanel(g, S.x, S.y, S.w, S.h, 18, heavy ? "#FF8A3D" : "#4FB8F0", { lip: 6 });
    const ih = S.h - 6, icx = S.x + ih * 0.6, icy = S.y + ih / 2;
    if (heavy) {
      // a big clay weight
      g.beginPath(); g.moveTo(icx - ih * 0.32, icy + ih * 0.32); g.lineTo(icx + ih * 0.32, icy + ih * 0.32); g.lineTo(icx + ih * 0.22, icy - ih * 0.18); g.lineTo(icx - ih * 0.22, icy - ih * 0.18); g.closePath();
      clayFill(g, "#4A4E6A", icx, icy, ih * 0.4, { gloss: 0.35 });
      g.strokeStyle = "#4A4E6A"; g.lineWidth = ih * 0.07; g.beginPath(); g.arc(icx, icy - ih * 0.22, ih * 0.12, Math.PI, 0); g.stroke();
      g.font = `${ih * 0.2}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF"; g.fillText("KG", icx, icy + ih * 0.1);
    } else {
      // a floaty balloon
      const by = icy - ih * 0.08 + Math.sin(this.t * 3) * 2;
      g.strokeStyle = "#FFFFFF"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(icx, by + ih * 0.26); g.quadraticCurveTo(icx - 5, by + ih * 0.38, icx + 2, by + ih * 0.48); g.stroke();
      blob(g, icx, by, ih * 0.24, ih * 0.28, "#FF6F91", { gloss: 0.6 });
    }
    const tx = S.x + ih * 1.2, tw = S.w - ih * 1.2 - 10;
    const fs = Math.min(S.h * 0.3, 20);
    g.font = `${fs}px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillText("Who is the", tx, S.y + ih * 0.3);
    clayText(g, heavy ? "HEAVIEST?" : "LIGHTEST?", tx, S.y + ih * 0.68, Math.min(S.h * 0.42, tw / 5.2, 34), { fill: "#FFFFFF", stroke: heavy ? "#B24E12" : "#1F6FA0", align: "left" });
    g.restore();
    // progress dots + hearts under the sign
    const n = live ? this.prompts : 6, dy = S.y + S.h + 8;
    for (let i = 0; i < n; i++) { g.fillStyle = live && i < this.prompt ? "#FFD25A" : live && i === this.prompt ? "#FFFFFF" : "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(S.x + 14 + i * 13, dy, 4, 0, Math.PI * 2); g.fill(); }
    const hm = live ? this.heartsMax : 3, hv = live ? this.hearts : 3;
    for (let i = 0; i < hm; i++) this.heart(g, S.x + S.w - 12 - i * 18, dy, 6.5, i < hv ? "#FF5C7A" : "rgba(255,255,255,0.45)");
  }

  private heart(g: G, x: number, y: number, r: number, c: string) {
    g.beginPath(); g.moveTo(x, y + r * 0.85); g.bezierCurveTo(x - r * 1.35, y - r * 0.05, x - r * 0.65, y - r * 1.15, x, y - r * 0.42); g.bezierCurveTo(x + r * 0.65, y - r * 1.15, x + r * 1.35, y - r * 0.05, x, y + r * 0.85);
    clayFill(g, c, x, y, r, { gloss: 0.4 });
  }

  private crown(g: G, x: number, y: number, s: number) {
    g.beginPath(); g.moveTo(x - s, y + s * 0.5); g.lineTo(x - s, y - s * 0.3); g.lineTo(x - s * 0.5, y + s * 0.1); g.lineTo(x, y - s * 0.6); g.lineTo(x + s * 0.5, y + s * 0.1); g.lineTo(x + s, y - s * 0.3); g.lineTo(x + s, y + s * 0.5); g.closePath();
    clayFill(g, "#FFC93C", x, y, s, { gloss: 0.5 });
    for (const dx of [-0.5, 0, 0.5]) blob(g, x + dx * s, y + s * 0.25, s * 0.12, s * 0.12, dx ? "#FF6F91" : "#3B82F6", { gloss: 0.6 });
  }

  private drawBtn(g: G, b: Btn, live: boolean) {
    const id = this.buds[b.i]; if (!id) return;
    const hop = Math.sin(b.hop * Math.PI * 3) * (b.hop > 0 ? 1 : 0);
    const x = b.x + Math.sin(b.wig * 30) * b.wig * 6, y = b.y - Math.abs(hop) * 16;
    const sc = 1 - b.press * 0.08;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    shadow(g, 0, b.r + 4, b.r * 0.8, 5, 0.3);
    const ring = b.state === "right" || b.state === "answer" ? "#FFD25A" : b.state === "wrong" ? "#FF6F91" : "#FFFFFF";
    if (b.state === "right" || b.state === "answer") { g.fillStyle = "rgba(255,230,120,0.45)"; g.beginPath(); g.arc(0, 0, b.r * 1.35 + Math.sin(this.t * 8) * 3, 0, Math.PI * 2); g.fill(); }
    blob(g, 0, 0, b.r, b.r, "#FFF8EA", { gloss: 0.35 });
    g.strokeStyle = ring; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.stroke();
    const url = budUrl(id, b.state === "wrong" ? "wow" : "happy");
    const bh = this.fitH(url, b.r * 1.6, b.r * 1.55);
    this.sprite(g, url, 0, b.r * 0.72, bh, { sy: 1 + Math.sin(this.t * 3 + b.i) * 0.015 });
    if (b.state === "right" || b.state === "answer") this.crown(g, 0, -b.r * 1.02, b.r * 0.4);
    g.restore();
    const fs = clamp(b.r * 0.36, 10, 15);
    g.font = `${fs}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    const label = NAME[id];
    const tw = g.measureText(label).width + 10;
    rr(g, b.x - tw / 2, b.y + b.r + 4, tw, fs + 6, (fs + 6) / 2); g.fillStyle = "rgba(35,48,90,0.85)"; g.fill();
    g.fillStyle = "#FFFFFF"; g.fillText(label, b.x, b.y + b.r + 4 + (fs + 6) / 2 + 1);
    if (live && this.W > 700) { g.font = `${12}px ${FONT}`; g.fillStyle = "rgba(255,255,255,0.8)"; g.fillText(String(this.btns.indexOf(b) + 1), b.x - b.r * 0.8, b.y - b.r * 0.8); }
  }

  private drawHoot(g: G, mood: "happy" | "wow" | "sad") {
    const h = this.hoot;
    this.sprite(g, this.host(mood), h.x, h.y, h.h, { sy: 1 + h.bop * 0.06 + Math.sin(this.t * 2.5) * 0.015, sx: 1 - h.bop * 0.03, rot: Math.sin(this.t * 1.3) * 0.03 });
  }

  private scene(g: G, live: boolean) {
    if (!this.bg || this.bg.width !== Math.round(this.W * this.dpr)) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawHoot(g, live ? this.hud.host.mood : "happy");
    this.drawSign(g, live);
    this.saws.forEach((w, k) => this.drawSaw(g, w, k));
    for (const b of this.btns) this.drawBtn(g, b, live);
    if (live && this.phase === "show") {
      for (const b of this.btns) { g.fillStyle = "rgba(35,48,90,0.12)"; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); }
    }
    if (!live) star(g, this.sign.x + this.sign.w - 18, this.sign.y + 14, 9, "#FFE38A", this.t);
  }

  protected draw(g: G) { this.scene(g, true); }

  protected drawBackground(g: G) {
    if (!this.demo || !this.saws.length) {
      this.demo = true;
      this.buds = ["momo", "gloop", "pip"];
      this.saws = [this.mkSaw([0], [1], -1), this.mkSaw([2], [0], -1)];
      this.saws.forEach((w, k) => { w.drop = 0; w.tilt = w.rel === 1 ? -1 : 1; w.shown = true; w.col = SAW_COLS[k]; });
      this.btns = [0, 1, 2].map((i) => ({ i, x: 0, y: 0, r: 30, press: 0, wig: 0, hop: 0, state: "idle" as const }));
      this.heavy = true;
    }
    this.layout();
    this.scene(g, false);
  }
}
