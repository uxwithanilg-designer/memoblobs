// The track itself, drawn in world space (metres, y up) every frame: the ground as layered soil (top surface band,
// rich topsoil, deep strata lines and pebbles that follow the hills), the surface trim for each world (grass blades,
// snow drifts, sand ripples, asphalt lane marks, glowing lava cracks, crystal shards), rope bridges over chasms, the
// checkpoint flags, the finish arch, and the pickups (spinning coins, fuel cans, hearts and power-up bubbles).
import type { Item, Track } from "../terrain";
import type { Look } from "./grade";
import { makeRng, mix, rgba, shade } from "../util";

export interface View { x0: number; x1: number; y0: number; y1: number; scale: number }

interface Pebble { x: number; d: number; r: number; c: number }

export class GroundArt {
  private pebbles: Pebble[] = [];
  private shards: { x: number; d: number; h: number; a: number; c: string }[] = [];
  private tufts: Float32Array;
  constructor(public track: Track, public look: Look) {
    const r = makeRng(track.plan.seed + 55);
    const { x0, x1 } = track.terrain;
    for (let x = x0; x < x1; x += 0.8 + r() * 1.6) this.pebbles.push({ x, d: 0.9 + r() * 5, r: 0.06 + r() * 0.2, c: r() < 0.5 ? 0 : 1 });
    if (look.world.ground === "crystal" || look.partner?.ground === "crystal") {
      const cols = [look.world.glow, look.world.accent, "#FF7CE0"];
      for (let x = x0; x < x1; x += 4 + r() * 9) this.shards.push({ x, d: 1.2 + r() * 4, h: 0.4 + r() * 0.8, a: (r() - 0.5) * 1.2, c: cols[Math.floor(r() * 3)] });
    }
    this.tufts = new Float32Array(4096);
    for (let i = 0; i < this.tufts.length; i++) this.tufts[i] = r();
  }

  /** the ground (under everything but the car) */
  draw(c: CanvasRenderingContext2D, v: View, t: number) {
    const tr = this.track, T = tr.terrain, l = this.look, fill = tr.fill;
    const i0 = Math.max(0, Math.floor((v.x0 - T.x0) / T.dx) - 2), i1 = Math.min(fill.length - 1, Math.ceil((v.x1 - T.x0) / T.dx) + 2);
    const bottom = v.y0 - 40;
    const X = (i: number) => T.x0 + i * T.dx;
    // the ground's outline
    const path = new Path2D();
    path.moveTo(X(i0), bottom);
    for (let i = i0; i <= i1; i++) path.lineTo(X(i), fill[i]);
    path.lineTo(X(i1), bottom);
    path.closePath();
    const surface = new Path2D();
    let first = true;
    for (let i = i0; i <= i1; i++) {
      // the surface line skips across chasms (the bridge is drawn on its own)
      if (fill[i] < T.h[i] - 1) { first = true; continue; }
      if (first) { surface.moveTo(X(i), fill[i]); first = false; } else surface.lineTo(X(i), fill[i]);
    }
    // deep soil: a gradient from the view's top to its bottom
    const g = c.createLinearGradient(0, v.y1, 0, v.y0 - 10);
    g.addColorStop(0, l.soil[0]); g.addColorStop(1, l.soil[1]);
    c.fillStyle = g; c.fill(path);
    c.save(); c.clip(path);
    c.lineJoin = "round"; c.lineCap = "round";
    // strata following the hills
    const strata = l.strata, lava = l.world.id === "volcano" || l.partner?.id === "volcano";
    for (const [d, w, a] of [[2.2, 0.16, 0.5], [3.6, 0.1, 0.35], [5.4, 0.22, 0.3]] as const) {
      c.save(); c.translate(0, -d);
      if (lava) { c.strokeStyle = rgba(strata, 0.25); c.lineWidth = w * 4; c.stroke(surface); c.strokeStyle = rgba("#FFC46B", 0.75); c.lineWidth = w * 0.6; }
      else { c.strokeStyle = rgba(strata, a); c.lineWidth = w; }
      c.stroke(surface);
      c.restore();
    }
    // pebbles (positions fixed to the ground)
    const pb = [shade(l.soil[0], -0.18), shade(l.soil[0], 0.12)];
    for (const p of this.pebbles) {
      if (p.x < v.x0 - 1 || p.x > v.x1 + 1) continue;
      const y = T.heightAt(p.x) - p.d;
      c.fillStyle = pb[p.c]; c.beginPath(); c.ellipse(p.x, y, p.r * 1.4, p.r, 0, 0, Math.PI * 2); c.fill();
    }
    for (const s of this.shards) {
      if (s.x < v.x0 - 1 || s.x > v.x1 + 1) continue;
      const y = T.heightAt(s.x) - s.d;
      c.save(); c.translate(s.x, y); c.rotate(s.a);
      c.fillStyle = rgba(s.c, 0.25); c.beginPath(); c.arc(0, s.h * 0.5, s.h, 0, Math.PI * 2); c.fill();
      c.fillStyle = rgba(s.c, 0.9); c.beginPath(); c.moveTo(-s.h * 0.2, 0); c.lineTo(s.h * 0.2, 0); c.lineTo(0, s.h); c.closePath(); c.fill();
      c.restore();
    }
    // topsoil and the surface band
    c.strokeStyle = shade(l.soil[0], 0.06); c.lineWidth = 2.4; c.stroke(surface);
    c.strokeStyle = mix(l.surface, l.soil[0], 0.45); c.lineWidth = 1.1; c.stroke(surface);
    c.strokeStyle = l.surface; c.lineWidth = 0.62; c.stroke(surface);
    // light catching the top edge
    c.strokeStyle = l.surfaceHi; c.lineWidth = 0.14; c.save(); c.translate(0, -0.05); c.stroke(surface); c.restore();
    c.restore();

    this.trim(c, v, i0, i1, t);
    this.bridges(c, v);
  }

