// The sky, drawn every frame from sprites painted once per stage: a three-stop gradient, the sun or moon with layered
// glow and slow light rays, soft shaded clouds drifting on two depths, stars that twinkle, the aurora over the frost
// world, Earth over the crater, the cave ceiling, flocks of birds and the odd shooting star.
import type { Look } from "./grade";
import { clamp, makeRng, mix, range, rgba, shade } from "../util";

interface Cloud { x: number; y: number; s: number; v: number; sprite: number; depth: number }

export class Sky {
  private glow: HTMLCanvasElement;
  private rays: HTMLCanvasElement | null = null;
  private stars: HTMLCanvasElement | null = null;
  private aurora: HTMLCanvasElement | null = null;
  private planet: HTMLCanvasElement | null = null;
  private ceiling: HTMLCanvasElement | null = null;
  private cloudSprites: HTMLCanvasElement[] = [];
  private clouds: Cloud[] = [];
  private grad: CanvasGradient | null = null; private gradH = 0;
  private birds: { x: number; y: number; ph: number; s: number }[] = [];
  private shooting = { t: -1, x: 0, y: 0, vx: 0, vy: 0 };

  constructor(public look: Look, seed: number) {
    const r = makeRng(seed);
    const l = look;
    const night = l.time === "night" || !!l.enclosed;
    // sun / moon glow
    this.glow = document.createElement("canvas");
    this.glow.width = this.glow.height = 512;
    const g = this.glow.getContext("2d")!;
    const rg = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    const sc = l.sun;
    if (night && l.enclosed !== "cave") {
      rg.addColorStop(0, rgba("#FFFFFF", 0.9)); rg.addColorStop(0.1, rgba(sc, 0.5)); rg.addColorStop(0.35, rgba(mix(sc, l.sky[1], 0.5), 0.12)); rg.addColorStop(1, rgba(l.sky[1], 0));
    } else {
      rg.addColorStop(0, rgba("#FFFFFF", 1)); rg.addColorStop(0.08, rgba(sc, 0.95)); rg.addColorStop(0.22, rgba(sc, 0.35)); rg.addColorStop(0.55, rgba(mix(sc, l.sky[2], 0.4), 0.12)); rg.addColorStop(1, rgba(l.sky[2], 0));
    }
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    // light rays in warm, low light
    if (!l.enclosed && (l.time === "golden" || l.time === "morning" || l.time === "day")) {
      this.rays = document.createElement("canvas"); this.rays.width = this.rays.height = 1024;
      const q = this.rays.getContext("2d")!;
      q.translate(512, 512);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + r() * 0.2, w = range(r, 0.03, 0.09);
        const lg = q.createRadialGradient(0, 0, 40, 0, 0, 512);
        lg.addColorStop(0, rgba(l.light, 0.22)); lg.addColorStop(1, rgba(l.light, 0));
        q.fillStyle = lg;
        q.beginPath(); q.moveTo(0, 0); q.arc(0, 0, 512, a - w, a + w); q.closePath(); q.fill();
      }
    }
    // stars
    if (l.night > 0.4 || l.enclosed === "space") {
      this.stars = document.createElement("canvas"); this.stars.width = 1024; this.stars.height = 640;
      const q = this.stars.getContext("2d")!;
      const n = l.enclosed === "space" ? 420 : 240;
      for (let k = 0; k < n; k++) {
        const s = Math.pow(r(), 3) * 2.2 + 0.4;
        q.fillStyle = rgba(r() < 0.15 ? "#FFD9B0" : r() < 0.3 ? "#B8D4FF" : "#FFFFFF", range(r, 0.4, 1));
        const sx0 = r() * 1024, sy0 = r() * 640;
        q.beginPath(); q.arc(sx0, sy0, s, 0, Math.PI * 2); q.fill();
        // the brightest stars get a soft cross glint
        if (s > 1.8) { q.fillStyle = rgba("#FFFFFF", 0.3); q.fillRect(sx0 - s * 3, sy0 - 0.5, s * 6, 1); q.fillRect(sx0 - 0.5, sy0 - s * 3, 1, s * 6); }
      }
      if (l.enclosed === "space") {
        // the milky way: a soft diagonal band
        q.save(); q.translate(512, 320); q.rotate(-0.4);
        const mg = q.createLinearGradient(0, -90, 0, 90);
        mg.addColorStop(0, rgba("#8FA4FF", 0)); mg.addColorStop(0.5, rgba("#C8B8FF", 0.16)); mg.addColorStop(1, rgba("#8FA4FF", 0));
        q.fillStyle = mg; q.fillRect(-700, -90, 1400, 180);
        q.restore();
      }
    }
    // aurora ribbons over the frost world at night
    if (l.world.id === "frost" && l.time === "night" || (l.partner?.id === "frost" && l.time === "night")) {
      this.aurora = document.createElement("canvas"); this.aurora.width = 1200; this.aurora.height = 400;
      const q = this.aurora.getContext("2d")!;
      q.globalCompositeOperation = "lighter";
      const cols = ["#5CFFB0", "#62E3FF", "#B57CFF"];
      for (let band = 0; band < 3; band++) {
        const ph = r() * 6, amp = range(r, 30, 70), base = 120 + band * 50;
        for (let x = 0; x < 1200; x += 3) {
          const y = base + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.017 + ph * 2) * amp * 0.3;
          const hgt = 90 + Math.sin(x * 0.011 + ph) * 40;
          const ag = q.createLinearGradient(0, y - hgt, 0, y + 20);
          ag.addColorStop(0, rgba(cols[(band + 1) % 3], 0)); ag.addColorStop(0.7, rgba(cols[band], 0.12)); ag.addColorStop(1, rgba(cols[band], 0));
          q.fillStyle = ag; q.fillRect(x, y - hgt, 3, hgt + 20);
        }
      }
    }
    // a planet over the crater
    if (l.enclosed === "space") {
      this.planet = document.createElement("canvas"); this.planet.width = this.planet.height = 260;
      const q = this.planet.getContext("2d")!;
      const pg = q.createRadialGradient(130, 130, 60, 130, 130, 130);
      pg.addColorStop(0, rgba("#7FB8FF", 0.4)); pg.addColorStop(1, rgba("#7FB8FF", 0));
      q.fillStyle = pg; q.fillRect(0, 0, 260, 260);
      q.save(); q.beginPath(); q.arc(130, 130, 62, 0, Math.PI * 2); q.clip();
      const og = q.createLinearGradient(70, 70, 190, 190);
      og.addColorStop(0, "#5FA8FF"); og.addColorStop(1, "#1C3E8A");
      q.fillStyle = og; q.fillRect(60, 60, 140, 140);
      q.fillStyle = "#4FBF7A";
      for (let k = 0; k < 7; k++) { q.beginPath(); q.ellipse(range(r, 80, 180), range(r, 80, 180), range(r, 10, 26), range(r, 6, 16), r() * 3, 0, Math.PI * 2); q.fill(); }
      q.fillStyle = rgba("#FFFFFF", 0.55);
      for (let k = 0; k < 6; k++) { q.beginPath(); q.ellipse(range(r, 75, 185), range(r, 75, 185), range(r, 12, 30), range(r, 3, 6), range(r, -0.3, 0.3), 0, Math.PI * 2); q.fill(); }
      // night side
      const ng = q.createLinearGradient(80, 60, 190, 190);
      ng.addColorStop(0.45, rgba("#000010", 0)); ng.addColorStop(1, rgba("#000010", 0.85));
      q.fillStyle = ng; q.fillRect(60, 60, 140, 140);
      q.restore();
    }
    // the cave ceiling
    if (l.enclosed === "cave") {
      this.ceiling = document.createElement("canvas"); this.ceiling.width = 1600; this.ceiling.height = 260;
      const q = this.ceiling.getContext("2d")!;
      const col = shade(l.ridges[2], -0.2);
      q.fillStyle = col;
      q.beginPath(); q.moveTo(0, 0);
      for (let x = 0; x <= 1600; x += 4) q.lineTo(x, 40 + Math.sin(x * 0.01) * 14 + Math.sin(x * 0.037) * 8);
      q.lineTo(1600, 0); q.closePath(); q.fill();
      for (let x = 10; x < 1590; x += range(r, 20, 60)) {
        const h = range(r, 40, 190), w = h * range(r, 0.12, 0.22);
        const sg = q.createLinearGradient(0, 0, 0, h + 50);
        sg.addColorStop(0, col); sg.addColorStop(1, shade(col, 0.15));
        q.fillStyle = sg;
        q.beginPath(); q.moveTo(x - w, 30); q.quadraticCurveTo(x - w * 0.3, h * 0.6, x, h + 40); q.quadraticCurveTo(x + w * 0.3, h * 0.6, x + w, 30); q.closePath(); q.fill();
        if (r() < 0.3) { q.shadowColor = l.glow; q.shadowBlur = 12; q.fillStyle = rgba(l.glow, 0.8); q.beginPath(); q.arc(x, h + 40, 3, 0, Math.PI * 2); q.fill(); q.shadowBlur = 0; }
      }
    }
    // clouds
    if (!l.enclosed) {
      const cl = mix("#FFFFFF", l.sky[2], 0.25 + l.night * 0.35), sh = mix(l.sky[1], "#3A3F66", 0.25 + l.night * 0.3);
      const lit = l.time === "golden" || l.time === "dusk" ? mix(l.light, "#FFFFFF", 0.3) : "#FFFFFF";
      for (let k = 0; k < 4; k++) this.cloudSprites.push(paintCloud(r, cl, sh, lit, l.night));
      const many = l.weather === "rain" || l.weather === "fog" ? 12 : l.weather === "clear" ? 6 : 8;
      for (let k = 0; k < many; k++) this.clouds.push({ x: r() * 2000, y: range(r, 0.05, 0.42), s: range(r, 0.55, 1.25), v: range(r, 4, 12), sprite: k % 4, depth: r() < 0.5 ? 0 : 1 });
    }
    if (!l.enclosed && l.night < 0.8) for (let k = 0; k < 6; k++) this.birds.push({ x: range(r, 0, 600), y: range(r, 0.15, 0.32), ph: r() * 6, s: range(r, 0.7, 1.1) });
  }

  /** camX/camY in metres (for a touch of parallax), t in seconds */
  draw(c: CanvasRenderingContext2D, W: number, H: number, camX: number, camY: number, t: number) {
    const l = this.look;
    if (!this.grad || this.gradH !== H) {
      this.gradH = H;
      this.grad = c.createLinearGradient(0, 0, 0, H);
      this.grad.addColorStop(0, l.sky[0]); this.grad.addColorStop(0.55, l.sky[1]); this.grad.addColorStop(1, l.sky[2]);
    }
    c.fillStyle = this.grad; c.fillRect(0, 0, W, H);
    const S = Math.max(W, H);
    if (this.stars) {
      c.globalAlpha = (l.enclosed === "space" ? 1 : clamp(l.night, 0, 1)) * (0.85 + 0.15 * Math.sin(t * 1.7));
      const ox = -((camX * 0.6) % 1024), sx = 1024 * (S / 1024 > 1 ? S / 1024 : 1);
      for (let x = ox - 1024; x < W; x += sx) c.drawImage(this.stars, x, 0, sx, H * 0.85);
      c.globalAlpha = 1;
    }
    if (this.aurora) {
      c.globalCompositeOperation = "lighter";
      const ox = -((camX * 0.8 + t * 6) % 1200);
      c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.6);
      for (let x = ox - 1200; x < W; x += 1200) c.drawImage(this.aurora, x, H * 0.02 + Math.sin(t * 0.4) * 8, 1200, H * 0.5);
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    }
    // sun / moon
    if (l.enclosed !== "cave") {
      const sx = W * l.sunX, sy = H * (0.82 - l.sunY * 0.72) + camY * 0.4;
      const gs = S * (l.time === "golden" || l.time === "dusk" ? 1.1 : 0.8);
      if (this.rays) {
        c.save(); c.translate(sx, sy); c.rotate(t * 0.02);
        c.globalAlpha = l.time === "day" ? 0.35 : 0.7;
        c.drawImage(this.rays, -gs, -gs, gs * 2, gs * 2);
        c.restore(); c.globalAlpha = 1;
      }
      c.drawImage(this.glow, sx - gs / 2, sy - gs / 2, gs, gs);
      const disk = Math.max(18, S * 0.035);
      c.fillStyle = l.time === "night" || l.enclosed ? "#F6F3FF" : mix(l.sun, "#FFFFFF", 0.5);
      c.beginPath(); c.arc(sx, sy, disk, 0, Math.PI * 2); c.fill();
      if (l.time === "night" && !l.enclosed) {
        // a crescent: the sky takes a bite out of the moon
        c.fillStyle = l.sky[1]; c.globalAlpha = 0.92;
        c.beginPath(); c.arc(sx + disk * 0.42, sy - disk * 0.18, disk * 0.92, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      }
      if (this.planet) { const ps = S * 0.26; c.drawImage(this.planet, W * 0.22 - ps / 2, H * 0.2 - ps / 2 + camY * 0.3, ps, ps); }
    }
    // shooting stars at night
    if (l.night > 0.6 || l.enclosed === "space") {
      const s = this.shooting;
      if (s.t < 0 && Math.random() < 0.004) { s.t = 0; s.x = Math.random() * W; s.y = Math.random() * H * 0.3; s.vx = -(300 + Math.random() * 300); s.vy = 140 + Math.random() * 80; }
      if (s.t >= 0) {
        s.t += 1 / 60; const x = s.x + s.vx * s.t, y = s.y + s.vy * s.t;
        const lg = c.createLinearGradient(x, y, x - s.vx * 0.12, y - s.vy * 0.12);
        lg.addColorStop(0, rgba("#FFFFFF", 0.9)); lg.addColorStop(1, rgba("#FFFFFF", 0));
        c.strokeStyle = lg; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - s.vx * 0.12, y - s.vy * 0.12); c.stroke();
        if (s.t > 0.9) s.t = -1;
      }
    }
    // clouds (two depths)
    for (const cl of this.clouds) {
      const sp = this.cloudSprites[cl.sprite];
      const w = S * 0.32 * cl.s, h = w * (sp.height / sp.width);
      const span = W + w * 2;
      const x = ((cl.x - camX * (cl.depth ? 4 : 2) - t * cl.v) % span + span) % span - w;
      c.globalAlpha = cl.depth ? 0.95 : 0.75;
      c.drawImage(sp, x, H * cl.y + camY * (cl.depth ? 0.5 : 0.25), w, h);
    }
    c.globalAlpha = 1;
    // birds
    if (this.birds.length) {
      c.strokeStyle = rgba(shade(l.sky[0], -0.55), 0.75); c.lineWidth = 2; c.lineCap = "round";
      for (const b of this.birds) {
        const x = ((b.x + t * 24 - camX * 3) % (W + 200) + W + 200) % (W + 200) - 100, y = H * b.y + Math.sin(t * 0.7 + b.ph) * 10;
        const f = Math.sin(t * 9 + b.ph) * 5 * b.s, w = 9 * b.s;
        c.beginPath(); c.moveTo(x - w, y - f); c.quadraticCurveTo(x - w * 0.4, y - f * 0.2 - 2, x, y); c.quadraticCurveTo(x + w * 0.4, y - f * 0.2 - 2, x + w, y - f); c.stroke();
      }
    }
    if (this.ceiling) {
      const w = 1600 * (H / 700), ox = -((camX * 12) % w);
      for (let x = ox - w; x < W; x += w) c.drawImage(this.ceiling, x, 0, w, 260 * (H / 700));
    }
  }
}

