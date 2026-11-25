// The rides and their driver, drawn in world space from the live physics: each ride's own body (jeep, pickup, monster
// truck, double-decker bus with passengers in its windows, tractor, tube-frame buggy, hot rod with a chrome engine,
// moon bug under a glass dome) with soft clay-style shading and the chosen paint job's pattern, coil-spring struts
// that stretch and squash with the suspension, tyres with tread and spinning rims, a whip antenna with a pennant that
// wobbles with every bump — and Rivet, the round little mechanic with a mint helmet and goggles, whose face shows how
// the drive is going (happy, scared, wow, dizzy, cheering) and blinks now and then.
import type { Car } from "../physics";
import type { VehicleId } from "../vehicles";
import { colorsOf, paintOf } from "../vehicles";
import { mix, rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export type Mood = "happy" | "scared" | "wow" | "dizzy" | "cheer";
interface Paintjob { body: string; trim: string; accent: string; pattern: string }

/** a sprung antenna: its tip lags behind the car's motion */
export class Antenna {
  a = 0; w = 0;
  private lvx = 0; private lvy = 0;
  update(car: Car, dt: number) {
    if (dt <= 0) return;
    const ax = (car.vx - this.lvx) / dt, ay = (car.vy - this.lvy) / dt;
    this.lvx = car.vx; this.lvy = car.vy;
    const ca = Math.cos(car.a), sa = Math.sin(car.a);
    const along = ax * ca + ay * sa, up = -ax * sa + ay * ca;
    this.w += (-this.a * 60 - this.w * 4 - along * 0.05 - car.w * 2 + up * 0.01) * dt;
    this.w = Math.max(-20, Math.min(20, this.w));
    this.a = Math.max(-1.2, Math.min(1.2, this.a + this.w * dt));
  }
  reset() { this.a = 0; this.w = 0; }
}

export interface CarLook { mood: Mood; blink: boolean; gas: number; t: number; shield: number; turbo: boolean; float: boolean; grip: boolean; night: number; paint: string }

const RIVET = { skin: "#FF8A5B", skinDark: "#E0603A", helmet: "#5EEAD4", helmetDark: "#14B8A6", goggles: "#2B2342" };

// ------------------------------------------------------------------ body shapes (chassis-local, metres)
function roundPoly(c: C, pts: number[], r: number) {
  const n = pts.length / 2;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const p0 = (i + n - 1) % n, p1 = i % n, p2 = (i + 1) % n;
    const x1 = pts[p1 * 2], y1 = pts[p1 * 2 + 1];
    const mx0 = (pts[p0 * 2] + x1) / 2, my0 = (pts[p0 * 2 + 1] + y1) / 2, mx2 = (x1 + pts[p2 * 2]) / 2, my2 = (y1 + pts[p2 * 2 + 1]) / 2;
    if (i === 0) c.moveTo(mx0, my0);
    c.arcTo(x1, y1, mx2, my2, r);
  }
  c.closePath();
}
const SHAPE: Record<VehicleId, number[]> = {
  jeep: [-1.25, -0.28, 1.25, -0.28, 1.3, 0.12, 0.55, 0.3, 0.3, 0.32, -1.2, 0.32],
  pickup: [-1.65, -0.3, 1.65, -0.3, 1.68, 0.18, 1.1, 0.3, 0.85, 0.92, -0.05, 0.92, -0.15, 0.28, -1.62, 0.28],
  monster: [-1.35, -0.22, 1.35, -0.22, 1.4, 0.2, 0.7, 0.42, 0.35, 0.86, -0.55, 0.86, -0.7, 0.42, -1.3, 0.38],
  bus: [-2.05, -0.78, 2.05, -0.78, 2.08, 0.9, 1.95, 1.05, -1.95, 1.05, -2.05, 0.9],
  tractor: [-0.95, -0.15, 1.35, -0.32, 1.4, 0.3, 0.2, 0.32, 0.15, 0.95, -0.85, 0.95, -0.9, 0.3],
  buggy: [-1.05, -0.18, 1.05, -0.18, 1.1, 0.05, 0.4, 0.18, -1.0, 0.2],
  rod: [-1.5, -0.2, 1.6, -0.26, 1.62, 0.08, 0.5, 0.18, 0.1, 0.55, -0.9, 0.58, -1.45, 0.3],
  moonbug: [-1.25, -0.25, 1.25, -0.25, 1.3, 0.1, 0.9, 0.35, -1.0, 0.38, -1.3, 0.1],
};

