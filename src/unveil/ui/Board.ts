// The Arrow Unveil board, drawn in 2D on one canvas (light on any phone). Under the board lies the stage's painting,
// shown faintly; every cell still covered wears a soft frosted tile. Arrows are thick rounded ribbons with a pointed
// head. Tap one: if its way is clear it slides out head first along its own path (and off the board), and the cells it
// covered pop open to show the painting; if another arrow is in the way it runs into it, shakes, flashes red and slides
// back. Clearing the board sweeps a shine across the finished picture.
import { DX, DY, occupancy, trackOf, xyOf, type Arrow } from "../engine";
import { paintPicture, hexA } from "../picture";
import type { Game } from "../play";
import type { Gallery, StageDef } from "../stage";

export type BoardSound = "tap" | "slide" | "exit" | "bump" | "reveal" | "erase";
export interface BoardHooks {
  canPlay: () => boolean;
  eraserArmed: () => boolean;
  tap: (id: number) => void;
  erase: (id: number) => void;
  sound: (e: BoardSound, pan: number, n?: number) => void;
}

interface Anim { id: number; t0: number; kind: "exit" | "bump"; track: [number, number][]; len: number; dist: number; blockId?: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean }

export class UnveilBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private pic: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private cell = 40; private ox = 0; private oy = 0;
  private def: StageDef | null = null; private gallery: Gallery | null = null; private game: Game | null = null;
  private gone = new Set<number>();
  private hidden = new Set<number>();
  private revealAt = new Map<number, number>();
  private anims: Anim[] = [];
  private shakeAt = new Map<number, number>();
  private flashAt = new Map<number, number>();
  private parts: Part[] = [];
  private hintId = -1; private hintAt = 0;
  private winAt = 0;
  private raf = 0; private last = 0; private disposed = false; private visible = true;
  private ro: ResizeObserver; private io: IntersectionObserver;

  constructor(private el: HTMLElement, private hooks: BoardHooks) {
    this.cv = document.createElement("canvas");
    this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
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
  }
  private layout() {
    const d = this.def;
    if (d) {
      const { cols, rows } = d.board;
      this.cell = Math.max(14, Math.min((this.W - 20) / cols, (this.H - 20) / rows, 76));
      this.ox = (this.W - cols * this.cell) / 2; this.oy = (this.H - rows * this.cell) / 2;
      this.paintPicture();
    }
    this.kick();
  }
  private cx(x: number) { return this.ox + (x + 0.5) * this.cell; }
  private cy(y: number) { return this.oy + (y + 0.5) * this.cell; }
  private pan(x: number) { return this.def ? Math.max(-0.85, Math.min(0.85, ((x + 0.5) / this.def.board.cols * 2 - 1) * 0.85)) : 0; }
  /** a cell's centre on screen (dev hook / tests) */
  cellScreen(i: number) { const d = this.def!; const [x, y] = xyOf(d.board, i); return { x: this.cx(x), y: this.cy(y) }; }
  arrowScreen(id: number) { const a = this.def?.board.arrows.find((q) => q.id === id); return a ? this.cellScreen(a.cells[a.cells.length - 1]) : null; }

  private paintPicture() {
    const d = this.def, gal = this.gallery; if (!d || !gal) return;
    const w = Math.round(d.board.cols * this.cell * this.dpr), h = Math.round(d.board.rows * this.cell * this.dpr);
    const c = this.pic ?? document.createElement("canvas");
    c.width = w; c.height = h;
    paintPicture(c.getContext("2d")!, w, h, gal.id, d.stage);
    this.pic = c;
  }
  /** the finished picture as an image URL (for the clear screen) */
  pictureURL() { try { return this.pic?.toDataURL("image/jpeg", 0.85) ?? ""; } catch { return ""; } }

  // ------------------------------------------------------------ state
  setStage(d: StageDef, gallery: Gallery, g: Game) {
    this.def = d; this.gallery = gallery; this.game = g;
    this.gone = new Set(g.gone); this.hidden.clear(); this.revealAt.clear();
    this.anims = []; this.parts = []; this.shakeAt.clear(); this.flashAt.clear(); this.hintId = -1; this.winAt = 0;
    const now = performance.now();
    for (const a of d.board.arrows) if (this.gone.has(a.id)) for (const c of a.cells) this.revealAt.set(c, now - 2000);
    this.layout();
  }
  sync(g: Game) {
    const now = performance.now();
    this.game = g;
    for (const id of g.gone) if (!this.gone.has(id)) { const a = this.arrow(id); if (a) for (const c of a.cells) this.revealAt.set(c, now); }
    this.gone = new Set(g.gone);
    this.kick();
  }
  private arrow(id: number) { return this.def?.board.arrows.find((a) => a.id === id); }
  get busy() { return this.anims.some((a) => a.kind === "exit"); }

  /** animate an arrow leaving the board */
  exit(id: number) {
    const a = this.arrow(id), d = this.def; if (!a || !d) return;
    const track = trackOf(d.board, a, 1);
    const dist = track.length - a.cells.length;
    this.hidden.add(id);
    this.anims.push({ id, t0: performance.now(), kind: "exit", track, len: a.cells.length, dist });
    const [hx] = xyOf(d.board, a.cells[a.cells.length - 1]);
    this.hooks.sound("slide", this.pan(hx), a.cells.length);
    // the cells pop open as the tail passes
    const now = performance.now();
    a.cells.forEach((c, i) => this.revealAt.set(c, now + (a.cells.length - i) * 55));
    setTimeout(() => { this.hooks.sound("exit", this.pan(hx), a.cells.length); }, 220);
    for (const c of a.cells) { const [x, y] = xyOf(d.board, c); setTimeout(() => this.burst(this.cx(x), this.cy(y), this.colorOf(a), 5), 120 + Math.random() * 200); }
    this.gone.add(id);
    this.kick();
  }
  /** animate an arrow running into another one and sliding back */
  bump(id: number, blockId: number, steps: number) {
    const a = this.arrow(id), d = this.def; if (!a || !d) return;
    this.hidden.add(id);
    this.anims.push({ id, t0: performance.now(), kind: "bump", track: trackOf(d.board, a, 1), len: a.cells.length, dist: steps + 0.35, blockId });
    const [hx] = xyOf(d.board, a.cells[a.cells.length - 1]);
    this.hooks.sound("slide", this.pan(hx), 1);
    setTimeout(() => { this.shakeAt.set(blockId, performance.now()); this.flashAt.set(id, performance.now()); this.hooks.sound("bump", this.pan(hx)); }, Math.max(60, (steps + 0.35) / 14 * 1000));
    this.kick();
  }
  /** the eraser: an arrow pops away on the spot */
  pop(id: number) {
    const a = this.arrow(id), d = this.def; if (!a || !d) return;
    const now = performance.now();
    for (const c of a.cells) { const [x, y] = xyOf(d.board, c); this.burst(this.cx(x), this.cy(y), this.colorOf(a), 8); this.ring(this.cx(x), this.cy(y), "#ffffff", this.cell * 0.4); this.revealAt.set(c, now); }
    this.gone.add(id); this.hidden.add(id);
    this.hooks.sound("erase", this.pan(xyOf(d.board, a.cells[0])[0]));
    this.kick();
  }
  hint(id: number) { this.hintId = id; this.hintAt = performance.now(); this.kick(); }
  celebrate() {
    this.winAt = performance.now();
    const cols = this.gallery?.palette ?? ["#ffd23f"];
    for (let i = 0; i < 90; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 200 + Math.random() * 420; this.parts.push({ x: this.W / 2, y: this.H * 0.55, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.4 + Math.random() * 0.6, col: cols[i % cols.length], size: 3 + Math.random() * 4 }); }
    this.kick();
  }
  private colorOf(a: Arrow) { const p = this.gallery?.palette ?? ["#ff5a5a"]; return p[a.color % p.length]; }

  // ------------------------------------------------------------ input
  private onDown = (e: PointerEvent) => {
    const d = this.def; if (!d || !this.hooks.canPlay() || this.winAt) return;
    const r = this.cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left - this.ox) / this.cell), y = Math.floor((e.clientY - r.top - this.oy) / this.cell);
    if (x < 0 || y < 0 || x >= d.board.cols || y >= d.board.rows) return;
    const occ = occupancy(d.board, this.gone);
    let id = occ[y * d.board.cols + x];
    if (id < 0) {
      // a near miss: the closest arrow cell around the tap
      let best = -1, bd = 0.75;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= d.board.cols || yy >= d.board.rows) continue;
        const o = occ[yy * d.board.cols + xx]; if (o < 0) continue;
        const dd = Math.hypot((e.clientX - r.left - this.cx(xx)) / this.cell, (e.clientY - r.top - this.cy(yy)) / this.cell);
        if (dd < bd) { bd = dd; best = o; }
      }
      id = best;
    }
    if (id < 0 || this.anims.some((a) => a.id === id)) return;
    this.hooks.sound("tap", this.pan(x));
    if (this.hooks.eraserArmed()) this.hooks.erase(id); else this.hooks.tap(id);
  };
  /** tap an arrow by id (dev hook) */
  tapId(id: number) { if (this.hooks.canPlay()) this.hooks.tap(id); }

  // ------------------------------------------------------------ effects
  private burst(x: number, y: number, col: string, n: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.45 + Math.random() * 0.35, col, size: 1.5 + Math.random() * 2.5 }); }
  }
  private ring(x: number, y: number, col: string, r: number) { this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.4, col, size: r, ring: true }); }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.985; }
    this.parts = this.parts.filter((p) => p.life < p.max);
    // finished animations
    this.anims = this.anims.filter((a) => {
      const t = (now - a.t0) / 1000;
      if (a.kind === "exit") { if (this.exitPos(a, t) >= a.dist + 0.01) { return false; } return true; }
      if (t > this.bumpTime(a)) { this.hidden.delete(a.id); return false; }
      return true;
    });
    this.draw(now);
    const live = this.anims.length || this.parts.length || now - this.hintAt < 2400 || [...this.revealAt.values()].some((t) => now - t < 700) || [...this.shakeAt.values()].some((t) => now - t < 500) || (this.winAt && now - this.winAt < 2500);
    if (live) this.kick(); else setTimeout(this.kick, 400);
  };
  /** cells travelled by a leaving arrow after t seconds (it speeds up) */
  private exitPos(a: Anim, t: number) { return Math.min(a.dist, 9 * t + 22 * t * t); }
  private bumpTime(a: Anim) { return (a.dist / 14) * 2 + 0.12; }
  private bumpPos(a: Anim, t: number) { const go = a.dist / 14; if (t < go) return a.dist * (t / go) ** 0.7; if (t < go + 0.12) return a.dist; const u = Math.min(1, (t - go - 0.12) / go); return a.dist * (1 - u * u * (3 - 2 * u)); }

  // ------------------------------------------------------------ draw
  private draw(now: number) {
    const g = this.g, d = this.def, gal = this.gallery, c = this.cell;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    if (!d || !gal || !this.pic) return;
    const { cols, rows, mask } = d.board;
    const bw = cols * c, bh = rows * c;
    const occ = occupancy(d.board, new Set([...this.gone].filter((id) => !this.anims.some((a) => a.id === id && a.kind === "bump"))));
    const won = this.winAt ? Math.min(1, (now - this.winAt) / 900) : 0;
    // the board's shadow and frame
    g.save();
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 24; g.shadowOffsetY = 10;
    g.fillStyle = "rgba(20,14,30,.55)";
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y * cols + x]) g.fillRect(this.ox + x * c - 0.5, this.oy + y * c - 0.5, c + 1, c + 1);
    g.restore();
    // the picture: faint everywhere on the shape, full where uncovered
    g.save();
    g.beginPath();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y * cols + x]) g.rect(this.ox + x * c - 0.3, this.oy + y * c - 0.3, c + 0.6, c + 0.6);
    g.clip();
    g.globalAlpha = 0.22 + won * 0.78; g.drawImage(this.pic, this.ox, this.oy, bw, bh); g.globalAlpha = 1;
    g.restore();
    // uncovered cells at full strength (popping open), covered cells under frosted tiles
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; if (!mask[i]) continue;
      const px = this.ox + x * c, py = this.oy + y * c;
      const rt = this.revealAt.get(i);
      const covered = occ[i] >= 0 || (rt !== undefined && now < rt);
      if (!covered && won < 1) {
        const k = rt === undefined ? 1 : Math.min(1, (now - rt) / 380);
        const e = 1 + 1.7 * (k - 1) ** 3 + 0.7 * (k - 1) ** 2; // a little overshoot
        const s = c * Math.max(0, e);
        g.save(); g.beginPath(); g.rect(px + (c - s) / 2, py + (c - s) / 2, s, s); g.clip();
        g.drawImage(this.pic, this.ox, this.oy, bw, bh); g.restore();
        if (rt !== undefined && k < 1) { g.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; g.fillRect(px, py, c, c); }
      } else if (covered && won < 1) {
        g.fillStyle = "rgba(250,246,238,.9)"; rr(g, px + c * 0.06, py + c * 0.06, c * 0.88, c * 0.88, c * 0.18); g.fill();
        g.fillStyle = hexA(gal.glow, 0.14); rr(g, px + c * 0.06, py + c * 0.06, c * 0.88, c * 0.42, c * 0.18); g.fill();
      }
    }
    // the shine sweep when the picture is complete
    if (this.winAt) {
      const k = Math.min(1, (now - this.winAt) / 1600), sx = this.ox - bw * 0.4 + k * bw * 1.8;
      g.save(); g.beginPath(); for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y * cols + x]) g.rect(this.ox + x * c, this.oy + y * c, c, c); g.clip();
      const gr = g.createLinearGradient(sx - bw * 0.2, 0, sx + bw * 0.2, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(this.ox, this.oy, bw, bh); g.restore();
    }
    // arrows at rest
    const hintOn = this.hintId >= 0 && !this.gone.has(this.hintId) && now - this.hintAt < 2400;
    for (const a of d.board.arrows) {
      if (this.gone.has(a.id) || this.hidden.has(a.id)) continue;
      const st = this.shakeAt.get(a.id); const sh = st !== undefined && now - st < 450 ? Math.sin((now - st) / 22) * c * 0.08 * (1 - (now - st) / 450) : 0;
      const pts = a.cells.map((ci) => { const [x, y] = xyOf(d.board, ci); return [this.cx(x) + sh, this.cy(y)] as [number, number]; });
      if (hintOn && a.id === this.hintId) { const p = 0.5 + 0.5 * Math.sin((now - this.hintAt) / 140); g.save(); g.shadowColor = "#fff6a0"; g.shadowBlur = 18 + p * 14; this.ribbon(pts, a, "#fff6a0", c * 0.5); g.restore(); }
      this.ribbon(pts, a, this.colorOf(a), c * 0.3);
    }
    // moving arrows
    for (const an of this.anims) {
      const a = this.arrow(an.id); if (!a) continue;
      const t = (now - an.t0) / 1000, s = an.kind === "exit" ? this.exitPos(an, t) : this.bumpPos(an, t);
      const pts = sub(an.track, s, an.len).map(([x, y]) => [this.cx(x), this.cy(y)] as [number, number]);
      const ft = this.flashAt.get(a.id), flash = ft !== undefined && now - ft < 500;
      g.save();
      if (an.kind === "exit") { g.globalAlpha = Math.max(0, 1 - Math.max(0, s - (an.dist - an.len - 1)) / (an.len + 1)); }
      this.ribbon(pts, a, flash ? "#ff4a5a" : this.colorOf(a), c * 0.3);
      g.restore();
    }
    // particles
    for (const p of this.parts) {
      const f = p.life / p.max;
      if (p.ring) { g.strokeStyle = hexA(p.col, 0.8 * (1 - f)); g.lineWidth = 3 * (1 - f) + 1; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + f * 1.2), 0, Math.PI * 2); g.stroke(); continue; }
      g.globalAlpha = 1 - f * f; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size * (1 - f * 0.4), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
  }
  /** a rounded ribbon through points with an arrowhead at the end */
  private ribbon(pts: [number, number][], a: Arrow, col: string, w: number) {
    if (!pts.length) return;
    const g = this.g, c = this.cell;
    const [hx, hy] = pts[pts.length - 1];
    let dx = DX[a.dir], dy = DY[a.dir];
    if (pts.length >= 2) { const [px, py] = pts[pts.length - 2]; const l = Math.hypot(hx - px, hy - py); if (l > 0.01) { dx = (hx - px) / l; dy = (hy - py) / l; } }
    const tipX = hx + dx * c * 0.36, tipY = hy + dy * c * 0.36, baseX = hx - dx * c * 0.06, baseY = hy - dy * c * 0.06;
    g.lineCap = "round"; g.lineJoin = "round";
    const line = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(baseX, baseY); };
    const head = (grow: number) => { g.beginPath(); g.moveTo(tipX + dx * grow, tipY + dy * grow); g.lineTo(baseX - dy * (c * 0.3 + grow) - dx * grow, baseY + dx * (c * 0.3 + grow) - dy * grow); g.lineTo(baseX + dy * (c * 0.3 + grow) - dx * grow, baseY - dx * (c * 0.3 + grow) - dy * grow); g.closePath(); };
    // dark outline, colour, a light stripe
    g.strokeStyle = "rgba(20,10,30,.55)"; g.lineWidth = w + Math.max(2, c * 0.07); line(); g.stroke();
    g.fillStyle = "rgba(20,10,30,.55)"; head(Math.max(1, c * 0.04)); g.fill();
    g.strokeStyle = col; g.lineWidth = w; line(); g.stroke();
    g.fillStyle = col; head(0); g.fill();
    g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = Math.max(1, w * 0.25);
    g.beginPath(); g.moveTo(pts[0][0] - w * 0.12, pts[0][1] - w * 0.12); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - w * 0.12, pts[i][1] - w * 0.12); g.stroke();
    // a dot on the tail
    g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(pts[0][0], pts[0][1], w * 0.18, 0, Math.PI * 2); g.fill();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    this.cv.remove();
  }
}

/** the run of `len` points starting `s` cells along a track (fractional, interpolated) */
function sub(track: [number, number][], s: number, len: number): [number, number][] {
  const out: [number, number][] = [];
  const at = (u: number): [number, number] => { const i = Math.max(0, Math.min(track.length - 2, Math.floor(u))), f = Math.max(0, Math.min(1, u - i)); return [track[i][0] + (track[i + 1][0] - track[i][0]) * f, track[i][1] + (track[i + 1][1] - track[i][1]) * f]; };
  out.push(at(s));
  for (let k = Math.ceil(s + 1e-6); k < s + len - 1; k++) out.push(at(k));
  out.push(at(s + len - 1));
  return out;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
