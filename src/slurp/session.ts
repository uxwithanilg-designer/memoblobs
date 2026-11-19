// Slurp Lab session: one stage on screen. Touch / mouse: press on a Slurper and drag — it follows your finger cell by
// cell and stops where it's blocked (or in goo). Keyboard: Tab or 1–9 picks a Slurper, arrows / WASD step it, Space ends
// the move. Undo, Restart, Hint and boosters. Sounds are panned left / right by where they happen on the tray.
import { audio, type Sound } from "@/lib/audio";
import { SlurpRenderer, type Quality, type SlurpLook } from "./render";
import { blobsLeft, burnt, cloneState, DIR_CH, initState, isStuck, move, occupancy, playDrag, type MoveOut } from "./rules";
import { hint as solveHint } from "./solver";
import { encodeStage, decodeStage } from "./stagefile";
import type { Lab } from "./campaign";
import { BF, COLORS, DIRS, T, type Drag, type Hud, type SlurpEvent, type Stage, type State } from "./types";

export interface SlurpResult { n: number; moves: number; par: number; stars: number; hints: number; undos: number; boosted: boolean }
export interface SessionOpts {
  st: Stage; lab: Lab; quality: Quality;
  /** the title screen: the solution plays by itself */
  attract?: boolean;
  vibrate?: boolean;
  look?: SlurpLook;
  onHud?: (h: Hud) => void;
  onEvent?: (e: SlurpEvent) => void;
  onFinish?: (r: SlurpResult) => void;
  /** the H key asks the app for a hint (it counts hints and coins) */
  onHintKey?: () => void;
}

const SFX = (n: string) => `a:slurp_${n}` as Sound;
export const SLURP_SFX = ["pick", "drop", "step", "slurp", "seal", "blocked", "stuck", "undo", "hint", "win", "star",
  "pop", "break", "crumble", "switch", "paint", "turn", "crate", "portal", "unlock", "bomb", "slide", "goo", "burnt"].map(SFX);

export class SlurpSession {
  r: SlurpRenderer; st: Stage; s: State; o: SessionOpts;
  private host: HTMLElement; private ro: ResizeObserver;
  private raf = 0; private last = 0; private paused = false; private done = false;
  private history: State[] = [];
  private drag: { i: number; ox: number; oy: number; moved: boolean; start: State; want: [number, number] | null; blockedSaid: boolean } | null = null;
  private queueT = 0;
  private keySel = -1; private keyIdle = 0;
  private hints = 0; private undos = 0; private boosted = false;
  private attractK = 0; private attractStep = 0; private attractT = 0; private attractWait = 0;
  private worker: Worker | null = null; private hintReq = 0;
  private needAt: number[] = [];
  /** a booster waiting for a tap on the board */
  tapMode: ((cell: number) => void) | null = null;

