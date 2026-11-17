// What's Missing? — Kranky's museum heist. Look at the toy shelf, the curtain closes, Kranky sneaks in and
// steals something… then pick the missing thing(s) from the options. Unlimited levels: fuller shelves,
// shorter looks, DOUBLE/TRIPLE steals, SHUFFLED shelves (no tell-tale gaps), fakes and look-alike decoys.
import { ArcadeGame, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta, type Mood } from "../engine";
import { INK, blob, clayFill, clayPanel, clayText, darken, eye, lighten, mouth, rr, shadow, star, type G } from "../paint";

type Kind = "bear" | "ball" | "duck" | "rocket" | "car" | "crown" | "gem" | "apple" | "banana" | "cherry" | "tophat" | "cap" | "robot" | "star" | "heart" | "donut" | "cupcake" | "umbrella" | "drum" | "boat" | "cactus" | "lolly";
const COLORS: Record<Kind, string[]> = {
  bear: ["#B9784A", "#FF8FB1", "#7CC8FF"], ball: ["#E8504F", "#3B82F6", "#2FA866"], duck: ["#FFD25A", "#FF8FB1"], rocket: ["#E8504F", "#3B82F6"],
  car: ["#E8504F", "#3B82F6", "#2FA866"], crown: ["#FFC93C", "#C9D3E3"], gem: ["#E8504F", "#3B82F6", "#2FA866", "#9B5DE5"], apple: ["#E8504F", "#74C94E"],
  banana: ["#FFD25A"], cherry: ["#E8504F"], tophat: ["#3A3550", "#9B5DE5"], cap: ["#E8504F", "#3B82F6"], robot: ["#9FB4CC", "#2EC4B6"],
  star: ["#FFD25A", "#FF8FB1"], heart: ["#E8504F", "#FF8FB1"], donut: ["#FF8FB1", "#7B4A2E"], cupcake: ["#FF8FB1", "#7CC8FF"],
  umbrella: ["#E8504F", "#9B5DE5"], drum: ["#E8504F", "#3B82F6"], boat: ["#FF8A3D", "#3B82F6"], cactus: ["#74C94E"], lolly: ["#FF6F91", "#9B5DE5"],
};
const KINDS = Object.keys(COLORS) as Kind[];
const ALL_IDS = KINDS.flatMap((k) => COLORS[k].map((_, i) => `${k}:${i}`));
const kindOf = (id: string) => id.split(":")[0] as Kind;
const colorOf = (id: string) => COLORS[kindOf(id)][Number(id.split(":")[1]) || 0];

interface Item { id: string; slot: number; pop: number; fake: boolean; poof: number }
interface Opt { id: string; x: number; y: number; r: number; state: "idle" | "right" | "wrong"; press: number; pop: number; glow: number; wig: number }
interface Flyer { id: string; x0: number; y0: number; slot: number; u: number }
type Phase = "look" | "steal" | "pick" | "done";