  /** per-world surface detail */
  private trim(c: CanvasRenderingContext2D, v: View, i0: number, i1: number, t: number) {
    const T = this.track.terrain, l = this.look, fill = this.track.fill, ground = l.world.ground;
    const X = (i: number) => T.x0 + i * T.dx;
    const step = v.scale < 18 ? 2 : 1;
    if (ground === "grass" || ground === "moss" || ground === "jungle" || ground === "leaf") {
      const tall = ground === "jungle" ? 1.5 : ground === "leaf" ? 0.7 : 1;
      const cols = ground === "leaf" ? ["#E8712A", "#F2A33A", "#C9402A", l.surfaceHi] : [l.surfaceHi, l.surface, shade(l.surface, 0.18)];
      const sway = Math.sin(t * 1.6) * 0.04;
      for (let i = i0; i < i1; i += step) {
        if (fill[i] < T.h[i] - 1) continue;
        const x = X(i), y = fill[i];
        const rnd = this.tufts[i & 4095];
        const h = (0.18 + rnd * 0.22) * tall;
        c.fillStyle = cols[i % cols.length];
        if (ground === "leaf") { c.beginPath(); c.ellipse(x + rnd * 0.3, y + 0.04, 0.16, 0.07, rnd * 3, 0, Math.PI * 2); c.fill(); continue; }
        c.beginPath();
        c.moveTo(x - 0.12, y - 0.05); c.lineTo(x - 0.05 + sway, y + h); c.lineTo(x + 0.02, y - 0.05);
        c.moveTo(x + 0.02, y - 0.05); c.lineTo(x + 0.12 + sway, y + h * 0.75); c.lineTo(x + 0.18, y - 0.05);
        c.fill();
        if (rnd > 0.93 && ground !== "moss") { c.fillStyle = rnd > 0.965 ? "#FFF1F5" : "#FFD23F"; c.beginPath(); c.arc(x + 0.06, y + h + 0.04, 0.06, 0, Math.PI * 2); c.fill(); }
      }
    } else if (ground === "snow") {
      c.fillStyle = rgba("#FFFFFF", 0.9);
      for (let i = i0; i < i1; i += 3) {
        if (fill[i] < T.h[i] - 1) continue;
        const rnd = this.tufts[i & 4095];
        if (rnd < 0.6) continue;
        c.beginPath(); c.ellipse(X(i), fill[i] + 0.02, 0.5 + rnd * 0.6, 0.1 + rnd * 0.06, 0, 0, Math.PI); c.fill();
      }
      // sparkles
      for (let i = i0; i < i1; i += 5) { const rnd = this.tufts[(i * 7) & 4095]; if (Math.sin(t * 3 + rnd * 20) > 0.92) { c.fillStyle = "#FFFFFF"; c.fillRect(X(i), fill[i] - 0.2 - rnd * 0.4, 0.07, 0.07); } }
    } else if (ground === "sand" || ground === "redsand" || ground === "beach" || ground === "dust") {
      c.strokeStyle = rgba(shade(l.surface, -0.15), 0.5); c.lineWidth = 0.05;
      for (let i = i0; i < i1; i += 4) {
        if (fill[i] < T.h[i] - 1) continue;
        const rnd = this.tufts[i & 4095];
        c.beginPath(); c.moveTo(X(i) - 0.4, fill[i] - 0.35 - rnd * 0.3); c.quadraticCurveTo(X(i), fill[i] - 0.25 - rnd * 0.3, X(i) + 0.4, fill[i] - 0.38 - rnd * 0.3); c.stroke();
      }
      if (ground === "beach") { c.fillStyle = rgba("#FFFFFF", 0.6); for (let i = i0; i < i1; i += 9) { const rnd = this.tufts[i & 4095]; if (rnd > 0.7) { c.beginPath(); c.arc(X(i), fill[i] - 0.5 - rnd, 0.05, 0, Math.PI * 2); c.fill(); } } }
    } else if (ground === "asphalt") {
      // a dashed centre line and a kerb
      c.strokeStyle = rgba("#FFD23F", 0.85); c.lineWidth = 0.09; c.setLineDash([1.2, 1.4]);
      c.beginPath();
      let on = false;
      for (let i = i0; i <= i1; i++) { if (fill[i] < T.h[i] - 1) { on = false; continue; } const y = fill[i] - 0.32; if (!on) { c.moveTo(X(i), y); on = true; } else c.lineTo(X(i), y); }
      c.stroke(); c.setLineDash([]);
      c.strokeStyle = rgba("#E8E9F2", 0.65); c.lineWidth = 0.06;
      c.beginPath(); on = false;
      for (let i = i0; i <= i1; i++) { if (fill[i] < T.h[i] - 1) { on = false; continue; } if (!on) { c.moveTo(X(i), fill[i] - 0.04); on = true; } else c.lineTo(X(i), fill[i] - 0.04); }
      c.stroke();
    } else if (ground === "ash") {
      for (let i = i0; i < i1; i += 6) { const rnd = this.tufts[i & 4095]; if (rnd > 0.75) { c.fillStyle = rgba("#FF8A2B", 0.5 + 0.5 * Math.sin(t * 2 + rnd * 9)); c.beginPath(); c.arc(X(i), fill[i] - 0.15, 0.05, 0, Math.PI * 2); c.fill(); } }
    } else if (ground === "crystal") {
      for (let i = i0; i < i1; i += 7) { const rnd = this.tufts[i & 4095]; if (rnd > 0.8) { c.fillStyle = rgba(l.world.glow, 0.85); c.beginPath(); c.moveTo(X(i) - 0.08, fill[i]); c.lineTo(X(i), fill[i] + 0.3 + rnd * 0.2); c.lineTo(X(i) + 0.08, fill[i]); c.fill(); } }
    }
  }

