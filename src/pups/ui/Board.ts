// The Noodle Pups yard, drawn in 2D on one canvas (light on any phone). A light patterned ground (per park), faint
// dots on the free cells of the yard, rocks and bushes, and the pups: long beaded noodle bodies with a cute dog head
// (floppy ears, shiny eyes that blink, a nose, a tongue out when running) and a wagging tail. Tap a pup: it runs head
// first along its own path and off the yard; if a pup or a rock is in the way it bumps, the other one shakes and it
// wriggles back.
import { DX, DY, ROCK, occupancy, trackOf, xyOf, type Arrow as Pup } from "../engine";
import type { Game } from "../play";
import type { Park, StageDef } from "../stage";

export type BoardSound = "tap" | "run" | "out" | "bump" | "treat" | "bark";
export interface BoardHooks {
  canPlay: () => boolean;
  treatArmed: () => boolean;
  tap: (id: number) => void;
  treat: (id: number) => void;
  sound: (e: BoardSound, pan: number, n?: number) => void;
}

export const PUP_COLS = ["#8a5a2e", "#2e2a36", "#e0403a", "#3a7ae0", "#f08a2a", "#3aa85a", "#8a4ad0", "#e8559a"];
interface Anim { id: number; t0: number; kind: "exit" | "bump"; track: [number, number][]; len: number; dist: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean; heart?: boolean }

