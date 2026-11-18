// Hazard math for Momo Escape. Every hazard's shape is a pure function of the room's local tick, so the renderer, the
// game and the solver always agree. Coordinates are room-local units (y up).
import { DX, DY, R_RUN, U, type Dir, type Hazard } from "./types";

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const cyc = (t: number, period: number, phase: number) => frac((t + phase) / period);

/** sweep: triangle wave in [−1, 1] */
const tri = (u: number) => 1 - 4 * Math.abs(frac(u + 0.25) - 0.5);

export function laserOn(h: Extract<Hazard, { k: "laser" }>, t: number) {
  return h.mode !== "blink" || cyc(t, h.period, h.phase) < h.duty;
}
/** blink laser: about to turn on (for the warning flicker) */
export function laserSoon(h: Extract<Hazard, { k: "laser" }>, t: number) {
  if (h.mode !== "blink") return false;
  const u = cyc(t, h.period, h.phase);
  return u > 1 - 24 / h.period;
}
export function laserSeg(h: Extract<Hazard, { k: "laser" }>, t: number): [number, number, number, number] {
  if (h.mode === "sweep") { const k = tri((t + h.phase) / h.period); return [h.ax + h.sx * k, h.ay + h.sy * k, h.bx + h.sx * k, h.by + h.sy * k]; }
  if (h.mode === "spin") { const a = ((t + h.phase) / h.period) * TAU * h.spin; return [h.px, h.py, h.px + Math.cos(a) * h.len, h.py + Math.sin(a) * h.len]; }
  return [h.ax, h.ay, h.bx, h.by];
}

export function spikesOn(h: Extract<Hazard, { k: "spikes" }>, t: number) { return h.period <= 0 || cyc(t, h.period, h.phase) < h.duty; }
export function spikesSoon(h: Extract<Hazard, { k: "spikes" }>, t: number) { return h.period > 0 && cyc(t, h.period, h.phase) > 1 - 20 / h.period; }
/** spike rectangle in front of a wall face: [x, y, w, h] */
export function spikeRect(cx: number, cy: number, n: Dir, depth = 3): [number, number, number, number] {
  const x0 = cx * U, y0 = cy * U;
  switch (n) {
    case 0: return [x0 + 0.5, y0 + U, U - 1, depth];
    case 2: return [x0 + 0.5, y0 - depth, U - 1, depth];
    case 1: return [x0 + U, y0 + 0.5, depth, U - 1];
    case 3: return [x0 - depth, y0 + 0.5, depth, U - 1];
  }
}

/** crusher slam amount 0…1 (rest · slam · hold · retract) */
export function crushK(h: { period: number; phase: number }, t: number) {
  const u = cyc(t, h.period, h.phase);
  if (u < 0.42) return 0;
  if (u < 0.52) return (u - 0.42) / 0.1;
  if (u < 0.72) return 1;
  return 1 - (u - 0.72) / 0.28;
}
/** crusher about to slam (warning) */
export const crushSoon = (h: { period: number; phase: number }, t: number) => { const u = cyc(t, h.period, h.phase); return u > 0.3 && u < 0.42; };
export function crushRect(h: Extract<Hazard, { k: "crusher" }>, t: number): [number, number, number, number] {
  const k = crushK(h, t);
  return [h.x + h.ex * k, h.y + h.ey * k, h.w, h.h];
}

/** live turret shots: [x, y] centres */
export function shots(h: Extract<Hazard, { k: "turret" }>, t: number, out: number[] = []): number[] {
  out.length = 0;
  const ox = (h.cx + 0.5) * U + DX[h.n] * U * 0.5, oy = (h.cy + 0.5) * U + DY[h.n] * U * 0.5;
  const life = h.range / h.speed;
  const k1 = Math.floor((t + h.phase) / h.period);
  for (let k = k1; k >= 0; k--) {
    const age = t + h.phase - k * h.period;
    if (age > life) break;
    if (k * h.period - h.phase < 0) continue; // fired before the room woke up
    const d = age * h.speed;
    out.push(ox + DX[h.n] * d, oy + DY[h.n] * d);
  }
  return out;
}
/** turret charging (flash before a shot) */
export const turretCharge = (h: Extract<Hazard, { k: "turret" }>, t: number) => { const u = cyc(t, h.period, h.phase); return u > 1 - 18 / h.period ? (u - (1 - 18 / h.period)) / (18 / h.period) : 0; };

export function moverPos(h: Extract<Hazard, { k: "mover" }>, t: number): [number, number] {
  switch (h.path) {
    case "static": return [h.x, h.y];
    case "line": { const k = 0.5 - 0.5 * Math.cos(cyc(t, h.period, h.phase) * TAU); return [h.x + h.ex * k, h.y + h.ey * k]; }
    case "orbit": { const a = cyc(t, h.period, h.phase) * TAU * h.dir; return [h.x + Math.cos(a) * h.rad, h.y + Math.sin(a) * h.rad * (h.amp || 1)]; }
    case "pendulum": { const a = Math.sin(cyc(t, h.period, h.phase) * TAU) * h.amp; return [h.x + Math.sin(a) * h.rad, h.y - Math.cos(a) * h.rad]; }
  }
}

export function pulseState(h: Extract<Hazard, { k: "pulse" }>, t: number): 0 | 1 | 2 {
  const u = cyc(t, h.period, h.phase) * h.period;
  if (u < h.duty * h.period) return 2;
  if (u > h.period - h.warn) return 1;
  return 0;
}

export const floodY = (h: Extract<Hazard, { k: "flood" }>, t: number) => h.y0 + Math.max(0, t - h.delay) * h.rate;