  constructor(host: HTMLElement, o: SessionOpts) {
    this.host = host; this.o = o; this.st = o.st;
    this.s = initState(o.st);
    this.r = new SlurpRenderer(host, o.quality);
    if (o.look) this.r.setLook(o.look);
    this.r.load(o.st, this.s, o.lab);
    this.needAt = o.st.slurpers.map((d) => d.need);
    this.ro = new ResizeObserver(() => this.r.resize(host.clientWidth, host.clientHeight));
    this.ro.observe(host);
    this.r.resize(host.clientWidth, host.clientHeight);
    if (!o.attract) {
      const c = this.r.renderer.domElement;
      c.addEventListener("pointerdown", this.onDown);
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
      // capture phase: Space ends a keyboard move before the player shell sees it (it would pause the game)
      window.addEventListener("keydown", this.onKey, true);
    }
    if (typeof window !== "undefined") (window as unknown as Record<string, SlurpSession>)[o.attract ? "__slurpTitle" : "__slurpGame"] = this;
    this.hud();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ helpers
  private pan(x: number) { return Math.max(-0.85, Math.min(0.85, ((x - (this.st.w - 1) / 2) / Math.max(1, this.st.w / 2)) * 0.8)); }
  private emit(e: SlurpEvent) {
    this.r.onEvent(e);
    this.o.onEvent?.(e);
    if (this.o.attract) return;
    const W = this.st.w, px = (c: number) => this.pan(c % W);
    switch (e.t) {
      case "pick": if (e.i >= 0) audio.play(SFX("pick"), { gain: 0.45, pan: this.pan(this.s.sl[e.i].x), duck: false }); break;
      case "step": audio.play(SFX(e.kind === "slide" ? "slide" : "step"), { gain: e.kind === "slide" ? 0.3 : 0.16, pan: this.pan(e.x), rate: 0.95 + Math.random() * 0.1, duck: false }); break;
      case "blocked": audio.play(SFX("blocked"), { gain: 0.35, pan: this.pan(this.s.sl[e.i].x), duck: false }); break;
      case "slurp": {
        const full = this.needAt[e.i] || 1;
        audio.play(SFX("slurp"), { gain: 0.6, pan: this.pan(this.s.sl[e.i].x), rate: 0.9 + Math.max(0, 1 - e.need / full) * 0.45, reverb: 0.15 });
        this.buzz(12);
        break;
      }
      case "seal": audio.play(SFX("seal"), { gain: 0.75, pan: this.pan(e.x), reverb: 0.35 }); this.buzz(28); break;
      case "fx": {
        const f = e.e;
        const p = "cell" in f ? px(f.cell) : "to" in f ? px(f.to) : "i" in f ? this.pan(this.s.sl[f.i]?.x ?? 0) : 0;
        const name = f.t === "unlock" || f.t === "wake" ? "unlock" : f.t;
        audio.play(SFX(name), { gain: f.t === "bomb" ? 0.8 : 0.55, pan: p, reverb: f.t === "portal" || f.t === "unlock" ? 0.3 : 0.1 });
        if (f.t === "bomb" || f.t === "break") this.buzz(30);
        break;
      }
      case "drop": if (e.moved) audio.play(SFX("drop"), { gain: 0.3, pan: this.pan(this.s.sl[e.i]?.x ?? 0), duck: false }); break;
      case "stuck": audio.play(SFX("stuck"), { gain: 0.6 }); break;
      case "burnt": audio.play(SFX("burnt"), { gain: 0.7 }); break;
      case "undo": case "restart": audio.play(SFX("undo"), { gain: 0.5, duck: false }); break;
      case "win": audio.play(SFX("win"), { gain: 0.85, reverb: 0.3 }); this.buzz(40); break;
      default: break;
    }
  }
  private buzz(ms: number) { if (this.o.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* blocked */ } } }
  private hud() {
    const per = new Map<number, number>();
    this.st.slurpers.forEach((d) => per.set(d.color, 0));
    this.s.blobs.forEach((b, c) => { if (b >= 0) per.set(b, (per.get(b) ?? 0) + (this.s.cnt[c] || 1)); });
    const won = blobsLeft(this.s) === 0;
    let fuse: number | undefined;
    for (const [c, n] of Object.entries(this.st.fuse ?? {})) if (this.s.blobs[Number(c)] >= 0) fuse = Math.min(fuse ?? 99, n - this.s.moves);
    this.o.onHud?.({ left: [...per.entries()].map(([color, n]) => ({ color, n })), moves: this.s.moves, par: this.st.m.par, stuck: !won && (isStuck(this.st, this.s) || burnt(this.st, this.s)), won, canUndo: this.history.length > 0, fuse });
  }
  /** play a move's events in order */
  private play(o: MoveOut) {
    for (const stp of o.steps) this.emit({ t: "step", i: stp.i, x: stp.x, y: stp.y, kind: stp.kind === "step" ? undefined : stp.kind });
    for (const f of o.fx) this.emit({ t: "fx", e: f });
    for (const e of o.eats) this.emit({ t: "slurp", i: e.i, cells: e.cells, color: e.color, need: e.need });
    for (const sl of o.seals) this.emit({ t: "seal", i: sl.i, x: sl.x, y: sl.y, color: sl.color });
    if (o.stop && !this.o.attract) audio.play(SFX("goo"), { gain: 0.5, duck: false });
  }

