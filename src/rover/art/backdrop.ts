// The painted ridges behind the track: three layers per world (far, mid, near), each painted once per stage into a
// strip that tiles seamlessly, then scrolled with parallax every frame (cheap on phones: one image draw per layer).
// Painters: snowy peaks, rolling hills (with patchwork fields), striped mesas, crested dunes, a city skyline with lit
// windows and neon, jungle canopy, round-crowned forest, pine forest, a smoking volcano with lava, the sea with islands
// and a sun path, cave crystals, and moon craters. Light comes from the sun's side; far layers fade into the haze.
import type { RidgeStyle } from "../worlds";
import type { Look } from "./grade";
import { clamp, makeRng, mix, range, rgba, shade, type Rng } from "../util";

/** the strips' reference size (scaled to the screen when drawn) */
export const STRIP_W = 1600, STRIP_H = 600;

export interface Strip { canvas: HTMLCanvasElement; base: string; h: number }

/** a periodic profile over the strip width (so tiles meet seamlessly): sum of sines with whole-number frequencies */
function profile(r: Rng, W: number, terms: [number, number][]) {
  const waves = terms.map(([k, a]) => ({ k, a, p: r() * Math.PI * 2 }));
  const out = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin((x / W) * Math.PI * 2 * w.k + w.p);
    out[x] = v;
  }
  return out;
}
const norm = (a: Float32Array) => { let lo = Infinity, hi = -Infinity; for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); } const s = hi - lo || 1; for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) / s; return a; };

function fillProfile(c: CanvasRenderingContext2D, ys: Float32Array, W: number, H: number) {
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 2) c.lineTo(x, ys[x]);
  c.lineTo(W, ys[W]);
  c.lineTo(W, H);
  c.closePath();
}
function grad(c: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(clamp(o, 0, 1), col);
  return g;
}
let tmp: HTMLCanvasElement | null = null;
/**
 * Faceted light, like painted vector art: the slopes facing away from the sun get a band of shade, the slopes facing it
 * a band of light. Each band is the silhouette minus a copy of itself shifted towards (or away from) the sun.
 */
function slopeLight(c: CanvasRenderingContext2D, ys: Float32Array, W: number, depth: number, light: string, sunRight: boolean, k = 1) {
  const H = STRIP_H, res = c.getTransform().a;
  tmp ??= document.createElement("canvas");
  if (tmp.width !== c.canvas.width || tmp.height !== c.canvas.height) { tmp.width = c.canvas.width; tmp.height = c.canvas.height; }
  const t = tmp.getContext("2d")!;
  const dir = sunRight ? 1 : -1;
  const band = (color: string, alpha: number, dx: number, dy: number) => {
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, tmp!.width, tmp!.height);
    t.setTransform(res, 0, 0, res, 0, 0);
    t.globalCompositeOperation = "source-over";
    fillProfile(t, ys, W, H); t.fillStyle = color; t.fill();
    t.globalCompositeOperation = "destination-out";
    t.save(); t.translate(dx, dy); fillProfile(t, ys, W, H); t.fillStyle = "#000"; t.fill(); t.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(tmp!, 0, 0); c.restore();
  };
  const d = clamp(depth / 8, 10, 30);
  // shade on the far side of every ridge (two soft steps), light on the near side
  band("#0B0820", 0.16 * k, dir * d, d * 0.25);
  band("#0B0820", 0.12 * k, dir * d * 2.2, d * 0.5);
  band(light, 0.22 * k, -dir * d * 0.8, d * 0.3);
}
function rim(c: CanvasRenderingContext2D, ys: Float32Array, W: number, color: string, alpha: number, width: number) {
  c.save();
  c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round";
  c.beginPath();
  for (let x = 0; x <= W; x += 2) { if (x === 0) c.moveTo(x, ys[x] + width * 0.5); else c.lineTo(x, ys[x] + width * 0.5); }
  c.stroke();
  c.restore();
}

