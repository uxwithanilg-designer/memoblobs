// Pick the Door — Kranky's TV game show. Momo hides behind one of 3–8 clay doors (each has a colour, a
// symbol and a number) and Kranky's clue cards point to exactly ONE door (a solver builds a minimal clue set).
// Unlimited levels: more doors, more combined clues, then FIB clues, VANISHING clues and QUICK rounds.
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, type GameMeta } from "../engine";
import { FONT, NAVY, blob, clayFill, clayPanel, clayText, darken, eye, lighten, rgba, rr, shadow, star, type G } from "../paint";

type Sym = "star" | "moon" | "heart" | "sun" | "fish" | "flower" | "leaf" | "drop";
const SYMS: Sym[] = ["star", "moon", "heart", "sun", "fish", "flower", "leaf", "drop"];
const SYM_C: Record<Sym, string> = { star: "#FFC93C", moon: "#8FC9FF", heart: "#FF5C7A", sun: "#FF9F1C", fish: "#2EC4B6", flower: "#C77DFF", leaf: "#5DBB46", drop: "#3B82F6" };
const COLS = [
  { c: "#E8504F", name: "RED" }, { c: "#3B82F6", name: "BLUE" }, { c: "#2FA866", name: "GREEN" }, { c: "#FFC93C", name: "YELLOW" },
  { c: "#9B5DE5", name: "PURPLE" }, { c: "#FF8A3D", name: "ORANGE" }, { c: "#FF6F91", name: "PINK" }, { c: "#9A6B45", name: "BROWN" },
];
type Junk = "boot" | "sock" | "bone" | "peel" | "duck" | "can";
const JUNK: Junk[] = ["boot", "sock", "bone", "peel", "duck", "can"];
type Part = string | { c: number } | { s: Sym } | { n: number } | { a: -1 | 1 };
type Kind = "ceq" | "cneq" | "seq" | "sneq" | "end" | "mid" | "even" | "odd" | "big" | "small" | "left" | "right" | "nextc" | "nexts" | "notnexts";
type Twist = "fib" | "vanish" | "quick";
interface Clue { parts: Part[]; set: number; kind: Kind; fib?: boolean; peek?: boolean; pop: number }
interface Door {
  c: number; s: Sym; junk: Junk; x: number; y: number; w: number; h: number;
  open: number; wig: number; drop: number; hi: number; pop: number; state: "closed" | "wrong" | "right" | "shown" | "lost";
}
type Phase = "intro" | "pick" | "opening" | "done";

const bit = (i: number) => 1 << i;
const pop = (m: number) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const MOMO = { happy: "/brand/momo-cheer.webp", sly: "/brand/momo-sly.webp", scared: "/brand/momo-scared.webp" };

