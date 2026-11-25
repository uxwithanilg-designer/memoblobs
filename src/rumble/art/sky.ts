// The sky behind everything: a graded gradient, the sun (or the moon) with a soft halo, drifting clouds painted once per
// stage into sprites (fluffy cumulus, long bayou haze, red-lit smoke over the volcano), twinkling stars at night, an
// aurora over the snow on clear nights, god rays through the pine woods, and the planets and nebulae over the moon.
// Everything costly is painted once per stage; a frame only draws images.
import type { Look } from "./grade";
import { clamp, makeRng, mix, range, rgba, shade, type Rng } from "../util";

interface Cloud { cv: HTMLCanvasElement; x: number; y: number; s: number; speed: number; depth: number }

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/** a soft radial glow sprite */
export function glowSprite(color: string, size: number, core = 0.12, strength = 1) {
  const cv = canvas(size, size), c = cv.getContext("2d")!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, strength)); g.addColorStop(core, rgba(color, 0.55 * strength)); g.addColorStop(0.45, rgba(color, 0.14 * strength)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  return cv;
}

function cumulus(r: Rng, w: number, h: number, base: string, shadow: string, rim: string, flat = false) {
  const cv = canvas(w, h), c = cv.getContext("2d")!;
  const puffs: [number, number, number][] = [];
  const n = flat ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const pr = (flat ? h * 0.22 : h * (0.2 + 0.2 * Math.sin(u * Math.PI))) * range(r, 0.8, 1.2);
    puffs.push([w * (0.12 + 0.76 * u) + range(r, -8, 8), h * (flat ? 0.6 : 0.72) - pr * (flat ? 0.3 : 0.55) + range(r, -4, 4), pr]);
  }
  // shadow body, then the lit body offset up, then a rim of light
  c.fillStyle = shadow;
  for (const [x, y, pr] of puffs) { c.beginPath(); c.arc(x, y + pr * 0.12, pr, 0, Math.PI * 2); c.fill(); }
  c.fillRect(w * 0.12, h * (flat ? 0.6 : 0.72) - 2, w * 0.76, h * 0.12);
  c.fillStyle = base;
  for (const [x, y, pr] of puffs) { c.beginPath(); c.arc(x, y - pr * 0.1, pr * 0.92, 0, Math.PI * 2); c.fill(); }
  c.globalCompositeOperation = "source-atop";
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(rim, 0.65)); g.addColorStop(0.45, rgba(rim, 0)); g.addColorStop(0.8, rgba(shadow, 0)); g.addColorStop(1, rgba(shadow, 0.7));
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "source-over";
  return cv;
}

