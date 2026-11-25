// The rides and their driver, drawn in world space (metres, y up) every frame from the physics state: a soft contact
// shadow on the ground, sprung struts with coils that squash, tyres with tread and spinning rims (with a blur ring at
// speed), each ride's own body, and Zuzu — a cartoon driver in a leather flying cap with brass goggles, a blue jacket
// and a yellow scarf that streams in the wind (a little rope simulation); arms and legs bend to the wheel and pedals,
// and the face blinks, grins, gasps in the air, grimaces on the way down, sees stars after a crash and cheers at the flag.
import type { Rover } from "../physics";
import type { Terrain } from "../terrain";
import type { VehicleId } from "../vehicles";
import { clamp, rgba, shade } from "../util";

export type Mood = "happy" | "wow" | "scared" | "dizzy" | "cheer";

const ZUZU = {
  skin: "#F4BF94", skinLight: "#FFDCBC", skinDark: "#D58E62", blush: "rgba(255,112,112,0.32)", hair: "#4A2B1C",
  cap: "#A9622D", capLight: "#D38D4E", capDark: "#73401C", stitch: "#F2D3A8", strap: "#3B2A22",
  brass: "#E7B54C", brassDark: "#A7762B", lens: "#8BEBFF", lensDark: "#2B86C9",
  jacket: "#2F6BEA", jacketLight: "#5E95FF", jacketDark: "#1D44A6", jacketFar: "#1B3C8F", stripe: "#FFD23F",
  glove: "#3B3F56", gloveFar: "#2A2D3F", pants: "#3A3F58", pantsFar: "#2A2E42", boot: "#5A3524", bootFar: "#3F2418",
  scarf: "#FFD23F", scarfDark: "#E8A317", ink: "#1B1F2B", inkSoft: "rgba(27,31,43,0.45)", mouth: "#5A1A26", tongue: "#FF7B8E",
};

export class ScarfRope {
  px = new Float32Array(8); py = new Float32Array(8); ox = new Float32Array(8); oy = new Float32Array(8);
  private ready = false;
  update(ax: number, ay: number, vx: number, vy: number, dt: number) {
    const n = 8, seg = 0.075;
    if (!this.ready) { for (let i = 0; i < n; i++) { this.px[i] = this.ox[i] = ax - i * seg; this.py[i] = this.oy[i] = ay; } this.ready = true; }
    this.px[0] = ax; this.py[0] = ay; this.ox[0] = ax; this.oy[0] = ay;
    // wind from motion + a flutter
    const wx = -vx * 0.9 - 1.2, wy = -vy * 0.4;
    for (let i = 1; i < n; i++) {
      const x = this.px[i], y = this.py[i];
      const fl = Math.sin(performance.now() * 0.018 + i * 1.3) * 3.5;
      const nx = x + (x - this.ox[i]) * 0.92 + wx * 0.35 * dt * dt * 60, ny = y + (y - this.oy[i]) * 0.92 + (wy * 0.35 - 6 + fl) * dt * dt * 60 * 0.5;
      this.ox[i] = x; this.oy[i] = y; this.px[i] = nx; this.py[i] = ny;
    }
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < n; i++) {
        const dx = this.px[i] - this.px[i - 1], dy = this.py[i] - this.py[i - 1], d = Math.hypot(dx, dy) || 1e-6, diff = (d - seg) / d;
        if (i === 1) { this.px[i] -= dx * diff; this.py[i] -= dy * diff; }
        else { this.px[i] -= dx * diff * 0.5; this.py[i] -= dy * diff * 0.5; this.px[i - 1] += dx * diff * 0.5; this.py[i - 1] += dy * diff * 0.5; }
      }
    }
  }
}

function wheel(c: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, omega: number, tire: string, rim: string, kind: VehicleId) {
  c.save(); c.translate(x, y);
  // tyre with tread blocks
  c.fillStyle = tire; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.rotate(spin);
  const blocks = kind === "monster" ? 14 : kind === "comet" ? 18 : 12;
  c.fillStyle = shade(tire, 0.18);
  for (let k = 0; k < blocks; k++) {
    c.rotate((Math.PI * 2) / blocks);
    c.fillRect(-r * 0.09, r * 0.86, r * 0.18, r * (kind === "monster" ? 0.2 : 0.14));
  }
  c.rotate(-spin);
  // sidewall ring
  c.strokeStyle = shade(tire, 0.1); c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.82, 0, Math.PI * 2); c.stroke();
  // rim
  const rr = r * (kind === "comet" ? 0.5 : kind === "monster" ? 0.5 : 0.56);
  const g = c.createRadialGradient(-rr * 0.3, rr * 0.4, rr * 0.05, 0, 0, rr);
  g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.45, rim); g.addColorStop(1, shade(rim, -0.35));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.fill();
  c.rotate(spin);
  c.strokeStyle = shade(rim, -0.4); c.lineWidth = rr * 0.16;
  const spokes = kind === "scrambler" ? 10 : 5;
  for (let k = 0; k < spokes; k++) { c.rotate((Math.PI * 2) / spokes); c.beginPath(); c.moveTo(0, rr * 0.2); c.lineTo(0, rr * 0.86); c.stroke(); }
  c.fillStyle = shade(rim, -0.25); c.beginPath(); c.arc(0, 0, rr * 0.24, 0, Math.PI * 2); c.fill();
  c.rotate(-spin);
  // speed blur
  const sp = Math.abs(omega);
  if (sp > 12) { c.strokeStyle = rgba("#FFFFFF", clamp((sp - 12) / 40, 0, 0.35)); c.lineWidth = rr * 0.5; c.beginPath(); c.arc(0, 0, rr * 0.62, 0, Math.PI * 2); c.stroke(); }
  // a fixed highlight on the tyre
  c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = r * 0.07; c.beginPath(); c.arc(0, 0, r * 0.93, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
  c.restore();
}

