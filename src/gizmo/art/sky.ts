// The sky and the life in it, drawn every frame from sprites painted once per stage: a three-stop gradient, the sun
// or moon with layered glow (a striped synth sun over the Neon Grid, a cratered moon over the carnival, a planet in
// orbit), twinkling stars at night, the aurora over the Glacier Lab, a nebula in space, light shafts swaying under the
// sea, soft clouds drifting on two depths — and each world's own moving things: paper planes and balloons over the
// toybox, candy balloons, birds, hot-air balloons and an airship over the islands, light trails over the neon city,
// crows over the scrapyard, fish and a whale in the deep, a zeppelin and turning brass gears, bats and a turning Ferris
// wheel at the carnival, satellites and shooting stars in orbit. No allocation per frame.
import type { Look } from "./look";
import { makeRng, mix, rgba, shade } from "../util";

const TAU = Math.PI * 2;
type C = CanvasRenderingContext2D;

interface Cloud { x: number; y: number; s: number; v: number; sprite: number; depth: number }
interface Actor { kind: number; x: number; y: number; v: number; s: number; ph: number; depth: number }

function sprite(w: number, h: number, paint: (c: C) => void) {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  paint(cv.getContext("2d")!);
  return cv;
}

export class Sky {
  private glow: HTMLCanvasElement;
  private stars: HTMLCanvasElement | null = null;
  private body: HTMLCanvasElement | null = null;
  private extra: HTMLCanvasElement | null = null;
  private cloudSprites: HTMLCanvasElement[] = [];
  private clouds: Cloud[] = [];
  private actors: Actor[] = [];
  private actorSprites: HTMLCanvasElement[] = [];
  private grad: CanvasGradient | null = null; private gradH = 0;
  private shoot = { t: -1, x: 0, y: 0, vx: 0, vy: 0 };
  private id: string;