  private bridges(c: CanvasRenderingContext2D, v: View) {
    const T = this.track.terrain, l = this.look;
    const wood = mix("#A9774A", l.tint, l.tintAmt), dark = shade(wood, -0.35 - l.night * 0.3);
    for (const b of this.track.bridges) {
      if (b.x1 < v.x0 - 2 || b.x0 > v.x1 + 2) continue;
      // posts and ropes
      for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y1]] as const) { c.fillStyle = dark; c.fillRect(x - 0.12, y - 0.8, 0.24, 2.2); c.fillStyle = shade(dark, 0.2); c.fillRect(x - 0.16, y + 1.3, 0.32, 0.12); }
      c.strokeStyle = rgba(shade(wood, -0.2), 0.95); c.lineWidth = 0.07;
      for (const off of [1.35, 0.75]) {
        c.beginPath();
        for (let k = 0; k <= 24; k++) { const tt = k / 24, x = b.x0 + (b.x1 - b.x0) * tt; const y = T.heightAt(x) + off - Math.sin(Math.PI * tt) * 0.25 * off; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
        c.stroke();
      }
      // planks
      for (let x = b.x0 + 0.1; x < b.x1 - 0.1; x += 0.55) {
        const y = T.heightAt(x), s = T.slopeAt(x);
        c.save(); c.translate(x, y); c.rotate(Math.atan(s));
        c.fillStyle = (Math.floor(x * 3) % 2) ? wood : shade(wood, -0.08);
        c.fillRect(-0.24, -0.22, 0.48, 0.22);
        c.fillStyle = rgba("#FFFFFF", 0.15); c.fillRect(-0.24, -0.03, 0.48, 0.03);
        c.restore();
        c.strokeStyle = rgba(shade(wood, -0.3), 0.8); c.lineWidth = 0.03; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 0.75 - Math.sin(Math.PI * (x - b.x0) / (b.x1 - b.x0)) * 0.19); c.stroke();
      }
    }
  }

  /** checkpoint flags and the finish arch (drawn after the ground, before the car) */
  drawMarks(c: CanvasRenderingContext2D, v: View, t: number, reached: number) {
    const T = this.track.terrain, tr = this.track;
    tr.checkpoints.forEach((x, k) => {
      if (x < v.x0 - 4 || x > v.x1 + 4) return;
      const y = T.heightAt(x), on = k < reached;
      c.fillStyle = "#E8E9F2"; c.fillRect(x - 0.06, y, 0.12, 3.4);
      const col = on ? "#3EE08F" : "#FFD23F";
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x + 0.06, y + 3.3);
      for (let s = 0; s <= 8; s++) { const u = s / 8; c.lineTo(x + 0.06 + u * 1.6, y + 3.3 - Math.sin(t * 6 - u * 4) * 0.12 * u); }
      for (let s = 8; s >= 0; s--) { const u = s / 8; c.lineTo(x + 0.06 + u * 1.6, y + 2.4 - Math.sin(t * 6 - u * 4) * 0.12 * u); }
      c.closePath(); c.fill();
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(x + 0.8, y + 2.85, 0.16, 0, Math.PI * 2); c.fill();
      // a glowing ring on the ground
      c.strokeStyle = rgba(col, 0.6); c.lineWidth = 0.08; c.beginPath(); c.ellipse(x, y + 0.05, 1.2, 0.18, 0, 0, Math.PI * 2); c.stroke();
    });
    const fx = tr.finish;
    if (fx > v.x0 - 8 && fx < v.x1 + 8) {
      const y = T.heightAt(fx);
      // checkered line on the ground
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? "#1B1F2B" : "#FFFFFF"; c.fillRect(fx - 0.3 + (k % 2) * 0.3, y - 0.3 + Math.floor(k / 2) * 0.1, 0.3, 0.1); }
      // the arch: two pillars and a checkered banner
      for (const s of [-1, 1]) {
        const px = fx + s * 2.6;
        const g = c.createLinearGradient(px - 0.25, 0, px + 0.25, 0);
        g.addColorStop(0, "#FF4F7A"); g.addColorStop(1, "#FF8A3D");
        c.fillStyle = g; c.beginPath(); c.roundRect(px - 0.28, y, 0.56, 5.2, 0.2); c.fill();
      }
      c.save(); c.beginPath(); c.roundRect(fx - 2.9, y + 4.3, 5.8, 1.1, 0.25); c.clip();
      for (let k = 0; k < 24; k++) { c.fillStyle = (k + Math.floor(k / 12)) % 2 ? "#1B1F2B" : "#FFFFFF"; c.fillRect(fx - 2.9 + (k % 12) * 0.49, y + 4.3 + Math.floor(k / 12) * 0.55, 0.49, 0.55); }
      c.restore();
      // balloons bobbing on the pillars
      const cols = ["#FFD23F", "#2EC4B6", "#FF5D8F", "#7B5CFF"];
      for (let k = 0; k < 4; k++) {
        const s = k < 2 ? -1 : 1, bx = fx + s * (2.6 + (k % 2 ? 0.5 : -0.2)), by = y + 5.6 + (k % 2) * 0.5 + Math.sin(t * 2 + k) * 0.12;
        c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.03; c.beginPath(); c.moveTo(fx + s * 2.6, y + 5.2); c.lineTo(bx, by - 0.4); c.stroke();
        const g = c.createRadialGradient(bx - 0.12, by + 0.15, 0.05, bx, by, 0.42);
        g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.3, cols[k]); g.addColorStop(1, shade(cols[k], -0.25));
        c.fillStyle = g; c.beginPath(); c.ellipse(bx, by, 0.36, 0.44, 0, 0, Math.PI * 2); c.fill();
      }
    }
  }
}