export class PupsBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1;
  private cell = 40; private ox = 0; private oy = 0;
  private def: StageDef | null = null; private park: Park | null = null;
  private gone = new Set<number>();
  private hidden = new Set<number>();
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
      this.cell = Math.max(14, Math.min((this.W - 24) / cols, (this.H - 24) / rows, 70));
      this.ox = (this.W - cols * this.cell) / 2; this.oy = (this.H - rows * this.cell) / 2;
    }
    this.paintGround();
    this.kick();
  }
  private cx(x: number) { return this.ox + (x + 0.5) * this.cell; }
  private cy(y: number) { return this.oy + (y + 0.5) * this.cell; }
  private pan(x: number) { return this.def ? Math.max(-0.85, Math.min(0.85, ((x + 0.5) / this.def.board.cols * 2 - 1) * 0.85)) : 0; }
  cellScreen(i: number) { const d = this.def!; const [x, y] = xyOf(d.board, i); return { x: this.cx(x), y: this.cy(y) }; }
  pupScreen(id: number) { const a = this.pup(id); return a ? this.cellScreen(a.cells[a.cells.length - 1]) : null; }

  /** the park's ground: a soft gradient with a light geometric pattern (painted once per stage and size) */
  private paintGround() {
    const p = this.park; if (!p) return;
    const W = this.W, H = this.H, d = this.dpr;
    const c = this.bg ?? document.createElement("canvas");
    c.width = Math.round(W * d); c.height = Math.round(H * d);
    const g = c.getContext("2d")!;
    g.setTransform(d, 0, 0, d, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, p.ground[0]); gr.addColorStop(1, p.ground[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // a tumbling-blocks pattern of thin lines
    const s = 22; g.strokeStyle = p.line; g.lineWidth = 1.4; g.lineJoin = "round";
    for (let row = -1, y = -s; y < H + s; row++, y += s * 1.5) for (let x = (row % 2) * s * 0.866 - s; x < W + s; x += s * 1.732) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9); } g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 0.9); g.moveTo(x, y); g.lineTo(x + s * 0.78, y + s * 0.45); g.moveTo(x, y); g.lineTo(x - s * 0.78, y + s * 0.45); g.stroke();
    }
    // a soft vignette keeps the eye on the yard
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, p.id === "night" ? "rgba(0,0,0,.35)" : "rgba(120,90,40,.12)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    if (p.id === "night") for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 0.6 + Math.random() * 1.2, 0, Math.PI * 2); g.fill(); }
    this.bg = c;
  }

  // ------------------------------------------------------------ state
  setStage(d: StageDef, park: Park, g: Game) {
    this.def = d; this.park = park;
    this.gone = new Set(g.gone); this.hidden.clear();
    this.anims = []; this.parts = []; this.shakeAt.clear(); this.flashAt.clear(); this.hintId = -1; this.winAt = 0;
    this.layout();
  }
  sync(g: Game) { this.gone = new Set(g.gone); this.kick(); }
  private pup(id: number) { return this.def?.board.arrows.find((a) => a.id === id); }
  get busy() { return this.anims.some((a) => a.kind === "exit"); }
  private colorOf(a: Pup) { return PUP_COLS[a.color % PUP_COLS.length]; }

  /** a pup runs out of the yard */
  exit(id: number) {
    const a = this.pup(id), d = this.def; if (!a || !d) return;
    const track = trackOf(d.board, a, 2);
    this.hidden.add(id); this.gone.add(id);
    this.anims.push({ id, t0: performance.now(), kind: "exit", track, len: a.cells.length, dist: track.length - a.cells.length });
    const [hx, hy] = xyOf(d.board, a.cells[a.cells.length - 1]);
    this.hooks.sound("run", this.pan(hx), a.cells.length);
    setTimeout(() => this.hooks.sound("out", this.pan(hx)), 260);
    for (let i = 0; i < 6; i++) this.parts.push({ x: this.cx(hx), y: this.cy(hy), vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, life: 0, max: 0.6 + Math.random() * 0.4, col: "#ff7a9a", size: this.cell * 0.12, heart: true });
    this.kick();
  }
  /** a pup bumps into a pup or a rock and wriggles back */
  bump(id: number, blockId: number, steps: number) {
    const a = this.pup(id), d = this.def; if (!a || !d) return;
    this.hidden.add(id);
    this.anims.push({ id, t0: performance.now(), kind: "bump", track: trackOf(d.board, a, 2), len: a.cells.length, dist: steps + 0.35 });
    const [hx] = xyOf(d.board, a.cells[a.cells.length - 1]);
    this.hooks.sound("run", this.pan(hx), 1);
    setTimeout(() => { this.shakeAt.set(blockId, performance.now()); this.flashAt.set(id, performance.now()); this.hooks.sound("bump", this.pan(hx)); }, Math.max(60, ((steps + 0.35) / 14) * 1000));
    this.kick();
  }
  /** a treat: the pup hops out of the yard on the spot */
  pop(id: number) {
    const a = this.pup(id), d = this.def; if (!a || !d) return;
    for (const c of a.cells) { const [x, y] = xyOf(d.board, c); this.burst(this.cx(x), this.cy(y), this.colorOf(a), 6); }
    const [hx, hy] = xyOf(d.board, a.cells[a.cells.length - 1]);
    this.ring(this.cx(hx), this.cy(hy), "#ffd23f", this.cell * 0.6);
    this.gone.add(id); this.hidden.add(id);
    this.hooks.sound("treat", this.pan(hx));
    this.kick();
  }
  hint(id: number) { this.hintId = id; this.hintAt = performance.now(); this.kick(); }
  celebrate() {
    this.winAt = performance.now();
    for (let i = 0; i < 90; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 220 + Math.random() * 420; this.parts.push({ x: this.W / 2, y: this.H * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.4 + Math.random() * 0.6, col: PUP_COLS[i % PUP_COLS.length], size: 3 + Math.random() * 4 }); }
    this.kick();
  }

  // ------------------------------------------------------------ input
  private onDown = (e: PointerEvent) => {
    const d = this.def; if (!d || !this.hooks.canPlay() || this.winAt) return;
    const r = this.cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const x = Math.floor((px - this.ox) / this.cell), y = Math.floor((py - this.oy) / this.cell);
    const occ = occupancy(d.board, this.gone);
    let id = x >= 0 && y >= 0 && x < d.board.cols && y < d.board.rows ? occ[y * d.board.cols + x] : -1;
    if (id < 0 || id === ROCK) {
      // a near miss: the closest pup cell around the tap
      let best = -1, bd = 0.8;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= d.board.cols || yy >= d.board.rows) continue;
        const o = occ[yy * d.board.cols + xx]; if (o < 0 || o === ROCK) continue;
        const dd = Math.hypot((px - this.cx(xx)) / this.cell, (py - this.cy(yy)) / this.cell);
        if (dd < bd) { bd = dd; best = o; }
      }
      id = best;
    }
    if (id < 0 || this.anims.some((a) => a.id === id)) return;
    this.hooks.sound("tap", this.pan(x));
    if (this.hooks.treatArmed()) this.hooks.treat(id); else this.hooks.tap(id);
  };
  tapId(id: number) { if (this.hooks.canPlay()) this.hooks.tap(id); }

  // ------------------------------------------------------------ effects
  private burst(x: number, y: number, col: string, n: number) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.45 + Math.random() * 0.35, col, size: 1.5 + Math.random() * 2.5 }); } }
  private ring(x: number, y: number, col: string, r: number) { this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, col, size: r, ring: true }); }

  // ------------------------------------------------------------ loop
  private kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); } };
  private frame = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.heart ? 60 : 520) * dt; p.vx *= 0.985; }
    this.parts = this.parts.filter((p) => p.life < p.max);
    this.anims = this.anims.filter((a) => {
      const t = (now - a.t0) / 1000;
      if (a.kind === "exit") return this.exitPos(a, t) < a.dist;
      if (t > this.bumpTime(a)) { this.hidden.delete(a.id); return false; }
      return true;
    });
    this.draw(now);
    // tails wag and eyes blink, so the yard keeps a gentle frame rate even when idle
    const busy = this.anims.length || this.parts.length || now - this.hintAt < 2400 || [...this.shakeAt.values()].some((t) => now - t < 500);
    if (busy) this.kick(); else setTimeout(this.kick, 66);
  };
  private exitPos(a: Anim, t: number) { return Math.min(a.dist, 10 * t + 24 * t * t); }
  private bumpTime(a: Anim) { return (a.dist / 14) * 2 + 0.12; }
  private bumpPos(a: Anim, t: number) { const go = a.dist / 14; if (t < go) return a.dist * (t / go) ** 0.7; if (t < go + 0.12) return a.dist; const u = Math.min(1, (t - go - 0.12) / go); return a.dist * (1 - u * u * (3 - 2 * u)); }

  // ------------------------------------------------------------ draw
  private draw(now: number) {
    const g = this.g, d = this.def, c = this.cell;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) g.drawImage(this.bg, 0, 0); else { g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, this.cv.width, this.cv.height); }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!d || !this.park) return;
    const { cols, rows, mask } = d.board;
    const night = this.park.id === "night";
    const occ = occupancy(d.board, this.gone);
    // the yard: faint dots on every cell of its shape
    g.fillStyle = night ? "rgba(255,255,255,.16)" : "rgba(120,90,40,.16)";
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y * cols + x] && occ[y * cols + x] < 0) { g.beginPath(); g.arc(this.cx(x), this.cy(y), Math.max(1.4, c * 0.07), 0, Math.PI * 2); g.fill(); }
    // rocks and bushes
    for (const r of d.board.rocks ?? []) {
      const [x, y] = xyOf(d.board, r), st = this.shakeAt.get(ROCK), sh = st !== undefined && now - st < 400 ? Math.sin((now - st) / 20) * c * 0.05 : 0;
      this.rock(this.cx(x) + sh, this.cy(y), c, (x * 7 + y * 3) % 3 === 0);
    }
    // pups at rest
    const hintOn = this.hintId >= 0 && !this.gone.has(this.hintId) && now - this.hintAt < 2400;
    for (const a of d.board.arrows) {
      if (this.gone.has(a.id) || this.hidden.has(a.id)) continue;
      const st = this.shakeAt.get(a.id); const sh = st !== undefined && now - st < 450 ? Math.sin((now - st) / 22) * c * 0.08 * (1 - (now - st) / 450) : 0;
      const pts = a.cells.map((ci) => { const [x, y] = xyOf(d.board, ci); return [this.cx(x) + sh, this.cy(y)] as [number, number]; });
      if (hintOn && a.id === this.hintId) { const p = 0.5 + 0.5 * Math.sin((now - this.hintAt) / 140); g.save(); g.shadowColor = "#ffd23f"; g.shadowBlur = 14 + p * 16; this.body(pts, "#fff3a0", c * 0.56); g.restore(); }
      this.pupDraw(pts, a, this.colorOf(a), now, false);
    }
    // running pups
    for (const an of this.anims) {
      const a = this.pup(an.id); if (!a) continue;
      const t = (now - an.t0) / 1000, s = an.kind === "exit" ? this.exitPos(an, t) : this.bumpPos(an, t);
      const pts = sub(an.track, s, an.len).map(([x, y]) => [this.cx(x), this.cy(y)] as [number, number]);
      const ft = this.flashAt.get(a.id), flash = ft !== undefined && now - ft < 450;
      this.pupDraw(pts, a, flash ? "#ff4a4a" : this.colorOf(a), now, true);
    }
    // particles
    for (const p of this.parts) {
      const f = p.life / p.max;
      if (p.ring) { g.strokeStyle = hexA(p.col, 0.8 * (1 - f)); g.lineWidth = 3 * (1 - f) + 1; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + f * 1.2), 0, Math.PI * 2); g.stroke(); continue; }
      g.globalAlpha = 1 - f * f; g.fillStyle = p.col;
      if (p.heart) heart(g, p.x, p.y, p.size * (1 + f * 0.3)); else { g.beginPath(); g.arc(p.x, p.y, p.size * (1 - f * 0.4), 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
  }
  private rock(x: number, y: number, c: number, bush: boolean) {
    const g = this.g, r = c * 0.42;
    g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x + r * 0.1, y + r * 0.55, r * 0.95, r * 0.35, 0, 0, Math.PI * 2); g.fill();
    if (bush) {
      for (const [dx, dy, rr] of [[-0.4, 0.1, 0.55], [0.4, 0.1, 0.55], [0, -0.25, 0.62], [0, 0.25, 0.55]]) { const gr = g.createRadialGradient(x + dx * r - rr * r * 0.3, y + dy * r - rr * r * 0.4, 0, x + dx * r, y + dy * r, rr * r); gr.addColorStop(0, "#7ad06a"); gr.addColorStop(1, "#2f8a3a"); g.fillStyle = gr; g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#ff6a8a"; for (const [dx, dy] of [[-0.35, -0.2], [0.3, 0.15], [0.05, -0.55]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, r * 0.09, 0, Math.PI * 2); g.fill(); }
    } else {
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      gr.addColorStop(0, "#c8c2ba"); gr.addColorStop(0.7, "#8e867c"); gr.addColorStop(1, "#5e5850");
      g.fillStyle = gr; g.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = r * (0.85 + ((k * 5) % 3) * 0.07); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9); } g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.25, r * 0.12, -0.5, 0, Math.PI * 2); g.fill();
    }
  }
  /** a thick rounded line through points */
  private body(pts: [number, number][], col: string, w: number) {
    const g = this.g; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (pts.length === 1) g.lineTo(pts[0][0] + 0.01, pts[0][1]); g.stroke();
  }
  /** a whole pup: tail, beaded body, then the head */
  private pupDraw(pts: [number, number][], a: Pup, col: string, now: number, running: boolean) {
    if (!pts.length) return;
    const g = this.g, c = this.cell, w = c * 0.42;
    const [hx, hy] = pts[pts.length - 1];
    let dx = DX[a.dir], dy = DY[a.dir];
    if (pts.length >= 2) { const [px, py] = pts[pts.length - 2]; const l = Math.hypot(hx - px, hy - py); if (l > 0.01) { dx = (hx - px) / l; dy = (hy - py) / l; } }
    // the tail: a little curl off the last segment, wagging
    const [tx, ty] = pts[0];
    let bx = -dx, by = -dy;
    if (pts.length >= 2) { const [nx, ny] = pts[1]; const l = Math.hypot(tx - nx, ty - ny); if (l > 0.01) { bx = (tx - nx) / l; by = (ty - ny) / l; } }
    const wag = Math.sin(now / (running ? 60 : 160) + a.id) * 0.6;
    const ca = Math.cos(wag), sa = Math.sin(wag), wx = bx * ca - by * sa, wy = bx * sa + by * ca;
    g.strokeStyle = shade(col, -0.35); g.lineWidth = w * 0.42; g.lineCap = "round";
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + bx * c * 0.35, ty + by * c * 0.35, tx + wx * c * 0.5 - wy * c * 0.15, ty + wy * c * 0.5 + wx * c * 0.15); g.stroke();
    // body: outline, colour, a shine stripe and beads
    this.body(pts, shade(col, -0.45), w + Math.max(2, c * 0.08));
    this.body(pts, col, w);
    g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = w * 0.28;
    g.beginPath(); g.moveTo(pts[0][0] - w * 0.15, pts[0][1] - w * 0.15); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - w * 0.15, pts[i][1] - w * 0.15); g.stroke();
    g.fillStyle = shade(col, 0.25);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / (c * 0.25)));
      for (let k = 0; k < n; k++) { const u = k / n; g.beginPath(); g.arc(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, w * 0.13, 0, Math.PI * 2); g.fill(); }
    }
    // the head, turned the way the pup faces
    const bob = running ? Math.sin(now / 50) * c * 0.03 : 0;
    g.save(); g.translate(hx + dx * c * 0.12, hy + dy * c * 0.12 + bob); g.rotate(Math.atan2(dy, dx));
    const R = c * 0.4, dark = shade(col, -0.35);
    // ears flap back
    const flap = running ? Math.sin(now / 45) * 0.25 : Math.sin(now / 700 + a.id) * 0.06;
    for (const s of [-1, 1]) { g.save(); g.rotate(s * (0.5 + flap)); g.fillStyle = dark; g.beginPath(); g.ellipse(-R * 0.65, s * R * 0.55, R * 0.55, R * 0.28, s * 0.4, 0, Math.PI * 2); g.fill(); g.restore(); }
    // head and muzzle
    const hg = g.createRadialGradient(-R * 0.2, -R * 0.3, R * 0.1, 0, 0, R * 1.05); hg.addColorStop(0, shade(col, 0.3)); hg.addColorStop(1, col);
    g.fillStyle = shade(col, -0.45); g.beginPath(); g.ellipse(0, 0, R * 0.95 + 1.5, R * 0.85 + 1.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hg; g.beginPath(); g.ellipse(0, 0, R * 0.95, R * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade(col, 0.55); g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.48, R * 0.42, 0, 0, Math.PI * 2); g.fill();
    // nose and tongue
    g.fillStyle = "#1e1a22"; g.beginPath(); g.ellipse(R * 0.95, 0, R * 0.16, R * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(R * 0.9, -R * 0.07, R * 0.05, 0, Math.PI * 2); g.fill();
    if (running) { g.fillStyle = "#ff6a8a"; g.beginPath(); g.ellipse(R * 0.7, R * 0.42, R * 0.2, R * 0.12, 0.5, 0, Math.PI * 2); g.fill(); }
    // eyes (blink now and then)
    const blink = ((now / 1000 + a.id * 0.77) % 3.6) < 0.12;
    for (const s of [-1, 1]) {
      const ex = R * 0.12, ey = s * R * 0.36;
      if (blink) { g.strokeStyle = "#1e1a22"; g.lineWidth = Math.max(1, R * 0.08); g.beginPath(); g.moveTo(ex - R * 0.12, ey); g.lineTo(ex + R * 0.12, ey); g.stroke(); continue; }
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, ey, R * 0.2, R * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1e1a22"; g.beginPath(); g.arc(ex + R * 0.05, ey, R * 0.13, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + R * 0.1, ey - R * 0.05, R * 0.045, 0, Math.PI * 2); g.fill();
    }
    g.restore();
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
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.fill(); }
