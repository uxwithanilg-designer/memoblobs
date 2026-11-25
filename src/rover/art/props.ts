// The props along the track, painted once per stage into sprites (shaded, lit from the sun's side, graded to the time of
// day; lamps, crystals, lanterns and neon glow at night). A few move: windmill sails turn, tumbleweeds roll, balloons
// bob, geysers puff, the lighthouse sweeps its beam, antennas blink, flags wave.
import type { PropKind } from "../worlds";
import type { Look } from "./grade";
import { makeRng, mix, range, rgba, shade, type Rng } from "../util";

/** pixels per metre inside a sprite */
const PPM = 44;
export interface Sprite { cv: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

type P = CanvasRenderingContext2D;
interface Kit { c: P; r: Rng; look: Look; col: (hex: string, k?: number) => string; lit: string; side: number; night: number; glow: (color: string, blur: number) => void; noGlow: () => void }

// ------------------------------------------------------------------ drawing helpers (metres, y up, origin at the foot)
function ball(k: Kit, x: number, y: number, rr: number, base: string, light = 0.35) {
  const c = k.c, g = c.createRadialGradient(x + rr * 0.35 * k.side, y + rr * 0.4, rr * 0.08, x, y, rr);
  g.addColorStop(0, shade(base, light)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, -0.22));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill();
}
function poly(c: P, pts: number[], fill: string | CanvasGradient) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fill();
}
function vgrad(c: P, y0: number, y1: number, a: string, b: string) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function hgrad(c: P, x0: number, x1: number, a: string, b: string) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function trunk(k: Kit, x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  const c = k.c;
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round";
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + w * 0.6, (y0 + y1) / 2, x1, y1); c.stroke();
  c.strokeStyle = rgba(k.lit, 0.25); c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(x0 + w * 0.25 * k.side, y0); c.quadraticCurveTo((x0 + x1) / 2 + w * 0.6 + w * 0.25 * k.side, (y0 + y1) / 2, x1 + w * 0.2 * k.side, y1); c.stroke();
}
function rr(c: P, x: number, y: number, w: number, h: number, rad: number) { c.beginPath(); c.roundRect(x, y, w, h, rad); }
function contact(c: P, w: number) { c.fillStyle = "rgba(0,0,0,0.18)"; c.beginPath(); c.ellipse(0, 0.02, w, w * 0.16, 0, 0, Math.PI * 2); c.fill(); }