function pattern(c: C, p: Paintjob, x0: number, x1: number, y0: number, y1: number, t: number) {
  const w = x1 - x0, h = y1 - y0;
  switch (p.pattern) {
    case "stripes": c.fillStyle = p.accent; c.fillRect(x0, y0 + h * 0.42, w, h * 0.1); c.fillRect(x0, y0 + h * 0.58, w, h * 0.05); break;
    case "flames": {
      c.fillStyle = p.accent;
      for (let k = 0; k < 5; k++) { const fx = x1 - 0.2 - k * 0.42; c.beginPath(); c.moveTo(x1, y0 + h * 0.5); c.quadraticCurveTo(fx + 0.1, y0 + h * 0.82, fx - 0.35, y0 + h * 0.5 + (k % 2 ? 0.12 : -0.1)); c.quadraticCurveTo(fx + 0.1, y0 + h * 0.25, x1, y0 + h * 0.4); c.fill(); }
      break;
    }
    case "dots": c.fillStyle = p.accent; for (let x = x0 + 0.2; x < x1; x += 0.36) for (let y = y0 + 0.15; y < y1; y += 0.3) { c.beginPath(); c.arc(x + ((y * 10) % 2 ? 0.18 : 0), y, 0.07, 0, TAU); c.fill(); } break;
    case "checker": for (let x = x0; x < x1; x += 0.2) for (let y = y0; y < y1; y += 0.2) if ((Math.round((x - x0) / 0.2) + Math.round((y - y0) / 0.2)) % 2) { c.fillStyle = p.accent; c.fillRect(x, y, 0.2, 0.2); } break;
    case "stars": c.fillStyle = p.accent; for (let k = 0; k < 14; k++) { const x = x0 + ((k * 0.737) % 1) * w, y = y0 + ((k * 0.391) % 1) * h, s = 0.03 + (k % 3) * 0.02; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + k); c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); } c.globalAlpha = 1; break;
    case "camo": c.fillStyle = p.accent; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(x0 + ((k * 0.61) % 1) * w, y0 + ((k * 0.37) % 1) * h, 0.28, 0.14, k, 0, TAU); c.fill(); } c.fillStyle = shade(p.body, -0.35); for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(x0 + ((k * 0.43 + 0.2) % 1) * w, y0 + ((k * 0.71) % 1) * h, 0.22, 0.1, k * 2, 0, TAU); c.fill(); } break;
    case "rainbow": { const cols = ["#FF5A5F", "#FFB72B", "#FFE14D", "#3EE08F", "#38BDF8", "#8B5CF6"]; cols.forEach((col, k) => { c.fillStyle = col; c.fillRect(x0, y0 + (k * h) / 6, w, h / 6 + 0.01); }); break; }
  }
}