function strut(c: CanvasRenderingContext2D, ax: number, ay: number, wx: number, wy: number, w: number, col: string) {
  const dx = wx - ax, dy = wy - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  c.strokeStyle = shade(col, -0.2); c.lineWidth = w * 0.55; c.lineCap = "round";
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(wx, wy); c.stroke();
  // the coil squashes and stretches with the suspension
  c.strokeStyle = col; c.lineWidth = w * 0.3;
  c.beginPath();
  const turns = 6;
  for (let k = 0; k <= turns * 2; k++) {
    const t = 0.12 + (k / (turns * 2)) * 0.6, s = k % 2 ? 1 : -1;
    const x = ax + dx * t + nx * w * 0.7 * s, y = ay + dy * t + ny * w * 0.7 * s;
    if (k) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.stroke();
}

export interface DrawState { mood: Mood; blink: boolean; gas: number; brake: number; t: number; thrust: boolean; shield: number; turbo: boolean; feather: boolean }

export function drawRover(c: CanvasRenderingContext2D, R: Rover, T: Terrain, scarf: ScarfRope, s: DrawState) {
  const spec = R.spec, col = spec.colors, kind = spec.id;
  const ca = Math.cos(R.a), sa = Math.sin(R.a);
  const W = (lx: number, ly: number) => [R.x + lx * ca - ly * sa, R.y + lx * sa + ly * ca] as const;
  // contact shadow on the ground below
  const gy = T.heightAt(R.x), hgt = R.y - gy;
  const sh = clamp(1 - hgt / 8, 0, 1);
  if (sh > 0) { c.fillStyle = rgba("#000000", 0.28 * sh); c.beginPath(); c.ellipse(R.x, gy + 0.03, spec.chassis.w * 0.62 * (0.6 + 0.4 * sh), 0.16 * sh + 0.03, Math.atan(T.slopeAt(R.x)), 0, Math.PI * 2); c.fill(); }

  // struts behind the body
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = spec.anchors[i];
    const [px, py] = W(ax, ay + 0.12);
    strut(c, px, py, R.wx[i], R.wy[i], spec.wheel.r * 0.32, "#C9CEDA");
  }

  // ---- body (chassis-local drawing)
  c.save(); c.translate(R.x, R.y); c.rotate(R.a);
  if (kind !== "scrambler") driverLegs(c, spec.seat[0], spec.seat[1], s, kind);
  if (kind === "scrambler") bike(c, col, s); else if (kind === "monster") monster(c, col, s); else if (kind === "comet") comet(c, col, s); else buggy(c, col, s);
  if (kind === "scrambler") driverLegs(c, spec.seat[0], spec.seat[1], s, kind);
  // Zuzu
  driver(c, spec.seat[0], spec.seat[1], spec.head.x, spec.head.y, spec.head.r, s, kind);
  c.restore();

  // scarf (world space, after the body so it streams behind)
  ribbon(c, scarf);

  // wheels on top of the struts and body edge
  for (let i = 0; i < 2; i++) wheel(c, R.wx[i], R.wy[i], spec.wheel.r, R.spin[i], R.omega[i], col.tire, col.rim, kind);

  // shield bubble
  if (s.shield > 0) {
    const pulse = 0.94 + Math.sin(s.t * 6) * 0.04;
    const rr = spec.chassis.w * 0.85 * pulse;
    const g = c.createRadialGradient(R.x - rr * 0.3, R.y + 0.4 + rr * 0.3, rr * 0.2, R.x, R.y + 0.4, rr);
    g.addColorStop(0, "rgba(160,220,255,0.05)"); g.addColorStop(0.8, "rgba(80,170,255,0.18)"); g.addColorStop(1, "rgba(140,210,255,0.55)");
    c.globalAlpha = s.shield < 2 ? (Math.sin(s.t * 20) > 0 ? 1 : 0.4) : 1;
    c.fillStyle = g; c.beginPath(); c.arc(R.x, R.y + 0.4, rr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(200,235,255,0.7)"; c.lineWidth = 0.05; c.beginPath(); c.arc(R.x, R.y + 0.4, rr, Math.PI * 0.6, Math.PI * 0.95); c.stroke();
    c.globalAlpha = 1;
  }
}

function ribbon(c: CanvasRenderingContext2D, r: ScarfRope) {
  const n = r.px.length;
  c.fillStyle = ZUZU.scarf;
  c.beginPath();
  for (let i = 0; i < n; i++) { const w = 0.07 * (1 - i / n) + 0.02; c.lineTo(r.px[i], r.py[i] + w); }
  for (let i = n - 1; i >= 0; i--) { const w = 0.07 * (1 - i / n) + 0.02; c.lineTo(r.px[i], r.py[i] - w); }
  c.closePath(); c.fill();
  c.strokeStyle = ZUZU.scarfDark; c.lineWidth = 0.025;
  c.beginPath(); for (let i = 0; i < n; i++) c.lineTo(r.px[i], r.py[i] - 0.02); c.stroke();
}

/** two-bone reach: where the elbow (or knee) goes for a limb from (sx, sy) to (tx, ty); bend +1 = below the line */
function joint(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bend: number): [number, number] {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.max(1e-4, Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4));
  const a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [sx + Math.cos(a - b * bend) * l1, sy + Math.sin(a - b * bend) * l1];
}
function limb(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, w0: number, w1: number, col0: string, col1: string) {
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = col0; c.lineWidth = w0; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = col1; c.lineWidth = w1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
const lean = (s: DrawState) => (s.gas - s.brake) * -0.08 + (s.mood === "scared" ? 0.05 : 0);
/** where the hands hold on, in the ride's frame */
function grip(kind: VehicleId, hx: number, hy: number): [number, number] {
  return kind === "scrambler" ? [hx + 0.66, hy + 0.36] : [hx + 0.56, hy + 0.4];
}

/** Zuzu's legs: inside the tub (drawn before the body), or astride the bike (drawn after it) */
function driverLegs(c: CanvasRenderingContext2D, hx: number, hy: number, s: DrawState, kind: VehicleId) {
  const bike = kind === "scrambler";
  c.save(); c.translate(hx, hy); c.rotate(lean(s)); c.translate(-hx, -hy);
  const px = hx + 0.02, py = hy + 0.06;
  for (const far of [true, false]) {
    const o = far ? -0.04 : 0;
    const fx = (bike ? hx + 0.22 : hx + 0.78) + o, fy = (bike ? hy - 0.3 : hy - 0.02) + (far ? 0.02 : 0);
    const [kx, ky] = joint(px + o, py, fx, fy, 0.36, 0.36, -1);
    limb(c, px + o, py, kx, ky, fx, fy, 0.17, 0.14, far ? ZUZU.pantsFar : ZUZU.pants, far ? ZUZU.pantsFar : ZUZU.pants);
    // boot
    c.fillStyle = far ? ZUZU.bootFar : ZUZU.boot;
    c.beginPath(); c.roundRect(fx - 0.06, fy - 0.07, 0.2, 0.12, 0.05); c.fill();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(fx - 0.04, fy + 0.02, 0.15, 0.02);
  }
  c.restore();
}

/** Zuzu in the seat: a cartoon driver in a leather flying cap with brass goggles, a blue jacket and a yellow scarf;
 *  arms on the wheel, eyes and brows that react, a mouth for every moment */
function driver(c: CanvasRenderingContext2D, hx: number, hy: number, headX: number, headY: number, hr: number, s: DrawState, kind: VehicleId) {
  const P = ZUZU;
  c.save(); c.translate(hx, hy); c.rotate(lean(s)); c.translate(-hx, -hy);
  const bob = Math.sin(s.t * 2.4) * 0.012;
  const shX = hx + 0.06, shY = hy + 0.56 + bob; // near shoulder
  const [gx, gy] = grip(kind, hx, hy);
  const cheer = s.mood === "cheer";

  // far arm, behind the body: on the wheel, or punching the air at the finish (up past the head)
  {
    const sx = shX - 0.1, sy = shY + 0.02;
    const pump = Math.sin(s.t * 9);
    const tx = cheer ? sx + 0.55 + pump * 0.03 : gx + 0.03, ty = cheer ? sy + 0.78 + pump * 0.05 : gy - 0.02;
    const [ex, ey] = cheer ? joint(sx, sy, tx, ty, 0.42, 0.42, 1) : joint(sx, sy, tx, ty, 0.33, 0.31, 1);
    limb(c, sx, sy, ex, ey, tx, ty, 0.13, 0.115, P.jacketFar, cheer ? P.jacket : P.jacketFar);
    c.fillStyle = cheer ? P.glove : P.gloveFar; c.beginPath(); c.arc(tx, ty, cheer ? 0.085 : 0.07, 0, Math.PI * 2); c.fill();
  }

  // torso: a padded jacket, lit from the front
  const tg = c.createLinearGradient(hx - 0.25, hy, hx + 0.25, hy + 0.3);
  tg.addColorStop(0, P.jacketDark); tg.addColorStop(0.55, P.jacket); tg.addColorStop(1, P.jacketLight);
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(hx - 0.2, hy - 0.02);
  c.bezierCurveTo(hx - 0.29, hy + 0.24, hx - 0.22, hy + 0.54 + bob, hx - 0.07, hy + 0.63 + bob);
  c.quadraticCurveTo(hx + 0.12, hy + 0.68 + bob, hx + 0.21, hy + 0.55 + bob);
  c.bezierCurveTo(hx + 0.27, hy + 0.36, hx + 0.25, hy + 0.1, hx + 0.17, hy - 0.02);
  c.closePath(); c.fill();
  // zip, a chest stripe and a pocket
  c.strokeStyle = P.jacketDark; c.lineWidth = 0.022;
  c.beginPath(); c.moveTo(hx + 0.13, hy + 0.58 + bob); c.quadraticCurveTo(hx + 0.2, hy + 0.3, hx + 0.15, hy + 0.02); c.stroke();
  c.fillStyle = P.stripe; c.beginPath(); c.moveTo(hx - 0.24, hy + 0.36); c.lineTo(hx + 0.24, hy + 0.42); c.lineTo(hx + 0.235, hy + 0.35); c.lineTo(hx - 0.255, hy + 0.29); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.16)"; c.beginPath(); c.ellipse(hx + 0.1, hy + 0.46 + bob, 0.06, 0.12, -0.2, 0, Math.PI * 2); c.fill();

  // neck and the scarf wrapped round it
  const x = headX, y = headY + bob;
  c.fillStyle = P.skinDark; c.beginPath(); c.roundRect(x - 0.07, y - hr - 0.12, 0.15, 0.2, 0.05); c.fill();
  c.fillStyle = P.scarf; c.beginPath(); c.ellipse(x - 0.01, y - hr * 0.98, 0.2, 0.085, -0.08, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.scarfDark; c.beginPath(); c.ellipse(x - 0.17, y - hr * 1.02, 0.07, 0.065, 0, 0, Math.PI * 2); c.fill();

  // ---- head (faces right)
  const r = hr;
  // curls at the back, under the cap
  c.fillStyle = P.hair;
  for (const [ox, oy, rr] of CURLS) { c.beginPath(); c.arc(x + ox * r, y + oy * r, rr * r, 0, Math.PI * 2); c.fill(); }
  // face: a round head and a soft jaw
  const fg = c.createRadialGradient(x + r * 0.35, y + r * 0.25, r * 0.1, x, y, r * 1.15);
  fg.addColorStop(0, P.skinLight); fg.addColorStop(0.6, P.skin); fg.addColorStop(1, P.skinDark);
  c.fillStyle = fg;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.ellipse(x + r * 0.22, y - r * 0.32, r * 0.78, r * 0.62, 0, 0, Math.PI * 2); c.fill();
  // cheek glow
  c.fillStyle = P.blush; c.beginPath(); c.ellipse(x + r * 0.3, y - r * 0.33, r * 0.2, r * 0.12, 0, 0, Math.PI * 2); c.fill();

  // eyes
  const nearX = x + r * 0.36, farX = x + r * 0.78, eyY = y + r * 0.04;
  const big = s.mood === "wow" || s.mood === "scared" ? 1.18 : 1;
  if (cheer) {
    c.strokeStyle = P.ink; c.lineWidth = r * 0.09; c.lineCap = "round";
    for (const ex of [nearX, farX]) { c.beginPath(); c.arc(ex, eyY - r * 0.05, r * 0.13, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
  } else if (s.blink && s.mood === "happy") {
    c.strokeStyle = P.ink; c.lineWidth = r * 0.07; c.lineCap = "round";
    for (const ex of [nearX, farX]) { c.beginPath(); c.moveTo(ex - r * 0.13, eyY); c.lineTo(ex + r * 0.13, eyY); c.stroke(); }
  } else {
    for (let k = 0; k < 2; k++) {
      const ex = k ? farX : nearX, rx = (k ? 0.14 : 0.18) * r * big, ry = 0.24 * r * big;
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.ellipse(ex, eyY, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.inkSoft; c.lineWidth = r * 0.03; c.stroke();
      if (s.mood === "dizzy") {
        c.strokeStyle = P.ink; c.lineWidth = r * 0.045; c.beginPath();
        for (let q = 0; q < 12; q++) { const a = q * 0.95 + s.t * 9 * (k ? -1 : 1), rr = (q / 12) * r * 0.16; c.lineTo(ex + Math.cos(a) * rr, eyY + Math.sin(a) * rr); }
        c.stroke();
      } else {
        const pr = (s.mood === "scared" ? 0.07 : 0.1) * r, look = s.mood === "wow" ? r * 0.06 : 0;
        c.fillStyle = P.ink; c.beginPath(); c.arc(ex + rx * 0.35, eyY + look - r * 0.02, pr, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(ex + rx * 0.35 + pr * 0.35, eyY + look + pr * 0.3, pr * 0.35, 0, Math.PI * 2); c.fill();
      }
    }
  }
  // brows: relaxed, lifted in the air, worried when it goes wrong
  c.strokeStyle = P.hair; c.lineWidth = r * 0.085; c.lineCap = "round";
  const lift = s.mood === "wow" ? 0.08 : cheer ? 0.05 : 0;
  for (let k = 0; k < 2; k++) {
    const ex = k ? farX : nearX, by = eyY + r * (0.34 + lift), w = r * (k ? 0.11 : 0.15);
    const tilt = s.mood === "scared" ? (k ? -0.09 : 0.09) * r : s.mood === "dizzy" ? (k ? 0.08 : -0.06) * r : 0;
    c.beginPath(); c.moveTo(ex - w, by - tilt); c.quadraticCurveTo(ex, by + r * 0.06, ex + w, by + tilt); c.stroke();
  }
  // nose
  const ng = c.createRadialGradient(x + r * 1.0, y - r * 0.05, r * 0.03, x + r * 0.97, y - r * 0.12, r * 0.22);
  ng.addColorStop(0, P.skinLight); ng.addColorStop(1, P.skinDark);
  c.fillStyle = ng; c.beginPath(); c.ellipse(x + r * 0.98, y - r * 0.13, r * 0.2, r * 0.17, 0.2, 0, Math.PI * 2); c.fill();
  // mouth
  const mx = x + r * 0.64, my = y - r * 0.52;
  c.fillStyle = P.mouth; c.strokeStyle = P.ink; c.lineWidth = r * 0.04;
  if (s.mood === "wow") {
    c.beginPath(); c.ellipse(mx, my, r * 0.1, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.tongue; c.beginPath(); c.ellipse(mx, my - r * 0.07, r * 0.06, r * 0.04, 0, 0, Math.PI * 2); c.fill();
  } else if (s.mood === "scared") {
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.roundRect(mx - r * 0.24, my - r * 0.1, r * 0.46, r * 0.2, r * 0.07); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(mx - r * 0.22, my); c.lineTo(mx + r * 0.2, my); c.stroke();
    for (let q = -1; q <= 1; q++) { c.beginPath(); c.moveTo(mx + q * r * 0.09, my - r * 0.1); c.lineTo(mx + q * r * 0.09, my + r * 0.1); c.stroke(); }
    // a drop of sweat
    const d = (s.t * 1.6) % 1;
    c.fillStyle = "rgba(150,215,255,0.9)"; c.beginPath(); c.ellipse(x - r * 0.15, y + r * (0.45 - d * 0.5), r * 0.07, r * 0.1, 0, 0, Math.PI * 2); c.fill();
  } else if (s.mood === "dizzy") {
    c.beginPath(); c.moveTo(mx - r * 0.2, my);
    for (let q = 1; q <= 6; q++) c.lineTo(mx - r * 0.2 + q * r * 0.07, my + (q % 2 ? r * 0.05 : -r * 0.05));
    c.stroke();
  } else {
    // the grin: wider and open at the finish
    const w = cheer ? 0.3 : 0.24, d = cheer ? 0.3 : 0.2;
    c.beginPath(); c.moveTo(mx - r * w, my + r * 0.06); c.quadraticCurveTo(mx, my - r * d * 1.6, mx + r * w, my + r * 0.08); c.closePath(); c.fill();
    c.save(); c.clip();
    c.fillStyle = "#FFFFFF"; c.fillRect(mx - r * w, my - r * 0.02, r * w * 2, r * 0.12);
    c.fillStyle = P.tongue; c.beginPath(); c.ellipse(mx + r * 0.02, my - r * d * 0.85, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // the flying cap: leather dome, a seam, an ear flap with a loose strap
  const capR = r * 1.07;
  const a0 = 0.22 * Math.PI, a1 = 1.1 * Math.PI, rimX = x - r * 0.1, rimY = y + r * 0.35;
  const cg = c.createLinearGradient(x + r, y + r, x - r, y - r * 0.2);
  cg.addColorStop(0, P.capLight); cg.addColorStop(0.5, P.cap); cg.addColorStop(1, P.capDark);
  c.fillStyle = cg;
  c.beginPath(); c.arc(x, y, capR, a0, a1);
  c.quadraticCurveTo(rimX, rimY, x + Math.cos(a0) * capR, y + Math.sin(a0) * capR);
  c.fill();
  c.strokeStyle = P.stitch; c.lineWidth = r * 0.035;
  c.beginPath(); c.arc(x - r * 0.1, y - r * 0.12, r * 1.05, 0.4 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.82, r * 0.32, r * 0.1, -0.25, 0, Math.PI * 2); c.fill();
  // the rim (rolled edge)
  c.strokeStyle = P.capDark; c.lineWidth = r * 0.11; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + Math.cos(a1) * capR, y + Math.sin(a1) * capR);
  c.quadraticCurveTo(rimX, rimY, x + Math.cos(a0) * capR, y + Math.sin(a0) * capR); c.stroke();
  // ear flap and strap
  const fx = x - r * 0.28, fy = y - r * 0.12;
  c.fillStyle = P.cap; c.beginPath(); c.ellipse(fx, fy, r * 0.27, r * 0.38, 0.12, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.capDark; c.lineWidth = r * 0.05; c.stroke();
  c.fillStyle = "#F2DDBB"; c.beginPath(); c.ellipse(fx + r * 0.02, fy + r * 0.04, r * 0.15, r * 0.24, 0.12, 0, Math.PI * 2); c.fill();
  const sw = Math.sin(s.t * 5) * 0.12;
  c.strokeStyle = P.capDark; c.lineWidth = r * 0.07;
  c.beginPath(); c.moveTo(fx + r * 0.05, fy - r * 0.34); c.quadraticCurveTo(fx + r * 0.1, fy - r * 0.6, fx + r * (0.02 + sw), fy - r * 0.78); c.stroke();
  c.fillStyle = P.brass; c.beginPath(); c.roundRect(fx + r * (sw - 0.04), fy - r * 0.84, r * 0.12, r * 0.09, r * 0.02); c.fill();
  // brass goggles up on the cap
  c.strokeStyle = P.strap; c.lineWidth = r * 0.12; c.lineCap = "butt";
  c.beginPath(); c.arc(x, y, r * 1.0, 0.22 * Math.PI, 0.98 * Math.PI); c.stroke();
  for (let k = 0; k < 2; k++) {
    const gxk = x + r * (k ? 0.55 : 0.1), gyk = y + r * (k ? 0.82 : 0.98), gr = r * (k ? 0.24 : 0.21);
    c.fillStyle = k ? P.brass : P.brassDark; c.beginPath(); c.arc(gxk, gyk, gr, 0, Math.PI * 2); c.fill();
    const lg = c.createLinearGradient(gxk - gr, gyk + gr, gxk + gr, gyk - gr);
    lg.addColorStop(0, P.lensDark); lg.addColorStop(1, P.lens);
    c.fillStyle = lg; c.beginPath(); c.arc(gxk, gyk, gr * 0.72, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.ellipse(gxk - gr * 0.22, gyk + gr * 0.25, gr * 0.22, gr * 0.12, -0.6, 0, Math.PI * 2); c.fill();
  }
  // a crash leaves stars circling
  if (s.mood === "dizzy") for (let k = 0; k < 3; k++) { const a = s.t * 4 + (k * Math.PI * 2) / 3; star(c, x + Math.cos(a) * r * 1.3, y + r * 1.25 + Math.sin(a) * r * 0.35, r * 0.18); }

  // near arm, in front, on the wheel
  {
    const sx = shX, sy = shY, tx = gx, ty = gy;
    const [ex, ey] = joint(sx, sy, tx, ty, 0.33, 0.31, 1);
    limb(c, sx, sy, ex, ey, tx, ty, 0.14, 0.125, P.jacket, P.jacketLight);
    c.fillStyle = P.stripe; c.beginPath(); c.arc(ex, ey, 0.03, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.glove; c.beginPath(); c.arc(tx, ty, 0.078, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.arc(tx + 0.02, ty + 0.025, 0.03, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
const CURLS: [number, number, number][] = [[-0.86, -0.18, 0.2], [-0.78, -0.42, 0.18], [-0.94, 0.06, 0.17], [-0.6, -0.6, 0.15]];

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = "#FFD23F"; c.beginPath();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

type Col = { body: string; trim: string; accent: string; rim: string; tire: string };
function paint(c: CanvasRenderingContext2D, y0: number, y1: number, base: string) { const g = c.createLinearGradient(0, y1, 0, y0); g.addColorStop(0, shade(base, 0.25)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.25)); return g; }

function buggy(c: CanvasRenderingContext2D, col: Col, s: DrawState) {
  // roll cage behind the driver
  c.strokeStyle = col.trim; c.lineWidth = 0.09; c.lineCap = "round"; c.lineJoin = "round";
  c.beginPath(); c.moveTo(-0.95, 0.3); c.lineTo(-0.7, 1.2); c.lineTo(0.35, 1.25); c.lineTo(0.75, 0.35); c.stroke();
  c.beginPath(); c.moveTo(-0.7, 1.2); c.lineTo(-0.15, 0.32); c.stroke();
  // tub
  c.fillStyle = paint(c, -0.3, 0.45, col.body);
  c.beginPath();
  c.moveTo(-1.3, -0.05); c.lineTo(-1.22, 0.36); c.quadraticCurveTo(-0.9, 0.46, -0.55, 0.42); c.lineTo(0.55, 0.38);
  c.quadraticCurveTo(1.1, 0.3, 1.34, 0.06); c.lineTo(1.22, -0.24); c.quadraticCurveTo(0, -0.34, -1.18, -0.28); c.closePath(); c.fill();
  // stripe, number disc, lights
  c.fillStyle = col.accent; c.beginPath(); c.moveTo(-1.25, 0.12); c.lineTo(1.3, 0.12); c.lineTo(1.26, 0.0); c.lineTo(-1.27, 0.0); c.closePath(); c.fill();
  // a racing roundel with a star
  c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(-0.55, 0.05, 0.17, 0, Math.PI * 2); c.fill();
  star(c, -0.55, 0.05, 0.12); c.fillStyle = col.trim; c.beginPath(); c.arc(-0.55, 0.05, 0.04, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#FFF6C8"; c.beginPath(); c.ellipse(1.28, 0.16, 0.06, 0.1, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.moveTo(-1.1, 0.35); c.quadraticCurveTo(0, 0.44, 0.9, 0.33); c.lineTo(0.9, 0.28); c.quadraticCurveTo(0, 0.36, -1.1, 0.29); c.fill();
  // exhaust pipe
  c.fillStyle = "#8E93A6"; c.beginPath(); c.roundRect(-1.45, -0.12, 0.3, 0.12, 0.05); c.fill();
  // seat
  c.fillStyle = col.trim; c.beginPath(); c.roundRect(-0.45, 0.36, 0.5, 0.14, 0.06); c.fill();
  // steering wheel
  c.strokeStyle = col.trim; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.35, 0.4); c.lineTo(0.45, 0.62); c.stroke();
  c.beginPath(); c.ellipse(0.47, 0.62, 0.05, 0.13, 0.3, 0, Math.PI * 2); c.stroke();
  flame(c, -1.5, -0.06, s);
}

function bike(c: CanvasRenderingContext2D, col: Col, s: DrawState) {
  // frame, tank, seat and the front fork towards the front wheel
  c.strokeStyle = "#C9CEDA"; c.lineWidth = 0.09; c.lineCap = "round";
  c.beginPath(); c.moveTo(0.55, 0.55); c.lineTo(0.78, -0.05); c.stroke();
  c.strokeStyle = col.trim; c.lineWidth = 0.1;
  c.beginPath(); c.moveTo(-0.72, -0.05); c.lineTo(-0.1, 0.18); c.lineTo(0.45, 0.4); c.moveTo(-0.1, 0.18); c.lineTo(0.2, -0.08); c.stroke();
  c.fillStyle = "#6E7392"; c.beginPath(); c.roundRect(-0.25, -0.12, 0.42, 0.28, 0.06); c.fill();
  c.fillStyle = paint(c, 0.15, 0.55, col.body);
  c.beginPath(); c.moveTo(-0.1, 0.3); c.quadraticCurveTo(0.15, 0.6, 0.55, 0.5); c.lineTo(0.5, 0.3); c.closePath(); c.fill();
  c.fillStyle = col.accent; c.beginPath(); c.moveTo(-0.85, 0.32); c.quadraticCurveTo(-0.5, 0.5, -0.05, 0.4); c.lineTo(-0.05, 0.3); c.quadraticCurveTo(-0.5, 0.36, -0.85, 0.24); c.fill();
  c.fillStyle = paint(c, 0.1, 0.4, col.body); c.beginPath(); c.moveTo(-0.95, 0.15); c.quadraticCurveTo(-0.8, 0.42, -0.5, 0.34); c.lineTo(-0.7, 0.1); c.closePath(); c.fill();
  c.strokeStyle = "#2B2D42"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.5, 0.55); c.lineTo(0.68, 0.7); c.stroke();
  c.fillStyle = "#FFF6C8"; c.beginPath(); c.arc(0.6, 0.38, 0.06, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#8E93A6"; c.beginPath(); c.roundRect(-0.85, -0.02, 0.35, 0.09, 0.04); c.fill();
  flame(c, -0.88, 0.02, s);
}

function monster(c: CanvasRenderingContext2D, col: Col, s: DrawState) {
  // lifted frame
  c.fillStyle = col.trim; c.beginPath(); c.roundRect(-1.2, -0.42, 2.4, 0.22, 0.08); c.fill();
  // cab with windows
  c.fillStyle = paint(c, -0.25, 0.55, col.body);
  c.beginPath(); c.moveTo(-1.4, -0.2); c.lineTo(-1.35, 0.4); c.lineTo(-0.55, 0.45); c.lineTo(-0.35, 0.95); c.lineTo(0.45, 0.95); c.lineTo(0.75, 0.42); c.lineTo(1.4, 0.32); c.lineTo(1.42, -0.2); c.closePath(); c.fill();
  c.fillStyle = "rgba(170,220,255,0.55)"; c.beginPath(); c.moveTo(-0.25, 0.5); c.lineTo(-0.15, 0.85); c.lineTo(0.38, 0.85); c.lineTo(0.58, 0.48); c.closePath(); c.fill();
  c.fillStyle = col.accent; c.fillRect(-1.38, 0.05, 2.8, 0.1);
  c.fillStyle = "#1B1F2B"; for (let k = 0; k < 4; k++) c.fillRect(1.42, -0.15 + k * 0.1, 0.12, 0.05);
  c.fillStyle = "#FFF6C8"; c.beginPath(); c.ellipse(1.38, 0.24, 0.05, 0.08, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(-1.3, 0.3, 1.0, 0.05);
  // roof lights
  for (let k = 0; k < 3; k++) { c.fillStyle = "#FFE98A"; c.beginPath(); c.arc(-0.2 + k * 0.25, 1.0, 0.06, 0, Math.PI * 2); c.fill(); }
  flame(c, -1.48, -0.1, s);
}

function comet(c: CanvasRenderingContext2D, col: Col, s: DrawState) {
  c.fillStyle = col.trim; c.beginPath(); c.roundRect(-1.2, -0.32, 2.4, 0.16, 0.06); c.fill();
  c.fillStyle = paint(c, -0.2, 0.4, col.body);
  c.beginPath(); c.moveTo(-1.3, -0.18); c.lineTo(-1.25, 0.25); c.quadraticCurveTo(-0.5, 0.42, 0.4, 0.36); c.quadraticCurveTo(1.1, 0.3, 1.34, 0.02); c.lineTo(1.25, -0.2); c.closePath(); c.fill();
  // solar panel and antenna
  c.fillStyle = "#1F3A8A"; c.save(); c.translate(-0.85, 0.55); c.rotate(-0.25); c.fillRect(-0.4, -0.05, 0.8, 0.1);
  c.strokeStyle = "#5FA8FF"; c.lineWidth = 0.015; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(-0.4 + k * 0.2, -0.05); c.lineTo(-0.4 + k * 0.2, 0.05); c.stroke(); }
  c.restore();
  c.strokeStyle = "#8E93A6"; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.85, 0.3); c.lineTo(-0.85, 0.5); c.moveTo(0.9, 0.3); c.lineTo(1.05, 0.85); c.stroke();
  c.fillStyle = "#FF4D6D"; c.beginPath(); c.arc(1.05, 0.88, 0.05, 0, Math.PI * 2); c.fill();
  c.fillStyle = col.accent; c.fillRect(-1.25, 0.0, 2.55, 0.07);
  c.fillStyle = "rgba(120,220,255,0.9)"; c.beginPath(); c.ellipse(1.3, 0.12, 0.05, 0.09, 0, 0, Math.PI * 2); c.fill();
  // thrusters fire in the air
  if (s.thrust) {
    for (const x of [-1.25, 1.2]) {
      const len = 0.5 + Math.random() * 0.25;
      const g = c.createLinearGradient(x, -0.25, x, -0.25 - len);
      g.addColorStop(0, "rgba(150,230,255,0.95)"); g.addColorStop(1, "rgba(80,140,255,0)");
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 0.08, -0.25); c.lineTo(x + 0.08, -0.25); c.lineTo(x, -0.25 - len); c.closePath(); c.fill();
    }
  }
  if (s.turbo) flame(c, -1.35, -0.05, { ...s, gas: 1 });
}

/** exhaust flame on turbo (and a pop on hard throttle) */
function flame(c: CanvasRenderingContext2D, x: number, y: number, s: DrawState) {
  if (!s.turbo) return;
  const len = 0.7 + Math.random() * 0.4;
  const g = c.createLinearGradient(x, y, x - len, y);
  g.addColorStop(0, "rgba(255,250,200,0.95)"); g.addColorStop(0.35, "rgba(255,170,60,0.9)"); g.addColorStop(1, "rgba(255,80,40,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y + 0.1); c.quadraticCurveTo(x - len * 0.5, y + 0.2, x - len, y); c.quadraticCurveTo(x - len * 0.5, y - 0.2, x, y - 0.1); c.closePath(); c.fill();
}

/** the ride alone for menus and the garage (centred at 0,0, wheels at rest) */
export function drawRoverPreview(c: CanvasRenderingContext2D, R: Rover, t: number) {
  const spec = R.spec;
  c.save(); c.translate(R.x, R.y); c.rotate(R.a);
  const s: DrawState = { mood: "happy", blink: Math.sin(t * 1.3) > 0.97, gas: 0, brake: 0, t, thrust: false, shield: 0, turbo: false, feather: false };
  if (spec.id !== "scrambler") driverLegs(c, spec.seat[0], spec.seat[1], s, spec.id);
  if (spec.id === "scrambler") bike(c, spec.colors, s); else if (spec.id === "monster") monster(c, spec.colors, s); else if (spec.id === "comet") comet(c, spec.colors, s); else buggy(c, spec.colors, s);
  if (spec.id === "scrambler") driverLegs(c, spec.seat[0], spec.seat[1], s, spec.id);
  driver(c, spec.seat[0], spec.seat[1], spec.head.x, spec.head.y, spec.head.r, s, spec.id);
  c.restore();
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = spec.anchors[i];
    const ca = Math.cos(R.a), sa = Math.sin(R.a);
    strut(c, R.x + ax * ca - (ay + 0.12) * sa, R.y + ax * sa + (ay + 0.12) * ca, R.wx[i], R.wy[i], spec.wheel.r * 0.32, "#C9CEDA");
    wheel(c, R.wx[i], R.wy[i], spec.wheel.r, R.spin[i] + t * 2, -8, spec.colors.tire, spec.colors.rim, spec.id);
  }
}
