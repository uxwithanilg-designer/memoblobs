// Shadow Snap — Noodle's shadow-puppet theatre. A black clay shadow appears on the lamp-lit screen:
// tap the friend who casts it. Unlimited levels: more cards, quicker timers, look-alike decoys, then
// twists — mirrored, swaying, peeking, spun-around, pose-matching and flickering shadows.
import { ArcadeGame, Recent, byDiff, clamp, ease, lerp, ramp, spriteUrl, type CastId, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, mix, rgba, rr, shadow, type G } from "../paint";

type Twist = "mirror" | "sway" | "peek" | "spin" | "poses" | "flicker";
const TWISTS: Twist[] = ["mirror", "sway", "peek", "spin", "poses", "flicker"];
const TWIST_INFO: Record<Twist, { title: string; sub: string; hint: string }> = {
  mirror: { title: "MIRROR MIX!", sub: "The shadow is flipped around", hint: "It's flipped! Who is it? 🪞" },
  sway: { title: "WOBBLY STRINGS!", sub: "The puppets sway and swing", hint: "Catch the swaying shadow! 🎭" },
  peek: { title: "PEEK-A-BOO!", sub: "Only part of the shadow shows", hint: "Who's peeking out? 👀" },
  spin: { title: "TOPSY-TURVY!", sub: "The shadow is turned around", hint: "Tilt your head! Who is it? 🙃" },
  poses: { title: "STRIKE A POSE!", sub: "Same friend — find the exact pose", hint: "Match the exact pose! 💃" },
  flicker: { title: "LAMP FLICKER!", sub: "Noodle's lamp keeps blinking", hint: "Look between the blinks! 💡" },
};
const CAST: CastId[] = ["momo", "pip", "gloop", "hoot", "noodle", "zib", "bolt", "bonbon", "tiki", "kranky", "turbo"];
const NAME: Record<CastId, string> = { momo: "Momo", kranky: "Kranky", tiki: "Tiki", pip: "Pip", gloop: "Gloop", hoot: "Prof. Hoot", noodle: "Noodle", zib: "Zib", bolt: "Bolt", bonbon: "Bonbon", turbo: "Turbo" };
const POSES = Object.fromEntries(CAST.map((id) => [id, [...new Set([
  ...(["happy", "wow", "sad"] as const).map((m) => spriteUrl(id, m)),
  ...(id === "momo" ? ["/brand/momo-sly.webp", "/brand/momo-wave.webp"] : []),
])]])) as Record<CastId, string[]>;
const ALL_URLS = [...new Set(Object.values(POSES).flat())];
const CARD_TINT = ["#FFE3EC", "#E3F2FF", "#E6FFE3", "#FFF1D2", "#F0E6FF", "#DDFBF6", "#FFE8D9", "#EAF0FF", "#FDF6C8"];

interface Card { id: CastId; url: string; x: number; y: number; w: number; h: number; pop: number; press: number; wig: number; state: "idle" | "right" | "wrong" | "dim"; hot: number; tint: string }
interface Prompt { id: CastId; url: string; twists: Twist[]; rot: number; flip: boolean; peekSide: "l" | "r" | "t"; peekAmt: number; ph: number }
interface Sil { c: HTMLCanvasElement; w: number; h: number }
type Phase = "intro" | "pick" | "reveal" | "done";