// ------------------------------------------------------------------ painters: [width, height, draw]
type Painter = (k: Kit, v: number) => void;
const PAINT: Record<PropKind, [number, number, Painter]> = {
  tree: [4.2, 5.4, (k, v) => {
    const c = k.c; contact(c, 1.2);
    trunk(k, 0, 0, 0.1, 2.4, 0.42, k.col("#7A4B2E"));
    const g = k.col(["#4CB85C", "#5CC46A", "#3FA857"][v]);
    for (const [x, y, s] of [[-0.9, 2.6, 1.05], [0.95, 2.7, 1], [0, 3.6, 1.35], [-0.5, 3.3, 0.9], [0.55, 3.4, 0.95]] as const) ball(k, x, y, s, g);
    if (v === 2) for (let i = 0; i < 6; i++) ball(k, range(k.r, -1.2, 1.2), range(k.r, 2.4, 4.4), 0.12, k.col("#FF5D6C"), 0.5);
  }],
  bush: [2, 1.4, (k, v) => { contact(k.c, 0.8); const g = k.col(["#47B35A", "#3DA34F", "#58C26A"][v]); ball(k, -0.45, 0.45, 0.5, g); ball(k, 0.45, 0.45, 0.5, g); ball(k, 0, 0.7, 0.6, g); if (v === 1) for (let i = 0; i < 5; i++) ball(k, range(k.r, -0.7, 0.7), range(k.r, 0.4, 1), 0.08, k.col("#FFD23F"), 0.5); }],
  flowers: [1.6, 0.8, (k, v) => {
    const c = k.c, cols = [["#FF6B8B", "#FFD23F", "#FFFFFF"], ["#B57CFF", "#FF9AD5", "#FFFFFF"], ["#FF8A3D", "#FFE066", "#FF5D6C"]][v];
    for (let i = 0; i < 7; i++) {
      const x = range(k.r, -0.7, 0.7), h = range(k.r, 0.3, 0.7);
      c.strokeStyle = k.col("#3E9A4B"); c.lineWidth = 0.05; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 0.1, h / 2, x, h); c.stroke();
      const col = k.col(cols[i % 3]);
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ball(k, x + Math.cos(a) * 0.08, h + Math.sin(a) * 0.08, 0.07, col, 0.3); }
      ball(k, x, h, 0.05, k.col("#FFD23F"));
    }
  }],
  fence: [3.2, 1.2, (k) => {
    const c = k.c, wood = k.col("#A9774A");
    for (const x of [-1.4, 0, 1.4]) { rr(c, x - 0.09, 0, 0.18, 1.1, 0.05); c.fillStyle = vgrad(c, 0, 1.1, shade(wood, -0.15), shade(wood, 0.1)); c.fill(); }
    for (const y of [0.4, 0.82]) { rr(c, -1.55, y, 3.1, 0.13, 0.05); c.fillStyle = hgrad(c, -1.5, 1.5, shade(wood, 0.08), shade(wood, -0.08)); c.fill(); }
  }],
  windmill: [6, 9.5, (k) => {
    const c = k.c; contact(c, 1.8);
    poly(c, [-1.4, 0, 1.4, 0, 0.8, 6.8, -0.8, 6.8], hgrad(c, -1.4, 1.4, k.col("#F3EBDD"), k.col("#C9BBA6")));
    poly(c, [-1.05, 6.7, 1.05, 6.7, 0, 8.1], k.col("#C8553D"));
    rr(c, -0.35, 0, 0.7, 1.4, 0.3); c.fillStyle = k.col("#6B4A35"); c.fill();
    for (const [x, y] of [[-0.3, 3.2], [0.3, 4.6]]) { rr(c, x - 0.22, y, 0.44, 0.55, 0.1); c.fillStyle = k.night > 0.4 ? rgba("#FFD98A", 0.95) : k.col("#7FA6C9"); c.fill(); }
  }],
  hay: [1.8, 1.3, (k) => { const c = k.c; contact(c, 0.9); rr(c, -0.85, 0, 1.7, 1.2, 0.45); c.fillStyle = vgrad(c, 1.2, 0, k.col("#F3CF6B"), k.col("#C9962F")); c.fill(); c.strokeStyle = rgba(shade(k.col("#C9962F"), -0.2), 0.6); c.lineWidth = 0.05; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-0.75, 0.15 + i * 0.18); c.lineTo(0.75, 0.15 + i * 0.18); c.stroke(); } }],
  sign: [1.4, 1.8, (k, v) => {
    const c = k.c; c.fillStyle = k.col("#7A5533"); c.fillRect(-0.06, 0, 0.12, 1.5);
    rr(c, -0.6, 1.0, 1.2, 0.6, 0.1); c.fillStyle = k.col(["#FFD23F", "#2EC4B6", "#FF6B3D"][v]); c.fill();
    c.fillStyle = k.col("#2B2D42");
    if (v === 0) poly(c, [-0.35, 1.18, 0.15, 1.18, 0.15, 1.08, 0.38, 1.3, 0.15, 1.52, 0.15, 1.42, -0.35, 1.42], k.col("#2B2D42"));
    else { c.beginPath(); c.moveTo(-0.35, 1.15); c.lineTo(0, 1.45); c.lineTo(0.35, 1.15); c.closePath(); c.fill(); }
  }],
  cactus: [1.6, 2.2, (k, v) => {
    const c = k.c, g = k.col(["#4FA35C", "#5CB06A", "#3E9152"][v]); contact(c, 0.5);
    const arm = (x0: number, y0: number, dir: number, h: number) => { c.strokeStyle = g; c.lineWidth = 0.32; c.lineCap = "round"; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + dir * 0.45, y0); c.lineTo(x0 + dir * 0.45, y0 + h); c.stroke(); };
    arm(0, 0.9, -1, 0.6); arm(0, 1.2, 1, 0.5);
    rr(c, -0.24, 0, 0.48, 2, 0.24); c.fillStyle = hgrad(c, -0.24, 0.24, shade(g, -0.15), shade(g, 0.2)); c.fill();
    c.strokeStyle = rgba(shade(g, -0.3), 0.6); c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, 0.1); c.lineTo(0, 1.9); c.stroke();
    if (v === 1) ball(k, 0, 2.02, 0.12, k.col("#FF6B8B"), 0.4);
  }],
  saguaro: [2.4, 3.8, (k) => {
    const c = k.c, g = k.col("#3E9152"); contact(c, 0.6);
    c.strokeStyle = g; c.lineWidth = 0.42; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 1.4); c.lineTo(-0.75, 1.4); c.lineTo(-0.75, 2.6); c.stroke();
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0.7, 2); c.lineTo(0.7, 3); c.stroke();
    rr(c, -0.3, 0, 0.6, 3.6, 0.3); c.fillStyle = hgrad(c, -0.3, 0.3, shade(g, -0.15), shade(g, 0.2)); c.fill();
  }],
  arch: [8, 6.5, (k) => {
    const c = k.c, rock = k.col("#C2603C");
    c.beginPath(); c.moveTo(-3.8, 0); c.lineTo(-3.4, 4.6); c.quadraticCurveTo(-3, 6.4, 0, 6.3); c.quadraticCurveTo(3.2, 6.4, 3.6, 4.4); c.lineTo(3.9, 0); c.lineTo(2.2, 0);
    c.lineTo(2.1, 3.2); c.quadraticCurveTo(1.8, 4.5, 0, 4.5); c.quadraticCurveTo(-1.9, 4.5, -2.1, 3.2); c.lineTo(-2.2, 0); c.closePath();
    c.fillStyle = vgrad(c, 6.4, 0, shade(rock, 0.15), shade(rock, -0.15)); c.fill();
    c.fillStyle = rgba(shade(rock, 0.3), 0.4); for (let y = 0.5; y < 6; y += 0.7) c.fillRect(-3.8, y, 7.7, 0.12);
  }],
  tumbleweed: [1.1, 1.1, (k) => {
    const c = k.c; c.translate(0, 0.5); c.strokeStyle = k.col("#B08A4F"); c.lineWidth = 0.05;
    for (let i = 0; i < 16; i++) { const a = k.r() * 6.28, b = a + range(k.r, 1, 3); c.beginPath(); c.arc(range(k.r, -0.1, 0.1), range(k.r, -0.1, 0.1), range(k.r, 0.25, 0.48), a, b); c.stroke(); }
  }],
  balloon: [3, 4.6, (k, v) => {
    const c = k.c, cols = [["#FF5D6C", "#FFD23F"], ["#2E9BFF", "#FFFFFF"], ["#7B5CFF", "#FF8A3D"]][v];
    c.translate(0, 0.4);
    rr(c, -0.4, 0, 0.8, 0.55, 0.1); c.fillStyle = k.col("#8A5A3B"); c.fill();
    c.strokeStyle = k.col("#5A3826"); c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.35, 0.55); c.lineTo(-0.7, 1.6); c.moveTo(0.35, 0.55); c.lineTo(0.7, 1.6); c.stroke();
    c.save(); c.beginPath(); c.moveTo(-0.7, 1.6); c.bezierCurveTo(-1.9, 2.5, -1.6, 4.3, 0, 4.3); c.bezierCurveTo(1.6, 4.3, 1.9, 2.5, 0.7, 1.6); c.closePath(); c.clip();
    for (let i = 0; i < 6; i++) { c.fillStyle = k.col(cols[i % 2]); c.fillRect(-1.8 + i * 0.6, 1.5, 0.6, 3); }
    c.fillStyle = hgrad(c, -1.6, 1.6, rgba("#000000", 0.18), rgba("#FFFFFF", 0.12)); c.fillRect(-1.8, 1.5, 3.6, 3);
    c.restore();
  }],
  pine: [3, 6.4, (k, v) => {
    const c = k.c, g = k.col(["#2F7A5A", "#2A6E52", "#357F5E"][v]); contact(c, 0.8);
    c.fillStyle = k.col("#6B4A35"); c.fillRect(-0.15, 0, 0.3, 1.2);
    for (let i = 0; i < 4; i++) {
      const y = 0.8 + i * 1.25, w = 1.4 - i * 0.28;
      poly(c, [-w, y, w, y, 0, y + 2.2], hgrad(c, -w, w, shade(g, -0.1), shade(g, 0.12)));
      poly(c, [0, y + 2.2, w * k.side, y, 0, y + 0.3], rgba(k.lit, 0.18));
    }
  }],
  log: [2.8, 0.8, (k) => { const c = k.c; contact(c, 1.2); rr(c, -1.3, 0, 2.5, 0.62, 0.3); c.fillStyle = vgrad(c, 0.62, 0, k.col("#9A6A42"), k.col("#6B4528")); c.fill(); ball(k, 1.2, 0.31, 0.31, k.col("#D9B07A"), 0.1); c.strokeStyle = k.col("#A4784B"); c.lineWidth = 0.03; c.beginPath(); c.arc(1.2, 0.31, 0.18, 0, 6.28); c.stroke(); }],
  cabin: [5.6, 4.6, (k) => {
    const c = k.c; contact(c, 2.4);
    rr(c, -2.3, 0, 4.6, 2.6, 0.08); c.fillStyle = k.col("#8A5A3B"); c.fill();
    c.fillStyle = rgba(shade(k.col("#8A5A3B"), -0.25), 0.7); for (let y = 0.3; y < 2.6; y += 0.4) c.fillRect(-2.3, y, 4.6, 0.06);
    poly(c, [-2.7, 2.5, 2.7, 2.5, 0, 4.3], vgrad(c, 4.3, 2.5, k.col("#C8553D"), k.col("#8C3A2A")));
    c.fillStyle = k.col("#6E6E7A"); c.fillRect(1.2, 3.1, 0.45, 1.3);
    for (const x of [-1.4, 0.9]) { rr(c, x, 1, 0.75, 0.75, 0.08); c.fillStyle = k.night > 0.3 ? rgba("#FFD98A", 0.95) : k.col("#9BC2E0"); c.fill(); }
    rr(c, -0.35, 0, 0.7, 1.4, 0.08); c.fillStyle = k.col("#5A3826"); c.fill();
  }],
  mushroom: [0.9, 0.9, (k, v) => { const c = k.c; c.fillStyle = k.col("#F3E9DA"); rr(c, -0.1, 0, 0.2, 0.45, 0.06); c.fill(); c.beginPath(); c.ellipse(0, 0.45, 0.38, 0.28, 0, Math.PI, 0); c.fillStyle = k.col(["#E8433B", "#FF8A3D", "#B57CFF"][v]); c.fill(); for (let i = 0; i < 4; i++) ball(k, range(k.r, -0.25, 0.25), range(k.r, 0.5, 0.65), 0.05, "#FFFFFF", 0.1); }],
  rock: [1.8, 1.1, (k, v) => {
    const c = k.c, base = k.col(k.look.world.id === "frost" ? "#9FB0C8" : k.look.world.id === "volcano" ? "#3C3236" : k.look.world.id === "canyon" ? "#B5643F" : k.look.world.id === "crater" ? "#8C8FA3" : "#8E8A8F");
    contact(c, 0.8);
    const w = [0.85, 0.7, 0.95][v];
    c.beginPath(); c.moveTo(-w, 0); c.quadraticCurveTo(-w, 0.7, -0.2, 0.95); c.quadraticCurveTo(0.5, 1.05, w, 0.45); c.lineTo(w, 0); c.closePath();
    c.fillStyle = hgrad(c, -w, w, shade(base, -0.18), shade(base, 0.16)); c.fill();
    c.fillStyle = rgba(k.lit, 0.25); c.beginPath(); c.moveTo(-0.2, 0.95); c.quadraticCurveTo(0.5, 1.05, w, 0.45); c.lineTo(0.2, 0.55); c.closePath(); c.fill();
    if (k.look.world.ground === "snow") { c.fillStyle = rgba("#FFFFFF", 0.9); c.beginPath(); c.ellipse(-0.1, 0.9, 0.55, 0.12, 0.1, 0, 6.28); c.fill(); }
    if (k.look.world.id === "pines" || k.look.world.id === "jungle") { c.fillStyle = rgba(k.col("#5DAE62"), 0.8); c.beginPath(); c.ellipse(-0.3, 0.8, 0.4, 0.12, 0.3, 0, 6.28); c.fill(); }
  }],
  palm: [3.6, 5.6, (k) => {
    const c = k.c; contact(c, 0.8);
    trunk(k, 0, 0, 0.8, 4.6, 0.32, k.col("#A07A4C"));
    c.strokeStyle = rgba(shade(k.col("#A07A4C"), -0.3), 0.6); c.lineWidth = 0.04;
    for (let y = 0.4; y < 4.5; y += 0.35) { c.beginPath(); c.moveTo(-0.15 + y * 0.17, y); c.lineTo(0.17 + y * 0.17, y + 0.05); c.stroke(); }
    const g = k.col("#3FA85A");
    for (let i = 0; i < 7; i++) {
      const a = -0.3 + (i / 6) * (Math.PI + 0.6), len = range(k.r, 1.6, 2.2);
      const ex = 0.8 + Math.cos(a) * len, ey = 4.6 + Math.sin(a) * len * 0.55 - 0.3;
      c.strokeStyle = i % 2 ? g : shade(g, 0.1); c.lineWidth = 0.28; c.lineCap = "round";
      c.beginPath(); c.moveTo(0.8, 4.6); c.quadraticCurveTo((0.8 + ex) / 2, 4.6 + 0.7, ex, ey); c.stroke();
    }
    ball(k, 0.7, 4.45, 0.16, k.col("#6B4A2A")); ball(k, 0.92, 4.4, 0.15, k.col("#6B4A2A"));
  }],
  pillar: [1.6, 3.4, (k, v) => {
    const c = k.c, s = k.col("#E2B36E"); contact(c, 0.7);
    const h = [3.2, 2.2, 2.8][v];
    rr(c, -0.5, 0, 1, h, 0.06); c.fillStyle = hgrad(c, -0.5, 0.5, shade(s, -0.15), shade(s, 0.15)); c.fill();
    c.fillStyle = rgba(shade(s, -0.25), 0.5); for (let x = -0.35; x < 0.4; x += 0.23) c.fillRect(x, 0.2, 0.05, h - 0.4);
    rr(c, -0.65, h - 0.25, 1.3, 0.3, 0.05); c.fillStyle = shade(s, 0.1); c.fill();
    if (v === 1) poly(c, [-0.5, h, 0.2, h, 0.5, h - 0.5, 0.5, h], k.col("#F4C46B"));
  }],
  oasis: [8, 5.6, (k) => {
    const c = k.c;
    c.fillStyle = vgrad(c, 0.4, -0.1, k.col("#3FB8D8"), k.col("#2A8FB8")); c.beginPath(); c.ellipse(0, 0.1, 3.4, 0.4, 0, 0, 6.28); c.fill();
    c.fillStyle = rgba("#FFFFFF", 0.35); c.fillRect(-1.5, 0.2, 1.2, 0.05);
    for (const [x, s] of [[-2.6, 0.9], [2.4, 1.05], [0.4, 0.8]] as const) { c.save(); c.translate(x, 0); c.scale(s, s); PAINT.palm[2](k, 0); c.restore(); }
  }],
  snowpine: [3, 5.6, (k) => {
    const c = k.c, g = k.col("#2E6B66"); contact(c, 0.8);
    c.fillStyle = k.col("#5A3E2E"); c.fillRect(-0.14, 0, 0.28, 1);
    for (let i = 0; i < 4; i++) {
      const y = 0.7 + i * 1.1, w = 1.3 - i * 0.26;
      poly(c, [-w, y, w, y, 0, y + 2], hgrad(c, -w, w, shade(g, -0.12), shade(g, 0.1)));
      c.fillStyle = rgba("#FFFFFF", 0.95); c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y + 0.45, w, y); c.lineTo(w * 0.6, y + 0.25); c.quadraticCurveTo(0, y + 0.6, -w * 0.6, y + 0.25); c.closePath(); c.fill();
    }
    poly(c, [-0.3, 4.6, 0.3, 4.6, 0, 5.1], "#FFFFFF");
  }],
  snowman: [1.4, 1.9, (k) => {
    const c = k.c; contact(c, 0.6);
    ball(k, 0, 0.45, 0.48, mix("#FFFFFF", k.look.sky[1], 0.15 + k.night * 0.3), 0.1); ball(k, 0, 1.12, 0.34, mix("#FFFFFF", k.look.sky[1], 0.15 + k.night * 0.3), 0.1); ball(k, 0, 1.6, 0.25, mix("#FFFFFF", k.look.sky[1], 0.15 + k.night * 0.3), 0.1);
    c.fillStyle = "#222"; for (const y of [1.0, 1.15, 1.3]) { c.beginPath(); c.arc(0, y, 0.035, 0, 6.28); c.fill(); }
    c.beginPath(); c.arc(-0.08, 1.66, 0.03, 0, 6.28); c.arc(0.08, 1.66, 0.03, 0, 6.28); c.fill();
    poly(c, [0.02, 1.58, 0.3, 1.55, 0.02, 1.52], "#FF8A3D");
    c.fillStyle = "#E8433B"; c.fillRect(-0.28, 1.36, 0.56, 0.1);
  }],
  igloo: [4, 2.2, (k) => {
    const c = k.c, ice = mix("#F2F8FF", k.look.sky[1], 0.15 + k.night * 0.3);
    c.beginPath(); c.ellipse(0, 0, 1.9, 1.9, 0, Math.PI, 0); c.fillStyle = vgrad(c, 1.9, 0, ice, shade(ice, -0.12)); c.fill();
    c.strokeStyle = rgba(shade(ice, -0.2), 0.6); c.lineWidth = 0.04;
    for (let y = 0.45; y < 1.9; y += 0.45) { const w = Math.sqrt(1.9 * 1.9 - y * y); c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); }
    c.beginPath(); c.ellipse(1.1, 0, 0.55, 0.65, 0, Math.PI, 0); c.fillStyle = ice; c.fill();
    c.beginPath(); c.ellipse(1.1, 0, 0.36, 0.45, 0, Math.PI, 0); c.fillStyle = k.night > 0.3 ? rgba("#FFC46B", 0.95) : shade(ice, -0.45); c.fill();
  }],
  icecrystal: [1.6, 2.2, (k) => { const c = k.c, ice = "#A8E6FF"; if (k.night > 0.3) k.glow(ice, 14); for (const [x, h, a] of [[0, 2, 0], [-0.4, 1.3, -0.35], [0.45, 1.5, 0.3]] as const) { c.save(); c.translate(x, 0); c.rotate(a); poly(c, [-0.18, 0, 0.18, 0, 0.18, h * 0.8, 0, h, -0.18, h * 0.8], hgrad(c, -0.18, 0.18, rgba(ice, 0.75), rgba("#FFFFFF", 0.9))); c.restore(); } k.noGlow(); }],
  lamp: [1.2, 4.3, (k) => {
    const c = k.c, metal = k.col("#3A3F58");
    c.fillStyle = metal; c.fillRect(-0.07, 0, 0.14, 3.9);
    c.strokeStyle = metal; c.lineWidth = 0.1; c.beginPath(); c.moveTo(0, 3.9); c.quadraticCurveTo(0.1, 4.2, 0.5, 4.1); c.stroke();
    if (k.night > 0.2) k.glow("#FFE3A0", 22);
    c.fillStyle = k.night > 0.2 ? "#FFF2C8" : k.col("#D8DCE8"); rr(c, 0.3, 3.92, 0.42, 0.16, 0.05); c.fill();
    k.noGlow();
  }],
  cone: [0.7, 0.8, (k) => { const c = k.c; poly(c, [-0.32, 0, 0.32, 0, 0.08, 0.75, -0.08, 0.75], hgrad(c, -0.3, 0.3, k.col("#E8612C"), k.col("#FF8A4C"))); c.fillStyle = "#F4F4F8"; c.fillRect(-0.2, 0.32, 0.4, 0.12); c.fillStyle = k.col("#2B2D42"); c.fillRect(-0.4, 0, 0.8, 0.07); }],
  barrier: [2.2, 1.1, (k) => { const c = k.c; c.fillStyle = k.col("#5A5F78"); c.fillRect(-0.9, 0, 0.12, 1); c.fillRect(0.78, 0, 0.12, 1); rr(c, -1.05, 0.55, 2.1, 0.38, 0.06); c.fillStyle = "#F4F4F8"; c.fill(); c.save(); c.clip(); c.fillStyle = "#E8433B"; for (let x = -1.2; x < 1.2; x += 0.5) poly(c, [x, 0.55, x + 0.25, 0.55, x + 0.5, 0.93, x + 0.25, 0.93], "#E8433B"); c.restore(); if (k.night > 0.3) { k.glow("#FFB23A", 10); c.fillStyle = "#FFB23A"; c.beginPath(); c.arc(-0.84, 1.05, 0.07, 0, 6.28); c.fill(); k.noGlow(); } }],
  billboard: [6.4, 6.6, (k, v) => {
    const c = k.c, frame = k.col("#2B2D42");
    c.fillStyle = frame; c.fillRect(-0.15, 0, 0.3, 3.4); c.fillRect(-2.2, 2.6, 0.2, 0.8); c.fillRect(2, 2.6, 0.2, 0.8);
    rr(c, -3, 3.2, 6, 3.2, 0.2); c.fillStyle = frame; c.fill();
    const a = [k.look.world.accent, "#4FF0FF", "#FFD23F"][v], b = ["#7B5CFF", "#FF4FB8", "#FF6B3D"][v];
    rr(c, -2.8, 3.4, 5.6, 2.8, 0.15); c.fillStyle = hgrad(c, -2.8, 2.8, a, b); c.fill();
    k.glow(a, 18 + 10 * k.night);
    c.strokeStyle = "#FFFFFF"; c.lineWidth = 0.12; c.lineCap = "round";
    // a road-and-wheel logo, no words
    c.beginPath(); c.arc(-1.2, 4.6, 0.55, 0, 6.28); c.moveTo(0.1, 4.05); c.lineTo(2.2, 4.05); c.moveTo(0.1, 4.6); c.lineTo(1.8, 4.6); c.moveTo(0.1, 5.15); c.lineTo(2.2, 5.15); c.stroke();
    k.noGlow();
  }],
  crane: [9, 14, (k) => {
    const c = k.c, y = k.col("#FFB23A"); c.strokeStyle = y; c.lineWidth = 0.12;
    for (let h = 0; h < 12; h += 1) { c.strokeRect(-0.45, h, 0.9, 1); c.beginPath(); c.moveTo(-0.45, h); c.lineTo(0.45, h + 1); c.stroke(); }
    c.fillStyle = y; c.fillRect(-2.4, 12, 6.8, 0.5); c.fillRect(-2.4, 11.4, 1, 0.6);
    c.strokeStyle = k.col("#5A5F78"); c.lineWidth = 0.04; c.beginPath(); c.moveTo(3.6, 12); c.lineTo(3.6, 8); c.stroke(); c.fillStyle = k.col("#5A5F78"); c.fillRect(3.3, 7.6, 0.6, 0.4);
    if (k.night > 0.2) { k.glow("#FF4D6D", 10); c.fillStyle = "#FF4D6D"; c.beginPath(); c.arc(0, 12.8, 0.15, 0, 6.28); c.fill(); k.noGlow(); }
  }],
  fern: [1.8, 1.3, (k) => { const c = k.c, g = k.col("#3FA85A"); for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + (i / 6) * 0.7); const ex = Math.cos(a) * 0.95, ey = Math.sin(a) * 1.2; c.strokeStyle = i % 2 ? g : shade(g, 0.12); c.lineWidth = 0.08; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(ex * 0.4, ey * 0.9, ex, ey * 0.75); c.stroke(); for (let t = 0.2; t < 1; t += 0.12) { const px = ex * 0.4 * t * 2 * (1 - t) + ex * t * t, py = ey * 0.9 * 2 * t * (1 - t) + ey * 0.75 * t * t; c.beginPath(); c.ellipse(px, py, 0.1 * (1 - t) + 0.03, 0.03, a, 0, 6.28); c.fillStyle = g; c.fill(); } } }],
  bigleaf: [2.6, 2.6, (k, v) => {
    const c = k.c, g = k.col(["#2FA35A", "#3DB86A", "#25945A"][v]);
    for (const [a, s] of [[-0.6, 1], [0.5, 0.9], [0, 1.15]] as const) {
      c.save(); c.rotate(a);
      c.strokeStyle = k.col("#2E7A44"); c.lineWidth = 0.06; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 1.2 * s); c.stroke();
      c.beginPath(); c.moveTo(0, 0.9 * s); c.bezierCurveTo(-0.9 * s, 1.3 * s, -0.6 * s, 2.3 * s, 0, 2.4 * s); c.bezierCurveTo(0.6 * s, 2.3 * s, 0.9 * s, 1.3 * s, 0, 0.9 * s);
      c.fillStyle = hgrad(c, -0.8, 0.8, shade(g, -0.12), shade(g, 0.18)); c.fill();
      c.strokeStyle = rgba(shade(g, 0.35), 0.6); c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, 0.95 * s); c.lineTo(0, 2.3 * s); c.stroke();
      c.restore();
    }
  }],
  totem: [1.6, 4, (k) => {
    const c = k.c, w = k.col("#8A5A3B"); contact(c, 0.6);
    rr(c, -0.5, 0, 1, 3.6, 0.15); c.fillStyle = hgrad(c, -0.5, 0.5, shade(w, -0.15), shade(w, 0.12)); c.fill();
    const cols = ["#E8433B", "#2EC4B6", "#FFD23F"].map((x) => k.col(x));
    for (let i = 0; i < 3; i++) { const y = 0.4 + i * 1.1; c.fillStyle = cols[i]; c.fillRect(-0.5, y + 0.6, 1, 0.12); c.fillStyle = "#1B1F2B"; c.beginPath(); c.arc(-0.18, y + 0.4, 0.09, 0, 6.28); c.arc(0.18, y + 0.4, 0.09, 0, 6.28); c.fill(); c.fillRect(-0.2, y + 0.12, 0.4, 0.08); }
    poly(c, [-1.1, 3.4, 1.1, 3.4, 0.5, 3.8, -0.5, 3.8], cols[0]);
  }],
  bloom: [1.4, 1.5, (k, v) => {
    const c = k.c, petal = k.col(["#FF5D8F", "#FF8A3D", "#B57CFF"][v]);
    c.strokeStyle = k.col("#2E8B57"); c.lineWidth = 0.08; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.2, 0.6, 0, 1.1); c.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.save(); c.translate(0, 1.1); c.rotate(a); c.beginPath(); c.ellipse(0, 0.22, 0.13, 0.26, 0, 0, 6.28); c.fillStyle = hgrad(c, -0.13, 0.13, petal, shade(petal, 0.25)); c.fill(); c.restore(); }
    ball(k, 0, 1.1, 0.12, k.col("#FFD23F"), 0.4);
  }],
  deadtree: [3, 4.2, (k) => {
    const c = k.c, w = k.col("#3A2E2C");
    trunk(k, 0, 0, 0.1, 3, 0.3, w);
    for (const [x, y, ex, ey] of [[0.05, 1.8, -1.1, 3], [0.08, 2.4, 1, 3.6], [0.1, 2.9, -0.4, 4], [-0.6, 2.5, -1.2, 2.6]] as const) { c.strokeStyle = w; c.lineWidth = 0.12; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 + 0.3, ex, ey); c.stroke(); }
  }],
  lavarock: [1.8, 1.2, (k, v) => {
    PAINT.rock[2](k, v);
    const c = k.c; k.glow("#FF6A2B", 12);
    c.strokeStyle = "#FF8A2B"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-0.5, 0.2); c.lineTo(-0.2, 0.5); c.lineTo(0.1, 0.35); c.lineTo(0.4, 0.7); c.stroke();
    k.noGlow();
  }],
  geyser: [1.6, 0.6, (k) => { const c = k.c, s = k.col("#5A4A4E"); c.beginPath(); c.ellipse(0, 0, 0.75, 0.45, 0, Math.PI, 0); c.fillStyle = vgrad(c, 0.45, 0, shade(s, 0.15), s); c.fill(); c.beginPath(); c.ellipse(0, 0.38, 0.28, 0.08, 0, 0, 6.28); c.fillStyle = "#FF8A2B"; k.glow("#FF6A2B", 12); c.fill(); k.noGlow(); }],
  obsidian: [1.6, 2, (k) => { const c = k.c; for (const [x, h, a] of [[0, 1.9, 0.05], [-0.45, 1.2, -0.3], [0.42, 1.4, 0.35]] as const) { c.save(); c.translate(x, 0); c.rotate(a); poly(c, [-0.22, 0, 0.22, 0, 0.05, h], hgrad(c, -0.22, 0.22, "#1A1420", "#4A3A5A")); poly(c, [0.05, h, 0.22, 0, 0.08, 0], rgba(k.lit, 0.3)); c.restore(); } }],
  lighthouse: [3.6, 10.5, (k) => {
    const c = k.c; contact(c, 1.6);
    c.save(); c.beginPath(); c.moveTo(-1.2, 0); c.lineTo(1.2, 0); c.lineTo(0.75, 8); c.lineTo(-0.75, 8); c.closePath(); c.clip();
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? k.col("#E8433B") : k.col("#F6F2EA"); c.fillRect(-1.3, i * 1.6, 2.6, 1.6); }
    c.fillStyle = hgrad(c, -1.2, 1.2, rgba("#000000", 0.18), rgba("#FFFFFF", 0.12)); c.fillRect(-1.3, 0, 2.6, 8);
    c.restore();
    c.fillStyle = k.col("#2B2D42"); c.fillRect(-1, 8, 2, 0.25); c.fillRect(-0.6, 8.25, 1.2, 1.2);
    c.fillStyle = k.night > 0.2 ? "#FFF4C2" : k.col("#BFE4F5"); if (k.night > 0.2) k.glow("#FFE98A", 20); c.fillRect(-0.45, 8.35, 0.9, 1); k.noGlow();
    poly(c, [-0.8, 9.45, 0.8, 9.45, 0, 10.3], k.col("#E8433B"));
  }],
  umbrella: [2.6, 2.6, (k, v) => {
    const c = k.c; c.strokeStyle = k.col("#F4F4F8"); c.lineWidth = 0.07; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.1, 2.2); c.stroke();
    const cols = [["#FF5D6C", "#FFFFFF"], ["#2EC4B6", "#FFD23F"], ["#7B5CFF", "#FFFFFF"]][v];
    for (let i = 0; i < 6; i++) { const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI; c.beginPath(); c.moveTo(0.1, 2.3); c.arc(0.1, 1.85, 1.25, a0, a1); c.closePath(); c.fillStyle = k.col(cols[i % 2]); c.fill(); }
  }],
  shell: [0.6, 0.4, (k) => { const c = k.c; c.beginPath(); c.moveTo(-0.25, 0); c.quadraticCurveTo(0, 0.6, 0.25, 0); c.closePath(); c.fillStyle = vgrad(c, 0.35, 0, k.col("#FFC2A8"), k.col("#F08A7A")); c.fill(); c.strokeStyle = rgba("#FFFFFF", 0.6); c.lineWidth = 0.02; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, 0.02); c.lineTo(i * 0.1, 0.28); c.stroke(); } }],
  crab: [0.9, 0.6, (k) => { const c = k.c, r_ = k.col("#F0573F"); c.strokeStyle = r_; c.lineWidth = 0.04; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 0.18, 0.15); c.lineTo(s * (0.32 + i * 0.05), 0.02 + i * 0.02); c.stroke(); } c.beginPath(); c.ellipse(0, 0.2, 0.25, 0.14, 0, 0, 6.28); c.fillStyle = r_; c.fill(); ball(k, -0.3, 0.38, 0.09, r_); ball(k, 0.3, 0.38, 0.09, r_); c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(-0.07, 0.36, 0.045, 0, 6.28); c.arc(0.07, 0.36, 0.045, 0, 6.28); c.fill(); c.fillStyle = "#111"; c.beginPath(); c.arc(-0.07, 0.36, 0.02, 0, 6.28); c.arc(0.07, 0.36, 0.02, 0, 6.28); c.fill(); }],
  maple: [4.4, 5.4, (k, v) => {
    const c = k.c; contact(c, 1.2);
    trunk(k, 0, 0, -0.1, 2.5, 0.4, k.col("#5E3A26"));
    const cols = ["#E8712A", "#D9542B", "#F2A33A", "#C9402A"];
    for (const [x, y, s] of [[-1, 2.7, 1], [1, 2.8, 1], [0, 3.7, 1.3], [-0.6, 3.4, 0.9], [0.6, 3.5, 0.9]] as const) ball(k, x, y, s, k.col(cols[(Math.floor(k.r() * 4) + v) % 4]));
  }],
  pumpkin: [0.9, 0.7, (k) => { const c = k.c, o = k.col("#F08A24"); for (const x of [-0.2, 0.2, 0]) { c.beginPath(); c.ellipse(x, 0.3, 0.26, 0.3, 0, 0, 6.28); c.fillStyle = hgrad(c, x - 0.26, x + 0.26, shade(o, -0.12), shade(o, 0.15)); c.fill(); } c.fillStyle = k.col("#5A7A2E"); c.fillRect(-0.04, 0.55, 0.08, 0.14); if (k.night > 0.6) { k.glow("#FFB23A", 10); poly(c, [-0.16, 0.36, -0.06, 0.36, -0.11, 0.44], "#FFD26B"); poly(c, [0.06, 0.36, 0.16, 0.36, 0.11, 0.44], "#FFD26B"); k.noGlow(); } }],
  scarecrow: [2, 2.6, (k) => {
    const c = k.c, wood = k.col("#7A5533");
    c.fillStyle = wood; c.fillRect(-0.05, 0, 0.1, 2.3); c.fillRect(-0.9, 1.6, 1.8, 0.1);
    rr(c, -0.35, 1.05, 0.7, 0.75, 0.12); c.fillStyle = k.col("#3E7FD9"); c.fill();
    ball(k, 0, 2.05, 0.26, k.col("#F3D27A"), 0.2);
    poly(c, [-0.45, 2.18, 0.45, 2.18, 0.2, 2.5, -0.2, 2.5], k.col("#8A5A3B"));
    c.fillStyle = "#2B2D42"; c.beginPath(); c.arc(-0.08, 2.08, 0.03, 0, 6.28); c.arc(0.08, 2.08, 0.03, 0, 6.28); c.fill();
  }],
  barn: [6.4, 5.2, (k) => {
    const c = k.c; contact(c, 2.8); const red = k.col("#C8452F");
    poly(c, [-2.8, 0, 2.8, 0, 2.8, 2.8, 1.8, 4.2, 0, 4.9, -1.8, 4.2, -2.8, 2.8], vgrad(c, 4.9, 0, shade(red, 0.1), shade(red, -0.15)));
    c.strokeStyle = rgba(shade(red, -0.3), 0.6); c.lineWidth = 0.05; for (let x = -2.6; x < 2.8; x += 0.4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 2.9); c.stroke(); }
    c.strokeStyle = "#F6F2EA"; c.lineWidth = 0.15; c.strokeRect(-1, 0, 2, 2.2); c.beginPath(); c.moveTo(-1, 0); c.lineTo(1, 2.2); c.moveTo(1, 0); c.lineTo(-1, 2.2); c.stroke();
    rr(c, -0.4, 3, 0.8, 0.8, 0.08); c.fillStyle = k.night > 0.3 ? rgba("#FFD98A", 0.95) : k.col("#5A3826"); c.fill();
  }],
  crystal: [1.6, 2.2, (k, v) => {
    const c = k.c, col = [k.look.world.glow, k.look.world.accent, "#FF7CE0"][v];
    k.glow(col, 18);
    for (const [x, h, a] of [[0, 2, 0.05], [-0.4, 1.3, -0.4], [0.45, 1.5, 0.32]] as const) { c.save(); c.translate(x, 0); c.rotate(a); poly(c, [-0.2, 0, 0.2, 0, 0.2, h * 0.75, 0, h, -0.2, h * 0.75], hgrad(c, -0.2, 0.2, rgba(col, 0.85), rgba("#FFFFFF", 0.9))); c.restore(); }
    k.noGlow();
  }],
  stalagmite: [1.4, 2.6, (k) => { const c = k.c, s = k.col(k.look.world.ridges[2].color); c.beginPath(); c.moveTo(-0.55, 0); c.quadraticCurveTo(-0.2, 1.2, 0, 2.5); c.quadraticCurveTo(0.2, 1.2, 0.55, 0); c.closePath(); c.fillStyle = hgrad(c, -0.5, 0.5, shade(s, 0.05), shade(s, 0.3)); c.fill(); }],
  glowshroom: [1.1, 1.1, (k, v) => {
    const c = k.c, col = ["#7CF5FF", "#B57CFF", "#7CFFB0"][v];
    for (const [x, s] of [[0, 1], [-0.35, 0.65], [0.32, 0.55]] as const) {
      c.fillStyle = k.col("#D8D0F0"); rr(c, x - 0.06 * s, 0, 0.12 * s, 0.55 * s, 0.04); c.fill();
      k.glow(col, 16); c.beginPath(); c.ellipse(x, 0.55 * s, 0.32 * s, 0.22 * s, 0, Math.PI, 0); c.fillStyle = col; c.fill(); k.noGlow();
    }
  }],
  lantern: [0.8, 2, (k) => { const c = k.c; c.fillStyle = k.col("#5A4A6E"); c.fillRect(-0.04, 0, 0.08, 1.6); c.fillRect(-0.04, 1.55, 0.35, 0.06); k.glow("#FFC46B", 18); rr(c, 0.18, 1.1, 0.26, 0.36, 0.06); c.fillStyle = "#FFE3A0"; c.fill(); k.noGlow(); }],
  minecart: [2.4, 1.6, (k) => { const c = k.c, m = k.col("#6E6E80"); poly(c, [-1.1, 0.35, 1.1, 0.35, 1.25, 1.2, -1.25, 1.2], hgrad(c, -1.2, 1.2, shade(m, -0.15), shade(m, 0.12))); for (const x of [-0.7, 0.7]) ball(k, x, 0.22, 0.22, k.col("#3A3A48")); for (let i = 0; i < 5; i++) { k.glow(i % 2 ? k.look.world.glow : "#FF7CE0", 12); poly(c, [-0.8 + i * 0.4, 1.2, -0.6 + i * 0.4, 1.2, -0.7 + i * 0.4, 1.55], i % 2 ? k.look.world.glow : "#FF7CE0"); } k.noGlow(); }],
  moonrock: [1.6, 1, (k, v) => PAINT.rock[2](k, v)],
  antenna: [3, 6.4, (k) => { const c = k.c, m = k.col("#B8BCCC"); c.strokeStyle = m; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-1, 0); c.lineTo(0, 6); c.lineTo(1, 0); c.moveTo(-0.6, 2); c.lineTo(0.6, 2); c.moveTo(-0.35, 3.8); c.lineTo(0.35, 3.8); c.stroke(); rr(c, -0.5, 0, 1, 0.5, 0.05); c.fillStyle = shade(m, -0.2); c.fill(); }],
  dish: [3, 3.2, (k) => { const c = k.c, m = k.col("#D8DCE8"); c.fillStyle = shade(m, -0.25); c.fillRect(-0.1, 0, 0.2, 1.6); c.save(); c.translate(0, 1.8); c.rotate(-0.5); c.beginPath(); c.ellipse(0, 0, 1.3, 0.5, 0, 0, Math.PI); c.fillStyle = vgrad(c, 0, -0.5, shade(m, 0.1), shade(m, -0.15)); c.fill(); c.strokeStyle = m; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0, -0.1); c.lineTo(0, -0.9); c.stroke(); c.restore(); }],
  planetflag: [1.4, 2.4, (k) => { const c = k.c; c.fillStyle = k.col("#D8DCE8"); c.fillRect(-0.03, 0, 0.06, 2.3); c.fillStyle = k.col("#2E9BFF"); c.fillRect(0.03, 1.6, 0.9, 0.6); c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(0.48, 1.9, 0.14, 0, 6.28); c.fill(); }],
};

