// The road, drawn in world space (metres, y up) every frame: layered soil (a rich topsoil band, strata that follow the
// hills, pebbles and roots), the surface trim of each world (grass blades, flowers, snow lumps, sand ripples, ash with
// glowing cracks, moon dust), glossy mud patches with bubbles, icy sheets, animated water fords, rope bridges over
// chasms, fallen logs, checkpoint gates, the delivery yard at the end, and the pickups (spinning coins and gems, fuel
// cans, hearts and power-up bubbles). Paths are traced straight into the context: nothing is allocated per frame.
import type { Course, Item, PowerId } from "../terrain";
import type { Look } from "./grade";
import { makeRng, mix, rgba, shade } from "../util";

export interface View { x0: number; x1: number; y0: number; y1: number; scale: number }
type C = CanvasRenderingContext2D;

export const POWER_COLOR: Record<PowerId, string> = { nitro: "#FF7A2A", net: "#3EE08F", bubble: "#7CC8FF", magnet: "#FF4F7A", double: "#FFD23F" };

export class GroundArt {
  private pebbles: Float32Array;
  private tufts: Float32Array;
  private c0: Record<string, string>;
  constructor(public course: Course, public look: Look) {
    const r = makeRng(course.plan.seed + 55);
    const { x0, x1 } = course.terrain;
    const n = Math.floor((x1 - x0) / 1.1);
    this.pebbles = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.pebbles[i * 3] = x0 + i * 1.1 + r() * 0.9; this.pebbles[i * 3 + 1] = 0.7 + r() * 5; this.pebbles[i * 3 + 2] = 0.05 + r() * 0.18; }
    this.tufts = new Float32Array(2048);
    for (let i = 0; i < this.tufts.length; i++) this.tufts[i] = r();
    const l = look;
    this.c0 = {
      top: l.surface, hi: l.surfaceHi, lip: shade(l.surface, -0.28), soilHi: mix(l.soil[0], l.surface, 0.18),
      peb0: shade(l.soil[0], -0.2), peb1: shade(l.soil[0], 0.14), strata: rgba(l.strata, 0.45),
      mud: mix("#4A3020", l.soil[0], 0.25), mudHi: rgba("#FFE6C0", 0.35), ice: mix("#BFE8FF", l.surface, 0.2),
      water: mix("#2E8FD8", l.haze, 0.25), waterDeep: mix("#14457A", l.soil[1], 0.3),
    };
  }

  private trace(c: C, i0: number, i1: number, dy = 0) {
    const T = this.course.terrain, f = this.course.fill;
    for (let i = i0; i <= i1; i++) { const x = T.x0 + i * T.dx; if (i === i0) c.moveTo(x, f[i] - dy); else c.lineTo(x, f[i] - dy); }
  }
  /** the surface line, broken over chasms (bridges are drawn on their own) */
  private traceSurface(c: C, i0: number, i1: number, dy: number) {
    const T = this.course.terrain, f = this.course.fill;
    let pen = false;
    for (let i = i0; i <= i1; i++) {
      if (f[i] < T.h[i] - 1) { pen = false; continue; }
      const x = T.x0 + i * T.dx;
      if (!pen) { c.moveTo(x, f[i] - dy); pen = true; } else c.lineTo(x, f[i] - dy);
    }
  }

  draw(c: C, v: View, t: number) {
    const co = this.course, T = co.terrain, l = this.look, k = this.c0;
    const i0 = Math.max(0, Math.floor((v.x0 - T.x0) / T.dx) - 2), i1 = Math.min(co.fill.length - 1, Math.ceil((v.x1 - T.x0) / T.dx) + 2);
    const bottom = v.y0 - 40;
    const X = (i: number) => T.x0 + i * T.dx;
    // soil body
    c.beginPath(); c.moveTo(X(i0), bottom); this.trace(c, i0, i1); c.lineTo(X(i1), bottom); c.closePath();
    const g = c.createLinearGradient(0, v.y1, 0, v.y0 - 10);
    g.addColorStop(0, l.soil[0]); g.addColorStop(1, l.soil[1]);
    c.fillStyle = g;
    c.save(); c.fill(); c.clip();
    c.lineJoin = "round"; c.lineCap = "round";
    // topsoil, strata following the hills
    c.beginPath(); this.traceSurface(c, i0, i1, 0.55); c.strokeStyle = k.soilHi; c.lineWidth = 1.0; c.stroke();
    const lava = l.world.id === "ember" || l.partner?.id === "ember";
    for (const [d, w] of [[1.9, 0.12], [3.3, 0.08], [5.2, 0.18]] as const) {
      c.beginPath(); this.traceSurface(c, i0, i1, d);
      if (lava) { c.strokeStyle = rgba("#FF7A2A", 0.3 + 0.15 * Math.sin(t * 2 + d)); c.lineWidth = w * 3; c.stroke(); c.strokeStyle = rgba("#FFC46B", 0.8); c.lineWidth = w * 0.5; }
      else { c.strokeStyle = k.strata; c.lineWidth = w; }
      c.stroke();
    }
    // pebbles
    const pb = this.pebbles;
    for (let p = 0; p < pb.length; p += 3) {
      const x = pb[p];
      if (x < v.x0 - 1) continue;
      if (x > v.x1 + 1) break;
      const y = T.heightAt(x) - pb[p + 1], rr = pb[p + 2];
      c.fillStyle = p % 2 ? k.peb0 : k.peb1; c.beginPath(); c.ellipse(x, y, rr * 1.4, rr, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // the surface band and its lip
    c.lineJoin = "round"; c.lineCap = "round";
    c.beginPath(); this.traceSurface(c, i0, i1, 0.16); c.strokeStyle = k.lip; c.lineWidth = 0.32; c.stroke();
    c.beginPath(); this.traceSurface(c, i0, i1, 0.02); c.strokeStyle = k.top; c.lineWidth = 0.3; c.stroke();
    c.beginPath(); this.traceSurface(c, i0, i1, -0.1); c.strokeStyle = k.hi; c.lineWidth = 0.07; c.stroke();
    this.trim(c, v, t, i0, i1);
    this.zones(c, v, t);
    this.bridges(c, v);
    this.logs(c, v);
  }

  /** each ground type's surface detail */
  private trim(c: C, v: View, t: number, i0: number, i1: number) {
    const co = this.course, T = co.terrain, l = this.look, k = this.c0, tf = this.tufts;
    const g = l.world.ground;
    const step = v.scale < 18 ? 2 : 1;
    if (g === "snow") {
      c.fillStyle = "#FFFFFF";
      for (let i = i0; i <= i1; i += 2) { const x = T.x0 + i * T.dx; if (co.fill[i] < T.h[i] - 1) continue; const s = tf[i & 2047]; c.beginPath(); c.ellipse(x, co.fill[i] + 0.02, 0.35 + s * 0.5, 0.1 + s * 0.08, 0, 0, Math.PI); c.fill(); }
      return;
    }
    if (g === "sand" || g === "moon") {
      c.strokeStyle = rgba(g === "moon" ? "#FFFFFF" : "#FFE6B0", 0.4); c.lineWidth = 0.05;
      for (let i = i0; i <= i1; i += 3) { const x = T.x0 + i * T.dx; if (co.fill[i] < T.h[i] - 1) continue; const s = tf[i & 2047]; c.beginPath(); c.moveTo(x, co.fill[i] - 0.3 - s * 0.4); c.lineTo(x + 0.8, T.heightAt(x + 0.8) - 0.3 - s * 0.4); c.stroke(); }
      if (g === "moon") { c.fillStyle = rgba("#2A2D44", 0.35); for (let i = i0; i <= i1; i += 9) { const s = tf[(i * 7) & 2047]; if (s < 0.5) continue; const x = T.x0 + i * T.dx; c.beginPath(); c.ellipse(x, co.fill[i] - 0.25, 0.4 + s * 0.4, 0.1, 0, 0, Math.PI * 2); c.fill(); } }
      return;
    }
    if (g === "ash") {
      for (let i = i0; i <= i1; i += 4) { const s = tf[i & 2047]; if (s < 0.6) continue; const x = T.x0 + i * T.dx; c.fillStyle = rgba("#FF8A3A", 0.5 + 0.4 * Math.sin(t * 3 + s * 9)); c.beginPath(); c.ellipse(x, co.fill[i] - 0.3, 0.3, 0.05, 0, 0, Math.PI * 2); c.fill(); }
      return;
    }
    // grass-like grounds: blades, and flowers on meadows
    const blade = mix(k.top, k.hi, 0.35), dark = shade(k.top, -0.18);
    const sway = Math.sin(t * 1.6) * 0.05;
    c.lineWidth = 0.055;
    for (let i = i0; i <= i1; i += step) {
      if (co.fill[i] < T.h[i] - 1 || T.zone[i] !== 0 || T.water[i] > -1e8) continue;
      const x = T.x0 + i * T.dx, y = co.fill[i], s = tf[i & 2047];
      const h = 0.18 + s * 0.22;
      c.strokeStyle = s > 0.5 ? blade : dark;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 0.04, y + h * 0.5, x + 0.08 + sway, y + h); c.moveTo(x + 0.18, y); c.quadraticCurveTo(x + 0.14, y + h * 0.6, x + 0.1 + sway, y + h * 0.9); c.stroke();
      if ((g === "meadow" || g === "terrace" || g === "farm") && s > 0.86) {
        const fc = g === "terrace" ? "#FF9EC4" : s > 0.93 ? "#FFFFFF" : "#FFD23F";
        c.fillStyle = fc; c.beginPath(); c.arc(x + 0.1 + sway, y + h + 0.05, 0.07, 0, Math.PI * 2); c.fill();
      }
    }
  }

  /** mud, ice and water */
  private zones(c: C, v: View, t: number) {
    const co = this.course, T = co.terrain, k = this.c0;
    for (const m of co.muds) {
      if (m.x1 < v.x0 || m.x0 > v.x1) continue;
      c.beginPath();
      for (let x = m.x0; x <= m.x1; x += 0.5) { const y = T.heightAt(x) + 0.06 + Math.sin(x * 2.1) * 0.02; if (x === m.x0) c.moveTo(x, y); else c.lineTo(x, y); }
      for (let x = m.x1; x >= m.x0; x -= 0.5) c.lineTo(x, T.heightAt(x) - 0.28);
      c.closePath(); c.fillStyle = k.mud; c.fill();
      c.strokeStyle = k.mudHi; c.lineWidth = 0.05;
      for (let x = m.x0 + 1; x < m.x1 - 1; x += 2.3) { c.beginPath(); c.moveTo(x, T.heightAt(x) + 0.03); c.lineTo(x + 0.9, T.heightAt(x + 0.9) + 0.03); c.stroke(); }
      // bubbles
      c.fillStyle = rgba("#2A1A10", 0.55);
      for (let x = m.x0 + 0.7; x < m.x1; x += 1.9) { const p = (t * 0.6 + x * 0.37) % 1; c.beginPath(); c.arc(x, T.heightAt(x) + 0.05, 0.06 + p * 0.06, Math.PI, 0); c.fill(); }
    }
    for (const m of co.ices) {
      if (m.x1 < v.x0 || m.x0 > v.x1) continue;
      c.beginPath();
      for (let x = m.x0; x <= m.x1; x += 0.5) { const y = T.heightAt(x) + 0.05; if (x === m.x0) c.moveTo(x, y); else c.lineTo(x, y); }
      for (let x = m.x1; x >= m.x0; x -= 0.5) c.lineTo(x, T.heightAt(x) - 0.12);
      c.closePath(); c.fillStyle = rgba(k.ice, 0.92); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.05;
      for (let x = m.x0 + 0.6; x < m.x1 - 1; x += 2.6) { c.beginPath(); c.moveTo(x, T.heightAt(x) + 0.02); c.lineTo(x + 1.1, T.heightAt(x + 1.1) + 0.02); c.stroke(); }
    }
  }

  /** water drawn over the truck's wheels (the truck wades through it) */
  drawWater(c: C, v: View, t: number) {
    const co = this.course, T = co.terrain, k = this.c0;
    for (const f of co.fords) {
      if (f.x1 < v.x0 - 1 || f.x0 > v.x1 + 1) continue;
      c.beginPath();
      for (let x = f.x0; x <= f.x1 + 0.001; x += 0.25) { const y = f.level + Math.sin(x * 2.2 + t * 2.4) * 0.03 + Math.sin(x * 5.3 - t * 3.1) * 0.015; if (x === f.x0) c.moveTo(x, y); else c.lineTo(x, y); }
      for (let x = f.x1; x >= f.x0; x -= 0.5) c.lineTo(x, Math.min(f.level, T.heightAt(x)) - 0.05);
      c.closePath();
      const g = c.createLinearGradient(0, f.level, 0, f.level - 1.4);
      g.addColorStop(0, rgba(k.water, 0.72)); g.addColorStop(1, rgba(k.waterDeep, 0.88));
      c.fillStyle = g; c.fill();
      // the shine on the surface and ripples
      c.strokeStyle = "rgba(255,255,255,0.65)"; c.lineWidth = 0.05;
      c.beginPath();
      for (let x = f.x0; x <= f.x1; x += 0.25) { const y = f.level + Math.sin(x * 2.2 + t * 2.4) * 0.03 + Math.sin(x * 5.3 - t * 3.1) * 0.015; if (x === f.x0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.3)";
      for (let x = f.x0 + 0.8; x < f.x1 - 0.8; x += 1.7) { const ph = (t * 0.5 + x) % 3; c.beginPath(); c.moveTo(x - 0.3 + ph * 0.1, f.level - 0.18 - ph * 0.06); c.lineTo(x + 0.3 + ph * 0.1, f.level - 0.18 - ph * 0.06); c.stroke(); }
    }
  }

  private bridges(c: C, v: View) {
    const co = this.course, T = co.terrain, l = this.look;
    const plank = shade("#B07A48", -l.night * 0.35), plankD = shade("#7A4E2A", -l.night * 0.35), rope = shade("#D9B98A", -l.night * 0.35);
    for (const b of co.bridges) {
      if (b.x1 < v.x0 - 2 || b.x0 > v.x1 + 2) continue;
      // posts at both ends
      for (const px of [b.x0, b.x1]) { const y = T.heightAt(px); c.fillStyle = plankD; c.fillRect(px - 0.14, y - 0.5, 0.28, 2.0); c.fillStyle = plank; c.fillRect(px - 0.1, y - 0.5, 0.12, 2.0); }
      // planks
      for (let x = b.x0 + 0.1; x < b.x1; x += 0.42) {
        const y = T.heightAt(x), s = T.slopeAt(x);
        c.save(); c.translate(x, y); c.rotate(Math.atan(s));
        c.fillStyle = (Math.floor(x * 2.4) % 3) === 0 ? plankD : plank; c.fillRect(-0.18, -0.16, 0.36, 0.16);
        c.restore();
      }
      // hand ropes and their hangers
      c.strokeStyle = rope; c.lineWidth = 0.06;
      c.beginPath();
      for (let x = b.x0; x <= b.x1; x += 0.5) { const u = (x - b.x0) / (b.x1 - b.x0); const y = T.heightAt(b.x0) * (1 - u) + T.heightAt(b.x1) * u + 1.45 - Math.sin(Math.PI * u) * b.sag * 0.6; if (x === b.x0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      c.lineWidth = 0.03;
      for (let x = b.x0 + 1; x < b.x1; x += 1.2) { const u = (x - b.x0) / (b.x1 - b.x0); const top = T.heightAt(b.x0) * (1 - u) + T.heightAt(b.x1) * u + 1.45 - Math.sin(Math.PI * u) * b.sag * 0.6; c.beginPath(); c.moveTo(x, top); c.lineTo(x, T.heightAt(x)); c.stroke(); }
    }
  }

  /** what lies across the road: a fallen log, a snowy log, a hay roll on the farms, a culvert pipe on the volcano and
   * the moon */
  private logs(c: C, v: View) {
    const co = this.course, T = co.terrain, l = this.look, id = l.world.id;
    const n = -l.night * 0.35;
    const look = id === "ember" || id === "starfall" ? "pipe" : id === "henhill" || id === "orchard" || id === "honey" ? "hay" : "wood";
    const bark = shade(look === "pipe" ? "#5A5E6E" : look === "hay" ? "#C9962E" : "#6A4426", n);
    const wood = shade(look === "pipe" ? "#2A2D3A" : look === "hay" ? "#EBC45A" : "#E2B27A", n);
    const ring = shade(look === "pipe" ? "#8E96A8" : look === "hay" ? "#B98A2A" : "#B57E4A", n);
    for (const lg of co.logs) {
      if (lg.x < v.x0 - 2 || lg.x > v.x1 + 2) continue;
      const base = Math.min(T.heightAt(lg.x - lg.r * 2.8), T.heightAt(lg.x + lg.r * 2.8));
      const y = base + lg.r * 0.85, R = lg.r * 1.05;
      c.fillStyle = bark; c.beginPath(); c.arc(lg.x, y, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = wood; c.beginPath(); c.arc(lg.x, y, R * (look === "pipe" ? 0.72 : 0.8), 0, Math.PI * 2); c.fill();
      c.strokeStyle = ring; c.lineWidth = 0.025;
      if (look === "hay") { c.beginPath(); for (let k = 0; k < 30; k++) { const a = k * 0.6, rr = (R * 0.75 * k) / 30; c.lineTo(lg.x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.stroke(); }
      else if (look === "pipe") { c.lineWidth = 0.04; c.beginPath(); c.arc(lg.x, y, R * 0.86, 0, Math.PI * 2); c.stroke(); }
      else { c.beginPath(); c.arc(lg.x, y, R * 0.55, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(lg.x, y, R * 0.3, 0, Math.PI * 2); c.stroke(); }
      if (id === "frost") { c.fillStyle = "#F6FAFF"; c.beginPath(); c.ellipse(lg.x, y + R * 0.8, R * 1.05, R * 0.38, 0, 0, Math.PI); c.fill(); }
      c.fillStyle = rgba("#FFFFFF", 0.18); c.beginPath(); c.arc(lg.x - R * 0.2, y + R * 0.25, R * 0.3, 0, Math.PI * 2); c.fill();
    }
  }

  /** the warning signs before hazards: a post and a yellow diamond with a little picture */
  private signs(c: C, v: View) {
    const co = this.course, T = co.terrain, l = this.look;
    const post = shade("#5A5E6E", -l.night * 0.3), face = shade("#FFC93D", -l.night * 0.3), ink = "#22243A";
    for (const sg of co.signs) {
      if (sg.x < v.x0 - 2) continue;
      if (sg.x > v.x1 + 2) break;
      const y = T.heightAt(sg.x);
      c.fillStyle = post; c.fillRect(sg.x - 0.05, y - 0.2, 0.1, 1.8);
      c.save(); c.translate(sg.x, y + 1.95);
      c.fillStyle = ink; c.beginPath(); c.moveTo(0, 0.5); c.lineTo(0.5, 0); c.lineTo(0, -0.5); c.lineTo(-0.5, 0); c.closePath(); c.fill();
      c.fillStyle = face; c.beginPath(); c.moveTo(0, 0.43); c.lineTo(0.43, 0); c.lineTo(0, -0.43); c.lineTo(-0.43, 0); c.closePath(); c.fill();
      c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 0.045; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath();
      switch (sg.kind) {
        case "bump": c.moveTo(-0.24, -0.1); c.quadraticCurveTo(0, 0.24, 0.24, -0.1); c.stroke(); break;
        case "jump": c.moveTo(-0.25, -0.12); c.lineTo(0.05, -0.12); c.lineTo(0.05, 0.04); c.closePath(); c.fill(); c.beginPath(); c.moveTo(0.02, 0.06); c.quadraticCurveTo(0.12, 0.22, 0.24, 0.05); c.stroke(); break;
        case "log": c.arc(0, -0.02, 0.15, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, -0.02, 0.06, 0, Math.PI * 2); c.stroke(); break;
        case "water": for (let k = 0; k < 2; k++) { c.moveTo(-0.22, -0.08 + k * 0.12); c.quadraticCurveTo(-0.11, 0.0 + k * 0.12, 0, -0.08 + k * 0.12); c.quadraticCurveTo(0.11, -0.16 + k * 0.12, 0.22, -0.08 + k * 0.12); } c.stroke(); break;
        case "mud": c.ellipse(0, -0.08, 0.2, 0.08, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(-0.06, 0.08, 0.04, 0, Math.PI * 2); c.arc(0.08, 0.12, 0.03, 0, Math.PI * 2); c.fill(); break;
        case "ice": for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; c.moveTo(Math.cos(a) * 0.2, Math.sin(a) * 0.2); c.lineTo(-Math.cos(a) * 0.2, -Math.sin(a) * 0.2); } c.stroke(); break;
        case "wind": for (let k = 0; k < 3; k++) { c.moveTo(-0.22, 0.12 - k * 0.11); c.lineTo(0.12 - k * 0.04, 0.12 - k * 0.11); c.quadraticCurveTo(0.24, 0.12 - k * 0.11, 0.18, 0.2 - k * 0.11); } c.stroke(); break;
        case "bridge": c.moveTo(-0.24, -0.05); c.quadraticCurveTo(0, -0.18, 0.24, -0.05); c.moveTo(-0.24, 0.12); c.quadraticCurveTo(0, 0.0, 0.24, 0.12); for (let k = -1; k <= 1; k++) { c.moveTo(k * 0.12, -0.1); c.lineTo(k * 0.12, 0.05); } c.stroke(); break;
        case "rocks": c.moveTo(-0.24, -0.14); c.lineTo(-0.16, 0.04); c.lineTo(-0.02, 0.08); c.lineTo(0.04, -0.14); c.closePath(); c.fill(); c.beginPath(); c.moveTo(0.06, -0.14); c.lineTo(0.12, -0.02); c.lineTo(0.22, -0.04); c.lineTo(0.25, -0.14); c.closePath(); c.fill(); break;
        case "holes": c.moveTo(-0.25, 0); c.lineTo(-0.15, 0); c.quadraticCurveTo(-0.1, -0.16, -0.05, 0); c.lineTo(0.05, 0); c.quadraticCurveTo(0.1, -0.16, 0.15, 0); c.lineTo(0.25, 0); c.stroke(); break;
        case "steep": c.moveTo(-0.22, -0.16); c.lineTo(0.22, -0.16); c.lineTo(0.22, 0.16); c.closePath(); c.fill(); break;
      }
      c.restore();
    }
  }

  /** checkpoint gates and the delivery yard */
  drawMarks(c: C, v: View, t: number, passed: number) {
    const co = this.course, T = co.terrain, l = this.look;
    this.signs(c, v);
    co.checkpoints.forEach((x, i) => {
      if (x < v.x0 - 4 || x > v.x1 + 4) return;
      const y = T.heightAt(x), on = i < passed;
      const col = on ? "#3EE08F" : l.accent;
      for (const px of [x - 1.6, x + 1.6]) { c.fillStyle = "#2A2D3E"; c.fillRect(px - 0.09, y, 0.18, 4.1); c.fillStyle = "#FFFFFF"; c.fillRect(px - 0.04, y, 0.06, 4.1); }
      // the banner, waving
      c.beginPath();
      for (let k = 0; k <= 12; k++) { const u = k / 12, px = x - 1.6 + 3.2 * u; c.lineTo(px, y + 4 + Math.sin(u * 6 + t * 4) * 0.06); }
      for (let k = 12; k >= 0; k--) { const u = k / 12, px = x - 1.6 + 3.2 * u; c.lineTo(px, y + 3.35 + Math.sin(u * 6 + t * 4) * 0.06); }
      c.closePath(); c.fillStyle = col; c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x - 1.25 + k * 0.5, y + 3.67 + Math.sin((k / 6) * 6 + t * 4) * 0.06, 0.08, 0, Math.PI * 2); c.fill(); }
    });
    const f = co.finish;
    if (f > v.x0 - 30 && f < v.x1 + 30) this.yard(c, f, T.heightAt(f), t);
  }

  /** the delivery yard: a striped drop-off pad, an arch with the depot's sign, and the depot behind */
  private yard(c: C, f: number, y: number, t: number) {
    const l = this.look, night = l.night;
    // the pad
    for (let k = 0; k < 18; k++) { c.fillStyle = k % 2 ? shade("#F2C14E", -night * 0.3) : shade("#2A2D3E", -night * 0.2); c.fillRect(f + k * 0.9, y - 0.05, 0.9, 0.2); }
    c.fillStyle = shade("#8E96A8", -night * 0.4); c.fillRect(f, y - 0.6, 16.2, 0.55);
    // the depot: a warehouse with a big door
    const dx = f + 18, w = 10, h = 6.4;
    c.fillStyle = shade(mix("#E8DCC8", l.accent, 0.12), -night * 0.45); c.fillRect(dx, y, w, h);
    c.fillStyle = shade("#3A3048", -night * 0.3); c.beginPath(); c.moveTo(dx - 0.6, y + h); c.lineTo(dx + w / 2, y + h + 2.6); c.lineTo(dx + w + 0.6, y + h); c.closePath(); c.fill();
    c.fillStyle = shade("#5A5466", -night * 0.3); c.fillRect(dx + 1.4, y, 4.6, 4.2);
    c.strokeStyle = rgba("#FFFFFF", 0.25); c.lineWidth = 0.08;
    for (let k = 1; k < 7; k++) { c.beginPath(); c.moveTo(dx + 1.4, y + k * 0.6); c.lineTo(dx + 6, y + k * 0.6); c.stroke(); }
    c.fillStyle = night > 0.25 ? "#FFD27A" : shade("#9EC6E8", -0.1);
    c.fillRect(dx + 7, y + 2.4, 1.8, 1.4); c.fillRect(dx + 7, y + 4.4, 1.8, 1.2);
    // the arch over the pad with a sign
    const ax = f + 1.2;
    c.fillStyle = "#2A2D3E"; c.fillRect(ax, y, 0.3, 5.6); c.fillRect(ax + 13.4, y, 0.3, 5.6);
    c.fillStyle = l.accent; c.fillRect(ax - 0.2, y + 5.2, 14.1, 1.3);
    c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(ax - 0.2, y + 6.2, 14.1, 0.3);
    // bulbs along the arch
    for (let k = 0; k < 14; k++) { const on = (Math.floor(t * 6) + k) % 3 !== 0; c.fillStyle = on ? "#FFF3B0" : "#7A6A40"; c.beginPath(); c.arc(ax + 0.4 + k, y + 5.05, 0.1, 0, Math.PI * 2); c.fill(); }
    // the sign's letters: a parcel stamp (drawn, not text: the world space is flipped)
    c.save(); c.translate(ax + 7, y + 5.85); c.scale(0.02, -0.02);
    c.fillStyle = "#FFFFFF"; c.font = "900 44px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("DELIVERY", 0, 2);
    c.restore();
  }
}

// ---------------------------------------------------------------- pickups
export function drawItem(c: C, it: Item, t: number, night: number) {
  const bob = Math.sin(t * 2.6 + it.phase) * 0.1;
  const x = it.x, y = it.y + bob;
  if (it.kind === "coin") {
    if (it.value >= 100) {
      // a gem
      const s = 0.42 + Math.sin(t * 4 + it.phase) * 0.03;
      c.fillStyle = rgba("#9CF6FF", 0.3); c.beginPath(); c.arc(x, y, s * 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#34D3E8"; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.8, y + s * 0.2); c.lineTo(x + s * 0.45, y + s * 0.55); c.lineTo(x - s * 0.45, y + s * 0.55); c.lineTo(x - s * 0.8, y + s * 0.2); c.closePath(); c.fill();
      c.fillStyle = "#B8FBFF"; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.3, y + s * 0.2); c.lineTo(x - s * 0.3, y + s * 0.2); c.closePath(); c.fill();
      c.fillStyle = "#1A8FB0"; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.8, y + s * 0.2); c.lineTo(x + s * 0.3, y + s * 0.2); c.closePath(); c.fill();
      return;
    }
    const big = it.value >= 25, R = big ? 0.42 : 0.3;
    const sx = Math.abs(Math.cos(t * 3 + it.phase)) * 0.85 + 0.15;
    c.fillStyle = big ? "#E2841A" : "#E2A31A"; c.beginPath(); c.ellipse(x, y, R * sx, R, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = big ? "#FFB23A" : "#FFD23F"; c.beginPath(); c.ellipse(x, y, R * 0.8 * sx, R * 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.65)"; c.beginPath(); c.ellipse(x - R * 0.25 * sx, y + R * 0.3, R * 0.25 * sx, R * 0.14, 0, 0, Math.PI * 2); c.fill();
    if (big) { c.fillStyle = "#E2841A"; star(c, x, y, R * 0.42 * sx, R * 0.42); }
    return;
  }
  if (it.kind === "fuel") {
    // a red jerrycan with a yellow cap
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.7 + it.phase) * 0.08);
    c.fillStyle = rgba("#FF5A4A", 0.25 + 0.1 * Math.sin(t * 4)); c.beginPath(); c.arc(0, 0, 0.75, 0, Math.PI * 2); c.fill();
    roundRect(c, -0.36, -0.46, 0.72, 0.86, 0.12); c.fillStyle = "#D8302A"; c.fill();
    roundRect(c, -0.3, -0.4, 0.6, 0.74, 0.1); c.fillStyle = "#FF4A3A"; c.fill();
    c.strokeStyle = "#B01E1A"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-0.24, -0.3); c.lineTo(0.24, 0.24); c.moveTo(0.24, -0.3); c.lineTo(-0.24, 0.24); c.stroke();
    c.fillStyle = "#FFD23F"; c.fillRect(0.12, 0.38, 0.18, 0.16);
    c.fillStyle = "#2A2D3E"; c.fillRect(-0.24, 0.4, 0.3, 0.08);
    c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(-0.26, -0.32, 0.08, 0.5);
    c.restore();
    return;
  }
  if (it.kind === "heart") {
    const s = 0.4 * (1 + Math.sin(t * 5 + it.phase) * 0.08);
    c.fillStyle = rgba("#FF4F7A", 0.25); c.beginPath(); c.arc(x, y, s * 1.9, 0, Math.PI * 2); c.fill();
    heart(c, x, y, s, "#FF3D6E");
    c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.ellipse(x - s * 0.4, y + s * 0.25, s * 0.18, s * 0.12, -0.6, 0, Math.PI * 2); c.fill();
    return;
  }
  if (it.power) {
    const col = POWER_COLOR[it.power], R = 0.55;
    c.fillStyle = rgba(col, 0.22 + 0.08 * Math.sin(t * 4 + it.phase)); c.beginPath(); c.arc(x, y, R * 1.45, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgba("#FFFFFF", 0.2 + night * 0.1); c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 0.08; c.stroke();
    c.save(); c.translate(x, y); c.scale(1, -1);
    powerGlyph(c, it.power, col);
    c.restore();
    c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.ellipse(x - R * 0.35, y + R * 0.4, R * 0.25, R * 0.12, -0.5, 0, Math.PI * 2); c.fill();
  }
}

/** a power-up's symbol (y down, about ±0.3) */
export function powerGlyph(c: C, p: PowerId, col: string) {
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 0.08; c.lineCap = "round"; c.lineJoin = "round";
  if (p === "nitro") { c.beginPath(); c.moveTo(0.06, -0.34); c.lineTo(-0.18, 0.04); c.lineTo(0.0, 0.04); c.lineTo(-0.06, 0.34); c.lineTo(0.2, -0.06); c.lineTo(0.02, -0.06); c.closePath(); c.fill(); }
  else if (p === "net") { for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-0.28, k * 0.14); c.lineTo(0.28, k * 0.14 + 0.06); c.stroke(); c.beginPath(); c.moveTo(k * 0.14, -0.28); c.lineTo(k * 0.14 + 0.06, 0.28); c.stroke(); } }
  else if (p === "bubble") { for (const [bx, by, br] of [[-0.12, -0.1, 0.12], [0.13, -0.06, 0.1], [0, 0.14, 0.13]] as const) { c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.stroke(); } }
  else if (p === "magnet") { c.lineWidth = 0.12; c.beginPath(); c.arc(0, 0.02, 0.18, Math.PI, 0, true); c.moveTo(-0.18, 0.02); c.lineTo(-0.18, -0.22); c.moveTo(0.18, 0.02); c.lineTo(0.18, -0.22); c.stroke(); }
  else { c.save(); c.scale(0.01, 0.01); c.font = "900 40px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("×2", 0, 2); c.restore(); }
}

function star(c: C, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 0.45 : 1; c.lineTo(x + Math.cos(a) * rx * rr, y - Math.sin(a) * ry * rr); }
  c.closePath(); c.fill();
}
export function heart(c: C, x: number, y: number, s: number, col: string) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y - s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.9, y + s * 0.95, x, y + s * 0.35);
  c.bezierCurveTo(x + s * 0.9, y + s * 0.95, x + s * 1.4, y - s * 0.1, x, y - s * 0.9);
  c.fill();
}
export function roundRect(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
