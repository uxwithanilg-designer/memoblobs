// Quick Draw — a Wild-West reaction game. Sheriff Hoot holds up a sign: WAIT… WAIT… then a big green
// NOW! — tap as fast as you can. Tap too soon and it's a false start. Unlimited levels: stricter
// average-speed goals and more (and quicker) fake-outs: NOT NOW, SNOW, WOW!, wrong-colour NOWs,
// Hoot sneezing and Kranky waving a flag.
import { ArcadeGame, Bag, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, rgba, rr, shadow, star, sunburst, type G } from "../paint";

type Fake = "notnow" | "nowq" | "sneeze" | "snow" | "nowish" | "colour" | "kranky" | "wow" | "know" | "meow";
const FAKE_ORDER: Fake[] = ["notnow", "nowq", "sneeze", "snow", "nowish", "colour", "kranky", "wow", "know", "meow"];
const FAKE_NAME: Record<Fake, string> = {
  notnow: "NOT NOW signs", nowq: "NOW? signs", sneeze: "Hoot's sneezes", snow: "SNOW", nowish: "NOW-ish", colour: "Wrong-colour NOWs",
  kranky: "Kranky's flag", wow: "WOW! signs", know: "KNOW signs", meow: "MEOW!",
};
const FAKE_LINE: Record<Fake, string> = {
  notnow: "It said NOT now!", nowq: "That was a question!", sneeze: "I only sneezed!", snow: "That was SNOW!", nowish: "NOW-ish isn't NOW!",
  colour: "Only the GREEN NOW counts!", kranky: "Kranky tricked you!", wow: "WOW is not NOW!", know: "K-NOW? Nope!", meow: "Meow?! Not now!",
};
const NOW_BG = "#2FBF5B";
const KRANKY = "/brand/kranky.webp", KRANKY_LAUGH = "/brand/kranky-laugh.webp";
interface Ev { type: Fake; at: number; dur: number; bg: string; on: boolean; off: boolean }
interface Sign { text: string; sub: string; bg: string; fg: string; pop: number; wob: number }
type Phase = "intro" | "ready" | "wait" | "now" | "result" | "foul" | "done";

