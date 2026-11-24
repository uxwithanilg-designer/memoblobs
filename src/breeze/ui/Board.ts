// The Bubble Breeze board, drawn in 2D on one canvas (light and fast on any phone). Glossy bubble sprites are
// painted once per colour and size; the world's scenery is painted once per stage into an offscreen canvas (sky,
// sun or moon, hills, islands, mountains, dunes, aurora… placed by the stage number so every stage looks a little
// different), softened and dimmed behind a board panel so the bubbles always stand out. On top: drifting clouds,
// falling leaves, snow or twinkling stars. Aim from the launcher (drag on touch, move on desktop): a dotted guide in
// the bubble's colour shows the whole flight, bounces included, and a ring marks where it will stick. Shots fly,
// bounce and stick with a squash and a ripple through their neighbours; groups pop into white puffs and droplets one
// after another, cut-off bubbles tumble and bounce away, ice cracks, bombs blast, crowns fly to the counter, and
// leftover shots go up as fireworks. Units are CSS px; grid units (bubble radius 1) are scaled by `s`.
import { BOMB, BOMB_SHOT, LAUNCH_Y, MAX_ROWS, RAINBOW, STONE, W, cx, cy, fly, isColour } from "../../sprout/grid";
import { rngFrom } from "../../sudoku/rng";
import type { Game, ShotResult } from "../play";
import type { World } from "../stage";

export type BoardSound = "bounce" | "stick" | "pop" | "blast" | "thaw" | "fall" | "crown" | "firework" | "swap" | "load" | "stone" | "crumble";
export interface BoardHooks {
  shoot: (angle: number) => void;
  swap: () => void;
  canAim: () => boolean;
  goal: () => { x: number; y: number };
  sound: (e: BoardSound, pan: number, n?: number) => void;
  float: (x: number, y: number, text: string, big?: boolean) => void;
}

export const BUBBLE_COLOURS = ["#ff3b4e", "#ffcc1f", "#2fa4ff", "#3bd14f", "#a64dff", "#ff8a1f"];
const MAX_ANGLE = 1.36;

interface Bub { k: number; crown: boolean; ice: boolean; r: number; c: number; ox: number; oy: number; vx: number; vy: number; born: number; sq: number; ph: number }
interface Dying { b: Bub; x: number; y: number; vx: number; vy: number; rot: number; spin: number; t0: number; kind: "pop" | "fall"; bounced?: boolean }
interface Flyer { k: number; crown?: boolean; x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; arc: number; scale: number; done: () => void; kind?: "crown"; path?: [number, number][]; cum?: number[]; passed?: number; onPass?: (i: number) => void; sq?: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; ring?: boolean }

export class BreezeBoard {
  private cv: HTMLCanvasElement; private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private W = 360; private H = 640; private dpr = 1; private s = 18; private ox = 0; private oy = 0;
  private game: Game | null = null;
  private bubs = new Map<number, Bub>();
  private dying: Dying[] = [];
  private flyers: Flyer[] = [];
  private parts: Part[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private cur: Bub | null = null; private nxt: Bub | null = null;
  private curHidden = false;
  private aim: { pts: [number, number][]; cell: [number, number] | null } | null = null;
  private busy = false; private down = false; private shake = 0;
  private shots = 0;
  private world: World | null = null; private stageN = 1;
  private ambient: { x: number; y: number; v: number; r: number; kind: number; ph: number }[] = [];
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
    this.cv.addEventListener("pointercancel", this.onCancel);
    this.cv.addEventListener("pointerleave", this.onLeave);
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
    const totalH = LAUNCH_Y + 2.6;
    this.s = Math.min((w - 16) / (W + 0.6), (h - 8) / totalH, 34);
    this.ox = (w - W * this.s) / 2;
    this.oy = Math.max(4, (h - totalH * this.s) / 2);
    this.sprites.clear();
    this.paintBackground();
    this.kick();
  }
  private px(x: number) { return this.ox + x * this.s; }
  private py(y: number) { return this.oy + y * this.s; }
  private pan(xUnits: number) { return Math.max(-1, Math.min(1, (xUnits / W) * 2 - 1)) * 0.8; }
  launcherScreen() { return { x: this.px(W / 2), y: this.py(LAUNCH_Y) }; }
  nextScreen() { return { x: this.px(W / 2 + 3.3), y: this.py(LAUNCH_Y + 0.8) }; }
  cellScreen(r: number, c: number) { return { x: this.px(cx(r, c)), y: this.py(cy(r)) }; }

