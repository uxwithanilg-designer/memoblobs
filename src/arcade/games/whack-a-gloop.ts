// Whack-a-Gloop — Gloops pop out of the garden holes: BONK them! Never bonk Momo. Golden Gloops are
// worth a fortune. Endless run: quicker pops, more holes (6 → 12), helmet Gloops (2 bonks), zoomers,
// double pops and Momo sneaking around in a Gloop hat.
import { ArcadeGame, byDiff, clamp, ease, lerp, ramp, spriteUrl, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, eye, lighten, mouth, rgba, rr, shadow, star, type G } from "../paint";

type MKind = "gloop" | "gold" | "momo" | "momohat";
type MState = "rise" | "up" | "bonked" | "down";
type Twist = "helmet" | "double" | "zoom" | "momohat";
interface Mole { kind: MKind; helmet: boolean; zoom: boolean; age: number; stay: number; rise: number; up: number; state: MState; hit: boolean; sq: number; wob: number; ph: number; hatOff: number }
interface Hole { x: number; y: number; w: number; mole: Mole | null; pop: number; puff: number }
interface Mallet { x: number; y: number; t: number }
const GREEN = "#5CCB4A", GOLD = "#FFC93C";
const MOMO_HAPPY = spriteUrl("momo", "happy"), MOMO_SAD = spriteUrl("momo", "sad");
const TWIST_INFO: Record<Twist, [string, string, string]> = {
  helmet: ["HARD HATS!", "Helmet Gloops need TWO bonks", "Bonk helmets twice! ⛑️"],
  double: ["DOUBLE POP!", "Two Gloops at once!", "Two at a time! 👀👀"],
  zoom: ["ZOOMERS!", "Super-fast Gloops with goggles", "Zoomers are quick! ⚡"],
  momohat: ["SNEAKY MOMO!", "Momo is wearing a Gloop hat!", "Look for Momo's orange face! 🍊"],
};
const TWISTS: Twist[] = ["helmet", "double", "zoom", "momohat"];

