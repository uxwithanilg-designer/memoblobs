// Canvas-painted textures for roads, kerbs, barriers, ground detail, distant backdrops, sprites and signs.
// No downloads needed. Textures are cached by key and reference-counted per world build (see beginTextureScope).
import * as THREE from "three";
import type { ThemeLook, BackdropLayer } from "./themes";

// ---------------------------------------------------------------- cache with per-world reference counting
interface Entry { tex: THREE.CanvasTexture; refs: number }
const cache = new Map<string, Entry>();
let scope: Set<string> | null = null;

/** start collecting the textures a world uses; pass the returned set to releaseTextureScope on dispose */
export function beginTextureScope() { scope = new Set(); return scope; }
export function endTextureScope() { scope = null; }
export function releaseTextureScope(keys: Set<string>) {
  for (const k of keys) {
    const e = cache.get(k);
    if (!e) continue;
    if (--e.refs <= 0) { e.tex.dispose(); cache.delete(k); }
  }
  keys.clear();
}
export function clearTextureCache() { for (const e of cache.values()) e.tex.dispose(); cache.clear(); }

export function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true) {
  let e = cache.get(key);
  if (!e) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    e = { tex: t, refs: 0 };
    cache.set(key, e);
  }
  if (scope && !scope.has(key)) { scope.add(key); e.refs++; }
  return e.tex;
}
/** same as canvasTex but stores raw (linear) data — for normal / roughness maps */
function dataTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const t = canvasTex(key, w, h, draw);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------- helpers
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function ihash(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** tileable value noise, period p lattice cells */
function tnoise(x: number, y: number, p: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = ihash(x0, y0, s), b = ihash(x1, y0, s), c = ihash(x0, y1, s), d = ihash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(x: number, y: number, p: number, s: number, oct = 4) { let sum = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { sum += tnoise(x * f, y * f, p * f, s + i * 7) * amp; f *= 2; amp *= 0.5; } return sum / (1 - Math.pow(0.5, oct)); }

const C = (hex: string) => new THREE.Color(hex);
const shade = (hex: string, k: number) => { const c = C(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return `#${c.getHexString()}`; };
const mixHex = (a: string, b: string, t: number) => `#${C(a).lerp(C(b), t).getHexString()}`;
/** sRGB bytes of a colour (THREE.Color stores linear values, canvases want sRGB) */
const rgb255 = (hex: string) => { const n = parseInt(new THREE.Color(hex).getHexString(), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** per-pixel noise fill: base colour modulated by tileable fbm (blotches) and grain */
function noiseFill(g: CanvasRenderingContext2D, w: number, h: number, base: string, blotch: number, grain: number, period = 8, seed = 1) {
  const img = g.createImageData(w, h), d = img.data, [r, gg, b] = rgb255(base), R = rng(seed);
  // blotch noise on a coarse (tileable) grid, bilinearly interpolated — 16x fewer noise evaluations
  const S = 4, cw = w / S, chh = h / S, coarse = new Float32Array(cw * chh);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) coarse[y * cw + x] = tfbm((x / cw) * period, (y / chh) * period, period, seed, 4) - 0.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / S, fy = y / S, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, x1 = (x0 + 1) % cw, y1 = (y0 + 1) % chh;
    const c0 = coarse[y0 * cw + x0] + (coarse[y0 * cw + x1] - coarse[y0 * cw + x0]) * tx, c1 = coarse[y1 * cw + x0] + (coarse[y1 * cw + x1] - coarse[y1 * cw + x0]) * tx;
    const n = (c0 + (c1 - c0) * ty) * 2 * blotch + (R() - 0.5) * 2 * grain;
    const k = 1 + n, i = (y * w + x) * 4;
    d[i] = r * k; d[i + 1] = gg * k; d[i + 2] = b * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], size = 2, R = Math.random) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[i % colors.length]; g.globalAlpha = 0.25 + R() * 0.5; const s = R() * size + 0.5; g.fillRect(R() * w, R() * h, s, s); }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- road
export interface RoadTextures { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture | null; rough: THREE.CanvasTexture | null }

/** road surface: u = across (0..1), v = along (one tile = 10 m) */
export function road(r: ThemeLook["road"], lanes: number, wet: boolean): RoadTextures {
  const centre = r.centre ?? "dash";
  const key = `road:${r.kind}:${r.color}:${r.line}:${r.edge}:${lanes}:${centre}`;
  const glowKinds = r.kind === "neon" || r.kind === "grid" || r.kind === "basalt" || r.kind === "rainbow" || r.kind === "glass";
  const markings = (g: CanvasRenderingContext2D, w: number, h: number, glow: boolean) => {
    const line = (x: number, wpx: number, col: string, dash: boolean) => {
      if (glow) { g.shadowColor = col; g.shadowBlur = 14; }
      g.fillStyle = col; g.globalAlpha = glow ? 1 : 0.92;
      if (dash) g.fillRect(x - wpx / 2, h * 0.05, wpx, h * 0.4); else g.fillRect(x - wpx / 2, 0, wpx, h);
      g.shadowBlur = 0; g.globalAlpha = 1;
    };
    if (r.edge !== "none") { line(w * 0.035, 9, r.edge, false); line(w * 0.965, 9, r.edge, false); }
    if (r.line === "none" || centre === "none") return;
    if (centre === "double") { line(w / 2 - 7, 6, r.line, false); line(w / 2 + 7, 6, r.line, false); for (let i = 1; i < lanes; i++) if (Math.abs(i / lanes - 0.5) > 0.01) line((i / lanes) * w, 6, "#F4F1E6", true); }
    else if (centre === "solid") line(w / 2, 7, r.line, false);
    else for (let i = 1; i < lanes; i++) line((i / lanes) * w, 7, r.line, true);
  };
  const map = canvasTex(key, 512, 512, (g, w, h) => {
    // real asphalt is lighter than it looks: lift dark bases so they read as grey, not black
    const lift = r.kind === "asphalt" ? 1.12 : 1;
    const base = shade(r.color, lift), R = rng(11);
    switch (r.kind) {
      case "dirt": case "sand": case "regolith": {
        noiseFill(g, w, h, base, 0.12, 0.1, 6, 3);
        speckle(g, w, h, 2500, [shade(base, 1.3), shade(base, 0.7)], 3, R);
        g.globalAlpha = 0.16; g.fillStyle = shade(base, 0.62);
        for (const x of [0.28, 0.38, 0.62, 0.72]) g.fillRect(x * w - 14, 0, 28, h); // tyre ruts
        g.globalAlpha = 1;
        if (r.kind === "regolith") { markings(g, w, h, false); }
        return;
      }
      case "snow": case "ice": {
        noiseFill(g, w, h, base, r.kind === "ice" ? 0.1 : 0.06, 0.05, 5, 5);
        if (r.kind === "ice") {
          g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.2;
          for (let i = 0; i < 40; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
        } else {
          g.globalAlpha = 0.2; g.fillStyle = "#7d8ea3";
          for (const x of [0.24, 0.34, 0.66, 0.76]) g.fillRect(x * w - 12, 0, 24, h);
          g.globalAlpha = 1;
          speckle(g, w, h, 1500, ["#ffffff"], 2, R);
        }
        markings(g, w, h, false);
        return;
      }
      case "brick": case "cobble": case "stone": {
        g.fillStyle = shade(base, 0.55); g.fillRect(0, 0, w, h);
        const bw = r.kind === "brick" ? 64 : r.kind === "stone" ? 128 : 32, bh = r.kind === "brick" ? 24 : r.kind === "stone" ? 64 : 28;
        for (let y = 0; y < h; y += bh) for (let x = -bw; x < w + bw; x += bw) {
          const off = ((y / bh) % 2 ? bw / 2 : 0) + (r.kind === "stone" ? (R() - 0.5) * 20 : 0);
          g.fillStyle = shade(base, 0.82 + R() * 0.32);
          if (r.kind === "cobble") { g.beginPath(); g.ellipse(x + off + bw / 2, y + bh / 2, bw / 2 - 2.5, bh / 2 - 2.5, 0, 0, Math.PI * 2); g.fill(); }
          else g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        }
        speckle(g, w, h, 3000, [shade(base, 1.25), shade(base, 0.7)], 2, R);
        markings(g, w, h, false);
        return;
      }
      case "rainbow": {
        const cols = ["#FF4F6D", "#FF9F40", "#FFE14A", "#5BE37A", "#4FC3FF", "#9B6BFF"];
        cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i / cols.length) * w, 0, w / cols.length + 1, h); });
        g.fillStyle = "rgba(255,255,255,0.35)"; for (let i = 0; i <= cols.length; i++) g.fillRect((i / cols.length) * w - 2, 0, 4, h);
        g.fillStyle = "rgba(255,255,255,0.22)"; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 6);
        return;
      }
      case "candy": {
        noiseFill(g, w, h, base, 0.04, 0.03, 4, 9);
        const sp = ["#FF5FA2", "#FFE14A", "#7FD7FF", "#7FE0A6", "#B78BFF", "#FFFFFF"];
        for (let i = 0; i < 700; i++) { g.save(); g.translate(R() * w, R() * h); g.rotate(R() * Math.PI); g.fillStyle = sp[i % sp.length]; g.fillRect(-5, -1.5, 10, 3); g.restore(); }
        markings(g, w, h, false);
        return;
      }
      case "grid": case "neon": {
        noiseFill(g, w, h, base, 0.08, 0.05, 6, 13);
        if (r.kind === "grid") { g.strokeStyle = shade(r.line, 0.35); g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
        markings(g, w, h, true);
        return;
      }
      case "basalt": {
        noiseFill(g, w, h, base, 0.18, 0.12, 6, 17);
        g.strokeStyle = "#140c0a"; g.lineWidth = 3;
        crackPaths(w, h, 23).forEach((p) => { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
        markings(g, w, h, false);
        return;
      }
      case "metal": case "glass": {
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        const tile = r.kind === "metal" ? 128 : 64;
        for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) {
          g.fillStyle = shade(base, 0.9 + R() * 0.2); g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
          if (r.kind === "metal") { g.fillStyle = shade(base, 1.4); for (const [a, b] of [[8, 8], [tile - 10, 8], [8, tile - 10], [tile - 10, tile - 10]]) g.fillRect(x + a, y + b, 3, 3); }
        }
        if (r.kind === "metal") { // hazard stripes along the edges
          for (let y = -40; y < h; y += 40) for (const x0 of [0, w - 14]) { g.save(); g.beginPath(); g.rect(x0, 0, 14, h); g.clip(); g.fillStyle = "#F2C230"; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 14, y + 14); g.lineTo(x0 + 14, y + 34); g.lineTo(x0, y + 20); g.fill(); g.restore(); }
        }
        speckle(g, w, h, 1500, [shade(base, 1.3), shade(base, 0.75)], 2, R);
        markings(g, w, h, r.kind === "glass");
        return;
      }
      default: { // asphalt / wet
        noiseFill(g, w, h, base, 0.07, 0.16, 8, 7);
        // tar-sealed cracks and repair patches
        g.globalAlpha = 0.5; g.strokeStyle = shade(base, 0.6); g.lineWidth = 1.5;
        crackPaths(w, h, 5).slice(0, 5).forEach((p) => { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
        g.globalAlpha = 0.18; g.fillStyle = shade(base, 0.8);
        for (let i = 0; i < 3; i++) g.fillRect(R() * w * 0.8, R() * h * 0.8, 40 + R() * 80, 30 + R() * 70);
        g.globalAlpha = 1;
        // rubbered-in tyre lines
        const gr = g.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 20; i++) { const u = i / 20; const lane = Math.abs(((u * lanes) % 1) - 0.5) * 2; const k = Math.max(0, 1 - Math.abs(lane - 0.55) * 4); gr.addColorStop(u, `rgba(0,0,0,${0.13 * k})`); }
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        markings(g, w, h, false);
      }
    }
  });
  let emissive: THREE.CanvasTexture | null = null;
  if (glowKinds) {
    emissive = canvasTex(`${key}:emi`, 512, 512, (g, w, h) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
      if (r.kind === "rainbow") { g.drawImage(map.image as HTMLCanvasElement, 0, 0); g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, 0, w, h); return; }
      if (r.kind === "basalt") {
        g.strokeStyle = "#FF6A1F"; g.lineWidth = 2.2; g.shadowColor = "#FF3A0A"; g.shadowBlur = 8;
        crackPaths(w, h, 23).forEach((p) => { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
        g.shadowBlur = 0;
        markings(g, w, h, true);
        return;
      }
      if (r.kind === "grid") { g.strokeStyle = shade(r.line, 0.5); g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
      markings(g, w, h, true);
    });
  }
  let rough: THREE.CanvasTexture | null = null;
  if (wet || r.kind === "ice") {
    rough = dataTex(`rough:${r.kind}:${wet}`, 256, 256, (g, w, h) => {
      // green channel = roughness: puddles are mirror-like
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = tfbm((x / w) * 4, (y / h) * 4, 4, 31, 4);
        const puddle = Math.min(1, Math.max(0, (n - 0.5) * 6));
        const v = (r.kind === "ice" ? 0.18 : 0.42) * (1 - puddle) + 0.04 * puddle;
        const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v * 255; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  return { map, emissive, rough };
}

function crackPaths(ww: number, hh: number, seed: number) {
  const R = rng(seed), out: [number, number][][] = [];
  for (let i = 0; i < 14; i++) {
    let x = R() * ww, y = R() * hh; const p: [number, number][] = [[x, y]];
    const dir = R() * Math.PI * 2;
    for (let k = 0; k < 7; k++) { x += Math.cos(dir + (R() - 0.5) * 1.4) * 22; y += Math.sin(dir + (R() - 0.5) * 1.4) * 22; p.push([x, y]); }
    out.push(p);
  }
  return out;
}

export function curb(a: string, b: string) {
  // u runs along the road (alternating blocks), v across the kerb
  return canvasTex(`curb:${a}:${b}`, 128, 64, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = b; g.fillRect(w / 2, 0, w / 2, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0.25)"); gr.addColorStop(0.3, "rgba(255,255,255,0.1)"); gr.addColorStop(0.75, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.3)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.12)"; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1, h);
  });
}
export function gravel(color: string) {
  return canvasTex(`gravel:${color}`, 256, 256, (g, w, h) => { noiseFill(g, w, h, color, 0.1, 0.22, 8, 21); speckle(g, w, h, 1800, [shade(color, 1.35), shade(color, 0.65)], 3, rng(4)); });
}

/** ground detail multiplier (near white) so vertex colours carry the hue */
export function groundDetail(kind: string) {
  return canvasTex(`ground:${kind}`, 256, 256, (g, w, h) => {
    const R = rng(77);
    if (kind === "grid") {
      g.fillStyle = "#3a3a46"; g.fillRect(0, 0, w, h);
      return;
    }
    noiseFill(g, w, h, "#e9e9e9", kind === "snow" ? 0.03 : 0.08, kind === "snow" ? 0.03 : 0.1, 4, 41);
    if (kind === "grass" || kind === "moss") {
      for (let i = 0; i < 2600; i++) { const x = R() * w, y = R() * h, l = 3 + R() * 5; g.strokeStyle = R() < 0.5 ? "rgba(255,255,255,0.55)" : "rgba(60,60,40,0.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - l); g.stroke(); }
    } else if (kind === "sand" || kind === "dust") {
      g.strokeStyle = "rgba(120,100,70,0.18)"; g.lineWidth = 2;
      for (let y = 0; y < h; y += 9) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin((x / w) * Math.PI * 4 + y) * 3); g.stroke(); }
      if (kind === "dust") for (let i = 0; i < 18; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 14; g.strokeStyle = "rgba(60,60,60,0.25)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = "rgba(0,0,0,0.08)"; g.fill(); }
    } else if (kind === "snow") {
      speckle(g, w, h, 900, ["#ffffff", "#cfd8e6"], 2, R);
    } else if (kind === "candy") {
      const sp = ["#ff8fc0", "#ffe98a", "#9fe3ff", "#b9ffd0"];
      for (let i = 0; i < 260; i++) { g.save(); g.translate(R() * w, R() * h); g.rotate(R() * 3); g.fillStyle = sp[i % 4]; g.fillRect(-3, -1, 6, 2); g.restore(); }
    } else if (kind === "rock" || kind === "dirt") {
      speckle(g, w, h, 2500, ["#8a8a8a", "#ffffff", "#bdbdbd"], 3, R);
    }
  });
}
/** emissive grid for the cyber world's ground */
export function gridGlow(color: string) {
  return canvasTex(`gridglow:${color}`, 256, 256, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 3; g.shadowColor = color; g.shadowBlur = 6;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
}

export function checker() {
  return canvasTex("checker", 128, 64, (g, w, h) => {
    const n = 8, m = 4;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f4"; g.fillRect((i / n) * w, (j / m) * h, w / n, h / m); }
  });
}

/** barrier textures: u along (one tile = uScale m), v up. Transparent pixels are cut out (alphaTest). */
export function barrier(kind: string, color: string) {
  return canvasTex(`barrier:${kind}:${color}`, 256, 64, (g, w, h) => {
    const R = rng(5);
    g.clearRect(0, 0, w, h);
    switch (kind) {
      case "rail": {
        // W-beam on posts, see-through below
        g.fillStyle = "#4a4f57"; for (let x = 24; x < w; x += 128) g.fillRect(x, h * 0.2, 9, h * 0.8);
        const gr = g.createLinearGradient(0, h * 0.12, 0, h * 0.58);
        gr.addColorStop(0, "#f4f7fa"); gr.addColorStop(0.3, color); gr.addColorStop(0.5, "#8d939c"); gr.addColorStop(0.7, color); gr.addColorStop(1, "#6d737c");
        g.fillStyle = gr; g.fillRect(0, h * 0.12, w, h * 0.46);
        g.fillStyle = "#c0c5cc"; for (let x = 20; x < w; x += 128) { g.fillRect(x, h * 0.3, 4, 4); g.fillRect(x + 10, h * 0.3, 4, 4); }
        g.fillStyle = "#E8504F"; for (let x = 60; x < w; x += 128) g.fillRect(x, h * 0.2, 10, 6);
        break;
      }
      case "concrete": {
        noiseFill(g, w, h, color, 0.06, 0.08, 4, 3);
        g.fillStyle = "rgba(0,0,0,0.18)"; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h);
        for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? "#E8504F" : "#F4F1E6"; g.fillRect(x, h * 0.36, 32, h * 0.12); }
        g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, h * 0.86, w, h * 0.14);
        break;
      }
      case "tires": {
        g.fillStyle = "#151517"; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 21) {
          g.fillStyle = (x / 32 + y / 21) % 4 < 1 ? color : "#26262a"; g.beginPath(); g.ellipse(x + 16, y + 10, 15, 9.5, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#0c0c0e"; g.beginPath(); g.ellipse(x + 16, y + 10, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case "neon": case "glass": {
        if (kind === "glass") { g.fillStyle = "rgba(160,230,255,0.5)"; g.fillRect(0, 0, w, h); }
        else { g.fillStyle = "#0d0a18"; g.fillRect(0, h * 0.5, w, h * 0.5); g.fillStyle = "#1a1530"; for (let x = 0; x < w; x += 64) g.fillRect(x + 28, 0, 8, h); }
        g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color;
        g.fillRect(0, h * 0.06, w, 7); g.fillRect(0, h * 0.62, w, 5);
        g.shadowBlur = 0;
        break;
      }
      case "fence": case "iron": {
        if (kind === "fence") {
          g.strokeStyle = color; g.lineWidth = 1.5;
          for (let x = -h; x < w + h; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.beginPath(); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); }
          g.fillStyle = "#5a5f66"; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 6, h); g.fillRect(0, 0, w, 3);
        } else {
          g.fillStyle = color;
          for (let x = 4; x < w; x += 16) { g.fillRect(x, h * 0.12, 3, h * 0.88); g.beginPath(); g.moveTo(x - 2, h * 0.14); g.lineTo(x + 1.5, 0); g.lineTo(x + 5, h * 0.14); g.fill(); }
          g.fillRect(0, h * 0.25, w, 3); g.fillRect(0, h * 0.85, w, 4);
          for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 7, h);
        }
        break;
      }
      case "candy": {
        for (let x = -h; x < w + h; x += 32) { g.fillStyle = color; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
        g.globalCompositeOperation = "destination-over"; g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0.4)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,0.2)");
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        break;
      }
      case "ice": case "snowbank": {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(1, color);
        g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 600, ["#ffffff", shade(color, 0.85)], 3, R);
        if (kind === "snowbank") { g.fillStyle = "#E8504F"; for (let x = 10; x < w; x += 128) { g.fillRect(x, 0, 4, h * 0.6); } }
        break;
      }
      case "hedge": {
        noiseFill(g, w, h, color, 0.25, 0.25, 6, 8);
        speckle(g, w, h, 2500, [shade(color, 1.35), shade(color, 0.6)], 4, R);
        break;
      }
      case "wood": case "bamboo": {
        if (kind === "wood") {
          g.fillStyle = shade(color, 0.85); for (let x = 6; x < w; x += 64) g.fillRect(x, 0, 10, h);
          for (const y of [0.12, 0.5]) { g.fillStyle = color; g.fillRect(0, h * y, w, h * 0.2); g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(0, h * (y + 0.17), w, h * 0.03); }
        } else {
          for (let x = 0; x < w; x += 10) { g.fillStyle = shade(color, 0.85 + R() * 0.3); g.fillRect(x + 1, 0, 8, h); g.fillStyle = shade(color, 0.6); g.fillRect(x + 1, h * (0.3 + R() * 0.3), 8, 2); }
          g.fillStyle = shade(color, 0.5); g.fillRect(0, h * 0.2, w, 3); g.fillRect(0, h * 0.7, w, 3);
        }
        break;
      }
      case "hay": {
        noiseFill(g, w, h, color, 0.18, 0.3, 6, 12);
        g.strokeStyle = shade(color, 0.6); g.lineWidth = 2; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 4, h); g.stroke(); }
        break;
      }
      default: { // rocks / stone
        noiseFill(g, w, h, color, 0.2, 0.12, 6, 19);
        g.strokeStyle = shade(color, 0.55); g.lineWidth = 2;
        if (kind === "stone") { for (let y = 0; y < h; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 21) % 2 ? 24 : 0; x < w; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 21); g.stroke(); } } }
        else for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(R() * w, R() * h, 6 + R() * 14, 0, Math.PI * 2); g.stroke(); }
      }
    }
  });
}