// ------------------------------------------------------------------ pickups
const COIN = { 5: ["#FFE07A", "#E8A317", "#FFF6C8"], 25: ["#FFFFFF", "#9FB4D6", "#FFFFFF"], 100: ["#7CF5FF", "#2E9BFF", "#E4FDFF"] } as Record<number, string[]>;
const POWER_COLOR: Record<string, string> = { turbo: "#FF6B3D", shield: "#2E9BFF", magnet: "#FF4F7A", feather: "#3EE08F", double: "#FFD23F" };
export const powerColor = (p: string) => POWER_COLOR[p] ?? "#FFFFFF";

export function drawItem(c: CanvasRenderingContext2D, it: Item, t: number, night: number) {
  const bob = Math.sin(t * 2.4 + it.phase) * 0.08;
  const x = it.x, y = it.y + bob;
  if (it.kind === "coin") {
    const [face, rim, hi] = COIN[it.value] ?? COIN[5];
    const s = it.value === 100 ? 0.42 : it.value === 25 ? 0.36 : 0.3;
    const w = Math.abs(Math.cos(t * 3 + it.phase)) * s + 0.04;
    if (it.value === 100) {
      // a gem: faceted diamond
      c.save(); c.translate(x, y); c.scale(w / s, 1);
      c.fillStyle = rgba(face, 0.25); c.beginPath(); c.arc(0, 0, s * 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = rim; c.beginPath(); c.moveTo(0, -s); c.lineTo(s, s * 0.25); c.lineTo(s * 0.6, s * 0.6); c.lineTo(-s * 0.6, s * 0.6); c.lineTo(-s, s * 0.25); c.closePath(); c.fill();
      c.fillStyle = face; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.4, s * 0.25); c.lineTo(-s * 0.4, s * 0.25); c.closePath(); c.fill();
      c.fillStyle = hi; c.beginPath(); c.moveTo(-s * 0.6, s * 0.6); c.lineTo(0, s * 0.25); c.lineTo(s * 0.6, s * 0.6); c.closePath(); c.fill();
      c.restore();
      return;
    }
    c.fillStyle = rim; c.beginPath(); c.ellipse(x, y, w, s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = face; c.beginPath(); c.ellipse(x, y, Math.max(0.01, w * 0.78), s * 0.8, 0, 0, Math.PI * 2); c.fill();
    if (w > s * 0.4) { c.fillStyle = rgba(rim, 0.8); c.fillRect(x - w * 0.12, y - s * 0.38, w * 0.24, s * 0.76); }
    c.fillStyle = rgba(hi, 0.9); c.beginPath(); c.ellipse(x - w * 0.3, y + s * 0.35, w * 0.18, s * 0.14, -0.6, 0, Math.PI * 2); c.fill();
  } else if (it.kind === "fuel") {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.5 + it.phase) * 0.08);
    c.fillStyle = rgba("#FF3B3B", 0.18 + 0.1 * night); c.beginPath(); c.arc(0, 0.05, 0.75, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(-0.35, 0, 0.35, 0); g.addColorStop(0, "#C21D2A"); g.addColorStop(0.5, "#FF4545"); g.addColorStop(1, "#B01624");
    c.fillStyle = g; c.beginPath(); c.roundRect(-0.34, -0.42, 0.68, 0.8, 0.1); c.fill();
    c.fillStyle = "#FFD23F"; c.beginPath(); c.roundRect(-0.2, 0.38, 0.22, 0.14, 0.04); c.fill();
    c.strokeStyle = "#FFFFFF"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-0.18, -0.25); c.lineTo(0.18, 0.18); c.moveTo(0.18, -0.25); c.lineTo(-0.18, 0.18); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(-0.3, -0.38, 0.08, 0.7);
    c.restore();
  } else if (it.kind === "heart") {
    const p = 1 + Math.sin(t * 5) * 0.07;
    c.save(); c.translate(x, y); c.scale(p * 0.45, p * 0.45);
    c.fillStyle = "rgba(255,79,122,0.25)"; c.beginPath(); c.arc(0, 0, 1.6, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(0, 1, 0, -1); g.addColorStop(0, "#FF7A9A"); g.addColorStop(1, "#E0244F");
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -0.9); c.bezierCurveTo(-1.6, 0.1, -0.9, 1.25, 0, 0.55); c.bezierCurveTo(0.9, 1.25, 1.6, 0.1, 0, -0.9); c.fill();
    c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.ellipse(-0.45, 0.55, 0.22, 0.12, -0.6, 0, Math.PI * 2); c.fill();
    c.restore();
  } else {
    const col = powerColor(it.power ?? "");
    const pulse = 1 + Math.sin(t * 4 + it.phase) * 0.06;
    c.save(); c.translate(x, y); c.scale(pulse, pulse);
    const halo = c.createRadialGradient(0, 0, 0.1, 0, 0, 1.1);
    halo.addColorStop(0, rgba(col, 0.55)); halo.addColorStop(1, rgba(col, 0));
    c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 1.1, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(-0.15, 0.2, 0.05, 0, 0, 0.55);
    g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.35, rgba(col, 0.9)); g.addColorStop(1, shade(col, -0.3));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 0.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.05; c.beginPath(); c.arc(0, 0, 0.5, 0, Math.PI * 2); c.stroke();
    powerIcon(c, it.power ?? "", 0.26);
    c.restore();
  }
}