export function paintStrip(style: RidgeStyle, color: string, hFrac: number, layer: number, look: Look, seed: number, res = 1): Strip {
  const W = STRIP_W, H = STRIP_H;
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * res); cv.height = Math.round(H * res);
  const c = cv.getContext("2d")!;
  c.scale(res, res);
  const r = makeRng(seed);
  const top = H * (1 - hFrac);
  const base = shade(color, -0.12 - layer * 0.04);
  const light = mix(look.light, color, 0.35);
  const sunRight = look.sunX > 0.5;
  const night = look.night;
  const ys = new Float32Array(W + 1);
  const set = (p: Float32Array, lo: number, hi: number) => { for (let x = 0; x <= W; x++) ys[x] = lo + (hi - lo) * (1 - p[x]); };
  const fillBody = (hiCol = shade(color, 0.08)) => {
    fillProfile(c, ys, W, H);
    c.fillStyle = grad(c, top, H, [[0, hiCol], [0.55, color], [1, base]]);
    c.fill();
  };
  // depth haze at the foot of far layers
  const footHaze = () => {
    if (layer > 1) return;
    c.fillStyle = grad(c, H * 0.55, H, [[0, rgba(look.haze, 0)], [1, rgba(look.haze, layer === 0 ? 0.55 : 0.28)]]);
    c.fillRect(0, H * 0.55, W, H * 0.45);
  };

  switch (style) {
    case "peaks": {
      // sharp summits: triangle waves for ridgelines, noise for crags
      const tri = (x: number, k: number, p: number) => { const t = ((x / W) * k + p) % 1; return 1 - Math.abs(t * 2 - 1); };
      const ks = [3, 5, 8].map((k) => ({ k, p: r(), a: range(r, 0.5, 1) }));
      const crag = profile(r, W, [[23, 0.05], [41, 0.03], [67, 0.02]]);
      const p = new Float32Array(W + 1);
      for (let x = 0; x <= W; x++) p[x] = Math.pow(tri(x, ks[0].k, ks[0].p), 1.4) * ks[0].a + Math.pow(tri(x, ks[1].k, ks[1].p), 1.8) * 0.6 * ks[1].a + tri(x, ks[2].k, ks[2].p) * 0.25 * ks[2].a + crag[x];
      norm(p); set(p, top, H * 0.92);
      fillBody();
      c.save(); fillProfile(c, ys, W, H); c.clip();
      slopeLight(c, ys, W, 260, light, sunRight, 1.2);
      // snow caps above a jagged snow line
      if (layer < 2 || look.world.id === "frost") {
        const snow = mix("#FFFFFF", look.sky[1], 0.15 + night * 0.25);
        const line = profile(r, W, [[17, 14], [31, 8], [53, 5]]);
        c.beginPath();
        c.moveTo(0, 0);
        for (let x = 0; x <= W; x += 2) c.lineTo(x, Math.min(ys[x] + 50 + line[x] * 1.4, top + (H - top) * 0.42 + line[x]));
        c.lineTo(W, 0); c.closePath();
        c.fillStyle = grad(c, top, top + (H - top) * 0.45, [[0, snow], [1, mix(snow, color, 0.25)]]);
        c.fill();
        slopeLight(c, ys, W, 70, "#FFFFFF", sunRight, 0.6);
      }
      c.restore();
      rim(c, ys, W, light, 0.35, 2);
      footHaze();
      break;
    }
    case "rounded": {
      const p = norm(profile(r, W, [[2, 1], [3, 0.6], [5, 0.3], [9, 0.12], [15, 0.05]]));
      set(p, top, H * 0.95);
      fillBody(shade(color, 0.12));
      c.save(); fillProfile(c, ys, W, H); c.clip();
      // patchwork fields on green hills, soft furrows on others
      const fieldy = look.world.ground === "grass" || look.world.ground === "moss" || look.world.ground === "beach" || look.world.ground === "leaf";
      if (fieldy && layer > 0) {
        for (let k = 0; k < 26; k++) {
          const x0 = r() * W, w = range(r, 70, 200), y = ys[Math.floor(clamp(x0, 0, W))] + range(r, 20, 140);
          c.fillStyle = rgba(r() < 0.5 ? shade(color, 0.14) : shade(color, -0.1), 0.45);
          c.beginPath(); c.ellipse(x0, y, w * 0.5, w * 0.12, range(r, -0.12, 0.12), 0, Math.PI * 2); c.fill();
        }
      }
      slopeLight(c, ys, W, 160, light, sunRight, 0.8);
      c.restore();
      rim(c, ys, W, light, 0.45, 3);
      footHaze();
      break;
    }
    case "mesas": {
      // flat-topped buttes with striped rock layers and dark crevices
      for (let x = 0; x <= W; x++) ys[x] = H * 0.97;
      let x = 0;
      const tops: [number, number, number][] = [];
      while (x < W) {
        const w = range(r, 120, 320), y = range(r, top, top + (H - top) * 0.45), sl = range(r, 18, 40);
        tops.push([x, w, y]);
        for (let i = 0; i <= w && x + i <= W; i++) {
          const e = Math.min(i, w - i);
          const yy = e < sl ? y + (sl - e) * 1.6 : y + Math.sin(i * 0.05) * 2;
          ys[Math.floor(x + i)] = Math.min(ys[Math.floor(x + i)], yy);
        }
        x += w * range(r, 0.6, 1.1);
      }
      // seam the ends so the strip tiles
      for (let i = 0; i < 40; i++) { const t = i / 40; ys[W - 40 + i] = ys[W - 40 + i] * (1 - t) + ys[i] * t; }
      fillBody(shade(color, 0.1));
      c.save(); fillProfile(c, ys, W, H); c.clip();
      for (let y = top; y < H; y += range(r, 10, 26)) {
        c.fillStyle = rgba(r() < 0.5 ? shade(color, 0.12) : shade(color, -0.14), 0.5);
        c.fillRect(0, y, W, range(r, 3, 9));
      }
      for (let k = 0; k < 60; k++) {
        const cx = r() * W, cy = ys[Math.floor(cx)] + range(r, 10, 60);
        c.strokeStyle = rgba(shade(color, -0.35), 0.45); c.lineWidth = range(r, 1, 3);
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + range(r, -6, 6), cy + range(r, 30, 120)); c.stroke();
      }
      slopeLight(c, ys, W, 200, light, sunRight, 0.9);
      c.restore();
      rim(c, ys, W, light, 0.5, 3);
      footHaze();
      break;
    }
    case "dunes": {
      const p = new Float32Array(W + 1);
      const ks = [{ k: 3, a: 1, p: r() }, { k: 5, a: 0.55, p: r() }, { k: 8, a: 0.25, p: r() }];
      for (let x = 0; x <= W; x++) {
        let v = 0;
        // skewed waves: gentle windward slope, sharp crest
        for (const w of ks) { const t = ((x / W) * w.k + w.p) % 1; v += w.a * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 1.3); }
        p[x] = v;
      }
      norm(p); set(p, top, H * 0.94);
      fillBody(shade(color, 0.14));
      c.save(); fillProfile(c, ys, W, H); c.clip();
      slopeLight(c, ys, W, 240, light, sunRight, 1.4);
      // ripples on the near dunes
      if (layer > 0) {
        c.strokeStyle = rgba(shade(color, -0.18), 0.3); c.lineWidth = 1.5;
        for (let k = 0; k < 70; k++) {
          const cx = r() * W, cy = ys[Math.floor(cx)] + range(r, 20, 160), w = range(r, 30, 90);
          c.beginPath(); c.moveTo(cx - w, cy); c.quadraticCurveTo(cx, cy - range(r, 3, 8), cx + w, cy + range(r, -3, 3)); c.stroke();
        }
      }
      c.restore();
      rim(c, ys, W, light, 0.55, 2.5);
      footHaze();
      break;
    }
    case "city": {
      for (let x = 0; x <= W; x++) ys[x] = H * 0.97;
      c.save();
      let x = 0;
      const lit = ["#FFD98A", "#FFF1C2", "#8FE7FF", "#FF9AD5", "#FFE0A3"];
      while (x < W) {
        const w = range(r, 28, 86), bh = range(r, 0.25, 1) * (H - top) * (r() < 0.15 ? 1.15 : 0.85);
        const y = H - bh;
        const body = shade(color, range(r, -0.08, 0.1));
        c.fillStyle = grad(c, y, H, [[0, shade(body, 0.12)], [1, base]]);
        c.fillRect(x, y, w, bh);
        // roofs: flat, stepped, spire or antenna
        const roof = r();
        if (roof < 0.25) { c.fillRect(x + w * 0.2, y - 14, w * 0.6, 14); }
        else if (roof < 0.4) { c.beginPath(); c.moveTo(x + w * 0.3, y); c.lineTo(x + w * 0.5, y - range(r, 30, 70)); c.lineTo(x + w * 0.7, y); c.fill(); }
        else if (roof < 0.6) { c.fillRect(x + w * 0.5 - 1, y - range(r, 20, 50), 2, 50); c.fillStyle = rgba("#FF4D6D", 0.6 + night * 0.4); c.fillRect(x + w * 0.5 - 2, y - 50, 4, 4); }
        // windows
        const win = 5 + layer, gap = 4 + layer;
        for (let wy = y + 8; wy < H - 10; wy += win + gap) {
          for (let wx = x + 5; wx < x + w - win - 3; wx += win + gap) {
            const on = r() < 0.25 + night * 0.45;
            c.fillStyle = on ? rgba(lit[Math.floor(r() * lit.length)], 0.55 + night * 0.4) : rgba(shade(color, -0.25), 0.6);
            c.fillRect(wx, wy, win, win * 1.2);
          }
        }
        for (let i = 0; i <= w && x + i <= W; i++) ys[Math.floor(x + i)] = Math.min(ys[Math.floor(x + i)], y);
        // a neon sign now and then
        if (layer > 0 && r() < 0.16) {
          const nc = r() < 0.5 ? look.world.accent : look.world.glow;
          c.shadowColor = nc; c.shadowBlur = 16 * night + 4;
          c.fillStyle = rgba(nc, 0.5 + 0.5 * night);
          c.fillRect(x + w * 0.15, y + 18, w * 0.7, 8);
          c.shadowBlur = 0;
        }
        x += w + range(r, 0, 10);
      }
      c.restore();
      // a soft city glow along the bottom at night
      c.fillStyle = grad(c, H * 0.5, H, [[0, rgba(look.world.accent, 0)], [1, rgba(look.world.accent, 0.18 * night)]]);
      c.fillRect(0, H * 0.5, W, H * 0.5);
      footHaze();
      break;
    }
    case "canopy":
    case "forest": {
      // a skyline of round crowns; canopy is taller and misty, forest has trunks peeking out
      const p = norm(profile(r, W, [[2, 1], [4, 0.5], [7, 0.25]]));
      set(p, top + (H - top) * 0.25, H * 0.9);
      const crown = (cx: number, cy: number, rr: number) => { c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fill(); };
      const leaf = look.world.id === "autumn" ? ["#E8712A", "#D9542B", "#F2A33A", "#C9402A", "#B8862F"] : null;
      c.fillStyle = base; fillProfile(c, ys, W, H); c.fill();
      const spots: [number, number, number, string][] = [];
      for (let x = -40; x < W + 40; x += range(r, 14, 30)) {
        const xi = Math.floor(clamp(x, 0, W));
        const rr = range(r, 22, style === "canopy" ? 60 : 42) * (1 - layer * 0.12);
        const col = leaf && layer > 0 ? shade(leaf[Math.floor(r() * leaf.length)], -0.1 - (2 - layer) * 0.1) : shade(color, range(r, -0.08, 0.1));
        spots.push([x, ys[xi] + rr * 0.6, rr, col]);
      }
      for (const [x, y, rr, col] of spots) {
        if (style === "forest") { c.fillStyle = shade(base, -0.1); c.fillRect(x - 3, y, 6, H - y); }
        c.fillStyle = col; crown(x, y, rr); crown(x + rr * 0.6, y + rr * 0.2, rr * 0.75); crown(x - rr * 0.6, y + rr * 0.25, rr * 0.7);
        if (x > W - 60) { crown(x - W, y, rr); }
        if (x < 60) { crown(x + W, y, rr); }
      }
      // light on the crowns' sunny side
      c.globalAlpha = 0.3;
      for (const [x, y, rr] of spots) { c.fillStyle = light; c.beginPath(); c.arc(x + (sunRight ? rr * 0.3 : -rr * 0.3), y - rr * 0.35, rr * 0.55, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
      for (let x = 0; x <= W; x++) ys[x] = Math.max(top, ys[x] - 30);
      if (style === "canopy") {
        // mist drifting between the trees
        c.fillStyle = grad(c, H * 0.45, H, [[0, rgba(look.haze, 0)], [0.6, rgba(look.haze, 0.35)], [1, rgba(look.haze, 0.1)]]);
        c.fillRect(0, H * 0.45, W, H * 0.55);
        // a waterfall on the far canopy
        if (layer === 0) {
          const fx = range(r, 0.2, 0.8) * W;
          c.fillStyle = grad(c, top, H, [[0, rgba("#FFFFFF", 0.75)], [1, rgba("#DFF7FF", 0.15)]]);
          c.fillRect(fx, top + 30, 26, H - top);
          c.fillStyle = rgba("#FFFFFF", 0.35); c.beginPath(); c.ellipse(fx + 13, H * 0.86, 70, 22, 0, 0, Math.PI * 2); c.fill();
        }
      }
      footHaze();
      break;
    }
    case "pines": {
      const p = norm(profile(r, W, [[2, 1], [5, 0.4], [9, 0.15]]));
      set(p, top + (H - top) * 0.35, H * 0.92);
      c.fillStyle = base; fillProfile(c, ys, W, H); c.fill();
      const snowy = look.world.id === "frost" || look.weather === "snow";
      for (let x = -20; x < W + 20; x += range(r, 9, 20)) {
        const xi = Math.floor(clamp(x, 0, W));
        const th = range(r, 50, 150) * (1 - layer * 0.15), tw = th * range(r, 0.32, 0.42);
        const y = ys[xi] + 12;
        const col = shade(color, range(r, -0.1, 0.06));
        const tree = (ox: number) => {
          for (let k = 0; k < 3; k++) {
            const ty = y - th + k * th * 0.24, bw = tw * (0.55 + k * 0.3);
            c.fillStyle = col;
            c.beginPath(); c.moveTo(ox, ty); c.lineTo(ox + bw * 0.5, ty + th * 0.42); c.lineTo(ox - bw * 0.5, ty + th * 0.42); c.closePath(); c.fill();
            c.fillStyle = rgba(light, 0.22);
            c.beginPath(); c.moveTo(ox, ty); c.lineTo(ox + (sunRight ? 1 : -1) * bw * 0.5, ty + th * 0.42); c.lineTo(ox, ty + th * 0.42); c.closePath(); c.fill();
            if (snowy) { c.fillStyle = rgba("#FFFFFF", 0.85); c.beginPath(); c.moveTo(ox, ty); c.lineTo(ox + bw * 0.22, ty + th * 0.14); c.lineTo(ox - bw * 0.22, ty + th * 0.14); c.closePath(); c.fill(); }
          }
          c.fillStyle = col; c.fillRect(ox - tw * 0.5, y - th * 0.3, tw, th * 0.3 + 40);
        };
        tree(x);
        if (x > W - 40) tree(x - W);
        if (x < 40) tree(x + W);
      }
      footHaze();
      break;
    }
    case "volcano": {
      const p = norm(profile(r, W, [[2, 0.5], [5, 0.25], [11, 0.1]]));
      set(p, top + (H - top) * 0.55, H * 0.94);
      // the cone
      const cx = range(r, 0.3, 0.7) * W, cw = W * 0.34, crater = 50;
      for (let x = 0; x <= W; x++) {
        const d = Math.abs(x - cx);
        if (d < cw) { const t = d / cw; const y = top + 30 + (H - top) * 0.9 * Math.pow(t, 1.25) + (d < crater ? (crater - d) * 0.35 : 0); ys[x] = Math.min(ys[x], y); }
      }
      // the cone stands out dark against the smoky sky
      fillProfile(c, ys, W, H);
      c.fillStyle = grad(c, top, H, [[0, shade(color, -0.12)], [0.6, shade(color, -0.22)], [1, base]]);
      c.fill();
      c.save(); fillProfile(c, ys, W, H); c.clip();
      slopeLight(c, ys, W, 220, light, sunRight, 0.8);
      // lava streams down the cone
      c.shadowColor = look.world.glow; c.shadowBlur = 18;
      for (let k = 0; k < 5; k++) {
        const sx = cx + range(r, -crater, crater) * 0.7;
        c.strokeStyle = rgba(k % 2 ? "#FFB23A" : look.world.glow, 0.85); c.lineWidth = range(r, 2, 5);
        c.beginPath(); c.moveTo(sx, top + 40);
        let lx = sx, ly = top + 40;
        for (let s = 0; s < 14; s++) { lx += range(r, -14, 14) + (sx - cx) * 0.12; ly += range(r, 14, 26); c.lineTo(lx, ly); }
        c.stroke();
      }
      c.shadowBlur = 0;
      c.restore();
      // the glow of the crater and a smoke plume
      c.fillStyle = grad(c, top - 40, top + 80, [[0, rgba(look.world.glow, 0)], [0.6, rgba(look.world.glow, 0.45)], [1, rgba(look.world.glow, 0)]]);
      c.fillRect(cx - 90, top - 40, 180, 120);
      for (let k = 0; k < 16; k++) {
        const t = k / 16;
        c.fillStyle = rgba(mix("#3A2A30", look.haze, t), 0.22 * (1 - t));
        c.beginPath(); c.arc(cx + t * 160 + Math.sin(k) * 20, top + 10 - t * 300, 30 + t * 70, 0, Math.PI * 2); c.fill();
      }
      footHaze();
      break;
    }
    case "sea": {
      // the horizon, distant islands, a sun path and wave glints
      const hy = top + (H - top) * 0.25;
      const sea = mix(color, look.sky[2], 0.25);
      c.fillStyle = grad(c, hy, H, [[0, mix(sea, look.sky[2], 0.45)], [0.35, sea], [1, shade(sea, -0.2)]]);
      c.fillRect(0, hy, W, H - hy);
      for (let k = 0; k < 3; k++) {
        const ix = r() * W, iw = range(r, 80, 220), ih = range(r, 12, 40);
        c.fillStyle = mix(shade(color, -0.25), look.haze, 0.45);
        c.beginPath(); c.moveTo(ix - iw / 2, hy + 1); c.quadraticCurveTo(ix, hy - ih * 2, ix + iw / 2, hy + 1); c.fill();
      }
      const sx = look.sunX * W;
      for (let y = hy + 4; y < H; y += range(r, 5, 11)) {
        const t = (y - hy) / (H - hy);
        const w = 20 + t * 140 + range(r, -10, 10);
        c.fillStyle = rgba(look.light, 0.5 * (1 - t) + 0.05);
        c.fillRect(sx - w / 2 + range(r, -20, 20), y, w * range(r, 0.3, 1), 2);
        if (r() < 0.6) { c.fillStyle = rgba("#FFFFFF", 0.18); c.fillRect(r() * W, y, range(r, 8, 30), 1.5); }
      }
      for (let x = 0; x <= W; x++) ys[x] = hy;
      break;
    }
    case "crystals": {
      const p = norm(profile(r, W, [[3, 1], [7, 0.4], [13, 0.2]]));
      set(p, top + (H - top) * 0.3, H * 0.94);
      // stalagmites
      for (let x = 0; x < W; x += range(r, 18, 50)) {
        const hgt = range(r, 40, 180) * (1 - layer * 0.2), w = hgt * range(r, 0.18, 0.3);
        for (let i = -w; i <= w; i++) { const xi = Math.floor(x + i); if (xi < 0 || xi > W) continue; const t = Math.abs(i) / w; ys[xi] = Math.min(ys[xi], ys[xi] - hgt * (1 - t) * (1 - t * 0.3)); }
      }
      fillBody(shade(color, 0.12));
      c.save(); fillProfile(c, ys, W, H); c.clip();
      slopeLight(c, ys, W, 160, light, true, 0.6);
      c.restore();
      // glowing crystal clusters
      const cols = [look.world.glow, look.world.accent, "#FF7CE0"];
      for (let k = 0; k < 14 - layer * 3; k++) {
        const cx = r() * W, cy = ys[Math.floor(cx)] + range(r, 6, 30), col = cols[k % 3];
        c.shadowColor = col; c.shadowBlur = 14;
        for (let q = 0; q < 3; q++) {
          const hh = range(r, 18, 44) * (1 - layer * 0.15), ww = hh * 0.28, a = range(r, -0.5, 0.5);
          c.save(); c.translate(cx + q * 8 - 8, cy); c.rotate(a);
          c.fillStyle = rgba(col, 0.75); c.beginPath(); c.moveTo(0, -hh); c.lineTo(ww, -hh * 0.75); c.lineTo(ww, 0); c.lineTo(-ww, 0); c.lineTo(-ww, -hh * 0.75); c.closePath(); c.fill();
          c.fillStyle = rgba("#FFFFFF", 0.45); c.beginPath(); c.moveTo(0, -hh); c.lineTo(ww * 0.3, -hh * 0.72); c.lineTo(ww * 0.3, -hh * 0.1); c.lineTo(0, -hh * 0.1); c.fill();
          c.restore();
        }
        c.shadowBlur = 0;
      }
      footHaze();
      break;
    }
    case "craters": {
      const p = norm(profile(r, W, [[2, 1], [5, 0.45], [11, 0.2], [23, 0.06]]));
      set(p, top + (H - top) * 0.2, H * 0.94);
      fillBody(shade(color, 0.16));
      c.save(); fillProfile(c, ys, W, H); c.clip();
      slopeLight(c, ys, W, 140, light, sunRight, 1.1);
      for (let k = 0; k < 22; k++) {
        const cx = r() * W, cy = ys[Math.floor(cx)] + range(r, 20, 220), rr = range(r, 10, 46) * (1 + layer * 0.3);
        c.fillStyle = rgba(shade(color, -0.28), 0.6); c.beginPath(); c.ellipse(cx, cy, rr, rr * 0.32, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = rgba(shade(color, 0.35), 0.55); c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy - 1, rr, rr * 0.32, 0, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
      }
      c.restore();
      rim(c, ys, W, light, 0.55, 2);
      break;
    }
  }
  return { canvas: cv, base, h: hFrac };
}

export interface Backdrop { strips: Strip[]; style: RidgeStyle[] }

/** the three layers for a stage (the remix partner's style shows up on the near layer) */
export function paintBackdrop(look: Look, seed: number, res: number): Backdrop {
  const w = look.world, p = look.partner;
  const styles = w.ridges.map((rg) => rg.style);
  if (p && !w.enclosed && !p.enclosed) styles[1] = p.ridges[1].style;
  const strips = w.ridges.map((rg, i) => paintStrip(styles[i], look.ridges[i], rg.h, i, look, seed * 31 + i * 977, res));
  return { strips, style: styles };
}
