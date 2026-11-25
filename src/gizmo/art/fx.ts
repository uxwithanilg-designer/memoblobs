// Effects. World particles (metres, y up) from a fixed pool — dust and dirt from the tyres in the ground's colours,
// exhaust puffs, sparks, coin sparkles, pickup rings, crate splinters, splashes, crash smoke and finish confetti —
// and screen-space weather for each world: confetti, sprinkles, dust motes, cloud wisps, neon bits, snow, sparks,
// glowing spores, rising bubbles, steam puffs, drifting fog and star dust. No allocation per frame; counts follow the
// device's quality.
import type { Weather } from "../worlds";
import { rgba } from "../util";

export const DUST = 0, DIRT = 1, SMOKE = 2, SPARK = 3, SPARKLE = 4, CONFETTI = 5, RING = 6, CHUNK = 7, DROP = 8;
const TAU = Math.PI * 2;

export class Particles {
  private n: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; rot: Float32Array; kind: Uint8Array; col: Uint8Array;
  private palette: string[] = [];
  private next = 0;
  constructor(n: number) {
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.size = new Float32Array(n); this.rot = new Float32Array(n);
    this.kind = new Uint8Array(n); this.col = new Uint8Array(n);
  }
  /** colours by index: 0..3 ground, 4 smoke, 5 spark, 6.. confetti and pickups */
  setPalette(p: string[]) { this.palette = p; }
  spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.col[i] = col; this.rot[i] = Math.random() * 6.28;
  }
  burst(kind: number, x: number, y: number, count: number, speed: number, life: number, size: number, col: number, up = 0) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s + up, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), col + (kind === CONFETTI ? Math.floor(Math.random() * 5) : 0));
    }
  }
  clear() { this.life.fill(0); }
  update(dt: number, g: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = this.kind[i];
      const grav = k === SMOKE ? -0.7 : k === DUST ? -0.15 : k === SPARKLE || k === RING ? 0 : k === CONFETTI ? g * 0.16 : g * 0.9;
      const drag = k === SMOKE || k === DUST ? 0.93 : k === CONFETTI ? 0.965 : 0.99;
      this.vx[i] *= drag; this.vy[i] = this.vy[i] * drag - grav * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += dt * (k === CONFETTI || k === CHUNK ? 9 : 2);
    }
  }
  draw(c: CanvasRenderingContext2D, x0: number, x1: number) {
    const P = this.palette;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const x = this.x[i];
      if (x < x0 || x > x1) continue;
      const y = this.y[i], u = this.life[i] / this.max[i], s = this.size[i], k = this.kind[i];
      const col = P[this.col[i] % P.length] ?? "#FFFFFF";
      if (k === DUST || k === SMOKE) {
        c.globalAlpha = u * (k === SMOKE ? 0.5 : 0.55);
        c.fillStyle = col; c.beginPath(); c.arc(x, y, s * (1.6 - u * 0.6), 0, TAU); c.fill();
      } else if (k === SPARK) {
        c.globalAlpha = u; c.strokeStyle = col; c.lineWidth = s * 0.5;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - this.vx[i] * 0.04, y - this.vy[i] * 0.04); c.stroke();
      } else if (k === SPARKLE) {
        c.globalAlpha = u; c.fillStyle = col;
        const r = s * (0.5 + u * 0.5);
        c.beginPath(); c.moveTo(x, y + r); c.lineTo(x + r * 0.25, y + r * 0.25); c.lineTo(x + r, y); c.lineTo(x + r * 0.25, y - r * 0.25); c.lineTo(x, y - r); c.lineTo(x - r * 0.25, y - r * 0.25); c.lineTo(x - r, y); c.lineTo(x - r * 0.25, y + r * 0.25); c.closePath(); c.fill();
      } else if (k === RING) {
        c.globalAlpha = u * 0.8; c.strokeStyle = col; c.lineWidth = 0.08;
        c.beginPath(); c.arc(x, y, s * (1.2 - u), 0, TAU); c.stroke();
      } else if (k === CONFETTI || k === CHUNK || k === DIRT) {
        c.globalAlpha = Math.min(1, u * 2); c.fillStyle = col;
        c.save(); c.translate(x, y); c.rotate(this.rot[i]);
        if (k === CONFETTI) c.fillRect(-s, -s * 0.5, s * 2, s * Math.abs(Math.cos(this.rot[i] * 1.7)) + 0.01);
        else c.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        c.restore();
      } else {
        c.globalAlpha = u; c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ weather (screen space)
interface Flake { x: number; y: number; s: number; v: number; ph: number; c: number }
export class WeatherFx {
  private f: Flake[] = [];
  /** a soft round puff (fog, steam, cloud wisps), painted once */
  private puff: HTMLCanvasElement | null = null;
  constructor(private kind: Weather, count: number, private glow: string, private night: number) {
    const soft = kind === "fog" || kind === "steam" || kind === "wisps";
    if (soft) count = Math.round(count * 0.25);
    for (let i = 0; i < count; i++) this.f.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), v: 0.5 + Math.random(), ph: Math.random() * TAU, c: Math.floor(Math.random() * 5) });
    if (soft && typeof document !== "undefined") {
      const cv = document.createElement("canvas"); cv.width = cv.height = 128;
      const g = cv.getContext("2d")!, rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      const col = kind === "fog" ? "#C8FFD8" : kind === "steam" ? "#FFF4E0" : "#FFFFFF";
      rg.addColorStop(0, rgba(col, 1)); rg.addColorStop(0.5, rgba(col, 0.45)); rg.addColorStop(1, rgba(col, 0));
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      this.puff = cv;
    }
  }
  draw(c: CanvasRenderingContext2D, W: number, H: number, dt: number, t: number, dxPx: number, dyPx: number) {
    const k = this.kind, m = Math.min(W, H) / 700;
    const conf = ["#FF6B6B", "#FFC93C", "#4D96FF", "#6BCB77", "#B983FF"];
    for (const p of this.f) {
      // fall / rise speed in screen fractions per second, and the camera's sweep
      let vy = 0.05, vx = 0;
      if (k === "snow") { vy = 0.07 * p.v; vx = Math.sin(t + p.ph) * 0.02; }
      else if (k === "confetti" || k === "sprinkles") { vy = 0.06 * p.v; vx = Math.sin(t * 2 + p.ph) * 0.03; }
      else if (k === "bubbles" || k === "steam" || k === "spores" || k === "neon") { vy = -0.04 * p.v; vx = Math.sin(t * 0.8 + p.ph) * 0.015; }
      else if (k === "sparks") { vy = -0.08 * p.v; vx = 0.02; }
      else if (k === "wisps" || k === "fog") { vy = 0; vx = -0.015 * p.v; }
      else if (k === "dust" || k === "stardust") { vy = 0.005 * Math.sin(t + p.ph); vx = -0.01 * p.v; }
      p.x += vx * dt - (dxPx / W) * (0.4 + p.s * 0.6);
      p.y += vy * dt + (dyPx / H) * (0.4 + p.s * 0.6);
      if (p.x < -0.05) p.x += 1.1; else if (p.x > 1.05) p.x -= 1.1;
      if (p.y < -0.05) p.y += 1.1; else if (p.y > 1.05) p.y -= 1.1;
      const x = p.x * W, y = p.y * H, s = p.s * m;
      switch (k) {
        case "snow": c.fillStyle = rgba("#FFFFFF", 0.8); c.beginPath(); c.arc(x, y, 2.6 * s, 0, TAU); c.fill(); break;
        case "confetti": c.fillStyle = conf[p.c]; c.save(); c.translate(x, y); c.rotate(t * 3 + p.ph); c.fillRect(-4 * s, -2 * s * Math.abs(Math.cos(t * 4 + p.ph)), 8 * s, 4 * s); c.restore(); break;
        case "sprinkles": c.fillStyle = ["#FF6FB5", "#7CF5C8", "#FFD23F", "#7C6BFF", "#FFFFFF"][p.c]; c.save(); c.translate(x, y); c.rotate(p.ph + t * 0.5); c.fillRect(-5 * s, -1.6 * s, 10 * s, 3.2 * s); c.restore(); break;
        case "dust": c.fillStyle = rgba("#FFF2D0", 0.35); c.beginPath(); c.arc(x, y, 1.8 * s, 0, TAU); c.fill(); break;
        case "stardust": c.fillStyle = rgba("#CFE3FF", 0.4 + 0.4 * Math.sin(t * 3 + p.ph)); c.fillRect(x, y, 2 * s, 2 * s); break;
        case "wisps": if (this.puff) { c.globalAlpha = 0.16; c.drawImage(this.puff, x - 110 * s, y - 16 * s, 220 * s, 32 * s); c.globalAlpha = 1; } break;
        case "fog": if (this.puff) { c.globalAlpha = 0.1 + 0.05 * this.night; c.drawImage(this.puff, x - 260 * s, y * 0.35 + H * 0.55 - 50 * s, 520 * s, 100 * s); c.globalAlpha = 1; } break;
        case "neon": c.fillStyle = rgba(["#2BF6FF", "#FF3DCB", "#FFE14D"][p.c % 3], 0.6); c.fillRect(x, y, 3 * s, 3 * s); break;
        case "sparks": c.fillStyle = rgba("#FFB050", 0.5 + 0.5 * Math.sin(t * 8 + p.ph)); c.fillRect(x, y, 2.4 * s, 2.4 * s); break;
        case "spores": { const a = 0.35 + 0.45 * Math.sin(t * 2 + p.ph); c.fillStyle = rgba(this.glow, a * 0.35); c.beginPath(); c.arc(x, y, 6 * s, 0, TAU); c.fill(); c.fillStyle = rgba("#FFFFFF", a); c.beginPath(); c.arc(x, y, 1.6 * s, 0, TAU); c.fill(); break; }
        case "bubbles": c.strokeStyle = rgba("#E6FFFF", 0.45); c.lineWidth = 1.2 * s; c.beginPath(); c.arc(x, y, 4 * s * p.v, 0, TAU); c.stroke(); c.fillStyle = rgba("#FFFFFF", 0.5); c.beginPath(); c.arc(x - 1.2 * s, y - 1.2 * s, 1 * s, 0, TAU); c.fill(); break;
        case "steam": if (this.puff) { c.globalAlpha = 0.14 * (0.5 + 0.5 * Math.sin(t * 0.6 + p.ph)); c.drawImage(this.puff, x - 60 * s, y - 60 * s, 120 * s, 120 * s); c.globalAlpha = 1; } break;
      }
    }
  }
}
