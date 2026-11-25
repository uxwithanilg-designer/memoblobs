// The painted backdrops: three layers per world (far, mid, near), each painted once per stage into a strip that tiles
// seamlessly, then scrolled with parallax every frame (one image draw per layer: cheap on phones). Every world has
// its own scenery:
//   Toybox Town — felt hills and a block castle · toy block stacks and giant crayons · wooden toy trees and a fence
//   Candy Works — cotton-candy mountains · lollipop groves and candy-cane chimneys · gumdrop hills and wafer fences
//   Hard Hat Heights — a hazy skyline · steel skeletons and tower cranes · scaffolding, cones and barriers
//   Sky Isles — far floating islands with waterfalls · big islands with trees · a bank of clouds
//   Neon Grid — a neon skyline · wireframe mountains · palms and neon signs
//   Glacier Lab — icy peaks · icebergs and lab domes · ice crystals
//   Scrapyard Sunset — smokestacks · junk mountains and a magnet crane · tyre stacks and oil drums
//   Glowshroom Woods — giant mushrooms · twisted lantern trees · glowing mushroom clumps and ferns
//   Coral Deep — reef shadows · coral towers, fans and kelp · anemones and starfish
//   Clockwork Kingdom — clock towers and spires · brass domes and chimneys · pipes, valves and gauges
//   Haunted Carnival — a hilltop castle and dead trees · circus tents and string lights · graves, pumpkins, railings
//   Orbit Station — a cratered moon · station modules and solar wings · machinery and beacons
// Light comes from the mood's sun side (a rim of light on the tops), far layers melt into the haze, and at night
// windows, lamps and glowing things light up.
import type { Look } from "./look";
import { makeRng, mix, rgba, shade, type Rng } from "../util";

export const STRIP_W = 1600, STRIP_H = 640;
export interface Strip { canvas: HTMLCanvasElement; base: string }

const TAU = Math.PI * 2;
type C = CanvasRenderingContext2D;
interface P { c: C; W: number; H: number; r: Rng; L: Look; col: string; night: number; layer: number }