// ---------------------------------------------------------------- collision
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
  const dx = px - (ax + vx * k), dy = py - (ay + vy * k);
  return Math.sqrt(dx * dx + dy * dy);
}
function circleRect(px: number, py: number, r: number, x: number, y: number, w: number, h: number) {
  const qx = Math.max(x, Math.min(x + w, px)), qy = Math.max(y, Math.min(y + h, py));
  const dx = px - qx, dy = py - qy;
  return dx * dx + dy * dy < r * r;
}
const tmp: number[] = [];

/**
 * Does the runner circle at (px, py) touch hazard h at local tick t? `m` grows every hazard (the solver's safety margin;
 * negative = forgiveness in the game). `switched` = the room's switch is pressed.
 */
export function hits(h: Hazard, t: number, px: number, py: number, m: number, switched: boolean): boolean {
  if (h.off && switched) return false;
  const r = R_RUN + m;
  switch (h.k) {
    case "laser": {
      if (!laserOn(h, t)) return false;
      let ax = h.ax, ay = h.ay, bx = h.bx, by = h.by;
      if (h.mode === "sweep") { const k = tri((t + h.phase) / h.period); ax += h.sx * k; bx += h.sx * k; ay += h.sy * k; by += h.sy * k; }
      else if (h.mode === "spin") { const a = ((t + h.phase) / h.period) * TAU * h.spin; ax = h.px; ay = h.py; bx = h.px + Math.cos(a) * h.len; by = h.py + Math.sin(a) * h.len; }
      return segDist(px, py, ax, ay, bx, by) < r + h.w;
    }
    case "spikes": {
      if (!spikesOn(h, t)) return false;
      for (const f of h.faces) { const [x, y, w, hh] = spikeRect(f.cx, f.cy, f.n); if (circleRect(px, py, r, x, y, w, hh)) return true; }
      return false;
    }
    case "crusher": { const k = crushK(h, t); return circleRect(px, py, r, h.x + h.ex * k, h.y + h.ey * k, h.w, h.h); }
    case "turret": {
      const s = shots(h, t, tmp), half = h.size / 2;
      for (let i = 0; i < s.length; i += 2) if (circleRect(px, py, r, s[i] - half, s[i + 1] - half, h.size, h.size)) return true;
      return false;
    }
    case "mover": { const [x, y] = moverPos(h, t); const dx = px - x, dy = py - y, rr = r + h.r; return dx * dx + dy * dy < rr * rr; }
    case "pulse": return pulseState(h, t) === 2 && circleRect(px, py, r, h.x, h.y, h.w, h.h);
    case "flood": return py < floodY(h, t) + m;
  }
}

/** how close the runner is to danger (for near-miss juice): true when within `extra` units of a live hazard */
export function nearHazard(hz: Hazard[], t: number, px: number, py: number, switched: boolean, extra = 3) {
  for (const h of hz) if (h.k !== "flood" && hits(h, t, px, py, extra, switched)) return true;
  return false;
}

/** the hazard periods (every one divides T_FOLD) */
export function periodsOf(h: Hazard): number[] {
  switch (h.k) {
    case "laser": return h.mode === "static" ? [] : [h.period];
    case "spikes": return h.period > 0 ? [h.period] : [];
    case "crusher": case "turret": case "pulse": return [h.period];
    case "mover": return h.path === "static" ? [] : [h.period];
    case "flood": return [];
  }
}

/** the area a hazard can ever reach (x0, y0, x1, y1) — lets the solver skip far-away hazards cheaply */
export function hazardBox(h: Hazard, roomH: number): [number, number, number, number] {
  switch (h.k) {
    case "laser": {
      if (h.mode === "spin") return [h.px - h.len, h.py - h.len, h.px + h.len, h.py + h.len];
      const x0 = Math.min(h.ax, h.bx) - Math.abs(h.sx), x1 = Math.max(h.ax, h.bx) + Math.abs(h.sx);
      const y0 = Math.min(h.ay, h.by) - Math.abs(h.sy), y1 = Math.max(h.ay, h.by) + Math.abs(h.sy);
      return [x0 - h.w, y0 - h.w, x1 + h.w, y1 + h.w];
    }
    case "spikes": {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const f of h.faces) { const [x, y, w, hh] = spikeRect(f.cx, f.cy, f.n); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + hh); }
      return [x0, y0, x1, y1];
    }
    case "crusher": return [Math.min(h.x, h.x + h.ex), Math.min(h.y, h.y + h.ey), Math.max(h.x, h.x + h.ex) + h.w, Math.max(h.y, h.y + h.ey) + h.h];
    case "turret": {
      const ox = (h.cx + 0.5) * U + DX[h.n] * U * 0.5, oy = (h.cy + 0.5) * U + DY[h.n] * U * 0.5;
      const ex = ox + DX[h.n] * h.range, ey = oy + DY[h.n] * h.range, s = h.size;
      return [Math.min(ox, ex) - s, Math.min(oy, ey) - s, Math.max(ox, ex) + s, Math.max(oy, ey) + s];
    }
    case "mover": {
      const r = h.r;
      if (h.path === "static") return [h.x - r, h.y - r, h.x + r, h.y + r];
      if (h.path === "line") return [Math.min(h.x, h.x + h.ex) - r, Math.min(h.y, h.y + h.ey) - r, Math.max(h.x, h.x + h.ex) + r, Math.max(h.y, h.y + h.ey) + r];
      return [h.x - h.rad - r, h.y - h.rad - r, h.x + h.rad + r, h.y + h.rad + r];
    }
    case "pulse": return [h.x, h.y, h.x + h.w, h.y + h.h];
    case "flood": return [-1e9, -1e9, 1e9, roomH * U + 1e9];
  }
}