/** the power's symbol, white, centred at 0,0 (world units, y up) */
export function powerIcon(c: CanvasRenderingContext2D, p: string, s: number) {
  c.fillStyle = "#FFFFFF"; c.strokeStyle = "#FFFFFF"; c.lineWidth = s * 0.22; c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath();
  if (p === "turbo") { c.moveTo(-s * 0.2, s); c.lineTo(-s * 0.55, -s * 0.05); c.lineTo(0, -s * 0.05); c.lineTo(-s * 0.2, -s); c.lineTo(s * 0.55, s * 0.15); c.lineTo(0, s * 0.15); c.closePath(); c.fill(); }
  else if (p === "shield") { c.moveTo(0, s); c.lineTo(s * 0.75, s * 0.6); c.lineTo(s * 0.6, -s * 0.4); c.lineTo(0, -s); c.lineTo(-s * 0.6, -s * 0.4); c.lineTo(-s * 0.75, s * 0.6); c.closePath(); c.fill(); }
  else if (p === "magnet") { c.arc(0, 0, s * 0.6, Math.PI, 0, true); c.moveTo(-s * 0.6, 0); c.lineTo(-s * 0.6, s * 0.7); c.moveTo(s * 0.6, 0); c.lineTo(s * 0.6, s * 0.7); c.stroke(); }
  else if (p === "feather") { c.moveTo(-s * 0.6, -s * 0.8); c.quadraticCurveTo(s * 0.9, -s * 0.2, s * 0.6, s * 0.9); c.quadraticCurveTo(-s * 0.4, s * 0.6, -s * 0.6, -s * 0.8); c.fill(); }
  else {
    // two stacked coins
    for (const [ox, oy] of [[-s * 0.3, -s * 0.25], [s * 0.3, s * 0.25]] as const) { c.beginPath(); c.arc(ox, oy, s * 0.55, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.arc(s * 0.3, s * 0.25, s * 0.28, 0, Math.PI * 2); c.fill();
  }
}
