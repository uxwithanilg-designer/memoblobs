// The trucks, their driver and the load, drawn from the physics every frame (chassis space: metres, y up).
//  - Chunky tyres with rotating tread lugs, rims with spokes and a coloured hub; coil-over shocks and trailing arms
//    that stretch and squash with the real suspension.
//  - Four bodies: the Mudbug's rounded red pickup with a flame stripe, the Timberjaw's boxy forest hauler with tall
//    plank side boards, the Thunderhoof's purple giant with chrome stacks, and the Glowtail's white electric shell with
//    teal light strips.
//  - The bed is drawn in two halves so the load shows: the far wall behind the cargo, the near stakes and rail in front.
//  - Bodo, the driver: a round clay mole in a cap and goggles who grins, gasps, winces and cheers.
//  - The load: crates, melons, barrels, honey jars, giant eggs, clay vases, potions, logs, gifts, paper lanterns, fire
//    crystals and star orbs, each painted once into a sprite and drawn at its body's position and angle.
import { ABOARD, BROKEN, GONE, type Cargo, type Truck } from "../physics";
import { CARGO, type CargoKind } from "../cargo";
import type { TruckSpec } from "../trucks";
import { makeRng, mix, range, rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
export type Mood = "happy" | "wow" | "scared" | "dizzy" | "cheer";
export interface TruckFx { mood: Mood; blink: boolean; gas: number; brake: number; t: number; nitro: boolean; net: boolean; bubble: boolean; night: number; light: string }

const ell = (c: C, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function vg(c: C, y0: number, y1: number, a: string, b: string) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

// ---------------------------------------------------------------- wheels
function wheel(c: C, x: number, y: number, r: number, spin: number, col: TruckSpec["colors"], glow: boolean) {
  // tyre with lugs
  c.save(); c.translate(x, y); c.rotate(spin);
  c.fillStyle = col.tire;
  c.beginPath(); c.arc(0, 0, r * 0.94, 0, Math.PI * 2); c.fill();
  const lugs = 14;
  for (let k = 0; k < lugs; k++) {
    c.rotate((Math.PI * 2) / lugs);
    c.beginPath(); c.moveTo(r * 0.86, -r * 0.11); c.lineTo(r, -r * 0.08); c.lineTo(r, r * 0.1); c.lineTo(r * 0.86, r * 0.12); c.closePath(); c.fill();
  }
  // sidewall shading and a highlight
  c.fillStyle = shade(col.tire, 0.08); c.beginPath(); c.arc(0, 0, r * 0.8, 0, Math.PI * 2); c.fill();
  c.strokeStyle = shade(col.tire, 0.2); c.lineWidth = r * 0.03; c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.stroke();
  // rim and spokes
  c.fillStyle = shade(col.rim, -0.25); c.beginPath(); c.arc(0, 0, r * 0.56, 0, Math.PI * 2); c.fill();
  c.fillStyle = col.rim; c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(col.rim, -0.35);
  for (let k = 0; k < 6; k++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(r * 0.14, -r * 0.07); c.lineTo(r * 0.45, -r * 0.12); c.lineTo(r * 0.45, r * 0.12); c.lineTo(r * 0.14, r * 0.07); c.closePath(); c.fill(); }
  c.fillStyle = col.accent; c.beginPath(); c.arc(0, 0, r * 0.17, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(col.accent, -0.3); c.beginPath(); c.arc(0, 0, r * 0.08, 0, Math.PI * 2); c.fill();
  if (glow) { c.strokeStyle = rgba(col.accent, 0.9); c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, 0, r * 0.6, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  // a fixed top-left sheen (does not spin)
  c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = r * 0.06; c.beginPath(); c.arc(x, y, r * 0.88, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
}

/** a coil-over shock between two points (world space) */
function shock(c: C, ax: number, ay: number, bx: number, by: number, col: string, spring: string, r: number) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  c.lineCap = "round";
  c.strokeStyle = col; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  c.strokeStyle = spring; c.lineWidth = r * 0.06; c.beginPath();
  const coils = 7, w = r * 0.16;
  for (let k = 0; k <= coils * 2; k++) { const u = 0.15 + (0.7 * k) / (coils * 2), s = k % 2 ? w : -w; c.lineTo(ax + dx * u + nx * s, ay + dy * u + ny * s); }
  c.stroke();
}

// ---------------------------------------------------------------- Bodo
function bodo(c: C, x: number, y: number, fx: TruckFx, cap: string) {
  const skin = "#9A6A4E", skinHi = "#C08E6E";
  c.save(); c.translate(x, y);
  const bounce = fx.mood === "cheer" ? Math.abs(Math.sin(fx.t * 9)) * 0.05 : 0;
  c.translate(0, bounce);
  // body and arms on the wheel
  ell(c, 0, -0.08, 0.22, 0.2, "#3A6AD8");
  c.strokeStyle = skin; c.lineWidth = 0.07; c.lineCap = "round";
  if (fx.mood === "cheer") { c.beginPath(); c.moveTo(0.1, 0.0); c.lineTo(0.25, 0.32); c.stroke(); }
  else { c.beginPath(); c.moveTo(0.1, -0.02); c.lineTo(0.3, 0.04); c.stroke(); }
  // head
  ell(c, 0.04, 0.24, 0.23, 0.21, skin);
  ell(c, 0.0, 0.3, 0.1, 0.07, rgba(skinHi, 0.6));
  // snout and nose
  ell(c, 0.22, 0.2, 0.09, 0.07, skinHi); ell(c, 0.29, 0.22, 0.04, 0.035, "#3A2228");
  // goggles up on the cap, eyes below
  const blink = fx.blink && fx.mood !== "dizzy";
  if (fx.mood === "dizzy") { c.strokeStyle = "#1A1420"; c.lineWidth = 0.025; c.beginPath(); c.arc(0.1, 0.27, 0.035, 0, Math.PI * 1.6); c.stroke(); }
  else if (blink) { c.strokeStyle = "#1A1420"; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0.07, 0.27); c.lineTo(0.14, 0.27); c.stroke(); }
  else {
    const big = fx.mood === "wow" || fx.mood === "scared" ? 1.35 : 1;
    ell(c, 0.11, 0.27, 0.04 * big, 0.05 * big, "#FFFFFF"); ell(c, 0.125, 0.27, 0.022 * big, 0.03 * big, "#1A1420"); ell(c, 0.13, 0.285, 0.008 * big, 0.01 * big, "#FFFFFF");
  }
  // mouth
  c.strokeStyle = "#3A1A22"; c.lineWidth = 0.022;
  c.beginPath();
  if (fx.mood === "scared" || fx.mood === "wow") { ell(c, 0.17, 0.12, 0.035, 0.03, "#3A1A22"); }
  else if (fx.mood === "dizzy") { c.moveTo(0.1, 0.12); c.quadraticCurveTo(0.15, 0.15, 0.2, 0.11); c.stroke(); }
  else { c.moveTo(0.08, 0.14); c.quadraticCurveTo(0.15, 0.08, 0.21, 0.13); c.stroke(); }
  // the cap with goggles strapped on
  c.fillStyle = cap; c.beginPath(); c.ellipse(0.02, 0.38, 0.22, 0.13, 0, Math.PI, 0, true); c.fill();
  c.fillRect(0.1, 0.36, 0.2, 0.04);
  ell(c, -0.02, 0.4, 0.07, 0.05, "#5ADCFF"); ell(c, 0.09, 0.41, 0.06, 0.045, "#5ADCFF");
  c.strokeStyle = "#2A2D3E"; c.lineWidth = 0.02; c.beginPath(); c.ellipse(-0.02, 0.4, 0.07, 0.05, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(0.09, 0.41, 0.06, 0.045, 0, 0, Math.PI * 2); c.stroke();
  if (fx.mood === "scared") { ell(c, -0.12, 0.36, 0.025, 0.04, "#7CC8FF"); }
  c.restore();
}

// ---------------------------------------------------------------- bodies
interface Geo { s: TruckSpec; col: TruckSpec["colors"] }

function bedBack(c: C, g: Geo) {
  const b = g.s.bed, col = g.col;
  // the far wall of the bed (behind the load)
  const top = b.y + b.wall;
  c.fillStyle = shade(col.bed, -0.35); c.fillRect(b.x0 - 0.1, b.y, b.x1 - b.x0 + 0.1, b.wall);
  c.fillStyle = shade(col.bed, -0.45);
  for (let x = b.x0 + 0.3; x < b.x1; x += 0.42) c.fillRect(x, b.y, 0.03, b.wall);
  c.fillStyle = shade(col.body, -0.35); c.fillRect(b.x0 - 0.1, top - 0.05, b.x1 - b.x0 + 0.1, 0.05);
}

function bedFront(c: C, g: Geo, fx: TruckFx) {
  const b = g.s.bed, col = g.col, id = g.s.id;
  const top = b.y + b.wall;
  // the near side is open — only the floor's edge, so every piece of the load shows (a rail across the bed hid the
  // floor row: a two-row load looked like two pieces)
  const panel = 0.03;
  c.fillStyle = vg(c, b.y + panel, b.y - 0.22, col.body, shade(col.body, -0.25));
  rr(c, b.x0 - 0.12, b.y - 0.22, b.x1 - b.x0 + 0.14, panel + 0.22, 0.06); c.fill();
  // a slim post at each end of the bed (the side boards' height)
  const stake = id === "glowtail" ? shade(col.trim, 0.1) : id === "timberjaw" ? shade(col.bed, -0.15) : shade(col.body, -0.2);
  c.fillStyle = stake;
  c.fillRect(b.x0 - 0.08, b.y, 0.05, b.wall); c.fillRect(b.x1 - 0.05, b.y, 0.05, b.wall);
  // the tailgate
  c.fillStyle = shade(col.body, -0.1); rr(c, b.x0 - 0.16, b.y - 0.22, 0.1, b.wall + 0.24, 0.03); c.fill();
  // tail light
  ell(c, b.x0 - 0.13, b.y - 0.06, 0.04, 0.07, fx.brake > 0 ? "#FF2A3A" : "#B0202A");
  if (fx.brake > 0) ell(c, b.x0 - 0.2, b.y - 0.06, 0.18, 0.18, "rgba(255,40,60,0.25)");
  // decal
  if (id === "mudbug") { c.fillStyle = col.accent; c.beginPath(); c.moveTo(b.x0 + 0.1, b.y - 0.12); c.quadraticCurveTo(b.x0 + 0.6, b.y + 0.05, b.x0 + 1.1, b.y - 0.06); c.quadraticCurveTo(b.x0 + 0.9, b.y + 0.04, b.x0 + 1.5, b.y + 0.06); c.lineTo(b.x0 + 1.5, b.y - 0.02); c.quadraticCurveTo(b.x0 + 0.8, b.y - 0.1, b.x0 + 0.1, b.y - 0.16); c.fill(); }
  if (id === "glowtail") { c.fillStyle = rgba(col.accent, 0.6 + 0.4 * Math.sin(fx.t * 3)); c.fillRect(b.x0, b.y - 0.1, b.x1 - b.x0, 0.035); }
  // cargo net
  if (fx.net) {
    c.strokeStyle = rgba("#3EE08F", 0.85); c.lineWidth = 0.03;
    const nt = g.s.cab.roof;
    for (let x = b.x0; x <= b.x1 + 0.01; x += 0.25) { c.beginPath(); c.moveTo(x, top); c.lineTo(x + 0.12, nt); c.stroke(); }
    for (let y = top; y <= nt; y += 0.2) { c.beginPath(); c.moveTo(b.x0, y); c.lineTo(b.x1, y); c.stroke(); }
  }
}

function cab(c: C, g: Geo, fx: TruckFx) {
  const s = g.s, col = g.col, b = s.bed, id = s.id;
  const x0 = b.x1 - 0.02, x1 = s.cab.x1, roof = s.cab.roof, hx = s.hood.x1, ht = s.hood.top;
  // chassis frame and bumpers
  c.fillStyle = col.trim; rr(c, b.x0 - 0.2, -0.36, hx - b.x0 + 0.38, 0.22, 0.05); c.fill();
  // body shell: cab + hood in one outline
  c.beginPath();
  c.moveTo(x0, b.y - 0.22);
  c.lineTo(x0, roof - 0.12);
  c.quadraticCurveTo(x0, roof, x0 + 0.14, roof);
  c.lineTo(x1 - 0.32, roof);
  if (id === "glowtail") c.quadraticCurveTo(x1 + 0.05, roof - 0.05, x1 + 0.2, ht + 0.1);
  else { c.quadraticCurveTo(x1 - 0.2, roof, x1 - 0.12, roof - 0.12); c.lineTo(x1, ht + 0.06); }
  c.lineTo(hx - 0.14, ht);
  c.quadraticCurveTo(hx + 0.04, ht, hx + 0.04, ht - 0.16);
  c.lineTo(hx + 0.04, b.y - 0.12);
  c.quadraticCurveTo(hx + 0.04, b.y - 0.22, hx - 0.08, b.y - 0.22);
  c.closePath();
  c.fillStyle = vg(c, roof, b.y - 0.22, shade(col.body, 0.14), shade(col.body, -0.22)); c.fill();
  // a shine along the top
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.04;
  c.beginPath(); c.moveTo(x0 + 0.12, roof - 0.05); c.lineTo(x1 - 0.34, roof - 0.05); c.moveTo(x1 + 0.05, ht - 0.04); c.lineTo(hx - 0.16, ht - 0.04); c.stroke();
  // window with Bodo behind it
  const wx0 = x0 + 0.12, wx1 = x1 - 0.12, wy0 = b.y + 0.42, wy1 = roof - 0.1;
  c.save();
  c.beginPath(); c.moveTo(wx0, wy0); c.lineTo(wx0, wy1); c.lineTo(wx1 - 0.26, wy1); c.lineTo(wx1, wy0); c.closePath();
  c.fillStyle = mix("#2A3A5A", fx.light, 0.15); c.fill();
  c.clip();
  bodo(c, (wx0 + wx1) / 2 - 0.12, wy0 + 0.04, fx, col.accent === "#F2E1B6" ? "#C9402A" : col.accent);
  // the steering wheel
  c.strokeStyle = "#1A1C28"; c.lineWidth = 0.035; c.beginPath(); c.ellipse(wx1 - 0.2, wy0 + 0.08, 0.04, 0.12, -0.4, 0, Math.PI * 2); c.stroke();
  // glass reflections
  c.fillStyle = "rgba(200,235,255,0.22)"; c.beginPath(); c.moveTo(wx0 + 0.3, wy1); c.lineTo(wx0 + 0.5, wy1); c.lineTo(wx0 + 0.2, wy0); c.lineTo(wx0, wy0); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = shade(col.body, -0.35); c.lineWidth = 0.035;
  c.beginPath(); c.moveTo(wx0, wy0); c.lineTo(wx0, wy1); c.lineTo(wx1 - 0.26, wy1); c.lineTo(wx1, wy0); c.closePath(); c.stroke();
  // door seam, handle, mirror
  c.beginPath(); c.moveTo(x0 + 0.06, b.y - 0.15); c.lineTo(x0 + 0.06, wy0); c.moveTo(x1 - 0.05, b.y - 0.15); c.lineTo(x1 - 0.05, wy0); c.stroke();
  c.fillStyle = shade(col.trim, 0.2); c.fillRect(x0 + 0.2, b.y + 0.28, 0.16, 0.04);
  c.fillStyle = col.trim; rr(c, x1 - 0.02, wy0 + 0.02, 0.1, 0.16, 0.03); c.fill();
  // grille and headlight
  c.fillStyle = col.trim; rr(c, hx - 0.06, b.y - 0.16, 0.14, ht - b.y + 0.02, 0.04); c.fill();
  c.fillStyle = shade(col.trim, 0.25); for (let k = 0; k < 4; k++) c.fillRect(hx - 0.04, b.y - 0.1 + k * 0.1, 0.1, 0.03);
  const lit = fx.night > 0.25;
  ell(c, hx - 0.02, ht - 0.16, 0.06, 0.08, lit ? "#FFF6C8" : "#EAF2FF");
  if (lit) {
    const gx = c.createLinearGradient(hx, 0, hx + 7, 0);
    gx.addColorStop(0, "rgba(255,244,200,0.35)"); gx.addColorStop(1, "rgba(255,244,200,0)");
    c.fillStyle = gx; c.beginPath(); c.moveTo(hx, ht - 0.1); c.lineTo(hx + 7, ht + 0.9); c.lineTo(hx + 7, ht - 2.4); c.lineTo(hx, ht - 0.24); c.closePath(); c.fill();
  }
  // bumper
  c.fillStyle = id === "glowtail" ? col.accent : "#C9CED8"; rr(c, hx - 0.1, b.y - 0.3, 0.3, 0.14, 0.05); c.fill();
  // roof light bar
  if (id !== "glowtail") {
    c.fillStyle = col.trim; c.fillRect(x0 + 0.18, roof, x1 - x0 - 0.6, 0.05);
    for (let k = 0; k < 4; k++) ell(c, x0 + 0.26 + k * 0.16, roof + 0.08, 0.055, 0.045, lit ? "#FFF3B0" : "#FFD23F");
  } else {
    c.fillStyle = rgba(col.accent, 0.7 + 0.3 * Math.sin(fx.t * 3)); c.fillRect(x0 + 0.1, roof - 0.02, x1 - x0 - 0.5, 0.035);
  }
  // exhaust stacks behind the cab (diesel trucks)
  if (id !== "glowtail") {
    const chrome = vg(c, roof + 0.5, b.y, "#F2F4F8", "#8A90A0");
    c.fillStyle = chrome; c.fillRect(x0 - 0.1, b.y + 0.1, 0.09, roof - b.y + (id === "thunderhoof" ? 0.5 : 0.3));
    c.fillStyle = "#3A3D4A"; c.fillRect(x0 - 0.11, roof + (id === "thunderhoof" ? 0.58 : 0.38), 0.11, 0.05);
  }
  // decals: Thunderhoof's star, Timberjaw's leaf stripe
  if (id === "thunderhoof") { c.fillStyle = col.accent; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.07 : 0.16; c.lineTo(x0 + 0.5 + Math.cos(a) * r, b.y + 0.12 - Math.sin(a) * r); } c.closePath(); c.fill(); }
  if (id === "timberjaw") { c.fillStyle = col.accent; c.fillRect(x0, b.y + 0.05, hx - x0, 0.06); }
  if (id === "mudbug") { c.fillStyle = col.accent; c.fillRect(x0 + 0.02, b.y + 0.06, hx - x0 - 0.1, 0.04); }
}

/** fender flares over the tops of the wheels */
function flares(c: C, g: Geo, wx: Float64Array, wy: Float64Array, tr: Truck) {
  const col = g.col, r = g.s.wheel.r;
  const ca = Math.cos(tr.a), sa = Math.sin(tr.a);
  for (let i = 0; i < 2; i++) {
    // into chassis space
    const dx = wx[i] - tr.x, dy = wy[i] - tr.y;
    const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
    c.fillStyle = shade(col.trim, 0.12);
    c.beginPath(); c.arc(lx, Math.max(ly, g.s.anchors[i][1] - g.s.wheel.rest + 0.1), r * 1.08, Math.PI * 0.15, Math.PI * 0.85); c.arc(lx, Math.max(ly, g.s.anchors[i][1] - g.s.wheel.rest + 0.1), r * 0.98, Math.PI * 0.85, Math.PI * 0.15, true); c.closePath(); c.fill();
  }
}

// ---------------------------------------------------------------- cargo sprites
const PXM = 120;
export class CargoSprites {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(private night: number) {}
  get(q: Cargo) {
    const variant = q.kind === "gift" || q.kind === "potion" || q.kind === "lantern" ? q.seed % 4 : q.seed % 2;
    const key = `${q.kind}${variant}${Math.round(q.scale * 100)}`;
    let cv = this.cache.get(key);
    if (cv) return cv;
    const w = q.hw * 2, h = q.hh * 2;
    cv = document.createElement("canvas");
    const pad = 0.12;
    cv.width = Math.ceil((w + pad * 2) * PXM); cv.height = Math.ceil((h + pad * 2) * PXM);
    const c = cv.getContext("2d")!;
    c.setTransform(PXM, 0, 0, -PXM, cv.width / 2, cv.height / 2);
    paintCargo(c, q.kind, q.hw, q.hh, variant, this.night);
    this.cache.set(key, cv);
    return cv;
  }
}

function paintCargo(c: C, k: CargoKind, hw: number, hh: number, v: number, night: number) {
  const r = makeRng(v * 101 + k.length * 7);
  const s = CARGO[k];
  switch (k) {
    case "crate": {
      c.fillStyle = "#C98A4E"; rr(c, -hw, -hh, hw * 2, hh * 2, 0.03); c.fill();
      c.fillStyle = "#E2A866"; for (let i = 0; i < 3; i++) c.fillRect(-hw + 0.05, -hh + 0.05 + i * (hh * 2 - 0.1) / 3, hw * 2 - 0.1, (hh * 2 - 0.1) / 3 - 0.025);
      c.strokeStyle = "#8A5527"; c.lineWidth = 0.06; c.strokeRect(-hw + 0.03, -hh + 0.03, hw * 2 - 0.06, hh * 2 - 0.06);
      c.beginPath(); c.moveTo(-hw + 0.05, -hh + 0.05); c.lineTo(hw - 0.05, hh - 0.05); c.stroke();
      c.fillStyle = "#5A3418"; for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.arc(x * (hw - 0.06), y * (hh - 0.06), 0.018, 0, Math.PI * 2); c.fill(); }
      if (v) { c.fillStyle = "rgba(90,52,24,0.55)"; c.fillRect(0.02, -0.05, hw * 0.6, 0.06); }
      return;
    }
    case "melon": {
      const R = hw;
      c.fillStyle = "#3E9A3A"; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
      c.strokeStyle = "#1E5A22"; c.lineWidth = 0.045;
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.ellipse(i * R * 0.3, 0, R * 0.16, R * 1.1, 0, 0, Math.PI * 2); c.stroke(); }
      c.restore();
      c.fillStyle = "rgba(220,255,180,0.35)"; c.beginPath(); c.ellipse(-R * 0.35, R * 0.35, R * 0.3, R * 0.18, -0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#6A4A2A"; c.fillRect(-0.015, R - 0.03, 0.03, 0.06);
      return;
    }
    case "barrel": {
      c.fillStyle = "#B8743E"; c.beginPath(); c.moveTo(-hw * 0.86, -hh); c.quadraticCurveTo(-hw * 1.08, 0, -hw * 0.86, hh); c.lineTo(hw * 0.86, hh); c.quadraticCurveTo(hw * 1.08, 0, hw * 0.86, -hh); c.closePath(); c.fill();
      c.strokeStyle = "#8A5228"; c.lineWidth = 0.02; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * hw * 0.35, -hh); c.quadraticCurveTo(i * hw * 0.42, 0, i * hw * 0.35, hh); c.stroke(); }
      c.fillStyle = "#5A5E6E"; for (const y of [-hh * 0.7, hh * 0.7]) c.fillRect(-hw, y - 0.025, hw * 2, 0.05);
      c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(-hw * 0.55, -hh * 0.9, hw * 0.18, hh * 1.8);
      return;
    }
    case "jar": {
      c.fillStyle = "rgba(255,240,200,0.5)"; rr(c, -hw, -hh, hw * 2, hh * 1.75, 0.06); c.fill();
      c.fillStyle = "#FFB627"; rr(c, -hw + 0.025, -hh + 0.025, hw * 2 - 0.05, hh * 1.4, 0.05); c.fill();
      c.fillStyle = "rgba(255,255,255,0.45)"; c.fillRect(-hw + 0.05, -hh + 0.06, 0.035, hh * 1.4);
      c.fillStyle = v ? "#E8423A" : "#FF7AB0"; rr(c, -hw - 0.02, hh * 0.72, hw * 2 + 0.04, hh * 0.3, 0.03); c.fill();
      c.fillStyle = "#FFFFFF"; for (let i = 0; i < 4; i++) c.fillRect(-hw + i * hw * 0.55, hh * 0.78, 0.03, 0.03);
      c.fillStyle = "#FFF3D6"; c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(Math.cos(a) * 0.08, -0.04 + Math.sin(a) * 0.08); } c.fill();
      return;
    }
    case "egg": {
      const R = hw;
      c.fillStyle = v ? "#F7E8D4" : "#EAF2F8"; c.beginPath(); c.ellipse(0, -R * 0.04, R * 0.9, R * 1.0, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = v ? "#C9A27A" : "#8EAAC8"; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(range(r, -R * 0.6, R * 0.6), range(r, -R * 0.7, R * 0.6), range(r, 0.008, 0.02), 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.ellipse(-R * 0.35, R * 0.4, R * 0.18, R * 0.12, -0.6, 0, Math.PI * 2); c.fill();
      return;
    }
    case "vase": {
      c.fillStyle = "#E0774A"; c.beginPath();
      c.moveTo(-hw * 0.4, -hh); c.quadraticCurveTo(-hw * 1.15, -hh * 0.3, -hw * 0.55, hh * 0.55); c.lineTo(-hw * 0.4, hh * 0.85); c.lineTo(-hw * 0.6, hh); c.lineTo(hw * 0.6, hh); c.lineTo(hw * 0.4, hh * 0.85); c.lineTo(hw * 0.55, hh * 0.55); c.quadraticCurveTo(hw * 1.15, -hh * 0.3, hw * 0.4, -hh); c.closePath(); c.fill();
      c.fillStyle = "#2A3A5A"; c.fillRect(-hw * 0.95, -hh * 0.25, hw * 1.9, hh * 0.2);
      c.fillStyle = "#F2D9A0"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * hw * 0.32 - 0.03, -hh * 0.25); c.lineTo(i * hw * 0.32, -hh * 0.06); c.lineTo(i * hw * 0.32 + 0.03, -hh * 0.25); c.fill(); }
      c.fillStyle = "rgba(255,220,180,0.35)"; c.beginPath(); c.ellipse(-hw * 0.35, -hh * 0.4, hw * 0.12, hh * 0.3, 0.2, 0, Math.PI * 2); c.fill();
      return;
    }
    case "potion": {
      const liq = ["#B46CFF", "#3EE08F", "#FF5FA0", "#5BC8FF"][v];
      c.fillStyle = "rgba(220,240,255,0.45)"; c.beginPath(); c.moveTo(-hw * 0.3, hh * 0.55); c.lineTo(-hw * 0.3, hh * 0.2); c.quadraticCurveTo(-hw, hh * 0.05, -hw, -hh * 0.45); c.quadraticCurveTo(-hw, -hh, 0, -hh); c.quadraticCurveTo(hw, -hh, hw, -hh * 0.45); c.quadraticCurveTo(hw, hh * 0.05, hw * 0.3, hh * 0.2); c.lineTo(hw * 0.3, hh * 0.55); c.closePath(); c.fill();
      c.fillStyle = liq; c.beginPath(); c.moveTo(-hw * 0.92, -hh * 0.15); c.quadraticCurveTo(0, -hh * 0.05, hw * 0.92, -hh * 0.15); c.quadraticCurveTo(hw * 0.95, -hh * 0.95, 0, -hh * 0.95); c.quadraticCurveTo(-hw * 0.95, -hh * 0.95, -hw * 0.92, -hh * 0.15); c.fill();
      c.fillStyle = rgba(liq, 0.35); c.beginPath(); c.arc(0, -hh * 0.5, hw * 1.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#A8784A"; c.fillRect(-hw * 0.32, hh * 0.55, hw * 0.64, hh * 0.42);
      c.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(range(r, -hw * 0.5, hw * 0.5), -hh * range(r, 0.3, 0.8), 0.015, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(-hw * 0.7, -hh * 0.7, 0.025, hh * 0.6);
      return;
    }
    case "log": {
      c.fillStyle = "#7A4E2A"; rr(c, -hw, -hh, hw * 2, hh * 2, hh * 0.5); c.fill();
      c.strokeStyle = "#5A3218"; c.lineWidth = 0.025; for (let i = 0; i < 5; i++) { const y = -hh + 0.05 + i * (hh * 2 - 0.1) / 4; c.beginPath(); c.moveTo(-hw + 0.1, y); c.lineTo(hw - 0.15, y + range(r, -0.02, 0.02)); c.stroke(); }
      for (const x of [-hw + hh * 0.5, hw - hh * 0.5]) { c.fillStyle = "#E2B27A"; c.beginPath(); c.ellipse(x, 0, hh * 0.42, hh * 0.92, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#B07A48"; c.beginPath(); c.ellipse(x, 0, hh * 0.22, hh * 0.5, 0, 0, Math.PI * 2); c.stroke(); }
      return;
    }
    case "gift": {
      const paper = ["#FF4F6D", "#3EA8FF", "#3EE08F", "#FFB627"][v], rib = ["#FFD23F", "#FFFFFF", "#FF4F6D", "#7B4DFF"][v];
      c.fillStyle = paper; rr(c, -hw, -hh, hw * 2, hh * 2, 0.03); c.fill();
      c.fillStyle = "rgba(255,255,255,0.28)"; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(range(r, -hw * 0.8, hw * 0.8), range(r, -hh * 0.8, hh * 0.7), 0.025, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = rib; c.fillRect(-0.035, -hh, 0.07, hh * 2); c.fillRect(-hw, -0.035, hw * 2, 0.07);
      c.beginPath(); c.ellipse(-0.08, hh + 0.03, 0.09, 0.05, 0.5, 0, Math.PI * 2); c.ellipse(0.08, hh + 0.03, 0.09, 0.05, -0.5, 0, Math.PI * 2); c.fill();
      return;
    }
    case "lantern": {
      const col = ["#FF5A3D", "#FF8A2A", "#E8423A", "#FF6A8A"][v];
      c.fillStyle = "#2A2D3E"; c.fillRect(-hw * 0.55, hh * 0.78, hw * 1.1, hh * 0.22); c.fillRect(-hw * 0.55, -hh, hw * 1.1, hh * 0.22);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, hw * 1.02, hh * 0.82, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = shade(col, -0.3); c.lineWidth = 0.02; for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, 0, Math.abs(i) * hw * 0.25 + 0.01, hh * 0.82, 0, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = rgba("#FFE08A", 0.35 + night * 0.4); c.beginPath(); c.ellipse(0, 0, hw * 0.6, hh * 0.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FFD23F"; c.fillRect(-0.01, -hh - 0.1, 0.02, 0.1);
      return;
    }
    case "crystal": {
      c.fillStyle = "#4A3A44"; c.fillRect(-hw, -hh, hw * 2, hh * 0.22);
      c.fillStyle = s.color; c.beginPath(); c.moveTo(-hw * 0.7, -hh * 0.78); c.lineTo(-hw * 0.75, hh * 0.45); c.lineTo(0, hh); c.lineTo(hw * 0.75, hh * 0.45); c.lineTo(hw * 0.7, -hh * 0.78); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,255,255,0.45)"; c.beginPath(); c.moveTo(-hw * 0.7, -hh * 0.78); c.lineTo(-hw * 0.75, hh * 0.45); c.lineTo(0, hh); c.lineTo(-hw * 0.1, -hh * 0.78); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,200,120,0.5)"; c.beginPath(); c.moveTo(hw * 0.2, -hh * 0.6); c.lineTo(hw * 0.4, hh * 0.3); c.lineTo(hw * 0.05, hh * 0.6); c.closePath(); c.fill();
      c.fillStyle = rgba(s.color, 0.3); c.beginPath(); c.arc(0, 0, hw * 1.25, 0, Math.PI * 2); c.fill();
      return;
    }
    case "orb": {
      // a glowing orb resting in a little cradle
      c.fillStyle = "#5A6488"; c.fillRect(-hw, -hh, hw * 2, hh * 0.22);
      c.fillStyle = "#8E96B8"; c.fillRect(-hw, -hh * 0.82, hw * 0.16, hh * 0.7); c.fillRect(hw * 0.84, -hh * 0.82, hw * 0.16, hh * 0.7);
      c.translate(0, hh * 0.08);
      const R = Math.min(hw, hh) * 0.86;
      c.fillStyle = rgba("#7CE7FF", 0.35); c.beginPath(); c.arc(0, 0, R * 1.2, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(-R * 0.3, R * 0.3, R * 0.1, 0, 0, R);
      g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.4, "#9CEFFF"); g.addColorStop(1, "#3A6FD8");
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FFF6B0"; c.beginPath(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr0 = i % 2 ? R * 0.22 : R * 0.5; c.lineTo(Math.cos(a) * rr0, Math.sin(a) * rr0); } c.closePath(); c.fill();
      return;
    }
  }
}

/** draw one cargo piece (world space) */
export function drawCargo(c: C, q: Cargo, sp: CargoSprites, alpha = 1) {
  const cv = sp.get(q);
  c.save(); c.translate(q.x, q.y); c.rotate(q.a);
  if (alpha < 1) c.globalAlpha = alpha;
  c.scale(1 / PXM, -1 / PXM);
  c.drawImage(cv, -cv.width / 2, -cv.height / 2);
  c.restore();
}

// ---------------------------------------------------------------- the whole truck
export function drawTruck(c: C, tr: Truck, sp: CargoSprites, fx: TruckFx, groundY: number) {
  const s = tr.spec, col = s.colors, g: Geo = { s, col };
  const r = s.wheel.r;
  // a soft shadow on the ground
  const hgt = Math.max(0, tr.y - groundY - 1.2);
  c.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.26 - hgt * 0.04)})`;
  c.beginPath(); c.ellipse(tr.x, groundY + 0.04, 2.3 + hgt * 0.2, 0.22, 0, 0, Math.PI * 2); c.fill();

  const ca = Math.cos(tr.a), sa = Math.sin(tr.a);
  // shocks and arms (world space): from the chassis anchors to the wheels
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = s.anchors[i];
    const px = tr.x + ax * ca - (ay + 0.25) * sa, py = tr.y + ax * sa + (ay + 0.25) * ca;
    const ix = tr.x + (ax * 0.4) * ca - (ay - 0.05) * sa, iy = tr.y + (ax * 0.4) * sa + (ay - 0.05) * ca;
    c.strokeStyle = col.trim; c.lineWidth = 0.12; c.lineCap = "round"; c.beginPath(); c.moveTo(ix, iy); c.lineTo(tr.wx[i], tr.wy[i]); c.stroke();
    shock(c, px, py, tr.wx[i], tr.wy[i], "#5A5E6E", col.accent, r);
  }
  // chassis space: the bed's far wall, the load, the near stakes, the cab
  c.save(); c.translate(tr.x, tr.y); c.rotate(tr.a);
  bedBack(c, g);
  c.restore();
  for (const q of tr.cargo) if (q.state === ABOARD) drawCargo(c, q, sp);
  if (fx.bubble) for (const q of tr.cargo) if (q.state === ABOARD) { c.strokeStyle = "rgba(170,225,255,0.85)"; c.lineWidth = 0.025; c.beginPath(); c.arc(q.x, q.y, q.rad + 0.05, 0, Math.PI * 2); c.stroke(); }
  c.save(); c.translate(tr.x, tr.y); c.rotate(tr.a);
  bedFront(c, g, fx);
  cab(c, g, fx);
  c.restore();
  // wheels in front, then the flares
  for (let i = 0; i < 2; i++) wheel(c, tr.wx[i], tr.wy[i], r, tr.spin[i], col, s.id === "glowtail");
  c.save(); c.translate(tr.x, tr.y); c.rotate(tr.a);
  flares(c, g, tr.wx, tr.wy, tr);
  // nitro flame out of the stacks / the tail
  if (fx.nitro) {
    const fl = 0.6 + Math.random() * 0.5;
    const ex = s.id === "glowtail" ? s.bed.x0 - 0.2 : s.bed.x1 - 0.08, ey = s.id === "glowtail" ? s.bed.y : s.cab.roof + 0.4;
    const ang = s.id === "glowtail" ? Math.PI : Math.PI * 0.62;
    c.save(); c.translate(ex, ey); c.rotate(ang);
    c.fillStyle = "rgba(255,140,40,0.8)"; c.beginPath(); c.moveTo(0, -0.1); c.lineTo(fl, 0); c.lineTo(0, 0.1); c.fill();
    c.fillStyle = "rgba(255,240,160,0.95)"; c.beginPath(); c.moveTo(0, -0.05); c.lineTo(fl * 0.55, 0); c.lineTo(0, 0.05); c.fill();
    c.restore();
  }
  c.restore();
}

/** the load that has left the truck (drawn over the scene; it fades out) */
export function drawLooseCargo(c: C, tr: Truck, sp: CargoSprites) {
  for (const q of tr.cargo) {
    if (q.state === ABOARD || q.state === BROKEN || q.state === GONE) continue;
    drawCargo(c, q, sp, Math.max(0, Math.min(1, (3.2 - q.t) / 0.8)));
  }
}

/** a garage preview (the truck at rest) */
export function drawTruckPreview(c: C, tr: Truck, sp: CargoSprites, t: number) {
  const fx: TruckFx = { mood: "happy", blink: t % 3.2 < 0.12, gas: 0, brake: 0, t, nitro: false, net: false, bubble: false, night: 0, light: "#FFFFFF" };
  drawTruck(c, tr, sp, fx, tr.wy[0] - tr.spec.wheel.r);
}