  /** one step for Slurper i (false = blocked) */
  private step(i: number, d: number): boolean {
    const o = move(this.st, this.s, i, d);
    if (!o) return false;
    this.play(o);
    if (this.drag && (o.stop || o.seals.some((x) => x.i === this.drag!.i))) { this.drag.moved = true; this.endDrag(); }
    if (blobsLeft(this.s) === 0) this.win();
    return true;
  }
  private beginDrag(i: number, gx: number, gy: number) {
    const q = this.s.sl[i];
    if (!q.awake) { this.emit({ t: "blocked", i }); return; }
    this.drag = { i, ox: gx - q.x, oy: gy - q.y, moved: false, start: cloneState(this.s), want: null, blockedSaid: false };
    this.r.setDragged(i);
    this.r.clearHint();
    this.emit({ t: "pick", i });
  }
  private endDrag() {
    const g = this.drag; if (!g) return;
    this.drag = null;
    this.r.setDragged(-1);
    if (g.moved) { this.s.moves++; this.history.push(g.start); }
    this.emit({ t: "drop", i: g.i, moved: g.moved });
    this.hud();
    if (this.done || !g.moved || blobsLeft(this.s) === 0) return;
    if (burnt(this.st, this.s)) this.emit({ t: "burnt" });
    else if (isStuck(this.st, this.s)) this.emit({ t: "stuck" });
  }
  /** walk the dragged Slurper one step toward where the finger wants it */
  private advance() {
    const g = this.drag; if (!g || !g.want) return;
    const q = this.s.sl[g.i]; if (!q.alive) { this.endDrag(); return; }
    const tx = g.want[0] - g.ox, ty = g.want[1] - g.oy;
    const dx = tx - q.x, dy = ty - q.y;
    if (!dx && !dy) return;
    const order: number[] = [];
    const hx = dx > 0 ? 1 : dx < 0 ? 3 : -1, hy = dy > 0 ? 2 : dy < 0 ? 0 : -1;
    if (Math.abs(dx) >= Math.abs(dy)) { if (hx >= 0) order.push(hx); if (hy >= 0) order.push(hy); } else { if (hy >= 0) order.push(hy); if (hx >= 0) order.push(hx); }
    const px = q.x, py = q.y;
    for (const d of order) if (this.step(g.i, d)) {
      const dg = this.drag;
      if (dg) {
        dg.moved = true; dg.blockedSaid = false;
        // a slide / portal / belt carried it on: hold the finger's offset so it doesn't chase back
        const nq = this.s.sl[g.i];
        if (Math.abs(nq.x - px) + Math.abs(nq.y - py) > 1 && dg.want) { dg.ox = dg.want[0] - nq.x; dg.oy = dg.want[1] - nq.y; }
      }
      return;
    }
    if (!g.blockedSaid) { g.blockedSaid = true; this.emit({ t: "blocked", i: g.i }); }
  }

