// Maze Munch — guide Momo through a squishy clay maze, munch every cookie and reach the flag.
// Unlimited levels: bigger mazes, then fog of war, Kranky on patrol, keys & locked doors and
// beat-the-clock rounds (mixed together on the hardest levels).
import { ArcadeGame, Bag, Recent, byDiff, clamp, ease, lerp, Rng, spriteUrl, type GameMeta, type Tone } from "../engine";
import { blob, clayPanel, clayText, darken, lighten, rgba, rr, shadow, star, type G } from "../paint";

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
interface Theme { floor: string; floor2: string; wall: string; bg: [string, string] }
const THEMES: Theme[] = [
  { floor: "#C9F09A", floor2: "#B8E585", wall: "#3E9A4A", bg: ["#7FD3F7", "#CFF3FF"] },
  { floor: "#FFE6EF", floor2: "#FFD9E6", wall: "#FF6F91", bg: ["#FFB3C7", "#FFE6EE"] },
  { floor: "#EAF7FF", floor2: "#DAEEFF", wall: "#4F8FE0", bg: ["#8FD3FF", "#E3F5FF"] },
  { floor: "#FFEBC2", floor2: "#FFE0A8", wall: "#D9894A", bg: ["#FFC27A", "#FFEACB"] },
  { floor: "#F0E6FF", floor2: "#E4D6FF", wall: "#8B5DE0", bg: ["#B79CF0", "#EEE5FF"] },
];
const KEY_COLS = ["#FFC93C", "#4FB3FF"];
const KRANKY = "/brand/kranky.webp", KRANKY_LAUGH = "/brand/kranky-laugh.webp";

interface Door { a: number; b: number; d: number; col: number; open: number; locked: boolean }
interface Item { cell: number; kind: "cookie" | "key"; col: number; got: boolean; ph: number }
type Phase = "intro" | "play" | "done";

