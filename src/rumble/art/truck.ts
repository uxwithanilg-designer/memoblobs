// The monster trucks and their drivers, drawn from the physics every frame (world space: metres, y up).
//  - Huge lugged tyres that spin with the wheels, spoked rims with a coloured hub, coil-over shocks and arms that
//    stretch and squash with the real suspension.
//  - Five builds, each with its own ram up front: Brawler's steel push bar, Hornet's hazard wedge, Rhino's horn and
//    plough, Viper's fanged splitter, Titan's golden crown plough — and its own paint: racing stripes, a lightning bolt,
//    tiger stripes, flames, a crown with a checkered band. Rivals drive the same builds in their own colours.
//  - A rocket pod on the deck (it shows how many rockets are loaded), a nitro tank with a blue flame when it burns,
//    exhaust stacks, a roof light bar, headlights at night, a shield bubble when one is on.
//  - The drivers: Ziggy, a fox racer in a helmet with the visor up, and the rivals in their own helmets, all with
//    faces that grin, gasp, grit their teeth when hit, spin dizzily and cheer.
//  - Rockets in flight: a finned body with a flame and a smoke trail.
import type { Truck } from "../physics";
import type { TruckSpec } from "../trucks";
import { mix, rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
export type Mood = "happy" | "wow" | "scared" | "dizzy" | "cheer" | "angry";
export interface Driver { face: string; hat: string; fox: boolean }
export interface TruckFx { mood: Mood; blink: boolean; gas: number; brake: number; t: number; nitro: boolean; shield: number; night: number; light: string; ammo: number; hurt: number }

const ell = (c: C, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function vg(c: C, y0: number, y1: number, a: string, b: string) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

// ---------------------------------------------------------------- wheels
function wheel(c: C, x: number, y: number, r: number, spin: number, col: TruckSpec["colors"]) {
  c.save(); c.translate(x, y); c.rotate(spin);
  c.fillStyle = col.tire;
  c.beginPath(); c.arc(0, 0, r * 0.9, 0, Math.PI * 2); c.fill();
  // deep paddle lugs
  const lugs = 16;
  for (let k = 0; k < lugs; k++) {
    c.rotate((Math.PI * 2) / lugs);
    c.beginPath(); c.moveTo(r * 0.82, -r * 0.13); c.lineTo(r, -r * 0.1); c.lineTo(r * 1.0, r * 0.06); c.lineTo(r * 0.82, r * 0.12); c.closePath(); c.fill();
  }
  c.fillStyle = shade(col.tire, 0.1); c.beginPath(); c.arc(0, 0, r * 0.78, 0, Math.PI * 2); c.fill();
  c.strokeStyle = shade(col.tire, 0.22); c.lineWidth = r * 0.025;
  for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(r * 0.64, 0); c.lineTo(r * 0.76, r * 0.05); c.stroke(); }
  // the rim: a dished wheel with five spokes and bolts
  c.fillStyle = shade(col.rim, -0.3); c.beginPath(); c.arc(0, 0, r * 0.58, 0, Math.PI * 2); c.fill();
  c.fillStyle = col.rim; c.beginPath(); c.arc(0, 0, r * 0.52, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(col.rim, -0.4);
  for (let k = 0; k < 5; k++) { c.rotate((Math.PI * 2) / 5); c.beginPath(); c.moveTo(r * 0.16, -r * 0.09); c.lineTo(r * 0.46, -r * 0.15); c.lineTo(r * 0.46, r * 0.15); c.lineTo(r * 0.16, r * 0.09); c.closePath(); c.fill(); }
  c.fillStyle = col.accent; c.beginPath(); c.arc(0, 0, r * 0.18, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(col.accent, -0.35);
  for (let k = 0; k < 5; k++) { c.rotate((Math.PI * 2) / 5); c.beginPath(); c.arc(r * 0.11, 0, r * 0.025, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.13)"; c.lineWidth = r * 0.06; c.beginPath(); c.arc(x, y, r * 0.86, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
}

function shock(c: C, ax: number, ay: number, bx: number, by: number, col: string, spring: string, r: number) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  c.lineCap = "round";
  c.strokeStyle = col; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  c.strokeStyle = spring; c.lineWidth = r * 0.06; c.beginPath();
  const coils = 7, w = r * 0.16;
  for (let k = 0; k <= coils * 2; k++) { const u = 0.15 + (0.7 * k) / (coils * 2), s = k % 2 ? w : -w; c.lineTo(ax + dx * u + nx * s, ay + dy * u + ny * s); }
  c.stroke();
}

// ---------------------------------------------------------------- drivers
function driver(c: C, x: number, y: number, d: Driver, fx: TruckFx, visor: string) {
  c.save(); c.translate(x, y);
  const bounce = fx.mood === "cheer" ? Math.abs(Math.sin(fx.t * 9)) * 0.05 : fx.mood === "angry" ? Math.sin(fx.t * 40) * 0.01 : 0;
  c.translate(0, bounce);
  // shoulders in a racing suit, an arm on the wheel (or up in a fist)
  ell(c, 0, -0.1, 0.24, 0.2, d.hat);
  ell(c, 0.05, -0.04, 0.06, 0.12, rgba("#FFFFFF", 0.5));
  c.strokeStyle = d.hat; c.lineWidth = 0.08; c.lineCap = "round";
  if (fx.mood === "cheer") { c.beginPath(); c.moveTo(0.1, -0.02); c.lineTo(0.24, 0.34); c.stroke(); ell(c, 0.25, 0.37, 0.05, 0.05, d.face); }
  else { c.beginPath(); c.moveTo(0.1, -0.04); c.lineTo(0.32, 0.03); c.stroke(); }
  const skin = d.face, hi = shade(skin, 0.25);
  if (d.fox) {
    // Ziggy: a fox, ears poking out of the helmet, a white muzzle
    c.fillStyle = skin; c.beginPath(); c.moveTo(-0.14, 0.38); c.lineTo(-0.2, 0.62); c.lineTo(-0.04, 0.46); c.fill();
    c.beginPath(); c.moveTo(0.06, 0.44); c.lineTo(0.1, 0.66); c.lineTo(0.2, 0.42); c.fill();
    ell(c, 0.02, 0.24, 0.22, 0.2, skin);
    c.fillStyle = "#FFF4E8"; c.beginPath(); c.moveTo(0.06, 0.24); c.quadraticCurveTo(0.2, 0.3, 0.34, 0.2); c.quadraticCurveTo(0.2, 0.06, 0.04, 0.12); c.closePath(); c.fill();
    ell(c, 0.34, 0.21, 0.035, 0.03, "#2A1A1A");
  } else {
    ell(c, 0.03, 0.24, 0.22, 0.21, skin);
    ell(c, 0.2, 0.2, 0.07, 0.06, hi);
    ell(c, 0.25, 0.21, 0.025, 0.02, shade(skin, -0.4));
  }
  // eyes
  const blink = fx.blink && fx.mood !== "dizzy";
  if (fx.mood === "dizzy") { c.strokeStyle = "#1A1420"; c.lineWidth = 0.022; c.beginPath(); c.arc(0.12, 0.27, 0.035, 0, Math.PI * 1.6); c.stroke(); }
  else if (blink) { c.strokeStyle = "#1A1420"; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0.08, 0.27); c.lineTo(0.15, 0.27); c.stroke(); }
  else {
    const big = fx.mood === "wow" || fx.mood === "scared" ? 1.35 : 1;
    ell(c, 0.12, 0.27, 0.04 * big, 0.05 * big, "#FFFFFF"); ell(c, 0.135, 0.27, 0.022 * big, 0.03 * big, "#1A1420"); ell(c, 0.14, 0.285, 0.008 * big, 0.01 * big, "#FFFFFF");
    if (fx.mood === "angry") { c.strokeStyle = "#1A1420"; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0.07, 0.34); c.lineTo(0.17, 0.31); c.stroke(); }
  }
  // mouth
  c.strokeStyle = "#3A1A22"; c.lineWidth = 0.022; c.beginPath();
  if (fx.mood === "scared" || fx.mood === "wow") ell(c, 0.18, 0.12, 0.035, 0.03, "#3A1A22");
  else if (fx.mood === "dizzy") { c.moveTo(0.1, 0.12); c.quadraticCurveTo(0.15, 0.15, 0.2, 0.11); c.stroke(); }
  else if (fx.mood === "angry") { c.fillStyle = "#FFFFFF"; c.fillRect(0.1, 0.1, 0.1, 0.035); c.strokeRect(0.1, 0.1, 0.1, 0.035); }
  else { c.moveTo(0.08, 0.14); c.quadraticCurveTo(0.15, 0.07, 0.22, 0.13); c.stroke(); }
  // the helmet: a dome in the driver's colour, a stripe, the visor flipped up
  c.fillStyle = d.hat; c.beginPath(); c.ellipse(0.0, 0.32, 0.25, 0.2, 0, Math.PI * 1.02, Math.PI * 0.02, false); c.fill();
  c.fillRect(-0.25, 0.26, 0.08, 0.1);
  c.fillStyle = rgba("#FFFFFF", 0.7); c.beginPath(); c.ellipse(0.0, 0.33, 0.25, 0.2, 0, Math.PI * 1.35, Math.PI * 1.65); c.lineTo(0, 0.33); c.fill();
  c.fillStyle = visor; c.beginPath(); c.ellipse(0.06, 0.46, 0.2, 0.06, -0.15, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(-0.04, 0.47, 0.12, 0.02);
  if (fx.mood === "scared") ell(c, -0.12, 0.2, 0.025, 0.04, "#7CC8FF");
  c.restore();
}

// ---------------------------------------------------------------- body
interface Geo { s: TruckSpec; col: TruckSpec["colors"] }

/** the ram on the truck's nose: each build has its own */
function ram(c: C, g: Geo) {
  const b = g.s.body, col = g.col, id = g.s.id, x = b.x1, steel = vg(c, b.y1, b.y0 - 0.2, "#E8ECF4", "#7A8090");
  switch (id) {
    case "brawler": {
      c.fillStyle = steel;
      for (const y of [b.y0 - 0.1, b.y0 + 0.22, b.y1 - 0.12]) { rr(c, x - 0.1, y, 0.42, 0.1, 0.04); c.fill(); }
      rr(c, x + 0.22, b.y0 - 0.18, 0.12, b.y1 - b.y0 + 0.12, 0.05); c.fill();
      c.fillStyle = col.accent; c.fillRect(x + 0.24, b.y0 + 0.02, 0.08, 0.12);
      return;
    }
    case "hornet": {
      c.fillStyle = "#1A1A22"; c.beginPath(); c.moveTo(x - 0.05, b.y1 - 0.05); c.lineTo(x + 0.55, b.y0 - 0.05); c.lineTo(x - 0.05, b.y0 - 0.2); c.closePath(); c.fill();
      c.save(); c.clip(); c.fillStyle = "#FFD23F";
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x - 0.2 + k * 0.16, b.y0 - 0.3); c.lineTo(x - 0.12 + k * 0.16, b.y0 - 0.3); c.lineTo(x - 0.4 + k * 0.16, b.y1); c.lineTo(x - 0.48 + k * 0.16, b.y1); c.closePath(); c.fill(); }
      c.restore();
      return;
    }
    case "rhino": {
      c.fillStyle = steel; c.beginPath(); c.moveTo(x - 0.05, b.y1 - 0.05); c.lineTo(x + 0.3, b.y1 - 0.2); c.lineTo(x + 0.42, b.y0 - 0.2); c.lineTo(x - 0.05, b.y0 - 0.2); c.closePath(); c.fill();
      c.strokeStyle = "rgba(40,40,50,0.4)"; c.lineWidth = 0.03; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, b.y0 - 0.1 + k * 0.2); c.lineTo(x + 0.36, b.y0 - 0.12 + k * 0.17); c.stroke(); }
      // the horn
      c.fillStyle = "#F2EAD8"; c.beginPath(); c.moveTo(x + 0.05, b.y1 - 0.15); c.quadraticCurveTo(x + 0.55, b.y1 - 0.1, x + 0.68, b.y1 + 0.42); c.quadraticCurveTo(x + 0.4, b.y1 + 0.05, x + 0.05, b.y1 + 0.05); c.closePath(); c.fill();
      c.strokeStyle = "rgba(120,100,70,0.5)"; c.lineWidth = 0.02; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + 0.1 * k + 0.05, b.y1 - 0.12 + k * 0.02); c.lineTo(x + 0.1 * k + 0.02, b.y1 + 0.04 + k * 0.04); c.stroke(); }
      return;
    }
    case "viper": {
      c.fillStyle = shade(col.trim, 0.1); c.beginPath(); c.moveTo(x - 0.05, b.y1 - 0.1); c.lineTo(x + 0.62, b.y0 + 0.02); c.lineTo(x + 0.1, b.y0 - 0.18); c.lineTo(x - 0.05, b.y0 - 0.18); c.closePath(); c.fill();
      c.fillStyle = "#F4F4F8"; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 0.08 + k * 0.15, b.y0 + 0.02 - k * 0.0); c.lineTo(x + 0.13 + k * 0.15, b.y0 - 0.14); c.lineTo(x + 0.2 + k * 0.15, b.y0 + 0.0); c.closePath(); c.fill(); }
      c.fillStyle = col.accent; c.beginPath(); c.moveTo(x + 0.05, b.y1 - 0.14); c.lineTo(x + 0.45, b.y0 + 0.1); c.lineTo(x + 0.4, b.y0 + 0.06); c.lineTo(x + 0.02, b.y1 - 0.2); c.closePath(); c.fill();
      return;
    }
    case "titan": {
      c.fillStyle = vg(c, b.y1, b.y0 - 0.2, "#FFE9A0", "#C8922A"); c.beginPath(); c.moveTo(x - 0.05, b.y1); c.lineTo(x + 0.38, b.y1 - 0.08); c.lineTo(x + 0.46, b.y0 - 0.2); c.lineTo(x - 0.05, b.y0 - 0.2); c.closePath(); c.fill();
      c.fillStyle = "#FFE08A"; for (let k = 0; k < 3; k++) { const yy = b.y0 - 0.05 + k * 0.22; c.beginPath(); c.moveTo(x + 0.4, yy); c.lineTo(x + 0.66, yy + 0.06); c.lineTo(x + 0.4, yy + 0.13); c.closePath(); c.fill(); }
      c.fillStyle = col.accent; ell(c, x + 0.18, (b.y0 + b.y1) / 2, 0.08, 0.08, col.accent);
      return;
    }
  }
}

