// Scenery that stands along the course, four kinds per world, painted once per stage as sprites (planted on the
// ground behind the track, so the ground covers their feet):
//   toys: a block tower, a wooden tree, a rubber duck, a spinning top · candy: a lollipop, a candy cane, a cupcake, a
//   gumdrop · building site: a cone, a barrier, a lamp, a toolbox · sky isles: a flowering bush, a windmill, a rock, a
//   tree · neon: a lamp, a palm, an arcade sign, a cactus light · glacier: an ice crystal, a snowy pine, an antenna, a
//   snowman · scrapyard: a tyre stack, a drum, an old TV, a sign · mushrooms: a glowing toadstool, a fern, a lantern,
//   a cluster · reef: coral, an anemone, kelp, a clam · clockwork: a gas lamp, a gear, a valve, a clock post · carnival:
//   a grave, a pumpkin, a dead tree, a lantern · station: an antenna dish, a crystal, a beacon, a crate.
import type { Look } from "./look";
import { makeRng, mix, rgba, shade, type Rng } from "../util";

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const SW = 160, SH = 220;
export interface PropSprite { cv: HTMLCanvasElement; h: number }

type Painter = (g: C, r: Rng, L: Look, lit: (c: string) => string) => number;
function rr(g: C, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function glow(g: C, x: number, y: number, rad: number, col: string, a: number) {
  const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, rgba(col, a)); rg.addColorStop(1, rgba(col, 0));
  g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

const P: Record<string, Painter[]> = {
  toybox: [
    (g, r, L, lit) => { let y = SH; ["#FF6B6B", "#FFC93C", "#4D96FF"].forEach((col, k) => { const s = 52 - k * 6; g.fillStyle = lit(col); rr(g, 80 - s / 2 + (r() - 0.5) * 8, y - s, s, s, 6); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.8); g.font = `bold ${s * 0.6}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("XYZ"[k], 80, y - s / 2 + 2); y -= s; }); return 2.1; },
    (g, r, L, lit) => { g.fillStyle = lit("#B07A44"); rr(g, 74, 110, 12, 110, 4); g.fill(); g.fillStyle = lit("#58C46B"); g.beginPath(); g.arc(80, 80, 52, 0, TAU); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.25); g.beginPath(); g.arc(62, 60, 18, 0, TAU); g.fill(); return 2.4; },
    (g, r, L, lit) => { g.fillStyle = lit("#FFD23F"); g.beginPath(); g.ellipse(80, 185, 56, 34, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(104, 138, 30, 0, TAU); g.fill(); g.fillStyle = lit("#FF8A3D"); g.beginPath(); g.ellipse(136, 142, 14, 7, 0, 0, TAU); g.fill(); g.fillStyle = "#2B2342"; g.beginPath(); g.arc(112, 130, 4.5, 0, TAU); g.fill(); return 1.3; },
    (g, r, L, lit) => { const cols = ["#FF6B6B", "#FFFFFF", "#4D96FF", "#FFFFFF"]; for (let k = 0; k < 4; k++) { g.fillStyle = lit(cols[k]); g.beginPath(); g.moveTo(80, 216); g.lineTo(80 - 50 + k * 25, 150); g.lineTo(80 - 50 + (k + 1) * 25, 150); g.fill(); } g.fillStyle = lit("#FF6B6B"); g.beginPath(); g.ellipse(80, 150, 52, 18, 0, Math.PI, 0); g.fill(); g.fillStyle = lit("#B07A44"); g.fillRect(76, 100, 8, 40); return 1.4; },
  ],
  candy: [
    (g, r, L, lit) => { g.fillStyle = lit("#FFFFFF"); g.fillRect(76, 90, 8, 130); const col = lit(["#FF5FA2", "#FFB13D", "#7C6BFF"][Math.floor(r() * 3)]); g.fillStyle = col; g.beginPath(); g.arc(80, 70, 50, 0, TAU); g.fill(); g.strokeStyle = rgba("#FFFFFF", 0.7); g.lineWidth = 8; g.beginPath(); for (let a = 0; a < TAU * 2.3; a += 0.2) { const rr2 = (a / (TAU * 2.3)) * 42; g.lineTo(80 + Math.cos(a) * rr2, 70 + Math.sin(a) * rr2); } g.stroke(); return 2.6; },
    (g, r, L, lit) => { g.lineCap = "round"; g.strokeStyle = lit("#FFFFFF"); g.lineWidth = 22; g.beginPath(); g.moveTo(90, 216); g.lineTo(90, 70); g.arc(64, 70, 26, 0, Math.PI, true); g.stroke(); g.strokeStyle = lit("#FF4F7A"); g.lineWidth = 22; g.setLineDash([14, 14]); g.beginPath(); g.moveTo(90, 216); g.lineTo(90, 70); g.arc(64, 70, 26, 0, Math.PI, true); g.stroke(); g.setLineDash([]); return 2.6; },
    (g, r, L, lit) => { g.fillStyle = lit("#E8A04E"); g.beginPath(); g.moveTo(40, 150); g.lineTo(120, 150); g.lineTo(108, 216); g.lineTo(52, 216); g.fill(); g.fillStyle = lit("#FFB8DC"); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(50 + k * 20, 146, 18, 0, TAU); g.fill(); } g.beginPath(); g.arc(80, 120, 26, 0, TAU); g.fill(); g.fillStyle = "#FF3B5C"; g.beginPath(); g.arc(80, 92, 10, 0, TAU); g.fill(); return 1.5; },
    (g, r, L, lit) => { const col = lit(["#7CF5C8", "#FFD23F", "#FF6FB5"][Math.floor(r() * 3)]); g.fillStyle = col; g.beginPath(); g.moveTo(30, 216); g.quadraticCurveTo(30, 120, 80, 116); g.quadraticCurveTo(130, 120, 130, 216); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.6); for (let k = 0; k < 12; k++) g.fillRect(40 + r() * 80, 130 + r() * 80, 4, 4); return 1.2; },
  ],
  hardhat: [
    (g, r, L, lit) => { g.fillStyle = lit("#FF7A1A"); g.beginPath(); g.moveTo(44, 216); g.lineTo(70, 110); g.lineTo(90, 110); g.lineTo(116, 216); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.9); g.fillRect(58, 150, 44, 14); g.fillRect(52, 182, 56, 12); g.fillStyle = lit("#2A2A2A"); g.fillRect(30, 206, 100, 12); return 1.1; },
    (g, r, L, lit) => { g.fillStyle = lit("#E8E8E8"); g.fillRect(20, 130, 120, 40); g.save(); g.beginPath(); g.rect(20, 130, 120, 40); g.clip(); g.fillStyle = lit("#FF5A3D"); for (let x = -40; x < 160; x += 40) { g.beginPath(); g.moveTo(x, 170); g.lineTo(x + 20, 170); g.lineTo(x + 60, 130); g.lineTo(x + 40, 130); g.fill(); } g.restore(); g.fillStyle = lit("#5C5F6B"); g.fillRect(30, 170, 10, 46); g.fillRect(120, 170, 10, 46); return 1.3; },
    (g, r, L, lit) => { g.fillStyle = lit("#5C5F6B"); g.fillRect(76, 40, 8, 180); g.fillRect(60, 36, 40, 10); glow(g, 80, 54, 40, "#FFE6A0", 0.35 + L.night * 0.5); g.fillStyle = "#FFF3C0"; g.fillRect(66, 46, 28, 10); return 3.2; },
    (g, r, L, lit) => { g.fillStyle = lit("#C0392B"); rr(g, 30, 160, 100, 56, 8); g.fill(); g.fillStyle = lit("#8A1C10"); g.fillRect(30, 180, 100, 6); g.strokeStyle = lit("#5C5F6B"); g.lineWidth = 8; g.beginPath(); g.arc(80, 160, 22, Math.PI, 0); g.stroke(); return 0.9; },
  ],
  skyisles: [
    (g, r, L, lit) => { g.fillStyle = lit("#4FBF62"); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(40 + k * 16, 190 - Math.sin(k) * 20, 30, 0, TAU); g.fill(); } for (let k = 0; k < 9; k++) { g.fillStyle = ["#FF8AB8", "#FFE14D", "#FFFFFF"][k % 3]; g.beginPath(); g.arc(30 + r() * 100, 160 + r() * 40, 6, 0, TAU); g.fill(); } return 1.2; },
    (g, r, L, lit) => { g.fillStyle = lit("#F5F1E6"); g.beginPath(); g.moveTo(62, 216); g.lineTo(72, 90); g.lineTo(88, 90); g.lineTo(98, 216); g.fill(); g.fillStyle = lit("#C0392B"); g.beginPath(); g.moveTo(66, 92); g.lineTo(80, 66); g.lineTo(94, 92); g.fill(); g.save(); g.translate(80, 96); g.rotate(r() * 6); g.fillStyle = lit("#B8A88A"); for (let k = 0; k < 4; k++) { g.rotate(TAU / 4); g.fillRect(-6, 0, 12, 64); } g.restore(); return 3; },
    (g, r, L, lit) => { g.fillStyle = lit("#A8A0B0"); g.beginPath(); g.moveTo(20, 216); g.lineTo(40, 150); g.lineTo(90, 126); g.lineTo(136, 160); g.lineTo(144, 216); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.2); g.beginPath(); g.moveTo(40, 150); g.lineTo(90, 126); g.lineTo(80, 160); g.fill(); return 1.2; },
    (g, r, L, lit) => { g.fillStyle = lit("#8A6A4A"); g.fillRect(74, 100, 12, 120); g.fillStyle = lit("#FFB0C8"); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(50 + k * 15, 80 - Math.sin(k * 1.3) * 20, 30, 0, TAU); g.fill(); } return 2.6; },
  ],
  neon: [
    (g, r, L, lit) => { g.fillStyle = lit("#2A1F4F"); g.fillRect(76, 50, 8, 170); g.fillRect(76, 50, 40, 8); glow(g, 112, 66, 40, "#2BF6FF", 0.7); g.fillStyle = "#E0FFFF"; g.fillRect(104, 58, 20, 10); return 3; },
    (g, r, L, lit) => { g.strokeStyle = lit("#1C0E3A"); g.lineWidth = 10; g.beginPath(); g.moveTo(80, 216); g.quadraticCurveTo(84, 140, 96, 70); g.stroke(); g.fillStyle = lit("#1C0E3A"); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; g.beginPath(); g.moveTo(96, 70); g.quadraticCurveTo(96 + Math.cos(a) * 40, 60 + Math.sin(a) * 30, 96 + Math.cos(a) * 64, 80 + Math.sin(a) * 20); g.lineTo(96, 76); g.fill(); } g.strokeStyle = rgba("#FF3DCB", 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(80, 216); g.quadraticCurveTo(84, 140, 96, 70); g.stroke(); return 3.2; },
    (g, r, L, lit) => { g.fillStyle = lit("#140B2E"); g.fillRect(70, 120, 6, 100); g.fillRect(84, 120, 6, 100); g.strokeStyle = "#FFE14D"; g.lineWidth = 5; g.shadowColor = "#FFE14D"; g.shadowBlur = 12; rr(g, 30, 70, 100, 56, 10); g.stroke(); g.font = "bold 30px sans-serif"; g.fillStyle = "#FF3DCB"; g.textAlign = "center"; g.fillText("GO!", 80, 110); g.shadowBlur = 0; return 2.6; },
    (g, r, L, lit) => { g.strokeStyle = "#3DFF9A"; g.lineWidth = 12; g.lineCap = "round"; g.shadowColor = "#3DFF9A"; g.shadowBlur = 14; g.beginPath(); g.moveTo(80, 216); g.lineTo(80, 90); g.moveTo(80, 160); g.lineTo(54, 160); g.lineTo(54, 126); g.moveTo(80, 140); g.lineTo(106, 140); g.lineTo(106, 110); g.stroke(); g.shadowBlur = 0; void lit; return 1.8; },
  ],
  glacier: [
    (g, r, L, lit) => { for (let k = 0; k < 3; k++) { const h = 80 + r() * 70; g.save(); g.translate(60 + k * 20, 216); g.rotate((k - 1) * 0.25); g.fillStyle = rgba(lit("#BFF0FF"), 0.9); g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -h); g.lineTo(0, -h - 20); g.lineTo(14, -h); g.lineTo(14, 0); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.5); g.fillRect(-12, -h, 6, h); g.restore(); } return 2; },
    (g, r, L, lit) => { g.fillStyle = lit("#2E6E5A"); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(80, 40 + k * 38); g.lineTo(30 - k * 6, 100 + k * 38); g.lineTo(130 + k * 6, 100 + k * 38); g.fill(); } g.fillStyle = "#FFFFFF"; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(80, 40 + k * 38); g.lineTo(56 - k * 3, 70 + k * 38); g.lineTo(104 + k * 3, 70 + k * 38); g.fill(); } g.fillStyle = lit("#6E4A3A"); g.fillRect(74, 200, 12, 20); return 3; },
    (g, r, L, lit) => { g.strokeStyle = lit("#7E96AE"); g.lineWidth = 6; g.beginPath(); g.moveTo(80, 216); g.lineTo(80, 70); g.moveTo(80, 120); g.lineTo(50, 216); g.moveTo(80, 120); g.lineTo(110, 216); g.stroke(); g.fillStyle = lit("#E4EEF6"); g.beginPath(); g.ellipse(80, 66, 40, 16, -0.4, 0, TAU); g.fill(); glow(g, 80, 50, 18, "#FF5A5F", 0.5 + L.night * 0.5); return 3; },
    (g, r, L, lit) => { g.fillStyle = lit("#FFFFFF"); g.beginPath(); g.arc(80, 186, 32, 0, TAU); g.fill(); g.beginPath(); g.arc(80, 134, 24, 0, TAU); g.fill(); g.fillStyle = "#FF8A3D"; g.beginPath(); g.moveTo(84, 134); g.lineTo(106, 138); g.lineTo(84, 140); g.fill(); g.fillStyle = "#2B2342"; g.beginPath(); g.arc(86, 128, 3, 0, TAU); g.fill(); g.fillStyle = "#FF5A5F"; g.fillRect(58, 150, 44, 8); return 1.5; },
  ],
  scrapyard: [
    (g, r, L, lit) => { for (let k = 0; k < 4; k++) { g.fillStyle = lit("#2A2626"); rr(g, 40 + (r() - 0.5) * 10, 196 - k * 20, 80, 20, 9); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.08); g.fillRect(48, 200 - k * 20, 64, 3); } return 1.3; },
    (g, r, L, lit) => { const col = lit(["#3E7CB1", "#C0392B", "#2E8B57"][Math.floor(r() * 3)]); g.fillStyle = col; rr(g, 50, 120, 60, 96, 6); g.fill(); g.fillStyle = shade(col, -0.25); g.fillRect(50, 146, 60, 5); g.fillRect(50, 186, 60, 5); g.fillStyle = rgba("#FFC233", 0.9); g.beginPath(); g.moveTo(80, 160); g.lineTo(92, 176); g.lineTo(68, 176); g.fill(); return 1.4; },
    (g, r, L, lit) => { g.fillStyle = lit("#6A5A4E"); rr(g, 30, 120, 100, 84, 8); g.fill(); g.fillStyle = lit("#2A3A3A"); rr(g, 42, 130, 62, 62, 10); g.fill(); g.fillStyle = rgba("#9CFFB0", 0.15 + L.night * 0.2); rr(g, 46, 134, 54, 54, 8); g.fill(); g.strokeStyle = lit("#2A2626"); g.lineWidth = 3; g.beginPath(); g.moveTo(70, 120); g.lineTo(50, 92); g.moveTo(80, 120); g.lineTo(104, 94); g.stroke(); return 1.3; },
    (g, r, L, lit) => { g.fillStyle = lit("#5C4A3E"); g.fillRect(76, 90, 8, 130); g.save(); g.translate(80, 86); g.rotate(0.12); g.fillStyle = lit("#E8C060"); g.fillRect(-46, -26, 92, 46); g.fillStyle = "#2A2A2A"; g.font = "bold 20px sans-serif"; g.textAlign = "center"; g.fillText("JUNK", 0, 6); g.restore(); return 2.4; },
  ],
  shroom: [
    (g, r, L, lit) => { g.fillStyle = lit("#E8E0FF"); g.fillRect(70, 110, 20, 110); const col = ["#3DF5A7", "#7CC4FF", "#FF7AD9"][Math.floor(r() * 3)]; glow(g, 80, 100, 80, col, 0.4 + L.night * 0.3); g.fillStyle = mix(col, "#2A1F4F", 0.15); g.beginPath(); g.ellipse(80, 104, 62, 40, 0, Math.PI, 0); g.fill(); g.fillStyle = rgba("#FFFFFF", 0.7); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(40 + k * 20, 90 - Math.sin(k) * 12, 5, 0, TAU); g.fill(); } return 2.4; },
    (g, r, L, lit) => { g.strokeStyle = lit("#3DD68C"); g.lineWidth = 5; g.lineCap = "round"; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.35; g.beginPath(); g.moveTo(80, 216); g.quadraticCurveTo(80 + Math.cos(a) * 60, 216 + Math.sin(a) * 140, 80 + Math.cos(a) * 90, 216 + Math.sin(a) * 110 + 30); g.stroke(); } return 1.6; },
    (g, r, L, lit) => { g.strokeStyle = lit("#4A3480"); g.lineWidth = 6; g.beginPath(); g.moveTo(60, 216); g.lineTo(60, 60); g.quadraticCurveTo(60, 40, 90, 40); g.lineTo(100, 70); g.stroke(); glow(g, 100, 92, 40, L.glow, 0.6 + L.night * 0.4); g.fillStyle = "#FFF6C8"; rr(g, 90, 76, 20, 30, 6); g.fill(); return 2.6; },
    (g, r, L, lit) => { for (let k = 0; k < 4; k++) { const x = 40 + k * 26, h = 30 + r() * 40, col = ["#3DF5A7", "#7CC4FF", "#FF7AD9"][k % 3]; glow(g, x, 216 - h, 30, col, 0.35 + L.night * 0.3); g.fillStyle = lit("#E8E0FF"); g.fillRect(x - 3, 216 - h, 6, h); g.fillStyle = col; g.beginPath(); g.ellipse(x, 216 - h, 16, 10, 0, Math.PI, 0); g.fill(); } return 1.2; },
  ],
  coral: [
    (g, r, L, lit) => { const col = lit(["#FF7A8A", "#FFB46B", "#B07CFF"][Math.floor(r() * 3)]); g.strokeStyle = col; g.lineCap = "round"; const br = (x: number, y: number, a: number, len: number, w: number, d: number) => { const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); if (d) { br(ex, ey, a - 0.5, len * 0.75, w * 0.7, d - 1); br(ex, ey, a + 0.45, len * 0.72, w * 0.7, d - 1); } }; br(80, 216, -Math.PI / 2, 52, 16, 4); return 2.2; },
    (g, r, L, lit) => { const col = lit(["#FF6B8A", "#5EF0D0", "#FFC46B"][Math.floor(r() * 3)]); g.strokeStyle = col; g.lineWidth = 7; g.lineCap = "round"; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k - 4.5) * 0.2; g.beginPath(); g.moveTo(80, 216); g.quadraticCurveTo(80 + Math.cos(a) * 40, 216 + Math.sin(a) * 60, 80 + Math.cos(a) * 54 + Math.sin(k) * 8, 216 + Math.sin(a) * 90); g.stroke(); } return 1.4; },
    (g, r, L, lit) => { g.strokeStyle = lit("#3E8E4E"); g.lineWidth = 10; g.lineCap = "round"; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(60 + k * 20, 216); for (let y = 0; y < 190; y += 8) g.lineTo(60 + k * 20 + Math.sin(y * 0.05 + k) * 12, 216 - y); g.stroke(); } return 3; },
    (g, r, L, lit) => { g.fillStyle = lit("#C8A0D8"); g.beginPath(); g.ellipse(80, 200, 50, 18, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(80, 184, 50, 30, -0.3, Math.PI, 0); g.fill(); g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(80, 192, 9, 0, TAU); g.fill(); glow(g, 80, 192, 22, "#FFFFFF", 0.4); return 1; },
  ],
  clockwork: [
    (g, r, L, lit) => { g.fillStyle = lit("#3A2410"); g.fillRect(76, 60, 8, 160); g.fillRect(60, 210, 40, 10); glow(g, 80, 50, 46, "#FFB050", 0.4 + L.night * 0.5); g.fillStyle = lit("#D9A24A"); g.beginPath(); g.moveTo(62, 64); g.lineTo(98, 64); g.lineTo(92, 30); g.lineTo(68, 30); g.fill(); g.fillStyle = "#FFE6B0"; g.fillRect(70, 36, 20, 24); return 3.2; },
    (g, r, L, lit) => { g.save(); g.translate(80, 150); g.fillStyle = lit("#D9A24A"); for (let k = 0; k < 12; k++) { g.rotate(TAU / 12); g.fillRect(-8, 46, 16, 18); } g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill(); g.fillStyle = lit("#7A5218"); g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill(); g.restore(); return 2; },
    (g, r, L, lit) => { g.strokeStyle = lit("#B87333"); g.lineWidth = 16; g.beginPath(); g.moveTo(40, 216); g.lineTo(40, 120); g.lineTo(120, 120); g.lineTo(120, 216); g.stroke(); g.strokeStyle = "#C0392B"; g.lineWidth = 6; g.beginPath(); g.arc(80, 106, 16, 0, TAU); g.stroke(); return 1.6; },
    (g, r, L, lit) => { g.fillStyle = lit("#3A2410"); g.fillRect(74, 80, 12, 140); g.fillStyle = lit("#F4E8D0"); g.beginPath(); g.arc(80, 60, 36, 0, TAU); g.fill(); g.strokeStyle = lit("#7A5218"); g.lineWidth = 6; g.stroke(); g.strokeStyle = "#2A1A0A"; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 60); g.lineTo(80, 36); g.moveTo(80, 60); g.lineTo(98, 66); g.stroke(); return 2.8; },
  ],
  haunted: [
    (g, r, L, lit) => { g.fillStyle = lit("#8A8AA0"); g.beginPath(); g.moveTo(40, 216); g.lineTo(40, 120); g.arc(80, 120, 40, Math.PI, 0); g.lineTo(120, 216); g.fill(); g.fillStyle = rgba("#000000", 0.3); g.fillRect(60, 140, 40, 6); g.fillRect(76, 126, 8, 40); return 1.4; },
    (g, r, L, lit) => { g.fillStyle = lit("#FF8A1F"); g.beginPath(); g.ellipse(80, 186, 50, 32, 0, 0, TAU); g.fill(); glow(g, 80, 186, 70, L.glow, 0.3 + L.night * 0.4); g.fillStyle = "#FFE7A0"; g.beginPath(); g.moveTo(56, 176); g.lineTo(68, 188); g.lineTo(52, 188); g.fill(); g.beginPath(); g.moveTo(104, 176); g.lineTo(92, 188); g.lineTo(108, 188); g.fill(); g.fillRect(62, 198, 36, 6); g.fillStyle = "#3A6B2A"; g.fillRect(76, 148, 8, 14); return 1.1; },
    (g, r, L, lit) => { g.strokeStyle = lit("#1E1424"); g.lineCap = "round"; const tr = (x: number, y: number, a: number, len: number, w: number, d: number) => { const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); if (d) { tr(ex, ey, a - 0.55 - r() * 0.3, len * 0.7, w * 0.65, d - 1); tr(ex, ey, a + 0.5 + r() * 0.3, len * 0.66, w * 0.65, d - 1); } }; tr(80, 216, -Math.PI / 2, 60, 12, 4); return 3; },
    (g, r, L, lit) => { g.fillStyle = lit("#2A1A2E"); g.fillRect(76, 90, 8, 130); g.beginPath(); g.moveTo(80, 90); g.quadraticCurveTo(110, 70, 110, 100); g.stroke(); glow(g, 110, 116, 36, "#B7FF6B", 0.5 + L.night * 0.4); g.fillStyle = "#D8FFB0"; rr(g, 100, 100, 20, 28, 6); g.fill(); return 2.6; },
  ],
  orbit: [
    (g, r, L, lit) => { g.strokeStyle = lit("#6A7490"); g.lineWidth = 6; g.beginPath(); g.moveTo(80, 216); g.lineTo(80, 110); g.stroke(); g.fillStyle = lit("#D6DEEC"); g.beginPath(); g.ellipse(80, 96, 50, 22, -0.5, 0, TAU); g.fill(); g.fillStyle = lit("#6A7490"); g.beginPath(); g.ellipse(80, 96, 34, 14, -0.5, 0, TAU); g.fill(); g.strokeStyle = lit("#D6DEEC"); g.lineWidth = 3; g.beginPath(); g.moveTo(80, 96); g.lineTo(100, 66); g.stroke(); return 2.4; },
    (g, r, L, lit) => { for (let k = 0; k < 3; k++) { const h = 50 + r() * 60; g.save(); g.translate(62 + k * 18, 216); g.rotate((k - 1) * 0.3); glow(g, 0, -h / 2, 40, "#A78BFA", 0.25 + L.night * 0.2); g.fillStyle = rgba("#C4B5FD", 0.9); g.beginPath(); g.moveTo(-12, 0); g.lineTo(-12, -h); g.lineTo(0, -h - 18); g.lineTo(12, -h); g.lineTo(12, 0); g.fill(); g.restore(); } void lit; return 1.6; },
    (g, r, L, lit) => { g.fillStyle = lit("#6A7490"); g.fillRect(74, 100, 12, 120); glow(g, 80, 90, 40, L.glow, 0.5 + L.night * 0.4); g.fillStyle = "#E0F0FF"; g.beginPath(); g.arc(80, 90, 12, 0, TAU); g.fill(); return 2.4; },
    (g, r, L, lit) => { g.fillStyle = lit("#8A94B0"); rr(g, 30, 140, 100, 76, 10); g.fill(); g.fillStyle = lit("#FFC233"); for (let k = 0; k < 4; k++) g.fillRect(38 + k * 24, 150, 14, 8); g.fillStyle = rgba("#000000", 0.2); g.fillRect(30, 180, 100, 6); return 1.3; },
  ],
};

export class PropArt {
  private sprites: PropSprite[] = [];
  constructor(L: Look, res: number) {
    const painters = P[L.world.id] ?? P.toybox;
    const r = makeRng(L.seed + 991);
    const dim = (col: string) => mix(col, shade(L.haze, -0.5), L.night * 0.5);
    for (let k = 0; k < painters.length; k++) {
      const cv = document.createElement("canvas");
      cv.width = Math.round(SW * res); cv.height = Math.round(SH * res);
      const g = cv.getContext("2d")!;
      g.setTransform(res, 0, 0, res, 0, 0);
      const h = painters[k](g, r, L, dim);
      this.sprites.push({ cv, h });
    }
  }
  get(seed: number) { return this.sprites[seed % this.sprites.length]; }
  /** free the painted sprites now (a new stage is loading) */
  dispose() { for (const s2 of this.sprites) { s2.cv.width = 0; s2.cv.height = 0; } }
  /** world space (y up): a prop planted at (x, y) */
  draw(c: C, x: number, y: number, s: number, seed: number, flip: boolean) {
    const sp = this.get(seed);
    const h = sp.h * s, w = h * (SW / SH);
    c.save(); c.translate(x, y - 0.25); c.scale(flip ? -w / SW : w / SW, -h / SH);
    c.drawImage(sp.cv, -SW / 2, -SH, SW, SH);
    c.restore();
  }
}
