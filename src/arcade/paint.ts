// Clay-style 2D painting: soft lit blobs with a gloss highlight, googly eyes, sticker text.
// Matches the 3D clay characters (warm key light from top-left, soft contact shadows).

export type G = CanvasRenderingContext2D;
export const FONT = '"Lilita One", "Fredoka", system-ui, sans-serif';
export const UI_FONT = '"Fredoka", system-ui, sans-serif';
export const NAVY = "#23305A";
export const INK = "#1B1420";

// ---------------------------------------------------------------- colour helpers
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
export const darken = (c: string, t: number) => mix(c, "#1b0f2a", t);
export function hsl(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(255 * f(0), 255 * f(8), 255 * f(4));
}
export function rgba(c: string, a: number) {
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- grain texture (clay fingerprints)
let grain: CanvasPattern | null = null;
export function grainPattern(g: G) {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  grain = g.createPattern(c, "repeat");
  return grain;
}

// ---------------------------------------------------------------- shapes
export function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

export function shadow(g: G, x: number, y: number, rx: number, ry: number, a = 0.28) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rx);
  gr.addColorStop(0, `rgba(20,8,30,${a})`);
  gr.addColorStop(1, "rgba(20,8,30,0)");
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Fill the current path with a lit clay gradient. (cx,cy,r) = bounding circle of the shape. */
export function clayFill(g: G, color: string, cx: number, cy: number, r: number, { gloss = 0.35, outline = 0, rim = true } = {}) {
  const gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.45, r * 0.05, cx, cy, r * 1.15);
  gr.addColorStop(0, lighten(color, 0.32));
  gr.addColorStop(0.45, color);
  gr.addColorStop(1, darken(color, 0.32));
  g.fillStyle = gr;
  g.fill();
  if (outline) { g.lineWidth = outline; g.strokeStyle = darken(color, 0.55); g.stroke(); }
  g.save();
  g.clip();
  if (rim) { // soft bounce light along the bottom edge
    const rg = g.createLinearGradient(cx, cy + r * 0.4, cx, cy + r);
    rg.addColorStop(0, "rgba(255,255,255,0)"); rg.addColorStop(1, rgba(lighten(color, 0.5), 0.25));
    g.fillStyle = rg; g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  }
  if (gloss > 0) {
    const hx = cx - r * 0.35, hy = cy - r * 0.42;
    const hg = g.createRadialGradient(hx, hy, 0, hx, hy, r * 0.5);
    hg.addColorStop(0, `rgba(255,255,255,${gloss})`); hg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hg; g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  }
  g.restore();
}

export function blob(g: G, x: number, y: number, rx: number, ry: number, color: string, { rot = 0, gloss = 0.35, outline = 0, wobble = 0, t = 0 } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath();
  if (wobble) {
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wobble * (Math.sin(a * 3 + t * 5) * 0.5 + Math.sin(a * 5 - t * 3.3) * 0.5);
      const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  } else g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  clayFill(g, color, 0, 0, Math.max(rx, ry), { gloss, outline });
  g.restore();
}