export default class ShadowMatch extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "shadow-match", title: "Shadow Snap", host: "noodle", style: "rounds",
    music: { calm: "a:shadow_calm", action: "a:shadow_action" },
    sounds: ["a:curtain", "a:click", "a:twinkle", "a:creak", "a:buzz", "a:wobble", "a:tickHi", "a:cheer",
      ...CAST.map((id) => `v:${id}_happy` as const)],
    sprites: ALL_URLS, voicePitch: 1.1, transition: "curtain",
  };
  private sils = new Map<string, Sil>();
  private masks = new Map<string, Uint8Array>();
  private cards: Card[] = [];
  private P: Prompt | null = null;
  private phase: Phase = "intro";
  private idx = 0; private total = 6; private misses = 0; private allowed = 1; private promptMiss = false;
  private results: ("ok" | "miss" | null)[] = [];
  private left = 1; private limit = 6; private tickAt = 0;
  private nOpt = 3;
  private lvlTwists: Twist[] = [];
  private twistP = 0;
  private lastTwists: Twist[] = [];
  private usedTargets: CastId[] = [];
  private recent = new Recent(16);
  private sh = { a: 0, reveal: 0 };
  private lamp = { swing: 0 };
  private noo = { hop: 0 };
  // layout
  private stage = { x: 0, y: 0, w: 0, h: 0 };
  private screen = { x: 0, y: 0, w: 0, h: 0 };
  private grid = { x: 0, y: 0, w: 0, h: 0 };
  private floorY = 0; private valH = 30;
  private demo = false;
  private cols = 0; private colsW = 0;

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W;
    const portrait = W < A.h * 1.05;
    if (portrait) {
      const sw = Math.min(W - 20, 560), sh = clamp(A.h * 0.47, 220, 430);
      this.stage = { x: (W - sw) / 2, y: A.y + 4, w: sw, h: sh };
      const gy = this.stage.y + sh + 14, gw = Math.min(W - 24, 560);
      this.grid = { x: (W - gw) / 2, y: gy, w: gw, h: A.y + A.h - gy - 4 };
    } else {
      const sw = Math.min(A.w * 0.56, A.h * 1.25);
      this.stage = { x: Math.max(16, (W - sw - Math.min(560, W - sw - 50)) / 2 - 8), y: A.y + 6, w: sw, h: A.h - 12 };
      const gx = this.stage.x + sw + 22;
      this.grid = { x: gx, y: A.y + 10, w: Math.min(560, W - gx - 18), h: A.h - 20 };
    }
    const S = this.stage;
    this.valH = clamp(S.h * 0.1, 24, 46);
    const floorH = clamp(S.h * 0.22, 56, 120);
    this.floorY = S.y + S.h - floorH;
    const top = S.y + this.valH + 8;
    this.screen = { x: S.x + S.w * 0.1, y: top, w: S.w * 0.8, h: this.floorY - top - 4 };
    this.layoutCards();
  }

  /** card grid; the column count only changes on a new deal or a real width change (not when the HUD grows) */
  private layoutCards(fresh = false) {
    const R = this.grid, n = this.cards.length || this.nOpt, gap = 12;
    if (fresh || !this.cols || this.cols > n || this.W !== this.colsW) {
      let bestS = -1;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const s = Math.min((R.w - gap * (cols - 1)) / cols, (R.h - gap * (rows - 1)) / rows / 1.12, 190) - (cols * rows - n) * 3;
        if (s > bestS) { bestS = s; this.cols = cols; }
      }
      this.colsW = this.W;
    }
    const cols = this.cols, rows = Math.ceil(n / cols);
    const cw = Math.min((R.w - gap * (cols - 1)) / cols, (R.h - gap * (rows - 1)) / rows / 1.12, 190), ch = cw * 1.12;
    const gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
    const ox = R.x + (R.w - gw) / 2, oy = R.y + (R.h - gh) / 2;
    this.cards.forEach((c, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
      const rowOff = ((cols - inRow) * (cw + gap)) / 2;
      c.x = ox + rowOff + (i % cols) * (cw + gap); c.y = oy + r * (ch + gap); c.w = cw; c.h = ch;
    });
  }

  // ------------------------------------------------------------ silhouettes
  private loaded(url: string) { return !!this.img(url)?.naturalWidth; }

  /** sprite → black clay silhouette (soft ground shadow removed), cached */
  private sil(url: string): Sil | null {
    const have = this.sils.get(url);
    if (have) return have;
    const im = this.img(url);
    if (!im || !im.naturalWidth) return null;
    const h = 280, w = Math.max(1, Math.round((h * im.naturalWidth) / im.naturalHeight));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(im, 0, 0, w, h);
    try {
      const d = x.getImageData(0, 0, w, h);
      for (let i = 3; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = a >= 150 ? 255 : a >= 120 ? (a - 120) * 8 : 0; }
      x.putImageData(d, 0, 0);
    } catch { /* tainted canvas: keep the raw alpha */ }
    x.globalCompositeOperation = "source-in";
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#33244A"); gr.addColorStop(1, "#130A1C");
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const s = { c, w, h };
    this.sils.set(url, s);
    return s;
  }

  private mask(url: string) {
    const have = this.masks.get(url);
    if (have) return have;
    const s = this.sil(url);
    if (!s) return null;
    const N = 40, c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    const k = Math.min(N / s.w, N / s.h), w = s.w * k, h = s.h * k;
    x.drawImage(s.c, (N - w) / 2, N - h, w, h);
    const m = new Uint8Array(N * N);
    try { const d = x.getImageData(0, 0, N, N).data; for (let i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0; } catch { /* ignore */ }
    this.masks.set(url, m);
    return m;
  }

  /** 0 = identical outline, 1 = nothing in common */
  private shapeDiff(a: string, b: string) {
    const A = this.mask(a), B = this.mask(b);
    if (!A || !B) return 1;
    let x = 0, u = 0;
    for (let i = 0; i < A.length; i++) { if (A[i] | B[i]) u++; if (A[i] !== B[i]) x++; }
    return u ? x / u : 1;
  }

  /** poses of a friend whose outlines are clearly different from each other */
  private distinctPoses(id: CastId) {
    const out: string[] = [];
    for (const u of POSES[id].filter((p) => this.loaded(p))) if (out.every((o) => this.shapeDiff(o, u) > 0.13)) out.push(u);
    return out;
  }

  // ------------------------------------------------------------ levels
  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.nOpt = byDiff(d, { easy: Math.min(6, 3 + Math.floor((L - 1) / 3)), medium: Math.min(8, 4 + Math.floor((L - 1) * 0.4)), hard: Math.min(9, 5 + Math.floor((L - 1) * 0.45)) });
    this.total = byDiff(d, { easy: 6, medium: 6, hard: L >= 10 ? 7 : 6 });
    this.allowed = byDiff(d, { easy: 2, medium: 1, hard: 1 });
    this.idx = 0; this.misses = 0; this.usedTargets = []; this.demo = false;
    this.results = Array.from({ length: this.total }, () => null);
    this.cards = []; this.P = null; this.sh = { a: 0, reveal: 0 }; this.phase = "intro";
    // twists: one featured twist per level (never the last two), a second one mixed in much later
    const start = byDiff(d, { easy: 4, medium: 3, hard: 2 });
    this.lvlTwists = [];
    if (L >= start && (L === start || L - start >= 4 || this.rng.chance(0.75))) {
      const unlocked = TWISTS.slice(0, clamp(1 + Math.floor((L - start) / byDiff(d, { easy: 2, medium: 1.6, hard: 1.3 })), 1, TWISTS.length));
      const fresh = unlocked.filter((t) => !this.lastTwists.includes(t));
      const newest = unlocked[unlocked.length - 1];
      const t1 = !this.lastTwists.includes(newest) && this.rng.chance(0.5) ? newest : this.rng.pick(fresh.length ? fresh : unlocked);
      this.lvlTwists.push(t1);
      if (L >= start + byDiff(d, { easy: 10, medium: 8, hard: 6 })) {
        const second = (["mirror", "sway", "flicker", "spin"] as Twist[]).filter((t) => t !== t1 && !(t1 === "peek" && t === "spin"));
        this.lvlTwists.push(this.rng.pick(second));
      }
      this.lastTwists = [t1, ...this.lastTwists].slice(0, 2);
      this.twistP = clamp(0.55 + (L - start) * 0.05, 0.55, 0.9);
    }
    this.layout();
    this.music(this.lvlTwists.length || L >= 8 ? "action" : "calm");
    this.sfx("a:curtain", { gain: 0.55 });
    this.react("happy", this.rng.pick(["Lights… lamp… SHADOWS!", "Who's behind the screen?", "Shadow show time! Arf!", "Ooh, spooky shapes!", "Guess who, guess who!"]));
    let delay = 0.9;
    if (this.lvlTwists.length) {
      const t = TWIST_INFO[this.lvlTwists[0]];
      this.after(0.55, () => this.banner(t.title, this.lvlTwists[1] ? `${t.sub} + ${TWIST_INFO[this.lvlTwists[1]].title.toLowerCase().replace("!", "")}` : t.sub, "pink"));
      delay = 2.1;
    }
    this.hint(`Find ${this.total} shadow owners! 🔦`);
    this.after(delay, () => this.newPrompt());
  }

  private newPrompt() {
    const L = this.level, d = this.diff, r = this.rng;
    const avail = CAST.filter((id) => this.loaded(spriteUrl(id, "happy")));
    const tw: Twist[] = [];
    if (this.lvlTwists.length && (this.idx === 0 || r.chance(this.twistP))) tw.push(this.lvlTwists[0]);
    if (this.lvlTwists[1] && r.chance(0.5)) tw.push(this.lvlTwists[1]);
    const poses = tw.includes("poses");
    const n = Math.min(this.nOpt, avail.length);
    let target: CastId = avail[0], url = "", opts: { id: CastId; url: string }[] = [];
    for (let tries = 0; tries < 12; tries++) {
      let pool = avail.filter((id) => !this.usedTargets.includes(id));
      if (poses) { const pp = pool.filter((id) => this.distinctPoses(id).length >= 2); pool = pp.length ? pp : avail.filter((id) => this.distinctPoses(id).length >= 2); }
      if (!pool.length) pool = avail;
      target = r.pick(pool);
      const tp = poses ? this.distinctPoses(target) : POSES[target].filter((p) => this.loaded(p));
      url = r.pick(tp.length ? tp : [spriteUrl(target, "happy")]);
      opts = [{ id: target, url }];
      if (poses) {
        const alts = r.shuffle(tp.filter((p) => p !== url)).slice(0, Math.max(1, Math.min(n - 1, byDiff(d, { easy: 2, medium: 2, hard: 3 }))));
        for (const a of alts) opts.push({ id: target, url: a });
      }
      // decoys: other friends; later levels prefer look-alike outlines
      const bias = clamp((L - 3) / 14, 0, 0.75);
      const others = avail.filter((id) => id !== target).map((id) => {
        const ps = POSES[id].filter((p) => this.loaded(p));
        const pu = r.pick(ps.length ? ps : [spriteUrl(id, "happy")]);
        return { id, url: pu, k: (bias > 0 ? this.shapeDiff(url, pu) * bias : 0) + r.next() * (1 - bias) };
      }).sort((a, b) => a.k - b.k);
      for (const o of others) { if (opts.length >= n) break; opts.push({ id: o.id, url: o.url }); }
      const sig = `${url}|${tw.join(",")}`;
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    this.usedTargets.push(target);
    if (this.usedTargets.length >= avail.length) this.usedTargets = [target];
    r.shuffle(opts);
    this.cards = opts.map((o, i) => ({ id: o.id, url: o.url, x: 0, y: 0, w: 0, h: 0, pop: 0, press: 0, wig: 0, state: "idle", hot: 0, tint: CARD_TINT[(i + this.idx * 2) % CARD_TINT.length] }));
    this.layoutCards(true);
    this.cards.forEach((c, i) => { this.tween(c, { pop: 1 }, 0.42, ease.back, 0.05 + i * 0.05); this.sfx("pop", { x: c.x + c.w / 2, gain: 0.25, rate: 1 + i * 0.07, delay: 0.05 + i * 0.05 }); });
    const spins = [Math.PI, Math.PI / 2, -Math.PI / 2, 0.75, -0.75, 2.3, -2.3];
    this.P = {
      id: target, url, twists: tw, flip: tw.includes("mirror"),
      rot: tw.includes("spin") ? r.pick(L < 10 ? spins.slice(0, 3) : spins) : 0,
      peekSide: r.pick(["l", "r", "t"] as const), peekAmt: clamp(0.36 + (L - 3) * 0.015, 0.36, 0.56), ph: r.range(0, 6),
    };
    this.sh = { a: 0, reveal: 0 };
    this.tween(this.sh, { a: 1 }, 0.3, ease.out, 0.12);
    this.sfx("a:click", { gain: 0.6, delay: 0.1 });
    if (tw.includes("sway")) this.sfx("a:creak", { gain: 0.45, delay: 0.3 });
    if (tw.includes("flicker")) this.sfx("a:buzz", { gain: 0.35, delay: 0.3 });
    this.lamp.swing = 1; this.noo.hop = 1;
    this.promptMiss = false;
    this.phase = "intro";
    this.limit = byDiff(d, { easy: ramp(L, 7.5, -0.25, 4.2), medium: ramp(L, 6.5, -0.22, 3.5), hard: ramp(L, 5.5, -0.2, 2.9) }) + (n - 3) * 0.25 + (tw.length ? 0.9 : 0);
    this.left = this.limit; this.tickAt = 3;
    this.hint(tw.length ? TWIST_INFO[tw[0]].hint : this.rng.pick(["Whose shadow is it? Tap them! 🔦", "Who's behind the screen? 🎭", "Tap the shadow's owner! 👆"]));
    this.after(0.4, () => { if (this.phase === "intro") this.phase = "pick"; });
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const k = Number(key);
    if (k >= 1 && k <= this.cards.length) this.choose(this.cards[k - 1]);
  }

  protected onDown(x: number, y: number) {
    const c = this.cards.find((c) => x >= c.x - 4 && x <= c.x + c.w + 4 && y >= c.y - 4 && y <= c.y + c.h + 4);
    if (c) this.choose(c);
  }

  private choose(c: Card) {
    const P = this.P;
    if (!P || (this.phase !== "pick" && this.phase !== "intro") || c.pop < 0.6 || c.state === "dim" || c.state === "wrong") return;
    c.press = 1; this.tween(c, { press: 0 }, 0.22);
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    if (c.url === P.url) {
      c.state = "right"; c.hot = 1;
      this.results[this.idx] = this.promptMiss ? "miss" : "ok";
      this.good(cx, c.y + c.h * 0.25, this.promptMiss ? 40 : 100, this.promptMiss ? 0 : this.left / this.limit);
      this.reveal(true);
    } else {
      c.state = "wrong"; c.wig = 1;
      this.sfx("a:wobble", { x: cx, gain: 0.6 });
      this.miss(cx, cy, this.rng.pick(["Ruff… not them!", "Nope! Sniff again!", "That's not the shape!", "My tail is confused!", "Wrong puppet!"]));
    }
  }

  private miss(x: number, y: number, line: string) {
    this.misses++; this.promptMiss = true;
    this.results[this.idx] = "miss";
    this.bad(x, y, { line });
    if (this.misses > this.allowed) {
      this.phase = "done"; this.timerBar(null); this.hint(null);
      const right = this.cards.find((c) => c.url === this.P?.url);
      if (right) right.hot = 1;
      this.tween(this.sh, { reveal: 1 }, 0.5, ease.out, 0.2);
      this.after(1.2, () => this.levelFail(this.allowed ? "Too many mix-ups!" : "Oops, wrong shadow!"));
    }
  }

  private timeout() {
    const S = this.screen;
    this.phase = "reveal";
    this.miss(S.x + S.w / 2, S.y + S.h / 2, this.rng.pick(["Too slow! The lamp got hot!", "Time's up!", "Snooze! Arf!"]));
    if (this.ending || this.misses > this.allowed) return;
    const right = this.cards.find((c) => c.url === this.P?.url);
    if (right) right.hot = 1;
    for (const c of this.cards) if (c !== right && c.state === "idle") c.state = "dim";
    this.reveal(false);
  }

  /** the shadow fills with colour and the friend appears */
  private reveal(won: boolean) {
    const P = this.P!;
    this.phase = "reveal"; this.timerBar(null);
    this.tween(this.sh, { reveal: 1 }, 0.5, ease.out);
    this.sfx("a:twinkle", { gain: 0.6 });
    this.sfx(`v:${P.id}_happy`, { gain: 0.6, delay: 0.25, duck: false });
    const S = this.screen;
    this.burst(S.x + S.w / 2, S.y + S.h * 0.45, { n: won ? 22 : 8, colors: ["#FFD25A", "#FFFFFF", "#FF8FB1"], kind: "star", speed: 260 });
    this.noo.hop = 1;
    if (won && !this.promptMiss && this.combo % 4 !== 0) this.react("happy", this.rng.pick([`It's ${NAME[P.id]}!`, `${NAME[P.id]}! Arf arf!`, "Shadow snapped!", "Good sniffing!"]), false);
    for (const c of this.cards) if (c.state === "idle") c.state = "dim";
    this.after(won ? 1.15 : 1.5, () => this.next());
  }

  private next() {
    this.idx++;
    for (const c of this.cards) this.tween(c, { pop: 0 }, 0.2, ease.in);
    this.tween(this.sh, { a: 0 }, 0.2);
    if (this.idx >= this.total) {
      this.phase = "done"; this.hint(null);
      const perfect = this.misses === 0;
      this.after(0.35, () => {
        this.sfx("a:cheer", { gain: 0.5 });
        this.react("happy", this.rng.pick(["Bravo! Bow-wow!", "Standing ovation!", "Best shadow sniffer!", "Encore! Encore!"]));
        this.levelClear({ perfect, title: perfect ? "SHADOW STAR!" : undefined });
      });
      return;
    }
    this.after(0.28, () => this.newPrompt());
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    this.noo.hop = Math.max(0, this.noo.hop - dt * 2.2);
    this.lamp.swing = Math.max(0, this.lamp.swing - dt * 1.8);
    for (const c of this.cards) c.wig = Math.max(0, c.wig - dt * 2);
    if (this.phase !== "pick" || this.ending) return;
    this.left -= dt;
    const u = this.left / this.limit;
    this.timerBar(u, u > 0.5 ? "#7CF2C9" : u > 0.25 ? "#FFD25A" : "#FF6F91");
    if (this.left < this.tickAt && this.left > 0) { this.tickAt = Math.floor(this.left); this.sfx("a:tickHi", { gain: 0.35 }); }
    if (this.left <= 0) this.timeout();
  }

  // ------------------------------------------------------------ drawing
  private flickerOn() {
    const P = this.P;
    if (!P || !P.twists.includes("flicker") || this.phase !== "pick") return 1;
    const ph = (this.t * 0.95 + P.ph) % 1;
    return ph < 0.5 ? (Math.sin(this.t * 47) > 0.85 ? 0.35 : 1) : ph < 0.56 ? 0.5 : 0;
  }

  private drawTheatre(g: G) {
    const W = this.W, H = this.H;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#2E1538"); bg.addColorStop(0.6, "#1D0D27"); bg.addColorStop(1, "#13081B");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // soft bokeh dots
    for (let i = 0; i < 18; i++) {
      const x = (i * 211.7) % W, y = (i * 97.3) % H, r = 10 + (i % 4) * 9;
      g.fillStyle = `rgba(255,190,120,${0.03 + (i % 3) * 0.015})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // audience seat backs along the bottom
    const sy = H - 26;
    for (let x = -10, i = 0; x < W + 40; x += 46, i++) blob(g, x + (i % 2) * 8, sy + (i % 2) * 6, 22, 30, "#3B1430", { gloss: 0.15 });
    const R = this.grid;
    if (R.w > 0) { rr(g, R.x - 8, R.y - 8, R.w + 16, R.h + 12, 22); g.fillStyle = "rgba(255,220,170,0.06)"; g.fill(); }
  }

  private drawDrape(g: G, x0: number, top: number, bottom: number, w: number, side: 1 | -1) {
    const tieY = top + (bottom - top) * 0.62, inner = x0 + side * w, tieX = x0 + side * w * 0.42;
    g.beginPath();
    g.moveTo(x0, top); g.lineTo(inner, top);
    g.quadraticCurveTo(inner - side * w * 0.05, (top + tieY) / 2, tieX, tieY);
    g.quadraticCurveTo(tieX + side * w * 0.3, (tieY + bottom) / 2, x0 + side * w * 0.95, bottom);
    g.lineTo(x0, bottom); g.closePath();
    clayFill(g, "#C8323F", x0 + side * w * 0.35, (top + bottom) / 2, (bottom - top) * 0.55, { gloss: 0.18 });
    g.save(); g.clip();
    g.strokeStyle = "rgba(70,0,25,0.28)"; g.lineWidth = Math.max(2, w * 0.05);
    for (let k = 1; k <= 3; k++) {
      g.beginPath(); g.moveTo(x0 + side * w * k * 0.24, top);
      g.quadraticCurveTo(x0 + side * w * k * 0.18, tieY - 20, x0 + side * w * k * 0.12, tieY);
      g.quadraticCurveTo(x0 + side * w * k * 0.2, bottom - 20, x0 + side * w * k * 0.3, bottom); g.stroke();
    }
    g.restore();
    blob(g, tieX - side * w * 0.12, tieY, w * 0.24, Math.max(4, w * 0.09), "#FFC93C", { gloss: 0.5 });
  }

  private drawStage(g: G, glow: number) {
    const S = this.stage, Sc = this.screen;
    shadow(g, S.x + S.w / 2, S.y + S.h + 4, S.w * 0.5, 14, 0.45);
    clayPanel(g, S.x, S.y, S.w, S.h + 8, 22, "#9A5432", { lip: 8 });
    // floor planks
    const fy = this.floorY, fb = S.y + S.h - 6;
    rr(g, S.x + 8, fy, S.w - 16, fb - fy, 12);
    const fl = g.createLinearGradient(0, fy, 0, fb); fl.addColorStop(0, "#E0A266"); fl.addColorStop(1, "#B4703F");
    g.fillStyle = fl; g.fill();
    g.strokeStyle = "rgba(90,40,10,0.22)"; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) { const y = fy + ((fb - fy) * i) / 4; g.beginPath(); g.moveTo(S.x + 12, y); g.lineTo(S.x + S.w - 12, y); g.stroke(); }
    // screen (paper lit by the lamp)
    rr(g, Sc.x - 7, Sc.y - 7, Sc.w + 14, Sc.h + 14, 14); g.fillStyle = "#5A2E1C"; g.fill();
    rr(g, Sc.x, Sc.y, Sc.w, Sc.h, 10);
    const cx = Sc.x + Sc.w * 0.55, cy = Sc.y + Sc.h * 0.6;
    const pg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(Sc.w, Sc.h) * 0.75);
    pg.addColorStop(0, mix("#4A2A3A", "#FFF7DE", glow)); pg.addColorStop(0.5, mix("#3A2030", "#FFE1A0", glow)); pg.addColorStop(1, mix("#2A1622", "#E59C55", glow));
    g.fillStyle = pg; g.fill();
    g.save(); rr(g, Sc.x, Sc.y, Sc.w, Sc.h, 10); g.clip();
    g.strokeStyle = "rgba(120,60,20,0.06)"; g.lineWidth = 2;
    for (let x = Sc.x + 9; x < Sc.x + Sc.w; x += 16) { g.beginPath(); g.moveTo(x, Sc.y); g.lineTo(x + 3, Sc.y + Sc.h); g.stroke(); }
    g.restore();
  }

  private drawFront(g: G) {
    const S = this.stage, top = S.y + 6, bottom = this.floorY + 4, dw = S.w * 0.13;
    this.drawDrape(g, S.x + 6, top, bottom, dw, 1);
    this.drawDrape(g, S.x + S.w - 6, top, bottom, dw, -1);
    // valance with scallops + progress bulbs
    const vh = this.valH;
    g.beginPath(); g.moveTo(S.x + 4, S.y + 4); g.lineTo(S.x + S.w - 4, S.y + 4); g.lineTo(S.x + S.w - 4, S.y + vh);
    const n = Math.max(5, Math.round(S.w / 46)), sw = (S.w - 8) / n;
    for (let i = n - 1; i >= 0; i--) g.quadraticCurveTo(S.x + 4 + (i + 0.5) * sw, S.y + vh + sw * 0.42, S.x + 4 + i * sw, S.y + vh);
    g.closePath();
    clayFill(g, "#D63A47", S.x + S.w / 2, S.y + vh / 2, S.w * 0.5, { gloss: 0.15 });
    g.fillStyle = "#FFC93C"; g.fillRect(S.x + 6, S.y + vh * 0.72, S.w - 12, Math.max(3, vh * 0.1));
    const m = this.results.length;
    if (m && this.hud.status === "playing") {
      const sp = Math.min(30, (S.w * 0.6) / m), x0 = S.x + S.w / 2 - ((m - 1) * sp) / 2, y = S.y + vh * 0.4, r = Math.min(8, sp * 0.3);
      for (let i = 0; i < m; i++) {
        const res = this.results[i], cur = i === this.idx && this.phase !== "done";
        const col = res === "ok" ? "#FFD25A" : res === "miss" ? "#FF6F91" : cur ? (Math.sin(this.t * 8) > 0 ? "#FFFFFF" : "#FFE9B0") : "#7A3A3A";
        if (res === "ok" || cur) { g.fillStyle = rgba("#FFE38A", 0.35); g.beginPath(); g.arc(x0 + i * sp, y, r * 2, 0, Math.PI * 2); g.fill(); }
        blob(g, x0 + i * sp, y, r, r, col, { gloss: 0.6 });
      }
    } else clayText(g, "SHADOW SNAP", S.x + S.w / 2, S.y + vh * 0.42, Math.min(22, vh * 0.55), { fill: "#FFE9B0", stroke: "#6B1A22" });
  }

  private drawLamp(g: G, on: number) {
    const S = this.stage, fh = S.y + S.h - this.floorY;
    const x = S.x + S.w * 0.84, y = S.y + S.h - 10, s = fh * 1.05;
    const Sc = this.screen;
    const hx = x, hy = y - s * 0.62;
    const ang = Math.atan2(Sc.y + Sc.h * 0.5 - hy, Sc.x + Sc.w * 0.5 - hx) + Math.sin(this.lamp.swing * 12) * this.lamp.swing * 0.2;
    shadow(g, x, y, s * 0.35, s * 0.08, 0.35);
    g.strokeStyle = "#3E3854"; g.lineWidth = Math.max(3, s * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y - s * 0.06); g.lineTo(hx, hy); g.stroke();
    blob(g, x, y - s * 0.05, s * 0.26, s * 0.08, "#4A4462", { gloss: 0.4 });
    g.save(); g.translate(hx, hy); g.rotate(ang);
    if (on > 0.05) {
      const gl = g.createRadialGradient(s * 0.3, 0, 0, s * 0.3, 0, s * 0.85);
      gl.addColorStop(0, `rgba(255,236,160,${0.55 * on})`); gl.addColorStop(1, "rgba(255,236,160,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(s * 0.3, 0, s * 0.85, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.moveTo(-s * 0.17, -s * 0.12); g.lineTo(s * 0.26, -s * 0.22); g.lineTo(s * 0.26, s * 0.22); g.lineTo(-s * 0.17, s * 0.12); g.closePath();
    clayFill(g, "#2EC4B6", 0, 0, s * 0.3, { gloss: 0.4 });
    g.beginPath(); g.ellipse(s * 0.27, 0, s * 0.06, s * 0.22, 0, 0, Math.PI * 2); g.fillStyle = on > 0.3 ? "#FFF6C8" : "#7D7690"; g.fill();
    g.restore();
  }

  private drawNoodle(g: G, mood: "happy" | "wow" | "sad") {
    const S = this.stage, fh = S.y + S.h - this.floorY;
    const h = Math.min(fh * 0.95, (S.w * 0.52) / 2.36), hop = Math.sin(this.noo.hop * Math.PI) * 14;
    this.sprite(g, this.host(mood), S.x + S.w * 0.43, S.y + S.h - 8 - hop, h, { sy: 1 + Math.sin(this.t * 2.6) * 0.02 - this.noo.hop * 0.05, sx: 1 + this.noo.hop * 0.04 });
  }

  /** the shadow (and its colour reveal) on the screen */
  private drawShadow(g: G, glow: number) {
    const P = this.P;
    if (!P) return;
    const s = this.sil(P.url);
    if (!s) return;
    const Sc = this.screen, rv = this.sh.reveal;
    const sway = P.twists.includes("sway") ? 1 - rv : 0;
    const rot = P.rot * (1 - ease.inOut(rv)) + Math.sin(this.t * 2.1 + P.ph) * 0.3 * sway;
    const sx = P.flip ? lerp(-1, 1, ease.inOut(rv)) : 1;
    const maxH = Sc.h * 0.78, maxW = Sc.w * 0.8, ar = s.w / s.h;
    let h = Math.min(maxH, maxW / ar);
    const c = Math.abs(Math.cos(P.rot)), sn = Math.abs(Math.sin(P.rot));
    h *= Math.min(1, maxW / (h * ar * c + h * sn), maxH / (h * ar * sn + h * c));
    const w = h * ar;
    const cx = Sc.x + Sc.w / 2 + Math.sin(this.t * 1.3 + P.ph) * Sc.w * 0.1 * sway;
    const cy = Sc.y + Sc.h * 0.5 + Math.sin(this.t * 2.6 + P.ph) * 6 * sway + (1 - this.sh.a) * 14;
    g.save();
    rr(g, Sc.x, Sc.y, Sc.w, Sc.h, 10); g.clip();
    if (sway > 0.02) { // puppet strings
      g.strokeStyle = `rgba(30,16,40,${0.5 * this.sh.a * sway})`; g.lineWidth = 1.5;
      for (const k of [-0.25, 0.25]) { g.beginPath(); g.moveTo(Sc.x + Sc.w / 2 + k * Sc.w * 0.3, Sc.y); g.lineTo(cx + k * w * 0.6, cy - h * 0.38); g.stroke(); }
    }
    g.translate(cx, cy); g.rotate(rot); g.scale(sx * (1 + Math.sin(rv * Math.PI) * 0.08), 1 + Math.sin(rv * Math.PI) * 0.08);
    const a = this.sh.a * glow;
    if (a > 0.01 && rv < 1) {
      g.globalAlpha = a * 0.16 * (1 - rv);
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.drawImage(s.c, -w / 2 + dx, -h / 2 + dy, w, h);
      g.globalAlpha = a * 0.93 * (1 - rv);
      g.drawImage(s.c, -w / 2, -h / 2, w, h);
    }
    if (rv > 0) {
      const im = this.img(P.url);
      if (im) { g.globalAlpha = rv; g.drawImage(im, -w / 2, -h / 2, w, h); }
    }
    g.restore();
    // a curtain hides part of the shadow
    if (P.twists.includes("peek")) {
      const amt = P.peekAmt * (1 - ease.inOut(rv));
      const bx = Sc.x + Sc.w / 2 - w / 2, by = Sc.y + Sc.h * 0.5 - h / 2;
      g.save(); rr(g, Sc.x, Sc.y, Sc.w, Sc.h, 10); g.clip();
      if (P.peekSide === "t") this.drawPeekCurtain(g, Sc.x, Sc.y, Sc.w, by + h * amt - Sc.y, "t");
      else if (P.peekSide === "l") this.drawPeekCurtain(g, Sc.x, Sc.y, bx + w * amt - Sc.x, Sc.h, "l");
      else { const x0 = bx + w * (1 - amt); this.drawPeekCurtain(g, x0, Sc.y, Sc.x + Sc.w - x0, Sc.h, "r"); }
      g.restore();
    }
    if (rv > 0.3 && this.phase !== "intro") {
      g.save(); g.globalAlpha = clamp((rv - 0.3) * 2, 0, 1);
      clayText(g, `${NAME[P.id]}!`, Sc.x + Sc.w / 2, Sc.y + Math.min(30, Sc.h * 0.13), clamp(Sc.w * 0.08, 18, 34), { fill: "#FFFFFF" });
      g.restore();
    }
  }

  private drawPeekCurtain(g: G, x: number, y: number, w: number, h: number, side: "l" | "r" | "t") {
    if (w <= 1 || h <= 1) return;
    rr(g, x, y, w, h, 0);
    clayFill(g, "#B82C3A", x + w / 2, y + h / 2, Math.max(w, h) * 0.6, { gloss: 0.12, rim: false });
    g.strokeStyle = "rgba(70,0,25,0.3)"; g.lineWidth = 3;
    if (side === "t") for (let xx = x + 14; xx < x + w; xx += 22) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + 2, y + h); g.stroke(); }
    else for (let xx = x + 10; xx < x + w; xx += 20) { g.beginPath(); g.moveTo(xx, y); g.quadraticCurveTo(xx + 5, y + h / 2, xx, y + h); g.stroke(); }
    g.fillStyle = "#FFC93C";
    if (side === "t") { g.fillRect(x, y + h - 6, w, 6); for (let xx = x + 6; xx < x + w; xx += 12) { g.beginPath(); g.arc(xx, y + h, 4, 0, Math.PI); g.fill(); } }
    else { const ex = side === "l" ? x + w - 6 : x; g.fillRect(ex, y, 6, h); }
  }

  private drawCard(g: G, c: Card, i: number) {
    if (c.pop <= 0.01) return;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    g.save();
    const jump = c.state === "right" ? Math.abs(Math.sin(this.t * 9)) * 6 * c.hot : 0;
    g.translate(cx + Math.sin(c.wig * 30) * c.wig * 9, cy - jump);
    g.rotate(Math.sin(c.wig * 22) * c.wig * 0.09);
    const s = c.pop * (1 - c.press * 0.07) * (1 + (c.state === "right" ? 0.05 : 0));
    g.scale(s, s);
    if (c.state === "dim" || c.state === "wrong") g.globalAlpha = 0.5;
    shadow(g, 0, c.h / 2 + 2, c.w * 0.45, 8, 0.4);
    if (c.hot > 0 && c.state !== "dim" && c.state !== "wrong") {
      const pulse = 0.6 + Math.sin(this.t * 10) * 0.25;
      g.save(); g.shadowColor = c.state === "right" ? "#7CF2C9" : "#FFD25A"; g.shadowBlur = 26 * pulse;
      rr(g, -c.w / 2, -c.h / 2, c.w, c.h - 6, 18); g.fillStyle = c.state === "right" ? "#7CF2C9" : "#FFD25A"; g.fill(); g.restore();
    }
    clayPanel(g, -c.w / 2, -c.h / 2, c.w, c.h, 18, c.state === "right" ? "#C8F7D6" : "#FFF4E2", { lip: 7 });
    rr(g, -c.w / 2 + 7, -c.h / 2 + 7, c.w - 14, c.h - 22, 13);
    const bg = g.createRadialGradient(0, -c.h * 0.05, 4, 0, 0, c.w * 0.7);
    bg.addColorStop(0, "#FFFFFF"); bg.addColorStop(1, c.tint);
    g.fillStyle = bg; g.fill();
    const im = this.img(c.url);
    if (im?.naturalWidth) {
      const iw = c.w - 22, ih = c.h - 34, ar = im.naturalWidth / im.naturalHeight;
      const h = Math.min(ih, iw / ar);
      this.sprite(g, c.url, 0, c.h / 2 - 17, h, { sy: 1 + (c.state === "right" ? Math.sin(this.t * 12) * 0.04 : Math.sin(this.t * 2 + i) * 0.012) });
    }
    if (c.state === "wrong") {
      g.strokeStyle = "#E8504F"; g.lineWidth = 6; g.lineCap = "round";
      const k = Math.min(c.w, c.h) * 0.16, ox = c.w / 2 - k - 10, oy = -c.h / 2 + k + 10;
      g.beginPath(); g.moveTo(ox - k / 2, oy - k / 2); g.lineTo(ox + k / 2, oy + k / 2); g.moveTo(ox + k / 2, oy - k / 2); g.lineTo(ox - k / 2, oy + k / 2); g.stroke();
    }
    if (this.W > 700) {
      blob(g, -c.w / 2 + 16, -c.h / 2 + 16, 12, 12, "#23305A", { gloss: 0.3 });
      clayText(g, String(i + 1), -c.w / 2 + 16, -c.h / 2 + 17, 15, { fill: "#FFFFFF", stroke: "#23305A", gloss: false });
    }
    g.restore();
  }

  private scene(g: G, mood: "happy" | "wow" | "sad") {
    const on = this.flickerOn();
    const glow = 0.25 + 0.75 * on;
    this.drawTheatre(g);
    this.drawStage(g, glow);
    this.drawShadow(g, on > 0.2 ? 1 : 0.12);
    this.drawNoodle(g, mood);
    this.drawLamp(g, on);
    this.drawFront(g);
    this.cards.forEach((c, i) => this.drawCard(g, c, i));
  }

  protected drawBackground(g: G) {
    if (!this.demo) {
      this.demo = true;
      const ids: CastId[] = ["momo", "pip", "gloop"];
      this.cards = ids.map((id, i) => ({ id, url: spriteUrl(id, "happy"), x: 0, y: 0, w: 0, h: 0, pop: 1, press: 0, wig: 0, state: "idle", hot: 0, tint: CARD_TINT[i] }));
      this.P = { id: "pip", url: spriteUrl("pip", "happy"), twists: ["sway"], rot: 0, flip: false, peekSide: "l", peekAmt: 0, ph: 0 };
      this.sh = { a: 1, reveal: 0 }; this.results = []; this.phase = "intro"; this.cols = 0;
    }
    this.layout();
    this.scene(g, "happy");
  }

  protected draw(g: G) { this.scene(g, this.hud.host.mood); }
}