/** the paint job */
function livery(c: C, g: Geo, fx: TruckFx) {
  const b = g.s.body, col = g.col, cb = g.s.cab;
  switch (g.s.style) {
    case "stripes": c.fillStyle = col.accent; c.fillRect(b.x0 + 0.1, b.y0 + 0.22, b.x1 - b.x0 - 0.2, 0.08); c.fillRect(b.x0 + 0.1, b.y0 + 0.36, b.x1 - b.x0 - 0.2, 0.04); return;
    case "bolt": {
      c.fillStyle = col.accent; c.beginPath();
      const m = (cb.x1 + b.x1) / 2 - 0.4;
      c.moveTo(b.x0 + 0.1, b.y0 + 0.36); c.lineTo(m - 0.3, b.y0 + 0.36); c.lineTo(m - 0.45, b.y0 + 0.14); c.lineTo(b.x1 - 0.1, b.y0 + 0.24); c.lineTo(m - 0.1, b.y0 + 0.24); c.lineTo(m + 0.05, b.y0 + 0.46); c.lineTo(b.x0 + 0.1, b.y0 + 0.46); c.closePath(); c.fill();
      return;
    }
    case "tiger": {
      c.fillStyle = col.trim;
      for (let k = 0; k < 6; k++) { const x0 = b.x0 + 0.3 + k * 0.6; c.beginPath(); c.moveTo(x0, b.y1); c.quadraticCurveTo(x0 + 0.12, b.y0 + 0.4, x0 - 0.05, b.y0 + 0.1); c.lineTo(x0 + 0.08, b.y0 + 0.3); c.quadraticCurveTo(x0 + 0.24, b.y0 + 0.5, x0 + 0.16, b.y1); c.closePath(); c.fill(); }
      return;
    }
    case "flames": {
      const flick = Math.sin(fx.t * 12) * 0.02;
      for (const [cl, s] of [[col.accent, 1], [col.glow, 0.6]] as const) {
        c.fillStyle = cl; c.beginPath(); c.moveTo(b.x1 - 0.05, b.y0 + 0.08); c.lineTo(b.x1 - 0.05, b.y0 + 0.4 * s + 0.08);
        for (let k = 0; k < 5; k++) { const x0 = b.x1 - 0.5 - k * 0.45; c.quadraticCurveTo(x0 + 0.2, b.y0 + 0.5 * s + 0.1, x0 - 0.15 * s, b.y0 + (0.42 + (k % 2) * 0.12) * s + flick + 0.08); c.quadraticCurveTo(x0 + 0.05, b.y0 + 0.28 * s + 0.08, x0 - 0.05, b.y0 + 0.2 * s + 0.08); }
        c.lineTo(b.x1 - 2.6, b.y0 + 0.08); c.closePath(); c.fill();
      }
      return;
    }
    case "crown": {
      for (let k = 0; k < 12; k++) for (let q = 0; q < 2; q++) { c.fillStyle = (k + q) % 2 ? col.trim : "#FFF6D8"; c.fillRect(b.x0 + 0.1 + k * 0.28, b.y0 + 0.08 + q * 0.1, 0.28, 0.1); }
      const cx = (b.x0 + cb.x0) / 2 + 0.1, cy = b.y0 + 0.44;
      c.fillStyle = col.accent; c.beginPath(); c.moveTo(cx - 0.22, cy - 0.08); c.lineTo(cx - 0.22, cy + 0.1); c.lineTo(cx - 0.11, cy + 0.02); c.lineTo(cx, cy + 0.14); c.lineTo(cx + 0.11, cy + 0.02); c.lineTo(cx + 0.22, cy + 0.1); c.lineTo(cx + 0.22, cy - 0.08); c.closePath(); c.fill();
      return;
    }
  }
}

