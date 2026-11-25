// Effects. World particles (metres, y up) from a fixed pool — dust and dirt from the tyres in the ground's colours,
// exhaust puffs, sparks off the body, coin sparkles, pickup bursts and rings, crash smoke and finish confetti — and
// screen-space weather: rain streaks, snow, sand, falling leaves and petals, rising embers, blinking fireflies,
// drifting glow spores and banks of mist. No allocation per frame; counts follow the device's quality.
import type { Weather } from "../worlds";
import { rgba } from "../util";

export type PKind = 0 | 1 | 2 | 3 | 4 | 5 | 6; // dust, dirt, smoke, spark, sparkle, confetti, ring
export const DUST = 0, DIRT = 1, SMOKE = 2, SPARK = 3, SPARKLE = 4, CONFETTI = 5, RING = 6;

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
  /** colours by index (set once per stage): 0..3 ground, 4 exhaust, 5 spark, 6.. confetti and pickups */
  setPalette(p: string[]) { this.palette = p; }
  spawn(kind: PKind, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.col[i] = col; this.rot[i] = Math.random() * 6.28;
  }
  burst(kind: PKind, x: number, y: number, count: number, speed: number, life: number, size: number, col: number, up = 0) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s + up, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), col + (kind === CONFETTI ? Math.floor(Math.random() * 5) : 0));
    }
  }
  clear() { this.life.fill(0); }
  update(dt: number, g: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = this.kind[i];
      const grav = k === SMOKE ? -0.6 : k === DUST ? -0.2 : k === SPARKLE || k === RING ? 0 : k === CONFETTI ? g * 0.18 : g * 0.9;
      const drag = k === SMOKE || k === DUST ? 0.92 : k === CONFETTI ? 0.96 : 0.99;
      this.vx[i] *= drag; this.vy[i] = this.vy[i] * drag - grav * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += dt * (k === CONFETTI ? 9 : 2);
    }
  }
  draw(c: CanvasRenderingContext2D, x0: number, x1: number) {
    const P = this.palette;
    for (let i = 0; i < this.n; i++) {
      const L = this.life[i];
      if (L <= 0) continue;
      const x = this.x[i];
      if (x < x0 - 2 || x > x1 + 2) continue;
      const t = L / this.max[i], k = this.kind[i], s = this.size[i], y = this.y[i];
      const col = P[this.col[i]] ?? "#FFFFFF";
      switch (k) {
        case DUST: case SMOKE: {
          const rr = s * (1.6 - t * 0.8);
          c.fillStyle = rgba(col, (k === SMOKE ? 0.45 : 0.38) * t);
          c.beginPath(); c.arc(x, y, rr, 0, 6.283); c.fill();
          break;
        }
        case DIRT: c.fillStyle = col; c.globalAlpha = Math.min(1, t * 2); c.fillRect(x - s / 2, y - s / 2, s, s); c.globalAlpha = 1; break;
        case SPARK: {
          c.strokeStyle = rgba(col, t); c.lineWidth = s * 0.6;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - this.vx[i] * 0.03, y - this.vy[i] * 0.03); c.stroke();
          break;
        }
        case SPARKLE: {
          const rr = s * (0.5 + 0.5 * Math.sin(t * Math.PI));
          c.fillStyle = rgba(col, t);
          c.beginPath(); c.moveTo(x, y + rr); c.lineTo(x + rr * 0.25, y + rr * 0.25); c.lineTo(x + rr, y); c.lineTo(x + rr * 0.25, y - rr * 0.25); c.lineTo(x, y - rr); c.lineTo(x - rr * 0.25, y - rr * 0.25); c.lineTo(x - rr, y); c.lineTo(x - rr * 0.25, y + rr * 0.25); c.closePath(); c.fill();
          break;
        }
        case CONFETTI: {
          c.save(); c.translate(x, y); c.rotate(this.rot[i]); c.scale(1, Math.cos(this.rot[i] * 1.7));
          c.fillStyle = rgba(col, Math.min(1, t * 3)); c.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
          c.restore();
          break;
        }
        case RING: {
          c.strokeStyle = rgba(col, t * 0.9); c.lineWidth = s * 0.15 * t + 0.02;
          c.beginPath(); c.arc(x, y, s * (1.6 - t * 1.2), 0, 6.283); c.stroke();
          break;
        }
      }
    }
  }
}