  constructor(public L: Look) {
    const r = makeRng(L.seed * 7 + 3);
    const id = (this.id = L.world.id);
    const night = L.night;
    const sun = L.mood.sun;
    // sun / moon glow
    this.glow = sprite(512, 512, (g) => {
      const rg = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      if (night > 0.5) { rg.addColorStop(0, rgba("#FFFFFF", 0.8)); rg.addColorStop(0.1, rgba(sun, 0.45)); rg.addColorStop(0.4, rgba(sun, 0.1)); rg.addColorStop(1, rgba(sun, 0)); }
      else { rg.addColorStop(0, rgba("#FFFFFF", 1)); rg.addColorStop(0.09, rgba(sun, 0.95)); rg.addColorStop(0.22, rgba(sun, 0.35)); rg.addColorStop(0.6, rgba(sun, 0.08)); rg.addColorStop(1, rgba(sun, 0)); }
      g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    });
    // the sun or moon itself
    if (id === "neon") {
      this.body = sprite(260, 260, (g) => {
        const lg = g.createLinearGradient(0, 0, 0, 260); lg.addColorStop(0, "#FFE36B"); lg.addColorStop(0.55, "#FF7A59"); lg.addColorStop(1, "#FF2E9A");
        g.fillStyle = lg; g.beginPath(); g.arc(130, 130, 124, 0, TAU); g.fill();
        g.globalCompositeOperation = "destination-out";
        for (let k = 0; k < 7; k++) { const y = 140 + k * 16, h = 3 + k * 1.6; g.fillRect(0, y, 260, h); }
      });
    } else if (night > 0.5 && id !== "coral") {
      this.body = sprite(200, 200, (g) => {
        const big = id === "haunted";
        const rad = big ? 92 : 60;
        const rg = g.createRadialGradient(100 - rad * 0.3, 100 - rad * 0.3, 2, 100, 100, rad);
        rg.addColorStop(0, "#FFFFFF"); rg.addColorStop(1, mix(sun, "#C8C8D8", 0.3));
        g.fillStyle = rg; g.beginPath(); g.arc(100, 100, rad, 0, TAU); g.fill();
        g.fillStyle = rgba("#8890A8", 0.22);
        for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(100 + (r() - 0.5) * rad * 1.2, 100 + (r() - 0.5) * rad * 1.2, rad * (0.08 + r() * 0.14), 0, TAU); g.fill(); }
      });
    }
    if (night > 0.3 || id === "orbit") {
      this.stars = sprite(1024, 512, (g) => {
        for (let i = 0; i < 260; i++) {
          const x = r() * 1024, y = r() * 512, s = r() < 0.08 ? 1.8 : 0.8 + r() * 0.6;
          g.fillStyle = rgba(r() < 0.2 ? "#CFE3FF" : "#FFFFFF", 0.35 + r() * 0.6); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
        }
      });
    }
    // the world's own sky feature
    if (id === "orbit") {
      this.extra = sprite(640, 640, (g) => {
        const rg = g.createRadialGradient(250, 250, 10, 320, 320, 300);
        rg.addColorStop(0, "#9FD3FF"); rg.addColorStop(0.5, "#2F6FD6"); rg.addColorStop(1, "#0B2A6B");
        g.fillStyle = rg; g.beginPath(); g.arc(320, 320, 300, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(320, 320, 300, 0, TAU); g.clip();
        g.fillStyle = rgba("#5FBF6A", 0.75);
        for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(150 + r() * 340, 150 + r() * 340, 40 + r() * 70, 24 + r() * 40, r() * 3, 0, TAU); g.fill(); }
        g.fillStyle = rgba("#FFFFFF", 0.5);
        for (let k = 0; k < 12; k++) { g.beginPath(); g.ellipse(100 + r() * 440, 100 + r() * 440, 50 + r() * 60, 8 + r() * 10, r() * 0.6 - 0.3, 0, TAU); g.fill(); }
        const sh = g.createRadialGradient(470, 470, 60, 400, 400, 420); sh.addColorStop(0, rgba("#000010", 0.85)); sh.addColorStop(0.5, rgba("#000010", 0.3)); sh.addColorStop(1, rgba("#000010", 0));
        g.fillStyle = sh; g.fillRect(0, 0, 640, 640); g.restore();
        g.strokeStyle = rgba("#9FD3FF", 0.5); g.lineWidth = 10; g.beginPath(); g.arc(320, 320, 304, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
      });
    } else if (id === "glacier" || (id === "shroom" && night > 0.5)) {
      this.extra = sprite(1024, 300, (g) => {
        for (let band = 0; band < 3; band++) {
          const col = ["#3DF5C2", "#7C8CFF", "#3DE8F5"][band];
          for (let x = 0; x < 1024; x += 3) {
            const top = 60 + band * 30 + Math.sin(x * 0.012 + band) * 40 + Math.sin(x * 0.031) * 14;
            const lg = g.createLinearGradient(0, top, 0, top + 170);
            lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(0.25, rgba(col, 0.22)); lg.addColorStop(1, rgba(col, 0));
            g.fillStyle = lg; g.fillRect(x, top, 3, 170);
          }
        }
      });
    } else if (id === "coral") {
      this.extra = sprite(200, 800, (g) => {
        const lg = g.createLinearGradient(0, 0, 0, 800); lg.addColorStop(0, rgba("#E6FFFF", 0.4)); lg.addColorStop(1, rgba("#E6FFFF", 0));
        g.fillStyle = lg; g.beginPath(); g.moveTo(60, 0); g.lineTo(140, 0); g.lineTo(200, 800); g.lineTo(0, 800); g.fill();
      });
    }
    // clouds: soft clusters painted once, two depths
    const cloudy = id !== "orbit" && id !== "coral";
    if (cloudy) {
      const cc = id === "candy" ? ["#FFD6EC", "#CDEBFF"] : id === "scrapyard" ? [mix(L.haze, "#8A7A70", 0.3)] : id === "neon" ? ["#5A2A7A"] : ["#FFFFFF"];
      for (let k = 0; k < 4; k++) {
        const col = mix(cc[k % cc.length], L.sky[1], 0.2 + night * 0.55);
        this.cloudSprites.push(sprite(360, 160, (g) => {
          const n = 6 + Math.floor(r() * 4);
          for (let i = 0; i < n; i++) {
            const x = 60 + (i / n) * 240 + r() * 20, y = 110 - Math.sin((i / (n - 1)) * Math.PI) * 50 - r() * 10, rad = 30 + Math.sin((i / (n - 1)) * Math.PI) * 26 + r() * 8;
            const rg = g.createRadialGradient(x - rad * 0.3, y - rad * 0.4, 2, x, y, rad);
            rg.addColorStop(0, mix(col, "#FFFFFF", 0.4 * (1 - night))); rg.addColorStop(0.7, col); rg.addColorStop(1, shade(col, -0.08));
            g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
          }
          g.fillStyle = shade(col, -0.06); g.fillRect(40, 110, 280, 6);
        }));
      }
      for (let i = 0; i < 9; i++) this.clouds.push({ x: r() * 2400, y: 0.06 + r() * 0.34, s: 0.5 + r() * 0.8, v: 4 + r() * 10, sprite: Math.floor(r() * 4), depth: r() < 0.5 ? 0.02 : 0.05 });
    }
    // the world's moving things
    this.makeActors(r);
  }

