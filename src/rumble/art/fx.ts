// Effects. World particles (metres, y up) from one fixed pool — dust and dirt from the tyres, mud splats, water
// splashes, exhaust puffs, sparks, pickup sparkles and rings, metal shards from hits, fireballs and flashes for rocket
// blasts, confetti and stars at the finish — and screen-space weather: rain, snow, desert dust, falling leaves and petals, rising embers,
// blinking fireflies, drifting glow spores and pollen, and banks of mist. No allocation per frame; counts follow the
// device's quality.
import type { Weather } from "../worlds";
import { rgba } from "../util";

export const DUST = 0, DIRT = 1, SMOKE = 2, SPARK = 3, SPARKLE = 4, CONFETTI = 5, RING = 6, SPLASH = 7, SHARD = 8, STAR = 9, MUD = 10, FIRE = 11, FLASH = 12;

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
  /** colours by index (set once per stage) */
  setPalette(p: string[]) { this.palette = p; }
  spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.col[i] = col; this.rot[i] = Math.random() * 6.28;
  }
  burst(kind: number, x: number, y: number, count: number, speed: number, life: number, size: number, col: number, up = 0, colRange = 1) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s + up, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), col + Math.floor(Math.random() * colRange));
    }
  }
  clear() { this.life.fill(0); }
  update(dt: number, g: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = this.kind[i];
      const grav = k === SMOKE ? -0.7 : k === FIRE ? -1.6 : k === DUST ? -0.15 : k === SPARKLE || k === RING || k === STAR || k === FLASH ? 0 : k === CONFETTI ? g * 0.16 : g * 0.9;
      const drag = k === SMOKE || k === DUST ? 0.92 : k === FIRE ? 0.9 : k === CONFETTI ? 0.96 : k === STAR ? 0.97 : 0.99;
      this.vx[i] *= drag; this.vy[i] = this.vy[i] * drag - grav * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += dt * (k === CONFETTI || k === SHARD ? 10 : 2);
    }
  }
  draw(c: CanvasRenderingContext2D, x0: number, x1: number) {
    const P = this.palette;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const x = this.x[i];
      if (x < x0 || x > x1) continue;
      const y = this.y[i], k = this.kind[i], u = this.life[i] / this.max[i], s = this.size[i];
      const col = P[this.col[i] % P.length] ?? "#FFFFFF";
      if (k === DUST || k === SMOKE) {
        c.globalAlpha = u * (k === SMOKE ? 0.4 : 0.5);
        c.fillStyle = col; c.beginPath(); c.arc(x, y, s * (1.8 - u), 0, Math.PI * 2); c.fill();
      } else if (k === DIRT || k === MUD) {
        c.globalAlpha = Math.min(1, u * 2);
        c.fillStyle = col; c.fillRect(x - s / 2, y - s / 2, s, s * (k === MUD ? 0.7 : 1));
      } else if (k === SPLASH) {
        c.globalAlpha = Math.min(1, u * 1.6) * 0.8;
        c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
      } else if (k === SPARK) {
        c.globalAlpha = u; c.strokeStyle = col; c.lineWidth = s * 0.5;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - this.vx[i] * 0.03, y - this.vy[i] * 0.03); c.stroke();
      } else if (k === SPARKLE || k === STAR) {
        c.globalAlpha = Math.min(1, u * 1.5); c.fillStyle = col;
        const r = s * (k === STAR ? 1.2 : 0.6 + u * 0.6), r2 = r * 0.32;
        c.beginPath(); c.moveTo(x, y + r); c.lineTo(x + r2, y + r2); c.lineTo(x + r, y); c.lineTo(x + r2, y - r2); c.lineTo(x, y - r); c.lineTo(x - r2, y - r2); c.lineTo(x - r, y); c.lineTo(x - r2, y + r2); c.closePath(); c.fill();
      } else if (k === CONFETTI || k === SHARD) {
        c.globalAlpha = Math.min(1, u * 3); c.fillStyle = col;
        c.save(); c.translate(x, y); c.rotate(this.rot[i]);
        if (k === SHARD) { c.beginPath(); c.moveTo(-s, -s * 0.4); c.lineTo(s * 0.8, -s * 0.6); c.lineTo(s * 0.2, s * 0.7); c.closePath(); c.fill(); }
        else c.fillRect(-s, -s * 0.5 * Math.abs(Math.cos(this.rot[i] * 0.7)), s * 2, s * Math.abs(Math.cos(this.rot[i] * 0.7)));
        c.restore();
      } else if (k === FIRE) {
        // a fireball: hot yellow core going orange, then a dark smoke puff
        c.globalAlpha = Math.min(1, u * 1.6);
        c.fillStyle = u > 0.6 ? "#FFE27A" : u > 0.35 ? col : "#4A3A3A";
        c.beginPath(); c.arc(x, y, s * (1.6 - u), 0, Math.PI * 2); c.fill();
      } else if (k === FLASH) {
        c.globalAlpha = u * 0.75; c.fillStyle = col;
        c.beginPath(); c.arc(x, y, s * (1.4 - u * 0.8), 0, Math.PI * 2); c.fill();
      } else if (k === RING) {
        c.globalAlpha = u * 0.9; c.strokeStyle = col; c.lineWidth = 0.08;
        c.beginPath(); c.arc(x, y, s * (1.2 - u), 0, Math.PI * 2); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
}