  // ------------------------------------------------------------------ input
  /** screen point → board cell index (or -1) */
  cellAt(clientX: number, clientY: number): number {
    const rect = this.r.renderer.domElement.getBoundingClientRect();
    const c = this.r.pick(clientX - rect.left, clientY - rect.top);
    if (!c || c.x < 0 || c.y < 0 || c.x >= this.st.w || c.y >= this.st.h) return -1;
    return c.y * this.st.w + c.x;
  }
  /** which live Slurper covers a cell (-1 = none) */
  slurperAt(cell: number): number { return cell < 0 ? -1 : occupancy(this.st, this.s)[cell]; }
  private onDown = (ev: PointerEvent) => {
    if (this.paused || this.done) return;
    if (this.tapMode) { const cell = this.cellAt(ev.clientX, ev.clientY); if (cell >= 0) this.tapMode(cell); return; }
    const rect = this.r.renderer.domElement.getBoundingClientRect();
    const c = this.r.pick(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!c) return;
    const occ = occupancy(this.st, this.s);
    let i = c.x >= 0 && c.y >= 0 && c.x < this.st.w && c.y < this.st.h ? occ[c.y * this.st.w + c.x] : -1;
    if (i < 0) {
      // forgiving touch: the nearest Slurper within one cell
      let bd = 1.6;
      this.s.sl.forEach((q, k) => { if (!q.alive) return; for (const [cx, cy] of q.cells) { const d = Math.hypot(q.x + cx - c.x, q.y + cy - c.y); if (d < bd) { bd = d; i = k; } } });
      if (i < 0) return;
      const q = this.s.sl[i], cell = q.cells.reduce((b, cc) => (Math.hypot(q.x + cc[0] - c.x, q.y + cc[1] - c.y) < Math.hypot(q.x + b[0] - c.x, q.y + b[1] - c.y) ? cc : b));
      this.beginDrag(i, q.x + cell[0], q.y + cell[1]);
    } else this.beginDrag(i, c.x, c.y);
    this.keySel = -1;
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };
  private onMove = (ev: PointerEvent) => {
    if (!this.drag) return;
    const rect = this.r.renderer.domElement.getBoundingClientRect();
    const c = this.r.pick(ev.clientX - rect.left, ev.clientY - rect.top);
    if (c) this.drag.want = [c.x, c.y];
  };
  private onUp = () => { if (!this.drag) return; this.advanceAll(); this.endDrag(); };
  private advanceAll() { for (let k = 0; k < 24 && this.drag; k++) { const q = this.s.sl[this.drag.i]; const before = q.x * 100 + q.y; this.advance(); if (!this.drag || q.x * 100 + q.y === before) break; } }
  private onKey = (ev: KeyboardEvent) => {
    if (this.paused) return;
    const k = ev.key.toLowerCase();
    // the Space that ends the winning keyboard move must not pause the game behind the clear sheet
    if (this.done) { if ((k === " " || k === "enter") && this.keySel >= 0) { ev.preventDefault(); ev.stopPropagation(); } return; }
    const alive = this.s.sl.map((q, i) => (q.alive && q.awake ? i : -1)).filter((i) => i >= 0);
    if (k === "z") { ev.preventDefault(); this.undo(); return; }
    if (k === "r") { this.restart(); return; }
    if (k === "h") { this.o.onHintKey?.(); return; }
    if (k === "tab" || /^[1-9]$/.test(k)) {
      ev.preventDefault();
      if (this.drag) this.endDrag();
      const next = /^[1-9]$/.test(k) ? alive[Number(k) - 1] : alive[(alive.indexOf(this.keySel) + (ev.shiftKey ? alive.length - 1 : 1)) % alive.length];
      if (next === undefined) return;
      this.keySel = next; this.r.setDragged(next); this.emit({ t: "pick", i: next });
      return;
    }
    const d = ({ arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 } as Record<string, number>)[k];
    if (d !== undefined) {
      ev.preventDefault();
      // nothing picked yet, or the picked one sealed: take the first live Slurper
      if (this.keySel < 0 || !this.s.sl[this.keySel].alive) { this.keySel = alive[0] ?? -1; if (this.keySel < 0) return; this.r.setDragged(this.keySel); }
      if (!this.drag) { const q = this.s.sl[this.keySel]; this.beginDrag(this.keySel, q.x, q.y); }
      if (this.step(this.keySel, d)) { if (this.drag) this.drag.moved = true; } else this.emit({ t: "blocked", i: this.keySel });
      this.keyIdle = 0.7;
      return;
    }
    if ((k === " " || k === "enter") && (this.drag || this.keySel >= 0)) {
      // Space / Enter end the keyboard move (and only that: not the shell's pause, not a focused button)
      ev.preventDefault(); ev.stopPropagation();
      const a = document.activeElement; if (a instanceof HTMLElement && a !== document.body) a.blur();
      if (this.drag) this.endDrag();
    }
  };

