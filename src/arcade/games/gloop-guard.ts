// Gloop Guard — you're the door guard of the Slime Disco. Tap GREEN Gloops to let them in, never tap
// RED ones (or Momo sneaking in disguise). Endless run: quicker walkers, busier queues, then two and
// three doors, yellow look-alikes, colour-swapping Gloops and cool Gloops in sunglasses.
import { ArcadeGame, byDiff, clamp, ease, lerp, ramp, type GameMeta } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, eye, lighten, mix, mouth, rgba, rr, shadow, star, type G } from "../paint";

type Kind = "green" | "red" | "fake" | "momo";
type State = "walk" | "wait" | "in" | "crash" | "leave";
type Twist = "momo" | "doors2" | "fake" | "swap" | "doors3" | "shades";
interface Gl {
  id: number; lane: number; x: number; y: number; kind: Kind; col: string; prevCol: string; mixU: number;
  swapTo: Kind | null; swapAt: number; shades: boolean; state: State; wait: number; patience: number;
  anim: number; ph: number; hop: number; side: number; nope: number;
}
interface Door { open: number; flash: number; flashC: string; pop: number }
const GREEN = "#45C95A", RED = "#E8504F";
const MOMO = "/brand/momo-sly.webp";
const TWIST_ORDER: Twist[] = ["momo", "doors2", "fake", "swap", "doors3", "shades"];
const TWIST_INFO: Record<Twist, [string, string]> = {
  momo: ["SNEAKY MOMO!", "Momo is in disguise — keep him out!"],
  doors2: ["TWO DOORS!", "Guard both doors at once"],
  fake: ["LOOK-ALIKES!", "Yellowish Gloops are fakes — no entry!"],
  swap: ["COLOUR SWAP!", "Some Gloops change colour — watch!"],
  doors3: ["THREE DOORS!", "The party is getting BIG"],
  shades: ["COOL GLOOPS!", "Sunglasses don't matter — check the colour"],
};
const DISCO = ["#FF3FA4", "#3FD4FF", "#FFE14F", "#7DFF6A", "#B26BFF"];

