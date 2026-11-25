// The race track, drawn in world space (metres, y up) every frame: layered soil (a rich topsoil band, strata that
// follow the hills, glowing lava seams in the volcano world, pebbles), the surface trim of each world (grass blades and
// jungle flowers, snow lumps, sand ripples, ash with glowing cracks, asphalt with kerbs and lane paint, gravel, candy
// frosting with sprinkles, red planet dust), glossy mud, ice sheets, animated water, rope bridges, pipes and logs
// across the track, checkpoint flags, the start (grandstand, a light gantry) and the finish (a checkered arch, a
// stand of cheering fans), and the pickups (coins, gems, oil cans, hearts and power bubbles). Paths are traced
// straight into the context: nothing is allocated per frame.
import type { Course, Item, PowerId } from "../terrain";
import type { Look } from "./grade";
import { makeRng, mix, rgba, shade } from "../util";

export interface View { x0: number; x1: number; y0: number; y1: number; scale: number }
type C = CanvasRenderingContext2D;

export const POWER_COLOR: Record<PowerId, string> = { nitro: "#33D6FF", shield: "#9B7BFF", rockets: "#FF5A36", magnet: "#FF4F9A", double: "#FFD23F" };

const SPRINKLES = ["#FFFFFF", "#5CC8FF", "#FFD23F", "#7CE07A", "#B07CFF"];