function body(c: C, g: Geo, fx: TruckFx, d: Driver) {
  const s = g.s, col = g.col, b = s.body, cb = s.cab;
  // the chassis frame under the body
  c.fillStyle = col.trim; rr(c, b.x0 + 0.2, b.y0 - 0.22, b.x1 - b.x0 - 0.4, 0.2, 0.05); c.fill();
  // nitro tank on the deck and its nozzle out the back
  c.fillStyle = vg(c, b.y1 + 0.3, b.y1, "#D8E8FF", "#6A80A8"); rr(c, b.x0 + 0.1, b.y1 - 0.02, 0.75, 0.26, 0.12); c.fill();
  c.fillStyle = "#3EF0FF"; c.fillRect(b.x0 + 0.2, b.y1 + 0.08, 0.5, 0.05);
  c.fillStyle = "#3A3E52"; rr(c, b.x0 - 0.22, b.y0 + 0.12, 0.26, 0.16, 0.04); c.fill();
  // the rocket pod behind the cab: a launcher box with a tip showing for each rocket loaded
  const px0 = b.x0 + 0.95, px1 = cb.x0 - 0.08, py = b.y1 - 0.02;
  c.fillStyle = shade(col.trim, 0.15); rr(c, px0, py, px1 - px0, 0.32, 0.05); c.fill();
  const tubes = Math.max(2, Math.min(4, s.rockets));
  for (let k = 0; k < tubes; k++) {
    const tx = px1 + 0.02, ty = py + 0.06 + (k % 2) * 0.13, loaded = k < fx.ammo;
    c.fillStyle = "#14151E"; c.beginPath(); c.arc(tx - 0.02, ty + 0.05, 0.055, 0, Math.PI * 2); c.fill();
    if (loaded) { c.fillStyle = "#FF4A3A"; c.beginPath(); c.moveTo(tx - 0.04, ty + 0.01); c.lineTo(tx + 0.08, ty + 0.05); c.lineTo(tx - 0.04, ty + 0.09); c.closePath(); c.fill(); }
  }
  c.fillStyle = col.accent; c.fillRect(px0 + 0.05, py + 0.25, px1 - px0 - 0.1, 0.04);
  // exhaust stacks
  const chrome = vg(c, cb.roof + 0.4, b.y1, "#F2F4F8", "#8A90A0");
  c.fillStyle = chrome; c.fillRect(cb.x0 - 0.1, b.y1, 0.09, cb.roof - b.y1 + 0.32);
  c.fillStyle = "#3A3D4A"; c.fillRect(cb.x0 - 0.11, cb.roof + 0.3, 0.11, 0.05);
  // the shell: deck, cab with a raked windscreen, a short hood
  c.beginPath();
  c.moveTo(b.x0, b.y0 + 0.06);
  c.lineTo(b.x0, b.y1 - 0.06); c.quadraticCurveTo(b.x0, b.y1, b.x0 + 0.08, b.y1);
  c.lineTo(cb.x0, b.y1); c.lineTo(cb.x0, cb.roof - 0.1); c.quadraticCurveTo(cb.x0, cb.roof, cb.x0 + 0.12, cb.roof);
  c.lineTo(cb.x1 - 0.36, cb.roof); c.quadraticCurveTo(cb.x1 - 0.24, cb.roof, cb.x1 - 0.18, cb.roof - 0.1);
  c.lineTo(cb.x1, b.y1 + 0.02);
  c.lineTo(b.x1 - 0.12, b.y1 - 0.04); c.quadraticCurveTo(b.x1, b.y1 - 0.04, b.x1, b.y1 - 0.16);
  c.lineTo(b.x1, b.y0 + 0.06); c.quadraticCurveTo(b.x1, b.y0, b.x1 - 0.08, b.y0);
  c.lineTo(b.x0 + 0.08, b.y0); c.quadraticCurveTo(b.x0, b.y0, b.x0, b.y0 + 0.06);
  c.closePath();
  c.fillStyle = vg(c, cb.roof, b.y0, shade(col.body, 0.16), shade(col.body, -0.24)); c.fill();
  c.save(); c.clip(); livery(c, g, fx); c.restore();
  if (fx.hurt > 0) { c.fillStyle = rgba("#FFFFFF", fx.hurt * 0.6); c.fill(); }
  // shine along the top edges
  c.strokeStyle = "rgba(255,255,255,0.38)"; c.lineWidth = 0.04;
  c.beginPath(); c.moveTo(cb.x0 + 0.12, cb.roof - 0.05); c.lineTo(cb.x1 - 0.38, cb.roof - 0.05); c.moveTo(cb.x1 + 0.05, b.y1 - 0.03); c.lineTo(b.x1 - 0.16, b.y1 - 0.08); c.moveTo(b.x0 + 0.1, b.y1 - 0.04); c.lineTo(cb.x0 - 0.05, b.y1 - 0.04); c.stroke();
  // the window with the driver
  const wx0 = cb.x0 + 0.12, wx1 = cb.x1 - 0.14, wy0 = b.y1 + 0.04, wy1 = cb.roof - 0.1;
  c.save();
  c.beginPath(); c.moveTo(wx0, wy0); c.lineTo(wx0, wy1); c.lineTo(wx1 - 0.26, wy1); c.lineTo(wx1, wy0); c.closePath();
  c.fillStyle = mix("#22304A", fx.light, 0.15); c.fill();
  c.clip();
  driver(c, (wx0 + wx1) / 2 - 0.14, wy0 + 0.02, d, fx, d.fox ? "#5ADCFF" : shade(d.hat, 0.35));
  c.fillStyle = "rgba(200,235,255,0.2)"; c.beginPath(); c.moveTo(wx0 + 0.3, wy1); c.lineTo(wx0 + 0.5, wy1); c.lineTo(wx0 + 0.2, wy0); c.lineTo(wx0, wy0); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = shade(col.body, -0.4); c.lineWidth = 0.035;
  c.beginPath(); c.moveTo(wx0, wy0); c.lineTo(wx0, wy1); c.lineTo(wx1 - 0.26, wy1); c.lineTo(wx1, wy0); c.closePath(); c.stroke();
  // a racing number on the door
  c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(cb.x0 + 0.42, b.y0 + 0.3, 0.17, 0, Math.PI * 2); c.fill();
  c.fillStyle = col.trim; c.beginPath(); c.arc(cb.x0 + 0.42, b.y0 + 0.3, 0.13, 0, Math.PI * 2); c.fill();
  c.fillStyle = col.accent; c.fillRect(cb.x0 + 0.39, b.y0 + 0.2, 0.06, 0.2);
  // roof light bar, flashing when the nitro burns
  c.fillStyle = col.trim; c.fillRect(cb.x0 + 0.16, cb.roof, cb.x1 - cb.x0 - 0.62, 0.05);
  const lit = fx.night > 0.25;
  for (let k = 0; k < 4; k++) ell(c, cb.x0 + 0.24 + k * 0.15, cb.roof + 0.08, 0.055, 0.045, fx.nitro && (Math.floor(fx.t * 12) + k) % 2 ? "#5AF0FF" : lit ? "#FFF3B0" : col.glow);
  // headlight, tail light
  ell(c, b.x1 - 0.06, b.y1 - 0.18, 0.06, 0.08, lit ? "#FFF6C8" : "#EAF2FF");
  if (lit) {
    const gx = c.createLinearGradient(b.x1, 0, b.x1 + 7, 0);
    gx.addColorStop(0, "rgba(255,244,200,0.35)"); gx.addColorStop(1, "rgba(255,244,200,0)");
    c.fillStyle = gx; c.beginPath(); c.moveTo(b.x1, b.y1 - 0.12); c.lineTo(b.x1 + 7, b.y1 + 0.8); c.lineTo(b.x1 + 7, b.y1 - 2.4); c.lineTo(b.x1, b.y1 - 0.26); c.closePath(); c.fill();
  }
  ell(c, b.x0 + 0.03, b.y1 - 0.16, 0.04, 0.07, fx.brake > 0 ? "#FF2A3A" : "#B0202A");
  if (fx.brake > 0) ell(c, b.x0 - 0.05, b.y1 - 0.16, 0.2, 0.2, "rgba(255,40,60,0.25)");
  ram(c, g);
}