// ------------------------------------------------------------------ weather, in screen space
export class WeatherFx {
  private n: number;
  private x: Float32Array; private y: Float32Array; private s: Float32Array; private p: Float32Array;
  private fogT = 0;
  constructor(public kind: Weather, count: number, public colors: { leaf: string[]; glow: string; haze: string }) {
    const n = kind === "clear" || kind === "breeze" || kind === "meteors" ? 0 : kind === "fog" ? 0 : count;
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.s = new Float32Array(n); this.p = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = Math.random(); this.y[i] = Math.random(); this.s[i] = 0.5 + Math.random(); this.p[i] = Math.random() * 6.28; }
  }
  /** wind: the car's speed (m/s) pushes the weather past; dx = camera move this frame in px */
  draw(c: CanvasRenderingContext2D, W: number, H: number, dt: number, t: number, dxPx: number, dyPx: number) {
    const k = this.kind;
    if (k === "fog" || k === "rain" || k === "snow") {
      // mist banks drifting low
      this.fogT += dt;
      const a = k === "fog" ? 0.5 : 0.18;
      for (let b = 0; b < 3; b++) {
        const y = H * (0.55 + b * 0.12) + Math.sin(this.fogT * 0.3 + b) * 12;
        const g = c.createLinearGradient(0, y - 90, 0, y + 90);
        g.addColorStop(0, rgba(this.colors.haze, 0)); g.addColorStop(0.5, rgba(this.colors.haze, a * (1 - b * 0.25))); g.addColorStop(1, rgba(this.colors.haze, 0));
        c.fillStyle = g; c.fillRect(0, y - 90, W, 180);
      }
    }
    if (!this.n) return;
    const mx = dxPx / W, my = dyPx / H;
    const n = this.n;
    switch (k) {
      case "rain": {
        c.strokeStyle = "rgba(200,220,255,0.55)"; c.lineWidth = 1.4; c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < n; i++) {
          this.y[i] += dt * 1.6 * this.s[i] - my; this.x[i] -= dt * 0.25 + mx;
          if (this.y[i] > 1.05) { this.y[i] = -0.05; this.x[i] = Math.random() * 1.2; }
          if (this.x[i] < -0.05) this.x[i] += 1.1; if (this.x[i] > 1.1) this.x[i] -= 1.15;
          const x = this.x[i] * W, y = this.y[i] * H;
          c.moveTo(x, y); c.lineTo(x - 5 - dxPx * 0.6, y + 18 * this.s[i]);
        }
        c.stroke();
        break;
      }
      case "snow": case "sand": case "spores": case "embers": case "fireflies": case "leaves": case "petals": {
        const sand = k === "sand", up = k === "embers" || k === "spores" || k === "fireflies";
        for (let i = 0; i < n; i++) {
          const sp = this.s[i];
          if (sand) { this.x[i] -= dt * 0.9 * sp + mx; this.y[i] += dt * 0.08 * Math.sin(t + this.p[i]) - my; }
          else if (up) { this.y[i] -= dt * (k === "embers" ? 0.12 : 0.03) * sp + my; this.x[i] += dt * 0.03 * Math.sin(t * 0.8 + this.p[i]) - mx; }
          else { this.y[i] += dt * (k === "snow" ? 0.09 : 0.12) * sp - my; this.x[i] += dt * 0.05 * Math.sin(t + this.p[i]) - dt * 0.06 - mx; }
          if (this.y[i] > 1.05) { this.y[i] = -0.05; this.x[i] = Math.random(); }
          if (this.y[i] < -0.05) { this.y[i] = 1.05; this.x[i] = Math.random(); }
          if (this.x[i] < -0.05) this.x[i] += 1.1; if (this.x[i] > 1.05) this.x[i] -= 1.1;
          const x = this.x[i] * W, y = this.y[i] * H;
          switch (k) {
            case "snow": c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.arc(x, y, 1.6 * sp + 0.6, 0, 6.283); c.fill(); break;
            case "sand": c.fillStyle = "rgba(255,220,160,0.5)"; c.fillRect(x, y, 6 * sp + 2, 1.4); break;
            case "embers": { const a = 0.5 + 0.5 * Math.sin(t * 6 + this.p[i]); c.fillStyle = `rgba(255,${140 + Math.floor(80 * a)},60,${0.55 + 0.4 * a})`; c.beginPath(); c.arc(x, y, 1.6 * sp, 0, 6.283); c.fill(); break; }
            case "fireflies": case "spores": {
              const a = Math.max(0, Math.sin(t * (k === "fireflies" ? 2.2 : 1.2) + this.p[i] * 3));
              const g = this.colors.glow;
              c.fillStyle = rgba(g, 0.25 * a); c.beginPath(); c.arc(x, y, 7 * sp, 0, 6.283); c.fill();
              c.fillStyle = rgba(g, 0.9 * a); c.beginPath(); c.arc(x, y, 1.8 * sp, 0, 6.283); c.fill();
              break;
            }
            default: {
              const cols = this.colors.leaf, col = k === "petals" ? (i % 2 ? "#FFC2D6" : "#FFFFFF") : cols[i % cols.length];
              c.save(); c.translate(x, y); c.rotate(t * 2 * (i % 2 ? 1 : -1) + this.p[i]); c.scale(1, Math.cos(t * 3 + this.p[i]));
              c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, k === "petals" ? 4 * sp : 6 * sp, k === "petals" ? 2.5 * sp : 3 * sp, 0, 0, 6.283); c.fill();
              c.restore();
            }
          }
        }
        break;
      }
    }
  }
}
