// Glow Grid — squares glow for a moment; tap every one that glowed (or in the exact order).
// Unlimited levels: bigger grids, more lights, shorter looks, IN ORDER rounds and a ROTATE twist.
import { ArcadeGame, Recent, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { clayText, rgba, rr, type G } from "../paint";

type Phase = "ready" | "show" | "rotate" | "input" | "done";

export default class GridGlow extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "grid-glow", title: "Glow Grid", host: "bolt", style: "rounds",
    music: { calm: "a:glow_calm", action: "a:glow_action" },
    sounds: ["a:zap", "a:blip", "a:tickHi", "a:teleport", "a:sparks", "a:tink"],
    voicePitch: 0.9, transition: "iris",
  };
  private n = 3;
  private targets: number[] = [];
  private found = new Set<number>();
  private idx = 0;
  private inOrder = false; private rotate = false;
  private phase: Phase = "ready";
  private glow: number[] = []; private hit: number[] = []; private miss: number[] = []; private reveal: number[] = [];
  private mistakes = 0; private allowed = 2;
  private spin = { v: 0 };
  private grid = { x: 0, y: 0, s: 300 };
  private bolt = { x: 0, y: 0, h: 110, bop: 0 };
  private recent = new Recent(20);
  private stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 0.618) % 1, y: ((i * 0.377) % 1) * 0.6, p: i * 1.7 }));

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 1.05;
    const bh = clamp(A.h * (portrait ? 0.15 : 0.32), 70, 170);
    if (portrait) {
      const side = Math.min(this.W - 28, A.h - bh - 34, 620);
      this.grid = { x: (this.W - side) / 2, y: A.y + 8 + (A.h - bh - 34 - side) / 2, s: side };
      this.bolt = { ...this.bolt, x: this.W - bh * 0.55, y: A.y + A.h + 4, h: bh };
    } else {
      const side = Math.min(A.h - 24, this.W - bh * 2.2, 640);
      this.grid = { x: (this.W - side) / 2, y: A.y + (A.h - side) / 2, s: side };
      this.bolt = { ...this.bolt, x: Math.max(bh * 0.6, this.grid.x - bh * 0.7), y: A.y + A.h - 6, h: bh };
    }
  }

  private cellRect(i: number) {
    const n = this.n, gap = Math.max(4, this.grid.s * 0.025), cs = (this.grid.s - gap * (n + 1)) / n;
    const r = Math.floor(i / n), c = i % n;
    return { x: this.grid.x + gap + c * (cs + gap), y: this.grid.y + gap + r * (cs + gap), s: cs };
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.n = byDiff(d, { easy: Math.min(5, 3 + Math.floor((L - 1) / 3)), medium: Math.min(6, 4 + Math.floor((L - 1) / 4)), hard: Math.min(7, 4 + Math.floor((L - 1) / 3)) });
    const cells = this.n * this.n;
    const lit = Math.min(Math.floor(cells * 0.45), byDiff(d, { easy: Math.min(10, 3 + Math.floor((L - 1) * 0.6)), medium: Math.min(14, 4 + Math.floor((L - 1) * 0.7)), hard: Math.min(18, 5 + Math.floor((L - 1) * 0.8)) }));
    this.inOrder = byDiff(d, { easy: L >= 12 && L % 4 === 0, medium: L >= 7 && L % 3 === 1, hard: L >= 3 && L % 2 === 1 });
    this.rotate = !this.inOrder && byDiff(d, { easy: false, medium: L >= 14 && L % 4 === 2, hard: L >= 8 && L % 3 === 2 });
    const count = this.inOrder ? Math.max(3, Math.ceil(lit * 0.7)) : lit;
    let t: number[] = [];
    for (let k = 0; k < 25; k++) {
      t = this.rng.shuffle(Array.from({ length: cells }, (_, i) => i)).slice(0, count);
      const sig = `${this.n}:${(this.inOrder ? t : [...t].sort((a, b) => a - b)).join(",")}`;
      if (!this.recent.has(sig)) { this.recent.add(sig); break; }
    }
    this.targets = t;
    this.found = new Set(); this.idx = 0; this.mistakes = 0; this.spin.v = 0;
    this.allowed = byDiff(d, { easy: 2, medium: 1, hard: L >= 10 ? 0 : 1 });
    this.glow = new Array(cells).fill(0); this.hit = new Array(cells).fill(0); this.miss = new Array(cells).fill(0); this.reveal = new Array(cells).fill(0);
    this.layout();
    this.phase = "ready";
    this.music(count >= 9 ? "action" : "calm");
    const banner = this.inOrder ? ["IN ORDER!", "Tap them in the same order"] : this.rotate ? ["ROTATE!", "The grid will turn — follow it!"] : null;
    if (banner) this.after(0.45, () => { this.banner(banner[0], banner[1], this.inOrder ? "pink" : "red"); this.react("wow", this.inOrder ? "Order matters now!" : "Get ready to spin!"); });
    else this.react("happy", this.rng.pick(["Watch the glow!", "Beep! Lights on!", "Remember the squares!", "Glow time!"]));
    this.hint(this.inOrder ? "Watch the ORDER the squares glow 👀" : `Remember ${count} glowing squares 👀`);
    this.after(banner ? 2.0 : 1.2, () => this.show());
  }

  private show() {
    this.phase = "show";
    const L = this.level, d = this.diff, k = this.targets.length;
    if (this.inOrder) {
      const step = byDiff(d, { easy: ramp(L, 0.7, -0.02, 0.45), medium: ramp(L, 0.6, -0.02, 0.38), hard: ramp(L, 0.55, -0.02, 0.32) });
      this.targets.forEach((c, i) => this.after(i * step, () => {
        this.glow[c] = 1; this.bolt.bop = 1;
        this.tone(this.note(i + 2), step * 0.9, this.cellRect(c).x, 0.45);
        this.tween(this.glow as unknown as Record<string, number>, { [c]: 0 } as Record<string, number>, step * 0.8, ease.in, step * 0.35);
      }));
      this.after(k * step + 0.3, () => this.afterShow());
    } else {
      const dur = byDiff(d, { easy: ramp(L, 2.2, -0.05, 1.2) + k * 0.12, medium: ramp(L, 1.8, -0.05, 0.9) + k * 0.1, hard: ramp(L, 1.5, -0.05, 0.7) + k * 0.08 });
      for (const c of this.targets) this.glow[c] = 1;
      this.sfx("a:blip", { gain: 0.5 });
      [0, 2, 4].forEach((n, i) => this.tone(this.note(n + 5), 0.5, undefined, 0.3 - i * 0.05));
      this.bolt.bop = 1;
      this.after(dur, () => { for (const c of this.targets) this.glow[c] = 0; this.sfx("a:tickHi", { gain: 0.4 }); this.afterShow(); });
    }
  }

  private afterShow() {
    if (this.rotate) {
      this.phase = "rotate";
      this.hint("Follow the yellow dot! 🔄");
      this.sfx("a:teleport", { gain: 0.6 });
      this.after(0.35, () => {
        this.tween(this.spin, { v: 1 }, 0.9, ease.linear);
        this.after(0.95, () => {
          const n = this.n;
          this.targets = this.targets.map((i) => { const r = Math.floor(i / n), c = i % n; return c * n + (n - 1 - r); });
          this.spin.v = 0; this.toInput();
        });
      });
    } else this.toInput();
  }

  private toInput() {
    this.phase = "input";
    this.hint(this.inOrder ? `Tap them IN ORDER · ${this.targets.length} squares` : `Tap all ${this.targets.length} squares that glowed`);
  }

  protected onDown(x: number, y: number) {
    if (this.phase !== "input") return;
    const cells = this.n * this.n;
    for (let i = 0; i < cells; i++) {
      const r = this.cellRect(i);
      if (x >= r.x && x <= r.x + r.s && y >= r.y && y <= r.y + r.s) { this.tap(i); return; }
    }
  }

  private tap(i: number) {
    if (this.found.has(i)) return;
    const r = this.cellRect(i), cx = r.x + r.s / 2, cy = r.y + r.s / 2;
    const ok = this.inOrder ? this.targets[this.idx] === i : this.targets.includes(i);
    if (ok) {
      this.found.add(i); this.idx++;
      this.hit[i] = 1;
      this.tone(this.note(this.found.size + 1), 0.25, cx, 0.5);
      this.bolt.bop = 1;
      this.good(cx, cy, 30);
      this.burst(cx, cy, { n: 8, colors: ["#7CF2C9", "#FFFFFF"], kind: "ring", speed: 40, gravity: 0, size: r.s * 0.3, life: 0.5 });
      if (this.found.size >= this.targets.length) {
        this.phase = "done"; this.hint(null);
        this.after(0.3, () => {
          this.sfx("a:robodance", { gain: 0.5 });
          this.react("happy", this.rng.pick(["Pattern complete!", "Glow-tastic!", "Beep! Perfect memory!", "Lights matched!"]));
          this.levelClear({ perfect: this.mistakes === 0, bonus: (this.inOrder ? 50 : 0) + (this.rotate ? 80 : 0) });
        });
      }
    } else {
      this.mistakes++;
      this.miss[i] = 1;
      this.sfx("a:zap", { x: cx, gain: 0.6 });
      this.bad(cx, cy, { line: this.rng.pick(["Not that one!", "Bzzt!", "Wrong square!", "Error 404: glow not found!"]) });
      if (this.mistakes > this.allowed) {
        this.phase = "done";
        for (const t of this.targets) if (!this.found.has(t)) this.reveal[t] = 1;
        this.after(1.3, () => this.levelFail("Missed the pattern!"));
      }
    }
  }

  protected update(dt: number) {
    this.bolt.bop = Math.max(0, this.bolt.bop - dt * 4);
    for (let i = 0; i < this.miss.length; i++) {
      if (this.miss[i] > 0) this.miss[i] = Math.max(0, this.miss[i] - dt * 1.6);
      if (this.hit[i] > 0.4) this.hit[i] = Math.max(0.4, this.hit[i] - dt * 2);
    }
  }

  // ------------------------------------------------------------ drawing
  private drawSky(g: G) {
    const W = this.W, H = this.H;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1A0F3A"); gr.addColorStop(0.6, "#2B1458"); gr.addColorStop(1, "#120A26");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (const s of this.stars) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(this.t * 2 + s.p))})`; g.fillRect(s.x * W, s.y * H, 2, 2); }
    // synthwave floor
    const hy = H * 0.72;
    g.strokeStyle = "rgba(255,111,145,0.22)"; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { const y = hy + Math.pow(i / 8, 2) * (H - hy) + ((this.t * 12) % 12) * (i / 8); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30, hy); g.lineTo(W / 2 + i * 160, H); g.stroke(); }
  }

  private drawGrid(g: G) {
    const G0 = this.grid, n = this.n, cells = n * n;
    const cx = G0.x + G0.s / 2, cy = G0.y + G0.s / 2;
    g.save();
    if (this.spin.v > 0) { const a = ease.inOut(this.spin.v) * Math.PI / 2, k = 1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))); g.translate(cx, cy); g.rotate(a); g.scale(k, k); g.translate(-cx, -cy); }
    // frame
    g.save(); g.shadowColor = "#7CF2FF"; g.shadowBlur = 24;
    rr(g, G0.x - 6, G0.y - 6, G0.s + 12, G0.s + 12, 22); g.fillStyle = "#140B2E"; g.fill();
    g.restore();
    rr(g, G0.x - 6, G0.y - 6, G0.s + 12, G0.s + 12, 22); g.strokeStyle = "#7CF2FF"; g.lineWidth = 3; g.stroke();
    // corner marker so the rotation can be followed
    if (this.rotate) { g.fillStyle = "#FFD25A"; g.beginPath(); g.arc(G0.x + 4, G0.y + 4, 9, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < cells; i++) {
      const r = this.cellRect(i), rad = r.s * 0.18;
      const gl = this.glow[i] ?? 0, h = this.hit[i] ?? 0, m = this.miss[i] ?? 0, rv = this.reveal[i] ?? 0;
      rr(g, r.x, r.y, r.s, r.s, rad); g.fillStyle = "#24164A"; g.fill();
      g.strokeStyle = "rgba(124,242,255,0.28)"; g.lineWidth = 2; g.stroke();
      const lit = (c: string, a: number, blur: number) => {
        g.save(); g.shadowColor = c; g.shadowBlur = blur * a;
        rr(g, r.x + 2, r.y + 2, r.s - 4, r.s - 4, rad); g.fillStyle = rgba(c, 0.92 * a); g.fill();
        g.restore();
        rr(g, r.x + r.s * 0.14, r.y + r.s * 0.1, r.s * 0.72, r.s * 0.18, r.s * 0.09); g.fillStyle = `rgba(255,255,255,${0.35 * a})`; g.fill();
      };
      if (gl > 0.02) lit("#FFD25A", gl, 30);
      if (h > 0.02) lit("#7CF2C9", Math.min(1, h + 0.3), 18);
      if (m > 0.02) lit("#FF3B5C", m, 26);
      if (rv > 0.02) { rr(g, r.x + 3, r.y + 3, r.s - 6, r.s - 6, rad); g.strokeStyle = "#FFD25A"; g.lineWidth = 4; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]); }
      if (this.inOrder && h > 0.02 && this.phase !== "show") {
        const k = this.targets.indexOf(i) + 1;
        if (k > 0) clayText(g, String(k), r.x + r.s / 2, r.y + r.s / 2 + 2, Math.min(30, r.s * 0.42), { fill: "#FFFFFF", stroke: "#1E9C91", gloss: false });
      }
    }
    g.restore();
  }

  private drawTries(g: G) {
    if (this.hud.status !== "playing" || this.phase === "ready") return;
    const left = Math.max(0, this.allowed - this.mistakes) + 1;
    const total = this.allowed + 1, y = this.grid.y + this.grid.s + 24, x0 = this.W / 2 - ((total - 1) * 26) / 2;
    for (let i = 0; i < total; i++) {
      g.save(); g.translate(x0 + i * 26, y); g.scale(0.5, 0.5);
      g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-24, -2, -12, -22, 0, -8); g.bezierCurveTo(12, -22, 24, -2, 0, 14);
      g.fillStyle = i < left ? "#FF6F91" : "rgba(255,255,255,0.18)"; g.fill();
      g.restore();
    }
  }

  private drawBolt(g: G) {
    const b = this.bolt;
    this.sprite(g, this.host(this.hud.host.mood), b.x, b.y, b.h, { sy: 1 + b.bop * 0.06 + Math.sin(this.t * 2.4) * 0.012, sx: 1 - b.bop * 0.03, rot: Math.sin(this.t * 1.5) * 0.03 });
  }

  protected drawBackground(g: G) {
    if (!this.glow.length) {
      this.n = 4; const cells = 16;
      this.glow = new Array(cells).fill(0); this.hit = new Array(cells).fill(0); this.miss = new Array(cells).fill(0); this.reveal = new Array(cells).fill(0);
      this.layout();
    }
    const k = Math.floor(this.t * 2);
    for (let i = 0; i < this.glow.length; i++) this.glow[i] = (i * 7 + k) % 5 === 0 ? 0.85 : 0;
    this.drawSky(g); this.drawGrid(g); this.drawBolt(g);
  }

  protected draw(g: G) {
    this.drawSky(g);
    this.drawGrid(g);
    this.drawTries(g);
    this.drawBolt(g);
  }
}
