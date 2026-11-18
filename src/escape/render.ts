// Momo Escape renderer — Canvas 2D in a risograph-print style: warm paper with grain, walls printed in the building's
// main ink over a misregistered halftone shadow in a second ink, hazards in a hot fluoro ink, stamp lettering. Rooms are
// printed once to off-screen canvases; hazards, pickups, Momo and particles are drawn live every frame.
import { buildingOf, type Building } from "./data/buildings";
import { crushK, crushSoon, floodY, laserOn, laserSeg, laserSoon, moverPos, pulseState, shots, spikeRect, spikesOn, spikesSoon, turretCharge } from "./hazards";
import type { EscapeSim } from "./sim";
import { COLS, DX, DY, opp, U, type Dir, type Hazard, type Pickup, type Room } from "./types";

const TAU = Math.PI * 2;
const FONT = "'Lilita One', ui-rounded, system-ui, sans-serif";

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 0 | 1 | 2; rot: number; vr: number }

function noiseCanvas(size: number, alpha: number) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.random();
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v < 0.5 ? 0 : 255;
    img.data[i * 4 + 3] = Math.floor(Math.random() * alpha * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
function halftone(color: string, step: number, r: number) {
  const c = document.createElement("canvas"); c.width = c.height = step * 2;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  for (const [x, y] of [[0, 0], [step, step], [step * 2, 0], [0, step * 2], [step * 2, step * 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  return c;
}

export interface FrameFx {
  /** rush/booster strength (speed − 1) */
  speed: number;
  boost: boolean;
  beat: number;
  shakeOn: boolean;
  reduced: boolean;
  ch: { color: string; id: string };
}

export class EscapeRenderer {
  readonly cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private w = 1; private h = 1; private dpr = 1; private cs = 30; private k = 3;
  private ox = 0;
  private camY = 0; private camInit = false;
  private shake = 0;
  private time = 0;
  private cache = new Map<number, { c: HTMLCanvasElement; cs: number }>();
  private grain: HTMLCanvasElement;
  private grainPat: CanvasPattern | null = null;
  private parts: Part[] = [];
  private trail: { x: number; y: number; a: number }[] = [];
  private squash = 0;
  private lastG: Dir = 2;
  private flash = 0;
  private flashColor = "#fff";
  private bld: Building = buildingOf(1);
  private bldT = 0;
  private stampT = 0;
  private stampText = "";
  private memoryT = new Map<number, number>();
  /** draw positions of Momo (smoothed between ticks) */
  private rx = 0; private ry = 0;

  constructor(host: HTMLElement) {
    this.cv = document.createElement("canvas");
    Object.assign(this.cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });
    this.cv.setAttribute("aria-label", "Momo Escape game");
    host.appendChild(this.cv);
    this.g = this.cv.getContext("2d", { alpha: false })!;
    this.grain = noiseCanvas(160, 0.09);
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    const portrait = this.h >= this.w;
    const cs = portrait ? this.w / 13.4 : Math.min(this.w / 13.4, this.h / 12.5);
    if (Math.abs(cs - this.cs) > 0.01) { this.cs = cs; this.cache.clear(); }
    this.k = this.cs / U;
    this.ox = (this.w - COLS * this.cs) / 2;
    this.grainPat = this.g.createPattern(this.grain, "repeat");
  }

  // ---------------------------------------------------------------- effects API
  stamp(text: string) { this.stampText = text; this.stampT = 2.4; }
  hit(x: number, y: number, hot: string) {
    this.shake = Math.max(this.shake, 1);
    this.flash = 0.35; this.flashColor = hot;
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = 0.6 + Math.random() * 2.2; this.part(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.7 + Math.random() * 0.5, 2 + Math.random() * 3.5, i % 3 ? hot : this.bld.inks.shade, 1); }
  }
  dust(x: number, y: number, g: Dir, n = 6) {
    const nx = -DX[g], ny = -DY[g];
    for (let i = 0; i < n; i++) { const a = (Math.random() - 0.5) * 2.4; this.part(x + DX[g] * 4, y + DY[g] * 4, (nx + Math.cos(a) * 0.8) * (0.3 + Math.random() * 0.6), (ny + Math.sin(a) * 0.8) * (0.3 + Math.random() * 0.6), 0.35 + Math.random() * 0.25, 1.2 + Math.random() * 1.6, "rgba(120,110,130,0.55)", 0); }
  }
  sparkle(x: number, y: number, color: string, n = 10, conf = false) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 0.4 + Math.random() * 1.6; this.part(x, y, Math.cos(a) * s, Math.sin(a) * s + 0.4, 0.5 + Math.random() * 0.5, conf ? 1.6 + Math.random() * 1.6 : 1 + Math.random() * 1.5, color, conf ? 2 : 0); }
  }
  land() { this.squash = 1; }
  leap() { this.squash = -1; }
  /** Momo tried to dash into a wall */
  nudge() { this.squash = 0.6; }
  /** where Momo was last drawn, in CSS pixels of the canvas (tap-to-move aims from here) */
  momoAt() { return this.momoPt; }
  private momoPt: { x: number; y: number } | null = null;
  private part(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, kind: 0 | 1 | 2) {
    if (this.parts.length > 260) this.parts.shift();
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, kind, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 });
  }

  // ---------------------------------------------------------------- room prints
  private printRoom(room: Room, B: Building) {
    const cs = this.cs, dpr = this.dpr;
    const c = document.createElement("canvas");
    c.width = Math.ceil(COLS * cs * dpr); c.height = Math.ceil(room.h * cs * dpr);
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const H = room.h * cs;
    const wallAt = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < room.h && room.cells[y * COLS + x] === 1;
    const cellRect = (x: number, y: number, ox = 0, oy = 0) => g.rect(x * cs + ox - 0.3, H - (y + 1) * cs + oy - 0.3, cs + 0.6, cs + 0.6);
    // 1 · misregistered halftone shadow (second ink)
    const ht = halftone(B.inks.shade, Math.max(3, cs * 0.16), Math.max(1, cs * 0.07));
    const pat = g.createPattern(ht, "repeat")!;
    g.save();
    g.beginPath();
    for (let y = 0; y < room.h; y++) for (let x = 0; x < COLS; x++) if (wallAt(x, y)) cellRect(x, y, cs * 0.16, cs * 0.16);
    g.fillStyle = B.inks.shade; g.globalAlpha = 0.55; g.fill();
    g.globalAlpha = 1; g.fillStyle = pat; g.fill();
    g.restore();
    // 2 · walls (main ink), fake walls a touch lighter
    g.beginPath();
    for (let y = 0; y < room.h; y++) for (let x = 0; x < COLS; x++) if (wallAt(x, y) && !room.fake[y * COLS + x]) cellRect(x, y);
    g.fillStyle = B.inks.wall; g.fill();
    g.beginPath();
    for (let y = 0; y < room.h; y++) for (let x = 0; x < COLS; x++) if (room.fake[y * COLS + x]) cellRect(x, y);
    g.globalAlpha = 0.86; g.fill(); g.globalAlpha = 1;
    // ink grain on the walls
    g.save();
    g.beginPath();
    for (let y = 0; y < room.h; y++) for (let x = 0; x < COLS; x++) if (wallAt(x, y)) cellRect(x, y);
    g.clip();
    g.globalAlpha = 0.5; g.fillStyle = g.createPattern(this.grain, "repeat")!; g.fillRect(0, 0, COLS * cs, H);
    g.restore();
    // 3 · special faces
    for (const f of room.faces) {
      const [x, y, w, h] = spikeRect(f.cx, f.cy, f.n, 2.2);
      const px = x * this.k, py = H - (y + h) * this.k, pw = w * this.k, ph = h * this.k;
      const col = f.k === "ice" ? "#7fd8ff" : f.k === "honey" ? "#ffc53d" : f.k === "speed" ? "#3dffa8" : f.k === "bounce" ? "#ff8a3d" : "#b0b8ff";
      g.fillStyle = col; g.fillRect(px, py, pw, ph);
      if (f.k === "bounce") { g.strokeStyle = B.inks.wall; g.lineWidth = Math.max(1, cs * 0.05); g.strokeRect(px + 1, py + 1, pw - 2, ph - 2); }
      if (f.k === "honey") { g.fillStyle = "#ffc53d"; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(px + pw * (0.3 + i * 0.4), py + ph + (f.n === 0 ? -ph : ph) * 0.2, cs * 0.06, 0, TAU); g.fill(); } }
    }
    // 4 · decor on the walls
    for (const d of room.decor) this.decor(g, d, H, B);
    // 5 · hatch frames: "EXIT" stamp under the exit hatch, arrows near the entry
    const ex = room.outX * cs, ey = H - room.h * cs;
    g.fillStyle = B.inks.hot;
    g.font = `${Math.round(cs * 0.42)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.save(); g.translate(ex + cs / 2, ey + cs * 1.55); g.rotate(-0.06);
    g.globalAlpha = 0.9; g.fillText("EXIT", 0, 0);
    g.restore();
    // stripes around the exit hatch
    g.save();
    g.beginPath(); g.rect(ex - cs, ey, cs, cs); g.rect(ex + cs, ey, cs, cs); g.clip();
    g.fillStyle = B.inks.hot;
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(ex - cs + i * cs * 0.4, ey + cs); g.lineTo(ex - cs + i * cs * 0.4 + cs * 0.2, ey + cs); g.lineTo(ex - cs + i * cs * 0.4 + cs * 0.55, ey); g.lineTo(ex - cs + i * cs * 0.4 + cs * 0.35, ey); g.fill(); }
    g.restore();
    return { c, cs };
  }

  private decor(g: CanvasRenderingContext2D, d: Room["decor"][number], H: number, B: Building) {
    const cs = this.cs;
    const x = (d.cx + (d.n === 1 ? 1 : d.n === 3 ? 0 : 0.5)) * cs, y = H - (d.cy + 0.5) * cs;
    const s = d.n === 1 ? 1 : -1;
    g.save(); g.translate(x, y);
    switch (d.k) {
      case "sign": g.fillStyle = B.inks.cool; g.fillRect(s > 0 ? -cs * 0.12 : -cs * 0.62, -cs * 0.28, cs * 0.74, cs * 0.5); g.fillStyle = B.inks.paper; g.font = `${Math.round(cs * 0.3)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s > 0 ? "→" : "←", s > 0 ? cs * 0.25 : -cs * 0.25, 0); break;
      case "vent": g.fillStyle = B.inks.shade; g.fillRect(-cs * 0.35, -cs * 0.3, cs * 0.7, cs * 0.6); g.strokeStyle = B.inks.wall; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-cs * 0.3, i * cs * 0.1); g.lineTo(cs * 0.3, i * cs * 0.1); g.stroke(); } break;
      case "screen": g.fillStyle = "#1a1030"; g.fillRect(-cs * 0.42, -cs * 0.32, cs * 0.84, cs * 0.64); g.fillStyle = "#e8504f"; g.beginPath(); g.arc(0, 0, cs * 0.18, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.fillRect(-cs * 0.1, -cs * 0.06, cs * 0.06, cs * 0.06); g.fillRect(cs * 0.04, -cs * 0.06, cs * 0.06, cs * 0.06); break;
      case "alarm": g.fillStyle = B.inks.hot; g.beginPath(); g.arc(0, 0, cs * 0.2, 0, TAU); g.fill(); break;
      case "crate": g.fillStyle = "#c9925a"; g.fillRect(-cs * 0.32, -cs * 0.32, cs * 0.64, cs * 0.64); g.strokeStyle = "#7a5230"; g.lineWidth = 1.5; g.strokeRect(-cs * 0.32, -cs * 0.32, cs * 0.64, cs * 0.64); g.beginPath(); g.moveTo(-cs * 0.32, -cs * 0.32); g.lineTo(cs * 0.32, cs * 0.32); g.stroke(); break;
      case "pipe": g.fillStyle = B.inks.shade; g.fillRect(-cs * 0.12, -cs * 0.5, cs * 0.24, cs); g.fillRect(-cs * 0.2, -cs * 0.1, cs * 0.4, cs * 0.2); break;
      case "trophy": g.fillStyle = "#ffc533"; g.beginPath(); g.moveTo(-cs * 0.2, -cs * 0.25); g.lineTo(cs * 0.2, -cs * 0.25); g.lineTo(cs * 0.1, cs * 0.05); g.lineTo(-cs * 0.1, cs * 0.05); g.fill(); g.fillRect(-cs * 0.04, cs * 0.05, cs * 0.08, cs * 0.15); break;
    }
    g.restore();
  }

  // ---------------------------------------------------------------- frame
  draw(sim: EscapeSim, alpha: number, dt: number, fx: FrameFx) {
    const g = this.g, cs = this.cs, k = this.k;
    this.time += dt;
    const room = sim.room;
    const B = buildingOf(room.building);
    if (B.id !== this.bld.id) { this.bld = B; this.bldT = 0; }
    this.bldT += dt;
    const ink = B.inks;
    // smoothed runner position
    const r = sim.r;
    this.rx = r.x; this.ry = r.y;
    // camera follows Momo, looking a little ahead (up)
    const want = this.ry + (this.h / k) * 0.12;
    if (!this.camInit) { this.camY = want; this.camInit = true; }
    this.camY += (want - this.camY) * Math.min(1, dt * 4.5);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const sk = fx.shakeOn && !fx.reduced ? this.shake * this.shake * cs * 0.25 : 0;
    const shx = (Math.random() - 0.5) * sk, shy = (Math.random() - 0.5) * sk;
    const oy = this.h * 0.55 + shy;
    const toX = (x: number) => this.ox + x * k + shx;
    const toY = (y: number) => oy - (y - this.camY) * k;

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // paper
    g.fillStyle = ink.paper; g.fillRect(0, 0, this.w, this.h);
    // poster word drifting behind (parallax)
    g.save();
    g.globalAlpha = B.night ? 0.12 : 0.08;
    g.fillStyle = ink.shade;
    g.font = `${Math.round(Math.min(this.w, this.h) * 0.42)}px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    const py = ((this.camY * k * 0.3) % (this.h * 0.9)) - this.h * 0.2;
    g.translate(this.w / 2, py); g.rotate(-0.16);
    g.fillText(B.poster, 0, 0); g.fillText(B.poster, -this.w * 0.15, this.h * 0.9);
    g.restore();

    // whole-world transforms for camera rules
    const rules = room.rules;
    g.save();
    if (rules.mirror || rules.flip || rules.tilt) {
      g.translate(this.w / 2, this.h / 2);
      if (rules.tilt) g.rotate(Math.sin(this.time * 0.6) * 0.07 + 0.06);
      if (rules.flip) g.rotate(Math.PI);
      if (rules.mirror) g.scale(-1, 1);
      g.translate(-this.w / 2, -this.h / 2);
    }

    // rooms in view
    const top = this.camY + (oy / k) + 2 * U, bottom = this.camY - ((this.h - oy) / k) - 2 * U;
    for (let i = 0; i < sim.rooms.length; i++) {
      const rm = sim.rooms[i];
      const y0 = rm.y0 * U, y1 = (rm.y0 + rm.h) * U;
      if (y1 < bottom || y0 > top) continue;
      let pr = this.cache.get(rm.n);
      if (!pr || pr.cs !== cs) { pr = this.printRoom(rm, buildingOf(rm.building)); this.cache.set(rm.n, pr); }
      let a = 1;
      if (rm.rules.memory && sim.st[i].active) {
        const t = sim.localT(i) / 60;
        a = t < 2.5 ? 1 : Math.max(0.12, 1 - (t - 2.5) * 0.6);
      }
      g.globalAlpha = a;
      g.drawImage(pr.c, toX(0), toY(y1), COLS * cs, rm.h * cs);
      g.globalAlpha = 1;
      this.roomLive(sim, i, toX, toY, buildingOf(rm.building));
    }
    // free far prints
    if (this.cache.size > 8) for (const key of [...this.cache.keys()]) if (key < room.n - 2 || key > room.n + 4) this.cache.delete(key);

    // Momo
    this.runner(sim, toX, toY, fx);
    // particles
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vy -= 0.05 * dt * 60; p.vx *= 0.97; p.vy *= 0.97; p.rot += p.vr * dt;
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = Math.min(1, a * 1.6);
      g.fillStyle = p.color;
      const sx = toX(p.x), sy = toY(p.y), s = p.size * k * (p.kind === 0 ? 0.6 + 0.6 * (1 - a) : 1);
      if (p.kind === 2) { g.save(); g.translate(sx, sy); g.rotate(p.rot); g.fillRect(-s, -s * 0.5, s * 2, s); g.restore(); }
      else { g.beginPath(); g.arc(sx, sy, s, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life > 0);
    g.restore();

    // overlays: lights out, fog, alarm, strobe, speed streaks, flash, grain
    if (rules.dark) {
      const sx = toX(this.rx), sy = toY(this.ry);
      const rad = cs * 3.4;
      const grd = g.createRadialGradient(sx, sy, rad * 0.35, sx, sy, rad);
      grd.addColorStop(0, "rgba(10,6,20,0)"); grd.addColorStop(1, "rgba(10,6,20,0.94)");
      g.fillStyle = grd; g.fillRect(0, 0, this.w, this.h);
    }
    if (rules.fog) { const grd = g.createLinearGradient(0, 0, 0, this.h * 0.5); grd.addColorStop(0, ink.paper); grd.addColorStop(1, "rgba(255,255,255,0)"); g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(0, 0, this.w, this.h * 0.5); g.globalAlpha = 1; }
    if (rules.alarm) { g.globalAlpha = 0.1 + 0.08 * Math.sin(this.time * 8); g.fillStyle = "#ff2040"; g.fillRect(0, 0, this.w, this.h); g.globalAlpha = 1; }
    if (rules.strobe && !fx.reduced) { const kk = Math.pow(1 - ((fx.beat % 1) + 1) % 1, 6); if (kk > 0.05) { g.globalAlpha = kk * 0.22; g.fillStyle = "#fff"; g.fillRect(0, 0, this.w, this.h); g.globalAlpha = 1; } }
    const sp = Math.max(0, Math.min(1.2, fx.speed));
    if (sp > 0.25 && !fx.reduced) {
      g.strokeStyle = fx.boost ? "rgba(70,200,255,0.5)" : ink.shade; g.lineWidth = Math.max(1, cs * 0.05);
      g.globalAlpha = Math.min(0.6, (sp - 0.2) * 0.7);
      for (let i = 0; i < 14; i++) {
        const sx = ((i * 97.13) % 1) * this.w * 0.9 + this.w * 0.05 + (i % 2 ? -1 : 1) * this.w * 0.02;
        const len = this.h * (0.08 + 0.1 * sp);
        const y = ((this.time * this.h * (1.2 + sp) + i * 211) % (this.h + len)) - len;
        g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + len); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (this.flash > 0) { g.globalAlpha = this.flash; g.fillStyle = this.flashColor; g.fillRect(0, 0, this.w, this.h); g.globalAlpha = 1; this.flash = Math.max(0, this.flash - dt * 1.4); }
    if (this.grainPat) { g.globalAlpha = 0.6; g.fillStyle = this.grainPat; g.fillRect(0, 0, this.w, this.h); g.globalAlpha = 1; }
    // building stamp
    if (this.stampT > 0) {
      this.stampT -= dt;
      const t = 2.4 - this.stampT;
      const s = t < 0.25 ? 1.8 - (t / 0.25) * 0.8 : 1;
      const a = this.stampT < 0.4 ? this.stampT / 0.4 : 1;
      g.save(); g.globalAlpha = a; g.translate(this.w / 2, this.h * 0.36); g.rotate(-0.12); g.scale(s, s);
      g.font = `${Math.round(Math.min(this.w * 0.12, 56))}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      const tw = g.measureText(this.stampText).width;
      g.strokeStyle = ink.hot; g.lineWidth = 5; g.strokeRect(-tw / 2 - 18, -36, tw + 36, 72);
      g.fillStyle = ink.hot; g.fillText(this.stampText, 3, 3);
      g.fillStyle = ink.wall; g.fillText(this.stampText, 0, 0);
      g.restore();
    }
    void alpha;
  }

  // ---------------------------------------------------------------- live parts of a room
  private roomLive(sim: EscapeSim, i: number, toX: (x: number) => number, toY: (y: number) => number, B: Building) {
    const g = this.g, room = sim.rooms[i], st = sim.st[i], k = this.k, cs = this.cs;
    const y0 = room.y0 * U;
    const t = sim.localT(i);
    const live = st.active;
    const X = (x: number) => toX(x), Y = (y: number) => toY(y + y0);
    // hatches: locked exit, closed entrance
    if (room.key && !st.key) this.slab(X(room.outX * U), Y((room.h) * U), cs, cs, B.inks.cool, true);
    if (st.inClosed && i > 0) this.slab(X(room.inX * U), Y(U), cs, cs, B.inks.wall, false);
    for (let c = 0; c < room.door.length; c++) if (room.door[c] && !st.key) this.slab(X((c % COLS) * U), Y((Math.floor(c / COLS) + 1) * U), cs, cs, B.inks.cool, true);
    // conveyor arrows
    for (const f of room.faces) if (f.k === "conveyor") {
      const [x, y, w, h] = spikeRect(f.cx, f.cy, f.n, 2.2);
      const dirx = DX[f.dir ?? 1], diry = DY[f.dir ?? 1];
      g.fillStyle = B.inks.wall;
      const ph = (this.time * 1.4) % 1;
      for (let s = 0; s < 2; s++) { const u = (s * 0.5 + ph) % 1; const cx = X(x + w * (dirx ? u : 0.5)), cy = Y(y + h * (diry ? u : 0.5)); g.beginPath(); g.arc(cx, cy, cs * 0.05, 0, TAU); g.fill(); }
    }
    // bumpers + pads
    for (const b of room.bumpers) { g.fillStyle = "#ff8a3d"; g.beginPath(); g.arc(X((b.cx + 0.5) * U), Y((b.cy + 0.5) * U), cs * 0.16, 0, TAU); g.fill(); g.strokeStyle = B.inks.wall; g.lineWidth = 2; g.stroke(); }
    for (const p of room.pads) for (const [px, pyy] of [[p.ax, p.ay], [p.bx, p.by]]) {
      g.save(); g.translate(X((px + 0.5) * U), Y(pyy * U + 1)); g.scale(1, 0.35); g.strokeStyle = "#9b6bff"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, cs * (0.32 + 0.06 * Math.sin(this.time * 6)), 0, TAU); g.stroke(); g.restore();
    }
    // hazards
    for (const h of room.hazards) this.hazard(h, live ? t : 0, live, X, Y, B, st.switched);
    // pickups
    for (const p of room.pickups) if (!st.got.has(p.id)) this.pickup(p, X, Y, B);
    void k;
  }

  private slab(x: number, y: number, w: number, h: number, color: string, lock: boolean) {
    const g = this.g;
    g.fillStyle = color; g.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (lock) { g.fillStyle = "#1a1030"; g.beginPath(); g.arc(x + w / 2, y + h * 0.42, w * 0.12, 0, TAU); g.fill(); g.fillRect(x + w * 0.46, y + h * 0.42, w * 0.08, h * 0.28); }
  }

  private hazard(h: Hazard, t: number, live: boolean, X: (x: number) => number, Y: (y: number) => number, B: Building, switched: boolean) {
    const g = this.g, k = this.k, cs = this.cs;
    const hot = B.inks.hot, wall = B.inks.wall;
    const off = !!h.off && switched;
    g.save();
    if (!live || off) g.globalAlpha = off ? 0.25 : 0.55;
    switch (h.k) {
      case "laser": {
        const [ax, ay, bx, by] = laserSeg(h, t);
        const on = live && laserOn(h, t) && !off;
        // emitters
        g.fillStyle = wall;
        const em = cs * 0.22;
        if (h.mode === "spin") { g.beginPath(); g.arc(X(h.px), Y(h.py), em * 0.7, 0, TAU); g.fill(); }
        else { g.fillRect(X(ax) - em / 2, Y(ay) - em / 2, em, em); g.fillRect(X(bx) - em / 2, Y(by) - em / 2, em, em); }
        const col = h.skin === "flame" ? "#ff7a1a" : h.skin === "arc" ? "#7ad8ff" : h.skin === "light" ? "rgba(255,240,160,0.75)" : h.skin === "blade" ? wall : h.skin === "hand" ? wall : hot;
        if (on) {
          g.strokeStyle = col; g.lineCap = "round";
          const wpx = Math.max(2, h.w * 2 * k);
          if (h.skin === "laser" || h.skin === "arc" || h.skin === "flame") { g.globalAlpha *= 0.35; g.lineWidth = wpx * 3; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke(); g.globalAlpha = live ? 1 : 0.55; }
          g.lineWidth = wpx;
          if (h.skin === "arc") {
            g.beginPath(); g.moveTo(X(ax), Y(ay));
            const n = 8;
            for (let s = 1; s < n; s++) { const u = s / n; g.lineTo(X(ax + (bx - ax) * u) + (Math.random() - 0.5) * cs * 0.3, Y(ay + (by - ay) * u) + (Math.random() - 0.5) * cs * 0.3); }
            g.lineTo(X(bx), Y(by)); g.stroke();
          } else { g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke(); }
          if (h.skin === "hand") { g.fillStyle = hot; g.beginPath(); g.arc(X(bx), Y(by), cs * 0.16, 0, TAU); g.fill(); }
        } else if (live && laserSoon(h, t)) {
          g.strokeStyle = hot; g.globalAlpha = 0.45; g.setLineDash([4, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke(); g.setLineDash([]);
        }
        break;
      }
      case "spikes": {
        const on = !live || spikesOn(h, t);
        const soon = live && spikesSoon(h, t);
        const col = h.skin === "crumble" ? "#c9925a" : h.skin === "spark" ? "#ffe03d" : hot;
        g.fillStyle = col;
        for (const f of h.faces) {
          const depth = on ? 3 : soon ? 1.4 : 0.6;
          const [x, y, w, hh] = spikeRect(f.cx, f.cy, f.n, depth);
          const n = 3;
          g.beginPath();
          for (let s = 0; s < n; s++) {
            if (f.n === 0 || f.n === 2) {
              const sx = x + (w / n) * s, base = f.n === 0 ? y : y + hh, tip = f.n === 0 ? y + hh : y;
              g.moveTo(X(sx), Y(base)); g.lineTo(X(sx + w / n / 2), Y(tip)); g.lineTo(X(sx + w / n), Y(base));
            } else {
              const sy = y + (hh / n) * s, base = f.n === 1 ? x : x + w, tip = f.n === 1 ? x + w : x;
              g.moveTo(X(base), Y(sy)); g.lineTo(X(tip), Y(sy + hh / n / 2)); g.lineTo(X(base), Y(sy + hh / n));
            }
          }
          g.fill();
          if (h.skin === "spark" && on && Math.random() < 0.3) this.sparkle((f.cx + 0.5) * U + DX[f.n] * 6, (f.cy + 0.5) * U + DY[f.n] * 6 + 0, "#ffe03d", 1);
        }
        break;
      }
      case "crusher": {
        const kk = crushK(h, t);
        const x = h.x + h.ex * kk, y = h.y + h.ey * kk;
        // rails
        g.strokeStyle = wall; g.globalAlpha *= 0.35; g.lineWidth = 2;
        g.beginPath(); g.moveTo(X(h.x + h.w / 2), Y(h.y + h.h / 2)); g.lineTo(X(h.x + h.ex + h.w / 2), Y(h.y + h.ey + h.h / 2)); g.stroke();
        g.globalAlpha = live ? 1 : 0.55;
        const warn = live && crushSoon(h, t);
        g.fillStyle = warn && Math.floor(this.time * 16) % 2 ? "#fff" : h.skin === "piston" ? "#9aa6b8" : hot;
        g.fillRect(X(x), Y(y + h.h), h.w * k, h.h * k);
        // hazard stripes
        g.save(); g.beginPath(); g.rect(X(x), Y(y + h.h), h.w * k, h.h * k); g.clip();
        g.fillStyle = wall; g.globalAlpha *= 0.85;
        for (let s = -2; s < 6; s++) { const sx = X(x) + s * cs * 0.3; g.beginPath(); g.moveTo(sx, Y(y)); g.lineTo(sx + cs * 0.12, Y(y)); g.lineTo(sx + cs * 0.42, Y(y + h.h)); g.lineTo(sx + cs * 0.3, Y(y + h.h)); g.fill(); }
        g.restore();
        if (live && kk >= 1 && crushK(h, t - 1) < 1) this.shake = Math.max(this.shake, 0.35);
        break;
      }
      case "turret": {
        const cx = (h.cx + 0.5) * U, cy = (h.cy + 0.5) * U;
        const ch = live ? turretCharge(h, t) : 0;
        g.fillStyle = wall;
        const bx = cx + DX[h.n] * 5, by = cy + DY[h.n] * 5;
        g.beginPath(); g.arc(X(bx), Y(by), cs * 0.26, 0, TAU); g.fill();
        g.fillStyle = ch > 0 ? "#fff" : hot;
        g.beginPath(); g.arc(X(bx + DX[h.n] * 1.2), Y(by + DY[h.n] * 1.2), cs * (0.1 + 0.08 * ch), 0, TAU); g.fill();
        if (live) {
          const s = shots(h, t);
          g.fillStyle = h.skin === "ink" ? B.inks.shade : h.skin === "ball" ? "#d23d3d" : hot;
          for (let j = 0; j < s.length; j += 2) {
            const half = h.size / 2;
            if (h.skin === "ball" || h.skin === "fast") { g.beginPath(); g.arc(X(s[j]), Y(s[j + 1]), half * k, 0, TAU); g.fill(); }
            else g.fillRect(X(s[j] - half), Y(s[j + 1] + half), h.size * k, h.size * k);
          }
        }
        break;
      }
      case "mover": {
        const [x, y] = moverPos(h, t);
        if (h.path === "pendulum") { g.strokeStyle = wall; g.lineWidth = 2; g.beginPath(); g.moveTo(X(h.x), Y(h.y)); g.lineTo(X(x), Y(y)); g.stroke(); }
        if (h.path === "orbit" && h.skin !== "drone") { g.strokeStyle = wall; g.lineWidth = 2; g.beginPath(); g.moveTo(X(h.x), Y(h.y)); g.lineTo(X(x), Y(y)); g.stroke(); }
        if (h.path === "line" && (h.skin === "saw" || h.skin === "bot" || h.skin === "barrel")) { g.strokeStyle = wall; g.globalAlpha *= 0.3; g.lineWidth = 2; g.beginPath(); g.moveTo(X(h.x), Y(h.y)); g.lineTo(X(h.x + h.ex), Y(h.y + h.ey)); g.stroke(); g.globalAlpha = live ? 1 : 0.55; }
        this.moverShape(h, X(x), Y(y), h.r * k, B, t);
        break;
      }
      case "pulse": {
        const s = live ? pulseState(h, t) : 0;
        const x = X(h.x), y = Y(h.y + h.h), w = h.w * k, hh = h.h * k;
        if (s === 1) { g.strokeStyle = hot; g.lineWidth = 2; g.setLineDash([4, 4]); g.strokeRect(x + 1, y + 1, w - 2, hh - 2); g.setLineDash([]); if (h.skin === "meteor" || h.skin === "bomb") { g.fillStyle = hot; g.globalAlpha = 0.18; g.fillRect(x, y, w, hh); } }
        if (s === 2) {
          const col = h.skin === "steam" ? "rgba(235,245,255,0.92)" : h.skin === "bolt" ? "#fff36b" : h.skin === "glitch" ? (Math.random() < 0.5 ? hot : B.inks.cool) : h.skin === "jaws" ? wall : hot;
          g.fillStyle = col; g.fillRect(x, y, w, hh);
          if (h.skin === "bolt") this.flash = Math.max(this.flash, 0.05);
        } else if (h.skin === "glitch") { g.globalAlpha *= 0.25; g.fillStyle = B.inks.cool; g.fillRect(x, y, w, hh); }
        else if (h.skin === "jaws") { g.fillStyle = wall; g.fillRect(x, y + hh * 0.75, w, hh * 0.25); }
        break;
      }
      case "flood": {
        const fy = floodY(h, t);
        const col = h.skin === "lava" ? "#ff5a1f" : h.skin === "dino" ? "#8fbf3a" : "#6be04a";
        const top = Y(fy + B.inks.paper.length * 0);
        g.fillStyle = col; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(X(0), this.h + 10);
        for (let s = 0; s <= 26; s++) { const xx = (s / 26) * COLS * U; g.lineTo(X(xx), top + Math.sin(this.time * 4 + s * 0.8) * cs * 0.12); }
        g.lineTo(X(COLS * U), this.h + 10); g.closePath(); g.fill();
        g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(X(0), top - 1, COLS * cs, 2);
        break;
      }
    }
    g.restore();
  }

  private moverShape(h: Extract<Hazard, { k: "mover" }>, x: number, y: number, r: number, B: Building, t: number) {
    const g = this.g, hot = B.inks.hot, wall = B.inks.wall;
    switch (h.skin) {
      case "saw": {
        g.save(); g.translate(x, y); g.rotate(this.time * 9);
        g.fillStyle = hot; g.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = i % 2 ? r : r * 0.78; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.fill(); g.fillStyle = wall; g.beginPath(); g.arc(0, 0, r * 0.25, 0, TAU); g.fill(); g.restore(); break;
      }
      case "grumpy": case "mine": case "bubble": {
        if (h.skin === "bubble") { g.strokeStyle = "#7ad8ff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.fillStyle = "rgba(122,216,255,0.25)"; g.fill(); break; }
        const body = h.skin === "mine" ? wall : "#7b3fe0";
        const pulse = h.skin === "mine" ? 1 + 0.08 * Math.sin(this.time * 8) : 1 + 0.05 * Math.sin(this.time * 5 + h.id);
        g.save(); g.translate(x, y); g.scale(pulse, pulse);
        g.fillStyle = h.skin === "mine" ? hot : "#ff4d6d";
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; g.beginPath(); g.moveTo(Math.cos(a - 0.25) * r * 0.8, Math.sin(a - 0.25) * r * 0.8); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.lineTo(Math.cos(a + 0.25) * r * 0.8, Math.sin(a + 0.25) * r * 0.8); g.fill(); }
        g.fillStyle = body; g.beginPath(); g.arc(0, 0, r * 0.88, 0, TAU); g.fill();
        if (h.skin === "grumpy") {
          g.fillStyle = "#fff"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.32, -r * 0.05, r * 0.2, r * 0.16, 0, 0, TAU); g.fill(); }
          g.fillStyle = "#1a0a2a"; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.3, -r * 0.02, r * 0.09, 0, TAU); g.fill(); }
          g.strokeStyle = "#1a0a2a"; g.lineWidth = Math.max(1.5, r * 0.12);
          for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.55, -r * 0.42); g.lineTo(s * r * 0.12, -r * 0.24); g.stroke(); }
          g.beginPath(); g.arc(0, r * 0.45, r * 0.22, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        } else { g.fillStyle = hot; g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.fill(); }
        g.restore(); break;
      }
      case "drone": {
        g.save(); g.translate(x, y);
        g.fillStyle = wall; g.fillRect(-r, -r * 0.35, r * 2, r * 0.7);
        g.fillStyle = hot; g.beginPath(); g.arc(0, 0, r * 0.32, 0, TAU); g.fill();
        g.strokeStyle = wall; g.lineWidth = 2; const sp = Math.sin(this.time * 40) * r * 0.6;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r - sp * 0.5, -r * 0.55); g.lineTo(s * r + sp * 0.5, -r * 0.55); g.stroke(); }
        g.restore(); break;
      }
      case "bot": {
        g.save(); g.translate(x, y);
        g.fillStyle = wall; g.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.5);
        g.fillStyle = hot; g.fillRect(-r * 0.5, -r * 0.45, r, r * 0.35);
        g.fillStyle = "#fff"; g.fillRect(-r * 0.35 + Math.sin(t * 0.08) * r * 0.2, -r * 0.4, r * 0.25, r * 0.25);
        g.restore(); break;
      }
      case "barrel": {
        g.save(); g.translate(x, y); g.rotate(x * 0.05);
        g.fillStyle = "#c9925a"; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.strokeStyle = "#7a5230"; g.lineWidth = 2; for (const s of [-0.5, 0.5]) { g.beginPath(); g.moveTo(-r, s * r); g.lineTo(r, s * r); g.stroke(); }
        g.restore(); break;
      }
      case "pendulum": case "mace": case "lamp": {
        g.fillStyle = h.skin === "lamp" ? "#ffe9a8" : wall; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        if (h.skin !== "lamp") { g.fillStyle = hot; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + this.time; g.beginPath(); g.moveTo(x + Math.cos(a - 0.3) * r, y + Math.sin(a - 0.3) * r); g.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); g.lineTo(x + Math.cos(a + 0.3) * r, y + Math.sin(a + 0.3) * r); g.fill(); } }
        else { g.fillStyle = "rgba(255,240,170,0.25)"; g.beginPath(); g.arc(x, y, r * 2.2, 0, TAU); g.fill(); }
        break;
      }
      default: g.fillStyle = hot; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }

  private pickup(p: Pickup, X: (x: number) => number, Y: (y: number) => number, B: Building) {
    const g = this.g, cs = this.cs;
    const x = X(p.x), y = Y(p.y) + Math.sin(this.time * 3 + p.id) * cs * 0.05;
    g.save(); g.translate(x, y);
    switch (p.k) {
      case "coin": case "plate": {
        const sx = Math.abs(Math.cos(this.time * 3 + p.id * 0.7));
        g.fillStyle = p.k === "plate" ? B.inks.cool : "#ffc533";
        g.beginPath(); g.ellipse(0, 0, cs * 0.17 * Math.max(0.25, sx), cs * 0.17, 0, 0, TAU); g.fill();
        g.strokeStyle = "#c98a00"; g.lineWidth = 1.2; g.stroke();
        break;
      }
      case "diamond": {
        g.rotate(Math.sin(this.time * 2 + p.id) * 0.2);
        const s = cs * 0.24;
        g.fillStyle = B.inks.cool; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.8, 0); g.lineTo(0, s); g.lineTo(-s * 0.8, 0); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.moveTo(0, -s * 0.6); g.lineTo(s * 0.3, -s * 0.1); g.lineTo(0, s * 0.1); g.fill();
        break;
      }
      case "heart": case "vend": {
        if (p.k === "vend") { g.fillStyle = B.inks.cool; g.fillRect(-cs * 0.32, -cs * 0.42, cs * 0.64, cs * 0.84); g.fillStyle = B.inks.paper; g.font = `${Math.round(cs * 0.26)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("25", 0, cs * 0.24); g.translate(0, -cs * 0.1); g.scale(0.6, 0.6); }
        const s = cs * 0.2 * (1 + 0.08 * Math.sin(this.time * 6));
        g.fillStyle = "#ff3d6e"; g.beginPath(); g.moveTo(0, s * 0.9);
        g.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.6, -s * 1.3, 0, -s * 0.45);
        g.bezierCurveTo(s * 0.6, -s * 1.3, s * 1.6, -s * 0.2, 0, s * 0.9); g.fill();
        break;
      }
      case "booster": {
        g.fillStyle = "#3dd8ff"; g.beginPath(); g.arc(0, 0, cs * 0.3, 0, TAU); g.fill();
        g.fillStyle = "#ffe03d"; const s = cs * 0.22;
        g.beginPath(); g.moveTo(s * 0.2, -s); g.lineTo(-s * 0.5, s * 0.1); g.lineTo(-s * 0.05, s * 0.1); g.lineTo(-s * 0.25, s); g.lineTo(s * 0.5, -s * 0.15); g.lineTo(s * 0.05, -s * 0.15); g.closePath(); g.fill();
        break;
      }
      case "shield": case "ghost": case "slowmo": case "magnet": {
        g.fillStyle = p.k === "shield" ? "#7affea" : p.k === "ghost" ? "#e8f0ff" : p.k === "slowmo" ? "#ffd23d" : "#ff5d8f";
        g.beginPath(); g.arc(0, 0, cs * 0.26, 0, TAU); g.fill();
        g.strokeStyle = B.inks.wall; g.lineWidth = 2; g.stroke();
        g.fillStyle = B.inks.wall; g.font = `${Math.round(cs * 0.3)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(p.k === "shield" ? "◎" : p.k === "ghost" ? "☁" : p.k === "slowmo" ? "◷" : "U", 0, 1);
        break;
      }
      case "key": {
        g.rotate(Math.sin(this.time * 3) * 0.3);
        g.strokeStyle = "#ffc533"; g.lineWidth = cs * 0.08; g.beginPath(); g.arc(-cs * 0.1, 0, cs * 0.1, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(cs * 0.26, 0); g.moveTo(cs * 0.2, 0); g.lineTo(cs * 0.2, cs * 0.08); g.stroke();
        break;
      }
      case "switch": {
        g.fillStyle = B.inks.wall; g.fillRect(-cs * 0.25, -cs * 0.12, cs * 0.5, cs * 0.3);
        g.fillStyle = "#ff3d3d"; g.beginPath(); g.arc(0, -cs * 0.12, cs * 0.15, Math.PI, 0); g.fill();
        break;
      }
      case "buddy": {
        g.strokeStyle = B.inks.wall; g.lineWidth = 1.5; g.strokeRect(-cs * 0.32, -cs * 0.32, cs * 0.64, cs * 0.64);
        g.fillStyle = "#9be34a"; g.beginPath(); g.arc(0, cs * 0.06, cs * 0.2, 0, TAU); g.fill();
        g.fillStyle = "#1a1030"; g.fillRect(-cs * 0.08, 0, cs * 0.04, cs * 0.05); g.fillRect(cs * 0.04, 0, cs * 0.04, cs * 0.05);
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * cs * 0.16, -cs * 0.32); g.lineTo(i * cs * 0.16, cs * 0.32); g.stroke(); }
        break;
      }
    }
    g.restore();
  }

  // ---------------------------------------------------------------- Momo
  private runner(sim: EscapeSim, toX: (x: number) => number, toY: (y: number) => number, fx: FrameFx) {
    const g = this.g, cs = this.cs, r = sim.r;
    if (sim.dead) return;
    const sx = toX(this.rx), sy = toY(this.ry);
    {
      const m = g.getTransform();
      this.momoPt = { x: (m.a * sx + m.c * sy + m.e) / this.dpr, y: (m.b * sx + m.d * sy + m.f) / this.dpr };
    }
    // ink trail while dashing
    if (r.mode === 1) this.trail.push({ x: this.rx, y: this.ry, a: 1 });
    for (const p of this.trail) p.a -= 0.08;
    this.trail = this.trail.filter((p) => p.a > 0).slice(-14);
    g.fillStyle = this.bld.inks.shade;
    for (const p of this.trail) { g.globalAlpha = p.a * 0.45; g.beginPath(); g.arc(toX(p.x), toY(p.y), cs * 0.22 * p.a, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    const frozen = sim.frozen > 0;
    if (frozen && Math.floor(this.time * 10) % 2) return;
    // orientation: "down" is towards the wall (g); while dashing, towards where he flies (he lands feet first)
    const gdir = r.mode === 1 ? r.d : r.g;
    if (gdir !== this.lastG && r.mode === 0) this.lastG = gdir;
    const downA = Math.atan2(DY[gdir] * -1, DX[gdir]) ; // screen y is flipped
    this.squash += (0 - this.squash) * 0.18;
    const R = cs * 0.34;
    g.save();
    g.translate(sx, sy);
    g.rotate(downA - Math.PI / 2);
    // now +y (screen) points to the wall
    const off = r.mode === 0 ? cs * 0.5 - R - cs * 0.08 : 0;
    g.translate(0, off);
    const sq = r.mode === 1 ? -0.18 : this.squash * 0.22;
    // legs: planted while he waits for the player, tucked in while dashing
    if (r.mode === 0) {
      const sway = Math.sin(this.time * 3) * R * 0.05;
      g.strokeStyle = "#3a1d0a"; g.lineWidth = Math.max(1.5, cs * 0.07); g.lineCap = "round";
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * R * 0.35, R * 0.75); g.lineTo(s * R * 0.45 + sway, R * 1.18); g.stroke(); }
    }
    // body
    g.scale(1 + sq, 1 - sq);
    if (sim.ghostT > 0) g.globalAlpha = Math.floor(this.time * 14) % 2 ? 0.35 : 0.75;
    g.fillStyle = fx.ch.color;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = "#3a1d0a"; g.lineWidth = Math.max(1.2, cs * 0.045); g.stroke();
    // misregistered highlight
    g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(-R * 0.35, -R * 0.35, R * 0.25, 0, TAU); g.fill();
    // which way he looks (screen) — along the dash, or out into the room while he waits
    const look = r.mode === 1 ? r.d : opp(r.g), lk = r.mode === 1 ? 1 : 0.45;
    const fdx = DX[look] * lk, fdy = -DY[look] * lk;
    const ca = Math.cos(-(downA - Math.PI / 2)), sa = Math.sin(-(downA - Math.PI / 2));
    const lx = fdx * ca - fdy * sa, ly = fdx * sa + fdy * ca;
    const ex = lx * R * 0.28, ey = ly * R * 0.28 - R * 0.12;
    g.fillStyle = "#fff";
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(ex + s * R * 0.3, ey, R * 0.2, R * 0.24, 0, 0, TAU); g.fill(); }
    g.fillStyle = "#1a1030";
    for (const s of [-1, 1]) { g.beginPath(); g.arc(ex + s * R * 0.3 + lx * R * 0.08, ey + ly * R * 0.06, R * 0.1, 0, TAU); g.fill(); }
    // sprout on top
    g.fillStyle = "#5fd35a";
    g.beginPath(); g.ellipse(-R * 0.18, -R * 1.08, R * 0.24, R * 0.11, -0.6, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(R * 0.18, -R * 1.1, R * 0.24, R * 0.11, 0.6, 0, TAU); g.fill();
    g.strokeStyle = "#3a8a2a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -R * 0.95); g.lineTo(0, -R * 1.12); g.stroke();
    g.globalAlpha = 1;
    if (sim.shield) { g.strokeStyle = "#7affea"; g.lineWidth = 2.5; g.globalAlpha = 0.8; g.beginPath(); g.arc(0, 0, R * 1.45 + Math.sin(this.time * 6) * 1.5, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    if (fx.boost) { g.strokeStyle = "rgba(70,210,255,0.7)"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * 1.25, 0, TAU); g.stroke(); }
    g.restore();
  }

  dispose() { this.cv.remove(); this.cache.clear(); }
}