export function banner(text: string, accent: string) {
  return canvasTex(`banner:${text}:${accent}`, 1024, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#14102a"); gr.addColorStop(0.5, accent); gr.addColorStop(1, "#14102a");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#111" : "#fff"; g.fillRect(i * 16, 0, 16, 16); g.fillRect(w - 256 + i * 16, h - 16, 16, 16); }
    g.font = "900 70px 'Lilita One', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 10; g.strokeStyle = "#14102a"; g.strokeText(`MOMOBLOBS · ${text.toUpperCase()}`, w / 2, h / 2 + 4);
    g.fillStyle = "#FFD25A"; g.fillText(`MOMOBLOBS · ${text.toUpperCase()}`, w / 2, h / 2 + 4);
  }, false);
}

/** building facade atlas: 4 columns of styles (u 0..1 across the atlas, each style 0.25 wide) */
export function facades(night: boolean) {
  return canvasTex(`facades:${night}`, 512, 512, (g, w, h) => {
    const R = rng(night ? 3 : 4), cw = w / 4;
    const styles = [
      { wall: "#C9CED6", win: "#8FB4D8", frame: 6 }, // office glass grid
      { wall: "#B88A6A", win: "#6E8DAA", frame: 10 }, // brick
      { wall: "#5E7A96", win: "#A9CBE8", frame: 3 }, // blue glass tower
      { wall: "#E6DED0", win: "#7A92A8", frame: 9 }, // concrete
    ];
    styles.forEach((s, k) => {
      const x0 = k * cw;
      g.fillStyle = night ? shade(s.wall, 0.25) : s.wall; g.fillRect(x0, 0, cw, h);
      const ww = 14, wh = 18, gx = 6 + s.frame / 2, gy = 8 + s.frame / 2;
      for (let y = 6; y < h - wh; y += wh + gy) for (let x = x0 + 5; x < x0 + cw - ww; x += ww + gx) {
        const lit = R();
        if (night) g.fillStyle = lit > 0.42 ? ["#FFE2A0", "#FFF4D6", "#BEE6FF", "#FFD08A"][Math.floor(lit * 4) % 4] : "#0d0f18";
        else g.fillStyle = lit > 0.7 ? shade(s.win, 1.25) : lit > 0.2 ? s.win : shade(s.win, 0.7);
        g.fillRect(x, y, ww, wh);
        if (!night) { g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x, y, ww, 3); }
      }
    });
  });
}