// ---------------------------------------------------------------- the whole truck
const tmp = { x: 0, y: 0 };

/** the nitro flame out of the back nozzle (chassis space) */
function flame(c: C, g: Geo, t: number) {
  const b = g.s.body, y = b.y0 + 0.2, x = b.x0 - 0.2, L = 1.4 + Math.sin(t * 50) * 0.2 + Math.sin(t * 31) * 0.15;
  c.fillStyle = "rgba(90,220,255,0.35)"; c.beginPath(); c.moveTo(x, y + 0.2); c.quadraticCurveTo(x - L * 0.6, y + 0.25, x - L * 1.25, y); c.quadraticCurveTo(x - L * 0.6, y - 0.25, x, y - 0.2); c.fill();
  c.fillStyle = "#5AE8FF"; c.beginPath(); c.moveTo(x, y + 0.11); c.quadraticCurveTo(x - L * 0.5, y + 0.14, x - L, y); c.quadraticCurveTo(x - L * 0.5, y - 0.14, x, y - 0.11); c.fill();
  c.fillStyle = "#F2FFFF"; c.beginPath(); c.moveTo(x, y + 0.05); c.quadraticCurveTo(x - L * 0.3, y + 0.06, x - L * 0.55, y); c.quadraticCurveTo(x - L * 0.3, y - 0.06, x, y - 0.05); c.fill();
}

