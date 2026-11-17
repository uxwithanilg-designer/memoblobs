// Pattern Parade — Prof. Hoot's marching band. A parade of clay critters marches in following a pattern and
// the line ends with a "?" float: pick what comes next. Rule ladder (gradual): AB → ABC → AAB/ABB → counting
// up → turning arrows → colour + shape together → mixed rules → skip counting. ~8 prompts per level with a
// timer; Hoot drums along… and dozes off if you take too long.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, ramp, type GameMeta, type Mood } from "../engine";
import { FONT, NAVY, blob, clayFill, clayPanel, clayText, darken, eye, mouth, rr, shadow, star, type G } from "../paint";

type Rule = "ab" | "abc" | "aab" | "grow" | "rot" | "dual" | "mixed" | "skip";
const LADDER: Rule[] = ["ab", "abc", "aab", "grow", "rot", "dual", "mixed", "skip"];
const UNLOCK: Record<"easy" | "medium" | "hard", number[]> = {
  easy: [1, 5, 7, 9, 11, 13, 16, 19], medium: [1, 2, 3, 5, 7, 9, 11, 13], hard: [1, 1, 1, 2, 3, 4, 6, 8],
};
const RULE_NAME: Record<Rule, [string, string]> = {
  ab: ["AB PATTERNS", "A, B, A, B…"], abc: ["ABC PATTERNS", "Three in a row repeat"], aab: ["DOUBLES!", "A A B or A B B"],
  grow: ["COUNTING UP!", "Count the dots"], rot: ["TURNING ARROWS!", "Which way next?"], dual: ["TWO AT ONCE!", "Colours AND shapes change"],
  mixed: ["MIXED RULES!", "Two rules together"], skip: ["SKIP COUNTING!", "2, 4, 6…"],
};
const COLORS = ["#E8504F", "#FFC93C", "#2FA866", "#3B82F6", "#9B5DE5", "#FF6F91"];
const NSH = 6; // circle, square, triangle, star, heart, diamond
interface Tok { kind: "plain" | "dots" | "arrow" | "num"; sh: number; c: number; v: number }
interface Opt { t: Tok; x: number; y: number; r: number; state: "idle" | "right" | "wrong"; press: number; pop: number; glow: number; wig: number }
type Phase = "in" | "play" | "reveal" | "out" | "done";

const P = (o: Partial<Tok>): Tok => ({ kind: "plain", sh: 0, c: 0, v: 0, ...o });
const same = (a: Tok, b: Tok) => a.kind === b.kind && a.sh === b.sh && a.c === b.c && a.v === b.v;