const ADS: [string, string, string][] = [
  ["MOMOBLOBS", "#FF8A3D", "#fff"], ["NITRO RUSH", "#3B82F6", "#fff"], ["TURBO OIL", "#2FA866", "#fff"], ["KRANKY TYRES", "#E8504F", "#fff"],
  ["PIP'S PIZZA", "#FFD25A", "#14102a"], ["BOLT BATTERY", "#9B5DE5", "#fff"], ["ZOOM COLA", "#D7263D", "#fff"], ["SKY FUEL", "#00A7C2", "#fff"],
];
/** atlas of 8 ads (2 cols x 4 rows); props pick a cell via UV offsets baked per instance group */
export function adAtlas(neon: boolean) {
  return canvasTex(`ads:${neon}`, 1024, 1024, (g, w, h) => {
    const cw = w / 2, ch = h / 4;
    ADS.forEach(([t, c, fg], i) => {
      const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
      if (neon) { g.fillStyle = "#0b0718"; g.fillRect(x, y, cw, ch); g.shadowColor = c; g.shadowBlur = 24; g.strokeStyle = c; g.lineWidth = 8; g.strokeRect(x + 14, y + 14, cw - 28, ch - 28); }
      else {
        const gr = g.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, shade(c, 1.15)); gr.addColorStop(1, shade(c, 0.75));
        g.fillStyle = gr; g.fillRect(x, y, cw, ch);
        g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.arc(x + cw * 0.85, y + ch * 0.2, 110, 0, Math.PI * 2); g.fill();
      }
      g.font = "900 70px 'Lilita One', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      if (!neon) { g.lineWidth = 10; g.strokeStyle = "rgba(20,16,42,0.85)"; g.strokeText(t, x + cw / 2, y + ch / 2); }
      g.fillStyle = neon ? c : fg; g.fillText(t, x + cw / 2, y + ch / 2);
      g.shadowBlur = 0;
    });
  }, false);
}