// ------------------------------------------------------------------ helpers
/** a periodic profile across the strip (tiles seamlessly): sums of whole-number sine waves, 0..1 */
function profile(r: Rng, W: number, terms: [number, number][]) {
  const waves = terms.map(([k, a]) => ({ k, a, p: r() * TAU }));
  const out = new Float32Array(W + 1);
  let lo = Infinity, hi = -Infinity;
  for (let x = 0; x <= W; x++) {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin((x / W) * TAU * w.k + w.p);
    out[x] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  for (let x = 0; x <= W; x++) out[x] = (out[x] - lo) / (hi - lo || 1);
  return out;
}
function hillPath(c: C, W: number, H: number, ys: Float32Array, base: number, amp: number) {
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) c.lineTo(x, base - ys[x] * amp);
  c.lineTo(W, base - ys[W] * amp); c.lineTo(W, H); c.closePath();
}
function vgrad(c: C, y0: number, y1: number, a: string, b: string) {
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}
/** a silhouette of rolling hills with a soft gradient and a rim of light on top */
function hills(p: P, base: number, amp: number, terms: [number, number][], col: string, rim = 0.35) {
  const { c, W, H, r, L } = p;
  const ys = profile(r, W, terms);
  hillPath(c, W, H, ys, base, amp);
  c.fillStyle = vgrad(c, base - amp, H, shade(col, 0.08), shade(col, -0.18)); c.fill();
  c.save(); c.lineWidth = 3; c.strokeStyle = rgba(L.rim, rim * (1 - p.night * 0.6));
  c.beginPath(); for (let x = 0; x <= W; x += 4) { const y = base - ys[x] * amp + 1.5; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); c.restore();
  return ys;
}
function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** draw something near the strip's edges twice, so the strip tiles */
function wrap(W: number, x: number, half: number, fn: (x: number) => void) { fn(x); if (x - half < 0) fn(x + W); if (x + half > W) fn(x - W); }
function windows(p: P, x: number, y: number, w: number, h: number, cell: number, lit: number) {
  const { c, r, L } = p;
  const on = rgba(L.glow, 0.55 + 0.4 * p.night), off = rgba(shade(p.col, -0.3), 0.5);
  for (let wy = y + cell * 0.6; wy < y + h - cell * 0.6; wy += cell * 1.4) {
    for (let wx = x + cell * 0.5; wx < x + w - cell * 0.8; wx += cell * 1.3) {
      c.fillStyle = r() < lit * (0.25 + p.night * 0.75) ? on : off;
      c.fillRect(wx, wy, cell * 0.7, cell * 0.8);
    }
  }
}
function glowDot(c: C, x: number, y: number, rad: number, col: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.35, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
const lit = (p: P, col: string, k = 0.12) => shade(col, k * (1 - p.night));

// ================================================================== the worlds
type Painter = (p: P) => void;
const PAINT: Record<string, [Painter, Painter, Painter]> = {
  toybox: [
    (p) => { // felt hills and a toy-block castle
      const { c, W, H, r } = p;
      hills(p, H * 0.78, H * 0.22, [[2, 1], [3, 0.6], [7, 0.2]], p.col);
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.3 + r() * 0.4) * (W / 3), base = H * 0.66;
        wrap(W, x, 120, (cx) => {
          for (let k = -2; k <= 2; k++) {
            const tw = 26 + r() * 10, th = 70 + r() * 90 - Math.abs(k) * 18, tx = cx + k * 40 - tw / 2;
            c.fillStyle = lit(p, mix(p.col, ["#FF8A8A", "#FFD36B", "#8AB8FF", "#8AE0A0"][(k + 2) % 4], 0.35), 0.05);
            rr(c, tx, base - th, tw, th + 40, 4); c.fill();
            c.fillStyle = mix(p.col, "#FF6B6B", 0.3);
            c.beginPath(); c.moveTo(tx - 4, base - th); c.lineTo(tx + tw / 2, base - th - 34); c.lineTo(tx + tw + 4, base - th); c.fill();
          }
        });
      }
      c.fillStyle = shade(p.col, -0.06); c.fillRect(0, H * 0.74, W, H * 0.26);
    },
    (p) => { // block stacks and giant crayons
      const { c, W, H, r } = p;
      const cols = ["#FF6B6B", "#FFC93C", "#4D96FF", "#6BCB77", "#B983FF"];
      for (let i = 0; i < 7; i++) {
        const x = (i + r()) * (W / 7), base = H * 0.86;
        wrap(W, x, 110, (cx) => {
          if (i % 2 === 0) {
            let y = base;
            const n = 2 + Math.floor(r() * 3);
            for (let k = 0; k < n; k++) {
              const s = 58 - k * 6, bx = cx - s / 2 + (r() - 0.5) * 14;
              const col = mix(cols[(i + k) % 5], p.col, 0.42);
              c.fillStyle = lit(p, col); rr(c, bx, y - s, s, s, 7); c.fill();
              c.fillStyle = rgba("#FFFFFF", 0.18 * (1 - p.night)); rr(c, bx + 5, y - s + 5, s - 10, s * 0.3, 5); c.fill();
              c.fillStyle = rgba(shade(col, -0.4), 0.65); c.font = `bold ${s * 0.55}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
              c.fillText("ABC123★"[(i * 3 + k) % 7], bx + s / 2, y - s / 2 + 2);
              y -= s;
            }
          } else {
            const h = 150 + r() * 90, w = 26, tilt = (r() - 0.5) * 0.25;
            const col = mix(cols[i % 5], p.col, 0.4);
            c.save(); c.translate(cx, base); c.rotate(tilt);
            c.fillStyle = lit(p, col); c.fillRect(-w / 2, -h, w, h);
            c.fillStyle = shade(col, -0.2); c.fillRect(-w / 2, -h * 0.75, w, 22); c.fillRect(-w / 2, -h * 0.3, w, 22);
            c.fillStyle = "#F4E2C0"; c.beginPath(); c.moveTo(-w / 2, -h); c.lineTo(0, -h - 34); c.lineTo(w / 2, -h); c.fill();
            c.fillStyle = col; c.beginPath(); c.moveTo(-6, -h - 22); c.lineTo(0, -h - 34); c.lineTo(6, -h - 22); c.fill();
            c.fillStyle = rgba("#FFFFFF", 0.2); c.fillRect(-w / 2 + 4, -h, 5, h);
            c.restore();
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.86, W, H * 0.14);
      hills(p, H * 0.92, H * 0.06, [[5, 1], [9, 0.4]], p.col, 0.2);
    },
    (p) => { // wooden toy trees, a picket fence, stitched felt
      const { c, W, H, r } = p;
      const ys = hills(p, H * 0.9, H * 0.1, [[3, 1], [6, 0.5], [11, 0.2]], p.col, 0.5);
      c.save(); c.setLineDash([10, 8]); c.lineWidth = 2.5; c.strokeStyle = rgba("#FFFFFF", 0.35 * (1 - p.night * 0.5));
      c.beginPath(); for (let x = 0; x <= W; x += 4) { const y = H * 0.9 - ys[x] * H * 0.1 + 12; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); c.restore();
      for (let i = 0; i < 9; i++) {
        const x = (i + r()) * (W / 9), y = H * 0.9 - ys[Math.floor(x) % W] * H * 0.1 + 6;
        wrap(W, x, 50, (cx) => {
          const h = 50 + r() * 50, rad = 26 + r() * 16;
          c.fillStyle = shade("#B07A44", -0.2 - p.night * 0.4); rr(c, cx - 5, y - h, 10, h, 3); c.fill();
          const col = lit(p, mix(["#58C46B", "#7FD36A", "#3FB27F"][i % 3], p.col, 0.3));
          c.fillStyle = col; c.beginPath(); c.arc(cx, y - h - rad * 0.6, rad, 0, TAU); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.22 * (1 - p.night)); c.beginPath(); c.arc(cx - rad * 0.35, y - h - rad, rad * 0.35, 0, TAU); c.fill();
        });
      }
      c.fillStyle = shade(p.col, -0.08); c.fillRect(0, H * 0.94, W, H * 0.06);
    },
  ],
  candy: [
    (p) => { // cotton-candy mountains
      const { c, W, H, r } = p;
      for (let i = 0; i < 14; i++) {
        const x = (i / 14) * W + r() * 60, y = H * (0.6 + r() * 0.12), rad = 70 + r() * 90;
        wrap(W, x, rad, (cx) => {
          const col = mix(p.col, i % 2 ? "#BFE3FF" : "#FFC6E6", 0.35);
          c.fillStyle = vgrad(c, y - rad, y + rad, lit(p, col, 0.2), shade(col, -0.1));
          c.beginPath(); c.arc(cx, y, rad, 0, TAU); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.18 * (1 - p.night)); c.beginPath(); c.arc(cx - rad * 0.3, y - rad * 0.35, rad * 0.45, 0, TAU); c.fill();
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.7, W, H * 0.3);
    },
    (p) => { // lollipop groves and candy-cane chimneys
      const { c, W, H, r } = p;
      hills(p, H * 0.86, H * 0.08, [[3, 1], [7, 0.4]], p.col, 0.25);
      for (let i = 0; i < 10; i++) {
        const x = (i + r()) * (W / 10), base = H * 0.84;
        wrap(W, x, 80, (cx) => {
          if (i % 3 === 1) {
            const h = 180 + r() * 60;
            c.fillStyle = lit(p, mix("#FFFFFF", p.col, 0.3)); c.fillRect(cx - 14, base - h, 28, h);
            c.save(); c.beginPath(); c.rect(cx - 14, base - h, 28, h); c.clip();
            c.strokeStyle = mix("#FF4F7A", p.col, 0.3); c.lineWidth = 9;
            for (let k = -2; k < h / 18; k++) { c.beginPath(); c.moveTo(cx - 16, base - h + k * 18); c.lineTo(cx + 16, base - h + k * 18 + 16); c.stroke(); }
            c.restore();
            for (let k = 0; k < 3; k++) { c.fillStyle = rgba("#FFFFFF", 0.35 - k * 0.1); c.beginPath(); c.arc(cx + k * 18, base - h - 20 - k * 26, 16 + k * 8, 0, TAU); c.fill(); }
          } else {
            const h = 90 + r() * 70, rad = 34 + r() * 18;
            c.fillStyle = lit(p, mix("#FFFFFF", p.col, 0.45)); c.fillRect(cx - 4, base - h, 8, h);
            const col = mix(["#FF5FA2", "#FFB13D", "#7C6BFF", "#3DD6C6"][i % 4], p.col, 0.3);
            c.fillStyle = lit(p, col); c.beginPath(); c.arc(cx, base - h, rad, 0, TAU); c.fill();
            c.strokeStyle = rgba("#FFFFFF", 0.55); c.lineWidth = 5; c.beginPath();
            for (let a = 0; a < TAU * 2.2; a += 0.2) { const rr2 = (a / (TAU * 2.2)) * rad * 0.85; c.lineTo(cx + Math.cos(a) * rr2, base - h + Math.sin(a) * rr2); }
            c.stroke();
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.84, W, H * 0.16);
    },
    (p) => { // gumdrop hills and a wafer fence
      const { c, W, H, r } = p;
      for (let i = 0; i < 16; i++) {
        const x = (i + r() * 0.6) * (W / 16), y = H * 0.93, w = 50 + r() * 40, h = 40 + r() * 34;
        wrap(W, x, w, (cx) => {
          const col = lit(p, mix(["#FF6FB5", "#7CF5C8", "#FFD23F", "#9B8CFF"][i % 4], p.col, 0.3));
          c.fillStyle = col; c.beginPath(); c.moveTo(cx - w / 2, y); c.quadraticCurveTo(cx - w / 2, y - h * 1.3, cx, y - h); c.quadraticCurveTo(cx + w / 2, y - h * 1.3 + 10, cx + w / 2, y); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.5); for (let k = 0; k < 5; k++) c.fillRect(cx - w * 0.3 + r() * w * 0.6, y - h * 0.3 - r() * h * 0.6, 3, 3);
        });
      }
      c.fillStyle = lit(p, mix("#E8B46A", p.col, 0.3));
      for (let x = 0; x < W; x += 26) { c.fillRect(x, H * 0.86, 16, H * 0.1); }
      c.fillRect(0, H * 0.88, W, 8);
      c.fillStyle = p.col; c.fillRect(0, H * 0.94, W, H * 0.06);
    },
  ],
  hardhat: [
    (p) => { // hazy city skyline
      const { c, W, H, r } = p;
      let x = 0;
      while (x < W) {
        const w = 40 + r() * 70, h = 90 + r() * 180;
        c.fillStyle = shade(p.col, (r() - 0.5) * 0.06); c.fillRect(x, H * 0.72 - h, w + 1, h + H);
        windows(p, x, H * 0.72 - h, w, h, 7, 0.3);
        if (r() < 0.3) { c.fillRect(x + w / 2 - 1, H * 0.72 - h - 30, 2, 30); if (p.night > 0.4) glowDot(c, x + w / 2, H * 0.72 - h - 30, 8, "#FF3B30", 0.9); }
        x += w;
      }
    },
    (p) => { // steel skeletons and tower cranes
      const { c, W, H, r } = p;
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.2 + r() * 0.5) * (W / 4), base = H * 0.86;
        wrap(W, x, 260, (cx) => {
          const w = 110 + r() * 60, floors = 5 + Math.floor(r() * 5), fh = 34;
          c.strokeStyle = lit(p, p.col, 0.06); c.lineWidth = 6;
          for (let f = 0; f <= floors; f++) { c.beginPath(); c.moveTo(cx - w / 2, base - f * fh); c.lineTo(cx + w / 2, base - f * fh); c.stroke(); }
          for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(cx - w / 2 + (k * w) / 4, base); c.lineTo(cx - w / 2 + (k * w) / 4, base - floors * fh); c.stroke(); }
          c.lineWidth = 2.5; for (let f = 0; f < floors; f++) { c.beginPath(); c.moveTo(cx - w / 2, base - f * fh); c.lineTo(cx - w / 4, base - (f + 1) * fh); c.stroke(); }
          if (i % 2 === 0) {
            const mh = floors * fh + 120, mx = cx + w / 2 + 30;
            c.lineWidth = 3; c.strokeStyle = lit(p, mix(p.col, "#FFC233", 0.35), 0.08);
            c.strokeRect(mx - 8, base - mh, 16, mh);
            for (let y = base; y > base - mh; y -= 16) { c.beginPath(); c.moveTo(mx - 8, y); c.lineTo(mx + 8, y - 16); c.stroke(); }
            c.beginPath(); c.moveTo(mx - 90, base - mh); c.lineTo(mx + 210, base - mh); c.stroke();
            c.beginPath(); c.moveTo(mx - 90, base - mh + 10); c.lineTo(mx + 210, base - mh + 10); c.stroke();
            c.beginPath(); c.moveTo(mx, base - mh - 40); c.lineTo(mx - 90, base - mh); c.moveTo(mx, base - mh - 40); c.lineTo(mx + 210, base - mh); c.stroke();
            c.fillStyle = shade(p.col, -0.2); c.fillRect(mx - 95, base - mh, 30, 26);
            c.beginPath(); c.moveTo(mx + 150, base - mh + 10); c.lineTo(mx + 150, base - mh + 120); c.stroke();
            c.fillRect(mx + 142, base - mh + 120, 16, 10);
            if (p.night > 0.3) glowDot(c, mx, base - mh - 40, 10, "#FF3B30", 0.9);
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.86, W, H * 0.14);
    },
    (p) => { // scaffolding, cones and barriers
      const { c, W, H, r } = p;
      const base = H * 0.93;
      for (let i = 0; i < 5; i++) {
        const x = (i + r()) * (W / 5);
        wrap(W, x, 100, (cx) => {
          c.strokeStyle = lit(p, mix(p.col, "#A8A8A8", 0.3)); c.lineWidth = 5;
          const w = 140, lv = 3;
          for (let k = 0; k <= 3; k++) { c.beginPath(); c.moveTo(cx - w / 2 + (k * w) / 3, base); c.lineTo(cx - w / 2 + (k * w) / 3, base - lv * 46); c.stroke(); }
          c.fillStyle = lit(p, mix(p.col, "#C98A4E", 0.4));
          for (let k = 1; k <= lv; k++) c.fillRect(cx - w / 2 - 6, base - k * 46, w + 12, 8);
          c.lineWidth = 2.5; for (let k = 0; k < lv; k++) { c.beginPath(); c.moveTo(cx - w / 2, base - k * 46); c.lineTo(cx + w / 2, base - (k + 1) * 46); c.stroke(); }
        });
      }
      for (let i = 0; i < 12; i++) {
        const x = r() * W;
        wrap(W, x, 20, (cx) => {
          c.fillStyle = mix("#FF7A1A", p.col, 0.25 + p.night * 0.4); c.beginPath(); c.moveTo(cx - 13, base); c.lineTo(cx - 4, base - 38); c.lineTo(cx + 4, base - 38); c.lineTo(cx + 13, base); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.7 - p.night * 0.4); c.fillRect(cx - 8, base - 24, 16, 6);
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  skyisles: [
    (p) => islands(p, 9, 0.5, 0.32, 60, false),
    (p) => islands(p, 4, 0.45, 0.28, 150, true),
    (p) => { // a bank of clouds
      const { c, W, H, r } = p;
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * W + r() * 30, y = H * (0.86 + r() * 0.05), rad = 40 + r() * 46;
        wrap(W, x, rad, (cx) => {
          c.fillStyle = vgrad(c, y - rad, y + rad, lit(p, mix("#FFFFFF", p.col, 0.25), 0.1), mix("#FFFFFF", p.col, 0.6));
          c.beginPath(); c.arc(cx, y, rad, 0, TAU); c.fill();
        });
      }
      c.fillStyle = mix("#FFFFFF", p.col, 0.6); c.fillRect(0, H * 0.9, W, H * 0.1);
    },
  ],
  neon: [
    (p) => { // neon skyline
      const { c, W, H, r } = p;
      let x = 0;
      const neon = ["#2BF6FF", "#FF3DCB", "#FFE14D", "#8F5BFF"];
      while (x < W) {
        const w = 50 + r() * 60, h = 120 + r() * 200;
        c.fillStyle = shade(p.col, -0.1 - r() * 0.1); c.fillRect(x, H * 0.72 - h, w + 1, h + H);
        windows(p, x, H * 0.72 - h, w, h, 6, 0.55);
        c.strokeStyle = rgba(neon[Math.floor(r() * 4)], 0.75); c.lineWidth = 2; c.strokeRect(x + 2, H * 0.72 - h + 2, w - 4, h);
        x += w + 4;
      }
    },
    (p) => { // wireframe mountains
      const { c, W, H, r, L } = p;
      const ys = profile(r, W, [[3, 1], [5, 0.7], [11, 0.35]]);
      const base = H * 0.86, amp = H * 0.36;
      hillPath(c, W, H, ys, base, amp);
      c.fillStyle = vgrad(c, base - amp, H, shade(p.col, 0.05), shade(p.col, -0.3)); c.fill();
      c.save(); hillPath(c, W, H, ys, base, amp); c.clip();
      c.strokeStyle = rgba(L.glow, 0.28); c.lineWidth = 1.5;
      for (let y = base - amp; y < H; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let x = 0; x <= W; x += 40) { c.beginPath(); c.moveTo(x, base - amp); c.lineTo(x + (x - W / 2) * 0.15, H); c.stroke(); }
      c.restore();
      c.strokeStyle = rgba("#FF3DCB", 0.9); c.lineWidth = 3; c.shadowColor = "#FF3DCB"; c.shadowBlur = 10;
      c.beginPath(); for (let x = 0; x <= W; x += 4) { const y = base - ys[x] * amp; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
      c.shadowBlur = 0;
    },
    (p) => { // palms and neon signs
      const { c, W, H, r } = p;
      const base = H * 0.94;
      for (let i = 0; i < 7; i++) {
        const x = (i + r()) * (W / 7);
        wrap(W, x, 90, (cx) => {
          if (i % 3 === 2) {
            const col = ["#2BF6FF", "#FF3DCB", "#FFE14D"][i % 3];
            c.fillStyle = shade(p.col, -0.2); c.fillRect(cx - 3, base - 120, 6, 120);
            c.strokeStyle = col; c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 14;
            rr(c, cx - 46, base - 180, 92, 56, 12); c.stroke();
            c.beginPath(); c.moveTo(cx - 24, base - 152); c.lineTo(cx + 18, base - 152); c.moveTo(cx + 4, base - 166); c.lineTo(cx + 20, base - 152); c.lineTo(cx + 4, base - 138); c.stroke();
            c.shadowBlur = 0;
          } else {
            const h = 140 + r() * 70, lean = (r() - 0.5) * 50;
            c.strokeStyle = shade(p.col, -0.25); c.lineWidth = 9; c.beginPath(); c.moveTo(cx, base); c.quadraticCurveTo(cx + lean * 0.2, base - h * 0.5, cx + lean, base - h); c.stroke();
            c.fillStyle = shade(p.col, -0.25);
            for (let k = 0; k < 7; k++) {
              const a = -Math.PI / 2 + (k - 3) * 0.48;
              c.beginPath(); c.moveTo(cx + lean, base - h);
              c.quadraticCurveTo(cx + lean + Math.cos(a) * 50, base - h + Math.sin(a) * 30 - 18, cx + lean + Math.cos(a) * 86, base - h + Math.sin(a) * 20 + 28);
              c.quadraticCurveTo(cx + lean + Math.cos(a) * 40, base - h + Math.sin(a) * 20, cx + lean, base - h); c.fill();
            }
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  glacier: [
    (p) => { // icy peaks
      const { c, W, H, r, L } = p;
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * W + r() * 80, h = 150 + r() * 160, w = 170 + r() * 120, base = H * 0.74;
        wrap(W, x, w, (cx) => {
          c.fillStyle = shade(p.col, -0.05); c.beginPath(); c.moveTo(cx - w, base); c.lineTo(cx, base - h); c.lineTo(cx + w, base); c.fill();
          c.fillStyle = rgba(L.rim, 0.25 * (1 - p.night * 0.5)); c.beginPath(); c.moveTo(cx, base - h); c.lineTo(cx + w, base); c.lineTo(cx + w * 0.2, base); c.fill();
          c.fillStyle = lit(p, mix("#FFFFFF", p.col, 0.25), 0.05); c.beginPath(); c.moveTo(cx - w * 0.32, base - h * 0.68); c.lineTo(cx, base - h); c.lineTo(cx + w * 0.32, base - h * 0.68); c.lineTo(cx + w * 0.12, base - h * 0.74); c.lineTo(cx, base - h * 0.66); c.lineTo(cx - w * 0.14, base - h * 0.73); c.fill();
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.74, W, H * 0.26);
    },
    (p) => { // icebergs and lab domes
      const { c, W, H, r, L } = p;
      const base = H * 0.86;
      for (let i = 0; i < 6; i++) {
        const x = (i + r()) * (W / 6);
        wrap(W, x, 140, (cx) => {
          if (i % 3 === 1) {
            const rad = 60 + r() * 30;
            c.fillStyle = lit(p, mix("#E8F2FA", p.col, 0.35)); c.beginPath(); c.arc(cx, base, rad, Math.PI, 0); c.fill();
            c.strokeStyle = shade(p.col, -0.2); c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.arc(cx, base, rad, Math.PI + (k * Math.PI) / 4, Math.PI + (k * Math.PI) / 4 + 0.01); c.lineTo(cx, base); c.stroke(); }
            c.fillStyle = rgba(L.glow, 0.5 + p.night * 0.5); c.fillRect(cx - 12, base - rad * 0.45, 24, 12);
            c.fillStyle = shade(p.col, -0.25); c.fillRect(cx + rad * 0.3, base - rad - 50, 4, 50);
            c.beginPath(); c.arc(cx + rad * 0.3 + 2, base - rad - 50, 12, Math.PI * 0.9, Math.PI * 2.1); c.fill();
            glowDot(c, cx + rad * 0.3 + 2, base - rad - 56, 9, "#FF5A5F", 0.5 + p.night * 0.5);
          } else {
            const w = 110 + r() * 80, h = 70 + r() * 90;
            const pts = [[-w / 2, 0], [-w * 0.35, -h * 0.6], [-w * 0.1, -h], [w * 0.15, -h * 0.8], [w * 0.38, -h * 0.5], [w / 2, 0]];
            c.fillStyle = lit(p, mix("#DDF3FF", p.col, 0.3)); c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(cx + px, base + py) : c.moveTo(cx + px, base + py))); c.fill();
            c.fillStyle = rgba("#7FB8D8", 0.35); c.beginPath(); c.moveTo(cx - w * 0.1, base - h); c.lineTo(cx + w * 0.15, base - h * 0.8); c.lineTo(cx + w * 0.38, base - h * 0.5); c.lineTo(cx + w / 2, base); c.lineTo(cx + w * 0.05, base); c.fill();
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
    (p) => { // ice crystals
      const { c, W, H, r } = p;
      const base = H * 0.94;
      for (let i = 0; i < 14; i++) {
        const x = r() * W;
        wrap(W, x, 60, (cx) => {
          for (let k = 0; k < 4; k++) {
            const h = 40 + r() * 80, w = 14 + r() * 12, a = (k - 1.5) * 0.28;
            c.save(); c.translate(cx + (k - 1.5) * 12, base); c.rotate(a);
            c.fillStyle = rgba(mix("#BFF0FF", p.col, 0.2), 0.85); c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h); c.lineTo(0, -h - w); c.lineTo(w / 2, -h); c.lineTo(w / 2, 0); c.fill();
            c.fillStyle = rgba("#FFFFFF", 0.45); c.fillRect(-w / 2 + 2, -h, w * 0.25, h);
            c.restore();
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  scrapyard: [
    (p) => { // smokestacks
      const { c, W, H, r } = p;
      let x = 0;
      while (x < W) {
        const w = 70 + r() * 90, h = 40 + r() * 60;
        c.fillStyle = shade(p.col, -0.04); c.beginPath(); c.moveTo(x, H * 0.74); c.lineTo(x, H * 0.74 - h); for (let k = 0; k < 3; k++) { c.lineTo(x + (k + 0.5) * (w / 3), H * 0.74 - h - 18); c.lineTo(x + (k + 1) * (w / 3), H * 0.74 - h); } c.lineTo(x + w, H * 0.74); c.fill();
        if (r() < 0.45) {
          const sx = x + r() * w, sh = 50 + r() * 80;
          c.fillRect(sx - 8, H * 0.74 - h - sh, 16, sh);
          for (let k = 0; k < 4; k++) { c.fillStyle = rgba(mix(p.col, "#FFFFFF", 0.3), 0.25 - k * 0.05); c.beginPath(); c.arc(sx + k * 22, H * 0.74 - h - sh - 18 - k * 24, 18 + k * 9, 0, TAU); c.fill(); }
          c.fillStyle = shade(p.col, -0.04);
        }
        x += w;
      }
      c.fillRect(0, H * 0.74, W, H);
    },
    (p) => { // junk mountains and a magnet crane
      const { c, W, H, r } = p;
      const ys = hills(p, H * 0.86, H * 0.3, [[3, 1], [5, 0.6], [13, 0.25], [23, 0.15]], p.col, 0.25);
      const base = H * 0.86;
      for (let i = 0; i < 40; i++) {
        const x = r() * W, y = base - ys[Math.floor(x)] * H * 0.3 + 10 + r() * 20;
        wrap(W, x, 30, (cx) => {
          c.fillStyle = shade(p.col, -0.12 - r() * 0.1);
          if (i % 3 === 0) { c.beginPath(); c.arc(cx, y, 12 + r() * 10, 0, TAU); c.fill(); c.fillStyle = shade(p.col, 0.05); c.beginPath(); c.arc(cx, y, 5, 0, TAU); c.fill(); }
          else if (i % 3 === 1) { c.save(); c.translate(cx, y); c.rotate((r() - 0.5) * 0.8); rr(c, -26, -10, 52, 20, 8); c.fill(); c.restore(); }
          else { c.save(); c.translate(cx, y); c.rotate((r() - 0.5) * 0.6); c.fillRect(-12, -22, 24, 34); c.restore(); }
        });
      }
      const cx = W * (0.3 + r() * 0.4);
      c.strokeStyle = lit(p, mix(p.col, "#FFC233", 0.4), 0.05); c.lineWidth = 9;
      c.beginPath(); c.moveTo(cx, base - 60); c.lineTo(cx + 30, base - 300); c.lineTo(cx + 260, base - 220); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(cx + 250, base - 222); c.lineTo(cx + 250, base - 130); c.stroke();
      c.fillStyle = shade(p.col, -0.2); c.beginPath(); c.ellipse(cx + 250, base - 124, 34, 12, 0, 0, TAU); c.fill();
    },
    (p) => { // tyre stacks and oil drums
      const { c, W, H, r } = p;
      const base = H * 0.94;
      for (let i = 0; i < 12; i++) {
        const x = (i + r()) * (W / 12);
        wrap(W, x, 40, (cx) => {
          if (i % 2) {
            for (let k = 0; k < 3 + Math.floor(r() * 3); k++) { c.fillStyle = shade("#2A2626", -p.night * 0.3); rr(c, cx - 26, base - 16 - k * 15, 52, 15, 7); c.fill(); c.fillStyle = rgba("#FFFFFF", 0.06); c.fillRect(cx - 20, base - 13 - k * 15, 40, 3); }
          } else {
            const col = mix(["#3E7CB1", "#C0392B", "#2E8B57"][i % 3], p.col, 0.35 + p.night * 0.3);
            for (let k = 0; k < 2; k++) {
              const bx = cx + k * 30 - 15;
              c.fillStyle = col; rr(c, bx - 13, base - 46, 26, 46, 4); c.fill();
              c.fillStyle = shade(col, -0.25); c.fillRect(bx - 13, base - 34, 26, 3); c.fillRect(bx - 13, base - 16, 26, 3);
            }
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  shroom: [
    (p) => mushrooms(p, 7, 0.7, 180, 0.4),
    (p) => { // twisted lantern trees
      const { c, W, H, r, L } = p;
      hills(p, H * 0.88, H * 0.07, [[3, 1], [8, 0.4]], p.col, 0.15);
      for (let i = 0; i < 6; i++) {
        const x = (i + r()) * (W / 6), base = H * 0.88;
        wrap(W, x, 130, (cx) => {
          c.strokeStyle = shade(p.col, -0.05); c.lineCap = "round";
          const h = 200 + r() * 90;
          c.lineWidth = 22; c.beginPath(); c.moveTo(cx, base); c.bezierCurveTo(cx - 30, base - h * 0.4, cx + 40, base - h * 0.6, cx + 5, base - h); c.stroke();
          c.lineWidth = 9;
          for (let k = 0; k < 4; k++) {
            const by = base - h * (0.55 + k * 0.12), dir = k % 2 ? 1 : -1, len = 70 + r() * 50;
            c.beginPath(); c.moveTo(cx, by); c.quadraticCurveTo(cx + dir * len * 0.6, by - 30, cx + dir * len, by + 10); c.stroke();
            c.strokeStyle = rgba(L.glow, 0.4); c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + dir * len, by + 10); c.lineTo(cx + dir * len, by + 34); c.stroke();
            glowDot(c, cx + dir * len, by + 40, 14, L.glow, 0.8);
            c.fillStyle = rgba("#FFFFFF", 0.9); c.beginPath(); c.arc(cx + dir * len, by + 40, 3, 0, TAU); c.fill();
            c.strokeStyle = shade(p.col, -0.05); c.lineWidth = 9;
          }
          c.lineCap = "butt";
        });
      }
      c.fillStyle = p.col; c.fillRect(0, H * 0.88, W, H * 0.12);
    },
    (p) => { // glowing clumps and ferns
      const { c, W, H, r, L } = p;
      const base = H * 0.95;
      for (let i = 0; i < 16; i++) {
        const x = r() * W;
        wrap(W, x, 50, (cx) => {
          if (i % 2) {
            c.strokeStyle = shade(p.col, 0.05); c.lineWidth = 3;
            for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.35; c.beginPath(); c.moveTo(cx, base); c.quadraticCurveTo(cx + Math.cos(a) * 30, base + Math.sin(a) * 50, cx + Math.cos(a) * 55, base + Math.sin(a) * 40 + 20); c.stroke(); }
          } else {
            for (let k = 0; k < 3; k++) {
              const h = 22 + r() * 30, rad = 12 + r() * 10, mx = cx + (k - 1) * 20;
              c.fillStyle = mix("#E8E0FF", p.col, 0.4); c.fillRect(mx - 3, base - h, 6, h);
              const col = ["#3DF5A7", "#7CC4FF", "#FF7AD9"][(i + k) % 3];
              glowDot(c, mx, base - h, rad * 2.4, col, 0.35 + p.night * 0.3);
              c.fillStyle = mix(col, p.col, 0.2); c.beginPath(); c.ellipse(mx, base - h, rad, rad * 0.6, 0, Math.PI, 0); c.fill();
              c.fillStyle = rgba("#FFFFFF", 0.6); c.beginPath(); c.arc(mx - rad * 0.3, base - h - rad * 0.25, 2.5, 0, TAU); c.fill();
            }
          }
        });
      }
      void L;
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  coral: [
    (p) => { // reef shadows
      const { c, W, H, r } = p;
      hills(p, H * 0.76, H * 0.25, [[2, 1], [4, 0.7], [9, 0.3], [17, 0.15]], p.col, 0.1);
      for (let i = 0; i < 10; i++) {
        const x = r() * W;
        wrap(W, x, 30, (cx) => {
          c.strokeStyle = shade(p.col, 0.04); c.lineWidth = 5;
          const h = 80 + r() * 120;
          c.beginPath(); c.moveTo(cx, H * 0.7); for (let y = 0; y < h; y += 10) c.lineTo(cx + Math.sin(y * 0.05 + i) * 10, H * 0.7 - y); c.stroke();
        });
      }
    },
    (p) => { // coral towers, fans and kelp
      const { c, W, H, r } = p;
      const base = H * 0.88;
      hills(p, base, H * 0.06, [[3, 1], [7, 0.5]], p.col, 0.1);
      const tint = ["#FF7A8A", "#FFB46B", "#B07CFF", "#5EE0C8", "#FF8AD8"];
      for (let i = 0; i < 9; i++) {
        const x = (i + r()) * (W / 9);
        wrap(W, x, 90, (cx) => {
          const col = lit(p, mix(tint[i % 5], p.col, 0.45), 0.08);
          if (i % 3 === 0) {
            c.fillStyle = col; c.beginPath(); c.moveTo(cx, base);
            const rad = 70 + r() * 40;
            for (let a = Math.PI; a <= TAU + 0.01; a += 0.25) c.lineTo(cx + Math.cos(a) * rad, base - 20 + Math.sin(a) * rad * 1.1);
            c.fill();
            c.strokeStyle = rgba(shade(col, -0.3), 0.6); c.lineWidth = 2;
            for (let a = Math.PI + 0.2; a < TAU; a += 0.3) { c.beginPath(); c.moveTo(cx, base - 10); c.lineTo(cx + Math.cos(a) * rad * 0.95, base - 20 + Math.sin(a) * rad * 1.05); c.stroke(); }
          } else if (i % 3 === 1) {
            c.strokeStyle = col; c.lineCap = "round";
            const branch = (bx: number, by: number, a: number, len: number, w: number, d: number) => {
              const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
              c.lineWidth = w; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
              if (d > 0) { branch(ex, ey, a - 0.45, len * 0.75, w * 0.72, d - 1); branch(ex, ey, a + 0.4, len * 0.72, w * 0.72, d - 1); }
            };
            branch(cx, base, -Math.PI / 2, 60 + r() * 20, 16, 4);
            c.lineCap = "butt";
          } else {
            c.strokeStyle = lit(p, mix("#3E8E4E", p.col, 0.5)); c.lineWidth = 8;
            for (let k = 0; k < 3; k++) {
              const h = 160 + r() * 120;
              c.beginPath(); c.moveTo(cx + k * 14, base); for (let y = 0; y < h; y += 8) c.lineTo(cx + k * 14 + Math.sin(y * 0.04 + k) * 14, base - y); c.stroke();
            }
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
    (p) => { // anemones and starfish
      const { c, W, H, r } = p;
      const base = H * 0.95;
      for (let i = 0; i < 14; i++) {
        const x = r() * W;
        wrap(W, x, 40, (cx) => {
          const col = lit(p, mix(["#FF6B8A", "#FFC46B", "#9B7CFF", "#5EF0D0"][i % 4], p.col, 0.3));
          if (i % 3 === 0) {
            c.fillStyle = col; c.save(); c.translate(cx, base - 10); c.rotate(r());
            c.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, rad = k % 2 ? 7 : 18; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.fill(); c.restore();
          } else {
            c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round";
            for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.22; c.beginPath(); c.moveTo(cx, base); c.quadraticCurveTo(cx + Math.cos(a) * 20, base + Math.sin(a) * 28, cx + Math.cos(a) * 30 + Math.sin(k) * 6, base + Math.sin(a) * 42); c.stroke(); }
            c.lineCap = "butt";
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  clockwork: [
    (p) => { // clock towers and spires
      const { c, W, H, r, L } = p;
      let x = 0;
      while (x < W) {
        const w = 60 + r() * 70, h = 100 + r() * 170, base = H * 0.74;
        c.fillStyle = shade(p.col, (r() - 0.5) * 0.06); c.fillRect(x, base - h, w, h + H);
        if (r() < 0.5) { c.beginPath(); c.moveTo(x - 4, base - h); c.lineTo(x + w / 2, base - h - 60 - r() * 60); c.lineTo(x + w + 4, base - h); c.fill(); }
        else { c.beginPath(); c.arc(x + w / 2, base - h, w / 2, Math.PI, 0); c.fill(); }
        if (r() < 0.4) {
          const cy = base - h + 30, rad = Math.min(w * 0.32, 22);
          c.fillStyle = rgba(L.glow, 0.35 + p.night * 0.5); c.beginPath(); c.arc(x + w / 2, cy, rad, 0, TAU); c.fill();
          c.strokeStyle = shade(p.col, -0.3); c.lineWidth = 2; c.beginPath(); c.moveTo(x + w / 2, cy); c.lineTo(x + w / 2, cy - rad * 0.7); c.moveTo(x + w / 2, cy); c.lineTo(x + w / 2 + rad * 0.5, cy + 2); c.stroke();
        } else windows(p, x, base - h + 20, w, h - 20, 7, 0.25);
        x += w + r() * 20;
      }
    },
    (p) => { // brass domes and chimneys
      const { c, W, H, r } = p;
      const base = H * 0.87;
      for (let i = 0; i < 6; i++) {
        const x = (i + r()) * (W / 6);
        wrap(W, x, 120, (cx) => {
          const col = lit(p, mix("#D9A24A", p.col, 0.5), 0.08);
          const w = 120 + r() * 60, h = 70 + r() * 60;
          c.fillStyle = col; c.fillRect(cx - w / 2, base - h, w, h);
          c.beginPath(); c.arc(cx, base - h, w * 0.32, Math.PI, 0); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.15 * (1 - p.night)); c.beginPath(); c.arc(cx - w * 0.1, base - h - w * 0.12, w * 0.1, 0, TAU); c.fill();
          c.fillStyle = shade(col, -0.25); for (let k = 0; k < 5; k++) c.fillRect(cx - w / 2 + 8 + k * (w / 5), base - h + 14, w / 10, h - 24);
          const sx = cx + w * 0.35;
          c.fillStyle = shade(col, -0.15); c.fillRect(sx - 9, base - h - 90, 18, 90); c.fillRect(sx - 13, base - h - 96, 26, 10);
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
    (p) => { // pipes, valves and gauges
      const { c, W, H, r, L } = p;
      const base = H * 0.95;
      const pipe = lit(p, mix("#B87333", p.col, 0.35), 0.1);
      c.strokeStyle = pipe; c.lineWidth = 16;
      c.beginPath(); c.moveTo(0, base - 70); c.lineTo(W, base - 70); c.stroke();
      c.strokeStyle = rgba("#FFFFFF", 0.18 * (1 - p.night)); c.lineWidth = 3; c.beginPath(); c.moveTo(0, base - 75); c.lineTo(W, base - 75); c.stroke();
      for (let i = 0; i < 8; i++) {
        const x = (i + r()) * (W / 8);
        wrap(W, x, 40, (cx) => {
          c.strokeStyle = pipe; c.lineWidth = 14; c.beginPath(); c.moveTo(cx, base); c.lineTo(cx, base - 70); c.stroke();
          c.fillStyle = shade(pipe, -0.2); c.fillRect(cx - 12, base - 80, 24, 20);
          if (i % 2) {
            c.fillStyle = mix("#F4E8D0", p.col, 0.3); c.beginPath(); c.arc(cx, base - 110, 18, 0, TAU); c.fill();
            c.strokeStyle = shade(pipe, -0.3); c.lineWidth = 4; c.stroke();
            c.strokeStyle = "#C0392B"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx, base - 110); c.lineTo(cx + 10, base - 118); c.stroke();
            c.strokeStyle = pipe; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, base - 92); c.lineTo(cx, base - 80); c.stroke();
          } else {
            c.strokeStyle = "#C0392B"; c.lineWidth = 5; c.beginPath(); c.arc(cx, base - 92, 12, 0, TAU); c.stroke();
          }
        });
      }
      void L;
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  haunted: [
    (p) => { // hilltop castle and dead trees
      const { c, W, H, r, L } = p;
      const ys = hills(p, H * 0.76, H * 0.2, [[2, 1], [3, 0.6], [8, 0.2]], p.col, 0.15);
      const cx = W * (0.25 + r() * 0.5), top = H * 0.76 - ys[Math.floor(cx)] * H * 0.2;
      c.fillStyle = p.col;
      for (let k = -2; k <= 2; k++) {
        const tw = 26, th = 90 + (2 - Math.abs(k)) * 50, tx = cx + k * 40;
        c.fillRect(tx - tw / 2, top - th, tw, th + 10);
        c.beginPath(); c.moveTo(tx - tw / 2 - 5, top - th); c.lineTo(tx, top - th - 44); c.lineTo(tx + tw / 2 + 5, top - th); c.fill();
        if (k % 2 === 0) { c.fillStyle = rgba(L.glow, 0.5 + p.night * 0.4); c.fillRect(tx - 4, top - th + 26, 8, 12); c.fillStyle = p.col; }
      }
      c.fillRect(cx - 100, top - 60, 200, 70);
      c.strokeStyle = p.col; c.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const x = r() * W, y = H * 0.76 - ys[Math.floor(x)] * H * 0.2 + 4;
        wrap(W, x, 50, (tx) => {
          const tree = (bx: number, by: number, a: number, len: number, w: number, d: number) => {
            const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
            c.lineWidth = w; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
            if (d > 0) { tree(ex, ey, a - 0.5 - r() * 0.3, len * 0.7, w * 0.65, d - 1); tree(ex, ey, a + 0.45 + r() * 0.3, len * 0.66, w * 0.65, d - 1); }
          };
          tree(tx, y, -Math.PI / 2, 40 + r() * 20, 7, 4);
        });
      }
      c.lineCap = "butt";
    },
    (p) => { // circus tents and string lights
      const { c, W, H, r, L } = p;
      const base = H * 0.87;
      for (let i = 0; i < 5; i++) {
        const x = (i + r()) * (W / 5);
        wrap(W, x, 120, (cx) => {
          const w = 150 + r() * 60, h = 110 + r() * 40;
          const a = lit(p, mix("#C0392B", p.col, 0.45)), b = lit(p, mix("#F4E8D0", p.col, 0.5));
          c.save(); c.beginPath(); c.moveTo(cx - w / 2, base); c.lineTo(cx - w / 2, base - h * 0.45); c.lineTo(cx, base - h); c.lineTo(cx + w / 2, base - h * 0.45); c.lineTo(cx + w / 2, base); c.closePath(); c.clip();
          for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? a : b; c.beginPath(); c.moveTo(cx, base - h); c.lineTo(cx - w / 2 + (k * w) / 8, base); c.lineTo(cx - w / 2 + ((k + 1) * w) / 8, base); c.fill(); }
          c.restore();
          c.fillStyle = shade(p.col, -0.3); c.beginPath(); c.moveTo(cx - 18, base); c.lineTo(cx, base - 46); c.lineTo(cx + 18, base); c.fill();
          c.strokeStyle = shade(p.col, -0.2); c.lineWidth = 3; c.beginPath(); c.moveTo(cx, base - h); c.lineTo(cx, base - h - 26); c.stroke();
          c.fillStyle = mix("#FFC233", p.col, 0.3); c.beginPath(); c.moveTo(cx, base - h - 26); c.lineTo(cx + 20, base - h - 20); c.lineTo(cx, base - h - 14); c.fill();
        });
      }
      c.strokeStyle = rgba("#000000", 0.4); c.lineWidth = 1.5;
      c.beginPath(); for (let x = 0; x <= W; x += 8) c.lineTo(x, base - 160 + Math.sin((x / W) * TAU * 6) * 26 + 26); c.stroke();
      for (let x = 10; x < W; x += 34) {
        const y = base - 160 + Math.sin((x / W) * TAU * 6) * 26 + 30;
        glowDot(c, x, y, 10, ["#FFB547", "#FF6B6B", "#7CF5C8"][Math.floor(x / 34) % 3], 0.5 + p.night * 0.45);
      }
      void L;
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
    (p) => { // graves, pumpkins and railings
      const { c, W, H, r, L } = p;
      const base = H * 0.95;
      c.fillStyle = shade(p.col, -0.1);
      for (let x = 0; x < W; x += 22) { c.fillRect(x, base - 64, 5, 64); c.beginPath(); c.moveTo(x - 3, base - 64); c.lineTo(x + 2.5, base - 76); c.lineTo(x + 8, base - 64); c.fill(); }
      c.fillRect(0, base - 56, W, 4); c.fillRect(0, base - 22, W, 4);
      for (let i = 0; i < 12; i++) {
        const x = r() * W;
        wrap(W, x, 30, (cx) => {
          if (i % 2) {
            c.fillStyle = lit(p, mix("#8A8AA0", p.col, 0.4)); rr(c, cx - 16, base - 44, 32, 44, 14); c.fill();
            c.fillStyle = rgba("#000000", 0.25); c.fillRect(cx - 9, base - 30, 18, 3); c.fillRect(cx - 2, base - 37, 4, 17);
          } else {
            const col = mix("#FF8A1F", p.col, 0.25);
            c.fillStyle = col; c.beginPath(); c.ellipse(cx, base - 16, 22, 16, 0, 0, TAU); c.fill();
            c.strokeStyle = shade(col, -0.25); c.lineWidth = 2; c.beginPath(); c.ellipse(cx, base - 16, 9, 16, 0, 0, TAU); c.stroke();
            c.fillStyle = "#3A6B2A"; c.fillRect(cx - 2, base - 37, 4, 7);
            glowDot(c, cx, base - 16, 30, L.glow, 0.25 + p.night * 0.35);
            c.fillStyle = rgba(L.glow, 0.9); c.beginPath(); c.moveTo(cx - 10, base - 22); c.lineTo(cx - 4, base - 16); c.lineTo(cx - 12, base - 16); c.fill();
            c.beginPath(); c.moveTo(cx + 10, base - 22); c.lineTo(cx + 4, base - 16); c.lineTo(cx + 12, base - 16); c.fill();
            c.fillRect(cx - 8, base - 11, 16, 3);
          }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
  orbit: [
    (p) => { // a cratered moon
      const { c, W, H, r, L } = p;
      const ys = hills(p, H * 0.78, H * 0.12, [[2, 1], [5, 0.4], [13, 0.15]], p.col, 0.3);
      for (let i = 0; i < 22; i++) {
        const x = r() * W, y = H * 0.78 - ys[Math.floor(x)] * H * 0.12 + 14 + r() * 80, rad = 10 + r() * 28;
        wrap(W, x, rad, (cx) => {
          c.fillStyle = shade(p.col, -0.12); c.beginPath(); c.ellipse(cx, y, rad, rad * 0.35, 0, 0, TAU); c.fill();
          c.strokeStyle = rgba(L.rim, 0.2); c.lineWidth = 2; c.beginPath(); c.ellipse(cx, y + 1, rad, rad * 0.35, 0, 0.1, Math.PI - 0.1); c.stroke();
        });
      }
    },
    (p) => { // station modules and solar wings
      const { c, W, H, r, L } = p;
      const base = H * 0.86;
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.2 + r() * 0.5) * (W / 4);
        wrap(W, x, 230, (cx) => {
          const col = lit(p, mix("#D6DEEC", p.col, 0.5), 0.1);
          c.fillStyle = shade(col, -0.2); c.fillRect(cx - 6, base - 200, 12, 200);
          c.fillStyle = col; rr(c, cx - 90, base - 250, 180, 56, 26); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.2 * (1 - p.night * 0.5)); rr(c, cx - 80, base - 246, 160, 12, 6); c.fill();
          for (let k = 0; k < 5; k++) { c.fillStyle = rgba(L.glow, 0.4 + p.night * 0.5); c.beginPath(); c.arc(cx - 60 + k * 30, base - 222, 6, 0, TAU); c.fill(); }
          for (const s of [-1, 1]) {
            const wx = cx + s * 120;
            c.strokeStyle = shade(col, -0.2); c.lineWidth = 4; c.beginPath(); c.moveTo(cx + s * 90, base - 222); c.lineTo(wx, base - 222); c.stroke();
            c.fillStyle = mix("#2A4C9A", p.col, 0.3); c.fillRect(s > 0 ? wx : wx - 100, base - 270, 100, 96);
            c.strokeStyle = rgba("#9CC8FF", 0.35); c.lineWidth = 1;
            for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(wx, base - 270 + k * 19); c.lineTo(wx + 100 * s, base - 270 + k * 19); c.stroke(); }
          }
          c.strokeStyle = shade(col, -0.25); c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 40, base - 250); c.lineTo(cx + 60, base - 300); c.stroke();
          c.fillStyle = col; c.beginPath(); c.ellipse(cx + 62, base - 304, 22, 10, -0.4, 0, TAU); c.fill();
          glowDot(c, cx + 60, base - 300, 10, "#FF5A5F", 0.4 + p.night * 0.5);
        });
      }
      hills(p, base, H * 0.04, [[4, 1], [9, 0.4]], p.col, 0.2);
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
    (p) => { // machinery and beacons
      const { c, W, H, r, L } = p;
      const base = H * 0.95;
      for (let i = 0; i < 10; i++) {
        const x = (i + r()) * (W / 10);
        wrap(W, x, 50, (cx) => {
          const col = lit(p, mix("#8A94B0", p.col, 0.4), 0.08);
          const w = 50 + r() * 50, h = 30 + r() * 50;
          c.fillStyle = col; rr(c, cx - w / 2, base - h, w, h + 10, 6); c.fill();
          c.fillStyle = mix("#FFC233", p.col, 0.3); for (let k = 0; k < w - 10; k += 14) c.fillRect(cx - w / 2 + 5 + k, base - h + 4, 7, 5);
          if (i % 3 === 0) { c.fillStyle = shade(col, -0.2); c.fillRect(cx - 2, base - h - 40, 4, 40); glowDot(c, cx, base - h - 42, 14, L.glow, 0.5 + p.night * 0.4); }
        });
      }
      c.fillStyle = p.col; c.fillRect(0, base, W, H - base);
    },
  ],
};

// shared painters
function islands(p: P, n: number, yMid: number, spread: number, size: number, trees: boolean) {
  const { c, W, H, r, L } = p;
  for (let i = 0; i < n; i++) {
    const x = (i + r()) * (W / n), y = H * (yMid + (r() - 0.5) * spread), w = size * (0.7 + r() * 0.7), d = w * (0.7 + r() * 0.3);
    wrap(W, x, w, (cx) => {
      const rock = lit(p, mix("#A88C77", p.col, 0.45), 0.05);
      c.fillStyle = vgrad(c, y, y + d, rock, shade(rock, -0.3));
      c.beginPath(); c.moveTo(cx - w / 2, y);
      for (let k = 0; k <= 8; k++) { const t = k / 8; c.lineTo(cx - w / 2 + t * w, y + Math.sin(t * Math.PI) * d * (0.7 + 0.3 * Math.sin(k * 2.3 + i))); }
      c.lineTo(cx + w / 2, y); c.fill();
      c.fillStyle = lit(p, mix("#6FD36B", p.col, 0.4)); rr(c, cx - w / 2 - 4, y - 8, w + 8, 16, 8); c.fill();
      c.fillStyle = rgba(L.rim, 0.35 * (1 - p.night * 0.6)); c.fillRect(cx - w / 2, y - 8, w, 3);
      if (r() < 0.6) {
        const fx = cx + (r() - 0.5) * w * 0.5;
        c.fillStyle = vgrad(c, y, y + H * 0.4, rgba("#FFFFFF", 0.65), rgba("#FFFFFF", 0));
        c.fillRect(fx - size * 0.04, y + 4, size * 0.08, H * 0.4);
      }
      if (trees) {
        for (let k = 0; k < 3; k++) {
          const tx = cx - w * 0.3 + k * w * 0.3 + (r() - 0.5) * 10, th = 24 + r() * 28;
          c.fillStyle = shade(rock, -0.2); c.fillRect(tx - 3, y - th, 6, th);
          c.fillStyle = lit(p, mix(["#4FBF62", "#7CD36A", "#FFB0C8"][k % 3], p.col, 0.35));
          c.beginPath(); c.arc(tx, y - th - 10, 18 + r() * 8, 0, TAU); c.fill();
        }
      }
    });
  }
  c.fillStyle = rgba(mix("#FFFFFF", p.col, 0.5), 0.6); c.fillRect(0, H * 0.9, W, H * 0.1);
}

function mushrooms(p: P, n: number, base: number, size: number, glowAmt: number) {
  const { c, W, H, r, L } = p;
  hills(p, H * (base + 0.06), H * 0.08, [[2, 1], [5, 0.5]], p.col, 0.1);
  for (let i = 0; i < n; i++) {
    const x = (i + r()) * (W / n), y = H * (base + 0.05), h = size * (0.7 + r() * 0.8), rad = size * (0.35 + r() * 0.25);
    wrap(W, x, rad, (cx) => {
      c.fillStyle = shade(p.col, 0.04); c.beginPath(); c.moveTo(cx - rad * 0.12, y); c.quadraticCurveTo(cx + rad * 0.15, y - h * 0.5, cx - rad * 0.05, y - h); c.lineTo(cx + rad * 0.12, y - h); c.quadraticCurveTo(cx + rad * 0.3, y - h * 0.5, cx + rad * 0.16, y); c.fill();
      c.fillStyle = shade(p.col, 0.08); c.beginPath(); c.ellipse(cx, y - h, rad, rad * 0.5, 0, Math.PI, 0); c.fill();
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + (k + 0.5) * (Math.PI / 5), sx = cx + Math.cos(a) * rad * 0.65, sy = y - h + Math.sin(a) * rad * 0.3;
        glowDot(c, sx, sy, rad * 0.25, L.glow, glowAmt * (0.4 + p.night * 0.6));
      }
    });
  }
  c.fillStyle = p.col; c.fillRect(0, H * (base + 0.06), W, H);
}

/** paint a world's three layers for a stage (res: pixel scale of the strip) */
export function paintBackdrop(L: Look, res: number): Strip[] {
  const own = PAINT[L.world.id] ?? PAINT.toybox, other = L.blend ? PAINT[L.blend] : null;
  const painters = own.map((p, i) => (other && i === L.mixLayer ? other[i] : p));
  return painters.map((paint, layer) => {
    const W = STRIP_W, H = STRIP_H;
    const cv = document.createElement("canvas");
    cv.width = Math.round(W * res); cv.height = Math.round(H * res);
    const c = cv.getContext("2d")!;
    c.setTransform(res, 0, 0, res, 0, 0);
    const col = L.layers[layer];
    paint({ c, W, H, r: makeRng(L.seed * 31 + layer * 977 + 5), L, col, night: L.night, layer });
    // far layers melt into the haze a little more at the top
    if (layer === 0) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(L.haze, 0.0)); g.addColorStop(0.5, rgba(L.haze, 0.12)); g.addColorStop(1, rgba(L.haze, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    return { canvas: cv, base: col };
  });
}