export class GroundArt {
  private pebbles: Float32Array;
  private tufts: Float32Array;
  private c0: Record<string, string>;
  /** the crowd: a colour per fan */
  private fans: string[];
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
      steel: shade("#3A3E52", -l.night * 0.3), steelHi: shade("#8A90A8", -l.night * 0.4), seat: shade(mix("#2A3A6A", l.accent, 0.25), -l.night * 0.35),
      kerbA: shade("#E8303A", -l.night * 0.3), kerbB: shade("#F4F4F4", -l.night * 0.35), paint: shade("#FFD23F", -l.night * 0.25),
    };
    const pal = ["#FF5A4A", "#FFD23F", "#3EC8FF", "#7CE07A", "#FF8AD0", "#FFFFFF", "#B07CFF", "#FF9A3A"];
    this.fans = [];
    for (let i = 0; i < 160; i++) this.fans.push(shade(pal[Math.floor(r() * pal.length)], -l.night * 0.4 - r() * 0.15));
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
    const lava = l.world.id === "cinder" || l.partner?.id === "cinder";
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
    if (g === "asphalt") {
      // red and white kerbs along the lip, a dashed yellow lane line on top
      const a = Math.floor(v.x0 / 1.2) * 1.2;
      c.lineWidth = 0.16; c.lineCap = "butt";
      for (let x = a; x < v.x1 + 1.2; x += 1.2) {
        const ix = Math.floor((x - T.x0) / T.dx); if (ix < 0 || ix >= co.fill.length || co.fill[ix] < T.h[ix] - 1) continue;
        c.strokeStyle = Math.floor(x / 1.2) % 2 ? k.kerbA : k.kerbB;
        c.beginPath(); c.moveTo(x, T.heightAt(x) - 0.14); c.lineTo(x + 1.2, T.heightAt(x + 1.2) - 0.14); c.stroke();
      }
      c.strokeStyle = k.paint; c.lineWidth = 0.05;
      for (let x = Math.floor(v.x0 / 4) * 4; x < v.x1 + 4; x += 4) { c.beginPath(); c.moveTo(x, T.heightAt(x) + 0.01); c.lineTo(x + 1.8, T.heightAt(x + 1.8) + 0.01); c.stroke(); }
      c.lineCap = "round";
      return;
    }
    if (g === "gravel") {
      for (let i = i0; i <= i1; i++) {
        if (co.fill[i] < T.h[i] - 1) continue;
        const s = tf[i & 2047], x = T.x0 + i * T.dx + s * 0.3;
        c.fillStyle = s > 0.5 ? k.peb1 : k.peb0;
        c.beginPath(); c.ellipse(x, co.fill[i] + 0.02, 0.07 + s * 0.08, 0.05 + s * 0.04, s, 0, Math.PI * 2); c.fill();
      }
      return;
    }
    if (g === "candy") {
      // frosting drips over the chocolate and sprinkles on top
      c.fillStyle = k.top;
      for (let i = i0 - (i0 % 3); i <= i1; i += 3) {
        if (i < 0 || co.fill[i] < T.h[i] - 1) continue;
        const s = tf[i & 2047], x = T.x0 + i * T.dx, d = 0.25 + s * 0.45;
        c.beginPath(); c.moveTo(x - 0.25, co.fill[i] - 0.1); c.lineTo(x - 0.16, co.fill[i] - d); c.arc(x, co.fill[i] - d, 0.16, Math.PI, 0, false); c.lineTo(x + 0.25, co.fill[i] - 0.1); c.closePath(); c.fill();
      }
      c.lineWidth = 0.05; c.lineCap = "round";
      for (let i = i0; i <= i1; i++) {
        if (co.fill[i] < T.h[i] - 1) continue;
        const s = tf[(i * 3) & 2047]; if (s < 0.4) continue;
        const x = T.x0 + i * T.dx + s * 0.4, y = co.fill[i] - 0.05 - s * 0.12;
        c.strokeStyle = SPRINKLES[i % 5]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(s * 9) * 0.1, y + Math.sin(s * 9) * 0.1); c.stroke();
      }
      return;
    }
    // grass-like grounds: blades, and flowers on meadows
    const blade = mix(k.top, k.hi, 0.35), dark = shade(k.top, -0.18);
    const sway = Math.sin(t * 1.6) * (l.world.id === "thunder" ? 0.12 : 0.05);
    const flowers = l.world.id === "canopy" || l.world.id === "cloud";
    c.lineWidth = 0.055;
    for (let i = i0; i <= i1; i += step) {
      if (co.fill[i] < T.h[i] - 1 || T.zone[i] !== 0 || T.water[i] > -1e8) continue;
      const x = T.x0 + i * T.dx, y = co.fill[i], s = tf[i & 2047];
      const h = 0.18 + s * 0.22;
      c.strokeStyle = s > 0.5 ? blade : dark;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 0.04, y + h * 0.5, x + 0.08 + sway, y + h); c.moveTo(x + 0.18, y); c.quadraticCurveTo(x + 0.14, y + h * 0.6, x + 0.1 + sway, y + h * 0.9); c.stroke();
      if (flowers && s > 0.86) {
        const fc = l.world.id === "canopy" ? (s > 0.93 ? "#FF5A8A" : "#FFB23A") : s > 0.93 ? "#FFFFFF" : "#FFD23F";
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

  /** what lies across the track: a fallen log, a snowy log, a peppermint roll in Candy Canyon, a steel pipe in the
   * volcano, harbour, scrapyard and on the red planet */
  private logs(c: C, v: View) {
    const co = this.course, T = co.terrain, l = this.look, id = l.world.id;
    const n = -l.night * 0.35;
    const look = id === "cinder" || id === "mars" || id === "harbor" || id === "scrap" ? "pipe" : id === "candy" ? "mint" : "wood";
    const bark = shade(look === "pipe" ? "#5A5E6E" : look === "mint" ? "#F4F4F8" : "#6A4426", n);
    const wood = shade(look === "pipe" ? "#2A2D3A" : look === "mint" ? "#FFFFFF" : "#E2B27A", n);
    const ring = shade(look === "pipe" ? "#8E96A8" : look === "mint" ? "#E8304A" : "#B57E4A", n);
    for (const lg of co.logs) {
      if (lg.x < v.x0 - 2 || lg.x > v.x1 + 2) continue;
      const base = Math.min(T.heightAt(lg.x - lg.r * 2.8), T.heightAt(lg.x + lg.r * 2.8));
      const y = base + lg.r * 0.85, R = lg.r * 1.05;
      c.fillStyle = bark; c.beginPath(); c.arc(lg.x, y, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = wood; c.beginPath(); c.arc(lg.x, y, R * (look === "pipe" ? 0.72 : 0.8), 0, Math.PI * 2); c.fill();
      c.strokeStyle = ring; c.lineWidth = 0.025;
      if (look === "mint") { c.lineWidth = R * 0.16; for (let k = 0; k < 6; k++) { const a0 = k * 1.047 + lg.x; c.beginPath(); c.arc(lg.x, y, R * 0.45, a0, a0 + 0.5); c.stroke(); } }
      else if (look === "pipe") { c.lineWidth = 0.04; c.beginPath(); c.arc(lg.x, y, R * 0.86, 0, Math.PI * 2); c.stroke(); }
      else { c.beginPath(); c.arc(lg.x, y, R * 0.55, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(lg.x, y, R * 0.3, 0, Math.PI * 2); c.stroke(); }
      if (id === "polar") { c.fillStyle = "#F6FAFF"; c.beginPath(); c.ellipse(lg.x, y + R * 0.8, R * 1.05, R * 0.38, 0, 0, Math.PI); c.fill(); }
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

  /** what stands behind the track, drawn before it: the grandstands at the start and the finish */
  drawBack(c: C, v: View, t: number, cheer: number) {
    const co = this.course, T = co.terrain;
    if (v.x0 < 14 && v.x1 > -40) this.stand(c, -34, T.heightAt(-10), t, cheer, 0, 30);
    const f = co.finish;
    if (f + 40 > v.x0 && f - 8 < v.x1) this.stand(c, f + 6, T.heightAt(f + 10), t, cheer, 80, 28);
  }

  /** a grandstand: tiers of seats full of bobbing fans, a roof on poles, flags and floodlights */
  private stand(c: C, x0: number, y: number, t: number, cheer: number, fan0: number, w: number) {
    const k = this.c0, l = this.look, tiers = 5, step = 0.95;
    for (let q = 0; q < tiers; q++) {
      const ty = y - 0.4 + q * step;
      c.fillStyle = q % 2 ? k.seat : shade(k.seat, -0.12); c.fillRect(x0 + q * 0.5, ty, w - q * 1.0, step);
      c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(x0 + q * 0.5, ty + step - 0.08, w - q * 1.0, 0.08);
    }
    // fans: a head and shoulders each, jumping when there is something to cheer
    const per = Math.floor((w - 1) / 0.62), n = per * tiers;
    for (let i = 0; i < n; i++) {
      const q = i % tiers, col = this.fans[(fan0 + i) % this.fans.length];
      if (((i * 7919) % 13) === 0) continue;
      const fx = x0 + q * 0.5 + 0.45 + Math.floor(i / tiers) * ((w - q - 1) / per) + ((i * 0.37) % 1) * 0.18;
      const jump = Math.max(0, Math.sin(t * (5 + (i % 3)) + i * 1.7)) * (0.06 + cheer * 0.24);
      const fy = y - 0.4 + q * step + step * 0.45 + jump;
      c.fillStyle = shade(col, -0.3); c.beginPath(); c.ellipse(fx, fy, 0.2, 0.16, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(fx, fy + 0.26, 0.12, 0, Math.PI * 2); c.fill();
      if (cheer > 0.3 && i % 4 === 0) { c.strokeStyle = col; c.lineWidth = 0.06; c.beginPath(); c.moveTo(fx + 0.12, fy + 0.1); c.lineTo(fx + 0.25, fy + 0.45 + jump); c.stroke(); }
    }
    // the roof on poles, with flags
    const top = y - 0.4 + tiers * step + 1.6;
    c.fillStyle = k.steel;
    for (let px = x0 + 1; px < x0 + w; px += 7) c.fillRect(px - 0.08, y - 0.4, 0.16, top - y + 0.4);
    c.beginPath(); c.moveTo(x0 - 0.8, top); c.lineTo(x0 + w + 0.8, top + 0.4); c.lineTo(x0 + w + 0.8, top + 0.85); c.lineTo(x0 - 0.8, top + 0.6); c.closePath(); c.fill();
    c.fillStyle = l.accent; c.fillRect(x0 - 0.8, top + 0.05, w + 1.6, 0.18);
    for (let q = 0; q <= 4; q++) {
      const px = x0 + (q * w) / 4;
      c.fillStyle = k.steelHi; c.fillRect(px - 0.03, top + 0.6, 0.06, 1.4);
      c.fillStyle = q % 2 ? l.accent : "#FFFFFF";
      c.beginPath(); c.moveTo(px + 0.03, top + 2.0);
      for (let s = 0; s <= 6; s++) c.lineTo(px + 0.03 + s * 0.15, top + 2.0 - 0.02 * s + Math.sin(t * 6 + s + q) * 0.07);
      for (let s = 6; s >= 0; s--) c.lineTo(px + 0.03 + s * 0.15, top + 1.55 + Math.sin(t * 6 + s + q) * 0.07);
      c.closePath(); c.fill();
    }
    // floodlights at night
    if (l.night > 0.3) {
      for (const px of [x0 - 1.4, x0 + w + 1.4]) {
        c.fillStyle = k.steel; c.fillRect(px - 0.1, y - 0.4, 0.2, top - y + 4);
        c.fillStyle = "#FFF6D0"; c.fillRect(px - 0.6, top + 3.4, 1.2, 0.5);
        c.fillStyle = rgba("#FFF6D0", 0.12 * l.night); c.beginPath(); c.moveTo(px - 0.6, top + 3.4); c.lineTo(px - 6, y); c.lineTo(px + 6, y); c.lineTo(px + 0.6, top + 3.4); c.closePath(); c.fill();
      }
    }
  }

  /** checkpoint flags, the start gantry with its lights (0..5 red, 6 green, -1 off) and the finish arch */
  drawMarks(c: C, v: View, t: number, passed: number, lights: number) {
    const co = this.course, T = co.terrain, l = this.look;
    this.signs(c, v);
    co.checkpoints.forEach((x, i) => {
      if (x < v.x0 - 4 || x > v.x1 + 4) return;
      const y = T.heightAt(x), on = i < passed;
      const col = on ? "#3EE08F" : l.accent;
      // a tall pole with a long pennant
      c.fillStyle = "#2A2D3E"; c.fillRect(x - 0.08, y, 0.16, 5.2); c.fillStyle = "#FFFFFF"; c.fillRect(x - 0.03, y, 0.05, 5.2);
      c.beginPath(); c.moveTo(x + 0.08, y + 5.2);
      for (let s = 0; s <= 10; s++) { const u = s / 10; c.lineTo(x + 0.08 + u * 2.6, y + 5.2 - u * 0.35 + Math.sin(u * 5 - t * 6) * 0.12 * u); }
      for (let s = 10; s >= 0; s--) { const u = s / 10; c.lineTo(x + 0.08 + u * 2.6, y + 4.1 + u * 0.35 + Math.sin(u * 5 - t * 6) * 0.12 * u); }
      c.closePath(); c.fillStyle = col; c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.arc(x + 0.8, y + 4.65 + Math.sin(1.5 - t * 6) * 0.04, 0.16, 0, Math.PI * 2); c.fill();
    });
    if (v.x0 < 24 && v.x1 > -20) this.gantry(c, 11.5, T.heightAt(11.5), lights);
    const f = co.finish;
    if (f > v.x0 - 30 && f < v.x1 + 30) this.finishLine(c, f, T.heightAt(f), t);
  }

  /** the start gantry: a truss on a pole leaning over the track with five lights */
  private gantry(c: C, x: number, y: number, lights: number) {
    const k = this.c0, top = y + 6.2;
    c.fillStyle = k.steel; c.fillRect(x + 2.2, y - 0.3, 0.3, 6.9);
    c.fillRect(x - 3.4, top, 5.9, 0.5);
    c.strokeStyle = k.steelHi; c.lineWidth = 0.06; c.beginPath();
    for (let s = 0; s < 8; s++) { const a = x - 3.4 + s * 0.74; c.moveTo(a, top); c.lineTo(a + 0.37, top + 0.5); c.lineTo(a + 0.74, top); }
    c.stroke();
    roundRect(c, x - 3.2, top - 1.0, 5.2, 0.95, 0.15); c.fillStyle = "#14151E"; c.fill();
    for (let i = 0; i < 5; i++) {
      const lx = x - 2.65 + i * 1.03, ly = top - 0.52;
      const lit = lights === 6 || lights > i;
      const on = lights === 6 ? "#3EE08F" : lit ? "#FF2A3A" : "#3A2A30";
      if (lit) { c.fillStyle = rgba(on, 0.35); c.beginPath(); c.arc(lx, ly, 0.55, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = on; c.beginPath(); c.arc(lx, ly, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(lx - 0.08, ly + 0.09, 0.09, 0, Math.PI * 2); c.fill();
    }
  }

  /** the finish: a checkered strip on the track, an arch with a checkered banner and chasing bulbs */
  private finishLine(c: C, f: number, y: number, t: number) {
    const l = this.look, night = l.night;
    const dark = shade("#15161E", -night * 0.1), light = shade("#F6F6F6", -night * 0.35);
    for (let q = 0; q < 2; q++) for (let k = 0; k < 4; k++) { c.fillStyle = (k + q) % 2 ? dark : light; c.fillRect(f - 0.8 + k * 0.4, y - 0.16 - q * 0.16, 0.4, 0.16); }
    const ax = f - 0.15, h = 7;
    c.fillStyle = "#2A2D3E"; c.fillRect(ax - 4.2, y - 0.2, 0.4, h); c.fillRect(ax + 3.8, y - 0.2, 0.4, h);
    // the banner: a checkered band with a coloured trim
    const bw = 8.8, bx = ax - 4.4, by = y + h - 1.6;
    c.fillStyle = l.accent; c.fillRect(bx, by - 0.25, bw, 2.0);
    for (let q = 0; q < 3; q++) for (let k = 0; k < 22; k++) { c.fillStyle = (k + q) % 2 ? dark : light; c.fillRect(bx + 0.2 + k * 0.38, by + 0.05 + q * 0.42, 0.38, 0.42); }
    for (let k = 0; k < 12; k++) { const on = (Math.floor(t * 8) + k) % 4 !== 0; c.fillStyle = on ? "#FFF3B0" : "#6A5A30"; c.beginPath(); c.arc(bx + 0.3 + k * 0.75, by - 0.15, 0.11, 0, Math.PI * 2); c.fill(); }
    // two flags on top, waving
    for (const px of [ax - 4.0, ax + 4.0]) {
      c.fillStyle = "#2A2D3E"; c.fillRect(px - 0.03, y + h - 0.2, 0.06, 1.6);
      for (let q = 0; q < 2; q++) for (let k = 0; k < 4; k++) {
        c.fillStyle = (k + q) % 2 ? dark : light;
        const wv = Math.sin(t * 7 + k * 0.9 + px) * 0.1 * (k / 3);
        c.fillRect(px + 0.03 + k * 0.28, y + h + 0.9 + q * 0.3 + wv, 0.28, 0.3);
      }
    }
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
  else if (p === "shield") { c.beginPath(); c.moveTo(0, -0.32); c.lineTo(0.26, -0.22); c.quadraticCurveTo(0.26, 0.16, 0, 0.32); c.quadraticCurveTo(-0.26, 0.16, -0.26, -0.22); c.closePath(); c.fill(); c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.moveTo(0, -0.24); c.lineTo(0, 0.22); c.quadraticCurveTo(-0.18, 0.1, -0.18, -0.16); c.closePath(); c.fill(); }
  else if (p === "rockets") { c.save(); c.rotate(-0.75); c.beginPath(); c.moveTo(0, -0.34); c.quadraticCurveTo(0.12, -0.18, 0.1, 0.14); c.lineTo(-0.1, 0.14); c.quadraticCurveTo(-0.12, -0.18, 0, -0.34); c.fill(); c.beginPath(); c.moveTo(-0.1, 0.02); c.lineTo(-0.2, 0.2); c.lineTo(-0.1, 0.16); c.moveTo(0.1, 0.02); c.lineTo(0.2, 0.2); c.lineTo(0.1, 0.16); c.fill(); c.fillStyle = "#FFD23F"; c.beginPath(); c.moveTo(-0.07, 0.16); c.lineTo(0, 0.34); c.lineTo(0.07, 0.16); c.fill(); c.restore(); }
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
