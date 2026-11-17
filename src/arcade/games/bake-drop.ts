// Bake Drop — Bonbon's bakery. Slide Bonbon's glass mixing bowl to catch falling cake bits and dodge
// Kranky's chilli peppers. Catches stack up inside the bowl and bake into a whole cake for a bonus.
// Endless run: drops get faster, and twists arrive over time (golden cake, wind gusts, sneaky chillies
// hiding among cherries, wobbly drops, double drops), then themed twist levels forever after.
import { ArcadeGame, Bag, byDiff, clamp, ease, lerp, ramp, spriteUrl, type GameMeta, type Mood, type Tone } from "../engine";
import { blob, clayFill, clayText, eye, lighten, mouth, rr, shadow, star, type G } from "../paint";

type Bit = "sponge" | "cherry" | "cream" | "sprinkle" | "berry";
type Layer = Bit | "gold";
type IKind = Bit | "chilli" | "gold" | "heart";
type Feature = "gold" | "wind" | "sneaky" | "wobble" | "double";
interface Item { kind: IKind; x: number; y: number; vy: number; vx: number; rot: number; vr: number; r: number; ph: number; sway: number; sneaky: boolean; state: "fall" | "in" | "out"; u: number; fx: number; fy: number; pop: number }
interface Splat { x: number; y: number; c: string; t0: number; r: number }

const BITS: Bit[] = ["sponge", "cherry", "cream", "sprinkle", "berry"];
const LAYER: Record<Layer, string> = { sponge: "#FFD36B", cherry: "#E8504F", cream: "#FFF6EA", sprinkle: "#FF9CC2", berry: "#FF6F7D", gold: "#FFD25A" };
const STACK = 8;
const UNLOCK: Record<Feature, { easy: number; medium: number; hard: number }> = {
  gold: { easy: 2, medium: 2, hard: 1 },
  wind: { easy: 4, medium: 3, hard: 2 },
  sneaky: { easy: 6, medium: 5, hard: 3 },
  wobble: { easy: 8, medium: 6, hard: 4 },
  double: { easy: 10, medium: 8, hard: 5 },
};
const FEATURES: { id: Feature; title: string; sub: string; tone: Tone; hint: string; line: string }[] = [
  { id: "gold", title: "GOLDEN CAKE!", sub: "Catch it for a big bonus", tone: "gold", hint: "Golden cake = big bonus! ✨", line: "Ooh, shiny cake!" },
  { id: "wind", title: "WINDY!", sub: "Gusts blow the bits sideways", tone: "mint", hint: "Watch the wind arrow! 💨", line: "Hold on to my hat!" },
  { id: "sneaky", title: "SNEAKY CHILLIES!", sub: "They hide among the cherries", tone: "red", hint: "Cherries are round — chillies are long! 🍒🌶️", line: "Look closely!" },
  { id: "wobble", title: "WOBBLY DROPS!", sub: "Bits wiggle as they fall", tone: "pink", hint: "Follow the wiggle! 〰️", line: "Wibble wobble!" },
  { id: "double", title: "DOUBLE DROP!", sub: "Two at a time!", tone: "gold", hint: "Two at once — catch the cake, skip the chilli!", line: "Twice the cake!" },
];
interface Theme { id: string; title: string; sub: string; tone: Tone; line: string }
const THEMES: Theme[] = [
  { id: "chilli", title: "CHILLI STORM!", sub: "Kranky's throwing extra chillies", tone: "red", line: "Spicy spicy!" },
  { id: "windy", title: "WINDY DAY!", sub: "The wind never stops", tone: "mint", line: "Whoooosh!" },
  { id: "big", title: "BIG BITES!", sub: "Giant chunks, slow and heavy", tone: "gold", line: "Big bites!" },
  { id: "tiny", title: "TINY CRUMBS!", sub: "Small bits — sharp eyes!", tone: "pink", line: "Teeny tiny!" },
  { id: "rush", title: "SUGAR RUSH!", sub: "Everything falls faster", tone: "pink", line: "Sugar rush!" },
  { id: "golden", title: "GOLDEN HOUR!", sub: "Lots of golden cake", tone: "gold", line: "Gold everywhere!" },
  { id: "wobble", title: "JELLY WOBBLE!", sub: "Everything wiggles", tone: "mint", line: "Jelly legs!" },
];