  private makeActors(r: () => number) {
    // a remix stage may borrow the partner world's sky life
    const id = this.L.skyWorld, L = this.L;
    const add = (kind: number, n: number, y0: number, y1: number, v0: number, v1: number, s0: number, s1: number, depth = 0.04) => {
      for (let i = 0; i < n; i++) this.actors.push({ kind, x: r() * 2600, y: y0 + r() * (y1 - y0), v: v0 + r() * (v1 - v0), s: s0 + r() * (s1 - s0), ph: r() * TAU, depth });
    };
    const S = (w: number, h: number, f: (g: C) => void) => this.actorSprites.push(sprite(w, h, f)) - 1;
    if (id === "toybox") {
      const plane = S(120, 60, (g) => { g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(110, 30); g.lineTo(10, 10); g.lineTo(40, 32); g.closePath(); g.fill(); g.fillStyle = "#D8E4F0"; g.beginPath(); g.moveTo(110, 30); g.lineTo(40, 32); g.lineTo(20, 52); g.closePath(); g.fill(); });
      const balloons = S(120, 200, (g) => { const cols = ["#FF6B6B", "#FFC93C", "#4D96FF"]; for (let i = 0; i < 3; i++) { const x = 35 + i * 25, y = 40 + (i % 2) * 18; g.strokeStyle = "#FFFFFF"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(60, 190); g.stroke(); g.fillStyle = cols[i]; g.beginPath(); g.ellipse(x, y, 22, 28, 0, 0, TAU); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.5); g.beginPath(); g.ellipse(x - 8, y - 10, 5, 9, -0.4, 0, TAU); g.fill(); } });
      add(plane, 2, 0.1, 0.35, 30, 50, 0.5, 0.8); add(balloons, 2, 0.15, 0.4, 6, 12, 0.5, 0.8, 0.06);
    } else if (id === "candy") {
      const gum = S(100, 120, (g) => { const col = ["#FF6FB5", "#7CF5C8", "#FFD23F"][Math.floor(r() * 3)]; const rg = g.createRadialGradient(38, 38, 4, 50, 50, 46); rg.addColorStop(0, "#FFFFFF"); rg.addColorStop(0.35, col); rg.addColorStop(1, shade(col, -0.2)); g.fillStyle = rg; g.beginPath(); g.arc(50, 50, 44, 0, TAU); g.fill(); g.strokeStyle = rgba("#FFFFFF", 0.7); g.beginPath(); g.moveTo(50, 94); g.quadraticCurveTo(40, 108, 52, 120); g.stroke(); });
      add(gum, 4, 0.1, 0.45, 5, 14, 0.35, 0.7, 0.05);
    } else if (id === "skyisles") {
      const hab = S(120, 170, (g) => { const lg = g.createLinearGradient(0, 0, 120, 0); lg.addColorStop(0, "#FF8A5B"); lg.addColorStop(0.5, "#FFD36B"); lg.addColorStop(1, "#FF5A8A"); g.fillStyle = lg; g.beginPath(); g.arc(60, 55, 52, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(76, 120); g.lineTo(44, 120); g.closePath(); g.fill(); g.strokeStyle = rgba("#FFFFFF", 0.5); g.lineWidth = 2; for (const dx of [-24, 0, 24]) { g.beginPath(); g.moveTo(60 + dx * 0.2, 4); g.quadraticCurveTo(60 + dx * 1.6, 55, 60 + dx * 0.4, 118); g.stroke(); } g.fillStyle = "#8A5A3A"; g.fillRect(46, 136, 28, 22); g.strokeStyle = "#5A3A2A"; g.beginPath(); g.moveTo(46, 136); g.lineTo(46, 120); g.moveTo(74, 136); g.lineTo(74, 120); g.stroke(); });
      const ship = S(260, 110, (g) => { const lg = g.createLinearGradient(0, 10, 0, 80); lg.addColorStop(0, "#F5F1E6"); lg.addColorStop(1, "#B8A88A"); g.fillStyle = lg; g.beginPath(); g.ellipse(130, 45, 115, 36, 0, 0, TAU); g.fill(); g.fillStyle = "#38BDF8"; g.fillRect(30, 40, 200, 8); g.fillStyle = "#8A6A4A"; g.fillRect(95, 84, 70, 18); g.strokeStyle = "#6A5A4A"; g.beginPath(); g.moveTo(100, 84); g.lineTo(110, 76); g.moveTo(160, 84); g.lineTo(150, 76); g.stroke(); g.fillStyle = "#B8A88A"; g.beginPath(); g.moveTo(18, 45); g.lineTo(0, 20); g.lineTo(8, 45); g.lineTo(0, 70); g.closePath(); g.fill(); });
      add(hab, 3, 0.12, 0.45, 4, 9, 0.4, 0.8, 0.05); add(ship, 1, 0.12, 0.25, 8, 12, 0.6, 0.8, 0.03);
      add(-1, 6, 0.15, 0.4, 20, 34, 0.6, 1, 0.05);
    } else if (id === "neon") {
      const trail = S(300, 20, (g) => { const lg = g.createLinearGradient(0, 0, 300, 0); lg.addColorStop(0, rgba("#2BF6FF", 0)); lg.addColorStop(1, rgba("#2BF6FF", 0.95)); g.fillStyle = lg; g.fillRect(0, 7, 300, 6); g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(294, 10, 5, 0, TAU); g.fill(); });
      const trail2 = S(300, 20, (g) => { const lg = g.createLinearGradient(0, 0, 300, 0); lg.addColorStop(0, rgba("#FF3DCB", 0)); lg.addColorStop(1, rgba("#FF3DCB", 0.95)); g.fillStyle = lg; g.fillRect(0, 7, 300, 6); g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(294, 10, 5, 0, TAU); g.fill(); });
      add(trail, 3, 0.2, 0.45, 160, 260, 0.5, 0.9, 0.06); add(trail2, 3, 0.2, 0.45, 140, 220, 0.5, 0.9, 0.06);
    } else if (id === "scrapyard" || id === "hardhat" || id === "shroom") {
      add(-1, id === "shroom" ? 0 : 7, 0.12, 0.38, 22, 36, 0.6, 1, 0.05);
      if (id === "shroom") {
        const moth = S(60, 40, (g) => { g.fillStyle = rgba("#C8B4FF", 0.85); g.beginPath(); g.ellipse(18, 18, 16, 12, -0.4, 0, TAU); g.ellipse(42, 18, 16, 12, 0.4, 0, TAU); g.fill(); g.fillStyle = "#3A2A5A"; g.fillRect(28, 10, 4, 22); });
        add(moth, 4, 0.2, 0.55, 8, 16, 0.4, 0.7, 0.05);
      }
    } else if (id === "coral") {
      const fish = S(60, 30, (g) => { const col = ["#FFB46B", "#FF7A8A", "#FFE14D", "#5EE0C8"][Math.floor(r() * 4)]; g.fillStyle = col; g.beginPath(); g.ellipse(26, 15, 20, 10, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(44, 15); g.lineTo(58, 4); g.lineTo(58, 26); g.closePath(); g.fill(); g.fillStyle = "#1A2A3A"; g.beginPath(); g.arc(14, 13, 2.5, 0, TAU); g.fill(); });
      const whale = S(420, 160, (g) => { g.fillStyle = rgba(shade(L.sky[0], -0.35), 0.85); g.beginPath(); g.ellipse(170, 80, 160, 56, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(320, 76); g.quadraticCurveTo(380, 40, 418, 20); g.quadraticCurveTo(390, 80, 418, 140); g.quadraticCurveTo(380, 120, 320, 90); g.fill(); g.beginPath(); g.ellipse(150, 128, 40, 12, 0.5, 0, TAU); g.fill(); });
      add(fish, 10, 0.18, 0.55, -22, -12, 0.35, 0.6, 0.07); add(whale, 1, 0.15, 0.3, -6, -4, 0.7, 0.9, 0.02);
    } else if (id === "clockwork") {
      const zep = S(300, 110, (g) => { const lg = g.createLinearGradient(0, 10, 0, 80); lg.addColorStop(0, "#E8C08A"); lg.addColorStop(1, "#8A5A2A"); g.fillStyle = lg; g.beginPath(); g.ellipse(150, 45, 135, 38, 0, 0, TAU); g.fill(); g.strokeStyle = rgba("#5A3A1A", 0.6); g.lineWidth = 2; for (let k = 1; k < 6; k++) { g.beginPath(); g.ellipse(150, 45, 135 * (k / 6), 38, 0, 0, TAU); g.stroke(); } g.fillStyle = "#5A3A1A"; g.fillRect(115, 86, 70, 18); g.beginPath(); g.moveTo(20, 45); g.lineTo(0, 15); g.lineTo(10, 45); g.lineTo(0, 75); g.fill(); });
      add(zep, 1, 0.12, 0.22, 7, 10, 0.6, 0.8, 0.03);
      add(-2, 3, 0.35, 0.55, 0, 0, 0.8, 1.4, 0.12); // turning gears (mid depth)
    } else if (id === "haunted") {
      const bat = S(60, 30, (g) => { g.fillStyle = "#120A1A"; g.beginPath(); g.moveTo(30, 16); g.quadraticCurveTo(18, 2, 2, 8); g.quadraticCurveTo(12, 14, 8, 22); g.quadraticCurveTo(20, 16, 30, 24); g.quadraticCurveTo(40, 16, 52, 22); g.quadraticCurveTo(48, 14, 58, 8); g.quadraticCurveTo(42, 2, 30, 16); g.fill(); });
      add(bat, 7, 0.1, 0.4, 26, 44, 0.5, 0.9, 0.06);
      add(-3, 1, 0.42, 0.42, 0, 0, 1, 1, 0.12); // the Ferris wheel (mid depth)
    } else if (id === "orbit") {
      const sat = S(140, 60, (g) => { g.fillStyle = "#D6DEEC"; g.fillRect(55, 18, 30, 24); g.fillStyle = "#2A4C9A"; g.fillRect(0, 22, 50, 16); g.fillRect(90, 22, 50, 16); g.strokeStyle = "#9CC8FF"; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(k * 10, 22); g.lineTo(k * 10, 38); g.moveTo(90 + k * 10, 22); g.lineTo(90 + k * 10, 38); g.stroke(); } });
      const rock = S(90, 80, (g) => { g.fillStyle = "#6A6070"; g.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, rad = 30 + r() * 12; g.lineTo(45 + Math.cos(a) * rad, 40 + Math.sin(a) * rad * 0.8); } g.fill(); g.fillStyle = rgba("#000000", 0.25); g.beginPath(); g.arc(52, 46, 9, 0, TAU); g.fill(); });
      add(sat, 2, 0.1, 0.3, 10, 18, 0.5, 0.8, 0.03); add(rock, 5, 0.15, 0.5, -6, 6, 0.3, 0.8, 0.05);
    } else if (id === "glacier") {
      add(-1, 4, 0.15, 0.35, 18, 28, 0.6, 0.9, 0.05);
    }
  }