function rivet(c: C, x: number, y: number, s: number, look: CarLook, lean: number) {
  const { mood, blink, t } = look;
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(lean);
  // body
  c.fillStyle = RIVET.skinDark; c.beginPath(); c.ellipse(0, -0.42, 0.34, 0.3, 0, 0, TAU); c.fill();
  // head
  const g = c.createRadialGradient(-0.1, 0.1, 0.02, 0, 0, 0.32);
  g.addColorStop(0, shade(RIVET.skin, 0.25)); g.addColorStop(1, RIVET.skin);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 0.3, 0, TAU); c.fill();
  // helmet
  c.fillStyle = RIVET.helmet; c.beginPath(); c.arc(0, 0.02, 0.32, 0.05, Math.PI - 0.05); c.closePath(); c.fill();
  c.fillStyle = RIVET.helmetDark; c.fillRect(-0.32, 0.02, 0.64, 0.06);
  c.fillStyle = "#FFFFFF"; c.beginPath(); c.ellipse(-0.04, 0.24, 0.12, 0.05, 0.2, 0, TAU); c.fill();
  c.fillStyle = "#FF5A5F"; c.fillRect(-0.04, 0.02, 0.08, 0.3);
  // goggles up on the helmet
  c.fillStyle = RIVET.goggles; c.fillRect(-0.3, 0.1, 0.6, 0.06);
  for (const gx of [0.04, 0.2]) { c.fillStyle = "#9CE7FF"; c.beginPath(); c.arc(gx, 0.15, 0.065, 0, TAU); c.fill(); c.strokeStyle = RIVET.goggles; c.lineWidth = 0.025; c.stroke(); }
  // face (looking forward, +x)
  const ex = [0.06, 0.2], ey = -0.06;
  if (mood === "dizzy") {
    c.strokeStyle = "#2B2342"; c.lineWidth = 0.025;
    for (const x0 of ex) { c.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.3) c.lineTo(x0 + Math.cos(a + t * 8) * a * 0.012, ey + Math.sin(a + t * 8) * a * 0.012); c.stroke(); }
  } else if (mood === "cheer" || blink) {
    c.strokeStyle = "#2B2342"; c.lineWidth = 0.03;
    for (const x0 of ex) { c.beginPath(); c.arc(x0, ey - (mood === "cheer" ? 0.02 : 0), 0.045, mood === "cheer" ? 0.2 : Math.PI + 0.2, mood === "cheer" ? Math.PI - 0.2 : -0.2); c.stroke(); }
  } else {
    const big = mood === "scared" || mood === "wow" ? 0.075 : 0.06;
    for (const x0 of ex) {
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.ellipse(x0, ey, big, big * 1.2, 0, 0, TAU); c.fill();
      c.fillStyle = "#2B2342"; c.beginPath(); c.arc(x0 + 0.02, ey - (mood === "scared" ? 0.02 : 0), big * 0.55, 0, TAU); c.fill();
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(x0 + 0.035, ey + 0.02, big * 0.2, 0, TAU); c.fill();
    }
  }
  c.fillStyle = rgba("#FF4F7A", 0.45); c.beginPath(); c.ellipse(0.0, -0.14, 0.05, 0.03, 0, 0, TAU); c.fill();
  c.fillStyle = "#2B2342";
  if (mood === "scared" || mood === "wow") { c.beginPath(); c.ellipse(0.16, -0.2, 0.04, mood === "wow" ? 0.06 : 0.05, 0, 0, TAU); c.fill(); }
  else if (mood === "dizzy") { c.strokeStyle = "#2B2342"; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0.08, -0.19); for (let k = 1; k <= 4; k++) c.lineTo(0.08 + k * 0.04, -0.19 + (k % 2 ? 0.02 : -0.02)); c.stroke(); }
  else { c.beginPath(); c.arc(0.15, -0.16, mood === "cheer" ? 0.08 : 0.06, Math.PI + 0.3, -0.3, true); c.closePath(); c.fill(); if (mood === "cheer") { c.fillStyle = "#FF6B8A"; c.beginPath(); c.arc(0.15, -0.21, 0.03, 0, TAU); c.fill(); } }
  c.restore();
}

function wheel(c: C, x: number, y: number, r: number, spin: number, tire: string, rim: string, glow: boolean) {
  c.save(); c.translate(x, y);
  c.fillStyle = tire; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  // tread
  c.fillStyle = shade(tire, 0.18);
  const n = Math.max(10, Math.round(r * 26));
  c.rotate(spin);
  for (let k = 0; k < n; k++) { c.save(); c.rotate((k / n) * TAU); c.fillRect(r * 0.86, -r * 0.07, r * 0.13, r * 0.14); c.restore(); }
  c.fillStyle = rim; c.beginPath(); c.arc(0, 0, r * 0.56, 0, TAU); c.fill();
  c.fillStyle = shade(rim, -0.25);
  for (let k = 0; k < 5; k++) { c.save(); c.rotate((k / 5) * TAU); c.beginPath(); c.ellipse(r * 0.3, 0, r * 0.13, r * 0.07, 0, 0, TAU); c.fill(); c.restore(); }
  c.fillStyle = shade(rim, 0.3); c.beginPath(); c.arc(0, 0, r * 0.15, 0, TAU); c.fill();
  c.rotate(-spin);
  c.strokeStyle = rgba("#FFFFFF", 0.18); c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
  if (glow) { c.strokeStyle = rgba("#3EE08F", 0.7); c.lineWidth = r * 0.1; c.beginPath(); c.arc(0, 0, r * 1.02, 0, TAU); c.stroke(); }
  c.restore();
}