export function eye(g: G, x: number, y: number, r: number, { look = [0, 0] as [number, number], pupil = 0.5, blink = 0, lid = "" } = {}) {
  const ry = r * 1.1 * Math.max(0.08, 1 - blink);
  g.save();
  g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  const wg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1);
  wg.addColorStop(0, "#ffffff"); wg.addColorStop(1, "#dcd6e6");
  g.fillStyle = wg; g.fill();
  g.lineWidth = Math.max(1, r * 0.08); g.strokeStyle = "rgba(27,20,32,0.35)"; g.stroke();
  if (blink < 0.85) {
    g.clip();
    const px = x + look[0] * r * 0.38, py = y + look[1] * r * 0.38, pr = r * pupil;
    g.beginPath(); g.ellipse(px, py, pr, pr * 1.08, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(px + pr * 0.35, py - pr * 0.38, pr * 0.32, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    if (lid) { g.fillStyle = lid; g.fillRect(x - r * 1.2, y - ry * 1.2, r * 2.4, ry * 0.75); }
  }
  g.restore();
}

export type MouthKind = "smile" | "grin" | "oh" | "frown" | "flat" | "tooth";
export function mouth(g: G, x: number, y: number, w: number, kind: MouthKind = "smile") {
  g.save();
  g.lineCap = "round"; g.strokeStyle = "#5A1E2B"; g.fillStyle = "#5A1E2B"; g.lineWidth = Math.max(1.5, w * 0.16);
  if (kind === "smile") { g.beginPath(); g.arc(x, y - w * 0.3, w * 0.55, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  else if (kind === "frown") { g.beginPath(); g.arc(x, y + w * 0.45, w * 0.5, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
  else if (kind === "flat") { g.beginPath(); g.moveTo(x - w * 0.4, y); g.lineTo(x + w * 0.4, y); g.stroke(); }
  else if (kind === "oh") { g.beginPath(); g.ellipse(x, y, w * 0.28, w * 0.36, 0, 0, Math.PI * 2); g.fill(); }
  else { // grin / tooth
    g.beginPath(); g.moveTo(x - w * 0.55, y - w * 0.12); g.quadraticCurveTo(x, y + w * 0.75, x + w * 0.55, y - w * 0.12); g.closePath(); g.fill();
    g.fillStyle = "#FF5C74"; g.beginPath(); g.ellipse(x, y + w * 0.28, w * 0.22, w * 0.12, 0, 0, Math.PI * 2); g.fill();
    if (kind === "tooth") { g.fillStyle = "#FFFDF4"; rr(g, x - w * 0.18, y - w * 0.14, w * 0.3, w * 0.3, w * 0.06); g.fill(); }
  }
  g.restore();
}

export function cheeks(g: G, x: number, y: number, dx: number, r: number) {
  g.fillStyle = "rgba(255,111,145,0.45)";
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * dx, y, r, r * 0.65, 0, 0, Math.PI * 2); g.fill(); }
}

export function clayText(g: G, txt: string, x: number, y: number, size: number, { fill = "#FFD25A", stroke = NAVY, align = "center" as CanvasTextAlign, rot = 0, gloss = true } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "middle"; g.lineJoin = "round";
  g.lineWidth = size * 0.26; g.strokeStyle = "rgba(20,10,30,0.45)"; g.strokeText(txt, size * 0.04, size * 0.1);
  g.lineWidth = size * 0.2; g.strokeStyle = stroke; g.strokeText(txt, 0, 0);
  g.fillStyle = fill; g.fillText(txt, 0, 0);
  if (gloss) {
    const gr = g.createLinearGradient(0, -size * 0.5, 0, size * 0.1);
    gr.addColorStop(0, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillText(txt, 0, 0);
  }
  g.restore();
}

export function sunburst(g: G, cx: number, cy: number, R: number, c1: string, c2: string, rays = 24, rot = 0) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.fillStyle = c1; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = c2;
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 1) / rays) * Math.PI * 2;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fill();
  }
  g.restore();
}

export function star(g: G, x: number, y: number, r: number, color: string, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr2 = i % 2 ? r * 0.48 : r;
    if (i === 0) g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); else g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  g.closePath();
  clayFill(g, color, 0, 0, r, { gloss: 0.4 });
  g.restore();
}

/** a glossy clay button/panel with a dark bottom lip (like the website buttons) */
export function clayPanel(g: G, x: number, y: number, w: number, h: number, r: number, color: string, { lip = 6, pressed = 0 } = {}) {
  const py = y + pressed * lip * 0.8;
  rr(g, x, py + lip, w, h - lip, r); g.fillStyle = darken(color, 0.35); g.fill();
  rr(g, x, py, w, h - lip, r);
  clayFill(g, color, x + w / 2, py + (h - lip) / 2, Math.max(w, h) * 0.6, { gloss: 0.3, rim: false });
  g.save(); rr(g, x + 4, py + 3, w - 8, (h - lip) * 0.42, r * 0.8); g.fillStyle = "rgba(255,255,255,0.22)"; g.fill(); g.restore();
}
