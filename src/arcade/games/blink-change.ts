// Blink! — Noodle's room. Look, Noodle blinks, something changes (colour, missing, moved, swapped,
// size, flip, tilt). Tap what changed. Unlimited levels: more things, subtler changes, quicker looks.
import { ArcadeGame, Bag, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { blob, clayFill, darken, eye, lighten, mix, mouth, rr, shadow, star, type G } from "../paint";

type Kind = "ball" | "mug" | "lamp" | "plant" | "books" | "clock" | "teddy" | "apple" | "duck" | "gift" | "donut" | "cactus" | "star" | "sock" | "bone" | "bowl";
type Change = "color" | "missing" | "moved" | "swap" | "size" | "flip" | "tilt";
const KINDS: Kind[] = ["ball", "mug", "lamp", "plant", "books", "clock", "teddy", "apple", "duck", "gift", "donut", "cactus", "star", "sock", "bone", "bowl"];
const ASYM: Kind[] = ["mug", "duck", "sock", "lamp", "teddy", "cactus"];
const COLORS: Record<Kind, string[]> = {
  ball: ["#E8504F", "#3B82F6", "#2FA866", "#FF8A3D"], mug: ["#FF6F91", "#2EC4B6", "#FFC93C", "#9B5DE5"], lamp: ["#FFC93C", "#2EC4B6", "#FF6F91", "#9B5DE5"],
  plant: ["#E07A3F", "#3B82F6", "#FF6F91", "#9B5DE5"], books: ["#E8504F", "#3B82F6", "#2FA866", "#FFC93C"], clock: ["#2EC4B6", "#E8504F", "#FFC93C", "#9B5DE5"],
  teddy: ["#C98A4B", "#FF8FB1", "#B8B8C8", "#E8C27A"], apple: ["#E8504F", "#74C94E", "#FFC93C", "#FF8A3D"], duck: ["#FFD25A", "#FF8FB1", "#7CC8FF", "#9BE34A"],
  gift: ["#9B5DE5", "#E8504F", "#2EC4B6", "#3B82F6"], donut: ["#FF8FB1", "#C98A4B", "#9B5DE5", "#7CC8FF"], cactus: ["#E07A3F", "#FF6F91", "#3B82F6", "#FFC93C"],
  star: ["#FFD25A", "#FF6F91", "#7CC8FF", "#9BE34A"], sock: ["#E8504F", "#3B82F6", "#2FA866", "#9B5DE5"], bone: ["#F6E7C8", "#FFD25A", "#C8F0FF", "#FFC2D6"],
  bowl: ["#7CC8FF", "#9BE34A", "#FF8FB1", "#FFD25A"],
};
interface Obj { id: number; kind: Kind; color: string; cell: number; scale: number; flip: boolean; tilt: number; gone: boolean; wig: number; found: boolean }
interface Diff { obj: number; type: Change; oldCell: number; found: boolean }

export default class BlinkChange extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "blink-change", title: "Blink!", host: "noodle", style: "rounds",
    music: { calm: "a:blink_calm", action: "a:blink_action" },
    sounds: ["a:blink", "a:tink", "a:poof", "a:scramble", "a:slideUp", "a:honk", "a:ooh", "a:shutter"],
    voicePitch: 1.25,
    transition: "blink",
  };
  private objs: Obj[] = [];
  private cells: { x: number; y: number; s: number }[] = [];
  private diffs: Diff[] = [];
  private changes = new Bag<Change>(["color", "missing", "moved", "swap", "size", "flip", "tilt"]);
  private phase: "look" | "find" | "done" = "look";
  private phaseT = 0; private look = 5; private findLimit = 14; private wrongs = 0;
  private room = { x: 0, y: 0, w: 0, h: 0, floor: 0 };
  private dog = { x: 0, y: 0, w: 0 };
  private nextId = 0;

  protected onResize() { this.layoutRoom(); }

  private layoutRoom() {
    const A = this.area;
    const dogW = Math.min(this.W * 0.92, 520);
    const dogH = dogW * (322 / 760);
    this.room = { x: 10, y: A.y + 2, w: this.W - 20, h: A.h - 4, floor: A.y + A.h - dogH * 0.55 };
    this.dog = { x: this.W / 2, y: A.y + A.h + 2, w: dogW };
    // object cells fill the room above Noodle
    const top = A.y + 18, bottom = A.y + A.h - dogH * 0.92, left = 18, right = this.W - 18;
    const n = this.cells.length || 12;
    const w = right - left, h = Math.max(120, bottom - top);
    const cols = Math.max(3, Math.round(Math.sqrt((n * w) / h)));
    const rows = Math.ceil(n / cols);
    const cw = w / cols, ch = h / rows, s = clamp(Math.min(cw, ch) * 0.36, 18, 52);
    this.cells = Array.from({ length: cols * rows }, (_, i) => ({ x: left + ((i % cols) + 0.5) * cw, y: top + (Math.floor(i / cols) + 0.6) * ch, s }));
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = Math.min(byDiff(d, { easy: 14, medium: 18, hard: 24 }), byDiff(d, { easy: 4, medium: 6, hard: 8 }) + Math.floor((L - 1) / 1.5));
    this.look = ramp(L, byDiff(d, { easy: 5, medium: 4, hard: 3.5 }), -0.15, byDiff(d, { easy: 2.5, medium: 2, hard: 1.6 }));
    this.findLimit = byDiff(d, { easy: 15, medium: 12, hard: 10 });
    const nChanges = (d === "hard" && L >= 6) || (d === "medium" && L >= 12) ? 2 : 1;
    // grid with ~35% spare cells so things can move and the room stays readable
    this.cells = new Array(Math.ceil(n * 1.4)).fill(0).map(() => ({ x: 0, y: 0, s: 30 }));
    this.layoutRoom();
    const free = this.rng.shuffle([...this.cells.keys()]);
    const kinds = this.rng.shuffle([...KINDS]);
    this.objs = Array.from({ length: n }, (_, i) => {
      const kind = kinds[i % kinds.length];
      return { id: this.nextId++, kind, color: this.rng.pick(COLORS[kind]), cell: free[i], scale: 1, flip: this.rng.chance(0.5), tilt: 0, gone: false, wig: 0, found: false };
    });
    // plan the change(s) now, apply them while Noodle blinks
    const sub = clamp(1 - (L - 1) / byDiff(d, { easy: 26, medium: 20, hard: 16 }), 0, 1);
    this.diffs = [];
    const used = new Set<number>();
    for (let c = 0; c < nChanges; c++) {
      let type = this.changes.next(this.rng);
      let oi = this.rng.int(0, n - 1);
      while (used.has(oi)) oi = (oi + 1) % n;
      used.add(oi);
      const o = this.objs[oi];
      if (type === "flip" && !ASYM.includes(o.kind)) type = "tilt";
      this.diffs.push({ obj: o.id, type, oldCell: o.cell, found: false });
      (this.diffs[this.diffs.length - 1] as Diff & { sub: number }).sub = sub;
    }
    this.phase = "look"; this.phaseT = 0; this.wrongs = 0;
    this.hint(nChanges > 1 ? "Remember the room — TWO things will change! 👀" : "Remember everything in the room! 👀");
    this.react("happy", this.rng.pick(["Welcome to my room!", "Look closely!", "I'm watching too!", "Sniff sniff… remember it!"]));
    this.music("calm");
  }

  private applyChanges() {
    for (const df of this.diffs) {
      const o = this.objs.find((x) => x.id === df.obj)!;
      const sub = (df as Diff & { sub: number }).sub ?? 0.5;
      switch (df.type) {
        case "color": {
          const others = COLORS[o.kind].filter((c) => c !== o.color);
          const target = this.rng.pick(others);
          o.color = sub > 0.45 ? target : mix(o.color, target, 0.45 + sub * 0.5);
          break;
        }
        case "missing": o.gone = true; break;
        case "moved": {
          const taken = new Set(this.objs.map((x) => x.cell));
          const empties = [...this.cells.keys()].filter((i) => !taken.has(i));
          if (empties.length) o.cell = this.rng.pick(empties); else { o.gone = true; df.type = "missing"; }
          break;
        }
        case "swap": {
          const unused = KINDS.filter((k) => !this.objs.some((x) => x.kind === k));
          o.kind = unused.length ? this.rng.pick(unused) : (KINDS[(KINDS.indexOf(o.kind) + 5) % KINDS.length]);
          o.color = this.rng.pick(COLORS[o.kind]);
          break;
        }
        case "size": o.scale = 1 + (this.rng.chance(0.5) ? 1 : -0.6) * (0.16 + sub * 0.3); break;
        case "flip": o.flip = !o.flip; break;
        case "tilt": o.tilt = (this.rng.chance(0.5) ? 1 : -1) * (0.25 + sub * 0.4); break;
      }
    }
  }

  private startBlink() {
    this.phase = "done";
    this.timerBar(null);
    this.hint(null);
    this.react("wow", null);
    this.sfx("a:blink", { gain: 0.7 });
    this.transition("blink", () => {
      this.applyChanges();
      this.phase = "find"; this.phaseT = 0;
      this.hint(this.diffs.length > 1 ? "What TWO things changed? 👆" : "What changed? Tap it! 👆");
      this.react("happy", this.rng.pick(["Something's different!", "What changed?!", "Hmm… sniff sniff", "Did you see it?"]));
      if (this.level === 1 || this.level % 4 === 0) this.say("What changed?");
      this.music("action");
    }, 0.55, false);
  }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    if (this.phase !== "find") return;
    // hits on changed things (accept old spot for moved / missing)
    for (const df of this.diffs) {
      if (df.found) continue;
      const o = this.objs.find((v) => v.id === df.obj)!;
      const pts = [this.cells[o.cell]];
      if (df.type === "moved" || df.type === "missing") pts.push(this.cells[df.oldCell]);
      if (pts.some((c) => Math.hypot(c.x - x, c.y - y) < Math.max(34, c.s * 1.35 * o.scale))) {
        df.found = true; o.found = true;
        const c = this.cells[o.cell];
        this.good(c.x, c.y - c.s, 150, 1 - this.phaseT / this.findLimit);
        this.sfx("a:tink", { x: c.x, gain: 0.6 }); this.sfx("a:ooh", { gain: 0.35, delay: 0.1 });
        this.burst(c.x, c.y, { n: 18, colors: ["#FFD25A", "#7CF2C9", "#FFFFFF"], kind: "star", speed: 260 });
        if (this.diffs.every((v) => v.found)) {
          this.phase = "done"; this.timerBar(null); this.hint(null);
          this.react("happy", this.rng.pick(["You spotted it!", "Woof! Amazing!", "Sharp eyes!", "Good human!"]));
          this.after(0.9, () => this.levelClear({ perfect: this.wrongs === 0 }));
        } else this.hint("One more change to find!");
        return;
      }
    }
    // a wrong tap on an object?
    let hit: Obj | null = null;
    for (const o of this.objs) { if (o.gone) continue; const c = this.cells[o.cell]; if (Math.hypot(c.x - x, c.y - y) < c.s * 1.2) hit = o; }
    if (hit) hit.wig = 1;
    this.wrongs++;
    this.bad(x, y, { line: this.rng.pick(["Nope, that's the same!", "Not that!", "Ruff… try again!", "Same as before!"]) });
    if (this.wrongs >= 3) this.reveal("3 misses — here's what changed!");
  }

  private reveal(msg: string) {
    this.phase = "done"; this.timerBar(null); this.hint(null);
    for (const df of this.diffs) df.found = true;
    this.after(0.4, () => this.levelFail(msg));
  }

  protected update(dt: number) {
    this.phaseT += dt;
    for (const o of this.objs) o.wig = Math.max(0, o.wig - dt * 2);
    if (this.phase === "look") {
      this.timerBar(1 - this.phaseT / this.look, "#FFD25A");
      if (this.phaseT >= this.look) this.startBlink();
    } else if (this.phase === "find" && !this.ending) {
      const f = 1 - this.phaseT / this.findLimit;
      this.timerBar(f, f < 0.3 ? "#FF6F91" : "#7CF2C9");
      if (f <= 0) { this.sfx("a:honk", { gain: 0.5 }); this.reveal("Time's up — here's what changed!"); }
    }
  }

  // ------------------------------------------------------------ drawing
  private drawRoom(g: G) {
    const W = this.W, H = this.H, R = this.room;
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#FFE9D2"); wall.addColorStop(1, "#FFD9B5");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,138,61,0.10)";
    for (let y = 10; y < R.floor; y += 34) for (let x = (y / 34) % 2 ? 17 : 0; x < W; x += 34) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    // wooden shelves: every row of things sits on one
    const rowsY = [...new Set(this.cells.map((c) => Math.round(c.y)))];
    for (const y of rowsY) {
      const s = this.cells[0]?.s ?? 30;
      const sy = y + s * 1.02;
      if (sy > R.floor - 6) continue;
      rr(g, 8, sy, W - 16, 10, 5); g.fillStyle = "#B9784A"; g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(12, sy + 1, W - 24, 3);
      g.fillStyle = "rgba(0,0,0,0.10)"; g.fillRect(14, sy + 10, W - 28, 6);
    }
    // floor
    const fl = g.createLinearGradient(0, R.floor, 0, H); fl.addColorStop(0, "#C98A4B"); fl.addColorStop(1, "#9A6232");
    g.fillStyle = fl; g.fillRect(0, R.floor, W, H - R.floor);
    g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2;
    for (let y = R.floor + 16; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    blob(g, W / 2, R.floor + (H - R.floor) * 0.45, W * 0.42, (H - R.floor) * 0.3, "#9B5DE5", { gloss: 0.2 });
  }

  protected drawBackground(g: G) {
    this.layoutRoom();
    this.drawRoom(g);
    const demo: Kind[] = ["lamp", "plant", "teddy", "clock", "duck", "ball"];
    demo.forEach((k, i) => { const c = this.cells[i]; if (c) this.drawObj(g, { id: i, kind: k, color: COLORS[k][0], cell: i, scale: 1, flip: false, tilt: 0, gone: false, wig: 0, found: false }, c.x, c.y, c.s); });
    this.drawDog(g, "happy");
  }

  protected draw(g: G) {
    this.drawRoom(g);
    for (const o of this.objs) {
      if (o.gone) continue;
      const c = this.cells[o.cell];
      this.drawObj(g, o, c.x, c.y, c.s);
    }
    // found / revealed rings
    if (this.phase !== "look") for (const df of this.diffs) if (df.found) {
      const o = this.objs.find((v) => v.id === df.obj)!;
      const c = this.cells[o.gone ? df.oldCell : o.cell];
      g.strokeStyle = "#7CF2C9"; g.lineWidth = 5; g.setLineDash([10, 8]); g.lineDashOffset = -this.t * 40;
      g.beginPath(); g.arc(c.x, c.y - c.s * 0.2, c.s * 1.45 * o.scale, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (df.type === "moved") { const o2 = this.cells[df.oldCell]; g.strokeStyle = "rgba(124,242,201,0.5)"; g.beginPath(); g.arc(o2.x, o2.y - o2.s * 0.2, o2.s * 1.2, 0, Math.PI * 2); g.stroke(); }
    }
    this.drawDog(g, this.hud.host.mood);
  }

  private drawDog(g: G, mood: "happy" | "wow" | "sad") {
    const h = this.dog.w * (322 / 760);
    this.sprite(g, this.host(mood), this.dog.x, this.dog.y, h, { sy: 1 + Math.sin(this.t * 2.2) * 0.012 });
  }

  // ------------------------------------------------------------ clay props
  private drawObj(g: G, o: Obj, x: number, y: number, s0: number) {
    const s = s0 * o.scale;
    shadow(g, x, y + s * 0.95, s * 0.95, s * 0.22, 0.25);
    g.save(); g.translate(x + Math.sin(o.wig * 25) * o.wig * 6, y); g.rotate(o.tilt); if (o.flip) g.scale(-1, 1);
    const c = o.color, k = o.kind;
    if (k === "ball") { blob(g, 0, 0, s, s, c, { gloss: 0.5 }); g.strokeStyle = "#FFF4E2"; g.lineWidth = s * 0.16; g.beginPath(); g.arc(0, 0, s * 0.92, -0.6, 0.9); g.stroke(); }
    else if (k === "mug") { g.strokeStyle = darken(c, 0.15); g.lineWidth = s * 0.2; g.beginPath(); g.arc(s * 0.7, -s * 0.05, s * 0.38, -1.2, 1.2); g.stroke(); rr(g, -s * 0.7, -s * 0.8, s * 1.3, s * 1.7, s * 0.3); clayFill(g, c, 0, 0, s); blob(g, -s * 0.05, -s * 0.78, s * 0.62, s * 0.14, "#6B3B1F", { gloss: 0.2 }); }
    else if (k === "lamp") { g.fillStyle = "#5A4A63"; g.fillRect(-s * 0.08, -s * 0.2, s * 0.16, s * 1.1); blob(g, 0, s * 0.9, s * 0.5, s * 0.14, "#5A4A63"); g.beginPath(); g.moveTo(-s * 0.35, -s * 1.0); g.lineTo(s * 0.35, -s * 1.0); g.lineTo(s * 0.7, -s * 0.2); g.lineTo(-s * 0.7, -s * 0.2); g.closePath(); clayFill(g, c, 0, -s * 0.6, s * 0.8); }
    else if (k === "plant") { for (const a of [-0.8, -0.3, 0.2, 0.7]) blob(g, Math.sin(a) * s * 0.6, -s * 0.6 - Math.cos(a) * s * 0.4, s * 0.22, s * 0.5, "#4FA35B", { rot: a, gloss: 0.3 }); g.beginPath(); g.moveTo(-s * 0.6, -s * 0.15); g.lineTo(s * 0.6, -s * 0.15); g.lineTo(s * 0.45, s * 0.95); g.lineTo(-s * 0.45, s * 0.95); g.closePath(); clayFill(g, c, 0, s * 0.4, s * 0.7); }
    else if (k === "books") { const cs = [c, lighten(c, 0.3), darken(c, 0.2)]; cs.forEach((cc, i) => { rr(g, -s * 0.8 + i * s * 0.08, s * 0.5 - i * s * 0.45, s * 1.5 - i * s * 0.12, s * 0.42, s * 0.08); clayFill(g, cc, 0, s * 0.5 - i * s * 0.45, s * 0.8, { gloss: 0.2 }); g.fillStyle = "#FFF4E2"; g.fillRect(s * 0.55 - i * s * 0.05, s * 0.56 - i * s * 0.45, s * 0.1, s * 0.3); }); }
    else if (k === "clock") { blob(g, 0, 0, s, s, c, { gloss: 0.4 }); blob(g, 0, 0, s * 0.75, s * 0.75, "#FFF8EC", { gloss: 0.2 }); g.strokeStyle = "#23305A"; g.lineWidth = s * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.5); g.moveTo(0, 0); g.lineTo(s * 0.35, s * 0.1); g.stroke(); }
    else if (k === "teddy") { for (const sd of [-1, 1]) blob(g, sd * s * 0.62, -s * 0.62, s * 0.3, s * 0.3, c); blob(g, 0, 0, s * 0.9, s * 0.82, c, { gloss: 0.3 }); blob(g, 0, s * 0.25, s * 0.38, s * 0.28, lighten(c, 0.35)); eye(g, -s * 0.3, -s * 0.15, s * 0.14, {}); eye(g, s * 0.3, -s * 0.15, s * 0.14, {}); blob(g, 0, s * 0.15, s * 0.1, s * 0.07, "#3A2312"); }
    else if (k === "apple") { blob(g, 0, 0, s * 0.95, s * 0.88, c, { gloss: 0.55 }); g.strokeStyle = "#6B3B1F"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(0, -s * 0.8); g.lineTo(s * 0.1, -s * 1.15); g.stroke(); blob(g, s * 0.32, -s * 1.0, s * 0.25, s * 0.12, "#4FA35B", { rot: -0.4 }); }
    else if (k === "duck") { blob(g, 0, s * 0.25, s * 0.95, s * 0.6, c, { gloss: 0.5 }); blob(g, s * 0.35, -s * 0.45, s * 0.48, s * 0.45, c, { gloss: 0.5 }); blob(g, s * 0.88, -s * 0.38, s * 0.22, s * 0.1, "#FF8A3D"); eye(g, s * 0.45, -s * 0.55, s * 0.12, { look: [0.5, 0] }); }
    else if (k === "gift") { rr(g, -s * 0.85, -s * 0.6, s * 1.7, s * 1.5, s * 0.15); clayFill(g, c, 0, 0, s); g.fillStyle = "#FFD25A"; g.fillRect(-s * 0.12, -s * 0.6, s * 0.24, s * 1.5); g.fillRect(-s * 0.85, s * 0.05, s * 1.7, s * 0.22); for (const sd of [-1, 1]) blob(g, sd * s * 0.3, -s * 0.75, s * 0.3, s * 0.18, "#FFD25A", { rot: sd * 0.4 }); }
    else if (k === "donut") { blob(g, 0, 0, s, s * 0.85, "#E3A563", { gloss: 0.3 }); blob(g, 0, -s * 0.05, s * 0.88, s * 0.7, c, { gloss: 0.5 }); blob(g, 0, 0, s * 0.3, s * 0.24, "#FFE9D2"); const sp = ["#FFFFFF", "#FFD25A", "#7CC8FF", "#E8504F"]; for (let i = 0; i < 8; i++) { const a = i * 0.8; g.fillStyle = sp[i % 4]; g.save(); g.translate(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.45 - s * 0.05); g.rotate(a); g.fillRect(-s * 0.08, -s * 0.03, s * 0.16, s * 0.06); g.restore(); } }
    else if (k === "cactus") { g.beginPath(); g.moveTo(-s * 0.55, s * 0.3); g.lineTo(s * 0.55, s * 0.3); g.lineTo(s * 0.42, s * 1.0); g.lineTo(-s * 0.42, s * 1.0); g.closePath(); clayFill(g, c, 0, s * 0.6, s * 0.6); blob(g, 0, -s * 0.3, s * 0.32, s * 0.7, "#4FA35B", { gloss: 0.3 }); blob(g, s * 0.42, -s * 0.35, s * 0.15, s * 0.3, "#4FA35B"); blob(g, 0, -s * 1.0, s * 0.12, s * 0.09, "#FF7AB6"); }
    else if (k === "star") star(g, 0, 0, s, c, 0.1);
    else if (k === "sock") { g.beginPath(); g.moveTo(-s * 0.35, -s * 1.0); g.lineTo(s * 0.25, -s * 1.0); g.lineTo(s * 0.25, s * 0.2); g.quadraticCurveTo(s * 0.25, s * 0.55, s * 0.75, s * 0.55); g.quadraticCurveTo(s * 1.0, s * 0.8, s * 0.7, s * 0.95); g.lineTo(-s * 0.2, s * 0.95); g.quadraticCurveTo(-s * 0.45, s * 0.9, -s * 0.35, s * 0.5); g.closePath(); clayFill(g, c, 0, 0, s); g.fillStyle = "#FFF4E2"; g.fillRect(-s * 0.35, -s * 1.0, s * 0.6, s * 0.25); }
    else if (k === "bone") { blob(g, 0, 0, s * 0.75, s * 0.22, c, { gloss: 0.4 }); for (const sx of [-1, 1]) for (const sy of [-1, 1]) blob(g, sx * s * 0.75, sy * s * 0.18, s * 0.22, s * 0.22, c, { gloss: 0.4 }); }
    else if (k === "bowl") { g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fillStyle = "rgba(200,240,255,0.55)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 3; g.stroke(); g.fillStyle = mix(c, "#3B82F6", 0.4); g.beginPath(); g.arc(0, s * 0.15, s * 0.85, 0.15, Math.PI - 0.15); g.fill(); blob(g, Math.sin(this.t * 2) * s * 0.3, s * 0.35, s * 0.28, s * 0.17, "#FF8A3D"); }
    g.restore();
    void ease; void mouth;
  }
}