export default class MazeMunch extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "maze-munch", title: "Maze Munch", host: "momo", style: "rounds",
    music: { calm: "a:maze_calm", action: "a:maze_action" },
    sounds: ["a:crunch", "hop", "a:bonk", "a:squeak", "a:chime", "a:creak", "a:doorOpen", "a:poof", "a:cheer", "a:tickHi", "a:tink", "snicker", "v:kranky_laugh", "v:momo_laugh"],
    sprites: [KRANKY, KRANKY_LAUGH], voicePitch: 1.4, transition: "iris",
  };
  private cols = 4; private rows = 4;
  private open: number[] = [];
  private items: Item[] = [];
  private doors: Door[] = [];
  private exit = 0; private home = 0;
  private theme: Theme = THEMES[0];
  private themeBag = new Bag<number>(THEMES.map((_, i) => i));
  private twistBag = new Bag<string>(["fog", "kranky", "keys", "timed"]);
  private recent = new Recent(24);
  private mo = { r: 0, c: 0, fr: 0, fc: 0, u: 1, face: 1, squash: 0, inv: 0, bump: 0, bdir: 0, chew: 0 };
  private keys: number[] = [];
  private queued = -1; private held = -1; private run = -1; private lastDir = -1;
  private fog = 0; private timed = false; private budget = 0; private startT = 0; private lastBar = -1;
  private kr: { path: number[]; p: number; v: number; speed: number; laugh: number } | null = null;
  private phase: Phase = "intro";
  private cookies = 0; private eaten = 0; private caught = 0;
  private swipe: { x: number; y: number } | null = null;
  private maze = { x: 0, y: 0, w: 300, h: 300, cs: 40 };
  private box = { x: 0, y: 0, w: 300, h: 300 };
  private pad = { x: 0, y: 0, b: 60, press: [0, 0, 0, 0] };
  private info = { x: 0, y: 0 };
  private cache?: HTMLCanvasElement;
  private stepT = 0.16;

  private laid = { w: 0, h: 0 };
  protected onResize() {
    // the HUD hint/bubble briefly stack while swapping: don't let the maze jump for that
    if (this.hud.status === "playing" && this.W === this.laid.w && this.H === this.laid.h) { this.after(0.7, () => this.relayout(), false); return; }
    this.relayout();
  }
  private relayout() { this.laid = { w: this.W, h: this.H }; this.layout(); }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 1.05;
    if (portrait) {
      const padH = clamp(A.h * 0.27, 150, 230), b = clamp(Math.min(padH / 2.9, this.W * 0.18), 52, 76);
      this.box = { x: 8, y: A.y + 2, w: this.W - 16, h: A.h - padH - 8 };
      this.pad = { ...this.pad, x: this.W / 2, y: A.y + A.h - padH / 2, b };
      this.info = { x: 18, y: A.y + A.h - padH / 2 };
    } else {
      const b = clamp(A.h * 0.1, 54, 72);
      this.box = { x: 16, y: A.y + 2, w: this.W - b * 3.3 - 48, h: A.h - 6 };
      this.pad = { ...this.pad, x: this.W - b * 1.65 - 18, y: A.y + A.h - b * 1.6, b };
      this.info = { x: this.W - b * 3.2 - 10, y: A.y + 40 };
    }
    this.fit();
  }

  private fit() {
    const B = this.box, pad = 14;
    const cs = Math.min((B.w - pad * 2) / this.cols, (B.h - pad * 2) / this.rows, 78);
    const w = cs * this.cols, h = cs * this.rows;
    this.maze = { x: B.x + (B.w - w) / 2, y: B.y + (B.h - h) / 2, w, h, cs };
    this.cache = undefined;
  }

  // ------------------------------------------------------------ maze generation
  private nb(i: number, d: number) {
    const r = Math.floor(i / this.cols) + DY[d], c = (i % this.cols) + DX[d];
    return r < 0 || c < 0 || r >= this.rows || c >= this.cols ? -1 : r * this.cols + c;
  }
  private carve(rng: Rng) {
    const N = this.rows * this.cols;
    this.open = new Array<number>(N).fill(0);
    const seen = new Array<boolean>(N).fill(false);
    const stack = [this.home]; seen[this.home] = true;
    while (stack.length) {
      const i = stack[stack.length - 1];
      const opts = [0, 1, 2, 3].filter((d) => { const j = this.nb(i, d); return j >= 0 && !seen[j]; });
      if (!opts.length) { stack.pop(); continue; }
      const d = rng.pick(opts), j = this.nb(i, d);
      this.open[i] |= 1 << d; this.open[j] |= 1 << ((d + 2) % 4);
      seen[j] = true; stack.push(j);
    }
  }
  /** BFS distances (doors given in `blocked` edges count as walls) */
  private bfs(from: number, blocked: Door[] = []) {
    const N = this.rows * this.cols, dist = new Array<number>(N).fill(-1), par = new Array<number>(N).fill(-1);
    dist[from] = 0; const q = [from];
    while (q.length) {
      const i = q.shift()!;
      for (let d = 0; d < 4; d++) {
        if (!(this.open[i] & (1 << d))) continue;
        const j = this.nb(i, d);
        if (j < 0 || dist[j] >= 0 || blocked.some((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i))) continue;
        dist[j] = dist[i] + 1; par[j] = i; q.push(j);
      }
    }
    return { dist, par };
  }

  private build(rng: Rng, k: number, nKeys: number, kranky: boolean, nCookies: number) {
    const portrait = this.box.h > this.box.w;
    const ratio = clamp(portrait ? this.box.h / this.box.w : this.box.w / this.box.h, 1, 1.8);
    let shortN = k, longN = Math.round(k * ratio);
    const shortPx = portrait ? this.box.w : this.box.h, longPx = portrait ? this.box.h : this.box.w;
    while (shortN > 4 && (shortPx - 28) / shortN < 28) shortN--;
    while (longN > shortN && (longPx - 28) / longN < 28) longN--;
    this.cols = portrait ? shortN : longN; this.rows = portrait ? longN : shortN;
    this.fit();
    const N = this.rows * this.cols;
    this.home = 0;
    this.carve(rng);
    const { dist, par } = this.bfs(this.home);
    this.exit = dist.indexOf(Math.max(...dist));
    const path: number[] = [];
    for (let i = this.exit; i >= 0; i = par[i]) path.unshift(i);
    // keys & doors on the only route to the exit
    this.doors = []; this.items = [];
    const used = new Set<number>([this.home, this.exit]);
    if (nKeys > 0 && path.length >= 6) {
      const spots = nKeys === 1 ? [rng.range(0.45, 0.7)] : [rng.range(0.3, 0.42), rng.range(0.62, 0.78)];
      spots.forEach((f, ki) => {
        const idx = clamp(Math.floor(path.length * f), 2, path.length - 2);
        const a = path[idx], b = path[idx + 1];
        const d = [0, 1, 2, 3].find((dd) => this.nb(a, dd) === b)!;
        this.doors.push({ a, b, d, col: ki, open: 0, locked: true });
      });
      this.doors.forEach((door, ki) => {
        const before = this.bfs(this.home, this.doors.slice(ki)).dist;
        const prevRegion = ki ? this.bfs(this.home, this.doors.slice(ki - 1)).dist : null;
        let cand = before.map((_, i) => i).filter((i) => before[i] >= 0 && !used.has(i) && !path.includes(i) && (!prevRegion || prevRegion[i] < 0));
        if (!cand.length) cand = before.map((_, i) => i).filter((i) => before[i] >= 0 && !used.has(i) && (!prevRegion || prevRegion[i] < 0));
        if (!cand.length) cand = before.map((_, i) => i).filter((i) => before[i] > 0 && !used.has(i));
        // prefer far-away dead ends
        cand.sort((x, y) => before[y] - before[x]);
        const cell = rng.pick(cand.slice(0, Math.max(1, Math.ceil(cand.length * 0.4))));
        used.add(cell);
        this.items.push({ cell, kind: "key", col: door.col, got: false, ph: rng.range(0, 6) });
      });
    }
    // Kranky patrols a short corridor away from the start; extra loops give ways around him
    this.kr = null;
    if (kranky) {
      if (!this.doors.length) {
        let loops = Math.max(2, Math.round(N * 0.06));
        for (let t = 0; t < 400 && loops > 0; t++) {
          const i = rng.int(0, N - 1), d = rng.pick([1, 2]), j = this.nb(i, d);
          if (j < 0 || this.open[i] & (1 << d)) continue;
          this.open[i] |= 1 << d; this.open[j] |= 1 << ((d + 2) % 4); loops--;
        }
      }
      const dd = this.bfs(this.home).dist;
      for (let t = 0; t < 40 && !this.kr; t++) {
        const s0 = rng.int(0, N - 1);
        if (dd[s0] < 4 || s0 === this.exit) continue;
        const pth = [s0];
        while (pth.length < 6) {
          const cur = pth[pth.length - 1];
          const opts = [0, 1, 2, 3].filter((d) => this.open[cur] & (1 << d)).map((d) => this.nb(cur, d)).filter((j) => j >= 0 && !pth.includes(j) && dd[j] >= 3 && j !== this.exit);
          if (!opts.length) break;
          pth.push(rng.pick(opts));
        }
        if (pth.length >= 3) this.kr = { path: pth, p: 0, v: 1, speed: byDiff(this.diff, { easy: 1.3, medium: 1.7, hard: 2.1 }), laugh: 0 };
      }
    }
    // cookies, preferring dead ends and far corners
    const free = Array.from({ length: N }, (_, i) => i).filter((i) => !used.has(i));
    const deadEnds = rng.shuffle(free.filter((i) => this.bitCount(this.open[i]) === 1));
    const others = rng.shuffle(free.filter((i) => this.bitCount(this.open[i]) !== 1));
    const picks = [...deadEnds.slice(0, Math.ceil(nCookies * 0.6)), ...others].slice(0, nCookies);
    for (const cell of picks) this.items.push({ cell, kind: "cookie", col: 0, got: false, ph: rng.range(0, 6) });
    this.cookies = picks.length;
    return `${this.cols}x${this.rows}:${this.open.join("")}:${picks.join(",")}`;
  }
  private bitCount(m: number) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1); }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const k = byDiff(d, { easy: Math.min(10, 4 + Math.floor((L - 1) / 2)), medium: Math.min(11, 5 + Math.floor((L - 1) / 2)), hard: Math.min(12, 6 + Math.floor((L - 1) / 2)) });
    let fog = byDiff(d, { easy: L >= 10 && L % 4 === 2, medium: L >= 6 && L % 3 === 0, hard: L >= 4 && L % 3 === 1 });
    let kranky = byDiff(d, { easy: L >= 7 && L % 3 === 1, medium: L >= 5 && L % 3 === 2, hard: L >= 3 && L % 2 === 1 });
    let nKeys = byDiff(d, { easy: L >= 5 && L % 3 === 2 ? 1 : 0, medium: L >= 4 && L % 3 === 1 ? (L >= 13 ? 2 : 1) : 0, hard: L >= 2 && L % 3 === 0 ? (L >= 9 ? 2 : 1) : 0 });
    this.timed = byDiff(d, { easy: L >= 14 && L % 5 === 0, medium: L >= 9 && L % 4 === 3, hard: L >= 6 && L % 4 === 2 });
    // once the mazes are big, every level gets at least one twist (picked from a no-repeat bag)
    if (L >= byDiff(d, { easy: 12, medium: 8, hard: 5 }) && !fog && !kranky && !nKeys && !this.timed) {
      const tw = this.twistBag.next(this.rng);
      if (tw === "fog") fog = true; else if (tw === "kranky") kranky = true; else if (tw === "keys") nKeys = L >= byDiff(d, { easy: 20, medium: 13, hard: 9 }) ? 2 : 1; else this.timed = true;
    }
    this.fog = fog ? byDiff(d, { easy: 2.4, medium: 2.1, hard: 1.8 }) : 0;
    const nCookies = byDiff(d, { easy: Math.min(14, 3 + Math.floor(L / 2)), medium: Math.min(18, 4 + Math.floor(L * 0.6)), hard: Math.min(22, 5 + Math.floor(L * 0.7)) });
    this.theme = THEMES[this.themeBag.next(this.rng)];
    let sig = "";
    for (let t = 0; t < 15; t++) { sig = this.build(this.rng, k, nKeys, kranky, nCookies); if (!this.recent.has(sig)) break; }
    this.recent.add(sig);
    const cs = this.cols;
    this.mo = { r: Math.floor(this.home / cs), c: this.home % cs, fr: Math.floor(this.home / cs), fc: this.home % cs, u: 1, face: 1, squash: 0, inv: 0, bump: 0, bdir: 0, chew: 0 };
    this.keys = []; this.queued = -1; this.held = -1; this.run = -1; this.lastDir = -1; this.swipe = null;
    this.eaten = 0; this.caught = 0; this.lastBar = -1; this.timerBar(null);
    this.stepT = byDiff(d, { easy: 0.17, medium: 0.15, hard: 0.14 });
    // a generous clock: walk the route start → keys → exit plus time for cookies
    let route = 0, at = this.home;
    for (const it of this.items.filter((x) => x.kind === "key")) { route += Math.max(0, this.bfs(at).dist[it.cell]); at = it.cell; }
    route += Math.max(0, this.bfs(at).dist[this.exit]);
    this.budget = Math.round((route * 0.55 + this.cookies * 1.3 + 8) * byDiff(d, { easy: 1.5, medium: 1.25, hard: 1.05 }));
    this.phase = "intro";
    this.cache = undefined;
    this.music(this.timed || kranky || this.fog ? "action" : "calm");
    const tw: [string, string, Tone][] = [];
    if (this.fog) tw.push(["FOGGY MAZE!", "You can only see close by", "navy"]);
    if (this.kr) tw.push(["KRANKY PATROL!", "Don't bump into Kranky!", "red"]);
    if (nKeys) tw.push([nKeys > 1 ? "KEYS & DOORS!" : "LOCKED DOOR!", nKeys > 1 ? "Match each key to its door" : "Find the key first", "gold"]);
    if (this.timed) tw.push(["HURRY UP!", `Reach the flag in ${this.budget}s`, "pink"]);
    tw.forEach((t, i) => this.after(0.45 + i * 1.6, () => this.banner(t[0], t[1], t[2])));
    this.react("happy", this.rng.pick(["Cookies! I smell cookies!", "Yum yum, let's go!", "Munch time!", "Which way is the flag?"]));
    this.hint(L === 1 ? "Swipe or tap the arrows to move Momo! 🍪" : `Munch ${this.cookies} cookies 🍪 and reach the flag 🚩`);
    this.after(0.6, () => { this.phase = "play"; this.startT = this.t; });
  }

  // ------------------------------------------------------------ input
  private padHit(x: number, y: number) {
    const P = this.pad;
    for (let d = 0; d < 4; d++) {
      const bx = P.x + DX[d] * P.b * 1.02, by = P.y + DY[d] * P.b * 1.02;
      if (Math.abs(x - bx) <= P.b * 0.62 && Math.abs(y - by) <= P.b * 0.62) return d;
    }
    return -1;
  }

  protected onDown(x: number, y: number) {
    const d = this.padHit(x, y);
    if (d >= 0) { this.held = d; this.run = -1; this.queued = d; this.pad.press[d] = 1; return; }
    const B = this.box;
    if (x >= B.x && x <= B.x + B.w && y >= B.y && y <= B.y + B.h) this.swipe = { x, y };
  }
  protected onMove(x: number, y: number) {
    if (this.held < 0) return;
    const d = this.padHit(x, y);
    if (d >= 0 && d !== this.held) { this.held = d; this.queued = d; this.pad.press[d] = 1; }
  }
  protected onUp(x: number, y: number) {
    if (this.held >= 0) { this.held = -1; return; }
    const s = this.swipe; this.swipe = null;
    if (!s) return;
    let dx = x - s.x, dy = y - s.y;
    if (Math.hypot(dx, dy) < 18) { // a tap: head towards the tapped spot
      const p = this.moPos();
      dx = x - p.x; dy = y - p.y;
      if (Math.hypot(dx, dy) < this.maze.cs * 0.4) return;
    }
    const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    this.run = d; this.queued = d;
  }

  onKey(key: string) {
    const k = key.toLowerCase();
    const d = k === "arrowup" || k === "w" ? 0 : k === "arrowright" || k === "d" ? 1 : k === "arrowdown" || k === "s" ? 2 : k === "arrowleft" || k === "a" ? 3 : -1;
    if (d < 0) return;
    this.queued = d; this.run = -1; this.pad.press[d] = 1;
  }

  // ------------------------------------------------------------ movement
  private here() { return this.mo.r * this.cols + this.mo.c; }
  private doorAt(a: number, b: number) { return this.doors.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }
  private passable(i: number, d: number) {
    if (!(this.open[i] & (1 << d))) return false;
    const j = this.nb(i, d), door = j >= 0 ? this.doorAt(i, j) : undefined;
    return !(door && door.locked);
  }

  private tryStep(d: number, loud: boolean) {
    const i = this.here(), j = this.nb(i, d);
    if (d === 1) this.mo.face = 1; else if (d === 3) this.mo.face = -1;
    const door = j >= 0 && this.open[i] & (1 << d) ? this.doorAt(i, j) : undefined;
    if (door && door.locked) {
      const ki = this.keys.indexOf(door.col);
      if (ki >= 0) {
        this.keys.splice(ki, 1); door.locked = false;
        this.tween(door, { open: 1 }, 0.45, ease.back);
        this.sfx("a:creak", { gain: 0.6 }); this.sfx("a:doorOpen", { gain: 0.5, delay: 0.1 });
        const p = this.cellXY(j);
        this.burst(p.x, p.y, { n: 14, colors: [KEY_COLS[door.col], "#FFFFFF"], kind: "star", speed: 220 });
        this.react("wow", this.rng.pick(["Click! It's open!", "Door, be gone!", "Key power!"]), false);
      } else {
        this.bumpWall(d, loud);
        if (loud) { this.hint(`Find the ${door.col ? "blue" : "gold"} key to open this door! 🔑`); this.react("sad", "It's locked! I need a key!"); }
        return false;
      }
    }
    if (!this.passable(i, d)) { this.bumpWall(d, loud); return false; }
    const m = this.mo;
    m.fr = m.r; m.fc = m.c; m.r += DY[d]; m.c += DX[d]; m.u = 0; this.lastDir = d;
    this.sfx("hop", { gain: 0.18, rate: 1.2 + Math.random() * 0.25 });
    return true;
  }

  private bumpWall(d: number, loud: boolean) {
    this.run = -1;
    if (!loud) return;
    this.mo.bump = 1; this.mo.bdir = d;
    this.sfx("a:bonk", { gain: 0.3, rate: 1.3 });
  }

  private arrive() {
    const i = this.here(), p = this.cellXY(i), m = this.mo;
    m.squash = 1;
    for (const it of this.items) {
      if (it.got || it.cell !== i) continue;
      it.got = true;
      if (it.kind === "cookie") {
        this.eaten++; m.chew = 1;
        this.sfx("a:crunch", { x: p.x, gain: 0.7, rate: 0.9 + Math.random() * 0.25 });
        this.good(p.x, p.y - this.maze.cs * 0.4, 30);
        this.burst(p.x, p.y, { n: 12, colors: ["#C98A4B", "#7B4A2E", "#FFD8A8"], kind: "dot", speed: 160, size: 4 });
        if (this.eaten === this.cookies) { this.react("happy", "All the cookies! Now the flag!"); this.hint("All cookies munched! Run to the flag 🚩"); }
        else if (this.eaten % 3 === 0) this.react("happy", this.rng.pick(["Nom nom nom!", "Crunchy!", "Cookie power!", "More please!"]), false);
        else this.hint(`Cookies ${this.eaten}/${this.cookies} 🍪`);
      } else {
        this.keys.push(it.col);
        this.sfx("a:chime", { x: p.x, gain: 0.7 });
        this.burst(p.x, p.y, { n: 14, colors: [KEY_COLS[it.col], "#FFFFFF"], kind: "star", speed: 220 });
        this.float("KEY!", p.x, p.y - 20, KEY_COLS[it.col], 26);
        this.react("wow", this.rng.pick(["A key! Shiny!", "Got the key!", "Ooh, what does this open?"]));
      }
    }
    if (i === this.exit) { this.finish(); return; }
    // keep running along a corridor
    if (this.run >= 0) {
      const outs = [0, 1, 2, 3].filter((d) => this.passable(i, d));
      const back = (this.lastDir + 2) % 4;
      const fwd = outs.filter((d) => d !== back);
      if (outs.length === 2 && fwd.length === 1) this.run = fwd[0];
      else if (!(outs.length <= 2 && fwd.includes(this.run))) this.run = -1;
    }
  }

  private finish() {
    this.phase = "done"; this.run = -1; this.held = -1; this.timerBar(null);
    const all = this.eaten === this.cookies;
    const timeBonus = Math.round(clamp(1 - (this.t - this.startT) / Math.max(10, this.budget * (this.timed ? 1 : 1.6)), 0, 1) * (60 + this.level * 6));
    this.sfx("a:cheer", { gain: 0.6 }); this.sfx("v:momo_laugh", { gain: 0.7, delay: 0.3 });
    const p = this.cellXY(this.exit);
    this.burst(p.x, p.y, { n: 24, colors: ["#FFD25A", "#FF6F91", "#7CF2C9", "#FFFFFF"], kind: "star", speed: 300 });
    this.react("happy", all ? this.rng.pick(["Every cookie! Burp!", "Tummy full, flag found!", "Best maze ever!"]) : this.rng.pick(["Made it!", "Flag found!", "Wheee, the exit!"]));
    this.levelClear({ perfect: all, bonus: timeBonus + this.eaten * 5 + (this.kr && this.caught === 0 ? 50 : 0), title: all ? "ALL MUNCHED!" : this.rng.pick(["EXIT FOUND!", "MAZE DONE!", "YOU MADE IT!"]) });
  }

  private caughtByKranky() {
    const m = this.mo, p = this.moPos();
    this.caught++;
    this.sfx("a:bonk", { gain: 0.8 }); this.sfx("v:kranky_laugh", { gain: 0.7, delay: 0.15 }); this.sfx("a:poof", { gain: 0.6, delay: 0.3 });
    if (this.kr) this.kr.laugh = 1.2;
    this.bad(p.x, p.y, { line: this.rng.pick(["Eek! Kranky got me!", "Back to the start?!", "Pinchy pinch! Owie!"]) });
    this.burst(p.x, p.y, { n: 16, colors: ["#FFFFFF", "#E4DEEF"], kind: "dot", speed: 200, size: 8 });
    const s = this.home;
    m.r = m.fr = Math.floor(s / this.cols); m.c = m.fc = s % this.cols; m.u = 1; m.inv = 1.6;
    this.run = -1; this.queued = -1;
    const q = this.cellXY(s);
    this.after(0.05, () => this.burst(q.x, q.y, { n: 14, colors: ["#FFFFFF", "#FFD25A"], kind: "star", speed: 160 }));
  }

  // ------------------------------------------------------------ update
  private cellXY(i: number) { const M = this.maze; return { x: M.x + ((i % this.cols) + 0.5) * M.cs, y: M.y + (Math.floor(i / this.cols) + 0.5) * M.cs }; }
  private moPos() {
    const M = this.maze, m = this.mo, u = ease.inOut(clamp(m.u, 0, 1));
    return { x: M.x + (lerp(m.fc, m.c, u) + 0.5) * M.cs, y: M.y + (lerp(m.fr, m.r, u) + 0.5) * M.cs };
  }
  private krPos() {
    const k = this.kr!, i0 = Math.floor(k.p), i1 = Math.min(k.path.length - 1, i0 + 1), u = k.p - i0;
    const a = this.cellXY(k.path[i0]), b = this.cellXY(k.path[i1]);
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), dir: Math.sign(b.x - a.x) * k.v };
  }

  protected update(dt: number) {
    const m = this.mo;
    m.squash = Math.max(0, m.squash - dt * 4); m.bump = Math.max(0, m.bump - dt * 4); m.chew = Math.max(0, m.chew - dt * 2); m.inv = Math.max(0, m.inv - dt);
    for (let d = 0; d < 4; d++) this.pad.press[d] = Math.max(this.held === d ? 0.8 : 0, this.pad.press[d] - dt * 5);
    if (this.kr) {
      const k = this.kr;
      k.laugh = Math.max(0, k.laugh - dt);
      if (this.phase === "play") {
        k.p += k.v * k.speed * dt * (k.laugh > 0 ? 0.3 : 1);
        if (k.p >= k.path.length - 1) { k.p = k.path.length - 1; k.v = -1; }
        if (k.p <= 0) { k.p = 0; k.v = 1; }
      }
    }
    if (this.phase !== "play") return;
    if (m.u < 1) {
      m.u = Math.min(1, m.u + dt / this.stepT);
      if (m.u >= 1) this.arrive();
      if (this.phase !== "play") return;
    }
    if (m.u >= 1) {
      if (this.queued >= 0) { const d = this.queued; this.queued = -1; if (!this.tryStep(d, true)) this.run = -1; }
      else if (this.held >= 0) this.tryStep(this.held, false);
      else if (this.run >= 0) this.tryStep(this.run, false);
    }
    if (this.kr && m.inv <= 0) {
      const a = this.moPos(), b = this.krPos();
      if (Math.hypot(a.x - b.x, a.y - b.y) < this.maze.cs * 0.62) this.caughtByKranky();
    }
    if (this.timed) {
      const v = Math.round(clamp(1 - (this.t - this.startT) / this.budget, 0, 1) * 60) / 60;
      if (v !== this.lastBar) {
        this.lastBar = v; this.timerBar(v, v > 0.3 ? "#7CF2C9" : "#FF6F91");
        if (v > 0 && v <= 0.2 && Math.round(v * 60) % 6 === 0) this.sfx("a:tickHi", { gain: 0.4 });
        if (Math.abs(v - 0.25) < 0.01) this.react("wow", "Hurry! The clock!");
      }
      if (v <= 0) { this.phase = "done"; this.timerBar(null); this.sfx("a:squeak", { gain: 0.6 }); this.levelFail("Time's up! ⏰"); }
    }
  }

  // ------------------------------------------------------------ drawing
  private drawBg(g: G) {
    const W = this.W, H = this.H, th = this.theme;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, th.bg[0]); gr.addColorStop(1, th.bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const x = ((i * 0.37 + this.t * 0.01 * (1 + (i % 3))) % 1.2) * W - W * 0.1, y = H * (0.08 + ((i * 0.53) % 1) * 0.85);
      blob(g, x, y, 40 + (i % 3) * 14, 16 + (i % 2) * 6, lighten(th.bg[1], 0.5), { gloss: 0.2 });
    }
  }

  private renderMaze() {
    const M = this.maze, th = this.theme, cs = M.cs, pad = cs * 0.6;
    const c = document.createElement("canvas"), k = Math.min(2, this.dpr);
    c.width = Math.ceil((M.w + pad * 2) * k); c.height = Math.ceil((M.h + pad * 2) * k);
    const g = c.getContext("2d")!;
    g.scale(k, k); g.translate(pad, pad);
    // floor
    rr(g, -cs * 0.12, -cs * 0.12, M.w + cs * 0.24, M.h + cs * 0.24, cs * 0.3); g.fillStyle = th.floor; g.fill();
    for (let r = 0; r < this.rows; r++) for (let q = 0; q < this.cols; q++) if ((r + q) % 2) { g.fillStyle = th.floor2; g.fillRect(q * cs, r * cs, cs, cs); }
    // walls as fat clay noodles
    const segs: [number, number, number, number][] = [];
    for (let r = 0; r < this.rows; r++) for (let q = 0; q < this.cols; q++) {
      const i = r * this.cols + q, o = this.open[i];
      if (!(o & 1)) segs.push([q, r, q + 1, r]);
      if (!(o & 8)) segs.push([q, r, q, r + 1]);
      if (r === this.rows - 1 && !(o & 4)) segs.push([q, r + 1, q + 1, r + 1]);
      if (q === this.cols - 1 && !(o & 2)) segs.push([q + 1, r, q + 1, r + 1]);
    }
    const ww = Math.max(5, cs * 0.24);
    const pass = (col: string, w: number, dy: number) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
      g.beginPath();
      for (const [x0, y0, x1, y1] of segs) { g.moveTo(x0 * cs, y0 * cs + dy); g.lineTo(x1 * cs, y1 * cs + dy); }
      g.stroke();
    };
    pass("rgba(30,10,40,0.25)", ww + 2, ww * 0.45);
    pass(darken(th.wall, 0.25), ww + 1, ww * 0.18);
    pass(th.wall, ww, 0);
    pass(rgba(lighten(th.wall, 0.55), 0.8), ww * 0.32, -ww * 0.18);
    this.cache = c;
  }

  private drawMaze(g: G) {
    const M = this.maze;
    if (!this.cache) this.renderMaze();
    const pad = M.cs * 0.6;
    clayPanel(g, M.x - pad * 0.55, M.y - pad * 0.55, M.w + pad * 1.1, M.h + pad * 1.1 + 8, M.cs * 0.4, darken(this.theme.wall, 0.1), { lip: 8 });
    g.drawImage(this.cache!, M.x - pad, M.y - pad, M.w + pad * 2, M.h + pad * 2);
  }

  private drawItems(g: G) {
    const cs = this.maze.cs;
    // exit flag
    const e = this.cellXY(this.exit);
    const gl = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, cs * 0.6); gl.addColorStop(0, "rgba(255,240,140,0.8)"); gl.addColorStop(1, "rgba(255,240,140,0)");
    g.fillStyle = gl; g.fillRect(e.x - cs, e.y - cs, cs * 2, cs * 2);
    shadow(g, e.x, e.y + cs * 0.32, cs * 0.25, cs * 0.07, 0.35);
    g.strokeStyle = "#7B4A2E"; g.lineWidth = Math.max(2, cs * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(e.x - cs * 0.15, e.y + cs * 0.32); g.lineTo(e.x - cs * 0.15, e.y - cs * 0.38); g.stroke();
    const fw = cs * 0.42, fh = cs * 0.3, fx = e.x - cs * 0.13, fy = e.y - cs * 0.38;
    for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) {
      const x0 = fx + (q * fw) / 3, wav = Math.sin(this.t * 6 - q) * cs * 0.03;
      g.fillStyle = (r + q) % 2 ? "#FFFFFF" : "#E8504F"; g.fillRect(x0, fy + (r * fh) / 2 + wav, fw / 3 + 0.5, fh / 2 + 0.5);
    }
    blob(g, e.x - cs * 0.15, e.y - cs * 0.4, cs * 0.06, cs * 0.06, "#FFD25A", { gloss: 0.6 });
    // doors
    for (const d of this.doors) {
      if (d.open >= 0.99) continue;
      const a = this.cellXY(d.a), b = this.cellXY(d.b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const s = 1 - d.open, horiz = d.d === 1 || d.d === 3;
      g.save(); g.translate(mx, my); g.scale(s, s); g.rotate(d.open * 2);
      const w = horiz ? cs * 0.26 : cs * 0.9, h = horiz ? cs * 0.9 : cs * 0.26;
      rr(g, -w / 2, -h / 2, w, h, cs * 0.08); g.fillStyle = darken(KEY_COLS[d.col], 0.35); g.fill();
      rr(g, -w / 2, -h / 2 - 2, w, h, cs * 0.08); g.fillStyle = KEY_COLS[d.col]; g.fill();
      blob(g, 0, 0, cs * 0.15, cs * 0.15, "#FFF4E2", { gloss: 0.4 });
      g.fillStyle = "#3A2A20"; g.beginPath(); g.arc(0, -cs * 0.03, cs * 0.045, 0, Math.PI * 2); g.fill(); g.fillRect(-cs * 0.02, -cs * 0.03, cs * 0.04, cs * 0.09);
      g.restore();
    }
    for (const it of this.items) {
      if (it.got) continue;
      const p = this.cellXY(it.cell), bob = Math.sin(this.t * 3 + it.ph) * cs * 0.05;
      shadow(g, p.x, p.y + cs * 0.25, cs * 0.2, cs * 0.06, 0.3);
      if (it.kind === "cookie") this.drawCookie(g, p.x, p.y + bob, cs * 0.24, it.ph);
      else this.drawKey(g, p.x, p.y + bob, cs * 0.3, KEY_COLS[it.col], Math.sin(this.t * 2 + it.ph) * 0.3);
    }
  }

  private drawCookie(g: G, x: number, y: number, r: number, ph: number) {
    blob(g, x, y, r, r * 0.92, "#D9A066", { gloss: 0.4, rot: ph });
    for (let i = 0; i < 5; i++) blob(g, x + Math.cos(i * 1.3 + ph) * r * 0.5, y + Math.sin(i * 1.9 + ph) * r * 0.45, r * 0.14, r * 0.13, "#5A3420", { gloss: 0.2 });
  }

  private drawKey(g: G, x: number, y: number, s: number, col: string, rot: number) {
    g.save(); g.translate(x, y); g.rotate(rot - 0.6);
    const gl = g.createRadialGradient(0, 0, 0, 0, 0, s * 1.4); gl.addColorStop(0, rgba(col, 0.5)); gl.addColorStop(1, rgba(col, 0));
    g.fillStyle = gl; g.fillRect(-s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
    g.strokeStyle = darken(col, 0.3); g.lineWidth = s * 0.26; g.lineCap = "round";
    g.beginPath(); g.moveTo(-s * 0.2, 0); g.lineTo(s * 0.9, 0); g.moveTo(s * 0.6, 0); g.lineTo(s * 0.6, s * 0.3); g.moveTo(s * 0.85, 0); g.lineTo(s * 0.85, s * 0.25); g.stroke();
    g.strokeStyle = col; g.lineWidth = s * 0.16;
    g.beginPath(); g.moveTo(-s * 0.2, 0); g.lineTo(s * 0.9, 0); g.stroke();
    g.beginPath(); g.arc(-s * 0.45, 0, s * 0.35, 0, Math.PI * 2); g.lineWidth = s * 0.22; g.strokeStyle = darken(col, 0.2); g.stroke();
    g.beginPath(); g.arc(-s * 0.45, 0, s * 0.35, 0, Math.PI * 2); g.lineWidth = s * 0.13; g.strokeStyle = lighten(col, 0.2); g.stroke();
    g.restore();
  }

  private drawMomo(g: G) {
    const m = this.mo, p = this.moPos(), cs = this.maze.cs;
    const hop = Math.sin(Math.PI * clamp(m.u, 0, 1)) * cs * 0.22;
    if (m.inv > 0 && Math.floor(m.inv * 10) % 2 === 0) return;
    const bx = m.bump > 0 ? DX[m.bdir] * Math.sin(m.bump * Math.PI) * cs * 0.12 : 0, by = m.bump > 0 ? DY[m.bdir] * Math.sin(m.bump * Math.PI) * cs * 0.12 : 0;
    const sq = Math.sin(m.squash * Math.PI) * 0.16 * m.squash + m.chew * Math.sin(this.t * 30) * 0.05;
    shadow(g, p.x, p.y + cs * 0.36, cs * 0.3 * (1 - hop / cs), cs * 0.08, 0.35);
    const mood = this.phase === "play" && this.hud.host.mood === "sad" ? "sad" : m.chew > 0.3 ? "wow" : "happy";
    this.sprite(g, spriteUrl("momo", mood), p.x + bx, p.y + cs * 0.42 - hop + by, cs * 1.18, { flip: m.face < 0, sx: 1 + sq, sy: 1 - sq, rot: (m.u < 1 ? 0.12 : 0) * m.face });
  }

  private drawKranky(g: G) {
    if (!this.kr) return;
    const p = this.krPos(), cs = this.maze.cs, k = this.kr;
    shadow(g, p.x, p.y + cs * 0.34, cs * 0.34, cs * 0.08, 0.35);
    this.sprite(g, k.laugh > 0 ? KRANKY_LAUGH : KRANKY, p.x, p.y + cs * 0.42 + Math.abs(Math.sin(this.t * 9)) * -cs * 0.06, cs * 0.95, { flip: p.dir < 0, rot: Math.sin(this.t * 9) * 0.08 });
  }

  private drawFog(g: G) {
    if (!this.fog) return;
    const M = this.maze, p = this.moPos(), cs = M.cs, pad = cs * 0.75;
    const r0 = cs * (this.fog - 0.8), r1 = cs * (this.fog + 0.4);
    const fg = g.createRadialGradient(p.x, p.y, Math.max(1, r0), p.x, p.y, r1);
    fg.addColorStop(0, "rgba(26,14,52,0)"); fg.addColorStop(1, "rgba(26,14,52,0.92)");
    g.save(); rr(g, M.x - cs * 0.33, M.y - cs * 0.33, M.w + cs * 0.66, M.h + cs * 0.66 + 4, cs * 0.3); g.clip();
    g.fillStyle = fg; g.fillRect(M.x - pad, M.y - pad, M.w + pad * 2, M.h + pad * 2 + 8);
    g.restore();
    // the flag beacon twinkles through the fog
    const e = this.cellXY(this.exit);
    if (Math.hypot(e.x - p.x, e.y - p.y) > r1 * 0.9) star(g, e.x, e.y, cs * (0.2 + 0.05 * Math.sin(this.t * 5)), "#FFD25A", this.t);
  }

  private drawPad(g: G) {
    const P = this.pad;
    for (let d = 0; d < 4; d++) {
      const x = P.x + DX[d] * P.b * 1.02, y = P.y + DY[d] * P.b * 1.02, pr = this.pad.press[d];
      g.save(); g.globalAlpha = this.phase === "play" || this.hud.status !== "playing" ? 1 : 0.6;
      clayPanel(g, x - P.b / 2, y - P.b / 2, P.b, P.b + 6, P.b * 0.3, "#FFFFFF", { lip: 6, pressed: pr });
      g.translate(x, y - 3 + pr * 5); g.rotate((d * Math.PI) / 2);
      const s = P.b * 0.22;
      g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.95, s * 0.6); g.lineTo(-s * 0.95, s * 0.6); g.closePath();
      g.fillStyle = "#FF8A3D"; g.fill(); g.strokeStyle = darken("#FF8A3D", 0.3); g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
      g.restore();
    }
    blob(g, P.x, P.y, P.b * 0.32, P.b * 0.32, "#FFD8A8", { gloss: 0.4 });
  }

  private drawInfo(g: G) {
    if (this.hud.status !== "playing") return;
    const portrait = this.W < this.H * 1.05;
    const x = this.info.x, y = this.info.y;
    const cr = portrait ? 16 : 20;
    if (portrait) {
      this.drawCookie(g, x + cr, y - 14, cr, 0.3);
      clayText(g, `${this.eaten}/${this.cookies}`, x + cr * 2 + 8, y - 14, 22, { fill: "#FFFFFF", align: "left" });
      this.keys.forEach((k, i) => this.drawKey(g, x + cr + i * 34, y + 30, 13, KEY_COLS[k], 0.6));
    } else {
      this.drawCookie(g, x + cr, y, cr, 0.3);
      clayText(g, `${this.eaten}/${this.cookies}`, x + cr * 2 + 10, y, 26, { fill: "#FFFFFF", align: "left" });
      this.keys.forEach((k, i) => this.drawKey(g, x + cr + i * 40, y + 50, 15, KEY_COLS[k], 0.6));
    }
  }

  protected drawBackground(g: G) {
    if (!this.open.length) {
      this.layout();
      this.build(new Rng(2024), 6, 0, false, 6);
      this.mo = { ...this.mo, r: 0, c: 0, fr: 0, fc: 0, u: 1 };
    }
    this.drawBg(g);
    this.drawMaze(g);
    this.drawItems(g);
    this.drawMomo(g);
    this.drawPad(g);
  }

  protected draw(g: G) {
    this.drawBg(g);
    this.drawMaze(g);
    this.drawItems(g);
    this.drawKranky(g);
    this.drawMomo(g);
    this.drawFog(g);
    this.drawPad(g);
    this.drawInfo(g);
  }
}
