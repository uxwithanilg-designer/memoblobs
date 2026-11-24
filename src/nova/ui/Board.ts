// The Merge Nova board, drawn in 2D on one canvas (light on any phone). Number blocks are painted once per value and
// size: a rounded neon block with a glossy top, a bright rim and the number (2 … 1K, 2K…), bigger numbers glowing
// harder. Asteroid stones show their cracks; frozen numbers wear a frosted shell. The galaxy (nebula clouds, stars,
// a planet or two, placed by the stage number) is painted once per stage and dimmed behind the board.
// Move over a column (or tap it) to aim — the shot block hovers above it with a landing ghost — and drop: the block
// falls with a squash, equal neighbours fly into it, the result pops with a ring and sparks, the rest falls, and the
// chain reaction plays out step by step with rising pitch. Keyboard: ← → to aim, space / ↓ to drop.
import { COLS, ROWS, STONE, label, landingRow, type Board, type DropResult } from "../engine";
import { rngFrom } from "../../sudoku/rng";
import type { Game } from "../play";
import type { Galaxy } from "../stage";

export type BoardSound = "aim" | "drop" | "land" | "merge" | "crack" | "smash" | "thaw" | "hammer";
export interface BoardHooks {
  drop: (col: number) => { res: DropResult; game: Game } | null;
  canPlay: () => boolean;
  hammerArmed: () => boolean;
  hammer: (i: number) => void;
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

/** block colours by power of two (2 = index 1) */
const COL = ["#888", "#ff4f8a", "#3fd36b", "#2fb4ff", "#ff9a2f", "#ff4a4a", "#a65cff", "#ffd23f", "#2f6fff", "#1fd0b0", "#ff5fd0", "#ffb000", "#7a5cff", "#ff3a6a", "#3affc8", "#ffe27a", "#ffffff"];
const colOf = (v: number) => COL[Math.min(COL.length - 1, Math.round(Math.log2(Math.max(2, v))))];

interface Fly { v: number; x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; squash?: boolean }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean; rock?: boolean }