/** screen-space weather */
export class WeatherFx {
  private n: number;
  private x: Float32Array; private y: Float32Array; private z: Float32Array; private p: Float32Array;
  constructor(private kind: Weather, count: number, private cols: { leaf: string[]; glow: string; haze: string }) {
    this.n = kind === "clear" || kind === "stars" ? 0 : kind === "fog" ? 6 : count;
    this.x = new Float32Array(this.n); this.y = new Float32Array(this.n); this.z = new Float32Array(this.n); this.p = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { this.x[i] = Math.random(); this.y[i] = Math.random(); this.z[i] = 0.4 + Math.random() * 0.6; this.p[i] = Math.random() * 6.28; }
    if (kind === "fog" && typeof document !== "undefined") {
      // one soft band, painted once and stretched
      const cv = document.createElement("canvas"); cv.width = 4; cv.height = 128;
      const g = cv.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, rgba(cols.haze, 0)); gr.addColorStop(0.5, rgba(cols.haze, 0.22)); gr.addColorStop(1, rgba(cols.haze, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
      this.band = cv;
    }
  }
  private band: HTMLCanvasElement | null = null;
  /** dx, dy: how far the camera moved this frame (px) — near flakes move with the world */
  draw(c: CanvasRenderingContext2D, W: number, H: number, dt: number, t: number, dx: number, dy: number, wind: number) {
    const k = this.kind;
    if (this.n === 0) return;
    if (k === "fog") {
      for (let i = 0; i < this.n; i++) {
        const y = H * (0.35 + i * 0.1), w = W * 1.6;
        const x = ((this.x[i] * w + t * (10 + i * 4) - dx * 0.2) % w + w) % w - W * 0.3;
        if (this.band) c.drawImage(this.band, x - W, y - H * 0.12, W * 2.2, H * 0.24);
      }
      return;
    }
    const S = Math.max(W, H) / 900;
    for (let i = 0; i < this.n; i++) {
      const z = this.z[i];
      let vx = 0, vy = 0;
      switch (k) {
        case "rain": vx = -0.12 + wind * 0.02; vy = 1.6; break;
        case "snow": vx = Math.sin(t + this.p[i]) * 0.03 + wind * 0.01; vy = 0.12; break;
        case "dust": vx = -0.6 + wind * 0.05; vy = 0.04 * Math.sin(t * 2 + this.p[i]); break;
        case "leaves": case "petals": case "breeze": vx = -0.08 + Math.sin(t * 0.8 + this.p[i]) * 0.06 + wind * 0.02; vy = 0.08; break;
        case "embers": vx = Math.sin(t + this.p[i]) * 0.03; vy = -0.12; break;
        case "fireflies": case "spores": case "pollen": vx = Math.sin(t * 0.5 + this.p[i]) * 0.02; vy = Math.cos(t * 0.4 + this.p[i]) * 0.015 - (k === "spores" ? 0.02 : 0); break;
      }
      this.x[i] += vx * dt * z - (dx / W) * z * 0.9; this.y[i] += vy * dt * z - (dy / H) * z * 0.9;
      this.x[i] = ((this.x[i] % 1) + 1) % 1; this.y[i] = ((this.y[i] % 1) + 1) % 1;
      const x = this.x[i] * W, y = this.y[i] * H;
      switch (k) {
        case "rain": c.strokeStyle = `rgba(200,220,255,${0.35 * z})`; c.lineWidth = 1.2 * z * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6 * S, y + 22 * z * S); c.stroke(); break;
        case "snow": c.fillStyle = `rgba(255,255,255,${0.85 * z})`; c.beginPath(); c.arc(x, y, 2.4 * z * S, 0, Math.PI * 2); c.fill(); break;
        case "dust": c.fillStyle = `rgba(240,200,150,${0.3 * z})`; c.fillRect(x, y, 10 * z * S, 1.6 * S); break;
        case "leaves": case "petals": case "breeze": {
          const col = k === "petals" ? (i % 2 ? "#FFC4DA" : "#FF9EC4") : this.cols.leaf[i % this.cols.leaf.length];
          c.fillStyle = col; c.save(); c.translate(x, y); c.rotate(t * 2 + this.p[i]); c.beginPath(); c.ellipse(0, 0, 5 * z * S, 2.4 * z * S, 0, 0, Math.PI * 2); c.fill(); c.restore();
          break;
        }
        case "embers": { const a = 0.5 + 0.5 * Math.sin(t * 5 + this.p[i]); c.fillStyle = `rgba(255,${140 + Math.floor(a * 80)},60,${0.8 * z})`; c.fillRect(x, y, 2.6 * z * S, 2.6 * z * S); break; }
        case "fireflies": case "spores": case "pollen": {
          const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (k === "fireflies" ? 2 : 0.8) + this.p[i]));
          const col = k === "fireflies" ? "#E8FF8A" : k === "pollen" ? "#FFE89A" : this.cols.glow;
          c.fillStyle = rgba(col, 0.25 * a * z); c.beginPath(); c.arc(x, y, 8 * z * S, 0, Math.PI * 2); c.fill();
          c.fillStyle = rgba(col, a); c.beginPath(); c.arc(x, y, 2 * z * S, 0, Math.PI * 2); c.fill();
          break;
        }
      }
    }
  }
}
