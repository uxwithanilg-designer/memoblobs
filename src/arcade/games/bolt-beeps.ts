// Bolt's Beep Boop — watch & listen to Bolt's beeps, then repeat them (Simon-style).
// Unlimited levels: longer + faster sequences, more buttons, BACKWARDS rounds and GLITCH button shuffles.
import { ArcadeGame, Recent, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { clayPanel, clayText, lighten, rgba, rr, shadow, star, type G } from "../paint";

const PADS = [
  { color: "#E8504F", shape: "circle" }, { color: "#3B82F6", shape: "square" }, { color: "#FFC93C", shape: "triangle" },
  { color: "#2FA866", shape: "star" }, { color: "#9B5DE5", shape: "heart" }, { color: "#FF8A3D", shape: "diamond" },
] as const;
interface Pad { color: string; shape: string; note: number; slot: number; x: number; y: number; lit: number; press: number; fx: number; fy: number; mv: number }
type Phase = "watch" | "input" | "done";

export default class BoltBeeps extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "bolt-beeps", title: "Bolt's Beep Boop", host: "bolt", style: "rounds",
    music: { calm: "a:beeps_calm", action: "a:beeps_action" },
    sounds: ["a:sparks", "a:robodance", "a:blip", "a:zap", "a:scramble", "a:tickHi"],
    voicePitch: 0.9, transition: "iris",
  };
  private pads: Pad[] = [];
  private slots: { x: number; y: number }[] = [];
  private size = 100;
  private seq: number[] = [];
  private want: number[] = [];
  private idx = 0;
  private phase: Phase = "watch";
  private backwards = false; private glitch = false;
  private mistakes = 0; private replays = 0;
  private noteDur = 0.5;
  private recent = new Recent(16);
  private bolt = { x: 0, y: 0, h: 140, bop: 0, dance: 0, err: 0 };
  private led = { x: 0, y: 0, w: 300, h: 44 };
  private gears = [{ x: 0.12, y: 0.2, r: 46, s: 0.4 }, { x: 0.9, y: 0.32, r: 34, s: -0.6 }, { x: 0.08, y: 0.72, r: 30, s: 0.8 }, { x: 0.93, y: 0.8, r: 52, s: -0.3 }];

  protected onResize() { this.layout(); }

  private padCount() {
    const L = this.level;
    return byDiff(this.diff, { easy: L < 8 ? 4 : 5, medium: L < 5 ? 4 : L < 9 ? 5 : 6, hard: L < 4 ? 5 : 6 });
  }

  private layout() {
    const A = this.area, n = this.pads.length || 4, portrait = this.W < this.H * 1.05;
    let px: number, py: number, pw: number, ph: number;
    if (portrait) {
      const bh = clamp(A.h * 0.22, 90, 170);
      this.bolt = { ...this.bolt, x: this.W / 2, y: A.y + bh + 6, h: bh };
      this.led = { w: Math.min(this.W - 40, 340), h: 42, x: (this.W - Math.min(this.W - 40, 340)) / 2, y: A.y + bh + 12 };
      px = 16; py = this.led.y + this.led.h + 14; pw = this.W - 32; ph = A.y + A.h - py - 8;
    } else {
      const bh = clamp(A.h * 0.5, 100, 260);
      this.bolt = { ...this.bolt, x: this.W * 0.24, y: A.y + A.h * 0.72, h: bh };
      this.led = { w: Math.min(this.W * 0.36, 320), h: 44, x: this.W * 0.24 - Math.min(this.W * 0.36, 320) / 2, y: A.y + A.h * 0.72 + 14 };
      px = this.W * 0.46; py = A.y + 10; pw = this.W * 0.52; ph = A.h - 20;
    }
    const gap = 14;
    const fit = (c: number) => { const r = Math.ceil(n / c); return Math.min(180, (pw - gap * (c - 1)) / c, (ph - gap * (r - 1)) / r); };
    const cols = n <= 4 ? 2 : fit(2) >= fit(3) ? 2 : 3, rows = Math.ceil(n / cols);
    this.size = fit(cols);
    const gw = cols * this.size + (cols - 1) * gap, gh = rows * this.size + (rows - 1) * gap;
    const ox = px + (pw - gw) / 2, oy = py + (ph - gh) / 2;
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
      const rowOff = ((cols - inRow) * (this.size + gap)) / 2;
      this.slots.push({ x: ox + rowOff + (i % cols) * (this.size + gap), y: oy + r * (this.size + gap) });
    }
    for (const p of this.pads) if (!p.mv) { p.x = this.slots[p.slot].x; p.y = this.slots[p.slot].y; }
  }

  protected setupLevel() {
    const L = this.level, d = this.diff, n = this.padCount();
    this.pads = PADS.slice(0, n).map((p, i) => ({ color: p.color, shape: p.shape, note: i + 2, slot: i, x: 0, y: 0, lit: 0, press: 0, fx: 0, fy: 0, mv: 0 }));
    this.layout();
    const len = byDiff(d, { easy: 3 + Math.floor((L - 1) / 2), medium: 4 + Math.floor(((L - 1) * 2) / 3), hard: 5 + Math.floor((L - 1) * 0.8) });
    // fresh sequence, never the same pad 3 times in a row, never a recent sequence
    let seq: number[] = [];
    for (let tries = 0; tries < 20; tries++) {
      seq = [];
      while (seq.length < len) {
        const k = this.rng.int(0, n - 1);
        if (seq.length >= 2 && seq[seq.length - 1] === k && seq[seq.length - 2] === k) continue;
        if (seq.length >= 1 && seq[seq.length - 1] === k && this.rng.chance(0.6)) continue;
        seq.push(k);
      }
      if (!this.recent.has(seq.join(""))) break;
    }
    this.recent.add(seq.join(""));
    this.seq = seq;
    this.noteDur = byDiff(d, { easy: ramp(L, 0.65, -0.025, 0.4), medium: ramp(L, 0.55, -0.022, 0.33), hard: ramp(L, 0.45, -0.02, 0.26) });
    this.backwards = byDiff(d, { easy: L >= 7 && L % 7 === 0, medium: L % 5 === 0, hard: L % 5 === 0 || (L > 10 && L % 3 === 0) });
    this.glitch = byDiff(d, { easy: false, medium: L >= 10 && L % 2 === 0, hard: L >= 6 && L % 2 === 1 });
    this.want = this.backwards ? [...seq].reverse() : [...seq];
    this.idx = 0; this.mistakes = 0; this.replays = 0; this.bolt.err = 0; this.bolt.dance = 0; this.phase = "watch";
    this.music(len >= 8 ? "action" : "calm");
    if (this.backwards) this.after(0.5, () => { this.banner("BACKWARDS!", "Repeat it in reverse order", "pink"); this.react("wow", "Reverse mode! Beep-oob!"); });
    else this.react("happy", this.rng.pick(["Beep boop! Copy me!", "Watch my lights!", "Listen to my beeps!", "Ready? Beep!"]));
    this.after(this.backwards ? 2.2 : 1.3, () => this.playSeq());
  }

  private playSeq() {
    this.phase = "watch"; this.idx = 0;
    this.hint(`Watch & listen 👀👂 · ${this.seq.length} beeps`);
    const step = this.noteDur, gap = step * 0.4;
    this.seq.forEach((k, i) => this.after(i * (step + gap), () => this.light(k, step)));
    const end = this.seq.length * (step + gap) + 0.15;
    this.after(end, () => {
      if (this.glitch) this.glitchShuffle(() => this.toInput());
      else this.toInput();
    });
  }

  private toInput() {
    this.phase = "input";
    this.hint(this.backwards ? "Your turn — BACKWARDS! ⏪" : "Your turn! Tap the same order 🤖");
    this.sfx("a:blip", { gain: 0.4 });
  }

  private light(k: number, dur: number) {
    const p = this.pads[k];
    p.lit = 1; this.bolt.bop = 1;
    this.tone(this.note(p.note), Math.max(0.2, dur), p.x + this.size / 2, 0.6);
    this.tween(p, { lit: 0 }, dur * 0.9, ease.in, dur * 0.25);
  }

  private glitchShuffle(done: () => void) {
    this.banner("GLITCH!", "Bolt's buttons moved!", "red");
    this.sfx("a:zap", { gain: 0.6 }); this.sfx("a:scramble", { gain: 0.5, delay: 0.2 });
    this.bolt.err = 1;
    const perm = this.rng.shuffle(this.pads.map((_, i) => i));
    if (perm.every((v, i) => v === i)) perm.push(perm.shift()!);
    this.pads.forEach((p, i) => { p.fx = p.x; p.fy = p.y; p.slot = perm[i]; p.mv = 0.0001; });
    this.after(0.5, () => { for (const p of this.pads) this.tween(p, { mv: 1 }, 0.8, ease.inOut); });
    this.after(1.4, () => { for (const p of this.pads) { p.mv = 0; p.x = this.slots[p.slot].x; p.y = this.slots[p.slot].y; } this.bolt.err = 0; done(); });
  }

  onKey(key: string) {
    const k = Number(key) - 1;
    if (k >= 0 && k < this.pads.length) this.press(k);
  }

  protected onDown(x: number, y: number) {
    const k = this.pads.findIndex((p) => x >= p.x && x <= p.x + this.size && y >= p.y && y <= p.y + this.size);
    if (k >= 0) this.press(k);
  }

  private press(k: number) {
    if (this.phase !== "input") return;
    const p = this.pads[k], cx = p.x + this.size / 2, cy = p.y + this.size / 2;
    p.press = 1; this.tween(p, { press: 0 }, 0.25);
    if (k === this.want[this.idx]) {
      p.lit = 1; this.tween(p, { lit: 0 }, 0.35, ease.in, 0.05);
      this.tone(this.note(p.note), 0.3, cx, 0.6);
      this.bolt.bop = 1;
      this.idx++;
      this.good(cx, cy, 30);
      if (this.idx >= this.want.length) {
        this.phase = "done"; this.hint(null);
        this.after(0.35, () => {
          this.sfx("a:robodance", { gain: 0.7 }); this.bolt.dance = 1;
          this.react("happy", this.rng.pick(["ROBOT DANCE!", "Beep beep hooray!", "Memory: 100%!", "You copied me!"]));
          this.burst(this.bolt.x, this.bolt.y - this.bolt.h * 0.7, { n: 22, colors: ["#7CF2FF", "#FFD25A", "#FF6F91"], kind: "star", speed: 300 });
          this.levelClear({ perfect: this.mistakes === 0, bonus: this.backwards ? 60 : 0 });
        });
      }
    } else {
      this.phase = "done"; this.mistakes++;
      this.tone(110, 0.4, cx, 0.5);
      this.sfx("a:sparks", { x: cx, gain: 0.7 });
      this.bolt.err = 1;
      this.burst(cx, cy, { n: 16, colors: ["#FFD25A", "#FFFFFF", "#7CF2FF"], kind: "star", speed: 320, size: 5 });
      this.bad(cx, cy, { line: this.rng.pick(["ERROR! Beep!", "Does not compute!", "Bzzt! Wrong!", "Oops, my circuits!"]) });
      const right = this.pads[this.want[this.idx]];
      this.after(0.5, () => { right.lit = 1; this.tween(right, { lit: 0 }, 0.7, ease.in, 0.3); });
      if (this.diff === "easy" && this.replays === 0) {
        this.replays++;
        this.after(1.6, () => { this.bolt.err = 0; this.banner("WATCH AGAIN!", "One more look", "gold"); this.after(0.9, () => this.playSeq()); });
      } else this.after(1.1, () => { this.bolt.err = 0; this.levelFail("Wrong beep!"); });
    }
  }

  protected update(dt: number) {
    this.bolt.bop = Math.max(0, this.bolt.bop - dt * 4);
    this.bolt.dance = Math.max(0, this.bolt.dance - dt * 0.6);
    for (const p of this.pads) if (p.mv > 0) {
      const t = this.slots[p.slot], u = p.mv, a = Math.sin(Math.PI * u);
      p.x = lerp(p.fx, t.x, u) + a * (t.y - p.fy) * 0.25; p.y = lerp(p.fy, t.y, u) - a * (t.x - p.fx) * 0.25;
    }
  }

  // ------------------------------------------------------------ drawing
  private drawGear(g: G, x: number, y: number, r: number, rot: number, color: string) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath();
    const teeth = Math.max(8, Math.round(r / 5));
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2, rr2 = i % 2 ? r * 0.82 : r;
      g.lineTo(Math.cos(a - 0.12) * rr2, Math.sin(a - 0.12) * rr2); g.lineTo(Math.cos(a + 0.12) * rr2, Math.sin(a + 0.12) * rr2);
    }
    g.closePath(); g.fillStyle = color; g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.arc(-r * 0.15, -r * 0.15, r * 0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0F2229"; g.beginPath(); g.arc(0, 0, r * 0.28, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  private drawWorkshop(g: G) {
    const W = this.W, H = this.H;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#1F4752"); gr.addColorStop(1, "#0E2128");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(127,211,203,0.10)";
    for (let y = 18; y < H; y += 28) for (let x = 14 + ((y / 28) % 2) * 14; x < W; x += 28) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
    for (const gg of this.gears) this.drawGear(g, gg.x * W, gg.y * H, gg.r, this.t * gg.s, "#2E6670");
    // blinking lights strip
    for (let i = 0; i < 9; i++) {
      const on = Math.sin(this.t * 3 + i * 1.3) > 0.3;
      g.fillStyle = on ? ["#FF6F91", "#7CF2FF", "#FFD25A"][i % 3] : "rgba(255,255,255,0.12)";
      g.beginPath(); g.arc(W * (0.1 + i * 0.1), this.insetTop - 4, 3.5, 0, Math.PI * 2); g.fill();
    }
  }

  private drawShape(g: G, shape: string, x: number, y: number, s: number, color: string) {
    g.save(); g.translate(x, y); g.fillStyle = color;
    switch (shape) {
      case "circle": g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill(); break;
      case "square": rr(g, -s * 0.9, -s * 0.9, s * 1.8, s * 1.8, s * 0.3); g.fill(); break;
      case "triangle": g.beginPath(); g.moveTo(0, -s * 1.05); g.lineTo(s * 1.05, s * 0.8); g.lineTo(-s * 1.05, s * 0.8); g.closePath(); g.fill(); break;
      case "star": star(g, 0, 0, s * 1.15, color); break;
      case "heart": g.beginPath(); g.moveTo(0, s * 0.9); g.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.7, -s * 1.2, 0, -s * 0.45); g.bezierCurveTo(s * 0.7, -s * 1.2, s * 1.4, -s * 0.1, 0, s * 0.9); g.fill(); break;
      case "diamond": g.beginPath(); g.moveTo(0, -s * 1.1); g.lineTo(s * 0.85, 0); g.lineTo(0, s * 1.1); g.lineTo(-s * 0.85, 0); g.closePath(); g.fill(); break;
    }
    g.restore();
  }

  private drawPad(g: G, p: Pad, k: number) {
    const s = this.size, lit = p.lit, pr = p.press;
    g.save();
    const sc = 1 + lit * 0.08 - pr * 0.05;
    g.translate(p.x + s / 2, p.y + s / 2); g.scale(sc, sc); g.translate(-s / 2, -s / 2);
    shadow(g, s / 2, s + 4, s * 0.42, 10, 0.35);
    if (lit > 0.05) { g.save(); g.shadowColor = p.color; g.shadowBlur = 40 * lit; rr(g, 4, 4, s - 8, s - 8, s * 0.22); g.fillStyle = rgba(p.color, 0.6 * lit); g.fill(); g.restore(); }
    clayPanel(g, 0, 0, s, s - 6, s * 0.22, lit > 0.05 ? lighten(p.color, 0.6 * lit) : p.color, { lip: 8, pressed: pr });
    if (lit > 0.05) { rr(g, 3, 3, s - 6, s - 12, s * 0.2); g.strokeStyle = `rgba(255,255,255,${0.9 * lit})`; g.lineWidth = 5; g.stroke(); }
    this.drawShape(g, p.shape, s / 2, s * 0.44 + pr * 4, s * 0.17, `rgba(255,255,255,${0.55 + lit * 0.45})`);
    if (this.W > 700) clayText(g, String(k + 1), s * 0.14, s * 0.18, Math.max(14, s * 0.12), { fill: "#FFFFFF", gloss: false });
    g.restore();
  }

  private drawLed(g: G) {
    const L = this.led;
    rr(g, L.x, L.y, L.w, L.h, 14); g.fillStyle = "#0B1430"; g.fill();
    g.strokeStyle = "#3F7F86"; g.lineWidth = 4; g.stroke();
    if (this.hud.status !== "playing") return;
    const n = this.want.length;
    if (this.bolt.err > 0.05) { clayText(g, "ERROR!", L.x + L.w / 2, L.y + L.h / 2 + 2, 22, { fill: "#FF6F91", stroke: "#0B1430", gloss: false }); return; }
    if (this.phase === "watch") {
      const blink = Math.sin(this.t * 6) > -0.2;
      clayText(g, blink ? "WATCH • LISTEN" : "", L.x + L.w / 2, L.y + L.h / 2 + 2, 19, { fill: "#7CF2FF", stroke: "#0B1430", gloss: false });
      return;
    }
    // progress dots
    const r = clamp((L.w - 30) / (n * 2.6), 3, 8), sp = r * 2.6, x0 = L.x + L.w / 2 - ((n - 1) * sp) / 2;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < this.idx ? "#7CF2C9" : "rgba(124,242,255,0.22)";
      g.beginPath(); g.arc(x0 + i * sp, L.y + L.h / 2, r, 0, Math.PI * 2); g.fill();
    }
  }

  private drawBolt(g: G) {
    const b = this.bolt, mood = b.err > 0.05 ? "sad" : this.hud.host.mood;
    shadow(g, b.x, b.y, b.h * 0.3, 8, 0.35);
    const dance = b.dance > 0 ? Math.sin(this.t * 18) * 0.18 * b.dance : 0;
    const jit = b.err > 0.05 ? (Math.random() - 0.5) * 6 : 0;
    this.sprite(g, this.host(mood), b.x + jit, b.y - Math.abs(Math.sin(this.t * 9)) * b.dance * 14, b.h, { rot: dance, sy: 1 + b.bop * 0.06 + Math.sin(this.t * 2.5) * 0.012, sx: 1 - b.bop * 0.03 });
  }

  protected drawBackground(g: G) {
    if (!this.pads.length) { this.pads = PADS.slice(0, 4).map((p, i) => ({ color: p.color, shape: p.shape, note: i + 2, slot: i, x: 0, y: 0, lit: 0, press: 0, fx: 0, fy: 0, mv: 0 })); this.layout(); }
    const k = Math.floor(this.t * 1.5) % this.pads.length;
    this.pads.forEach((p, i) => (p.lit = i === k ? 0.7 : 0));
    this.drawWorkshop(g); this.drawBolt(g); this.drawLed(g);
    this.pads.forEach((p, i) => this.drawPad(g, p, i));
  }

  protected draw(g: G) {
    this.drawWorkshop(g);
    this.drawBolt(g);
    this.drawLed(g);
    this.pads.forEach((p, i) => this.drawPad(g, p, i));
  }
}