export default class PickTheDoor extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "pick-the-door", title: "Pick the Door", host: "kranky", style: "rounds",
    music: { calm: "a:doors_calm", action: "a:doors_action" },
    sounds: ["a:creak", "a:doorOpen", "a:doorClose", "a:buzz", "a:cheer", "a:applause", "a:twinkle", "a:page", "a:tink", "a:clunk",
      "a:poof", "a:honk", "a:tickHi", "a:gong", "drumroll", "snicker", "tada", "boing", "v:kranky_laugh", "v:momo_happy", "v:momo_wow"],
    sprites: [MOMO.happy, MOMO.sly, MOMO.scared], voicePitch: 0.95, transition: "curtain",
  };
  private doors: Door[] = [];
  private clues: Clue[] = [];
  private peekPool: Clue[] = [];
  private prize = 0;
  private phase: Phase = "intro";
  private round = 0; private rounds = 2;
  private tries = 1; private triesMax = 1;
  private peeks = 0; private peeksLevel = 0; private wrongLevel = 0;
  private twist: Twist | null = null;
  private twists = new Bag<Twist>(["fib", "vanish", "quick"]);
  private junkBag = new Bag<Junk>(JUNK);
  private recent = new Recent(30);
  private roundId = 0;
  private pickT0 = 0; private quickMax = 0; private quickT = 0;
  private vanish = { v: 0 };
  private hide = { u: 0, on: 0 };
  private kk = { bop: 0, laugh: 0 };
  private peekBtn = { x: 0, y: 0, w: 140, h: 56, press: 0, wig: 0 };
  private board = { x: 0, y: 0, w: 300, h: 200 };
  private kr = { x: 0, y: 0, h: 110 };
  private bar = { x: 0, y: 0, w: 300, h: 60 };
  private stage = { x: 0, y: 0, w: 0, h: 0 };
  private floorY = 0;
  private boardRows = 3;
  private bg?: HTMLCanvasElement;
  private demo: { doors: Door[]; clues: Clue[] } | null = null;

  protected onResize() { this.layout(); this.bg = undefined; }

  // ------------------------------------------------------------ layout
  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H;
    const colW = Math.min(W - 16, 1000);
    const barH = clamp(A.h * 0.11, 58, 74);
    this.bar = { x: (W - colW) / 2, y: A.y + A.h - barH, w: colW, h: barH };
    const krW = portrait ? clamp(colW * 0.31, 96, 140) : clamp(A.h * 0.32, 130, 210);
    const bw = Math.min(colW - krW - 10, 600);
    const gx = (W - (krW + 10 + bw)) / 2;
    const rowH = clamp(A.h * 0.068, 34, 50);
    const bh = clamp(26 + rowH * Math.max(2, this.boardRows), 110, A.h * 0.42);
    const n = this.doors.length || 4;
    const bottom = this.bar.y - 12;
    const gap = n >= 7 && portrait ? 3 : clamp(W * 0.012, 5, 16);
    const avail = (portrait ? W - 12 : colW - 20);
    let dw = Math.min(portrait ? 116 : 134, (avail - gap * (n - 1)) / n);
    const dh = Math.min(dw * 1.9, bottom - (A.y + bh + 52));
    dw = Math.min(dw, dh / 1.3);
    // centre the board + doors group in the free space
    const free = bottom - dh - 44 - (A.y + bh + 8);
    const by = A.y + 4 + Math.max(0, free * 0.4);
    this.board = { x: gx + krW + 10, y: by, w: bw, h: bh };
    const kh = Math.min(krW * 1.05, bh + Math.max(0, free * 0.35) + 20);
    this.kr = { x: gx + krW * 0.5, y: by + bh + Math.min(30, Math.max(0, free * 0.3)), h: kh };
    const total = n * dw + (n - 1) * gap, sx = (W - total) / 2;
    this.floorY = bottom;
    this.stage = { x: sx - 16, y: bottom - dh - 34, w: total + 32, h: dh + 34 };
    this.doors.forEach((d, i) => { d.x = sx + i * (dw + gap); d.y = bottom; d.w = dw; d.h = dh; });
    const pw = clamp(colW * 0.38, 130, 200);
    Object.assign(this.peekBtn, { w: pw, h: barH - 8, x: W / 2 - pw / 2, y: this.bar.y + 4 });
  }

  // ------------------------------------------------------------ level / round generation
  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.phase = "intro"; this.clues = [];
    this.round = 0; this.rounds = 2;
    this.peeksLevel = 0; this.wrongLevel = 0;
    const from = byDiff(d, { easy: 12, medium: 8, hard: 5 });
    this.twist = null;
    if (L >= from && (L === from || this.rng.chance(0.6))) {
      let t = this.twists.next(this.rng);
      if (t === "vanish" && L < from + byDiff(d, { easy: 6, medium: 3, hard: 2 })) t = "fib";
      if (t === "quick" && L < from + byDiff(d, { easy: 3, medium: 5, hard: 4 })) t = "fib";
      this.twist = t;
    }
    if (this.twist) {
      const info: Record<Twist, [string, string]> = { fib: ["FIB CLUE!", "One clue is a fib — the opposite is true!"], vanish: ["VANISHING CLUES!", "Remember them before they disappear!"], quick: ["QUICK ROUND!", "Pick a door before time runs out!"] };
      this.after(0.4, () => this.banner(info[this.twist!][0], info[this.twist!][1], this.twist === "quick" ? "red" : "pink"));
    }
    this.music(this.twist || this.doorCount() >= 6 ? "action" : "calm");
    this.startRound(this.twist ? 1.6 : 0.2);
  }

  private doorCount() {
    const L = this.level;
    return byDiff(this.diff, { easy: Math.min(6, 3 + Math.floor((L - 1) / 3)), medium: Math.min(7, 4 + Math.floor((L - 1) / 3)), hard: Math.min(8, 5 + Math.floor((L - 1) / 3)) });
  }
  private clueCount() {
    const L = this.level;
    return byDiff(this.diff, { easy: L <= 1 ? 1 : L <= 6 ? 2 : 3, medium: L <= 4 ? 2 : L <= 10 ? 3 : 4, hard: L <= 2 ? 2 : L <= 7 ? 3 : 4 });
  }
  private kinds(): Set<Kind> {
    const L = this.level, d = this.diff;
    const lv = (e: number, m: number, h: number) => L >= byDiff(d, { easy: e, medium: m, hard: h });
    const k: Kind[] = ["ceq", "cneq", "seq", "sneq"];
    if (lv(2, 1, 1)) k.push("end", "mid");
    if (lv(4, 2, 1)) k.push("even", "odd");
    if (lv(6, 3, 1)) k.push("left", "right");
    if (lv(8, 5, 2)) k.push("nextc", "nexts", "notnexts");
    if (lv(11, 7, 3)) k.push("big", "small");
    return new Set(k);
  }

  /** every statement Kranky could make about these doors, with the set of doors it is true for */
  private statements(D: { c: number; s: Sym }[]) {
    const n = D.length, out: Clue[] = [];
    const setOf = (f: (i: number) => boolean) => { let m = 0; for (let i = 0; i < n; i++) if (f(i)) m |= bit(i); return m; };
    const cols = [...new Set(D.map((x) => x.c))], syms = [...new Set(D.map((x) => x.s))];
    const add = (kind: Kind, parts: Part[], set: number) => out.push({ kind, parts, set, pop: 0 });
    for (const c of cols) {
      add("ceq", ["It's", { c }], setOf((i) => D[i].c === c));
      add("cneq", ["Not", { c }], setOf((i) => D[i].c !== c));
    }
    for (const s of syms) {
      add("seq", ["It has a", { s }], setOf((i) => D[i].s === s));
      add("sneq", ["No", { s }, "on it"], setOf((i) => D[i].s !== s));
    }
    add("end", ["It's at one end"], setOf((i) => i === 0 || i === n - 1));
    add("mid", ["Not at either end"], setOf((i) => i > 0 && i < n - 1));
    add("even", ["An even number"], setOf((i) => (i + 1) % 2 === 0));
    add("odd", ["An odd number"], setOf((i) => (i + 1) % 2 === 1));
    for (let k = 2; k < n; k++) {
      add("big", ["Bigger than", { n: k }], setOf((i) => i + 1 > k));
      add("small", ["Smaller than", { n: k }], setOf((i) => i + 1 < k));
    }
    D.forEach((x, r) => {
      if (D.filter((y) => y.c === x.c).length === 1) {
        add("left", [{ a: -1 }, "Left of", { c: x.c }], setOf((i) => i < r));
        add("right", [{ a: 1 }, "Right of", { c: x.c }], setOf((i) => i > r));
        add("nextc", ["Next to", { c: x.c }], setOf((i) => Math.abs(i - r) === 1));
      }
      if (D.filter((y) => y.s === x.s).length === 1) {
        add("nexts", ["Next to the", { s: x.s }], setOf((i) => Math.abs(i - r) === 1));
        add("notnexts", ["Not next to the", { s: x.s }], setOf((i) => Math.abs(i - r) !== 1));
      }
    });
    return out;
  }

  private makeDoors(n: number) {
    const nc = n <= 3 ? 3 : Math.max(3, Math.ceil(n * 0.62)), ns = n <= 3 ? 3 : Math.max(3, Math.ceil(n * 0.62));
    for (let tries = 0; tries < 50; tries++) {
      const cp = this.rng.shuffle([...COLS.keys()]).slice(0, nc), sp = this.rng.shuffle([...SYMS]).slice(0, ns);
      const cs = this.rng.shuffle(Array.from({ length: n }, (_, i) => cp[i % nc]));
      const ss = this.rng.shuffle(Array.from({ length: n }, (_, i) => sp[i % ns]));
      const D = cs.map((c, i) => ({ c, s: ss[i] }));
      if (new Set(D.map((x) => x.c + x.s)).size === n) return D;
    }
    return Array.from({ length: n }, (_, i) => ({ c: i % COLS.length, s: SYMS[i % SYMS.length] }));
  }

  /** find a minimal clue set (every clue needed) that leaves exactly the prize door */
  private solve(D: { c: number; s: Sym }[], p: number, k: number, fib: boolean) {
    const n = D.length, all = bit(n) - 1, target = bit(p);
    const allowed = this.kinds();
    const st = this.statements(D).filter((s) => allowed.has(s.kind));
    const truth = st.filter((s) => s.set & target && s.set !== all);
    const fibs = fib ? st.filter((s) => ["ceq", "seq", "end", "even", "odd", "cneq"].includes(s.kind) && !(s.set & target))
      .map((s) => ({ ...s, set: all & ~s.set, fib: true })).filter((s) => s.set !== all) : [];
    for (let want = k; want >= 1; want--) {
      const pool = want === 1 ? truth.filter((s) => s.set === target) : truth.filter((s) => pop(s.set) > 1);
      if (!pool.length) continue;
      for (let it = 0; it < 900; it++) {
        let pick: Clue[];
        if (fib && want >= 2 && fibs.length) pick = [this.rng.pick(fibs), ...this.rng.shuffle([...pool]).slice(0, want - 1)];
        else pick = this.rng.shuffle([...pool]).slice(0, want);
        if (pick.length < want) break;
        if (new Set(pick.map((c) => c.kind + JSON.stringify(c.parts))).size < want) continue;
        if (it < 650 && new Set(pick.map((c) => c.kind)).size < want) continue; // prefer a mix of clue kinds
        const inter = pick.reduce((m, c) => m & c.set, all);
        if (inter !== target) continue;
        let minimal = true;
        for (let j = 0; j < pick.length && minimal; j++) if (pick.reduce((m, c, q) => (q === j ? m : m & c.set), all) === target) minimal = false;
        if (!minimal) continue;
        // simple peek helpers that are true but not already used
        const used = new Set(pick.map((c) => JSON.stringify(c.parts)));
        const simple = truth.filter((s) => ["ceq", "cneq", "seq", "sneq", "end", "mid", "even", "odd"].includes(s.kind) && !used.has(JSON.stringify(s.parts)));
        const helpers = simple.filter((s) => pop(s.set) > 1).sort((a, b) => pop(a.set) - pop(b.set));
        const peek2 = simple.filter((s) => !helpers.slice(0, 1).includes(s)).sort((a, b) => pop(a.set) - pop(b.set));
        const peekPool = [helpers[0], peek2[0]].filter(Boolean) as Clue[];
        return { clues: this.rng.shuffle(pick.map((c) => ({ ...c, pop: 0 }))), peekPool: peekPool.map((c) => ({ ...c, pop: 0 })) };
      }
    }
    return null;
  }

  private startRound(delay = 0.2) {
    const n = this.doorCount(), k = this.clueCount();
    let D = this.makeDoors(n), p = 0, res: ReturnType<PickTheDoor["solve"]> = null;
    for (let tries = 0; tries < 40; tries++) {
      D = this.makeDoors(n); p = this.rng.int(0, n - 1);
      res = this.solve(D, p, k, this.twist === "fib");
      if (!res) continue;
      const sig = D.map((x) => x.c + x.s).join(",") + "|" + p + "|" + res.clues.map((c) => c.kind).sort().join(",");
      if (this.recent.has(sig) && tries < 39) continue;
      this.recent.add(sig);
      if (res.clues.length >= Math.min(k, 2) || tries > 25) break;
    }
    if (!res) { res = { clues: [{ kind: "seq", parts: ["It has a", { s: D[p].s }], set: bit(p), pop: 0 }], peekPool: [] }; }
    this.prize = p; this.roundId++;
    this.doors = D.map((x) => ({ c: x.c, s: x.s, junk: this.junkBag.next(this.rng), x: 0, y: 0, w: 0, h: 0, open: 0, wig: 0, drop: 1, hi: 0, pop: 0, state: "closed" as const }));
    this.clues = res.clues; this.peekPool = res.peekPool;
    this.peeks = 0; this.vanish.v = 0; this.hide.on = 0;
    this.triesMax = 1 + byDiff(this.diff, { easy: 2, medium: 1, hard: 0 }); this.tries = this.triesMax;
    this.phase = "intro";
    this.timerBar(null);
    this.boardRows = this.clues.length + (this.peekPool.length ? 1 : 0);
    this.layout(); this.bg = undefined;
    // doors drop onto the stage one by one
    this.doors.forEach((dr, i) => {
      this.tween(dr, { drop: 0 }, 0.5, ease.back, delay + i * 0.07);
      this.sfx("a:clunk", { gain: 0.35, delay: delay + 0.35 + i * 0.07, rate: 0.9 + i * 0.05, x: dr.x });
    });
    // Momo dives behind the doors (always to the middle — no peeking!)
    const t0 = delay + 0.35 + n * 0.07;
    this.after(t0, () => { this.hide.on = 1; this.hide.u = 0; this.tween(this.hide, { u: 1 }, 0.95, ease.linear); this.sfx("boing", { gain: 0.5 }); this.sfx("v:momo_wow", { gain: 0.5, delay: 0.1 }); });
    this.after(t0 + 0.95, () => { this.hide.on = 0; this.sfx("a:poof", { gain: 0.4 }); });
    this.after(t0 + 0.2, () => this.react("happy", this.rng.pick(["I hid Momo! Hee hee!", "You'll NEVER find him!", "Read my clues… if you can!", "Which door? Mwa-ha-ha!", "Pick wisely, ha!"])));
    const c0 = t0 + 1.1;
    this.clues.forEach((c, j) => this.after(c0 + j * 0.6, () => {
      this.tween(c, { pop: 1 }, 0.4, ease.back);
      this.sfx("a:page", { gain: 0.5, rate: 1 + j * 0.06 });
      this.kk.bop = 1;
    }));
    this.after(c0 + this.clues.length * 0.6 + 0.1, () => this.startPick());
  }

  private startPick() {
    this.phase = "pick"; this.pickT0 = this.t;
    const fib = this.clues.some((c) => c.fib);
    this.hint(fib ? "FIB! means the OPPOSITE is true 🤞" : this.twist === "vanish" ? "Remember the clues — they vanish! 👀" : this.twist === "quick" ? "Quick! Pick a door ⏱" : this.level === 1 && this.round === 0 ? "Read the clue, then tap the door 🚪" : "Which door is Momo behind? 🚪");
    if (this.twist === "vanish") {
      const t = Math.max(3.2, this.clues.length * 1.8 + byDiff(this.diff, { easy: 2, medium: 1.2, hard: 0.6 })), id = this.roundId;
      this.after(t, () => { if (id === this.roundId && (this.phase === "pick" || this.phase === "opening")) { this.tween(this.vanish, { v: 1 }, 0.5, ease.inOut); this.sfx("a:poof", { gain: 0.5 }); this.hint("Clues gone! Did you remember? 🤔"); } });
    }
    if (this.twist === "quick") { this.quickMax = 5 + this.clues.length * 2.6 + byDiff(this.diff, { easy: 3, medium: 1.5, hard: 0 }); this.quickT = 0; }
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = Number(key);
    if (k >= 1 && k <= this.doors.length) this.pick(k - 1);
    else if (key.toLowerCase() === "e") this.peek();
  }

  protected onDown(x: number, y: number) {
    const b = this.peekBtn;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.peek(); return; }
    const i = this.doors.findIndex((d) => x >= d.x - 3 && x <= d.x + d.w + 3 && y >= d.y - d.h - 36 && y <= d.y + 12);
    if (i >= 0) this.pick(i);
  }

  private peek() {
    const b = this.peekBtn;
    b.press = 1; this.tween(b, { press: 0 }, 0.25);
    if (this.phase !== "pick" || this.peeks >= 2 || !this.peekPool.length) { b.wig = 1; this.sfx("a:tink", { gain: 0.4 }); return; }
    const c = this.peekPool.shift()!;
    c.peek = true; c.pop = 0;
    this.clues.push(c);
    this.tween(c, { pop: 1 }, 0.45, ease.back);
    this.peeks++; this.peeksLevel++;
    this.sfx("a:twinkle", { gain: 0.6 });
    this.float("PEEK!", b.x + b.w / 2, b.y - 10, "#7CF2C9", 24);
    this.react("wow", this.rng.pick(["Hey! No peeking!", "Fine… ONE little clue.", "Grr! A peek!", "Pssst… don't tell anyone!"]));
  }

  private pick(i: number) {
    if (this.phase !== "pick") return;
    const d = this.doors[i];
    if (!d || d.state !== "closed") return;
    this.phase = "opening";
    d.hi = 1; d.wig = 1;
    this.timerBar(null);
    this.sfx("drumroll", { gain: 0.45 });
    this.sfx("a:creak", { gain: 0.45, x: d.x, delay: 0.35 });
    this.hint(null);
    this.after(0.8, () => this.openDoor(i));
  }

  private openDoor(i: number) {
    const d = this.doors[i], cx = d.x + d.w / 2, cy = d.y - d.h * 0.5;
    this.tween(d, { open: 1 }, 0.45, ease.out);
    this.sfx("a:doorOpen", { gain: 0.6, x: cx });
    d.hi = 0;
    if (i === this.prize) {
      d.state = "right";
      this.tween(d, { pop: 1 }, 0.55, ease.back, 0.15);
      const speed = clamp(1 - (this.t - this.pickT0) / (5 + this.clues.length * 3), 0, 1);
      const base = Math.max(50, 100 + 25 * this.clues.filter((c) => !c.peek).length - 35 * this.peeks);
      this.after(0.2, () => {
        this.good(cx, cy - d.h * 0.3, base, speed);
        this.sfx("a:cheer", { gain: 0.7 }); this.sfx("tada", { gain: 0.6, delay: 0.1 }); this.sfx("v:momo_happy", { gain: 0.7, delay: 0.35, duck: false });
        this.burst(cx, cy, { n: 26, colors: ["#FFD25A", "#FF8A3D", "#FFFFFF", "#7CF2C9"], kind: "star", speed: 340 });
        this.react("wow", this.rng.pick(["WHAT?! You found him!", "No fair! How?!", "Grr… lucky guess!", "My best hiding spot!"]));
      });
      // open the other doors to show Kranky's junk
      this.doors.forEach((o, j) => {
        if (j === i || o.state !== "closed") return;
        this.after(1.0 + j * 0.1, () => { o.state = "shown"; this.tween(o, { open: 1 }, 0.35, ease.out); this.sfx("a:doorOpen", { gain: 0.25, x: o.x, rate: 1.1 + j * 0.03 }); });
      });
      this.phase = "done";
      this.after(2.6, () => this.nextRound());
    } else {
      d.state = "wrong";
      this.tries--; this.wrongLevel++;
      this.kk.laugh = 1;
      this.after(0.25, () => {
        this.sfx("a:buzz", { gain: 0.6 }); this.sfx("snicker", { gain: 0.65, delay: 0.25 }); this.sfx("v:kranky_laugh", { gain: 0.7, delay: 0.5, duck: false });
        this.bad(cx, cy, { line: this.rng.pick(["HA HA! Not that one!", `A stinky ${this.junkName(d.junk)}! Hee hee!`, "Wrong door! Mwa-ha!", "Read my clues, ha!", "Nope! Try again, hee!"]) });
        this.float("HA!", cx, cy - d.h * 0.3, "#FF6F91", 30);
      });
      if (this.tries > 0) {
        this.after(1.3, () => {
          this.phase = "pick";
          if (this.twist === "quick") this.quickT = 0;
          this.hint(`${this.tries} ${this.tries === 1 ? "try" : "tries"} left — read the clues again 🔍`);
          if (this.tries === 1) this.music("action");
        });
      } else {
        this.phase = "done";
        this.after(1.3, () => {
          const r = this.doors[this.prize];
          r.state = "lost"; this.tween(r, { open: 1 }, 0.4, ease.out); this.tween(r, { pop: 1 }, 0.5, ease.back, 0.1);
          this.sfx("a:doorOpen", { gain: 0.5, x: r.x }); this.sfx("v:momo_wow", { gain: 0.6, delay: 0.2 });
        });
        this.after(2.3, () => this.levelFail(`Momo was behind door ${this.prize + 1}!`));
      }
    }
  }

  private junkName(j: Junk) { return { boot: "boot", sock: "sock", bone: "fish bone", peel: "banana peel", duck: "rubber duck", can: "old can" }[j]; }

  private nextRound() {
    this.round++;
    if (this.round >= this.rounds) {
      const noPeek = this.peeksLevel === 0;
      this.levelClear({ perfect: noPeek && this.wrongLevel === 0, bonus: Math.max(0, this.rounds * 2 - this.peeksLevel) * 12, title: noPeek ? (this.wrongLevel === 0 ? "GENIUS!" : "NO PEEKS!") : undefined });
      return;
    }
    // fly the old doors away, then a fresh set drops in
    this.doors.forEach((d, i) => this.tween(d, { drop: -1 }, 0.4, ease.in, i * 0.04));
    for (const c of this.clues) this.tween(c, { pop: 0 }, 0.25, ease.in);
    this.sfx("a:whooshOut", { gain: 0.4 });
    this.after(0.55, () => this.startRound(0.1));
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    this.kk.bop = Math.max(0, this.kk.bop - dt * 3);
    this.kk.laugh = Math.max(0, this.kk.laugh - dt * 0.7);
    const b = this.peekBtn; b.wig = Math.max(0, b.wig - dt * 2.5);
    for (const d of this.doors) { d.wig = Math.max(0, d.wig - dt * 1.4); }
    if (this.phase === "pick" && this.twist === "quick") {
      this.quickT += dt;
      const left = 1 - this.quickT / this.quickMax;
      this.timerBar(left, left < 0.3 ? "#FF6F91" : "#FFD25A");
      if (Math.floor(this.quickT) !== Math.floor(this.quickT - dt) && left < 0.35) this.sfx("a:tickHi", { gain: 0.35 });
      if (left <= 0) this.timeUp();
    }
  }

  private timeUp() {
    this.phase = "opening"; this.timerBar(null);
    this.tries--; this.wrongLevel++; this.kk.laugh = 1;
    this.sfx("a:gong", { gain: 0.5 }); this.sfx("snicker", { gain: 0.6, delay: 0.3 });
    this.bad(this.W / 2, this.floorY - 60, { line: this.rng.pick(["Time's up! Hee hee!", "Too slow! Ha!", "Tick-tock, GONG!"]) });
    if (this.tries > 0) this.after(1.2, () => { this.phase = "pick"; this.quickT = 0; this.hint(`${this.tries} ${this.tries === 1 ? "try" : "tries"} left — be quick! ⏱`); });
    else {
      this.phase = "done";
      this.after(0.9, () => { const r = this.doors[this.prize]; r.state = "lost"; this.tween(r, { open: 1 }, 0.4); this.tween(r, { pop: 1 }, 0.5, ease.back, 0.1); this.sfx("a:doorOpen", { gain: 0.5 }); });
      this.after(2.0, () => this.levelFail(`Momo was behind door ${this.prize + 1}!`));
    }
  }

  // ------------------------------------------------------------ drawing: stage
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H;
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#2A0F4A"); wall.addColorStop(0.55, "#5A1C6E"); wall.addColorStop(1, "#3A1250");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    // glittery dots
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,220,150,${0.08 + (i % 4) * 0.04})`; g.beginPath(); g.arc((i * 137.5) % W, (i * 89.3) % H, 1.5 + (i % 3), 0, Math.PI * 2); g.fill(); }
    // spotlight cones
    for (const [sx, dir] of [[W * 0.08, 1], [W * 0.92, -1]] as const) {
      const gr = g.createLinearGradient(sx, 0, sx + dir * W * 0.35, this.floorY);
      gr.addColorStop(0, "rgba(255,240,200,0.35)"); gr.addColorStop(1, "rgba(255,240,200,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 10, this.insetTop - 30); g.lineTo(sx + 10, this.insetTop - 30);
      g.lineTo(sx + dir * W * 0.5 + 80, this.floorY); g.lineTo(sx + dir * W * 0.5 - 80, this.floorY); g.closePath(); g.fill();
    }
    // stage floor
    const fy = this.floorY;
    const fl = g.createLinearGradient(0, fy, 0, H);
    fl.addColorStop(0, "#C98A4B"); fl.addColorStop(1, "#8A5428");
    g.fillStyle = fl; g.fillRect(0, fy, W, H - fy);
    g.strokeStyle = "rgba(90,52,32,0.35)"; g.lineWidth = 2;
    for (let y = fy + 14; y < H; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = "rgba(255,240,200,0.35)"; g.fillRect(0, fy, W, 4);
    shadow(g, W / 2, fy + 6, this.stage.w * 0.6, 14, 0.35);
    // side curtains
    const cw = clamp(W * 0.07, 22, 90);
    for (const s of [0, 1]) {
      const x0 = s ? W - cw : 0;
      const gr = g.createLinearGradient(x0, 0, x0 + cw, 0);
      gr.addColorStop(0, "#9E1F2E"); gr.addColorStop(0.5, "#E8504F"); gr.addColorStop(1, "#9E1F2E");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + cw, 0);
      g.quadraticCurveTo(s ? x0 - cw * 0.1 : x0 + cw * 1.1, H * 0.5, s ? x0 + cw * 0.4 : x0 + cw * 0.6, H);
      g.lineTo(s ? W : 0, H); g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 3;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x0 + (cw * k) / 3, 0); g.lineTo(x0 + (cw * k) / 3 + (s ? -6 : 6), H); g.stroke(); }
    }
    this.bg = c;
  }

  private drawStageBack(g: G) {
    const s = this.stage;
    // game-show backdrop with chasing bulbs
    rr(g, s.x, s.y, s.w, s.h + 8, 22); g.fillStyle = "#3B1458"; g.fill();
    rr(g, s.x + 6, s.y + 6, s.w - 12, s.h - 4, 18);
    const gr = g.createLinearGradient(0, s.y, 0, s.y + s.h); gr.addColorStop(0, "#7A2C8F"); gr.addColorStop(1, "#4A1A63");
    g.fillStyle = gr; g.fill();
    const per = 2 * (s.w + s.h), n = Math.max(12, Math.floor(per / 26));
    for (let i = 0; i < n; i++) {
      const u = (i / n) * per;
      let x: number, y: number;
      if (u < s.w) { x = s.x + u; y = s.y; } else if (u < s.w + s.h) { x = s.x + s.w; y = s.y + (u - s.w); }
      else if (u < 2 * s.w + s.h) { x = s.x + s.w - (u - s.w - s.h); y = s.y + s.h; } else { x = s.x; y = s.y + s.h - (u - 2 * s.w - s.h); }
      if (y > s.y + s.h - 2) continue;
      const on = (i + Math.floor(this.t * 6)) % 3 === 0;
      g.fillStyle = on ? "#FFE38A" : "#8A5A2A";
      g.beginPath(); g.arc(x, y, on ? 4.2 : 3.4, 0, Math.PI * 2); g.fill();
      if (on) { g.fillStyle = "rgba(255,227,138,0.25)"; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
    }
  }

  // ------------------------------------------------------------ drawing: doors
  private archPath(g: G, x: number, y: number, w: number, h: number) {
    const ry = Math.min(w * 0.5, h * 0.3);
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + ry); g.ellipse(x + w / 2, y + ry, w / 2, ry, 0, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  }

  private drawDoor(g: G, d: Door, i: number, live: boolean) {
    const col = COLS[d.c].c;
    const lift = d.drop > 0 ? ease.in(d.drop) * (d.y + 40) : d.drop < 0 ? -d.drop * (d.y + 40) : 0;
    const wig = Math.sin(d.wig * 34) * d.wig * 0.05;
    const x = d.x, w = d.w, h = d.h, top = d.y - h - lift;
    g.save();
    g.translate(x + w / 2, d.y - lift); g.rotate(wig); g.translate(-(x + w / 2), -(d.y - lift));
    shadow(g, x + w / 2, d.y - lift + 2, w * 0.62, 6, 0.4 * (1 - Math.abs(d.drop)));
    const fw = Math.max(3, Math.min(7, w * 0.07));
    this.archPath(g, x - fw, top - fw, w + fw * 2, h + fw); clayFill(g, darken(col, 0.45), x + w / 2, top + h / 2, h * 0.6, { gloss: 0.15 });
    // inside (dark room) + what's behind
    this.archPath(g, x, top, w, h);
    const ig = g.createLinearGradient(0, top, 0, top + h); ig.addColorStop(0, "#1A0B2A"); ig.addColorStop(1, "#3A1E4A");
    g.fillStyle = ig; g.fill();
    if (d.open > 0.02) {
      g.save(); this.archPath(g, x, top, w, h); g.clip();
      if (d.state === "wrong" || d.state === "shown") this.drawJunk(g, d.junk, x + w / 2, d.y - lift - h * 0.2, Math.min(w * 0.36, h * 0.2));
      g.restore();
      if (d.state === "right" || d.state === "lost") {
        const sh = Math.min(h * 0.62, w * 1.15) * (0.3 + 0.7 * d.pop);
        const bounce = d.state === "right" ? Math.abs(Math.sin(this.t * 7)) * h * 0.05 * d.pop : 0;
        if (d.state === "right") { const gl = g.createRadialGradient(x + w / 2, d.y - h * 0.4, 0, x + w / 2, d.y - h * 0.4, w); gl.addColorStop(0, "rgba(255,230,120,0.55)"); gl.addColorStop(1, "rgba(255,230,120,0)"); g.fillStyle = gl; g.fillRect(x - w * 0.5, d.y - h, w * 2, h); }
        this.sprite(g, d.state === "right" ? MOMO.happy : MOMO.scared, x + w / 2, d.y - lift - 4 - bounce, sh, { alpha: Math.min(1, d.pop * 2) });
      }
    }
    // the door panel, hinged on the left, swinging towards us
    if (d.open < 0.98) {
      const k = 1 - d.open * 0.86;
      g.save();
      g.translate(x, top); g.transform(k, -d.open * 0.22, 0, 1 + d.open * 0.06, 0, 0);
      this.archPath(g, 0, 0, w, h);
      const hi = d.hi > 0 ? 0.25 + Math.sin(this.t * 16) * 0.12 : 0;
      clayFill(g, hi ? lighten(col, hi) : col, w * 0.5, h * 0.45, Math.max(w, h) * 0.6, { gloss: 0.32 });
      // carved panels
      g.strokeStyle = rgba(darken(col, 0.3), 0.55); g.lineWidth = Math.max(1.5, w * 0.035);
      rr(g, w * 0.17, h * 0.58, w * 0.66, h * 0.32, w * 0.08); g.stroke();
      rr(g, w * 0.17, h * 0.13 + Math.min(w * 0.5, h * 0.3) * 0.3, w * 0.66, h * 0.36, w * 0.08); g.stroke();
      // knob
      blob(g, w * 0.82, h * 0.56, Math.max(2.5, w * 0.06), Math.max(2.5, w * 0.06), "#FFD25A", { gloss: 0.7 });
      // symbol plaque
      const pr = Math.min(w * 0.34, h * 0.17), py = h * 0.36;
      shadow(g, w / 2, py + pr * 0.9, pr * 0.9, pr * 0.25, 0.25);
      blob(g, w / 2, py, pr, pr, "#FFF8EA", { gloss: 0.4 });
      g.strokeStyle = rgba(darken(col, 0.4), 0.5); g.lineWidth = 2; g.beginPath(); g.arc(w / 2, py, pr, 0, Math.PI * 2); g.stroke();
      this.drawSym(g, d.s, w / 2, py, pr * 0.66);
      g.restore();
    }
    // number plate
    const ps = clamp(w * 0.3, 13, 22);
    const nx = x + w / 2, ny = top - fw - ps * 0.55;
    rr(g, nx - ps * 0.85, ny - ps * 0.6, ps * 1.7, ps * 1.2, ps * 0.35); clayFill(g, "#FFD25A", nx, ny, ps, { gloss: 0.4 });
    g.font = `${ps}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(String(i + 1), nx, ny + 1);
    if (live && d.hi > 0) { g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(this.t * 16) * 0.4})`; g.lineWidth = 3; this.archPath(g, x - fw - 3, top - fw - 3, w + fw * 2 + 6, h + fw + 3); g.stroke(); }
    if (d.state === "wrong" && d.open > 0.9) {
      g.save(); g.translate(x + w / 2, top + h * 0.22); g.rotate(-0.25);
      clayText(g, "HA!", 0, 0, clamp(w * 0.32, 13, 26), { fill: "#FF6F91" });
      g.restore();
    }
    g.restore();
  }

  private drawSym(g: G, s: Sym, x: number, y: number, r: number) {
    const c = SYM_C[s];
    g.save(); g.translate(x, y);
    switch (s) {
      case "star": star(g, 0, r * 0.05, r * 1.08, c, 0); break;
      case "heart":
        g.beginPath(); g.moveTo(0, r * 0.85); g.bezierCurveTo(-r * 1.35, -r * 0.05, -r * 0.65, -r * 1.15, 0, -r * 0.42); g.bezierCurveTo(r * 0.65, -r * 1.15, r * 1.35, -r * 0.05, 0, r * 0.85);
        clayFill(g, c, 0, 0, r, { gloss: 0.45 }); break;
      case "moon":
        g.beginPath(); g.moveTo(r * 0.35, -r); g.bezierCurveTo(-r * 1.4, -r * 0.95, -r * 1.4, r * 0.95, r * 0.35, r); g.bezierCurveTo(-r * 0.55, r * 0.55, -r * 0.55, -r * 0.55, r * 0.35, -r); g.closePath();
        clayFill(g, c, -r * 0.3, 0, r, { gloss: 0.45 }); break;
      case "sun":
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; blob(g, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.2, r * 0.13, "#FFC93C", { rot: a, gloss: 0.2 }); }
        blob(g, 0, 0, r * 0.6, r * 0.6, c, { gloss: 0.5 }); break;
      case "fish":
        g.beginPath(); g.moveTo(-r * 0.5, 0); g.lineTo(-r * 1.05, -r * 0.5); g.lineTo(-r * 1.05, r * 0.5); g.closePath(); clayFill(g, darken(c, 0.1), -r * 0.8, 0, r * 0.5);
        blob(g, r * 0.1, 0, r * 0.75, r * 0.5, c, { gloss: 0.5 });
        g.fillStyle = NAVY; g.beginPath(); g.arc(r * 0.45, -r * 0.1, r * 0.11, 0, Math.PI * 2); g.fill(); break;
      case "flower":
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; blob(g, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, r * 0.42, c, { gloss: 0.3 }); }
        blob(g, 0, 0, r * 0.33, r * 0.33, "#FFD25A", { gloss: 0.5 }); break;
      case "leaf":
        g.beginPath(); g.moveTo(-r * 0.9, r * 0.7); g.quadraticCurveTo(-r * 0.9, -r * 0.9, r * 0.9, -r * 0.8); g.quadraticCurveTo(r * 0.8, r * 0.8, -r * 0.9, r * 0.7); g.closePath();
        clayFill(g, c, 0, 0, r, { gloss: 0.4 });
        g.strokeStyle = darken(c, 0.3); g.lineWidth = Math.max(1, r * 0.1); g.beginPath(); g.moveTo(-r * 0.75, r * 0.55); g.lineTo(r * 0.6, -r * 0.6); g.stroke(); break;
      case "drop":
        g.beginPath(); g.moveTo(0, -r * 1.05); g.bezierCurveTo(r * 0.3, -r * 0.5, r * 0.8, -r * 0.05, r * 0.8, r * 0.3); g.arc(0, r * 0.3, r * 0.8, 0, Math.PI); g.bezierCurveTo(-r * 0.8, -r * 0.05, -r * 0.3, -r * 0.5, 0, -r * 1.05); g.closePath();
        clayFill(g, c, 0, r * 0.2, r, { gloss: 0.55 }); break;
    }
    g.restore();
  }

  private drawJunk(g: G, j: Junk, x: number, y: number, s: number) {
    g.save(); g.translate(x, y + Math.sin(this.t * 3 + x) * 2);
    shadow(g, 0, s * 0.95, s * 0.9, s * 0.18, 0.35);
    switch (j) {
      case "boot":
        rr(g, -s * 0.45, -s * 0.9, s * 0.6, s * 1.5, s * 0.15); clayFill(g, "#8A5428", -s * 0.15, -s * 0.2, s);
        rr(g, -s * 0.45, s * 0.25, s * 1.25, s * 0.55, s * 0.25); clayFill(g, "#8A5428", s * 0.2, s * 0.5, s * 0.7);
        g.fillStyle = "#5A3420"; g.fillRect(-s * 0.48, s * 0.7, s * 1.3, s * 0.14);
        for (let i = 0; i < 3; i++) { g.fillStyle = "#FFE38A"; g.beginPath(); g.arc(-s * 0.05, -s * 0.55 + i * s * 0.28, s * 0.05, 0, Math.PI * 2); g.fill(); }
        break;
      case "sock":
        g.beginPath(); g.moveTo(-s * 0.4, -s * 0.9); g.lineTo(s * 0.2, -s * 0.9); g.lineTo(s * 0.2, s * 0.2); g.quadraticCurveTo(s * 0.9, s * 0.25, s * 0.85, s * 0.6); g.quadraticCurveTo(s * 0.8, s * 0.9, s * 0.1, s * 0.85); g.quadraticCurveTo(-s * 0.4, s * 0.8, -s * 0.4, s * 0.3); g.closePath();
        clayFill(g, "#FFFFFF", 0, 0, s);
        g.save(); g.clip(); g.fillStyle = "#E8504F"; for (let i = 0; i < 4; i++) g.fillRect(-s, -s * 0.8 + i * s * 0.42, s * 2, s * 0.18); g.restore();
        g.fillStyle = "rgba(120,200,80,0.6)"; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(s * (0.3 + i * 0.25), -s * (0.4 + (i % 2) * 0.3) + Math.sin(this.t * 4 + i) * 3, s * 0.06, 0, Math.PI * 2); g.fill(); }
        break;
      case "bone":
        g.strokeStyle = "#EDE6F5"; g.lineCap = "round"; g.lineWidth = s * 0.12;
        g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(s * 0.45, 0); g.stroke();
        for (let i = 0; i < 4; i++) { const bx = -s * 0.45 + i * s * 0.25; g.beginPath(); g.moveTo(bx, -s * 0.35); g.lineTo(bx, s * 0.35); g.stroke(); }
        g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(-s * 0.95, -s * 0.3); g.moveTo(-s * 0.7, 0); g.lineTo(-s * 0.95, s * 0.3); g.stroke();
        blob(g, s * 0.62, 0, s * 0.3, s * 0.27, "#EDE6F5", { gloss: 0.4 });
        g.fillStyle = NAVY; g.beginPath(); g.arc(s * 0.68, -s * 0.06, s * 0.07, 0, Math.PI * 2); g.fill();
        break;
      case "peel":
        for (const a of [-0.7, 0, 0.7]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, s * 0.25, s * 0.2, s * 0.6, 0, 0, Math.PI * 2); clayFill(g, "#FFD25A", 0, s * 0.25, s * 0.6); g.restore(); }
        rr(g, -s * 0.12, -s * 0.75, s * 0.24, s * 0.5, s * 0.08); clayFill(g, "#C9A43A", 0, -s * 0.5, s * 0.3);
        break;
      case "duck":
        blob(g, 0, s * 0.25, s * 0.8, s * 0.55, "#FFD25A", { gloss: 0.5 });
        blob(g, s * 0.3, -s * 0.35, s * 0.42, s * 0.42, "#FFD25A", { gloss: 0.5 });
        blob(g, s * 0.78, -s * 0.28, s * 0.22, s * 0.11, "#FF8A3D", { gloss: 0.4 });
        eye(g, s * 0.42, -s * 0.45, s * 0.12, {});
        break;
      case "can":
        rr(g, -s * 0.45, -s * 0.7, s * 0.9, s * 1.5, s * 0.12); clayFill(g, "#B8C4D6", 0, 0, s);
        rr(g, -s * 0.45, -s * 0.3, s * 0.9, s * 0.6, 0); g.fillStyle = "#74C94E"; g.fill();
        g.fillStyle = "#FFFFFF"; g.font = `${s * 0.3}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BEANS", 0, 0);
        g.strokeStyle = "#8A97AA"; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -s * 0.7, s * 0.45, s * 0.1, 0, 0, Math.PI * 2); g.stroke();
        break;
    }
    g.restore();
  }

  // ------------------------------------------------------------ drawing: clue board
  private partW(g: G, p: Part, s: number) {
    if (typeof p === "string") { g.font = `${s}px ${FONT}`; return g.measureText(p).width; }
    if ("c" in p) { g.font = `${s * 0.78}px ${FONT}`; return g.measureText(COLS[p.c].name).width + s * 0.9; }
    if ("s" in p) return s * 1.45;
    if ("n" in p) return s * 1.3;
    return s * 1.15;
  }

  private drawParts(g: G, parts: Part[], x: number, y: number, s0: number, maxW: number) {
    let s = s0;
    const gap = () => s * 0.32;
    const total = () => parts.reduce((w, p) => w + this.partW(g, p, s), 0) + gap() * (parts.length - 1);
    while (total() > maxW && s > 9) s -= 1;
    let cx = x;
    for (const p of parts) {
      const w = this.partW(g, p, s);
      if (typeof p === "string") {
        g.font = `${s}px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(p, cx, y + 1);
      } else if ("c" in p) {
        const col = COLS[p.c].c;
        rr(g, cx, y - s * 0.62, w, s * 1.24, s * 0.62); clayFill(g, col, cx + w / 2, y, w * 0.6, { gloss: 0.35, rim: false });
        g.font = `${s * 0.78}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = p.c === 3 ? NAVY : "#FFFFFF"; g.fillText(COLS[p.c].name, cx + w / 2, y + 1);
      } else if ("s" in p) {
        blob(g, cx + w / 2, y, s * 0.68, s * 0.68, "#FFF8EA", { gloss: 0.3 });
        g.strokeStyle = "rgba(35,48,90,0.25)"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx + w / 2, y, s * 0.68, 0, Math.PI * 2); g.stroke();
        this.drawSym(g, p.s, cx + w / 2, y, s * 0.48);
      } else if ("n" in p) {
        rr(g, cx + s * 0.05, y - s * 0.6, w - s * 0.1, s * 1.2, s * 0.3); clayFill(g, "#FFD25A", cx + w / 2, y, s, { gloss: 0.4 });
        g.font = `${s * 0.9}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NAVY; g.fillText(String(p.n), cx + w / 2, y + 1);
      } else {
        g.save(); g.translate(cx + w / 2, y); g.scale(-p.a, 1);
        g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(-s * 0.05, -s * 0.45); g.lineTo(-s * 0.05, -s * 0.18); g.lineTo(s * 0.5, -s * 0.18); g.lineTo(s * 0.5, s * 0.18); g.lineTo(-s * 0.05, s * 0.18); g.lineTo(-s * 0.05, s * 0.45); g.closePath();
        clayFill(g, "#FF8A3D", 0, 0, s * 0.5, { gloss: 0.3 });
        g.restore();
      }
      cx += w + gap();
    }
  }

  private drawBoard(g: G, clues: Clue[], live: boolean) {
    const b = this.board, kr = this.kr;
    // speech tail towards Kranky
    g.fillStyle = "#FFFDF6";
    g.beginPath(); g.moveTo(b.x + 4, b.y + b.h * 0.58); g.lineTo(kr.x + kr.h * 0.28, kr.y - kr.h * 0.62); g.lineTo(b.x + 4, b.y + b.h * 0.8); g.closePath(); g.fill();
    shadow(g, b.x + b.w / 2, b.y + b.h + 4, b.w * 0.45, 9, 0.3);
    rr(g, b.x, b.y, b.w, b.h, 22); g.fillStyle = "#FFFDF6"; g.fill();
    rr(g, b.x, b.y, b.w, b.h, 22); g.strokeStyle = "#FFB3CC"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#FFFDF6"; g.beginPath(); g.moveTo(b.x + 6, b.y + b.h * 0.6); g.lineTo(b.x - 2, b.y + b.h * 0.69); g.lineTo(b.x + 6, b.y + b.h * 0.78); g.fill();
    // title tab
    const tw = Math.min(150, b.w * 0.5), th = 24;
    rr(g, b.x + 14, b.y - th * 0.55, tw, th, th / 2); clayFill(g, "#E8504F", b.x + 14 + tw / 2, b.y, tw * 0.6, { gloss: 0.3, rim: false });
    g.font = `${15}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF"; g.fillText("KRANKY'S CLUES", b.x + 14 + tw / 2, b.y + 1);
    const n = Math.max(2, this.boardRows, clues.length);
    const top = b.y + 18, avail = b.h - 26, rh = Math.min(46, avail / n);
    const fs = clamp(rh * 0.5, 12, 21);
    clues.forEach((c, j) => {
      if (c.pop <= 0.01) return;
      const y = top + rh * (j + 0.5);
      g.save(); g.translate(b.x + 16, y); g.scale(c.pop, c.pop); g.translate(-(b.x + 16), -y);
      if (c.fib) { rr(g, b.x + 8, y - rh * 0.46, b.w - 16, rh * 0.92, rh * 0.3); g.fillStyle = "rgba(255,111,145,0.16)"; g.fill(); }
      const br = Math.min(rh * 0.36, 14);
      blob(g, b.x + 14 + br, y, br, br, c.peek ? "#2EC4B6" : c.fib ? "#E8504F" : "#FFB000", { gloss: 0.4 });
      if (c.peek) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.ellipse(b.x + 14 + br, y, br * 0.7, br * 0.42, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = NAVY; g.beginPath(); g.arc(b.x + 14 + br, y, br * 0.25, 0, Math.PI * 2); g.fill(); }
      else { g.font = `${br * 1.25}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF"; g.fillText(c.fib ? "!" : String(j + 1), b.x + 14 + br, y + 1); }
      const tx = b.x + 14 + br * 2 + 8, maxW = b.x + b.w - tx - (c.fib ? 58 : 12);
      const hidden = live && this.vanish.v > 0.5 && !c.peek;
      if (hidden) {
        rr(g, tx, y - rh * 0.3, Math.min(maxW, 150), rh * 0.6, rh * 0.3); g.fillStyle = "rgba(35,48,90,0.12)"; g.fill();
        g.font = `${fs}px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "rgba(35,48,90,0.45)"; g.fillText("? ? ?", tx + 12, y + 1);
      } else {
        g.save();
        if (live && this.vanish.v > 0 && this.vanish.v <= 0.5 && !c.peek) { g.translate(0, y); g.scale(1, 1 - this.vanish.v * 2); g.translate(0, -y); }
        this.drawParts(g, c.parts, tx, y, fs, maxW);
        g.restore();
      }
      if (c.fib) { g.save(); g.translate(b.x + b.w - 34, y); g.rotate(-0.2); clayText(g, "FIB!", 0, 0, clamp(fs * 0.95, 13, 20), { fill: "#FF6F91" }); g.restore(); }
      g.restore();
      if (j < clues.length - 1) { g.strokeStyle = "rgba(35,48,90,0.08)"; g.lineWidth = 2; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(b.x + 14, y + rh / 2); g.lineTo(b.x + b.w - 14, y + rh / 2); g.stroke(); g.setLineDash([]); }
    });
    if (!clues.length && live && this.phase === "intro") clayText(g, "…", b.x + b.w / 2, b.y + b.h / 2, 40, { fill: "#FFB3CC" });
  }

  private drawKranky(g: G, mood: "happy" | "wow" | "sad") {
    const k = this.kr, laugh = mood === "sad" ? Math.max(0.6, this.kk.laugh) : this.kk.laugh;
    shadow(g, k.x, k.y - 2, k.h * 0.45, 7, 0.3);
    this.sprite(g, this.host(mood), k.x, k.y, k.h, {
      rot: Math.sin(this.t * 28) * 0.05 * laugh,
      sy: 1 + this.kk.bop * 0.06 + Math.sin(this.t * 2.4) * 0.015 + Math.abs(Math.sin(this.t * 20)) * 0.04 * laugh,
      sx: 1 - this.kk.bop * 0.03,
    });
  }

  private drawBar(g: G, live: boolean) {
    const b = this.bar, p = this.peekBtn;
    const can = live && this.phase === "pick" && this.peeks < 2 && this.peekPool.length > 0;
    g.save(); g.translate(Math.sin(p.wig * 30) * p.wig * 5, 0);
    if (!can && live) g.globalAlpha = 0.55;
    clayPanel(g, p.x, p.y, p.w, p.h, p.h / 2, "#2EC4B6", { lip: 6, pressed: p.press });
    const ey = p.y + (p.h - 6) / 2 + p.press * 5, ex = p.x + p.h * 0.62;
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.ellipse(ex, ey, p.h * 0.26, p.h * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = NAVY; g.beginPath(); g.arc(ex + Math.sin(this.t * 2) * 3, ey, p.h * 0.1, 0, Math.PI * 2); g.fill();
    clayText(g, "PEEK", p.x + p.w * 0.6, ey - 1, clamp(p.h * 0.36, 16, 24), { fill: "#FFFFFF", stroke: "#147A70" });
    const left = live ? Math.min(2 - this.peeks, this.peekPool.length) : 2;
    for (let i = 0; i < 2; i++) { g.fillStyle = i < left ? "#FFD25A" : "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(p.x + p.w - 14 - i * 11, p.y + 9, 4, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // tries (hearts) on the right, rounds (stars) on the left
    const hs = clamp(b.h * 0.2, 9, 13), side = (b.w - p.w) / 2;
    const hx = p.x + p.w + side / 2, hy = b.y + b.h / 2 - 3;
    const n = live ? this.triesMax : 3, have = live ? this.tries : 3;
    for (let i = 0; i < n; i++) this.heart(g, hx + (i - (n - 1) / 2) * hs * 2.4, hy, hs, i < have ? "#FF5C7A" : "rgba(255,255,255,0.3)");
    g.font = `${12}px ${FONT}`; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.85)"; g.fillText("TRIES", hx, hy + hs * 1.9);
    const sx = b.x + side / 2;
    for (let i = 0; i < this.rounds; i++) star(g, sx + (i - (this.rounds - 1) / 2) * hs * 2.6, hy, hs * 1.15, live && i < this.round ? "#FFD25A" : i === this.round && live ? "#FFF4C2" : "#8A5A9A", 0);
    g.fillText("ROUND", sx, hy + hs * 1.9);
  }

  private heart(g: G, x: number, y: number, r: number, c: string) {
    g.beginPath(); g.moveTo(x, y + r * 0.85); g.bezierCurveTo(x - r * 1.35, y - r * 0.05, x - r * 0.65, y - r * 1.15, x, y - r * 0.42); g.bezierCurveTo(x + r * 0.65, y - r * 1.15, x + r * 1.35, y - r * 0.05, x, y + r * 0.85);
    clayFill(g, c, x, y, r, { gloss: 0.4 });
  }

  private drawHideMomo(g: G) {
    if (!this.hide.on) return;
    const u = this.hide.u, d0 = this.doors[0], dn = this.doors[this.doors.length - 1];
    if (!d0) return;
    const x0 = this.kr.x, y0 = this.kr.y - this.kr.h * 0.2;
    const x1 = (d0.x + dn.x + dn.w) / 2, y1 = d0.y + 20;
    const x = lerp(x0, x1, u), y = lerp(y0, y1, ease.in(u)) - Math.sin(Math.PI * Math.min(1, u * 1.15)) * 120;
    const h = Math.min(80, d0.h * 0.55);
    this.sprite(g, MOMO.happy, x, y, h, { rot: u * 6.28 * 1.5 });
  }

  private scene(g: G, live: boolean) {
    if (!this.bg || this.bg.width !== Math.round(this.W * this.dpr)) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawStageBack(g);
    this.drawHideMomo(g);
    this.doors.forEach((d, i) => this.drawDoor(g, d, i, live));
    this.drawKranky(g, live ? this.hud.host.mood : "happy");
    this.drawBoard(g, this.clues, live);
    this.drawBar(g, live);
  }

  protected draw(g: G) { this.scene(g, true); }

  protected drawBackground(g: G) {
    if (!this.demo) {
      const doors: Door[] = [[0, "star"], [1, "moon"], [3, "heart"], [2, "fish"]].map(([c, s], i) => ({ c: c as number, s: s as Sym, junk: JUNK[i], x: 0, y: 0, w: 0, h: 0, open: i === 2 ? 0.75 : 0, wig: 0, drop: 0, hi: 0, pop: 1, state: i === 2 ? "right" : "closed" }));
      const clues: Clue[] = [{ kind: "cneq", parts: ["Not", { c: 0 }], set: 0, pop: 1 }, { kind: "seq", parts: ["It has a", { s: "heart" }], set: 0, pop: 1 }, { kind: "mid", parts: ["Not at either end"], set: 0, pop: 1 }];
      this.demo = { doors, clues };
    }
    const saved = { d: this.doors, c: this.clues, r: this.boardRows };
    this.doors = this.demo.doors; this.clues = this.demo.clues; this.boardRows = 3;
    this.layout();
    this.scene(g, false);
    this.doors = saved.d; this.clues = saved.c; this.boardRows = saved.r;
    this.layout();
  }
}
