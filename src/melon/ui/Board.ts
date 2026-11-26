// The Melon Merge Fiesta board: a wooden festival crate drawn in 2D on one canvas (light on any phone), running the
// fruit physics live. Fruits are painted once per kind and size — cherry, strawberry, grape, lemon, orange, apple, pear,
// peach, pineapple, melon and the watermelon — each with its own skin (seeds, dimples, net, stripes, a crown or a leaf)
// and a cute face that blinks now and then. Walnuts show their cracks; jelly-wrapped fruit wobbles in pink jelly. The
// market stall behind the crate (bunting, string lights, an awning, crates of produce, placed by the stage number) is
// painted once per stage and dimmed. Slide to aim, release to drop; merges burst into juice. Keyboard: ← → and space.
import { DANGER, DT, JAR_H, ROCK, SPAWN_Y, Sim, jarOf, levelOf, rOf, type Ball, type SimEvent } from "../physics";
import { rngFrom } from "../../sudoku/rng";
import type { Game } from "../play";
import type { Room, StageDef } from "../stage";

export type BoardSound = "aim" | "drop" | "tap" | "merge" | "crack" | "smash" | "thaw" | "hammer" | "bomb" | "shake";
export interface BoardHooks {
  canPlay: () => boolean;
  /** the player releases a drop at world x: returns the marble to drop, or null */
  take: (x: number) => number | null;
  /** score, best or rocks changed (after merges / smashes) */
  changed: (sim: Sim) => void;
  /** the crate has come to rest */
  settled: (sim: Sim) => void;
  overflow: () => void;
  hammerArmed: () => boolean;
  hammered: () => void;
  bombArmed: () => boolean;
  bombed: () => void;
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

/** the fruits by level (2 = cherry … 2048 = watermelon) */
export const FRUITS = [
  { name: "", col: "#888888", skin: "" },
  { name: "Cherry", col: "#e8203a", skin: "cherry" },
  { name: "Strawberry", col: "#ff3d5a", skin: "berry" },
  { name: "Grape", col: "#8a4cd8", skin: "grape" },
  { name: "Lemon", col: "#ffd93a", skin: "lemon" },
  { name: "Orange", col: "#ff8a1f", skin: "orange" },
  { name: "Apple", col: "#ff3f3f", skin: "apple" },
  { name: "Pear", col: "#c6dc3e", skin: "pear" },
  { name: "Peach", col: "#ffa47e", skin: "peach" },
  { name: "Pineapple", col: "#ffc531", skin: "pine" },
  { name: "Melon", col: "#a8e070", skin: "melon" },
  { name: "Watermelon", col: "#2fa84a", skin: "water" },
  { name: "Golden Melon", col: "#ffd23f", skin: "water" },
];
export const fruitOf = (v: number) => FRUITS[levelOf(v)];
export const colOf = (v: number) => (v < 0 ? "#8a6240" : fruitOf(v).col);

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean; rock?: boolean; star?: boolean }