  // ------------------------------------------------------------ sprites
  /** a glossy bubble (or special) painted once per kind and size */
  private sprite(k: number, crown = false, ice = false): HTMLCanvasElement {
    const key = `${k}:${crown ? 1 : 0}:${ice ? 1 : 0}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const R = this.s * this.dpr * 0.98, size = Math.ceil(R * 2 + 4);
    c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d")!, m = size / 2;
    if (k === STONE) {
      g.fillStyle = "#8f8a85"; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2, rr = R * (0.82 + ((i * 37) % 10) / 60); g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.ellipse(m - R * 0.25, m - R * 0.3, R * 0.4, R * 0.22, -0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(60,55,50,.6)"; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(m - R * 0.2, m - R * 0.1); g.lineTo(m + R * 0.1, m + R * 0.2); g.lineTo(m + R * 0.35, m + R * 0.05); g.stroke();
    } else if (k === BOMB || k === BOMB_SHOT) {
      const gr = g.createRadialGradient(m - R * 0.35, m - R * 0.35, R * 0.1, m, m, R);
      gr.addColorStop(0, "#6a6280"); gr.addColorStop(1, "#1c1828");
      g.fillStyle = gr; g.beginPath(); g.arc(m, m + R * 0.08, R * 0.9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#d9b37a"; g.lineWidth = R * 0.14; g.beginPath(); g.moveTo(m + R * 0.25, m - R * 0.7); g.quadraticCurveTo(m + R * 0.5, m - R * 1.0, m + R * 0.7, m - R * 0.85); g.stroke();
      g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.ellipse(m - R * 0.35, m - R * 0.3, R * 0.28, R * 0.16, -0.6, 0, Math.PI * 2); g.fill();
    } else {
      // the glossy candy bubble: a rich body, a darker rim, a bright top highlight and a small rim light
      const col = k === RAINBOW ? "#ffffff" : BUBBLE_COLOURS[(k - 1) % 6];
      const body = g.createRadialGradient(m - R * 0.3, m - R * 0.35, R * 0.05, m, m, R);
      if (k === RAINBOW) { BUBBLE_COLOURS.forEach((cc, i) => body.addColorStop(i / 5, cc)); }
      else { body.addColorStop(0, shade(col, 0.45)); body.addColorStop(0.55, col); body.addColorStop(1, shade(col, -0.45)); }
      g.fillStyle = body; g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = shade(col, -0.55); g.globalAlpha = 0.5; g.lineWidth = R * 0.06; g.beginPath(); g.arc(m, m, R * 0.97, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      const hl = g.createLinearGradient(m, m - R, m, m - R * 0.1);
      hl.addColorStop(0, "rgba(255,255,255,.95)"); hl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = hl; g.beginPath(); g.ellipse(m - R * 0.12, m - R * 0.48, R * 0.56, R * 0.34, -0.25, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(m + R * 0.45, m + R * 0.5, R * 0.16, R * 0.09, -0.8, 0, Math.PI * 2); g.fill();
      if (crown) {
        // a golden crown riding in the bubble
        g.save(); g.translate(m, m + R * 0.08); const cw = R * 0.62;
        g.fillStyle = "#ffd23f"; g.strokeStyle = "#a8620a"; g.lineWidth = R * 0.07;
        g.beginPath(); g.moveTo(-cw, cw * 0.45); g.lineTo(-cw, -cw * 0.35); g.lineTo(-cw * 0.5, cw * 0.05); g.lineTo(0, -cw * 0.6); g.lineTo(cw * 0.5, cw * 0.05); g.lineTo(cw, -cw * 0.35); g.lineTo(cw, cw * 0.45); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#fff6c0"; for (const x of [-cw, 0, cw]) { g.beginPath(); g.arc(x, x === 0 ? -cw * 0.62 : -cw * 0.38, cw * 0.14, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
    }
    if (ice) {
      g.fillStyle = "rgba(220,245,255,.32)"; g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = R * 0.08;
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(m + Math.cos(a) * R * 1.02, m + Math.sin(a) * R * 1.02); } g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = R * 0.04; g.beginPath(); g.moveTo(m - R * 0.4, m - R * 0.2); g.lineTo(m, m + R * 0.1); g.lineTo(m + R * 0.3, m - R * 0.3); g.stroke();
    }
    this.sprites.set(key, c);
    return c;
  }
  private drawBub(k: number, x: number, y: number, sc = 1, crown = false, ice = false, rot = 0, sx = 1, sy = 1, alpha = 1) {
    const sp = this.sprite(k, crown, ice), sz = sp.width / this.dpr;
    const g = this.g;
    g.save(); g.globalAlpha = alpha; g.translate(x, y); if (rot) g.rotate(rot); g.scale(sc * sx, sc * sy);
    g.drawImage(sp, -sz / 2, -sz / 2, sz, sz);
    g.restore();
  }

  // ------------------------------------------------------------ the world's scenery (painted once per stage)
  setWorld(stage: number, world: World) { this.stageN = stage; this.world = world; this.paintBackground(); this.kick(); }
  private paintBackground() {
    const wd = this.world; if (!wd) return;
    const w = this.W, h = this.H, d = this.dpr;
    const c = this.bg ?? document.createElement("canvas"); this.bg = c;
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    const g = c.getContext("2d")!; g.setTransform(d, 0, 0, d, 0, 0);
    const rng = rngFrom(`breeze-bg:${this.stageN}`);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, wd.sky[0]); sky.addColorStop(0.6, wd.sky[1]); sky.addColorStop(1, wd.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const night = wd.id === "night" || wd.id === "aurora";
    // sun or moon, somewhere new each stage
    const sx = w * (0.15 + rng.next() * 0.7), sy = h * (0.08 + rng.next() * 0.15), sr = Math.min(w, h) * (0.07 + rng.next() * 0.04);
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.5);
    sg.addColorStop(0, night ? "rgba(255,250,230,.9)" : "rgba(255,255,230,1)"); sg.addColorStop(0.3, night ? "rgba(255,250,230,.25)" : "rgba(255,240,180,.45)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.fillStyle = night ? "#fff8e6" : "#fffbe6"; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    if (night) { for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rng.next() * 0.7})`; const z = rng.next() < 0.1 ? 2 : 1; g.fillRect(rng.next() * w, rng.next() * h * 0.7, z, z); } }
    if (wd.id === "aurora") {
      for (let i = 0; i < 3; i++) {
        const ag = g.createLinearGradient(0, h * 0.1, 0, h * 0.5);
        ag.addColorStop(0, "rgba(95,255,200,0)"); ag.addColorStop(0.5, `rgba(${i ? 120 : 95},255,${i ? 230 : 200},.35)`); ag.addColorStop(1, "rgba(95,255,200,0)");
        g.fillStyle = ag; g.beginPath(); const y0 = h * (0.15 + i * 0.07);
        g.moveTo(0, y0); for (let x = 0; x <= w; x += 20) g.lineTo(x, y0 + Math.sin(x / (60 + i * 20) + rng.next() * 0.3 + i) * 30);
        g.lineTo(w, y0 + h * 0.3); g.lineTo(0, y0 + h * 0.3); g.fill();
      }
    }
    // far and near ranges: hills, mountains, dunes, waves — heights and bumps vary per stage
    const ranges = 2 + rng.int(2);
    for (let i = 0; i < ranges; i++) {
      const base = h * (0.62 + i * 0.1 + rng.next() * 0.05), amp = h * (0.04 + rng.next() * 0.08), k = 0.004 + rng.next() * 0.01, ph = rng.next() * 6;
      const col = mix(wd.sky[2], wd.accent, 0.25 + i * 0.22);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        let y: number;
        if (wd.id === "snow") y = base - Math.abs(((x * k * 60 + ph * 40) % 120) - 60) * amp / 60 * 1.6;
        else if (wd.id === "lagoon") y = base + Math.sin(x * k * 3 + ph) * amp * 0.25;
        else y = base - Math.sin(x * k + ph) * amp - Math.sin(x * k * 2.3 + ph * 2) * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
      if (wd.id === "snow") { g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(0, base - amp * 1.6, w, amp * 0.2); }
    }
    // scenery per world: trees, palms, lollipops, cacti, pines…
    const props = 3 + rng.int(4);
    for (let i = 0; i < props; i++) {
      const x = rng.next() * w, y = h * (0.72 + rng.next() * 0.18), sc = Math.min(w, h) * (0.05 + rng.next() * 0.05);
      g.save(); g.translate(x, y);
      if (wd.id === "sky" || wd.id === "autumn") { g.fillStyle = "#7a5a3a"; g.fillRect(-sc * 0.1, -sc * 1.2, sc * 0.2, sc * 1.2); g.fillStyle = wd.id === "autumn" ? ["#ff8a2a", "#e0541a", "#ffc23d"][i % 3] : "#5cc85a"; g.beginPath(); g.arc(0, -sc * 1.4, sc * 0.7, 0, Math.PI * 2); g.arc(-sc * 0.45, -sc * 1.1, sc * 0.5, 0, Math.PI * 2); g.arc(sc * 0.45, -sc * 1.1, sc * 0.5, 0, Math.PI * 2); g.fill(); }
      else if (wd.id === "candy") { g.strokeStyle = "#fff"; g.lineWidth = sc * 0.14; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -sc * 1.4); g.stroke(); g.fillStyle = ["#ff6fb5", "#9a6bff", "#3fd3ff"][i % 3]; g.beginPath(); g.arc(0, -sc * 1.7, sc * 0.55, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = sc * 0.1; g.beginPath(); g.arc(0, -sc * 1.7, sc * 0.3, 0, Math.PI * 1.5); g.stroke(); }
      else if (wd.id === "lagoon") { g.strokeStyle = "#8a6a3a"; g.lineWidth = sc * 0.16; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sc * 0.3, -sc, sc * 0.1, -sc * 1.8); g.stroke(); g.fillStyle = "#2fae6a"; for (let a = 0; a < 5; a++) { g.save(); g.translate(sc * 0.1, -sc * 1.8); g.rotate(-1.4 + a * 0.7); g.beginPath(); g.ellipse(sc * 0.5, 0, sc * 0.6, sc * 0.16, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }
      else if (wd.id === "snow" || wd.id === "aurora") { g.fillStyle = wd.id === "snow" ? "#3f7a6a" : "#123a3a"; for (let k2 = 0; k2 < 3; k2++) { g.beginPath(); g.moveTo(-sc * (0.7 - k2 * 0.15), -sc * k2 * 0.55); g.lineTo(0, -sc * (0.9 + k2 * 0.55)); g.lineTo(sc * (0.7 - k2 * 0.15), -sc * k2 * 0.55); g.fill(); } if (wd.id === "snow") { g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.moveTo(-sc * 0.25, -sc * 1.6); g.lineTo(0, -sc * 2.0); g.lineTo(sc * 0.25, -sc * 1.6); g.fill(); } }
      else if (wd.id === "dusk") { g.fillStyle = "#4a7a3a"; g.beginPath(); g.roundRect(-sc * 0.18, -sc * 1.6, sc * 0.36, sc * 1.6, sc * 0.18); g.roundRect(-sc * 0.65, -sc * 1.1, sc * 0.24, sc * 0.6, sc * 0.12); g.roundRect(sc * 0.4, -sc * 1.3, sc * 0.24, sc * 0.6, sc * 0.12); g.fill(); }
      else { g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.arc(0, -sc, sc * 0.8, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    // soften the scenery and dim it, then a calm panel behind the board so the bubbles stay the brightest thing
    g.fillStyle = night ? "rgba(10,10,30,.35)" : hexA(wd.sky[1], 0.35); g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(10,10,40,.12)"; g.fillRect(0, 0, w, h);
    const bx = this.px(0) - this.s * 0.3, bw = W * this.s + this.s * 0.6, by = this.py(0) - this.s * 0.2, bh = this.py(LAUNCH_Y + 1.9) - by;
    g.fillStyle = night ? "rgba(8,10,30,.42)" : "rgba(30,40,80,.18)";
    g.beginPath(); g.roundRect(bx, by, bw, bh, this.s * 0.8); g.fill();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.stroke();
    // the cloud ribbon along the ceiling
    g.fillStyle = "rgba(255,255,255,.92)";
    for (let x = bx; x <= bx + bw; x += this.s * 1.1) { g.beginPath(); g.arc(x, by + this.s * 0.05, this.s * (0.55 + ((x * 7) % 5) / 25), 0, Math.PI * 2); g.fill(); }
    g.fillRect(bx, by - this.s * 0.6, bw, this.s * 0.65);
    // the danger line
    g.strokeStyle = "rgba(255,255,255,.3)"; g.setLineDash([this.s * 0.4, this.s * 0.4]); g.lineWidth = 2;
    const dy = this.py(cy(MAX_ROWS) - 1.05); g.beginPath(); g.moveTo(bx + 6, dy); g.lineTo(bx + bw - 6, dy); g.stroke(); g.setLineDash([]);
    // ambient movers for this world
    this.ambient = [];
    const nA = wd.id === "snow" ? 40 : wd.id === "night" || wd.id === "aurora" ? 18 : wd.id === "autumn" ? 16 : 5;
    for (let i = 0; i < nA; i++) this.ambient.push({ x: rng.next() * w, y: rng.next() * h, v: 0.3 + rng.next() * 0.7, r: 2 + rng.next() * 3, kind: i, ph: rng.next() * 6 });
  }

  // ------------------------------------------------------------ state
  private newBub(k: number, crown = false, ice = false): Bub { return { k, crown, ice, r: -1, c: -1, ox: 0, oy: 0, vx: 0, vy: 0, born: performance.now(), sq: 0, ph: Math.random() * 6 }; }
  setStage(game: Game) {
    this.bubs.clear(); this.dying = []; this.flyers = [];
    this.game = game;
    const now = performance.now();
    game.grid.forEach((row, r) => row.forEach((x, c) => {
      if (!x) return;
      const b = this.newBub(x.k, !!x.sprout, !!x.ice); b.r = r; b.c = c; b.born = now + r * 40 + Math.abs(c - 4) * 25;
      this.bubs.set(r * 16 + c, b);
    }));
    this.cur = null; this.nxt = null;
    this.loadLauncher(game, true);
    this.busy = false; this.curHidden = false;
    this.kick();
  }
  sync(game: Game) {
    this.game = game;
    const want = new Set<number>();
    game.grid.forEach((row, r) => row.forEach((x, c) => {
      if (!x) return;
      const id = r * 16 + c; want.add(id);
      const b = this.bubs.get(id);
      if (b && b.k === x.k && b.crown === !!x.sprout) { b.ice = !!x.ice; return; }
      const nb = this.newBub(x.k, !!x.sprout, !!x.ice); nb.r = r; nb.c = c; this.bubs.set(id, nb);
    }));
    for (const id of [...this.bubs.keys()]) if (!want.has(id)) this.bubs.delete(id);
    this.loadLauncher(game, false);
    this.kick();
  }
  private loadLauncher(game: Game, fresh: boolean) {
    const now = performance.now();
    if (!this.cur || this.cur.k !== game.cur) { this.cur = this.newBub(game.cur); this.cur.born = now + (fresh ? 450 : 0); }
    if (!this.nxt || this.nxt.k !== game.nxt) { this.nxt = this.newBub(game.nxt); this.nxt.born = now + (fresh ? 600 : 100); }
  }
  setShots(n: number) { this.shots = n; this.kick(); }
  swap(game: Game) {
    this.game = game;
    const a = this.cur, b = this.nxt; if (!a || !b) { this.loadLauncher(game, false); return; }
    const L = this.launcherScreen(), N = this.nextScreen();
    this.curHidden = true;
    const ka = a.k, kb = b.k;
    this.cur = b; this.nxt = a;
    this.flyers.push({ k: kb, x0: N.x, y0: N.y, x1: L.x, y1: L.y, t0: performance.now(), dur: 200, arc: -this.s, scale: 1, done: () => { this.curHidden = false; } });
    this.flyers.push({ k: ka, x0: L.x, y0: L.y, x1: N.x, y1: N.y, t0: performance.now(), dur: 200, arc: this.s, scale: 0.72, done: () => {} });
    this.nxt.born = performance.now() + 200;
    this.kick();
  }

  // ------------------------------------------------------------ aiming
  private pointer(e: PointerEvent) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private angleAt(e: PointerEvent): number | null {
    const p = this.pointer(e), l = this.launcherScreen();
    if (p.y > l.y - this.s * 0.9) return null;
    return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(p.x - l.x, l.y - p.y)));
  }
  private onLauncher(e: PointerEvent) {
    const p = this.pointer(e), l = this.launcherScreen(), n = this.nextScreen();
    return Math.hypot(p.x - l.x, p.y - l.y) < this.s * 1.4 || Math.hypot(p.x - n.x, p.y - n.y) < this.s * 1.4;
  }
  private onDown = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canAim()) return;
    if (this.onLauncher(e)) { this.hooks.swap(); return; }
    this.down = true; this.cv.setPointerCapture?.(e.pointerId);
    this.setAim(this.angleAt(e));
  };
  private onMove = (e: PointerEvent) => {
    if (this.busy || !this.hooks.canAim()) { if (this.aim) this.setAim(null); return; }
    if (this.down || e.pointerType === "mouse") this.setAim(this.angleAt(e));
  };
  private onUp = (e: PointerEvent) => {
    const was = this.down; this.down = false;
    if (this.busy || !this.hooks.canAim()) return;
    if (!was && e.pointerType !== "mouse") return;
    const a = this.angleAt(e);
    this.setAim(null);
    if (a !== null) this.hooks.shoot(a);
  };
  private onCancel = () => { this.down = false; this.setAim(null); };
  private onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") this.setAim(null); };
  private setAim(a: number | null) {
    if (a === null || !this.game) { this.aim = null; this.kick(); return; }
    const f = fly(this.game.grid, a);
    this.aim = { pts: f.path, cell: f.cell };
    this.kick();
  }

  // ------------------------------------------------------------ a shot
  private wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
  private flyTo(k: number, x0: number, y0: number, x1: number, y1: number, dur: number, opts: Partial<Flyer> = {}) {
    return new Promise<void>((done) => { this.flyers.push({ k, x0, y0, x1, y1, t0: performance.now(), dur, arc: 0, scale: 1, done, ...opts }); this.kick(); });
  }
  async play(res: ShotResult, game: Game): Promise<void> {
    this.busy = true; this.aim = null; this.curHidden = true;
    const k0 = res.k;
    const pts = res.flight.path.map(([x, y]) => [this.px(x), this.py(y)] as [number, number]);
    const speed = this.s * 75;
    // one continuous flight along the whole path at a steady speed: the bubble glances off the walls without stopping
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const last = pts[pts.length - 1];
    const fl: Flyer = { k: k0, x0: pts[0][0], y0: pts[0][1], x1: last[0], y1: last[1], t0: performance.now(), dur: Math.max(60, (cum[cum.length - 1] / speed) * 1000), arc: 0, scale: 1, done: () => {}, path: pts, cum, passed: 1, sq: 0,
      onPass: (i) => { if (i >= pts.length - 1) return; this.hooks.sound("bounce", this.pan(res.flight.path[i][0])); this.burst(pts[i][0], pts[i][1], "#ffffff", 7, 0.6); fl.sq = 1; } };
    await new Promise<void>((done) => { fl.done = done; this.flyers.push(fl); this.kick(); });
    const out = res.out;
    if (!res.flight.cell || !out) { this.curHidden = false; this.sync(game); this.busy = false; return; }
    const [r, c] = res.flight.cell;
    const at = this.cellScreen(r, c);
    let k = k0;
    if (k === RAINBOW) { k = game.grid[r]?.[c]?.k ?? out.popped.map(([a, q]) => this.bubs.get(a * 16 + q)?.k).find((x) => x !== undefined && isColour(x)) ?? 1; this.burst(at.x, at.y, "#ffffff", 16, 1); }
    const hit = this.newBub(k); hit.r = r; hit.c = c; hit.born = 0; hit.sq = 1;
    this.bubs.set(r * 16 + c, hit);
    for (const o of this.bubs.values()) {
      if (o === hit) continue;
      const p = this.cellScreen(o.r, o.c), dx = p.x - at.x, dy = p.y - at.y, d = Math.hypot(dx, dy) / this.s;
      if (d > 4.2 || d === 0) continue;
      o.vx += (dx / (d * this.s)) * (4.6 - d) * this.s * 1.4; o.vy += (dy / (d * this.s)) * (4.6 - d) * this.s * 1.4;
    }
    this.hooks.sound(k0 === BOMB_SHOT ? "blast" : "stick", this.pan(cx(r, c)));
    await this.wait(90);
    // pops, nearest first: a white puff ring and droplets
    const dist = (p: [number, number]) => Math.hypot(cx(p[0], p[1]) - cx(r, c), cy(p[0]) - cy(r));
    const popped = out.popped.slice().sort((p, q) => dist(p) - dist(q));
    const crowned = new Set(out.freed.map(([a, q]) => a * 16 + q));
    const crownAt: { x: number; y: number }[] = [];
    let pi = 0;
    for (const [a, q] of popped) {
      const id = a * 16 + q, pb = this.bubs.get(id);
      if (!pb) continue;
      this.bubs.delete(id);
      const p = this.cellScreen(a, q);
      if (crowned.has(id)) crownAt.push(p);
      const n = pi++;
      setTimeout(() => {
        this.dying.push({ b: pb, x: p.x + pb.ox, y: p.y + pb.oy, vx: 0, vy: 0, rot: 0, spin: 0, t0: performance.now(), kind: "pop" });
        const col = pb.k === STONE ? "#b8b2aa" : pb.k === BOMB || pb.k === BOMB_SHOT ? "#ff8a3a" : isColour(pb.k) ? BUBBLE_COLOURS[(pb.k - 1) % 6] : "#ffffff";
        this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.35, max: 0.35, col: "#ffffff", size: this.s * 1.1, ring: true });
        this.burst(p.x, p.y, col, pb.k === BOMB ? 28 : 10, pb.k === BOMB ? 1.8 : 1);
        this.hooks.sound(pb.k === BOMB ? "blast" : pb.k === STONE ? "stone" : "pop", this.pan(cx(a, q)), n);
        this.kick();
      }, n * 38);
    }
    for (const [a, q] of out.thawed) { const tb = this.bubs.get(a * 16 + q); if (tb) { const p = this.cellScreen(a, q); setTimeout(() => { tb.ice = false; this.burst(p.x, p.y, "#d8f4ff", 10, 1); }, 120 + pi * 38); } }
    if (out.thawed.length) setTimeout(() => this.hooks.sound("thaw", this.pan(cx(out.thawed[0][0], out.thawed[0][1]))), 140 + pi * 38);
    if (out.popped.length && res.gained) setTimeout(() => this.hooks.float(at.x, at.y - this.s, `+${res.gained}`, res.gained >= 300), 120 + pi * 38);
    await this.wait(60 + pi * 38);
    // cut-off bubbles tumble down
    if (out.fallen.length) {
      for (const [a, q] of out.fallen) {
        const id = a * 16 + q, fb = this.bubs.get(id); if (!fb) continue;
        this.bubs.delete(id);
        const p = this.cellScreen(a, q);
        if (crowned.has(id)) crownAt.push(p);
        this.dying.push({ b: fb, x: p.x + fb.ox, y: p.y + fb.oy, vx: (Math.random() - 0.5) * this.s * 8, vy: -this.s * (3 + Math.random() * 5), rot: 0, spin: (Math.random() - 0.5) * 8, t0: performance.now() + Math.random() * 60, kind: "fall" });
      }
      this.hooks.sound("fall", this.pan(cx(out.fallen[0][0], out.fallen[0][1])), out.fallen.length);
    }
    // crowns fly to the counter
    const goal = this.hooks.goal();
    crownAt.forEach((p, i) => setTimeout(() => { void this.flyTo(0, p.x, p.y, goal.x, goal.y, 720, { kind: "crown", arc: -this.s * 4, scale: 1.4 }).then(() => { this.burst(goal.x, goal.y, "#ffd23f", 14, 1); this.hooks.sound("crown", 0, i + 1); }); }, 120 + i * 110));
    this.kick();
    await this.wait(Math.max(140, crownAt.length ? 860 + crownAt.length * 110 : 0));
    this.game = game;
    this.cur = null;
    this.loadLauncher(game, false);
    this.curHidden = false;
    this.hooks.sound("load", 0);
    await this.wait(160);
    this.sync(game);
    this.busy = false;
    this.kick();
  }

  /** the board is clear: remaining stones crack and tumble */
  crumble() {
    let i = 0;
    for (const [id, b] of [...this.bubs]) {
      if (b.k !== STONE) continue;
      this.bubs.delete(id);
      const p = this.cellScreen(b.r, b.c), d = i++ * 70;
      setTimeout(() => { this.burst(p.x, p.y, "#b8ada0", 10, 1); this.dying.push({ b, x: p.x, y: p.y, vx: (Math.random() - 0.5) * this.s * 6, vy: -this.s * 4, rot: 0, spin: 4, t0: performance.now(), kind: "fall" }); this.hooks.sound("crumble", this.pan(cx(b.r, b.c))); this.kick(); }, d);
    }
    return i * 70 + 300;
  }
  /** leftover shots go up as fireworks */
  async celebrate(n: number, onEach?: (i: number) => void) {
    this.busy = true; this.curHidden = true;
    const L = this.launcherScreen();
    for (let i = 0; i < Math.min(n, 15); i++) {
      const k = 1 + (i % 6), tx = this.px(2 + Math.random() * (W - 4)), ty = this.py(2 + Math.random() * 9);
      void this.flyTo(k, L.x, L.y, tx, ty, 420, { scale: 0.7 }).then(() => {
        this.burst(tx, ty, BUBBLE_COLOURS[(k - 1) % 6], 32, 2.2); this.burst(tx, ty, "#ffffff", 10, 1.4);
        this.hooks.sound("firework", this.pan((tx - this.ox) / this.s), i); onEach?.(i);
      });
      await this.wait(170);
    }
    await this.wait(500);
  }
  jolt() { this.shake = performance.now(); this.kick(); }

  private burst(x: number, y: number, col: string, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = this.s * (4 + Math.random() * 7) * power;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.s * 3, life: 0.5 + Math.random() * 0.4, max: 0.9, col, size: this.s * (0.12 + Math.random() * 0.14) });
    }
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    this.kick();
  }

  // ------------------------------------------------------------ loop
  kick = () => { if (!this.raf && !this.disposed && this.visible && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } };
  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = now / 1000, s = this.s, g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let shx = 0;
    if (this.shake) { const k = (now - this.shake) / 500; if (k >= 1) this.shake = 0; else shx = Math.sin(k * 40) * s * 0.4 * (1 - k); }
    // scenery + ambient movers
    if (this.bg) g.drawImage(this.bg, 0, 0, this.W, this.H); else { g.fillStyle = "#bfe6ff"; g.fillRect(0, 0, this.W, this.H); }
    const wid = this.world?.id ?? "sky";
    for (const a of this.ambient) {
      if (wid === "snow") { a.y += a.v * 30 * dt; a.x += Math.sin(t + a.ph) * 10 * dt; if (a.y > this.H) a.y = -5; g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(a.x, a.y, a.r * 0.8, 0, Math.PI * 2); g.fill(); }
      else if (wid === "night" || wid === "aurora") { const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * a.v * 2 + a.ph)); g.fillStyle = `rgba(255,255,240,${tw})`; g.fillRect(a.x, a.y * 0.6, a.r * 0.7, a.r * 0.7); }
      else if (wid === "autumn") { a.y += a.v * 26 * dt; a.x += Math.sin(t * 1.5 + a.ph) * 22 * dt; if (a.y > this.H) a.y = -10; g.save(); g.translate(a.x, a.y); g.rotate(t * a.v * 2 + a.ph); g.fillStyle = ["rgba(255,138,42,.75)", "rgba(224,84,26,.7)", "rgba(255,194,61,.75)"][a.kind % 3]; g.beginPath(); g.ellipse(0, 0, a.r * 2, a.r, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      else { a.x += a.v * 12 * dt; if (a.x > this.W + 80) a.x = -80; const cw = 30 + a.r * 10; g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(a.x, a.y * 0.5, cw * 0.35, 0, Math.PI * 2); g.arc(a.x + cw * 0.35, a.y * 0.5 + 4, cw * 0.28, 0, Math.PI * 2); g.arc(a.x - cw * 0.35, a.y * 0.5 + 6, cw * 0.24, 0, Math.PI * 2); g.fill(); }
    }
    g.save(); g.translate(shx, 0);
    // aim guide: dots in the bubble colour, then a ring where it will stick
    if (this.aim && this.game) {
      const col = isColour(this.game.cur) ? BUBBLE_COLOURS[(this.game.cur - 1) % 6] : this.game.cur === BOMB_SHOT ? "#ff7a3a" : "#ffffff";
      g.fillStyle = col; g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1.5;
      let carry = 0.6, n = 0;
      const step = 0.8, off = (t * 2.5) % step;
      for (let i = 1; i < this.aim.pts.length; i++) {
        const [x0, y0] = this.aim.pts[i - 1], [x1, y1] = this.aim.pts[i], len = Math.hypot(x1 - x0, y1 - y0);
        for (let d = carry + off; d < len; d += step) {
          const q = d / len, x = this.px(x0 + (x1 - x0) * q), y = this.py(y0 + (y1 - y0) * q);
          g.beginPath(); g.arc(x, y, s * Math.max(0.1, 0.2 - n * 0.002), 0, Math.PI * 2); g.fill(); g.stroke(); n++;
          carry = d + step - len - off;
        }
      }
      if (this.aim.cell) { const p = this.cellScreen(this.aim.cell[0], this.aim.cell[1]); g.strokeStyle = col; g.lineWidth = 3; g.setLineDash([5, 4]); g.beginPath(); g.arc(p.x, p.y, s * 0.92, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    }
    // the board
    for (const b of this.bubs.values()) {
      b.vx -= b.ox * 170 * dt; b.vy -= b.oy * 170 * dt; b.vx *= Math.max(0, 1 - 9 * dt); b.vy *= Math.max(0, 1 - 9 * dt);
      b.ox += b.vx * dt; b.oy += b.vy * dt;
      const lim = s * 0.6, l = Math.hypot(b.ox, b.oy); if (l > lim) { b.ox *= lim / l; b.oy *= lim / l; }
      const k = Math.min(1, Math.max(0, (now - b.born) / 380)); if (k <= 0) continue;
      const pop = k < 1 ? easeBack(k) : 1;
      let sx = 1, sy = 1; if (b.sq > 0) { b.sq = Math.max(0, b.sq - dt * 5); sx = 1 + b.sq * 0.18; sy = 1 - b.sq * 0.16; }
      const p = this.cellScreen(b.r, b.c);
      this.drawBub(b.k, p.x + b.ox, p.y + b.oy - (k < 1 ? (1 - k) * s * 1.2 : 0), pop * (1 + Math.sin(t * 2 + b.ph) * 0.01), b.crown, b.ice, 0, sx, sy);
      if (b.k === BOMB) { g.fillStyle = `rgba(255,${200 + Math.random() * 55},80,${0.6 + Math.random() * 0.4})`; g.beginPath(); g.arc(p.x + b.ox + s * 0.7, p.y + b.oy - s * 0.86, s * (0.12 + Math.random() * 0.1), 0, Math.PI * 2); g.fill(); }
    }
    // the launcher: a ring, the shot, the next bubble with a swap arrow, the shots counter
    const L = this.launcherScreen(), N = this.nextScreen();
    g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(L.x, L.y, s * 1.45, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = Math.max(2, s * 0.12); g.beginPath(); g.arc(L.x, L.y, s * 1.3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = this.world?.accent ?? "#2f8fe0"; g.lineWidth = Math.max(2, s * 0.1); g.beginPath(); g.arc(L.x, L.y, s * 1.3, t * 1.5, t * 1.5 + 1.2); g.stroke();
    if (this.cur && !this.curHidden) { const k = Math.min(1, Math.max(0, (now - this.cur.born) / 300)); if (k > 0) this.drawBub(this.cur.k, L.x, L.y, k < 1 ? easeBack(k) : 1 + Math.sin(t * 3) * 0.02); }
    if (this.nxt && !this.flyers.some((f) => f.scale === 0.72)) { const k = Math.min(1, Math.max(0, (now - this.nxt.born) / 300)); if (k > 0) this.drawBub(this.nxt.k, N.x, N.y, 0.72 * (k < 1 ? easeBack(k) : 1)); }
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(2, s * 0.09); g.beginPath(); g.arc(N.x, N.y, s * 0.95, -2.4, -0.9); g.stroke();
    g.fillStyle = "rgba(255,255,255,.85)"; const ax = N.x + Math.cos(-0.9) * s * 0.95, ay = N.y + Math.sin(-0.9) * s * 0.95; g.beginPath(); g.moveTo(ax + s * 0.25, ay - s * 0.05); g.lineTo(ax - s * 0.12, ay - s * 0.25); g.lineTo(ax - s * 0.02, ay + s * 0.2); g.fill();
    const sh = { x: this.px(W / 2 - 3.6), y: this.py(LAUNCH_Y + 0.6) };
    g.fillStyle = "rgba(20,30,60,.65)"; g.beginPath(); g.roundRect(sh.x - s * 1.15, sh.y - s * 0.6, s * 2.3, s * 1.2, s * 0.4); g.fill();
    g.fillStyle = this.shots <= 3 ? "#ff6b6b" : "#ffffff"; g.font = `bold ${Math.round(s * 0.85)}px 'Lilita One', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(this.shots), sh.x, sh.y + 1);
    // flyers
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i], k = Math.min(1, Math.max(0, (now - f.t0) / f.dur)), e = f.kind === "crown" ? easeInOut(k) : k;
      let x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e + Math.sin(k * Math.PI) * f.arc;
      if (f.path && f.cum) {
        const total = f.cum[f.cum.length - 1], d = total * k;
        while (f.passed! < f.cum.length - 1 && d >= f.cum[f.passed!]) { f.onPass?.(f.passed!); f.passed!++; }
        let j = 1; while (j < f.cum.length - 1 && d > f.cum[j]) j++;
        const q = (d - f.cum[j - 1]) / (f.cum[j] - f.cum[j - 1] || 1);
        x = f.path[j - 1][0] + (f.path[j][0] - f.path[j - 1][0]) * q; y = f.path[j - 1][1] + (f.path[j][1] - f.path[j - 1][1]) * q;
      }
      if (f.path) { const sq = f.sq ?? 0; f.sq = Math.max(0, sq - dt * 7); this.drawBub(f.k, x, y, f.scale, false, false, 0, 1 - sq * 0.16, 1 + sq * 0.12); }
      else if (f.kind === "crown") { g.save(); g.translate(x, y); g.rotate(Math.sin(k * 10) * 0.2); const sc = s * 0.6 * f.scale * (1 + Math.sin(k * Math.PI) * 0.5); crownIcon(g, sc); g.restore(); }
      else this.drawBub(f.k, x, y, f.scale);
      if (k >= 1) { this.flyers.splice(i, 1); f.done(); }
    }
    // dying bubbles
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i], age = (now - d.t0) / 1000;
      if (age < 0) { this.drawBub(d.b.k, d.x, d.y, 1, d.b.crown, d.b.ice); continue; }
      if (d.kind === "pop") { const k = Math.min(1, age / 0.14); this.drawBub(d.b.k, d.x, d.y, 1 + k * 0.35, d.b.crown, false, 0, 1, 1, 1 - k); if (k >= 1) this.dying.splice(i, 1); continue; }
      d.vy += s * 60 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.spin * dt;
      const floor = this.py(LAUNCH_Y + 1.6);
      if (d.y > floor && d.vy > 0 && !d.bounced) { d.bounced = true; d.vy = -d.vy * 0.4; this.burst(d.x, d.y, isColour(d.b.k) ? BUBBLE_COLOURS[(d.b.k - 1) % 6] : "#ffffff", 6, 0.7); }
      this.drawBub(d.b.k, d.x, d.y, 1, d.b.crown, d.b.ice, d.rot, 1, 1, Math.max(0, 1 - age / 2));
      if (d.y > this.H + s * 2 || age > 2) this.dying.splice(i, 1);
    }
    // particles: droplets and puff rings
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const a = p.life / p.max;
      if (p.ring) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = s * 0.25 * a; g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2); g.stroke(); continue; }
      p.vy += s * 26 * dt; p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, a * 1.6); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // the danger line glows when bubbles get close
    let low = -1; for (const b of this.bubs.values()) low = Math.max(low, b.r);
    if (low >= MAX_ROWS - 3) { const dy = this.py(cy(MAX_ROWS) - 1.05); g.strokeStyle = `rgba(255,70,90,${0.5 + Math.sin(t * 8) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.moveTo(this.px(0), dy); g.lineTo(this.px(W), dy); g.stroke(); }
    g.restore();
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro.disconnect(); this.io.disconnect(); document.removeEventListener("visibilitychange", this.kick);
    this.cv.removeEventListener("pointerdown", this.onDown); this.cv.removeEventListener("pointermove", this.onMove);
    this.cv.removeEventListener("pointerup", this.onUp); this.cv.removeEventListener("pointercancel", this.onCancel); this.cv.removeEventListener("pointerleave", this.onLeave);
    this.sprites.clear(); this.cv.remove();
  }
}

const easeBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h: string, k: number) { const [r, g, b] = hexToRgb(h); const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function mix(a: string, b: string, k: number) { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; }
function hexA(h: string, a: number) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function crownIcon(g: CanvasRenderingContext2D, cw: number) {
  g.fillStyle = "#ffd23f"; g.strokeStyle = "#a8620a"; g.lineWidth = cw * 0.12;
  g.beginPath(); g.moveTo(-cw, cw * 0.45); g.lineTo(-cw, -cw * 0.35); g.lineTo(-cw * 0.5, cw * 0.05); g.lineTo(0, -cw * 0.6); g.lineTo(cw * 0.5, cw * 0.05); g.lineTo(cw, -cw * 0.35); g.lineTo(cw, cw * 0.45); g.closePath(); g.fill(); g.stroke();
}