export default class WhackAGloop extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "whack-a-gloop", title: "Whack-a-Gloop", host: "gloop", style: "run",
    music: { calm: "a:whack_calm", action: "a:whack_action" },
    sounds: ["a:bonk", "a:squeak", "a:clunk", "a:coin", "a:twinkle", "a:honk", "a:poof", "a:giggle", "a:cheer", "a:aww", "pop", "whooshShort", "thud", "v:momo_sad"],
    sprites: [MOMO_HAPPY, MOMO_SAD], voicePitch: 0.8, transition: "iris",
  };
  private holes: Hole[] = [];
  private wantHoles = 6;
  private mallets: Mallet[] = [];
  private helmets: { x: number; y: number; vx: number; vy: number; rot: number }[] = [];
  private spawnT = 1; private bonks = 0; private escapes = 0; private escFlash = 0;
  private lastHoles: number[] = [];
  private announced = new Set<Twist>();
  private momoHinted = false;
  private boss = { hop: 0 };
  private demo = false;
  // layout
  private band = 110; private field = { x: 0, y: 0, w: 0, h: 0 };
  private bg?: HTMLCanvasElement; private bgKey = "";

  protected onResize() { this.layout(); }

  private holeCount() {
    const L = this.level;
    return Math.min(12, 6 + Math.floor((L - 1) / byDiff(this.diff, { easy: 3, medium: 2.5, hard: 2 })));
  }

  private unlocked(t: Twist) {
    const at = byDiff(this.diff, { easy: { helmet: 3, double: 5, zoom: 7, momohat: 9 }, medium: { helmet: 3, double: 4, zoom: 5, momohat: 7 }, hard: { helmet: 2, double: 3, zoom: 4, momohat: 5 } })[t];
    return this.level >= at;
  }

  private params() {
    const L = this.level, d = this.diff;
    const forever = 1 + Math.max(0, L - 14) * 0.015;
    return {
      gap: Math.max(0.3, byDiff(d, { easy: ramp(L, 1.3, -0.06, 0.6), medium: ramp(L, 1.1, -0.055, 0.5), hard: ramp(L, 0.95, -0.05, 0.42) }) / forever),
      stay: Math.max(0.42, byDiff(d, { easy: ramp(L, 1.6, -0.07, 0.75), medium: ramp(L, 1.35, -0.06, 0.62), hard: ramp(L, 1.15, -0.05, 0.52) }) / forever),
      escapes: byDiff(d, { easy: 4, medium: 3, hard: 3 }),
    };
  }

  private layout() {
    const A = this.area, W = this.W, portrait = W < A.h * 1.05;
    this.band = clamp(A.h * (portrait ? 0.16 : 0.2), 84, 150);
    const fw = Math.min(W - 16, portrait ? 560 : 1000);
    this.field = { x: (W - fw) / 2, y: A.y + this.band, w: fw, h: A.h - this.band - 4 };
    const n = this.holes.length || this.wantHoles;
    // balanced rows (e.g. 7 → 2·3·2 on phones, 4·3 on desktop) so no hole sits alone
    const maxCols = portrait ? (n <= 6 ? 2 : 3) : (n <= 6 ? 3 : n === 9 ? 3 : 4);
    const rows = Math.ceil(n / maxCols), base = Math.floor(n / rows), extra = n % rows;
    // spare holes go to rows symmetrically (centre row first when the count is odd)
    const pick: number[] = [];
    if (extra % 2 === 1 && rows % 2 === 1) pick.push((rows - 1) / 2);
    for (let a = 0, b = rows - 1; a < b && pick.length + 2 <= extra; a++, b--) pick.push(a, b);
    for (let r = 0; pick.length < extra; r++) if (!pick.includes(r)) pick.push(r);
    const per = Array.from({ length: rows }, () => base);
    for (const r of pick) per[r]++;
    const cols = Math.max(...per);
    const cw = this.field.w / cols, ch = this.field.h / rows;
    const hw = Math.min(cw * 0.8, ch * 1.05, 190);
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < per[r]; c++, i++) {
      const h = this.holes[i];
      if (!h) continue;
      h.x = this.field.x + this.field.w / 2 + (c - (per[r] - 1) / 2) * cw;
      h.y = this.field.y + (r + 0.74) * ch;
      h.w = hw;
    }
  }

  private makeHoles(n: number, popIn: boolean) {
    this.holes = Array.from({ length: n }, () => ({ x: 0, y: 0, w: 100, mole: null, pop: popIn ? 0 : 1, puff: 0 }));
    this.layout();
    if (popIn) this.holes.forEach((h, i) => this.tween(h, { pop: 1 }, 0.45, ease.back, i * 0.04));
  }

  // ------------------------------------------------------------ run
  protected setupLevel() {
    this.demo = false;
    this.wantHoles = this.holeCount();
    this.makeHoles(this.wantHoles, true);
    this.mallets = []; this.spawnT = 1.1; this.bonks = 0; this.escapes = 0; this.lastHoles = [];
    this.announced = new Set(TWISTS.filter((t) => this.unlocked(t)));
    this.momoHinted = false;
    this.music(this.level >= 5 ? "action" : "calm");
    this.react("happy", this.rng.pick(["Bonk my cousins! Not Momo!", "Gloops in the garden!", "Whack 'em! It tickles!"]));
    this.hint("Tap the Gloops to BONK them! 🔨");
    const active = TWISTS.filter((t) => this.unlocked(t));
    if (active.length) this.after(1.6, () => { const t = active[active.length - 1]; this.banner(TWIST_INFO[t][0], TWIST_INFO[t][1], "pink"); });
  }

  private spawnOne(): boolean {
    const r = this.rng, L = this.level, P = this.params();
    const free = this.holes.map((h, i) => i).filter((i) => !this.holes[i].mole && this.holes[i].pop > 0.9 && !this.lastHoles.includes(i));
    if (!free.length) return false;
    const i = r.pick(free);
    this.lastHoles = [i, ...this.lastHoles].slice(0, Math.min(2, this.holes.length - 3));
    const pm = L >= byDiff(this.diff, { easy: 2, medium: 1, hard: 1 }) ? Math.min(0.2, 0.11 + L * 0.005) : 0;
    const ph = this.unlocked("momohat") ? 0.08 : 0;
    const roll = r.next();
    const kind: MKind = roll < pm ? "momo" : roll < pm + ph ? "momohat" : roll < pm + ph + 0.06 ? "gold" : "gloop";
    const zoom = kind === "gloop" && this.unlocked("zoom") && r.chance(0.17);
    const helmet = kind === "gloop" && !zoom && this.unlocked("helmet") && r.chance(0.2);
    const stay = P.stay * (zoom ? 0.55 : kind === "gold" ? 0.8 : helmet ? 1.35 : 1) * r.range(0.9, 1.15);
    this.holes[i].mole = { kind, helmet, zoom, age: 0, stay, rise: zoom ? 0.1 : 0.2, up: 0, state: "rise", hit: false, sq: 0, wob: 0, ph: r.range(0, 6), hatOff: 0 };
    const h = this.holes[i];
    this.sfx(zoom ? "whooshShort" : "pop", { x: h.x, gain: 0.3, rate: 0.85 + r.next() * 0.3 });
    if (kind === "gold") this.sfx("a:twinkle", { x: h.x, gain: 0.45 });
    if ((kind === "momo" || kind === "momohat") && !this.momoHinted) { this.momoHinted = true; this.hint("Don't bonk Momo! 🍊"); }
    return true;
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    // number keys / numpad map to holes (1 = first hole)
    const k = key === "0" ? 10 : Number(key);
    if (k >= 1 && k <= this.holes.length) { const h = this.holes[k - 1]; this.swing(h.x, h.y - h.w * 0.3); this.tryBonk(h); }
  }

  protected onDown(x: number, y: number) {
    this.swing(x, y);
    let best: Hole | null = null, bd = Infinity;
    for (const h of this.holes) {
      const m = h.mole;
      const top = h.y - h.w * 0.72, bottom = h.y + h.w * 0.2;
      if (x < h.x - h.w * 0.55 || x > h.x + h.w * 0.55 || y < top - (m ? 10 : 0) || y > bottom) continue;
      const d = Math.hypot(x - h.x, y - (h.y - h.w * 0.2)) - (m && m.state !== "down" ? 40 : 0);
      if (d < bd) { bd = d; best = h; }
    }
    if (best) this.tryBonk(best);
  }

  private swing(x: number, y: number) { this.mallets.push({ x, y, t: 0 }); if (this.mallets.length > 4) this.mallets.shift(); }

  private tryBonk(h: Hole) {
    const m = h.mole;
    if (!m || m.hit || m.up < 0.35) { h.puff = 1; this.sfx("thud", { x: h.x, gain: 0.3 }); return; }
    const s = h.w * 0.33, x = h.x, y = h.y - s * 1.6;
    if (m.kind === "momo" || m.kind === "momohat") {
      m.hit = true; m.state = "bonked"; m.age = 0; m.sq = 1; m.wob = 1;
      this.sfx("a:bonk", { x, gain: 0.7 }); this.sfx("a:honk", { x, gain: 0.5, delay: 0.1 }); this.sfx("v:momo_sad", { gain: 0.7, delay: 0.15, duck: false });
      this.float("OUCH!", x, y - 20, "#FF8A3D", 30);
      this.bad(x, y, { line: this.rng.pick(["Not Momo!", "Ouch! That's Momo!", "Momo's our friend!", m.kind === "momohat" ? "That was Momo in a hat!" : "Bonk Gloops, not Momo!"]) });
      return;
    }
    if (m.helmet) {
      m.helmet = false; m.wob = 1; m.stay += 0.45;
      this.sfx("a:clunk", { x, gain: 0.7 });
      this.float("CLUNK!", x, y - 20, "#BFE8FF", 24);
      this.burst(x, y - s * 0.6, { n: 8, colors: ["#9DB4D6", "#FFFFFF"], kind: "star", speed: 200, size: 5 });
      this.helmets.push({ x, y: y - s * 0.4, vx: this.rng.range(-160, 160), vy: -360, rot: 0 });
      return;
    }
    m.hit = true; m.state = "bonked"; m.age = 0; m.sq = 1;
    this.escapes = 0;
    this.sfx("a:bonk", { x, gain: 0.75, rate: 0.95 + Math.min(this.combo, 10) * 0.025 });
    this.sfx("a:squeak", { x, gain: 0.4, delay: 0.06, rate: 1 + Math.random() * 0.3 });
    const quick = clamp(1 - m.age / m.stay, 0, 1) * 0.5;
    if (m.kind === "gold") {
      this.good(x, y, 50, quick);
      this.sfx("a:coin", { x, gain: 0.7 }); this.sfx("a:cheer", { gain: 0.4, delay: 0.1 });
      this.float("GOLDEN!", x, y - 50, GOLD, 30);
      this.burst(x, y, { n: 30, colors: [GOLD, "#FFF4B0", "#FFFFFF"], kind: "star", speed: 340 });
      this.boss.hop = 1;
    } else {
      this.good(x, y, m.zoom ? 15 : 10, quick);
      this.burst(x, y - s * 0.4, { n: 8, colors: ["#FFD25A", "#FFFFFF"], kind: "star", speed: 180, size: 5 });
    }
    this.bonks++;
    if (this.bonks % 12 === 0) this.after(0.3, () => this.nextLevel(), false);
  }

  private nextLevel() {
    if (this.hud.status !== "playing" || this.lives <= 0) return;
    this.levelUp();
    if (this.level === 5) this.music("action");
    this.wantHoles = this.holeCount();
    const fresh = TWISTS.find((t) => this.unlocked(t) && !this.announced.has(t));
    const moreHoles = this.wantHoles > this.holes.length;
    if (fresh || moreHoles) this.after(1.6, () => {
      if (fresh) { this.announced.add(fresh); this.banner(TWIST_INFO[fresh][0], TWIST_INFO[fresh][1], "pink"); this.hint(TWIST_INFO[fresh][2]); }
      else this.banner("MORE HOLES!", `${this.wantHoles} holes to watch`, "mint");
    }, false);
  }

  private escape(h: Hole) {
    this.escapes++;
    this.escFlash = 1;
    const lim = this.params().escapes;
    this.sfx("a:giggle", { x: h.x, gain: 0.3, rate: 1.3 });
    if (this.escapes >= lim) {
      this.escapes = 0;
      this.sfx("a:aww", { gain: 0.5 });
      this.bad(h.x, h.y - h.w * 0.3, { line: this.rng.pick(["Too many got away!", "They're escaping!", "Hehe, missed us!"]) });
    }
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    const playing = this.hud.status === "playing" && this.lives > 0;
    const P = this.params();
    this.boss.hop = Math.max(0, this.boss.hop - dt * 2.5);
    this.escFlash = Math.max(0, this.escFlash - dt * 2);
    for (const m of this.mallets) m.t += dt;
    this.mallets = this.mallets.filter((m) => m.t < 0.45);
    for (const hm of this.helmets) { hm.vy += 900 * dt; hm.x += hm.vx * dt; hm.y += hm.vy * dt; hm.rot += dt * 9; }
    this.helmets = this.helmets.filter((hm) => hm.y < this.H + 60);
    // grow the garden once it's empty
    if (this.holes.length !== this.wantHoles && this.holes.every((h) => !h.mole)) { this.makeHoles(this.wantHoles, true); this.sfx("a:poof", { gain: 0.5 }); }
    if (playing && !this.inTransition && this.holes.length === this.wantHoles) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const ok = this.spawnOne();
        if (ok && this.unlocked("double") && this.rng.chance(clamp(0.22 + (this.level - 3) * 0.02, 0.22, 0.45))) this.spawnOne();
        this.spawnT = ok ? P.gap * this.rng.range(0.8, 1.2) : 0.2;
      }
    }
    for (const h of this.holes) {
      h.puff = Math.max(0, h.puff - dt * 3);
      const m = h.mole;
      if (!m) continue;
      m.age += dt; m.sq = Math.max(0, m.sq - dt * 0.6); m.wob = Math.max(0, m.wob - dt * 2.5);
      if (m.kind === "momohat" && m.hit) m.hatOff = Math.min(1, m.hatOff + dt * 2.5);
      if (m.state === "rise") { m.up = Math.min(1, m.up + dt / m.rise); if (m.up >= 1) { m.state = "up"; m.age = 0; } }
      else if (m.state === "up") { if (m.age >= m.stay) m.state = "down"; }
      else if (m.state === "bonked") { if (m.age >= 0.55) m.state = "down"; }
      else if (m.state === "down") {
        m.up = Math.max(0, m.up - dt / (m.hit ? 0.25 : m.rise));
        if (m.up <= 0) {
          h.mole = null;
          if (!m.hit && (m.kind === "gloop" || m.kind === "gold") && playing) this.escape(h);
        }
      }
    }
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H, A = this.area, fy = A.y + this.band;
    const sky = g.createLinearGradient(0, 0, 0, fy);
    sky.addColorStop(0, "#8FD3FF"); sky.addColorStop(1, "#E3F6FF");
    g.fillStyle = sky; g.fillRect(0, 0, W, fy);
    for (let i = 0; i < 5; i++) blob(g, ((i * 233) % W) + 20, A.y * 0.5 + (i % 2) * 30 + 10, 50 + (i % 3) * 14, 18, "#FFFFFF", { gloss: 0.6 });
    // distant bushes
    for (let x = -20, i = 0; x < W + 40; x += 70, i++) blob(g, x, fy - this.band * 0.32, 52, 34 + (i % 3) * 8, i % 2 ? "#6CC456" : "#5DB84A", { gloss: 0.3 });
    // picket fence
    const ft = fy - this.band * 0.62, fb = fy + 6;
    g.fillStyle = "#E9C08A"; g.fillRect(0, ft + (fb - ft) * 0.3, W, 9); g.fillRect(0, ft + (fb - ft) * 0.72, W, 9);
    for (let x = 6; x < W; x += 30) {
      g.beginPath(); g.moveTo(x, fb); g.lineTo(x, ft + 8); g.lineTo(x + 10, ft); g.lineTo(x + 20, ft + 8); g.lineTo(x + 20, fb); g.closePath();
      clayFill(g, "#F7DCAE", x + 10, (ft + fb) / 2, (fb - ft) * 0.6, { gloss: 0.2 });
    }
    // lawn
    const gr = g.createLinearGradient(0, fy, 0, H);
    gr.addColorStop(0, "#9BE068"); gr.addColorStop(1, "#5FB14A");
    g.fillStyle = gr; g.fillRect(0, fy, W, H - fy);
    for (let y = fy + 6, i = 0; y < H; y += 46, i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,60,0,0.05)"; g.fillRect(0, y, W, 46); }
    for (let i = 0; i < 46; i++) {
      const x = (i * 157.3) % W, y = fy + 14 + ((i * 89.7) % Math.max(20, H - fy - 20));
      if (i % 3 === 0) { for (let p = 0; p < 5; p++) blob(g, x + Math.cos(p * 1.26) * 5, y + Math.sin(p * 1.26) * 5, 4, 4, ["#FF8FB1", "#FFFFFF", "#FFE066"][i % 3], { gloss: 0.3 }); blob(g, x, y, 3, 3, "#FFC93C"); }
      else { g.strokeStyle = "rgba(40,110,30,0.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 8); g.moveTo(x + 4, y); g.lineTo(x + 5, y - 9); g.stroke(); }
    }
    this.bg = c;
  }

  private drawHoleBack(g: G, h: Hole) {
    const w = h.w * h.pop, hh = w * 0.3;
    shadow(g, h.x, h.y + hh * 0.5, w * 0.62, hh * 0.6, 0.3);
    g.beginPath(); g.ellipse(h.x, h.y, w * 0.56, hh * 0.95, 0, 0, Math.PI * 2);
    clayFill(g, "#B07A45", h.x, h.y, w * 0.56, { gloss: 0.25 });
    g.beginPath(); g.ellipse(h.x, h.y - hh * 0.08, w * 0.42, hh * 0.55, 0, 0, Math.PI * 2);
    const hg = g.createRadialGradient(h.x, h.y, 2, h.x, h.y, w * 0.42); hg.addColorStop(0, "#1E0F08"); hg.addColorStop(1, "#4A2A16");
    g.fillStyle = hg; g.fill();
  }

  private drawHoleFront(g: G, h: Hole) {
    const w = h.w * h.pop, hh = w * 0.3;
    g.beginPath(); g.ellipse(h.x, h.y, w * 0.56, hh * 0.95, 0, 0, Math.PI); g.ellipse(h.x, h.y - hh * 0.08, w * 0.42, hh * 0.55, 0, Math.PI, 0, true); g.closePath();
    clayFill(g, "#C08A52", h.x, h.y + hh * 0.4, w * 0.5, { gloss: 0.3 });
    for (const dx of [-0.38, 0.1, 0.42]) blob(g, h.x + dx * w, h.y + hh * 0.62, w * 0.05, w * 0.03, "#8F5E33", { gloss: 0.2 });
    if (h.puff > 0) { g.fillStyle = rgba("#C08A52", h.puff * 0.6); for (const sd of [-1, 1]) { g.beginPath(); g.arc(h.x + sd * w * (0.3 + (1 - h.puff) * 0.2), h.y - hh * (1 - h.puff) * 1.2, w * 0.07 * h.puff, 0, Math.PI * 2); g.fill(); } }
  }

  private drawMole(g: G, h: Hole) {
    const m = h.mole;
    if (!m) return;
    const s = h.w * 0.33, hh = h.w * 0.3;
    const sq = m.sq;
    const by = h.y + s * 2.5 - ease.out(m.up) * s * 2.78; // base of the body
    g.save();
    // clip to "above the hole + the hole opening" so it seems to come out of the ground
    g.beginPath(); g.rect(h.x - h.w, h.y - h.w * 2.2, h.w * 2, h.w * 2.2 - hh * 0.08);
    g.ellipse(h.x, h.y - hh * 0.08, h.w * 0.42, hh * 0.55, 0, 0, Math.PI * 2); g.clip();
    const x = h.x + Math.sin(m.wob * 28) * m.wob * 6;
    if (m.kind === "momo" || m.kind === "momohat") {
      const hgt = s * 2.25 * (1 - sq * 0.35), url = m.hit ? MOMO_SAD : MOMO_HAPPY;
      this.sprite(g, url, x, by + s * 0.25, hgt, { sx: 1 + sq * 0.3, rot: Math.sin(this.t * 3 + m.ph) * 0.05 });
      if (m.kind === "momohat" && m.hatOff < 1) this.drawHat(g, x + m.hatOff * s * 2, by + s * 0.25 - hgt * 0.78 - m.hatOff * s * 2.5, s, m.hatOff * 5);
    } else {
      const col = m.kind === "gold" ? GOLD : m.zoom ? "#38C9A8" : GREEN;
      this.drawGloop(g, x, by, s, col, m);
    }
    g.restore();
    if (m.state === "bonked" && m.kind !== "momo" && m.kind !== "momohat") {
      for (let i = 0; i < 3; i++) { const a = this.t * 6 + (i * Math.PI * 2) / 3; star(g, x + Math.cos(a) * s * 0.75, by - s * 1.0 * (1 - sq * 0.5) - s * 0.25 + Math.sin(a) * s * 0.18, s * 0.17, "#FFE066", a); }
    }
  }

  private drawHat(g: G, x: number, y: number, s: number, rot: number) {
    g.save(); g.translate(x, y); g.rotate(rot);
    for (const dx of [-0.6, -0.15, 0.35, 0.7]) blob(g, dx * s, s * 0.28, s * 0.13, s * 0.2, GREEN, { gloss: 0.3 });
    blob(g, 0, 0, s * 0.9, s * 0.42, GREEN, { gloss: 0.55, wobble: 0.05, t: this.t });
    eye(g, -s * 0.28, -s * 0.1, s * 0.17, {}); eye(g, s * 0.28, -s * 0.12, s * 0.19, {});
    g.restore();
  }

  private drawGloop(g: G, x: number, by: number, s: number, col: string, m: Mole) {
    const sq = m.sq, st = 1 - sq * 0.55;
    g.save(); g.translate(x, by); g.scale(1 + sq * 0.45, st);
    if (m.zoom && (m.state === "rise" || m.state === "down")) { g.globalAlpha = 0.35; blob(g, 0, -s * 0.2, s * 1.0, s * 0.8, col); g.globalAlpha = 1; }
    blob(g, 0, -s * 0.72, s * 1.12, s * 0.9, col, { gloss: 0.55, wobble: 0.04, t: this.t + m.ph });
    if (m.kind === "gold") { g.fillStyle = "rgba(255,255,255,0.6)"; for (let i = 0; i < 3; i++) { const a = this.t * 3 + i * 2; star(g, Math.cos(a) * s * 0.8, -s * 0.8 + Math.sin(a) * s * 0.5, s * 0.1, "#FFFFFF", a); } }
    g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = s * 0.22;
    const wave = Math.sin(this.t * 9 + m.ph);
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.95, -s * 0.75); g.lineTo(sd * s * 1.35, -s * (1.0 + Math.max(0, wave * sd) * 0.3)); g.stroke(); }
    const knocked = m.state === "bonked";
    if (knocked) {
      g.strokeStyle = "#2A1A30"; g.lineWidth = s * 0.08;
      for (const sd of [-1, 1]) { const ex = sd * s * 0.36, ey = -s * 1.02; g.beginPath(); g.moveTo(ex - s * 0.14, ey - s * 0.14); g.lineTo(ex + s * 0.14, ey + s * 0.14); g.moveTo(ex + s * 0.14, ey - s * 0.14); g.lineTo(ex - s * 0.14, ey + s * 0.14); g.stroke(); }
      mouth(g, 0, -s * 0.55, s * 0.5, "oh");
    } else {
      const look: [number, number] = [Math.sin(this.t * 1.7 + m.ph) * 0.6, -0.2];
      eye(g, -s * 0.36, -s * 1.02, s * 0.25, { look, pupil: 0.5 });
      eye(g, s * 0.36, -s * 1.05, s * 0.28, { look, pupil: 0.5 });
      mouth(g, 0, -s * 0.55, s * 0.55, "grin");
      g.fillStyle = "#FFFDF4"; rr(g, -s * 0.12, -s * 0.62, s * 0.17, s * 0.2, s * 0.04); g.fill();
    }
    g.fillStyle = "rgba(255,111,145,0.5)"; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.7, -s * 0.72, s * 0.13, s * 0.08, 0, 0, Math.PI * 2); g.fill(); }
    if (m.zoom && !knocked) {
      g.fillStyle = "#3A3550"; g.fillRect(-s * 0.95, -s * 1.1, s * 1.9, s * 0.1);
      for (const sd of [-1, 1]) { blob(g, sd * s * 0.36, -s * 1.04, s * 0.3, s * 0.27, "#7CC8FF", { gloss: 0.7 }); g.strokeStyle = "#3A3550"; g.lineWidth = s * 0.07; g.beginPath(); g.arc(sd * s * 0.36, -s * 1.04, s * 0.3, 0, Math.PI * 2); g.stroke(); }
    }
    if (m.kind === "gold" && !knocked) {
      g.beginPath(); g.moveTo(-s * 0.4, -s * 1.5); g.lineTo(-s * 0.45, -s * 1.95); g.lineTo(-s * 0.2, -s * 1.75); g.lineTo(0, -s * 2.05); g.lineTo(s * 0.2, -s * 1.75); g.lineTo(s * 0.45, -s * 1.95); g.lineTo(s * 0.4, -s * 1.5); g.closePath();
      clayFill(g, "#FFE066", 0, -s * 1.75, s * 0.5, { gloss: 0.6 });
    }
    if (m.helmet) {
      g.beginPath(); g.ellipse(0, -s * 1.38, s * 0.85, s * 0.62, 0, Math.PI, 0); g.closePath();
      clayFill(g, "#FF8A3D", 0, -s * 1.6, s * 0.8, { gloss: 0.5 });
      rr(g, -s * 1.0, -s * 1.42, s * 2.0, s * 0.14, s * 0.07); g.fillStyle = darken("#FF8A3D", 0.25); g.fill();
      g.fillStyle = "#FFFFFF"; rr(g, -s * 0.08, -s * 1.95, s * 0.16, s * 0.52, s * 0.06); g.fill();
    }
    g.restore();
  }

  private drawMallet(g: G, m: Mallet) {
    const u = m.t;
    const ang = u < 0.09 ? lerp(1.1, -0.1, ease.in(u / 0.09)) : -0.1;
    const a = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.15;
    const s = clamp(this.W * 0.075, 32, 48);
    g.save(); g.globalAlpha = clamp(a, 0, 1);
    g.translate(m.x + s * 1.89, m.y - s * 0.19); g.rotate(ang);
    rr(g, -s * 1.7, -s * 0.12, s * 1.7, s * 0.24, s * 0.12); clayFill(g, "#D9A066", -s * 0.8, 0, s, { gloss: 0.3 });
    rr(g, -s * 2.3, -s * 0.55, s * 0.75, s * 1.1, s * 0.3); clayFill(g, "#FF6F91", -s * 1.9, 0, s * 0.7, { gloss: 0.5 });
    g.fillStyle = "rgba(255,255,255,0.5)"; rr(g, -s * 2.2, -s * 0.5, s * 0.16, s * 1.0, s * 0.08); g.fill();
    g.restore();
    if (u > 0.08 && u < 0.2) { g.strokeStyle = `rgba(255,255,255,${1 - (u - 0.08) / 0.12})`; g.lineWidth = 3; g.beginPath(); g.arc(m.x, m.y, s * (0.5 + (u - 0.08) * 6), 0, Math.PI * 2); g.stroke(); }
  }

  private drawFenceTop(g: G) {
    const A = this.area, fy = A.y + this.band, W = this.W;
    const hh = clamp(this.band * 0.62, 50, 96);
    const hx = this.field.x + hh * 0.95, hop = Math.sin(this.boss.hop * Math.PI) * 12;
    const mood = this.hud.status === "lobby" ? "happy" : this.hud.host.mood;
    this.sprite(g, this.host(mood), hx, fy - this.band * 0.06 - hop, hh, { sy: 1 + Math.sin(this.t * 3) * 0.02, rot: Math.sin(this.t * 2) * 0.03 });
    // "got away" sign on the fence
    if (this.hud.status !== "playing" && this.hud.status !== "over") return;
    const lim = this.params().escapes, sw = Math.min(170, W * 0.42), sh = 46;
    const sx = this.field.x + this.field.w - sw - 6, sy = fy - this.band * 0.5 - 8;
    clayPanel(g, sx, sy, sw, sh, 12, this.escFlash > 0 ? lighten("#B5773F", this.escFlash * 0.3) : "#B5773F", { lip: 5 });
    clayText(g, "GOT AWAY", sx + sw / 2, sy + 12, 12, { fill: "#FFF1D2", stroke: "#5A2E1C", gloss: false });
    const sp = Math.min(26, (sw - 20) / lim), x0 = sx + sw / 2 - ((lim - 1) * sp) / 2;
    for (let i = 0; i < lim; i++) {
      const on = i < this.escapes;
      blob(g, x0 + i * sp, sy + 29, 8, 7, on ? "#FF6F91" : "#6B4A2A", { gloss: on ? 0.5 : 0.1 });
      if (on) { g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(x0 + i * sp - 2, sy + 27, 1.6, 0, Math.PI * 2); g.arc(x0 + i * sp + 2, sy + 27, 1.6, 0, Math.PI * 2); g.fill(); }
    }
  }

  private scene(g: G) {
    const key = `${this.W}x${this.H}x${this.dpr}x${Math.round(this.area.y + this.band)}`;
    if (!this.bg || this.bgKey !== key) { this.paintStatic(); this.bgKey = key; }
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawFenceTop(g);
    const order = [...this.holes].sort((a, b) => a.y - b.y);
    for (const h of order) { this.drawHoleBack(g, h); this.drawMole(g, h); this.drawHoleFront(g, h); }
    for (const hm of this.helmets) {
      g.save(); g.translate(hm.x, hm.y); g.rotate(hm.rot);
      const s = (this.holes[0]?.w ?? 100) * 0.33;
      g.beginPath(); g.ellipse(0, 0, s * 0.85, s * 0.62, 0, Math.PI, 0); g.closePath(); clayFill(g, "#FF8A3D", 0, -s * 0.3, s * 0.8, { gloss: 0.5 });
      g.restore();
    }
    if (this.W > 700 && this.hud.status === "playing") this.holes.forEach((h, i) => { if (i < 10) clayText(g, String((i + 1) % 10), h.x + h.w * 0.5, h.y + h.w * 0.2, 14, { fill: "#FFFFFF", stroke: "#3A5A20", gloss: false }); });
    for (const m of this.mallets) this.drawMallet(g, m);
  }

  protected drawBackground(g: G) {
    if (!this.demo) {
      this.demo = true;
      this.wantHoles = 6; this.makeHoles(6, false);
      this.holes[1].mole = { kind: "gloop", helmet: false, zoom: false, age: 0, stay: 99, rise: 0.2, up: 1, state: "up", hit: false, sq: 0, wob: 0, ph: 1, hatOff: 0 };
      this.holes[2].mole = { kind: "momo", helmet: false, zoom: false, age: 0, stay: 99, rise: 0.2, up: 0.8, state: "up", hit: false, sq: 0, wob: 0, ph: 2, hatOff: 0 };
      this.holes[3].mole = { kind: "gold", helmet: false, zoom: false, age: 0, stay: 99, rise: 0.2, up: 1, state: "up", hit: false, sq: 0, wob: 0, ph: 3, hatOff: 0 };
    }
    this.layout();
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}