function spring(c: C, ax: number, ay: number, bx: number, by: number, col: string, w: number) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  c.strokeStyle = shade(col, -0.35); c.lineWidth = w * 0.7; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  c.strokeStyle = col; c.lineWidth = w * 0.45; c.beginPath();
  const n = 7;
  for (let k = 0; k <= n; k++) { const u = 0.12 + (k / n) * 0.76, s = k % 2 ? 1 : -1; c.lineTo(ax + dx * u + nx * s * w * 1.4, ay + dy * u + ny * s * w * 1.4); }
  c.stroke();
}

/** draw the car (world space) */
export function drawCar(c: C, car: Car, ant: Antenna, look: CarLook) {
  const v = car.spec, id = v.id;
  const p: Paintjob = colorsOf(v, paintOf(look.paint));
  const dim = (col: string) => mix(col, "#1A1630", look.night * 0.35);
  const body = dim(p.body), trim = dim(p.trim), accent = dim(p.accent);
  const tire = "#24222C", rim = id === "rod" ? "#E8ECF5" : id === "moonbug" ? "#D6DEEC" : mix(p.accent, "#E8ECF5", 0.6);
  const ca = Math.cos(car.a), sa = Math.sin(car.a);
  // struts (behind the wheels)
  for (let i = 0; i < 2; i++) {
    const [lx, ly] = v.anchors[i];
    spring(c, car.x + lx * ca - ly * sa, car.y + lx * sa + ly * ca, car.wx[i], car.wy[i], id === "buggy" || id === "rod" ? "#FF5A5F" : "#B8C0D0", 0.09);
  }
  c.save(); c.translate(car.x, car.y); c.rotate(car.a);
  // turbo flame and float wings behind
  if (look.turbo) {
    const fl = 0.8 + Math.sin(look.t * 40) * 0.25;
    const g = c.createLinearGradient(-SHAPE_EXT(id) - 1.4 * fl, 0, -SHAPE_EXT(id), 0); g.addColorStop(0, rgba("#FFD23F", 0)); g.addColorStop(0.6, rgba("#FF8A3D", 0.8)); g.addColorStop(1, "#FFFFFF");
    c.fillStyle = g; c.beginPath(); c.moveTo(-SHAPE_EXT(id), 0.15); c.lineTo(-SHAPE_EXT(id) - 1.4 * fl, 0.0); c.lineTo(-SHAPE_EXT(id), -0.12); c.fill();
  }
  // the antenna and pennant (behind the body)
  {
    const bx = id === "bus" ? -1.8 : id === "pickup" ? -1.4 : id === "tractor" ? -0.8 : -1.0, by = id === "bus" ? 1.05 : id === "tractor" ? 0.95 : 0.3;
    const L = id === "bus" ? 0.7 : 1.0, tx = bx + Math.sin(ant.a - 0.25) * L, ty = by + Math.cos(ant.a - 0.25) * L;
    c.strokeStyle = "#2B2342"; c.lineWidth = 0.035; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.sin(ant.a * 0.5) * L * 0.5, by + L * 0.55, tx, ty); c.stroke();
    c.fillStyle = accent; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - 0.42, ty - 0.08 + Math.sin(look.t * 10) * 0.04); c.lineTo(tx, ty - 0.2); c.fill();
  }
  // driver (behind the body's front)
  const head = v.head;
  const lean = Math.max(-0.25, Math.min(0.25, -car.w * 0.04 - ant.a * 0.12));
  if (id === "bus") {
    // passengers in the top deck, Rivet at the wheel downstairs
    for (let k = 0; k < 4; k++) rivetPassenger(c, -1.45 + k * 0.85, 0.55, ["#FFB72B", "#8B5CF6", "#3EE08F", "#38BDF8"][k], look);
    rivet(c, 1.45, -0.05, 0.85, look, lean);
  } else if (id === "pickup") rivet(c, head.x - 0.02, head.y - 0.12, 0.95, look, lean);
  else rivet(c, head.x, head.y - 0.12, 1, look, lean);
  // the body
  const shape = SHAPE[id];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < shape.length; k += 2) { x0 = Math.min(x0, shape[k]); x1 = Math.max(x1, shape[k]); y0 = Math.min(y0, shape[k + 1]); y1 = Math.max(y1, shape[k + 1]); }
  // underside shadow
  c.fillStyle = shade(body, -0.45); roundPoly(c, shape.map((v2, k) => (k % 2 ? v2 - 0.06 : v2)), 0.14); c.fill();
  const g = c.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, shade(body, 0.22)); g.addColorStop(0.5, body); g.addColorStop(1, shade(body, -0.18));
  c.fillStyle = g; roundPoly(c, shape, 0.14); c.fill();
  c.save(); roundPoly(c, shape, 0.14); c.clip();
  pattern(c, { ...p, body, accent }, x0, x1, y0, y1, look.t);
  // soft clay highlight along the top
  c.fillStyle = rgba("#FFFFFF", 0.22); c.fillRect(x0, y1 - 0.12, x1 - x0, 0.06);
  c.fillStyle = rgba("#000000", 0.12); c.fillRect(x0, y0, x1 - x0, 0.1);
  c.restore();
  c.strokeStyle = shade(trim, -0.1); c.lineWidth = 0.05; roundPoly(c, shape, 0.14); c.stroke();
  details(c, id, body, trim, accent, look);
  c.restore();
  // wheels
  for (let i = 0; i < 2; i++) wheel(c, car.wx[i], car.wy[i], car.rad[i], -car.spin[i], tire, rim, look.grip);
  // shield bubble
  if (look.shield > 0) {
    const a = look.shield < 2 ? 0.25 + 0.25 * Math.sin(look.t * 20) : 0.35;
    const hx = car.x + head.x * ca - head.y * sa, hy = car.y + head.x * sa + head.y * ca;
    const gr = c.createRadialGradient(hx, hy, 0.1, hx, hy, 0.7);
    gr.addColorStop(0, rgba("#7CF5FF", 0)); gr.addColorStop(0.75, rgba("#7CF5FF", a * 0.6)); gr.addColorStop(1, rgba("#FFFFFF", a));
    c.fillStyle = gr; c.beginPath(); c.arc(hx, hy, 0.7, 0, TAU); c.fill();
  }
  if (look.float) {
    c.save(); c.translate(car.x, car.y); c.rotate(car.a);
    c.fillStyle = rgba("#FFFFFF", 0.85);
    const f = Math.sin(look.t * 12) * 0.12;
    c.beginPath(); c.ellipse(-0.6, 0.55 + f, 0.5, 0.16, 0.5, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-0.9, 0.5 + f, 0.38, 0.12, 0.7, 0, TAU); c.fill();
    c.restore();
  }
}