  /** the sky behind everything: gradient, sun / moon, stars, the world's feature, clouds and far actors */
  draw(c: C, W: number, H: number, camX: number, camY: number, t: number, dt: number) {
    const L = this.L, id = this.id, night = L.night;
    if (!this.grad || this.gradH !== H) {
      this.grad = c.createLinearGradient(0, 0, 0, H);
      this.grad.addColorStop(0, L.sky[0]); this.grad.addColorStop(0.55, L.sky[1]); this.grad.addColorStop(1, L.sky[2]);
      this.gradH = H;
    }
    c.fillStyle = this.grad; c.fillRect(0, 0, W, H);
    const lift = Math.max(-40, Math.min(60, camY * 1.2));
    if (this.stars) {
      c.globalAlpha = Math.min(1, night * 1.1) * (0.75 + 0.25 * Math.sin(t * 1.3));
      const sx = -((camX * 0.6) % 1024 + 1024) % 1024;
      for (let x = sx; x < W; x += 1024) for (let y = 0; y < H * 0.7; y += 512) c.drawImage(this.stars, x, y + lift * 0.2);
      c.globalAlpha = 1;
    }
    if (this.extra && id === "orbit") {
      const s = Math.min(W, H) * 0.95;
      c.drawImage(this.extra, W * 0.62 - s / 2, H * 0.18 - s / 2 + lift * 0.3, s, s);
    }
    if (this.extra && (id === "glacier" || id === "shroom") && night > 0.5) {
      c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.4);
      const ox = -(((camX * 2 + t * 12) % 1024) + 1024) % 1024;
      for (let x = ox; x < W; x += 1024) c.drawImage(this.extra, x, H * 0.02 + Math.sin(t * 0.3) * 8 + lift * 0.2, 1024, H * 0.5);
      c.globalAlpha = 1;
    }
    // sun / moon
    const sx = W * L.mood.sunX, sy = H * (0.08 + L.mood.sunY * 0.5) + lift * 0.3;
    const gs = Math.max(W, H) * (night > 0.5 ? 0.7 : 0.95);
    c.globalCompositeOperation = "lighter"; c.globalAlpha = night > 0.5 ? 0.55 : 0.75;
    c.drawImage(this.glow, sx - gs / 2, sy - gs / 2, gs, gs);
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    if (this.body) {
      const bs = id === "neon" ? Math.min(W, H) * 0.34 : Math.min(W, H) * (id === "haunted" ? 0.3 : 0.16);
      c.drawImage(this.body, sx - bs / 2, sy - bs / 2, bs, bs);
    } else if (night <= 0.5 && id !== "coral") {
      c.fillStyle = mix(L.mood.sun, "#FFFFFF", 0.6); c.beginPath(); c.arc(sx, sy, Math.min(W, H) * 0.045, 0, TAU); c.fill();
    }
    if (this.extra && id === "coral") {
      for (let k = 0; k < 5; k++) {
        const x = (((k * 0.23 + 0.05) * W - camX * 3) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
        c.save(); c.translate(x, -10); c.rotate(0.25 + Math.sin(t * 0.3 + k) * 0.06); c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 0.5 + k * 2);
        c.drawImage(this.extra, -60, 0, 120 + k * 20, H * 1.1); c.restore();
      }
      c.globalAlpha = 1;
    }
    // clouds drift and slide with the camera a little
    for (const cl of this.clouds) {
      cl.x += cl.v * dt;
      const sp = this.cloudSprites[cl.sprite];
      const k = Math.min(W, H) / 800;
      const w = sp.width * cl.s * k, h = sp.height * cl.s * k;
      const span = W + w * 2;
      const x = (((cl.x - camX * cl.depth * 40) % span) + span) % span - w;
      c.globalAlpha = 0.75;
      c.drawImage(sp, x, cl.y * H * 0.8 + lift * cl.depth * 6, w, h);
    }
    c.globalAlpha = 1;
    this.drawActors(c, W, H, camX, lift, t, dt, false);
    // a shooting star now and then
    if (night > 0.6) {
      const s = this.shoot;
      if (s.t < 0 && Math.random() < dt * 0.08) { s.t = 0; s.x = Math.random() * W; s.y = Math.random() * H * 0.3; s.vx = -(300 + Math.random() * 200); s.vy = 120 + Math.random() * 80; }
      if (s.t >= 0) {
        s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        c.strokeStyle = rgba("#FFFFFF", Math.max(0, 0.9 - s.t * 1.2)); c.lineWidth = 2;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08); c.stroke();
        if (s.t > 0.8) s.t = -1;
      }
    }
  }

  /** the world's mid-depth moving set pieces (gears, the Ferris wheel), drawn between the backdrop layers */
  drawMid(c: C, W: number, H: number, camX: number, camY: number, t: number, dt: number) {
    this.drawActors(c, W, H, camX, Math.max(-40, Math.min(60, camY * 1.2)), t, dt, true);
  }

  private drawActors(c: C, W: number, H: number, camX: number, lift: number, t: number, dt: number, mid: boolean) {
    const L = this.L, k = Math.min(W, H) / 620;
    for (const a of this.actors) {
      const isMid = a.kind <= -2;
      if (isMid !== mid) continue;
      a.x += a.v * dt;
      if (a.kind === -1) {
        // a bird / crow flock: little flapping chevrons
        const span = W + 400;
        const x = (((a.x - camX * a.depth * 40) % span) + span) % span - 200, y = a.y * H + Math.sin(t * 0.8 + a.ph) * 10 + lift * 0.2;
        c.strokeStyle = L.skyWorld === "scrapyard" || L.skyWorld === "hardhat" ? rgba("#1A1418", 0.75) : rgba(shade(L.sky[0], -0.5), 0.6); c.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const bx = x + i * 26 * k - (i % 2) * 8, by = y + Math.abs(i - 2) * 12 * k, f = Math.sin(t * 9 + a.ph + i) * 5 * k;
          c.beginPath(); c.moveTo(bx - 8 * k, by - f); c.quadraticCurveTo(bx - 3 * k, by - 3 * k, bx, by); c.quadraticCurveTo(bx + 3 * k, by - 3 * k, bx + 8 * k, by - f); c.stroke();
        }
        continue;
      }
      if (a.kind === -2) {
        // a big brass gear turning slowly, part of the skyline
        const span = W * 1.6, x = (((a.ph * 300 - camX * a.depth * 40) % span) + span) % span - W * 0.3, y = a.y * H + lift * 0.4;
        this.gear(c, x, y, 90 * a.s * k, t * 0.25 * (a.ph > 3 ? 1 : -1) + a.ph, mix("#C08A3A", L.layers[1], 0.5 + L.night * 0.2));
        continue;
      }
      if (a.kind === -3) {
        // the Ferris wheel
        const span = W * 1.8, x = (((W * 0.7 - camX * a.depth * 40) % span) + span) % span - W * 0.4, y = a.y * H + lift * 0.4, R = 150 * k;
        c.strokeStyle = L.layers[1]; c.lineWidth = 7 * k;
        c.beginPath(); c.moveTo(x - R * 0.6, y + R * 1.25); c.lineTo(x, y); c.lineTo(x + R * 0.6, y + R * 1.25); c.stroke();
        c.lineWidth = 3 * k; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, R * 0.9, 0, TAU); c.stroke();
        const n = 10, rot = t * 0.12;
        for (let i = 0; i < n; i++) {
          const ang = rot + (i / n) * TAU, px = x + Math.cos(ang) * R, py = y + Math.sin(ang) * R;
          c.beginPath(); c.moveTo(x, y); c.lineTo(px, py); c.stroke();
          c.fillStyle = ["#C0392B", "#FFB547", "#7A3B8F"][i % 3]; c.fillRect(px - 10 * k, py, 20 * k, 16 * k);
          c.fillStyle = rgba("#FFE7A0", 0.6 + L.night * 0.4); c.beginPath(); c.arc(px, py, 2.5 * k, 0, TAU); c.fill();
        }
        continue;
      }
      const sp = this.actorSprites[a.kind];
      const w = sp.width * a.s * k, h = sp.height * a.s * k;
      const span = W + w * 2 + 200;
      const x = (((a.x - camX * a.depth * 40) % span) + span) % span - w - 100;
      const y = a.y * H + Math.sin(t * 0.7 + a.ph) * 8 * k + lift * a.depth * 4;
      c.globalAlpha = L.skyWorld === "coral" ? 0.85 : 1;
      if (a.v < 0) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(sp, 0, 0, w, h); c.restore(); }
      else c.drawImage(sp, x, y, w, h);
      c.globalAlpha = 1;
    }
  }

  private gear(c: C, x: number, y: number, R: number, a: number, col: string) {
    const n = 14;
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const ang = a + (i / (n * 2)) * TAU, rad = i % 2 ? R * 0.84 : R;
      c.lineTo(x + Math.cos(ang - 0.08) * rad, y + Math.sin(ang - 0.08) * rad);
      c.lineTo(x + Math.cos(ang + 0.08) * rad, y + Math.sin(ang + 0.08) * rad);
    }
    c.closePath(); c.fill();
    c.fillStyle = shade(col, -0.2); c.beginPath(); c.arc(x, y, R * 0.55, 0, TAU); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, y, R * 0.18, 0, TAU); c.fill();
    c.strokeStyle = shade(col, -0.2); c.lineWidth = R * 0.08;
    for (let i = 0; i < 6; i++) { const ang = a + (i / 6) * TAU; c.beginPath(); c.moveTo(x + Math.cos(ang) * R * 0.2, y + Math.sin(ang) * R * 0.2); c.lineTo(x + Math.cos(ang) * R * 0.55, y + Math.sin(ang) * R * 0.55); c.stroke(); }
  }
}
