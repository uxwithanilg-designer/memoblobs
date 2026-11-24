// The Jade Slide board, drawn in 2D on one canvas. Mahjong tiles are painted once per kind and size: an ivory face
// on a thick coloured back with a soft shadow, and the traditional faces drawn in code — circles (dots 1–9), bamboo
// sticks (1–9), characters 一…九 over 萬, the winds 東南西北 and the dragons 中 發 and the framed 白. The tea-house felt
// (a wave pattern, a gold double frame) is painted once per stage and kept dim so the tiles stand out.
// Tap two tiles that see each other along a row or column to pair them. Or drag a tile along its row or column: it
// pushes the tiles in front of it; let go where it lines up with its twin and the pair clears, otherwise everything
// springs back. Pairs lift, fly together and burst into gold sparkles; hints glow (with an arrow for a slide).
import { DIRS, canPair, chainOf, room } from "../grid";
import { rngFrom } from "../../sudoku/rng";
import type { Game, MatchResult } from "../play";
import type { House } from "../stage";

export type BoardSound = "pick" | "match" | "nope" | "slide" | "shuffle" | "hint" | "confetti";
export interface BoardHooks {
  pair: (a: number, b: number) => { res: MatchResult; game: Game } | null;
  drag: (from: number, d: number, k: number) => { res: MatchResult; game: Game } | null;
  canPlay: () => boolean;
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

const CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WINDS = ["東", "南", "西", "北"];
const CJK = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","SimHei",serif`;
const DOT_POS: [number, number][][] = [
  [[0.5, 0.5]], [[0.5, 0.28], [0.5, 0.72]], [[0.28, 0.25], [0.5, 0.5], [0.72, 0.75]], [[0.3, 0.28], [0.7, 0.28], [0.3, 0.72], [0.7, 0.72]],
  [[0.28, 0.25], [0.72, 0.25], [0.5, 0.5], [0.28, 0.75], [0.72, 0.75]], [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]],
  [[0.25, 0.18], [0.5, 0.26], [0.75, 0.34], [0.3, 0.6], [0.7, 0.6], [0.3, 0.82], [0.7, 0.82]],
  [[0.3, 0.16], [0.7, 0.16], [0.3, 0.39], [0.7, 0.39], [0.3, 0.62], [0.7, 0.62], [0.3, 0.85], [0.7, 0.85]],
  [[0.22, 0.2], [0.5, 0.2], [0.78, 0.2], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.8], [0.5, 0.8], [0.78, 0.8]],
];
const DOT_COL = ["#1f5fbf", "#1f8a3a", "#c8202a"];

interface Spring { fx: number; fy: number; t0: number; dur: number }
interface Pop { kind: number; x: number; y: number; tx: number; ty: number; t0: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; star?: boolean; rot?: number; conf?: boolean }

