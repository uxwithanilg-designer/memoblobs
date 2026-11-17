// Spot the Sneak — a disco crowd of Gloops; one is a sneaky copy with one tiny difference.
import { ArcadeGame, Bag, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { blob, clayFill, darken, eye, hsl, lighten, mouth, rr, shadow, star, type G } from "../paint";

type Diff = "color" | "eyes" | "tooth" | "mouth" | "hat" | "tilt" | "look" | "spots" | "brows" | "cheeks";
interface Look {
  hue: number; sat: number; light: number; eyeL: number; eyeR: number; tooth: 0 | 1 | 2; mouth: "grin" | "smile" | "oh";
  hat: "none" | "party" | "bow" | "cap"; hatHue: number; tilt: number; look: [number, number]; spots: boolean; brows: boolean; cheeks: boolean;
}
interface Gl { x: number; y: number; s: number; look: Look; sneak: boolean; ph: number; wob: number; nope: number; dx: number; dy: number; jump: number }

export default class SpotTheSneak extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "spot-the-sneak", title: "Spot the Sneak", host: "gloop", style: "rounds",
    music: { calm: "a:sneak_calm", action: "a:sneak_action" },
    sounds: ["a:squelch", "a:splat", "a:giggle", "a:heartbeat", "a:wobble", "a:honk", "a:slideUp", "a:drip"],
    voicePitch: 0.8,
  };
  private crowd: Gl[] = [];
  private kinds = new Bag<Diff>(["color", "eyes", "tooth", "mouth", "hat", "tilt", "look", "spots", "brows", "cheeks"]);
  private kind: Diff = "color";
  private limit = 15; private left = 15; private found = false; private wrongs = 0;
  private hurry = false; private beat = 0;
  private drift = false; private blinky = false;
  private stage = { x: 0, y: 0, w: 0, h: 0 };

  protected onResize() { this.layoutCrowd(); }

  // ------------------------------------------------------------ level
  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = Math.min(byDiff(d, { easy: 30, medium: 42, hard: 56 }), byDiff(d, { easy: 6, medium: 9, hard: 12 }) + (L - 1) * byDiff(d, { easy: 2, medium: 3, hard: 3 }));
    this.limit = ramp(L, byDiff(d, { easy: 15, medium: 12, hard: 10 }), -0.3, byDiff(d, { easy: 9, medium: 7, hard: 6 }));
    this.left = this.limit; this.found = false; this.wrongs = 0; this.hurry = false; this.beat = 0;
    this.drift = L >= byDiff(d, { easy: 99, medium: 8, hard: 5 });
    this.blinky = L >= byDiff(d, { easy: 99, medium: 12, hard: 8 });
    // subtlety 1 (obvious) → 0 (very subtle)
    const sub = clamp(1 - (L - 1) / byDiff(d, { easy: 24, medium: 18, hard: 14 }), 0, 1);
    const base: Look = {
      hue: this.rng.pick([92, 100, 84, 110]), sat: 72, light: 58, eyeL: 1, eyeR: 1.12, tooth: 1, mouth: this.rng.pick(["grin", "smile"] as const),
      hat: L > 3 && this.rng.chance(0.5) ? this.rng.pick(["party", "bow", "cap"] as const) : "none", hatHue: this.rng.range(0, 360),
      tilt: 0, look: [this.rng.pick([-0.5, 0.5, 0]), this.rng.pick([0, -0.3])], spots: this.rng.chance(0.3), brows: false, cheeks: this.rng.chance(0.5),
    };
    let kind = this.kinds.next(this.rng);
    if (kind === "hat" && base.hat === "none" && this.rng.chance(0.5)) kind = "spots";
    this.kind = kind;
    const sn: Look = { ...base, look: [...base.look] as [number, number] };
    const amt = lerp(0.35, 1, sub);
    switch (kind) {
      case "color": sn.hue = base.hue + (this.rng.chance(0.5) ? 1 : -1) * lerp(9, 70, sub); break;
      case "eyes": sn.eyeR = base.eyeR * (1 + lerp(0.14, 0.45, sub)); sn.eyeL = base.eyeL * (1 - lerp(0.05, 0.15, sub)); break;
      case "tooth": sn.tooth = base.tooth === 1 ? (this.rng.chance(0.5) ? 0 : 2) : 1; break;
      case "mouth": sn.mouth = base.mouth === "grin" ? (sub > 0.5 ? "oh" : "smile") : base.mouth === "smile" ? "grin" : "smile"; break;
      case "hat": sn.hat = base.hat === "none" ? this.rng.pick(["party", "bow", "cap"] as const) : sub > 0.5 ? "none" : base.hat; if (sn.hat === base.hat) sn.hatHue = base.hatHue + lerp(40, 160, sub); break;
      case "tilt": sn.tilt = (this.rng.chance(0.5) ? 1 : -1) * lerp(0.14, 0.5, sub); break;
      case "look": sn.look = [-base.look[0] || 0.6, base.look[1] === 0 ? -0.4 : 0.3]; break;
      case "spots": sn.spots = !base.spots; break;
      case "brows": sn.brows = true; break;
      case "cheeks": sn.cheeks = !base.cheeks; if (!sn.cheeks && !base.cheeks) sn.cheeks = true; break;
    }
    void amt;
    const sneakIdx = this.rng.int(0, n - 1);
    this.crowd = Array.from({ length: n }, (_, i) => ({
      x: 0, y: 0, s: 30, look: i === sneakIdx ? sn : base, sneak: i === sneakIdx, ph: this.rng.range(0, 6), wob: 0, nope: 0,
      dx: this.rng.range(-1, 1), dy: this.rng.range(-1, 1), jump: 0,
    }));
    this.layoutCrowd();
    this.hint(this.rng.pick(["One Gloop is a sneaky copy! 🕵️", "Find the one that's different!", "Spot the sneak!"]));
    this.react("happy", this.rng.pick(["We all look the same!", "Hehe, find him!", "Party time!", "Wobble wobble!"]));
    this.sfx("a:wobble", { gain: 0.5 });
    this.music("calm");
    this.timerBar(1, "#9BE34A");
  }

  private layoutCrowd() {
    const A = this.area;
    this.stage = { x: 10, y: A.y + 4, w: this.W - 20, h: A.h - 8 };
    const n = this.crowd.length;
    if (!n) return;
    const st = this.stage, ratio = st.w / st.h;
    const cols = Math.max(2, Math.round(Math.sqrt(n * ratio)));
    const rows = Math.ceil(n / cols);
    const cw = st.w / cols, ch = st.h / rows;
    const s = clamp(Math.min(cw, ch) * 0.4, 16, 70);
    const order = this.crowd.map((_, i) => i);
    order.forEach((idx, k) => {
      const c = k % cols, r = Math.floor(k / cols);
      const off = r % 2 ? cw * 0.25 : -cw * 0.1;
      const gl = this.crowd[idx];
      gl.s = s;
      gl.x = clamp(st.x + (c + 0.5) * cw + off + Math.sin(idx * 7.1) * cw * 0.08, st.x + s * 1.3, st.x + st.w - s * 1.3);
      gl.y = st.y + (r + 0.62) * ch + Math.cos(idx * 3.3) * ch * 0.06;
    });
  }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    if (this.found) return;
    let hit: Gl | null = null, bd = Infinity;
    for (const gl of this.crowd) {
      const d = Math.hypot(gl.x - x, gl.y - gl.s * 0.7 - y);
      if (d < Math.max(gl.s * 1.25, 26) && d < bd) { hit = gl; bd = d; }
    }
    if (!hit) return;
    if (hit.sneak) {
      this.found = true; hit.jump = 0.0001;
      this.good(hit.x, hit.y - hit.s * 1.6, 100, this.left / this.limit);
      this.sfx("a:squelch", { x: hit.x, gain: 0.8 }); this.sfx("a:giggle", { delay: 0.25, gain: 0.6 });
      this.react("wow", this.rng.pick(["Gotcha!", "Busted!", "Sneaky caught!", "How did you see that?!"]));
      this.burst(hit.x, hit.y - hit.s, { n: 26, colors: ["#9BE34A", "#FFD25A", "#FFFFFF"], kind: "star", speed: 300 });
      this.timerBar(null);
      this.after(1.0, () => this.levelClear({ perfect: this.wrongs === 0 }));
    } else {
      this.wrongs++; hit.nope = 1;
      this.left = Math.max(0, this.left - this.limit * 0.15);
      this.sfx("a:splat", { x: hit.x, gain: 0.6 });
      this.bad(hit.x, hit.y - hit.s, { line: this.rng.pick(["Not me!", "I'm normal!", "Wrong Gloop!", "Hey, I'm innocent!"]) });
      this.float("-time", hit.x, hit.y - hit.s * 2.2, "#FF6F91", 22);
    }
  }

  // ------------------------------------------------------------ update / draw
  protected update(dt: number) {
    for (const gl of this.crowd) {
      gl.nope = Math.max(0, gl.nope - dt * 1.6);
      if (gl.jump > 0) gl.jump = Math.min(1, gl.jump + dt * 1.4);
      if (this.drift && !this.found) {
        gl.x += Math.sin(this.t * 0.6 + gl.ph) * gl.dx * 10 * dt;
        gl.y += Math.cos(this.t * 0.5 + gl.ph) * gl.dy * 6 * dt;
      }
    }
    if (this.found || this.ending) return;
    this.left -= dt;
    const frac = this.left / this.limit;
    this.timerBar(frac, frac < 0.3 ? "#FF6F91" : frac < 0.6 ? "#FFD25A" : "#9BE34A");
    if (frac < 0.4 && !this.hurry) { this.hurry = true; this.music("action"); this.react("happy", "Hurry, the slime is melting!", false); }
    if (frac < 0.3) { this.beat -= dt; if (this.beat <= 0) { this.beat = 0.8; this.sfx("a:heartbeat", { gain: 0.5, duck: false }); } }
    if (this.left <= 0) {
      this.found = true;
      const s = this.crowd.find((c) => c.sneak)!; s.jump = 0.0001;
      this.sfx("a:honk", { gain: 0.6 });
      this.timerBar(null);
      this.levelFail("Too slow — it was this one!");
    }
  }

  protected drawBackground(g: G) {
    this.drawDisco(g);
    const A = this.area;
    const demo: Look = { hue: 92, sat: 72, light: 58, eyeL: 1, eyeR: 1.12, tooth: 1, mouth: "grin", hat: "party", hatHue: 320, tilt: 0, look: [0, 0], spots: false, brows: false, cheeks: true };
    for (let i = 0; i < 5; i++) this.drawGloop(g, this.W * (0.12 + i * 0.19), A.y + A.h * 0.35 + (i % 2) * 40, 34, i === 3 ? { ...demo, eyeR: 1.6 } : demo, i * 1.3, 0, 0);
  }

  private drawDisco(g: G) {
    const W = this.W, H = this.H;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a0b3d"); bg.addColorStop(0.55, "#3a1466"); bg.addColorStop(1, "#14092e");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // rotating light beams
    g.save(); g.globalCompositeOperation = "lighter";
    const cols = ["#ff3fa4", "#3fd4ff", "#ffe14f", "#7dff6a"];
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(this.t * 0.6 + i * 1.7) * 0.8 + Math.PI / 2;
      const ox = W * (0.2 + i * 0.2);
      const gr = g.createLinearGradient(ox, 0, ox + Math.cos(a) * H, Math.sin(a) * H);
      gr.addColorStop(0, cols[i] + "55"); gr.addColorStop(1, cols[i] + "00");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox + Math.cos(a - 0.12) * H * 1.2, Math.sin(a - 0.12) * H * 1.2); g.lineTo(ox + Math.cos(a + 0.12) * H * 1.2, Math.sin(a + 0.12) * H * 1.2); g.closePath(); g.fill();
    }
    g.restore();
    // glowing floor tiles
    const fy = this.area.y + this.area.h * 0.12;
    const tile = Math.max(38, W / 9);
    for (let y = fy, r = 0; y < H; y += tile * 0.62, r++) {
      for (let x = (r % 2) * -tile * 0.5, c = 0; x < W; x += tile, c++) {
        const on = (Math.sin(this.t * 2 + r * 0.9 + c * 1.3) + 1) / 2;
        g.fillStyle = `hsla(${(r * 40 + c * 60 + this.t * 30) % 360},80%,${30 + on * 20}%,${0.18 + on * 0.18})`;
        rr(g, x + 3, y + 2, tile - 6, tile * 0.62 - 4, 8); g.fill();
      }
    }
    // disco ball
    const bx = W / 2, by = Math.max(18, this.area.y - 34);
    g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by - 18); g.stroke();
    blob(g, bx, by, 20, 20, "#C9D2E3", { gloss: 0.8 });
    g.save(); g.beginPath(); g.arc(bx, by, 20, 0, Math.PI * 2); g.clip();
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const v = (Math.sin(this.t * 4 + i * 2 + j * 3) + 1) / 2; g.fillStyle = `rgba(255,255,255,${v * 0.6})`; g.fillRect(bx + i * 6 - 2.5, by + j * 6 - 2.5, 5, 5); }
    g.restore();
  }

  protected draw(g: G) {
    this.drawDisco(g);
    const sorted = [...this.crowd].sort((a, b) => a.y - b.y);
    for (const gl of sorted) {
      const blink = this.blinky && Math.sin(this.t * 1.3 + gl.ph * 5) > 0.97 ? 1 : 0;
      this.drawGloop(g, gl.x, gl.y, gl.s, gl.look, gl.ph, gl.nope, gl.jump, blink, this.ending && gl.sneak);
    }
  }

  /** procedural 2D Gloop — same design as the 3D character */
  private drawGloop(g: G, x: number, y: number, s: number, L: Look, ph: number, nope: number, jump: number, blink = 0, ring = false) {
    const dance = Math.sin(this.t * 4 + ph);
    const sq = 1 + dance * 0.05;
    const jy = jump > 0 ? -Math.sin(Math.min(1, jump) * Math.PI) * s * 2.2 : 0;
    const col = hsl(((L.hue % 360) + 360) % 360, L.sat, L.light);
    shadow(g, x, y + 2, s * 1.25, s * 0.28, 0.35);
    if (ring) {
      g.strokeStyle = "#FFD25A"; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y - s * 0.7, s * 1.6 + Math.sin(this.t * 8) * 3, s * 1.4, 0, 0, Math.PI * 2); g.stroke();
    }
    g.save();
    g.translate(x + Math.sin(nope * 20) * nope * 6, y + jy);
    g.rotate(L.tilt + dance * 0.04);
    g.scale(1 / Math.sqrt(sq), sq);
    // drips + body
    for (const [dx, r] of [[-0.75, 0.22], [0.8, 0.18], [-0.2, 0.2], [0.4, 0.16]] as const) blob(g, dx * s, -s * 0.05, r * s, r * s * 1.2, col, { gloss: 0.3 });
    blob(g, 0, -s * 0.72, s * 1.18, s * 0.82, col, { gloss: 0.55, wobble: 0.035, t: this.t + ph });
    // arms (wave to the beat)
    g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = s * 0.22;
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 1.0, -s * 0.7); g.lineTo(sd * s * 1.45, -s * (0.95 + Math.max(0, dance * sd) * 0.45)); g.stroke(); }
    if (L.spots) for (const [sx, sy, r] of [[-0.6, -1.0, 0.12], [0.55, -0.45, 0.1], [-0.3, -0.35, 0.08]] as const) { g.fillStyle = lighten(col, 0.35); g.beginPath(); g.arc(sx * s, sy * s, r * s, 0, Math.PI * 2); g.fill(); }
    // bubbles inside
    g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(s * 0.62, -s * 1.05, s * 0.07, 0, Math.PI * 2); g.fill();
    const look = (nope > 0 ? [Math.sin(nope * 18), 0] : L.look) as [number, number];
    eye(g, -s * 0.36, -s * 1.02, s * 0.26 * L.eyeL, { look, pupil: 0.52, blink });
    eye(g, s * 0.36, -s * 1.05, s * 0.26 * L.eyeR, { look, pupil: 0.52, blink });
    if (L.brows) { g.strokeStyle = "#3d5a12"; g.lineWidth = s * 0.08; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.18, -s * 1.32); g.lineTo(sd * s * 0.55, -s * 1.42); g.stroke(); } }
    if (L.cheeks) { g.fillStyle = "rgba(255,111,145,0.55)"; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.68, -s * 0.72, s * 0.13, s * 0.08, 0, 0, Math.PI * 2); g.fill(); } }
    const mk = nope > 0.3 ? "oh" : L.mouth === "grin" ? "grin" : L.mouth;
    mouth(g, 0, -s * 0.55, s * 0.55, mk);
    if (L.tooth > 0 && mk !== "oh") {
      g.fillStyle = "#FFFDF4"; g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1;
      const tw = s * 0.16, th = s * 0.2;
      const xs = L.tooth === 2 ? [-tw * 0.75, tw * 0.75] : [-tw * 0.2];
      for (const tx of xs) { rr(g, tx - tw / 2, -s * 0.62, tw, th, s * 0.04); g.fill(); g.stroke(); }
    }
    // hats
    if (L.hat !== "none") {
      const hc = hsl(((L.hatHue % 360) + 360) % 360, 75, 60);
      if (L.hat === "party") {
        g.beginPath(); g.moveTo(-s * 0.32, -s * 1.42); g.lineTo(s * 0.32, -s * 1.42); g.lineTo(s * 0.05, -s * 2.15); g.closePath();
        clayFill(g, hc, 0, -s * 1.7, s * 0.5, { gloss: 0.3 });
        star(g, s * 0.05, -s * 2.18, s * 0.12, "#FFD25A");
      } else if (L.hat === "bow") {
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.2, -s * 1.5, s * 0.2, s * 0.13, sd * 0.4, 0, Math.PI * 2); clayFill(g, hc, sd * s * 0.2, -s * 1.5, s * 0.22); }
        blob(g, 0, -s * 1.5, s * 0.09, s * 0.09, darken(hc, 0.2));
      } else {
        g.beginPath(); g.ellipse(0, -s * 1.42, s * 0.5, s * 0.32, 0, Math.PI, 0); g.closePath(); clayFill(g, hc, 0, -s * 1.55, s * 0.5);
        g.beginPath(); g.ellipse(s * 0.38, -s * 1.42, s * 0.36, s * 0.09, 0, 0, Math.PI * 2); clayFill(g, darken(hc, 0.15), s * 0.38, -s * 1.42, s * 0.36);
      }
    }
    g.restore();
    if (jump > 0 && jump < 1) { g.globalAlpha = 1 - jump; g.restore?.(); }
    void ease;
  }
}