/** sprites for one stage, painted on first use */
export class PropSprites {
  private cache = new Map<string, Sprite>();
  constructor(private look: Look, private res: number) {}
  get(kind: PropKind, variant: number, back: boolean): Sprite {
    const v = variant % 3;
    const key = `${kind}:${v}:${back ? 1 : 0}`;
    let s = this.cache.get(key);
    if (!s) { s = this.paint(kind, v, back); this.cache.set(key, s); }
    return s;
  }
  private paint(kind: PropKind, v: number, back: boolean): Sprite {
    const [w, h, fn] = PAINT[kind];
    const ppm = PPM * this.res;
    const pad = 0.6;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil((w + pad * 2) * ppm); cv.height = Math.ceil((h + pad * 2) * ppm);
    const c = cv.getContext("2d")!;
    c.translate(cv.width / 2, cv.height - pad * ppm);
    c.scale(ppm, -ppm);
    const look = this.look;
    const night = look.night;
    // props behind the track sit a little deeper in the haze and the dark
    const deep = back ? 0.18 : 0;
    const col = (hex: string, kk = 1) => {
      let x = mix(hex, look.tint, look.tintAmt * 0.6 * kk);
      if (deep) x = mix(x, look.haze, deep);
      const dark = (look.enclosed ? 0.3 : night * 0.55) + deep * 0.3;
      return dark > 0 ? shade(x, -dark * kk) : x;
    };
    const kit: Kit = {
      c, r: makeRng(v * 7919 + kind.length * 104729), look, col, lit: look.light, side: look.sunX > 0.5 ? 1 : -1, night,
      glow: (color, blur) => { c.shadowColor = color; c.shadowBlur = blur * this.res; },
      noGlow: () => { c.shadowBlur = 0; },
    };
    fn(kit, v);
    return { cv, w: cv.width / ppm, h: cv.height / ppm, ax: cv.width / 2 / ppm, ay: pad };
  }
}