// ---------------------------------------------------------------- sprites
export function softDot() {
  return canvasTex("sprite:dot", 64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.8)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}
export function glowSprite() {
  return canvasTex("sprite:glow", 128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,0.75)"); gr.addColorStop(0.4, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}
export function lightPool() {
  return canvasTex("sprite:pool", 128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}
export function blobShadow() {
  return canvasTex("sprite:blob", 64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(0.55, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}
export function petalSprite() {
  return canvasTex("sprite:petal", 64, 64, (g, w) => {
    g.translate(w / 2, w / 2); g.rotate(0.6);
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, 0, w * 0.42, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(-w * 0.4, -1, w * 0.8, 2);
  }, false);
}
export function bubbleSprite() {
  return canvasTex("sprite:bubble", 64, 64, (g, w) => {
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, w / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.25)"; g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(w * 0.38, w * 0.36, w * 0.08, 0, Math.PI * 2); g.fill();
  }, false);
}
/** vertical gradient used for light shafts / auroras */
export function shaftTex() {
  return canvasTex("sprite:shaft", 64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0.0)"); gr.addColorStop(0.15, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(0.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
  }, false);
}

/** tileable wave normal map for water */
export function waterNormals() {
  return dataTex("water:normals", 256, 256, (g, w, h) => {
    const H = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = tfbm((x / w) * 8, (y / h) * 8, 8, 91, 4) + 0.5 * Math.sin((x / w) * Math.PI * 12 + tnoise((y / h) * 4, (x / w) * 4, 4, 3) * 4);
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = H[y * w + ((x + 1) % w)] - H[y * w + ((x - 1 + w) % w)], dy = H[((y + 1) % h) * w + x] - H[((y - 1 + h) % h) * w + x];
      const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1, l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4; d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

// ---------------------------------------------------------------- distant backdrop silhouettes
/** periodic 1D ridge noise in 0..1 (wraps around the ring seamlessly) */
function ridge1d(seed: number, K: number, rough: number) {
  const R = rng(seed), amps: number[] = [], ph: number[] = [];
  let tot = 0;
  for (let k = 1; k <= K; k++) { const a = 1 / Math.pow(k, rough); amps.push(a); ph.push(R() * Math.PI * 2); tot += a; }
  return (u: number) => { let s = 0; for (let k = 0; k < K; k++) s += amps[k] * Math.sin(u * Math.PI * 2 * (k + 1) + ph[k]); return 0.5 + 0.5 * s / tot * 1.6; };
}

/**
 * One ring layer, 1024 (or 2048) x 256. Colours are already hazed toward the horizon by the caller.
 * `night` adds lit windows / glows where it makes sense.
 */
export function backdrop(layer: BackdropLayer, idx: number, col: string, accent: string, hor: string, night: boolean, wide: boolean) {
  const W = wide ? 2048 : 1024, H = 256;
  const t = canvasTex(`bd:${layer.kind}:${idx}:${col}:${accent}:${hor}:${night}:${W}`, W, H, (g, w, h) => {
    const R = rng(1000 + idx * 77 + layer.kind.length * 13);
    const lit = shade(col, 1.25), dark = shade(col, 0.82);
    const fillProfile = (f: (u: number) => number, colTop = col, colBot = dark) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, colTop); gr.addColorStop(1, colBot);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) g.lineTo(x, h - f(x / w) * h);
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    const hazeBottom = () => { const gr = g.createLinearGradient(0, h * 0.55, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); const [hr, hg, hb] = rgb255(hor); gr.addColorStop(1, `rgba(${hr},${hg},${hb},0.65)`); g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over"; };
    const k = layer.kind;
    if (k === "hills" || k === "forest" || k === "jungle" || k === "pines") {
      const f = ridge1d(idx * 11 + 3, 10, 1.5), base = k === "hills" ? 0.2 : 0.25;
      const prof = (u: number) => base + f(u) * 0.35;
      fillProfile(prof, lit, dark);
      if (k !== "hills") {
        g.fillStyle = col;
        for (let x = 0; x < w; x += k === "jungle" ? 9 : 6) {
          const y = h - prof(x / w) * h, s = (k === "jungle" ? 10 : 7) + R() * 8;
          if (k === "pines") { g.beginPath(); g.moveTo(x - s * 0.45, y + 2); g.lineTo(x, y - s * 2.1); g.lineTo(x + s * 0.45, y + 2); g.fill(); }
          else { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }
        }
        if (k === "jungle") { // step pyramid peeking out
          const x = w * (0.3 + R() * 0.4), y = h - prof(x / w) * h + 6; g.fillStyle = dark;
          for (let i = 0; i < 6; i++) g.fillRect(x - 70 + i * 11, y - (i + 1) * 13, 140 - i * 22, 14);
        }
      }
    } else if (k === "mountains" || k === "alps" || k === "fjord" || k === "kilimanjaro" || k === "fuji" || k === "volcano" || k === "temples") {
      const tall = k === "alps" || k === "fjord" ? 1 : 0.8;
      const f = ridge1d(idx * 17 + 5, k === "fjord" ? 26 : 40, k === "alps" ? 0.95 : 1.15);
      let prof = (u: number) => 0.12 + Math.pow(f(u), 1.6) * 0.78 * tall;
      if (k === "fjord") { const f2 = prof; prof = (u: number) => { const v = f2(u); return v > 0.35 ? 0.35 + (v - 0.35) * 0.4 + 0.25 : v * 1.7; }; }
      const peaks: [number, number, number][] = [];
      if (k === "kilimanjaro" || k === "fuji" || k === "volcano") {
        const cx = 0.5, wd = k === "volcano" ? 0.14 : 0.22, ht = k === "fuji" ? 0.92 : k === "volcano" ? 0.96 : 0.62;
        peaks.push([cx, wd, ht]);
        const f0 = prof; prof = (u: number) => { const d = Math.abs(u - cx) / wd; const cone = d < 1 ? ht * (1 - Math.pow(d, k === "kilimanjaro" ? 1.6 : 1.15)) + 0.08 : 0; const crater = k === "volcano" && d < 0.12 ? -0.03 : 0; return Math.max(f0(u) * 0.55, cone + crater); };
      }
      fillProfile(prof, lit, dark);
      // rocky shading streaks
      g.globalCompositeOperation = "source-atop";
      for (let i = 0; i < 260; i++) { const x = R() * w, y = h - prof(x / w) * h + R() * h * 0.5; g.fillStyle = R() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 30, y + 30 + R() * 50); g.lineTo(x + 4, y); g.fill(); }
      if (layer.snow || k === "alps" || k === "fuji" || k === "kilimanjaro") {
        const line = k === "kilimanjaro" ? 0.6 : k === "fuji" ? 0.62 : 0.5;
        g.fillStyle = mixHex("#F4F8FF", hor, idx * 0.15);
        g.beginPath(); g.moveTo(0, 0);
        for (let x = 0; x <= w; x += 2) { const sl = (line + (tnoise(x / 18, 0, 1e6, 3) - 0.5) * 0.12) * h; g.lineTo(x, h - sl); }
        g.lineTo(w, 0); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = "source-over";
      if (k === "volcano") {
        const [cx] = peaks[0];
        const x = cx * w, y = h - prof(cx) * h;
        g.save(); g.globalCompositeOperation = "source-atop";
        g.strokeStyle = layer.glow ?? "#FF5A1F"; g.shadowColor = layer.glow ?? "#FF5A1F"; g.shadowBlur = 10; g.lineWidth = 3;
        for (let i = 0; i < 7; i++) { g.beginPath(); let px = x + (R() - 0.5) * 20, py = y + 6; g.moveTo(px, py); for (let s = 0; s < 8; s++) { px += (R() - 0.5) * 18 + (i - 3) * 3; py += 14; g.lineTo(px, py); } g.stroke(); }
        g.restore();
        const gr = g.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, "rgba(255,140,60,0.9)"); gr.addColorStop(1, "rgba(255,80,20,0)");
        g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 120);
        // smoke plume
        for (let i = 0; i < 26; i++) { const t = i / 26; g.fillStyle = `rgba(40,30,30,${0.35 * (1 - t)})`; g.beginPath(); g.arc(x + t * 160 + (R() - 0.5) * 20, y - 20 - t * 150, 16 + t * 46, 0, Math.PI * 2); g.fill(); }
      }
      if (k === "temples") {
        g.fillStyle = dark;
        for (let i = 0; i < 4; i++) { const x = w * (0.1 + 0.25 * i + R() * 0.1), y = h - prof(x / w) * h + 4; for (let t = 0; t < 4; t++) { const ww = 34 - t * 6; g.fillRect(x - ww / 2, y - t * 12 - 9, ww, 7); g.beginPath(); g.moveTo(x - ww / 2 - 6, y - t * 12 - 9); g.lineTo(x + ww / 2 + 6, y - t * 12 - 9); g.lineTo(x, y - t * 12 - 16); g.fill(); } g.fillRect(x - 1, y - 62, 2, 14); }
      }
    } else if (k === "mesas") {
      const f = ridge1d(idx * 13 + 7, 18, 1.1);
      const prof = (u: number) => { const v = f(u); const t = Math.min(1, Math.max(0, (v - 0.48) * 9)); return 0.14 + t * (0.42 + 0.08 * Math.sin(u * 40)) + v * 0.06; };
      fillProfile(prof, lit, dark);
      g.globalCompositeOperation = "source-atop";
      for (let y = 0; y < h; y += 7) { g.fillStyle = (y / 7) % 3 === 0 ? "rgba(255,255,255,0.10)" : (y / 7) % 3 === 1 ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0)"; g.fillRect(0, y, w, 4); }
      g.globalCompositeOperation = "source-over";
    } else if (k === "dunes") {
      const f = ridge1d(idx * 7 + 1, 12, 1.3);
      const prof = (u: number) => 0.12 + Math.pow(f(u), 1.3) * 0.4;
      fillProfile(prof, lit, col);
      g.globalCompositeOperation = "source-atop";
      for (let x = 0; x < w; x += 2) { const dv = prof((x + 2) / w) - prof(x / w); if (dv < 0) { g.fillStyle = "rgba(90,50,20,0.16)"; g.fillRect(x, h - prof(x / w) * h, 2, h); } }
      g.globalCompositeOperation = "source-over";
    } else if (k === "pyramids") {
      const f = ridge1d(idx * 5 + 2, 8, 1.4);
      fillProfile((u) => 0.08 + f(u) * 0.1, col, dark);
      for (let i = 0; i < 3 + idx; i++) {
        const x = w * (0.08 + R() * 0.84), s = (0.25 + R() * 0.4) * h;
        g.fillStyle = lit; g.beginPath(); g.moveTo(x - s, h * 0.86); g.lineTo(x, h * 0.86 - s); g.lineTo(x + s * 0.2, h * 0.86); g.fill();
        g.fillStyle = dark; g.beginPath(); g.moveTo(x + s * 0.2, h * 0.86); g.lineTo(x, h * 0.86 - s); g.lineTo(x + s, h * 0.86); g.fill();
      }
    } else if (k === "city" || k === "town") {
      const f = ridge1d(idx * 3 + 9, 6, 1.2);
      let x = 0;
      while (x < w) {
        const bw = (k === "town" ? 18 : 14) + R() * (k === "town" ? 30 : 40), bh = (k === "town" ? 0.12 + R() * 0.18 : 0.15 + Math.pow(R(), 1.6) * 0.7 * (0.6 + f(x / w) * 0.6)) * h;
        g.fillStyle = R() < 0.5 ? col : dark; g.fillRect(x, h - bh, bw, bh);
        if (k === "town") { g.beginPath(); g.moveTo(x - 3, h - bh); g.lineTo(x + bw / 2 + (R() - 0.5) * 8, h - bh - 14 - R() * 10); g.lineTo(x + bw + 3, h - bh); g.fill(); if (R() < 0.08) { g.fillRect(x + bw / 2 - 3, h - bh - 60, 6, 50); g.beginPath(); g.moveTo(x + bw / 2 - 7, h - bh - 58); g.lineTo(x + bw / 2, h - bh - 90); g.lineTo(x + bw / 2 + 7, h - bh - 58); g.fill(); } }
        else if (R() < 0.15) { g.fillRect(x + bw / 2 - 1, h - bh - 18, 2, 18); if (night) { g.fillStyle = "#FF3030"; g.fillRect(x + bw / 2 - 2, h - bh - 20, 4, 4); } }
        if (night || k === "town") {
          for (let wy = h - bh + 5; wy < h - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
            if (R() < (k === "town" ? 0.05 : 0.32)) { g.fillStyle = [accent, "#FFE2A0", "#BEE6FF", "#FFD08A"][Math.floor(R() * 4)]; g.globalAlpha = night ? 0.9 : 0.25; g.fillRect(wx, wy, 2, 3); g.globalAlpha = 1; }
          }
        } else {
          g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x, h - bh, 3, bh);
        }
        x += bw + (R() < 0.3 ? 4 : 0);
      }
    } else if (k === "islands") {
      for (let i = 0; i < 7; i++) {
        const cx = R() * w, s = 40 + R() * 110, ht = (0.08 + R() * 0.22) * h;
        g.fillStyle = i % 2 ? col : dark; g.beginPath(); g.moveTo(cx - s, h); g.quadraticCurveTo(cx - s * 0.3, h - ht * 1.6, cx, h - ht); g.quadraticCurveTo(cx + s * 0.4, h - ht * 1.5, cx + s, h); g.fill();
        for (let p = 0; p < 3; p++) { const px = cx + (R() - 0.5) * s, py = h - ht * 0.5; g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.moveTo(px, h); g.lineTo(px + 4, py - 20); g.stroke(); g.fillStyle = dark; g.beginPath(); g.ellipse(px + 4, py - 22, 9, 3, 0.3, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = col; g.fillRect(0, h - 4, w, 4);
    } else if (k === "ice") {
      for (let x = -20; x < w; x += 20 + R() * 40) {
        const ht = (0.15 + Math.pow(R(), 1.5) * 0.65) * h, s = 20 + R() * 50;
        g.fillStyle = R() < 0.5 ? col : lit; g.beginPath(); g.moveTo(x, h); g.lineTo(x + s * 0.3, h - ht); g.lineTo(x + s * 0.55, h - ht * 0.92); g.lineTo(x + s, h); g.fill();
        g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(x + s * 0.3, h - ht); g.lineTo(x + s * 0.55, h - ht * 0.92); g.lineTo(x + s * 0.42, h - ht * 0.6); g.fill();
      }
    } else if (k === "candy") {
      const f = ridge1d(idx * 19 + 4, 7, 1.6);
      fillProfile((u) => 0.15 + f(u) * 0.35, lit, col);
      for (let i = 0; i < 18; i++) {
        const x = R() * w, base = h - (0.15 + f(x / w) * 0.35) * h, ht = 30 + R() * 70;
        g.fillStyle = shade(col, 0.85); g.fillRect(x - 1.5, base - ht, 3, ht);
        g.fillStyle = [accent, "#FFE14A", "#7FD7FF", "#FFFFFF"][i % 4]; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, base - ht, 10 + R() * 12, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      }
    } else if (k === "craters") {
      const f = ridge1d(idx * 23 + 2, 30, 1.0);
      const prof = (u: number) => 0.06 + Math.pow(f(u), 2) * 0.32;
      fillProfile(prof, lit, dark);
      for (let i = 0; i < 9; i++) { const x = R() * w, s = 30 + R() * 80, y = h - prof(x / w) * h; g.fillStyle = lit; g.beginPath(); g.ellipse(x, y + 4, s, 6, 0, Math.PI, 0); g.fill(); }
    } else if (k === "clouds") {
      for (let i = 0; i < 70; i++) { const x = R() * w, y = h - R() * h * 0.45, r = 18 + R() * 40; const gr = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = col; g.fillRect(0, h * 0.8, w, h * 0.2);
    } else if (k === "mushrooms") {
      fillProfile(ridge1d(idx + 31, 8, 1.4), col, dark);
      for (let i = 0; i < 14; i++) {
        const x = R() * w, ht = (0.3 + R() * 0.45) * h, cap = 20 + R() * 40;
        g.fillStyle = dark; g.fillRect(x - 4, h - ht, 8, ht);
        g.fillStyle = col; g.beginPath(); g.ellipse(x, h - ht, cap, cap * 0.45, 0, Math.PI, 0); g.fill();
        if (layer.glow) { g.fillStyle = layer.glow; g.globalAlpha = 0.85; for (let s = 0; s < 5; s++) { g.beginPath(); g.arc(x + (R() - 0.5) * cap * 1.4, h - ht - R() * cap * 0.35, 2 + R() * 3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; }
      }
    } else if (k === "grid") {
      const f = ridge1d(idx * 29 + 6, 14, 1.0);
      const prof = (u: number) => 0.1 + Math.pow(f(u), 1.8) * 0.75;
      g.fillStyle = "rgba(8,4,20,0.92)"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 4) g.lineTo(x, h - prof(x / w) * h); g.lineTo(w, h); g.fill();
      g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.lineWidth = 2;
      g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, h - prof(x / w) * h); g.stroke();
      g.lineWidth = 1; g.globalAlpha = 0.5;
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x, h - prof(x / w) * h); g.stroke(); }
      for (let y = h; y > 0; y -= 18) { g.beginPath(); let on = false; for (let x = 0; x <= w; x += 4) { const top = h - prof(x / w) * h; if (y > top) { if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); } else on = false; } g.stroke(); }
      g.globalAlpha = 1; g.shadowBlur = 0;
    } else if (k === "coral" || k === "cliffs") {
      const f = ridge1d(idx * 37 + 1, 24, 1.1);
      const prof = (u: number) => (k === "cliffs" ? 0.2 + Math.pow(f(u), 1.2) * 0.55 : 0.12 + f(u) * 0.3);
      fillProfile(prof, lit, dark);
      if (k === "coral") for (let i = 0; i < 40; i++) {
        const x = R() * w, y = h - prof(x / w) * h + 3; g.strokeStyle = shade(col, 0.9 + R() * 0.3); g.lineWidth = 3;
        for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 30, y - 20, x + (R() - 0.5) * 26, y - 30 - R() * 30); g.stroke(); }
      }
    }
    if (k !== "grid" && k !== "clouds") hazeBottom();
  }, true);
  t.wrapT = THREE.ClampToEdgeWrapping; // no bleed of the opaque bottom row into the transparent top
  return t;
}
