// Turbo Dash — Turbo the rocket snail races down an endless 3-lane road, seen from behind.
// Swipe, tap a side or use ← → to switch lanes: dodge cones, puddles, rocks, barriers, rivers and Kranky,
// munch leaves for points and grab rocket boosts. Speed ramps forever (gently at first), every level is a
// new stretch of road, new obstacle types unlock over time and themed "twist" levels keep coming after that.
import { ArcadeGame, Bag, byDiff, clamp, ease, lerp, ramp, spriteUrl, type GameMeta, type Mood, type Rng, type Tone } from "../engine";
import { blob, cheeks, clayFill, clayText, darken, eye, lighten, mix, mouth, rgba, rr, shadow, star, sunburst, type G } from "../paint";

type Kind = "cone" | "puddle" | "rock" | "kranky" | "crab" | "barrier" | "river" | "leaf" | "gold" | "boost" | "heart";
type Feature = "two" | "kranky" | "crab" | "barrier" | "river" | "slalom";
type RowType = "one" | "two" | "crab" | "barrier" | "river" | "slalom";
interface Obj { kind: Kind; at: number; lane: number; to: number; x: number; done: boolean; fly: number; vx: number; ph: number; hitT: number; spd: number; cue: boolean }
interface Prop { kind: string; at: number; side: number; off: number; ph: number; sc: number; c: string; text?: string }
interface Biome { name: string; sky: [string, string]; ground: [string, string]; road: [string, string]; edge: [string, string]; hill: string; leaf: string; props: string[]; night?: boolean }
interface Theme { id: string; title: string; sub: string; tone: Tone; line: string }

const D = 8, SPAWN = 62, LEVEL_M = 300, READY = 2.3, SEG = 4;
const BODY = "#A8DB5C", SHELL = "#FF9A3C", METAL = "#4F6FE8";

const BIOMES: Biome[] = [
  { name: "Clover Meadow", sky: ["#6EC3FF", "#DDF3FF"], ground: ["#7CCB5B", "#6DBB4D"], road: ["#8B80A8", "#8077A0"], edge: ["#FF6F91", "#FFFFFF"], hill: "#5DB063", leaf: "#4FAF4A", props: ["tree", "flower", "mushroom", "bush", "sunflower"] },
  { name: "Sunny Beach", sky: ["#5FD0F0", "#FFF2C9"], ground: ["#F6D88E", "#EECB76"], road: ["#9C8CA8", "#93839F"], edge: ["#2EC4B6", "#FFFFFF"], hill: "#4FB6E0", leaf: "#3FAE5A", props: ["palm", "umbrella", "palm", "bush"] },
  { name: "Candy Lane", sky: ["#FF9FCF", "#FFE6F3"], ground: ["#A8EBC4", "#96DEB4"], road: ["#A07BBE", "#9672B4"], edge: ["#FF6F91", "#FFF1F6"], hill: "#FFB3D6", leaf: "#FF8FC2", props: ["lolly", "gumdrop", "cane", "lolly", "mushroom"] },
  { name: "Sunset Hills", sky: ["#FF8A5C", "#FFD89B"], ground: ["#93C94F", "#84BB43"], road: ["#8C6F8E", "#836686"], edge: ["#FFD25A", "#FFFFFF"], hill: "#C98BB0", leaf: "#5DA845", props: ["sunflower", "tree", "flower", "bush"] },
  { name: "Starry Night", sky: ["#191543", "#4A3D8C"], ground: ["#2F6B4F", "#295F46"], road: ["#4A4470", "#433E68"], edge: ["#7CF2C9", "#2A2550"], hill: "#2B2A63", leaf: "#2E7D5B", props: ["lamp", "mushroom", "pine", "bush"], night: true },
  { name: "Autumn Woods", sky: ["#8FCBFF", "#FFE7C2"], ground: ["#E3A548", "#D6973C"], road: ["#8A7590", "#806B87"], edge: ["#E8504F", "#FFF4E2"], hill: "#C9773A", leaf: "#F07C2A", props: ["tree", "pumpkin", "mushroom", "bush"] },
  { name: "Snowy Peaks", sky: ["#8FD0FF", "#F0FAFF"], ground: ["#F3F8FF", "#E2ECF8"], road: ["#7D86AE", "#747DA5"], edge: ["#3B82F6", "#FFFFFF"], hill: "#BFD7F2", leaf: "#2F8A5B", props: ["pine", "snowman", "pine", "bush"] },
];
const UNLOCK: Record<Feature, { easy: number; medium: number; hard: number }> = {
  two: { easy: 2, medium: 1, hard: 1 },
  kranky: { easy: 3, medium: 2, hard: 1 },
  crab: { easy: 5, medium: 3, hard: 2 },
  barrier: { easy: 7, medium: 4, hard: 3 },
  river: { easy: 9, medium: 6, hard: 4 },
  slalom: { easy: 11, medium: 8, hard: 5 },
};
const FEATURES: { id: Feature; title: string; sub: string; tone: Tone; hint: string; line: string }[] = [
  { id: "two", title: "DOUBLE TROUBLE!", sub: "Two lanes blocked — find the free one", tone: "gold", hint: "Find the free lane! 👀", line: "Two at once?!" },
  { id: "kranky", title: "KRANKY!", sub: "Don't bump the grumpy crab", tone: "red", hint: "Kranky's on the road — steer around him! 🦀", line: "Uh-oh, Kranky!" },
  { id: "crab", title: "SIDESTEP!", sub: "Kranky walks sideways — see where he stops", tone: "pink", hint: "Watch which lane Kranky walks to 👀", line: "He walks sideways!" },
  { id: "barrier", title: "ROADBLOCK!", sub: "Two lanes closed — use the open one", tone: "red", hint: "Find the open lane! 🚧", line: "Roadworks?!" },
  { id: "river", title: "BRIDGE!", sub: "Only one lane has a bridge", tone: "mint", hint: "Drive onto the bridge! 🌉", line: "I can't swim!" },
  { id: "slalom", title: "SLALOM!", sub: "Zig-zag through the cones", tone: "gold", hint: "Zig… zag… zig! 🔀", line: "Wiggle wiggle!" },
];
const THEMES: Theme[] = [
  { id: "cones", title: "CONE ZONE!", sub: "Cones, cones, cones!", tone: "gold", line: "So many cones!" },
  { id: "rain", title: "RAINY ROAD!", sub: "Slippy puddles everywhere", tone: "mint", line: "Splishy splashy!" },
  { id: "kranky", title: "KRANKY CRAZE!", sub: "Crabs all over the road", tone: "red", line: "Kranky brought friends!" },
  { id: "leaves", title: "LEAF STORM!", sub: "Munch all the salad!", tone: "mint", line: "Salad party!" },
  { id: "rivers", title: "RIVER RUN!", sub: "Lots of bridges ahead", tone: "pink", line: "Bridges everywhere!" },
  { id: "blocks", title: "ROADWORKS!", sub: "Barriers ahead", tone: "red", line: "Who closed the road?!" },
  { id: "rush", title: "TURBO RUSH!", sub: "Everything comes faster", tone: "pink", line: "Hold on to your shell!" },
  { id: "boosts", title: "ROCKET PARTY!", sub: "Extra rocket boosts", tone: "gold", line: "Rockets! Rockets!" },
];
const HIT_LINES: Record<string, string[]> = {
  cone: ["Bonk! Cone head!", "Ouch, my shell!", "Who put that there?!"],
  puddle: ["Splish! Slippy!", "My socks are wet!", "Wheee— oops!"],
  rock: ["Rocky road!", "Crunch! Ow!", "That rock was grumpy!"],
  kranky: ["Kranky, move!", "Hey! No pinching!", "Crabby crash!"],
  barrier: ["Road closed?!", "Clunk!", "Detour fail!"],
  river: ["Splash! Glub glub!", "I can't swim!", "The BRIDGE!"],
};

function pickW<T>(r: Rng, opts: [T, number][]) {
  let tot = 0;
  for (const o of opts) tot += o[1];
  let v = r.next() * tot;
  for (const [k, w] of opts) { v -= w; if (v <= 0) return k; }
  return opts[0][0];
}