const SHAPE_EXT = (id: VehicleId) => { const s = SHAPE[id]; let m = 0; for (let k = 0; k < s.length; k += 2) m = Math.max(m, -s[k]); return m; };

function rivetPassenger(c: C, x: number, y: number, col: string, look: CarLook) {
  c.save(); c.translate(x, y);
  c.fillStyle = col; c.beginPath(); c.arc(0, 0, 0.2, 0, TAU); c.fill();
  c.fillStyle = "#FFFFFF"; for (const ex of [0.02, 0.11]) { c.beginPath(); c.arc(ex, 0.02, 0.045, 0, TAU); c.fill(); }
  c.fillStyle = "#2B2342"; for (const ex of [0.03, 0.12]) { c.beginPath(); c.arc(ex + (look.mood === "scared" ? 0 : 0.01), 0.02 + (look.mood === "scared" ? 0.01 : 0), 0.022, 0, TAU); c.fill(); }
  c.restore();
}

function glass(c: C, pts: number[], night: number) {
  c.fillStyle = rgba(mix("#BFEFFF", "#2A3A5A", night * 0.6), 0.55); roundPoly(c, pts, 0.06); c.fill();
  c.strokeStyle = rgba("#FFFFFF", 0.35); c.lineWidth = 0.03; c.stroke();
}

