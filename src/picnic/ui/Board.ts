// The Picnic Pairs board, drawn in 2D on one canvas (light on any phone). Food tiles are painted once per kind and
// size: a cream tile with a thick 3D edge, a soft shadow and the food on its face. The picnic spot is painted once per
// stage into an offscreen canvas (sky, a checked picnic blanket running into the distance, blurred snacks around it,
// placed by the stage number so every stage looks a little different) and dimmed behind a soft board panel so the
// tiles always stand out. Tap a tile to pick it up (it lifts and glows), tap its twin to link them: a glowing line runs
// along the path (around the outside if it must), both tiles pop into sparkles and stars, and the others slide by the
// stage's rule. A wrong tap shakes; a stuck board swirls into a reshuffle; a cleared board rains confetti.
import { STONE, isTile } from "../grid";
import { rngFrom } from "../../sudoku/rng";
import type { Game, MatchResult } from "../play";
import type { Spot } from "../stage";

export type BoardSound = "pick" | "match" | "nope" | "slide" | "shuffle" | "hint" | "confetti";
export interface BoardHooks {
  match: (a: number, b: number) => { res: MatchResult; game: Game } | null;
  canPlay: () => boolean;
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

/** the foods, one per kind id (1-based) */
export const FOODS = ["🍓", "🍒", "🍉", "🍇", "🍋", "🍊", "🍎", "🍐", "🍑", "🍍", "🥝", "🍌", "🫐", "🥕", "🌽", "🥐", "🥨", "🧀", "🍔", "🍕", "🌭", "🍩", "🍪", "🧁", "🍰", "🍫", "🍬", "🍭", "🍦", "🥞", "🧇", "🍿", "🥪", "🌮", "🍙", "🥥"];
const FOOD_COL = ["#ff4a5a", "#d8203a", "#3fbf5a", "#8a4ad8", "#ffd21f", "#ff8a1f", "#ff3a3a", "#b8d84a", "#ffa07a", "#ffc21f", "#7ac04a", "#ffe05a", "#4a6ad8", "#ff7a1f", "#ffd84a", "#e0a050", "#c8843a", "#ffd060", "#c87a3a", "#ff7a4a", "#e05a3a", "#ff8ac8", "#c8925a", "#ff8ab8", "#ffb0c8", "#8a5a3a", "#ff5ab0", "#ff5a8a", "#ffe0f0", "#e8a85a", "#e0b05a", "#fff0c0", "#e8c87a", "#f0b040", "#f4f4f4", "#a87a5a"];
const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;

interface Slide { fx: number; fy: number; t0: number; dur: number }
interface Pop { kind: number; x: number; y: number; t0: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; star?: boolean; rot?: number }

export class PicnicBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private T = 40; private TH = 46; private ox = 0; private oy = 0;
  private game: Game | null = null;
  private spot: Spot | null = null; private stageN = 1;
  private sprites = new Map<string, HTMLCanvasElement>();
  private sel = -1; private selT = 0;
  private shakeCells = new Map<number, number>();
  private slides = new Map<number, Slide>();
  private pops: Pop[] = [];
  private parts: Part[] = [];
  private line: { pts: [number, number][]; t0: number; col: string } | null = null;
  private hintCells: [number, number] | null = null; private hintT = 0;
  private swirl = 0;
  private born = 0;
  private ambient: { x: number; y: number; v: number; ph: number; kind: number }[] = [];
  private raf = 0; private last = 0; private disposed = false; private visible = true; private busy = false;
  private ro: ResizeObserver; private io: IntersectionObserver;

