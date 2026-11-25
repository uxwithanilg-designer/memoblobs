// Pickups, painted once as sprites and drawn in world space: spinning gold coins, big purple star coins, red oil cans
// with a fuel drop, glossy bouncing hearts and power-up bubbles (turbo flame, helmet shield, coin magnet, floaty
// wings, sticky tyre) with a soft glow at night.
import type { Item, PowerId } from "../course";
import { rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const PX = 128;

function sprite(paint: (g: C) => void) {
  const cv = document.createElement("canvas"); cv.width = cv.height = PX;
  paint(cv.getContext("2d")!);
  return cv;
}
const POWER_COL: Record<PowerId, string> = { turbo: "#FF8A3D", shield: "#38BDF8", magnet: "#FF4F7A", float: "#A78BFA", grip: "#3EE08F" };
export const powerColor = (p: PowerId) => POWER_COL[p];

export class ItemArt {
  private coin = sprite((g) => {
    const rg = g.createRadialGradient(48, 44, 6, 64, 64, 60); rg.addColorStop(0, "#FFF6B0"); rg.addColorStop(0.5, "#FFD23F"); rg.addColorStop(1, "#E39A10");
    g.fillStyle = "#B87309"; g.beginPath(); g.arc(64, 66, 58, 0, TAU); g.fill();
    g.fillStyle = rg; g.beginPath(); g.arc(64, 62, 56, 0, TAU); g.fill();
    g.strokeStyle = "#E8A317"; g.lineWidth = 7; g.beginPath(); g.arc(64, 62, 40, 0, TAU); g.stroke();
    g.fillStyle = "#E8A317"; g.font = "bold 54px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("G", 64, 65);
    g.fillStyle = rgba("#FFFFFF", 0.7); g.beginPath(); g.ellipse(44, 38, 16, 8, -0.6, 0, TAU); g.fill();
  });
  private star = sprite((g) => {
    g.save(); g.translate(64, 64);
    const star = (r1: number, r2: number) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? r2 : r1; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    g.fillStyle = "#5B21B6"; star(62, 28); g.fill();
    const rg = g.createRadialGradient(-14, -18, 4, 0, 0, 58); rg.addColorStop(0, "#F0E0FF"); rg.addColorStop(0.5, "#A78BFA"); rg.addColorStop(1, "#6D28D9");
    g.fillStyle = rg; star(56, 25); g.fill();
    g.fillStyle = "#FFD23F"; star(20, 9); g.fill();
    g.restore();
  });
  private fuel = sprite((g) => {
    g.fillStyle = "#8A1420"; g.beginPath(); g.roundRect(22, 26, 84, 96, 14); g.fill();
    const lg = g.createLinearGradient(20, 0, 108, 0); lg.addColorStop(0, "#FF5A5F"); lg.addColorStop(0.45, "#FF8A80"); lg.addColorStop(1, "#C81E2E");
    g.fillStyle = lg; g.beginPath(); g.roundRect(24, 22, 80, 96, 13); g.fill();
    g.fillStyle = "#2B2342"; g.fillRect(70, 6, 22, 20); g.fillStyle = "#4A4060"; g.fillRect(72, 2, 18, 8);
    g.strokeStyle = "#8A1420"; g.lineWidth = 9; g.beginPath(); g.moveTo(36, 22); g.quadraticCurveTo(46, 4, 60, 22); g.stroke();
    g.fillStyle = "#FFE14D"; g.beginPath(); g.moveTo(64, 46); g.quadraticCurveTo(84, 72, 64, 96); g.quadraticCurveTo(44, 72, 64, 46); g.fill();
    g.fillStyle = "#2B2342"; g.beginPath(); g.moveTo(64, 58); g.quadraticCurveTo(76, 74, 64, 88); g.quadraticCurveTo(52, 74, 64, 58); g.fill();
    g.fillStyle = rgba("#FFFFFF", 0.4); g.fillRect(30, 30, 10, 74);
  });
  private heart = sprite((g) => {
    const path = () => { g.beginPath(); g.moveTo(64, 116); g.bezierCurveTo(8, 74, 6, 28, 38, 22); g.bezierCurveTo(54, 18, 62, 30, 64, 40); g.bezierCurveTo(66, 30, 74, 18, 90, 22); g.bezierCurveTo(122, 28, 120, 74, 64, 116); g.closePath(); };
    g.fillStyle = "#A3123F"; g.save(); g.translate(0, 4); path(); g.fill(); g.restore();
    const rg = g.createRadialGradient(44, 40, 4, 64, 64, 70); rg.addColorStop(0, "#FFC2D4"); rg.addColorStop(0.45, "#FF4F7A"); rg.addColorStop(1, "#C81E4E");
    g.fillStyle = rg; path(); g.fill();
    g.fillStyle = rgba("#FFFFFF", 0.7); g.beginPath(); g.ellipse(40, 42, 12, 7, -0.7, 0, TAU); g.fill();
  });
  private powers: Record<PowerId, HTMLCanvasElement>;
  constructor() {
    const mk = (id: PowerId, icon: (g: C) => void) => sprite((g) => {
      const col = POWER_COL[id];
      const rg = g.createRadialGradient(44, 40, 6, 64, 64, 60); rg.addColorStop(0, rgba("#FFFFFF", 0.95)); rg.addColorStop(0.35, rgba(col, 0.55)); rg.addColorStop(1, rgba(shade(col, -0.2), 0.9));
      g.fillStyle = rg; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill();
      g.strokeStyle = rgba("#FFFFFF", 0.85); g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke();
      g.save(); g.translate(64, 66); icon(g); g.restore();
      g.fillStyle = rgba("#FFFFFF", 0.75); g.beginPath(); g.ellipse(40, 34, 14, 7, -0.6, 0, TAU); g.fill();
    });
    this.powers = {
      turbo: mk("turbo", (g) => { g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(6, -34); g.lineTo(-18, 6); g.lineTo(0, 6); g.lineTo(-6, 34); g.lineTo(20, -8); g.lineTo(2, -8); g.closePath(); g.fill(); }),
      shield: mk("shield", (g) => { g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(0, -32); g.lineTo(26, -20); g.quadraticCurveTo(24, 18, 0, 34); g.quadraticCurveTo(-24, 18, -26, -20); g.closePath(); g.fill(); }),
      magnet: mk("magnet", (g) => { g.strokeStyle = "#FFFFFF"; g.lineWidth = 14; g.beginPath(); g.arc(0, -4, 20, Math.PI, 0, true); g.stroke(); g.fillStyle = "#FFFFFF"; g.fillRect(-27, -10, 14, 22); g.fillRect(13, -10, 14, 22); }),
      float: mk("float", (g) => { g.fillStyle = "#FFFFFF"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 14, -4, 20, 10, s * 0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(s * 18, 10, 14, 7, s * 0.7, 0, TAU); g.fill(); } }),
      grip: mk("grip", (g) => { g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill(); g.fillStyle = POWER_COL.grip; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.fillStyle = "#FFFFFF"; for (let k = 0; k < 8; k++) { g.save(); g.rotate((k / 8) * TAU); g.fillRect(24, -5, 10, 10); g.restore(); } }),
    };
  }

  /** world space (y up): an item at its spot, bobbing and spinning */
  draw(c: C, it: Item, t: number, night: number) {
    let sp: HTMLCanvasElement, size = 0.9, sx = 1;
    const bob = Math.sin(t * 3 + it.ph) * 0.1;
    if (it.kind === "coin") { sp = this.coin; size = 0.78; sx = Math.cos(t * 3.2 + it.ph); }
    else if (it.kind === "star") { sp = this.star; size = 1.25; sx = 0.85 + 0.15 * Math.cos(t * 2 + it.ph); }
    else if (it.kind === "fuel") { sp = this.fuel; size = 1.15; }
    else if (it.kind === "heart") { sp = this.heart; size = 1.05 * (1 + 0.08 * Math.sin(t * 6)); }
    else { sp = this.powers[it.power ?? "turbo"]; size = 1.15; }
    if ((night > 0.3 || it.kind !== "coin") && it.kind !== "coin") {
      const col = it.kind === "fuel" ? "#FF5A5F" : it.kind === "heart" ? "#FF4F7A" : it.kind === "star" ? "#A78BFA" : POWER_COL[it.power ?? "turbo"];
      const g = c.createRadialGradient(it.x, it.y + bob, 0.05, it.x, it.y + bob, size * 1.1);
      g.addColorStop(0, rgba(col, 0.35 + night * 0.2)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(it.x - size * 1.1, it.y + bob - size * 1.1, size * 2.2, size * 2.2);
    }
    c.save(); c.translate(it.x, it.y + bob); c.scale((size / PX) * (Math.abs(sx) < 0.08 ? 0.08 : sx), -size / PX);
    c.drawImage(sp, -PX / 2, -PX / 2);
    c.restore();
  }
}