export class JadeBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private T = 40; private TH = 50; private ox = 0; private oy = 0;
  private game: Game | null = null; private house: House | null = null; private stageN = 1;
  private sprites = new Map<string, HTMLCanvasElement>();
  private sel = -1;
  private drag: { from: number; sx: number; sy: number; axis: -1 | 0 | 1; dir: number; off: number; max: number; chain: number[]; moved: boolean } | null = null;
  private springs = new Map<number, Spring>();
  private shakes = new Map<number, number>();
  private pops: Pop[] = [];
  private parts: Part[] = [];
  private hintStep: { a: number; b: number; drag?: { from: number; dir: number; k: number } } | null = null; private hintT = 0;
  private swirl = 0; private born = 0;
  private raf = 0; private last = 0; private disposed = false; private visible = true; private busy = false;
  private ro: ResizeObserver; private io: IntersectionObserver;

  constructor(private el: HTMLElement, private hooks: BoardHooks) {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    el.appendChild(this.cv);
    this.cv.addEventListener("pointerdown", this.onDown);
    this.cv.addEventListener("pointermove", this.onMove);
    this.cv.addEventListener("pointerup", this.onUp);
    this.cv.addEventListener("pointercancel", this.onCancel);
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
    this.layout(); this.paintBackground(); this.kick();
  }
  private layout() {
    const b = this.game?.board; const bw = b?.w ?? 6, bh = b?.h ?? 8;
    const T = Math.min((this.W - 28) / (bw + 0.3), (this.H - 24) / ((bh + 0.3) * 1.25), 70);
    this.T = T; this.TH = T * 1.25;
    this.ox = (this.W - bw * T) / 2; this.oy = (this.H - bh * this.TH) / 2;
    this.sprites.clear();
  }
  private cxy(i: number) { const b = this.game!.board; return { x: this.ox + ((i % b.w) + 0.5) * this.T, y: this.oy + (Math.floor(i / b.w) + 0.5) * this.TH }; }
  cellScreen(i: number) { return this.cxy(i); }
  private pan(i: number) { const b = this.game?.board; if (!b) return 0; return (((i % b.w) + 0.5) / b.w * 2 - 1) * 0.8; }

  // ------------------------------------------------------------ tiles
  private tile(kind: number, lit = false): HTMLCanvasElement {
    const key = `${kind}:${lit ? 1 : 0}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const d = this.dpr, T = this.T * d, TH = this.TH * d, pad = Math.ceil(T * 0.1);
    c = document.createElement("canvas"); c.width = Math.ceil(T + pad * 2); c.height = Math.ceil(TH + pad * 2);
    const g = c.getContext("2d")!;
    const x = pad + T * 0.04, y = pad + T * 0.02, w = T * 0.9, h = TH * 0.92, r = T * 0.12, edge = T * 0.13;
    const back = this.house?.id === "lantern" ? "#c8a040" : this.house?.id === "porcelain" ? "#2f6ac8" : this.house?.id === "plum" ? "#c84a8a" : "#1f8a5a";
    g.fillStyle = "rgba(0,0,0,.35)"; rr(g, x + T * 0.05, y + edge + T * 0.06, w, h - edge, r); g.fill();
    g.fillStyle = lit ? "#e8a800" : back; rr(g, x, y + edge * 0.3, w, h - edge * 0.3, r); g.fill();
    g.fillStyle = lit ? "#fff0c0" : "#efe6d0"; rr(g, x, y + edge * 0.55, w, h - edge * 0.85, r); g.fill();
    const face = g.createLinearGradient(0, y, 0, y + h - edge);
    face.addColorStop(0, lit ? "#fffbe6" : "#ffffff"); face.addColorStop(1, lit ? "#ffeaa0" : "#f3ecdc");
    g.fillStyle = face; rr(g, x, y, w, h - edge, r); g.fill();
    g.strokeStyle = lit ? "#ffb000" : "rgba(160,140,110,.55)"; g.lineWidth = lit ? T * 0.05 : T * 0.02; rr(g, x, y, w, h - edge, r); g.stroke();
    // the face
    const fx = x + w * 0.1, fy = y + (h - edge) * 0.08, fw = w * 0.8, fh = (h - edge) * 0.84;
    face_(g, kind, fx, fy, fw, fh);
    this.sprites.set(key, c);
    return c;
  }
  private drawTile(kind: number, cx: number, cy: number, sc = 1, alpha = 1, lit = false, lift = 0, rot = 0) {
    const sp = this.tile(kind, lit), d = this.dpr, w = sp.width / d, h = sp.height / d, g = this.g;
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy - lift); if (rot) g.rotate(rot); g.scale(sc, sc);
    g.drawImage(sp, -w / 2, -h / 2 + this.TH * 0.03, w, h);
    g.restore();
  }

  // ------------------------------------------------------------ the felt (painted once per stage)
  private paintBackground() {
    const hs = this.house; if (!hs) return;
    const w = this.W, h = this.H, d = this.dpr;
    const c = this.bg ?? document.createElement("canvas"); this.bg = c;
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    const g = c.getContext("2d")!; g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`jade-bg:${this.stageN}`);
    const gr = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, Math.max(w, h) * 0.8);
    gr.addColorStop(0, hs.felt[0]); gr.addColorStop(1, hs.felt[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // the wave pattern (seigaiha-like arcs), a different scale and offset each stage
    const R = 18 + rng.int(14), ox = rng.next() * R * 2;
    g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1.5;
    for (let row = -1; row < h / (R * 0.5) + 2; row++) for (let col = -1; col < w / (R * 2) + 2; col++) {
      const cx = col * R * 2 + (row % 2 ? R : 0) + ox, cy = row * R * 0.5;
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx, cy, R * k / 3, Math.PI, 0); g.stroke(); }
    }
    // soft corner ornaments: clouds / blossoms / bamboo leaves by house
    g.fillStyle = "rgba(255,255,255,.06)";
    for (let i = 0; i < 5; i++) { const x0 = rng.next() * w, y0 = rng.next() * h, s0 = 30 + rng.next() * 50; g.beginPath(); g.arc(x0, y0, s0, 0, Math.PI * 2); g.arc(x0 + s0, y0 + s0 * 0.2, s0 * 0.7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 0, w, h);
    // the board: a darker inset with a gold double frame
    const b = this.game?.board;
    if (b) {
      const px = this.ox - this.T * 0.3, py = this.oy - this.TH * 0.25, pw = b.w * this.T + this.T * 0.6, ph = b.h * this.TH + this.TH * 0.5;
      g.fillStyle = "rgba(0,0,0,.18)"; rr(g, px, py, pw, ph, this.T * 0.2); g.fill();
      g.strokeStyle = hs.trim; g.lineWidth = 2.5; rr(g, px, py, pw, ph, this.T * 0.2); g.stroke();
      g.globalAlpha = 0.6; g.lineWidth = 1; rr(g, px + 5, py + 5, pw - 10, ph - 10, this.T * 0.16); g.stroke(); g.globalAlpha = 1;
      // empty slots show as faint marks so you can see where tiles can slide
      g.fillStyle = "rgba(255,255,255,.05)";
      for (let i = 0; i < b.c.length; i++) if (b.c[i] >= 0) { const p = this.cxy(i); rr(g, p.x - this.T * 0.42, p.y - this.TH * 0.42, this.T * 0.84, this.TH * 0.84, this.T * 0.1); g.fill(); }
    }
  }

  // ------------------------------------------------------------ state
  setStage(game: Game, house: House, stage: number) {
    this.game = game; this.house = house; this.stageN = stage;
    this.sel = -1; this.springs.clear(); this.pops = []; this.parts = []; this.hintStep = null; this.drag = null;
    this.layout(); this.paintBackground();
    this.born = performance.now(); this.busy = false; this.kick();
  }
  sync(game: Game) { this.game = game; this.sel = -1; this.hintStep = null; this.kick(); }
  showHint(s: { a: number; b: number; drag?: { from: number; dir: number; k: number } }) { this.hintStep = s; this.hintT = performance.now(); this.hooks.sound("hint", 0); this.kick(); }

  // ------------------------------------------------------------ input
  private cellAt(e: PointerEvent) {
    const b = this.game?.board; if (!b) return -1;
    const r = this.cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left - this.ox) / this.T), y = Math.floor((e.clientY - r.top - this.oy) / this.TH);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1;
    return y * b.w + x;
  }
  private onDown = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canPlay() || !this.game) return;
    const i = this.cellAt(e);
    if (i < 0 || this.game.board.c[i] <= 0) return;
    this.cv.setPointerCapture?.(e.pointerId);
    this.drag = { from: i, sx: e.clientX, sy: e.clientY, axis: -1, dir: 0, off: 0, max: 0, chain: [i], moved: false };
  };
  private onMove = (e: PointerEvent) => {
    const dr = this.drag, G = this.game; if (!dr || !G) return;
    const dx = e.clientX - dr.sx, dy = e.clientY - dr.sy;
    if (dr.axis === -1) {
      if (Math.hypot(dx, dy) < 8) return;
      dr.axis = Math.abs(dx) > Math.abs(dy) ? 0 : 1;
    }
    const v = dr.axis === 0 ? dx : dy, cell = dr.axis === 0 ? this.T : this.TH;
    const dir = dr.axis === 0 ? (v >= 0 ? 0 : 1) : (v >= 0 ? 2 : 3);
    if (dir !== dr.dir || !dr.moved) { dr.dir = dir; dr.chain = chainOf(G.board, dr.from, dir); dr.max = room(G.board, dr.from, dir) * cell; dr.moved = true; }
    dr.off = Math.min(Math.abs(v), dr.max + cell * 0.18 * (1 - Math.exp(-Math.max(0, Math.abs(v) - dr.max) / cell)));
    this.kick();
  };
  private onUp = () => {
    const dr = this.drag, G = this.game; this.drag = null;
    if (!dr || !G) return;
    const cell = dr.axis === 0 ? this.T : this.TH;
    const k = dr.moved ? Math.round(Math.min(dr.off, dr.max) / cell) : 0;
    if (k === 0) {
      if (dr.moved && dr.off > 4) this.springBack(dr);
      else this.tap(dr.from);
      return;
    }
    const out = this.hooks.drag(dr.from, dr.dir, k);
    if (!out) { this.springBack(dr); this.hooks.sound("nope", this.pan(dr.from)); this.shakes.set(dr.from, performance.now()); return; }
    // keep the chain where the finger left it, then glide the last bit into place
    const [ux, uy] = DIRS[dr.dir], t0 = performance.now();
    for (const [from, to] of out.res.moved) { const p = this.cxy(from); this.springs.set(to, { fx: p.x + ux * dr.off, fy: p.y + uy * dr.off, t0, dur: 120 }); }
    this.hooks.sound("slide", this.pan(dr.from));
    void this.play(out.res, out.game, 120);
  };
  private onCancel = () => { if (this.drag) this.springBack(this.drag); this.drag = null; };
  private springBack(dr: NonNullable<JadeBoard["drag"]>) {
    const [ux, uy] = DIRS[dr.dir], t0 = performance.now();
    for (const c of dr.chain) { const p = this.cxy(c); this.springs.set(c, { fx: p.x + ux * dr.off, fy: p.y + uy * dr.off, t0, dur: 260 }); }
    this.kick();
  }
  /** a tap on cell i (also used by the dev hooks) */
  tap(i: number) {
    const G = this.game; if (!G || this.busy || G.board.c[i] <= 0) return;
    if (this.sel === i) { this.sel = -1; this.kick(); return; }
    if (this.sel < 0) { this.sel = i; this.hooks.sound("pick", this.pan(i)); this.kick(); return; }
    const a = this.sel;
    if (canPair(G.board, a, i)) { const out = this.hooks.pair(a, i); if (out) { void this.play(out.res, out.game, 0); return; } }
    if (G.board.c[a] === G.board.c[i]) { this.shakes.set(a, performance.now()); this.shakes.set(i, performance.now()); this.hooks.sound("nope", this.pan(i)); this.sel = -1; }
    else { this.sel = i; this.hooks.sound("pick", this.pan(i)); }
    this.kick();
  }
  /** dev hook: perform a drag move */
  dragTo(from: number, d: number, k: number) {
    const G = this.game; if (!G || this.busy) return;
    const out = this.hooks.drag(from, d, k); if (!out) return;
    const t0 = performance.now();
    for (const [f, to] of out.res.moved) { const p = this.cxy(f); this.springs.set(to, { fx: p.x, fy: p.y, t0, dur: 200 }); }
    this.hooks.sound("slide", this.pan(from));
    void this.play(out.res, out.game, 200);
  }

  // ------------------------------------------------------------ a match
  private wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
  async play(res: MatchResult, game: Game, delay: number) {
    this.busy = true; this.sel = -1; this.hintStep = null;
    // the slide lands first (the board shows the slid tiles, the pair still in place)
    const show = { ...game, board: { ...game.board, c: game.board.c.slice() } };
    show.board.c[res.a] = res.kind; show.board.c[res.b] = res.kind;
    this.game = show;
    this.kick();
    await this.wait(delay);
    const pa = this.cxy(res.a), pb = this.cxy(res.b), mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    this.game = game;
    const now = performance.now();
    this.pops.push({ kind: res.kind, x: pa.x, y: pa.y, tx: mx, ty: my, t0: now }, { kind: res.kind, x: pb.x, y: pb.y, tx: mx, ty: my, t0: now });
    this.hooks.sound("match", (this.pan(res.a) + this.pan(res.b)) / 2, res.combo);
    this.kick();
    await this.wait(260);
    this.burst(mx, my, 16); this.stars(mx, my, 6);
    this.hooks.float(mx, my - this.TH * 0.6, res.combo > 1 ? `+${res.gained} ×${res.combo}` : `+${res.gained}`, res.combo > 2);
    if (res.win) { await this.wait(200); this.celebrate(); }
    this.busy = false;
    this.kick();
  }
  async reshuffle(map: Map<number, number>) {
    this.busy = true; this.swirl = performance.now(); this.hooks.sound("shuffle", 0);
    const t0 = performance.now() + 250;
    for (const [, to] of map) this.springs.set(to, { fx: this.W / 2, fy: this.H / 2, t0, dur: 380 });
    this.kick();
    await this.wait(660);
    this.swirl = 0; this.busy = false;
  }
  celebrate() {
    this.hooks.sound("confetti", 0);
    const cols = ["#ffd23f", "#ff5a4a", "#3fd36b", "#3ea8ff", "#ffffff", this.house?.trim ?? "#ffd23f"];
    for (let i = 0; i < 90; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = this.T * (6 + Math.random() * 10);
      this.parts.push({ x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.6, y: this.H * 0.75, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.8, max: 1.8, col: cols[i % cols.length], size: this.T * 0.12, rot: Math.random() * 6, conf: true });
    }
    this.kick();
  }
  private burst(x: number, y: number, n: number) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = this.T * (2 + Math.random() * 4); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - this.T * 2, life: 0.6, max: 0.6, col: i % 2 ? "#ffd23f" : "#ffffff", size: this.T * (0.05 + Math.random() * 0.06) }); } }
  private stars(x: number, y: number, n: number) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = this.T * (2.5 + Math.random() * 2); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - this.T * 3, life: 0.8, max: 0.8, col: "#ffd23f", size: this.T * 0.16, star: true, rot: Math.random() * 3 }); } }

  // ------------------------------------------------------------ loop
  kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } };
  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0, this.W, this.H); else { g.fillStyle = "#0f5a34"; g.fillRect(0, 0, this.W, this.H); }
    const G = this.game;
    let animating = false;
    if (G) {
      const b = G.board, dr = this.drag;
      const swirlK = this.swirl ? Math.min(1, (now - this.swirl) / 250) : 0;
      // draw row by row so lower tiles overlap the backs of the ones above
      const order: number[] = []; for (let i = 0; i < b.c.length; i++) if (b.c[i] > 0) order.push(i);
      const dragged = new Set(dr && dr.moved ? dr.chain : []);
      for (const i of order) {
        let { x, y } = this.cxy(i);
        const k = Math.min(1, Math.max(0, (now - this.born - Math.floor(i / b.w) * 30 - (i % b.w) * 10) / 300));
        if (k <= 0) { animating = true; continue; }
        if (k < 1) animating = true;
        if (dragged.has(i) && dr) { const [ux, uy] = DIRS[dr.dir]; x += ux * dr.off; y += uy * dr.off; }
        const sp = this.springs.get(i);
        if (sp) { const q = Math.min(1, Math.max(0, (now - sp.t0) / sp.dur)); const e = q < 1 ? 1 - (1 - q) ** 3 * Math.cos(q * 4) : 1; x = sp.fx + (x - sp.fx) * e; y = sp.fy + (y - sp.fy) * e; if (q >= 1) this.springs.delete(i); else animating = true; }
        else if (swirlK) { x += (this.W / 2 - x) * swirlK; y += (this.H / 2 - y) * swirlK; animating = true; }
        const sh = this.shakes.get(i); let rot = 0;
        if (sh) { const q = (now - sh) / 350; if (q >= 1) this.shakes.delete(i); else { x += Math.sin(q * 30) * this.T * 0.08 * (1 - q); rot = Math.sin(q * 30) * 0.05 * (1 - q); animating = true; } }
        const hs = this.hintStep && now - this.hintT < 5000 && (this.hintStep.a === i || this.hintStep.b === i || this.hintStep.drag?.from === i);
        const isSel = i === this.sel || (dr?.from === i && dr.moved);
        const lift = isSel ? this.TH * 0.1 : hs ? Math.abs(Math.sin(t * 5)) * this.TH * 0.07 : 0;
        if (hs) animating = true;
        this.drawTile(b.c[i], x, y, (k < 1 ? easeBack(k) : 1) * (isSel ? 1.05 : 1), 1, isSel || !!hs, lift, rot);
      }
      // hint arrow for a slide
      if (this.hintStep?.drag && now - this.hintT < 5000) {
        const p = this.cxy(this.hintStep.drag.from), [ux, uy] = DIRS[this.hintStep.drag.dir], len = this.hintStep.drag.k * (ux ? this.T : this.TH);
        const wob = Math.sin(t * 6) * 4;
        g.strokeStyle = "#ffd23f"; g.fillStyle = "#ffd23f"; g.lineWidth = 4; g.lineCap = "round";
        const x1 = p.x + ux * (len + wob), y1 = p.y + uy * (len + wob);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x1, y1); g.stroke();
        g.beginPath(); g.moveTo(x1 + ux * 10, y1 + uy * 10); g.lineTo(x1 - uy * 8, y1 + ux * 8); g.lineTo(x1 + uy * 8, y1 - ux * 8); g.fill();
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i], q = (now - p.t0) / 300;
      if (q >= 1) { this.pops.splice(i, 1); continue; }
      animating = true;
      const e = q * q;
      this.drawTile(p.kind, p.x + (p.tx - p.x) * e, p.y + (p.ty - p.y) * e - Math.sin(q * Math.PI) * this.TH * 0.4, 1.08 - q * 0.25, q > 0.8 ? (1 - q) * 5 : 1, true, 0, (p.tx > p.x ? 1 : -1) * q * 0.4);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      animating = true;
      p.vy += this.T * 12 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, (p.life / p.max) * 1.8); g.fillStyle = p.col;
      if (p.star) { g.save(); g.translate(p.x, p.y); g.rotate((p.rot ?? 0) + t * 3); starPath(g, p.size); g.fill(); g.restore(); }
      else if (p.conf) { g.save(); g.translate(p.x, p.y); g.rotate((p.rot ?? 0) + t * 4); g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // keep running while something moves (or a pick glows); otherwise sleep
    if (this.visible && !document.hidden && (animating || this.drag || this.sel >= 0)) this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro.disconnect(); this.io.disconnect(); document.removeEventListener("visibilitychange", this.kick);
    this.cv.removeEventListener("pointerdown", this.onDown); this.cv.removeEventListener("pointermove", this.onMove);
    this.cv.removeEventListener("pointerup", this.onUp); this.cv.removeEventListener("pointercancel", this.onCancel);
    this.sprites.clear(); this.cv.remove();
  }
}

// ------------------------------------------------------------ the tile faces
function face_(g: CanvasRenderingContext2D, kind: number, x: number, y: number, w: number, h: number) {
  const k = kind - 1;
  g.textAlign = "center"; g.textBaseline = "middle";
  if (k < 9) {
    // circles: rings with a dot, three colours
    const n = k + 1, pos = DOT_POS[k], r = Math.min(w, h) * (n === 1 ? 0.3 : n <= 4 ? 0.15 : n <= 6 ? 0.12 : 0.1);
    pos.forEach(([px, py], i) => {
      const cx = x + px * w, cy = y + py * h, col = n === 1 ? "#c8202a" : DOT_COL[(i + n) % 3];
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * 0.32, 0, Math.PI * 2); g.fill();
      if (n === 1) { g.strokeStyle = "#1f5fbf"; g.lineWidth = r * 0.12; g.beginPath(); g.arc(cx, cy, r * 0.82, 0, Math.PI * 2); g.stroke(); }
    });
  } else if (k < 18) {
    // bamboo: green sticks with knots (the one is a single big red-tipped stalk)
    const n = k - 8, pos = DOT_POS[n - 1];
    const sw = Math.min(w, h) * (n === 1 ? 0.16 : 0.09), sh = h * (n === 1 ? 0.7 : n <= 3 ? 0.36 : n <= 6 ? 0.26 : 0.2);
    pos.forEach(([px, py], i) => {
      const cx = x + px * w, cy = y + py * h, col = n === 1 ? "#1f8a3a" : (i === 4 && n % 2) || (n === 9 && i % 3 === 1) ? "#c8202a" : "#1f8a3a";
      g.fillStyle = col; rr(g, cx - sw / 2, cy - sh / 2, sw, sh, sw * 0.4); g.fill();
      g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(cx - sw / 2, cy - sh * 0.04, sw, sh * 0.08);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(cx - sw * 0.1, cy - sh / 2 + 2, sw * 0.2, sh - 4);
      if (n === 1) { g.fillStyle = "#c8202a"; g.beginPath(); g.ellipse(cx, cy - sh / 2, sw * 0.9, sw * 0.6, 0, 0, Math.PI * 2); g.fill(); }
    });
  } else if (k < 27) {
    // characters: the numeral over 萬
    g.fillStyle = "#1a1a2a"; g.font = `bold ${Math.round(h * 0.36)}px ${CJK}`; g.fillText(CN[k - 18], x + w / 2, y + h * 0.3);
    g.fillStyle = "#c8202a"; g.font = `bold ${Math.round(h * 0.4)}px ${CJK}`; g.fillText("萬", x + w / 2, y + h * 0.72);
  } else if (k < 31) {
    g.fillStyle = "#1a1a2a"; g.font = `bold ${Math.round(h * 0.62)}px ${CJK}`; g.fillText(WINDS[k - 27], x + w / 2, y + h * 0.52);
  } else if (k === 31) {
    g.fillStyle = "#c8202a"; g.font = `bold ${Math.round(h * 0.64)}px ${CJK}`; g.fillText("中", x + w / 2, y + h * 0.52);
  } else if (k === 32) {
    g.fillStyle = "#1f8a3a"; g.font = `bold ${Math.round(h * 0.6)}px ${CJK}`; g.fillText("發", x + w / 2, y + h * 0.52);
  } else {
    g.strokeStyle = "#1f5fbf"; g.lineWidth = Math.min(w, h) * 0.07; rr(g, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76, w * 0.08); g.stroke();
    g.lineWidth = Math.min(w, h) * 0.03; rr(g, x + w * 0.24, y + h * 0.22, w * 0.52, h * 0.56, w * 0.05); g.stroke();
  }
}
const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function starPath(g: CanvasRenderingContext2D, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.45 : r, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); }
