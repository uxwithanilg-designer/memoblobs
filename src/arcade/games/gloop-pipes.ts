// Gloop Pipes — tap the clay pipes to turn them so Gloop's slime flows from the tank into every cup.
// Unlimited levels: 3×3 → 8×8 boards, more cups, bolted pipes, side cups, NO LEAKS and overflow timers.
import { ArcadeGame, Recent, byDiff, clamp, ease, Rng, type GameMeta, type Tone } from "../engine";
import { blob, clayFill, clayPanel, clayText, darken, eye, lighten, mouth, rgba, rr, shadow, type G } from "../paint";

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const rot = (m: number, k: number) => { k = ((k % 4) + 4) % 4; for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
const bitCount = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
const SLIME = "#8BE04A", SLIME_HI = "#D2F79A", SLIME_DK = "#3E9A2A";
const PIPE = "#FFF1DC", PIPE_DK = "#B98E6A";
const CUP_COLS = ["#FF8FB1", "#FFD25A", "#B7A2E8", "#7CC8FF", "#FF8A3D"];

interface Pipe { sol: number; rc: number; ang: number; locked: boolean; fill: number; pop: number; wig: number; path: boolean }
interface Cup { cell: number; dir: number; level: number; done: boolean; bob: number; col: string }
interface Flow { conn: boolean[]; parent: number[]; leaks: [number, number][]; cups: boolean[]; closed: boolean; count: number }
type Phase = "intro" | "play" | "win" | "out";

export default class GloopPipes extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "gloop-pipes", title: "Gloop Pipes", host: "gloop", style: "rounds",
    music: { calm: "a:pipes_calm", action: "a:pipes_action" },
    sounds: ["a:click", "a:slosh", "a:bubble", "a:bubbles", "a:drip", "a:clunk", "a:cheer", "a:gulp", "a:squelch", "a:splash", "a:buzz", "a:creak", "v:gloop_laugh"],
    voicePitch: 1.1, transition: "iris",
  };
  private n = 3;
  private pipes: Pipe[] = [];
  private cups: Cup[] = [];
  private root = 0;
  private flow: Flow = { conn: [], parent: [], leaks: [], cups: [], closed: false, count: 0 };
  private phase: Phase = "intro";
  private par = 0; private taps = 0; private noLeak = false; private timed = false;
  private budget = 0; private startT = 0; private lastBar = -1;
  private cur = { r: 0, c: 0, on: false };
  private grid = { x: 0, y: 0, s: 300, cs: 100 };
  private tank = { x: 0, y: 0, w: 80, h: 80, slosh: 0 };
  private gloop = { x: 0, y: 0, h: 100, bop: 0, flip: false };
  private side = false;
  private lastCount = 0; private dripT = 0; private winT = 0; private leakNag = 0;
  private recent = new Recent(24);
  private prevN = 0; private prevCups = 0;
  private wall?: HTMLCanvasElement;

  protected onResize() { this.layout(); this.wall = undefined; }

  private layout() {
    const A = this.area, portrait = this.W < this.H * 1.05;
    const n = this.n;
    const tankH = clamp(A.h * 0.14, 64, 120), cupH = clamp(A.h * 0.12, 56, 100);
    const sideW = this.side ? clamp(this.W * 0.1, 40, 70) : 0;
    let s: number;
    if (portrait) s = Math.min(this.W - 20 - sideW * 2, A.h - tankH - cupH - 16, 640);
    else s = Math.min(A.h - tankH - cupH - 16, this.W * 0.5 - sideW * 2, 640);
    const cs = s / n;
    const gx = (this.W - s) / 2, gy = A.y + tankH + 6 + Math.max(0, (A.h - tankH - cupH - 16 - s) * 0.45);
    this.grid = { x: gx, y: gy, s, cs };
    const rc = this.root % n;
    const tw = clamp(Math.max(cs * 1.25, tankH * 0.95), 60, 130);
    const th = Math.min(tankH - 8, tw * 1.05);
    const colX = gx + (rc + 0.5) * cs;
    this.tank = { ...this.tank, x: clamp(colX, tw / 2 + 8, this.W - tw / 2 - 8), y: gy - 8 - th, w: tw, h: th };
    if (portrait) {
      const l0 = 6, l1 = this.tank.x - tw / 2 - 6, r0 = this.tank.x + tw / 2 + 6, r1 = this.W - 6;
      const onLeft = l1 - l0 > r1 - r0;
      const segW = onLeft ? l1 - l0 : r1 - r0;
      const gh = clamp(Math.min(gy - A.y + 4, segW / 1.75, 130), 44, 130);
      this.gloop = { ...this.gloop, h: gh, x: onLeft ? (l0 + l1) / 2 : (r0 + r1) / 2, y: gy - 4, flip: !onLeft };
    } else {
      const gh = clamp(Math.min(gx * 0.8, A.h * 0.36), 90, 240);
      this.gloop = { ...this.gloop, h: gh, x: gx / 2, y: A.y + A.h - 8, flip: false };
    }
  }

  private nb(i: number, d: number) {
    const n = this.n, r = Math.floor(i / n) + DY[d], c = (i % n) + DX[d];
    return r < 0 || c < 0 || r >= n || c >= n ? -1 : r * n + c;
  }
  private mask(i: number) { const p = this.pipes[i]; return rot(p.sol, p.rc); }
  private need(p: Pipe) { for (let t = 0; t < 4; t++) if (rot(p.sol, p.rc + t) === p.sol) return t; return 0; }
  private isPort(i: number, d: number) { return (i === this.root && d === 0) || this.cups.some((c) => c.cell === i && c.dir === d); }
  private cellCenter(i: number) { const G0 = this.grid, n = this.n; return { x: G0.x + ((i % n) + 0.5) * G0.cs, y: G0.y + (Math.floor(i / n) + 0.5) * G0.cs }; }
  private cupPos(cp: Cup) {
    const G0 = this.grid, n = this.n, r = Math.floor(cp.cell / n), c = cp.cell % n;
    const w = clamp(G0.cs * 0.8, 38, 70), h = w * 1.05;
    if (cp.dir === 2) return { x: G0.x + (c + 0.5) * G0.cs, y: G0.y + G0.s + 14 + h / 2, w, h };
    const sw = clamp(this.W * 0.1, 40, 70) * 0.9, sh = sw * 1.05;
    return { x: cp.dir === 1 ? G0.x + G0.s + 10 + sw / 2 : G0.x - 10 - sw / 2, y: G0.y + (r + 0.5) * G0.cs + sh * 0.25, w: sw, h: sh };
  }

  // ------------------------------------------------------------ levels
  private computeFlow(): Flow {
    const N = this.pipes.length, m = this.pipes.map((_, i) => this.mask(i));
    const conn = new Array<boolean>(N).fill(false), parent = new Array<number>(N).fill(-1);
    let count = 0;
    if (m[this.root] & 1) {
      conn[this.root] = true; count = 1;
      const q = [this.root];
      while (q.length) {
        const i = q.shift()!;
        for (let d = 0; d < 4; d++) {
          if (!(m[i] & (1 << d))) continue;
          const j = this.nb(i, d);
          if (j >= 0 && !conn[j] && m[j] & (1 << ((d + 2) % 4))) { conn[j] = true; parent[j] = i; count++; q.push(j); }
        }
      }
    }
    const leaks: [number, number][] = [];
    let closed = true;
    for (let i = 0; i < N; i++) for (let d = 0; d < 4; d++) {
      if (!(m[i] & (1 << d))) continue;
      const j = this.nb(i, d);
      const ok = j < 0 ? this.isPort(i, d) : !!(m[j] & (1 << ((d + 2) % 4)));
      if (!ok) { closed = false; if (conn[i]) leaks.push([i, d]); }
    }
    const cups = this.cups.map((c) => conn[c.cell] && !!(m[c.cell] & (1 << c.dir)));
    return { conn, parent, leaks, cups, closed, count };
  }

  /** spanning tree from the tank → pipes; cups hang off border cells; rotations randomised (always solvable) */
  private build(rng: Rng, n: number, nCups: number, side: boolean, nLocked: number, noLeak: boolean, minPar: number) {
    this.n = n; this.side = side;
    const N = n * n;
    this.root = rng.int(0, n - 1);
    const bottom = Array.from({ length: n }, (_, c) => ({ cell: (n - 1) * n + c, dir: 2 }));
    const sides: { cell: number; dir: number }[] = [];
    if (side) for (let r = 1; r < n - 1; r++) sides.push({ cell: r * n, dir: 3 }, { cell: r * n + n - 1, dir: 1 });
    const picks: { cell: number; dir: number }[] = [];
    const pool = [...rng.shuffle(sides).slice(0, side ? 1 + (nCups > 2 ? 1 : 0) : 0), ...rng.shuffle(bottom)];
    // prefer bottom cups away from the tank column
    for (const p of pool) {
      if (picks.length >= nCups) break;
      if (picks.some((q) => q.cell === p.cell || (q.dir === p.dir && q.dir !== 2 && Math.abs(Math.floor(q.cell / n) - Math.floor(p.cell / n)) < 2))) continue;
      if (p.dir === 2 && nCups === 1 && n > 3 && Math.abs((p.cell % n) - this.root) < 1 && rng.chance(0.7)) continue;
      picks.push(p);
    }
    while (picks.length < nCups) { const p = bottom.find((b) => !picks.some((q) => q.cell === b.cell))!; picks.push(p); }
    this.cups = picks.map((p, k) => ({ ...p, level: 0, done: false, bob: 0, col: CUP_COLS[(k + this.level) % CUP_COLS.length] }));
    // growing-tree spanning tree from the root
    const sol = new Array<number>(N).fill(0), inTree = new Array<boolean>(N).fill(false), par = new Array<number>(N).fill(-1);
    const active = [this.root]; inTree[this.root] = true;
    while (active.length) {
      const idx = rng.chance(0.72) ? active.length - 1 : rng.int(0, active.length - 1);
      const i = active[idx];
      const opts = [0, 1, 2, 3].filter((d) => { const j = this.nb(i, d); return j >= 0 && !inTree[j]; });
      if (!opts.length) { active.splice(idx, 1); continue; }
      const d = rng.pick(opts), j = this.nb(i, d);
      sol[i] |= 1 << d; sol[j] |= 1 << ((d + 2) % 4); inTree[j] = true; par[j] = i; active.push(j);
    }
    sol[this.root] |= 1;
    for (const cp of this.cups) sol[cp.cell] |= 1 << cp.dir;
    const path = new Array<boolean>(N).fill(false);
    for (const cp of this.cups) { let i = cp.cell; while (i >= 0) { path[i] = true; i = par[i]; } }
    // bolts: half on the slime path (as clues), never on crosses
    const lockable = rng.shuffle(Array.from({ length: N }, (_, i) => i).filter((i) => bitCount(sol[i]) < 4));
    const locked = new Set<number>(lockable.slice(0, nLocked));
    this.pipes = sol.map((s, i) => ({ sol: s, rc: locked.has(i) ? 0 : rng.int(0, 3), ang: 0, locked: locked.has(i), fill: 0, pop: 0, wig: 0, path: path[i] }));
    const relevant = (i: number) => !this.pipes[i].locked && (noLeak || this.pipes[i].path);
    const parNow = () => this.pipes.reduce((a, p, i) => a + (relevant(i) ? this.need(p) : 0), 0);
    const turnable = this.pipes.map((p, i) => i).filter((i) => relevant(i) && bitCount(this.pipes[i].sol) < 4);
    const want = Math.min(minPar, turnable.length);
    let guard = 0;
    while (parNow() < want && guard++ < 200) {
      const i = rng.pick(turnable), p = this.pipes[i], nd = this.need(p);
      if (nd === 0 || (nd === 1 && guard > 60 && rot(p.sol, 2) !== p.sol)) p.rc = (p.rc + 3) % 4;
    }
    this.flow = this.computeFlow();
    if (this.flow.cups.every(Boolean) && (!noLeak || this.flow.closed)) { const i = turnable[0] ?? this.root; this.pipes[i].rc = (this.pipes[i].rc + 1) % 4; this.flow = this.computeFlow(); }
    for (const p of this.pipes) { p.rc = p.rc % 4; p.ang = (p.rc * Math.PI) / 2; }
    this.par = parNow();
    return `${n}:${this.root}:${this.cups.map((c) => c.cell + "/" + c.dir).join(",")}:${sol.join(",")}`;
  }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    const n = Math.min(8, byDiff(d, { easy: 3 + Math.floor((L - 1) / 4), medium: 3 + Math.floor((L - 1) / 3), hard: 4 + Math.floor((L - 1) / 3) }));
    let nCups = byDiff(d, { easy: L < 6 ? 1 : L < 12 ? 2 : 3, medium: L < 4 ? 1 : L < 9 ? 2 : 3, hard: L < 2 ? 1 : L < 6 ? 2 : 3 });
    nCups = Math.min(nCups, n);
    const lockStart = byDiff(d, { easy: 8, medium: 5, hard: 3 });
    const lockOn = L >= lockStart && (L % 2 === 0 || L >= lockStart + 10);
    const nLocked = lockOn ? Math.min(Math.floor(n * n * 0.25), 1 + Math.floor((L - lockStart) / 3) + Math.floor(n / 3)) : 0;
    const leakStart = byDiff(d, { easy: 14, medium: 9, hard: 6 });
    this.noLeak = L >= leakStart && (L % 3 === 1 || L >= leakStart + 12 && L % 3 !== 2);
    const sideStart = byDiff(d, { easy: 18, medium: 12, hard: 8 });
    const side = L >= sideStart && L % 2 === 1 && n <= 6;
    const timeStart = byDiff(d, { easy: 999, medium: 15, hard: 9 });
    this.timed = L >= timeStart && L % 4 === 3;
    const minPar = Math.round(byDiff(d, { easy: 2 + L * 0.8, medium: 3 + L, hard: 4 + L * 1.2 }));
    let sig = "";
    for (let k = 0; k < 20; k++) { sig = this.build(this.rng, n, nCups, side, nLocked, this.noLeak, minPar); if (!this.recent.has(sig)) break; }
    this.recent.add(sig);
    this.layout(); this.wall = undefined;
    this.taps = 0; this.phase = "intro"; this.lastCount = 0; this.winT = 0; this.leakNag = 0; this.lastBar = -1;
    this.cur = { r: 0, c: 0, on: this.cur.on };
    this.pipes.forEach((p, i) => { const r = Math.floor(i / n), c = i % n; this.tween(p, { pop: 1 }, 0.35, ease.back, 0.05 + (r + c) * 0.035); });
    this.budget = this.timed ? Math.round(this.par * byDiff(d, { easy: 3, medium: 2.6, hard: 2.1 }) + n * 2 + 10) : 0;
    this.timerBar(null);
    this.music(this.timed || n >= 7 || this.noLeak ? "action" : "calm");
    const twists: [string, string, Tone][] = [];
    if (this.prevN && n > this.prevN) twists.push(["BIGGER BOARD!", `${n}×${n} pipes`, "mint"]);
    if (this.prevCups && nCups > this.prevCups) twists.push(["MORE CUPS!", `Fill all ${nCups} cups`, "gold"]);
    if (nLocked) twists.push(["BOLTED PIPES!", "Bolted pipes can't turn", "navy"]);
    if (side) twists.push(["SIDE CUPS!", "Cups on the sides too", "pink"]);
    if (this.noLeak) twists.push(["NO LEAKS!", "Every pipe end must connect", "red"]);
    if (this.timed) twists.push(["OVERFLOW!", `Beat the clock: ${this.budget}s`, "red"]);
    this.prevN = n; this.prevCups = nCups;
    twists.forEach((t, i) => this.after(0.45 + i * 1.6, () => this.banner(t[0], t[1], t[2])));
    this.sfx("a:gulp", { gain: 0.5, delay: 0.3 });
    this.react("wow", this.rng.pick(["Glorp! My slime is stuck!", "Fix my pipes, pal!", "Slime time! Turn the pipes!", "My cups are thirsty!", "Gloopy pipes go round!"]));
    this.hint(L === 1 ? "Tap a pipe to turn it. Get the slime to the cup! 🟢" : this.noLeak ? "No leaks! Every pipe end must join up 💧" : `Fill ${nCups > 1 ? `all ${nCups} cups` : "the cup"} with slime · par ${this.par} turns`);
    this.after(0.4 + Math.min(twists.length, 2) * 0.5, () => { this.phase = "play"; this.startT = this.t; });
  }

  // ------------------------------------------------------------ input
  protected onDown(x: number, y: number) {
    if (this.phase !== "play") return;
    const G0 = this.grid, c = Math.floor((x - G0.x) / G0.cs), r = Math.floor((y - G0.y) / G0.cs);
    if (r < 0 || c < 0 || r >= this.n || c >= this.n) return;
    this.cur = { r, c, on: false };
    this.turn(r * this.n + c);
  }

  onKey(key: string) {
    if (this.phase !== "play") return;
    const k = key.toLowerCase(), n = this.n;
    const mv: Record<string, [number, number]> = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
    if (mv[k]) {
      if (!this.cur.on) { this.cur.on = true; return; }
      this.cur.r = clamp(this.cur.r + mv[k][0], 0, n - 1); this.cur.c = clamp(this.cur.c + mv[k][1], 0, n - 1);
      this.sfx("a:click", { gain: 0.15, rate: 1.6 });
      return;
    }
    if (k === "enter" || k === "x" || k === "r") { this.cur.on = true; this.turn(this.cur.r * n + this.cur.c); }
  }

  private turn(i: number) {
    const p = this.pipes[i], c = this.cellCenter(i);
    if (p.locked) {
      p.wig = 1;
      this.sfx("a:clunk", { x: c.x, gain: 0.7 });
      this.bad(c.x, c.y, { line: this.rng.pick(["That one's bolted!", "Clunk! Stuck tight!", "Can't turn bolted pipes!"]) });
      return;
    }
    p.rc++; this.taps++;
    this.tween(p, { ang: (p.rc * Math.PI) / 2 }, 0.26, ease.back);
    this.sfx("a:click", { x: c.x, gain: 0.55, rate: 0.9 + Math.random() * 0.25 });
    this.gloop.bop = 0.4;
    const before = this.flow.cups.filter(Boolean).length;
    this.flow = this.computeFlow();
    const after = this.flow.cups.filter(Boolean).length;
    if (this.flow.count > this.lastCount + 1) this.sfx("a:bubble", { x: c.x, gain: 0.45, rate: 0.9 + Math.min(this.flow.count, 30) * 0.02, delay: 0.15 });
    this.lastCount = this.flow.count;
    const all = this.flow.cups.every(Boolean);
    if (all && (!this.noLeak || this.flow.closed)) { this.win(); return; }
    if (all && this.noLeak && this.leakNag++ % 2 === 0) { this.react("wow", this.rng.pick(["Eww, it's leaking!", "Drip drip! Close the ends!", "Plug those leaks!"])); this.hint("Cups reached — now close every open pipe end 💧"); }
    else if (after > before) this.react("happy", this.rng.pick(["Slurp-tastic!", "Gloopy goodness!", "It's flowing!", "Mmm, slimy!"]), false);
    else this.hint(`Turns ${this.taps} · par ${this.par} · cups ${after}/${this.cups.length}`);
  }

  private win() {
    this.phase = "win"; this.winT = 0; this.timerBar(null);
    this.hint(null);
    this.sfx("a:bubbles", { gain: 0.6 });
    this.music("action");
  }

  private finish() {
    this.phase = "out";
    const perfect = this.taps <= this.par;
    const bonus = Math.max(0, (this.par * 2 - this.taps) * 4) + (this.noLeak ? 60 : 0) + (this.timed ? Math.round(clamp(1 - (this.t - this.startT) / this.budget, 0, 1) * 100) : 0);
    this.sfx("a:cheer", { gain: 0.7 }); this.sfx("v:gloop_laugh", { gain: 0.7, delay: 0.5 });
    this.gloop.bop = 1;
    for (const cp of this.cups) { const q = this.cupPos(cp); this.burst(q.x, q.y - q.h / 2, { n: 16, colors: [SLIME, SLIME_HI, "#FFFFFF"], kind: "drop", speed: 260 }); }
    this.react("happy", this.rng.pick(["SLIME PARTY!", "Glorp glorp hooray!", "All cups full!", "Best plumber ever!"]));
    this.after(0.5, () => this.levelClear({ perfect, bonus, title: perfect ? "PERFECT FLOW!" : this.rng.pick(["SLIMED IT!", "ALL FULL!", "GLORP-TASTIC!"]) }));
  }

  // ------------------------------------------------------------ update
  protected update(dt: number) {
    const N = this.pipes.length;
    for (let i = 0; i < N; i++) {
      const p = this.pipes[i];
      p.wig = Math.max(0, p.wig - dt * 2.5);
      const turning = Math.abs(p.ang - (p.rc * Math.PI) / 2) > 0.12;
      if (this.flow.conn[i] && !turning && this.phase !== "intro") {
        const src = i === this.root ? 1 : this.pipes[this.flow.parent[i]]?.fill ?? 0;
        if (src >= 0.6) p.fill = Math.min(1, p.fill + dt * (this.phase === "win" ? 12 : 8));
      } else p.fill = Math.max(0, p.fill - dt * (turning ? 8 : 4));
    }
    this.cups.forEach((cp, k) => {
      const ok = this.flow.cups[k] && (this.pipes[cp.cell]?.fill ?? 0) >= 0.95;
      if (ok) {
        cp.level = Math.min(1, cp.level + dt * 1.3);
        if (cp.level >= 1 && !cp.done) {
          cp.done = true; cp.bob = 1;
          const q = this.cupPos(cp);
          this.sfx("a:slosh", { x: q.x, gain: 0.75 });
          this.good(q.x, q.y - q.h * 0.6, 60);
          this.burst(q.x, q.y - q.h / 2, { n: 10, colors: [SLIME, SLIME_HI], kind: "drop", speed: 160 });
        }
      } else cp.level = Math.max(0, cp.level - dt * 0.5);
      cp.bob = Math.max(0, cp.bob - dt * 1.5);
    });
    this.tank.slosh = Math.max(0, this.tank.slosh - dt);
    this.gloop.bop = Math.max(0, this.gloop.bop - dt * 2.5);
    // leaks drip
    if (this.phase === "play" || this.phase === "win") {
      this.dripT -= dt;
      for (const [i, d] of this.flow.leaks) {
        if ((this.pipes[i]?.fill ?? 0) < 0.8 || Math.random() > dt * 2) continue;
        const c = this.cellCenter(i), h = this.grid.cs / 2;
        this.particles.push({ x: c.x + DX[d] * h, y: c.y + DY[d] * h, vx: DX[d] * 40 + (Math.random() - 0.5) * 20, vy: DY[d] * 40, life: 0.8, max: 0.8, size: 4 + Math.random() * 3, color: SLIME, kind: "drop", rot: 0, vr: 0, g: 600 });
        if (this.dripT <= 0) { this.sfx("a:drip", { x: c.x, gain: 0.25, rate: 0.9 + Math.random() * 0.3 }); this.dripT = 0.9; }
      }
    }
    if (this.phase === "win") {
      this.winT += dt;
      if ((this.cups.every((c) => c.done && c.level >= 0.98) && this.winT > 0.4) || this.winT > 6) this.finish();
    }
    if (this.phase === "play" && this.timed) {
      const v = Math.round(clamp(1 - (this.t - this.startT) / this.budget, 0, 1) * 60) / 60;
      if (v !== this.lastBar) { this.lastBar = v; this.timerBar(v, v > 0.3 ? SLIME : "#FF6F91"); if (v === 0.25) this.react("wow", "The tank is overflowing!"); }
      if (v <= 0) {
        this.phase = "out"; this.timerBar(null);
        this.sfx("a:splash", { gain: 0.8 }); this.sfx("a:squelch", { gain: 0.6, delay: 0.2 });
        this.burst(this.tank.x, this.tank.y, { n: 30, colors: [SLIME, SLIME_HI, SLIME_DK], kind: "drop", speed: 320 });
        this.levelFail("The tank overflowed!");
      }
    }
  }

  // ------------------------------------------------------------ drawing
  private drawWall(g: G) {
    const W = this.W, H = this.H;
    if (!this.wall || this.wall.width !== Math.round(W) || this.wall.height !== Math.round(H)) {
      const c = document.createElement("canvas"); c.width = Math.round(W); c.height = Math.round(H);
      const x = c.getContext("2d")!;
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#5FC7C9"); gr.addColorStop(1, "#3E9FB5");
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      const t = 44;
      for (let yy = 0; yy < H; yy += t) for (let xx = (Math.floor(yy / t) % 2) * (t / 2) - t; xx < W; xx += t) {
        rr(x, xx + 2, yy + 2, t - 4, t - 4, 8); x.fillStyle = (Math.floor(xx / t) + Math.floor(yy / t)) % 3 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)"; x.fill();
      }
      // copper pipes running down the wall at the far sides (only where there is room beside the board)
      const room = this.grid.x - 70;
      if (room > 40) for (const px of [Math.min(46, room * 0.4), W - Math.min(46, room * 0.4)]) {
        x.lineCap = "round";
        x.strokeStyle = "rgba(0,0,0,0.15)"; x.lineWidth = 26; x.beginPath(); x.moveTo(px + 6, -10); x.lineTo(px + 6, H + 10); x.stroke();
        x.strokeStyle = "#E39B5A"; x.lineWidth = 22; x.beginPath(); x.moveTo(px, -10); x.lineTo(px, H + 10); x.stroke();
        x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 5; x.beginPath(); x.moveTo(px - 5, -10); x.lineTo(px - 5, H + 10); x.stroke();
        for (let yy = 80; yy < H; yy += 200) { rr(x, px - 15, yy - 8, 30, 16, 5); x.fillStyle = "#C47A3A"; x.fill(); }
      }
      // floor + slime puddles
      const fy = H - Math.max(24, this.insetBottom + 10);
      x.fillStyle = "#2F7F95"; x.fillRect(0, fy, W, H - fy);
      for (const [px, pw] of [[0.12, 70], [0.86, 90]]) { x.beginPath(); x.ellipse(px * W, fy + 10, pw, 10, 0, 0, Math.PI * 2); x.fillStyle = rgba(SLIME, 0.75); x.fill(); x.beginPath(); x.ellipse(px * W - pw * 0.3, fy + 7, pw * 0.25, 3, 0, 0, Math.PI * 2); x.fillStyle = "rgba(255,255,255,0.5)"; x.fill(); }
      this.wall = c;
    }
    g.drawImage(this.wall, 0, 0, W, H);
  }

  private drawBoard(g: G) {
    const G0 = this.grid, n = this.n, cs = G0.cs;
    shadow(g, G0.x + G0.s / 2, G0.y + G0.s + 10, G0.s * 0.52, 16, 0.3);
    clayPanel(g, G0.x - 10, G0.y - 10, G0.s + 20, G0.s + 28, 22, "#3A6FB5", { lip: 8 });
    rr(g, G0.x - 3, G0.y - 3, G0.s + 6, G0.s + 6, 14); g.fillStyle = "#22467A"; g.fill();
    for (let i = 0; i < n * n; i++) {
      const p = this.pipes[i];
      if (!p) continue;
      const x = G0.x + (i % n) * cs, y = G0.y + Math.floor(i / n) * cs;
      const k = p.pop;
      if (k <= 0.01) continue;
      g.save(); g.translate(x + cs / 2, y + cs / 2); g.scale(k, k);
      const pad = Math.max(1.5, cs * 0.04), s = cs - pad * 2, rad = cs * 0.16;
      rr(g, -s / 2, -s / 2 + 2, s, s, rad); g.fillStyle = "rgba(10,20,50,0.45)"; g.fill();
      rr(g, -s / 2, -s / 2, s, s - 2, rad);
      clayFill(g, p.locked ? "#4E6E9E" : "#6FA2E6", -s * 0.1, -s * 0.15, s * 0.75, { gloss: 0.25 });
      if (p.locked) for (const [bx, by] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const ox = bx * s * 0.36, oy = by * s * 0.36, br = Math.max(2.5, cs * 0.055);
        blob(g, ox, oy, br, br, "#C9D3E6", { gloss: 0.6 });
        g.strokeStyle = "#5A6A88"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ox - br * 0.6, oy); g.lineTo(ox + br * 0.6, oy); g.stroke();
      }
      g.restore();
    }
    for (let i = 0; i < n * n; i++) { const p = this.pipes[i]; if (p && p.pop > 0.01) this.drawPipe(g, i, p); }
    // leak droplets
    for (const [i, d] of this.flow.leaks) {
      const p = this.pipes[i]; if (!p || p.fill < 0.8 || Math.abs(p.ang - (p.rc * Math.PI) / 2) > 0.12) continue;
      const c = this.cellCenter(i), h = cs / 2, wob = Math.sin(this.t * 7 + i) * 0.15;
      blob(g, c.x + DX[d] * h * 0.98, c.y + DY[d] * h * 0.98 + (DY[d] === 0 ? cs * 0.06 : 0), cs * 0.09 * (1 + wob), cs * 0.11 * (1 - wob), SLIME, { gloss: 0.6 });
    }
    if (this.cur.on && this.phase === "play") {
      const x = G0.x + this.cur.c * cs, y = G0.y + this.cur.r * cs;
      rr(g, x + 1, y + 1, cs - 2, cs - 2, cs * 0.18); g.strokeStyle = "#FFD25A"; g.lineWidth = 4; g.setLineDash([8, 5]); g.lineDashOffset = -this.t * 20; g.stroke(); g.setLineDash([]);
    }
  }

  private drawPipe(g: G, i: number, p: Pipe) {
    const c = this.cellCenter(i), cs = this.grid.cs, L = cs / 2, w = cs * 0.32;
    g.save();
    g.translate(c.x + Math.sin(p.wig * 30) * p.wig * 4, c.y); g.scale(p.pop, p.pop); g.rotate(p.ang);
    const arms: number[] = [];
    for (let d = 0; d < 4; d++) if (p.sol & (1 << d)) arms.push(d);
    const end = (d: number, len: number) => [DX[d] * len, DY[d] * len] as const;
    const stroke = (col: string, width: number, len: number, cap: CanvasLineCap = "butt") => {
      g.strokeStyle = col; g.lineWidth = width; g.lineCap = cap;
      for (const d of arms) { const [ex, ey] = end(d, len); g.beginPath(); g.moveTo(0, 0); g.lineTo(ex, ey); g.stroke(); }
    };
    stroke(PIPE_DK, w + 4, L);
    g.beginPath(); g.arc(0, 0, (w + 4) / 2 + 1, 0, Math.PI * 2); g.fillStyle = PIPE_DK; g.fill();
    stroke(PIPE, w, L);
    g.beginPath(); g.arc(0, 0, w / 2 + 1, 0, Math.PI * 2); g.fillStyle = PIPE; g.fill();
    // joint rings at each edge
    for (const d of arms) {
      g.save(); g.rotate((d * Math.PI) / 2);
      rr(g, -w * 0.62, -L, w * 1.24, cs * 0.1, 3); g.fillStyle = "#E3A563"; g.fill(); g.strokeStyle = PIPE_DK; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    // slime inside
    if (p.fill > 0.01) {
      const sw = w * 0.5, len = L * clamp(p.fill * 1.25, 0, 1);
      stroke(SLIME_DK, sw + 2, len, "round");
      stroke(SLIME, sw, len, "round");
      g.beginPath(); g.arc(0, 0, sw * 0.75, 0, Math.PI * 2); g.fillStyle = SLIME; g.fill();
      g.globalAlpha = 0.7; stroke(SLIME_HI, sw * 0.3, len * 0.85, "round"); g.globalAlpha = 1;
      // bubbles travelling in the slime
      if (p.fill > 0.9) for (const d of arms) { const u = (this.t * 0.9 + i * 0.37 + d * 0.25) % 1, [ex, ey] = end(d, L * u); g.beginPath(); g.arc(ex, ey, sw * 0.18, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.75)"; g.fill(); }
    } else {
      stroke("rgba(120,90,60,0.18)", w * 0.4, L * 0.9, "round");
    }
    // gloss along the tube
    g.globalAlpha = 0.55; g.strokeStyle = "#FFFFFF"; g.lineWidth = Math.max(1.5, w * 0.12); g.lineCap = "round";
    for (const d of arms) { const nx = -DY[d], ny = DX[d], [ex, ey] = end(d, L * 0.8); g.beginPath(); g.moveTo(nx * w * 0.28 + ex * 0.2, ny * w * 0.28 + ey * 0.2); g.lineTo(nx * w * 0.28 + ex, ny * w * 0.28 + ey); g.stroke(); }
    g.globalAlpha = 1;
    // dead end = a cute little cap
    if (arms.length === 1) blob(g, 0, 0, w * 0.55, w * 0.55, "#FF6F91", { gloss: 0.55 });
    g.restore();
  }

  private drawTank(g: G) {
    const T = this.tank, G0 = this.grid;
    // outlet pipe down to the board (always full of slime)
    const sx = T.x, sy0 = T.y + T.h - 4, sy1 = G0.y + 2, w = G0.cs * 0.32;
    const cx = G0.x + ((this.root % this.n) + 0.5) * G0.cs, my = (sy0 + sy1) / 2;
    const tube = () => { g.beginPath(); g.moveTo(sx, sy0); if (Math.abs(cx - sx) > 1) { g.lineTo(sx, my); g.lineTo(cx, my); } g.lineTo(cx, sy1); };
    g.lineCap = "butt"; g.lineJoin = "round";
    tube(); g.strokeStyle = PIPE_DK; g.lineWidth = w + 4; g.stroke();
    tube(); g.strokeStyle = PIPE; g.lineWidth = w; g.stroke();
    tube(); g.strokeStyle = SLIME; g.lineWidth = w * 0.5; g.stroke();
    // tank
    const x = T.x - T.w / 2, y = T.y, wob = Math.sin(this.t * 3) * 0.02;
    shadow(g, T.x, y + T.h, T.w * 0.5, 7, 0.3);
    rr(g, x, y + T.h * 0.12, T.w, T.h * 0.88, T.w * 0.22); g.fillStyle = "rgba(230,250,255,0.35)"; g.fill();
    g.save(); rr(g, x, y + T.h * 0.12, T.w, T.h * 0.88, T.w * 0.22); g.clip();
    const lv = y + T.h * (0.3 + Math.sin(this.t * 2) * 0.02);
    g.beginPath(); g.moveTo(x, lv);
    for (let k = 0; k <= 10; k++) g.lineTo(x + (T.w * k) / 10, lv + Math.sin(this.t * 4 + k * 0.9) * 3);
    g.lineTo(x + T.w, y + T.h); g.lineTo(x, y + T.h); g.closePath();
    clayFill(g, SLIME, T.x - T.w * 0.2, lv + T.h * 0.2, T.w * 0.7, { gloss: 0.35 });
    for (let k = 0; k < 5; k++) { const u = (this.t * 0.4 + k * 0.23) % 1; g.beginPath(); g.arc(x + T.w * (0.2 + ((k * 0.37) % 0.6)), y + T.h - u * T.h * 0.6, 2 + (k % 3), 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.6)"; g.fill(); }
    // googly eyes in the slime — it's alive!
    eye(g, T.x - T.w * 0.16, lv + T.h * 0.28, T.w * 0.1, { look: [Math.sin(this.t * 0.7) * 0.6, 0.3], blink: Math.sin(this.t * 1.3) > 0.97 ? 1 : 0 });
    eye(g, T.x + T.w * 0.16, lv + T.h * 0.28, T.w * 0.1, { look: [Math.sin(this.t * 0.7) * 0.6, 0.3], blink: Math.sin(this.t * 1.3) > 0.97 ? 1 : 0 });
    mouth(g, T.x, lv + T.h * 0.48, T.w * 0.16, this.phase === "win" || this.phase === "out" ? "grin" : "smile");
    g.restore();
    rr(g, x, y + T.h * 0.12, T.w, T.h * 0.88, T.w * 0.22); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 3; g.stroke();
    rr(g, x + T.w * 0.1, y + T.h * 0.22, T.w * 0.1, T.h * 0.5, 4); g.fillStyle = "rgba(255,255,255,0.45)"; g.fill();
    // lid
    g.save(); g.translate(T.x, y + T.h * 0.12); g.scale(1 + wob, 1 - wob);
    rr(g, -T.w * 0.56, -T.h * 0.12, T.w * 1.12, T.h * 0.16, 8); clayFill(g, "#E3A563", 0, -T.h * 0.05, T.w * 0.6, { gloss: 0.4 });
    blob(g, 0, -T.h * 0.16, T.w * 0.12, T.h * 0.07, "#FF6F91", { gloss: 0.5 });
    g.restore();
  }

  private drawCup(g: G, cp: Cup, k: number) {
    const q = this.cupPos(cp), G0 = this.grid, w = G0.cs * 0.32;
    const full = this.flow.cups[k];
    // stub pipe from the board edge into the cup
    const n = this.n, r = Math.floor(cp.cell / n), c = cp.cell % n;
    const ex = cp.dir === 2 ? G0.x + (c + 0.5) * G0.cs : cp.dir === 1 ? G0.x + G0.s : G0.x;
    const ey = cp.dir === 2 ? G0.y + G0.s : G0.y + (r + 0.5) * G0.cs;
    const tx = cp.dir === 2 ? q.x : q.x, ty = q.y - q.h * 0.42;
    g.lineCap = "round"; g.lineJoin = "round";
    const path = () => { g.beginPath(); g.moveTo(ex, ey); if (cp.dir === 2) g.lineTo(tx, ty); else { g.lineTo(tx, ey); g.lineTo(tx, ty); } };
    path(); g.strokeStyle = PIPE_DK; g.lineWidth = w + 4; g.stroke();
    path(); g.strokeStyle = PIPE; g.lineWidth = w; g.stroke();
    if (full && cp.level > 0.02) { path(); g.strokeStyle = SLIME; g.lineWidth = w * 0.5; g.stroke(); }
    // the cup (a glass mug with a face)
    const bob = Math.sin(cp.bob * Math.PI * 3) * cp.bob * 0.12;
    g.save(); g.translate(q.x, q.y + q.h / 2); g.scale(1 + bob, 1 - bob); g.translate(0, -q.h / 2);
    shadow(g, 0, q.h / 2 + 2, q.w * 0.55, 5, 0.3);
    const x0 = -q.w / 2, y0 = -q.h / 2;
    // handle
    g.strokeStyle = darken(cp.col, 0.15); g.lineWidth = q.w * 0.12; g.beginPath(); g.arc(q.w * 0.48, 0, q.h * 0.2, -Math.PI / 2, Math.PI / 2); g.stroke();
    rr(g, x0, y0, q.w, q.h, q.w * 0.22); g.fillStyle = rgba(lighten(cp.col, 0.5), 0.9); g.fill();
    if (cp.level > 0.01) {
      g.save(); rr(g, x0, y0, q.w, q.h, q.w * 0.22); g.clip();
      const ly = y0 + q.h * (1 - cp.level * 0.82);
      g.beginPath(); g.moveTo(x0, ly); for (let j = 0; j <= 8; j++) g.lineTo(x0 + (q.w * j) / 8, ly + Math.sin(this.t * 6 + j) * 2 * (1 - cp.level * 0.5)); g.lineTo(x0 + q.w, y0 + q.h); g.lineTo(x0, y0 + q.h); g.closePath();
      clayFill(g, SLIME, 0, y0 + q.h * 0.7, q.w * 0.6, { gloss: 0.3 });
      g.restore();
    }
    rr(g, x0, y0, q.w, q.h, q.w * 0.22); g.strokeStyle = cp.col; g.lineWidth = Math.max(3, q.w * 0.09); g.stroke();
    rr(g, x0 + q.w * 0.12, y0 + q.h * 0.12, q.w * 0.12, q.h * 0.5, 4); g.fillStyle = "rgba(255,255,255,0.55)"; g.fill();
    // face
    const happy = cp.done && cp.level > 0.6;
    eye(g, -q.w * 0.17, -q.h * 0.02, q.w * 0.13, { look: happy ? [0, -0.3] : [cp.dir === 2 ? 0 : cp.dir === 1 ? -0.7 : 0.7, -0.8] });
    eye(g, q.w * 0.17, -q.h * 0.02, q.w * 0.13, { look: happy ? [0, -0.3] : [cp.dir === 2 ? 0 : cp.dir === 1 ? -0.7 : 0.7, -0.8] });
    mouth(g, 0, q.h * 0.2, q.w * 0.22, happy ? "grin" : cp.level > 0.05 ? "smile" : "oh");
    if (happy) { g.fillStyle = "rgba(255,111,145,0.5)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * q.w * 0.3, q.h * 0.14, q.w * 0.07, q.w * 0.045, 0, 0, Math.PI * 2); g.fill(); } }
    g.restore();
    if (cp.done && cp.level > 0.95) clayText(g, "♥", q.x + q.w * 0.42, q.y - q.h * 0.55 - Math.sin(this.t * 4) * 3, Math.max(14, q.w * 0.3), { fill: "#FF6F91", stroke: "#FFFFFF", gloss: false });
  }

  private drawGloop(g: G) {
    const p = this.gloop, mood = this.hud.status === "playing" ? this.hud.host.mood : "happy";
    shadow(g, p.x, p.y - 2, p.h * 0.45, 7, 0.3);
    this.sprite(g, this.host(mood), p.x, p.y, p.h, { flip: p.flip, sy: 1 + p.bop * 0.1 + Math.sin(this.t * 3) * 0.03, sx: 1 - p.bop * 0.06 - Math.sin(this.t * 3) * 0.02 });
  }

  private drawStats(g: G) {
    if (this.hud.status !== "playing" || this.W < this.H * 1.05) return;
    const x = this.grid.x + this.grid.s + (this.W - this.grid.x - this.grid.s) / 2, y = this.grid.y + 30;
    if (x > this.W - 60) return;
    rr(g, x - 80, y - 22, 160, 76, 16); g.fillStyle = "rgba(20,40,80,0.45)"; g.fill();
    clayText(g, `TURNS ${this.taps}`, x, y, 22, { fill: "#FFFFFF" });
    clayText(g, `PAR ${this.par}`, x, y + 30, 18, { fill: this.taps <= this.par ? "#C6F27A" : "#FF8FB1" });
  }

  private scene(g: G) {
    this.drawWall(g);
    this.drawTank(g);
    this.drawBoard(g);
    this.cups.forEach((cp, k) => this.drawCup(g, cp, k));
    this.drawGloop(g);
    this.drawStats(g);
  }

  protected drawBackground(g: G) {
    if (!this.pipes.length) {
      this.build(new Rng(777), 4, 2, false, 0, false, 0);
      for (const p of this.pipes) { p.rc = 0; p.ang = 0; p.pop = 1; }
      this.flow = this.computeFlow();
      for (const p of this.pipes) p.fill = 1;
      for (const c of this.cups) { c.level = 1; c.done = true; }
      this.layout();
    }
    this.scene(g);
  }

  protected draw(g: G) { this.scene(g); }
}