  constructor(private el: HTMLElement, private hooks: BoardHooks) {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "manipulation" });
    el.appendChild(this.cv);
    this.cv.addEventListener("pointerdown", this.onDown);
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
    this.layout();
    this.paintBackground();
    this.kick();
  }
  private layout() {
    const b = this.game?.board; const bw = b?.w ?? 6, bh = b?.h ?? 8;
    // one free ring around the board (paths can run there), tiles a little taller than wide
    const T = Math.min((this.W - 20) / (bw + 1), (this.H - 16) / ((bh + 1) * 1.16), 74);
    this.T = T; this.TH = T * 1.16;
    this.ox = (this.W - bw * T) / 2;
    this.oy = (this.H - bh * this.TH) / 2;
    this.sprites.clear();
  }
  /** centre of a cell (x may be -1 … w, y -1 … h for the ring) */
  private cxy(x: number, y: number) { return { x: this.ox + (x + 0.5) * this.T, y: this.oy + (y + 0.5) * this.TH }; }
  cellScreen(i: number) { const b = this.game!.board; return this.cxy(i % b.w, Math.floor(i / b.w)); }
  private pan(i: number) { const b = this.game?.board; if (!b) return 0; return (((i % b.w) + 0.5) / b.w * 2 - 1) * 0.8; }

  // ------------------------------------------------------------ sprites
  private tile(kind: number, lit = false): HTMLCanvasElement {
    const key = `${kind}:${lit ? 1 : 0}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const d = this.dpr, T = this.T * d, TH = this.TH * d, pad = Math.ceil(T * 0.12);
    c = document.createElement("canvas"); c.width = Math.ceil(T + pad * 2); c.height = Math.ceil(TH + pad * 2);
    const g = c.getContext("2d")!;
    const x = pad + T * 0.04, y = pad + T * 0.02, w = T * 0.92, h = TH * 0.9, r = T * 0.18, edge = T * 0.12;
    // shadow
    g.fillStyle = "rgba(40,30,20,.28)"; rr(g, x + T * 0.03, y + edge + T * 0.06, w, h - edge, r); g.fill();
    if (kind === STONE) {
      g.fillStyle = "#7a7470"; rr(g, x, y + edge, w, h - edge, r); g.fill();
      g.fillStyle = "#a8a29c"; rr(g, x, y, w, h - edge, r); g.fill();
      g.strokeStyle = "rgba(60,55,50,.55)"; g.lineWidth = T * 0.04;
      g.beginPath(); g.moveTo(x + w * 0.3, y + h * 0.15); g.lineTo(x + w * 0.45, y + h * 0.4); g.lineTo(x + w * 0.35, y + h * 0.6); g.moveTo(x + w * 0.45, y + h * 0.4); g.lineTo(x + w * 0.7, y + h * 0.5); g.stroke();
    } else {
      // the 3D edge, then the face with a soft gradient and a glossy top
      g.fillStyle = lit ? "#e8a800" : "#d9b98a"; rr(g, x, y + edge, w, h - edge, r); g.fill();
      const face = g.createLinearGradient(0, y, 0, y + h - edge);
      face.addColorStop(0, lit ? "#fff6c8" : "#fffdf6"); face.addColorStop(1, lit ? "#ffe27a" : "#f6ead2");
      g.fillStyle = face; rr(g, x, y, w, h - edge, r); g.fill();
      g.strokeStyle = lit ? "#ffb000" : "rgba(200,160,110,.6)"; g.lineWidth = lit ? T * 0.05 : T * 0.02; rr(g, x, y, w, h - edge, r); g.stroke();
      g.fillStyle = "rgba(255,255,255,.7)"; rr(g, x + w * 0.1, y + T * 0.05, w * 0.8, (h - edge) * 0.18, r * 0.6); g.fill();
      // a coloured halo behind the food so similar foods read apart
      const col = FOOD_COL[(kind - 1) % FOOD_COL.length];
      const halo = g.createRadialGradient(x + w / 2, y + (h - edge) / 2, 0, x + w / 2, y + (h - edge) / 2, w * 0.45);
      halo.addColorStop(0, hexA(col, 0.32)); halo.addColorStop(1, hexA(col, 0));
      g.fillStyle = halo; g.fillRect(x, y, w, h - edge);
      g.font = `${Math.round(T * 0.6)}px ${EMOJI_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(FOODS[(kind - 1) % FOODS.length], x + w / 2, y + (h - edge) / 2 + T * 0.03);
    }
    this.sprites.set(key, c);
    return c;
  }
  private drawTile(kind: number, cx: number, cy: number, sc = 1, alpha = 1, lit = false, lift = 0, rot = 0) {
    const sp = this.tile(kind, lit), d = this.dpr, w = sp.width / d, h = sp.height / d;
    const g = this.g;
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy - lift); if (rot) g.rotate(rot); g.scale(sc, sc);
    g.drawImage(sp, -w / 2, -h / 2 + this.TH * 0.02, w, h);
    g.restore();
  }

  // ------------------------------------------------------------ the picnic spot (painted once per stage)
  private paintBackground() {
    const sp = this.spot; if (!sp) return;
    const w = this.W, h = this.H, d = this.dpr;
    const c = this.bg ?? document.createElement("canvas"); this.bg = c;
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    const g = c.getContext("2d")!; g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`picnic-bg:${this.stageN}`);
    const night = sp.id === "lantern";
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, sp.sky[0]); sky.addColorStop(0.55, sp.sky[1]); sky.addColorStop(1, sp.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // a far horizon (hills / sea / lake / mountains) and the blanket in perspective
    const hy = h * (0.3 + rng.next() * 0.08);
    g.fillStyle = sp.id === "beach" || sp.id === "lake" ? hexA(sp.accent, 0.45) : mix(sp.sky[0], sp.accent, 0.45);
    g.beginPath(); g.moveTo(0, hy);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, hy - (sp.id === "camp" ? Math.abs(((x * 0.9 + rng.next() * 2) % 160) - 80) * 0.6 : Math.sin(x * 0.012 + rng.next() * 0.2) * 12));
    g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = mix(sp.sky[2], sp.accent, 0.3); g.fillRect(0, hy + 30, w, h);
    // the checked blanket running away from you
    const blanket = ["#e04848", "#3fa34a", "#2f78d0", "#e07a1a", "#d04a86", "#e0b020", "#5a6a8a", "#8a5ad0"][SPOTS_INDEX(sp.id)];
    const top = hy + h * 0.08, n = 10;
    for (let row = 0; row < 14; row++) {
      const y0 = top + (h - top) * Math.pow(row / 14, 1.6), y1 = top + (h - top) * Math.pow((row + 1) / 14, 1.6);
      const spread0 = 0.5 + (y0 - top) / (h - top) * 0.9, spread1 = 0.5 + (y1 - top) / (h - top) * 0.9;
      for (let col = -n; col < n; col++) {
        if ((row + col) % 2) continue;
        const xa = w / 2 + (col / n) * w * spread0, xb = w / 2 + ((col + 1) / n) * w * spread0;
        const xc = w / 2 + ((col + 1) / n) * w * spread1, xd = w / 2 + (col / n) * w * spread1;
        g.fillStyle = hexA(blanket, 0.55); g.beginPath(); g.moveTo(xa, y0); g.lineTo(xb, y0); g.lineTo(xc, y1); g.lineTo(xd, y1); g.fill();
      }
    }
    // blurred snacks lying around, somewhere new each stage
    g.save(); g.filter = "blur(6px)";
    for (let i = 0; i < 6; i++) {
      const fx = rng.next() * w, fy = top + rng.next() * (h - top), sz = Math.min(w, h) * (0.12 + rng.next() * 0.14);
      g.font = `${Math.round(sz)}px ${EMOJI_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.globalAlpha = 0.75; g.fillText(FOODS[rng.int(FOODS.length)], fx, fy);
    }
    g.restore();
    if (night) { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rng.next() * 0.6})`; g.fillRect(rng.next() * w, rng.next() * hy, 1.5, 1.5); } }
    // dim it and lay a soft panel behind the tiles
    g.fillStyle = night ? "rgba(10,10,30,.42)" : "rgba(30,25,20,.22)"; g.fillRect(0, 0, w, h);
    const b = this.game?.board;
    if (b) {
      const px = this.ox - this.T * 0.45, py = this.oy - this.TH * 0.4, pw = b.w * this.T + this.T * 0.9, ph = b.h * this.TH + this.TH * 0.8;
      g.fillStyle = night ? "rgba(20,20,50,.45)" : "rgba(255,250,240,.32)";
      rr(g, px, py, pw, ph, this.T * 0.4); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 2; g.stroke();
    }
    this.ambient = [];
    for (let i = 0; i < (night ? 14 : 8); i++) this.ambient.push({ x: rng.next() * w, y: rng.next() * h, v: 0.4 + rng.next() * 0.8, ph: rng.next() * 6, kind: i });
  }

  // ------------------------------------------------------------ state
  setStage(game: Game, spot: Spot, stage: number) {
    this.game = game; this.spot = spot; this.stageN = stage;
    this.sel = -1; this.slides.clear(); this.pops = []; this.parts = []; this.line = null; this.hintCells = null;
    this.layout(); this.paintBackground();
    this.born = performance.now(); this.busy = false;
    this.kick();
  }
  sync(game: Game) { this.game = game; this.sel = -1; this.kick(); }
  showHint(a: number, b: number) { this.hintCells = [a, b]; this.hintT = performance.now(); this.hooks.sound("hint", 0); this.kick(); }

  // ------------------------------------------------------------ input
  private cellAt(px: number, py: number) {
    const b = this.game?.board; if (!b) return -1;
    const x = Math.floor((px - this.ox) / this.T), y = Math.floor((py - this.oy) / this.TH);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
    return y * b.w + x;
  }
  private onDown = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canPlay() || !this.game) return;
    const r = this.cv.getBoundingClientRect();
    const i = this.cellAt(e.clientX - r.left, e.clientY - r.top);
    if (i < 0 || !isTile(this.game.board.c[i])) return;
    this.tap(i);
  };
  /** a tap on cell i (also used by the dev hooks) */
  tap(i: number) {
    const g = this.game; if (!g || this.busy) return;
    if (this.sel === i) { this.sel = -1; this.kick(); return; }
    if (this.sel < 0) { this.sel = i; this.selT = performance.now(); this.hooks.sound("pick", this.pan(i)); this.kick(); return; }
    const a = this.sel;
    const out = this.hooks.match(a, i);
    if (!out) {
      // not a pair (or no path): shake the old pick; the new tile becomes the pick when it's a tile of another food
      const now = performance.now();
      this.shakeCells.set(a, now);
      if (g.board.c[a] === g.board.c[i]) this.shakeCells.set(i, now);
      this.hooks.sound("nope", this.pan(i));
      this.sel = g.board.c[a] === g.board.c[i] ? -1 : i; this.selT = now;
      this.kick(); return;
    }
    void this.play(out.res, out.game);
  }

  // ------------------------------------------------------------ a match
  private wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
  async play(res: MatchResult, game: Game) {
    this.busy = true; this.sel = -1; this.hintCells = null;
    const old = this.game!.board, now = performance.now();
    const pa = this.cellScreen(res.a), pb = this.cellScreen(res.b);
    // the link line
    this.line = { pts: res.path.map(([x, y]) => [this.cxy(x, y).x, this.cxy(x, y).y]), t0: now, col: FOOD_COL[(res.kind - 1) % FOOD_COL.length] };
    // pops: keep drawing the two tiles over the line for a moment
    this.pops.push({ kind: res.kind, x: pa.x, y: pa.y, t0: now + 160 }, { kind: res.kind, x: pb.x, y: pb.y, t0: now + 160 });
    this.game = { ...game, board: { ...game.board, c: old.c.slice() } };
    this.game.board.c[res.a] = 0; this.game.board.c[res.b] = 0;
    this.hooks.sound("match", (this.pan(res.a) + this.pan(res.b)) / 2, res.combo);
    this.kick();
    await this.wait(200);
    for (const p of [pa, pb]) { this.burst(p.x, p.y, this.line.col, 10); this.stars(p.x, p.y, 4); }
    this.hooks.float((pa.x + pb.x) / 2, Math.min(pa.y, pb.y) - this.TH * 0.4, res.combo > 1 ? `+${res.gained} ×${res.combo}` : `+${res.gained}`, res.combo > 2);
    await this.wait(140);
    this.line = null;
    // slides
    if (res.moved.size) {
      const t0 = performance.now();
      for (const [from, to] of res.moved) { const f = this.cellScreen(from); this.slides.set(to, { fx: f.x, fy: f.y, t0, dur: 220 }); }
      this.game = game;
      this.hooks.sound("slide", 0);
      await this.wait(230);
    } else this.game = game;
    if (res.reshuffled) await this.reshuffle(res.reshuffled);
    if (res.win) await this.celebrate();
    this.busy = false;
    this.kick();
  }
  /** everything swirls into the middle and lands somewhere new */
  async reshuffle(map: Map<number, number>) {
    this.busy = true;
    this.swirl = performance.now();
    this.hooks.sound("shuffle", 0);
    const t0 = performance.now() + 250;
    const mid = { x: this.W / 2, y: this.H / 2 };
    for (const [, to] of map) this.slides.set(to, { fx: mid.x, fy: mid.y, t0, dur: 380 });
    this.kick();
    await this.wait(660);
    this.swirl = 0; this.busy = false;
  }
  async celebrate() {
    this.hooks.sound("confetti", 0);
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = this.T * (6 + Math.random() * 10);
      this.parts.push({ x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.6, y: this.H * 0.75, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.8, max: 1.8, col: FOOD_COL[i % FOOD_COL.length], size: this.T * 0.12, rot: Math.random() * 6 });
    }
    this.kick();
    await this.wait(700);
  }
  private burst(x: number, y: number, col: string, n: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = this.T * (2 + Math.random() * 4); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - this.T * 2, life: 0.6, max: 0.6, col, size: this.T * (0.06 + Math.random() * 0.06) }); }
  }
  private stars(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = this.T * (2.5 + Math.random() * 2); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - this.T * 3, life: 0.8, max: 0.8, col: "#ffd23f", size: this.T * 0.16, star: true, rot: Math.random() * 3 }); }
  }

  // ------------------------------------------------------------ loop
  kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } };
  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0, this.W, this.H); else { g.fillStyle = "#e4f7c8"; g.fillRect(0, 0, this.W, this.H); }
    // butterflies / fireflies drifting
    const night = this.spot?.id === "lantern";
    for (const a of this.ambient) {
      a.x += Math.cos(t * 0.5 + a.ph) * a.v * 14 * dt; a.y += Math.sin(t * 0.7 + a.ph) * a.v * 10 * dt;
      if (night) { const k = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + a.ph)); g.fillStyle = `rgba(255,220,120,${k * 0.8})`; g.beginPath(); g.arc(a.x, a.y, 2.5, 0, Math.PI * 2); g.fill(); g.fillStyle = `rgba(255,220,120,${k * 0.2})`; g.beginPath(); g.arc(a.x, a.y, 8, 0, Math.PI * 2); g.fill(); }
      else { const flap = Math.abs(Math.sin(t * 9 + a.ph)); g.fillStyle = ["rgba(255,140,190,.6)", "rgba(255,210,80,.6)", "rgba(140,190,255,.6)"][a.kind % 3]; g.beginPath(); g.ellipse(a.x - 4 * flap, a.y, 4 * flap + 1, 5, -0.3, 0, Math.PI * 2); g.ellipse(a.x + 4 * flap, a.y, 4 * flap + 1, 5, 0.3, 0, Math.PI * 2); g.fill(); }
    }
    const G = this.game;
    if (G) {
      const b = G.board;
      const swirlK = this.swirl ? Math.min(1, (now - this.swirl) / 250) : 0;
      for (let i = 0; i < b.c.length; i++) {
        const v = b.c[i]; if (v <= 0) continue;
        let { x, y } = this.cellScreen(i);
        // entrance: tiles pop in row by row
        const k = Math.min(1, Math.max(0, (now - this.born - Math.floor(i / b.w) * 35 - (i % b.w) * 12) / 320));
        if (k <= 0) continue;
        const sl = this.slides.get(i);
        if (sl) { const q = Math.min(1, Math.max(0, (now - sl.t0) / sl.dur)); const e = 1 - (1 - q) ** 3; if (q <= 0) { x = sl.fx; y = sl.fy; } else { x = sl.fx + (x - sl.fx) * e; y = sl.fy + (y - sl.fy) * e; } if (q >= 1) this.slides.delete(i); }
        else if (swirlK) { const c = { x: this.W / 2, y: this.H / 2 }; x += (c.x - x) * swirlK; y += (c.y - y) * swirlK; }
        const sh = this.shakeCells.get(i); let rot = 0;
        if (sh) { const q = (now - sh) / 350; if (q >= 1) this.shakeCells.delete(i); else { x += Math.sin(q * 30) * this.T * 0.08 * (1 - q); rot = Math.sin(q * 30) * 0.05 * (1 - q); } }
        const isSel = i === this.sel;
        const hinted = this.hintCells && (this.hintCells[0] === i || this.hintCells[1] === i) && now - this.hintT < 4000;
        const lift = isSel ? this.TH * 0.12 + Math.sin(t * 6) * this.TH * 0.02 : hinted ? Math.abs(Math.sin(t * 5)) * this.TH * 0.08 : 0;
        const sc = (k < 1 ? easeBack(k) : 1) * (isSel ? 1.06 : 1);
        if (isSel || hinted) { g.fillStyle = `rgba(255,210,60,${isSel ? 0.45 : 0.3 + Math.sin(t * 5) * 0.15})`; g.beginPath(); g.ellipse(x, y + this.TH * 0.1, this.T * 0.62, this.TH * 0.6, 0, 0, Math.PI * 2); g.fill(); }
        this.drawTile(v, x, y, sc, 1, isSel || !!hinted, lift, rot);
      }
    }
    // the link line: a glowing stroke drawn along the path
    if (this.line) {
      const q = Math.min(1, (now - this.line.t0) / 170);
      const pts = this.line.pts; let total = 0; const seg: number[] = [];
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
      const draw = (wid: number, col: string) => {
        g.strokeStyle = col; g.lineWidth = wid; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        let left = total * q;
        for (let i = 1; i < pts.length && left > 0; i++) { const f = Math.min(1, left / seg[i - 1]); g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); left -= seg[i - 1]; }
        g.stroke();
      };
      draw(this.T * 0.3, hexA(this.line.col, 0.35)); draw(this.T * 0.14, this.line.col); draw(this.T * 0.05, "#ffffff");
    }
    // popping tiles
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i], q = (now - p.t0) / 260;
      if (q < 0) { this.drawTile(p.kind, p.x, p.y, 1.06, 1, true, this.TH * 0.1); continue; }
      if (q >= 1) { this.pops.splice(i, 1); continue; }
      this.drawTile(p.kind, p.x, p.y - q * this.TH * 0.3, 1.06 + q * 0.35, 1 - q, true);
    }
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += this.T * 12 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.min(1, (p.life / p.max) * 1.8);
      g.globalAlpha = a; g.fillStyle = p.col;
      if (p.star) { g.save(); g.translate(p.x, p.y); g.rotate((p.rot ?? 0) + t * 3); starPath(g, p.size); g.fill(); g.restore(); }
      else if (p.rot !== undefined) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot + t * 4); g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro.disconnect(); this.io.disconnect(); document.removeEventListener("visibilitychange", this.kick);
    this.cv.removeEventListener("pointerdown", this.onDown);
    this.sprites.clear(); this.cv.remove();
  }
}

const SPOT_IDS = ["meadow", "beach", "forest", "lake", "orchard", "garden", "camp", "lantern"];
const SPOTS_INDEX = (id: string) => Math.max(0, SPOT_IDS.indexOf(id));
const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(a: string, b: string, k: number) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; }
function starPath(g: CanvasRenderingContext2D, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.45 : r, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); }
