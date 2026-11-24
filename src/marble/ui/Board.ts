// The Marble Merge 2048 board: a glass jar drawn in 2D on one canvas (light on any phone), running the marble physics
// live. Marbles are painted once per number and size: a glossy candy-coloured sphere with its number (the number turns
// as the marble rolls, the shine stays on top). Rocks show their cracks; frozen marbles wear a frosted shell. The room
// behind the jar (shelves, lamps, bokeh, placed by the stage number) is painted once per stage and dimmed.
// Slide to aim — the shot marble hangs over the jar with a dotted guide — and release to drop. Equal marbles merge
// with a pop, a ring and sparks; chains rise in pitch. Keyboard: ← → to aim, space / ↓ to drop.
import { DANGER, DT, JAR_H, ROCK, SPAWN_Y, Sim, jarOf, rOf, type Ball, type SimEvent } from "../physics";
import { rngFrom } from "../../sudoku/rng";
import { label, type Game } from "../play";
import type { Room, StageDef } from "../stage";

export type BoardSound = "aim" | "drop" | "tap" | "merge" | "crack" | "smash" | "thaw" | "hammer";
export interface BoardHooks {
  canPlay: () => boolean;
  /** the player releases a drop at world x: returns the marble to drop, or null */
  take: (x: number) => number | null;
  /** score, best or rocks changed (after merges / smashes) */
  changed: (sim: Sim) => void;
  /** the jar has come to rest */
  settled: (sim: Sim) => void;
  overflow: () => void;
  hammerArmed: () => boolean;
  hammered: () => void;
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

/** marble colours by power of two (2 = index 1) */
const COL = ["#888", "#ffc93c", "#ff8a2a", "#ff4d5e", "#ff4fae", "#b45cff", "#4d7bff", "#2fc6ff", "#2fd98a", "#9be22d", "#ffb800", "#ff3d7f", "#7a5cff", "#00d0c0", "#ff7a00", "#ffffff"];
export const colOf = (v: number) => (v < 0 ? "#6b6470" : COL[Math.min(COL.length - 1, Math.round(Math.log2(Math.max(2, v))))]);

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean; rock?: boolean; star?: boolean }