export default class PatternParade extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "pattern-parade", title: "Pattern Parade", host: "hoot", style: "rounds",
    music: { calm: "a:parade_calm", action: "a:parade_action" },
    sounds: ["a:whistle", "a:snore", "a:cheer", "a:honk", "a:buzz", "a:tickHi", "a:kazoo", "a:gong", "drumroll", "pop"],
    voicePitch: 1.0, transition: "curtain",
  };
  private seq: Tok[] = [];
  private ans: Tok = P({});
  private opts: Opt[] = [];
  private rule: Rule = "ab";
  private hintTxt = "";
  private list: Rule[] = [];
  private pi = 0; private prompts = 8;
  private phase: Phase = "in";
  private tTot = 12; private tLeft = 12; private tPrompt = 12; private lastTick = 0; private snored = false;
  private mistakes = 0; private allowed = 3;
  private results: (boolean | null)[] = [];
  private march = { off: 1 };
  private flip = { v: 0 };
  private slots: { x: number; y: number }[] = [];
  private lanes: number[] = [0];
  private S = 30;
  private hoot = { x: 0, y: 0, h: 120, bop: 0, wake: 0 };
  private tray = { x: 0, y: 0, w: 100, h: 100 };
  private cheer = 0; private lastBeat = 0;
  private recent = new Recent(30);
  private ruleBag = new Bag<Rule>(["ab"]);

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private portrait() { return this.W < this.H * 1.05; }

  private layout() {
    const A = this.area, W = this.W;
    const total = (this.seq.length || 6) + 1;
    if (this.portrait()) {
      const pitH = clamp(A.h * 0.22, 140, 180), top = A.y, ph = A.h - pitH;
      this.lanes = [top + ph * 0.42, top + ph * 0.96];
      const per = Math.ceil(total / 2), sp = Math.min((W - 36) / per, 120);
      this.S = clamp(Math.min(sp * 0.36, ph * 0.13), 18, 44);
      // Hoot drums on the sidewalk between the two roads
      const gapTop = this.lanes[0] + this.S * 0.55 + 10, gapBot = this.lanes[1] - this.S * 1.25 - 14;
      this.hoot = { ...this.hoot, h: clamp((gapBot - gapTop) * 0.85, 80, 135), x: 0, y: gapBot - this.S * 0.3 };
      this.hoot.x = this.hoot.h * 0.5 + 12;
      this.tray = { x: 10, y: A.y + A.h - pitH + 10, w: W - 20, h: pitH - 12 };
      this.slots = [];
      for (let i = 0; i < total; i++) {
        const row = i < per ? 0 : 1, k = row ? i - per : i;
        this.slots.push({ x: W / 2 + 6 + (k - (per - 1) / 2) * sp, y: this.lanes[row] - this.S * 1.05 });
      }
    } else {
      const pitH = clamp(A.h * 0.25, 130, 175), ph = A.h - pitH;
      this.lanes = [A.y + ph * 0.86];
      this.hoot = { ...this.hoot, h: clamp(ph * 0.5, 110, 220), x: 0, y: this.lanes[0] + 4 };
      this.hoot.x = this.hoot.h * 0.45 + 24;
      const tw = Math.min(W * 0.62, 640);
      this.tray = { x: W / 2 - tw / 2, y: A.y + A.h - pitH + 10, w: tw, h: pitH - 14 };
      const x0 = this.hoot.x + this.hoot.h * 0.55, x1 = W - 24, sp = Math.min((x1 - x0) / total, 150);
      this.S = clamp(Math.min(sp * 0.36, ph * 0.16), 20, 54);
      this.slots = Array.from({ length: total }, (_, i) => ({ x: x0 + sp * (i + 0.5), y: this.lanes[0] - this.S * 1.05 }));
    }
    this.layoutOpts();
  }

  private layoutOpts() {
    const T = this.tray, n = this.opts.length;
    if (!n) return;
    const top = T.y + 26, h = T.h - 30;
    const rows = this.portrait() && n === 4 && T.w < 330 ? 2 : 1, cols = Math.ceil(n / rows);
    const r = Math.max(24, Math.min(46, (T.w - 16) / cols / 2 - 8, h / rows / 2 - 6));
    const sp = (T.w - 12) / cols, rh = h / rows;
    this.opts.forEach((o, i) => { const row = Math.floor(i / cols), col = i % cols; o.x = T.x + 6 + sp * (col + 0.5); o.y = top + rh * (row + 0.5); o.r = r; });
  }

  // ------------------------------------------------------------ levels
  private unlocked(L: number) { return LADDER.filter((_, i) => UNLOCK[this.diff][i] <= L); }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const un = this.unlocked(L);
    const newest = LADDER.find((_, i) => UNLOCK[d][i] === L && L > 1) ?? null;
    this.prompts = d === "easy" && L <= 2 ? 6 : 8;
    // this level's rounds: the newest rule a few times, the rest from a no-repeat bag of unlocked rules
    this.ruleBag = new Bag<Rule>(un.length > 3 ? un.slice(-4) : un);
    const list: Rule[] = [];
    if (newest) list.push(newest, newest, newest);
    while (list.length < this.prompts) list.push(this.ruleBag.next(this.rng));
    this.list = newest ? [list[3] ?? list[0], ...this.rng.shuffle(list.filter((_, i) => i !== 3))] : this.rng.shuffle(list);
    this.tTot = byDiff(d, { easy: ramp(L, 15, -0.4, 8), medium: ramp(L, 13, -0.4, 7), hard: ramp(L, 11, -0.35, 6) });
    this.allowed = byDiff(d, { easy: 3, medium: 2, hard: 2 });
    this.pi = 0; this.mistakes = 0; this.results = new Array(this.prompts).fill(null);
    this.opts = []; this.seq = []; this.march.off = 1;
    this.layout();
    let wait = 1.4;
    if (newest && this.attempt === 0) {
      const [t, s] = RULE_NAME[newest];
      this.after(0.5, () => { this.banner(`NEW: ${t}`, s, "mint"); this.react("wow", "Hoo! A new kind of pattern!"); this.sfx("a:gong", { gain: 0.45 }); });
      wait = 2.4;
    } else this.react("happy", this.rng.pick(["Hoo-hoo! Parade time!", "Watch the pattern march!", "Left, right, left… what's next?", "Strike up the band!"]));
    this.music(L >= byDiff(d, { easy: 9, medium: 5, hard: 2 }) ? "action" : "calm");
    this.hint("What comes next in the parade? 🥁");
    this.after(wait, () => this.newPrompt());
  }

  private visLen(rule: Rule) {
    const cap = this.portrait() ? 7 : 8, r = this.rng;
    const v = rule === "ab" ? r.int(4, 6) : rule === "abc" || rule === "aab" ? r.int(6, 7) : rule === "grow" || rule === "skip" ? r.int(4, 5) : rule === "rot" ? r.int(5, 6) : r.int(6, 7);
    return Math.min(cap, v);
  }

  private newPrompt() {
    if (this.pi >= this.prompts) { this.finish(); return; }
    const rule = this.list[this.pi] ?? "ab";
    let g = this.gen(rule);
    for (let tries = 0; tries < 20; tries++) {
      const sig = rule + "|" + g.seq.map((t) => `${t.kind}${t.sh}${t.c}${t.v}`).join(",");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
      g = this.gen(rule);
    }
    this.rule = rule; this.seq = g.seq; this.ans = g.ans;
    const nOpt = byDiff(this.diff, { easy: 3, medium: this.level < 6 ? 3 : 4, hard: 4 });
    const wrong: Tok[] = [];
    for (const w of g.wrong) if (wrong.length < nOpt - 1 && !same(w, g.ans) && !wrong.some((x) => same(x, w))) wrong.push(w);
    for (let k = 0; wrong.length < nOpt - 1 && k < 40; k++) {
      const w = { ...g.ans, c: g.ans.kind === "num" ? g.ans.c : this.rng.int(0, 5), sh: g.ans.kind === "plain" ? this.rng.int(0, NSH - 1) : g.ans.sh };
      if (!same(w, g.ans) && !wrong.some((x) => same(x, w))) wrong.push(w);
    }
    this.opts = this.rng.shuffle([g.ans, ...wrong]).map((t) => ({ t, x: 0, y: 0, r: 30, state: "idle" as const, press: 0, pop: 0, glow: 0, wig: 0 }));
    this.hintTxt = g.hint;
    this.flip.v = 0;
    this.layout();
    // the parade marches in from the right
    this.phase = "in"; this.march.off = 1;
    this.tween(this.march, { off: 0 }, 1.5, ease.out);
    this.sfx("drumroll", { gain: 0.3 });
    this.after(1.45, () => {
      this.phase = "play"; this.snored = false; this.lastTick = 99;
      this.tPrompt = this.tTot * (1 - this.pi * 0.025) + this.seq.length * 0.2; this.tLeft = this.tPrompt;
      this.opts.forEach((o, i) => this.tween(o, { pop: 1 }, 0.35, ease.back, i * 0.06));
      this.sfx("pop", { gain: 0.3 });
      this.hint(this.hintTxt);
    });
  }

  // ------------------------------------------------------------ pattern generators
  private gen(rule: Rule): { seq: Tok[]; ans: Tok; wrong: Tok[]; hint: string } {
    const r = this.rng, n = this.visLen(rule), L = this.level, d = this.diff;
    const cols = r.shuffle([...Array(6).keys()]), shs = r.shuffle([...Array(NSH).keys()]);
    if (rule === "ab" || rule === "abc" || rule === "aab") {
      const mode = d === "easy" && L <= 2 ? "color" : d === "easy" && L <= 4 ? r.pick(["color", "shape"]) : r.pick(["color", "shape", "both"]);
      const m = rule === "abc" ? 3 : 2;
      const E = Array.from({ length: m + 1 }, (_, j) => P({ sh: mode === "color" ? shs[0] : shs[j], c: mode === "shape" ? cols[0] : cols[j] }));
      const pat = rule === "ab" ? [0, 1] : rule === "abc" ? [0, 1, 2] : r.chance(0.5) ? [0, 0, 1] : [0, 1, 1];
      const seq = Array.from({ length: n }, (_, i) => E[pat[i % pat.length]]), ans = E[pat[n % pat.length]];
      const wrong = [...E.filter((e) => !same(e, ans))];
      if (mode === "both") { const o = E.find((e) => !same(e, ans) && e !== E[m])!; wrong.unshift(P({ sh: ans.sh, c: o.c }), P({ sh: o.sh, c: ans.c })); }
      r.shuffle(wrong);
      wrong.sort((a, b) => Number(E.indexOf(b) < m) - Number(E.indexOf(a) < m));
      return { seq, ans, wrong, hint: "What comes next? 🥁" };
    }
    if (rule === "grow" || (rule === "mixed" && r.chance(0.33))) {
      const start = d === "easy" ? 1 : r.int(1, 2), len = Math.min(n, 7 - start);
      const mixed = rule === "mixed", sh = r.pick([0, 1, 4]), c2 = [cols[0], cols[1]];
      const tok = (i: number) => P({ kind: "dots", sh, c: mixed ? c2[i % 2] : cols[0], v: start + i });
      const seq = Array.from({ length: len }, (_, i) => tok(i)), ans = tok(len);
      const wrong = [P({ ...ans, v: ans.v - 1 }), P({ ...ans, v: ans.v + 1 }), P({ ...ans, v: ans.v + 2 })];
      if (mixed) wrong.unshift(P({ ...ans, c: c2[(len + 1) % 2] }));
      return { seq, ans, wrong, hint: mixed ? "Count the dots AND watch the colours! 🤔" : "Count the dots! What comes next? 🔢" };
    }
    if (rule === "rot" || (rule === "mixed" && r.chance(0.5))) {
      const d0 = r.int(0, 3), stp = d === "hard" && r.chance(0.4) ? -1 : 1, mixed = rule === "mixed";
      const c3 = [cols[0], cols[1], cols[2]];
      const tok = (i: number) => P({ kind: "arrow", sh: 0, c: mixed ? c3[i % 3] : cols[0], v: (((d0 + i * stp) % 4) + 4) % 4 });
      const seq = Array.from({ length: n }, (_, i) => tok(i)), ans = tok(n);
      const wrong = [1, 2, 3].map((k) => P({ ...ans, v: (ans.v + k) % 4 }));
      if (mixed) wrong.unshift(P({ ...ans, c: c3[(n + 1) % 3] }), P({ ...ans, c: c3[(n + 2) % 3] }));
      return { seq, ans, wrong, hint: mixed ? "The arrow turns AND the colour changes! 🔄" : "Which way will the arrow point? 🔄" };
    }
    if (rule === "dual" || rule === "mixed") {
      const C = [cols[0], cols[1]], Sp = rule === "dual" ? [shs[0], shs[1], shs[2]] : r.chance(0.5) ? [shs[0], shs[1], shs[1]] : [shs[0], shs[0], shs[1]];
      const tok = (i: number) => P({ sh: Sp[i % 3], c: C[i % 2] });
      const seq = Array.from({ length: n }, (_, i) => tok(i)), ans = tok(n);
      const oc = C[(n + 1) % 2], osh = Sp.find((s) => s !== ans.sh) ?? shs[3];
      const wrong = [P({ sh: ans.sh, c: oc }), P({ sh: osh, c: ans.c }), P({ sh: osh, c: oc }), P({ sh: shs[3], c: ans.c })];
      return { seq, ans, wrong, hint: "Watch the colours AND the shapes! 🎨" };
    }
    // skip counting
    const steps = byDiff(d, { easy: [2, 10], medium: [2, 5, 10], hard: L >= 12 ? [2, 3, 4, 5, 10] : [2, 3, 5, 10] });
    const step = r.pick(steps), down = d === "hard" && L >= 12 && r.chance(0.35);
    const len = Math.min(n, 5);
    const start = down ? step * r.int(len + 1, len + 4) : step * r.int(0, 2) + (step === 10 || r.chance(0.6) ? step : 0);
    const c2 = [cols[0], cols[1]];
    const tok = (i: number) => P({ kind: "num", c: c2[i % 2], v: start + (down ? -1 : 1) * step * i });
    const seq = Array.from({ length: len }, (_, i) => tok(i)), ans = tok(len);
    const wrong = [ans.v + 1, ans.v - 1, ans.v + (down ? -step : step), seq[len - 1].v, ans.v + 2].filter((v) => v >= 0 && v !== ans.v).map((v) => P({ ...ans, v }));
    return { seq, ans, wrong: r.shuffle(wrong), hint: d === "hard" ? "What number comes next? 🔢" : `Count by ${step}s! What's next? 🔢` };
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = Number(key) - 1;
    if (this.phase === "play" && k >= 0 && k < this.opts.length) this.pick(this.opts[k]);
  }

  protected onDown(x: number, y: number) {
    if (this.phase !== "play") return;
    const o = this.opts.find((o) => Math.hypot(x - o.x, y - o.y) <= o.r + 10);
    if (o) this.pick(o);
  }

  private pick(o: Opt) {
    if (this.phase !== "play" || o.state !== "idle") return;
    o.press = 1; this.tween(o, { press: 0 }, 0.25);
    const q = this.slots[this.seq.length];
    this.wakeUp();
    if (same(o.t, this.ans)) {
      o.state = "right"; this.results[this.pi] = true;
      this.phase = "reveal"; this.timerBar(null);
      this.good(q.x, q.y - this.S, 80, clamp(this.tLeft / this.tPrompt, 0, 1));
      this.sfx("a:whistle", { gain: 0.5, delay: 0.1 });
      this.tween(this.flip, { v: 1 }, 0.4, ease.inOut);
      this.burst(q.x, q.y, { n: 18, colors: ["#FFD25A", "#FF6F91", "#2EC4B6", "#FFFFFF"], kind: "conf", speed: 260, size: 7 });
      this.cheer = 1;
      if (this.pi % 3 === 2) this.react("happy", this.rng.pick(["Hoo-ray! Smart cookie!", "Pattern pro!", "Marvellous marching!", "Top of the class!"]), false);
      this.after(1.1, () => this.marchOut());
    } else {
      o.state = "wrong"; o.wig = 1; this.mistakes++; this.results[this.pi] = false;
      this.phase = "reveal"; this.timerBar(null);
      this.sfx("a:honk", { gain: 0.45, delay: 0.1 });
      this.bad(o.x, o.y, { line: this.rng.pick(["Hoo-hum, not quite!", "Out of step!", "Wrong note!", "Hmm, look again!"]) });
      this.after(0.5, () => { this.showAnswer(); });
      this.after(2.0, () => this.marchOut());
    }
  }

  private showAnswer() {
    for (const op of this.opts) if (same(op.t, this.ans)) op.glow = 1;
    this.tween(this.flip, { v: 1 }, 0.4, ease.inOut);
    this.hint("This one comes next! 👀");
  }

  private timeout() {
    this.phase = "reveal"; this.timerBar(null);
    this.mistakes++; this.results[this.pi] = false;
    this.combo = 0; this.setHud({ combo: 0, mult: 1 });
    this.sfx("a:buzz", { gain: 0.5 });
    this.react("sad", "Zzz… oh! Too slow!");
    this.wakeUp();
    this.showAnswer();
    this.after(2.0, () => this.marchOut());
  }

  private wakeUp() { this.hoot.wake = 1; this.hoot.bop = 1; }

  private marchOut() {
    this.phase = "out";
    for (const o of this.opts) this.tween(o, { pop: 0 }, 0.2, ease.in);
    this.tween(this.march, { off: -1 }, 1.0, ease.in);
    this.pi++;
    if (this.mistakes > this.allowed) { this.after(0.6, () => { this.phase = "done"; this.levelFail("The band lost the beat!"); }); return; }
    this.after(1.05, () => this.newPrompt());
  }

  private finish() {
    this.phase = "done"; this.hint(null);
    this.sfx("a:cheer", { gain: 0.55 });
    this.sfx("a:kazoo", { gain: 0.45, delay: 0.3 });
    this.cheer = 1.5;
    this.levelClear({ perfect: this.mistakes === 0, title: this.mistakes === 0 ? "PERFECT PARADE!" : "PARADE COMPLETE!" });
    this.react("happy", this.rng.pick(["Hoo-hoo-hooray!", "What a parade!", "Brilliant, my student!", "Encore, encore!"]), false);
  }

  protected update(dt: number) {
    this.hoot.bop = Math.max(0, this.hoot.bop - dt * 3);
    this.hoot.wake = Math.max(0, this.hoot.wake - dt * 1.2);
    this.cheer = Math.max(0, this.cheer - dt * 0.6);
    for (const o of this.opts) o.wig = Math.max(0, o.wig - dt * 2);
    // drum beat while the band marches
    const beat = Math.floor(this.t / 0.5);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      if (this.phase === "in" || this.phase === "out") { this.tone(beat % 2 ? 98 : 82, 0.09, this.hoot.x, 0.4); this.hoot.bop = 1; }
      else if (this.phase === "play" && this.drowsy() < 0.2) this.hoot.bop = 0.6;
    }
    if (this.phase === "play") {
      this.tLeft -= dt;
      const u = this.tLeft / this.tPrompt;
      this.timerBar(u, u > 0.5 ? "#7CF2C9" : u > 0.25 ? "#FFD25A" : "#FF6F91");
      if (!this.snored && u < 0.35) { this.snored = true; this.sfx("a:snore", { gain: 0.55 }); }
      const sec = Math.ceil(this.tLeft);
      if (sec <= 3 && sec !== this.lastTick && this.tLeft > 0) { this.lastTick = sec; this.sfx("a:tickHi", { gain: 0.3 }); }
      if (this.tLeft <= 0) this.timeout();
    }
  }

  /** 0 = wide awake … 1 = snoring (Hoot dozes off when you take a while) */
  private drowsy() { return this.phase === "play" ? clamp((1 - this.tLeft / this.tPrompt - 0.4) / 0.3, 0, 1) : 0; }

  // ------------------------------------------------------------ drawing
  private shapePath(g: G, sh: number, s: number) {
    g.beginPath();
    switch (sh) {
      case 0: g.arc(0, 0, s, 0, Math.PI * 2); break;
      case 1: g.roundRect(-s * 0.88, -s * 0.88, s * 1.76, s * 1.76, s * 0.3); break;
      case 2: g.moveTo(0, -s * 1.05); g.quadraticCurveTo(s * 0.12, -s * 1.08, s * 0.2, -s * 0.9); g.lineTo(s * 1.0, s * 0.62); g.quadraticCurveTo(s * 1.04, s * 0.82, s * 0.82, s * 0.82); g.lineTo(-s * 0.82, s * 0.82); g.quadraticCurveTo(-s * 1.04, s * 0.82, -s * 1.0, s * 0.62); g.lineTo(-s * 0.2, -s * 0.9); g.quadraticCurveTo(-s * 0.12, -s * 1.08, 0, -s * 1.05); break;
      case 3: for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr2 = i % 2 ? s * 0.55 : s * 1.12; if (i === 0) g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2 + s * 0.06); else g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 + s * 0.06); } g.closePath(); break;
      case 4: g.moveTo(0, s * 0.95); g.bezierCurveTo(-s * 1.45, -s * 0.05, -s * 0.75, -s * 1.2, 0, -s * 0.48); g.bezierCurveTo(s * 0.75, -s * 1.2, s * 1.45, -s * 0.05, 0, s * 0.95); break;
      default: g.moveTo(0, -s * 1.08); g.lineTo(s * 0.9, 0); g.lineTo(0, s * 1.08); g.lineTo(-s * 0.9, 0); g.closePath();
    }
  }

  /** a marching critter: the pattern piece is its body (with feet, eyes and maybe dots / an arrow / a number) */
  private drawTok(g: G, t: Tok, x: number, y: number, s: number, { feet = true, stepPh = 0, faceAlpha = 1 } = {}) {
    const col = COLORS[t.c];
    g.save(); g.translate(x, y);
    if (feet) {
      shadow(g, 0, s * 1.08, s * 0.8, s * 0.16, 0.3);
      for (const sd of [-1, 1]) {
        const lift = Math.max(0, Math.sin(stepPh + (sd > 0 ? Math.PI : 0))) * s * 0.22;
        blob(g, sd * s * 0.38, s * 1.0 - lift, s * 0.22, s * 0.13, darken(col, 0.3), { gloss: 0.2 });
      }
    }
    const sh = t.kind === "plain" ? t.sh : t.kind === "dots" ? t.sh : 0;
    this.shapePath(g, sh, s);
    clayFill(g, col, 0, 0, s * 1.05, { gloss: 0.45 });
    g.lineWidth = Math.max(1.5, s * 0.05); g.strokeStyle = darken(col, 0.35); g.stroke();
    const ey = t.kind === "plain" ? (sh === 2 ? s * 0.18 : sh === 3 ? s * 0.02 : sh === 4 ? -s * 0.12 : -s * 0.12) : -s * 0.62;
    const er = t.kind === "plain" ? s * 0.19 : s * 0.15, ex = t.kind === "plain" ? s * 0.3 : s * 0.25;
    g.globalAlpha *= faceAlpha;
    if (t.kind === "dots") {
      const pts = DOTS[Math.min(9, t.v)] ?? [];
      const ds = s * (t.v > 6 ? 0.12 : 0.15);
      for (const [dx, dy] of pts) { g.beginPath(); g.arc(dx * s * 0.42, s * 0.14 + dy * s * 0.36, ds, 0, Math.PI * 2); g.fillStyle = "#FFFFFF"; g.fill(); g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 1; g.stroke(); }
    } else if (t.kind === "arrow") {
      g.save(); g.translate(0, s * 0.1); g.rotate((t.v * Math.PI) / 2);
      g.fillStyle = "#FFFFFF"; g.strokeStyle = darken(col, 0.4); g.lineWidth = Math.max(1.5, s * 0.06); g.lineJoin = "round";
      g.beginPath(); g.moveTo(0, -s * 0.6); g.lineTo(s * 0.42, -s * 0.12); g.lineTo(s * 0.16, -s * 0.12); g.lineTo(s * 0.16, s * 0.52); g.lineTo(-s * 0.16, s * 0.52); g.lineTo(-s * 0.16, -s * 0.12); g.lineTo(-s * 0.42, -s * 0.12); g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (t.kind === "num") {
      blob(g, 0, s * 0.12, s * 0.66, s * 0.6, "#FFFDF4", { gloss: 0.3 });
      const txt = String(t.v), fs = s * (txt.length > 2 ? 0.55 : txt.length > 1 ? 0.72 : 0.9);
      g.font = `${fs}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(txt, 0, s * 0.17);
    }
    for (const sd of [-1, 1]) eye(g, sd * ex, ey, er, { look: [-0.4, 0.1], blink: Math.sin(this.t * 0.9 + x * 0.05) > 0.98 ? 1 : 0 });
    if (t.kind === "plain") mouth(g, 0, ey + s * 0.32, s * 0.3, "smile");
    g.restore();
  }

  private drawStreet(g: G) {
    const W = this.W, H = this.H, A = this.area;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#7FCBFF"); sky.addColorStop(0.55, "#D8F1FF"); sky.addColorStop(1, "#BFE6FF");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) blob(g, ((i * 233 + this.t * 8) % (W + 200)) - 100, A.y + 30 + (i % 3) * 26, 50 + (i % 2) * 20, 16, "#FFFFFF", { gloss: 0.4 });
    // houses behind the first lane
    const base = this.lanes[0] - this.S * 2.6, hcols = ["#FF8FB1", "#FFD25A", "#8FE3C0", "#9FB4FF", "#FFB27A", "#C9A2FF"];
    for (let x = -20, i = 0; x < W + 40; i++) {
      const w = 70 + ((i * 37) % 40), h = 70 + ((i * 53) % 70);
      const c = hcols[i % hcols.length];
      rr(g, x, base - h, w, h + 40, 10); clayFill(g, c, x + w / 2, base - h / 2, Math.max(w, h) * 0.6, { gloss: 0.2, rim: false });
      g.beginPath(); g.moveTo(x - 6, base - h + 4); g.lineTo(x + w / 2, base - h - 26); g.lineTo(x + w + 6, base - h + 4); g.closePath(); clayFill(g, darken(c, 0.25), x + w / 2, base - h - 10, w * 0.5, { gloss: 0.2 });
      for (let wy = base - h + 16; wy < base - 18; wy += 30) for (let wx = x + 12; wx < x + w - 22; wx += 26) { rr(g, wx, wy, 14, 16, 4); g.fillStyle = "#FFF6C9"; g.fill(); }
      x += w + 6;
    }
    // bunting
    for (let row = 0; row < 1; row++) {
      const y0 = base - 120, n = Math.ceil(W / 34);
      g.strokeStyle = "rgba(90,52,32,0.6)"; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= n; i++) { const x = i * 34, y = y0 + Math.sin((i / n) * Math.PI * 3) * 10; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      for (let i = 0; i < n; i++) {
        const x = i * 34 + 6, y = y0 + Math.sin((i / n) * Math.PI * 3) * 10 + 1, sway = Math.sin(this.t * 3 + i) * 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y + 1); g.lineTo(x + 11 + sway, y + 22); g.closePath(); g.fillStyle = COLORS[i % 6]; g.fill();
      }
    }
    // roads (one per lane) with sidewalks and spectators
    this.lanes.forEach((ly, li) => {
      const top = ly - this.S * 1.25, bot = ly + this.S * 0.55;
      g.fillStyle = "#E9D9C1"; g.fillRect(0, top - 16, W, 16);
      g.fillStyle = "#CDB89A"; g.fillRect(0, top - 3, W, 3);
      const road = g.createLinearGradient(0, top, 0, bot); road.addColorStop(0, "#8D93A8"); road.addColorStop(1, "#6E7489");
      g.fillStyle = road; g.fillRect(0, top, W, bot - top);
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (let x = ((this.t * 30) % 60) - 60 + li * 30; x < W; x += 60) g.fillRect(x, (top + bot) / 2 + this.S * 0.6, 28, 4);
      g.fillStyle = "#E9D9C1"; g.fillRect(0, bot, W, 10);
    });
    if (this.portrait() && this.lanes.length > 1) {
      // reading order: row 1 left → right, then row 2 from the left again
      const y0 = this.lanes[0] - this.S * 0.35, y1 = this.lanes[1] - this.S * 0.35;
      this.arrow(g, W - 14, y0 + this.S * 1.2, Math.PI / 2, 11);
      this.arrow(g, 13, y1, 0, 11);
    }
    // spectators along the sidewalks
    this.lanes.forEach((ly, li) => {
      const sy = ly - this.S * 1.25 - 14, x0 = li ? this.hoot.x + this.hoot.h * 0.7 : 14;
      for (let i = 0, x = x0; x < W; i++, x += 30) {
        const b = this.cheer * Math.abs(Math.sin(this.t * 10 + i + li)) * 10;
        blob(g, x, sy - 8 - b, 11, 12, hcols[(i * 2 + li) % 6], { gloss: 0.3 });
        g.fillStyle = "#1B1420"; g.beginPath(); g.arc(x - 3.5, sy - 10 - b, 1.8, 0, Math.PI * 2); g.arc(x + 3.5, sy - 10 - b, 1.8, 0, Math.PI * 2); g.fill();
      }
    });
  }

  private arrow(g: G, x: number, y: number, a: number, s: number) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.2, -s * 0.85); g.lineTo(-s * 0.2, -s * 0.35); g.lineTo(-s, -s * 0.35); g.lineTo(-s, s * 0.35); g.lineTo(-s * 0.2, s * 0.35); g.lineTo(-s * 0.2, s * 0.85); g.closePath();
    clayFill(g, "#FFD25A", 0, 0, s, { gloss: 0.4 }); g.strokeStyle = "#23305A"; g.lineWidth = 2.5; g.lineJoin = "round"; g.stroke();
    g.restore();
  }

  private drawParade(g: G) {
    const n = this.seq.length, W = this.W;
    const off = this.march.off, moving = this.phase === "in" || this.phase === "out";
    const stepPh = this.t * (moving ? 12 : 6);
    for (let i = 0; i <= n; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const dx = off > 0 ? off * (W + 60 + i * 30) : off * (W + 60 + (n - i) * 30);
      const bob = Math.abs(Math.sin(stepPh / 2 + i)) * (moving ? 5 : 2);
      const x = s.x + dx, y = s.y - bob;
      if (x < -80 || x > W + 80) continue;
      if (i < n) this.drawTok(g, this.seq[i], x, y, this.S, { stepPh: stepPh + i });
      else this.drawFloat(g, x, y);
    }
  }

  /** the "?" float at the end of the line — flips over to show the answer */
  private drawFloat(g: G, x: number, y: number) {
    const s = this.S, f = this.flip.v, sx = Math.abs(Math.cos(f * Math.PI));
    shadow(g, x, y + s * 1.12, s * 1.0, s * 0.18, 0.3);
    for (const sd of [-1, 1]) { blob(g, x + sd * s * 0.62, y + s * 0.98, s * 0.2, s * 0.2, "#4A3A5E", { gloss: 0.2 }); blob(g, x + sd * s * 0.62, y + s * 0.98, s * 0.08, s * 0.08, "#C9D3E3"); }
    g.save(); g.translate(x, y); g.scale(Math.max(0.03, sx), 1);
    if (f < 0.5) {
      const wob = Math.sin(this.t * 4) * 0.04;
      g.rotate(wob);
      rr(g, -s * 0.95, -s * 0.95, s * 1.9, s * 1.85, s * 0.35); clayFill(g, "#FFD25A", 0, 0, s * 1.1, { gloss: 0.4 });
      rr(g, -s * 0.95, -s * 0.95, s * 1.9, s * 1.85, s * 0.35); g.strokeStyle = "#E8A21E"; g.lineWidth = 3; g.stroke();
      for (const [px, py] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.68], [0.7, 0.68]]) star(g, px * s, py * s, s * 0.12, "#FFFFFF");
      clayText(g, "?", 0, s * 0.02, s * 1.3, { fill: "#FF6F91" });
    } else this.drawTok(g, this.ans, 0, 0, s, { feet: false });
    g.restore();
  }

  private drawHoot(g: G) {
    const h = this.hoot, dz = this.drowsy();
    const mood: Mood = this.hud.status !== "playing" ? "happy" : dz > 0.6 ? "sad" : this.hoot.wake > 0.5 ? "wow" : this.hud.host.mood;
    const beat = h.bop * (1 - dz);
    // drum
    const dx = h.x + h.h * 0.32, dy = h.y - h.h * 0.22, dr = h.h * 0.22;
    this.sprite(g, this.host(mood), h.x, h.y, h.h, { rot: dz * 0.3 + Math.sin(this.t * 1.4) * 0.02, sy: 1 + beat * 0.05 - dz * 0.04, sx: 1 - beat * 0.03 });
    g.save(); g.translate(dx, dy);
    rr(g, -dr, -dr * 0.6, dr * 2, dr * 1.4, dr * 0.25); clayFill(g, "#E8504F", 0, 0, dr * 1.1, { gloss: 0.35 });
    g.strokeStyle = "#FFF4E2"; g.lineWidth = dr * 0.1; g.beginPath();
    for (let i = 0; i <= 6; i++) { const x = -dr * 0.9 + i * dr * 0.3; if (i === 0) g.moveTo(x, i % 2 ? dr * 0.6 : -dr * 0.45); else g.lineTo(x, i % 2 ? dr * 0.6 : -dr * 0.45); }
    g.stroke();
    blob(g, 0, -dr * 0.6, dr, dr * 0.26, "#FFF4E2", { gloss: 0.4 });
    // sticks
    for (const sd of [-1, 1]) {
      const a = sd * 0.5 - (beat > 0.3 && sd > 0 ? 0.5 : 0) + dz * 0.6;
      g.save(); g.translate(sd * dr * 0.5, -dr * 0.8); g.rotate(a);
      g.strokeStyle = "#D9A066"; g.lineWidth = dr * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -dr * 0.9); g.stroke();
      blob(g, 0, -dr * 0.95, dr * 0.12, dr * 0.12, "#FFF4E2");
      g.restore();
    }
    g.restore();
    // Zzz…
    if (dz > 0.05) {
      for (let k = 0; k < 3; k++) {
        const u = (this.t * 0.6 + k / 3) % 1;
        g.save(); g.globalAlpha = dz * (1 - u);
        clayText(g, "z", h.x + h.h * 0.25 + u * 30 + k * 6, h.y - h.h * 1.0 - u * 50, 14 + k * 5 + u * 6, { fill: "#FFFFFF", stroke: "#3B4C8A", gloss: false });
        g.restore();
      }
    }
    if (h.wake > 0.4) clayText(g, "!", h.x + h.h * 0.3, h.y - h.h * 1.05 - (1 - h.wake) * 20, 30, { fill: "#FFD25A" });
  }

  private drawTray(g: G) {
    const T = this.tray;
    clayPanel(g, T.x, T.y, T.w, T.h, 22, "#FFF1D6", { lip: 7 });
    if (this.hud.status !== "playing") { clayText(g, "What comes next?", T.x + T.w / 2, T.y + T.h / 2 - 4, Math.min(26, T.w * 0.08), { fill: "#FF8A3D" }); return; }
    // progress
    const n = this.prompts, sp = Math.min(18, (T.w - 40) / n), x0 = T.x + T.w / 2 - ((n - 1) * sp) / 2, y = T.y + 15;
    for (let i = 0; i < n; i++) {
      const r = this.results[i];
      if (r === true) star(g, x0 + i * sp, y, 6.5, "#FFC93C");
      else { g.fillStyle = r === false ? "#FF6F91" : i === this.pi ? "#3B82F6" : "rgba(35,48,90,0.18)"; g.beginPath(); g.arc(x0 + i * sp, y, 4.5, 0, Math.PI * 2); g.fill(); }
    }
    if (!this.opts.length || this.phase === "in") {
      clayText(g, "Here they come…", T.x + T.w / 2, T.y + T.h / 2 + 8, Math.min(22, T.w * 0.07), { fill: "#9B5DE5" });
      return;
    }
    this.opts.forEach((o, i) => this.drawOpt(g, o, i));
  }

  private drawOpt(g: G, o: Opt, i: number) {
    if (o.pop <= 0.01) return;
    const sc = o.pop * (1 - o.press * 0.08), right = o.state === "right", wrong = o.state === "wrong";
    g.save(); g.translate(o.x + Math.sin(this.t * 40) * o.wig * 6, o.y); g.scale(sc, sc);
    if (o.glow > 0) { const pulse = 1 + Math.sin(this.t * 9) * 0.08; g.strokeStyle = "#FFC93C"; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, o.r * 1.16 * pulse, 0, Math.PI * 2); g.stroke(); }
    shadow(g, 0, o.r * 0.95, o.r * 0.8, 6, 0.3);
    blob(g, 0, 0, o.r, o.r, right ? "#C8F5DC" : wrong ? "#E2DAE6" : "#FFFFFF", { gloss: 0.4 });
    g.strokeStyle = right ? "#2FA866" : wrong ? "#B3A8BC" : "#F2C14E"; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, o.r - 2, 0, Math.PI * 2); g.stroke();
    if (wrong) g.globalAlpha = 0.45;
    this.drawTok(g, o.t, 0, 0, o.r * (o.t.kind === "num" ? 0.68 : 0.58), { feet: false });
    g.globalAlpha = 1;
    if (wrong) { g.strokeStyle = "#E8504F"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(-o.r * 0.45, -o.r * 0.45); g.lineTo(o.r * 0.45, o.r * 0.45); g.moveTo(o.r * 0.45, -o.r * 0.45); g.lineTo(-o.r * 0.45, o.r * 0.45); g.stroke(); }
    g.restore();
    if (this.W > 700 && o.state === "idle") clayText(g, String(i + 1), o.x - o.r * 0.82, o.y - o.r * 0.82, 15, { fill: "#FFFFFF", gloss: false });
  }

  private scene(g: G) {
    this.drawStreet(g);
    if (this.portrait()) { this.drawHoot(g); this.drawParade(g); } else { this.drawParade(g); this.drawHoot(g); }
    this.drawTray(g);
  }

  protected drawBackground(g: G) {
    if (!this.seq.length) {
      this.seq = [0, 1, 0, 1, 0].map((k) => P({ sh: k ? 3 : 0, c: k ? 3 : 0 }));
      this.ans = P({ sh: 3, c: 3 });
      this.march.off = 0;
    }
    this.layout();
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}

/** dice-style dot layouts for 1–9 (x, y in −1…1) */
const DOTS: [number, number][][] = [
  [], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]], [[-1, -1], [0, -1], [1, -1], [-1, 0.2], [1, 0.2], [-1, 1], [0, 1], [1, 1]],
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
];