  // ------------------------------------------------------------------ buttons
  undo() {
    if (this.drag) this.endDrag();
    const prev = this.history.pop(); if (!prev) return;
    this.s = prev; this.done = false; this.undos++;
    this.r.snap(this.s); this.emit({ t: "undo" }); this.hud();
  }
  restart() {
    if (this.drag) this.endDrag();
    if (!this.history.length && this.s.moves === 0) return;
    this.s = initState(this.st); this.history = []; this.done = false;
    this.r.snap(this.s); this.emit({ t: "restart" }); this.hud();
  }
  /** Prof. Hoot's hint: the next drag (solved in a worker); "dead" = undo first */
  hint(): Promise<"shown" | "dead" | "none"> {
    if (this.done) return Promise.resolve("none");
    this.hints++;
    audio.play(SFX("hint"), { gain: 0.6 });
    if (this.s.moves === 0 && !this.drag && this.st.solution.length && !this.boosted) { this.r.showHint(this.st.solution[0]); return Promise.resolve("shown"); }
    const id = ++this.hintReq;
    const show = (res: { drag: Drag | null; dead: boolean }) => {
      if (id !== this.hintReq) return "none" as const;
      if (res.drag) { this.r.showHint(res.drag); return "shown" as const; }
      return res.dead ? ("dead" as const) : ("none" as const);
    };
    const st = this.s;
    return new Promise((resolve) => {
      try {
        if (!this.worker) this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        const w = this.worker;
        const t = setTimeout(() => { w.onmessage = null; resolve(show(solveHint(this.st, cloneState(st), 2500))); }, 5000);
        w.onmessage = (m: MessageEvent<{ id: number; drag: Drag | null; dead: boolean }>) => { if (m.data.id !== id) return; clearTimeout(t); resolve(show(m.data)); };
        w.postMessage({ id, kind: "hint", row: encodeStage(this.st), state: { blobs: Array.from(st.blobs), cnt: Array.from(st.cnt), bub: Array.from(st.bub), tiles: Array.from(st.tiles), crates: Array.from(st.crates), sw: st.sw, moves: st.moves, sl: st.sl } });
      } catch { resolve(show(solveHint(this.st, cloneState(st), 2500))); }
    });
  }
  // ---- boosters (they cap the stars at 2)
  /** Shrink: Slurper i drinks one fewer — and one Gloopy of its colour (the farthest) vanishes */
  boosterShrink(i: number): boolean {
    const q = this.s.sl[i]; if (!q?.alive) return false;
    const W = this.st.w;
    let best = -1, bd = -1;
    this.s.blobs.forEach((b, c) => { if (b === q.color && this.s.cnt[c] === 1 && !this.s.bub[c]) { const d = Math.abs(c % W - q.x) + Math.abs(Math.floor(c / W) - q.y); if (d > bd) { bd = d; best = c; } } });
    if (best < 0) return false;
    this.history.push(cloneState(this.s));
    this.s.blobs[best] = -1; this.s.cnt[best] = 0; q.need -= 1;
    this.boosted = true;
    this.emit({ t: "fx", e: { t: "pop", cell: best } });
    if (q.need <= 0) { q.alive = false; this.emit({ t: "seal", i, x: q.x, y: q.y, color: q.color }); }
    this.r.snap(this.s); this.hud();
    if (blobsLeft(this.s) === 0) this.win();
    return true;
  }
  /** Lift: move a plain Gloopy to an empty floor cell */
  boosterLift(from: number, to: number): boolean {
    const s = this.s, occ = occupancy(this.st, s);
    if (s.blobs[from] < 0 || (this.st.bflags?.[from] ?? 0) & (BF.BUBBLE | BF.DOUBLE | BF.FUSE | BF.BOMB)) return false;
    if (s.blobs[to] >= 0 || occ[to] >= 0 || s.crates[to] || !(s.tiles[to] === T.FLOOR || s.tiles[to] === T.ICE)) return false;
    this.history.push(cloneState(s));
    s.blobs[to] = s.blobs[from]; s.cnt[to] = 1; s.blobs[from] = -1; s.cnt[from] = 0;
    this.boosted = true;
    this.r.snap(s); this.hud();
    return true;
  }
  private win() {
    if (this.done) return;
    this.done = true;
    if (this.drag) { const g = this.drag; this.drag = null; this.r.setDragged(-1); if (g.moved) { this.s.moves++; this.history.push(g.start); } }
    this.emit({ t: "win" });
    this.hud();
    const par = this.st.m.par, moves = this.s.moves;
    let stars = moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
    if (this.boosted) stars = Math.min(2, stars);
    if (!this.o.attract) setTimeout(() => this.o.onFinish?.({ n: this.st.n, moves, par, stars, hints: this.hints, undos: this.undos, boosted: this.boosted }), 1300);
  }
  pause(p: boolean) { this.paused = p; if (p && this.drag) this.endDrag(); }
  /** dev / art / QA: play the first k drags of the planted solution at once */
  playSolution(k: number) { for (const g of this.st.solution.slice(0, k)) if (this.s.sl[g.i].alive) playDrag(this.st, this.s, g.i, g.dirs); this.r.snap(this.s); this.hud(); if (blobsLeft(this.s) === 0) this.win(); }
  /** the HUD's height at the top and bottom (px) */
  setInsets(top: number, bottom: number, left = 0, right = 0) { this.r.setInsets(top, bottom, left, right); }

