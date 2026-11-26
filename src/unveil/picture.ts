// The hidden paintings of Arrow Unveil: one painter per gallery, each scene varied by the stage number (time of day,
// positions, colours, how many of each thing), drawn in 2D with gradients and shapes — no image files, so every one of
// the endless stages has a picture of its own.
import { rngFrom } from "../sudoku/rng";

type G = CanvasRenderingContext2D;
type R = ReturnType<typeof rngFrom>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function grad(g: G, y0: number, y1: number, stops: string[]) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
function disc(g: G, x: number, y: number, r: number, c: string | CanvasGradient) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function glow(g: G, x: number, y: number, r: number, c: string, a = 0.6) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(c, a)); gr.addColorStop(1, hexA(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
export function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function hills(g: G, w: number, h: number, base: number, amp: number, col: string | CanvasGradient, rng: R, k = 3) {
  const ph = rng.next() * 6, f = 1 + rng.next() * 2;
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 60) g.lineTo(x, base - Math.sin((x / w) * Math.PI * f + ph) * amp - Math.sin((x / w) * Math.PI * k * 2 + ph * 2) * amp * 0.3);
  g.lineTo(w, h); g.fill();
}
function mountains(g: G, w: number, h: number, base: number, peak: number, col: string, rng: R, n = 4, snow = false) {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, base);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n * 2; i++) { const x = (i / (n * 2)) * w, y = i % 2 ? base - peak * (0.6 + rng.next() * 0.4) : base - peak * rng.next() * 0.3; pts.push([x, y]); g.lineTo(x, y); }
  g.lineTo(w, h); g.lineTo(0, h); g.fill();
  if (snow) { g.fillStyle = "rgba(255,255,255,.85)"; for (let i = 1; i < pts.length; i += 2) { const [x, y] = pts[i]; const d = peak * 0.18; g.beginPath(); g.moveTo(x, y); g.lineTo(x - d * 0.9, y + d); g.lineTo(x - d * 0.3, y + d * 0.8); g.lineTo(x, y + d * 1.1); g.lineTo(x + d * 0.4, y + d * 0.8); g.lineTo(x + d * 0.9, y + d); g.fill(); } }
}
function tree(g: G, x: number, y: number, s: number, col: string, trunk = "#5a3a1e") { g.fillStyle = trunk; g.fillRect(x - s * 0.08, y - s * 0.3, s * 0.16, s * 0.3); g.fillStyle = col; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - s * (1.1 - k * 0.22)); g.lineTo(x - s * (0.32 + k * 0.08), y - s * (0.45 - k * 0.12)); g.lineTo(x + s * (0.32 + k * 0.08), y - s * (0.45 - k * 0.12)); g.fill(); } }
function roundTree(g: G, x: number, y: number, s: number, col: string) { g.fillStyle = "#5a3a1e"; g.fillRect(x - s * 0.07, y - s * 0.5, s * 0.14, s * 0.5); for (const [dx, dy, r] of [[0, -0.75, 0.38], [-0.25, -0.6, 0.3], [0.25, -0.6, 0.3], [0, -1, 0.28]]) disc(g, x + dx * s, y + dy * s, r * s, col); }
function stars(g: G, w: number, h: number, n: number, rng: R) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + rng.next() * 0.6})`; const r = 0.5 + rng.next() * 1.6; g.beginPath(); g.arc(rng.next() * w, rng.next() * h, r * (w / 400), 0, Math.PI * 2); g.fill(); } }
function cloud(g: G, x: number, y: number, s: number, c = "rgba(255,255,255,.85)") { for (const [dx, dy, r] of [[0, 0, 0.5], [0.45, 0.1, 0.38], [-0.45, 0.12, 0.36], [0.2, -0.25, 0.4]]) disc(g, x + dx * s, y + dy * s, r * s, c); }
function flower(g: G, x: number, y: number, s: number, c: string) { g.strokeStyle = "#3a8a3a"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s * 2); g.stroke(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; disc(g, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.42, c); } disc(g, x, y, s * 0.3, "#ffe27a"); }
function fish(g: G, x: number, y: number, s: number, c: string, flip: boolean) { g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(-s * 0.8, 0); g.lineTo(-s * 1.5, -s * 0.5); g.lineTo(-s * 1.5, s * 0.5); g.fill(); disc(g, s * 0.5, -s * 0.1, s * 0.13, "#fff"); disc(g, s * 0.53, -s * 0.1, s * 0.07, "#111"); g.restore(); }
function house(g: G, x: number, y: number, s: number, wall: string, roof: string, lit: boolean) { g.fillStyle = wall; g.fillRect(x - s / 2, y - s * 0.7, s, s * 0.7); g.fillStyle = roof; g.beginPath(); g.moveTo(x - s * 0.62, y - s * 0.68); g.lineTo(x, y - s * 1.15); g.lineTo(x + s * 0.62, y - s * 0.68); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x - s * 0.62, y - s * 0.68); g.lineTo(x, y - s * 1.15); g.lineTo(x + s * 0.62, y - s * 0.68); g.lineTo(x + s * 0.5, y - s * 0.62); g.lineTo(x, y - s * 1.02); g.lineTo(x - s * 0.5, y - s * 0.62); g.fill(); g.fillStyle = lit ? "#ffd86a" : "#40506a"; g.fillRect(x - s * 0.3, y - s * 0.5, s * 0.2, s * 0.2); g.fillRect(x + s * 0.1, y - s * 0.5, s * 0.2, s * 0.2); g.fillStyle = "#6a3a1e"; g.fillRect(x - s * 0.08, y - s * 0.28, s * 0.16, s * 0.28); }
function balloon(g: G, x: number, y: number, s: number, c1: string, c2: string) {
  g.strokeStyle = "rgba(60,40,20,.7)"; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(x - s * 0.35, y + s * 0.6); g.lineTo(x - s * 0.18, y + s * 1.05); g.moveTo(x + s * 0.35, y + s * 0.6); g.lineTo(x + s * 0.18, y + s * 1.05); g.stroke();
  g.fillStyle = "#8a5a2a"; g.fillRect(x - s * 0.2, y + s * 1.05, s * 0.4, s * 0.28);
  for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? c1 : c2; g.beginPath(); g.ellipse(x, y, s * (0.6 - k * 0.1), s * 0.75, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.3, s * 0.12, s * 0.25, -0.3, 0, Math.PI * 2); g.fill();
}

/** paint stage `stage` of gallery `id` into a w × h canvas context */
export function paintPicture(g: G, w: number, h: number, id: string, stage: number) {
  const rng = rngFrom(`unveil-pic:${id}:${stage}`), t = rng.next();
  g.save();
  switch (id) {
    case "sunset": {
      g.fillStyle = grad(g, 0, h * 0.6, [lerp(0, 1, t) > 0.5 ? "#2a1a5a" : "#ff7a6a", "#ff8a5a", "#ffd27a"]); g.fillRect(0, 0, w, h * 0.6);
      const sx = w * (0.25 + rng.next() * 0.5), sy = h * (0.4 + rng.next() * 0.12);
      glow(g, sx, sy, w * 0.45, "#ffe27a", 0.6); disc(g, sx, sy, w * 0.13, "#fff2b0");
      for (let i = 0; i < 4; i++) cloud(g, rng.next() * w, h * (0.1 + rng.next() * 0.25), w * (0.06 + rng.next() * 0.05), "rgba(255,190,170,.6)");
      g.fillStyle = grad(g, h * 0.58, h * 0.8, ["#ff7a8a", "#4a3a8a", "#1e2a5a"]); g.fillRect(0, h * 0.58, w, h * 0.25);
      for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,230,160,.5)"; g.fillRect(sx - w * 0.1 + rng.next() * w * 0.2, h * (0.6 + i * 0.015), w * (0.04 + rng.next() * 0.08), h * 0.004); }
      g.fillStyle = grad(g, h * 0.8, h, ["#ffd8a0", "#e8b070"]); g.beginPath(); g.moveTo(0, h * 0.84); g.quadraticCurveTo(w * 0.5, h * 0.78, w, h * 0.86); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      // a palm tree
      const px = rng.next() < 0.5 ? w * 0.15 : w * 0.85; g.strokeStyle = "#3a2010"; g.lineWidth = w * 0.025; g.beginPath(); g.moveTo(px, h * 0.95); g.quadraticCurveTo(px + w * 0.05, h * 0.7, px - w * 0.02, h * 0.5); g.stroke();
      g.fillStyle = "#1a3a1e"; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(px - w * 0.02 + Math.cos(a) * w * 0.08, h * 0.5 + Math.sin(a) * w * 0.03, w * 0.1, w * 0.022, a, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "lake": {
      g.fillStyle = grad(g, 0, h * 0.5, ["#6ab8ff", "#b8e0ff"]); g.fillRect(0, 0, w, h * 0.5);
      for (let i = 0; i < 3; i++) cloud(g, rng.next() * w, h * (0.08 + rng.next() * 0.15), w * 0.07);
      mountains(g, w, h, h * 0.5, h * 0.32, "#6a7aa8", rng, 3, true); mountains(g, w, h, h * 0.52, h * 0.2, "#4a6a8a", rng, 4, false);
      g.fillStyle = grad(g, h * 0.52, h, ["#3a8ac8", "#1e5a8a"]); g.fillRect(0, h * 0.52, w, h * 0.3);
      for (let i = 0; i < 12; i++) { g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(rng.next() * w, h * (0.55 + rng.next() * 0.25), w * 0.08, h * 0.004); }
      hills(g, w, h, h * 0.84, h * 0.04, "#3a8a3a", rng);
      for (let i = 0; i < 9; i++) tree(g, rng.next() * w, h * (0.86 + rng.next() * 0.1), w * (0.08 + rng.next() * 0.05), ["#1e5a2a", "#2a6a30", "#16482a"][i % 3]);
      break;
    }
    case "meadow": {
      g.fillStyle = grad(g, 0, h * 0.55, ["#5ab0ff", "#c0e8ff"]); g.fillRect(0, 0, w, h * 0.55);
      const sx = w * (0.2 + rng.next() * 0.6); glow(g, sx, h * 0.15, w * 0.3, "#fff6b0", 0.7); disc(g, sx, h * 0.15, w * 0.08, "#fff6c0");
      for (let i = 0; i < 3; i++) cloud(g, rng.next() * w, h * (0.1 + rng.next() * 0.2), w * 0.08);
      hills(g, w, h, h * 0.5, h * 0.06, "#7ac050", rng); hills(g, w, h, h * 0.62, h * 0.05, "#5aa83e", rng);
      for (let i = 0; i < 4; i++) roundTree(g, rng.next() * w, h * (0.5 + rng.next() * 0.08), w * 0.12, "#3a8a3a");
      const cols = ["#ff5f9a", "#ffd23f", "#ffffff", "#c07aff", "#ff8a3a", "#4ab0ff"];
      for (let i = 0; i < 55; i++) { const y = h * (0.66 + rng.next() * 0.32); flower(g, rng.next() * w, y, w * (0.012 + (y / h - 0.66) * 0.05), cols[rng.int(cols.length)]); }
      break;
    }
    case "city": {
      g.fillStyle = grad(g, 0, h, ["#0a0a2a", "#2a1a5a", "#7a2a6a"]); g.fillRect(0, 0, w, h);
      stars(g, w, h * 0.5, 60, rng);
      const mx = w * (0.2 + rng.next() * 0.6); glow(g, mx, h * 0.15, w * 0.2, "#fff0d0", 0.4); disc(g, mx, h * 0.15, w * 0.06, "#fff4d8");
      for (let layer = 0; layer < 3; layer++) {
        let x = -rng.next() * 20;
        while (x < w) {
          const bw = w * (0.06 + rng.next() * 0.08), bh = h * (0.25 + rng.next() * 0.35) * (1 - layer * 0.2);
          g.fillStyle = ["#1a1a3a", "#22224a", "#2a2a5a"][layer]; g.fillRect(x, h * 0.85 - bh, bw, bh + h * 0.2);
          for (let wy = h * 0.85 - bh + h * 0.02; wy < h * 0.83; wy += h * 0.03) for (let wx = x + bw * 0.15; wx < x + bw * 0.85; wx += bw * 0.25) if (rng.next() < 0.45) { g.fillStyle = ["#ffd86a", "#ff8ad0", "#6ae0ff"][rng.int(3)]; g.fillRect(wx, wy, bw * 0.12, h * 0.012); }
          x += bw + w * 0.01;
        }
      }
      g.fillStyle = grad(g, h * 0.85, h, ["#1a1a3a", "#4a2a6a"]); g.fillRect(0, h * 0.85, w, h * 0.15);
      for (let i = 0; i < 20; i++) { g.fillStyle = hexA(["#ff5fd0", "#4ae0ff", "#ffd23f"][i % 3], 0.4); g.fillRect(rng.next() * w, h * (0.87 + rng.next() * 0.1), w * 0.06, h * 0.004); }
      break;
    }
    case "desert": {
      const night = t > 0.65;
      g.fillStyle = grad(g, 0, h * 0.55, night ? ["#1a1040", "#5a3a7a"] : ["#ff9a4a", "#ffd88a"]); g.fillRect(0, 0, w, h * 0.55);
      if (night) stars(g, w, h * 0.5, 70, rng);
      const sx = w * (0.2 + rng.next() * 0.6); disc(g, sx, h * 0.25, w * 0.1, night ? "#fff4d8" : "#fff0b0");
      hills(g, w, h, h * 0.55, h * 0.07, night ? "#7a4a5a" : "#e0904a", rng, 2); hills(g, w, h, h * 0.68, h * 0.06, night ? "#9a5a5a" : "#f0aa5a", rng, 2); hills(g, w, h, h * 0.82, h * 0.05, night ? "#b06a5a" : "#ffc070", rng, 2);
      for (let i = 0; i < 3; i++) { const cx = w * (0.15 + rng.next() * 0.7), cy = h * (0.75 + rng.next() * 0.15), s = w * 0.05; g.fillStyle = "#2a7a4a"; g.fillRect(cx - s * 0.2, cy - s * 2, s * 0.4, s * 2); g.fillRect(cx - s * 0.75, cy - s * 1.4, s * 0.3, s * 0.7); g.fillRect(cx - s * 0.75, cy - s * 0.9, s * 0.7, s * 0.25); g.fillRect(cx + s * 0.45, cy - s * 1.6, s * 0.3, s * 0.8); g.fillRect(cx + s * 0.05, cy - s * 1.0, s * 0.7, s * 0.25); }
      // pyramids
      for (let i = 0; i < 2; i++) { const px = w * (0.25 + i * 0.4 + rng.next() * 0.1), ps = w * (0.16 - i * 0.04); g.fillStyle = night ? "#6a3a4a" : "#d88a3a"; g.beginPath(); g.moveTo(px - ps, h * 0.58); g.lineTo(px, h * 0.58 - ps * 0.9); g.lineTo(px + ps, h * 0.58); g.fill(); g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.moveTo(px, h * 0.58 - ps * 0.9); g.lineTo(px + ps, h * 0.58); g.lineTo(px + ps * 0.2, h * 0.58); g.fill(); }
      break;
    }
    case "aurora": {
      g.fillStyle = grad(g, 0, h, ["#020a1a", "#082a3a", "#0e3a4a"]); g.fillRect(0, 0, w, h); stars(g, w, h * 0.6, 90, rng);
      for (let k = 0; k < 4; k++) {
        const c = ["#5affc0", "#4ab0ff", "#c07aff", "#7affa0"][k], y0 = h * (0.12 + k * 0.08 + rng.next() * 0.05), ph = rng.next() * 6;
        for (let x = 0; x < w; x += 2) { const y = y0 + Math.sin(x / w * 6 + ph) * h * 0.05; const gr = g.createLinearGradient(0, y, 0, y + h * 0.22); gr.addColorStop(0, hexA(c, 0)); gr.addColorStop(0.3, hexA(c, 0.32)); gr.addColorStop(1, hexA(c, 0)); g.fillStyle = gr; g.fillRect(x, y, 2.5, h * 0.22); }
      }
      mountains(g, w, h, h * 0.75, h * 0.2, "#0a1a2a", rng, 3, true);
      g.fillStyle = grad(g, h * 0.75, h, ["#1a3a4a", "#2a5a6a"]); g.fillRect(0, h * 0.75, w, h * 0.25);
      for (let i = 0; i < 7; i++) tree(g, rng.next() * w, h * (0.86 + rng.next() * 0.12), w * (0.09 + rng.next() * 0.05), "#06141e");
      break;
    }
    case "blossom": {
      g.fillStyle = grad(g, 0, h, ["#ffd0e0", "#ffe8f0", "#b8e0ff"]); g.fillRect(0, 0, w, h);
      mountains(g, w, h, h * 0.6, h * 0.25, "#a8b8e0", rng, 1, true);
      hills(g, w, h, h * 0.75, h * 0.04, "#8ac86a", rng);
      // the tree
      const tx = w * (0.35 + rng.next() * 0.3);
      g.strokeStyle = "#5a2a2a"; g.lineCap = "round"; g.lineWidth = w * 0.05; g.beginPath(); g.moveTo(tx, h); g.quadraticCurveTo(tx - w * 0.05, h * 0.7, tx + w * 0.02, h * 0.5); g.stroke();
      g.lineWidth = w * 0.02; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(tx, h * (0.55 + k * 0.05)); g.lineTo(tx + (k % 2 ? 1 : -1) * w * (0.15 + rng.next() * 0.15), h * (0.4 + rng.next() * 0.15)); g.stroke(); }
      for (let i = 0; i < 90; i++) { const a = rng.next() * Math.PI * 2, r = rng.next() * w * 0.32; disc(g, tx + Math.cos(a) * r, h * 0.38 + Math.sin(a) * r * 0.55, w * (0.03 + rng.next() * 0.03), ["#ff9ac0", "#ffb8d8", "#ffd0e4", "#ff7aa8"][rng.int(4)]); }
      for (let i = 0; i < 30; i++) disc(g, rng.next() * w, rng.next() * h, w * 0.008, "#ffb8d8");
      break;
    }
    case "reef": {
      g.fillStyle = grad(g, 0, h, ["#4ae0ff", "#1a8ac8", "#0a3a6a"]); g.fillRect(0, 0, w, h);
      for (let k = 0; k < 6; k++) { g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); const x = rng.next() * w; g.moveTo(x, 0); g.lineTo(x + w * 0.12, 0); g.lineTo(x + w * 0.3, h * 0.8); g.lineTo(x + w * 0.2, h * 0.8); g.fill(); }
      g.fillStyle = "#e8c890"; g.beginPath(); g.moveTo(0, h * 0.85); g.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.88); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      for (let i = 0; i < 7; i++) { const x = rng.next() * w, c = ["#ff7a5a", "#ff5fa0", "#ffd23f", "#c07aff"][i % 4]; g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = w * 0.025; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, h * 0.9); g.quadraticCurveTo(x + (k - 1.5) * w * 0.05, h * 0.78, x + (k - 1.5) * w * 0.07, h * (0.68 + rng.next() * 0.08)); g.stroke(); } }
      for (let i = 0; i < 8; i++) { g.strokeStyle = "#2a9a5a"; g.lineWidth = w * 0.012; const x = rng.next() * w; g.beginPath(); g.moveTo(x, h); for (let y = h; y > h * 0.6; y -= h * 0.03) g.lineTo(x + Math.sin(y / h * 20) * w * 0.015, y); g.stroke(); }
      for (let i = 0; i < 9; i++) fish(g, rng.next() * w, h * (0.15 + rng.next() * 0.55), w * (0.035 + rng.next() * 0.03), ["#ffd23f", "#ff7a3a", "#4ae0ff", "#ff5fa0", "#ffffff"][i % 5], rng.next() < 0.5);
      for (let i = 0; i < 25; i++) { g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; g.beginPath(); g.arc(rng.next() * w, rng.next() * h * 0.7, w * (0.004 + rng.next() * 0.008), 0, Math.PI * 2); g.stroke(); }
      break;
    }
    case "autumn": {
      g.fillStyle = grad(g, 0, h * 0.6, ["#ffb070", "#ffe0a0"]); g.fillRect(0, 0, w, h * 0.6);
      const sx = w * (0.2 + rng.next() * 0.6); glow(g, sx, h * 0.3, w * 0.35, "#fff0b0", 0.6);
      hills(g, w, h, h * 0.55, h * 0.06, "#c07a3a", rng);
      for (let i = 0; i < 12; i++) roundTree(g, rng.next() * w, h * (0.6 + rng.next() * 0.3), w * (0.1 + rng.next() * 0.08), ["#e0602a", "#ffa02a", "#c0302a", "#ffc83a"][rng.int(4)]);
      g.fillStyle = grad(g, h * 0.88, h, ["#8a4a1e", "#6a3a1a"]); g.fillRect(0, h * 0.9, w, h * 0.1);
      for (let i = 0; i < 40; i++) { g.fillStyle = ["#e0602a", "#ffa02a", "#ffc83a"][rng.int(3)]; g.beginPath(); g.ellipse(rng.next() * w, rng.next() * h, w * 0.012, w * 0.006, rng.next() * 3, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "space": {
      g.fillStyle = grad(g, 0, h, ["#05051a", "#120a30", "#1a0a3a"]); g.fillRect(0, 0, w, h); stars(g, w, h, 160, rng);
      for (let k = 0; k < 3; k++) glow(g, rng.next() * w, rng.next() * h, w * (0.2 + rng.next() * 0.2), ["#b07aff", "#4ab0ff", "#ff7ab0"][k], 0.35);
      const px = w * (0.3 + rng.next() * 0.4), py = h * (0.35 + rng.next() * 0.2), pr = w * (0.18 + rng.next() * 0.08);
      const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); const pc = ["#ff9a5a", "#5ac8ff", "#c07aff", "#7affa0"][rng.int(4)];
      pg.addColorStop(0, "#ffffff"); pg.addColorStop(0.2, pc); pg.addColorStop(1, "#1a1030"); disc(g, px, py, pr, pg);
      g.strokeStyle = "rgba(255,230,180,.7)"; g.lineWidth = w * 0.015; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.35, -0.3, 0, Math.PI * 2); g.stroke();
      disc(g, w * (0.1 + rng.next() * 0.2), h * (0.75 + rng.next() * 0.15), w * 0.05, "#d0d0e0"); disc(g, w * (0.75 + rng.next() * 0.15), h * 0.15, w * 0.03, "#ffd27a");
      // a little rocket
      const rx = w * (0.15 + rng.next() * 0.7), ry = h * (0.7 + rng.next() * 0.15), rs = w * 0.05; g.save(); g.translate(rx, ry); g.rotate(-0.6); g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(0, 0, rs * 0.4, rs, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ff5a5a"; g.beginPath(); g.moveTo(-rs * 0.4, rs * 0.4); g.lineTo(-rs * 0.8, rs); g.lineTo(-rs * 0.3, rs * 0.8); g.fill(); g.beginPath(); g.moveTo(rs * 0.4, rs * 0.4); g.lineTo(rs * 0.8, rs); g.lineTo(rs * 0.3, rs * 0.8); g.fill(); disc(g, 0, -rs * 0.2, rs * 0.18, "#4ab0ff"); glow(g, 0, rs * 1.2, rs * 0.7, "#ffb03a", 0.9); g.restore();
      break;
    }
    case "village": {
      g.fillStyle = grad(g, 0, h * 0.6, t > 0.5 ? ["#1a2a5a", "#4a5a8a"] : ["#8ab8e0", "#d0e8ff"]); g.fillRect(0, 0, w, h * 0.6);
      if (t > 0.5) { stars(g, w, h * 0.4, 50, rng); disc(g, w * 0.8, h * 0.12, w * 0.05, "#fff4d8"); }
      mountains(g, w, h, h * 0.55, h * 0.22, "#c8d8f0", rng, 3, true);
      g.fillStyle = "#f4f8ff"; g.fillRect(0, h * 0.55, w, h * 0.45); hills(g, w, h, h * 0.62, h * 0.03, "#e8f0ff", rng);
      for (let i = 0; i < 6; i++) tree(g, rng.next() * w, h * (0.62 + rng.next() * 0.08), w * 0.09, "#2a5a4a");
      const roofs = ["#e04a4a", "#4aa0ff", "#4ac080", "#a07aff"];
      for (let i = 0; i < 5; i++) house(g, w * (0.1 + i * 0.2 + rng.next() * 0.05), h * (0.82 + rng.next() * 0.08), w * (0.13 + rng.next() * 0.04), ["#f0d0a0", "#e8c090", "#fff0d8"][i % 3], roofs[rng.int(roofs.length)], t > 0.5);
      for (let i = 0; i < 70; i++) disc(g, rng.next() * w, rng.next() * h, w * (0.003 + rng.next() * 0.006), "rgba(255,255,255,.9)");
      break;
    }
    default: { // balloons
      g.fillStyle = grad(g, 0, h, ["#5ab0ff", "#a8d8ff", "#ffe8c0"]); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) cloud(g, rng.next() * w, h * (0.1 + rng.next() * 0.5), w * (0.06 + rng.next() * 0.05));
      hills(g, w, h, h * 0.82, h * 0.05, "#7ac050", rng); hills(g, w, h, h * 0.9, h * 0.04, "#5aa83e", rng);
      const cs = [["#ff5a5a", "#ffd23f"], ["#4ab0ff", "#ffffff"], ["#7ad04a", "#ffd23f"], ["#ff8ad0", "#a07aff"], ["#ff8a3a", "#ff5a5a"]];
      for (let i = 0; i < 6; i++) { const c = cs[rng.int(cs.length)]; balloon(g, w * (0.1 + rng.next() * 0.8), h * (0.15 + rng.next() * 0.55), w * (0.06 + rng.next() * 0.06), c[0], c[1]); }
    }
  }
  g.restore();
}