export default class WhatsMissing extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "whats-missing", title: "What's Missing?", host: "kranky", style: "rounds",
    music: { calm: "a:heist_calm", action: "a:heist_action" },
    sounds: ["a:curtain", "a:clunk", "a:squeak", "a:creak", "a:poof", "a:whistle", "a:tink", "a:click", "a:cheer", "snicker", "gibberKShort", "whooshShort", "pop"],
    voicePitch: 0.85, transition: "iris",
  };
  private items: Item[] = [];
  private stolen: string[] = [];
  private found: string[] = [];
  private opts: Opt[] = [];
  private flyers: Flyer[] = [];
  private slots: { x: number; y: number }[] = [];
  private cols = 3; private rowsN = 2; private itemS = 40;
  private phase: Phase = "look";
  private lookT = 5; private lookLeft = 5;
  private shuffleTw = false; private fakeTw = false; private lookalike = false;
  private mistakes = 0; private allowed = 1; private pickStart = 0;
  private recent = new Recent(24);
  private shelf = { x: 0, y: 0, w: 100, h: 100 };
  private tray = { x: 0, y: 0, w: 100, h: 100 };
  private ready = { x: 0, y: 0, w: 120, h: 50, press: 0 };
  private floorY = 0;
  private kr = { x: 0, h: 120, home: 0, hide: 0, walk: 0, grr: 0, laugh: 0, face: -1 };
  private sack = { x: 0, y: 0, n: 0, a: 0, carry: 0 };
  private drape = { c: 0, wob: 0 };

  // ------------------------------------------------------------ layout
  protected onResize() { this.layout(); }

  private krAsp() { const im = this.img(this.host("happy")); return im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1.58; }

  private layout() {
    const A = this.area, W = this.W, portrait = W < this.H * 1.05, asp = this.krAsp();
    if (portrait) {
      const trayH = clamp(A.h * 0.22, 120, 170), stripH = clamp(A.h * 0.17, 90, 140);
      this.shelf = { x: 10, y: A.y + 4, w: W - 20, h: A.h - trayH - stripH - 8 };
      this.floorY = this.shelf.y + this.shelf.h + stripH;
      this.tray = { x: 10, y: this.floorY + 6, w: W - 20, h: A.y + A.h - this.floorY - 6 };
      this.kr.h = Math.min(stripH * 1.05, (W * 0.5) / asp);
      this.kr.home = W - this.kr.h * asp * 0.45 - 6;
    } else {
      const sw = Math.min(W * 0.64, 900), trayH = clamp(A.h * 0.24, 110, 150);
      this.shelf = { x: Math.max(16, (W - sw) * 0.3), y: A.y + 4, w: sw, h: A.h - trayH - 14 };
      this.floorY = this.shelf.y + this.shelf.h;
      this.tray = { x: this.shelf.x, y: this.floorY + 10, w: sw, h: A.y + A.h - this.floorY - 10 };
      const colX = this.shelf.x + sw + 16, colW = W - colX - 10;
      this.kr.h = Math.min(A.h * 0.36, (colW * 0.95) / asp, 230);
      this.kr.home = colX + colW / 2;
    }
    if (this.phase !== "steal") this.kr.x = this.kr.home;
    const sackX = this.kr.home - this.kr.h * asp * 0.55;
    if (!this.sack.carry) { this.sack.x = portrait ? sackX : this.kr.home - this.kr.h * 0.2; this.sack.y = this.floorY - 2; }
    this.layoutSlots();
    this.layoutOpts();
  }

  private inner() { const S = this.shelf; return { x: S.x + 18, y: S.y + 22, w: S.w - 36, h: S.h - 34 }; }

  private layoutSlots() {
    const n = Math.max(this.items.length, 4), I = this.inner();
    let best = -1;
    for (let c = 2; c <= 8; c++) {
      const r = Math.ceil(n / c), sz = Math.min((I.w / c) * 0.8, (I.h / r) * 0.72) - (c * r - n) * 1.2;
      if (sz > best) { best = sz; this.cols = c; this.rowsN = r; }
    }
    const cw = I.w / this.cols, ch = I.h / this.rowsN;
    this.itemS = clamp(Math.min(cw * 0.4, ch * 0.36), 16, 56);
    this.slots = [];
    for (let r = 0; r < this.rowsN; r++) for (let c = 0; c < this.cols; c++) this.slots.push({ x: I.x + (c + 0.5) * cw, y: I.y + (r + 1) * ch - 10 });
  }

  private layoutOpts() {
    const T = this.tray, n = this.opts.length;
    this.ready = { ...this.ready, w: Math.min(150, T.w * 0.4), h: 54, x: T.x + T.w - Math.min(150, T.w * 0.4) - 14, y: T.y + T.h / 2 - 25 };
    if (!n) return;
    const portrait = this.W < this.H * 1.05;
    const rows = portrait && n > 4 ? 2 : 1, cols = Math.ceil(n / rows);
    const r = Math.max(24, Math.min(46, (T.w - 20) / cols / 2 - 8, (T.h - 18) / rows / 2 - 7));
    const sp = Math.min((T.w - 20) / cols, r * 2 + 26), rh = (T.h - 8) / rows;
    this.opts.forEach((o, i) => {
      const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), col = i % cols;
      o.x = T.x + T.w / 2 + (col - (inRow - 1) / 2) * sp; o.y = T.y + 4 + rh * (row + 0.5); o.r = r;
    });
  }

  private slotPos(i: number) { return this.slots[i] ?? { x: this.W / 2, y: this.H / 2 }; }

  // ------------------------------------------------------------ levels
  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = byDiff(d, { easy: Math.min(12, 4 + Math.floor((L - 1) / 2)), medium: Math.min(16, 6 + Math.floor((L - 1) / 2)), hard: Math.min(20, 8 + Math.floor((L - 1) * 0.6)) });
    const k = byDiff(d, {
      easy: L >= 12 && L % 3 === 0 ? 2 : 1,
      medium: L >= 14 ? (L % 3 === 0 ? 3 : 2) : L >= 5 && L % 2 === 1 ? 2 : 1,
      hard: L >= 8 ? (L % 2 === 0 ? 3 : 2) : L >= 3 ? 2 : 1,
    });
    this.shuffleTw = byDiff(d, { easy: L >= 6 && L % 2 === 0, medium: L >= 4 && L % 3 !== 1, hard: L >= 2 && L % 4 !== 1 });
    this.fakeTw = byDiff(d, { easy: L >= 10 && L % 4 === 3, medium: L >= 8 && L % 3 === 2, hard: L >= 5 && L % 3 === 0 });
    this.lookalike = byDiff(d, { easy: false, medium: L >= 10, hard: L >= 6 });
    const dupKinds = byDiff(d, { easy: false, medium: L >= 12, hard: L >= 7 });
    const nOpts = clamp(k + byDiff(d, { easy: L < 4 ? 2 : 3, medium: L < 6 ? 3 : 4, hard: L < 6 ? 4 : 5 }), 3, 6);
    this.allowed = byDiff(d, { easy: 2, medium: 1, hard: 1 });
    // fresh shelf + loot, never a recent one
    let shelfIds: string[] = [], loot: string[] = [];
    for (let tries = 0; tries < 30; tries++) {
      shelfIds = [];
      for (const id of this.rng.shuffle([...ALL_IDS])) {
        if (shelfIds.length >= n) break;
        if (!dupKinds && shelfIds.some((s) => kindOf(s) === kindOf(id))) continue;
        if (shelfIds.includes(id)) continue;
        shelfIds.push(id);
      }
      loot = this.rng.shuffle([...shelfIds]).slice(0, k);
      const sig = [...shelfIds].sort().join(",") + "|" + [...loot].sort().join(",");
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    this.items = shelfIds.map((id) => ({ id, slot: 0, pop: 0, fake: false, poof: 0 }));
    this.layoutSlots();
    const slotIdx = this.rng.shuffle([...this.slots.keys()]);
    this.items.forEach((it, i) => { it.slot = slotIdx[i]; });
    this.origSlot = new Map(this.items.map((it) => [it.id, it.slot]));
    this.poofed.clear();
    this.stolen = loot; this.found = []; this.flyers = []; this.mistakes = 0;
    // options: the loot + decoys (never-seen things, look-alikes, things still on the shelf)
    const never = this.rng.shuffle(ALL_IDS.filter((id) => !shelfIds.includes(id)));
    const farNever = never.filter((id) => !shelfIds.some((s) => kindOf(s) === kindOf(id)));
    const looks = this.lookalike ? this.rng.shuffle(never.filter((id) => loot.some((l) => kindOf(l) === kindOf(id)))) : [];
    const stay = d === "easy" ? [] : this.rng.shuffle(shelfIds.filter((id) => !loot.includes(id)));
    const decoys: string[] = [];
    const take = (list: string[], max: number) => { for (const id of list) { if (decoys.length >= nOpts - k || max <= 0) break; if (!decoys.includes(id) && !loot.includes(id)) { decoys.push(id); max--; } } };
    take(looks, Math.min(2, k));
    take(stay, d === "hard" ? 2 : 1);
    take(farNever, 9);
    take(never, 9);
    this.opts = this.rng.shuffle([...loot, ...decoys]).map((id) => ({ id, x: 0, y: 0, r: 30, state: "idle" as const, press: 0, pop: 0, glow: 0, wig: 0 }));
    this.fakeId = this.fakeTw ? (never.find((id) => !decoys.includes(id)) ?? "") : "";
    this.lookT = byDiff(d, { easy: ramp(L, 4.5, -0.12, 2.6) + n * 0.3, medium: ramp(L, 4, -0.12, 2.2) + n * 0.25, hard: ramp(L, 3.5, -0.12, 1.8) + n * 0.2 });
    this.lookLeft = this.lookT + 1.3; // the clock starts once the LEVEL banner is gone
    this.drape.c = 0; this.drape.wob = 0;
    this.kr = { ...this.kr, hide: 0, walk: 0, grr: 0, laugh: 0, face: -1 };
    this.sack = { ...this.sack, n: 0, a: 0, carry: 0 };
    this.phase = "look";
    this.layout();
    this.items.forEach((it, i) => this.tween(it, { pop: 1 }, 0.45, ease.back, 0.1 + i * 0.04));
    this.sfx("pop", { gain: 0.35, delay: 0.15 });
    this.hint(n <= 6 ? "Look closely! Remember everything on the shelf 👀" : `Look closely! ${n} things on the shelf 👀`);
    this.react("happy", this.rng.pick(["Ooh, shiny toys…", "Nobody's watching… heh heh", "I want ALL of them!", "Look all you like…"]));
    this.sfx("snicker", { gain: 0.45, delay: 0.6 });
    this.music(k >= 2 || n >= 12 ? "action" : "calm");
  }
  private fakeId = "";

  private closeCurtain() {
    if (this.phase !== "look") return;
    this.phase = "steal"; this.timerBar(null);
    this.hint("Shhh… Kranky is sneaking in! 🤫");
    this.sfx("a:curtain", { gain: 0.75 });
    this.tween(this.drape, { c: 1 }, 0.7, ease.inOut);
    const S = this.shelf, cx = S.x + S.w / 2, k = this.stolen.length;
    this.after(0.8, () => {
      this.sfx("snicker", { gain: 0.6 });
      this.kr.walk = 1; this.kr.face = cx < this.kr.x ? -1 : 1;
      this.tween(this.kr, { x: cx }, 1.1, ease.inOut);
      this.sfx("a:creak", { gain: 0.35, delay: 0.5 });
    });
    this.after(2.0, () => {
      this.kr.walk = 0;
      this.sfx("whooshShort", { gain: 0.5 });
      this.tween(this.kr, { hide: 1 }, 0.3, ease.in);
    });
    const behind = 2.4;
    this.after(behind, () => { this.doSteal(); this.drape.wob = 1; });
    for (let i = 0; i < k; i++) this.after(behind + 0.15 + i * 0.35, () => { this.sfx("a:clunk", { gain: 0.6, rate: 0.9 + i * 0.12 }); this.drape.wob = 1; });
    if (this.fakeId) this.after(behind + 0.2 + k * 0.35, () => this.sfx("a:squeak", { gain: 0.5 }));
    const out = behind + 0.45 + k * 0.35 + (this.fakeId ? 0.3 : 0);
    this.after(out, () => {
      this.sack.carry = 1; this.sack.n = k; this.sack.a = 1;
      this.tween(this.kr, { hide: 0 }, 0.3, ease.back);
      this.sfx("snicker", { gain: 0.6 });
    });
    this.after(out + 0.4, () => {
      this.kr.walk = 1; this.kr.face = this.kr.home > this.kr.x ? 1 : -1;
      this.sfx("whooshShort", { gain: 0.5 });
      this.tween(this.kr, { x: this.kr.home }, 0.65, ease.inOut);
    });
    this.after(out + 1.1, () => {
      this.kr.walk = 0; this.sack.carry = 0; this.layout();
      this.sfx("a:curtain", { gain: 0.75 });
      this.tween(this.drape, { c: 0 }, 0.7, ease.inOut);
    });
    this.after(out + 1.75, () => this.startPick());
  }

  /** (hidden behind the curtain) take the loot, maybe leave a fake, maybe shuffle the shelf */
  private doSteal() {
    const gone = this.items.filter((it) => this.stolen.includes(it.id));
    this.items = this.items.filter((it) => !this.stolen.includes(it.id));
    if (this.fakeId) this.items.push({ id: this.fakeId, slot: gone[0]?.slot ?? 0, pop: 1, fake: true, poof: 0 });
    if (this.shuffleTw) {
      const idx = this.rng.shuffle([...this.slots.keys()]);
      this.items.forEach((it, i) => { it.slot = idx[i]; });
    }
  }

  private startPick() {
    this.phase = "pick"; this.pickStart = this.t;
    const k = this.stolen.length;
    this.layoutOpts();
    this.opts.forEach((o, i) => { o.pop = 0; this.tween(o, { pop: 1 }, 0.4, ease.back, i * 0.07); this.sfx("pop", { x: o.x, gain: 0.3, rate: 1 + i * 0.08, delay: i * 0.07 }); });
    this.hint(k === 1 ? "What's missing? Tap it! 🔍" : `${k} things are missing — find them all! 🔍`);
    const tw: [string, string, "pink" | "red" | "gold" | "mint"] | null =
      this.fakeId ? ["SNEAKY SWAP!", "Kranky left a fake!", "red"]
        : this.shuffleTw && (this.attempt === 0 || this.rng.chance(0.5)) ? ["SHUFFLED!", "Kranky moved everything!", "pink"]
          : k > 1 ? [k === 2 ? "DOUBLE STEAL!" : "TRIPLE STEAL!", `Find all ${k} missing things`, "gold"]
            : this.lookalike && this.level % 3 === 0 ? ["LOOK CLOSER!", "Some look alike!", "mint"] : null;
    if (tw) this.banner(tw[0], tw[1], tw[2]);
    this.react("happy", this.rng.pick(["Bet you can't guess!", "What did I take? Heh!", "Nothing's missing… honest!", "Catch me if you can!"]), false);
    if (this.level === 1 && this.attempt === 0) this.say("What's missing?");
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    if (this.phase === "look" && (key === "Enter" || key === "r" || key === "R")) { this.pressReady(); return; }
    const k = Number(key) - 1;
    if (this.phase === "pick" && k >= 0 && k < this.opts.length) this.pick(this.opts[k]);
  }

  private pressReady() {
    this.ready.press = 1; this.tween(this.ready, { press: 0 }, 0.25);
    this.sfx("a:click", { gain: 0.6 });
    this.closeCurtain();
  }

  protected onDown(x: number, y: number) {
    if (this.phase === "look") {
      const b = this.ready;
      if (x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8) this.pressReady();
      return;
    }
    if (this.phase !== "pick") return;
    const o = this.opts.find((o) => Math.hypot(x - o.x, y - o.y) <= o.r + 10);
    if (o) this.pick(o);
  }

  private pick(o: Opt) {
    if (o.state !== "idle" || this.phase !== "pick") return;
    o.press = 1; this.tween(o, { press: 0 }, 0.25);
    if (this.stolen.includes(o.id) && !this.found.includes(o.id)) {
      o.state = "right"; this.found.push(o.id);
      const speed = clamp(1 - (this.t - this.pickStart) / (4 + this.stolen.length * 2.5), 0, 1);
      this.good(o.x, o.y - o.r, 100, speed);
      this.sfx("a:tink", { x: o.x, gain: 0.5, delay: 0.1 });
      // the item flies out of Kranky's sack back onto the shelf
      const free = this.freeSlot(o.id);
      this.flyers.push({ id: o.id, x0: this.sack.x, y0: this.sack.y - this.kr.h * 0.25, slot: free, u: 0 });
      const f = this.flyers[this.flyers.length - 1];
      this.tween(f, { u: 1 }, 0.6, ease.inOut).then(() => {
        this.flyers = this.flyers.filter((x) => x !== f);
        const fake = this.items.find((it) => it.fake && it.slot === free);
        if (fake) { fake.poof = 0.0001; this.tween(fake, { poof: 1 }, 0.5); this.sfx("a:poof", { gain: 0.6 }); this.float("FAKE!", this.slotPos(free).x, this.slotPos(free).y - this.itemS * 1.6, "#FF8FB1", 24); }
        this.items.push({ id: o.id, slot: free, pop: 0.6, fake: false, poof: 0 });
        const it = this.items[this.items.length - 1];
        this.tween(it, { pop: 1 }, 0.35, ease.back);
        const p = this.slotPos(free);
        this.burst(p.x, p.y - this.itemS, { n: 12, colors: ["#FFD25A", "#FFFFFF", "#7CF2C9"], kind: "star", speed: 200, size: 5 });
      });
      this.sack.n = Math.max(0, this.sack.n - 1);
      this.kr.grr = 1;
      this.sfx("gibberKShort", { gain: 0.5, delay: 0.2 });
      if (this.found.length >= this.stolen.length) this.win();
      else this.hint(`Got one! ${this.stolen.length - this.found.length} more to find 🔍`);
      return;
    }
    o.state = "wrong"; this.mistakes++; o.wig = 1;
    this.kr.laugh = 1;
    this.sfx("snicker", { gain: 0.6, delay: 0.15 });
    this.bad(o.x, o.y, { line: this.rng.pick(["Hah! Not that one!", "Nope! Heh heh!", "I didn't take THAT!", "Wrong-o!"]) });
    if (this.mistakes > this.allowed) {
      this.phase = "done"; this.hint(null);
      for (const op of this.opts) if (this.stolen.includes(op.id) && op.state === "idle") { op.glow = 1; }
      this.after(1.8, () => this.levelFail(this.stolen.length > 1 ? "Kranky got away with them!" : "Kranky got away with it!"));
    } else this.hint(this.mistakes === this.allowed ? "Careful! Last try 🔍" : "Not that one — look again 🔍");
  }

  /** where a returned item goes: its old spot if it's free (or holds the fake), otherwise any empty spot */
  private freeSlot(id: string) {
    const taken = new Set(this.items.filter((it) => !it.fake || it.poof > 0).map((it) => it.slot));
    for (const f of this.flyers) taken.add(f.slot);
    const own = this.origSlot.get(id);
    if (!this.shuffleTw && own != null && !taken.has(own)) return own;
    const free = [...this.slots.keys()].filter((i) => !taken.has(i) && !this.items.some((it) => it.slot === i));
    return free.length ? free[0] : (own ?? 0);
  }
  private origSlot = new Map<string, number>();

  private win() {
    this.phase = "done"; this.hint(null);
    this.after(0.75, () => {
      this.sfx("a:whistle", { gain: 0.6 });
      this.sfx("a:cheer", { gain: 0.5, delay: 0.25 });
      for (const it of this.items) if (it.fake && it.poof === 0) { it.poof = 0.0001; this.tween(it, { poof: 1 }, 0.5); this.sfx("a:poof", { gain: 0.5 }); }
      this.kr.grr = 1.5;
      this.levelClear({ perfect: this.mistakes === 0, title: this.mistakes === 0 ? "CAUGHT HIM!" : "GOT IT ALL!" });
      this.react("sad", this.rng.pick(["Curses! Foiled again!", "Hmph! You're too good!", "My precious loot!", "Not fair!"]), false);
    });
  }

  protected update(dt: number) {
    if (this.phase === "look") {
      this.lookLeft -= dt;
      this.timerBar(Math.min(1, this.lookLeft / this.lookT), "#FFD25A");
      if (this.lookLeft <= 0) this.closeCurtain();
    }
    this.kr.grr = Math.max(0, this.kr.grr - dt * 1.2);
    this.kr.laugh = Math.max(0, this.kr.laugh - dt * 1.0);
    this.drape.wob = Math.max(0, this.drape.wob - dt * 2.5);
    for (const o of this.opts) o.wig = Math.max(0, o.wig - dt * 2);
  }

  // ------------------------------------------------------------ drawing: items
  private drawItem(g: G, id: string, x: number, y: number, s: number) {
    const k = kindOf(id), c = colorOf(id);
    g.save(); g.translate(x, y);
    switch (k) {
      case "bear": {
        blob(g, 0, s * 0.48, s * 0.5, s * 0.42, c);
        blob(g, 0, s * 0.52, s * 0.25, s * 0.22, lighten(c, 0.35));
        for (const sd of [-1, 1]) { blob(g, sd * s * 0.42, -s * 0.62, s * 0.2, s * 0.2, c); blob(g, sd * s * 0.42, -s * 0.62, s * 0.1, s * 0.1, lighten(c, 0.35)); }
        blob(g, 0, -s * 0.18, s * 0.52, s * 0.46, c);
        blob(g, 0, -s * 0.03, s * 0.22, s * 0.15, lighten(c, 0.45));
        g.fillStyle = INK; g.beginPath(); g.ellipse(0, -s * 0.09, s * 0.07, s * 0.05, 0, 0, Math.PI * 2); g.fill();
        for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * s * 0.2, -s * 0.28, s * 0.06, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case "ball": {
        const r = s * 0.82, cy = s * 0.1, cols = [c, "#FFFFFF", "#FFD25A", c, "#FFFFFF", "#FFD25A"];
        g.save(); g.beginPath(); g.arc(0, cy, r, 0, Math.PI * 2); g.clip();
        cols.forEach((col, i) => { g.beginPath(); g.moveTo(0, cy); g.arc(0, cy, r, (i / 6) * Math.PI * 2 - 0.3, ((i + 1) / 6) * Math.PI * 2 - 0.3); g.closePath(); g.fillStyle = col; g.fill(); });
        this.gloss(g, 0, cy, r);
        g.restore();
        blob(g, 0, cy, r * 0.16, r * 0.16, "#FFFFFF");
        break;
      }
      case "duck": {
        g.beginPath(); g.moveTo(s * 0.55, s * 0.25); g.lineTo(s * 0.95, -s * 0.12); g.lineTo(s * 0.8, s * 0.48); g.closePath(); clayFill(g, c, s * 0.75, s * 0.2, s * 0.4);
        blob(g, s * 0.1, s * 0.4, s * 0.72, s * 0.42, c);
        blob(g, s * 0.22, s * 0.32, s * 0.3, s * 0.17, darken(c, 0.1), { rot: -0.3 });
        blob(g, -s * 0.28, -s * 0.24, s * 0.38, s * 0.36, c);
        blob(g, -s * 0.7, -s * 0.16, s * 0.22, s * 0.1, "#FF8A3D");
        eye(g, -s * 0.3, -s * 0.32, s * 0.13, { look: [-0.5, 0] });
        break;
      }
      case "rocket": {
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.25, s * 0.2); g.lineTo(sd * s * 0.65, s * 0.78); g.lineTo(sd * s * 0.2, s * 0.68); g.closePath(); clayFill(g, c, sd * s * 0.4, s * 0.5, s * 0.4); }
        blob(g, 0, s * 0.92, s * 0.13, s * 0.18, "#FFB000", { gloss: 0.6 });
        g.beginPath(); g.ellipse(0, s * 0.05, s * 0.34, s * 0.8, 0, 0, Math.PI * 2); clayFill(g, "#F4F1EA", 0, 0, s * 0.8);
        g.beginPath(); g.ellipse(0, s * 0.05, s * 0.34, s * 0.8, 0, Math.PI * 1.2, Math.PI * 1.8); g.closePath(); clayFill(g, c, 0, -s * 0.5, s * 0.4);
        blob(g, 0, -s * 0.02, s * 0.16, s * 0.16, "#7CC8FF", { gloss: 0.7 });
        g.strokeStyle = darken(c, 0.2); g.lineWidth = s * 0.05; g.beginPath(); g.arc(0, -s * 0.02, s * 0.17, 0, Math.PI * 2); g.stroke();
        break;
      }
      case "car": {
        rr(g, -s * 0.44, -s * 0.44, s * 0.88, s * 0.52, s * 0.18); clayFill(g, lighten(c, 0.1), 0, -s * 0.2, s * 0.5);
        g.fillStyle = "#BFE6FF"; rr(g, -s * 0.34, -s * 0.36, s * 0.3, s * 0.3, s * 0.07); g.fill(); rr(g, s * 0.04, -s * 0.36, s * 0.3, s * 0.3, s * 0.07); g.fill();
        rr(g, -s * 0.9, -s * 0.04, s * 1.8, s * 0.52, s * 0.22); clayFill(g, c, 0, s * 0.2, s * 0.9);
        blob(g, s * 0.8, s * 0.12, s * 0.08, s * 0.08, "#FFF4B0", { gloss: 0.7 });
        for (const sd of [-1, 1]) { blob(g, sd * s * 0.5, s * 0.52, s * 0.23, s * 0.23, "#2B2B3A"); blob(g, sd * s * 0.5, s * 0.52, s * 0.09, s * 0.09, "#C9D3E3"); }
        break;
      }
      case "crown": {
        g.beginPath(); g.moveTo(-s * 0.75, s * 0.5); g.lineTo(-s * 0.82, -s * 0.38); g.lineTo(-s * 0.4, 0); g.lineTo(0, -s * 0.58); g.lineTo(s * 0.4, 0); g.lineTo(s * 0.82, -s * 0.38); g.lineTo(s * 0.75, s * 0.5); g.closePath();
        clayFill(g, c, 0, 0, s * 0.85, { gloss: 0.5 });
        rr(g, -s * 0.78, s * 0.28, s * 1.56, s * 0.26, s * 0.08); clayFill(g, darken(c, 0.12), 0, s * 0.4, s * 0.8);
        ["#E8504F", "#3B82F6", "#2FA866"].forEach((jc, i) => blob(g, (i - 1) * s * 0.42, s * 0.41, s * 0.09, s * 0.09, jc, { gloss: 0.7 }));
        for (const [px, py] of [[-0.82, -0.38], [0, -0.58], [0.82, -0.38]]) blob(g, px * s, py * s, s * 0.1, s * 0.1, lighten(c, 0.2));
        break;
      }
      case "gem": {
        g.beginPath(); g.moveTo(-s * 0.8, -s * 0.15); g.lineTo(-s * 0.45, -s * 0.58); g.lineTo(s * 0.45, -s * 0.58); g.lineTo(s * 0.8, -s * 0.15); g.lineTo(0, s * 0.82); g.closePath();
        clayFill(g, c, 0, 0, s * 0.85, { gloss: 0.55 });
        g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = Math.max(1, s * 0.05);
        g.beginPath(); g.moveTo(-s * 0.8, -s * 0.15); g.lineTo(s * 0.8, -s * 0.15);
        g.moveTo(-s * 0.2, -s * 0.58); g.lineTo(-s * 0.32, -s * 0.15); g.lineTo(0, s * 0.82); g.moveTo(s * 0.2, -s * 0.58); g.lineTo(s * 0.32, -s * 0.15); g.lineTo(0, s * 0.82); g.stroke();
        star(g, -s * 0.38, -s * 0.38, s * 0.14, "#FFFFFF");
        break;
      }
      case "apple": {
        blob(g, 0, s * 0.16, s * 0.74, s * 0.68, c, { gloss: 0.5 });
        g.strokeStyle = "#7A4A20"; g.lineWidth = s * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -s * 0.42); g.quadraticCurveTo(s * 0.02, -s * 0.62, s * 0.1, -s * 0.74); g.stroke();
        blob(g, s * 0.3, -s * 0.6, s * 0.24, s * 0.11, "#4FAF6A", { rot: -0.5 });
        break;
      }
      case "banana": {
        g.lineCap = "round"; g.strokeStyle = darken(c, 0.15); g.lineWidth = s * 0.52; g.beginPath(); g.arc(0, -s * 0.75, s * 1.05, 0.32 * Math.PI, 0.78 * Math.PI); g.stroke();
        g.strokeStyle = c; g.lineWidth = s * 0.4; g.beginPath(); g.arc(0, -s * 0.78, s * 1.05, 0.33 * Math.PI, 0.77 * Math.PI); g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = s * 0.08; g.beginPath(); g.arc(0, -s * 0.88, s * 1.05, 0.4 * Math.PI, 0.65 * Math.PI); g.stroke();
        blob(g, Math.cos(0.32 * Math.PI) * s * 1.05, -s * 0.75 + Math.sin(0.32 * Math.PI) * s * 1.05, s * 0.07, s * 0.07, "#5A3420");
        break;
      }
      case "cherry": {
        g.strokeStyle = "#4F8F33"; g.lineWidth = s * 0.1; g.lineCap = "round";
        g.beginPath(); g.moveTo(-s * 0.35, s * 0.15); g.quadraticCurveTo(-s * 0.1, -s * 0.7, s * 0.15, -s * 0.85); g.moveTo(s * 0.4, s * 0.2); g.quadraticCurveTo(s * 0.3, -s * 0.4, s * 0.15, -s * 0.85); g.stroke();
        blob(g, s * 0.25, -s * 0.8, s * 0.2, s * 0.09, "#4FAF6A", { rot: -0.4 });
        blob(g, -s * 0.38, s * 0.4, s * 0.38, s * 0.38, c, { gloss: 0.6 }); blob(g, s * 0.42, s * 0.45, s * 0.38, s * 0.38, darken(c, 0.08), { gloss: 0.6 });
        break;
      }
      case "tophat": {
        blob(g, 0, s * 0.58, s * 0.88, s * 0.18, darken(c, 0.05));
        rr(g, -s * 0.5, -s * 0.68, s, s * 1.26, s * 0.12); clayFill(g, c, 0, 0, s * 0.8);
        g.fillStyle = "#E8504F"; g.fillRect(-s * 0.5, s * 0.22, s, s * 0.2);
        blob(g, 0, -s * 0.68, s * 0.5, s * 0.1, lighten(c, 0.18));
        break;
      }
      case "cap": {
        blob(g, s * 0.48, s * 0.42, s * 0.55, s * 0.15, darken(c, 0.12));
        g.beginPath(); g.ellipse(-s * 0.05, s * 0.42, s * 0.72, s * 0.8, 0, Math.PI, Math.PI * 2); g.closePath(); clayFill(g, c, -s * 0.05, 0, s * 0.8);
        g.strokeStyle = darken(c, 0.2); g.lineWidth = Math.max(1, s * 0.05);
        g.beginPath(); g.moveTo(-s * 0.05, -s * 0.38); g.lineTo(-s * 0.05, s * 0.42); g.stroke();
        blob(g, -s * 0.05, -s * 0.4, s * 0.1, s * 0.07, lighten(c, 0.25));
        star(g, -s * 0.38, s * 0.08, s * 0.17, "#FFFFFF");
        break;
      }
      case "robot": {
        rr(g, -s * 0.42, s * 0.15, s * 0.84, s * 0.65, s * 0.15); clayFill(g, c, 0, s * 0.45, s * 0.5);
        g.strokeStyle = "#5C6B80"; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(0, -s * 0.55); g.lineTo(0, -s * 0.78); g.stroke();
        blob(g, 0, -s * 0.84, s * 0.09, s * 0.09, "#E8504F", { gloss: 0.7 });
        rr(g, -s * 0.55, -s * 0.58, s * 1.1, s * 0.7, s * 0.2); clayFill(g, lighten(c, 0.12), 0, -s * 0.25, s * 0.6);
        g.fillStyle = "#1E2A44"; rr(g, -s * 0.4, -s * 0.47, s * 0.8, s * 0.46, s * 0.12); g.fill();
        for (const sd of [-1, 1]) blob(g, sd * s * 0.18, -s * 0.26, s * 0.08, s * 0.08, "#7CF2FF", { gloss: 0.8 });
        blob(g, 0, s * 0.45, s * 0.09, s * 0.09, "#FFD25A");
        break;
      }
      case "star": {
        star(g, 0, s * 0.05, s * 0.88, c, 0);
        g.fillStyle = INK; for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * s * 0.17, -s * 0.02, s * 0.07, 0, Math.PI * 2); g.fill(); }
        mouth(g, 0, s * 0.2, s * 0.22, "smile");
        break;
      }
      case "heart": {
        g.beginPath(); g.moveTo(0, s * 0.85); g.bezierCurveTo(-s * 1.15, s * 0.05, -s * 0.75, -s * 0.95, 0, -s * 0.4); g.bezierCurveTo(s * 0.75, -s * 0.95, s * 1.15, s * 0.05, 0, s * 0.85);
        clayFill(g, c, 0, 0, s * 0.9, { gloss: 0.55 });
        break;
      }
      case "donut": {
        blob(g, 0, s * 0.1, s * 0.85, s * 0.66, "#E3A563");
        blob(g, 0, s * 0.04, s * 0.76, s * 0.55, c, { gloss: 0.5 });
        blob(g, 0, s * 0.08, s * 0.24, s * 0.17, "#5B3A22", { gloss: 0 });
        ["#FFFFFF", "#FFD25A", "#7CC8FF", "#74C94E", "#FFFFFF", "#E8504F"].forEach((sc, i) => { g.save(); g.translate(Math.cos(i * 1.05 + 0.3) * s * 0.5, s * 0.04 + Math.sin(i * 1.05 + 0.3) * s * 0.35); g.rotate(i); g.fillStyle = sc; g.fillRect(-s * 0.08, -s * 0.025, s * 0.16, s * 0.05); g.restore(); });
        break;
      }
      case "cupcake": {
        g.beginPath(); g.moveTo(-s * 0.62, s * 0.05); g.lineTo(s * 0.62, s * 0.05); g.lineTo(s * 0.45, s * 0.85); g.lineTo(-s * 0.45, s * 0.85); g.closePath(); clayFill(g, c, 0, s * 0.45, s * 0.65);
        g.strokeStyle = darken(c, 0.15); g.lineWidth = Math.max(1, s * 0.05); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * s * 0.22, s * 0.08); g.lineTo(i * s * 0.17, s * 0.82); g.stroke(); }
        blob(g, 0, -s * 0.12, s * 0.72, s * 0.36, "#FFF4E2", { gloss: 0.5 }); blob(g, 0, -s * 0.48, s * 0.42, s * 0.28, "#FFF4E2");
        blob(g, 0, -s * 0.78, s * 0.15, s * 0.15, "#E8504F", { gloss: 0.7 });
        break;
      }
      case "umbrella": {
        g.strokeStyle = "#7A4A20"; g.lineWidth = s * 0.1; g.lineCap = "round";
        g.beginPath(); g.moveTo(0, -s * 0.2); g.lineTo(0, s * 0.62); g.arc(s * 0.16, s * 0.62, s * 0.16, Math.PI, 0, true); g.stroke();
        g.beginPath(); g.moveTo(-s * 0.9, -s * 0.05); g.arc(0, -s * 0.05, s * 0.9, Math.PI, Math.PI * 2);
        for (let i = 3; i >= 0; i--) g.quadraticCurveTo(-s * 0.9 + (i + 0.5) * s * 0.45, -s * 0.22, -s * 0.9 + i * s * 0.45, -s * 0.05);
        g.closePath(); clayFill(g, c, 0, -s * 0.45, s * 0.9);
        g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = s * 0.05; for (const a of [-0.45, 0.45]) { g.beginPath(); g.moveTo(0, -s * 0.95); g.quadraticCurveTo(a * s * 0.8, -s * 0.6, a * s * 1.0, -s * 0.12); g.stroke(); }
        blob(g, 0, -s * 0.98, s * 0.07, s * 0.07, "#7A4A20");
        break;
      }
      case "drum": {
        g.strokeStyle = "#D9A066"; g.lineWidth = s * 0.08; g.lineCap = "round";
        g.beginPath(); g.moveTo(-s * 0.6, -s * 0.85); g.lineTo(s * 0.2, -s * 0.25); g.moveTo(s * 0.6, -s * 0.85); g.lineTo(-s * 0.2, -s * 0.25); g.stroke();
        for (const sd of [-1, 1]) blob(g, sd * s * 0.6, -s * 0.85, s * 0.1, s * 0.1, "#FFF4E2");
        rr(g, -s * 0.72, -s * 0.2, s * 1.44, s * 0.95, s * 0.2); clayFill(g, c, 0, s * 0.25, s * 0.8);
        g.strokeStyle = "#FFF4E2"; g.lineWidth = s * 0.06; g.beginPath();
        for (let i = 0; i <= 6; i++) { const x = -s * 0.66 + i * s * 0.22; if (i === 0) g.moveTo(x, i % 2 ? s * 0.62 : -s * 0.08); else g.lineTo(x, i % 2 ? s * 0.62 : -s * 0.08); }
        g.stroke();
        blob(g, 0, -s * 0.2, s * 0.72, s * 0.2, "#FFF4E2", { gloss: 0.4 });
        break;
      }
      case "boat": {
        g.strokeStyle = "#7A4A20"; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(0, -s * 0.85); g.stroke();
        g.beginPath(); g.moveTo(s * 0.06, -s * 0.78); g.lineTo(s * 0.68, s * 0.18); g.lineTo(s * 0.06, s * 0.18); g.closePath(); clayFill(g, "#FFFFFF", s * 0.3, -s * 0.2, s * 0.6);
        g.beginPath(); g.moveTo(-s * 0.06, -s * 0.55); g.lineTo(-s * 0.5, s * 0.18); g.lineTo(-s * 0.06, s * 0.18); g.closePath(); clayFill(g, "#FFF4E2", -s * 0.25, -s * 0.1, s * 0.5);
        g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(s * 0.3, -s * 0.76); g.lineTo(0, -s * 0.66); g.fillStyle = "#E8504F"; g.fill();
        g.beginPath(); g.moveTo(-s * 0.88, s * 0.28); g.lineTo(s * 0.88, s * 0.28); g.lineTo(s * 0.55, s * 0.78); g.lineTo(-s * 0.55, s * 0.78); g.closePath(); clayFill(g, c, 0, s * 0.5, s * 0.85);
        g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(-s * 0.7, s * 0.4, s * 1.4, s * 0.06);
        break;
      }
      case "cactus": {
        for (const sd of [-1, 1]) {
          rr(g, sd > 0 ? s * 0.12 : -s * 0.52, -s * (sd > 0 ? 0.42 : 0.25), s * 0.4, s * 0.18, s * 0.09); clayFill(g, c, sd * s * 0.3, -s * 0.3, s * 0.3);
          rr(g, sd > 0 ? s * 0.34 : -s * 0.52, -s * (sd > 0 ? 0.72 : 0.55), s * 0.18, s * 0.42, s * 0.09); clayFill(g, c, sd * s * 0.43, -s * 0.5, s * 0.3);
        }
        rr(g, -s * 0.24, -s * 0.72, s * 0.48, s * 1.12, s * 0.24); clayFill(g, c, 0, -s * 0.2, s * 0.6);
        blob(g, 0, -s * 0.75, s * 0.12, s * 0.09, "#FF6F91", { gloss: 0.6 });
        g.fillStyle = INK; for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * s * 0.09, -s * 0.3, s * 0.045, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.moveTo(-s * 0.48, s * 0.32); g.lineTo(s * 0.48, s * 0.32); g.lineTo(s * 0.36, s * 0.88); g.lineTo(-s * 0.36, s * 0.88); g.closePath(); clayFill(g, "#E07A4A", 0, s * 0.6, s * 0.5);
        rr(g, -s * 0.54, s * 0.24, s * 1.08, s * 0.18, s * 0.06); clayFill(g, "#C9663A", 0, s * 0.33, s * 0.55);
        break;
      }
      case "lolly": {
        rr(g, -s * 0.06, -s * 0.1, s * 0.12, s * 1.0, s * 0.05); g.fillStyle = "#FFF4E2"; g.fill();
        blob(g, 0, -s * 0.3, s * 0.6, s * 0.6, c, { gloss: 0.5 });
        g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = s * 0.09; g.lineCap = "round"; g.beginPath();
        for (let a = 0; a < Math.PI * 4.2; a += 0.2) { const r = s * 0.04 + a * s * 0.038; const px = Math.cos(a) * r, py = -s * 0.3 + Math.sin(a) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
        g.stroke();
        break;
      }
    }
    g.restore();
  }

  /** soft lighting over an already-clipped round shape */
  private gloss(g: G, cx: number, cy: number, r: number) {
    const gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.45, r * 0.05, cx, cy, r * 1.15);
    gr.addColorStop(0, "rgba(255,255,255,0.45)"); gr.addColorStop(0.45, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(27,15,42,0.3)");
    g.fillStyle = gr; g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  }

  // ------------------------------------------------------------ drawing: scene
  private drawRoom(g: G) {
    const W = this.W, H = this.H;
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#1F5E6B"); wall.addColorStop(1, "#123A44");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.04)";
    for (let x = 0, i = 0; x < W; x += 30, i++) if (i % 2) g.fillRect(x, 0, 15, H);
    // wainscot + checkered marble floor
    const fy = this.floorY - (this.W < this.H * 1.05 ? this.kr.h * 0.55 : 0);
    g.fillStyle = "#0E2E36"; g.fillRect(0, fy - 8, W, 8);
    const tile = 34;
    for (let y = fy, r = 0; y < H; y += tile, r++) for (let x = (r % 2) * tile - tile, c = 0; x < W; x += tile, c++) { g.fillStyle = c % 2 ? "#EADFCB" : "#CDBFA5"; g.fillRect(x, y, tile, tile); }
    const fg = g.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, "rgba(14,46,54,0.45)"); fg.addColorStop(1, "rgba(14,46,54,0)");
    g.fillStyle = fg; g.fillRect(0, fy, W, H - fy);
    // framed paintings on the side walls (landscape)
    const S = this.shelf, right = S.x + S.w;
    if (W - right > 200) {
      const fw = Math.min(150, (W - right) * 0.5), fx = right + (W - right) / 2 - fw / 2, fy2 = S.y + 10;
      clayPanel(g, fx, fy2, fw, fw * 0.8, 10, "#E8B53A", { lip: 5 });
      rr(g, fx + 10, fy2 + 9, fw - 20, fw * 0.8 - 24, 6); g.fillStyle = "#9FDBFF"; g.fill();
      blob(g, fx + fw * 0.5, fy2 + fw * 0.52, fw * 0.28, fw * 0.12, "#74C94E", { gloss: 0.2 });
      blob(g, fx + fw * 0.7, fy2 + fw * 0.25, fw * 0.08, fw * 0.08, "#FFD25A", { gloss: 0.5 });
    }
    if (S.x > 120) {
      const fw = Math.min(110, S.x * 0.65), fx = S.x / 2 - fw / 2, fy2 = S.y + 30;
      clayPanel(g, fx, fy2, fw, fw * 1.25, 10, "#E8B53A", { lip: 5 });
      rr(g, fx + 9, fy2 + 9, fw - 18, fw * 1.25 - 24, 6); g.fillStyle = "#FFE4EE"; g.fill();
      blob(g, fx + fw / 2, fy2 + fw * 0.62, fw * 0.24, fw * 0.28, "#FF8FB1", { gloss: 0.4 });
      eye(g, fx + fw / 2 - fw * 0.08, fy2 + fw * 0.56, fw * 0.06); eye(g, fx + fw / 2 + fw * 0.08, fy2 + fw * 0.56, fw * 0.06);
    }
  }

  private drawShelf(g: G) {
    const S = this.shelf, I = this.inner();
    shadow(g, S.x + S.w / 2, S.y + S.h + 4, S.w * 0.5, 14, 0.4);
    clayPanel(g, S.x, S.y, S.w, S.h + 8, 22, "#B9784A", { lip: 8 });
    rr(g, I.x - 6, I.y - 8, I.w + 12, I.h + 10, 14);
    const back = g.createLinearGradient(0, I.y, 0, I.y + I.h); back.addColorStop(0, "#FFF1D6"); back.addColorStop(1, "#F1D6AE");
    g.fillStyle = back; g.fill();
    // spotlights from the top
    g.save(); rr(g, I.x - 6, I.y - 8, I.w + 12, I.h + 10, 14); g.clip();
    for (let c = 0; c < this.cols; c++) {
      const x = I.x + ((c + 0.5) * I.w) / this.cols;
      const lg = g.createRadialGradient(x, I.y - 10, 4, x, I.y - 10, I.h * 0.6); lg.addColorStop(0, "rgba(255,255,255,0.55)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.fillRect(x - I.h * 0.6, I.y - 10, I.h * 1.2, I.h * 0.6);
    }
    g.restore();
    // shelf planks
    const ch = I.h / this.rowsN;
    for (let r = 0; r < this.rowsN; r++) {
      const y = I.y + (r + 1) * ch - 10;
      rr(g, I.x - 8, y, I.w + 16, 12, 5); clayFill(g, "#9A5F2E", I.x + I.w / 2, y + 6, I.w * 0.5, { gloss: 0.15 });
      g.fillStyle = "rgba(255,230,190,0.35)"; g.fillRect(I.x - 4, y + 1, I.w + 8, 2);
    }
    // little brass lamp + sign on top
    clayPanel(g, S.x + S.w / 2 - 70, S.y - 12, 140, 30, 12, "#E8B53A", { lip: 4 });
    clayText(g, "MUSEUM", S.x + S.w / 2, S.y + 1, 15, { fill: "#FFF4E2", stroke: "#7A4A10", gloss: false });
  }

  private drawShelfItems(g: G) {
    const s = this.itemS;
    for (const it of this.items) {
      const p = this.slotPos(it.slot);
      if (it.poof >= 1) continue;
      const sc = ease.out(clamp(it.pop, 0, 1.2)) * (1 - it.poof), bob = Math.sin(this.t * 2 + it.slot) * 1.2;
      shadow(g, p.x, p.y + 1, s * 0.75, 5, 0.3);
      g.save(); g.translate(p.x, p.y); g.scale(sc, sc);
      if (it.poof > 0) g.globalAlpha = 1 - it.poof;
      this.drawItem(g, it.id, 0, -s * 0.9 + bob, s);
      g.restore();
      if (it.poof > 0) this.burstOnce(it);
    }
  }
  private poofed = new Set<Item>();
  private burstOnce(it: Item) {
    if (this.poofed.has(it)) return;
    this.poofed.add(it);
    const p = this.slotPos(it.slot);
    this.burst(p.x, p.y - this.itemS, { n: 16, colors: ["#FFFFFF", "#E3E8F0", "#FF8FB1"], kind: "bubble", speed: 140, gravity: -60, size: 7, life: 0.8 });
  }

  private drawDrape(g: G) {
    const c = this.drape.c;
    if (c <= 0.01) return;
    const S = this.shelf, top = S.y - 4, bot = S.y + S.h + 6, half = S.w / 2 + 6, w = half * c;
    const wob = this.drape.wob;
    for (const s of [0, 1]) {
      const x0 = s ? S.x + S.w + 6 - w : S.x - 6;
      g.save();
      g.translate(Math.sin(this.t * 40 + s) * wob * 4, 0);
      g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + w, top); g.lineTo(x0 + w, bot);
      for (let x = x0 + w; x > x0; x -= 22) g.quadraticCurveTo(x - 11, bot + 10, Math.max(x0, x - 22), bot);
      g.lineTo(x0, top); g.closePath();
      const dg = g.createLinearGradient(x0, 0, x0 + Math.max(1, w), 0);
      dg.addColorStop(0, "#5B1E6E"); dg.addColorStop(0.5, "#8E3BA8"); dg.addColorStop(1, "#5B1E6E");
      g.fillStyle = dg; g.fill();
      g.save(); g.clip();
      g.strokeStyle = "rgba(30,0,40,0.25)"; g.lineWidth = 6;
      for (let x = x0 + 12; x < x0 + w; x += 26) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + 3, bot + 10); g.stroke(); }
      g.restore();
      g.restore();
    }
    rr(g, S.x - 12, top - 8, S.w + 24, 12, 6); clayFill(g, "#E8B53A", S.x + S.w / 2, top - 2, S.w * 0.5, { gloss: 0.4 });
    if (c > 0.95 && this.kr.hide > 0.5) {
      // Kranky's eye-stalks peek out through the gap in the curtain
      const cx = S.x + S.w / 2, ey = S.y + S.h * (0.45 + Math.sin(this.t * 3) * 0.12), er = clamp(S.w * 0.035, 9, 16);
      for (const sd of [-1, 1]) {
        const ex = cx + sd * er * 1.25 + Math.sin(this.t * 5 + sd) * 2;
        g.strokeStyle = "#E8604F"; g.lineWidth = er * 0.5; g.lineCap = "round";
        g.beginPath(); g.moveTo(cx, ey + er * 2.6); g.quadraticCurveTo(ex, ey + er * 1.6, ex, ey + er * 0.6); g.stroke();
        eye(g, ex, ey, er, { look: [Math.sin(this.t * 2.3), 0.3], blink: Math.sin(this.t * 4 + sd) > 0.93 ? 1 : 0 });
      }
      blob(g, cx, ey + er * 2.8, er * 0.9, er * 0.5, "#5B1E6E");
      clayText(g, "?!", cx + er * 3.2, ey - er * 1.6 - wob * 8, 22, { fill: "#FFD25A" });
    }
  }

  private drawKranky(g: G) {
    const k = this.kr, h = k.h;
    let y = this.floorY;
    const hide = k.hide;
    if (hide > 0) y = lerp(this.floorY, this.shelf.y + this.shelf.h * 0.62, hide);
    const tip = k.walk ? Math.abs(Math.sin(this.t * 11)) * 10 : 0;
    const mood: Mood = this.hud.status !== "playing" ? "happy" : k.laugh > 0.05 ? "sad" : this.hud.host.mood;
    const shake = k.grr > 0.05 ? Math.sin(this.t * 40) * 5 * Math.min(1, k.grr) : 0;
    const sq = k.laugh > 0.05 ? Math.sin(this.t * 18) * 0.05 * k.laugh : 0;
    g.save(); g.globalAlpha = 1 - hide;
    shadow(g, k.x, this.floorY + 2, h * 0.5, 7, 0.35 * (1 - hide));
    // the loot sack in his claw
    if (this.sack.carry && this.sack.a > 0) this.drawSack(g, k.x + k.face * h * 0.55, y - h * 0.5 - tip, h * 0.24 * (1 + this.sack.n * 0.12));
    this.sprite(g, this.host(mood), k.x + shake, y - tip, h * (1 - hide * 0.4), { flip: k.face > 0, sy: 1 + sq + Math.sin(this.t * 2.4) * 0.015, sx: 1 - sq * 0.6, rot: k.walk ? Math.sin(this.t * 11) * 0.06 : 0 });
    g.restore();
    if (k.grr > 0.05) {
      for (const sd of [-1, 1]) {
        const px = k.x + sd * h * 0.32, py = y - h * 0.95 - (1 - Math.min(1, k.grr)) * 20;
        g.save(); g.globalAlpha = Math.min(1, k.grr); blob(g, px, py, 10, 8, "#FFFFFF", { gloss: 0.3 }); blob(g, px + sd * 8, py - 8, 7, 6, "#FFFFFF"); g.restore();
      }
    }
  }

  private drawSack(g: G, x: number, y: number, r: number) {
    g.save(); g.translate(x, y);
    shadow(g, 0, r * 0.95, r * 0.9, r * 0.2, 0.3);
    blob(g, 0, 0, r, r * 0.92, "#B07A45", { gloss: 0.3, wobble: 0.04, t: this.t });
    blob(g, 0, -r * 0.95, r * 0.32, r * 0.2, "#9A6638");
    g.strokeStyle = "#5A3420"; g.lineWidth = Math.max(2, r * 0.1); g.beginPath(); g.moveTo(-r * 0.35, -r * 0.78); g.quadraticCurveTo(0, -r * 0.62, r * 0.35, -r * 0.78); g.stroke();
    blob(g, -r * 0.22, -r * 1.22, r * 0.14, r * 0.2, "#9A6638", { rot: -0.5 }); blob(g, r * 0.22, -r * 1.22, r * 0.14, r * 0.2, "#9A6638", { rot: 0.5 });
    clayText(g, "$", 0, r * 0.1, r * 0.75, { fill: "#FFD25A", stroke: "#5A3420", gloss: false });
    g.restore();
  }

  private drawRopes(g: G) {
    if (this.W >= this.H * 1.05) return;
    const S = this.shelf, y = this.floorY - (this.W < this.H * 1.05 ? this.kr.h * 0.35 : 4);
    const xs = [S.x + 18, S.x + S.w - 18];
    g.strokeStyle = "#B8333A"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(xs[0], y - 34); g.quadraticCurveTo((xs[0] + xs[1]) / 2, y - 6, xs[1], y - 34); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(xs[0], y - 36); g.quadraticCurveTo((xs[0] + xs[1]) / 2, y - 8, xs[1], y - 36); g.stroke();
    for (const x of xs) {
      shadow(g, x, y + 2, 14, 4, 0.3);
      rr(g, x - 4, y - 38, 8, 38, 3); clayFill(g, "#E8B53A", x, y - 20, 14, { gloss: 0.4 });
      blob(g, x, y - 40, 7, 7, "#F2C14E", { gloss: 0.6 });
      blob(g, x, y - 1, 11, 4, "#C99A2E");
    }
  }

  private drawTray(g: G) {
    const T = this.tray;
    clayPanel(g, T.x, T.y, T.w, T.h, 22, "#FFF1D6", { lip: 7 });
    if (this.hud.status !== "playing") { clayText(g, "What's missing?", T.x + T.w / 2, T.y + T.h / 2 - 4, Math.min(30, T.w * 0.08), { fill: "#FF8A3D" }); return; }
    if (this.phase === "look") {
      const b = this.ready, lx = T.x + (b.x - T.x) / 2;
      clayText(g, "LOOK!", lx, T.y + T.h / 2 - 16, Math.min(34, T.w * 0.09), { fill: "#FFD25A" });
      for (const sd of [-1, 1]) eye(g, lx + sd * 18, T.y + T.h / 2 + 18, 12, { look: [Math.sin(this.t * 1.7), 0.2] });
      clayPanel(g, b.x, b.y, b.w, b.h, 16, "#2FA866", { lip: 6, pressed: b.press });
      clayText(g, "READY!", b.x + b.w / 2, b.y + (b.h - 6) / 2 + b.press * 4, Math.min(22, b.w * 0.17), { fill: "#FFFFFF", stroke: "#1B6B40", gloss: false });
      return;
    }
    if (this.phase === "steal") {
      clayText(g, "Shhh…", T.x + T.w / 2, T.y + T.h / 2 - 3, Math.min(34, T.w * 0.09), { fill: "#9B5DE5" });
      return;
    }
    this.opts.forEach((o, i) => this.drawOpt(g, o, i));
  }

  private drawOpt(g: G, o: Opt, i: number) {
    if (o.pop <= 0.01) return;
    const sc = o.pop * (1 - o.press * 0.08), wrong = o.state === "wrong", right = o.state === "right";
    g.save(); g.translate(o.x + Math.sin(this.t * 40) * o.wig * 7, o.y); g.scale(sc, sc);
    if (o.glow > 0) {
      const pulse = 1 + Math.sin(this.t * 9) * 0.08;
      g.strokeStyle = "#FFD25A"; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, o.r * 1.15 * pulse, 0, Math.PI * 2); g.stroke();
    }
    shadow(g, 0, o.r * 0.95, o.r * 0.8, 6, 0.3);
    blob(g, 0, 0, o.r, o.r, right ? "#C8F5DC" : wrong ? "#D9D2DE" : "#FFFFFF", { gloss: 0.4 });
    g.strokeStyle = right ? "#2FA866" : wrong ? "#B3A8BC" : "#F2C14E"; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, o.r - 2, 0, Math.PI * 2); g.stroke();
    if (wrong) g.globalAlpha = 0.45;
    this.drawItem(g, o.id, 0, 0, o.r * 0.6);
    g.globalAlpha = 1;
    if (wrong) {
      g.strokeStyle = "#E8504F"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.moveTo(-o.r * 0.45, -o.r * 0.45); g.lineTo(o.r * 0.45, o.r * 0.45); g.moveTo(o.r * 0.45, -o.r * 0.45); g.lineTo(-o.r * 0.45, o.r * 0.45); g.stroke();
    }
    if (right) { blob(g, o.r * 0.7, -o.r * 0.7, o.r * 0.3, o.r * 0.3, "#2FA866", { gloss: 0.5 }); g.strokeStyle = "#FFFFFF"; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(o.r * 0.56, -o.r * 0.7); g.lineTo(o.r * 0.67, -o.r * 0.58); g.lineTo(o.r * 0.86, -o.r * 0.84); g.stroke(); }
    g.restore();
    if (this.W > 700 && o.state === "idle") clayText(g, String(i + 1), o.x - o.r * 0.8, o.y - o.r * 0.8, 15, { fill: "#FFFFFF", gloss: false });
  }

  private drawFlyers(g: G) {
    for (const f of this.flyers) {
      const p = this.slotPos(f.slot), u = f.u;
      const x = lerp(f.x0, p.x, u), y = lerp(f.y0, p.y - this.itemS * 0.9, u) - Math.sin(Math.PI * u) * 120;
      g.save(); g.translate(x, y); g.rotate(u * Math.PI * 2);
      this.drawItem(g, f.id, 0, 0, this.itemS * (0.8 + Math.sin(Math.PI * u) * 0.3));
      g.restore();
    }
  }

  private drawScene(g: G) {
    this.drawRoom(g);
    this.drawShelf(g);
    this.drawShelfItems(g);
    this.drawDrape(g);
    this.drawRopes(g);
    if (!this.sack.carry && this.sack.a > 0 && this.sack.n > 0) this.drawSack(g, this.sack.x, this.sack.y - this.kr.h * 0.2, this.kr.h * 0.22 * (1 + this.sack.n * 0.12));
    this.drawKranky(g);
    this.drawTray(g);
    this.drawFlyers(g);
  }

  protected drawBackground(g: G) {
    if (!this.items.length) {
      this.items = ["bear:0", "rocket:0", "duck:0", "crown:0", "car:1", "gem:3", "cupcake:0", "ball:0"].map((id, i) => ({ id, slot: i, pop: 1, fake: false, poof: 0 }));
    }
    this.layout();
    this.drawScene(g);
  }

  protected draw(g: G) { this.drawScene(g); }
}