/** one soft cloud: puffs lit from above, shaded underneath, with a gentle rim */
function paintCloud(r: () => number, body: string, shadeCol: string, lit: string, night: number) {
  const cv = document.createElement("canvas"); cv.width = 420; cv.height = 180;
  const c = cv.getContext("2d")!;
  const puffs: [number, number, number][] = [];
  const n = 5 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) puffs.push([70 + (k / (n - 1)) * 280 + (r() - 0.5) * 30, 110 - Math.sin((k / (n - 1)) * Math.PI) * (40 + r() * 30), 34 + r() * 34]);
  // one silhouette: the puffs and a flat base
  c.fillStyle = "#FFFFFF";
  for (const [x, y, rr] of puffs) { c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.ellipse(210, 128, 165, 30, 0, 0, Math.PI * 2); c.fill();
  // coloured top to bottom: sunlit crowns, soft body, a shaded belly
  c.globalCompositeOperation = "source-in";
  const g = c.createLinearGradient(0, 20, 0, 165);
  g.addColorStop(0, lit); g.addColorStop(0.45, body); g.addColorStop(1, mix(body, shadeCol, 0.6));
  c.fillStyle = g; c.fillRect(0, 0, 420, 180);
  // a soft glow on each puff's sunny top
  c.globalCompositeOperation = "source-atop";
  for (const [x, y, rr] of puffs) {
    const hg = c.createRadialGradient(x - rr * 0.15, y - rr * 0.55, 0, x - rr * 0.15, y - rr * 0.55, rr * 0.95);
    hg.addColorStop(0, rgba(lit, 0.55)); hg.addColorStop(1, rgba(lit, 0));
    c.fillStyle = hg; c.fillRect(x - rr * 1.2, y - rr * 1.6, rr * 2.4, rr * 2.2);
  }
  if (night > 0.6) { c.fillStyle = rgba("#1B2350", 0.35); c.fillRect(0, 0, 420, 180); }
  return cv;
}