export default class GloopGuard extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "gloop-guard", title: "Gloop Guard", host: "gloop", style: "run",
    music: { calm: "a:guard_calm", action: "a:guard_action" },
    sounds: ["a:doorOpen", "a:scratch", "a:honk", "a:poof", "a:aww", "a:cheer", "a:giggle", "a:squelch", "a:twinkle", "boing", "v:momo_laugh"],
    sprites: [MOMO], voicePitch: 0.8, transition: "iris",
  };
  private gloops: Gl[] = [];
  private doors: Door[] = [];
  private nextId = 1;
  private spawnT = 1; private spawned = 0; private sinceGreen = 0;
  private inCount = 0;
  private announced = new Set<Twist>();
  private redHinted = false;
  private crashT = 0;
  private boss = { hop: 0 };
  private demo = false;
  // layout
  private facadeH = 220; private doorsY = 300; private laneW = 140; private gs = 34; private spawnY = 900;
  private doorW = 90; private doorH = 140; private portrait = true;

  protected onResize() { this.layout(); }

  private doorCount() { return this.unlocked("doors3") ? 3 : this.unlocked("doors2") ? 2 : 1; }

  private unlocked(t: Twist) {
    const at = byDiff(this.diff, {
      easy: { momo: 3, doors2: 4, fake: 6, swap: 8, doors3: 10, shades: 12 },
      medium: { momo: 2, doors2: 3, fake: 5, swap: 6, doors3: 8, shades: 9 },
      hard: { momo: 2, doors2: 2, fake: 3, swap: 4, doors3: 5, shades: 6 },
    })[t];
    return this.level >= at;
  }

  private params() {
    const L = this.level, d = this.diff, n = this.doors.length || 1;
    const forever = 1 + Math.max(0, L - 14) * 0.015; // keeps creeping up after the caps
    return {
      walk: byDiff(d, { easy: ramp(L, 3.6, -0.16, 1.6), medium: ramp(L, 3.1, -0.15, 1.35), hard: ramp(L, 2.6, -0.13, 1.15) }) / forever,
      gap: Math.max(0.38, byDiff(d, { easy: ramp(L, 2.2, -0.1, 0.9), medium: ramp(L, 1.85, -0.09, 0.75), hard: ramp(L, 1.55, -0.08, 0.62) }) / forever / (1 + (n - 1) * 0.3)),
      patience: byDiff(d, { easy: ramp(L, 2.4, -0.09, 1.15), medium: ramp(L, 2.0, -0.08, 1.0), hard: ramp(L, 1.7, -0.07, 0.85) }),
      red: ramp(L, byDiff(d, { easy: 0.25, medium: 0.3, hard: 0.33 }), 0.012, 0.42),
    };
  }

  private layout() {
    const A = this.area, W = this.W;
    this.portrait = W < A.h * 1.05;
    this.facadeH = this.portrait ? clamp(A.h * 0.36, 190, 320) : clamp(A.h * 0.42, 200, 330);
    this.doorsY = A.y + this.facadeH;
    const n = Math.max(1, this.doors.length);
    this.laneW = Math.min(this.portrait ? 160 : 220, (Math.min(W, 960) - 24) / Math.max(n, 1.6));
    this.gs = clamp(this.laneW * 0.25, 22, 44);
    this.spawnY = A.y + A.h + this.gs * 1.7;
    this.doorW = Math.min(this.laneW * 0.68, 128);
    this.doorH = Math.min(this.facadeH * 0.56, this.doorW * 1.5);
  }

  private laneX(i: number) { const n = Math.max(1, this.doors.length); return this.W / 2 + (i - (n - 1) / 2) * this.laneW; }
  private doorY() { return this.doorsY + this.gs * 0.3; }
  private prog(gl: Gl) { return clamp((this.spawnY - gl.y) / (this.spawnY - this.doorY()), 0, 1); }
  private size(gl: Gl) { return this.gs * lerp(1.08, 0.84, this.prog(gl)); }

  // ------------------------------------------------------------ run
  protected setupLevel() {
    this.demo = false;
    this.gloops = []; this.spawnT = 1.2; this.spawned = 0; this.sinceGreen = 0; this.inCount = 0; this.crashT = 0;
    this.redHinted = false;
    this.announced = new Set(TWIST_ORDER.filter((t) => this.unlocked(t)));
    this.doors = Array.from({ length: this.doorCount() }, () => ({ open: 0, flash: 0, flashC: DISCO[0], pop: 1 }));
    this.layout();
    this.music(this.level >= 4 ? "action" : "calm");
    this.react("happy", this.rng.pick(["You're the door guard!", "Only GREEN Gloops get in!", "Party time! Guard the door!"]));
    this.hint("Tap GREEN Gloops to let them in! 🟢");
    const active = TWIST_ORDER.filter((t) => this.unlocked(t));
    if (active.length) this.after(1.6, () => { const t = active[active.length - 1]; this.banner(TWIST_INFO[t][0], TWIST_INFO[t][1], "pink"); });
  }

  private spawn() {
    const P = this.params(), r = this.rng, n = this.doors.length;
    const lanes = r.shuffle([...Array(n).keys()]).filter((l) => !this.gloops.some((g) => g.lane === l && (g.state === "walk" || g.state === "wait") && g.y > this.spawnY - this.gs * 2.6));
    if (!lanes.length) return false;
    const count = (l: number) => this.gloops.filter((g) => g.lane === l && (g.state === "walk" || g.state === "wait")).length;
    lanes.sort((a, b) => count(a) - count(b));
    const lane = lanes[0];
    if (count(lane) >= 3) return false;
    const L = this.level;
    const pm = this.unlocked("momo") ? 0.07 : 0;
    const pf = this.unlocked("fake") ? Math.min(0.18, 0.1 + (L - 3) * 0.008) : 0;
    const roll = r.next();
    let kind: Kind = roll < pm ? "momo" : roll < pm + pf ? "fake" : roll < pm + pf + P.red ? "red" : "green";
    if (this.spawned < 2 || this.sinceGreen >= 2) kind = "green";
    let swapTo: Kind | null = null;
    if (this.unlocked("swap") && (kind === "green" || kind === "red") && r.chance(0.22)) { swapTo = kind; kind = kind === "green" ? "red" : "green"; }
    const finalKind = swapTo ?? kind;
    this.sinceGreen = finalKind === "green" ? 0 : this.sinceGreen + 1;
    this.spawned++;
    const col = this.colOf(kind);
    this.gloops.push({
      id: this.nextId++, lane, x: this.laneX(lane), y: this.spawnY, kind, col, prevCol: col, mixU: 1, swapTo, swapAt: r.range(0.35, 0.7),
      shades: this.unlocked("shades") && kind !== "momo" && r.chance(0.3), state: "walk", wait: 0, patience: P.patience * (kind === "green" ? 1 : 0.85),
      anim: 0, ph: r.range(0, 6), hop: 0, side: r.chance(0.5) ? 1 : -1, nope: 0,
    });
    if (finalKind !== "green" && !this.redHinted && L <= 2) { this.redHinted = true; this.after(0.6, () => this.hint("Never tap RED ones! Let them walk away 🔴")); }
    return true;
  }

  private colOf(k: Kind) {
    if (k === "green") return GREEN;
    if (k === "red") return RED;
    if (k === "fake") return mix("#F2C230", "#C4D83A", clamp((this.level - 3) / 14, 0, 0.75));
    return "#FF9A3D";
  }

  // ------------------------------------------------------------ input
  onKey(key: string) {
    const n = this.doors.length;
    const map: Record<string, number> = n === 1 ? { "1": 0, ArrowDown: 0, ArrowUp: 0, Enter: 0 } : n === 2 ? { "1": 0, "2": 1, ArrowLeft: 0, ArrowRight: 1 } : { "1": 0, "2": 1, "3": 2, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2 };
    const lane = map[key];
    if (lane == null) return;
    const front = this.gloops.filter((g) => g.lane === lane && (g.state === "walk" || g.state === "wait")).sort((a, b) => a.y - b.y)[0];
    if (front) this.judge(front);
  }

  protected onDown(x: number, y: number) {
    let best: Gl | null = null, bd = Infinity;
    for (const gl of this.gloops) {
      if (gl.state !== "walk" && gl.state !== "wait") continue;
      const s = this.size(gl), d = Math.hypot(x - gl.x, y - (gl.y - s * 0.8));
      if (d < Math.max(s * 1.45, 34) && d < bd) { best = gl; bd = d; }
    }
    if (best) this.judge(best);
  }

  private judge(gl: Gl) {
    const s = this.size(gl), x = gl.x, y = gl.y - s * 1.6;
    const door = this.doors[gl.lane];
    gl.anim = 0;
    if (gl.kind === "green") {
      gl.state = "in";
      door.open = Math.max(door.open, 0.01); door.flash = 1; door.flashC = this.rng.pick(DISCO);
      const quick = gl.wait > 0 ? 1 - gl.wait / gl.patience : 1;
      this.good(x, y, 10, quick * 0.5);
      this.sfx("a:doorOpen", { x, gain: 0.35, rate: 1.1 });
      this.sfx("boing", { x, gain: 0.45, rate: 1 + Math.min(this.combo, 10) * 0.03 });
      this.burst(this.laneX(gl.lane), this.doorsY - this.doorH * 0.5, { n: 16, colors: DISCO, kind: "conf", speed: 260, gravity: 380 });
      this.boss.hop = 1;
      this.inCount++;
      if (this.inCount % 10 === 0) this.after(0.4, () => this.nextLevel(), false);
      else if (this.inCount % 5 === 0) this.sfx("a:cheer", { gain: 0.3, delay: 0.3 });
    } else {
      gl.state = "crash"; gl.nope = 1;
      door.open = Math.max(door.open, 0.01); door.flash = 1; door.flashC = RED;
      this.crashT = 1;
      this.sfx("a:scratch", { gain: 0.7 });
      if (gl.kind === "momo") {
        this.sfx("v:momo_laugh", { gain: 0.7, delay: 0.15, duck: false }); this.sfx("a:honk", { x, gain: 0.5 });
        this.float("MOMO?!", x, y - 20, "#FF9A3D", 30);
        this.bad(x, y, { line: this.rng.pick(["MOMO?! Sneaky sneaky!", "That's Momo in a hat!", "Momo's not a Gloop!"]) });
      } else if (gl.kind === "fake") {
        this.sfx("a:honk", { x, gain: 0.55 });
        this.float("FAKE!", x, y - 20, "#FFE14F", 30);
        this.bad(x, y, { line: this.rng.pick(["That one was YELLOW!", "A fake Gloop!", "Look closer — not green!"]) });
      } else {
        this.sfx("a:giggle", { gain: 0.5, delay: 0.25 });
        this.bad(x, y, { line: this.rng.pick(["Party crasher!", "Not the red ones!", "Uh-oh, RED got in!", "Red means NO!"]) });
      }
    }
  }

  private nextLevel() {
    if (this.hud.status !== "playing" || this.lives <= 0) return;
    const before = this.doors.length;
    this.levelUp();
    if (this.level === 4) this.music("action");
    const n = this.doorCount();
    if (n > before) {
      for (let i = before; i < n; i++) this.doors.push({ open: 0, flash: 0.6, flashC: DISCO[i], pop: 0 });
      for (const d of this.doors) { d.pop = Math.min(d.pop, 0.4); this.tween(d, { pop: 1 }, 0.6, ease.back); }
      this.layout();
      this.sfx("a:twinkle", { gain: 0.5 });
    }
    const fresh = TWIST_ORDER.find((t) => this.unlocked(t) && !this.announced.has(t));
    if (fresh) {
      this.announced.add(fresh);
      this.after(1.6, () => {
        this.banner(TWIST_INFO[fresh][0], TWIST_INFO[fresh][1], "pink");
        this.hint(fresh === "momo" ? "Don't let Momo sneak in! 🍊" : fresh === "fake" ? "Only REAL green Gloops! 🟢" : fresh === "swap" ? "Watch them change colour! 🔄" : fresh === "shades" ? "Check the colour, not the shades 😎" : "Tap GREEN Gloops at every door! 🚪");
      }, false);
    }
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    const P = this.params(), playing = this.hud.status === "playing" && this.lives > 0;
    this.boss.hop = Math.max(0, this.boss.hop - dt * 2.5);
    this.crashT = Math.max(0, this.crashT - dt * 1.5);
    for (const d of this.doors) {
      d.flash = Math.max(0, d.flash - dt * 1.6);
      const busy = this.gloops.some((g) => (g.state === "in" || g.state === "crash") && this.doors[g.lane] === d);
      d.open = clamp(d.open + (busy ? dt * 6 : -dt * 3), 0, 1);
    }
    if (playing && !this.inTransition) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) this.spawnT = this.spawn() ? P.gap * this.rng.range(0.8, 1.2) : 0.25;
    }
    const dy0 = this.doorY(), speed = (this.spawnY - dy0) / P.walk;
    for (const gl of this.gloops) {
      gl.nope = Math.max(0, gl.nope - dt * 2);
      gl.mixU = Math.min(1, gl.mixU + dt * 3.5);
      const lx = this.laneX(gl.lane);
      if (gl.state === "walk" || gl.state === "wait") gl.x = lerp(gl.x, lx, Math.min(1, dt * 6));
      if (gl.state === "walk") {
        const ahead = this.gloops.filter((o) => o !== gl && o.lane === gl.lane && (o.state === "walk" || o.state === "wait") && o.y < gl.y).sort((a, b) => b.y - a.y)[0];
        const limit = ahead ? ahead.y + this.gs * 2.3 : dy0;
        const ny = Math.max(limit, gl.y - speed * dt * (gl.kind === "momo" ? 0.8 : 1));
        const moving = ny < gl.y - 0.1;
        gl.y = ny;
        gl.hop = moving ? Math.abs(Math.sin(this.t * 7 + gl.ph)) : Math.max(0, gl.hop - dt * 4);
        if (gl.swapTo && this.prog(gl) >= gl.swapAt) {
          gl.prevCol = gl.col; gl.kind = gl.swapTo; gl.col = this.colOf(gl.kind); gl.mixU = 0; gl.swapTo = null; gl.nope = 0.8;
          this.sfx("a:poof", { x: gl.x, gain: 0.45 });
          this.burst(gl.x, gl.y - this.size(gl), { n: 10, colors: [gl.col, "#FFFFFF"], kind: "star", speed: 160, size: 5 });
        }
        if (Math.abs(gl.y - dy0) < 0.5 && !ahead) { gl.state = "wait"; gl.wait = 0; gl.hop = 0; }
      } else if (gl.state === "wait") {
        gl.wait += dt;
        if (gl.wait >= gl.patience && playing) this.walkAway(gl);
      } else if (gl.state === "in" || gl.state === "crash") {
        gl.anim = Math.min(1, gl.anim + dt * 2.4);
        gl.x = lerp(gl.x, lx, Math.min(1, dt * 10));
        gl.y = lerp(gl.y, this.doorsY - 6, Math.min(1, dt * 8));
      } else if (gl.state === "leave") {
        gl.anim = Math.min(1, gl.anim + dt * 1.1);
        gl.x += gl.side * dt * this.laneW * 1.6;
        gl.y += dt * 30;
        gl.hop = Math.abs(Math.sin(this.t * 9 + gl.ph));
      }
    }
    this.gloops = this.gloops.filter((g) => !((g.state === "in" || g.state === "crash" || g.state === "leave") && g.anim >= 1));
  }

  private walkAway(gl: Gl) {
    gl.state = "leave"; gl.anim = 0;
    const s = this.size(gl);
    if (gl.kind === "green") {
      gl.nope = 1;
      this.sfx("a:aww", { gain: 0.5 });
      this.bad(gl.x, gl.y - s * 1.6, { line: this.rng.pick(["Aww, he was green!", "Let the green ones in!", "Nooo, he went home!", "Too slow, guard!"]) });
    } else {
      this.addRaw(5);
      this.float("NOPE ✋", gl.x, gl.y - s * 2.2, "#FFFFFF", 22);
      this.sfx("a:squelch", { x: gl.x, gain: 0.35, rate: 1.3 });
    }
  }

  // ------------------------------------------------------------ drawing
  private drawClub(g: G) {
    const W = this.W, H = this.H, A = this.area, top = A.y - 6, dy = this.doorsY;
    // night sky
    const sky = g.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, "#0E0726"); sky.addColorStop(1, "#2A1252");
    g.fillStyle = sky; g.fillRect(0, 0, W, top + 2);
    for (let i = 0; i < 30; i++) { const tw = (Math.sin(this.t * 2 + i * 1.7) + 1) / 2; g.fillStyle = `rgba(255,255,255,${0.2 + tw * 0.5})`; g.beginPath(); g.arc((i * 131.7) % W, (i * 37.3) % Math.max(10, top), 1.2 + (i % 3) * 0.6, 0, Math.PI * 2); g.fill(); }
    // brick wall
    g.fillStyle = "#3D1F66"; g.fillRect(0, top, W, dy - top);
    const bh = 18, bw = 44;
    for (let y = top, r = 0; y < dy; y += bh, r++) for (let x = (r % 2) * -bw / 2; x < W; x += bw) {
      g.fillStyle = (r * 7 + Math.floor(x / bw)) % 3 === 0 ? "#4A2878" : "#452471"; rr(g, x + 2, y + 2, bw - 4, bh - 4, 5); g.fill();
    }
    // cornice
    rr(g, -10, top - 8, W + 20, 16, 8); g.fillStyle = "#6B3FA8"; g.fill();
    // spinning disco lights over the wall
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(this.t * 0.8 + i * 2.1) * 0.7 + Math.PI / 2, ox = W * (0.2 + i * 0.3);
      const gr = g.createLinearGradient(ox, top, ox + Math.cos(a) * 300, top + Math.sin(a) * 300);
      gr.addColorStop(0, rgba(DISCO[i], 0.22)); gr.addColorStop(1, rgba(DISCO[i], 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(ox, top); g.lineTo(ox + Math.cos(a - 0.15) * 340, top + Math.sin(a - 0.15) * 340); g.lineTo(ox + Math.cos(a + 0.15) * 340, top + Math.sin(a + 0.15) * 340); g.closePath(); g.fill();
    }
    g.restore();
    // sidewalk + street
    const st = g.createLinearGradient(0, dy, 0, H);
    st.addColorStop(0, "#3A2A55"); st.addColorStop(0.08, "#2A1C42"); st.addColorStop(1, "#160E26");
    g.fillStyle = st; g.fillRect(0, dy, W, H - dy);
    g.fillStyle = "#5C4A7E"; g.fillRect(0, dy, W, 8);
    for (let i = 0; i < 40; i++) { g.fillStyle = rgba(DISCO[i % 5], 0.18); g.beginPath(); g.arc((i * 97.1) % W, dy + 20 + ((i * 53.7) % Math.max(10, H - dy - 20)), 2 + (i % 3), 0, Math.PI * 2); g.fill(); }
  }

  private drawSign(g: G) {
    const A = this.area, W = this.W;
    const signH = clamp(this.facadeH * 0.2, 34, 58), signTop = A.y + 10;
    const hostW = this.portrait ? Math.min(W * 0.3, 130) : 170;
    const avail = this.portrait ? W - hostW - 30 : Math.min(W * 0.5, 520);
    const sx = this.portrait ? hostW + 18 : (W - avail) / 2, sw = avail;
    rr(g, sx, signTop, sw, signH, signH * 0.35); g.fillStyle = "#1A0B33"; g.fill();
    g.lineWidth = 4; g.strokeStyle = "#FF3FA4"; g.stroke();
    const n = Math.max(8, Math.round(sw / 22));
    for (let i = 0; i < n; i++) {
      const on = (Math.floor(this.t * 6) + i) % 3 === 0;
      g.fillStyle = on ? "#FFE14F" : "#7A5A30";
      g.beginPath(); g.arc(sx + 10 + (i * (sw - 20)) / (n - 1), signTop + 5, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(sx + 10 + (i * (sw - 20)) / (n - 1), signTop + signH - 5, 3, 0, Math.PI * 2); g.fill();
    }
    const flick = Math.sin(this.t * 23) > 0.92 ? 0.5 : 1;
    const fs = Math.min(signH * 0.55, sw / 7.5);
    g.save(); g.shadowColor = "#7DFF6A"; g.shadowBlur = 16 * flick;
    clayText(g, "SLIME DISCO", sx + sw / 2, signTop + signH / 2 + 1, fs, { fill: flick > 0.6 ? "#B8FF9A" : "#6BA85A", stroke: "#1A5C2A", gloss: false });
    g.restore();
    // host Gloop: the club boss bopping beside the sign
    const hh = this.portrait ? Math.min(hostW / 1.73, this.facadeH * 0.38) : Math.min(110, this.facadeH * 0.45);
    const hx = this.portrait ? 12 + hostW / 2 : sx - hh * 1.0, hy = signTop + signH + hh * 0.2;
    const bop = Math.abs(Math.sin(this.t * 4)) * 4 + this.boss.hop * 10;
    this.sprite(g, this.host(this.hud.status === "lobby" ? "happy" : this.hud.host.mood), hx, hy - bop, hh, { sy: 1 + Math.sin(this.t * 8) * 0.03, rot: Math.sin(this.t * 4) * 0.05 });
  }

  /** thumping party speakers beside the doors (when there is room) */
  private drawSpeakers(g: G) {
    const n = Math.max(1, this.doors.length), half = (n * this.laneW) / 2;
    const sh = clamp(this.facadeH * 0.42, 70, 130), sw = sh * 0.62;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * Math.PI * 4)), 6);
    for (const sd of [-1, 1]) {
      const cx = this.W / 2 + sd * (half + sw * 0.5 + 18);
      if (cx - sw / 2 < 6 || cx + sw / 2 > this.W - 6) continue;
      const x = cx - sw / 2, y = this.doorsY + 14 - sh;
      shadow(g, cx, this.doorsY + 14, sw * 0.6, 7, 0.4);
      clayPanel(g, x, y, sw, sh, 12, "#2E2346", { lip: 6 });
      for (const [fy, fr] of [[0.3, 0.2], [0.68, 0.3]] as const) {
        const r = sw * fr * (1 + beat * 0.08);
        blob(g, cx, y + sh * fy, r, r, "#16101F", { gloss: 0.2 });
        blob(g, cx, y + sh * fy, r * 0.42, r * 0.42, DISCO[(sd + 2) % 5], { gloss: 0.5 });
      }
    }
  }

  private drawDoor(g: G, i: number) {
    const d = this.doors[i], x = this.laneX(i), w = this.doorW * d.pop, h = this.doorH * d.pop, y0 = this.doorsY - h;
    if (w < 4) return;
    // carpet
    const ct = this.doorsY + 4, cb = this.H + 10, tw = this.doorW * 0.86, bw = this.laneW * 0.9;
    g.beginPath(); g.moveTo(x - tw / 2, ct); g.lineTo(x + tw / 2, ct); g.lineTo(x + bw / 2, cb); g.lineTo(x - bw / 2, cb); g.closePath();
    const cg = g.createLinearGradient(0, ct, 0, cb); cg.addColorStop(0, "#C52A42"); cg.addColorStop(1, "#8E1730");
    g.fillStyle = cg; g.fill();
    g.strokeStyle = "#FFC93C"; g.lineWidth = 3; g.stroke();
    // light spill on the carpet
    if (d.open > 0.02 || d.flash > 0.02) {
      g.save(); g.globalCompositeOperation = "lighter";
      const k = Math.max(d.open * 0.5, d.flash);
      const lg = g.createRadialGradient(x, ct, 4, x, ct + 60, this.laneW * 1.1);
      lg.addColorStop(0, rgba(d.flashC, 0.55 * k)); lg.addColorStop(1, rgba(d.flashC, 0));
      g.fillStyle = lg; g.beginPath(); g.moveTo(x - tw / 2, ct); g.lineTo(x + tw / 2, ct); g.lineTo(x + bw * 0.7, ct + this.laneW * 1.4); g.lineTo(x - bw * 0.7, ct + this.laneW * 1.4); g.closePath(); g.fill();
      g.restore();
    }
    // frame + neon arch
    const r = w / 2;
    g.beginPath(); g.moveTo(x - w / 2 - 8, this.doorsY); g.lineTo(x - w / 2 - 8, y0 + r); g.arc(x, y0 + r, r + 8, Math.PI, 0); g.lineTo(x + w / 2 + 8, this.doorsY); g.closePath();
    clayFill(g, "#2A1747", x, y0 + h / 2, h * 0.6, { gloss: 0.15 });
    g.save(); g.shadowColor = DISCO[i % 5]; g.shadowBlur = 14;
    g.strokeStyle = lighten(DISCO[(i + 1) % 5], 0.2); g.lineWidth = 4;
    g.beginPath(); g.arc(x, y0 + r, r + 14, Math.PI, 0); g.stroke(); g.restore();
    // doorway path
    const path = () => { g.beginPath(); g.moveTo(x - w / 2, this.doorsY); g.lineTo(x - w / 2, y0 + r); g.arc(x, y0 + r, r, Math.PI, 0); g.lineTo(x + w / 2, this.doorsY); g.closePath(); };
    // party inside
    g.save(); path(); g.clip();
    const bands = 6;
    for (let k = 0; k < bands; k++) { g.fillStyle = DISCO[(k + Math.floor(this.t * 6)) % 5]; g.fillRect(x - w / 2 + (k * w) / bands, y0, w / bands + 1, h); }
    g.fillStyle = `rgba(20,8,40,${0.35 - d.flash * 0.3})`; g.fillRect(x - w / 2, y0, w, h);
    star(g, x, y0 + h * 0.35, w * 0.12, "#FFFFFF", this.t * 3);
    // gloops that went in are drawn inside, clipped
    for (const gl of this.gloops) if (gl.lane === i && (gl.state === "in" || gl.state === "crash") && gl.anim > 0.45) this.drawEntity(g, gl, 1 - (gl.anim - 0.45) * 0.9);
    // door panels swing open
    const op = ease.out(d.open), pw = (w / 2) * (1 - op * 0.82);
    for (const sd of [-1, 1]) {
      const px = sd < 0 ? x - w / 2 : x + w / 2 - pw;
      rr(g, px, y0, pw, h, 6);
      clayFill(g, sd < 0 ? "#7B4FD0" : "#6A42BF", px + pw / 2, y0 + h / 2, h * 0.55, { gloss: 0.25 });
      if (pw > 12) {
        g.fillStyle = "#FFC93C"; g.beginPath(); g.arc(sd < 0 ? px + pw - 7 : px + 7, y0 + h * 0.58, Math.max(2.5, w * 0.035), 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba("#BFE8FF", 0.7); g.beginPath(); g.arc(px + pw / 2, y0 + h * 0.3, Math.min(pw * 0.28, h * 0.1), 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
    if (this.W > 700 && this.doors.length > 1) {
      blob(g, x, y0 - 22, 13, 13, "#1A0B33", { gloss: 0.2 });
      clayText(g, String(i + 1), x, y0 - 21, 16, { fill: "#FFFFFF", stroke: "#1A0B33", gloss: false });
    }
  }

  /** brass rope posts between and beside the doors */
  private drawPosts(g: G) {
    const n = this.doors.length;
    if (!n) return;
    const xs: number[] = [this.laneX(0) - this.doorW / 2 - 16, this.laneX(n - 1) + this.doorW / 2 + 16];
    for (let i = 1; i < n; i++) xs.push((this.laneX(i - 1) + this.laneX(i)) / 2);
    const py = this.doorsY + 18;
    for (const px of xs) {
      g.strokeStyle = "#C21F3A"; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.moveTo(px, py - 24); g.quadraticCurveTo(px + 4, py + 10, px, py + 24); g.stroke();
      g.fillStyle = "#C8962E"; rr(g, px - 3, py - 26, 6, 26, 3); g.fill();
      blob(g, px, py - 28, 6, 6, "#FFD25A", { gloss: 0.6 });
      blob(g, px, py, 8, 3, "#A87A20");
    }
  }

  private drawGloop(g: G, x: number, y: number, s: number, col: string, o: { mood: "happy" | "grumpy" | "sad" | "wow"; shades: boolean; horns: boolean; hop: number; ph: number; nope: number }) {
    const dance = Math.sin(this.t * 5 + o.ph);
    const st = 1 + o.hop * 0.1 + dance * 0.025;
    shadow(g, x, y + 2, s * 1.15, s * 0.26, 0.45);
    g.save();
    g.translate(x + Math.sin(o.nope * 26) * o.nope * 5, y - o.hop * s * 0.45);
    g.rotate(dance * 0.04);
    g.scale(1 / Math.sqrt(st), st);
    for (const [dx, r] of [[-0.75, 0.22], [0.8, 0.18], [-0.2, 0.2], [0.4, 0.16]] as const) blob(g, dx * s, -s * 0.05, r * s, r * s * 1.2, col, { gloss: 0.3 });
    blob(g, 0, -s * 0.72, s * 1.15, s * 0.82, col, { gloss: 0.55, wobble: 0.04, t: this.t + o.ph });
    g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = s * 0.22;
    for (const sd of [-1, 1]) {
      const up = o.mood === "happy" ? 0.95 + Math.max(0, dance * sd) * 0.45 : o.mood === "sad" ? 0.35 : 0.6;
      g.beginPath(); g.moveTo(sd * s * 0.98, -s * 0.7); g.lineTo(sd * s * 1.42, -s * up); g.stroke();
    }
    if (o.horns) for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(sd * s * 0.32, -s * 1.38); g.lineTo(sd * s * 0.62, -s * 1.86); g.lineTo(sd * s * 0.72, -s * 1.3); g.closePath();
      clayFill(g, darken(col, 0.3), sd * s * 0.55, -s * 1.5, s * 0.35, { gloss: 0.4 });
    }
    g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(s * 0.62, -s * 1.05, s * 0.07, 0, Math.PI * 2); g.fill();
    if (o.shades) {
      g.fillStyle = "#14101E";
      for (const sd of [-1, 1]) { rr(g, sd * s * 0.36 - s * 0.3, -s * 1.2, s * 0.6, s * 0.36, s * 0.14); g.fill(); }
      g.fillRect(-s * 0.08, -s * 1.14, s * 0.16, s * 0.06);
      g.fillStyle = "rgba(255,255,255,0.55)"; for (const sd of [-1, 1]) { rr(g, sd * s * 0.36 - s * 0.2, -s * 1.15, s * 0.14, s * 0.07, s * 0.03); g.fill(); }
    } else {
      const look: [number, number] = o.nope > 0 ? [Math.sin(o.nope * 20), 0] : [0, -0.5];
      eye(g, -s * 0.36, -s * 1.02, s * 0.25, { look, pupil: 0.52, blink: Math.sin(this.t * 0.9 + o.ph * 3) > 0.985 ? 1 : 0 });
      eye(g, s * 0.36, -s * 1.05, s * 0.28, { look, pupil: 0.52 });
    }
    if (o.mood === "grumpy") {
      g.strokeStyle = darken(col, 0.55); g.lineWidth = s * 0.09;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * s * 0.12, -s * 1.28); g.lineTo(sd * s * 0.58, -s * 1.42); g.stroke(); }
    }
    g.fillStyle = "rgba(255,111,145,0.5)"; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * s * 0.7, -s * 0.72, s * 0.13, s * 0.08, 0, 0, Math.PI * 2); g.fill(); }
    const mk = o.mood === "sad" ? "frown" : o.mood === "wow" ? "oh" : o.mood === "grumpy" ? "tooth" : "grin";
    mouth(g, 0, -s * 0.55, s * 0.55, mk);
    if (mk === "grin") { g.fillStyle = "#FFFDF4"; rr(g, -s * 0.12, -s * 0.62, s * 0.17, s * 0.2, s * 0.04); g.fill(); }
    g.restore();
  }

  private drawMomo(g: G, x: number, y: number, s: number, hop: number, hatOff: number, alpha = 1) {
    const h = s * 2.15;
    shadow(g, x, y + 2, s * 1.0, s * 0.24, 0.45);
    g.save(); g.globalAlpha *= alpha;
    const sway = Math.sin(this.t * 6) * 0.06;
    this.sprite(g, MOMO, x, y - hop * s * 0.25, h, { rot: sway, sy: 1 + hop * 0.05 });
    // fake Gloop hat (with googly eyes) — the sprout pokes out the top!
    const u = hatOff, hx = x + u * s * 2.2 + Math.sin(sway) * h * 0.6, hy = y - hop * s * 0.25 - h * 0.74 - u * s * 3 + u * u * s * 2;
    if (u < 1) {
      g.save(); g.translate(hx, hy); g.rotate(sway + u * 4);
      for (const dx of [-0.6, -0.15, 0.35, 0.7]) blob(g, dx * s, s * 0.28, s * 0.13, s * 0.2, GREEN, { gloss: 0.3 });
      blob(g, 0, 0, s * 0.9, s * 0.42, GREEN, { gloss: 0.55, wobble: 0.05, t: this.t });
      eye(g, -s * 0.28, -s * 0.12, s * 0.17, { look: [0, -0.4] }); eye(g, s * 0.28, -s * 0.14, s * 0.19, { look: [0, -0.4] });
      g.restore();
    }
    g.restore();
  }

  private drawEntity(g: G, gl: Gl, scale = 1) {
    const s = this.size(gl) * scale;
    if (s < 2) return;
    let y = gl.y, alpha = 1;
    if (gl.state === "in" || gl.state === "crash") y -= Math.sin(Math.min(1, gl.anim * 1.6) * Math.PI) * s * 0.9;
    if (gl.state === "leave") alpha = 1 - gl.anim;
    g.save(); g.globalAlpha *= alpha;
    if (gl.kind === "momo") this.drawMomo(g, gl.x, y, s, gl.hop, gl.state === "crash" ? Math.min(1, gl.anim * 2) : 0);
    else {
      const col = gl.mixU < 1 ? mix(gl.prevCol, gl.col, gl.mixU) : gl.col;
      const red = gl.kind === "red";
      const mood = gl.state === "in" ? "happy" : gl.state === "leave" ? (red ? "grumpy" : "sad") : gl.state === "crash" ? "grumpy" : red ? "grumpy" : gl.state === "wait" ? "wow" : "happy";
      this.drawGloop(g, gl.x, y, s, col, { mood: gl.kind === "fake" && mood === "grumpy" ? "sad" : mood, shades: gl.shades, horns: red, hop: gl.hop, ph: gl.ph, nope: gl.nope });
    }
    g.restore();
  }

  private drawPatience(g: G, gl: Gl) {
    const s = this.size(gl), u = 1 - gl.wait / gl.patience;
    const x = gl.x + s * 1.25, y = gl.y - s * 1.9, r = Math.max(9, s * 0.32);
    g.fillStyle = "rgba(20,8,40,0.65)"; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = u > 0.5 ? "#7CF2C9" : u > 0.25 ? "#FFD25A" : "#FF6F91"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); g.stroke();
  }

  private scene(g: G) {
    this.drawClub(g);
    this.drawSign(g);
    this.drawSpeakers(g);
    this.doors.forEach((_, i) => this.drawDoor(g, i));
    this.drawPosts(g);
    const list = this.gloops.filter((gl) => !((gl.state === "in" || gl.state === "crash") && gl.anim > 0.45)).sort((a, b) => a.y - b.y);
    for (const gl of list) this.drawEntity(g, gl);
    for (const gl of this.gloops) if (gl.state === "wait") this.drawPatience(g, gl);
    if (this.crashT > 0) { g.fillStyle = rgba("#FF3B5C", this.crashT * 0.12); g.fillRect(0, 0, this.W, this.H); }
  }

  protected drawBackground(g: G) {
    if (!this.demo) {
      this.demo = true;
      this.doors = [{ open: 0, flash: 0, flashC: DISCO[0], pop: 1 }];
      const k: Kind[] = ["green", "red", "green"];
      this.gloops = k.map((kind, i) => ({ id: i, lane: 0, x: 0, y: 0, kind, col: this.colOf(kind), prevCol: this.colOf(kind), mixU: 1, swapTo: null, swapAt: 1, shades: i === 2, state: i === 0 ? "wait" : "walk", wait: 0, patience: 99, anim: 0, ph: i * 2, hop: 0, side: 1, nope: 0 }));
    }
    this.layout();
    this.gloops.forEach((gl, i) => { gl.x = this.laneX(0); gl.y = this.doorY() + i * this.gs * 2.4; gl.hop = i ? Math.abs(Math.sin(this.t * 5 + i)) * 0.5 : 0; });
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}