export class MarbleBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private k = 3; private ox = 0; private oy = 0;
  sim: Sim | null = null;
  private def: StageDef | null = null; private room: Room | null = null;
  private cur = 2; private nxt = 2;
  private aimX = 50; private aiming = false;
  private cool = 0; private shotPop = 1;
  private sprites = new Map<string, HTMLCanvasElement>();
  private gloss = new Map<number, HTMLCanvasElement>();
  private parts: Part[] = [];
  private shake = 0; private danger = 0; private overflowed = false; private wasQuiet = true;
  private acc = 0; private lastTap = 0;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver;

  constructor(private el: HTMLElement, private hooks: BoardHooks) {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    el.appendChild(this.cv);
    this.cv.addEventListener("pointerdown", this.onDown);
    this.cv.addEventListener("pointermove", this.onMove);
    this.cv.addEventListener("pointerup", this.onUp);
    this.cv.addEventListener("pointercancel", () => { this.aiming = false; });
    window.addEventListener("keydown", this.onKey);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); });
    this.io.observe(el);
    document.addEventListener("visibilitychange", this.kick);
    this.resize();
  }

  // ------------------------------------------------------------ layout
  private resize() {
    const w = this.el.clientWidth || 360, h = this.el.clientHeight || 640;
    this.W = w; this.H = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    // the jar (100 × 150) plus room above it for the shot marble
    const top = 46;
    this.k = Math.max(1.5, Math.min((w - 28) / 104, (h - 18) / (JAR_H + top + 8)));
    this.ox = (w - 100 * this.k) / 2;
    this.oy = Math.max(top * this.k, (h - (JAR_H + top) * this.k) / 2 + top * this.k);
    this.sprites.clear(); this.gloss.clear();
    this.paintBackground();
    this.kick();
  }
  private sx(x: number) { return this.ox + x * this.k; }
  private sy(y: number) { return this.oy + y * this.k; }
  private pan(x: number) { return Math.max(-0.85, Math.min(0.85, (x / 50 - 1) * 0.85)); }
  toScreen(x: number, y: number) { return { x: this.sx(x), y: this.sy(y) }; }

  // ------------------------------------------------------------ stage
  setStage(d: StageDef, room: Room, g: Game) {
    this.def = d; this.room = room;
    this.sim = new Sim(jarOf(d.jar), g.balls);
    this.sim.score = g.score;
    this.sim.events = [];
    this.cur = g.cur; this.nxt = g.nxt;
    this.aimX = 50; this.cool = 0; this.shotPop = 0;
    this.parts = []; this.danger = 0; this.overflowed = false; this.wasQuiet = true;
    for (const b of this.sim.balls) b.age = 0.15 + Math.random() * 0.2; // a soft pop-in
    this.paintBackground();
    this.kick();
  }
  /** load a saved jar (undo) */
  load(g: Game) {
    if (!this.sim || !this.def) return;
    this.sim = new Sim(jarOf(this.def.jar), g.balls); this.sim.score = g.score; this.sim.events = [];
    this.sim.wake();
    this.setShot(g.cur, g.nxt);
    this.overflowed = false; this.danger = 0;
    this.kick();
  }
  setShot(cur: number, nxt: number) { if (cur !== this.cur) this.shotPop = 0; this.cur = cur; this.nxt = nxt; this.kick(); }
  snapshot(): Ball[] { return this.sim ? this.sim.balls.map((b) => ({ ...b })) : []; }
  resume() { this.overflowed = false; for (const b of this.sim?.balls ?? []) b.over = 0; this.kick(); }

  // ------------------------------------------------------------ input
  private toWorld(e: PointerEvent) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left - this.ox) / this.k, y: (e.clientY - r.top - this.oy) / this.k }; }
  private setAim(x: number) {
    if (!this.sim) return;
    const [lo, hi] = this.sim.aimRange(this.cur);
    const nx = Math.max(lo, Math.min(hi, x));
    if (Math.abs(nx - this.aimX) > 6) { this.aimX = nx; this.hooks.sound("aim", this.pan(nx)); } else this.aimX = nx;
    this.kick();
  }
  private onDown = (e: PointerEvent) => {
    if (!this.sim || !this.hooks.canPlay()) return;
    const p = this.toWorld(e);
    if (this.hooks.hammerArmed()) { this.hammerAt(p.x, p.y); return; }
    this.aiming = true;
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    this.setAim(p.x);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.sim || this.hooks.hammerArmed()) return;
    if (!this.aiming && e.pointerType !== "mouse") return;
    this.setAim(this.toWorld(e).x);
  };
  private onUp = (e: PointerEvent) => {
    if (!this.aiming) return;
    this.aiming = false;
    this.setAim(this.toWorld(e).x);
    this.dropNow();
  };
  private onKey = (e: KeyboardEvent) => {
    if (!this.sim || !this.hooks.canPlay()) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowLeft" || e.key === "a") { this.setAim(this.aimX - 5); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "d") { this.setAim(this.aimX + 5); e.preventDefault(); }
    else if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { this.dropNow(); e.preventDefault(); }
  };
  /** drop the shot at the aim (also used by the dev hook) */
  dropNow(x = this.aimX) {
    if (!this.sim || this.cool > 0 || this.overflowed || !this.hooks.canPlay()) return false;
    const v = this.hooks.take(x);
    if (v == null) return false;
    this.aimX = x;
    this.sim.drop(v, x);
    this.cool = 0.42; this.shotPop = 0;
    this.hooks.sound("drop", this.pan(x));
    this.kick();
    return true;
  }
  private hammerAt(x: number, y: number) {
    const s = this.sim; if (!s) return;
    let best: Ball | null = null, bd = Infinity;
    for (const b of s.balls) { const d = Math.hypot(b.x - x, b.y - y) - b.r; if (d < bd) { bd = d; best = b; } }
    if (!best || bd > 6) return;
    s.balls = s.balls.filter((b) => b !== best);
    s.wake();
    this.burst(best.x, best.y, colOf(best.v), 18, true);
    this.ring(best.x, best.y, colOf(best.v), best.r);
    this.shake = Math.max(this.shake, 6);
    this.hooks.sound("hammer", this.pan(best.x));
    this.hooks.hammered();
    this.hooks.changed(s);
    this.kick();
  }
  aimRange() { return this.sim ? this.sim.aimRange(this.cur) : ([10, 90] as const); }
  isQuiet() { return !this.sim || this.sim.isQuiet(); }
  get busy() { return !!this.sim && (!this.sim.isQuiet() || this.cool > 0); }

  // ------------------------------------------------------------ sprites
  private marble(v: number, ice = false, hp = 2): HTMLCanvasElement {
    const R = Math.max(4, rOf(v) * this.k * this.dpr);
    const key = `${v}:${ice ? 1 : 0}:${hp}:${Math.round(R)}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const pad = Math.ceil(R * 0.12) + 2, S = Math.ceil(R * 2 + pad * 2);
    c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d")!, cx = S / 2, cy = S / 2;
    const col = colOf(v);
    if (v === ROCK) {
      const gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      gr.addColorStop(0, "#a49cb0"); gr.addColorStop(0.6, "#6b6470"); gr.addColorStop(1, "#3a3440");
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, rr = R * (0.9 + ((i * 7) % 5) * 0.025); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = "rgba(0,0,0,.25)";
      for (const [a, b, r] of [[-0.3, 0.2, 0.18], [0.35, -0.1, 0.14], [0.05, 0.45, 0.1]]) { g.beginPath(); g.arc(cx + a * R, cy + b * R, r * R, 0, Math.PI * 2); g.fill(); }
      if (hp <= 1) {
        g.strokeStyle = "#ffd23f"; g.lineWidth = R * 0.09; g.lineCap = "round"; g.shadowColor = "#ffb000"; g.shadowBlur = R * 0.3;
        g.beginPath(); g.moveTo(cx - R * 0.5, cy - R * 0.55); g.lineTo(cx - R * 0.05, cy - R * 0.05); g.lineTo(cx - R * 0.2, cy + R * 0.3); g.lineTo(cx + R * 0.2, cy + R * 0.7);
        g.moveTo(cx - R * 0.05, cy - R * 0.05); g.lineTo(cx + R * 0.55, cy - R * 0.25); g.stroke();
      }
      this.sprites.set(key, c); return c;
    }
    // the sphere
    if (v >= 256) { g.shadowColor = col; g.shadowBlur = R * (v >= 1024 ? 0.5 : 0.3); }
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.08, cx, cy, R);
    gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.45, col); gr.addColorStop(0.85, shade(col, -0.28)); gr.addColorStop(1, shade(col, -0.45));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // a pool-ball band on the big ones
    if (v >= 128) {
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
      g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(cx - R, cy - R * 0.36, R * 2, R * 0.72);
      g.restore();
    }
    // the number on a white disc
    const txt = label(v), dr = R * 0.58;
    g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(cx, cy, dr, 0, Math.PI * 2); g.fill();
    const fs = R * (txt.length >= 4 ? 0.5 : txt.length === 3 ? 0.6 : txt.length === 2 ? 0.74 : 0.86);
    g.font = `900 ${Math.round(fs)}px 'Lilita One', system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = shade(col, -0.4); g.fillText(txt, cx, cy + fs * 0.04);
    if (ice) {
      g.fillStyle = "rgba(205,238,255,.55)"; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = R * 0.1; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = R * 0.05;
      g.beginPath(); g.moveTo(cx - R * 0.6, cy + R * 0.2); g.lineTo(cx - R * 0.2, cy - R * 0.1); g.lineTo(cx + R * 0.1, cy + R * 0.25); g.lineTo(cx + R * 0.55, cy - R * 0.2); g.stroke();
    }
    this.sprites.set(key, c);
    return c;
  }
  /** the shine on top of a marble (never rotates) */
  private shine(R: number): HTMLCanvasElement {
    const key = Math.round(R);
    let c = this.gloss.get(key);
    if (c) return c;
    const S = Math.ceil(R * 2 + 4);
    c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d")!, cx = S / 2, cy = S / 2;
    const gr = g.createRadialGradient(cx - R * 0.38, cy - R * 0.45, 0, cx - R * 0.38, cy - R * 0.45, R * 0.55);
    gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.4, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx - R * 0.33, cy - R * 0.42, R * 0.5, R * 0.32, -0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = Math.max(1, R * 0.06);
    g.beginPath(); g.arc(cx, cy, R * 0.86, Math.PI * 0.15, Math.PI * 0.55); g.stroke();
    this.gloss.set(key, c);
    return c;
  }

  // ------------------------------------------------------------ the room behind the jar
  private paintBackground() {
    const room = this.room, d = this.dpr, W = this.W, H = this.H;
    if (!room) return;
    const c = this.bg ?? document.createElement("canvas");
    c.width = Math.round(W * d); c.height = Math.round(H * d);
    const g = c.getContext("2d")!;
    g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`marble-bg:${room.id}:${this.def?.stage ?? 1}`);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, room.sky[0]); sky.addColorStop(0.55, room.sky[1]); sky.addColorStop(1, room.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // soft lamps / bokeh
    for (let i = 0; i < 14; i++) {
      const x = rng.next() * W, y = rng.next() * H * 0.8, r = 20 + rng.next() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hexA(i % 3 ? room.glow : "#ffffff", 0.16)); gr.addColorStop(1, hexA(room.glow, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // shelves with silhouettes of jars, toys or crystals (seeded per stage)
    const rows = 3 + rng.int(2);
    for (let s = 0; s < rows; s++) {
      const y = H * (0.18 + s * (0.72 / rows)) + rng.next() * 12;
      g.fillStyle = hexA(room.wood, 0.55); g.fillRect(0, y, W, 7);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, y + 7, W, 5);
      let x = rng.next() * 30;
      while (x < W) {
        const w = 16 + rng.next() * 34, h = 18 + rng.next() * 44, kind = rng.int(4);
        g.fillStyle = hexA(rng.next() < 0.5 ? room.glow : room.wood, 0.18 + rng.next() * 0.12);
        g.beginPath();
        if (kind === 0) { rrect(g, x, y - h, w, h, 6); }                               // a jar
        else if (kind === 1) { g.arc(x + w / 2, y - w / 2, w / 2, 0, Math.PI * 2); }   // a ball
        else if (kind === 2) { g.moveTo(x, y); g.lineTo(x + w / 2, y - h); g.lineTo(x + w, y); g.closePath(); } // a crystal / cone
        else { rrect(g, x, y - h * 0.6, w, h * 0.6, 3); }                              // a box
        g.fill();
        x += w + 8 + rng.next() * 26;
      }
    }
    // the room-specific touch
    if (room.id === "globe" || room.id === "cave") for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + rng.next() * 0.35})`; g.beginPath(); g.arc(rng.next() * W, rng.next() * H, 0.6 + rng.next() * 1.8, 0, Math.PI * 2); g.fill(); }
    if (room.id === "forge") for (let i = 0; i < 40; i++) { g.fillStyle = hexA("#ff9a3a", 0.2 + rng.next() * 0.4); g.beginPath(); g.arc(rng.next() * W, H * 0.4 + rng.next() * H * 0.6, 0.8 + rng.next() * 1.6, 0, Math.PI * 2); g.fill(); }
    if (room.id === "garden") for (let i = 0; i < 30; i++) { const x = rng.next() * W, y = rng.next() * H; const gr = g.createRadialGradient(x, y, 0, x, y, 6); gr.addColorStop(0, "rgba(255,240,140,.7)"); gr.addColorStop(1, "rgba(255,240,140,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
    if (room.id === "arcade") { g.strokeStyle = hexA(room.glow, 0.18); g.lineWidth = 1; for (let x = 0; x < W; x += 28) { g.beginPath(); g.moveTo(x, H * 0.62); g.lineTo(W / 2 + (x - W / 2) * 2.4, H); g.stroke(); } for (let y = H * 0.62; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (room.id === "sea") for (let i = 0; i < 5; i++) { g.strokeStyle = hexA(room.glow, 0.12); g.lineWidth = 2; g.beginPath(); const y = H * (0.7 + i * 0.06); for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x / 26 + i) * 4); g.stroke(); }
    // the veil: the jar's area stays darker so the marbles are the brightest thing on screen
    const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.2, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,.42)"); v.addColorStop(1, "rgba(0,0,0,.62)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    this.bg = c;
  }

  // ------------------------------------------------------------ effects
  private burst(x: number, y: number, col: string, n: number, rock = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0, max: 0.5 + Math.random() * 0.4, col, size: rock ? 1.6 + Math.random() * 1.8 : 0.9 + Math.random() * 1.3, rock, star: !rock && Math.random() < 0.35 });
    }
  }
  private ring(x: number, y: number, col: string, r: number) { this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, col, size: r, ring: true }); }
  celebrate() {
    const cols = ["#ffc93c", "#ff4fae", "#4d7bff", "#2fd98a", "#b45cff", "#ff8a2a"];
    for (let i = 0; i < 70; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 80 + Math.random() * 160; this.parts.push({ x: 50, y: 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.2 + Math.random() * 0.6, col: cols[i % cols.length], size: 1 + Math.random() * 1.4, star: true }); }
    this.kick();
  }
  jolt() { this.shake = 9; this.kick(); }

  private handle(e: SimEvent) {
    const s = this.sim!;
    if (e.k === "merge") {
      const col = colOf(e.v), r = rOf(e.v);
      this.burst(e.x, e.y, col, 10 + Math.min(14, Math.log2(e.v) * 1.5));
      this.ring(e.x, e.y, col, r);
      if (e.v >= 128) this.shake = Math.max(this.shake, Math.min(7, Math.log2(e.v) - 5));
      this.hooks.sound("merge", this.pan(e.x), e.chain + Math.max(0, Math.log2(e.v) - 4) * 0.25);
      const p = this.toScreen(e.x, e.y - r - 4);
      this.hooks.float(Math.max(50, Math.min(this.W - 50, p.x)), p.y, e.chain >= 2 ? `Combo ×${e.chain}` : `+${e.gained}`, e.chain >= 3 || e.v >= 256);
    } else if (e.k === "hit") {
      const now = performance.now();
      if (now - this.lastTap > 55) { this.lastTap = now; this.hooks.sound("tap", this.pan(e.x), e.s); }
    } else if (e.k === "crack") { this.burst(e.x, e.y, "#a49cb0", 8, true); this.hooks.sound("crack", this.pan(e.x)); }
    else if (e.k === "smash") { this.burst(e.x, e.y, "#8a8296", 22, true); this.ring(e.x, e.y, "#ffd23f", 9); this.shake = Math.max(this.shake, 5); this.hooks.sound("smash", this.pan(e.x)); }
    else if (e.k === "thaw") { this.burst(e.x, e.y, "#cfefff", 12); this.hooks.sound("thaw", this.pan(e.x)); }
    void s;
  }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    if (this.acc < 0) this.acc = 0;
    const s = this.sim;
    if (s && this.hooks.canPlay() && !this.overflowed) {
      this.acc += dt;
      let n = 0, changed = false;
      while (this.acc >= DT && n < 8) {
        s.step(); this.acc -= DT; n++;
        if (s.events && s.events.length) { for (const e of s.events) { this.handle(e); if (e.k !== "hit") changed = true; } s.events.length = 0; }
      }
      if (n >= 8) this.acc = 0;
      if (changed) this.hooks.changed(s);
      // overflow: a resting marble above the line for too long
      let worst = 0, near = 0;
      for (const b of s.balls) {
        if (b.landed && b.age > 0.8 && b.y - b.r < DANGER) { b.over = (b.over ?? 0) + dt; worst = Math.max(worst, b.over); } else b.over = 0;
        if (b.landed) near = Math.max(near, 1 - (b.y - b.r - DANGER) / 22);
      }
      this.danger += (Math.max(Math.min(1, worst / 2.4) * 1.0, Math.max(0, near) * 0.45) - this.danger) * Math.min(1, dt * 6);
      if (worst > 2.4 && !this.overflowed) { this.overflowed = true; this.jolt(); this.hooks.overflow(); }
      const q = s.isQuiet() && this.cool <= 0;
      if (q && !this.wasQuiet) this.hooks.settled(s);
      this.wasQuiet = q;
    }
    if (this.cool > 0) this.cool -= dt;
    this.shotPop = Math.min(1, this.shotPop + dt * (this.cool > 0 ? 0 : 5));
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt * 0.33; p.y += p.vy * dt * 0.33; p.vy += 260 * dt * 0.33; p.vx *= 0.985; }
    this.parts = this.parts.filter((p) => p.life < p.max);
    this.shake *= Math.pow(0.02, dt);
    this.draw(now / 1000);
    const live = !!s && (!s.isQuiet() || this.cool > 0 || this.shotPop < 1 || this.parts.length > 0 || this.shake > 0.2 || this.danger > 0.02 || s.balls.some((b) => b.age < 0.45));
    if (live || this.aiming) this.kick();
    else setTimeout(this.kick, 120);
  };

  // ------------------------------------------------------------ draw
  private draw(t: number) {
    const g = this.g, d = this.dpr, k = this.k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0); else { g.fillStyle = "#1e0b0b"; g.fillRect(0, 0, this.cv.width, this.cv.height); }
    const sh = this.shake > 0.2 ? (Math.random() - 0.5) * this.shake : 0;
    g.setTransform(d, 0, 0, d, sh * d, (sh * 0.6) * d);
    const s = this.sim, room = this.room;
    if (!s || !room) return;
    const jar = s.jar;
    // the jar's back glass
    g.save();
    g.beginPath(); jar.outline.forEach(([x, y], i) => (i ? g.lineTo(this.sx(x), this.sy(y)) : g.moveTo(this.sx(x), this.sy(y)))); g.closePath();
    const bk = g.createLinearGradient(this.sx(0), 0, this.sx(100), 0);
    bk.addColorStop(0, "rgba(255,255,255,.07)"); bk.addColorStop(0.5, "rgba(10,6,20,.38)"); bk.addColorStop(1, "rgba(255,255,255,.05)");
    g.fillStyle = bk; g.fill();
    g.restore();
    // the danger line
    const dy = this.sy(DANGER), dl = this.danger;
    g.save();
    g.setLineDash([k * 3, k * 2.2]); g.lineWidth = Math.max(1.5, k * 0.5);
    g.strokeStyle = dl > 0.05 ? `rgba(255,${Math.round(90 - dl * 60)},${Math.round(90 - dl * 60)},${0.45 + dl * 0.5 * (0.6 + 0.4 * Math.sin(t * 12))})` : "rgba(255,255,255,.22)";
    if (dl > 0.3) { g.shadowColor = "#ff3040"; g.shadowBlur = 12 * dl; }
    g.beginPath(); g.moveTo(this.sx(jar.left + 1.5), dy); g.lineTo(this.sx(jar.right - 1.5), dy); g.stroke();
    g.restore();
    // pegs and the divider
    for (const p of jar.pegs) {
      const x = this.sx(p.x), y = this.sy(p.y), r = p.r * k;
      const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, room.glow); gr.addColorStop(1, shade(room.glow, -0.5));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (const sg of jar.segs) if (sg.t > 0) { g.strokeStyle = "rgba(220,240,255,.55)"; g.lineWidth = sg.t * 2 * k; g.lineCap = "round"; g.beginPath(); g.moveTo(this.sx(sg.x1), this.sy(sg.y1)); g.lineTo(this.sx(sg.x2), this.sy(sg.y2)); g.stroke(); }
    // the aim guide and the shot
    if (this.hooks.canPlay() && !this.overflowed) {
      const v = this.cur, r = rOf(v);
      let land = JAR_H - r;
      for (const b of s.balls) { const dx = Math.abs(b.x - this.aimX); if (dx < b.r + r) { const yy = b.y - Math.sqrt(Math.max(0, (b.r + r) ** 2 - dx * dx)); if (yy < land) land = yy; } }
      const x = this.sx(this.aimX);
      if (this.cool <= 0) {
        g.save(); g.strokeStyle = hexA(colOf(v), 0.55); g.lineWidth = Math.max(1.5, k * 0.45); g.setLineDash([k * 1.2, k * 2.4]); g.lineDashOffset = -t * 30;
        g.beginPath(); g.moveTo(x, this.sy(SPAWN_Y + r)); g.lineTo(x, this.sy(land)); g.stroke(); g.restore();
        g.globalAlpha = 0.25; this.drawMarble({ v, x: this.aimX, y: land, r, a: 0, age: 9 } as Ball); g.globalAlpha = 1;
        const pop = easeBack(this.shotPop);
        this.drawMarble({ v, x: this.aimX, y: SPAWN_Y, r, a: 0, age: 9 } as Ball, pop);
      }
    }
    // marbles
    for (const b of s.balls) this.drawMarble(b);
    // the jar's front glass: rim, edges and reflections
    g.save();
    g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath(); jar.outline.forEach(([x, y], i) => (i ? g.lineTo(this.sx(x), this.sy(y)) : g.moveTo(this.sx(x), this.sy(y))));
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = k * 2.6; g.stroke();
    g.strokeStyle = "rgba(225,240,255,.75)"; g.lineWidth = k * 1.5; g.stroke();
    g.strokeStyle = hexA(room.glow, 0.35); g.lineWidth = k * 0.5; g.stroke();
    // glints down the walls
    g.globalAlpha = 0.18; g.fillStyle = "#ffffff";
    g.fillRect(this.sx(jar.left + 2.2), this.sy(8), k * 1.6, (JAR_H - 40) * k);
    g.globalAlpha = 0.1; g.fillRect(this.sx(jar.right - 5), this.sy(14), k * 1.1, (JAR_H - 60) * k);
    g.globalAlpha = 1;
    // the rim knobs
    for (const [x] of [jar.outline[0], jar.outline[jar.outline.length - 1]]) { g.fillStyle = "rgba(235,245,255,.9)"; g.beginPath(); g.arc(this.sx(x), this.sy(0), k * 1.6, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // particles
    for (const p of this.parts) {
      const f = p.life / p.max, x = this.sx(p.x), y = this.sy(p.y);
      if (p.ring) { g.strokeStyle = hexA(p.col, 0.8 * (1 - f)); g.lineWidth = k * 1.2 * (1 - f) + 1; g.beginPath(); g.arc(x, y, p.size * k * (1 + f * 1.1), 0, Math.PI * 2); g.stroke(); continue; }
      g.globalAlpha = 1 - f * f; g.fillStyle = p.col;
      const sz = p.size * k * (1 - f * 0.5);
      if (p.star) { star(g, x, y, sz * 1.4, p.life * 6); g.fill(); }
      else if (p.rock) { g.fillRect(x - sz / 2, y - sz / 2, sz, sz); }
      else { g.beginPath(); g.arc(x, y, sz, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // the next marble, top right
    const nr = Math.min(rOf(this.nxt), 7.5);
    const nx = this.sx(Math.min(100 + 2, jar.right + 2)) - nr * k * 0.2, ny = this.sy(SPAWN_Y - 4);
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(nx, ny, nr * k * 0.75 + 5, 0, Math.PI * 2); g.fill();
    g.font = `800 ${Math.max(9, Math.round(k * 2.6))}px system-ui, sans-serif`; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.75)";
    g.fillText("NEXT", nx, ny + nr * k * 0.75 + 16);
    this.drawMarbleAt(this.nxt, nx, ny, nr * k * 0.75, 0);
  }
  private drawMarble(b: Ball, scale = 1) {
    const age = b.age, pop = age < 0.28 ? easeBack(age / 0.28) : 1;
    const R = b.r * this.k * pop * scale;
    if (R < 0.5) return;
    this.drawMarbleAt(b.v, this.sx(b.x), this.sy(b.y), R, b.a, b.ice, b.hp);
  }
  private drawMarbleAt(v: number, x: number, y: number, R: number, a: number, ice = false, hp = 2) {
    const g = this.g, sp = this.marble(v, !!ice, hp ?? 2), d = this.dpr;
    const full = rOf(v) * this.k;
    const sc = R / Math.max(0.01, full);
    const w = (sp.width / d) * sc;
    // a soft contact shadow
    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x + R * 0.12, y + R * 0.18, R, R * 0.96, 0, 0, Math.PI * 2); g.fill();
    if (a && v !== ROCK) { g.save(); g.translate(x, y); g.rotate(a); g.drawImage(sp, -w / 2, -w / 2, w, w); g.restore(); }
    else g.drawImage(sp, x - w / 2, y - w / 2, w, w);
    if (v !== ROCK) { const sh = this.shine(full * d); const sw = (sh.width / d) * sc; g.drawImage(sh, x - sw / 2, y - sw / 2, sw, sw); }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect(); this.io.disconnect();
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.kick);
    this.cv.remove();
  }
}

function easeBack(t: number) { const c = 1.9; t = Math.max(0, Math.min(1, t)); return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
