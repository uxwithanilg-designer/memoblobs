// Canvas textures for Rollo Rush (made once, shared): track surfaces (grass path, boards, waterfall water, flowers,
// stone), cliff rock, the moon, glow / sparkle sprites, dash-pad chevrons, crate planks.
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();
function canvas(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!] as const; }
function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true, srgb = true) {
  const hit = cache.get(key); if (hit) return hit;
  const [c, g] = canvas(w, h); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  cache.set(key, t); return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const hex = (h: string, k = 1) => { const c = new THREE.Color(h); c.multiplyScalar(k); return `#${c.getHexString()}`; };

/** grass with a soft trodden path down the middle */
export function grassPath(grass: string, dirt = "#8E6A44") {
  return make(`path:${grass}`, 512, 512, (g, w, h) => {
    // rich grass: many thin blades in a few greens
    g.fillStyle = hex(grass, 0.8); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = hex(grass, 0.6 + rnd() * 0.65); g.fillRect(x, y, 1.4, 4 + rnd() * 7); }
    // a soft worn path down the middle, with a few small pebbles
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0.2, "rgba(0,0,0,0)"); grd.addColorStop(0.36, hex(dirt) + "70"); grd.addColorStop(0.5, hex(dirt) + "98"); grd.addColorStop(0.64, hex(dirt) + "70"); grd.addColorStop(0.8, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = w * (0.36 + rnd() * 0.28), y = rnd() * h; g.fillStyle = hex(dirt, 0.55 + rnd() * 0.35); g.beginPath(); g.arc(x, y, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
    // grass tufts creeping over the path edges
    for (let i = 0; i < 2600; i++) { const x = w * (0.28 + rnd() * 0.44), y = rnd() * h; if (Math.abs(x / w - 0.5) < 0.1 && rnd() < 0.8) continue; g.fillStyle = hex(grass, 0.7 + rnd() * 0.5); g.fillRect(x, y, 1.2, 3 + rnd() * 4); }
  });
}
export function grassFlowers(grass: string) {
  return make(`flowers:${grass}`, 256, 256, (g, w, h) => {
    g.fillStyle = grass; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = hex(grass, 0.75 + rnd() * 0.5); g.fillRect(rnd() * w, rnd() * h, 2, 6); }
    const cols = ["#FFE066", "#FF8FB1", "#FFFFFF", "#B98CFF", "#FFB347"];
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h; if (x > w * 0.3 && x < w * 0.7 && rnd() < 0.8) continue; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(x, y, 2 + rnd() * 2, 0, 7); g.fill(); g.fillStyle = "#FFF4B0"; g.fillRect(x - 0.5, y - 0.5, 1.4, 1.4); }
  });
}
export function boards() {
  return make("boards", 256, 256, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      g.fillStyle = hex("#9A6A43", 0.85 + rnd() * 0.3); g.fillRect(0, y, w, h / n);
      g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, y, w, 3);
      for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(60,30,10,${0.1 + rnd() * 0.15})`; g.fillRect(rnd() * w, y + 4 + rnd() * (h / n - 8), 20 + rnd() * 60, 1.5); }
      g.fillStyle = "#3A2A1C"; g.beginPath(); g.arc(14, y + h / n / 2, 3, 0, 7); g.arc(w - 14, y + h / n / 2, 3, 0, 7); g.fill();
    }
  });
}
export function stoneFloor() {
  return make("stone", 256, 256, (g, w, h) => {
    g.fillStyle = "#8C8678"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 42) for (let x = (y / 42) % 2 ? -32 : 0; x < w; x += 64) {
      g.fillStyle = hex("#A39C8C", 0.8 + rnd() * 0.35); g.fillRect(x + 2, y + 2, 60, 38);
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x + 2, y + 2, 60, 4);
    }
  });
}
/** waterfall water: streaks that scroll down the track */
export function fallsWater() {
  return make("falls", 128, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, "#4FA8E0"); grd.addColorStop(0.5, "#8FD6FF"); grd.addColorStop(1, "#4FA8E0");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, len = 20 + rnd() * 70; g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.55})`; g.fillRect(x, y, 1 + rnd() * 2.5, len); }
  });
}
export function rock(base: string) {
  return make(`rock:${base}`, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // layered strata with cracks (no checkerboard)
    for (let y = 0; y < h; y += 10 + rnd() * 18) { g.fillStyle = hex(base, 0.75 + rnd() * 0.45); g.fillRect(0, y, w, 6 + rnd() * 14); }
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(0,0,0,${0.15 + rnd() * 0.2})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 22; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); }
  });
}
export function moon() {
  return make("moon", 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.45, h * 0.42, 10, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "#FFFDF2"); grd.addColorStop(0.75, "#F2E6CC"); grd.addColorStop(1, "#E2D2B0");
    g.fillStyle = grd; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, 7); g.fill();
    for (let i = 0; i < 26; i++) { const x = w * (0.18 + rnd() * 0.64), y = h * (0.18 + rnd() * 0.64), r = 4 + rnd() * 18; g.fillStyle = `rgba(150,130,100,${0.12 + rnd() * 0.18})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.2, r * 0.6, 0, 7); g.fill(); }
  }, false);
}
export function glow(color = "#FFFFFF") {
  return make(`glow:${color}`, 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    const c = new THREE.Color(color);
    const s = (a: number) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    grd.addColorStop(0, s(1)); grd.addColorStop(0.25, s(0.55)); grd.addColorStop(0.6, s(0.12)); grd.addColorStop(1, s(0));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}
export function sparkle() {
  return make("sparkle", 64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.3, "rgba(255,240,200,0.6)"); grd.addColorStop(1, "rgba(255,220,150,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(w / 2 - 1, 4, 2, h - 8); g.fillRect(4, h / 2 - 1, w - 8, 2);
  }, false);
}
export function chevrons() {
  return make("chev", 64, 128, (g, w, h) => {
    g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      const y = i * 64 + 14;
      g.fillStyle = "#7DFFE0"; g.beginPath(); g.moveTo(8, y + 34); g.lineTo(32, y + 8); g.lineTo(56, y + 34); g.lineTo(46, y + 40); g.lineTo(32, y + 24); g.lineTo(18, y + 40); g.closePath(); g.fill();
    }
  });
}
export function crate() {
  return make("crate", 128, 128, (g, w, h) => {
    g.fillStyle = "#B07A45"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = hex("#B07A45", 0.85 + rnd() * 0.3); g.fillRect(4, y + 3, w - 8, 26); }
    g.strokeStyle = "#5E3A1E"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.lineWidth = 8; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke();
    g.fillStyle = "#FFD25A"; g.beginPath(); g.arc(w / 2, h / 2, 13, 0, 7); g.fill(); g.fillStyle = "#FFF3C2"; g.beginPath(); g.arc(w / 2 - 4, h / 2 - 4, 4, 0, 7); g.fill();
  }, false);
}
export function stripes(a = "#FFFFFF", b = "#FF5A5A") {
  return make(`stripes:${a}${b}`, 64, 64, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    for (let i = -h; i < w; i += 22) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + 11, h); g.lineTo(i + 11 + h, 0); g.lineTo(i + h, 0); g.closePath(); g.fill(); }
  });
}
/** a text / emoji badge on a transparent square */
export function badge(text: string, bg = "rgba(0,0,0,0)", fg = "#FFFFFF", size = 128) {
  return make(`badge:${text}:${bg}:${fg}`, size, size, (g, w, h) => {
    if (bg !== "rgba(0,0,0,0)") { g.fillStyle = bg; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill(); }
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${Math.round(w * (text.length > 2 ? 0.34 : 0.6))}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    g.fillText(text, w / 2, h / 2 + 4);
  }, false);
}
/** the other floors: sand ripples, snow, cracked ice, candy stripes, a neon grid, steel plates, glass, crystal facets,
 * cloud, basalt with glowing cracks, rainbow bands, water, autumn leaves (and an emissive map for the glowing ones) */
export function floorTex(kind: string, a: string, b: string, glowMap = false) {
  return make(`floor:${kind}:${a}:${b}:${glowMap}`, 256, 256, (g, w, h) => {
    const dark = glowMap ? "#000000" : null;
    switch (kind) {
      case "sand": g.fillStyle = a; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 9) { g.strokeStyle = hex(a, 0.86); g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); g.stroke(); } for (let i = 0; i < 1600; i++) { g.fillStyle = hex(a, 0.8 + rnd() * 0.4); g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); } break;
      case "snow": g.fillStyle = "#F4FAFF"; g.fillRect(0, 0, w, h); for (let i = 0; i < 2400; i++) { g.fillStyle = rnd() < 0.5 ? "#DCEBF8" : "#FFFFFF"; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 2.2, 0, 7); g.fill(); } break;
      case "ice": g.fillStyle = "#BFE6FA"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 1.2; for (let i = 0; i < 26; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } break;
      case "candy": for (let i = -h; i < w + h; i += 32) { g.fillStyle = (i / 32) % 2 ? a : "#FFFFFF"; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - h, h); g.lineTo(i - h, h); g.closePath(); g.fill(); } for (let i = 0; i < 120; i++) { g.fillStyle = ["#FFE066", "#5CF2C9", "#B98CFF", "#FF8FB1"][i % 4]; g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rnd() * 3); g.fillRect(-4, -1.5, 8, 3); g.restore(); } break;
      case "neon": case "grid": g.fillStyle = dark ?? "#0B0A1E"; g.fillRect(0, 0, w, h); g.strokeStyle = a; g.lineWidth = 3; g.shadowColor = a; g.shadowBlur = 10; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = b; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); break;
      case "metal": g.fillStyle = "#8C97A8"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 128) { g.fillStyle = hex("#8C97A8", 0.92 + rnd() * 0.16); g.fillRect(x + 2, y + 2, 124, 60); g.fillStyle = "#5A6474"; for (const [px, py] of [[8, 8], [116, 8], [8, 54], [116, 54]]) { g.beginPath(); g.arc(x + px, y + py, 3, 0, 7); g.fill(); } } for (let i = 0; i < 40; i++) { g.strokeStyle = "rgba(255,255,255,0.25)"; g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.lineTo(x + 6, h); g.stroke(); } break;
      case "glass": g.fillStyle = "#BFF6FF"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.fillStyle = "rgba(255,255,255,0.35)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 30, 6, -0.6, 0, 7); g.fill(); } break;
      case "crystal": g.fillStyle = dark ?? hex(a, 0.7); g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 26; g.fillStyle = glowMap ? (rnd() < 0.3 ? b : "#000000") : hex(i % 2 ? a : b, 0.8 + rnd() * 0.5); g.beginPath(); for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 + rnd() * 0.4; g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); } g.closePath(); g.fill(); } break;
      case "cloud": g.fillStyle = "#F2F7FF"; g.fillRect(0, 0, w, h); for (let i = 0; i < 180; i++) { g.fillStyle = rnd() < 0.5 ? "rgba(214,228,248,0.7)" : "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(rnd() * w, rnd() * h, 6 + rnd() * 18, 0, 7); g.fill(); } break;
      case "rock": g.fillStyle = dark ?? hex(a, 0.9); g.fillRect(0, 0, w, h); if (!glowMap) for (let i = 0; i < 900; i++) { g.fillStyle = hex(a, 0.6 + rnd() * 0.8); g.fillRect(rnd() * w, rnd() * h, 3, 3); } g.strokeStyle = b; g.lineWidth = glowMap ? 3 : 2; g.shadowColor = b; g.shadowBlur = glowMap ? 8 : 0; for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } break;
      case "rainbow": { const cols = ["#FF5A7A", "#FFB347", "#FFE066", "#5CF2C9", "#5AA0FF", "#B98CFF"]; cols.forEach((c, i) => { g.fillStyle = glowMap ? c : hex(c, 0.9); g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h); }); if (!glowMap) for (let y = 0; y < h; y += 32) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, y, w, 4); } break; }
      case "water": g.fillStyle = a; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 2; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.ellipse(x, y, 14 + rnd() * 20, 3, 0, 0, 7); g.stroke(); } break;
      case "leaves": g.fillStyle = hex(b, 0.75); g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { g.fillStyle = ["#E8662A", "#FFB347", "#C8352A", "#FFD066", "#8A4A2A"][i % 5]; g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rnd() * 6); g.beginPath(); g.ellipse(0, 0, 7, 3.5, 0, 0, 7); g.fill(); g.restore(); } break;
      default: g.fillStyle = a; g.fillRect(0, 0, w, h);
    }
  }, true, !glowMap);
}
export function disposeTextures() { for (const t of cache.values()) t.dispose(); cache.clear(); }