export class Sky {
  private grad: HTMLCanvasElement;
  private halo: HTMLCanvasElement;
  private bigHalo: HTMLCanvasElement;
  private clouds: Cloud[] = [];
  private stars: Float32Array;
  private planets: HTMLCanvasElement | null = null;
  private aurora: HTMLCanvasElement | null = null;
  private rays: HTMLCanvasElement | null = null;
  private plume: HTMLCanvasElement | null = null;
  private airship: HTMLCanvasElement | null = null;
  private lightning = false;
  /** a lightning flash (0..1), for the scene to brighten with */
  flash = 0;
  private boltT = 2;
  constructor(private look: Look, seed: number) {
    const l = look, r = makeRng(seed * 3 + 9);
    // the gradient, painted tall so the camera's vertical drift has room
    this.grad = canvas(4, 512);
    const gc = this.grad.getContext("2d")!;
    const g = gc.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, shade(l.sky[0], -0.08)); g.addColorStop(0.3, l.sky[0]); g.addColorStop(0.62, l.sky[1]); g.addColorStop(0.86, l.sky[2]); g.addColorStop(1, mix(l.sky[2], l.haze, 0.5));
    gc.fillStyle = g; gc.fillRect(0, 0, 4, 512);
    const warm = l.time === "golden" || l.time === "dusk" || l.time === "morning";
    this.halo = glowSprite(l.sun, 256, 0.16, l.night > 0.6 ? 0.55 : 0.9);
    this.bigHalo = glowSprite(warm ? mix(l.sun, "#FF9A5A", 0.5) : l.sun, 512, 0.05, warm ? 0.6 : 0.35);
    // stars
    const ns = 160;
    this.stars = new Float32Array(ns * 4);
    for (let i = 0; i < ns; i++) { this.stars[i * 4] = r(); this.stars[i * 4 + 1] = Math.pow(r(), 1.6) * 0.75; this.stars[i * 4 + 2] = 0.4 + r() * 1.4; this.stars[i * 4 + 3] = r() * 6.28; }
    // clouds
    const id = l.world.id;
    const night = l.night;
    const base = mix(mix("#FFFFFF", l.sky[2], 0.15), l.sky[0], night * 0.55);
    const shadowC = mix(mix(l.sky[1], "#8E9AB8", 0.45), l.sky[0], 0.2 + night * 0.3);
    const rim = l.time === "golden" || l.time === "dusk" ? mix(l.sun, "#FF8A5A", 0.35) : mix("#FFFFFF", l.sun, 0.3);
    if (!l.space || id === "mars") {
      const n = id === "cinder" ? 5 : l.weather === "fog" ? 3 : 6 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const depth = r();
        const w = (id === "thunder" ? 520 : 300) * range(r, 0.7, 1.3) * (0.6 + depth * 0.6);
        const h = w * (id === "thunder" ? 0.3 : 0.42);
        const cv = id === "cinder" || id === "thunder"
          ? cumulus(r, w, h, mix(id === "cinder" ? "#5A3A44" : "#4A5268", l.sky[1], 0.25), id === "cinder" ? "#2A1C26" : "#262C3E", id === "cinder" ? "#FF8A4A" : "#B8C8E8")
          : cumulus(r, w, h, base, shadowC, rim, id === "cloud");
        this.clouds.push({ cv, x: r() * 2400, y: range(r, 0.05, 0.42), s: 1, speed: range(r, 3, 9) * (0.5 + depth), depth: 0.02 + depth * 0.05 });
      }
      this.clouds.sort((a, b) => a.depth - b.depth);
    }
    if (l.space) this.planets = this.paintPlanets(r);
    if (id === "cloud" || l.partner?.id === "cloud") this.airship = this.paintAirship();
    if ((id === "polar" || l.partner?.id === "polar") && night > 0.4) this.aurora = this.paintAurora(r, ["#5CFFB0", "#5CC8FF", "#C38BFF"]);
    if (id === "harbor") this.aurora = this.paintAurora(r, ["#FF4FD8", "#5BF0FF", "#7A5CFF"]);
    if ((id === "canopy" || id === "dunes" || id === "goldmine" || id === "cloud") && (l.time === "morning" || l.time === "golden") && l.weather !== "rain") this.rays = this.paintRays(rim);
    this.lightning = id === "thunder" || l.partner?.id === "thunder";
    if (id === "cinder" || l.partner?.id === "cinder") this.plume = cumulus(r, 420, 260, "#3E2A32", "#1E141A", "#FF7A3A");
  }

  private paintAirship() {
    const W = 360, H = 200, cv = canvas(W, H), c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 30, 0, 120); g.addColorStop(0, "#F2E2C8"); g.addColorStop(1, "#B8946A");
    c.fillStyle = g; c.beginPath(); c.ellipse(180, 75, 150, 48, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(120,80,40,0.45)"; c.lineWidth = 3; for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(180, 75, 150, 48 - Math.abs(k) * 14, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = "#D8302A"; c.beginPath(); c.moveTo(32, 75); c.lineTo(4, 40); c.lineTo(10, 75); c.lineTo(4, 110); c.closePath(); c.fill();
    c.strokeStyle = "#5A3A22"; c.lineWidth = 3; c.beginPath(); c.moveTo(130, 118); c.lineTo(150, 150); c.moveTo(230, 118); c.lineTo(210, 150); c.stroke();
    c.fillStyle = "#7A4A2A"; c.fillRect(140, 148, 80, 26); c.fillStyle = "#FFE08A"; for (let k = 0; k < 4; k++) c.fillRect(148 + k * 18, 155, 10, 9);
    return cv;
  }

  private paintPlanets(r: Rng) {
    const W = 900, H = 500, cv = canvas(W, H), c = cv.getContext("2d")!;
    // a nebula wash
    for (let i = 0; i < 6; i++) {
      const x = range(r, 0, W), y = range(r, 0, H * 0.7), rr = range(r, 120, 260);
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      const col = ["#7B5CFF", "#FF5FB0", "#2EC4FF"][i % 3];
      g.addColorStop(0, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    // a ringed giant
    const px = W * 0.7, py = H * 0.36, pr = 74;
    c.save(); c.translate(px, py); c.rotate(-0.35);
    c.strokeStyle = "rgba(255,214,170,0.55)"; c.lineWidth = 9; c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, Math.PI * 2); c.stroke();
    c.restore();
    const pg = c.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
    pg.addColorStop(0, "#FFD8A8"); pg.addColorStop(0.5, "#E8955E"); pg.addColorStop(1, "#7A3E52");
    c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.clip();
    for (let i = 0; i < 6; i++) { c.fillStyle = rgba(i % 2 ? "#FFE8C8" : "#A8503E", 0.22); c.fillRect(px - pr, py - pr + i * 26 + 8, pr * 2, 9); }
    c.fillStyle = "rgba(10,8,30,0.45)"; c.beginPath(); c.arc(px + pr * 0.45, py + pr * 0.35, pr * 1.05, 0, Math.PI * 2); c.fill();
    c.restore();
    c.save(); c.translate(px, py); c.rotate(-0.35);
    c.strokeStyle = "rgba(255,226,190,0.75)"; c.lineWidth = 7; c.beginPath(); c.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI); c.stroke();
    c.restore();
    // a small blue world and its moon
    const bx = W * 0.2, by = H * 0.2, br = 30;
    const bg = c.createRadialGradient(bx - 10, by - 10, 2, bx, by, br);
    bg.addColorStop(0, "#BFEFFF"); bg.addColorStop(0.6, "#3A8EE8"); bg.addColorStop(1, "#1A3A8A");
    c.fillStyle = bg; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(120,230,160,0.7)"; c.beginPath(); c.ellipse(bx - 6, by + 4, 12, 7, 0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#D9D6EE"; c.beginPath(); c.arc(bx + 52, by - 18, 8, 0, Math.PI * 2); c.fill();
    return cv;
  }

  private paintAurora(r: Rng, cols: string[]) {
    const W = 1200, H = 360, cv = canvas(W, H), c = cv.getContext("2d")!;
    for (let band = 0; band < 3; band++) {
      const col = cols[band % cols.length];
      const a0 = r() * 6, f1 = 1 + Math.floor(r() * 3), f2 = 3 + Math.floor(r() * 3);
      for (let x = 0; x < W; x += 3) {
        const u = x / W;
        const y = H * (0.35 + 0.12 * band) + Math.sin(u * Math.PI * 2 * f1 + a0) * 40 + Math.sin(u * Math.PI * 2 * f2 + a0 * 2) * 14;
        const hgt = 90 + 60 * Math.sin(u * Math.PI * 2 * f2 + band);
        const g = c.createLinearGradient(0, y - hgt, 0, y + 10);
        g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.7, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.fillRect(x, y - hgt, 3, hgt + 10);
      }
    }
    return cv;
  }

  private paintRays(col: string) {
    const W = 900, H = 700, cv = canvas(W, H), c = cv.getContext("2d")!;
    for (let i = 0; i < 7; i++) {
      const x = 80 + i * 120 + Math.sin(i * 2.3) * 40, w = 30 + (i % 3) * 26;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w + 260, H); c.lineTo(x + 260, H); c.closePath(); c.fill();
    }
    return cv;
  }

  /** shiftY: how far the camera has climbed (px) — the sky slides a little */
  draw(c: CanvasRenderingContext2D, W: number, H: number, camX: number, shiftY: number, t: number) {
    const l = this.look;
    const gy = clamp(shiftY * 0.3, -H * 0.2, H * 0.4);
    c.drawImage(this.grad, 0, 0, 4, 512, 0, -H * 0.25 + gy, W, H * 1.45);
    if (gy > -H * 0.25) { c.fillStyle = shade(l.sky[0], -0.08); c.fillRect(0, 0, W, -H * 0.25 + gy + 1); }
    const S = Math.max(W, H);
    // stars
    const starA = l.space ? 1 : l.night;
    if (starA > 0.05) {
      c.fillStyle = "#FFFFFF";
      const st = this.stars;
      for (let i = 0; i < st.length; i += 4) {
        const tw = 0.55 + 0.45 * Math.sin(t * 2 + st[i + 3]);
        c.globalAlpha = starA * tw * 0.9;
        const x = ((st[i] * W * 1.3 - camX * 0.4) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        const s = st[i + 2] * (S / 900);
        c.fillRect(x, st[i + 1] * H + gy * 0.5, s, s);
      }
      c.globalAlpha = 1;
    }
    if (this.planets) c.drawImage(this.planets, W * 0.5 - S * 0.55 - ((camX * 0.25) % 40), H * 0.16 - S * 0.22 + gy * 0.4, S * 1.1, S * 0.61);
    if (this.aurora) {
      c.globalAlpha = 0.55 + 0.25 * Math.sin(t * 0.4);
      const aw = S * 1.4;
      const ax = -((camX * 0.6) % aw + aw) % aw;
      for (let x = ax; x < W; x += aw) c.drawImage(this.aurora, x, H * -0.02 + gy * 0.4, aw, aw * 0.3);
      c.globalAlpha = 1;
    }
    // the sun or the moon
    const sx = W * l.sunX, sy = H * (0.82 - l.sunY * 0.7) + gy * 0.5;
    const sr = S * (l.space ? 0.025 : 0.04);
    c.drawImage(this.bigHalo, sx - S * 0.7, sy - S * 0.7, S * 1.4, S * 1.4);
    c.drawImage(this.halo, sx - sr * 7, sy - sr * 7, sr * 14, sr * 14);
    c.fillStyle = l.sun; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    if (l.night > 0.6 && !l.space) {
      // the moon's seas
      c.fillStyle = "rgba(150,160,200,0.35)";
      c.beginPath(); c.arc(sx - sr * 0.3, sy - sr * 0.2, sr * 0.28, 0, Math.PI * 2); c.arc(sx + sr * 0.35, sy + sr * 0.25, sr * 0.2, 0, Math.PI * 2); c.arc(sx + sr * 0.1, sy - sr * 0.5, sr * 0.13, 0, Math.PI * 2); c.fill();
    }
    if (this.rays) { c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.3); c.drawImage(this.rays, sx - S * 0.35, sy - S * 0.1, S * 0.9, S * 0.75); c.globalAlpha = 1; }
    if (this.lightning) {
      this.boltT -= 1 / 60;
      if (this.boltT <= 0) { this.boltT = 3 + ((t * 7919) % 5); this.flash = 1; }
      this.flash = Math.max(0, this.flash - 1 / 25);
      if (this.flash > 0.4) {
        const bx = W * (0.2 + ((t * 13.7) % 0.6)), seg = H * 0.06;
        c.strokeStyle = `rgba(230,240,255,${this.flash})`; c.lineWidth = 3; c.beginPath(); c.moveTo(bx, 0);
        let px = bx;
        for (let k = 1; k < 9; k++) { px += Math.sin(t * 40 + k * 2.3) * seg * 0.8; c.lineTo(px, k * seg); }
        c.stroke();
      }
    }
    if (this.airship) {
      const span = W * 2.4, ax = ((t * 14 - camX * 4) % span + span) % span - W * 0.3, aw = S * 0.22;
      c.drawImage(this.airship, ax, H * 0.16 + Math.sin(t * 0.5) * 8 + gy * 0.5, aw, aw * 0.55);
    }
    if (this.plume) {
      const px = W * 0.3 - ((camX * 0.5) % (W * 1.6) + W * 1.6) % (W * 1.6) + W * 0.8;
      c.globalAlpha = 0.85; c.drawImage(this.plume, px - S * 0.3, H * 0.02 + gy * 0.5 + Math.sin(t * 0.2) * 6, S * 0.6, S * 0.37); c.globalAlpha = 1;
    }
    // clouds drift on their own and with the camera
    const span = W * 2.2;
    for (const cl of this.clouds) {
      const w = cl.cv.width * (S / 1100), h = cl.cv.height * (S / 1100);
      const x = ((cl.x + t * cl.speed - camX * cl.depth * 30) % span + span) % span - w * 0.6;
      c.drawImage(cl.cv, x - W * 0.3, cl.y * H + gy * 0.6, w, h);
    }
  }
}