/** props that move: drawn on top of their sprite every frame */
export function propMotion(c: CanvasRenderingContext2D, kind: PropKind, t: number, seed: number, night: number, s: number) {
  switch (kind) {
    case "windmill": {
      c.save(); c.translate(0, 6.9 * s); c.rotate(-t * 0.9 - seed);
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.fillStyle = "rgba(235,228,214,0.95)"; c.fillRect(-0.08 * s, 0, 0.16 * s, 3.4 * s);
        c.fillStyle = "rgba(200,85,61,0.85)"; c.fillRect(0.08 * s, 0.6 * s, 0.55 * s, 2.6 * s);
      }
      c.fillStyle = "#6B4A35"; c.beginPath(); c.arc(0, 0, 0.25 * s, 0, 6.28); c.fill();
      c.restore();
      break;
    }
    case "lighthouse": {
      if (night < 0.2) break;
      c.save(); c.translate(0, 8.85 * s);
      const a = Math.sin(t * 0.8 + seed) * 0.9;
      const g = c.createLinearGradient(0, 0, 18 * s, 0);
      g.addColorStop(0, "rgba(255,240,180,0.55)"); g.addColorStop(1, "rgba(255,240,180,0)");
      c.rotate(a); c.fillStyle = g;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(18 * s, 1.8 * s); c.lineTo(18 * s, -1.8 * s); c.closePath(); c.fill();
      c.restore();
      break;
    }
    case "antenna": {
      if (Math.sin(t * 3 + seed) > 0.2) { c.fillStyle = "#FF4D6D"; c.shadowColor = "#FF4D6D"; c.shadowBlur = 8; c.beginPath(); c.arc(0, 6.05 * s, 0.14 * s, 0, 6.28); c.fill(); c.shadowBlur = 0; }
      break;
    }
    case "geyser": {
      const cyc = (t * 0.35 + seed * 0.1) % 1;
      if (cyc < 0.35) {
        const h = Math.sin((cyc / 0.35) * Math.PI) * 5 * s;
        for (let k = 0; k < 7; k++) {
          const y = 0.4 * s + (k / 7) * h, rr_ = (0.25 + k * 0.12) * s;
          c.fillStyle = `rgba(240,236,240,${0.5 - k * 0.05})`;
          c.beginPath(); c.arc(Math.sin(t * 4 + k) * 0.2 * s, y, rr_, 0, 6.28); c.fill();
        }
      }
      break;
    }
  }
}
export const PROP_SPINS: Partial<Record<PropKind, boolean>> = { tumbleweed: true };
export const PROP_BOBS: Partial<Record<PropKind, number>> = { balloon: 9 };
export const PROP_GLOWS: Partial<Record<PropKind, string>> = { lamp: "#FFE3A0", lantern: "#FFC46B", crystal: "", glowshroom: "", icecrystal: "#A8E6FF" };