  // ------------------------------------------------------------------ loop
  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.queueT -= dt;
      if (this.drag?.want && this.queueT <= 0) { this.advance(); this.queueT = 0.035; }
      if (this.keyIdle > 0) { this.keyIdle -= dt; if (this.keyIdle <= 0 && this.drag) this.endDrag(); }
      if (this.o.attract) this.attract(dt);
    }
    this.r.frame(this.paused ? 0 : dt);
    this.raf = requestAnimationFrame(this.loop);
  };
  /** the title's demo: plays the planted solution, then starts over */
  private attract(dt: number) {
    if (this.attractWait > 0) { this.attractWait -= dt; if (this.attractWait <= 0) { this.s = initState(this.st); this.r.snap(this.s); this.attractK = 0; this.attractStep = 0; this.done = false; } return; }
    const sol = this.st.solution;
    if (this.attractK >= sol.length) { this.attractWait = 2.2; return; }
    this.attractT -= dt;
    if (this.attractT > 0) return;
    const g = sol[this.attractK];
    if (this.attractStep === 0) this.r.setDragged(g.i);
    const d = DIR_CH.indexOf(g.dirs[this.attractStep]);
    if (!this.s.sl[g.i].alive || d < 0 || !this.step(g.i, d)) { this.attractK++; this.attractStep = 0; this.r.setDragged(-1); this.attractT = 0.5; this.s.moves++; return; }
    this.attractStep++;
    this.attractT = 0.16;
    if (this.attractStep >= g.dirs.length) { this.attractK++; this.attractStep = 0; this.r.setDragged(-1); this.attractT = 0.55; this.s.moves++; }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const c = this.r.renderer.domElement;
    c.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKey, true);
    this.worker?.terminate();
    this.r.dispose();
    const w = window as unknown as Record<string, unknown>;
    if (w.__slurpGame === this) delete w.__slurpGame;
    if (w.__slurpTitle === this) delete w.__slurpTitle;
  }
}
export { COLORS, DIRS, decodeStage };