export class MelonBoard {
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
    // the crate (100 × 150) plus room above it for the shot marble
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
    if (this.hooks.bombArmed()) { this.bombAt(p.x, p.y); return; }
    this.aiming = true;
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    this.setAim(p.x);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.sim || this.hooks.hammerArmed() || this.hooks.bombArmed()) return;
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
  /** the Bomb booster: a juicy blast that clears the fruit around the tap */
  private bombAt(x: number, y: number) {
    const s = this.sim; if (!s || y < -4 || y > JAR_H + 4) return;
    const gone = s.bomb(x, Math.max(10, y));
    if (s.events) { for (const e of s.events) this.handle(e); s.events.length = 0; }
    for (const b of gone) this.burst(b.x, b.y, colOf(b.v), 10);
    this.burst(x, y, "#ffd23f", 26); this.ring(x, y, "#ff7a2a", 16); this.ring(x, y, "#ffffff", 9);
    this.shake = Math.max(this.shake, 10);
    this.hooks.sound("bomb", this.pan(x));
    this.hooks.bombed();
    this.hooks.changed(s);
    this.kick();
  }
  /** the Shake booster: every fruit jumps and resettles */
  shakeAll() {
    const s = this.sim; if (!s) return;
    s.shake(Math.floor(performance.now()));
    this.shake = Math.max(this.shake, 8);
    this.hooks.sound("shake", 0);
    this.kick();
  }
  aimRange() { return this.sim ? this.sim.aimRange(this.cur) : ([10, 90] as const); }
  isQuiet() { return !this.sim || this.sim.isQuiet(); }
  get busy() { return !!this.sim && (!this.sim.isQuiet() || this.cool > 0); }

  // ------------------------------------------------------------ sprites
  private marble(v: number, ice = false, hp = 2, blink = false): HTMLCanvasElement {
    const R = Math.max(4, rOf(v) * this.k * this.dpr);
    const key = `${v}:${ice ? 1 : 0}:${hp}:${blink ? 1 : 0}:${Math.round(R)}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const pad = Math.ceil(R * 0.42) + 2, S = Math.ceil(R * 2 + pad * 2);
    c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d")!, cx = S / 2, cy = S / 2;
    if (v === ROCK) {
      // a walnut: a ridged brown shell with a seam
      const gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      gr.addColorStop(0, "#d8a878"); gr.addColorStop(0.6, "#9a6a40"); gr.addColorStop(1, "#5a3a1e");
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, rr = R * (0.93 + (i % 2) * 0.06); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(60,30,10,.55)"; g.lineWidth = R * 0.07; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx, cy - R * 0.92); g.bezierCurveTo(cx + R * 0.15, cy - R * 0.3, cx - R * 0.15, cy + R * 0.3, cx, cy + R * 0.92); g.stroke();
      g.lineWidth = R * 0.04;
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx + sx * R * 0.45, cy - R * 0.45 + i * R * 0.45, R * 0.22, sx > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, sx > 0 ? Math.PI * 1.4 : Math.PI * 0.4); g.stroke(); }
      if (hp <= 1) {
        g.strokeStyle = "#fff3c0"; g.lineWidth = R * 0.08; g.shadowColor = "#ffb000"; g.shadowBlur = R * 0.3;
        g.beginPath(); g.moveTo(cx - R * 0.6, cy - R * 0.4); g.lineTo(cx - R * 0.1, cy - R * 0.05); g.lineTo(cx - R * 0.3, cy + R * 0.35); g.lineTo(cx + R * 0.15, cy + R * 0.7);
        g.moveTo(cx - R * 0.1, cy - R * 0.05); g.lineTo(cx + R * 0.55, cy - R * 0.3); g.stroke();
      }
      this.sprites.set(key, c); return c;
    }
    const f = fruitOf(v), col = f.col, lv = levelOf(v);
    const body = (rx = R, ry = R) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
    // stems and leaves behind/above the fruit
    const stem = (len: number, lean = 0.2) => { g.strokeStyle = "#6a4a1e"; g.lineWidth = R * 0.09; g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy - R * 0.82); g.quadraticCurveTo(cx + R * lean, cy - R * (0.9 + len * 0.6), cx + R * lean * 1.6, cy - R * (0.85 + len)); g.stroke(); };
    const leaf = (ang: number, size = 0.42, colL = "#4cc24a") => {
      g.save(); g.translate(cx + R * 0.12, cy - R * 0.88); g.rotate(ang);
      const lg = g.createLinearGradient(0, 0, R * size, 0); lg.addColorStop(0, shade(colL, -0.2)); lg.addColorStop(1, shade(colL, 0.2));
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(R * size * 0.5, -R * size * 0.45, R * size, 0); g.quadraticCurveTo(R * size * 0.5, R * size * 0.3, 0, 0); g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = R * 0.025; g.beginPath(); g.moveTo(R * 0.04, 0); g.lineTo(R * size * 0.85, -R * 0.02); g.stroke();
      g.restore();
    };
    if (f.skin === "cherry") { stem(0.55, 0.25); leaf(-0.5, 0.4); }
    if (f.skin === "apple" || f.skin === "pear") { stem(0.3, 0.12); leaf(-0.3, 0.45); }
    if (f.skin === "orange" || f.skin === "peach" || f.skin === "lemon") leaf(-0.4, 0.38, f.skin === "peach" ? "#5ab04a" : "#3fae3f");
    if (f.skin === "pine") {
      // the spiky crown
      g.fillStyle = "#3a9a3a";
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * R * 0.16 - R * 0.12, cy - R * 0.78); g.lineTo(cx + i * R * 0.22, cy - R * (1.25 - Math.abs(i) * 0.12)); g.lineTo(cx + i * R * 0.16 + R * 0.12, cy - R * 0.78); g.fill(); }
      g.fillStyle = "#5ac45a";
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * R * 0.18 - R * 0.08, cy - R * 0.8); g.lineTo(cx + i * R * 0.2, cy - R * 1.12); g.lineTo(cx + i * R * 0.18 + R * 0.08, cy - R * 0.8); g.fill(); }
    }
    if (f.skin === "berry") {
      g.fillStyle = "#3fae3f";
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.32, cy - R * 0.82 + Math.sin(a + Math.PI / 2) * R * 0.05, R * 0.26, R * 0.1, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
    }
    // the body with a soft 3D shade
    if (v >= 1024) { g.shadowColor = col; g.shadowBlur = R * 0.25; }
    const gr = g.createRadialGradient(cx - R * 0.32, cy - R * 0.36, R * 0.06, cx, cy, R * 1.02);
    gr.addColorStop(0, shade(col, 0.42)); gr.addColorStop(0.5, col); gr.addColorStop(0.9, shade(col, -0.25)); gr.addColorStop(1, shade(col, -0.4));
    g.fillStyle = gr; body(); g.fill();
    g.shadowBlur = 0;
    g.save(); body(); g.clip();
    // skins
    if (f.skin === "berry") { g.fillStyle = "#ffe27a"; for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = R * Math.sqrt((i + 0.5) / 26) * 0.92; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * 0.035, R * 0.055, a, 0, Math.PI * 2); g.fill(); } }
    if (f.skin === "grape") { for (let i = 0; i < 9; i++) { const a = i * 2.1, rr = R * (0.25 + (i % 3) * 0.24); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; const gg = g.createRadialGradient(x - R * 0.06, y - R * 0.06, 0, x, y, R * 0.24); gg.addColorStop(0, "rgba(255,255,255,.28)"); gg.addColorStop(1, "rgba(60,20,110,.25)"); g.fillStyle = gg; g.beginPath(); g.arc(x, y, R * 0.24, 0, Math.PI * 2); g.fill(); } }
    if (f.skin === "orange" || f.skin === "lemon") { g.fillStyle = "rgba(160,70,0,.14)"; for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = R * Math.sqrt((i + 0.5) / 40) * 0.95; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * 0.03, 0, Math.PI * 2); g.fill(); } }
    if (f.skin === "peach") { g.strokeStyle = "rgba(200,80,60,.35)"; g.lineWidth = R * 0.05; g.beginPath(); g.moveTo(cx + R * 0.1, cy - R * 0.95); g.quadraticCurveTo(cx + R * 0.45, cy - R * 0.1, cx + R * 0.15, cy + R * 0.9); g.stroke(); const pg = g.createRadialGradient(cx + R * 0.5, cy + R * 0.3, 0, cx + R * 0.5, cy + R * 0.3, R * 0.8); pg.addColorStop(0, "rgba(255,90,90,.35)"); pg.addColorStop(1, "rgba(255,90,90,0)"); g.fillStyle = pg; g.fillRect(cx - R, cy - R, R * 2, R * 2); }
    if (f.skin === "pine") { g.strokeStyle = "rgba(150,90,0,.45)"; g.lineWidth = R * 0.045; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(cx + i * R * 0.3 - R, cy - R); g.lineTo(cx + i * R * 0.3 + R, cy + R); g.stroke(); g.beginPath(); g.moveTo(cx + i * R * 0.3 + R, cy - R); g.lineTo(cx + i * R * 0.3 - R, cy + R); g.stroke(); } }
    if (f.skin === "melon") { g.strokeStyle = "rgba(255,255,220,.55)"; g.lineWidth = R * 0.03; for (let i = 0; i < 14; i++) { const a = i * 0.9; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.bezierCurveTo(cx + Math.cos(a + 1) * R * 0.3, cy + Math.sin(a + 1.3) * R * 0.3, cx + Math.cos(a + 2) * R * 0.5, cy + Math.sin(a + 2) * R * 0.5, cx + Math.cos(a + 2.6) * R, cy + Math.sin(a + 2.6) * R); g.stroke(); } }
    if (f.skin === "water") { g.fillStyle = "rgba(10,70,20,.75)"; for (let i = -3; i <= 3; i++) { g.beginPath(); const x0 = cx + i * R * 0.34; g.moveTo(x0, cy - R); for (let y = -R; y <= R; y += R * 0.1) g.lineTo(x0 + Math.sin(y / R * 6 + i) * R * 0.05 + (y / R) * i * R * 0.12, cy + y); for (let y = R; y >= -R; y -= R * 0.1) g.lineTo(x0 + R * 0.1 + Math.sin(y / R * 6 + i) * R * 0.05 + (y / R) * i * R * 0.12, cy + y); g.fill(); } }
    if (f.skin === "apple" || f.skin === "pear") { const ag = g.createRadialGradient(cx + R * 0.4, cy + R * 0.35, 0, cx + R * 0.4, cy + R * 0.35, R * 0.7); ag.addColorStop(0, f.skin === "pear" ? "rgba(255,170,60,.3)" : "rgba(255,230,120,.22)"); ag.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = ag; g.fillRect(cx - R, cy - R, R * 2, R * 2); }
    g.restore();
    // the face: eyes (or a blink), blush and a smile — bigger fruits look happier
    const ey = cy + R * 0.02, ex = R * 0.3, er = Math.max(1.2, R * (lv >= 9 ? 0.09 : 0.11));
    const dark = lv === 11 ? "#0b2a10" : "#3a1a1a";
    if (blink) { g.strokeStyle = dark; g.lineWidth = Math.max(1, er * 0.6); g.lineCap = "round"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * ex, ey, er * 0.9, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } }
    else for (const sx of [-1, 1]) {
      g.fillStyle = lv === 11 ? "#fff" : dark; g.beginPath(); g.ellipse(cx + sx * ex, ey, er, er * 1.2, 0, 0, Math.PI * 2); g.fill();
      if (lv === 11) { g.fillStyle = dark; g.beginPath(); g.ellipse(cx + sx * ex, ey + er * 0.15, er * 0.65, er * 0.8, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#fff"; g.beginPath(); g.arc(cx + sx * ex - er * 0.3, ey - er * 0.4, er * 0.38, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(255,110,140,.45)";
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * R * 0.5, cy + R * 0.22, R * 0.13, R * 0.08, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = dark; g.lineWidth = Math.max(1, R * 0.05); g.lineCap = "round";
    g.beginPath(); g.arc(cx, cy + R * 0.14, R * (lv >= 8 ? 0.16 : 0.11), Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    if (ice) {
      // a wobbly pink jelly wrap
      g.fillStyle = "rgba(255,150,210,.42)"; g.beginPath();
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, rr = R * (1.06 + Math.sin(a * 5) * 0.03); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = R * 0.07; g.beginPath(); g.arc(cx, cy, R * 0.95, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(cx + R * 0.45, cy - R * 0.5, R * 0.08, 0, Math.PI * 2); g.fill();
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

  // ------------------------------------------------------------ the room behind the crate
  private paintBackground() {
    const room = this.room, d = this.dpr, W = this.W, H = this.H;
    if (!room) return;
    const c = this.bg ?? document.createElement("canvas");
    c.width = Math.round(W * d); c.height = Math.round(H * d);
    const g = c.getContext("2d")!;
    g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`melon-bg:${room.id}:${this.def?.stage ?? 1}`);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, room.sky[0]); sky.addColorStop(0.55, room.sky[1]); sky.addColorStop(1, room.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // soft lamps / bokeh
    for (let i = 0; i < 12; i++) {
      const x = rng.next() * W, y = rng.next() * H * 0.8, r = 20 + rng.next() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hexA(i % 3 ? room.glow : "#ffffff", 0.16)); gr.addColorStop(1, hexA(room.glow, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // the stall awning: candy stripes with a scalloped edge
    const aw = H * 0.12, stripe = 34 + rng.int(12), c2 = room.id === "night" ? "#2a2a5a" : "#fff4e0";
    for (let x = 0, i = 0; x < W; x += stripe, i++) { g.fillStyle = hexA(i % 2 ? c2 : room.glow, 0.5); g.fillRect(x, 0, stripe, aw); }
    for (let x = 0, i = 0; x < W + stripe; x += stripe / 2, i++) { g.fillStyle = hexA(i % 2 ? c2 : room.glow, 0.5); g.beginPath(); g.arc(x + stripe / 4, aw, stripe / 4, 0, Math.PI); g.fill(); }
    // bunting and string lights
    for (let row = 0; row < 2; row++) {
      const y0 = aw + 30 + row * H * 0.16, sag = 18 + rng.next() * 14, n = 9;
      g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i <= 40; i++) { const x = (i / 40) * W; g.lineTo(x, y0 + Math.sin((i / 40) * Math.PI) * sag); } g.stroke();
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = u * W, y = y0 + Math.sin(u * Math.PI) * sag;
        if (row === 0) { g.fillStyle = hexA(["#ff5f6a", "#ffd23f", "#4fd08a", "#4fb8ff", "#c07aff"][i % 5], 0.55); g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.lineTo(x, y + 18); g.fill(); }
        else { const gl = g.createRadialGradient(x, y + 4, 0, x, y + 4, 14); gl.addColorStop(0, "rgba(255,236,170,.7)"); gl.addColorStop(1, "rgba(255,236,170,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y + 4, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,246,210,.9)"; g.beginPath(); g.arc(x, y + 4, 2.6, 0, Math.PI * 2); g.fill(); }
      }
    }
    // the counter: crates of produce along the bottom and on shelves
    const fruitCols = ["#e8203a", "#ff8a1f", "#ffd93a", "#8a4cd8", "#a8e070", "#ff3d5a", "#2fa84a"];
    for (let s = 0; s < 2; s++) {
      const y = H * (0.62 + s * 0.24);
      g.fillStyle = hexA(room.wood, 0.55); g.fillRect(0, y, W, 9);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, y + 9, W, 6);
      let x = rng.next() * 20;
      while (x < W) {
        const w = 46 + rng.next() * 40, h = 22 + rng.next() * 12, fc = fruitCols[rng.int(fruitCols.length)];
        for (let k = 0; k < Math.floor(w / 13); k++) { g.fillStyle = hexA(fc, 0.4); g.beginPath(); g.arc(x + 8 + k * 13, y - h + 2 - (k % 2) * 4, 7, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = hexA(room.wood, 0.6); g.fillRect(x, y - h + 6, w, h - 6);
        g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x, y - h / 2, w, 2);
        x += w + 10 + rng.next() * 30;
      }
    }
    // the market's own touch
    if (room.id === "green") for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rng.next() * 0.4})`; g.beginPath(); g.arc(rng.next() * W, rng.next() * H, 0.8 + rng.next() * 2, 0, Math.PI * 2); g.fill(); }
    if (room.id === "beach") { for (const sx of [0.06, 0.94]) { const x = W * sx, y0 = H * 0.5; g.strokeStyle = hexA("#8a5a2a", 0.5); g.lineWidth = 7; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + 10, H * 0.7, x, y0); g.stroke(); g.fillStyle = hexA("#2fa84a", 0.45); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 26, y0 + Math.sin(a) * 10, 30, 7, a, 0, Math.PI * 2); g.fill(); } } }
    if (room.id === "night") for (let i = 0; i < 7; i++) { const x = rng.next() * W, y = aw + 20 + rng.next() * H * 0.3; const gl = g.createRadialGradient(x, y, 0, x, y, 26); gl.addColorStop(0, "rgba(255,120,60,.55)"); gl.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,80,50,.75)"; g.beginPath(); g.ellipse(x, y, 9, 12, 0, 0, Math.PI * 2); g.fill(); }
    if (room.id === "vine" || room.id === "berry") for (let i = 0; i < 24; i++) { const x = rng.next() * W, y = rng.next() * H * 0.55; g.fillStyle = hexA(room.id === "vine" ? "#7a2a8a" : "#e8203a", 0.35); g.beginPath(); g.arc(x, y, 3 + rng.next() * 3, 0, Math.PI * 2); g.fill(); }
    if (room.id === "smoothie") for (let i = 0; i < 18; i++) { const x = rng.next() * W, y = rng.next() * H; g.strokeStyle = hexA("#ffffff", 0.18); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 4 + rng.next() * 8, 0, Math.PI * 2); g.stroke(); }
    if (room.id === "citrus") for (let i = 0; i < 14; i++) { const x = rng.next() * W, y = rng.next() * H * 0.6; g.fillStyle = hexA("#3fae3f", 0.3); g.beginPath(); g.ellipse(x, y, 14, 6, rng.next() * 3, 0, Math.PI * 2); g.fill(); }
    // the veil: the crate's area stays darker so the marbles are the brightest thing on screen
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
    const cols = ["#ffd93a", "#ff3d5a", "#4fd08a", "#ff8a1f", "#8a4cd8", "#4fb8ff"];
    for (let i = 0; i < 70; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 80 + Math.random() * 160; this.parts.push({ x: 50, y: 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.2 + Math.random() * 0.6, col: cols[i % cols.length], size: 1 + Math.random() * 1.4, star: true }); }
    this.kick();
  }
  jolt() { this.shake = 9; this.kick(); }

  private handle(e: SimEvent) {
    const s = this.sim!;
    if (e.k === "merge") {
      const col = colOf(e.v), r = rOf(e.v);
      this.burst(e.x, e.y, col, 14 + Math.min(18, Math.log2(e.v) * 2));
      this.burst(e.x, e.y, "#ffffff", 4);
      this.ring(e.x, e.y, col, r);
      if (e.v >= 128) this.shake = Math.max(this.shake, Math.min(7, Math.log2(e.v) - 5));
      this.hooks.sound("merge", this.pan(e.x), e.chain + Math.max(0, Math.log2(e.v) - 4) * 0.25);
      const p = this.toScreen(e.x, e.y - r - 4);
      this.hooks.float(Math.max(50, Math.min(this.W - 50, p.x)), p.y, e.chain >= 2 ? `Combo ×${e.chain}` : `+${e.gained}`, e.chain >= 3 || e.v >= 256);
    } else if (e.k === "hit") {
      const now = performance.now();
      if (now - this.lastTap > 55) { this.lastTap = now; this.hooks.sound("tap", this.pan(e.x), e.s); }
    } else if (e.k === "crack") { this.burst(e.x, e.y, "#b07a4a", 8, true); this.hooks.sound("crack", this.pan(e.x)); }
    else if (e.k === "smash") { this.burst(e.x, e.y, "#8a5a30", 22, true); this.ring(e.x, e.y, "#ffd23f", 9); this.shake = Math.max(this.shake, 5); this.hooks.sound("smash", this.pan(e.x)); }
    else if (e.k === "thaw") { this.burst(e.x, e.y, "#ff9ad0", 14); this.hooks.sound("thaw", this.pan(e.x)); }
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
  private clock = 0;
  private draw(t: number) {
    this.clock = t;
    const g = this.g, d = this.dpr, k = this.k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0); else { g.fillStyle = "#2a1608"; g.fillRect(0, 0, this.cv.width, this.cv.height); }
    const sh = this.shake > 0.2 ? (Math.random() - 0.5) * this.shake : 0;
    g.setTransform(d, 0, 0, d, sh * d, (sh * 0.6) * d);
    const s = this.sim, room = this.room;
    if (!s || !room) return;
    const jar = s.jar;
    // the crate's back panel: wooden slats
    g.save();
    g.beginPath(); jar.outline.forEach(([x, y], i) => (i ? g.lineTo(this.sx(x), this.sy(y)) : g.moveTo(this.sx(x), this.sy(y)))); g.closePath();
    g.clip();
    g.fillStyle = "rgba(20,10,4,.55)"; g.fillRect(this.sx(-2), this.sy(-2), 104 * k, (JAR_H + 4) * k);
    for (let y = 0; y < JAR_H; y += 15) { g.fillStyle = hexA(room.wood, (y / 15) % 2 ? 0.16 : 0.22); g.fillRect(this.sx(0), this.sy(y), 100 * k, 13.5 * k); }
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
    // the crate's frame: thick wooden posts with nails, a festival ribbon on the rim
    g.save();
    g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath(); jar.outline.forEach(([x, y], i) => (i ? g.lineTo(this.sx(x), this.sy(y)) : g.moveTo(this.sx(x), this.sy(y))));
    g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = k * 4.4; g.stroke();
    g.strokeStyle = shade(room.wood, 0.1); g.lineWidth = k * 3.2; g.stroke();
    g.strokeStyle = hexA("#ffe2b0", 0.35); g.lineWidth = k * 0.8; g.stroke();
    for (const [x, y] of jar.outline) { g.fillStyle = "#d8c8a0"; g.beginPath(); g.arc(this.sx(x), this.sy(y), k * 0.7, 0, Math.PI * 2); g.fill(); }
    // the rim posts and a ribbon bow on each
    for (const [x] of [jar.outline[0], jar.outline[jar.outline.length - 1]]) {
      g.fillStyle = shade(room.wood, 0.2); rrect(g, this.sx(x) - k * 2.4, this.sy(-3), k * 4.8, k * 5, k * 1.2); g.fill();
      g.fillStyle = room.glow; g.beginPath(); g.ellipse(this.sx(x) - k * 2, this.sy(-1), k * 2, k * 1.2, -0.4, 0, Math.PI * 2); g.ellipse(this.sx(x) + k * 2, this.sy(-1), k * 2, k * 1.2, 0.4, 0, Math.PI * 2); g.fill();
    }
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
    const blink = ((this.clock * 0.6 + b.id * 1.37) % 4.2) < 0.14;
    this.drawMarbleAt(b.v, this.sx(b.x), this.sy(b.y), R, b.a * 0.35, b.ice, b.hp, blink);
  }
  private drawMarbleAt(v: number, x: number, y: number, R: number, a: number, ice = false, hp = 2, blink = false) {
    const g = this.g, sp = this.marble(v, !!ice, hp ?? 2, blink), d = this.dpr;
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