export function drawTruck(c: C, tr: Truck, col: TruckSpec["colors"], d: Driver, fx: TruckFx) {
  const s = tr.spec, g: Geo = { s, col }, r = s.wheel.r;
  const ca = Math.cos(tr.a), sa = Math.sin(tr.a);
  // shocks and arms (behind the wheels, over the frame)
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = s.anchors[i];
    const px = tr.x + ax * ca - ay * sa, py = tr.y + ax * sa + ay * ca;
    c.strokeStyle = shade(col.trim, 0.1); c.lineWidth = r * 0.14; c.lineCap = "round";
    tr.toWorld(ax * 0.25, s.body.y0 - 0.15, tmp);
    c.beginPath(); c.moveTo(tmp.x, tmp.y); c.lineTo(tr.wx[i], tr.wy[i]); c.stroke();
    shock(c, px, py + 0.25, tr.wx[i], tr.wy[i], "#5A5E70", col.accent, r);
  }
  // the body (chassis space)
  c.save(); c.translate(tr.x, tr.y); c.rotate(tr.a);
  if (fx.nitro) flame(c, g, fx.t);
  body(c, g, fx, d);
  c.restore();
  // wheels on top: the near side
  for (let i = 0; i < 2; i++) wheel(c, tr.wx[i], tr.wy[i], r, tr.spin[i], col);
  // fender flares over the wheel tops
  c.save(); c.translate(tr.x, tr.y); c.rotate(tr.a);
  for (let i = 0; i < 2; i++) {
    const [ax] = s.anchors[i];
    c.fillStyle = shade(col.body, -0.15);
    c.beginPath(); c.moveTo(ax - r * 1.05, s.body.y0 + 0.02); c.quadraticCurveTo(ax, s.body.y0 + 0.36, ax + r * 1.05, s.body.y0 + 0.02); c.lineTo(ax + r * 0.9, s.body.y0 - 0.06); c.quadraticCurveTo(ax, s.body.y0 + 0.22, ax - r * 0.9, s.body.y0 - 0.06); c.closePath(); c.fill();
  }
  c.restore();
  // the shield bubble
  if (fx.shield > 0) {
    const cx = tr.x - sa * 0.3, cy = tr.y + ca * 0.3, a = Math.min(1, fx.shield);
    c.fillStyle = rgba("#9B7BFF", 0.12 * a); c.strokeStyle = rgba("#CFC0FF", (0.55 + 0.25 * Math.sin(fx.t * 6)) * a); c.lineWidth = 0.08;
    c.beginPath(); c.ellipse(cx, cy, 2.9, 2.0, tr.a, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = rgba("#FFFFFF", 0.35 * a); c.lineWidth = 0.05;
    c.beginPath(); c.ellipse(cx, cy, 2.9, 2.0, tr.a, Math.PI * 0.6 + fx.t, Math.PI * 0.9 + fx.t); c.stroke();
  }
}