function details(c: C, id: VehicleId, body: string, trim: string, accent: string, look: CarLook) {
  const n = look.night;
  const lamp = (x: number, y: number, r = 0.09) => {
    c.fillStyle = "#FFF3B0"; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (n > 0.3) { const g = c.createLinearGradient(x, y, x + 3.5, y); g.addColorStop(0, rgba("#FFF3B0", 0.35 * n)); g.addColorStop(1, rgba("#FFF3B0", 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x, y + 0.05); c.lineTo(x + 3.5, y + 0.7); c.lineTo(x + 3.5, y - 0.8); c.closePath(); c.fill(); }
  };
  const tail = (x: number, y: number) => { c.fillStyle = "#FF4F5A"; c.fillRect(x - 0.04, y - 0.06, 0.08, 0.14); };
  c.lineCap = "round";
  switch (id) {
    case "jeep":
      c.strokeStyle = trim; c.lineWidth = 0.09; c.beginPath(); c.moveTo(-0.65, 0.3); c.lineTo(-0.55, 1.05); c.lineTo(0.15, 1.05); c.lineTo(0.28, 0.32); c.stroke();
      glass(c, [0.32, 0.32, 0.55, 0.32, 0.4, 0.78, 0.3, 0.78], n);
      c.fillStyle = "#24222C"; c.beginPath(); c.arc(-1.32, 0.05, 0.3, 0, TAU); c.fill(); c.fillStyle = shade(accent, -0.1); c.beginPath(); c.arc(-1.32, 0.05, 0.14, 0, TAU); c.fill();
      c.fillStyle = shade(body, -0.25); c.fillRect(0.7, 0.05, 0.4, 0.06); c.fillRect(0.7, -0.05, 0.4, 0.06);
      lamp(1.22, 0.1); tail(-1.18, 0.12);
      break;
    case "pickup":
      glass(c, [0.05, 0.36, 0.82, 0.36, 0.72, 0.84, 0.05, 0.84], n);
      c.strokeStyle = trim; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.4, 0.36); c.lineTo(0.4, 0.84); c.stroke();
      c.fillStyle = shade(body, -0.3); c.fillRect(-1.55, 0.18, 1.35, 0.1);
      c.fillStyle = mix("#C08A4E", body, 0.2); for (let k = 0; k < 3; k++) c.fillRect(-1.4 + k * 0.42, 0.28, 0.34, 0.26);
      lamp(1.6, 0.08); tail(-1.6, 0.08);
      break;
    case "monster":
      glass(c, [-0.5, 0.45, 0.3, 0.45, 0.22, 0.8, -0.42, 0.8], n);
      c.fillStyle = trim; c.fillRect(-1.25, -0.32, 2.5, 0.12);
      for (let k = 0; k < 4; k++) { c.fillStyle = "#FFE14D"; c.beginPath(); c.arc(-0.35 + k * 0.23, 0.95, 0.06, 0, TAU); c.fill(); }
      lamp(1.3, 0.12, 0.11); tail(-1.28, 0.12);
      break;
    case "bus":
      for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) glass(c, [-1.85 + k * 0.85, -0.25 + row * 0.82, -1.15 + k * 0.85, -0.25 + row * 0.82, -1.15 + k * 0.85, 0.2 + row * 0.82, -1.85 + k * 0.85, 0.2 + row * 0.82], n);
      glass(c, [1.15, -0.32, 1.98, -0.32, 1.98, 0.22, 1.15, 0.22], n);
      c.fillStyle = accent; c.fillRect(-2.05, 0.28, 4.1, 0.1);
      c.fillStyle = trim; c.fillRect(-2.05, -0.78, 4.1, 0.12);
      lamp(2.0, -0.55, 0.1); tail(-2.02, -0.5);
      break;
    case "tractor":
      glass(c, [-0.78, 0.4, 0.05, 0.4, 0.05, 0.88, -0.78, 0.88], n);
      c.strokeStyle = trim; c.lineWidth = 0.07; c.beginPath(); c.moveTo(-0.85, 0.95); c.lineTo(0.15, 0.95); c.stroke();
      c.fillStyle = "#3A3A44"; c.fillRect(0.8, 0.3, 0.12, 0.55); c.fillStyle = "#24222C"; c.fillRect(0.76, 0.83, 0.2, 0.06);
      c.fillStyle = shade(body, -0.25); for (let k = 0; k < 4; k++) c.fillRect(0.45 + k * 0.2, -0.15, 0.08, 0.36);
      lamp(1.36, 0.05); tail(-0.92, 0.2);
      break;
    case "buggy":
      c.strokeStyle = trim; c.lineWidth = 0.08;
      c.beginPath(); c.moveTo(-0.75, 0.18); c.lineTo(-0.55, 0.95); c.lineTo(0.15, 0.95); c.lineTo(0.55, 0.2); c.moveTo(-0.55, 0.95); c.lineTo(-0.95, 0.2); c.stroke();
      c.fillStyle = accent; c.beginPath(); c.moveTo(-1.05, 0.2); c.lineTo(-1.25, 0.55); c.lineTo(-0.85, 0.55); c.lineTo(-0.8, 0.2); c.fill();
      lamp(1.0, 0.02, 0.07);
      break;
    case "rod":
      c.fillStyle = "#C8D0DC"; c.fillRect(0.6, 0.15, 0.55, 0.22);
      for (let k = 0; k < 3; k++) { c.fillStyle = "#E8ECF5"; c.fillRect(0.65 + k * 0.17, 0.37, 0.1, 0.18); }
      c.strokeStyle = "#E8ECF5"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.6, -0.05); c.lineTo(-0.2, -0.2); c.lineTo(-1.2, -0.22); c.stroke();
      glass(c, [-0.05, 0.55, 0.12, 0.55, 0.0, 0.85, -0.12, 0.85], n);
      lamp(1.56, -0.02, 0.1); tail(-1.45, 0.22);
      break;
    case "moonbug":
      c.fillStyle = rgba(mix("#BFEFFF", "#2A3A5A", n * 0.6), 0.35); c.beginPath(); c.arc(-0.05, 0.95, 0.62, 0, Math.PI); c.closePath(); c.fill();
      c.strokeStyle = rgba("#FFFFFF", 0.6); c.lineWidth = 0.04; c.beginPath(); c.arc(-0.05, 0.95, 0.62, 0.25, Math.PI - 0.1); c.stroke();
      c.fillStyle = "#2A4C9A"; c.fillRect(-1.2, 0.38, 0.55, 0.06); c.save(); c.translate(-0.92, 0.42); c.rotate(-0.3); c.fillRect(-0.35, 0, 0.7, 0.32); c.restore();
      c.strokeStyle = trim; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.7, 0.35); c.lineTo(0.85, 0.85); c.stroke();
      c.fillStyle = "#FF5A5F"; c.beginPath(); c.arc(0.85, 0.87, 0.05 + 0.02 * Math.sin(look.t * 6), 0, TAU); c.fill();
      lamp(1.25, 0.05);
      break;
  }
  c.lineCap = "butt";
}

/** a ride for the garage and the menus (chassis at the origin, wheels at rest) */
const previewAntenna = new Antenna();
export function drawCarPreview(c: C, car: Car, t: number, paint: string) {
  const ant = previewAntenna;
  drawCar(c, car, ant, { mood: "happy", blink: t % 3.2 < 0.12, gas: 0, t, shield: 0, turbo: false, float: false, grip: false, night: 0, paint });
}