export default class TurboDash extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "turbo-dash", title: "Turbo Dash", host: "turbo", style: "run",
    music: { calm: "a:turbo_calm", action: "a:turbo_action" },
    sounds: ["a:bonk", "a:splash", "a:crunch", "a:rocket", "a:nomnom", "a:squeak", "a:clunk", "a:creak", "a:twinkle", "a:go", "a:tickHi", "a:poof", "a:cheer", "whooshShort", "gibberK", "v:kranky_laugh", "v:turbo_laugh"],
    sprites: [spriteUrl("kranky", "happy"), spriteUrl("kranky", "sad")],
    voicePitch: 1.15, transition: "iris",
  };
  private objs: Obj[] = [];
  private props: Prop[] = [];
  private dist = 0;
  private spd = 0;
  private planAt = 26; private propAt = 0;
  private nextLevelAt = LEVEL_M; private scoreAt = 10;
  private lane = 1;
  private pl = { x: 0, sq: 0, spin: 0, hop: 0, turn: 1, dir: 0 };
  private phase: "ready" | "race" | "crash" = "ready";
  private phaseT = 0;
  private invuln = 0; private boost = 0; private slow = 0; private splash = 0;
  private biome = BIOMES[0]; private prevBiome = BIOMES[0];
  private blend = { v: 1 };
  private biomeBag = new Bag<Biome>(BIOMES.slice(1));
  private kindBag = new Bag<Kind>(["cone", "puddle", "rock"]);
  private themeBag = new Bag<Theme>(THEMES);
  private theme: Theme | null = null;
  private announced = new Set<Feature>();
  private lastFree = [0, 1, 2]; private lastType: RowType = "one";
  private lastBoostAt = 0; private lastHeartAt = 0;
  private bend = 0;
  private lay = { hy: 300, py: 700, cx: 195, rh: 160 };
  private tgt = { hy: 300, py: 700, cx: 195, rh: 160 };
  private size = { w: 0, h: 0 };
  private touch: { x: number; y: number; used: boolean } | null = null;
  private press = { l: 0, r: 0 };
  private lines: { a: number; r: number; v: number }[] = Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * Math.PI * 2 + i * 0.37, r: (i * 0.137) % 1, v: 0.8 + ((i * 0.61) % 1) * 0.8 }));
  private progress = -1;
  private steers = 0;
  private tipUntil = 0;

  // ------------------------------------------------------------ layout & projection
  protected onResize() {
    const snap = this.W !== this.size.w || this.H !== this.size.h;
    this.size = { w: this.W, h: this.H };
    this.layout(snap);
  }

  private layout(snap: boolean) {
    const A = this.area, portrait = this.W < this.H;
    const hy = A.y + A.h * (portrait ? 0.27 : 0.25);
    const py = A.y + A.h * 0.86;
    const rh = Math.min(this.W * (portrait ? 0.42 : 0.3), (py - hy) * 0.9, 300);
    this.tgt = { hy, py, cx: this.W / 2, rh };
    if (snap) this.lay = { ...this.tgt };
  }

  private get lw() { return (this.lay.rh * 2) / 3; }
  private sOf(d: number) { return D / (D + Math.max(d, -D * 0.72)); }
  private yOf(s: number) { return this.lay.hy + (this.lay.py - this.lay.hy) * s; }
  private xOf(xl: number, s: number) { return this.lay.cx + this.bend * Math.pow(Math.max(0, 1 - s), 2) * this.W * 0.45 + xl * this.lw * s; }
  private get S() { return Math.min(this.lw * 0.98, 165); }

  // ------------------------------------------------------------ difficulty
  private has(f: Feature) { return this.level >= byDiff(this.diff, UNLOCK[f]); }
  private speedFor() {
    const L = this.level;
    const base = byDiff(this.diff, { easy: 8, medium: 10, hard: 12 });
    const step = byDiff(this.diff, { easy: 0.55, medium: 0.7, hard: 0.85 });
    const cap = byDiff(this.diff, { easy: 17, medium: 21, hard: 25 });
    const over = Math.max(0, L - 1 - (cap - base) / step);
    return ramp(L, base, step, cap) + Math.min(over * 0.15, 4);
  }
  private gapFor() {
    const L = this.level;
    return byDiff(this.diff, { easy: ramp(L, 24, -0.9, 14), medium: ramp(L, 21, -0.9, 12.5), hard: ramp(L, 18, -0.8, 11) }) * (this.theme?.id === "rush" ? 0.82 : 1);
  }
  private allUnlocked() { return this.level > byDiff(this.diff, UNLOCK.slalom); }

  // ------------------------------------------------------------ run setup
  protected setupLevel() {
    this.layout(true);
    this.objs = []; this.props = [];
    this.dist = 0; this.spd = 0; this.planAt = 26; this.propAt = 0;
    this.nextLevelAt = LEVEL_M; this.scoreAt = 10; this.progress = -1;
    this.lane = 1; this.pl = { x: 0, sq: 0, spin: 0, hop: 0, turn: 0, dir: 0 };
    this.phase = "ready"; this.phaseT = 0; this.steers = 0;
    this.invuln = 0; this.boost = 0; this.slow = 0; this.splash = 0;
    this.biomeBag = new Bag<Biome>(BIOMES.slice(1));
    this.biome = this.prevBiome = this.level === 1 ? BIOMES[0] : this.biomeBag.next(this.rng);
    this.blend.v = 1;
    this.announced = new Set(FEATURES.filter((f) => this.has(f.id)).map((f) => f.id));
    this.kindBag = new Bag<Kind>(this.has("kranky") ? ["cone", "puddle", "rock", "kranky"] : ["cone", "puddle", "rock"]);
    this.themeBag = new Bag<Theme>(THEMES);
    this.theme = this.allUnlocked() ? this.themeBag.next(this.rng) : null;
    this.lastFree = [0, 1, 2]; this.lastType = "one"; this.lastBoostAt = 0; this.lastHeartAt = 0;
    this.props.push({ kind: "arch", at: 3.5, side: 0, off: 0, ph: 0, sc: 1, c: "#FFFFFF" });
    for (let i = 0; i < 9; i++) this.props.push({ kind: "flag", at: -6 + i * 4, side: i % 2 ? 1 : -1, off: 1.95, ph: i, sc: 1, c: "#FFFFFF" });
    this.propAt = 30;
    this.timerBar(0, "#7CF2C9");
    this.music(this.level >= 3 ? "action" : "calm");
    const touch = this.W < 820;
    this.tip(touch ? "Tap left or right (or swipe) to switch lanes 👈👉" : "← → keys (or tap a side) to switch lanes", 14);
    this.react("happy", this.rng.pick(["Rev rev! Ready?", "Rocket shell: ON!", "Fastest snail ever!", "Let's zoom!"]));
    this.after(1.0, () => { this.banner("READY?", this.theme ? `${this.theme.title.replace("!", "")} ahead!` : "Steady…", "gold"); this.sfx("a:tickHi", { gain: 0.5 }); });
  }

  private go() {
    this.phase = "race";
    this.banner("GO!", undefined, "mint");
    this.sfx("a:go", { gain: 0.7 }); this.sfx("a:rocket", { gain: 0.6, delay: 0.05 });
    this.tween(this.pl, { turn: 1 }, 0.4, ease.out);
    this.pl.sq = 1; this.pl.hop = 1;
    this.burst(this.lay.cx, this.lay.py - 10, { n: 18, colors: ["#FFFFFF", "#FFE7C2", "#DDD3EA"], kind: "bubble", speed: 200, gravity: -60, size: 9 });
    this.vibrate([20, 30, 20]);
  }

  // ------------------------------------------------------------ planning the road ahead
  private planRow() {
    const r = this.rng, th = this.theme?.id;
    const gap = this.gapFor();
    let at = this.planAt + gap * r.range(0.88, 1.18);
    const opts: [RowType, number][] = [["one", this.has("two") ? 2.2 : 3]];
    if (this.has("two")) opts.push(["two", 2.2]);
    if (this.has("crab")) opts.push(["crab", th === "kranky" ? 3 : 1.1]);
    if (this.has("barrier")) opts.push(["barrier", th === "blocks" ? 3 : 0.9]);
    if (this.has("river")) opts.push(["river", th === "rivers" ? 3 : 0.75]);
    if (this.has("slalom")) opts.push(["slalom", th === "cones" ? 1.6 : 0.55]);
    let type = pickW(r, opts);
    if (type === this.lastType && type !== "one" && type !== "two") type = "one";
    const prevAt = this.planAt;
    let free: number[] = [];
    const add = (kind: Kind, lane: number, a: number, to = lane) => this.objs.push({ kind, at: a, lane, to, x: lane - 1, done: false, fly: 0, vx: 0, ph: r.range(0, 10), hitT: -9, spd: 1, cue: false });
    const hazard = (): Kind => {
      if (th === "cones" && r.chance(0.55)) return "cone";
      if (th === "rain" && r.chance(0.55)) return "puddle";
      if (th === "kranky" && r.chance(0.5)) return "kranky";
      if (th === "blocks" && r.chance(0.4)) return "cone";
      return this.kindBag.next(r);
    };
    const near = (l: number) => Math.min(...this.lastFree.map((f) => Math.abs(f - l)));
    if (type === "one") {
      const lane = r.chance(0.6) ? r.pick(this.lastFree) : r.int(0, 2);
      add(hazard(), lane, at);
      free = [0, 1, 2].filter((l) => l !== lane);
    } else if (type === "two") {
      const f = r.int(0, 2);
      if (near(f) >= 2) at += gap * 0.3;
      const a = hazard(); let b = hazard();
      if (b === a && r.chance(0.6)) b = hazard();
      const ls = [0, 1, 2].filter((l) => l !== f);
      add(a, ls[0], at); add(b, ls[1], at + r.range(-0.6, 0.6));
      free = [f];
    } else if (type === "crab") {
      const from = r.int(0, 2);
      const far = this.diff !== "easy" && r.chance(0.35);
      const to = far && from !== 1 ? 2 - from : from === 1 ? (r.chance(0.5) ? 0 : 2) : 1;
      add("crab", from, at, to);
      this.objs[this.objs.length - 1].spd = this.level > 12 ? 1.25 : 1;
      free = [0, 1, 2].filter((l) => l !== to);
    } else if (type === "barrier") {
      at += gap * 0.35;
      const left = r.int(0, 1);
      add("barrier", left, at);
      free = [left === 0 ? 2 : 0];
    } else if (type === "river") {
      at += gap * 0.35;
      const safe = r.int(0, 2);
      add("river", safe, at);
      free = [safe];
    } else {
      at += gap * 0.3;
      const n = r.int(3, 4), step = Math.max(9, this.speedFor() * 0.72);
      let f = r.pick(this.lastFree), dir = f === 0 ? 1 : f === 2 ? -1 : r.chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) {
        if (i > 0) { if (f + dir < 0 || f + dir > 2) dir = -dir; f += dir; }
        for (const l of [0, 1, 2]) if (l !== f) add("cone", l, at + i * step);
      }
      at += (n - 1) * step;
      free = [f];
    }
    // leaf trail leading into a safe lane
    const leafy = th === "leaves" ? 1 : 0.62;
    if (type !== "slalom" && r.chance(leafy)) {
      const lane = r.pick(free), n = th === "leaves" ? r.int(4, 6) : r.int(3, 4), sp = 2.6;
      const start = at - 3.2 - (type === "river" || type === "barrier" ? 1.2 : 0);
      const gold = r.chance(th === "leaves" ? 0.25 : 0.1);
      for (let k = 0; k < n; k++) {
        const a = start - k * sp;
        if (a < prevAt + 4) break;
        add(gold && k === 0 ? "gold" : "leaf", lane, a);
      }
    }
    // power-ups between this row and the next
    if (this.level >= 2 && at - this.lastBoostAt > (th === "boosts" ? 70 : 190) && r.chance(th === "boosts" ? 0.45 : 0.14)) {
      add("boost", r.pick(free), at + gap * 0.48); this.lastBoostAt = at;
    } else if (this.lives < 3 && at - this.lastHeartAt > 320 && r.chance(0.1)) {
      add("heart", r.pick(free), at + gap * 0.5); this.lastHeartAt = at;
    }
    this.planAt = at; this.lastFree = free; this.lastType = type;
  }

  private planProp() {
    const r = this.rng, B = this.biome;
    this.propAt += r.range(2.6, 6);
    const side = r.chance(0.5) ? -1 : 1;
    const kind = r.chance(0.04) ? "kranky" : r.pick(B.props);
    const c = kind === "flower" || kind === "gumdrop" ? r.pick(["#FF6F91", "#FFD25A", "#9B5DE5", "#7CC8FF", "#FF8A3D"]) : B.leaf;
    this.props.push({ kind, at: this.propAt, side, off: r.range(1.95, 3.8), ph: r.range(0, 10), sc: r.range(0.8, 1.2), c });
    if (r.chance(0.35)) this.props.push({ kind: r.pick(B.props), at: this.propAt + r.range(0.5, 2), side: -side, off: r.range(2.6, 5.5), ph: r.range(0, 10), sc: r.range(0.9, 1.4), c: B.leaf });
  }

  // ------------------------------------------------------------ input
  private steer(dir: number) {
    if (this.phase === "crash" || this.lives <= 0) return;
    if (dir < 0) this.press.l = 1; else this.press.r = 1;
    const to = clamp(this.lane + dir, 0, 2);
    if (to === this.lane) { this.pl.sq = 0.6; this.sfx("a:squeak", { gain: 0.35, rate: 1.3 }); return; }
    this.lane = to; this.pl.sq = 1; this.pl.dir = dir;
    if (++this.steers === 3 && this.boost <= 0 && this.phaseT < 20) { this.tipUntil = 0; this.hint(null); }
    this.sfx("whooshShort", { x: this.xOf(to - 1, 1), gain: 0.35, rate: 1.1 + Math.random() * 0.2 });
    const x = this.xOf(this.pl.x, 1);
    this.burst(x - dir * this.S * 0.4, this.lay.py - 4, { n: 5, colors: [lighten(this.biome.ground[0], 0.3), "#FFFFFF"], kind: "dot", speed: 90, gravity: 120, size: 5, life: 0.4 });
  }
  onKey(k: string) {
    if (k === "ArrowLeft" || k === "a" || k === "A") this.steer(-1);
    else if (k === "ArrowRight" || k === "d" || k === "D") this.steer(1);
  }
  protected onDown(x: number, y: number) { this.touch = { x, y, used: false }; }
  protected onMove(x: number, y: number) {
    const t = this.touch;
    if (!t || t.used) return;
    const dx = x - t.x;
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(y - t.y)) { t.used = true; this.steer(dx > 0 ? 1 : -1); }
  }
  protected onUp(x: number) {
    if (this.touch && !this.touch.used) this.steer(x < this.W / 2 ? -1 : 1);
    this.touch = null;
  }

  // ------------------------------------------------------------ simulation
  private onLevelUp() {
    this.prevBiome = this.biome;
    this.biome = this.biomeBag.next(this.rng);
    this.blend.v = 0; this.tween(this.blend, { v: 1 }, 3, ease.inOut);
    const horizon = this.dist + SPAWN * 0.8;
    this.props = this.props.filter((p) => p.at < horizon);
    this.propAt = Math.min(this.propAt, horizon);
    this.props.push({ kind: "sign", at: this.dist + SPAWN - 4, side: 1, off: 2.25, ph: 0, sc: 1.1, c: "#FFFFFF", text: this.biome.name });
    if (this.level >= 3) this.music("action");
    if (this.has("kranky") && !this.announced.has("kranky")) this.kindBag = new Bag<Kind>(["cone", "puddle", "rock", "kranky"]);
    const fresh = FEATURES.filter((f) => this.has(f.id) && !this.announced.has(f.id));
    if (fresh.length) {
      for (const f of fresh) this.announced.add(f.id);
      const f = fresh[fresh.length - 1];
      this.after(1.7, () => { this.banner(f.title, f.sub, f.tone); this.react("wow", f.line); this.tip(f.hint, 8); this.sfx("a:twinkle", { gain: 0.5 }); }, false);
    } else if (this.allUnlocked()) {
      this.theme = this.themeBag.next(this.rng);
      const t = this.theme;
      this.after(1.7, () => { this.banner(t.title, t.sub, t.tone); this.react("wow", t.line); this.sfx("a:twinkle", { gain: 0.5 }); }, false);
    } else this.after(1.7, () => this.tip(`Welcome to ${this.biome.name}! 🗺️`, 5), false);
  }

  protected update(dt: number) {
    const k = Math.min(1, dt * 5);
    this.lay.hy += (this.tgt.hy - this.lay.hy) * k; this.lay.py += (this.tgt.py - this.lay.py) * k;
    this.lay.cx += (this.tgt.cx - this.lay.cx) * k; this.lay.rh += (this.tgt.rh - this.lay.rh) * k;
    this.phaseT += dt;
    const over = this.hud.status === "over" || this.lives <= 0;
    if (over && this.phase !== "crash") { this.phase = "crash"; this.tween(this.pl, { turn: 0 }, 0.5, ease.out, 0.4); this.timerBar(null); }
    if (this.phase === "ready" && this.phaseT >= READY && !this.inTransition) this.go();
    if (this.tipUntil && this.t > this.tipUntil) { this.tipUntil = 0; if (this.boost <= 0) this.hint(null); }
    const target = this.phase !== "race" ? 0 : this.speedFor() * (this.boost > 0 ? 1.7 : 1) * (this.slow > 0 ? 0.5 : 1);
    this.spd = lerp(this.spd, target, Math.min(1, dt * (target < this.spd ? 3.5 : 1.1)));
    this.dist += this.spd * dt;
    this.bend = Math.sin(this.dist * 0.008) * 0.42 + Math.sin(this.dist * 0.021 + 1) * 0.18;
    // player
    this.pl.x += (this.lane - 1 - this.pl.x) * Math.min(1, dt * 16);
    this.pl.sq = Math.max(0, this.pl.sq - dt * 4);
    this.pl.hop = Math.max(0, this.pl.hop - dt * 2.2);
    this.pl.spin = Math.max(0, this.pl.spin - dt * 1.4);
    this.press.l = Math.max(0, this.press.l - dt * 4); this.press.r = Math.max(0, this.press.r - dt * 4);
    this.invuln = Math.max(0, this.invuln - dt); this.slow = Math.max(0, this.slow - dt); this.splash = Math.max(0, this.splash - dt);
    if (this.boost > 0) {
      this.boost -= dt;
      if (this.boost <= 0) { this.boost = 0; this.invuln = Math.max(this.invuln, 0.7); this.hint(null); }
    }
    // plan ahead
    while (this.planAt < this.dist + SPAWN + 24) this.planRow();
    while (this.propAt < this.dist + SPAWN + 24) this.planProp();
    // objects
    const px = this.xOf(this.pl.x, 1), pyy = this.lay.py - this.S * 0.5;
    for (const o of this.objs) {
      const d = o.at - this.dist;
      if (o.fly > 0) {
        o.fly = Math.min(1, o.fly + dt * 1.6);
        if (o.kind === "leaf" || o.kind === "gold" || o.kind === "boost" || o.kind === "heart") o.at = this.dist + 0.25; else o.at += this.spd * dt * 0.75;
        continue;
      }
      if (o.kind === "crab") {
        const a = 26 / o.spd + 2, b = 9;
        const u = clamp((a - d) / (a - b), 0, 1);
        o.x = lerp(o.lane - 1, o.to - 1, ease.inOut(u));
        if (u > 0 && u < 1 && Math.random() < dt * 6 && d < SPAWN - 6) this.burst(this.xOf(o.x, this.sOf(d)), this.yOf(this.sOf(d)), { n: 1, colors: ["#FFFFFF"], kind: "dot", speed: 30, gravity: 0, size: 3 * this.sOf(d) + 1, life: 0.4 });
        if (!o.cue && d < 20) { o.cue = true; this.sfx("gibberK", { x: this.xOf(o.x, this.sOf(d)), gain: 0.35 }); }
      }
      if (!o.done && d <= 0.45 && this.phase === "race" && !this.inTransition) {
        o.done = true;
        this.collide(o, px, pyy);
      }
    }
    this.objs = this.objs.filter((o) => (o.fly > 0 ? o.fly < 1 : o.at - this.dist > -D * 0.7));
    this.props = this.props.filter((p) => p.at - this.dist > -D * 0.7);
    // juice
    if (this.phase === "race" && this.spd > 1) {
      if (Math.random() < dt * this.spd * 0.9) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.particles.push({ x: px + side * this.S * 0.35, y: this.lay.py - 2, vx: side * (30 + Math.random() * 80), vy: 40 + Math.random() * 90, life: 0.45, max: 0.45, size: 3 + Math.random() * 4, color: rgba(darken(this.biome.ground[0], 0.1), 0.8), kind: "dot", rot: 0, vr: 0, g: 0 });
      }
      if (this.boost > 0 && Math.random() < dt * 25) this.particles.push({ x: px + (Math.random() - 0.5) * this.S, y: this.lay.py - this.S * 0.4, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 120, life: 0.5, max: 0.5, size: 5 + Math.random() * 4, color: Math.random() < 0.5 ? "#7CF2FF" : "#FFFFFF", kind: "star", rot: 0, vr: 6, g: 0 });
      if (this.theme?.id === "rain" && Math.random() < dt * 40) this.particles.push({ x: Math.random() * this.W, y: this.area.y - 10, vx: -40, vy: 650 + Math.random() * 200, life: 1.5, max: 1.5, size: 3, color: "#BFE6FF", kind: "drop", rot: 0.1, vr: 0, g: 0 });
      if (this.biome.night && Math.random() < dt * 2) this.particles.push({ x: Math.random() * this.W, y: this.lay.hy + Math.random() * (this.H - this.lay.hy), vx: (Math.random() - 0.5) * 20, vy: -10, life: 2, max: 2, size: 3, color: "#FFF27A", kind: "dot", rot: 0, vr: 0, g: -5 });
    }
    const lineK = this.lineAmt();
    for (const l of this.lines) { l.r += dt * l.v * (0.6 + lineK * 2.2); if (l.r > 1) { l.r -= 1; l.a = Math.random() * Math.PI * 2; } }
    // distance → score + levels
    if (this.phase === "race" && !over) {
      if (this.dist >= this.scoreAt) { this.scoreAt += 10; this.addRaw(byDiff(this.diff, { easy: 5, medium: 8, hard: 10 })); }
      if (this.dist >= this.nextLevelAt) { this.nextLevelAt += LEVEL_M; this.levelUp(); this.onLevelUp(); }
      const prog = Math.round((1 - (this.nextLevelAt - this.dist) / LEVEL_M) * 50) / 50;
      if (prog !== this.progress) { this.progress = prog; this.timerBar(prog, this.boost > 0 ? "#7CF2FF" : "#7CF2C9"); }
    }
  }

  private tip(text: string, sec: number) { this.hint(text); this.tipUntil = this.t + sec; }

  private lineAmt() { return clamp((this.spd - 12) / 14, 0, 0.6) + (this.boost > 0 ? 0.7 : 0); }

  private collide(o: Obj, px: number, py: number) {
    const x = this.pl.x;
    let hit = false;
    if (o.kind === "barrier") hit = x > o.lane - 1 - 0.55 && x < o.lane + 0.55;
    else if (o.kind === "river") hit = Math.abs(x - (o.lane - 1)) > 0.42;
    else hit = Math.abs(x - o.x) < (o.kind === "leaf" || o.kind === "gold" || o.kind === "boost" || o.kind === "heart" ? 0.62 : 0.55);
    if (o.kind === "river" && !hit) { this.sfx("a:creak", { gain: 0.6 }); this.pl.hop = 0.5; this.float("Phew!", px, py - 40, "#7CF2C9", 24); return; }
    if (!hit) {
      if (o.kind === "crab" || o.kind === "kranky") { if (this.rng.chance(0.35)) this.sfx("gibberK", { x: this.xOf(o.x, 1), gain: 0.4 }); }
      return;
    }
    switch (o.kind) {
      case "leaf": case "gold": {
        o.fly = 0.001;
        this.good(px, py - 30, o.kind === "gold" ? 40 : 6);
        this.sfx(o.kind === "gold" ? "a:twinkle" : "a:nomnom", { x: px, gain: o.kind === "gold" ? 0.6 : 0.3, rate: 1.1 + Math.random() * 0.2 });
        if (o.kind === "gold") { this.burst(px, py - 20, { n: 16, colors: ["#FFD25A", "#FFFFFF"], kind: "star", speed: 260 }); this.react("happy", this.rng.pick(["Golden lettuce!", "Shiny salad!", "Jackpot!"])); }
        this.pl.sq = Math.max(this.pl.sq, 0.4);
        return;
      }
      case "boost": {
        o.fly = 0.001;
        this.boost = 3.3; this.invuln = Math.max(this.invuln, 3.3);
        this.good(px, py - 30, 20);
        this.sfx("a:rocket", { gain: 0.8 }); this.sfx("v:turbo_laugh", { gain: 0.7, delay: 0.15, duck: false });
        this.banner("TURBO BOOST!", "Smash through anything!", "mint");
        this.hint("🚀 BOOST! Smash everything!");
        this.pl.hop = 1; this.shake(6, 0.3); this.flash("#7CF2FF", 0.25);
        this.music("action");
        return;
      }
      case "heart": {
        o.fly = 0.001;
        if (this.lives < 3) { this.lives++; this.setHud({ lives: this.lives }); }
        this.sfx("a:twinkle", { gain: 0.6 }); this.sfx("a:cheer", { gain: 0.4, delay: 0.1 });
        this.float("+♥", px, py - 40, "#FF6F91", 34);
        this.burst(px, py - 20, { n: 14, colors: ["#FF6F91", "#FFFFFF"], kind: "star", speed: 220 });
        this.react("happy", "Extra heart!");
        return;
      }
      default: break;
    }
    // hazards
    const ox = o.kind === "barrier" ? this.xOf(o.lane - 0.5, 1) : this.xOf(o.kind === "river" ? x : o.x, 1);
    if (this.boost > 0) {
      if (o.kind !== "river") { o.fly = 0.001; o.vx = (ox < px ? -1 : 1) * 1.5 + (Math.random() - 0.5); }
      this.good(ox, py - 30, 12);
      this.float("SMASH!", ox, py - 70, "#7CF2FF", 28);
      this.sfx(o.kind === "river" ? "a:splash" : "a:poof", { x: ox, gain: 0.7 });
      this.burst(ox, py, { n: 16, colors: ["#FFD25A", "#FFFFFF", "#7CF2FF"], kind: "star", speed: 300 });
      this.shake(5, 0.2);
      return;
    }
    if (this.invuln > 0) return;
    const kind = o.kind === "crab" ? "kranky" : o.kind;
    if (kind === "cone" || kind === "rock" || kind === "barrier") { o.fly = 0.001; o.vx = (ox < px ? -1 : 1) * (0.8 + Math.random()); }
    o.hitT = this.t;
    if (kind === "cone") this.sfx("a:bonk", { x: ox, gain: 0.8 });
    else if (kind === "rock") this.sfx("a:crunch", { x: ox, gain: 0.8 });
    else if (kind === "barrier") this.sfx("a:clunk", { x: ox, gain: 0.8 });
    else if (kind === "puddle") { this.sfx("a:splash", { x: ox, gain: 0.8 }); this.sfx("a:squeak", { x: ox, gain: 0.5, delay: 0.25 }); this.splash = 0.6; }
    else if (kind === "river") { this.sfx("a:splash", { gain: 0.9 }); this.splash = 1; this.burst(px, this.lay.py - 10, { n: 24, colors: ["#BFE6FF", "#FFFFFF", "#4FB3F0"], kind: "drop", speed: 380, size: 7 }); }
    else if (kind === "kranky") { this.sfx("a:bonk", { x: ox, gain: 0.7 }); this.sfx("v:kranky_laugh", { x: ox, gain: 0.8, delay: 0.2, duck: false }); }
    if (kind === "puddle") this.burst(ox, this.lay.py - 6, { n: 18, colors: ["#BFE6FF", "#FFFFFF", "#4FB3F0"], kind: "drop", speed: 300, size: 6 });
    this.invuln = 1.7; this.slow = 0.9; this.pl.spin = 1; this.pl.sq = 1;
    this.bad(px, py, { line: this.rng.pick(HIT_LINES[kind] ?? HIT_LINES.cone) });
  }

  // ------------------------------------------------------------ drawing: world
  private bc(a: string, b: string) { return this.blend.v >= 0.999 ? b : mix(a, b, this.blend.v); }
  private nightK() { return lerp(this.prevBiome.night ? 1 : 0, this.biome.night ? 1 : 0, this.blend.v); }

  private drawSky(g: G) {
    const P = this.prevBiome, B = this.biome, W = this.W, hy = this.lay.hy;
    const gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, this.bc(P.sky[0], B.sky[0])); gr.addColorStop(1, this.bc(P.sky[1], B.sky[1]));
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    const nk = this.nightK(), top = this.area.y;
    if (nk > 0.02) for (let i = 0; i < 46; i++) {
      const sx = (i * 97.31) % W, sy = 8 + ((i * 53.17) % Math.max(10, hy - 30));
      g.fillStyle = `rgba(255,255,255,${nk * (0.45 + 0.45 * Math.sin(this.t * 2 + i))})`;
      g.beginPath(); g.arc(sx, sy, 1 + (i % 3) * 0.6, 0, Math.PI * 2); g.fill();
    }
    // sun / moon with a face
    const sx = W * 0.8 - this.bend * W * 0.06, sy = top + (hy - top) * 0.36, sr = clamp((hy - top) * 0.2, 18, 44);
    if (nk < 0.98) {
      g.save(); g.globalAlpha = 1 - nk;
      sunburst(g, sx, sy, sr * 2.4, "rgba(255,240,170,0)", "rgba(255,240,170,0.28)", 18, this.t * 0.15);
      blob(g, sx, sy, sr, sr, "#FFD84D", { gloss: 0.5 });
      eye(g, sx - sr * 0.32, sy - sr * 0.1, sr * 0.14, { blink: 0.9 }); eye(g, sx + sr * 0.32, sy - sr * 0.1, sr * 0.14, { blink: 0.9 });
      mouth(g, sx, sy + sr * 0.28, sr * 0.45, "smile");
      g.restore();
    }
    if (nk > 0.02) {
      g.save(); g.globalAlpha = nk;
      blob(g, sx, sy, sr * 0.9, sr * 0.9, "#FFF4C2", { gloss: 0.4 });
      g.fillStyle = "rgba(200,190,140,0.5)";
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.25, 0.13], [0.2, -0.35, 0.1]]) { g.beginPath(); g.arc(sx + cx * sr, sy + cy * sr, cr * sr, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    // clouds
    for (let i = 0; i < 4; i++) {
      const cx = (((i * 0.31 + this.t * 0.006 * (1 + i * 0.4)) % 1.4) - 0.2) * W, cy = top + 8 + ((i * 37) % Math.max(20, (hy - top) * 0.55));
      g.save(); g.globalAlpha = 0.9 - nk * 0.6;
      blob(g, cx, cy, 34, 14, "#FFFFFF", { gloss: 0.4 }); blob(g, cx + 22, cy - 8, 22, 14, "#FFFFFF", { gloss: 0.4 }); blob(g, cx - 20, cy - 4, 18, 11, "#FFFFFF", { gloss: 0.3 });
      g.restore();
    }
    // two layers of round clay hills on the horizon (parallax with the road bend)
    const hc = this.bc(P.hill, B.hill), hh = Math.max(30, (hy - top) * 0.4);
    for (const [layer, par] of [[0, 0.06], [1, 0.12]] as const) {
      const c = layer ? hc : lighten(hc, 0.3);
      for (let k = -1; k < 7; k++) {
        const x = (k / 5) * W * 1.1 - this.bend * W * par + (layer ? W * 0.09 : 0);
        const h = hh * (0.55 + 0.45 * Math.abs(Math.sin(k * 1.7 + layer)));
        blob(g, x, hy + 4, W * 0.15, h * (layer ? 0.75 : 1), c, { gloss: 0.25 });
      }
    }
  }

  private quad(g: G, d0: number, d1: number, xa: number, xb: number, color: string) {
    const s0 = this.sOf(d0), s1 = this.sOf(d1), y0 = this.yOf(s0), y1 = this.yOf(s1);
    g.beginPath();
    g.moveTo(this.xOf(xa, s0), y0); g.lineTo(this.xOf(xb, s0), y0); g.lineTo(this.xOf(xb, s1), y1); g.lineTo(this.xOf(xa, s1), y1);
    g.closePath(); g.fillStyle = color; g.fill();
  }

  private drawGround(g: G) {
    const P = this.prevBiome, B = this.biome, hy = this.lay.hy, W = this.W, H = this.H;
    const g0 = this.bc(P.ground[0], B.ground[0]), g1 = this.bc(P.ground[1], B.ground[1]);
    const r0 = this.bc(P.road[0], B.road[0]), r1 = this.bc(P.road[1], B.road[1]);
    const e0 = this.bc(P.edge[0], B.edge[0]), e1 = this.bc(P.edge[1], B.edge[1]);
    g.fillStyle = g0; g.fillRect(0, hy, W, H - hy);
    // road body
    const sb = (H - this.lay.hy) / Math.max(1, this.lay.py - this.lay.hy) + 0.05, N = 26;
    g.beginPath();
    for (let i = 0; i <= N; i++) { const s = lerp(sb, 0.012, i / N); g.lineTo(this.xOf(-1.5, s), this.yOf(s)); }
    for (let i = N; i >= 0; i--) { const s = lerp(sb, 0.012, i / N); g.lineTo(this.xOf(1.5, s), this.yOf(s)); }
    g.closePath(); g.fillStyle = r0; g.fill();
    // stripes in world space
    const k0 = Math.floor((this.dist - D * 0.72) / SEG), k1 = Math.ceil((this.dist + 70) / SEG);
    const night = this.nightK();
    for (let kk = k1; kk >= k0; kk--) {
      const d0 = Math.max(kk * SEG - this.dist, -D * 0.72), d1 = kk * SEG + SEG - this.dist;
      if (d1 <= d0) continue;
      const even = ((kk % 2) + 2) % 2 === 0;
      if (even) {
        const s0 = this.sOf(d0), s1 = this.sOf(d1);
        g.fillStyle = g1; g.fillRect(0, this.yOf(s1), W, this.yOf(s0) - this.yOf(s1) + 0.5);
        this.quad(g, d0, d1, -1.5, 1.5, r1);
      }
      this.quad(g, d0, d1, -1.66, -1.5, even ? e0 : e1);
      this.quad(g, d0, d1, 1.5, 1.66, even ? e0 : e1);
      if (even) for (const lx of [-0.5, 0.5]) this.quad(g, d0, d0 + SEG * 0.6, lx - 0.035, lx + 0.035, night > 0.5 ? "#FFF27A" : "rgba(255,255,255,0.85)");
    }
    // soft haze at the horizon
    const fog = g.createLinearGradient(0, hy, 0, hy + (this.lay.py - hy) * 0.3);
    fog.addColorStop(0, rgba(this.bc(P.sky[1], B.sky[1]), 0.75)); fog.addColorStop(1, rgba(this.bc(P.sky[1], B.sky[1]), 0));
    g.fillStyle = fog; g.fillRect(0, hy - 1, W, (this.lay.py - hy) * 0.3);
  }

  // ------------------------------------------------------------ drawing: things on the road
  private drawFlat(g: G, o: Obj, d: number) {
    const s = this.sOf(d), y = this.yOf(s), u = this.lw * s, alpha = clamp((SPAWN - d) / 8, 0, 1);
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha;
    if (o.kind === "river") {
      const wc = "#3FA9F5";
      this.quad(g, d - 1.7, d + 1.7, -9, 9, wc);
      this.quad(g, d - 1.7, d - 1.25, -9, 9, "#2C7FC4");
      const sA = this.sOf(d + 1.7), sB = this.sOf(d - 1.7);
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = Math.max(1, 2 * s);
      for (let i = 0; i < 3; i++) {
        const yy = lerp(this.yOf(sA), this.yOf(sB), 0.25 + i * 0.25);
        g.beginPath();
        for (let xx = 0; xx <= this.W; xx += 14) g.lineTo(xx, yy + Math.sin(xx * 0.05 + this.t * 3 + i) * 2 * s);
        g.stroke();
      }
      // bridge
      const L = o.lane - 1;
      this.quad(g, d - 1.9, d + 1.9, L - 0.44, L + 0.44, "#B97A45");
      for (let p = -1.7; p < 1.8; p += 0.55) this.quad(g, d + p, d + p + 0.36, L - 0.42, L + 0.42, "#D9995A");
      for (const side of [-1, 1]) for (const dd of [d - 1.8, d + 1.8]) {
        const ss = this.sOf(dd), px = this.xOf(L + side * 0.46, ss), py = this.yOf(ss), uu = this.lw * ss;
        rr(g, px - uu * 0.04, py - uu * 0.28, uu * 0.08, uu * 0.3, uu * 0.03); clayFill(g, "#8B5A3C", px, py - uu * 0.14, uu * 0.15, { gloss: 0.2 });
      }
      for (const side of [-1, 1]) {
        const sa = this.sOf(d - 1.8), sb2 = this.sOf(d + 1.8);
        g.strokeStyle = "#7A4B2C"; g.lineWidth = Math.max(1, 3 * s);
        g.beginPath(); g.moveTo(this.xOf(L + side * 0.46, sa), this.yOf(sa) - this.lw * sa * 0.24); g.quadraticCurveTo(this.xOf(L + side * 0.46, this.sOf(d)), this.yOf(this.sOf(d)) - this.lw * s * 0.12, this.xOf(L + side * 0.46, sb2), this.yOf(sb2) - this.lw * sb2 * 0.24); g.stroke();
      }
      // a jumping fish for fun
      const jf = (this.t * 0.7 + o.ph) % 2.2;
      if (jf < 0.8 && u > 12) {
        const fx = this.xOf(o.lane === 0 ? 1.1 : -1.1, s), fy = y - Math.sin((jf / 0.8) * Math.PI) * u * 0.45;
        blob(g, fx, fy, u * 0.12, u * 0.07, "#FFB13C", { rot: (jf / 0.8 - 0.5) * 2.4 });
      }
    } else if (o.kind === "puddle") {
      const x = this.xOf(o.x, s);
      if (o.hitT > 0 && this.t - o.hitT < 0.6) g.globalAlpha *= 0.6;
      g.beginPath(); g.ellipse(x, y, u * 0.44, u * 0.16, 0, 0, Math.PI * 2);
      clayFill(g, "#4FB3F0", x, y, u * 0.44, { gloss: 0.5 });
      g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = Math.max(1, u * 0.02);
      const rp = (this.t * 0.8 + o.ph) % 1;
      g.beginPath(); g.ellipse(x, y, u * 0.38 * rp, u * 0.12 * rp, 0, 0, Math.PI * 2); g.stroke();
      // tiny rubber duck
      if (u > 14) {
        const dx = x + u * 0.12 * Math.sin(this.t + o.ph), dy = y - u * 0.04 + Math.sin(this.t * 3 + o.ph) * u * 0.01;
        blob(g, dx, dy, u * 0.1, u * 0.065, "#FFD84D", { gloss: 0.5 });
        blob(g, dx + u * 0.05, dy - u * 0.08, u * 0.055, u * 0.055, "#FFD84D", { gloss: 0.5 });
        blob(g, dx + u * 0.105, dy - u * 0.075, u * 0.03, u * 0.016, "#FF8A3D");
        g.fillStyle = "#1B1420"; g.beginPath(); g.arc(dx + u * 0.065, dy - u * 0.095, Math.max(0.8, u * 0.011), 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }

  private drawObj(g: G, o: Obj, d: number) {
    const s = this.sOf(d), u = this.lw * s;
    let x = this.xOf(o.kind === "barrier" ? o.lane - 0.5 : o.x, s), y = this.yOf(s);
    const alpha = clamp((SPAWN - d) / 8, 0, 1);
    if (alpha <= 0 || u < 2) return;
    g.save(); g.globalAlpha = alpha;
    let rot = 0, sc = 1;
    if (o.fly > 0) {
      const f = o.fly, pick = o.kind === "leaf" || o.kind === "gold" || o.kind === "boost" || o.kind === "heart";
      if (pick) { y -= f * u * 1.4; sc = 1 + f * 0.6; g.globalAlpha *= 1 - f; }
      else { x += o.vx * f * u * 2.2; y -= Math.sin(f * Math.PI * 0.8) * u * 2.2 - f * f * u * 0.6; rot = o.vx * f * 7; g.globalAlpha *= 1 - f * 0.8; }
    }
    g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    const bob = Math.sin(this.t * 4 + o.ph);
    switch (o.kind) {
      case "cone": this.drawCone(g, u); break;
      case "rock": this.drawRock(g, u, o.hitT > 0); break;
      case "kranky": case "crab": {
        const moving = o.kind === "crab" && Math.abs(o.x - (o.to - 1)) > 0.02 && Math.abs(o.x - (o.lane - 1)) > 0.001;
        if (o.kind === "crab" && d > 6 && Math.abs(o.x - (o.to - 1)) > 0.02) {
          // ground arrow pointing where he walks
          const dir = Math.sign(o.to - o.lane);
          g.save(); g.globalAlpha *= 0.55 + 0.3 * Math.sin(this.t * 8);
          g.fillStyle = "#FFD25A"; g.beginPath();
          g.moveTo(dir * u * 0.75, -u * 0.04); g.lineTo(dir * u * 0.45, -u * 0.17); g.lineTo(dir * u * 0.45, u * 0.09); g.closePath(); g.fill();
          g.restore();
        }
        shadow(g, 0, 0, u * 0.42, u * 0.09, 0.3);
        const laugh = o.hitT > 0 && this.t - o.hitT < 2.5;
        const url = spriteUrl("kranky", laugh ? "sad" : "happy");
        const im = this.img(url);
        const hop = moving ? Math.abs(Math.sin(this.t * 14 + o.ph)) * u * 0.06 : Math.abs(bob) * u * 0.02;
        if (im?.naturalWidth) this.sprite(g, url, 0, -hop, u * 0.58, { rot: moving ? Math.sin(this.t * 14) * 0.08 : Math.sin(this.t * 3 + o.ph) * 0.05, flip: o.to < o.lane });
        else { blob(g, 0, -u * 0.22 - hop, u * 0.3, u * 0.2, "#E8504F"); eye(g, -u * 0.1, -u * 0.42 - hop, u * 0.07); eye(g, u * 0.1, -u * 0.42 - hop, u * 0.07); }
        break;
      }
      case "barrier": this.drawBarrier(g, u); break;
      case "leaf": case "gold": {
        const h = u * (0.32 + bob * 0.04);
        if (o.fly === 0) shadow(g, 0, 0, u * 0.18, u * 0.05, 0.22);
        g.save(); g.translate(0, -h); g.rotate(Math.sin(this.t * 3 + o.ph) * 0.4); g.scale(Math.cos(this.t * 2.4 + o.ph), 1);
        this.drawLeaf(g, u * 0.22, o.kind === "gold");
        g.restore();
        if (o.kind === "gold" && u > 10) star(g, u * 0.16, -h - u * 0.18, u * 0.06 * (1 + 0.4 * Math.sin(this.t * 9)), "#FFFFFF", this.t * 3);
        break;
      }
      case "boost": {
        const h = u * (0.42 + bob * 0.05);
        shadow(g, 0, 0, u * 0.2, u * 0.05, 0.22);
        g.save(); g.translate(0, -h);
        const pr = u * (0.3 + 0.04 * Math.sin(this.t * 8));
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.4); gl.addColorStop(0, "rgba(124,242,255,0.6)"); gl.addColorStop(1, "rgba(124,242,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, 0, pr * 1.4, 0, Math.PI * 2); g.fill();
        g.rotate(Math.sin(this.t * 3) * 0.2 - 0.5);
        this.drawRocket(g, u * 0.24);
        g.restore();
        break;
      }
      case "heart": {
        const h = u * (0.4 + bob * 0.05);
        shadow(g, 0, 0, u * 0.18, u * 0.05, 0.22);
        const r = u * 0.16 * (1 + 0.08 * Math.sin(this.t * 6));
        g.save(); g.translate(0, -h);
        g.beginPath(); g.moveTo(0, r * 0.9); g.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.75, -r * 1.25, 0, -r * 0.45); g.bezierCurveTo(r * 0.75, -r * 1.25, r * 1.5, -r * 0.1, 0, r * 0.9);
        clayFill(g, "#FF6F91", 0, 0, r * 1.1, { gloss: 0.55 });
        g.restore();
        break;
      }
      default: break;
    }
    g.restore();
  }

  private drawCone(g: G, u: number) {
    const h = u * 0.6, w = u * 0.44;
    shadow(g, 0, 0, w * 0.75, u * 0.07, 0.3);
    rr(g, -w * 0.62, -u * 0.07, w * 1.24, u * 0.08, u * 0.03); clayFill(g, "#E8641E", 0, -u * 0.03, w * 0.6, { gloss: 0.2 });
    const path = () => { g.beginPath(); g.moveTo(-w * 0.5, -u * 0.06); g.lineTo(-w * 0.1, -h + w * 0.07); g.quadraticCurveTo(0, -h - w * 0.06, w * 0.1, -h + w * 0.07); g.lineTo(w * 0.5, -u * 0.06); g.closePath(); };
    path(); clayFill(g, "#FF8A3D", -w * 0.1, -h * 0.55, h * 0.6, { gloss: 0.4 });
    g.save(); path(); g.clip();
    g.fillStyle = "#FFFFFF"; g.fillRect(-w, -h * 0.62, w * 2, h * 0.13); g.fillRect(-w, -h * 0.34, w * 2, h * 0.13);
    g.restore();
  }

  private drawRock(g: G, u: number, bumped: boolean) {
    shadow(g, 0, 0, u * 0.4, u * 0.08, 0.3);
    blob(g, 0, -u * 0.2, u * 0.34, u * 0.23, "#A3A9BC", { gloss: 0.35 });
    blob(g, -u * 0.14, -u * 0.36, u * 0.12, u * 0.06, "#6FBF5A", { gloss: 0.3, rot: -0.3 });
    if (u > 14) {
      g.strokeStyle = "#3B3550"; g.lineWidth = Math.max(1, u * 0.025); g.lineCap = "round";
      if (bumped) { for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * u * 0.12 - u * 0.03, -u * 0.25); g.lineTo(sx * u * 0.12 + u * 0.03, -u * 0.19); g.moveTo(sx * u * 0.12 + u * 0.03, -u * 0.25); g.lineTo(sx * u * 0.12 - u * 0.03, -u * 0.19); g.stroke(); } }
      else for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * u * 0.12, -u * 0.23, u * 0.04, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      cheeks(g, 0, -u * 0.16, u * 0.17, u * 0.035);
    }
  }

  private drawBarrier(g: G, u: number) {
    const w = u * 1.85, h = u * 0.26, top = -u * 0.46;
    shadow(g, 0, 0, w * 0.55, u * 0.08, 0.3);
    for (const sx of [-0.4, 0.4]) { rr(g, sx * w - u * 0.035, top + h * 0.5, u * 0.07, -top - h * 0.5, u * 0.02); clayFill(g, "#5A4E7A", sx * w, -u * 0.2, u * 0.2, { gloss: 0.2 }); }
    rr(g, -w / 2, top, w, h, h * 0.35); clayFill(g, "#FFFFFF", 0, top + h / 2, w * 0.5, { gloss: 0.3 });
    g.save(); rr(g, -w / 2, top, w, h, h * 0.35); g.clip();
    g.fillStyle = "#E8504F";
    for (let x = -w / 2 - h; x < w / 2 + h; x += h * 1.2) { g.beginPath(); g.moveTo(x, top + h); g.lineTo(x + h * 0.6, top + h); g.lineTo(x + h * 1.2, top); g.lineTo(x + h * 0.6, top); g.closePath(); g.fill(); }
    g.restore();
    const on = Math.sin(this.t * 7) > 0;
    for (const sx of [-0.4, 0.4]) {
      const lit = sx < 0 ? on : !on;
      blob(g, sx * w, top - u * 0.05, u * 0.06, u * 0.05, lit ? "#FFD25A" : "#B38A2E", { gloss: 0.6 });
      if (lit) { g.fillStyle = "rgba(255,210,90,0.3)"; g.beginPath(); g.arc(sx * w, top - u * 0.05, u * 0.14, 0, Math.PI * 2); g.fill(); }
    }
  }

  private drawLeaf(g: G, r: number, gold: boolean) {
    const c = gold ? "#FFD25A" : "#6DD36A";
    g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(-r * 1.1, r * 0.4, -r * 0.9, -r * 0.8, 0, -r); g.bezierCurveTo(r * 0.9, -r * 0.8, r * 1.1, r * 0.4, 0, r);
    clayFill(g, c, 0, 0, r, { gloss: 0.5 });
    g.strokeStyle = darken(c, 0.25); g.lineWidth = Math.max(1, r * 0.1); g.lineCap = "round";
    g.beginPath(); g.moveTo(0, r * 1.15); g.lineTo(0, -r * 0.7);
    for (const k of [-0.3, 0.1]) { g.moveTo(0, r * k); g.lineTo(-r * 0.45, r * (k - 0.3)); g.moveTo(0, r * k); g.lineTo(r * 0.45, r * (k - 0.3)); }
    g.stroke();
  }

  private drawRocket(g: G, r: number) {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.3, r * 0.3); g.lineTo(s * r * 0.75, r * 0.95); g.lineTo(s * r * 0.3, r * 0.75); g.closePath(); clayFill(g, "#3B82F6", s * r * 0.5, r * 0.6, r * 0.4); }
    g.beginPath(); g.moveTo(0, -r * 1.1); g.bezierCurveTo(r * 0.55, -r * 0.7, r * 0.5, r * 0.4, r * 0.32, r * 0.85); g.lineTo(-r * 0.32, r * 0.85); g.bezierCurveTo(-r * 0.5, r * 0.4, -r * 0.55, -r * 0.7, 0, -r * 1.1);
    clayFill(g, "#FFFFFF", 0, 0, r, { gloss: 0.4 });
    g.save(); g.clip(); g.fillStyle = "#E8504F"; g.fillRect(-r, -r * 1.2, r * 2, r * 0.6); g.restore();
    blob(g, 0, -r * 0.05, r * 0.2, r * 0.2, "#7CC8FF", { gloss: 0.7 });
    const f = 1 + Math.sin(this.t * 30) * 0.2;
    blob(g, 0, r * 1.05, r * 0.2, r * 0.32 * f, "#FFB000", { gloss: 0.6 });
    blob(g, 0, r * 0.98, r * 0.1, r * 0.16 * f, "#FFF4B0");
  }

  // ------------------------------------------------------------ drawing: scenery
  private drawProp(g: G, p: Prop, d: number) {
    const s = this.sOf(d), u = this.lw * s * p.sc;
    if (u < 4) return;
    const xl = p.side * p.off, x = this.xOf(p.kind === "arch" ? 0 : xl, s), y = this.yOf(s);
    const alpha = clamp((SPAWN - d) / 10, 0, 1) * (p.kind === "arch" || p.kind === "sign" ? clamp(1 + d / 1.2, 0, 1) : 1);
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha; g.translate(x, y);
    const c = p.c, sway = Math.sin(this.t * 1.5 + p.ph) * 0.04;
    if (p.kind !== "arch" && p.kind !== "flag" && p.kind !== "sign") shadow(g, 0, 0, u * 0.32, u * 0.07, 0.22);
    switch (p.kind) {
      case "tree":
        rr(g, -u * 0.07, -u * 0.62, u * 0.14, u * 0.62, u * 0.05); clayFill(g, "#8B5A3C", 0, -u * 0.3, u * 0.32, { gloss: 0.2 });
        g.rotate(sway);
        blob(g, -u * 0.22, -u * 0.74, u * 0.3, u * 0.26, darken(c, 0.1), { gloss: 0.25 });
        blob(g, u * 0.22, -u * 0.78, u * 0.28, u * 0.25, darken(c, 0.04), { gloss: 0.25 });
        blob(g, 0, -u * 1.02, u * 0.34, u * 0.3, c, { gloss: 0.35 });
        if (u > 20) for (const [ax, ay] of [[-0.18, -0.8], [0.15, -1.05], [0.25, -0.72]]) blob(g, ax * u, ay * u, u * 0.04, u * 0.04, p.c === "#F07C2A" ? "#FFD25A" : "#FF6F91", { gloss: 0.6 });
        break;
      case "pine":
        rr(g, -u * 0.06, -u * 0.25, u * 0.12, u * 0.25, u * 0.03); clayFill(g, "#7A4B2C", 0, -u * 0.12, u * 0.2);
        g.rotate(sway * 0.5);
        for (let i = 0; i < 3; i++) {
          const yb = -u * (0.2 + i * 0.32), w = u * (0.42 - i * 0.1);
          g.beginPath(); g.moveTo(-w, yb); g.lineTo(0, yb - u * 0.5); g.lineTo(w, yb); g.closePath();
          clayFill(g, i % 2 ? c : darken(c, 0.08), 0, yb - u * 0.2, w, { gloss: 0.25 });
          if (this.biome.name === "Snowy Peaks" || p.c === "#2F8A5B") { g.beginPath(); g.moveTo(-w * 0.35, yb - u * 0.32); g.lineTo(0, yb - u * 0.5); g.lineTo(w * 0.35, yb - u * 0.32); g.closePath(); g.fillStyle = "rgba(255,255,255,0.85)"; g.fill(); }
        }
        break;
      case "flower":
        g.strokeStyle = "#4F9F3A"; g.lineWidth = Math.max(1, u * 0.04); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(u * 0.05, -u * 0.2, 0, -u * 0.36); g.stroke();
        blob(g, u * 0.06, -u * 0.14, u * 0.07, u * 0.03, "#5DB04A", { rot: -0.5 });
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + this.t * 0.5; blob(g, Math.cos(a) * u * 0.08, -u * 0.38 + Math.sin(a) * u * 0.08, u * 0.06, u * 0.06, c, { gloss: 0.4 }); }
        blob(g, 0, -u * 0.38, u * 0.05, u * 0.05, "#FFE15A", { gloss: 0.5 });
        break;
      case "mushroom":
        rr(g, -u * 0.08, -u * 0.26, u * 0.16, u * 0.26, u * 0.06); clayFill(g, "#FFF1DC", 0, -u * 0.13, u * 0.18);
        g.beginPath(); g.ellipse(0, -u * 0.26, u * 0.26, u * 0.2, 0, Math.PI, 0); g.closePath();
        clayFill(g, this.biome.night ? "#9B5DE5" : "#E8504F", 0, -u * 0.34, u * 0.26, { gloss: 0.45 });
        for (const [mx, my, mr] of [[-0.12, -0.33, 0.04], [0.08, -0.4, 0.05], [0.15, -0.3, 0.03]]) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(mx * u, my * u, mr * u, 0, Math.PI * 2); g.fill(); }
        if (this.biome.night) { g.fillStyle = "rgba(190,140,255,0.22)"; g.beginPath(); g.arc(0, -u * 0.3, u * 0.45, 0, Math.PI * 2); g.fill(); }
        break;
      case "bush":
        blob(g, -u * 0.16, -u * 0.14, u * 0.18, u * 0.15, darken(c, 0.08), { gloss: 0.25 });
        blob(g, u * 0.16, -u * 0.13, u * 0.17, u * 0.14, darken(c, 0.04), { gloss: 0.25 });
        blob(g, 0, -u * 0.22, u * 0.2, u * 0.18, this.biome.name === "Snowy Peaks" ? "#F3F8FF" : c, { gloss: 0.35 });
        break;
      case "sunflower": {
        g.strokeStyle = "#4F9F3A"; g.lineWidth = Math.max(1.5, u * 0.05); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.9); g.stroke();
        blob(g, -u * 0.09, -u * 0.4, u * 0.1, u * 0.04, "#5DB04A", { rot: 0.5 });
        g.translate(0, -u * 0.95); g.rotate(sway * 2);
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; blob(g, Math.cos(a) * u * 0.15, Math.sin(a) * u * 0.15, u * 0.08, u * 0.045, "#FFC93C", { rot: a, gloss: 0.3 }); }
        blob(g, 0, 0, u * 0.12, u * 0.12, "#8B5A3C", { gloss: 0.3 });
        if (u > 18) { eye(g, -u * 0.045, -u * 0.02, u * 0.025, { blink: 0.9 }); eye(g, u * 0.045, -u * 0.02, u * 0.025, { blink: 0.9 }); mouth(g, 0, u * 0.04, u * 0.06, "smile"); }
        break;
      }
      case "palm": {
        g.strokeStyle = "#B07A4A"; g.lineWidth = Math.max(2, u * 0.09); g.lineCap = "round";
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(u * 0.18, -u * 0.6, u * 0.08, -u * 1.25); g.stroke();
        g.translate(u * 0.08, -u * 1.25); g.rotate(sway);
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.55; blob(g, Math.cos(a) * u * 0.28, Math.sin(a) * u * 0.18 + u * 0.08, u * 0.3, u * 0.07, i % 2 ? c : darken(c, 0.1), { rot: a, gloss: 0.3 }); }
        for (const cx of [-0.05, 0.06]) blob(g, cx * u, u * 0.06, u * 0.06, u * 0.06, "#7A4B2C", { gloss: 0.4 });
        break;
      }
      case "umbrella": {
        g.strokeStyle = "#FFFFFF"; g.lineWidth = Math.max(1, u * 0.035); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.85); g.stroke();
        g.rotate(sway);
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, -u * 0.9); g.arc(0, -u * 0.62, u * 0.42, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI); g.closePath(); clayFill(g, i % 2 ? "#FFFFFF" : "#FF6F91", 0, -u * 0.8, u * 0.4, { gloss: 0.2 }); }
        break;
      }
      case "lolly":
        rr(g, -u * 0.025, -u * 0.8, u * 0.05, u * 0.8, u * 0.02); g.fillStyle = "#FFFFFF"; g.fill();
        g.translate(0, -u * 0.85); g.rotate(this.t * 0.6 + p.ph);
        blob(g, 0, 0, u * 0.25, u * 0.25, "#FF8FC2", { gloss: 0.45 });
        g.strokeStyle = "#FFFFFF"; g.lineWidth = u * 0.05; g.beginPath();
        for (let a = 0; a < Math.PI * 5; a += 0.3) { const rr2 = u * 0.22 * (a / (Math.PI * 5)); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
        g.stroke();
        break;
      case "gumdrop":
        g.beginPath(); g.moveTo(-u * 0.2, 0); g.quadraticCurveTo(-u * 0.22, -u * 0.36, 0, -u * 0.38); g.quadraticCurveTo(u * 0.22, -u * 0.36, u * 0.2, 0); g.closePath();
        clayFill(g, c, 0, -u * 0.18, u * 0.25, { gloss: 0.55 });
        g.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.sin(i * 2.3) * u * 0.12, -u * (0.08 + (i % 3) * 0.08), Math.max(0.6, u * 0.015), 0, Math.PI * 2); g.fill(); }
        break;
      case "cane":
        g.lineCap = "round"; g.lineWidth = Math.max(2, u * 0.1);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.7); g.arc(-u * 0.15, -u * 0.7, u * 0.15, 0, Math.PI, true);
        g.strokeStyle = "#FFFFFF"; g.stroke(); g.setLineDash([u * 0.08, u * 0.08]); g.strokeStyle = "#E8504F"; g.stroke(); g.setLineDash([]);
        break;
      case "pumpkin":
        for (const k of [-1, 1, 0]) blob(g, k * u * 0.12, -u * 0.16, u * 0.17, u * 0.16, k ? "#E57B1E" : "#FF8F2E", { gloss: 0.35 });
        rr(g, -u * 0.02, -u * 0.38, u * 0.04, u * 0.08, u * 0.02); g.fillStyle = "#4F7A2A"; g.fill();
        if (u > 18) { eye(g, -u * 0.07, -u * 0.2, u * 0.03, { blink: 0.9 }); eye(g, u * 0.07, -u * 0.2, u * 0.03, { blink: 0.9 }); mouth(g, 0, -u * 0.11, u * 0.08, "smile"); }
        break;
      case "snowman":
        blob(g, 0, -u * 0.18, u * 0.2, u * 0.18, "#FFFFFF", { gloss: 0.4 });
        blob(g, 0, -u * 0.47, u * 0.15, u * 0.14, "#FFFFFF", { gloss: 0.4 });
        blob(g, 0, -u * 0.7, u * 0.11, u * 0.1, "#FFFFFF", { gloss: 0.4 });
        rr(g, -u * 0.13, -u * 0.6, u * 0.26, u * 0.05, u * 0.02); g.fillStyle = "#E8504F"; g.fill();
        g.fillStyle = "#1B1420"; for (const ex of [-0.04, 0.04]) { g.beginPath(); g.arc(ex * u, -u * 0.72, Math.max(0.8, u * 0.015), 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#FF8A3D"; g.beginPath(); g.moveTo(0, -u * 0.69); g.lineTo(u * 0.1, -u * 0.67); g.lineTo(0, -u * 0.65); g.fill();
        break;
      case "lamp": {
        rr(g, -u * 0.03, -u * 1.1, u * 0.06, u * 1.1, u * 0.02); g.fillStyle = "#2A2550"; g.fill();
        const gl = g.createRadialGradient(0, -u * 1.15, 0, 0, -u * 1.15, u * 0.5); gl.addColorStop(0, "rgba(255,235,140,0.55)"); gl.addColorStop(1, "rgba(255,235,140,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, -u * 1.15, u * 0.5, 0, Math.PI * 2); g.fill();
        blob(g, 0, -u * 1.15, u * 0.09, u * 0.1, "#FFF1A8", { gloss: 0.6 });
        break;
      }
      case "kranky": {
        const url = spriteUrl("kranky", Math.sin(this.t * 2 + p.ph) > 0 ? "sad" : "happy");
        this.sprite(g, url, 0, -Math.abs(Math.sin(this.t * 5 + p.ph)) * u * 0.05, u * 0.55, { rot: Math.sin(this.t * 4 + p.ph) * 0.08, flip: p.side > 0 });
        break;
      }
      case "flag": {
        g.strokeStyle = "#FFFFFF"; g.lineWidth = Math.max(1, u * 0.03); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.75); g.stroke();
        g.beginPath(); g.moveTo(0, -u * 0.75); g.quadraticCurveTo(-p.side * u * 0.2, -u * 0.7 + Math.sin(this.t * 6 + p.ph) * u * 0.04, -p.side * u * 0.32, -u * 0.62); g.lineTo(0, -u * 0.5); g.closePath();
        clayFill(g, ["#FF6F91", "#FFD25A", "#2EC4B6", "#9B5DE5"][Math.abs(Math.round(p.ph)) % 4], 0, -u * 0.6, u * 0.2, { gloss: 0.3 });
        break;
      }
      case "arch": {
        const hw = this.lw * s * 1.75, hh = u * 1.45;
        for (const sx of [-1, 1]) { rr(g, sx * hw - u * 0.06, -hh, u * 0.12, hh, u * 0.04); clayFill(g, "#FFFFFF", sx * hw, -hh / 2, hh * 0.5, { gloss: 0.3 }); }
        const bw = hw * 2 + u * 0.3, bh = u * 0.3;
        rr(g, -bw / 2, -hh - bh * 0.6, bw, bh, bh * 0.3); clayFill(g, "#23305A", 0, -hh, bw * 0.4, { gloss: 0.2 });
        g.save(); rr(g, -bw / 2, -hh - bh * 0.6, bw, bh, bh * 0.3); g.clip();
        const sq = bh / 2;
        for (let i = 0; i * sq < bw; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) { g.fillStyle = "#FFFFFF"; g.fillRect(-bw / 2 + i * sq, -hh - bh * 0.6 + j * sq, sq, sq); }
        g.restore();
        clayText(g, "START", 0, -hh - bh * 1.15, Math.max(8, u * 0.32), { fill: "#FFD25A" });
        break;
      }
      case "sign": {
        rr(g, -u * 0.04, -u * 0.9, u * 0.08, u * 0.9, u * 0.03); clayFill(g, "#8B5A3C", 0, -u * 0.45, u * 0.4, { gloss: 0.2 });
        const tw = Math.max(20, u * 1.3), th = u * 0.36;
        g.translate(-tw * 0.3, -u * 1.0);
        rr(g, -tw / 2, -th / 2, tw, th, th * 0.3); clayFill(g, "#FFE7C2", 0, 0, tw * 0.5, { gloss: 0.3 });
        rr(g, -tw / 2, -th / 2, tw, th, th * 0.3); g.strokeStyle = "#8B5A3C"; g.lineWidth = Math.max(1, u * 0.03); g.stroke();
        if (u > 10) clayText(g, p.text ?? "", 0, 0, Math.max(6, Math.min(th * 0.5, (tw * 1.6) / Math.max(6, (p.text ?? "").length))), { fill: "#FF8A3D", stroke: "#5A3A22", gloss: false });
        break;
      }
      default: break;
    }
    g.restore();
  }

  // ------------------------------------------------------------ drawing: Turbo
  /** Turbo from behind: slimy foot, rocket shell with twin boosters, eye stalks peeking over the top. */
  private drawTurboBack(g: G, S: number, flame: number, boosting: boolean, look: number) {
    const wob = Math.sin(this.t * 18) * 0.03 * Math.min(1, this.spd / 10);
    blob(g, 0, -S * 0.12, S * 0.46, S * 0.15, BODY, { gloss: 0.3, wobble: 0.03, t: this.t });
    // eye stalks
    for (const sd of [-1, 1]) {
      const bx = sd * S * 0.12, by = -S * 0.42, tx = sd * S * 0.27 + look * S * 0.08 + Math.sin(this.t * 6 + sd) * S * 0.02, ty = -S * 1.0 + wob * S;
      g.lineCap = "round";
      g.strokeStyle = darken(BODY, 0.3); g.lineWidth = S * 0.085; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(sd * S * 0.16, -S * 0.75, tx, ty); g.stroke();
      g.strokeStyle = BODY; g.lineWidth = S * 0.06; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(sd * S * 0.16, -S * 0.75, tx, ty); g.stroke();
      eye(g, tx, ty - S * 0.04, S * 0.1, { look: [look * 0.8, 0.2], blink: Math.sin(this.t * 0.9 + sd * 0.2) > 0.985 ? 1 : 0 });
    }
    // shell
    blob(g, 0, -S * 0.5, S * 0.37, S * 0.36, SHELL, { gloss: 0.45 });
    g.strokeStyle = "#FFF1DC"; g.lineWidth = S * 0.055; g.lineCap = "round"; g.beginPath();
    for (let a = 0; a < Math.PI * 4.2; a += 0.2) { const r = S * 0.3 * (1 - a / (Math.PI * 4.6)); g.lineTo(Math.cos(a + 1.2) * r, -S * 0.5 + Math.sin(a + 1.2) * r); }
    g.stroke();
    // fin
    g.beginPath(); g.moveTo(-S * 0.08, -S * 0.82); g.quadraticCurveTo(0, -S * 1.04, S * 0.08, -S * 0.82); g.closePath(); clayFill(g, "#E8504F", 0, -S * 0.88, S * 0.1);
    // boosters (end-on)
    for (const sd of [-1, 1]) {
      const bx = sd * S * 0.24, by = -S * 0.27;
      blob(g, bx, by, S * 0.12, S * 0.11, METAL, { gloss: 0.5 });
      g.fillStyle = "#1E1838"; g.beginPath(); g.ellipse(bx, by + S * 0.01, S * 0.07, S * 0.06, 0, 0, Math.PI * 2); g.fill();
      const glow = g.createRadialGradient(bx, by, 0, bx, by, S * 0.07); glow.addColorStop(0, boosting ? "#E8FDFF" : "#FFF4B0"); glow.addColorStop(1, boosting ? "rgba(124,242,255,0.2)" : "rgba(255,140,40,0.3)");
      g.fillStyle = glow; g.beginPath(); g.ellipse(bx, by + S * 0.01, S * 0.065, S * 0.055, 0, 0, Math.PI * 2); g.fill();
    }
    // flames toward the camera
    if (flame > 0.02) for (const sd of [-1, 1]) {
      const bx = sd * S * 0.24, by = -S * 0.25, f = flame * (0.85 + Math.random() * 0.3);
      const len = S * (0.18 + 0.32 * f) * (boosting ? 1.6 : 1), wd = S * 0.085 * (boosting ? 1.3 : 1);
      const outer = boosting ? "#5BC0FF" : "#FF8A3D", inner = boosting ? "#C9F6FF" : "#FFE15A";
      g.save(); g.globalAlpha *= 0.95;
      g.beginPath(); g.moveTo(bx - wd, by); g.quadraticCurveTo(bx - wd * 0.8, by + len * 0.6, bx + sd * S * 0.02, by + len); g.quadraticCurveTo(bx + wd * 0.8, by + len * 0.6, bx + wd, by); g.closePath();
      g.fillStyle = outer; g.fill();
      g.beginPath(); g.moveTo(bx - wd * 0.5, by); g.quadraticCurveTo(bx - wd * 0.4, by + len * 0.4, bx, by + len * 0.62); g.quadraticCurveTo(bx + wd * 0.4, by + len * 0.4, bx + wd * 0.5, by); g.closePath();
      g.fillStyle = inner; g.fill();
      g.restore();
    }
  }

  /** Turbo facing us (used before GO and after the crash): the rendered sprite, or a clay snail fallback. */
  private drawTurboFront(g: G, S: number, mood: Mood) {
    const url = this.host(mood), im = this.img(url);
    if (im?.naturalWidth) { this.sprite(g, url, 0, S * 0.04, S * 1.35); return; }
    blob(g, S * 0.18, -S * 0.52, S * 0.36, S * 0.35, SHELL, { gloss: 0.45 });
    g.strokeStyle = "#FFF1DC"; g.lineWidth = S * 0.055; g.lineCap = "round"; g.beginPath();
    for (let a = 0; a < Math.PI * 4.2; a += 0.2) { const r = S * 0.28 * (1 - a / (Math.PI * 4.6)); g.lineTo(S * 0.18 + Math.cos(a) * r, -S * 0.52 + Math.sin(a) * r); }
    g.stroke();
    blob(g, S * 0.48, -S * 0.42, S * 0.1, S * 0.16, METAL, { gloss: 0.5 });
    blob(g, 0, -S * 0.1, S * 0.48, S * 0.13, BODY, { gloss: 0.3 });
    blob(g, -S * 0.12, -S * 0.36, S * 0.22, S * 0.3, BODY, { gloss: 0.4 });
    for (const sd of [-1, 1]) {
      const tx = -S * 0.12 + sd * S * 0.13, ty = -S * 0.9;
      g.strokeStyle = BODY; g.lineWidth = S * 0.06; g.lineCap = "round"; g.beginPath(); g.moveTo(-S * 0.12 + sd * S * 0.06, -S * 0.58); g.lineTo(tx, ty); g.stroke();
      eye(g, tx, ty, S * 0.1, { look: [0, 0.2], pupil: mood === "wow" ? 0.35 : 0.55 });
    }
    mouth(g, -S * 0.12, -S * 0.3, S * 0.16, mood === "sad" ? "frown" : mood === "wow" ? "oh" : "grin");
    cheeks(g, -S * 0.12, -S * 0.36, S * 0.13, S * 0.04);
  }

  private drawTurbo(g: G) {
    const S = this.S, x = this.xOf(this.pl.x, 1), y = this.lay.py;
    const hop = Math.sin(this.pl.hop * Math.PI) * S * 0.35;
    const bounce = this.phase === "race" ? Math.abs(Math.sin(this.t * 14)) * S * 0.02 * Math.min(1, this.spd / 8) : 0;
    shadow(g, x, y + 2, S * 0.52 * (1 - hop / (S * 1.2)), S * 0.12, 0.35);
    // boost aura
    if (this.boost > 0) {
      const gl = g.createRadialGradient(x, y - S * 0.5, S * 0.2, x, y - S * 0.5, S * 1.1);
      gl.addColorStop(0, "rgba(124,242,255,0.45)"); gl.addColorStop(1, "rgba(124,242,255,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - S * 0.5, S * 1.1, 0, Math.PI * 2); g.fill();
    }
    g.save();
    if (this.invuln > 0 && this.boost <= 0 && Math.sin(this.t * 30) > 0.2) g.globalAlpha = 0.45;
    g.translate(x, y - hop - bounce);
    const steerTilt = clamp((this.lane - 1 - this.pl.x) * 0.35, -0.3, 0.3);
    const spin = this.pl.spin > 0 ? Math.sin(this.pl.spin * Math.PI * 4) * 0.45 * this.pl.spin : 0;
    g.rotate(steerTilt + spin);
    const turnScale = Math.abs(1 - 2 * this.pl.turn);
    const sq = this.pl.sq;
    g.scale((1 + sq * 0.14) * Math.max(0.06, turnScale), 1 - sq * 0.12);
    if (this.splash > 0) g.translate(0, Math.sin(this.t * 20) * S * 0.04);
    if (this.pl.turn >= 0.5) {
      const flame = this.phase === "race" ? clamp(0.35 + this.spd / 22, 0, 1.2) : 0.15 + 0.1 * Math.sin(this.t * 20);
      this.drawTurboBack(g, S, flame, this.boost > 0, clamp((this.lane - 1 - this.pl.x) * 2, -1, 1));
    } else this.drawTurboFront(g, S, this.phase === "crash" ? "sad" : this.hud.host.mood === "sad" ? "sad" : "happy");
    g.restore();
    // dizzy stars after a bump / crash
    if ((this.pl.spin > 0 || this.phase === "crash") && this.hud.status !== "lobby") {
      for (let i = 0; i < 3; i++) { const a = this.t * 5 + (i / 3) * Math.PI * 2; star(g, x + Math.cos(a) * S * 0.35, y - S * 1.12 - hop + Math.sin(a) * S * 0.08, S * 0.07, "#FFD25A", a); }
    }
  }

  // ------------------------------------------------------------ drawing: overlay
  private drawLines(g: G) {
    const k = this.lineAmt();
    if (k <= 0.01) return;
    const vx = this.xOf(0, 0.02), vy = this.lay.hy, R = Math.hypot(this.W, this.H);
    g.save(); g.lineCap = "round";
    for (const l of this.lines) {
      const r0 = R * (0.25 + l.r * 0.7), r1 = r0 + R * 0.08 * (0.5 + k);
      g.strokeStyle = this.boost > 0 ? `rgba(160,245,255,${0.55 * k * (1 - l.r)})` : `rgba(255,255,255,${0.45 * k * (1 - l.r)})`;
      g.lineWidth = 2 + l.v * 2;
      g.beginPath(); g.moveTo(vx + Math.cos(l.a) * r0, vy + Math.sin(l.a) * r0 * 0.75); g.lineTo(vx + Math.cos(l.a) * r1, vy + Math.sin(l.a) * r1 * 0.75); g.stroke();
    }
    g.restore();
    if (this.boost > 0) {
      const v = g.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, R * 0.6);
      v.addColorStop(0, "rgba(124,242,255,0)"); v.addColorStop(1, `rgba(124,242,255,${0.25 + 0.1 * Math.sin(this.t * 12)})`);
      g.fillStyle = v; g.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawUi(g: G) {
    const A = this.area;
    // distance pill
    const txt = `${Math.floor(this.dist)} m`;
    g.font = `18px "Lilita One", system-ui, sans-serif`;
    const w = g.measureText(txt).width + 44;
    rr(g, 10, A.y + 6, w, 32, 16); g.fillStyle = "rgba(35,48,90,0.72)"; g.fill();
    star(g, 27, A.y + 22, 9, "#FFD25A", 0.2);
    clayText(g, txt, 10 + 26 + (w - 30) / 2, A.y + 23, 18, { fill: "#FFFFFF", gloss: false });
    if (this.boost > 0) {
      const bx = 10 + w + 8;
      rr(g, bx, A.y + 6, 92, 32, 16); g.fillStyle = "rgba(20,120,160,0.8)"; g.fill();
      rr(g, bx + 6, A.y + 27, 80 * (this.boost / 3.3), 6, 3); g.fillStyle = "#7CF2FF"; g.fill();
      clayText(g, "BOOST!", bx + 46, A.y + 18, 15, { fill: "#FFFFFF", gloss: false });
    }
    // tap-zone arrows
    if (this.phase === "crash") return;
    const y = Math.min(this.H - this.insetBottom - 34, this.lay.py + this.S * 0.62), r = 26;
    for (const [sd, pr] of [[-1, this.press.l], [1, this.press.r]] as const) {
      const x = sd < 0 ? 18 + r : this.W - 18 - r;
      const intro = clamp(1 - (this.dist - 60) / 120, 0, 1);
      g.save(); g.globalAlpha = 0.28 + intro * 0.35 + pr * 0.4;
      g.translate(x, y); g.scale(1 - pr * 0.12, 1 - pr * 0.12);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = "rgba(35,48,90,0.8)"; g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(sd * 10, 0); g.lineTo(-sd * 6, -11); g.lineTo(-sd * 6, 11); g.closePath(); g.fill();
      g.restore();
    }
  }

  private drawScene(g: G, live: boolean) {
    this.drawSky(g);
    this.drawGround(g);
    for (const o of this.objs) if ((o.kind === "river" || o.kind === "puddle") && o.fly === 0) { const d = o.at - this.dist; if (d < SPAWN && d > -D * 0.7) this.drawFlat(g, o, d); }
    const items: { d: number; o?: Obj; p?: Prop }[] = [];
    for (const o of this.objs) if (o.kind !== "river" && o.kind !== "puddle") { const d = o.at - this.dist; if (d < SPAWN && d > -D * 0.7) items.push({ d, o }); }
    for (const p of this.props) { const d = p.at - this.dist; if (d < SPAWN + 2 && d > -D * 0.7) items.push({ d, p }); }
    items.sort((a, b) => b.d - a.d);
    let drawn = false;
    for (const it of items) {
      if (!drawn && it.d < 0.2) { this.drawTurbo(g); drawn = true; }
      if (it.o) this.drawObj(g, it.o, it.d); else if (it.p) this.drawProp(g, it.p, it.d);
    }
    if (!drawn) this.drawTurbo(g);
    this.drawLines(g);
    if (live) this.drawUi(g);
  }

  protected drawBackground(g: G) {
    this.size = { w: this.W, h: this.H }; this.layout(true);
    this.objs = [];
    this.phase = "race"; this.pl.turn = 1; this.boost = 0; this.invuln = 0; this.pl.spin = 0;
    this.spd = 8; this.dist = this.t * 8;
    this.bend = Math.sin(this.dist * 0.008) * 0.42 + Math.sin(this.dist * 0.021 + 1) * 0.18;
    this.pl.x = 0; this.lane = 1;
    while (this.propAt < this.dist + SPAWN + 24) this.planProp();
    this.props = this.props.filter((p) => p.at - this.dist > -D * 0.7);
    this.drawScene(g, false);
  }

  protected draw(g: G) { this.drawScene(g, true); }
}
