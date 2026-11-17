// Fish Watch — Pip's pond. Golden fish glow, turn grey, then the fish SHUFFLE: pairs swap places
// along curved paths (several pairs at once on harder levels, circle spins, zoom swaps).
// Tap the fish that were golden. Unlimited levels: more fish, more targets, faster & busier shuffles.
import { ArcadeGame, Bag, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { blob, clayFill, darken, eye, lighten, mouth, rr, shadow, type G } from "../paint";

type Twist = "none" | "zoom" | "ice" | "glint" | "spin";
interface Seg { t0: number; t1: number; from: number; to: number; bend: number }
interface Fish {
  x: number; y: number; a: number; size: number; ph: number;
  slot: number; segs: Seg[]; moving: boolean;
  target: boolean; state: "swim" | "picked-good" | "picked-bad"; gold: number; flip: number; jump: number;
}
interface Ice { x: number; y: number; r: number; vx: number; vy: number; rot: number }

export default class FishWatch extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "fish-watch", title: "Fish Watch", host: "pip", style: "rounds",
    music: { calm: "a:fish_calm", action: "a:fish_action" },
    sounds: ["a:bubble", "a:bubbles", "a:splash", "a:gulp", "a:slap", "a:tink", "a:poof", "a:chime", "a:slideUp", "a:drip", "a:whistle", "whoosh", "whooshShort"],
    voicePitch: 1.6,
  };
  private fish: Fish[] = [];
  private slots: { x: number; y: number }[] = [];
  private ice: Ice[] = [];
  private phase: "show" | "track" | "pick" | "done" = "show";
  private phaseT = 0;
  private P = { k: 1, n: 4, moves: 5, dur: 0.9, pairs: 1, show: 2.5, targetBias: 0.6 };
  private trackEnd = 3;
  private twist: Twist = "none";
  private twists = new Bag<Twist>(["zoom", "ice", "glint", "spin"]);
  private moveCues: { t: number; x: number; fast: boolean }[] = [];
  private picks = 0; private wrongs = 0; private pickStart = 0;
  private pond = { x: 0, y: 0, w: 100, h: 100 };
  private pip = { x: 0, y: 0, h: 100, bounce: 0 };
  private ripples: { x: number; y: number; r: number; a: number }[] = [];
  private glintAt = -1; private glintFish = -1;
  private bg?: HTMLCanvasElement;

  protected onResize() {
    this.layout(); this.bg = undefined;
    if (this.fish.length && this.phase !== "track") {
      const size = this.sizeFor(this.makeSlots(this.fish.length));
      this.fish.forEach((f, i) => { f.slot = i; f.size = size; const s = this.slots[i]; f.x = s.x; f.y = s.y; });
    }
  }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 0.95;
    if (portrait) {
      const ph = clamp(A.h * 0.2, 80, 140);
      this.pond = { x: 12, y: A.y + 2, w: this.W - 24, h: A.h - ph * 0.62 - 6 };
      this.pip = { ...this.pip, x: this.W / 2, y: A.y + A.h + 4, h: ph };
    } else {
      const ph = clamp(A.h * 0.42, 110, 220);
      this.pond = { x: 16, y: A.y + 2, w: this.W - ph * 0.95 - 40, h: A.h - 6 };
      this.pip = { ...this.pip, x: this.W - ph * 0.5 - 14, y: A.y + A.h + 2, h: ph };
    }
  }

  /** jittered grid of resting spots inside the pond — every spot has its own cell, so resting fish never overlap */
  private makeSlots(n: number) {
    const p = this.pond, pad = 10;
    const w = p.w - pad * 2, h = p.h - pad * 2;
    const cols = Math.max(2, Math.round(Math.sqrt((n * w) / h)));
    const rows = Math.ceil(n / cols);
    // use spare cells to spread fish out (never more than ~35% empty)
    const cw = w / cols, ch = h / rows;
    const cells: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: p.x + pad + (c + 0.5) * cw, y: p.y + pad + (r + 0.5) * ch });
    const pick = this.rng.shuffle(cells).slice(0, n);
    this.slots = pick.map((s, i) => ({ x: s.x + Math.sin(i * 12.9 + this.level) * cw * 0.08, y: s.y + Math.cos(i * 7.3 + this.level) * ch * 0.08 }));
    return Math.min(cw, ch);
  }
  /** fish size that always fits its cell (tap-friendly, no overlap) */
  private sizeFor(cell: number) { return clamp(cell * 0.33, 16, 34); }

  // ------------------------------------------------------------ levels
  protected setupLevel() {
    this.layout();
    const L = this.level, d = this.diff;
    const k = byDiff(d, { easy: Math.min(4, 1 + Math.floor((L - 1) / 4)), medium: Math.min(5, 2 + Math.floor((L - 1) / 4)), hard: Math.min(6, 2 + Math.floor((L - 1) / 3)) });
    const n = Math.min(byDiff(d, { easy: 10, medium: 13, hard: 16 }), k + byDiff(d, { easy: 3, medium: 4, hard: 5 }) + Math.floor((L - 1) / 3));
    this.P = {
      k, n,
      moves: Math.min(byDiff(d, { easy: 14, medium: 18, hard: 22 }), byDiff(d, { easy: 4, medium: 6, hard: 8 }) + Math.floor((L - 1) / 2)),
      dur: ramp(L, byDiff(d, { easy: 0.95, medium: 0.8, hard: 0.68 }), -0.03, byDiff(d, { easy: 0.45, medium: 0.38, hard: 0.3 })),
      pairs: byDiff(d, { easy: L >= 9 ? 2 : 1, medium: L >= 4 ? 2 : 1, hard: L >= 6 ? 3 : 2 }),
      show: ramp(L, byDiff(d, { easy: 2.6, medium: 2.2, hard: 2.0 }), -0.05, byDiff(d, { easy: 1.8, medium: 1.5, hard: 1.3 })),
      targetBias: byDiff(d, { easy: 0.55, medium: 0.65, hard: 0.75 }),
    };
    const twistFrom = byDiff(d, { easy: 6, medium: 4, hard: 3 });
    this.twist = L >= twistFrom && this.rng.chance(0.65) ? this.twists.next(this.rng) : "none";
    if (this.twist === "glint" && d === "easy") this.twist = "spin";
    const size = this.sizeFor(this.makeSlots(n));
    this.fish = this.slots.map((s, i) => ({
      x: s.x, y: s.y, a: this.rng.chance(0.5) ? 0 : Math.PI, size: size * this.rng.range(0.96, 1.02), ph: this.rng.range(0, 10),
      slot: i, segs: [], moving: false, target: false, state: "swim", gold: 0, flip: 0, jump: 0,
    }));
    this.rng.shuffle([...this.fish.keys()]).slice(0, k).forEach((i) => { this.fish[i].target = true; this.fish[i].gold = 1; });
    this.ice = this.twist === "ice" ? Array.from({ length: 2 + (d === "hard" ? 1 : 0) }, () => ({
      x: this.rng.range(this.pond.x + 60, this.pond.x + this.pond.w - 60), y: this.rng.range(this.pond.y + 60, this.pond.y + this.pond.h - 60),
      r: clamp(Math.min(this.pond.w, this.pond.h) * 0.12, 36, 74), vx: this.rng.range(-16, 16), vy: this.rng.range(-12, 12), rot: this.rng.range(0, 6),
    })) : [];
    this.picks = 0; this.wrongs = 0; this.glintAt = -1;
    this.phase = "show"; this.phaseT = 0;
    this.hint(k === 1 ? "Remember the golden fish! 👀" : `Remember the ${k} golden fish! 👀`);
    this.react("wow", this.rng.pick(["My dinner!", "Shiny fish!", "Don't forget them!", "Ooh gold!"]));
    this.fish.filter((f) => f.target).forEach((f, i) => this.sfx("a:tink", { x: f.x, delay: 0.15 + i * 0.12, rate: 1 + i * 0.08, gain: 0.6 }));
    this.music("calm");
  }

  /** build the whole shuffle choreography (swaps, multi-swaps, spins) */
  private buildShuffle() {
    const n = this.fish.length, P = this.P, r = this.rng;
    const slotOf = this.fish.map((f) => f.slot);
    const dist = (a: number, b: number) => Math.hypot(this.slots[a].x - this.slots[b].x, this.slots[a].y - this.slots[b].y);
    this.fish.forEach((f) => (f.segs = []));
    this.moveCues = [];
    let t = 0.45; // slow start so you can see the first swap
    for (let m = 0; m < P.moves; m++) {
      const slow = m === 0 ? 1.35 : 1;
      const zoom = this.twist === "zoom" && m > 0 && r.chance(0.3);
      const d = P.dur * slow * (zoom ? 0.6 : 1);
      const busy = new Set<number>();
      const spin = this.twist === "spin" && m > 0 && r.chance(0.3) && n >= 4;
      if (spin) {
        // 3–4 nearby fish rotate around their centre
        const start = r.int(0, n - 1);
        const group = [...Array(n).keys()].sort((a, b) => dist(slotOf[a], slotOf[start]) - dist(slotOf[b], slotOf[start])).slice(0, r.chance(0.5) ? 3 : 4);
        const slots = group.map((i) => slotOf[i]);
        const dir = r.chance(0.5) ? 1 : -1;
        group.forEach((fi, j) => {
          const to = slots[(j + dir + group.length) % group.length];
          this.fish[fi].segs.push({ t0: t, t1: t + d * 1.3, from: slotOf[fi], to, bend: 0.35 * dir });
          slotOf[fi] = to;
        });
        this.moveCues.push({ t, x: this.slots[slots[0]].x, fast: false });
        t += d * 1.3 + P.dur * 0.15;
        continue;
      }
      for (let p = 0; p < P.pairs; p++) {
        const free = [...Array(n).keys()].filter((i) => !busy.has(i));
        if (free.length < 2) break;
        const tg = free.filter((i) => this.fish[i].target);
        const a = tg.length && r.chance(P.targetBias) ? r.pick(tg) : r.pick(free);
        const others = free.filter((i) => i !== a).sort((x, y) => dist(slotOf[x], slotOf[a]) - dist(slotOf[y], slotOf[a]));
        // mostly neighbours (readable), sometimes a long cross-pond swap
        const b = r.chance(0.3) ? r.pick(others) : others[Math.min(others.length - 1, r.int(0, 2))];
        busy.add(a); busy.add(b);
        const sa = slotOf[a], sb = slotOf[b];
        const bend = r.range(0.25, 0.5) * (r.chance(0.5) ? 1 : -1);
        this.fish[a].segs.push({ t0: t, t1: t + d, from: sa, to: sb, bend });
        this.fish[b].segs.push({ t0: t, t1: t + d, from: sb, to: sa, bend });
        slotOf[a] = sb; slotOf[b] = sa;
        this.moveCues.push({ t, x: (this.slots[sa].x + this.slots[sb].x) / 2, fast: zoom });
      }
      t += d + P.dur * 0.18;
    }
    this.trackEnd = t + 0.25;
  }

  private startTrack() {
    this.phase = "track"; this.phaseT = 0;
    this.buildShuffle();
    for (const f of this.fish) if (f.target) this.tween(f, { gold: 0 }, 0.55, ease.in, 0.1);
    this.sfx("a:whistle", { gain: 0.4 }); this.sfx("a:bubbles", { gain: 0.45 });
    this.banner("SHUFFLE!", undefined, "gold");
    this.hint(this.twist === "glint" ? "Careful… sneaky sparkles! ✨" : this.twist === "ice" ? "They swim under the ice! 🧊" : this.twist === "spin" ? "Round and round they go! 🌀" : this.twist === "zoom" ? "Zoom swaps! Watch closely ⚡" : "Follow the golden fish!");
    this.music("action");
    if (this.twist === "glint") { this.glintAt = this.trackEnd * this.rng.range(0.35, 0.7); this.glintFish = this.fish.findIndex((f) => !f.target); }
  }

  private startPick() {
    this.phase = "pick"; this.phaseT = 0; this.pickStart = this.t;
    this.timerBar(null);
    for (const f of this.fish) { f.moving = false; const s = this.slots[f.slot]; f.x = s.x; f.y = s.y; }
    const k = this.P.k;
    this.hint(k === 1 ? "Tap the golden fish! 👆" : `Tap the ${k} golden fish! 👆`);
    this.react("happy", this.rng.pick(["Which ones?", "Help me remember!", "Uhh… which?", "I forgot! 😅"]));
    if (this.level === 1 || this.level % 3 === 0) this.say("Which fish were golden?");
    this.sfx("a:splash", { gain: 0.35 });
    this.music("calm");
  }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    if (this.phase !== "pick") { this.ripple(x, y); this.sfx("a:drip", { x, gain: 0.3 }); return; }
    let best: Fish | null = null, bd = Infinity;
    for (const f of this.fish) {
      if (f.state !== "swim") continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < Math.max(34, f.size * 1.7) && d < bd) { best = f; bd = d; }
    }
    if (!best) { this.ripple(x, y); this.sfx("a:drip", { x, gain: 0.35 }); return; }
    this.picks++;
    if (best.target) {
      best.state = "picked-good"; best.jump = 0.0001;
      const speed = clamp(1 - (this.t - this.pickStart) / (2.5 * this.P.k), 0, 1);
      this.good(best.x, best.y - 20, 100, speed * 0.5);
      this.sfx("a:splash", { x: best.x, gain: 0.45 }); this.sfx("a:gulp", { delay: 0.45, gain: 0.7 });
      this.tween(best, { gold: 1 }, 0.2);
      this.after(0.5, () => { this.pip.bounce = 1; this.react("happy", this.rng.pick(["Yum!", "Gulp!", "Tasty!", "Mmm!"]), false); });
    } else {
      best.state = "picked-bad"; best.flip = 0.0001; this.wrongs++;
      this.sfx("a:slap", { x: best.x, gain: 0.8, delay: 0.1 });
      this.bad(best.x, best.y, { line: this.rng.pick(["Not that one!", "Ouch! Fish slap!", "Hey!", "Wrong fishy!"]) });
    }
    this.ripple(best.x, best.y);
    if (this.picks >= this.P.k) this.finish();
  }

  private finish() {
    this.phase = "done";
    this.hint(null);
    if (this.wrongs === 0) this.after(0.7, () => this.levelClear({ perfect: true }));
    else {
      this.after(0.5, () => { for (const f of this.fish) if (f.target && f.state === "swim") { this.tween(f, { gold: 1 }, 0.3); this.sfx("a:tink", { x: f.x, gain: 0.5 }); } });
      this.after(1.4, () => this.levelFail(this.P.k > 1 ? "The golden fish were here!" : "That was the golden fish!"));
    }
  }

  private ripple(x: number, y: number) { this.ripples.push({ x, y, r: 6, a: 1 }); }

  // ------------------------------------------------------------ simulation
  protected update(dt: number) {
    this.phaseT += dt;
    if (this.pip.bounce > 0) this.pip.bounce = Math.max(0, this.pip.bounce - dt * 2.5);
    for (const r of this.ripples) { r.r += 70 * dt; r.a -= dt * 1.2; }
    this.ripples = this.ripples.filter((r) => r.a > 0);
    if (Math.random() < dt * 1.5) this.particles.push({ x: this.pond.x + Math.random() * this.pond.w, y: this.pond.y + this.pond.h - 10, vx: 0, vy: -30 - Math.random() * 30, life: 2.2, max: 2.2, size: 2 + Math.random() * 4, color: "#fff", kind: "bubble", rot: 0, vr: 0, g: -10 });
    for (const c of this.ice) {
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 0.1;
      if (c.x < this.pond.x + c.r * 0.6 || c.x > this.pond.x + this.pond.w - c.r * 0.6) c.vx *= -1;
      if (c.y < this.pond.y + c.r * 0.6 || c.y > this.pond.y + this.pond.h - c.r * 0.6) c.vy *= -1;
    }
    if (this.phase === "show") {
      this.timerBar(1 - this.phaseT / this.P.show, "#FFD25A");
      if (this.phaseT >= this.P.show) this.startTrack();
    } else if (this.phase === "track") {
      this.timerBar(1 - this.phaseT / this.trackEnd, "#7CC8FF");
      for (const c of this.moveCues) if (c.t > this.phaseT - dt && c.t <= this.phaseT) { this.sfx(c.fast ? "whooshShort" : "whoosh", { x: c.x, gain: 0.35 }); if (Math.random() < 0.4) this.sfx("a:bubble", { x: c.x, gain: 0.3, rate: 0.9 + Math.random() * 0.4 }); }
      if (this.glintAt > 0 && this.phaseT >= this.glintAt) { const f = this.fish[this.glintFish]; if (f) { f.gold = 0.9; this.tween(f, { gold: 0 }, 0.35, ease.in, 0.15); this.sfx("a:tink", { x: f.x, gain: 0.45 }); } this.glintAt = -1; }
      if (this.phaseT >= this.trackEnd) this.startPick();
    }
    // pose every fish: on a shuffle path or bobbing at its spot
    const tt = this.phaseT;
    for (const f of this.fish) {
      if (f.state === "picked-good") { f.jump = Math.min(1, f.jump + dt * 1.6); continue; }
      if (f.state === "picked-bad") f.flip = Math.min(1, f.flip + dt * 2.2);
      const seg = this.phase === "track" ? f.segs.find((s) => tt >= s.t0 && tt < s.t1) : undefined;
      if (seg) {
        const A = this.slots[seg.from], B = this.slots[seg.to];
        const u = ease.inOut((tt - seg.t0) / (seg.t1 - seg.t0));
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
        const off = Math.sin(Math.PI * u) * seg.bend * L;
        const nx = A.x + dx * u - (dy / L) * off, ny = A.y + dy * u + (dx / L) * off;
        const vx = nx - f.x, vy = ny - f.y;
        if (Math.hypot(vx, vy) > 0.3) f.a = Math.atan2(vy, vx);
        f.x = nx; f.y = ny; f.moving = true;
        if (Math.random() < dt * 14) this.particles.push({ x: f.x - Math.cos(f.a) * f.size, y: f.y - Math.sin(f.a) * f.size, vx: 0, vy: -12, life: 0.5, max: 0.5, size: 2 + Math.random() * 2.5, color: "#fff", kind: "bubble", rot: 0, vr: 0, g: -20 });
      } else {
        if (this.phase === "track") {
          const done = f.segs.filter((s) => s.t1 <= tt);
          f.slot = done.length ? done[done.length - 1].to : f.slot;
        }
        const s = this.slots[f.slot] ?? { x: f.x, y: f.y };
        f.moving = false;
        f.x = lerp(f.x, s.x + Math.sin(this.t * 1.3 + f.ph) * 3, Math.min(1, dt * 10));
        f.y = lerp(f.y, s.y + Math.cos(this.t * 1.7 + f.ph) * 3, Math.min(1, dt * 10));
        const facing = Math.cos(f.a) >= 0 ? 0 : Math.PI;
        f.a = lerp(f.a, facing, Math.min(1, dt * 4));
      }
    }
    // keep the final resting slot in sync once the shuffle ends
    if (this.phase === "pick") for (const f of this.fish) if (f.segs.length) { f.slot = f.segs[f.segs.length - 1].to; f.segs = []; }
  }

  // ------------------------------------------------------------ drawing
  protected drawBackground(g: G) { this.layout(); this.drawScene(g, false); }

  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const sky = g.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0, "#BFE3FF"); sky.addColorStop(0.5, "#E9F6FF"); sky.addColorStop(1, "#D3EAFB");
    g.fillStyle = sky; g.fillRect(0, 0, this.W, this.H);
    for (let i = 0; i < 26; i++) blob(g, (i * 97.3) % this.W, (i * 61.7) % this.H, 40 + (i % 5) * 14, 18 + (i % 3) * 8, "#F7FBFF", { gloss: 0.5 });
    const p = this.pond, r = Math.min(p.w, p.h) * 0.18;
    g.save();
    rr(g, p.x - 8, p.y - 6, p.w + 16, p.h + 14, r + 8); g.fillStyle = "#9CC9EA"; g.fill();
    rr(g, p.x, p.y, p.w, p.h, r);
    const water = g.createLinearGradient(0, p.y, 0, p.y + p.h);
    water.addColorStop(0, "#58B7E8"); water.addColorStop(0.6, "#2E86C8"); water.addColorStop(1, "#1C5C9C");
    g.fillStyle = water; g.fill();
    g.clip();
    for (let i = 0; i < 9; i++) blob(g, p.x + ((i * 131) % p.w), p.y + p.h - 8 - (i % 3) * 10, 30 + (i % 4) * 10, 12, "#3B7FB0", { gloss: 0.15 });
    g.restore();
    g.strokeStyle = "#FFFFFF"; g.lineWidth = 7; rr(g, p.x - 3, p.y - 3, p.w + 6, p.h + 6, r + 3); g.stroke();
    this.bg = c;
  }

  private drawScene(g: G, live: boolean) {
    if (!this.bg || this.bg.width !== Math.round(this.W * this.dpr)) this.paintStatic();
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    const p = this.pond, r = Math.min(p.w, p.h) * 0.18;
    g.save();
    rr(g, p.x, p.y, p.w, p.h, r); g.clip();
    g.globalAlpha = 0.16; g.strokeStyle = "#FFFFFF"; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      for (let x = p.x; x <= p.x + p.w; x += 18) {
        const y = p.y + (i + 0.5) * (p.h / 7) + Math.sin(x * 0.03 + this.t * 1.3 + i) * 7;
        if (x === p.x) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const rp of this.ripples) { g.strokeStyle = `rgba(255,255,255,${rp.a * 0.7})`; g.lineWidth = 3; g.beginPath(); g.ellipse(rp.x, rp.y, rp.r, rp.r * 0.55, 0, 0, Math.PI * 2); g.stroke(); }
    if (live) {
      // faint lily-pad spots show the resting places
      if (this.phase !== "show") for (const s of this.slots) { g.fillStyle = "rgba(255,255,255,0.07)"; g.beginPath(); g.ellipse(s.x, s.y + 6, 26, 12, 0, 0, Math.PI * 2); g.fill(); }
      for (const f of this.fish) if (f.state !== "picked-good") this.drawFish(g, f);
      for (const c of this.ice) this.drawIce(g, c);
    } else {
      for (let i = 0; i < 6; i++) {
        const f = { x: p.x + p.w * (0.2 + 0.12 * i), y: p.y + p.h * (0.3 + 0.08 * Math.sin(this.t + i)), a: i % 2 ? Math.PI : 0, size: 26, ph: i, gold: i === 2 ? 1 : 0, state: "swim", target: false, flip: 0, moving: false } as unknown as Fish;
        this.drawFish(g, f);
      }
    }
    g.restore();
    if (live) for (const f of this.fish) if (f.state === "picked-good" && f.jump < 1) {
      const u = ease.inOut(f.jump);
      const x = lerp(f.x, this.pip.x, u), y = lerp(f.y, this.pip.y - this.pip.h * 0.62, u) - Math.sin(Math.PI * u) * 120;
      this.drawFish(g, { ...f, x, y, a: -Math.PI / 2 + u * Math.PI * 2, gold: 1 });
    }
    const pp = this.pip;
    blob(g, pp.x, pp.y - 6, pp.h * 0.62, pp.h * 0.13, "#EAF6FF", { gloss: 0.6 });
    const mood = live ? this.hud.host.mood : "happy";
    const b = pp.bounce;
    this.sprite(g, this.host(mood), pp.x, pp.y - pp.h * 0.08, pp.h, { sy: 1 + Math.sin(b * Math.PI) * 0.12 + Math.sin(this.t * 3) * 0.015, sx: 1 - Math.sin(b * Math.PI) * 0.06 });
  }

  protected draw(g: G) { this.drawScene(g, true); }

  private drawFish(g: G, f: Fish) {
    const s = f.size;
    const bad = f.state === "picked-bad";
    const base = bad ? "#FF8FA3" : f.gold > 0.02 ? lerpColor("#9FB4CC", "#FFC93C", f.gold) : "#9FB4CC";
    shadow(g, f.x + 4, f.y + s * 0.9, s * 1.1, s * 0.3, 0.22);
    if (f.gold > 0.05) {
      const gl = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, s * 2.2);
      gl.addColorStop(0, `rgba(255,230,120,${0.55 * f.gold})`); gl.addColorStop(1, "rgba(255,230,120,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(f.x, f.y, s * 2.2, 0, Math.PI * 2); g.fill();
    }
    g.save(); g.translate(f.x, f.y);
    const facingLeft = Math.cos(f.a) < 0;
    g.rotate(facingLeft ? f.a + Math.PI : f.a);
    if (facingLeft) g.scale(-1, 1);
    if (bad) g.rotate(Math.sin(f.flip * Math.PI * 3) * 0.6);
    const wig = Math.sin(this.t * (f.moving ? 22 : 7) + f.ph) * (f.moving ? 0.5 : 0.25);
    g.save(); g.translate(-s * 0.85, 0); g.rotate(wig);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-s * 0.55, -s * 0.85, -s * 0.8, -s * 0.6); g.quadraticCurveTo(-s * 0.55, 0, -s * 0.8, s * 0.6); g.quadraticCurveTo(-s * 0.55, s * 0.85, 0, 0);
    clayFill(g, darken(base, 0.12), -s * 0.4, 0, s * 0.8, { gloss: 0.2 });
    g.restore();
    g.beginPath(); g.moveTo(-s * 0.35, -s * 0.5); g.quadraticCurveTo(0, -s * 1.05, s * 0.3, -s * 0.52); g.closePath();
    clayFill(g, darken(base, 0.15), 0, -s * 0.6, s * 0.5, { gloss: 0.15 });
    g.beginPath(); g.ellipse(0, 0, s, s * 0.64, 0, 0, Math.PI * 2);
    clayFill(g, base, 0, 0, s, { gloss: 0.45 });
    g.save(); g.beginPath(); g.ellipse(0, 0, s, s * 0.64, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = lighten(base, 0.35); g.beginPath(); g.ellipse(s * 0.05, s * 0.42, s * 0.8, s * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = darken(base, 0.2); g.lineWidth = s * 0.12;
    for (const sx of [-0.35, -0.05]) { g.beginPath(); g.arc(s * sx, 0, s * 0.62, -0.9, 0.9); g.stroke(); }
    g.restore();
    g.beginPath(); g.ellipse(-s * 0.05, s * 0.18, s * 0.28, s * 0.14, 0.6 + Math.sin(this.t * 10 + f.ph) * 0.3, 0, Math.PI * 2);
    clayFill(g, darken(base, 0.1), 0, s * 0.2, s * 0.3, { gloss: 0.1 });
    eye(g, s * 0.45, -s * 0.14, s * 0.23, { look: [0.5, 0], pupil: bad ? 0.35 : 0.55, blink: Math.sin(this.t * 0.7 + f.ph * 3) > 0.985 ? 1 : 0 });
    mouth(g, s * 0.82, s * 0.16, s * 0.3, bad ? "oh" : f.moving ? "oh" : "smile");
    g.fillStyle = "rgba(255,111,145,0.5)"; g.beginPath(); g.ellipse(s * 0.5, s * 0.2, s * 0.12, s * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  private drawIce(g: G, c: Ice) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.rot);
    g.beginPath();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, rr2 = c.r * (0.8 + ((i * 37) % 10) / 40); if (i === 0) g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.75); else g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.75); }
    g.closePath();
    g.globalAlpha = 0.93;
    clayFill(g, "#E8F7FF", 0, 0, c.r, { gloss: 0.6 });
    g.restore();
  }
}

function lerpColor(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const gg = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bb = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
  return "#" + [r, gg, bb].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