export default class BakeDrop extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "bake-drop", title: "Bake Drop", host: "bonbon", style: "run",
    music: { calm: "a:bake_calm", action: "a:bake_action" },
    sounds: ["a:plop", "a:splat", "a:sizzle", "a:twinkle", "a:cheer", "a:poof", "a:nomnom", "a:squelch", "a:whistle", "a:tickHi", "a:go", "whooshLong", "tada", "gibberKShort", "v:kranky_laugh"],
    sprites: [spriteUrl("kranky", "happy"), spriteUrl("kranky", "sad")],
    voicePitch: 1.25, transition: "curtain",
  };
  private items: Item[] = [];
  private splats: Splat[] = [];
  private stack: { k: Layer; pop: number }[] = [];
  private flyCake: { layers: Layer[]; u: number; x: number; y: number } | null = null;
  private peeks: { x: number; t0: number }[] = [];
  private bon = { x: 0, tx: 0, vx: 0, sq: 0, red: 0, hop: 0 };
  private phase: "ready" | "play" | "over" = "ready";
  private phaseT = 0;
  private spawnT = 0; private spawned = 0;
  private catches = 0; private misses = 0; private cakes = 0;
  private keyT = -9;
  private wind = { v: 0, tgt: 0, until: 0, next: 0 };
  private bitBag = new Bag<Bit>(BITS);
  private themeBag = new Bag<Theme>(THEMES);
  private theme: Theme | null = null;
  private announced = new Set<Feature>();
  private warnedMiss = false;
  private tipUntil = 0;
  private progress = -1;
  private demo = false;
  private field = { x: 0, w: 400 };
  private floorY = 700; private bh = 160; private bw = 130; private ir = 22; private rimY = 600; private topY = 140;
  private bg?: HTMLCanvasElement;
  private red = new Map<string, HTMLCanvasElement>();
  private streaks = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.37) % 1, y: (i * 0.61) % 1, v: 0.6 + ((i * 0.29) % 1) }));

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W, H = this.H;
    const fw = Math.min(W - 16, 820);
    this.field = { x: (W - fw) / 2, w: fw };
    this.floorY = H - this.insetBottom - clamp(H * 0.065, 34, 58);
    this.bh = clamp(Math.min(H * 0.25, A.h * 0.34), 120, 240);
    this.bw = clamp(fw * 0.38, 120, 196);
    this.ir = clamp(fw * 0.066, 20, 31);
    this.rimY = this.floorY - this.bh * 0.4;
    this.topY = A.y + 10;
    const lo = this.field.x + this.bw / 2 + 4, hi = this.field.x + fw - this.bw / 2 - 4;
    this.bon.x = clamp(this.bon.x || W / 2, lo, hi); this.bon.tx = clamp(this.bon.tx || W / 2, lo, hi);
    if (this.bg && (this.bg.width !== Math.round(W * this.dpr) || this.bg.height !== Math.round(H * this.dpr))) this.bg = undefined;
  }

  // ------------------------------------------------------------ difficulty
  private has(f: Feature) { return this.level >= byDiff(this.diff, UNLOCK[f]); }
  private allUnlocked() { return this.level > byDiff(this.diff, UNLOCK.double); }
  private fallTime() {
    const L = this.level, th = this.theme?.id;
    const cap = byDiff(this.diff, { easy: 1.45, medium: 1.2, hard: 1.0 });
    let f = byDiff(this.diff, { easy: ramp(L, 3.1, -0.12, cap), medium: ramp(L, 2.6, -0.12, cap), hard: ramp(L, 2.2, -0.1, cap) });
    if (f <= cap) f -= Math.min(0.25, Math.max(0, L - 14) * 0.01);
    return f * (th === "rush" ? 0.8 : th === "big" ? 1.25 : 1);
  }
  private interval() {
    const L = this.level;
    return byDiff(this.diff, { easy: ramp(L, 1.35, -0.06, 0.62), medium: ramp(L, 1.15, -0.06, 0.52), hard: ramp(L, 0.95, -0.05, 0.44) }) * (this.theme?.id === "rush" ? 0.85 : 1);
  }
  private chilliP() {
    const L = this.level;
    return byDiff(this.diff, { easy: ramp(L, 0.1, 0.02, 0.28), medium: ramp(L, 0.14, 0.02, 0.32), hard: ramp(L, 0.18, 0.02, 0.36) }) * (this.theme?.id === "chilli" ? 1.5 : 1);
  }
  private missLimit() { return byDiff(this.diff, { easy: 4, medium: 3, hard: 3 }); }
  private windy() { return this.has("wind") || this.theme?.id === "windy"; }
  private wobbly() { return this.has("wobble") || this.theme?.id === "wobble"; }

  // ------------------------------------------------------------ run setup
  protected setupLevel() {
    this.layout();
    this.items = []; this.splats = []; this.stack = []; this.flyCake = null; this.peeks = []; this.demo = false;
    this.bon = { x: this.W / 2, tx: this.W / 2, vx: 0, sq: 0, red: 0, hop: 0 };
    this.layout();
    this.phase = "ready"; this.phaseT = 0;
    this.spawnT = 0; this.spawned = 0; this.catches = 0; this.misses = 0; this.cakes = 0;
    this.wind = { v: 0, tgt: 0, until: 0, next: this.t + 6 };
    this.bitBag = new Bag<Bit>(BITS); this.themeBag = new Bag<Theme>(THEMES);
    this.theme = this.allUnlocked() ? this.themeBag.next(this.rng) : null;
    this.announced = new Set(FEATURES.filter((f) => this.has(f.id)).map((f) => f.id));
    this.warnedMiss = false; this.progress = -1;
    this.timerBar(0, "#FF9CC2");
    this.music(this.level >= 4 ? "action" : "calm");
    this.tip(this.W < 820 ? "Drag to move Bonbon · catch cake, dodge chillies 🌶️" : "Move the mouse or ← → · catch cake, dodge chillies 🌶️", 9);
    this.react("happy", this.rng.pick(["Let's bake a cake!", "Catch the yummy bits!", "Bowl ready!", "Kitchen time!"]));
    if (this.theme) { const th = this.theme; this.after(1.0, () => this.banner(th.title, th.sub, th.tone)); }
  }

  // ------------------------------------------------------------ spawning
  private spawn() {
    const r = this.rng, th = this.theme?.id;
    const dbl = this.has("double") && this.spawned > 3 && r.chance(0.3);
    const kinds: IKind[] = [];
    const pickOne = (allowChilli: boolean): IKind => {
      if (this.lives < 3 && this.spawned > 6 && r.chance(0.02)) return "heart";
      if (allowChilli && this.spawned >= 3 && r.chance(this.chilliP())) return "chilli";
      if (this.has("gold") && r.chance(th === "golden" ? 0.16 : 0.04)) return "gold";
      if (this.has("sneaky") && r.chance(0.35)) return "cherry";
      return this.bitBag.next(r);
    };
    kinds.push(pickOne(true));
    if (dbl) kinds.push(kinds[0] === "chilli" ? pickOne(false) : pickOne(true));
    const fx = this.field.x, fw = this.field.w;
    const fall = this.fallTime();
    const rad = this.ir * (th === "big" ? 1.3 : th === "tiny" ? 0.75 : 1);
    const lo = fx + Math.max(rad + 6, this.bw * 0.3), hi = fx + fw - Math.max(rad + 6, this.bw * 0.3);
    const placed: { x: number; k: IKind }[] = [];
    for (const k of kinds) {
      const bad = k === "chilli";
      let x = lerp(lo, hi, r.next());
      for (let tries = 0; tries < 14; tries++) {
        x = lerp(lo, hi, r.next());
        let ok = true;
        // stay fair: hazards never land right next to a cake bit arriving at nearly the same moment
        for (const it of this.items) {
          if (it.state !== "fall") continue;
          const arrive = (this.rimY - it.y) / it.vy;
          if (Math.abs(arrive - fall) > 0.75) continue;
          if ((it.kind === "chilli") !== bad && Math.abs(it.x - x) < this.bw * 0.95) ok = false;
        }
        for (const p of placed) {
          if ((p.k === "chilli") !== bad) { if (Math.abs(p.x - x) < this.bw * 1.05) ok = false; }
          else if (Math.abs(p.x - x) > this.bw * 0.6 || Math.abs(p.x - x) < rad * 1.6) ok = false;
        }
        if (ok) break;
      }
      placed.push({ x, k });
      const sway = this.wobbly() && k !== "heart" ? r.range(0.5, 1) * (r.chance(0.5) ? 1 : -1) : 0;
      this.items.push({
        kind: k, x, y: this.topY, vy: (this.rimY - this.topY) / fall, vx: 0, rot: r.range(-0.3, 0.3), vr: r.range(-1.6, 1.6),
        r: k === "gold" ? rad * 1.15 : rad, ph: r.range(0, 10), sway, sneaky: k === "chilli" && this.has("sneaky"),
        state: "fall", u: 0, fx: x, fy: 0, pop: 0,
      });
      const it = this.items[this.items.length - 1];
      this.tween(it, { pop: 1 }, 0.25, ease.back);
      this.burst(x, this.topY, { n: 5, colors: ["#FFFFFF", "#FFF1DC"], kind: "dot", speed: 70, gravity: 40, size: 4, life: 0.5 });
      if (k === "chilli" && !it.sneaky) { this.peeks.push({ x, t0: this.t }); if (r.chance(0.5)) this.sfx("gibberKShort", { x, gain: 0.35 }); }
      if (k === "gold") this.sfx("a:twinkle", { x, gain: 0.35 });
    }
    this.spawned++;
  }

  // ------------------------------------------------------------ input
  private clampX(x: number) { return clamp(x, this.field.x + this.bw / 2 + 4, this.field.x + this.field.w - this.bw / 2 - 4); }
  protected onDown(x: number) { this.bon.tx = this.clampX(x); }
  protected onMove(x: number) { this.bon.tx = this.clampX(x); }
  onKey(k: string) {
    const dir = k === "ArrowLeft" || k === "a" || k === "A" ? -1 : k === "ArrowRight" || k === "d" || k === "D" ? 1 : 0;
    if (!dir) return;
    const held = this.t - this.keyT < 0.12;
    this.keyT = this.t;
    this.bon.tx = this.clampX((held ? this.bon.tx : this.bon.x) + dir * this.field.w * (held ? 0.04 : 0.12));
  }

  // ------------------------------------------------------------ catching
  private catchItem(it: Item) {
    it.state = "in"; it.u = 0; it.fx = it.x; it.fy = it.y;
    this.tween(it, { u: 1 }, 0.16, ease.in);
    this.bon.sq = 1;
    const x = it.x, y = this.rimY - 20;
    if (it.kind === "chilli") {
      this.after(0.12, () => this.sizzle(x));
      return;
    }
    this.after(0.16, () => {
      if (it.kind === "heart") {
        if (this.lives < 3) { this.lives++; this.setHud({ lives: this.lives }); }
        this.float("+♥", x, y - 20, "#FF6F91", 34);
        this.sfx("a:twinkle", { gain: 0.6 }); this.sfx("a:cheer", { gain: 0.35, delay: 0.1 });
        this.react("happy", "Extra heart!");
        return;
      }
      const k: Layer = it.kind === "gold" ? "gold" : (it.kind as Bit);
      const l = { k, pop: 1 }; this.stack.push(l); this.tween(l, { pop: 0 }, 0.3, ease.out);
      this.misses = 0;
      this.catches++;
      this.sfx("a:plop", { x, gain: 0.6, rate: 0.9 + this.stack.length * 0.06 });
      if (it.kind === "gold") {
        this.good(x, y, 60);
        this.burst(x, y, { n: 22, colors: ["#FFD25A", "#FFFFFF", "#FFB000"], kind: "star", speed: 320 });
        this.sfx("a:twinkle", { gain: 0.7 });
        this.react("wow", this.rng.pick(["Golden cake!!", "So shiny!", "Jackpot!"]));
      } else this.good(x, y, 10);
      this.burst(x, this.rimY, { n: 6, colors: [LAYER[k], "#FFFFFF"], kind: "dot", speed: 120, size: 4 });
      if (this.stack.length >= STACK) this.bake();
      if (this.catches % 15 === 0) this.nextLevel();
    });
  }

  private sizzle(x: number) {
    this.sfx("a:sizzle", { x, gain: 0.9 });
    this.bon.red = 1; this.bon.hop = 1;
    // the chilli spoils the bowl: everything flies out
    for (const l of this.stack) this.burst(this.bon.x, this.rimY, { n: 3, colors: [LAYER[l.k]], kind: "dot", speed: 320, size: 7 });
    this.stack = [];
    this.burst(x, this.rimY - 10, { n: 18, colors: ["#FF3B2F", "#FF8A3D", "#FFD25A"], kind: "star", speed: 300 });
    for (let i = 0; i < 6; i++) this.particles.push({ x: this.bon.x + (Math.random() - 0.5) * this.bh * 0.4, y: this.floorY - this.bh * 0.95, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, life: 1.2, max: 1.2, size: 8 + Math.random() * 8, color: "#fff", kind: "bubble", rot: 0, vr: 0, g: -30 });
    this.bad(x, this.rimY - 30, { line: this.rng.pick(["HOT HOT HOT!", "Spicy! My tongue!", "Chilli in my cake?!", "Kranky!!"]) });
    if (this.rng.chance(0.6)) this.sfx("v:kranky_laugh", { gain: 0.6, delay: 0.35, duck: false });
  }

  private miss(it: Item) {
    this.splats.push({ x: it.x, y: this.floorY + 6 + Math.random() * 8, c: it.kind === "chilli" ? "#FF3B2F" : it.kind === "gold" ? "#FFD25A" : it.kind === "heart" ? "#FF6F91" : LAYER[it.kind as Bit], t0: this.t, r: it.r });
    if (it.kind === "chilli") { this.sfx("a:sizzle", { x: it.x, gain: 0.25, rate: 1.4 }); this.burst(it.x, this.floorY, { n: 6, colors: ["#FFFFFF"], kind: "bubble", speed: 60, gravity: -40, size: 5 }); return; }
    this.sfx("a:splat", { x: it.x, gain: 0.55 });
    this.burst(it.x, this.floorY, { n: 8, colors: [it.kind === "gold" ? "#FFD25A" : LAYER[it.kind === "heart" ? "berry" : (it.kind as Bit)], "#FFFFFF"], kind: "dot", speed: 160, size: 5 });
    if (it.kind === "heart" || this.phase !== "play") return;
    this.misses++;
    if (!this.warnedMiss && this.misses === 1) { this.warnedMiss = true; this.tip(`Don't drop ${this.missLimit()} in a row! 🍰`, 4); }
    if (this.misses >= this.missLimit()) {
      this.misses = 0;
      this.bad(it.x, this.floorY - 30, { line: this.rng.pick(["My cake bits!", "Splat, splat, splat!", "Butterfingers!", "So much mess!"]) });
    } else if (this.misses === this.missLimit() - 1) this.react("wow", "Careful! Catch the next one!", false);
  }

  private bake() {
    const layers = this.stack.map((l) => l.k);
    this.stack = [];
    this.cakes++;
    const bonus = Math.round((50 + this.level * 8) * byDiff(this.diff, { easy: 1, medium: 1.5, hard: 2 }));
    this.flyCake = { layers, u: 0, x: this.bon.x, y: this.rimY };
    this.tween(this.flyCake, { u: 1 }, 1.0, ease.inOut);
    this.sfx("tada", { gain: 0.7 }); this.sfx("a:cheer", { gain: 0.5, delay: 0.2 });
    this.burst(this.bon.x, this.rimY - 20, { n: 28, colors: ["#FF6F91", "#FFD25A", "#FFFFFF", "#7CF2C9"], kind: "conf", speed: 380 });
    this.banner("CAKE!", `+${bonus} bonus`, "pink");
    this.react("happy", this.rng.pick(["A whole cake!", "Baked to perfection!", "Cake complete!", "Mmm, cake!"]));
    this.after(1.0, () => { this.addRaw(bonus); this.float(`+${bonus}`, this.W - 70, this.area.y + 50, "#FF9CC2", 30); this.flyCake = null; }, false);
  }

  private nextLevel() {
    this.levelUp();
    if (this.level >= 4) this.music("action");
    const fresh = FEATURES.filter((f) => this.has(f.id) && !this.announced.has(f.id));
    if (fresh.length) {
      for (const f of fresh) this.announced.add(f.id);
      const f = fresh[fresh.length - 1];
      this.after(1.6, () => { this.banner(f.title, f.sub, f.tone); this.react("wow", f.line); this.tip(f.hint, 7); this.sfx("a:twinkle", { gain: 0.5 }); }, false);
      if (f.id === "wind") this.wind.next = this.t + 3.5;
    } else if (this.allUnlocked()) {
      this.theme = this.themeBag.next(this.rng);
      const th = this.theme;
      this.after(1.6, () => { this.banner(th.title, th.sub, th.tone); this.react("wow", th.line); this.sfx("a:twinkle", { gain: 0.5 }); }, false);
    }
  }

  private tip(text: string, sec: number) { this.hint(text); this.tipUntil = this.t + sec; }

  // ------------------------------------------------------------ simulation
  protected update(dt: number) {
    this.phaseT += dt;
    const over = this.hud.status === "over" || this.lives <= 0;
    if (over && this.phase !== "over") { this.phase = "over"; this.timerBar(null); }
    if (this.phase === "ready" && this.phaseT > 1.4 && !this.inTransition) { this.phase = "play"; this.spawnT = 0.2; this.sfx("a:go", { gain: 0.5 }); }
    if (this.tipUntil && this.t > this.tipUntil) { this.tipUntil = 0; this.hint(null); }
    // Bonbon follows the finger
    const px = this.bon.x;
    this.bon.x += (this.bon.tx - this.bon.x) * Math.min(1, dt * 14);
    this.bon.vx = lerp(this.bon.vx, (this.bon.x - px) / Math.max(dt, 1e-3), Math.min(1, dt * 10));
    this.bon.sq = Math.max(0, this.bon.sq - dt * 4);
    this.bon.red = Math.max(0, this.bon.red - dt * 0.45);
    this.bon.hop = Math.max(0, this.bon.hop - dt * 1.6);
    if (this.bon.red > 0.3 && Math.random() < dt * 8) this.particles.push({ x: this.bon.x + (Math.random() - 0.5) * this.bh * 0.35, y: this.floorY - this.bh * 0.92, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, life: 0.9, max: 0.9, size: 6 + Math.random() * 6, color: "#fff", kind: "bubble", rot: 0, vr: 0, g: -20 });
    // wind gusts
    if (this.windy() && this.phase === "play") {
      const always = this.theme?.id === "windy";
      if (this.t >= this.wind.next && !this.wind.tgt) {
        const dir = this.rng.chance(0.5) ? 1 : -1;
        this.wind.tgt = dir * this.rng.range(0.6, 1) * (this.diff === "easy" ? 0.75 : 1);
        this.wind.until = this.t + (always ? this.rng.range(5, 8) : this.rng.range(2.5, 4));
        this.sfx("whooshLong", { gain: 0.45 }); this.sfx("a:whistle", { gain: 0.3, delay: 0.2 });
      } else if (this.wind.tgt && this.t >= this.wind.until) {
        this.wind.tgt = 0; this.wind.next = this.t + (always ? 0.6 : this.rng.range(5, 9));
      }
    } else this.wind.tgt = 0;
    this.wind.v = lerp(this.wind.v, this.wind.tgt, Math.min(1, dt * 2));
    // spawning
    if (this.phase === "play" && !this.inTransition) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawn(); this.spawnT = this.interval() * this.rng.range(0.85, 1.2); }
    }
    // items
    const fx = this.field.x, fw = this.field.w;
    for (const it of this.items) {
      if (it.state === "in") continue;
      const prevY = it.y;
      it.vx = lerp(it.vx, this.wind.v * fw * 0.24, Math.min(1, dt * 3));
      it.y += it.vy * dt * (this.phase === "over" ? 0.3 : 1);
      it.x += it.vx * dt;
      if (it.sway) it.x += Math.cos(this.t * 3.2 + it.ph) * it.sway * fw * 0.12 * dt * 3.2;
      if (it.x < fx + it.r) { it.x = fx + it.r; it.vx = Math.abs(it.vx) * 0.3; }
      if (it.x > fx + fw - it.r) { it.x = fx + fw - it.r; it.vx = -Math.abs(it.vx) * 0.3; }
      it.rot += it.vr * dt * (it.kind === "chilli" ? 1.6 : 1);
      if (it.state === "fall" && prevY < this.rimY - it.r * 0.3 && it.y >= this.rimY - it.r * 0.3) {
        if (this.phase === "play" && Math.abs(it.x - this.bon.x) < this.bw / 2 + it.r * 0.3) this.catchItem(it);
        else it.state = "out";
      }
      if (it.state === "out" && it.y >= this.floorY) { it.state = "in"; it.u = 2; this.miss(it); }
    }
    this.items = this.items.filter((it) => !(it.state === "in" && it.u >= 1));
    this.splats = this.splats.filter((s) => this.t - s.t0 < 2.6);
    this.peeks = this.peeks.filter((p) => this.t - p.t0 < 1.1);
    for (const s of this.streaks) { s.x += dt * s.v * Math.sign(this.wind.v || 1) * 1.4; if (s.x > 1.1) s.x -= 1.2; if (s.x < -0.1) s.x += 1.2; }
    if (this.phase === "play") {
      const prog = Math.round(((this.catches % 15) / 15) * 30) / 30;
      if (prog !== this.progress) { this.progress = prog; this.timerBar(prog, "#FF9CC2"); }
    }
  }

  // ------------------------------------------------------------ drawing: kitchen
  private paintStatic() {
    const W = this.W, H = this.H;
    const c = document.createElement("canvas");
    c.width = Math.round(W * this.dpr); c.height = Math.round(H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#FFE3D3"); wall.addColorStop(1, "#FFD2BE");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.45)";
    for (let y = 20, r = 0; y < H * 0.62; y += 34, r++) for (let x = (r % 2) * 17 + 8; x < W; x += 34) { g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); }
    // mint tiles on the lower wall
    const ty = H * 0.62;
    g.fillStyle = "#BFEAD8"; g.fillRect(0, ty, W, H - ty);
    g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 2;
    for (let y = ty; y < H; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let y = ty, r = 0; y < H; y += 26, r++) for (let x = (r % 2) * 20; x < W; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 26); g.stroke(); }
    rr(g, -10, ty - 10, W + 20, 16, 8); g.fillStyle = "#FFFFFF"; g.fill();
    g.fillStyle = "rgba(201,138,75,0.25)"; g.fillRect(0, ty + 5, W, 3);
    // window with curtains
    const ww = clamp(W * 0.36, 130, 300), wh = clamp(H * 0.17, 100, 190), wx = clamp(W * 0.07, 14, 120), wy = H * 0.24;
    rr(g, wx - 8, wy - 8, ww + 16, wh + 16, 20); g.fillStyle = "#FFFFFF"; g.fill();
    rr(g, wx, wy, ww, wh, 14);
    const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, "#8FD3FF"); sky.addColorStop(1, "#E3F6FF");
    g.fillStyle = sky; g.fill();
    g.save(); rr(g, wx, wy, ww, wh, 14); g.clip();
    blob(g, wx + ww * 0.3, wy + wh * 0.35, ww * 0.16, wh * 0.09, "#FFFFFF"); blob(g, wx + ww * 0.72, wy + wh * 0.55, ww * 0.12, wh * 0.07, "#FFFFFF");
    blob(g, wx + ww * 0.5, wy + wh * 1.05, ww * 0.7, wh * 0.3, "#8FD06A", { gloss: 0.2 });
    g.restore();
    g.fillStyle = "#FFFFFF"; g.fillRect(wx + ww / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh / 2 - 3, ww, 6);
    for (const s of [-1, 1]) {
      const cx = s < 0 ? wx - 10 : wx + ww + 10;
      g.beginPath(); g.moveTo(cx - s * 2, wy - 12); g.quadraticCurveTo(cx + s * ww * 0.22, wy + wh * 0.4, cx - s * 4, wy + wh + 12); g.lineTo(cx - s * 26, wy + wh + 12); g.quadraticCurveTo(cx - s * 14, wy + wh * 0.4, cx - s * 26, wy - 12); g.closePath();
      clayFill(g, "#FF8FB1", cx - s * 12, wy + wh / 2, wh * 0.6, { gloss: 0.25 });
    }
    rr(g, wx - 30, wy - 18, ww + 60, 10, 5); g.fillStyle = "#C98A4B"; g.fill();
    // shelf with jars
    const sx0 = Math.max(wx + ww + 40, W * 0.56), sx1 = W - 14, sy = H * 0.34;
    if (sx1 - sx0 > 90) {
      const jars = [["#FFF6EA", "FLOUR"], ["#FFC9DD", "SUGAR"], ["#FFE38A", ""], ["#CDEBFF", ""]] as const;
      const n = Math.min(4, Math.floor((sx1 - sx0) / 58));
      for (let i = 0; i < n; i++) {
        const jx = sx0 + 26 + i * ((sx1 - sx0 - 52) / Math.max(1, n - 1)), jh = 52 + (i % 2) * 12;
        shadow(g, jx, sy, 26, 5, 0.2);
        rr(g, jx - 22, sy - jh, 44, jh, 12); clayFill(g, jars[i][0], jx, sy - jh / 2, jh * 0.6, { gloss: 0.5 });
        rr(g, jx - 18, sy - jh - 10, 36, 12, 5); clayFill(g, "#FF6F91", jx, sy - jh - 4, 20);
        if (jars[i][1]) clayText(g, jars[i][1], jx, sy - jh * 0.45, 10, { fill: "#C98A4B", stroke: "#FFFFFF", gloss: false });
        else for (let k = 0; k < 6; k++) { g.fillStyle = ["#FF6F91", "#7CC8FF", "#74C94E", "#9B5DE5"][k % 4]; g.fillRect(jx - 14 + (k * 23) % 28, sy - jh * 0.3 - (k * 11) % 26, 6, 3); }
      }
      rr(g, sx0 - 6, sy, sx1 - sx0 + 12, 12, 5); g.fillStyle = "#C98A4B"; g.fill();
      g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(sx0, sy + 10, sx1 - sx0, 3);
    }
    // hanging pans & spoon
    const hy = H * 0.47;
    for (let i = 0; i < 3; i++) {
      const hx = W * (0.62 + i * 0.13);
      if (hx > W - 20) break;
      g.strokeStyle = "rgba(90,52,32,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy - 30); g.lineTo(hx, hy); g.stroke();
      if (i === 1) { rr(g, hx - 4, hy, 8, 46, 4); clayFill(g, "#C98A4B", hx, hy + 23, 20); blob(g, hx, hy + 54, 13, 17, "#E3A563"); }
      else { rr(g, hx - 3, hy, 6, 22, 3); g.fillStyle = "#7A4B2C"; g.fill(); blob(g, hx, hy + 42, 24, 22, "#E8964E", { gloss: 0.55 }); blob(g, hx, hy + 42, 15, 13, "#C46F2D", { gloss: 0.2 }); }
    }
    this.bg = c;
  }

  private drawFloor(g: G) {
    const y0 = this.floorY, W = this.W, H = this.H;
    g.fillStyle = "#FFFFFF"; g.fillRect(0, y0, W, H - y0);
    const sz = clamp((H - y0) / 2, 22, 40);
    g.fillStyle = "#FFB3C9";
    for (let r = 0, y = y0; y < H; r++, y += sz) for (let x = (r % 2) * sz; x < W; x += sz * 2) g.fillRect(x, y, sz, sz);
    const gr = g.createLinearGradient(0, y0, 0, y0 + 16); gr.addColorStop(0, "rgba(120,60,80,0.25)"); gr.addColorStop(1, "rgba(120,60,80,0)");
    g.fillStyle = gr; g.fillRect(0, y0, W, 16);
    for (const s of this.splats) {
      const a = 1 - clamp((this.t - s.t0 - 1.8) / 0.8, 0, 1);
      g.save(); g.globalAlpha = a;
      blob(g, s.x, s.y, s.r * 1.3, s.r * 0.38, s.c, { gloss: 0.3, wobble: 0.12, t: s.x });
      for (let i = 0; i < 4; i++) blob(g, s.x + Math.cos(i * 1.7 + s.x) * s.r * 1.6, s.y + Math.sin(i * 2.3) * s.r * 0.3, s.r * 0.18, s.r * 0.1, s.c);
      g.restore();
    }
  }

  // ------------------------------------------------------------ drawing: food
  private drawBit(g: G, k: IKind | Layer, r: number, sneaky = false) {
    switch (k) {
      case "sponge": {
        rr(g, -r * 0.85, -r * 0.7, r * 1.7, r * 1.4, r * 0.32); clayFill(g, "#FFD36B", 0, 0, r, { gloss: 0.3 });
        g.save(); rr(g, -r * 0.85, -r * 0.7, r * 1.7, r * 1.4, r * 0.32); g.clip();
        g.fillStyle = "#FFF6EA"; g.fillRect(-r, -r * 0.75, r * 2, r * 0.42);
        for (const dx of [-0.5, 0.05, 0.55]) { g.beginPath(); g.arc(dx * r, -r * 0.33, r * 0.16, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#FF8FB1"; g.fillRect(-r, r * 0.12, r * 2, r * 0.14);
        g.restore();
        this.face(g, 0, r * 0.32, r * 0.5);
        break;
      }
      case "cherry":
        g.strokeStyle = "#4F8F33"; g.lineWidth = Math.max(2, r * 0.12); g.lineCap = "round";
        g.beginPath(); g.moveTo(0, -r * 0.4); g.quadraticCurveTo(r * 0.1, -r * 1.0, r * 0.45, -r * 1.1); g.stroke();
        blob(g, r * 0.32, -r * 0.98, r * 0.22, r * 0.1, "#5DB04A", { rot: -0.4 });
        blob(g, 0, r * 0.1, r * 0.72, r * 0.68, "#E8283A", { gloss: 0.65 });
        this.face(g, 0, r * 0.18, r * 0.42);
        break;
      case "cream":
        blob(g, 0, r * 0.45, r * 0.85, r * 0.38, "#FFF6EA", { gloss: 0.4 });
        blob(g, 0, r * 0.02, r * 0.66, r * 0.34, "#FFFBF4", { gloss: 0.4 });
        blob(g, 0, -r * 0.36, r * 0.44, r * 0.28, "#FFFFFF", { gloss: 0.4 });
        g.beginPath(); g.moveTo(-r * 0.2, -r * 0.55); g.quadraticCurveTo(0, -r * 1.05, r * 0.18, -r * 0.62); g.closePath(); clayFill(g, "#FFFFFF", 0, -r * 0.7, r * 0.3);
        this.face(g, 0, r * 0.1, r * 0.45);
        break;
      case "sprinkle": {
        blob(g, 0, 0, r * 0.88, r * 0.72, "#FF9CC2", { gloss: 0.45, wobble: 0.06, t: r });
        const cols = ["#FFFFFF", "#7CC8FF", "#FFD25A", "#74C94E", "#9B5DE5"];
        for (let i = 0; i < 10; i++) { g.save(); g.translate(Math.cos(i * 2.4) * r * 0.5, Math.sin(i * 1.9) * r * 0.4); g.rotate(i * 1.3); g.fillStyle = cols[i % 5]; rr(g, -r * 0.14, -r * 0.045, r * 0.28, r * 0.09, r * 0.045); g.fill(); g.restore(); }
        break;
      }
      case "berry":
        g.beginPath(); g.moveTo(0, r * 0.95); g.bezierCurveTo(-r * 1.0, r * 0.3, -r * 0.85, -r * 0.65, 0, -r * 0.55); g.bezierCurveTo(r * 0.85, -r * 0.65, r * 1.0, r * 0.3, 0, r * 0.95);
        clayFill(g, "#FF4F6A", 0, 0, r * 0.9, { gloss: 0.5 });
        g.fillStyle = "#FFE38A"; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(Math.cos(i * 2.1) * r * 0.42, r * 0.15 + Math.sin(i * 1.7) * r * 0.32, r * 0.04, r * 0.07, 0, 0, Math.PI * 2); g.fill(); }
        for (const a of [-0.8, -0.25, 0.3, 0.85]) blob(g, Math.sin(a) * r * 0.35, -r * 0.62, r * 0.12, r * 0.26, "#4FAF5A", { rot: a });
        this.face(g, 0, r * 0.05, r * 0.4);
        break;
      case "gold": {
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.6); gl.addColorStop(0, "rgba(255,225,110,0.6)"); gl.addColorStop(1, "rgba(255,225,110,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 1.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(-r * 0.95, r * 0.6); g.lineTo(r * 0.95, r * 0.6); g.lineTo(r * 0.95, -r * 0.15); g.lineTo(-r * 0.95, -r * 0.75); g.closePath();
        clayFill(g, "#FFD25A", 0, 0, r, { gloss: 0.6 });
        g.fillStyle = "#FFF4C2"; g.fillRect(-r * 0.95, r * 0.05, r * 1.9, r * 0.14);
        blob(g, r * 0.35, -r * 0.45, r * 0.22, r * 0.2, "#FFB000", { gloss: 0.7 });
        star(g, -r * 0.55, -r * 0.85, r * 0.22 * (1 + 0.3 * Math.sin(this.t * 8)), "#FFFFFF", this.t * 2);
        break;
      }
      case "heart": {
        const s = r * 0.95;
        g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 1.5, -s * 0.1, -s * 0.75, -s * 1.25, 0, -s * 0.45); g.bezierCurveTo(s * 0.75, -s * 1.25, s * 1.5, -s * 0.1, 0, s * 0.9);
        clayFill(g, "#FF6F91", 0, 0, s * 1.1, { gloss: 0.55 });
        break;
      }
      case "chilli": {
        const c = sneaky ? "#DA2A3C" : "#FF3B2F";
        g.beginPath();
        g.moveTo(-r * 0.42, -r * 0.62);
        g.bezierCurveTo(-r * 0.62, r * 0.1, -r * 0.2, r * 0.75, r * 0.5, r * 1.05);
        g.bezierCurveTo(r * 0.2, r * 0.5, r * 0.5, -r * 0.1, r * 0.38, -r * 0.62);
        g.quadraticCurveTo(0, -r * 0.8, -r * 0.42, -r * 0.62);
        clayFill(g, c, 0, 0, r * 0.9, { gloss: 0.55 });
        blob(g, -r * 0.02, -r * 0.72, r * 0.42, r * 0.16, "#3E9B3A", { gloss: 0.3 });
        g.strokeStyle = "#3E9B3A"; g.lineWidth = Math.max(2, r * 0.12); g.lineCap = "round";
        g.beginPath(); g.moveTo(0, -r * 0.8); g.quadraticCurveTo(r * 0.05, -r * 1.1, -r * 0.2, -r * 1.2); g.stroke();
        if (!sneaky) {
          eye(g, -r * 0.18, -r * 0.18, r * 0.15, { look: [0.3, 0.4] }); eye(g, r * 0.16, -r * 0.18, r * 0.15, { look: [-0.3, 0.4] });
          g.strokeStyle = "#5A1E2B"; g.lineWidth = Math.max(1.5, r * 0.08);
          g.beginPath(); g.moveTo(-r * 0.34, -r * 0.42); g.lineTo(-r * 0.06, -r * 0.3); g.moveTo(r * 0.32, -r * 0.42); g.lineTo(r * 0.04, -r * 0.3); g.stroke();
          mouth(g, 0, r * 0.14, r * 0.26, "tooth");
        }
        break;
      }
      default: break;
    }
  }

  private face(g: G, x: number, y: number, w: number) {
    if (w < 8) return;
    eye(g, x - w * 0.42, y - w * 0.18, w * 0.2, { pupil: 0.6 }); eye(g, x + w * 0.42, y - w * 0.18, w * 0.2, { pupil: 0.6 });
    mouth(g, x, y + w * 0.2, w * 0.4, "smile");
  }

  private drawItem(g: G, it: Item) {
    let x = it.x, y = it.y, sc = 0.4 + it.pop * 0.6, alpha = 1;
    if (it.state === "in" && it.u <= 1) {
      x = lerp(it.fx, this.bon.x, it.u); y = lerp(it.fy, this.rimY + 4, it.u);
      sc *= 1 - it.u * 0.4; alpha = 1 - it.u * 0.6;
    }
    g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(it.rot); g.scale(sc, sc);
    if (it.kind === "chilli" && !it.sneaky && it.state === "fall") {
      for (let i = 0; i < 3; i++) {
        const ph = (this.t * 2 + i / 3 + it.ph) % 1;
        g.strokeStyle = `rgba(255,140,60,${0.5 * (1 - ph)})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo((i - 1) * it.r * 0.35, -it.r * (1.25 + ph * 0.6)); g.quadraticCurveTo((i - 1) * it.r * 0.35 + 4, -it.r * (1.45 + ph * 0.6), (i - 1) * it.r * 0.35, -it.r * (1.65 + ph * 0.6)); g.stroke();
      }
    }
    this.drawBit(g, it.kind, it.r, it.sneaky);
    g.restore();
  }

  // ------------------------------------------------------------ drawing: Bonbon + bowl
  private redCanvas(url: string) {
    const hit = this.red.get(url);
    if (hit) return hit;
    const im = this.img(url);
    if (!im?.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d")!;
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = "source-atop";
    const gr = x.createLinearGradient(0, 0, 0, c.height);
    gr.addColorStop(0, "rgba(255,30,20,0.75)"); gr.addColorStop(0.55, "rgba(255,40,30,0.55)"); gr.addColorStop(1, "rgba(255,40,30,0.1)");
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    this.red.set(url, c);
    return c;
  }

  private bowlPath(g: G, x: number, y: number, w: number) {
    g.beginPath(); g.ellipse(x, y, w / 2, w * 0.36, 0, 0, Math.PI); g.closePath();
  }

  private drawBonbon(g: G, mood: Mood) {
    const b = this.bon, h = this.bh, x = b.x, fy = this.floorY;
    const lean = clamp(b.vx * 0.00035, -0.16, 0.16);
    const hop = Math.sin(b.hop * Math.PI * 3) * h * 0.06 * b.hop;
    const jit = b.red > 0.5 ? (Math.random() - 0.5) * 4 : 0;
    const sq = b.sq;
    shadow(g, x, fy + 4, h * 0.42, h * 0.07, 0.3);
    const url = this.host(b.red > 0.4 ? "sad" : mood);
    g.save(); g.translate(x + jit, fy + 6 - Math.abs(hop)); g.rotate(lean); g.scale(1 + sq * 0.05, 1 - sq * 0.05 + Math.sin(this.t * 2.6) * 0.012);
    const im = this.img(url);
    if (im?.naturalWidth) {
      const w = (h * im.naturalWidth) / im.naturalHeight;
      g.drawImage(im, -w / 2, -h, w, h);
      if (b.red > 0.02) { const rc = this.redCanvas(url); if (rc) { g.globalAlpha = Math.min(1, b.red * 1.3); g.drawImage(rc, -w / 2, -h, w, h); g.globalAlpha = 1; } }
    } else {
      blob(g, 0, -h * 0.42, h * 0.38, h * 0.42, b.red > 0.3 ? "#FF6F6F" : "#FFB3CC");
      eye(g, -h * 0.1, -h * 0.6, h * 0.06); eye(g, h * 0.1, -h * 0.6, h * 0.06);
    }
    g.restore();
    // glass mixing bowl held in front
    const bw = this.bw, by = this.rimY, bx = x + jit + lean * h * 0.3 - Math.abs(hop) * 0;
    const byy = by - Math.abs(hop) - sq * 3;
    g.save();
    shadow(g, bx, fy + 2, bw * 0.4, 6, 0.12);
    // inside back of the bowl
    g.beginPath(); g.ellipse(bx, byy, bw / 2, bw * 0.11, 0, 0, Math.PI * 2); g.fillStyle = "rgba(170,215,240,0.35)"; g.fill();
    // contents (stacked layers)
    const n = this.stack.length;
    if (n) {
      g.save(); this.bowlPath(g, bx, byy, bw - 6); g.rect(bx - bw / 2, byy - bw * 0.11, bw, bw * 0.11); g.clip();
      const depth = bw * 0.36 + bw * 0.08, lh = depth / STACK, bottom = byy + bw * 0.36 - 3;
      this.stack.forEach((l, i) => {
        const yb = bottom - i * lh, c = LAYER[l.k];
        g.fillStyle = c; g.fillRect(bx - bw / 2, yb - lh - 1 - l.pop * 6, bw, lh + 1.5);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(bx - bw / 2, yb - lh - 1 - l.pop * 6, bw, Math.max(1.5, lh * 0.22));
        if (l.k === "sprinkle" || l.k === "gold") for (let k = 0; k < 7; k++) { g.fillStyle = ["#FFFFFF", "#7CC8FF", "#9B5DE5", "#74C94E"][k % 4]; g.fillRect(bx - bw * 0.4 + k * bw * 0.12, yb - lh * 0.6, 4, 2); }
      });
      // surface of the top layer
      const top = this.stack[n - 1], yt = bottom - n * lh;
      const k = clamp((yt - byy) / (bw * 0.36), 0, 1), hw = (bw / 2 - 3) * Math.sqrt(1 - k * k);
      g.beginPath(); g.ellipse(bx, yt - top.pop * 6, Math.max(4, hw), Math.max(2, hw * 0.2), 0, 0, Math.PI * 2); g.fillStyle = lighten(LAYER[top.k], 0.25); g.fill();
      g.restore();
    }
    // glass front
    this.bowlPath(g, bx, byy, bw);
    const gl = g.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
    gl.addColorStop(0, "rgba(200,235,255,0.55)"); gl.addColorStop(0.5, "rgba(220,245,255,0.2)"); gl.addColorStop(1, "rgba(170,215,240,0.5)");
    g.fillStyle = gl; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = Math.max(3, bw * 0.035); g.lineCap = "round";
    g.beginPath(); g.ellipse(bx, byy, bw / 2 - bw * 0.1, bw * 0.26, 0, Math.PI * 0.62, Math.PI * 0.85); g.stroke();
    // rim
    g.beginPath(); g.ellipse(bx, byy, bw / 2, bw * 0.11, 0, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 4; g.stroke();
    g.strokeStyle = "rgba(120,170,210,0.6)"; g.lineWidth = 1.5; g.stroke();
    // little stack meter dots under the bowl
    for (let i = 0; i < STACK; i++) {
      const dx = bx + (i - (STACK - 1) / 2) * 11, dy = byy + bw * 0.36 + 12;
      g.fillStyle = i < n ? LAYER[this.stack[i].k] : "rgba(255,255,255,0.55)";
      g.beginPath(); g.arc(dx, dy, 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(90,40,60,0.35)"; g.lineWidth = 1; g.stroke();
    }
    g.restore();
  }

  private drawFlyCake(g: G) {
    const f = this.flyCake;
    if (!f) return;
    const tx = this.W - 64, ty = this.area.y + 24;
    const u = f.u, x = lerp(f.x, tx, u), y = lerp(f.y, ty, u) - Math.sin(u * Math.PI) * 120, s = 1.15 - u * 0.75;
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(Math.sin(u * Math.PI * 2) * 0.15);
    this.drawCake(g, f.layers, 0, 0, this.bw * 0.9);
    g.restore();
  }

  private drawCake(g: G, layers: Layer[], cx: number, y: number, w: number) {
    const lh = Math.max(4, w * 0.11);
    blob(g, cx, y + 3, w * 0.62, w * 0.08, "#EAF6FF", { gloss: 0.5 });
    layers.forEach((k, i) => {
      const lw = w * (1 - i * 0.03), yy = y - i * lh;
      rr(g, cx - lw / 2, yy - lh, lw, lh + 1, lh * 0.4); clayFill(g, LAYER[k], cx, yy - lh / 2, lw * 0.5, { gloss: 0.25, rim: false });
    });
    const top = y - layers.length * lh, tw = w * (1 - layers.length * 0.03);
    rr(g, cx - tw / 2, top - lh * 0.5, tw, lh * 0.7, lh * 0.35); clayFill(g, "#FFFFFF", cx, top, tw * 0.5, { gloss: 0.3 });
    blob(g, cx, top - lh * 0.9, lh * 0.55, lh * 0.55, "#E8283A", { gloss: 0.6 });
    rr(g, cx - w * 0.2 - 2, top - lh * 2.2, 4, lh * 1.5, 2); g.fillStyle = "#7CC8FF"; g.fill();
    blob(g, cx - w * 0.2, top - lh * 2.5, 3.5, 6 * (1 + Math.sin(this.t * 18) * 0.15), "#FFB000", { gloss: 0.7 });
  }

  private drawPeeks(g: G) {
    for (const p of this.peeks) {
      const u = (this.t - p.t0) / 1.1, k = u < 0.25 ? ease.out(u / 0.25) : u > 0.7 ? 1 - ease.in((u - 0.7) / 0.3) : 1;
      const url = spriteUrl("kranky", u > 0.3 ? "sad" : "happy");
      const h = clamp(this.ir * 3.2, 60, 100);
      g.save(); g.beginPath(); g.rect(0, this.topY - 12, this.W, this.H); g.clip();
      this.sprite(g, url, p.x, this.topY - 14 + h * 0.75 * k, h, { rot: Math.sin(this.t * 12) * 0.05 });
      g.restore();
    }
  }

  private drawWind(g: G) {
    const v = this.wind.v;
    if (Math.abs(v) < 0.05) return;
    const A = this.area;
    g.save(); g.lineCap = "round";
    for (const s of this.streaks) {
      const x = s.x * this.W, y = A.y + 40 + s.y * (this.rimY - A.y - 60), len = 40 + 50 * Math.abs(v);
      g.strokeStyle = `rgba(46,170,190,${0.45 * Math.abs(v)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - Math.sign(v) * len * 0.5, y - 6, x - Math.sign(v) * len, y); g.stroke();
    }
    // wind arrow badge
    const bx = this.W / 2, by = A.y + 26;
    rr(g, bx - 46, by - 16, 92, 32, 16); g.fillStyle = "rgba(46,196,182,0.88)"; g.fill();
    g.save(); g.translate(bx, by); g.scale(Math.sign(v), 1);
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(26, 0); g.lineTo(8, -11); g.lineTo(8, -4); g.lineTo(-26, -4); g.lineTo(-26, 4); g.lineTo(8, 4); g.lineTo(8, 11); g.closePath(); g.fill();
    g.restore();
    g.restore();
  }

  private drawUi(g: G) {
    const A = this.area;
    // consecutive-miss meter
    const lim = this.missLimit(), w = 26 + lim * 20;
    rr(g, 10, A.y + 8, w, 30, 15); g.fillStyle = "rgba(35,48,90,0.72)"; g.fill();
    clayText(g, "✋", 24, A.y + 23, 14, { fill: "#FFFFFF", gloss: false });
    for (let i = 0; i < lim; i++) {
      const x = 44 + i * 20, y = A.y + 23, on = i < this.misses;
      g.fillStyle = on ? "#FF6F91" : "rgba(255,255,255,0.25)"; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      if (on) { g.strokeStyle = "#FFFFFF"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke(); }
    }
    // cakes baked
    const cx = this.W - 10 - 76;
    rr(g, cx, A.y + 8, 76, 30, 15); g.fillStyle = "rgba(35,48,90,0.72)"; g.fill();
    this.drawCake(g, ["sponge", "berry"], cx + 20, A.y + 30, 22);
    clayText(g, `×${this.cakes}`, cx + 52, A.y + 23, 17, { fill: "#FFFFFF", gloss: false });
  }

  private scene(g: G, live: boolean) {
    if (!this.bg) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawFloor(g);
    if (this.field.w < this.W - 40) {
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(this.field.x - 3, this.area.y, 3, this.floorY - this.area.y); g.fillRect(this.field.x + this.field.w, this.area.y, 3, this.floorY - this.area.y);
    }
    this.drawPeeks(g);
    // landing guide shadows on the floor
    for (const it of this.items) if (it.state === "fall") {
      const k = clamp((it.y - this.topY) / (this.rimY - this.topY), 0, 1);
      g.fillStyle = it.kind === "chilli" ? `rgba(200,30,30,${0.12 + k * 0.2})` : `rgba(60,30,60,${0.08 + k * 0.16})`;
      g.beginPath(); g.ellipse(it.x, this.floorY + 10, it.r * (0.5 + k * 0.5), it.r * 0.18, 0, 0, Math.PI * 2); g.fill();
    }
    for (const it of this.items) if (it.state === "out") this.drawItem(g, it);
    this.drawBonbon(g, live ? this.hud.host.mood : "happy");
    for (const it of this.items) if (it.state !== "out") this.drawItem(g, it);
    this.drawWind(g);
    this.drawFlyCake(g);
    if (live) this.drawUi(g);
  }

  protected drawBackground(g: G) {
    this.layout();
    if (!this.demo) {
      this.demo = true; this.splats = []; this.flyCake = null; this.peeks = []; this.bon.red = 0; this.bon.hop = 0; this.bon.sq = 0;
      const k: IKind[] = ["sponge", "cherry", "cream", "chilli", "berry", "sprinkle"];
      this.items = k.map((kind, i) => ({ kind, x: this.field.x + this.field.w * (0.12 + i * 0.15), y: 0, vy: 0, vx: 0, rot: 0, vr: 0, r: this.ir, ph: i, sway: 0, sneaky: false, state: "fall" as const, u: 0, fx: 0, fy: 0, pop: 1 }));
      this.stack = (["sponge", "berry", "cream", "sponge"] as Layer[]).map((k2) => ({ k: k2, pop: 0 }));
    }
    const span = this.rimY - this.area.y;
    this.items.forEach((it, i) => { it.y = this.area.y + 30 + ((this.t * 60 + i * span * 0.37) % (span * 0.8)); it.rot = Math.sin(this.t + i) * 0.4; });
    this.bon.x = this.bon.tx = this.W / 2 + Math.sin(this.t * 0.8) * Math.min(this.field.w * 0.25, 120);
    this.bon.vx = Math.cos(this.t * 0.8) * 60;
    this.scene(g, false);
  }

  protected draw(g: G) { this.scene(g, true); }
}