export class NovaBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private T = 60; private gap = 6; private ox = 0; private oy = 0; private shooterY = 0;
  private game: Game | null = null; private galaxy: Galaxy | null = null; private stageN = 1;
  private show: Board | null = null;
  private hidden = new Set<number>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private aimCol = 2; private aimX = 0;
  private flies: Fly[] = [];
  private pops = new Map<number, number>();
  private landSq = new Map<number, number>();
  private parts: Part[] = [];
  private stars: { x: number; y: number; r: number; ph: number }[] = [];
  private shake = 0;
  private busy = false; private born = 0;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver;

  constructor(private el: HTMLElement, private hooks: BoardHooks) {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    el.appendChild(this.cv);
    this.cv.addEventListener("pointermove", this.onMove);
    this.cv.addEventListener("pointerdown", this.onMove);
    this.cv.addEventListener("pointerup", this.onUp);
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
    // the board plus one block of room above it for the shooter
    const T = Math.min((w - 24) / (COLS + (COLS - 1) * 0.1), (h - 24) / (ROWS + 1.6 + ROWS * 0.1), 84);
    this.T = T; this.gap = T * 0.1;
    const bw = COLS * T + (COLS - 1) * this.gap, bh = ROWS * T + (ROWS - 1) * this.gap;
    this.ox = (w - bw) / 2;
    this.oy = Math.max(T * 1.4, (h - bh - T * 1.4) / 2 + T * 1.4);
    this.shooterY = this.oy - T * 0.85;
    this.aimX = this.colX(this.aimCol);
    this.sprites.clear();
    this.paintBackground();
    this.kick();
  }
  private colX(c: number) { return this.ox + c * (this.T + this.gap) + this.T / 2; }
  private cellXY(i: number) { const r = Math.floor(i / COLS), c = i % COLS; return { x: this.colX(c), y: this.oy + r * (this.T + this.gap) + this.T / 2 }; }
  cellScreen(i: number) { return this.cellXY(i); }
  columnScreen(c: number) { return { x: this.colX(c), y: this.oy + ROWS * (this.T + this.gap) * 0.5 }; }
  private clampX(x: number) { return Math.max(this.T * 1.3, Math.min(this.W - this.T * 1.3, x)); }
  private pan(c: number) { return ((c + 0.5) / COLS * 2 - 1) * 0.8; }

  // ------------------------------------------------------------ sprites
  private block(v: number, ice = false, hp = 2): HTMLCanvasElement {
    const key = `${v}:${ice ? 1 : 0}:${hp}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const d = this.dpr, T = this.T * d, pad = Math.ceil(T * 0.18);
    c = document.createElement("canvas"); c.width = c.height = Math.ceil(T + pad * 2);
    const g = c.getContext("2d")!, x = pad, y = pad, r = T * 0.2;
    if (v === STONE) {
      g.fillStyle = "#3a3548"; rr(g, x, y, T, T, r); g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + T); gr.addColorStop(0, "#7a7290"); gr.addColorStop(1, "#4a445a");
      g.fillStyle = gr; rr(g, x + T * 0.04, y + T * 0.04, T * 0.92, T * 0.86, r * 0.9); g.fill();
      g.fillStyle = "rgba(0,0,0,.25)"; for (const [cx, cy, cr] of [[0.3, 0.35, 0.1], [0.68, 0.6, 0.13], [0.4, 0.72, 0.07]]) { g.beginPath(); g.arc(x + cx * T, y + cy * T, cr * T, 0, Math.PI * 2); g.fill(); }
      if (hp <= 1) { g.strokeStyle = "#ffd23f"; g.lineWidth = T * 0.045; g.beginPath(); g.moveTo(x + T * 0.2, y + T * 0.15); g.lineTo(x + T * 0.45, y + T * 0.45); g.lineTo(x + T * 0.35, y + T * 0.62); g.lineTo(x + T * 0.6, y + T * 0.88); g.moveTo(x + T * 0.45, y + T * 0.45); g.lineTo(x + T * 0.78, y + T * 0.35); g.stroke(); }
    } else {
      const col = colOf(v), big = v >= 128;
      if (big) { g.shadowColor = col; g.shadowBlur = T * (v >= 1024 ? 0.35 : 0.2); }
      g.fillStyle = shade(col, -0.35); rr(g, x, y + T * 0.06, T, T * 0.94, r); g.fill();
      g.shadowBlur = 0;
      const gr = g.createLinearGradient(0, y, 0, y + T); gr.addColorStop(0, shade(col, 0.25)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.15));
      g.fillStyle = gr; rr(g, x, y, T, T * 0.92, r); g.fill();
      g.fillStyle = "rgba(255,255,255,.28)"; rr(g, x + T * 0.08, y + T * 0.06, T * 0.84, T * 0.3, r * 0.7); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = T * 0.03; rr(g, x + T * 0.02, y + T * 0.02, T * 0.96, T * 0.88, r); g.stroke();
      const txt = label(v), fs = T * (txt.length >= 4 ? 0.34 : txt.length === 3 ? 0.4 : 0.48);
      g.font = `900 ${Math.round(fs)}px 'Lilita One', system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = T * 0.07; g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeText(txt, x + T / 2, y + T * 0.48);
      g.fillStyle = "#ffffff"; g.fillText(txt, x + T / 2, y + T * 0.48);
      if (ice) {
        g.fillStyle = "rgba(210,240,255,.55)"; rr(g, x, y, T, T * 0.92, r); g.fill();
        g.strokeStyle = "#ffffff"; g.lineWidth = T * 0.05; rr(g, x + T * 0.03, y + T * 0.03, T * 0.94, T * 0.86, r); g.stroke();
        g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = T * 0.025; g.beginPath(); g.moveTo(x + T * 0.15, y + T * 0.3); g.lineTo(x + T * 0.35, y + T * 0.15); g.moveTo(x + T * 0.65, y + T * 0.8); g.lineTo(x + T * 0.85, y + T * 0.62); g.stroke();
      }
    }
    this.sprites.set(key, c);
    return c;
  }
  private drawBlock(v: number, x: number, y: number, sx = 1, sy = 1, alpha = 1, ice = false, hp = 2) {
    const sp = this.block(v, ice, hp), d = this.dpr, s = sp.width / d, g = this.g;
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(sx, sy); g.drawImage(sp, -s / 2, -s / 2, s, s); g.restore();
  }

  // ------------------------------------------------------------ the galaxy (painted once per stage)
  private paintBackground() {
    const gx = this.galaxy; if (!gx) return;
    const w = this.W, h = this.H, d = this.dpr;
    const c = this.bg ?? document.createElement("canvas"); this.bg = c;
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    const g = c.getContext("2d")!; g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`nova-bg:${this.stageN}`);
    const sky = g.createLinearGradient(0, 0, w * 0.3, h);
    sky.addColorStop(0, gx.sky[0]); sky.addColorStop(0.5, gx.sky[1]); sky.addColorStop(1, gx.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // nebula clouds in the galaxy's glow, somewhere new each stage
    for (let i = 0; i < 5; i++) {
      const x = rng.next() * w, y = rng.next() * h, r = Math.max(w, h) * (0.2 + rng.next() * 0.3);
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, hexA(gx.glow, 0.22)); ng.addColorStop(1, hexA(gx.glow, 0));
      g.fillStyle = ng; g.fillRect(0, 0, w, h);
    }
    // a planet (with a ring sometimes)
    const px = rng.next() * w, py = rng.next() * h * 0.5, pr = Math.min(w, h) * (0.08 + rng.next() * 0.1);
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, shade(gx.glow, 0.4)); pg.addColorStop(1, shade(gx.glow, -0.6));
    g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    if (rng.next() < 0.6) { g.strokeStyle = hexA(gx.glow, 0.5); g.lineWidth = pr * 0.12; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.45, -0.3, 0, Math.PI * 2); g.stroke(); }
    // dim it all; then the board panel with its column lanes
    g.fillStyle = "rgba(0,0,8,.4)"; g.fillRect(0, 0, w, h);
    const bw = COLS * this.T + (COLS - 1) * this.gap, bh = ROWS * this.T + (ROWS - 1) * this.gap;
    g.fillStyle = "rgba(10,10,30,.55)"; rr(g, this.ox - this.gap * 1.5, this.oy - this.gap * 1.5, bw + this.gap * 3, bh + this.gap * 3, this.T * 0.25); g.fill();
    g.strokeStyle = hexA(gx.glow, 0.45); g.lineWidth = 2; g.stroke();
    for (let col = 0; col < COLS; col++) { g.fillStyle = col % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.055)"; rr(g, this.ox + col * (this.T + this.gap), this.oy, this.T, bh, this.T * 0.18); g.fill(); }
    // twinkling stars are drawn live
    this.stars = Array.from({ length: 70 }, () => ({ x: rng.next() * w, y: rng.next() * h, r: 0.6 + rng.next() * 1.4, ph: rng.next() * 6 }));
  }

  // ------------------------------------------------------------ state
  setStage(game: Game, galaxy: Galaxy, stage: number) {
    this.game = game; this.galaxy = galaxy; this.stageN = stage; this.show = null;
    this.flies = []; this.parts = []; this.pops.clear(); this.landSq.clear(); this.hidden.clear();
    this.paintBackground(); this.born = performance.now(); this.busy = false; this.kick();
  }
  sync(game: Game) { this.game = game; this.show = null; this.hidden.clear(); this.kick(); }

  // ------------------------------------------------------------ input
  private colAt(px: number) { let best = 0, bd = Infinity; for (let c = 0; c < COLS; c++) { const d = Math.abs(this.colX(c) - px); if (d < bd) { bd = d; best = c; } } return best; }
  private onMove = (e: PointerEvent) => {
    if (!this.game) return;
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left;
    const c = this.colAt(x);
    if (c !== this.aimCol) { this.aimCol = c; this.hooks.sound("aim", this.pan(c)); }
    this.kick();
  };
  private onUp = (e: PointerEvent) => {
    if (!this.game || this.busy || !this.hooks.canPlay()) return;
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (this.hooks.hammerArmed()) {
      for (let i = 0; i < COLS * ROWS; i++) { const p = this.cellXY(i); if (Math.abs(p.x - x) < this.T / 2 && Math.abs(p.y - y) < this.T / 2 && this.game.board[i]) { this.smashFx(i); this.hooks.hammer(i); return; } }
      return;
    }
    this.aimCol = this.colAt(x);
    void this.dropAt(this.aimCol);
  };
  private onKey = (e: KeyboardEvent) => {
    if (!this.game || !this.hooks.canPlay()) return;
    if (e.key === "ArrowLeft") { this.aimCol = Math.max(0, this.aimCol - 1); this.hooks.sound("aim", this.pan(this.aimCol)); this.kick(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { this.aimCol = Math.min(COLS - 1, this.aimCol + 1); this.hooks.sound("aim", this.pan(this.aimCol)); this.kick(); e.preventDefault(); }
    else if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); if (!this.busy) void this.dropAt(this.aimCol); }
  };

  // ------------------------------------------------------------ a drop
  private wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
  async dropAt(col: number) {
    if (this.busy || !this.game) return;
    const shot = this.game.cur;
    const out = this.hooks.drop(col);
    if (!out) { this.shake = performance.now(); this.kick(); return; }
    this.busy = true;
    const res = out.res;
    this.hooks.sound("drop", this.pan(col));
    // fall from the shooter to the landing cell
    const land = this.cellXY(res.land);
    const dist = land.y - this.shooterY;
    const first = res.steps[0];
    this.show = first ? first.board : null;
    this.hidden = new Set([res.land]);
    const dur = Math.max(110, Math.min(320, dist / (this.T * 0.06)));
    this.flies.push({ v: shot, x0: this.colX(col), y0: this.shooterY, x1: land.x, y1: land.y, t0: performance.now(), dur, squash: true });
    this.kick();
    await this.wait(dur);
    this.hidden.clear();
    this.landSq.set(res.land, performance.now());
    this.hooks.sound("land", this.pan(col));
    let mergeN = 0;
    for (let s = 1; s < res.steps.length; s++) {
      const st = res.steps[s];
      if (st.kind === "merge") {
        // the absorbed blocks fly into the target, then it pops with its new value
        const prev = this.show!, to = this.cellXY(st.merge.into), now = performance.now();
        for (const f of st.merge.from) { const p = this.cellXY(f), x = prev[f]; if (x) this.flies.push({ v: x.v, x0: p.x, y0: p.y, x1: to.x, y1: to.y, t0: now, dur: 120 }); }
        this.hidden = new Set(st.merge.from);
        this.kick();
        await this.wait(120);
        this.hidden.clear();
        this.show = st.board;
        this.pops.set(st.merge.into, performance.now());
        mergeN++;
        const col2 = colOf(st.merge.value);
        this.parts.push({ x: to.x, y: to.y, vx: 0, vy: 0, life: 0.4, max: 0.4, col: col2, size: this.T * 0.6, ring: true });
        for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, sp = this.T * (2 + Math.random() * 5); this.parts.push({ x: to.x, y: to.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.T * 2, life: 0.55, max: 0.55, col: k % 3 ? col2 : "#ffffff", size: this.T * (0.04 + Math.random() * 0.05) }); }
        this.hooks.sound("merge", this.pan(st.merge.into % COLS), st.merge.chain);
        if (st.merge.chain > 1) this.hooks.float(this.clampX(to.x), to.y - this.T * 0.7, `Combo ×${st.merge.chain}`, true);
        if (mergeN === 1) {
          for (const j of res.cracked) { this.rockFx(j, 6); this.hooks.sound("crack", this.pan(j % COLS)); }
          for (const j of res.smashed) { this.rockFx(j, 18); this.hooks.sound("smash", this.pan(j % COLS)); }
          for (const j of res.thawed) { const p = this.cellXY(j); for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * this.T * 3, vy: Math.sin(a) * this.T * 3, life: 0.5, max: 0.5, col: "#d8f4ff", size: this.T * 0.06 }); } this.hooks.sound("thaw", this.pan(j % COLS)); }
        }
        this.kick();
        await this.wait(150);
      } else if (st.kind === "fall") {
        const now = performance.now();
        for (const [from, to] of st.moves) { const a = this.cellXY(from), b = this.cellXY(to), x = this.show?.[from]; if (x) this.flies.push({ v: x.v, x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: now, dur: 140, squash: true }); }
        this.hidden = new Set(st.moves.map(([, to]) => to));
        this.show = st.board;
        this.kick();
        await this.wait(140);
        this.hidden.clear();
      }
    }
    if (res.gained) { const p = this.cellXY(res.merges.length ? res.merges[res.merges.length - 1].into : res.land); this.hooks.float(this.clampX(p.x), p.y - this.T * 0.3, `+${res.gained}`, res.gained >= 500); }
    this.show = null; this.game = out.game;
    this.busy = false;
    this.kick();
  }
  private rockFx(j: number, n: number) { const p = this.cellXY(j); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = this.T * (2 + Math.random() * 4); this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.T * 2, life: 0.7, max: 0.7, col: "#8a8298", size: this.T * (0.06 + Math.random() * 0.08), rock: true }); } }
  smashFx(i: number) { this.rockFx(i, 16); this.hooks.sound("hammer", this.pan(i % COLS)); this.kick(); }
  celebrate() {
    const cols = ["#ffd23f", "#ff4f8a", "#3fd36b", "#2fb4ff", "#ffffff", this.galaxy?.glow ?? "#ffd23f"];
    for (let i = 0; i < 100; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, s = this.T * (5 + Math.random() * 8); this.parts.push({ x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.5, y: this.H * 0.7, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.8, max: 1.8, col: cols[i % cols.length], size: this.T * 0.06 }); }
    this.kick();
  }
  jolt() { this.shake = performance.now(); this.kick(); }

  // ------------------------------------------------------------ loop
  kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } };
  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, g = this.g, T = this.T;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0, this.W, this.H); else { g.fillStyle = "#14143a"; g.fillRect(0, 0, this.W, this.H); }
    for (const s of this.stars) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.ph))})`; g.fillRect(s.x, s.y, s.r, s.r); }
    let shx = 0;
    if (this.shake) { const k = (now - this.shake) / 400; if (k >= 1) this.shake = 0; else shx = Math.sin(k * 40) * T * 0.08 * (1 - k); }
    g.save(); g.translate(shx, 0);
    const G = this.game;
    if (G) {
      const board = this.show ?? G.board;
      // the aim lane and landing ghost
      if (!this.busy) {
        this.aimX += (this.colX(this.aimCol) - this.aimX) * Math.min(1, dt * 18);
        const lr = landingRow(board, this.aimCol);
        const glow = this.galaxy?.glow ?? "#ffffff";
        g.fillStyle = hexA(glow, 0.1); rr(g, this.colX(this.aimCol) - T / 2, this.oy, T, ROWS * (T + this.gap) - this.gap, T * 0.18); g.fill();
        if (lr >= 0) { const p = this.cellXY(lr * COLS + this.aimCol); g.strokeStyle = hexA(glow, 0.6); g.setLineDash([6, 5]); g.lineWidth = 2; rr(g, p.x - T / 2 + 2, p.y - T / 2 + 2, T - 4, T - 4, T * 0.18); g.stroke(); g.setLineDash([]); }
      }
      // blocks
      for (let i = 0; i < board.length; i++) {
        const x = board[i]; if (!x || this.hidden.has(i)) continue;
        const p = this.cellXY(i);
        const k = Math.min(1, Math.max(0, (now - this.born - (ROWS - 1 - Math.floor(i / COLS)) * 40 - (i % COLS) * 20) / 300));
        let sx = 1, sy = 1;
        const pop = this.pops.get(i); if (pop) { const q = (now - pop) / 260; if (q >= 1) this.pops.delete(i); else { const s2 = 1 + Math.sin(q * Math.PI) * 0.28; sx = s2; sy = s2; } }
        const ls = this.landSq.get(i); if (ls) { const q = (now - ls) / 220; if (q >= 1) this.landSq.delete(i); else { sx *= 1 + Math.sin(q * Math.PI) * 0.16; sy *= 1 - Math.sin(q * Math.PI) * 0.14; } }
        this.drawBlock(x.v, p.x, p.y + T * 0.07 * (1 - sy), sx * (k < 1 ? easeBack(k) : 1), sy * (k < 1 ? easeBack(k) : 1), 1, !!x.ice, x.hp ?? 2);
      }
      // the shooter: the shot block above the aimed column, the next one small at the side
      if (!this.busy) {
        const bob = Math.sin(t * 3) * T * 0.04;
        this.drawBlock(G.cur, this.aimX, this.shooterY + bob, 0.92, 0.92);
      }
      g.fillStyle = "rgba(255,255,255,.55)"; g.font = `800 ${Math.round(T * 0.18)}px system-ui, sans-serif`; g.textAlign = "right"; g.textBaseline = "middle";
      const nx = this.ox + COLS * (T + this.gap) - this.gap, ny = this.shooterY - T * 0.05;
      g.fillText("NEXT", nx - T * 0.5, ny);
      this.drawBlock(G.nxt, nx - T * 0.22, ny, 0.42, 0.42, 0.9);
    }
    // flying blocks
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i], q = Math.min(1, Math.max(0, (now - f.t0) / f.dur)), e = f.squash ? q * q : 1 - (1 - q) * (1 - q);
      this.drawBlock(f.v, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e, f.squash ? 1 - q * 0.05 : 1 - q * 0.15, f.squash ? 1 + q * 0.08 : 1 - q * 0.15);
      if (q >= 1) this.flies.splice(i, 1);
    }
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const a = p.life / p.max;
      if (p.ring) { g.strokeStyle = p.col; g.globalAlpha = a; g.lineWidth = T * 0.08 * a; g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - a * 0.8), 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; continue; }
      p.vy += T * 10 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, a * 1.6); g.fillStyle = p.col;
      if (p.rock) { g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    g.restore();
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro.disconnect(); this.io.disconnect(); document.removeEventListener("visibilitychange", this.kick);
    this.cv.removeEventListener("pointermove", this.onMove); this.cv.removeEventListener("pointerdown", this.onMove); this.cv.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    this.sprites.clear(); this.cv.remove();
  }
}

const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h: string, k: number) { const [r, g, b] = hexToRgb(h); const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