export default class QuickHoot extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "quick-hoot", title: "Quick Draw", host: "hoot", style: "rounds",
    music: { calm: "a:quick_calm", action: "a:quick_action" },
    sounds: ["a:gong", "a:whistle", "a:heartbeat", "a:snore", "a:slideDown", "a:buzz", "a:kazoo", "a:ooh", "a:twinkle", "a:poof", "a:cheer", "a:bell", "a:blip", "a:squeak", "a:creak", "snicker", "v:kranky_laugh"],
    sprites: [KRANKY, KRANKY_LAUGH], voicePitch: 1.0, transition: "blink",
  };
  private phase: Phase = "intro";
  private sign: Sign = { text: "QUICK DRAW", sub: "", bg: "#FFF1D2", fg: "#23305A", pop: 0, wob: 0 };
  private evs: Ev[] = [];
  private waitT = 0; private nowAt = 3; private nowT = 0; private nowReal = 0; private beatT = 0;
  private times: number[] = []; private total = 5; private fouls = 0; private allowed = 1;
  private target = 900; private slowCap = 2; private fakeDur = 1; private maxFakes = 0;
  private unlocked: Fake[] = [];
  private bag = new Bag<Fake>(FAKE_ORDER);
  private seen = new Set<Fake>();
  private hoot = { sneeze: 0, hop: 0 };
  private kr = { show: 0, laugh: 0 };
  private snowOn = 0;
  private weed = { x: -100, on: false, next: 4, speed: 120 };
  private burstT = 0;
  // layout
  private sb = { x: 0, y: 0, w: 300, h: 150 };
  private groundY = 600; private horizon = 400; private poleX = 0;
  private hb = { x: 0, y: 0, h: 150 };
  private tray = { x: 0, y: 0, w: 300, h: 50 };
  private bg?: HTMLCanvasElement; private bgKey = "";

  protected onResize() { this.layout(); }

  private layout() {
    const A = this.area, W = this.W, portrait = W < A.h * 1.05;
    if (portrait) {
      const sw = Math.min(W - 32, 440), sh = sw * 0.52;
      this.sb = { x: (W - sw) / 2, y: A.y + clamp(A.h * 0.06, 12, 50), w: sw, h: sh };
      this.groundY = A.y + A.h * 0.8;
      this.horizon = A.y + A.h * 0.5;
      this.hb = { x: W / 2 + 0, y: this.groundY + 6, h: clamp(A.h * 0.27, 110, 230) };
      const tw = Math.min(W - 24, 440);
      this.tray = { x: (W - tw) / 2, y: A.y + A.h - 66, w: tw, h: 62 };
    } else {
      const sw = Math.min(A.w * 0.42, 520, A.h * 0.8), sh = sw * 0.5;
      this.sb = { x: W * 0.44 - sw / 2, y: A.y + clamp(A.h * 0.05, 10, 40), w: sw, h: sh };
      this.groundY = A.y + A.h * 0.84;
      this.horizon = A.y + A.h * 0.55;
      this.hb = { x: 0, y: this.groundY + 6, h: clamp(A.h * 0.42, 140, 300) };
      const tw = Math.min(W * 0.5, 520);
      this.tray = { x: W * 0.44 - tw / 2, y: A.y + A.h - 64, w: tw, h: 60 };
    }
    this.poleX = this.sb.x + this.sb.w * 0.5;
    this.hb.h = Math.max(90, Math.min(this.hb.h, this.hb.y - (this.sb.y + this.sb.h) - 16));
    this.hb.x = this.poleX + this.hb.h * 0.36;
    if (portrait) this.tray.y = Math.max(this.tray.y, this.groundY + 14);
  }

  // ------------------------------------------------------------ levels
  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.layout();
    this.target = Math.round(byDiff(d, { easy: ramp(L, 900, -30, 450), medium: ramp(L, 750, -25, 380), hard: ramp(L, 600, -20, 320) }));
    this.allowed = byDiff(d, { easy: 2, medium: 1, hard: 1 });
    this.slowCap = Math.max(1.3, (this.target / 1000) * 2.3);
    const fStart = byDiff(d, { easy: 3, medium: 2, hard: 1 });
    this.unlocked = L >= fStart ? FAKE_ORDER.slice(0, clamp(1 + Math.floor((L - fStart) / byDiff(d, { easy: 1.5, medium: 1.25, hard: 1 })), 1, FAKE_ORDER.length)) : [];
    this.bag = new Bag<Fake>(this.unlocked.length ? this.unlocked : FAKE_ORDER);
    this.maxFakes = this.unlocked.length ? Math.min(4, 1 + Math.floor((L - fStart) / 3)) : 0;
    this.fakeDur = ramp(L, byDiff(d, { easy: 1.2, medium: 1.05, hard: 0.95 }), -0.04, 0.45);
    this.times = []; this.fouls = 0; this.evs = []; this.phase = "intro";
    this.kr = { show: 0, laugh: 0 }; this.hoot.sneeze = 0; this.snowOn = 0;
    this.setSign("QUICK DRAW", "", "#FFF1D2", "#23305A");
    this.music(this.maxFakes >= 2 ? "action" : "calm");
    this.sfx("a:whistle", { gain: 0.5, delay: 0.2 });
    let delay = 1.7;
    const fresh = this.unlocked.find((f) => !this.seen.has(f));
    if (fresh) {
      this.unlocked.forEach((f) => this.seen.add(f));
      this.after(1.0, () => this.banner(this.seen.size === 1 ? "FAKE-OUTS!" : "NEW TRICK!", `Watch out for ${FAKE_NAME[fresh]}`, "pink"));
      delay = 3.0;
    }
    this.react("happy", this.rng.pick(["Howdy, partner!", "Fastest finger in the West?", "Wait for my GREEN NOW!", "Hoo-dy! Ready to draw?"]));
    this.hint(`Tap when the sign says a GREEN NOW! · goal ${this.target} ms`);
    this.after(delay, () => this.startDraw());
  }

  private setSign(text: string, sub: string, bg: string, fg: string) {
    this.sign.text = text; this.sign.sub = sub; this.sign.bg = bg; this.sign.fg = fg;
    this.sign.pop = 1;
  }

  private startDraw() {
    const r = this.rng;
    this.phase = "ready"; this.waitT = 0; this.beatT = 0.3;
    this.setSign("READY?", "", "#FFF1D2", "#23305A");
    this.sfx("a:creak", { gain: 0.4 });
    // schedule the fake-outs, then the real NOW
    const k = this.maxFakes ? r.int(this.maxFakes >= 2 ? 1 : 0, this.maxFakes) : 0;
    const evs: Ev[] = [];
    let t = r.range(0.8, 1.5);
    let last: Fake | null = null;
    for (let i = 0; i < k; i++) {
      let type = this.bag.next(r);
      if (type === last) type = this.bag.next(r);
      last = type;
      const dur = this.fakeDur * r.range(0.85, 1.2) * (type === "kranky" || type === "sneeze" ? 1.3 : 1);
      evs.push({ type, at: t, dur, bg: r.pick(["#E8504F", "#3B82F6", "#9B5DE5", "#FF8A3D"]), on: false, off: false });
      t += dur + r.range(0.45, 1.1);
    }
    const lo = byDiff(this.diff, { easy: 1.4, medium: 1.2, hard: 1.0 }), hi = byDiff(this.diff, { easy: 3.2, medium: 3.8, hard: 4.4 });
    this.nowAt = k ? t + r.range(0.5, hi * 0.6) : r.range(lo, hi);
    this.evs = evs;
    this.hint(k ? "Wait for the GREEN NOW! Don't fall for tricks 🤠" : "Wait for it… 🤠");
    this.after(0.9, () => {
      if (this.phase !== "ready") return;
      this.phase = "wait"; this.waitT = 0;
      this.setSign("WAIT", "", "#FFF1D2", "#23305A");
    });
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    if (key === " " || key.length === 1 && "pmfPMF".includes(key) || key === "Escape" || key === "Tab") return;
    this.fire(this.W / 2, this.sb.y + this.sb.h / 2);
  }

  protected onDown(x: number, y: number) { this.fire(x, y); }

  private fire(x: number, y: number) {
    if (this.phase === "wait") this.foul(x, y);
    else if (this.phase === "now") this.hit(x, y);
  }

  private hit(x: number, y: number) {
    const real = performance.now() - this.nowReal, game = (this.t - this.nowT) * 1000;
    const ms = Math.max(1, Math.round(Math.abs(real - game) > 250 ? game : real));
    this.phase = "result";
    this.times.push(ms);
    const rate = this.rating(ms);
    this.setSign(`${ms} ms`, rate, ms <= this.target ? "#2FBF5B" : "#FF8A3D", "#FFFFFF");
    this.float("POW!", x, y - 10, "#FFD25A", 34);
    this.burst(x, y, { n: 14, colors: ["#FFD25A", "#FF8A3D", "#FFFFFF"], kind: "star", speed: 280 });
    const speed = clamp(1 - (ms - 180) / (this.target * 1.4), 0, 1);
    this.good(this.hb.x, this.hb.y - this.hb.h * 1.05, 100, speed);
    this.hoot.hop = 1;
    if (ms < 300) { this.sfx("a:cheer", { gain: 0.5 }); this.burstT = 1; }
    if (ms <= this.target) this.react("happy", this.rng.pick([rate, "Yee-haw!", "Fastest in the West!", "Hoo-ray, partner!"]), ms < 400);
    else this.react("sad", this.rng.pick(["Hoo… a bit sleepy?", "Faster, partner!", "My grandma owl is quicker!"]), false);
    this.after(1.5, () => this.nextDraw());
  }

  private foul(x: number, y: number) {
    const ev = this.evs.find((e) => e.on && !e.off);
    this.phase = "foul";
    this.fouls++;
    this.setSign("TOO SOON!", ev ? FAKE_LINE[ev.type] : "Wait for the GREEN NOW!", "#E8504F", "#FFFFFF");
    this.sign.wob = 1;
    this.endFakes();
    this.sfx("a:slideDown", { gain: 0.6 });
    if (ev?.type === "kranky") { this.kr.laugh = 1; this.sfx("v:kranky_laugh", { gain: 0.6, delay: 0.2, duck: false }); }
    this.bad(x, y, { line: ev ? FAKE_LINE[ev.type] : this.rng.pick(["Whoa there, partner!", "Hold your horses!", "Not yet! Wait for it!", "Too quick on the draw!"]) });
    if (this.fouls > this.allowed) { this.phase = "done"; this.after(1.3, () => this.levelFail(this.allowed ? "Too many false starts!" : "False start! Wait for the GREEN NOW")); }
    else this.after(1.8, () => { this.banner("REDRAW!", this.allowed - this.fouls === 0 ? "No more false starts!" : "Wait for the GREEN NOW", "gold"); this.after(0.6, () => this.startDraw()); });
  }

  private tooSlow() {
    const ms = Math.round(this.slowCap * 1000);
    this.phase = "result";
    this.times.push(ms);
    this.setSign("ZZZ…", "Too slow!", "#8C7BB0", "#FFFFFF");
    this.sfx("a:snore", { gain: 0.6 });
    this.bad(this.W / 2, this.sb.y + this.sb.h / 2, { line: this.rng.pick(["Wake up, partner!", "Snoozing in the sun?", "The NOW was green!"]) });
    this.after(1.6, () => this.nextDraw());
  }

  private nextDraw() {
    if (this.times.length < this.total) { this.startDraw(); return; }
    this.phase = "done"; this.hint(null);
    const avg = Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length);
    this.setSign(`${avg} ms`, "average", avg <= this.target ? NOW_BG : "#E8504F", "#FFFFFF");
    if (avg <= this.target) {
      const perfect = this.fouls === 0 && avg <= this.target * 0.85;
      this.after(0.4, () => {
        this.react("happy", this.rng.pick(["Quickest draw in town!", "Yee-haw! Sheriff material!", "You're lightning, partner!"]));
        this.levelClear({ perfect, bonus: Math.max(0, Math.round((this.target - avg) / 4)), title: perfect ? "QUICKEST DRAW!" : undefined });
      });
    } else this.after(0.5, () => this.levelFail(`Average ${avg} ms — goal ${this.target} ms`));
  }

  private rating(ms: number) {
    if (ms < 230) return "LIGHTNING! ⚡";
    if (ms < 300) return "Super fast!";
    if (ms < 380) return "Speedy!";
    if (ms < 480) return "Quick!";
    if (ms < 620) return "Not bad!";
    if (ms < 820) return "Sleepy owl…";
    return "Snail mode 🐌";
  }

  // ------------------------------------------------------------ fakes
  private startFake(e: Ev) {
    e.on = true;
    switch (e.type) {
      case "notnow": this.setSign("NOT NOW", "", "#E8504F", "#FFFFFF"); this.sfx("a:buzz", { gain: 0.4 }); break;
      case "nowq": this.setSign("NOW?", "", "#B8B0C8", "#23305A"); this.sfx("a:blip", { gain: 0.5 }); break;
      case "snow": this.setSign("SNOW", "", "#BFE8FF", "#FFFFFF"); this.snowOn = 1; this.sfx("a:twinkle", { gain: 0.5 }); break;
      case "nowish": this.setSign("NOW-ish", "", "#FFD25A", "#23305A"); this.sfx("a:kazoo", { gain: 0.45 }); break;
      case "colour": this.setSign("NOW!", "", e.bg, "#FFFFFF"); this.sfx(this.level >= 10 ? "a:bell" : "a:blip", { gain: 0.45 }); break;
      case "wow": this.setSign("WOW!", "", NOW_BG, "#FFFFFF"); this.sfx("a:ooh", { gain: 0.5 }); break;
      case "know": this.setSign("KNOW", "", NOW_BG, "#FFFFFF"); this.sfx("a:bell", { gain: 0.4 }); break;
      case "meow": this.setSign("MEOW!", "", "#FF8FB1", "#FFFFFF"); this.sfx("a:squeak", { gain: 0.5 }); break;
      case "sneeze":
        this.hoot.sneeze = 1; this.sign.wob = 1;
        this.sfx("v:hoot_wow", { gain: 0.6, duck: false }); this.sfx("a:poof", { gain: 0.5, delay: 0.15 });
        this.burst(this.hb.x, this.hb.y - this.hb.h * 0.7, { n: 12, colors: ["#A0703F", "#D9A066", "#FFF1D2"], kind: "drop", speed: 220, gravity: 160, life: 1.4 });
        break;
      case "kranky":
        this.kr.laugh = 0; this.tween(this.kr, { show: 1 }, 0.3, ease.back); this.sfx("snicker", { gain: 0.55 }); break;
    }
  }

  private endFake(e: Ev) {
    e.off = true;
    if (e.type === "kranky") this.tween(this.kr, { show: 0 }, 0.25, ease.in);
    else if (e.type !== "sneeze" && this.phase === "wait") this.setSign("WAIT", "", "#FFF1D2", "#23305A");
    if (e.type === "snow") this.snowOn = 0;
  }

  private endFakes() {
    for (const e of this.evs) if (e.on && !e.off) { e.off = true; if (e.type === "kranky") this.tween(this.kr, { show: 0 }, 0.4, ease.in, 0.6); }
    this.snowOn = 0;
  }

  private goNow() {
    this.phase = "now"; this.nowT = this.t; this.nowReal = performance.now();
    this.endFakes();
    this.setSign("NOW!", "", NOW_BG, "#FFFFFF");
    this.sfx("a:gong", { gain: 0.8 });
    this.flash("#B8FFC9", 0.22);
    this.burstT = 1;
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    this.sign.pop = Math.max(0, this.sign.pop - dt * 4);
    this.sign.wob = Math.max(0, this.sign.wob - dt * 1.6);
    this.hoot.sneeze = Math.max(0, this.hoot.sneeze - dt * 1.4);
    this.hoot.hop = Math.max(0, this.hoot.hop - dt * 2.5);
    this.kr.laugh = Math.max(0, this.kr.laugh - dt * 0.5);
    this.burstT = Math.max(0, this.burstT - dt * 0.8);
    // tumbleweed
    this.weed.next -= dt;
    if (!this.weed.on && this.weed.next <= 0) { this.weed = { x: -60, on: true, next: 0, speed: this.rng.range(110, 190) }; }
    if (this.weed.on) { this.weed.x += this.weed.speed * dt; if (this.weed.x > this.W + 60) { this.weed.on = false; this.weed.next = this.rng.range(6, 12); } }
    if (this.snowOn && Math.random() < dt * 30) this.particles.push({ x: Math.random() * this.W, y: this.area.y - 10, vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 50, life: 3, max: 3, size: 3 + Math.random() * 4, color: "#FFFFFF", kind: "dot", rot: 0, vr: 0, g: 10 });
    if (this.phase === "wait") {
      this.waitT += dt;
      for (const e of this.evs) {
        if (!e.on && this.waitT >= e.at) this.startFake(e);
        if (e.on && !e.off && this.waitT >= e.at + e.dur) this.endFake(e);
      }
      this.beatT -= dt;
      if (this.beatT <= 0) { this.beatT = 0.85; this.sfx("a:heartbeat", { gain: 0.35, duck: false }); }
      if (this.waitT >= this.nowAt && !this.evs.some((e) => e.on && !e.off)) this.goNow();
    } else if (this.phase === "now") {
      if (this.t - this.nowT >= this.slowCap) this.tooSlow();
    }
  }

  // ------------------------------------------------------------ drawing
  private paintStatic() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const W = this.W, H = this.H, hz = this.horizon, gy = this.groundY;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#FF8A5C"); sky.addColorStop(0.55, "#FFB870"); sky.addColorStop(1, "#FFE3A3");
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 2);
    // sun
    const sx = W * 0.78, sy = hz - Math.min(70, H * 0.08), sr = Math.min(W, H) * 0.12;
    const sg = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.4);
    sg.addColorStop(0, "rgba(255,240,170,0.7)"); sg.addColorStop(1, "rgba(255,240,170,0)");
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr * 2.4, 0, Math.PI * 2); g.fill();
    blob(g, sx, sy, sr, sr, "#FFE066", { gloss: 0.5 });
    // clouds
    for (let i = 0; i < 4; i++) blob(g, ((i * 263) % W) + 30, this.area.y + 20 + (i % 2) * 40, 46 + i * 6, 14, "#FFE8C8", { gloss: 0.4 });
    // mesas
    const mesa = (x: number, w: number, h: number, col: string) => {
      g.beginPath(); g.moveTo(x - w * 0.6, hz + 2); g.lineTo(x - w * 0.42, hz - h); g.lineTo(x + w * 0.42, hz - h); g.lineTo(x + w * 0.6, hz + 2); g.closePath();
      clayFill(g, col, x, hz - h / 2, Math.max(w, h) * 0.6, { gloss: 0.12 });
      g.fillStyle = rgba(darken(col, 0.3), 0.35); g.fillRect(x - w * 0.42, hz - h * 0.55, w * 0.84, 4);
    };
    mesa(W * 0.12, W * 0.3, H * 0.09, "#D9774A"); mesa(W * 0.55, W * 0.36, H * 0.13, "#C8643C"); mesa(W * 0.95, W * 0.26, H * 0.07, "#E08A55");
    // desert floor
    const gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#F5CB86"); gr.addColorStop(0.5, "#E9AE68"); gr.addColorStop(1, "#D18E4E");
    g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
    for (let i = 0; i < 36; i++) { g.fillStyle = "rgba(160,90,40,0.18)"; g.beginPath(); g.ellipse((i * 137.3) % W, hz + 14 + ((i * 71.9) % Math.max(10, H - hz - 20)), 6 + (i % 4) * 4, 2 + (i % 3), 0, 0, Math.PI * 2); g.fill(); }
    // saloon on the left
    const portrait = W < H * 0.8;
    const bw = portrait ? W * 0.36 : Math.min(W * 0.2, 260), bh = bw * 0.95, bx = portrait ? -bw * 0.18 : W * 0.03, by = gy - bh * 0.55;
    shadow(g, bx + bw / 2, by + bh, bw * 0.6, 12, 0.3);
    g.beginPath(); g.moveTo(bx, by + bh); g.lineTo(bx, by + bh * 0.18); g.lineTo(bx + bw * 0.12, by + bh * 0.18); g.lineTo(bx + bw * 0.12, by); g.lineTo(bx + bw * 0.88, by); g.lineTo(bx + bw * 0.88, by + bh * 0.18); g.lineTo(bx + bw, by + bh * 0.18); g.lineTo(bx + bw, by + bh); g.closePath();
    clayFill(g, "#C27A42", bx + bw / 2, by + bh / 2, bw * 0.7, { gloss: 0.15 });
    g.strokeStyle = "rgba(90,45,15,0.25)"; g.lineWidth = 2;
    for (let y = by + 12; y < by + bh; y += 12) { g.beginPath(); g.moveTo(bx + 2, y); g.lineTo(bx + bw - 2, y); g.stroke(); }
    clayPanel(g, bx + bw * 0.16, by + bh * 0.05, bw * 0.68, bh * 0.2, 8, "#FFE9B0", { lip: 4 });
    clayText(g, "SALOON", bx + bw * 0.5, by + bh * 0.135, Math.min(bw * 0.12, 26), { fill: "#C8323F", stroke: "#5A2E1C", gloss: false });
    for (const wx of [0.2, 0.62]) { rr(g, bx + bw * wx, by + bh * 0.34, bw * 0.18, bh * 0.18, 4); g.fillStyle = "#5A2E1C"; g.fill(); rr(g, bx + bw * wx + 3, by + bh * 0.34 + 3, bw * 0.18 - 6, bh * 0.18 - 6, 3); g.fillStyle = "#FFD27A"; g.fill(); }
    rr(g, bx + bw * 0.38, by + bh * 0.62, bw * 0.24, bh * 0.38, 3); g.fillStyle = "#3A2010"; g.fill();
    for (const sd of [0, 1]) { rr(g, bx + bw * (0.385 + sd * 0.12), by + bh * 0.68, bw * 0.11, bh * 0.2, 5); g.fillStyle = "#E3A563"; g.fill(); }
    rr(g, bx - 4, by + bh * 0.56, bw + 8, 8, 4); g.fillStyle = "#8A5428"; g.fill();
    // cactus on the right
    const cx = portrait ? W * 0.93 : W * 0.9, ch = portrait ? H * 0.16 : H * 0.24, cy = gy + 4;
    shadow(g, cx, cy, ch * 0.3, 8, 0.3);
    rr(g, cx - ch * 0.11, cy - ch, ch * 0.22, ch, ch * 0.11); clayFill(g, "#4FAF6A", cx, cy - ch / 2, ch * 0.5);
    for (const sd of [-1, 1]) {
      const ax = cx + sd * ch * 0.22, ay = cy - ch * (sd < 0 ? 0.5 : 0.62);
      rr(g, ax - ch * 0.08, ay - ch * 0.3, ch * 0.16, ch * 0.34, ch * 0.08); clayFill(g, "#4FAF6A", ax, ay - ch * 0.12, ch * 0.25);
      rr(g, Math.min(ax, cx) - 2, ay - ch * 0.02, Math.abs(ax - cx) + 4, ch * 0.12, ch * 0.06); clayFill(g, "#4FAF6A", (ax + cx) / 2, ay, ch * 0.2);
    }
    blob(g, cx, cy - ch - 4, ch * 0.07, ch * 0.06, "#FF6F91", { gloss: 0.5 });
    // ground line for the street
    g.fillStyle = "rgba(140,80,30,0.18)"; g.fillRect(0, gy + 2, W, 4);
    this.bg = c;
  }

  private drawSign(g: G) {
    const S = this.sb, sg = this.sign;
    // pole
    rr(g, this.poleX - 9, S.y + S.h - 6, 18, this.groundY - (S.y + S.h) + 12, 6);
    clayFill(g, "#8A5428", this.poleX, (S.y + this.groundY) / 2, (this.groundY - S.y) * 0.6, { gloss: 0.15 });
    const isNow = this.phase === "now";
    if (isNow || this.burstT > 0) {
      g.save(); g.globalAlpha = isNow ? 0.55 : this.burstT * 0.5;
      sunburst(g, S.x + S.w / 2, S.y + S.h / 2, Math.max(S.w, S.h) * 0.9, "rgba(255,255,255,0)", "#FFF6B8", 18, this.t * 0.6);
      g.restore();
    }
    g.save();
    const wob = Math.sin(sg.wob * 30) * sg.wob * 0.08 + Math.sin(this.hoot.sneeze * 26) * this.hoot.sneeze * 0.1;
    const sc = 1 + sg.pop * 0.12;
    g.translate(S.x + S.w / 2, S.y + S.h / 2); g.rotate(wob); g.scale(sc, sc); g.translate(-S.w / 2, -S.h / 2);
    shadow(g, S.w / 2, S.h + 6, S.w * 0.45, 10, 0.3);
    clayPanel(g, 0, 0, S.w, S.h, 18, "#B5773F", { lip: 8 });
    g.strokeStyle = "rgba(90,45,15,0.2)"; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(8, (S.h * i) / 4); g.lineTo(S.w - 8, (S.h * i) / 4 + 3); g.stroke(); }
    const pad = Math.max(10, S.w * 0.04);
    if (isNow) { g.save(); g.shadowColor = "#7DFF6A"; g.shadowBlur = 30 + Math.sin(this.t * 20) * 8; rr(g, pad, pad, S.w - pad * 2, S.h - 8 - pad * 2, 14); g.fillStyle = sg.bg; g.fill(); g.restore(); }
    rr(g, pad, pad, S.w - pad * 2, S.h - 8 - pad * 2, 14);
    clayFill(g, sg.bg, S.w / 2, S.h / 2, S.w * 0.5, { gloss: 0.25, rim: false });
    for (const [nx, ny] of [[pad * 0.5, pad * 0.5], [S.w - pad * 0.5, pad * 0.5], [pad * 0.5, S.h - 8 - pad * 0.5], [S.w - pad * 0.5, S.h - 8 - pad * 0.5]]) blob(g, nx, ny, 3.5, 3.5, "#6B4A2A", { gloss: 0.5 });
    let text = sg.text;
    if (text === "WAIT") text = "WAIT" + ".".repeat(Math.floor(this.t * 2.5) % 4);
    const big = sg.sub ? 0.4 : 0.5;
    const fs = Math.min((S.h - 8) * big, (S.w * 1.5) / Math.max(4, text.length + 1));
    const ty = S.h / 2 - 4 - (sg.sub ? S.h * 0.1 : 0);
    clayText(g, text, S.w / 2, ty, fs, { fill: sg.fg, stroke: sg.fg === "#FFFFFF" ? darken(sg.bg, 0.45) : "#FFFFFF" });
    if (sg.sub) clayText(g, sg.sub, S.w / 2, S.h * 0.74, Math.min(S.h * 0.15, (S.w * 1.6) / Math.max(8, sg.sub.length + 2)), { fill: "#FFFFFF", stroke: darken(sg.bg, 0.5), gloss: false });
    g.restore();
  }

  private drawHoot(g: G, mood: "happy" | "wow" | "sad") {
    const H = this.hb, sn = this.hoot.sneeze, hop = Math.sin(this.hoot.hop * Math.PI) * 14;
    const jit = sn > 0 ? Math.sin(sn * 40) * sn * 6 : 0;
    shadow(g, H.x, H.y - 2, H.h * 0.32, 9, 0.35);
    this.sprite(g, this.host(sn > 0.3 ? "wow" : mood), H.x + jit, H.y - hop, H.h, { rot: -sn * 0.25, sy: 1 + Math.sin(this.t * 2.4) * 0.015 + sn * 0.08, sx: 1 - sn * 0.05 });
    // sheriff badge
    star(g, H.x - H.h * 0.13 + jit, H.y - hop - H.h * 0.36, H.h * 0.075, "#FFD25A", -0.15);
    // wing on the pole
    blob(g, this.poleX + 6, this.sb.y + this.sb.h + (this.groundY - this.sb.y - this.sb.h) * 0.25, H.h * 0.09, H.h * 0.06, "#9A6A3C", { gloss: 0.3 });
    if (sn > 0.2) {
      g.save(); g.globalAlpha = Math.min(1, sn * 2);
      clayText(g, "ACHOO!", H.x - H.h * 0.1, H.y - H.h * 1.08, Math.min(34, H.h * 0.2), { fill: "#FFFFFF", rot: -0.15 });
      g.restore();
    }
  }

  private drawKranky(g: G) {
    const k = this.kr.show;
    if (k <= 0.01) return;
    const portrait = this.W < this.H * 0.8;
    const x = portrait ? this.W * 0.24 : this.W * 0.14, h = Math.min(this.hb.h * 0.75, 170), y = this.groundY + 10 + (1 - k) * h;
    const wave = Math.sin(this.t * 12);
    // flag held high above his head
    const px = x - h * 0.2 + wave * h * 0.06, top = y - h * 1.45;
    g.strokeStyle = "#6B4A2A"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(x - h * 0.32, y - h * 0.45); g.lineTo(px, top); g.stroke();
    const fw = h * 0.62, fh = h * 0.36;
    g.beginPath(); g.moveTo(px, top);
    for (let i = 0; i <= 8; i++) { const u = i / 8; g.lineTo(px + u * fw, top + Math.sin(u * 4 + this.t * 10) * 6 * u); }
    for (let i = 8; i >= 0; i--) { const u = i / 8; g.lineTo(px + u * fw, top + fh + Math.sin(u * 4 + this.t * 10) * 6 * u); }
    g.closePath(); g.fillStyle = NOW_BG; g.fill(); g.strokeStyle = darken(NOW_BG, 0.4); g.lineWidth = 2; g.stroke();
    clayText(g, "GO!", px + fw * 0.5, top + fh * 0.5 + Math.sin(2 + this.t * 10) * 3, fh * 0.55, { fill: "#FFFFFF", stroke: darken(NOW_BG, 0.5), gloss: false });
    this.sprite(g, this.kr.laugh > 0 ? KRANKY_LAUGH : KRANKY, x, y, h, { rot: wave * 0.06 });
  }

  private drawWeed(g: G) {
    if (!this.weed.on) return;
    const r = Math.min(26, this.hb.h * 0.14), x = this.weed.x, y = this.groundY + 14 - r - Math.abs(Math.sin(this.weed.x * 0.04)) * 14;
    shadow(g, x, this.groundY + 14, r, 4, 0.25);
    g.save(); g.translate(x, y); g.rotate(this.weed.x * 0.05);
    g.strokeStyle = "#A0703F"; g.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(0, 0, r * (0.5 + (i % 3) * 0.22), r * (0.85 - (i % 2) * 0.2), i * 0.9, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  private drawTray(g: G) {
    const T = this.tray;
    clayPanel(g, T.x, T.y, T.w, T.h, 16, "#8A5428", { lip: 6 });
    const n = this.total, fw = Math.min(T.w * 0.24, 110), sp = (T.w - fw - 24) / n;
    for (let i = 0; i < n; i++) {
      const x = T.x + 14 + sp * (i + 0.5), y = T.y + T.h * 0.42;
      const v = this.times[i], cur = i === this.times.length && this.hud.status === "playing" && this.phase !== "done";
      if (v == null) {
        g.fillStyle = cur ? "rgba(255,225,120,0.35)" : "rgba(0,0,0,0.22)"; rr(g, x - sp * 0.4, T.y + 7, sp * 0.8, T.h - 20, 10); g.fill();
        g.save(); g.globalAlpha = cur ? 0.9 : 0.4; this.bullet(g, x, y, Math.min(16, T.h * 0.3)); g.restore();
      } else {
        const ok = v <= this.target;
        rr(g, x - sp * 0.44, T.y + 7, sp * 0.88, T.h - 20, 10); g.fillStyle = ok ? "#2FBF5B" : "#FF8A3D"; g.fill();
        clayText(g, String(v), x, y, Math.min(17, sp * 0.3), { fill: "#FFFFFF", stroke: darken(ok ? "#2FBF5B" : "#FF8A3D", 0.5), gloss: false });
      }
    }
    // false-start slots
    const fx = T.x + T.w - fw - 8, cy = T.y + T.h * 0.42;
    rr(g, fx, T.y + 7, fw, T.h - 20, 10); g.fillStyle = "rgba(0,0,0,0.25)"; g.fill();
    const m = Math.max(1, this.allowed + 1), fsp = fw / (m + 1);
    for (let i = 0; i < m; i++) {
      const x = fx + fsp * (i + 1), used = i < this.fouls;
      if (used) { g.strokeStyle = "#FF6F91"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(x - 6, cy - 6); g.lineTo(x + 6, cy + 6); g.moveTo(x + 6, cy - 6); g.lineTo(x - 6, cy + 6); g.stroke(); }
      else { g.fillStyle = i === m - 1 ? "rgba(255,111,145,0.35)" : "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(x, cy, 5, 0, Math.PI * 2); g.fill(); }
    }
    clayText(g, `GOAL: ${this.target} ms average`, T.x + 12 + (T.w - fw - 24) / 2, T.y + T.h - 7, 13, { fill: "#FFE9B0", stroke: "#5A2E1C", gloss: false });
    clayText(g, "oops", fx + fw / 2, T.y + T.h - 7, 13, { fill: "#FFC4CE", stroke: "#5A2E1C", gloss: false });
  }

  private bullet(g: G, x: number, y: number, s: number) {
    rr(g, x - s * 0.32, y - s * 0.2, s * 0.64, s * 0.9, s * 0.1); clayFill(g, "#C8962E", x, y + s * 0.2, s * 0.6, { gloss: 0.4 });
    g.beginPath(); g.ellipse(x, y - s * 0.2, s * 0.32, s * 0.6, 0, Math.PI, 0); g.closePath(); clayFill(g, "#E3A563", x, y - s * 0.5, s * 0.5, { gloss: 0.5 });
  }

  private scene(g: G, mood: "happy" | "wow" | "sad") {
    const key = `${this.W}x${this.H}x${this.dpr}x${Math.round(this.groundY)}`;
    if (!this.bg || this.bgKey !== key) { this.paintStatic(); this.bgKey = key; }
    g.drawImage(this.bg!, 0, 0, this.W, this.H);
    this.drawWeed(g);
    this.drawKranky(g);
    this.drawSign(g);
    this.drawHoot(g, mood);
    if (this.hud.status === "playing" || this.hud.status === "over") this.drawTray(g);
    if (this.phase === "now") {
      const a = 0.12 + Math.sin(this.t * 24) * 0.05;
      g.strokeStyle = rgba("#7DFF6A", a * 3); g.lineWidth = 10; g.strokeRect(5, this.area.y, this.W - 10, this.area.h);
    }
  }

  protected drawBackground(g: G) {
    this.layout();
    if (this.hud.status === "lobby") {
      const k = Math.floor(this.t / 1.6) % 3;
      if (k === 2) { this.sign.text = "NOW!"; this.sign.bg = NOW_BG; this.sign.fg = "#FFFFFF"; }
      else { this.sign.text = k ? "WAIT" : "QUICK DRAW"; this.sign.bg = "#FFF1D2"; this.sign.fg = "#23305A"; }
      this.sign.sub = "";
    }
    this.scene(g, "happy");
  }

  protected draw(g: G) { this.scene(g, this.hud.host.mood); }
}
