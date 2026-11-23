// Canvas-drawn textures for Orbi GP: road tiles, edge stripes, wood, stone, clouds, glows, chevrons, the chequered
// finish and every marble skin. Drawn once and cached; nothing is downloaded.
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { repeat?: boolean; srgb?: boolean } = {}) {
  const hit = cache.get(key); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
const rnd = (seed: number) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };
const shade = (c: string, k: number) => { const o = new THREE.Color(c); if (k > 0) o.lerp(new THREE.Color("#ffffff"), k); else o.lerp(new THREE.Color("#000000"), -k); return "#" + o.getHexString(); };

/** the road's top: big soft tiles with a fine grain (tinted by the material colour) */
export function roadTex(line: string, look = "road") {
  return canvasTex(`road:${line}:${look}`, 256, 256, (g, w, h) => {
    const r = rnd(7);
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 228 + Math.floor(r() * 27); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 2, 2); }
    if (look === "plank" || look === "beam") {
      g.fillStyle = "rgba(90,60,30,0.25)"; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 4);
      for (let i = 0; i < 18; i++) { g.strokeStyle = "rgba(120,80,40,0.18)"; g.lineWidth = 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); g.stroke(); }
    } else {
      g.strokeStyle = line; g.globalAlpha = 0.55; g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, w - 3, h - 3);
      g.globalAlpha = 0.18; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      g.globalAlpha = 1;
    }
  }, { repeat: true });
}
/** red–white (or the world's two colours) edge stripes, painted at an angle like a race kerb */
export function stripeTex(a: string, b: string) {
  return canvasTex(`stripe:${a}:${b}`, 128, 64, (g, w, h) => {
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    g.fillStyle = a;
    for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 32 + h * 0.6, 0); g.lineTo(x + h * 0.6, 0); g.closePath(); g.fill(); }
  }, { repeat: true });
}
export function checkerTex() {
  return canvasTex("checker", 128, 128, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect((x * w) / 8, (y * h) / 8, w / 8, h / 8); } }, { repeat: true });
}
/** soft round glow (sprites, sun, pickups) */
export function glowTex(color = "#ffffff") {
  return canvasTex(`glow:${color}`, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color + "cc"); gr.addColorStop(1, color + "00");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
/** a fluffy cloud puff */
export function puffTex() {
  return canvasTex("puff", 256, 160, (g, w, h) => {
    const r = rnd(11);
    for (let i = 0; i < 22; i++) {
      const x = w * (0.18 + r() * 0.64), y = h * (0.42 + r() * 0.3), rad = w * (0.08 + r() * 0.13);
      const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
      gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.7, "rgba(245,248,255,0.65)"); gr.addColorStop(1, "rgba(235,240,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  });
}
/** the endless cloud sea below the islands */
export function cloudFloorTex() {
  return canvasTex("cloudfloor", 512, 512, (g, w, h) => {
    const r = rnd(5);
    g.fillStyle = "#e9eef7"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rad = 18 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); }
    }
  }, { repeat: true });
}
/** chevrons for boost pads and speed arrows */
export function arrowTex(color = "#7CF2FF") {
  return canvasTex(`arrow:${color}`, 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16;
    for (let k = 0; k < 3; k++) { const y = h * 0.78 - k * h * 0.26; g.beginPath(); g.moveTo(w * 0.15, y); g.lineTo(w * 0.5, y - h * 0.16); g.lineTo(w * 0.85, y); g.lineTo(w * 0.85, y + h * 0.08); g.lineTo(w * 0.5, y - h * 0.08); g.lineTo(w * 0.15, y + h * 0.08); g.closePath(); g.fill(); }
  });
}
/** painted zones: ice, honey, sand, lava, conveyor, wind, vent, low gravity */
export function zoneTex(kind: string) {
  return canvasTex(`zone:${kind}`, 128, 128, (g, w, h) => {
    const r = rnd(kind.length * 31);
    const base: Record<string, string> = {
      ice: "#BFEFFF", sticky: "#F2A922", sand: "#E8C27A", lava: "#FF5A14", conveyor: "#3A3E48", speed: "#2EC4FF", wind: "#CFE8FF", vent: "#4A5058", lowg: "#B88CFF", heavyg: "#5A3A8A",
      swirl: "#22124A", hole: "#05030C", trap: "#C8283A", town: "#56606E", paint1: "#FF4A8A", paint2: "#2EA8FF", rumble: "#FFFFFF", belt: "#3A3E48", spores: "#7ACB4A", hands: "#3A2A5A",
      gust: "#CFE8FF", tornado: "#B8C8E0", solar: "#FFE9A8", petals: "#FFD0E8",
    };
    g.fillStyle = base[kind] ?? "#888"; g.fillRect(0, 0, w, h);
    if (kind === "swirl" || kind === "hole") {
      g.translate(w / 2, h / 2);
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.strokeStyle = kind === "hole" ? "rgba(160,90,255,0.75)" : "rgba(190,140,255,0.55)"; g.lineWidth = 5; g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 2.2, rr = t * w * 0.5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0); return;
    }
    if (kind === "trap" || kind === "rumble") { g.fillStyle = kind === "trap" ? "#FFFFFF" : "#E8344A"; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 16); return; }
    if (kind === "town") { g.fillStyle = "#F4F4F4"; for (let x = 8; x < w; x += 32) g.fillRect(x, 0, 16, h * 0.4); g.fillStyle = "#FFD23A"; g.fillRect(w / 2 - 3, h * 0.5, 6, h * 0.5); return; }
    if (kind === "paint1" || kind === "paint2") { for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 12, 0, 7); g.fill(); } return; }
    if (kind === "belt") { g.fillStyle = "#FFC600"; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x + 24, h * 0.2); g.lineTo(x + 8, h * 0.5); g.lineTo(x + 24, h * 0.8); g.lineTo(x + 30, h * 0.8); g.lineTo(x + 14, h * 0.5); g.lineTo(x + 30, h * 0.2); g.fill(); } return; }
    if (kind === "spores" || kind === "hands") { for (let i = 0; i < 26; i++) { g.fillStyle = kind === "spores" ? `rgba(210,255,140,${0.3 + r() * 0.5})` : `rgba(160,120,255,${0.3 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 5 + r() * 14, 0, 7); g.fill(); } return; }
    if (kind === "ice") { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); } }
    else if (kind === "sticky") { for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,220,120,${0.3 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 9, 0, 7); g.fill(); } }
    else if (kind === "sand") { for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,240,200,0.5)" : "rgba(170,120,60,0.35)"; g.fillRect(r() * w, r() * h, 2, 2); } }
    else if (kind === "lava") { for (let i = 0; i < 26; i++) { const gr = g.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 20 + r() * 30); gr.addColorStop(0, "rgba(255,230,90,0.9)"); gr.addColorStop(1, "rgba(255,90,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); } g.strokeStyle = "rgba(60,10,0,0.6)"; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); } }
    else if (kind === "conveyor") { g.fillStyle = "#FFC600"; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(w * 0.2, y + 24); g.lineTo(w * 0.5, y + 8); g.lineTo(w * 0.8, y + 24); g.lineTo(w * 0.8, y + 30); g.lineTo(w * 0.5, y + 14); g.lineTo(w * 0.2, y + 30); g.fill(); } }
    else if (kind === "speed") { g.fillStyle = "rgba(255,255,255,0.85)"; for (let y = 0; y < h; y += 42) { g.beginPath(); g.moveTo(w * 0.15, y + 34); g.lineTo(w * 0.5, y + 6); g.lineTo(w * 0.85, y + 34); g.lineTo(w * 0.7, y + 34); g.lineTo(w * 0.5, y + 18); g.lineTo(w * 0.3, y + 34); g.fill(); } }
    else if (kind === "vent") { g.fillStyle = "#2A2E36"; for (let x = 6; x < w; x += 16) g.fillRect(x, 0, 8, h); }
    else { g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 3; for (let i = 0; i < 10; i++) { const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 10, w * 0.7, y + 10, w, y); g.stroke(); } }
  }, { repeat: true });
}

// ---------------------------------------------------------------- marble skins
export interface Skin { name: string; tex?: () => THREE.Texture; color: string; metal?: number; rough?: number; glass?: boolean; tint?: string; glow?: string; emissiveMap?: () => THREE.Texture; price?: number }
const ball = (key: string, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => () => canvasTex(`skin:${key}`, 512, 256, draw);
export const SKINS: Skin[] = [
  { name: "Orbi", color: "#9FE8FF", glass: true, glow: "#5CF2FF" },
  { name: "Turbo", color: "#E8344A", rough: 0.22, tex: ball("turbo", (g, w, h) => { g.fillStyle = "#E8344A"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(0, h * 0.42, w, h * 0.06); g.fillRect(0, h * 0.52, w, h * 0.06); g.fillStyle = "#1a1a1a"; g.font = `bold ${h * 0.22}px sans-serif`; g.textAlign = "center"; g.fillText("7", w * 0.25, h * 0.36); g.fillText("7", w * 0.75, h * 0.36); }) },
  { name: "Zib", color: "#7A4AE8", rough: 0.3, tex: ball("zib", (g, w, h) => { g.fillStyle = "#6A3AD8"; g.fillRect(0, 0, w, h); const r = rnd(3); g.fillStyle = "#FFD23A"; for (let i = 0; i < 40; i++) { const x = r() * w, y = h * 0.1 + r() * h * 0.8, s = 6 + r() * 10; g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5, rr = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); } }) },
  { name: "Gloop", color: "#5CD65A", rough: 0.12, tex: ball("gloop", (g, w, h) => { g.fillStyle = "#3EC24A"; g.fillRect(0, 0, w, h); const r = rnd(9); for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(180,255,150,${0.3 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 22, 0, 7); g.fill(); } }) },
  { name: "Pip", color: "#FF9A2E", rough: 0.35, tex: ball("pip", (g, w, h) => { const c = ["#FF9A2E", "#FFFFFF", "#3A8BF0", "#FFFFFF", "#FFD23A", "#FFFFFF"]; for (let i = 0; i < 6; i++) { g.fillStyle = c[i]; g.fillRect((i * w) / 6, 0, w / 6 + 1, h); } }) },
  { name: "Tiki", color: "#2EC4B6", rough: 0.4, tex: ball("tiki", (g, w, h) => { g.fillStyle = "#1EA898"; g.fillRect(0, 0, w, h); g.strokeStyle = "#FFE6A0"; g.lineWidth = 8; for (let y = h * 0.2; y < h; y += h * 0.3) { g.beginPath(); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 14 : -14)); g.stroke(); } }) },
  { name: "Klonk", color: "#C8D0DA", metal: 1, rough: 0.18, tex: ball("klonk", (g, w, h) => { g.fillStyle = "#B8C2CE"; g.fillRect(0, 0, w, h); g.fillStyle = "#7A8494"; for (let x = 16; x < w; x += 64) for (let y = 20; y < h; y += 56) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } g.fillStyle = "#E8344A"; g.fillRect(0, h * 0.47, w, h * 0.06); }) },
  {
    name: "Magma", color: "#2A1410", rough: 0.6,
    tex: ball("magma", (g, w, h) => { g.fillStyle = "#221010"; g.fillRect(0, 0, w, h); const r = rnd(21); g.strokeStyle = "#FF6A1A"; g.lineWidth = 4; for (let i = 0; i < 24; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }),
    glow: "#FF6A1A",
    emissiveMap: ball("magmaE", (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); const r = rnd(21); g.strokeStyle = "#FF8A2A"; g.lineWidth = 5; for (let i = 0; i < 24; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }),
  },
  { name: "Nova", color: "#1A1450", rough: 0.15, tex: ball("nova", (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1A0A48"); gr.addColorStop(0.5, "#3A1A8A"); gr.addColorStop(1, "#0A2A6A"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * w, r() * h, 2, 2); } for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * h, gg = g.createRadialGradient(x, y, 0, x, y, 50); gg.addColorStop(0, "rgba(255,120,220,0.5)"); gg.addColorStop(1, "rgba(255,120,220,0)"); g.fillStyle = gg; g.fillRect(0, 0, w, h); } }) },
  { name: "Swirl", color: "#FF7AC8", rough: 0.2, tex: ball("swirl", (g, w, h) => { g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.fillStyle = "#FF5AA8"; for (let x = -h; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); } }) },
  { name: "Kicky", color: "#FFFFFF", rough: 0.45, tex: ball("kicky", (g, w, h) => { g.fillStyle = "#F6F6F6"; g.fillRect(0, 0, w, h); g.fillStyle = "#1A1A1A"; for (let x = 32; x < w; x += 96) for (let y = 40; y < h; y += 90) { const yy = y + ((x / 96) % 2) * 40; g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 22, yy + Math.sin(a) * 22); } g.fill(); } }) },
  { name: "Terra", color: "#3A8BF0", rough: 0.4, tex: ball("terra", (g, w, h) => { g.fillStyle = "#2A7AE0"; g.fillRect(0, 0, w, h); const r = rnd(13); for (let i = 0; i < 12; i++) { g.fillStyle = r() < 0.7 ? "#4CB050" : "#E8D08A"; g.beginPath(); const x = r() * w, y = h * 0.15 + r() * h * 0.7; for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; g.lineTo(x + Math.cos(a) * (20 + r() * 30), y + Math.sin(a) * (14 + r() * 20)); } g.fill(); } g.fillStyle = "#fff"; g.fillRect(0, 0, w, h * 0.06); g.fillRect(0, h * 0.94, w, h * 0.06); }) },
  { name: "Goldie", color: "#FFC24A", metal: 1, rough: 0.12 },
];

/** a patterned ball skin (stripes, dots, bands, checks, spots, zigzags, stars, swirls, craters, gradients) */
function pat(key: string, bg: string, fg: string, kind: string, fg2 = fg) {
  return ball(key, (g, w, h) => {
    const r = rnd(key.length * 17 + 3);
    if (kind === "gradient") { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg); gr.addColorStop(1, fg); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { g.fillStyle = `${fg2}55`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 40, 12 + r() * 20, 0, 0, 7); g.fill(); } return; }
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg;
    if (kind === "stripes") for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 28, h);
    else if (kind === "bands") { const c = [fg, fg2, bg, fg2]; for (let i = 0; i < 8; i++) { g.fillStyle = c[i % 4]; g.fillRect(0, (i * h) / 8, w, h / 8 + 1); } }
    else if (kind === "rainbow") { const c = ["#FF5A7A", "#FF9A2E", "#FFD23A", "#5CD65A", "#3A8BF0", "#9A5AE8"]; for (let i = 0; i < 6; i++) { g.fillStyle = c[i]; g.fillRect(0, (i * h) / 6, w, h / 6 + 1); } }
    else if (kind === "dots") for (let x = 24; x < w; x += 64) for (let y = 24; y < h; y += 56) { g.beginPath(); g.arc(x + ((y / 56) % 2) * 32, y, 12, 0, 7); g.fill(); }
    else if (kind === "check") for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) { if ((x / 32 + y / 32) % 2) g.fillRect(x, y, 32, 32); }
    else if (kind === "spots") for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? fg : fg2; g.beginPath(); g.ellipse(r() * w, r() * h, 14 + r() * 30, 10 + r() * 22, r() * 3, 0, 7); g.fill(); }
    else if (kind === "zigzag") { g.strokeStyle = fg; g.lineWidth = 12; for (let x = 0; x < w; x += 46) { g.beginPath(); for (let y = 0; y <= h; y += 24) g.lineTo(x + ((y / 24) % 2 ? 14 : -6), y); g.stroke(); } }
    else if (kind === "stars") { for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * w, r() * h, 2, 2); } for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h, gg = g.createRadialGradient(x, y, 0, x, y, 60); gg.addColorStop(0, fg + "99"); gg.addColorStop(1, fg + "00"); g.fillStyle = gg; g.fillRect(0, 0, w, h); } }
    else if (kind === "swirl") { for (let x = -h; x < w; x += 56) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 26, h); g.lineTo(x + 26 + h, 0); g.lineTo(x + h, 0); g.fill(); } }
    else if (kind === "craters") for (let i = 0; i < 30; i++) { const x = r() * w, y = r() * h, s = 5 + r() * 18; g.fillStyle = fg; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.fillStyle = fg2; g.beginPath(); g.arc(x + s * 0.2, y + s * 0.2, s * 0.7, 0, 7); g.fill(); }
  });
}
// the collection: glass, metal, candy, planets, animals and more (they look different but all roll the same)
SKINS.push(
  { name: "Ruby", color: "#FF5A7A", glass: true, tint: "#FF6A8A", glow: "#FF5A7A", price: 1200 },
  { name: "Emerald", color: "#3FDF8A", glass: true, tint: "#5AF2A0", glow: "#3FDF8A", price: 1200 },
  { name: "Amber", color: "#FFB03A", glass: true, tint: "#FFC060", glow: "#FFB03A", price: 1200 },
  { name: "Amethyst", color: "#B88CFF", glass: true, tint: "#C8A0FF", glow: "#B88CFF", price: 1200 },
  { name: "Silver", color: "#E0E6EE", metal: 1, rough: 0.1, price: 900 },
  { name: "Bronze", color: "#CD7F32", metal: 1, rough: 0.22, price: 900 },
  { name: "Rosie", color: "#E8A090", metal: 1, rough: 0.14, price: 900 },
  { name: "Chromo", color: "#4A8AFF", metal: 1, rough: 0.1, price: 900 },
  { name: "Minty", color: "#E8344A", rough: 0.2, tex: pat("mint", "#FFFFFF", "#E8344A", "swirl"), price: 450 },
  { name: "Bubbles", color: "#FF8AD8", rough: 0.2, tex: pat("bubble", "#FF8AD8", "#FFFFFF", "dots"), price: 450 },
  { name: "Lemony", color: "#FFE14D", rough: 0.25, tex: pat("lemon", "#FFE14D", "#FFFFFF", "stripes"), price: 450 },
  { name: "Grapey", color: "#8A4AE8", rough: 0.25, tex: pat("grape", "#6A2AC8", "#B88CFF", "dots"), price: 450 },
  { name: "Marz", color: "#D8582A", rough: 0.6, tex: pat("mars", "#C8482A", "#A8381A", "craters", "#E86A3A"), price: 600 },
  { name: "Jupi", color: "#E8B07A", rough: 0.5, tex: pat("jupi", "#F2D0A0", "#C88A5A", "bands", "#E8B07A"), price: 600 },
  { name: "Luna", color: "#C8CCD4", rough: 0.7, tex: pat("luna", "#C8CCD4", "#A8ACB4", "craters", "#D8DCE4"), price: 600 },
  { name: "Neppy", color: "#3A6AE8", rough: 0.3, tex: pat("nep", "#5A9AFF", "#1A3AA8", "gradient", "#FFFFFF"), price: 600 },
  { name: "Panda", color: "#FFFFFF", rough: 0.45, tex: pat("panda", "#F6F6F6", "#1A1A1A", "spots", "#1A1A1A"), price: 500 },
  { name: "Tigra", color: "#FF8A1E", rough: 0.4, tex: pat("tiger", "#FF8A1E", "#1A1A1A", "zigzag"), price: 500 },
  { name: "Ladybug", color: "#E8344A", rough: 0.25, tex: pat("lady", "#E8344A", "#1A1A1A", "dots"), price: 500 },
  { name: "Froggy", color: "#5CD65A", rough: 0.3, tex: pat("frog", "#5CD65A", "#2E8A3A", "spots", "#8AF27A"), price: 500 },
  { name: "Galaxy", color: "#2A1A6A", rough: 0.15, tex: pat("galaxy", "#120A38", "#FF7CF0", "stars"), price: 800 },
  { name: "Lava Lamp", color: "#FF5AB8", rough: 0.2, tex: pat("lavalamp", "#FF5AB8", "#FFB03A", "gradient", "#FFFFFF"), price: 700 },
  { name: "Rainbow", color: "#FFD23A", rough: 0.2, tex: pat("rainbow", "#FFFFFF", "#FFFFFF", "rainbow"), price: 1000 },
  { name: "Checkers", color: "#1A1A1A", rough: 0.3, tex: pat("check", "#FFFFFF", "#1A1A1A", "check"), price: 500 },
  { name: "Gridder", color: "#5CF2FF", rough: 0.2, tex: pat("grid", "#0A1030", "#5CF2FF", "check"), glow: "#5CF2FF", price: 800 },
  { name: "Frosty", color: "#BFEFFF", rough: 0.1, tex: pat("frost", "#BFEFFF", "#FFFFFF", "stars"), price: 700 },
);
/** what a marble costs in the collection (Orbi is free) */
export const skinPrice = (i: number) => (i === 0 ? 0 : SKINS[i]?.price ?? 300 + i * 30);

/** a big glowing letter (O-R-B-I pickups) */
export function letterTex(ch: string) {
  return canvasTex(`letter:${ch}`, 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = `900 ${h * 0.86}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 14; g.strokeStyle = "#1A2A6A"; g.strokeText(ch, w / 2, h * 0.54);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#FFF6B0"); gr.addColorStop(1, "#FF9F1C");
    g.fillStyle = gr; g.fillText(ch, w / 2, h * 0.54);
  });
}
/** Kranky's face plate for his machines (the eye and the grin) */
export function krankyTex(eye: string) {
  return canvasTex(`kranky:${eye}`, 256, 256, (g, w, h) => {
    g.fillStyle = "#20242E"; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h * 0.42, 4, w / 2, h * 0.42, w * 0.3); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.35, eye); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.28, 0, 7); g.fill();
    g.strokeStyle = eye; g.lineWidth = 10; g.beginPath(); g.moveTo(w * 0.22, h * 0.78); for (let k = 0; k <= 6; k++) g.lineTo(w * (0.22 + k * 0.093), h * (k % 2 ? 0.72 : 0.82)); g.stroke();
  });
}

/** the glowing swirl inside Orbi's glass */
export function swirlTex() {
  return canvasTex("swirl-core", 256, 256, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    for (let k = 0; k < 3; k++) {
      g.rotate((Math.PI * 2) / 3);
      const gr = g.createLinearGradient(0, 0, w / 2, 0); gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.5, k === 0 ? "#5CF2FF" : k === 1 ? "#FF7CF0" : "#FFD23A"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.strokeStyle = gr; g.lineWidth = 26; g.lineCap = "round";
      g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 1.4, rr = t * w * 0.48; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke();
    }
  });
}
export { shade };