/** a rocket in flight (world space), pointing along `a` */
export function drawRocket(c: C, x: number, y: number, a: number, t: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(a);
  // a fading streak of smoke behind it
  c.fillStyle = "rgba(235,235,245,0.18)"; c.beginPath(); c.moveTo(-0.3, 0.07); c.lineTo(-4.2, 0.3); c.lineTo(-4.2, -0.3); c.lineTo(-0.3, -0.07); c.closePath(); c.fill();
  c.fillStyle = "rgba(235,235,245,0.22)"; c.beginPath(); c.moveTo(-0.3, 0.05); c.lineTo(-2.2, 0.14); c.lineTo(-2.2, -0.14); c.lineTo(-0.3, -0.05); c.closePath(); c.fill();
  const L = 0.45 + Math.sin(t * 60) * 0.08;
  c.fillStyle = "rgba(255,180,80,0.45)"; c.beginPath(); c.moveTo(-0.3, 0.1); c.lineTo(-0.3 - L * 1.4, 0); c.lineTo(-0.3, -0.1); c.fill();
  c.fillStyle = "#FFE27A"; c.beginPath(); c.moveTo(-0.3, 0.06); c.lineTo(-0.3 - L, 0); c.lineTo(-0.3, -0.06); c.fill();
  c.fillStyle = "#F4F4F8"; c.beginPath(); c.moveTo(-0.32, 0.09); c.lineTo(0.22, 0.09); c.quadraticCurveTo(0.42, 0.05, 0.46, 0); c.quadraticCurveTo(0.42, -0.05, 0.22, -0.09); c.lineTo(-0.32, -0.09); c.closePath(); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(0.26, 0.085); c.quadraticCurveTo(0.42, 0.05, 0.46, 0); c.quadraticCurveTo(0.42, -0.05, 0.26, -0.085); c.closePath(); c.fill();
  c.fillRect(-0.05, -0.09, 0.06, 0.18);
  c.beginPath(); c.moveTo(-0.32, 0.09); c.lineTo(-0.42, 0.2); c.lineTo(-0.18, 0.09); c.moveTo(-0.32, -0.09); c.lineTo(-0.42, -0.2); c.lineTo(-0.18, -0.09); c.fill();
  c.restore();
}
